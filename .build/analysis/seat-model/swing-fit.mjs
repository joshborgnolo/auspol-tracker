/* swing-fit.mjs: the seat-level terms of the logit swing, fitted on every federal election 1993-2025.

   For every election E, each seat's primary for each party group (alp, lnp, grn, onp) is predicted from
   its notional previous-election share (the AEC's swing column) by a logit shift per election x state x
   party solved so the state totals come out exactly (oracle totals: nothing here is polling error), plus
     incE    the party's candidate is the seat's sitting member (data/house-incumbency.json)
     incP    at the previous election the party's candidate (same-named seat) was the sitting member - the
             personal vote already inside the base, lost when that member is gone (retired or beaten)
     defect  that previous sitting member now stands against the party (Katter 2001, Gee 2025)
     rho     the share of the seat's previous surprise (its residual at P under the swing and the three
             terms above) carried forward: negative = seats give back part of a past over-performance
   fitted by iteratively reweighted least squares with Huber weights (k = 1.5 robust SDs), so a handful of
   collapses (a member jailed, a candidate disendorsed) set the tails, not the typical seat's terms.
   rho is fitted in a second stage on the first stage's residuals (incumbency terms only), which is also
   what the 2028 run and the backtests feed forward.

   Node only (reads the stores); the seat model's pure modules see only the per-candidate offsets it
   produces (candidate.adj, logit). */
import { readFileSync } from "node:fs";

export const LONG_YEARS = [1993, 1996, 1998, 2001, 2004, 2007, 2010, 2013, 2016, 2019, 2022, 2025];
export const PREV_OF = Object.fromEntries(LONG_YEARS.slice(1).map((y, i) => [y, LONG_YEARS[i]]));
export const GROUPS = ["alp", "lnp", "grn", "onp"];
export const INC_GROUPS = ["alp", "lnp"];            // incumbency terms: the two parties with members in every era
export const RHO_GROUPS = ["alp", "lnp", "grn"];     // reversion: parties standing nearly everywhere for long enough
const logit = (p) => Math.log(p / (1 - p)), ilogit = (x) => 1 / (1 + Math.exp(-x));
const sum = (a) => a.reduce((s, x) => s + x, 0);
const norm = (s) => String(s || "").toUpperCase().replace(/[^A-Z]/g, "");
export const personKey = (st, name) => { const nm = String(name).split(" "); return st + "|" + norm(nm[nm.length - 1]) + "|" + norm(nm[0])[0]; };

export function loadHistory(root = ".", years = LONG_YEARS) {
  const J = (f) => JSON.parse(readFileSync(`${root}/${f}`, "utf8"));
  const RES = Object.fromEntries(years.map((y) => [y, J(`map/data/res-${y}.json`)]));
  const INC = J("data/house-incumbency.json").years;
  return { RES, INC };
}

/* one row per election x seat x party group with a base and a share of at least 1% (elections whose
   previous election is loaded too; the 2028 run loads only 2022 and 2025) */
export function historyRows({ RES, INC }) {
  const cls96 = RES[1996] ? Object.fromEntries(RES[1996].divs.map((d) => [d.n, d.cls])) : {};
  const rows = [];
  for (const E of LONG_YEARS) {
    if (!RES[E] || (PREV_OF[E] && !RES[PREV_OF[E]])) continue;
    const P = PREV_OF[E];
    for (const dv of RES[E].divs) {
      const tot = sum(dv.c.map((c) => c[4])), inc = INC[E][dv.n];
      const dp = P ? RES[P].divs.find((d) => d.n === dv.n) : null, ip = dp ? INC[P][dv.n] : null;
      for (const b of GROUPS) {
        const idx = dv.c.map((c, i) => (c[3] === b ? i : -1)).filter((i) => i >= 0);
        if (!idx.length || idx.some((i) => dv.c[i][5] == null)) continue;
        const share = sum(idx.map((i) => dv.c[i][4])) / tot, base = share - sum(idx.map((i) => dv.c[i][5])) / 100;
        if (share < 0.01 || base < 0.01) continue;
        const t = termsFor(dv, inc, dp, ip, b);
        rows.push({ E, b, div: dv.n, st: dv.st, cls: dv.cls || cls96[dv.n] || "Outer Metropolitan", w: tot, x: logit(base), y: logit(share), ...t, hasP: !!dp });
      }
    }
  }
  return rows;
}
/* the incumbency indicators for party group b in seat dv (E) given the same-named seat dp at P */
export function termsFor(dv, inc, dp, ip, b) {
  const incE = dv.c.some((c, i) => c[3] === b && inc.sit[i] === 1) ? 1 : 0;
  const incP = dp ? (dp.c.some((c, i) => c[3] === b && ip.sit[i] === 1) ? 1 : 0) : 0;
  let defect = 0;
  if (dp) dp.c.forEach((c, i) => { if (c[3] === b && ip.sit[i] === 1) { const k = personKey(dp.st, c[0]); if (dv.c.some((c2) => personKey(dv.st, c2[0]) === k && c2[3] !== b)) defect = 1; } });
  return { incE, incP, defect };
}

function shift(xs, ws, target) { // damped Newton from the weighted-mean start (a lone small party's row can overshoot)
  const W0 = sum(ws);
  let c = logit(Math.min(0.999, Math.max(0.001, target))) - xs.reduce((a, x, i) => a + ws[i] * x, 0) / W0;
  for (let it = 0; it < 100; it++) { let f = 0, d = 0, W = 0; for (let i = 0; i < xs.length; i++) { const p = ilogit(xs[i] + c); f += ws[i] * p; d += ws[i] * p * (1 - p); W += ws[i]; } const g = f / W - target; if (Math.abs(g) < 1e-10) break; c -= Math.max(-1, Math.min(1, g / (d / W))); }
  return c;
}
function solve(A, b) { const n = b.length, M = A.map((r, i) => [...r, b[i]]); for (let i = 0; i < n; i++) { let p = i; for (let r = i + 1; r < n; r++) if (Math.abs(M[r][i]) > Math.abs(M[p][i])) p = r; [M[i], M[p]] = [M[p], M[i]]; if (Math.abs(M[i][i]) < 1e-12) continue; for (let r = 0; r < n; r++) if (r !== i) { const f = M[r][i] / M[i][i]; for (let k = i; k <= n; k++) M[r][k] -= f * M[i][k]; } } return M.map((r, i) => (Math.abs(r[i]) < 1e-12 ? 0 : r[n] / r[i])); }

/* state-oracle residuals of rows rs (one party) given fixed offsets off(r): sets r.e, r.pred */
export function residualize(rs, off) {
  const groups = {}; for (const r of rs) (groups[r.E + "|" + r.st] = groups[r.E + "|" + r.st] || []).push(r);
  for (const g of Object.values(groups)) {
    const target = sum(g.map((r) => r.w * ilogit(r.y))) / sum(g.map((r) => r.w));
    const xs = g.map((r) => r.x + off(r)), c = shift(xs, g.map((r) => r.w), target);
    g.forEach((r, i) => { r.pred = xs[i] + c; r.e = r.y - r.pred; r.shift = c; });
  }
  return rs;
}
/* Huber IRLS: coefficients on feature functions, shifts re-solved each pass */
function irls(rs, feats, k = 1.5) {
  let beta = feats.map(() => 0), wts = rs.map(() => 1);
  for (let it = 0; it < 30; it++) {
    residualize(rs, (r) => feats.reduce((a, f, j) => a + beta[j] * f(r), 0));
    const n = feats.length;
    if (!n) break;
    const A = Array.from({ length: n }, () => new Array(n).fill(0)), v = new Array(n).fill(0);
    rs.forEach((r, i) => { const t = r.y - (r.pred - feats.reduce((a, f, j) => a + beta[j] * f(r), 0)); const z = feats.map((f) => f(r)); for (let a = 0; a < n; a++) { v[a] += wts[i] * z[a] * (t - 0); for (let b = 0; b < n; b++) A[a][b] += wts[i] * z[a] * z[b]; } });
    // t above is y - (x + shift): regress it on the features
    const nb = solve(A, v);
    const moved = Math.max(...nb.map((x, j) => Math.abs(x - beta[j])));
    beta = nb;
    if (k) { const e = rs.map((r) => r.y - r.x - r.shift - feats.reduce((a, f, j) => a + beta[j] * f(r), 0)), s = 1.4826 * [...e.map(Math.abs)].sort((a, b) => a - b)[Math.floor(e.length / 2)] || 1; wts = e.map((x) => (Math.abs(x) <= k * s ? 1 : k * s / Math.abs(x))); }
    if (moved < 1e-6 && it > 3) break;
  }
  residualize(rs, (r) => feats.reduce((a, f, j) => a + beta[j] * f(r), 0));
  return beta;
}

/* fit every party's terms on rows from elections in `years` (rows of other years are left alone).
   Returns { terms: {b: {incE, incP, defect, rho}}, stage1: Map(E|div|b -> residual, incumbency terms only),
   stage2: rows (copies) with the full-model residual r.e } */
export function fitTerms(allRows, years, { huber = 1.5 } = {}) {
  const Y = new Set(years), terms = {}, stage1 = new Map(), out = [];
  for (const b of GROUPS) {
    const rs = allRows.filter((r) => r.b === b && Y.has(r.E)).map((r) => ({ ...r }));
    if (!rs.length) continue;
    const incFeats = INC_GROUPS.includes(b) ? [(r) => r.incE, (r) => r.incP, (r) => r.defect] : [];
    const bi = irls(rs, incFeats, huber);
    for (const r of rs) stage1.set(r.E + "|" + r.div + "|" + b, r.e);
    // the election before the first one fitted: its stage-1 residuals (same coefficients) feed the first's reversion
    const first = Math.min(...years), before = LONG_YEARS[LONG_YEARS.indexOf(first) - 1];
    if (before) { const pre = allRows.filter((r) => r.b === b && r.E === before).map((r) => ({ ...r })); residualize(pre, (r) => incFeats.reduce((a, f, j) => a + bi[j] * f(r), 0)); for (const r of pre) stage1.set(r.E + "|" + r.div + "|" + b, r.e); }
    let rho = 0;
    if (RHO_GROUPS.includes(b)) {
      const prevE = (r) => (r.hasP && PREV_OF[r.E] ? stage1.get(PREV_OF[r.E] + "|" + r.div + "|" + b) ?? 0 : 0);
      const b2 = irls(rs, [...incFeats, prevE], huber);
      rho = b2[b2.length - 1];
      for (let j = 0; j < incFeats.length; j++) bi[j] = b2[j];
      for (const r of rs) r.prevE = prevE(r);
    }
    terms[b] = { incE: incFeats.length ? bi[0] : 0, incP: incFeats.length ? bi[1] : 0, defect: incFeats.length ? bi[2] : 0, rho };
    residualize(rs, (r) => offsetOf(terms[b], r, r.prevE ?? 0));
    out.push(...rs);
  }
  // the Greens' sitting members are too few to fit (nine contests 2004-2025: their own estimate, +0.28 / -0.29,
  // points the same way and further): they take the two major parties' average personal vote
  if (terms.alp && terms.lnp && terms.grn) {
    terms.grn = { ...terms.grn, incE: (terms.alp.incE + terms.lnp.incE) / 2, incP: (terms.alp.incP + terms.lnp.incP) / 2, defect: 0, borrowed: true };
    const g = out.filter((r) => r.b === "grn"); residualize(g, (r) => offsetOf(terms.grn, r, r.prevE ?? 0));
  }
  return { terms, stage1, rows: out };
}
export const offsetOf = (t, r, prevE) => (t ? t.incE * r.incE + t.incP * r.incP + t.defect * r.defect + t.rho * (prevE || 0) : 0);

/* stage-1 residuals (incumbency terms only, given terms) for every election in `years`: what a run at the
   next election carries forward as each seat's previous surprise */
export function stage1Residuals(allRows, years, terms) {
  const Y = new Set(years), m = new Map();
  for (const b of GROUPS) {
    const rs = allRows.filter((r) => r.b === b && Y.has(r.E)).map((r) => ({ ...r }));
    const t = terms[b] || { incE: 0, incP: 0, defect: 0, rho: 0 };
    residualize(rs, (r) => t.incE * r.incE + t.incP * r.incP + t.defect * r.defect);
    for (const r of rs) m.set(r.E + "|" + r.div + "|" + b, r.e);
  }
  return m;
}
export const rmsOf = (a) => (a.length ? Math.sqrt(sum(a.map((x) => x * x)) / a.length) : null);

/* state deviations: with only the NATIONAL total known per election x party, the SD of each state's
   vote-weighted mean residual (given the seat terms) - what the simulation draws as state shocks */
export function stateDeviation(allRows, years, terms) {
  const Y = new Set(years), out = {};
  for (const b of GROUPS) {
    const rs = allRows.filter((r) => r.b === b && Y.has(r.E)).map((r) => ({ ...r, st0: r.st, st: "AUS" }));
    if (rs.length < 40) continue;
    const t = terms[b] || { incE: 0, incP: 0, defect: 0, rho: 0 };
    residualize(rs, (r) => t.incE * r.incE + t.incP * r.incP + t.defect * r.defect + t.rho * (r.prevE || 0));
    const m = {}; for (const r of rs) { const k = r.E + "|" + r.st0; (m[k] = m[k] || [0, 0]); m[k][0] += r.w * r.e; m[k][1] += r.w; }
    const v = Object.values(m).filter((a) => a[1] > 0).map((a) => a[0] / a[1]);
    out[b] = v.length ? Math.sqrt(sum(v.map((x) => x * x)) / v.length) : null;
  }
  return out;
}
