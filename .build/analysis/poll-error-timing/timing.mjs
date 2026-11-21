/* When do the polls go wrong? Tests for an election-anchored history of the
   primary vote (user question, 2026-11-21: can the historical primary lines
   be adjusted for the polls' demonstrable misses at elections?).

   Every completed federal term since 1972: the production primary estimator
   (gen-data's houseEffectsFor + nowcastPts, verbatim via primary-backtest)
   read at
     start  45 days after the opening election (six-week sparse window)
     end    polling day of the closing election (three-week headline window)
   against the two counts that bound the term.

   e_end   = end − closing result          (the polls' miss at the election)
   g_start = start − opening result        (honeymoon + whatever bias carried)
   jump    = start − previous term's end   (how the polls move ACROSS an election)

   Tests
   T1 persistence: does last election's miss carry into the new term's first
      polls?  jump = a − r·e_prev + h·W   (r = 1 full reset, r = 0 carry-over;
      W = +1 for the party that formed government, −1 the other major)
   T2 serial correlation of e_end across consecutive elections
   T3 swing exaggeration: e_end on the actual between-election change
      (positive = polls overstate whatever really moved)
   T4 late momentum: e_end on the poll trend 63→21 days out (windows that
      share no poll with the polling-day estimate). Negative = the campaign
      trend carried on past the last polls.

   Run: node .build/analysis/poll-error-timing/timing.mjs [--from 1972] [--json out.json]
*/
import path from "node:path";
import fs from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const D = JSON.parse(execSync("git show HEAD:data/polls.json", { cwd: ROOT, maxBuffer: 1 << 28 }).toString("utf8"));
const argv = process.argv.slice(2);
const FROM = Number(argv.includes("--from") ? argv[argv.indexOf("--from") + 1] : 1972);
const JSON_OUT = argv.includes("--json") ? argv[argv.indexOf("--json") + 1] : null;

/* ---- estimator: verbatim from gen-data.mjs (as primary-backtest.mjs) ---- */
const HE_WINDOW = 28, SHRINK_K = 1.5, SAMPLE_CAP = 3000, LN2 = Math.log(2);
const HL_DEFF = 1.6, HE_HALF = 90;
const HL_WINDOW = 21, HL_HALF = 7, HL_TAPER = 14;
const SPARSE_WINDOW = 42, SPARSE_HALF = 14, SPARSE_TAPER = 28;
const rowN = (p) => (p && p.sampleEff != null) ? p.sampleEff * HL_DEFF : Math.min((p && p.sample) || 1200, SAMPLE_CAP);
const midMs = (p) => (new Date(p.dateStart || p.date).getTime() + new Date(p.date).getTime()) / 2;
const ddays = (a, b) => (a - b) / 86400000;
const taperW = (d) => (d <= HL_TAPER ? 1 : 0.5 * (1 + Math.cos(Math.PI * (d - HL_TAPER) / (HL_WINDOW - HL_TAPER))));
const HEADLINE_K = { window: HL_WINDOW, weight: (d) => Math.exp(-LN2 * d / HL_HALF) * taperW(d) };
const SPARSE_K = { window: SPARSE_WINDOW, weight: (d) => Math.exp(-LN2 * d / SPARSE_HALF)
  * (d <= SPARSE_TAPER ? 1 : 0.5 * (1 + Math.cos(Math.PI * (d - SPARSE_TAPER) / (SPARSE_WINDOW - SPARSE_TAPER)))) };

function houseEffectsFor(rows) {
  const devs = [];
  for (const a of rows) {
    let sw = 0, swx = 0, k = 0;
    for (const b of rows) {
      if (b === a || Math.abs(ddays(b.mid, a.mid)) > HE_WINDOW) continue;
      if (b.firm === a.firm) continue;
      sw += b.n; swx += b.n * b.x; k++;
    }
    if (k < 3) continue;
    devs.push({ firm: a.firm, mid: a.mid, dev: a.x - swx / sw });
  }
  const byFirm = Object.create(null);
  for (const d of devs) (byFirm[d.firm] || (byFirm[d.firm] = [])).push(d);
  const at = (firm, t) => {
    let sw = 0, swx = 0;
    for (const d of byFirm[firm] || []) {
      if (d.mid > t) continue;
      const w = Number.isFinite(t) ? Math.exp(-LN2 * ddays(t, d.mid) / HE_HALF) : 1;
      sw += w; swx += w * d.dev;
    }
    if (!sw) return 0;
    return (sw / (sw + SHRINK_K)) * (swx / sw);
  };
  return { at };
}
const heV = (he, firm, t) => (he ? he.at(firm, t) : 0);
function nowcast(rows, he, ref, k) {
  const pts = [], waves = new Map();
  for (const a of rows) {
    const d = ddays(ref, a.mid);
    if (d < 0 || d > k.window) continue;
    waves.set(a.firm, (waves.get(a.firm) || 0) + 1);
    pts.push({ w: a.n * k.weight(d), x: a.x - heV(he, a.firm, ref), firm: a.firm });
  }
  let sw = 0, swx = 0;
  for (const p of pts) { p.w /= Math.sqrt(waves.get(p.firm)); sw += p.w; swx += p.w * p.x; }
  return sw ? { v: swx / sw, k: pts.length } : null;
}

/* ---- terms ---------------------------------------------------------------- */
const firmOf = (p) => p.firm || p.pollster || "";
const isPoll = (p) => !p.isElection && !/^(election|election result)$/i.test(firmOf(p)) && !/exit/i.test(firmOf(p));
const GOV = { 1943: "alp", 1946: "alp", 1949: "lnp", 1951: "lnp", 1954: "lnp", 1955: "lnp", 1958: "lnp", 1961: "lnp",
  1963: "lnp", 1966: "lnp", 1969: "lnp", 1972: "alp", 1974: "alp", 1975: "lnp", 1977: "lnp", 1980: "lnp", 1983: "alp",
  1984: "alp", 1987: "alp", 1990: "alp", 1993: "alp", 1996: "lnp", 1998: "lnp", 2001: "lnp", 2004: "lnp", 2007: "alp",
  2010: "alp", 2013: "lnp", 2016: "lnp", 2019: "lnp", 2022: "alp", 2025: "alp" };
const ELS = Object.entries(D.elections).map(([k, e]) => ({ y: +k.slice(1), ...e, T: Date.parse(e.date) }))
  .sort((a, b) => a.T - b.T);
// "rest" = everything but the two majors, defined the same way in every era
const val = (p, k) => (k === "rest" ? (p.alp != null && p.lnp != null ? 100 - p.alp - p.lnp : null) : p[k]);
const resOf = (e, k) => (k === "rest" ? 100 - e.alp - e.lnp : (e[k] > 0 ? e[k] : null));
const PARTIES = ["alp", "lnp", "rest", "grn", "onp"];
const NAME = { alp: "Labor", lnp: "Coalition", rest: "Everyone else", grn: "Greens", onp: "One Nation" };

const terms = [];
for (let i = 1; i < ELS.length; i++) {
  const o = ELS[i - 1], c = ELS[i];
  if (c.y < FROM) continue;
  const src = D.cyclePolls[String(c.y)];
  if (!src) continue;
  const polls = src.filter(isPoll).filter((p) => !p.dateApprox || true)
    .filter((p) => { const t = Date.parse(p.date); return t > o.T && t <= c.T; });
  const t = { y: c.y, open: o.y, oDate: o.date, cDate: c.date, gov: GOV[o.y], nextGov: GOV[c.y], days: ddays(c.T, o.T), p: {} };
  for (const k of PARTIES) {
    const Ro = resOf(o, k), Rc = resOf(c, k);
    const rows = polls.filter((p) => val(p, k) != null).map((p) => ({ mid: midMs(p), x: val(p, k), n: rowN(p), firm: firmOf(p), date: p.date }));
    if (!rows.length || Rc == null) continue;
    const he = houseEffectsFor(rows);
    const end = nowcast(rows, he, c.T, HEADLINE_K);
    const start = nowcast(rows, he, o.T + 45 * 86400000, SPARSE_K);
    const l21 = nowcast(rows, he, c.T - 21 * 86400000, HEADLINE_K);
    const l63 = nowcast(rows, he, c.T - 63 * 86400000, HEADLINE_K);
    // monthly line, the site's construction: readings debiased at their own date, month buckets, sqrt(m)
    const deb = rows.map((r) => ({ ...r, v: r.x - heV(he, r.firm, r.mid) }));
    const MS_MONTH = 365.25 / 12;
    const buckets = {};
    for (const r of deb) { const m = Math.round(ddays(r.mid, o.T) / MS_MONTH); (buckets[m] ||= []).push(r); }
    const monthly = Object.keys(buckets).map(Number).sort((a, b) => a - b).map((m) => {
      const b = buckets[m], waves = new Map();
      for (const r of b) waves.set(r.firm, (waves.get(r.firm) || 0) + 1);
      let sw = 0, swx = 0;
      for (const r of b) { const w = r.n / Math.sqrt(waves.get(r.firm)); sw += w; swx += w * r.v; }
      return { m, v: swx / sw, k: b.length };
    });
    t.p[k] = {
      Ro, Rc, end: end && end.v, endK: end && end.k, start: start && start.v, startK: start && start.k,
      e_end: end ? end.v - Rc : null,
      g_start: start && Ro != null ? start.v - Ro : null,
      dR: Ro != null ? Rc - Ro : null,
      late: l21 && l63 ? l21.v - l63.v : null,
      monthly,
      houses: new Set(rows.filter((r) => ddays(c.T, r.mid) <= 21 && ddays(c.T, r.mid) >= 0).map((r) => r.firm)).size,
    };
  }
  terms.push(t);
}
// previous term's polling-day miss sits beside each term
for (let i = 1; i < terms.length; i++) for (const k of PARTIES) {
  const a = terms[i].p[k], b = terms[i - 1].p[k];
  if (a && b && b.e_end != null && terms[i - 1].y === terms[i].open) { a.e_prev = b.e_end; a.endPrev = b.end; }
}

/* ---- stats ------------------------------------------------------------------ */
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const sd = (a) => { const m = mean(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1)); };
const f = (v, d = 2) => (v == null || !Number.isFinite(v) ? "  –  " : (v >= 0 ? "+" : "") + v.toFixed(d));
function ols(y, X) {           // X: rows of predictors (intercept added); returns b, se
  const n = y.length, p = X[0].length + 1;
  const A = X.map((r) => [1, ...r]);
  const XtX = Array.from({ length: p }, (_, i) => Array.from({ length: p }, (_, j) => A.reduce((s, r) => s + r[i] * r[j], 0)));
  const Xty = Array.from({ length: p }, (_, i) => A.reduce((s, r, q) => s + r[i] * y[q], 0));
  const inv = invert(XtX);
  const b = inv.map((row) => row.reduce((s, v, j) => s + v * Xty[j], 0));
  const res = y.map((v, q) => v - A[q].reduce((s, x, j) => s + x * b[j], 0));
  const s2 = res.reduce((s, v) => s + v * v, 0) / (n - p);
  return { b, se: inv.map((row, i) => Math.sqrt(s2 * row[i])), n, r2: 1 - res.reduce((s, v) => s + v * v, 0) / y.reduce((s, v) => s + (v - mean(y)) ** 2, 0) };
}
function invert(M) {
  const n = M.length, A = M.map((r, i) => [...r, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let i = 0; i < n; i++) {
    let piv = i; for (let r = i + 1; r < n; r++) if (Math.abs(A[r][i]) > Math.abs(A[piv][i])) piv = r;
    [A[i], A[piv]] = [A[piv], A[i]];
    const d = A[i][i]; for (let j = 0; j < 2 * n; j++) A[i][j] /= d;
    for (let r = 0; r < n; r++) if (r !== i) { const fct = A[r][i]; for (let j = 0; j < 2 * n; j++) A[r][j] -= fct * A[i][j]; }
  }
  return A.map((r) => r.slice(n));
}
const corr = (x, y) => { const mx = mean(x), my = mean(y); let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < x.length; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2; }
  return sxy / Math.sqrt(sxx * syy); };
function permP(x, y, reps = 20000) {   // two-sided permutation p for a correlation
  const r0 = Math.abs(corr(x, y)); let hit = 0, seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const yy = [...y];
  for (let i = 0; i < reps; i++) {
    for (let j = yy.length - 1; j > 0; j--) { const q = Math.floor(rnd() * (j + 1)); [yy[j], yy[q]] = [yy[q], yy[j]]; }
    if (Math.abs(corr(x, yy)) >= r0 - 1e-12) hit++;
  }
  return hit / reps;
}

/* ---- report ------------------------------------------------------------------- */
console.log(`Polling error through the term, federal ${terms[0].y}–${terms[terms.length - 1].y} (production estimator)\n`);
for (const k of ["alp", "lnp", "rest", "grn", "onp"]) {
  console.log(`${NAME[k]}:   term   open→close result | start(45d) g_start | end  e_end | e_prev  jump  | late trend`);
  for (const t of terms) {
    const r = t.p[k]; if (!r) continue;
    const jump = r.start != null && r.endPrev != null ? r.start - r.endPrev : null;
    const W = k === "alp" || k === "lnp" ? (t.gov === k ? "gov" : "opp") : "";
    console.log(`  ${t.open}→${t.y} ${W.padEnd(3)} ${r.Ro != null ? r.Ro.toFixed(1).padStart(5) : "   – "}→${r.Rc.toFixed(1).padStart(5)} |`
      + ` ${r.start != null ? r.start.toFixed(1).padStart(5) : "   – "} ${f(r.g_start, 1).padStart(5)} (${String(r.startK ?? 0).padStart(2)}) |`
      + ` ${r.end != null ? r.end.toFixed(1).padStart(5) : "   – "} ${f(r.e_end, 1).padStart(5)} | ${f(r.e_prev, 1).padStart(5)} ${f(jump, 1).padStart(5)} | ${f(r.late, 1)}`);
  }
  console.log("");
}

const OUT = { from: FROM, terms, tests: {} };
function rowsFor(k, need) { return terms.map((t) => ({ t, r: t.p[k] })).filter(({ r }) => r && need.every((q) => r[q] != null && Number.isFinite(r[q]))); }

console.log("T1  Does an election's miss carry into the next term's first polls?");
console.log("    jump (first 45 days − last polling-day estimate) = a + s·(−e_prev) + h·W,  W = +1 government's party, −1 the other major");
console.log("    s = 1: the polls reset onto the count (the miss does not carry); s = 0: the miss carries over unchanged");
for (const k of ["alp", "lnp"]) {
  const R = rowsFor(k, ["start", "endPrev", "e_prev"]);
  const y = R.map(({ r }) => r.start - r.endPrev);
  const X = R.map(({ t, r }) => [-r.e_prev, t.gov === k ? 1 : -1]);
  const m = ols(y, X);
  console.log(`  ${NAME[k].padEnd(10)} n=${m.n}  s = ${f(m.b[1])} ± ${m.se[1].toFixed(2)}   honeymoon h = ${f(m.b[2])} ± ${m.se[2].toFixed(2)}   a = ${f(m.b[0])}  R² ${m.r2.toFixed(2)}`);
  OUT.tests["T1_" + k] = m;
}
{ // pooled majors: Labor and Coalition share an election, so treat as one equation with party intercepts
  const R = [...rowsFor("alp", ["start", "endPrev", "e_prev"]).map((x) => ({ ...x, k: "alp" })), ...rowsFor("lnp", ["start", "endPrev", "e_prev"]).map((x) => ({ ...x, k: "lnp" }))];
  const y = R.map(({ r }) => r.start - r.endPrev);
  const X = R.map(({ t, r, k }) => [-r.e_prev, t.gov === k ? 1 : -1, k === "alp" ? 1 : 0]);
  const m = ols(y, X);
  console.log(`  pooled     n=${m.n}  s = ${f(m.b[1])} ± ${m.se[1].toFixed(2)} (naive SE; parties share elections)   h = ${f(m.b[2])} ± ${m.se[2].toFixed(2)}`);
  OUT.tests.T1_pooled = m;
  // same with the 1990+ multi-house record only
  const R2 = R.filter(({ t }) => t.open >= 1987);
  const m2 = ols(R2.map(({ r }) => r.start - r.endPrev), R2.map(({ t, r, k }) => [-r.e_prev, t.gov === k ? 1 : -1, k === "alp" ? 1 : 0]));
  console.log(`  pooled 1987+ opening  n=${m2.n}  s = ${f(m2.b[1])} ± ${m2.se[1].toFixed(2)}   h = ${f(m2.b[2])} ± ${m2.se[2].toFixed(2)}`);
  OUT.tests.T1_pooled_1987 = m2;
}

console.log("\nT2  Is one election's miss correlated with the next one's? (same party)");
for (const k of ["alp", "lnp", "rest"]) {
  const R = rowsFor(k, ["e_end", "e_prev"]);
  const x = R.map(({ r }) => r.e_prev), y = R.map(({ r }) => r.e_end);
  console.log(`  ${NAME[k].padEnd(13)} n=${R.length}  r = ${f(corr(x, y))}  permutation p = ${permP(x, y).toFixed(3)}   mean miss ${f(mean(y))} (sd ${sd(y).toFixed(2)}), ${y.filter((v) => v > 0).length} of ${y.length} over`);
  OUT.tests["T2_" + k] = { n: R.length, r: corr(x, y), p: permP(x, y), mean: mean(y), sd: sd(y) };
}

console.log("\nT3  Do the polls overstate whatever really moved between elections?  e_end on the counted change");
for (const k of ["alp", "lnp", "rest"]) {
  const R = rowsFor(k, ["e_end", "dR"]);
  const x = R.map(({ r }) => r.dR), y = R.map(({ r }) => r.e_end);
  const m = ols(y, x.map((v) => [v]));
  console.log(`  ${NAME[k].padEnd(13)} n=${R.length}  slope ${f(m.b[1])} ± ${m.se[1].toFixed(2)}  r = ${f(corr(x, y))}  p = ${permP(x, y).toFixed(3)}`);
  OUT.tests["T3_" + k] = { ...m, r: corr(x, y), p: permP(x, y) };
}

console.log("\nT4  Late momentum: e_end on the poll trend between 63 and 21 days out (no shared polls with the final estimate)");
for (const k of ["alp", "lnp", "rest"]) {
  const R = rowsFor(k, ["e_end", "late"]);
  const x = R.map(({ r }) => r.late), y = R.map(({ r }) => r.e_end);
  const m = ols(y, x.map((v) => [v]));
  console.log(`  ${NAME[k].padEnd(13)} n=${R.length}  slope ${f(m.b[1])} ± ${m.se[1].toFixed(2)}  r = ${f(corr(x, y))}  p = ${permP(x, y).toFixed(3)}`);
  OUT.tests["T4_" + k] = { ...m, r: corr(x, y), p: permP(x, y) };
}

if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify(OUT));
