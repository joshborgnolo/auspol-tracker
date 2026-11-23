#!/usr/bin/env node
/* Australian Election Study national issue history, 1990–2025.

   The Holy Sheet route returns the published AGGREGATE chart table as JSON.
   No Svelte bundle, chart script or respondent-level data is executed or read.
   Raw responses are cached verbatim; ordinary rebuilds are entirely offline.
   Use --refresh to recheck the official routes, and --check for a write-free
   drift check. AES_ISSUES_SRC_DIR and AES_ISSUES_OUT support isolated tests. */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const SRC = process.env.AES_ISSUES_SRC_DIR || path.join(ROOT, ".build", "aes-issues-src");
const OUT = process.env.AES_ISSUES_OUT || path.join(ROOT, "data", "aes-issues.json");
const ROUTE = "https://holy-sheet.visualise.today/sheet/";
export const REPORT_URL = "https://australianelectionstudy.org/wp-content/uploads/Trends-in-Australian-Political-Opinion-1987-2025.pdf";
export const ELECTION_YEARS = [1990, 1993, 1996, 1998, 2001, 2004, 2007, 2010, 2013, 2016, 2019, 2022, 2025];
const PARTY = ["ALP", "Coalition", "No difference"];
const IMPORTANCE = ["Extremely important", "Quite important", "Not very important"];
const BATTERIES = {
  economic: { id: "most-important-economic-election-issues", label: "Most important economic election issues" },
  nonEconomic: { id: "most-important-non-economic-election-issues", label: "Most important non-economic election issues" },
  preferred: { id: "preferred-party-policy", label: "Preferred party policy" },
  importance: { id: "vote-decision-importance", label: "Importance in vote decision" },
};

function definition(id, sheetId, title, page, battery, expectedOptions, extra = {}) {
  return { id, sheetId, title, page, battery: BATTERIES[battery], expectedOptions, cacheFile: `${id}.json`, role: "current-series", ...extra };
}

/* Titles and printed report pages come directly from the November 2025 AES
   monograph. Option labels remain the source's col0 strings, verbatim. */
export const CHARTS = [
  definition("3.1", "1FZbk2a9Acy2Xhp_0qF-UIpWRmHHuMidbBMf8xb3Ju_E", "Most important economic election issues", 32, "economic",
    ["Education", "Taxation", "Management of the economy", "Cost of living", "Industrial relations", "Unemployment"],
    { notes: ["‘Taxation’ was not included in 1993."] }),
  definition("3.2", "1kqM-G7H6m_AM-CaV8ry35iYSn9993fMBWJM7XObZ9MY", "Most important non-economic election issues", 33, "nonEconomic",
    ["Health", "Environment", "Climate change", "Refugees and asylum seekers", "Immigration"],
    { notes: ["In 1996–2025 estimates for health are for ‘Health and Medicare’. The source category label remains ‘Health’.", "‘Refugees and asylum seekers’ was not included in 2007."] }),
  definition("3.3", "1ciiipu6Nqjx3_gEWzkSUdG_csVnBsyPOy7NoS-OYPW8", "Preferred party policy on management of the economy", 34, "preferred", PARTY, { topic: "Management of the economy" }),
  definition("3.4", "1JVqAZTjiq6v3QXIqm0GR1GU9r7hxVE2I6o1eOKYuFFc", "Preferred party policy on education", 35, "preferred", PARTY, { topic: "Education" }),
  definition("3.5", "1WiZZqG2Unl69FZ9tTqTk_AHlx8UwNkcjH_iSlR-TDLw", "Preferred party policy on taxation", 36, "preferred", PARTY, { topic: "Taxation" }),
  definition("3.6", "1GLpSNLS53frSsLWXnaYCNk6Cd2-G5BFuGCMv-56x4Ig", "Preferred party policy on health", 37, "preferred", PARTY, { topic: "Health" }),
  definition("3.7", "1vh9O5wUBYCXt0iEp5YJoKOlPfgmgeQr4KWbbJ8ZbMbA", "Preferred party policy on the environment", 38, "preferred", PARTY, { topic: "Environment" }),
  definition("3.8", "18Ck-rdZBLJ9JrFj9s2mG2fM6X5NcrGv34hvTUIor7GM", "Preferred party policy on climate change", 39, "preferred", PARTY, { topic: "Climate change" }),
  definition("3.9", "1XRl69hGodTsKMuHuOkcWwBiCSVMVemcUjglmKeq7wVY", "Preferred party policy on immigration", 40, "preferred", PARTY, { topic: "Immigration" }),
  definition("3.10", "1Z0wkSeB-kFPIxtEq61wg4LCX4udMrZLbqYayG8tYXLA", "Preferred party policy on refugees and asylum seekers", 41, "preferred", PARTY, { topic: "Refugees and asylum seekers" }),
  definition("3.11", "1c87W8xHXB5-tOh5ZlApev0VSgsnNc_yVzU9kHf9TkS8", "Importance of management of the economy in vote decision", 42, "importance", IMPORTANCE, { topic: "Management of the economy" }),
  definition("3.12", "1EAOpfBivS_B24kB6DYF8sUdb4gZnktkSwI3_ZLcZRec", "Importance of education in vote decision", 43, "importance", IMPORTANCE, { topic: "Education" }),
  definition("3.13", "1llDx2d7myBR_pnAxuB80pqH1Ys_EGzWsFJQPlnh6qMc", "Importance of taxation in vote decision", 44, "importance", IMPORTANCE, { topic: "Taxation" }),
  definition("3.14", "1MHMXhl5qY4T4cO7XTdRp8L9W-t2Z2b4yHZ_59FF-nUw", "Importance of health in vote decision", 45, "importance", IMPORTANCE, { topic: "Health" }),
  definition("3.15", "1yiWEKZ1wQeJnSrcIqaIsinpN_Ub1kKPvFvG4iDyrheQ", "Importance of the environment in vote decision", 46, "importance", IMPORTANCE, { topic: "Environment" }),
  definition("3.16", "1JqhIF85QinFw63ZVjlDKoRFIj2DN0KCjs3iJRS5Yk6o", "Importance of climate change in vote decision", 47, "importance", IMPORTANCE, { topic: "Climate change" }),
  definition("3.17", "1WadqzTUzORL95Q2n0U_vAC5Z7vvGf3o63lqGfMgq_2w", "Importance of immigration in vote decision", 48, "importance", IMPORTANCE, { topic: "Immigration" }),
  definition("3.18", "1mowRtF2Gjd1c_hcXsfG0_lQTspCaXhgHOMIIKIcKvfo", "Importance of refugees and asylum seekers in vote decision", 49, "importance", IMPORTANCE, { topic: "Refugees and asylum seekers" }),
];

export const PREVIOUS_ENVIRONMENT = {
  id: "3.7.2022", sheetId: "1fZFDcl1SFJwZLpaLxWXzZPFjIWwPy7uJHNXhXK9BXXE",
  cacheFile: "3.7.2022.json", role: "superseded-edition", currentSeries: "3.7", edition: "2022",
};
const ALL_SOURCES = [...CHARTS.slice(0, 6), PREVIOUS_ENVIRONMENT, ...CHARTS.slice(6)];
const YEAR_SET = new Set(ELECTION_YEARS.map(String));
const sha256 = (text) => crypto.createHash("sha256").update(text).digest("hex");
const sourceUrl = (def) => ROUTE + def.sheetId;
const fail = (message) => { throw new Error(message); };
const atomic = (file, text) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(`${file}.tmp-${process.pid}`, text);
  fs.renameSync(`${file}.tmp-${process.pid}`, file);
};

/* JSON.parse is deliberately the only decoder: HTML/Svelte input is rejected,
   never handed to eval, new Function, a VM or a browser runtime. */
export function parseChartResponse(text, identity = "chart") {
  if (typeof text !== "string") fail(`${identity}: response must be text`);
  if (Buffer.byteLength(text) > 5_000_000) fail(`${identity}: response exceeds 5 MB limit`);
  const trimmed = text.trim();
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) fail(`${identity}: expected an aggregate JSON array (HTML/Svelte rejected)`);
  let payload;
  try { payload = JSON.parse(trimmed); }
  catch (error) { fail(`${identity}: invalid aggregate JSON: ${error.message}`); }
  if (!Array.isArray(payload) || !payload.length) fail(`${identity}: empty aggregate response`);
  for (const [index, row] of payload.entries()) {
    if (!row || typeof row !== "object" || Array.isArray(row)) fail(`${identity}: row ${index} is not an object`);
    if (typeof row.col0 !== "string" || typeof row.col1 !== "string") fail(`${identity}: row ${index} lacks string col0/col1 aggregate labels`);
  }
  return payload;
}

function numericCell(row, year, identity) {
  const value = row[year];
  if (value === "" || value == null) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100)
    fail(`${identity}: ${year} cell must be a finite percentage, blank or null`);
  return value;
}

/* National means exactly col1 === ''. In particular null, absent and other
   falsy group labels are not silently promoted to the all-voters row. */
export function buildSeries(def, payload, rawSha256 = null) {
  const national = payload.filter((row) => row.col1 === "");
  if (!national.length) fail(`${def.id}: no national col1 === '' rows`);
  const seen = new Set();
  const printedYears = [...new Set(national.flatMap((row) => Object.keys(row).filter((key) => YEAR_SET.has(key))))]
    .sort((a, b) => Number(a) - Number(b));
  if (!printedYears.length) fail(`${def.id}: no dated columns`);
  const categories = [];
  for (const row of national) {
    const label = row.col0;
    if (!label) fail(`${def.id}: a national response has an empty col0 category`);
    if (seen.has(label)) fail(`${def.id}: duplicate national category ${JSON.stringify(label)}`);
    seen.add(label);
    const values = Object.fromEntries(printedYears.map((year) => [year, numericCell(row, year, `${def.id} ${label}`)]));
    if (Object.values(values).some((value) => value != null)) categories.push({ label, values });
  }
  if (!categories.length) fail(`${def.id}: national rows are entirely blank`);
  if (def.expectedOptions) {
    const expected = [...def.expectedOptions].sort();
    const actual = categories.map((entry) => entry.label).sort();
    if (JSON.stringify(actual) !== JSON.stringify(expected)) fail(`${def.id}: response categories changed: ${JSON.stringify(actual)}`);
  }
  /* A dated row exists only when a national category has a real published
     reading. Once present, every blank option is null, never zero-filled or
     carried from an earlier election. No 1987 or synthetic annual rows. */
  const rows = printedYears.map((year) => ({
    year: Number(year),
    values: Object.fromEntries(categories.map((entry) => [entry.label, entry.values[year]])),
  })).filter((row) => Object.values(row.values).some((value) => value != null));
  if (!rows.length) fail(`${def.id}: no non-empty dated rows`);
  return {
    id: def.id,
    title: def.title,
    battery: def.battery.id,
    ...(def.topic ? { topic: def.topic } : {}),
    reportPage: def.page,
    options: categories.map((entry) => entry.label),
    rows,
    source: {
      sheetId: def.sheetId,
      url: sourceUrl(def),
      cacheFile: def.cacheFile,
      ...(rawSha256 ? { sha256: rawSha256 } : {}),
    },
    ...(def.notes ? { notes: [...def.notes] } : {}),
  };
}

export function reconcilePreviousEdition(currentPayload, previousPayload) {
  const current = new Map(currentPayload.filter((row) => row.col1 === "").map((row) => [row.col0, row]));
  const previous = previousPayload.filter((row) => row.col1 === "");
  let comparedCells = 0, matchingCells = 0;
  const revisedCells = [];
  for (const oldRow of previous) {
    const newRow = current.get(oldRow.col0);
    if (!newRow) fail(`3.7.2022: category ${oldRow.col0} is absent from current 3.7`);
    for (const year of ELECTION_YEARS.map(String).filter((year) => Number(year) <= 2022)) {
      if (!(year in oldRow) || !(year in newRow)) continue;
      const before = numericCell(oldRow, year, `3.7.2022 ${oldRow.col0}`);
      const now = numericCell(newRow, year, `3.7 ${oldRow.col0}`);
      comparedCells++;
      if (before === now) matchingCells++;
      else revisedCells.push({ option: oldRow.col0, year: Number(year), previous: before, current: now });
    }
  }
  if (!comparedCells) fail("3.7.2022: no overlapping national cells");
  return { series: "3.7", previousEdition: "3.7.2022", role: "cross-check only; superseded rows never enter output", comparedCells, matchingCells, revisedCells };
}

function reportMetadata() {
  return {
    publisher: "Australian Election Study",
    authors: ["Sarah Cameron", "Ian McAllister", "Juliet Pietsch"],
    title: "Trends in Australian Political Opinion: Results from the Australian Election Study, 1987–2025",
    published: "2025-11",
    reportUrl: REPORT_URL,
    aggregateProvider: "Holy Sheet",
    aggregateRoute: ROUTE + "<sheetId>",
    nationalRowRule: "col1 === ''",
    responseCategoryRule: "col0",
    granularity: "Published national aggregate percentages; no respondent-level microdata",
  };
}

function buildDocument(rawTexts, manifest) {
  const series = CHARTS.map((def) => buildSeries(def, parseChartResponse(rawTexts[def.cacheFile], def.id), sha256(rawTexts[def.cacheFile])));
  /* The 2022 environment sheet is metadata/corroboration, never series 19. */
  reconcilePreviousEdition(
    parseChartResponse(rawTexts[CHARTS.find((def) => def.id === "3.7").cacheFile], "3.7"),
    parseChartResponse(rawTexts[PREVIOUS_ENVIRONMENT.cacheFile], "3.7.2022"),
  );
  const datedRows = series.reduce((n, item) => n + item.rows.length, 0);
  const responseOptions = series.reduce((n, item) => n + item.options.length, 0);
  const cells = series.flatMap((item) => item.rows.flatMap((row) => Object.values(row.values)));
  const previous = manifest.sources.find((source) => source.id === PREVIOUS_ENVIRONMENT.id);
  return {
    _about: "Australian Election Study national issue history, 1990–2025: the 18 charts in the Election issues chapter of the official 2025 trends monograph. Categories and printed shares are preserved without renormalisation; null means an actually blank cell, not zero.",
    schemaVersion: 1,
    source: {
      ...reportMetadata(),
      generator: ".build/extract-aes-issues.mjs",
      cacheManifest: ".build/aes-issues-src/manifest.json",
      supersededSources: [{
        id: PREVIOUS_ENVIRONMENT.id,
        role: PREVIOUS_ENVIRONMENT.role,
        currentSeries: PREVIOUS_ENVIRONMENT.currentSeries,
        edition: PREVIOUS_ENVIRONMENT.edition,
        sheetId: PREVIOUS_ENVIRONMENT.sheetId,
        url: sourceUrl(PREVIOUS_ENVIRONMENT),
        cacheFile: PREVIOUS_ENVIRONMENT.cacheFile,
        sha256: previous.sha256,
      }],
    },
    batteries: Object.fromEntries([...new Set(CHARTS.map((def) => def.battery.id))]
      .map((id) => { const def = CHARTS.find((item) => item.battery.id === id); return [id, def.battery.label]; })),
    cellSemantics: {
      unit: "percent",
      national: "All-voters rows are selected strictly by col1 === ''. Response labels are col0 verbatim.",
      datedRows: "Only years actually present and non-empty in the official national chart rows. No years are inferred or forward-filled.",
      null: "The official cell is blank or null; this is missing, not a zero reading.",
      zero: "A published numeric zero remains 0 and is distinct from null.",
      normalisation: "None. ALP, Coalition and No difference (and all vote-importance categories) are retained as printed; no ALP+Coalition renormalisation.",
    },
    series,
    coverage: {
      series: series.length,
      datedRows,
      responseOptions,
      numericCells: cells.filter((value) => value != null).length,
      nullCells: cells.filter((value) => value == null).length,
      zeroCells: cells.filter((value) => value === 0).length,
      firstYear: Math.min(...series.flatMap((item) => item.rows.map((row) => row.year))),
      lastYear: Math.max(...series.flatMap((item) => item.rows.map((row) => row.year))),
      cachedAggregateResponses: manifest.sources.length,
    },
  };
}

function loadCache(srcDir) {
  const manifestPath = path.join(srcDir, "manifest.json");
  if (!fs.existsSync(manifestPath)) fail(`${manifestPath} is missing; run with --refresh to populate the official aggregate cache`);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.sources)) fail(`${manifestPath}: unsupported manifest`);
  const ids = new Set(manifest.sources.map((source) => source.id));
  for (const def of ALL_SOURCES) if (!ids.has(def.id)) fail(`${manifestPath}: missing source ${def.id}`);
  const rawTexts = {};
  for (const def of ALL_SOURCES) {
    const record = manifest.sources.find((source) => source.id === def.id);
    if (record.cacheFile !== def.cacheFile || record.sheetId !== def.sheetId || record.url !== sourceUrl(def)) fail(`${manifestPath}: provenance drift for ${def.id}`);
    const text = fs.readFileSync(path.join(srcDir, def.cacheFile), "utf8");
    if (sha256(text) !== record.sha256) fail(`${def.id}: cached raw response does not match manifest sha256`);
    rawTexts[def.cacheFile] = text;
  }
  return { manifest, rawTexts };
}

export function buildIssues({ srcDir = SRC } = {}) {
  const { manifest, rawTexts } = loadCache(srcDir);
  return buildDocument(rawTexts, manifest);
}

export async function refreshSources({ srcDir = SRC, fetchImpl = fetch } = {}) {
  const rawTexts = {}, payloads = {};
  let prior = null;
  try { prior = JSON.parse(fs.readFileSync(path.join(srcDir, "manifest.json"), "utf8")); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  const now = new Date().toISOString();
  for (const def of ALL_SOURCES) {
    const response = await fetchImpl(sourceUrl(def), {
      headers: { accept: "application/json", "user-agent": "auspol-tracker-aes-issues/1.0" },
      redirect: "follow",
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) fail(`${def.id}: official chart returned HTTP ${response.status}`);
    const text = await response.text();
    payloads[def.id] = parseChartResponse(text, def.id);
    rawTexts[def.cacheFile] = text;
  }
  /* Validate every chart, including the archived-edition reconciliation,
     before a caller writes any part of the refreshed cache. */
  const provisional = { sources: ALL_SOURCES.map((def) => ({ id: def.id, sha256: sha256(rawTexts[def.cacheFile]) })) };
  buildDocument(rawTexts, provisional);
  const sources = ALL_SOURCES.map((def) => {
    const text = rawTexts[def.cacheFile], digest = sha256(text);
    const old = prior?.sources?.find((source) => source.id === def.id);
    return {
      id: def.id,
      role: def.role,
      ...(def.currentSeries ? { currentSeries: def.currentSeries, edition: def.edition } : {}),
      sheetId: def.sheetId,
      url: sourceUrl(def),
      cacheFile: def.cacheFile,
      sha256: digest,
      bytes: Buffer.byteLength(text),
      aggregateRows: payloads[def.id].length,
      nationalRows: payloads[def.id].filter((row) => row.col1 === "").length,
      retrievedAt: old?.sha256 === digest && old.retrievedAt ? old.retrievedAt : now,
    };
  });
  const manifest = {
    schemaVersion: 1,
    report: reportMetadata(),
    nationalRowRule: "col1 === '' (an explicit all-voters aggregate label, never a falsy-value filter)",
    responseCategoryRule: "col0",
    sources,
    previousEditionChecks: [reconcilePreviousEdition(payloads["3.7"], payloads["3.7.2022"])],
  };
  return { manifest, rawTexts, document: buildDocument(rawTexts, manifest) };
}

function currentText(file) {
  try { return fs.readFileSync(file, "utf8"); }
  catch (error) { if (error.code === "ENOENT") return null; throw error; }
}

async function main() {
  const refresh = process.argv.includes("--refresh");
  const check = process.argv.includes("--check");
  const unknown = process.argv.slice(2).filter((arg) => !["--refresh", "--check"].includes(arg));
  if (unknown.length) fail(`unknown arguments: ${unknown.join(", ")}`);
  let document, rawTexts = null, manifest = null;
  if (refresh) ({ document, rawTexts, manifest } = await refreshSources({ srcDir: SRC }));
  else document = buildIssues({ srcDir: SRC });
  const outputText = JSON.stringify(document, null, 2) + "\n";
  const outputChanged = currentText(OUT) !== outputText;
  const manifestText = manifest ? JSON.stringify(manifest, null, 2) + "\n" : null;
  const cacheChanges = [];
  if (refresh) {
    for (const def of ALL_SOURCES) if (currentText(path.join(SRC, def.cacheFile)) !== rawTexts[def.cacheFile]) cacheChanges.push(def.cacheFile);
    if (currentText(path.join(SRC, "manifest.json")) !== manifestText) cacheChanges.push("manifest.json");
  }
  const changed = outputChanged || cacheChanges.length > 0;
  if (!check && changed) {
    if (refresh) {
      for (const def of ALL_SOURCES) {
        const file = path.join(SRC, def.cacheFile);
        if (currentText(file) !== rawTexts[def.cacheFile]) atomic(file, rawTexts[def.cacheFile]);
      }
      if (currentText(path.join(SRC, "manifest.json")) !== manifestText) atomic(path.join(SRC, "manifest.json"), manifestText);
    }
    if (outputChanged) atomic(OUT, outputText);
  }
  console.log("AES_ISSUES_STATUS " + JSON.stringify({
    ...document.coverage,
    changed,
    outputChanged,
    cachedFilesChanged: cacheChanges.length,
    check,
    refreshed: refresh,
    out: OUT,
  }));
  if (check && changed) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(`AES_ISSUES_ERROR ${error.stack || error}`); process.exitCode = 1; });
}
