import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  buildStore,
  parseDelimited,
  parseLegacyDatawrapperChartData,
  parseSvelteDatawrapperProps,
  validateStore,
} from "./extract-vote-compass-issues.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const DATA_FILE = path.join(ROOT, "data", "vote-compass-issues.json");
const store = buildStore();
const datasets = Object.fromEntries(store.datasets.map((dataset) => [dataset.id, dataset]));
const dimension = (datasetId, id) => {
  const result = datasets[datasetId].dimensions.find((candidate) => candidate.id === id);
  assert.ok(result, `${datasetId}/${id} must exist`);
  return result;
};
const issue = (datasetId, dimensionId, issueLabel, group = "Overall") => {
  const row = dimension(datasetId, dimensionId).values.find((candidate) => candidate.issue === issueLabel);
  assert.ok(row, `${datasetId}/${dimensionId}/${issueLabel} must exist`);
  assert.ok(Object.hasOwn(row.shares, group), `${group} must be a labelled column`);
  return row.shares[group];
};
const allKeys = (value, keys = []) => {
  if (value && typeof value === "object") {
    keys.push(...Object.keys(value));
    for (const child of Object.values(value)) allKeys(child, keys);
  }
  return keys;
};

test("all requested election years have validated numeric coverage", () => {
  assert.equal(validateStore(store), true);
  assert.deepEqual(store.electionYears, [2013, 2016, 2019, 2022, 2025]);
  assert.equal(store.datasets.length, 8);
  assert.equal(store.publications.length, 5);
  assert.deepEqual(
    store.coverage.map(({ electionYear, numericObservations }) => [electionYear, numericObservations]),
    [[2013, 512], [2016, 44], [2019, 160], [2022, 117], [2025, 99]],
  );
  assert.equal(store.coverage.reduce((sum, row) => sum + row.numericObservations, 0), 932);
  assert.equal(store.coverage.find((row) => row.electionYear === 2019).explicitlyUnreportedCells, 14);
  assert.equal(store.coverage.find((row) => row.electionYear === 2025).explicitlyUnreportedCells, 13);
});

test("CSV and TSV parser preserves multiline labels, escapes, zeros and blank cells", () => {
  const rows = parseDelimited('issue,2022,2019\n"Climate change\n(global heating/warming, emissions, etc.)",0.29,\n"Women\'s ""other"" label",0,0.01\n');
  assert.equal(rows.length, 3);
  assert.deepEqual(rows[0], ["issue", "2022", "2019"]);
  assert.deepEqual(rows[1], ["Climate change\n(global heating/warming, emissions, etc.)", "0.29", ""]);
  assert.deepEqual(rows[2], ["Women's \"other\" label", "0", "0.01"]);

  const tabbed = parseDelimited("\t18-29\t30-39\nEmployment\t\t1.05135938\n", "\t");
  assert.deepEqual(tabbed[0], ["", "18-29", "30-39"]);
  assert.deepEqual(tabbed[1], ["Employment", "", "1.05135938"]);
  assert.throws(() => parseDelimited('issue,value\n"unclosed,1\n'), /unterminated quoted field/);
});

test("Datawrapper parsers read script data without evaluating source JavaScript", () => {
  const chartData = parseLegacyDatawrapperChartData('render({chartData: "issue\\t2016\\t2019\\nEnvironment\\t9%\\t29%\\n"});');
  assert.equal(chartData, "issue\t2016\t2019\nEnvironment\t9%\t29%\n");

  const modern = fs.readFileSync(path.join(ROOT, ".build/vote-compass-issues-src/2022-datawrapper-2wPjA-v2.html"), "utf8");
  const props = parseSvelteDatawrapperProps(modern);
  assert.equal(props.chart.title, "Climate and economy are top order issues for Australians this election");
  assert.match(props.chart.metadata.describe.intro, /open-text question/);
  assert.match(props.chart.metadata.annotate.notes, /97,159 respondents/);
});

test("2013 data.gov.au audit establishes that issue priority is absent", () => {
  const audit = store.sourceAudits.dataGovAu2013;
  assert.equal(audit.packageCount, 16);
  assert.equal(audit.resourceCount, 493);
  assert.equal(audit.packages.length, 16);
  const overall = audit.packages.find((item) => item.package === "vote-compass-2013-overall");
  assert.equal(overall.resourceCount, 28);
  assert.deepEqual(overall.policyQuestionNumbers, Array.from({ length: 27 }, (_, i) => i + 1));
  for (const item of audit.packages.filter((candidate) => candidate !== overall)) {
    assert.equal(item.resourceCount, 31);
    assert.deepEqual(item.policyQuestionNumbers, Array.from({ length: 30 }, (_, i) => i + 1));
  }
  assert.match(audit.finding, /None publishes a Which issue is most important resource/);
});

test("2013 imports the complete published salience matrix, not policy-attitude data", () => {
  const dataset = datasets["2013-preliminary-abc-salience-chart"];
  assert.equal(dataset.sample.responses, 250000);
  assert.equal(dataset.sample.weightedEffectiveResponses, 53644);
  assert.deepEqual(dataset.fieldwork, { start: "2013-08-04", end: "2013-08-06", precision: "day" });
  assert.equal(dataset.question.text, "Which issue is most important to you personally in this election campaign?");
  assert.equal(dataset.dimensions.length, 8);
  assert.ok(dataset.dimensions.every((item) => item.values.length === 16));
  assert.equal(new Set(dataset.dimensions.flatMap((item) => item.groups)).size, 32);
  assert.equal(issue(dataset.id, "overall", "Economy"), 27.82589913);
  assert.equal(issue(dataset.id, "overall", "Asylum seekers"), 12.92412407);
  assert.equal(issue(dataset.id, "vote-intention", "Economy", "LIB"), 49.74418442);

  const total = dimension(dataset.id, "overall").values.reduce((sum, row) => sum + row.shares.Overall, 0);
  assert.ok(Math.abs(total - 94.406108) < 0.000001);
  assert.ok(total < 100, "published rows must not be silently renormalised to 100");
  assert.match(dataset.sources[0].archivedUrl, /^https:\/\/web\.archive\.org\//);
  assert.match(dataset.sources[0].url, /Salience\+Chart\+Data/);
});

test("2016 retrospective releases stay separate from the contemporaneous 60,310 sample", () => {
  const publication = store.publications.find((item) => item.id === "abc-2016-important-issues");
  assert.equal(publication.sample.responses, 60310);
  assert.deepEqual(publication.fieldwork, { start: "2016-05-08", end: "2016-05-11", precision: "day" });
  assert.equal(publication.numericIssueFiguresInArticle, false);
  assert.match(publication.qualitativeConclusions[0], /economy the most important election issue, followed by education and health/);

  for (const id of ["2016-retrospective-in-2019-abc-chart", "2016-retrospective-in-2022-abc-chart"]) {
    assert.equal(datasets[id].sample.responses, null);
    assert.equal(datasets[id].fieldwork, null);
  }
  assert.equal(issue("2016-retrospective-in-2019-abc-chart", "overall", "Economy"), 25);
  assert.equal(issue("2016-retrospective-in-2019-abc-chart", "overall", "Environment"), 9);
  assert.equal(dimension("2016-retrospective-in-2019-abc-chart", "overall").values.length, 20);
  assert.equal(issue("2016-retrospective-in-2022-abc-chart", "overall", "Climate change"), 5);
  assert.equal(issue("2016-retrospective-in-2022-abc-chart", "overall", "Environment"), 4);
  assert.equal(dimension("2016-retrospective-in-2022-abc-chart", "overall").values.length, 24);
});

test("2019 national and subgroup figures preserve selected-row gaps", () => {
  const id = "2019-contemporaneous-abc-release";
  assert.equal(datasets[id].sample.responses, 119516);
  assert.deepEqual(datasets[id].fieldwork, { start: "2019-04-10", end: "2019-04-14", precision: "day" });
  assert.equal(datasets[id].question.text, "What issue is most important to you in this election?");
  assert.equal(issue(id, "overall", "Environment"), 29);
  assert.equal(issue(id, "overall", "Economy"), 23);
  assert.equal(issue(id, "vote-intention", "Environment", "Australian Greens"), 63);
  assert.equal(issue(id, "vote-intention", "Economy", "Liberal-National Coalition"), 44);
  assert.equal(issue(id, "age", "Environment", "18-34"), 39);
  assert.equal(issue(id, "age", "Economy", "55+"), 24);
  assert.equal(issue(id, "age", "Economy", "18-34"), 18);
  assert.equal(issue(id, "state", "Healthcare", "Tas"), 16);

  const age = dimension(id, "age");
  assert.equal(age.values.length, 6);
  assert.equal(age.values.reduce((sum, row) => sum + Object.values(row.shares).filter((value) => value === null).length, 0), 6);
  const state = dimension(id, "state");
  assert.equal(state.values.length, 4);
  assert.equal(issue(id, "state", "Superannuation and pensions", "NSW"), null, "unpublished state rows are null, never zero");
  assert.match(datasets[id].notes.join(" "), /null cells are not zero/);
  assert.equal(datasets["2019-retrospective-in-2022-abc-chart"].sample.responses, null);
  assert.equal(datasets["2019-retrospective-in-2022-abc-chart"].fieldwork, null);
});

test("2022 proportions are converted once and vote-intention subgroups are complete", () => {
  const id = "2022-contemporaneous-abc-release";
  assert.equal(datasets[id].sample.responses, 97159);
  assert.deepEqual(datasets[id].fieldwork, { start: "2022-04-11", end: "2022-04-17", precision: "day" });
  assert.equal(datasets[id].question.responseMode, "open text");
  assert.equal(issue(id, "overall", "Climate change"), 29);
  assert.equal(issue(id, "overall", "Cost of living and affordability"), 13);
  assert.equal(issue(id, "overall", "Agriculture and animal welfare"), 0, "a printed zero must remain a real zero");
  assert.equal(dimension(id, "overall").values.length, 24);
  assert.equal(dimension(id, "vote-intention").values.length, 19);
  assert.equal(issue(id, "vote-intention", "Economy and finance", "Liberal-National Coalition"), 34);
  assert.equal(issue(id, "vote-intention", "Economy and finance", "Australian Labor Party"), 7);
  assert.equal(issue(id, "vote-intention", "Climate change", "Australian Greens"), 50);

  const retrospective = datasets["2022-retrospective-in-2025-abc-chart"];
  assert.equal(retrospective.sample.responses, 471491);
  assert.equal(retrospective.fieldwork, null);
  assert.equal(retrospective.question.text, null, "2025 wording must not be assigned to the 2022 comparison");
  assert.equal(issue(retrospective.id, "overall", "Climate change"), 23.46164573);
  assert.equal(issue(retrospective.id, "overall", "Cost of living/Affordability"), 9.088214015);
  assert.match(retrospective.sample.publishedModelledErrorEstimate, /modelled error estimate of \+\/-0\.5%/);
});

test("2025 free-text question, national values and blank age cells are preserved", () => {
  const id = "2025-contemporaneous-abc-release";
  const dataset = datasets[id];
  assert.equal(dataset.sample.responses, 254376);
  assert.equal(dataset.fieldwork.period, "2025-04");
  assert.equal(dataset.fieldwork.start, undefined);
  assert.equal(dataset.question.text, "What issue is most important to you in this election?");
  assert.equal(dataset.question.responseMode, "free text");
  assert.equal(dataset.question.optional, true);
  assert.equal(dataset.question.sensitive, true);
  assert.equal(dataset.questionConfig.answerType, "text");
  assert.equal(dataset.questionConfig.source.kind, "JSON instrument config");
  assert.equal(issue(id, "overall", "Cost of living/Affordability"), 25.72597618);
  assert.equal(issue(id, "overall", "Economy and finance"), 11.55036815);
  assert.equal(dimension(id, "overall").values.length, 17);

  const age = dimension(id, "age");
  assert.equal(age.values.length, 19);
  assert.equal(age.groups.length, 5);
  assert.equal(age.values.reduce((sum, row) => sum + Object.values(row.shares).filter((value) => value === null).length, 0), 13);
  assert.equal(issue(id, "age", "Employment", "18-29"), null);
  assert.equal(issue(id, "age", "Employment", "30-39"), 1.05135938);
  assert.equal(issue(id, "age", "Gay rights", "18-29"), 1.350533755);
  assert.equal(issue(id, "age", "Gay rights", "65+"), null);
  assert.equal(issue(id, "age", "Cost of living/Affordability", "65+"), 18.85778765);
  assert.equal(issue(id, "age", "Climate change", "65+"), 12.67151612);
  assert.match(dataset.sample.publishedModelledErrorEstimate, /modelled error estimate is ± 0\.5%/);
});

test("sampling caveat and uncertainty policy survive every release", () => {
  assert.equal(store.methodology.probabilitySample, false);
  assert.match(store.methodology.design, /Self-selected online non-probability/);
  assert.match(store.methodology.uncertainty, /No confidence interval is calculated/);
  const keys = allKeys(store);
  assert.equal(keys.some((key) => /^(?:ci95|confidenceInterval|marginOfError|standardError)$/i.test(key)), false);
  assert.ok(store.datasets.every((dataset) => !JSON.stringify(dataset).includes("random sample CI")));
  assert.equal(datasets["2022-retrospective-in-2025-abc-chart"].sample.responses, 471491);
  assert.equal(datasets["2025-contemporaneous-abc-release"].sample.responses, 254376);
});

test("every cited cache exists and regeneration is byte-idempotent offline", () => {
  const caches = new Set();
  const visit = (value) => {
    if (!value || typeof value !== "object") return;
    if (typeof value.cache === "string") caches.add(value.cache);
    for (const child of Object.values(value)) visit(child);
  };
  visit(store);
  assert.equal(caches.size, 17);
  for (const cache of [...caches, ...store.sourceAudits.dataGovAu2013.caches]) {
    assert.ok(fs.existsSync(path.join(ROOT, cache)), `${cache} must be cached`);
  }

  const onDisk = fs.readFileSync(DATA_FILE, "utf8");
  assert.equal(onDisk, JSON.stringify(buildStore(), null, 2) + "\n");
  assert.equal(JSON.stringify(buildStore()), JSON.stringify(buildStore()));
  const check = spawnSync(process.execPath, [path.join(HERE, "extract-vote-compass-issues.mjs"), "--check"], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, http_proxy: "http://127.0.0.1:1", https_proxy: "http://127.0.0.1:1" },
  });
  assert.equal(check.status, 0, check.stderr || check.stdout);
  assert.match(check.stdout, /is current/);
});
