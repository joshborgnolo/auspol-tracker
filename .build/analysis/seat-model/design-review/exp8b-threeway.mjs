// E8b: three-way flows (Coalition -> Labor in Labor-v-ON finals; Labor -> Coalition in Coalition-v-ON finals) by seat type.
// State districts inherit the AEC class of the federal division that holds most of their booths (nearest federal booths).
import { load, boothRows, km, sum, mean, corr } from "./lib.mjs";
const CLS = { "Inner Metropolitan": "inner", "Outer Metropolitan": "outer", "Provincial": "prov", "Rural": "rural" };
function inheritClass(stateData, fedData, st) {
  const fb = boothRows(fedData).filter((b) => b.st === st && b.tot >= 30);
  const sb = boothRows(stateData);
  const votes = stateData.divs.map(() => ({}));
  for (const b of sb) {
    const near = fb.map((f) => ({ f, d: km(b, f) })).sort((x, y) => x.d - y.d)[0];
    const cls = CLS[fedData.divs[near.f.d].cls];
    votes[b.d][cls] = (votes[b.d][cls] || 0) + b.tot;
  }
  return votes.map((v) => Object.entries(v).sort((a, b) => b[1] - a[1])[0]?.[0]);
}
// generic: for a jurisdiction's map data, find finals of a given pair and the excluded-major's split between the pair
function threeWay(D, classes, pairWanted, donorBucket, toBucket) {
  const rows = [];
  D.divs.forEach((dv, i) => {
    if (!dv.tcp || dv.tcp.length !== 2) return;
    const pair = dv.tcp.map((t) => dv.c[t[0]][3]);
    if (!(pair.includes(pairWanted[0]) && pair.includes(pairWanted[1]))) return;
    const toIdx = pair.indexOf(toBucket);
    let a = 0, t = 0;
    for (const f of dv.fl || []) if (dv.c[f[0]][3] === donorBucket) { a += toIdx === 0 ? f[1] : f[2]; t += f[1] + f[2]; }
    if (t < 300) return;
    const tot = sum(dv.c.map((c) => c[4]));
    const sh = (b) => sum(dv.c.filter((c) => c[3] === b).map((c) => c[4])) / tot;
    rows.push({ name: dv.n, cls: classes ? classes[i] : (CLS[dv.cls] || dv.cls), share: a / t, n: t, uni: dv.demo?.uni, on: sh("onp"), lnp: sh("lnp"), alp: sh("alp") });
  });
  return rows;
}
const show = (title, rows) => {
  if (!rows.length) { console.log(`${title}: none`); return; }
  const pooled = sum(rows.map((r) => r.share * r.n)) / sum(rows.map((r) => r.n));
  const by = {}; for (const r of rows) { by[r.cls] = by[r.cls] || [0, 0, 0]; by[r.cls][0] += r.share * r.n; by[r.cls][1] += r.n; by[r.cls][2]++; }
  console.log(`${title}: pooled ${(100 * pooled).toFixed(1)}% over ${rows.length} seats | by class: ` + ["inner", "outer", "prov", "rural"].filter((k) => by[k]).map((k) => `${k} ${(100 * by[k][0] / by[k][1]).toFixed(1)} (${by[k][2]})`).join(", ") + ` | range ${(100 * Math.min(...rows.map((r) => r.share))).toFixed(0)}–${(100 * Math.max(...rows.map((r) => r.share))).toFixed(0)}`);
  return pooled;
};
// LOO prediction of each seat's share: flat pooled vs class pooled vs continuous covariate (OLS on one variable)
function loo(rows, label) {
  if (rows.length < 8) return;
  const preds = { flat: [], cls: [], uni: [], on: [], lnp: [] };
  rows.forEach((r, i) => {
    const rest = rows.filter((_, j) => j !== i);
    const W = sum(rest.map((x) => x.n));
    const flat = sum(rest.map((x) => x.share * x.n)) / W;
    const same = rest.filter((x) => x.cls === r.cls);
    const k = 3; // shrink class mean toward pooled with pseudo-count k seats
    const clsMean = same.length ? (sum(same.map((x) => x.share)) + k * flat) / (same.length + k) : flat;
    preds.flat.push(flat); preds.cls.push(clsMean);
    for (const v of ["uni", "on", "lnp"]) {
      const xs = rest.map((x) => x[v]), ys = rest.map((x) => x.share), mx = mean(xs), my = mean(ys);
      const b = sum(xs.map((x, j) => (x - mx) * (ys[j] - my))) / sum(xs.map((x) => (x - mx) ** 2));
      preds[v].push(my + b * (r[v] - mx));
    }
  });
  const act = rows.map((r) => r.share);
  const m = (p) => (100 * mean(p.map((x, i) => Math.abs(x - act[i])))).toFixed(2);
  console.log(`   ${label} leave-one-out MAE (pts): flat ${m(preds.flat)} | class ${m(preds.cls)} | uni-share slope ${m(preds.uni)} | ON-primary slope ${m(preds.on)} | Coalition-primary slope ${m(preds.lnp)}   [corr with uni ${corr(rows.map((r) => r.uni), act).toFixed(2)}, ON ${corr(rows.map((r) => r.on), act).toFixed(2)}]`);
}
const fed25 = load("map/data/res-2025.json"), fed16 = load("map/data/res-2016.json"), fed22 = load("map/data/res-2022.json");
const sa26 = load("map/data/res-sa26.json"), qld17 = load("map/data/res-qld17.json"), qld20 = load("map/data/res-qld20.json"), qld24 = load("map/data/res-qld24.json");
const saCls = inheritClass(sa26, fed25, "SA"), q17Cls = inheritClass(qld17, fed16, "QLD"), q20Cls = inheritClass(qld20, fed22, "QLD");

console.log("\nCoalition -> Labor share, in Labor v One Nation finals");
let r = threeWay(sa26, saCls, ["alp", "onp"], "lnp", "alp"); show(" SA 2026 ", r); loo(r, "SA 2026");
const sa = r;
r = threeWay(qld17, q17Cls, ["alp", "onp"], "lnp", "alp"); show(" Qld 2017", r); loo(r, "Qld 2017");
const q17 = r;
r = threeWay(qld20, q20Cls, ["alp", "onp"], "lnp", "alp"); show(" Qld 2020", r);
r = threeWay(fed25, null, ["alp", "onp"], "lnp", "alp"); show(" Fed 2025", r);
console.log("\nLabor -> Coalition share, in Coalition v One Nation finals");
r = threeWay(sa26, saCls, ["lnp", "onp"], "alp", "lnp"); show(" SA 2026 ", r);
r = threeWay(qld17, q17Cls, ["lnp", "onp"], "alp", "lnp"); show(" Qld 2017", r); loo(r, "Qld 2017");
r = threeWay(fed25, null, ["lnp", "onp"], "alp", "lnp"); show(" Fed 2025", r);
r = threeWay(fed22, null, ["lnp", "onp"], "alp", "lnp"); show(" Fed 2022", r);
console.log("\nOne Nation -> Labor share, in Labor v Coalition finals (for contrast)");
r = threeWay(sa26, saCls, ["alp", "lnp"], "onp", "alp"); show(" SA 2026 ", r); loo(r, "SA 2026");
r = threeWay(qld17, q17Cls, ["alp", "lnp"], "onp", "alp"); show(" Qld 2017", r); loo(r, "Qld 2017");
r = threeWay(fed25, null, ["alp", "lnp"], "onp", "alp"); show(" Fed 2025", r); loo(r, "Fed 2025");
console.log("\nSA 2026 Labor v ON seats, detail (class inherited from the federal footprint):");
console.log(sa.sort((a, b) => a.share - b.share).map((x) => `${x.name} ${(100 * x.share).toFixed(0)} [${x.cls}, uni ${(100 * x.uni).toFixed(0)}%, ON ${(100 * x.on).toFixed(0)}]`).join("; "));
console.log("\nQld 2017 Labor v ON seats, detail:");
console.log(q17.sort((a, b) => a.share - b.share).map((x) => `${x.name} ${(100 * x.share).toFixed(0)} [${x.cls}, uni ${(100 * (x.uni ?? 0)).toFixed(0)}%, ON ${(100 * x.on).toFixed(0)}]`).join("; "));
