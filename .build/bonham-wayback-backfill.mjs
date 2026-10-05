#!/usr/bin/env node
// Backfill of Kevin Bonham's as-published sidebar figures from the Internet
// Archive's captures of kevinbonham.blogspot.com, merged into
// data/bonham-2pp.json with the same row shapes the live extractor
// (.build/extract-bonham-sidebar.mjs) grows forward. The hero chart draws
// his lines from this record, so how complete it is decides how true they
// are.
//
// HOW IT WORKS
// The sidebar rides EVERY page of the blog, and the archive captures pages
// right across it (old posts, label pages, month archives) far more often
// than it captures the front page: from June to September 2026 the front
// page was captured on 2 days and the site on 87. Reading the front page
// alone left a two-month hole in his record
// (.matilda/outside-estimates-review-2026-10-05.md). So the CDX query asks
// for the whole domain (HTML 200s), groups the captures by Hobart day, and
// replays up to --per-day of them (the day's first, its last and one
// between), which catches his same-day corrections and most days he updated
// twice. Each replay uses the id_ modifier (original bytes, no Wayback
// chrome) and the SHARED parser (.build/bonham-sidebar-shared.mjs), so the
// two readers can never drift on what the widget looks like. Mobile renders
// (?m=1) and feeds are skipped: neither carries the sidebar.
//
// WHAT A ROW IS — the live extractor's contract:
//   series: [date, alpShare] keyed on HIS "Last update D Mon" stamp, not
//     the capture day, so a week of captures between his updates collapses
//     to nothing. Same stamp, two readings: the later capture wins (he
//     corrects in place). A stamp may not run ahead of the capture's own
//     Hobart date. That guard is what skips the archive's mislabeled
//     captures (a front-page row keyed 2025-09-26 carries a 5-Oct widget);
//     it compares Hobart dates, because a UTC comparison also threw out his
//     genuine morning updates.
//   shadow: change points of his One Nation figure (shadowChange in the
//     shared module), rebuilt from the captures in time order. Within the
//     span the captures cover they replace the file's rows; rows after the
//     last capture (the live extractor's) are kept.
//
// ROBUSTNESS — Wayback captures are unruly, so unlike the live extractor
// a failed parse here is counted, not fatal: pre-widget-era pages, dead
// replays and mangled partial captures are skips. Only a run with zero
// parseable captures faults (exit 2), since that means the parser no longer
// recognises the widget at all. Fetches: browser UA, 45 s timeout, three
// attempts, a polite pause between replays, at most --concurrency at once.
// Writes atomic via writeJsonAtomic; default run is a dry report.
//
// Usage:
//   node .build/bonham-wayback-backfill.mjs            dry run: report, no write
//   node .build/bonham-wayback-backfill.mjs --apply    merge, write data/bonham-2pp.json
//   --from YYYY-MM-DD   first capture day (default 2025-10-01, the aggregate's first live month)
//   --to YYYY-MM-DD     last capture day (default today, Hobart)
//   --per-day N         replays per capture day, 1-3 (default 3)
//   --concurrency N     replays in flight, 1-4 (default 2)
//   OUT_JSON=<path>     override the output path (tests)
// Exit: 0 ran (see KB_BACKFILL), 1 CDX unreachable, 2 no parseable captures.

import { readFileSync, existsSync } from "node:fs";
import { writeJsonAtomic } from "./atomic-write.mjs";
import { stripTags, parseSidebar, stampDate, figureOk, hobartIso, waybackHobartIso, shadowChange, changePoints } from "./bonham-sidebar-shared.mjs";

const DOMAIN = "kevinbonham.blogspot.com";
const OUT = process.env.OUT_JSON || "data/bonham-2pp.json";
const UA = "Mozilla/5.0 (auspol-tracker comparators; github.com/joshborgnolo/auspol-tracker)";

// ---- args ------------------------------------------------------------------
const argv = process.argv.slice(2);
const APPLY = argv.includes("--apply");
const argOf = (k, fb) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : fb);
const FROM = argOf("--from", "2025-10-01");
const TO = argOf("--to", hobartIso(new Date()));
const PER_DAY = Math.max(1, Math.min(3, +argOf("--per-day", 3) || 3));
const CONC = Math.max(1, Math.min(4, +argOf("--concurrency", 2) || 2));

const status = { changed: false, captures: 0, days: 0, replayed: 0, parsed: 0, recognised: 0, skipped: 0, failures: 0, added: 0, replaced: 0, shadowRows: 0, note: null, error: null };
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

// ---- CDX list: every page of the blog, grouped by Hobart day ----------------
let cdx;
try {
  const url = `https://web.archive.org/cdx/search/cdx?url=${DOMAIN}&matchType=domain&from=${compact(FROM)}&to=${compact(TO)}`
    + `&output=json&fl=timestamp,original&filter=statuscode:200&filter=mimetype:text/html&limit=200000`;
  cdx = JSON.parse(await fetchText(url));
} catch (e) { status.error = `CDX query failed: ${e.message}`; done(1); }
const listed = cdx.slice(1).filter(([, u]) => !/[?&]m=1\b/.test(u) && !/\/feeds\//.test(u));
status.captures = listed.length;
if (!listed.length) { status.error = `CDX returned no captures for ${DOMAIN} in ${FROM}..${TO}`; done(2); }
const byDay = new Map();
for (const c of listed) {
  const day = waybackHobartIso(c[0]);
  if (day < FROM || day > TO) continue;
  (byDay.get(day) || byDay.set(day, []).get(day)).push(c);
}
status.days = byDay.size;
const picks = [];
for (const caps of byDay.values()) {
  caps.sort((a, b) => (a[0] < b[0] ? -1 : 1));
  const want = [caps[0], caps[caps.length - 1], caps[Math.floor(caps.length / 2)]].slice(0, PER_DAY);
  const hours = new Set();
  for (const c of want) {               // two replays inside one hour almost never differ
    const h = c[0].slice(0, 10);
    if (!hours.has(h)) { hours.add(h); picks.push(c); }
  }
}

// ---- replay + parse -----------------------------------------------------------
const results = [];
let nextPick = 0;
async function worker() {
  while (nextPick < picks.length) {
    const [ts, original] = picks[nextPick++];
    try {
      const html = await fetchText(`https://web.archive.org/web/${ts}id_/${original}`);
      results.push({ ts, parsed: parseSidebar(stripTags(html)) });
    } catch {
      results.push({ ts, failed: true });  // a dead replay is a skip, never fatal
    }
    await sleep(500);
  }
}
await Promise.all(Array.from({ length: CONC }, worker));
status.replayed = results.length;

const rows = new Map();   // stampDate -> { alp, ts }
const shadow = [];        // change points, rebuilt from the captures in time order
let lastSeen = null;
for (const r of results.sort((a, b) => (a.ts < b.ts ? -1 : 1))) {
  if (r.failed) { status.failures++; continue; }
  const p = r.parsed;
  if (!p || !figureOk(p)) { status.skipped++; continue; }
  status.recognised++; // parseable widget, even if its stamp then fails the date guard
  const seen = waybackHobartIso(r.ts);
  const date = stampDate(p.stamp, +seen.slice(0, 4), +seen.slice(5, 7));
  if (!date || date > seen) { status.skipped++; continue; }
  const prev = rows.get(date);
  rows.set(date, { alp: p.alp, ts: r.ts });
  if (!prev || prev.alp !== p.alp) status.parsed++;
  if (p.shadow != null) shadowChange(shadow, p.shadow, date, seen);
  lastSeen = seen;
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
doc.series.sort((a, b) => (a[0] < b[0] ? -1 : 1));
const shadowWas = JSON.stringify(doc.shadow);
const byDate = (a, b) => (a[0] < b[0] ? -1 : 1);
if (shadow.length) {
  const kept = doc.shadow.filter((r) => r[0] < shadow[0][0] || r[0] > lastSeen);
  doc.shadow = changePoints([...kept, ...shadow].sort(byDate));
} else doc.shadow = changePoints(doc.shadow.sort(byDate));
status.shadowRows = doc.shadow.length;
status.changed = status.added > 0 || status.replaced > 0 || JSON.stringify(doc.shadow) !== shadowWas;

if (APPLY && status.changed) {
  doc.updated = new Date().toISOString().slice(0, 16) + "Z";
  writeJsonAtomic(OUT, doc);
}
const first = doc.series[0]?.[0], last = doc.series.at(-1)?.[0];
status.note = `${doc.series.length} stamp rows held (${first} .. ${last}), ${doc.shadow.length} shadow change points${APPLY ? "" : " (dry run: nothing written)"}`;
done(0);
