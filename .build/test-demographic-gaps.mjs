/* Numeric invariants for the Who-votes gap views. Run after gen-data/build. */
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(".build/newtracker/assets/rd-panels.jsx", "utf8");
const helper = source.slice(source.indexOf("const RD_GAP_REFS ="), source.indexOf("function RdDemographicGapSet("));
const { rdGapPoints, rdGapRuns, rdGapSet, rdGapChanged, rdGapReferences, rdGapFmt } = new Function(helper
  + "\nreturn {rdGapPoints, rdGapRuns, rdGapSet, rdGapChanged, rdGapReferences, rdGapFmt};")();
const mx = (ym) => { const [y, m] = ym.split("-").map(Number); return y + (m - 0.5) / 12; };
const group = { monthly: [["2026-04", 0, 30], ["2026-01", 30, 10], ["2026-02", null, 0], ["2026-03", 20, null], ["2026-05", 10, 20]] };
const reference = { monthly: [["2026-01", 25, 20], ["2026-02", 15, 0], ["2026-04", 0, 40], ["2026-05", 20, 10]] };
const a = rdGapPoints(group, reference, ["alp", "onp"], "alp", mx);
assert.deepEqual(a.map((p) => [p.ym, p.y, p.groupVote, p.referenceVote]), [
  ["2026-01", 5, 30, 25], ["2026-04", 0, 0, 0], ["2026-05", -10, 10, 20],
], "exact month joins, signed percentage points, missing values omitted and printed zero retained");
const relative = rdGapPoints(reference, group, ["alp", "onp"], "alp", mx, true);
assert.deepEqual(relative.map(p => p.ym), ["2026-01", "2026-05"]);
assert(Math.abs(relative[0].y - 25 / 30) < 1e-9);
assert.equal(relative[1].y, 2);
assert.deepEqual(rdGapRuns(a).map((r) => r.map((p) => p.ym)), [["2026-01"], ["2026-04", "2026-05"]],
  "missing months break the line instead of implying observed continuity");
assert.deepEqual(rdGapPoints(group, reference, ["alp", "onp"], "onp", mx).map((p) => p.y), [-10, 0, -10, 10],
  "party columns follow the payload order, not the party-chip order");
assert.deepEqual(rdGapPoints(group, reference, ["alp"], "grn", mx), [], "an absent party never becomes a zero");
assert.deepEqual([-0.04, 0, 1.24, -5.37].map(rdGapFmt), ["0.0", "0.0", "+1.2", "−5.4"], "rounded signs never show negative zero");
assert.equal(rdGapSet({ id: "gender", groups: [{ label: "Women", ...group }] }, ["alp"], mx), null,
  "a missing reference cannot silently become another comparison");

const history = values => ({monthly: values.map((v,i) => ["2026-0"+(i+1), v, 0.2])});
const changed = (a,b,relative) => rdGapChanged(history(a), history(b), ["alp"], "alp", relative);
assert.equal(changed([20,40,20],[10,20,10],true),false, "constant ratio");
assert.equal(changed([20,40,20],[10,20,10],false),true, "intermediate absolute change");
assert.equal(changed([20,30],[10,20],false),false, "constant nonzero gap");
assert.equal(changed([20,30],[10,20],true),true, "relative change");
assert.equal(changed([20,30],[0,20],true),false, "one usable month");
const synthetic = (label, levels) => ({label, ...history(levels)});
const growing = synthetic("Vic", [20,40]), steadyRatio = synthetic("Qld", [10,20]);
assert.deepEqual(rdGapReferences({id: "state", groups: [growing, steadyRatio]}, ["alp"]), [],
  "an absolute change alone cannot make any reference eligible");
const st = {id: "state", groups: [{label:"NSW", monthly:[]}, growing, synthetic("Qld", [10,10])]};
assert.deepEqual(rdGapReferences(st, ["alp"]).map(r => [r.reference.label, r.comparisons[0].group.label]),
  [["Vic","Qld"], ["Qld","Vic"]], "find eligible pairs even when the default reference has none");

const predicate = source.slice(source.indexOf("function rdRelativeFinding("), source.indexOf("function rdChangeFactor("));
const finding = new Function(predicate + "return rdRelativeFinding;")();
const result = {model: true, ratioChange: {low: 0.91, high: 0.99}};
assert(finding(result));
assert(!finding({...result, model:false}), "legacy fits cannot qualify");
assert(!finding({...result, check:{conflict:true}}), "withhold a contradicted finding");
assert(!finding({...result, sig:true, ratioChange:{low:1, high:1.1}}), "touching parity cannot qualify");
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(".build/newtracker/assets/9f09dca2-bd46-49a8-8ae1-51847608cf92.js", "utf8"), context);
const D = context.window.AUSPOL, T = D.demographics;
const tabs = [...T.tabs, D.demoIncome].filter(Boolean);
let sets = 0, comparisons = 0, readings = 0;
for (const tab of tabs) for (const st of tab.sets) {
  const data = rdGapSet(st, T.order, D.mx);
  assert(data, `${tab.id}/${st.id} has a named reference and real comparisons`);
  assert.equal(data.comparisons.length, st.groups.length - 1, `${st.id}: every non-reference category is available`);
  assert(data.limit >= 5 && Number.isFinite(data.firstX), `${st.id}: a usable shared scale`);
  if (st.id === "gender") {
    assert.equal(data.reference.label, "Men");
    assert.equal(data.comparisons[0].group.label, "Women");
  }
  for (const c of data.comparisons) for (const p of c.parties) {
    comparisons++;
    assert(p.points.length > 0, `${st.id}/${c.group.label}/${p.party} has underlying figures`);
    for (const point of p.points) {
      readings++;
      assert(Math.abs(point.y) <= data.limit, "the shared symmetric scale contains every party and comparison");
      assert(Math.abs(point.y - (point.groupVote - point.referenceVote)) < 0.051, "the tooltip figures reconstruct the gap");
      assert(point.groupVote >= 0 && point.groupVote <= 100 && point.referenceVote >= 0 && point.referenceVote <= 100);
    }
  }
  sets++;
}
assert(sets >= 10, "age, generation, gender, education, states, location, housing, language, work and income are covered");
console.log(`PASS: demographic gaps — ${sets} sets, ${comparisons} party comparisons, ${readings} real monthly differences`);
