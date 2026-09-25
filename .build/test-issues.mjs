/* Tests for issues-parse.mjs – the readers behind data/issues.json and the
   Snapshot's Issues panel – against the cached reports (.build/redbridge-src,
   tracked) and the YouGov chart fixtures (.build/news24-src/ig-fixtures-*),
   plus synthetic Resolve rows for the file's known quirks.
   Run: node .build/test-issues.mjs */
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import {
  rbSalienceSummary, rbOwnershipSummary, rbGroupTables, resolveOwnership, ygIssuesOf,
  salienceProblem, ownershipProblem, rbIssue,
} from "./issues-parse.mjs";
import { infographicDataOf } from "./infogram.mjs";

const RB = ".build/redbridge-src";
const report = (date) => {
  for (const f of fs.readdirSync(RB).filter((x) => x.endsWith(".json"))) {
    const j = JSON.parse(fs.readFileSync(path.join(RB, f), "utf8"));
    if (j.date === date) return fs.readFileSync(path.join(RB, f.replace(/\.json$/, ".txt")), "utf8");
  }
  throw new Error("no cached report for " + date);
};

// ---- RedBridge, August 2026: the summary tables --------------------------------
const aug = report("2026-08-28");
const sal = rbSalienceSummary(aug);
assert.deepEqual(sal.months, ["2026-08", "2026-07"], "the two waves' months, newest first");
assert.equal(Object.keys(sal.issues).length, 14, "all 14 issues, the negative-change rows included");
assert.deepEqual(sal.issues.col, [{ r1: 44, r2: 20, r3: 11, top3: 75 }, { r1: 44, r2: 18, r3: 11, top3: 73 }]);
assert.ok(sal.issues.debt, "a row with a page number glued to its front ('59   Government debt') still reads");
assert.equal(sal.unknown.length, 0);
const own = rbOwnershipSummary(aug);
assert.deepEqual(own.months, ["2026-08", "2026-07"]);
assert.deepEqual(own.issues.col[0], { alp: 25, lnp: 20, onp: 20, grn: 8, equal: 7, none: 9, unsure: 11 },
  "Liberal 18 and National 2 are the Coalition's 20");
assert.ok(own.issues.tax[0] && !own.issues.energy, "tax reform from July; energy reliability no longer asked");
for (const [k, [cur, prev]] of Object.entries(sal.issues))
  for (const x of [cur, prev]) if (x) assert.equal(salienceProblem(x), null, `salience ${k} passes the gate`);
for (const [k, [cur, prev]] of Object.entries(own.issues))
  for (const x of [cur, prev]) if (x) assert.equal(ownershipProblem(x), null, `best party ${k} passes the gate`);

// ---- RedBridge, August 2026: the tables by group ---------------------------------
const g = rbGroupTables(aug);
assert.deepEqual(Object.keys(g.salience).sort(), ["col", "crime", "economy", "health", "housing", "immigration"]);
assert.deepEqual(g.salience.col.total, { r1: 44, r2: 20, r3: 11, not: 25 });
assert.deepEqual(Object.keys(g.salience.col.dims.vote),
  ["Labor", "Liberal", "Nationals, LNP and CLP", "One Nation", "Greens", "Others", "Undecided"], "the printed order");
assert.equal(Object.keys(g.salience.col.dims.generation).length, 4, "'87   Gen-X' – a page number glued on – still reads");
assert.deepEqual(g.ownership.col.total, own.issues.col[0], "the group table's all-voters row matches the summary");
assert.equal(g.ownership.col.dims.vote["One Nation"].onp, 64);

// ---- RedBridge, December 2025: figures only, and the Coalition as one option ------
const dec = report("2025-12-12");
assert.equal(rbSalienceSummary(dec), null, "no summary table before April 2026");
assert.equal(rbOwnershipSummary(dec), null);
const gd = rbGroupTables(dec);
assert.deepEqual(Object.keys(gd.salience).sort(), ["col", "health", "housing", "immigration"]);
assert.deepEqual(gd.ownership.col.total, { alp: 29, lnp: 19, onp: 13, grn: 6, equal: 9, none: 11, unsure: 13 },
  "the seven-column layout: 'The Liberal National Party Coalition' is one option");
assert.ok(gd.salience.col.dims.vote.Coalition, "December's vote groups print the Coalition whole");

// ---- a wave printed twice agrees: each report's previous wave is the one before's own ----
const byDate = fs.readdirSync(RB).filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(fs.readFileSync(path.join(RB, f), "utf8")).date).sort();
let compared = 0;
for (let i = 1; i < byDate.length; i++) {
  const a = rbSalienceSummary(report(byDate[i - 1])), b = rbSalienceSummary(report(byDate[i]));
  if (!a || !b) continue;
  for (const [k, [cur]] of Object.entries(a.issues)) {
    const prev = b.issues[k] && b.issues[k][1];
    if (!cur || !prev) continue;
    for (const q of Object.keys(cur)) assert.ok(Math.abs(cur[q] - prev[q]) <= 1, `${byDate[i - 1]} ${k} ${q}: own report and next report's reprint agree`);
    compared++;
  }
}
assert.ok(compared >= 50, `the cached reports reprint enough waves to compare (${compared})`);

// ---- labels ---------------------------------------------------------------------
assert.equal(rbIssue("The rate of immigration"), "immigration");
assert.equal(rbIssue("immigration"), "immigration");
assert.equal(rbIssue("The environment"), "environment", "climate change and the environment are two issues");
assert.equal(rbIssue("Something else"), null);

// ---- the gate --------------------------------------------------------------------
assert.match(salienceProblem({ r1: 40, r2: 20, r3: 10, top3: 75 }), /don't make top three/);
assert.match(salienceProblem({ r1: 40, r2: 20, r3: 10, not: 20 }), /sum to 90/);
assert.match(ownershipProblem({ alp: 30, lnp: 30, onp: 30, unsure: 30 }), /sum to 120/);
assert.match(ownershipProblem({ onp: 50, unsure: 50 }), /no Labor or Coalition/);

// ---- Resolve: the file's known quirks ---------------------------------------------
const csv = ["dataset,question_id,question,visual,answer,dimension,key,date,value_pct,parties",
  // an item not asked that month: every option 0
  ...["The Liberals", "Labor", "Someone else", "Undecided"].map((a) => `party_attributes,,,,${a},category,Energy\\, inc. renewables and nuclear,2021-04-16,0,`),
  ...[["The Liberals", 30], ["Labor", 35], ["Someone else", 10], ["Undecided", 25]].map(([a, v]) => `party_attributes,,,,${a},category,Economic management,2021-04-16,${v},`),
  // July 2026: the older copy's four options, One Nation folded into someone else, beside the decimal One Nation
  ...[["The Liberals", 28], ["Labor", 26], ["Someone else", 30], ["Undecided", 17], ["One Nation", 19.92]].map(([a, v]) => `party_attributes,,,,${a},category,Economic management,2026-07-12,${v},`),
  // one item under two labels: decimals and whole numbers, agreeing within rounding
  ...[["The Liberals", 16.62], ["Labor", 23.01], ["Someone else", 27.88], ["Undecided", 32.48]].map(([a, v]) => `party_attributes,,,,${a},category,Issues affecting Aborigines and Torres Strait Islanders,2026-06-14,${v},`),
  ...[["The Liberals", 17], ["Labor", 23], ["Someone else", 28], ["Undecided", 32]].map(([a, v]) => `party_attributes,,,,${a},category,Issues affecting Indigenous Australians and Torres Strait Islanders,2026-06-14,${v},`),
  // two known labels for the one item that disagree: a clash
  ...[["The Liberals", 20.5], ["Labor", 30.2], ["Someone else", 19.8], ["Undecided", 29.5]].map(([a, v]) => `party_attributes,,,,${a},category,Issues affecting Aborigines and Torres Strait Islanders,2026-05-10,${v},`),
  ...[["The Liberals", 26], ["Labor", 30], ["Someone else", 14], ["Undecided", 30]].map(([a, v]) => `party_attributes,,,,${a},category,Issues affecting Aboriginal and Torres Strait Islander people,2026-05-10,${v},`),
  // and a label nobody mapped
  ...[["The Liberals", 20], ["Labor", 30], ["Someone else", 20], ["Undecided", 30]].map(([a, v]) => `party_attributes,,,,${a},category,Housing affordability and rent (dup),2026-05-10,${v},`),
].join("\n").replace(/\\,/g, "\u0001");
// the one quoted label, written the way the real file quotes it
const rs = resolveOwnership(csv.replace(/Energy\u0001 inc\. renewables and nuclear/g, '"Energy, inc. renewables and nuclear"'));
const w21 = rs.waves.find((w) => w.date === "2021-04-16");
assert.ok(w21 && !w21.issues.energy && w21.issues.economy, "an all-zero item wasn't asked and is left out");
const w7 = rs.waves.find((w) => w.date === "2026-07-12");
assert.deepEqual(w7.issues.economy, { lnp: 28, alp: 26, oth: 10.08, unsure: 17, onp: 19.92 },
  "July: One Nation taken back out of someone else, so the options make 100");
assert.equal(ownershipProblem(w7.issues.economy), null);
assert.ok(w7.note, "and the wave says so");
const w6 = rs.waves.find((w) => w.date === "2026-06-14");
assert.deepEqual(w6.issues.indigenous, { lnp: 16.62, alp: 23.01, oth: 27.88, unsure: 32.48 }, "the decimals win");
assert.ok(!rs.clash.some((c) => c.startsWith("2026-06-14")), "whole numbers within rounding of the decimals are no clash");
assert.ok(rs.clash.some((c) => c.startsWith("2026-05-10 indigenous")), "two labels that disagree are a clash: " + JSON.stringify(rs.clash));
assert.ok(rs.unknown.includes("Housing affordability and rent (dup)"), "a label it doesn't know is reported, not guessed");

// ---- YouGov: the News24 Pulse issues chart ------------------------------------------
const fx = (d, id) => infographicDataOf(fs.readFileSync(`.build/news24-src/ig-fixtures-${d}/ig-${id}.html`, "utf8"));
const yg = ygIssuesOf(fx("2026-08-24", "TBlBtAE3k0f4YBE6MIpF"));
assert.equal(Object.keys(yg.issues).length, 12);
assert.deepEqual(yg.issues.col, { alp: 24, lnp: 20, onp: 22, grn: 9, unsure: 25 });
assert.deepEqual(yg.issues.economy, { alp: 25, lnp: 28, onp: 17, grn: 7, unsure: 23 }, "'Managing the Economy and Debt' is economic management");
assert.equal(yg.unknown.length, 0);
for (const [k, sh] of Object.entries(yg.issues)) assert.equal(ownershipProblem(sh), null, `YouGov ${k} passes the gate`);
assert.equal(ygIssuesOf(fx("2026-09-08", "2uuEmz9Frirmdp7kioDC")), null, "another chart (immigration views) isn't taken for it");
assert.equal(ygIssuesOf(fx("2026-08-24", "YM46DvOTftyx9pNzV67y")), null, "nor the crosstab");

console.log(`test-issues: ok (${compared} reprinted readings agree)`);
