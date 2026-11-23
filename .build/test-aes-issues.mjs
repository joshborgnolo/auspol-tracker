#!/usr/bin/env node
/* Offline pins for the 18 official AES national issue-history charts.
   Raw responses, report titles/pages and a subset of dated figures were
   independently read from the official Holy Sheet aggregate routes and
   Cameron, McAllister & Pietsch, Trends in Australian Political Opinion
   1987–2025, November 2025, printed pages 32–49. No test needs the network. */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  CHARTS, ELECTION_YEARS, PREVIOUS_ENVIRONMENT, REPORT_URL,
  parseChartResponse, buildSeries, buildIssues, reconcilePreviousEdition, refreshSources,
} from "./extract-aes-issues.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, ".build", "aes-issues-src");
const OUT = path.join(ROOT, "data", "aes-issues.json");
const SCRIPT = path.join(ROOT, ".build", "extract-aes-issues.mjs");
const sha256 = (text) => crypto.createHash("sha256").update(text).digest("hex");
const cached = (id) => fs.readFileSync(path.join(SRC, `${id}.json`), "utf8");
const payload = (id) => parseChartResponse(cached(id), id);

/* 1. JSON-only decoding, exact national selection, blank/zero semantics and
      schema guards on synthetic aggregates (including an actual zero). */
assert.throws(() => parseChartResponse("<script>globalThis.AES_PWNED = true</script>", "hostile"), /HTML\/Svelte rejected/);
assert.throws(() => parseChartResponse("const data = [1, 2]", "JS"), /HTML\/Svelte rejected/);
assert.throws(() => parseChartResponse("[]"), /empty aggregate/);
assert.throws(() => parseChartResponse('[{"col0":"A"}]'), /col0\/col1/);
assert.equal(globalThis.AES_PWNED, undefined, "source text is never executed");
const hostileLabel = "globalThis.AES_PWNED = true; //";
assert.equal(parseChartResponse(JSON.stringify([{ col0: hostileLabel, col1: "", 1990: 0 }]))[0].col0, hostileLabel);
assert.equal(globalThis.AES_PWNED, undefined);
const fixtureDefinition = { id: "fixture", title: "Fixture", battery: "fixture", page: 1, sheetId: "fixture", cacheFile: "fixture.json" };
const fixtureRows = [
  { col0: "Zero then missing", col1: "", 1987: 99, 1990: 0, 1993: "", 2025: null },
  { col0: "Other", col1: "", 1990: 2, 1993: 3, 2025: 4 },
  { col0: "Never asked", col1: "", 1990: "", 1993: "", 2025: "" },
  { col0: "Subgroup, not national", col1: "Gender: Female", 1990: 88, 1993: 88, 2025: 88 },
  { col0: "Another falsy-looking group", col1: "0", 1990: 77, 1993: 77, 2025: 77 },
];
const fixturePayload = parseChartResponse(JSON.stringify(fixtureRows));
const fixture = buildSeries(fixtureDefinition, fixturePayload);
assert.deepEqual(fixture.options, ["Zero then missing", "Other"], "entirely blank categories are not fabricated rows");
assert.deepEqual(fixture.rows.map((row) => row.year), [1990, 1993, 2025], "1987 is outside scope; no annual interpolation");
assert.equal(fixture.rows[0].values["Zero then missing"], 0, "published zero remains numeric zero");
assert.equal(fixture.rows[1].values["Zero then missing"], null, "blank remains null, not zero or a carried value");
assert.equal(fixture.rows[2].values["Zero then missing"], null, "JSON null remains null");
assert.ok(!("Subgroup, not national" in fixture.rows[0].values));
assert.ok(!("Another falsy-looking group" in fixture.rows[0].values));
assert.throws(() => buildSeries(fixtureDefinition, parseChartResponse('[{"col0":"A","col1":"Gender: Female","1990":50}]')), /no national/);
assert.throws(() => buildSeries(fixtureDefinition, parseChartResponse('[{"col0":"A","col1":"","1990":101}]')), /finite percentage/);
assert.throws(() => buildSeries(fixtureDefinition, parseChartResponse('[{"col0":"A","col1":"","1990":"50"}]')), /finite percentage/);
assert.throws(() => buildSeries(fixtureDefinition, parseChartResponse('[{"col0":"A","col1":"","1990":1},{"col0":"A","col1":"","1990":2}]')), /duplicate national category/);
const emptyYear = buildSeries(fixtureDefinition, parseChartResponse('[{"col0":"A","col1":"","1990":"","1993":7}]'));
assert.deepEqual(emptyYear.rows.map((row) => row.year), [1993], "an entirely blank source year gets no dated row");
console.log("1. Safe JSON decoding, exact national selection, nulls versus zeros and parser guards: OK");

/* 2. Read every committed raw aggregate and pin provenance and the output's
      schema/coverage. This is a complete offline rebuild, not a fixture subset. */
const manifest = JSON.parse(fs.readFileSync(path.join(SRC, "manifest.json"), "utf8"));
const doc = buildIssues({ srcDir: SRC });
const byId = (id) => doc.series.find((series) => series.id === id);
const at = (id, year) => {
  const row = byId(id).rows.find((entry) => entry.year === year);
  assert.ok(row, `${id} must contain actual dated row ${year}`);
  return row.values;
};
assert.equal(doc.schemaVersion, 1);
assert.equal(doc.source.reportUrl, REPORT_URL);
assert.equal(doc.source.nationalRowRule, "col1 === ''");
assert.equal(doc.source.responseCategoryRule, "col0");
assert.match(doc.source.granularity, /no respondent-level microdata/);
assert.equal(manifest.sources.length, 19);
assert.equal(manifest.sources.filter((source) => source.role === "current-series").length, 18);
assert.equal(manifest.sources.filter((source) => source.role === "superseded-edition").length, 1);
assert.deepEqual(doc.series.map((series) => series.id), Array.from({ length: 18 }, (_, i) => `3.${i + 1}`));
assert.ok(!doc.series.some((series) => series.id === "3.7.2022"));
assert.deepEqual(doc.coverage, {
  series: 18,
  datedRows: 188,
  responseOptions: 59,
  numericCells: 584,
  nullCells: 45,
  zeroCells: 0,
  firstYear: 1990,
  lastYear: 2025,
  cachedAggregateResponses: 19,
});
for (const [index, def] of CHARTS.entries()) {
  const series = byId(def.id), source = manifest.sources.find((entry) => entry.id === def.id);
  const raw = cached(def.id), national = payload(def.id).filter((row) => row.col1 === "");
  assert.equal(series.title, def.title);
  assert.equal(series.reportPage, 32 + index);
  assert.equal(series.battery, def.battery.id);
  assert.equal(series.source.sheetId, def.sheetId);
  assert.equal(series.source.url, def.sheetId ? `https://holy-sheet.visualise.today/sheet/${def.sheetId}` : null);
  assert.equal(series.source.cacheFile, `${def.id}.json`);
  assert.equal(series.source.sha256, sha256(raw));
  assert.equal(source.sha256, series.source.sha256);
  assert.equal(source.url, series.source.url);
  assert.equal(source.aggregateRows, payload(def.id).length);
  assert.equal(source.nationalRows, national.length);
  assert.ok(/^[0-9a-f]{64}$/.test(source.sha256));
  assert.ok(Number.isSafeInteger(source.bytes) && source.bytes > 0);
  assert.match(source.retrievedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.deepEqual(series.options, national.filter((row) => ELECTION_YEARS.some((year) => typeof row[year] === "number")).map((row) => row.col0));
}
assert.equal(doc.source.supersededSources[0].id, "3.7.2022");
assert.equal(doc.source.supersededSources[0].currentSeries, "3.7");
assert.equal(doc.source.supersededSources[0].role, "superseded-edition");
assert.equal(doc.source.supersededSources[0].sha256, sha256(cached("3.7.2022")));
assert.ok(!JSON.stringify(doc.series).includes("Gender:"), "demographic aggregate rows stay in raw cache, not national output");
console.log("2. All 18 series, 19 raw responses, provenance, schema and actual coverage counts: OK");

/* 3. Exact dated coverage. In particular, no inferred 1993 for taxation and
      no inferred 2025 for refugees; sparse chart cells remain null. */
const ALL = ELECTION_YEARS;
const LATE = [2010, 2013, 2016, 2019, 2022, 2025];
const NO_1993 = ALL.filter((year) => year !== 1993);
const FROM_2007 = [2007, 2010, 2013, 2016, 2019, 2022, 2025];
const IMMIGRATION = [1996, 1998, 2001, 2004, 2007, 2013, 2016, 2019, 2022, 2025];
const REFUGEES = [2001, 2004, 2010, 2013, 2016, 2019, 2022];
const expectedYears = new Map(Object.entries({
  "3.1": ALL, "3.2": ALL, "3.3": LATE, "3.4": ALL, "3.5": NO_1993, "3.6": ALL,
  "3.7": ALL, "3.8": FROM_2007, "3.9": IMMIGRATION, "3.10": REFUGEES,
  "3.11": LATE, "3.12": ALL, "3.13": NO_1993, "3.14": ALL, "3.15": ALL,
  "3.16": FROM_2007, "3.17": IMMIGRATION, "3.18": REFUGEES,
}));
for (const [id, years] of expectedYears) assert.deepEqual(byId(id).rows.map((row) => row.year), years, `${id} dated coverage`);
assert.equal(at("3.1", 1993).Taxation, null);
assert.equal(at("3.1", 1990)["Management of the economy"], null);
assert.equal(at("3.1", 1990)["Cost of living"], null);
assert.equal(at("3.1", 2025).Unemployment, null);
assert.equal(at("3.2", 2007)["Refugees and asylum seekers"], null);
assert.equal(at("3.2", 1990).Immigration, null);
assert.equal(byId("3.5").rows.some((row) => row.year === 1993), false);
assert.equal(byId("3.13").rows.some((row) => row.year === 1993), false);
assert.equal(byId("3.10").rows.at(-1).year, 2022);
assert.equal(byId("3.18").rows.at(-1).year, 2022);
assert.equal(byId("3.10").rows.some((row) => row.year === 2025), false);
assert.equal(byId("3.18").rows.some((row) => row.year === 2025), false);
assert.match(byId("3.2").notes.join(" "), /Health and Medicare/);
assert.match(byId("3.2").notes.join(" "), /not included in 2007/);
assert.match(byId("3.1").notes.join(" "), /not included in 1993/);
console.log("3. Dated coverage, old gaps, 2022 endpoints and blank-cell preservation: OK");

/* 4. Clear deterministic value pins across all 18 series. These assert the
      official JSON values, not values reverse-engineered or renormalised from
      shares. The older values also pin the PDF's printed rounded labels. */
const PINS = [
  ["3.1", 1990, "Education", 5.1], ["3.1", 1990, "Unemployment", 10.7],
  ["3.1", 2022, "Cost of living", 31.9], ["3.1", 2025, "Cost of living", 35.7],
  ["3.2", 1990, "Health", 8.8], ["3.2", 2007, "Health", 20.5],
  ["3.2", 2025, "Health", 13.4], ["3.2", 2025, "Immigration", 6.3],
  ["3.3", 2010, "ALP", 27], ["3.3", 2025, "No difference", 27.1],
  ["3.4", 1990, "ALP", 34.1], ["3.4", 2025, "ALP", 39.7],
  ["3.5", 1990, "Coalition", 38.9], ["3.5", 2025, "ALP", 30.7],
  ["3.6", 1990, "ALP", 45.8], ["3.6", 2025, "ALP", 49.5],
  ["3.7", 1990, "ALP", 54], ["3.7", 2022, "ALP", 42.4], ["3.7", 2025, "Coalition", 16.5],
  ["3.8", 2007, "ALP", 55.3], ["3.8", 2025, "ALP", 37.5],
  ["3.9", 1996, "Coalition", 46.2], ["3.9", 2025, "ALP", 29],
  ["3.10", 2001, "Coalition", 46.4], ["3.10", 2022, "No difference", 24.5],
  ["3.11", 2010, "Extremely important", 69.8], ["3.11", 2025, "Extremely important", 68.7],
  ["3.12", 1990, "Quite important", 33], ["3.12", 2025, "Extremely important", 56.7],
  ["3.13", 1990, "Not very important", 10.1], ["3.13", 2025, "Quite important", 41.9],
  ["3.14", 1990, "Extremely important", 54.3], ["3.14", 2025, "Extremely important", 72.4],
  ["3.15", 1990, "Extremely important", 52], ["3.15", 2025, "Quite important", 41.6],
  ["3.16", 2007, "Extremely important", 51.5], ["3.16", 2025, "Not very important", 28.4],
  ["3.17", 1996, "Not very important", 32.8], ["3.17", 2025, "Extremely important", 41.8],
  ["3.18", 2001, "Extremely important", 50.5], ["3.18", 2022, "Quite important", 42.7],
];
for (const [id, year, option, value] of PINS) assert.equal(at(id, year)[option], value, `${id} ${year} ${option}`);
for (const id of CHARTS.slice(2, 10).map((def) => def.id)) {
  assert.deepEqual(byId(id).options, ["ALP", "Coalition", "No difference"]);
  assert.ok("No difference" in at(id, byId(id).rows[0].year), `${id} preserves No difference`);
}
for (const id of CHARTS.slice(10).map((def) => def.id)) assert.deepEqual(byId(id).options, ["Extremely important", "Quite important", "Not very important"]);
const partySum = Object.values(at("3.3", 2025)).reduce((a, b) => a + b, 0);
assert.equal(partySum.toFixed(1), "80.5", "no renormalisation of ALP + Coalition or removal of No difference");
assert.equal(at("3.3", 2025).Coalition, 22.7);
assert.equal(at("3.3", 2025).ALP, 30.7);
const oldEditionCheck = reconcilePreviousEdition(payload("3.7"), payload("3.7.2022"));
assert.equal(oldEditionCheck.comparedCells, 36);
assert.equal(oldEditionCheck.matchingCells, 33);
assert.deepEqual(oldEditionCheck.revisedCells, [
  { option: "ALP", year: 2022, previous: 51.2, current: 42.4 },
  { option: "Coalition", year: 2022, previous: 19.3, current: 16 },
  { option: "No difference", year: 2022, previous: 29.5, current: 24.4 },
]);
assert.deepEqual(manifest.previousEditionChecks, [oldEditionCheck]);
assert.equal(at("3.7", 2022).ALP, 42.4, "superseded 2022 value never replaces current chart");
assert.equal(at("3.7", 2022).Coalition, 16);
assert.equal(at("3.7", 2022)["No difference"], 24.4);
console.log("4. Official old/2025 value pins for every series, all response options and no renormalisation: OK");

/* 5. Full structural invariants and source-to-output cell parity for every
      current national row, including blank cells and all subgroup exclusion. */
let datedRows = 0, responseOptions = 0, numericCells = 0, nullCells = 0;
for (const def of CHARTS) {
  const series = byId(def.id), rawNational = payload(def.id).filter((row) => row.col1 === "");
  responseOptions += series.options.length;
  assert.ok(series.rows.every((row, index, rows) => index === 0 || row.year > rows[index - 1].year), `${def.id}: unique ascending years`);
  for (const row of series.rows) {
    datedRows++;
    assert.ok(ELECTION_YEARS.includes(row.year));
    assert.deepEqual(Object.keys(row.values), series.options);
    assert.ok(Object.values(row.values).some((value) => typeof value === "number"), `${def.id} ${row.year}: non-empty row`);
    for (const option of series.options) {
      const source = rawNational.find((entry) => entry.col0 === option);
      const expected = source[row.year] === "" || source[row.year] == null ? null : source[row.year];
      assert.equal(row.values[option], expected, `${def.id} ${row.year} ${option}: exact raw national cell`);
      if (row.values[option] == null) nullCells++;
      else {
        numericCells++;
        assert.ok(Number.isFinite(row.values[option]) && row.values[option] >= 0 && row.values[option] <= 100);
      }
    }
  }
}
assert.equal(datedRows, doc.coverage.datedRows);
assert.equal(responseOptions, doc.coverage.responseOptions);
assert.equal(numericCells, doc.coverage.numericCells);
assert.equal(nullCells, doc.coverage.nullCells);
console.log("5. Every output cell reconciles to its cached national aggregate cell: OK");

/* 6. Disk parity plus an entirely offline mocked refresh of all 19 routes.
      This proves refresh validation does not depend on the live service. */
assert.ok(fs.existsSync(OUT), "generate data/aes-issues.json first");
assert.equal(fs.readFileSync(OUT, "utf8"), JSON.stringify(doc, null, 2) + "\n");
assert.equal(JSON.stringify(buildIssues({ srcDir: SRC })), JSON.stringify(doc));
const calls = [];
const fetched = await refreshSources({
  srcDir: SRC,
  fetchImpl: async (url, options) => {
    calls.push({ url, accept: options.headers.accept });
    const id = url.slice(url.lastIndexOf("/") + 1);
    const def = [...CHARTS, PREVIOUS_ENVIRONMENT].find((entry) => entry.sheetId === id);
    assert.ok(def, `unexpected refresh route ${url}`);
    return new Response(cached(def.id), { status: 200, headers: { "content-type": "application/json" } });
  },
});
assert.equal(calls.length, 19);
assert.ok(calls.every((call) => call.accept === "application/json"));
assert.equal(new Set(calls.map((call) => call.url)).size, 19);
assert.equal(JSON.stringify(fetched.document), JSON.stringify(doc));
assert.deepEqual(fetched.manifest.sources.map((source) => source.id), manifest.sources.map((source) => source.id));
assert.deepEqual(fetched.manifest.sources.map((source) => source.retrievedAt), manifest.sources.map((source) => source.retrievedAt), "unchanged hashes retain stable retrieval provenance");
assert.deepEqual(fetched.manifest.previousEditionChecks, manifest.previousEditionChecks);
console.log("6. Deterministic disk parity and offline refresh of all official routes: OK");

/* 7. Real CLI in a temporary output location: default mode never fetches;
      first run writes, second is a no-op changed:false, --check is write-free
      and detects drift without modifying the output. */
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "aes-issues-test-"));
const tempOut = path.join(tmp, "data", "aes-issues.json");
const run = (args = []) => spawnSync(process.execPath, [SCRIPT, ...args], {
  cwd: tmp,
  env: { ...process.env, AES_ISSUES_SRC_DIR: SRC, AES_ISSUES_OUT: tempOut },
  encoding: "utf8",
  timeout: 30_000,
});
try {
  const first = run();
  assert.equal(first.status, 0, first.stderr);
  const firstStatus = JSON.parse(first.stdout.trim().split("\n").at(-1).replace(/^AES_ISSUES_STATUS /, ""));
  assert.equal(firstStatus.changed, true);
  assert.equal(firstStatus.refreshed, false);
  assert.equal(fs.readFileSync(tempOut, "utf8"), fs.readFileSync(OUT, "utf8"));
  const before = fs.statSync(tempOut).mtimeMs;
  const second = run();
  assert.equal(second.status, 0, second.stderr);
  const secondStatus = JSON.parse(second.stdout.trim().split("\n").at(-1).replace(/^AES_ISSUES_STATUS /, ""));
  assert.equal(secondStatus.changed, false);
  assert.equal(secondStatus.outputChanged, false);
  assert.equal(secondStatus.cachedFilesChanged, 0);
  assert.equal(fs.statSync(tempOut).mtimeMs, before, "idempotent run does not touch output");
  const checked = run(["--check"]);
  assert.equal(checked.status, 0, checked.stderr);
  assert.match(checked.stdout, /"changed":false/);
  fs.writeFileSync(tempOut, "{}\n");
  const drift = run(["--check"]);
  assert.equal(drift.status, 1);
  assert.match(drift.stdout, /"changed":true/);
  assert.equal(fs.readFileSync(tempOut, "utf8"), "{}\n", "drift check never writes");
}
finally { fs.rmSync(tmp, { recursive: true, force: true }); }
console.log("7. Offline CLI output parity, changed:false idempotency and write-free drift checks: OK");
console.log("test-aes-issues: all OK");
