#!/usr/bin/env node
// BludgerTrack 2PP aggregate series — mirrors the dated trend points of
// BludgerTrack's classic ALP-v-Coalition 2PP aggregate into a data file the
// page can draw as a comparator line against our own estimate.
//
// WHY THIS EXISTS
// The hero 2PP chart carries external comparators so a reader can see our
// estimate next to the other published aggregates. BludgerTrack's series is
// the easy one to get right: its page (pollbludger.net/fed2028/bludgertrack/)
// is a shell that renders xml/current.xml, and the feed's federal/charts
// block holds the dated aggregate trend points for the whole term — issued
// by the source itself, no scraping, no JS. This script is deliberately
// separate from extract-pollbludger.mjs, which reads a DIFFERENT part of the
// same feed (federal/table, the per-poll records, filed as provisional rows);
// the two share the feed and its cache and nothing else. What is taken here
// is the classic-pairing 2PP trend only (ALP2out). BludgerTrack's ALP–ON
// figures are respondent-allocated shadow pairs and are NOT comparable to
// our frozen-flow implied pairing, so they are never mirrored.
//
// ALP2out, not ALP2in (fixed 2026-10-02, audit .matilda/bt-line-accuracy-
// 2026-10.md): the feed's own page draws the outliers-EXCLUDED series as its
// 3px trend line and prints it as the summary-table headline 2PP (js/voting.js
// series 2/3 = line; ALP2in/LNC2in ride as scatter dots — the per-release
// readings). The first cut mirrored ALP2in, i.e. the dots, which diverged from
// his line by mean 0.97 / up to 3.1pts (and read 52.4 to his published 52.2).
// Note ALP2out BACK-CASTS: old values shift up to ~2pts as new polls land
// (ALP2in was ~immutable; Wayback 2025-09 → 2026-05: every 2out point moved),
// so this mirror MUST refresh on a schedule — pollbludger-updater.sh runs it
// four times a day against the same cached feed.
//
// ROBUSTNESS, mirroring the other feed readers:
//   * fetch: browser UA, 45 s timeout, three attempts with backoff; on
//     failure the cached copy (.build/pollbludger-src/current.xml, the same
//     file extract-pollbludger maintains) is used if under CACHE_MAX_DAYS
//     old, flagged stale, else the run is inconclusive (exit 1).
//   * shape: the feed must carry a root date, a federal/charts block with at
//     least MIN_POINTS points, every point an ALP2in/LNC2in pair summing to
//     100, values in range, dates non-decreasing, and the series must start
//     within START_MAX of the 2025 election — a canary that the block and
//     the parse are what this script expects. Any failure → exit 2.
//   * writes: atomic (.tmp + rename) via writeJsonAtomic, and the cache is
//     refreshed only after the guards pass. Default run is a dry report;
//     --apply writes.
//
// Usage:
//   node .build/extract-bludgertrack.mjs            dry run: report, no write
//   node .build/extract-bludgertrack.mjs --apply    write data/bludgertrack-2pp.json
//   node .build/extract-bludgertrack.mjs --check    alias of the dry run
//   --xml <file>     read the feed from a file (tests); --now <ISO> pins the clock
//   OUT_JSON=<path>  override the output path (tests); PB_SRC_DIR=<dir> the cache dir
// Exit: 0 ran (see BT_STATUS), 1 fetch failed with no usable cache, 2 feed
// failed a shape guard. Last stdout line is always `BT_STATUS {json}`.

import { readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { writeJsonAtomic } from "./atomic-write.mjs";

const FEED = "https://www.pollbludger.net/fed2028/bludgertrack/xml/current.xml";
const SRC_DIR = process.env.PB_SRC_DIR || ".build/pollbludger-src"; // shared with extract-pollbludger
const CACHE = `${SRC_DIR}/current.xml`;
const OUT = process.env.OUT_JSON || "data/bludgertrack-2pp.json";

const MIN_POINTS = 100;       // federal chart points the feed must carry
const CACHE_MAX_DAYS = 3;     // a cached feed older than this is no fallback
const START_MAX = "2025-06-01"; // series must begin within a month of the election
const SUM_TOL = 0.1;          // ALP2in + LNC2in ~ 100 (feed carries 9dp)

// ---- args ------------------------------------------------------------------
const argv = process.argv.slice(2);
const APPLY = argv.includes("--apply");
const argOf = (k) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : null);
const XML_FILE = argOf("--xml");
const NOW = argOf("--now") ? new Date(argOf("--now")) : new Date();

const DAY = 86400000;
const r1 = (x) => Math.round(x * 10) / 10;
const status = { changed: false, source: null, stale: false, feedDate: null, points: 0, notes: [], error: null };
const done = (code) => { console.log("BT_STATUS " + JSON.stringify(status)); process.exit(code); };

// ---- fetch -------------------------------------------------------------------
async function fetchFeed() {
  if (XML_FILE) { status.source = XML_FILE; return readFileSync(XML_FILE, "utf8"); }
  let lastErr = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(FEED, {
        headers: { "user-agent": "Mozilla/5.0 (auspol-tracker comparators; github.com/joshborgnolo/auspol-tracker)", "cache-control": "no-cache" },
        signal: AbortSignal.timeout(45_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      if (text.length < 50_000) throw new Error(`feed implausibly short (${text.length} bytes)`);
      status.source = "live";
      return text;
    } catch (e) {
      lastErr = e;
      status.notes.push(`fetch attempt ${attempt}: ${e.message}`);
      await new Promise((r) => setTimeout(r, attempt * 5000));
    }
  }
  if (existsSync(CACHE)) {
    const age = (NOW - statSync(CACHE).mtimeMs) / DAY;
    if (age <= CACHE_MAX_DAYS) {
      status.source = "cache"; status.stale = true;
      status.notes.push(`using cached feed (${age.toFixed(1)}d old) after fetch failure: ${lastErr.message}`);
      return readFileSync(CACHE, "utf8");
    }
    status.notes.push(`cached feed too old (${age.toFixed(1)}d)`);
  }
  throw new Error(`feed unreachable: ${lastErr.message}`);
}

// ---- parse ---------------------------------------------------------------------
const mdy = (s) => { const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s || ""); return m ? `${m[3]}-${m[1]}-${m[2]}` : null; };
function parseFeed(xml) {
  const root = /<root\s+date="([^"]+)"/.exec(xml);
  if (!root) throw new Error("no <root date=…> — feed structure changed");
  status.feedDate = root[1];
  const fs = xml.indexOf("<federal"), fe = xml.indexOf("</federal>");
  if (fs < 0 || fe <= fs) throw new Error("no <federal> section — feed structure changed");
  const fed = xml.slice(fs, fe);
  const ci = fed.indexOf("<charts"), ce = fed.indexOf("</charts>");
  if (ci < 0 || ce <= ci) throw new Error("no federal <charts> block — feed structure changed");
  const raw = [];
  for (const m of fed.slice(ci, ce).matchAll(/<point\s+([^>]*)>([\s\S]*?)<\/point>/g)) {
    const attrs = Object.fromEntries([...m[1].matchAll(/(\w+)="([^"]*)"/g)].map((a) => [a[1], a[2]]));
    const date = mdy(attrs.date);
    const vals = {};
    for (const v of m[2].matchAll(/<(\w+)>([^<]*)<\/\1>/g)) vals[v[1]] = v[2].trim() === "" ? null : Number(v[2]);
    const a = vals.ALP2out, l = vals.LNC2out;
    if (!date) throw new Error(`unparseable point date "${attrs.date}" — feed structure changed`);
    if (a == null || l == null) throw new Error(`chart point ${attrs.Id} lacks ALP2out/LNC2out — feed structure changed`);
    if (a < 30 || a > 80 || Math.abs(a + l - 100) > SUM_TOL)
      throw new Error(`chart point ${attrs.Id} 2PP ${a}/${l} fails range/sum — parse is off`);
    raw.push([date, r1(a)]);
  }
  /* the feed keys points by update event and routinely steps a day or two
     backwards inside a week (same week= attr) — stable-sort, and where a
     date repeats keep the later (newest Id) reading */
  raw.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const series = raw.filter((p, i) => i === raw.length - 1 || raw[i + 1][0] !== p[0]);
  if (series.length < MIN_POINTS) throw new Error(`only ${series.length} federal chart points (need ${MIN_POINTS}) — feed structure changed`);
  if (series[0][0] > START_MAX) throw new Error(`series starts ${series[0][0]}, after ${START_MAX} — term-opening points missing`);
  status.points = series.length;
  return series;
}

// ---- main ----------------------------------------------------------------------------
let xml;
try { xml = await fetchFeed(); } catch (e) { status.error = e.message; done(1); }
let series;
try { series = parseFeed(xml); } catch (e) { status.error = e.message; done(2); }
// the feed passed its guards — now it may become the cache
if (status.source === "live") { try { writeFileSync(CACHE, xml); } catch { /* cache is a convenience */ } }

const doc = {
  updated: NOW.toISOString().slice(0, 16) + "Z",
  source: "BludgerTrack (William Bowe), pollbludger.net/fed2028/bludgertrack — classic ALP v Coalition 2PP trend, outliers excluded (ALP2out, the line his page draws and prints)",
  feedDate: status.feedDate,
  series,
};

let prev = null;
if (existsSync(OUT)) { try { prev = JSON.parse(readFileSync(OUT, "utf8")); } catch { prev = null; } }
status.changed = !prev || JSON.stringify(prev.series) !== JSON.stringify(series);

if (APPLY && (status.changed || !existsSync(OUT))) writeJsonAtomic(OUT, doc);
if (!APPLY) status.notes.push("dry run: nothing written (pass --apply)");
done(0);
