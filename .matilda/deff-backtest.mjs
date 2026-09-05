/* Per-house design-effect (DEFF) arms for the headline nowcast — backtest.

   Question: the derived rowN path credits a house that files no effective
   sample with raw sample ÷ HL_DEFF (1.6). Should non-filers sit on a
   different DEFF — a pooled measured value, or per-house constants
   (pollsterRules.<house>.deff)? This arms race changes ONLY the derived
   path; rows carrying a house-published sampleEff keep their exact filed
   figure in every arm.

     rowN_arm(p) = p.sampleEff != null ? p.sampleEff × HL_DEFF      (all arms)
                                       : min(sample||1200, 3000) × HL_DEFF/α

   where α = arm.flat unless arm.perHouse[canonFirm] overrides. α=1.6 for
   every row reproduces production exactly (arm A0 — the parity control).

   Input is pinned to the COMMITTED dataset (git show HEAD:data/polls.json)
   so sibling sessions' dirty working trees can't contaminate the race.

   Scoring, two views:
   1. LEAVE-ONE-OUT over current-term polls: hold poll r out, REFIT house
      effects on the rest, nowcast at r's fieldwork midpoint, score the
      error against r's own house-debiased reading. Measures efficiency of
      the weighting scheme itself, in the era where the arms diverge.
   2. ELECTION ANCHORS: for every cycle with cyclePolls + an election
      result, fit that cycle's rows alone and nowcast at polling day with
      the production 21-day window, then compare to the actual 2PP. Hard
      truth, few observations — a corroborator, not a discriminator.

   Estimator functions below are VERBATIM copies of gen-data.mjs's
   houseEffectsFor / nowcastAdj / weightedWithSe and its rowN/constant set
   (HE_WINDOW, SHRINK_K, SAMPLE_CAP, HL_DEFF, HE_HALF, HL_WINDOW, HL_HALF).
   If gen-data's estimator changes, re-copy — otherwise the arms race is
   measuring a different estimator than the one that ships.

   Run: node .matilda/deff-backtest.mjs
*/
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const D = JSON.parse(execSync("git show HEAD:data/polls.json", { cwd: ROOT, maxBuffer: 1 << 28 }).toString("utf8"));

/* ---- mirrored from gen-data.mjs ---------------------------------------- */
const HOUSE_RENAMES = { "Redbridge": "RedBridge / Accent" };
const ACC_CANON = {
  "Morgan": "Roy Morgan", "Newspoll-YouGov": "Newspoll",
  "Resolve Strategic": "Resolve", "Freshwater Strategy": "Freshwater",
  "Redbridge/Accent": "RedBridge", "Spectre Strategy": "Spectre",
};
const HE_WINDOW = 28, SHRINK_K = 8, SAMPLE_CAP = 3000, LN2 = Math.log(2);
const HL_DEFF = 1.6;
const HE_HALF = 90;
const HL_WINDOW = 21, HL_HALF = 7;

const ymOf = (d) => d.slice(0, 7);
const ddays = (a, b) => (a - b) / 86400000;
const r1 = (v) => Math.round(v * 10) / 10;
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const medianOf = (a) => {
  const v = [...a].sort((x, y) => x - y);
  if (!v.length) return null;
  return v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2;
};
const share2pp = (p) => (p.tpp_lnp != null && p.tpp_alp + p.tpp_lnp > 0) ? (p.tpp_alp / (p.tpp_alp + p.tpp_lnp)) * 100 : p.tpp_alp;
const midMs = (p) => (new Date(p.dateStart || p.date).getTime() + new Date(p.date).getTime()) / 2;
/* Same canonicalisation gen-data uses for firm-keyed lookups (METRIC_OVERRIDE
   etc.), applied after ACC_CANON so era spellings ("Morgan", "Resolve
   Strategic", "Roy Morgan (SMS)") land on one arm key. */
const canonFirm = (firm) => (ACC_CANON[firm] || firm || "")
  .replace(/\s*\(.*\)\s*$/, "").replace(/\s*\/.*$/, "").trim().toLowerCase();

/* ---- house effects: verbatim copy of gen-data.mjs houseEffectsFor ------- */
function houseEffectsFor(rows) {
  const devs = [];
  for (const a of rows) {
    let sw = 0, swx = 0, k = 0;
    for (const b of rows) {
      if (b === a || Math.abs(ddays(b.mid, a.mid)) > HE_WINDOW) continue;
      if (a.strat != null && b.strat !== a.strat) continue;
      sw += b.n; swx += b.n * b.x; k++;
    }
    if (k < 3) continue;
    devs.push({ firm: a.firm, mid: a.mid, dev: a.x - swx / sw });
  }
  const evidenceN = {};
  const evidenceFrom = {};
  for (const d of devs) {
    evidenceN[d.firm] = (evidenceN[d.firm] || 0) + 1;
    if (evidenceFrom[d.firm] == null || d.mid < evidenceFrom[d.firm]) evidenceFrom[d.firm] = d.mid;
  }
  const at = (firm, t) => {
    let sw = 0, swx = 0;
    for (const d of devs) {
      if (d.firm !== firm || d.mid > t) continue;
      const w = Number.isFinite(t) ? Math.exp(-LN2 * ddays(t, d.mid) / HE_HALF) : 1;
      sw += w; swx += w * d.dev;
    }
    if (!sw) return 0;
    return (sw / (sw + SHRINK_K)) * (swx / sw);
  };
  const snapshot = (t) => Object.fromEntries(
    Object.keys(evidenceN).map((f) => [f, { v: r1(at(f, t)), n: evidenceN[f] }])
  );
  return { at, evidenceN, evidenceFrom, snapshot, estimable: devs.length > 0 };
}
const heV = (he, firm, t) => (he && typeof he.at === "function" ? he.at(firm, t) : 0);

/* ---- weightedWithSe + nowcastAdj: verbatim arithmetic, unrounded out ---- */
function weightedWithSe(pts) {
  let sw = 0, sw2 = 0, swx = 0;
  for (const p of pts) { sw += p.w; sw2 += p.w * p.w; swx += p.w * p.x; }
  if (!sw) return null;
  const meanV = swx / sw;
  const nEff = (sw * sw) / sw2;
  const wVar = pts.reduce((t, p) => t + p.w * (p.x - meanV) ** 2, 0) / sw;
  const seSpread = nEff > 1 ? Math.sqrt(wVar / (nEff - 1)) : Infinity;
  const pqOf = (p) => (p.pq != null ? p.pq : (meanV / 100) * (1 - meanV / 100) * 1e4);
  const seFloor = Math.sqrt(pts.reduce((t, p) => t + p.w * p.w * HL_DEFF * pqOf(p) / p.n, 0)) / sw;
  const se = Math.max(Number.isFinite(seSpread) ? seSpread : 0, seFloor);
  return { v: meanV, n: pts.length, se, nEff };
}
function nowcastAdj(rows, he, ref) {
  const pts = [];
  const waves = new Map();
  for (const a of rows) {
    const d = ddays(ref, a.mid);
    if (d < 0 || d > HL_WINDOW) continue;
    waves.set(a.firm, (waves.get(a.firm) || 0) + 1);
    pts.push({ w: a.n * Math.exp(-LN2 * d / HL_HALF), x: a.x - heV(he, a.firm, ref), n: a.n, firm: a.firm });
  }
  for (const p of pts) p.w /= Math.sqrt(waves.get(p.firm));
  const r = weightedWithSe(pts);
  return r && { v: r.v, n: r.n, se: r.se, nEff: r.nEff, pts };
}

/* ---- rowN under an arm -------------------------------------------------- */
const mkRowN = (arm) => (p) => {
  if (p && p.sampleEff != null) return p.sampleEff * HL_DEFF;
  const alpha = arm.perHouse[canonFirm(p.firm || p.pollster)] ?? arm.flat;
  return Math.min((p && p.sample) || 1200, SAMPLE_CAP) * (HL_DEFF / alpha);
};

/* ---- data ---------------------------------------------------------------- */
const POLLS = D.polls.filter((p) => !p.isElection)
  .map((p) => (HOUSE_RENAMES[p.pollster] ? { ...p, pollster: HOUSE_RENAMES[p.pollster] } : p));
const tppRowsFor = (rowN, rows) => rows
  .filter((p) => p.tpp_alp != null)
  .map((p) => ({ ym: ymOf(p.date), mid: midMs(p), x: share2pp(p), n: rowN(p), firm: p.firm || p.pollster, key: p.date + "|" + (p.firm || p.pollster) }));

/* ---- part 1: measured DEFF among stamped waves -------------------------- */
const stamped = POLLS.filter((p) => p.sampleEff != null && p.sample != null);
const byHouse = new Map();
for (const p of stamped) {
  const g = byHouse.get(p.pollster) || { waves: 0, raw: 0, eff: 0, ratios: [] };
  g.waves++; g.raw += p.sample; g.eff += p.sampleEff; g.ratios.push(p.sample / p.sampleEff);
  byHouse.set(p.pollster, g);
}
const f2 = (v) => v.toFixed(2);
console.log("== Measured design effects, house-stamped waves (raw ÷ published eff) ==");
let tRaw = 0, tEff = 0;
for (const [h, g] of [...byHouse.entries()].sort((a, b) => b[1].raw - a[1].raw)) {
  tRaw += g.raw; tEff += g.eff;
  console.log(
    h.padEnd(22),
    `waves=${String(g.waves).padStart(2)}`,
    `Σraw=${String(g.raw).padStart(5)}`, `Σeff=${String(g.eff).padStart(5)}`,
    `pooled=${f2(g.raw / g.eff)}`,
    `mean=${f2(mean(g.ratios))}`,
    `range=${f2(Math.min(...g.ratios))}–${f2(Math.max(...g.ratios))}`
  );
}
const POOLED = tRaw / tEff;
console.log("ALL".padEnd(22), `waves=${String(stamped.length).padStart(2)}`, `Σraw=${tRaw}`, `Σeff=${tEff}`, `pooled=${f2(POOLED)}`);

/* ---- arms ----------------------------------------------------------------- */
const ARMS = {
  "A0 base flat1.6": { flat: 1.6, perHouse: {} },
  "A1 flat pooled ": { flat: Number(POOLED.toFixed(2)), perHouse: {} },
  "A2 Morgan 2.0  ": { flat: 1.6, perHouse: { "roy morgan": 2.0 } },
  "A3 Resolve 2.0 ": { flat: 1.6, perHouse: { "resolve": 2.0 } },
  "A4 Morg+Res 2.0": { flat: 1.6, perHouse: { "roy morgan": 2.0, "resolve": 2.0 } },
  "A5 flat 2.0    ": { flat: 2.0, perHouse: {} },
  "A6 Morgan 1.3  ": { flat: 1.6, perHouse: { "roy morgan": 1.3 } },
};

/* ---- parity: arm A0 vs production headline ---------------------------- */
const LATEST_ISO = POLLS.reduce((m, p) => (p.date > m ? p.date : m), "0000");
const refNow = new Date(LATEST_ISO).getTime();
{
  const rows = tppRowsFor(mkRowN(ARMS["A0 base flat1.6"]), POLLS);
  const he = houseEffectsFor(rows);
  const cur = nowcastAdj(rows, he, refNow);
  console.log(`\n== Parity == A0 headline nowcast at ${LATEST_ISO}: ALP ${r1(cur.v)}  (n=${cur.n})`);
  console.log("   must equal committed asset: git show HEAD:.build/newtracker/assets/9f09dca2-*.js | grep alp2pp");
}

/* ---- current-window weight shares per arm ------------------------------- */
console.log("\n== Current 21d window: weight share (%) by firm ==");
{
  const firms = new Set();
  const shares = {};
  for (const [name, arm] of Object.entries(ARMS)) {
    const rows = tppRowsFor(mkRowN(arm), POLLS);
    const he = houseEffectsFor(rows);
    const cur = nowcastAdj(rows, he, refNow);
    const tot = new Map();
    for (const p of cur.pts) tot.set(p.firm, (tot.get(p.firm) || 0) + p.w);
    const s = [...tot.values()].reduce((a, b) => a + b, 0);
    shares[name] = { v: r1(cur.v), map: Object.fromEntries([...tot.entries()].map(([f, w]) => { firms.add(f); return [f, Number((100 * w / s).toFixed(1))]; })) };
  }
  const names = Object.keys(ARMS);
  console.log("firm".padEnd(24), ...names.map((n) => n.padStart(17)));
  for (const f of [...firms].sort())
    console.log(f.padEnd(24), ...names.map((n) => String(shares[n].map[f] ?? "—").padStart(17)));
  console.log("HEADLINE ALP".padEnd(24), ...names.map((n) => String(shares[n].v).padStart(17)));
}

/* ---- part 2: leave-one-out over current term ---------------------------- */
function loo(arm) {
  const rowN = mkRowN(arm);
  const rows = tppRowsFor(rowN, POLLS);
  const out = [];
  for (const r of rows) {
    const rest = rows.filter((o) => o.key !== r.key);
    const he = houseEffectsFor(rest);
    const est = nowcastAdj(rest, he, r.mid);
    if (!est || est.n < 3) continue;                       // need a meaningful window
    const target = r.x - he.at(r.firm, r.mid);             // debiased held-out level
    out.push({ date: r.key.slice(0, 10), firm: r.firm, err: est.v - target });
  }
  return out;
}
console.log("\n== Leave-one-out, current term (err = nowcast − debiased held-out poll) ==");
console.log("arm".padEnd(16), "slice".padEnd(12), "n".padStart(4), "MAE".padStart(7), "RMSE".padStart(7), "MedAE".padStart(7), "bias".padStart(7));
for (const [name, arm] of Object.entries(ARMS)) {
  const errs = loo(arm);
  for (const [label, f] of [["all", () => true], [">=2025-08-01", (e) => e.date >= "2025-08-01"]]) {
    const es = errs.filter(f);
    if (!es.length) continue;
    const abs = es.map((e) => Math.abs(e.err));
    const rmse = Math.sqrt(mean(es.map((e) => e.err ** 2)));
    console.log(name.padEnd(16), label.padEnd(12), String(es.length).padStart(4),
      f2(mean(abs)).padStart(7), f2(rmse).padStart(7), f2(medianOf(abs)).padStart(7), f2(mean(es.map((e) => e.err))).padStart(7));
  }
}

/* ---- paired bootstrap: are the LOO differences real? ------------------- */
console.log("\n== Paired bootstrap, LOO |err| differences vs A0 (5000 resamples) ==");
{
  const perArm = {};
  for (const [name, arm] of Object.entries(ARMS)) {
    perArm[name] = new Map();
    for (const e of loo(arm)) perArm[name].set(e.date + "|" + e.firm, Math.abs(e.err));
  }
  const base = perArm["A0 base flat1.6"];
  const pct = (a, q) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(q * (s.length - 1))]; };
  const B = 5000;
  for (const name of Object.keys(ARMS)) {
    if (name === "A0 base flat1.6") continue;
    const keys = [...base.keys()].filter((k) => perArm[name].has(k));
    const diffsMAE = [], diffsMed = [];
    for (let b = 0; b < B; b++) {
      const ds = [];
      for (let i = 0; i < keys.length; i++) {
        const k = keys[(Math.random() * keys.length) | 0];
        ds.push(perArm[name].get(k) - base.get(k));
      }
      diffsMAE.push(mean(ds));
      diffsMed.push(medianOf(ds));
    }
    const f3 = (v) => v.toFixed(3);
    console.log(name.padEnd(16),
      `ΔMAE mean=${f3(mean(diffsMAE))} [95% ${f3(pct(diffsMAE, 0.025))}..${f3(pct(diffsMAE, 0.975))}]`,
      `ΔMedAE mean=${f3(mean(diffsMed))} [95% ${f3(pct(diffsMed, 0.025))}..${f3(pct(diffsMed, 0.975))}]`);
  }
}

/* ---- part 3: election anchors ------------------------------------------ */
console.log("\n== Election anchors: nowcast at polling day vs result ==");
for (const [name, arm] of Object.entries(ARMS)) {
  const rowN = mkRowN(arm);
  const recs = [];
  const srcs = Object.keys(D.cyclePolls).filter((s) => D.elections["e" + s]).sort();
  for (const src of srcs) {
    const e = D.elections["e" + src];
    const rows = (D.cyclePolls[src] || [])
      .filter((p) => p.firm !== "Election" && !/exit/i.test(p.firm) && !p.isElection && p.tpp_alp != null)
      .map((p) => ({ ...p, firm: ACC_CANON[p.firm] || p.firm }));
    const trows = tppRowsFor(rowN, rows);
    if (!trows.length) { recs.push({ src, n: 0 }); continue; }
    const he = houseEffectsFor(trows);
    const est = nowcastAdj(trows, he, new Date(e.date).getTime());
    if (!est) { recs.push({ src, n: 0 }); continue; }
    recs.push({ src, n: est.n, err: est.v - e.tpp_alp });
  }
  const errs = recs.filter((r) => r.n).map((r) => Math.abs(r.err));
  console.log(name.padEnd(16), `cycles=${String(errs.length).padStart(2)}`, `mean|err|=${f2(mean(errs))}`,
    "signed: " + recs.filter((r) => r.n).map((r) => `${r.src}:${r.err >= 0 ? "+" : ""}${r.err.toFixed(2)}`).join(" "));
}
console.log("\naccuracy-panel reference (mean of final per-house polls, equal weights) is the");
console.log("site's cycle table; the anchors above replay the ESTIMATOR, not that mean.");
