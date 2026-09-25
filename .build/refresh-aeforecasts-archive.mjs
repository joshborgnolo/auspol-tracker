#!/usr/bin/env node
/* refresh-aeforecasts-archive.mjs — regenerate archives/aeforecasts/index.html
   from Daniel Hirst's federal poll database, the data behind Australian
   Election Forecasts (aeforecasts.com), mirrored byte for byte at
   data/bonham-additional-aeforecasts.csv by
   .build/refresh-bonham-additional-aeforecasts.mjs (which runs this after it
   writes, so the page follows every refresh).

     node .build/refresh-aeforecasts-archive.mjs

   Credit, as the sources give it: the database is Hirst's (collected from the
   pollsters, news media, The Poll Bludger and Wikipedia, verified in original
   sources where possible); "many older results (pre-2007) have been kindly
   provided by Kevin Bonham" (aeforecasts.com/methods), and the table's own
   comments mark the early Morgan polls Bonham transcribed from paper copies.

   The page reads the table; it does not normalise it. Pollster names are
   Hirst's, cells are as he has them, and "#N/A" shows as a middot. Each
   decade's table drops the columns that decade never has (no One Nation
   before 1997, no Democrats after 2004), so a table is as wide as its era. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyShell, shellOptsFor } from "./site-shell.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const SRC = path.join(ROOT, "data", "bonham-additional-aeforecasts.csv");
const OUT_PAGE = path.join(ROOT, "archives", "aeforecasts", "index.html");

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const fmt = (n) => n.toLocaleString("en-AU");

// a small CSV reader: quoted fields may carry commas and doubled quotes
function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((x) => x !== "")) rows.push(row);
      row = [];
    } else cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); if (row.some((x) => x !== "")) rows.push(row); }
  return rows;
}

const raw = fs.readFileSync(SRC, "utf8").replace(/^﻿/, "");
const [head, ...body] = parseCsv(raw);
const col = (name) => head.indexOf(name);
const polls = body.map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? "").trim()])))
  .filter((p) => /^\d{4}-\d{2}-\d{2}$/.test(p.MidDate));
if (col("MidDate") < 0 || col("Firm") < 0) throw new Error("unexpected header: " + head.join(","));

/* The columns a table may show, in the source's order, with the reader's
   names. A decade shows the ones any of its polls fill. */
const COLS = [
  { k: "@TPP", h: "ALP 2PP" },
  { k: "LNP FP", h: "L/NP" }, { k: "ALP FP", h: "ALP" }, { k: "GRN FP", h: "GRN" },
  { k: "ONP FP", h: "ON" }, { k: "NXT FP", h: "NXT" }, { k: "UAP FP", h: "UAP" },
  { k: "DEM FP", h: "DEM" }, { k: "DLP FP", h: "DLP" }, { k: "OTH FP", h: "OTH" },
  { k: "GLApp", h: "PM approve" }, { k: "GLDis", h: "PM disapprove" },
];
const filled = (v) => v !== "" && v !== "#N/A";
/* Some figures are stored unrounded (Essential's, computed to eight places);
   those read to one decimal here, and the CSV keeps them in full. */
const cell = (v) => (!filled(v) ? "·" : /^-?\d+\.\d{3,}$/.test(v) ? (+v).toFixed(1) : esc(v));
// the comments are Hirst's working notes, "#"-prefixed
const note = (v) => esc(v.replace(/^#\s*/, ""));

const byDecade = new Map();
for (const p of polls) {
  const d = p.MidDate.slice(0, 3) + "0s";
  if (!byDecade.has(d)) byDecade.set(d, []);
  byDecade.get(d).push(p);
}
const decades = [...byDecade.keys()].sort().reverse();
const first = polls.map((p) => p.MidDate).sort()[0], last = polls.map((p) => p.MidDate).sort().at(-1);
const yr = (iso) => iso.slice(0, 4);

const decadeTables = decades.map((d) => {
  const ps = byDecade.get(d).sort((a, b) => b.MidDate.localeCompare(a.MidDate));
  const cols = COLS.filter((c) => ps.some((p) => filled(p[c.k] || "")));
  const anyNote = ps.some((p) => p.Comments);
  // one line a row, no indent: ~4,000 rows, and whitespace was half the page
  const rows = ps.map((p) => `<tr><td>${esc(p.MidDate)}</td><td class="tl">${esc(p.Firm)}`
    + (p.Brand && p.Brand !== p.Firm ? ` <span class="dim">(${esc(p.Brand)})</span>` : "") + "</td>"
    + cols.map((c) => `<td>${cell(p[c.k] || "")}</td>`).join("")
    + (anyNote ? `<td class="tl dim">${p.Comments ? note(p.Comments) : ""}</td>` : "") + "</tr>").join("\n");
  return `  <h3 id="d${d.slice(0, 4)}">${d} <span class="count">${fmt(ps.length)} polls</span></h3>
  <div class="rm-scroll">
    <table class="rm">
      <tr class="head"><th>Mid-date</th><th class="tl">Pollster</th>${cols.map((c) => `<th>${c.h}</th>`).join("")}${anyNote ? `<th class="tl">Note</th>` : ""}</tr>
${rows}
    </table>
  </div>`;
}).join("\n");

// polls per pollster, most first
const byFirm = new Map();
for (const p of polls) {
  const f = byFirm.get(p.Firm) || { n: 0, from: p.MidDate, to: p.MidDate };
  f.n++; if (p.MidDate < f.from) f.from = p.MidDate; if (p.MidDate > f.to) f.to = p.MidDate;
  byFirm.set(p.Firm, f);
}
const firmRows = [...byFirm.entries()].sort((a, b) => b[1].n - a[1].n)
  .map(([f, s]) => `      <tr><td class="tl">${esc(f)}</td><td>${fmt(s.n)}</td><td>${yr(s.from)}${yr(s.from) !== yr(s.to) ? `–${yr(s.to)}` : ""}</td></tr>`).join("\n");
const decadeLinks = decades.map((d) => `<a href="#d${d.slice(0, 4)}">${d}</a>`).join(" · ");

const page = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>AE Forecasts poll database · auspol tracker</title>
<!-- Generated by .build/refresh-aeforecasts-archive.mjs from
     data/bonham-additional-aeforecasts.csv. Do not hand-edit. -->
<meta name="description" content="Daniel Hirst's federal voting-intention database, the data behind Australian Election Forecasts: ${fmt(polls.length)} polls from ${yr(first)} to ${yr(last)}, many of the older ones provided by Kevin Bonham.">
<meta name="theme-color" content="#faf6f0" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#1a1612" media="(prefers-color-scheme: dark)">
<meta property="og:type" content="website">
<meta property="og:site_name" content="auspol tracker">
<meta property="og:title" content="AE Forecasts poll database · auspol tracker">
<meta property="og:description" content="Daniel Hirst's federal poll database, ${yr(first)} to ${yr(last)}.">
<meta name="twitter:card" content="summary">
<link rel="canonical" href="https://auspoltracker.com/archives/aeforecasts/">
<link rel="icon" href="/assets/favicon.svg">
<style>
@font-face { font-family: 'Crimson Text'; font-style: normal; font-weight: 400; font-display: swap;
  src: url("/assets/fonts/crimsontext-400-latin.aac0df38.woff2") format('woff2'); }
@font-face { font-family: 'Crimson Text'; font-style: normal; font-weight: 600; font-display: swap;
  src: url("/assets/fonts/crimsontext-600-latin.94af2060.woff2") format('woff2'); }
@font-face { font-family: 'IBM Plex Sans'; font-style: normal; font-weight: 300 700; font-display: swap;
  src: url("/assets/fonts/ibmplexsans-latin.056e4e24.woff2") format('woff2'); }

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
.frame-wrap { flex: 1; display: flex; flex-direction: column; max-width: var(--maxw); width: 100%;
  margin: 0 auto; padding: 40px calc(28px + env(safe-area-inset-right, 0px)) calc(64px + env(safe-area-inset-bottom, 0px)) calc(28px + env(safe-area-inset-left, 0px)); }
.frame-wrap h1 { font-family: var(--serif); font-size: 34px; font-weight: 600; letter-spacing: -0.01em; margin: 0 0 6px; }
.frame-wrap h2 { font-family: var(--serif); font-size: 20px; font-weight: 600; margin: 32px 0 8px; padding-top: 14px; border-top: 1px solid var(--line); }
.frame-wrap h3 { font-family: var(--sans); font-size: 13px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: var(--ink-2); margin: 22px 0 2px; }
h3 .count { color: var(--ink-faint); font-weight: 400; letter-spacing: 0; text-transform: none; }
.ss-sub, .body-copy { font-size: 14.5px; line-height: 1.6; color: var(--ink-2); max-width: 680px; }
.ss-sub { margin: 0 0 4px; } .body-copy { margin: 12px 0; } .body-copy + .body-copy { margin-top: 10px; }
.ss-sub a, .body-copy a { color: inherit; }
.rm-sub { font-size: 12.5px; color: var(--ink-3); margin: 0 0 4px; max-width: 680px; }
.rm-sub a { color: inherit; }
.rm-scroll { overflow-x: auto; margin-top: 8px; }
table.rm { border-collapse: collapse; width: 100%; font-size: 12.5px; font-variant-numeric: tabular-nums; }
table.rm th, table.rm td { text-align: right; padding: 4px 10px 4px 0; font-weight: 400; white-space: nowrap; }
table.rm .tl { text-align: left; }
table.rm td.tl.dim { white-space: normal; min-width: 180px; }
table.rm tr.head th { font-weight: 600; border-bottom: 1px solid var(--line); padding-top: 5px; padding-bottom: 5px; color: var(--ink); }
table.rm tr:not(.head) td { border-bottom: 1px solid var(--line-2); color: var(--ink-2); }
table.rm .dim { color: var(--ink-faint); }
/* the tables take the page's full width on a wide screen – the reading
   measure is for prose, and these carry up to fifteen columns */
@media (min-width: 900px) {
  .frame-wrap .rm-scroll { width: min(1144px, calc(100vw - 72px)); }
}
</style>
</head>
<body>
<nav class="tabs" aria-label="Poll archives">
  <a class="tab" href="/archives/newspoll/">Newspoll</a>
  <a class="tab" href="/archives/acnielsen/">AC Nielsen</a>
  <a class="tab" href="/archives/morgan/">Morgan</a>
  <a class="tab" href="/archives/galaxy/">Galaxy</a>
  <a class="tab active" aria-current="page" href="/archives/aeforecasts/">AE Forecasts</a>
  <a class="tab" href="/archives/trove/">Trove</a>
</nav>
<main class="frame-wrap">
  <h1>AE Forecasts poll database</h1>
  <p class="ss-sub">Daniel Hirst's federal voting-intention database, the data behind <a href="https://www.aeforecasts.com/">Australian Election Forecasts</a>: ${fmt(polls.length)} polls from ${yr(first)} to ${yr(last)}.</p>

  <p class="body-copy">Hirst collects the polls from the pollsters, news media, The Poll Bludger, and Wikipedia, and checks the figures against their original sources where he can, often through the Wayback Machine. Many of the older results, before 2007, were provided by <a href="https://kevinbonham.blogspot.com/">Kevin Bonham</a>, who transcribed the early Morgan polls from paper copies. The table is published in Hirst's <a href="https://github.com/d-j-hirst/aus-polling-analyser">aus-polling-analyser</a> repository on GitHub. The copy here is exact, byte for byte, and each refresh takes his latest.</p>

  <p class="body-copy">The tracker's Past cycles use it to fill the terms its other sources leave thin, above all Morgan's face-to-face polls before 1986.</p>

  <h2>Reading the tables</h2>
  <p class="body-copy">Pollster names are Hirst's own. A number after a name marks a later method (Newspoll2, Newspoll3, YouGov2), and Morgan appears by mode: face to face, phone, multi-mode, or SMS. The date is the middle of each poll's fieldwork. ALP 2PP is Labor's two-party share, first-preference shares follow, and PM approve and disapprove are the prime minister's ratings. A middot marks a figure the table doesn't hold, and a figure stored to many decimal places is shown to one. Each decade shows only the columns its polls use.</p>
  <p class="rm-sub">The whole table as data: <a href="/data/bonham-additional-aeforecasts.csv">bonham-additional-aeforecasts.csv</a>, with every figure in full and Hirst's own "#N/A" markers. Jump to ${decadeLinks}.</p>

  <h2>Polls by pollster</h2>
  <div class="rm-scroll"><table class="rm">
    <tr class="head"><th class="tl">Pollster</th><th>Polls</th><th>Years</th></tr>
${firmRows}
  </table></div>

  <h2>The polls, newest first</h2>
${decadeTables}

</main>
</body>
</html>
`;
fs.mkdirSync(path.dirname(OUT_PAGE), { recursive: true });
fs.writeFileSync(OUT_PAGE, applyShell(page, shellOptsFor(path.relative(ROOT, OUT_PAGE))));
console.log(`${path.relative(ROOT, OUT_PAGE)} · ${fmt(polls.length)} polls, ${yr(first)}–${yr(last)}, ${decades.length} decades, ${byFirm.size} pollsters`);
