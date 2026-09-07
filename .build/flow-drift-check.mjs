#!/usr/bin/env -S node --input-type=module
// Independent re-derivation of the flow-drift series, checked against the
// values gen-data.mjs actually emitted into the data asset.
//
// The estimator below is a VERBATIM replica of the flow-drift block in
// newtracker/gen-data.mjs (residuals + per-house flow-share fits) plus the
// exact weightedWithSe / nowcastAdj / monthWithSe it pumps its rows
// through — copied, not imported, so a change to the shipped estimator that
// shifts the ANSWERS breaks this script and forces a look (the skill
// est-console-backtest sets that convention). If the upstream block changes
// on purpose, update the replica in the same commit.
//
// Exit 0 = emitted flowDrift matches a fresh derivation from polls.json.
// Exit 1 = disagreement (or no flowDrift in the asset).

import fs from "node:fs";

const ROOT = new URL("../", import.meta.url);
const POLLS_JSON = new URL("data/polls.json", ROOT);
const DATA_ASSET = new URL(".build/newtracker/assets/9f09dca2-bd46-49a8-8ae1-51847608cf92.js", ROOT);

const { impliedAlp2pp, FLOW } = await import(new URL(".build/newtracker/flows.mjs", ROOT));
const { HOUSE_RENAMES } = await import(new URL(".build/newtracker/house-renames.mjs", ROOT));

/* ---- canonical dataset (gen-data.mjs:41-65, verbatim) ------------------ */
const D = JSON.parse(fs.readFileSync(POLLS_JSON, "utf8"));
for (const [key, field] of [["polls", "pollster"], ["ppm", "firm"], ["approval", "firm"],
                            ["altTpp", "firm"], ["ppmHeadToHead", "firm"], ["direction", "pollster"]]) {
  if (!Array.isArray(D[key])) continue;
  D[key] = D[key].map((r) => (HOUSE_RENAMES[r[field]] ? { ...r, [field]: HOUSE_RENAMES[r[field]] } : r));
}
const ELECTION = D.elections.e2025;
const POLLS = D.polls.filter((p) => !p.isElection);

/* ---- calendar / shared helpers (gen-data.mjs, verbatim) ---------------- */
const mx = (ym) => { const [y, m] = ym.split("-").map(Number); return y + (m - 1 + 0.5) / 12; };
const ymOf = (d) => d.slice(0, 7);
const r1 = (v) => Math.round(v * 10) / 10;
const r2 = (v) => Math.round(v * 100) / 100;
const LATEST_ISO = POLLS.reduce((m, p) => (p.date > m ? p.date : m), "0000");
const MONTHS = [];
{
  let [y, m] = [Number(ELECTION.date.slice(0, 4)), Number(ELECTION.date.slice(5, 7))];
  const [ly, lm] = [Number(LATEST_ISO.slice(0, 4)), Number(LATEST_ISO.slice(5, 7))];
  while (y < ly || (y === ly && m <= lm)) {
    MONTHS.push(`${y}-${String(m).padStart(2, "0")}`);
    m++; if (m > 12) { m = 1; y++; }
  }
}
const HE_WINDOW = 28, SHRINK_K = 8, SAMPLE_CAP = 3000, LN2 = Math.log(2);
const HL_DEFF = 1.6;
const rowN = (p) => (p && p.sampleEff != null)
  ? p.sampleEff * HL_DEFF
  : Math.min((p && p.sample) || 1200, SAMPLE_CAP);
const midMs = (p) => (new Date(p.dateStart || p.date).getTime() + new Date(p.date).getTime()) / 2;
const share2pp = (p) => (p.tpp_lnp != null && p.tpp_alp + p.tpp_lnp > 0) ? (p.tpp_alp / (p.tpp_alp + p.tpp_lnp)) * 100 : p.tpp_alp;
const ddays = (a, b) => (a - b) / 86400000;
const HL_WINDOW = 21, HL_HALF = 7;
const tppRows = POLLS.filter((p) => p.tpp_alp != null).map((p) => ({ ym: ymOf(p.date), mid: midMs(p), x: share2pp(p), n: rowN(p), firm: p.pollster, key: p.date + "|" + p.pollster }));
const tppRowsSynth = POLLS
  .filter((p) => p.alp != null && p.lnp != null && p.grn != null && p.onp != null && !p.sumNote)
  .map((p) => ({ ym: ymOf(p.date), mid: midMs(p), x: impliedAlp2pp(p), n: rowN(p), firm: p.pollster, key: p.date + "|" + p.pollster }));

const heV = (he, firm, t) => (he && typeof he.at === "function" ? he.at(firm, t) : 0);

/* ---- estimator (gen-data.mjs weightedWithSe / nowcastAdj / monthWithSe /
       ymMidMs, verbatim) ------------------------------------------- */
function weightedWithSe(pts) {                 // pts: [{ w, x, n }]
  let sw = 0, sw2 = 0, swx = 0;
  for (const p of pts) { sw += p.w; sw2 += p.w * p.w; swx += p.w * p.x; }
  if (!sw) return null;
  const mean = swx / sw;
  const nEff = (sw * sw) / sw2;
  const wVar = pts.reduce((t, p) => t + p.w * (p.x - mean) ** 2, 0) / sw;
  const seSpread = nEff > 1 ? Math.sqrt(wVar / (nEff - 1)) : Infinity;
  const pqOf = (p) => (p.pq != null ? p.pq : (mean / 100) * (1 - mean / 100) * 1e4);
  const seFloor = Math.sqrt(pts.reduce((t, p) => t + p.w * p.w * HL_DEFF * pqOf(p) / p.n, 0)) / sw;
  const se = Math.max(Number.isFinite(seSpread) ? seSpread : 0, seFloor);
  return { v: mean, n: pts.length, se, nEff };
}
function nowcastAdj(rows, he, ref) {
  const pts = [];
  const waves = new Map();
  for (const a of rows) {
    const d = ddays(ref, a.mid);
    if (d < 0 || d > HL_WINDOW) continue;
    waves.set(a.firm, (waves.get(a.firm) || 0) + 1);
    pts.push({ w: a.n * Math.exp(-LN2 * d / HL_HALF), x: a.x - heV(he, a.firm, ref), n: a.n, firm: a.firm, ...(a.pq != null ? { pq: a.pq } : {}) });
  }
  for (const p of pts) p.w /= Math.sqrt(waves.get(p.firm));
  const r = weightedWithSe(pts);
  return r && { v: r1(r.v), n: r.n, se: r2(r.se), nEff: r1(r.nEff), ci95: r1(1.96 * r.se) };
}
const ymMidMs = (ym) => Date.parse(ym + "-15T00:00:00Z");
function monthWithSe(rows, he, ym) {
  const rs = rows.filter((r) => r.ym === ym);
  const waves = new Map();
  for (const r of rs) waves.set(r.firm, (waves.get(r.firm) || 0) + 1);
  return weightedWithSe(rs.map((r) => ({ w: r.n / Math.sqrt(waves.get(r.firm)),
                                         x: r.x - heV(he, r.firm, ymMidMs(ym)), n: r.n, ...(r.pq != null ? { pq: r.pq } : {}) })));
}

const refNow = new Date(LATEST_ISO).getTime();

/* ---- flow drift (gen-data.mjs §7c, verbatim) --------------------------- */
const FLOW_BASE_DAYS = 180;
const FLOW_BASE_MIN = 3;
const driftSynthByKey = new Map(tppRowsSynth.map((r) => [r.key, r.x]));
const driftResid = [];
for (const r of tppRows) {
  const imp = driftSynthByKey.get(r.key);
  if (imp == null) continue;
  driftResid.push({ ...r, pq: (r.x / 100) * (1 - r.x / 100) * 1e4, x: r.x - imp });
}
const driftByFirm = new Map();
for (const r of driftResid) {
  if (!driftByFirm.has(r.firm)) driftByFirm.set(r.firm, []);
  driftByFirm.get(r.firm).push(r);
}
const FLOW_BASE_FROM = {};
{
  const elecMs = new Date(ELECTION.date).getTime();
  for (const [firm, rows] of driftByFirm) {
    rows.sort((a, b) => a.mid - b.mid);
    const win = rows.filter((r) => ddays(r.mid, elecMs) >= 0 && ddays(r.mid, elecMs) <= FLOW_BASE_DAYS);
    const anchored = win.length >= FLOW_BASE_MIN;
    const src = anchored ? win : rows.slice(0, FLOW_BASE_MIN);
    if (src.length < FLOW_BASE_MIN) continue;
    FLOW_BASE_FROM[firm] = {
      base: src.reduce((s, r) => s + r.n * r.x, 0) / src.reduce((s, r) => s + r.n, 0),
      from: anchored ? ELECTION.date : src[src.length - 1].key.split("|")[0],
    };
  }
}
const driftAnom = driftResid
  .filter((r) => FLOW_BASE_FROM[r.firm])
  .map((r) => ({ ym: r.ym, mid: r.mid, x: r.x - FLOW_BASE_FROM[r.firm].base, n: r.n, pq: r.pq, firm: r.firm, key: r.key }));
/* (per-house flow-share fitter, gen-data.mjs §7c, verbatim) */
const FLOW_FIT_MIN = 6;
const FLOW_FIT_TAU = 0.12;
const FLOW_FIT_TAU_INT = 0.05;
function flow4Solve(Ain, bin) {
  const A = Ain.map((row) => [...row]);
  const b = [...bin];
  for (let col = 0; col < 4; col++) {
    let piv = col;
    for (let r = col + 1; r < 4; r++) if (Math.abs(A[r][col]) > Math.abs(A[piv][col])) piv = r;
    if (Math.abs(A[piv][col]) < 1e-9) return null;
    if (piv !== col) { [A[col], A[piv]] = [A[piv], A[col]]; [b[col], b[piv]] = [b[piv], b[col]]; }
    for (let r = col + 1; r < 4; r++) {
      const f = A[r][col] / A[col][col];
      for (let j = col; j < 4; j++) A[r][j] -= f * A[col][j];
      b[r] -= f * b[col];
    }
  }
  const beta = [0, 0, 0, 0];
  for (let i = 3; i >= 0; i--) {
    let s = b[i];
    for (let j = i + 1; j < 4; j++) s -= A[i][j] * beta[j];
    beta[i] = s / A[i][i];
  }
  return beta;
}
function flow4Inv(Ain) {
  const M = Ain.map((row, i) => [...row, ...[0, 0, 0, 0].map((_, j) => (i === j ? 1 : 0))]);
  for (let col = 0; col < 4; col++) {
    let piv = col;
    for (let r = col + 1; r < 4; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    if (Math.abs(M[piv][col]) < 1e-12) return null;
    [M[col], M[piv]] = [M[piv], M[col]];
    const d = M[col][col];
    for (let j = 0; j < 8; j++) M[col][j] /= d;
    for (let r = 0; r < 4; r++) {
      if (r === col) continue;
      const f = M[r][col];
      for (let j = 0; j < 8; j++) M[r][j] -= f * M[col][j];
    }
  }
  return M.map((row) => row.slice(4));
}
function flowDesign(rows) {
  const A = Array.from({ length: 4 }, () => [0, 0, 0, 0]);
  const b = [0, 0, 0, 0];
  for (const r of rows) {
    const x = [1, r.g, r.o, r.t];
    for (let i = 0; i < 4; i++) {
      b[i] += x[i] * r.y;
      for (let j = 0; j < 4; j++) A[i][j] += x[i] * x[j];
    }
  }
  return { A, b };
}
function flowRidge(rows, sigma2W) {
  const f0 = [0, FLOW.grn, FLOW.onp, FLOW.oth];
  const lamS = sigma2W / (FLOW_FIT_TAU * FLOW_FIT_TAU);
  const lamI = sigma2W / (FLOW_FIT_TAU_INT * FLOW_FIT_TAU_INT);
  const { A, b } = flowDesign(rows);
  const beta = flow4Solve(A.map((row, i) => row.map((v, j) => (i === j ? v + (i === 0 ? lamI : lamS) : v))),
                          b.map((v, i) => v + (i === 0 ? lamI : lamS) * f0[i]));
  if (!beta) return null;
  const inv = flow4Inv(A.map((row, i) => row.map((v, j) => (i === j ? v + (i === 0 ? lamI : lamS) : v))));
  if (!inv) return null;
  return { beta, se: [1, 2, 3].map((i) => Math.sqrt(sigma2W * inv[i][i])) };
}
const flowFitRows = POLLS
  .filter((p) => p.tpp_alp != null && p.alp != null && p.lnp != null && p.grn != null && p.onp != null && !p.sumNote)
  .map((p) => ({ firm: p.pollster, y: share2pp(p) - p.alp, g: p.grn, o: p.onp, t: (p.ind || 0) + (p.oth || 0) }));
const flowFitByFirm = new Map();
for (const r of flowFitRows) {
  if (!flowFitByFirm.has(r.firm)) flowFitByFirm.set(r.firm, []);
  flowFitByFirm.get(r.firm).push(r);
}
let flowSigma2W = 1;
{
  let ssrSum = 0, dfSum = 0;
  for (const rows of flowFitByFirm.values()) {
    if (rows.length < FLOW_FIT_MIN) continue;
    const { A, b } = flowDesign(rows);
    const beta = flow4Solve(A, b);
    if (!beta) continue;
    let ssr = 0;
    for (const r of rows) {
      const x = [1, r.g, r.o, r.t];
      const resid = r.y - (beta[0] * x[0] + beta[1] * x[1] + beta[2] * x[2] + beta[3] * x[3]);
      ssr += resid * resid;
    }
    ssrSum += ssr;
    dfSum += rows.length - 4;
  }
  if (dfSum > 0) flowSigma2W = ssrSum / dfSum;
}
/* Houses that PRINT their respondent allocation each wave need no fit: the
   n-weighted term average of their own published per-cohort splits answers
   the same question directly from measurement, so it replaces the ridge
   row wholesale (the fit on such a house only re-derives a noisier version
   of it). Emitted with m:1 so the renderer can mark the provenance and the
   note can say so. The ± is a pure-count SE: each wave's published split
   reads the term's allocation with a wave-to-wave SD declared at
   FLOW_PUB_SD pts, so the weighted mean's SE is σ·√(Σw²)/Σw. Same
   diagnostic-only status as the fits — it feeds nothing else. */
const FLOW_PUB_MIN = 3;        // min published splits before a measured row replaces the fit
const FLOW_PUB_SD = 10;        // assumed per-wave SD (pts) of a published cohort split
const flowPubByFirm = new Map();
for (const p of POLLS) {
  if (p.tpp_split == null) continue;
  if (!flowPubByFirm.has(p.pollster)) flowPubByFirm.set(p.pollster, []);
  flowPubByFirm.get(p.pollster).push(p);
}
const flowMeasured = new Map();
for (const [firm, rows] of flowPubByFirm) {
  if (rows.length < FLOW_PUB_MIN) continue;
  const ws = rows.map((p) => p.sample || 0);
  const W = ws.reduce((s, w) => s + w, 0);
  const wm = (k) => rows.reduce((s, p, i) => s + ws[i] * p.tpp_split[k], 0) / W;
  const se = FLOW_PUB_SD * Math.sqrt(ws.reduce((s, w) => s + w * w, 0)) / W;
  flowMeasured.set(firm, {
    firm,
    g: r1(wm("grn")), ge: r1(se),
    o: r1(wm("onp")), oe: r1(se),
    t: r1(wm("oth")), te: r1(se),
    n: rows.length, m: 1,
  });
}
const flowFits = [];
for (const [firm, rows] of flowFitByFirm) {
  if (flowMeasured.has(firm)) continue;   // the house's own published allocation beats a fitted constant
  if (rows.length < FLOW_FIT_MIN) continue;
  const fit = flowRidge(rows, flowSigma2W);
  if (!fit) continue;
  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  flowFits.push({
    firm,
    g: r1(clamp01(fit.beta[1]) * 100), ge: r1(fit.se[0] * 100),
    o: r1(clamp01(fit.beta[2]) * 100), oe: r1(fit.se[1] * 100),
    t: r1(clamp01(fit.beta[3]) * 100), te: r1(fit.se[2] * 100),
    n: rows.length,
  });
}
for (const row of flowMeasured.values()) flowFits.push(row);
flowFits.sort((a, z) => (a.firm < z.firm ? -1 : 1));
const driftMonths = MONTHS.map((ym) => {
  const r = monthWithSe(driftAnom, null, ym);
  return r && { ym, x: mx(ym), v: r1(r.v), ci95: r1(1.96 * r.se), k: r.n };
}).filter(Boolean);
const driftNow = nowcastAdj(driftAnom, null, refNow);

/* ---- pull the EMITTED flowDrift out of the data asset ------------------ */
const asset = fs.readFileSync(DATA_ASSET, "utf8");
const m = asset.match(/const flowDrift = (\{.*?\});\n/s);
if (!m) { console.error("FAIL: no flowDrift in the data asset — rebuild first"); process.exit(1); }
const emitted = JSON.parse(m[1]);

/* ---- compare: last three months, the nowcast, and the house count ------ */
let bad = 0;
const eq = (label, a, b) => {
  const ok = JSON.stringify(a) === JSON.stringify(b);
  if (!ok) { bad++; console.error(`MISMATCH ${label}\n  fresh:   ${JSON.stringify(a)}\n  emitted: ${JSON.stringify(b)}`); }
};
eq("houses list", Object.keys(FLOW_BASE_FROM).sort(), emitted.meta.houses);
eq("last month", driftMonths[driftMonths.length - 1], emitted.months[emitted.months.length - 1]);
eq("2nd-last month", driftMonths[driftMonths.length - 2], emitted.months[emitted.months.length - 2]);
eq("3rd-last month", driftMonths[driftMonths.length - 3], emitted.months[emitted.months.length - 3]);
eq("nowcast", driftNow && { v: driftNow.v, ci95: driftNow.ci95, n: driftNow.n, nEff: driftNow.nEff }, emitted.now);
eq("flow fits", flowFits, emitted.flows);
eq("aec row", { g: r1(FLOW.grn * 100), o: r1(FLOW.onp * 100), t: r1(FLOW.oth * 100) }, emitted.meta.aec);

if (bad) process.exit(1);
console.log(`flow-drift OK: ${emitted.meta.houses.length} houses checked against ${driftAnom.length} anomalies;`,
  `${emitted.flows.length} flow fits;`,
  `last month ${JSON.stringify(driftMonths[driftMonths.length - 1])};`,
  `now ${JSON.stringify(emitted.now)}`);
