#!/usr/bin/env node
// Build the historical Vote Compass issue-priority store from cached primary sources.
// No network access, no generated confidence intervals, and no inferred zeros.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const SOURCE_DIR = path.join(HERE, "vote-compass-issues-src");
const DEFAULT_OUTPUT = path.join(ROOT, "data", "vote-compass-issues.json");
const YEARS = [2013, 2016, 2019, 2022, 2025];

const read = (file) => fs.readFileSync(path.join(SOURCE_DIR, file), "utf8");
const unique = (values) => [...new Set(values)];
const tidy = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const roundTrip = (value) => JSON.stringify(value, null, 2) + "\n";

function invariant(condition, message) {
  if (!condition) throw new Error(`Vote Compass source guard: ${message}`);
}

/** RFC-4180-style CSV/TSV, including quoted newlines and preserved empty cells. */
export function parseDelimited(text, delimiter = null) {
  const input = String(text).replace(/^\uFEFF/, "");
  const firstLine = input.split(/\r?\n/, 1)[0];
  const delim = delimiter || (firstLine.includes("\t") ? "\t" : ",");
  invariant(delim === "," || delim === "\t", "only comma and tab delimiters are supported");
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      invariant(field === "", "quote begins only at the start of a field");
      quoted = true;
    } else if (char === delim) {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && input[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  invariant(!quoted, "unterminated quoted field");
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((cells) => !(cells.length === 1 && cells[0] === ""));
}

function objectsFromDelimited(text, delimiter = null) {
  const rows = parseDelimited(text, delimiter);
  invariant(rows.length > 1, "delimited source needs a header and at least one data row");
  const headers = rows[0].map((header) => header.trim());
  return rows.slice(1).map((cells) => Object.fromEntries(headers.map((header, i) => [header, cells[i] ?? ""])));
}

function numeric(value, { scale = 1 } = {}) {
  const cleaned = String(value).trim().replace(/%$/, "");
  invariant(cleaned !== "", "empty cell is not a numeric zero");
  invariant(/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(cleaned), `invalid numeric cell ${JSON.stringify(value)}`);
  // Remove floating-point conversion dust (0.29 × 100) without shortening source values.
  const result = scale === 1 ? Number(cleaned) : Number((Number(cleaned) * scale).toFixed(12));
  invariant(Number.isFinite(result) && result >= 0 && result <= 100, "percentage outside 0–100");
  return result;
}

function issueParts(label) {
  const lines = String(label).split(/\r?\n/);
  const issue = tidy(lines[0]);
  const descriptor = tidy(lines.slice(1).join(" ")) || null;
  invariant(issue !== "", "issue label cannot be blank");
  return descriptor ? { issue, descriptor } : { issue };
}

function jsString(haystack, expression, description) {
  const match = String(haystack).match(expression);
  invariant(match, `missing ${description}`);
  return JSON.parse(`"${match[1]}"`);
}

export function parseLegacyDatawrapperChartData(html) {
  return jsString(html, /chartData:\s*"((?:\\.|[^"\\])*)"/, "Datawrapper chartData");
}

export function parseSvelteDatawrapperProps(html) {
  const encoded = jsString(
    html,
    /window\.__DW_SVELTE_PROPS__\s*=\s*JSON\.parse\("((?:\\.|[^"\\])*)"\)/,
    "Datawrapper Svelte props",
  );
  return JSON.parse(encoded);
}

function legacyChartMeta(html) {
  const start = html.indexOf("chartJSON:");
  const end = html.indexOf("chartData:", start);
  invariant(start >= 0 && end > start, "legacy chart metadata bounds not found");
  const metadata = html.slice(start, end);
  const property = (name) => jsString(metadata, new RegExp(`"${name}":"((?:\\\\.|[^"\\\\])*)"`), `legacy ${name}`);
  return { intro: property("intro"), notes: property("notes") };
}

function nextDataObject(html) {
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  invariant(match, "ABC __NEXT_DATA__ script not found");
  return JSON.parse(match[1]);
}

function articleChildren(html) {
  const data = nextDataObject(html);
  const children = data?.props?.pageProps?.document?.loaders?.articledetail?.text?.descriptor?.children;
  invariant(Array.isArray(children), "ABC article body descriptor not found");
  return children;
}

function textOf(node) {
  if (!node || typeof node !== "object") return "";
  const own = node.type === "text" ? node.content || "" : "";
  return (node.children || []).reduce((text, child) => {
    const part = textOf(child);
    const separator = child.key === "li" && text && !/\s$/.test(text) && !/^\s/.test(part) ? " " : "";
    return text + separator + part;
  }, own);
}

function paragraphStarting(html, prefix) {
  const wanted = tidy(prefix);
  const paragraph = articleChildren(html).find((child) => tidy(textOf(child)).startsWith(wanted));
  invariant(paragraph, `ABC paragraph ${JSON.stringify(prefix)} not found`);
  return tidy(textOf(paragraph));
}

function articleMeta(html, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = html.match(new RegExp(`<meta (?:property|name)="${escaped}" content="([^"]*)"`));
  invariant(match, `ABC article metadata ${name} not found`);
  return match[1].replace(/&amp;/g, "&").replace(/&#x27;/g, "'");
}

function makeQuestion(text, { mode = null, optional = null, sensitive = null, note = null } = {}) {
  return { text, responseMode: mode, optional, sensitive, note };
}

function dimensions2013(csv) {
  const rows = objectsFromDelimited(csv);
  const dimensionNames = unique(rows.map((row) => row.seriesGroup));
  return dimensionNames.map((name) => {
    const subset = rows.filter((row) => row.seriesGroup === name);
    const groups = unique(subset.map((row) => row.series));
    const issues = unique(subset.map((row) => row.metric));
    return {
      id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
      label: name,
      groups,
      missingValueMeaning: "Not present in the source chart; never interpreted as zero.",
      values: issues.map((issue) => ({
        ...issueParts(issue),
        shares: Object.fromEntries(groups.map((group) => {
          const matches = subset.filter((row) => row.series === group && row.metric === issue);
          invariant(matches.length === 1, `2013 ${name}/${group}/${issue} must appear exactly once`);
          return [group, numeric(matches[0].value)];
        })),
      })),
    };
  });
}

function wideOverallDimension(rows, year, labelKey, options = {}) {
  const values = rows.map((row) => ({ row, value: numeric(row[year], options) }));
  return {
    id: "overall",
    label: "All respondents",
    groups: ["Overall"],
    missingValueMeaning: "Not published in this chart; never interpreted as zero.",
    values: values.map(({ row, value }) => ({ ...issueParts(row[labelKey]), shares: { Overall: value } })),
  };
}

function matrixFromLong(rows, id, label, groupHeader, issueHeader, valueHeader, options = {}) {
  const groups = unique(rows.map((row) => row[groupHeader]));
  const issueLabels = unique(rows.map((row) => tidy(row[issueHeader]).replace(/\n/g, " ")));
  const values = issueLabels.map((flatLabel) => {
    const candidates = rows.filter((row) => tidy(row[issueHeader]).replace(/\n/g, " ") === flatLabel);
    return {
      ...issueParts(candidates[0][issueHeader]),
      shares: Object.fromEntries(groups.map((group) => {
        const match = candidates.find((row) => row[groupHeader] === group);
        return [group, match ? numeric(match[valueHeader], options) : null];
      })),
    };
  });
  return {
    id,
    label,
    groups,
    missingValueMeaning: "Not published in this chart or blank in its source table; never interpreted as zero.",
    values,
  };
}

function modernChart(file) {
  const html = read(file);
  const props = parseSvelteDatawrapperProps(html);
  return {
    file,
    title: props.chart.title,
    intro: props.chart.metadata.describe.intro,
    notes: props.chart.metadata.annotate.notes,
  };
}

function source(id, kind, url, cache, role, extra = {}) {
  return { id, kind, url, cache, role, ...extra };
}

function chartCsvSource(id, url, file, role = "chart data", extra = {}) {
  return source(id, "delimited chart data", url, `.build/vote-compass-issues-src/${file}`, role, extra);
}

function coverageFor(datasets) {
  const notes = {
    2013: [
      "Only the preliminary 4–6 August issue-priority release is available here; the later final data.gov.au collection covers the 30 policy-attitude questions, not this question.",
      "The source's 16 published rows per group are retained without renormalisation, although their percentages do not total 100.",
    ],
    2016: [
      "The contemporaneous May article reports a ranking but no numeric issue shares. Its 60,310-respondent, 8–11 May sample is therefore not imputed onto either later chart.",
      "Two later ABC charts republish different national taxonomies; both are retained separately and neither supplies the 2016 sample count or fieldwork window.",
    ],
    2019: [
      "Age and state charts publish selected rows only; absent issue/group cells remain null, not zero.",
      "The 2022 retrospective chart uses a different 24-row taxonomy and does not restate the 2019 sample or fieldwork window, so it is a separate dataset.",
    ],
    2022: [
      "The 11–17 April release (97,159 respondents) and the later full-campaign comparison (471,491 responses) are distinct datasets, not a single time series or pooled estimate.",
      "Published sums need not be 100; rows and precision are retained exactly as published.",
    ],
    2025: [
      "The national chart has 17 rows. The age table has 19 rows, contains blank cells, and is not completed from national totals or treated as zero-filled.",
      "No other subgroup matrix was present in the cited 20 April publication.",
    ],
  };
  return YEARS.map((electionYear) => {
    const matching = datasets.filter((dataset) => dataset.electionYear === electionYear);
    return {
      electionYear,
      numericDatasetIds: matching.map((dataset) => dataset.id),
      numericObservations: matching.reduce((sum, dataset) => sum + dataset.dimensions.reduce((n, dimension) => n + dimension.values.reduce((m, row) => m + Object.values(row.shares).filter((value) => value !== null).length, 0), 0), 0),
      explicitlyUnreportedCells: matching.reduce((sum, dataset) => sum + dataset.dimensions.reduce((n, dimension) => n + dimension.values.reduce((m, row) => m + Object.values(row.shares).filter((value) => value === null).length, 0), 0), 0),
      limitations: notes[electionYear],
    };
  });
}

function dataGovAudit() {
  const searchFile = "2013-data-gov-package-search.json";
  const search = JSON.parse(read(searchFile));
  const packages = search.result.results.filter((item) => item.name.startsWith("vote-compass-2013-"));
  invariant(packages.length === 16, "expected 16 Vote Compass 2013 data.gov.au packages");
  const questionKey = objectsFromDelimited(read("2013-vote-compass-questions.csv"));
  invariant(questionKey.length === 30, "2013 answer key must contain 30 policy-attitude questions");
  invariant(!questionKey.some((row) => /most important/i.test(row.Question_Text)), "data.gov.au answer key unexpectedly added issue priority");
  const summaries = packages.map((item) => {
    const questionNumbers = unique(item.resources.map((resource) => Number(resource.url.match(/q(\d{2})/)?.[1])).filter(Number.isFinite)).sort((a, b) => a - b);
    invariant(!item.resources.some((resource) => /most important/i.test(resource.name)), `unexpected priority resource in ${item.name}`);
    return {
      package: item.name,
      canonicalUrl: `https://data.gov.au/data/dataset/${item.id}`,
      resourceCount: item.resources.length,
      policyQuestionNumbers: questionNumbers,
    };
  });
  return {
    requestedDatasetId: "ee721ad4-8205-4263-b040-c7c5b5e6d1c8f4",
    resolvedDatasetId: "ee721ad4-8205-4263-b040-c7c5e6d1c8f4",
    canonicalOverallUrl: "https://data.gov.au/data/dataset/vote-compass-2013-overall",
    sourceApiUrl: "https://data.gov.au/data/api/3/action/package_search?q=Vote%20Compass%202013&rows=100",
    packageCount: packages.length,
    resourceCount: summaries.reduce((sum, item) => sum + item.resourceCount, 0),
    packages: summaries,
    finding: "The 16 related packages enumerate only the 30 policy-attitude questions. None publishes a Which issue is most important resource. The overall package omits Q28–Q30 as well as issue priority; the other packages have Q1–Q30 plus the answer key. No issue-priority figure is imported from this collection.",
    caches: [
      ".build/vote-compass-issues-src/2013-data-gov-overall.html",
      `.build/vote-compass-issues-src/${searchFile}`,
      ".build/vote-compass-issues-src/2013-vote-compass-questions.csv",
    ],
  };
}

function buildPublications() {
  const article2013 = read("2013-abc-important-issues.html");
  const sample2013 = paragraphStarting(article2013, "Findings are based on the results of the initial ");
  const question2013 = paragraphStarting(article2013, "Respondents were asked: ");
  const article2016 = read("2016-abc-important-issues.html");
  const sample2016 = paragraphStarting(article2016, "These findings are based on ");
  const article2019 = read("2019-abc-important-issues.html");
  const weighting2019 = paragraphStarting(article2019, "Vote Compass responses have been weighted by ");
  const article2022 = read("2022-abc-important-issues.html");
  const weighting2022 = paragraphStarting(article2022, "Vote Compass responses have been weighted by ");
  const article2025 = read("2025-abc-important-issues.html");

  return [
    {
      id: "abc-2013-important-issues",
      electionYear: 2013,
      title: "Vote Compass: The most important issues to voters",
      url: "https://www.abc.net.au/news/2013-08-09/vote-compass-data-results-important-issues/4872896",
      publishedAt: articleMeta(article2013, "article:published_time"),
      modifiedAt: null,
      sampleStatement: sample2013,
      questionStatement: question2013,
      qualitativeConclusions: [paragraphStarting(article2013, "The economy is by far ")],
      methodologyCaveats: [
        paragraphStarting(article2013, "Vote Compass is not a poll. "),
        paragraphStarting(article2013, "Online surveys are inherently prone to selection bias "),
      ],
      cache: ".build/vote-compass-issues-src/2013-abc-important-issues.html",
    },
    {
      id: "abc-2016-important-issues",
      electionYear: 2016,
      title: "Vote Compass: Double dissolution trigger not a big issue for voters",
      url: "https://www.abc.net.au/news/2016-05-13/vote-compass-economy-important-issues/7408232",
      publishedAt: articleMeta(article2016, "article:published_time"),
      modifiedAt: articleMeta(article2016, "article:modified_time"),
      fieldwork: { start: "2016-05-08", end: "2016-05-11", precision: "day" },
      sample: { responses: Number(sample2016.match(/based on ([\d,]+) respondents/)[1].replaceAll(",", "")), statement: sample2016 },
      sampleStatement: sample2016,
      qualitativeConclusions: [paragraphStarting(article2016, "The results show Australians consider ")],
      numericIssueFiguresInArticle: false,
      note: "This contemporaneous article publishes the 60,310-respondent, 8–11 May sample and a qualitative ranking only. Those sample details are not assigned to retrospective 2016 figures published in 2019 or 2022.",
      cache: ".build/vote-compass-issues-src/2016-abc-important-issues.html",
    },
    {
      id: "abc-2019-important-issues",
      electionYear: 2019,
      title: "Vote Compass finds voters are split on economy and environment as most important issue",
      url: "https://www.abc.net.au/news/2019-04-17/vote-compass-election-most-important-issues/11003192",
      publishedAt: articleMeta(article2019, "article:published_time"),
      modifiedAt: articleMeta(article2019, "article:modified_time"),
      weightingStatement: weighting2019,
      cache: ".build/vote-compass-issues-src/2019-abc-important-issues.html",
    },
    {
      id: "abc-2022-important-issues",
      electionYear: 2022,
      title: "Vote Compass data shows climate change, cost of living and the economy are the big election issues, but voters still split along party lines",
      url: "https://www.abc.net.au/news/2022-04-22/vote-compass-federal-election-issues-data-climate-change-economy/101002116",
      publishedAt: articleMeta(article2022, "article:published_time"),
      modifiedAt: articleMeta(article2022, "article:modified_time"),
      weightingStatement: weighting2022,
      cache: ".build/vote-compass-issues-src/2022-abc-important-issues.html",
    },
    {
      id: "abc-2025-important-issues",
      electionYear: 2025,
      title: "Vote Compass data shows rise in importance of cost of living ahead of 2025 federal election",
      url: "https://www.abc.net.au/news/2025-04-20/federal-election-2025-most-important-issue-vote-compass/105178788",
      publishedAt: articleMeta(article2025, "article:published_time"),
      modifiedAt: articleMeta(article2025, "article:modified_time"),
      methodologyCaveats: [
        paragraphStarting(article2025, "Vote Compass is an educational tool "),
        paragraphStarting(article2025, "Responses have been weighted by "),
      ],
      cache: ".build/vote-compass-issues-src/2025-abc-important-issues.html",
    },
  ];
}

function build2013() {
  const csvFile = "2013-salience-chart-data.csv.js";
  const dimensions = dimensions2013(read(csvFile));
  invariant(dimensions.length === 8 && dimensions.every((dimension) => dimension.values.length === 16), "2013 chart must have 8 dimensions and 16 rows each");
  const article = read("2013-abc-important-issues.html");
  const statement = paragraphStarting(article, "Findings are based on the results of the initial ");
  const responses = Number(statement.match(/initial ([\d,]+) respondents/)[1].replaceAll(",", ""));
  const effective = Number(statement.match(/effective sample size of ([\d,]+) respondents/)[1].replaceAll(",", ""));
  invariant(/between August 4 and 6/.test(statement), "2013 fieldwork window not found");
  const question = paragraphStarting(article, "Respondents were asked: ").match(/"([^"]+)"/)[1];
  return {
    id: "2013-preliminary-abc-salience-chart",
    electionYear: 2013,
    publicationIds: ["abc-2013-important-issues"],
    timing: "contemporaneous preliminary release",
    fieldwork: { start: "2013-08-04", end: "2013-08-06", precision: "day" },
    sample: { responses, weightedEffectiveResponses: effective, statement },
    weightingStatement: statement,
    question: makeQuestion(question, { note: "Response mode is not stated in the cited article or chart source." }),
    notes: [
      "The archived ABC CSV is the primary numeric source; data.gov.au does not contain this issue-priority matrix.",
      "Values are chart percentages at their published precision, not renormalised shares.",
    ],
    sources: [chartCsvSource(
      "abc-2013-salience-chart-csv",
      "http://www.abc.net.au/news/code/4867996/Salience+Chart+Data+%28CSV%29+%281%29.js",
      csvFile,
      "all 2013 issue-priority figures",
      { archivedUrl: "https://web.archive.org/web/20130810072743id_/http://www.abc.net.au/news/code/4867996/Salience+Chart+Data+%28CSV%29+%281%29.js", archiveCapture: "2013-08-10T07:27:43Z" },
    )],
    dimensions,
  };
}

function build2019Release() {
  const overallFile = "2019-datawrapper-EgrRi-v2.html";
  const partyFile = "2019-datawrapper-ts7yd-v3.html";
  const ageFile = "2019-datawrapper-Ykpia-v2.html";
  const stateFile = "2019-datawrapper-Em7x3-v1.html";
  const overallHtml = read(overallFile);
  const tables = parseDelimited(parseLegacyDatawrapperChartData(overallHtml), "\t");
  const headers = tables[0];
  const overallRows = tables.slice(1).map((cells) => Object.fromEntries(headers.map((header, i) => [header, cells[i] ?? ""])));
  const overall2016 = wideOverallDimension(overallRows, "2016", "issue", { scale: 1 });
  const overall2019 = wideOverallDimension(overallRows, "2019", "issue", { scale: 1 });
  const party = matrixFromLong(objectsFromDelimited(parseLegacyDatawrapperChartData(read(partyFile)), "\t"), "vote-intention", "Vote intention", "by_group", "issue", "value");
  const age = matrixFromLong(objectsFromDelimited(parseLegacyDatawrapperChartData(read(ageFile)), "\t"), "age", "Age", "Age", "Issue", "value");
  const state = matrixFromLong(objectsFromDelimited(parseLegacyDatawrapperChartData(read(stateFile)), "\t"), "state", "State of residence", "State", "issue", "Values");
  const meta = legacyChartMeta(overallHtml);
  for (const [file, expected] of [[partyFile, "by party"], [ageFile, "by age"], [stateFile, "by State"]]) {
    const other = legacyChartMeta(read(file));
    invariant(other.notes === meta.notes, `${file} sample/time note differs from overall chart`);
  }
  const sampleResponses = Number(meta.notes.match(/Based on ([\d,]+) respondents/)[1].replaceAll(",", ""));
  invariant(meta.notes.includes("between April 10 and April 14, 2019"), "2019 chart fieldwork window not found");
  const question = meta.intro.match(/question: “([^”]+)”/)[1];
  const sourceOverall = source("abc-2019-overall-comparison-chart", "Datawrapper HTML with embedded TSV", "https://datawrapper.dwcdn.net/EgrRi/2/", `.build/vote-compass-issues-src/${overallFile}`, "2019 national figures and a separate 2016 retrospective distribution");
  const sourceParty = source("abc-2019-party-chart", "Datawrapper HTML with embedded TSV", "https://datawrapper.dwcdn.net/ts7yd/3/", `.build/vote-compass-issues-src/${partyFile}`, "2019 vote-intention figures");
  const sourceAge = source("abc-2019-age-chart", "Datawrapper HTML with embedded TSV", "https://datawrapper.dwcdn.net/Ykpia/2/", `.build/vote-compass-issues-src/${ageFile}`, "2019 selected age-row figures");
  const sourceState = source("abc-2019-state-chart", "Datawrapper HTML with embedded TSV", "https://datawrapper.dwcdn.net/Em7x3/1/", `.build/vote-compass-issues-src/${stateFile}`, "2019 selected state-row figures");
  return [
    {
      id: "2016-retrospective-in-2019-abc-chart",
      electionYear: 2016,
      publicationIds: ["abc-2019-important-issues"],
      timing: "2016 distribution republished in a 2019 comparison chart",
      fieldwork: null,
      sample: { responses: null, statement: "The 2016 sample count and fieldwork window are not stated in this retrospective chart." },
      weightingStatement: null,
      question: makeQuestion(question, { note: "The chart presents the 2016 and 2019 columns together under this question label; response mode is not stated." }),
      notes: ["Do not apply the 2019 chart's 119,516-respondent sample or April 2019 fieldwork window to these 2016 figures."],
      sources: [sourceOverall],
      dimensions: [overall2016],
    },
    {
      id: "2019-contemporaneous-abc-release",
      electionYear: 2019,
      publicationIds: ["abc-2019-important-issues"],
      timing: "contemporaneous release",
      fieldwork: { start: "2019-04-10", end: "2019-04-14", precision: "day" },
      sample: { responses: sampleResponses, statement: meta.notes },
      weightingStatement: paragraphStarting(read("2019-abc-important-issues.html"), "Vote Compass responses have been weighted by "),
      question: makeQuestion(question, { note: "Response mode is not stated in the cited chart." }),
      notes: [
        "Age and state dimensions contain only the rows printed in their charts; null cells are not zero.",
        "Percent signs are parsed as percentages, not proportions; rounded published values are not renormalised.",
      ],
      sources: [sourceOverall, sourceParty, sourceAge, sourceState],
      dimensions: [overall2019, party, age, state],
    },
  ];
}

function build2022Release() {
  const comparisonFile = "2022-datawrapper-PDdz8-v3.csv";
  const mainFile = "2022-datawrapper-2wPjA-v2.csv";
  const partyFile = "2022-datawrapper-Ce6p9-v3.csv";
  const comparisonRows = objectsFromDelimited(read(comparisonFile));
  const mainRows = objectsFromDelimited(read(mainFile));
  const overall2022 = wideOverallDimension(comparisonRows, "2022", "issue", { scale: 100 });
  const overall2019 = wideOverallDimension(comparisonRows, "2019", "issue", { scale: 100 });
  const overall2016 = wideOverallDimension(comparisonRows, "2016", "issue", { scale: 100 });
  const mainProjection = new Map(mainRows.map((row) => [tidy(row.issue), numeric(row.value, { scale: 100 })]));
  const comparisonByLabel = new Map(overall2022.values.map((row) => [tidy([row.issue, row.descriptor].filter(Boolean).join("\n")), row.shares.Overall]));
  for (const [key, value] of mainProjection) {
    invariant(comparisonByLabel.has(key), `2022 comparison chart is missing main-chart row ${key}`);
    invariant(comparisonByLabel.get(key) === value, `2022 charts disagree for ${key}`);
  }
  invariant(mainProjection.size === 19 && overall2022.values.length === 24, "2022 comparison must extend the 19-row main chart to 24 rows");
  const party = matrixFromLong(objectsFromDelimited(read(partyFile)), "vote-intention", "Vote intention", "Party", "Issue", "Value", { scale: 100 });
  const mainMeta = modernChart("2022-datawrapper-2wPjA-v2.html");
  const partyMeta = modernChart("2022-datawrapper-Ce6p9-v3.html");
  invariant(partyMeta.notes === mainMeta.notes, "2022 main and party sample notes differ");
  const responses = Number(mainMeta.notes.match(/based on ([\d,]+) respondents/)[1].replaceAll(",", ""));
  invariant(mainMeta.notes.includes("from April 11, 2022 to April 17, 2022"), "2022 fieldwork window not found");
  const question = mainMeta.intro.match(/“([^”]+)”/)[1];
  const comparisonUrl = "https://datawrapper.dwcdn.net/PDdz8/3/dataset.csv";
  const retrospectiveNotes = "The retrospective chart does not restate this year's sample count, fieldwork window or weighting statement. Its question label and taxonomy belong to the 2022 publication and are not merged with the 2019 chart's categories.";
  const comparisonSource = chartCsvSource("abc-2022-three-election-chart", comparisonUrl, comparisonFile, "2022 national 24-row matrix plus separate 2019 and 2016 retrospective distributions");
  const mainSource = chartCsvSource("abc-2022-national-chart", "https://datawrapper.dwcdn.net/2wPjA/2/dataset.csv", mainFile, "19-row projection of the 2022 national matrix, used as a cross-check");
  const partySource = chartCsvSource("abc-2022-party-chart", "https://datawrapper.dwcdn.net/Ce6p9/3/dataset.csv", partyFile, "2022 vote-intention figures");
  return [
    {
      id: "2016-retrospective-in-2022-abc-chart",
      electionYear: 2016,
      publicationIds: ["abc-2022-important-issues"],
      timing: "2016 distribution republished in a 2022 comparison chart",
      fieldwork: null,
      sample: { responses: null, statement: retrospectiveNotes },
      weightingStatement: null,
      question: makeQuestion(question, { mode: "open text (as described by the 2022 chart)", note: "Optional/sensitive status is not stated." }),
      notes: ["This 24-row taxonomy is distinct from the 2019 publication's 20-row 2016 distribution."],
      sources: [comparisonSource],
      dimensions: [overall2016],
    },
    {
      id: "2019-retrospective-in-2022-abc-chart",
      electionYear: 2019,
      publicationIds: ["abc-2022-important-issues"],
      timing: "2019 distribution republished in a 2022 comparison chart",
      fieldwork: null,
      sample: { responses: null, statement: retrospectiveNotes },
      weightingStatement: null,
      question: makeQuestion(question, { mode: "open text (as described by the 2022 chart)", note: "Optional/sensitive status is not stated." }),
      notes: ["Do not combine this retrospective taxonomy with the contemporaneous 2019 release."],
      sources: [comparisonSource],
      dimensions: [overall2019],
    },
    {
      id: "2022-contemporaneous-abc-release",
      electionYear: 2022,
      publicationIds: ["abc-2022-important-issues"],
      timing: "contemporaneous early-campaign release",
      fieldwork: { start: "2022-04-11", end: "2022-04-17", precision: "day" },
      sample: { responses, statement: mainMeta.notes },
      weightingStatement: paragraphStarting(read("2022-abc-important-issues.html"), "Vote Compass responses have been weighted by "),
      question: makeQuestion(question, { mode: "open text", optional: null, sensitive: null, note: "Optional/sensitive status is not stated." }),
      notes: [
        "The separate three-election comparison supplies five additional zero-valued national rows beyond the 19-row main chart; their common 19 rows are identical and cross-checked.",
        "Source values are proportions in the CSV and are multiplied by 100 exactly once.",
      ],
      sources: [mainSource, partySource, comparisonSource],
      dimensions: [overall2022, party],
    },
  ];
}

function build2025Release() {
  const nationalFile = "2025-datawrapper-uN3JC-v1.csv";
  const ageFile = "2025-datawrapper-OQjYm-v2.csv";
  const comparisonFile = "2025-datawrapper-HVHU4-v1.csv";
  const nationalRows = parseDelimited(read(nationalFile), "\t").slice(1).map(([issue, value]) => ({ issue, Value: value }));
  const national = wideOverallDimension(nationalRows, "Value", "issue");
  const ageRowsRaw = parseDelimited(read(ageFile), "\t");
  const ageGroups = ageRowsRaw[0].slice(1);
  const age = {
    id: "age",
    label: "Age",
    groups: ageGroups,
    missingValueMeaning: "Blank source cell; not zero and not back-filled from another group or the national total.",
    values: ageRowsRaw.slice(1).map((cells) => ({
      ...issueParts(cells[0]),
      shares: Object.fromEntries(ageGroups.map((group, i) => [group, cells[i + 1]?.trim() ? numeric(cells[i + 1]) : null])),
    })),
  };
  const comparisonRaw = objectsFromDelimited(read(comparisonFile), "\t");
  const retrospective2022 = wideOverallDimension(comparisonRaw, "2022", "Most important issue");
  const comparison2025 = wideOverallDimension(comparisonRaw, "2025", "Most important issue");
  invariant(comparison2025.values.length === national.values.length, "2025 charts contain different row counts");
  const compareByIssue = new Map(comparison2025.values.map((row) => [row.issue, row.shares.Overall]));
  for (const row of national.values) invariant(compareByIssue.get(row.issue) === row.shares.Overall, `2025 national charts disagree for ${row.issue}`);
  const ageMeta = modernChart("2025-datawrapper-OQjYm-v2.html");
  const comparisonMeta = modernChart("2025-datawrapper-HVHU4-v1.html");
  const currentResponses = Number(ageMeta.notes.match(/Based on ([\d,]+) respondents/)[1].replaceAll(",", ""));
  invariant(/in April 2025/.test(ageMeta.notes), "2025 fieldwork month not found");
  const modelledErrorEstimate = "The modelled error estimate is ± 0.5%."; // verbatim inside ageMeta.notes
  invariant(ageMeta.notes.includes(modelledErrorEstimate), "2025 modelled-error statement not found");
  invariant(comparisonMeta.notes.includes(`2025 data based on ${currentResponses.toLocaleString("en-US")} responses`), "2025 national response count differs between charts");
  const retrospectiveResponses = Number(comparisonMeta.notes.match(/2022 data is based on ([\d,]+) responses/)[1].replaceAll(",", ""));
  const config = JSON.parse(read("2025-vote-compass-instance.json"));
  const questionConfig = config.questions.most_important_issue;
  invariant(questionConfig?.label?.en === "What issue is most important to you in this election?", "2025 question config wording changed");
  invariant(questionConfig.answerType === "text" && questionConfig.optional === true && questionConfig.sensitive === true, "2025 question config metadata changed");
  const comparisonSource = chartCsvSource("abc-2025-2022-comparison-chart", "https://datawrapper.dwcdn.net/HVHU4/1/dataset.csv", comparisonFile, "2025 national cross-check and separate 2022 full-campaign comparison");
  const nationalSource = chartCsvSource("abc-2025-national-chart", "https://datawrapper.dwcdn.net/uN3JC/1/dataset.csv", nationalFile, "2025 national figures");
  const ageSource = chartCsvSource("abc-2025-age-chart", "https://datawrapper.dwcdn.net/OQjYm/2/dataset.csv", ageFile, "2025 age figures with blank cells preserved");
  return [
    {
      id: "2022-retrospective-in-2025-abc-chart",
      electionYear: 2022,
      publicationIds: ["abc-2025-important-issues"],
      timing: "2022 full-campaign distribution republished in a 2025 comparison chart",
      fieldwork: null,
      sample: {
        responses: retrospectiveResponses,
        statement: comparisonMeta.notes,
        publishedModelledErrorEstimate: comparisonMeta.notes.match(/There is a modelled error estimate of [^%]+%\./)[0],
      },
      weightingStatement: null,
      question: makeQuestion(null, { note: "The 2025 comparison chart does not restate the 2022 question wording; see the 2022 contemporaneous dataset rather than assigning the 2025 config to it." }),
      notes: ["The chart states 471,491 responses but no exact 2022 fieldwork dates. It is not merged with the 97,159-respondent April 2022 release."],
      sources: [comparisonSource],
      dimensions: [retrospective2022],
    },
    {
      id: "2025-contemporaneous-abc-release",
      electionYear: 2025,
      publicationIds: ["abc-2025-important-issues"],
      timing: "contemporaneous release",
      fieldwork: { period: "2025-04", precision: "month", note: "Only April 2025 is stated; exact response dates are not published." },
      sample: {
        responses: currentResponses,
        statement: ageMeta.notes,
        publishedModelledErrorEstimate: modelledErrorEstimate,
      },
      weightingStatement: paragraphStarting(read("2025-abc-important-issues.html"), "Responses have been weighted by "),
      question: makeQuestion(questionConfig.label.en, {
        mode: "free text",
        optional: questionConfig.optional,
        sensitive: questionConfig.sensitive,
        note: "The instance config supplies wording and answer metadata only, not respondent aggregates. This imported config is pinned by its instance id 7e90bdf8d43503a2764c6224fb3cdc.",
      }),
      questionConfig: {
        answerType: questionConfig.answerType,
        displayType: questionConfig.displayType,
        type: questionConfig.type,
        source: source("vote-compass-2025-instance-config", "JSON instrument config", "https://r2.votecompass.com/instances/7e90bdf8d43503a2764c6224fb3cdc.json", ".build/vote-compass-issues-src/2025-vote-compass-instance.json", "question wording and metadata only"),
      },
      notes: [
        "The publisher's modelled error statement is retained verbatim. No confidence interval is calculated from the raw count.",
        "All 17 national rows agree exactly with the 2025 column in the 2022/2025 comparison chart, so they are stored once with both sources.",
      ],
      sources: [nationalSource, ageSource, comparisonSource],
      dimensions: [national, age],
    },
  ];
}

export function buildStore() {
  const datasets = [
    build2013(),
    ...build2019Release(),
    ...build2022Release(),
    ...build2025Release(),
  ];
  const store = {
    schemaVersion: 1,
    name: "Vote Compass historical issue priority",
    generatedBy: ".build/extract-vote-compass-issues.mjs",
    deterministic: true,
    electionYears: YEARS,
    measure: {
      label: "Respondents nominating an issue in response to the most-important-issue prompt",
      unit: "percent",
      valuesBasis: "Publisher-weighted chart percentages. Values keep their published precision and need not sum to 100; no row or dataset is renormalised.",
      nullMeaning: "Not published or blank in the source table; never zero.",
    },
    methodology: {
      design: "Self-selected online non-probability participation in Vote Compass, with publisher/applied weighting varying by release.",
      probabilitySample: false,
      populationCaveat: "Do not describe these raw-n figures as a probability survey or equate a large self-selected sample with probability-sample precision. Publisher claims of national representativeness are retained as attributed source statements, not independently verified.",
      uncertainty: "No confidence interval is calculated here from raw n. Publisher-modelled error estimates are retained only where the cited chart prints them.",
      identityProtection: "No respondent-level records are imported. The 2025 question config's optional and sensitive flags describe the instrument, not sample sizes or aggregates.",
    },
    publications: buildPublications(),
    sourceAudits: {
      dataGovAu2013: dataGovAudit(),
      excludedFromNumericStore: [
        "The 2013 final policy-attitude explorer and data.gov.au response CSVs concern Q1–Q30 policy statements, not issue priority; their final-sample counts must not be attached to the preliminary salience chart.",
        "The 2025 Vote Compass instance config contributes wording and optional/sensitive/free-text metadata only; it is not an aggregate respondent-data source.",
      ],
    },
    datasets,
    coverage: [],
  };
  store.coverage = coverageFor(datasets);
  validateStore(store);
  return store;
}

export function validateStore(store) {
  invariant(store.electionYears.join(",") === YEARS.join(","), "election-year coverage changed");
  invariant(store.methodology.probabilitySample === false, "non-probability status must remain explicit");
  invariant(store.coverage.every((row) => row.numericDatasetIds.length > 0), "every requested election year must have actual numeric data");
  for (const dataset of store.datasets) {
    invariant(YEARS.includes(dataset.electionYear), `${dataset.id} has an unknown election year`);
    invariant(dataset.publicationIds.every((id) => store.publications.some((publication) => publication.id === id)), `${dataset.id} publication reference is missing`);
    invariant(dataset.question, `${dataset.id} lacks question metadata`);
    invariant(dataset.sources.length > 0, `${dataset.id} lacks primary sources`);
    invariant(dataset.dimensions.length > 0, `${dataset.id} lacks observations`);
    for (const dimension of dataset.dimensions) {
      invariant(dimension.groups.length > 0 && dimension.values.length > 0, `${dataset.id}/${dimension.id} is empty`);
      for (const row of dimension.values) {
        invariant(Object.keys(row.shares).length === dimension.groups.length, `${dataset.id}/${dimension.id}/${row.issue} is not a complete labelled matrix row`);
        for (const value of Object.values(row.shares)) {
          invariant(value === null || (Number.isFinite(value) && value >= 0 && value <= 100), `${dataset.id}/${row.issue} has an invalid percentage`);
        }
      }
    }
  }
  invariant(store.datasets.every((dataset) => dataset.sample.responses !== 0), "zero response count is not allowed");
  invariant(store.coverage.find((row) => row.electionYear === 2016).limitations.some((note) => note.includes("60,310")), "2016 sample provenance caveat missing");
  invariant(store.datasets.find((dataset) => dataset.id === "2025-contemporaneous-abc-release").dimensions.find((dimension) => dimension.id === "age").values.some((row) => Object.values(row.shares).includes(null)), "2025 blank age cells must survive as null");
  return true;
}

function main() {
  const args = process.argv.slice(2);
  const check = args.includes("--check");
  const outputFlag = args.indexOf("--output");
  const output = outputFlag >= 0 ? path.resolve(args[outputFlag + 1]) : DEFAULT_OUTPUT;
  const serialised = roundTrip(buildStore());
  if (check) {
    const existing = fs.readFileSync(output, "utf8");
    if (existing !== serialised) {
      console.error(`${output} is stale; run node .build/extract-vote-compass-issues.mjs`);
      process.exitCode = 1;
      return;
    }
    console.log(`OK ${output} is current (${(serialised.length / 1024).toFixed(1)} KiB)`);
    return;
  }
  fs.writeFileSync(output, serialised);
  const store = JSON.parse(serialised);
  const counts = Object.fromEntries(store.coverage.map((row) => [row.electionYear, row.numericObservations]));
  console.log(`Wrote ${output}`);
  console.log(`Numeric observations by election year: ${JSON.stringify(counts)}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
