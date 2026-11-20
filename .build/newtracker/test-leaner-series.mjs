import { readFileSync, readdirSync } from "node:fs";
import assert from "node:assert/strict";

const asset = `.build/newtracker/assets/${readdirSync(".build/newtracker/assets").find((f) => f.startsWith("9f09dca2-") && f.endsWith(".js"))}`;
const w = {};
new Function("window", readFileSync(asset, "utf8"))(w);
const series = Object.fromEntries(w.AUSPOL.undecided.series.map((s) => [s.id, s]));
const source = JSON.parse(readFileSync("data/polls.json", "utf8")).polls;

const first = series.first;
assert.ok(first, "the first-preference series still exists");
assert.ok(first.polls.length > 0);
assert.ok(first.polls.every((p) => p.basis === "first"));
assert.ok(first.polls.every((p) => !["RedBridge/Accent", "Newspoll"].includes(p.pollster)),
  "after-leaner exclusions must not leak into the first-preference series");
assert.ok(first.polls.some((p) => p.pollster === "DemosAU" && p.released === "2025-07-06" && p.v === 9),
  "DemosAU’s pre-leaner July 2025 9% remains a first-preference reading");
assert.ok(!first.polls.some((p) => p.pollster === "DemosAU" && p.released > "2025-07-06"),
  "DemosAU’s later figures are after its leaner, not first-preference readings");

const soft = series.soft;
assert.equal(soft.label, "Soft", "the soft-support series uses the short tooltip label");
assert.deepEqual([...soft.houses].sort(), ["RedBridge/Accent", "Resolve"]);
for (const p of source.filter((p) => p.pollster === "RedBridge/Accent" && p.firmness?.all?.length === 3)) {
  const expectedSoft = p.firmness.all[1] + p.firmness.all[2];
  assert.ok(soft.polls.some((d) => d.released === p.date && d.pollster === p.pollster && d.v === expectedSoft),
    `${p.date}: RedBridge soft + very soft = ${expectedSoft}`);
}
assert.ok(!soft.polls.some((p) => p.pollster === "Spectre Strategy"),
  "Spectre's undecided-inclusive soft share stays out");

const leaner = series.leaner;
assert.ok(leaner, "the independent after-leaner series exists");
assert.equal(leaner.label, "After leaner");
assert.ok(leaner.polls.every((p) => p.basis === "leaner"));
assert.ok(leaner.polls.every((p) => ["DemosAU", "Essential", "RedBridge/Accent", "Newspoll"].includes(p.pollster)));
assert.deepEqual([...leaner.houses].sort(), ["DemosAU", "Essential", "Newspoll", "RedBridge/Accent"]);
const expected = source.filter((p) => p.undecidedLeaner != null || (p.pollster === "Essential" && p.undecidedIn != null));
assert.equal(leaner.polls.length, expected.length);
for (const p of expected) {
  const expectedV = p.undecidedLeaner ?? p.undecidedIn;
  assert.ok(leaner.polls.some((d) => d.pollster === p.pollster && d.released === p.date && d.v === expectedV),
    `${p.pollster} ${p.date}: the source's after-leaner figure is preserved`);
}
assert.ok(leaner.polls.some((p) => p.pollster === "DemosAU" && p.released === "2026-01-06" && p.v === 5),
  "the early-January DemosAU 5% is included");
assert.equal(source.filter((p) => p.pollster === "DemosAU" && p.date <= "2026-10-26" && p.undecidedLeaner != null).length, 9,
  "all nine published post-leaner DemosAU shares through October 2026 are filed; nothing is invented for late January");
const newest = [...expected].sort((a, b) => b.date.localeCompare(a.date))[0];
assert.ok(newest, "at least one source wave has an after-leaner share");
assert.equal(leaner.latest.released, newest.date);
assert.equal(leaner.latest.v, newest.undecidedLeaner ?? newest.undecidedIn);
assert.ok(leaner.polls.some((p) => p.pollster === "Newspoll" && p.released === "2026-10-29" && p.v === 5),
  "Newspoll’s current 5% is included in the after-leaner series");
assert.ok(Number.isFinite(leaner.now.v) && Number.isFinite(leaner.now.ci95));
assert.ok(leaner.now.n >= 2, "the nowcast includes more than one source reading");

console.log(`PASS: separate after-leaner series (${leaner.polls.length} waves; nowcast ${leaner.now.v}% ±${leaner.now.ci95})`);
