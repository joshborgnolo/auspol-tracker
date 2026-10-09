/* test-flow-splits.mjs – pins the /preference-flows/ "forced to choose"
   section (shipped 2026-10-10): build.mjs emits assets/flow-splits.json from
   polls.json's RedBridge/Accent tpp_split/tpp_split_on rows verbatim, and the
   page carries the section, its two figure mounts and the inline fetch. Runs
   after the build in npm test's chain (the JSON only exists post-build). */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// ---- the JSON contract ---------------------------------------------------------------
const js = JSON.parse(fs.readFileSync(path.join(ROOT, "assets", "flow-splits.json"), "utf8"));
assert.ok(Array.isArray(js.waves) && js.waves.length >= 6, "flow-splits.json carries the RedBridge split waves");
assert.equal(typeof js.house, "string", "the house is named");
assert.ok(js.latestPublished, "latestPublished is set");

const polls = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "polls.json"), "utf8"));
const src = polls.polls.filter((r) => r.pollster === "RedBridge/Accent" && (r.tpp_split || r.tpp_split_on));
assert.equal(js.waves.length, src.length, "every tpp_split RedBridge row is exported");
const byDate = new Map(src.map((r) => [r.date, r]));
for (const w of js.waves) {
  assert.ok(w.wave && w.date && w.sample > 0, `${w.date || "?"}: labelled and sampled`);
  assert.deepEqual(w.split ?? null, byDate.get(w.date).tpp_split ?? null, `${w.date}: split is verbatim`);
  assert.deepEqual(w.splitOn ?? null, byDate.get(w.date).tpp_split_on ?? null, `${w.date}: split_on is verbatim`);
  for (const [obj, buckets] of [[w.split, ["grn", "onp", "oth"]], [w.splitOn, ["lnp", "grn", "oth"]]]) {
    if (!obj) continue;
    for (const b of buckets)
      assert.ok(typeof obj[b] === "number" && obj[b] >= 0 && obj[b] <= 100, `${w.date}: ${b} share is 0–100`);
  }
}
/* the charts read splitOn.lnp and split.onp; the latest wave must have both,
   or the big bars have nothing to draw */
const latest = js.waves[js.waves.length - 1];
assert.ok(latest.splitOn && typeof latest.splitOn.lnp === "number", "latest wave carries the Coalition-voter split");
assert.ok(latest.split && typeof latest.split.onp === "number", "latest wave carries the One Nation-voter split");

// ---- the page wiring -----------------------------------------------------------------
const page = fs.readFileSync(path.join(ROOT, "preference-flows", "index.html"), "utf8");
assert.ok(page.includes('<h2 id="forced">'), "the #forced section exists");
assert.ok(page.includes('href="#forced"'), "the contents list links it");
assert.equal(page.split('id="fsq-').length - 1, 2, "exactly the two figure mounts");
assert.ok(page.includes('id="fsq-lnp"') && page.includes('id="fsq-onp"'), "both figure mounts are present");
assert.ok(page.includes('fetch("/assets/flow-splits.json"'), "the page fetches the data file");
assert.ok(page.includes('"splitOn", "lnp"') && page.includes('"split", "onp"'),
  "the renderer reads the same two splits the headlines make claims about");
assert.ok(page.includes("Coalition voters say they") && page.includes("One Nation voters say they"),
  "the two figure headlines are in place");
console.log("test-flow-splits: ok");
