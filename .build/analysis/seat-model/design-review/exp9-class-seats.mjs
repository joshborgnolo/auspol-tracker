// E9: federal deterministic projection (logit geometry, today's primaries) with three-way flows flat vs graded by AEC class.
import { load, divRows, sum, logit, ilogit, ridge, logitShift } from "./lib.mjs";
const fed = load("maps/data/res-2025.json");
const R = divRows(fed);
const P = ["alp", "lnp", "onp", "grn", "ind", "oth"];
const CLS = { "Inner Metropolitan": "inner", "Outer Metropolitan": "outer", "Provincial": "prov", "Rural": "rural" };
const w = R.map((r) => r.tot), W = sum(w);
const nat25 = Object.fromEntries(P.map((p) => [p, sum(R.map((r, i) => r.sh[p] * w[i])) / W]));
const NOW = { alp: 0.266, lnp: 0.227, grn: 0.137, onp: 0.261 };
const r25 = nat25.ind / (nat25.ind + nat25.oth); NOW.ind = 0.113 * r25; NOW.oth = 0.113 * (1 - r25);
const keys = ["uni", "y12less", "blue", "a65", "a2034", "lang", "atsci"];
const states = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"];
const Xs = (r) => [...keys.map((k) => r.demo[k]), r.demo.rel.norel, r.demo.ten.own, ...states.slice(1).map((s) => (r.st === s ? 1 : 0))];
const fit = R.filter((r) => r.sh.onp > 0.005);
const m = ridge(fit.map(Xs), fit.map((r) => logit(r.sh.onp)), null, 3);
const base = R.map((r) => { const b = { ...r.sh }; if (b.onp < 0.005) b.onp = ilogit(m.predict(Xs(r))); return b; });
const shares = base.map((b) => ({ ...b }));
for (const p of P) { const xs = base.map((b) => logit(Math.max(b[p], 0.002))); const c = logitShift(xs, w, NOW[p]); base.forEach((b, i) => (shares[i][p] = b[p] < 0.001 ? 0 : ilogit(xs[i] + c))); }
shares.forEach((o, i) => { if (base[i].ind < 0.001) o.ind = 0; if (base[i].oth < 0.001) o.oth = 0; const s = sum(P.map((p) => o[p])); P.forEach((p) => (o[p] /= s)); });
const cls = R.map((r) => CLS[r.cls]);

const CENTRAL = { grn: { alp: .62, lnp: .10, onp: .04, ind: .16, oth: .08 }, onp: { alp: .15, lnp: .50, grn: .02, ind: .08, oth: .25 }, lnp: { alp: .22, onp: .50, grn: .05, ind: .13, oth: .10 }, alp: { lnp: .30, onp: .10, grn: .40, ind: .12, oth: .08 }, oth: { alp: .25, lnp: .25, onp: .25, grn: .10, ind: .15 }, ind: { alp: .35, lnp: .25, onp: .10, grn: .20, oth: .10 } };
// set a donor's head-to-head split between two recipients, keeping their combined weight
const setPair = (F, donor, a, b, shareA) => { const t = F[donor][a] + F[donor][b]; F[donor][a] = t * shareA; F[donor][b] = t * (1 - shareA); };
function flowsFor(c, spec) {
  const F = JSON.parse(JSON.stringify(CENTRAL));
  setPair(F, "lnp", "alp", "onp", typeof spec.coalToAlp === "number" ? spec.coalToAlp : spec.coalToAlp[c]);
  setPair(F, "alp", "lnp", "onp", typeof spec.alpToCoal === "number" ? spec.alpToCoal : spec.alpToCoal[c]);
  return F;
}
function count(spec) {
  const tally = Object.fromEntries(P.map((p) => [p, 0])), win = [];
  shares.forEach((s, i) => {
    const F = flowsFor(cls[i], spec);
    const st = Object.fromEntries(P.filter((p) => s[p] > 0).map((p) => [p, s[p]]));
    while (Object.keys(st).length > 2) {
      const ex = Object.entries(st).sort((a, b) => a[1] - b[1])[0][0], pile = st[ex]; delete st[ex];
      const ks = Object.keys(st), ws = ks.map((k) => F[ex][k] || 0.01), sw = sum(ws);
      ks.forEach((k, j) => (st[k] += pile * ws[j] / sw));
    }
    const fin = Object.entries(st).sort((a, b) => b[1] - a[1]);
    tally[fin[0][0]]++; win.push({ w: fin[0][0], pair: fin.map((x) => x[0]).sort().join(" v ") });
  });
  return { tally, win };
}
const GRADED_C = { inner: 0.40, outer: 0.345, prov: 0.31, rural: 0.24 };   // SA-26 + Qld-17 + Hunter-25 by class
const GRADED_A = { inner: 0.75, outer: 0.70, prov: 0.65, rural: 0.60 };    // rural anchored on Maranoa counts, DemosAU-shaped gradient
const specs = {
  "engine-like flat (C->L 21.5, L->C 60)": { coalToAlp: 0.215, alpToCoal: 0.60 },
  "flat SA pooled (C->L 33.8, L->C 60)": { coalToAlp: 0.338, alpToCoal: 0.60 },
  "graded C->L by class, L->C flat 60": { coalToAlp: GRADED_C, alpToCoal: 0.60 },
  "graded both by class": { coalToAlp: GRADED_C, alpToCoal: GRADED_A },
  "graded, rural -5 / prov -3 pts (more pro-ON)": { coalToAlp: { ...GRADED_C, rural: 0.19, prov: 0.28 }, alpToCoal: { ...GRADED_A, rural: 0.55 } },
};
console.log("today's primaries, logit spread, deterministic, group-level count (independents unreliable)\n");
console.log("flow spec".padEnd(42) + "  ALP  L/NP   ON  GRN  IND  OTH");
const res = {};
for (const [k, s] of Object.entries(specs)) { res[k] = count(s); console.log(k.padEnd(42) + P.map((p) => String(res[k].tally[p]).padStart(5)).join("")); }
// where are the Labor-v-ON finals, by class?
const byCls = {}; res["graded both by class"].win.forEach((x, i) => { if (x.pair === "alp v onp") byCls[cls[i]] = (byCls[cls[i]] || 0) + 1; });
console.log("\nLabor v ON finals by class (graded run):", JSON.stringify(byCls));
const byClsL = {}; res["graded both by class"].win.forEach((x, i) => { if (x.pair === "lnp v onp") byClsL[cls[i]] = (byClsL[cls[i]] || 0) + 1; });
console.log("Coalition v ON finals by class (graded run):", JSON.stringify(byClsL));
// seats that change hands between the flat-pooled and graded runs
const A = res["flat SA pooled (C->L 33.8, L->C 60)"].win, B = res["graded both by class"].win, E = res["engine-like flat (C->L 21.5, L->C 60)"].win;
const diff = (X, Y) => R.map((r, i) => X[i].w !== Y[i].w ? `${r.name} (${cls[i]}): ${X[i].w}->${Y[i].w}` : null).filter(Boolean);
console.log("\nflat 33.8 -> graded:", diff(A, B).join("; ") || "none");
console.log("\nengine-like 21.5 -> graded:", diff(E, B).join("; ") || "none");
