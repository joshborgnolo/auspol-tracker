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
import { applyShell, shellOptsFor } from "./site-shell.mjs";

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
  <section class="sh-wide" id="${sec.slug}">
    <h2>${esc(sec.heading)}</h2>
    <p class="rm-sub">${esc(sec.sub)} — <a href="${sec.url}">roymorgan.com/morgan-poll/${esc(sec.slug)}</a></p>
    ${sec.tables.map((t, i) => `
    <p class="rm-cap">${esc(t.caption)}, <a href="/data/roymorgan/${t.csv}.csv">${t.csv}.csv</a></p>
    ${renderTable(sec.rows[i], t)}`).join("\n")}
  </section>`).join("\n");

  return `<!DOCTYPE html>
<html lang="en-AU">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Morgan Poll archive – auspol tracker</title>
<!-- GENERATED by .build/refresh-morgan-archive.mjs — do not hand-edit.
     The Roy Morgan reference tables (two-party-preferred + primary voting
     intention, current series and long-term trends) transcribed verbatim
     into data/roymorgan/*.csv and rendered here table-for-table, mirroring
     the way roymorgan.com stores them. Chrome is the site's shared shell
     (.build/site-shell.mjs): the sh-page article anatomy, the lifted
     .ex-body article family, and the shell-emitted archives switcher. -->
<meta name="description" content="Roy Morgan's two-party preferred and primary vote tables, including the long-term trends back to 1901, copied cell for cell from roymorgan.com.">
<meta name="theme-color" content="#faf6f0" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#1a1612" media="(prefers-color-scheme: dark)">
<meta property="og:type" content="website">
<meta property="og:site_name" content="auspol tracker">
<meta property="og:title" content="Morgan Poll archive – auspol tracker">
<meta property="og:description" content="Roy Morgan's published voting-intention tables, copied from roymorgan.com.">
<meta name="twitter:card" content="summary">
<link rel="canonical" href="https://auspoltracker.com/archives/morgan/">
<link rel="icon" type="image/png" sizes="192x192" href="/assets/favicon-192.png">
<link rel="apple-touch-icon" href="/assets/favicon-192.png">
<link rel="icon" type="image/svg+xml" href="/assets/favicon.svg">
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

/* the page: the shell's article frame and head anatomy (.sh-page, .sh-arow,
   .sh-hed, .sh-dek) and its lifted .ex-body article family, both from
   site-shell.css, and the archives switcher the shell emits (ARCHIVE_TABS) —
   2026-10-24 restructure. Only the replicated tables, their captions and the
   intro keep page-local styles; the sections escape the 66ch prose measure
   via the shell's .sh-wide. */

/* ------- replicated tables ------- */
.rm-sub { font-size: 12.5px; color: var(--ink-3); margin: 0 0 4px; }
.rm-cap {
  font-size: 12.5px; font-weight: 600; color: var(--ink-3);
  margin: 14px 0 2px; font-variant-numeric: tabular-nums;
}
.rm-cap a { font-weight: 400; }
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
<main class="sh-page">
  <header>
    <div class="sh-arow">
      <h1 class="sh-atitle">Morgan Poll archive</h1>
      <span class="sh-ameta">Roy Morgan&rsquo;s four voting-intention tables &middot; 1901 to today</span>
    </div>
    <p class="sh-hed">Roy Morgan&rsquo;s voting-intention tables, cell for cell.</p>
    <p class="sh-dek">Roy Morgan publishes four tables: two-party preferred and primary vote, each as a current series and as a long-term trend back to 1901. They are copied below cell for cell, as they appear on its site, and each table links its own CSV file.</p>
  </header>

  <div class="ex-body">
    <p>Source: <a href="https://www.roymorgan.com/morgan-poll">roymorgan.com/morgan-poll</a>, last copied ${esc(fetched)}. Roy Morgan&rsquo;s own markings are kept: "&lt;0.5" for a minor party under half a per cent, and "##" for elections before preferential voting, which have no two-party figure.</p>
${secHtml}
  </div>
</main>
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
// the site's shared header and footer (site-shell.mjs), as every satellite carries them
fs.writeFileSync(OUT_PAGE, applyShell(renderPage(sections, fetchedIso), shellOptsFor(path.relative(ROOT, OUT_PAGE))));
console.log(`  wrote ${path.relative(ROOT, OUT_PAGE)}`);
