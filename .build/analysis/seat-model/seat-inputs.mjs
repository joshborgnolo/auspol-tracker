/* seat-inputs.mjs: builds the 2028 seat specs for seat-engine.mjs from the committed stores.
   Shared by swing-simulate.mjs (nowcast / forecast / replay) and its test. */
import { readFileSync } from "node:fs";
import { loadRankings, cohortTable, stateTable, pairShare, tiltPair, moveFirst, mix, routing, cohortKeyFor, subOfName, SUB_CLASS, FAM_OF_GROUP } from "./senate-flows.mjs";
import { FLOW_CLASSES } from "./seat-engine.mjs";

const J = (f) => JSON.parse(readFileSync(f, "utf8"));
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
  // chamber offsets (same-election fit); the Coalition's Labor-v-ON offset is pooled with SA 2026 (see header of calibrate-flows)
  const delta = {};
  for (const [k, d] of Object.entries(FCAL.same.delta)) delta[k] = d.v;
  delta["COAL|AO"] = 0.15;
  return { lamAlone, lamComb, delta };
}

export function buildSeats({ year = 2025, composition = true, replay = false, root = "." } = {}) {
  const FLOWS = J(`${root}/data/aec-2025-seat-flows.json`);
  const CAND = J(`${root}/data/seat-candidate-set-2028.json`);
  const RES = J(`${root}/map/data/res-2025.json`);
  const FCAL = J(`${root}/data/seat-model-flow-calibration.json`);
  const SW = J(`${root}/data/vote-switching.json`);
  const SEN = loadRankings(year, root);
  const ST = settings(FCAL);
  const resBy = new Map(RES.divs.map((d) => [d.n, d]));
  const flowsBy = new Map(FLOWS.seats.map((s) => [s.name, s]));

  /* --- One Nation's 2025-style base where it did not stand (the ACT): ridge on demographics, as E9 */
  const DK = ["uni", "y12less", "blue", "a65", "a2034", "lang", "atsci"];
  const xOf = (d) => [...DK.map((k) => d.demo?.[k] ?? 0), d.demo?.rel?.norel ?? 0, d.demo?.ten?.own ?? 0];
  const onShare = (d) => { const t = d.c.reduce((a, c) => a + c[4], 0); return d.c.filter((c) => c[3] === "onp").reduce((a, c) => a + c[4], 0) / t; };
  const fitRows = RES.divs.filter((d) => onShare(d) > 0.005);
  const onBase = ridgePredict(fitRows.map(xOf), fitRows.map((d) => logit(onShare(d))), 3);

  /* --- 2025 national mean logit flow per class|pair (for House-history residuals) */
  const hist = process.env.AUSPOL_SIM_NOHIST === "1" ? { bySeat: {}, mean: {} } : houseHistory(RES, SEN);

  /* --- composition: today's vote for each big-four party, by 2025 vote, pooled over recent waves */
  const comp = composition ? switching(SW) : null;

  /* --- sitting independents' capture shares and Coalition partner shares from the 2025 counts */
  const { capNat, capBySeat, sibBySeat } = certifiedShares(FLOWS);

  const seats = [];
  for (const cs of CAND.seats) {
    const F = flowsBy.get(cs.name), D = resBy.get(cs.name);
    const want = replay ? new Set(F.candidates.map((c) => c.group)) : new Set(seatGroups(cs));
    const total = F.candidates.reduce((a, c) => a + c.votes, 0);
    const pnameBy = new Map(D.c.map((c) => [c[0], c[2]]));
    const cands = F.candidates.filter((c) => want.has(c.group)).map((c) => ({
      label: c.name, group: c.group, party: c.party, partyName: pnameBy.get(c.name) || c.party, base: c.votes / total }));
    if (!replay && want.has("on") && !cands.some((c) => c.group === "on")) cands.push({ label: "One Nation (assumed)", group: "on", party: "ON", partyName: "Pauline Hanson's One Nation", base: Math.exp(onBase(xOf(D))) / (1 + Math.exp(onBase(xOf(D)))) });
    if (!replay) for (const [k, i] of cs.contest.ind.filter((i) => i.kind !== "held").entries()) cands.push({ label: i.label, group: "ind-declared", party: "IND", partyName: "Independent", base: 0.08 });
    for (const c of cands) {
      c.p5 = P5_OF(c.group);
      c.fam = FAM_OF_GROUP[c.group] ?? -1;
      c.isInd = c.group.startsWith("member") || c.group === "ind-declared";
      c.key = cohortKeyFor(c);
      c.cls = flowClassOf(c.key);
      c.clsIdx = FLOW_CLASSES.indexOf(c.cls);
    }
    const tables = {};
    const tableFor = (key) => (tables[key] = tables[key] || calibratedTable(SEN, ST, D, cs.name, key, hist));
    for (const c of cands) {
      let p = tableFor(c.key);
      if (c.fam >= 0 && comp) {
        const X = ["alp", "lnp", "grn", "on"][c.fam === 0 ? 0 : c.fam === 1 ? 1 : c.fam === 2 ? 2 : 3];
        const parts = [];
        for (const [g, w] of Object.entries(comp[X])) {
          if (w <= 0) continue;
          const gk = { alp: "ALP", lnp: "COAL", grn: "GRN", onp: "ON", ind: "OTH-M", oth: "OTH" }[g];
          const same = (g === "alp" && c.fam === 0) || (g === "lnp" && c.fam === 1) || (g === "grn" && c.fam === 2) || (g === "onp" && c.fam === 3);
          parts.push([w, same ? p : moveFirst(SEN, tableFor(gk), c.fam)]);
        }
        p = mix(parts);
      }
      c.table = p;
      c.route = routing(SEN, p);
    }
    const cap = capBySeat[cs.name] || {};
    seats.push({
      name: cs.name, st: cs.state, cls: D.cls, w: total, uni: D.demo?.uni ?? null,
      cands, iota: Object.fromEntries(FLOW_CLASSES.map((k) => [k, cap[k] ?? capNat[k] ?? capNat._])),
      sib: sibBySeat[cs.name] != null ? 0.5 * sibBySeat[cs.name] + 0.5 * 0.72 : 0.72,
    });
  }
  // education z-score over seats (university share)
  const us = seats.map((s) => s.uni).filter((v) => v != null), mu = us.reduce((a, b) => a + b, 0) / us.length, sd = Math.sqrt(us.reduce((a, b) => a + (b - mu) ** 2, 0) / us.length);
  for (const s of seats) s.z = s.uni == null ? 0 : (s.uni - mu) / sd;
  return { seats, SEN, ST, comp };
}

function seatGroups(cs) {
  const g = [];
  if (cs.contest.alp) g.push("alp");
  for (const c of cs.contest.coalition) g.push(c);
  if (cs.contest.on) g.push("on");
  if (cs.contest.grn) g.push("grn");
  for (const i of cs.contest.ind) if (i.kind === "held") g.push(i.key);
  if (cs.contest.othCount2025 > 0) g.push("oth");
  return g;
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
  // House history: the 2025 count's residual for this seat/cohort/pair, at the forecast weights
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

export function houseHistory(RES, SEN) {
  const FAMB = { alp: 0, lnp: 1, grn: 2, onp: 3 };
  const GROUP = (c) => (c[3] === "alp" ? "alp" : c[3] === "grn" ? "grn" : c[3] === "onp" ? "on" : c[3] === "lnp" ? ({ LP: "lp", NP: "np", LNP: "lnp", CLP: "clp" }[c[1]] || "lnp") : c[3] === "ind" ? "member" : "oth");
  const bySeat = {}, acc = {};
  for (const dv of RES.divs) {
    if (!dv.tcp || dv.tcp.length !== 2 || !SEN.div[dv.n]) continue;
    const fins = dv.tcp.map((t) => FAMB[dv.c[t[0]][3]]);
    if (fins.some((f) => f == null) || fins[0] === fins[1]) continue;
    const [x, y] = fins[0] < fins[1] ? [fins[0], fins[1]] : [fins[1], fins[0]], xi = fins[0] === x ? 0 : 1;
    const pair = "ACGO"[x] + "ACGO"[y];
    for (const f of dv.fl || []) {
      const c = dv.c[f[0]], n = f[1] + f[2]; if (n < 100) continue;
      const key = cohortKeyFor({ group: GROUP(c), party: c[1], partyName: c[2] });
      const cls = flowClassOf(key);
      if (cls === "COAL" && (x === 1 || y === 1)) continue;
      const h = (xi === 0 ? f[1] : f[2]) / n;
      ((bySeat[dv.n] = bySeat[dv.n] || {})[key] = bySeat[dv.n][key] || {})[pair] = h;
      const s = pairShare(SEN, cohortTable(SEN, dv.n, key), x, y);
      const k = cls + "|" + pair; (acc[k] = acc[k] || [0, 0, 0]); acc[k][0] += n * logit(clamp(h)); acc[k][1] += n * logit(clamp(s)); acc[k][2] += n;
    }
  }
  const mean = Object.fromEntries(Object.entries(acc).map(([k, a]) => [k, { house: a[0] / a[2], senate: a[1] / a[2] }]));
  return { bySeat, mean };
}

/* today's vote for each big-four party by 2025 vote: share of party X's current voters who were
   g voters in 2025 = weights2025[g] x P(now X | g), pooled over waves fielded from 1 Aug 2026 */
export function switching(SW, from = "2026-08-01") {
  const G = ["alp", "lnp", "grn", "onp", "ind", "oth"], X = ["alp", "lnp", "grn", "on"];
  const M = Object.fromEntries(G.map((g) => [g, Object.fromEntries([...X, "_other"].map((x) => [x, 0]))])), Wt = Object.fromEntries(G.map((g) => [g, 0]));
  for (const w of SW.waves) {
    if ((w.date || "") < from) continue;
    for (const g of G) {
      const row = w.rows[g]; if (!row) continue;
      const keys = Object.keys(row).filter((k) => !["dnr", "und"].includes(k));
      const tot = keys.reduce((a, k) => a + (row[k] || 0), 0); if (!tot) continue;
      const n = (w.sample || 1000) * (SW.weights2025[g] || 1) / 100;
      for (const k of keys) { const x = k === "onp" ? "on" : X.includes(k) ? k : "_other"; M[g][x] += n * (row[k] || 0) / tot; }
      Wt[g] += n;
    }
  }
  const comp = {};
  for (const x of X) {
    const parts = Object.fromEntries(G.map((g) => [g, Wt[g] ? (SW.weights2025[g] || 0) * M[g][x] / Wt[g] : 0]));
    const t = Object.values(parts).reduce((a, b) => a + b, 0);
    comp[x] = Object.fromEntries(Object.entries(parts).map(([g, v]) => [g, v / t]));
  }
  return comp;
}

export function certifiedShares(FLOWS) {
  const COAL = new Set(["lp", "np", "lnp", "clp"]);
  const clsOfGroup = (g) => (g === "alp" ? "ALP" : COAL.has(g) ? "COAL" : g === "grn" ? "GRN" : g === "on" ? "ON" : "OTH");
  const nat = {}, capBySeat = {}, sibBySeat = {};
  for (const s of FLOWS.seats) {
    const G = s.candidates.map((c) => c.group), mem = G.findIndex((g) => g.startsWith("member"));
    for (const f of s.flows) {
      const ex = G[f.excluded], tot = Object.values(f.to).reduce((a, b) => a + b, 0); if (!tot) continue;
      if (COAL.has(ex)) { const partner = Object.entries(f.to).filter(([k]) => COAL.has(G[+k]) && +k !== f.excluded).reduce((a, [, v]) => a + v, 0); if (partner > 0) sibBySeat[s.name] = partner / tot; }
      if (mem >= 0 && f.excluded !== mem && f.to[mem] != null) {
        const c = clsOfGroup(ex), share = f.to[mem] / tot;
        (nat[c] = nat[c] || []).push(share);
        const k = c === "OTH" ? ["OTH-R", "OTH-M", "OTH-L"] : [c];
        for (const kk of k) ((capBySeat[s.name] = capBySeat[s.name] || {})[kk] = share);
      }
    }
  }
  const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const capNat = { ALP: avg(nat.ALP), COAL: avg(nat.COAL), GRN: avg(nat.GRN), ON: avg(nat.ON), "OTH-R": avg(nat.OTH), "OTH-M": avg(nat.OTH), "OTH-L": avg(nat.OTH), _: avg(nat.OTH) };
  return { capNat, capBySeat, sibBySeat };
}

function ridgePredict(X, y, lambda) {
  const n = X.length, p = X[0].length;
  const mx = Array.from({ length: p }, (_, j) => X.reduce((a, r) => a + r[j], 0) / n);
  const sx = Array.from({ length: p }, (_, j) => Math.sqrt(X.reduce((a, r) => a + (r[j] - mx[j]) ** 2, 0) / n) || 1);
  const my = y.reduce((a, b) => a + b, 0) / n;
  const Z = X.map((r) => r.map((v, j) => (v - mx[j]) / sx[j]));
  const A = Array.from({ length: p }, () => new Array(p).fill(0)), c = new Array(p).fill(0);
  for (let i = 0; i < n; i++) for (let j = 0; j < p; j++) { c[j] += Z[i][j] * (y[i] - my); for (let k = 0; k < p; k++) A[j][k] += Z[i][j] * Z[i][k]; }
  for (let j = 0; j < p; j++) A[j][j] += lambda;
  const M = A.map((r, i) => [...r, c[i]]);
  for (let i = 0; i < p; i++) { let piv = i; for (let r = i + 1; r < p; r++) if (Math.abs(M[r][i]) > Math.abs(M[piv][i])) piv = r; [M[i], M[piv]] = [M[piv], M[i]]; for (let r = 0; r < p; r++) if (r !== i) { const f = M[r][i] / M[i][i]; for (let k = i; k <= p; k++) M[r][k] -= f * M[i][k]; } }
  const b = M.map((r, i) => r[p] / r[i]);
  return (x) => my + x.reduce((a, v, j) => a + b[j] * (v - mx[j]) / sx[j], 0);
}
