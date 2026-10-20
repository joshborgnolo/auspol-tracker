/* test-state-flows.mjs – pins the state flow estimates on the preference
   flows explainer's chart (user call 2026-10-20): the states are the
   two-class pile model's ESTIMATES (data/state-flows-est.csv, written by
   .build/estimate-state-flows.py), never the parsers' blended replay; only
   elections whose counts reached a Labor v Coalition final in at least 40
   seats, and only the Greens and others lines, reach the chart, each point
   with its 90% error; the federal back-test that justifies them rides
   flowHistory.fed.backtest for the Info entry, and must keep showing the
   model beating the replay it replaced.
   Runs after the build in npm test's chain (the data asset only reflects the
   current dataset post-build). */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MIN_CLASSIC = 40;

// ---- the estimator's outputs -----------------------------------------------
const csv = fs.readFileSync(path.join(ROOT, "data", "state-flows-est.csv"), "utf8").trim().split(/\r?\n/);
const head = csv.shift().split(",");
assert.deepEqual(head, ["jurisdiction", "year", "party", "est_alp_votes", "est_coal_votes", "est_flow_to_alp", "err90", "n_classic"],
  "state-flows-est.csv keeps its column contract");
const rows = csv.map((ln) => Object.fromEntries(ln.split(",").map((v, i) => [head[i], v])));
const bt0 = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "state-flows-backtest.json"), "utf8"));
for (const r of rows) {
  assert.ok(["grn", "onp", "oth"].includes(r.party), `only crossbench buckets are estimated (${r.party})`);
  if (r.est_flow_to_alp === "") continue;
  const f = +r.est_flow_to_alp;
  assert.ok(f >= 0 && f <= 1, `${r.jurisdiction} ${r.year} ${r.party}: a share (${f})`);
  // below the calibration's smallest seat count the error was never measured:
  // such an estimate carries none (and gen-data never draws it)
  if (+r.n_classic < Math.min(...bt0.settings.cal_n)) {
    assert.equal(r.err90, "", `${r.jurisdiction} ${r.year} ${r.party}: no untested error figure at ${r.n_classic} seats`);
  } else {
    assert.ok(+r.err90 > 0 && +r.err90 < 15, `${r.jurisdiction} ${r.year} ${r.party}: an error figure (${r.err90})`);
  }
}
const bt = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "state-flows-backtest.json"), "utf8"));
assert.equal(Object.keys(bt.federal).length, 6, "the back-test covers the six federal elections 2010-2025");
for (const N of bt.settings.cal_n) assert.ok(bt.calibration[String(N)], `calibration has its ${N}-seat row`);

// ---- what the chart is handed ----------------------------------------------
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(
  path.join(ROOT, ".build", "newtracker", "assets", "9f09dca2-bd46-49a8-8ae1-51847608cf92.js"), "utf8"),
sandbox, { filename: "9f09dca2.js" });
// (the sandbox's arrays carry its own realm's prototype: spread before a
// strict deep comparison)
const FH = sandbox.window.AUSPOL.flowHistory;
const shown = {};
for (const r of rows) {
  if (+r.n_classic >= MIN_CLASSIC && ["grn", "oth"].includes(r.party) && r.est_flow_to_alp !== "") {
    (shown[r.jurisdiction] ||= new Set()).add(+r.year);
  }
}
assert.deepEqual(Object.keys(FH).filter((k) => k !== "fed").sort(), Object.keys(shown).sort(),
  "exactly the jurisdictions with an election of 40+ classic seats get a chip");
assert.ok(!FH.nt, "the Northern Territory's small counts stay off the chart");
assert.deepEqual([...FH.vic.years], [2022], "Victoria shows 2022 alone (its 2006-18 counts stopped at a majority)");
for (const [k, S] of Object.entries(FH)) {
  if (k === "fed") continue;
  assert.equal(S.estimated, true, `${k} is drawn as an estimate`);
  assert.deepEqual([...S.years], [...shown[k]].sort((a, b) => a - b), `${k}: the years the rule allows`);
  assert.ok(S.onp.every((v) => v == null), `${k}: no One Nation line for a state`);
  for (const b of ["grn", "oth"]) {
    S[b].forEach((v, i) => {
      if (v == null) return;
      assert.ok(v > 0 && v < 100, `${k} ${S.years[i]} ${b}: a percentage`);
      assert.ok(S[b + "Err"][i] > 0, `${k} ${S.years[i]} ${b}: carries its 90% error`);
      const row = rows.find((r) => r.jurisdiction === k && +r.year === S.years[i] && r.party === b);
      assert.equal(v, Math.round(+row.est_flow_to_alp * 1000) / 10, `${k} ${S.years[i]} ${b}: the estimator's figure`);
    });
  }
}
const B = FH.fed.backtest;
assert.ok(B && B.elections === 6, "the federal back-test rides fed.backtest");
assert.ok(B.grn.model < B.grn.replay && B.oth.model < B.oth.replay,
  "the model still beats the replay it replaced, Greens and others alike");
assert.ok(B.grn.model <= 1.5, `the Greens estimate stays within 1.5 points of the federal counts on average (${B.grn.model})`);
assert.ok(B.qld != null && B.qld <= 2, `Queensland's counted flows within 2 points (${B.qld})`);

// ---- the renderer and the Info entry ---------------------------------------
const ap = fs.readFileSync(path.join(ROOT, ".build", "newtracker", "assets", "rd-allpolls.jsx"), "utf8");
assert.ok(ap.includes("\"Estimated from \" + S.srcAs"), "a state's caption calls it an estimate");
assert.ok(!ap.includes("\"Counted from \" + S.srcAs"), "no state is captioned as counted");
assert.ok(ap.includes("<RdHow term=\"flow-history\""), "the chart's How it's built opens its Info entry");
const info = fs.readFileSync(path.join(ROOT, ".build", "newtracker", "assets", "d1a1d215-370c-4ebc-878b-7eeea9ad8102.js"), "utf8");
assert.ok(info.includes("{ id: \"flow-history\", term: \"Counted and estimated flows\""), "the Info entry exists");

console.log(`PASS: state flows – ${Object.keys(shown).length} states as estimates (${Object.entries(shown).map(([k, s]) => k + " " + s.size).join(", ")}), `
  + `back-test Greens ${B.grn.model} v replay ${B.grn.replay}, others ${B.oth.model} v ${B.oth.replay}, Queensland within ${B.qld}`);
