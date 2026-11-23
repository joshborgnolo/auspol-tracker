/* Pins the primaries' past terms on the model (data/vote-history-model.json,
   .build/build-vote-history.mjs): current with its inputs (data/polls.json's
   elections, cyclePolls and cyclePollBases – gen-data falls back to monthly
   averages when it is not), no share below zero, and both calibrated and
   unadjusted uncertainty bands that stop at zero.
   Run: node .build/test-vote-history-model.mjs */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const D = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "polls.json"), "utf8"));
const M = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "vote-history-model.json"), "utf8"));
const input = createHash("sha1").update(JSON.stringify({ e: D.elections, c: D.cyclePolls, b: D.cyclePollBases })).digest("hex").slice(0, 12);
assert.equal(M.input, input, "data/vote-history-model.json is stale: run node .build/build-vote-history.mjs");
assert.ok(M.terms.length >= 30, "every past term since 1943");
let pts = 0;
for (const t of M.terms) {
  assert.ok(t.a < t.b && t.year < t.src, `term ${t.year}: opening before closing`);
  for (const k of t.lanes) {
    assert.ok(t.open[k] != null && t.close[k] != null, `term ${t.year} ${k}: both counts`);
    for (const [x, v, raw, ci, n, rawCi] of t.series[k]) {
      pts++;
      assert.ok(x > t.a && x < t.b, `term ${t.year} ${k} ${x}: inside the term`);
      assert.ok(v >= 0 && raw >= 0, `term ${t.year} ${k} ${x}: no share below zero (${v})`);
      assert.ok(ci >= 0 && ci <= v + 1e-9, `term ${t.year} ${k} ${x}: the calibrated band stops at zero`);
      assert.ok(Number.isFinite(rawCi) && rawCi >= 0 && rawCi <= raw + 1e-9, `term ${t.year} ${k} ${x}: the unadjusted band is present and stops at zero`);
      assert.ok(n > 0, `term ${t.year} ${k} ${x}: the month's poll count survives the interval field`);
    }
  }
}
console.log(`PASS: vote history model – ${M.terms.length} past terms, ${pts} month points, none below zero, both intervals present and current with its inputs`);
