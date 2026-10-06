/* mood.mjs – builds data/mood.json, the business- and consumer-confidence
   series behind the Snapshot panel "The mood" (below Decidedness) and its
   Info glossary entry. Two Roy Morgan series:
     consumer – ANZ-Roy Morgan Consumer Confidence, weekly; the feed's topic
                index is dense from August 2019 (a few isolated items earlier).
     business – Roy Morgan Business Confidence, monthly since 2019.
   Both are read from the SAME WordPress findings-search feed as
   extract-roymorgan.mjs, just under their own topic[] filters; each feed
   item's title + summary carries the headline index value (and usually the
   printed change), so no per-post fetches are needed.

   The figure grammar (parseText) was shaped offline against a full dump of
   both topics (.matilda/probe/mood-grammar.mjs): five patterns cover every
   headline form the desk has used. A row files only when its value lands in
   the series' plausible band; when title and summary BOTH carry the value
   they must agree (the headline title wins the one disagreement on record);
   a release the grammar can't parse files nothing — the series simply skips
   that week (two such items exist: a bush-fires statement and a Budget
   think-piece that print no index value). The printed change is kept only
   where it reconciles with the previous measured reading of the chain
   (cadence-gated: a Christmas gap's printed change refers to the last
   release before it, not to our previous row); a conflicting change is
   dropped to null, never silently kept. RM's "unchanged" is a rounding
   verdict, so unchanged rows carry no change.

   Runs itself: the weekly crosstabs-update workflow (.build/crosstabs-updater.sh)
   calls it; steady-state runs fetch page 1 of each topic and stop (any
   release older than the newest recorded row by more than STRAGGLER_MARGIN_DAYS
   is already on file). First run (no data/mood.json) backfills both topics
   to their starts.

   Automation contract (same as the poll extractors):
   - idempotent: re-running with unchanged upstream data writes nothing
   - exit 0 = success (changed or not); final stdout line is
     `MOOD_STATUS {json}` with changed, added, rows, newest, stale
   - exit 1 = fetch/parse error; exit 2 = a safety guard tripped (a topic
     page returned no candidates at all — the feed's item shape changed —
     or the consumer series lost every post-2016 wave)
   - --check computes everything, prints MOOD_STATUS, never writes
   - --feed-dir <dir> reads saved fixtures (<topic>-page-N.json) instead of
     fetching (test seam, same shape as extract-roymorgan.mjs)
   - writes are atomic (.tmp + rename) */
/* MOOD_LIB=1: import the grammar/series/table constants (tests) without
   running the extraction. Same pattern as extract-roymorgan.mjs's RM_LIB. */
import { readFileSync, existsSync } from "node:fs";
import { TRACKER_UA, FETCH_TRIES, FETCH_TIMEOUT_MS, clean, writeAtomic } from "./extract-common.mjs";

const argv = process.argv.slice(2);
const argOf = (k) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : null);
const CHECK = argv.includes("--check");
const FEED_DIR = argOf("--feed-dir");
const FEED_BASE = "https://wp.roymorgan.com/wp-json/rmr/v1/findings-search";
// The posting page a row links to.
const postUrl = (slug) => `https://www.roymorgan.com/findings/${slug}`;
const OUT = "data/mood.json";
// Hard ceiling on the page walk (any mode) so a stop-miss can never fetch
// without bound; the consumer topic is ~47 pages deep at present.
const MAX_FEED_PAGES = 70;
// Steady-state walk stop: pages whose oldest release predates the newest
// recorded row by more than this are entirely on file already. Wide enough
// to straddle the December break plus a monthly business issue.
const STRAGGLER_MARGIN_DAYS = 40;
// A row this old means a release was missed. The consumer series pauses
// 18–25 days every Christmas (2019–2025 dump: worst routine gap 25d), so the
// alarm sits past that: four weeks silent is a genuinely stuck series.
const STALE_DAYS = { consumer: 28, business: 45 };

const UP = "(?:up|upward|rises[^a-z]|rose|lift(?:ed|s)?|jump(?:ed|s)?|increas(?:ed|es|ing)|improv(?:ed|es|ing)|rebound(?:ed|s)?|recover(?:ed|s|ing)?|bounc(?:e[sd]|ing)|climb(?:ed|s)?|strengthen(?:ed|s)?|gained|gains|consolidat(?:e[sd]?|ing)|revers(?:e[sd]?|ing))";
const DN = "(?:down|drop(?:ped|s)?|fell|fall(?:en|s|ing)?|slip(?:ped|s|ping)?|declin(?:ed|es|ing)?|decreas(?:ed|es)|plung(?:ed|es|ing)?|plummet(?:ed|s|ing)?|tumbl(?:ed|es|ing)|los(?:t|es|ing)|sinks?|sank|eas(?:e|ed|es|ing)|slumps?|slumped|falters?|dives?|losing|hits\\s+a\\s+new\\s+record\\s+low)";
const N = "(\\d+(?:\\.\\d+)?)(?![\\d.])";
const DIR = `(${UP}|${DN})`;
// Superlative wrapper, value-bearing: "a two year low", "30-year low",
// "record low", "lowest level since March 2020" — closed by to/at/of.
const SUP = "(?:(?:a|the)\\s+)?(?:new\\s+|record\\s+|all-time\\s+|historic\\s+|historical\\s+)*(?:\\w+-year\\s+)?(?:[a-z]+\\s+){0,2}?(?:low|high)(?:\\s+level)?\\s+(?:(?:since|in|for)\\s+[^0-9,.;]{3,50}\\s+)?(?:of|at|to)\\s+";
const TERM = "(?:to|at|of)";
const ADJ = "(?:only|slightly|just|a little|marginally|fractionally|sharply|dramatically|further|now)";
const upness = (w) => (new RegExp(`^${UP}$`, "i").test(w) ? 1 : -1);

// The two series. include/exclude test the slug with its numeric prefix
// stripped; candidates whose TITLE mentions New Zealand/Indonesia are
// dropped too (their slugs don't always say so).
const SERIES = {
  consumer: {
    topic: "consumer-confidence",
    include: /^anz-roy-morgan-(?:australian-)?consumer-confidence(?:-|$)/,
    exclude: [/new-zealand/, /nz-consumer/, /indonesia/, /good-time-to-buy/, /wellbeing/],
    anchor: "Consumer Confidence",
    band: [50, 140],
    label: "ANZ-Roy Morgan Consumer Confidence",
  },
  business: {
    topic: "business-confidence",
    include: /business-confidence/,
    exclude: [/mining/, /consumer-confidence/, /new-zealand/, /weekly-update/, /\bnz\b/, /utility/],
    anchor: "Business Confidence",
    band: [60, 170],
    label: "Roy Morgan Business Confidence",
  },
};

const dmyToIso = (s) => {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(s || "").trim());
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : null;
};

// Trim to the first sentence so later-issue chatter ("…country is going in
// the wrong direction…") can't leak its numbers into the parse.
const firstSentence = (s) => {
  const m = s.match(/^(.*?[.!?])(?:\s+[A-Z'"0-9]|$)/);
  return m ? m[1] : s;
};

/* The headline grammar. Each pattern returns { v, chg } (chg null when the
   text asserts none) or null; v is only accepted inside the series band so
   a percentage ("down 1.7%") can never land as an index value. Patterns run
   most-specific first. */
function parseText(s, anchor, band) {
  if (!s) return null;
  const inBand = (v) => v >= band[0] && v <= band[1];
  // parse window: from the series anchor, first ~240 chars. Falls back to
  // the whole window text when the anchor word isn't present (a summary can
  // open with plain "Confidence").
  const ai = s.search(new RegExp(anchor, "i"));
  const w = ai === -1 ? s : s.slice(ai, ai + 240);
  let m;
  // P1: dir + N pts → V ("down 3.4pts to 67.1", "up 0.3pts (+0.3%) to 114.3",
  //     "plummeted 14.2pts to a new record low of only 76.5")
  if ((m = w.match(new RegExp(`${DIR}\\s+(?:${ADJ}\\s+)?(?:by\\s+)?(?:a further\\s+)?${N}\\s*(?:\\([^)]*\\))?\\s*(?:pts?|points?)\\s*(?:\\([^)]*\\))?\\s*${TERM}\\s+(?:${SUP}(?:only\\s+|just\\s+)?|only\\s+|just above\\s+|just\\s+|around\\s+)?${N}`, "i")))
      && inBand(+m[3]))
    return { v: +m[3], chg: upness(m[1]) * +m[2] };
  // P2: dir → V ("consolidates to 110.1", "hits decade low at 100.0")
  if ((m = w.match(new RegExp(`${DIR}(?:\\s+${ADJ}){0,2}(?:\\s+in\\s+[A-Za-z]+)?\\s*${TERM}\\s+(?:${SUP}(?:only\\s+|just\\s+)?|only\\s+|just\\s+|around\\s+)?${N}`, "i")))
      && inBand(+m[2]))
    return { v: +m[2], chg: null };
  // P3: value-bearing superlative ("30-year low of 72.2", "record low at 72.2",
  //     "record low of only 76.1")
  if ((m = w.match(new RegExp(`${SUP}(?:only\\s+|just\\s+)?${N}`, "i"))) && inBand(+m[1]))
    return { v: +m[1], chg: null };
  // P3b: reversed superlative ("plunges to lowest historical record at 65.3")
  if ((m = w.match(new RegExp(`(?:lowest|highest)(?:\\s+[a-z-]+){0,3}?\\s+${TERM}\\s+(?:just\\s+|only\\s+)?${N}`, "i"))) && inBand(+m[1]))
    return { v: +m[1], chg: null };
  // P4: (virtually) unchanged … at V — no change recorded (rounding verdict)
  if ((m = w.match(new RegExp(`(?:virtually\\s+)?unchanged[^.;]{0,40}?${TERM}\\s+${N}`, "i"))) && inBand(+m[1]))
    return { v: +m[1], chg: null };
  // P5: bare assertion ("Confidence was 114.3")
  if ((m = w.match(new RegExp(`Confidence\\s+(?:was|is|were|sat|sits|stands)\\s+(?:at\\s+)?(?:just\\s+)?${N}`, "i"))) && inBand(+m[1]))
    return { v: +m[1], chg: null };
  return null;
}

// ---------------------------------------------------------------- fetching
async function fetchFeedPage(topic, page) {
  const url = `${FEED_BASE}?page=${page}&sort_by=date&topic[]=${topic}`;
  let lastErr;
  for (let i = 1; i <= FETCH_TRIES; i++) {
    try {
      if (FEED_DIR) {
        const p = `${FEED_DIR}/${topic}-page-${page}.json`;
        if (!existsSync(p)) return { arr: [], totalPages: page - 1 };
        return { arr: JSON.parse(readFileSync(p, "utf8")), totalPages: null };
      }
      const res = await fetch(url, {
        headers: { "user-agent": TRACKER_UA },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const arr = await res.json();
      if (!Array.isArray(arr)) throw new Error(`page ${page} not an array (endpoint changed?)`);
      return { arr, totalPages: +res.headers.get("x-wp-totalpages") || null };
    } catch (err) {
      lastErr = err;
      if (i < FETCH_TRIES) await new Promise((r) => setTimeout(r, 1500 * i));
    }
  }
  throw new Error(`feed page ${topic}/${page} fetch failed after ${FETCH_TRIES} tries: ${lastErr.message}`);
}

// ------------------------------------------------------------------- main
const prev = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : null;
const slugBare = (s) => String(s || "").replace(/^\d+-/, "");

async function rowsFor(name) {
  const r = SERIES[name];
  const prevRows = (prev && prev[name] && prev[name].rows) || [];
  const prevNewest = prevRows.length ? prevRows[prevRows.length - 1].date : null;
  const byDate = new Map(prevRows.map((x) => [x.date, x]));
  let candidates = 0;
  for (let page = 1; page <= MAX_FEED_PAGES; page++) {
    const { arr, totalPages } = await fetchFeedPage(r.topic, page);
    if (page === 1 && !arr.length) {
      console.error(`GUARD TRIP: ${r.label}: ${r.topic} page 1 returned no items — feed down or endpoint changed?`);
      process.exit(2);
    }
    if (!arr.length) break;
    let pageParsed = 0;
    for (const it of arr) {
      const iso = it.iso || dmyToIso(it.release_date);
      const slug = String(it.slug || "");
      if (!iso || !r.include.test(slugBare(slug)) || r.exclude.some((x) => x.test(slugBare(slug)))) continue;
      const title = clean(it.title || "");
      if (/new zealand|indonesia/i.test(title)) continue;
      candidates++;
      const t = parseText(title, r.anchor, r.band);
      const u = parseText(firstSentence(clean(it.summary || "")), r.anchor, r.band);
      let row = null;
      if (t && u) {
        // Both lanes agree almost always; the one documented disagreement
        // (2023-05-02) has the summary a stale copy — the title is the desk's
        // own headline and wins.
        row = Math.abs(t.v - u.v) <= 0.11 ? { v: t.v, chg: t.chg ?? u.chg }
          : { v: t.v, chg: t.chg ?? u.chg };
      } else if (t) row = { v: t.v, chg: t.chg ?? u?.chg ?? null };
      else if (u) row = { v: u.v, chg: u.chg ?? t?.chg ?? null };
      if (!row) continue; // a non-wave posting (statement, think-piece) — skip
      pageParsed++;
      byDate.set(iso, { date: iso, v: row.v, chg: row.chg, url: postUrl(slug), slug });
    }
    const oldest = dmyToIso(arr[arr.length - 1].release_date);
    // GUARD: pages of this topic must yield candidates — silence means the
    // feed's item shape changed, not a quiet fortnight.
    if (page === 1 && candidates === 0) {
      console.error(`GUARD TRIP: no ${r.label} candidates on ${r.topic} page 1 (${arr.length} items) — feed shape changed?`);
      process.exit(2);
    }
    if (totalPages && page >= totalPages) break;
    if (prevNewest && oldest && oldest < prevNewest && (Date.parse(prevNewest) - Date.parse(oldest)) / 864e5 > STRAGGLER_MARGIN_DAYS) break;
    if (!prevNewest && pageParsed === 0 && totalPages == null) break; // fixture end without totalPages
  }
  const rows = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  // Chain reconciliation: keep a printed change only where it matches the
  // implied move from the previous MEASURED period (cadence-gated — past a
  // Christmas/monthly gap the printed change refers to the last release
  // before the gap, which our series may skip, so it stands).
  const gate = name === "consumer" ? 14 : 45;
  for (let k = 1; k < rows.length; k++) {
    const a = rows[k - 1], b = rows[k];
    if (b.chg == null) continue;
    const gapDays = (Date.parse(b.date) - Date.parse(a.date)) / 864e5;
    if (gapDays > gate) continue;
    const implied = Math.round((b.v - a.v) * 10) / 10;
    if (Math.abs(implied - b.chg) > 0.35) {
      b.chg = null;
      console.log(`${name} ${b.date}: printed change didn't reconcile with ${a.date} chain — dropped`);
    }
  }
  // GUARD (full chain present): the consumer series is weekly since 2016 —
  // if a merged series lost every post-2016 row the merge went wrong.
  if (name === "consumer" && !rows.some((x) => x.date >= "2017-01-01")) {
    console.error("GUARD TRIP: consumer series holds no post-2016 rows — feed or filter change?");
    process.exit(2);
  }
  return rows;
}

// -------------------------------------------------------------------- main
export { parseText, SERIES, dmyToIso };
if (!process.env.MOOD_LIB) {
const consumer = await rowsFor("consumer");
const business = await rowsFor("business");

const doc = {
  _about: "Business and consumer confidence, from Roy Morgan's findings feed. consumer: ANZ-Roy Morgan Consumer Confidence (weekly; feed coverage dense from Aug 2019; 100 = neutral). business: Roy Morgan Business Confidence (monthly since 2019). Rows: {date, v, chg (printed period change, null when none printed or unreconciled), url, slug}. Built by .build/mood.mjs — see its header.",
  consumer: { label: SERIES.consumer.label, base: "ANZ-Roy Morgan, index, 100 = neutral", rows: consumer },
  business: { label: SERIES.business.label, base: "Roy Morgan, index, 100 = neutral", rows: business },
};
const next = JSON.stringify(doc, null, 1) + "\n";
const changed = !prev || readFileSync(OUT, "utf8") !== next;
const prevByKey = new Map(["consumer", "business"].flatMap((k) => (((prev || {})[k] || {}).rows || []).map((x) => [k + "|" + x.date, true])));
const added = {};
for (const k of ["consumer", "business"]) added[k] = doc[k].rows.filter((x) => !prevByKey.has(k + "|" + x.date)).map((x) => x.date);
if (changed && !CHECK) writeAtomic(OUT, next);
const daysAgo = (d) => (Date.now() - Date.parse(d + "T00:00:00Z")) / 864e5;
const stale = ["consumer", "business"].filter((k) => {
  const rows = doc[k].rows;
  return rows.length && daysAgo(rows[rows.length - 1].date) > STALE_DAYS[k];
});
console.log("MOOD_STATUS " + JSON.stringify({
  changed, added,
  rows: { consumer: consumer.length, business: business.length },
  newest: { consumer: consumer.at(-1)?.date ?? null, business: business.at(-1)?.date ?? null },
  stale,
}));
} // MOOD_LIB
