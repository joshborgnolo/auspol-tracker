// Extract the latest Roy Morgan federal-voting-intention releases from the
// findings feed (https://www.roymorgan.com/findings) and append their rows to
// data/polls.json (the tracker's canonical current-cycle dataset).
//
// Discovery: the site's findings page renders only page 1 of a client-side
// paginated list (the ?page=N query is ignored server-side, so a release
// that scrolled off page 1 was UNREACHABLE — the gap check-coverage.mjs
// exists to detect). The front-end's own WP REST endpoint paginates for
// real: https://wp.roymorgan.com/wp-json/rmr/v1/findings-search?page=N
// (x-wp-totalpages headers), and &topic[]=federal-poll cuts the ~2500
// findings to the ~190 poll releases, newest first. The walk stops once a
// page's releases all predate the newest recorded wave minus a straggler
// margin, and zero candidates is never a quiet week — it trips the guard.
// Each release's figures still live in its prose page's __NEXT_DATA__.
// A release qualifies when its slug contains "federal-voting-intention" —
// press round-ups and specials like the post-Budget SMS poll (slug
// "federal-voting-post-budget-special-sms-morgan-poll-…") are different
// products and stay out.
//
// Parsing target (all in findingData.postBy.content, entity/HTML cleaned):
//   - the lead sentence lists every party's share with the week-on-week
//     change mixed in ("ALP primary support is down 1.5% to 27%", "unchanged
//     at 27.5%", "One Nation 27% (up 2%)", down 2% AT 12%…). The change
//     phrases are stripped, then each party is read as NAME … to/at/on V%.
//     Verified against live releases 2026-03-30 → 2026-08-24 (17/19; the two
//     misses are pre-April narrative-era and a wrong-by-one dateStart that was
//     hand-entered in polls.json, matching the release text here).
//   - stated-preference 2PP: the first "ALP x%" … "L-NP y%" pair after the
//     "vote their preferences" anchor (the ALP-vs-One-Nation pair and the
//     2025-election preference-flow pair also appear in the text and are NOT
//     what the tracker series' tpp_alp/tpp_lnp store).
//   - election-flows 2PP: releases also print an ALP/L-NP pair "allocated
//     based on how Australians voted at the 2025 Federal Election" — a
//     clause can intervene ("…marginally closer … Allocating the preference
//     flows … shows the ALP on 55% …"), so the window is generous and "the
//     ALP on x%" phrasing is accepted. Stored as tpp_flows (ALP share only;
//     L-NP is its complement). The anchor is the allocation phrase
//     ("allocated based on how Australians voted"), NOT "2025 Federal
//     Election": the prose often quotes the election RESULT under that
//     phrase first ("clearly above the 2025 Federal Election result in
//     early May: ALP 55.2% cf. L-NP 44.8%"), and anchoring there stored
//     55.2 on five 2025 rows (found 2026-09-19, repaired by
//     backfill-roymorgan-flows.mjs --refill). Roy Morgan prints the flows
//     pair to the half point, so a pair off that grid is treated as an
//     election-result echo and trips the guard. A release that allocates
//     the MONTH's sample ("…this week's Roy Morgan survey for the month of
//     December are allocated…") prints a figure that belongs to no weekly
//     row — the field stays absent, with a warning. Eras that never print
//     the pair have no such phrase at all and the pair stays null — an
//     anchor WITHOUT a pair is only a warning, but a parsed pair that fails
//     the plausibility guards aborts the run.
//   - ALP v One Nation 2PP: weekly since 2026-05-17 (polls.json wave date;
//     released May 18) the release closes with an ALP-vs-One-Nation
//     head-to-head after the anchor "contest is set to be between the ALP
//     and One Nation" (two estimator phrasings — "the Morgan Poll estimates
//     …" and "Roy Morgan estimates …"). Filed as an altTpp record {date,
//     firm, alpVsOnp_alp, lnpVsOnp_lnp:null}, never a polls-row field;
//     absent anchors before that wave are NOT a warning.
//   - national direction: "going in the right/wrong direction" shares.
//     Filed as a `direction` row {date, dateStart, pollster, right, wrong,
//     unsure} keyed on the wave date like the poll row — the per-poll
//     breakdown (PollLedger "National direction") and the monthly direction
//     line both hang off that key. `unsure` is not printed in the prose: it
//     is the remainder to 100. Like the altTpp pair, the row is filed even
//     when the wave's polls row already exists, so a wave missed on its
//     original run self-heals while its release is still in the feed.
//   - fieldwork period "conducted from Month D – Month D, YYYY", sample
//     "cross-section of N electors", and (when present) the "can't say" share,
//     which is undecided BESIDE the primaries, not inside them.
//
// Row shape mirrors the hand-entered Roy Morgan entries already in
// data/polls.json; `date` is the fieldwork-ending Sunday, `published` the
// CMS post datetime converted UTC → Australia/Melbourne. Rows are inserted
// in date order (validate.mjs demands a globally sorted array). An existing
// (date, "Roy Morgan") polls row is never re-added, but its release can
// still contribute: a parsed ALP-v-One-Nation pair whose (date, firm) key
// is missing from altTpp is appended there even when the polls row exists
// (self-heals a wave missed on its original run). A run that adds neither
// writes nothing.
//
// Provenance: each appended release's parsed post JSON is saved to
// .build/roymorgan-src/release-<slug>.json and committed alongside.
//
// Adjudication (2026-10-02): the judgement calls this script used to punt —
//   * DOUBLE releases: ≥2 unfiled candidates ≤4 days apart or with
//     overlapping field windows (a fortnight special sitting beside the
//     weekly wave; a wave republished under a second slug). Plain runs file
//     every candidate as before; --adjudicate emits a case and HOLDS the
//     cluster, and the wrapper re-runs with --decisions <verdict-file>
//     (file_both | file_only <slug> | never_file <slug>). never_file and
//     the file_only sibling persist to .build/roymorgan-src/adjudicated.json
//     so the slug is dropped from candidates on later runs (dup_of).
//   * REISSUES: a candidate whose wave date already has a polls row but
//     whose parsed figures moved >0.5pt (a corrected or expanded
//     re-release). Case → heal_absent (fills fields the row leaves ABSENT,
//     from the parser's values; a field the row carries is never touched —
//     the never-overwrite covenant holds) or escalate (no data change; the
//     correction is repair-agent or human work, noted in the run status).
//   The LLM's verdicts are routing only; every row filed still passes
//   guardRelease in this run, and validate.mjs runs in the wrapper after.
//   Without --adjudicate the script behaves exactly as before.
//
// Fetch fixture seam for tests: --feed-dir <dir> reads the feed page(s) and
// per-post payloads from files instead of the network:
//   <dir>/feed-page-<n>.json   the findings-search array for page n
//   <dir>/post-<slug>.json     the post's __NEXT_DATA__ object
//
// Usage: node .build/extract-roymorgan.mjs [--check] [search-api-base]
//        [--adjudicate] [--decisions <file>] [--feed-dir <dir>]
//
// Automation contract (safe to schedule in launchd):
//   - idempotent: re-running with unchanged upstream data writes nothing
//   - exit 0 = success (changed or not); final stdout line is
//     `RM_STATUS {json}` with changed, added, skipped — machine-greppable
//   - exit 1 = fetch/parse error; exit 2 = a safety guard tripped (a figure
//     missing, sums off 100, implausible values, non-Sunday period end,
//     release date inconsistent with the field period, or the findings-search
//     feed losing every poll candidate — silence is never a quiet fortnight)
//     — the upstream format changed or the parse went wrong; nothing written
//   - --check computes everything, prints RM_STATUS, never writes
//   - writes are atomic (.tmp + rename)
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fetchText, TRACKER_UA, FETCH_TRIES, FETCH_TIMEOUT_MS, MONTHS, clean, writeAtomic, pool } from "./extract-common.mjs";
import { RM_DOUBLE_DAYS, RM_REISSUE_PT } from "./adjudicate-cases.mjs";

const argv = process.argv.slice(2);
const argOf = (k) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : null);
const CHECK = argv.includes("--check");
const FEED_DEFAULT = "https://wp.roymorgan.com/wp-json/rmr/v1/findings-search";
// The positional search-api-base argument must not swallow a --flag value
const FLAG_VALUE = new Set(["--feed-dir", "--decisions"]);
const FEED_URL = argv.find((a, i) => !a.startsWith("--") && !(i > 0 && FLAG_VALUE.has(argv[i - 1]))) || FEED_DEFAULT;
// Adjudication flags (design in the header): --adjudicate needs the LLM pass
// to exist behind it — poll-agent.yml carries MATILDA_API_KEY, the laptop
// launchd copies deliberately don't. A key-less run is a plain run.
const FEED_DIR = argOf("--feed-dir");
const ADJUDICATE = argv.includes("--adjudicate") && !!process.env.MATILDA_API_KEY;
const DECISIONS_FILE = argOf("--decisions");
// The front-end's own query: date-ordered, filtered server-side to the
// "Federal Poll" topic, 10 posts/page (x-wp-totalpages reports the count).
const FEED_QS = "sort_by=date&topic[]=federal-poll";
// Hard ceiling on the page walk so a wrong stop-margin can never fetch
// without bound; the poll feed is ~19 pages deep at present.
const MAX_FEED_PAGES = 20;
// Walking stops when a page's oldest release predates the newest recorded
// wave by this much — covers a straggler release for a wave the tracker
// already has while keeping the normal run to a single page.
const STRAGGLER_MARGIN_DAYS = 14;
const OUT = "data/polls.json";
const SRC_DIR = ".build/roymorgan-src";
// The adjudicator's ledger: terminal verdicts (never_file / dup_of /
// heal_absent / escalate) plus the anti-spam "asked" mark, per slug or case
// id. Committed by the wrapper, so each ambiguity is resolved ONCE.
const ADJ_PATH = `${SRC_DIR}/adjudicated.json`;
// reissue heal_absent fill scope: flat fields a row plausibly predates —
// applied only where the row leaves them absent; a field it carries is
// never touched (the never-overwrite covenant holds).
const HEAL_FIELDS = ["tpp_flows", "undecided", "published", "sample"];
const todayIso = () => new Date().toISOString().slice(0, 10);

// ---------------------------------------------------------------- fetching
// fetchText/consts come from ./extract-common.mjs; this house identifies as
// a crawler (TRACKER_UA), not a browser.

function nextData(html, what) {
  const m = html.match(/__NEXT_DATA__[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error(`no __NEXT_DATA__ in ${what}`);
  return JSON.parse(m[1]);
}

// One findings-search page: JSON array of summary posts + x-wp-totalpages.
async function fetchFeedPage(base, page) {
  const url = `${base}?page=${page}&${FEED_QS}`;
  let lastErr;
  for (let i = 1; i <= FETCH_TRIES; i++) {
    try {
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
  throw new Error(`feed page ${page} fetch failed after ${FETCH_TRIES} tries: ${lastErr.message}`);
}

// Feed release_date "DD/MM/YYYY" → "YYYY-MM-DD" (null when absent/garbled).
const dmyToIso = (s) => {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(s || "").trim());
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : null;
};

// ------------------------------------------------------------ text helpers
// clean() comes from ./extract-common.mjs — the shared superset normaliser
// (script→space, curly-quote straightening); release prose parsing uses only
// ASCII quote shapes after it.

// Strip the week-on-week change phrases so "down 1.5% to 27%", "unchanged at
// 27.5%", "27% (up 2%)", "increased support 1% to 25.5%" and "down 2% at 12%"
// all collapse to "<party> … to/at/on <value>%".
function normaliseLead(lead) {
  return lead
    .replace(/\(\s*(?:up|down|unchanged|both unchanged|no change)[^)]*\)/gi, "")
    .replace(/\b(?:up|down|rose|fell|increased|decreased|dropped|declined|grew)\s+(?:support\s+|by\s+)?[\d.]+\s*%\s*(?:points?\s*)?(?=\s*(?:to|at)\s)/gi, "")
    .replace(/\bunchanged\s+(?=(?:at|on)\s+[\d.])/gi, "");
}
const BOUND = "(?:to|at|on|is|was|were|are|with)";
const toValIn = (scope, name) => {
  const m = scope.match(new RegExp("\\b" + name + "\\b\\s+(?:on\\s+)?([\\d.]+)\\s*%", "i"))
       ?? scope.match(new RegExp("\\b" + name + "\\b[^%]{0,60}?\\b" + BOUND + "\\s+([\\d.]+)\\s*%", "i"))
       ?? scope.match(new RegExp("([\\d.]+)\\s*%\\s*" + name, "i")); // "(20% Liberal, 2.5% Nationals)"
  return m ? parseFloat(m[1]) : null;
};
const IND_NAME = "(?:Independents?\\s*\\/\\s*Others?(?:\\s+Parties)?|Others?(?:\\s+Parties)?\\s*\\/\\s*Independents?)";

const iso = (y, m, d) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const DAY = 86400000;
const sundayOf = (dateIso) => new Date(dateIso + "T00:00:00Z").getUTCDay() === 0;

// --------------------------------------------------------------- the parse
function parseRelease(post) {
  const t = clean(post.content);
  const missing = [];
  const eIdx = t.indexOf("electors.");
  const lead = normaliseLead(eIdx === -1 ? t : t.slice(0, eIdx + 8));
  if (eIdx === -1) missing.push("lead sentence (…electors.)");

  const alp = toValIn(lead, "ALP");
  const onp = toValIn(lead, "One Nation");
  const lnp = toValIn(lead, "L-NP Coalition");
  const lib = toValIn(lead, "Liberals?");
  const nat = toValIn(lead, "Nationals");
  const grn = toValIn(lead, "Greens");
  const ind = toValIn(lead, IND_NAME);
  for (const [k, v] of [["alp", alp], ["onp", onp], ["lnp", lnp], ["lib", lib], ["nat", nat], ["grn", grn], ["ind", ind]])
    if (v == null) missing.push(k);

  const undM = t.match(/([\d.]+)%\s*\((?:up|down|unchanged)[^)]*\)\s*[^)]{0,40}?can.?t say/i)
        ?? t.match(/([\d.]+)%[^%]{0,60}?can.?t say/i);
  const undecided = undM ? parseFloat(undM[1]) : null; // optional: some eras omit the line

  const sampleM = t.match(/cross-section of ([\d,]+) electors/i);
  if (!sampleM) missing.push("sample");

  const pm = t.match(/conducted from\s+([A-Za-z]+)\.?\s+(\d+)\s*[-–]\s*(?:([A-Za-z]+)\.?\s+)?(\d+),\s+(\d{4})/i);
  let dateStart = null, date = null;
  if (!pm) missing.push("field period");
  else {
    const [, m1, d1, m2, d2, y] = pm;
    const mo1 = MONTHS[m1.toLowerCase()];
    const mo2 = m2 ? MONTHS[m2.toLowerCase()] : mo1;
    if (mo1 == null || mo2 == null) missing.push(`field months ${m1}/${m2}`);
    else {
      /* the printed year belongs to the END date; a Dec→Jan window starts in
         the prior year */
      dateStart = iso(mo2 < mo1 ? +y - 1 : +y, mo1, +d1);
      date = iso(+y, mo2, +d2);
    }
  }

  let tpp_alp = null, tpp_lnp = null;
  const wi = t.search(/vote.\s*their preferences/i);
  if (wi === -1) missing.push("2pp anchor");
  else {
    const w = t.slice(wi, wi + 300);
    const pa = w.match(/ALP\s*([\d.]+)%/i);
    const pl = pa && w.slice(w.indexOf(pa[0]) + pa[0].length).match(/L-NP(?:\s+Coalition)?\s+([\d.]+)%/i);
    if (!pa || !pl) missing.push("2pp pair");
    else { tpp_alp = parseFloat(pa[1]); tpp_lnp = parseFloat(pl[1]); }
  }

  let tpp_flows = null, tpp_flows_lnp = null, flowsPairMissing = false, flowsMonthly = false;
  const fi = t.search(/allocated based on how Australians voted/i);
  if (fi !== -1) {
    const w = t.slice(fi, fi + 700);
    const pa = w.match(/ALP\s+(?:on\s+)?([\d.]+)\s*%/i);
    const pl = pa && w.slice(w.indexOf(pa[0]) + pa[0].length).match(/L-NP(?:\s+Coalition)?\s+(?:on\s+)?([\d.]+)\s*%/i);
    // "…survey for the month of December are allocated…": a monthly figure
    // on a weekly release belongs to no single row
    flowsMonthly = /for the month of/i.test(t.slice(Math.max(0, fi - 120), fi));
    if (!pa || !pl) flowsPairMissing = true;
    else if (!flowsMonthly) { tpp_flows = parseFloat(pa[1]); tpp_flows_lnp = parseFloat(pl[1]); }
  }

  // ALP v One Nation 2PP — weekly since wave date 2026-05-17, anchored on
  // "...contest is set to be between the ALP and One Nation" (absent before
  // that wave, no warning then). Two estimator phrasings — "the Morgan Poll
  // estimates … (narrowly )?(leading|in front of)" and "Roy Morgan
  // estimates … in front of". The window goes through normaliseLead() first:
  // the week-on-week change parentheticals ("(up 2.5%)") contain "%" and a
  // [^%]* gap would mis-latch. The 2026-05-17 variant ("the ALP 54% leads
  // One Nation 46%", post-budget SMS-poll flows) is already recorded in
  // altTpp and its release is out of the feed — documented, not parsed here.
  let tpp_onp = null, tpp_onp_onp = null, onpPairMissing = false;
  const oi = t.search(/contest is set to be between the ALP and One Nation/i);
  if (oi !== -1) {
    const w = normaliseLead(t.slice(oi, oi + 500));
    const op = w.match(/the ALP\s+(?:on\s+)?([\d.]+)\s*%[^%]{0,60}?(?:leading|leads?|in front of)\s+One Nation\s+(?:on\s+)?([\d.]+)\s*%/i);
    if (op) { tpp_onp = parseFloat(op[1]); tpp_onp_onp = parseFloat(op[2]); }
    else onpPairMissing = true;
  }

  /* National direction — "going in the right/wrong direction", printed as
     two adjacent sentences: a wrong-direction figure ("A large majority of
     Australians, N%, say the country is 'going in the wrong direction'", or
     the headed "Large majority of N% … of electors say Australia is 'going
     in the wrong direction'") then "Only M% … say the country is 'going in
     the right direction'." The prose also carries gender and party-supporter
     splits of the same phrase — those never match the anchors below, which
     demand the figure lead straight into "say (Australia|the country) is"
     (wrong) or an "Only M% say" lead (right). Change parentheticals are
     stripped by normaliseLead first, as with the primaries. */
  let dirRight = null, dirWrong = null, dirPairMissing = false;
  if (/in the wrong direction'/i.test(t)) {
    const norm = normaliseLead(t);
    const wm = norm.match(/([\d.]+)\s*%[\s,]*(?:of electors[\s,]*)?say (?:Australia|the country) is '(?:going|heading) in the wrong direction'/i);
    const rm = norm.match(/\bOnly\s+([\d.]+)\s*%\s*say (?:Australia|the country) is '(?:going|heading) in the right direction'/i);
    if (wm && rm) { dirWrong = parseFloat(wm[1]); dirRight = parseFloat(rm[1]); }
    else dirPairMissing = true;
  }

  // CMS post datetime (UTC) → Australia/Melbourne local, "YYYY-MM-DDTHH:MM"
  let published = null;
  const pd = post.date;
  if (pd) {
    const d = new Date(/Z$|[+-]\d{2}:?\d{2}$/.test(pd) ? pd : pd + "Z");
    if (isNaN(d)) missing.push(`published date "${pd}"`);
    else {
      const p = Object.fromEntries(new Intl.DateTimeFormat("en", {
        timeZone: "Australia/Melbourne", year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", hourCycle: "h23",
      }).formatToParts(d).map((x) => [x.type, x.value]));
      published = `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
    }
  }

  return {
    date, dateStart, published, alp, lnp, grn, onp, ind, undecided, lib, nat,
    tpp_alp, tpp_lnp, tpp_flows, tpp_flows_lnp, flowsPairMissing, flowsMonthly,
    tpp_onp, tpp_onp_onp, onpPairMissing, dirRight, dirWrong, dirPairMissing,
    sample: sampleM ? +sampleM[1].replace(/,/g, "") : null,
    missing,
  };
}

// ------------------------------------------------------------------ guards
function guardRelease(r, slug, releaseDate) {
  const errs = [];
  if (r.missing.length) errs.push(`unparsed: ${r.missing.join(", ")}`);
  const check = (name, ok) => { if (!ok) errs.push(name); };
  if (r.date) {
    check("period end is a Sunday", sundayOf(r.date));
    if (r.dateStart) {
      const span = (new Date(r.date) - new Date(r.dateStart)) / DAY;
      check(`field span 1–15d (got ${span})`, span >= 1 && span <= 15);
    }
    if (releaseDate) {
      const lag = (new Date(releaseDate) - new Date(r.date)) / DAY;
      check(`release-date lag 0–10d (got ${lag})`, lag >= 0 && lag <= 10);
    }
  }
  for (const [k, v] of Object.entries({ alp: r.alp, lnp: r.lnp, grn: r.grn, onp: r.onp, ind: r.ind, lib: r.lib, nat: r.nat }))
    if (v != null) check(`${k}=${v} in 0.5–60`, v >= 0.5 && v <= 60);
  if ([r.alp, r.lnp, r.grn, r.onp, r.ind].every((v) => v != null)) {
    const sum = r.alp + r.lnp + r.grn + r.onp + r.ind;
    check(`primaries Σ=${sum.toFixed(1)} ~100`, Math.abs(sum - 100) <= 1.0);
  }
  if (r.lib != null && r.nat != null && r.lnp != null)
    check(`lib+nat=${(r.lib + r.nat).toFixed(1)} ≈ lnp=${r.lnp}`, Math.abs(r.lib + r.nat - r.lnp) <= 0.75);
  if (r.tpp_alp != null && r.tpp_lnp != null)
    check(`2pp Σ=${r.tpp_alp + r.tpp_lnp} ~100`, Math.abs(r.tpp_alp + r.tpp_lnp - 100) <= 1.0);
  if (r.tpp_flows != null && r.tpp_flows_lnp != null) {
    check(`flows 2pp Σ=${r.tpp_flows + r.tpp_flows_lnp} ~100`, Math.abs(r.tpp_flows + r.tpp_flows_lnp - 100) <= 1.0);
    check(`flows alp=${r.tpp_flows} in 40–65`, r.tpp_flows >= 40 && r.tpp_flows <= 65);
    const onHalfGrid = (v) => Math.abs(v * 2 - Math.round(v * 2)) < 1e-9;
    check(`flows pair ${r.tpp_flows}/${r.tpp_flows_lnp} on the half-point grid (55.2/44.8 is the election result, not a poll)`,
      onHalfGrid(r.tpp_flows) && onHalfGrid(r.tpp_flows_lnp));
  }
  if (r.tpp_onp != null && r.tpp_onp_onp != null) {
    check(`onp 2pp Σ=${r.tpp_onp + r.tpp_onp_onp} ~100`, Math.abs(r.tpp_onp + r.tpp_onp_onp - 100) <= 1.0);
    check(`onp alp=${r.tpp_onp} in 40–65`, r.tpp_onp >= 40 && r.tpp_onp <= 65);
  }
  if (r.dirRight != null && r.dirWrong != null) {
    // Live range to date: right 19.5–43, wrong 41.5–64 (2025-06 onward)
    check(`dir right=${r.dirRight} in 10–60`, r.dirRight >= 10 && r.dirRight <= 60);
    check(`dir wrong=${r.dirWrong} in 25–95`, r.dirWrong >= 25 && r.dirWrong <= 95);
    check(`dir Σ=${r.dirRight + r.dirWrong} in 40–100`, r.dirRight + r.dirWrong >= 40 && r.dirRight + r.dirWrong <= 100);
  }
  if (r.undecided != null) check(`undecided=${r.undecided} in 0–25`, r.undecided > 0 && r.undecided <= 25);
  if (r.sample != null) check(`sample=${r.sample} in 500–10000`, r.sample >= 500 && r.sample <= 10000);
  return errs.map((e) => `${slug}: ${e}`);
}

// -------------------------------------------------------------------- main
// RM_LIB=1: import the parser/guard/feed helpers (the layout healer's
// evidence fetch and acceptance step) without running the extraction.
// Same pattern as extract-news24.mjs's N24_LIB.
export { guardRelease, parseRelease, fetchFeedPage, nextData, dmyToIso, FEED_DEFAULT };
if (!process.env.RM_LIB) {
const status = { changed: false, check: CHECK, added: [], skipped_existing: [], warnings: [], feed: FEED_URL,
  notes: [], ambiguous: [], held: [], reissue_healed: [], escalated: [] };
try {
  const orig = readFileSync(OUT, "utf8");
  const D = JSON.parse(orig);
  const rmDates = new Set(D.polls.filter((p) => p.pollster === "Roy Morgan").map((p) => p.date));
  const altBy = new Set((D.altTpp || []).map((a) => a.date + "|" + a.firm));
  const dirBy = new Set((D.direction || []).map((x) => x.date + "|" + x.pollster));

  // ---- adjudication: verdict file + the machine ledger ---------------------
  // Verdicts are routing only (validated upstream by adjudicate.mjs and the
  // shared case contract in adjudicate-cases.mjs); an unreadable verdict file
  // means "run deterministic", never a failure. The ledger carries terminal
  // verdicts and the anti-spam "asked" mark across runs.
  const decisions = {};
  if (DECISIONS_FILE) {
    try {
      for (const d of JSON.parse(readFileSync(DECISIONS_FILE, "utf8")).decisions || []) decisions[d.case] = d;
      status.notes.push(`adjudication: applying ${Object.keys(decisions).length} verdict(s) from ${DECISIONS_FILE}`);
    } catch (e) {
      status.notes.push(`decisions file unreadable (${e.message}); running deterministic`);
    }
  }
  const adjudicated = existsSync(ADJ_PATH) ? JSON.parse(readFileSync(ADJ_PATH, "utf8")) : {};
  const adjNow = { ...adjudicated };
  const figSnap = (r) => ({ alp: r.alp, lnp: r.lnp, grn: r.grn, onp: r.onp, ind: r.ind, undecided: r.undecided ?? null,
    tpp_alp: r.tpp_alp, tpp_lnp: r.tpp_lnp ?? null, tpp_flows: r.tpp_flows ?? null, tpp_onp: r.tpp_onp ?? null });
  const snapRow = (p) => ({ date: p.date, dateStart: p.dateStart ?? null, sample: p.sample ?? null,
    alp: p.alp, lnp: p.lnp, grn: p.grn, onp: p.onp, ind: p.ind, tpp_alp: p.tpp_alp ?? null, tpp_flows: p.tpp_flows ?? null });
  const nearbyRmRows = (date) =>
    D.polls.filter((p) => p.pollster === "Roy Morgan")
      .map((p) => ({ d: Math.abs(Date.parse(p.date) - Date.parse(date)) / DAY, p }))
      .filter((x) => x.d <= 21)
      .sort((a, b) => a.d - b.d)
      .slice(0, 3)
      .map((x) => x.p).map(snapRow);

  const feedPosts = [];
  let pagesFetched = 0;
  {
    const newestWave = [...rmDates].sort().pop() ?? null;
    const stopBefore = newestWave
      ? new Date(Date.parse(newestWave + "T00:00:00Z") - STRAGGLER_MARGIN_DAYS * DAY).toISOString().slice(0, 10)
      : null;
    for (let page = 1; page <= MAX_FEED_PAGES; page++) {
      let arr, totalPages = null;
      if (FEED_DIR) {
        const f = `${FEED_DIR}/feed-page-${page}.json`;
        if (!existsSync(f)) break; // fixtures stop where the files stop
        arr = JSON.parse(readFileSync(f, "utf8"));
        if (!Array.isArray(arr)) throw new Error(`feed fixture ${f} is not an array`);
      } else {
        ({ arr, totalPages } = await fetchFeedPage(FEED_URL, page));
      }
      pagesFetched = page;
      feedPosts.push(...arr);
      if (!arr.length) break;
      if (totalPages != null && page >= totalPages) break;
      const rel = arr.map((p) => dmyToIso(p.release_date)).filter(Boolean).sort();
      // Newest-first feed: once the OLDEST release on a page is older than
      // the straggler margin, nothing further back can be a new wave.
      if (stopBefore && rel.length && rel[0] < stopBefore) break;
    }
  }
  status.feed_pages = pagesFetched;
  // The server-side topic filter narrows to the poll feed, but keep the
  // slug test (specials like the post-budget SMS poll share the topic) and,
  // when the payload carries topic sets, verify them as a site-drift canary.
  const candidates = feedPosts.filter((p) =>
    (!Array.isArray(p.topics) || p.topics.some((t) => t.name === "Federal Poll")) &&
    /federal-voting-intention/.test(p.slug || ""));
  // Adjudicated slugs drop out of candidacy forever: never_file is the
  // machine equivalent of "not a wave we track"; dup_of is a re-skin of a
  // wave another slug already filed.
  const kept = candidates.filter((c) => {
    const led = adjNow[c.slug];
    if (led && (led.action === "never_file" || led.action === "dup_of")) {
      status.notes.push(`adjudicated ${led.action}${led.of ? ` of ${led.of}` : ""}: ${c.slug}`);
      return false;
    }
    return true;
  });
  candidates.length = 0;
  candidates.push(...kept);
  status.candidates = candidates.map((c) => c.slug);
  if (!candidates.length) {
    const msg = `findings-search returned no federal-voting-intention candidates across ${pagesFetched} page(s) — topic slug or endpoint changed (silence here is never a quiet fortnight)`;
    console.error("RM_GUARD " + msg);
    status.guard = [msg];
    console.log("RM_STATUS " + JSON.stringify(status));
    process.exit(2);
  }

  const newRows = [];
  const guardFails = [];
  const sources = [];
  const altAdds = [];
  const dirAdds = [];
  const parsed = []; // one record per candidate: {c, post, r, existed}
  // release pages pulled two at a time so one slow/404 page can't hold the
  // queue; everything from the parse down still walks in feed order, so
  // warnings, guard-fails and filing order are exactly the serial run's
  const pages = await pool(candidates, 2, async (c) => {
    try {
      if (FEED_DIR) {
        const f = `${FEED_DIR}/post-${c.slug}.json`;
        if (!existsSync(f)) throw new Error(`no fixture ${f}`);
        return { post: JSON.parse(readFileSync(f, "utf8"))?.props?.pageProps?.findingData?.postBy };
      }
      return { post: nextData((await fetchText(`https://www.roymorgan.com/findings/${c.slug}`, { ua: TRACKER_UA })).text, c.slug)
        ?.props?.pageProps?.findingData?.postBy };
    } catch (err) { return { error: err }; }
  });
  for (let ci = 0; ci < candidates.length; ci++) {
    const c = candidates[ci];
    if (pages[ci].error) {
      // Deleted posts still appear as feed slugs but 404 individually — a
      // warning, never a reason to abandon the run's other candidates.
      const err = pages[ci].error;
      status.warnings.push(`${c.slug}: release page fetch failed (${err?.message || err})`);
      console.warn(`RM_WARN ${c.slug}: release page fetch failed (${err?.message || err})`);
      continue;
    }
    const post = pages[ci].post;
    if (!post?.content) { guardFails.push(`${c.slug}: no findingData.postBy.content`); continue; }
    const r = parseRelease(post);
    if (r.flowsPairMissing) status.warnings.push(`${c.slug}: "allocated based on how Australians voted" anchor present but no flows pair parsed`);
    if (r.flowsMonthly) status.warnings.push(`${c.slug}: flows pair is for the month, not this wave — tpp_flows left absent`);
    if (r.onpPairMissing) status.warnings.push(`${c.slug}: "between the ALP and One Nation" anchor present but no ALP-v-ON pair parsed`);
    if (r.dirPairMissing) status.warnings.push(`${c.slug}: "in the wrong direction" anchor present but no direction pair parsed`);
    const rd = post.findings?.releaseDate?.split("/").reverse().join("-"); // "24/08/2026" → 2026-08-24
    const rdOk = rd && /^\d{4}-\d{2}-\d{2}$/.test(rd) ? rd : null;
    const existed = !!(r.date && rmDates.has(r.date));
    const errs = guardRelease(r, c.slug, rdOk);
    // For a wave already recorded in polls[], only its altTpp and direction
    // contributions are still live — guard just those; poll-field guards
    // belong to the row's original run (historic rows predate some checks).
    guardFails.push(...(existed ? errs.filter((e) => /\bonp (?:2pp Σ|alp=)|\bdir /.test(e)) : errs));
    if (r.tpp_onp != null && r.date) {
      const k = r.date + "|Roy Morgan";
      if (!altBy.has(k) && !altAdds.some((a) => a.date + "|" + a.firm === k)) {
        altAdds.push({ date: r.date, firm: "Roy Morgan", alpVsOnp_alp: r.tpp_onp, lnpVsOnp_lnp: null });
        if (existed) status.alt_healed = [...(status.alt_healed || []), r.date];
      }
    }
    if (r.dirRight != null && r.date) {
      const k = r.date + "|Roy Morgan";
      if (!dirBy.has(k) && !dirAdds.some((a) => a.date + "|" + a.pollster === k)) {
        const unsure = Math.round((100 - r.dirRight - r.dirWrong) * 2) / 2;
        dirAdds.push({ date: r.date, dateStart: r.dateStart, pollster: "Roy Morgan", right: r.dirRight, wrong: r.dirWrong, unsure });
        if (existed) status.dir_healed = [...(status.dir_healed || []), r.date];
      }
    }
    if (existed) status.skipped_existing.push(r.date);
    parsed.push({ c, post, r, existed });
  }
  // Filing happens after the guard-fail exit below (a guarded run writes
  // nothing), so the routing steps first see the full parsed picture —
  // that's what the double clustering needs.
  for (const w of status.warnings) console.warn("RM_WARN " + w);
  if (guardFails.length) {
    console.error("RM_GUARD " + guardFails.join(" | "));
    status.guard = guardFails;
    console.log("RM_STATUS " + JSON.stringify(status));
    process.exit(2);
  }

  // ---- adjudication routing (case shapes: adjudicate-cases.mjs) ------------
  // REISSUES first: an existing row whose freshly parsed figures moved more
  // than RM_REISSUE_PT. heal_absent backfills ABSENT allowlisted fields from
  // the parse — a field the row carries is never touched; escalate changes
  // nothing (a genuine correction is repair-agent or human work).
  for (const rec of parsed) {
    if (!rec.existed) continue;
    const row = D.polls.find((p) => p.pollster === "Roy Morgan" && p.date === rec.r.date);
    if (!row || rec.r.date == null) continue;
    const moved = ["alp", "lnp", "grn", "onp", "ind", "tpp_alp"]
      .filter((f) => rec.r[f] != null && row[f] != null && Math.abs(rec.r[f] - row[f]) > RM_REISSUE_PT);
    if (!moved.length) continue;
    const CASE_ID = `reissue:${rec.r.date}`;
    const verdict = decisions[CASE_ID];
    if (verdict?.action === "heal_absent") {
      const fills = HEAL_FIELDS.filter((f) => row[f] == null && rec.r[f] != null);
      for (const f of fills) row[f] = rec.r[f];
      if (fills.length) status.reissue_healed.push({ date: rec.r.date, fields: fills, slug: rec.c.slug });
      status.notes.push(`adjudicated heal_absent: ${rec.r.date} (${fills.length ? fills.join(", ") : "nothing absent"})`);
      adjNow[CASE_ID] = { action: "heal_absent", decided: todayIso(), reason: verdict.reason || "" };
    } else if (verdict?.action === "escalate") {
      status.escalated.push(rec.r.date);
      status.notes.push(`adjudicated escalate: ${rec.r.date} (${(verdict.reason || "").slice(0, 120)}) — no data change; a correction is repair-agent or human work`);
      adjNow[CASE_ID] = { action: "escalate", decided: todayIso(), reason: verdict.reason || "" };
    } else if (ADJUDICATE && !adjNow[CASE_ID]) {
      adjNow[CASE_ID] = { action: "asked", decided: todayIso() };
      status.ambiguous.push({
        case: CASE_ID, slug: rec.c.slug, date: rec.r.date, moved,
        parsed: figSnap(rec.r), row: snapRow(row),
      });
      status.notes.push(`reissue case: ${rec.r.date} — parsed ${moved.join(", ")} moved >${RM_REISSUE_PT}pt vs the row`);
    }
  }

  // DOUBLES: two or more unfiled candidates within RM_DOUBLE_DAYS of each
  // other or with overlapping field windows (a fortnight special beside the
  // weekly wave; one wave republished under a second slug). --adjudicate
  // HOLDS the cluster and emits ONE case; the verdict routes it; a run with
  // no verdict — including every ask-once-after state — files everything, as
  // a plain run always has.
  const dayDiff = (a, b) => Math.abs((Date.parse(a.r.date) - Date.parse(b.r.date)) / DAY);
  const windowOverlap = (a, b) => a.r.dateStart && b.r.dateStart && a.r.dateStart <= b.r.date && b.r.dateStart <= a.r.date;
  const fresh = parsed.filter((rec) => !rec.existed && rec.r.date && rec.r.dateStart);
  const clusters = [];
  for (const rec of [...fresh].sort((a, b) => (a.r.dateStart < b.r.dateStart ? -1 : 1))) {
    const cl = clusters.find((cs) => cs.some((m) => dayDiff(m, rec) <= RM_DOUBLE_DAYS || windowOverlap(m, rec)));
    if (cl) cl.push(rec); else clusters.push([rec]);
  }
  const dropSlugs = new Set(); // candidates that must NOT file this run
  for (const cluster of clusters.filter((cs) => cs.length > 1)) {
    cluster.sort((a, b) => (a.r.date < b.r.date ? -1 : 1));
    const CASE_ID = `double:${cluster[0].r.date}:${cluster[cluster.length - 1].r.date}`;
    const verdict = decisions[CASE_ID];
    if (verdict?.action === "file_both") {
      status.notes.push(`adjudicated file_both: ${CASE_ID} (${cluster.map((x) => x.c.slug).join(" + ")})`);
    } else if (verdict?.action === "file_only" && cluster.some((x) => x.c.slug === verdict.slug)) {
      status.notes.push(`adjudicated file_only ${verdict.slug}: ${CASE_ID}`);
      for (const rec of cluster) {
        if (rec.c.slug === verdict.slug) continue;
        adjNow[rec.c.slug] = { action: "dup_of", of: verdict.slug, decided: todayIso(), reason: verdict.reason || "" };
        dropSlugs.add(rec.c.slug);
      }
    } else if (verdict?.action === "never_file" && cluster.some((x) => x.c.slug === verdict.slug)) {
      status.notes.push(`adjudicated never_file ${verdict.slug}: ${CASE_ID}`);
      adjNow[verdict.slug] = { action: "never_file", decided: todayIso(), reason: verdict.reason || "" };
      dropSlugs.add(verdict.slug); // the rest of the cluster is a wave again — files below
    } else if (ADJUDICATE && !adjNow[CASE_ID] && !verdict) {
      adjNow[CASE_ID] = { action: "asked", decided: todayIso() };
      status.ambiguous.push({
        case: CASE_ID,
        waves: cluster.map((rec) => ({ slug: rec.c.slug, date: rec.r.date, dateStart: rec.r.dateStart,
          published: rec.r.published, sample: rec.r.sample, figures: figSnap(rec.r) })),
        nearbyRows: nearbyRmRows(cluster[0].r.date),
      });
      status.held.push(...cluster.map((rec) => rec.c.slug));
      for (const rec of cluster) dropSlugs.add(rec.c.slug);
      status.notes.push(`double case: ${CASE_ID} — ${cluster.length} candidates held for adjudication`);
    }
    // every other state files everything: an answered verdict routes via the
    // branches above, and once the ask is spent the plain rule (file it) owns.
  }

  const filed = fresh.filter((rec) => !dropSlugs.has(rec.c.slug));
  for (const rec of filed) {
    const { c, r, post } = rec;
    newRows.push({
      date: r.date,
      published: r.published,
      dateStart: r.dateStart,
      pollster: "Roy Morgan",
      client: "—",
      sample: r.sample,
      ...(r.undecided != null ? { undecided: r.undecided } : {}),
      alp: r.alp, lnp: r.lnp, grn: r.grn, onp: r.onp, ind: r.ind, oth: null,
      tpp_alp: r.tpp_alp, tpp_lnp: r.tpp_lnp,
      ...(r.tpp_flows != null ? { tpp_flows: r.tpp_flows } : {}),
      lnpSplit: { Lib: r.lib, Nat: r.nat },
      url: `https://www.roymorgan.com/findings/${c.slug}`,
    });
    sources.push({ slug: c.slug, json: JSON.stringify(post, null, 2) + "\n" });
    status.added.push({ date: r.date, slug: c.slug, alp: r.alp, lnp: r.lnp, onp: r.onp, tpp: `${r.tpp_alp}/${r.tpp_lnp}`, flows: r.tpp_flows, onp2pp: r.tpp_onp != null ? `${r.tpp_onp}/${r.tpp_onp_onp}` : null });
  }

  if (newRows.length) {
    D.polls = [...D.polls, ...newRows].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }
  if (altAdds.length) {
    D.altTpp = [...(D.altTpp || []), ...altAdds].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    console.log(`altTpp: +${altAdds.length} Roy Morgan ALP-v-One-Nation pair(s): ${altAdds.map((a) => a.date).join(", ")}`);
  }
  if (dirAdds.length) {
    D.direction = [...(D.direction || []), ...dirAdds].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    console.log(`direction: +${dirAdds.length} Roy Morgan national-direction row(s): ${dirAdds.map((a) => a.date).join(", ")}`);
  }
  const trailingNl = orig.endsWith("\n") ? "\n" : "";
  const next = JSON.stringify(D, null, 2) + trailingNl;
  status.changed = next !== orig;
  if (status.changed && !CHECK) {
    writeAtomic(OUT, next);
    if (sources.length) {
      mkdirSync(SRC_DIR, { recursive: true });
      for (const s of sources) writeFileSync(`${SRC_DIR}/release-${s.slug}.json`, s.json);
    }
    if (newRows.length) console.log(`wrote ${OUT}: +${newRows.length} Roy Morgan wave(s): ${status.added.map((a) => a.date).join(", ")}`);
  }
  // adjudication ledger: terminal verdicts + the anti-spam "asked" mark.
  // Written on any run that moves it (a verdict-only run moves the ledger
  // with polls.json clean — the wrapper commits it like the release sources).
  if (!CHECK && (JSON.stringify(adjNow) !== JSON.stringify(adjudicated) || (Object.keys(adjNow).length && !existsSync(ADJ_PATH)))) {
    mkdirSync(SRC_DIR, { recursive: true });
    writeAtomic(ADJ_PATH, JSON.stringify(adjNow, null, 2) + "\n");
  }
  console.log("RM_STATUS " + JSON.stringify(status));
} catch (err) {
  console.error("RM_ERROR " + (err?.message || err));
  status.error = String(err?.message || err);
  console.log("RM_STATUS " + JSON.stringify(status));
  process.exit(1);
}
} // RM_LIB
