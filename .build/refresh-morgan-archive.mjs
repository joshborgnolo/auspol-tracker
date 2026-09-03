#!/usr/bin/env node
/* refresh-morgan-archive.mjs — re-fetch the four roymorgan.com "Morgan Poll"
   reference-table pages, transcribe their tables VERBATIM into
   data/roymorgan/*.csv (one CSV per source table — the way the data is stored
   in the links), and regenerate archives/morgan/index.html.

     node .build/refresh-morgan-archive.mjs             # fetch live + rebuild
     node .build/refresh-morgan-archive.mjs --offline   # rebuild from cached
                                                        # copies in
                                                        # .build/morgan-archive-src/

   The four source pages (fetched snapshots are cached in
   .build/morgan-archive-src/ so the page can be rebuilt without the network):

     two-party-preferred-voting-intention
     primary-voting-intention
     two-party-preferred-voting-intention-long-term-trend
     primary-voting-intention-long-term-trend

   Fidelity rules:
   - cell text kept verbatim ("53.0%", "<0.5", "##" all stay as printed)
   - the source's year-banner rows (a single <td colspan=N>) are stored as a
     single-cell row and rendered back as a full-width colspan row
   - header row count per table is listed in TABLES below (the pages print the
     headers as ordinary rows, there's no <thead> element upstream)

   NB: this archive is SEPARATE from extract-roymorgan-archive.mjs, which
   normalises the same pages into the tracker's consolidated reference CSVs
   (data/roymorgan-primary-vote.csv / roymorgan-two-party-preferred.csv).
   This script does NOT touch those, polls.json, or the main build. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const SRC_DIR = path.join(HERE, "morgan-archive-src");
const CSV_DIR = path.join(ROOT, "data", "roymorgan");
const OUT_PAGE = path.join(ROOT, "archives", "morgan", "index.html");
const OFFLINE = process.argv.includes("--offline");

const PAGES = [
  {
    slug: "two-party-preferred-voting-intention",
    url: "https://www.roymorgan.com/morgan-poll/two-party-preferred-voting-intention",
    cache: "two-party-preferred.html",
    heading: "Two-party preferred voting intention",
    sub: "Federal Voting — Two Party Preferred Voting Intention (%) (2016–2025)",
    tables: [
      { csv: "roymorgan-2pp-election-results", caption: "Recent Federal Election Results", headRows: 1 },
      { csv: "roymorgan-2pp-weekly", caption: "Roy Morgan Poll Two Party Preferred Trends (2024–25)", headRows: 2, spans: [[1, 3, 3]] },
      { csv: "roymorgan-2pp-weekly-2022-2024", caption: "Latest Results of Two Party Preferred Voting without Other/Undecided 2022–2024", headRows: 1 },
      { csv: "roymorgan-2pp-weekly-2018-2022", caption: "Roy Morgan Poll Two Party Preferred Trends (2018–22)", headRows: 2, spans: [[1, 2, 2]] },
    ],
  },
  {
    slug: "primary-voting-intention",
    url: "https://www.roymorgan.com/morgan-poll/primary-voting-intention",
    cache: "primary.html",
    heading: "Primary voting intention",
    sub: "Federal Voting — Primary Voting Intention (%) (2013–2025)",
    tables: [
      { csv: "roymorgan-primary-election-results", caption: "Recent Election Results (%) 1996–2022", headRows: 1 },
      { csv: "roymorgan-primary-weekly", caption: "Latest Roy Morgan Poll Results (%) 2022–2025", headRows: 1 },
      { csv: "roymorgan-primary-weekly-2013-2022", caption: "Earlier Roy Morgan Poll Results (%) 2013–2022", headRows: 1 },
    ],
  },
  {
    slug: "two-party-preferred-voting-intention-long-term-trend",
    url: "https://www.roymorgan.com/morgan-poll/two-party-preferred-voting-intention-long-term-trend",
    cache: "two-party-preferred-long-term.html",
    heading: "Two-party preferred — long-term trend",
    sub: "Federal Voting — Two Party Preferred Voting Intention (%) Long-term Trend (1901–2022)",
    tables: [
      { csv: "roymorgan-2pp-long-term", caption: "House of Representatives", headRows: 1 },
    ],
  },
  {
    slug: "primary-voting-intention-long-term-trend",
    url: "https://www.roymorgan.com/morgan-poll/primary-voting-intention-long-term-trend",
    cache: "primary-long-term.html",
    heading: "Primary vote — long-term trend",
    sub: "Federal Voting — Primary Voting Intention (%) Long-term Trend (1901–2022)",
    tables: [
      { csv: "roymorgan-primary-elections-by-year", caption: "Recent Federal Election Results 2019–2022", headRows: 1 },
      { csv: "roymorgan-primary-long-term", caption: "Earlier Federal Election Results 1901–2016", headRows: 1 },
    ],
  },
];

// ---------------- fetch + extract ----------------
function decodeEnts(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
}
function tablesOf(html) {
  return [...html.matchAll(/<table[\s\S]*?<\/table>/gi)].map((m) => m[0]);
}
function rowsOf(tableHtml) {
  const rows = [];
  for (const tr of tableHtml.matchAll(/<tr[\s\S]*?<\/tr>/gi)) {
    const cells = [];
    for (const c of tr[0].matchAll(/<t[dh]([^>]*)>([\s\S]*?)<\/t[dh]>/gi)) {
      const span = c[1].match(/colspan="?(\d+)"?/i);
      cells.push({
        text: decodeEnts(c[2].replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim(),
        colspan: span ? +span[1] : 1,
      });
    }
    if (cells.some((c) => c.text !== "")) rows.push(cells);
  }
  return rows;
}

async function loadPage(page) {
  const cachePath = path.join(SRC_DIR, page.cache);
  if (OFFLINE) {
    console.log(`  offline: ${cachePath}`);
    return fs.readFileSync(cachePath, "utf8");
  }
  console.log(`  fetch: ${page.url}`);
  const res = await fetch(page.url, {
    headers: { "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36" },
  });
  if (!res.ok) throw new Error(`${page.url}: HTTP ${res.status}`);
  const html = await res.text();
  fs.mkdirSync(SRC_DIR, { recursive: true });
  fs.writeFileSync(cachePath, html);
  return html;
}

// ---------------- CSV: one file per source table, verbatim ----------------
function csvCell(s) {
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function writeCsv(rows, dest) {
  // colspan banner rows are stored as ONE cell (the banner text) — the same
  // single-cell shape the row-semantics carry. Data rows are emitted cell by
  // cell verbatim (colspan padding cells dropped: banner rows only ever span).
  const lines = rows.map((cells) => {
    if (cells.length === 1 && cells[0].colspan > 1) return csvCell(cells[0].text);
    return cells.map((c) => csvCell(c.text)).join(",");
  });
  fs.writeFileSync(dest, lines.join("\n") + "\n");
}

// ---------------- page render ----------------
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const YEAR_RE = /^(18|19|20)\d{2}$/;

function renderTable(rows, spec) {
  const ncols = Math.max(...rows.map((r) => r.reduce((n, c) => n + c.colspan, 0))).valueOf();
  const parts = ['<div class="rm-scroll"><table class="rm">'];
  let inHead = spec.headRows;
  rows.forEach((cells, ri) => {
    const cls = [];
    // banner row: one non-empty cell spanning the width (year labels, event notes)
    const banner = cells.length === 1 && (cells[0].colspan > 1 || ri > 0);
    if (banner) {
      const txt = cells[0].text;
      const kind = YEAR_RE.test(txt) ? "yr" : "note";
      parts.push(`<tr class="span ${kind}"><td colspan="${ncols}">${esc(txt)}</td></tr>`);
      return;
    }
    const header = ri < inHead;
    let out = "";
    if (header && spec.spans && spec.spans[ri]) {
      // grouped header row: blank corner + labelled column groups
      const spans = spec.spans[ri];
      const texts = cells.map((c) => c.text);
      out = spans.map((sp, i) => `<th${sp > 1 ? ` colspan="${sp}"` : ""}>${esc(texts[i] ?? "")}</th>`).join("");
    } else {
      out = cells.map((c) => `<${header ? "th" : "td"}>${esc(c.text)}</${header ? "th" : "td"}>`).join("");
    }
    parts.push(`<tr${header ? ' class="head"' : ""}>${out}</tr>`);
  });
  parts.push("</table></div>");
  return parts.join("\n");
}

function renderPage(sections, fetchedIso) {
  const fetched = new Date(fetchedIso).toLocaleDateString("en-AU", {
    day: "numeric", month: "long", year: "numeric", timeZone: "Australia/Sydney",
  });
  const secHtml = sections.map((sec) => `
  <section class="rm-sec" id="${sec.slug}">
    <h2>${esc(sec.heading)}</h2>
    <p class="rm-sub">${esc(sec.sub)} — <a href="${sec.url}">roymorgan.com/morgan-poll/${esc(sec.slug)}</a></p>
    ${sec.tables.map((t, i) => `
    <p class="rm-cap">${esc(t.caption)} · <a href="/data/roymorgan/${t.csv}.csv">${t.csv}.csv</a></p>
    ${renderTable(sec.rows[i], t)}`).join("\n")}
  </section>`).join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Morgan Poll archive · auspol tracker</title>
<!-- GENERATED by .build/refresh-morgan-archive.mjs — do not hand-edit.
     The Roy Morgan reference tables (two-party-preferred + primary voting
     intention, current series and long-term trends) transcribed verbatim
     into data/roymorgan/*.csv and rendered here table-for-table, mirroring
     the way roymorgan.com stores them. Chrome is the main site's
     static-article view (its no-JS static summary): Crimson Text headings
     over IBM Plex Sans body, ss-note footer and fixed .ss-back pill home. -->
<meta name="description" content="The Morgan Poll record — Roy Morgan's two-party-preferred and primary voting intention tables, including the long-term trends back to 1901, transcribed verbatim from roymorgan.com.">
<meta name="theme-color" content="#faf6f0" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#1a1612" media="(prefers-color-scheme: dark)">
<meta property="og:type" content="website">
<meta property="og:site_name" content="auspol tracker">
<meta property="og:title" content="Morgan Poll archive · auspol tracker">
<meta property="og:description" content="Roy Morgan's published vote-intention tables, transcribed table-for-table from roymorgan.com.">
<meta name="twitter:card" content="summary">
<link rel="canonical" href="https://auspoltracker.com/archives/morgan/">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='6' fill='%230b1d2c'/%3E%3Crect x='6' y='15' width='5' height='11' fill='%23d62828'/%3E%3Crect x='13.5' y='8' width='5' height='18' fill='%23b08d39'/%3E%3Crect x='21' y='18' width='5' height='8' fill='%23ec7a08'/%3E%3C/svg%3E">
<style>
/* ------- fonts: the two cuts the static article runs ------- */
@font-face {
  font-family: 'Crimson Text';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url("/assets/fonts/crimsontext-400-latin.aac0df38.woff2") format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
@font-face {
  font-family: 'Crimson Text';
  font-style: normal;
  font-weight: 600;
  font-display: swap;
  src: url("/assets/fonts/crimsontext-600-latin.94af2060.woff2") format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
@font-face {
  font-family: 'IBM Plex Sans';
  font-style: normal;
  font-weight: 300 700;
  font-display: swap;
  src: url("/assets/fonts/ibmplexsans-latin.056e4e24.woff2") format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}

/* ------- palette: the editorial surfaces the live site runs in ------- */
:root {
  --bg:        oklch(0.975 0.009 80);
  --ink:       oklch(0.27 0.012 55);
  --ink-2:     oklch(0.44 0.012 55);
  --ink-3:     oklch(0.52 0.010 58);
  --ink-faint: oklch(0.70 0.008 65);
  --line:      oklch(0.895 0.008 75);
  --line-2:    oklch(0.935 0.006 78);
  --alp: oklch(0.55 0.150 27);
  --lnp: oklch(0.50 0.095 250);
  --grn: oklch(0.60 0.120 150);
  --onp: oklch(0.66 0.130 58);
  --serif: "Crimson Text", Georgia, "Times New Roman", serif;
  --sans: "IBM Plex Sans", system-ui, -apple-system, "Segoe UI", sans-serif;
  --maxw: 1200px;
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
  background: var(--bg);
  color: var(--ink);
  font-family: var(--sans);
  font-size: 14px;
  font-feature-settings: "tnum" 1, "ss01" 1;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
  line-height: 1.45;
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  min-height: 100dvh;
}

/* ------- archive tabs: the static page's article-column width ------- */
.tabs {
  display: flex; gap: 4px;
  max-width: var(--maxw); margin: 40px auto 0;
  border-bottom: 1px solid var(--line);
}
.tab {
  display: inline-block;
  font-weight: 600; font-size: 14px;
  color: var(--ink-3);
  padding: 8px 12px 10px; margin-bottom: -1px;
  border-bottom: 2px solid transparent;
  text-decoration: none;
}
.tab:hover { color: var(--ink); }
.tab.active { color: var(--ink); border-bottom-color: var(--ink); }

/* ------- back to the interactive tracker (the static page's .ss-back pill) */
.ss-back {
  position: fixed; right: 18px; bottom: 18px; z-index: 300;
  display: inline-block;
  padding: 10px 16px; border-radius: 999px; border: 1px solid var(--line);
  background: var(--bg); color: var(--ink); font-size: 13px;
  font-weight: 600; text-decoration: none; cursor: pointer;
  box-shadow: 0 3px 16px oklch(0 0 0 / 0.16);
}
.ss-back:hover { border-color: var(--ink-3); }

/* ------- body: the static summary's type rhythm (verbatim tables stay wide) --- */
.frame-wrap {
  flex: 1; display: flex; flex-direction: column;
  max-width: var(--maxw); width: 100%; margin: 0 auto;
  padding: 40px calc(28px + env(safe-area-inset-right, 0px)) calc(64px + env(safe-area-inset-bottom, 0px)) calc(28px + env(safe-area-inset-left, 0px));
}
.frame-wrap h1 {
  font-family: var(--serif); font-size: 34px; font-weight: 600;
  letter-spacing: -0.01em; margin: 0 0 6px;
}
/* .ss-sub/.ss-note copy the static page's RENDERED values, not the source
   rules: on the live page .static-summary p outranks both, so the sub and
   the footer note actually run at body-copy 14.5px/1.6 ink-2. */
.ss-sub { margin: 0 0 4px; font-size: 14.5px; line-height: 1.6; color: var(--ink-2); }
.ss-sub a { color: inherit; }
.credit {
  font-size: 14.5px; line-height: 1.6; color: var(--ink-2); margin-top: 16px; margin-bottom: 12px;
}
.credit a { color: inherit; }
.ss-note { margin-top: 20px; font-size: 14.5px; line-height: 1.6; color: var(--ink-2); }
.ss-note a { color: var(--ink-2); }
.ss-note a:hover, .ss-note a:focus-visible { text-decoration: underline; text-underline-offset: 2px; }

/* ------- replicated tables ------- */
.rm-sec { margin-top: 28px; }
.rm-sec h2 {
  font-family: var(--serif); font-size: 20px; font-weight: 600;
  letter-spacing: -0.01em;
  margin: 0 0 8px; padding-top: 14px; border-top: 1px solid var(--line);
}
.rm-sec:first-of-type h2 { border-top: 0; padding-top: 0; }
.rm-sub { font-size: 12.5px; color: var(--ink-3); margin: 0 0 4px; }
.rm-sub a { color: inherit; }
.rm-cap {
  font-size: 12.5px; font-weight: 600; color: var(--ink-3);
  margin: 14px 0 2px; font-variant-numeric: tabular-nums;
}
.rm-cap a { font-weight: 400; color: var(--ink-2); }
.rm-scroll { overflow-x: auto; }
table.rm {
  border-collapse: collapse; width: 100%;
  font-size: 12.5px;
  font-variant-numeric: tabular-nums;
}
table.rm th, table.rm td {
  text-align: right; white-space: nowrap;
  padding: 3px 10px 3px 0;
  font-weight: 400;
}
table.rm th:first-child, table.rm td:first-child { text-align: left; }
table.rm tr.head th { font-weight: 600; border-bottom: 1px solid var(--line); padding-top: 5px; padding-bottom: 5px; }
table.rm tr.head + tr.head th { border-top: 0; }
table.rm tr:not(.head):not(.span) td { border-bottom: 1px solid var(--line); }
table.rm tr.span td {
  font-weight: 600; color: var(--ink);
  padding-top: 9px; padding-bottom: 3px;
  border-bottom: 1px solid var(--line);
  letter-spacing: 0.01em;
}
table.rm tr.span.note td { font-weight: 400; font-style: italic; color: var(--ink-3); letter-spacing: 0; }
</style>
</head>
<body>
<nav class="tabs" aria-label="Poll archives">
  <a class="tab" href="/archives/newspoll/">Newspoll</a>
  <a class="tab" href="/archives/acnielsen/">AC Nielsen</a>
  <a class="tab active" aria-current="page" href="/archives/morgan/">Morgan</a>
  <a class="tab" href="/archives/galaxy/">Galaxy</a>
</nav>
<main class="frame-wrap">
  <h1>Morgan Poll archive</h1>
  <p class="ss-sub">The Morgan Poll record, for safekeeping — Roy Morgan's published vote-intention tables, mirrored verbatim, as at the latest aggregate (ALP 51.1 · Coalition 48.9, 31 August 2026).</p>

  <p class="credit">The Morgan Poll series, transcribed table-for-table from Roy Morgan's four published vote-intention tables (two-party-preferred and primary, current series and the long-term trends back to 1901) and mirrored here as CSV — each table links its own file below. Sourced from <a href="https://www.roymorgan.com/morgan-poll">roymorgan.com/morgan-poll</a> — snapshot refreshed ${esc(fetched)}. Cells are reproduced as printed, including Roy Morgan's own "&lt;0.5" minors floor and "##" markers (no two-party-preferred figure, pre-preferential-voting era).</p>
${secHtml}

  <p class="ss-note">This is a satellite archive page of <a href="/">auspol tracker</a>, an unofficial aggregate of published national polling. The live, interactive tracker carries the current aggregates, charts and per-poll archive.</p>
</main>
<a class="ss-back" href="/">&larr; Back to the interactive tracker</a>
</body>
</html>
`;
}

// ---------------- main ----------------
const fetchedIso = new Date().toISOString();
const sections = [];
for (const page of PAGES) {
  const html = await loadPage(page);
  const tables = tablesOf(html).map(rowsOf);
  if (tables.length !== page.tables.length) {
    throw new Error(
      `${page.slug}: expected ${page.tables.length} tables, found ${tables.length} — page structure changed? (aborting, no CSVs written)`,
    );
  }
  const rowsList = page.tables.map((spec, i) => {
    const rows = tables[i];
    if (rows.length < 2) throw new Error(`${page.slug}/${spec.csv}: only ${rows.length} rows`);
    const dest = path.join(CSV_DIR, `${spec.csv}.csv`);
    writeCsv(rows, dest);
    console.log(`  wrote ${path.relative(ROOT, dest)} (${rows.length} rows)`);
    return rows;
  });
  sections.push({ ...page, rows: rowsList });
}
fs.mkdirSync(path.dirname(OUT_PAGE), { recursive: true });
fs.writeFileSync(OUT_PAGE, renderPage(sections, fetchedIso));
console.log(`  wrote ${path.relative(ROOT, OUT_PAGE)}`);
