// Lowy's two world-satisfaction readings stay distinct from national direction
// and the Ipsos pool. Run after the normal site build.
import assert from "node:assert/strict";
import fs from "node:fs";

const doc = JSON.parse(fs.readFileSync("data/lowy-direction.json", "utf8"));
const source = fs.readFileSync(".build/direction-history-src/lowy-direction-world.html", "utf8");
assert.equal(doc.lastAsked, 2018);
assert.deepEqual(doc.waves.map((w) => [w.year, w.satisfied, w.dissatisfied, w.other, w.sample, w.net]), [
  [2017, 19, 79, 2, 1200, -60],
  [2018, 17, 78, 5, 1200, -61],
]);
for (const w of doc.waves) {
  assert.ok(Number.isInteger(w.sample) && w.sample === 1200);
  assert.equal(w.other, 100 - w.satisfied - w.dissatisfied);
  assert.equal(w.otherDerived, true, "the combined-other remainder is not claimed as printed neutral");
  assert.equal(w.net, w.satisfied - w.dissatisfied);
  assert.equal(w.otherLabel, "Don’t know / no view / neither");
  assert.ok(w.question.includes("situation in the world overall"));
  for (const [label, value] of [["Dissatisfied", w.dissatisfied], ["Satisfied", w.satisfied]]) {
    assert.ok(source.includes(`data-tooltip="In ${w.year}, ${value}% said ${label.toLowerCase()}.`),
      `${w.year} ${label} primary label present`);
  }
}
assert.equal(doc.waves[0].modeChange, false);
assert.equal(doc.waves[1].modeChange, true);
assert.ok(doc.waves[1].method.includes("600 online") && doc.waves[1].method.includes("600 telephone"));

const html = fs.readFileSync("index.html", "utf8");
const asset = html.match(/assets\/js\/data\.[a-z0-9]+\.js/);
const js = fs.readFileSync(asset[0], "utf8");
function decodedDirection(js, name) {
  const marker = `const ${name} = `, at = js.indexOf(marker);
  assert.ok(at >= 0, `${name} is emitted by name`);
  const text = js.slice(at + marker.length);
  const encoded = text.match(/^JSON\.parse\(("(?:\\[\s\S]|[^"\\])*")\)/);
  if (encoded) return JSON.parse(JSON.parse(encoded[1]));
  if (!text.startsWith("{")) return null;
  let depth = 0, quoted = false, slash = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (slash) { slash = false; continue; }
    if (c === "\\") { slash = true; continue; }
    if (c === '"') quoted = !quoted;
    if (!quoted) {
      if (c === "{") depth++;
      if (c === "}" && --depth === 0) return JSON.parse(text.slice(0, i + 1));
    }
  }
  throw new Error(`Unterminated ${name} object`);
}
const payload = decodedDirection(js, "directionLowy");
assert.equal(payload.waves.length, 2);
assert.equal(payload.waves[0].x > 2017 && payload.waves[0].x < 2018, true);
const dirPreEncoded = js.match(/const directionPre = JSON.parse\(("(?:\\[\s\S]|[^"\\])*")\);/);
const dirPre = JSON.parse(JSON.parse(dirPreEncoded[1]));
assert.ok(!dirPre.houses.includes("McKinnon") && !dirPre.houses.includes("Lowy Institute"),
  "other-worded houses never populate the estimator roster");

const { modernRunner } = await import("./retro/harvest.mjs");
const runner = modernRunner({ root: process.cwd(), doc: "cycles/index.html" });
const tree = runner.mount("RdIpsosDirectionWorld", { D: runner.D });
const charts = [];
function walk(x) {
  if (Array.isArray(x)) return x.flatMap(walk);
  if (!x) return [];
  const own = x.tag === "$chart" || x.tag === "$c" ? [x] : [];
  return own.concat(walk(x.kids), walk(x.props?.children));
}
charts.push(...walk(tree.tree));
const chart = charts[0];
assert.ok(chart, "world comparison actually mounts");
assert.equal(JSON.stringify(chart.props.areas.map((a) => a.id)), JSON.stringify(["countries-middle-80", "countries-middle-half"]));
assert.equal(chart.props.series[2].id, "lowy-world");
assert.equal(JSON.stringify(chart.props.series[2].points.map((p) => p.y)), JSON.stringify([-60, -61]));
assert.equal(chart.props.scatter.length, 2);
assert.ok(chart.props.scatter.every((d) => d.meta.sample === 1200 && d.meta.pollster === "Lowy Institute"));
assert.ok(chart.props.scatter.every((d) => d.meta.otherLabel === "Don’t know / no view / neither"));
console.log("test-lowy-direction: OK (2017: 19/79/2, 2018: 17/78/5; separate series and both bands)");
