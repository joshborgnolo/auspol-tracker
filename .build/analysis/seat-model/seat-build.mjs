/* seat-build.mjs: turns the 2028 seat skeleton into seats the engine can count - every candidate's
   voters given a ranking table (Senate ballots, House-calibrated, today's voters mixed from their
   2025 parties, any preference levers applied) and the routing tables the count reads.

   Pure: no node imports. swing-simulate.mjs (node) and the /model/ page's worker run this same file
   (.build/model/assemble.mjs copies it into model/js/). seat-inputs.mjs builds the skeleton in node
   from the committed stores; the page fetches it as model/data/inputs.json.

   Skeleton seat: { name, st, cls, w, uni, z, iota, sib, demoPP, cands: [{ label, group, party,
   partyName, base, p5, fam, isInd, key, cls, clsIdx }] }. */
import { cohortTable, stateTable, pairShare, tiltPair, moveFirst, mix, routing, SUB_CLASS } from "./senate-flows.mjs";
import { FLOW_CLASSES } from "./seat-engine.mjs";

const logit = (p) => Math.log(p / (1 - p));
const clamp = (p) => Math.min(0.995, Math.max(0.005, p));
export const P5_OF = (g) => (g === "alp" ? 0 : ["lp", "np", "lnp", "clp"].includes(g) ? 1 : g === "on" ? 2 : g === "grn" ? 3 : 4);
export const flowClassOf = (key) => (key === "ALP" ? "ALP" : key.startsWith("COAL") ? "COAL" : key === "GRN" ? "GRN" : key === "ON" ? "ON"
  : key.startsWith("OTH:") ? "OTH-" + (SUB_CLASS[key.slice(4)] || "M") : key.startsWith("OTH-") ? key : "OTH-M");

/* pattern-shrink weights (Senate deviation kept) per flow class: calibrate-flows.mjs `combine`
   (previous-election Senate alone). COAL and ALP have no House classic cells to fit on: COAL is set
   from the SA 2026 test (exp12: the mapped Senate carried both level and pattern), ALP is a stated
   middle value. */
export function settings(FCAL) {
  const c = FCAL.combine || {};
  const lamAlone = { ALP: 0.6, COAL: 0.8, GRN: c.GRN?.alone.lamS ?? 0.6, ON: c.ON?.alone.lamS ?? 0.3, "OTH-R": c["OTH-R"]?.alone.lamS ?? 0.2, "OTH-M": c["OTH-M"]?.alone.lamS ?? 0.1, "OTH-L": c["OTH-L"]?.alone.lamS ?? 0.3 };
  const lamComb = Object.fromEntries(FLOW_CLASSES.map((k) => [k, c[k] ? { S: c[k].lamS, H: c[k].lamH } : null]));
  // chamber offsets (same-election fit). The Coalition's Labor-v-One Nation offset is set from the four
  // real counts of that pair, not borrowed from its Labor-v-Greens finals (where Coalition cards put the
  // Greens last): Hunter 2025 +0.24 logit (House v same-election Senate), SA 2026 +0.02, Queensland 2020
  // -0.12, Queensland 2017 -0.58 (state counts v the previous federal Senate; backtest-states.mjs). They
  // average about zero, so zero, with the level drift they show carried as a national flow shock. The 2028
  // runs replace it (and ON|AC) with solveLevel's offset, which sets the national level to the site's own Labor v One
  // Nation table (flows.mjs FP_ON.lnp, built on these counts and Secret Harbour's); backtests keep zero.
  const delta = {};
  for (const [k, d] of Object.entries(FCAL.same.delta)) delta[k] = d.v;
  delta["COAL|AO"] = 0;
  return { lamAlone, lamComb, delta };
}

/* division table -> shrink toward the state table (Senate deviation weight lamAlone[class]) ->
   chamber offsets (delta) -> House-history tilt where the 2025 House counted this cohort's flow */
export function calibratedTable(SEN, ST, D, divName, key, hist) {
  const cls = flowClassOf(key);
  const st = SEN.div[divName]?.st || D?.st;
  const ps = stateTable(SEN, st, key);
  const pd = SEN.div[divName] ? cohortTable(SEN, divName, key) : ps;
  const lam = ST.lamAlone[cls] ?? 0.5;
  let p = mix([[lam, pd], [1 - lam, ps]]);
  for (const [k, v] of Object.entries(ST.delta)) {
    const [c, pair] = k.split("|"); if (c !== cls) continue;
    p = tiltPair(SEN, p, "ACGO".indexOf(pair[0]), "ACGO".indexOf(pair[1]), v);
  }
  const comb = ST.lamComb[cls];
  const obs = hist.bySeat[divName]?.[key];
  if (comb && obs) for (const [pair, h] of Object.entries(obs)) {
    const x = "ACGO".indexOf(pair[0]), y = "ACGO".indexOf(pair[1]);
    const m = hist.mean[cls + "|" + pair]; if (m == null) continue;
    const xH = logit(clamp(h)) - m.house;
    const xS = logit(clamp(pairShare(SEN, pd, x, y))) - m.senate;
    const want = comb.S * xS + comb.H * xH, have = lam * xS;
    p = tiltPair(SEN, p, x, y, want - have);
  }
  return p;
}

/* Preference levers: logit shifts on one donor class's choice between two families, applied to every
   candidate of that class after today's-voter mixing (so they move today's voters). Keys "CLASS|XY"
   (share to X over Y; OTH matches all three minor-party classes). The /model/ page's sliders move them;
   the official runs use none. */
export const LEVERS = {
  "COAL|AO": { label: "Coalition voters: Labor ahead of One Nation", cls: ["COAL"], x: 0, y: 3 },
  "ALP|CO": { label: "Labor voters: Coalition ahead of One Nation", cls: ["ALP"], x: 1, y: 3 },
  "ON|AC": { label: "One Nation voters: Labor ahead of the Coalition", cls: ["ON"], x: 0, y: 1 },
  "GRN|AC": { label: "Greens voters: Labor ahead of the Coalition and One Nation", cls: ["GRN"], x: 0, y: 1, also: [0, 3] },
  "OTH|OA": { label: "Minor-party voters: One Nation ahead of Labor and the Coalition", cls: ["OTH-R", "OTH-M", "OTH-L"], x: 3, y: 0, also: [3, 1] },
};
function applyLevers(SEN, c, p, levers) {
  for (const [k, d] of Object.entries(levers || {})) {
    const L = LEVERS[k]; if (!L || !d || !L.cls.includes(c.cls)) continue;
    p = tiltPair(SEN, p, L.x, L.y, d);
    if (L.also) p = tiltPair(SEN, p, L.also[0], L.also[1], d);
  }
  return p;
}
/* states whose Senate ballots had no One Nation group (the ACT in 2025): every table there leaves One Nation
   unranked, so they say nothing about a choice involving it and stay out of the national levels */
export const noOnBallots = (SEN, st) => !!SEN.state && !SEN.state[st]?.ON;
/* each lever's national level as the model stands: the class's share to X over Y, weighted by its
   candidates' votes - what the page prints beside each slider */
export function leverLevels(SEN, seats) {
  const out = {};
  for (const [k, L] of Object.entries(LEVERS)) {
    let a = 0, w = 0;
    for (const s of seats) for (const c of s.cands) {
      if (noOnBallots(SEN, s.st)) continue;
      if (!L.cls.includes(c.cls) || !c.table) continue;
      const v = s.w * c.base; a += v * pairShare(SEN, c.table, L.x, L.y); w += v;
    }
    out[k] = w ? a / w : null;
  }
  return out;
}

/* the chamber offset ("CLASS|XY") that puts a class's national share to X over Y (as leverLevels reads it,
   before levers) on `target`: bisection on the logit offset. No voters are mixed (MIX_FAMS), so the tables
   are calibratedTable's alone; the seat-history tilt rides on top unchanged, so the level is monotone. */
export function solveLevel(inputs, key, target) {
  const { SEN, ST, hist } = inputs;
  const [cls, pair] = key.split("|"), x = "ACGO".indexOf(pair[0]), y = "ACGO".indexOf(pair[1]);
  const rows = [];
  for (const s of inputs.seats) if (!noOnBallots(SEN, s.st)) for (const c of s.cands) if (flowClassOf(c.key) === cls) rows.push([s, c, s.w * c.base]);
  const level = (d) => {
    const st = { ...ST, delta: { ...ST.delta, [key]: d } };
    let a = 0, w = 0;
    for (const [s, c, v] of rows) { a += v * pairShare(SEN, calibratedTable(SEN, st, { st: s.st }, s.name, c.key, hist), x, y); w += v; }
    return a / w;
  };
  let lo = -2, hi = 2;
  for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (level(m) < target) lo = m; else hi = m; }
  return Math.round(((lo + hi) / 2) * 1e6) / 1e6;
}

const COMP_KEY = { alp: "ALP", lnp: "COAL", grn: "GRN", onp: "ON", ind: "OTH-M", oth: "OTH" };
/* Which parties' voters are mixed from their 2025 parties (family indexes, A=0 C=1 G=2 O=3): none, since
   2026-11-03. The mix reads switchers from recalled 2025 votes, which lean towards the party that won, and
   gives each its old party's order with the new party moved first. For the Coalition it lifted Coalition-to-
   Labor against One Nation from 26 to 39; for One Nation it lifted One Nation-to-Labor against the Coalition
   from 23 to 32 (17% of today's One Nation voters recall a Labor vote), above the Coalition's own flow the
   other way, when RedBridge's respondents put One Nation voters at 15-25% to Labor and Coalition voters at
   31-44%. The national levels of the two flows that decide most seats are set to the site's own tables
   instead (prepInputs: solveLevel on COAL|AO and ON|AC). */
export const MIX_FAMS = [];
export function buildSeatsFrom(inputs, { composition = true, levers = null, mixFams = MIX_FAMS } = {}) {
  const { hist, comp, ST, SEN } = inputs;
  return inputs.seats.map((sk) => {
    const s = { ...sk, cands: sk.cands.map((c) => ({ ...c })) };
    const tables = {};
    // inputs.pre: each seat's tables already read and calibrated per donor class (a state election's
    // districts, state-tables.mjs), in place of the federal division tables
    const tableFor = (key) => (tables[key] = tables[key] || (inputs.pre ? Float64Array.from(inputs.pre[s.name][flowClassOf(key)]) : calibratedTable(SEN, ST, { st: s.st }, s.name, key, hist)));
    for (const c of s.cands) {
      let p = tableFor(c.key);
      if (c.fam >= 0 && composition && comp && mixFams.includes(c.fam)) {
        const X = ["alp", "lnp", "grn", "on"][c.fam];
        const parts = [];
        for (const [g, w] of Object.entries(comp[X])) {
          if (w <= 0) continue;
          const same = (g === "alp" && c.fam === 0) || (g === "lnp" && c.fam === 1) || (g === "grn" && c.fam === 2) || (g === "onp" && c.fam === 3);
          parts.push([w, same ? p : moveFirst(SEN, tableFor(COMP_KEY[g]), c.fam)]);
        }
        p = mix(parts);
      }
      if (levers) p = applyLevers(SEN, c, p, levers);
      c.table = p;
      c.route = routing(SEN, p);
    }
    return s;
  });
}

/* ---- pure helpers seat-inputs.mjs prepares the skeleton with ---- */
export function seatGroups(cs) {
  const g = [];
  if (cs.contest.alp) g.push("alp");
  for (const c of cs.contest.coalition) g.push(c);
  if (cs.contest.on) g.push("on");
  if (cs.contest.grn) g.push("grn");
  for (const i of cs.contest.ind) if (i.kind === "held") g.push(i.key);
  if (cs.contest.othCount2025 > 0) g.push("oth");
  return g;
}
