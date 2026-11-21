// Ipsos's world comparison. Run after the site build: the producer reads PDFs,
// the renderer consumes only the derived monthly waves and country quantiles.
import assert from "node:assert/strict";
import fs from "node:fs";

const raw = JSON.parse(fs.readFileSync("data/ipsos-direction.json", "utf8"));
assert.ok(raw.waves.length > 0, "what-worries corpus is on file");
const input = raw.waves.find((w) => w.month === "2026-10");
assert.ok(input, "October 2026 is preserved in the primary data");
assert.deepEqual([input.australia.right, input.australia.wrong], [36, 64]);
assert.deepEqual([input.globalAverage.right, input.globalAverage.wrong], [37, 63]);
assert.ok(input.countries.every((c) => c.code !== "WORLD" && !/^(?:World|Global.*Average)$/i.test(c.name)),
  "global average is not a country-distribution observation");

const html = fs.readFileSync("index.html", "utf8");
const match = html.match(/assets\/js\/data\.[a-z0-9]+\.js/);
assert.ok(match, "built site has a data asset");
const js = fs.readFileSync(match[0], "utf8");
const encoded = js.match(/const directionWorld = JSON.parse\(("(?:\\[\s\S]|[^"\\])*")\);/);
assert.ok(encoded, "world direction payload is emitted");
const payload = JSON.parse(JSON.parse(encoded[1]));
assert.ok(payload.waves.every((w, i) => w.ym > (payload.waves[i - 1]?.ym || "")),
  "months are sorted and no month is duplicated");
assert.equal(input.australia.sample, 1000);
assert.equal(input.australia.sampleApprox, true);
assert.equal(input.globalAverage.sample, 24527);
const oct = payload.waves.find((w) => w.ym === "2026-10");
assert.equal(oct.auNet, -28);
assert.equal(oct.worldNet, -26);
assert.equal(oct.auN, 1000);
assert.equal(oct.auSampleApprox, true);
assert.equal(oct.worldN, 24527);
assert.ok(Number.isInteger(oct.band.n) && oct.band.n >= 4, "a genuine country roster supports the band");
for (const w of payload.waves) {
  if (w.auN != null) assert.ok(Number.isInteger(w.auN) && w.auN > 0);
  if (w.worldN != null) assert.ok(Number.isInteger(w.worldN) && w.worldN > 0);
  if (!w.band) continue;
  assert.ok(w.band.p10 <= w.band.q25 && w.band.q25 <= w.band.p50 && w.band.p50 <= w.band.p75 && w.band.p75 <= w.band.p90,
    `${w.ym}: country quantiles stay ordered`);
  assert.ok(w.band.n === raw.waves.find((r) => r.month === w.ym).countries.length,
    `${w.ym}: every participating country is in the distribution`);
  assert.ok(w.url, `${w.ym}: primary report is linked`);
  if (!w.fieldwork) assert.equal(w.start, null, `${w.ym}: an unprinted fieldwork window stays null`);
  if (!w.fieldwork) assert.equal(w.end, null, `${w.ym}: no fieldwork end is inferred`);
}
const panelMatch = html.match(/assets\/js\/rd-panels\.[a-z0-9]+\.js/);
assert.ok(panelMatch, "the panels asset is emitted");
const panel = fs.readFileSync(panelMatch[0], "utf8");
assert.ok(panel.includes("Ipsos") && panel.includes("middle 80%") && panel.includes("Global Average"),
  "Australia, global average and country bands have explicit chart labels");

// Render the actual component through the same VM the production retro pages
// use. This catches context/import errors and a plausible but invalid tooltip.
const { modernRunner } = await import("./retro/harvest.mjs");
const runner = modernRunner({ root: process.cwd(), doc: "cycles/index.html" });
const tree = runner.mount("RdIpsosDirectionWorld", { D: runner.D });
const findChart = (node) => {
  if (Array.isArray(node)) for (const child of node) { const found = findChart(child); if (found) return found; }
  if (!node) return null;
  if (node.tag === "$chart" || node.tag === "$c") return node;
  return findChart(node.kids) || findChart(node.props?.children);
};
const chart = findChart(tree.tree);
assert.ok(chart, "the actual world component renders a chart");
assert.equal(chart.props.series[1].label, "Ipsos’ Global Average");
assert.equal(JSON.stringify(chart.props.areas.map((a) => a.id)), JSON.stringify(["countries-middle-80", "countries-middle-half"]));
const tipRows = chart.props.extraRows(chart.props.spine.length - 1);
assert.equal(tipRows.find((r) => r.label === "Australia").value, "36% right / 64% wrong track");
assert.equal(tipRows.find((r) => r.label === "Ipsos’ Global Average").value, "37% right / 63% wrong track");
assert.equal(tipRows.find((r) => r.label === "Sample").value, "≈1,000 in Australia; 24,527 across all countries");
assert.ok(!tipRows.some((r) => /undefined|NaN/.test(r.value)), "tooltip never exposes a malformed value");
console.log(`test-direction-world: OK (${payload.waves.length} waves; October AU 36/64, world 37/63)`);
