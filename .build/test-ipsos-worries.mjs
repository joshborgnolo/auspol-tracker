/* Offline corpus pins for .build/ipsos-worries.mjs. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { buildWorriesData, parseWorriesReport, WORRIES_QUESTION } from "./ipsos-worries.mjs";

const SRC = path.resolve(".build/ipsos-direction-src");
const OUT = path.resolve("data/ipsos-worries.json");
const manifest = JSON.parse(fs.readFileSync(path.join(SRC, "manifest.json"), "utf8"));
const built = buildWorriesData(manifest, SRC);
const at = (ym) => built.waves.find((w) => w.month === ym);
const issue = (w, scope, key) => w[scope].find((r) => r.issue === key);

assert.equal(manifest.sources.length, 103);
assert.equal(built.unread.length, 0);
assert.equal(built.waves.length, 96);
assert.equal(built.coverage.first, "2016-09");
assert.equal(built.coverage.last, "2026-10");
assert.equal(built.coverage.wavesWithAustralia, 95);
assert.equal(built.coverage.australiaObservations, 941);
assert.equal(built.coverage.globalObservations, 1572);
assert.equal(built.question, WORRIES_QUESTION);
console.log("1. Every cached report reads; full-corpus coverage: OK");

{
  const w = at("2016-09");
  assert.equal(w.australia.length, 17);
  assert.equal(issue(w, "australia", "unemployment").share, 38);
  assert.equal(issue(w, "australia", "crime").share, 33);
  assert.equal(issue(w, "australia", "healthcare").share, 34);
  assert.equal(issue(w, "australia", "unemployment").sources[0].sourceUrl,
    "https://www.ipsos.com/sites/default/files/2016-10/What_Worries_the_World-Sep_2016.pdf");
}
{
  const w = at("2020-05");
  assert.equal(w.australia.length, 18);
  assert.equal(issue(w, "australia", "coronavirus").share, 60);
  assert.equal(issue(w, "australia", "unemployment").share, 50);
  assert.equal(w.globalAverage.length, 18);
}
{
  const w = at("2020-08");
  assert.equal(w.australia.length, 18);
  const tax = issue(w, "globalAverage", "taxes");
  assert.equal(tax.share, 13);
  assert.deepEqual(tax.shareVariants.map((v) => v.share).sort((a, b) => a - b), [13, 14]);
  assert.equal(tax.shareVariants.length, 2);
  assert.equal(issue(at("2020-11"), "globalAverage", "inequality").comparisonConflicts.changeMonth.length, 2);
}
console.log("2. Country tables, COVID labels and conflicting reprints: OK");

{
  const w = at("2026-04");
  assert.equal(w.australia.length, 18);
  assert.equal(w.globalAverage.length, 18);
  const inflation = issue(w, "australia", "inflation");
  assert.equal(inflation.share, 49);
  assert.equal(inflation.changeMonth, 6);
  assert.equal(inflation.changeYear, 3);
  assert.equal(issue(w, "australia", "education").share, 7);
  assert.equal(issue(w, "australia", "militaryConflict").share, 23);
  assert.equal(issue(w, "australia", "environment").share, 7);
  assert.equal(issue(w, "australia", "credit").share, 1);
}
for (const [ym, share] of [["2026-06", 46], ["2026-07", 45], ["2026-08", 49], ["2026-09", 44], ["2026-10", 45]]) {
  assert.equal(at(ym).australia.length, 1);
  assert.equal(issue(at(ym), "australia", "inflation").share, share);
}
{
  const w = at("2026-06");
  assert.deepEqual(w.globalAverage.map((r) => [r.issue, r.share]), [
    ["unemployment", 29], ["corruption", 28], ["inequality", 29], ["crime", 32], ["inflation", 32],
  ]);
}
console.log("3. Recent comparison columns and partial Australia spotlights: OK");

const seen = new Set();
for (const w of built.waves) {
  assert.match(w.month, /^\d{4}-\d{2}$/);
  assert.ok(w.sources.length > 0);
  for (const scope of ["australia", "globalAverage"]) {
    const keys = new Set();
    for (const row of w[scope]) {
      assert.ok(!keys.has(`${w.month}|${scope}|${row.issue}`));
      keys.add(`${w.month}|${scope}|${row.issue}`);
      assert.ok(Number.isFinite(row.share) && row.share >= 0 && row.share <= 100);
      assert.ok(row.sources.length > 0);
      for (const source of row.sources) {
        assert.ok(fs.existsSync(path.join(SRC, source.capture)));
        assert.ok(source.sourceUrl);
        seen.add(source.capture);
      }
      if (row.shareVariants) assert.ok(uniqueShares(row.shareVariants).length > 1);
    }
  }
}
assert.equal(seen.size, manifest.sources.length);
console.log("4. Schema, provenance, ranges and unique monthly issue rows: OK");

const text = JSON.stringify(built, null, 2) + "\n";
assert.ok(fs.existsSync(OUT), "run node .build/ipsos-worries.mjs to create the archive");
assert.equal(fs.readFileSync(OUT, "utf8"), text);
assert.equal(JSON.stringify(buildWorriesData(manifest, SRC)), JSON.stringify(built));
{
  const source = manifest.sources.find((s) => s.text === "What-Worries-the-World-April-2026-68271154.txt");
  const parsed = parseWorriesReport(fs.readFileSync(path.join(SRC, source.text), "utf8"), source);
  assert.equal(parsed.month, "2026-04");
  assert.ok(parsed.observations.some((r) => r.scope === "australia" && r.topic.key === "inflation" && r.share === 49));
}
console.log("5. Deterministic regeneration and committed JSON parity: OK");
console.log("test-ipsos-worries: all OK");

function uniqueShares(variants) { return [...new Set(variants.map((v) => v.share))]; }
