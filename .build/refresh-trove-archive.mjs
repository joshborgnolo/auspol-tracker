#!/usr/bin/env node
/* refresh-trove-archive.mjs — regenerate archives/trove/index.html and the two
   committed data files from the local Trove harvest:

     .matilda/trove-harvest/poll-*.jsonl   local crawl (node .build/harvest-trove.mjs)
     .matilda/trove-harvest/text/<id>.txt  optional full OCR text
                                           (node .build/harvest-trove-text.mjs)

     → data/trove-mentions-monthly.csv     year,month,articles,figures
     → data/trove-poll-articles.csv        the pollster-name-matched reports
     → data/trove-text.jsonl               OCR text (only when it fits the repo)
     → archives/trove/index.html

     node .build/refresh-trove-archive.mjs

   "Figures" rows (news language about polling) are counted for the monthly CSV
   but not committed row-by-row — the corpus is too large; anyone can re-derive
   them from the crawler. Pollster-name rows are the poll *reports*: Morgan
   Gallup, AC Nielsen, Newspoll, Saulwick, Spectrum, ANOP … the tables a
   journalist actually printed numbers from. Chrome matches the other archive
   pages; this is the fifth tab. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const HARVEST = path.join(ROOT, ".matilda", "trove-harvest");
const OUT_MONTHLY = path.join(ROOT, "data", "trove-mentions-monthly.csv");
const OUT_ARTICLES = path.join(ROOT, "data", "trove-poll-articles.csv");
const OUT_TEXT = path.join(ROOT, "data", "trove-text.jsonl");
const OUT_PAGE = path.join(ROOT, "archives", "trove", "index.html");

/* named-pollster patterns — deliberately strict so surnames like Morgan and
   AGB don't false-positive on crime news. Order = the column's label. */
const POLLSTERS = [
  [/roy morgan|morgan gallup|morgan research|morgan poll/i, "Morgan"],
  [/gallup poll/i, "Gallup"],
  [/a\.?\s?c\.?\s?nielsen|nielsen poll/i, "Nielsen"],
  [/newspoll/i, "Newspoll"],
  [/saulwick|age poll/i, "Saulwick"],
  [/spectrum research/i, "Spectrum"],
  [/\banop\b/i, "ANOP"],
  [/a\.?\s?g\.?\s?b\.?\s*(mcnair|poll|survey)/i, "AGB McNair"],
  [/quadrant research/i, "Quadrant"],
  [/harrison poll/i, "Harrison"],
];
const FIGURES = /\b(opinion poll|two[- ]party[ -]?preferred|primary votes?\b|voting intention|poll results?|party support|polls? (?:gave|give|shows?|showed|put|puts?)\b)/i;

const MONTHS = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 };
const MONTH_NAME = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
/* "Monday 22 March 1993" → "1993-03-22"; null when unparsable */
const isoDate = (s) => {
  const m = String(s).match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (!m) return null;
  const mo = MONTHS[m[2].toLowerCase()];
  if (!mo) return null;
  return `${m[3]}-${String(mo).padStart(2, "0")}-${String(+m[1]).padStart(2, "0")}`;
};

if (!fs.existsSync(HARVEST)) {
  console.error(`no harvest at ${HARVEST} — run .build/harvest-trove.mjs first`);
  process.exit(1);
}
const files = fs.readdirSync(HARVEST).filter((f) => /^poll-\d{4}-\d{2}\.jsonl$/.test(f)).sort();
if (!files.length) { console.error("harvest is empty"); process.exit(1); }

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const csvCell = (v) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};

const monthly = {};          // "YYYY-MM" → { articles, figures }
const mastheads = new Map(); // name → count
const pollRows = [];         // pollster-matched articles
const seenIds = new Set();   // concurrent harvesters could duplicate ids across files
let total = 0, gazNote = 0;
for (const f of files) {
  const ym = f.slice(5, 12);
  const cell = (monthly[ym] ??= { articles: 0, figures: 0 });
  for (const line of fs.readFileSync(path.join(HARVEST, f), "utf8").split("\n")) {
    if (!line.trim()) continue;
    const r = JSON.parse(line);
    if (seenIds.has(r.id)) continue;
    seenIds.add(r.id);
    cell.articles++; total++;
    const hay = `${r.title} ${r.abstrct} ${(r.snippets || []).join(" ")}`;
    const paper = r.newspaper || "(unknown)";
    mastheads.set(paper, (mastheads.get(paper) || 0) + 1);
    if (FIGURES.test(hay)) cell.figures++;
    for (const [re, house] of POLLSTERS) {
      if (re.test(hay)) {
        pollRows.push({
          id: r.id, iso: isoDate(r.date) || r.date, date: r.date, paper,
          title: r.title, page: r.page, words: r.wordCount, house,
        });
        break;
      }
    }
  }
}

/* ---- committed CSVs ---- */
const monthlyCsv = ["year,month,articles,figures"]
  .concat(Object.entries(monthly).sort().map(([ym, c]) => `${ym.slice(0, 4)},${+ym.slice(5)},${c.articles},${c.figures}`))
  .join("\n") + "\n";
fs.writeFileSync(OUT_MONTHLY, monthlyCsv);

pollRows.sort((a, b) => String(a.iso).localeCompare(String(b.iso)));
const articlesCsv = ["id,date,masthead,title,page,words,pollster,url"]
  .concat(pollRows.map((r) => [r.id, r.iso, r.paper, r.title, r.page, r.words, r.house, `https://trove.nla.gov.au/newspaper/article/${r.id}`].map(csvCell).join(",")))
  .join("\n") + "\n";
fs.writeFileSync(OUT_ARTICLES, articlesCsv);

/* ---- OCR text: commit only when the bundle fits the repo's data norm ---- */
const TEXT_LIMIT = 8 * 1024 * 1024;
let textNote = "none fetched", textBytes = 0;
const textDir = path.join(HARVEST, "text");
if (fs.existsSync(textDir)) {
  const ids = new Set(pollRows.map((r) => String(r.id)));
  const parts = [];
  for (const tf of fs.readdirSync(textDir).sort()) {
    const id = tf.replace(/\.txt$/, "");
    if (!ids.has(id)) continue;
    const raw = fs.readFileSync(path.join(textDir, tf), "utf8")
      .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const rec = JSON.stringify({ id: +id, text: raw });
    if (textBytes + rec.length > TEXT_LIMIT) break;
    parts.push(rec); textBytes += rec.length;
  }
  fs.writeFileSync(OUT_TEXT, parts.join("\n") + (parts.length ? "\n" : ""));
  textNote = `${parts.length} articles, ${(textBytes / 1e6).toFixed(1)} MB`;
  if (parts.length === 0) fs.unlinkSync(OUT_TEXT);
}

/* ---- page ---- */
const decades = {};
for (const [ym, c] of Object.entries(monthly)) {
  const dec = ym.slice(0, 3) + "0";
  (decades[dec] ??= { articles: 0, figures: 0, houses: 0 });
  decades[dec].articles += c.articles; decades[dec].figures += c.figures;
}
const houseByDec = {};
for (const r of pollRows) {
  const dec = String(r.iso).slice(0, 3) + "0";
  houseByDec[dec] = (houseByDec[dec] || 0) + 1;
}
const fmt = (n) => n.toLocaleString("en-AU");
const decRows = Object.entries(decades).sort(([a], [b]) => a.localeCompare(b))
  .map(([d, c]) => `      <tr><td>${d}s</td><td>${fmt(c.articles)}</td><td>${fmt(c.figures)}</td><td>${fmt(houseByDec[d] || 0)}</td></tr>`).join("\n");

const topPapers = [...mastheads.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
const maxPaper = topPapers[0]?.[1] || 1;
const paperRows = topPapers.map(([p, n]) => {
  const w = Math.max(1, Math.round((n / maxPaper) * 40));
  return `      <tr><td class="tl">${esc(p)}</td><td>${fmt(n)}</td><td class="bar"><span style="width:${w}ch"></span></td></tr>`;
}).join("\n");

/* year sections for the poll reports — fullest table for the most recent
   REPORT_YEARS years; earlier years render as one count line each. */
const byYear = new Map();
for (const r of pollRows) {
  const y = String(r.iso).slice(0, 4);
  if (!byYear.has(y)) byYear.set(y, []);
  byYear.get(y).push(r);
}
const years = [...byYear.keys()].sort();
const REPORT_YEARS = 40;
const counted = years.slice(0, Math.max(0, years.length - REPORT_YEARS));
const shown = years.slice(Math.max(0, years.length - REPORT_YEARS));
const yearSecs = [
  ...counted.map((y) => `      <tr><td><a class="y" id="y${y}">${y}</a></td><td>${byYear.get(y).length} poll reports</td></tr>`),
].join("\n");
const yearTables = shown.map((y) => {
  const rows = byYear.get(y).sort((a, b) => String(b.iso).localeCompare(String(a.iso)))
    .map((r) => `      <tr>
        <td>${esc(r.iso)}</td>
        <td class="tl"><a href="https://trove.nla.gov.au/newspaper/article/${esc(r.id)}">${esc(r.title || "(untitled)")}</a></td>
        <td class="tl dim">${esc(r.paper)}</td>
        <td>${esc(r.house)}</td>
        <td class="dim">${esc(r.page || "")}</td>
        <td>${esc(r.words || "")}</td>
      </tr>`).join("\n");
  return `  <h3 id="y${y}">${y} <span class="count">${byYear.get(y).length}</span></h3>
  <div class="rm-scroll">
    <table class="rm">
      <tr class="head"><th>Date</th><th class="tl">Article</th><th class="tl">Masthead</th><th>Poll</th><th>Page</th><th>Words</th></tr>
${rows}
    </table>
  </div>`;
}).join("\n");

const firstYm = Object.keys(monthly).sort()[0];
const lastYm = Object.keys(monthly).sort().at(-1);
const page = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Trove newspaper poll archive · auspol tracker</title>
<!-- Generated by .build/refresh-trove-archive.mjs from the local Trove harvest
     (data: see data/trove-mentions-monthly.csv, data/trove-poll-articles.csv).
     Do not hand-edit. Not part of the .build/newtracker pipeline. -->
<meta name="description" content="Every newspaper article in the National Library's Trove archive mentioning a poll, ${fmt(total)} articles from ${firstYm} to ${lastYm}, with the poll reports extracted — Morgan Gallup, Nielsen, Newspoll, Saulwick and friends as originally printed.">
<meta name="theme-color" content="#faf6f0" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#1a1612" media="(prefers-color-scheme: dark)">
<meta property="og:type" content="website">
<meta property="og:site_name" content="auspol tracker">
<meta property="og:title" content="Trove newspaper poll archive · auspol tracker">
<meta property="og:description" content="Every Trove newspaper article mentioning a poll, and the poll reports extracted from them.">
<meta name="twitter:card" content="summary">
<link rel="canonical" href="https://auspoltracker.com/archives/trove/">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='6' fill='%230b1d2c'/%3E%3Crect x='6' y='15' width='5' height='11' fill='%23d62828'/%3E%3Crect x='13.5' y='8' width='5' height='18' fill='%23b08d39'/%3E%3Crect x='21' y='18' width='5' height='8' fill='%23ec7a08'/%3E%3C/svg%3E">
<style>
@font-face { font-family: 'Crimson Text'; font-style: normal; font-weight: 400; font-display: swap;
  src: url("/assets/fonts/crimsontext-400-latin.aac0df38.woff2") format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD; }
@font-face { font-family: 'Crimson Text'; font-style: normal; font-weight: 600; font-display: swap;
  src: url("/assets/fonts/crimsontext-600-latin.94af2060.woff2") format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD; }
@font-face { font-family: 'IBM Plex Sans'; font-style: normal; font-weight: 300 700; font-display: swap;
  src: url("/assets/fonts/ibmplexsans-latin.056e4e24.woff2") format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD; }

:root {
  --bg:        oklch(0.975 0.009 80);
  --ink:       oklch(0.27 0.012 55);
  --ink-2:     oklch(0.44 0.012 55);
  --ink-3:     oklch(0.52 0.010 58);
  --ink-faint: oklch(0.70 0.008 65);
  --line:      oklch(0.895 0.008 75);
  --line-2:    oklch(0.935 0.006 78);
  --serif: "Crimson Text", Georgia, "Times New Roman", serif;
  --sans: "IBM Plex Sans", system-ui, -apple-system, "Segoe UI", sans-serif;
  --maxw: 1080px;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg:        oklch(0.205 0.010 65);
    --ink:       oklch(0.940 0.008 80);
    --ink-2:     oklch(0.800 0.009 78);
    --ink-3:     oklch(0.670 0.009 72);
    --ink-faint: oklch(0.545 0.009 68);
    --line:      oklch(0.355 0.011 66);
    --line-2:    oklch(0.312 0.010 66);
  }
}
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { height: 100%; }
body {
  background: var(--bg); color: var(--ink); font-family: var(--sans);
  font-size: 14px; font-feature-settings: "tnum" 1, "ss01" 1;
  -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility;
  line-height: 1.45; display: flex; flex-direction: column;
  min-height: 100vh; min-height: 100dvh;
}
.tabs {
  display: flex; gap: 4px; flex-wrap: wrap;
  max-width: 680px; margin: 40px auto 0; width: 100%;
  padding: 0 28px; border-bottom: 1px solid var(--line);
}
.tab { display: inline-block; font-weight: 600; font-size: 14px; color: var(--ink-3);
  padding: 8px 12px 10px; margin-bottom: -1px; border-bottom: 2px solid transparent; text-decoration: none; }
.tab:hover { color: var(--ink); }
.tab.active { color: var(--ink); border-bottom-color: var(--ink); }
.ss-back {
  position: fixed; right: 18px; bottom: 18px; z-index: 300;
  display: inline-block; padding: 10px 16px; border-radius: 999px;
  border: 1px solid var(--line); background: var(--bg); color: var(--ink);
  font-size: 13px; font-weight: 600; text-decoration: none; cursor: pointer;
  box-shadow: 0 3px 16px oklch(0 0 0 / 0.16);
}
.ss-back:hover { border-color: var(--ink-3); }
.frame-wrap { flex: 1; display: flex; flex-direction: column; max-width: var(--maxw); width: 100%;
  margin: 0 auto; padding: 40px calc(28px + env(safe-area-inset-right, 0px)) calc(64px + env(safe-area-inset-bottom, 0px)) calc(28px + env(safe-area-inset-left, 0px)); }
.frame-wrap h1 { font-family: var(--serif); font-size: 34px; font-weight: 600; letter-spacing: -0.01em; margin: 0 0 6px; }
.frame-wrap h2 { font-family: var(--serif); font-size: 20px; font-weight: 600; margin: 32px 0 8px; padding-top: 14px; border-top: 1px solid var(--line); }
.frame-wrap h3 { font-family: var(--sans); font-size: 13px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: var(--ink-2); margin: 22px 0 2px; }
h3 .count { color: var(--ink-faint); font-weight: 400; letter-spacing: 0; }
.ss-sub, .body-copy { font-size: 14.5px; line-height: 1.6; color: var(--ink-2); max-width: 680px; }
.ss-sub { margin: 0 0 4px; } .body-copy { margin: 12px 0; } .body-copy + .body-copy { margin-top: 10px; }
.ss-sub a, .body-copy a { color: inherit; }
.ss-note { margin-top: 20px; font-size: 14.5px; line-height: 1.6; color: var(--ink-2); max-width: 680px; }
.ss-note a { color: var(--ink-2); }
.ss-note a:hover, .ss-note a:focus-visible { text-decoration: underline; text-underline-offset: 2px; }
.rm-sub { font-size: 12.5px; color: var(--ink-3); margin: 0 0 4px; max-width: 680px; }
.rm-scroll { overflow-x: auto; margin-top: 8px; }
table.rm { border-collapse: collapse; width: 100%; font-size: 12.5px; font-variant-numeric: tabular-nums; }
table.rm th, table.rm td { text-align: right; padding: 4px 10px 4px 0; font-weight: 400; }
table.rm .tl { text-align: left; }
table.rm tr.head th { font-weight: 600; border-bottom: 1px solid var(--line); padding-top: 5px; padding-bottom: 5px; color: var(--ink); }
table.rm tr:not(.head) td { border-bottom: 1px solid var(--line-2); color: var(--ink-2); }
table.rm td.dim { color: var(--ink-faint); }
table.rm a { color: var(--ink); font-weight: 600; text-decoration: none; }
table.rm a:hover { text-decoration: underline; }
table.rm td.bar span { display: inline-block; height: 8px; background: var(--ink-faint); opacity: 0.5; }
.y { color: var(--ink); font-weight: 600; text-decoration: none; }
ol.steps { margin: 10px 0 0 20px; max-width: 680px; font-size: 14.5px; line-height: 1.6; color: var(--ink-2); }
ol.steps li { margin-bottom: 10px; }
ol.steps a { color: inherit; }
pre.cmd { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12.5px;
  background: var(--line-2); color: var(--ink); border-radius: 6px; padding: 10px 12px; margin: 8px 0 14px; overflow-x: auto; max-width: 680px; }
</style>
</head>
<body>
<nav class="tabs" aria-label="Poll archives">
  <a class="tab" href="/archives/newspoll/">Newspoll</a>
  <a class="tab" href="/archives/acnielsen/">AC Nielsen</a>
  <a class="tab" href="/archives/morgan/">Morgan</a>
  <a class="tab" href="/archives/galaxy/">Galaxy</a>
  <a class="tab active" aria-current="page" href="/archives/trove/">Trove</a>
</nav>
<main class="frame-wrap">
  <h1>Trove newspaper poll archive</h1>
  <p class="ss-sub">Every newspaper article in the National Library's <a href="https://trove.nla.gov.au">Trove</a> archive that mentions a poll — ${fmt(total)} articles, ${esc(firstYm)} to ${esc(lastYm)}, harvested through Trove's own search API — and the ${fmt(pollRows.length)} poll reports extracted from them.</p>

  <p class="body-copy">This page exists for safekeeping and for verification. The polling series the tracker compares against — Morgan, Nielsen, Newspoll and the rest — were read in print before they were ever published online; for the years the pollsters' own sites don't reach back to, the newspaper of record is the only published source left. Trove's digitisation window is the coverage: state mastheads to the mid-1950s, The Canberra Times to 1995, and little after that but government gazettes.</p>

  <h2>Coverage over time</h2>
  <p class="rm-sub">Articles matching "( poll )" per decade. "About polling" is the subset written in poll-figures language (opinion poll, two-party-preferred, primary vote …); "poll reports" name a pollster. The 1990s row stops at 1995 — that is when the newspapers leave copyright clearance, not when polling stopped.</p>
  <div class="rm-scroll"><table class="rm">
    <tr class="head"><th class="tl">Decade</th><th>Articles</th><th>About polling</th><th>Poll reports</th></tr>
${decRows}
  </table></div>

  <h2>The mastheads</h2>
  <p class="rm-sub">Top ${topPapers.length} of ${mastheads.size} titles, by poll-mentioning articles. The Canberra Times carried most published-poll coverage from the 1960s until its digitisation ends.</p>
  <div class="rm-scroll"><table class="rm">
    <tr class="head"><th class="tl">Masthead</th><th>Articles</th><th class="tl"></th></tr>
${paperRows}
  </table></div>

  <h2>The poll reports</h2>
  <p class="rm-sub">${fmt(pollRows.length)} articles that name a pollster. Every row links to the article on Trove, where the scan and corrected text are public. The full set is in <a href="/data/trove-poll-articles.csv">trove-poll-articles.csv</a>; the monthly tallies behind the first table are in <a href="/data/trove-mentions-monthly.csv">trove-mentions-monthly.csv</a>.${textNote !== "none fetched" ? ` Full OCR text for ${esc(textNote.split(",")[0])} of them is mirrored in <a href="/data/trove-text.jsonl">trove-text.jsonl</a>.` : ""}</p>
${yearSecs ? `  <div class="rm-scroll"><table class="rm">
    <tr class="head"><th class="tl">Earlier years</th><th></th></tr>
${yearSecs}
  </table></div>` : ""}
${yearTables}

  <h2>How this was collected</h2>
  <p class="body-copy">Everything on this page is reproducible from the crawler in the repo. The parts, because Trove's own documentation does not describe the route this site uses:</p>
  <ol class="steps">
    <li><strong>The API.</strong> The trove.nla.gov.au web app talks to its own JSON API: <code>GET /api/search/137?terms=( poll )&amp;limits={"date.from":[from],"date.to":[to]}&amp;pageSize=100&amp;startPos=n</code>. Records come back in <code>works[]</code>. Each record carries the article's id, title, masthead, date, page, word count, abstract and search snippets.</li>
    <li><strong>The header.</strong> The search authorises with an <code>apikey</code> header carrying the site's own public client key — the key shipped to every visitor's browser, captured by watching the page's own requests (<code>page.on('request')</code> in headless Chrome), not a secret and not the registered-developer API. If it ever rotates, re-capture it from the site the same way, or set <code>TROVE_API_KEY</code>.</li>
    <li><strong>The 5000-record wall.</strong> No query returns past startPos 5000, and a heavy month (March 1901) holds more than that — so the crawler splits any over-cap window in half, down to single days. Nothing is deduplicated across windows; ids are unique per window, and windows never overlap.</li>
    <li><strong>The full text.</strong> Every record has a corrected-OCR text rendition at <code>/newspaper/rendition/nla.news-article&lt;ID&gt;.txt</code>. <code>.build/harvest-trove-text.mjs</code> fetches these for the poll reports; the text is committed (<code>trove-text.jsonl</code>) only while the bundle fits the repo's data-file norm — ${esc(textNote)} at last refresh.</li>
  </ol>
  <p class="body-copy">Re-run the whole harvest (resumable; months land in <code>.matilda/trove-harvest/</code>):</p>
  <pre class="cmd">node .build/harvest-trove.mjs 1803 2025
node .build/harvest-trove-text.mjs     # OCR text for the poll reports
node .build/refresh-trove-archive.mjs  # this page + the two CSVs</pre>

  <h2>Known limits</h2>
  <p class="body-copy">The corpus is everything Trove's search matches for the token <code>poll</code> in the newspaper category — that includes polling booths and opinion polls alike, which is the triage the two smaller subsets do. OCR is machine-read and corrected by volunteers; titles from the 1800s especially keep stray misreadings. The gazette tail after 1995 is government printing, not news. And the corpus is a snapshot: the National Library keeps scanning, so a re-run will find more, never less.</p>

  <p class="ss-note">This is a satellite archive page of <a href="/">auspol tracker</a>, an unofficial aggregate of published national polling. The live, interactive tracker carries the current aggregates, charts and per-poll archive.</p>
</main>
<a class="ss-back" href="/">&larr; Back to the interactive tracker</a>
</body>
</html>
`;

fs.mkdirSync(path.dirname(OUT_PAGE), { recursive: true });
fs.writeFileSync(OUT_PAGE, page);
console.log(`read ${files.length} month files, ${fmt(total)} articles`);
console.log(`wrote data/trove-mentions-monthly.csv (${Object.keys(monthly).length} months)`);
console.log(`wrote data/trove-poll-articles.csv (${pollRows.length} poll reports)`);
console.log(`OCR text: ${textNote}`);
console.log(`wrote archives/trove/index.html`);
