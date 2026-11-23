/* Raw Gallup undecided history: the 25 verified Trove readings, their model
   eligibility and the raw-dot range. Run after the importer and model build. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const W = JSON.parse(readFileSync("data/undecided-history.json", "utf8"));
const M = JSON.parse(readFileSync("data/undecided-history-model.json", "utf8"));
const gallup = W.waves.filter((w) => w.house === "APOP Gallup" || w.house === "Morgan Gallup");
assert.equal(gallup.length, 25, "all and only the source's explicit undecided cells");
assert.equal(W.waves.length, 1144);
for (const w of gallup) {
  assert.equal(w.basis, "first", `${w.end}: raw first-preference question`);
  assert.ok(["printed-month", "publication-week"].includes(w.dateBasis), `${w.end}: unasserted fieldwork dates stay dated by publication convention`);
  assert.ok(w.src.includes(w.house === "Morgan Gallup" ? "trove.nla.gov.au/newspaper/article/110622456" : "trove.nla.gov.au/newspaper/article/"), `${w.end}: primary Trove citation`);
  assert.ok(w.und > 0 && w.und < 30, `${w.end}: a real printed value, not a missing/residual cell`);
}
for (const [date, und] of [
  ["1946-06-15", 11], ["1946-07-15", 14], ["1949-05-15", 16],
  ["1951-04-22", 7], ["1954-05-23", 5], ["1972-11-15", 6],
]) {
  const w = gallup.find((w) => w.end === date);
  assert.ok(w, `${date}: Gallup wave present`);
  assert.equal(w.und, und, `${date}: Trove value`);
}
const troveTerms = M.terms.filter((t) => t.year < 2000);
assert.deepEqual(troveTerms.map((t) => [t.year, t.series.first.n]), [[1949, 5], [1954, 10], [1955, 4]],
  "only the stronger runs meet the model's four-wave threshold");
for (const t of troveTerms) {
  assert.deepEqual(t.series.first.houses, ["APOP Gallup"]);
  assert.ok(!t.series.leaner, "raw first-preference readings are not relabelled as after-leaner values");
}
const out = execFileSync(process.execPath, [".build/assimilate-trove-undecided.mjs"], { encoding: "utf8" });
assert.ok(out.includes("25 verified Trove undecided waves, 0 new, 25 already present"), "rerunning the importer is an idempotent no-op");
const renderer = readFileSync(".build/newtracker/assets/rd-panels.jsx", "utf8");
assert.ok(renderer.includes(".concat(H ? H.polls.map((p) => p.x) : [])"),
  "isolated dots before the oldest fitted line stay reachable in the history range");

console.log(`test-trove-undecided: OK (${gallup.length} raw Gallup waves, new model terms ${troveTerms.map((t) => t.year).join(", ")})`);
