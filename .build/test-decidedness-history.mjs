/* Resolve and RedBridge decidedness history: canonical source figures, the
   idempotent backfill writers, and the built per-term payload. Run after a
   build (npm test does), so the 9f09dca2 bundle includes decidednessHistory. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";

const D = JSON.parse(readFileSync("data/polls.json", "utf8"));
const past = Object.values(D.cyclePolls).flat();
const resolve = past.filter((p) => p.firm === "Resolve Strategic");
assert.equal(resolve.length, 47);
assert.equal(resolve[0].date, "2021-04-16", "Resolve's first published wave");
assert.equal(resolve.at(-1).date, "2025-04-28", "the current-term block owns later waves");
for (const p of resolve) {
  assert.ok(Number.isFinite(p.soft) && p.soft >= 0 && p.soft <= 60, `${p.date}: national soft share`);
  assert.deepEqual(Object.keys(p.softAge || {}).sort(), ["18-34", "35-54", "55+"].sort(), `${p.date}: all age bands`);
  for (const v of Object.values(p.softAge)) assert.ok(Number.isFinite(v) && v >= 0 && v <= 100, `${p.date}: finite age share`);
}
for (const [date, soft, softAge] of [
  ["2021-04-16", 21, { "18-34": 26, "35-54": 23, "55+": 16 }],
  ["2022-04-16", 27, { "18-34": 35, "35-54": 33, "55+": 16 }],
  ["2023-08-13", 26, { "18-34": 35, "35-54": 30, "55+": 17 }],
  ["2025-04-28", 19, { "18-34": 26, "35-54": 23, "55+": 11 }],
]) {
  const p = resolve.find((p) => p.date === date);
  assert.equal(p.soft, soft, `${date}: intact Resolve feed value`);
  assert.deepEqual(p.softAge, softAge, `${date}: intact age values`);
}

const red = D.cyclePolls["2025"].filter((p) => p.firmness);
assert.equal(red.length, 6, "three original 2024 charts plus three retrospective 2025 waves");
const at = (date) => red.find((p) => p.date === date);
assert.equal(at("2024-04-21").firmness.alp[2], null, "an unprinted April third label is not a residual");
assert.equal(at("2024-04-21").firmness.all, undefined, "April publishes no all-voters row");
assert.equal(at("2024-04-21").sampleEff, 1270);
assert.deepEqual(at("2024-07-19").firmness.alp, [47, 39, 14]);
assert.equal(at("2024-07-19").firmness.onp, undefined, "July folds One Nation into Other rather than inventing a cohort");
assert.deepEqual(at("2024-11-13").firmness, {
  alp: [44, 46, 10], lnp: [62, 31, 7], grn: [42, 52, 6], oth: [43, 41, 16],
});
assert.equal(at("2024-11-13").sample, 2011);
assert.equal(at("2024-11-13").sampleEff, 1538);
assert.equal(D.cyclePolls["2025"].find((p) => p.date === "2024-11-20").firmness, undefined,
  "the unmatched later restatement is not attached to the MRP-era row");
for (const [date, first, other, dateStart, sample] of [
  ["2025-02-07", 7, 11, "2025-02-03", 1013],
  ["2025-03-11", 7, 12, "2025-03-03", 2007],
  ["2025-04-29", 8, 12, "2025-04-24", 1011],
]) {
  const p = at(date);
  assert.equal(p.onp, first, `${date}: the report's sum-preserving One Nation split`);
  assert.equal(p.oth, other);
  assert.equal(p.dateStart, dateStart);
  assert.equal(p.sample, sample);
  assert.ok(p.firmnessSource && p.firmnessNote, `${date}: retrospective provenance follows the figures`);
}
assert.deepEqual(at("2025-02-07").firmness.all, [53, 38, 9]);
assert.deepEqual(at("2025-03-11").firmness.lnp, [65, 29, 6]);
assert.deepEqual(at("2025-04-29").firmness.all, [68, 26, 6]);
for (const p of red) {
  for (const [group, triple] of Object.entries(p.firmness)) {
    assert.equal(triple.length, 3, `${p.date} ${group}: category width`);
    assert.ok(triple.slice(0, 2).every(Number.isFinite), `${p.date} ${group}: printed leading categories`);
    if (triple[2] != null) assert.ok(Math.abs(triple.reduce((a, v) => a + v, 0) - 100) <= 2, `${p.date} ${group}: printed sum`);
  }
}

for (const [script, marker] of [
  [".build/assimilate-resolve-soft.mjs", "(0 gain or change a value)"],
  [".build/assimilate-redbridge-firmness.mjs", "filled 0"],
]) {
  const out = execFileSync(process.execPath, [script], { encoding: "utf8" });
  assert.ok(out.includes(marker), `${script}: dry run is an idempotent no-op`);
}

const asset = `.build/newtracker/assets/${readdirSync(".build/newtracker/assets").find((f) => f.startsWith("9f09dca2-") && f.endsWith(".js"))}`;
const w = {};
new Function("window", readFileSync(asset, "utf8"))(w);
const H = w.AUSPOL.decidednessHistory;
/* one soft line per pollster and term since 2026-11-23 (never an average
   of Resolve and RedBridge); RedBridge's three pre-election waves are dots */
assert.deepEqual(H.soft.terms.map((t) => [t.year, t.id, t.polls.length]), [[2022, "soft", 14], [2025, "soft", 33], [2025, "softRB", 3]]);
assert.ok(H.soft.terms.every((t) => t.polls.every((p) => p.basis === t.id)), "each term's polls are its pollster's own");
assert.equal(H.soft.terms.find((t) => t.id === "softRB").monthly.length, 0, "three polls draw no line");
assert.deepEqual(H.softAge.terms.map((t) => [t.year, t.waves.length]), [[2022, 14], [2025, 33]]);
assert.deepEqual(H.firmness.terms.map((t) => [t.year, t.waves.length]), [[2025, 6]]);
assert.equal(H.soft.terms[0].polls[0].v, 21);
assert.equal(H.soft.terms[0].polls[0].released, "2021-04-16");
for (const t of H.firmness.terms[0].waves.slice(0, 3)) assert.equal(t.solid.all, undefined, "no national line through unprinted all-voters cells");
for (const t of H.softAge.terms.flatMap((t) => t.waves)) {
  for (const v of Object.values(t.soft)) assert.ok(Number.isFinite(v), "age lines never receive an absent/NaN share");
}
const src = readFileSync(".build/newtracker/assets/rd-panels.jsx", "utf8");
const view = src.slice(src.indexOf("function RdUndecided"), src.indexOf("/* ------------------------------------------------ Economic confidence"));
assert.ok(view.indexOf("<RdConfWinBar") < view.indexOf("<RdCrossfade"), "one shared window control reaches all views");
assert.equal((view.match(/<RdConfWinBar/g) || []).length, 1);
for (const token of ["histSoftLines", "DH.softAge.terms", "DH.firmness.terms", "poolValues", "Number.isFinite(w.solid[k])"])
  assert.ok(view.includes(token), `renderer carries ${token}`);

console.log(`test-decidedness-history: OK (${resolve.length} Resolve historical waves, ${red.length} RedBridge historical waves, current payload separate)`);
