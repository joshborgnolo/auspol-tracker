#!/usr/bin/env node
// Poll Bludger fallback — files a wave the house's own extractor has missed,
// from BludgerTrack's poll-data feed, so the site is never a poll short while
// the primary pipeline is repaired.
//
// WHY THIS EXISTS
// Every house extractor's failure mode is silence (see check-coverage.mjs),
// and the coverage watchdog can only SAY a wave is missing — it reads a
// witness that carries dates and names, not figures, and deliberately never
// fills. BludgerTrack's poll-data page (pollbludger.net/fed2028/bludgertrack/
// polldata.htm) is different: the page is a shell that loads
// xml/current.xml, a structured feed of every federal poll since the 2025
// election — fieldwork start/end, house, mode, sample, ALP/L-NP/GRN/PHON/UND
// primaries, a 2PP on 2025 preference flows (ALP2/LNC2) and a
// respondent-allocated one (ALPra/LNCra). At the time of writing 155 of its
// 160 national points match a polls.json row within three days; the five
// that don't are waves the tracker deliberately omits (MRPs, one-off
// commissioned polls). So it is good enough to file FROM, provisionally.
//
// WHAT "PROVISIONAL" MEANS HERE
// Rows filed by this script never enter D.polls. They live in their own
// array, D.fallbackPolls, for two reasons:
//   1. every house extractor dedupes new waves against D.polls by
//      (pollster, date ±2d) and never overwrites an existing row — a
//      fallback row inside D.polls would block the house's real row forever.
//   2. a fallback row is second-hand: no `published` clock, no release URL,
//      no ind/oth split (the feed carries none — the remainder rides in `ind`
//      with `oth: null`, the convention Roy Morgan's combined figure already
//      uses), and the house's own conventions may not survive the mirror.
// gen-data.mjs merges fallbackPolls into the page ONLY where no canonical
// row exists for that house within DATE_SLACK days, labelled provisional.
// When the house's extractor lands the real row, the fallback is shadowed on
// the next build and this script prunes it on its next run. Nothing here
// ever edits D.polls.
//
// ROBUSTNESS, in order of what has actually gone wrong with feeds like this:
//   * fetch: browser UA, 45 s timeout, three attempts with backoff; on
//     failure the cached copy (.build/pollbludger-src/current.xml) is used if
//     under CACHE_MAX_DAYS old, flagged stale, else the run is inconclusive
//     (exit 1 — a fault, not a finding).
//   * shape: the feed must carry a root date, at least MIN_POINTS national
//     points, and the 2025 election baseline point with the actual result
//     (ALP 34.6 / L-NP 31.8) — a canary that both the structure and the
//     parse are what this script expects. Any of these failing → exit 2.
//   * scope: national points only; houses mapped to tracker names by an
//     explicit table (an unmapped house is noted, never filed); waves older
//     than RECENT_DAYS are not gaps but curatorial decisions; a sample at or
//     above MRP_SAMPLE from a house with an "(MRP)" variant is an MRP and is
//     skipped (its seats and conventions can't be mirrored); an id listed in
//     .build/pollbludger-src/ignore.json is a human's "not this one".
//   * patience: a missing wave is filed only after it has sat in the feed
//     and been missing for GRACE_HOURS (first-seen ledger in
//     .build/pollbludger-src/seen.json), so the house's own extractor — its
//     dense release window, its follow-ups, its next-day sweep — gets every
//     chance to land the real row first.
//   * arithmetic: primaries must be in range and sum to 100 − undecided
//     within SUM_TOL; a 2PP pair is kept only when it sums to 100 (or to
//     100 − UNDra for the one house that carries an undecided 2PP); anything
//     off is dropped from the row (absent, not wrong) and noted.
//   * writes: atomic (.tmp + rename), and --check never writes.
//
// Usage:
//   node .build/extract-pollbludger.mjs            dry run: report, no write
//   node .build/extract-pollbludger.mjs --apply    file/prune, write polls.json
//   node .build/extract-pollbludger.mjs --check    alias of the dry run
//   --xml <file>       read the feed from a file (tests); --now <ISO> pins the clock
//   --grace-hours <n>  override GRACE_HOURS (0 files immediately)
//   POLLS_JSON=<path>  override the dataset path; PB_SRC_DIR=<dir> the ledger/cache dir (tests)
// Exit: 0 ran (see PB_STATUS changed/filed/pruned), 1 fetch failed with no
// usable cache, 2 feed failed a shape guard. Last stdout line is always
// `PB_STATUS {json}` for the wrapper.

import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from "node:fs";
import { writeJsonAtomic } from "./atomic-write.mjs";

const FEED = "https://www.pollbludger.net/fed2028/bludgertrack/xml/current.xml";
const PAGE = "https://www.pollbludger.net/fed2028/bludgertrack/polldata.htm";
const SRC_DIR = process.env.PB_SRC_DIR || ".build/pollbludger-src"; // tests point this elsewhere
const CACHE = `${SRC_DIR}/current.xml`;
const SEEN = `${SRC_DIR}/seen.json`;
const IGNORE = `${SRC_DIR}/ignore.json`;
const OUT = process.env.POLLS_JSON || "data/polls.json";

const CYCLE_START = "2025-05-03";
const MIN_POINTS = 100;      // national points the feed must carry
const RECENT_DAYS = 45;      // older gaps are curatorial, not missed
const MRP_SAMPLE = 3500;     // a sample this big from an MRP house is the MRP
const GRACE_HOURS = 18;      // how long a wave sits missing before it is filed
const CACHE_MAX_DAYS = 3;    // a cached feed older than this is no fallback
const SUM_TOL = 1.0;         // primaries vs 100 − undecided, points
const DATE_SLACK = 3;        // days a canonical row may sit from the feed's end date
const HOUSE_SLACK = { Essential: 7 }; // the feed keys Essential by report date

/* Feed pollster → tracker names, first the headline series. An MRP variant
   listed means the house files MRPs the tracker keeps under that name; a
   big-sample point from such a house is treated as one and skipped. */
const HOUSE = {
  "Roy Morgan": ["Roy Morgan", "Roy Morgan (SMS)"],
  "Newspoll": ["Newspoll"],
  "Resolve Strategic": ["Resolve"],
  "Essential Research": ["Essential"],
  "RedBridge Group": ["RedBridge/Accent", "Redbridge", "RedBridge/Accent (MRP)"],
  "YouGov": ["YouGov", "YouGov (MRP)"],
  "DemosAU": ["DemosAU", "DemosAU (MRP)"],
  "Fox & Hedgehog": ["Fox & Hedgehog"],
  "Freshwater Strategy": ["Freshwater"],
  "Spectre Strategy": ["Spectre Strategy"],
  "Wolf & Smith": ["Wolf & Smith"],
};
// houses whose HEADLINE 2PP is the respondent-allocated pair (README)
const RA_HEADLINE = new Set(["Roy Morgan", "RedBridge/Accent"]);

// ---- args ------------------------------------------------------------------
const argv = process.argv.slice(2);
const APPLY = argv.includes("--apply");
const argOf = (k) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : null);
const XML_FILE = argOf("--xml");
const NOW = argOf("--now") ? new Date(argOf("--now")) : new Date();
const GRACE = argOf("--grace-hours") != null ? Number(argOf("--grace-hours")) : GRACE_HOURS;

const DAY = 86400000;
const days = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / DAY);
const r1 = (x) => Math.round(x * 10) / 10;
const status = { changed: false, source: null, stale: false, feedDate: null, points: 0,
  filed: [], pruned: [], pending: [], skipped: [], notes: [], error: null };
const done = (code) => { console.log("PB_STATUS " + JSON.stringify(status)); process.exit(code); };

// ---- fetch -------------------------------------------------------------------
async function fetchFeed() {
  if (XML_FILE) { status.source = XML_FILE; return readFileSync(XML_FILE, "utf8"); }
  let lastErr = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(FEED, {
        headers: { "user-agent": "Mozilla/5.0 (auspol-tracker fallback; github.com/joshborgnolo/auspol-tracker)", "cache-control": "no-cache" },
        signal: AbortSignal.timeout(45_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      if (text.length < 50_000) throw new Error(`feed implausibly short (${text.length} bytes)`);
      // the cache is written only once the shape guards below have passed:
      // a broken feed must not overwrite the last good copy
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
const unesc = (s) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const dmy = (s) => { const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s || ""); return m ? `${m[3]}-${m[2]}-${m[1]}` : null; };
function parseFeed(xml) {
  const root = /<root\s+date="([^"]+)"/.exec(xml);
  if (!root) throw new Error("no <root date=…> — feed structure changed");
  status.feedDate = root[1];
  const fed = xml.indexOf("<federal");
  if (fed < 0) throw new Error("no <federal> section — feed structure changed");
  const points = [];
  for (const m of xml.slice(fed).matchAll(/<point\s+([^>]*)>([\s\S]*?)<\/point>/g)) {
    const attrs = Object.fromEntries([...m[1].matchAll(/(\w+)="([^"]*)"/g)].map((a) => [a[1], unesc(a[2])]));
    if (attrs.scope !== "NAT" || !("pollster" in attrs)) continue;
    const vals = {};
    for (const v of m[2].matchAll(/<(\w+)>([^<]*)<\/\1>/g)) vals[v[1]] = v[2].trim() === "" ? null : Number(v[2]);
    for (const v of m[2].matchAll(/<(\w+)\s*\/>/g)) vals[v[1]] = null;
    points.push({
      id: attrs.Id, pollster: attrs.pollster, mode: attrs.mode || "",
      start: dmy(attrs.start), end: dmy(attrs.end),
      sample: Number(attrs.sample) > 0 ? Number(attrs.sample) : null,
      alp: vals.ALP ?? null, lnp: vals.LNC ?? null, grn: vals.GRN ?? null, onp: vals.PHON ?? null, und: vals.UND ?? null,
      alp2: vals.ALP2 ?? null, lnp2: vals.LNC2 ?? null, alpRa: vals.ALPra ?? null, lnpRa: vals.LNCra ?? null, undRa: vals.UNDra ?? null,
    });
  }
  if (points.length < MIN_POINTS) throw new Error(`only ${points.length} national points (need ${MIN_POINTS}) — feed structure changed`);
  const canary = points.find((p) => p.pollster === "Election" && p.end === "2025-05-03");
  if (!canary || canary.alp !== 34.6 || canary.lnp !== 31.8)
    throw new Error(`2025 election baseline point missing or wrong (${JSON.stringify(canary)}) — parse is off`);
  status.points = points.length;
  return points;
}

// ---- row construction ------------------------------------------------------------
function houseFor(p, tracked) {
  const names = HOUSE[p.pollster];
  if (!names) return { skip: `unmapped house "${p.pollster}"` };
  const headline = names.find((n) => !/\(MRP\)/.test(n));
  if (names.some((n) => /\(MRP\)/.test(n)) && p.sample != null && p.sample >= MRP_SAMPLE)
    return { skip: `MRP-sized sample (${p.sample}) from ${p.pollster}` };
  if (!tracked.has(headline)) return { skip: `${headline} has no canonical rows this cycle` };
  return { house: headline, names };
}

function buildRow(p, house, client, notes) {
  const core = [p.alp, p.lnp, p.grn, p.onp];
  if (core.some((v) => v == null || v < 0 || v > 70)) { notes.push("primaries incomplete or out of range"); return null; }
  const und = p.und != null && p.und >= 0 && p.und < 30 ? p.und : null;
  let ind = r1(100 - (und ?? 0) - core.reduce((a, b) => a + b, 0));
  if (ind < 0) {
    if (ind < -SUM_TOL) { notes.push(`primaries sum past 100 (${100 - ind - (und ?? 0)})`); return null; }
    ind = 0;
  }
  // the 2PP pair the house headlines, kept only when it sums
  const pair = (a, b, undR) => {
    if (a == null || b == null) return null;
    const target = 100 - (undR ?? 0);
    return Math.abs(a + b - target) <= 0.6 ? [a, b] : null;
  };
  const ra = pair(p.alpRa, p.lnpRa, p.undRa), flows = pair(p.alp2, p.lnp2, null);
  if ((p.alpRa != null || p.lnpRa != null) && !ra) notes.push(`respondent-allocated pair ${p.alpRa}/${p.lnpRa} dropped: does not sum`);
  if ((p.alp2 != null || p.lnp2 != null) && !flows) notes.push(`flows pair ${p.alp2}/${p.lnp2} dropped: does not sum`);
  const headline = RA_HEADLINE.has(house) ? (ra ?? flows) : (flows ?? ra);
  const row = {
    date: p.end, dateStart: p.start, pollster: house, client, sample: p.sample,
    ...(und != null ? { undecided: und } : {}),
    alp: p.alp, lnp: p.lnp, grn: p.grn, onp: p.onp, ind, oth: null,
    tpp_alp: headline ? headline[0] : null, tpp_lnp: headline ? headline[1] : null,
    ...(RA_HEADLINE.has(house) && ra && flows ? { tpp_flows: flows[0] } : {}),
    url: PAGE,
    provisional: { source: "Poll Bludger", feedId: p.id, feedDate: status.feedDate, filed: NOW.toISOString().slice(0, 16) + "Z" },
  };
  if (!row.date || !row.dateStart || row.dateStart > row.date) { notes.push("fieldwork dates missing or inverted"); return null; }
  return row;
}

// ---- main ----------------------------------------------------------------------------
let D, xml;
try { D = JSON.parse(readFileSync(OUT, "utf8")); } catch (e) { status.error = `cannot read ${OUT}: ${e.message}`; done(1); }
try { xml = await fetchFeed(); } catch (e) { status.error = e.message; done(1); }
let points;
try { points = parseFeed(xml); } catch (e) { status.error = e.message; done(2); }
// the feed passed its guards — now it may become the cache
if (status.source === "live") { try { writeFileSync(CACHE, xml); } catch { /* cache is a convenience */ } }

const today = NOW.toISOString().slice(0, 10);
const canon = D.polls.filter((r) => !r.isElection);
const tracked = new Set(canon.map((r) => r.pollster));
const fallback = Array.isArray(D.fallbackPolls) ? D.fallbackPolls : [];
const ignore = existsSync(IGNORE) ? JSON.parse(readFileSync(IGNORE, "utf8")) : {};
const seen = existsSync(SEEN) ? JSON.parse(readFileSync(SEEN, "utf8")) : {};
const slackFor = (house) => HOUSE_SLACK[house] ?? DATE_SLACK;
const nearCanon = (names, end, slack) => canon.some((r) => names.includes(r.pollster) && Math.abs(days(r.date, end)) <= slack);
const latestClient = (house) => { const rows = canon.filter((r) => r.pollster === house); return rows.length ? rows[rows.length - 1].client ?? "—" : "—"; };

// ---- prune: fallback rows a canonical row now covers ------------------------------
const kept = [];
for (const f of fallback) {
  const names = Object.values(HOUSE).find((n) => n.includes(f.pollster)) || [f.pollster];
  if (nearCanon(names, f.date, slackFor(f.pollster))) status.pruned.push({ pollster: f.pollster, date: f.date, reason: "canonical row landed" });
  else kept.push(f);
}

// ---- file: recent feed waves nothing in the tracker covers -------------------------------
const seenNow = {};
for (const p of points) {
  if (p.pollster === "Election" || !p.end || p.end <= CYCLE_START) continue;
  if (days(p.end, today) > RECENT_DAYS) continue;
  const h = houseFor(p, tracked);
  if (h.skip) { status.skipped.push({ id: p.id, pollster: p.pollster, end: p.end, why: h.skip }); continue; }
  if (ignore[p.id]) { status.skipped.push({ id: p.id, pollster: p.pollster, end: p.end, why: `ignored: ${ignore[p.id]}` }); continue; }
  if (nearCanon(h.names, p.end, slackFor(h.house))) continue;
  const already = kept.find((f) => f.provisional?.feedId === p.id || (f.pollster === h.house && Math.abs(days(f.date, p.end)) <= slackFor(h.house)));
  if (already) continue; // filed on an earlier run, still unshadowed
  // first-seen ledger → grace
  const first = seen[p.id]?.firstSeen || NOW.toISOString();
  seenNow[p.id] = { firstSeen: first, pollster: p.pollster, end: p.end };
  const hours = (NOW - Date.parse(first)) / 3600000;
  if (hours < GRACE) { status.pending.push({ id: p.id, pollster: h.house, end: p.end, hoursSeen: r1(hours), filesAt: new Date(Date.parse(first) + GRACE * 3600000).toISOString().slice(0, 16) + "Z" }); continue; }
  const notes = [];
  const row = buildRow(p, h.house, latestClient(h.house), notes);
  if (!row) { status.skipped.push({ id: p.id, pollster: h.house, end: p.end, why: notes.join("; ") }); continue; }
  if (notes.length) status.notes.push(`${h.house} ${p.end}: ${notes.join("; ")}`);
  kept.push(row);
  status.filed.push({ pollster: h.house, date: p.end, sample: p.sample, feedId: p.id });
}
kept.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.pollster.localeCompare(b.pollster)));

status.changed = status.filed.length > 0 || status.pruned.length > 0;
if (APPLY) {
  mkdirSync(SRC_DIR, { recursive: true });
  // the ledger forgets waves the tracker now covers, so it cannot grow
  // forever; and it is not created empty (the wrapper commits it when it moves)
  if (Object.keys(seenNow).length || existsSync(SEEN)) writeJsonAtomic(SEEN, seenNow);
  if (status.changed) {
    const next = { ...D };
    if (kept.length) next.fallbackPolls = kept; else delete next.fallbackPolls;
    writeJsonAtomic(OUT, next);
  }
}
if (!APPLY && status.changed) status.notes.push("dry run: nothing written (pass --apply)");
done(0);
