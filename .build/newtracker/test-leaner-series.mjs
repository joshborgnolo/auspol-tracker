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
const softResolve = w.AUSPOL.undecided.softResolve;
assert.deepEqual(softResolve.houses, ["Resolve"], "the Resolve-only companion series stays single-source");
assert.ok(softResolve.polls.every((p) => p.pollster === "Resolve" && p.basis === "soft"));

const leaner = series.leaner;
assert.ok(leaner, "the independent after-leaner series exists");
assert.equal(leaner.label, "After leaner");
assert.ok(leaner.polls.every((p) => p.basis === "leaner"));
assert.ok(leaner.polls.every((p) => ["DemosAU", "Essential", "Fox & Hedgehog", "RedBridge/Accent", "Newspoll"].includes(p.pollster)));
assert.ok(!leaner.polls.some((p) => p.pollster === "EMRS (Tas)"),
  "Tasmanian-only EMRS readings stay out of the national after-leaner series");
assert.deepEqual([...leaner.houses].sort(), ["DemosAU", "Essential", "Fox & Hedgehog", "Newspoll", "RedBridge/Accent"]);
const expected = source.filter((p) => p.pollster !== "EMRS (Tas)" && (p.undecidedLeaner != null || (p.pollster === "Essential" && p.undecidedIn != null)));
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

const tpp = series.tpp;
assert.deepEqual([...tpp.houses].sort(), ["Essential", "Spectre Strategy"]);
for (const p of source.filter((p) => p.tpp_undecided)) {
  assert.ok(tpp.polls.some((d) => d.pollster === "Spectre Strategy" && d.released === p.date && d.v === p.tpp_undecided.lnponp));
  const emitted = w.AUSPOL.individualPolls.find((d) => d.pollster === p.pollster && d.released === p.date);
  assert.deepEqual(emitted.tppUndecided, p.tpp_undecided, "both preference-contest undecided shares reach the poll detail");
}
assert.equal(w.AUSPOL.sampleTxt(w.AUSPOL.individualPolls.find((p) => p.pollster === "DemosAU" && p.released === "2025-07-06")), "1,199\u00a0D");
assert.equal(w.AUSPOL.sampleTxt(w.AUSPOL.individualPolls.find((p) => p.pollster === "DemosAU" && p.released === "2026-10-26")), "1,500\u00a0D+L");
w.React = { Fragment: "Fragment", createElement: (type, props, ...children) => ({ type, props: { ...(props || {}), children } }) };
const demosJulySample = w.AUSPOL.sampleEl(w.AUSPOL.individualPolls.find((p) => p.pollster === "DemosAU" && p.released === "2025-07-06"));
assert.ok(demosJulySample.props.children[1].props.children.includes("D"), "the archive's JSX sample cell is first-preference based as well");

process.env.RM_LIB = "1";
const { parseRelease } = await import("../extract-roymorgan.mjs");
for (const [file, expectedDate] of [
  ["release-federal-voting-intention-late-january-alp-increases-two-party-preferred-lead-as-one-nation-overtakes-the-liberal-party-for-the-first-time-as-coalition-splits", "2026-01-25"],
  ["release-10353-federal-voting-intention-september-21-2026", "2026-09-20"],
]) {
  const reading = parseRelease(JSON.parse(readFileSync(`.build/roymorgan-src/${file}.json`, "utf8")));
  assert.equal(reading.date, expectedDate, `${file}: parse the wave's own undecided reading`);
  assert.equal(reading.undecided, 5.5, `${file}: a signed change is not mistaken for the level`);
}

console.log(`PASS: separate after-leaner series (${leaner.polls.length} waves; nowcast ${leaner.now.v}% ±${leaner.now.ci95})`);
