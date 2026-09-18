/* Per-house ACCURACY weighting for the headline nowcast — backtest.

   Question: the estimator corrects each house's LEVEL (its lean away from the
   cross-house consensus) and then weights what is left by effective sample,
   recency and a 1/sqrt(waves) de-swamp. It does not weight by whether the
   house has historically been RIGHT. The site already measures that — the
   "How the final polls did" panel carries every house's mean absolute error
   against the actual result, over up to 17 elections — and the estimator
   never reads it. Kevin Bonham's aggregate does the opposite: an accuracy
   weight on a 0.5–1.5 scale (Newspoll 1.35, RedBridge 1.11) and a hard cap of
   two polls per house.

   The two corrections are not the same thing, and that is the interesting
   part. A house effect is measured against THE OTHER POLLSTERS, so when the
   whole industry leans one way — 2019 — a consensus-relative correction
   inherits the industry's error by construction. An accuracy weight is
   measured against RESULTS, so it has a partial defence. The question this
   race asks is whether that defence is worth its noise, given that most
   houses have a handful of elections of record and several have one.

     w_arm(p) = w_production(p) × acc(firm)

   acc ≡ 1 for every house reproduces production exactly (arm A0 — the parity
   control). Nothing else about the estimator moves: same rowN, same house
   effects, same recency, same taper, same de-swamp.

   LEAKAGE IS THE WHOLE DIFFICULTY. A house's accuracy is computed from
   election results, and the election anchors are scored against those same
   results. Weighting Newspoll up because it called 2019 well and then
   scoring the arm on 2019 measures nothing. So accFor(before) pools ONLY
   cycles that had already happened:

     - election anchors: the arm nowcasting the <year> election sees the
       record as it stood BEFORE that election, cycle by cycle;
     - current-term LOO: every cycle is 2025 or earlier and every poll is
       2025 or later, so the full record is legitimately in the past.

   Shrinkage is the other half. meanAbs over one election is not a
   measurement, and the arms that treat it as one are here to show that.

   Estimator functions below are VERBATIM copies of gen-data.mjs's
   houseEffectsFor / nowcastPts / weightedWithSe and its constant set, kept in
   step with deff-backtest.mjs — the A0 parity gate stops matching the
   committed data asset when they drift.

   VERDICT (first run, 2026-09-18): DO NOT SHIP. Every arm loses.

     - Leave-one-out, 117 current-term polls: every arm raises MAE, and every
       paired-bootstrap interval excludes zero. Mildest (B3) +0.021 MAE
       [95% 0.010..0.032]; unshrunk control (B1n) +0.076. Shrinkage buys back
       most of the damage but never gets to break-even.
     - Election anchors, 19 cycles out of sample: mean |err| 1.71 for A0
       against 1.71–1.73 for the arms. The best arm on the mean (B1 rank,
       −0.01) is 3 cycles better, 5 worse, 11 unchanged — noise, not a signal.
     - The headline barely moves: 52.0 → 51.8–52.0. It does not close the gap
       to aggregators who run higher; if anything it moves away from them.

   WHY it loses, which is the part worth keeping. Two reasons, and the second
   retires an argument that sounds good and is wrong:

     1. The record is too thin where it would have to bite. Of the four houses
        in the current 2PP window only two have a real record — Morgan (17
        cycles, 2.13) and Essential (6, 1.61). Downweighting Morgan pushes its
        weight onto YouGov, whose ONE scored election is a 3.00 miss. The arm
        demotes a well-measured mediocre house in favour of a badly-measured
        worse one, which is the shape of every small-n weighting scheme.

     2. It does not defend against the failure it was supposed to defend
        against. The case for scoring houses on RESULTS rather than on the
        cross-house consensus is that a consensus-relative correction inherits
        an industry-wide miss. The four big anchor misses are exactly those:
        1977 +5.50, 1984 +3.20, 2019 +2.86, 2025 −2.85. Every arm reproduces
        all four to within 0.01–0.05. When every house misses the same way,
        re-weighting BETWEEN houses cannot recover it — the information is not
        in the spread. Accuracy weighting is a defence against a bad pollster,
        never against a bad year.

   Kept, not deleted, so the next session does not re-run the argument from
   scratch. Re-run it when a house's record materially changes — most usefully
   after the next federal election, when YouGov, RedBridge, DemosAU and
   Resolve stop being n=1 or n=2 and the thinness that sinks arm 1 above
   partly resolves.

   Run: node .build/newtracker/acc-backtest.mjs
*/
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const D = JSON.parse(execSync("git show HEAD:data/polls.json", { cwd: ROOT, maxBuffer: 1 << 28 }).toString("utf8"));

import { HOUSE_RENAMES } from "./house-renames.mjs";
const ACC_CANON = {
  "Morgan": "Roy Morgan", "Newspoll-YouGov": "Newspoll",
  "Resolve Strategic": "Resolve", "Freshwater Strategy": "Freshwater",
  "Redbridge/Accent": "RedBridge", "Spectre Strategy": "Spectre",
};
const HE_WINDOW = 28, SHRINK_K = 8, SAMPLE_CAP = 3000, LN2 = Math.log(2);
const HL_DEFF = 1.6;
const HE_HALF = 90;
const HL_WINDOW = 21, HL_HALF = 7, HL_TAPER = 14;
const ACC_WINDOW_DAYS = 14;                       // gen-data's final-poll window
const taperW = (d) => (d <= HL_TAPER ? 1 : 0.5 * (1 + Math.cos(Math.PI * (d - HL_TAPER) / (HL_WINDOW - HL_TAPER))));
const recencyW = (d) => Math.exp(-LN2 * d / HL_HALF) * taperW(d);

const ymOf = (d) => d.slice(0, 7);
const ddays = (a, b) => (a - b) / 86400000;
const r1 = (v) => Math.round(v * 10) / 10;
const f2 = (v) => v.toFixed(2);
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const medianOf = (a) => {
  const v = [...a].sort((x, y) => x - y);
  if (!v.length) return null;
  return v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2;
};
const share2pp = (p) => (p.tpp_lnp != null && p.tpp_alp + p.tpp_lnp > 0) ? (p.tpp_alp / (p.tpp_alp + p.tpp_lnp)) * 100 : p.tpp_alp;
const midMs = (p) => (new Date(p.dateStart || p.date).getTime() + new Date(p.date).getTime()) / 2;
const canonFirm = (firm) => (ACC_CANON[firm] || firm || "")
  .replace(/\s*\(.*\)\s*$/, "").replace(/\s*\/.*$/, "").trim().toLowerCase();
const die = (msg) => { console.error("acc-backtest: FAIL — " + msg); process.exit(1); };

/* ---- house effects: verbatim copy of gen-data.mjs houseEffectsFor ------- */
function houseEffectsFor(rows) {
  const devs = [];
  for (const a of rows) {
    let sw = 0, swx = 0, k = 0;
    for (const b of rows) {
      if (b === a || Math.abs(ddays(b.mid, a.mid)) > HE_WINDOW) continue;
      if (b.firm === a.firm) continue;
      if (a.strat != null && b.strat !== a.strat) continue;
      sw += b.n; swx += b.n * b.x; k++;
    }
    if (k < 3) continue;
    devs.push({ firm: a.firm, mid: a.mid, dev: a.x - swx / sw });
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
  return { at, estimable: devs.length > 0 };
}
const heV = (he, firm, t) => (he && typeof he.at === "function" ? he.at(firm, t) : 0);

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
/* The ONE line this race changes: `* acc(a.firm)` on the finished weight.
   Production is acc ≡ 1. It rides after the de-swamp deliberately — the two
   answer different questions (how many times has this house spoken in the
   window, versus how well does it speak) and multiplying them keeps both. */
function nowcastPts(rows, he, ref, acc) {
  const pts = [];
  const waves = new Map();
  for (const a of rows) {
    const d = ddays(ref, a.mid);
    if (d < 0 || d > HL_WINDOW) continue;
    waves.set(a.firm, (waves.get(a.firm) || 0) + 1);
    pts.push({ w: a.n * recencyW(d), x: a.x - heV(he, a.firm, ref), n: a.n, firm: a.firm, ...(a.pq != null ? { pq: a.pq } : {}) });
  }
  for (const p of pts) p.w = p.w / Math.sqrt(waves.get(p.firm)) * acc(p.firm);
  return pts;
}
function nowcastAdj(rows, he, ref, acc) {
  const pts = nowcastPts(rows, he, ref, acc);
  const r = weightedWithSe(pts);
  return r && { v: r.v, n: r.n, se: r.se, nEff: r.nEff, pts };
}
const rowN = (p) => (p && p.sampleEff != null)
  ? p.sampleEff * HL_DEFF
  : Math.min((p && p.sample) || 1200, SAMPLE_CAP);

/* ---- data ---------------------------------------------------------------- */
const POLLS = D.polls.filter((p) => !p.isElection)
  .map((p) => (HOUSE_RENAMES[p.pollster] ? { ...p, pollster: HOUSE_RENAMES[p.pollster] } : p));
const tppRows = (rows) => rows
  .filter((p) => p.tpp_alp != null)
  .map((p) => ({ ym: ymOf(p.date), mid: midMs(p), x: share2pp(p), n: rowN(p), firm: p.firm || p.pollster, key: p.date + "|" + (p.firm || p.pollster) }));

/* ---- the record, as it stood before a given election -------------------
   Replays gen-data's accuracyCycles: within each cycle take each house's LAST
   poll inside the 14 days before polling day, and score it against the
   result. `before` is exclusive, so a cycle never scores itself. */
const CYCLE_SRCS = Object.keys(D.cyclePolls).filter((s) => D.elections["e" + s]).sort();
function accRecord(before) {
  const byFirm = new Map();
  for (const src of CYCLE_SRCS) {
    if (before != null && Number(src) >= Number(before)) continue;
    const e = D.elections["e" + src];
    const eMs = new Date(e.date).getTime();
    const inWin = (D.cyclePolls[src] || []).filter((p) => {
      if (p.firm === "Election" || /exit/i.test(p.firm) || p.tpp_alp == null) return false;
      const d = ddays(eMs, new Date(p.date).getTime());
      return d >= 0 && d <= ACC_WINDOW_DAYS;
    });
    const last = new Map();
    for (const p of [...inWin].sort((a, b) => a.date.localeCompare(b.date)))
      last.set(canonFirm(p.firm), p);
    for (const [firm, p] of last) {
      const g = byFirm.get(firm) || [];
      g.push(Math.abs(share2pp(p) - e.tpp_alp));
      byFirm.set(firm, g);
    }
  }
  const out = new Map();
  for (const [firm, errs] of byFirm) out.set(firm, { n: errs.length, m: mean(errs) });
  const all = [...byFirm.values()].flat();
  return { per: out, pooled: all.length ? mean(all) : null, cycles: CYCLE_SRCS.filter((s) => before == null || Number(s) < Number(before)).length };
}

/* ---- arms: how a record becomes a weight -------------------------------- */
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
/* meanAbs over one election is not a measurement of a house, it is one draw
   from it. Every arm but the deliberately naive B1n shrinks toward the pooled
   error on the evidence count, so a house with a single cycle sits near
   neutral and earns its way out with each election it survives. */
const shrunk = (rec, firm, k) => {
  const g = rec.per.get(firm);
  if (!g || rec.pooled == null) return rec.pooled;
  return (g.n * g.m + k * rec.pooled) / (g.n + k);
};
const ARMS = {
  /* the parity control: production, untouched */
  "A0 production  ": () => () => 1,

  /* Bonham-shaped: rank the houses on record and spread them over his own
     0.5–1.5 scale. Rank throws away how FAR apart the houses are, which is
     either robustness or blindness depending on the spread. */
  "B1 rank .5-1.5 ": (rec) => {
    const fs_ = [...rec.per.entries()].filter(([, g]) => g.n >= 2).sort((a, b) => a[1].m - b[1].m);
    const w = new Map();
    fs_.forEach(([f], i) => w.set(f, fs_.length < 2 ? 1 : 1.5 - i * (1.0 / (fs_.length - 1))));
    return (firm) => w.get(canonFirm(firm)) ?? 1;
  },

  /* inverse-variance, the principled form: a house whose errors are half the
     size carries four times the information. Shrunk on k=4 cycles and clamped
     to Bonham's range so no single house can run away with a window. */
  "B2 invvar k4    ": (rec) => (firm) => {
    const m = shrunk(rec, canonFirm(firm), 4);
    return m == null || !rec.pooled ? 1 : clamp((rec.pooled / m) ** 2, 0.5, 1.5);
  },
  /* the same, halved in strength: inverse ERROR rather than inverse variance */
  "B3 inverr k4   ": (rec) => (firm) => {
    const m = shrunk(rec, canonFirm(firm), 4);
    return m == null || !rec.pooled ? 1 : clamp(rec.pooled / m, 0.5, 1.5);
  },
  /* heavier shrinkage: k=8, the same constant the house-effect pooling uses */
  "B4 invvar k8   ": (rec) => (firm) => {
    const m = shrunk(rec, canonFirm(firm), 8);
    return m == null || !rec.pooled ? 1 : clamp((rec.pooled / m) ** 2, 0.5, 1.5);
  },
  /* a house with fewer than three elections of record says nothing yet */
  "B5 n>=3 or 1.0 ": (rec) => (firm) => {
    const g = rec.per.get(canonFirm(firm));
    if (!g || g.n < 3 || !rec.pooled) return 1;
    return clamp((rec.pooled / shrunk(rec, canonFirm(firm), 4)) ** 2, 0.5, 1.5);
  },
  /* the control that should LOSE: no shrinkage at all, one election is a
     verdict. Here to price what the shrinkage is buying. */
  "B1n raw invvar ": (rec) => (firm) => {
    const g = rec.per.get(canonFirm(firm));
    return !g || !rec.pooled || !g.m ? 1 : clamp((rec.pooled / g.m) ** 2, 0.5, 1.5);
  },
};

/* ---- parity gate: A0 must reproduce the committed headline ------------- */
const LATEST_ISO = POLLS.reduce((m, p) => (p.date > m ? p.date : m), "0000");
const refNow = new Date(LATEST_ISO).getTime();
const ROWS_NOW = tppRows(POLLS);
const HE_NOW = houseEffectsFor(ROWS_NOW);
{
  const cur = nowcastAdj(ROWS_NOW, HE_NOW, refNow, () => 1);
  const assetName = fs.readdirSync(path.join(ROOT, ".build/newtracker/assets")).find((f) => f.startsWith("9f09dca2-") && f.endsWith(".js"));
  const m = assetName && fs.readFileSync(path.join(ROOT, ".build/newtracker/assets", assetName), "utf8").match(/"alp2pp":([0-9.]+),"lnp2pp":[0-9.]+,"alp2ppPrev"/);
  const committed = m && Number(m[1]);
  console.log(`== Parity == A0 headline nowcast at ${LATEST_ISO}: ALP ${r1(cur.v)}   committed asset: ALP ${committed}`);
  if (committed == null) die("parity: could not read alp2pp from the committed data asset");
  if (r1(cur.v) !== committed) die(`parity: A0 replica (${r1(cur.v)}) != committed (${committed}). The estimator copies here have drifted from gen-data.mjs.`);
}

/* ---- the record the current term is entitled to see --------------------- */
const REC_NOW = accRecord(null);
console.log(`\n== The record, all ${REC_NOW.cycles} scored cycles (pooled mean |err| = ${f2(REC_NOW.pooled)}) ==`);
console.log("house".padEnd(18), "cycles".padStart(7), "mean|err|".padStart(10),
  ...Object.keys(ARMS).filter((k) => k !== "A0 production  ").map((k) => k.trim().padStart(9)));
const nowFirms = [...new Set(ROWS_NOW.filter((r) => ddays(refNow, r.mid) <= HL_WINDOW && ddays(refNow, r.mid) >= 0).map((r) => r.firm))];
const armFns = Object.fromEntries(Object.entries(ARMS).map(([k, f]) => [k, f(REC_NOW)]));
for (const firm of nowFirms.sort()) {
  const g = REC_NOW.per.get(canonFirm(firm));
  console.log(firm.padEnd(18), String(g ? g.n : 0).padStart(7), (g ? f2(g.m) : "—").padStart(10),
    ...Object.keys(ARMS).filter((k) => k !== "A0 production  ").map((k) => armFns[k](firm).toFixed(2).padStart(9)));
}

/* ---- current window: what each arm would publish ------------------------ */
console.log("\n== Current 21d window: weight share (%) by firm, and the headline ==");
{
  const names = Object.keys(ARMS);
  const shares = {};
  for (const name of names) {
    const cur = nowcastAdj(ROWS_NOW, HE_NOW, refNow, armFns[name]);
    const tot = new Map();
    for (const p of cur.pts) tot.set(p.firm, (tot.get(p.firm) || 0) + p.w);
    const s = [...tot.values()].reduce((a, b) => a + b, 0);
    shares[name] = { v: r1(cur.v), map: Object.fromEntries([...tot.entries()].map(([f, w]) => [f, Number((100 * w / s).toFixed(1))])) };
  }
  console.log("firm".padEnd(20), ...names.map((n) => n.trim().padStart(16)));
  for (const f of nowFirms.sort())
    console.log(f.padEnd(20), ...names.map((n) => String(shares[n].map[f] ?? "—").padStart(16)));
  console.log("HEADLINE ALP".padEnd(20), ...names.map((n) => String(shares[n].v).padStart(16)));
}

/* ---- part 1: leave-one-out over the current term ------------------------ */
function loo(accFn) {
  const out = [];
  for (const r of ROWS_NOW) {
    const rest = ROWS_NOW.filter((o) => o.key !== r.key);
    const he = houseEffectsFor(rest);
    const est = nowcastAdj(rest, he, r.mid, accFn);
    if (!est || est.n < 3) continue;
    out.push({ date: r.key.slice(0, 10), firm: r.firm, err: est.v - (r.x - he.at(r.firm, r.mid)) });
  }
  return out;
}
console.log("\n== Leave-one-out, current term (err = nowcast − debiased held-out poll) ==");
console.log("arm".padEnd(16), "slice".padEnd(12), "n".padStart(4), "MAE".padStart(7), "RMSE".padStart(7), "MedAE".padStart(7), "bias".padStart(7));
const LOO = {};
for (const name of Object.keys(ARMS)) {
  LOO[name] = loo(armFns[name]);
  for (const [label, f] of [["all", () => true], [">=2025-08-01", (e) => e.date >= "2025-08-01"]]) {
    const es = LOO[name].filter(f);
    if (!es.length) continue;
    const abs = es.map((e) => Math.abs(e.err));
    console.log(name.padEnd(16), label.padEnd(12), String(es.length).padStart(4),
      f2(mean(abs)).padStart(7), f2(Math.sqrt(mean(es.map((e) => e.err ** 2)))).padStart(7),
      f2(medianOf(abs)).padStart(7), f2(mean(es.map((e) => e.err))).padStart(7));
  }
}

/* ---- paired bootstrap: are the LOO differences real? -------------------- */
console.log("\n== Paired bootstrap, LOO |err| differences vs A0 (5000 resamples) ==");
{
  const key = (e) => e.date + "|" + e.firm;
  const perArm = Object.fromEntries(Object.entries(LOO).map(([n, es]) => [n, new Map(es.map((e) => [key(e), Math.abs(e.err)]))]));
  const base = perArm["A0 production  "];
  const pct = (a, q) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(q * (s.length - 1))]; };
  const B = 5000, f3 = (v) => v.toFixed(3);
  for (const name of Object.keys(ARMS)) {
    if (name === "A0 production  ") continue;
    const keys = [...base.keys()].filter((k) => perArm[name].has(k));
    const dMAE = [], dMed = [];
    for (let b = 0; b < B; b++) {
      const ds = [];
      for (let i = 0; i < keys.length; i++) {
        const k = keys[(Math.random() * keys.length) | 0];
        ds.push(perArm[name].get(k) - base.get(k));
      }
      dMAE.push(mean(ds)); dMed.push(medianOf(ds));
    }
    console.log(name.padEnd(16),
      `ΔMAE mean=${f3(mean(dMAE))} [95% ${f3(pct(dMAE, 0.025))}..${f3(pct(dMAE, 0.975))}]`,
      `ΔMedAE mean=${f3(mean(dMed))} [95% ${f3(pct(dMed, 0.025))}..${f3(pct(dMed, 0.975))}]`);
  }
}

/* ---- part 2: election anchors, strictly out of sample ------------------- */
console.log("\n== Election anchors: nowcast at polling day vs result (record known BEFORE each) ==");
const anchorErrs = {};
for (const name of Object.keys(ARMS)) {
  const recs = [];
  for (const src of CYCLE_SRCS) {
    const e = D.elections["e" + src];
    const rows = tppRows((D.cyclePolls[src] || [])
      .filter((p) => p.firm !== "Election" && !/exit/i.test(p.firm) && !p.isElection && p.tpp_alp != null)
      .map((p) => ({ ...p, firm: ACC_CANON[p.firm] || p.firm })));
    if (!rows.length) { recs.push({ src, n: 0 }); continue; }
    const he = houseEffectsFor(rows);
    // the record as it stood BEFORE this election — never including it
    const est = nowcastAdj(rows, he, new Date(e.date).getTime(), ARMS[name](accRecord(src)));
    if (!est) { recs.push({ src, n: 0 }); continue; }
    recs.push({ src, n: est.n, err: est.v - e.tpp_alp });
  }
  const scored = recs.filter((r) => r.n);
  anchorErrs[name] = scored;
  console.log(name.padEnd(16), `cycles=${String(scored.length).padStart(2)}`,
    `mean|err|=${f2(mean(scored.map((r) => Math.abs(r.err))))}`,
    `med=${f2(medianOf(scored.map((r) => Math.abs(r.err))))}`,
    "| " + scored.map((r) => `${r.src}:${r.err >= 0 ? "+" : ""}${r.err.toFixed(2)}`).join(" "));
}
/* The anchors are 19 observations, so the per-cycle deltas matter more than
   the mean: an arm that wins on average by helping one cycle and hurting the
   rest has not learned anything transferable. */
console.log("\n== Anchors: per-cycle |err| change vs A0 (− is better) ==");
{
  const base = new Map(anchorErrs["A0 production  "].map((r) => [r.src, Math.abs(r.err)]));
  for (const name of Object.keys(ARMS)) {
    if (name === "A0 production  ") continue;
    const ds = anchorErrs[name].filter((r) => base.has(r.src))
      .map((r) => ({ src: r.src, d: Math.abs(r.err) - base.get(r.src) }));
    const better = ds.filter((x) => x.d < -0.005).length, worse = ds.filter((x) => x.d > 0.005).length;
    console.log(name.padEnd(16), `mean Δ=${(mean(ds.map((x) => x.d)) >= 0 ? "+" : "")}${f2(mean(ds.map((x) => x.d)))}`,
      `better ${String(better).padStart(2)} / worse ${String(worse).padStart(2)} / flat ${String(ds.length - better - worse).padStart(2)}`,
      "| " + ds.filter((x) => Math.abs(x.d) > 0.05).map((x) => `${x.src}:${x.d >= 0 ? "+" : ""}${x.d.toFixed(2)}`).join(" "));
  }
}
console.log("\nA weighting change that cannot beat A0 on the anchors is not a bug fix, and");
console.log("the anchors are the only place a house's ACCURACY can be scored at all — the");
console.log("LOO target is the other polls, which is the thing accuracy weighting doubts.");
