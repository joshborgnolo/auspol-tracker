#!/usr/bin/env node
/* test-swing-simulate.mjs — seat model v2 invariants over the committed
   data/seat-model-2028-nowcast.json and -forecast.json, the Senate-ranking flow layer, and the
   replay check: the certified 2025 primaries counted on the modelled flows must reproduce at least
   146 of 150 winners (147 at commit; W5's GES invariant replayed certified count rows instead).

   Run from the repo root:
     node .build/analysis/seat-model/test-swing-simulate.mjs */
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cohortTable, routing, moveFirst } from "./senate-flows.mjs";
import { loadRankings } from "./senate-io.mjs";

const OUT = "data/seat-model-2028-nowcast.json";
const HISTORY = "data/seat-model-2028-history.jsonl";
const SCRIPT = ".build/analysis/seat-model/swing-simulate.mjs";
const INPUTS = [
  "data/seat-vote-layer.json", "data/aec-2025-seat-flows.json", "data/seat-candidate-set-2028.json",
  "data/census-2021-divisions-2025.json", "data/senate-rankings-2025.json", "data/seat-model-flow-calibration.json",
  "data/seat-model-calibration.json", "data/seat-model-backtest-states.json", "data/vote-switching.json", "map/data/res-2025.json",
  ".build/analysis/seat-model/seat-engine.mjs", ".build/analysis/seat-model/senate-flows.mjs", ".build/analysis/seat-model/seat-build.mjs",
  ".build/analysis/seat-model/model-sim.mjs", ".build/analysis/seat-model/seat-inputs.mjs",
  "data/house-incumbency.json", "map/data/res-2022.json", ".build/analysis/seat-model/swing-fit.mjs",
];
const FORECAST = "data/seat-model-2028-forecast.json";
const P5 = ["alp", "lnp", "on", "grn", "oth"];

let failures = 0;
const check = (label, ok, detail = "") => {
  if (!ok) { failures++; console.error(`FAIL ${label}${detail ? " — " + detail : ""}`); }
};

/* ---- 1. the committed nowcast ---------------------------------------- */
const S = JSON.parse(readFileSync(OUT, "utf8"));

// provenance: every input named, 16-hex sha matches the live file
check("provenance has all inputs",
  INPUTS.every((f) => S._provenance.inputs[f]));
for (const [f, sha] of Object.entries(S._provenance.inputs))
  check(`provenance sha ${f}`,
    createHash("sha256").update(readFileSync(f)).digest("hex").slice(0, 16) === sha, sha);

// meta/structure
check("draws >= 10,000", S.meta.draws >= 10000, String(S.meta.draws));
check("150 seats", S.seats.length === 150, String(S.seats.length));
for (const p of P5) check(`sigmaNational.${p} positive`, S.meta.sigmaNational[p] > 0);
for (const p of P5) check(`sigmaSeat.${p} positive`, S.meta.sigmaSeat[p] > 0);
check("engine v2.2", S._provenance.engine === "v2.2");
for (const [g, h] of Object.entries(S.national.histogram)) check(`${g} histogram counts every draw`, h.reduce((a, b) => a + b, 0) === S.meta.draws, String(h.reduce((a, b) => a + b, 0)));
for (const seat of S.seats) check(`${seat.name} has a central projection`, !!seat.central && !!seat.central.w);

// expected seats: non-negative, sum to 150
const es = S.national.expectedSeats;
let esSum = 0;
for (const [g, v] of Object.entries(es)) {
  check(`expectedSeats.${g} non-negative`, v >= 0, String(v));
  esSum += v;
}
check("expectedSeats sum to 150", Math.abs(esSum - 150) <= 0.5, String(esSum));

// majority: three disjoint exhaustive outcomes share the draw budget
const mj = S.national.majority;
for (const k of ["alp", "coalition", "on", "noMajority"])
  check(`majority.${k} in [0,1]`, mj[k] >= 0 && mj[k] <= 1, String(mj[k]));
check("majority props sum to 1",
  Math.abs(mj.alp + mj.coalition + mj.on + mj.noMajority - 1) <= 0.02,
  String(mj.alp + mj.coalition + mj.on + mj.noMajority));
// seat distribution quantiles ordered
for (const [g, d] of Object.entries(S.national.seatDistribution)) check(`${g} quantiles ordered`, d.p05 <= d.p25 && d.p25 <= d.p50 && d.p50 <= d.p75 && d.p75 <= d.p95, JSON.stringify(d));

// classic 2PP: ALP share inside [0,100], mean inside its own p10-p90 band
const tp = S.national.twoPartyClassic;
for (const k of ["meanAlp", "p10", "p90"]) {
  check(`2PP ${k} in [0,100]`, tp[k] >= 0 && tp[k] <= 100, String(tp[k]));
}
check("2PP p10 <= mean <= p90", tp.p10 <= tp.meanAlp + 1e-9 && tp.meanAlp <= tp.p90 + 1e-9,
  `${tp.p10} <= ${tp.meanAlp} <= ${tp.p90}`);

// per-seat win/final-pair marginals each sum to 1; probabilities in range
for (const seat of S.seats) {
  const wSum = Object.values(seat.win).reduce((a, b) => a + b, 0);
  const fSum = Object.values(seat.finalPairs).reduce((a, b) => a + b, 0);
  check(`${seat.name} win sums to 1`, Math.abs(wSum - 1) <= 0.01, String(wSum));
  check(`${seat.name} finalPairs sum to 1`, Math.abs(fSum - 1) <= 0.01, String(fSum));
  for (const [g, p] of Object.entries(seat.win))
    check(`${seat.name} win[${g}] in [0,1]`, p >= 0 && p <= 1, String(p));
  for (const [pair, p] of Object.entries(seat.finalPairs)) {
    check(`${seat.name} pair '${pair}' well-formed`,
      pair.split("|").length === 2 && pair.split("|").every(Boolean));
    check(`${seat.name} finalPairs['${pair}'] in [0,1]`, p >= 0 && p <= 1, String(p));
  }
}

/* ---- 2. history --------------------------------------------------------- */
check("history exists", existsSync(HISTORY));
if (existsSync(HISTORY)) {
  const recs = readFileSync(HISTORY, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
  const dates = new Set();
  for (const r of recs) {
    check(`history ${r.date} unique date`, !dates.has(r.date), r.date);
    dates.add(r.date);
    check(`history ${r.date} has expectedSeats/majority/seats`,
      !!r.expectedSeats && !!r.majority && !!r.seats);
    const hSum = [...P5, "member"].reduce((s, g) => s + r.expectedSeats[g], 0);
    check(`history ${r.date} expectedSeats sum to 150`,
      Math.abs(hSum - 150) <= 0.5, String(hSum));
  }
}

/* ---- 2b. the Senate-ranking flow layer -------------------------------------- */
{
  const R = loadRankings(2025);
  check("150 divisions in the 2025 Senate tables", Object.keys(R.div).length === 150, String(Object.keys(R.div).length));
  for (const key of ["ALP", "COAL", "GRN", "ON", "OTH:TOP", "OTH-M"]) {
    const p = cohortTable(R, "Hunter", key), t = p.reduce((a, b) => a + b, 0);
    check(`cohort table ${key} is a distribution`, Math.abs(t - 1) < 1e-9, String(t));
    const { F, G } = routing(R, p);
    for (let S = 1; S < 16; S++) { let f = 0; for (let y = 0; y < 4; y++) f += F[S * 4 + y]; check(`F rows sum to 1 (${key}, S=${S})`, Math.abs(f - 1) < 1e-9, String(f)); }
    for (let x = 0; x < 4; x++) for (let S = 1; S < 16; S++) { if ((S >> x) & 1) continue; let g = 0; for (let y = 0; y < 4; y++) g += G[(x * 16 + S) * 4 + y]; check(`G rows sum to 1 (${key}, x=${x}, S=${S})`, Math.abs(g - 1) < 1e-9, String(g)); }
  }
  // switchers: moving One Nation first must put every ballot's first named family at O
  const m = moveFirst(R, cohortTable(R, "Hunter", "COAL"), 3), { F } = routing(R, m);
  check("moveFirst puts One Nation first", Math.abs(F[15 * 4 + 3] - 1) < 1e-9, String(F[15 * 4 + 3]));
}
/* ---- 2c. the zero-One-Nation-state graft (ACT: no Senate ticket, so no ACT ballot ranks O) -- */
{
  const R = loadRankings(2025);
  const raw = JSON.parse(readFileSync("data/senate-rankings-2025.json", "utf8"));
  const L = R.P.length, oAt = R.P.map((p) => p.includes("O"));
  /* One Nation ran no ACT Senate ticket in our four years, and no NT one before 2025 - those are
     the tables the graft fires on; read the raw files so the check survives the grafted tables */
  check("the only no-Senate-One-Nation states are ACT (+NT to 2022)", [2016, 2019, 2022, 2025].every((y) => {
    const j = JSON.parse(readFileSync(`data/senate-rankings-${y}.json`, "utf8"));
    const P = j.patterns, noO = new Set(Object.values(j.divisions).map((d) => d.st));
    for (const d of Object.values(j.divisions)) for (const sparse of Object.values(d.t))
      for (const [k, n] of Object.entries(sparse)) if (n > 0 && P[+k].includes("O")) { noO.delete(d.st); break; }
    return [...noO].sort().join(",") === (y < 2025 ? "ACT,NT" : "ACT");
  }), "");
  /* grafted ACT tables: cohort masses preserved, every O-free routing row identical to the raw
     file's rows, and real mass lands on O-naming patterns */
  for (const key of ["ALP", "COAL:LIB", "GRN"]) {
    const sparse = raw.divisions.Canberra.t[key];
    if (!sparse) { check(`Canberra raw cohort ${key} exists`, false, "no such cohort key in the file"); continue; }
    const vRaw = new Float64Array(L);
    let tRaw = 0;
    for (const [k, n] of Object.entries(sparse)) { vRaw[+k] = n; tRaw += n; }
    const vAct = R.div.Canberra.t[key];
    const tAct = vAct.reduce((a, b) => a + b, 0);
    check(`ACT graft preserves mass (${key})`, Math.abs(tAct - tRaw) < 1e-6 * Math.max(tRaw, 1), `${tRaw} -> ${tAct}`);
    const oMass = vAct.reduce((a, x, i) => a + (oAt[i] ? x : 0), 0) / tAct;
    check(`ACT graft puts real mass on O patterns (${key})`, oMass > 0.01, oMass.toFixed(3));
    const r0 = routing(R, vRaw), r1 = routing(R, vAct);
    let maxD = 0;
    for (let S = 1; S < 16; S++) { if (S & 8) continue; for (let y = 0; y < 4; y++) maxD = Math.max(maxD, Math.abs(r0.F[S * 4 + y] - r1.F[S * 4 + y])); }
    check(`ACT graft leaves O-free routing rows untouched (${key})`, maxD < 1e-9, maxD.toExponential(2));
  }
  /* the point of it: the ACT's assumed One Nation candidates take real Coalition transfers */
  const { F: coalF } = routing(R, cohortTable(R, "Bean", "COAL"));
  check("ACT Coalition tables route 20-80% of a pile to One Nation over Labor",
    coalF[0b1001 * 4 + 3] > 0.2 && coalF[0b1001 * 4 + 3] < 0.8,
    `{A,O} -> O = ${(100 * coalF[0b1001 * 4 + 3]).toFixed(1)}%`);
}
{
  const Fc = JSON.parse(readFileSync(FORECAST, "utf8"));
  check("forecast file: 150 seats, engine v2.2, forecast mode", Fc.seats.length === 150 && Fc._provenance.engine === "v2.2" && Fc.meta.mode === "forecast");
  const fs = Object.values(Fc.national.expectedSeats).reduce((a, b) => a + b, 0);
  check("forecast expectedSeats sum to 150", Math.abs(fs - 150) <= 0.5, String(fs));
}

/* ---- 3. replay: certified 2025 primaries counted on the modelled flows ------ */
const replayOut = join(tmpdir(), "auspol-sim-replay-test.json");
const log = execFileSync(process.execPath, [SCRIPT], {
  env: { ...process.env, AUSPOL_SIM_MODE: "replay", AUSPOL_SIM_OUT: replayOut },
  encoding: "utf8", maxBuffer: 1 << 24,
});
const m = log.match(/winners reproduced: (\d+)\/150; final pair right in (\d+)\/150/);
check("replay line printed", !!m, log.slice(-400));
if (m) {
  check("replay reproduces at least 146 of 150 winners", +m[1] >= 146, m[1] + "/150");
  check("replay gets at least 135 final pairs", +m[2] >= 135, m[2] + "/150");
}

if (failures) { console.error(`${failures} failures`); process.exit(1); }
console.log(`sim OK (v2.2): ${S.meta.draws.toLocaleString()} draws · expected ${Object.entries(es).map(([g, v]) => `${g} ${v}`).join("/")} · majority ALP ${(100 * mj.alp).toFixed(1)}% · classic 2PP ${tp.meanAlp}% [${tp.p10}-${tp.p90}] · replay ${m ? m[1] + "/150 winners, " + m[2] + "/150 pairs" : "?"}`);
