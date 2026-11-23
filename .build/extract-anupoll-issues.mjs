#!/usr/bin/env node
// Build aggregate ANUpoll most/second-most-important-problem tables from
// official ANU report PDFs. No respondent-level deposit or credentials are used.
//
// The ADA cumulative codebook and respondent files are access-restricted. This
// extractor therefore does NOT assert cumulative variable names or numeric codes;
// it reads the separately printed question tables and charts, preserving their
// labels, bases and internal discrepancies. Social Class (poll 20) is outside the
// requested Waves 1–19 frame.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(HERE, "..");
export const SRC = join(HERE, "anupoll-issues-src");
export const OUT = join(ROOT, "data", "anupoll-issues.json");
const PAGE = ".build/anupoll-issues-src/";
const FIRST = "What do you think is the most important problem facing Australia today?";
const SECOND = "And what do you think is the second most important problem facing Australia today?";

const R = (wave, title, file, url, fieldwork, adaFieldwork, respondents, responseRate, extra = {}) => ({
  wave, title, file, url, fieldwork, adaFieldwork, respondents, responseRate, ...extra,
});

// Fieldwork is deliberately double-recorded when the public report and ADA's
// cumulative registration disagree. Values here are report facts, not figures.
export const WAVES = [
  R(1, "ANU Poll 2008: Governance", "2008-04-16_ANUpoll_governance_report_0_2.pdf",
    "https://polis.cass.anu.edu.au/files/docs/2025/6/2008-04-16_ANUpoll_governance_report_0_2.pdf",
    ["2008-03-16", "2008-03-30"], ["2008-03-18", "2008-04-02"], 1000, null,
    { kind: "governance2008", doi: "10.4225/87/lvkb1t", reportNumber: 1 }),
  R(2, "ANU Poll 2008: Higher Education", "2008-09-11_ANUpoll_higher_education_report_0_1.pdf",
    "https://polis.cass.anu.edu.au/files/docs/2025/6/2008-09-11_ANUpoll_higher_education_report_0_1.pdf",
    ["2008-06-20", "2008-07-06"], ["2008-06-20", "2008-07-06"], 1200, 34,
    { kind: "higherEducation2008", doi: "10.4225/87/fq3mjc", reportNumber: 2 }),
  R(3, "ANU Poll 2008: Environment", "2008-10-29_ANUpoll_environment_report_0_1.pdf",
    "https://polis.cass.anu.edu.au/files/docs/2025/6/2008-10-29_ANUpoll_environment_report_0_1.pdf",
    ["2008-09-05", "2008-09-21"], ["2008-09-05", "2008-09-21"], 1000, 30,
    { kind: "environment2008", doi: "10.4225/87/fgsf5v", reportNumber: 3 }),
  R(4, "ANU Poll 2009: Defence", "2009-04-29_ANUpoll_defence_report_0_1.pdf",
    "https://polis.cass.anu.edu.au/files/docs/2025/6/2009-04-29_ANUpoll_defence_report_0_1.pdf",
    ["2009-03-17", "2009-04-01"], ["2009-03-17", "2009-04-01"], 1200, 32.5,
    { kind: "ranked", doi: "10.4225/87/oa9rve", reportNumber: 4,
      note: "The report's prose says 53 per cent for Economy/jobs, but its ranked printed table says 52; the table is retained verbatim." }),
  R(5, "ANU Poll 2009: Economics", "2009-08-03_ANUpoll_economy_report_0_1.pdf",
    "https://polis.cass.anu.edu.au/files/docs/2025/6/2009-08-03_ANUpoll_economy_report_0_1.pdf",
    ["2009-06-17", "2009-06-30"], ["2009-06-20", "2009-07-06"], 1200, 32,
    { kind: "ranked", doi: "10.4225/87/iqkbrk", reportNumber: 5 }),
  R(6, "ANU Poll 2009: Rural and Regional Australia", "2009-11-20_ANUpoll_rural_and_regional_report_0_1.pdf",
    "https://polis.cass.anu.edu.au/files/docs/2025/6/2009-11-20_ANUpoll_rural_and_regional_report_0_1.pdf",
    ["2009-08-31", "2009-09-15"], ["2009-08-31", "2009-09-15"], 1200, 40.3,
    { kind: "ranked", doi: "10.4225/87/kfka3e", reportNumber: 6,
      note: "The ranked table and printed Other aggregate sum to 90 per cent, not 100; the source figures are retained without completion." }),
  R(7, "ANU Poll 2010: Australia's Future", "2010-10-26_ANUpoll_population_0_1.pdf",
    "https://polis.cass.anu.edu.au/files/docs/2025/6/2010-10-26_ANUpoll_population_0_1.pdf",
    ["2010-03-15", "2010-04-01"], ["2010-03-16", "2010-04-01"], 1200, 45.2,
    { kind: "tables", doi: "10.4225/87/oqqjce", reportNumber: 7 }),
  R(8, "ANU Poll 2010: Science", "2010-12-07_ANUpoll_science_0_1.pdf",
    "https://polis.cass.anu.edu.au/files/docs/2025/6/2010-12-07_ANUpoll_science_0_1.pdf",
    ["2010-06-15", "2010-07-02"], ["2010-06-15", "2010-07-02"], 1200, 43.2,
    { kind: "tables", doi: "10.4225/87/wuepaj", reportNumber: 8 }),
  R(9, "ANU Poll 2011: The Internet and Social Capital", "2011-04-28_ANUpoll_internet_0_1.pdf",
    "https://polis.cass.anu.edu.au/files/docs/2025/6/2011-04-28_ANUpoll_internet_0_1.pdf",
    ["2010-12-02", "2010-12-16"], ["2010-12-02", "2010-12-16"], 1200, 37.4,
    { kind: "tables", doi: "10.4225/87/ghp82o", reportNumber: 9 }),
  R(10, "ANU Poll 2011: Gambling", "2011-07-28_ANUpoll_gambling_0_1.pdf",
    "https://polis.cass.anu.edu.au/files/docs/2025/6/2011-07-28_ANUpoll_gambling_0_1.pdf",
    ["2011-04-27", "2011-05-10"], ["2011-04-27", "2011-05-10"], 1213, 32.8,
    { kind: "tables", doi: "10.4225/87/3ii2on", reportNumber: 10 }),
  R(11, "ANU Poll 2011: Food Security", null, null,
    ["2011-07-12", "2011-07-25"], ["2011-07-12", "2011-07-25"], null, null,
    { kind: "foodSecurityGap", doi: "10.26193/iheypj", reportNumber: 11 }),
  R(12, "ANU Poll 2011: Government Services", "ANUpoll_Report_11_Oct_2011_Attitude_to_government_services_0_0_1.pdf",
    "https://polis.cass.anu.edu.au/files/docs/2025/6/ANUpoll_Report_11_Oct_2011_Attitude_to_government_services_0_0_1.pdf",
    ["2011-09-05", "2011-09-18"], ["2011-09-05", "2011-09-18"], 2001, 33.1,
    { kind: "tables", doi: "10.26193/5eo0o1", reportNumber: 11,
      note: "ADA identifies this as poll 12; the cover prints Report No. 11. Poll 11 is Food Security." }),
  R(13, "ANU Poll 2012: Corruption", "2012-10-26_ANUpoll_ethics_corruption.pdf_0_1.pdf",
    "https://polis.cass.anu.edu.au/files/docs/2025/6/2012-10-26_ANUpoll_ethics_corruption.pdf_0_1.pdf",
    ["2012-08-13", "2012-09-09"], ["2012-08-20", "2012-09-09"], 2020, 43,
    { kind: "tables", doi: "10.26193/wtcp31", reportNumber: 13 }),
  R(14, "ANU Poll 2013: Electoral Reform", "ANUpoll-report-August-2014-attitudes-electoral-reform_0_0.pdf",
    "https://polis.cass.anu.edu.au/files/docs/2025/6/ANUpoll-report-August-2014-attitudes-electoral-reform_0_0.pdf",
    ["2013-07-09", "2013-07-23"], ["2013-07-09", "2013-07-23"], 1200, 48.3,
    { kind: "tables", doi: "10.26193/faoy9j", reportNumber: 14, tableOrder: ["second", "first"] }),
  R(15, "ANU Poll 2013: Priorities for Public Expenditure", "ANU_AttitudesPollExpenditureReport_0_0.pdf",
    "https://polis.cass.anu.edu.au/files/docs/2025/6/ANU_AttitudesPollExpenditureReport_0_0.pdf",
    ["2013-11-25", "2013-12-16"], ["2013-12-02", "2013-12-15"], 1142, 49,
    { kind: "tables", doi: "10.26193/fv1pyr", reportNumber: 15 }),
  R(16, "ANU Poll 16 - Foreign Policy, 2014", "ANUpoll_Foreign_policy_0_0.pdf",
    "https://polis.cass.anu.edu.au/files/docs/2025/6/ANUpoll_Foreign_policy_0_0.pdf",
    ["2014-05-12", "2014-05-25"], ["2014-05-12", "2014-05-25"], 1204, 56,
    { kind: "tables", doi: "10.4225/87/oe09om", reportNumber: 16 }),
  R(17, "ANU Poll 2014: Changing Views of Governance", "ANU_SRC_Poll_Governance_1_0.pdf",
    "https://polis.cass.anu.edu.au/files/docs/2025/6/ANU_SRC_Poll_Governance_1_0.pdf",
    ["2014-06-23", "2014-07-09"], ["2014-06-23", "2014-07-09"], 1388, 63,
    { kind: "tables", doi: "10.26193/zgwu0k", reportNumber: 17 }),
  R(18, "ANU Poll 2014: Indigenous Affairs", "Indigenous-Issues-ANU-Poll-2015_1.pdf",
    "https://polis.cass.anu.edu.au/files/docs/2025/6/Indigenous-Issues-ANU-Poll-2015_1.pdf",
    ["2014-09-22", "2014-10-05"], ["2014-09-22", "2014-10-05"], 1201, 25.4,
    { kind: "tables", doi: "10.26193/cgscua", reportNumber: 17,
      note: "ADA identifies this as poll 18; the report cover prints Report No. 17, duplicating governance's printed number." }),
  R(19, "ANU Poll 2015: National Identity", "ANUpoll-national-identity-042015_0.pdf",
    "https://polis.cass.anu.edu.au/files/docs/2025/6/ANUpoll-national-identity-042015_0.pdf",
    ["2015-03-02", "2015-03-15"], ["2015-03-02", "2015-03-15"], 1200, 23.4,
    { kind: "tables", doi: "10.26193/ccb9ts", reportNumber: 18, tableIndexes: [0, 1],
      secondPrompt: "What do you think is the second most important problem facing Australia today?" }),
];

function sha(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex").toUpperCase();
}
function cacheRecord(file) {
  const path = join(SRC, file);
  if (!existsSync(path)) throw new Error(`Missing cached official source: ${file}`);
  return { cache: PAGE + file, sha256: sha(path) };
}
function numeric(s) {
  return Number(String(s).replaceAll(",", "").replaceAll("%", ""));
}
function cleanLabel(s) {
  return s.replace(/\s+/g, " ").trim();
}
function isPageFurniture(line) {
  const s = cleanLabel(line);
  if (!s) return true;
  if (/^\d+$/.test(s)) return true;
  if (/^(?:ANUpoll|A N U P O L L|A N U p o l l|Questions?:)/i.test(s)) return true;
  if (/ANUpoll (?:Report|September|March|October|December|July|January|April)/i.test(s)) return true;
  if (/^(?:Public opinion|Attitudes|Australian public|Foreign policy|Social class|Changing views of governance)/i.test(s) && s.length < 110) return true;
  if (/^(?:ANUPOLL QUESTIONS|A N U P O L L Q U E S T I O N S)/i.test(s.replace(/\s/g, ""))) return true;
  return false;
}

// Parse one printed Number/Frequency table. Count and percentage columns stay
// independent: ANU reports weighted percentages beside unweighted frequencies.
function parseOneTable(lines, headerAt) {
  const rows = [];
  const totals = [];
  let pending = [];
  let ended = false;
  let i = headerAt + 1;
  for (; i < lines.length; i++) {
    const raw = lines[i].replace(/\f/g, "");
    const line = cleanLabel(raw);
    if (!line) continue;
    if (!ended && /^(?:Number|Frequency)\s+Per cent/i.test(line)) continue;
    if (/^Cumulative per cent$/i.test(line)) continue;
    if (!ended && (line === "Total" || line.startsWith("Total "))) {
      const m = line.match(/^Total\s+([\d,]+)(?:\s+(\.?\d+(?:\.\d+)?%?))?/);
      if (!m) throw new Error(`Bad Total row: ${line}`);
      totals.push({ label: "Total", count: numeric(m[1]), percent: m[2] == null ? null : numeric(m[2]) });
      ended = true;
      continue;
    }
    if (!ended) {
      // Some reports print Missing/Skipped before Total, others after it.
      const missing = line.match(/^\(?(Missing|Skipped)\)?\s+([\d,]+)(?:\s+(\S+))?$/i);
      if (missing && (!missing[3] || missing[3] === "-" || /^\.?\d+(?:\.\d+)?%?$/.test(missing[3]))) {
        totals.push({ label: missing[1], count: numeric(missing[2]), percent: !missing[3] || missing[3] === "-" ? null : numeric(missing[3]) });
        pending = [];
        continue;
      }
    }
    if (ended) {
      let m = line.match(/^\(?(Missing|Skipped)\)?\s+([\d,]+)(?:\s+(\.?\d+(?:\.\d+)?%?))?/i);
      if (m) {
        totals.push({ label: m[1], count: numeric(m[2]), percent: m[3] == null ? null : numeric(m[3]) });
        continue;
      }
      if (line.startsWith("Total ")) {
        const m2 = line.match(/^Total\s+([\d,]+)(?:\s+(\.?\d+(?:\.\d+)?%?))?/);
        if (m2) {
          totals.push({ label: "Total (overall)", count: numeric(m2[1]), percent: m2[2] == null ? null : numeric(m2[2]) });
          continue;
        }
      }
      break;
    }
    if (!ended && /^(?:Number|Frequency)\s+Per cent/i.test(line)) break;
    if (isPageFurniture(line)) continue;
    const match = line.match(/^(.*?)\s+([\d,]+(?:\.\d+)?)\s+(\.?\d+(?:\.\d+)?%?)(?:\s+(\.?\d+(?:\.\d+)?%?))?$/);
    if (match && match[1].trim()) {
      const label = cleanLabel([...pending, match[1]].join(" "));
      pending = [];
      rows.push({ label, count: numeric(match[2]), percent: numeric(match[3]) });
    } else if (/^[\d,]+(?:\.\d+)?\s+\.?\d+(?:\.\d+)?%?(?:\s+\.?\d+(?:\.\d+)?%?)?$/.test(line) && pending.length) {
      const match2 = line.match(/^([\d,]+(?:\.\d+)?)\s+(\.?\d+(?:\.\d+)?%?)(?:\s+(\.?\d+(?:\.\d+)?%?))?$/);
      if (!match2) throw new Error(`Bad wrapped numeric row: ${line}`);
      rows.push({ label: cleanLabel(pending.join(" ")), count: numeric(match2[1]), percent: numeric(match2[2]) });
      pending = [];
    } else if (!pending.length && /^.*?[A-Za-z].*?\s+\d+\.\d+$/.test(line)) {
      // The Indigenous Affairs report prints "Afghan war 0.0" in Per cent
      // with a blank Frequency cell. Keep that cell missing rather than as 0.
      const pctOnly = line.match(/^(.*?)\s+(\d+\.\d+)$/);
      rows.push({ label: cleanLabel(pctOnly[1]), count: null, percent: numeric(pctOnly[2]) });
    } else {
      // Arbitrary prose between rows is unsafe, not a label continuation.
      if (pending.join(" ").length > 180) throw new Error(`Overlong response label near: ${line}`);
      pending.push(line);
    }
  }
  if (!totals.length || rows.length < 10) return null;
  return { rows, totals, start: headerAt, end: i };
}

function pctSums(rows) {
  return Math.round(rows.reduce((a, r) => a + (r.percent ?? 0), 0) * 1000) / 1000;
}
function countSum(rows) {
  return rows.every(r => Number.isFinite(r.count)) ? rows.reduce((a, r) => a + r.count, 0) : null;
}
function printChecks(rows) {
  const count = countSum(rows);
  const percent = pctSums(rows);
  return {
    responseCountSum: count,
    responseCountSumAvailable: rows.reduce((a, r) => a + (Number.isFinite(r.count) ? r.count : 0), 0),
    responseCountCellsMissing: rows.filter(r => !Number.isFinite(r.count)).length,
    responsePercentSum: percent,
    percentWithinOnePointOf100: Math.abs(percent - 100) <= 1,
  };
}
function questionFromTable(table, prompt, sampleN) {
  const firstTotal = table.totals.find(t => t.label === "Total");
  const skipped = table.totals.find(t => /Missing|Skipped/i.test(t.label));
  const overall = table.totals.find(t => t.label === "Total (overall)");
  return {
    prompt,
    coverage: "complete-printed-response-table",
    responses: table.rows,
    base: {
      sampleN: sampleN ?? null,
      validN: firstTotal?.count ?? null,
      validPercent: firstTotal?.percent ?? null,
      skippedN: skipped?.count ?? null,
      skippedPercent: skipped?.percent ?? null,
      printedOverallN: overall?.count ?? null,
    },
    printedFooter: table.totals,
    checks: { ...printChecks(table.rows), countSumEqualsValidN: countSum(table.rows) === (firstTotal?.count ?? null) },
  };
}

function parseFullTables(spec) {
  const file = spec.file.replace(/\.pdf$/, ".raw.txt");
  const lines = readFileSync(join(SRC, file), "utf8").replace(/\r/g, "").replace(/\f/g, "\n").split("\n");
  const candidates = [];
  const seen = new Set();
  for (let i = 0; i < lines.length; i++) {
    if (/^(?:Q\s+)?(?:Number|Frequency)\s+Per cent/i.test(cleanLabel(lines[i]))) {
      const table = parseOneTable(lines, i);
      if (!table || !table.rows.some(r => /^Economy\s*\/?\s*(?:jobs)?\b/i.test(r.label))) continue;
      const signature = JSON.stringify([table.rows, table.totals]);
      // Repeated Frequency/Number headers expose the identical table twice.
      if (!seen.has(signature)) {
        seen.add(signature);
        candidates.push(table);
      }
    }
  }
  if (candidates.length < 2) throw new Error(`Wave ${spec.wave}: only ${candidates.length} MIP tables found`);
  if (candidates.length > 2 && !spec.tableIndexes) throw new Error(`Wave ${spec.wave}: ambiguous ${candidates.length} MIP tables found`);
  const selected = spec.tableIndexes ? spec.tableIndexes.map(i => {
    if (!candidates[i]) throw new Error(`Wave ${spec.wave}: missing declared table index ${i}`);
    return candidates[i];
  }) : candidates;
  if (selected.length !== 2) throw new Error(`Wave ${spec.wave}: table selection must identify exactly two tables`);
  const order = spec.tableOrder || ["first", "second"];
  return Object.fromEntries(order.map((choice, i) => [choice,
    questionFromTable(selected[i], choice === "first" ? FIRST : (spec.secondPrompt || SECOND), spec.respondents)]));
}

function partialQuestion(prompt, rows, sampleN, sourceLabel, responseRate = null) {
  return {
    prompt,
    coverage: "selected-printed-responses-not-a-complete-codebook",
    responses: rows,
    base: { sampleN: sampleN ?? null, validN: null, validPercent: null, skippedN: null, skippedPercent: null, printedOverallN: null },
    printedFooter: [],
    sourceLabel,
    checks: printChecks(rows),
  };
}
function unavailableQuestion(choice, sourceLabel = null) {
  return {
    prompt: null,
    coverage: "unavailable-public-source-gap",
    responses: [],
    base: { sampleN: null, validN: null, validPercent: null, skippedN: null, skippedPercent: null, printedOverallN: null },
    printedFooter: [],
    sourceLabel: sourceLabel || `Poll 11 Food Security ${choice}-choice table is not present in a public ANU report`,
    checks: { responseCountSum: null, responseCountSumAvailable: 0, responseCountCellsMissing: 0, responsePercentSum: 0, percentWithinOnePointOf100: false },
  };
}

function bboxWords(file) {
  const text = readFileSync(join(SRC, file), "utf8");
  return [...text.matchAll(/<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]+)<\/word>/g)]
    .map(m => ({ x: +m[1], y: +m[2], text: m[5] }));
}
function chartRows(file, defs) {
  const words = bboxWords(file);
  return defs.map(({ label, labelY, offset }) => {
    const hits = words.filter(w => /^\d+(?:\.\d+)?$/.test(w.text) && w.x > 250 && w.x < 500 && Math.abs(w.y - (labelY + offset)) < 2);
    if (hits.length !== 1) throw new Error(`${file}: ${label}: expected one chart value, got ${hits.length}`);
    return { label, count: null, percent: +hits[0].text };
  });
}

const EARLY_HIGHER = "2008-higher-education-page19-bbox.html";
const EARLY_ENV = "2008-environment-page20-bbox.html";
const earlyHigherDefs = [
  ["Environment", 426.416811], ["Economy", 457.863111], ["Housing affordability", 489.309411],
  ["Interest rates", 520.755711], ["Health care", 552.202011], ["Education", 583.648311],
].map(([label, labelY]) => ({ label, labelY, offset: -5 }));
const earlyEnvironmentDefs = [
  ["Economy", 494.529970], ["Environment", 528.892870], ["Water management", 563.255770],
  ["Housing affordability", 597.618670], ["Interest rates", 631.981570], ["Health care", 666.344470], ["Education", 700.707370],
].map(([label, labelY]) => ({ label, labelY, offset: -18 }));

function parseRanked(spec) {
  const text = readFileSync(join(SRC, spec.file.replace(/\.pdf$/, ".raw.txt")), "utf8").replace(/\f/g, "\n");
  const rankedAt = text.search(/Rank Issue Per\s*cent/i);
  if (rankedAt < 0) throw new Error(`Wave ${spec.wave}: ranked table missing`);
  const block = text.slice(rankedAt, rankedAt + 2500);
  const rows = [];
  let other = null;
  for (const rawLine of block.split("\n")) {
    const line = rawLine.trim();
    const m = line.match(/^([1-5])\s+(.+?)\s+(\d+(?:\.\d+)?)%?\s*(?:\([^\n]*\))?$/);
    if (m) rows.push({ label: m[2], count: null, percent: +m[3], printedRank: +m[1] });
    const o = line.match(/^Other\s+(\d+(?:\.\d+)?)%?(?:\s*\(.*\))?$/);
    if (o) other = o;
  }
  if (other) rows.push({ label: "Other (printed aggregate)", count: null, percent: +other[1] });
  if (rows.length !== 6) throw new Error(`Wave ${spec.wave}: expected ranked five + Other, got ${rows.length}`);
  return {
    first: partialQuestion(FIRST, rows, spec.respondents, "Ranked issue table in the official ANU report"),
    second: unavailableQuestion("second", "No separate second-choice table is printed in this wave's public ANU report"),
  };
}

function buildEarly(spec) {
  if (spec.kind === "ranked") return parseRanked(spec);
  if (spec.kind === "governance2008") {
    // Seven March-2008 values are reprinted by poll 3's three-series chart in
    // reading-position offset zero. Poll 1's prose independently corroborates 19/18.
    const firstRows = chartRows(EARLY_ENV, earlyEnvironmentDefs.map(d => ({ ...d, offset: 0 })));
    const prose = readFileSync(join(SRC, spec.file.replace(/\.pdf$/, ".raw.txt")), "utf8");
    if (!/19 percent of the survey\s+respondents mentioned the environment/.test(prose)) throw new Error("Poll 1 first environment proof changed");
    if (!/economy was viewed as the main issue by 18 percent/.test(prose)) throw new Error("Poll 1 first economy proof changed");
    const secondRows = [
      { label: "Environment (including global warming and sustainability)", count: null, percent: 13 },
      { label: "Economy/jobs", count: null, percent: 17 },
    ];
    if (!/further 13 percent mentioned the environment as the second/.test(prose) || !/second most important issue by a further 17 percent/.test(prose)) {
      throw new Error("Poll 1 second-choice prose proof changed");
    }
    return {
      first: partialQuestion(FIRST, firstRows, spec.respondents,
        "Poll 3 official retrospective chart, Mar-08 series; poll 1 prose corroborates Environment 19 and Economy/jobs 18"),
      second: partialQuestion(SECOND, secondRows, spec.respondents, "Poll 1 printed prose only; other second-choice categories not published"),
    };
  }
  if (spec.kind === "higherEducation2008") return {
    first: partialQuestion(FIRST, chartRows(EARLY_HIGHER, earlyHigherDefs), spec.respondents,
      "Jul-08 values read by chart coordinates in the official poll 2 PDF"),
    second: unavailableQuestion("second", "No separate second-choice table is printed in this wave's public ANU report"),
  };
  if (spec.kind === "environment2008") return {
    first: partialQuestion(FIRST, chartRows(EARLY_ENV, earlyEnvironmentDefs), spec.respondents,
      "Sep-08 values read by chart coordinates in the official poll 3 PDF"),
    second: unavailableQuestion("second", "No separate second-choice table is printed in this wave's public ANU report"),
  };
  throw new Error(`Unknown early kind ${spec.kind}`);
}

export function buildStore() {
  const ada = cacheRecord("ada-cumulative-2S8I0I.json");
  const metadata = JSON.parse(readFileSync(join(SRC, "datacite-wave-metadata.json"), "utf8"));
  const waves = WAVES.map(spec => {
    const questions = spec.kind === "tables" ? parseFullTables(spec)
      : spec.kind === "foodSecurityGap" ? { first: unavailableQuestion("first"), second: unavailableQuestion("second") }
      : buildEarly(spec);
    const report = spec.file ? {
      url: spec.url,
      reportNumberPrinted: spec.reportNumber,
      ...cacheRecord(spec.file),
    } : null;
    return {
      wave: spec.wave,
      title: metadata.find(m => m.wave === spec.wave)?.title || spec.title,
      doi: spec.doi,
      fieldwork: {
        reportStart: spec.fieldwork[0], reportEnd: spec.fieldwork[1],
        adaCumulativeStart: spec.adaFieldwork[0], adaCumulativeEnd: spec.adaFieldwork[1],
        reportDiffersFromAda: spec.fieldwork[0] !== spec.adaFieldwork[0] || spec.fieldwork[1] !== spec.adaFieldwork[1],
      },
      respondentsReport: spec.respondents,
      responseRatePercentReport: spec.responseRate,
      populationFrame: "National random sample of adults (18 years and over), telephone interview, as printed in ANU reports",
      report,
      note: spec.note || null,
      questions,
    };
  });
  return {
    _about: "ANUpoll 2008–2015 national most important problem and second most important problem, preserved as separate printed aggregate response tables. Poll 20 (Social Class) is excluded.",
    schemaVersion: 1,
    source: {
      cumulativeDataset: {
        title: "ANU Polls Waves 1-19 Cumulative Time-Series, 2008-2015",
        doi: "10.26193/2S8I0I",
        url: "https://doi.org/10.26193/2S8I0I",
        ...ada,
        variableNamesAndNumericCodes: null,
        codebookAccess: "ADA metadata marks every deposited XLSX/SAS/SAV/TSV file restricted; API datafile downloads 4601 and 4602 returned HTTP 403 Not authorized. No variable names or response codes are inferred from DataCite metadata.",
      },
      depositedFiles: JSON.parse(readFileSync(join(SRC, "ada-cumulative-2S8I0I.json"), "utf8")).data.latestVersion.files.map(f => ({
        id: f.dataFile.id, filename: f.dataFile.filename, bytes: f.dataFile.filesize,
        md5: f.dataFile.md5.toUpperCase(), restricted: f.restricted,
      })),
      officialWaveMetadata: cacheRecord("datacite-wave-metadata.json"),
      derivation: "Poll 1–19 aggregate figures are read only from official ANU report PDF tables/coordinate-labelled charts or separately printed prose. Count and percent are verbatim. Weighted percentages are never recomputed from frequencies. No respondent TSV was downloaded or committed.",
      mentionCombination: "Not computed or included. First and second choices are separate; no combined first+second mention counts are derived.",
      poll11FoodSecurityGap: {
        doi: "10.26193/iheypj", fieldwork: ["2011-07-12", "2011-07-25"],
        publicTechnicalReport: { id: 4622, filename: "1. ANU POLL (FOOD SECURITY) JULY 2011 TECHNICAL REPORT.pdf", bytes: 234476,
          md5: "9F607CB6B4DCB7DCBD774B3074A508AE", restricted: false },
        accessResult: "ADA API returned HTTP 400: You may not download this file without the required Guestbook response for guestbookID 2. No identity details or credentials were invented. Its respondent files are restricted and no public ANU problem-table report was found.",
      },
      poll20Exclusion: {
        doi: "10.4225/87/p5zkme", title: "ANU Poll 2015: Social Class",
        reason: "Official DataCite abstract says twentieth in the series; the requested cumulative deposit is Waves 1–19 ending with National Identity.",
      },
      reportExtraction: "pdftotext -raw for tables; pdftotext -bbox for the two early chart series. Coordinates identify the value, never the figure itself.",
    },
    waves,
  };
}

export function validateStore(store) {
  const errors = [];
  if (store.waves.length !== 19) errors.push(`Expected 19 waves, got ${store.waves.length}`);
  store.waves.forEach((w, i) => {
    if (w.wave !== i + 1) errors.push(`Wave sequence ${w.wave} at ${i}`);
    for (const side of ["first", "second"]) {
      const q = w.questions[side];
      if (!q) errors.push(`Wave ${w.wave} missing ${side}`);
      for (const row of q?.responses || []) {
        if (!row.label || !Number.isFinite(row.percent)) errors.push(`Wave ${w.wave} ${side}: bad response`);
        if ("mentionCount" in row || "mentions" in row) errors.push(`Wave ${w.wave} ${side}: forbidden mention count`);
      }
      if (q?.coverage === "complete-printed-response-table" && !Number.isFinite(q.base.validN)) {
        errors.push(`Wave ${w.wave} ${side}: full table lacks printed valid base`);
      }
    }
  });
  if (store.waves[10].questions.first.responses.length || store.waves[10].questions.second.responses.length) {
    errors.push("Poll 11 source gap must not contain invented figures");
  }
  if (store.waves.some(w => /Social Class/.test(w.title))) errors.push("Poll 20 Social Class crossed the Waves 1–19 boundary");
  return errors;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const check = process.argv.includes("--check");
  const store = buildStore();
  const errors = validateStore(store);
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exit(1);
  }
  const next = JSON.stringify(store, null, 2) + "\n";
  const previous = existsSync(OUT) ? readFileSync(OUT, "utf8") : "";
  if (check) {
    if (previous !== next) {
      console.error(`Out of date: ${OUT}; run node .build/extract-anupoll-issues.mjs`);
      process.exit(1);
    }
    console.log(`Current: ${store.waves.length} waves (${store.waves.filter(w => w.questions.first.responses.length).length} with first-choice aggregates)`);
  } else {
    if (previous !== next) writeFileSync(OUT, next);
    console.log(`${previous === next ? "Unchanged" : "Wrote"} ${OUT}: ${store.waves.length} waves; poll 11 remains an explicit source gap`);
  }
}
