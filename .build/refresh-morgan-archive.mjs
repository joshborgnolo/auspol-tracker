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

const MASTHEAD = `      <a class="wm-home" href="/" title="Back to the live tracker" aria-label="auspol tracker – back to the live polling tracker">
        <span class="wm-textcol"><span class="wm-name">auspol</span><span class="wm-track">tracker</span></span>
        <svg class="wm-dial" viewBox="0.58 0.07 38.39 26.73" width="57" height="39.7" aria-hidden="true">
          <path d="M 10 24.5 A 12 12 0 0 1 22 12.5" class="wm-arc" stroke="var(--alp)"/>
          <path d="M 22 12.5 A 12 12 0 0 1 34 24.5" class="wm-arc" stroke="var(--lnp)"/>
          <line x1="10.67" y1="16.27" x2="2.18" y2="10.10" stroke="var(--alp)" stroke-width="3.4" stroke-linecap="butt" style="stroke-dasharray: 10.5 10.5"/>
          <line x1="17.67" y1="11.19" x2="14.43" y2="1.20" stroke="var(--onp)" stroke-width="3.4" stroke-linecap="butt" style="stroke-dasharray: 9.8 10.5"/>
          <line x1="26.33" y1="11.19" x2="29.57" y2="1.20" stroke="var(--lnp)" stroke-width="3.4" stroke-linecap="butt" style="stroke-dasharray: 8.45 10.5"/>
          <line x1="33.33" y1="16.27" x2="41.82" y2="10.10" stroke="var(--grn)" stroke-width="3.4" stroke-linecap="butt" style="stroke-dasharray: 5 10.5"/>
          <g transform="translate(22, 24.5)"><g transform="rotate(-6.23)">
            <line x1="0" y1="0" x2="0" y2="-8.6" stroke="var(--alp)" stroke-width="1.7" stroke-linecap="round"/>
            <circle cx="0" cy="-8.6" r="1.9" fill="var(--alp)"/>
          </g></g>
          <circle cx="22" cy="24.5" r="1.7" class="wm-pivot"/>
        </svg>
        <span class="wm-sr">– Australian federal polling</span>
      </a>`;

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
     the way roymorgan.com stores them. Masthead reuses the main site's
     lockup; the dial is a static snapshot of the aggregate at the last site
     rebuild (ALP 27.8 / LNP 22.2 / GRN 12.8 / ONP 25.9 · 2PP 51.1–48.9 ALP). -->
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
/* ------- fonts: the same self-hosted cuts the main site ships ------- */
@font-face {
  font-family: 'Crimson Text';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url("/assets/fonts/crimsontext-400-latin.aac0df38.woff2") format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
@font-face {
  font-family: 'Source Serif 4';
  font-style: normal;
  font-weight: 200 900;
  font-display: swap;
  src: url("/assets/fonts/sourceserif4-latin.2a24bad4.woff2") format('woff2');
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
@font-face {
  font-family: 'Source Sans 3';
  font-style: normal;
  font-weight: 400 800;
  font-display: swap;
  src: url("/assets/fonts/sourcesans3-latin.ac057a55.woff2") format('woff2');
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
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  min-height: 100dvh;
}

/* ------- masthead ------- */
.site-head {
  display: flex; justify-content: space-between; align-items: flex-end;
  gap: 28px; flex-wrap: wrap;
  padding: calc(28px + env(safe-area-inset-top, 0px)) calc(28px + env(safe-area-inset-right, 0px))
           16px calc(28px + env(safe-area-inset-left, 0px));
  max-width: var(--maxw); width: 100%; margin: 0 auto;
  box-shadow: inset 0 -1px 0 var(--line);
}
.wordmark {
  font-family: "Myriad Pro", "Myriad Web Pro", "Source Sans 3", system-ui, -apple-system, "Segoe UI", sans-serif;
  display: inline-flex; align-items: center;
  font-weight: 800; font-size: 30px; letter-spacing: -0.025em; line-height: 1;
}
.wordmark a.wm-home {
  display: inline-flex; align-items: center; gap: 12px;
  color: inherit; text-decoration: none;
  padding: 3px; margin: -3px; border-radius: 8px;
  transition: background-color .2s ease;
}
.wordmark a.wm-home:hover { background: color-mix(in oklch, var(--ink) 6%, transparent); }
.wm-textcol { display: inline-flex; flex-direction: column; align-items: flex-start; gap: 1px; }
.wm-name {
  display: inline-flex; font-weight: 800; font-size: 30px;
  letter-spacing: -0.025em; line-height: 0.95; color: var(--ink);
}
.wm-track {
  align-self: flex-start;
  display: inline-block;
  font-size: 30px; font-weight: 400; letter-spacing: -0.03em;
  text-transform: none; line-height: 0.95; color: var(--ink-3);
}
.wm-dial { display: block; overflow: visible; }
.wm-arc { fill: none; stroke-width: 1.4; opacity: 0.5; }
.wm-pivot { fill: var(--ink-3); }
.wm-sr {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
}
.tagline {
  margin: 7px 0 -1.5px;
  font-family: var(--serif);
  font-weight: 400;
  font-size: 15px; color: var(--ink-3); text-wrap: balance;
}
.head-right { display: flex; align-items: center; gap: 18px; }
.meta-item { display: flex; flex-direction: column; gap: 2px; text-align: right; }
.meta-k { font-size: 13px; color: var(--ink-3); font-weight: 600; white-space: nowrap; letter-spacing: 0.02em; }
.meta-v, .meta-v a {
  font-size: 14px; color: var(--ink); font-weight: 600; white-space: nowrap;
  text-decoration: none;
}
.meta-v a:hover { text-decoration: underline; }
@media (max-width: 560px) {
  .site-head { flex-direction: column; align-items: flex-start; gap: 13px; }
  .meta-item { text-align: left; }
}

/* ------- archive tabs: the static page's article-column width ------- */
.tabs {
  display: flex; gap: 4px;
  max-width: var(--maxw); margin: 0 auto;
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

/* ------- body: the static page's type rhythm (verbatim tables stay wide) --- */
.frame-wrap {
  flex: 1; display: flex; flex-direction: column;
  max-width: var(--maxw); width: 100%; margin: 0 auto;
  padding: 28px calc(28px + env(safe-area-inset-right, 0px)) calc(64px + env(safe-area-inset-bottom, 0px)) calc(28px + env(safe-area-inset-left, 0px));
}
.credit {
  font-size: 14.5px; line-height: 1.6; color: var(--ink-2); margin-bottom: 12px;
}
.credit a { color: inherit; }
.ss-note { margin-top: 24px; font-size: 12.5px; color: var(--ink-3); }
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
<header class="site-head">
  <div class="brand">
    <h1 class="wordmark">
${MASTHEAD}
    </h1>
    <p class="tagline">The Morgan Poll record,<br class="tagline-br"> for safekeeping</p>
  </div>
  <div class="head-right">
    <div class="meta-item">
      <span class="meta-k">Pollster archive</span>
      <span class="meta-v"><a href="/">&larr; Back to the interactive tracker</a></span>
    </div>
  </div>
</header>
<nav class="tabs" aria-label="Poll archives">
  <a class="tab" href="/archives/newspoll/">Newspoll</a>
  <a class="tab" href="/archives/acnielsen/">AC Nielsen</a>
  <a class="tab active" aria-current="page" href="/archives/morgan/">Morgan</a>
</nav>
<main class="frame-wrap">
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
