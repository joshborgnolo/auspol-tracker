#!/usr/bin/env node
/* test-swing-simulate.mjs — W5 invariants over the committed
   data/seat-model-2028-nowcast.json plus the engine's own null-mode GES
   replay (run small: null draws are deterministic).

   Run from the repo root:
     node .build/analysis/seat-model/test-swing-simulate.mjs */
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const OUT = "data/seat-model-2028-nowcast.json";
const HISTORY = "data/seat-model-2028-history.jsonl";
const SCRIPT = ".build/analysis/seat-model/swing-simulate.mjs";
const INPUTS = [
  "data/seat-vote-layer.json",
  "data/aec-2025-seat-flows.json",
  "data/seat-candidate-set-2028.json",
  "data/census-2021-divisions-2025.json",
  "data/polls.json",
];
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
for (const p of P5) check(`sigmaNat.${p} positive`, S.meta.sigmaNat[p] > 0);

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
for (const k of ["alp", "coalition", "noMajority"])
  check(`majority.${k} in [0,1]`, mj[k] >= 0 && mj[k] <= 1, String(mj[k]));
check("majority props sum to 1",
  Math.abs(mj.alp + mj.coalition + mj.noMajority - 1) <= 0.02,
  String(mj.alp + mj.coalition + mj.noMajority));

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

/* ---- 3. null-mode GES replay (deterministic - small draw count) -------- */
const nullOut = join(tmpdir(), "auspol-sim-null-test.json");
const log = execFileSync(process.execPath, [SCRIPT], {
  env: { ...process.env, AUSPOL_SIM_NULL: "1", AUSPOL_SIM_OUT: nullOut, AUSPOL_SIM_DRAWS: "250" },
  encoding: "utf8", maxBuffer: 1 << 24,
});
const m = log.match(/2025 winners reproduced: (\d+)\/150/);
check("null-mode replay line printed", !!m, log.slice(-400));
if (m) check("null mode reproduces all 150 winners", +m[1] === 150, m[1] + "/150");
if (existsSync(nullOut)) {
  const N = JSON.parse(readFileSync(nullOut, "utf8"));
  check("null output carries the same structural shape",
    N.seats.length === 150 && N.meta.draws === 250 && !!N.national.expectedSeats);
}

if (failures) { console.error(`${failures} failures`); process.exit(1); }
console.log(`sim OK: ${S.meta.draws.toLocaleString()} draws · expected ${Object.entries(es).map(([g, v]) => `${g} ${v}`).join("/")} · majority ALP ${(100 * mj.alp).toFixed(1)}% · classic 2PP ${tp.meanAlp}% [${tp.p10}-${tp.p90}] · null replay 150/150`);
