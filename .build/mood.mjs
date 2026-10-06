/* mood.mjs – builds data/mood.json, the business- and consumer-confidence
   series behind the Snapshot panel "The mood" (below Decidedness) and its
   Info glossary entry. Four series, two per side of the mood:
     consumer – ANZ-Roy Morgan Consumer Confidence, weekly; the feed's topic
                index is dense from August 2019 (a few isolated items earlier).
     business – Roy Morgan Business Confidence, monthly since 2019.
     westpacConsumer – Westpac–Melbourne Institute Consumer Sentiment,
                monthly; discovered on Westpac IQ's ROOT sitemap (the
                /economics/ section sitemap 302s to /Error under any UA).
                The wave's survey month and printed change come from the
                IQ article's meta description ("…to V in Month from F…");
                the release date is the page's display stamp (its JSON-LD
                datePublished is a bulk-migration stamp on pre-migration
                articles and must never gate the survey month). Video-only
                pages carry no figure and are skipped.
     nabBusiness – NAB Monthly Business Survey (confidence + conditions),
                monthly; NAB's AEM sitemap lists the /news/economy-markets/
                articles, each links the release PDF. The PDF (pdftotext
                -layout) supplies survey-month label, release date (2025-era
                embargo line; the post-migration sitemap lastmod otherwise)
                and the measure sentences; the article prose is read as an
                independent second witness and a PDF/article disagreement
                DROPS the wave rather than picking a side. Both measures lie
                on the net-balance scale (positive = expansionary), plotted
                shifted +100 so the shared "100 = neutral" reading holds —
                the TRUE printed figure is what tooltips and read rows show.
   The Roy Morgan pair are read from the SAME WordPress findings-search feed
   as extract-roymorgan.mjs, just under their own topic[] filters; each feed
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
import { readFileSync, existsSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TRACKER_UA, BROWSER_UA, FETCH_TRIES, FETCH_TIMEOUT_MS, clean, writeAtomic } from "./extract-common.mjs";

const argv = process.argv.slice(2);
const argOf = (k) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : null);
const CHECK = argv.includes("--check");
const FEED_DIR = argOf("--feed-dir");
// New-lane fixture seams (same contract as --feed-dir): a directory holding
// sitemap.xml plus URL-keyed fixtures — safeName(url)+".html" for pages,
// safeName(url)+".txt" for PDF text already through pdftotext.
const WESTPAC_DIR = argOf("--westpac-dir");
const NAB_DIR = argOf("--nab-dir");
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
const STALE_DAYS = { consumer: 28, business: 45, westpacConsumer: 45, nabBusiness: 45 };

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

// ===================== Westpac–MI consumer sentiment & NAB business ======
// Two more sources join data/mood.json (rows share the RM {date, v, chg,
// url, slug} shape; NAB rows add cond/condChg/ym):
//  westpacConsumer – Westpac–Melbourne Institute Consumer Sentiment,
//                    monthly; coverage Jan 2022 → (the IQ sitemap's own
//                    horizon — pre-2022 releases aren't addressable on
//                    either host). Figure carrier is the article's meta
//                    description: six desk phrasings over 2022–2026, all
//                    with a TO and a FROM level (verbatim) and usually a
//                    printed %, which must agree with the levels or the
//                    row never files. Date = the article's datePublished.
//  nabBusiness     – NAB Business Survey confidence (net balance),
//                    monthly; coverage Apr 2025 → (www.nab.com.au AEM
//                    sitemap → article → /content/dam PDF). The earlier
//                    business.nab.com.au WP-era archive went offline in
//                    Oct 2026 (a Wayback revival is deliberately out of
//                    scope). Conditions rides the row (cond/condChg) for
//                    read-row text; ym pins the survey month for dedupe.
//                    NAB figures are NET BALANCES (0 = neutral) — the site
//                    plots them SHIFTED +100 so the shared "100 = neutral"
//                    reading holds; rows here stay TRUE published figures.
// Figures file only verbatim (RM discipline). NAB dates come from the
// PDF's embargo line, else a post-migration sitemap lastmod validated
// against the printed survey month (the AEM replatform bulk-stamped
// lastmod ~2026-06-27/29 — a migration stamp, never a release date).
// Slug-strings never provide dates.
// The section sitemap /economics/sitemap.xml 302s to /Error; the site-root
// sitemap below is the one the WAF actually serves (a WAF serves an error
// page to any sub-path sitemap form).
const IQ_SITEMAP = "https://www.westpaciq.com.au/sitemap.xml";
const NAB_SITEMAP = "https://www.nab.com.au/sitemap.xml";
const IQ_INCLUDE = /<loc>(https:\/\/www\.westpaciq\.com\.au\/economics\/(\d{4})\/(\d{2})\/([^<]*consumer-sentiment[^<]*)\/)/g;
const NAB_URL = /<url>\s*<loc>(https:\/\/www\.nab\.com\.au\/news\/economy-markets\/([^<]+?))\/?<\/loc>\s*<lastmod>(\d{4}-\d{2}-\d{2})/g;
const NAB_INCLUDE = /business-survey|costs-ease-confidence|narrowing-gap-between-conditions/;
const NAB_EXCLUDE = /quarter|q[1-4]-|residential|wellbeing|consumer-sentiment|participate|pre-war|property|podcast|video/;
const WM_BAND = [40, 125];
const NAB_BAND = [-80, 80];
const NAB_MIGRATION_CUTOVER = "2026-07-01"; // a lastmod past this can stand in as a release date
const MONTHS = { january: 0, february: 1, march: 2, april: 3, may: 4, june: 5, july: 6, august: 7, september: 8, october: 9, november: 10, december: 11 };
const MON_FULL = "(January|February|March|April|May|June|July|August|September|October|November|December)";
const monIdx = (w) => MONTHS[Object.keys(MONTHS).find((k) => k.slice(0, 3) === String(w || "").toLowerCase().slice(0, 3))] ?? null;
// Dated slugs stay put; monthless slugs (the bare /nab-monthly-business-
// survey pointer, costs-ease-* …) can roll over to a new wave — refetch.
const NAB_STABLE_SLUG = /january|february|march|april|may|june|july|august|september|october|november|december|20\d\d/i;

const safeName = (u) => String(u).replace(/^https?:\/\//, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 160);
const laneFile = (dir, url, suffix) => {
  if (!dir) return null;
  const p = `${dir}/${safeName(url)}${suffix}`;
  return existsSync(p) ? readFileSync(p, "utf8") : null;
};
const laneSitemap = (dir) => (dir && existsSync(`${dir}/sitemap.xml`) ? readFileSync(`${dir}/sitemap.xml`, "utf8") : null);
async function fetchText(url) {
  let lastErr;
  for (let i = 1; i <= FETCH_TRIES; i++) {
    try {
      // BROWSER_UA: a public HTML page (WAF serves an error page to the
      // feed-API UA); the politeness contract rides in the fetch cadence.
      const res = await fetch(url, { headers: { "user-agent": BROWSER_UA }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      lastErr = err;
      if (i < FETCH_TRIES) await new Promise((r) => setTimeout(r, 1500 * i));
    }
  }
  throw new Error(`fetch ${url} failed after ${FETCH_TRIES} tries: ${lastErr.message}`);
}
const htmlToText = (h) => clean(String(h)
  .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
  .replace(/<[^>]+>/g, " ")
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
  .replace(/&(nbsp|amp|ndash|mdash|quot|apos|lt|gt);/gi, (s, k) => ({ nbsp: " ", amp: "&", ndash: "–", mdash: "—", quot: '"', apos: "'", lt: "<", gt: ">" }[k.toLowerCase()])));
// A PDF's text via pdftotext (layout). Absent poppler is an environment
// failure — a loud exit 1, never a silently empty lane.
async function pdfText(url) {
  const cached = laneFile(NAB_DIR, url, ".txt");
  if (cached != null) return cached;
  const res = await fetch(url, { headers: { "user-agent": TRACKER_UA }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`pdf ${url} HTTP ${res.status}`);
  const dir = mkdtempSync(join(tmpdir(), "mood-nab-"));
  try {
    const p = join(dir, "nab.pdf");
    writeFileSync(p, Buffer.from(await res.arrayBuffer()));
    return execFileSync("pdftotext", ["-layout", p, "-"], { encoding: "utf8", maxBuffer: 8 << 20 });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// Westpac description grammar: a TO level and a FROM level (verbatim),
// months attached or inherited ("… in April, to 90.1 from 95.9 in March"),
// and — where printed — a percentage that must agree with the levels.
// The "unchanged at V" variant files the level alone ('unchanged' is a
// rounding verdict, not an exact change — RM discipline).
const WM_NUM = "(\\d+(?:\\.\\d+)?)"; // never [\d.]+ — it eats the sentence's final period
function parseWMDesc(desc) {
  if (!desc) return null;
  const inBand = (v) => v >= WM_BAND[0] && v <= WM_BAND[1];
  const un = new RegExp(`\\bunchanged\\s+at\\s+${WM_NUM}(?:\\s+in\\s+${MON_FULL})?`, "i").exec(desc);
  if (un) {
    const v = +un[1];
    if (!inBand(v)) return null;
    return { v, from: null, toMon: un[2] ? monIdx(un[2]) : null, fromMon: null, chg: null };
  }
  const toM = new RegExp(`\\bto\\s+${WM_NUM}(?:\\s+in\\s+${MON_FULL})?`, "i").exec(desc);
  const fromM = new RegExp(`\\bfrom\\s+${WM_NUM}(?:\\s+in\\s+${MON_FULL})?`, "i").exec(desc);
  if (!toM || !fromM) return null;
  const v = +toM[1], from = +fromM[1];
  if (!inBand(v) || !inBand(from)) return null;
  const pctM = /([\d.]+)\s*%/.exec(desc);
  if (pctM && Math.abs(Math.abs((v - from) / from * 100) - +pctM[1]) > 0.6) return null; // levels rule over the print
  let toMon = toM[2] ? monIdx(toM[2]) : null;
  if (toMon == null) { // "…in April, to 90.1 from…" — the month precedes the to-level
    const pre = [...desc.slice(0, toM.index).matchAll(new RegExp(`\\bin\\s+${MON_FULL}\\b`, "gi"))];
    if (pre.length) toMon = monIdx(pre.at(-1)[1]);
  }
  const fromMon = fromM[2] ? monIdx(fromM[2]) : null;
  return { v, from, toMon, fromMon, chg: Math.round((v - from) * 10) / 10 };
}

async function westpacRows() {
  const prevRows = (prev && prev.westpacConsumer && prev.westpacConsumer.rows) || [];
  const seenUrls = new Set(prevRows.map((x) => x.url));
  const site = laneSitemap(WESTPAC_DIR) ?? (await fetchText(IQ_SITEMAP));
  const urls = [...site.matchAll(IQ_INCLUDE)]
    .map((m) => ({ url: m[1], y: +m[2], m: +m[3], slug: m[4] }))
    .filter((u) => !/video/.test(u.url));
  if (!urls.length) {
    console.error("GUARD TRIP: IQ sitemap has no non-video consumer-sentiment URLs — sitemap shape changed?");
    process.exit(2);
  }
  const byMonth = new Map(prevRows.map((r) => [r.date.slice(0, 7), r]));
  let fetched = 0;
  for (const u of urls) {
    if (seenUrls.has(u.url)) continue; // a steady-state run fetches nothing
    const html = laneFile(WESTPAC_DIR, u.url, ".html") ?? (await fetchText(u.url));
    fetched++;
    const dm = /<meta name="description" content="((?:[^"\\]|\\.)*?)"/.exec(html) || /"description":"((?:[^"\\]|\\.)*?)"/.exec(html);
    // Release date: the page's display stamp ("10:30 June 25 2024" in
    // .time-detail). datePublished is unusable on pre-migration articles —
    // bulk-republishing stamps moved it months past the wave.
    const dt = /class="time-detail">\s*<span>[\d:]+\s+(\w+)\s+(\d{1,2})\s+(\d{4})</.exec(html);
    const dp = dt && monIdx(dt[1]) != null
      ? ["", String(dt[3]), String(monIdx(dt[1]) + 1).padStart(2, "0"), String(+dt[2]).padStart(2, "0")]
      : /"datePublished":"(\d{4})-(\d{2})-(\d{2})/.exec(html);
    if (!dm || !dp) { console.log(`westpacConsumer ${u.url}: no description/datePublished — skipped`); continue; }
    const g = parseWMDesc(htmlToText(dm[1]));
    if (!g) { console.log(`westpacConsumer ${u.url}: ${dm[1].slice(0, 100)}… — skipped`); continue; }
    const toMon = g.toMon ?? (u.m - 1);
    if (+dp[2] !== toMon + 1) { console.log(`westpacConsumer ${u.url}: survey month (${toMon + 1}) != published month (${dp[2]}) — skipped`); continue; }
    if (u.m !== toMon + 1) { console.log(`westpacConsumer ${u.url}: survey month (${toMon + 1}) != URL month (${u.m}) — skipped`); continue; }
    const row = { date: `${dp[1]}-${dp[2]}-${dp[3]}`, v: g.v, chg: g.chg, url: u.url, slug: u.slug };
    const mk = row.date.slice(0, 7);
    if (byMonth.has(mk)) { console.log(`westpacConsumer ${u.url}: ${mk} already on file (${byMonth.get(mk).date}) — duplicate skipped`); continue; }
    byMonth.set(mk, row);
  }
  if (fetched) console.log(`westpacConsumer: fetched ${fetched} article(s)`);
  return [...byMonth.values()].sort((a, b) => a.date.localeCompare(b.date));
}

// NAB measure window: from each "business confidence|conditions" mention
// to the other measure's mention (or 260 chars) carries the desk's
// "…to ±N index point(s)" level and/or "…Npts" printed change.
function nabMeasure(txt, measure) {
  const name = `business\\s+${measure}`;
  const other = `business\\s+${measure === "confidence" ? "conditions" : "confidence"}`;
  let level = null, chg = null;
  for (const hit of txt.matchAll(new RegExp(name, "gi"))) {
    // the figure grammar lives in the measure's own sentence; a fixed window
    // bleeds into a neighbour's numbers (May-25 read Profitability's
    // "at -4 index points" as confidence; the 2026 banner hands conditions
    // the confidence sentence). Decimal points end no sentence here, and a
    // closing quote/paren may sit between the stop and the next capital.
    let win = txt.slice(hit.index);
    const end = win.search(/\.["')\]]*\s+[A-Z("]/);
    win = win.slice(0, end >= 0 ? end + 1 : 260);
    const stop = win.search(new RegExp(other, "i"));
    if (stop > 0) win = win.slice(0, stop);
    if (level == null) {
      // "to +1 index point" or the held-variant "held at 3 index points"
      const lm = /(?:^|[^a-z])(?:to|at)\s+([+-]?\d+(?:\.\d+)?)\s*index\s*points?/i.exec(win);
      if (lm) level = +lm[1];
    }
    if (chg == null) {
      const cm = new RegExp(`\\b(${UP}|${DN})\\s+(?:a further\\s+)?([\\d.]+)\\s*(?:\\([^)]*\\)\\s*)?pts?\\b`, "i").exec(win);
      if (cm) chg = upness(cm[1]) * +cm[2];
    }
    if (level != null && chg != null) break;
  }
  if (level != null && (level < NAB_BAND[0] || level > NAB_BAND[1])) level = null;
  return { level, chg };
}

// The PDF carries everything (pdftotext -layout): the survey-month label
// ("NAB Monthly Business Survey Nov-25", or a bare "August 2026" heading),
// the release date (embargo line; 2025 era), and the measure sentences.
function parseNabPdf(txt) {
  // the Table-1 caption interleaves into a wrapped bullet's line, splitting
  // "…to +6 index <caption> points…" — strip it before squeezing
  const sq = txt.replace(/Table 1:\s*Key Monthly Business Survey Statistics/g, "").replace(/\s+/g, " ");
  // 2026-era banner, both labels then both captions interleaved into one
  // run-on ("-8 Index points -1 Index points Business Confidence Business
  // Conditions Fell 2pts (unrounded) to -8 index points Fell 5pts …"):
  // the two numbers above the labels are confidence then conditions. Lift
  // the levels and CUT the banner out — left in, its confidence caption
  // reads as the conditions figure (Aug-26 parsed cond -8 for -1).
  const big = /([+-]?\d+(?:\.\d+)?)\s+Index\s+points?\s+([+-]?\d+(?:\.\d+)?)\s+Index\s+points?\s+Business\s+Confidence\s+Business\s+Conditions/i.exec(sq);
  const mtxt = big
    ? sq.slice(0, big.index) + (sq.indexOf("Summary", big.index) >= 0 ? " " + sq.slice(sq.indexOf("Summary", big.index)) : "")
    : sq;
  let smon = null, syr = null;
  const lab = new RegExp(`NAB Monthly Business Survey\\s*(?:,\\s*)?(\\w{3,9})\\s*[-–]\\s*(\\d{2,4})`, "i").exec(txt);
  if (lab && monIdx(lab[1]) != null) {
    smon = monIdx(lab[1]);
    syr = lab[2].length === 2 ? 2000 + +lab[2] : +lab[2];
  } else {
    const head = new RegExp(`^\\s*${MON_FULL}\\s+(20\\d{2})\\s*$`, "m").exec(txt);
    if (head && /NAB Monthly Business Survey/i.test(txt.slice(0, 400))) {
      smon = monIdx(head[1]);
      syr = +head[2];
    }
  }
  let date = null;
  const emb = new RegExp(`Embargoed until[^,\\n]*,\\s*(\\d{1,2})\\s+${MON_FULL}\\s+(20\\d{2})`, "i").exec(txt);
  if (emb) date = `${emb[3]}-${String(monIdx(emb[2]) + 1).padStart(2, "0")}-${emb[1].padStart(2, "0")}`;
  const conf = nabMeasure(mtxt, "confidence"), cond = nabMeasure(mtxt, "conditions");
  if (big) {
    // banner levels are a second witness; a sentential level that dis­agrees
    // with the banner rejects the measure (never pick one arbitrarily)
    for (const [got, lv] of [[conf, +big[1]], [cond, +big[2]]]) {
      if (lv < NAB_BAND[0] || lv > NAB_BAND[1]) continue;
      if (got.level == null) got.level = lv;
      else if (got.level !== lv) got.level = null;
    }
  }
  // Table-1 national rows (2025 era) must agree where they exist; the 2026
  // industry/state tables simply don't match this shape and skip checking.
  for (const [measure, got] of [["confidence", conf], ["conditions", cond]]) {
    if (got.level == null) continue;
    const t = new RegExp(`Business ${measure}\\s+(-?\\d+)\\s+(-?\\d+)\\s+(-?\\d+)\\b`, "i").exec(txt);
    if (t && +t[3] !== got.level) got.level = null;
  }
  return { date, survey: smon != null ? { mon: smon, yr: syr } : null, conf, cond };
}

async function nabRows() {
  const prevRows = (prev && prev.nabBusiness && prev.nabBusiness.rows) || [];
  const seenUrls = new Set(prevRows.map((x) => x.url));
  const site = laneSitemap(NAB_DIR) ?? (await fetchText(NAB_SITEMAP));
  const urls = [...site.matchAll(NAB_URL)]
    .map((m) => ({ url: m[1], slug: m[2].replace(/\/$/, ""), lastmod: m[3] }))
    .filter((u) => NAB_INCLUDE.test(u.slug) && !NAB_EXCLUDE.test(u.slug));
  if (!urls.length) {
    console.error("GUARD TRIP: NAB sitemap has no monthly-business-survey candidates — sitemap shape changed?");
    process.exit(2);
  }
  const byMonth = new Map(prevRows.map((r) => [r.ym, r]));
  let fetched = 0;
  for (const u of urls) {
    if (seenUrls.has(u.url) && NAB_STABLE_SLUG.test(u.slug)) continue; // steady state fetches nothing
    const html = laneFile(NAB_DIR, u.url, ".html") ?? (await fetchText(u.url));
    fetched++;
    const atxt = htmlToText(html);
    const aConf = nabMeasure(atxt, "confidence"), aCond = nabMeasure(atxt, "conditions");
    // the PDF link lives under nab/documents/news/ (2025 era) or the email
    // composer's embargo dir (2026 era); the 2026 filenames carry a junk suffix
    const pm = /\/content\/dam\/nab(?:-email-composer\/[^"'\s)]*)?\/[^"'\s)]*?monthly[^"'\s)]*?business[^"'\s)]*?survey[^"'\s)]*?\.pdf/i.exec(html);
    if (!pm) { console.log(`nabBusiness ${u.url}: no PDF link — skipped`); continue; }
    const pdfUrl = pm[0].startsWith("http") ? pm[0] : `https://www.nab.com.au${pm[0]}`;
    let g;
    try { g = parseNabPdf(await pdfText(pdfUrl)); }
    catch (e) { console.log(`nabBusiness ${u.url}: pdf failed (${e.message}) — skipped`); continue; }
    if (!g.survey) { console.log(`nabBusiness ${u.url}: no survey-month label — skipped`); continue; }
    const { mon, yr } = g.survey;
    // levels: PDF values, cross-checked against the article prose where it
    // carries one; a disagreement rejects the wave (never average).
    const pick = (pdf, art, tag) => {
      if (pdf.level == null) return art.level;
      if (art.level != null && art.level !== pdf.level) { console.log(`nabBusiness ${u.url}: ${tag} PDF ${pdf.level} != article ${art.level} — wave dropped`); return -1e9; }
      return pdf.level;
    };
    const conf = pick(g.conf, aConf, "confidence"), cond = pick(g.cond, aCond, "conditions");
    if (conf === -1e9 || cond === -1e9) continue;
    if (conf == null || cond == null) { console.log(`nabBusiness ${u.url}: ${yr}-${mon + 1} levels incomplete (pdf ${g.conf.level}/${g.cond.level}, article ${aConf.level}/${aCond.level}) — skipped`); continue; }
    let date = g.date; // embargo stamp (verbatim)
    if (!date && u.lastmod >= NAB_MIGRATION_CUTOVER) {
      const dy = +u.lastmod.slice(0, 4), dm = +u.lastmod.slice(5, 7);
      if (dy * 12 + dm - (yr * 12 + mon + 1) >= 0 && dy * 12 + dm - (yr * 12 + mon + 1) <= 2) date = u.lastmod;
    }
    if (!date) { console.log(`nabBusiness ${u.url}: ${yr}-${mon + 1} has no release date (embargo/lastmod) — skipped`); continue; }
    const ym = `${yr}-${String(mon + 1).padStart(2, "0")}`;
    const row = { date, v: conf, chg: g.conf.chg ?? null, cond, condChg: g.cond.chg ?? null, ym, url: u.url, slug: u.slug };
    if (byMonth.has(ym)) {
      const old = byMonth.get(ym);
      if (old.v !== row.v || old.cond !== row.cond) console.log(`nabBusiness ${u.url}: ${ym} CONFLICT with ${old.url} (${old.v}/${old.cond} vs ${row.v}/${row.cond}) — keeping first`);
      continue;
    }
    byMonth.set(ym, row);
  }
  if (fetched) console.log(`nabBusiness: fetched ${fetched} article(s)`);
  const rows = [...byMonth.values()].sort((a, b) => a.date.localeCompare(b.date));
  // Printed "(unrounded)" confidence changes reconcile with tolerance 1.5 —
  // the integer move can sit 1pt off the unrounded print.
  for (let k = 1; k < rows.length; k++) {
    const a = rows[k - 1], b = rows[k];
    if (b.chg == null) continue;
    if ((Date.parse(b.date) - Date.parse(a.date)) / 864e5 > 45) continue;
    if (Math.abs(b.v - a.v - b.chg) > 1.5) {
      console.log(`nabBusiness ${b.date}: printed change didn't reconcile with ${a.date} chain — dropped`);
      b.chg = null;
    }
  }
  if (!rows.length) {
    console.error("GUARD TRIP: nabBusiness yielded no rows from a populated sitemap — lane broken");
    process.exit(2);
  }
  return rows;
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
export { parseText, SERIES, dmyToIso, parseWMDesc, parseNabPdf, nabMeasure, safeName, htmlToText };
if (!process.env.MOOD_LIB) {
const consumer = await rowsFor("consumer");
const business = await rowsFor("business");
const westpac = await westpacRows();
const nab = await nabRows();

const doc = {
  _about: "Business and consumer confidence. consumer/business: Roy Morgan's findings feed (weekly, dense from Aug 2019 / monthly since 2019; 100 = neutral). westpacConsumer: Westpac–Melbourne Institute Consumer Sentiment (monthly; IQ-sitemap coverage Jan 2022 →; 100 = neutral). nabBusiness: NAB Monthly Business Survey (monthly; AEM-sitemap coverage Apr 2025 →; the earlier WP-era archive is offline). Rows: {date, v, chg (printed period change; null when none printed or unreconciled), url, slug}. NAB rows add {cond, condChg, ym}; NAB figures are NET BALANCES (0 = neutral) — the site plots them SHIFTED +100 so the shared neutral line holds. Lane details: .build/mood.mjs header.",
  consumer: { label: SERIES.consumer.label, base: "ANZ-Roy Morgan, index, 100 = neutral", rows: consumer },
  business: { label: SERIES.business.label, base: "Roy Morgan, index, 100 = neutral", rows: business },
  westpacConsumer: { label: "Westpac–MI Consumer Sentiment", base: "Westpac–Melbourne Institute, index, 100 = neutral", rows: westpac },
  nabBusiness: { label: "NAB Business Confidence", base: "NAB, net balance, 0 = neutral (plotted +100)", rows: nab },
};
const next = JSON.stringify(doc, null, 1) + "\n";
const changed = !prev || readFileSync(OUT, "utf8") !== next;
const KEYS = ["consumer", "business", "westpacConsumer", "nabBusiness"];
const prevByKey = new Map(KEYS.flatMap((k) => (((prev || {})[k] || {}).rows || []).map((x) => [k + "|" + x.date, true])));
const added = {};
for (const k of KEYS) added[k] = doc[k].rows.filter((x) => !prevByKey.has(k + "|" + x.date)).map((x) => x.date);
if (changed && !CHECK) writeAtomic(OUT, next);
const daysAgo = (d) => (Date.now() - Date.parse(d + "T00:00:00Z")) / 864e5;
const stale = KEYS.filter((k) => {
  const rows = doc[k].rows;
  return rows.length && daysAgo(rows[rows.length - 1].date) > (STALE_DAYS[k] ?? 45);
});
console.log("MOOD_STATUS " + JSON.stringify({
  changed, added,
  rows: Object.fromEntries(KEYS.map((k) => [k, doc[k].rows.length])),
  newest: Object.fromEntries(KEYS.map((k) => [k, doc[k].rows.at(-1)?.date ?? null])),
  stale,
}));
} // MOOD_LIB
