#!/usr/bin/env node
// Kevin Bonham's sidebar aggregate — keeps the tracker's record of his
// AS-PUBLISHED figures growing forward, so the hero chart can pin its
// Bonham-method reconstruction (bonham-replica.mjs) against his real
// published stamps, the honest version of asking "how close did we get?".
//
// WHAT IS SCRAPED
// Bonham publishes no series, only the current figures, in the sidebar of
// every page of kevinbonham.blogspot.com: the "Federal 2PP Polling
// Aggregate" widget (a figure like "52.3-47.7 TO ALP" plus a
// "Last update 30 Sep (Essential)" stamp) and the "One Nation Shadow-2PP
// Estimate" widget below it. The monthly archive page
// (kevinbonham.blogspot.com/YYYY/MM/) is a static fetch that always
// carries the sidebar, so one plain curl a week keeps the record whole;
// the history before install day is the one-off Wayback backfill's job
// (.build/bonham-wayback-backfill.mjs), which writes the same file with
// the same row shape. The One Nation series rides AS PUBLISHED wherever
// the page draws it: it was "recorded but never drawn" until the
// 2026-10-02 hero overlay took it onto the Labor v One Nation contest.
// Its basis, from his methods-page update log: introduced 28 Jan 26 as
// a regression trend estimate that "uses my estimate of 2025
// preferences" (his estimate: 72% of Coalition and 9% of Greens voters
// flow to One Nation vs Labor), pooled simply — since 11 Mar 26, the
// average of the ten most recent polls with at most two per pollster,
// none of his aggregate's weighting or house-effect levelling. Like the
// Coalition line it is PRIMARY-DERIVED — "my conversion … is the figure
// I use in my Labor vs Coalition 2PP aggregate and my Labor vs One
// Nation 2PP estimate" (his 1 Jul 26 post). (The five pollsters'
// published shadow pairs ARE respondent-allocated — his Sep 2026 "flat
// field" post critiques them; they are not his inputs.) The shadow
// differs from our frozen-flow implied pairing in the flow table (his
// own estimates vs the counted 2025 one) and in pooling, not in basis
// family — and it stays un-rebuildable from our side because his exact
// per-wave converted figures are never published.
//
// WHAT A ROW IS
// [date, alpShare] where the date is HIS "Last update D Mon" stamp, not
// the fetch day: a week of fetches between his updates appends nothing.
// A changed figure on a stamp date we already hold REPLACES it (he
// occasionally corrects a value). Year is inferred from the page being
// read (his stamp carries no year): the stamp month is the page month or
// the one just before; a stamp month AHEAD of the page month means last
// year's December tail.
//
// ROBUSTNESS
//   * fetch: browser UA, 45 s timeout, three attempts with backoff; on
//     failure the run is inconclusive (exit 1) — the existing data file is
//     never touched by a failed run.
//   * shape: the page must carry the exact widget title, a parseable X-Y
//     figure summing to 100 within SANE_TOL, an ALP share inside
//     ALP_RANGE, and a parseable stamp. An old-era page layout (the frozen
//     previous-term widget used different title casing) simply yields no
//     figure — that is a skip, not a fault. A page that matches NONE of
//     the guard expectations while carrying the site chrome is a fault
//     (exit 2), so a restructure never poisons the file silently.
//   * writes: atomic via writeJsonAtomic; default run is a dry report.
//
// Usage:
//   node .build/extract-bonham-sidebar.mjs            dry run: report, no write
//   node .build/extract-bonham-sidebar.mjs --apply    append/merge, write data/bonham-2pp.json
//   node .build/extract-bonham-sidebar.mjs --check    alias of the dry run
//   --page <url-or-file>  read this page instead of the live monthly archive
//   --now <ISO>           pin the clock (tests)
//   OUT_JSON=<path>       override the output path (tests)
// Exit: 0 ran (see KB_STATUS), 1 fetch failed, 2 page failed a shape guard.
// Last stdout line is always `KB_STATUS {json}` for the wrapper.

import { readFileSync, existsSync } from "node:fs";
import { writeJsonAtomic } from "./atomic-write.mjs";
import { stripTags, parseSidebar, stampDate, figureOk } from "./bonham-sidebar-shared.mjs";

const SITE = "https://kevinbonham.blogspot.com";
const OUT = process.env.OUT_JSON || "data/bonham-2pp.json";

// ---- args ------------------------------------------------------------------
const argv = process.argv.slice(2);
const APPLY = argv.includes("--apply");
const argOf = (k) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : null);
const PAGE_ARG = argOf("--page");
const NOW = argOf("--now") ? new Date(argOf("--now")) : new Date();

const status = { changed: false, source: null, figure: null, stamp: null, shadow: null, note: null, error: null };
const done = (code) => { console.log("KB_STATUS " + JSON.stringify(status)); process.exit(code); };

const liveUrl = (d) =>
  `${SITE}/${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/`;

function guard(parsed) {
  if (!figureOk(parsed))
    throw new Error(`widget failed its figure/stamp guards (${JSON.stringify(parsed)}) — page structure changed`);
}

// ---- fetch -----------------------------------------------------------------
async function fetchPage(url) {
  let lastErr = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "user-agent": "Mozilla/5.0 (auspol-tracker comparators; github.com/joshborgnolo/auspol-tracker)", "accept-encoding": "gzip", "cache-control": "no-cache" },
        signal: AbortSignal.timeout(45_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      if (text.length < 100_000) throw new Error(`page implausibly short (${text.length} bytes) — scraped the wrong thing`);
      return text;
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, attempt * 5000));
    }
  }
  throw new Error(`page unreachable: ${lastErr.message}`);
}

// ---- main ------------------------------------------------------------------
const pageRef = PAGE_ARG || liveUrl(NOW);
status.source = pageRef;
let html;
try {
  html = PAGE_ARG && !/^https?:/.test(PAGE_ARG) ? readFileSync(PAGE_ARG, "utf8") : await fetchPage(pageRef);
} catch (e) { status.error = e.message; done(1); }

const parsed = parseSidebar(stripTags(html));
if (!parsed) {
  /* no widget at all: acceptable ONLY on a live page older than the aggregate's
     life, which a live run never is — so for the live extractor this is a
     fault (the backfill, which reads old captures, treats null as a skip of
     its own and never calls this script's main) */
  status.error = "no 'Federal 2PP Polling Aggregate' widget on the page — page structure changed";
  done(2);
}
try { guard(parsed); } catch (e) { status.error = e.message; done(2); }

const pageY = NOW.getUTCFullYear(), pageM = NOW.getUTCMonth() + 1;
const date = stampDate(parsed.stamp, pageY, pageM);
if (!date || date > NOW.toISOString().slice(0, 10)) {
  status.error = `stamp resolves to ${date}, missing or in the future — page structure changed`;
  done(2);
}
status.figure = parsed.alp;
status.stamp = date;
status.shadow = parsed.shadow;

const doc = existsSync(OUT)
  ? JSON.parse(readFileSync(OUT, "utf8"))
  : { source: "Kevin Bonham's sidebar figures, kevinbonham.blogspot.com (as published)", series: [], shadow: [] };
if (!Array.isArray(doc.series)) doc.series = [];
if (!Array.isArray(doc.shadow)) doc.shadow = [];

const upsert = (rows, row) => {
  const i = rows.findIndex((r) => r[0] === row[0]);
  if (i >= 0) { if (rows[i][1] !== row[1]) { rows[i] = row; return true; } return false; }
  rows.push(row);
  return true;
};
const chgA = upsert(doc.series, [date, parsed.alp]);
const chgB = parsed.shadow != null ? upsert(doc.shadow, [NOW.toISOString().slice(0, 10), parsed.shadow]) : false;
doc.series.sort((a, b) => (a[0] < b[0] ? -1 : 1));
doc.shadow.sort((a, b) => (a[0] < b[0] ? -1 : 1));
status.changed = chgA || chgB;
status.note = chgA ? `row ${date} → ${parsed.alp}` : `stamp ${date} already held (${parsed.alp})`;

if (APPLY && status.changed) {
  doc.updated = NOW.toISOString().slice(0, 16) + "Z";
  writeJsonAtomic(OUT, doc);
}
if (!APPLY && status.changed) status.note += " (dry run: nothing written)";
done(0);
