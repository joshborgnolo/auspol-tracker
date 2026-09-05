/* throwaway: proper term-level re-election model.
   Ridge logistic regression (L2, standardised features, intercept free),
   leave-one-out evaluation over the 13 completed terms.
   Model A "autopsy": full-term trajectory features — pmNet_late (final 6mo
     mean), pmNet_trend (final6 − first18), prim_late/prim_trend (primary
     swing vs own election, same windows), govAge (consecutive terms of govt),
     plus ppm_late/tpp_late variants with in-fold median imputation
     (pre-1996 terms lack 2PP; 1987 lacks PPM).
   Model B "live": identical features computed from months [12,18) + baseline
     [0,5) only — everything knowable 16 months in — then scored for 2025.
   Data: origin/main polls.json. */
import { execSync } from "node:child_process";

// --json: silence the prose and print only a machine-readable live-call
// summary (consumed by .build/refresh-prediction.mjs).
const JSON_OUT = process.argv.includes("--json");
if (JSON_OUT) console.log = () => {};

const D = JSON.parse(execSync("git show origin/main:data/polls.json", { maxBuffer: 1 << 28, encoding: "utf8" }));
const WIN = { 1977: "lnp", 1980: "lnp", 1983: "alp", 1984: "alp", 1987: "alp", 1990: "alp", 1993: "alp",
  1996: "lnp", 1998: "lnp", 2001: "lnp", 2004: "lnp", 2007: "alp", 2010: "alp", 2013: "lnp",
  2016: "lnp", 2019: "lnp", 2022: "alp", 2025: "alp" };
const TERMS = [1987, 1990, 1993, 1996, 1998, 2001, 2004, 2007, 2010, 2013, 2016, 2019, 2022];
const E = Object.fromEntries(Object.entries(D.elections).map(([k, v]) => [+k.slice(1), v]));
const mo = (d, e) => (new Date(d) - new Date(e)) / (30.4375 * 864e5);
const inW = (d, e, lo, hi) => { const m = mo(d, e); return m >= lo && m < hi; };
const mean = (xs) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;

const govAge = (y) => { let n = 1, p = WIN[y]; for (let k = y - 3; WIN[k] != null; k -= 3) { if (WIN[k] === p) n++; else break; } return n; };

const termSpan = (y) => { const i = Object.keys(WIN).map(Number).sort((a, b) => a - b); return [y, i[i.indexOf(y) + 1]]; };

function fullTerm(y) {
  const e = E[y], gov = WIN[y], next = termSpan(y)[1], spanMo = mo(E[next].date, e.date);
  const appr = D.cycleApproval[String(y)] || [];
  const poll = D.cyclePolls[String(next)].filter((r) => r.firm !== "Election");
  const late = (r) => mo(r.date, e.date) > spanMo - 6, early = (r) => mo(r.date, e.date) < 18;
  const m = (rows, key) => mean(rows.map((r) => r[key]).filter((v) => v != null));
  const pick = (rows) => rows.filter(late), pickE = (rows) => rows.filter(early);
  const prim = (r) => r[gov], tpp = (r) => r["tpp_" + gov];
  return {
    y, ousted: WIN[next] !== gov ? 1 : 0, govAge: govAge(y),
    pmNet_late: m(pick(appr), "pmNet"), pmNet_early: m(pickE(appr), "pmNet"),
    ppm_late: mean(pick(appr).filter((r) => r.pmPpm != null).map((r) => r.pmPpm - r.oppPpm)),
    prim_late: (() => { const v = m(pick(poll), gov); return v == null ? null : v - e[gov]; })(),
    prim_early: (() => { const v = m(pickE(poll), gov); return v == null ? null : v - e[gov]; })(),
    tpp_late: (() => { const v = mean(pick(poll).map(tpp).filter((v) => v != null)); return v == null ? null : v - e["tpp_" + gov]; })(),
  };
}

function live16(y, cur) {
  const e = E[y], gov = WIN[y];
  const appr = cur ? D.approval.map((r) => ({ date: r.date, pmNet: r.alb })) : (D.cycleApproval[String(y)] || []);
  const ppmr = cur ? D.ppm.map((r) => ({ date: r.date, l: r.alb != null && r.opp != null ? r.alb - r.opp : null }))
    : (D.cycleApproval[String(y)] || []).map((r) => ({ date: r.date, l: r.pmPpm != null ? r.pmPpm - r.oppPpm : null }));
  const poll = (cur ? D.polls : D.cyclePolls[String(termSpan(y)[1])].filter((r) => r.firm !== "Election"));
  const w15 = (r) => inW(r.date, e.date, 12, 18), w0 = (r) => inW(r.date, e.date, 0, 5);
  const pmNet15 = mean(appr.filter(w15).map((r) => r.pmNet).filter((v) => v != null));
  const pmNet0 = mean(appr.filter(w0).map((r) => r.pmNet).filter((v) => v != null));
  const ppm15 = mean(ppmr.filter(w15).map((r) => r.l).filter((v) => v != null));
  const vi15 = poll.filter(w15);
  const prim = mean(vi15.map((r) => r[gov]).filter((v) => v != null));
  const tpp = mean(vi15.map((r) => r["tpp_" + gov]).filter((v) => v != null));
  return {
    y, ousted: cur ? null : (WIN[termSpan(y)[1]] !== gov ? 1 : 0), govAge: govAge(y),
    pmNet15, pmNetDrop: pmNet15 == null || pmNet0 == null ? null : pmNet0 - pmNet15, ppm15,
    primSw: prim == null ? null : prim - e[gov],
    tppSw: tpp == null ? null : tpp - e["tpp_" + gov],
  };
}

// ridge logistic: standardise on train, intercept unpenalised, fixed GD
function fitRidge(X, y, lam) {
  const n = X.length, p = X[0].length;
  const mu = Array(p).fill(0), sd = Array(p).fill(1);
  for (let j = 0; j < p; j++) { mu[j] = mean(X.map((r) => r[j])); sd[j] = Math.sqrt(mean(X.map((r) => (r[j] - mu[j]) ** 2))) || 1; }
  const Z = X.map((r) => r.map((v, j) => (v - mu[j]) / sd[j]));
  let b0 = 0; const b = Array(p).fill(0);
  for (let it = 0; it < 6000; it++) {
    let g0 = 0; const g = Array(p).fill(0);
    for (let i = 0; i < n; i++) {
      const z = Math.max(-30, Math.min(30, b0 + b.reduce((s, v, j) => s + v * Z[i][j], 0)));
      const q = 1 / (1 + Math.exp(-z)) - y[i];
      g0 += q; for (let j = 0; j < p; j++) g[j] += q * Z[i][j];
    }
    b0 -= 0.05 * g0 / n;
    for (let j = 0; j < p; j++) b[j] -= 0.05 * (g[j] / n + lam * b[j] / n);
  }
  const predict = (row) => 1 / (1 + Math.exp(-(b0 + b.reduce((s, v, j) => s + v * (row[j] - mu[j]) / sd[j], 0))));
  return { predict, b0, b, mu, sd };
}

const impute = (rows, keys, trainIdx) => {
  const med = {};
  for (const k of keys) {
    const vals = trainIdx.map((i) => rows[i][k]).filter((v) => v != null).sort((a, b) => a - b);
    med[k] = vals.length ? vals[Math.floor(vals.length / 2)] : 0;
  }
  return rows.map((r) => keys.map((k) => r[k] == null ? med[k] : r[k]));
};

function loocv(rows, keys, lam, labelOut) {
  const idx = rows.map((_, i) => i);
  const probs = [], errs = [];
  for (const held of idx) {
    const tr = idx.filter((i) => i !== held);
    const X = impute(rows, keys, tr);
    const mdl = fitRidge(tr.map((i) => X[i]), tr.map((i) => rows[i].ousted), lam);
    const p = mdl.predict(X[held]);
    probs.push([rows[held].y, p, rows[held].ousted]);
    if ((p >= 0.5 ? 1 : 0) !== rows[held].ousted) errs.push(`${rows[held].y} (p=${p.toFixed(2)}, ${rows[held].ousted ? "OUSTED" : "re-elected"})`);
  }
  const acc = probs.filter(([, p, o]) => (p >= 0.5 ? 1 : 0) === o).length;
  const brier = mean(probs.map(([, p, o]) => (p - o) ** 2));
  console.log(`${labelOut}: LOOCV ${acc}/${rows.length} = ${(100 * acc / rows.length).toFixed(0)}% · Brier ${brier.toFixed(3)}`);
  console.log("  per-term p(ousted): " + probs.map(([y, p, o]) => `${y}=${p.toFixed(2)}${(p >= 0.5 ? 1 : 0) === o ? "" : "✗"}`).join(" "));
  if (errs.length) console.log("  misses: " + errs.join("; "));
  return { acc, brier, probs };
}

const rowsA = TERMS.map(fullTerm);
const SETS = {
  "A1 pmNet_late+pmNet_trend+prim_late+prim_trend": ["pmNet_late", "pmNet_early", "prim_late", "prim_early"],
  "A2 +govAge": ["pmNet_late", "pmNet_early", "prim_late", "prim_early", "govAge"],
  "A3 +ppm_late+tpp_late (imputed)": ["pmNet_late", "pmNet_early", "prim_late", "prim_early", "govAge", "ppm_late", "tpp_late"],
};
// pmNet_trend/prim_trend enter as the early/late pair (model learns the difference)
console.log("=== Model A — full-term (autopsy) features, λ=1 ===");
const rA = {};
for (const [name, keys] of Object.entries(SETS)) rA[name] = loocv(rowsA, keys, 1, name);

console.log("\nλ sensitivity on A2:");
for (const lam of [0.1, 0.3, 1, 3, 10]) loocv(rowsA, SETS["A2 +govAge"], lam, `  λ=${lam}`);

// full-data A2 fit for interpretable coefficients
{
  const keys = SETS["A2 +govAge"];
  const X = rowsA.map((r) => keys.map((k) => r[k]));
  const mdl = fitRidge(X, rowsA.map((r) => r.ousted), 1);
  console.log("\nA2 standardised coefficients (full fit): " + keys.map((k, j) => `${k} ${mdl.b[j] >= 0 ? "+" : ""}${mdl.b[j].toFixed(2)}`).join(" · "));
}

console.log("\n=== Model B — live (features knowable 16 months in) ===");
const rowsB = TERMS.map((y) => live16(y, false));
const BKEYS = ["pmNet15", "pmNetDrop", "ppm15", "primSw", "tppSw", "govAge"];
for (const lam of [0.3, 1, 3]) loocv(rowsB, BKEYS, lam, `B λ=${lam}`);
const cur = live16(2025, true);
let ridgeLiveP = null;
{
  const Xh = impute(rowsB.concat([cur]), BKEYS, rowsB.map((_, i) => i));
  const mdl = fitRidge(Xh.slice(0, rowsB.length), rowsB.map((r) => r.ousted), 1);
  const p = mdl.predict(Xh.at(-1));
  ridgeLiveP = p;
  console.log(`\nAlbanese-2025 features: ` + BKEYS.map((k) => `${k}=${cur[k] == null ? "—" : +cur[k].toFixed(1)}`).join(" "));
  console.log(`LIVE p(ousted | first-16-months profile, λ=1) = ${p.toFixed(2)} → predict ${p >= 0.5 ? "OUSTED" : "re-elected"}`);
}
console.log("\nbaselines: majority 'always re-elected' = 9/13 = 69%");

// ================= part 3 — is this as good as it gets? =================
// (a) does ALGORITHM choice matter on the A2 features?
const auc = (pairs) => {
  let s = 0, n1 = 0, n0 = 0;
  for (const [, p] of pairs) n1 += 1;
  const pos = pairs.filter(([, , o]) => o === 1), neg = pairs.filter(([, , o]) => o === 0);
  for (const [, p1] of pos) for (const [, p0] of neg) s += p1 > p0 ? 1 : p1 === p0 ? 0.5 : 0;
  n0 = neg.length; n1 = pos.length;
  return s / (n0 * n1);
};
const stdz = (X, tr) => {
  const p = X[0].length, mu = Array(p).fill(0), sd = Array(p).fill(1);
  for (let j = 0; j < p; j++) { mu[j] = mean(tr.map((i) => X[i][j])); sd[j] = Math.sqrt(mean(tr.map((i) => (X[i][j] - mu[j]) ** 2))) || 1; }
  return { mu, sd };
};
function loocvGeneric(rows, keys, probFn, label) {
  const idx = rows.map((_, i) => i), pairs = [];
  let acc = 0;
  for (const held of idx) {
    const tr = idx.filter((i) => i !== held);
    const X = impute(rows, keys, tr);
    const { mu, sd } = stdz(X, tr);
    const p = probFn(tr.map((i) => ({ x: X[i].map((v, j) => (v - mu[j]) / sd[j]), y: rows[i].ousted })),
      X[held].map((v, j) => (v - mu[j]) / sd[j]));
    pairs.push([rows[held].y, p, rows[held].ousted]);
    acc += (p >= 0.5 ? 1 : 0) === rows[held].ousted;
  }
  const brier = mean(pairs.map(([, p, o]) => (p - o) ** 2));
  console.log(`${label}: LOOCV ${acc}/${rows.length} = ${(100 * acc / rows.length).toFixed(0)}% · AUC ${auc(pairs).toFixed(2)} · Brier ${brier.toFixed(3)}`);
  return { pairs, acc };
}
// LDA (pooled covariance via diagonal approx — safe at n=12,p=5)
const lda = (train, z) => {
  const by = [0, 1].map((c) => train.filter((t) => t.y === c));
  const mu = by.map((g) => z.map((_, j) => mean(g.map((t) => t.x[j]))));
  const v = z.map((_, j) => mean(train.map((t) => (t.x[j] - mu[t.y][j]) ** 2)));
  const prior = by.map((g) => g.length / train.length);
  const ll = (c) => Math.log(prior[c]) + z.reduce((s, zj, j) => s - 0.5 * (zj - mu[c][j]) ** 2 / (v[j] || 1e-9), 0);
  const s = ll(1) - ll(0); return 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, s))));
};
const knn1 = (train, z) => { let bi = 0, bd = 1e9; train.forEach((t, i) => { const d = t.x.reduce((s, v, j) => s + (v - z[j]) ** 2, 0); if (d < bd) { bd = d; bi = i; } }); return train[bi].y; };
const knn3 = (train, z) => mean(train.map((t) => ({ d: t.x.reduce((s, v, j) => s + (v - z[j]) ** 2, 0), y: t.y })).sort((a, b) => a.d - b.d).slice(0, 3).map((t) => t.y));
const gnb = lda; // diagonal LDA IS Gaussian naive Bayes with equal-variance relax
console.log("\n=== part 3a: same A2 features, different estimators ===");
loocvGeneric(rowsA, SETS["A2 +govAge"], lda, "LDA/diag-NB   ");
loocvGeneric(rowsA, SETS["A2 +govAge"], knn1, "kNN k=1       ");
loocvGeneric(rowsA, SETS["A2 +govAge"], knn3, "kNN k=3       ");
const ridgePairs = loocvGeneric(rowsA, SETS["A2 +govAge"], (tr, z) => fitRidge(tr.map((t) => t.x), tr.map((t) => t.y), 1).predict(z), "ridge logistic");

// (b) how tautological is full-term skill? single features on the 10 2PP-era terms
console.log("\n=== part 3b: single-feature ceilings ===");
{
  let hit = 0, n = 0; const rows = [];
  for (const y of TERMS) {
    const e = E[y], gov = WIN[y], next = termSpan(y)[1], span = mo(E[next].date, e.date);
    const poll = D.cyclePolls[String(next)].filter((r) => r.firm !== "Election" && mo(r.date, e.date) > span - 6);
    const t = mean(poll.map((r) => r["tpp_" + gov]).filter((v) => v != null));
    if (t == null) continue;
    n++; const ousted = WIN[next] !== gov ? 1 : 0, pred = t < 50 ? 1 : 0;
    hit += pred === ousted;
    rows.push(`${y}: gov2PP(late6mo)=${t.toFixed(1)} → ${pred ? "oust" : "keep"} ${pred === ousted ? "" : "✗ actually " + (ousted ? "OUSTED" : "re-elected")}`);
  }
  console.log(`final-6mo gov 2PP < 50 ⇒ ousted: ${hit}/${n} = ${(100 * hit / n).toFixed(0)}% on the ${n} two-party-era terms`);
  rows.forEach((r) => console.log("  " + r));
}

// (c) what theory features add: unemployment@election (approx ABS), mid-term PM spill, minority term
console.log("\n=== part 3c: theory features (econ/spill/minority) ===");
const UNEMP = { 1987: 8.2, 1990: 6.7, 1993: 10.9, 1996: 8.5, 1998: 7.4, 2001: 6.7, 2004: 5.4, 2007: 4.4, 2010: 5.2, 2013: 5.8, 2016: 5.7, 2019: 5.2, 2022: 3.9 }; // approx, quarter of election
const SPILL = { 1990: 1, 2007: 1, 2010: 1, 2013: 1, 2016: 1 };                  // PM replaced mid-term
const MINOR = { 2010: 1 };
const rowsExt = rowsA.map((r) => ({ ...r, unemp: UNEMP[r.y], spill: SPILL[r.y] || 0, minor: MINOR[r.y] || 0 }));
loocvGeneric(rowsExt, [...SETS["A2 +govAge"], "unemp"], (tr, z) => fitRidge(tr.map((t) => t.x), tr.map((t) => t.y), 1).predict(z), "A2+unemp        ");
loocvGeneric(rowsExt, [...SETS["A2 +govAge"], "spill", "minor"], (tr, z) => fitRidge(tr.map((t) => t.x), tr.map((t) => t.y), 1).predict(z), "A2+spill+minor  ");
loocvGeneric(rowsExt, [...SETS["A2 +govAge"], "unemp", "spill", "minor"], (tr, z) => fitRidge(tr.map((t) => t.x), tr.map((t) => t.y), 1).predict(z), "A2+all three    ");
loocvGeneric(rowsExt, ["govAge", "unemp", "spill", "minor"], (tr, z) => fitRidge(tr.map((t) => t.x), tr.map((t) => t.y), 1).predict(z), "theory-only     ");
const binomSE = (a, n) => Math.sqrt(a / n * (1 - a / n) / n);
{ const a = 11 / 13; console.log(`\nnote: 11/13 = 85% carries ±${(100 * 2 * binomSE(a, 13)).toFixed(0)}pp (95% Wilson ≈ [58%,96%]) — adjacent accuracies here are statistically indistinguishable`); }

if (JSON_OUT) {
  process.stdout.write(JSON.stringify({
    window: [12, 18],
    liveP: ridgeLiveP,
    features: Object.fromEntries(BKEYS.map((k) => [k, cur[k]])),
  }) + "\n");
}

