import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { CORE_SOURCES, MEDIA_URL, buildJwsData, parseWave } from "./extract-jws-issues.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const SRC = path.join(HERE, "jws-issues-src");
const OUT = path.join(ROOT, "data", "jws-issues.json");
const SCRIPT = path.join(HERE, "extract-jws-issues.mjs");
const index = JSON.parse(fs.readFileSync(path.join(SRC, "source-index.json"), "utf8"));
const built = buildJwsData(index, SRC);
const wave = (n) => built.waves.find((w) => w.wave === n);
const family = (n, name) => wave(n).families[name];
const row = (n, name, label) => {
  const found = family(n, name).rows.find((r) => r.label === label);
  assert.ok(found, `wave ${n} ${name}: ${label}`);
  return found;
};
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

assert.equal(CORE_SOURCES.length, 26);
assert.deepEqual(CORE_SOURCES.map((s) => s.wave), range(18, 43));
assert.equal(new Set(CORE_SOURCES.map((s) => s.mediaId)).size, 26);
assert.equal(CORE_SOURCES.at(-1).sourceUrl, "https://www.jwsresearch.com/wp-content/uploads/True_Issues_43_131126.pdf");
assert.ok(MEDIA_URL.includes("search=True%20Issues&per_page=100"));
for (const s of CORE_SOURCES) {
  assert.ok(!/Special|Budget|Economic_Policy|AI_Report|State_Performance|APC/i.test(s.sourceUrl), `${s.wave}: special/method report is not a core wave`);
}
assert.equal(index.mediaRecords, 93);
assert.equal(index.sources.length, 17);
assert.deepEqual(index.sources.map((s) => s.wave), range(27, 43));
assert.equal(index.errors.length, 9);
assert.deepEqual(index.errors.map((e) => Number(e.match(/^wave (\d+):/)[1])), range(18, 26));
for (const error of index.errors) assert.match(error, /HTTP 404$/);
console.log("1. Core-wave selection, 93-record enumeration and actual 404 source errors: OK");

assert.equal(built.coverage.status, "partial");
assert.equal(built.coverage.parsedCoreWaves, 17);
assert.deepEqual(built.coverage.parsedCoreWaveNumbers, range(27, 43));
assert.deepEqual(built.coverage.unavailableCoreWaves, range(18, 26));
assert.deepEqual(built.coverage.unavailableEarlyWaves, range(1, 17));
assert.equal(built.coverage.totalSourceGaps, 26);
assert.equal(built.coverage.parseErrorCount, 0);
assert.deepEqual(built.parseErrors, []);
for (const name of ["unpromptedTopThree", "promptedTopFive", "governmentIssuePerformance", "organisationPerformance", "direction"])
  assert.equal(built.coverage.familyWaveCounts[name], 17, name);
assert.equal(built.sourceGaps.length, 26);
assert.equal(built.sourceGaps[0].knownDateLabel, "June 2013");
assert.equal(built.sourceGaps[16].knownDateLabel, "February 2019");
assert.equal(built.sourceGaps[17].knownDateLabel, "March 2019");
for (const gap of built.sourceGaps) {
  assert.equal(gap.observations, null, `wave ${gap.wave}: unknown is never zero`);
  assert.match(gap.note, /never zero/);
  if (gap.wave < 18) assert.equal(gap.sourceUrl, null);
  else assert.match(gap.sourceError, /HTTP 404/);
}
console.log("2. Partial-coverage and explicit 1–26 recovery-gap contract: OK");

/* CI's runner has no poppler: there the cached text twin is still pinned by its
   SHA-256 below, and only its re-derivation from the PDF is skipped */
const HAVE_PDFTOTEXT = !spawnSync("pdftotext", ["-v"]).error;
const cacheFiles = fs.readdirSync(SRC).sort();
assert.deepEqual(cacheFiles, ["source-index.json", ...range(27, 43).flatMap((w) => [`wave-${w}.pdf`, `wave-${w}.txt`])].sort());
for (const source of index.sources) {
  const pdf = fs.readFileSync(path.join(SRC, source.pdf));
  const text = fs.readFileSync(path.join(SRC, source.text), "utf8");
  assert.equal(pdf.subarray(0, 5).toString("latin1"), "%PDF-", `${source.wave}: real PDF bytes`);
  assert.equal(pdf.length, source.pdfBytes, `${source.wave}: byte count`);
  assert.equal(sha256(pdf), source.sha256, `${source.wave}: PDF hash`);
  assert.equal(sha256(Buffer.from(text)), source.textSha256, `${source.wave}: text hash`);
  if (HAVE_PDFTOTEXT) {
    const converted = execFileSync("pdftotext", ["-layout", path.join(SRC, source.pdf), "-"], { encoding: "utf8", maxBuffer: 1 << 27 });
    assert.equal(converted, text, `${source.wave}: cached text is exactly pdftotext -layout of the cached PDF`);
  }
  assert.match(text, new RegExp(`True Issues ${source.wave}`), `${source.wave}: report identity`);
  assert.ok(wave(source.wave), `${source.wave}: cache participates in full build`);
}
console.log("3. Every cached PDF, SHA-256 and " + (HAVE_PDFTOTEXT ? "pdftotext twin reproduces" : "text twin pinned (pdftotext not installed: re-derivation skipped)") + " and parses offline: OK");

const ROW_COUNTS = {
  27: [9, 20, 21], 28: [12, 22, 24], 29: [9, 22, 23], 30: [11, 22, 23],
  31: [10, 22, 23], 32: [10, 22, 24], 33: [11, 22, 23], 34: [11, 22, 22],
  35: [10, 25, 25], 36: [9, 25, 25], 37: [8, 25, 25], 38: [10, 25, 25],
  39: [9, 25, 25], 40: [12, 25, 25], 41: [10, 25, 25], 42: [11, 25, 25], 43: [9, 25, 25],
};
for (const w of built.waves) {
  const families = w.families;
  const counts = ROW_COUNTS[w.wave];
  assert.deepEqual([families.unpromptedTopThree.rows.length, families.promptedTopFive.rows.length,
    families.governmentIssuePerformance.rows.length], counts, `${w.wave}: salience and issue-index rows`);
  assert.equal(families.organisationPerformance.rows.length, 4, `${w.wave}: organisation rows`);
  assert.equal(families.direction.rows.length, 5, `${w.wave}: direction rows`);
  assert.equal(families.unpromptedTopThree.options, null);
  assert.deepEqual(families.promptedTopFive.options, families.promptedTopFive.rows.map((r) => r.label));
  assert.equal(families.governmentIssuePerformance.printedRatingsPerIssue, false);
  assert.match(families.unpromptedTopThree.selection, /unprompted/);
  assert.match(families.promptedTopFive.selection, /select five/);
  assert.notEqual(families.unpromptedTopThree.question, families.promptedTopFive.question);
  for (const name of Object.keys(families)) assert.ok(families[name].question, `${w.wave}: ${name} question`);
  for (const name of ["unpromptedTopThree", "promptedTopFive", "governmentIssuePerformance"]) {
    const labels = families[name].rows.map((r) => r.label);
    assert.equal(new Set(labels).size, labels.length, `${w.wave}: duplicate ${name} label`);
    for (const label of labels) {
      assert.match(label, /[A-Za-z]/);
      assert.ok(!/^(?:[*^#$]|and wages|COVID|families)/.test(label), `${w.wave}: annotation is not an issue: ${label}`);
      assert.ok(!/voters:|Hhold|HHI|Issues mentioned|Government should focus/.test(label), `${w.wave}: contaminated label: ${label}`);
    }
  }
  for (const r of families.unpromptedTopThree.rows.concat(families.promptedTopFive.rows))
    assert.ok(Number.isFinite(r.share) && r.share >= 0 && r.share <= 100, `${w.wave}: ${r.label}`);
  for (const r of families.governmentIssuePerformance.rows)
    assert.ok(Number.isInteger(r.index) && r.index >= 0 && r.index <= 100, `${w.wave}: ${r.label}`);
  for (const r of families.organisationPerformance.rows) {
    assert.deepEqual(Object.keys(r.ratings), ["veryGood", "good", "average", "poor", "veryPoor"]);
    assert.equal(r.ratings.dontKnow, undefined, "don't know is excluded from the five stored ratings");
    assert.ok(Number.isInteger(r.excludedShares.dontKnow));
    const sum = Object.values(r.ratings).reduce((a, b) => a + b, 0) + r.excludedShares.dontKnow;
    assert.ok(sum >= 95 && sum <= 105, `${w.wave}: ${r.label} ratings sum ${sum}`);
    assert.ok(Number.isInteger(r.index));
  }
  for (const r of families.direction.rows) {
    assert.deepEqual(Object.keys(r.ratings), ["right", "neither", "wrong", "unsure"]);
    const sum = Object.values(r.ratings).reduce((a, b) => a + b, 0);
    assert.ok(sum >= 95 && sum <= 105, `${w.wave}: ${r.label} direction sum ${sum}`);
    assert.ok(r.netLabel);
    if (r.net != null) assert.ok(Math.abs(r.net - (r.ratings.right - r.ratings.wrong)) <= 2);
  }
  assert.match(w.source.sha256, /^[0-9a-f]{64}$/);
  assert.match(w.source.textSha256, /^[0-9a-f]{64}$/);
  assert.ok(w.sample > 0);
  assert.match(w.date, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(w.dateStart, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(w.issuedDate, /^\d{4}-\d{2}-\d{2}$/);
}
console.log("4. Full-corpus family structure, labels, options, ranges and totals: OK");

assert.deepEqual([wave(27).dateStart, wave(27).date, wave(27).sample, wave(27).issuedDate],
  ["2022-03-04", "2022-03-08", 1000, "2022-03-16"]);
assert.equal(row(27, "unpromptedTopThree", "Hospitals, healthcare and ageing").share, 37);
assert.equal(row(27, "unpromptedTopThree", "The environment / Climate change").share, 27);
assert.equal(row(27, "promptedTopFive", "Cost of living").share, 65);
assert.equal(row(27, "governmentIssuePerformance", "The COVID-19 pandemic").index, 49);
assert.equal(row(27, "governmentIssuePerformance", "Hospitals, health care and ageing").index, 41);
assert.match(family(27, "unpromptedTopThree").question, /Please be as specific as you can\.$/);
assert.equal(row(31, "promptedTopFive", "Cost of living").share, 75);
assert.equal(wave(31).sample, 1225);
assert.deepEqual([wave(37).dateStart, wave(37).date], ["2025-01-31", "2025-02-04"]);
assert.deepEqual([wave(38).dateStart, wave(38).date], ["2025-08-29", "2025-09-01"]);
assert.equal(row(39, "unpromptedTopThree", "Immigration and border security").share, 19,
  "the next-line current-wave cell, not the One Nation demographic 50");
for (const [n, expected] of [[35, 26], [36, 25], [37, 27], [38, 17], [39, 17], [40, 23], [43, 33]]) {
  const interest = family(n, "promptedTopFive").rows.find((r) => /^Interest rates/.test(r.label));
  assert.equal(interest.share, expected, `wave ${n}: interest rates`);
}
assert.equal(row(40, "unpromptedTopThree", "Social cohesion (incl. dealing with radicalisation, violent extremism)").share, 6,
  "wrapped social-cohesion label survives intact");
assert.equal(row(35, "governmentIssuePerformance", "Interest rates^").index, 37,
  "a bare PDF % artefact is not part of the issue label");
assert.equal(wave(42).sample, 1230);
console.log("5. Historical fieldwork, wrapped labels, current-cell and interest-rate anchors: OK");

const W43 = [
  ["Cost of living", 62], ["The economy and finances", 32], ["Housing supply and affordability", 30],
  ["Law and order", 23], ["Immigration and border security", 20], ["Hospitals and healthcare", 20],
  ["The environment and climate change", 13], ["Employment and wages", 8], ["Interest rates", 7],
];
for (const [label, share] of W43) assert.equal(row(43, "unpromptedTopThree", label).share, share, label);
for (const [label, share] of [["Cost of living", 83], ["Housing supply and affordability", 50], ["The economy and finances", 47],
  ["Hospitals and healthcare", 46], ["Interest rates", 33], ["The environment and climate change", 22], ["Social cohesion (incl. dealing with radicalisation, violent extremism)*", 18]])
  assert.equal(row(43, "promptedTopFive", label).share, share, label);
for (const [label, indexValue] of [["Cost of living", 19], ["Housing supply and affordability", 26], ["Interest rates", 26], ["Innovation, science and technology", 49]])
  assert.equal(row(43, "governmentIssuePerformance", label).index, indexValue, label);
assert.deepEqual([wave(43).dateStart, wave(43).date, wave(43).issuedDate, wave(43).sample],
  ["2026-11-06", "2026-11-09", "2026-11-13", 1000]);
assert.equal(wave(43).source.url, "https://www.jwsresearch.com/wp-content/uploads/True_Issues_43_131126.pdf");
assert.equal(wave(43).source.mediaId, 8166);
console.log("6. Wave 43's printed salience, issue-index, fieldwork and source anchors: OK");

assert.deepEqual(row(43, "organisationPerformance", "Business and industry"), {
  key: "businessAndIndustry", label: "Business and industry",
  ratings: { veryGood: 3, good: 28, average: 49, poor: 13, veryPoor: 3 },
  excludedShares: { dontKnow: 4 }, index: 54,
});
assert.deepEqual(row(43, "organisationPerformance", "The Australian Government").ratings,
  { veryGood: 4, good: 17, average: 31, poor: 21, veryPoor: 26 });
assert.deepEqual(row(43, "organisationPerformance", "The Australian Government").excludedShares, { dontKnow: 1 });
assert.equal(row(43, "organisationPerformance", "The Australian Government").index, 38);
assert.deepEqual(row(38, "organisationPerformance", "The Australian Government").ratings,
  { veryGood: 5, good: 27, average: 34, poor: 17, veryPoor: 17 });
assert.equal(row(38, "organisationPerformance", "The Australian Government").excludedShares.dontKnow, 1,
  "don't know emitted before the wave-38 entity label is still recovered");
assert.equal(row(42, "organisationPerformance", "Business and industry").index, 56);
assert.deepEqual(family(43, "organisationPerformance").printedOptions,
  ["Very Good", "Good", "Average", "Poor", "Very Poor", "Don't Know"]);
assert.deepEqual(built.sourceReconciliationWarnings.map((w) => [w.wave, w.printedIndex, w.indexFromPrintedRoundedShares, w.residual]),
  [[42, 56, 52.5, 3.5], [43, 54, 51.75, 2.25]]);
console.log("7. Five printed ratings, excluded don't-know, displaced cells and source-index warnings: OK");

const D43 = [
  ["Your local community", { right: 26, neither: 44, wrong: 24, unsure: 6 }, 3, "+3"],
  ["Your own personal situation", { right: 26, neither: 42, wrong: 30, unsure: 2 }, -4, "-4"],
  ["Business and industry in Australia", { right: 17, neither: 42, wrong: 31, unsure: 11 }, -14, "-14"],
  ["Your state or territory economy", { right: 21, neither: 32, wrong: 41, unsure: 6 }, -20, "-20"],
  ["National economy", { right: 11, neither: 26, wrong: 59, unsure: 5 }, -48, "-48"],
];
for (const [label, ratings, net, netLabel] of D43) {
  const r = row(43, "direction", label);
  assert.deepEqual(r.ratings, ratings, label);
  assert.equal(r.net, net, label);
  assert.equal(r.netLabel, netLabel, label);
}
assert.deepEqual(row(27, "direction", "Your own personal situation").ratings,
  { right: 37, neither: 41, wrong: 16, unsure: 6 });
assert.equal(row(27, "direction", "Your own personal situation").net, 21);
assert.deepEqual(row(33, "direction", "Business and industry in Australia").ratings,
  { right: 23, neither: 45, wrong: 19, unsure: 13 });
assert.equal(row(33, "direction", "Business and industry in Australia").netLabel, "+3",
  "signed net emitted before the ratings");
assert.equal(row(38, "direction", "Business and industry in Australia").netLabel, "-<0.5");
assert.equal(row(38, "direction", "Business and industry in Australia").net, null);
assert.equal(row(42, "direction", "Your local community").netLabel, ">-0.5");
assert.equal(row(42, "direction", "Your local community").net, null);
assert.ok(row(41, "direction", "Your State or Territory economy"));
assert.equal(family(33, "direction").printedOptions[3], "Not sure / Don’t know");
assert.equal(family(43, "direction").printedOptions[3], "Not sure/ Don’t know");
console.log("8. Direction shares, before/after nets, sub-half nets and per-wave option spelling: OK");

const text43 = fs.readFileSync(path.join(SRC, "wave-43.txt"), "utf8");
{
  const corrupted = text43.replace(/Cost of living(\s+)62%/, (_, spaces) => `Cost of living${spaces}162%`);
  const parsed = parseWave(corrupted, 43);
  assert.ok(parsed.parseErrors.some((e) => e.includes("Cost of living") && e.includes("no readable current share")));
}
{
  const corrupted = text43.replace(/60%/g, "60%").split("\f");
  const at = corrupted.findIndex((p) => p.includes("Direction of organisations and groups in Australia") && !/Net direction trend/.test(p));
  assert.ok(at >= 0);
  corrupted[at] = corrupted[at].replace("-48", "-99");
  const parsed = parseWave(corrupted.join("\f"), 43);
  assert.ok(parsed.parseErrors.some((e) => e.includes("direction: National economy has missing ratings")));
}
{
  const corrupted = text43.replaceAll("Australian Government performance on issues", "Issue table heading removed");
  const parsed = parseWave(corrupted, 43);
  assert.ok(parsed.parseErrors.some((e) => e.includes("governmentIssuePerformance: expected one chart page, found 0")));
}
{
  const bad = structuredClone(index);
  bad.sources[0].sha256 = "0".repeat(64);
  assert.throws(() => buildJwsData(bad, SRC), /PDF hash does not match/);
}
console.log("9. Out-of-range shares, inconsistent nets, missing headings and hash drift are guarded: OK");

const serialised = JSON.stringify(buildJwsData(index, SRC), null, 2) + "\n";
assert.ok(fs.existsSync(OUT), "run node .build/extract-jws-issues.mjs --offline first");
assert.equal(fs.readFileSync(OUT, "utf8"), serialised);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "jws-issues-test-"));
try {
  const out = path.join(tmp, "jws-issues.json");
  const run = (mode) => {
    const result = spawnSync(process.execPath, [SCRIPT, mode], {
      cwd: ROOT, encoding: "utf8", env: { ...process.env, JWS_SRC_DIR: SRC, JWS_OUT: out },
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const status = result.stdout.trim().split("\n").at(-1).match(/^JWS_STATUS (.*)$/);
    assert.ok(status, result.stdout);
    return JSON.parse(status[1]);
  };
  const first = run("--offline");
  assert.equal(first.changed, true);
  const once = fs.readFileSync(out, "utf8");
  assert.equal(once, serialised);
  const second = run("--offline");
  assert.equal(second.changed, false);
  assert.equal(fs.readFileSync(out, "utf8"), once);
  const checked = run("--check");
  assert.deepEqual([checked.changed, checked.check], [false, true]);
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
console.log("10. Committed JSON parity and idempotent changed:true → changed:false → check:false regeneration: OK");
console.log("test-jws-issues: all OK");
