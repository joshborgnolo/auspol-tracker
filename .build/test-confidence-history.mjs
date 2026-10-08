/* Tests for confidence-history.mjs — the extractor behind data/confidence-history.json
   (the deep monthly back-history sibling of the confidence panel's data/confidence.json).
   Three stages, same shape as test-confidence.mjs:
     1. CONFIDENCE_HISTORY_LIB import: parseYearGrid / parseH3 / guardLane pins
        (footnote-marked cells, yearly-average column ignored, name-located
        H3 columns, contiguity/range/floor/first-month trips).
     2. --fixture-dir subprocess: synthetic full-depth fixtures drive the
        pipeline in a temp cwd — status shape, idempotency, --check, a
        guard trip on a shapeless page.
     3. Live structural pins on the committed data/confidence-history.json.
   Run: node .build/test-confidence-history.mjs */
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = path.join(ROOT, ".build", "confidence-history.mjs");

process.env.CONFIDENCE_HISTORY_LIB = "1";
const { parseYearGrid, parseH3, parseFredCci, guardLane } = await import("./confidence-history.mjs");

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
  const base = { consumer: 100, business: 110, westpac: 90, nab: 3 }[lane];
  const span = { consumer: 15, business: 12, westpac: 8, nab: 4 }[lane];
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
  assert.deepEqual(st.oldest, { consumer: "1973-03", business: "2010-12", westpacConsumer: "1974-09", nabConditions: "1997-03" });
  assert.deepEqual(st.newest, { consumer: "2026-09", business: "2026-05", westpacConsumer: "2026-10", nabConditions: "2026-08" });
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
}
console.log("2. fixture pipeline: OK");

/* ------------------------------------------------ 3. committed data sanity */
{
  const doc = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "confidence-history.json"), "utf8"));
  assert.deepEqual(Object.keys(doc), ["_about", "consumer", "business", "westpacConsumer", "nabConditions"]);
  assert.ok(doc.consumer.rows.length >= 550 && doc.consumer.rows[0].ym === "1973-03");
  assert.ok(doc.business.rows.length >= 170 && doc.business.rows[0].ym === "2010-12");
  assert.ok(doc.westpacConsumer.rows.length >= 600 && doc.westpacConsumer.rows[0].ym === "1974-09");
  assert.ok(doc.nabConditions.rows.length >= 340 && doc.nabConditions.rows[0].ym === "1997-03");
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
    Object.fromEntries(["consumer", "business", "westpacConsumer", "nabConditions"].map((k) => [k, doc[k].rows.length])));
}
console.log("all confidence-history tests passed");
