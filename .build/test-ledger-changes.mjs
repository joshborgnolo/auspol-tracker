import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const source = readFileSync(".build/newtracker/assets/rd-allpolls.jsx", "utf8");
const start = source.indexOf("function rdLgNoSignificantChanges");
assert.ok(start >= 0, "change significance helper exists");
const end = source.indexOf("function rdLgMoe", start);
const world = { AUSPOL: { individualPolls: [], latest: { method: { deff: 1.6 } } } };
const { note, sig } = new Function("window", "rdApDeff", source.slice(start, end) + "\nreturn { note: rdLgChgNote, sig: rdLgNoSignificantChanges };")(world, () => world.AUSPOL.latest.method.deff);
const row = (date, sampleEff, change, previous) => ({
  pollster: "House", released: date, field: date, sampleEff,
  chg: change == null ? null : { d: { und: change }, r: { und: previous } },
});
const older = row("previous", 1000, null, null);
const current = row("current", 1000, 4, "previous");
world.AUSPOL.individualPolls = [older, current];

assert.equal(note(current, ["und"]), "▲▼ Changes are on House’s previous poll (none significant).");
current.chg.d.und = 5;
assert.ok(!note(current, ["und"]).includes("none significant"), "a delta outside its 95% interval is not called insignificant");
assert.equal(sig(current, ["und"]), false);
current.chg.d.und = 4.38;
assert.ok(note(current, ["und"]).includes("none significant"), "delta inside its 95% interval");
current.chg.d.und = 4.39;
assert.ok(!note(current, ["und"]).includes("none significant"), "the strict >95% boundary is preserved");

current.sampleEff = null;
assert.ok(!note(current, ["und"]).includes("none significant"), "without an effective current sample the qualifier is not asserted");
current.sampleEff = 1000;
world.AUSPOL.individualPolls[0] = { ...older, sampleEff: null };
assert.ok(!note(current, ["und"]).includes("none significant"), "without the reference sample the note stays unqualified");
world.AUSPOL.individualPolls[0].sample = 1600;
current.chg.d.und = 5;
assert.equal(sig(current, ["und"]), false, "raw samples use the normal 1.6 design effect when published effective n is absent");
world.AUSPOL.individualPolls[0].sampleEff = 1000;

current.chg.d.und = 4;
assert.equal(note(current, []), null, "no referenced change means no change note");
assert.deepEqual(sig(row("current", null, null, null), ["und"]), null, "an absent sample cannot yield a significance verdict");
console.log("PASS: ledger change notes apply independent-wave 95% tests and sample fallbacks");
