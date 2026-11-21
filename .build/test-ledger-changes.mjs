import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const source = readFileSync(".build/newtracker/assets/rd-allpolls.jsx", "utf8");
const start = source.indexOf("function rdLgSignificantChanges");
assert.ok(start >= 0, "change significance helper exists");
const end = source.indexOf("function rdLgMoe", start);
const world = { AUSPOL: { individualPolls: [], latest: { method: { deff: 1.6 } } } };
const { note, sig } = new Function("window", "rdApDeff", "rdLgWho", source.slice(start, end) + "\nreturn { note: rdLgChgNote, sig: rdLgSignificantChanges };")(
  world,
  () => world.AUSPOL.latest.method.deff,
  (_p, k) => ({ alb: "Albanese", taylor: "Taylor", hanson: "Hanson" })[k],
);
const row = (date, sampleEff, change, previous) => ({
  pollster: "House", released: date, field: date, sampleEff,
  chg: change == null ? null : { d: { und: change }, r: { und: previous } },
});
const older = row("previous", 1000, null, null);
const current = row("current", 1000, 4, "previous");
world.AUSPOL.individualPolls = [older, current];

assert.equal(note(current, ["und"]), "▲▼ Changes are on House’s previous poll (none significant).");
assert.deepEqual(sig(current, ["und"]), []);
current.chg.d.und = 5;
assert.equal(note(current, ["und"]), "▲▼ Changes are on House’s previous poll (only undecided significant).");
assert.deepEqual(sig(current, ["und"]), ["und"]);
current.chg.d.und = 4.38;
assert.ok(note(current, ["und"]).includes("none significant"), "delta inside its 95% interval");
current.chg.d.und = 4.39;
assert.ok(!note(current, ["und"]).includes("none significant"), "the strict >95% boundary is preserved");

current.sampleEff = null;
assert.equal(note(current, ["und"]), "▲▼ Changes are on House’s previous poll.", "without an effective current sample the qualifier is not asserted");
assert.equal(sig(current, ["und"]), null);
current.sampleEff = 1000;
world.AUSPOL.individualPolls[0] = { ...older, sampleEff: null };
assert.equal(note(current, ["und"]), "▲▼ Changes are on House’s previous poll.", "without the reference sample the note stays unqualified");
world.AUSPOL.individualPolls[0].sample = 1600;
current.chg.d.und = 5;
assert.deepEqual(sig(current, ["und"]), ["und"], "raw samples use the normal 1.6 design effect when published effective n is absent");
world.AUSPOL.individualPolls[0].sampleEff = 1000;

current.chg.d.und = 4;
assert.equal(note(current, []), null, "no referenced change means no change note");
assert.deepEqual(sig(row("current", null, null, null), ["und"]), null, "an absent sample cannot yield a significance verdict");

const primary = row("current", 1000, null, null);
primary.chg = { d: { pAlp: -1, pLnp: 5, pGrn: -0.5 }, r: { pAlp: "previous", pLnp: "previous", pGrn: "previous" } };
const primaryKeys = ["pAlp", "pLnp", "pGrn"];
assert.equal(note(primary, primaryKeys), "▲▼ Changes are on House’s previous poll (only L/NP significant).");
assert.deepEqual(sig(primary, primaryKeys), ["pLnp"]);
primary.chg.d.pAlp = 5;
assert.equal(note(primary, primaryKeys), "▲▼ Changes are on House’s previous poll (only ALP and L/NP significant).");
assert.deepEqual(sig(primary, primaryKeys), ["pAlp", "pLnp"]);

const twopp = row("current", 1000, null, null);
twopp.chg = { d: { imp: 5, alp2pp: 1 }, r: { imp: "previous", alp2pp: "previous" } };
assert.equal(note(twopp, ["imp", "alp2pp"]), "▲▼ Changes are on House’s previous poll (only implied Labor v Coalition significant).");

const leadership = row("current", 1000, null, null);
leadership.appr = { metricBy: { alb: "approve" } };
leadership.chg = { d: { albNet: 5, taylorNet: 1 }, r: { albNet: "previous", taylorNet: "previous" } };
assert.equal(note(leadership, ["albNet", "taylorNet"]), "▲▼ Changes are on House’s previous poll (only Albanese net approval significant).");
leadership.appr.metricBy.alb = "fav";
assert.equal(note(leadership, ["albNet", "taylorNet"]), "▲▼ Changes are on House’s previous poll (only Albanese net favourability significant).");

console.log("PASS: ledger change notes name significant measures and retain independent-wave 95% tests and sample fallbacks");
