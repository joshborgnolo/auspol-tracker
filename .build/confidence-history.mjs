/* confidence-history.mjs – builds data/confidence-history.json, the DEEP back-history
   sibling of data/confidence.json behind the Snapshot panel "The confidence". One row
   per SURVEY MONTH, four lanes:
     consumer – ANZ-Roy Morgan Consumer Confidence monthly, Mar 1973 →
                (quarterly to 1986, monthly from Jan 1987), read from Roy
                Morgan's own "monthly ratings" morgan-poll table page.
                The table's figure for a month since Oct 2010 is the average
                of that month's weekly readings; the WEEKLY series itself
                (Aug 2008 →) is mirrored nowhere free — weekly history lives
                in data/confidence.json only (Dec 2016 →).
     business – Roy Morgan Business Confidence, Dec 2010 → (the series'
                inception), read from RM's own mirror table page. The mirror
                can trail the newest couple of months; recent months are the
                live lane's business (data/confidence.json), which reconciles on
                the overlap.
     westpacConsumer – Westpac–Melbourne Institute Consumer Sentiment,
                Sep 1974 → (series inception), from TWO republications of the
                one published index:
                - Jan 2010 → : RBA Statistical Table H3 (csv/h3-data.csv,
                  series GICWMICS), carrying MI's decimals — the source of
                  record wherever it prints. Matches data/confidence.json's
                  live westpac lane 1:1 over the overlap.
                - Sep 1974 – Dec 2009 : the OECD's republication (FRED
                  CSCICP02AUM460S), which prints the SAME index as a net
                  balance (index−100) rounded to whole index points; it is
                  rebased +100 here, so pre-2010 months carry whole index
                  points (±0.5 of MI's printed decimals). Rebased integers,
                  but the SAME basis — verified against H3 across every
                  overlap month (max |diff| 0.5 = pure rounding), and the
                  merge GUARDS that (fewer than 12 overlap months, or any
                  |diff| > 0.55, trips exit 2 so a FRED basis swap can never
                  file). H3 wins the overlap; this is NOT the nabConditions
                  arithmetic-merge trap (the OECD balance+100 IS the CSI).
                MI's exact-decimal 1974–2009 archive remains a paid CASiE
                product — the pre-2010 whole-point rounding is the only
                precision given up, and it is invisible at the panel's scale.
     nabConditions – NAB monthly business CONDITIONS as RBA H3 carries
                them: seasonally adjusted, deviation from the long-run
                average, percentage points, Mar 1997 → (series GICNBC).
                NOT the same basis as data/confidence.json's raw net-balance
                `cond` (the difference wobbles month to month —
                seasonal/reference effects — so no arithmetic conversion is
                ever derived or applied). NAB business CONFIDENCE proper
                (net balance, monthly since 1989) has no free
                machine-readable source: the RBA is contractually barred
                from republishing it (see the chart-pack "Data availability"
                note) and the MI/NAB archives are paid.
   Both RM pages render their tables inside __NEXT_DATA__ JSON payloads —
   the extractor reads the first YEAR×calendar-month grid on the page.
   The Roy Morgan consumer table carries footnote-marked cells
   ("94.7#", "72.1**") — the mark is stripped, the figure kept.

   Automation contract (same as confidence.mjs):
   - idempotent: re-running with unchanged upstream data writes nothing
   - exit 0 = success; final stdout line is `CONFIDENCE_HISTORY_STATUS {json}`
   - exit 1 = fetch/parse error; exit 2 = a structure guard tripped (page
     payload missing, year grid gone, implausible figure, series depth or
     contiguity floor broken)
   - --check computes everything, prints the status, never writes
   - --fixture-dir <dir> reads saved copies (cc.html, bc.html, h3.csv,
     fred-cci.csv) instead of fetching (test seam)
   - writes are atomic (.tmp + rename)
   Any failure fetching or parsing the FRED mirror is exit 1 and files
   NOTHING — the extractor never silently degrades to H3-only 2010+
   output; a FRED basis change trips the OECD/H3 reconciliation guard
   (exit 2). (No CI workflow, wrapper, or updater references this
   extractor today — crosstabs-updater.sh runs confidence.mjs only —
   so these semantics live in this header for any future wiring. */
/* CONFIDENCE_HISTORY_LIB=1: import the parsers (tests) without running. */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { TRACKER_UA, FETCH_TIMEOUT_MS, FETCH_TRIES, writeAtomic } from "./extract-common.mjs";

const argv = process.argv.slice(2);
const argOf = (k) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : null);
const CHECK = argv.includes("--check");
const FIXTURE_DIR = argOf("--fixture-dir");
const OUT = "data/confidence-history.json";

const RM_CC_URL = "https://www.roymorgan.com/morgan-poll/consumer-confidence-anz-roy-morgan-australian-cc-monthly-ratings";
const RM_BC_URL = "https://www.roymorgan.com/morgan-poll/consumer-confidence-roy-morgan-business-confidence";
const H3_CSV_URL = "https://www.rba.gov.au/statistics/tables/csv/h3-data.csv";
const FRED_CCI_URL = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=CSCICP02AUM460S";
/* 2010-01: where RBA H3's one-decimal GICWMICS series takes over as the
   source of record for the Westpac–MI CSI — the OECD mirror files only
   months before it. */
const WP_H3_FROM = "2010-01";

const MONTHS_TOK = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/* parseYearGrid(contentHtml): pull the first YEAR×JAN..DEC table out of a
   morgan-poll page-body HTML string → Map "YYYY-MM" → value. Shape guards
   throw (main turns them into exit 2); -marked cells ("72.1**") parse. */
function parseYearGrid(html) {
  const rows = [];
  const trRe = /<tr[\s>][\s\S]*?<\/tr>/g;
  let m;
  while ((m = trRe.exec(html))) {
    const cells = [...m[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)]
      .map((c) => c[1].replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim());
    rows.push(cells);
  }
  const out = new Map();
  let inGrid = false, sawGrid = false;
  for (const cells of rows) {
    const upper = cells.map((c) => c.toUpperCase().replace(/[^A-Z]/g, ""));
    const monthHits = MONTHS_TOK.filter((t) => upper.includes(t)).length;
    if (!inGrid) {
      if (monthHits >= 10) { inGrid = true; sawGrid = true; }
      continue;
    }
    // in a grid: consume year rows; stop at the first non-year row
    if (!/^\d{4}$/.test(cells[0] || "")) {
      if (monthHits >= 10) continue; // a repeat header (component tables) — ignore
      break;
    }
    for (let mi = 0; mi < 12; mi++) {
      const raw = (cells[mi + 1] || "").trim();
      if (!raw) continue;
      const cm = raw.match(/^(-?\d+(?:\.\d+)?)[^\d]{0,4}$/);
      if (!cm) throw new Error(`unparseable grid cell ${JSON.stringify(raw)} in ${cells[0]}`);
      out.set(`${cells[0]}-${String(mi + 1).padStart(2, "0")}`, +cm[1]);
    }
  }
  if (!sawGrid) throw new Error("no YEAR×month grid found in page body");
  if (!out.size) throw new Error("year grid header found but no year rows parsed");
  return out;
}

/* parseH3(csvText): RBA Statistical Table H3 → { westpac: Map, nabCondDev: Map }.
   Columns are located by their Title-row names, never by position. */
function parseH3(csvText) {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim());
  const titleRow = lines.find((l) => /^Title,/.test(l));
  if (!titleRow) throw new Error("H3 csv: no Title header row");
  const cols = titleRow.split(",");
  const wi = cols.findIndex((c) => /consumer sentiment/i.test(c));
  const ci = cols.findIndex((c) => /business conditions/i.test(c));
  if (wi < 0 || ci < 0) throw new Error(`H3 csv: sentiment/conditions columns not found (${cols.join("|")})`);
  const westpac = new Map(), nabCondDev = new Map();
  for (const l of lines) {
    const r = l.split(",");
    const dm = r[0] && r[0].match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!dm) continue;
    const ym = `${dm[3]}-${dm[2]}`;
    if (r[wi] !== undefined && r[wi] !== "") westpac.set(ym, +r[wi]);
    if (r[ci] !== undefined && r[ci] !== "") nabCondDev.set(ym, +r[ci]);
  }
  if (!westpac.size || !nabCondDev.size) throw new Error("H3 csv: a series column parsed zero rows");
  return { westpac, nabCondDev };
}

/* parseFredCci(csvText): FRED/OECD CSV (series CSCICP02AUM460S, "Consumer
   Opinion Surveys: Composite Consumer Confidence for Australia") → Map
   "YYYY-MM" → the Westpac–MI CSI the balance names (v = balance + 100).
   The OECD republication carries the SAME index MI publishes — shown
   empirically against RBA H3 across the whole 2010→ overlap (max |diff|
   0.5, pure whole-point rounding) — so the +100 rebase stays on the one
   basis; the column is located by the observation_date/series-id header
   names, never by position, and FRED's "." gaps file nothing (the lane
   keeps its own tail instead). */
function parseFredCci(csvText) {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim());
  const hdr = lines.shift();
  if (!hdr || !/^observation_date,/i.test(hdr)) throw new Error("FRED csv: no observation_date header");
  const cols = hdr.split(",");
  const vi = cols.findIndex((c) => /CSCICP02AUM460S/i.test(c));
  if (vi < 0) throw new Error(`FRED csv: CSCICP02AUM460S column not found (${cols.join("|")})`);
  const out = new Map();
  for (const l of lines) {
    const r = l.split(",");
    const dm = r[0] && r[0].match(/^(\d{4})-(\d{2})-\d{2}$/);
    if (!dm) continue;
    const cell = r[vi];
    if (cell === undefined || cell === "" || cell === ".") continue;
    out.set(`${dm[1]}-${dm[2]}`, +cell + 100);
  }
  if (!out.size) throw new Error("FRED csv: zero data rows parsed");
  return out;
}

/* Structure + plausibility guards. Throws → exit 2. */
function guardLane(name, map, { first, min, max, floor, contiguousFrom }) {
  const yms = [...map.keys()].sort();
  if (yms.length < floor) throw new Error(`${name}: only ${yms.length} rows (< ${floor})`);
  if (yms[0] !== first) throw new Error(`${name}: first month ${yms[0]} != ${first}`);
  for (const ym of yms) {
    const v = map.get(ym);
    if (!Number.isFinite(v) || v < min || v > max) throw new Error(`${name}: ${ym}=${v} outside ${min}..${max}`);
  }
  // month-contiguity from the regular-cadence start through the newest row
  let [y, mo] = contiguousFrom.split("-").map(Number);
  const end = yms[yms.length - 1];
  for (;;) {
    const ym = `${y}-${String(mo).padStart(2, "0")}`;
    if (ym >= end) break;
    if (!map.has(ym)) throw new Error(`${name}: interior month ${ym} missing (cadence gap)`);
    mo++; if (mo > 12) { mo = 1; y++; }
  }
  return yms;
}

async function fetchWithRetry(label, url) {
  let lastErr;
  for (let i = 0; i < FETCH_TRIES; i++) {
    try {
      const res = await fetch(url, {
        headers: { "user-agent": TRACKER_UA, accept: "text/html,text/csv,*/*" },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      lastErr = err;
      if (i < FETCH_TRIES - 1) await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
  }
  throw new Error(`${label} fetch failed after ${FETCH_TRIES} tries: ${lastErr.message}`);
}

function nextDataContent(html, label) {
  const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!m) throw new Error(`${label}: no __NEXT_DATA__ payload`);
  const content = JSON.parse(m[1])?.props?.pageProps?.morganPollData?.morganPollBy?.content;
  if (!content) throw new Error(`${label}: morganPollData.morganPollBy.content missing`);
  return content;
}

export { parseYearGrid, parseH3, parseFredCci, guardLane, nextDataContent, RM_CC_URL, RM_BC_URL, H3_CSV_URL, FRED_CCI_URL, WP_H3_FROM };

if (!process.env.CONFIDENCE_HISTORY_LIB) {
  const prev = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : null;
  const grab = (file, label, url) =>
    FIXTURE_DIR ? readFileSync(join(FIXTURE_DIR, file), "utf8") : fetchWithRetry(label, url);

  let fredCsi;
  try {
    fredCsi = parseFredCci(await grab("fred-cci.csv", "FRED OECD consumer-confidence csv", FRED_CCI_URL));
  } catch (err) {
    /* A FRED fetch/parse failure files NOTHING — the extractor never
       silently degrades to H3-only 2010+ output. Exit 1 (fetch/parse),
       NOT the exit-2 structure-guard class. */
    console.error("FRED FETCH/PARSE FAILURE: " + err.message);
    process.exit(1);
  }

  let doc;
  try {
    const consumerMap = parseYearGrid(nextDataContent(await grab("cc.html", "RM consumer page", RM_CC_URL), "RM consumer page"));
    const businessMap = parseYearGrid(nextDataContent(await grab("bc.html", "RM business page", RM_BC_URL), "RM business page"));
    const { westpac: westpacH3, nabCondDev } = parseH3(await grab("h3.csv", "RBA H3 csv", H3_CSV_URL));

    /* The two republications of the ONE printed CSI merge here — but only
       after proving they ARE the same series: on every month both carry
       (2010-01 →), OECD balance+100 must sit within 0.55 of H3's decimal
       figure (whole-point rounding). Any month further out means the
       upstream source swapped basis under us; the run trips instead of
       filing a phantom lane. A thin overlap means the same thing. */
    let overlaps = 0;
    for (const [ym, h3v] of westpacH3) {
      const fv = fredCsi.get(ym);
      if (fv == null) continue;
      overlaps++;
      if (Math.abs(fv - h3v) > 0.55)
        throw new Error(`westpac OECD/H3 reconciliation broke at ${ym}: ${fv} vs ${h3v}`);
    }
    if (overlaps < 12) throw new Error(`westpac OECD/H3 overlap too thin to prove the match (${overlaps} months)`);
    /* Pre-2010 from the OECD mirror, 2010-01 → from H3 — H3 also wins if
       it ever backfils a month the mirror currently covers alone. */
    const westpac = new Map([...[...fredCsi].filter(([ym]) => ym < WP_H3_FROM), ...westpacH3]);

    const cc = guardLane("consumer", consumerMap, { first: "1973-03", min: 40, max: 170, floor: 550, contiguousFrom: "1987-01" });
    const bc = guardLane("business", businessMap, { first: "2010-12", min: 40, max: 170, floor: 170, contiguousFrom: "2010-12" });
    const wp = guardLane("westpacConsumer", westpac, { first: "1974-09", min: 50, max: 150, floor: 600, contiguousFrom: "1974-09" });
    const nb = guardLane("nabConditions", nabCondDev, { first: "1997-03", min: -60, max: 60, floor: 340, contiguousFrom: "1997-03" });

    const rowsOf = (yms, map) => yms.map((ym) => ({ ym, v: map.get(ym) }));
    doc = {
      _about: "Deep back-history for the Snapshot's confidence series — one row per SURVEY MONTH, {ym, v}; the monthly-frequency sibling of data/confidence.json (recent months reconcile there). consumer: ANZ–Roy Morgan Consumer Confidence, Mar 1973 → (quarterly to 1986, monthly from Jan 1987), from Roy Morgan's own monthly-ratings table (roymorgan.com/morgan-poll/consumer-confidence-anz-roy-morgan-australian-cc-monthly-ratings); since Oct 2010 each month is the average of that month's weekly readings — the WEEKLY series (Aug 2008 →) is mirrored nowhere free and lives in data/confidence.json (Dec 2016 →) only. business: Roy Morgan Business Confidence, Dec 2010 → (series inception), RM's own mirror table (roymorgan.com/morgan-poll/consumer-confidence-roy-morgan-business-confidence) — the mirror can trail the newest couple of months. westpacConsumer: Westpac–Melbourne Institute Consumer Sentiment, Sep 1974 → (series inception), two republications of the one published index: Jan 2010 → from RBA Statistical Table H3 series GICWMICS (rba.gov.au/statistics/tables), carrying MI's decimals and matching data/confidence.json's live lane 1:1 over the overlap; Sep 1974 – Dec 2009 from the OECD republication (FRED series CSCICP02AUM460S, fred.stlouisfed.org), which prints the SAME index as a net balance (index−100) rounded to whole index points — rebased +100 here, so pre-2010 months carry whole index points (±0.5 of MI's printed decimals; MI's exact-decimal 1974–2009 archive is a paid CASiE product; the extractor reconciles the mirror against H3 on every overlap month — within ±0.55 — before filing). nabConditions: NAB monthly business conditions, DEVIATION FROM LONG-RUN AVERAGE, sa, percentage points, Mar 1997 →, RBA H3 series GICNBC — never arithmetic-merge with the raw net-balance `cond` in data/confidence.json (different basis by source definition). NAB business CONFIDENCE (net balance, since 1989) has no free machine-readable source. Never hand-edit; regenerated by .build/confidence-history.mjs.",
      consumer: { label: "ANZ–Roy Morgan Consumer Confidence (monthly)", base: "Roy Morgan, index, 100 = neutral", source: RM_CC_URL, rows: rowsOf(cc, consumerMap) },
      business: { label: "Roy Morgan Business Confidence", base: "Roy Morgan, index, 100 = neutral", source: RM_BC_URL, rows: rowsOf(bc, businessMap) },
      westpacConsumer: { label: "Westpac–MI Consumer Sentiment", base: "Westpac–Melbourne Institute, index, 100 = neutral (sa)", source: H3_CSV_URL, seriesId: "GICWMICS", historySource: FRED_CCI_URL, historySeriesId: "CSCICP02AUM460S", historyNote: "months before 2010-01 are the OECD's whole-point republication of the same index (balance+100); 2010-01 → is RBA H3, one decimal", rows: rowsOf(wp, westpac) },
      nabConditions: { label: "NAB Business Conditions (deviation from average)", base: "NAB via RBA H3, deviation from long-run average, sa, percentage points", source: H3_CSV_URL, seriesId: "GICNBC", rows: rowsOf(nb, nabCondDev) },
    };
  } catch (err) {
    console.error("GUARD TRIP: " + err.message);
    process.exit(2);
  }

  const KEYS = ["consumer", "business", "westpacConsumer", "nabConditions"];
  const next = JSON.stringify(doc, null, 1) + "\n";
  const changed = !prev || readFileSync(OUT, "utf8") !== next;
  if (changed && !CHECK) writeAtomic(OUT, next);
  const added = {};
  for (const k of KEYS) {
    const prevSet = new Set((((prev || {})[k] || {}).rows || []).map((x) => x.ym));
    added[k] = doc[k].rows.filter((x) => !prevSet.has(x.ym)).map((x) => x.ym);
  }
  console.log("CONFIDENCE_HISTORY_STATUS " + JSON.stringify({
    changed,
    added,
    rows: Object.fromEntries(KEYS.map((k) => [k, doc[k].rows.length])),
    oldest: Object.fromEntries(KEYS.map((k) => [k, doc[k].rows[0].ym])),
    newest: Object.fromEntries(KEYS.map((k) => [k, doc[k].rows.at(-1).ym])),
  }));
}
