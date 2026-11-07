// E10: is IRSAD a better predictor of preference flows than AEC seat type?
// Same out-of-sample tests as E8/E8b, with IRSAD (score, comparable across states within a census) and the
// Coalition's own strength added as candidate predictors.
import { load, boothRows, km, sum, mean, corr, ridge } from "./lib.mjs";
const CLS = { "Inner Metropolitan": "inner", "Outer Metropolitan": "outer", "Provincial": "prov", "Rural": "rural" };
const KEYS = ["inner", "outer", "prov", "rural"];

function inheritClass(stateData, fedData, st) {
  const fb = boothRows(fedData).filter((b) => b.st === st && b.tot >= 30);
  const sb = boothRows(stateData);
  const votes = stateData.divs.map(() => ({}));
  for (const b of sb) {
    let best = null, bd = 1e9;
    for (const f of fb) { const d = km(b, f); if (d < bd) { bd = d; best = f; } }
    const cls = CLS[fedData.divs[best.d].cls];
    votes[b.d][cls] = (votes[b.d][cls] || 0) + b.tot;
  }
  return votes.map((v) => Object.entries(v).sort((a, b) => b[1] - a[1])[0]?.[0]);
}
const shareOf = (dv, b) => sum(dv.c.filter((c) => c[3] === b).map((c) => c[4])) / sum(dv.c.map((c) => c[4]));

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
    const tpp = dv.tpp; // [alp, coal] in these stores
    rows.push({
      name: dv.n, cls: classes ? classes[i] : (CLS[dv.cls] || dv.cls), share: a / t, n: t,
      irsad: dv.seifa?.irsad?.v ?? dv.seifa?.irsd?.v, irsd: dv.seifa?.irsd?.v, uni: dv.demo?.uni,
      lnp: shareOf(dv, "lnp"), on: shareOf(dv, "onp"),
    });
  });
  return rows;
}

// LOO within one election. Models: flat; class (shrunk k=3, as E8b); single-variable OLS slopes; class + IRSAD (ridge).
function looThree(rows, label) {
  const preds = { flat: [], cls: [], irsad: [], uni: [], lnp: [], clsIrsad: [], irsadLnp: [], clsLnp: [] };
  rows.forEach((r, i) => {
    const rest = rows.filter((_, j) => j !== i);
    const flat = sum(rest.map((x) => x.share * x.n)) / sum(rest.map((x) => x.n));
    const same = rest.filter((x) => x.cls === r.cls);
    const k = 3;
    const clsMean = same.length ? (sum(same.map((x) => x.share)) + k * flat) / (same.length + k) : flat;
    preds.flat.push(flat); preds.cls.push(clsMean);
    for (const v of ["irsad", "uni", "lnp"]) {
      const xs = rest.map((x) => x[v]), ys = rest.map((x) => x.share), mx = mean(xs), my = mean(ys);
      const b = sum(xs.map((x, j) => (x - mx) * (ys[j] - my))) / sum(xs.map((x) => (x - mx) ** 2));
      preds[v].push(my + b * (r[v] - mx));
    }
    // two-predictor fits: class enters as the shrunk class mean's offset (so it keeps its shrinkage), plus a slope on the residual
    const two = (fx) => {
      const X = rest.map(fx), y = rest.map((x) => x.share);
      const m = ridge(X, y, null, 0.5);
      return m.predict(fx(r));
    };
    const clsOff = (x) => { const s = rest.filter((z) => z.cls === x.cls && z !== x); return s.length ? (sum(s.map((z) => z.share)) + k * flat) / (s.length + k) : flat; };
    preds.clsIrsad.push(two((x) => [clsOff(x), x.irsad]));
    preds.irsadLnp.push(two((x) => [x.irsad, x.lnp]));
    preds.clsLnp.push(two((x) => [clsOff(x), x.lnp]));
  });
  const act = rows.map((r) => r.share);
  const m = (p) => (100 * mean(p.map((x, i) => Math.abs(x - act[i])))).toFixed(2);
  const c = (v) => corr(rows.map((r) => r[v]), act).toFixed(2);
  console.log(`  ${label} (${rows.length} seats) LOO MAE: flat ${m(preds.flat)} | class ${m(preds.cls)} | IRSAD ${m(preds.irsad)} | uni ${m(preds.uni)} | Coal primary ${m(preds.lnp)} || class+IRSAD ${m(preds.clsIrsad)} | IRSAD+Coal ${m(preds.irsadLnp)} | class+Coal ${m(preds.clsLnp)}`);
  console.log(`      corr with share: IRSAD ${c("irsad")}, uni ${c("uni")}, Coal primary ${c("lnp")}; corr IRSAD~uni ${corr(rows.map((r) => r.irsad), rows.map((r) => r.uni)).toFixed(2)}, IRSAD~Coal ${corr(rows.map((r) => r.irsad), rows.map((r) => r.lnp)).toFixed(2)}`);
  // IRSAD by class, to see how much they overlap
  const by = {}; for (const r of rows) { (by[r.cls] = by[r.cls] || []).push(r); }
  console.log("      by class: " + KEYS.filter((k2) => by[k2]).map((k2) => `${k2} n${by[k2].length} share ${(100 * mean(by[k2].map((r) => r.share))).toFixed(1)} IRSAD ${mean(by[k2].map((r) => r.irsad)).toFixed(0)} [${Math.min(...by[k2].map((r) => r.irsad)).toFixed(0)}–${Math.max(...by[k2].map((r) => r.irsad)).toFixed(0)}]`).join("; "));
  return rows;
}

const fed25 = load("maps/data/res-2025.json"), fed16 = load("maps/data/res-2016.json");
const sa26 = load("maps/data/res-sa26.json"), qld17 = load("maps/data/res-qld17.json");
const saCls = inheritClass(sa26, fed25, "SA"), q17Cls = inheritClass(qld17, fed16, "QLD");

console.log("\n=== A. Three-way: Coalition -> Labor in Labor v One Nation finals ===");
const sa = looThree(threeWay(sa26, saCls, ["alp", "onp"], "lnp", "alp"), "SA 2026");
const q17 = looThree(threeWay(qld17, q17Cls, ["alp", "onp"], "lnp", "alp"), "Qld 2017");
console.log("  SA 2026 detail, sorted by IRSAD: " + [...sa].sort((a, b) => a.irsad - b.irsad).map((x) => `${x.name} ${(100 * x.share).toFixed(0)} [${x.cls}, ${x.irsad.toFixed(0)}, Lib ${(100 * x.lnp).toFixed(0)}]`).join("; "));
console.log("  Qld 2017 detail, sorted by IRSAD: " + [...q17].sort((a, b) => a.irsad - b.irsad).map((x) => `${x.name} ${(100 * x.share).toFixed(0)} [${x.cls}, ${x.irsad.toFixed(0)}, LNP ${(100 * x.lnp).toFixed(0)}]`).join("; "));

console.log("\n=== A2. One Nation -> Labor in Labor v Coalition finals (state + federal 2025) ===");
looThree(threeWay(sa26, saCls, ["alp", "lnp"], "onp", "alp"), "SA 2026");
looThree(threeWay(qld17, q17Cls, ["alp", "lnp"], "onp", "alp"), "Qld 2017");
looThree(threeWay(fed25, null, ["alp", "lnp"], "onp", "alp"), "Fed 2025");
console.log("\n=== A3. Labor -> Coalition in Coalition v One Nation finals ===");
looThree(threeWay(qld17, q17Cls, ["lnp", "onp"], "alp", "lnp"), "Qld 2017");

// ---------- B. Federal classic flows, next-election test ----------
const YEARS = [2007, 2010, 2013, 2016, 2019, 2022, 2025];
const bucketOf = (b) => (b === "grn" ? "grn" : b === "onp" ? "onp" : b === "alp" || b === "lnp" ? null : "oth");
const data = {};
for (const y of YEARS) {
  const D = load(`maps/data/res-${y}.json`);
  const seats = {};
  for (const dv of D.divs) {
    if (!dv.tcp || dv.tcp.length !== 2) continue;
    const pair = dv.tcp.map((t) => dv.c[t[0]][3]);
    if (!(pair.includes("alp") && pair.includes("lnp"))) continue;
    const alpIdx = pair.indexOf("alp");
    const acc = {};
    for (const f of dv.fl || []) {
      const b = bucketOf(dv.c[f[0]][3]); if (!b) continue;
      const toAlp = alpIdx === 0 ? f[1] : f[2], tot = f[1] + f[2];
      acc[b] = acc[b] || [0, 0]; acc[b][0] += toAlp; acc[b][1] += tot;
    }
    const tpp = dv.tpp; const coalMargin = tpp && tpp[0] + tpp[1] > 0 ? tpp[1] / (tpp[0] + tpp[1]) - 0.5 : null;
    seats[dv.n] = { cls: CLS[dv.cls] || dv.cls, irsad: dv.seifa?.irsad?.v ?? dv.seifa?.irsd?.v, uni: dv.demo?.uni, margin: coalMargin, lnp: shareOf(dv, "lnp"), acc };
  }
  data[y] = seats;
}
// fit at one election: national rate, class gaps, weighted slopes on demeaned covariates, class+IRSAD joint
function fit(seats, donor) {
  const S = Object.values(seats).filter((s) => s.acc[donor] && s.acc[donor][1] >= 200 && s.irsad != null);
  const w = S.map((s) => s.acc[donor][1]), y = S.map((s) => s.acc[donor][0] / s.acc[donor][1]);
  const W = sum(w), nat = sum(S.map((s, i) => w[i] * y[i])) / W;
  const cls = {}; S.forEach((s, i) => { cls[s.cls] = cls[s.cls] || [0, 0]; cls[s.cls][0] += w[i] * y[i]; cls[s.cls][1] += w[i]; });
  const clsGap = Object.fromEntries(Object.entries(cls).map(([k, v]) => [k, v[0] / v[1] - nat]));
  const slope = (key) => {
    const xs = S.map((s) => s[key]); const mx = sum(xs.map((x, i) => w[i] * x)) / W;
    const b = sum(xs.map((x, i) => w[i] * (x - mx) * (y[i] - nat))) / sum(xs.map((x, i) => w[i] * (x - mx) ** 2));
    return { b, mx };
  };
  const dm = (key) => { const xs = S.map((s) => s[key]); return sum(xs.map((x, i) => w[i] * x)) / W; };
  // joint class dummies + IRSAD (WLS via ridge with tiny penalty)
  const X = S.map((s) => [s.cls === "outer" ? 1 : 0, s.cls === "prov" ? 1 : 0, s.cls === "rural" ? 1 : 0, s.irsad]);
  const joint = ridge(X, y, w, 1e-6);
  const Xm = S.map((s) => [s.irsad, s.margin]);
  const jointIM = ridge(Xm, y, w, 1e-6);
  return { nat, clsGap, irsad: slope("irsad"), uni: slope("uni"), margin: slope("margin"), lnp: slope("lnp"), joint, jointIM, S, w, y };
}
console.log("\n=== B. Federal classic seats: predict each seat's donor->Labor share at E, national level at E given ===");
console.log("Vote-weighted MAE (pts). Gaps/slopes fitted at E-1 and applied to the seat's values (IRSAD at E; margin = seat's E-1 Coalition 2PP).");
console.log("Columns: flat | class | IRSAD | class+IRSAD (joint) | Coal margin | IRSAD+margin | seat's own E-1 gap | 0.5 seat+0.5 class | 0.5 seat+0.5 IRSAD | in-sample at E: class R2, IRSAD R2, both R2");
for (const donor of ["grn", "onp", "oth"]) {
  const tot = {};
  const add = (k, w, e) => { tot[k] = tot[k] || [0, 0]; tot[k][0] += w * e; tot[k][1] += w; };
  const lines = [];
  for (let i = 1; i < YEARS.length; i++) {
    const E = YEARS[i], P = YEARS[i - 1];
    const fE = fit(data[E], donor), fP = fit(data[P], donor);
    if (fE.S.length < 10 || fP.S.length < 10) continue;
    const per = {}; let n = 0;
    // mean of predictors at E over the E sample (weights = E flows), so a slope moves only the seat-to-seat pattern
    const mIrsadE = sum(fE.S.map((s, j) => fE.w[j] * s.irsad)) / sum(fE.w);
    for (const [name, s] of Object.entries(data[E])) {
      const a = s.acc[donor]; if (!a || a[1] < 200 || s.irsad == null) continue;
      const prev = data[P][name]; const pa = prev?.acc[donor];
      if (!pa || pa[1] < 200 || fP.clsGap[s.cls] == null || prev.margin == null) continue;
      n++;
      const actual = a[0] / a[1], w = a[1];
      const clsGap = fP.clsGap[s.cls], seatGap = pa[0] / pa[1] - fP.nat;
      const irGap = fP.irsad.b * (s.irsad - mIrsadE);
      const mgGap = fP.margin.b * (prev.margin - fP.margin.mx);
      // joint models: predicted gap relative to their own weighted mean at E
      const jRaw = (m, xs) => m.predict(xs);
      const jMeanE = sum(fE.S.map((z, j) => fE.w[j] * jRaw(fP.joint, [z.cls === "outer" ? 1 : 0, z.cls === "prov" ? 1 : 0, z.cls === "rural" ? 1 : 0, z.irsad]))) / sum(fE.w);
      const jGap = jRaw(fP.joint, [s.cls === "outer" ? 1 : 0, s.cls === "prov" ? 1 : 0, s.cls === "rural" ? 1 : 0, s.irsad]) - jMeanE;
      const imMeanP = sum(fP.S.map((z, j) => fP.w[j] * jRaw(fP.jointIM, [z.irsad, z.margin]))) / sum(fP.w);
      const imGap = jRaw(fP.jointIM, [s.irsad, prev.margin]) - imMeanP - fP.irsad.b * 0 + (fP.jointIM.b[0] * (mIrsadE - sum(fP.S.map((z, j) => fP.w[j] * z.irsad)) / sum(fP.w))) * -1;
      const preds = {
        flat: fE.nat, cls: fE.nat + clsGap, irsad: fE.nat + irGap, joint: fE.nat + jGap, margin: fE.nat + mgGap, im: fE.nat + imGap,
        seat: fE.nat + seatGap, seatCls: fE.nat + 0.5 * seatGap + 0.5 * clsGap, seatIr: fE.nat + 0.5 * seatGap + 0.5 * irGap,
      };
      for (const k of Object.keys(preds)) { const e = Math.abs(preds[k] - actual); per[k] = per[k] || [0, 0]; per[k][0] += w * e; per[k][1] += w; add(k, w, e); }
    }
    // in-sample R2 at E (weighted), class vs IRSAD vs both
    const r2 = (pred) => { const ss = sum(fE.y.map((v, j) => fE.w[j] * (v - pred[j]) ** 2)), st = sum(fE.y.map((v, j) => fE.w[j] * (v - fE.nat) ** 2)); return 1 - ss / st; };
    const pc = fE.S.map((s) => fE.nat + fE.clsGap[s.cls]);
    const mI = sum(fE.S.map((s, j) => fE.w[j] * s.irsad)) / sum(fE.w);
    const pi = fE.S.map((s) => fE.nat + fE.irsad.b * (s.irsad - mI));
    const pj = fE.S.map((s) => fE.joint.predict([s.cls === "outer" ? 1 : 0, s.cls === "prov" ? 1 : 0, s.cls === "rural" ? 1 : 0, s.irsad]));
    const f = (k) => (100 * per[k][0] / per[k][1]).toFixed(2).padStart(6);
    lines.push(`  ${donor.toUpperCase()} ${E} n${String(n).padStart(4)} ${f("flat")} ${f("cls")} ${f("irsad")} ${f("joint")} ${f("margin")} ${f("im")} ${f("seat")} ${f("seatCls")} ${f("seatIr")}   R2 ${r2(pc).toFixed(2)} ${r2(pi).toFixed(2)} ${r2(pj).toFixed(2)}  (IRSAD slope ${(100 * fE.irsad.b * 100).toFixed(1)} pts/100)`);
  }
  console.log(lines.join("\n"));
  const g = (k) => (100 * tot[k][0] / tot[k][1]).toFixed(2).padStart(6);
  console.log(`  ${donor.toUpperCase()} all          ${g("flat")} ${g("cls")} ${g("irsad")} ${g("joint")} ${g("margin")} ${g("im")} ${g("seat")} ${g("seatCls")} ${g("seatIr")}\n`);
}
