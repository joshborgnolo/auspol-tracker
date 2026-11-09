/* macro.mjs – builds data/macro.json, the ABS/OECD price and output series
   behind the "Inflation & growth" view of the Snapshot's Economic sentiment
   panel (rd-panels.jsx RdConfidence's third tab), and its Info glossary entry.
   Eight display lanes, six data-API pulls plus the OECD's monthly inflation
   release PDFs — all OFFICIAL publications, fetched from the ABS and OECD
   public data APIs, never hand-entered:

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
     rnndi      – real net national disposable income per capita, Australia,
                  annual change, quarterly. Same ANA_AGG derivation as
                  gdppc from the ABS's chain-volume levels
                  (M1.NNDI_PCA.20.AUS.Q), 1974→.
     oecdCpi    – OECD total, all-items CPI, y/y, monthly; the OECD's printed
                  measure (DF_PRICES_ALL: OECD.M.N.CPI.PA._T.N.GY), no
                  arithmetic on our side.
     oecdCpiMed – OECD member-country MEDIAN all-items CPI y/y, monthly —
                  computed here: per month, the median of every OECD
                  member's headline print (committed allowlist of the 38;
                  a month files only when MED_MIN=25 or more members
                  report). Two source eras spliced at Dec 2025:
                    ≤ Dec 2025 – the OECD's DF_PRICES_ALL member series
                      (the same all-areas pull above; the member archive
                      is complete through 2025) — New Zealand never
                      appears there (quarterly CPI only).
                    Jan 2026 → – the member panel in Table 1 of the
                      OECD's monthly "Consumer Prices, OECD" release PDF
                      (per-country CPI/HICP table; parse in
                      parseReleaseTable1), because the OECD's member
                      archive stalls months behind its own aggregates.
                      Committed per reference month in
                      .build/macro-src/oecd-member-inflation.json when
                      the release carrying it parses (figures frozen
                      as-released, per the median-of-availability
                      convention; the committed cross-checks catch a
                      release whose member grid shifted). The
                      release-era panel includes New
                      Zealand, the archive era doesn't — overlap months
                      (Nov/Dec 2025 in both) are cross-checked below and
                      the measured drift (≤0.2pt) covers the handoff.
     oecdCpiGap – MEDIAN DEVIATION FROM INFLATION TARGET across the OECD,
                  monthly — computed here: per month, for every member
                  carrying both a CPI print and a formal central-bank
                  target that month, print minus the target's midpoint
                  (the CB_TARGETS table's conventions govern), the median
                  of those deviations; starts 1999-01 (nothing formal
                  before NZ's 1990 band, too few targeters before the
                  euro-bloc entry year), same eras spliced as the median
                  lane (a member with a print before its first target —
                  or Australia/NZ before monthly coverage exists — is
                  simply absent: the panel widens as targeting spread).
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
     abs-rnndi.csv, oecd-cpi.csv, oecd-gdp.csv (test seam; every file must
     be present, the run never falls back to live fetches in fixture mode;
     in fixture mode the release-PDF probe is skipped and the median
     lane's release era reads the committed store only) */
/* MACRO_LIB=1: import the pure helpers (tests) without running the pulls. */
import { readFileSync, existsSync, mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
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
  rnndipcLvl: {
    fixture: "abs-rnndi.csv",
    url: `${ABS_BF}/ABS,ANA_AGG,1.0.0/M1.NNDI_PCA.20.AUS.Q`,
    accept: "application/vnd.sdmx.data+csv",
    cite: "ABS Australian National Accounts (cat 5204.0/06), real net national disposable income per capita, chain volume measures, seasonally adjusted — data API ABS,ANA_AGG measure M1, item NNDI_PCA",
  },
  /* One all-areas pull of the CPI dataflow reads the OECD and G20 totals
     AND every member country's series (the all-areas response carries all
     50+ reference areas) — three lanes off a single request. */
  oecdCpi: {
    fixture: "oecd-cpi.csv",
    url: `${OECD_BF}/OECD.SDD.TPS,DSD_PRICES@DF_PRICES_ALL,1.0/.M.N.CPI.PA._T.N.GY/all`,
    accept: "text/csv",
    cite: "OECD Data Explorer, consumer prices: all-items CPI, percentage change on the same period of the previous year (DF_PRICES_ALL), all reference areas — the OECD and G20 totals plus every member-country series",
  },
  oecdGdp: {
    fixture: "oecd-gdp.csv",
    url: `${OECD_BF}/OECD.SDD.STES,DSD_KEI@DF_KEI,4.0/OECD.Q.B1GQ_Q.GR._T.Y.GY/all`,
    accept: "text/csv",
    cite: "OECD Key short-term economic indicators (DF_KEI): OECD total, GDP volume, growth on the same quarter of the previous year — some latest rows carry the OECD's provisional flag",
  },
};

/* OECD member countries (the 38 of the 2020s) — the membership the median
   lane medians over. Membership is constant by construction (a country's
   pre-accession series rides too), keeping the median composition-stable;
   in the DF_PRICES_ALL era (≤ Dec 2025) New Zealand never appears
   (quarterly CPI only). In the release-PDF era the panel is the OECD's
   own Table 1, all 38 rows where printed. */
const OECD_MEMBERS = new Set(
  "AUS AUT BEL CAN CHE CHL COL CRI CZE DEU DNK ESP EST FIN FRA GBR GRC HUN IRL ISL ISR ITA JPN KOR LTU LUX LVA MEX NLD NOR NZL POL PRT SVK SVN SWE TUR USA".split(" ")
);
/* Release Table 1 spells member names in prose form; the parse matches
   names against THIS allowlist only (aggregate rows — OECD, G7, euro
   area, EU — are never allowed to enter the median). Kerning gaps in the
   PDF's text layer split names mid-word ("Norw ay", "Colom bia"), so the
   matcher tolerates internal whitespace. */
const MEMBER_NAMES = {
  AUS: "Australia", AUT: "Austria", BEL: "Belgium", CAN: "Canada", CHE: "Switzerland", CHL: "Chile", COL: "Colombia", CRI: "Costa Rica",
  CZE: "Czechia", DEU: "Germany", DNK: "Denmark", ESP: "Spain", EST: "Estonia", FIN: "Finland", FRA: "France", GBR: "United Kingdom",
  GRC: "Greece", HUN: "Hungary", IRL: "Ireland", ISL: "Iceland", ISR: "Israel", ITA: "Italy", JPN: "Japan", KOR: "Korea", LTU: "Lithuania",
  LUX: "Luxembourg", LVA: "Latvia", MEX: "Mexico", NLD: "Netherlands", NOR: "Norway", NZL: "New Zealand", POL: "Poland", PRT: "Portugal",
  SVK: "Slovak Republic", SVN: "Slovenia", SWE: "Sweden", TUR: "Türkiye", USA: "United States",
};
/* Central-bank inflation targets behind the oecdCpiGap lane — each
   member's entries are [fromRef, midpoint] segments, the midpoint the
   target's point value or band midpoint (the RBA's 2–3% → 2.5 convention).
   HAND-ENTERED from the banks' own publications (as-at November 2026);
   a bank restating its framework needs this table updated — precedent:
   Norges Bank 2.5→2% (2018), BoK 2% flat goal (2016), BCCR's formal
   adoption (2018). A member enters the gap panel at its first formal
   target — months before that, the member wasn't a targeter, so the
   median correctly ignores it (no implicit 2% anywhere).
   Conventions, each deliberately documented:
   - ECB members ride the ECB's 2% from their euro entry. The pre-July-2021
     "below, but close to, 2%" aim is flattened to the same 2.0 — a
     documented choice, never a claim the ECB's formulation changed.
   - Denmark is EXCLUDED: Danmarks Nationalbank's mandate is the krone
     peg, not a CPI target.
   - BoK's 1999–mid-2000s targets were framed on CORE CPI and the UK's
     pre-Dec-2003 targets on RPIX — both eras ride those members' headline
     CPI prints here anyway; the basis switches are noted, not smoothed.
   - Annual-resolution targets (TCMB, CNB, NBP, Banxico, BanRep, BanCol
     early years) dive in steps each January the print year changes —
     the OECD's own annual CPI fractions, not interpolation.
   Sources by cluster: NZL RBNZ PTA history (0–2 Apr 1990 → 0–3 Dec 1996 →
   1–3 Sep 2002); AUS Statement on the Conduct of Monetary Policy 14 Aug
   1996 (2–3% over the cycle); CAN joint BoC–government targets (3% within
   2–4% by 1992 → 1–3% from Dec 1995); GBR Bank of England targets (1–4%
   RPIX Oct 1992 → 2.5±1 May 1997 → 2% CPI Dec 2003); SWE Riksbank 2%±1
   (announced Jan 1993, in force Jan 1995); FIN Suomen Pankki 2% (Feb 1993)
   then ECB 1999; CHE SNB price stability <2% (mid of 0–2, from 2000);
   ISR BoI long-term 1–3% frame (2003); ISL CBI 2.5% (27 Mar 2001,
   tolerance band added later); NOR NBU 2.5% (Mar 2001) → 2% (Mar 2018);
   JPN BoJ 2% (22 Jan 2013); USA FOMC 2% longer-run goal (Jan 2012);
   KOR BoK targets (3±1% core at adoption 1999 → 2% from 2016, with the
   interim core/headline wobble years in between — comment above);
   CHL BCCh 2–4% from Sep 1999; MEX Banxico annuals (13/10/6.5/4.5 → 3±1
   from 2004); COL BanRep annuals declining → 3±1 from 2010; CRI BCCR
   flexible regime 3%±1, formally adopted Feb 2018 after a transition
   from 2005; POL MPC letters (NBP: 6.6–7.8% 1999 → 2.5%±1 constant from
   2004); CZE CNB targets Jan 1998 on (net-inflation bands → continuous
   3±1 from 2002 → 2±1 from 2010); HUN MNB year-end targets from Jun
   2001 → 3%±1 from Jan 2007; TUR TCMB declared annuals (35/20/12/8/5/4/
   6.5 → 5%±2 from 2012). */
const CB_TARGETS = {
  AUS: [["1996-08", 2.5]],
  AUT: [["1999-01", 2]],
  BEL: [["1999-01", 2]],
  CAN: [["1991-02", 3], ["1995-01", 2]],
  CHE: [["2000-01", 1]],
  CHL: [["1999-09", 3]],
  COL: [["2000-01", 10], ["2001-01", 8], ["2002-01", 6], ["2003-01", 5.5], ["2004-01", 5], ["2008-01", 4], ["2009-01", 4.5], ["2010-01", 3]],
  CRI: [["2018-02", 3]],
  CZE: [["1998-01", 6], ["1999-01", 4.5], ["2000-01", 4.5], ["2001-01", 3], ["2002-01", 3], ["2010-01", 2]],
  DEU: [["1999-01", 2]],
  ESP: [["1999-01", 2]],
  EST: [["2011-01", 2]],
  FIN: [["1993-02", 2], ["1999-01", 2]],
  FRA: [["1999-01", 2]],
  GBR: [["1992-10", 2.5], ["2003-12", 2]],
  GRC: [["2001-01", 2]],
  HUN: [["2001-06", 5], ["2004-01", 3.5], ["2007-01", 3]],
  IRL: [["1999-01", 2]],
  ISL: [["2001-03", 2.5]],
  ISR: [["2003-01", 2]],
  ITA: [["1999-01", 2]],
  JPN: [["2013-01", 2]],
  KOR: [["1999-01", 3], ["2016-01", 2]],
  LTU: [["2015-01", 2]],
  LUX: [["1999-01", 2]],
  LVA: [["2014-01", 2]],
  MEX: [["1999-01", 13], ["2000-01", 10], ["2001-01", 6.5], ["2002-01", 4.5], ["2003-01", 4], ["2004-01", 3]],
  NLD: [["1999-01", 2]],
  NOR: [["2001-03", 2.5], ["2018-03", 2]],
  NZL: [["1990-04", 1], ["1996-12", 1.5], ["2002-09", 2]],
  POL: [["1999-01", 7.2], ["2000-01", 6.1], ["2001-01", 7], ["2002-01", 5], ["2003-01", 5], ["2004-01", 2.5]],
  PRT: [["1999-01", 2]],
  SVK: [["2009-01", 2]],
  SVN: [["2007-01", 2]],
  SWE: [["1995-01", 2]],
  TUR: [["2002-01", 35], ["2003-01", 20], ["2004-01", 12], ["2005-01", 8], ["2006-01", 5], ["2007-01", 4], ["2009-01", 6.5], ["2012-01", 5]],
  USA: [["2012-01", 2]],
};
/* A member's target midpoint at a reference month, or null where the
   central bank had no formal target that month. */
function targetOf(iso, ref) {
  const e = CB_TARGETS[iso];
  if (!e) return null;
  let t = null;
  for (const [f, v] of e) { if (f <= ref) t = v; else break; }
  return t;
}
/* A month files as the median's store entry only when this many member
   countries parse with a figure (the release panel has printed 35–38 rows
   through 2026 — a layout the reader can't square to that scale is a
   parse failure, never a thin month). */
const MED_MIN = 25;
/* A month of the deviation lane needs at least this many members carrying
   both a print and a formal target that month. Measured on the live feeds
   (2026-11-09): with-both runs 18–19 at the 1999-01 start, 27 by 2003,
   31+ by 2012 — 15 keeps the user-set 1999 start with headroom and still
   guards a composition collapse. */
const DEV_MIN = 15;
/* The median lane handoff: DF_PRICES_ALL era ≤ Dec 2025, release-PDF era
   Jan 2026 →. Their two shared reference months (Nov/Dec 2025, in both)
   must sit within this drift — measured 0.1–0.2pt on the live parses
   (2026-11-09), where the release panel adds New Zealand's median-lifting
   membership to the archive's 37. */
const MED_HANDOFF = 0.5;
/* A filing release's member median must sit near the OECD-total headline
   the same Table 1 prints — a column-shifted parse would drift far past
   this (measured gap on the 2026 releases: 0.9–1.5pt). */
const MED_AGG_DRIFT = 2.0;
// The committed release-era store and the OECD DAM paths it probes.
const MED_STORE = ".build/macro-src/oecd-member-inflation.json";
const MED_DAM = (ry, rm) =>
  `https://www.oecd.org/content/dam/oecd/en/data/insights/statistical-releases/${ry}/${rm}/consumer-prices-oecd-${String(rm).padStart(2, "0")}-${ry}.pdf`;

// Plausible annual-change bands per display lane (a breach guards, never
// files): Australia 1947→ sees CPI ~18% (1975) and ~−2% (1997/2020);
// RNNDI's terms-of-trade swings run wider than GDP pc (1974 peak ~+18%);
// OECD histories are tamer but padded on the same logic. The gap lane is
// MEASURED on its computation (2026-11-09): −2.2 (2015's oil crash) to
// +7.9 (mid-2022's energy spike) — the band pads both tails.
const BAND = { cpi: [-5, 30], cpiMonthly: [-5, 30], gdppc: [-12, 15], rnndi: [-12, 25], oecdCpi: [-5, 30], oecdCpiMed: [-5, 30], oecdCpiGap: [-5, 15], oecdGdp: [-12, 15] };
const MIN_ROWS = { cpi: 250, cpiMonthly: 6, gdppc: 200, rnndi: 200, oecdCpi: 60, oecdCpiMed: 600, oecdCpiGap: 310, oecdGdp: 40 };
/* the median/gap lanes' newest reference month trails the others by the
   release lag (~2 months) plus the daily run's day: ~75d steady state,
   ~90d across a slow December/January stretch — 110d trips only when the
   monthly release feed has truly died. */
const STALE_DAYS = { cpi: 210, cpiMonthly: 75, gdppc: 210, rnndi: 210, oecdCpi: 95, oecdCpiMed: 110, oecdCpiGap: 110, oecdGdp: 210 };
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

/* Median of a set of figures, rounded to one decimal so the file's
   precision stays honest (OURS, never a publisher print). */
function medianOf(vs) {
  const s = [...vs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return Math.round((s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) * 10) / 10;
}

/* The OECD member-country median lane from the all-areas DF_PRICES_ALL
   pull (the lane's ≤ Dec 2025 era): per month, the median of every
   OECD_MEMBERS country's printed value, filed only where MED_MIN or more
   members report. */
function medianCpiLane(rows) {
  const byMonth = new Map();
  for (const r of rows) {
    if (!OECD_MEMBERS.has(r.REF_AREA)) continue;
    const v = parseFloat(r.OBS_VALUE);
    if (!Number.isFinite(v)) continue;
    let arr = byMonth.get(r.TIME_PERIOD);
    if (!arr) byMonth.set(r.TIME_PERIOD, (arr = []));
    arr.push(v);
  }
  const out = [];
  for (const [p, vs] of byMonth) {
    if (vs.length < MED_MIN) continue;
    out.push({ date: periodEnd(p), v: medianOf(vs) });
  }
  return out.filter((x) => x.date && Number.isFinite(x.v)).sort((a, b) => a.date.localeCompare(b.date));
}

/* A month of the deviation lane from an {ISO → headline CPI} map: the
   median of (print minus target midpoint) over members carrying both —
   never a printless/targetless member. Returns null below DEV_MIN. */
function medianGapFor(figures, ref) {
  const devs = [];
  for (const [iso, v] of Object.entries(figures)) {
    if (!OECD_MEMBERS.has(iso)) continue;
    const t = targetOf(iso, ref);
    if (t == null || !Number.isFinite(v)) continue;
    const d = Math.round((v - t) * 100) / 100;
    if (d < -70 || d > 80) continue; // rogue cells can't ride a median month
    devs.push(d);
  }
  if (devs.length < DEV_MIN) return null;
  return { v: medianOf(devs), n: devs.length };
}

/* The deviation lane's ≤ Dec 2025 era from the all-areas DF_PRICES_ALL
   pull: group to a {ISO → value} map per month, then the same
   medianGapFor the release era uses. */
function devGapLane(rows) {
  const byMonth = new Map();
  for (const r of rows) {
    if (!OECD_MEMBERS.has(r.REF_AREA)) continue;
    const v = parseFloat(r.OBS_VALUE);
    if (!Number.isFinite(v)) continue;
    let figures = byMonth.get(r.TIME_PERIOD);
    if (!figures) byMonth.set(r.TIME_PERIOD, (figures = {}));
    figures[r.REF_AREA] = v;
  }
  const out = [];
  for (const [ref, figures] of byMonth) {
    const g = medianGapFor(figures, ref);
    if (g) out.push({ date: periodEnd(ref), v: g.v });
  }
  return out.filter((x) => x.date && Number.isFinite(x.v)).sort((a, b) => a.date.localeCompare(b.date));
}

/* The deviation lane spliced at the same eras as the median lane (store
   era Jan 2026 →, overlap refs cross-checked within MED_HANDOFF). */
function spliceGapLane(dfRows, store) {
  const rows = dfRows.filter((x) => x.date <= "2025-12-31");
  const byRef = new Map(rows.map((x) => [x.date.slice(0, 7), x.v]));
  let handoff = null;
  for (const [ref, e] of Object.entries(store.releases).sort(([a], [b]) => a.localeCompare(b))) {
    const g = medianGapFor(e.figures, ref);
    if (!g) throw guard(`oecdCpiGap store ${ref}: committed panel reaches no deviation (${Object.keys(e.figures).length} member figures)`);
    if (ref <= "2025-12") {
      if (byRef.has(ref)) {
        const d = Math.abs(g.v - byRef.get(ref));
        handoff = Math.max(handoff ?? 0, d);
      }
      continue; // DF era owns the overlap
    }
    rows.push({ date: periodEnd(ref), v: g.v });
  }
  for (let i = 1; i < rows.length; i++) {
    if (rows[i].date <= rows[i - 1].date) throw guard(`oecdCpiGap: dates not ascending at splice (${rows[i].date})`);
  }
  return { rows, handoff };
}

// ---------------------------------------------------------------- release parse
/* pdftotext -layout text of one "Consumer Prices, OECD" release → the
   Table 1 member panel: { ref: "2026-03", figures: {AUS: 4.6, …},
   median, oecd: the OECD-total print}. Returns null when the release
   doesn't parse cleanly — a layout the reader can't square to a ≥MED_MIN
   grid is a parse failure, never a thin month.

   Table 1 carries every OECD member plus aggregate rows (OECD, G7,
   euro area, EU); only MEMBER_NAMES rows may enter the median. The CPI
   "All items" block is leftmost; within it the reference month's value
   sits at the first date-token equal to the reference month in the
   table's OWN header (editions differ: the year-end release prepends
   annual-average columns), and every member row must present the same
   token count as that header — a row whose grid shifted drops, and
   figures are re-checked against a wide member band. Country names in
   the PDF text layer carry kerning gaps ("Norw ay"), so the allowlist
   match tolerates internal whitespace. */
const MED_MEMBER_RE = Object.entries(MEMBER_NAMES).map(([iso, name]) => ({
  iso,
  re: new RegExp("^\\s*" + [...name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")].join("\\s*") + "(?=\\s|$)"),
}));
const MED_MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const MED_FIG_BAND = [-15, 100];
function parseReleaseTable1(text) {
  const lines = text.split("\n");
  const ti = lines.findIndex((l) => /^Table 1\s*[–-]\s*CPI and HICP/.test(l.trim()));
  if (ti < 0) return null;
  let te = lines.findIndex((l, i) => i > ti && /^Table 2\s*[–-]/.test(l.trim()));
  if (te < 0) te = lines.length;
  const block = lines.slice(ti, te);
  const sub = block.find((l) => /^[A-Z][a-z]+ \d{4}, year-on-year inflation rate/.test(l.trim()));
  const sm = sub && sub.trim().match(/^([A-Z][a-z]+) (\d{4}), /);
  if (!sm) return null;
  const mon = MED_MONTHS[sm[1].slice(0, 3).toLowerCase()];
  if (!mon) return null;
  const [y, m] = [+sm[2], mon];
  const ref = `${y}-${String(m).padStart(2, "0")}`;
  const refTok = `${sm[1].slice(0, 3)}-${String(y).slice(2)}`;

  // The CPI "All items" block is leftmost, and every regular row shares the
  // edition's cell count: 16 (year-ago, prior, reference CPI months …) in
  // the standard layout, 17 in the year-end edition that prepends two
  // annual-average columns. The headline sits at token 2 (or 4); the
  // header's own first three MMM-YY date tokens must read [ref−12, ref−1,
  // ref] as a cross-check. Rows that don't match the edition's count drop.
  const MED_OECD_ROW = /^OECD(?:-Total)?(\s|\d)/; // "OECD" / "OECD-Total" era spelling
  const headEnd = block.findIndex((l) => MED_OECD_ROW.test(l.trim()));
  if (headEnd < 0) return null;
  const toks = [];
  for (const l of block.slice(block.indexOf(sub) + 1, headEnd)) {
    toks.push(...l.trim().split(/\s+/).filter(Boolean));
  }
  const MYY = /^[A-Z][a-z]{2}-\d{2}$/;
  const myy = toks.filter((t) => MYY.test(t));
  const tokOf = (yyy, mm) => "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ")[mm - 1] + "-" + String(yyy).slice(2);
  const [prevY, prevM] = m === 1 ? [y - 1, 12] : [y, m - 1];
  const [agoY] = [y - 1];
  if (myy.length < 3 || myy[2] !== refTok || myy[1] !== tokOf(prevY, prevM) || myy[0] !== tokOf(agoY, m)) return null;
  // Grid from the first data row (the OECD aggregate itself): exactly the
  // two editions we can align the CPI headline in.
  const trow = (s) => s.trim().replace(/^OECD(?:-Total)?\b/, "").replace(/^\s*\d+(,\s*\d+)*/, "").trim().split(/\s+/);
  const t0 = trow(block[headEnd]);
  const k = t0.length === 16 ? 2 : t0.length === 17 ? 4 : null;
  if (k == null) return null;

  const num = (t) => {
    const s = t.replace(/e$/, "");
    return /^-?\d+(\.\d+)?$/.test(s) ? parseFloat(s) : null;
  };
  const figures = {};
  let oecd = null;
  for (const l of block.slice(headEnd)) {
    const t = l.trim();
    let rest = null, iso = null;
    if (MED_OECD_ROW.test(t)) {
      rest = t.replace(/^OECD(?:-Total)?\b/, "");
      iso = "OECD";
    } else {
      for (const { iso: i, re } of MED_MEMBER_RE) {
        const mm = t.match(re);
        if (mm) { rest = t.slice(mm[0].length); iso = i; break; }
      }
    }
    if (!iso) continue;
    rest = rest.replace(/^\s*\d+(,\s*\d+)*/, "").trim();
    const toks = rest ? rest.split(/\s+/) : [];
    if (toks.length !== t0.length) continue; // grid-shifted row: drop
    const v = num(toks[k]);
    if (v == null) continue; // `..`/`…` — member didn't print this month
    if (v < MED_FIG_BAND[0] || v > MED_FIG_BAND[1]) return null; // misaligned grid read
    if (iso === "OECD") oecd = v;
    else figures[iso] = v;
  }
  const n = Object.keys(figures).length;
  if (n < MED_MIN) return null;
  const median = medianOf(Object.values(figures));
  // The OECD-total cross-check only binds where the release printed it —
  // the US-shutdown era releases carried `..` for the aggregate; a null
  // aggregate never vetoes the median (the member grid + band + date
  // triplet + MED_MIN floor still stand).
  if (oecd != null && Math.abs(median - oecd) > MED_AGG_DRIFT) return null; // column shift
  return { ref, figures, median, oecd };
}

// ---------------------------------------------------- median store + splice
function readMedianStore() {
  const base = { _about: "OECD member-country headline CPI y/y per reference month, parsed by .build/macro.mjs from Table 1 of each monthly 'Consumer Prices, OECD' release (the member panel the OECD's SDMX member archive stalls behind). Figures are the release print, frozen — a filed reference month is never re-read. Built and extended by .build/macro.mjs — never hand-edit.", releases: {} };
  if (!existsSync(MED_STORE)) return base;
  const s = JSON.parse(readFileSync(MED_STORE, "utf8"));
  if (!s || typeof s !== "object" || !s.releases || typeof s.releases !== "object") throw guard(`${MED_STORE}: drifted shape`);
  for (const [ref, e] of Object.entries(s.releases)) {
    if (!/^\d{4}-\d{2}$/.test(ref) || !e || typeof e.median !== "number" || !e.figures || typeof e.figures !== "object") throw guard(`${MED_STORE} ${ref}: drifted entry`);
  }
  return s;
}

/* The median lane as spliced from its two eras: DF_PRICES_ALL rows (≤ Dec
   2025) plus the store's release-era medians (Jan 2026 →). Shared
   reference months (Nov/Dec 2025) are median-vs-lane cross-checks, and
   each store entry's median is recomputed from its own figures — the
   store's own printed median is never trusted blindly. Returns {rows,
   handoff, corrupt} — the caller guards handoff drift and any entry whose
   committed median doesn't recompute. */
function spliceMedianLane(sdmxRows, store) {
  const rows = sdmxRows.filter((x) => x.date <= "2025-12-31");
  const byRef = new Map(rows.map((x) => [x.date.slice(0, 7), x.v]));
  let handoff = null;
  const corrupt = [];
  for (const [ref, e] of Object.entries(store.releases).sort(([a], [b]) => a.localeCompare(b))) {
    const med = medianOf(Object.values(e.figures));
    if (Math.abs(med - e.median) > 0.05) { corrupt.push(ref); continue; }
    if (ref <= "2025-12") {
      if (byRef.has(ref)) {
        const d = Math.abs(med - byRef.get(ref));
        handoff = Math.max(handoff ?? 0, d);
      }
      continue; // DF_PRICES_ALL owns the overlap era
    }
    rows.push({ date: periodEnd(ref), v: med });
  }
  for (let i = 1; i < rows.length; i++) {
    if (rows[i].date <= rows[i - 1].date) throw guard(`oecdCpiMed: dates not ascending at splice (${rows[i].date}) — store overlaps the DF_PRICES_ALL era?`);
  }
  return { rows, handoff, corrupt };
}

/* Live mode: probe the OECD DAM for releases beyond the store's newest
   reference month (release of month R covers reference month R−2 — the
   URL is derived, never fetched from the walled insights HTML index),
   parse any new ones, and file them into the committed store. Pending
   months stay pending: a 404/not-yet-published release is not an error,
   and a release that fails parseReleaseTable1 just notes and waits. */
function monthAdd(mkey, delta) {
  let [y, m] = mkey.split("-").map(Number);
  m += delta;
  y += Math.floor((m - 1) / 12);
  m = ((m - 1) % 12) + 1;
  return `${y}-${String(m).padStart(2, "0")}`;
}
function httpGetBin(url, redirects = 5) {
  return new Promise((resolve, reject) => {
    const req = httpsGet(url, {
      headers: { "user-agent": TRACKER_UA },
      timeout: FETCH_TIMEOUT_MS,
    }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        res.resume();
        if (redirects <= 0) return reject(new Error(`redirect chain: ${url.slice(0, 110)}…`));
        return resolve(httpGetBin(new URL(res.headers.location, url).href, redirects - 1));
      }
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve({ status: res.statusCode, body: Buffer.concat(chunks) }));
    });
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
  });
}
function pdfText(buf) {
  const p = `${tmpdir()}/macro-oecd-rel-${process.pid}.pdf`;
  writeFileSync(p, buf);
  try {
    return execFileSync("pdftotext", ["-layout", p, "-"], { encoding: "utf8", maxBuffer: 8 << 20 });
  } finally {
    try { unlinkSync(p); } catch { /* temp cleanup best-effort */ }
  }
}
async function refreshMedianStore(store, { medParsed }) {
  if (FIXTURE_DIR || CHECK) return store;
  const refs = Object.keys(store.releases).sort();
  const newestRef = refs.length ? refs.at(-1) : "2025-10"; // releases from Dec 2025
  // candidate release months: ref+2 for every ref after newestRef, up to
  // and including this calendar month's release (lookahead of one month
  // over the newest possible reference month costs one 404).
  const now = new Date();
  let rel = monthAdd(newestRef, 2);
  let probed = 0;
  const cur = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  while (rel <= cur) {
    const [ry, rm] = rel.split("-").map(Number);
    probed++;
    let parsed = null;
    try {
      const { status, body } = await httpGetBin(MED_DAM(ry, rm));
      if (status >= 200 && status < 300 && body.subarray(0, 5).equals(Buffer.from("%PDF-"))) {
        try {
          parsed = parseReleaseTable1(pdfText(body));
        } catch {
          // pdftotext not on PATH this run — the parser keeps the rest of
          // the extractor alive; the release stays pending for a host
          // that has poppler.
        }
      }
    } catch (e) {
      console.log(`oecd-median: probe ${rel} failed (${e.message}); pending`);
    }
    if (parsed && !store.releases[parsed.ref]) {
      store.releases[parsed.ref] = { release: rel, url: MED_DAM(ry, rm), oecd: parsed.oecd, median: parsed.median, figures: parsed.figures };
      medParsed.push(parsed.ref);
      console.log(`oecd-median: filed ${parsed.ref} (${Object.keys(parsed.figures).length} members, median ${parsed.median}, OECD ${parsed.oecd}) from the ${rel} release`);
    }
    rel = monthAdd(rel, 1);
    if (probed > 15) break; // bounded: steady state is 1–2 candidates a run
  }
  return store;
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
export { parseSdmxCsv, periodEnd, periodOrd, yoyFromLevels, printedRows, medianOf, medianCpiLane, parseReleaseTable1, spliceMedianLane, readMedianStore, monthAdd, absFiltered, OECD_MEMBERS, MEMBER_NAMES, MED_MIN, CB_TARGETS, targetOf, medianGapFor, devGapLane, spliceGapLane, DEV_MIN, MED_HANDOFF, MED_AGG_DRIFT, HANDOFF_DRIFT, MIN_ROWS, BAND, STALE_DAYS };

if (!process.env.MACRO_LIB) {
  // Serial, with a breath between hosts: the OECD's NSI gates parallel
  // callers with 429s (firing five data pulls at once tripped it on
  // 2026-10-31), and six small CSVs don't earn fetch fan-out.
  const texts = {};
  for (const [k, spec] of Object.entries(SOURCES)) {
    texts[k] = await readSource(spec);
    await sleep(400);
  }
  const absCpiIdx = texts.cpiIndex, absCpiYoy = texts.cpiYoy, absGdp = texts.gdppcLvl, absRnndi = texts.rnndipcLvl;
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

  // rnndi — quarterly, derived from SA chain-volume RNNDI-per-capita levels.
  const rnndiLevels = absFiltered(parseSdmxCsv(absRnndi), { MEASURE: "M1", DATA_ITEM: "NNDI_PCA", TSEST: 20, REGION: "AUS" });
  if (rnndiLevels.length < 200) throw guard(`rnndi levels: ${rnndiLevels.length} rows — key/basis changed upstream?`);
  const rnndi = yoyFromLevels(rnndiLevels, 4);

  // OECD lanes off the one all-areas pull: the aggregate total is a
  // printed measure (no arithmetic); the member median and the median
  // target deviation are computed here and spliced with the release-PDF
  // era from the committed store.
  const oecdAreas = parseSdmxCsv(oecdCpiRows);
  const oecdCpi = printedRows(oecdAreas.filter((r) => r.REF_AREA === "OECD"));
  const oecdGdp = printedRows(parseSdmxCsv(oecdGdpRows).filter((r) => r.REF_AREA === "OECD"));
  const medParsed = [];
  const medStore = await refreshMedianStore(readMedianStore(), { medParsed });
  const medSplice = spliceMedianLane(medianCpiLane(oecdAreas), medStore);
  const oecdCpiMed = medSplice.rows;
  if (medSplice.corrupt.length) throw guard(`oecdCpiMed store: committed median ≠ its own figures at ${medSplice.corrupt.join(", ")} — hand-edit? rebuild the store`);
  if (medSplice.handoff != null && medSplice.handoff > MED_HANDOFF) throw guard(`oecdCpiMed release/archive handoff drift ${medSplice.handoff.toFixed(1)}pt > ${MED_HANDOFF} — the release table reads a different panel?`);
  const gapSplice = spliceGapLane(devGapLane(oecdAreas), medStore);
  const oecdCpiGap = gapSplice.rows;
  if (gapSplice.handoff != null && gapSplice.handoff > MED_HANDOFF) throw guard(`oecdCpiGap release/archive handoff drift ${gapSplice.handoff.toFixed(1)}pt > ${MED_HANDOFF} — the release table reads a different panel?`);
  const medStoreNext = JSON.stringify(medStore, null, 1) + "\n";
  const medStoreChanged = !existsSync(MED_STORE) || readFileSync(MED_STORE, "utf8") !== medStoreNext;
  if (medStoreChanged && !CHECK) {
    mkdirSync(".build/macro-src", { recursive: true });
    writeAtomic(MED_STORE, medStoreNext);
  }

  for (const [k, rows] of Object.entries({ cpi, cpiMonthly, gdppc, rnndi, oecdCpi, oecdCpiMed, oecdCpiGap, oecdGdp })) laneGuards(k, rows);

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
    _about: "Official price and output series behind the Economic sentiment panel's 'Inflation & growth' view. cpi: all-groups CPI Australia, annual change, quarterly — derived here from the ABS's published quarterly index numbers (1949→; v = idx_t/idx_{t−4}−1, rounded to 1dp). cpiMonthly: the ABS's printed monthly all-items y/y measure, complete monthly CPI era (1dp as printed). gdppc: real GDP per capita Australia, annual change, quarterly — derived from the ABS's SA chain-volume per-capita levels (v = lvl_t/lvl_{t−4}−1, rounded to 1dp). rnndi: real net national disposable income per capita Australia, annual change, quarterly — derived from the ABS's SA chain-volume per-capita levels (NNDI_PCA), the same derivation. oecdCpi: OECD total all-items CPI y/y, OECD's printed monthly measure (values carry the OECD's own decimals; the page rounds to 1dp). oecdCpiMed: the median of the OECD member countries' all-items CPI y/y prints, computed here (rounded to 1dp; not an OECD-published aggregate — a month files only when ≥25 members report; ≤ Dec 2025 from the OECD's DF_PRICES_ALL member series, Jan 2026→ from the member panel of the OECD's monthly 'Consumer Prices, OECD' release PDF, committed per reference month in .build/macro-src/oecd-member-inflation.json). oecdCpiGap: the MEDIAN DEVIATION FROM INFLATION TARGET across the OECD, computed here — per month, the median of (member CPI print minus that member's own central-bank target midpoint), over members carrying both that month (the hand-entered CB_TARGETS table in .build/macro.mjs records each bank's target history; band targets at midpoint, a member absent before its first formal target; from 1999-01; rounded to 1dp; the same era splice as oecdCpiMed). oecdGdp: OECD total real GDP y/y, OECD's printed quarterly measure (no per-capita OECD aggregate is published — labelled 'OECD average GDP growth'). Rows: {date: ISO period end, v: percent}. Sources in .build/macro.mjs (ABS Cat. 6401.0 CPI and 5204.0/06 National Accounts via data.api.abs.gov.au; OECD DF_PRICES_ALL and DF_KEI via sdmx.oecd.org). Built by .build/macro.mjs — never hand-edit.",
    cpi: { label: "Inflation (headline CPI)", basis: "derived from ABS index numbers", rows: cpi },
    cpiMonthly: { label: "Inflation (monthly CPI)", basis: "ABS printed measure", rows: cpiMonthly },
    gdppc: { label: "GDP per capita (annual change)", basis: "derived from ABS levels (chain volume, seasonally adjusted)", rows: gdppc },
    rnndi: { label: "Real net national disposable income per capita (annual change)", basis: "derived from ABS levels (chain volume, seasonally adjusted)", rows: rnndi },
    oecdCpi: { label: "OECD average inflation", basis: "OECD printed measure", rows: oecdCpi },
    oecdCpiMed: { label: "OECD median inflation", basis: "median of the 38 member countries' prints (computed)", rows: oecdCpiMed },
    oecdCpiGap: { label: "Median deviation from inflation target", basis: "median of members' prints minus their own central-bank targets (computed; band targets at midpoint)", rows: oecdCpiGap },
    oecdGdp: { label: "OECD average GDP growth", basis: "OECD printed measure", rows: oecdGdp },
  };
  const next = JSON.stringify(doc, null, 1) + "\n";
  const changed = !prev || readFileSync(OUT, "utf8") !== next;
  const KEYS = ["cpi", "cpiMonthly", "gdppc", "rnndi", "oecdCpi", "oecdCpiMed", "oecdCpiGap", "oecdGdp"];
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
    medParsed,
    medHandoffDrift: medSplice.handoff,
    devGapHandoffDrift: gapSplice.handoff,
  }));
}
