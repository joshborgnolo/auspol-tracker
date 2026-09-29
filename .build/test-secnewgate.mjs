/* Tests for extract-secnewgate.mjs – the SEC Newgate "Mood of the Nation"
   reader behind the National-direction panel's SEC Newgate rows –
   against the cached reports (.build/secnewgate-src, tracked) and synthetic
   media-API items for the discovery rules.
   Run: node .build/test-secnewgate.mjs */
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { titleMonthOf, pickReports, methodologyOf, directionPageOf, directionChartOf, stateTableOf, concernTableOf }
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
assert.deepEqual(reports.map((r) => [r.sidecar.wave, r.sidecar.url, r.sidecar.published]), [
  [21, "https://www.secnewgate.com.au/sec-newgate-mood-of-the-nation-report-july-2025/", "2025-07-29T16:58"],
  [22, "https://www.secnewgate.com.au/sec-newgate-mood-of-the-nation-report-september-2025/", "2025-09-24T11:16"],
  [23, "https://www.secnewgate.com.au/sec-newgate-mood-of-the-nation-report-november-2025/", "2025-11-10T17:24"],
  [24, "https://www.secnewgate.com.au/sec-newgate-mood-of-the-nation-report-february-2026-1/", "2026-02-17T16:51"],
  [25, "https://www.secnewgate.com.au/sec-newgate-mood-of-the-nation-report-may-2026-2/", "2026-05-27T13:03"],
  [26, "https://www.secnewgate.com.au/sec-newgate-mood-of-the-nation-report-july-2026/", "2026-07-21T16:50"],
  [27, "https://www.secnewgate.com.au/sec-newgate-mood-of-the-nation-september-2026-report/", "2026-09-22T15:29"],
], "the sidecar release links and publish stamps (site-local times)");

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
const item = (rendered, url, rest) => ({ title: { rendered }, source_url: url, ...rest });
const picked = pickReports([
  item("SEC Newgate Mood of the Nation &#8211; September 2026 Report",
    "https://www.secnewgate.com.au/wp-content/uploads/2026/09/SEC-Newgate-Mood-of-the-Nation-September-2026-Report.pdf",
    { link: "https://www.secnewgate.com.au/report-september-2026/", date: "2026-09-22T15:29:00" }),
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
  urls: [{
    url: "https://www.secnewgate.com.au/wp-content/uploads/2026/09/SEC-Newgate-Mood-of-the-Nation-September-2026-Report.pdf",
    page: "https://www.secnewgate.com.au/report-september-2026/",
    published: "2026-09-22T15:29",
  }],
}], "the clean report only, with its article page and upload time: embargoed twin set aside, specials and Queensland out, pre-2025-07 out, non-PDFs out");

const onlyEmbargoed = pickReports([
  item("SEC Newgate Mood of the Nation Report -August-25- EMBARGOED",
    "https://www.secnewgate.com.au/wp-content/uploads/2025/08/Mood-of-the-Nation-Report-August-2025-EMBARGOED.pdf"),
]);
assert.equal(onlyEmbargoed.length, 1, "an embargoed upload is used when it is the only one");
assert.deepEqual(onlyEmbargoed[0].urls[0],
  { url: "https://www.secnewgate.com.au/wp-content/uploads/2025/08/Mood-of-the-Nation-Report-August-2025-EMBARGOED.pdf",
    page: null, published: null },
  "an item with no link/date still yields nulls, not a crash");

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

// ---- stateTableOf against the cache: the per-state direction table -------------
// each report's table = a MAR ’22 anchor + the wave's own and its two
// predecessors' tracking waves (the April 2026 special asked no direction
// question, which is why May 2026's window reaches back to Nov 2025)
const STATE_COLUMNS = {
  21: ["2022-03", "2025-02", "2025-04", "2025-07"],
  22: ["2022-03", "2025-04", "2025-07", "2025-09"],
  23: ["2022-03", "2025-07", "2025-09", "2025-11"],
  24: ["2022-03", "2025-09", "2025-11", "2026-02"],
  25: ["2022-03", "2025-11", "2026-02", "2026-05"],
  26: ["2022-03", "2026-02", "2026-05", "2026-07"],
  27: ["2022-03", "2026-05", "2026-07", "2026-09"],
};
const stateRights = {}, statePairs = {};
for (const { slug, sidecar } of reports) {
  const t = stateTableOf(fs.readFileSync(path.join(SRC, slug + ".bbox.html"), "utf8"));
  assert.deepEqual(t.problems, [], `${slug}: state table clean`);
  assert.deepEqual(t.columns, STATE_COLUMNS[sidecar.wave], `${slug}: anchor + trailing tracking waves`);
  assert.deepEqual(Object.keys(t.states), ["NSW", "VIC", "QLD", "SA", "WA"], `${slug}: the five mainland states`);
  const ownYm = sidecar.date.slice(0, 7);
  assert.equal(t.columns[t.columns.length - 1], ownYm, `${slug}: last column is its own wave's month`);
  for (const [st, row] of Object.entries(t.states)) {
    assert.equal(row.right, row.cells[ownYm], `${slug} ${st}: the pair's right == its own column`);
    assert.equal(row.right + row.wrong, 100, `${slug} ${st}: the pair sums to 100`);
    for (const [ym, v] of Object.entries(row.cells)) ((stateRights[st] ||= {})[ym] ||= []).push(v);
    (statePairs[st] ||= {})[ownYm] = { right: row.right, wrong: row.wrong };
  }
}
// the trailing reprint columns repeat the waves' own values verbatim – no
// state-direction revisions on file
for (const [st, months] of Object.entries(stateRights))
  for (const [ym, vals] of Object.entries(months))
    assert.deepEqual([...new Set(vals)], [statePairs[st]?.[ym]?.right ?? vals[0]],
      `${st} ${ym}: every reprint agrees with the wave's own report`);

// data/sec-direction-states.json carries exactly what the cached reports
// print, merged the way the extractor merges it
{
  const expectSeries = {};
  for (const st of ["NSW", "VIC", "QLD", "SA", "WA"]) {
    expectSeries[st] = Object.keys(stateRights[st]).sort().map((ym) => {
      const pair = statePairs[st]?.[ym];
      return pair ? { month: ym, right: pair.right, wrong: pair.wrong }
                  : { month: ym, right: stateRights[st][ym][stateRights[st][ym].length - 1] };
    });
  }
  const banked = JSON.parse(fs.readFileSync("data/sec-direction-states.json", "utf8"));
  assert.deepEqual(banked.states, ["NSW", "VIC", "QLD", "SA", "WA"], "the sidecar's state order");
  assert.deepEqual(banked.series, expectSeries,
    "the banked state series matches the cached reports (rerun extract-secnewgate.mjs)");
  assert.deepEqual(banked.series.NSW.map((e) => e.month), [
    "2022-03", "2025-02", "2025-04", "2025-07", "2025-09",
    "2025-11", "2026-02", "2026-05", "2026-07", "2026-09",
  ], "the anchor, the two pre-horizon reprints and the seven cached waves");
  assert.ok(banked.series.NSW.every((e) => (e.wrong == null) === (e.month < "2025-07")),
    "before the 2025-07 cache horizon the entries are right-direction-only reprints");
  assert.deepEqual(banked.series.VIC.find((e) => e.month === "2026-09"),
    { month: "2026-09", right: 26, wrong: 74 }, "Victoria's equal-record-low wave");
  for (const st of banked.states)
    for (const e of banked.series[st])
      if (e.wrong != null) assert.equal(e.right + e.wrong, 100, `${st} ${e.month}: pair sums to 100`);
}

// ---- concernTableOf against the cache: the B1 unprompted-concerns table --------
// each report's grid = a MAR ’22 anchor + the wave's own and its two
// predecessors' B1 months; unlike direction, the April 2026 special DID
// ask B1, so 2026-04 appears in the May and July 2026 grids
const CONCERN_COLUMNS = {
  21: ["2022-03", "2025-02", "2025-04", "2025-07"],
  22: ["2022-03", "2025-04", "2025-07", "2025-09"],
  23: ["2022-03", "2025-07", "2025-09", "2025-11"],
  24: ["2022-03", "2025-09", "2025-11", "2026-02"],
  25: ["2022-03", "2026-02", "2026-04", "2026-05"],
  26: ["2022-03", "2026-04", "2026-05", "2026-07"],
  27: ["2022-03", "2026-05", "2026-07", "2026-09"],
};
const concernMentions = {};   // label -> ym -> [mention...]
for (const { slug, sidecar } of reports) {
  const t = concernTableOf(fs.readFileSync(path.join(SRC, slug + ".txt"), "utf8"));
  assert.deepEqual(t.problems, [], `${slug}: concerns table clean`);
  assert.deepEqual(t.columns, CONCERN_COLUMNS[sidecar.wave], `${slug}: anchor + trailing B1 months (2026-04 included)`);
  assert.equal(t.columns[t.columns.length - 1], sidecar.date.slice(0, 7), `${slug}: last column is its own wave's month`);
  assert.ok(Object.keys(t.concerns).length >= 9 && Object.keys(t.concerns).length <= 12,
    `${slug}: the top ten-or-so issues`);
  for (const [lbl, cells] of Object.entries(t.concerns)) {
    assert.deepEqual(Object.keys(cells).sort(), [...t.columns].sort(), `${slug} '${lbl}': one cell per column`);
    for (const [ym, v] of Object.entries(cells)) ((concernMentions[lbl] ||= {})[ym] ||= []).push(v);
  }
}
// every sighting of the same issue-month agrees – no B1 revisions on file
for (const [lbl, months] of Object.entries(concernMentions))
  for (const [ym, vals] of Object.entries(months))
    assert.equal(new Set(vals).size, 1, `${lbl} ${ym}: every reprint agrees`);

// data/sec-issues.json carries exactly what the cached reports print,
// merged the way the extractor merges it
{
  const expectSeries = {};
  for (const lbl of Object.keys(concernMentions).sort())
    expectSeries[lbl] = Object.keys(concernMentions[lbl]).sort()
      .map((ym) => ({ month: ym, mention: concernMentions[lbl][ym][concernMentions[lbl][ym].length - 1] }));
  const banked = JSON.parse(fs.readFileSync("data/sec-issues.json", "utf8"));
  assert.deepEqual(banked.issues, Object.keys(expectSeries), "the alphabetical issue list");
  assert.deepEqual(banked.series, expectSeries,
    "the banked concerns series matches the cached reports (rerun extract-secnewgate.mjs)");
  assert.deepEqual(banked.series["Cost of living"].map((e) => e.month), [
    "2022-03", "2025-02", "2025-04", "2025-07", "2025-09", "2025-11",
    "2026-02", "2026-04", "2026-05", "2026-07", "2026-09",
  ], "all eleven B1 months incl. 2026-04 (the special's, via reprint)");
  assert.deepEqual(banked.series["Cost of living"][banked.series["Cost of living"].length - 1],
    { month: "2026-09", mention: 68 }, "September 2026's top concern");
  assert.equal(banked.series["Crime"][banked.series["Crime"].length - 1].mention, 20, "crime second at 20");
  assert.equal(banked.series["Immigration & population"].find((e) => e.month === "2025-11").mention, 13,
    "immigration & population, Nov 2025");
}

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
    ...(r.sidecar.sample != null ? { sample: r.sidecar.sample } : {}),
    ...(r.sidecar.url != null ? { url: r.sidecar.url } : {}),
    ...(r.sidecar.published != null ? { published: r.sidecar.published } : {}),
  })), "the SEC Newgate direction rows, date-sorted, match the cached reports");
}

console.log("test-secnewgate: all assertions passed");
