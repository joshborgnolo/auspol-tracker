/* Primary-vote aggregate v simple averages, scored on past elections.

   Question (user, 2026-11-04): is the primary aggregate backtested against
   past elections – has its polling error been compared with a simple
   average's? Until now no: deff-/acc-backtest score the 2PP only, and the
   seat model's calibrate-national sizes error from a PLAIN mean.

   For every federal cycle with polls in the final three weeks, each party's
   primary is estimated at polling day five ways and scored on the result:

     A0  production – gen-data's per-party construction (primaryNowAt minus
         its five-party rescale, which needs all five parties polled): house
         leans measured within the cycle (houseEffectsFor, SHRINK_K 1.5,
         90-day lean half-life), 21-day window, 7-day half-life, half-cosine
         taper, sqrt-wave deflation
     R   the same without house leans (recency-weighted mean)
     S21 plain mean of every poll in the final 21 days
     S14 plain mean of every poll in the final 14 days
     L14 mean of each house's last poll in the final 14 days (the final-polls
         panel's set)

   Limits of the history: cyclePolls carry no sample sizes or fieldwork
   starts, so every past row has n = 1200 and its date is its midpoint – the
   n-weighting the live estimator does cannot be tested here. Exit polls,
   MRPs counted as production counts them (no NO_AGG house appears in past
   cycles). The estimator functions are VERBATIM copies of gen-data.mjs.

   Run: node .build/newtracker/primary-backtest.mjs [--from 1987]
*/
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const D = JSON.parse(execSync("git show HEAD:data/polls.json", { cwd: ROOT, maxBuffer: 1 << 28 }).toString("utf8"));
const argv = process.argv.slice(2);
const FROM = Number(argv.includes("--from") ? argv[argv.indexOf("--from") + 1] : 1987);

/* ---- constants + estimator: verbatim from gen-data.mjs ------------------ */
const HE_WINDOW = 28, SHRINK_K = 1.5, SAMPLE_CAP = 3000, LN2 = Math.log(2);
const HL_DEFF = 1.6;
const HE_HALF = 90;
const HL_WINDOW = 21, HL_HALF = 7, HL_TAPER = 14;
const rowN = (p) => (p && p.sampleEff != null) ? p.sampleEff * HL_DEFF : Math.min((p && p.sample) || 1200, SAMPLE_CAP);
const midMs = (p) => (new Date(p.dateStart || p.date).getTime() + new Date(p.date).getTime()) / 2;
const ddays = (a, b) => (a - b) / 86400000;
const taperW = (d) => (d <= HL_TAPER ? 1 : 0.5 * (1 + Math.cos(Math.PI * (d - HL_TAPER) / (HL_WINDOW - HL_TAPER))));
const recencyW = (d) => Math.exp(-LN2 * d / HL_HALF) * taperW(d);
const HEADLINE_K = { window: HL_WINDOW, weight: recencyW };

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
  return { at, estimable: devs.length > 0 };
}
const heV = (he, firm, t) => (he && typeof he.at === "function" ? he.at(firm, t) : 0);
function weightedWithSe(pts) {
  let sw = 0, swx = 0;
  for (const p of pts) { sw += p.w; swx += p.w * p.x; }
  if (!sw) return null;
  return { v: swx / sw, n: pts.length };
}
function nowcastPts(rows, he, ref, k = HEADLINE_K) {
  const pts = [];
  const waves = new Map();
  for (let i = 0; i < rows.length; i++) {
    const a = rows[i];
    const d = ddays(ref, a.mid);
    if (d < 0 || d > k.window) continue;
    waves.set(a.firm, (waves.get(a.firm) || 0) + 1);
    pts.push({ ri: i, w: (a.w0 ?? a.n) * k.weight(d), x: a.x - heV(he, a.firm, ref), n: a.n, firm: a.firm });
  }
  for (const p of pts) p.w /= Math.sqrt(waves.get(p.firm));
  return pts;
}

/* ---- helpers ------------------------------------------------------------ */
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const median = (a) => { const v = [...a].sort((x, y) => x - y); return v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2; };
const rms = (a) => Math.sqrt(mean(a.map((x) => x * x)));
const f2 = (v) => (v >= 0 ? " " : "") + v.toFixed(2);
const sg = (v) => (v >= 0 ? "+" : "") + v.toFixed(1);
const firmOf = (p) => p.firm || p.pollster || "";
const isPoll = (p) => !p.isElection && !/^(election|election result)$/i.test(firmOf(p)) && !/exit/i.test(firmOf(p));

const PARTIES = [["alp", "Labor"], ["lnp", "Coalition"], ["grn", "Greens"], ["onp", "One Nation"]];
const ARMS = ["A0", "R", "S21", "S14", "L14"];
const ARM_LABEL = {
  A0: "A0  production (leans + recency)",
  R: "R   recency, no leans",
  S21: "S21 plain mean, 21 days",
  S14: "S14 plain mean, 14 days",
  L14: "L14 each house's last poll, 14 days",
};

const CYCLES = Object.keys(D.cyclePolls).filter((c) => D.elections["e" + c] && +c >= FROM).sort();
const recs = [];   // { cycle, party, houses, polls21, err: {arm: e} }
for (const c of CYCLES) {
  const E = D.elections["e" + c];
  const T = new Date(E.date).getTime();
  const polls = D.cyclePolls[c].filter(isPoll);
  for (const [k] of PARTIES) {
    if (!(E[k] > 0)) continue;
    const rows = polls.filter((p) => p[k] != null)
      .map((p) => ({ mid: midMs(p), x: p[k], n: rowN(p), firm: firmOf(p), date: p.date }));
    const in21 = rows.filter((r) => { const d = ddays(T, r.mid); return d >= 0 && d <= 21; });
    const in14 = in21.filter((r) => ddays(T, r.mid) <= 14);
    if (!in21.length) continue;
    const he = houseEffectsFor(rows);
    const est = {};
    est.A0 = weightedWithSe(nowcastPts(rows, he, T)).v;
    est.R = weightedWithSe(nowcastPts(rows, null, T)).v;
    est.S21 = mean(in21.map((r) => r.x));
    if (in14.length) {
      est.S14 = mean(in14.map((r) => r.x));
      const last = new Map();
      for (const r of in14) if (!last.has(r.firm) || r.mid > last.get(r.firm).mid) last.set(r.firm, r);
      est.L14 = mean([...last.values()].map((r) => r.x));
    }
    const err = {};
    for (const a of ARMS) if (est[a] != null) err[a] = est[a] - E[k];
    recs.push({ cycle: c, party: k, houses: new Set(in21.map((r) => r.firm)).size, polls21: in21.length, err, heOn: he.estimable });
  }
}

/* ---- report --------------------------------------------------------------- */
const scoreTable = (title, rs) => {
  const full = rs.filter((r) => ARMS.every((a) => r.err[a] != null));
  if (!full.length) return;
  console.log(`\n${title}  (${full.length} party-elections scored by every method)`);
  console.log("  method".padEnd(40), "mean|err|  median  RMSE   bias   A0 better/worse");
  for (const a of ARMS) {
    const e = full.map((r) => r.err[a]);
    let bw = "";
    if (a !== "A0") {
      const d = full.map((r) => Math.abs(r.err.A0) - Math.abs(r.err[a]));
      bw = `${d.filter((x) => x < -0.05).length} / ${d.filter((x) => x > 0.05).length}`;
    }
    console.log("  " + ARM_LABEL[a].padEnd(38), f2(mean(e.map(Math.abs))).padStart(8), f2(median(e.map(Math.abs))).padStart(7),
      f2(rms(e)).padStart(6), f2(mean(e)).padStart(6), "  " + bw);
  }
  // paired bootstrap on A0 − S21 mean |err|, resampling elections (a cycle's parties move together)
  const cyc = [...new Set(full.map((r) => r.cycle))];
  const byC = new Map(cyc.map((c) => [c, full.filter((r) => r.cycle === c)]));
  for (const b of ["S21", "L14"]) {
    const ds = [];
    let seed = 12345; const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
    for (let i = 0; i < 4000; i++) {
      const pick = cyc.map(() => byC.get(cyc[Math.floor(rnd() * cyc.length)])).flat();
      ds.push(mean(pick.map((r) => Math.abs(r.err.A0) - Math.abs(r.err[b]))));
    }
    ds.sort((x, y) => x - y);
    const obs = mean(full.map((r) => Math.abs(r.err.A0) - Math.abs(r.err[b])));
    console.log(`  A0 − ${b} mean|err|: ${f2(obs)}  [95% ${f2(ds[100])} .. ${f2(ds[3900])}]  (bootstrap over ${cyc.length} elections)`);
  }
};

console.log(`Primary-vote aggregate at polling day v simple averages, federal ${CYCLES[0]}–${CYCLES[CYCLES.length - 1]}`);
console.log("err = estimate − result, points. Past rows carry no sample sizes (all n = 1200).\n");
console.log("Per election (A0 / S21 / L14 errors; houses in the 21-day window):");
for (const [k, name] of PARTIES) {
  const rs = recs.filter((r) => r.party === k);
  if (!rs.length) continue;
  console.log(`  ${name}`);
  for (const r of rs) {
    console.log(`    ${r.cycle}  houses ${String(r.houses).padStart(2)}  polls ${String(r.polls21).padStart(2)}   A0 ${sg(r.err.A0).padStart(5)}  S21 ${sg(r.err.S21).padStart(5)}  L14 ${r.err.L14 != null ? sg(r.err.L14).padStart(5) : "   – "}   R ${sg(r.err.R).padStart(5)}${r.heOn ? "" : "   (no lean measurable)"}`);
  }
}

const multi = recs.filter((r) => r.houses >= 2);
scoreTable("ALL PARTIES, elections with 2+ houses polling", multi);
for (const [k, name] of PARTIES) scoreTable(`${name}, 2+ houses`, multi.filter((r) => r.party === k));
scoreTable("Major parties, 2+ houses", multi.filter((r) => r.party === "alp" || r.party === "lnp"));
scoreTable("Minor parties (Greens + One Nation), 2+ houses", multi.filter((r) => r.party === "grn" || r.party === "onp"));
scoreTable("ALL PARTIES, 2010 onwards (4+ houses each time)", multi.filter((r) => +r.cycle >= 2010));
