// Lowy and Ipsos Australia's own readings belong on the main national-direction
// chart; Ipsos' Global Average is a reference there, not a duplicate chart.
// Run after the normal site build.
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
const world = decodedDirection(js, "directionWorld");
assert.equal(world.waves.length, 91, "the series includes Ipsos's November 2026 wave");
const latestAustralia = world.waves.at(-1);
assert.deepEqual([latestAustralia.auRight, latestAustralia.auWrong], [35, 65]);
assert.notEqual(latestAustralia.auRight, latestAustralia.worldRight,
  "the main chart's Australia reading is never filled by the global average");
const dirPreEncoded = js.match(/const directionPre = JSON.parse\(("(?:\\[\s\S]|[^"\\])*")\);/);
const dirPre = JSON.parse(JSON.parse(dirPreEncoded[1]));
/* since 2026-11-22 every pollster is an input to the model (gen-data §5m):
   Ipsos asked through March 2022 – April 2025, so it is in that stretch's
   roster; Lowy (2017–18) and McKinnon (2025–26) fall outside it */
assert.ok(dirPre.model && dirPre.houses.includes("Ipsos"), "Ipsos enters the model");
assert.ok(!dirPre.houses.includes("Lowy Institute") && !dirPre.houses.includes("McKinnon"), "the pre-term roster is March 2022 – April 2025 only");

const { modernRunner, findAll, press, words } = await import("./retro/harvest.mjs");
const runner = modernRunner({ root: process.cwd(), doc: "cycles/index.html" });
const main = runner.mount("RdDirectionView", {});
function mainChart(handle) {
  return findAll(handle.tree, (n) => n.tag === "$chart").find((n) =>
    ["right", "wrong"].every((id) => (n.props.series || []).some((s) => s.id === id)));
}
function topicNote(handle, house) {
  return findAll(handle.tree, (n) => n.tag === "section" && n.props.className === "rd-dirq-house")
    .find((n) => words(n).startsWith(house));
}
for (const house of ["Roy Morgan", "Essential", "SEC Newgate", "RedBridge/Accent", "Spectre Strategy", "McKinnon", "Ipsos"]) {
  assert.ok(topicNote(main, house), `${house}: how it asks, beneath the current main chart`);
  assert.ok(/Answers/.test(words(topicNote(main, house))) && /In the line/.test(words(topicNote(main, house))), `${house}: its answers and what the model does with them`);
}
assert.ok(words(topicNote(main, "Essential")).includes("or on the wrong track"));
assert.ok(words(topicNote(main, "Essential")).includes("is it off on the wrong track"), "Essential's earlier wording is retained");
assert.ok(words(topicNote(main, "McKinnon")).includes("how satisfied"));
assert.ok(words(topicNote(main, "McKinnon")).includes("neutral"), "McKinnon's neutral middle answer is named");
assert.ok(words(topicNote(main, "SEC Newgate")).includes("forced choice"));
assert.ok(words(topicNote(main, "Ipsos")).includes("don’t know"), "Ipsos's undecided treatment is said");

const cur = mainChart(main);
assert.ok(!(cur.props.series || []).some((s) => /^worded-/.test(s.id)), "no pollster draws as a separate overlay: all are in the line");
assert.ok(["world-right", "world-wrong"].every((id) => cur.props.series.some((s) => s.id === id)), "Ipsos' Global Average is the dashed reference on the main chart");
const ipOct = cur.props.scatter.filter((d) => d.meta.pollster === "Ipsos" && d.meta.ym === "2026-10");
assert.deepEqual(ipOct.map((d) => d.y).sort((a, b) => a - b), [36, 64], "Ipsos's October 2026 reading is a dot where it printed it");
assert.ok(!(cur.props.series || []).some((s) => s.id === "world-average"));

for (let i = 0; i < 8; i++) {
  if (mainChart(main).props.scatter.some((d) => d.meta.pollster === "Lowy Institute")) break;
  assert.ok(press(main, (n) => n.tag === "button" && n.props["aria-label"] === "Previous term"), "walk back to Lowy's term");
}
const chart = mainChart(main);
const lowyDots = chart.props.scatter.filter((d) => d.meta.pollster === "Lowy Institute");
assert.equal(lowyDots.length, 4);
assert.deepEqual(lowyDots.filter((d) => d.label === "Satisfied").map((d) => d.y), [47, 49], "Lowy shows satisfied and dissatisfied shares, labelled as such");
assert.deepEqual(lowyDots.filter((d) => d.label === "Dissatisfied").map((d) => d.y), [48, 46]);
assert.deepEqual(new Set(lowyDots.map((d) => d.meta.sample)), new Set([1200]));
assert.deepEqual(new Set(lowyDots.map((d) => d.meta.dateLabel)), new Set(["1–21 March 2017", "5–25 March 2018"]));
assert.ok(lowyDots.every((d) => d.meta.url.includes("lowyinstitute.org/publications/")));
assert.ok(lowyDots.filter((d) => d.x > 2018).every((d) => d.meta.modeChange));
const lowyNote = topicNote(main, "Lowy Institute");
assert.ok(lowyNote, "Lowy's question is in the notes when its readings are in view");
assert.ok(words(lowyNote).includes("Overall, are you satisfied or dissatisfied with the way things are going in Australia today?"));
assert.ok(words(lowyNote).includes("600 online and 600 telephone"));
assert.ok(words(lowyNote).includes("never offered"), "Lowy's volunteered-only don't know is said");

const ipDots = chart.props.scatter.filter((d) => d.meta.pollster === "Ipsos");
assert.ok(ipDots.length >= 10, "the selected historical window shows many Australian Ipsos waves");
const firstIp = ipDots.find((d) => d.meta.dateLabel === "August 26th - September 9th 2016");
assert.ok(firstIp, "actual fieldwork period, not only the report month, rides the Australian dot");
assert.equal(firstIp.meta.sample, 1000);
assert.equal(firstIp.meta.sampleApprox, true);
assert.ok(firstIp.sub.includes("approximately 1,000"));
assert.ok(firstIp.sub.includes("no exact achieved n"));
assert.ok(ipDots.every((d) => d.meta.url && d.meta.url.includes("ipsos")));

assert.ok(!findAll(main.tree, (n) => n.tag === "$chart").some((n) =>
  (n.props.series || []).some((s) => s.id === "world-average")),
"the Global Average appears once, on the main chart, without the redundant separate comparison");

console.log("test-lowy-direction: OK (Lowy 47/48, 49/46 on main; Ipsos Australia's 90 waves on main; exact fields, approximate-AU samples; all visible question notes; Global Average on the main chart only)");
