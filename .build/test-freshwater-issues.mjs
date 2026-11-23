#!/usr/bin/env node
/** Fully offline regression checks for the Freshwater issue-battery archive. */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  ROOT, CACHE, OUTPUT, SPECS, DEC22_OCR_PROOF,
  buildStore, buildDecemberOcrProof, renderStore, parseDelimited, parsePrintedNumber, parseFieldwork,
} from "./extract-freshwater-issues.mjs";

let checks = 0;
function ok(value, message) { assert.ok(value, message); checks++; }
function equal(actual, expected, message) { assert.equal(actual, expected, message); checks++; }
function deep(actual, expected, message) { assert.deepEqual(actual, expected, message); checks++; }
function throws(fn, re, message) { assert.throws(fn, re, message); checks++; }

const freshlyRendered = renderStore();
const store = buildStore();
const diskText = fs.readFileSync(OUTPUT, "utf8");
equal(diskText, freshlyRendered, "committed output is exactly what an offline rebuild renders");
deep(JSON.parse(diskText), store, "on-disk schema/data matches the in-memory store");

// Counts include two source-native exceptions, never padding or dropped rows.
deep(store.summary, {
  importanceWaves: 9,
  importanceRows: 144,
  importanceCells: 144,
  managementWaves: 12,
  managementRows: 179,
  managementResponseCells: 537,
  netLeadSupplementCharts: 2,
  netLeadPeriodRows: 11,
  netLeadCells: 44,
  netLeadDistinctMonths: 6,
  missingBatteryMarkersPerMeasure: 3,
}, "exact wave/row/cell coverage");

const wave = (kind, month) => {
  const found = store[kind].waves.find((w) => w.month === month);
  ok(found, `${kind} ${month} exists`);
  return found;
};
const net = (month) => {
  const found = store.netLeadSupplements.find((w) => w.month === month);
  ok(found, `net-lead ${month} exists`);
  return found;
};

// Every specified Datawrapper id appears once and nowhere but the right measure.
addressSources: {
  const expected = new Set([...Object.values(SPECS).flat().map(([, id]) => id)]);
  const datawrapperWaves = [
    ...store.importance.waves.filter((w) => w.source.chartId),
    ...store.management.waves.filter((w) => w.source.chartId),
    ...store.netLeadSupplements,
  ];
  equal(datawrapperWaves.length, 21, "21 tabular chart sources");
  deep(new Set(datawrapperWaves.map((w) => w.source.chartId)), expected, "all and only requested chart ids");
  for (const w of datawrapperWaves) {
    const id = w.source.chartId;
    equal(w.source.datasetUrl, `https://datawrapper.dwcdn.net/${id}/1/dataset.csv`, `${id} dataset URL`);
    ok(fs.statSync(path.join(CACHE, `${id}.dataset.csv`)).size > 50, `${id} source payload cached`);
    ok(fs.statSync(path.join(CACHE, `${id}.chart.html`)).size > 500, `${id} title/chart shell cached`);
    ok(w.title && w.printedLabel, `${id} print-stated title and figure label kept`);
    equal(w.questionStem, null, `${id} has no invented question stem`);
    ok(w.sample > 0 && w.fieldworkStart && w.fieldworkEnd, `${id} sample and fieldwork read from footnote`);
  }
}

// Only the December PNGs provide exact stems; all 21 tabular waves stay null.
{
  const all = [...store.importance.waves, ...store.management.waves, ...store.netLeadSupplements];
  equal(all.filter((w) => w.questionStem !== null).length, 2, "exactly two PNG-backed question stems");
  equal(all.filter((w) => w.questionStem === null).length, 21, "21 tabular waves have no inferred stem");
  equal(wave("importance", "2022-12").sample, 1209, "December PNG n=1,209 corroborated by both accurate OCR footers");
  equal(wave("management", "2022-12").sample, 1209, "same December management sample");
  for (const f of [
    "2022-12-importance.png", "2022-12-management.png",
    "2022-12-importance-ocr-3x-accurate.json", "2022-12-importance-ocr-4x-accurate.json",
    "2022-12-management-ocr-3x-accurate.json", "2022-12-management-ocr-4x-accurate.json",
    "2022-12-ocr-proof.json",
  ]) {
    ok(fs.statSync(path.join(CACHE, f)).size > 100, `${f} retained for mechanical verification`);
  }
  ok(!fs.existsSync(path.join(CACHE, "2022-12-png-verified.json")), "the unsupported model transcription no longer exists");
}

// December 2022: 15/14 rows, no job-security zero, exact title/options/grammar.
{
  const imp = wave("importance", "2022-12");
  equal(imp.rows.length, 15, "December importance has 15 rows, not the usual 16");
  ok(!imp.rows.some((r) => /Job security/.test(r.issue)), "December importance does not invent a jobs row");
  equal(imp.rows[0].issue, "Cost of & standard of living", "December importance's source grammar retained");
  equal(imp.rows[0].share, 71, "December cost-of-living reading");
  equal(imp.rows.at(-1).issue, "Other", "Other retained in importance");
  equal(imp.rows.at(-1).share, 3, "December Other is 3, not zero or missing");
  ok(imp.rows.some((r) => r.issue === "Defence and national security" && r.share === 14), "December 'and' defence wording retained");
  equal(imp.title, "Voter priorities", "December importance title");
  ok(imp.questionStem.includes("Please pick up to three"), "December printed stem retained verbatim");

  const man = wave("management", "2022-12");
  equal(man.rows.length, 14, "December management has 14 rows, not the usual 15");
  ok(!man.rows.some((r) => /Job security/.test(r.issue)), "December management does not invent a jobs row or zero");
  deep(man.responseOptions, [
    "Albanese-led Labor government is best",
    "Neither / Unsure",
    "Dutton-led Liberal government is best",
  ], "December's exact Liberal-government response wording");
  deep(man.rows[0], { issue: "Welfare & benefits", shares: [50, 28, 23] }, "December first row cell-by-cell");
  const cost = man.rows[6];
  equal(cost.issue, "The cost of & standards of living", "December management source typo/grammar retained, not normalised");
  deep(cost.shares, [41, 32, 27], "December cost issue three-response management");
  equal(man.title, "Who is best to manage each voter priority", "December management title");
}

// Every December cell ships with two raw, coordinate-specific OCR witnesses.
{
  const proof = buildDecemberOcrProof();
  equal(fs.readFileSync(DEC22_OCR_PROOF, "utf8"), `${JSON.stringify(proof, null, 2)}\n`, "OCR proof is exactly regenerated from the raw accurate-mode payloads");
  equal(proof.cells.length, 57, "15 importance + 14 x 3 management = 57 proven cells");
  equal(proof.cells.filter((c) => c.measure === "importance").length, 15, "15 importance cells proven");
  equal(proof.cells.filter((c) => c.measure === "management").length, 42, "42 management cells proven");
  const rawByFile = new Map();
  const rawLines = (file) => {
    if (!rawByFile.has(file)) rawByFile.set(file, JSON.parse(fs.readFileSync(path.join(CACHE, file), "utf8")));
    return rawByFile.get(file);
  };
  const hasExactLine = (file, box) => rawLines(file).some((line) =>
    line.text === box.text && line.x === box.x && line.y === box.y && line.w === box.w && line.h === box.h);
  for (const cell of proof.cells) {
    equal(cell.reads.length, 2, `${cell.measure} ${cell.issue} has exactly two OCR witnesses`);
    deep(cell.reads.map((r) => r.scale), [3, 4], `${cell.issue} reads are the independent 3x and 4x runs`);
    equal(cell.reads[0].valueText, cell.reads[1].valueText, `${cell.issue} printed values agree across scales`);
    equal(Number(cell.reads[0].valueText.slice(0, -1)), cell.share, `${cell.issue} printed value is the shipped number`);
    for (const read of cell.reads) {
      equal(read.issueText, cell.issue, `${cell.issue} issue label is the same cell's label`);
      equal(read.valueText, `${cell.share}%`, `${cell.issue} OCR text supplies the shipped share directly, never a row-sum derivation`);
      ok(read.ocrCache.endsWith(`-${read.scale}x-accurate.json`), `${cell.issue} uses the accurate ${read.scale}x payload`);
      ok(hasExactLine(read.ocrCache, read.issueBox), `${cell.issue} ${read.scale}x issue box exists verbatim in raw OCR`);
      ok(hasExactLine(read.ocrCache, read.valueBox), `${cell.issue} ${read.scale}x numeric box exists verbatim in raw OCR`);
    }
  }
  const firstThree = proof.cells.filter((c) => c.measure === "management" && c.issue === "Welfare & benefits");
  deep(firstThree.map((c) => [c.responseOption, c.share, ...c.reads.map((r) => r.valueText)]), [
    ["Albanese-led Labor government is best", 50, "50%", "50%"],
    ["Neither / Unsure", 28, "28%", "28%"],
    ["Dutton-led Liberal government is best", 23, "23%", "23%"],
  ], "Welfare's formerly missing 50/28/23 cells are each independently present in both accurate OCR payloads");
  const decImp = wave("importance", "2022-12");
  const decMan = wave("management", "2022-12");
  for (const row of decImp.rows) equal(proof.cells.find((c) => c.measure === "importance" && c.issue === row.issue).share, row.share, `importance ${row.issue} data equals its proof`);
  for (const row of decMan.rows) row.shares.forEach((share, i) => {
    equal(proof.cells.find((c) => c.measure === "management" && c.issue === row.issue && c.responseOption === decMan.responseOptions[i]).share, share, `management ${row.issue} option ${i} equals its proof`);
  });
  ok(!/verified directly against|full-resolution PNG was checked|model.checked/i.test(`${decImp.source.verification} ${decMan.source.verification}`), "no model-pixel verification assertion survives");
}

// January 2024 is a source-native 17-row exception; Other remains last.
{
  const jan = wave("importance", "2024-01");
  equal(jan.rows.length, 17, "January 2024 keeps its extra Indigenous affairs row");
  deep(jan.sourceHeaders, ["Issue ", "%"], "even the TSV's trailing header space is preserved");
  deep(jan.rows[14], { issue: "Indigenous affairs", share: 4 }, "Indigenous affairs stays before strikes");
  equal(jan.rows[15].issue, "Strikes & union-led industrial action", "strikes stays after Indigenous affairs");
  equal(jan.rows[16].issue, "Other", "Other stays last after the extra issue");
  equal(jan.sample, 1007, "January 2024 sample from its printed footnote");
  equal(jan.title, "Cost of living dominates the issue agenda, followed by housing & accommodation.", "title trimmed without changing wording");
}
{
  const oct = wave("importance", "2024-10");
  deep(oct.rows.slice(0, 4).map((r) => r.issue), [
    "The cost & standard of living", "Housing & accommodation", "Managing the economy", "Health & social care",
  ], "October importance source row order is not replaced by a generic universe order");
  equal(wave("importance", "2025-01").sample, 1063, "January 2025 sample");
}

// Later management headers/options and source spelling changes stay exact.
{
  for (const month of store.management.waves.map((w) => w.month).filter((m) => m !== "2022-12")) {
    const w = wave("management", month);
    equal(w.rows.length, 15, `${month} has 15 management issues`);
    deep(w.sourceHeaders, ["Row %", "Albanese-led Labor government", "Neither / Unsure", "Dutton-led Coalition government"], `${month} exact headers`);
    deep(w.responseOptions, w.sourceHeaders.slice(1), `${month} response options align with values`);
    ok(w.rows.every((r) => r.shares.length === 3), `${month} every issue has three responses`);
    ok(w.rows.every((r) => { const s = r.shares.reduce((a, b) => a + b, 0); return s >= 99 && s <= 101; }), `${month} sums within printed rounding`);
  }
  const mar = wave("management", "2024-03");
  ok(mar.rows.some((r) => r.issue === "Job security and unemployment"), "March's 'and' jobs wording retained");
  deep(mar.rows.find((r) => r.issue === "The cost & standard of living").shares, [32, 33, 35], "March cost row");
  equal(mar.rows[0].issue, "Welfare & benefits", "management begins with its printed order");
  const may = wave("management", "2024-05");
  ok(may.rows.some((r) => r.issue === "Job security and unemployment"), "May still prints 'and' in the jobs wording");
  ok(may.rows.some((r) => r.issue === "The environment & climate change"), "May still prints environment & climate change");
  const jun = wave("management", "2024-06");
  ok(jun.rows.some((r) => r.issue === "Job security and unemployment"), "June still prints 'and' in the jobs wording");
  ok(jun.rows.some((r) => r.issue === "The environment & climate change"), "June still prints environment & climate change");
  const jul = wave("management", "2024-07");
  ok(jul.rows.some((r) => r.issue === "Job security & unemployment"), "July switches to the ampersand jobs wording");
  ok(jul.rows.some((r) => r.issue === "The environment"), "July prints shortened The environment");
  ok(!jul.rows.some((r) => r.issue === "The environment & climate change"), "July wording is not silently normalised backwards");
}

// Missing batteries are coverage markers with null rows, never live all-zero waves.
for (const kind of ["importance", "management"]) {
  const missing = store[kind].coverage.filter((r) => r.status === "missing-skipped-battery");
  deep(missing.map((r) => r.month), ["2023-05", "2023-09", "2025-02"], `${kind} missing batteries are May/Sep 2023 and Feb 2025`);
  for (const m of missing) {
    equal(m.printedRows, null, `${kind} ${m.month} row count stays null`);
    equal(m.coverage, "missing-not-zero", `${kind} ${m.month} coverage explicit`);
    ok(!store[kind].waves.some((w) => w.month === m.month), `${kind} ${m.month} is not fabricated as a wave`);
  }
}

// Net leads remain their own trend measure, especially where rounding differs.
{
  const feb = net("2024-02");
  equal(feb.supplement, true, "February net lead labelled supplement");
  equal(feb.rows.length, 5, "February chart has five printed periods");
  deep(feb.issues, ["Managing the economy", "Cost & standard of living", "Immigration & asylum", "Crime & social order"], "net-lead's exact four printed issue labels");
  deep(feb.rows[0].netLeads, [-9, -6, -13, -12], "February net leads read as signed numbers, not percentages");
  deep(feb.rows.at(-1), { printedPeriod: "Dec-22", month: "2022-12", netLeads: [1, 13, 4, 0] }, "December 2022 supplement period retained");
  ok(!("responseOptions" in feb), "net-lead supplement has no full-management response options");
  const fullCost = wave("management", "2022-12").rows[6];
  equal(fullCost.shares[0] - fullCost.shares[2], 14, "full-share arithmetic is 14");
  equal(feb.rows.at(-1).netLeads[1], 13, "printed net-lead supplement remains 13; it is not overwritten with share arithmetic");
  const mar = net("2024-03");
  equal(mar.rows.length, 6, "March adds one period to its source-native reprint");
  deep(mar.rows[0].netLeads, [-10, -3, -11, -11], "March net leads");
  deep(mar.rows.slice(1).map((r) => r.printedPeriod), feb.rows.map((r) => r.printedPeriod), "March reprint keeps February chart's later periods/order");
  ok(store.management.waves.every((w) => w.measure === "issue-management-three-response"), "management measure does not absorb supplements");
}

// No voting-intention fields were spliced into this standalone issue store.
{
  const banned = new Set(["tpp", "tpp_alp", "tpp_lnp", "alp", "lnp", "onp", "grn", "primary"]);
  const walk = (x) => {
    if (!x || typeof x !== "object") return;
    for (const [k, v] of Object.entries(x)) {
      ok(!banned.has(k), `no voting-intention key ${k}`);
      walk(v);
    }
  };
  walk(store);
}

// Primitive parser contracts: exact tabs, trailing blank lines, percent grammar.
{
  deep(parseDelimited("a\tb\n1\t2\n\n\n"), { headers: ["a", "b"], rows: [["1", "2"]] }, "literal TSV with trailing blank lines");
  throws(() => parseDelimited("a,b\n1,2\n", "comma fixture"), /literal-tab TSV/, "commas are never guessed as delimiters");
  throws(() => parseDelimited("a\tb\n1\n", "ragged"), /row 2 has 1 cells/, "ragged tab row rejected");
  throws(() => parseDelimited("a\tb\n\n1\t2", "blank"), /blank source row/, "interior blank row rejected");
  equal(parsePrintedNumber("71%"), 71, "percent kept as points");
  equal(parsePrintedNumber("-9", { percent: false }), -9, "signed net lead");
  throws(() => parsePrintedNumber("71", { chartId: "fixture" }), /malformed/, "share without its printed % rejected");
  deep(parseFieldwork("08 – 10 March 2024"), { fieldworkStart: "2024-03-08", fieldworkEnd: "2024-03-10", month: "2024-03" }, "spaced en-dash fieldwork");
}

// Fault injection reruns the whole real parser offline to expose drift classes.
function expectBuildError(file, mutate, re, label) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "freshwater-issues-test-"));
  try {
    for (const name of fs.readdirSync(CACHE)) {
      if (name.endsWith(".dataset.csv") || name.endsWith(".chart.html") || name.endsWith("-accurate.json")) {
        fs.copyFileSync(path.join(CACHE, name), path.join(temp, name));
      }
    }
    const target = path.join(temp, file);
    fs.writeFileSync(target, mutate(fs.readFileSync(target, "utf8")));
    throws(() => buildStore(temp), re, label);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}
expectBuildError("0BAz2.dataset.csv", (text) => {
  const lines = text.trimEnd().split("\n");
  [lines[1], lines[2]] = [lines[2], lines[1]];
  return `${lines.join("\n")}\n`;
}, /source rank order/, "swapping two management rows is caught");
expectBuildError("0BAz2.dataset.csv", (text) => text.replace("The cost & standard of living", "The cost and standard of living"), /grammatically altered printed issue label/, "source typo/grammar drift is caught");
expectBuildError("0BAz2.dataset.csv", (text) => text.replace("Neither / Unsure", "Neither/Unsure"), /management columns\/options changed/, "response option grammar is guarded");
expectBuildError("JiZHI.dataset.csv", (text) => {
  const lines = text.trimEnd().split("\n");
  const row = lines.splice(lines.findIndex((l) => l.startsWith("Indigenous affairs\t")), 1)[0];
  lines.splice(1, 0, row);
  return `${lines.join("\n")}\n`;
}, /Indigenous affairs moved/, "the January extra row cannot silently change position");
expectBuildError("4VjBV.dataset.csv", (text) => text.split("\n").filter((l) => !l.startsWith("Other\t")).join("\n"), /15 rows, expected 16/, "dropping Other fails the importance schema");
expectBuildError("ePE81.dataset.csv", (text) => text.replace(/^Net\t/, "Row %\t"), /net-lead supplement headers changed/, "supplement cannot masquerade as management");
expectBuildError("aTbi4.dataset.csv", (text) => text.replace("Mar-24\t-10", "Mar/24\t-10"), /malformed period/, "printed period grammar is guarded");
expectBuildError("2022-12-management-ocr-3x-accurate.json", (text) => {
  const lines = JSON.parse(text);
  const cell = lines.find((l) => l.text === "50%" && l.y === 0.193);
  ok(cell, "raw 3x Welfare 50% cell exists before fault injection");
  cell.text = "99%";
  return JSON.stringify(lines);
}, /cross-scale cells disagree/, "changing one scale's Welfare 50% cell fails closed instead of shipping either reading");
expectBuildError("2022-12-management-ocr-3x-accurate.json", (text) => {
  const lines = JSON.parse(text);
  return JSON.stringify(lines.filter((l) => !(l.text === "28%" && l.y === 0.192)));
}, /no numeric cell for Welfare & benefits column 1/, "removing Welfare's middle 28% cell fails closed; it is not completed from 50+23 or the row sum");
expectBuildError("2022-12-importance-ocr-4x-accurate.json", (text) => {
  const lines = JSON.parse(text);
  return JSON.stringify(lines.filter((l) => !(l.text === "71%" && l.y === 0.208)));
}, /no numeric cell for Cost of & standard of living column 0/, "a missing importance cell is not rescued by another scale or by the previous data file");

// Repeat generation is a byte-identical no-op and --check performs no write.
{
  equal(renderStore(), freshlyRendered, "two in-memory builds are byte-identical");
  const before = fs.statSync(OUTPUT).mtimeMs;
  const proofBefore = fs.statSync(DEC22_OCR_PROOF).mtimeMs;
  const proofText = fs.readFileSync(DEC22_OCR_PROOF, "utf8");
  const exe = path.join(ROOT, ".build", "extract-freshwater-issues.mjs");
  for (const args of [[], ["--check"]]) {
    const result = spawnSync(process.execPath, [exe, ...args], { cwd: ROOT, encoding: "utf8" });
    equal(result.status, 0, `extractor ${args.join(" ") || "run"} succeeds offline: ${result.stderr}`);
    ok(!result.stdout.includes("wrote "), "repeat run reports no write");
    equal(fs.readFileSync(OUTPUT, "utf8"), freshlyRendered, "repeat run leaves data bytes unchanged");
    equal(fs.statSync(OUTPUT).mtimeMs, before, "repeat run leaves data mtime unchanged");
    equal(fs.readFileSync(DEC22_OCR_PROOF, "utf8"), proofText, "repeat run leaves proof bytes unchanged");
    equal(fs.statSync(DEC22_OCR_PROOF).mtimeMs, proofBefore, "repeat run leaves proof mtime unchanged");
  }
}

console.log(`freshwater issues tests: ${checks} checks passed (offline; row order, typo grammar, TSV, schema, separation, missing batteries and repeat no-op)`);
