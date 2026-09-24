/* crosstab-parse.mjs – the pure parsers behind data/vote-switching.json and
   data/demographics.json: tables in, the site's shapes out, no I/O. Kept
   apart from the builders (.build/vote-switching.mjs, .build/demographics.mjs,
   which fetch and write) so .build/test-crosstabs.mjs can hold every parser
   to a known source without touching the network. */
import { ygParty, decodeUx, RESOLVE_PAGE } from "./crosstab-sources.mjs";

export const TERM_START = "2025-05-03";

// ---- YouGov: the crosstab's 2025-vote columns ------------------------------------
const GROUP = (h) => {
  const s = h.toLowerCase();
  if (!/2025/.test(s)) return null;
  if (/labor/.test(s)) return "alp";
  if (/coalition/.test(s)) return "lnp";
  if (/green/.test(s)) return "grn";
  if (/one nation/.test(s)) return "onp";
  if (/independent/.test(s)) return "ind";
  if (/other/.test(s)) return "oth";
  return null;
};
// party rows as the house names them (independents and other kept apart here:
// the 2025-vote weights split them)
const PARTY = (r) => {
  const s = r.toLowerCase().trim();
  if (s === "labor") return "alp";
  if (s === "coalition") return "lnp";
  if (s === "one nation") return "onp";
  if (/greens/.test(s)) return "grn";
  if (s === "independent") return "ind";
  if (s === "other") return "oth";
  return s.replace(/[^a-z]+/g, "-");
};
export function switchingOf(t) {
  const cols = t.head.map((h, n) => [GROUP(h), n]).filter(([g]) => g);
  const totalAt = t.head.findIndex((h) => /^total$/i.test(h));
  const rows = {}, total = {};
  for (const r of t.rows) {
    const p = PARTY(r[0]);
    if (totalAt >= 0 && r[totalAt] !== "") total[p] = +r[totalAt];
    for (const [g, n] of cols) {
      if (r[n] === "" || r[n] == null) continue;
      (rows[g] ||= {})[p] = +r[n];
    }
  }
  return { rows, total };
}

// ---- YouGov: crosstab columns → groups ------------------------------------------
export function ygGroup(h) {
  const s = h.replace(/\s+/g, " ").trim();
  let m;
  if (/^(gender: )?male$/i.test(s)) return ["gender", "Men"];
  if (/^(gender: )?female$/i.test(s)) return ["gender", "Women"];
  // "Age: 18-34" (Feb–Mar 2026), "Age 18-34" (Jun–Aug), "NET 18-34" beside a
  // bare "35 - 49" (24 Aug), "Aged 18-34" (Sep on)
  if ((m = s.match(/^(?:age:?|aged|net)?\s*(\d+)\s*-\s*(\d+)$/i))) return ["age", `${m[1]}–${m[2]}`];
  if ((m = s.match(/^(?:age:?|aged|net)?\s*(\d+)\s*\+$/i))) return ["age", `${m[1]}+`];
  // "Generation: GenZ", or the bare names (24 Mar: "Gen Z", "Boomer", "Silent Generation")
  if ((m = s.match(/^generation:\s*(.+)$/i) || s.match(/^(gen\s?[zx]|millennials?|boomers?|silent(?: generation)?)$/i))) {
    const g = m[1].toLowerCase().replace(/\s+/g, "");
    return ["generation", /millen/.test(g) ? "Millennials" : /boomer/.test(g) ? "Boomers" : /silent/.test(g) ? "Silent"
      : /^(gen)?z$/.test(g) ? "Gen Z" : /^(gen)?x$/.test(g) ? "Gen X" : m[1].trim()];
  }
  if (/up to year 12/i.test(s)) return ["education", "Year 12 or less"];
  if (/tafe|college/i.test(s)) return ["education", "TAFE or college"];
  if (/tertiary|university/i.test(s)) return ["education", "University"];
  // where they live: "Region: Inner metro" (Feb–May 2026), "Inner Metropolitan" (Mar on)
  if ((m = s.match(/^(?:region:\s*)?(inner|outer) metro(?:politan)?$/i))) return ["location", /^i/i.test(m[1]) ? "Inner metro" : "Outer metro"];
  if (/^(?:region:\s*)?provincial$/i.test(s)) return ["location", "Provincial"];
  if (/^(?:region:\s*)?rural$/i.test(s)) return ["location", "Rural"];
  // state (Jun 2026 on): the three big states, then SA, WA and the rest together
  if ((m = s.match(/^(NSW|VIC|QLD|SA|WA)$/i))) return ["state", { NSW: "NSW", VIC: "Vic", QLD: "Qld", SA: "SA", WA: "WA" }[m[1].toUpperCase()]];
  if (/^ACT\s*\/\s*NT\s*\/\s*TAS$/i.test(s)) return ["state", "ACT/NT/Tas"];
  // housing: "Own outright" (24 Mar), "Housing: Own outright" (Apr–May), "Own home outright" (Jun on)
  if (/^(?:housing:\s*)?own(?: home)? outright$/i.test(s)) return ["housing", "Own outright"];
  if (/^(?:housing:\s*)?(?:mortgage(?:-holder)?|mortgaging home)$/i.test(s)) return ["housing", "Mortgage"];
  if (/^(?:housing:\s*)?(?:rent|renter|renting home)$/i.test(s)) return ["housing", "Renting"];
  // language spoken at home (Jun on)
  if (/^only english spoken at home$/i.test(s)) return ["language", "English only"];
  if (/^other language spoken at home$/i.test(s)) return ["language", "Other language"];
  return null;
}
export function youGovDims(t) {
  const dims = {}, total = {};
  const totalAt = t.head.findIndex((h) => /^total$/i.test(h));
  const cols = t.head.map((h, n) => [ygGroup(h), n]).filter(([g]) => g);
  for (const r of t.rows) {
    const p = ygParty(r[0]);
    if (totalAt >= 0 && r[totalAt] !== "") total[p] = (total[p] || 0) + +r[totalAt];
    for (const [[dim, label], n] of cols) {
      if (r[n] === "" || r[n] == null) continue;
      const g = ((dims[dim] ||= {})[label] ||= {});
      g[p] = (g[p] || 0) + +r[n];
    }
  }
  return { dims, total };
}

// ---- DemosAU: the Gender / Age / Education / Location / Housing / Language charts ----
/* Location and Housing Tenure from the April 2026 report, Language Status
   from May; a report without one of them just has no such group. */
export const DEMOS_DIM = { Gender: "gender", Age: "age", Education: "education",
  Location: "location", "Housing Tenure": "housing", "Language Status": "language" };
export function demosLabel(dim, label) {
  const s = label.replace(/\s+/g, " ").trim();
  if (dim === "gender") return /^fem/i.test(s) ? "Women" : /^male/i.test(s) ? "Men" : s;
  if (dim === "age") return s.replace(/(\d)\s*-\s*(\d)/, "$1–$2");
  if (dim === "education") return /^school/i.test(s) ? "School" : /^tafe/i.test(s) ? "TAFE" : /^univ/i.test(s) ? "University" : s;
  // "Regional/Rural" is provincial and rural voters together
  if (dim === "location") return /^inner/i.test(s) ? "Inner metro" : /^outer/i.test(s) ? "Outer metro"
    : /regional|rural/i.test(s) ? "Regional or rural" : s;
  // the third bar was "Home Owner" (Apr–Jul 2026) beside Renter and Mortgage
  // Holder, then "Own Home Outright": the same people, relabelled
  if (dim === "housing") return /^rent/i.test(s) ? "Renting" : /mortgage/i.test(s) ? "Mortgage"
    : /outright|^home owner$/i.test(s) ? "Own outright" : s;
  // "English" / "English Only" / "English only"; "LOTE" / "Other Language at Home"
  if (dim === "language") return /^english/i.test(s) ? "English only" : /^lote$|other language/i.test(s) ? "Other language" : s;
  return s;
}

// ---- RedBridge: the first-preference table in the cached report text ---------------
const RB_SECTIONS = { "Vote softness": "softness", Generation: "generation", Gender: "gender", Location: "location",
                      Education: "education", "Home ownership": "housing" };
function rbLabel(dim, label) {
  const s = label.replace(/\s+/g, " ").trim();
  if (dim === "generation") return { "Gen-Z": "Gen Z", "Gen-X": "Gen X", "Baby Boomers": "Boomers" }[s] || s;
  if (dim === "education") return { "Less than year 12": "Below Year 12", "Year 12 or equivalent": "Year 12",
    "TAFE, trade or vocational": "TAFE or trade", "University degree": "University" }[s] || s;
  if (dim === "location") return { "Inner Metropolitan": "Inner metro", "Outer Metropolitan": "Outer metro" }[s] || s;
  // "Renting and other" keeps its name: it is wider than renters
  if (dim === "housing") return { "Owned outright": "Own outright", "Owned with a mortgage": "Mortgage" }[s] || s;
  return s;
}
/* The party columns, read off the table's own header: the first line under
   the title that starts "Labor", split where two or more spaces part the
   cells. Reports have printed the Coalition as one column (May 2026 on) and
   as its parts (February: Liberal, Liberal National, National; April adds
   Country Liberal) – the parts are summed. The columns after the parties
   (two-party shares, N) are not read. Null when a cell isn't a party this
   knows: a new layout is a reader fix, never a guess. */
function rbColumns(line) {
  const cols = [];
  for (const c of line.trim().split(/\s{2,}/)) {
    if (/^vs\.?(\s|$)|^N$/i.test(c)) break;
    const s = c.toLowerCase();
    const k = s === "labor" ? "alp" : /^(liberal|liberal national|national|country|country liberal|coalition)$/.test(s) ? "lnp"
      : /^one( nation)?$/.test(s) ? "onp" : s === "greens" ? "grn" : /^other/.test(s) ? "oth" : null;
    if (!k) return null;
    cols.push(k);
  }
  return ["alp", "lnp", "onp", "grn", "oth"].every((k) => cols.includes(k)) ? cols : null;
}
export function redbridgeTable(txt) {
  const lines = txt.split("\n");
  const start = lines.findIndex((l) => /First preference vote intention/.test(l));
  if (start < 0) return null;
  const head = lines.slice(start + 1, start + 8).find((l) => /^Labor\s/.test(l.trim()));
  const cols = head && rbColumns(head);
  if (!cols) return null;
  const dims = {}; let cur = null, total = null, blank = 0;
  for (let i = start + 1; i < Math.min(lines.length, start + 90); i++) {
    const t = lines[i].trim();
    if (!t) { if (++blank > 3 && Object.keys(dims).length) break; continue; }
    blank = 0;
    if (RB_SECTIONS[t]) {
      if (dims[RB_SECTIONS[t]]) break;               // a section seen again is the next chart's title
      cur = RB_SECTIONS[t]; continue;
    }
    // "<label>  <party columns…> <two-party columns…>" – a page number the
    // text layer glued to the front of a row is dropped
    const m = t.match(/^(?:\d+\s+)?([A-Za-z][A-Za-z0-9 ,.'’\-]*?)\s{2,}(\d+(?:\s+\d+)*)$/);
    if (!m) continue;
    const nums = m[2].split(/\s+/).map(Number);
    if (nums.length < cols.length) continue;
    const sh = { alp: 0, lnp: 0, onp: 0, grn: 0, oth: 0 };
    cols.forEach((k, n) => { sh[k] += nums[n]; });
    if (/^all voters$/i.test(m[1].trim())) { total = sh; continue; }
    if (!cur) continue;
    (dims[cur] ||= {})[rbLabel(cur, m[1])] = sh;
  }
  return Object.keys(dims).length ? { dims, total, columns: cols } : null;
}
// ---- Resolve: the age, gender and state series, every month of the term -----------
const RS_PARTY = { ALP: "alp", LNP: "lnp", GRN: "grn", ONP: "onp", IND: "oth", OTH: "oth" };
/* The interactive's `states` series are NSW, Vic, Qld and Rest of Australia
   beside National (the whole poll, not a group). They move month to month
   the way a single wave's subsample does, not like a two-month pool. */
const RS_GROUP = { "age-18-34": ["age", "18–34"], "age-35-54": ["age", "35–54"], "age-55+": ["age", "55+"],
                   Male: ["gender", "Men"], Female: ["gender", "Women"],
                   NSW: ["state", "NSW"], Vic: ["state", "Vic"], Qld: ["state", "Qld"],
                   "Rest of Australia": ["state", "Rest of Australia"] };
/* Points in the series that are not polls. 12 Feb 2026 is the Ley scenario:
   that month's wave also asked how people would vote were Ley still leader,
   and the interactive plots the answer as a point of its own two days before
   the real wave (14 Feb). extract-resolve-rpm.mjs moves the same point out
   of its primary vote ("defect 5"); this does the same. */
const RESOLVE_SCENARIO_DATES = new Set(["2026-02-12"]);
export function resolveWaves(q) {
  const byDate = new Map();
  const iso = (d) => { const [dd, mm, yy] = d.split("/"); return `${yy}-${mm}-${dd}`; };
  for (const a of q.answers || []) {
    const p = RS_PARTY[a.answer];
    if (!p) continue;
    for (const g of [...(a.age || []), ...(a.gender || []), ...(a.states || [])]) {
      const grp = RS_GROUP[g.key];
      if (!grp) continue;                          // National; a stray "QLD" key in the gender list
      for (const t of g.timeseries || []) {
        const date = iso(t.date);
        if (date < TERM_START || RESOLVE_SCENARIO_DATES.has(date)) continue;
        const w = byDate.get(date) || { dims: {} };
        const sh = ((w.dims[grp[0]] ||= {})[grp[1]] ||= {});
        sh[p] = Math.round(((sh[p] || 0) + decodeUx(t.value)) * 100) / 100;
        byDate.set(date, w);
      }
    }
  }
  return [...byDate.entries()].map(([date, w]) => ({
    pollster: "Resolve", date, source: RESOLVE_PAGE, read: "published series", dims: w.dims,
  }));
}

// ---- the gate every table passes before it is saved ---------------------------------
/* Shares finite, 0–100, and each group's summing to 100 give or take
   rounding: the published tables land within 3 points (Resolve's decoded
   series), a misread column lands tens of points off – February and April
   2026's RedBridge rows summed to 37–90 before the reader learned their
   split Coalition columns. */
export const SUM_TOLERANCE = 5;
export function sharesProblem(groups) {
  for (const [g, sh] of Object.entries(groups || {})) {
    const v = Object.values(sh || {});
    if (!v.length || v.some((x) => typeof x !== "number" || !Number.isFinite(x) || x < 0 || x > 100))
      return `${g}: a share that isn't a number from 0 to 100`;
    const sum = v.reduce((a, b) => a + b, 0);
    if (Math.abs(sum - 100) > SUM_TOLERANCE) return `${g}: shares sum to ${+sum.toFixed(1)}`;
  }
  return null;
}
export function dimsProblem(dims) {
  if (!dims || !Object.keys(dims).length) return "no groups";
  for (const [dim, groups] of Object.entries(dims)) {
    const e = sharesProblem(groups);
    if (e) return `${dim} ${e}`;
  }
  return null;
}
/* A table's all-voters column against the wave's published primaries: the
   same respondents, so anything past a point of rounding is a misread. Every
   table read so far matches exactly. */
export function totalProblem(total, poll) {
  if (!total || !poll) return null;
  for (const k of ["alp", "lnp", "onp", "grn"]) {
    if (total[k] == null || poll[k] == null) continue;
    if (Math.abs(total[k] - poll[k]) > 1) return `the table's ${k} total ${total[k]} against the published ${poll[k]}`;
  }
  return null;
}
