/* Offline pins for the Scanlon Mapping Social Cohesion MIP historical archive. */
import assert from "node:assert/strict";
import fs from "node:fs";
import { buildScanlonIssues } from "./extract-scanlon-issues.mjs";

const data = buildScanlonIssues();
const wave = (id) => {
  const found = data.waves.find((w) => w.id === id);
  assert.ok(found, `missing wave ${id}`);
  return found;
};
const category = (id, categoryId) => {
  const found = wave(id).categories.find((c) => c.id === categoryId);
  assert.ok(found, `${id}: missing category ${categoryId}`);
  return found;
};
const shares = (id) => wave(id).categories.map((c) => c.share);

const expectedCounts = {
  "2011": 21, "2012": 21, "2013": 21, "2014": 21, "2015": 21,
  "2016": 22, "2017": 22, "2018-rdd": 22, "2018-lina": 22,
  "2019-rdd": 19, "2019-lina": 19, "2020-july": 20,
  "2020-november": 20, "2021-july": 20, "2022-july": 9,
  "2023-july": 3, "2024-july": 8, "2025-july": 2,
  "2026-june-july": 12,
};
assert.equal(data.waves.length, 19);
assert.deepEqual(data.coverage.reportYears, Array.from({ length: 16 }, (_, i) => 2011 + i));
assert.equal(data.coverage.fullPrintedDistributions, 14);
assert.equal(data.coverage.selectedOrMostCommonDistributions, 5);
assert.equal(data.coverage.categoryRows, 325);
assert.deepEqual(data.coverage.categoryRowsByWave, expectedCounts);
for (const [id, count] of Object.entries(expectedCounts)) assert.equal(wave(id).categories.length, count, id);
assert.equal(data.sources.length, 17);
assert.equal(data.rawDataAccess.respondentRowsInArchive, 0);
assert.equal(data.rawDataAccess.suppliedDepositDois.length, 13);
console.log("1. Wave/mode coverage, report-year targets and category counts: OK");

assert.equal(wave("2011").source.anchor, "Table 6");
assert.equal(wave("2011").source.caption, "Table 6: ‘What do you think are the most important problems facing Australia today?’");
assert.equal(wave("2011").question, "What do you think are the most important problems facing Australia today?");
assert.equal(wave("2011").base.unweightedN, 2001);
assert.equal(wave("2011").base.source.reportId, "scanlon-2012");
assert.match(wave("2011").base.source.anchor, /Table 11/);
assert.equal(wave("2026-june-july").source.anchor, "Figure 5");
assert.equal(wave("2026-june-july").source.caption, "Figure 5. ‘What do you think is the most important problem facing Australia today?’ Weighted % of adults citing most common problems, 2026");
assert.equal(wave("2026-june-july").question, "What do you think is the most important problem facing Australia today?");
const expectedAnchors = {
  "2012": "Table 11", "2013": "Table 8", "2014": "Table 9", "2015": "Table 10",
  "2016": "Table 9", "2017": "Table 16", "2018-rdd": "Table 12",
  "2018-lina": "Table 12", "2019-rdd": "Table 16", "2019-lina": "Table 16",
  "2020-july": "Table 10", "2020-november": "Table 10", "2021-july": "Table 8",
};
for (const [id, anchor] of Object.entries(expectedAnchors)) assert.equal(wave(id).source.anchor, anchor, id);
for (const source of data.sources) {
  assert.ok(source.url.startsWith("https://scanloninstitute.org.au/wp-content/uploads/"), source.id);
  assert.match(source.pdfSha256, /^[0-9a-f]{64}$/, source.id);
  assert.match(source.textSha256, /^[0-9a-f]{64}$/, source.id);
}
console.log("2. 2011 Table 6, 2026 Figure 5, wording, bases and source provenance: OK");

assert.equal(category("2011", "immigration-population-growth-concern").share, 5.2);
assert.equal(category("2011", "immigration-population-too-low-need-more-people-supportive").share, 1.7);
assert.equal(category("2011", "immigration-population-printed-subtotal").share, 6.9);
assert.equal(category("2011", "asylum-seekers-negative-comment").share, 4);
assert.equal(category("2011", "asylum-seekers-poor-treatment-sympathy-refugees").share, 2.6);
assert.equal(category("2011", "asylum-seekers-printed-subtotal").share, 6.6);
assert.equal(category("2011", "environment-climate-change-water-shortages-concern").share, 11.4);
assert.equal(category("2011", "environment-overreaction-climate-change-carbon-tax-sceptical").share, 6.3);
assert.equal(category("2011", "environment-printed-subtotal").share, 17.7);
assert.equal(category("2011", "immigration-population-growth-concern").polarity, "concern");
assert.equal(category("2011", "immigration-population-too-low-need-more-people-supportive").polarity, "supportive");
assert.equal(category("2011", "asylum-seekers-negative-comment").polarity, "negative-comment");
assert.equal(category("2011", "asylum-seekers-poor-treatment-sympathy-refugees").polarity, "sympathetic");
assert.equal(category("2012", "economy-unemployment-poverty").share, 35.9);
assert.equal(category("2013", "asylum-seekers-negative-comment").share, 9.8);
assert.equal(category("2014", "immigration-population-too-low-need-more-people-supportive").share, 0.2);
assert.equal(category("2015", "defence-national-security-terrorism").share, 9.9);
assert.equal(category("2016", "racism").share, 4.1);
assert.equal(category("2017", "housing-shortage-affordability-interest-rates").share, 5.7);
console.log("3. Opposed immigration/asylum/climate codes and changing early-wave categories: OK");

assert.match(wave("2018-rdd").sampleDesign.mode, /Random Digit Dialling/);
assert.match(wave("2018-lina").sampleDesign.mode, /Life in Australia/);
assert.equal(category("2018-rdd", "environment-climate-change-water-shortages-concern").share, 10);
assert.equal(category("2018-lina", "environment-climate-change-water-shortages-concern").share, 5);
assert.equal(wave("2018-rdd").base.unweightedN, 1500);
assert.equal(wave("2018-lina").base.unweightedN, 2260);
assert.equal(category("2019-rdd", "environment-climate-change-water-shortages-concern").share, 19);
assert.equal(category("2019-lina", "environment-climate-change-water-shortages-concern").share, 17);
assert.equal(category("2019-rdd", "economy-unemployment-poverty").share, 28);
assert.equal(category("2019-lina", "economy-unemployment-poverty").share, 29);
assert.equal(wave("2019-rdd").base.unweightedN, 1500);
assert.equal(wave("2019-lina").base.unweightedN, 2033);
assert.deepEqual(wave("2020-july").sampleDesign.fieldwork, { start: "2020-07-14", end: "2020-07-27" });
assert.deepEqual(wave("2020-november").sampleDesign.fieldwork, { start: "2020-11-09", end: "2020-11-23" });
assert.equal(category("2020-july", "covid-19-including-impact-on-economy").share, 63);
assert.equal(category("2020-november", "covid-19-including-impact-on-economy").share, 32);
assert.equal(category("2020-july", "economy-unemployment-poverty").share, 15);
assert.equal(category("2020-november", "economy-unemployment-poverty").share, 24);
assert.equal(category("2021-july", "covid-19-including-impact-on-economy").share, 59);
assert.equal(wave("2020-july").base.unweightedN, 3090);
assert.equal(wave("2020-november").base.unweightedN, 2793);
console.log("4. Parallel 2018/2019 modes and distinct July/November 2020 waves: OK");

assert.deepEqual(shares("2022-july"), [9, 39, 17, 6, 4, 4, 4, 3, 1]);
assert.deepEqual(shares("2023-july"), [48, 14, 11]);
assert.deepEqual(shares("2024-july"), [49, 14, 7, 5, 4, 4, 4, 2]);
assert.deepEqual(shares("2025-july"), [58, 5]);
assert.deepEqual(shares("2026-june-july"), [36, 11, 10, 9, 7, 5, 5, 4, 4, 1, 1, 1]);
assert.equal(category("2025-july", "economic-and-housing-issues-printed-combination").role, "printed-combined-category");
for (const id of ["2022-july", "2023-july", "2024-july", "2025-july", "2026-june-july"]) {
  assert.equal(wave(id).coverage.completeCodedDistribution, false, id);
  assert.equal(wave(id).base.unweightedN, null, id);
  assert.equal(wave(id).base.validResponseN, null, id);
  assert.equal(wave(id).distributionTotal.printed, null, id);
  assert.equal(wave(id).distributionTotal.computedFromNonSubtotals, null, id);
}
assert.equal(wave("2022-july").base.surveySampleN, 5757);
assert.equal(wave("2023-july").base.surveySampleN, 7454);
assert.equal(wave("2024-july").base.surveySampleN, 7965);
assert.equal(wave("2025-july").base.surveySampleN, undefined);
assert.equal(wave("2026-june-july").base.surveySampleN, 10020);
assert.equal(wave("2025-july").question, null);
console.log("5. Verifiable 2022–2026 aggregates only; no manufactured full distributions: OK");

const expectedSums = {
  "2011": 100.1, "2012": 100, "2013": 100, "2014": 99.9, "2015": 100,
  "2016": 100, "2017": 99.9, "2018-rdd": 98, "2018-lina": 102,
  "2019-rdd": 102, "2019-lina": 100, "2020-july": 100,
  "2020-november": 99, "2021-july": 100,
};
for (const w of data.waves) {
  assert.equal(new Set(w.categories.map((c) => c.id)).size, w.categories.length, `${w.id}: duplicate category id`);
  for (const c of w.categories) {
    assert.ok(Number.isFinite(c.share) && c.share >= 0 && c.share <= 100, `${w.id}/${c.id}`);
    assert.ok(c.sourceLabel && c.evidence, `${w.id}/${c.id}: missing source evidence`);
    if (c.role === "printed-subtotal") for (const component of c.componentIds) assert.ok(w.categories.some((x) => x.id === component), `${w.id}/${c.id}: missing component ${component}`);
  }
  if (w.coverage.completeCodedDistribution) {
    assert.equal(w.distributionTotal.printed, 100, w.id);
    assert.equal(w.distributionTotal.computedFromNonSubtotals, expectedSums[w.id], `${w.id}: non-subtotal sum`);
    assert.ok(Number.isInteger(w.base.unweightedN) && w.base.unweightedN > 0, `${w.id}: base`);
    assert.ok(w.categories.some((c) => c.id.startsWith("other-nothing-dont-know")), `${w.id}: full-table Other row missing`);
  }
}
console.log("6. Printed sums, retained rounding, subtotal relations and finite source cells: OK");

const anubis = fs.readFileSync(".build/scanlon-issues-src/ada-10.26193-PUIVYD-response.html", "utf8");
assert.match(anubis, /Making sure you&#39;re not a bot|anubis_challenge/);
assert.equal(data.rawDataAccess.status, "anubis-blocked");
assert.match(data.limitations[0], /No respondent files or codebooks were available/);
assert.match(data.limitations[2], /2022–2026/);
assert.match(data.limitations[3], /not split/);
console.log("7. ADA block and exact unavailable evidence remain explicit: OK");

const expected = JSON.stringify(data, null, 2) + "\n";
assert.ok(fs.existsSync("data/scanlon-issues.json"), "generate data/scanlon-issues.json first");
assert.equal(fs.readFileSync("data/scanlon-issues.json", "utf8"), expected);
assert.deepEqual(buildScanlonIssues(), data);
console.log("8. Deterministic regeneration and generated-file parity: OK");
console.log("test-scanlon-issues: all OK");
