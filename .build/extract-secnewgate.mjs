#!/usr/bin/env node
/* extract-secnewgate.mjs – reads SEC Newgate's "Mood of the Nation" survey
   into data/polls.json's `direction` array, as the SEC Newgate (direction-only)
   rows of the National-direction panel.

   SEC Newgate publishes no voting intention. Its bi-monthly tracking study
   asks whether Australia is heading in the right direction or down the
   wrong track, and publishes the current wave in a PDF report under
   https://www.secnewgate.com.au/news-views/ ("research" tag). Discovery is
   the WordPress REST media API: file names are too inconsistent to probe
   (`-1` suffixes, `-EMBARGOED` re-uploads, November 2025's report re-hosted
   under 2026/02) and predictable-URL guesses only earn Cloudflare 523s.
   The search "Mood" returns every report PDF on one page; editions that
   carry no national direction series (the "Queensland Edition", and
   specials like the April 2026 "Special Edition", which asked no direction
   question at all) are set aside by title.

   Each report carries its facts on two pages:
     - the methodology page: "The Nth wave of this bi-monthly tracking
       study.", a "Fieldwork dates" block ("8th – 14th September 2026."),
       and "n = 1,659 Australians aged 18+…". The wave ordinal is what
       marks a tracking wave; a report without one never asked the question
       and is skipped, not failed.
     - the direction page (page 8 in every report since mid-2025), "Perceived
       direction of Australia (%)": a monthly line chart of the whole series
       (wrong track above, right direction below, the two totalling 100;
       "unsure" is the unprinted remainder). It is read by GEOMETRY with
       `pdftotext -bbox`: the month label row anchors the column centres,
       and each column's two numbers pair as top = wrong, bottom = right.
       The state table lower on the page is kept out by the x/y windows.

   Rows are written to D.direction as
   { date = fieldwork END, dateStart, pollster: "SEC Newgate",
     right, wrong, unsure = 100 − right − wrong,
     sample = the wave's n from the report's methodology block,
     url = the report's PDF (the house's report pages 301 to their PDFs
         now – check-citations 2026-10-09 – so the link is the served
         document itself), published = its upload time,
     methodUrl = the wave's APC methodology statement }
   and the array re-sorted by date, like every house's writer. A rerun
   heals a row of the same wave within HEAL_DAYS of a prior entry, and
   rewrites any row of an exact date whose figures, span or n moved. The
   newest report's full series is cross-checked against every earlier
   wave's own endpoint (the series only reprints history; a publish-day
   correction to an old point would show here).

   Cache: .build/secnewgate-src/<slug>.txt (pdftotext -layout, the whole
   report), <slug>.bbox.html (pdftotext -bbox, the direction page only),
   <slug>.grid.bbox.html (pdftotext -bbox, the national-priorities summary
   grid page), <slug>.json ({ pdf, wave, date, dateStart, sample, url,
   published, method }). Written once when
   first fetched and never touched again, so a run that finds nothing new
   changes nothing (a cache file added later, as the grid page was for the
   heat-score bank, is back-filled from the still-listed PDF alone, the
   existing cache bytes untouched). A title-filtered release that isn't
   a tracking wave (the April 2026 "Special Edition" of the Mar 2026
   report) still caches: { pdf, wave: null, special: true, published? }
   with its <slug>.txt, so the wave loop, the probe and the banked
   sweeps all treat the month as settled instead of re-fetching and
   warning every run. A page or PDF that won't load is a
   warning, not a failure: the cache stays; a report that IS cached but
   won't read is
   pending and fails the run that landed it, once anything else is pushed.

   Two parse-only bank files are rebuilt from the cache each run:
   data/sec-direction-states.json banks the per-state direction table
   off the bbox (SECNEWGATE_STATES redirects), and data/sec-issues.json
   banks three blocks: B1's "% MENTIONING
   EACH" unprompted-concerns table (a reference series) off the
   whole-report -layout text, the B6 political-heat-score grid off
   <slug>.grid.bbox.html (a reference series; the B5 extremely-important
   ratings are not banked), and G4's best-party-on-the-cost-of-
   living table, whose May 2026-on rows .build/issues.mjs pools into
   data/issues.json. Direction and concerns reprint their trailing
   waves, so a conflict between reports for one month is a revision and
   goes to warnings.

   Usage: node .build/extract-secnewgate.mjs [--force]  (--force refetches)
   SECNEWGATE_SRC_DIR redirects the cache.
   --probe asks the media API and the disclosure-statements library, and
   names the work a real run would do (a month's first candidate not
   cached, a grid page still to back-fill, a filed wave whose statement
   link no longer matches the library), writing nothing: poll-agent.yml's
   quiet-run gate, which skips the runner's apt/npm setup and the updater
   when the line is PROBE {"new":[],"warnings":[]}. Needs no pdftotext and
   no npm package.
   Last line: SECNEWGATE_STATUS {"changed":…,"added":[…],"healed":[…],
   "pending":[…],"stale":[…],"warnings":[…]} */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { TRACKER_UA, MONTHS, writeAtomic } from "./extract-common.mjs";

const FORCE = process.argv.includes("--force");
const PROBE = process.argv.includes("--probe");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = process.env.SECNEWGATE_SRC_DIR || path.join(ROOT, ".build", "secnewgate-src");
const POLLS = process.env.SECNEWGATE_POLLS || path.join(ROOT, "data", "polls.json");
const STATES_OUT = process.env.SECNEWGATE_STATES || path.join(ROOT, "data", "sec-direction-states.json");
const ISSUES_OUT = process.env.SECNEWGATE_ISSUES || path.join(ROOT, "data", "sec-issues.json");
const API = "https://www.secnewgate.com.au/wp-json/wp/v2/media?search=Mood&per_page=100";
const DISCLOSE = "https://www.secnewgate.com.au/disclosure-statements/";
const DISCLOSE_PAGES = 8;    // the statements library paginates newest-first; 2025-07 sits on page 3 today
const SEC_FIRST = "2025-07";   // waves on file run Jul 2025 on; older reports stay untouched
const QUIET_DAYS = 75;         // bi-monthly cadence plus slack before the house counts as quiet
const HEAL_DAYS = 8;           // a wave re-dated within this window is the same wave
const POLLSTER = "SEC Newgate";

const ordinal = (n) => { const t = ["th", "st", "nd", "rd"]; const v = n % 100; return n + (t[(v - 20) % 10] || t[v] || t[0]); };

async function get(url) {
  let last;
  for (let i = 1; i <= 3; i++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": TRACKER_UA },
                                     signal: AbortSignal.timeout(60_000), redirect: "follow" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (e) {
      last = e;
      if (i < 3) await new Promise((r) => setTimeout(r, 2000 * i));
    }
  }
  throw new Error(`${url}: ${last.message}`);
}

/* A JSON endpoint over get(): the host sometimes answers the API 200 with
   an HTML interstitial (maintenance/WAF page — 2026-10-06 a blip of a
   minute or two; 2026-10-08 a window of ≥4½ minutes that outlasted six
   tries twenty seconds apart in the probe AND the full run). Neither the
   fetch layer nor a status check can see a healthy-looking 200 with the
   wrong body, so the parse itself is what a retry waits for: three quick
   tries for the blip class, then a widening ramp that keeps the ladder
   standing ~12 minutes. An HTML body is named the interstitial it is, so
   the run's FAIL line says what happened, not "Unexpected token '<'". */
const JSON_WAITS = [20, 20, 20, 60, 120, 180, 300];   // seven retries ≈ 12 min
async function getJson(url) {
  let last;
  for (let i = 0; i <= JSON_WAITS.length; i++) {
    if (i) await new Promise((r) => setTimeout(r, JSON_WAITS[i - 1] * 1000));
    try {
      const body = (await get(url)).toString("utf8");
      if (/^\s*</.test(body)) throw new Error("the host answered an HTML page, not JSON (maintenance/WAF interstitial)");
      return JSON.parse(body);
    } catch (e) { last = e; }
  }
  throw new Error(`${url}: ${last.message}`);
}
const pdfToText = (buf, slug, args) => {
  const f = path.join(tmpdir(), `secnewgate-${slug}.pdf`);
  fs.writeFileSync(f, buf);
  for (const bin of ["pdftotext", "/opt/homebrew/bin/pdftotext", "/usr/local/bin/pdftotext", "/usr/bin/pdftotext"]) {
    try { return execFileSync(bin, [...args, f, "-"], { encoding: "utf8", maxBuffer: 1 << 26 }); }
    catch (e) { if (e.code !== "ENOENT") throw new Error(`pdftotext failed on ${slug}: ${String(e.message).slice(0, 200)}`); }
  }
  throw new Error("pdftotext (poppler) not found");
};

/* The month a report covers, from its media-item title ("… – September
   2026 Report", "…-Report-November-2025", "… November 24 – Embargoed");
   "YYYY-MM" or null. A two-digit year is the survey's own era (2022 on). */
export function titleMonthOf(title) {
  const t = title.replace(/&#(\d+);/g, (m, n) => String.fromCharCode(+n)).replace(/&amp;/gi, "&");
  const m = t.match(/([A-Za-z]+)[-\s]+(\d{4}|\d{2})(?:\D|$)/);
  if (!m) return null;
  const mo = MONTHS[m[1].toLowerCase()];
  if (mo == null) return null;
  let y = +m[2];
  if (y < 100) y += 2000;
  return `${y}-${String(mo + 1).padStart(2, "0")}`;
}

/* Media API items → the report candidates, one ordered list per wave
   month: "Mood of the Nation … report … .pdf", the Queensland edition
   and the one-off specials set aside, a non-embargoed upload preferred over
   its "-Embargoed" twin, and whichever variant is then first. Each
   candidate carries the report PDF as its release link and its upload time
   (site-local) for the publish stamp: the house's report posts 301 straight
   to the PDF now (check-citations 2026-10-09), so the served document
   itself is the link. */
export function pickReports(items) {
  const byMonth = new Map();
  for (const it of items) {
    const title = (it.title && it.title.rendered) || "";
    const url = it.source_url || "";
    if (!/mood of the nation/i.test(title) || !/report/i.test(title)) continue;
    if (!/\.pdf$/i.test(url)) continue;
    if (/queensland edition|special edition/i.test(title)) continue;
    const ym = titleMonthOf(title);
    if (!ym || ym < SEC_FIRST) continue;
    const embargo = /embargo/i.test(title) || /embargo/i.test(url);
    const page = url;
    const published = it.date ? String(it.date).slice(0, 16) : null;
    const g = byMonth.get(ym) || [];
    g.push({ url, embargo, page, published });
    byMonth.set(ym, g);
  }
  for (const g of byMonth.values()) {
    g.sort((a, b) => (a.embargo - b.embargo) || a.url.localeCompare(b.url));
    const clean = g.filter((x) => !x.embargo);
    if (clean.length) g.length = 0, g.push(...clean);
  }
  return [...byMonth.entries()].sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([ym, urls]) => ({ ym, urls: urls.map(({ url, page, published }) => ({ url, page, published })) }));
}

/* The disclosure-statements library's MOTN links as ym → statement PDF.
   The tracking study's statement file is
   "NGR-2203003-MOTN-Methodology-Disclosure-Statement-<Month>-<Year>.pdf" –
   capitalisation and "-1"/"-F1-1" re-upload suffixes vary, other studies'
   statements share the page so only "-MOTN-" files count, and the first
   sighting of a month wins (pages walk newest-first). */
export function motnStatementsOf(html) {
  const out = new Map();
  for (const m of String(html).matchAll(/href="([^"]*\/wp-content\/uploads\/[^"]+?\.pdf)"/gi)) {
    const file = m[1].split("?")[0].split("#")[0];
    if (!/-MOTN-/.test(file)) continue;
    const ym = motnStatementYm(file);
    if (ym && !out.has(ym)) out.set(ym, file);
  }
  return out;
}
export function motnStatementYm(url) {
  const name = decodeURIComponent(url.split("/").pop());
  const m = name.match(/-Statement-([A-Za-z]+)-(\d{4})/);
  if (!m) return null;
  const mo = MONTHS[m[1].toLowerCase()];
  return mo == null ? null : `${m[2]}-${String(mo + 1).padStart(2, "0")}`;
}

/* The methodology page facts of a tracking wave: its ordinal, fieldwork
   span and sample size – or null for a report that never asked (a special),
   which is a skip, not a failure. */
export function methodologyOf(text) {
  const w = text.match(/The (\d+)(?:st|nd|rd|th) wave of this bi-monthly/);
  if (!w) return null;
  const d = text.match(/Fieldwork dates\s*\n?\s*(\d{1,2})(?:st|nd|rd|th)\s+(?:([A-Za-z]+)\s+)?[–-]\s*(\d{1,2})(?:st|nd|rd|th)\s+([A-Za-z]+)\s+(\d{4})/);
  if (!d) return { wave: +w[1], date: null, dateStart: null, sample: null,
                   problems: ["the fieldwork dates didn't parse"] };
  const endMo = MONTHS[d[4].toLowerCase()];
  const startMo = d[2] != null ? MONTHS[d[2].toLowerCase()] : endMo;
  if (endMo == null || startMo == null) return { wave: +w[1], date: null, dateStart: null, sample: null,
    problems: [`unrecognised month in the fieldwork dates ("${d[0].trim()}")`] };
  const endYear = +d[5];
  const startYear = startMo > endMo ? endYear - 1 : endYear;
  const iso = (y, mo, day) => `${y}-${String(mo + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const n = text.match(/n = ([\d,]+) Australians/);
  const problems = [];
  if (!n) problems.push("the sample size didn't parse");
  return { wave: +w[1], date: iso(endYear, endMo, +d[3]), dateStart: iso(startYear, startMo, +d[1]),
           sample: n ? +n[1].replace(/,/g, "") : null, problems };
}

/* The national direction chart page's number in a report's layout text
   (form-feed split), for `pdftotext -f N -l N -bbox`; 0 when the report
   carries none (the specials), which the caller treats as skip-not-fail
   only when methodologyOf already said it isn't a tracking wave. */
export function directionPageOf(text) {
  const pages = text.split("\f");
  const i = pages.findIndex((pg) => /Perceived direction of Australia/.test(pg));
  return i < 0 ? 0 : i + 1;
}

/* The direction chart's per-wave readings from a `pdftotext -bbox` of its
   page. The month label row gives the column centres; in each column the
   two printed values pair as the UPPER = wrong track and the LOWER = right
   direction (they never cross in the tracked era, and the callers' checks
   fail loudly if a future wave flips them). The y/x windows keep out the
   axis labels (x < 60), the right-hand callouts (x > 730) and the
   per-state table below the month row. */
export function directionChartOf(bboxHtml) {
  const words = [...bboxHtml.matchAll(/<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)<\/word>/g)]
    .map((m) => ({ x: +m[1], y: +m[2], t: m[5].replace(/&apos;|&#039;/g, "\u2019") }));
  // three-letter abbreviations plus every full name – "June" and "Sept"
  // have both printed, so a full-name label is only a layout whim away
  const MON = ["Jan", "January", "Feb", "February", "Mar", "March", "Apr", "April", "May",
    "Jun", "June", "Jul", "July", "Aug", "August", "Sep", "Sept", "September",
    "Oct", "October", "Nov", "November", "Dec", "December"];
  const axisRow = (() => {   // the y carrying the month label row (>= 5 tokens)
    const tally = {};
    for (const w of words) {
      if (!MON.includes(w.t) || w.x >= 750) continue;
      const k = Math.round(w.y / 8) * 8;
      tally[k] = (tally[k] || 0) + 1;
    }
    const best = Object.entries(tally).sort((a, b) => b[1] - a[1])[0];
    return best && best[1] >= 5 ? +best[0] : null;
  })();
  if (axisRow == null) return { columns: [], problems: ["no month label row on the direction chart page"] };
  const labels = words.filter((w) => MON.includes(w.t) && w.x < 750 && Math.abs(w.y - axisRow) <= 8)
    .sort((a, b) => a.x - b.x);
  const vals = words.filter((w) => /^\d{1,3}$/.test(w.t) && w.x >= 60 && w.x <= 730
    && w.y > axisRow - 130 && w.y < axisRow - 4)
    .map((w) => ({ x: w.x, y: w.y, v: +w.t }));
  const problems = [], columns = [];
  for (const col of labels) {
    const here = vals.filter((v) => Math.abs(v.x - col.x) <= 16).sort((a, b) => a.y - b.y);
    // a stray token in the window (a glued page number) makes the column
    // unreadable rather than guessed
    if (here.length !== 2) { columns.push(null); problems.push(`${col.t} column: ${here.length} value token(s), expected 2`); continue; }
    const wrong = here[0].v, right = here[1].v;
    if (wrong < 15 || wrong > 80 || right < 15 || right > 80) problems.push(`${col.t} column: ${wrong}/${right} outside 15–80`);
    if (Math.abs(wrong + right - 100) > 1) problems.push(`${col.t} column: ${wrong} + ${right} ≠ 100`);
    if (wrong < right) problems.push(`${col.t} column: wrong track ${wrong} below right direction ${right} – the lines crossed`);
    columns.push({ wrong, right });
  }
  return { columns, problems };
}

/* The "Perceived direction of individual states (%)" table lower on the
   same page – banked into data/sec-direction-states.json (no panel reads
   it yet). Each state row prints the current wave's right/wrong pair, then
   one % right-direction cell per column (a MAR ’22 anchor plus the wave's
   own and its two predecessors’ tracking waves – the April 2026 special
   asked no direction question, so May 2026's window reaches back to Nov
   2025). The pair sits left of every column; cells centre under their
   MON ’YY header pair. Only the pair prints wrong-direction, so past-wave
   cells are right-only; every wave's own pair is captured from its own
   report. Stray state tokens in the dek copy above the table are kept
   out by requiring labels to sit BELOW the column header row. */
const DIR_STATES = ["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"];
const MON3 = { JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11 };

export function stateTableOf(bboxHtml) {
  const words = [...bboxHtml.matchAll(/<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)<\/word>/g)]
    .map((m) => ({ x: +m[1], xm: +m[3], y: +m[2], t: m[5].replace(/&apos;|&#039;/g, "’") }));
  const problems = [];
  const onLine = (w, y, tol) => Math.abs(w.y - y) <= tol;
  const head = words.find((w) => w.t === "Perceived"
    && words.some((o) => o.t === "individual" && onLine(o, w.y, 6))
    && words.some((o) => o.t === "states" && onLine(o, w.y, 6)));
  if (!head) return { columns: [], states: {}, problems: ["no 'Perceived direction of individual states' table on the direction page"] };
  // the column header row: MON tokens just below the table header, each
  // trailed by its ’YY token; the (month,year) token pair's span centres
  // the column
  const colHdrY = (() => {
    const tally = {};
    for (const w of words) {
      if (!(w.t in MON3) || w.y <= head.y + 4 || w.y > head.y + 40) continue;
      if (!words.some((o) => /^[‘’']\d{2}$/.test(o.t) && onLine(o, w.y, 4) && o.x >= w.xm && o.x - w.xm < 12)) continue;
      const k = Math.round(w.y / 8) * 8;
      tally[k] = (tally[k] || 0) + 1;
    }
    const best = Object.entries(tally).sort((a, b) => b[1] - a[1])[0];
    return best && best[1] >= 2 ? +best[0] : null;
  })();
  if (colHdrY == null) return { columns: [], states: {}, problems: ["no MON ’YY column header row on the state direction table"] };
  const columns = [];
  for (const w of words.filter((o) => o.t in MON3 && onLine(o, colHdrY, 8)).sort((a, b) => a.x - b.x)) {
    const yr = words.find((o) => /^[‘’'](\d{2})$/.test(o.t) && onLine(o, w.y, 4) && o.x >= w.xm && o.x - w.xm < 12);
    if (!yr) { problems.push(`${w.t} column header: no ’YY token beside it`); continue; }
    const ym = `${2000 + +yr.t.slice(-2)}-${String(MON3[w.t] + 1).padStart(2, "0")}`;
    columns.push({ ym, c: (w.x + yr.xm) / 2 });
  }
  if (columns.length < 2) problems.push(`only ${columns.length} state-table column(s) read`);
  const firstCell = columns.length ? columns[0].c - 25 : null;
  // state rows: labels below the column headers; numerics left of the
  // first column centre are the pair, the rest sit on column centres
  const states = {};
  for (const lbl of words.filter((w) => DIR_STATES.includes(w.t) && w.y > colHdrY + 10 && w.y < colHdrY + 220).sort((a, b) => a.y - b.y)) {
    if (states[lbl.t]) continue;    // one row per state; a doubled label is dek copy
    const nums = words.filter((w) => /^\d{1,3}$/.test(w.t) && onLine(w, lbl.y, 8) && w.x >= 60)
      .map((w) => ({ x: w.x, v: +w.t })).sort((a, b) => a.x - b.x);
    if (!nums.length) continue;     // a stray label with no readings beside it
    const pair = nums.filter((n) => n.x < firstCell);
    const cells = nums.filter((n) => n.x >= firstCell);
    if (pair.length !== 2) { problems.push(`${lbl.t} row: ${pair.length} pair token(s), expected 2 (right, wrong)`); continue; }
    if (cells.length !== columns.length) { problems.push(`${lbl.t} row: ${cells.length} cell value(s) for ${columns.length} columns`); continue; }
    const byCol = {};
    let ok = true;
    for (const cell of cells) {
      const col = columns.reduce((best, c) => Math.abs(c.c - (cell.x + 6)) < Math.abs(best.c - (cell.x + 6)) ? c : best, columns[0]);
      if (Math.abs(col.c - (cell.x + 6)) > 20 || byCol[col.ym] != null) { problems.push(`${lbl.t} row: a cell doesn't land on its own column`); ok = false; break; }
      byCol[col.ym] = cell.v;
    }
    if (!ok) continue;
    const right = pair[0].v, wrong = pair[1].v;
    const lastYm = columns[columns.length - 1].ym;
    if (byCol[lastYm] !== right) problems.push(`${lbl.t} row: pair right ${right} ≠ the wave's own column ${byCol[lastYm]}`);
    if (Math.abs(right + wrong - 100) > 1) problems.push(`${lbl.t} row: ${right} + ${wrong} ≠ 100`);
    for (const v of [right, wrong, ...Object.values(byCol)]) if (v < 10 || v > 85) problems.push(`${lbl.t} row: ${v} outside 10–85`);
    states[lbl.t] = { right, wrong, cells: byCol };
  }
  if (Object.keys(states).length < 5) problems.push(`only ${Object.keys(states).length} state row(s) read – has the table changed?`);
  return { columns: columns.map((c) => c.ym), states, problems };
}

/* The "Unprompted concerns and priorities" page's B1 table, banked into
   data/sec-issues.json (no panel reads it yet – the Issues panel pools
   forced top-three salience, and this is an open-ended multi-mention
   measure, so the two never mix). B1 asks "What are the main issues facing
   Australians that are most important to you right now…?", takes any
   number of mentions in the voter's own words, and prints the top
   ten-or-so as "% MENTIONING EACH" against a MAR ’22 anchor column plus
   the wave's own and its two predecessors’ tracking waves (the April 2026
   Special Edition DID ask B1, unlike direction, so 2026-04 enters from the
   May and July 2026 reprints – the special caches with wave: null and
   never banks itself). The
   table is read from the whole-report -layout TEXT – the bbox cache holds
   only the direction and priorities-grid pages – where each MON column
   header trailed by its
   ’YY on a line below gives the column's right edge, and each row prints
   its label then one bare-integer cell right-aligned on every column.
   The B5 extremely-important ratings are NOT banked (B6's heat scores
   bank separately, from the grid page's bbox – see heatGridOf). */
export function concernTableOf(text) {
  const lines = String(text).split("\n");
  const problems = [];
  const empty = { columns: [], concerns: {}, problems };
  const head = lines.findIndex((l) => /mentioning each/i.test(l));
  if (head < 0) { problems.push("no '% MENTIONING EACH' concerns table in the report"); return empty; }
  let monIdx = -1, monToks = [];
  for (let i = head + 1; i < Math.min(head + 10, lines.length); i++) {
    const toks = [...lines[i].matchAll(/(?<![A-Za-z])(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)(?![A-Za-z])/gi)];
    if (toks.length >= 2) { monIdx = i; monToks = toks; break; }
  }
  if (monIdx < 0) { problems.push("no MON column header under '% MENTIONING EACH'"); return empty; }
  let yrIdx = -1, yrToks = [];
  for (let i = monIdx + 1; i < Math.min(monIdx + 8, lines.length); i++) {
    const toks = [...lines[i].matchAll(/[‘’'`](\d{2})(?!\d)/g)];
    if (toks.length >= monToks.length) { yrIdx = i; yrToks = toks; break; }
  }
  if (yrIdx < 0) { problems.push("no ’YY year line under the MON column header"); return empty; }
  const columns = [];
  for (const m of monToks) {
    const yr = yrToks.find((y) => Math.abs(y.index - m.index) <= 6);
    if (!yr) { problems.push(`${m[0]} column header: no ’YY token beside it`); continue; }
    const ym = `${2000 + +yr[1]}-${String(MON3[m[0].toUpperCase()] + 1).padStart(2, "0")}`;
    columns.push({ ym, edge: m.index + m[0].length - 1 });
  }
  if (columns.length < 2) { problems.push(`only ${columns.length} concerns-table column(s) read`); return empty; }
  if (new Set(columns.map((c) => c.ym)).size !== columns.length) problems.push("a month column appears twice in the concerns table header");
  const concerns = {};
  for (let i = yrIdx + 1; i < Math.min(yrIdx + 100, lines.length); i++) {
    const line = lines[i];
    if (line.includes("\f") || /\bB\d\./.test(line) || /Base:/.test(line)) break;
    if (!/[A-Za-z0-9]/.test(line)) continue;   // the space-run separators
    const toks = [...line.matchAll(/(?<![\w%.,])\d{1,3}(?![\w%.,’])/g)];
    if (!toks.length) {
      if (Object.keys(concerns).length) break;   // the footnote copy after the table
      continue;
    }
    const label = line.slice(0, toks[0].index).trim().replace(/\s+/g, " ");
    if (label.length < 3) { problems.push(`row ${i - yrIdx}: no issue label before its cells`); continue; }
    if (concerns[label]) { problems.push(`issue row '${label}' appears twice`); continue; }
    if (toks.length !== columns.length) { problems.push(`'${label}' row: ${toks.length} cell value(s) for ${columns.length} columns`); continue; }
    const cells = {};
    let ok = true;
    for (const tok of toks) {
      const edge = tok.index + tok[0].length - 1;
      const col = columns.reduce((best, c) => Math.abs(c.edge - edge) < Math.abs(best.edge - edge) ? c : best, columns[0]);
      if (Math.abs(col.edge - edge) > 5 || cells[col.ym] != null) { problems.push(`'${label}' row: a cell doesn't land on its own column`); ok = false; break; }
      const v = +tok[0];
      if (v > 90) { problems.push(`'${label}' row: ${v} outside 0–90`); ok = false; break; }
      cells[col.ym] = v;
    }
    if (ok) concerns[label] = cells;
  }
  if (Object.keys(concerns).length < 5) problems.push(`only ${Object.keys(concerns).length} issue row(s) read – has the table changed?`);
  return { columns: columns.map((c) => c.ym), concerns, problems };
}

/* G4 ("Which of the following do you think would be the best party to
   manage the cost of living?") asks every wave; its page carries a tracking
   chart back to APR '22 and a demographics table whose TOTAL column is the
   national reading banked here. The table prints only its own wave: the
   "MONTH 'YY (%) TOTAL MEN WOMEN …" header, then labelled rows of one bare
   integer per column, then the G4. question line. What it prints changed
   with the question: waves 21–22 (Jul/Sep 2025) print Labor and the
   Coalition only, waves 23–24 add a "Neither / someone else" row ("Can't
   say" is never a row), and from wave 25 (May 2026) – when One Nation and
   the Greens became response options (the page flags the "METHODOLOGY
   CHANGE") – it prints the four parties only, "None/someone else" and
   "can't say" no longer shown. `rest` banks the balance of 100: Can't say
   alone where Neither is printed, otherwise Neither and Can't say
   combined. */
export function g4BestPartyOf(text) {
  const lines = String(text).split("\n");
  const problems = [];
  const empty = { ym: null, shares: null, problems };
  const q = lines.findIndex((l) => /G4\.\s*Now turning to the cost of living/i.test(l) && /best party/i.test(l));
  if (q < 0) { problems.push("no 'G4.' best-party question in the report"); return empty; }
  const MON = "JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER";
  let head = -1, ym = null;
  for (let i = q - 1; i >= Math.max(0, q - 16); i--) {
    if (lines[i].includes("\f")) break;
    const m = lines[i].match(new RegExp(`^\\s*(${MON})\\s*[‘'']?(\\d{2,4})\\s*\\(%\\)\\s+TOTAL\\b`, "i"));
    if (!m) continue;
    head = i;
    const yr = m[2].length === 2 ? 2000 + +m[2] : +m[2];
    ym = `${yr}-${String(MON3[m[1].slice(0, 3).toUpperCase()] + 1).padStart(2, "0")}`;
    break;
  }
  if (head < 0) { problems.push("no MONTH 'YY (%) TOTAL header above the G4 question"); return empty; }
  const shares = {};
  for (let i = head + 1; i < Math.min(head + 14, q + 1); i++) {
    const cells = lines[i].trim().split(/\s{2,}/).filter(Boolean);
    if (cells.length < 2 || !/^\d{1,2}$/.test(cells[1])) continue;
    const key = /^Labor Party$/i.test(cells[0]) ? "alp"
      : /^(Coalition|Liberal ?\/ ?Nationals? ?Coalition|Liberal ?\/ ?National\*?)$/i.test(cells[0]) ? "lnp"
      : /^One Nation$/i.test(cells[0]) ? "onp"
      : /^The Greens$/i.test(cells[0]) ? "grn"
      : /^Neither ?\/ ?someone else$/i.test(cells[0]) ? "oth"
      : /^Can['’]t say$/i.test(cells[0]) ? "unsure" : null;
    if (!key) continue;
    if (shares[key] != null) { problems.push(`G4 row '${cells[0]}' appears twice`); continue; }
    const v = +cells[1];
    if (v > 60) { problems.push(`G4 '${cells[0]}' TOTAL reads ${v} – implausible`); continue; }
    shares[key] = v;
  }
  if (shares.alp == null || shares.lnp == null) { problems.push("no Labor/Coalition TOTAL row under the G4 header"); return empty; }
  if ((shares.onp == null) !== (shares.grn == null)) problems.push("only one of the One Nation / The Greens rows read");
  if (shares.unsure != null) problems.push("a 'Can't say' row read – the table has never printed one; has the layout changed?");
  const rest = 100 - Object.values(shares).reduce((a, b) => a + b, 0);
  if (rest < 5 || rest > 60) problems.push(`the G4 rows leave rest ${rest} of 100 – implausible`);
  if (problems.length) return empty;
  return { ym, shares: { ...shares, rest }, problems };
}

/* The national-priorities summary grid's page number in a report's layout
   text (form-feed split), for `pdftotext -f N -l N -bbox`, plus the grid's
   own item count. The grid – "Tracking the importance of NN national
   priorities", every priority a numbered tile printed Label (EI:heat),
   rated "Extremely Important" : "Political Heat Score" – sits on one page
   (page 4 in every cached wave), so a {page: 0} means the report carries
   none, which a tracking wave's caller treats as a defect. */
export function gridPageOf(text) {
  const pages = String(text).split("\f");
  const i = pages.findIndex((pg) => /Tracking the importance of (\d+) national priorities/i.test(pg));
  if (i < 0) return { page: 0, n: 0 };
  const n = +pages[i].match(/Tracking the importance of (\d+) national priorities/i)[1];
  return { page: i + 1, n };
}

/* The grid's tile count read off a CACHED grid page bbox, for the
   cache-only sweeps below: the live pass reads the count off the "NN
   national priorities" line of the -layout text, which a delisted wave's
   sweep does not have – but the tile zone between the headline and the
   Legend line (heatGridOf's own window) holds exactly N number tokens, so
   the page carries its own count and no constant stands in for it (a
   priority-count change must re-read, not fail every cached wave against
   the era's 36). 0 when the zone does not read – the caller falls back to
   the era's count. */
export function gridTileCount(bboxHtml) {
  const words = [...String(bboxHtml).matchAll(/<word xMin="[\d.]+" yMin="([\d.]+)" xMax="[\d.]+" yMax="[\d.]+">([^<]*)<\/word>/g)]
    .map((m) => ({ y: +m[1], t: m[2] }));
  const head = words.find((w) => w.t === "Tracking"
    && words.some((o) => o.t === "importance" && Math.abs(o.y - w.y) < 3));
  const legend = words.find((w) => w.t === "Legend");
  if (!head || !legend) return 0;
  return words.filter((w) => /^\d{1,2}$/.test(w.t) && w.y > head.y + 2 && w.y < legend.y - 2).length;
}

/* The summary grid's heat scores from a `pdftotext -bbox` of its page.
   The 36 numbered tiles sit in rows of six: the tile numbers anchor six
   x bands (a number's xMin is its band's left edge), a tile's box runs
   from its row's number y to the next row's, and every word of a tile –
   its wrapped label, then the "(EI:heat)" pair – lies inside its box.
   Every heat score in the bank below comes from this grid; it is read by
   GEOMETRY because pdftotext -layout reflows the six tile columns into
   one another (a label's words and its pair can land a band-width away
   from their tile), which char-column slicing cannot undo. A tile's
   words re-join by visual line, the pair comes last, and the EI half of
   the pair is parsed with the heat but stays out of the bank (a ratings
   scale that mixes with nothing). */
export function heatGridOf(bboxHtml, wantN = 36) {
  const words = [...bboxHtml.matchAll(/<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)<\/word>/g)]
    .map((m) => ({ x: +m[1], xm: +m[3], y: +m[2], t: m[5] }));
  const problems = [];
  const empty = { items: {}, problems };
  const head = words.find((w) => w.t === "Tracking"
    && words.some((o) => o.t === "importance" && Math.abs(o.y - w.y) < 3));
  if (!head) { problems.push("no 'Tracking the importance …' headline word on the grid page"); return empty; }
  const legend = words.find((w) => w.t === "Legend");
  if (!legend) { problems.push("no 'Legend (X:X)' line on the grid page"); return empty; }
  // the tile numbers 1..N, clustered into rows by y
  const nums = words.filter((w) => /^\d{1,2}$/.test(w.t) && w.y > head.y + 2 && w.y < legend.y - 2)
    .sort((a, b) => a.y - b.y || a.x - b.x);
  const rows = [];
  for (const n of nums) {
    const r = rows.length && Math.abs(rows[rows.length - 1][0].y - n.y) <= 3 ? rows[rows.length - 1]
      : (rows.push([]), rows[rows.length - 1]);
    r.push(n);
  }
  let expect = 1;
  for (const row of rows)
    for (const n of row) {
      if (+n.t === expect) expect++;
      else { problems.push(`the tile-number sequence broke at '${n.t}' (expected ${expect})`); break; }
    }
  if (expect !== wantN + 1) problems.push(`${expect - 1} tile numbers on the grid page, expected ${wantN}`);
  // each tile's box: its row's band of rows (number y to the next row's,
  // the last to the legend line) and its number's column band
  const items = {};
  let n0 = 1;
  for (let ri = 0; ri < rows.length; ri++) {
    const rowTop = rows[ri][0].y;
    const rowBot = ri + 1 < rows.length ? rows[ri + 1][0].y : legend.y;
    const xs = rows[ri].map((n) => n.x);
    for (let j = 0; j < xs.length; j++) {
      const lo = xs[j], hi = j + 1 < xs.length ? xs[j + 1] : Infinity;
      const ws = words.filter((w) => w !== rows[ri][j]
        && (w.x + w.xm) / 2 >= lo && (w.x + w.xm) / 2 < hi
        && w.y > rowTop + 1 && w.y < rowBot);
      ws.sort((a, b) => a.y - b.y || a.x - b.x);
      const lineGroups = [];
      for (const w of ws) {
        const g = lineGroups.length && Math.abs(lineGroups[lineGroups.length - 1][0].y - w.y) <= 2 ? lineGroups[lineGroups.length - 1]
          : (lineGroups.push([]), lineGroups[lineGroups.length - 1]);
        g.push(w);
      }
      const text = lineGroups.map((g) => g.map((w) => w.t).join(" ")).join(" ").replace(/\s+/g, " ").trim();
      const tile = n0 + j;
      const m = text.match(/^(.*?)\s*\((\d{1,2}):(\d{1,2})\)$/);
      if (!m) { problems.push(`tile ${tile}: no trailing (EI:heat) pair (text: '${text.slice(0, 60)}')`); continue; }
      const label = m[1].trim(), ei = +m[2], heat = +m[3];
      if (/\(\d{1,2}:\d{1,2}\)/.test(label)) problems.push(`tile ${tile}: a second (EI:heat) pair inside its label`);
      if (label.length < 10) problems.push(`tile ${tile}: a label of ${label.length} chars`);
      if (items[label]) problems.push(`label '${label.slice(0, 40)}' appears twice`);
      if (ei < 3 || ei > 90) problems.push(`tile ${tile}: EI ${ei} outside 3–90`);
      if (heat < 0 || heat > 60) problems.push(`tile ${tile}: heat ${heat} outside 0–60`);
      items[label] = { ei, heat };
    }
    n0 += rows[ri].length;
  }
  if (Object.keys(items).length !== wantN) problems.push(`read ${Object.keys(items).length} item(s), expected ${wantN}`);
  return { items, problems };
}

const slugOf = (url) => decodeURIComponent(url.split("/").pop())
  .replace(/\.pdf$/i, "").replace(/[^A-Za-z0-9._-]+/g, "_");

async function main() {
  const status = { changed: false, added: [], healed: [], pending: [], stale: [], warnings: [] };
  fs.mkdirSync(SRC, { recursive: true });

  let items;
  try { items = await getJson(API); }
  catch (e) {
    console.log("warning media API: " + e.message);
    status.warnings.push(`media API: ${e.message}`);
    if (PROBE) { console.log("PROBE " + JSON.stringify({ new: [], warnings: status.warnings })); return; }
    // a cached wave still needs its quiet check below even when discovery failed
    fin(status);
    return;
  }
  if (!Array.isArray(items) || items.length < 5) {
    status.warnings.push(`media API returned ${Array.isArray(items) ? items.length : "no"} items – has the search broken?`);
    if (Array.isArray(items)) items = []; else items = [];
  }
  const groups = pickReports(items);
  if (groups.length < 5) status.warnings.push(`only ${groups.length} report wave(s) found from ${SEC_FIRST} on – has the media library changed?`);
  /* The APC methodology statements, keyed by wave month and walked only as
     deep as the waves on the board: each wave's direction row links its
     statement (the All-polls "APC methodology" link). A statement's URL
     moves when the house re-uploads it, so a row's link heals whenever the
     library disagrees. A library fetch failure never touches the rows –
     stmts.ok false keeps the links they have. */
  const needYms = new Set(groups.map((g) => g.ym));
  const stmts = await (async () => {
    const map = new Map();
    let seenAny = false;
    try {
      for (let page = 1; page <= DISCLOSE_PAGES; page++) {
        const html = (await get(page === 1 ? DISCLOSE : DISCLOSE + "page/" + page)).toString("utf8");
        const found = motnStatementsOf(html);
        if (page === 1 && !found.size) throw new Error("no MOTN statements on the disclosure page – has it changed?");
        if (!found.size) break;   // past the library's statement pages
        seenAny = true;
        for (const [ym, url] of found) if (!map.has(ym)) map.set(ym, url);
        if ([...needYms].every((ym) => map.has(ym))) break;
      }
    } catch (e) { status.warnings.push(`disclosure statements: ${e.message}`); }
    return { ok: seenAny, map };
  })();
  if (PROBE) {
    // mirrors the loop below: it fetches a month's FIRST candidate unless
    // that one's text and chart page are cached, and back-fills a missing
    // grid page whenever the report has one
    const todo = [];
    for (const g of groups) {
      const slug = slugOf(g.urls[0].url);
      const txtPath = path.join(SRC, slug + ".txt");
      let special = false;
      try { special = JSON.parse(fs.readFileSync(path.join(SRC, slug + ".json"), "utf8")).special === true; } catch {}
      if (special) continue;   // a cached not-a-tracking-wave: settled, no work
      if (FORCE || !fs.existsSync(txtPath) || !fs.existsSync(path.join(SRC, slug + ".bbox.html"))) todo.push(slug);
      else if (!fs.existsSync(path.join(SRC, slug + ".grid.bbox.html")) && gridPageOf(fs.readFileSync(txtPath, "utf8")).page)
        todo.push(slug + " (grid page)");
    }
    // …and a filed wave whose statement link no longer matches the library
    // (statements post AFTER the wave's report run, so this is the only
    // gate that ever sees them land)
    if (stmts.ok) {
      let dir = [];
      try { dir = JSON.parse(fs.readFileSync(POLLS, "utf8")).direction || []; } catch {}
      for (const ym of needYms) {
        const row = dir.find((d) => d.pollster === POLLSTER && d.date.startsWith(ym));
        if (row && (row.methodUrl || null) !== (stmts.map.get(ym) || null)) todo.push(`${ym} (disclosure statement)`);
      }
    }
    console.log("PROBE " + JSON.stringify({ new: todo, warnings: status.warnings }));
    return;
  }

  const waves = new Map();   // wave ordinal -> { slug, meta, cols: […], page, published }
  for (const g of groups) {
    let done = false;
    for (const cand of done ? [] : g.urls) {
      const url = cand.url;
      const slug = slugOf(url);
      const txtPath = path.join(SRC, slug + ".txt");
      const bboxPath = path.join(SRC, slug + ".bbox.html");
      const gridPath = path.join(SRC, slug + ".grid.bbox.html");
      let text, bbox;
      if (!FORCE && fs.existsSync(txtPath) && fs.existsSync(bboxPath)) {
        text = fs.readFileSync(txtPath, "utf8");
        bbox = fs.readFileSync(bboxPath, "utf8");
      } else {
        let buf;
        try { buf = await get(url); }
        catch (e) { status.warnings.push(`${slug}: ${e.message}`); continue; }
        if (buf.subarray(0, 5).toString("latin1") !== "%PDF-") { status.warnings.push(`${slug}: not a PDF`); continue; }
        let grid;
        try {
          text = pdfToText(buf, slug, ["-layout"]);
          const meta0 = methodologyOf(text);
          if (!meta0) {
            // not a tracking wave (a special): cache the text with a
            // wave:null sidecar so every later run – and probe – sees the
            // month as settled instead of re-fetching and warning forever
            fs.writeFileSync(txtPath + ".tmp", text); fs.renameSync(txtPath + ".tmp", txtPath);
            writeAtomic(path.join(SRC, slug + ".json"),
              JSON.stringify({ pdf: url, wave: null, special: true,
                ...(cand.published ? { published: cand.published } : {}) }, null, 1) + "\n");
            console.log(`cached report ${slug} (a special, not a tracking wave)`);
            done = true;
            break;
          }
          const page = directionPageOf(text);
          if (!page) { status.pending.push(`${g.ym}: the report has no national direction chart page`); done = true; break; }
          bbox = pdfToText(buf, slug, ["-f", String(page), "-l", String(page), "-bbox"]);
          const grid0 = gridPageOf(text);
          if (grid0.page) grid = pdfToText(buf, slug, ["-f", String(grid0.page), "-l", String(grid0.page), "-bbox"]);
        } catch (e) { status.warnings.push(`${slug}: ${e.message}`); continue; }
        fs.writeFileSync(txtPath + ".tmp", text); fs.renameSync(txtPath + ".tmp", txtPath);
        fs.writeFileSync(bboxPath + ".tmp", bbox); fs.renameSync(bboxPath + ".tmp", bboxPath);
        if (grid != null) { fs.writeFileSync(gridPath + ".tmp", grid); fs.renameSync(gridPath + ".tmp", gridPath); }
        console.log(`cached report ${slug}`);
      }
      const meta = methodologyOf(text);
      if (!meta) { done = true; break; }   // cached special (or pre-refactor cache): the month is settled
      if (!meta.date || meta.problems.length) {
        // a read problem moves the wave to pending, sample-format loss
        // included: below, the exact-row heal would rewrite the row WITHOUT
        // whatever stopped parsing – a silently dropped sample is data loss
        // nobody is told about
        status.pending.push(`${g.ym}: ${meta.problems.join("; ")}`);
        done = true; break;
      }
      // the grid page's bbox joined the cache with the heat-score bank:
      // back-fill it for waves cached before then, from the still-listed
      // PDF alone; a failure here only leaves the wave's heat unbanked
      const grid0 = gridPageOf(text);
      if (!fs.existsSync(gridPath)) {
        try {
          if (grid0.page) {
            const buf = await get(url);
            if (buf.subarray(0, 5).toString("latin1") !== "%PDF-") throw new Error("not a PDF");
            const grid = pdfToText(buf, slug, ["-f", String(grid0.page), "-l", String(grid0.page), "-bbox"]);
            fs.writeFileSync(gridPath + ".tmp", grid); fs.renameSync(gridPath + ".tmp", gridPath);
            console.log(`back-filled grid page ${slug}`);
          }
        } catch (e) { status.warnings.push(`${slug}: grid page: ${e.message}`); }
      }
      const chart = directionChartOf(bbox);
      const last = chart.columns[chart.columns.length - 1];
      if (chart.problems.length || !last) {
        status.pending.push(`${g.ym}: the direction chart didn't read (${chart.problems.slice(0, 2).join("; ") || "no endpoint"})`);
        done = true; break;
      }
      if (chart.columns.length !== meta.wave) {
        status.pending.push(`${g.ym}: wave ${meta.wave} but the chart has ${chart.columns.length} columns`);
        done = true; break;
      }
      writeAtomic(path.join(SRC, slug + ".json"),
        JSON.stringify({ pdf: url, wave: meta.wave, date: meta.date, dateStart: meta.dateStart, sample: meta.sample,
          ...(cand.page ? { url: cand.page } : {}), ...(cand.published ? { published: cand.published } : {}),
          ...(stmts.ok && stmts.map.get(meta.date.slice(0, 7)) ? { method: stmts.map.get(meta.date.slice(0, 7)) } : {}) }, null, 1) + "\n");
      // the per-state direction table banks separately from the national
      // rows: a state misread alarms WITHOUT holding the national row back
      let table = stateTableOf(bbox);
      if (table.problems.length) {
        status.pending.push(`${g.ym}: the state direction table didn't read (${table.problems[0]})`);
        table = null;
      } else if (table.columns[table.columns.length - 1] !== meta.date.slice(0, 7)) {
        status.pending.push(`${g.ym}: the state table's own column is ${table.columns[table.columns.length - 1]}, not the wave's ${meta.date.slice(0, 7)}`);
        table = null;
      }
      // the B1 concerns table banks the same way: a misread alarms without
      // holding the national row back
      let concerns = concernTableOf(text);
      if (concerns.problems.length) {
        status.pending.push(`${g.ym}: the concerns table didn't read (${concerns.problems[0]})`);
        concerns = null;
      } else if (concerns.columns[concerns.columns.length - 1] !== meta.date.slice(0, 7)) {
        status.pending.push(`${g.ym}: the concerns table's own column is ${concerns.columns[concerns.columns.length - 1]}, not the wave's ${meta.date.slice(0, 7)}`);
        concerns = null;
      }
      // the G4 best-party table banks the same way
      let g4 = g4BestPartyOf(text);
      if (g4.problems.length) {
        status.pending.push(`${g.ym}: the G4 best-party table didn't read (${g4.problems[0]})`);
        g4 = null;
      } else if (g4.ym !== meta.date.slice(0, 7)) {
        status.pending.push(`${g.ym}: the G4 table's month is ${g4.ym}, not the wave's ${meta.date.slice(0, 7)}`);
        g4 = null;
      }
      // the B6 heat-score grid banks the same way, off its page's bbox;
      // a wave with no grid cache yet (the PDF went unlisted before the
      // back-fill reached it) just banks no heat. The expected tile count
      // comes from the wave itself – the methodology line's declared n,
      // else a count of the tiles in the cached grid – so a changed
      // priority list re-reads instead of failing every cached wave
      // against a number written when it shipped
      let heat = null;
      if (fs.existsSync(gridPath)) {
        const cached = fs.readFileSync(gridPath, "utf8");
        const grid = heatGridOf(cached, grid0.n || gridTileCount(cached) || 36);
        if (grid.problems.length) {
          status.pending.push(`${g.ym}: the heat grid didn't read (${grid.problems[0]})`);
        } else heat = grid.items;
      }
      waves.set(meta.wave, { slug, meta, cols: chart.columns, page: cand.page, published: cand.published,
        method: stmts.ok ? stmts.map.get(meta.date.slice(0, 7)) || null : null, table, concerns, g4, heat });
      done = true;
    }
    if (!done && ![...waves.values()].some((w) => w.meta.date.startsWith(g.ym))) {
      // every URL for this month failed to load or read
      if (!status.pending.some((p) => p.startsWith(g.ym)))
        status.warnings.push(`${g.ym}: no report PDF could be used`);
    }
  }

  // the newest wave's full series reprints history: every earlier wave's
  // own endpoint must sit at series[wave-1] of the newest chart
  const newest = Math.max(...waves.keys(), 0);
  if (newest && waves.get(newest).cols.length === newest) {
    const series = waves.get(newest).cols;
    for (const [w, x] of waves) {
      if (w === newest) continue;
      const s = series[w - 1];
      const own = x.cols[x.cols.length - 1];
      if (!s || s.wrong !== own.wrong || s.right !== own.right)
        status.warnings.push(`wave ${w}: own report ends ${own.wrong}/${own.right} but ` +
          `the wave-${newest} chart reprints ${s ? `${s.wrong}/${s.right}` : "nothing"}`);
    }
    // delisted waves are still cached with their own reports: their
    // endpoints cross-check against the newest printed series the same way
    for (const f of fs.readdirSync(SRC).filter((f) => f.endsWith(".json")).sort()) {
      let side;
      try { side = JSON.parse(fs.readFileSync(path.join(SRC, f), "utf8")); } catch { continue; }
      if (!side || side.wave == null || side.wave === newest || waves.has(side.wave)) continue;
      const bboxPath = path.join(SRC, f.replace(/\.json$/, "") + ".bbox.html");
      if (!fs.existsSync(bboxPath)) continue;
      const x = directionChartOf(fs.readFileSync(bboxPath, "utf8"));
      if (x.problems.length) { status.pending.push(`${f.replace(/\.json$/, "")}: the cached national chart didn't read (${x.problems[0]})`); continue; }
      const s = series[side.wave - 1];
      const own = x.columns[x.columns.length - 1];
      if (!own) continue;
      if (!s || s.wrong !== own.wrong || s.right !== own.right)
        status.warnings.push(`delisted wave ${side.wave}: its cached report ends ${own.wrong}/${own.right} but ` +
          `the wave-${newest} chart reprints ${s ? `${s.wrong}/${s.right}` : "nothing"}`);
    }
  }

  // the per-state direction tables bank into data/sec-direction-states.json.
  // A wave's own report contributes its right/wrong pair; its trailing
  // columns reprint the two previous tracking waves (right-direction only)
  // as cross-checks. Reports cached but no longer listed by the media API
  // still count, so the banked series never shrinks.
  {
    const byWave = new Map([...waves.entries()].filter(([, x]) => x.table)
      .map(([w, x]) => [w, { table: x.table, ym: x.meta.date.slice(0, 7) }]));
    for (const f of fs.readdirSync(SRC).filter((f) => f.endsWith(".json")).sort()) {
      let side;
      try { side = JSON.parse(fs.readFileSync(path.join(SRC, f), "utf8")); } catch { continue; }
      if (!side || side.wave == null || side.date == null || waves.has(side.wave) || byWave.has(side.wave)) continue;
      const slug = f.replace(/\.json$/, "");
      const bboxPath = path.join(SRC, slug + ".bbox.html");
      if (!fs.existsSync(bboxPath)) continue;
      const table = stateTableOf(fs.readFileSync(bboxPath, "utf8"));
      if (table.problems.length) { status.pending.push(`${slug}: the cached state direction table didn't read (${table.problems[0]})`); continue; }
      if (table.columns[table.columns.length - 1] !== side.date.slice(0, 7)) {
        status.pending.push(`${slug}: the cached state table's own column is ${table.columns[table.columns.length - 1]}, not the wave's ${side.date.slice(0, 7)}`);
        continue;
      }
      byWave.set(side.wave, { table, ym: side.date.slice(0, 7) });
    }
    const rights = {};   // state -> ym -> [{ wave, right }] sightings, wave order
    const pairs = {};    // state -> ym -> { right, wrong } from the wave's own report
    for (const [wave, x] of [...byWave.entries()].sort((a, b) => a[0] - b[0])) {
      for (const [st, row] of Object.entries(x.table.states)) {
        for (const ym of x.table.columns) {
          if (row.cells[ym] == null) continue;
          ((rights[st] ||= {})[ym] ||= []).push({ wave, right: row.cells[ym] });
        }
        (pairs[st] ||= {})[x.ym] = { right: row.right, wrong: row.wrong };
      }
    }
    const series = {};
    for (const st of DIR_STATES.filter((s) => rights[s]).concat(Object.keys(rights).filter((s) => !DIR_STATES.includes(s)).sort())) {
      series[st] = Object.keys(rights[st]).sort().map((ym) => {
        const vals = rights[st][ym].map((s) => s.right);
        if (new Set(vals).size > 1)
          status.warnings.push(`state table ${st} ${ym}: reprinted as ${vals.join(", then ")} – SEC Newgate revised a wave`);
        const pair = (pairs[st] || {})[ym];
        return pair ? { month: ym, right: pair.right, wrong: pair.wrong }
                    : { month: ym, right: vals[vals.length - 1] };
      });
    }
    const out = {
      _about: "Per-state right-direction/wrong-track readings from SEC Newgate's Mood of the Nation tracking study – the 'Perceived direction of individual states' tables in each wave's report (the five mainland states only; per-state subsamples of the national wave, so several points of noise either way). Banked by .build/extract-secnewgate.mjs as waves land; nothing on the site reads this yet. Each wave's entry carries right/wrong from its own report's row pair; entries before the cache horizon (Feb/Apr 2025) and the 2022-03 anchor column come from later reports' trailing reprint columns and carry right-direction only. month = fieldwork-end month, keying the wave's direction[] row in data/polls.json.",
      states: Object.keys(series),
      series,
    };
    const outJson = JSON.stringify(out, null, 1) + "\n";
    if (!fs.existsSync(STATES_OUT) || fs.readFileSync(STATES_OUT, "utf8") !== outJson) {
      writeAtomic(STATES_OUT, outJson);
      console.log("wrote " + path.relative(ROOT, STATES_OUT));
    }
  }

  // the B1 concerns tables bank into data/sec-issues.json. Each wave's
  // table contributes its own column and reprints its two predecessors as
  // its trailing columns, so every month is sighted from several reports
  // and the sightings must agree. Reports cached but no longer listed by
  // the media API still count, so the banked series never shrinks.
  {
    const byWave = new Map([...waves.entries()].filter(([, x]) => x.concerns)
      .map(([w, x]) => [w, { concerns: x.concerns, ym: x.meta.date.slice(0, 7) }]));
    for (const f of fs.readdirSync(SRC).filter((f) => f.endsWith(".json")).sort()) {
      let side;
      try { side = JSON.parse(fs.readFileSync(path.join(SRC, f), "utf8")); } catch { continue; }
      if (!side || side.wave == null || side.date == null || waves.has(side.wave) || byWave.has(side.wave)) continue;
      const slug = f.replace(/\.json$/, "");
      const txtPath = path.join(SRC, slug + ".txt");
      if (!fs.existsSync(txtPath)) continue;
      const concerns = concernTableOf(fs.readFileSync(txtPath, "utf8"));
      if (concerns.problems.length) { status.pending.push(`${slug}: the cached concerns table didn't read (${concerns.problems[0]})`); continue; }
      if (concerns.columns[concerns.columns.length - 1] !== side.date.slice(0, 7)) {
        status.pending.push(`${slug}: the cached concerns table's own column is ${concerns.columns[concerns.columns.length - 1]}, not the wave's ${side.date.slice(0, 7)}`);
        continue;
      }
      byWave.set(side.wave, { concerns, ym: side.date.slice(0, 7) });
    }
    const sightings = {};   // label -> ym -> mention, wave order
    for (const [, x] of [...byWave.entries()].sort((a, b) => a[0] - b[0])) {
      for (const [lbl, cells] of Object.entries(x.concerns.concerns)) {
        for (const ym of x.concerns.columns) {
          if (cells[ym] == null) continue;
          ((sightings[lbl] ||= {})[ym] ||= []).push(cells[ym]);
        }
      }
    }
    const series = {};
    for (const lbl of Object.keys(sightings).sort()) {
      series[lbl] = Object.keys(sightings[lbl]).sort().map((ym) => {
        const vals = sightings[lbl][ym];
        if (new Set(vals).size > 1)
          status.warnings.push(`concerns table ${lbl} ${ym}: reprinted as ${vals.join(", then ")} – SEC Newgate revised a wave`);
        return { month: ym, mention: vals[vals.length - 1] };
      });
    }
    // the G4 best-party tables bank beside the concerns: each wave's table
    // prints its own wave only (no reprints), so a month is sighted once,
    // from its own report's TOTAL column
    const byWaveG4 = new Map([...waves.entries()].filter(([, x]) => x.g4)
      .map(([w, x]) => [w, x.g4]));
    for (const f of fs.readdirSync(SRC).filter((f) => f.endsWith(".json")).sort()) {
      let side;
      try { side = JSON.parse(fs.readFileSync(path.join(SRC, f), "utf8")); } catch { continue; }
      if (!side || side.wave == null || side.date == null || waves.has(side.wave) || byWaveG4.has(side.wave)) continue;
      const slug = f.replace(/\.json$/, "");
      const txtPath = path.join(SRC, slug + ".txt");
      if (!fs.existsSync(txtPath)) continue;
      const g4 = g4BestPartyOf(fs.readFileSync(txtPath, "utf8"));
      if (g4.problems.length) { status.pending.push(`${slug}: the cached G4 best-party table didn't read (${g4.problems[0]})`); continue; }
      if (g4.ym !== side.date.slice(0, 7)) {
        status.pending.push(`${slug}: the cached G4 table's month is ${g4.ym}, not the wave's ${side.date.slice(0, 7)}`);
        continue;
      }
      byWaveG4.set(side.wave, g4);
    }
    const bestParty = {};
    for (const [, x] of [...byWaveG4.entries()].sort((a, b) => a[0] - b[0])) bestParty[x.ym] = x.shares;
    // the B6 heat-score grids bank the same way as G4: each wave's grid
    // printed once, sighted once. Clobber-on-write is fine (no reprints
    // to conflict), and the verbatim labels mean a wave's label flip
    // (university/University) lives only in its own month
    const byWaveHeat = new Map([...waves.entries()].filter(([, x]) => x.heat)
      .map(([w, x]) => [w, { heat: x.heat, ym: x.meta.date.slice(0, 7) }]));
    for (const f of fs.readdirSync(SRC).filter((f) => f.endsWith(".json")).sort()) {
      let side;
      try { side = JSON.parse(fs.readFileSync(path.join(SRC, f), "utf8")); } catch { continue; }
      if (!side || side.wave == null || side.date == null || waves.has(side.wave) || byWaveHeat.has(side.wave)) continue;
      const slug = f.replace(/\.json$/, "");
      const gridPath = path.join(SRC, slug + ".grid.bbox.html");
      if (!fs.existsSync(gridPath)) continue;
      const cached = fs.readFileSync(gridPath, "utf8");
      const grid = heatGridOf(cached, gridTileCount(cached) || 36);
      if (grid.problems.length) { status.pending.push(`${slug}: the cached heat grid didn't read (${grid.problems[0]})`); continue; }
      byWaveHeat.set(side.wave, { heat: grid.items, ym: side.date.slice(0, 7) });
    }
    const heatScore = {};
    for (const [, x] of [...byWaveHeat.entries()].sort((a, b) => a[0] - b[0])) {
      heatScore[x.ym] = {};
      for (const [label, v] of Object.entries(x.heat)) heatScore[x.ym][label] = v.heat;
    }
    const out = {
      _about: "Unprompted issue concerns from SEC Newgate's Mood of the Nation tracking study – the B1 table ('What are the main issues facing Australians that are most important to you right now?'), an OPEN-ENDED question taking any number of mentions in the voter's own words, printed per wave as '% MENTIONING EACH' for the wave's top issues (so shares don't sum to 100, and levels sit well above the forced top-three salience the Issues panel pools – which is why nothing there reads this; banked by .build/extract-secnewgate.mjs as waves land, as a reference series). Each wave's report carries its own column and reprints its two predecessors (plus a MAR '22 anchor); sightings of a month across reports must agree. Unlike the direction question, the April 2026 Special Edition asked B1, so 2026-04 enters from the May and July 2026 reprints. The B5 extremely-important ratings later in each report are not banked; B6's political heat scores bank as heatScore. bestParty banks the G4 question, asked every wave: 'Which of the following do you think would be the best party to manage the cost of living?' – per fieldwork month the shares its table prints (alp, lnp the Coalition under the wave's own label, onp/grn options from May 2026, oth the 'Neither / someone else' row where printed) plus rest, the balance of 100: 'Can't say' alone once oth is printed, 'Neither/someone else' and 'Can't say' combined otherwise, and both inside oth before. The Issues panel's ownership pool reads the May 2026-on rows via .build/issues.mjs. heatScore banks B6, the 'Political Heat Score' off every report's one-page summary grid ('Tracking the importance of 36 national priorities', each priority a printed Label (EI:heat) tile): per fieldwork month, the % of voters choosing each of the 36 prompted priorities among the top-three issues facing Australia – B6 asks for THREE of 36, so the shares read NOTHING like the open-ended B1 mentions or the narrower forced-choice salience the Issues panel pools (RedBridge's 14, Ipsos's 19), and stay a reference series nothing mixes with. Labels are banked VERBATIM per wave, case flips and all ('…affordable university and TAFE education' through February 2026, '…University…' from May 2026); the EI half of each tile's pair is read with the heat but not banked (a % extremely-important ratings scale that mixes with nothing). month = fieldwork-end month, keying the wave's direction[] row in data/polls.json.",
      issues: Object.keys(series),
      series,
      bestParty,
      heatScore,
    };
    const outJson = JSON.stringify(out, null, 1) + "\n";
    if (!fs.existsSync(ISSUES_OUT) || fs.readFileSync(ISSUES_OUT, "utf8") !== outJson) {
      writeAtomic(ISSUES_OUT, outJson);
      console.log("wrote " + path.relative(ROOT, ISSUES_OUT));
    }
  }

  const orig = fs.readFileSync(POLLS, "utf8");
  const D = JSON.parse(orig);
  const dir = D.direction || [];
  const days = (a, b) => Math.abs(Date.parse(a) - Date.parse(b)) / 864e5;
  for (const [w, x] of [...waves.entries()].sort((a, b) => a[0] - b[0])) {
    const { meta, cols } = x;
    const last = cols[cols.length - 1];
    const row = { date: meta.date, dateStart: meta.dateStart, pollster: POLLSTER,
                  right: last.right, wrong: last.wrong, unsure: 100 - last.right - last.wrong,
                  ...(meta.sample != null ? { sample: meta.sample } : {}),
                  ...(x.page ? { url: x.page } : {}),
                  ...(x.published ? { published: x.published } : {}),
                  ...(x.method ? { methodUrl: x.method } : {}) };
    const exact = dir.findIndex((d) => d.pollster === POLLSTER && d.date === row.date);
    if (exact >= 0) {
      const cur = dir[exact];
      if (!stmts.ok && cur.methodUrl && !row.methodUrl) row.methodUrl = cur.methodUrl;   // the library was unreachable this run: keep the link we had
      if (cur.right !== row.right || cur.wrong !== row.wrong || cur.unsure !== row.unsure
          || cur.dateStart !== row.dateStart || cur.sample !== row.sample
          || cur.url !== row.url || cur.published !== row.published
          || cur.methodUrl !== row.methodUrl) {
        dir[exact] = row;
        status.healed.push(row.date);
      }
      continue;
    }
    const near = dir.findIndex((d) => d.pollster === POLLSTER && days(d.date, row.date) <= HEAL_DAYS);
    if (near >= 0) {
      if (!stmts.ok && dir[near].methodUrl && !row.methodUrl) row.methodUrl = dir[near].methodUrl;
      dir[near] = row;
      status.healed.push(row.date);
    } else {
      dir.push(row);
      status.added.push(row.date);
    }
  }
  D.direction = dir.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const next = JSON.stringify(D, null, 2) + (orig.endsWith("\n") ? "\n" : "");
  status.changed = next !== orig;
  if (status.changed) writeAtomic(POLLS, next);
  fin(status);
}

function fin(status) {
  const D = JSON.parse(fs.readFileSync(POLLS, "utf8"));
  const mine = (D.direction || []).filter((d) => d.pollster === POLLSTER)
    .sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  const quietD = mine ? Math.round((Date.now() - Date.parse(mine.date)) / 864e5) : null;
  if (!mine || quietD > QUIET_DAYS) {
    console.log("pending", `SEC Newgate|quiet: ${mine ? `no wave since fieldwork closed ${mine.date}` : "no wave on file"} – is the media search still finding the reports?`);
    status.stale.push("SEC Newgate|quiet");
  }
  for (const p of status.pending) console.log("pending", p);
  for (const w of status.warnings) console.log("warning", w);
  console.log("SECNEWGATE_STATUS " + JSON.stringify(status));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
