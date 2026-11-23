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

const allPartyResult = rdVhLines(history, ["alp", "lnp", "grn", "onp", "oth"], history.terms[0].a, history.terms.at(-1).b,
  (k) => ({ label: k, color: "var(--" + k + ")", width: 1, opacity: 1 }), {});
assert(allPartyResult.marks.every((m) => !m.dotColor || m.color === "var(--oth)"),
  "an included party's colour cue belongs only on an Others ring, never a party's own ring");
const green2016X = history.terms.find((t) => t.year === 2016).a;
const green2016Rings = allPartyResult.marks.filter((m) => m.x === green2016X && m.color === "var(--grn)");
assert(green2016Rings.length > 0, "the 2016 election has its Greens count ring");
assert(green2016Rings.every((m) => !m.dotColor), "a Greens ring never carries One Nation's inclusion cue");

const lanes = ["alp", "lnp", "grn", "onp", "oth"];
const partyStyle = (k) => ({ label: k, color: "var(--" + k + ")", width: 1, opacity: 1 });
const measured = rdVhLines(history, lanes, history.terms[0].a, history.terms.at(-1).b, partyStyle, { measured: true });
assert.deepEqual(measured.marks, allPartyResult.marks, "Measured support retains every official election ring unchanged");
assert.deepEqual(measured.stops.map((p) => [p.x, p.count]), allPartyResult.stops.map((p) => [p.x, p.count]),
  "Measured support retains every stop's position and election role, with y following the selected basis");
assert.equal(measured.areas.length, 0, "Measured support does not carry election-calibration bands");
const measuredPoints = measured.series.flatMap((s) => s.points);
assert(measuredPoints.length > 0, "Measured support draws monthly lines");
assert(measuredPoints.every((p) => p.count == null), "No election count becomes a vertex in a measured line");
assert(measuredPoints.every((p) => p.y === p.raw), "Every measured vertex uses the stored unadjusted poll figure");
assert.deepEqual(rdVhLines(history, lanes, history.terms[0].a, history.terms.at(-1).b, partyStyle, {}).series,
  allPartyResult.series, "The default inferred series is unchanged");

const smallHistory = { terms: [{ year: 2022, src: 2025, a: 2022, b: 2025, lanes: ["alp"], open: { alp: 40 }, close: { alp: 44 }, otherIncludes: {},
  series: { alp: [[2022.5, 45, 46, 1, 4], [2024.5, 43, 42, 1, 4]] } }] };
const smallMeasured = rdVhLines(smallHistory, ["alp"], 2022, 2025, partyStyle, { measured: true });
assert.deepEqual(smallMeasured.series[0].points.map((p) => p.y), [46, 42], "A measured example can sit above one count and below the other");
assert.deepEqual(smallMeasured.marks.map((p) => [p.x, p.y]), [[2022, 40], [2025, 44]], "The two counted elections remain detached marks");
const emptyMeasured = rdVhLines({ terms: [{ ...smallHistory.terms[0], series: { alp: [] } }] }, ["alp"], 2022, 2025, partyStyle, { measured: true });
assert.equal(emptyMeasured.series.length, 0, "A count-only term invents no measured line");
assert.equal(emptyMeasured.marks.length, 2, "A count-only term still draws both election marks");

const primarySource = fs.readFileSync(".build/newtracker/assets/rd-panels.jsx", "utf8");
const currentStart = primarySource.indexOf("  const chartSeries =");
const currentStyle = primarySource.slice(currentStart, primarySource.indexOf("  /* a party toggled off", currentStart));
assert(currentStart >= 0 && currentStyle.includes('color: p.color'), "the current-term Others line keeps its party colour");
assert(currentStyle.includes('rdWidth: p.id === "oth" ? 2 : 2.5'), "the current-term Others line keeps its width");
assert(!/\bdashed:|\bdash:/.test(currentStyle), "the current-term Others line is solid");
const historyStart = primarySource.indexOf("  const vhStyle =");
const historyStyle = primarySource.slice(historyStart, primarySource.indexOf("  const vhL =", historyStart));
assert(historyStart >= 0 && historyStyle.includes("color: D.PARTIES[k].color"), "the history Others line keeps its party colour");
assert(historyStyle.includes('k === "oth" ? 2 : 2.5'), "the history Others line keeps its width");
assert(!/\bdashed:|\bdash:/.test(historyStyle), "the history Others line is solid");
assert(!primarySource.includes('kind: p.id === "oth" ? "dashed" : "line"'), "the copy-card legends mark Others as a line, not a dash");
console.log("PASS: election rings, unchanged inferred output, raw measured lines with detached counts, and solid Others lines");
