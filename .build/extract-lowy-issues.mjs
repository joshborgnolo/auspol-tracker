#!/usr/bin/env node
/*
 * Build data/lowy-issues.json from the Lowy Institute's own Svelte payload.
 *
 * Default operation is deliberately offline: both chart forms and the four
 * reference reports are read from .build/lowy-issues-src. --refresh refetches
 * those primary sources and regenerates the report text with pdftotext.
 * There is no made-up CSV endpoint and no evaluation of source JavaScript.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(HERE), "..");
const CACHE = path.join(ROOT, ".build", "lowy-issues-src");
const OUT = path.join(ROOT, "data", "lowy-issues.json");
export const CHART_URL = "https://poll.lowyinstitute.org/charts/better-party-by-foreign-policy-issue/";
export const EMBED_URL = "https://poll.lowyinstitute.org/charts/embed/better-party-by-foreign-policy-issue";
const CHART_CACHE = path.join(CACHE, "better-party-by-foreign-policy-issue.html");
const EMBED_CACHE = path.join(CACHE, "better-party-by-foreign-policy-issue-embed.html");
const REPORT_URL = (year) => `https://poll.lowyinstitute.org/files/lowyinstitutepoll-${year}.pdf`;
const REPORT_TXT = (year) => path.join(CACHE, `lowyinstitutepoll-${year}.txt`);
const REPORT_PDF = (year) => path.join(CACHE, `lowyinstitutepoll-${year}.pdf`);
const CACHE_REF = ".build/lowy-issues-src";

// These are report-verified survey facts, not figures inferred from the chart
// or its genre. The chart alone supplies every vote-share value below.
const WAVE_FACTS = [
  {
    year: 2013,
    start: "2013-03-04",
    end: "2013-03-20",
    sample: 1002,
    mode: "Fixed-line and mobile telephone fieldwork by Field Works Market Research.",
    question: "Now, about the Australian federal election which will be held on the 14th September this year. Which party, either the Labor Party or the Liberal–Nationals Coalition, do you personally think would do a better job of handling each of the following issues?",
    questionSource: "2013 report, Figure 1 (page 4)",
  },
  {
    year: 2016,
    start: "2016-02-26",
    end: "2016-03-15",
    sample: 1202,
    mode: "Fixed-line and mobile telephone fieldwork by Field Works Market Research.",
    question: "Now about the Australian federal election which will be held later this year. Which party, either the Labor Party or the Liberal-Nationals Coalition, do you personally think would do a better job of handling each of the following issues:",
    questionSource: "2016 report, Figure 1 (page 5)",
  },
  {
    year: 2019,
    start: "2019-03-12",
    end: "2019-03-25",
    sample: 2130,
    mode: "Life in Australia probability-based panel; 89% online and 11% computer-assisted telephone interviewing, conducted by the Social Research Centre.",
    question: null,
    questionSource: null,
    questionNote: "The 2019 report verifies fieldwork, mode and the overall sample, but does not print this battery's question stem. No wording is back-filled from another wave.",
  },
  {
    year: 2025,
    start: "2025-03-03",
    end: "2025-03-16",
    sample: 2117,
    mode: "Life in Australia probability-based panel; 99% online and 1% computer-assisted telephone interviewing, conducted by the Social Research Centre.",
    // Filled from the chart's exact 2025 wording in buildStore().
    question: null,
    questionSource: "2025 report, Figure 39 (page 35), and the official chart",
  },
];

const plain = (text) => text.replace(/\s+/g, " ").trim();

/** A recursive-descent reader for the JSON-like object literals in Svelte's
 * hydration data. It accepts data only: calls, functions, computed properties
 * and any other executable syntax are rejected at the offending byte. */
export class LiteralParser {
  constructor(text, source = "literal") {
    this.text = text;
    this.source = source;
    this.pos = 0;
  }

  fail(message) {
    const before = this.text.slice(Math.max(0, this.pos - 45), this.pos);
    const after = this.text.slice(this.pos, this.pos + 65);
    throw new SyntaxError(`${this.source}: ${message} at byte ${this.pos}; …${before}⟦HERE⟧${after}…`);
  }

  space() {
    while (this.pos < this.text.length && /\s/.test(this.text[this.pos])) this.pos++;
  }

  expect(char) {
    this.space();
    if (this.text[this.pos] !== char) this.fail(`expected ${JSON.stringify(char)}`);
    this.pos++;
  }

  parse() {
    const result = this.value();
    this.space();
    if (this.pos !== this.text.length) this.fail("trailing non-literal content");
    return result;
  }

  value() {
    this.space();
    const char = this.text[this.pos];
    if (char === "{") return this.object();
    if (char === "[") return this.array();
    if (char === '"' || char === "'") return this.string();
    if (char === "-" || /\d/.test(char || "")) return this.number();
    for (const [word, result] of [["true", true], ["false", false], ["null", null]]) {
      if (this.text.startsWith(word, this.pos)) {
        this.pos += word.length;
        return result;
      }
    }
    this.fail("only arrays, objects, strings, finite numbers, booleans and null are data");
  }

  object() {
    const result = {};
    this.expect("{");
    this.space();
    if (this.text[this.pos] === "}") { this.pos++; return result; }
    while (this.pos < this.text.length) {
      this.space();
      let key;
      if (this.text[this.pos] === '"' || this.text[this.pos] === "'") key = this.string();
      else {
        const match = /^[A-Za-z_$][A-Za-z0-9_$]*/.exec(this.text.slice(this.pos));
        if (!match) this.fail("expected a plain object key");
        key = match[0];
        this.pos += key.length;
        if (this.text[this.pos] === "(") this.fail("methods are not plain object keys");
      }
      this.expect(":");
      const value = this.value();
      if (Object.prototype.hasOwnProperty.call(result, key)) this.fail(`duplicate key ${key}`);
      if (key === "__proto__" || key === "prototype" || key === "constructor") {
        this.fail(`unsafe object key ${key}`);
      }
      result[key] = value;
      this.space();
      if (this.text[this.pos] === "}") { this.pos++; return result; }
      this.expect(",");
      this.space();
      if (this.text[this.pos] === "}") { this.pos++; return result; }
    }
    this.fail("unterminated object");
  }

  array() {
    const result = [];
    this.expect("[");
    this.space();
    if (this.text[this.pos] === "]") { this.pos++; return result; }
    while (this.pos < this.text.length) {
      result.push(this.value());
      this.space();
      if (this.text[this.pos] === "]") { this.pos++; return result; }
      this.expect(",");
      this.space();
      if (this.text[this.pos] === "]") { this.pos++; return result; }
    }
    this.fail("unterminated array");
  }

  string() {
    const quote = this.text[this.pos++];
    let result = "";
    while (this.pos < this.text.length) {
      const char = this.text[this.pos++];
      if (char === quote) return result;
      if (char === "\n" || char === "\r") this.fail("unescaped newline in string");
      if (char !== "\\") { result += char; continue; }
      if (this.pos >= this.text.length) this.fail("unterminated escape");
      const escaped = this.text[this.pos++];
      const simple = { b: "\b", f: "\f", n: "\n", r: "\r", t: "\t", v: "\v", "0": "\0" };
      if (Object.prototype.hasOwnProperty.call(simple, escaped)) {
        if (escaped === "0" && /\d/.test(this.text[this.pos] || "")) this.fail("legacy octal escape");
        result += simple[escaped];
      } else if (escaped === "x") {
        const hex = this.text.slice(this.pos, this.pos + 2);
        if (!/^[0-9A-Fa-f]{2}$/.test(hex)) this.fail("invalid \\x escape");
        result += String.fromCharCode(parseInt(hex, 16));
        this.pos += 2;
      } else if (escaped === "u") {
        if (this.text[this.pos] === "{") {
          const end = this.text.indexOf("}", this.pos + 1);
          if (end < 0) this.fail("unterminated Unicode code-point escape");
          const hex = this.text.slice(this.pos + 1, end);
          if (!/^[0-9A-Fa-f]{1,6}$/.test(hex)) this.fail("invalid Unicode code-point escape");
          const point = parseInt(hex, 16);
          if (point > 0x10ffff) this.fail("Unicode code point out of range");
          result += String.fromCodePoint(point);
          this.pos = end + 1;
        } else {
          const hex = this.text.slice(this.pos, this.pos + 4);
          if (!/^[0-9A-Fa-f]{4}$/.test(hex)) this.fail("invalid \\u escape");
          result += String.fromCharCode(parseInt(hex, 16));
          this.pos += 4;
        }
      } else if (escaped === "\n") {
        // JavaScript line continuation: it contributes no character.
      } else if (escaped === "\r") {
        if (this.text[this.pos] === "\n") this.pos++;
      } else {
        result += escaped;
      }
    }
    this.fail("unterminated string");
  }

  number() {
    const match = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/.exec(this.text.slice(this.pos));
    if (!match) this.fail("invalid number");
    this.pos += match[0].length;
    const result = Number(match[0]);
    if (!Number.isFinite(result)) this.fail("non-finite number");
    return result;
  }
}

export function parseLiteral(text, source = "literal") {
  return new LiteralParser(text, source).parse();
}

function parsePrefix(text, start, source) {
  const parser = new LiteralParser(text, source);
  parser.pos = start;
  return parser.value();
}

export function parseChartPayload(html, source = "chart") {
  const marker = 'catColors:[],default:{title:"Better party by foreign policy issue"';
  const at = html.indexOf(marker);
  assert.notEqual(at, -1, `${source}: chart hydration payload marker is present`);
  assert.equal(html.indexOf(marker, at + 1), -1, `${source}: exactly one chart payload`);
  // marker begins immediately after the configuration object's opening brace.
  assert.equal(html[at - 1], "{", `${source}: expected chart object start`);
  const config = parsePrefix(html, at - 1, source);
  const chart = config.default;
  assert.equal(chart.slug, "better-party-by-foreign-policy-issue");
  // chart.dictionary is the full vocabulary. The sibling config.dictionary is
  // a selection summary whose splits member is just a boolean. Likewise use
  // chart.values, NOT config.values: the latter is a view-normalised copy that
  // erases the verbatim "" response blanks by turning them into numeric zero.
  for (const key of ["years", "categories", "responses", "splits"]) {
    assert.ok(Array.isArray(chart.dictionary[key]), `${source}: default.dictionary.${key}`);
  }
  assert.ok(Array.isArray(chart.values), `${source}: default.values array`);
  assert.equal(chart.values.length, chart.dictionary.splits.length, `${source}: source outer split grid`);
  // Lowy's public payload is split-major: values[split][year][issue][response].
  // Emit the requested year-major grid without changing any cell or label.
  const values = chart.dictionary.years.map((year, yi) => chart.dictionary.splits.map((split, si) => {
    const yearRow = chart.values[si];
    assert.equal(yearRow.length, chart.dictionary.years.length, `${source} / ${split}: one plane per year`);
    return yearRow[yi];
  }));
  return { question: chart.question, dictionary: chart.dictionary, values };
}

export function measureCoverage(dictionary, values) {
  const { years, splits, categories, responses } = dictionary;
  assert.equal(values.length, years.length, "one value plane per year");
  const counts = {
    yearSplitCategoryCells: years.length * splits.length * categories.length,
    populatedCategoryCells: 0,
    emptyCategoryCells: 0,
    nullCategoryCells: 0,
    responseCells: 0,
    numericResponseCells: 0,
    zeroResponseCells: 0,
    emptyResponseCells: 0,
    nullResponseCells: 0,
  };
  values.forEach((splitPlane, yi) => {
    assert.equal(splitPlane.length, splits.length, `${years[yi]}: one row split per dictionary split`);
    splitPlane.forEach((issuePlane, si) => {
      assert.equal(issuePlane.length, categories.length, `${years[yi]} / ${splits[si]}: every issue has a position`);
      issuePlane.forEach((row, ci) => {
        if (row === null) {
          counts.emptyCategoryCells++;
          counts.nullCategoryCells++;
          return;
        }
        assert.ok(Array.isArray(row), `${years[yi]} / ${splits[si]} / ${categories[ci]}: cell is an array or null`);
        if (row.length === 0) { counts.emptyCategoryCells++; return; }
        counts.populatedCategoryCells++;
        counts.responseCells += responses.length;
        assert.equal(row.length, responses.length, `${years[yi]} / ${splits[si]} / ${categories[ci]}: full response grid`);
        for (const value of row) {
          if (typeof value === "number") {
            assert.ok(Number.isFinite(value), "all shares are finite");
            counts.numericResponseCells++;
            if (value === 0) counts.zeroResponseCells++;
          } else if (value === "") counts.emptyResponseCells++;
          else if (value === null) counts.nullResponseCells++;
          else assert.fail(`${years[yi]} / ${splits[si]} / ${categories[ci]}: unsupported response value ${JSON.stringify(value)}`);
        }
      });
    });
  });
  assert.equal(counts.populatedCategoryCells + counts.emptyCategoryCells, counts.yearSplitCategoryCells);
  return counts;
}

function verifyReportFacts(reports) {
  // pdftotext -layout interleaves the two printed columns on some lines, so
  // use short verbatim anchors instead of pretending those lines are prose.
  const byYear = Object.fromEntries(WAVE_FACTS.map((wave) => [wave.year, plain(reports[wave.year] || "")]));
  assert.ok(byYear[2013].includes("nationally representative opinion survey of 1,002 Australian"), "2013 sample in report");
  assert.ok(byYear[2013].includes("adults conducted in Australia between 4 and 20 March 2013"), "2013 fieldwork in report");
  assert.ok(byYear[2013].includes("For this opinion poll, Field Works Market Research conducted a total of 1,002 interviews"), "2013 achieved interviews and fieldwork company");
  assert.ok(byYear[2013].includes("Survey interviews were conducted by fixed and mobile telephone"), "2013 mode");
  assert.ok(byYear[2013].includes(WAVE_FACTS[0].question), "2013 election-specific figure question");
  assert.ok(byYear[2013].includes("Responses of ‘both equally’ or ‘neither’") && byYear[2013].includes("were recorded if volunteered"), "2013 volunteered response caveat");

  assert.ok(byYear[2016].includes("survey, conducted this year between 26 February and"), "2016 fieldwork start in report");
  assert.ok(byYear[2016].includes("15 March 2016 with a sample size of 1202 Australian adults."), "2016 fieldwork end and sample in report");
  assert.ok(byYear[2016].includes("For this year’s annual Poll fieldwork, Field Works") && byYear[2016].includes("Market Research conducted a total of 1202 interviews by fixed and mobile telephone"), "2016 achieved interviews, fieldwork company and mode");
  assert.ok(byYear[2016].includes(WAVE_FACTS[1].question), "2016 election-specific figure question");
  assert.ok(byYear[2016].includes("Responses of ‘don’t know’, ‘no view’, ‘none’ and similar were recorded if given by respondents, but not offered"), "2016 unoffered response caveat");

  assert.ok(byYear[2019].includes("national survey of 2130 Australian adults between"), "2019 sample in report");
  assert.ok(byYear[2019].includes("12 and 25 March 2019"), "2019 fieldwork in report");
  assert.ok(byYear[2019].includes("including online surveys (89% of respondents) and") && byYear[2019].includes("computer-assisted telephone interviewing (11%"), "2019 mode shares");

  assert.ok(byYear[2025].includes("On a simple random sample of 2117 responses"), "2025 sample in report");
  assert.ok(byYear[2025].includes("between 3 and 16 March on behalf of the Lowy"), "2025 fieldwork in report");
  assert.ok(byYear[2025].includes("including online surveys (99% of respondents) and") && byYear[2025].includes("computer-assisted telephone interviewing (1% of") && byYear[2025].includes("respondents) to provide coverage of the offline"), "2025 mode shares");
  return byYear;
}

export function buildStore({ chartHtml, embedHtml, reports }) {
  const chart = parseChartPayload(chartHtml, "official chart cache");
  const embed = parseChartPayload(embedHtml, "official embed cache");
  assert.deepEqual(embed, chart, "the full page and official embed carry identical question, dictionary and values");
  const { years, categories, responses, splits } = chart.dictionary;
  assert.deepEqual(years, [2013, 2016, 2019, 2025], "the chart's complete year coverage");
  assert.deepEqual(WAVE_FACTS.map((wave) => wave.year), years, "report metadata covers every chart year and no other");
  assert.ok(categories.every((label) => typeof label === "string" && label.length > 0));
  assert.ok(responses.every((label) => typeof label === "string" && label.length > 0));
  assert.ok(splits.every((label) => typeof label === "string" && label.length > 0));

  const reportText = verifyReportFacts(reports);
  assert.ok(reportText[2025].includes(chart.question), "2025 general question is verbatim in Figure 39");
  const waves = WAVE_FACTS.map((fact) => ({
    year: fact.year,
    dateStart: fact.start,
    dateEnd: fact.end,
    sample: fact.sample,
    sampleBasis: "Whole-wave achieved sample from the report; no subgroup sample sizes are supplied or inferred.",
    mode: fact.mode,
    question: fact.year === 2025 ? chart.question : fact.question,
    questionSource: fact.questionSource,
    ...(fact.questionNote ? { questionNote: fact.questionNote } : {}),
    report: REPORT_URL(fact.year),
    reportCache: `${CACHE_REF}/lowyinstitutepoll-${fact.year}.pdf`,
  }));
  const coverage = measureCoverage(chart.dictionary, chart.values);
  return {
    _about: "Lowy Institute Poll, Better party by foreign policy issue. Every chart share is generated from the official interactive chart's verbatim Svelte default.values grid, for all four years and every available demographic split, issue and response. The report PDFs verify available stems, fieldwork, overall achieved samples and modes; they do not replace chart values.",
    _provenance: "The official full-page chart and /charts/embed/ form are parsed independently and must agree. Values come only from their Svelte hydration object, never the displayed SVG, a guessed CSV endpoint or an LLM-supplied figure. The split-major source grid is transposed to year-major without altering cells. Where a chart and report table differ, the chart is retained rather than silently reconciled: in 2013 Total / Managing Australia’s relations with Asia / Don’t know\u200a/\u200ano view, the chart value is 8 while the 2013 report's Table 1 prints 9.",
    source: {
      publisher: "Lowy Institute",
      title: "Better party by foreign policy issue",
      slug: "better-party-by-foreign-policy-issue",
      url: CHART_URL,
      embedUrl: EMBED_URL,
      question: chart.question,
      chartCache: `${CACHE_REF}/better-party-by-foreign-policy-issue.html`,
      embedCache: `${CACHE_REF}/better-party-by-foreign-policy-issue-embed.html`,
      reportUrls: Object.fromEntries(years.map((year) => [year, REPORT_URL(year)])),
    },
    semantics: {
      unit: "Percent of respondents in the chart cell; source-rounded shares, retained exactly as supplied.",
      sourceShape: "The cached default.values plane is values[splitIndex][yearIndex][categoryIndex][responseIndex]. Only its two outer axes are transposed on output.",
      shape: "values[yearIndex][splitIndex][categoryIndex][responseIndex], indexed against dictionary.years/splits/categories/responses respectively.",
      emptyCategory: "An empty array [] means no chart row exists for that year × split × issue. It never means zero.",
      blankResponse: "An empty string \"\" is blank in an otherwise populated row, not zero. The response vocabulary is a superset across waves and must not be read as proof that every option was offered in every wave. The Svelte object's separate top-level values copy incorrectly coerces this blank to zero and is deliberately not used.",
      null: "A source null, if present, remains null and denotes unavailable/missing source data, never zero.",
      zero: "Numeric zero is an actual chart value and is not converted to blank or null.",
      splitLabels: "The ordered split labels are verbatim and positional. Duplicate labels (for example SA and ACT in different demographic sections) are retained; no unique ids or deduplicated split names are invented.",
    },
    waves,
    dictionary: chart.dictionary,
    values: chart.values,
    coverage,
  };
}

export function readCachedInputs() {
  return {
    chartHtml: fs.readFileSync(CHART_CACHE, "utf8"),
    embedHtml: fs.readFileSync(EMBED_CACHE, "utf8"),
    reports: Object.fromEntries(WAVE_FACTS.map(({ year }) => [year, fs.readFileSync(REPORT_TXT(year), "utf8")])),
  };
}

async function fetchTo(url, destination) {
  const response = await fetch(url, { redirect: "follow", headers: { "user-agent": "auspol-tracker-lowy-issues/1.0" } });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  fs.writeFileSync(destination, Buffer.from(await response.arrayBuffer()));
}

async function refreshSources() {
  fs.mkdirSync(CACHE, { recursive: true });
  await fetchTo(CHART_URL, CHART_CACHE);
  await fetchTo(EMBED_URL, EMBED_CACHE);
  for (const { year } of WAVE_FACTS) {
    await fetchTo(REPORT_URL(year), REPORT_PDF(year));
    execFileSync("pdftotext", ["-layout", REPORT_PDF(year), REPORT_TXT(year)], { stdio: "inherit" });
  }
}

async function main() {
  const check = process.argv.includes("--check");
  const refresh = process.argv.includes("--refresh");
  const unknown = process.argv.slice(2).filter((arg) => !["--check", "--refresh"].includes(arg));
  if (unknown.length) throw new Error(`Unknown arguments: ${unknown.join(", ")}`);
  if (check && refresh) throw new Error("--check and --refresh are mutually exclusive");
  if (refresh) await refreshSources();
  const store = buildStore(readCachedInputs());
  const serialised = `${JSON.stringify(store, null, 2)}\n`;
  if (check) {
    assert.ok(fs.existsSync(OUT), "data/lowy-issues.json exists; run the extractor without --check");
    assert.equal(fs.readFileSync(OUT, "utf8"), serialised, "data/lowy-issues.json is current for the cached sources");
    console.log("extract-lowy-issues: cached store is current");
  } else {
    fs.writeFileSync(OUT, serialised);
    console.log(`Wrote ${path.relative(ROOT, OUT)} (${serialised.length} bytes)`);
  }
  console.log(JSON.stringify({
    years: store.dictionary.years,
    categories: store.dictionary.categories.length,
    responses: store.dictionary.responses.length,
    splits: store.dictionary.splits.length,
    ...store.coverage,
  }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === HERE) {
  main().catch((error) => {
    console.error(error.stack || error);
    process.exitCode = 1;
  });
}
