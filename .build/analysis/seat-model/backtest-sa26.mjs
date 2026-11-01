#!/usr/bin/env node
/* backtest-sa26.mjs: the flow layer in a real three-way election. SA 2026 (One Nation 2.6 -> 22.9,
   Liberals 36.2 -> 19.0; One Nation in 31 of 47 final pairs) counted from its ACTUAL district
   primaries, with preferences from the 2025 FEDERAL Senate ballots at the nearest federal booth to each
   state booth (.build/aec-flow-src/senate-ballots/booth-rankings-2025.json.gz), House-calibrated as the
   2028 model is. Out of sample: no SA 2026 count went into any setting.
   Compared on the same primaries with the flow schemes used before: W5's constants (Coalition->Labor
   21.5% v ON, Labor->Coalition 60%, others never to ON) and the design review's seat-type grading.
   Then the whole chain: district primaries from the federal-2025 booth footprint by the logit swing with
   the statewide totals given, seat noise and flow shocks drawn, scored by Brier and log score.
   Writes data/seat-model-backtest-sa26.json. */
import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { rng, spreadShares, count, FLOW_CLASSES } from "./seat-engine.mjs";
import { loadRankings, stateTable, tiltPair, moveFirst, mix, routing, subOfName, SUB_CLASS, FAM_OF_GROUP } from "./senate-flows.mjs";
import { settings, switching, flowClassOf } from "./seat-inputs.mjs";

const J = (f) => JSON.parse(readFileSync(f, "utf8"));
const logit = (p) => Math.log(p / (1 - p)), ilogit = (x) => 1 / (1 + Math.exp(-x));
const fed = J("map/data/res-2025.json"), sa = J("map/data/res-sa26.json");
const SEN = loadRankings(2025);
const BT = JSON.parse(gunzipSync(readFileSync(".build/aec-flow-src/senate-ballots/booth-rankings-2025.json.gz")).toString());
const ST = settings(J("data/seat-model-flow-calibration.json"));
const L = SEN.P.length;
const vec = (sparse) => { const v = new Float64Array(L); for (const [k, n] of Object.entries(sparse || {})) v[+k] = n; return v; };
const km = (a, b) => { const R = 6371, r = Math.PI / 180; const x = (b.lon - a.lon) * r * Math.cos((a.lat + b.lat) / 2 * r), y = (b.lat - a.lat) * r; return R * Math.sqrt(x * x + y * y); };

/* federal SA booths that carry a Senate table */
const FB = fed.booths, fb = [];
for (let i = 0; i < FB.id.length; i++) { const dv = fed.divs[FB.d[i]]; if (dv.st !== "SA" || FB.lat[i] == null) continue; const t = BT.booths[String(FB.id[i])]; if (t) fb.push({ lat: FB.lat[i], lon: FB.lon[i], t }); }
/* each SA26 booth -> nearest such booth; district cohort tables weighted by the booth's votes for that cohort's party */
const SB = sa.booths;
const COH = ["ALP", "COAL", "GRN", "ON", "OTH-R", "OTH-M", "OTH-L"];
const distT = sa.divs.map(() => Object.fromEntries(COH.map((k) => [k, new Float64Array(L)])));
const bucketOfCoh = { ALP: "alp", COAL: "lnp", GRN: "grn", ON: "onp" };
for (let i = 0; i < SB.id.length; i++) {
  if (SB.lat[i] == null || !SB.v[i]) continue;
  const b = { lat: SB.lat[i], lon: SB.lon[i] }; let best = null, bd = 1e9;
  for (const f of fb) { const d = km(b, f); if (d < bd) { bd = d; best = f; } }
  if (!best || bd > 25) continue;
  const dv = sa.divs[SB.d[i]], v = SB.v[i];
  const votesFor = (bk) => v.reduce((a, x, j) => a + (dv.c[j] && (bk === "oth" ? ["oth", "ind"].includes(dv.c[j][3]) : dv.c[j][3] === bk) ? x : 0), 0);
  for (const k of COH) {
    const src = best.t[k]; if (!src) continue;
    const w = votesFor(bucketOfCoh[k] || "oth"); if (w <= 0) continue;
    const s = vec(src), n = s.reduce((a, x) => a + x, 0); if (!n) continue;
    const T = distT[SB.d[i]][k]; for (let p = 0; p < L; p++) T[p] += w * s[p] / n;
  }
}
/* finish each district table: shrink toward the SA state table (400 pseudo-ballots), calibrate */
const stSA = Object.fromEntries(COH.map((k) => [k, stateTable(SEN, "SA", k === "COAL" ? "COAL:LIB" : k)]));
function finish(T, k) {
  const n = T.reduce((a, x) => a + x, 0), p = new Float64Array(L);
  for (let i = 0; i < L; i++) p[i] = (T[i] + 400 * stSA[k][i]) / ((n > 0 ? n : 0) + 400) * (n > 0 ? 1 : 1);
  // T holds vote-weighted probabilities (sum = votes), so blend on the probability scale
  const q = new Float64Array(L), tn = n > 0 ? n : 1;
  for (let i = 0; i < L; i++) q[i] = n > 0 ? (T[i] / tn) * (n / (n + 400)) + stSA[k][i] * (400 / (n + 400)) : stSA[k][i];
  let out = q;
  for (const [kk, d] of Object.entries(ST.delta)) { const [c, pair] = kk.split("|"); if (c !== k) continue; out = tiltPair(SEN, out, "ACGO".indexOf(pair[0]), "ACGO".indexOf(pair[1]), d); }
  return out;
}
const tables = distT.map((o) => Object.fromEntries(COH.map((k) => [k, finish(o[k], k)])));

/* Plackett-Luce table from weights (the pairwise-constant schemes) */
function plTable(w) {
  const p = new Float64Array(L);
  const fams = [0, 1, 2, 3];
  const perm = (left, acc, pr) => {
    if (!left.length) { p[SEN.pidx[acc]] += pr; return; }
    const tot = left.reduce((a, f) => a + w[f], 0);
    for (const f of left) perm(left.filter((x) => x !== f), acc + "ACGO"[f], pr * w[f] / tot);
  };
  perm(fams, "", 1);
  return p;
}
const W5 = { ALP: [100, 0.6, 0.8, 0.4], COAL: [0.215, 100, 0.1, 0.785], GRN: [0.8819, 0.1181, 100, 1e-6], ON: [0.255, 0.745, 0.02, 100], "OTH-R": [0.5455, 0.4545, 0.1, 1e-6], "OTH-M": [0.5455, 0.4545, 0.1, 1e-6], "OTH-L": [0.5455, 0.4545, 0.1, 1e-6] };
const CENTRAL = { ALP: [100, 0.30, 0.40, 0.10], GRN: [0.62, 0.10, 100, 0.04], ON: [0.15, 0.50, 0.02, 100], "OTH-R": [0.25, 0.25, 0.10, 0.25], "OTH-M": [0.25, 0.25, 0.10, 0.25], "OTH-L": [0.25, 0.25, 0.10, 0.25] };
const GRADE = { "Inner Metropolitan": 0.40, "Outer Metropolitan": 0.345, "Provincial": 0.31, "Rural": 0.24 };
// seat type for SA26 districts: nearest federal booth's division class, vote-weighted
const clsOf = sa.divs.map(() => ({}));
for (let i = 0; i < SB.id.length; i++) { if (SB.lat[i] == null || !SB.v[i]) continue; let best = null, bd = 1e9; for (let j = 0; j < FB.id.length; j++) { if (fed.divs[FB.d[j]].st !== "SA" || FB.lat[j] == null) continue; const d = km({ lat: SB.lat[i], lon: SB.lon[i] }, { lat: FB.lat[j], lon: FB.lon[j] }); if (d < bd) { bd = d; best = j; } } if (best == null) continue; const c = fed.divs[FB.d[best]].cls; clsOf[SB.d[i]][c] = (clsOf[SB.d[i]][c] || 0) + SB.v[i].reduce((a, b) => a + b, 0); }
const distCls = clsOf.map((o) => Object.entries(o).sort((a, b) => b[1] - a[1])[0]?.[0] || "Rural");

const comp = switching(J("data/vote-switching.json"));
function seatsFor(scheme, withComp) {
  return sa.divs.map((dv, i) => {
    const tot = dv.c.reduce((a, c) => a + c[4], 0);
    const cands = dv.c.map((c) => {
      const b = c[3], g = b === "alp" ? "alp" : b === "lnp" ? "lp" : b === "grn" ? "grn" : b === "onp" ? "on" : b === "ind" ? "member:" + c[0] : "oth";
      const key = g === "alp" ? "ALP" : g === "lp" ? "COAL" : g === "grn" ? "GRN" : g === "on" ? "ON" : g.startsWith("member") ? "OTH-M" : (() => { const s = subOfName(c[2]); return s.startsWith("OTH:") ? "OTH-" + (SUB_CLASS[s.slice(4)] || "M") : "OTH-M"; })();
      const cls = flowClassOf(key);
      return { label: c[0], group: g, p5: g === "alp" ? 0 : g === "lp" ? 1 : g === "on" ? 2 : g === "grn" ? 3 : 4, fam: FAM_OF_GROUP[g] ?? -1, isInd: g.startsWith("member"), base: c[4] / tot, key, cls, clsIdx: FLOW_CLASSES.indexOf(cls) };
    });
    for (const c of cands) {
      let p;
      if (scheme === "senate") {
        p = tables[i][c.key];
        if (withComp && c.fam >= 0) {
          const X = ["alp", "lnp", "grn", "on"][c.fam];
          p = mix(Object.entries(comp[X]).filter(([, w]) => w > 0).map(([g, w]) => {
            const gk = { alp: "ALP", lnp: "COAL", grn: "GRN", onp: "ON", ind: "OTH-M", oth: "OTH-M" }[g];
            const same = (g === "alp" && c.fam === 0) || (g === "lnp" && c.fam === 1) || (g === "grn" && c.fam === 2) || (g === "onp" && c.fam === 3);
            return [w, same ? tables[i][c.key] : moveFirst(SEN, tables[i][gk], c.fam)];
          }));
        }
      } else {
        const w = scheme === "w5" ? W5[c.key] : c.key === "COAL" ? [GRADE[distCls[i]], 100, 0.1, 1 - GRADE[distCls[i]]] : c.key === "ALP" ? [100, ({ "Inner Metropolitan": 0.75, "Outer Metropolitan": 0.70, "Provincial": 0.65, "Rural": 0.60 })[distCls[i]], 0.8, 1 - ({ "Inner Metropolitan": 0.75, "Outer Metropolitan": 0.70, "Provincial": 0.65, "Rural": 0.60 })[distCls[i]]] : CENTRAL[c.key];
        p = plTable(w);
      }
      c.route = routing(SEN, p);
    }
    const winC = dv.c.find((c) => c[6] === 1), tcp = dv.tcp.map((t) => dv.c[t[0]][3]).sort().join("|");
    const ws = dv.tcp.find((t) => dv.c[t[0]] === winC);
    return { name: dv.n, st: "SA", cls: distCls[i], w: tot, z: 0, cands, iota: { ALP: 0.73, COAL: 0.73, GRN: 0.49, ON: 0.28, "OTH-R": 0.23, "OTH-M": 0.23, "OTH-L": 0.23, _: 0.23 }, sib: 0.72,
      actual: { w: winC[3], pair: tcp, share: ws[1] / (dv.tcp[0][1] + dv.tcp[1][1]) } };
  });
}
const B = (g) => (g === "alp" ? "alp" : g === "lp" ? "lnp" : g === "on" ? "onp" : g === "grn" ? "grn" : g.startsWith("member") ? "ind" : "oth");
console.log("SA 2026 counted from its actual primaries (no noise), by flow scheme:");
const replay = {};
for (const [label, scheme, withComp] of [["W5 constants", "w5", false], ["design review: graded by seat type", "graded", false], ["Senate 2025 ballots (this model)", "senate", false], ["Senate 2025 + vote-switching mix", "senate", true]]) {
  const seats = seatsFor(scheme, withComp);
  let ok = 0, pairOk = 0, tcpE = []; const tally = {}, miss = [];
  for (const s of seats) {
    const fin = count(s, s.cands.map((c) => c.base), null, null);
    const w = B(s.cands[fin[0][0]].group), pair = [w, B(s.cands[fin[1][0]].group)].sort().join("|");
    tally[w] = (tally[w] || 0) + 1;
    if (w === s.actual.w) ok++; else miss.push(`${s.name} (${s.actual.w}->${w})`);
    if (pair === s.actual.pair) { pairOk++; tcpE.push(Math.abs((w === s.actual.w ? fin[0][1] / (fin[0][1] + fin[1][1]) : fin[1][1] / (fin[0][1] + fin[1][1])) - s.actual.share)); }
  }
  replay[label] = { winners: ok, pairs: pairOk, tcpMaePts: +(100 * tcpE.reduce((a, b) => a + b, 0) / tcpE.length).toFixed(2), seats: tally, misses: miss };
  console.log(`  ${label.padEnd(36)} winners ${ok}/47, pairs ${pairOk}/47, TCP MAE ${(100 * tcpE.reduce((a, b) => a + b, 0) / tcpE.length).toFixed(2)} pts | seats ${JSON.stringify(tally)} | misses: ${miss.join(", ")}`);
}
console.log("  actual seats: ALP 34, Lib 5, ON 4, IND 4");

/* whole chain: primaries from the federal-2025 footprint (logit swing, statewide totals given), noise drawn */
const foot = sa.divs.map(() => ({ w: 0 }));
const fbAll = []; for (let i = 0; i < FB.id.length; i++) { const dv = fed.divs[FB.d[i]]; if (dv.st !== "SA" || FB.lat[i] == null || !FB.v[i]) continue; const tot = FB.v[i].reduce((a, b) => a + b, 0); if (tot < 30) continue; const sh = {}; FB.v[i].forEach((x, j) => { const c = dv.c[j]; if (c) sh[c[3]] = (sh[c[3]] || 0) + x / tot; }); fbAll.push({ lat: FB.lat[i], lon: FB.lon[i], sh }); }
for (let i = 0; i < SB.id.length; i++) { if (SB.lat[i] == null || !SB.v[i]) continue; const b = { lat: SB.lat[i], lon: SB.lon[i] }; let best = null, bd = 1e9; for (const f of fbAll) { const d = km(b, f); if (d < bd) { bd = d; best = f; } } if (!best || bd > 25) continue; const F = foot[SB.d[i]], t = SB.v[i].reduce((a, x) => a + x, 0); F.w += t; for (const k of ["alp", "lnp", "grn", "onp"]) F[k] = (F[k] || 0) + t * (best.sh[k] || 0); }
function chain(scheme, withComp, draws) {
  const seats = seatsFor(scheme, withComp);
  // base: big four from the federal footprint; minor/independent candidates keep their actual share (not the question here)
  for (const [i, s] of seats.entries()) for (const c of s.cands) { if (c.fam >= 0 && foot[i].w) { const k = ["alp", "lnp", "grn", "onp"][c.fam]; c.base = Math.max(0.003, foot[i][k] / foot[i].w); } }
  const tgt = [0, 0, 0, 0, 0]; let tw = 0; for (const s of seats) { for (const c of s.cands) tgt[c.p5] += s.w * (s.actual ? 0 : 0); tw += s.w; }
  for (const dv of sa.divs) for (const c of dv.c) { const b = c[3]; tgt[b === "alp" ? 0 : b === "lnp" ? 1 : b === "onp" ? 2 : b === "grn" ? 3 : 4] += c[4]; }
  const T = tgt.reduce((a, b) => a + b, 0); const targets = tgt.map((x) => x / T);
  const R = rng(2026);
  const SIG = [0.27, 0.46, 0.20, 0.24, 0.35]; // SA-scale: the federal-2025-footprint residuals are the realignment's own size (calibrate-swing sa26), so this run is a check of the flows + count under realistic noise, not of the noise
  const win = seats.map(() => ({}));
  for (let d = 0; d < draws; d++) {
    const dev = (i, j) => { const c = seats[i].cands[j]; return c.fam >= 0 ? R.t(5) * SIG[c.p5] : 0; };
    const sh = spreadShares(seats, targets, dev, R);
    const shock = new Float64Array(FLOW_CLASSES.length * 4); FLOW_CLASSES.forEach((k, ci) => { for (let y = 0; y < 4; y++) shock[ci * 4 + y] = R.norm() * 0.2 / Math.SQRT2; });
    seats.forEach((s, i) => { const ss = new Float64Array(FLOW_CLASSES.length * 4); for (let k = 0; k < ss.length; k++) ss[k] = R.norm() * 0.25 / Math.SQRT2; const fin = count(s, sh[i], shock, ss); const w = B(s.cands[fin[0][0]].group); win[i][w] = (win[i][w] || 0) + 1; });
  }
  let brier = 0, logs = 0, modal = 0; const exp = {};
  seats.forEach((s, i) => { const ks = ["alp", "lnp", "onp", "grn", "ind", "oth"]; const p = Object.fromEntries(ks.map((k) => [k, (win[i][k] || 0) / draws])); brier += ks.reduce((a, k) => a + (p[k] - (k === s.actual.w ? 1 : 0)) ** 2, 0); logs += Math.log(Math.max(p[s.actual.w], 0.002)); if (Object.entries(p).sort((a, b) => b[1] - a[1])[0][0] === s.actual.w) modal++; for (const k of ks) exp[k] = (exp[k] || 0) + p[k]; });
  return { brier: +(brier / seats.length).toFixed(4), logScore: +(logs / seats.length).toFixed(4), modal, expected: Object.fromEntries(Object.entries(exp).map(([k, v]) => [k, +v.toFixed(1)])) };
}
console.log("\nWhole chain (federal-2025 footprint -> logit swing to the statewide totals, noise drawn), 2000 draws:");
const chains = {};
for (const [label, scheme, withComp] of [["W5 constants", "w5", false], ["design review: graded", "graded", false], ["Senate 2025 ballots", "senate", false], ["Senate 2025 + switching mix", "senate", true]]) {
  const r = chain(scheme, withComp, 2000); chains[label] = r;
  console.log(`  ${label.padEnd(30)} Brier ${r.brier} log ${r.logScore} modal winners ${r.modal}/47 | expected ${JSON.stringify(r.expected)}`);
}
writeFileSync("data/seat-model-backtest-sa26.json", JSON.stringify({ _about: "backtest-sa26.mjs: SA 2026 counted on its actual primaries with flows from the 2025 federal Senate ballots (nearest federal booth to each state booth, House-calibrated), against W5's constants and the design review's seat-type grading; then the whole chain from the federal-2025 footprint. Actual: ALP 34, Lib 5, ON 4, IND 4.", replay, chains }, null, 1) + "\n");
console.log("wrote data/seat-model-backtest-sa26.json");
