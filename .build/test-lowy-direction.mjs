// Lowy's Australia-satisfaction readings stay distinct from Ipsos and other
// direction wordings. Run after the normal site build.
import assert from "node:assert/strict";
import fs from "node:fs";

const doc = JSON.parse(fs.readFileSync("data/lowy-direction.json", "utf8"));
const plain = (s) => s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const reports = {
  2017: plain(fs.readFileSync(".build/direction-history-src/lowy-australia-methodology.txt", "utf8")),
  2018: plain(fs.readFileSync(".build/direction-history-src/lowy-2018-publication.html", "utf8")),
};
assert.equal(doc.lastAsked, 2018);
assert.deepEqual(doc.waves.map((w) => [w.year, w.satisfied, w.dissatisfied, w.other, w.sample, w.net]), [
  [2017, 47, 48, 5, 1200, -1],
  [2018, 49, 46, 5, 1200, 3],
]);
for (const w of doc.waves) {
  const caption = "Overall, are you satisfied or dissatisfied with the way things are going in Australia today?";
  assert.ok(reports[w.year].includes(caption), "Australia-specific question is in the primary report");
  assert.ok(Number.isInteger(w.sample) && w.sample === 1200);
  assert.equal(w.other, 100 - w.satisfied - w.dissatisfied);
  assert.equal(w.otherDerived, true, "the combined-other remainder is not claimed as printed neutral");
  assert.equal(w.net, w.satisfied - w.dissatisfied);
  assert.equal(w.otherLabel, "Don’t know / no view / neither");
  assert.ok(w.question.includes("going in Australia today"));
  if (w.year === 2018) {
    assert.ok(reports[w.year].includes("Around half (49%) are satisfied with the way things are going in Australia today"), "49% satisfied in primary narrative");
    assert.ok(reports[w.year].includes("46% are dissatisfied"), "46% dissatisfied in primary narrative");
  } else {
    const context = reports[w.year].slice(reports[w.year].indexOf(caption), reports[w.year].indexOf(caption) + 20000);
    for (const [label, value] of [["Dissatisfied", w.dissatisfied], ["Satisfied", w.satisfied]]) {
      assert.ok(new RegExp(`${label} ${value}%`).test(context), `${w.year} ${label} ${value}% primary value present`);
    }
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
assert.equal(chart.props.series[2].label, "Lowy Institute: satisfaction with direction of Australia");
assert.equal(JSON.stringify(chart.props.series[2].points.map((p) => p.y)), JSON.stringify([-1, 3]));
assert.equal(chart.props.scatter.length, 2);
assert.ok(chart.props.scatter.every((d) => d.meta.sample === 1200 && d.meta.pollster === "Lowy Institute"));
assert.ok(chart.props.scatter.every((d) => d.meta.otherLabel === "Don’t know / no view / neither"));
console.log("test-lowy-direction: OK (2017: 47/48/5, 2018: 49/46/5; Australia satisfaction and both bands)");
