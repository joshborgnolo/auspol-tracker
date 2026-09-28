/* Tests for extract-secnewgate.mjs – the SEC Newgate "Mood of the Nation"
   reader behind the National-direction panel's SEC Newgate rows –
   against the cached reports (.build/secnewgate-src, tracked) and synthetic
   media-API items for the discovery rules.
   Run: node .build/test-secnewgate.mjs */
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { titleMonthOf, pickReports, methodologyOf, directionPageOf, directionChartOf }
  from "./extract-secnewgate.mjs";

const SRC = ".build/secnewgate-src";
const reports = fs.readdirSync(SRC).filter((f) => f.endsWith(".json"))
  .map((f) => ({
    slug: f.replace(/\.json$/, ""),
    sidecar: JSON.parse(fs.readFileSync(path.join(SRC, f), "utf8")),
  }))
  .sort((a, b) => a.sidecar.wave - b.sidecar.wave);
assert.equal(reports.length, 7, "the cached wave set (Jul 2025 on)");

// ---- the cache facts, pinned ------------------------------------------------
assert.deepEqual(reports.map((r) => [r.sidecar.wave, r.sidecar.date, r.sidecar.dateStart, r.sidecar.sample]), [
  [21, "2025-07-16", "2025-07-08", 1855],
  [22, "2025-09-15", "2025-09-09", 1212],
  [23, "2025-11-03", "2025-10-29", 1208],
  [24, "2026-02-09", "2026-02-02", 2166],
  [25, "2026-05-18", "2026-05-13", 1210],
  [26, "2026-07-13", "2026-07-02", 1975],
  [27, "2026-09-14", "2026-09-08", 1659],
], "the sidecars the extractor wrote");

// ---- titleMonthOf ------------------------------------------------------------
assert.equal(titleMonthOf("SEC Newgate Mood of the Nation &#8211; September 2026 Report"), "2026-09",
  "the &#8211; entity decodes");
assert.equal(titleMonthOf("SEC-Newgate-Mood-of-the-Nation-Report-November-2025"), "2025-11",
  "dashed title");
assert.equal(titleMonthOf("SEC Newgate Mood of the Nation National Report -November-24- EMBARGOED"), "2024-11",
  "a two-digit year is the survey's own era (2022 on)");
assert.equal(titleMonthOf("SEC Newgate Mood of the Nation Report"), null, "no month");
assert.equal(titleMonthOf("SEC Newgate Omnibus Poll March 2024"), "2024-03",
  "any month+year extracts; the Mood-of-the-Nation and report filters are pickReports' job");

// ---- pickReports ---------------------------------------------------------------
const item = (rendered, url) => ({ title: { rendered }, source_url: url });
const picked = pickReports([
  item("SEC Newgate Mood of the Nation &#8211; September 2026 Report",
    "https://www.secnewgate.com.au/wp-content/uploads/2026/09/SEC-Newgate-Mood-of-the-Nation-September-2026-Report.pdf"),
  item("SEC Newgate Mood of the Nation &#8211; September 2026 Report &#8211; EMBARGOED",
    "https://www.secnewgate.com.au/wp-content/uploads/2026/09/SEC-Newgate-Mood-of-the-Nation-September-2026-Report-EMBARGOED.pdf"),
  item("SEC Newgate Mood of the Nation &#8211; Special Edition April 2026 Report",
    "https://www.secnewgate.com.au/wp-content/uploads/2026/04/SEC-Newgate-Mood-of-the-Nation-Special-Edition-April-2026-Report.pdf"),
  item("SEC Newgate Mood of the Nation &#8211; Queensland Edition Report September 2026",
    "https://www.secnewgate.com.au/wp-content/uploads/2026/09/SEC-Newgate-Mood-of-the-Nation-Queensland-Edition-Report-September-2026.pdf"),
  item("SEC Newgate Mood of the Nation National Report -November-24- EMBARGOED",
    "https://www.secnewgate.com.au/wp-content/uploads/2024/11/Mood-of-the-Nation-Report-November-2024-EMBARGOED.pdf"),
  item("SEC Newgate Mood of the Nation &#8211; September 2026 Report",
    "https://www.secnewgate.com.au/wp-content/uploads/2026/09/mood-of-the-nation-september-2026.mp4"),
  item("Mood of the Nation infographic &#8211; September 2026",
    "https://www.secnewgate.com.au/wp-content/uploads/2026/09/infographic.pdf"),
]);
assert.deepEqual(picked, [{
  ym: "2026-09",
  urls: ["https://www.secnewgate.com.au/wp-content/uploads/2026/09/SEC-Newgate-Mood-of-the-Nation-September-2026-Report.pdf"],
}], "the clean report only: embargoed twin set aside, specials and Queensland out, pre-2025-07 out, non-PDFs out");

const onlyEmbargoed = pickReports([
  item("SEC Newgate Mood of the Nation Report -August-25- EMBARGOED",
    "https://www.secnewgate.com.au/wp-content/uploads/2025/08/Mood-of-the-Nation-Report-August-2025-EMBARGOED.pdf"),
]);
assert.equal(onlyEmbargoed.length, 1, "an embargoed upload is used when it is the only one");

// ---- methodologyOf, directionPageOf, directionChartOf against the cache ---------
for (const { slug, sidecar } of reports) {
  const text = fs.readFileSync(path.join(SRC, slug + ".txt"), "utf8");
  const meta = methodologyOf(text);
  assert.ok(meta, `${slug}: a tracking wave`);
  assert.equal(meta.wave, sidecar.wave, `${slug}: wave`);
  assert.deepEqual([meta.date, meta.dateStart, meta.sample],
    [sidecar.date, sidecar.dateStart, sidecar.sample], `${slug}: fieldwork + sample`);
  assert.deepEqual(meta.problems, [], `${slug}: methodology clean`);
  assert.equal(directionPageOf(text), 8, `${slug}: the direction chart's page`);

  const chart = directionChartOf(fs.readFileSync(path.join(SRC, slug + ".bbox.html"), "utf8"));
  assert.equal(chart.columns.length, sidecar.wave, `${slug}: one column per wave of the series`);
  assert.deepEqual(chart.problems, [], `${slug}: chart clean`);
  const last = chart.columns[chart.columns.length - 1];
  sidecar.endpoint = { right: last.right, wrong: last.wrong };
}
// the seven endpoints, pinned
assert.deepEqual(reports.map((r) => [r.sidecar.wave, r.sidecar.endpoint.wrong, r.sidecar.endpoint.right]), [
  [21, 56, 44], [22, 59, 41], [23, 61, 39], [24, 63, 37],
  [25, 66, 34], [26, 68, 32], [27, 68, 32],
]);

// a special asks no direction question at all
const special = "\fcover\n\fThe findings\n\nNo direction question was asked.\f";
assert.equal(methodologyOf("no wave ordinal here\n" + special), null, "a special: no tracking marker");
assert.equal(directionPageOf(special), 0, "a special: no direction page");

// the newest chart's series reprints history: every earlier wave's own
// endpoint sits at series[wave-1] of the newest report's chart
{
  const newest = reports[reports.length - 1];
  const series = directionChartOf(fs.readFileSync(path.join(SRC, newest.slug + ".bbox.html"), "utf8")).columns;
  for (const r of reports) {
    if (r === newest) continue;
    const s = series[r.sidecar.wave - 1];
    assert.ok(s, `${r.slug}: in the newest series`);
    assert.deepEqual(s, { wrong: r.sidecar.endpoint.wrong, right: r.sidecar.endpoint.right },
      `${r.slug}: endpoint agrees with the wave-${newest.sidecar.wave} chart`);
  }
}

// ---- polls.json carries exactly these rows --------------------------------------
{
  const D = JSON.parse(fs.readFileSync("data/polls.json", "utf8"));
  const mine = (D.direction || []).filter((d) => d.pollster === "SEC Newgate");
  assert.deepEqual(mine, reports.map((r) => ({
    date: r.sidecar.date, dateStart: r.sidecar.dateStart, pollster: "SEC Newgate",
    right: r.sidecar.endpoint.right, wrong: r.sidecar.endpoint.wrong,
    unsure: 100 - r.sidecar.endpoint.right - r.sidecar.endpoint.wrong,
  })), "the SEC Newgate direction rows, date-sorted, match the cached reports");
}

console.log("test-secnewgate: all assertions passed");
