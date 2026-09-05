/* throwaway: discrete-time snapshot model — the "hazard" upgrade.
   Every term contributes snapshots at ages 6,12,15,18,24,30 months and
   final(span-3); each snapshot's features are trailing-3-month summaries
   knowable at that age. One pooled ridge logistic (7 features incl.
   age-fraction and swing×age interaction) over ~91 snapshots.
   Validation: leave-one-TERM-out (all snapshots of a term together).
   Accuracy is reported PER BAND — "how callable is a term N months in?".
   Albanese-2025 predicted at age 16.2mo with a 300-draw cluster bootstrap
   CI (resample whole terms). Data: origin/main polls.json. */
import { execSync } from "node:child_process";

// CLI: --age=N.N picks the current-term snapshot age for the live call
// (default 16.2, the analysis README's canonical read); --json silences the
// prose and prints one machine-readable summary line instead — consumed by
// .build/refresh-prediction.mjs. Neither flag changes the model: a default
// run is byte-identical to before.
const JSON_OUT = process.argv.includes("--json");
const AGE_ARG = process.argv.slice(2).find((a) => a.startsWith("--age="));
const SNAPSHOT_AGE = AGE_ARG ? Number(AGE_ARG.slice(6)) : 16.2;
if (AGE_ARG && (!Number.isFinite(SNAPSHOT_AGE) || SNAPSHOT_AGE <= 0 || SNAPSHOT_AGE > 36)) {
  console.error(`--age must be a month count in (0, 36]; got "${AGE_ARG}"`);
  process.exit(2);
}
if (JSON_OUT) console.log = () => {};

const D = JSON.parse(execSync("git show origin/main:data/polls.json", { maxBuffer: 1 << 28, encoding: "utf8" }));
const WIN = { 1977: "lnp", 1980: "lnp", 1983: "alp", 1984: "alp", 1987: "alp", 1990: "alp", 1993: "alp",
  1996: "lnp", 1998: "lnp", 2001: "lnp", 2004: "lnp", 2007: "alp", 2010: "alp", 2013: "lnp",
  2016: "lnp", 2019: "lnp", 2022: "alp", 2025: "alp" };
const TERMS = [1987, 1990, 1993, 1996, 1998, 2001, 2004, 2007, 2010, 2013, 2016, 2019, 2022];
const ALL = [...TERMS, 2025];
const E = Object.fromEntries(Object.entries(D.elections).map(([k, v]) => [+k.slice(1), v]));
const mo = (d, e) => (new Date(d) - new Date(e)) / (30.4375 * 864e5);
const mean = (xs) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
const med = (xs) => { const s = xs.slice().sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };
const govAge = (y) => { let n = 1, p = WIN[y]; for (let k = y - 3; WIN[k] != null; k -= 3) { if (WIN[k] === p) n++; else break; } return n; };
const curSpan = 36.5;
const spanOf = (y) => y === 2025 ? curSpan : mo(E[ALL[ALL.indexOf(y) + 1]].date, E[y].date);

const series = (y) => {
  const cur = y === 2025;
  const appr = cur ? D.approval.map((r) => ({ t: mo(r.date, E[2025].date), pmNet: r.alb }))
    : (D.cycleApproval[String(y)] || []).map((r) => ({ t: mo(r.date, E[y].date), pmNet: r.pmNet }));
  const ppm = cur ? D.ppm.map((r) => ({ t: mo(r.date, E[2025].date), l: r.alb != null && r.opp != null ? r.alb - r.opp : null }))
    : (D.cycleApproval[String(y)] || []).map((r) => ({ t: mo(r.date, E[y].date), l: r.pmPpm != null ? r.pmPpm - r.oppPpm : null }));
  const gov = WIN[y];
  const poll = (cur ? D.polls : D.cyclePolls[String(ALL[ALL.indexOf(y) + 1])].filter((r) => r.firm !== "Election"))
    .map((r) => ({ t: mo(r.date, E[y].date), prim: r[gov], tpp: r["tpp_" + gov] }));
  return { appr, ppm, poll, gov };
};

function snapshot(y, age) {
  const { appr, ppm, poll, gov } = series(y), e = E[y], span = spanOf(y);
  const win = (r) => r.t > age - 3 && r.t <= age;
  return {
    y, age, ousted: y === 2025 ? null : (WIN[ALL[ALL.indexOf(y) + 1]] !== gov ? 1 : 0),
    pmNet: mean(appr.filter(win).map((r) => r.pmNet).filter((v) => v != null)),
    ppmLead: mean(ppm.filter(win).map((r) => r.l).filter((v) => v != null)),
    primSw: (() => { const v = mean(poll.filter(win).map((r) => r.prim).filter((v) => v != null)); return v == null ? null : v - e[gov]; })(),
    tppSw: (() => { const v = mean(poll.filter(win).map((r) => r.tpp).filter((v) => v != null)); return v == null ? null : v - e["tpp_" + gov]; })(),
    govAge: govAge(y), ageFrac: age / span,
  };
}
const FKEYS = ["pmNet", "ppmLead", "primSw", "tppSw", "govAge"];
const AGES = [6, 12, 15, 18, 24, 30];
const snaps = [];
const agesOf = (y) => [...new Set([...AGES, Math.round(spanOf(y) - 3)])];
for (const y of TERMS) for (const a of agesOf(y)) snaps.push(snapshot(y, a));
// interaction feature derived post-imputation would be cleaner; precompute on raw (primSw null-safe at predict)
for (const s of snaps) s.inter = s.primSw == null ? null : s.primSw * s.ageFrac;

const KEYS = [...FKEYS, "ageFrac", "inter"];
function prep(trainRows, allRows) {
  for (const k of KEYS) {
    const m = med(trainRows.map((r) => r[k]).filter((v) => v != null)) ?? 0;
    for (const r of allRows) if (r[k] == null) r["_" + k] = m; else r["_" + k] = r[k];
  }
  const mu = {}, sd = {};
  for (const k of KEYS) {
    mu[k] = mean(trainRows.map((r) => r["_" + k]));
    sd[k] = Math.sqrt(mean(trainRows.map((r) => (r["_" + k] - mu[k]) ** 2))) || 1;
  }
  return { mu, sd };
}
const X = (r, sd) => KEYS.map((k) => (r["_" + k] - sd.mu[k]) / sd.sd[k]);
function fit(rows, sd, lam = 1, iters = 1500) {
  const n = rows.length, p = sd.mu ? KEYS.length : 0;
  let b0 = 0; const b = Array(KEYS.length).fill(0);
  for (let it = 0; it < iters; it++) {
    let g0 = 0; const g = Array(KEYS.length).fill(0);
    for (const r of rows) {
      const z = X(r, sd), s = Math.max(-30, Math.min(30, b0 + b.reduce((t, v, j) => t + v * z[j], 0)));
      const q = 1 / (1 + Math.exp(-s)) - r.ousted;
      g0 += q; for (let j = 0; j < KEYS.length; j++) g[j] += q * z[j];
    }
    b0 -= 0.05 * g0 / n;
    for (let j = 0; j < KEYS.length; j++) b[j] -= 0.05 * (g[j] / n + lam * b[j] / n);
  }
  return (r) => { const z = X(r, sd), s = b0 + b.reduce((t, v, j) => t + v * z[j], 0); return 1 / (1 + Math.exp(-s)); };
}

// ---- the age-profile for every term (fixed feature set) ------------------
// Module-scope captures for the --json emit at EOF.
const cur = snapshot(2025, SNAPSHOT_AGE);
const PROFILE_JSON = [];
let CUR_IN_SAMPLE = null, BOOT = null;
console.log("=== term-age profiles (in-sample fit, λ=1 — for shape, not validation) ===");
{
  const prepAll = prep(snaps, snaps);
  const f = fit(snaps, prepAll);
  const H = ["6", "12", "15", "18", "24", "30", "fin"];
  console.log("term  fate      " + H.map((h) => ("p@" + h).padStart(7)).join(""));
  for (const y of TERMS) {
    const bands = {};
    const row = agesOf(y).map((a) => {
      const s = snaps.find((v) => v.y === y && v.age === a);
      bands[a === agesOf(y).at(-1) ? "fin" : String(a)] = f(s);
      return f(s).toFixed(2).padStart(7);
    });
    PROFILE_JSON.push({ y, ousted: snaps.find((v) => v.y === y).ousted, span: +spanOf(y).toFixed(1), finAge: agesOf(y).at(-1), bands });
    console.log(`${y}  ${snaps.find((v) => v.y === y).ousted ? "OUSTED  " : "re-elect"}${row.join("")}`);
  }
  prep(snaps, [cur]);
  CUR_IN_SAMPLE = f(cur);
  console.log(`2025  CURRENT   ${"(now)".padStart(7 * 3)}${CUR_IN_SAMPLE.toFixed(2).padStart(7)}  ← p(ousted) at ${SNAPSHOT_AGE} months in`);
}

// ---- leave-one-term-out: accuracy per term-age band ----------------------
console.log("\n=== leave-one-term-out (λ=1) ===");
const lams = [1];
for (const lam of lams) {
  const byBand = new Map(AGES.concat(["fin"]).map((a) => [String(a), []]));
  const allPairs = [];
  for (const y of TERMS) {
    const testRows = snaps.filter((s) => s.y === y);
    const trainRows = snaps.filter((s) => s.y !== y);
    const pd = prep(trainRows, trainRows.concat(testRows));
    const f = fit(trainRows, pd, lam);
    for (const s of testRows) {
      const band = s.age === agesOf(s.y).at(-1) ? "fin" : String(s.age);
      const p = f(s);
      byBand.get(band).push([p, s.ousted]);
      allPairs.push([p, s.ousted]);
    }
  }
  const accOf = (pairs) => pairs.filter(([p, o]) => (p >= 0.5 ? 1 : 0) === o).length;
  console.log("band   n  accuracy (term calls at that age)");
  for (const [band, pairs] of byBand)
    console.log(`${band.padStart(4)} ${String(pairs.length).padStart(3)}   ${(100 * accOf(pairs) / pairs.length).toFixed(0)}%`);
  const auc = (() => {
    const pos = allPairs.filter(([, o]) => o === 1), neg = allPairs.filter(([, o]) => o === 0);
    let s = 0; for (const [p1] of pos) for (const [p0] of neg) s += p1 > p0 ? 1 : p1 === p0 ? 0.5 : 0;
    return s / (pos.length * neg.length);
  })();
  console.log(`snapshot-level AUC ${auc.toFixed(2)} · Brier ${mean(allPairs.map(([p, o]) => (p - o) ** 2)).toFixed(3)} · n snaps ${allPairs.length}`);
}

// ---- current term + cluster bootstrap CI ----------------------------------
console.log("\n=== Albanese-2025 live call (cluster bootstrap, 300 draws) ===");
{
  const ps = [];
  let seed = 42;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let b = 0; b < 300; b++) {
    const boot = [];
    for (let i = 0; i < TERMS.length; i++) boot.push(TERMS[Math.floor(rnd() * TERMS.length)]);
    const trainRows = boot.flatMap((y) => snaps.filter((s) => s.y === y));
    const pd = prep(trainRows, trainRows.concat([cur]));
    ps.push(fit(trainRows, pd, 1, 1200)(cur));
  }
  ps.sort((a, b) => a - b);
  BOOT = { median: ps[150], lo: ps[30], hi: ps[270], shareOuster: ps.filter((p) => p >= 0.5).length / ps.length };
  console.log(`p(ousted | profile at ${SNAPSHOT_AGE}mo) = median ${ps[150].toFixed(2)} · 10–90% CI [${ps[30].toFixed(2)}, ${ps[270].toFixed(2)}]`);
  console.log(`share of bootstrap draws calling OUSTED (p≥0.5): ${(100 * BOOT.shareOuster).toFixed(0)}%`);
  console.log(`current features: pmNet ${cur.pmNet?.toFixed(1)} · ppm ${cur.ppmLead?.toFixed(1)} · primSw ${cur.primSw?.toFixed(1)} · tppSw ${cur.tppSw?.toFixed(1)} · govAge ${cur.govAge} · ageFrac ${cur.ageFrac.toFixed(2)}`);
}
console.log("\nbaseline: majority 'always re-elected' per band = 9/13 = 69%");

// Machine-readable summary for .build/refresh-prediction.mjs (see --json).
if (JSON_OUT) {
  const r4 = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, +(+v).toFixed(4)]));
  process.stdout.write(JSON.stringify({
    age: SNAPSHOT_AGE,
    ousted: r4(BOOT),
    inSample: +CUR_IN_SAMPLE.toFixed(4),
    features: { pmNet: cur.pmNet, ppm: cur.ppmLead, primSw: cur.primSw, tppSw: cur.tppSw, govAge: cur.govAge, ageFrac: +cur.ageFrac.toFixed(4) },
    profile: PROFILE_JSON.map((t) => ({ ...t, bands: r4(t.bands) })),
  }) + "\n");
}
