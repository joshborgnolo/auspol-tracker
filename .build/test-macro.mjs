/* Tests for macro.mjs — the ABS/OECD extractor behind data/macro.json and
   the Economic sentiment panel's "Inflation & growth" view. Three stages:
     1. MACRO_LIB import: pure-helper pins (period parsing/ends, yoy
        derivation from an index, printed rows, key-part filtering).
     2. --fixture-dir subprocess: synthetic CSVs drive the whole pipeline in
        a temp cwd — splice + drift report, idempotency, and the band/drift
        GUARD trips exiting 2.
     3. Live structural pins on the committed data/macro.json (drift-tolerant:
        counts and spans are >=, cadence bounds are the extractor's own).
   Run: node .build/test-macro.mjs */
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MACRO = path.join(ROOT, ".build", "macro.mjs");

process.env.MACRO_LIB = "1";
const { xlsxSeriesRows, hhIncomeLevels, absPageChart, GINI, parseSdmxCsv, periodEnd, periodOrd, yoyFromLevels, printedRows, medianOf, medianCpiLane,
        parseReleaseTable1, spliceMedianLane, monthAdd, absFiltered, ausGapLane,
        OECD_MEMBERS, MEMBER_NAMES, MED_MIN, targetOf, medianGapFor, spliceGapLane, DEV_MIN,
        MED_HANDOFF, MED_AGG_DRIFT, HANDOFF_DRIFT, MIN_ROWS, BAND, STALE_DAYS } = await import("./macro.mjs");

/* ---------------------------------------------------------------- 1. pure */
assert.equal(periodEnd("2026-Q3"), "2026-09-30");
assert.equal(periodEnd("2026-Q1"), "2026-03-31");
assert.equal(periodEnd("2026-Q4"), "2026-12-31");
assert.equal(periodEnd("2026-02"), "2026-02-28");
assert.equal(periodEnd("2024-02"), "2024-02-29", "leap February counts");
assert.equal(periodEnd("2026-S1"), "2026-05-31", "the AWE semi-annual S1 is May");
assert.equal(periodEnd("2026-S2"), "2026-11-30", "and S2 November");
assert.equal(periodEnd("2026"), "2026-12-31", "a lone year ends at December");
assert.equal(periodEnd("junk"), null);
assert.equal(periodOrd("2026-Q3"), 2026 * 4 + 2);
assert.equal(periodOrd("2026-09"), 2026 * 12 + 8);
assert.equal(periodOrd("2026-S1"), 2026 * 12 + 4);
assert.equal(periodOrd("2026-S2"), 2026 * 12 + 10);
assert.equal(periodOrd("2026"), 2026 * 12 + 11);
assert.ok(Number.isNaN(periodOrd("junk")));

/* y/y of a steadily 1%-per-quarter index is 1.01^4−1 = 4.0604 → 4.1; the
   first four quarters carry no base and never emit */
{
  const quarter = (i) => `${2020 + Math.floor(i / 4)}-Q${(i % 4) + 1}`;
  const levels = Array.from({ length: 12 }, (_, i) => ({ TIME_PERIOD: quarter(i), OBS_VALUE: String(100 * Math.pow(1.01, i)) }));
  const rows = yoyFromLevels(levels, 4);
  assert.equal(rows.length, 8);
  assert.deepEqual(rows[0], { date: "2021-03-31", v: 4.1 });
  assert.deepEqual(rows.at(-1), { date: "2022-12-31", v: 4.1 });
}
/* y/y skips an ordinal whose prior-year observation is missing (the early
   1950s-shaped gap never invents a figure) */
{
  const levels = [
    { TIME_PERIOD: "2020-Q1", OBS_VALUE: "100" },
    { TIME_PERIOD: "2020-Q2", OBS_VALUE: "101" },
    // 2020-Q3/Q4 and 2021-Q1 missing
    { TIME_PERIOD: "2021-Q2", OBS_VALUE: "103" },
    { TIME_PERIOD: "2021-Q3", OBS_VALUE: "104" },
  ];
  const rows = yoyFromLevels(levels, 4);
  assert.deepEqual(rows, [{ date: "2021-06-30", v: 2.0 }], "only the paired quarter emits");
}
/* monthly frequency: months 13 and 14 of a fourteen-month series both emit */
{
  const levels = Array.from({ length: 14 }, (_, i) => {
    const y = 2020 + Math.floor(i / 12), m = (i % 12) + 1;
    return { TIME_PERIOD: `${y}-${String(m).padStart(2, "0")}`, OBS_VALUE: String(100 + i) };
  });
  const rows = yoyFromLevels(levels, 12);
  assert.deepEqual(rows, [{ date: "2021-01-31", v: 12.0 }, { date: "2021-02-28", v: 11.9 }]);
}
/* printed rows pass through sorted, periods only */
assert.deepEqual(printedRows([
  { TIME_PERIOD: "2026-Q2", OBS_VALUE: "1.9" },
  { TIME_PERIOD: "2026-Q1", OBS_VALUE: "1.7" },
  { TIME_PERIOD: "bad", OBS_VALUE: "x" },
]), [{ date: "2026-03-31", v: 1.7 }, { date: "2026-06-30", v: 1.9 }]);
/* key-part filter rides the column names, never the positions */
assert.equal(absFiltered(parseSdmxCsv(
  "DATAFLOW,MEASURE,INDEX,TSEST,REGION,FREQ,TIME_PERIOD,OBS_VALUE\n" +
  "ABS:CPI(2.0.0),1,10001,10,50,Q,2026-Q3,178.5\n" +
  "ABS:CPI(2.0.0),1,999904,20,50,Q,2026-Q3,142.1\n" +
  "ABS:CPI(2.0.0),3,10001,10,50,Q,2026-Q3,4.3\n"
), { MEASURE: 1, INDEX: 10001, TSEST: 10, REGION: 50 }).length, 1);
/* medianOf: odd takes the middle, even the middle pair's mean */
assert.equal(medianOf([7]), 7);
assert.equal(medianOf([3, 1, 2]), 2);
assert.equal(medianOf([1, 2, 3, 4]), 2.5);
/* the OECD member median: a month files only at MED_MIN or more members;
   aggregates and non-members never count */
{
  const m = (area, v, t = "2020-01") => ({ REF_AREA: area, TIME_PERIOD: t, OBS_VALUE: String(v) });
  const grid = (n) => Array.from({ length: n }, (_, i) => m([...OECD_MEMBERS][i], 1 + i));
  assert.equal(medianCpiLane(grid(20)).length, 0, `below MED_MIN (${MED_MIN}) the month never files`);
  const lane = medianCpiLane([...grid(26), m("G20", 99), m("XXX", 55), m("usa", 77)]);
  assert.equal(lane.length, 1);
  assert.equal(lane[0].date, "2020-01-31");
  assert.ok(Math.abs(lane[0].v - 13.5) < 0.05, `median of 1..26 → 13.5 (got ${lane[0].v})`);
}
assert.equal(monthAdd("2025-12", 2), "2026-02");
assert.equal(monthAdd("2025-11", 2), "2026-01");
assert.equal(monthAdd("2026-11", -2), "2026-09");

/* targetOf: segments engage at their fromRef and are null beforehand;
   band targets land at their midpoints; Denmark rides the peg */
assert.equal(targetOf("NZL", "1990-03"), null);
assert.equal(targetOf("NZL", "1990-04"), 1);
assert.equal(targetOf("NZL", "1998-01"), 1.5);
assert.equal(targetOf("NZL", "2002-09"), 2);
assert.equal(targetOf("AUS", "1996-08"), 2.5, "the RBA's 2–3% at its midpoint");
assert.equal(targetOf("USA", "2011-12"), null, "the Fed declares no target before Jan 2012");
assert.equal(targetOf("USA", "2012-01"), 2);
assert.equal(targetOf("DNK", "2020-01"), null, "Denmark pegs the krone — never in the gap line");
/* medianGapFor: the median of (print − target midpoint) over members
   with BOTH, floored at DEV_MIN */
{
  const figs = { AUS: 4.3, JPN: 2.1, DNK: 9.9 };
  assert.equal(medianGapFor(figs, "2013-06"), null, "0–2 targeters cannot fill a median month");
}
{
  const figs = {};
  // 16 members incl. Denmark — the peg never carries a target, so exactly
  // DEV_MIN=15 ride the deviation
  [...OECD_MEMBERS].slice(0, DEV_MIN + 1).forEach((iso, i) => (figs[iso] = 3.0 + i));
  const g = medianGapFor(figs, "2026-06");
  assert.ok(g && g.n === DEV_MIN, `a ${DEV_MIN}-member month files (n? ${g && g.n})`);
  assert.ok(Number.isFinite(g.v));
}
/* spliceGapLane: DF era ≤ Dec 2025, store era past it, overlap refs
   re-drifted for the handoff; floats land near, not on, my arithmetic */
{
  const sdmx = [{ date: "2025-12-31", v: 2.4 }, { date: "2026-01-31", v: 99 }];
  const figs = Object.fromEntries([...OECD_MEMBERS].slice(0, 25).map((iso, i) => [iso, 3.35 + 0.1 * i]));
  const s = spliceGapLane(sdmx, { releases: {
    "2025-12": { median: 2.4, figures: figs },
    "2026-01": { median: 2.3, figures: figs },
  } });
  assert.deepEqual(s.rows.map((x) => x.date), ["2025-12-31", "2026-01-31"], "_store-era rows splice past DF's future rows");
  assert.ok(Math.abs(s.rows[1].v - 2.55) < 0.06, `25 members 3.35+0.1i vs Dec-2025 targets → ~2.55 (got ${s.rows[1].v})`);
  assert.ok(Math.abs(s.handoff - 0.15) < 0.06, `overlap drift ~|2.55−2.4| (got ${s.handoff})`);
}

/* ausGapLane: headline minus the RBA band midpoint, opening with the
   band's adoption quarter and riding the printed monthly era afterwards */
{
  const q = (d, v) => ({ date: d, v });
  const rows = ausGapLane(
    [q("1990-03-31", 8.0), q("1996-06-30", 3.1), q("1996-09-30", 2.0), q("2025-03-31", 1.9)],
    [q("2025-04-30", 3.0), q("2025-05-31", 2.8)]
  );
  assert.deepEqual(rows.map((x) => x.date), ["1996-09-30", "2025-03-31", "2025-04-30", "2025-05-31"], "only the target era rides; quarters stop at the monthly seam");
  assert.deepEqual(rows[0], { date: "1996-09-30", v: -0.5 }, "2.0 − 2.5 at the adoption quarter");
  assert.equal(rows.at(-1).v, 0.3);
  assert.equal(ausGapLane([], []).length, 0, "no CPI era, no deviation");
}

/* parseReleaseTable1: a synthetic standard-edition release — 26 members at
   2.0+i/10 → median 3.3 (3.25 rounds away from zero); the OECD print
   cross-checks within MED_AGG_DRIFT; aggregate rows and `..` cells never
   enter the median; kerning gaps inside names ("Norw ay") and footnote
   numbers strip clean. cols=17 builds the year-end (average-column)
   edition with the headline at the shifted offset. */
const MED26 = [...OECD_MEMBERS].slice(0, 26);
const relText = ({ agg = "4.0", cols = 16, kGap = false, drop = 0 } = {}) => {
  const myy = cols === 16 ? ["Mar-25", "Feb-26", "Mar-26"] : ["Dec-24", "Nov-25", "Dec-25"];
  const mon = myy[2] === "Mar-26" ? "March 2026" : "December 2025";
  const k = cols === 16 ? 2 : 4;
  const headAvg = cols === 17 ? ["2024", "2025"] : [];
  const mkrow = (vk) => Array.from({ length: cols }, (_, i) => (i === k ? String(vk) : "…")).join("   ");
  const rows = [
    "Consumer Prices, OECD – Updated: 6 May 2026",
    "Table 1 – CPI and HICP, OECD countries and zone aggregates",
    mon + ", year-on-year inflation rate (%) and contributions to year-on-year CPI inflation (percentage points)",
    "        CPI and HICP heading words with no dates on this line",
    "      " + [...headAvg, ...myy, ...myy, ...myy].join("     ") + "   more heading text",
    "     OECD    " + mkrow(agg),
    "     G7 2    " + mkrow("3.0"),
  ];
  let i = 0;
  for (const iso of MED26) {
    let name = MEMBER_NAMES[iso];
    if (kGap && name === "Germany") name = "Germ any";
    const v = 2.0 + 0.1 * i++;
    rows.push("     " + name + (iso === "CAN" ? " 4, 5" : "") + "   " + mkrow(v.toFixed(1)));
  }
  for (let d = 0; d < drop; d++) rows.pop();
  rows.push("Table 2 – Consumer prices, All items, Food, Energy & All items excluding food & energy, selected countries");
  return rows.join("\n");
};
{
  const p = parseReleaseTable1(relText());
  assert.ok(p, "standard edition parses");
  assert.equal(p.ref, "2026-03");
  assert.equal(Object.keys(p.figures).length, 26);
  assert.ok(!("G7" in p.figures) && !("OECD" in p.figures), "aggregate rows never enter the median");
  assert.equal(p.median, 3.3, "26 members 2.0..4.5 → median of the 13th/14th 3.25 rounds away from zero");
  assert.equal(p.oecd, 4.0);
  assert.ok(Math.abs(p.figures.CAN - 2.3) < 1e-9, `footnote numbers strip before the cells (CAN 4th member → 2.3, got ${p.figures.CAN})`);
}
{
  const p = parseReleaseTable1(relText({ kGap: true }));
  assert.ok(p && Math.abs(p.figures.DEU - (2.0 + 0.1 * MED26.indexOf("DEU"))) < 1e-9, "kerning-gap name still matches");
}
{
  const p = parseReleaseTable1(relText({ cols: 17 }));
  assert.ok(p, "year-end (annual-average) edition parses");
  assert.equal(p.ref, "2025-12");
  assert.equal(p.median, 3.3, "headline column found at the average-edition offset");
}
assert.equal(parseReleaseTable1(relText({ drop: 1, agg: "9.0" })), null, `median-vs-OECD drift beyond ${MED_AGG_DRIFT} rejects (column shift)`);
assert.equal(parseReleaseTable1(relText({ drop: 3 })), null, `under-${MED_MIN} members never files`);
assert.equal(parseReleaseTable1("no table anywhere"), null, "no Table 1 → null");
/* splice: DF_PRICES_ALL owns ≤ Dec 2025, the store extends past it;
   overlap refs recompute their medians for the handoff check */
{
  const sdmx = [{ date: "2025-11-30", v: 2.7 }, { date: "2025-12-31", v: 2.7 }, { date: "2026-01-31", v: 99 }];
  // odd-count middles so the committed median field and the recomputation
  // agree exactly: 25 members centred on the 13th
  const figs = (mid) => Object.fromEntries(MED26.slice(0, 25).map((iso, i) => [iso, mid - 1.2 + 0.1 * i]));
  const store = { releases: {
    "2025-12": { median: 2.8, figures: figs(2.8) },
    "2026-01": { median: 4.3, figures: figs(4.3) },
  } };
  const s = spliceMedianLane(sdmx, store);
  assert.deepEqual(s.rows.map((x) => x.date), ["2025-11-30", "2025-12-31", "2026-01-31"], "future SDMX rows are cut, store era spliced");
  assert.equal(s.rows.at(-1).v, 4.3);
  assert.ok(Math.abs(s.handoff - 0.1) < 1e-9, `overlap drift |2.8−2.7| = 0.1 (got ${s.handoff})`);
  assert.equal(s.corrupt.length, 0);
  const bad = spliceMedianLane(sdmx, { releases: { "2026-01": { median: 9.9, figures: figs(4.3) } } });
  assert.deepEqual(bad.corrupt, ["2026-01"], "a committed median ≠ its own figures is corrupt");
}
/* the household income account workbook: the series is found by its
   named range, never by column position; column A's Excel serials are the
   quarters (46174 = 2026-06-01, the ABS's quarter stamp); rows outside the
   range and string cells are skipped; a non-quarter month refuses */
{
  const workbook = `<workbook><sheets><sheet name="Index" sheetId="3" r:id="rId1"/><sheet name="Data1" sheetId="1" r:id="rId2"/></sheets>` +
    `<definedNames><definedName name="A2302939L">Data1!$C$1:$C$10,Data1!$C$11:$C$12</definedName>` +
    `<definedName name="A2302939L_Data">Data1!$C$11:$C$12</definedName></definedNames></workbook>`;
  const rels = `<Relationships><Relationship Id="rId2" Type="x/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId1" Type="x/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`;
  const sheet = (aSerial2) => `<sheetData><row r="10"><c r="A10" t="s"><v>3</v></c><c r="C10" t="s"><v>4</v></c></row>` +
    `<row r="11" spans="1:3"><c r="A11" s="9"><v>46082</v></c><c r="B11"><v>1</v></c><c r="C11" s="8"><v>390000</v></c></row>` +
    `<row r="12"><c r="A12" s="9"><v>${aSerial2}</v></c><c r="B12"><v>2</v></c><c r="C12" s="8"><v>395500</v></c></row>` +
    `<row r="13"><c r="A13"><v>46266</v></c><c r="C13"><v>1</v></c></row></sheetData>`;
  const rows = xlsxSeriesRows({ workbook, rels, sheets: { "worksheets/sheet2.xml": sheet(46174), "worksheets/sheet1.xml": "" } }, "A2302939L");
  assert.deepEqual(rows, [{ TIME_PERIOD: "2026-Q1", OBS_VALUE: "390000" }, { TIME_PERIOD: "2026-Q2", OBS_VALUE: "395500" }]);
  assert.throws(() => xlsxSeriesRows({ workbook, rels, sheets: { "worksheets/sheet2.xml": sheet(46143) } }, "A2302939L"), /not a quarter's last month/);
  assert.throws(() => xlsxSeriesRows({ workbook, rels, sheets: {} }, "A9999999X"), /names no A9999999X_Data/);
}
/* real household income per person = GDI ÷ (HFCE current ÷ volume) ÷
   (GDP ÷ GDP per capita): $2,000m over a deflator of 1.25 over a
   population of 1m (GDP $50,000m ÷ $50,000 a head) is $1,600 a head; a
   quarter missing any input drops out */
{
  const r = (t, v, m) => ({ TIME_PERIOD: t, OBS_VALUE: String(v), ...(m ? { MEASURE: m } : {}) });
  const lv = hhIncomeLevels([r("2026-Q1", 2000), r("2026-Q2", 2100)],
    [r("2026-Q1", 1250, "C"), r("2026-Q1", 1000, "VCH"), r("2026-Q2", 1300, "C")],
    [r("2026-Q1", 50000), r("2026-Q2", 50000)], [r("2026-Q1", 50000), r("2026-Q2", 50000)]);
  assert.equal(lv.length, 1, "2026-Q2 has no chain-volume consumption and drops");
  assert.equal(lv[0].TIME_PERIOD, "2026-Q1");
  assert.ok(Math.abs(+lv[0].OBS_VALUE - 1600) < 1e-9);
}
/* absPageChart: the ABS page's hidden chart data, found by caption and
   column header, financial years filed at 30 June, 3dp as printed */
{
  const block = (cap, heads, data) => `<div class="chart-data-wrapper"><pre class="chart-caption">${cap}</pre><pre class="chart-headers">${JSON.stringify(heads).replace(/"/g, "&quot;")}</pre><pre class="chart-data">${JSON.stringify(data).replace(/"/g, "&quot;")}</pre></div>`;
  const html = block("Gini coefficient for wealth (a)", ["", "HILDA (b)", "SIH (c)"], [["2002-03"], [[0.6289]], [[null]]])
    + block("Gini coefficient for income (a)", ["", "HILDA (b)", "SIH (c)"], [["2002-03", "2003-04", "1999-00"], [[0.2992], [0.2896], [null]], [[null], [0.306], [0.31]]]);
  assert.deepEqual(absPageChart(html, GINI.hilda.caption, GINI.hilda.column), [{ date: "2003-06-30", v: 0.299 }, { date: "2004-06-30", v: 0.29 }], "the income chart, not the wealth one; HILDA's 4dp at the printed 3dp");
  assert.deepEqual(absPageChart(html, /^Gini coefficient for income\b/, /^SIH\b/), [{ date: "2004-06-30", v: 0.306 }, { date: "2000-06-30", v: 0.31 }], "nulls skipped; 1999-00 ends in 2000");
  assert.throws(() => absPageChart(html, /^Graph \d+\. Gini/, /^Gini coefficient$/), /no chart captioned/);
  assert.throws(() => absPageChart(html, GINI.hilda.caption, /^Nope$/), /no column/);
  assert.throws(() => absPageChart(block("Gini coefficient for income", ["", "HILDA"], [["2002"], [[0.3]]]), GINI.hilda.caption, GINI.hilda.column), /not a financial year/);
}
console.log("1. pure helpers: OK");

/* ------------------------------------------------------- 2. full pipeline */
const tmp = fs.mkdtempSync(path.join(fs.realpathSync.native ? "/tmp/" : "/tmp/", "macro-test-"));
fs.mkdirSync(path.join(tmp, "data"));
const FIX = path.join(tmp, "fixtures");
fs.mkdirSync(FIX);
const run = (dir, extra = {}) => {
  const env = { ...process.env, ...extra };
  delete env.MACRO_LIB;
  let out = "", status = 0;
  const cwd = extra.CWD || tmp;
  fs.mkdirSync(path.join(cwd, "data"), { recursive: true });
  try { out = execFileSync("node", [MACRO, "--fixture-dir", dir], { cwd, encoding: "utf8", env, timeout: 120000 }); }
  catch (e) { status = e.status; out = (e.stdout || "") + (e.stderr || ""); }
  return { out, status };
};
const qIso = (year, q) => `${year}-Q${q}`;
/* synthetic fixtures with EXACT known shapes:
   - CPI index: 263 quarters 1961-Q1→2026-Q3, index 3.5 * 1.011^(i) → the
     y/y of every quarter rounds to 4.5
   - printed monthly CPI: 9 months of the complete-monthly era, drifting
     0.1–0.4pt off the derived quarterly line (inside the handoff guard)
   - GDP-pc levels: 210 quarters 1974-Q1→2026-Q2, *1.005^q → y/y 2.0
   - RNNDI-pc levels: 210 quarters 1974-Q1→2026-Q2, *1.006^q → y/y 2.4
   - unemployment rate: 584 months 1978-02→2026-09, constant 4.44567…
     (ABS-shaped 8-decimal precision → the lane rounds to the published
     4.4)
   - OECD CPI: one merged all-areas feed — the OECD aggregate (68 printed
     months) plus a 26-member, 846-month grid for the median lane
     (member i = 2.0+0.2i → every month's median 4.5, constant); the
     same grid rides CB_TARGETS for the deviation lane, whose 1999-09
     start (15 with-both members) and medians are pinned below
   - OECD GDP: 186 printed quarters */
const absIdxCsv = (() => {
  const rows = ["DATAFLOW,MEASURE,INDEX,TSEST,REGION,FREQ,TIME_PERIOD,OBS_VALUE,UNIT_MEASURE,OBS_STATUS,DECIMALS,OBS_COMMENT"];
  let y = 1961, q = 1;
  for (let i = 0; i < 263; i++) {
    rows.push(`ABS:CPI(2.0.0),1,10001,10,50,Q,${qIso(y, q)},${(3.5 * Math.pow(1.011, i)).toFixed(3)},,,,`);
    if (++q === 5) { q = 1; y++; }
  }
  return rows.join("\n") + "\n";
})();
const absMonthlyCpiCsv = (printed) => [
  "DATAFLOW,MEASURE,INDEX,TSEST,REGION,FREQ,TIME_PERIOD,OBS_VALUE,UNIT_MEASURE,OBS_STATUS,DECIMALS,OBS_COMMENT,BASE_PERIOD",
  ...printed.map((v, i) => `ABS:CPI(2.0.0),3,10001,10,50,M,2026-${String(i + 1).padStart(2, "0")},${v},PCT,,1,,17`),
].join("\n") + "\n";
const absGdpCsv = (() => {
  const rows = ["DATAFLOW,MEASURE,DATA_ITEM,TSEST,REGION,FREQ,TIME_PERIOD,OBS_VALUE,UNIT_MEASURE,UNIT_MULT,OBS_STATUS,OBS_COMMENT"];
  let y = 1974, q = 1;
  for (let i = 0; i < 210; i++) {
    rows.push(`ABS:ANA_AGG(1.0.0),M1,GPM_PCA,20,AUS,Q,${qIso(y, q)},${(20000 * Math.pow(1.005, i)).toFixed(2)},,,,`);
    if (++q === 5) { q = 1; y++; }
  }
  return rows.join("\n") + "\n";
})();
/* the household income lane's inputs, 1974-Q1 → 210 quarters: GDP
   300,000·1.007^i over the GDP-per-capita fixture's 20,000·1.005^i is the
   population; consumption volume 100,000·1.006^i at a deflator of
   0.5·1.01^i; disposable income 60,000·1.015^i. Real income a head is then
   8,000·HH_R^i, HH_R = 1.015·1.005/(1.01·1.007). */
const HH_R = (1.015 * 1.005) / (1.01 * 1.007);
const qRows = (n, f) => { const out = []; let y = 1974, q = 1; for (let i = 0; i < n; i++) { out.push(f(qIso(y, q), i)); if (++q === 5) { q = 1; y++; } } return out; };
const absGdpTotCsv = ["DATAFLOW,MEASURE,DATA_ITEM,TSEST,REGION,FREQ,TIME_PERIOD,OBS_VALUE,UNIT_MEASURE,UNIT_MULT,OBS_STATUS,OBS_COMMENT",
  ...qRows(210, (t, i) => `ABS:ANA_AGG(1.0.0),M1,GPM,20,AUS,Q,${t},${300000 * Math.pow(1.007, i)},AUD,6,,`)].join("\n") + "\n";
const absHfceCsv = ["DATAFLOW,MEASURE,DATA_ITEM,SECTOR,TSEST,REGION,FREQ,TIME_PERIOD,OBS_VALUE,UNIT_MEASURE,UNIT_MULT,OBS_STATUS,OBS_COMMENT",
  ...qRows(210, (t, i) => `ABS:ANA_EXP(1.0.0),VCH,FCE,PHS,20,AUS,Q,${t},${100000 * Math.pow(1.006, i)},AUD,6,,`),
  ...qRows(210, (t, i) => `ABS:ANA_EXP(1.0.0),C,FCE,PHS,20,AUS,Q,${t},${100000 * Math.pow(1.006, i) * 0.5 * Math.pow(1.01, i)},AUD,6,,`)].join("\n") + "\n";
const absHhGdiCsv = ["TIME_PERIOD,OBS_VALUE", ...qRows(210, (t, i) => `${t},${60000 * Math.pow(1.015, i)}`)].join("\n") + "\n";
const absRnndiCsv = (() => {
  const rows = ["DATAFLOW,MEASURE,DATA_ITEM,TSEST,REGION,FREQ,TIME_PERIOD,OBS_VALUE,UNIT_MEASURE,UNIT_MULT,OBS_STATUS,OBS_COMMENT"];
  let y = 1974, q = 1;
  for (let i = 0; i < 210; i++) {
    rows.push(`ABS:ANA_AGG(1.0.0),M1,NNDI_PCA,20,AUS,Q,${qIso(y, q)},${(14000 * Math.pow(1.006, i)).toFixed(2)},,,,`);
    if (++q === 5) { q = 1; y++; }
  }
  return rows.join("\n") + "\n";
})();
/* 584 monthly unemployment-rate rows 1978-02→2026-09, the LF download's
   own 8-decimal shape — downstream rounding to the published 1dp is the
   lane's job and is pinned below */
const absUnempCsv = (() => {
  const rows = ["DATAFLOW,MEASURE,SEX,AGE,TSEST,REGION,FREQ,TIME_PERIOD,OBS_VALUE,UNIT_MEASURE,UNIT_MULT,OBS_STATUS,OBS_COMMENT,DECIMALS"];
  let y = 1978, m = 2;
  for (let i = 0; i < 584; i++) {
    rows.push(`ABS:LF(1.0.0),M13,3,1599,20,AUS,M,${y}-${String(m).padStart(2, "0")},4.44567890,PCT,0,,,1`);
    if (++m === 13) { m = 1; y++; }
  }
  return rows.join("\n") + "\n";
})();
/* the merged all-areas CPI feed (ONE file: the OECD aggregate rides the
   same pull as every member country's series; the deviation lane rides
   the same month grid through CB_TARGETS).
   26 member countries ride 846 months 1956-01 → 2026-06 at member i
   = 2.0 + 0.2i every month — the 26-member MEDIAN of each month is
   (4.4+4.6)/2 = 4.5 exactly, and the ≤ Dec-2025 splice keeps 840 of
   the grid's months in the median lane. Months past 2025-12 sit in
   the feed to prove the splice, not the pull, owns the store era. */
const MED_MONTHS = Array.from({ length: 846 }, (_, i) => `${1956 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`);
const MED_HEAD = "DATAFLOW,REF_AREA,FREQ,METHODOLOGY,MEASURE,UNIT_MEASURE,EXPENDITURE,ADJUSTMENT,TRANSFORMATION,TIME_PERIOD,OBS_VALUE,OBS_STATUS,UNIT_MULT,BASE_PER,DURABILITY,DECIMALS";
const oecdRow = (area, t, v) => `OECD.SDD.TPS:DSD_PRICES@DF_PRICES_ALL(1.0),${area},M,N,CPI,PA,_T,N,GY,${t},${v},A,,,,2`;
const oecdCpiMerged = (oecdVals) => {
  const lines = [MED_HEAD];
  const ym = (i) => `${2021 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`;
  oecdVals.forEach((v, i) => lines.push(oecdRow("OECD", ym(i), v)));
  MED_MONTHS.forEach((t) => MED26.forEach((c, ci) => lines.push(oecdRow(c, t, (2.0 + ci * 0.2).toFixed(2)))));
  return lines.join("\n") + "\n";
};
/* the OECD per-capita GDP index, the dashboard download's own shape:
   77 quarters 2007-Q1 → 2026-Q1 at 100·1.004^i (2dp, as printed) */
const oecdGdppcCsv = (n) => [
  "DATAFLOW,FREQ,REF_AREA,MEASURE,UNIT_MEASURE,TIME_PERIOD,OBS_VALUE,ADJUSTMENT,SECTOR,ACCOUNTING_ENTRY,TRANSACTION,INSTR_ASSET,PRICE_BASE,TRANSFORMATION,REF_YEAR_PRICE,BASE_PER,CONF_STATUS,DECIMALS,OBS_STATUS,UNIT_MULT",
  ...Array.from({ length: n }, (_, i) => `OECD.SDD.NAD:DSD_HHDASH@DF_HHDASH_INDIC(1.1),Q,OECD,B1GQ_R_POP,IX,${qIso(2007 + Math.floor(i / 4), (i % 4) + 1)},${(100 * Math.pow(1.004, i)).toFixed(2)},Y,S1,B,B1GQ_POP,_Z,LR,IX,2020,2007-Q1,F,2,A,0`),
].join("\n") + "\n";

/* the ABS pages' hidden chart block: n financial years from y0–(y0+1),
   one column of values per extra header */
const giniPage = (cap, heads, y0, n, ...cols) => {
  const cats = Array.from({ length: n }, (_, i) => `${y0 + i}-${String((y0 + i + 1) % 100).padStart(2, "0")}`);
  const data = [cats, ...cols.map((f) => cats.map((_, i) => f(i)))];
  const q = (x) => JSON.stringify(x).replace(/"/g, "&quot;");
  return `<html><body><div class="chart-data-wrapper" style="display:none;"><pre class="chart-caption">${cap}</pre><pre class="chart-headers">${q(heads)}</pre><pre class="chart-data">${q(data)}</pre></div></body></html>`;
};
/* ABS productivity: ANA_AGG M5 GDP-per-hour-worked index, 190 quarters
   1980-Q1 → 2027-Q2, 55·1.0035^q → stays inside the [40, 150] level band,
   y/y ≈ 1.4 every quarter */
const absProdCsv = (() => {
  const rows = ["DATAFLOW,MEASURE,DATA_ITEM,TSEST,REGION,FREQ,TIME_PERIOD,OBS_VALUE,UNIT_MEASURE,UNIT_MULT,OBS_STATUS,OBS_COMMENT"];
  let y = 1980, q = 1;
  for (let i = 0; i < 190; i++) {
    rows.push(`ABS:ANA_AGG(1.0.0),M5,GPM_PHW,20,AUS,Q,${qIso(y, q)},${(55 * Math.pow(1.0035, i)).toFixed(3)},,,,`);
    if (++q === 5) { q = 1; y++; }
  }
  return rows.join("\n") + "\n";
})();
/* ABS AWE (cat 6302), semi-annual 2010-S1 → 2022-S2 (26 halves), nominal
   1000·1.04^half: against the CPI index's ~4.49%/y climb the real year
   change pins at 3.5 every row */
const absAweCsv = (() => {
  const rows = ["DATAFLOW,MEASURE,ESTIMATE_TYPE,SEX,SECTOR,INDUSTRY,TSEST,REGION,FREQ,TIME_PERIOD,OBS_VALUE,UNIT_MEASURE,OBS_STATUS,OBS_COMMENT,UNIT_MULT"];
  let i = 0;
  for (let y = 2010; y <= 2022; y++) for (const s of ["S1", "S2"]) {
    rows.push(`ABS:AWE(1.0.0),3,1,3,7,TOT,20,AUS,S,${y}-${s},${(1000 * Math.pow(1.04, i)).toFixed(1)},AUD,,,0`);
    i++;
  }
  return rows.join("\n") + "\n";
})();
/* OECD member GDP growth: 26 members × 260 quarters 1961-Q1 → 2025-Q4;
   member i prints 2.0+0.08i every quarter — with the pop fixture's steady
   0.7%/y, the per-capita median pins at 2.3 every quarter */
const oecdGdpGrowthCsv = (() => {
  const rows = ["DATAFLOW,REF_AREA,FREQ,MEASURE,UNIT_MEASURE,PRICE_BASE,TRANSFORMATION,ADJUSTMENT,TIME_PERIOD,OBS_VALUE,OBS_STATUS,UNIT_MULT,BASE_PER,DECIMALS"];
  for (let qi = 0; qi < 260; qi++) {
    const t = `${1961 + Math.floor(qi / 4)}-Q${(qi % 4) + 1}`;
    MED26.forEach((c, i) => rows.push(`OECD.SDD.STES:DSD_KEI@DF_KEI(4.0),${c},Q,B1GQ_Q,GR,_T,Y,GY,${t},${(2.0 + 0.08 * i).toFixed(2)},A,0,1961-Q1,2`));
  }
  return rows.join("\n") + "\n";
})();
/* OECD population, annual: 26 members × years 1960→2025; member i's
   level (i+1)·10000·1.007^(y−1960) → every member's population y/y is 0.7 */
const oecdPopCsv = (() => {
  const rows = ["DATAFLOW,REF_AREA,MEASURE,UNIT_MEASURE,SEX,AGE,TIME_HORIZ,TIME_PERIOD,OBS_VALUE,OBS_STATUS,UNIT_MULT,DECIMALS"];
  MED26.forEach((c, i) => {
    for (let y = 1960; y <= 2025; y++) rows.push(`OECD.ELS.SAE:DSD_POPULATION@DF_POP_HIST(1.0),${c},POP,PS,_T,_T,H,${y},${((i + 1) * 10000 * Math.pow(1.007, y - 1960)).toFixed(0)},A,0,0`);
  });
  return rows.join("\n") + "\n";
})();
/* OECD monthly harmonised unemployment: 26 members × 360 months
   1996-01 → 2025-12, member i prints 4.0 + 0.05i → monthly median 4.6 */
const oecdUnempCsv = (() => {
  const rows = ["DATAFLOW,REF_AREA,MEASURE,UNIT_MEASURE,TRANSFORMATION,ADJUSTMENT,SEX,AGE,ACTIVITY,FREQ,TIME_PERIOD,OBS_VALUE,BASE_PER,OBS_STATUS,UNIT_MULT,DECIMALS"];
  for (let m = 0; m < 360; m++) {
    const t = `${1996 + Math.floor(m / 12)}-${String((m % 12) + 1).padStart(2, "0")}`;
    MED26.forEach((c, i) => rows.push(`OECD.SDD.TPS:DSD_LFS@DF_IALFS_UNE_M(1.0),${c},UNE_LF_M,PT_LF_SUB,_Z,Y,_T,Y_GE15,_Z,M,${t},${(4.0 + i * 0.05).toFixed(2)},,A,0,2`));
  }
  return rows.join("\n") + "\n";
})();
/* OECD output per worker growth: 26 members × 120 quarters 1996-Q1 →
   2025-Q4, member i prints 1.0 + 0.1i → quarterly median 2.3 */
const oecdProdCsv = (() => {
  const rows = ["DATAFLOW,REF_AREA,FREQ,MEASURE,ACTIVITY,UNIT_MEASURE,PRICE_BASE,TRANSFORMATION,ADJUSTMENT,CONVERSION_TYPE,TIME_PERIOD,OBS_VALUE,OBS_STATUS,UNIT_MULT,BASE_PER,DECIMALS"];
  for (let qi = 0; qi < 120; qi++) {
    const t = `${1996 + Math.floor(qi / 4)}-Q${(qi % 4) + 1}`;
    MED26.forEach((c, i) => rows.push(`OECD.SDD.TPS:DSD_PDB@DF_PDB_ULC_Q(1.0),${c},Q,GDPEMP,_T,PA,Q,GY,S,NC,${t},${(1.0 + i * 0.1).toFixed(2)},A,0,,2`));
  }
  return rows.join("\n") + "\n";
})();
/* OECD real wages, annual: 26 members × years 1990→2025, member i's
   level (2000+50i)·1.034^(y−1990) → every member's y/y is 3.4 → the
   median year change is 3.4 every year */
const oecdWageCsv = (() => {
  const rows = ["DATAFLOW,REF_AREA,MEASURE,UNIT_MEASURE,PAY_PERIOD,PRICE_BASE,AGGREGATION_OPERATION,SEX,TIME_PERIOD,OBS_VALUE,OBS_STATUS,UNIT_MULT,DECIMALS"];
  MED26.forEach((c, i) => {
    for (let y = 1990; y <= 2025; y++) rows.push(`OECD.ELS.SAE:DSD_EARNINGS@AV_AN_WAGE(1.0),${c},WG,USD_PPP,A,Q,MEAN,_Z,${y},${((2000 + 50 * i) * Math.pow(1.034, y - 1990)).toFixed(2)},A,0,1`);
  });
  return rows.join("\n") + "\n";
})();
/* OECD Gini, annual: 26 members × years 2011→2023, member i prints
   0.28 + 0.002i → the median coefficient pins at 0.305 */
const oecdGiniCsv = (() => {
  const rows = ["DATAFLOW,REF_AREA,FREQ,MEASURE,STATISTICAL_OPERATION,UNIT_MEASURE,AGE,METHODOLOGY,DEFINITION,POVERTY_LINE,TIME_PERIOD,OBS_VALUE,OBS_STATUS,UNIT_MULT,DECIMALS"];
  MED26.forEach((c, i) => {
    for (let y = 2011; y <= 2023; y++) rows.push(`OECD.WISE.INE:DSD_WISE_IDD@DF_IDD(1.0),${c},A,INC_DISP_GINI,_Z,0_TO_1,_T,METH2012,D_CUR,_Z,${y},${(0.28 + i * 0.002).toFixed(3)},A,0,3`);
  });
  return rows.join("\n") + "\n";
})();
const CPI_MONTHLY = [4.3, 4.4, 4.5, 4.5, 4.6, 4.6, 4.6, 4.5, 4.6];  // drift 0–0.1 vs the 4.5 quarterly line
const OECD_CPI = Array.from({ length: 68 }, (_, i) => Math.round((1.5 + i * 0.05) * 10) / 10);

const writeFixtures = (dir, { cpiMonthly = CPI_MONTHLY, oecdCpi = OECD_CPI } = {}) => {
  fs.writeFileSync(path.join(dir, "abs-cpi-index.csv"), absIdxCsv);
  fs.writeFileSync(path.join(dir, "abs-cpi-yoy.csv"), absMonthlyCpiCsv(cpiMonthly));
  fs.writeFileSync(path.join(dir, "abs-gdppc.csv"), absGdpCsv);
  fs.writeFileSync(path.join(dir, "abs-rnndi.csv"), absRnndiCsv);
  fs.writeFileSync(path.join(dir, "abs-gdp.csv"), absGdpTotCsv);
  fs.writeFileSync(path.join(dir, "abs-hfce.csv"), absHfceCsv);
  fs.writeFileSync(path.join(dir, "abs-hh-gdi.csv"), absHhGdiCsv);
  fs.writeFileSync(path.join(dir, "abs-unemp.csv"), absUnempCsv);
  fs.writeFileSync(path.join(dir, "oecd-cpi.csv"), oecdCpiMerged(oecdCpi));
  fs.writeFileSync(path.join(dir, "oecd-gdppc.csv"), oecdGdppcCsv(77));
  fs.writeFileSync(path.join(dir, "abs-prod.csv"), absProdCsv);
  fs.writeFileSync(path.join(dir, "abs-awe.csv"), absAweCsv);
  fs.writeFileSync(path.join(dir, "oecd-gdp-growth.csv"), oecdGdpGrowthCsv);
  fs.writeFileSync(path.join(dir, "oecd-pop.csv"), oecdPopCsv);
  fs.writeFileSync(path.join(dir, "oecd-unemp.csv"), oecdUnempCsv);
  fs.writeFileSync(path.join(dir, "oecd-prod.csv"), oecdProdCsv);
  fs.writeFileSync(path.join(dir, "oecd-wage.csv"), oecdWageCsv);
  fs.writeFileSync(path.join(dir, "oecd-gini.csv"), oecdGiniCsv);
  fs.writeFileSync(path.join(dir, "abs-mwm-gini.html"), giniPage("Gini coefficient for income (a)", ["", "HILDA (b)", "SIH (c)"], 2002, 21, (i) => [0.30 + i / 1000], () => [null]));
  fs.writeFileSync(path.join(dir, "abs-sih-gini.html"), giniPage("Graph 3. Gini coefficient of equivalised disposable household income, 1994–95 to 2019–20", ["", "Gini coefficient"], 1994, 16, (i) => [0.32]));
};
writeFixtures(FIX);

const statusOf = (out) => JSON.parse(out.trim().split("\n").find((l) => l.startsWith("MACRO_STATUS ")).slice("MACRO_STATUS ".length));

/* first run: writes, all lanes sized to their fixtures' spacings */
let r = run(FIX);
assert.equal(r.status, 0, "guard: " + r.out);
const st = statusOf(r.out);
assert.equal(st.changed, true);
assert.equal(st.rows.cpi, 263 - 4);
assert.equal(st.rows.cpiMonthly, 9);
assert.equal(st.rows.ausGap, 127, "118 target-era quarters + the 9 printed months");
assert.equal(st.rows.gdppc, 210 - 4);
assert.equal(st.rows.rnndi, 210 - 4);
assert.equal(st.rows.hhdi, 210 - 4);
assert.equal(st.rows.hhdiLevel, 210);
assert.equal(st.newest.hhdi, "2026-06-30");
assert.equal(st.rows.unemp, 584, "the labour-force series 1978-02→2026-09");
assert.equal(st.rows.oecdCpi, 68);
assert.equal(st.rows.oecdCpiMed, 840, "846 grid months minus the 2026 months the splice hands to the store era");
assert.equal(st.rows.oecdCpiGap, 316, "the gap lane runs 1999-09→2025-12 (15 with-both members at its start)");
assert.equal(st.rows.oecdGdppc, 77 - 4);
assert.equal(st.rows.giniHilda, 21);
assert.equal(st.newest.giniHilda, "2023-06-30", "2022-23 files at its year's end");
assert.equal(st.rows.giniSih, 16);
assert.equal(st.giniPending, null);
assert.equal(st.newest.oecdGdppc, "2026-03-31");
assert.deepEqual(JSON.parse(fs.readFileSync(path.join(tmp, "data", "macro.json"), "utf8")).oecdGdppc.rows[0], { date: "2008-03-31", v: 1.6 }, "1.004^4 index growth is y/y 1.6");
assert.equal(st.newest.cpi, "2026-09-30");
assert.equal(st.newest.cpiMonthly, "2026-09-30");
assert.equal(st.newest.gdppc, "2026-06-30");
assert.equal(st.newest.rnndi, "2026-06-30");
assert.equal(st.newest.unemp, "2026-09-30");
assert.equal(st.newest.oecdCpiMed, "2025-12-31", "the archive era caps at Dec 2025");
assert.equal(st.newest.oecdCpiGap, "2025-12-31", "the gap lane's archive era shares the median's cap");
assert.ok(Math.abs(st.cpiHandoffDrift - 0.1) < 1e-9, "printed↔derived handoff drift is the fixture's known 0.1pt");
const doc = JSON.parse(fs.readFileSync(path.join(tmp, "data", "macro.json"), "utf8"));
assert.equal(doc.cpi.rows[0].v, 4.5, "index-derived y/y rounds the fixture's known ratio");
assert.equal(doc.cpi.rows[0].date, "1962-03-31", "first y/y is the fifth quarter on file");
assert.deepEqual(doc.gdppc.rows[0], { date: "1975-03-31", v: 2.0 });
assert.deepEqual(doc.rnndi.rows[0], { date: "1975-03-31", v: 2.4 }, "1.006^4 levels growth is RNNDI y/y 2.4");
assert.deepEqual(doc.hhdiLevel.rows[0], { date: "1974-03-31", v: 8000 }, "$60,000m ÷ 0.5 ÷ 15m people");
assert.deepEqual(doc.hhdi.rows[0], { date: "1975-03-31", v: Math.round((HH_R ** 4 - 1) * 1000) / 10 }, "household income y/y off the composed growth rate");
assert.deepEqual(doc.giniHilda.rows[0], { date: "2003-06-30", v: 0.3 });
assert.deepEqual(doc.giniHilda.rows.at(-1), { date: "2023-06-30", v: 0.32 });
assert.deepEqual(doc.giniSih.rows[0], { date: "1995-06-30", v: 0.32 });
assert.deepEqual(doc.unemp.rows[0], { date: "1978-02-28", v: 4.4 }, "8-decimal source reads round to the published 4.4");
assert.deepEqual(doc.unemp.rows.at(-1), { date: "2026-09-30", v: 4.4 });
assert.equal(doc.cpiMonthly.rows.at(-1).v, 4.6);
assert.deepEqual(doc.ausGap.rows[0], { date: "1996-09-30", v: 2.0 }, "the deviation lane opens at the band's adoption quarter, 4.5 − 2.5");
assert.deepEqual(doc.ausGap.rows.at(-1), { date: "2026-09-30", v: 2.1 }, "newest printed month minus the midpoint");
assert.deepEqual(doc.ausGap.rows.at(-2), { date: "2026-08-31", v: 2.0 });
assert.equal(st.newest.ausGap, "2026-09-30");
assert.equal(doc.oecdCpi.rows.at(-1).v, OECD_CPI.at(-1));
/* the 26-member grid sits at 2.0+0.2i → every month's median is (4.4+4.6)/2 = 4.5 */
assert.deepEqual(doc.oecdCpiMed.rows[0], { date: "1956-01-31", v: 4.5 });
assert.deepEqual(doc.oecdCpiMed.rows.at(-1), { date: "2025-12-31", v: 4.5 });
/* the same grid through the targets table: 15 with-both members at
   1999-09 (Chile completes the floor) → median gap 2.2, the sorted
   list's 8th element; by 2025-12 (25 with-both) the gap reads 2.4 —
   both computed off the fixture grid's own arithmetic */
assert.deepEqual(doc.oecdCpiGap.rows[0], { date: "1999-09-30", v: 2.2 });
assert.deepEqual(doc.oecdCpiGap.rows.at(-1), { date: "2025-12-31", v: 2.4 });
assert.equal(doc.g20Cpi, undefined, "the G20 lane is gone from the panel (user call 2026-11-09)");
/* the added lanes (2026-11-16), each pinned to its fixture's own
   arithmetic: sizes ride the grids' spans, values the grids' constants */
assert.equal(st.rows.prod, 186, "190 quarterly index levels → 186 y/y prints");
assert.equal(st.rows.aweReal, 24, "26 semi-annual halves → 24 season-matched y/y prints");
assert.equal(st.rows.oecdGdpMed, 260, "26 members × quarters 1961→2025, all above the 25-member floor");
assert.equal(st.rows.oecdUnempMed, 360);
assert.equal(st.rows.oecdProdMed, 120);
assert.equal(st.rows.oecdWageMed, 35, "years 1991→2025 with a predecessor each");
assert.equal(st.rows.oecdGiniMed, 13);
assert.deepEqual(doc.prod.rows[0], { date: "1981-03-31", v: 1.4 }, "1.0035^4 index growth is y/y 1.4");
assert.deepEqual(doc.aweReal.rows[0], { date: "2011-05-31", v: 3.5 }, "nominal 8.16%/y ÷ CPI 4.49%/y is real 3.5%/y");
assert.equal(st.rows.prodLevel, 190, "the printed index files alongside the derived rate lane");
assert.deepEqual(doc.prodLevel.rows[0], { date: "1980-03-31", v: 55 }, "the ABS's printed index, untouched");
assert.deepEqual(doc.prodLevel.rows.at(-1).date, "2027-06-30");
assert.ok(Math.abs(doc.prodLevel.rows.at(-1).v - 55 * 1.0035 ** 189) < 0.001, "the printed index passed through");
assert.deepEqual(doc.aweReal.rows.at(-1), { date: "2022-11-30", v: 3.5 });
assert.deepEqual(doc.oecdGdpMed.rows[0], { date: "1961-03-31", v: 2.3 }, "median member 3.0 − population 0.7");
assert.deepEqual(doc.oecdGdpMed.rows.at(-1), { date: "2025-12-31", v: 2.3 });
assert.deepEqual(doc.oecdUnempMed.rows[0], { date: "1996-01-31", v: 4.6 }, "the 4.6/4.65 member pair's mean at 1dp");
assert.deepEqual(doc.oecdUnempMed.rows.at(-1), { date: "2025-12-31", v: 4.6 });
assert.deepEqual(doc.oecdProdMed.rows[0], { date: "1996-03-31", v: 2.3 }, "the 2.2/2.3 member pair's mean at 1dp");
assert.deepEqual(doc.oecdWageMed.rows[0], { date: "1991-12-31", v: 3.4 }, "every member's constant 3.4%/y");
assert.deepEqual(doc.oecdWageMed.rows.at(-1), { date: "2025-12-31", v: 3.4 });
assert.deepEqual(doc.oecdGiniMed.rows[0], { date: "2011-12-31", v: 0.305 }, "the 0.304/0.306 member pair's mean at 3dp");
assert.deepEqual(doc.oecdGiniMed.rows.at(-1), { date: "2023-12-31", v: 0.305 });

/* the committed median store extends the lane past the archive era: write
   a store by hand into the temp cwd (the fixture run's own cwd — never
   the repo's) and re-run: 2026-01…03 splice in, the 2025-12 overlap
   re-checks within the handoff, and a corrupt store entry trips the
   guard. */
{
  const storeAt = (t, store) => { fs.mkdirSync(path.join(t, ".build", "macro-src"), { recursive: true }); fs.writeFileSync(path.join(t, ".build", "macro-src", "oecd-member-inflation.json"), JSON.stringify(store, null, 1) + "\n"); };
  const figs = (base) => Object.fromEntries(MED26.map((iso, i) => [iso, Math.round((base + 0.1 * i) * 100) / 100]));
  // the figure bases keep median middle elements off the .x5 knife-edge:
  // medianOf recomputes exactly the committed medians (4.6/4.3/3.0/3.1)
  // and each store month's deviation middle lands clean at a non-.x5
  // value (the sorted 13th is just whichever member sits there)
  const store = { _about: "test", releases: {
    "2025-12": { release: "2026-02", url: "u", oecd: 4.4, median: 4.6, figures: figs(3.32) },
    "2026-01": { release: "2026-03", url: "u", oecd: 4.4, median: 4.3, figures: figs(3.02) },
    "2026-02": { release: "2026-04", url: "u", oecd: 4.6, median: 3.0, figures: figs(1.72) },
    "2026-03": { release: "2026-05", url: "u", oecd: 4.5, median: 3.1, figures: figs(1.82) },
  } };
  storeAt(tmp, store);
  r = run(FIX);
  assert.equal(r.status, 0, "store-era run: " + r.out);
  const st2 = statusOf(r.out);
  assert.equal(st2.rows.oecdCpiMed, 843, "three store months splice past the 840 archive rows");
  assert.equal(st2.rows.oecdCpiGap, 319, "316 archive gap months plus the three store months");
  assert.equal(st2.newest.oecdCpiMed, "2026-03-31");
  assert.equal(st2.newest.oecdCpiGap, "2026-03-31");
  assert.ok(Math.abs(st2.medHandoffDrift - 0.1) < 1e-9, `overlap ref 2025-12 drifts the fixture's 0.1 (got ${st2.medHandoffDrift})`);
  assert.ok(Math.abs(st2.devGapHandoffDrift - 0.2) < 0.06, `release gap 2.6 vs archive 2.4 drifts ~0.2 (got ${st2.devGapHandoffDrift})`);
  const doc2 = JSON.parse(fs.readFileSync(path.join(tmp, "data", "macro.json"), "utf8"));
  assert.deepEqual(doc2.oecdCpiMed.rows.at(-1), { date: "2026-03-31", v: 3.1 });
  assert.deepEqual(doc2.oecdCpiMed.rows.at(-4), { date: "2025-12-31", v: 4.5 }, "the overlap month stays the archive's print");
  assert.deepEqual(doc2.oecdCpiGap.rows.at(-3), { date: "2026-01-31", v: 2.3 }, "store-era gap median through the targets table");
  assert.deepEqual(doc2.oecdCpiGap.rows.at(-2), { date: "2026-02-28", v: 1.0 });
  assert.deepEqual(doc2.oecdCpiGap.rows.at(-1), { date: "2026-03-31", v: 1.1 });
  /* a store whose committed median doesn't recompute from its own figures
     trips the guard — hand-edited stores are caught here (these run in
     their own cwd: the store path is cwd-relative) */
  const d = fs.mkdtempSync("/tmp/macro-test-store-");
  writeFixtures(d);
  storeAt(d, { _about: "test", releases: { "2026-01": { release: "2026-03", url: "u", oecd: 4.4, median: 9.9, figures: figs(3.05) } } });
  const rr = run(d, { CWD: d });
  assert.equal(rr.status, 2, "corrupt store must exit 2: " + rr.out);
  assert.ok(rr.out.includes("median ≠"), rr.out);
  /* and a store month whose release-era median drifts too far off the
     archive's overlap month trips the handoff guard the same way */
  const d2 = fs.mkdtempSync("/tmp/macro-test-medhand-");
  writeFixtures(d2);
  storeAt(d2, { _about: "test", releases: { "2025-12": { release: "2026-02", url: "u", oecd: 4.4, median: 20.0, figures: figs(18.75) } } });
  const rr2 = run(d2, { CWD: d2 });
  assert.equal(rr2.status, 2, "release/archive handoff drift must exit 2: " + rr2.out);
  assert.ok(rr2.out.includes("handoff"), rr2.out);
  r = run(FIX); // restore the clean tmp run for the idempotency check below
  assert.equal(typeof r.out, "string");
}

/* second run, untouched upstream: writes nothing */
r = run(FIX);
assert.equal(r.status, 0, r.out);
assert.equal(statusOf(r.out).changed, false, "idempotent on an unchanged upstream");

/* a printed CPI wave out of its plausible band guards (exit 2), never files */
{
  const d = fs.mkdtempSync("/tmp/macro-test-band-");
  writeFixtures(d, { cpiMonthly: [4.3, 4.4, 4.5, 4.6, 4.6, 4.6, 4.6, 4.6, 31] });
  const rr = run(d);
  assert.equal(rr.status, 2, "band breach must exit 2: " + rr.out);
  assert.ok(rr.out.includes("outside band"), rr.out);
}
/* a quarterly reform that splits the printed monthly era from the derived
   quarterly line also guards (the handoff drift trip) */
{
  const d = fs.mkdtempSync("/tmp/macro-test-drift-");
  writeFixtures(d, { cpiMonthly: [4.3, 4.4, 4.5, 4.6, 4.6, 4.6, 4.6, 4.6, 6.6] });
  const rr = run(d);
  assert.equal(rr.status, 2, "handoff drift must exit 2: " + rr.out);
  assert.ok(rr.out.includes("handoff"), rr.out);
}
/* a fixture dir missing a source file fails the run, never falls back live */
{
  const d = fs.mkdtempSync("/tmp/macro-test-missing-");
  fs.writeFileSync(path.join(d, "abs-cpi-index.csv"), absIdxCsv);
  const rr = run(d);
  assert.equal(rr.status, 1, "missing fixture must exit 1: " + rr.out);
  assert.ok(rr.out.includes("fixture missing"), rr.out);
}
console.log("2. full pipeline: OK");

/* --------------------------------------- 3. the committed data/macro.json */
const live = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "macro.json"), "utf8"));
const KEYS = ["cpi", "cpiMonthly", "ausGap", "gdppc", "rnndi", "unemp", "oecdCpi", "oecdCpiMed", "oecdCpiGap", "oecdGdppc", "hhdi", "hhdiLevel", "giniHilda", "giniSih", "prod", "prodLevel", "aweReal", "oecdGdpMed", "oecdUnempMed", "oecdProdMed", "oecdWageMed", "oecdGiniMed"];
for (const k of KEYS) {
  assert.ok(live[k], `${k} lane present`);
  const rows = live[k].rows;
  assert.ok(Array.isArray(rows) && rows.length >= MIN_ROWS[k], `${k} spans its series (${rows.length} ≥ ${MIN_ROWS[k]})`);
  const [lo, hi] = BAND[k];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(row.date), `${k}#${i} date ISO`);
    assert.ok(i === 0 || row.date > rows[i - 1].date, `${k}#${i} ascending`);
    assert.ok(row.v >= lo && row.v <= hi, `${k} ${row.date}: ${row.v} inside [${lo}, ${hi}]`);
  }
  const age = (Date.now() - Date.parse(rows.at(-1).date + "T00:00:00Z")) / 864e5;
  assert.ok(age <= STALE_DAYS[k] * 1.5, `${k} newest ${rows.at(-1).date} is current (extractor's stale mark would have been ${STALE_DAYS[k]}d; ${Math.round(age)}d)`);
}
/* the deep-history spans the era each lane's documentation promises */
assert.ok(live.cpi.rows[0].date <= "1955-01-01", "quarterly CPI reaches the mid-50s");
assert.ok(live.gdppc.rows[0].date <= "1980-01-01", "GDP pc reaches the 70s");
assert.ok(live.rnndi.rows[0].date <= "1980-01-01", "RNNDI reaches the 70s");
assert.ok(live.hhdi.rows[0].date <= "1975-01-01", "household income reaches the 70s");
assert.equal(live.hhdi.rows.at(-1).date, live.gdppc.rows.at(-1).date, "household income keeps pace with the national accounts");
assert.ok(live.unemp.rows[0].date <= "1978-03-31", "the unemployment rate reaches its 1978 start");
assert.equal(live.unemp.rows[0].v.toFixed(1), String(live.unemp.rows[0].v), "the unemp lane files the published 1dp");
assert.ok(live.oecdCpi.rows[0].date <= "1975-01-01", "OECD CPI reaches the 70s");
assert.ok(live.oecdCpiMed.rows[0].date <= "1975-01-01", "OECD member median reaches the 70s");
assert.ok(live.oecdCpiGap.rows[0].date <= "1999-03-31", "the target-deviation lane opens 1999");
assert.equal(live.g20Cpi, undefined, "the G20 lane is gone from the file");
assert.ok(live.oecdGdppc.rows[0].date <= "2008-03-31", "OECD GDP per person opens with its index's first year-on-year, 2008");
assert.ok(live.giniHilda.rows[0].date <= "2003-06-30", "HILDA's Gini opens with 2002-03");
assert.ok(live.giniSih.rows[0].date <= "1995-06-30", "the ABS income survey's Gini opens with 1994-95");
assert.ok(live.giniSih.rows.every((r) => r.v > live.giniHilda.rows.find((h) => h.date === r.date)?.v - 0.005 || !live.giniHilda.rows.some((h) => h.date === r.date)), "the ABS survey runs at or above HILDA in shared years (why they stay two lines)");
assert.equal(live.oecdGdp, undefined, "the total-GDP lane gave way to per person (2026-11-16)");
assert.ok(live.prod.rows[0].date <= "1982-01-01", "GDP per hour worked reaches its 1979 first y/y");
assert.ok(live.aweReal.rows[0].date <= "2016-01-01", "real weekly earnings reaches its semi-annual era's opening years");
assert.ok(live.oecdGdpMed.rows[0].date <= "2000-01-01", "OECD median GDP per person reaches the 90s");
assert.ok(live.oecdUnempMed.rows[0].date <= "2000-01-01", "OECD median unemployment reaches the 90s");
assert.ok(live.oecdProdMed.rows[0].date <= "2000-01-01", "OECD median output per worker reaches the 90s");
assert.ok(live.oecdWageMed.rows[0].date <= "1995-01-01", "OECD median real wage reaches the early 90s");
assert.ok(live.oecdGiniMed.rows[0].date <= "2014-01-01", "OECD median Gini opens with its methodology era's 25-member years");
assert.ok(live.cpiMonthly.rows[0].date >= "2024-01-01", "the printed monthly CPI lane is the complete-monthly era");
assert.ok(live.ausGap.rows[0].date <= "1996-12-31", "Australia's deviation lane opens at the band's 1996 adoption");
/* the handoff the extractor certified really is tight on disk */
{
  const qByDate = new Map(live.cpi.rows.map((x) => [x.date, x.v]));
  const diffs = live.cpiMonthly.rows.filter((m) => qByDate.has(m.date)).map((m) => Math.abs(m.v - qByDate.get(m.date)));
  assert.ok(diffs.length >= 1, "quarterly and monthly eras intersect for the check");
  assert.ok(Math.max(...diffs) <= HANDOFF_DRIFT, `committed quarterly↔monthly drift ${Math.max(...diffs).toFixed(1)}pt ≤ ${HANDOFF_DRIFT}`);
}
console.log("3. committed data/macro.json: OK");
console.log("test-macro: OK");
