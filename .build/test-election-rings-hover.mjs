import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(".build/newtracker/assets/rd-hero.jsx", "utf8");
const start = source.indexOf("function rdVhLines(");
const end = source.indexOf("\n\n/*", start);
assert(start >= 0 && end > start, "the boundary collector stays in rd-hero.jsx");
const rdVhLines = new Function("RD_VH_BRIDGE", "RD_VH_GAP",
  source.slice(start, end) + "\nreturn rdVhLines;")("0.5 4", 0.26);

const dataAsset = fs.readFileSync(".build/newtracker/assets/9f09dca2-bd46-49a8-8ae1-51847608cf92.js", "utf8");
const sandbox = { window: {} };
vm.runInNewContext(dataAsset, sandbox);
const history = sandbox.window.AUSPOL.voteHistory;
const result = rdVhLines(history, ["oth"], history.terms[0].a, history.terms.at(-1).b,
  (k) => ({ label: k, color: "var(--" + k + ")", width: 1, opacity: 1 }), { long: false });
const electionX = 2001.8575342465754;
const rings = result.marks.filter((m) => Math.abs(m.x - electionX) < 1e-8);
assert.equal(rings.length, 2, "the closing and next-opening Rings definitions both draw");
assert.deepEqual(rings.map((m) => m.y).sort((a, b) => a - b), [9.85, 14.15], "both counted values remain");
assert.equal(rings.filter((m) => m.dotColor === "var(--onp)").length, 1, "the One-Nation-inclusive ring gets the orange centre");
assert.equal(rings.filter((m) => !m.dotColor).length, 1, "the ring excluding One Nation stays hollow");
assert(rings.every((m) => m.color === "var(--oth)"), "the outer rings retain the Others colour");
assert.equal(result.stops.filter((point) => point.x === electionX).length, 1, "the electoral spine remains unique");
const allPoints = result.series.flatMap((s) => s.points);
assert(allPoints.some((p) => p.y === 9.85 && p.count), "the previous term's final count stays in the line");
assert(allPoints.some((p) => p.y === 14.15 && p.count), "the incoming count stays in the line too");
assert(result.series.every((s) => s.endCap === false), "there is no poll-estimate endcap");

const greenX = history.terms.find((t) => t.year === 1993).a;
const greenRings = result.marks.filter((m) => m.x === greenX);
assert.equal(greenRings.length, 2, "the Greens-definition change also retains both counted rings");
assert.equal(greenRings.filter((m) => m.dotColor === "var(--grn)").length, 1, "the Greens-inclusive ring gets the green centre");
assert.equal(greenRings.filter((m) => !m.dotColor).length, 1, "the Greens-excluding ring stays hollow");

const synthetic = rdVhLines({ terms: [
  { year: 1990, src: 1993, a: 1990, b: 1993, lanes: ["oth"], otherIncludes: { open: [], close: ["grn"] },
    open: { oth: 11 }, close: { oth: 9 }, series: { oth: [] } },
  { year: 1993, src: 1996, a: 1993, b: 1996, lanes: ["oth"], otherIncludes: { open: [], close: ["onp"] },
    open: { oth: 14 }, close: { oth: 19 }, series: { oth: [] } },
] }, ["oth"], 1989, 1997, (k) => ({ label: k, color: "var(--" + k + ")", width: 1 }), {});
const syntheticRings = synthetic.marks.filter((m) => m.x === 1993);
assert.equal(syntheticRings.length, 2, "a value-swap cannot collapse the definition pair");
assert.equal(syntheticRings.find((m) => m.y === 9).dotColor, "var(--grn)", "metadata, not the larger value, selects the Greens dot");
assert.equal(syntheticRings.find((m) => m.y === 14).dotColor, null, "no component makes no centre dot");
assert(synthetic.marks.some((m) => m.x === 1996 && m.dotColor === "var(--onp)"), "the metadata works at ordinary boundaries too");
console.log("PASS: double count-definition rings retained; inclusion dots use the counted party membership, while the spine and all-series points stay correct");
