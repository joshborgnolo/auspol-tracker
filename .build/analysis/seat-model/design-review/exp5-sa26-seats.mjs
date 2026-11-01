// E5: full seat chain on SA-2026 given only statewide primaries (oracle national) + pre-election seat information.
// IND/OTH per district taken as actual (known candidacies; their shares are not the question here).
import { load, divRows, boothRows, km, sum, mean, logit, ilogit, ridge, logitShift } from "./lib.mjs";
const fed = load("map/data/res-2025.json"), sa = load("map/data/res-sa26.json");
const S = divRows(sa), F = divRows(fed);
const fedB = boothRows(fed).filter((b) => b.st === "SA" && b.tot >= 30), saB = boothRows(sa);
const foot = S.map(() => ({ w: 0, on: 0 }));
for (const b of saB) {
  const near = fedB.map((f) => ({ f, d: km(b, f) })).sort((x, y) => x.d - y.d).slice(0, 4);
  const ws = near.map((x) => x.f.tot / (0.5 + x.d) ** 2), W = sum(ws);
  foot[b.d].w += b.tot; foot[b.d].on += b.tot * sum(near.map((x, i) => ws[i] * x.f.sh.onp)) / W;
}
const fedOn = foot.map((t) => t.on / t.w);
// demographic ON propensity from federal-2025 fit
const keys = ["uni", "y12less", "blue", "a65", "a2034", "lang", "atsci"];
const X = (d) => [...keys.map((k) => d[k]), d.rel.norel, d.ten.own];
const states = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"];
const Xs = (d, st) => [...X(d), ...states.slice(1).map((s) => (st === s ? 1 : 0))];
const fit = F.filter((r) => r.sh.onp > 0.005);
const dm = ridge(fit.map((r) => Xs(r.demo, r.st)), fit.map((r) => logit(r.sh.onp)), null, 3);
const demoOn = S.map((s) => ilogit(dm.predict(Xs(s.demo, "SA"))));

const w = S.map((s) => s.tot), W = sum(w), wm = (a) => sum(a.map((x, i) => x * w[i])) / W;
const T = Object.fromEntries(["alp", "lnp", "onp", "grn"].map((p) => [p, wm(S.map((s) => s.sh[p]))]));
const actualSeats = {}; S.forEach((s) => (actualSeats[s.winner] = (actualSeats[s.winner] || 0) + 1));
console.log("statewide (oracle):", Object.entries(T).map(([k, v]) => `${k} ${(100 * v).toFixed(1)}`).join(" "), "| actual seats", JSON.stringify(actualSeats));

function predict(geom, onSource) {
  const out = S.map(() => ({}));
  for (const p of ["alp", "lnp", "grn", "onp"]) {
    let base = S.map((s) => Math.max(s.base[p], 0.003));
    if (p === "onp") base = onSource === "fed" ? fedOn : onSource === "demo" ? demoOn : fedOn.map((f, i) => ilogit(0.5 * logit(f) + 0.5 * logit(demoOn[i])));
    const B0 = wm(base);
    let v;
    if (geom === "uniform") v = base.map((b) => Math.max(0.003, b + T[p] - B0));
    else if (geom === "proportional") v = base.map((b) => b * T[p] / B0);
    else { const xs = base.map(logit), c = logitShift(xs, w, T[p]); v = xs.map((x) => ilogit(x + c)); }
    v.forEach((x, i) => (out[i][p] = x));
  }
  // fill to 1 - actual IND - actual OTH
  return out.map((o, i) => { const rest = 1 - S[i].sh.ind - S[i].sh.oth, s = o.alp + o.lnp + o.grn + o.onp; const r = {}; for (const p of ["alp", "lnp", "grn", "onp"]) r[p] = o[p] * rest / s; r.ind = S[i].sh.ind; r.oth = S[i].sh.oth; return r; });
}
const FL = {
  "SA-2026 estimates (LIB->ALP 35 in ALP v ON)": { lnp: { alp: .30, onp: .55, grn: .05, ind: .07, oth: .03 }, onp: { alp: .15, lnp: .40, grn: .02, ind: .2, oth: .23 }, grn: { alp: .80, lnp: .10, onp: .03, ind: .05, oth: .02 }, alp: { lnp: .40, onp: .12, grn: .38, ind: .07, oth: .03 }, oth: { alp: .3, lnp: .3, onp: .3, grn: .05, ind: .05 }, ind: { alp: .35, lnp: .3, onp: .15, grn: .2, oth: .0001 } },
  "federal central (LIB->ALP 30)": { lnp: { alp: .22, onp: .50, grn: .05, ind: .13, oth: .10 }, onp: { alp: .15, lnp: .50, grn: .02, ind: .08, oth: .25 }, grn: { alp: .62, lnp: .10, onp: .04, ind: .16, oth: .08 }, alp: { lnp: .30, onp: .10, grn: .40, ind: .12, oth: .08 }, oth: { alp: .25, lnp: .25, onp: .25, grn: .10, ind: .15 }, ind: { alp: .35, lnp: .25, onp: .10, grn: .20, oth: .10 } },
};
function run(shares, Fw) {
  const tally = {}; let correct = 0, pairOk = 0;
  shares.forEach((s0, i) => {
    const st = Object.fromEntries(Object.entries(s0).filter(([, v]) => v > 0.001));
    while (Object.keys(st).length > 2) {
      const ex = Object.entries(st).sort((a, b) => a[1] - b[1])[0][0], pile = st[ex]; delete st[ex];
      const ks = Object.keys(st), ws = ks.map((k) => Fw[ex][k] || 0.001), sw = sum(ws);
      ks.forEach((k, j) => (st[k] += pile * ws[j] / sw));
    }
    const fin = Object.entries(st).sort((a, b) => b[1] - a[1]);
    tally[fin[0][0]] = (tally[fin[0][0]] || 0) + 1;
    if (fin[0][0] === S[i].winner) correct++;
    const ap = S[i].tcp.map((x) => S[i].c[x[0]][3]).sort().join(), pp = fin.map((x) => x[0]).sort().join();
    if (ap === pp) pairOk++;
  });
  return { tally, correct, pairOk };
}
console.log("\ngeometry      ON base          flows                                  seats (ALP/LIB/ON/IND)  winners  final pair");
for (const g of ["uniform", "proportional", "logit"]) for (const src of ["fed", "demo", "blend"]) for (const [fn, Fw] of Object.entries(FL)) {
  const r = run(predict(g, src), Fw);
  console.log(g.padEnd(14) + src.padEnd(17) + fn.padEnd(39) + `${r.tally.alp || 0}/${r.tally.lnp || 0}/${r.tally.onp || 0}/${r.tally.ind || 0}`.padStart(16) + `${r.correct}/47`.padStart(10) + `${r.pairOk}/47`.padStart(11));
}
console.log(`actual: ${actualSeats.alp}/${actualSeats.lnp}/${actualSeats.onp}/${actualSeats.ind}`);
