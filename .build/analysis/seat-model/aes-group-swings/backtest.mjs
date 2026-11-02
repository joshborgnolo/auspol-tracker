#!/usr/bin/env node
/* backtest.mjs: would knowing each group's national swing have predicted the seats' swings?

   For every federal election 1996-2025 the seat model's own swing fit (../swing-fit.mjs: a logit shift per
   election x state x party solved so the state totals come out exactly, plus sitting-member, defection and
   reversion terms) leaves each seat's primary for Labor, the Coalition, the Greens and One Nation with a
   residual. Each AES election-to-election change in a group's vote (aes-cells.json) is applied to the seats
   through their census mix (map/data/res-YYYY.json demo) and the state shifts re-solved:

     *_lg   the change in the group's logit gap from all voters, times the seat's share of the group less the
            national share (what calibrate-education.mjs applies, and what a logit swing leaves unexplained)
     *_pp   the change in the group's points gap, converted to logit at the party's national share - the
            convention vote-layer.mjs uses for age and gender
     joint  changes in the AES's joint logit coefficients (young, old, degree, renter, mortgage), so overlapping
            groups count once

   Seats: degree = res demo `uni`; age = 20-34 / 35-54 / 55+ shares of persons aged about 20 and over (the
   stores give shares of all persons; 15-19s, about 6.5%, are taken out as a constant); tenure = own / mortgage /
   rent shares of dwellings. The AES's real group swings stand in for a forecast's poll-based ones, so every
   gain here is a ceiling on what polls could deliver. The last block fits each election's slopes on its own
   seats (in-sample): the most any demographic term could do.

   Run from the repo root:
     node .build/analysis/seat-model/aes-group-swings/backtest.mjs > .build/analysis/seat-model/aes-group-swings/out/backtest.txt */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadHistory, historyRows, fitTerms, residualize, offsetOf, LONG_YEARS, PREV_OF } from "../swing-fit.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const A = JSON.parse(fs.readFileSync(path.join(HERE, "aes-cells.json"), "utf8")).waves;
process.chdir(path.resolve(HERE, "..", "..", "..", ".."));
const H = loadHistory("."), rows = historyRows(H);
const YEARS = LONG_YEARS.slice(1);
const fit = fitTerms(rows, YEARS);
const P = ["alp", "lnp", "grn", "onp"];
const logit = (p) => Math.log(p / (1 - p)), ilogit = (x) => 1 / (1 + Math.exp(-x));
const formal = (d) => d.c.reduce((a, c) => a + c[4], 0);

// each seat's group shares, and the formal-vote-weighted national share, per election
const demo = {}, nat = {};
for (const E of LONG_YEARS) {
  demo[E] = {}; let W = 0; const acc = {};
  for (const d of H.RES[E].divs) {
    const m = d.demo; if (!m) continue;
    const a20 = 1 - (m.u15 ?? 0.19) - 0.065;
    const y = m.a2034 / a20, mm = m.a3554 / a20, t = m.ten || {}, tt = (t.own ?? 0) + (t.mort ?? 0) + (t.rent ?? 0);
    const x = { deg: { 1: m.uni, 0: 1 - m.uni }, age: { y, m: mm, o: Math.max(0, 1 - y - mm) }, ten: tt > 0 ? { own: t.own / tt, mort: t.mort / tt, rent: t.rent / tt } : null };
    const w = formal(d); demo[E][d.n] = x; W += w;
    for (const dim of ["deg", "age", "ten"]) if (x[dim]) for (const c in x[dim]) acc[dim + "|" + c] = (acc[dim + "|" + c] || 0) + w * x[dim][c];
  }
  nat[E] = Object.fromEntries(Object.entries(acc).map(([k, v]) => [k, v / W]));
}
const natShare = {};
for (const E of YEARS) { natShare[E] = {}; const W = H.RES[E].divs.reduce((a, d) => a + formal(d), 0); for (const b of P) natShare[E][b] = H.RES[E].divs.reduce((a, d) => a + d.c.filter((c) => c[3] === b).reduce((s, c) => s + c[4], 0), 0) / W; }

// the AES change in each group's gap from all voters (logit and points), E against the election before
const KEY = { deg: ["deg", "deg_all"], age: ["age", "age_all"], ten: ["ten", "ten_all"] };
function gaps(E, b, dim) {
  const aE = A[E], aP = A[PREV_OF[E]], [cells, all] = KEY[dim];
  if (!aE?.[cells] || !aP?.[cells]) return null;
  const allE = aE[all][b], allP = aP[all][b];
  if (!(allE > 0.008 && allP > 0.008)) return null;
  const out = {};
  for (const c of Object.keys(aE[cells])) {
    const pE = Math.max(aE[cells][c][b], 0.002), pP = Math.max(aP[cells][c][b], 0.002);
    out[c] = { lg: logit(pE) - logit(allE) - (logit(pP) - logit(allP)), pp: 100 * (pE - pP - (allE - allP)) };
  }
  return out;
}
const termOf = (r, dim, kind) => {
  const x = demo[r.E][r.div], g = x?.[dim] ? gaps(r.E, r.b, dim) : null; if (!g) return 0;
  let v = 0; for (const c in g) v += g[c][kind] * (x[dim][c] - nat[r.E][dim + "|" + c]);
  return kind === "pp" ? v / (100 * natShare[r.E][r.b] * (1 - natShare[r.E][r.b])) : v;
};
const jointTerm = (r) => {
  const x = demo[r.E][r.div]; if (!x) return 0;
  const which = A[PREV_OF[r.E]].joint.names.includes("rent") ? "joint" : "joint_nt";
  const aE = A[r.E][which], aP = A[PREV_OF[r.E]][which]; if (!aE?.[r.b] || !aP?.[r.b]) return 0;
  const d = (n) => aE[r.b].b[aE.names.indexOf(n)] - aP[r.b].b[aP.names.indexOf(n)], N = nat[r.E];
  let v = d("young") * (x.age.y - N["age|y"]) + d("old") * (x.age.o - N["age|o"]) + d("deg") * (x.deg[1] - N["deg|1"]);
  if (which === "joint" && x.ten) v += d("rent") * (x.ten.rent - N["ten|rent"]) + d("mort") * (x.ten.mort - N["ten|mort"]);
  return v;
};
const V = {
  none: () => 0,
  age_pp: (r) => termOf(r, "age", "pp"),
  age_lg: (r) => termOf(r, "age", "lg"),
  edu_pp: (r) => termOf(r, "deg", "pp"),
  edu_lg: (r) => termOf(r, "deg", "lg"),
  ten_lg: (r) => termOf(r, "ten", "lg"),
  age_edu_lg: (r) => termOf(r, "age", "lg") + termOf(r, "deg", "lg"),
  all3_lg: (r) => termOf(r, "age", "lg") + termOf(r, "deg", "lg") + termOf(r, "ten", "lg"),
  joint: jointTerm,
};

// vote-weighted seat-share errors (points) per election x party, state shifts re-solved with the term in
function evalVariant(f, k = 1, years = YEARS) {
  const res = {};
  for (const b of P) {
    const rs = fit.rows.filter((r) => r.b === b && years.includes(r.E)).map((r) => ({ ...r }));
    residualize(rs, (r) => offsetOf(fit.terms[b], r, r.prevE ?? 0) + k * f(r));
    for (const r of rs) { const key = r.E + "|" + b, e = 100 * (ilogit(r.y) - ilogit(r.pred)); const o = (res[key] = res[key] || { se: 0, w: 0, n: 0 }); o.se += r.w * e * e; o.w += r.w; o.n++; }
  }
  return res;
}
const rmse = (o) => Math.sqrt(o.se / o.w);
const pooled = (R, b) => { let se = 0, w = 0; for (const E of YEARS) { const o = R[E + "|" + b]; if (o) { se += o.se; w += o.w; } } return w ? Math.sqrt(se / w) : null; };
const sgn = (x, d = 3) => (x >= 0 ? "+" : "") + x.toFixed(d);
const B0 = evalVariant(V.none);

console.log("Seat-share error after the model's swing fit (vote-weighted RMSE, points), by election:");
for (const E of YEARS) console.log(`  ${E}  ` + P.map((b) => { const o = B0[E + "|" + b]; return o ? `${b} ${rmse(o).toFixed(2)} (${o.n} seats)` : `${b} -`; }).join("  "));

console.log("\nWith the AES's real group swings applied at full scale: pooled RMSE 1996-2025 (change) [elections better / elections with a term]");
for (const [name, f] of Object.entries(V)) {
  const R = evalVariant(f);
  console.log("  " + name.padEnd(11) + P.map((b) => {
    let help = 0, tot = 0;
    for (const E of YEARS) { const o = R[E + "|" + b], o0 = B0[E + "|" + b]; if (o && o0 && Math.abs(rmse(o) - rmse(o0)) > 1e-9) { tot++; if (rmse(o) < rmse(o0)) help++; } }
    return `${b} ${pooled(R, b).toFixed(3)} (${sgn(pooled(R, b) - pooled(B0, b))}) [${help}/${tot}]`;
  }).join("  "));
}

console.log("\nScale fitted on all elections (1 = the AES change as measured), and the change when each election takes the scale fitted on the others:");
for (const name of Object.keys(V).filter((n) => n !== "none")) {
  const f = V[name];
  console.log("  " + name.padEnd(11) + P.map((b) => {
    const rs = fit.rows.filter((r) => r.b === b);
    const kOf = (ys) => { let sxy = 0, sxx = 0; for (const r of rs) if (ys.includes(r.E)) { const t = f(r); sxy += r.w * t * r.e; sxx += r.w * t * t; } return sxx > 0 ? sxy / sxx : 0; };
    let se = 0, se0 = 0, w = 0;
    for (const E of YEARS) { const R = evalVariant(f, kOf(YEARS.filter((y) => y !== E)), [E])[E + "|" + b], R0 = B0[E + "|" + b]; if (R && R0) { se += R.se; se0 += R0.se; w += R.w; } }
    return `${b} k ${kOf(YEARS).toFixed(2)} out-of-sample ${w ? sgn(Math.sqrt(se / w) - Math.sqrt(se0 / w)) : "-"}`;
  }).join("  "));
}

console.log("\nCeiling: each election's own slopes on degree, young, old, renter, mortgage, fitted in-sample - pooled RMSE:");
for (const b of P) {
  let se = 0, w = 0;
  for (const E of YEARS) {
    const rs = fit.rows.filter((r) => r.b === b && r.E === E && demo[E][r.div]);
    if (rs.length < 20) { const o = B0[E + "|" + b]; if (o) { se += o.se; w += o.w; } continue; }
    const N = nat[E], X = rs.map((r) => { const x = demo[E][r.div]; return [x.deg[1] - N["deg|1"], x.age.y - N["age|y"], x.age.o - N["age|o"], ...(x.ten ? [x.ten.rent - N["ten|rent"], x.ten.mort - N["ten|mort"]] : [0, 0])]; });
    const k = 5, M = Array.from({ length: k }, (_, i) => new Array(k + 1).fill(0));
    rs.forEach((r, i) => { for (let a = 0; a < k; a++) { M[a][k] += r.w * X[i][a] * r.e; for (let c = 0; c < k; c++) M[a][c] += r.w * X[i][a] * X[i][c]; } });
    for (let a = 0; a < k; a++) M[a][a] += 1e-6;
    for (let i = 0; i < k; i++) { let p = i; for (let q = i + 1; q < k; q++) if (Math.abs(M[q][i]) > Math.abs(M[p][i])) p = q; [M[i], M[p]] = [M[p], M[i]]; for (let q = 0; q < k; q++) if (q !== i) { const fct = M[q][i] / M[i][i]; for (let c = i; c <= k; c++) M[q][c] -= fct * M[i][c]; } }
    const beta = M.map((row, i) => row[k] / row[i]);
    rs.forEach((r, i) => { const e = 100 * (ilogit(r.y) - ilogit(r.pred + X[i].reduce((a, x, j) => a + x * beta[j], 0))); se += r.w * e * e; w += r.w; });
  }
  console.log(`  ${b}: ${pooled(B0, b).toFixed(3)} -> ${Math.sqrt(se / w).toFixed(3)}`);
}

const slopeTable = (label, b, dim, gapOf, xOf) => {
  const pts = [];
  for (const E of YEARS) {
    const g = gaps(E, b, dim); if (!g) continue;
    const rs = fit.rows.filter((r) => r.b === b && r.E === E && demo[E][r.div]);
    let sxy = 0, sxx = 0; for (const r of rs) { const u = xOf(demo[E][r.div], nat[E]); sxy += r.w * u * r.e; sxx += r.w * u * u; }
    pts.push([E, gapOf(g), sxy / sxx]);
  }
  const mx = pts.reduce((a, p) => a + p[1], 0) / pts.length, my = pts.reduce((a, p) => a + p[2], 0) / pts.length;
  const cov = pts.reduce((a, p) => a + (p[1] - mx) * (p[2] - my), 0), vx = pts.reduce((a, p) => a + (p[1] - mx) ** 2, 0), vy = pts.reduce((a, p) => a + (p[2] - my) ** 2, 0);
  console.log(`  ${label} ${b}: r ${(cov / Math.sqrt(vx * vy)).toFixed(2)}, seats' slope per unit of the AES's ${(cov / vx).toFixed(2)}   ` + pts.map((p) => `${p[0]} ${p[1].toFixed(2)}/${p[2].toFixed(2)}`).join("  "));
};
console.log("\nAES gap change (logit) v the seats' own fitted slope on the same group (univariate, logit per unit share), election by election:");
for (const b of ["alp", "lnp", "grn"]) slopeTable("degree      ", b, "deg", (g) => g[1].lg - g[0].lg, (x, N) => x.deg[1] - N["deg|1"]);
for (const b of ["alp", "lnp", "grn"]) slopeTable("55+ v 18-34 ", b, "age", (g) => g.o.lg - g.y.lg, (x, N) => x.age.o - N["age|o"] - (x.age.y - N["age|y"]));
