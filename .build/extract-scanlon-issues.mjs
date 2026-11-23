#!/usr/bin/env node
/* Source-preserving Scanlon Mapping Social Cohesion most-important-problem archive.

   This reader only consumes cached text extracted from official public reports.
   It deliberately does not normalise Scanlon's coded responses onto the site's
   poll-issue keys, combine opposed responses, or manufacture missing cells.
   Respondent-level ADA files are neither downloaded nor used. */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const SRC = process.env.SCANLON_ISSUES_SRC || path.join(HERE, "scanlon-issues-src");
const OUT = process.env.SCANLON_ISSUES_OUT || path.join(ROOT, "data", "scanlon-issues.json");
const CHECK = process.argv.includes("--check");
const sha256 = (text) => crypto.createHash("sha256").update(text).digest("hex");
const clean = (s) => String(s).replace(/[‐‑‒]/g, "–").replace(/\s+/g, " ").trim();
const num = (s) => Number(String(s).replace(/,/g, ""));
const NUMBER = /(?<![A-Za-z0-9_\-–])\d[\d,]*(?:\.\d+)?(?![A-Za-z])/g;
const QUESTION_PLURAL = "What do you think are the most important problems facing Australia today?";
const QUESTION_SINGULAR = "What do you think is the most important problem facing Australia today?";

function category(id, sourceLabel, extra = {}) {
  return { id, sourceLabel, role: "coded-category", ...extra };
}
function subtotal(id, sourceLabel, componentIds) {
  return { id, sourceLabel, role: "printed-subtotal", componentIds };
}
const C = {
  economy: category("economy-unemployment-poverty", "Economy/ unemployment/ poverty"),
  environmentConcern: category("environment-climate-change-water-shortages-concern", "Environment – climate change/ water shortages (concern)", { polarity: "concern" }),
  environmentSubtotal: subtotal("environment-printed-subtotal", "Environment (printed subtotal)", ["environment-climate-change-water-shortages-concern", "environment-overreaction-climate-change-carbon-tax-sceptical"]),
  environmentSceptical: category("environment-overreaction-climate-change-carbon-tax-sceptical", "Environment – overreaction to climate change/ carbon tax (sceptical)", { polarity: "sceptical" }),
  government: category("quality-of-government-politicians", "Quality of government/ politicians"),
  immigrationConcern: category("immigration-population-growth-concern", "Immigration/ population growth (concern)", { polarity: "concern" }),
  immigrationSubtotal: subtotal("immigration-population-printed-subtotal", "Immigration/ population (printed subtotal)", ["immigration-population-growth-concern", "immigration-population-too-low-need-more-people-supportive"]),
  immigrationSupportive: category("immigration-population-too-low-need-more-people-supportive", "Immigration/population – too low/ need more people (supportive)", { polarity: "supportive" }),
  asylumNegative: category("asylum-seekers-negative-comment", "Asylum seekers – too many/ refugees/ boat people/ illegal immigrants (negative comment)", { polarity: "negative-comment" }),
  asylumSubtotal: subtotal("asylum-seekers-printed-subtotal", "Asylum seekers (printed subtotal)", ["asylum-seekers-negative-comment", "asylum-seekers-poor-treatment-sympathy-refugees"]),
  asylumSympathy: category("asylum-seekers-poor-treatment-sympathy-refugees", "Asylum seekers – poor treatment, sympathy towards refugees/ boat people/ illegal immigrants", { polarity: "sympathetic" }),
  social: category("social-issues-family-childcare-drugs-direction", "Social issues – family breakdown, child care, drug use, lack of personal direction"),
  health: category("health-medical-hospitals", "Health/ medical/ hospitals"),
  housing: category("housing-shortage-affordability-interest-rates", "Housing shortage/ affordability/ interest rates"),
  crime: category("crime-law-and-order", "Crime/ law and order"),
  racism: category("racism", "Racism"),
  education: category("education-schools", "Education/ schools"),
  indigenous: category("indigenous-issues", "Indigenous issues"),
  industrialRelations: category("industrial-relations-trade-unions", "Industrial relations/ trade unions"),
  defence: category("defence-national-security-terrorism", "Defence/ national security/ terrorism"),
  women: category("womens-issues-equal-pay-opportunity-violence", "Women's issues (e.g. equal pay/opportunity, violence, etc.)"),
  other: category("other-nothing-dont-know", "Other/ nothing/ don’t know"),
  otherDecline: category("other-nothing-dont-know-decline", "Other/ nothing/ don’t know/ decline"),
  covid: category("covid-19-including-impact-on-economy", "COVID-19, including impact on the economy"),
};

const EARLY = [
  "economy", "environmentConcern", "environmentSubtotal", "environmentSceptical", "government",
  "immigrationConcern", "immigrationSubtotal", "immigrationSupportive", "asylumNegative", "asylumSubtotal",
  "asylumSympathy", "social", "health", "housing", "crime", "racism", "education", "indigenous",
  "industrialRelations", "defence", "other",
];
const Y2013 = [
  "economy", "government", "asylumNegative", "asylumSubtotal", "asylumSympathy", "social",
  "environmentConcern", "environmentSubtotal", "environmentSceptical", "immigrationConcern",
  "immigrationSubtotal", "immigrationSupportive", "health", "education", "crime", "housing",
  "racism", "defence", "industrialRelations", "indigenous", "other",
];
const Y2014 = [
  "economy", "government", "social", "environmentConcern", "environmentSubtotal", "environmentSceptical",
  "health", "asylumNegative", "asylumSubtotal", "asylumSympathy", "immigrationConcern",
  "immigrationSubtotal", "immigrationSupportive", "education", "housing", "crime", "racism",
  "defence", "indigenous", "industrialRelations", "other",
];
const Y2015 = [
  "economy", "social", "defence", "government", "environmentConcern", "environmentSubtotal",
  "environmentSceptical", "asylumNegative", "asylumSubtotal", "asylumSympathy", "housing",
  "immigrationConcern", "immigrationSubtotal", "immigrationSupportive", "education", "health",
  "crime", "racism", "indigenous", "industrialRelations", "other",
];
const Y2016 = [
  "economy", "government", "defence", "immigrationConcern", "immigrationSubtotal", "immigrationSupportive",
  "social", "environmentConcern", "environmentSubtotal", "environmentSceptical", "health", "asylumNegative",
  "asylumSubtotal", "asylumSympathy", "racism", "education", "crime", "housing", "indigenous",
  "women", "industrialRelations", "other",
];
const Y2017 = [
  "economy", "government", "immigrationConcern", "immigrationSubtotal", "immigrationSupportive", "social",
  "defence", "environmentConcern", "environmentSubtotal", "environmentSceptical", "housing", "crime",
  "education", "health", "asylumNegative", "asylumSubtotal", "asylumSympathy", "racism", "indigenous",
  "industrialRelations", "women", "other",
];
const Y2018 = [
  "economy", "environmentConcern", "environmentSubtotal", "environmentSceptical", "government", "social",
  "immigrationConcern", "immigrationSubtotal", "immigrationSupportive", "housing", "health", "crime",
  "asylumNegative", "asylumSubtotal", "asylumSympathy", "education", "racism", "defence", "indigenous",
  "industrialRelations", "women", "other",
];
const Y2019 = [
  "economy", "environmentConcern", "social", "immigrationConcern", "government", "health", "housing",
  "crime", "education", "defence", "asylumNegative", "asylumSympathy", "immigrationSupportive", "racism",
  "environmentSceptical", "women", "indigenous", "industrialRelations", "otherDecline",
];
const Y2020 = ["covid", ...Y2019];
const RDS = "Random Digit Dialling (RDD) telephone survey";
const LINA = "Life in Australia panel, online and telephone";

const TABLE_WAVES = [
  { id: "2011", reportYear: 2011, reportId: "scanlon-2011", anchor: "Table 6", bodyFrom: "Economy/ unemployment/ poverty", question: QUESTION_PLURAL, mentionRule: "Respondents could nominate up to two issues; the table reports the issue mentioned first.", mode: RDS, categories: EARLY, pick: 1, basePick: null, fieldwork: { start: "2011-06-15", end: "2011-07-18" } },
  { id: "2012", reportYear: 2012, reportId: "scanlon-2012", anchor: "Table 11", bodyFrom: "Economy/ unemployment/ poverty", question: QUESTION_SINGULAR, mentionRule: "Respondents could nominate one issue.", mode: RDS, categories: EARLY, pick: 1, basePick: 1, fieldwork: {} },
  { id: "2013", reportYear: 2013, reportId: "scanlon-2013", anchor: "Table 8", bodyFrom: "Economy/ unemployment/ poverty", question: QUESTION_SINGULAR, mentionRule: "Respondents could nominate one issue.", mode: RDS, categories: Y2013, pick: 1, basePick: 1, fieldwork: {} },
  { id: "2014", reportYear: 2014, reportId: "scanlon-2014", anchor: "Table 9", bodyFrom: "Economy/ unemployment/", question: QUESTION_SINGULAR, mentionRule: "Respondents could nominate one issue.", mode: RDS, categories: Y2014, pick: 1, basePick: 1, fieldwork: {} },
  { id: "2015", reportYear: 2015, reportId: "scanlon-2015", anchor: "Table 10", bodyFrom: "Economy/ unemployment/ poverty", question: QUESTION_SINGULAR, mentionRule: "Respondents could nominate one issue.", mode: RDS, categories: Y2015, pick: 1, basePick: 1, fieldwork: {} },
  { id: "2016", reportYear: 2016, reportId: "scanlon-2016", anchor: "Table 9", bodyFrom: "Economy/ unemployment/ poverty", question: QUESTION_SINGULAR, mentionRule: "Respondents could nominate one issue.", mode: RDS, categories: Y2016, pick: 1, basePick: 1, fieldwork: {} },
  { id: "2017", reportYear: 2017, reportId: "scanlon-2017", anchor: "Table 16", bodyFrom: "Economy/ unemployment/ poverty", question: QUESTION_SINGULAR, mentionRule: "Respondents could nominate one issue.", mode: RDS, categories: Y2017, pick: 1, basePick: 1, fieldwork: {} },
  { id: "2018-rdd", reportYear: 2018, reportId: "scanlon-2018", anchor: "Table 12", bodyFrom: "Economy/ unemployment/ poverty", question: QUESTION_SINGULAR, mentionRule: "Open-ended first problem; separate parallel-mode estimate.", mode: RDS, modeColumn: "RDD", categories: Y2018, pick: 2, basePick: 2, fieldwork: {} },
  { id: "2018-lina", reportYear: 2018, reportId: "scanlon-2018", anchor: "Table 12", bodyFrom: "Economy/ unemployment/ poverty", question: QUESTION_SINGULAR, mentionRule: "Open-ended first problem; separate parallel-mode estimate.", mode: LINA, modeColumn: "LinA", categories: Y2018, pick: 1, basePick: 1, fieldwork: {} },
  { id: "2019-rdd", reportYear: 2019, reportId: "scanlon-2019", anchor: "Table 16", bodyFrom: "Economy/ unemployment/ poverty", question: QUESTION_SINGULAR, mentionRule: "Open-ended first problem; separate parallel-mode estimate.", mode: RDS, modeColumn: "RDD", categories: Y2019, pick: 3, basePick: 3, fieldwork: {} },
  { id: "2019-lina", reportYear: 2019, reportId: "scanlon-2019", anchor: "Table 16", bodyFrom: "Economy/ unemployment/ poverty", question: QUESTION_SINGULAR, mentionRule: "Open-ended first problem; separate parallel-mode estimate.", mode: LINA, modeColumn: "LinA", categories: Y2019, pick: 1, basePick: 1, fieldwork: {} },
  { id: "2020-july", reportYear: 2020, reportId: "scanlon-2020", anchor: "Table 10", bodyFrom: "COVID-19, including impact on the economy", question: QUESTION_SINGULAR, mentionRule: "Open-ended first problem; the July wave is not combined with November.", mode: LINA, modeColumn: "July 2020", categories: Y2020, pick: 2, basePick: 2, fieldwork: { start: "2020-07-14", end: "2020-07-27" } },
  { id: "2020-november", reportYear: 2020, reportId: "scanlon-2020", anchor: "Table 10", bodyFrom: "COVID-19, including impact on the economy", question: QUESTION_SINGULAR, mentionRule: "Open-ended first problem; the November wave is not combined with July.", mode: LINA, modeColumn: "November 2020", categories: Y2020, pick: 1, basePick: 1, fieldwork: { start: "2020-11-09", end: "2020-11-23" } },
  { id: "2021-july", reportYear: 2021, reportId: "scanlon-2021", anchor: "Table 8", bodyFrom: "COVID-19, including", question: QUESTION_SINGULAR, mentionRule: "Open-ended first problem.", mode: LINA, modeColumn: "July 2021", categories: Y2020, pick: 1, basePick: 1, fieldwork: { start: "2021-07-12", end: "2021-07-26" } },
];

function sourceMaps(srcDir) {
  const manifest = JSON.parse(fs.readFileSync(path.join(srcDir, "manifest.json"), "utf8"));
  const docs = [...manifest.reports, ...manifest.methodologyReports];
  const byId = new Map();
  for (const doc of docs) {
    const file = path.join(srcDir, doc.text);
    const text = fs.readFileSync(file, "utf8");
    byId.set(doc.id, { ...doc, text, capture: `.build/scanlon-issues-src/${doc.text}`, textSha256: sha256(text) });
  }
  return { manifest, byId };
}
const located = (doc, needle, from = 0) => {
  const at = doc.text.indexOf(needle, from);
  if (at < 0) throw new Error(`${doc.id}: source anchor not found: ${needle}`);
  return at;
};
function afterAnchor(doc, anchor, bodyFrom) {
  const start = located(doc, anchor);
  return located(doc, bodyFrom, start);
}
function valuesIn(line) {
  return [...line.matchAll(NUMBER)].map((m) => ({ text: m[0], value: num(m[0]), index: m.index }));
}
function selectedValue(line, pick) {
  const all = valuesIn(line), last = all.at(-1);
  // A rank at the start of a wrapped label (for example "5 immigrants …")
  // is not a table cell. Only lines ending in numeric cells are data rows.
  if (!last || last.value > 100 || !/^[\s%*()]*$/.test(line.slice(last.index + last.text.length))) return null;
  const values = all.filter((v) => v.value <= 100);
  if (values.length < pick) return null;
  return values[values.length - pick].value;
}
function tableRows(doc, spec) {
  const start = afterAnchor(doc, spec.anchor, spec.bodyFrom);
  const totalAt = doc.text.indexOf("Total", start);
  if (totalAt < 0) throw new Error(`${doc.id} ${spec.anchor}: no Total row`);
  const body = doc.text.slice(start, totalAt);
  const rows = [];
  for (const line of body.split("\n")) {
    const share = selectedValue(line, spec.pick);
    if (share != null) rows.push({ share, evidence: clean(line) });
  }
  if (rows.length !== spec.categories.length) {
    throw new Error(`${spec.id}: read ${rows.length} table rows, expected ${spec.categories.length}; ${JSON.stringify(rows)}`);
  }
  return rows;
}
function tableBase(doc, spec) {
  const start = afterAnchor(doc, spec.anchor, spec.bodyFrom);
  const at = located(doc, "N (unweighted)", start);
  const line = doc.text.slice(at, doc.text.indexOf("\n", at));
  const vals = valuesIn(line).map((v) => v.value);
  const n = vals[vals.length - spec.basePick];
  if (!Number.isInteger(n) || n < 1 || n > 100000) throw new Error(`${spec.id}: invalid printed N ${n}`);
  return { unweightedN: n, evidence: clean(line), source: { reportId: doc.id, anchor: `${spec.anchor}, N (unweighted)` } };
}
function categoryRows(spec, rows) {
  return spec.categories.map((key, i) => ({ ...C[key], share: rows[i].share, unit: "percent", evidence: rows[i].evidence }));
}
function printedTotal(doc, spec) {
  const start = afterAnchor(doc, spec.anchor, spec.bodyFrom), at = located(doc, "Total", start);
  const line = doc.text.slice(at, doc.text.indexOf("\n", at));
  const vals = valuesIn(line).map((v) => v.value), total = vals[vals.length - spec.pick];
  return { printed: total, computedFromNonSubtotals: null };
}
function makeTableWave(doc, spec, docs) {
  const rows = categoryRows(spec, tableRows(doc, spec));
  const baseSpec = spec.id === "2011" ? { ...spec, basePick: 2, anchor: "Table 11", bodyFrom: "Economy/ unemployment/ poverty" } : spec;
  const baseDoc = spec.id === "2011" ? docs.get("scanlon-2012") : doc;
  const base = tableBase(baseDoc, baseSpec);
  const total = printedTotal(doc, spec);
  total.computedFromNonSubtotals = Number(rows.filter((r) => r.role !== "printed-subtotal").reduce((n, r) => n + r.share, 0).toFixed(3));
  return {
    id: spec.id, reportYear: spec.reportYear, wave: spec.id, question: spec.question,
    responseFormat: "Open-ended; first-mentioned problem", mentionRule: spec.mentionRule,
    sampleDesign: { mode: spec.mode, ...(spec.modeColumn ? { tableModeColumn: spec.modeColumn } : {}), fieldwork: spec.fieldwork },
    coverage: { kind: "full-printed-distribution", includesOtherNothingDontKnow: true, completeCodedDistribution: true },
    base: { kind: "printed first-mention table base", ...base, validResponseN: null,
      note: "The printed N includes the Other/nothing/don’t know response row; it is not replaced by an inferred valid-only denominator." },
    source: sourceAt(doc, spec.anchor, spec.question), categories: rows, distributionTotal: total,
  };
}
function sourceAt(doc, anchor, question = null) {
  let searchFrom = 0;
  for (;;) {
    const at = located(doc, anchor, searchFrom), firstEnd = doc.text.indexOf("\n", at);
    const secondEnd = doc.text.indexOf("\n", firstEnd + 1);
    const caption = clean(doc.text.slice(at, secondEnd < 0 ? firstEnd : secondEnd));
    if (!question || caption.includes(question))
      return { reportId: doc.id, anchor, caption, url: doc.url, doi: doc.doi ?? null, textSha256: doc.textSha256 };
    searchFrom = at + anchor.length;
  }
}
function capture(text, re, label) {
  const m = text.match(re);
  if (!m) throw new Error(`source reading not found: ${label}`);
  return { share: num(m[1]), evidence: clean(m[0]) };
}
function sampleN(doc, re, label) {
  const m = doc.text.match(re);
  if (!m || !Number.isInteger(num(m[1])) || num(m[1]) < 1) throw new Error(`survey sample not found: ${label}`);
  return num(m[1]);
}
function figureCategory(id, label, reading, extra = {}) {
  return { id, sourceLabel: label, role: "coded-category", share: reading.share, unit: "percent", evidence: reading.evidence, ...extra };
}
function lateWave(spec) {
  return { id: spec.id, reportYear: spec.reportYear, wave: spec.id, question: spec.question,
    ...(spec.questionNote ? { questionNote: spec.questionNote } : {}),
    responseFormat: "Open-ended; first-mentioned problem", mentionRule: "Open-ended first problem.",
    sampleDesign: { mode: spec.mode, fieldwork: spec.fieldwork || {}, ...(spec.designNote ? { note: spec.designNote } : {}) },
    coverage: spec.coverage,
    base: { kind: "weighted adult shares; no separate first-mention unweighted N printed", unweightedN: null, validResponseN: null,
      ...(spec.surveySampleN != null ? { surveySampleN: spec.surveySampleN, surveySampleAnchor: spec.surveySampleAnchor } : {}),
      note: spec.baseNote || "The report figure/prose does not print a separate valid first-mention denominator; the overall survey N is not substituted for it." },
    source: sourceAt(spec.doc, spec.anchor, spec.captionQuestion === false ? null : spec.question), categories: spec.categories,
    distributionTotal: { printed: null, computedFromNonSubtotals: null, note: "Selected/most-common categories only; no distribution total is inferred." },
  };
}
function figure16(doc) {
  const at = located(doc, "Figure 16   The most important problem facing Australia, 2018, 2020, and 2022 surveys");
  const end = located(doc, "Figure 17", at), body = doc.text.slice(at, end);
  const specs = [
    ["covid-19-pandemic-recovery", "The COVID-19 pandemic & recovery", "THE COVID-19 PANDEMIC &", "ECONOMIC ISSUES, E.G. UNEMPLOYMENT,"],
    ["economy-unemployment-jobs-deficit-poverty", "Economic issues, e.g. unemployment, jobs, deficit, poverty", "ECONOMIC ISSUES, E.G. UNEMPLOYMENT,", "ENVIRONMENT, CLIMATE"],
    ["environment-climate-change-water", "Environment, climate change & water", "ENVIRONMENT, CLIMATE", "HOUSING SHORTAGES, AFFORDABILITY &"],
    ["housing-shortages-affordability-interest-rates", "Housing shortages, affordability & interest rates", "HOUSING SHORTAGES, AFFORDABILITY &", "SOCIAL ISSUES: DRUG USE,"],
    ["social-issues-drug-use-family-breakdown-childcare", "Social issues: drug use, family breakdown, childcare", "SOCIAL ISSUES: DRUG USE,", "QUALITY OF GOVERNMENT &"],
    ["quality-of-government-politicians", "Quality of government & politicians", "QUALITY OF GOVERNMENT &", "HEALTH & HOSPITALS"],
    ["health-hospitals", "Health & hospitals", "HEALTH & HOSPITALS", "DEFENCE, NATIONAL SECURITY &"],
    ["defence-national-security-terrorism", "Defence, national security & terrorism", "DEFENCE, NATIONAL SECURITY &", "IMMIGRATION/POPULATION"],
    ["immigration-population-growth-concern", "Immigration/population growth (concern)", "IMMIGRATION/POPULATION", "0%           10"],
  ];
  return specs.map(([id, label, start, stop], i) => {
    const a = body.indexOf(start), b = i === specs.length - 1 ? body.indexOf("0%           10", a) : body.indexOf(stop, a + start.length);
    if (a < 0 || b < 0) throw new Error(`2022 figure 16: failed reading ${label}`);
    const segment = body.slice(a, b), values = valuesIn(segment).filter((v) => v.value <= 100);
    if (!values.length) throw new Error(`2022 figure 16: no 2022 value for ${label}`);
    // The next category's July-2018 callout sits above its label. Hence the
    // July-2022 value is penultimate in every segment except the final one.
    const share = (i === specs.length - 1 ? values.at(-1) : values.at(-2))?.value;
    if (share == null) throw new Error(`2022 figure 16: insufficient series values for ${label}`);
    return figureCategory(id, label, { share, evidence: clean(segment) }, id === "immigration-population-growth-concern" ? { polarity: "concern" } : {});
  });
}
function figure7a(doc) {
  const at = located(doc, "Figure 7    The most important problem facing Australia and the world today");
  const end = located(doc, "A challenging national & global environment", at), text = doc.text.slice(at, end);
  const specs = [
    ["economy", "The economy", "1. The economy", 0],
    ["housing-affordability", "Housing affordability", "2. Housing affordability", 0],
    ["environment", "The environment", "3. The environment", 0],
    ["social-issues", "Social issues", "4. Social issues", 0],
    ["government-politics", "Government & politics", "5. Government & politics", 0],
    ["crime", "Crime", "6. Crime", 0],
    ["immigration-population", "Immigration / population", "7. Immigration /", 1],
    ["health", "Health", "8. Health", 0],
  ];
  const lines = text.split("\n");
  return specs.map(([id, label, anchor, offset]) => {
    const row = lines.findIndex((line) => line.includes(anchor));
    if (row < 0 || !lines[row + offset]) throw new Error(`2024 figure 7a: missing ${label}`);
    const line = lines[row + offset];
    const valueText = offset === 0 ? line.slice(line.indexOf(anchor) + anchor.length) : line;
    const value = valuesIn(valueText).find((v) => v.value <= 100);
    if (!value) throw new Error(`2024 figure 7a: no figure for ${label}`);
    return figureCategory(id, label, { share: value.value, evidence: clean(line) });
  });
}
function prose2023(doc) {
  const readings = [
    // Two-column PDF layout inserts the right-hand column between the lead-in
    // and its next-line continuation, so match the actual printed lines.
    ["economic-issues", "Economic issues", capture(doc.text, /In 2023, almost half of us \((\d+) per cent\) think that[^\n]*\neconomic issues are the most important set of problems/, "2023 economic MIP")],
    ["housing-affordability-shortages", "Housing affordability and shortages", capture(doc.text, /The next most commonly cited problem\s+was housing affordability and shortages, cited by[^\n]*\n(\d+) per cent of people/, "2023 housing MIP")],
    ["environment-climate-change-water", "Environment, climate change and water", capture(doc.text, /environment\. One-in-ten \((\d+) per cent\) people cited an[^\n]*\nissue related to the environment, climate change and[^\n]*\nwater as the most important problem facing Australia/, "2023 environment MIP")],
  ];
  return readings.map(([id, label, reading]) => figureCategory(id, label, reading));
}
function prose2025(doc) {
  const m = doc.text.match(/problem\. In the[^\n]*\n\s*total population, (\d+) per cent cite economic and\s+housing issues and (\d+) per cent cite immigration\s+as the most important problem\./);
  if (!m) throw new Error("2025 MIP aggregate sentence not found");
  return [
    figureCategory("economic-and-housing-issues-printed-combination", "Economic and housing issues (printed combined category)", { share: num(m[1]), evidence: clean(m[0]) }, { role: "printed-combined-category", note: "The report does not separately print the two components here; they are not derived." }),
    figureCategory("immigration", "Immigration", { share: num(m[2]), evidence: clean(m[0]) }),
  ];
}
function figure5(doc) {
  const at = located(doc, "Figure 5.         ‘What do you think is the most important problem facing Australia");
  const end = doc.text.slice(at).search(/^\s*0\s+10\s+20\s+30\s+40\s+50\s*$/m);
  if (end < 0) throw new Error("2026 figure 5: chart axis not found");
  const captionEnd = doc.text.indexOf("\n", at);
  const text = doc.text.slice(captionEnd, at + end), labels = [
    ["cost-of-living-inflation", "Cost of living / inflation"],
    ["housing-affordability-shortages", "Housing affordability & shortages"],
    ["other-economic-issues", "Other economic issues"],
    ["immigration", "Immigration"],
    ["government-politicians", "The Government and politicians"],
    ["social-gender-issues", "Social & gender issues (gender equality, violence against women, drugs, childcare, family)"],
    ["environment-climate-change", "The environment & climate change"],
    ["crime-law-order", "Crime, law & order"],
    ["right-wing-politics-racism-united-states", "Right wing politics, racism & the influence of the United States"],
    ["national-security-terrorism-world-peace", "National security, terrorism & world peace"],
    ["health-education", "Health & education"],
    ["social-media-misinformation-artificial-intelligence", "Social media, misinformation & Artificial Intelligence"],
  ];
  const values = [];
  for (const line of text.split("\n")) for (const value of valuesIn(line)) {
    if (value.value <= 100) values.push({ ...value, evidence: clean(line) });
  }
  if (values.length !== labels.length * 4) throw new Error(`2026 figure 5: expected ${labels.length * 4} group values, found ${values.length}`);
  return labels.map(([id, label], i) => {
    // Each four-value group is Total, pessimistic, cohesion-declining, One Nation.
    const reading = values[i * 4];
    return figureCategory(id, label, { share: reading.value, evidence: clean(reading.evidence) }, { figureSeries: "Total", figureGroupReadOrder: i + 1 });
  });
}

export function buildScanlonIssues(srcDir = SRC) {
  const { manifest, byId: docs } = sourceMaps(srcDir);
  const waves = TABLE_WAVES.map((spec) => makeTableWave(docs.get(spec.reportId), spec, docs));
  const doc2022 = docs.get("scanlon-2022");
  waves.push(lateWave({ id: "2022-july", reportYear: 2022, doc: doc2022, anchor: "Figure 16   The most important problem facing Australia, 2018, 2020, and 2022 surveys", question: QUESTION_SINGULAR, captionQuestion: false,
    mode: LINA, fieldwork: { start: "2022-07-11", end: "2022-07-24" }, coverage: { kind: "selected-problems", completeCodedDistribution: false, includesOtherNothingDontKnow: false },
    surveySampleN: sampleN(doc2022, /There were ([\d,]+) respondents in the[^\n]*\n[^\n]*2022 survey/, "2022 Appendix A"), surveySampleAnchor: "Appendix A, Sample", categories: figure16(doc2022) }));
  const doc2023 = docs.get("scanlon-2023");
  waves.push(lateWave({ id: "2023-july", reportYear: 2023, doc: doc2023, anchor: "Figure 3", question: QUESTION_SINGULAR,
    questionNote: "The three percentages are read from the adjacent prose because the time-series chart does not print every category value in extractable text.",
    mode: LINA, fieldwork: { reported: "July 2023" }, coverage: { kind: "selected-problems-in-prose", completeCodedDistribution: false, includesOtherNothingDontKnow: false },
    surveySampleN: sampleN(doc2023, /nationally-\s*representative survey of ([\d,]+) Australians/, "2023 Appendix A"), surveySampleAnchor: "Appendix A and Table A1", categories: prose2023(doc2023) }));
  const doc2024 = docs.get("scanlon-2024");
  waves.push(lateWave({ id: "2024-july", reportYear: 2024, doc: doc2024, anchor: "Figure 7    The most important problem facing Australia and the world today", question: QUESTION_SINGULAR, captionQuestion: false,
    questionNote: "Question wording is printed in Figure 5; the eight national values are read from Figure 7a, not the World panel.",
    mode: LINA, fieldwork: { reported: "July 2024" }, coverage: { kind: "eight-most-cited-problems", completeCodedDistribution: false, includesOtherNothingDontKnow: false },
    surveySampleN: sampleN(doc2024, /nationally-\s*representative survey of ([\d,]+) Australians/, "2024 Appendix A"), surveySampleAnchor: "Appendix A and Table A1", categories: figure7a(doc2024) }));
  const doc2025 = docs.get("scanlon-2025");
  waves.push(lateWave({ id: "2025-july", reportYear: 2025, doc: doc2025, anchor: "total population,", question: null,
    questionNote: "The 2025 report reproduces the MIP result but not the full question wording; no wording is back-filled from another wave.",
    mode: "Life in Australia panel, online and telephone; separate ORU non-probability-panel pilot",
    designNote: "The 2025 report separately describes its Life in Australia respondents, a targeted Polaron survey and an ORU pilot. Its total-population MIP sentence does not identify a separate valid first-mention N or which panel components form that exact base.",
    fieldwork: { reported: "July 2025" }, coverage: { kind: "selected-problems-in-prose", completeCodedDistribution: false, includesOtherNothingDontKnow: false },
    categories: prose2025(doc2025) }));
  const doc2026 = docs.get("scanlon-2026");
  waves.push(lateWave({ id: "2026-june-july", reportYear: 2026, doc: doc2026, anchor: "Figure 5", question: QUESTION_SINGULAR,
    mode: "Blended Life in Australia probability panel and ORU non-probability boost, online and telephone",
    fieldwork: { start: "2026-06-29", end: "2026-07-21", note: "Overall span; Life in Australia closed 12 July and ORU closed 21 July (Technical Report Table B1)." },
    coverage: { kind: "most-common-problems-total-series", completeCodedDistribution: false, includesOtherNothingDontKnow: false },
    surveySampleN: sampleN(docs.get("scanlon-technical-2026"), /survey of ([\d,]+) Australians with additional targeted boost surveys/, "2026 Technical Report introduction"), surveySampleAnchor: "Technical Report, Introduction and Table B1", categories: figure5(doc2026),
    baseNote: "Figure 5 prints weighted Total/subgroup shares but not a separate first-mention unweighted N. The national blended N is read from the Technical Report, not assumed to be a valid-response N." }));
  const reportSources = [...manifest.reports, ...manifest.methodologyReports].map((doc) => {
    const live = docs.get(doc.id);
    return { id: doc.id, reportYear: doc.reportYear, title: doc.title, url: doc.url, doi: doc.doi ?? null,
      capture: live.capture, pdfSha256: doc.pdfSha256, textSha256: live.textSha256 };
  });
  const coverageRows = Object.fromEntries(waves.map((w) => [w.id, w.categories.length]));
  return {
    schemaVersion: 1,
    series: "scanlon-mapping-social-cohesion-first-most-important-problem",
    about: "Source-preserving aggregate archive of the Scanlon Mapping Social Cohesion open-ended most-important-problem question. Categories, printed subtotals, response valence, survey modes and bases remain wave-specific. This is not data/scanlon-one-offs.json and does not convert MIP responses into broader immigration or trust sentiment.",
    generatedBy: ".build/extract-scanlon-issues.mjs from cached official report text; no network access and no respondent-level rows",
    unit: "percent",
    categoryContract: {
      idsDerivedFromPrintedLabels: true,
      sourceLabelsPreserved: true,
      noPollKeyNormalisation: true,
      printedSubtotalsRemainSeparate: true,
      supportiveAndNegativeMentionsNeverCombined: true,
      missingCellsRemainMissing: true,
      note: "Subtotal rows are included only where the report prints them. A printed combined category is not decomposed, and zeroes are retained.",
    },
    rawDataAccess: { ...manifest.rawDataAccess,
      suppliedDepositDois: manifest.reports.filter((r) => r.doi).map((r) => r.doi),
      respondentRowsInArchive: 0,
      effect: "Aggregate figures come only from public report tables, figures and cited prose. No unverified codebook or wave/column binding is used." },
    sources: reportSources,
    waves,
    coverage: { reportYears: [...new Set(waves.map((w) => w.reportYear))], waves: waves.length, fullPrintedDistributions: waves.filter((w) => w.coverage.completeCodedDistribution).length,
      selectedOrMostCommonDistributions: waves.filter((w) => !w.coverage.completeCodedDistribution).length,
      categoryRows: waves.reduce((n, w) => n + w.categories.length, 0), categoryRowsByWave: coverageRows },
    limitations: [
      "ADA Anubis blocked the dataset metadata API on checked 2011, 2012 and 2023 deposit requests. No respondent files or codebooks were available; valid-only respondent denominators and raw column derivations therefore remain unavailable.",
      "The 2011 report's Table 6 N cell is malformed in text extraction. Its base is independently read from the 2012 report Table 11's 2011 column and explicitly sourced there, not guessed.",
      "The 2022–2026 public reports print selected, ranked or most-common MIP categories rather than a full coded distribution with Other/nothing/don’t know and Total. Those five waves are explicitly marked incomplete; no residual or missing category shares are derived.",
      "In 2025 the combined economic-and-housing figure is retained as a printed combined category. It is not split into economic and housing estimates, and the exact MIP panel/valid-response base is not separately identified in the report."
    ],
  };
}

function main() {
  const data = buildScanlonIssues(), text = JSON.stringify(data, null, 2) + "\n";
  const changed = !fs.existsSync(OUT) || fs.readFileSync(OUT, "utf8") !== text;
  if (changed && CHECK) throw new Error("data/scanlon-issues.json is stale; run node .build/extract-scanlon-issues.mjs");
  if (changed) {
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT + ".tmp", text);
    fs.renameSync(OUT + ".tmp", OUT);
  }
  console.log("SCANLON_ISSUES_STATUS " + JSON.stringify({ ...data.coverage, categoryRowsByWave: undefined, changed, check: CHECK }));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { console.error(`SCANLON_ISSUES_ERROR ${error.stack || error}`); process.exit(1); }
}
