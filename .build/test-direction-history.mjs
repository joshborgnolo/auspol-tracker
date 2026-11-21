// National direction's back history: the wave file's integrity, the table
// label parser, and gen-data §5dh's monthly single-house payload. Run after
// the build (npm test does) so assets/js/data.*.js carries dirHistory.
import assert from "node:assert/strict";
import fs from "node:fs";
import { fieldDates } from "./backfill-direction-history.mjs";
import { secDirectionSeries, secHistoryWaves, redbridgeDirectionRows, redbridgeHistoryWaves } from "./direction-history-aux.mjs";

const hist = JSON.parse(fs.readFileSync("data/direction-history.json", "utf8"));
const polls = JSON.parse(fs.readFileSync("data/polls.json", "utf8"));
const waves = hist.waves;
assert.ok(waves.length > 100, "the tabulated record alone is hundreds of waves");
const seen = new Set();
let prev = "";
for (const w of waves) {
  assert.ok(["Roy Morgan", "SEC Newgate", "RedBridge/Accent"].includes(w.pollster), `history house identified: ${w.url}`);
  assert.ok(Number.isFinite(w.right) && Number.isFinite(w.wrong), `shares present: ${w.end || w.month}`);
  for (const k of ["right", "wrong"]) {
    assert.ok(w[k] >= 0 && w[k] <= 100, `${k} in range on ${w.end || w.month}: ${w[k]}`);
  }
  if (w.unsure != null) {
    assert.ok(w.unsure >= 0 && w.unsure <= 100, `unsure in range on ${w.end || w.month}`);
    assert.ok(Math.abs(w.right + w.wrong + w.unsure - 100) <= 1.5,
      `right+wrong+unsure = 100 on ${w.end || w.month}: ${w.right}, ${w.wrong}, ${w.unsure}`);
  }
  if (w.gcr != null) assert.ok(Math.abs(w.gcr - (100 + w.right - w.wrong)) <= 0.55,
    `the printed GCR reconciles on ${w.end}: ${w.gcr} vs ${100 + w.right - w.wrong}`);
  if (w.month) assert.ok(/^\d{4}-(0[1-9]|1[0-2])$/.test(w.month), `exact source month on ${w.url}`);
  const at = w.end || w.published || w.month;
  assert.ok(!Number.isNaN(Date.parse(at)), `a real date or month on ${w.url}`);
  assert.ok(at >= prev, "filed oldest first");
  prev = at;
  const key = `${w.pollster}|${w.month || w.end}|${w.right}|${w.wrong}`;
  assert.ok(!seen.has(key), `no duplicated wave: ${key}`);
  seen.add(key);
}

// No history wave may restate a live Roy Morgan row (the live row wins).
for (const w of waves) {
  if (!w.end) continue;
  const clash = polls.direction.some((d) => d.pollster === "Roy Morgan" &&
    Math.abs(Date.parse(w.end) - Date.parse(d.date)) <= 86400000 &&
    Math.abs(d.right - w.right) < 0.051 && Math.abs(d.wrong - w.wrong) < 0.051);
  assert.ok(!clash, `live wave re-filed as history: ${w.end}`);
}

// Two printed anchors, one at each end of the tabulated run.
const anchor = (end, right, wrong) => {
  const w = waves.find((q) => q.end === end);
  assert.ok(w, `the ${end} wave is on file`);
  assert.equal(w.right, right, `right direction on ${end}`);
  assert.equal(w.wrong, wrong, `wrong track on ${end}`);
};
anchor("2012-01-08", 43.5, 40.5);
anchor("2023-11-12", 25.5, 59);
anchor("2025-04-27", 33.3, 52.8);
// ...but not 2025-05-31's 41/44 wave: it is the live 2025-06-01 row's own wave
assert.ok(!waves.some((w) => w.end === "2025-05-31"), "the live file owns the May 2025 wave");
assert.ok(polls.direction.some((d) => d.pollster === "Roy Morgan" && d.date === "2025-06-01" &&
  d.right === 41 && d.wrong === 44), "and its figures stand in the live row");

const sec = secHistoryWaves(".build/secnewgate-src");
assert.equal(sec.length, 20, "SEC's first twenty waves join the history; the seven dated rows stay live-owned");
for (const [month, right, wrong] of [["2022-03", 50, 50], ["2022-05", 54, 46],
  ["2022-09", 53, 47], ["2023-06", 39, 61], ["2025-04", 43, 57]]) {
  const row = sec.find((r) => r.month === month);
  assert.ok(row && row.right === right && row.wrong === wrong,
    `SEC ${month}'s coloured vector series carries right ${right} / wrong ${wrong}`);
  assert.match(row.url, /secnewgate\.com\.au\//, `SEC ${month} has a primary release link`);
}
const secSvgBase = ".build/secnewgate-src/SEC-Newgate-Mood-of-the-Nation-September-2026-Report";
const secVector = secDirectionSeries(fs.readFileSync(secSvgBase + ".bbox.html", "utf8"),
  fs.readFileSync(secSvgBase + ".direction.svg", "utf8"));
assert.equal(secVector.length, 27, "the latest SEC chart reprints its complete 27-wave run");
assert.throws(() => secDirectionSeries(fs.readFileSync(secSvgBase + ".bbox.html", "utf8"),
  fs.readFileSync(secSvgBase + ".direction.svg", "utf8").replace("stroke=\"rgb(8.628845%", "stroke=\"rgb(8.999999%")),
/right\/wrong vector lines/, "dropping the right-direction series trips the guard");

const rbNov = redbridgeDirectionRows(JSON.parse(fs.readFileSync(".build/direction-history-src/redbridge-nov2025-p111.json", "utf8")));
const rbJan = redbridgeDirectionRows(JSON.parse(fs.readFileSync(".build/direction-history-src/redbridge-jan2026-p106.json", "utf8")));
assert.equal(rbNov.length, 7, "RedBridge November's seven original rows all read");
assert.equal(rbJan.length, 8, "January adds its own wave without losing the reprinted run");
const rb = redbridgeHistoryWaves(".build/direction-history-src");
assert.equal(rb.length, 6, "RedBridge supplies six back-series readings before its live-table era");
for (const [month, right, wrong, unsure] of [["2024-02", 32, 47, 21], ["2025-03", 30, 50, 20]]) {
  assert.deepEqual([rb.find((r) => r.month === month).right,
    rb.find((r) => r.month === month).wrong, rb.find((r) => r.month === month).unsure], [right, wrong, unsure]);
}
assert.ok(!hist.waves.some((w) => w.pollster === "RedBridge/Accent" && w.month === "2025-06"),
  "the live file already owns RedBridge's dated June 2025 row");

// The fieldwork labels, including every shape the tables actually carry.
const dateCase = (label, year, start, end) => {
  const d = fieldDates(label, year);
  assert.equal(d.start, start, `${label}: start`);
  assert.equal(d.end, end, `${label}: end`);
};
dateCase("January 7/8", 2012, "2012-01-07", "2012-01-08");
dateCase("January 14/15 & 21/22", 2012, "2012-01-14", "2012-01-22");
dateCase("March 31/April 1", 2012, "2012-03-31", "2012-04-01");
dateCase("April 23/24, 30 & May 1", 2016, "2016-04-23", "2016-05-01");
dateCase("July 24/25 & 31/ Aug 1, 2021", null, "2021-07-24", "2021-08-01");
dateCase("December 31/January 1", 2012, "2012-12-31", "2013-01-01");
dateCase("May 5-31", 2025, "2025-05-05", "2025-05-31");
dateCase("June 2-22", 2025, "2025-06-02", "2025-06-22");
dateCase("December 16", 2024, "2024-12-16", "2024-12-16");
dateCase("March 3/4 & 10/11, 2018", null, "2018-03-03", "2018-03-11");

// gen-data's monthly means, read from the built payload, verified by an
// independent regrouping of the wave file for its opening month.
const dataMatch = fs.readFileSync("index.html", "utf8").match(/assets\/js\/data\.[a-z0-9]+\.js/);
assert.ok(dataMatch, "the built index references its data asset");
const dataFile = dataMatch[0];
const js = fs.readFileSync(dataFile, "utf8");
const m = js.match(/const dirHistory = JSON.parse\(("(?:\\[\s\S]|[^"\\])*")\);/);
assert.ok(m, "dirHistory is present in the payload");
const payload = JSON.parse(JSON.parse(m[1]));
assert.ok(payload && payload.houses && payload.houses["Roy Morgan"], "Roy Morgan's run is on the page");
assert.ok(payload.houses.Essential, "Essential's national-mood run comes from the live rows");
assert.equal(payload.houses["SEC Newgate"]?.length, 27, "all 27 SEC waves reach the monthly payload");
assert.equal(payload.houses["RedBridge/Accent"]?.length, 10, "five older readings plus RedBridge's five monthly runs");
for (const [house, rows] of Object.entries(payload.houses)) {
  let prevX = -Infinity;
  for (const p of rows) {
    assert.ok(p.x > prevX, `${house}: months ordered`);
    prevX = p.x;
    assert.ok(Math.abs(p.right + p.wrong + p.unsure - 100) <= 1.5,
      `${house} ${p.ym}: shares total 100 to the houses' own print rounding`);
    for (const k of ["right", "wrong", "unsure"]) {
      assert.ok(Number.isFinite(p[k]) && p[k] >= 0 && p[k] <= 100, `${house} ${p.ym} ${k} in range`);
    }
  }
}
const jan = waves.filter((w) => w.end && w.end.startsWith("2012-01"));
const pJan = payload.houses["Roy Morgan"].find((p) => p.ym === "2012-01");
for (const k of ["right", "wrong"]) {
  const mean = Math.round(jan.reduce((a, w) => a + w[k], 0) / jan.length * 10) / 10;
  assert.equal(pJan[k], mean, `January 2012 ${k}: mean of the four printed waves`);
}
assert.equal(payload.from, payload.houses["Roy Morgan"][0].ym, "the run opens on its own first month");
assert.ok(payload.from < "2025-05", "history reaches behind the pooled series");
assert.ok(!payload.houses["Roy Morgan"].some((p) => p.ym < "2012-01" && p.n === 0),
  "no month is ever filled without a wave");

const preMatch = js.match(/const directionPre = JSON.parse\(("(?:\\[\s\S]|[^"\\])*")\);/);
assert.ok(preMatch, "the historical pooled series is emitted");
const pre = JSON.parse(JSON.parse(preMatch[1]));
assert.equal(pre.from, "2022-03", "pooling starts when SEC Newgate joins Roy Morgan");
assert.deepEqual(pre.houses, ["Roy Morgan", "SEC Newgate", "Essential", "RedBridge/Accent"],
  "all four houses enter the estimator in first-asked order");
const monthPoint = (ym) => {
  const p = pre.series.find((q) => q.ym === ym);
  assert.ok(p, `${ym} is pooled`);
  assert.ok(Math.abs(p.right + p.wrong + p.unsure - 100) <= 0.2, `${ym}'s sums reconcile`);
  return p;
};
assert.equal(monthPoint("2022-04").right, 41.9, "April 2022 is the SEC/Roy Morgan two-house estimate, not Morgan alone");
assert.equal(monthPoint("2022-09").right, 49.1, "Essential joins the September 2022 consensus");
assert.equal(monthPoint("2024-02").right, 35.5, "RedBridge joins the February 2024 estimate");
for (const [pollster, dateLabel, right, wrong] of [["SEC Newgate", "September 2022", 53, 47],
  ["RedBridge/Accent", "February 2024", 32, 47]]) {
  const dot = pre.polls.find((p) => p.pollster === pollster && p.dateLabel === dateLabel);
  assert.ok(dot && dot.right === right && dot.wrong === wrong,
    `${pollster}'s ${dateLabel} wave stays verbatim, with no invented fieldwork-date label`);
}

console.log(`test-direction-history: OK (${waves.length} waves from ${waves[0].end || waves[0].published}, ` +
  Object.entries(payload.houses).map(([h, r]) => `${h}: ${r.length} months`).join(", ") + ")");
