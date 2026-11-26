/* Numeric invariants for the Who-votes gap views. Run after gen-data/build. */
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(".build/newtracker/assets/rd-panels.jsx", "utf8");
const helper = source.slice(source.indexOf("const RD_GAP_REFS ="), source.indexOf("function RdDemographicGapSet("));
const { rdGapPoints, rdGapRuns, rdGapSet, rdGapOptions, rdGapDomain, rdGapFmt } = new Function(helper
  + "\nreturn {rdGapPoints, rdGapRuns, rdGapSet, rdGapOptions, rdGapDomain, rdGapFmt};")();
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

/* which comparisons a gap card offers: only pairs gen-data's test passed,
   both ways round, opening on the set's own pair when it changed */
const stG = { id: "state", groups: ["NSW", "Vic", "Qld", "SA"].map((label) => ({ label, monthly: [] })) };
const pass = (a, b, party, r0, r1, p) => ({ a, b, party, r0, r1, p, padj: p * 10 });
assert.equal(rdGapOptions(stG, {}), null, "no test, no card");
assert.equal(rdGapOptions(stG, { state: { tested: 90, pass: [] } }), null, "nothing changed, no card");
assert.equal(rdGapOptions(stG, { state: { tested: 90, pass: [pass("WA", "Qld", "lnp", 1, 1.2, 0.001)] } }), null,
  "a pass naming a group the set doesn't hold is ignored");
let o = rdGapOptions(stG, { state: { tested: 90, pass: [pass("Vic", "Qld", "lnp", 0.92, 1.24, 0.00001), pass("NSW", "Vic", "lnp", 0.98, 0.78, 0.0002)] } });
assert.deepEqual([o.start.cmp, o.start.ref, o.start.party], ["Vic", "Qld", "lnp"], "the strongest change opens the card (the one the dek names)");
o = rdGapOptions(stG, { state: { tested: 90, pass: [pass("NSW", "Vic", "lnp", 0.98, 0.78, 0.0002)] } });
assert.deepEqual([o.start.cmp, o.start.ref], ["Vic", "NSW"], "turned so the set's default reference (NSW) keeps its side");
assert(Math.abs(o.start.r0 - 1 / 0.98) < 1e-9 && Math.abs(o.start.r1 - 1 / 0.78) < 1e-9, "turning a pair round inverts its ratios");
o = rdGapOptions(stG, { state: { tested: 90, pass: [pass("Vic", "Qld", "lnp", 0.92, 1.24, 0.00001), pass("NSW", "Vic", "lnp", 0.98, 0.78, 0.0002)] } });
assert.equal(o.pairs.length, 4, "every pass both ways round");
assert.equal(o.tested, 90);

/* a card's scale holds what it draws and the parity line, on round steps */
for (const [ys, rel] of [[[1.02, 0.95, 0.86], true], [[0.21, 0.3, 0.38], true], [[2.56, 2.1, 1.85], true], [[-3.1, 2.4], false], [[12, 18.5], false], [[1.0, 1.01], true]]) {
  const d = rdGapDomain(ys, rel), base = rel ? 1 : 0;
  assert(d.lo <= Math.min(base, ...ys) && d.hi >= Math.max(base, ...ys), `scale ${d.lo}–${d.hi} holds ${ys} and parity`);
  assert(d.ticks.includes(base), `parity is a tick on ${ys}`);
  assert(d.ticks.length >= 2 && d.ticks.length <= 7, `a readable number of ticks on ${ys}: ${d.ticks}`);
  if (rel) assert(d.lo >= 0, "a ratio scale never goes below zero");
}
assert(rdGapDomain([1.02, 0.86], true).hi <= 1.2, "a small move gets a scale it can be seen on");

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

/* gen-data's tests: the change copy and the gap cards may only cite what
   passed Holm's correction, on the relative (log-ratio) change */
for (const [party, dt] of Object.entries(D.demoTrend)) {
  const live = dt.rows.filter((r) => Number.isFinite(r.p));
  assert.equal(dt.tested, live.length, `${party}: the family is every group with a test`);
  for (const r of live) {
    const p = r.pRaw, padj = r.padjRaw;
    assert(Number.isFinite(p) && Number.isFinite(padj), `${party}/${r.group}: the tests keep the unrounded probabilities`);
    assert(padj >= p * 0.999 && padj <= 1, `${party}/${r.group}: Holm never lowers a p`);
    assert.equal(r.sig, padj < 0.05, `${party}/${r.group}: significant means Holm-adjusted p under 0.05`);
    assert.equal(r.sigAlone, p < 0.05);
    if (r.sig) assert(r.lrLo > 0 || r.lrHi < 0, `${party}/${r.group}: a significant change's interval excludes no change`);
  }
  const ranked = live.slice().sort((x, y) => x.pRaw - y.pRaw);
  ranked.forEach((r, i) => { if (i) assert(r.padj >= ranked[i - 1].padj * 0.999, `${party}: Holm keeps rank order`); });
  for (const m of dt.moves) {
    assert(m.sig && !(m.check && m.check.conflict), `${party}/${m.group}: a move is significant and not withheld`);
    assert.equal(Math.sign(m.lr), m.dir, `${party}/${m.group}: the direction is the relative change's`);
    assert(Math.abs(Math.log(m.r1 / m.r0) - m.lr) < 0.02, `${party}/${m.group}: the quoted ratios carry the tested change`);
  }
}
const NEST = { SA: "Non-NSW/Vic/Qld", WA: "Non-NSW/Vic/Qld", "ACT/NT/Tas": "Non-NSW/Vic/Qld" };
for (const tab of tabs) for (const st of tab.sets) {
  const g = D.demoGaps[st.id];
  assert(g, `${st.id}: the gap test ran`);
  const labels = st.groups.map((x) => x.label);
  const pairs = labels.flatMap((a, i) => labels.slice(i + 1).filter((b) => NEST[a] !== b && NEST[b] !== a)).length;
  assert.equal(g.tested, pairs * T.order.length, `${st.id}: every pair (never a state against its own bucket) times every party`);
  for (const r of g.pass) {
    assert(labels.includes(r.a) && labels.includes(r.b) && labels.indexOf(r.a) < labels.indexOf(r.b), `${st.id}: a pass is stored once, in the set's order`);
    assert(r.padj < 0.05 && (r.lo > 0 || r.hi < 0), `${st.id}/${r.a}/${r.b}/${r.party}: passes Holm and its interval excludes no change`);
    assert(Math.abs(Math.log(r.r1 / r.r0) - r.lr) < 0.03, `${st.id}/${r.a}/${r.b}/${r.party}: the ratios carry the tested change`);
  }
}
assert(sets >= 10, "age, generation, gender, education, states, location, housing, language, work and income are covered");
console.log(`PASS: demographic gaps — ${sets} sets, ${comparisons} party comparisons, ${readings} real monthly differences`);
