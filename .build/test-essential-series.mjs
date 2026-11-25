import assert from "node:assert/strict";
import fs from "node:fs";
import { shouldCrawlReport } from "./essential-series.mjs";

const before = { r1: "2026-09-29T22:04:46", r2: "2026-10-27T10:05:00" };
assert.equal(shouldCrawlReport(
  { id: 1, link: "https://essentialreport.com.au/reports/federal-political-insights", modified: before.r1 },
  before, () => false,
), true, "running vote series is read despite an unchanged WP timestamp");
assert.equal(shouldCrawlReport(
  { id: 2, link: "https://essentialreport.com.au/reports/28-october-2026", modified: before.r2 },
  before, () => false,
), false, "an unchanged dated report still benefits from preflight skipping");
assert.equal(shouldCrawlReport(
  { id: 2, link: "https://essentialreport.com.au/reports/28-october-2026", modified: "2026-11-01T00:00:00" },
  before, () => false,
), true, "a post that actually moved is still selected");
// The running-series reader must actually place primaries and 2PP in the
// canonical mirror, not merely include its URL in the crawl list.
const csv = fs.readFileSync("data/essential-report.csv", "utf8").trim().split("\n");
for (const [dataset, id, expected] of [
  ["primary", "12668441", { Labor: 26, "TOTAL: Coalition": 25, Greens: 13, "One Nation": 26, "Independent or Other Party": 5, Undecided: 5 }],
  ["2pp", "12668584", { Labor: 45, "TOTAL: Coalition": 51, Undecided: 5 }],
]) {
  const rows = csv.filter((line) => line.startsWith(`${dataset},${id},`) && line.includes(",Overall,"))
    .filter((line) => line.split(",")[7] === "2026-11-25");
  assert.ok(rows.length, `${dataset}'s 25-Nov series is in the normal CSV mirror`);
  assert.deepEqual(Object.fromEntries(rows.map((line) => {
    const cells = line.split(",");
    assert.equal(cells[7], "2026-11-25");
    return [cells[4], Number(cells[8])];
  })), expected);
}
console.log("test-essential-series: ok");
