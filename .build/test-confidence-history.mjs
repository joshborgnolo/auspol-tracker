/* Tests for confidence-history.mjs — the extractor behind data/confidence-history.json
   (the deep monthly back-history sibling of the confidence panel's data/confidence.json).
   Five stages, same shape as test-confidence.mjs:
     1. CONFIDENCE_HISTORY_LIB import: parseYearGrid / parseH3 / parseFredCci /
        parseTradaysNab / parseMcNabRows / guardLane pins.
     2. --fixture-dir subprocess: synthetic full-depth fixtures drive the
        pipeline in a temp cwd — status shape, idempotency, --check, guard trips.
     4. the nabConfidence lane end-to-end: Tradays-moneycontrol merge
        precedence, the Moneycontrol-only 2012-13 hole the Tradays
        overlay fills, the SMH/AAP wire override, head/tail provenance,
        --check surface, idempotency.
     3. Live structural pins on the committed data/confidence-history.json.
     5. Degradation contracts on the same committed file (history is
        append-only, never a shrink; figured never a label).
   Run: node .build/test-confidence-history.mjs */
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = path.join(ROOT, ".build", "confidence-history.mjs");

process.env.CONFIDENCE_HISTORY_LIB = "1";
const { parseYearGrid, parseH3, parseFredCci, parseTradaysNab, parseMcNabRows, guardLane } = await import("./confidence-history.mjs");

/* ---------------------------------------------------------------- 1. parsers */
// footnote-marked cells parse; the yearly-average column is ignored; a
// missing month files nothing
{
  const html = `<table><tbody>
    <tr><td><strong>YEAR</strong></td><td>JAN</td><td>FEB</td><td>MAR</td><td>APR</td><td>MAY</td><td>JUN</td><td>JUL</td><td>AUG</td><td>SEP</td><td>OCT</td><td>NOV</td><td>DEC</td><td><strong>YEARLY AVERAGE</strong></td></tr>
    <tr><td><strong>2026</strong></td><td>82.6</td><td>78.7</td><td>70.5</td><td>63.6</td><td>66.0</td><td>70.8</td><td>75.4</td><td>74.4</td><td>72.1**</td><td></td><td></td><td></td><td>72.3</td></tr>
    <tr><td><strong>2008</strong></td><td>118.6</td><td>115.8</td><td>109.5</td><td>100.1</td><td>97.1</td><td>90.7</td><td>92.0</td><td>94.7#</td><td>101.2</td><td>90.4</td><td>93.1</td><td>99.8</td><td>100.2</td></tr>
  </tbody></table>`;
  const m = parseYearGrid(html);
  assert.equal(m.size, 21, "two year rows – trailing-average cell not a row");
  assert.equal(m.get("2026-09"), 72.1, "** footnote stripped");
  assert.equal(m.get("2008-08"), 94.7, "# footnote stripped");
  assert.equal(m.get("2026-10"), undefined, "empty cell files nothing");
}
// the grid ends at the first non-year row (component tables behind it ignored)
{
  const html = `<table><tbody>
    <tr><td></td><td>JAN</td><td>FEB</td><td>MAR</td><td>APR</td><td>MAY</td><td>JUN</td><td>JUL</td><td>AUG</td><td>SEP</td><td>OCT</td><td>NOV</td><td>DEC</td><td>Annual Average</td></tr>
    <tr><td>2026</td><td>97.4</td><td>88.6</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td>93.0</td></tr>
    <tr><td>Monthly Average</td><td>112.9</td></tr>
    <tr><td></td><td>JAN</td><td>FEB</td><td>MAR</td><td>APR</td><td>MAY</td><td>JUN</td><td>JUL</td><td>AUG</td><td>SEP</td><td>OCT</td><td>NOV</td><td>DEC</td></tr>
    <tr><td>Business Confidence Rating</td><td>97.4</td></tr>
  </tbody></table>`;
  const m = parseYearGrid(html);
  assert.deepEqual([...m.keys()], ["2026-01", "2026-02"], "stops before Monthly Average; component table never joins");
}
// an unparseable non-empty cell trips, a missing grid trips
assert.throws(() => parseYearGrid("<table><tr><td>JAN</td><td>FEB</td><td>MAR</td><td>APR</td><td>MAY</td><td>JUN</td><td>JUL</td><td>AUG</td><td>SEP</td><td>OCT</td><td>NOV</td><td>DEC</td></tr><tr><td>2026</td><td>tbc</td></tr></table>"), /unparseable/);
assert.throws(() => parseYearGrid("<p>no tables here</p>"), /no YEAR×month grid/);

// H3: columns located by Title-row name (order-agnostic); date rows only
{
  const csv = [
    "H3 MONTHLY ACTIVITY INDICATORS",
    "Title,Private dwelling approvals,Business conditions,Consumer sentiment",
    "Description,x,NAB business conditions index deviation from average,Westpac-Melbourne Institute consumer sentiment index",
    "Series ID,GISPSDA,GICNBC,GICWMICS",
    "31/01/2010,12.9,3.6,120.1",
    "28/02/2010,13.1,,",   // empty sentiment/conditions cells file nothing
    "31/03/2010,13.6,1.2,117.3",
    "31/08/2026,16.6,-4.2,88.9",
  ].join("\n");
  const { westpac, nabCondDev } = parseH3(csv);
  assert.deepEqual([...westpac.entries()], [["2010-01", 120.1], ["2010-03", 117.3], ["2026-08", 88.9]]);
  assert.deepEqual([...nabCondDev.entries()], [["2010-01", 3.6], ["2010-03", 1.2], ["2026-08", -4.2]]);
  assert.throws(() => parseH3("Title,Dwelling approvals\n31/01/2010,12.9"), /columns not found/);
}

// FRED/OECD: series column located by header name (never position), the
// +100 rebase lands even on negative balances, "." gaps file nothing
{
  const csv = [
    "observation_date,LOOKAHEADBANANA,CSCICP02AUM460S",
    "1974-09-01,0,-9",
    "1974-10-01,0,.",
    "1974-11-01,0,7",
    "2005-01-01,0,28",
  ].join("\n");
  const m = parseFredCci(csv);
  assert.deepEqual([...m.entries()], [["1974-09", 91], ["1974-11", 107], ["2005-01", 128]], "gap filed nothing, +100 rebase");
  assert.throws(() => parseFredCci("observation_date,SOMETHING_ELSE\n1974-09-01,-9"), /CSCICP02AUM460S column not found/);
  assert.throws(() => parseFredCci("no header here\n1974-09-01,-9"), /no observation_date header/);
}

// Tradays: release month − 1 becomes the survey month (a January print is
// last December); a two-wave release month walks back from its last row
// (1 Feb 2011 = Dec-10 late print, 8 Feb 2011 = Jan-11 — the
// ibtimes-verified reading); the forecast/previous columns are ignored
{
  const tsv = "Date\tActualValue\tForecastValue\tPreviousValue\n"
    + "2009.01.27\t-32\t\t-20\n"          // Jan 2009 print → survey Dec-08 −32
    + "2011.02.01\t-3\t\t-3\n"           // Dec-10's late wave
    + "2011.02.08\t4\t\t-3\n";           // Jan-11 on time
  const m = parseTradaysNab(tsv);
  assert.equal(m.get("2008-12"), -32, "January release is last December");
  assert.equal(m.get("2010-12"), -3, "earlier row of the pair walks back");
  assert.equal(m.get("2011-01"), 4, "later row keeps release−1");
  assert.throws(() => parseTradaysNab("Date\tActualValue\nnothing parsable"), /zero data rows/);
}

// Moneycontrol: the three reference shapes parse; a reference month after
// the release month belongs to the previous year; scheduled rows file
// nothing; garbage rows trip
{
  const rows = [
    { date: "Sep 08, 2026", reference: "Aug", actual: "-8" },        // bare month
    { date: "Jan 14, 2014", reference: "Dec 2013", actual: "4" },    // explicit year
    { date: "Jul 09, 2013", reference: "Business Confidence Jun", actual: "2" }, // titled
    { date: "Oct 14, 2026", reference: "Sep", actual: "" },          // scheduled
    { date: "Jan 31, 2012", reference: "Dec", actual: "3" },         // Dec-year rule, no year token
  ];
  const m = parseMcNabRows(rows);
  assert.equal(m.get("2026-08"), -8, "bare month");
  assert.equal(m.get("2013-12"), 4, "explicit year wins");
  assert.equal(m.get("2013-06"), 2, "titled reference, last month-name wins");
  assert.equal(m.get("2011-12"), 3, "no year token: Dec after Jan release = last year");
  assert.equal(m.size, 4, "scheduled row filed nothing");
  assert.throws(() => parseMcNabRows([{ date: "bad date", reference: "Aug", actual: "1" }]), /unparseable/);
  assert.throws(() => parseMcNabRows([{ date: "Jan 12, 2021", reference: "headline figures", actual: "1" }]), /reference month unparseable/);
  assert.throws(() => parseMcNabRows([]), /zero data rows/);
}

// guardLane: first month / floor / range / contiguity each trip on cue
{
  const mk = (yms) => new Map(yms.map((ym) => [ym, 100]));
  const cont = []; { let y = 2010, m = 12; for (let i = 0; i < 200; i++) { cont.push(`${y}-${String(m).padStart(2, "0")}`); m++; if (m > 12) { m = 1; y++; } } }
  const g = { first: "2010-12", min: 40, max: 170, floor: 170, contiguousFrom: "2010-12" };
  assert.equal(guardLane("t", mk(cont), g).length, 200, "clean series passes");
  assert.throws(() => guardLane("t", mk(cont.slice(1)), g), /first month/, "missing first month trips");
  assert.throws(() => guardLane("t", mk(cont.slice(0, 100)), g), /rows/, "floor trips");
  {
    const bad = mk(cont); bad.set("2019-06", 999);
    assert.throws(() => guardLane("t", bad, g), /outside/, "range trips");
  }
  {
    const bad = mk(cont.filter((ym) => ym !== "2018-02")).entries();
    // contiguity: hole in the interior (first month intact, count over floor still)
    assert.throws(() => guardLane("t", new Map(bad), { ...g, floor: 100 }), /interior month 2018-02 missing/, "hole trips");
  }
}
console.log("1. parsers + guards: OK");

/* ------------------------------------------------------- 2. fixture pipeline */
const tmp = fs.mkdtempSync(path.join("/tmp/", "confidence-history-test-"));
fs.mkdirSync(path.join(tmp, "data"));
const FIX = path.join(tmp, "fixtures");
fs.mkdirSync(FIX);

const monthsFrom = (ym0, ym1) => {
  const out = [];
  let [y, m] = ym0.split("-").map(Number);
  const [ey, em] = ym1.split("-").map(Number);
  for (; y < ey || (y === ey && m <= em); ) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m++; if (m > 12) { m = 1; y++; }
  }
  return out;
};
// a deterministic in-band figure per lane so a column mix-up would show
const fig = (lane) => {
  const base = { consumer: 100, business: 110, westpac: 90, nab: 3, nabConf: -2, nabTr: 0 }[lane];
  const span = { consumer: 15, business: 12, westpac: 8, nab: 4, nabConf: 10, nabTr: 12 }[lane];
  let i = 0;
  return () => +(base + span * Math.sin(i++ / 7)).toFixed(1);
};
// consumer grid: quarterly readings to 1982, monthly 1983-01 → 2026-09
const ccGrid = (() => {
  const fm = fig("consumer");
  const monthVal = new Map(monthsFrom("1983-01", "2026-09").map((ym) => [ym, fm()]));
  const rows = [];
  for (let y = 1973; y <= 2026; y++) {
    const cells = [];
    for (let mo = 1; mo <= 12; mo++) {
      const ym = `${y}-${String(mo).padStart(2, "0")}`;
      if (monthVal.has(ym)) cells.push(String(monthVal.get(ym)));
      else if (y <= 1982 && mo % 3 === 0) cells.push(String(fm()));
      else cells.push("");
    }
    rows.push({ year: y, cells });
  }
  return rows;
})();
const yearsGridPage = (rows, avgCol = "YEARLY AVERAGE") => {
  const trs = rows.map(({ year, cells }) =>
    `<tr><td><strong>${year}</strong></td>${cells.map((c) => `<td>${c}${c && Math.random() < 0 ? "#" : ""}</td>`).join("")}<td>100.0</td></tr>`).join("\n");
  const content = `\n<div>\n<table><tbody>\n<tr><td><strong>YEAR</strong></td>${["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"].map((t) => `<td><strong>${t}</strong></td>`).join("")}<td><strong>${avgCol}</strong></td></tr>\n${trs}\n</tbody></table>\n</div>`;
  return `<html><head><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { morganPollData: { morganPollBy: { content } } } } })}</script></head><body/></html>`;
};
const bcFm = fig("business");
const bcRows = [];
{
  const by = new Map(monthsFrom("2010-12", "2026-05").map((ym) => [ym, bcFm()]));
  for (let y = 2010; y <= 2026; y++) {
    const cells = [];
    for (let mo = 1; mo <= 12; mo++) {
      const ym = `${y}-${String(mo).padStart(2, "0")}`;
      cells.push(by.has(ym) ? String(by.get(ym)) : "");
    }
    if (cells.some(Boolean)) bcRows.push({ year: y, cells });
  }
}
fs.writeFileSync(path.join(FIX, "cc.html"), yearsGridPage(ccGrid));
fs.writeFileSync(path.join(FIX, "bc.html"), yearsGridPage(bcRows, "Annual Average"));
// one generator drives BOTH the OECD mirror fixture and H3's westpac
// column, so the extractor's OECD/H3 reconciliation passes by
// construction; one overlap month (2015-06) sits 0.3 under the mirror's
// read — inside the ±0.55 tolerance — proving H3 wins the overlap
const wpSeries = (() => { const wm = fig("westpac"); return new Map(monthsFrom("1974-09", "2026-10").map((ym) => [ym, wm()])); })();
const fredGood = ["observation_date,CSCICP02AUM460S",
  ...monthsFrom("1974-09", "2026-08").map((ym) => `${ym}-01,${(wpSeries.get(ym) - 100).toFixed(1)}`)].join("\n");
fs.writeFileSync(path.join(FIX, "fred-cci.csv"), fredGood);
const wpOffset = Math.round(wpSeries.get("2015-06") * 10 - 3) / 10;  // H3's 2015-06 read, 0.3 below the mirror
const h3Lines = [
  "H3 MONTHLY ACTIVITY INDICATORS",
  "Title,Private dwelling approvals,Private dwelling approvals trend,Private non-residential building approvals,Consumer sentiment,Business conditions",
  "Series ID,GISPSDA,GISDWPRITR,GISPSNBA,GICWMICS,GICNBC",
];
{
  const nm = fig("nab");
  const every = new Set([...monthsFrom("1997-03", "2026-08")].map((ym) => [ym, nm()]));
  const wset = new Set(monthsFrom("2010-01", "2026-10"));
  const have = new Set([...every].map(([ym]) => ym));
  const all = new Map([...every, ...monthsFrom("1965-01", "1997-02").map((ym) => [ym, null]),
    ...[...wset].filter((ym) => !have.has(ym)).map((ym) => [ym, null])]);
  for (const [ym, n] of [...all.entries()].sort()) {
    const raw = wset.has(ym) ? wpSeries.get(ym) : null;
    const w = raw == null ? "" : (ym === "2015-06" ? wpOffset : raw);
    h3Lines.push(`01/${ym.slice(5)}/${ym.slice(0, 4)},8.8,9.1,1000,${w},${n == null ? "" : n}`);
  }
}
fs.writeFileSync(path.join(FIX, "h3.csv"), h3Lines.join("\n"));

/* NAB confidence mirror fixtures. Moneycontrol rows: {date, reference,
   actual} — every survey month 1997-03 → 2026-08 except Jul 2012 –
   Jan 2013, the hole the REAL Moneycontrol calendar carries (the merged
   lane's completeness rests on Tradays covering those months, so the
   fixture reproduces the split exactly); the generator emits the three
   real reference shapes on a rotation so the fixture also parses the
   parser's branch table. Tradays release rows cover 2008-12 → 2014-09
   continuous — the hole months included, as the live export carries
   them — EXCEPT January 2011, whose two waves both print inside
   February 2011 (the real-life double-release the parser resolves);
   plus the 2026-08 singleton the real export carries. The 2011-08 value
   is deliberately +2 in every fixture: the wire override (−8) applies
   post-merge regardless of what the sources print. */
const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
{
  const fm = fig("nabConf");
  const nabGap = (ym) => ym >= "2012-07" && ym <= "2013-01";
  const rows = [];
  let i = 0;
  for (const ym of monthsFrom("1997-03", "2026-08").filter((ym) => !nabGap(ym))) {
    const [y, mo] = ym.split("-").map(Number);
    let ry = y, rm = mo + 1; if (rm > 12) { rm = 1; ry++; }
    const ref = i % 3 === 0 ? monthNames[mo - 1]
      : i % 3 === 1 ? "Business Confidence " + monthNames[mo - 1]
      : monthNames[mo - 1] + " " + y;
    rows.push({ date: `${monthNames[rm - 1]} 09, ${ry}`, reference: ref, actual: String(ym === "2011-08" ? 2 : fm()) });
    i++;
  }
  fs.writeFileSync(path.join(FIX, "nab-mc.json"), JSON.stringify({ data: rows }));
  const ft = fig("nabTr");
  const tLines = ["Date\tActualValue\tForecastValue\tPreviousValue"];
  for (const ym of monthsFrom("2008-12", "2014-09").concat(["2026-08"])) {
    const [y, mo] = ym.split("-").map(Number);
    let ry = y, rm = mo + 1; if (rm > 12) { rm = 1; ry++; }
    if (ym === "2011-01") continue;   // Jan-11's wave prints inside February
    const stamp = `${ry}.${String(rm).padStart(2, "0")}.12`;
    tLines.push(`${stamp}\t${ym === "2011-08" ? 2 : ft()}\t\t`);
  }
  // Dec-10's wave printed late, ahead of Jan-11's, inside February 2011:
  // the walk-back re-keys Dec-10 to −3 over the loop's 2011.01.12 row
  tLines.push("2011.02.01\t-3\t\t", "2011.02.08\t4\t\t");
  fs.writeFileSync(path.join(FIX, "nab-tradays.tsv"), tLines.filter(Boolean).join("\n") + "\n");
}

const run = (args = []) => {
  const env = { ...process.env };
  delete env.CONFIDENCE_HISTORY_LIB;
  let out = "", status = 0;
  try { out = execFileSync("node", [SCRIPT, "--fixture-dir", FIX, ...args], { cwd: tmp, encoding: "utf8", env }); }
  catch (e) { status = e.status; out = (e.stdout || "") + (e.stderr || ""); }
  return { out, status };
};
{
  const { out, status } = run();
  assert.equal(status, 0, out);
  const st = JSON.parse(out.trim().split("\n").at(-1).replace(/^CONFIDENCE_HISTORY_STATUS /, ""));
  assert.equal(st.changed, true, "first run writes");
  assert.deepEqual(st.oldest, { consumer: "1973-03", business: "2010-12", westpacConsumer: "1974-09", nabConditions: "1997-03", nabConfidence: "1997-03" });
  assert.deepEqual(st.newest, { consumer: "2026-09", business: "2026-05", westpacConsumer: "2026-10", nabConditions: "2026-08", nabConfidence: "2026-08" });
  const doc = JSON.parse(fs.readFileSync(path.join(tmp, "data", "confidence-history.json"), "utf8"));
  assert.equal(doc.consumer.rows.length, st.rows.consumer);
  assert.equal(doc.consumer.rows.at(-1).ym, "2026-09");
  assert.equal(doc.westpacConsumer.rows[0].ym, "1974-09", "westpac starts 1974-09 via the OECD mirror");
  assert.equal(st.rows.westpacConsumer, 626, "1974-09 → 2026-10 merged rows");
  assert.equal(doc.westpacConsumer.rows.at(-1).ym, "2026-10");
  // the seam: pre-2010 rows carry the mirror's value, H3 wins the overlap
  const wpRow = (ym) => doc.westpacConsumer.rows.find((r) => r.ym === ym).v;
  assert.equal(wpRow("2009-12"), wpSeries.get("2009-12"), "pre-2010 month is the mirror's read");
  assert.equal(wpRow("2010-01"), wpSeries.get("2010-01"), "seam month matches both sources (same generator)");
  assert.equal(wpRow("2015-06"), wpOffset, "H3 wins the overlap inside the ±0.55 tolerance");
  assert.ok(doc.nabConditions.rows.every((r) => r.v >= -60 && r.v <= 60));
  // idempotent second run
  const second = run();
  assert.equal(second.status, 0, second.out);
  const st2 = JSON.parse(second.out.trim().split("\n").at(-1).replace(/^CONFIDENCE_HISTORY_STATUS /, ""));
  assert.equal(st2.changed, false, "unchanged upstream writes nothing");
  assert.equal(st2.added.consumer.length, 0);
  // --check computes but never writes (nab keeps its publication lag: its
  // 2026-09/10 cells land as the wave catches up, westpac adds 2026-11)
  fs.writeFileSync(path.join(FIX, "h3.csv"), fs.readFileSync(path.join(FIX, "h3.csv"), "utf8")
    + "\n01/09/2026,8.8,9.1,1000,,3.1\n01/10/2026,8.8,9.1,1000,,2.8\n01/11/2026,8.8,9.1,1000,81.1,2.5");
  const chk = run(["--check"]);
  assert.equal(chk.status, 0, chk.out);
  const st3 = JSON.parse(chk.out.trim().split("\n").at(-1).replace(/^CONFIDENCE_HISTORY_STATUS /, ""));
  assert.equal(st3.changed, true, "new h3 month detected");
  const onDisk = JSON.parse(fs.readFileSync(path.join(tmp, "data", "confidence-history.json"), "utf8"));
  assert.equal(onDisk.westpacConsumer.rows.at(-1).ym, "2026-10", "--check never writes");
  // then the real run files it
  const third = run();
  assert.equal(third.status, 0, third.out);
  const st4 = JSON.parse(third.out.trim().split("\n").at(-1).replace(/^CONFIDENCE_HISTORY_STATUS /, ""));
  assert.deepEqual(st4.added.westpacConsumer, ["2026-11"], "the pending month files on the next real run");
  assert.deepEqual(st4.added.nabConditions, ["2026-09", "2026-10", "2026-11"], "nab fills its lagged cells too");
  // a broken FRED mirror is exit 1 (never exit-2, never files nothing but
  // confused with a structure trip) and the committed file survives intact
  fs.writeFileSync(path.join(FIX, "fred-cci.csv"), "this is not a fred csv");
  const freddie = run();
  assert.equal(freddie.status, 1, "broken FRED csv is exit 1, got " + freddie.status + ": " + freddie.out);
  assert.match(freddie.out, /FRED FETCH\/PARSE FAILURE/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(tmp, "data", "confidence-history.json"), "utf8")).westpacConsumer.rows.at(-1).ym, "2026-11", "broken FRED filed nothing");
  fs.writeFileSync(path.join(FIX, "fred-cci.csv"), fredGood);
  // guard trip: shapeless page → exit 2
  fs.writeFileSync(path.join(FIX, "cc.html"), "<html><body>nothing</body></html>");
  const boom = run();
  assert.equal(boom.status, 2, "shapeless page is exit 2, got " + boom.status + ": " + boom.out);
  assert.match(boom.out, /GUARD TRIP/);
  // Moneycontrol depth floor: the 1997-03 → 2007-12 head missing means
  // ~25% of the expected rows are gone — that is a degradation (exit 2),
  // while Moneycontrol's own 2012-13 hole (Tradays-covered, as live) is not
  fs.writeFileSync(path.join(FIX, "cc.html"), yearsGridPage(ccGrid));
  {
    const mc = JSON.parse(fs.readFileSync(path.join(FIX, "nab-mc.json"), "utf8"));
    fs.writeFileSync(path.join(FIX, "nab-mc.json"), JSON.stringify({ data: mc.data.filter((r) => !(r.reference || "").includes("Mar 1997") && !(r.date || "").includes("Apr 09, 1997")) }));
  }
  const shallow = run();
  assert.equal(shallow.status, 2, "nabConfidence depth floor is exit 2, got " + shallow.status + ": " + shallow.out);
  assert.match(shallow.out, /nabConfidence/);
}
console.log("2. fixture pipeline: OK");

/* ------ 4. NAB confidence merge, precedence, hole-fill and override pins --- */
{
  const mk = fs.mkdtempSync(path.join("/tmp/", "nabconf-test-"));
  fs.mkdirSync(path.join(mk, "data"));
  // all five fixture inputs are re-generated inline (the stage-2 directory
  // holds a deliberately damaged nab-mc.json after the shallow-depth pin)
  const fm = fig("nabConf");
  const nabGap = (ym) => ym >= "2012-07" && ym <= "2013-01";
  const rows = [];
  let i = 0;
  for (const ym of monthsFrom("1997-03", "2026-08").filter((ym) => !nabGap(ym))) {
    const [y, mo] = ym.split("-").map(Number);
    let ry = y, rm = mo + 1; if (rm > 12) { rm = 1; ry++; }
    const ref = i % 3 === 0 ? monthNames[mo - 1]
      : i % 3 === 1 ? "Business Confidence " + monthNames[mo - 1]
      : monthNames[mo - 1] + " " + y;
    rows.push({ date: `${monthNames[rm - 1]} 09, ${ry}`, reference: ref, actual: String(ym === "2011-08" ? 2 : fm()) });
    i++;
  }
  const cFix = path.join(mk, "fixtures");
  fs.mkdirSync(cFix);
  for (const f of ["cc.html", "bc.html", "h3.csv", "fred-cci.csv"]) {
    // regenerate the clean versions the same way stage 2 does: for the two
    // files stage 2 mutates later (h3.csv gets 3 appended rows, cc.html a
    // shapeless page), rebuild at generation time instead of copying.
    if (f === "cc.html") fs.writeFileSync(path.join(cFix, f), yearsGridPage(ccGrid));
    else if (f === "bc.html") fs.writeFileSync(path.join(cFix, f), yearsGridPage(bcRows, "Annual Average"));
    else if (f === "fred-cci.csv") fs.writeFileSync(path.join(cFix, f), fredGood);
    else fs.writeFileSync(path.join(cFix, f), h3Lines.join("\n"));
  }
  fs.writeFileSync(path.join(cFix, "nab-mc.json"), JSON.stringify({ data: rows }));
  // Tradays: same generation as stage 2
  {
    const ft = fig("nabTr");
    const tLines = ["Date\tActualValue\tForecastValue\tPreviousValue"];
    for (const ym of monthsFrom("2008-12", "2014-09").concat(["2026-08"])) {
      const [y, mo] = ym.split("-").map(Number);
      let ry = y, rm = mo + 1; if (rm > 12) { rm = 1; ry++; }
      if (ym === "2011-01") continue;
      tLines.push(`${ry}.${String(rm).padStart(2, "0")}.12\t${ym === "2011-08" ? 2 : ft()}\t\t`);
    }
    tLines.push("2011.02.01\t-3\t\t", "2011.02.08\t4\t\t");
    fs.writeFileSync(path.join(cFix, "nab-tradays.tsv"), tLines.join("\n") + "\n");
  }
  const run2 = (args = []) => {
    const env = { ...process.env };
    delete env.CONFIDENCE_HISTORY_LIB;
    let out = "", status = 0;
    try { out = execFileSync("node", [SCRIPT, "--fixture-dir", cFix, ...args], { cwd: mk, encoding: "utf8", env }); }
    catch (e) { status = e.status; out = (e.stdout || "") + (e.stderr || ""); }
    return { out, status };
  };
  const first = run2(["--check"]);
  assert.equal(first.status, 0, first.out);
  const st = JSON.parse(first.out.trim().split("\n").at(-1).replace(/^CONFIDENCE_HISTORY_STATUS /, ""));
  assert.deepEqual([...st.added.nabConfidence].sort(), monthsFrom("1997-03", "2026-08").sort(), "--check sees the full lane as pending");
  const r2 = run2();
  assert.equal(r2.status, 0, r2.out);
  const doc = JSON.parse(fs.readFileSync(path.join(mk, "data", "confidence-history.json"), "utf8"));
  const nab = doc.nabConfidence;
  assert.ok(!("houses" in nab) && !("final" in nab) && !("versions" in nab), "plain lane shape only");
  assert.deepEqual(nab, JSON.parse(JSON.stringify(nab)), "doc is JSON-round-trippable");
  const v = (ym) => nab.rows.find((r) => r.ym === ym)?.v;
  // generator parity: nabConf values on a month both fixtures cover would
  // collide (inside the Tradays window Tradadays wins, so the expected
  // value is nabTr's); elsewhere it's nabConf's. `date` never surfaces.
  const yms = nab.rows.map((r) => r.ym);
  assert.equal(yms[0], "1997-03", "lane starts Mar 1997 (Moneycontrol head)");
  assert.equal(yms.at(-1), "2026-08", "lane ends at the mirrors' newest month");
  assert.equal(nab.rows.length, monthsFrom("1997-03", "2026-08").length, "every month, start to end — Moneycontrol's hole is Tradays-filled");
  assert.equal(v("2012-07") != null && v("2013-01") != null, true, "Moneycontrol's 2012-13 hole months are present");
  // precedence: wherever BOTH fixtures carry a month inside the Tradays
  // window, the Tradays fixture's generator value must win
  const mcRows = rows;
  const mcAt = (ym) => parseFloat(mcRows.find((r) => {
    const ref = r.reference || "";
    const dM = monthNames.indexOf(ref.replace(/^Business Confidence /, "").replace(/ \d{4}$/, "")) + 1;
    if (!dM) return false;
    const y = /(\d{4})$/.test(ref) ? +ref.match(/(\d{4})$/)[1]
      : +r.date.match(/(\d{4})$/)[1] - (dM > monthNames.indexOf(r.date.slice(0, 3)) + 1 ? 1 : 0);
    return `${y}-${String(dM).padStart(2, "0")}` === ym;
  })?.actual);
  const trAt = (ym) => {
    if (ym === "2010-12") return -3;
    const raw = fs.readFileSync(path.join(cFix, "nab-tradays.tsv"), "utf8").trim().split("\n").slice(1);
    const m = parseTradaysNab("Date\tActualValue\n" + raw.join("\n"));
    return m.get(ym);
  };
  // Moneycontrol's 2012-13 hole months are filled from the Tradays
  // overlay — every hole month must carry the Tradays fixture's value
  for (const ym of monthsFrom("2012-07", "2013-01"))
    assert.equal(v(ym), trAt(ym), `hole month ${ym} comes from Tradays`);
  // walk the whole Tradays window [2008-12, 2014-09) and verify
  // precedence (skip 2011-08, the wire-override month, whose post-merge
  // figure is neither source's)
  let precedenceChecked = 0;
  for (const ymi of monthsFrom("2008-12", "2014-09").filter((ymi) => ymi < "2014-09")) {
    if (ymi === "2011-08") continue;
    const tv = trAt(ymi), mv = mcAt(ymi);
    if (tv == null) continue;
    if (tv !== mv) {
      assert.equal(v(ymi), tv, `Tradays must beat Moneycontrol inside the window at ${ymi}`);
      precedenceChecked++;
    }
  }
  assert.ok(precedenceChecked >= 8, "precedence pins exercised on real divergent months");
  // and outside the window Moneycontrol carries it (its generator is
  // distinct from nabTr's); the window END month the fixture's Tradays
  // file happens to carry must not land either
  assert.equal(v("2026-08"), mcAt("2026-08"), "post-window tail is Moneycontrol's");
  assert.equal(v("1997-06"), mcAt("1997-06"), "pre-window head is Moneycontrol's");
  assert.equal(v("2014-09"), mcAt("2014-09"), "window end is exclusive — 2014-09 is Moneycontrol's");
  // the wire override sticks even with the Tradays window covering it
  assert.equal(v("2011-08"), -8, "Aug 2011 is the wire-verified figure");
  // idempotency: second run says unchanged even with dirty sources present
  const again = run2();
  const stA = JSON.parse(again.out.trim().split("\n").at(-1).replace(/^CONFIDENCE_HISTORY_STATUS /, ""));
  assert.equal(stA.added.nabConfidence.length, 0, "second run over unchanged fixtures files nothing");
}
console.log("4. NAB confidence merge/precedence/hole-fill: OK");

/* ------------------------------------------------ 3. committed data sanity */
{
  const doc = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "confidence-history.json"), "utf8"));
  assert.deepEqual(Object.keys(doc), ["_about", "consumer", "business", "westpacConsumer", "nabConditions", "nabConfidence"]);
  assert.ok(doc.consumer.rows.length >= 550 && doc.consumer.rows[0].ym === "1973-03");
  assert.ok(doc.business.rows.length >= 170 && doc.business.rows[0].ym === "2010-12");
  assert.ok(doc.westpacConsumer.rows.length >= 600 && doc.westpacConsumer.rows[0].ym === "1974-09");
  assert.ok(doc.nabConditions.rows.length >= 340 && doc.nabConditions.rows[0].ym === "1997-03");
  assert.ok(doc.nabConfidence.rows.length >= 340 && doc.nabConfidence.rows[0].ym === "1997-03");
  /* the westpac lane's character rows: the pre-2010 OECD mirror (whole
     index points) against the printed record's iconic months, and the
     2010 seam where H3's decimals take over */
  const wpv = (ym) => doc.westpacConsumer.rows.find((r) => r.ym === ym).v;
  assert.equal(wpv("1974-09"), 91, "series inception: OECD balance -9");
  assert.equal(wpv("1990-11"), 64, "all-time low month, Nov 1990");
  assert.equal(wpv("2005-01"), 128, "all-time high month, Jan 2005");
  assert.equal(wpv("2020-04"), 75.6, "covid trough exact (H3's decimal — post-seam month)");
  assert.equal(wpv("2008-07"), 79, "GFC-era 79 (mirror whole point)");
  assert.equal(wpv("2009-12"), 114, "pre-seam mirror figure (balance 14)");
  assert.equal(wpv("2010-01"), 120.1, "H3 decimal at the seam month");
  /* the NAB confidence lane's wire-verified character rows */
  const nbv = (ym) => doc.nabConfidence.rows.find((r) => r.ym === ym).v;
  assert.equal(nbv("1997-03"), 9, "series' first mirrored month (Moneycontrol head)");
  assert.equal(nbv("2008-12"), -20, "GFC chain start (Crikey)");
  assert.equal(nbv("2009-01"), -32, "the all-time record low month");
  assert.equal(nbv("2010-12"), -3, "Dec-10's late wave (ibtimes: 'retreated … to minus three in the final month of 2010')");
  assert.equal(nbv("2011-01"), 4, "Jan-11 on-time wave beside it");
  assert.equal(nbv("2011-08"), -8, "SMH/AAP wire figure, neither mirror's");
  assert.equal(nbv("2020-03"), -66, "COVID all-time low");
  const pre2010 = doc.westpacConsumer.rows.filter((r) => r.ym < "2010-01");
  assert.ok(pre2010.every((r) => Number.isInteger(r.v)), "pre-2010 mirror months are whole index points");
  // consumer monthly-contiguous from 1987-01 through the newest row
  const yms = new Set(doc.consumer.rows.map((r) => r.ym));
  const end = doc.consumer.rows.at(-1).ym;
  let [y, m] = [1987, 1];
  for (;;) {
    const ym = `${y}-${String(m).padStart(2, "0")}`;
    if (ym >= end) break;
    assert.ok(yms.has(ym), `committed consumer history missing ${ym}`);
    m++; if (m > 12) { m = 1; y++; }
  }
  console.log("3. committed data/confidence-history.json: OK",
    Object.fromEntries(["consumer", "business", "westpacConsumer", "nabConditions", "nabConfidence"].map((k) => [k, doc[k].rows.length])));
}
/* --------------------------- 5. committed-file degradation contracts --
   Not regenerating anything: assertions on the same file stage 3 read.
   A lane that goes QUIET (upstream stalls) must never shrink its history —
   the extractor is append-only and months only join, so a regression of
   the newest month by more than two survey months of lag vs the previous
   run, or any lane going sub-floor, is a degradation. All figures must be
   figures: a row holds {ym, v} and v is a number — never a label, a date
   stamp, a forecast value, or NaN. */
{
  const doc = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "confidence-history.json"), "utf8"));
  const floors = { consumer: 550, business: 170, westpacConsumer: 600, nabConditions: 340, nabConfidence: 340 };
  for (const [k, floor] of Object.entries(floors)) {
    const lane = doc[k];
    assert.ok(lane && Array.isArray(lane.rows), `${k}: lane present`);
    assert.ok(lane.rows.length >= floor, `${k}: ${lane.rows.length} rows above the degradation floor ${floor}`);
    const now = new Date();
    const endIdx = +lane.rows.at(-1).ym.slice(0, 4) * 12 + (+lane.rows.at(-1).ym.slice(5, 7) - 1);
    const nowIdx = now.getFullYear() * 12 + now.getMonth();
    // source-of-record lag: the deepest lag any upstream cadence honestly
    // has is NAB/RBA H3 (prints a month+ behind) and RM's mirror pages —
    // six stale months is a quiet-source stall, not a lag
    assert.ok(nowIdx - endIdx <= 6, `${k}: newest row ${lane.rows.at(-1).ym} within six months of now (quiet-source stall tripped)`);
    for (const r of lane.rows) {
      assert.deepEqual(Object.keys(r), ["ym", "v"], `${k}: row carries ym+v only (a ${k} row grew a label/date field)`);
      assert.match(r.ym, /^\d{4}-(0[1-9]|1[0-2])$/, `${k}: well-formed survey month`);
      assert.equal(typeof r.v, "number", `${k}: figure is a number, never a label`);
      assert.ok(Number.isFinite(r.v), `${k}: figure is finite`);
    }
    // months strictly increasing — the lanes are survey-month series
    const yms = lane.rows.map((r) => r.ym);
    assert.deepEqual([...yms].sort(), yms, `${k}: rows in survey order`);
  }
  // the NAB confidence lane specifically: the mirrors' published figures
  // only — the whole point of the lane is that NOTHING is derived
  const nab = doc.nabConfidence.rows;
  const nabSet = new Set(nab.map((r) => r.ym));
  for (const ym of monthsFrom("2012-07", "2013-01")) assert.ok(nabSet.has(ym), `Moneycontrol's hole at ${ym} is filled from Tradays`);
  assert.equal(nab.find((r) => r.ym === "2011-08").v, -8, "Aug 2011 is the wire-verified −8, not a mirror's −9/−7");
  console.log("5. degradation contracts: OK");
}
console.log("all confidence-history tests passed");
