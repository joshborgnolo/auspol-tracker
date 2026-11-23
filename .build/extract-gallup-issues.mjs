#!/usr/bin/env node
/* Build the historical Australian Gallup most-important-problem archive.
 *
 * Discovery and proof are deliberately separate:
 *   - DataCite supplies a complete inventory of the 223 records returned by the
 *     project's query, including sparse survey deposits and one user's guide.
 *   - Only a deposited ADA codebook can prove an MIP wave. A wave spec must name
 *     the exact response variable, every value/label mapping (including missing
 *     values), weights, fieldwork and sample size, with verbatim source quotes.
 *   - Category counts are aggregate counts only. Person-level records are not a
 *     source-cache format and must never be added to this directory.
 *
 * Default operation is offline and deterministic:
 *     node .build/extract-gallup-issues.mjs
 *     node .build/extract-gallup-issues.mjs --check
 * Refresh only the authoritative public discovery inventory:
 *     node .build/extract-gallup-issues.mjs --refresh-datacite
 */
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const DATACITE_QUERY = "https://api.datacite.org/dois?query=titles.title:Australian%20Gallup%20Polls&page[size]=1000";
export const CANDIDATE_DOIS = Object.freeze([
  "10.26193/qfoeoe", // February 1979: abstract explicitly says "most important problem".
  "10.26193/okry2a", // March 1980: related problems topic, not question proof.
  "10.26193/rqtj5u", // February 1982: related problems topic, not question proof.
  "10.26193/sl1rhe", // March 1983: related problems topic, not question proof.
]);

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const SRC = path.join(HERE, "gallup-issues-src");
const OUT = path.join(ROOT, "data", "gallup-issues.json");
const METADATA_FILE = path.join(SRC, "datacite.json");
const ACCESS_FILE = path.join(SRC, "ada-access.json");
const PROVEN_FILE = path.join(SRC, "proven-waves.json");
const sha256 = (text) => crypto.createHash("sha256").update(text).digest("hex");
const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const canonical = (value) => JSON.stringify(value, null, 2) + "\n";
const normaliseQuote = (text) => String(text ?? "").replace(/\s+/g, " ").trim();
const doiOf = (record) => String(record?.doi || "").toLowerCase();
const abstractOf = (record) => record?.descriptions?.find((d) => d.descriptionType === "Abstract")?.description || "";
const titleOf = (record) => record?.titles?.[0]?.title || "";
const isMipAbstract = (abstract) => /most\s+important\s+problem\s+facing\s+australia\s+today/i.test(abstract);
const isProblemAbstract = (abstract) => /national\s+problems?|problems?\s+facing\s+australia|australia's\s+problems?|issues\s+facing\s+australia/i.test(abstract);

function inventoryRow(record, provenDois) {
  const abstract = abstractOf(record);
  const resourceType = record?.types?.resourceTypeGeneral || "Unspecified";
  return {
    doi: doiOf(record),
    unit: resourceType === "Dataset" ? "survey-dataset" : "reference-record",
    resourceType,
    title: titleOf(record),
    creators: (record.creators || []).map((c) => c.name),
    publicationYear: record.publicationYear,
    // Preserve the archive's raw date declarations. A title month and an
    // artificial YYYY-MM-01/YYYY-MM-01 range are NOT verified fieldwork dates.
    collectedDates: (record.dates || []).filter((d) => d.dateType === "Collected").map((d) => d.date),
    nativeUrl: record.url,
    abstract,
    abstractSignal: isMipAbstract(abstract) ? "explicit-mip-phrase" : isProblemAbstract(abstract) ? "problem-topic-only" : null,
    codebookVerified: provenDois.has(doiOf(record)),
  };
}

function unresolvedCandidate(record, access) {
  const doi = doiOf(record);
  const page = access.publicDatasetPages?.find((p) => String(p.doi).toLowerCase() === doi);
  const abstract = abstractOf(record);
  const explicit = isMipAbstract(abstract);
  const codebookFiles = (page?.documentationFilesSeen || []).filter((f) => /CODEBOOK/i.test(f.name));
  return {
    doi,
    title: titleOf(record),
    discoveryEvidence: {
      kind: explicit ? "abstract-explicit-mip" : "abstract-related-problem-topic",
      abstract,
      // This is deliberately not `question`: an abstract cannot establish the
      // repeated instrument, response coding or denominator.
      codebookFilesListed: codebookFiles,
      codebookTextCaptured: Boolean(page?.codebookTextCaptured),
    },
    gaps: [
      "deposited-codebook-question-and-response-variable",
      "deposited-response-value-and-category-label-mappings",
      "deposited-missing-response-definitions",
      "deposited-weight-definition",
      "deposited-codebook-fieldwork-and-sample-proof",
    ],
    status: "metadata-only-blocked-no-coded-distribution",
  };
}

/* Return every unmet proof condition. This function has no network or file
 * side effects so offline tests can attack it with malformed and partial
 * evidence. `codebookText`/`codebookSha256` describe the actual cached deposit;
 * they are not values supplied by the wave spec itself. */
export function proofProblems(spec, { codebookText = null, codebookSha256 = null } = {}) {
  const problems = [];
  const need = (condition, key) => { if (!condition) problems.push(key); };
  const quoted = (quote) => Boolean(normaliseQuote(quote)) && Boolean(codebookText) && normaliseQuote(codebookText).includes(normaliseQuote(quote));
  const file = spec?.codebook?.file;
  need(typeof file === "string" && /^[a-z0-9][a-z0-9._-]*\.txt$/i.test(file), "codebook.file");
  need(typeof codebookText === "string" && codebookText.length > 0, "codebook.cached-text");
  need(/^[0-9a-f]{64}$/.test(spec?.codebook?.sha256 || ""), "codebook.expected-sha256");
  need(codebookSha256 && spec?.codebook?.sha256 === codebookSha256, "codebook.actual-sha256-match");

  const q = spec?.question;
  need(typeof q?.variable === "string" && q.variable.trim().length > 0, "question.variable");
  need(isMipAbstract(q?.text || ""), "question.explicit-mip-wording");
  need(quoted(q?.quote), "question.verbatim-codebook-quote");
  need(quoted(spec?.response?.variableQuote), "response.variable-codebook-quote");
  need(q?.variable && q.variable === spec?.response?.variable, "response.question-variable-match");

  const categories = spec?.response?.categories;
  need(Array.isArray(categories) && categories.length > 0, "response.categories");
  const seenValues = new Set();
  const seenIssues = new Set();
  if (Array.isArray(categories)) for (const [index, c] of categories.entries()) {
    const at = `response.categories[${index}]`;
    need((typeof c?.value === "string" || typeof c?.value === "number") && String(c.value).length > 0, `${at}.value`);
    need(typeof c?.label === "string" && c.label.trim().length > 0, `${at}.label`);
    need(typeof c?.issue === "string" && /^[a-z][a-z0-9-]*$/.test(c.issue), `${at}.issue`);
    need(typeof c?.missing === "boolean", `${at}.missing`);
    need(quoted(c?.quote), `${at}.verbatim-codebook-quote`);
    const value = String(c?.value);
    need(!seenValues.has(value), `${at}.unique-value`);
    seenValues.add(value);
    if (!c?.missing) {
      need(!seenIssues.has(c?.issue), `${at}.unique-nonmissing-issue`);
      seenIssues.add(c?.issue);
    }
  }

  const weights = spec?.weights;
  need(weights?.kind === "weighted" || weights?.kind === "unweighted", "weights.kind");
  if (weights?.kind === "weighted") need(typeof weights.variable === "string" && weights.variable.trim().length > 0, "weights.variable");
  need(quoted(weights?.quote), "weights.verbatim-codebook-quote");

  const fieldwork = spec?.fieldwork;
  need(/^\d{4}-\d{2}-\d{2}$/.test(fieldwork?.start || ""), "fieldwork.start");
  need(/^\d{4}-\d{2}-\d{2}$/.test(fieldwork?.end || ""), "fieldwork.end");
  need(fieldwork?.start && fieldwork?.end && fieldwork.start <= fieldwork.end, "fieldwork.ordered-start-end");
  need(quoted(fieldwork?.quote), "fieldwork.verbatim-codebook-quote");
  need(Number.isInteger(spec?.sample?.n) && spec.sample.n > 0, "sample.positive-integer-n");
  need(quoted(spec?.sample?.quote), "sample.verbatim-codebook-quote");
  return problems;
}

const rounded = (n) => Math.round((n + Number.EPSILON) * 1000) / 1000;

/* Compile one already-aggregated survey unit. The accepted source form is one
 * aggregate n per codebook response value, not person rows. Weighted surveys
 * additionally require a weighted aggregate n per value. */
export function compileWave(spec, { codebookText, codebookSha256, metadata }) {
  const problems = proofProblems(spec, { codebookText, codebookSha256 });
  if (problems.length) throw new Error(`${spec?.doi || "unknown DOI"}: codebook proof incomplete: ${problems.join(", ")}`);
  const categories = spec.response.categories;
  const counts = spec.categoryCounts;
  assert.ok(Array.isArray(counts), "categoryCounts must be aggregate counts, not respondent records");
  assert.equal(counts.length, categories.length, "every codebook category needs exactly one aggregate count and no raw-person fallback");
  const byValue = new Map(counts.map((row) => [String(row.value), row]));
  assert.equal(byValue.size, categories.length, "duplicate or missing aggregate response values");
  for (const c of categories) {
    const row = byValue.get(String(c.value));
    assert.ok(row, `no aggregate count for response ${c.value}`);
    assert.ok(Number.isFinite(row.n) && row.n >= 0, `bad aggregate n for ${c.value}`);
    if (spec.weights.kind === "weighted") assert.ok(Number.isFinite(row.weightedN) && row.weightedN >= 0, `bad weighted aggregate n for ${c.value}`);
  }
  const measure = (c) => {
    const row = byValue.get(String(c.value));
    return { n: row.n, weightedN: spec.weights.kind === "weighted" ? row.weightedN : row.n };
  };
  const totalN = categories.reduce((sum, c) => sum + measure(c).n, 0);
  assert.equal(totalN, spec.sample.n, "aggregate category n must reconcile to the proved sample n");
  const valid = categories.filter((c) => !c.missing);
  const missing = categories.filter((c) => c.missing);
  const sumMeasure = (rows, key) => rows.reduce((sum, c) => sum + measure(c)[key], 0);
  const validWeighted = sumMeasure(valid, "weightedN");
  assert.ok(validWeighted > 0, "non-missing weighted base must be positive");
  const distribution = {};
  for (const c of valid) {
    const m = measure(c);
    distribution[c.issue] = { label: c.label, value: c.value, n: m.n, weightedN: rounded(m.weightedN), percent: rounded(100 * m.weightedN / validWeighted) };
  }
  return {
    doi: doiOf(spec),
    unit: "survey-dataset",
    title: metadata?.title || spec.title,
    instrument: "most-important-problem",
    fieldwork: { start: spec.fieldwork.start, end: spec.fieldwork.end, quote: spec.fieldwork.quote },
    sample: { n: spec.sample.n, quote: spec.sample.quote },
    question: { variable: spec.question.variable, text: spec.question.text, quote: spec.question.quote },
    response: {
      variable: spec.response.variable,
      categories: categories.map((c) => ({ value: c.value, label: c.label, issue: c.issue, missing: c.missing, quote: c.quote })),
    },
    weights: { ...spec.weights },
    denominator: { basis: "valid-nonmissing-response-values", n: sumMeasure(valid, "n"), weightedN: rounded(validWeighted) },
    missing: { n: sumMeasure(missing, "n"), weightedN: rounded(sumMeasure(missing, "weightedN")) },
    issues: distribution,
    codebook: { ...spec.codebook },
  };
}

export function buildArchive({ metadata = readJson(METADATA_FILE), access = readJson(ACCESS_FILE), proven = readJson(PROVEN_FILE) } = {}) {
  assert.equal(metadata.queryUrl, DATACITE_QUERY, "unexpected DataCite discovery query");
  assert.ok(Array.isArray(metadata.records) && metadata.records.length > 0, "empty DataCite inventory");
  assert.equal(metadata.records.length, metadata.total, "DataCite one-page enumeration is incomplete");
  const dois = new Set();
  for (const record of metadata.records) {
    assert.ok(doiOf(record), "metadata row without DOI");
    assert.ok(!dois.has(doiOf(record)), `duplicate metadata unit ${doiOf(record)}`);
    dois.add(doiOf(record));
  }
  const recordsByDoi = new Map(metadata.records.map((r) => [doiOf(r), r]));
  for (const doi of CANDIDATE_DOIS) assert.ok(recordsByDoi.has(doi), `candidate missing from inventory: ${doi}`);

  // A declared wave is fail-loud when its codebook is absent, moved, changed or
  // only partially coded. It must never be rescued with abstract-derived data.
  const waves = [];
  const provenDois = new Set();
  for (const spec of proven.waves || []) {
    assert.ok(!spec || typeof spec !== "object" || !("respondents" in spec) && !("personRows" in spec) && !("microdata" in spec), "raw person records are forbidden");
    const file = path.join(SRC, spec.codebook?.file || "");
    const codebookText = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
    const codebookSha256 = codebookText == null ? null : sha256(codebookText);
    const widget = compileWave(spec, { codebookText, codebookSha256, metadata: { title: titleOf(recordsByDoi.get(doiOf(spec))) } });
    assert.ok(recordsByDoi.has(doiOf(spec)), `proven wave is not in DataCite inventory: ${doiOf(spec)}`);
    assert.ok(!provenDois.has(doiOf(spec)), `more than one MIP wave for one survey dataset: ${doiOf(spec)}`);
    provenDois.add(doiOf(spec));
    waves.push(widget);
  }
  const inventory = metadata.records.map((r) => inventoryRow(r, provenDois));
  const candidates = CANDIDATE_DOIS.filter((doi) => !provenDois.has(doi)).map((doi) => unresolvedCandidate(recordsByDoi.get(doi), access));
  return {
    schema: 1,
    house: "Australian Gallup Polls",
    measure: "most-important-problem",
    source: {
      dataciteQuery: DATACITE_QUERY,
      dataciteRetrievedAt: metadata.retrievedAt,
      adaAccessObserved: access.observed,
      authority: "Australian Data Archive / ADA Dataverse / DataCite",
      nativeAccess: {
        datasetApiResult: access.nativeApi?.result,
        challengeTitle: access.nativeApi?.challengeTitle,
        datafileAttempt: access.nativeApi?.datafileAttempt,
        subsequentBrowserAttempts: access.subsequentAccess,
      },
    },
    unitRule: "One wave per deposited survey dataset. Do not infer monthly continuity, interpolate missing deposits, or read a title month as a fieldwork window.",
    proofRule: "A DataCite abstract or ADA file listing is discovery evidence only. Coded issues require the deposited codebook's exact question, response variable/value labels, missing definitions, weights, fieldwork and sample proof.",
    rawDataRule: "Respondent-level records are not cached or written to the repository; only aggregate response-value counts are accepted.",
    coverage: {
      metadataRecords: inventory.length,
      surveyDatasetRecords: inventory.filter((r) => r.unit === "survey-dataset").length,
      referenceRecords: inventory.filter((r) => r.unit !== "survey-dataset").length,
      explicitMipAbstracts: inventory.filter((r) => r.abstractSignal === "explicit-mip-phrase").length,
      problemTopicAbstracts: inventory.filter((r) => r.abstractSignal != null).length,
      candidateDatasets: CANDIDATE_DOIS.length,
      unresolvedCandidateDatasets: candidates.length,
      unassessedDatasetRecords: inventory.filter((r) => r.unit === "survey-dataset" && !CANDIDATE_DOIS.includes(r.doi)).length,
      codebookVerifiedWaves: waves.length,
      codedDistributions: waves.length,
    },
    waves,
    unresolvedCandidates: candidates,
    inventory,
  };
}

async function refreshDatacite() {
  const response = await fetch(DATACITE_QUERY, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`DataCite returned HTTP ${response.status}`);
  const body = await response.json();
  assert.equal(body?.meta?.total, body?.data?.length, "DataCite query no longer fits on one page; paginate before refreshing");
  const keep = (r) => {
    const a = r.attributes || {};
    return {
      doi: a.doi,
      titles: a.titles,
      creators: a.creators,
      publisher: a.publisher,
      publicationYear: a.publicationYear,
      types: a.types,
      dates: a.dates,
      descriptions: a.descriptions,
      subjects: a.subjects,
      url: a.url,
      rightsList: a.rightsList,
      formats: a.formats,
      sizes: a.sizes,
    };
  };
  const metadata = {
    queryUrl: DATACITE_QUERY,
    retrievedAt: new Date().toISOString(),
    total: body.meta.total,
    records: body.data.map(keep),
  };
  fs.writeFileSync(METADATA_FILE, canonical(metadata));
  return metadata;
}

async function main() {
  const check = process.argv.includes("--check");
  const metadata = process.argv.includes("--refresh-datacite") ? await refreshDatacite() : readJson(METADATA_FILE);
  const archive = buildArchive({ metadata });
  const text = canonical(archive);
  if (check) {
    assert.ok(fs.existsSync(OUT), "data/gallup-issues.json is missing; run the extractor");
    assert.equal(fs.readFileSync(OUT, "utf8"), text, "data/gallup-issues.json is stale");
  } else if (!fs.existsSync(OUT) || fs.readFileSync(OUT, "utf8") !== text) {
    fs.writeFileSync(OUT, text);
  }
  const c = archive.coverage;
  console.log(`gallup-issues: ${c.metadataRecords} metadata records (${c.surveyDatasetRecords} survey datasets + ${c.referenceRecords} reference), ${c.codebookVerifiedWaves} codebook-proven waves, ${c.unresolvedCandidateDatasets} unresolved candidates${check ? " — check OK" : ""}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
}
