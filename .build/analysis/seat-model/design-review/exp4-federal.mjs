// E4: project today's national primaries onto the 150 seats under different swing geometries and flow sets,
// deterministic (no noise) — how much does each modelling choice move the seat count?
import { load, divRows, sum, mean, logit, ilogit, ridge, logitShift } from "./lib.mjs";
const fed = load("maps/data/res-2025.json");
const R = divRows(fed);
const P = ["alp", "lnp", "onp", "grn", "ind", "oth"];
const w = R.map((r) => r.tot), W = sum(w);
const nat25 = Object.fromEntries(P.map((p) => [p, sum(R.map((r, i) => r.sh[p] * w[i])) / W]));
// today's aggregate (site latest): alp 26.6 lnp 22.7 grn 13.7 onp 26.1 oth(incl ind) 11.3 — split oth/ind by 2025 ratio
const NOW = { alp: 0.266, lnp: 0.227, grn: 0.137, onp: 0.261 };
const othNow = 0.113, r25 = nat25.ind / (nat25.ind + nat25.oth);
NOW.ind = othNow * r25; NOW.oth = othNow * (1 - r25);
console.log("2025 national:", Object.entries(nat25).map(([k, v]) => `${k} ${(100 * v).toFixed(1)}`).join(" "));
console.log("now  national:", Object.entries(NOW).map(([k, v]) => `${k} ${(100 * v).toFixed(1)}`).join(" "));

// ON base where ON didn't stand in 2025: demographic prediction (fit on seats it contested)
const keys = ["uni", "y12less", "blue", "a65", "a2034", "lang", "atsci"];
const X = (d) => [...keys.map((k) => d[k]), d.rel.norel, d.ten.own];
const states = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"];
const Xs = (r) => [...X(r.demo), ...states.slice(1).map((s) => (r.st === s ? 1 : 0))];
const fit = R.filter((r) => r.sh.onp > 0.005);
const m = ridge(fit.map(Xs), fit.map((r) => logit(r.sh.onp)), null, 3);
const base = R.map((r) => { const b = { ...r.sh }; if (b.onp < 0.005) b.onp = ilogit(m.predict(Xs(r))); return b; });
const noOn = R.filter((r) => r.sh.onp < 0.005).map((r) => r.name);
console.log("seats with no 2025 ON candidate (demographic base used):", noOn.join(", "));

function geometry(kind) {
  // returns per-seat share vectors (renormalised), each party matched to its national target
  const out = base.map((b) => ({ ...b }));
  for (const p of P) {
    const B0 = sum(base.map((b, i) => b[p] * w[i])) / W, T = NOW[p];
    if (kind === "uniform") base.forEach((b, i) => (out[i][p] = Math.max(0.002, b[p] + (T - B0))));
    if (kind === "proportional") base.forEach((b, i) => (out[i][p] = b[p] * T / B0));
    if (kind === "mix50") base.forEach((b, i) => (out[i][p] = Math.max(0.002, 0.5 * b[p] * T / B0 + 0.5 * (b[p] + T - B0))));
    if (kind === "logit") { const xs = base.map((b) => logit(Math.max(b[p], 0.002))); const c = logitShift(xs, w, T); base.forEach((b, i) => (out[i][p] = b[p] < 0.001 ? 0 : ilogit(xs[i] + c))); }
  }
  // ind/oth only where candidates stood
  out.forEach((o, i) => { if (base[i].ind < 0.001) o.ind = 0; if (base[i].oth < 0.001) o.oth = 0; const s = sum(P.map((p) => o[p])); P.forEach((p) => (o[p] /= s)); });
  return out;
}

// Luce-style preference weights (from -> to), renormalised over who is still standing
const FLOWSETS = {
  "central (site FP_ON-ish)": { grn: { alp: .62, lnp: .10, onp: .04, ind: .16, oth: .08 }, onp: { alp: .15, lnp: .50, grn: .02, ind: .08, oth: .25 }, lnp: { alp: .22, onp: .50, grn: .05, ind: .13, oth: .10 }, alp: { lnp: .30, onp: .10, grn: .40, ind: .12, oth: .08 }, oth: { alp: .25, lnp: .25, onp: .25, grn: .10, ind: .15 }, ind: { alp: .35, lnp: .25, onp: .10, grn: .20, oth: .10 } },
  "right-consolidating (LNP->ON 80, ALP->LNP 85)": { grn: { alp: .62, lnp: .10, onp: .04, ind: .16, oth: .08 }, onp: { alp: .10, lnp: .55, grn: .02, ind: .08, oth: .25 }, lnp: { alp: .13, onp: .55, grn: .04, ind: .14, oth: .14 }, alp: { lnp: .40, onp: .07, grn: .37, ind: .10, oth: .06 }, oth: { alp: .2, lnp: .3, onp: .3, grn: .08, ind: .12 }, ind: { alp: .35, lnp: .25, onp: .10, grn: .20, oth: .10 } },
  "soft right (LNP->ON 55, ALP->LNP 65)": { grn: { alp: .62, lnp: .10, onp: .04, ind: .16, oth: .08 }, onp: { alp: .22, lnp: .43, grn: .03, ind: .08, oth: .24 }, lnp: { alp: .34, onp: .42, grn: .06, ind: .10, oth: .08 }, alp: { lnp: .24, onp: .13, grn: .43, ind: .12, oth: .08 }, oth: { alp: .28, lnp: .24, onp: .22, grn: .11, ind: .15 }, ind: { alp: .35, lnp: .25, onp: .10, grn: .20, oth: .10 } },
};
function count(shares, F, seatWin) {
  const tally = Object.fromEntries(P.map((p) => [p, 0])), pairs = {};
  shares.forEach((s, i) => {
    const st = Object.fromEntries(P.filter((p) => s[p] > 0).map((p) => [p, s[p]]));
    // 2025 held IND seats keep their member as the 'ind' group; non-held 'ind' is a generic independent
    while (Object.keys(st).length > 2) {
      const ex = Object.entries(st).sort((a, b) => a[1] - b[1])[0][0];
      const pile = st[ex]; delete st[ex];
      const ks = Object.keys(st), ws = ks.map((k) => F[ex][k] || 0.01), sw = sum(ws);
      ks.forEach((k, j) => (st[k] += pile * ws[j] / sw));
    }
    const fin = Object.entries(st).sort((a, b) => b[1] - a[1]);
    tally[fin[0][0]]++;
    const key = fin.map((x) => x[0]).sort().join("v"); pairs[key] = (pairs[key] || 0) + 1;
    if (seatWin) seatWin[R[i].name] = fin[0][0];
  });
  return { tally, pairs };
}
// sanity: replay 2025 with the 2025 shares (group-level elimination) under the central flows
{ const t = count(base.map((b, i) => R[i].sh), FLOWSETS["central (site FP_ON-ish)"]).tally; const actual = {}; R.forEach((r) => (actual[r.winner] = (actual[r.winner] || 0) + 1));
  console.log("\n2025 replay (group-level, central flows):", JSON.stringify(t), " actual:", JSON.stringify(actual)); }
console.log("\ngeometry      flows                                         ALP  L/NP   ON  GRN  IND  OTH | final pairs");
for (const g of ["uniform", "proportional", "mix50", "logit"]) {
  const sh = geometry(g);
  for (const [fn, F] of Object.entries(FLOWSETS)) {
    const { tally, pairs } = count(sh, F);
    console.log(g.padEnd(14) + fn.padEnd(46) + P.map((p) => String(tally[p]).padStart(5)).join("") + " | " + Object.entries(pairs).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(", "));
  }
}
// how close are the seats? distribution of ON primary under logit, and the share of seats where top-3 within 5 pts
{ const sh = geometry("logit");
  const close = sh.filter((s) => { const v = ["alp", "lnp", "onp"].map((p) => s[p]).sort((a, b) => b - a); return v[1] - v[2] < 0.05; }).length;
  console.log(`\nlogit geometry: seats where 2nd and 3rd of ALP/L-NP/ON are within 5 pts on primaries: ${close}/150`);
  const onv = sh.map((s) => s.onp).sort((a, b) => b - a);
  console.log(`ON primary under logit: top ${(100 * onv[0]).toFixed(1)}, 10th ${(100 * onv[9]).toFixed(1)}, 30th ${(100 * onv[29]).toFixed(1)}, 50th ${(100 * onv[49]).toFixed(1)}, median ${(100 * onv[74]).toFixed(1)}, bottom ${(100 * onv[149]).toFixed(1)}`);
  const sp = geometry("proportional").map((s) => s.onp).sort((a, b) => b - a), su = geometry("uniform").map((s) => s.onp).sort((a, b) => b - a);
  console.log(`ON primary proportional: top ${(100 * sp[0]).toFixed(1)}, 10th ${(100 * sp[9]).toFixed(1)}, 30th ${(100 * sp[29]).toFixed(1)}, median ${(100 * sp[74]).toFixed(1)}, bottom ${(100 * sp[149]).toFixed(1)}`);
  console.log(`ON primary uniform:      top ${(100 * su[0]).toFixed(1)}, 10th ${(100 * su[9]).toFixed(1)}, 30th ${(100 * su[29]).toFixed(1)}, median ${(100 * su[74]).toFixed(1)}, bottom ${(100 * su[149]).toFixed(1)}`);
}
