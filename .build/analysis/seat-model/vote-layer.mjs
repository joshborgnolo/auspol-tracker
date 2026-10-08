#!/usr/bin/env node
/* vote-layer.mjs — W4 of .build/analysis/seat-model-plan.md (§Architecture.2).

   Turns the repo's current polling read into the three inputs layer 3
   (seat translation) consumes:

     1. NATIONAL ΔV_p       — gen-data's house-corrected §7e primary nowcast
        (PRIMARY_KEYS alp/lnp/grn/onp/oth, 21-day window) minus the certified
        2025 national result derived from the W3 baseline counts. The gen-data
        run is spawned read-only with GEN_DATA_OUT pointed at a temp dir so
        no site asset moves; the machine line `primaryNow:` is parsed off its
        stdout.

     2. STATE dev_{s,p}     — each state's current-cell share vs (certified
        2025 cell share + national movement), pooled across houses, then
        shrunk toward 0. Every house's cell set is self-centred (its own
        population-weighted mean deviation is subtracted), so a house's
        national-level bias cancels instead of leaking into states. Cells the
        pollster reports only as a composite (YouGov's ACT/NT/Tas, Resolve's
        Rest of Australia) never get split across silently — the composite
        value is applied to each covered state with double variance and marked
        compositionOnly, matching the plan's hard limit that Tas/NT/ACT are
        composition-only guesses.

     3. β_{p,g} differential swings — demographics.json waves vs the ONE
        May-2025 baseline wave that exists (Resolve 2025-05-03, which carries
        only age/gender/state). β is therefore published for age and gender
        ONLY, difference-in-differences within Resolve (its house effect
        cancels), self-centred per dim so Σ_g w_g β_g = 0 exactly — the same
        identity layer 3 needs. Education/income/location/housing/generation
        have no May-2025 baseline wave in the file; they are listed under
        notEstimable, never back-filled.

   Shares are % (0–100). Uncertainty: binomial sampling variance per cell,
   n_eff = wave n × population share of the cell (waves carry no per-cell
   counts); Resolve waves carry no n at all → the matching polls.json row
   (±14d) else the house's median sample, flagged sampleInferred.

   Output: data/seat-vote-layer.json + a console report. Invariants pinned by
   test-vote-layer.mjs. Read-only w.r.t. every input; the only write is the
   output JSON. Stage-1: no site files, no validate.mjs changes. */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const RECENT_DAYS = 60;               // current window, anchored at the latest wave date in the file
const BASELINE_HOUSE = "Resolve", BASELINE_DATE = "2025-05-03";
const SAMPLE_MATCH_DAYS = 14;
const P5 = ["alp", "lnp", "on", "grn", "oth"]; // model party keys; lnp = combined Coalition
const DEMO_TO_P5 = { alp: "alp", lnp: "lnp", onp: "on", grn: "grn", oth: "oth" };
const BETA_DIMS = ["age", "gender"];  // dims carried by the 2025-05-03 baseline wave, minus state
const NO_BASELINE_DIMS = ["education", "income", "location", "housing", "generation"];
const STATE_ORDER = ["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"];
// pollster state-cell label → state partition the label covers
const CELL_MAP = {
  NSW: ["NSW"], Vic: ["VIC"], Qld: ["QLD"], SA: ["SA"], WA: ["WA"],
  "ACT/NT/Tas": ["ACT", "NT", "TAS"],
  "Rest of Australia": ["SA", "WA", "TAS", "NT", "ACT"],
};
const r2 = (x) => Math.round(x * 100) / 100;
const day = 86400000;
const sha16 = (f) => createHash("sha256").update(readFileSync(f)).digest("hex").slice(0, 16);

const POLLS = JSON.parse(readFileSync("data/polls.json", "utf8"));
const DEMO = JSON.parse(readFileSync("data/demographics.json", "utf8"));
const CENSUS = JSON.parse(readFileSync("data/census-2021-divisions.json", "utf8"));
const BASE = JSON.parse(readFileSync("data/seats-2025-baseline.json", "utf8"));

/* ---- 1. national nowcast ------------------------------------------------ */
const tmpOut = mkdtempSync(join(tmpdir(), "auspol-w4-"));
const gdOut = execFileSync(process.execPath, [".build/newtracker/gen-data.mjs"], {
  env: { ...process.env, GEN_DATA_OUT: tmpOut }, maxBuffer: 1 << 28, encoding: "utf8",
});
rmSync(tmpOut, { recursive: true, force: true });
const pnLine = gdOut.split("\n").find((l) => l.startsWith("primaryNow:"));
if (!pnLine) { console.error("primaryNow line missing from gen-data stdout — §7e window empty?"); process.exit(1); }
const N_NOWCAST_POLLS = +(pnLine.match(/\| n=(\d+)/) || [])[1];
const nowcast = {};
for (const m of pnLine.matchAll(/(alp|lnp|grn|onp|oth) ([\d.]+)/g)) nowcast[DEMO_TO_P5[m[1]]] = +m[2];
for (const p of P5) if (nowcast[p] == null || !N_NOWCAST_POLLS) { console.error("primaryNow line unparsable: " + pnLine); process.exit(1); }

/* ---- 2. certified 2025: national + state 5-key shares ------------------ */
const TAU2_FLOOR = 1;           // shrinkage across states never takes σ below 1pp
const coalKeys = ["lp", "lnp", "np", "clp"];
const sumInto = (acc, prim, formal) => {
  // member:<name> primaries (the 12 named independents) are OTH votes in the
  // 5-key projection — the model knows them only through oth.
  const member = Object.keys(prim).filter((k) => k.startsWith("member:"))
    .reduce((s, k) => s + prim[k], 0);
  for (const p of P5) {
    const v = p === "lnp" ? coalKeys.reduce((s, k) => s + (prim[k] || 0), 0)
      : ((prim[p] || 0) + (p === "oth" ? member : 0));
    acc[p] += v;                // raw vote counts; shares derived by sharesOf
  }
  acc.formal += formal;
};
const natAcc = Object.fromEntries([...P5, "formal"].map((k) => [k, 0]));
const stAcc = Object.fromEntries(STATE_ORDER.map((s) => [s, Object.fromEntries([...P5, "formal"].map((k) => [k, 0]))]));
for (const seat of BASE.seats) { sumInto(natAcc, seat.primaries, seat.formal); sumInto(stAcc[seat.state], seat.primaries, seat.formal); }
const sharesOf = (acc) => Object.fromEntries(P5.map((p) => [p, r2(100 * acc[p] / acc.formal)]));
const result2025 = { national: sharesOf(natAcc), states: Object.fromEntries(STATE_ORDER.map((s) => [s, sharesOf(stAcc[s])])) };
const deltaNat = Object.fromEntries(P5.map((p) => [p, r2(nowcast[p] - result2025.national[p])]));
// certified formal share of each state — the electorate's population weights
const wState = Object.fromEntries(STATE_ORDER.map((s) => [s, stAcc[s].formal / natAcc.formal]));
// 2025 share of a composite cell (0-100 pct, count-weighted over covered states)
const cell2025 = (states) => {
  const f = states.reduce((s, st) => s + stAcc[st].formal, 0);
  return Object.fromEntries(P5.map((p) => [p, 100 * states.reduce((s, st) => s + stAcc[st][p], 0) / f]));
};

/* ---- 3. population weights for demographic cells ----------------------- */
const pop = CENSUS.divisions.reduce((a, d) => {
  a.m += d.gender.m; a.f += d.gender.f;
  for (const [k, v] of Object.entries(d.ageCounts)) a.age[k] = (a.age[k] || 0) + v;
  return a;
}, { m: 0, f: 0, age: {} });
// 18–34 ≈ 40% of the 15_19 band (ages 18,19) + 20_24 + 25_34 (uniform-age assumption)
const ageAdult = Object.fromEntries(["18–34", "35–54", "55+"].map((k) => [k, 0]));
ageAdult["18–34"] = 0.4 * pop.age["15_19"] + pop.age["20_24"] + pop.age["25_34"];
ageAdult["35–54"] = pop.age["35_44"] + pop.age["45_54"];
ageAdult["55+"] = pop.age["55_64"] + pop.age["65_74"] + pop.age["75_84"] + pop.age["85ov"];
const ageTot = Object.values(ageAdult).reduce((a, b) => a + b, 0);
const CELL_W = {
  age: Object.fromEntries(Object.entries(ageAdult).map(([k, v]) => [k, v / ageTot])),
  gender: { Men: pop.m / (pop.m + pop.f), Women: pop.f / (pop.m + pop.f) },
};

/* ---- 4. wave plumbing --------------------------------------------------- */
const latestWave = DEMO.waves.reduce((m, w) => w.date > m ? w.date : m, "");
const recentFrom = new Date(new Date(latestWave).getTime() - RECENT_DAYS * day).toISOString().slice(0, 10);
const currentWaves = DEMO.waves.filter((w) => w.date >= recentFrom);
const pollsRows = POLLS.polls;
const houseMedianSample = (h) => {
  const xs = pollsRows.filter((r) => r.pollster === h && r.sample).map((r) => r.sample).sort((a, b) => a - b);
  return xs.length ? xs[Math.floor(xs.length / 2)] : null;
};
function waveSample(w) {
  const t = new Date(w.date).getTime();
  const hit = pollsRows
    .filter((r) => r.pollster === w.pollster && r.sample && Math.abs(new Date(r.date) - t) <= SAMPLE_MATCH_DAYS * day)
    .sort((a, b) => Math.abs(new Date(a.date) - t) - Math.abs(new Date(b.date) - t))[0];
  if (hit) return { n: hit.sample, inferred: false, matchedPoll: hit.date };
  const med = houseMedianSample(w.pollster);
  return { n: med, inferred: true, matchedPoll: null };
}
const vShare = (y, n) => y * (100 - y) / n;                     // %² binomial sampling variance
// pool same-house current waves per cell: {y, v} inverse-variance
function poolCells(entries) {
  const W = entries.reduce((s, e) => s + 1 / e.v, 0);
  const y = entries.reduce((s, e) => s + e.y / e.v, 0) / W;
  return { y, v: 1 / W, nWaves: entries.length };
}

/* ---- 5. state deviations ------------------------------------------------ */
// stage A: per house, per pollster-labelled cell → centred deviation {dev, v}
const stateDiag = [];   // report rows
const stateObs = Object.fromEntries(STATE_ORDER.map((s) => [s, Object.fromEntries(P5.map((p) => [p, []]))]));
const housesNow = [...new Set(currentWaves.map((w) => w.pollster))];
for (const house of housesNow) {
  const waves = currentWaves.filter((w) => w.pollster === house && w.dims?.state);
  if (!waves.length) continue;
  const baseline = house === BASELINE_HOUSE
    ? DEMO.waves.find((w) => w.pollster === house && w.date === BASELINE_DATE && w.dims?.state) : null;
  // per cell label: current pooled {y,v} (per party), and baseline where it exists
  const labels = [...new Set(waves.flatMap((w) => Object.keys(w.dims.state)))];
  const cells = [];
  for (const label of labels) {
    const covered = CELL_MAP[label];
    if (!covered) { console.error(`note: unmapped state label "${label}" (${house}) — skipped`); continue; }
    const cur = {};
    for (const p of P5) {
      const entries = waves.filter((w) => w.dims.state[label]?.[key5(p)] != null).map((w) => {
        const y = w.dims.state[label][key5(p)];
        const { n } = waveSample(w);
        return { y, v: vShare(y, n * cellPopShare(label)) };
      });
      if (!entries.length) { cur[p] = null; continue; }
      cur[p] = poolCells(entries);
    }
    let base = null, baseV = null;
    if (baseline?.dims.state[label]) {
      const { n, inferred } = waveSample(baseline);
      base = baseline.dims.state[label];
      baseV = (p) => vShare(base[key5(p)], n * cellPopShare(label));
      if (inferred) stateDiag.push(`${house} baseline wave ${BASELINE_DATE}: sample inferred (median ${n})`);
    }
    cells.push({ label, covered, cur, base, baseV });
  }
  // deviation per cell per party — DiD where a baseline wave exists, else level-gap
  // vs certified+Δnat — then centre on the house's own population-weighted mean
  // (weights re-normalised within this house's cell partition).
  const devs = [];
  for (const c of cells) {
    const wCert = c.covered.reduce((s, st) => s + stAcc[st].formal, 0) / natAcc.formal;
    const comp = cell2025(c.covered);
    for (const p of P5) {
      if (!c.cur[p]) continue;
      let dev, v;
      if (c.base) {
        dev = c.cur[p].y - c.base[key5(p)];
        v = c.cur[p].v + c.baseV(p);
      } else {
        dev = c.cur[p].y - comp[p] - deltaNat[p];
        v = c.cur[p].v;        // certified 2025 is the population: no baseline sampling term
      }
      devs.push({ c, p, dev, v, wCert });
    }
  }
  const wSum = devs.filter((d) => d.p === "alp").reduce((s, d) => s + d.wCert, 0);
  for (const p of P5) {
    const centre = devs.filter((d) => d.p === p).reduce((s, d) => s + d.wCert * d.dev, 0) / wSum;
    for (const d of devs.filter((d) => d.p === p)) {
      const centred = d.dev - centre;
      for (const st of d.c.covered) {
        const composite = d.c.covered.length > 1;
        stateObs[st][p].push({
          y: centred, v: composite ? 2 * d.v : d.v, house, label: d.c.label, composite,
        });
        stateDiag.push(`${house} ${d.c.label}${composite ? ` (composite→${st})` : ""} ${p}: dev ${centred.toFixed(1)} ±${Math.sqrt(composite ? 2 * d.v : d.v).toFixed(1)}`);
      }
    }
  }
}
function key5(p) { return p === "on" ? "onp" : p; }
// population share of a pollster cell — certified 2025 formal shares (the electorate)
function cellPopShare(label) {
  return CELL_MAP[label].reduce((s, st) => s + stAcc[st].formal, 0) / natAcc.formal;
}
// stage B: pool houses per (state, party) with DerSimonian–Laird τ², then shrink
// the across-state distribution toward 0 (partial pooling; τ_s also DL).
function poolDL(obs) {
  const wi = obs.map((o) => 1 / o.v);
  const y = obs.reduce((s, o) => s + o.y / o.v, 0) / wi.reduce((a, b) => a + b, 0);
  const fixedV = 1 / wi.reduce((a, b) => a + b, 0);
  if (obs.length < 2) return { y, v: fixedV, tau2: 0 };
  const q = obs.reduce((s, o) => s + (o.y - y) ** 2 / o.v, 0);
  const df = obs.length - 1;
  const c = wi.reduce((a, b) => a + b, 0) - wi.reduce((a, b) => a + b * b, 0) / wi.reduce((a, b) => a + b, 0);
  const tau2 = Math.max(0, (q - df) / c);
  const wr = obs.map((o) => 1 / (o.v + tau2));
  const yr = obs.reduce((s, o) => s + o.y / (o.v + tau2), 0) / wr.reduce((a, b) => a + b, 0);
  return { y: yr, v: 1 / wr.reduce((a, b) => a + b, 0), tau2 };
}
const stateDev = {}, stateMeta = {};
for (const st of STATE_ORDER) {
  stateDev[st] = {}; stateMeta[st] = {};
  for (const p of P5) {
    const obs = stateObs[st][p];
    if (!obs.length) { stateDev[st][p] = null; continue; }
    const m = poolDL(obs);
    stateMeta[st][p] = { obs, pooled: m };
    stateDev[st][p] = { dev: r2(m.y), se: r2(Math.sqrt(m.v)), houses: obs.map((o) => o.house), compositionOnly: obs.every((o) => o.composite) };
  }
}
// shrink across states per party (each pool point an independent dev_i / V_i)
const tauState = {};
for (const p of P5) {
  const pts = STATE_ORDER.filter((st) => stateDev[st][p]).map((st) => ({ st, y: stateDev[st][p].dev, v: stateMeta[st][p].pooled.v }));
  const m = poolDL(pts);
  const tau2 = Math.max(m.tau2, TAU2_FLOOR);   // a 0 estimate is estimation noise, not certainty
  tauState[p] = tau2;
  for (const q of pts) {
    const shrink = tau2 / (tau2 + q.v);
    const d = stateDev[q.st][p];
    stateMeta[q.st][p].rawDev = d.dev; stateMeta[q.st][p].rawSe = d.se;
    d.dev = r2(d.dev * shrink);
    d.se = r2(d.se * Math.sqrt(shrink));
  }
}

/* ---- 6. β differential swings (Resolve DiD, age + gender only) ---------- */
const baseWave = DEMO.waves.find((w) => w.pollster === BASELINE_HOUSE && w.date === BASELINE_DATE);
const baseSamp = waveSample(baseWave);
const recentResolve = currentWaves.filter((w) => w.pollster === BASELINE_HOUSE);
const beta = {}, betaDiag = {};
for (const dim of BETA_DIMS) {
  const wmap = CELL_W[dim];
  beta[dim] = {}; betaDiag[dim] = { impliedNational: {}, cells: {} };
  for (const [cell, w] of Object.entries(wmap)) {
    beta[dim][cell] = {}; betaDiag[dim].cells[cell] = {};
    for (const p of P5) {
      const cur = poolCells(recentResolve.filter((w2) => w2.dims?.[dim]?.[cell]).map((w2) => {
        const y = w2.dims[dim][cell][key5(p)];
        const { n } = waveSample(w2);
        return { y, v: vShare(y, n * w) };
      }));
      const yB = baseWave.dims[dim][cell][key5(p)];
      const vB = vShare(yB, baseSamp.n * w);
      betaDiag[dim].cells[cell][p] = { yNow: r2(cur.y), yBase: yB, vNow: r2(cur.v), vBase: r2(vB), nWaves: cur.nWaves };
      beta[dim][cell][p] = { d: cur.y - yB, v: cur.v + vB };
    }
  }
  // self-centre: β_{g,p} = Δ_g − Σ_h w_h Δ_h ; var under cell independence.
  // Snapshot d/v first — the writes below would otherwise clobber the next
  // cell's inputs inside the same dim loop.
  for (const p of P5) {
    const snap = Object.fromEntries(Object.entries(wmap).map(([c]) => [c, { d: beta[dim][c][p].d, v: beta[dim][c][p].v }]));
    const meanD = Object.entries(wmap).reduce((s, [c, w]) => s + w * snap[c].d, 0);
    betaDiag[dim].impliedNational[p] = r2(meanD);
    for (const [cell, w] of Object.entries(wmap)) {
      const v = Object.entries(wmap).reduce((s, [c, wc]) => {
        const k = c === cell ? 1 - w : -wc;
        return s + k * k * snap[c].v;
      }, 0);
      beta[dim][cell][p] = { beta: r2(snap[cell].d - meanD), se: r2(Math.sqrt(v)) };
    }
  }
}

/* ---- 7. output ---------------------------------------------------------- */
const out = {
  _about: "W4 of .build/analysis/seat-model-plan.md — vote layer: national nowcast ΔV (gen-data §7e primaryNow vs certified 2025), per-state swing deviations (self-centred per house, DL-pooled, shrunk toward 0), and differential-swing β for age/gender (Resolve difference-in-differences vs its 2025-05-03 baseline wave, self-centred so Σ w_g β_g = 0). lnp = combined Coalition. Deviations/β are pp. NOT ESTIMABLE: education/income/location/housing/generation — no May-2025 baseline wave carries them (the polling-day Resolve wave carries age/gender/state only). Tas/NT/ACT are composition-only. Marginals, not joints; no interaction terms exist for layer 3. Structural uncertainty exceeds everything these SEs express — intervals are floor, not ceiling.",
  _provenance: {
    generated: new Date().toISOString().slice(0, 10),
    inputs: {
      "data/polls.json": sha16("data/polls.json"),
      "data/demographics.json": sha16("data/demographics.json"),
      "data/census-2021-divisions.json": sha16("data/census-2021-divisions.json"),
      "data/seats-2025-baseline.json": sha16("data/seats-2025-baseline.json"),
    },
    genData: { spawnedWith: "GEN_DATA_OUT=<tmp> node .build/newtracker/gen-data.mjs", captured: pnLine },
  },
  national: {
    nowcast, nPolls: N_NOWCAST_POLLS,
    result2025: result2025.national, delta: deltaNat,
    note: "Δ = nowcast − certified 2025, pp, 5-key (lnp combined Coalition). Uncertainty deliberately not printed at this layer: W5 takes the estimator's own within gen-data.",
  },
  states: {
    weights: Object.fromEntries(STATE_ORDER.map((s) => [s, r2(wState[s])])),
    result2025: result2025.states,
    dev: stateDev,
    note: "dev > 0 ⇒ the state's swing since 2025 exceeds the national swing for that party (pp). YouGov's ACT/NT/Tas composite covers Tas/NT/ACT (double variance, compositionOnly). Resolve's Rest of Australia composite is applied to SA/WA/Tas/NT/ACT similarly.",
  },
  beta: {
    dims: beta,
    populationWeights: CELL_W,
    baselineWave: { pollster: BASELINE_HOUSE, date: BASELINE_DATE, sampleInferred: baseSamp.inferred, sample: baseSamp.n },
    recentWaves: recentResolve.map((w) => w.date),
    notEstimable: NO_BASELINE_DIMS,
    note: "β = party's movement in the cell minus its Resolve-implied national movement (weighted mean over the dim's cells), pp. Resolve-only difference-in-differences vs 2025-05-03; the identity Σ w_g β_g = 0 holds per dim+party.",
  },
  diagnostics: {
    recentWindow: { from: recentFrom, to: latestWave, waves: currentWaves.map((w) => `${w.pollster} ${w.date}`) },
    resolveImpliedNational: Object.fromEntries(BETA_DIMS.map((d) => [d, betaDiag[d].impliedNational])),
    cellDetail: betaDiag,
    stateDetail: Object.fromEntries(STATE_ORDER.map((st) => [st, Object.fromEntries(P5.map((p) => [p, stateMeta[st][p] ? {
      rawDev: stateMeta[st][p].rawDev ?? null, rawSe: stateMeta[st][p].rawSe ?? null,
      obs: (stateMeta[st][p].obs ?? []).map((o) => `${o.house}:${o.label} ${r2(o.y)}±${r2(Math.sqrt(o.v))}`),
    } : null]))])),
  },
};
const { writeFileSync } = await import("node:fs");
writeFileSync("data/seat-vote-layer.json", JSON.stringify(out, null, 1) + "\n");

/* ---- 8. console report --------------------------------------------------- */
console.log("W4 vote layer —", latestWave, "(window from", recentFrom + ")", "\n");
console.log("NATIONAL (5-key, pp):   nowcast vs 2025 → Δ");
for (const p of P5) console.log(`  ${p.padEnd(4)} ${nowcast[p].toFixed(1)} vs ${result2025.national[p].toFixed(1)} → ${deltaNat[p] >= 0 ? "+" : ""}${deltaNat[p].toFixed(1)}  (n=${N_NOWCAST_POLLS} polls)`);
console.log("\nSTATE deviations vs national swing (shrunk; raw in diagnostics):");
for (const st of STATE_ORDER) {
  const row = P5.filter((p) => stateDev[st][p]).map((p) => `${p} ${stateDev[st][p].dev >= 0 ? "+" : ""}${stateDev[st][p].dev}±${stateDev[st][p].se}`)
    .join("  ");
  console.log(`  ${st}${st.length === 3 ? "" : " "}  ${row}`);
}
console.log("\nβ differential swings (Resolve DiD vs 2025-05-03; Σwβ=0 by construction):");
for (const dim of BETA_DIMS) {
  console.log(`  ${dim}:`);
  for (const cell of Object.keys(beta[dim]))
    console.log(`    ${cell.padEnd(8)}` + P5.map((p) => `${p} ${beta[dim][cell][p].beta >= 0 ? "+" : ""}${beta[dim][cell][p].beta}±${beta[dim][cell][p].se}`).join("  "));
  console.log(`    implied national movement (diag): ` + P5.map((p) => `${p} ${betaDiag[dim].impliedNational[p] >= 0 ? "+" : ""}${betaDiag[dim].impliedNational[p]}`).join("  "));
}
console.log("\nNOT ESTIMABLE (no May-2025 baseline wave):", NO_BASELINE_DIMS.join(", "));
if (baseSamp.inferred) console.log(`baseline wave sample inferred: median ${BASELINE_HOUSE} n=${baseSamp.n}`);
console.log("\nwrote data/seat-vote-layer.json");
