#!/usr/bin/env node
/* refresh-galaxy-archive.mjs — regenerate archives/galaxy/index.html from the
   two Galaxy data files, so the page and the data can never drift apart:

     data/galaxy-federal-pre2012.csv   the transcribed pre-2012 federal waves
     data/galaxy-release-index.csv     what survives of galaxyresearch.com.au

   Both are produced/checked by .build/extract-galaxy-archive.mjs; the
   assimilable waves are merged into cyclePolls by
   .build/assimilate-galaxy-cycle-csv.mjs. This script writes only the page.

     node .build/refresh-galaxy-archive.mjs

   Chrome matches the other archive pages (Newspoll, AC Nielsen, Morgan): the
   main site's static-article view — Crimson Text headings over IBM Plex Sans
   body, the tab strip, the ss-note footer and the fixed .ss-back pill. Tables
   run to the wide column, like Morgan's. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const OUT_PAGE = path.join(ROOT, "archives", "galaxy", "index.html");

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/* CSV reader that respects quoted cells (notes carry commas) */
const readCsv = (file) => {
  const text = fs.readFileSync(path.join(ROOT, file), "utf8");
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else if (c !== "\r") cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const head = rows.shift();
  return rows.filter((r) => r.some((c) => c !== ""))
             .map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? "").trim()])));
};

const waves = readCsv("data/galaxy-federal-pre2012.csv");
const index = readCsv("data/galaxy-release-index.csv");

/* ---- which waves the tracker actually carries ---------------------------
   The same test the assimilator applies, restated here rather than imported:
   this page's job is to show the reader why a row did or did not make it. */
const complete = (w) => ["alp", "coalition", "greens", "other", "tpp_alp", "tpp_coalition"].every((k) => w[k] !== "");
const inTracker = (w) => Boolean(w.date) && complete(w) && !w.note.startsWith("SUSPECT");
const held = waves.filter(inTracker).length;

const num = (v) => (v === "" ? '<td class="na">·</td>' : `<td>${esc(v)}</td>`);
const fieldwork = (w) =>
  w.fieldwork_start && w.fieldwork_end
    ? (w.fieldwork_start === w.fieldwork_end ? w.fieldwork_end : `${w.fieldwork_start} → ${w.fieldwork_end}`)
    : "";

const waveRows = waves.map((w) => `      <tr${inTracker(w) ? ' class="held"' : ""}>
        <td>${esc(w.date || "undated")}</td>
        <td class="dim">${esc(fieldwork(w))}</td>
        ${num(w.sample)}${num(w.alp)}${num(w.coalition)}${num(w.greens)}${num(w.other)}
        ${num(w.tpp_alp)}${num(w.tpp_coalition)}
        <td class="dim">${inTracker(w) ? "in the tracker" : "transcript only"}</td>
        <td class="src"><a href="${esc(w.source)}">source</a></td>
      </tr>
      <tr class="note"><td colspan="11">${esc(w.note || "")}</td></tr>`).join("\n");

const KINDS = [
  ["federal", "Galaxy federal releases", "Galaxy's own brand, one post per wave — primaries, 2PP, better PM, sample size and question wording."],
  ["newspoll", "Newspoll releases", "The Newspoll waves Galaxy administered from mid-2015, published on Galaxy's letterhead."],
  ["state", "State releases", "Queensland, Western Australia, South Australia and Victoria."],
  ["commissioned", "Commissioned releases", "Polls run for a client masthead rather than Galaxy's own series."],
  ["pubpolls", "pubpolls.html captures", "Galaxy's own Polls page. Each capture froze whichever federal wave was current, plus its accuracy table of final campaign polls — the only surviving source for the 2007 Greens shares and fieldwork windows."],
  ["ghostwhovotes", "GhostWhoVotes mirror", "The release scans and PDFs that circulated at the time, on the blog that mirrored them."],
  ["not-a-poll", "Not polls", "Media clippings caught by the same URL shape; listed so the count reconciles."],
];

const indexSections = KINDS.map(([kind, title, blurb]) => {
  const rows = index.filter((r) => r.kind === kind);
  if (!rows.length) return "";
  return `  <h3>${esc(title)} <span class="count">${rows.length}</span></h3>
  <p class="rm-sub">${esc(blurb)}</p>
  <ul class="archive-list">
${rows.map((r) => `    <li><a href="${esc(r.wayback_url)}">${esc(r.slug)}</a><span class="note">captured ${esc(r.first_capture.slice(0, 4))}-${esc(r.first_capture.slice(4, 6))}-${esc(r.first_capture.slice(6, 8))}</span></li>`).join("\n")}
  </ul>`;
}).filter(Boolean).join("\n\n");

const page = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Galaxy Research poll archive · auspol tracker</title>
<!-- Generated by .build/refresh-galaxy-archive.mjs from data/galaxy-federal-pre2012.csv
     and data/galaxy-release-index.csv — do not hand-edit. Not part of the
     .build/newtracker pipeline. Chrome is the main site's static-article view:
     the same column, Crimson Text headings over IBM Plex Sans body, ss-note
     footer and fixed .ss-back pill home. -->
<meta name="description" content="The Galaxy Research federal poll record, 2004-2010, reconstructed from the Poll Bludger and Galaxy's own archived site, with an index of every surviving galaxyresearch.com.au release page.">
<meta name="theme-color" content="#faf6f0" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#1a1612" media="(prefers-color-scheme: dark)">
<meta property="og:type" content="website">
<meta property="og:site_name" content="auspol tracker">
<meta property="og:title" content="Galaxy Research poll archive · auspol tracker">
<meta property="og:description" content="The Galaxy Research federal poll record, 2004-2010, reconstructed from sources that outlived the pollster's own website.">
<meta name="twitter:card" content="summary">
<link rel="canonical" href="https://auspoltracker.com/archives/galaxy/">
<link rel="icon" href="/assets/favicon.svg">
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

/* ------- archive tabs: article-column width, like the static page ------- */
.tabs {
  display: flex; gap: 4px; flex-wrap: wrap;
  max-width: 680px; margin: 40px auto 0; width: 100%;
  padding: 0 28px; border-bottom: 1px solid var(--line);
}
.tab {
  display: inline-block; font-weight: 600; font-size: 14px; color: var(--ink-3);
  padding: 8px 12px 10px; margin-bottom: -1px;
  border-bottom: 2px solid transparent; text-decoration: none;
}
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

.frame-wrap {
  flex: 1; display: flex; flex-direction: column;
  max-width: var(--maxw); width: 100%; margin: 0 auto;
  padding: 40px calc(28px + env(safe-area-inset-right, 0px)) calc(64px + env(safe-area-inset-bottom, 0px)) calc(28px + env(safe-area-inset-left, 0px));
}
.frame-wrap h1 { font-family: var(--serif); font-size: 34px; font-weight: 600; letter-spacing: -0.01em; margin: 0 0 6px; }
.frame-wrap h2 {
  font-family: var(--serif); font-size: 20px; font-weight: 600;
  margin: 32px 0 8px; padding-top: 14px; border-top: 1px solid var(--line);
}
.frame-wrap h3 {
  font-family: var(--sans); font-size: 13px; font-weight: 600;
  letter-spacing: 0.04em; text-transform: uppercase; color: var(--ink-2);
  margin: 22px 0 2px;
}
h3 .count { color: var(--ink-faint); font-weight: 400; letter-spacing: 0; }
.ss-sub { margin: 0 0 4px; font-size: 14.5px; line-height: 1.6; color: var(--ink-2); max-width: 680px; }
.ss-sub a { color: inherit; }
.credit, .body-copy { font-size: 14.5px; line-height: 1.6; color: var(--ink-2); margin: 12px 0; max-width: 680px; }
.credit a, .body-copy a { color: inherit; }
.body-copy + .body-copy { margin-top: 10px; }
.ss-note { margin-top: 20px; font-size: 14.5px; line-height: 1.6; color: var(--ink-2); max-width: 680px; }
.ss-note a { color: var(--ink-2); }
.ss-note a:hover, .ss-note a:focus-visible { text-decoration: underline; text-underline-offset: 2px; }
.rm-sub { font-size: 12.5px; color: var(--ink-3); margin: 0 0 4px; max-width: 680px; }

/* ------- the wave table ------- */
.rm-scroll { overflow-x: auto; margin-top: 8px; }
table.rm { border-collapse: collapse; width: 100%; font-size: 12.5px; font-variant-numeric: tabular-nums; }
table.rm th, table.rm td { text-align: right; white-space: nowrap; padding: 4px 10px 4px 0; font-weight: 400; }
table.rm th:first-child, table.rm td:first-child { text-align: left; }
table.rm tr.head th { font-weight: 600; border-bottom: 1px solid var(--line); padding-top: 5px; padding-bottom: 5px; color: var(--ink); }
table.rm tr.held td { color: var(--ink); }
table.rm tr:not(.head):not(.note) td { border-bottom: 1px solid var(--line-2); color: var(--ink-2); }
table.rm td.dim, table.rm td.na { color: var(--ink-faint); }
table.rm td.src a { color: var(--ink-3); }
table.rm tr.note td {
  text-align: left; white-space: normal; font-size: 12px; font-style: italic;
  color: var(--ink-faint); padding: 0 0 8px; border-bottom: 1px solid var(--line);
}
table.rm tr.note td:empty { padding: 0; border-bottom: 0; }

/* ------- the release index ------- */
.archive-list { list-style: none; border-top: 1px solid var(--line); margin-top: 4px; }
.archive-list li {
  display: flex; justify-content: space-between; align-items: baseline; gap: 12px;
  padding: 7px 2px; border-bottom: 1px solid var(--line-2); font-size: 13px;
}
.archive-list a { font-weight: 600; color: var(--ink); text-decoration: none; }
.archive-list a:hover { text-decoration: underline; }
.archive-list a::after { content: " \\2197"; font-weight: 400; color: var(--ink-3); }
.archive-list .note { font-size: 12px; color: var(--ink-faint); white-space: nowrap; }

/* ------- the method ------- */
pre.cmd {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12.5px;
  background: var(--line-2); color: var(--ink); border-radius: 6px;
  padding: 10px 12px; margin: 8px 0 14px; overflow-x: auto; max-width: 680px;
}
ol.steps { margin: 10px 0 0 20px; max-width: 680px; font-size: 14.5px; line-height: 1.6; color: var(--ink-2); }
ol.steps li { margin-bottom: 10px; }
ol.steps a { color: inherit; }
</style>
</head>
<body>
<nav class="tabs" aria-label="Poll archives">
  <a class="tab" href="/archives/newspoll/">Newspoll</a>
  <a class="tab" href="/archives/acnielsen/">AC Nielsen</a>
  <a class="tab" href="/archives/morgan/">Morgan</a>
  <a class="tab active" aria-current="page" href="/archives/galaxy/">Galaxy</a>
  <a class="tab" href="/archives/trove/">Trove</a>
</nav>
<main class="frame-wrap">
  <h1>Galaxy Research poll archive</h1>
  <p class="ss-sub">The federal Galaxy record before 2012 — ${waves.length} national waves from September 2004 to August 2010, reassembled from sources that outlived the pollster, plus an index of every surviving page of galaxyresearch.com.au.</p>

  <p class="credit">Galaxy Research polled federally for the News Ltd metropolitan dailies from 2004, took over the administration of Newspoll in mid-2015, was acquired by YouGov (announced 15 December 2017), published as YouGov Galaxy through 2018–20 and then simply as YouGov. Its website is gone and its owner preserved nothing. What follows is what survives, and where.</p>

  <p class="credit">This archive exists because the usual source runs out. Wikipedia's opinion-polling articles carry Galaxy rows for the 2013, 2016 and 2019 cycles only — 20, 9 and 5 of them; its 2010-cycle article carries none, and there is no 2007-cycle article at all. The tracker's own Galaxy rows started at 3 August 2011 for that reason. The waves below all predate them.</p>

  <h2>The pre-2012 federal record</h2>
  <p class="rm-sub">${held} of these ${waves.length} waves are carried in the tracker's past-cycle data. The rest are here and nowhere else: a wave whose Greens share was never published cannot be represented in a cycle row without inventing one, so it stays a transcript. Absent is not zero. Shares are percentages as published; a middot marks a figure the source never printed.</p>
  <div class="rm-scroll">
    <table class="rm">
      <tr class="head">
        <th>Date</th><th>Fieldwork</th><th>Sample</th>
        <th>ALP</th><th>L-NP</th><th>GRN</th><th>OTH</th>
        <th>2PP ALP</th><th>2PP L-NP</th><th>Status</th><th></th>
      </tr>
${waveRows}
    </table>
  </div>
  <p class="ss-note">The same series as data: <a href="/data/galaxy-federal-pre2012.csv">galaxy-federal-pre2012.csv</a>. Each row carries the URL it was read off, and <code>date_basis</code> saying whether the date is fieldwork end, publication day, or a date from Bowe's running table (which is itself one or the other, within a day).</p>

  <h2>What survives of galaxyresearch.com.au</h2>
  <p class="rm-sub">${index.length} archived pages in the Internet Archive. From 2012 Galaxy ran WordPress and gave each poll its own dated post; before that the current wave sat on the front page and on pubpolls.html, so only what a capture happened to freeze survives. Every link below goes to the capture that holds the release.</p>

${indexSections}

  <p class="ss-note">The same index as data: <a href="/data/galaxy-release-index.csv">galaxy-release-index.csv</a>.</p>

  <h2>How this was assembled</h2>
  <p class="body-copy">Five sources, in the order they were useful. Anyone can re-run the whole thing; the two scripts below rebuild the data files and re-check every figure against the page it came from.</p>
  <ol class="steps">
    <li><strong>The Poll Bludger</strong>, <a href="https://www.pollbludger.net/">pollbludger.net</a>. William Bowe wrote up essentially every Galaxy federal poll from 2004 on, and through 2007 kept a running table of the year's whole Galaxy series which he re-published in each new post — which is why 2007 is complete when nothing else holds it. The site serves its entire back catalogue live, including posts published under blogs.crikey.com.au. Its search is <em>not</em> a complete index: it missed the 25 June 2010 wave despite "Galaxy" being in the title, so the month archives (<code>/2010/06/</code>) and the Wayback URL index are the cross-check.</li>
    <li><strong>Galaxy's own pubpolls.html</strong>, via the Internet Archive. The page printed the latest federal wave in full and kept an accuracy table of final campaign polls. It supplies the final 2004 and 2007 campaign polls and two 2007 waves in full.</li>
    <li><strong>The Courier Mail's media server</strong> (media01.couriermail.com.au). Galaxy polled for the News Ltd tabloids, and the commissioner's site still serves the trend tables Galaxy printed for them as <em>polldetail</em> PDFs. Two survive from 2007 — <a href="http://media01.couriermail.com.au/multimedia/2007/06/070604Poll/polldetail.pdf">June</a> (n=1,021) and <a href="http://media01.couriermail.com.au/multimedia/2007/11/071104-galaxy/071101galaxypoll.pdf">November</a> (n=1,010) — and between them their trend tables carry every wave Galaxy took that year: the only other surviving record of the 2007 Greens and others shares and fieldwork windows, which Bowe's table never tabulated. The two sources' shared waves agree exactly.</li>
    <li><strong>The release pages</strong>, via the Internet Archive's CDX index — the 2012-onward posts listed above.</li>
    <li><strong>GhostWhoVotes</strong>, which mirrored the release scans as they came out.</li>
  </ol>
  <p class="body-copy">Rebuild the release index and re-check every transcribed figure against its cited source:</p>
  <pre class="cmd">node .build/extract-galaxy-archive.mjs --apply --verify</pre>
  <p class="body-copy">Merge the qualifying waves into the past-cycle data (dry-run without <code>--apply</code>):</p>
  <pre class="cmd">node .build/assimilate-galaxy-cycle-csv.mjs --apply</pre>
  <p class="body-copy">Query the Internet Archive directly for anything this page has not classified:</p>
  <pre class="cmd">curl -s 'https://web.archive.org/cdx/search/cdx?url=galaxyresearch.com.au*&amp;output=text&amp;fl=original,timestamp&amp;collapse=urlkey&amp;filter=statuscode:200'</pre>

  <h2>Known gaps and one suspect figure</h2>
  <p class="body-copy">The 29 June 2009 wave is transcribed with a Coalition primary of 30, which cannot produce the 56–44 two-party figure reported alongside it; it is almost certainly a typo for 40 in the original write-up. The row is flagged in the CSV and deliberately kept out of the tracker.</p>
  <p class="body-copy">Galaxy's final 2004 campaign poll survives in full only inside the accuracy table on its own site, which never printed its date. Bowe's post of 4 October 2004, covering the third fortnightly campaign poll, records the identical 2PP, and the fortnightly series' remaining slot fell after polling day — so the undated accuracy-table row is the 4 October poll, and it is dated accordingly and assimilated. Its figures read off Galaxy's own table diverge from the write-up in one cell (Coalition primary 46 table vs 45 prose); the table wins.</p>
  <p class="body-copy">Six 2007 waves reached this archive through Bowe's running table, which tabulated ALP, L-NP and 2PP only. Galaxy's printed trend tables on the Courier Mail's media server (source 3 above) supplied their Greens, others and fieldwork windows, cross-checked against the two waves pubpolls.html already held. That leaves three transcript-only waves: the 20 September 2004 campaign poll, reported two-party only; the suspect 29 June 2009 wave above; and the 25 June 2010 snap poll, for which no primaries were published. A September 2026 sweep of what survives — the Courier Mail PDFs (a 2007–2008 run only), the Wayback captures of galaxyresearch.com.au in each window, and the polling blogs and Wikipedia tables of the day — turned up none of the missing figures; for the 2010 snap poll, no trend-table PDF was ever produced, consistent with its two-party-only reporting.</p>

  <p class="ss-note">This is a satellite archive page of <a href="/">auspol tracker</a>, an unofficial aggregate of published federal opinion polling. The live, interactive tracker carries the current aggregates, charts and per-poll archive.</p>
</main>
<a class="ss-back" href="/">&larr; Back to the interactive tracker</a>
</body>
</html>
`;

fs.mkdirSync(path.dirname(OUT_PAGE), { recursive: true });
fs.writeFileSync(OUT_PAGE, page);
console.log(`wrote archives/galaxy/index.html`);
console.log(`  ${waves.length} waves (${held} carried in the tracker, ${waves.length - held} transcript only)`);
console.log(`  ${index.length} archived pages indexed`);
