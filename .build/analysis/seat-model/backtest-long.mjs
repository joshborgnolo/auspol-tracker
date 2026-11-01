#!/usr/bin/env node
/* backtest-long.mjs: the seat chain re-run for every federal election 2001-2025 from what was known at the
   previous one, with each election's actual national vote given, so what is tested is the step from votes
   to seats: the logit swing and its seat-level terms, the seat noise and its tails, and the preferences.

   For test election E (previous election P):
     primaries  each seat's notional P share per party group (the AEC's swing column), moved by the logit
                swing to E's actual national totals with state shocks drawn (or E's state totals given),
                plus the seat terms of swing-fit.mjs (sitting members, defections, reversion) FITTED ON
                ELECTIONS BEFORE E ONLY
     noise      Student-t seat noise sized on the RMS of the same terms' residuals at the (up to) three
                elections before E, times a multiplier scored here
     flows      "house": the previous House count's flows - every counted preference flow of P (each
                excluded candidate's split between the final two), by party, set on the shape of the 2016
                Senate ballots (orders among Labor, Coalition, Greens, One Nation) by tilting each observed
                pair to P's own level, statewide, then each seat toward its own P flow (shrunk);
                "senate" (2019-2025 only): P's Senate ballots, as backtest-chain.mjs and the 2028 run
   Variants (pass AUSPOL_BL_VARIANTS=a,b,...): v21 = the model before this review (no seat terms, noise from
   the plain residuals x1.3); terms = with the seat terms; terms-m<k> = noise multiplier k; terms-t<df>.
   Writes data/seat-model-backtest-long.json (AUSPOL_BL_NOWRITE=1 to skip). */
import { readFileSync, writeFileSync } from "node:fs";
import { rng, spreadShares, count, FLOW_CLASSES } from "./seat-engine.mjs";
import { cohortTable, stateTable, pairShare, tiltPair, routing, cohortKeyFor, FAM_OF_GROUP, FAM } from "./senate-flows.mjs";
import { loadRankings } from "./senate-io.mjs";
import { calibratedTable, houseHistory, flowClassOf, P5_OF, settings } from "./seat-inputs.mjs";
import { loadHistory, historyRows, fitTerms, stage1Residuals, termsFor, rmsOf, LONG_YEARS, PREV_OF } from "./swing-fit.mjs";

const DRAWS = +(process.env.AUSPOL_BL_DRAWS || 2000);
const TESTS = (process.env.AUSPOL_BL_TESTS || "2001,2004,2007,2010,2013,2016,2019,2022,2025").split(",").map(Number);
const VARIANTS = (process.env.AUSPOL_BL_VARIANTS || "v21,terms,inc,rho,terms-m1.0,terms-m1.15,terms-m1.5,terms-m1.7,terms-t4,terms-t8").split(",");
const MODES = (process.env.AUSPOL_BL_MODES || "house,senate").split(",");
const ORACLES = (process.env.AUSPOL_BL_ORACLE || "nation").split(",");
const J = (f) => JSON.parse(readFileSync(f, "utf8"));
const logit = (p) => Math.log(p / (1 - p)), ilogit = (x) => 1 / (1 + Math.exp(-x));
const clamp = (p) => Math.min(0.995, Math.max(0.005, p));
const sum = (a) => a.reduce((s, x) => s + x, 0);
const CAL = J("data/seat-model-calibration.json");
const H = loadHistory(), RES = H.RES, INC = H.INC;
const ROWS = historyRows(H);
const SEN16 = loadRankings(2016);
const SENY = {}; const sen = (y) => (SENY[y] = SENY[y] || loadRankings(y));

/* party codes of the statistics-era files (names there are codes too) -> Senate cohort keys */
const CODE_KEY = { DEM: "OTH:DEM", AD: "OTH:DEM", AFI: "OTH:RGT", FST: "OTH:RGT", CTA: "OTH:XTN", CDP: "OTH:XTN", FFP: "OTH:FF", CAP: "OTH:RGT", PUP: "OTH:TOP", UAPP: "OTH:TOP",
  KAP: "OTH:KAP", LDP: "OTH:LDP", DLP: "OTH:RGT", ASXP: "OTH:REA", SPP: "OTH:SAP", AJP: "OTH:AJP", ASP: "OTH:SFF", SFF: "OTH:SFF", CEC: "OTH:CIT", ON: null, HAN: null };
const GROUP = (c) => (c[3] === "alp" ? "alp" : c[3] === "grn" ? "grn" : c[3] === "onp" ? "on" : c[3] === "lnp" ? ({ LP: "lp", NP: "np", NAT: "np", NPA: "np", LNP: "lnp", LNQ: "lnp", CLP: "clp" }[c[1]] || "lnp") : c[3] === "ind" ? "member:" + c[0] : "oth");
const keyOf = (c) => { const g = GROUP(c); if (g === "oth" && CODE_KEY[c[1]]) return CODE_KEY[c[1]]; return cohortKeyFor({ group: g.startsWith("member") ? "member" : g, party: c[1], partyName: c[2] }); };
const BUCKET = (g) => (g === "alp" ? "alp" : ["lp", "np", "lnp", "clp"].includes(g) ? "lnp" : g === "on" ? "on" : g === "grn" ? "grn" : g.startsWith("member") ? "ind" : "oth");
const BKS = ["alp", "lnp", "on", "grn", "ind", "oth"];
const FAMB = { alp: 0, lnp: 1, grn: 2, onp: 3 };

/* ---- the previous House count's flows as ranking tables (house mode) ---- */
function houseRankings(P, E) {
  const D = RES[P], T = SEN16, L = T.P.length;
  const acc = { nat: {}, st: {}, div: {} }; // [key][pair] -> [sum n*logit h, sum n]
  const add = (store, k, pair, h, n) => { const o = ((store[k] = store[k] || {})[pair] = store[k]?.[pair] || [0, 0]); o[0] += n * logit(clamp(h)); o[1] += n; };
  for (const dv of D.divs) {
    if (!dv.tcp || dv.tcp.length !== 2) continue;
    const fins = dv.tcp.map((t) => FAMB[dv.c[t[0]][3]]);
    if (fins.some((f) => f == null) || fins[0] === fins[1]) continue;
    const [x, y] = fins[0] < fins[1] ? [fins[0], fins[1]] : [fins[1], fins[0]], xi = fins[0] === x ? 0 : 1, pair = FAM[x] + FAM[y];
    for (const f of dv.fl || []) {
      const c = dv.c[f[0]], n = f[1] + f[2]; if (n < 50) continue;
      const k = keyOf(c), h = (xi === 0 ? f[1] : f[2]) / n;
      const ks = [k]; if (k.startsWith("COAL:")) ks.push("COAL"); if (k.startsWith("OTH:")) ks.push("OTH-" + flowClassOf(k).slice(4), "OTH"); if (k.startsWith("OTH-")) ks.push("OTH");
      for (const kk of ks) { add(acc.nat, kk, pair, h, n); add((acc.st[dv.st] = acc.st[dv.st] || {}), kk, pair, h, n); }
      add((acc.div[dv.n] = acc.div[dv.n] || {}), k, pair, h, n);
    }
  }
  const level = (o) => (o && o[1] >= 300 ? o[0] / o[1] : null);
  const tiltTo = (p, pair, target) => { if (target == null) return p; const x = "ACGO".indexOf(pair[0]), y = "ACGO".indexOf(pair[1]); const have = logit(clamp(pairShare(T, p, x, y))); return tiltPair(T, p, x, y, target - have); };
  const keysAll = new Set([...Object.keys(T.nat), ...Object.keys(acc.nat)]);
  const R = { year: P, P: T.P, pat: T.pat, pidx: T.pidx, div: {}, state: {}, nat: {} };
  const BIG = 1e6;
  for (const k of keysAll) {
    let pn; try { pn = cohortTable(T, null, k); } catch { continue; }
    for (const [pair, o] of Object.entries(acc.nat[k] || {})) pn = tiltTo(pn, pair, level(o));
    R.nat[k] = pn.map((v) => v * BIG);
  }
  const states = new Set(RES[E].divs.map((d) => d.st));
  const stateVec = {};
  for (const st of states) {
    R.state[st] = {}; stateVec[st] = {};
    for (const k of keysAll) {
      if (!R.nat[k]) continue;
      let ps = T.state[st]?.[k] ? stateTable(T, st, k) : R.nat[k].map((v) => v / BIG);
      // levels: the state's own P flow where counted, else the nation's
      const pairs = new Set([...Object.keys(acc.nat[k] || {}), ...Object.keys(acc.st[st]?.[k] || {})]);
      for (const pair of pairs) ps = tiltTo(ps, pair, level(acc.st[st]?.[k]?.[pair]) ?? level(acc.nat[k]?.[pair]));
      stateVec[st][k] = ps; R.state[st][k] = ps.map((v) => v * BIG);
    }
  }
  const N0 = 1500; // a seat's own P flow counts as n/(n+1500) of its level
  for (const dv of RES[E].divs) {
    const own = acc.div[dv.n] || {};
    const d = (R.div[dv.n] = { st: dv.st, n: BIG, t: {} });
    for (const [k, pairs] of Object.entries(own)) {
      if (!stateVec[dv.st][k]) continue;
      let p = stateVec[dv.st][k];
      for (const [pair, o] of Object.entries(pairs)) {
        const x = "ACGO".indexOf(pair[0]), y = "ACGO".indexOf(pair[1]);
        const sl = logit(clamp(pairShare(T, p, x, y))), hl = o[0] / o[1], w = o[1] / (o[1] + N0);
        p = tiltPair(T, p, x, y, w * (hl - sl));
      }
      d.t[k] = p.map((v) => v * BIG);
    }
  }
  return R;
}

/* ---- the previous election's Senate ballots, as the 2028 run reads them (senate mode, 2019+) ---- */
function senateSettings(E) {
  const FCAL = J("data/seat-model-flow-calibration.json");
  return settings(FCAL); // full-sample settings: the senate-mode tests here are for comparison only (backtest-chain.mjs fits them out of sample)
}

/* ---- seats at E ---- */
function seatsFor(E, mode, terms, s1P) {
  const P = PREV_OF[E];
  let Rs, ST, hist;
  if (mode === "senate") { Rs = sen(P); ST = senateSettings(E); hist = houseHistory(RES[P], Rs); }
  else { Rs = houseRankings(P, E); ST = { lamAlone: Object.fromEntries(FLOW_CLASSES.map((k) => [k, 1])), lamComb: {}, delta: {} }; hist = { bySeat: {}, mean: {} }; }
  const D = RES[E];
  let kON = 0.8;
  if (mode === "senate") { let hon = 0, son = 0; for (const dv of RES[P].divs) { const t = sum(dv.c.map((c) => c[4])); const h = sum(dv.c.filter((c) => c[3] === "onp").map((c) => c[4])); const sd = Rs.div[dv.n]; if (h > 0 && sd?.t.ON) { hon += h / t; son += sum(sd.t.ON) / sd.n; } } if (son > 0) kON = hon / son; }
  const seats = [];
  for (const dv of D.divs) {
    const tot = sum(dv.c.map((c) => c[4]));
    const dp = RES[P].divs.find((d) => d.n === dv.n), ip = dp ? INC[P][dv.n] : null;
    const byB = {}; for (const c of dv.c) { const b = BUCKET(GROUP(c)); (byB[b] = byB[b] || { share: 0, base: 0 }); byB[b].share += c[4] / tot; byB[b].base += c[5] == null ? 0 : c[4] / tot - c[5] / 100; }
    const adjOf = {};
    for (const [b, rb] of [["alp", "alp"], ["lnp", "lnp"], ["grn", "grn"], ["on", "onp"]]) {
      const t = terms?.[rb]; if (!t) continue;
      const tt = termsFor(dv, INC[E][dv.n], dp, ip, rb);
      const prevE = dp ? s1P.get(P + "|" + dv.n + "|" + rb) ?? 0 : 0;
      adjOf[b] = t.incE * tt.incE + t.incP * tt.incP + t.defect * tt.defect + t.rho * prevE;
    }
    const cands = dv.c.map((c) => {
      const g = GROUP(c), b = BUCKET(g), sh = c[4] / tot;
      let base = byB[b].base > 0.002 ? byB[b].base * sh / byB[b].share : 0;
      if (base <= 0.002 && b === "on") { const sd = mode === "senate" ? Rs.div[dv.n] : null; base = sd?.t.ON ? kON * sum(sd.t.ON) / sd.n : 0.02; }
      if (base <= 0.002) base = b === "ind" ? 0.01 : 0.004;
      const key = keyOf(c), cls = flowClassOf(key);
      return { label: c[0], group: g, p5: P5_OF(g.startsWith("member") ? "oth" : g), fam: FAM_OF_GROUP[g] ?? -1, isInd: g.startsWith("member"), base, adj: adjOf[b] || 0, key, cls, clsIdx: FLOW_CLASSES.indexOf(cls) };
    });
    const tables = {};
    for (const c of cands) { const p = (tables[c.key] = tables[c.key] || calibratedTable(Rs, ST, { st: dv.st }, dv.n, c.key, hist)); c.route = routing(Rs, p); }
    const w = dv.c.find((c) => c[6] === 1);
    const pairB = dv.tcp && dv.tcp.length === 2 ? dv.tcp.map((t) => BUCKET(GROUP(dv.c[t[0]]))).sort().join("|") : null;
    const ws = dv.tcp ? dv.tcp.find((t) => dv.c[t[0]] === w) : null;
    seats.push({ name: dv.n, st: dv.st, cls: dv.cls || "Outer Metropolitan", w: tot, uni: dv.demo?.uni ?? null, cands,
      iota: { ALP: 0.73, COAL: 0.73, GRN: 0.49, ON: 0.28, "OTH-R": 0.23, "OTH-M": 0.23, "OTH-L": 0.23, _: 0.23 }, sib: 0.72,
      actual: { w: BUCKET(GROUP(w)), pair: pairB, share: ws ? ws[1] / (dv.tcp[0][1] + dv.tcp[1][1]) : null } });
  }
  const us = seats.map((s) => s.uni).filter((v) => v != null), mu = us.length ? sum(us) / us.length : 0, sd = us.length ? Math.sqrt(sum(us.map((u) => (u - mu) ** 2)) / us.length) : 1;
  for (const s of seats) s.z = s.uni == null ? 0 : (s.uni - mu) / sd;
  return seats;
}

/* ---- the settings known at E: terms fitted before E, noise from the residuals of the elections before E ---- */
const settingsCache = {};
function knownAt(E) {
  if (settingsCache[E]) return settingsCache[E];
  const train = LONG_YEARS.filter((y) => y >= 1996 && y < E);
  const fit = fitTerms(ROWS, train);
  const s1 = stage1Residuals(ROWS, LONG_YEARS.filter((y) => y <= PREV_OF[E]), fit.terms);
  const last3 = train.slice(-3);
  const sigOf = (rows, b) => rmsOf(rows.filter((r) => r.b === b && last3.includes(r.E)).map((r) => r.e));
  // v21's noise: the plain residuals (no seat terms), as the model before this review sized it
  const zero = { incE: 0, incP: 0, defect: 0, rho: 0 };
  const plainFit = stage1Residuals(ROWS, train, { alp: zero, lnp: zero, grn: zero, onp: zero });
  const plainSig = (b) => rmsOf([...plainFit.entries()].filter(([k]) => k.endsWith("|" + b) && last3.includes(+k.split("|")[0])).map(([, v]) => v));
  const out = {
    terms: fit.terms, s1,
    sigTerms: [sigOf(fit.rows, "alp"), sigOf(fit.rows, "lnp"), sigOf(fit.rows, "onp") ?? 0.25, sigOf(fit.rows, "grn"), 0.35],
    sigPlain: [plainSig("alp"), plainSig("lnp"), plainSig("onp") ?? 0.25, plainSig("grn"), 0.35],
  };
  out.sigTerms[2] = out.sigTerms[2] ?? 0.25; out.sigPlain[2] = out.sigPlain[2] ?? 0.25;
  return (settingsCache[E] = out);
}

function run(E, mode, variant, stateOracle) {
  const K = knownAt(E);
  const useTerms = !variant.startsWith("v21");
  const mult = /-m([\d.]+)/.test(variant) ? +variant.match(/-m([\d.]+)/)[1] : 1.3;
  const tdf = /-t(\d+)/.test(variant) ? +variant.match(/-t(\d+)/)[1] : 5;
  // inc = sitting-member terms only; rho = reversion only; terms = both
  const T = useTerms ? Object.fromEntries(Object.entries(K.terms).map(([b, t]) => [b, variant.startsWith("inc") ? { ...t, rho: 0 } : variant.startsWith("rho") ? { incE: 0, incP: 0, defect: 0, rho: t.rho } : t])) : null;
  const seats = seatsFor(E, mode, T, K.s1);
  if (!useTerms) for (const s of seats) for (const c of s.cands) c.adj = 0;
  const SIG = useTerms ? K.sigTerms : K.sigPlain;
  const D = RES[E];
  const shareP5 = (divs) => { const v = [0, 0, 0, 0, 0]; let t = 0; for (const dv of divs) for (const c of dv.c) { const g = GROUP(c); v[P5_OF(g.startsWith("member") ? "oth" : g)] += c[4]; t += c[4]; } return v.map((x) => x / t); };
  const natT = shareP5(D.divs);
  const groups = stateOracle ? [...new Set(seats.map((s) => s.st))].map((st) => ({ idx: seats.map((s, i) => (s.st === st ? i : -1)).filter((i) => i >= 0), targets: shareP5(D.divs.filter((d) => d.st === st)) })) : null;
  const stateSD = CAL.swing.stateDev;
  const classSD = [0.04, 0.05, 0.07, 0.045, 0.06];
  const R = rng(7000 + E);
  const win = seats.map(() => ({})), tallies = [], expSeats = Object.fromEntries(BKS.map((b) => [b, 0]));
  for (let d = 0; d <= DRAWS; d++) {
    const det = d === DRAWS;
    const stShift = {}; for (const st of new Set(seats.map((s) => s.st))) stShift[st] = det || stateOracle ? [0, 0, 0, 0, 0] : [stateSD.alp, stateSD.lnp, stateSD.onp, stateSD.grn, 0.15].map((s) => R.norm() * s);
    const cl = {}; for (const c of ["Inner Metropolitan", "Outer Metropolitan", "Provincial", "Rural"]) cl[c] = [0, 1, 2, 3, 4].map((k) => (det ? 0 : R.norm() * classSD[k]));
    const edu = [0, 1, 2, 3, 4].map(() => (det ? 0 : R.norm() * 0.04));
    const dev = (i, j) => { const s = seats[i], c = s.cands[j], k = c.p5; const a = c.adj || 0; if (det) return a; return a + stShift[s.st][k] + (cl[s.cls]?.[k] ?? 0) + edu[k] * s.z + R.t(tdf) * (c.isInd ? 0.3 : SIG[k]) * mult; };
    const sh = spreadShares(seats, natT, dev, R, groups);
    let shock = null;
    if (!det) { shock = new Float64Array(FLOW_CLASSES.length * 4); FLOW_CLASSES.forEach((k, ci) => { for (let y = 0; y < 4; y++) shock[ci * 4 + y] = R.norm() * (k === "ON" ? 0.25 : 0.15) / Math.SQRT2; }); }
    const t = Object.fromEntries(BKS.map((b) => [b, 0]));
    seats.forEach((s, i) => {
      let ss = null; if (!det) { ss = new Float64Array(FLOW_CLASSES.length * 4); for (let k = 0; k < ss.length; k++) ss[k] = R.norm() * 0.25 / Math.SQRT2; }
      const fin = count(s, sh[i], shock, ss);
      const wb = BUCKET(s.cands[fin[0][0]].group), pb = [wb, BUCKET(s.cands[fin[1][0]].group)].sort().join("|");
      if (det) { s.det = { w: wb, pair: pb, share: fin[0][1] / (fin[0][1] + fin[1][1]) }; return; }
      win[i][wb] = (win[i][wb] || 0) + 1; t[wb]++;
    });
    if (!det) { tallies.push(t); for (const b of BKS) expSeats[b] += t[b] / DRAWS; }
  }
  let brier = 0, logs = 0, modal = 0, detOk = 0, pairOk = 0, tcpE = [], n = 0;
  const upsets = []; // seats whose winner the model gave under 10%
  const actualSeats = Object.fromEntries(BKS.map((b) => [b, 0]));
  const bins = [[0, 0.1], [0.1, 0.3], [0.3, 0.5], [0.5, 0.7], [0.7, 0.9], [0.9, 1.01]].map(([lo, hi]) => ({ lo, hi, p: 0, o: 0, n: 0 }));
  seats.forEach((s, i) => {
    const a = s.actual.w; actualSeats[a]++;
    const p = Object.fromEntries(BKS.map((b) => [b, (win[i][b] || 0) / DRAWS]));
    brier += sum(BKS.map((b) => (p[b] - (b === a ? 1 : 0)) ** 2));
    logs += Math.log(Math.max(p[a], 0.5 / DRAWS));
    if (process.env.AUSPOL_BL_DUMP) console.log(`SEAT ${E} ${variant} ${s.name} ${a} ${p[a].toFixed(4)}`);
    if (p[a] < 0.1) upsets.push({ seat: s.name, winner: a, p: +p[a].toFixed(4) });
    if (Object.entries(p).sort((x, y) => y[1] - x[1])[0][0] === a) modal++;
    if (s.det.w === a) detOk++;
    if (s.actual.pair && s.det.pair === s.actual.pair) { pairOk++; if (s.actual.share != null) tcpE.push(Math.abs((s.det.w === a ? s.det.share : 1 - s.det.share) - s.actual.share)); }
    for (const b of BKS) { const pb = p[b]; if (pb === 0 && a !== b) continue; const bin = bins.find((x) => pb >= x.lo && pb < x.hi); bin.p += pb; bin.o += a === b ? 1 : 0; bin.n++; }
    n++;
  });
  const q = (b, pp) => { const xs = tallies.map((t) => t[b]).sort((x, y) => x - y); return xs[Math.floor(pp * (xs.length - 1))]; };
  const pit = Object.fromEntries(["alp", "lnp"].map((b) => [b, +(tallies.filter((t) => t[b] < actualSeats[b]).length / DRAWS + 0.5 * tallies.filter((t) => t[b] === actualSeats[b]).length / DRAWS).toFixed(3)]));
  return { E, mode, variant, stateOracle, brier: +(brier / n).toFixed(4), logScore: +(logs / n).toFixed(4), modalRight: modal, deterministicRight: detOk, pairsRight: pairOk, seats: n,
    tcpMaePts: tcpE.length ? +(100 * sum(tcpE) / tcpE.length).toFixed(2) : null,
    expected: Object.fromEntries(BKS.map((b) => [b, +expSeats[b].toFixed(1)])), actual: actualSeats,
    range90: Object.fromEntries(["alp", "lnp"].map((b) => [b, [q(b, 0.05), q(b, 0.95)]])), pit,
    calibration: bins.filter((b) => b.n).map((b) => ({ bin: `${b.lo}-${Math.min(1, b.hi)}`, p: +b.p.toFixed(3), o: b.o, n: b.n })), upsets };
}

const results = [];
const t0 = Date.now();
for (const mode of MODES) for (const E of TESTS) for (const oracle of ORACLES) for (const variant of VARIANTS) {
  if (mode === "senate" && E < 2019) continue;
  const r = run(E, mode, variant, oracle === "state");
  results.push(r);
  console.log(`${E} ${mode.padEnd(6)} ${oracle.padEnd(6)} ${variant.padEnd(10)} Brier ${r.brier.toFixed(4)} log ${r.logScore.toFixed(3)} | winners ${r.modalRight}/${r.seats} (no-noise ${r.deterministicRight}) pairs ${r.pairsRight} TCP ${r.tcpMaePts} | exp ALP ${r.expected.alp} L/NP ${r.expected.lnp} v ${r.actual.alp}/${r.actual.lnp} 90% ${r.range90.alp}/${r.range90.lnp} | ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
// pooled per mode x oracle x variant
const pooled = {};
for (const r of results) { const k = `${r.mode}|${r.stateOracle ? "state" : "nation"}|${r.variant}`; const p = (pooled[k] = pooled[k] || { n: 0, brier: 0, logScore: 0, modal: 0, det: 0, pairs: 0, seats: 0, elections: 0, cover: { alp: 0, lnp: 0 }, pit: { alp: [], lnp: [] } }); p.brier += r.brier * r.seats; p.logScore += r.logScore * r.seats; p.modal += r.modalRight; p.det += r.deterministicRight; p.pairs += r.pairsRight; p.seats += r.seats; p.elections++; for (const b of ["alp", "lnp"]) { if (r.actual[b] >= r.range90[b][0] && r.actual[b] <= r.range90[b][1]) p.cover[b]++; p.pit[b].push(r.pit[b]); } }
console.log("\npooled:");
for (const [k, p] of Object.entries(pooled)) console.log(`  ${k.padEnd(28)} Brier ${(p.brier / p.seats).toFixed(4)} log ${(p.logScore / p.seats).toFixed(4)} winners ${p.modal}/${p.seats} (no-noise ${p.det}) pairs ${p.pairs} | seat totals inside 90%: ALP ${p.cover.alp}/${p.elections} L/NP ${p.cover.lnp}/${p.elections} | PIT ALP ${p.pit.alp.join(" ")}`);
if (process.env.AUSPOL_BL_MERGE) { // re-run some rows: keep the stored others, recompute the pooled block
  const prev = JSON.parse(readFileSync("data/seat-model-backtest-long.json", "utf8"));
  const key = (r) => `${r.E}|${r.mode}|${r.variant}|${r.stateOracle}`, fresh = new Map(results.map((r) => [key(r), r]));
  const merged = prev.results.map((r) => fresh.get(key(r)) || r); for (const r of results) if (!prev.results.some((q) => key(q) === key(r))) merged.push(r);
  results.length = 0; results.push(...merged);
  for (const k of Object.keys(pooled)) delete pooled[k];
  for (const r of results) { const k = `${r.mode}|${r.stateOracle ? "state" : "nation"}|${r.variant}`; const p = (pooled[k] = pooled[k] || { n: 0, brier: 0, logScore: 0, modal: 0, det: 0, pairs: 0, seats: 0, elections: 0, cover: { alp: 0, lnp: 0 }, pit: { alp: [], lnp: [] } }); p.brier += r.brier * r.seats; p.logScore += r.logScore * r.seats; p.modal += r.modalRight; p.det += r.deterministicRight; p.pairs += r.pairsRight; p.seats += r.seats; p.elections++; for (const b of ["alp", "lnp"]) { if (r.actual[b] >= r.range90[b][0] && r.actual[b] <= r.range90[b][1]) p.cover[b]++; p.pit[b].push(r.pit[b]); } }
}
if (!process.env.AUSPOL_BL_NOWRITE) {
  writeFileSync("data/seat-model-backtest-long.json", JSON.stringify({ _about: "backtest-long.mjs: the seat chain for every federal election 2001-2025 from what was known at the previous election (seat terms fitted before E only, noise from the three elections before E), national vote given (state shocks drawn) or state totals given; flows from the previous House count's flows (house) or the previous Senate ballots (senate, 2019+).", draws: DRAWS, results, pooled: Object.fromEntries(Object.entries(pooled).map(([k, p]) => [k, { elections: p.elections, seats: p.seats, brier: +(p.brier / p.seats).toFixed(4), logScore: +(p.logScore / p.seats).toFixed(4), modalRight: p.modal, deterministicRight: p.det, pairsRight: p.pairs, inside90: p.cover, pit: p.pit }])) }, null, 1) + "\n");
  console.log("wrote data/seat-model-backtest-long.json");
}
