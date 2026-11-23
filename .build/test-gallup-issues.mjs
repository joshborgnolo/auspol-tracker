/* Offline pins for the historical Gallup MIP metadata inventory, its proof
 * gate and (currently empty) verified row set. No network or browser is used. */
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildArchive, compileWave, proofProblems, CANDIDATE_DOIS, DATACITE_QUERY } from "./extract-gallup-issues.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, ".build", "gallup-issues-src");
const OUT = path.join(ROOT, "data", "gallup-issues.json");
const metadata = JSON.parse(fs.readFileSync(path.join(SRC, "datacite.json"), "utf8"));
const access = JSON.parse(fs.readFileSync(path.join(SRC, "ada-access.json"), "utf8"));
const proven = JSON.parse(fs.readFileSync(path.join(SRC, "proven-waves.json"), "utf8"));
const archive = buildArchive({ metadata, access, proven });

assert.equal(DATACITE_QUERY, "https://api.datacite.org/dois?query=titles.title:Australian%20Gallup%20Polls&page[size]=1000");
assert.equal(archive.coverage.metadataRecords, 223);
assert.equal(archive.coverage.surveyDatasetRecords, 222);
assert.equal(archive.coverage.referenceRecords, 1);
assert.equal(archive.coverage.explicitMipAbstracts, 1);
assert.equal(archive.coverage.problemTopicAbstracts, 19);
assert.equal(archive.inventory.length, metadata.total);
assert.equal(new Set(archive.inventory.map((r) => r.doi)).size, 223);
assert.equal(archive.inventory.find((r) => r.doi === "10.25911/8rep-kh75").unit, "reference-record");
assert.equal(archive.inventory.find((r) => r.doi === "10.26193/qfoeoe").abstractSignal, "explicit-mip-phrase");
assert.deepEqual(archive.inventory.find((r) => r.doi === "10.26193/qfoeoe").collectedDates, ["1979-02-01/1979-02-01"]);
assert.ok(archive.inventory.every((r) => !("fieldwork" in r)), "raw metadata collection stamps must not become codebook-proved fieldwork");
assert.equal(archive.source.nativeAccess.challengeTitle, "Making sure you're not a bot!");
assert.equal(archive.source.nativeAccess.datafileAttempt.id, 1959);
assert.match(archive.source.nativeAccess.subsequentBrowserAttempts.cleanCredentialFreeChrome, /Oh noes!/);
console.log("1. Complete one-page metadata enumeration and one-deposit units: OK");

// This is the actual verified historical row set, not an expected or filled-in
// monthly series. It is empty because no deposited codebook text was capturable.
assert.deepEqual(proven.waves, []);
assert.deepEqual(archive.waves, []);
assert.equal(archive.coverage.codebookVerifiedWaves, 0);
assert.equal(archive.coverage.codedDistributions, 0);
assert.deepEqual(archive.unresolvedCandidates.map((r) => r.doi), CANDIDATE_DOIS);
assert.equal(archive.coverage.unresolvedCandidateDatasets, 4);
assert.equal(archive.coverage.unassessedDatasetRecords, 218);
for (const candidate of archive.unresolvedCandidates) {
  assert.equal(candidate.status, "metadata-only-blocked-no-coded-distribution");
  assert.equal(candidate.discoveryEvidence.codebookTextCaptured, false);
  assert.equal(candidate.gaps.length, 5);
  assert.ok(!("issues" in candidate) && !("question" in candidate), "abstract evidence must not masquerade as a coded question or distribution");
}
assert.equal(archive.unresolvedCandidates[0].discoveryEvidence.kind, "abstract-explicit-mip");
assert.ok(archive.unresolvedCandidates.slice(1).every((r) => r.discoveryEvidence.kind === "abstract-related-problem-topic"));
assert.deepEqual(archive.unresolvedCandidates[0].discoveryEvidence.codebookFilesListed, [{ datafileId: 1958, name: "1 ADA.CODEBOOK.00199.pdf" }]);
assert.deepEqual(archive.unresolvedCandidates[3].discoveryEvidence.codebookFilesListed, []);
console.log("2. Actual known rows (none) and explicit metadata-only gaps: OK");

const CODEBOOK = [
  "Q9 What do you think is the most important problem facing Australia today?",
  "V09 MOST IMPORTANT PROBLEM",
  "1 INFLATION",
  "2 UNEMPLOYMENT",
  "99 NO RESPONSE [missing]",
  "WGT Respondent weight",
  "Fieldwork 3 February 1979 to 4 February 1979",
  "n = 100 respondents",
].join("\n");
const ACTUAL_SHA = crypto.createHash("sha256").update(CODEBOOK).digest("hex");
const validSpec = {
  doi: "10.26193/qfoeoe",
  codebook: { file: "synthetic-test-codebook.txt", sha256: ACTUAL_SHA },
  question: {
    variable: "V09",
    text: "What do you think is the most important problem facing Australia today?",
    quote: "Q9 What do you think is the most important problem facing Australia today?",
  },
  response: {
    variable: "V09",
    variableQuote: "V09 MOST IMPORTANT PROBLEM",
    categories: [
      { value: 1, label: "INFLATION", issue: "inflation", missing: false, quote: "1 INFLATION" },
      { value: 2, label: "UNEMPLOYMENT", issue: "unemployment", missing: false, quote: "2 UNEMPLOYMENT" },
      { value: 99, label: "NO RESPONSE", issue: "no-response", missing: true, quote: "99 NO RESPONSE [missing]" },
    ],
  },
  weights: { kind: "weighted", variable: "WGT", quote: "WGT Respondent weight" },
  fieldwork: { start: "1979-02-03", end: "1979-02-04", quote: "Fieldwork 3 February 1979 to 4 February 1979" },
  sample: { n: 100, quote: "n = 100 respondents" },
  categoryCounts: [
    { value: 1, n: 50, weightedN: 45 },
    { value: 2, n: 30, weightedN: 25 },
    { value: 99, n: 20, weightedN: 30 },
  ],
};
const withBook = { codebookText: CODEBOOK, codebookSha256: ACTUAL_SHA };
assert.deepEqual(proofProblems(validSpec, withBook), []);
assert.ok(proofProblems(validSpec).includes("codebook.cached-text"));
assert.ok(proofProblems(validSpec, { ...withBook, codebookSha256: "0".repeat(64) }).includes("codebook.actual-sha256-match"));
const invalidWording = structuredClone(validSpec);
invalidWording.question.text = "National problems mentioned in an abstract";
assert.ok(proofProblems(invalidWording, withBook).includes("question.explicit-mip-wording"));
const noCategories = structuredClone(validSpec);
delete noCategories.response.categories;
assert.ok(proofProblems(noCategories, withBook).includes("response.categories"));
const noWeight = structuredClone(validSpec);
delete noWeight.weights.variable;
assert.ok(proofProblems(noWeight, withBook).includes("weights.variable"));
const noFieldwork = structuredClone(validSpec);
delete noFieldwork.fieldwork.start;
assert.ok(proofProblems(noFieldwork, withBook).includes("fieldwork.start"));
assert.throws(() => compileWave(noCategories, withBook), /codebook proof incomplete/);
console.log("3. Missing question, categories, weights, fieldwork and codebook/hash are hard blockers: OK");

const wave = compileWave(validSpec, withBook);
assert.equal(wave.unit, "survey-dataset");
assert.equal(wave.response.variable, "V09");
assert.equal(wave.denominator.n, 80);
assert.equal(wave.denominator.weightedN, 70);
assert.equal(wave.missing.n, 20);
assert.equal(wave.missing.weightedN, 30);
assert.deepEqual(wave.issues.inflation, { label: "INFLATION", value: 1, n: 50, weightedN: 45, percent: 64.286 });
assert.deepEqual(wave.issues.unemployment, { label: "UNEMPLOYMENT", value: 2, n: 30, weightedN: 25, percent: 35.714 });
assert.deepEqual(compileWave(validSpec, withBook), wave, "aggregation must be deterministic");
const irreconcilable = structuredClone(validSpec);
irreconcilable.categoryCounts[0].n = 49;
assert.throws(() => compileWave(irreconcilable, withBook), /reconcile to the proved sample n/);
const rawSpec = { doi: "10.26193/qfoeoe", respondents: [{ V09: 1 }] };
assert.throws(() => buildArchive({ metadata, access, proven: { waves: [rawSpec] } }), /raw person records are forbidden/);
console.log("4. Aggregate-only weighted compilation and deterministic counts: OK");

for (const file of fs.readdirSync(SRC)) assert.ok(!/\.(?:sav|dta|por|csv|tsv|zip|sas7bdat)$/i.test(file), `respondent-data/cache archive is not permitted: ${file}`);
const expected = JSON.stringify(buildArchive({ metadata, access, proven }), null, 2) + "\n";
assert.equal(fs.readFileSync(OUT, "utf8"), expected, "generated data file is stale");
assert.equal(JSON.stringify(buildArchive({ metadata, access, proven })), JSON.stringify(archive));
console.log("5. Source-cache restrictions, disk parity and offline regeneration: OK");
console.log("test-gallup-issues: all OK");
