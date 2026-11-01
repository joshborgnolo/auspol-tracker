#!/usr/bin/env node
/* backtest-states.mjs: the flow layer on real state elections, out of sample. Each election is counted from
   its ACTUAL district primaries, with every candidate's preferences read from the most recent FEDERAL
   Senate ballots before it, at the nearest federal booth to each state booth
   (.build/aec-flow-src/senate-ballots/booth-rankings-<year>.json.gz), House-calibrated as the 2028 model
   is. No state count went into any setting. Full-preferential elections only (NSW's optional
   preferential ballots exhaust, which this count does not model):
     SA 2026 (One Nation 2.6 -> 22.9; ON in 31 of 47 final pairs)      2025 Senate
     Queensland 2017 (ON in 21 of 93 final pairs)                       2016 Senate
     Victoria 2022, Queensland 2020 and 2024, SA 2022 (classic)         2022 / 2019 / 2022 / 2019 Senate
   Compared on the same primaries with the flow schemes used before: W5's constants (Coalition->Labor 21.5%
   v ON, Labor->Coalition 60%, others never to ON) and the design review's seat-type grading. For the two
   three-way elections the whole chain is also run: district primaries from the federal booth footprint by
   the logit swing with the statewide totals given, noise drawn, scored by Brier and log score.
   Writes data/seat-model-backtest-states.json. */
import { readFileSync, writeFileSync } from "node:fs";
import { rng, spreadShares, count, FLOW_CLASSES } from "./seat-engine.mjs";
import { tiltPair, moveFirst, mix, routing, subOfName, SUB_CLASS, FAM_OF_GROUP } from "./senate-flows.mjs";
import { stateDistrictTables } from "./state-tables.mjs";
import { settings, switching, flowClassOf } from "./seat-inputs.mjs";

const J = (f) => JSON.parse(readFileSync(f, "utf8"));
const ELECTIONS = [
  { id: "sa26", label: "SA 2026", res: "res-sa26", sen: 2025, st: "SA", threeWay: true, switching: true },
  { id: "qld17", label: "Queensland 2017", res: "res-qld17", sen: 2016, st: "QLD", threeWay: true },
  { id: "vic22", label: "Victoria 2022", res: "res-vic22", sen: 2022, st: "VIC" },
  { id: "qld20", label: "Queensland 2020", res: "res-qld20", sen: 2019, st: "QLD" },
  { id: "qld24", label: "Queensland 2024", res: "res-qld24", sen: 2022, st: "QLD" },
  { id: "sa22", label: "SA 2022", res: "res-sa22", sen: 2019, st: "SA" },
];
const ST = settings(J("data/seat-model-flow-calibration.json"));
const COMP = switching(J("data/vote-switching.json"));
const COH = ["ALP", "COAL", "GRN", "ON", "OTH-R", "OTH-M", "OTH-L"];
const B = (g) => (g === "alp" ? "alp" : ["lp", "np", "lnp", "clp"].includes(g) ? "lnp" : g === "on" ? "onp" : g === "grn" ? "grn" : g.startsWith("member") ? "ind" : "oth");
const W5 = { ALP: [100, 0.6, 0.8, 0.4], COAL: [0.215, 100, 0.1, 0.785], GRN: [0.8819, 0.1181, 100, 1e-6], ON: [0.255, 0.745, 0.02, 100], "OTH-R": [0.5455, 0.4545, 0.1, 1e-6], "OTH-M": [0.5455, 0.4545, 0.1, 1e-6], "OTH-L": [0.5455, 0.4545, 0.1, 1e-6] };
const CENTRAL = { ALP: [100, 0.30, 0.40, 0.10], GRN: [0.62, 0.10, 100, 0.04], ON: [0.15, 0.50, 0.02, 100], "OTH-R": [0.25, 0.25, 0.10, 0.25], "OTH-M": [0.25, 0.25, 0.10, 0.25], "OTH-L": [0.25, 0.25, 0.10, 0.25] };
const GRADE_C = { "Inner Metropolitan": 0.40, "Outer Metropolitan": 0.345, "Provincial": 0.31, "Rural": 0.24 };
const GRADE_A = { "Inner Metropolitan": 0.75, "Outer Metropolitan": 0.70, "Provincial": 0.65, "Rural": 0.60 };
const IOTA = { ALP: 0.73, COAL: 0.73, GRN: 0.49, ON: 0.28, "OTH-R": 0.23, "OTH-M": 0.23, "OTH-L": 0.23, _: 0.23 };

function runElection(E) {
  // the districts' Senate tables, federal seat types and footprint: shared with the Victorian model
  const { SEN, L, sd, tables, distCls, foot } = stateDistrictTables({ sen: E.sen, st: E.st, res: E.res, ST });
  /* diagnostic: the same tables with each donor class's statewide level per final pair set to the state's
     own (modelled) count, so what is left is the Senate's seat-to-seat pattern - separates level drift
     between the two elections from the geography */
  const FAMB = { alp: 0, lnp: 1, grn: 2, onp: 3 };
  const keyOfC = (c) => { const b = c[3]; if (b === "alp") return "ALP"; if (b === "lnp") return "COAL"; if (b === "grn") return "GRN"; if (b === "onp") return "ON"; if (b === "ind") return "OTH-M"; const s = subOfName(c[2]); return s.startsWith("OTH:") ? "OTH-" + (SUB_CLASS[s.slice(4)] || "M") : "OTH-M"; };
  const lv = {}; // class|pair -> [obs to x, total, model to x]
  sd.divs.forEach((dv, i) => {
    if (!dv.tcp || dv.tcp.length !== 2) return;
    const fins = dv.tcp.map((t) => FAMB[dv.c[t[0]][3]]); if (fins.some((f) => f == null) || fins[0] === fins[1]) return;
    const [x, y] = fins[0] < fins[1] ? [fins[0], fins[1]] : [fins[1], fins[0]], xi = fins[0] === x ? 0 : 1;
    for (const f of dv.fl || []) {
      const c = dv.c[f[0]], n = f[1] + f[2]; if (n < 50) continue;
      const k = keyOfC(c); if (k === "COAL" && (x === 1 || y === 1)) continue;
      const kk = k + "|" + "ACGO"[x] + "ACGO"[y]; (lv[kk] = lv[kk] || [0, 0, 0]);
      lv[kk][0] += xi === 0 ? f[1] : f[2]; lv[kk][1] += n;
      const p = tables[i][k]; let a = 0, b = 0;
      for (let q = 0; q < L; q++) { const pt = SEN.pat[q], ix = pt.indexOf(x), iy = pt.indexOf(y); if (ix < 0 && iy < 0) continue; if (iy < 0 || (ix >= 0 && ix < iy)) a += p[q]; else b += p[q]; }
      lv[kk][2] += n * a / (a + b);
    }
  });
  const lgt = (p) => Math.log(p / (1 - p));
  const levelShift = Object.fromEntries(Object.entries(lv).filter(([, v]) => v[1] >= 2000).map(([k, v]) => [k, lgt(Math.min(0.99, Math.max(0.01, v[0] / v[1]))) - lgt(Math.min(0.99, Math.max(0.01, v[2] / v[1])))]));
  const tablesLevel = tables.map((o) => Object.fromEntries(COH.map((k) => {
    let p = o[k];
    for (const [kk, d] of Object.entries(levelShift)) { const [c, pair] = kk.split("|"); if (c !== k) continue; p = tiltPair(SEN, p, "ACGO".indexOf(pair[0]), "ACGO".indexOf(pair[1]), d); }
    return [k, p];
  })));
  const plTable = (w) => { const p = new Float64Array(L); const perm = (left, acc, pr) => { if (!left.length) { p[SEN.pidx[acc]] += pr; return; } const tot = left.reduce((a, f) => a + w[f], 0); for (const f of left) perm(left.filter((x) => x !== f), acc + "ACGO"[f], pr * w[f] / tot); }; perm([0, 1, 2, 3], "", 1); return p; };
  function seatsFor(scheme, withComp) {
    return sd.divs.map((dv, i) => {
      const tot = dv.c.reduce((a, c) => a + c[4], 0);
      const cands = dv.c.map((c) => {
        const b = c[3];
        const g = b === "alp" ? "alp" : b === "lnp" ? ({ LIB: "lp", LP: "lp", NAT: "np", NP: "np", LNP: "lnp", CLP: "clp" }[c[1]] || "lp") : b === "grn" ? "grn" : b === "onp" ? "on" : b === "ind" ? "member:" + c[0] : "oth";
        const key = g === "alp" ? "ALP" : ["lp", "np", "lnp", "clp"].includes(g) ? "COAL" : g === "grn" ? "GRN" : g === "on" ? "ON" : g.startsWith("member") ? "OTH-M" : (() => { const s = subOfName(c[2]); return s.startsWith("OTH:") ? "OTH-" + (SUB_CLASS[s.slice(4)] || "M") : "OTH-M"; })();
        const cls = flowClassOf(key);
        return { label: c[0], group: g, p5: g === "alp" ? 0 : ["lp", "np", "lnp", "clp"].includes(g) ? 1 : g === "on" ? 2 : g === "grn" ? 3 : 4, fam: FAM_OF_GROUP[g] ?? -1, isInd: g.startsWith("member"), base: c[4] / tot, key, cls, clsIdx: FLOW_CLASSES.indexOf(cls) };
      });
      for (const c of cands) {
        let p;
        if (scheme === "senate" || scheme === "senate-level") {
          p = (scheme === "senate-level" ? tablesLevel : tables)[i][c.key];
          if (withComp && c.fam >= 0) {
            const X = ["alp", "lnp", "grn", "on"][c.fam];
            p = mix(Object.entries(COMP[X]).filter(([, w]) => w > 0).map(([g, w]) => {
              const gk = { alp: "ALP", lnp: "COAL", grn: "GRN", onp: "ON", ind: "OTH-M", oth: "OTH-M" }[g];
              const same = (g === "alp" && c.fam === 0) || (g === "lnp" && c.fam === 1) || (g === "grn" && c.fam === 2) || (g === "onp" && c.fam === 3);
              return [w, same ? tables[i][c.key] : moveFirst(SEN, tables[i][gk], c.fam)];
            }));
          }
        } else {
          const w = scheme === "w5" ? W5[c.key] : c.key === "COAL" ? [GRADE_C[distCls[i]], 100, 0.1, 1 - GRADE_C[distCls[i]]] : c.key === "ALP" ? [100, GRADE_A[distCls[i]], 0.8, 1 - GRADE_A[distCls[i]]] : CENTRAL[c.key];
          p = plTable(w);
        }
        c.route = routing(SEN, p);
      }
      const winC = dv.c.find((c) => c[6] === 1);
      const tcp = dv.tcp.map((t) => B2(dv.c[t[0]])).sort().join("|");
      const ws = dv.tcp.find((t) => dv.c[t[0]] === winC);
      return { name: dv.n, st: E.st, cls: distCls[i], w: tot, z: 0, cands, iota: IOTA, sib: 0.72, foot: foot[i],
        actual: { w: B2(winC), pair: tcp, share: ws ? ws[1] / (dv.tcp[0][1] + dv.tcp[1][1]) : null } };
    });
  }
  function B2(c) { return c[3] === "onp" ? "onp" : c[3]; }
  const out = { label: E.label, senate: E.sen, seats: sd.divs.length, actualSeats: {}, replay: {}, chain: {} };
  for (const dv of sd.divs) { const w = B2(dv.c.find((c) => c[6] === 1)); out.actualSeats[w] = (out.actualSeats[w] || 0) + 1; }
  const schemes = [["W5 constants", "w5", false], ["design review: seat-type grades", "graded", false], ["Senate ballots (this model)", "senate", false]];
  if (E.switching) schemes.push(["Senate ballots + vote-switching mix", "senate", true]);
  out.levelShift = Object.fromEntries(Object.entries(levelShift).map(([k, v]) => [k, +v.toFixed(3)]));
  for (const [label, scheme, withComp] of [...schemes, ["diagnostic: Senate pattern, levels set to the count", "senate-level", false]]) {
    const seats = seatsFor(scheme, withComp);
    let ok = 0, pairOk = 0; const tcpE = [], tally = {}, miss = [];
    for (const s of seats) {
      const fin = count(s, s.cands.map((c) => c.base), null, null);
      const wc = s.cands[fin[0][0]], oc = s.cands[fin[1][0]];
      const w = B(wc.group) === "onp" ? "onp" : B(wc.group), pair = [w, B(oc.group) === "onp" ? "onp" : B(oc.group)].sort().join("|");
      tally[w] = (tally[w] || 0) + 1;
      if (w === s.actual.w) ok++; else miss.push(`${s.name} (${s.actual.w}->${w})`);
      if (pair === s.actual.pair && s.actual.share != null) { pairOk++; tcpE.push(Math.abs((w === s.actual.w ? fin[0][1] / (fin[0][1] + fin[1][1]) : fin[1][1] / (fin[0][1] + fin[1][1])) - s.actual.share)); }
    }
    out.replay[label] = { winners: ok, pairs: pairOk, tcpMaePts: +(100 * tcpE.reduce((a, b) => a + b, 0) / Math.max(1, tcpE.length)).toFixed(2), seats: tally, misses: miss };
    console.log(`  ${E.label.padEnd(16)} ${label.padEnd(36)} winners ${ok}/${seats.length}, pairs ${pairOk}, TCP ${out.replay[label].tcpMaePts} | ${JSON.stringify(tally)}`);
  }
  if (E.threeWay) {
    const tgtRaw = [0, 0, 0, 0, 0]; for (const dv of sd.divs) for (const c of dv.c) { const b = c[3]; tgtRaw[b === "alp" ? 0 : b === "lnp" ? 1 : b === "onp" ? 2 : b === "grn" ? 3 : 4] += c[4]; }
    const T = tgtRaw.reduce((a, b) => a + b, 0), targets = tgtRaw.map((x) => x / T);
    for (const [label, scheme, withComp] of schemes) {
      const seats = seatsFor(scheme, withComp);
      for (const s of seats) for (const c of s.cands) if (c.fam >= 0 && s.foot.w) { const k = ["alp", "lnp", "grn", "onp"][c.fam]; c.base = Math.max(0.003, s.foot[k] / s.foot.w); }
      const R = rng(2026 + E.sen), SIG = [0.27, 0.46, 0.20, 0.24, 0.35], draws = 2000, win = seats.map(() => ({}));
      for (let d = 0; d < draws; d++) {
        const dev = (i, j) => { const c = seats[i].cands[j]; return c.fam >= 0 ? R.t(5) * SIG[c.p5] : 0; };
        const sh = spreadShares(seats, targets, dev, R);
        const shock = new Float64Array(FLOW_CLASSES.length * 4); FLOW_CLASSES.forEach((k, ci) => { for (let y = 0; y < 4; y++) shock[ci * 4 + y] = R.norm() * 0.2 / Math.SQRT2; });
        seats.forEach((s, i) => { const ss = new Float64Array(FLOW_CLASSES.length * 4); for (let k = 0; k < ss.length; k++) ss[k] = R.norm() * 0.25 / Math.SQRT2; const fin = count(s, sh[i], shock, ss); const g = s.cands[fin[0][0]].group; const w = B(g); win[i][w] = (win[i][w] || 0) + 1; });
      }
      let brier = 0, logs = 0, modal = 0; const exp = {}, ks = ["alp", "lnp", "onp", "grn", "ind", "oth"];
      seats.forEach((s, i) => { const p = Object.fromEntries(ks.map((k) => [k, (win[i][k] || 0) / draws])); brier += ks.reduce((a, k) => a + (p[k] - (k === s.actual.w ? 1 : 0)) ** 2, 0); logs += Math.log(Math.max(p[s.actual.w] ?? 0, 0.002)); if (Object.entries(p).sort((a, b) => b[1] - a[1])[0][0] === s.actual.w) modal++; for (const k of ks) exp[k] = (exp[k] || 0) + p[k]; });
      out.chain[label] = { brier: +(brier / seats.length).toFixed(4), logScore: +(logs / seats.length).toFixed(4), modal, expected: Object.fromEntries(Object.entries(exp).map(([k, v]) => [k, +v.toFixed(1)])) };
      console.log(`  ${E.label.padEnd(16)} chain ${label.padEnd(30)} Brier ${out.chain[label].brier} log ${out.chain[label].logScore} modal ${modal}/${seats.length} | expected ${JSON.stringify(out.chain[label].expected)}`);
    }
  }
  console.log(`  ${E.label.padEnd(16)} actual ${JSON.stringify(out.actualSeats)}\n`);
  return out;
}
const results = Object.fromEntries(ELECTIONS.map((E) => [E.id, runElection(E)]));
/* national flow-level drift per donor class: how far each class's level moved between a Senate election and
   the next House count, pooled over the federal transitions (calibrate-flows' previous-election election
   shifts, 2019/2022/2025) and these six state elections (levelShift, every pair with 2,000+ flow votes).
   RMS on the logit scale - what the 2028 simulation draws as its national flow shocks. */
const FCAL = J("data/seat-model-flow-calibration.json");
const pool = {};
for (const r of Object.values(results)) for (const [k, v] of Object.entries(r.levelShift || {})) { const c = k.split("|")[0]; (pool[c] = pool[c] || []).push(v); }
for (const [c, b] of Object.entries(FCAL.lag.byClass || {})) for (const v of Object.values(b.electionShifts || {})) (pool[c] = pool[c] || []).push(v);
const drift = Object.fromEntries(Object.entries(pool).map(([c, vs]) => [c, { sigma: +Math.sqrt(vs.reduce((a, v) => a + v * v, 0) / vs.length).toFixed(3), n: vs.length }]));
console.log("national flow-level drift (logit RMS) by donor class: " + Object.entries(drift).map(([c, d]) => `${c} ${d.sigma} (n ${d.n})`).join(", "));
writeFileSync("data/seat-model-backtest-states.json", JSON.stringify({ _about: "backtest-states.mjs: state elections counted on their actual primaries with preferences from the previous federal Senate ballots (nearest federal booth to each state booth, House-calibrated as the 2028 model is), against W5's constants and the design review's seat-type grades, plus a diagnostic with each donor class's statewide level set to the state's own count (the Senate pattern alone); for the three-way elections (SA 2026, Queensland 2017) also the whole chain from the federal booth footprint with noise. Out of sample: no state count went into any setting. `drift` = RMS of the level shifts per donor class pooled with the federal previous-election shifts: the 2028 model's national flow shocks.", drift, results }, null, 1) + "\n");
console.log("wrote data/seat-model-backtest-states.json");
