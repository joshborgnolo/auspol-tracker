#!/usr/bin/env node
// One-off backfill of Kevin Bonham's as-published sidebar figures from the
// Internet Archive's captures of kevinbonham.blogspot.com, merged into
// data/bonham-2pp.json with the same row shape the live extractor
// (.build/extract-bonham-sidebar.mjs) grows forward. The record matters
// because the hero chart pins its Bonham-method reconstruction
// (bonham-replica.mjs) against his real published stamps.
//
// HOW IT WORKS
// The sidebar rides every page of the blog, so the front page's captures
// are enough. The CDX API lists them (one per day courtesy of
// collapse=timestamp:8); we sample every --every-days days (a stamp can
// only have changed between neighbouring samples if the figure did, and
// his update cadence is weekly-ish), replay each capture with the id_
// modifier (original bytes, no Wayback chrome), and parse the widget with
// the SHARED parser (.build/bonham-sidebar-shared.mjs) so the two readers
// can never drift on what the widget looks like.
//
// WHAT A ROW IS — exactly the live extractor's contract: [date, alpShare]
// keyed on HIS "Last update D Mon" stamp (not the capture day), so a week
// of captures between his updates collapses to nothing. A changed figure
// on a held stamp date replaces it. Year inference uses the capture's
// calendar context (stamp month ahead of capture month = previous
// December tail), the same rule the live extractor applies with NOW.
//
// ROBUSTNESS — Wayback captures are unruly, so unlike the live extractor
// a failed parse here is counted, not fatal: pre-widget-era pages and
// mangled partial captures are skips; only a run with zero parseable
// captures faults (exit 2), since that means the parser no longer
// recognises the widget at all. Fetches: browser UA, 45 s timeout, three
// attempts, polite delay between captures. Writes atomic via
// writeJsonAtomic; default run is a dry report.
//
// Usage:
//   node .build/bonham-wayback-backfill.mjs            dry run: report, no write
//   node .build/bonham-wayback-backfill.mjs --apply    merge, write data/bonham-2pp.json
//   --from YYYY-MM-DD   first capture day (default 2025-10-01, the aggregate's first term live month)
//   --to YYYY-MM-DD     last capture day (default today)
//   --every-days N      sample every Nth daily capture (default 1: captures are collapsed
//                       to one per day by the CDX query, so thinning mostly costs rows)
//   OUT_JSON=<path>     override the output path (tests)
// Exit: 0 ran (see KB_BACKFILL), 1 CDX/replay unreachable, 2 no parseable captures.

import { readFileSync, existsSync } from "node:fs";
import { writeJsonAtomic } from "./atomic-write.mjs";
import { stripTags, parseSidebar, stampDate, figureOk } from "./bonham-sidebar-shared.mjs";

const TARGET = "kevinbonham.blogspot.com/";
const OUT = process.env.OUT_JSON || "data/bonham-2pp.json";
const UA = "Mozilla/5.0 (auspol-tracker comparators; github.com/joshborgnolo/auspol-tracker)";

// ---- args ------------------------------------------------------------------
const argv = process.argv.slice(2);
const APPLY = argv.includes("--apply");
const argOf = (k, fb) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : fb);
const TODAY = new Date().toISOString().slice(0, 10);
const FROM = argOf("--from", "2025-10-01");
const TO = argOf("--to", TODAY);
const EVERY = Math.max(1, +argOf("--every-days", 1) || 1);

const status = { changed: false, captures: 0, parsed: 0, recognised: 0, skipped: 0, failures: 0, added: 0, replaced: 0, note: null, error: null };
const done = (code) => { console.log("KB_BACKFILL " + JSON.stringify(status)); process.exit(code); };

async function fetchText(url) {
  let lastErr = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "user-agent": UA, "cache-control": "no-cache" },
        signal: AbortSignal.timeout(45_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return await res.text();
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, attempt * 5000));
    }
  }
  throw lastErr;
}
const compact = (iso) => iso.replaceAll("-", "");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- CDX list ---------------------------------------------------------------
let cdx;
try {
  const url = `https://web.archive.org/cdx/search/cdx?url=${TARGET}&from=${compact(FROM)}&to=${compact(TO)}&output=json&fl=timestamp,original&filter=statuscode:200&collapse=timestamp:8`;
  cdx = JSON.parse(await fetchText(url));
} catch (e) { status.error = `CDX query failed: ${e.message}`; done(1); }
const captures = cdx.slice(1).filter((_, i) => i % EVERY === 0);
status.captures = captures.length;
if (!captures.length) { status.error = `CDX returned no captures for ${TARGET} in ${FROM}..${TO}`; done(2); }

// ---- replay + parse ---------------------------------------------------------
const rows = new Map();   // stampDate -> alp
const shadowRows = new Map(); // captureDate -> shadowAlp
for (const [ts] of captures) {
  const capIso = `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}`;
  let html;
  try {
    html = await fetchText(`https://web.archive.org/web/${ts}id_/${TARGET}`);
  } catch {
    status.failures++; // a dead capture is a skip, never fatal
    await sleep(300);
    continue;
  }
  const parsed = parseSidebar(stripTags(html));
  if (!parsed || !figureOk(parsed)) { status.skipped++; await sleep(300); continue; }
  status.recognised++; // parseable widget, even if its stamp then fails the date<=capture guard
  const date = stampDate(parsed.stamp, +ts.slice(0, 4), +ts.slice(4, 6));
  if (date && date <= capIso) {
    const prev = rows.get(date);
    // same stamp, two readings: keep the one from the NEWER capture — he
    // corrects in place, and a later replay holds the corrected figure
    rows.set(date, { alp: parsed.alp, capTs: ts });
    if (prev && prev.alp === parsed.alp) status.skipped++; else status.parsed++;
    if (parsed.shadow != null) shadowRows.set(capIso, parsed.shadow);
  } else status.skipped++;
  await sleep(300);
}
if (!status.recognised && !status.failures) { status.error = "no capture carried a parseable widget — parser no longer recognises the page"; done(2); }

// ---- merge ------------------------------------------------------------------
const doc = existsSync(OUT)
  ? JSON.parse(readFileSync(OUT, "utf8"))
  : { source: "Kevin Bonham's sidebar figures, kevinbonham.blogspot.com (as published)", series: [], shadow: [] };
if (!Array.isArray(doc.series)) doc.series = [];
if (!Array.isArray(doc.shadow)) doc.shadow = [];

for (const [date, { alp }] of rows) {
  const i = doc.series.findIndex((r) => r[0] === date);
  if (i >= 0) { if (doc.series[i][1] !== alp) { doc.series[i][1] = alp; status.replaced++; } }
  else { doc.series.push([date, alp]); status.added++; }
}
for (const [date, alp] of shadowRows) {
  const i = doc.shadow.findIndex((r) => r[0] === date);
  if (i < 0) doc.shadow.push([date, alp]);
}
doc.series.sort((a, b) => (a[0] < b[0] ? -1 : 1));
doc.shadow.sort((a, b) => (a[0] < b[0] ? -1 : 1));
status.changed = status.added > 0 || status.replaced > 0;

if (APPLY && status.changed) {
  doc.updated = new Date().toISOString().slice(0, 16) + "Z";
  writeJsonAtomic(OUT, doc);
}
const first = doc.series[0]?.[0], last = doc.series.at(-1)?.[0];
status.note = `${doc.series.length} stamp rows held (${first} .. ${last})${APPLY ? "" : " (dry run: nothing written)"}`;
done(0);
