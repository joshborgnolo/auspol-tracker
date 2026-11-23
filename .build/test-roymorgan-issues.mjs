/* Offline pins for the Roy Morgan historical issue store. No network calls. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  AUSTRALIA_QUESTION, WORLD_QUESTION, PICK_THREE_QUESTION,
  buildStore, discoverFindings, nextData, parseCell, parsePickThree, postOf,
} from "./extract-roymorgan-issues.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const SRC = path.join(HERE, "roymorgan-issues-src");
const OUT = path.join(ROOT, "data", "roymorgan-issues.json");
const data = buildStore();
const open = data.families.openNomination;
const pick = data.families.pickThree;
const table = (id) => {
  const found = open.tables.find((t) => t.id === id);
  assert.ok(found, `missing table ${id}`);
  return found;
};
const row = (t, label, occurrence = 1) => {
  const found = t.rows.filter((r) => r.label === label)[occurrence - 1];
  assert.ok(found, `${t.id}: missing ${label} #${occurrence}`);
  return found;
};
const source = (finding) => data.sources.find((s) => s.finding === finding);
const period = (scope, month) => open.nationalPeriods.find((p) => p.scope === scope && p.period.month === month);
const shareOf = (r, column, kind = "number") => {
  const cell = r.cells[column];
  assert.equal(cell.kind, kind, `${r.label} column ${column}`);
  return cell.share;
};

assert.equal(data.schemaVersion, 1);
assert.equal(data.pollster, "Roy Morgan");
assert.equal(data.sources.length, 9);
assert.equal(open.tables.length, 10);
assert.equal(open.nationalPeriods.length, 30);
assert.equal(pick.waves.length, 2);
assert.deepEqual([...new Set(open.tables.map((t) => t.finding))], [6059, 7187, 7264, 7424]);
assert.deepEqual(data.coverage.htmlTableFindings, [6059, 7187, 7264, 7424]);
assert.deepEqual(data.coverage.economicBreakdownPeriods, ["2017-05", "2018-02"]);
console.log("1. Selected sources and complete table inventory: OK");

const months = ["2013-01", "2013-04", "2013-07", "2013-08", "2013-10", "2014-02", "2014-06", "2014-10", "2015-01", "2015-04", "2015-07", "2015-10", "2016-05", "2016-10", "2017-03"];
for (const scope of ["Australia", "World"]) {
  const printed = open.nationalPeriods.filter((p) => p.scope === scope).map((p) => p.period.month);
  assert.deepEqual(printed, months);
  assert.deepEqual(data.coverage.nationalPeriods[scope].printed, months);
  assert.equal(data.coverage.nationalPeriods[scope].first, "2013-01");
  assert.equal(data.coverage.nationalPeriods[scope].last, "2017-03");
}
assert.equal(period("Australia", "2013-02"), undefined);
assert.equal(period("World", "2017-04"), undefined);
assert.equal(open.questions.Australia, AUSTRALIA_QUESTION);
assert.equal(open.questions.World, WORLD_QUESTION);
assert.equal(pick.question, PICK_THREE_QUESTION);
console.log("2. Exact printed ranges, with Australia and World as separate scopes/questions: OK");

const au2015 = table("6059-table-0");
const world2015 = table("6059-table-2");
assert.equal(au2015.heading, "Most Important Problem Facing Australia");
assert.equal(world2015.heading, "Most Important Problem Facing the World");
assert.deepEqual(au2015.sourceHeaderRows[1], ["", "Jan 2013", "Apr 2013", "July 2013", "Aug 2013", "Oct 2013", "Feb 2014", "Jun 2014", "Oct 2014", "Jan 2015"]);
assert.deepEqual(world2015.sourceHeaderRows[0], ["Most Important Problem Facing the World", "The World"]);
assert.deepEqual(table("6059-table-1").sourceHeaderRows[1], ["", "Jan 2015", "STATES", "CITY/COUNTRY"]);
assert.deepEqual(table("6059-table-1").sourceHeaderRows[2], ["NSW", "VIC", "QLD", "WA", "SA", "TAS#", "CITY", "COUNTRY"]);
assert.equal(table("6059-table-1").columns.at(-1).dimension, "CITY/COUNTRY");
assert.equal(table("7187-table-2").heading, "Australia");
assert.deepEqual(table("7187-table-2").sourceHeaderRows[1], ["", "Mar 2017", "Sex"]);
assert.deepEqual(table("7187-table-2").sourceHeaderRows[2], ["Men", "Women"]);
assert.deepEqual(table("7187-table-3").sourceHeaderRows[1], ["", "Jun 2014", "Oct 2014", "Jan 2015", "Apr 2015", "July 2015", "Oct 2015", "May 2016", "Oct 2016", "Mar 2017"]);
assert.equal(row(au2015, "TOTAL Economic/ Financial issues (INCLUDING Carbon Tax)").cells[8].share, 38);
assert.equal(row(world2015, "TOTAL Economic/ Financial issues (INCLUDING Carbon Tax)").cells[8].share, 19);
assert.equal(row(world2015, "Terrorism").cells[8].share, 35);
assert.equal(row(world2015, "Wars and conflicts").cells[8].share, 5);
assert.ok(table("6059-table-0").rows.some((r) => r.label === "Poverty, & Gap between rich and poor"));
// Duplicate printed labels stay separate rows rather than becoming issue ids.
assert.equal(au2015.rows.filter((r) => r.label === "Disapprove Carbon Tax").length, 2);
console.log("3. Source headings, state/city-country breakdowns, exact labels and scope figures: OK");

for (const scope of ["Australia", "World"]) {
  const jan = period(scope, "2015-01");
  assert.equal(jan.read.finding, 7187);
  assert.equal(jan.reprints.length, 1);
  assert.equal(jan.reprints[0].finding, 6059);
  const jun = period(scope, "2014-06");
  assert.equal(jun.reprints.length, 1);
  assert.equal(jun.reprints[0].finding, 6059);
  const feb = period(scope, "2014-02");
  assert.equal(feb.read.finding, 6059);
  assert.equal(feb.reprints.length, 0);
}
const keys = open.nationalPeriods.map((p) => `${p.scope}|${p.period.month}`);
assert.equal(new Set(keys).size, keys.length);
assert.ok(open.nationalPeriods.every((p) => !p.reprintDifferences?.length));
for (const p of open.nationalPeriods) {
  const referenced = table(p.read.tableId);
  assert.equal(referenced.scope, p.scope);
  assert.equal(referenced.columns[p.read.column].period.month, p.period.month);
  assert.equal(referenced.kind, "national-trend");
}
console.log("4. Reprint-aware wave dedupe and conflict-free national index: OK");

assert.deepEqual(parseCell("17.5"), { raw: "17.5", kind: "number", share: 17.5 });
assert.deepEqual(parseCell("*"), { raw: "*", kind: "less-than-1", share: null, upperBound: 1 });
assert.deepEqual(parseCell("–"), { raw: "–", kind: "dash", share: null });
assert.deepEqual(parseCell(""), { raw: "", kind: "blank", share: null });
assert.deepEqual(parseCell("n/a"), { raw: "n/a", kind: "not-applicable", share: null });
assert.deepEqual(parseCell("<0.5"), { raw: "<0.5", kind: "less-than", share: null, upperBound: 0.5 });
assert.throws(() => parseCell("not printed"), /unrecognised/);
assert.equal(row(world2015, "Social Welfare/ Welfare Dependency").cells[0].kind, "not-applicable");
assert.equal(row(world2015, "Social Welfare/ Welfare Dependency").cells[0].share, null);
assert.equal(row(world2015, "Social Welfare/ Welfare Dependency").cells[6].share, 1);
const star = au2015.rows.flatMap((r) => r.cells).find((c) => c.kind === "less-than-1");
assert.equal(star.upperBound, 1);
assert.equal(star.share, null);
const federalBudget = row(table("7187-table-4"), "Federal Budget");
assert.deepEqual(federalBudget.cells.map((c) => c.kind), ["dash", "blank", "blank"]);
assert.ok(!federalBudget.cells.some((c) => c.share === 0));
const allCells = open.tables.flatMap((t) => t.rows.flatMap((r) => r.cells));
for (const kind of ["number", "less-than-1", "dash", "blank", "not-applicable"]) assert.ok(allCells.some((c) => c.kind === kind), `no ${kind} cells retained`);
console.log("5. Numeric, star, dash, literal blank and n/a distinctions: OK");

for (const t of open.tables) {
  const total = t.rows.find((r) => r.kind === "grand-total");
  if (total) for (const cell of total.cells) {
    assert.equal(cell.kind, "number");
    assert.equal(cell.share, 100, `${t.id}: printed TOTAL`);
  }
  assert.ok(t.checks.totalRowResiduals.every((c) => c.residual === 0));
  assert.ok(t.checks.aggregateResiduals.every((c) => Math.abs(c.residual) <= 2.01));
  assert.ok(t.checks.economicTotalResiduals.every((c) => Math.abs(c.residual) <= c.roundingTolerance));
}
assert.equal(table("7264-table-0").checks.economicTotalResiduals.length, 3);
assert.equal(table("7424-table-0").checks.economicTotalResiduals.length, 4);
assert.equal(row(table("7264-table-0"), "Unemployment").cells[0].share, 8.8);
assert.equal(row(table("7264-table-0"), "TOTAL ECONOMIC/ FINANCIAL ISSUES").cells[0].share, 37.9);
assert.equal(row(table("7424-table-0"), "Unemployment").cells[0].share, 7.3);
assert.equal(row(table("7424-table-0"), "TOTAL ECONOMIC/ FINANCIAL ISSUES").cells[0].share, 32.3);
// These columns have printed dashes. They are not silently coerced to zero to
// make an otherwise incoherent total pass.
assert.ok(table("7264-table-0").checks.economicTotalResiduals.every((c) => c.column !== 3));
console.log("6. Printed totals and numeric-only component constraints: OK");

assert.equal(source(6059).sample, 604);
assert.equal(source(6059).fieldwork, "January 12-13, 2015");
assert.equal(source(6059).mode, "telephone");
assert.equal(source(7187).sample, 622);
assert.equal(source(7264).sample, 648);
assert.equal(source(7424).sample, 650);
assert.equal(source(7504).sample, 650);
assert.equal(source(7504).fieldwork, "February 6-8, 2018");
assert.equal(source(8044).sample, 638);
assert.equal(source(8044).fieldwork, "June 2019");
assert.equal(source(8184).sample, 1054);
assert.equal(source(8184).mode, "online");
assert.equal(source(8829).sample, 1024);
assert.equal(source(8829).fieldwork, "September 15-20, 2021");
assert.match(source(8829).pdfUrl, /8829-Most-Important-Problems-Facing-Australia-World-October-2021\.pdf$/);
assert.match(source(8829).reportRole, /2021 annual report/);
assert.equal(open.tables.some((t) => t.finding === 8829), false);
assert.equal(open.nationalPeriods.some((p) => p.period.month.startsWith("2021-")), false);
assert.ok(data.coverage.limits.some((s) => /PNG line charts/.test(s) && /2005-2021/.test(s)));
assert.ok(data.coverage.limits.some((s) => /2021 annual report/.test(s) && /not a reconstructed time series/.test(s)));
const discovery = discoverFindings();
assert.equal(discovery.totalPages, 262);
assert.equal(discovery.rowsScanned, 2619);
assert.equal(discovery.selected.length, 9);
assert.deepEqual(discovery.selected.filter((s) => s.availability.startsWith("html-")).map((s) => s.finding), [6059, 7187, 7264, 7424]);
console.log("7. Source-fieldwork provenance, discovery and PNG/2021 coverage limits: OK");

assert.equal(pick.responseMode, "Pick three issues; no ranks");
assert.deepEqual(pick.waves.map((w) => w.period.id), ["2022-Q2", "2024-Q3"]);
assert.deepEqual(pick.waves.map((w) => w.sample), [14522, 14713]);
const labelList = ["Keeping day to day living costs down", "Improving health services and hospitals", "Reducing crime and maintaining law and order", "Global warming and climate change", "Managing the economy", "Keeping interest rates down", "Open and honest government", "Reducing the taxes you and your family pay", "Improving education", "Managing immigration and population growth"];
for (const wave of pick.waves) {
  assert.deepEqual(wave.issues.map((issue) => issue.label), labelList);
  for (const issue of wave.issues) {
    assert.equal(Object.hasOwn(issue, "rank"), false);
    assert.equal(Object.hasOwn(issue, "ranks"), false);
  }
}
const issueAt = (waveIndex, label) => pick.waves[waveIndex].issues.find((issue) => issue.label === label);
assert.equal(issueAt(0, "Keeping day to day living costs down").share, 50);
assert.equal(issueAt(1, "Keeping day to day living costs down").share, 57);
assert.equal(issueAt(0, "Improving health services and hospitals").share, 33);
assert.equal(issueAt(1, "Improving health services and hospitals").share, 31);
assert.equal(issueAt(0, "Reducing crime and maintaining law and order").share, 13);
assert.equal(issueAt(1, "Reducing crime and maintaining law and order").share, 23);
assert.equal(issueAt(0, "Global warming and climate change").share, 32);
assert.equal(issueAt(1, "Global warming and climate change").share, 23);
assert.equal(issueAt(0, "Managing the economy").share, 20);
assert.equal(issueAt(1, "Managing the economy").share, 22);
assert.equal(issueAt(0, "Keeping interest rates down").share, 11);
assert.equal(issueAt(1, "Keeping interest rates down").share, 19);
assert.equal(issueAt(0, "Open and honest government").share, 25);
assert.equal(issueAt(1, "Open and honest government").share, 19);
assert.equal(issueAt(0, "Reducing the taxes you and your family pay").share, 15);
assert.equal(issueAt(1, "Reducing the taxes you and your family pay").share, 15);
assert.equal(issueAt(0, "Improving education").share, 13);
assert.equal(issueAt(1, "Improving education").share, 14);
assert.equal(issueAt(0, "Managing immigration and population growth").share, 6);
assert.equal(issueAt(1, "Managing immigration and population growth").share, 14);
assert.equal(pick.changes.issues.length, 10);
assert.deepEqual(pick.changes.issues.map((c) => c.signedPoints), [7, -2, 10, -9, 2, 8, -6, 0, 1, 8]);
assert.notEqual(pick.id, open.id);
assert.ok(!open.nationalPeriods.some((p) => ["2022-Q2", "2024-Q3"].includes(p.period.month)));
console.log("8. Separate unranked pick-three family with both complete printed waves: OK");

const mini = { props: { pageProps: { findingData: { postBy: { content: "<p>Cached</p>" } } } } };
const parsed = nextData(`<html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(mini)}</script></html>`, "fixture");
assert.equal(postOf(parsed).content, "<p>Cached</p>");
const cachedContent = fs.readFileSync(path.join(SRC, "finding-9797.content.html"), "utf8");
assert.deepEqual(parsePickThree(cachedContent), { heading: pick.heading, population: pick.population, scope: pick.scope, waves: pick.waves, changes: pick.changes });
const once = JSON.stringify(buildStore());
const twice = JSON.stringify(buildStore());
assert.equal(once, twice);
assert.equal(fs.readFileSync(OUT, "utf8"), JSON.stringify(data, null, 2) + "\n");
const status = execFileSync(process.execPath, [path.join(HERE, "extract-roymorgan-issues.mjs"), "--check"], { cwd: ROOT, encoding: "utf8" });
assert.match(status, /RM_ISSUES_STATUS \{"changed":false/);
console.log("9. Producer Next.js path, deterministic regeneration, disk parity and --check idempotence: OK");
console.log("test-roymorgan-issues: all OK");
