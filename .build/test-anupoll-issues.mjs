#!/usr/bin/env node
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildStore, validateStore, WAVES, ROOT, SRC, OUT } from "./extract-anupoll-issues.mjs";

const first = buildStore();
const second = buildStore();
assert.deepEqual(first, second, "two in-memory builds must be identical");
assert.deepEqual(validateStore(first), [], "store schema and source guards");
const committed = JSON.parse(readFileSync(OUT, "utf8"));
assert.deepEqual(first, committed, "generated JSON on disk must match a clean rebuild");
assert.equal(execFileSync(process.execPath, [join(ROOT, ".build/extract-anupoll-issues.mjs"), "--check"], { cwd: ROOT, encoding: "utf8" }).includes("Current: 19 waves"), true);

const waves = first.waves;
const at = n => waves[n - 1];
const row = (n, side, label) => at(n).questions[side].responses.find(r => r.label === label);
const compact = s => s.replace(/\s+/g, " ");
const numberForms = n => {
  const s = String(n), forms = new Set([s]);
  if (s.startsWith("0.")) forms.add(s.slice(1));
  if (s.endsWith(".0")) forms.add(s.slice(0, -2));
  return [...forms].map(v => v.replace(".", "\\."));
};
const sourceText = n => {
  const spec = WAVES[n - 1];
  assert.ok(spec?.file, `wave ${n} has a public report`);
  return readFileSync(join(SRC, spec.file.replace(/\.pdf$/, ".raw.txt")), "utf8");
};

// Period frame and exact reported coverage.
assert.equal(waves.length, 19);
assert.deepEqual(waves.map(w => w.wave), Array.from({ length: 19 }, (_, i) => i + 1));
assert.equal(waves.filter(w => w.questions.first.responses.length > 0).length, 18);
assert.equal(waves.filter(w => w.questions.second.responses.length > 0).length, 13);
for (const side of ["first", "second"]) {
  assert.equal(waves.filter(w => w.questions[side].coverage === "complete-printed-response-table").length, 12);
}
assert.equal(at(19).title, "ANU 2015: National Identity".replace("ANU", "ANU Poll"));
assert.equal(at(19).fieldwork.reportEnd, "2015-03-15");
assert.equal(at(19).fieldwork.adaCumulativeEnd, "2015-03-15");
assert.equal(at(20 - 1).questions.second.prompt,
  "What do you think is the second most important problem facing Australia today?");
assert.equal(waves.some(w => /Social Class/i.test(w.title)), false);
const officialWaveMetadata = JSON.parse(readFileSync(join(SRC, "datacite-wave-metadata.json"), "utf8"));
assert.match(officialWaveMetadata.find(m => m.wave === 19).descriptions[0].description, /nineteenth/);
assert.match(officialWaveMetadata.find(m => m.wave === 20).descriptions[0].description, /twentieth/);
assert.match(officialWaveMetadata.find(m => m.wave === 11).descriptions[0].description, /eleventh/);
assert.equal(first.source.poll20Exclusion.reason.includes("twentieth"), true);

// No country/rural/future question has leaked into the national 'today' frame.
for (const w of waves) {
  assert.ok(w.fieldwork.reportStart >= "2008-01-01" && w.fieldwork.reportEnd <= "2015-12-31");
  for (const side of ["first", "second"]) {
    const q = w.questions[side];
    if (q.coverage === "unavailable-public-source-gap") {
      assert.equal(q.prompt, null);
      assert.equal(q.responses.length, 0);
    } else {
      assert.match(q.prompt, /most important problem facing Australia today\?$/);
      assert.doesNotMatch(q.prompt, /rural Australia|five years/i);
      if (side === "first") assert.doesNotMatch(q.prompt, /second most important/i);
      if (side === "second") assert.match(q.prompt, /second most important problem/);
      assert.equal(q.base.sampleN, w.respondentsReport);
    }
  }
}
assert.equal(at(11).title, "ANU 2011: Food Security".replace("ANU", "ANU Poll"));
assert.equal(at(11).report, null);
assert.equal(at(11).respondentsReport, null);
assert.equal(at(11).questions.first.prompt, null);
assert.equal(at(11).questions.second.prompt, null);
assert.match(first.source.poll11FoodSecurityGap.accessResult, /HTTP 400.*required Guestbook response/);
assert.equal(first.source.poll11FoodSecurityGap.publicTechnicalReport.restricted, false);
assert.match(first.source.derivation, /No respondent TSV was downloaded or committed/);

// Selected early printed series stay partial, with no completion to 100 or
// transformation into a first-plus-second 'mentions' metric.
assert.deepEqual(at(1).questions.first.responses.map(r => [r.label, r.percent]), [
  ["Economy", 18], ["Environment", 19], ["Water management", 8], ["Housing affordability", 7],
  ["Interest rates", 7], ["Health care", 5], ["Education", 4],
]);
assert.deepEqual(at(1).questions.second.responses.map(r => [r.label, r.percent]), [
  ["Environment (including global warming and sustainability)", 13], ["Economy/jobs", 17],
]);
assert.equal(row(2, "first", "Environment").percent, 23);
assert.equal(row(2, "first", "Economy").percent, 23);
assert.equal(row(2, "first", "Housing affordability").percent, 4);
assert.equal(row(3, "first", "Economy").percent, 22);
assert.equal(row(3, "first", "Environment").percent, 18);
assert.equal(row(3, "first", "Health care").percent, 7);
assert.equal(row(4, "first", "Economy/jobs").percent, 52);
assert.match(at(4).note, /prose says 53.*table says 52/);
assert.equal(at(6).questions.first.checks.responsePercentSum, 90);
assert.match(at(6).note, /sum to 90 per cent, not 100/);
assert.equal(at(6).questions.second.coverage, "unavailable-public-source-gap");
assert.match(at(6).questions.second.sourceLabel, /^No separate second-choice table/);
assert.doesNotMatch(at(6).questions.second.sourceLabel, /Food Security/);
for (const n of [1, 2, 3, 4, 5, 6]) {
  assert.equal(at(n).questions.first.coverage, "selected-printed-responses-not-a-complete-codebook");
  assert.ok(at(n).questions.first.base.validN == null);
}
assert.match(sourceText(4), /1 Economy\/jobs 52/);
assert.doesNotMatch(sourceText(4), /1 Economy\/jobs 53/);
assert.match(sourceText(6), /Other 26 \(-4\)/);

// Full-table anchors pin labels, counts and weighted percentages verbatim.
const anchorCases = [
  [7, "first", "Economy/jobs", 200, 16.7],
  [7, "second", "Economy/jobs", 155, 13.5],
  [8, "second", "No answer given", 83, 6.9],
  [9, "second", "Refused", 0, 0],
  [10, "second", "Trade balance", 5, 0.4],
  [12, "second", "Carbon tax", 64, 3.2],
  [13, "second", "Economy/jobs", 353, 17.5],
  [14, "first", "Economy/jobs", 363, 30.3],
  [14, "second", "Economy/jobs", 236, 21.2],
  [15, "second", "Other", 11, 1.0],
  [16, "second", "The budget", 35, 3.2],
  [17, "first", "Rural/farming issues", 4, 0.3],
  [17, "second", "Rural/farming issues", 12, 0.8],
  [19, "first", "Economy/jobs", 317, 26.4],
  [19, "second", "Economy/jobs", 227, 20.4],
];
for (const [n, side, label, count, percent] of anchorCases) {
  assert.equal(row(n, side, label).count, count, `wave ${n} ${side} ${label} count`);
  assert.equal(row(n, side, label).percent, percent, `wave ${n} ${side} ${label} percent`);
  const countPattern = numberForms(count).join("|");
  const percentPattern = numberForms(percent).join("|");
  assert.match(compact(sourceText(n)), new RegExp(`${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+(?:${countPattern})\\s+(?:${percentPattern})(?:\\D|$)`), `wave ${n} ${side} ${label} source row`);
}
// Source order is reversed in poll 14, so parity must be explicit, not ordinal.
assert.ok(sourceText(14).indexOf("And what do you think is the second most important") <
  sourceText(14).lastIndexOf("What do you think is the most important problem"));
assert.notDeepEqual(at(14).questions.first.responses, at(14).questions.second.responses);
// National Identity has duplicate Frequency headers; first and second must not alias.
assert.notDeepEqual(at(19).questions.first.responses, at(19).questions.second.responses);
assert.equal(row(18, "second", "Afghan war").count, null);
assert.equal(row(18, "second", "Afghan war").percent, 0);
assert.equal(at(18).questions.second.checks.responseCountCellsMissing, 1);
assert.equal(at(18).questions.second.checks.responseCountSumAvailable, 1132);
assert.ok(!at(18).questions.second.responses.some(r => /Refused/.test(r.label) && /Afghan/.test(r.label)));

// Printed bases, including missing/skipped/overall rows, are not inferred.
const bases = [
  [7, "first", 1200, null, null, 1200],
  [7, "second", 1143, 57, 1200, 1200],
  [8, "second", 1200, null, null, 1200],
  [9, "second", 1093, 107, null, 1200],
  [10, "second", 1108, 105, null, 1213],
  [12, "second", 1919, 82, null, 2001],
  [13, "second", 1878, null, null, 2020],
  [14, "second", 1111, null, null, 1200],
  [15, "second", 1076, null, null, 1142],
  [16, "second", 1091, null, null, 1204],
  [17, "second", 1388, null, null, 1388],
  [18, "second", 1133, null, null, 1201],
  [19, "second", 1113, 87, null, 1200],
];
for (const [n, side, validN, skippedN, overallN, sampleN] of bases) {
  const b = at(n).questions[side].base;
  assert.deepEqual([b.validN, b.skippedN, b.printedOverallN, b.sampleN], [validN, skippedN, overallN, sampleN], `wave ${n} ${side} base`);
}
assert.deepEqual(at(7).questions.second.printedFooter, [
  { label: "Total", count: 1143, percent: 100 },
  { label: "Missing", count: 57, percent: null },
  { label: "Total (overall)", count: 1200, percent: null },
]);
assert.deepEqual(at(19).questions.second.printedFooter, [
  { label: "Missing", count: 87, percent: null },
  { label: "Total", count: 1113, percent: 100 },
]);
assert.equal(at(19).questions.second.checks.responseCountSum, 1111);
assert.equal(at(19).questions.second.checks.countSumEqualsValidN, false);
assert.equal(at(18).questions.second.checks.percentWithinOnePointOf100, false);

// Preserve proven divergence rather than manufacturing reconciliation.
for (const n of [1, 5, 7, 13, 15]) assert.equal(at(n).fieldwork.reportDiffersFromAda, true);
for (const n of [2, 3, 4, 6, 8, 9, 10, 11, 12, 14, 16, 17, 18, 19]) assert.equal(at(n).fieldwork.reportDiffersFromAda, false);
assert.equal(at(12).report.reportNumberPrinted, 11);
assert.equal(at(12).wave, 12);
assert.equal(at(18).report.reportNumberPrinted, 17);
assert.equal(at(18).wave, 18);
assert.match(at(12).note, /ADA identifies this as poll 12/);
assert.match(at(18).note, /ADA identifies this as poll 18/);

// Deposit metadata proves only access/file identity, never respondent variables.
assert.equal(first.source.depositedFiles.length, 5);
for (const f of first.source.depositedFiles) {
  assert.equal(f.restricted, true);
  assert.match(f.md5, /^[0-9A-F]{32}$/);
}
assert.deepEqual(first.source.depositedFiles.map(f => f.id), [4601, 4602, 4603, 4604, 4605]);
assert.equal(first.source.depositedFiles[0].bytes, 44265);
assert.equal(first.source.depositedFiles[1].bytes, 16641);
assert.equal(first.source.depositedFiles[4].bytes, 3092978);
assert.equal(first.source.cumulativeDataset.variableNamesAndNumericCodes, null);
assert.match(first.source.cumulativeDataset.codebookAccess, /403 Not authorized/);
assert.match(first.source.mentionCombination, /Not computed or included/);
assert.match(first.source.poll11FoodSecurityGap.accessResult, /guestbookID 2/);

// All provenance stays official, fingerprinted, and free of respondent rows.
for (const w of waves) {
  if (!w.report) continue;
  assert.match(w.report.url, /^https:\/\/polis\.cass\.anu\.edu\.au\//);
  assert.match(w.report.sha256, /^[0-9A-F]{64}$/);
  assert.equal(w.report.cache.startsWith(".build/anupoll-issues-src/"), true);
}
assert.equal(first.source.poll20Exclusion.doi, "10.4225/87/p5zkme");
assert.equal(waves.every(w => !/social-class-sept-2015/i.test(w.report?.cache || "")), true);
for (const w of waves) {
  for (const side of ["first", "second"]) {
    for (const r of w.questions[side].responses) {
      assert.ok(!("mentionCount" in r) && !("mentions" in r) && !("combined" in r));
      assert.equal(typeof r.label, "string");
      assert.ok(r.label.length > 0 && r.label.length < 110, `wave ${w.wave} ${side}: ${r.label}`);
      assert.ok(r.count === null || Number.isFinite(r.count));
      assert.ok(Number.isFinite(r.percent));
    }
  }
}
assert.doesNotMatch(readFileSync(OUT, "utf8"), /"respondents"\s*:\s*\[/);

console.log("ANUpoll issues: parity, labels, frame, separate first/second bases, provenance, source guards and idempotence OK");
console.log("Coverage: 18 first-choice waves; 13 second-choice waves; complete printed tables for both in 12 waves; poll 11 Food Security blocked by ADA guestbook and raw deposit restricted");
