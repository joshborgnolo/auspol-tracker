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
     url = the report's article page, published = its upload time }
   and the array re-sorted by date, like every house's writer. A rerun
   heals a row of the same wave within HEAL_DAYS of a prior entry, and
   rewrites any row of an exact date whose figures, span or n moved. The
   newest report's full series is cross-checked against every earlier
   wave's own endpoint (the series only reprints history; a publish-day
   correction to an old point would show here).

   Cache: .build/secnewgate-src/<slug>.txt (pdftotext -layout, the whole
   report), <slug>.bbox.html (pdftotext -bbox, the direction page only),
   <slug>.json ({ pdf, wave, date, dateStart, sample, url, published }).
   Written once when
   first fetched and never touched again, so a run that finds nothing new
   changes nothing. A page or PDF that won't load is a warning, not a
   failure: the cache stays; a report that IS cached but won't read is
   pending and fails the run that landed it, once anything else is pushed.

   Two parse-only banks are rebuilt from the cache each run (nothing on
   the site reads either): data/sec-direction-states.json banks the
   per-state direction table off the bbox (SECNEWGATE_STATES redirects),
   and data/sec-issues.json banks B1's "% MENTIONING EACH"
   unprompted-concerns table off the whole-report -layout text
   (SECNEWGATE_ISSUES redirects; the B5/B6 priority tiles are not
   banked). Each reprints its trailing waves, so a conflict between
   reports for one month is a revision and goes to warnings.

   Usage: node .build/extract-secnewgate.mjs [--force]  (--force refetches)
   SECNEWGATE_SRC_DIR redirects the cache.
   Last line: SECNEWGATE_STATUS {"changed":…,"added":[…],"healed":[…],
   "pending":[…],"stale":[…],"warnings":[…]} */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { TRACKER_UA, MONTHS, writeAtomic } from "./extract-common.mjs";

const FORCE = process.argv.includes("--force");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = process.env.SECNEWGATE_SRC_DIR || path.join(ROOT, ".build", "secnewgate-src");
const POLLS = process.env.SECNEWGATE_POLLS || path.join(ROOT, "data", "polls.json");
const STATES_OUT = process.env.SECNEWGATE_STATES || path.join(ROOT, "data", "sec-direction-states.json");
const ISSUES_OUT = process.env.SECNEWGATE_ISSUES || path.join(ROOT, "data", "sec-issues.json");
const API = "https://www.secnewgate.com.au/wp-json/wp/v2/media?search=Mood&per_page=100";
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
   candidate carries the item's article page and upload time (site-local)
   for the wave's release link and publish stamp. */
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
    const page = it.link || null;
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
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "June", "Jul", "Aug", "Sep", "Sept", "Oct", "Nov", "Dec"];
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
   May and July 2026 reprints – the special itself is never cached). The
   table is read from the whole-report -layout TEXT – the bbox cache holds
   only the direction page – where each MON column header trailed by its
   ’YY on a line below gives the column's right edge, and each row prints
   its label then one bare-integer cell right-aligned on every column.
   The B5/B6 objective-priority ratings on later pages are NOT banked. */
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

const slugOf = (url) => decodeURIComponent(url.split("/").pop())
  .replace(/\.pdf$/i, "").replace(/[^A-Za-z0-9._-]+/g, "_");

async function main() {
  const status = { changed: false, added: [], healed: [], pending: [], stale: [], warnings: [] };
  fs.mkdirSync(SRC, { recursive: true });

  let items;
  try { items = JSON.parse((await get(API)).toString("utf8")); }
  catch (e) {
    console.log("warning media API: " + e.message);
    status.warnings.push(`media API: ${e.message}`);
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

  const waves = new Map();   // wave ordinal -> { slug, meta, cols: […], page, published }
  for (const g of groups) {
    let done = false;
    for (const cand of done ? [] : g.urls) {
      const url = cand.url;
      const slug = slugOf(url);
      const txtPath = path.join(SRC, slug + ".txt");
      const bboxPath = path.join(SRC, slug + ".bbox.html");
      let text, bbox;
      if (!FORCE && fs.existsSync(txtPath) && fs.existsSync(bboxPath)) {
        text = fs.readFileSync(txtPath, "utf8");
        bbox = fs.readFileSync(bboxPath, "utf8");
      } else {
        let buf;
        try { buf = await get(url); }
        catch (e) { status.warnings.push(`${slug}: ${e.message}`); continue; }
        if (buf.subarray(0, 5).toString("latin1") !== "%PDF-") { status.warnings.push(`${slug}: not a PDF`); continue; }
        try {
          text = pdfToText(buf, slug, ["-layout"]);
          const meta0 = methodologyOf(text);
          if (!meta0) break;   // not a tracking wave (a special): keep nothing
          const page = directionPageOf(text);
          if (!page) { status.pending.push(`${g.ym}: the report has no national direction chart page`); done = true; break; }
          bbox = pdfToText(buf, slug, ["-f", String(page), "-l", String(page), "-bbox"]);
        } catch (e) { status.warnings.push(`${slug}: ${e.message}`); continue; }
        fs.writeFileSync(txtPath + ".tmp", text); fs.renameSync(txtPath + ".tmp", txtPath);
        fs.writeFileSync(bboxPath + ".tmp", bbox); fs.renameSync(bboxPath + ".tmp", bboxPath);
        console.log(`cached report ${slug}`);
      }
      const meta = methodologyOf(text);
      if (!meta) break;        // cached pre-refactor special: set aside
      if (!meta.date) { status.pending.push(`${g.ym}: ${meta.problems.join("; ")}`); done = true; break; }
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
      fs.writeFileSync(path.join(SRC, slug + ".json"),
        JSON.stringify({ pdf: url, wave: meta.wave, date: meta.date, dateStart: meta.dateStart, sample: meta.sample,
          ...(cand.page ? { url: cand.page } : {}), ...(cand.published ? { published: cand.published } : {}) }, null, 1) + "\n");
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
      waves.set(meta.wave, { slug, meta, cols: chart.columns, page: cand.page, published: cand.published, table, concerns });
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
    const out = {
      _about: "Unprompted issue concerns from SEC Newgate's Mood of the Nation tracking study – the B1 table ('What are the main issues facing Australians that are most important to you right now?'), an OPEN-ENDED question taking any number of mentions in the voter's own words, printed per wave as '% MENTIONING EACH' for the wave's top issues (so shares don't sum to 100, and levels sit well above the forced top-three salience the Issues panel pools – which is why nothing there reads this; banked by .build/extract-secnewgate.mjs as waves land, as a reference series). Each wave's report carries its own column and reprints its two predecessors (plus a MAR '22 anchor); sightings of a month across reports must agree. Unlike the direction question, the April 2026 Special Edition asked B1, so 2026-04 enters from the May and July 2026 reprints. The B5/B6 objective-priority ratings later in each report are not banked. month = fieldwork-end month, keying the wave's direction[] row in data/polls.json.",
      issues: Object.keys(series),
      series,
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
                  ...(x.published ? { published: x.published } : {}) };
    const exact = dir.findIndex((d) => d.pollster === POLLSTER && d.date === row.date);
    if (exact >= 0) {
      const cur = dir[exact];
      if (cur.right !== row.right || cur.wrong !== row.wrong || cur.unsure !== row.unsure
          || cur.dateStart !== row.dateStart || cur.sample !== row.sample
          || cur.url !== row.url || cur.published !== row.published) {
        dir[exact] = row;
        status.healed.push(row.date);
      }
      continue;
    }
    const near = dir.findIndex((d) => d.pollster === POLLSTER && days(d.date, row.date) <= HEAL_DAYS);
    if (near >= 0) {
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
