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
const { parseSdmxCsv, periodEnd, periodOrd, yoyFromLevels, printedRows, absFiltered,
        HANDOFF_DRIFT, MIN_ROWS, BAND, STALE_DAYS } = await import("./macro.mjs");

/* ---------------------------------------------------------------- 1. pure */
assert.equal(periodEnd("2026-Q3"), "2026-09-30");
assert.equal(periodEnd("2026-Q1"), "2026-03-31");
assert.equal(periodEnd("2026-Q4"), "2026-12-31");
assert.equal(periodEnd("2026-02"), "2026-02-28");
assert.equal(periodEnd("2024-02"), "2024-02-29", "leap February counts");
assert.equal(periodEnd("junk"), null);
assert.equal(periodOrd("2026-Q3"), 2026 * 4 + 2);
assert.equal(periodOrd("2026-09"), 2026 * 12 + 8);
assert.ok(Number.isNaN(periodOrd("2026")));

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
  try { out = execFileSync("node", [MACRO, "--fixture-dir", dir], { cwd: tmp, encoding: "utf8", env, timeout: 120000 }); }
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
   - OECD CPI: 68 printed months; OECD GDP: 186 printed quarters */
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
const oecdCpiCsv = (rows) => [
  "DATAFLOW,REF_AREA,FREQ,METHODOLOGY,MEASURE,UNIT_MEASURE,EXPENDITURE,ADJUSTMENT,TRANSFORMATION,TIME_PERIOD,OBS_VALUE,OBS_STATUS,UNIT_MULT,BASE_PER,DURABILITY,DECIMALS",
  ...rows.map((v, i) => {
    const y = 2021 + Math.floor(i / 12), m = (i % 12) + 1;
    return `OECD.SDD.TPS:DSD_PRICES@DF_PRICES_ALL(1.0),OECD,M,N,CPI,PA,_T,N,GY,${y}-${String(m).padStart(2, "0")},${v},A,,,,2`;
  }),
].join("\n") + "\n";
const g20CpiCsv = (rows) => [
  "DATAFLOW,REF_AREA,FREQ,METHODOLOGY,MEASURE,UNIT_MEASURE,EXPENDITURE,ADJUSTMENT,TRANSFORMATION,TIME_PERIOD,OBS_VALUE,OBS_STATUS,UNIT_MULT,BASE_PER,DURABILITY,DECIMALS",
  ...rows.map((v, i) => {
    const y = 2021 + Math.floor(i / 12), m = (i % 12) + 1;
    return `OECD.SDD.TPS:DSD_PRICES@DF_PRICES_ALL(1.0),G20,M,N,CPI,PA,_T,N,GY,${y}-${String(m).padStart(2, "0")},${v},A,,,,2`;
  }),
].join("\n") + "\n";
const oecdGdpCsv = (rows) => [
  "DATAFLOW,REF_AREA,FREQ,MEASURE,UNIT_MEASURE,ACTIVITY,ADJUSTMENT,TRANSFORMATION,TIME_PERIOD,OBS_VALUE,OBS_STATUS,UNIT_MULT,DECIMALS,BASE_PER",
  ...rows.map((v, i) => {
    const y = 1980 + Math.floor(i / 4), q = (i % 4) + 1;
    return `OECD.SDD.STES:DSD_KEI@DF_KEI(4.0),OECD,Q,B1GQ_Q,GR,_T,Y,GY,${qIso(y, q)},${v},,0,1,`;
  }),
].join("\n") + "\n";

const CPI_MONTHLY = [4.3, 4.4, 4.5, 4.5, 4.6, 4.6, 4.6, 4.5, 4.6];  // drift 0–0.1 vs the 4.5 quarterly line
const OECD_CPI = Array.from({ length: 68 }, (_, i) => Math.round((1.5 + i * 0.05) * 10) / 10);
const G20_CPI = Array.from({ length: 68 }, (_, i) => Math.round((2.0 + i * 0.02) * 10) / 10);
const OECD_GDP = Array.from({ length: 186 }, (_, i) => Math.round((2.0 + 1.5 * Math.sin(i / 8)) * 10) / 10);

const writeFixtures = (dir, { cpiMonthly = CPI_MONTHLY, oecdCpi = OECD_CPI } = {}) => {
  fs.writeFileSync(path.join(dir, "abs-cpi-index.csv"), absIdxCsv);
  fs.writeFileSync(path.join(dir, "abs-cpi-yoy.csv"), absMonthlyCpiCsv(cpiMonthly));
  fs.writeFileSync(path.join(dir, "abs-gdppc.csv"), absGdpCsv);
  fs.writeFileSync(path.join(dir, "oecd-cpi.csv"), oecdCpiCsv(oecdCpi));
  fs.writeFileSync(path.join(dir, "g20-cpi.csv"), g20CpiCsv(G20_CPI));
  fs.writeFileSync(path.join(dir, "oecd-gdp.csv"), oecdGdpCsv(OECD_GDP));
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
assert.equal(st.rows.gdppc, 210 - 4);
assert.equal(st.rows.oecdCpi, 68);
assert.equal(st.rows.g20Cpi, 68);
assert.equal(st.rows.oecdGdp, 186);
assert.equal(st.newest.cpi, "2026-09-30");
assert.equal(st.newest.cpiMonthly, "2026-09-30");
assert.equal(st.newest.gdppc, "2026-06-30");
assert.ok(Math.abs(st.cpiHandoffDrift - 0.1) < 1e-9, "printed↔derived handoff drift is the fixture's known 0.1pt");
const doc = JSON.parse(fs.readFileSync(path.join(tmp, "data", "macro.json"), "utf8"));
assert.equal(doc.cpi.rows[0].v, 4.5, "index-derived y/y rounds the fixture's known ratio");
assert.equal(doc.cpi.rows[0].date, "1962-03-31", "first y/y is the fifth quarter on file");
assert.deepEqual(doc.gdppc.rows[0], { date: "1975-03-31", v: 2.0 });
assert.equal(doc.cpiMonthly.rows.at(-1).v, 4.6);
assert.equal(doc.oecdCpi.rows.at(-1).v, OECD_CPI.at(-1));
assert.equal(doc.g20Cpi.rows.at(-1).v, G20_CPI.at(-1));

/* second run, untouched upstream: writes nothing */
r = run(FIX);
assert.equal(r.status, 0, r.out);
assert.equal(statusOf(r.out).changed, false, "idempotent on an unchanged upstream");

/* a printed CPI wave out of its plausible band guards (exit 2), never files */
{
  const d = fs.mkdtempSync("/tmp/macro-test-band-");
  fs.writeFileSync(path.join(d, "abs-cpi-index.csv"), absIdxCsv);
  fs.writeFileSync(path.join(d, "abs-cpi-yoy.csv"), absMonthlyCpiCsv([4.3, 4.4, 4.5, 4.6, 4.6, 4.6, 4.6, 4.6, 31]));
  fs.writeFileSync(path.join(d, "abs-gdppc.csv"), absGdpCsv);
  fs.writeFileSync(path.join(d, "oecd-cpi.csv"), oecdCpiCsv(OECD_CPI));
  fs.writeFileSync(path.join(d, "g20-cpi.csv"), g20CpiCsv(G20_CPI));
  fs.writeFileSync(path.join(d, "oecd-gdp.csv"), oecdGdpCsv(OECD_GDP));
  const rr = run(d);
  assert.equal(rr.status, 2, "band breach must exit 2: " + rr.out);
  assert.ok(rr.out.includes("outside band"), rr.out);
}
/* a quarterly reform that splits the printed monthly era from the derived
   quarterly line also guards (the handoff drift trip) */
{
  const d = fs.mkdtempSync("/tmp/macro-test-drift-");
  fs.writeFileSync(path.join(d, "abs-cpi-index.csv"), absIdxCsv);
  fs.writeFileSync(path.join(d, "abs-cpi-yoy.csv"), absMonthlyCpiCsv([4.3, 4.4, 4.5, 4.6, 4.6, 4.6, 4.6, 4.6, 6.6]));
  fs.writeFileSync(path.join(d, "abs-gdppc.csv"), absGdpCsv);
  fs.writeFileSync(path.join(d, "oecd-cpi.csv"), oecdCpiCsv(OECD_CPI));
  fs.writeFileSync(path.join(d, "g20-cpi.csv"), g20CpiCsv(G20_CPI));
  fs.writeFileSync(path.join(d, "oecd-gdp.csv"), oecdGdpCsv(OECD_GDP));
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
const KEYS = ["cpi", "cpiMonthly", "gdppc", "oecdCpi", "g20Cpi", "oecdGdp"];
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
assert.ok(live.oecdCpi.rows[0].date <= "1975-01-01", "OECD CPI reaches the 70s");
assert.ok(live.g20Cpi.rows[0].date <= "2005-01-01", "G20 CPI reaches the late 90s");
assert.ok(live.oecdGdp.rows[0].date <= "1970-01-01", "OECD GDP reaches the 60s");
assert.ok(live.cpiMonthly.rows[0].date >= "2024-01-01", "the printed monthly CPI lane is the complete-monthly era");
/* the handoff the extractor certified really is tight on disk */
{
  const qByDate = new Map(live.cpi.rows.map((x) => [x.date, x.v]));
  const diffs = live.cpiMonthly.rows.filter((m) => qByDate.has(m.date)).map((m) => Math.abs(m.v - qByDate.get(m.date)));
  assert.ok(diffs.length >= 1, "quarterly and monthly eras intersect for the check");
  assert.ok(Math.max(...diffs) <= HANDOFF_DRIFT, `committed quarterly↔monthly drift ${Math.max(...diffs).toFixed(1)}pt ≤ ${HANDOFF_DRIFT}`);
}
console.log("3. committed data/macro.json: OK");
console.log("test-macro: OK");
