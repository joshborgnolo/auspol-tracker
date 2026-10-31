/* macro.mjs – builds data/macro.json, the ABS/OECD price and output series
   behind the "Inflation & growth" view of the Snapshot's Economic sentiment
   panel (rd-panels.jsx RdConfidence's third tab), and its Info glossary entry.
   Four display lanes, five source pulls — all OFFICIAL publications, fetched
   from the ABS and OECD public data APIs, never hand-entered:

     cpi        – all-groups CPI, Australia, annual change, quarterly 1949→.
                  ABS CPI dataflow: MEASURE 3 (percentage change to
                  corresponding period of previous year) is not published for
                  the old quarterly series, so history is derived here from
                  the ABS's own published INDEX NUMBERS (MEASURE 1,
                  INDEX 10001 "All groups CPI", original, eight capital
                  cities): v_t = idx_t / idx_{t−4} − 1. The ABS's own printed
                  y/y measure only begins with the complete monthly CPI era
                  and lives in cpiMonthly; the two lanes' overlap quarters are
                  cross-checked below (HANDOFF_DRIFT).
     cpiMonthly – the ABS's PRINTED monthly y/y measure (complete monthly
                  CPI, MEASURE 3 INDEX 10001), ~2025 →. The lane the panel's
                  read row and the current-era chart take from.
     gdppc      – real GDP per capita, Australia, annual change, quarterly.
                  ANA_AGG: M2 (chain-volume percentage changes) is quarterly
                  growth only, so the annual lane is derived from the ABS's
                  own chain-volume LEVELS (M1.GPM_PCA.20.AUS.Q, seasonally
                  adjusted): v_t = lvl_t / lvl_{t−4} − 1.
     oecdCpi    – OECD total, all-items CPI, y/y, monthly; the OECD's printed
                  measure (DF_PRICES_ALL: OECD.M.N.CPI.PA._T.N.GY), no
                  arithmetic on our side.
     oecdGdp    – OECD total real GDP, y/y, quarterly; the OECD's printed
                  growth measure (DF_KEI: OECD.Q.B1GQ_Q.GR._T.Y.GY, 1963→).
                  The OECD publishes no per-capita OECD-total growth series —
                  this is the closest official aggregate, and the lane is
                  labelled "OECD average GDP growth", never per-capita.

   Runs itself: the daily crosstabs pass (.build/crosstabs-updater.sh) runs
   it; every run re-reads the full series (history is revision-bearing in
   national accounts), diffs, and writes only on a change.

   Automation contract (same as the other extractors):
   - idempotent: re-running with unchanged upstream data writes nothing
   - exit 0 = success (changed or not); final stdout line is
     `MACRO_STATUS {json}` with changed, added, rows, newest, stale, drift
   - exit 1 = fetch/parse error; exit 2 = a safety guard tripped (a lane
     emptied out or shrank its span badly, a figure outside its plausible
     band, dates out of order, or the quarterly/monthly CPI handoff drifted
     apart — the ABS restating its basis is the shape that trips)
   - --check computes everything, prints MACRO_STATUS, never writes
   - --fixture-dir <dir> reads source CSVs from a fixture directory instead
     of the live APIs: abs-cpi-index.csv, abs-cpi-yoy.csv, abs-gdppc.csv,
     oecd-cpi.csv, oecd-gdp.csv (test seam; every file must be present,
     the run never falls back to live fetches in fixture mode) */
/* MACRO_LIB=1: import the pure helpers (tests) without running the pulls. */
import { readFileSync, existsSync } from "node:fs";
import { get as httpsGet } from "node:https";
import { setTimeout as sleep } from "node:timers/promises";
import { TRACKER_UA, FETCH_TRIES, FETCH_TIMEOUT_MS, writeAtomic } from "./extract-common.mjs";

const argv = process.argv.slice(2);
const CHECK = argv.includes("--check");
const FIXTURE_DIR = argv.includes("--fixture-dir") ? argv[argv.indexOf("--fixture-dir") + 1] : null;
const OUT = "data/macro.json";

// ---------------------------------------------------------------- sources
const ABS_BF = "https://data.api.abs.gov.au/rest/data";
const OECD_BF = "https://sdmx.oecd.org/public/rest/data";
const SOURCES = {
  cpiIndex: {
    fixture: "abs-cpi-index.csv",
    url: `${ABS_BF}/ABS,CPI,2.0.0/1.10001.10.50.Q`,
    accept: "application/vnd.sdmx.data+csv",
    cite: "ABS CPI (cat 6401.0), All groups CPI, index numbers, quarterly, eight capital cities — data API ABS,CPI measure 1, index 10001, original",
  },
  cpiYoy: {
    fixture: "abs-cpi-yoy.csv",
    url: `${ABS_BF}/ABS,CPI,2.0.0/3.10001.10.50.M`,
    accept: "application/vnd.sdmx.data+csv",
    cite: "ABS complete monthly CPI (cat 6401.0), all items CPI, percentage change to corresponding month of previous year — data API ABS,CPI measure 3, index 10001, original",
  },
  gdppcLvl: {
    fixture: "abs-gdppc.csv",
    url: `${ABS_BF}/ABS,ANA_AGG,1.0.0/M1.GPM_PCA.20.AUS.Q`,
    accept: "application/vnd.sdmx.data+csv",
    cite: "ABS Australian National Accounts (cat 5204.0/06), GDP per capita, chain volume measures, seasonally adjusted — data API ABS,ANA_AGG measure M1, item GPM_PCA",
  },
  oecdCpi: {
    fixture: "oecd-cpi.csv",
    url: `${OECD_BF}/OECD.SDD.TPS,DSD_PRICES@DF_PRICES_ALL,1.0/OECD.M.N.CPI.PA._T.N.GY/all`,
    accept: "text/csv",
    cite: "OECD Data Explorer, consumer prices: OECD total, all items CPI, percentage change on the same period of the previous year (DF_PRICES_ALL)",
  },
  oecdGdp: {
    fixture: "oecd-gdp.csv",
    url: `${OECD_BF}/OECD.SDD.STES,DSD_KEI@DF_KEI,4.0/OECD.Q.B1GQ_Q.GR._T.Y.GY/all`,
    accept: "text/csv",
    cite: "OECD Key short-term economic indicators (DF_KEI): OECD total, GDP volume, growth on the same quarter of the previous year — some latest rows carry the OECD's provisional flag",
  },
};

// Plausible annual-change bands per display lane (a breach guards, never
// files): Australia 1947→ sees CPI ~18% (1975) and ~−2% (1997/2020); OECD
// histories are tamer but padded on the same logic.
const BAND = { cpi: [-5, 30], cpiMonthly: [-5, 30], gdppc: [-12, 15], oecdCpi: [-5, 30], oecdGdp: [-12, 15] };
const MIN_ROWS = { cpi: 250, cpiMonthly: 6, gdppc: 200, oecdCpi: 60, oecdGdp: 40 };
const STALE_DAYS = { cpi: 210, cpiMonthly: 75, gdppc: 210, oecdCpi: 95, oecdGdp: 210 };
// The quarterly derived CPI lane and the monthly printed one measure the
// same series on different bases; overlap quarter-ends must sit within this
// drift or the ABS has restated a basis we shouldn't silently splice.
const HANDOFF_DRIFT = 1.5;

// ------------------------------------------------------------ csv parsing
// node:https, not undici fetch: OECD's NSI backend answers undici requests
// for CSV with deterministic HTTP 500s (diagnosed 2026-10-31 — same Accept
// and UA via node:https returns the CSV fine). ABS is indifferent; keep one
// code path for both.
function httpGet(url, accept, redirects = 5) {
  return new Promise((resolve, reject) => {
    const req = httpsGet(url, {
      headers: { "user-agent": TRACKER_UA, Accept: accept },
      timeout: FETCH_TIMEOUT_MS,
    }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        res.resume();
        if (redirects <= 0) return reject(new Error(`redirect chain: ${url.slice(0, 110)}…`));
        return resolve(httpGet(new URL(res.headers.location, url).href, accept, redirects - 1));
      }
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => resolve({ status: res.statusCode, body, retryAfter: parseInt(res.headers["retry-after"] || "", 10) || null }));
    });
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
  });
}

async function fetchCsv(url, accept) {
  let err = null;
  // OECD's NSI answers ANY burst (even a separate prior session's) with 429
  // over a minutes-scale cooling window — FETCH_TRIES at 1.5s never escapes.
  // 429s therefore get their own patient budget beyond the usual retries.
  const SLACK_429 = [10, 30, 60, 90, 150];
  for (let t = 0, t429 = 0;; t++) {
    try {
      const { status, body, retryAfter } = await httpGet(url, accept);
      if (status >= 200 && status < 300) {
        // Deterministic (retry-proof) failures: stale keys and changed
        // response shapes — throw straight through without the retry loop.
        if (/^NoRecordsFound/i.test(body.trim())) throw Object.assign(new Error(`no records: ${url.slice(0, 110)}…`), { fatal: true });
        if (!/^DATAFLOW,/m.test(body)) throw Object.assign(new Error(`not an SDMX CSV: ${url.slice(0, 110)}… (${body.slice(0, 60).trim()})`), { fatal: true });
        return body;
      }
      err = new Error(`fetch ${url.slice(0, 110)}… → HTTP ${status}`);
      if (status === 429) {
        if (t429 >= SLACK_429.length) break;
        await sleep(Math.max(retryAfter || 0, SLACK_429[t429++]) * 1000);
        continue;
      }
    } catch (e) {
      if (e.fatal) throw e;
      err = e;
    }
    if (t < FETCH_TRIES - 1) await sleep(1500);
    else break; // non-429 failures stay on the usual FETCH_TRIES budget
  }
  throw err;
}

const readSource = async (spec) => {
  if (FIXTURE_DIR) {
    const p = `${FIXTURE_DIR}/${spec.fixture}`;
    if (!existsSync(p)) throw new Error(`fixture missing: ${p}`);
    return readFileSync(p, "utf8");
  }
  return fetchCsv(spec.url, spec.accept);
};

/* Split an SDMX-CSV download into row objects keyed by the column names it
   declares. Values are NOT numerically coerced here. */
function parseSdmxCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const head = lines[0].split(",");
  return lines.slice(1).filter((l) => l.length).map((l) => {
    const cells = l.split(",");
    const o = {};
    head.forEach((h, i) => (o[h] = cells[i] ?? ""));
    return o;
  });
}

// last calendar day of a quarter "2026-Q3" or a month "2026-09" → ISO
function periodEnd(period) {
  let m = /^(\d{4})-Q([1-4])$/.exec(period);
  if (m) {
    const last = [31, 30, 30, 31][+m[2] - 1];
    return `${m[1]}-${String(+m[2] * 3).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
  }
  m = /^(\d{4})-(\d{2})$/.exec(period);
  if (m) return new Date(Date.UTC(+m[1], +m[2], 0)).toISOString().slice(0, 10);
  return null;
}
// ordinal for arithmetic: quarter → year*4+qtr, month → year*12+mo
function periodOrd(period) {
  let m = /^(\d{4})-Q([1-4])$/.exec(period);
  if (m) return +m[1] * 4 + (+m[2] - 1);
  m = /^(\d{4})-(\d{2})$/.exec(period);
  if (m) return +m[1] * 12 + (+m[2] - 1);
  return NaN;
}

/* A lane of {date, v} rows from level observations: every row's annual
   change relative to its own prior-year observation of the same period.
   step = ordinals per year (4 for quarters, 12 for months). */
function yoyFromLevels(levelRows, step) {
  const byOrd = new Map();
  for (const r of levelRows) {
    const o = periodOrd(r.TIME_PERIOD);
    const obs = parseFloat(r.OBS_VALUE);
    if (Number.isFinite(o) && Number.isFinite(obs) && obs > 0) byOrd.set(o, obs);
  }
  const out = [];
  const ords = [...byOrd.keys()].sort((a, b) => a - b);
  const qLabel = (o, s) => (s === 4 ? `${Math.floor(o / 4)}-Q${(o % 4) + 1}` : `${Math.floor(o / 12)}-${String((o % 12) + 1).padStart(2, "0")}`);
  for (const o of ords) {
    if (!byOrd.has(o - step)) continue;
    const v = (byOrd.get(o) / byOrd.get(o - step) - 1) * 100;
    out.push({ date: periodEnd(qLabel(o, step)), v: Math.round(v * 10) / 10 });
  }
  return out;
}

/* A lane of {date, v} rows straight from the publisher's printed measure. */
function printedRows(rows) {
  return rows
    .map((r) => ({ date: periodEnd(r.TIME_PERIOD), v: parseFloat(r.OBS_VALUE) }))
    .filter((x) => x.date && Number.isFinite(x.v))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// Row from an ABS CSV with the exact key-parts filter attached to the URL we
// fetched. The endpoint already filters, but a flow/DSD change could widen a
// response — the assertion keeps a surprise from landing silently.
function absFiltered(rows, want) {
  return rows.filter((r) => Object.entries(want).every(([k, v]) => String(r[k]) === String(v)));
}

function laneGuards(name, rows) {
  if (!rows.length) throw guard(`${name}: EMPTY lane`);
  if (rows.length < MIN_ROWS[name]) throw guard(`${name}: only ${rows.length} rows (< ${MIN_ROWS[name]}) — upstream span changed?`);
  const [lo, hi] = BAND[name];
  const off = rows.find((x) => x.v < lo || x.v > hi);
  if (off) throw guard(`${name} ${off.date}: ${off.v} outside band [${lo}, ${hi}]`);
  for (let i = 1; i < rows.length; i++) {
    if (rows[i].date <= rows[i - 1].date) throw guard(`${name}: dates not ascending at ${rows[i].date}`);
  }
}
function guard(msg) {
  console.error("GUARD TRIP: " + msg);
  process.exit(2);
}

// ------------------------------------------------------------------- main
export { parseSdmxCsv, periodEnd, periodOrd, yoyFromLevels, printedRows, absFiltered, HANDOFF_DRIFT, MIN_ROWS, BAND, STALE_DAYS };

if (!process.env.MACRO_LIB) {
  // Serial, with a breath between hosts: the OECD's NSI gates parallel
  // callers with 429s (firing five data pulls at once tripped it on
  // 2026-10-31), and five small CSVs don't earn fetch fan-out.
  const texts = {};
  for (const [k, spec] of Object.entries(SOURCES)) {
    texts[k] = await readSource(spec);
    await sleep(400);
  }
  const absCpiIdx = texts.cpiIndex, absCpiYoy = texts.cpiYoy, absGdp = texts.gdppcLvl;
  const oecdCpiRows = texts.oecdCpi, oecdGdpRows = texts.oecdGdp;

  // cpi — quarterly, derived from the ABS's own quarterly index numbers.
  const cpiLevels = absFiltered(parseSdmxCsv(absCpiIdx), { MEASURE: 1, INDEX: 10001, TSEST: 10, REGION: 50 });
  if (cpiLevels.length < 250) throw guard(`cpi index levels: ${cpiLevels.length} rows — key/basis changed upstream?`);
  const cpi = yoyFromLevels(cpiLevels, 4);

  // cpiMonthly — the ABS's printed monthly y/y measure (complete monthly CPI era).
  const cpiPrinted = absFiltered(parseSdmxCsv(absCpiYoy), { MEASURE: 3, INDEX: 10001, TSEST: 10, REGION: 50 });
  const cpiMonthly = printedRows(cpiPrinted);

  // gdppc — quarterly, derived from SA chain-volume GDP-per-capita levels.
  const gdpLevels = absFiltered(parseSdmxCsv(absGdp), { MEASURE: "M1", DATA_ITEM: "GPM_PCA", TSEST: 20, REGION: "AUS" });
  if (gdpLevels.length < 200) throw guard(`gdppc levels: ${gdpLevels.length} rows — key/basis changed upstream?`);
  const gdppc = yoyFromLevels(gdpLevels, 4);

  // OECD lanes — printed measures, no arithmetic.
  const oecdCpi = printedRows(parseSdmxCsv(oecdCpiRows).filter((r) => r.REF_AREA === "OECD"));
  const oecdGdp = printedRows(parseSdmxCsv(oecdGdpRows).filter((r) => r.REF_AREA === "OECD"));

  for (const [k, rows] of Object.entries({ cpi, cpiMonthly, gdppc, oecdCpi, oecdGdp })) laneGuards(k, rows);

  // Handoff cross-check: where the printed monthly series covers a quarter
  // end (Mar/Jun/Sep/Dec rows), it must sit near the quarterly derived row.
  let drift = null;
  {
    const qByDate = new Map(cpi.map((x) => [x.date, x.v]));
    const diffs = cpiMonthly.filter((m) => qByDate.has(m.date)).map((m) => Math.abs(m.v - qByDate.get(m.date)));
    if (diffs.length) {
      drift = Math.max(...diffs);
      if (drift > HANDOFF_DRIFT) throw guard(`cpi quarterly/monthly handoff drift ${drift.toFixed(1)}pt > ${HANDOFF_DRIFT} — ABS basis restated?`);
    }
  }

  const prev = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : null;
  const doc = {
    _about: "Official price and output series behind the Economic sentiment panel's 'Inflation & growth' view. cpi: all-groups CPI Australia, annual change, quarterly — derived here from the ABS's published quarterly index numbers (1949→; v = idx_t/idx_{t−4}−1, rounded to 1dp). cpiMonthly: the ABS's printed monthly all-items y/y measure, complete monthly CPI era (1dp as printed). gdppc: real GDP per capita Australia, annual change, quarterly — derived from the ABS's SA chain-volume per-capita levels (v = lvl_t/lvl_{t−4}−1, rounded to 1dp). oecdCpi: OECD total all-items CPI y/y, OECD's printed monthly measure (values carry the OECD's own decimals; the page rounds to 1dp). oecdGdp: OECD total real GDP y/y, OECD's printed quarterly measure (no per-capita OECD aggregate is published — labelled 'OECD average GDP growth'). Rows: {date: ISO period end, v: percent}. Sources in .build/macro.mjs (ABS Cat. 6401.0 CPI and 5204.0/06 National Accounts via data.api.abs.gov.au; OECD DF_PRICES_ALL and DF_KEI via sdmx.oecd.org). Built by .build/macro.mjs — never hand-edit.",
    cpi: { label: "Inflation (headline CPI)", basis: "derived from ABS index numbers", rows: cpi },
    cpiMonthly: { label: "Inflation (monthly CPI)", basis: "ABS printed measure", rows: cpiMonthly },
    gdppc: { label: "GDP per capita (annual change)", basis: "derived from ABS levels (chain volume, seasonally adjusted)", rows: gdppc },
    oecdCpi: { label: "OECD average inflation", basis: "OECD printed measure", rows: oecdCpi },
    oecdGdp: { label: "OECD average GDP growth", basis: "OECD printed measure", rows: oecdGdp },
  };
  const next = JSON.stringify(doc, null, 1) + "\n";
  const changed = !prev || readFileSync(OUT, "utf8") !== next;
  const KEYS = ["cpi", "cpiMonthly", "gdppc", "oecdCpi", "oecdGdp"];
  const prevByKey = new Map(KEYS.flatMap((k) => (((prev || {})[k] || {}).rows || []).map((x) => [k + "|" + x.date, true])));
  const added = {};
  for (const k of KEYS) added[k] = doc[k].rows.filter((x) => !prevByKey.has(k + "|" + x.date)).map((x) => x.date);
  if (changed && !CHECK) writeAtomic(OUT, next);
  const daysAgo = (d) => (Date.now() - Date.parse(d + "T00:00:00Z")) / 864e5;
  const stale = KEYS.filter((k) => {
    const rows = doc[k].rows;
    return rows.length && daysAgo(rows[rows.length - 1].date) > STALE_DAYS[k];
  });
  console.log("MACRO_STATUS " + JSON.stringify({
    changed, added,
    rows: Object.fromEntries(KEYS.map((k) => [k, doc[k].rows.length])),
    newest: Object.fromEntries(KEYS.map((k) => [k, doc[k].rows.at(-1)?.date ?? null])),
    stale,
    cpiHandoffDrift: drift,
  }));
}
