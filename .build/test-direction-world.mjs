// Ipsos's Australian and Global Average direction data. Run after the site
// build: the producer reads PDFs; the build derives monthly waves and quantiles.
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
assert.ok(panel.includes("Ipsos") && panel.includes("Global Average"),
  "the Global Average remains labelled on the main national-direction chart");
assert.ok(!panel.includes("RdIpsosDirectionWorld"), "the redundant separate chart renderer is removed");

console.log(`test-direction-world: OK (${payload.waves.length} waves; October AU 36/64, world 37/63)`);
