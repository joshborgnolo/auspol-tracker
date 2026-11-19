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
assert.ok(first.polls.some((p) => p.pollster === "DemosAU" && p.v === 6),
  "DemosAU’s published figure stays in its existing first-question series");

const leaner = series.leaner;
assert.ok(leaner, "the independent after-leaner series exists");
assert.equal(leaner.label, "After leaner");
assert.ok(leaner.polls.every((p) => p.basis === "leaner"));
assert.ok(leaner.polls.every((p) => ["RedBridge/Accent", "Newspoll"].includes(p.pollster)));
assert.deepEqual([...leaner.houses].sort(), ["Newspoll", "RedBridge/Accent"]);
const expected = source.filter((p) => p.undecidedLeaner != null);
assert.equal(leaner.polls.length, expected.length);
const newest = [...expected].sort((a, b) => b.date.localeCompare(a.date))[0];
assert.ok(newest, "at least one source wave has a leaner-excluded share");
assert.equal(leaner.latest.released, newest.date);
assert.equal(leaner.latest.v, newest.undecidedLeaner);
assert.ok(leaner.polls.some((p) => p.pollster === "Newspoll" && p.released === "2026-10-29" && p.v === 5),
  "Newspoll’s current 5% is included in the after-leaner series");
assert.ok(Number.isFinite(leaner.now.v) && Number.isFinite(leaner.now.ci95));
assert.ok(leaner.now.n >= 2, "the nowcast includes more than one source reading");

console.log(`PASS: separate after-leaner series (${leaner.polls.length} waves; nowcast ${leaner.now.v}% ±${leaner.now.ci95})`);
