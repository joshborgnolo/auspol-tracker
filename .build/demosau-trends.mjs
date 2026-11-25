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

/* The per-wave interactive release carries its full table pool in
   script#poll-data. Its VI option order differs from DA_ALL, so the JSON
   option map, not array position, assigns party ids. */
export function parseInteractive(html) {
  let data = html;
  if (typeof html !== "object" || !data) {
    const blocks = [...String(html).matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
      .filter((m) => /\bid=["']poll-data["']/.test(m[1]) && /\btype=["']application\/json["']/.test(m[1]));
    if (blocks.length !== 1) throw new Error(`interactive poll: expected one poll-data block, found ${blocks.length}`);
    data = JSON.parse(blocks[0][2]);
  }
  const q = data.questions?.find((r) => r.question === "vi" && r.kind === "vote");
  if (!q) throw new Error("interactive poll: no voting-intention question");
  const opts = (data.options || []).filter((r) => r.question === "vi").sort((a, b) => a.pos - b.pos);
  const partyAt = new Map(), partyByShort = { Labor: "alp", Coalition: "lnp", "One Nation": "on", Greens: "grn", Other: "oth" };
  for (const [i, o] of opts.entries()) {
    if (o.role === "p") {
      if (!partyByShort[o.short]) throw new Error(`interactive poll: unmapped party option ${o.short}`);
      partyAt.set(i, partyByShort[o.short]);
    } else if (o.role !== "dkx" || !/^don.?t know$/i.test(o.short)) {
      throw new Error(`interactive poll: unmapped answer ${o.short}`);
    }
    if (o.pos !== i + 1) throw new Error("interactive poll: option positions moved");
  }
  if (partyAt.size !== DA_ALL.length || ![...partyAt.values()].every((p) => DA_ALL.includes(p)))
    throw new Error("interactive poll: party map does not cover the five published shares");
  const dkIndex = opts.findIndex((o) => o.role === "dkx");
  if (dkIndex < 0) throw new Error("interactive poll: no undecided-after-leaner answer");
  const values = (group) => {
    const v = data.results?.vi?.[group];
    if (!Array.isArray(v) || v.length !== opts.length || v.some((x) => !Number.isFinite(x) || x < 0 || x > 100))
      throw new Error(`interactive poll: invalid VI row ${group}`);
    return Object.fromEntries([...partyAt].map(([i, p]) => [p, v[i]]));
  };
  const total = values("total");
  const meta = (data.vote_meta || []).find((r) => r.question === "vi");
  const totalDk = data.results.vi.total[dkIndex];
  if (!meta || !Number.isFinite(meta.dk) || meta.dk !== totalDk)
    throw new Error("interactive poll: DK metadata and the national answer disagree");
  const unknown = (data.groups || []).filter((g) => g.group !== "total" && TREND_GROUPS[g.group] && !(g.group in (data.results.vi || {})));
  if (unknown.length) throw new Error(`interactive poll: cohort rows missing for ${unknown.map((g) => g.group).join(", ")}`);
  const oct = { meta: { poll: "interactive" }, results: [{ q: "vi", group: "total", values: total }] };
  for (const gid of Object.keys(TREND_GROUPS)) if (gid in (data.results.vi || {})) oct.results.push({ q: "vi", group: gid, values: values(gid) });
  return { data, oct, meta, dkIndex, opts, total };
}

export function interactiveDims(read) {
  return trendDims({ oct: read.oct }, "interactive");
}

/* Optional canonical-row reconciliation. When the caller expects this URL to
   be a particular wave, every available witness must agree before any fact
   is used. Previous-wave inventory is a required check for the DK backfill. */
export function interactiveFacts(read, { row = null, previous = null } = {}) {
  const total = Object.fromEntries(DA_ALL.map((p) => [p === "on" ? "onp" : p, read.total[p]]));
  if (row) {
    for (const k of ["alp", "lnp", "grn", "onp"]) if (row[k] !== total[k])
      throw new Error(`interactive poll: ${k} ${total[k]} differs from the canonical ${row[k]}`);
    if (total.oth !== (row.ind ?? row.oth)) throw new Error("interactive poll: Other differs from the canonical row");
    const survey = read.data.survey?.[0];
    for (const [r, v, key] of [[row.sample, survey?.sample_size, "sample"], [row.sampleEff, survey?.effective_sample_size, "effective sample"]])
      if (r != null && r !== v) throw new Error(`interactive poll: ${key} ${v} differs from canonical ${r}`);
  }
  const previousMeta = read.data.prev_poll?.[0];
  let undecidedLeaner = null;
  if (previous) {
    if (!previousMeta || previousMeta.fieldwork_end !== previous.date || !Number.isFinite(read.meta.prev_dk) ||
        previous.undecidedLeaner == null || read.meta.prev_dk !== previous.undecidedLeaner)
      throw new Error("interactive poll: previous wave does not reconcile with the canonical inventory");
    undecidedLeaner = read.meta.dk;
    const change = (read.data.changes || []).find((r) => r.question === "vi" && r.group === "total" && r.pos === read.dkIndex + 1);
    if (!change || change.change !== undecidedLeaner - read.meta.prev_dk)
      throw new Error("interactive poll: printed undecided change does not reconcile");
  }
  return { total, undecidedLeaner };
}

export function interactiveCache(url) {
  const u = new URL(url);
  if (u.protocol !== "https:" || u.hostname !== "demosau.com" || !u.pathname.startsWith("/wp-content/uploads/DemosAU/") || !u.pathname.endsWith(".html"))
    throw new Error("interactive poll: not a DemosAU interactive release URL");
  return path.join(ROOT, ".build", "demosau-src", path.basename(u.pathname, ".html") + ".interactive.json");
}

export async function loadInteractive(url, { net = false, writeCache = true } = {}) {
  const file = interactiveCache(url);
  if (!net && fs.existsSync(file)) {
    const cached = JSON.parse(fs.readFileSync(file, "utf8"));
    if (cached.url !== url || cached.schema !== 1) throw new Error(`interactive poll: cache/source mismatch at ${path.relative(ROOT, file)}`);
    return parseInteractive(cached.data);
  }
  if (!net) throw new Error(`interactive poll: no committed cache at ${path.relative(ROOT, file)}`);
  const html = (await fetchBuffer(url)).toString("utf8"), read = parseInteractive(html);
  const text = JSON.stringify({ schema: 1, url, data: read.data }, null, 2) + "\n";
  if (writeCache && (!fs.existsSync(file) || fs.readFileSync(file, "utf8") !== text)) {
    fs.writeFileSync(file + ".tmp", text);
    fs.renameSync(file + ".tmp", file);
  }
  return read;
}
