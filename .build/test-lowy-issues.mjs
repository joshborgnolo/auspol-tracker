import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildStore,
  measureCoverage,
  parseChartPayload,
  parseLiteral,
  readCachedInputs,
} from "./extract-lowy-issues.mjs";

const HERE = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(HERE), "..");
const inputs = readCachedInputs();
const doc = buildStore(inputs);
const chart = parseChartPayload(inputs.chartHtml, "test full page");
const embed = parseChartPayload(inputs.embedHtml, "test embed");
const disk = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "lowy-issues.json"), "utf8"));
const cell = (year, split, category) => doc.values[doc.dictionary.years.indexOf(year)][split][category];
const plain = (text) => text.replace(/\s+/g, " ").trim();

// 1. Both official forms and the checked-in generated store carry exactly the
// same vocabulary and full grid. No values are read from the rendered bars.
assert.deepEqual(chart, embed);
assert.deepEqual(disk, doc);
assert.deepEqual(doc.dictionary.years, [2013, 2016, 2019, 2025]);
assert.equal(doc.dictionary.categories.length, 14);
assert.equal(doc.dictionary.responses.length, 7);
assert.equal(doc.dictionary.splits.length, 50);
assert.deepEqual(doc.dictionary.responses, [
  "Labor Party",
  "Liberal–National Coalition",
  "Both equally",
  "Greens",
  "One Nation",
  "Neither",
  "Don’t know\u200a/\u200ano view",
]);
assert.ok(doc.dictionary.responses[6].includes("know\u200a/\u200ano"), "hair spaces around the slash are retained verbatim");
console.log("1. full-page/embed/store parity and verbatim dictionaries: OK");

// 2. Every one of the 2,800 year × split × issue positions is checked for
// shape, and populated rows always span all seven response positions.
const coverageByYear = doc.dictionary.years.map((year, yi) => {
  let populated = 0, empty = 0, blankResponses = 0, zeroResponses = 0;
  assert.equal(doc.values[yi].length, 50, `${year}: all split positions`);
  for (const splitPlane of doc.values[yi]) {
    assert.equal(splitPlane.length, 14, `${year}: all issue positions per split`);
    for (const row of splitPlane) {
      if (row.length === 0) { empty++; continue; }
      populated++;
      assert.equal(row.length, 7, `${year}: all response positions`);
      for (const value of row) {
        assert.ok(typeof value === "number" || value === "" || value === null, `${year}: cell value type`);
        if (value === "") blankResponses++;
        if (value === 0) zeroResponses++;
      }
    }
  }
  return { populated, empty, blankResponses, zeroResponses };
});
assert.deepEqual(coverageByYear, [
  { populated: 328, empty: 372, blankResponses: 0, zeroResponses: 759 },
  { populated: 368, empty: 332, blankResponses: 0, zeroResponses: 651 },
  { populated: 450, empty: 250, blankResponses: 0, zeroResponses: 1007 },
  { populated: 350, empty: 350, blankResponses: 700, zeroResponses: 669 },
]);
assert.deepEqual(doc.coverage, {
  yearSplitCategoryCells: 2800,
  populatedCategoryCells: 1496,
  emptyCategoryCells: 1304,
  nullCategoryCells: 0,
  responseCells: 10472,
  numericResponseCells: 9772,
  zeroResponseCells: 3086,
  emptyResponseCells: 700,
  nullResponseCells: 0,
});
console.log("2. complete 4 × 50 × 14 × 7 grid and coverage accounting: OK");

// 3. Literal spot oracles, including full Total grids for the earlier election-
// specific battery and the latest general battery. [] and "" must not collapse
// into 0; numeric 0 must not collapse into either missing representation.
const expected2013Total = [
  [24, 55, 10, 0, 0, 4, 7],
  [25, 57, 2, 0, 0, 11, 6],
  [],
  [26, 53, 11, 0, 0, 3, 7],
  [],
  [42, 40, 5, 0, 0, 4, 8],
  [44, 40, 5, 0, 0, 4, 7],
  [45, 40, 1, 0, 0, 7, 6],
  [],
  [24, 59, 2, 0, 0, 6, 9],
  [25, 61, 3, 0, 0, 6, 6],
  [], [], [],
];
const expected2025Total = [
  [], [],
  [30, 36, 0, "", "", 0, 33],
  [],
  [35, 37, 0, "", "", 0, 28],
  [], [],
  [45, 24, 0, "", "", 0, 31],
  [], [],
  [38, 36, 0, "", "", 0, 26],
  [46, 21, 0, "", "", 0, 32],
  [32, 28, 0, "", "", 0, 39],
  [36, 28, 0, "", "", 0, 35],
];
assert.deepEqual(cell(2013, 0, 0) && doc.values[0][0], expected2013Total);
assert.deepEqual(doc.values[3][0], expected2025Total);
assert.deepEqual(cell(2016, 0, 7), [52, 31, 1, 4, 0, 5, 7]);
assert.deepEqual(cell(2019, 0, 4), [43, 48, 1, 0, 0, 4, 3]);
assert.deepEqual(cell(2019, 0, 8), [44, 46, 1, 0, 0, 4, 4]);
assert.deepEqual(cell(2019, 0, 2), []);
assert.deepEqual(cell(2025, 0, 0), []);
const humanRights = cell(2025, 0, 11);
assert.equal(humanRights[2], 0, "Both equally is an actual chart zero");
assert.equal(humanRights[3], "", "Greens is a source blank, not a zero");
assert.equal(humanRights[4], "", "One Nation is a source blank, not a zero");
assert.equal(humanRights[5], 0, "Neither is an actual chart zero");
assert.equal(cell(2013, 0, 0)[3], 0, "2013 Greens=0 remains numeric zero");
console.log("3. full 2013/2025 spot grids, empty rows, blank options and actual zeros: OK");

// 4. Split names are not ids. Repeated state/territory labels occupy separate
// demographic sections and cannot be merged into a label-keyed object.
for (const [label, positions] of Object.entries({ SA: [11, 23], WA: [12, 24], TAS: [13, 25], NT: [14, 26], ACT: [8, 27] })) {
  assert.deepEqual(doc.dictionary.splits.flatMap((name, index) => name === label ? [index] : []), positions, `${label}: both source positions`);
}
assert.notDeepEqual(doc.values[3][11], doc.values[3][23], "state SA and capital/rest-section SA retain different rows");
const populatedSplitCounts = doc.dictionary.years.map((year, yi) => doc.values[yi].filter((split) => split.some((row) => row.length > 0)).length);
assert.deepEqual(populatedSplitCounts, [41, 46, 50, 50]);
console.log("4. duplicate split labels and year-specific demographic coverage: OK");

// 5. Reports verify only provenance and overall survey metadata. In particular,
// no subgroup n is inferred from the row's demographic label or poll genre.
const expected2025Question = "Which party, either the Labor Party or the Liberal–National Coalition, do you personally think would do a better job at handling each of these issues:";
assert.deepEqual(doc.waves.map((wave) => [wave.year, wave.dateStart, wave.dateEnd, wave.sample, wave.question]), [
  [2013, "2013-03-04", "2013-03-20", 1002, "Now, about the Australian federal election which will be held on the 14th September this year. Which party, either the Labor Party or the Liberal–Nationals Coalition, do you personally think would do a better job of handling each of the following issues?"],
  [2016, "2016-02-26", "2016-03-15", 1202, "Now about the Australian federal election which will be held later this year. Which party, either the Labor Party or the Liberal-Nationals Coalition, do you personally think would do a better job of handling each of the following issues:"],
  [2019, "2019-03-12", "2019-03-25", 2130, null],
  [2025, "2025-03-03", "2025-03-16", 2117, expected2025Question],
]);
assert.ok(doc.waves.every((wave) => wave.sampleBasis.includes("no subgroup sample sizes")));
assert.ok(doc.waves[0].mode.startsWith("Fixed-line and mobile telephone fieldwork by Field Works Market Research"));
assert.ok(doc.waves[1].mode.startsWith("Fixed-line and mobile telephone fieldwork by Field Works Market Research"));
assert.ok(doc.waves[2].mode.includes("89% online and 11%"));
assert.ok(doc.waves[3].mode.includes("99% online and 1%"));
assert.equal(doc.source.question, expected2025Question);
const report2013 = plain(inputs.reports[2013]);
assert.ok(report2013.includes(doc.waves[0].question), "2013 full election stem is in Figure 1");
assert.ok(/Managing Australia’s relations with\s+40%\s+42%\s+5%\s+4%\s+9%\s+Asia/.test(inputs.reports[2013]), "report Table 1 says 9 for this one total cell");
assert.equal(cell(2013, 0, 5)[6], 8, "the requested chart value 8 is preserved instead of replaced with report-table 9");
assert.ok(doc._provenance.includes("chart value is 8") && doc._provenance.includes("Table 1 prints 9"));
assert.ok(!plain(inputs.reports[2019]).includes("Better party by foreign policy issue"), "2019 null question is a coverage limit, not back-filled wording");
for (const year of doc.dictionary.years) {
  const pdf = fs.readFileSync(path.join(ROOT, ".build", "lowy-issues-src", `lowyinstitutepoll-${year}.pdf`));
  assert.equal(pdf.subarray(0, 4).toString(), "%PDF", `${year}: official PDF is cached`);
  assert.ok(inputs.reports[year].length > 10000, `${year}: deterministic text cache exists`);
}
console.log("5. exact stems loss flags, wave metadata, cached reports and chart/report discrepancy: OK");

// 6. The literal reader cannot run JavaScript, and null is not confused with
// blank or zero even when a future source cell uses it.
assert.deepEqual(parseLiteral('{a:[0,"",null,true,false,-1.25e2],s:"\\u2013"}'), {
  a: [0, "", null, true, false, -125], s: "–",
});
assert.throws(() => parseLiteral('{x:(()=>{throw new Error("must not run")})()}'), SyntaxError);
assert.throws(() => parseLiteral('{x:new Function("return 1")}'), SyntaxError);
assert.throws(() => parseLiteral('{x:process.exit(1)}'), SyntaxError);
const nullCategoryCounts = measureCoverage(
  { years: [2013], splits: ["Total"], categories: ["Example"], responses: ["A", "B"] },
  [[[null]]],
);
assert.equal(nullCategoryCounts.emptyCategoryCells, 1);
assert.equal(nullCategoryCounts.nullCategoryCells, 1);
assert.equal(nullCategoryCounts.populatedCategoryCells, 0);
const nullResponseCounts = measureCoverage(
  { years: [2013], splits: ["Total"], categories: ["Example"], responses: ["A", "B"] },
  [[[[0, null]]]],
);
assert.equal(nullResponseCounts.populatedCategoryCells, 1);
assert.equal(nullResponseCounts.numericResponseCells, 1);
assert.equal(nullResponseCounts.zeroResponseCells, 1);
assert.equal(nullResponseCounts.nullResponseCells, 1);
assert.equal(nullResponseCounts.emptyResponseCells, 0);
const extractorSource = fs.readFileSync(path.join(ROOT, ".build", "extract-lowy-issues.mjs"), "utf8");
assert.ok(!/\beval\s*\(|new\s+Function\s*\(|node:vm\b/.test(extractorSource), "no arbitrary JavaScript execution in extractor");
assert.ok(!/\.csv(?:[/"'?])/i.test(extractorSource), "no invented static CSV endpoint");
console.log("6. safe literal parsing, null preservation and no CSV/LLM figure shortcut: OK");

// 7. The production direction is offline and byte-for-byte reproducible.
const check = spawnSync(process.execPath, [path.join(ROOT, ".build", "extract-lowy-issues.mjs"), "--check"], {
  cwd: ROOT,
  encoding: "utf8",
  env: { ...process.env, http_proxy: "127.0.0.1:1", https_proxy: "127.0.0.1:1", HTTP_PROXY: "127.0.0.1:1", HTTPS_PROXY: "127.0.0.1:1" },
});
assert.equal(check.status, 0, `${check.stdout}\n${check.stderr}`);
assert.ok(check.stdout.includes("cached store is current"));
console.log("7. offline deterministic rebuild check: OK");
console.log("test-lowy-issues: all pass (4 years, 14 issues, 50 splits, 7 responses; 1496 populated rows and 700 blank response cells preserved)");
