/* demosau-trends.mjs – DemosAU's "Capital Brief / DemosAU Poll Trends" page
   (demosau.com under /wp-content/uploads/DemosAU/), the house's own machine
   release of every measure per wave: voting intention, leader ratings,
   preferred-PM pairs, the biggest-issue table, the wave's crosstab report
   (its `oct` block) and MRP seat model (`oct_seats`) as data. DemosAU says
   the page format is the standing one for its releases, so the detail lanes
   that used to measure the report PDF's breakdowns now read this page first:
     .build/demographics.mjs   – the wave's group tables (7 dims)
     .build/vote-switching.mjs – the past-election rows (pv_* groups)
     .build/issues.mjs         – the biggest-issue ranking (an r1 measure)
     .build/test-demosau-trends.mjs pins the parse against the committed copy.

   Provenance: the parsed JSON is committed next to the extractor's report
   caches (.build/demosau-src/cb-poll-trends-2026.json). Every lane loads
   that file; a lane told to refresh re-fetches the page through the same
   SiteGround-captcha path the extractor and report measures use
   (demosau-fetch.mjs), re-parses it, and rewrites the cache ONLY when the
   new parse passes the shape gate (a torn fetch or a restructured page can
   never corrode the committed copy). */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchBuffer } from "./demosau-fetch.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
export const TRENDS_URL = "https://demosau.com/wp-content/uploads/DemosAU/capital-brief-poll-trends-2026.html";
export const CACHE = path.join(ROOT, ".build", "demosau-src", "cb-poll-trends-2026.json");
export const DA_ALL = ["alp", "lnp", "grn", "on", "oth"];

/* Reads the page's one substantive JSON block (">1,500" keys) with a
   brace-balanced walk so a neighbouring script block can't be mistaken
   for it. Loud on a changed page: the page is this lane's whole contract. */
export function parseTrends(html) {
  const i = html.indexOf('{"polls"');
  if (i < 0) throw new Error("cb-poll-trends page: no {\"polls\" data block (page restructured?)");
  let depth = 0, inStr = false, esc = false;
  for (let j = i; j < html.length; j++) {
    const c = html[j];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return gateTrends(JSON.parse(html.slice(i, j + 1)), "live parse");
  }
  throw new Error("cb-poll-trends page: the data block never closes (truncated page?)");
}

const WAVE_KEYS = ["poll", "start", "end", "n"];
const TREND_KEYS = ["poll", "party", "pct"];
export function gateTrends(d, from) {
  const errs = [];
  const ok = (cond, msg) => { if (!cond) errs.push(msg); };
  ok(Array.isArray(d.polls) && d.polls.length >= 4, "fewer waves than the page has carried since January");
  for (const w of d.polls || []) for (const k of WAVE_KEYS) ok(w && w[k] != null, `a wave without ${k}`);
  ok(Array.isArray(d.vote) && d.vote.length >= 4 * (d.polls || []).length, "the vote trend lost rows");
  for (const v of d.vote || []) {
    for (const k of TREND_KEYS) ok(v && v[k] != null, "a vote-trend row without " + k);
    if (v) ok(DA_ALL.includes(v.party), `vote trend carries an unmapped party "${v.party}"`);
  }
  for (const r of d.ratings || []) {
    ok(typeof r.poll === "string" && typeof r.leader === "string", "a ratings row without a poll or a leader");
    if (r) ok(Number.isFinite(r.pos) && Number.isFinite(r.neu) && Number.isFinite(r.neg), `ratings row of ${r.poll}|${r.leader} without pos/neu/neg`);
  }
  for (const [q, rows] of Object.entries(d.oct?.results ? { vi: d.oct.results.filter((r) => r.q === "vi") } : {})) {
    const total = rows.find((r) => r.group === "total");
    ok(total && total.values, "the current wave's crosstab block has no all-voters row");
    if (total) {
      const sum = DA_ALL.reduce((a, p) => a + (total.values[p] || 0), 0);
      ok(Math.abs(sum - 100) <= 1.5, `the current wave's all-voters primaries sum to ${sum}, not ~100`);
    }
  }
  if (errs.length) throw new Error(`cb-poll-trends page ${from}: ${errs.join("; ")}`);
  return d;
}

/* The committed copy. `net` also re-fetches the page and rewrites the cache
   (re-running a lane against a moved page is the standing workflow once
   DemosAU updates it for a wave). */
export async function loadTrends({ net = false } = {}) {
  let text = null;
  if (net) {
    const html = (await fetchBuffer(TRENDS_URL)).toString("utf8");
    const fresh = parseTrends(html);
    text = JSON.stringify(fresh);
    if (!fs.existsSync(CACHE) || fs.readFileSync(CACHE, "utf8") !== text) {
      fs.writeFileSync(CACHE, text);
    }
    return fresh;
  }
  if (!fs.existsSync(CACHE)) throw new Error(`no committed trends cache at ${path.relative(ROOT, CACHE)} – run a lane with --net to fetch the page`);
  return gateTrends(JSON.parse(fs.readFileSync(CACHE, "utf8")), "committed cache");
}

export function pollOf(data, date) {
  if (!date) return null;
  const day = String(date).slice(0, 10);
  for (const w of data.polls) if (w.end === day) return w.current === false ? null : w;
  for (const w of data.polls) if (w.start <= day && day <= w.end) return w;
  return null;
}

/* The wave's own report block: the crosstab tables carry `q` ids plus a
   `total` group and one group per row (`vi` only is what the lanes need). */
export function octRowOf(data, q, group) {
  return (data.oct?.results || []).find((r) => r.q === q && r.group === group) || null;
}

/* One wave's past-election transition rows, from the same trend block's
   pv_* groups (a from-party row per current-party share, decided basis).
   The committed switching records carry alp/lnp/grn/onp/oth "from" rows
   only – "didn't vote" (pv_none) has no analogue in the store and is never
   filed here either. Returns { rows, unknown }. */
export const PV_FROM = { pv_alp: "alp", pv_lnp: "lnp", pv_grn: "grn", pv_on: "onp", pv_oth: "oth" };

export function trendSwitches(data, poll) {
  const rows = {}, unknown = [];
  const octResults = data.oct?.meta?.poll === poll && Array.isArray(data.oct?.results) ? data.oct.results : [];
  const cells = (gid) => (data.trend_groups?.vote || []).filter((v) => v.poll === poll && v.group === gid);
  for (const [gid, from] of Object.entries(PV_FROM)) {
    const octRow = octResults.find((r) => r.q === "vi" && r.group === gid);
    const cs = octRow ? null : cells(gid);
    if (!octRow && !cs?.length) { unknown.push(`${gid}: no past-vote row printed`); continue; }
    const vals = octRow ? octRow.values : Object.fromEntries(cs.map((v) => [v.party, v.pct]));
    for (const p of DA_ALL) if (!Number.isFinite(vals[p])) unknown.push(`${gid}: no ${p} share`);
    rows[from] = { alp: vals.alp, grn: vals.grn, lnp: vals.lnp, onp: vals.on, oth: vals.oth };
  }
  return { rows, unknown };
}

/* trend_groups group ids → the demographics file's dim and label, in the
   order its committed DemosAU waves list them. Groups that aren't a
   demographics dimension (the vpast_* past-election rows – they belong to
   .build/vote-switching.mjs) are simply absent here. */
export const TREND_GROUPS = {
  male: ["gender", "Men"], female: ["gender", "Women"],
  a18: ["age", "18–34"], a35: ["age", "35–54"], a55: ["age", "55+"],
  edu_school: ["education", "School"], edu_tafe: ["education", "TAFE"], edu_uni: ["education", "University"],
  inc_lo: ["income", "Under $45k"], inc_mid: ["income", "$45–125k"], inc_hi: ["income", "$125k+"],
  inner: ["location", "Inner metro"], outer: ["location", "Outer metro"], regional: ["location", "Regional or rural"],
  rent: ["housing", "Renting"], mortgage: ["housing", "Mortgage"], own: ["housing", "Own outright"],
  eng: ["language", "English only"], lote: ["language", "Other language"],
};

/* One wave's group tables from the page's trend block: the demographics
   file's dims keyed as party {alp, grn, lnp, onp, oth}, each figure the
   house's own share of that group's decided respondents (the printed dk
   share rides the block in the page but the demographics file's DemosAU
   waves don't carry it). Emits nothing for a group not listed in
   TREND_GROUPS; a group printed by the page but unmapped is returned in
   `unknown` – never silently skipped (KNOWN_DROP is that lane, in the
   builder). Returns { dims, unknown, total }. */
export function trendDims(data, poll) {
  const dims = {}, unknown = [];
  let total = null;
  const tVote = data.trend_groups?.vote || [];
  /* The oct report block is one wave's tables (oct.meta.poll says which) –
   * every other wave's groups come from the trend series or the page
   * hands each wave today's table by mistake. */
  const octResults = data.oct?.meta?.poll === poll && Array.isArray(data.oct?.results) ? data.oct.results : [];
  for (const [gid, [dim, label]] of Object.entries(TREND_GROUPS)) {
    const octRow = octResults.find((r) => r.q === "vi" && r.group === gid);
    const cells = tVote.filter((v) => v.poll === poll && v.group === gid);
    if (!octRow && !cells.length) { unknown.push(`${gid}: the trends page printed no ${dim}|${label} share`); continue; }
    const vals = octRow ? octRow.values : Object.fromEntries(cells.map((v) => [v.party, v.pct]));
    for (const p of DA_ALL) if (!Number.isFinite(vals[p])) unknown.push(`${gid}: no ${p} share`);
    (dims[dim] ||= {})[label] = { alp: vals.alp, grn: vals.grn, lnp: vals.lnp, onp: vals.on, oth: vals.oth };
  }
  const octTotal = data.oct?.meta?.poll === poll ? octRowOf(data, "vi", "total") : null;
  if (octTotal) {
    total = Object.fromEntries(DA_ALL.map((p) => [p === "on" ? "onp" : p, octTotal.values[p]]));
  }
  return { dims, unknown, total };
}
