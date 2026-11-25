/* gen-data.mjs – extract REAL data from auspol-polling.html and emit the
   dataset asset for index.html (window.AUSPOL).
   Methodology matches the established aggregate (see transform.mjs):
   2PP headline = sample- & recency-weighted, house-effect-adjusted nowcast;
   every monthly estimate (2PP, primaries, synthetic, alt head-to-heads;
   direction on /vic/) = sample-weighted, house-effect-adjusted monthly mean from ONE
   construction (federal national direction is the Bayesian model of §5m), with a house's repeat waves in a window or month deflated
   to the square root of their number; leadership = monthly means of
   published readings, with the opposition slot spliced Ley → Taylor
   (handover 13 Feb 2026).
   Run: node .build/newtracker/gen-data.mjs */
import fs from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { writeAtomic } from "../atomic-write.mjs";
import { impliedAlp2pp as impliedAlp2ppFed, makeImpliedAlp2pp, FLOW as FLOW_FED, FLOW_3CNR, FLOW_TABLE as FLOW_TABLE_FED, FLOW_LEF, FLOW_ERAS, impliedLefAlp2pp, FP_ON, FP_ON_BAND, FLOW_HISTORY, FLOW_HISTORY_SENATE, FLOW_HISTORY_SENATE_ON, FLOW_HISTORY_SENATE_CON, FLOW_HISTORY_NSW_LC, FLOW_HISTORY_NSW_LC_ON, FLOW_HISTORY_NSW_LC_CON } from "./flows.mjs";
import { bonhamReplica } from "./bonham-replica.mjs";
import { kalmanRun, kalmanFit } from "./kalman.mjs";
import { fitDirection, FORMAT as DIR_FORMAT, leanHouse as dirLeanHouse, mean as dmean, quant as dquant } from "./direction-model.mjs";
import { fitTrust, mean as tmean, quant as tquant, toTerms as trustTerms } from "./trust-model.mjs";
import { ratingSeries as ldRatingSeries, ppmSeries as ldPpmSeries, fitSettings as ldFit, lineMoments as ldMoments, drawReads as ldDrawReads, houseCoef as ldHouseCoef } from "./leader-model.mjs";
import { tppRead, tppNowOut, tppChgOut } from "./primary-model.mjs";
import { fitSwitch, colOf as swCol, pOf as swP, mean as swMean, quant as swQuant } from "./switch-model.mjs";
import { buildSeries as imBuildSeries, fitFamily as imFit, drawSeries as imDrawSeries, lineMoments as imMoments, salObs as imSalObs, ownObs as imOwnObs, expit as imExpit, quant as imQuant, WIDE_SAL as IM_WIDE_SAL, WIDE_OWN as IM_WIDE_OWN } from "./issue-model.mjs";
import { buildReadings as buildIssueReadings, ELECTION_DAYS as IM_ELECTION_DAYS } from "./issue-readings.mjs";
import { fitSpan, gapReading, countReading, nestCats, nestCoords, nestShares, drawMix, makeRng as gsRng } from "./group-span.mjs";
import { fitPrimary, fitSet as fitGroupSet, anchorFrom, categoriesOf as pmCategories, stepOf as pmStep, softmaxAlr as pmSoftmax, alrOf as pmAlr, unpack as pmUnpack, fitUndecided, PRIM_MISS, mean as pmMean, quant as pmQuant, PARTIES as PM_PARTIES } from "./primary-model.mjs";
import { stateOf, flowsOf, initChangelog, diffChangelog } from "../changelog.mjs";
import { readStores as readOneOffStores, buildPublicOpinion, HOUSES as PUBOP_HOUSES } from "./public-opinion.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
/* Test seams for .build/newtracker/np-backtest.mjs, which replays the
   dataset as it stood at past dates: GEN_DATA_POLLS reads another polls.json
   and GEN_DATA_OUT writes the two assets into another directory, so a replay
   never touches the shared working tree's files. Unset in every real build. */
const D = JSON.parse(fs.readFileSync(process.env.GEN_DATA_POLLS || path.join(ROOT, "data", "polls.json"), "utf8"));

/* ---- jurisdiction -------------------------------------------------------
   The same pipeline builds /vic/ (2026-10-05): .build/vic/to-main-schema.mjs
   maps the Victorian polls onto this file's dataset shape and adds
   `jurisdiction` - the baseline election, the next one, the leader slots'
   eras, the preference flows and the words the views use. Absent here, which
   is the federal page: every value below then falls back to the federal one,
   so the federal dataset this file writes is byte-identical with or without
   this block. JUR is null federally; read it through the helpers. */
const JUR = D.jurisdiction || null;
const FLOW = JUR ? JUR.flows : FLOW_FED;
const impliedAlp2pp = JUR ? makeImpliedAlp2pp(JUR.flows, JUR.flows.threeCorner || 0) : impliedAlp2ppFed;
const FLOW_TABLE = JUR ? (JUR.flowsLabel || "the jurisdiction's flow table") : FLOW_TABLE_FED;

/* ---- one house, one name ----------------------------------------------
   A pollster that changes its letterhead is still the same pollster. Left
   apart, RedBridge was two houses that each looked like a fraction of one:
   eleven waves under the name it used until April 2026 that appeared to have
   stopped, and three under the name it has used since that were too few to
   measure anything. Neither could describe a shop that has published every
   few weeks for a year — it had no house effect worth the name, no schedule,
   and no place in a table of the latest polls.

   Applied to the source arrays before anything reads them, so there is one
   rename in one place rather than a canonical-name helper at every join. It
   deliberately does NOT touch data/polls.json: each poll stays transcribed
   under the name it was actually published as, and this is the one declared,
   revertible decision to treat two of those names as one shop.

   The map itself lives in ./house-renames.mjs, shared with validate.mjs
   (which duplicates-checks rows under their canonical names) and
   deff-backtest.mjs, so the estimator and the gate can never disagree
   about what a house is called. */
import { HOUSE_RENAMES } from "./house-renames.mjs";
import { fieldTbcUrl } from "./field-tbc.mjs";
import { DEMO_TABS, DEMO_SETS, DEMO_SHARE, harmonize as harmonizeRaw, ageStandardise, INCOME_GRIDS, INCOME_STD_BANDS, INCOME_POOL_BASES, incomeQuantiles, incomeEdge, incomeFit } from "./demo-groups.mjs";
for (const [key, field] of [["polls", "pollster"], ["ppm", "firm"], ["approval", "firm"],
                            ["altTpp", "firm"], ["ppmHeadToHead", "firm"], ["direction", "pollster"]]) {
  if (!Array.isArray(D[key])) continue;
  D[key] = D[key].map((r) => (HOUSE_RENAMES[r[field]] ? { ...r, [field]: HOUSE_RENAMES[r[field]] } : r));
}
/* pollsterRules is keyed by the name too, so a renamed house would leave its
   rules stranded under a name no poll carries any more. Folded rather than
   overwritten: anything already stated against the current name wins. */
for (const [from, to] of Object.entries(HOUSE_RENAMES)) {
  const r = D.pollsterRules && D.pollsterRules[from];
  if (!r) continue;
  D.pollsterRules[to] = { ...r, ...(D.pollsterRules[to] || {}) };
  delete D.pollsterRules[from];
}
const OUT_DIR = process.env.GEN_DATA_OUT || path.join(HERE, "assets");
const DATA_ASSET = path.join(OUT_DIR, "9f09dca2-bd46-49a8-8ae1-51847608cf92.js");
const CYCLE_SOURCE_ASSET = path.join(OUT_DIR, "cycle-source.json");
const ONEOFFS_ASSET = path.join(OUT_DIR, "oneoffs-source.json");
const GROUP_HIST_ASSET = path.join(OUT_DIR, "group-history.json");
const ISSUES_HIST_ASSET = path.join(OUT_DIR, "issues-history.json");

/* ---- canonical dataset ------------------------------------------------
   data/polls.json is the single source of truth. It used to be scraped out of
   auspol-polling.html with a bracket-counting scanner and eval(); that file is
   now a frozen historical artefact and nothing reads it. */
const ELECTIONS = D.elections;
const EVENTS = D.events;
/* ---- provisional rows ---------------------------------------------------
   D.fallbackPolls holds waves the Poll Bludger fallback
   (.build/extract-pollbludger.mjs) filed because the house's own extractor
   had not: second-hand figures, no release clock, no ind/oth split. They
   join the page ONLY where no canonical row of the same house sits within
   FALLBACK_SLACK days of their fieldwork end - the moment the house's
   extractor lands the real row, the fallback is shadowed here and pruned by
   the fallback agent's next run. Kept out of D.polls because every extractor
   dedupes against that array and never overwrites; merged HERE because this
   is the one door every view, aggregate and projection reads through. Each
   merged row carries `provisional` so the views can say so. */
const FALLBACK_SLACK = 3;
const FALLBACK_HOUSE_SLACK = { Essential: 7 }; // the feed keys Essential by report date
const FALLBACK_HOUSES = { "RedBridge/Accent": ["RedBridge/Accent", "Redbridge"], "Roy Morgan": ["Roy Morgan", "Roy Morgan (SMS)"] };
const mergedPolls = (() => {
  const fb = Array.isArray(D.fallbackPolls) ? D.fallbackPolls : [];
  if (!fb.length) return D.polls;
  const dayGap = (a, b) => Math.abs(Math.round((Date.parse(a) - Date.parse(b)) / 86400000));
  const live = fb.filter((f) => {
    const names = FALLBACK_HOUSES[f.pollster] || [f.pollster];
    const slack = FALLBACK_HOUSE_SLACK[f.pollster] ?? FALLBACK_SLACK;
    return !D.polls.some((p) => names.includes(p.pollster) && dayGap(p.date, f.date) <= slack);
  });
  if (!live.length) return D.polls;
  console.log(`fallbackPolls: ${live.length} provisional row(s) merged (${fb.length - live.length} shadowed by canonical rows) →`,
    live.map((f) => `${f.pollster} ${f.date}`).join(", "));
  // stable date order, as validate.mjs demands of D.polls itself
  return [...D.polls, ...live].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
})();
/* A house that keeps its undecided IN the base (Essential: party shares of
   all respondents, plus a printed Undecided, together 100 - `undecidedIn`)
   is pooled on the same footing as everyone else: its parties are rescaled
   to 100 here, at the one door, so every aggregate, implied 2PP, lean and
   yardstick reads shares of those who named a party. What it PRINTED rides
   along as pubPrim, and the tables show that (primaryOf, the change
   markers), with the sample's base letter saying what it is of. Until
   2026-11-21 the undecided was folded into Essential's ind instead, so its
   "others" carried 4-7 points of undecided into the pool. */
const PRIM_KEYS = ["alp", "lnp", "grn", "onp", "ind", "oth"];
const poolPrim = (p) => {
  const u = p.undecidedIn;
  if (!(u > 0 && u < 100)) return p;
  const r = { ...p, pubPrim: Object.fromEntries(PRIM_KEYS.map((k) => [k, p[k] ?? null])) };
  PRIM_KEYS.forEach((k) => { if (p[k] != null) r[k] = Math.round(p[k] * 100 / (100 - u) * 100) / 100; });
  return r;
};
const POLLS = mergedPolls.filter((p) => !p.isElection).map(poolPrim);
/* Houses whose waves stay in the archive but are kept out of EVERY aggregate.
   Roy Morgan's SMS wave was an opt-in SMS blast to a non-probability sample -
   a selection-biased mode a house-effect cannot repair, so the wave never
   enters tppRows, the implied series, the primary series, the alt matchup
   aggregates or the leadership monthly lines. The same goes for a wave whose
   published cross-section is built for a one-off display rather than a
   comparable point in the house's weekly cadence: finding 10341 (published
   2026-09-15) pools seven months of Single Source interviewing (Jan-Jul 2026,
   n=26,418) into a single all-electors reading - a timespan average, not a
   fieldwork wave - so it stays out of the aggregates too. Both still render
   as archive rows (individualPolls stays unfiltered), flagged noAgg so the
   detail view can say why its figures sit outside the aggregates; the shown
   reason rides the row via NO_AGG_NOTE. Checks here key the full suffix
   string; the houses inventory (:3322) already folds "(SMS)" back into
   "Roy Morgan" for counting, as does "(pooled)". */
const NO_AGG_HOUSES = new Set(["Roy Morgan (SMS)", "Roy Morgan (pooled)", "Newspoll (pooled)", "EMRS (Tas)"]);
/* a second, row-level carrier: ONE release that must not aggregate while
   its house's regular tracker does. The March 2026 "shifts" super-poll
   (n=5,563) files under plain "RedBridge/Accent" - it is the same
   publisher as the monthly waves, so a "(shifts)" house suffix would
   invent a pollster (the site's house counts, the filter select and the
   release calendar would carry it as one); the row's `noAgg` token is
   the key, and NO_AGG_ROW_NOTE gives it the reason the suffix labels
   carry for theirs. noAggPoll() is then the ONE no-aggregate predicate
   on the poll-row side; firm-level passes (the approval series, the
   cadence house gate) stay on the suffix set alone, since a flagged row
   publishes no figures those series could read. */
const NO_AGG_ROW_NOTE = {
  shifts: "Because this super-poll release (n=5,563) published state and demographic breakdowns only - no national headline figures - it does not count towards any aggregates.",
  combined: "Because this release combines YouGov's federal polls over the last 30 days (n=4,578) into a single reading rather than a single fieldwork wave, it does not count towards any aggregates.",
};
/* An MRP whose fieldwork CONTAINS the house's own regular waves is taken to
   reuse their respondents (ruling 2026-10-11, "assume overlap"): DemosAU's
   reports say only "DemosAU surveyed N respondents" over the dates, and its
   Jan–Mar 2026 model's 8,484 is its two regular waves inside (1,933 +
   1,551) plus exactly 5,000. Those waves already count, so the model joins
   no aggregate and no vote-by-group pool (§7g) – its extra respondents are
   unreported and can't be split out. A wave merely straddling an edge
   (RedBridge's AFR MRP shares two days with its 24–30 Apr wave) isn't
   contained and doesn't trip it; an MRP with no regular wave inside
   (DemosAU Oct–Nov 2025) is its own survey and counts. */
const reusesWaves = (p) => {
  const house = /\(MRP\)$/.test(p.pollster || "") && p.dateStart ? p.pollster.replace(/ \(MRP\)$/, "") : null;
  return !!house && POLLS.some((q) => q.pollster === house && (q.dateStart || q.date) >= p.dateStart && q.date <= p.date);
};
const noAggPoll = (p) => NO_AGG_HOUSES.has(p.pollster) || p.noAgg != null || reusesWaves(p);
/* why each no-aggregate house's figures sit outside the aggregates - the
   archive detail rail's note line (the SMS label keeps its established
   selection-bias wording; the pooled label reads as the timespan average) */
const NO_AGG_NOTE = {
  "Roy Morgan (SMS)": "Because SMS polls have a strong selection bias, they do not count towards any aggregates.",
  "Roy Morgan (pooled)": "Because this release averages seven months of interviewing (January\u2013July 2026) into a single reading, it does not count towards any aggregates.",
  /* its vote figures are the same respondents as Newspoll's own polls in
     the aggregates; its group tables count in §7g, read as those polls
     (pooledParts) */
  "Newspoll (pooled)": "This release combines the Newspoll polls from these dates, which already count in the aggregates, so its vote figures don’t count a second time. Its tables of each group’s vote do count in Who votes for whom, read as those polls.",
  "EMRS (Tas)": "Because this poll surveyed Tasmanian voters only, its state-level figures sit outside the national aggregates.",
};
const noAggNoteFor = (p) => NO_AGG_NOTE[p.pollster] || (p.noAgg != null ? NO_AGG_ROW_NOTE[p.noAgg] : undefined)
  || (reusesWaves(p) ? "Because this model\u2019s fieldwork contains " + p.pollster.replace(/ \(MRP\)$/, "") + "\u2019s own regular polls, which already count, it is taken to reuse their respondents, so it does not count towards any aggregates." : undefined);
const ppm = D.ppm;
/* Leader satisfaction the fallback filed (D.fallbackApproval) joins the
   approval rows on the same terms as fallbackPolls above, but on its own:
   a house's canonical VI row can land without its leadership (the cloud
   YouGov run has no Chrome for the News24 article), and the provisional
   splits then stay until a canonical approval row for that wave arrives.
   PROVISIONAL_APPR remembers which poll rows drew their ratings from here,
   so the row can say so even when its VI is the house's own. */
const PROVISIONAL_APPR = new Set();
const mergedAppr = (() => {
  const fb = Array.isArray(D.fallbackApproval) ? D.fallbackApproval : [];
  if (!fb.length) return D.approval;
  const dayGap = (a, b) => Math.abs(Math.round((Date.parse(a) - Date.parse(b)) / 86400000));
  const live = fb.filter((f) => !D.approval.some((a) => a.firm === f.firm && dayGap(a.date, f.date) <= (FALLBACK_HOUSE_SLACK[f.firm] ?? FALLBACK_SLACK)));
  if (!live.length) return D.approval;
  console.log(`fallbackApproval: ${live.length} provisional leader-rating row(s) merged (${fb.length - live.length} shadowed) →`,
    live.map((f) => `${f.firm} ${f.date}`).join(", "));
  // key the ratings to the poll row they belong to, canonical or provisional,
  // so buildAppr's exact (date|firm) join finds them
  const rows = live.map((f) => {
    const poll = mergedPolls.find((p) => p.pollster === f.firm && dayGap(p.date, f.date) <= (FALLBACK_HOUSE_SLACK[f.firm] ?? FALLBACK_SLACK));
    const date = poll ? poll.date : f.date;
    PROVISIONAL_APPR.add(date + "|" + f.firm);
    return { ...f, date };
  });
  return [...D.approval, ...rows].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
})();
const appr = mergedAppr.map((r) => ({ ...r, splits: r.detail ?? null }));
/* The aggregate pool: every leadership line, house effect and nowcast reads
   this, never raw appr - no-aggregate houses (NO_AGG_HOUSES) are out, while
   appr itself stays whole so APPR_BY can still key the row's detail copy. */
const apprAgg = appr.filter((a) => !NO_AGG_HOUSES.has(a.firm));
const cyclePolls = D.cyclePolls;
const cycleAppr = D.cycleApproval;

/* ---- per-poll join maps ------------------------------------------------ */
// 7th element (optional) = additional preferred-PM contests polled the same
// wave (a two-way alongside a three-way, etc.) – different measures, kept whole
// 8th element (optional) = published splits {app,dis} per leader

/* ---- approval vs favourability – different questions, never blended ----
   Mirrors the source file's LEADER_NET_METRIC (keyed by canonical firm):
   RedBridge, DemosAU and Freshwater publish net FAVOURABILITY (positive −
   negative); everyone else publishes net APPROVAL (approve − disapprove). */
// metric is per-(firm, leader): a firm can ask APPROVAL of some leaders and
// FAVOURABILITY of others in the SAME poll (Resolve rates the majors on
// approval – its "good/poor job" is an approval measure – but Hanson on
// likeability = favourability). Performance ≡ approval; likeability ≡ fav.
// fav for every leader. Spectre added Jul 2026: its release labels the question
// favourable / unfavourable, not approve / disapprove.
const FAV_FIRMS = new Set(D.metricRules.favFirms);
/* Per (firm|leaderKey), and DATE-BOUNDED – what a house asks about a leader can
   change mid-cycle. Resolve rated Hanson on likeability alone until it added
   her to its performance question in the 6–11 Jul 2026 wave ("included for the
   first time in this question", SMH 12 Jul). From that wave her positional net
   is performance, i.e. approval; before it, likeability. An unbounded override
   plotted her July and August performance nets on the favourability line. */
const METRIC_OVERRIDE = D.metricRules.overrides;
const canonFirm = (firm) => (firm || "").replace(/\s*\(.*\)\s*$/, "").replace(/\s*\/.*$/, "").trim().toLowerCase();
const metricOf = (firm, leaderKey, date) => {
  const c = canonFirm(firm);
  if (FAV_FIRMS.has(c)) return "fav";
  const o = leaderKey && METRIC_OVERRIDE[c + "|" + leaderKey];
  // no date supplied → the override still applies, so callers that don't know
  // the date keep the old behaviour rather than silently flipping metric
  if (o && o.metric === "fav" && (!date || date < o.before)) return "fav";
  return "approval";
};
const PPM_BY = new Map(ppm.map((p) => [p.date + "|" + p.firm, p]));
const APPR_BY = new Map(appr.map((p) => [p.date + "|" + p.firm, p]));
const H2_BY = new Map(D.ppmHeadToHead.map((r) => [r.date + "|" + r.firm, { alb: r.alb, han: r.han }]));
const ALT_BY = new Map(D.altTpp.map((r) => [r.date + "|" + r.firm, { ao: r.alpVsOnp_alp, lo: r.lnpVsOnp_lnp }]));

/* ---- calendar helpers -------------------------------------------------- */
const MN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MNF = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const monthName = (m) => MN[m - 1];
const mx = (ym) => { const [y, m] = ym.split("-").map(Number); return y + (m - 1 + 0.5) / 12; };
// exact decimal-year x for a full ISO date (event markers, election anchor)
const dx = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  const doy = (Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86400000;
  // a leap year is 366 days long: with a flat /365 its 31 Dec lands on the
  // next year's 1 Jan (both x = Y + 1), collapsing the two to one pixel
  const yrLen = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0) ? 366 : 365;
  return y + doy / yrLen;
};
const ymOf = (d) => d.slice(0, 7);
const dayOf = (d) => Number(d.slice(8, 10));
const r1 = (v) => Math.round(v * 10) / 10;
const r2 = (v) => Math.round(v * 100) / 100;
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const medianOf = (a) => {
  const v = [...a].sort((x, y) => x - y);
  if (!v.length) return null;
  return v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2;
};
const meanOf = (rows, f) => { const v = rows.map(f).filter((x) => x != null); return v.length ? mean(v) : null; };

const ELECTION = ELECTIONS[JUR ? JUR.baseline : "e2025"];   // 3 May 2025 baseline federally
const LATEST_ISO = POLLS.reduce((m, p) => (p.date > m ? p.date : m), "0000");
/* the instant every current figure is read at: the newest poll's fieldwork end */
const refNow = new Date(LATEST_ISO).getTime();
/* The last poll's PUBLICATION date, which is what the header stamp means by
   "last poll" - a reader wants to know when the newest number became public,
   not when its fieldwork closed, and the two are a day or three apart for
   every house here. Deliberately NOT LATEST_ISO: that one is the aggregate's
   own reference point (the 21-day nowcast window, the recency half-life, the
   month spine, the has-this-house-stopped gate) and all of those are properly
   measured in fieldwork time. This is the display stamp and nothing else.
   Where a poll has no `published` it falls back to its fieldwork end, the
   same fallback the polls table uses. */
const LATEST_PUB_ISO = POLLS.reduce((m, p) => {
  const d = (p.published || "").slice(0, 10) || p.date;
  return d > m ? d : m;
}, "0000");

// month spine: election month → month of the latest poll (rolling)
const MONTHS = [];
{
  let [y, m] = [Number(ELECTION.date.slice(0, 4)), Number(ELECTION.date.slice(5, 7))];
  const [ly, lm] = [Number(LATEST_ISO.slice(0, 4)), Number(LATEST_ISO.slice(5, 7))];
  while (y < ly || (y === ly && m <= lm)) {
    MONTHS.push(`${y}-${String(m).padStart(2, "0")}`);
    m++; if (m > 12) { m = 1; y++; }
  }
}

function fwLabel(startISO, endISO) {
  const d2 = dayOf(endISO), m2 = Number(endISO.slice(5, 7));
  if (!startISO) return `${d2} ${monthName(m2)}`;
  const d1 = dayOf(startISO), m1 = Number(startISO.slice(5, 7));
  return m1 === m2 ? `${d1}–${d2} ${monthName(m2)}` : `${d1} ${monthName(m1)}–${d2} ${monthName(m2)}`;
}

/* the ISO date of a fieldwork window's middle day – "14–20 May" →
   2026-05-17. The detail mini-charts plot the wave's own marker at this,
   not `released` (fieldwork's last day, or the publish stamp – both to the
   right of the window the marker claims). */
const fmidIso = (startISO, endISO) => {
  const mid = (Date.parse(startISO.slice(0, 10) + "T00:00:00Z") + Date.parse(endISO.slice(0, 10) + "T00:00:00Z")) / 2;
  const d = new Date(mid);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
};

function fillSeries(known, idxs) {
  const ks = idxs.filter((i) => known[i] != null);
  if (!ks.length) return idxs.map(() => null);
  return idxs.map((i) => {
    if (known[i] != null) return known[i];
    const lo = ks.filter((k) => k < i).pop();
    const hi = ks.find((k) => k > i);
    if (lo == null) return known[hi];
    if (hi == null) return known[lo];
    const t = (i - lo) / (hi - lo);
    return known[lo] + (known[hi] - known[lo]) * t;
  });
}

/* ---- house effects (shrunk mean deviation from local consensus) -------- */
const HE_WINDOW = 28, SHRINK_K = 1.5, SAMPLE_CAP = 3000, LN2 = Math.log(2);
/* Design effect for a live national sample – the one value both engines
   use. The node estimator consumes it directly (rowN, seFloor); the page's
   discord engine reads it from latest.method.deff in the data asset so
   there is no hand-mirrored copy to drift. */
const HL_DEFF = 1.6;
/* A poll's n on the derived scale. Where the house files a published
   effective sample size (polls.json `sampleEff` – Newspoll, YouGov,
   Essential, DemosAU, RedBridge/Accent and Fox & Hedgehog via APC methodology
   statements), that figure is
   already deflated by the house's own design effect; scale it back up by
   HL_DEFF so published and derived rows sit on the one convention, and the
   seFloor formula's `HL_DEFF * pq / p.n` reduces to pq/eff for a published
   row. Otherwise the standing convention: raw sample capped at 3000. */
const rowN = (p) => (p && p.sampleEff != null)
  ? p.sampleEff * HL_DEFF
  : Math.min((p && p.sample) || 1200, SAMPLE_CAP);
const midMs = (p) => (new Date(p.dateStart || p.date).getTime() + new Date(p.date).getTime()) / 2;
const share2pp = (p) => (p.tpp_lnp != null && p.tpp_alp + p.tpp_lnp > 0) ? (p.tpp_alp / (p.tpp_alp + p.tpp_lnp)) * 100 : p.tpp_alp;
const ddays = (a, b) => (a - b) / 86400000;
const HL_WINDOW = 21, HL_HALF = 7, HL_TAPER = 14;
/* Adults' shares by age band and sex (ABS 2021 Census, those 18 and over):
   a subgroup's base when a house prints its cut but not the count behind
   it is the wave's effective sample times the group's share – the
   weighting the sample is drawn to. Undecided's By age view and the
   direction panel's group bands both size their margins this way. */
const AGE_SHARE = { "18-34": 0.295, "35-54": 0.334, "55+": 0.371 };
const SEX_SHARE = { Men: 0.49, Women: 0.51 };
/* Highway: recency decay alone would step from ~14% weight to nothing at the
   window's edge, so a big poll exiting overnight used to move the estimate
   discontinuously. Taper (half-cosine) runs from HL_TAPER days to zero at
   HL_WINDOW, so the edge fades instead of stepping. Shared by nowcastPts and
   the §8b show-working tables - one formula, one home. */
const taperW = (d) => (d <= HL_TAPER ? 1 : 0.5 * (1 + Math.cos(Math.PI * (d - HL_TAPER) / (HL_WINDOW - HL_TAPER))));
const recencyW = (d) => Math.exp(-LN2 * d / HL_HALF) * taperW(d);
/* The two windows every current figure is read through. HEADLINE_K is the
   2PP's own. SPARSE_K doubles its window, half-life and taper for a measure
   polled about once a week or less – preferred PM, the One Nation split, the
   vote by group – where three weeks often holds one poll and sometimes none
   (the vote by group's 18–34 band, Apr–Sep 2026: no poll in the three weeks
   before 18 days of 176; in the six weeks before, none empty), so the same
   estimator still rests on several polls. Same shape, same taper; only the
   time scale differs. */
const HEADLINE_K = { window: HL_WINDOW, weight: recencyW, label: "three weeks" };
const SPARSE_WINDOW = 2 * HL_WINDOW, SPARSE_HALF = 2 * HL_HALF, SPARSE_TAPER = 2 * HL_TAPER;
const SPARSE_K = {
  window: SPARSE_WINDOW, label: "six weeks",
  weight: (d) => Math.exp(-LN2 * d / SPARSE_HALF)
    * (d <= SPARSE_TAPER ? 1 : 0.5 * (1 + Math.cos(Math.PI * (d - SPARSE_TAPER) / (SPARSE_WINDOW - SPARSE_TAPER)))),
};
const tppRows = POLLS.filter((p) => p.tpp_alp != null && !noAggPoll(p)).map((p) => ({ ym: ymOf(p.date), mid: midMs(p), x: share2pp(p), n: rowN(p), firm: p.pollster, key: p.date + "|" + p.pollster }));
/* Implied 2PP eligibility for the AGGREGATE: a poll's primaries can only be
   read into the standing implied series through the flow table when it
   files a full primary set with no documented anomaly (sumNote) – a set
   that doesn't total ~100 can't be read through a 100-point flow table.
   One aggregate predicate, hoisted, because every consumer of the implied
   series (the rows below, the flow-drift join) must agree on which waves
   have one. The per-poll DISPLAY rule is wider – see impShow below. */
const onpOk = (p) => p.onp != null || !!(JUR && JUR.onpOptional && (p.ind != null || p.oth != null));
const impOk = (p) => p.alp != null && p.lnp != null && p.grn != null && onpOk(p) && !p.sumNote;
/* Per-poll DISPLAY eligibility, wider than impOk (user calls 2026-10-03):
   a wave whose primaries miss 100 ONLY through a documented anomaly
   (sumNote – YouGov's
   undecided-inclusive OTH wave) still shows an implied 2PP in the tables:
   the anomaly is a publish-out artefact, not missing data. An UNDOCUMENTED
   sum failure still suppresses the figure – any other row whose primaries
   miss 100 is a bad row, and rdApFig keeps its "primaries don't add to
   100" tripwire for exactly that case. impShow gates ONLY the per-poll
   alpImp/alpOnImp fields; the aggregate stays impOk-strict, so anomalous
   waves never join the standing implied series. */
const PRIM_SUM_KEYS = ["alp", "lnp", "grn", "onp", "ind", "oth"];
const primSum = (p) => PRIM_SUM_KEYS.reduce((a, k) => a + (p[k] || 0), 0);
const impShow = (p) =>
  p.alp != null && p.lnp != null && p.grn != null && onpOk(p)
  && (!!p.sumNote || Math.abs(primSum(p) - 100) <= 2);
/* The rebase behind impShow: a documented-anomaly set (the only kind that
   fails the ±2 check and still displays) is scaled onto the 100-pt base
   first, so its implied figure sits on the whole-electorate scale –
   consistent with share2pp rescaling undecided-inclusive published pairs
   (Essential 48/47 → 50.5). */
const impShowRow = (p) => {
  const s = primSum(p);
  if (Math.abs(s - 100) <= 2) return p;
  const r = { ...p };
  PRIM_SUM_KEYS.forEach((k) => { if (p[k] != null) r[k] = p[k] * 100 / s; });
  return r;
};
/* One shared per-poll emitter: the archive individualPolls row and the
   Latest pollsterTable row must agree on which waves carry alpImp/alpOnImp,
   so both spread this helper. */
const impFields = (p) => {
  /* impOut: a wave kept out of the standing implied series (impOk fails).
     The More menu's flow editor (pv-agg.js flowAgg) re-runs that series in
     the browser and must leave out exactly the waves the server does - a
     shown figure (impShow) is no test of that */
  const out = impOk(p) ? {} : { impOut: true };
  if (!impShow(p)) return out;
  const q = impShowRow(p);
  // the ALP-v-ON reading needs One Nation as a column of its own: folded into
  // "others" (onpOptional waves), its voters would be read as preferencing
  return { alpImp: r1(impliedAlp2pp(q)), ...(p.onp != null ? { alpOnImp: r1(impliedOn(q)) } : {}), ...out };
};
/* The frozen flow table for the ALP-v-ON PAIRING, in ALP-shares, with the
   set's own ± range: FP_ON / FP_ON_BAND, imported from flows.mjs, where the
   cells' provenance lives (built, not counted - no House count of an
   ALP-v-ON final pairing has ever run nationally; revised 2026-10-11).
       implied ALP v ON = alp + lnp·f_lnp + grn·f_grn + (ind+oth)·f_oth
   impliedOn is hoisted here beside impOk/impShow – the §1d SERIES takes
   impOk's waves, the per-poll chart cloud impShow's (impliedOn reads the
   same primary set) – because §1d and the individualPolls emitter run
   before §7d needs it. */
const impliedOn = (p) =>
  p.alp + (p.lnp * FP_ON.lnp + p.grn * FP_ON.grn + ((p.ind || 0) + (p.oth || 0)) * FP_ON.oth);
/* Implied 2PP rows: each poll's primaries read through the single measured
   flow table in flows.mjs (AEC 2025, Event 31496). This series answers a
   different question than the published 2PP above – "what do these
   primaries mean at the flows the 2025 count actually observed?" – and on
   the page it is the DEFAULT basis: SINCE this term began the houses'
   published 2PPs split across allocation bases (previous-election,
   respondent-allocated, proprietary) whose industry mix doesn't move when
   real preference behaviour does, while reading every poll on ONE fixed
   table at least puts the level the flow table's own counted flows support
   next to every wave, comparably house to house and wave to wave. The
   published series stays complete beside it (tppRows → agg2pp →
   latest.alp2pp), the two bases are quoted side by side, and the toggle
   between them is the reader's. What a fixed table still cannot do is
   TRACK drift in real preference behaviour after 2025 – drift's home is
   §7c, and stale flows read as level error, not movement. The row carries
   its own ONP primary so §1c can re-price that one conversion cell per row
   (§1b's estimator never reads it). */
const tppRowsSynth = POLLS
  .filter((p) => impOk(p) && !noAggPoll(p))
  .map((p) => ({ ym: ymOf(p.date), mid: midMs(p), x: impliedAlp2pp(p), n: rowN(p), firm: p.pollster, onp: p.onp, key: p.date + "|" + p.pollster }));
/* Implied ALP–ON rows: the same waves re-read under the ALP-v-ON frozen
   table (FP_ON, above) instead of the AEC count's. Like the classic implied
   series this answers a single fixed question – "what do these primaries
   mean at THE flow set the page quotes this pairing on?" – and on the page
   it is the pairing's DEFAULT basis, since no count exists to discipline
   the houses' uncoordinated allocations. The row also carries its own
   flow-table range bn: the set's ± uncertainties are LINEAR in the
   primaries (primaries·FP_ON_BAND), so a weighted monthly mean's range is
   just the n-weighted mean of its rows' ranges, which §1d lifts directly –
   no ratio, no simulation. */
const tppRowsSynthOn = POLLS
  .filter((p) => impOk(p) && p.onp != null && !noAggPoll(p))
  .map((p) => ({ ym: ymOf(p.date), mid: midMs(p), x: impliedOn(p),
                 bn: p.lnp * FP_ON_BAND.lnp + p.grn * FP_ON_BAND.grn
                     + ((p.ind || 0) + (p.oth || 0)) * FP_ON_BAND.oth,
                 n: rowN(p), firm: p.pollster, key: p.date + "|" + p.pollster }));

/* A house effect is that pollster's lean AWAY FROM the cross-house consensus
   on that measure – never borrowed between measures, because a firm that
   leans Labor on the classic 2PP has no reason to lean the same way on an
   ALP-v-ON head-to-head or on a primary share. Each poll's deviation is
   measured against the n-weighted consensus of OTHER HOUSES' polls around it
   in time (±HE_WINDOW days, at least 3, same-stratum only). Those deviations are
   pooled with recency decay (HE_HALF-day half-life) and shrunk toward zero by
   SHRINK_K on the decayed count – as if the house's polls were joined by
   SHRINK_K more that sat exactly on the consensus. SHRINK_K was 8 until
   2026-09-28, when predicting each poll from the polls before it (Sep 2025 on,
   ~149 polls a measure) put the best value at 1–1.5 on the implied 2PP, every
   primary and the One Nation–Coalition gap: 1.5 cut the error 5–7% against 8.
   At 8 a house with five recent polls kept under 40% of its measured lean,
   and houses that poll often kept far more than those that don't, which
   reordered them. The lean is READ at the time it is
   applied: he.at(firm, t) is the house's lean as of t. A house whose method
   changes mid-cycle therefore settles on the new lean in a couple of months
   rather than being averaged with its old method forever – the all-time
   pooled constant this replaced was measurably wrong for exactly that
   (Essential −1.96 pooled vs −1.3 recent, Sep 2026) – and a stopped house's
   lean decays back toward zero as its evidence ages. estimable=false when
   nothing was measurable (a measure only two houses ask), so the caller falls
   back to a plain mean rather than a fabricated adjustment. */
const HE_HALF = 90;                              // lean pooling half-life, days
function houseEffectsFor(rows) {
  const devs = [];                               // { firm, mid, dev }
  for (const a of rows) {
    let sw = 0, swx = 0, k = 0;
    for (const b of rows) {
      if (b === a || Math.abs(ddays(b.mid, a.mid)) > HE_WINDOW) continue;
      // the consensus a poll is measured against is OTHER HOUSES' polls only
      // – a weekly house ringing three times in a window would otherwise
      // outvote everyone else, read its own level as consensus, and have its
      // measured lean shrunk toward zero by construction
      if (b.firm === a.firm) continue;
      // a stratified row only compares against its own stratum, so a different
      // question (approval vs favourability) or a different person in the same
      // office never enters the consensus it is measured against
      if (a.strat != null && b.strat !== a.strat) continue;
      sw += b.n; swx += b.n * b.x; k++;
    }
    if (k < 3) continue;                       // too few neighbours to define a consensus
    devs.push({ firm: a.firm, mid: a.mid, dev: a.x - swx / sw });
  }
  // n = how many of that firm's readings fed the estimate at all, so the UI
  // can distinguish "no lean" from "not enough polls to say"
  const evidenceN = {};
  const evidenceFrom = {};
  // devs grouped per firm once (push order preserved = the flat list's
  // filtered order): at() is queried per row by aroundPts/heV across every
  // series and used to re-scan this whole list for its firm each time
  const evidenceLast = {};
  const devsByFirm = Object.create(null);
  for (const d of devs) {
    evidenceN[d.firm] = (evidenceN[d.firm] || 0) + 1;
    if (evidenceFrom[d.firm] == null || d.mid < evidenceFrom[d.firm]) evidenceFrom[d.firm] = d.mid;
    if (evidenceLast[d.firm] == null || d.mid > evidenceLast[d.firm]) evidenceLast[d.firm] = d.mid;
    (devsByFirm[d.firm] || (devsByFirm[d.firm] = [])).push(d);
  }
  const at = (firm, t) => {
    let sw = 0, swx = 0;
    for (const d of devsByFirm[firm] || []) {
      if (d.mid > t) continue;
      // t = Infinity reads the whole history undecayed: equal weights, shrink
      // on the raw count – the all-time pooled constant this page always
      // showed, used for the emitted {v, n} snapshots
      const w = Number.isFinite(t) ? Math.exp(-LN2 * ddays(t, d.mid) / HE_HALF) : 1;
      sw += w; swx += w * d.dev;
    }
    if (!sw) return 0;
    return (sw / (sw + SHRINK_K)) * (swx / sw);
  };
  /* snapshot(t): the {firm: {v, n}} map the data asset emits and the page
     labels read – v rounded to 0.1 as it always was, n the evidence count. */
  const snapshot = (t) => Object.fromEntries(
    Object.keys(evidenceN).map((f) => [f, { v: r1(at(f, t)), n: evidenceN[f] }])
  );
  return { at, evidenceN, evidenceFrom, evidenceLast, snapshot, estimable: devs.length > 0 };
}
/* Two pollsters asking different questions about one thing – RedBridge's
   and Ipsos's top three issues (§7h) – sit a steady distance apart, set by
   the wording rather than by sampling. houseEffectsFor can't measure that:
   it wants three polls from other houses around each one, and with two
   houses "the others" are the other house, so each would be charged the
   whole gap. Here each poll's gap from the other house's polls within
   HE_WINDOW days (sample-weighted) is pooled with the headline's recency
   decay and read at t, as houseEffectsFor reads its leans; each house then
   leans HALF the gap, one either side of the pair's middle – two houses
   can't say which of them is right. Not shrunk: a gap in wording, measured
   poll after poll, isn't the noise SHRINK_K guards against, and a shrunk
   lean would hand back most of the swing it exists to remove (Ipsos files
   about three weeks after fieldwork, so its poll is in a six-week window for
   only part of each month, and an unadjusted pool jumps between the two
   houses' levels as it comes and goes – health between 27 and 38 over
   2026). Fewer than PAIR_MIN measured gaps: nothing is removed. */
const PAIR_MIN = 4;
function pairLeanFor(rows) {
  const firms = [...new Set(rows.map((r) => r.firm))];
  if (firms.length !== 2) return { at: () => 0, estimable: false, firms, gapAt: () => null };
  const devs = [];                               // { mid, gap: firms[0] minus firms[1] }
  for (const a of rows) {
    let sw = 0, swx = 0;
    for (const b of rows) {
      if (b.firm === a.firm || Math.abs(ddays(b.mid, a.mid)) > HE_WINDOW) continue;
      sw += b.n; swx += b.n * b.x;
    }
    if (sw) devs.push({ mid: a.mid, gap: a.firm === firms[0] ? a.x - swx / sw : swx / sw - a.x });
  }
  const gapAt = (t) => {
    let sw = 0, swx = 0, k = 0;
    for (const d of devs) {
      if (d.mid > t) continue;
      const w = Number.isFinite(t) ? Math.exp(-LN2 * ddays(t, d.mid) / HE_HALF) : 1;
      sw += w; swx += w * d.gap; k++;
    }
    return k >= PAIR_MIN ? swx / sw : null;
  };
  const at = (firm, t) => {
    const g = gapAt(t);
    return g == null ? 0 : firm === firms[0] ? g / 2 : firm === firms[1] ? -g / 2 : 0;
  };
  return { at, gapAt, firms, estimable: devs.length >= PAIR_MIN };
}
/* t = the reference time the lean is read at – the nowcast's ref for the
   current estimate, the month's midpoint for monthly points – so every
   displayed figure is debiased by what each house's lean was AT the time the
   figure describes, not by an all-time pooled constant. */
const heV = (he, firm, t) => (he && typeof he.at === "function" ? he.at(firm, t) : 0);
const houseEffectsStrat = houseEffectsFor;   // same estimator; rows carry `strat`
const OPP_SPLICE_ISO = "2026-02-13";         // Taylor replaces Ley – a different person
/* Which opposition-leader era a reading belongs to. Ley's last published
   reading is Resolve's 8–12 Feb 2026 poll; Taylor's first is 14 Feb – so the
   13th is the first Taylor-only day, and every date falls one side of it. */
/* Another jurisdiction (JUR) names its own leaders in jurisdiction.eras, a
   list per office. The slot keeps the federal page's keys – "taylor" the
   opposition's holder now, "ley" everyone before – and the leadership views
   split a key's line wherever its holder changes: /vic/'s Premier slot runs
   Andrews → Allan → Carroll inside alb_*, so each monthly row names the
   month's holders (alb_who, ley_who, hanson_who; leaderMonths). */
const eraOf = JUR
  ? (iso) => { const eras = JUR.eras.opp; return iso >= eras[eras.length - 1].from ? "taylor" : "ley"; }
  : (iso) => (iso < OPP_SPLICE_ISO ? "ley" : "taylor");
// who held an office on a date (JUR only) – "alb", "opp" or "han"
const holderOf = (slot, iso) => { let n = null; for (const e of JUR.eras[slot]) if (iso >= e.from) n = e.name; return n; };
// a reading is the office's CURRENT holder's: a current reading pools only
// these, so Carroll's window never reaches back into Allan's polls (federally
// Albanese and Hanson held theirs all term – every reading passes)
const curOf = (slot) => (JUR ? (p) => p.date >= JUR.eras[slot][JUR.eras[slot].length - 1].from : () => true);
// JUR: who held each office on a poll's date, stamped on the poll (and its
// approval figures) so every view names the right people – /vic/'s Premier
// was Andrews, Allan or Carroll depending on the poll
const whoAt = (iso) => ({ alb: holderOf("alb", iso), opp: holderOf("opp", iso), han: holderOf("han", iso) });
// sample-weighted, house-effect-adjusted monthly mean of a row set - the
// plain-value twin of monthWithSe, so one construction carries both and no
// series can drift onto its own weighting rule again
function monthlyAdj(rows, he) {
  return MONTHS.map((ym) => {
    const r = monthWithSe(rows, he, ym);
    return r && { ym, x: mx(ym), v: r.v, k: r.n };
  }).filter(Boolean);
}
// trailing recency-weighted nowcast (same window/half-life as the headline 2PP)
/* Weighted nowcast over the trailing window, WITH its uncertainty. Two
   estimates, larger wins:
     seSpread – how far the polls in the window disagree about the weighted
                mean. Var(mean) = sigma^2/nEff with nEff = Kish's effective
                count; the weighted DOF correction reduces it to
                sqrt(wVar / (nEff - 1)).
     seFloor  – what sampling error alone would give even if every house
                agreed exactly. Carries the estimate when nEff <= 1.
   seSpread already contains sampling noise, house residue and real movement
   inside the window, so it is usually the binding one. Neither can see error
   shared across the whole industry – no aggregate can measure that about
   itself, which is why the copy says so rather than implying otherwise. */
/* The estimator itself, over an already-weighted set of readings. ONE
   implementation, because the headline nowcast and the monthly points on the
   chart behind it must not disagree about what an interval means: the nowcast
   weights by recency as well as sample size, a monthly mean drops the recency
   term, and both deflate a house's repeat waves to the square root of their
   number - from there the two are the same arithmetic. */
function weightedWithSe(pts) {                 // pts: [{ w, x, n }]
  let sw = 0, sw2 = 0, swx = 0;
  for (const p of pts) { sw += p.w; sw2 += p.w * p.w; swx += p.w * p.x; }
  if (!sw) return null;
  const mean = swx / sw;
  const nEff = (sw * sw) / sw2;
  const wVar = pts.reduce((t, p) => t + p.w * (p.x - mean) ** 2, 0) / sw;
  const seSpread = nEff > 1 ? Math.sqrt(wVar / (nEff - 1)) : Infinity;
  /* Sampling variance of ONE reading, in points², before dividing by its
     sample. A share carries p(1−p); a measure that is not a share carries its
     own `pq` and says so at the point it is built (see the leader nets, where
     a difference of two proportions has a different variance entirely). */
  const pqOf = (p) => (p.pq != null ? p.pq : (mean / 100) * (1 - mean / 100) * 1e4);
  const seFloor = Math.sqrt(pts.reduce((t, p) => t + p.w * p.w * HL_DEFF * pqOf(p) / p.n, 0)) / sw;
  const se = Math.max(Number.isFinite(seSpread) ? seSpread : 0, seFloor);
  return { v: mean, n: pts.length, se, nEff };
}
/* The window's weighted points, split out so an estimate can be taken
   UNROUNDED (the five-party primary check totals the debiased shares before
   any r1 touches them). nowcastAdj stays the rounded public face. */
/* k: the window (HEADLINE_K unless the measure is sparse). A row's base
   weight is its sample, or `w0` where a measure weights houses equally (the
   leader nets); n still sizes its sampling-error floor either way. */
function nowcastPts(rows, he, ref, k = HEADLINE_K) {
  const pts = [];
  const waves = new Map();                    // firm -> wave count inside the window
  for (let i = 0; i < rows.length; i++) {
    const a = rows[i];
    const d = ddays(ref, a.mid);
    if (d < 0 || d > k.window) continue;
    waves.set(a.firm, (waves.get(a.firm) || 0) + 1);
    // ri ties a point back to its source row so the change-SE maths
    // (changeSeOf) can match the same reading across two overlapping windows
    pts.push({ ri: i, w: (a.w0 ?? a.n) * k.weight(d), x: a.x - heV(he, a.firm, ref), n: a.n, firm: a.firm, ...(a.pq != null ? { pq: a.pq } : {}) });
  }
  /* A house with m waves in the window has not measured the electorate m
     independent times - same method, same house-effect residue - so its
     m readings count for sqrt(m), the midpoint between "independent" (m)
     and "one reading" (1). Weekly Morgan still outweighs monthly everyone
     else for genuinely measuring more often, ~1.7x rather than 3x - it
     just can't be half the sample by showing up three times. */
  for (const p of pts) p.w /= Math.sqrt(waves.get(p.firm));
  return pts;
}
function nowcastAdj(rows, he, ref) {
  const r = weightedWithSe(nowcastPts(rows, he, ref));
  return r && { v: r1(r.v), n: r.n, se: r2(r.se), nEff: r1(r.nEff), ci95: r1(1.96 * r.se) };
}
/* Sampling variance of ONE window point, mirroring weightedWithSe's floor: a
   share carries p(1−p) at the window's mean, a non-share carries its pq. */
const pointSampV = (p, mean) => HL_DEFF * (p.pq != null ? p.pq : (mean / 100) * (1 - mean / 100) * 1e4) / p.n;
/* The SE of the 30-day change. Root-sum-square of the two windows' own SEs
   assumes they share no reading – true of the three-week headline window
   (two 21-day windows 30 days apart cannot overlap) but false of the
   six-week sparse window, whose pair overlaps by 12 days. A reading in the
   shared band lands in BOTH means with different weights, so its sampling
   error multiplies by (a−b)² in the difference, not a²+b² – plain RSS
   overstated the change SE and filed conservative "not significant"
   verdicts on every sparse measure (Hanson/favourability, ppm margins,
   undecided, salience, the vote-switching rates). Subtract the shared-poll
   covariance, floored at the difference's exact sampling variance. With no
   shared band the formula is the old RSS exactly, so the headline's own
   change figure is untouched. */
function changeSeOf(pNow, mNow, pPrev, mPrev) {
  const swN = pNow.reduce((t, p) => t + p.w, 0), swP = pPrev.reduce((t, p) => t + p.w, 0);
  const prevByRi = new Map(pPrev.map((p) => [p.ri, p]));
  let cov = 0, floor = 0;
  for (const p of pNow) {
    const a = p.w / swN, v = pointSampV(p, mNow.v);
    const q = prevByRi.get(p.ri);
    if (!q) { floor += a * a * v; continue; }
    const b = q.w / swP;
    cov += a * b * v;
    floor += (a - b) * (a - b) * v;
    prevByRi.delete(p.ri);
  }
  for (const [, q] of prevByRi) { const b = q.w / swP; floor += b * b * pointSampV(q, mPrev.v); }
  return Math.sqrt(Math.max(mNow.se ** 2 + mPrev.se ** 2 - 2 * cov, floor));
}
/* A panel's current reading, built as the headline is: the nowcast at the
   newest poll, the same a month earlier, and whether the move clears the
   change's own margin (changeSeOf). Null when the window holds no poll. */
function currentReading(rows, he, k = HEADLINE_K, ref = refNow) {
  const pNow = nowcastPts(rows, he, ref, k);
  const now = weightedWithSe(pNow);
  if (!now) return null;
  const out = { v: r1(now.v), se: r2(now.se), ci95: r1(1.96 * now.se), n: now.n, nEff: r1(now.nEff) };
  const pPrev = nowcastPts(rows, he, ref - 30 * 86400000, k);
  const prev = weightedWithSe(pPrev);
  if (prev) {
    const seChg = changeSeOf(pNow, now, pPrev, prev);
    Object.assign(out, { prev: r1(prev.v), chg: r1(now.v - prev.v), changeCi95: r1(1.96 * seChg),
                         changeSig: Math.abs(now.v - prev.v) > 1.96 * seChg });
  }
  return out;
}
/* The same estimate for ONE calendar month, weighted by sample size only.
   This is what the trend line is drawn from, so it is also what the shaded
   interval behind the trend line has to be drawn from. A month carried by a
   single poll has no spread to measure, so its floor - sampling error alone -
   is what shows, which is the honest answer rather than a hairline.
   One deflation is shared with the nowcast, not optional: a house with m
   waves in the month has not measured the electorate m independent times -
   same method, same residue - so its waves count for sqrt(m), here exactly
   as in the window (see nowcastAdj). The point weights deflate; the raw n
   still feeds the sampling-error floor, again mirroring the nowcast. */
const ymMidMs = (ym) => Date.parse(ym + "-15T00:00:00Z");  // month's midpoint in ms
function monthWithSe(rows, he, ym) {
  const rs = rows.filter((r) => r.ym === ym);
  const waves = new Map();
  for (const r of rs) waves.set(r.firm, (waves.get(r.firm) || 0) + 1);
  return weightedWithSe(rs.map((r) => ({ w: r.n / Math.sqrt(waves.get(r.firm)),
                                         x: r.x - heV(he, r.firm, ymMidMs(ym)), n: r.n, ...(r.pq != null ? { pq: r.pq } : {}) })));
}

const houseEffect = houseEffectsFor(tppRows);
/* The synthetic series gets its OWN house effects, measured against its own
   consensus – a house whose primaries run ALP-high is a different bias from
   the same house's published-2PP lean, and the comment on houseEffectsFor
   (never borrow between measures) applies doubly here. */
const synthEffect = houseEffectsFor(tppRowsSynth);

/* ---- 1a. /vic/'s trend lines: a Kalman smoother (kalman.mjs) ------------
   Victoria polls ~1.3 times a month, so the calendar-month average below
   rests on one or two polls a point and its lines jump by sampling error
   alone. There (JUR.kalman) every 2PP and primary line is instead the
   smoothed trend through every poll: each series' monthly rows keep their
   shape ({ym, x, value, ci95, k}), sampled at mid-month from the series'
   first polled month, the current month's point at the newest poll so the
   line ends on the headline; each current figure is the filter's own
   estimate, and its change on a month ago is tested against the posterior
   uncertainty of the trend's move (kalman.mjs's frozen copy), not two
   independent windows. Smoothness per series is a fixed setting
   (JUR.kalman.series, the maximum-likelihood fit on Victoria's own polls);
   kfLog reports the current fit beside it, a refit being a hand call.
   Federally none of this runs: KF is null. */
const KF = JUR && JUR.kalman && !JUR.model ? JUR.kalman : null;   // /vic/ moved to the model 2026-11-23 (JUR.model)
const kfDay = (ms) => Math.round(ms / 86400000);
const KF_T0 = kfDay(Date.parse(ELECTION.date + "T00:00:00Z")), KF_T1 = kfDay(refNow);
// a change of Premier or Opposition Leader may move every series at once
const KF_JUMPS = KF ? ["alb", "opp"].flatMap((slot) => JUR.eras[slot].slice(1)
  .map((e) => ({ t: kfDay(Date.parse(e.from + "T00:00:00Z")), v: KF.jumpSd ** 2 }))) : [];
const KF_NOW = {}, kfLog = [];
function kfSeries(rows, key, mu0) {
  const obs = rows.map((r) => ({ t: kfDay(r.mid), y: r.x, n: r.n, house: r.firm, key: r.key, ym: r.ym }))
    .filter((o) => o.t <= KF_T1).sort((a, b) => a.t - b.t || (a.house < b.house ? -1 : a.house > b.house ? 1 : 0));
  if (!obs.length) return null;
  // a series first reported long after the election (One Nation, counted
  // among others until 2026) starts at its first reading, not the count
  const late = mu0 == null || obs[0].t - KF_T0 > 180;
  const t0 = late ? obs[0].t - 1 : KF_T0;
  const set = KF.series[key];
  const opts = { s: set.s, tau: set.tau, sh: KF.leanSd, deff: HL_DEFF, mu0: late ? obs[0].y : mu0, sd0: late ? 5 : 0.5,
                 t0, t1: KF_T1, jumps: KF_JUMPS.filter((j) => j.t > t0) };
  const sm = kalmanRun(obs, { ...opts, smooth: true });
  const ch = KF_T1 - 30 >= t0 ? kalmanRun(obs, { ...opts, snapAt: KF_T1 - 30 }).change : null;
  const fit = kalmanFit(obs, opts);
  kfLog.push(`${key}: ${obs.length} polls, drift ${set.s}/day tau ${set.tau}; a refit today says ${fit.s}, ${fit.tau}`);
  return { key, obs, t0, opts, path: sm.path, final: sm.final, change: ch, leans: sm.leans };
}
// the trend at a day (the path's), or the filter's own at the newest poll
const kfAt = (kf, day) => (day >= KF_T1 ? kf.final : kf.path[Math.max(0, day - kf.t0)]);
// the monthly rows the charts read: mid-month from the first polled month,
// the current month's point at the newest poll
function kfMonths(kf, firstYm = kf.obs[0].ym) {
  const ms = MONTHS.filter((ym) => ym >= firstYm);
  return ms.map((ym, i) => {
    const last = i === ms.length - 1, p = kfAt(kf, last ? KF_T1 : kfDay(ymMidMs(ym)));
    return { ym, x: last ? dx(LATEST_ISO) : mx(ym), v: p.mu, ci: 1.96 * p.sd, k: kf.obs.filter((o) => o.ym === ym).length };
  });
}
const kfNow = (kf) => kf && { alp: r1(kf.final.mu), n: kf.obs.length, se: r2(kf.final.sd), nEff: kf.obs.length, ci95: r1(1.96 * kf.final.sd) };
const kfChgOf = (kf) => (kf && kf.change
  ? { changeSe: r1(kf.change.sd), changeCi95: r1(1.96 * kf.change.sd), changeSig: Math.abs(kf.change.chg) > 1.96 * kf.change.sd }
  : {});

/* ---- 1. monthly 2PP (weighted, debiased) + election-day anchor --------- */
/* Each month carries its own 95% interval. The hero draws it as a ribbon
   around the line: the headline already refuses to call a move real unless it
   clears its interval, and a chart that drew a hairline under that sentence
   was contradicting it. `k` is how many polls the month rests on. */
const agg2pp = MONTHS.map((ym) => {
  const r = monthWithSe(tppRows, houseEffect, ym);
  if (!r) return null;
  return { ym, x: mx(ym), alp: r1(r.v), lnp: r1(100 - r.v), ci95: r1(1.96 * r.se), k: r.n };
}).filter(Boolean);
// the election is a COUNT, not an estimate, so its interval is zero and the
// ribbon pinches shut on it - the one point on the chart that is simply known
agg2pp.unshift({ ym: ymOf(ELECTION.date), x: dx(ELECTION.date), alp: ELECTION.tpp_alp, lnp: ELECTION.tpp_lnp, ci95: 0, k: 0, election: true });
if (KF) {                                   // /vic/: the trend (§1a)
  const kf = KF_NOW.tpp = kfSeries(tppRows, "tpp", ELECTION.tpp_alp);
  if (kf) agg2pp.splice(1, Infinity, ...kfMonths(kf).map((m) => ({ ym: m.ym, x: m.x, alp: r1(m.v), lnp: r1(100 - m.v), ci95: r1(m.ci), k: m.k })));
}

/* ---- 1b. monthly synthetic 2PP (same estimator, flows.mjs table) ---------
   Same monthly machinery as the published series above, run on the synthetic
   rows and their own house effects. Its election "anchor" is the IMPLIED
   value – with the TPP table that is the count itself by construction (the
   table was built from that count: every ballot redistributed ALP v
   Coalition), so the anchor matching 55.2 proves internal consistency only,
   not current-term accuracy. The kept-visible shortfall the old TCP-anchor
   comment described (implied 54.2 vs count 55.2) was a property of the TCP
   majors-only renormalisation, not of flow tables in general. */
const agg2ppSynth = MONTHS.map((ym) => {
  const r = monthWithSe(tppRowsSynth, synthEffect, ym);
  if (!r) return null;
  return { ym, x: mx(ym), alp: r1(r.v), lnp: r1(100 - r.v), ci95: r1(1.96 * r.se), k: r.n };
}).filter(Boolean);
// computed from the data, never hardcoded – flows.mjs changes, this moves
agg2ppSynth.unshift({ ym: ymOf(ELECTION.date), x: dx(ELECTION.date), alp: r1(impliedAlp2pp(ELECTION)), lnp: r1(100 - impliedAlp2pp(ELECTION)), ci95: 0, k: 0, election: true });
if (KF) {
  const kf = KF_NOW.imp = kfSeries(tppRowsSynth, "imp", impliedAlp2pp(ELECTION));
  if (kf) agg2ppSynth.splice(1, Infinity, ...kfMonths(kf).map((m) => ({ ym: m.ym, x: m.x, alp: r1(m.v), lnp: r1(100 - m.v), ci95: r1(m.ci), k: m.k })));
}

/* ---- 1c. flow-sensitivity band --------------------------------------------
   The conversion cell that actually moves between elections is One Nation's:
   the 2022 table (TPP cut, Event 24310) sent 35.7% of ON preferences to
   Labor; the shipped 2025 table sends 25.5%. Re-price THAT ONE CELL on the
   same polls: implied 2PP is linear in the share, so each alt row is the
   same row plus (2022 − 2025)·its ONP primary, and the alt series runs
   §1b's full machinery (own house effects, monthly estimator) rather than a
   blanket per-month offset – a house whose ONP primary runs high shouldn't
   drag the band edge as if it were every house's reading. Paired with the
   shipped series, the bracket between the two is what the ONP conversion is
   worth at each month's ONP primary (~0.7pt at the election's 6%, ~2.8pt at
   the current ~27%). Both edges are COUNTED tables, so this is a
   sensitivity read, not an interval: it brackets the last two elections and
   claims nothing about the next one. */
/* The 2022-flow edge below IS the federal §1c read: 0.3570 is the federal
   count, and a jurisdiction build has swapped FLOW to its own 2022 flows
   (FLOW at the top), so the pair would bracket a foreign constant against
   the local one. On a JUR build flowSens is null instead, and the client –
   which guards on D.flowSens's length – draws no band. */
const ONP_FLOW_2022 = 0.3570;
const synthBand = JUR ? null : (() => {
  const tppRowsSynth22 = tppRowsSynth.map((r) => ({ ...r, x: r.x + (ONP_FLOW_2022 - FLOW.onp) * r.onp }));
  const synth22Effect = houseEffectsFor(tppRowsSynth22);
  const agg2ppSynth22 = MONTHS.map((ym) => {
    const r = monthWithSe(tppRowsSynth22, synth22Effect, ym);
    if (!r) return null;
    return { ym, x: mx(ym), alp: r1(r.v), lnp: r1(100 - r.v), ci95: r1(1.96 * r.se), k: r.n };
  }).filter(Boolean);
  const sensElec22 = impliedAlp2pp(ELECTION) + (ONP_FLOW_2022 - FLOW.onp) * ELECTION.onp;
  agg2ppSynth22.unshift({ ym: ymOf(ELECTION.date), x: dx(ELECTION.date), alp: r1(sensElec22), lnp: r1(100 - sensElec22), ci95: 0, k: 0, election: true });
  if (KF) {                                 // the sensitivity edge, built as the line it brackets
    const kf = kfSeries(tppRowsSynth22, "imp", sensElec22);
    if (kf) agg2ppSynth22.splice(1, Infinity, ...kfMonths(kf).map((m) => ({ ym: m.ym, x: m.x, alp: r1(m.v), lnp: r1(100 - m.v), ci95: r1(m.ci), k: m.k })));
  }
  // lo/hi per month; the 2022 share sends ONP further ALP-side, so 22 ≥ 25
  // month for month and min/max only guards a rounding tie
  return agg2ppSynth.map((m) => {
    const alt = agg2ppSynth22.find((a) => a.ym === m.ym);
    return alt ? { ym: m.ym, x: m.x, lo: Math.min(m.alp, alt.alp), hi: Math.max(m.alp, alt.alp) } : null;
  }).filter(Boolean);
})();

/* ---- 1d. monthly implied ALP–ON (same estimator, the ALP-v-ON table) ----
   §1b's machinery once more, on tppRowsSynthOn and its own house effects –
   one frozen table, one series, so the implied-basis chart under the ALP v
   ON hero is the pairing's polls treated the way the classic implied 2PP
   treats ALP v L/NP. Two structural differences, both forced by there being
   no election count of the pairing:
   - No anchor row can be unshifted: there is simply nothing to anchor.
   - The level carries two doubts, and ci95 adds them in quadrature as
     independent errors: cs, the month's own 95% sampling interval (as the
     classic series carries), and cf, the frozen table's own range (§0's
     FP_ON_BAND, stacked linearly at the month's primaries via each row's
     bn). cf is a range, not a sampling interval, so the combined figure is
     called a margin, never a "95% interval". Until 2026-10-11 ci95 was cf
     alone, which judged the pairing as if its polls had no sampling error. */
const synthOnEffect = houseEffectsFor(tppRowsSynthOn);
const onMargin = (cs, cf) => ({ ci95: r1(Math.hypot(cs, cf)), cs: r1(cs), cf: r1(cf) });
const agg2ppSynthOn = MONTHS.map((ym) => {
  const r = monthWithSe(tppRowsSynthOn, synthOnEffect, ym);
  if (!r) return null;
  let bnSum = 0, nSum = 0;
  for (const q of tppRowsSynthOn) {
    if (q.ym !== ym) continue;
    bnSum += q.n * q.bn; nSum += q.n;
  }
  return { ym, x: mx(ym), a: r1(r.v), b: r1(100 - r.v), ...onMargin(1.96 * r.se, bnSum / nSum), k: r.n };
}).filter(Boolean);
if (KF) {   // /vic/: the trend's line; the flow range is carried through a month with no poll
  const kf = KF_NOW.on = kfSeries(tppRowsSynthOn, "on", null);
  if (kf) {
    let band = null;
    agg2ppSynthOn.splice(0, Infinity, ...kfMonths(kf).map((m) => {
      const rs = tppRowsSynthOn.filter((q) => q.ym === m.ym);
      if (rs.length) band = rs.reduce((t, q) => t + q.n * q.bn, 0) / rs.reduce((t, q) => t + q.n, 0);
      return { ym: m.ym, x: m.x, a: r1(m.v), b: r1(100 - m.v), ...onMargin(m.ci, band), k: m.k };
    }));
  }
}

/* ---- 2. monthly primary vote + election-day anchor --------------------- */
/* Primaries get the SAME treatment as the monthly 2PP – sample-weighted and
   house-effect-adjusted, per party, through the same monthWithSe
   construction. This matters more here than on the 2PP:
   the houses diverge measurably further on primary shares (One Nation's spread
   is ~2pp beyond sampling error), so a plain mean of houses that disagree
   inherits whichever houses happened to poll that month. Each party is debiased
   on its OWN house effects; the residual sum is renormalised only if it drifts
   more than half a point from the plain mean's total, so a genuine
   undecided-driven shortfall isn't papered over. */
const PRIMARY_KEYS = ["alp", "lnp", "grn", "onp", "oth"];
const primaryVal = (p, k) => (k === "oth" ? ((p.ind ?? null) === null && (p.oth ?? null) === null ? null : (p.ind ?? 0) + (p.oth ?? 0)) : p[k]);
const primaryRows = {}, primaryHE = {};
for (const k of PRIMARY_KEYS) {
  primaryRows[k] = POLLS.filter((p) => primaryVal(p, k) != null && !noAggPoll(p))
    .map((p) => ({ ym: ymOf(p.date), mid: midMs(p), x: primaryVal(p, k), n: rowN(p), firm: p.pollster, key: p.date + "|" + p.pollster }));
  primaryHE[k] = houseEffectsFor(primaryRows[k]);
}
/* ---- 2m. the primary-vote model (federal; .build/newtracker/primary-model.mjs)
   Every federal primary figure – the current shares, the monthly line and
   its band, the change on a month, each house's lean, each poll's footprint
   and yardstick – comes from one state-space model of the five shares
   together (the module's header has the construction; the prototype,
   backtests and review are in .build/analysis/primary-bayes/). /vic/ keeps
   its Kalman trend (§1a); PRIMM is null there and the recipe below runs.
   PRIM_MISS: the polls' final consensus (this model, election eve) minus the
   count at the 2007–2025 elections, mean and spread in points (spread =
   sd·√(1 + 1/n), the mean's own uncertainty included; One Nation from the
   three elections it was polled apart) – the prior on the term's first day
   is the count moved by it.
   PRIM_JUMPS: changes of prime minister or opposition leader this term,
   where the shares may step. */
// PRIM_MISS lives in primary-model.mjs (one copy for this file and build-vote-history.mjs)
/* the days a new leader can move the vote at once: federally Ley, then
   Taylor, lead the Liberals; a state build's each change of head of
   government or opposition leader since its election (JUR.eras) */
const PRIM_JUMPS = JUR ? ["alb", "opp"].flatMap((slot) => ((JUR.eras || {})[slot] || []).slice(1).map((e) => e.from))
  .filter((d) => d > ELECTION.date).sort() : ["2025-05-13", "2026-02-12"];
/* the D-base houses (POLL_BASES, §5b: undecided set aside, no leaner) – a
   printed undecided share there is out of the shares' base */
const PRIM_UND_ASIDE = new Set(["Roy Morgan", "Spectre Strategy", "YouGov"]);
const pmDay = (iso) => Math.floor(Date.parse(String(iso).slice(0, 10) + "T00:00:00Z") / 86400000);
const PRIMM = (() => {
  if (JUR && !JUR.model) return null;
  const tStart = Date.now();
  const readings = [];
  POLLS.forEach((p, idx) => {
    if (noAggPoll(p)) return;
    const y = Object.fromEntries(PRIMARY_KEYS.map((k) => [k, primaryVal(p, k)]));
    const c = pmCategories(y);
    if (!c) return;
    const und = p.undecidedIn ?? (PRIM_UND_ASIDE.has(p.pollster) ? p.undecided : null) ?? 0;
    const s = pmDay(p.dateStart || p.date), e = pmDay(p.date);
    readings.push({ key: p.date + "|" + p.pollster, house: p.pollster, idx, start: s, end: e, day: Math.round((s + e) / 2),
      n: (rowN(p) / HL_DEFF) * (1 - und / 100), und, cats: c.cats, vals: c.vals, full: c.full, step: pmStep(c.vals),
      pub: p.published ? pmDay(p.published) : e });
  });
  readings.sort((a, b) => a.day - b.day || a.idx - b.idx);
  const t0 = pmDay(ELECTION.date), t1 = pmDay(LATEST_ISO);
  /* the days the panel prints: mid-month (the current month at the newest
     poll, so the line ends on the headline), and a month ago */
  const pollYm = MONTHS.filter((ym) => POLLS.some((p) => ymOf(p.date) === ym));   // months with polls, as the line always had
  /* a state build polls a month or two apart: its line carries on through a
     month with no poll from the first month with one (as the Kalman trend it
     replaced did), its interval widening until the next */
  const months = (JUR ? MONTHS.filter((ym) => ym >= pollYm[0]) : pollYm)
    .map((ym) => ({ ym, day: ym === LATEST_ISO.slice(0, 7) ? t1 : Math.min(pmDay(ym + "-15"), t1) })).filter((m) => m.day > t0);
  const anchor = anchorFrom(ELECTION, PRIM_MISS);
  const jumps = new Set(PRIM_JUMPS.map(pmDay));
  const eventDays = POLLS.map((p) => Math.round((pmDay(p.dateStart || p.date) + pmDay(p.date)) / 2));
  const emDay = Math.min(pmDay(ELECTION.date.slice(0, 7) + "-15"), t1);   // the election month's middle (§7gm's lines start there)
  const fit = fitPrimary(readings, { t0, t1, anchor, jumps, days: [...months.map((m) => m.day), t1 - 30, emDay], pairs: [[t1, t1 - 30]], eventDays,
    trend: true, nDraw: +(process.env.PRIM_NDRAW || 2000), seed: 20261123 });
  const P = PM_PARTIES.length;
  const colOf = (draws, q) => { const n = draws.length / P, o = new Float64Array(n); for (let i = 0; i < n; i++) o[i] = 100 * draws[i * P + q]; return o; };
  const sum = (draws) => Object.fromEntries(PM_PARTIES.map((k, q) => {
    const c = colOf(draws, q), lo = pmQuant(c, 0.025), hi = pmQuant(c, 0.975);
    return [k, { v: pmMean(c), lo, hi, ci: (hi - lo) / 2 }];
  }));
  const at = new Map([...months.map((m) => m.day), t1, t1 - 30].map((d) => [d, sum(fit.shares(d))]));
  const now = at.get(t1), prev = at.get(t1 - 30);
  const pd = fit.pair(t1, t1 - 30);
  const chg = Object.fromEntries(PM_PARTIES.map((k, q) => {
    const c = colOf(pd, q), lo = pmQuant(c, 0.025), hi = pmQuant(c, 0.975);
    return [k, { chg: r1(pmMean(c)), lo: r1(lo), hi: r1(hi), changeCi95: r1((hi - lo) / 2), changeSig: lo > 0 || hi < 0, pUp: r2(pmMean(c.map((v) => (v > 0 ? 1 : 0)))) }];
  }));
  /* the chance each party is ahead of each other, today */
  const nowD = fit.shares(t1), nD = nowD.length / P;
  const pAhead = {};
  for (let a = 0; a < P; a++) for (let b = 0; b < P; b++) if (a !== b) {
    let w = 0; for (let i = 0; i < nD; i++) if (nowD[i * P + a] > nowD[i * P + b]) w++;
    pAhead[PM_PARTIES[a] + ">" + PM_PARTIES[b]] = r2(w / nD);
  }
  /* each house's lean today (printed share minus the average pollster's) */
  const leanNow = {};
  for (const h of fit.L.houses) {
    const d = fit.lean(h);
    leanNow[h] = Object.fromEntries(PM_PARTIES.map((k, q) => { const c = colOf(d, q); return [k, { v: pmMean(c), lo: pmQuant(c, 0.025), hi: pmQuant(c, 0.975) }]; }));
  }
  /* the same month by month, at the settings' mode (the leans panel's lines) */
  const leanMonths = Object.fromEntries(fit.L.houses.map((h) => [h, fit.leanPath(h, months.map((m) => m.day))]));
  if (process.env.PRIM_DEBUG) for (const r of readings) { const lv = fit.levelAt(r.day); if (lv) console.log("DBG", new Date(r.day*864e5).toISOString().slice(0,10), r.house, "vals", JSON.stringify(r.vals.map((v)=>+v.toFixed(1))), "cats", JSON.stringify(r.cats), "line", PM_PARTIES.map((k,q)=>k+" "+(100*lv[q]).toFixed(1)).join(" "), "n", r.n.toFixed(0)); }
  const s = fit.settings, th = s.comps[0];
  console.log(`primary model: ${readings.length} polls (${fit.L.houses.length} houses in the state, ${fit.L.core.length} set the zero, ${fit.L.lone.size} one-off) in ${((Date.now() - tStart) / 1000).toFixed(1)}s`
    + ` | now ${PM_PARTIES.map((k) => `${k} ${r1(now[k].v)} ±${r1(now[k].ci)}`).join(" ")}`
    + ` | ESS ${fit.ctx.laplace ? fit.ctx.laplace.ess.toFixed(1) : "-"} of ${s.comps.length}`
    + ` | κ ${JSON.stringify(Object.fromEntries([...s.kappa].filter(([h]) => !fit.L.lone.has(h))))}`);
  /* the first day a poll printed One Nation apart (a state build's line
     carries none before it) */
  const qOn = PM_PARTIES.indexOf("onp");
  const onDays = readings.filter((r) => r.cats.some((c) => c.length === 1 && c[0] === qOn)).map((r) => r.day);
  const onFirst = onDays.length ? Math.min(...onDays) : null;
  return { fit, readings, t0, t1, months, emDay, at, now, prev, chg, pAhead, leanNow, leanMonths, onFirst,
    byKey: new Map(readings.map((r) => [r.key, r])) };
})();
const aggPrimary = MONTHS.map((ym) => {
  const rows = POLLS.filter((p) => ymOf(p.date) === ym);
  if (!rows.length) return null;
  // per party, since the houses disagree by different amounts about different
  // parties – One Nation's spread is the widest on the board and the reason
  // this chart needed intervals more than the 2PP did
  const o = { ym, x: mx(ym), ci: {} };
  let plainTotal = 0;
  for (const k of PRIMARY_KEYS) {
    const rs = primaryRows[k].filter((r) => r.ym === ym);
    // a party no poll that month reported: /vic/'s One Nation before 2026,
    // folded into others (null, never 0 – it was polled, just not apart);
    // federally every month carries all five
    if (!rs.length) { o[k] = JUR ? null : 0; continue; }
    const est = monthWithSe(primaryRows[k], primaryHE[k], ym);
    o[k] = est.v;
    o.ci[k] = r1(1.96 * est.se);
    plainTotal += mean(rs.map((r) => r.x));
  }
  const adjTotal = PRIMARY_KEYS.reduce((s, k) => s + (o[k] ?? 0), 0);
  if (adjTotal > 0 && Math.abs(adjTotal - plainTotal) > 0.5) {
    for (const k of PRIMARY_KEYS) if (o[k] != null) o[k] *= plainTotal / adjTotal;
  }
  for (const k of PRIMARY_KEYS) if (o[k] != null) o[k] = r1(o[k]);
  return o;
}).filter(Boolean);
aggPrimary.unshift({
  ym: ymOf(ELECTION.date), x: dx(ELECTION.date), election: true, ci: {},
  alp: ELECTION.alp, lnp: ELECTION.lnp, grn: ELECTION.grn,
  onp: ELECTION.onp ?? 0, oth: r1(ELECTION.oth ?? 0),
});
/* the federal line: the model at each month's middle (the current month at
   the newest poll), its 95% interval as ci – half its width */
if (PRIMM) aggPrimary.splice(1, Infinity, ...PRIMM.months.map(({ ym, day }) => {
  const a = PRIMM.at.get(day), o = { ym, x: mx(ym), ci: {} };
  for (const k of PRIMARY_KEYS) { o[k] = r1(a[k].v); o.ci[k] = r1(a[k].ci); }
  /* a state build's houses folded One Nation into others until it surged:
     before the month any poll printed it apart, the line shows no One Nation
     and others as the polls meant them, One Nation included (the two summed
     draw by draw), as the published figures read */
  if (JUR && PRIMM.onFirst != null && day < PRIMM.onFirst) {
    const dr = PRIMM.fit.shares(day), P = PM_PARTIES.length, qo = PM_PARTIES.indexOf("onp"), qx = PM_PARTIES.indexOf("oth");
    const c = Array.from({ length: dr.length / P }, (_, i) => 100 * (dr[i * P + qo] + dr[i * P + qx]));
    const lo = pmQuant(c, 0.025), hi = pmQuant(c, 0.975);
    o.oth = r1(pmMean(c)); o.ci.oth = r1((hi - lo) / 2); o.onp = null; delete o.ci.onp;
  }
  return o;
}));
if (KF) {   // /vic/: each party's trend (§1a); a party first reported late is null before it
  const per = KF_NOW.primary = {};
  for (const k of PRIMARY_KEYS) { const kf = kfSeries(primaryRows[k], k, ELECTION[k] ?? 0); if (kf) per[k] = kf; }
  const firstYm = Object.values(per).map((kf) => kf.obs[0].ym).sort()[0];
  const ms = MONTHS.filter((ym) => ym >= firstYm);
  aggPrimary.splice(1, Infinity, ...ms.map((ym, i) => {
    const last = i === ms.length - 1, o = { ym, x: last ? dx(LATEST_ISO) : mx(ym), ci: {} };
    for (const k of PRIMARY_KEYS) {
      const kf = per[k];
      if (!kf || ym < kf.obs[0].ym) { o[k] = null; continue; }
      const p = kfAt(kf, last ? KF_T1 : Math.max(kf.t0, kfDay(ymMidMs(ym))));
      o[k] = r1(p.mu); o.ci[k] = r1(1.96 * p.sd);
    }
    return o;
  }));
}

/* ---- 3. alt head-to-head 2PP (ALP v ON, L/NP v ON) --------------------- */
/* The ON head-to-heads are published figures, so they get the same weighted,
   debiased treatment as the classic 2PP WHEREVER it's estimable. It is for
   ALP v ON (40 polls, 9 houses); it is not for L/NP v ON (5 polls, 2 houses –
   no reading has 3 neighbours, so houseEffectsFor finds nothing estimable and
   no poll falls in the nowcast window). That series therefore stays an honest
   plain mean and reports no nowcast, rather than pretending to a precision
   it can't support. */
const POLL_BY_KEY = new Map(POLLS.map((p) => [p.date + "|" + p.pollster, p]));
function altRowsFor(field) {
  const out = [];
  for (const [key, v] of ALT_BY.entries()) {
    if (v[field] == null) continue;
    const p = POLL_BY_KEY.get(key);
    if (noAggPoll(p || { pollster: key.split("|")[1] })) continue;
    const date = key.split("|")[0];
    out.push({ ym: ymOf(date), mid: p ? midMs(p) : new Date(date).getTime(),
               x: v[field], n: rowN(p), firm: key.split("|")[1], key });
  }
  return out;
}
function altSeries(field) {
  const rows = altRowsFor(field);
  const he = houseEffectsFor(rows);
  const adjusted = he.estimable;
  /* Only the adjusted branch carries an interval, for the same reason it is
     the only branch that gets a trend line at all: a series too thin to
     debias is too thin to say how well it is known. */
  const monthly = adjusted
    ? monthlyAdj(rows, he).map((d) => {
        const r = monthWithSe(rows, he, d.ym);
        return { ym: d.ym, x: d.x, a: r1(d.v), b: r1(100 - d.v), ci95: r1(1.96 * r.se), k: r.n };
      })
    : MONTHS.map((ym) => {
        const rs = rows.filter((r) => r.ym === ym);
        if (!rs.length) return null;
        const v = mean(rs.map((r) => r.x));
        return { ym, x: mx(ym), a: r1(v), b: r1(100 - v) };
      }).filter(Boolean);
  return { monthly, rows, he, adjusted };
}
const altAON = altSeries("ao"), altLON = altSeries("lo");
const alt2pp = { alp_on: altAON.monthly, lnp_on: altLON.monthly };

/* Moved down from §1e: it now also reads altAON.he, the published
   ALP-v-ON estimator, which is not built until the line above. */
/* houseLean reads the SAME estimators as time series – each firm's decayed
   lean sampled at every month's midpoint from the month its first evidence
   poll lands, so the House-lean chart under Poll disagreement draws how a
   house's lean has walked, not just where it stands. Keyed by measure –
   the 2PP plus the five primaries (ALP / L/NP / ON since the panel began;
   the GRN and OTH read-offs joined 2026-10-02 for the panel's wide-screen
   tabs; lives after primaryHE exists). A firm under 3 evidence
   polls on a measure is absent from that measure's map, never drawn flat. */

/* ---- 2t. the two-party figures on the model (federal) ---------------------
   (user ask 2026-11-23: "the implied 2PP from the model's draws through the
   flow table; the published 2PP with its own leans; replace the three-week
   window".)
   IMPLIED. Each of the primary model's draws read through the flow table.
   Labor's share after preferences is linear in the five shares, so the
   implied 2PP's draws are the primaries' draws mapped one by one: its
   interval, its month-on-month change (the joint draws of the two days),
   each house's lean (its leans on the primaries, mapped the same way), each
   poll's yardstick and footprint all come out of the one model, with no
   second fit and no window. The same for Labor v One Nation through the
   ALP-v-ON table, whose own range (FP_ON_BAND) no poll can narrow and is
   still added to its margin; and for the 2022 One Nation flow, the
   sensitivity band's other edge.
   PUBLISHED. The houses' own two-party figures measure something else:
   each house allocates preferences its own way. They get the same model
   with two categories, Labor and the Coalition: each pollster's drifting
   lean on its published figure, the regular pollsters averaging zero, a
   damped trend, the leader changes, the term opening on the counted 2PP
   moved by the polls' average miss at the elections 2007–2025 (TPP_MISS:
   Labor +0.8 ± 1.9 points, the vote history's implied 2PP misses).
   Every two-party figure the page prints reads these: the headline, the
   monthly lines, the change tests, the leans, each poll's yardstick and
   footprint, the working table and the rival ruling. The three-week window
   remains /vic/'s fallback and the archived recipe. */
const TPP_MISS = [0.83, 1.86];
/* the primary model's draws, summarised once for the linear reads (tppRead,
   primary-model.mjs): each printed day's mean shares and their covariance,
   the month-on-month pair's, each house's lean today, its lean at each
   month (at the settings' mode), each poll's leave-one-out vectors, and the
   line through every day the smoother kept. Shipped as D.tppLin, so the
   flow editor reads a reader's own table through the same numbers */
const R6 = (v) => Math.round(v * 1e6) / 1e6;
const tppLin = PRIMM ? (() => {
  const { fit, months, t0, t1 } = PRIMM, P = PM_PARTIES.length;
  const vecR = (v) => Array.from(v, R6);
  const mc = (draws) => {
    const n = draws.length / P, m = new Array(P).fill(0);
    for (let i = 0; i < n; i++) for (let q = 0; q < P; q++) m[q] += draws[i * P + q] / n;
    const C = [];
    for (let a = 0; a < P; a++) for (let b = a; b < P; b++) {
      let t = 0; for (let i = 0; i < n; i++) t += (draws[i * P + a] - m[a]) * (draws[i * P + b] - m[b]);
      C.push(+(t / (n - 1)).toPrecision(6));
    }
    return [m.map(R6), C];
  };
  const daysAll = [...new Set([...months.map((m) => m.day), t1, t1 - 30])];
  const yard = {};
  for (const r of PRIMM.readings) { const f = fit.influence(r.idx); if (f) yard[r.key] = [vecR(f.level), f.he ? vecR(f.he) : null, vecR(f.dNow)]; }
  const iso = (d) => new Date(d * 86400000).toISOString().slice(0, 10);
  return {
    n: PRIMM.readings.length, t0, t1, prev: t1 - 30, months: months.map((m) => [m.ym, m.day]),
    days: Object.fromEntries(daysAll.map((d) => [d, mc(fit.shares(d))])),
    pair: mc(fit.pair(t1, t1 - 30)),
    lean: Object.fromEntries(fit.L.houses.filter((h) => fit.lean(h)).map((h) => [h, mc(fit.lean(h))])),
    leanM: Object.fromEntries(fit.L.houses.map((h) => [h, (PRIMM.leanMonths[h] || []).map((l) => (l ? vecR(l) : null))])),
    cnt: fit.cnt, houses: fit.L.houses, lone: [...fit.L.lone], yard,
    line: fit.events.filter((d) => d > t0 && d <= t1).map((d) => { const l = fit.levelAt(d); return l ? [iso(d), vecR(l)] : null; }).filter(Boolean),
  };
})() : null;
const TPM = PRIMM ? (() => {
  const T0 = Date.now();
  const { months, t0, t1 } = PRIMM;
  const vec = (o) => PM_PARTIES.map((k) => o[k] ?? 0);
  const F_IMP = vec({ alp: 1, grn: FLOW.grn, onp: FLOW.onp, oth: FLOW.oth });
  const F_22 = vec({ alp: 1, grn: FLOW.grn, onp: ONP_FLOW_2022, oth: FLOW.oth });
  const F_ON = vec({ alp: 1, lnp: FP_ON.lnp, grn: FP_ON.grn, oth: FP_ON.oth });
  const BAND = vec({ lnp: FP_ON_BAND.lnp, grn: FP_ON_BAND.grn, oth: FP_ON_BAND.oth });
  const CNR = JUR ? (JUR.flows.threeCorner || 0) : FLOW_3CNR;
  const imp = tppRead(tppLin, F_IMP, CNR), on = tppRead(tppLin, F_ON, 0), s22 = tppRead(tppLin, F_22, CNR);
  const gap = tppRead(tppLin, F_IMP.map((v, q) => v - F_ON[q]), CNR);   // implied v Coalition less v One Nation
  const prim = tppRead(tppLin, vec({ onp: 1, lnp: -1 }), 0);                 // One Nation's primary less the Coalition's
  /* the ALP-v-ON table's own range at the shares (linear, points) */
  const cf = new Map(Object.keys(tppLin.days).map((d) => [+d, imp.band(+d, BAND)]));
  const daysAll = [...new Set([...months.map((m) => m.day), t1, t1 - 30])];
  const sm = (c) => { const lo = pmQuant(c, 0.025), hi = pmQuant(c, 0.975); return { v: pmMean(c), lo, hi, ci: (hi - lo) / 2, sd: (hi - lo) / 3.92 }; };
  const sig = (c) => ({ chg: c.v, lo: c.lo, hi: c.hi, sd: c.sd, ci: c.ci, sig: c.lo > 0 || c.hi < 0 });
  /* the nearest day the smoother kept (an event: a poll, a printed day) */
  const nearEv = (evs, d) => { let lo = 0, hi = evs.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (evs[m] <= d) lo = m; else hi = m; } return Math.abs(evs[lo] - d) <= Math.abs(evs[hi] - d) ? evs[lo] : evs[hi]; };
  /* the published classic pair: its own two-category fit */
  const pubRs = [];
  tppRows.forEach((r, i) => {
    const p = POLL_BY_KEY.get(r.key);
    if (!p || !(r.x > 0 && r.x < 100)) return;
    const s0 = pmDay(p.dateStart || p.date), e0 = pmDay(p.date);
    pubRs.push({ key: r.key, house: r.firm, idx: i, start: s0, end: e0, day: Math.round((s0 + e0) / 2), n: r.n / HL_DEFF,
      cats: [[0], [1]], vals: [r.x, 100 - r.x], full: true, step: pmStep([p.tpp_alp]), pub: p.published ? pmDay(p.published) : e0 });
  });
  pubRs.sort((a, b) => a.day - b.day || a.idx - b.idx);
  const a0 = (ELECTION.tpp_alp + TPP_MISS[0]) / 100, sdl = (TPP_MISS[1] / 100) * (1 / a0 + 1 / (1 - a0));
  const pf = pubRs.length >= 2 ? fitPrimary(pubRs, { t0, t1, anchor: { mean: Float64Array.from([Math.log(a0 / (1 - a0))]), cov: Float64Array.from([sdl * sdl]) },
    jumps: new Set(PRIM_JUMPS.map(pmDay)), parties: ["alp", "lnp"], days: daysAll, pairs: [[t1, t1 - 30]], trend: true,
    nDraw: +(process.env.PRIM_NDRAW || 2000), seed: 20261125, minCore: 4 }) : null;
  const pub = pf && (() => {
    const lin2 = (draws, withC) => { const n = draws.length / 2, o = new Float64Array(n); for (let i = 0; i < n; i++) o[i] = 100 * draws[i * 2]; return o; };
    const at = new Map(daysAll.map((d) => [d, sm(lin2(pf.shares(d)))]));
    const pinf = new Map(pubRs.map((r) => [r.key, pf.influence(r.idx)]).filter(([, f]) => f));
    return {
      months: months.map(({ ym, day }) => ({ ym, day, ...at.get(day) })), now: at.get(t1), prev: at.get(t1 - 30),
      chg: sig(sm(lin2(pf.pair(t1, t1 - 30)))), fit: pf,
      lean: (h) => { const d = pf.lean(h); return d ? sm(lin2(d)) : null; },
      leanMonths: (h) => pf.leanPath(h, months.map((m) => m.day)).map((l) => (l ? 100 * l[0] : null)),
      leanAt: (h, day) => { const l = pf.leanPath(h, [nearEv(pf.events, day)])[0]; return l ? 100 * l[0] : null; },
      yard: (key) => { const f = pinf.get(key); return f ? { v: 100 * f.level[0], he: f.he ? 100 * f.he[0] : null, dNow: 100 * f.dNow[0] } : null; },
      levelAt: (day) => { const l = pf.levelAt(nearEv(pf.events, day)); return l ? 100 * l[0] : null; },
      line: () => pf.events.filter((d) => d > t0 && d <= t1).map((d) => { const l = pf.levelAt(d); return l ? [new Date(d * 86400000).toISOString().slice(0, 10), r1(100 * l[0])] : null; }).filter(Boolean),
      houses: pf.L.houses, lone: pf.L.lone, cnt: pf.cnt, keys: new Set(pubRs.map((r) => r.key)), n: pubRs.length,
      kappa: Object.fromEntries([...pf.settings.kappa].filter(([h]) => !pf.L.lone.has(h))),
      ess: pf.ctx.laplace ? pf.ctx.laplace.ess : null, M: pf.settings.comps.length,
    };
  })();
  const out = { imp, on, s22, gap, prim, cf, pub };
  console.log(`two-party model: implied ${r1(imp.now.v)} ±${r1(imp.now.ci)} (month ${imp.chg.chg >= 0 ? "+" : ""}${r1(imp.chg.chg)}, ${imp.chg.sig ? "significant" : "within the margin"}),`
    + ` ALP v ON ${r1(on.now.v)} ±${r1(on.now.ci)} + table ±${r1(cf.get(t1))}`
    + (pub ? `, published ${r1(pub.now.v)} ±${r1(pub.now.ci)} from ${pub.n} polls (ESS ${pub.ess ? pub.ess.toFixed(1) : "-"} of ${pub.M}; κ ${JSON.stringify(pub.kappa)})` : ", published: too few")
    + ` in ${((Date.now() - T0) / 1000).toFixed(1)}s`);
  return out;
})() : null;
/* a model lean in the house-effect interface the two-party consumers take
   (he.at(firm, ms), he.snapshot(), evidence maps for the leans panel) */
const tpmHe = (m) => {
  if (!m) return null;
  const cache = new Map();
  const at = (firm, t) => {
    if (!m.houses.includes(firm) || m.lone.has(firm)) return 0;
    const d = Math.min(PRIMM.t1, Math.max(PRIMM.t0 + 1, Math.round(t / 86400000)));
    const k = firm + "|" + d;
    if (!cache.has(k)) { const v = m.leanAt(firm, d); cache.set(k, v == null ? 0 : v); }
    return cache.get(k);
  };
  const snapshot = () => Object.fromEntries(m.houses.filter((h) => !m.lone.has(h)).map((h) => { const l = m.lean(h); return [h, { v: l ? r1(l.v) : 0, n: m.cnt[h] }]; }));
  return { at, snapshot, model: true };
};
const houseEffectM = TPM && TPM.pub ? tpmHe(TPM.pub) : houseEffect;
const synthEffectM = TPM ? tpmHe(TPM.imp) : synthEffect;
const synthOnEffectM = TPM ? tpmHe(TPM.on) : synthOnEffect;
if (TPM) {
  const kOf = (rows, ym) => rows.filter((r) => r.ym === ym).length;
  agg2ppSynth.splice(1, Infinity, ...TPM.imp.months.map((m) => ({ ym: m.ym, x: mx(m.ym), alp: r1(m.v), lnp: r1(100 - m.v), ci95: r1(m.ci), k: kOf(tppRowsSynth, m.ym) })));
  if (TPM.pub) agg2pp.splice(1, Infinity, ...TPM.pub.months.map((m) => ({ ym: m.ym, x: mx(m.ym), alp: r1(m.v), lnp: r1(100 - m.v), ci95: r1(m.ci), k: kOf(tppRows, m.ym) })));
  agg2ppSynthOn.splice(0, Infinity, ...TPM.on.months.map((m) => ({ ym: m.ym, x: mx(m.ym), a: r1(m.v), b: r1(100 - m.v), ...onMargin(m.ci, TPM.cf.get(m.day)), k: kOf(tppRowsSynthOn, m.ym) })));
  if (synthBand) synthBand.splice(1, Infinity, ...TPM.imp.months.map((m, i) => {
    const e = TPM.s22.months[i];
    return { ym: m.ym, x: mx(m.ym), lo: r1(Math.min(m.v, e.v)), hi: r1(Math.max(m.v, e.v)) };
  }));
}
/* "imp" is synthEffect, and it is here because the site's DEFAULT two-party
   figure is the implied one, which subtracts synthEffect and not houseEffect.
   The panel used to draw only the published-2PP lean while telling the reader
   it was "the same house effect the aggregates subtract" — true until the
   default basis moved under it. A house's two 2PP leans are genuinely
   different quantities (Roy Morgan runs +1.6 on its published figure and
   -0.6/-1.7 on the ALP/ON primaries that drive its implied one), so both are
   emitted and the panel names which is which. */
/* A house leaves the leans panel when its newest measurable poll is ≈3.5
   months old, and re-enters when it next polls: a lean that stale is
   history, not a reading of how the house currently runs (the estimate
   itself already decays toward zero on the HE_HALF clock; this drops the
   series entirely). The clock is the dataset's newest poll (LATEST_ISO),
   the same "now" the aggregates read at. */
const LEAN_STALE_DAYS = 107;
const houseLean = Object.fromEntries([
  ["imp", synthEffect], ["tpp", houseEffect],
  /* The panel offers the SAME two bases on the other Labor contest. A house's
     lean on ALP-v-ON is its own quantity — the pairing is carried by the One
     Nation primary, where a house can sit two points off the field while
     sitting on it for the 2PP — and the published version measures its own
     private allocation of a flow nobody has ever counted. Both estimators
     already existed: synthOnEffect from §1d, and altSeries("ao")'s he, which
     that function has always returned and nothing read. */
  ["onimp", synthOnEffect], ["onpub", altAON.he],
  ["alp", primaryHE.alp], ["lnp", primaryHE.lnp], ["onp", primaryHE.onp],
  ["grn", primaryHE.grn], ["oth", primaryHE.oth]]
  .map(([k, he]) => [k, Object.fromEntries(Object.entries(he.evidenceN)
    .filter(([firm, n]) => n >= 3 && ddays(Date.parse(LATEST_ISO), he.evidenceLast[firm]) < LEAN_STALE_DAYS)
    .map(([firm]) => [
      firm,
      MONTHS.filter((ym) => ymMidMs(ym) >= he.evidenceFrom[firm])
        .map((ym) => ({ ym, v: r1(he.at(firm, ymMidMs(ym))) })),
    ]))]),
);
/* federal: the two-party leans from the model (§2t) – the implied ones the
   primaries' leans read through each table, the published one its own fit's -
   at each month's middle, from the month of the house's first poll on that
   measure this term; the same staleness rule */
if (TPM) {
  const lastBy = (rows) => { const o = new Map(); for (const r of rows) { const d = Math.round(r.mid / 86400000); const q = o.get(r.firm) || { n: 0, first: d, last: d }; q.n++; q.first = Math.min(q.first, d); q.last = Math.max(q.last, d); o.set(r.firm, q); } return o; };
  const put = (key, m, rows) => {
    if (!m) return;
    const by = lastBy(rows);
    houseLean[key] = Object.fromEntries(m.houses.filter((h) => !m.lone.has(h) && by.has(h) && by.get(h).n >= 3 && PRIMM.t1 - by.get(h).last < LEAN_STALE_DAYS)
      .map((h) => { const lm = m.leanMonths(h); return [h, PRIMM.months.map((mm, i) => ({ ym: mm.ym, v: lm[i] }))
        .filter((o, i) => o.v != null && pmDay(PRIMM.months[i].ym + "-28") >= by.get(h).first).map((o) => ({ ym: o.ym, v: r1(o.v) }))]; }));
  };
  put("imp", TPM.imp, tppRowsSynth); put("onimp", TPM.on, tppRowsSynthOn); put("tpp", TPM.pub, tppRows);
}
/* federal: each house's lean on each primary from the model – the smoothed
   lean at each month's middle (settings at their mode), from the month its
   first poll this term falls in; the same staleness rule */
if (PRIMM) {
  const days = new Map();
  for (const r of PRIMM.readings) (days.get(r.house) || days.set(r.house, []).get(r.house)).push(r.day);
  PRIMARY_KEYS.forEach((k, q) => {
    houseLean[k] = Object.fromEntries(PRIMM.fit.L.houses
      .filter((h) => (days.get(h) || []).length >= 3 && PRIMM.t1 - Math.max(...days.get(h)) < LEAN_STALE_DAYS)
      .map((h) => {
        const first = Math.min(...days.get(h));
        return [h, PRIMM.months.map((m, i) => ({ m, l: PRIMM.leanMonths[h][i] }))
          .filter(({ m, l }) => l && pmDay(m.ym + "-28") >= first)
          .map(({ m, l }) => ({ ym: m.ym, v: r1(100 * l[q]) }))];
      }));
  });
}

/* ---- 3b. each poll's footprint on the aggregates (leave-one-out) ---------
   The expanded tables answer "how much did THIS poll move the figure the
   reader sees up top?": the aggregate WITHOUT the poll, paired with the
   aggregate as it stands. House effects are NOT re-estimated inside the
   leave-one-out – a lean is a property of the whole cross-house consensus
   and the headline itself only relearns one slowly; what moves when one wave
   drops out is the weighting of the numbers it sat beside.
   Payload key `eff`, per poll, series key → { lo, hi, w[, m] }:
     lo  – the aggregate recomputed without this poll (ALP share, 0.1)
     hi  – the standing aggregate, identically rounded (so hi−lo is the move)
     w   – the poll sits inside the aggregation's window: without it, a zero
           move reads "before the window", not "no pull"
     t   – ONLY when w is 0: the same leave-one-out re-run at the poll's own
           publication day, so a wave that has since fallen out of the window
           can still say what it did when it was in one. Everything else is
           held identical - same rows, same house-effect curve, just read at
           `ref = this poll's date` instead of at the newest poll's, which is
           all `nowcastAdj` needs to see the window that closed on it
     m   – the ALP-v-ON line was measured against its MONTHLY mean (the
           series is too thin to nowcast), so w speaks about that month
   Series: `lnp` for a poll with a published classic pair; `imp` for every
   implied-eligible poll – a paired wave's primaries still pull the implied
   aggregate, which is the headline's default basis and is now reported
   beside the published-pair move; `onimp`, the same leave-one-out on the
   ALP-v-ON modelled-flow series; and `onp` additionally wherever the wave
   printed an ALP-v-ON head-to-head.
   Keys are absent (not null) wherever the poll has no row in that series. An
   empty 21-day window for the classic/implied nowcast emits nothing rather
   than mixing bases against the monthly-fallback the headline would show. */
const FOOTPRINT_THIN = 3, footprintThin = new Set(); // see the footprint guard below
const effByKey = (() => {
  /* federal (§2t): every poll is in the model (w 1); its footprint is
     today's figure without it, through the smoother (the primary model's
     for the implied pairs, the published fit's for the published pair) */
  if (TPM) {
    const out = new Map();
    const has = { lnp: new Set(tppRows.map((r) => r.key)), imp: new Set(tppRowsSynth.map((r) => r.key)), onimp: new Set(tppRowsSynthOn.map((r) => r.key)) };
    const series = [["lnp", TPM.pub, TPM.pub && TPM.pub.now], ["imp", TPM.imp, TPM.imp.now], ["onimp", TPM.on, TPM.on.now]].filter(([, m]) => m);
    for (const p of POLLS) {
      if (noAggPoll(p)) continue;
      const key = p.date + "|" + p.pollster, eff = {};
      for (const [k, m, now] of series) {
        if (!has[k].has(key)) continue;
        const y = m.yard(key);
        if (!y) continue;
        eff[k] = { lo: r1(now.v - y.dNow), hi: r1(now.v), w: 1 };
      }
      if (Object.keys(eff).length) out.set(key, eff);
    }
    return out;
  }
  /* /vic/: every poll sits in the trend (w is always 1), so its footprint
     is today's trend without it, rerun through the filter */
  if (KF) {
    const out = new Map();
    const series = [["lnp", KF_NOW.tpp], ["imp", KF_NOW.imp], ["onimp", KF_NOW.on]].filter(([, kf]) => kf);
    for (const p of POLLS) {
      if (noAggPoll(p)) continue;
      const key = p.date + "|" + p.pollster, eff = {};
      for (const [k, kf] of series) {
        if (!kf.obs.some((o) => o.key === key)) continue;
        const lo = kalmanRun(kf.obs.filter((o) => o.key !== key), { ...kf.opts, smooth: false }).final.mu;
        eff[k] = { lo: r1(lo), hi: r1(kf.final.mu), w: 1 };
      }
      if (Object.keys(eff).length) out.set(key, eff);
    }
    return out;
  }
  const ref = new Date(LATEST_ISO).getTime();
  const cur2pp = nowcastAdj(tppRows, houseEffect, ref);
  const curSynth = nowcastAdj(tppRowsSynth, synthEffect, ref);
  const synthKeys = new Set(tppRowsSynth.map((r) => r.key));
  const curSynthOn = nowcastAdj(tppRowsSynthOn, synthOnEffect, ref);
  const synthOnKeys = new Set(tppRowsSynthOn.map((r) => r.key));
  const inWin = (rows, key) => rows.some((r) => r.key === key
    && ddays(ref, r.mid) >= 0 && ddays(ref, r.mid) <= HL_WINDOW);
  /* how many OTHER waves the window holds beside `key`: with fewer than
     FOOTPRINT_THIN, one wave can honestly move a sparse series (the ALP-v-ON
     head-to-head) by more than the guard below allows */
  const others = (rows, key) => rows.filter((r) => r.key !== key
    && ddays(ref, r.mid) >= 0 && ddays(ref, r.mid) <= HL_WINDOW).length;
  const loo = (rows, he, key) => { const r = nowcastAdj(rows.filter((q) => q.key !== key), he, ref); return r ? r.v : null; };
  /* The same pair read at the poll's OWN day. nowcastAdj already drops rows
     with ddays < 0, so passing that day restricts the window to the polls
     that existed then - no separate filtering, and no risk of the two halves
     disagreeing about which rows are in scope. Null when the wave cannot be
     estimated on its own day (a lone poll leaves nothing to compare). */
  const thenPair = (rows, he, key, iso) => {
    const at = new Date(iso).getTime();
    const hi = nowcastAdj(rows, he, at);
    const lo = nowcastAdj(rows.filter((q) => q.key !== key), he, at);
    return hi && lo ? { lo: r1(lo.v), hi: r1(hi.v) } : null;
  };
  /* the ON matchup's CURRENT basis, mirroring altNowcast's gate: a nowcast
     where the series supports one, else the last monthly point it draws */
  const onpNow = altAON.adjusted ? nowcastAdj(altAON.rows, altAON.he, ref) : null;
  const onpMonth = alt2pp.alp_on.length ? alt2pp.alp_on[alt2pp.alp_on.length - 1] : null;
  const out = new Map();
  for (const p of POLLS) {
    if (noAggPoll(p)) continue;
    const key = p.date + "|" + p.pollster;
    const eff = {};
    if (p.tpp_alp != null && cur2pp) {
      const lo = loo(tppRows, houseEffect, key);
      if (lo != null) {
        eff.lnp = { lo: r1(lo), hi: r1(cur2pp.v), w: inWin(tppRows, key) ? 1 : 0 };
        if (!eff.lnp.w) { const t = thenPair(tppRows, houseEffect, key, p.date); if (t) eff.lnp.t = t; }
      }
    }
    /* not an `else`: a paired wave's primaries sit in the implied series too,
       so it moves BOTH aggregates and the row reports each move on its own
       basis (implied is the headline default) */
    if (synthKeys.has(key) && curSynth) {
      const lo = loo(tppRowsSynth, synthEffect, key);
      if (lo != null) {
        eff.imp = { lo: r1(lo), hi: r1(curSynth.v), w: inWin(tppRowsSynth, key) ? 1 : 0 };
        if (!eff.imp.w) { const t = thenPair(tppRowsSynth, synthEffect, key, p.date); if (t) eff.imp.t = t; }
      }
    }
    /* the ALP-v-ON pairing's implied series takes the same waves (impOk is
       its gate too), so every wave above also moves THAT aggregate */
    if (synthOnKeys.has(key) && curSynthOn) {
      const lo = loo(tppRowsSynthOn, synthOnEffect, key);
      if (lo != null) {
        eff.onimp = { lo: r1(lo), hi: r1(curSynthOn.v), w: inWin(tppRowsSynthOn, key) ? 1 : 0 };
        if (!eff.onimp.w) { const t = thenPair(tppRowsSynthOn, synthOnEffect, key, p.date); if (t) eff.onimp.t = t; }
      }
    }
    const ao = ALT_BY.get(key) && ALT_BY.get(key).ao;
    if (ao != null) {
      if (onpNow) {
        const r = nowcastAdj(altAON.rows.filter((q) => q.key !== key), altAON.he, ref);
        if (r) {
          eff.onp = { lo: r1(r.v), hi: r1(onpNow.v), w: inWin(altAON.rows, key) ? 1 : 0 };
          if (!eff.onp.w) { const t = thenPair(altAON.rows, altAON.he, key, p.date); if (t) eff.onp.t = t; }
        }
      } else if (onpMonth) {
        const rest = altAON.rows.filter((q) => q.key !== key && q.ym === onpMonth.ym);
        const est = altAON.adjusted ? monthWithSe(rest, altAON.he, onpMonth.ym) : null;
        const lo = est ? est.v : (rest.length ? mean(rest.map((q) => q.x)) : null);
        if (lo != null) eff.onp = { lo: r1(lo), hi: r1(onpMonth.a), w: inWin(altAON.rows, key) ? 1 : 0, m: 1 };
      }
    }
    const basisRows = { lnp: tppRows, imp: tppRowsSynth, onimp: tppRowsSynthOn, onp: altAON.rows };
    for (const b of Object.keys(eff)) {
      const n = eff[b].m ? altAON.rows.filter((q) => q.key !== key && q.ym === onpMonth.ym).length : others(basisRows[b], key);
      if (n < FOOTPRINT_THIN) footprintThin.add(key + "|" + b);
    }
    if (Object.keys(eff).length) out.set(key, eff);
  }
  return out;
})();
/* guard the estimator's own arithmetic: one wave may lean a weighted
   aggregate a point or so (the window carries ~ten), anything past that is a
   bug in this file, not data – measured moves run ±0.1–1pp */
for (const [k, eff] of effByKey) {
  for (const [b, e] of Object.entries(eff)) {
    if (!Number.isFinite(e.lo) || !Number.isFinite(e.hi))
      throw new Error(`poll footprint not finite (${k} ${b}): ${JSON.stringify(e)}`);
    // a thin window's big move is data, not arithmetic (2026-10-21: YouGov's
    // 20 Oct 50-50 ALP-v-ON against 53-55 readings moved the head-to-head
    // 4.8pp once the window held little else, and the build threw)
    if (Math.abs(e.hi - e.lo) > 4 && !footprintThin.has(k + "|" + b))
      throw new Error(`poll footprint out of range (${k} ${b}): ${JSON.stringify(e)}`);
  }
}

/* ---- 3c. each poll against the polls around it ---------------------------
   What an opened poll's "How it counts" holds it against, and the line its
   chart draws. It used to be the calendar month's average of the month the
   fieldwork ENDED in, which (a) early in a month rests on one or two polls -
   on 6 Oct 2026 October's was RedBridge's 2 Oct wave alone, so that wave was
   compared with itself and its "lean" was its own house lean back - and
   (b) put a wave fielded across a month's end against the wrong month.
   Now it is the headline's own estimator (sample weights, recency weights
   with the taper, sqrt(m) repeat deflation, each house's lean as of the
   day) read AT the wave's fieldwork midpoint with the window open both
   ways, so a past wave meets the polls either side of it and the newest
   meets the polls before it - at the latest poll the line is exactly the
   headline nowcast, so the chart ends on today's figure.
     yd[k]: { v, he, n } - v the estimate from the OTHER polls (the wave
            left out, as §3b's footprint leaves it out), he this house's lean
            at the midpoint (what the aggregate takes out of the wave), n how
            many other polls v rests on. Absent where none sits in the window.
     yardLine[k]: [[iso, v], ...] every 4 days plus the newest poll's day,
            every poll in; v null where the window holds none.
   /vic/ (KF): the trend is the Kalman smoother's path, so v is the path
   rerun without the wave and the line the path itself; he the filter's lean. */
const YARD_STEP = 4;
/* a patch keeps only the stretch where leaving the wave out changes the
   line as printed (one decimal) - its ends usually don't */
const trimPatch = (p, line) => {
  if (!p) return null;
  const same = (j) => p.v[j] === line[p.i + j][1];
  let a = 0, b = p.v.length - 1;
  while (a <= b && same(a)) a++;
  while (b >= a && same(b)) b--;
  return a > b ? null : { i: p.i + a, v: p.v.slice(a, b + 1) };
};
function aroundPts(rows, he, ref, skip, k = HEADLINE_K) {
  const pts = [], waves = new Map();
  for (const a of rows) {
    if (skip && a.key === skip) continue;
    const d = Math.abs(ddays(ref, a.mid));
    if (d > k.window) continue;
    waves.set(a.firm, (waves.get(a.firm) || 0) + 1);
    pts.push({ w: (a.w0 ?? a.n) * k.weight(d), x: a.x - heV(he, a.firm, ref), n: a.n, firm: a.firm, ...(a.pq != null ? { pq: a.pq } : {}) });
  }
  for (const p of pts) p.w /= Math.sqrt(waves.get(p.firm));
  return pts;
}
function yardSeries(rows, he, kf, bare = false) {
  const at = new Map();                          // key -> { v, he, n, p }
  const DAY = 86400000, isoOf = (d) => new Date(d * DAY).toISOString().slice(0, 10);
  /* the grid: whole days, every YARD_STEP from the first poll, and the
     newest poll's day; the line is the estimate at each */
  const grid = (d0) => { const g = []; for (let d = d0; d < KF_T1; d += YARD_STEP) g.push(d); g.push(KF_T1); return g; };
  /* p: the stretch of line this wave sits in, redrawn WITHOUT it - the grid
     points within the window either side ({ i: first index, v: [...] }) - so
     the opened poll's chart draws the line its comparison was made against
     and the gap a reader sees is the gap the sentence states */
  const patch = (g, valAt, mid, win) => {
    const idx = g.map((d, i) => (Math.abs(d * DAY - mid) <= win * DAY ? i : -1)).filter((i) => i >= 0);
    return idx.length ? { i: idx[0], v: idx.map((i) => { const v = valAt(g[i]); return v == null ? null : r1(v); }) } : null;
  };
  if (kf) {
    const day = (ms) => Math.min(KF_T1, kfDay(ms));
    const pathAt = (run, d) => (d >= KF_T1 ? run.final.mu : run.path[Math.max(0, d - kf.t0)].mu);
    const g = grid(kf.t0 + 1);
    for (const r of rows) {
      const o = kf.obs.find((q) => q.key === r.key);
      if (!o) continue;
      const rest = kf.obs.filter((q) => q !== o);
      if (!rest.length) continue;
      const run = kalmanRun(rest, { ...kf.opts, smooth: true });
      /* a wave reaches the whole smoothed path, but past ~two months either
         side its pull is under a hundredth of a point */
      at.set(r.key, { v: r2(pathAt(run, day(r.mid))), he: r2(kf.leans[r.firm] || 0), n: rest.length,
                      ...(bare ? {} : { p: patch(g, (d) => pathAt(run, d), r.mid, 60) }) });
    }
    const line = bare ? [] : g.map((d) => [isoOf(d), r1(kfAt(kf, d).mu)]);
    for (const y of at.values()) { const t = trimPatch(y.p, line); if (t) y.p = t; else delete y.p; }
    return { at, line, member: new Set(kf.obs.map((o) => o.key)), outside: (mid, firm) => ({ v: r2(kfAt(kf, day(mid)).mu), he: kf.leans[firm] != null ? r2(kf.leans[firm]) : null, n: kf.obs.length }) };
  }
  if (!rows.length) return { at, line: [], member: new Set(), outside: () => null };
  const g = grid(Math.floor(Math.min(...rows.map((r) => r.mid)) / DAY));
  const est = (t, skip) => { const e = weightedWithSe(aroundPts(rows, he, t, skip)); return e ? e.v : null; };
  for (const r of rows) {
    const e = weightedWithSe(aroundPts(rows, he, r.mid, r.key));
    if (e) at.set(r.key, { v: r2(e.v), he: r2(heV(he, r.firm, r.mid)), n: e.n,
                           ...(bare ? {} : { p: patch(g, (d) => est(Math.min(d * DAY, refNow), r.key), r.mid, HEADLINE_K.window) }) });
  }
  const line = bare ? [] : g.map((d) => { const v = est(Math.min(d * DAY, refNow), null); return [isoOf(d), v == null ? null : r1(v)]; });
  for (const y of at.values()) { const t = trimPatch(y.p, line); if (t) y.p = t; else delete y.p; }
  /* a wave the series never took - an SMS poll (NO_AGG_HOUSES), or one whose
     primaries show rebased under a documented anomaly but stay out of the
     implied aggregate - still meets the polls around it, all of them in;
     he is its house's lean where the series measured one, else null */
  const outside = (mid, firm) => {
    const e = weightedWithSe(aroundPts(rows, he, mid, null));
    const hv = he && he.evidenceN && he.evidenceN[firm] != null ? r2(heV(he, firm, mid)) : null;
    return e ? { v: r2(e.v), he: hv, n: e.n } : null;
  };
  return { at, line, member: new Set(rows.map((r) => r.key)), outside };
}
/* federal (§2t): the yardstick is the model's line at the wave's fieldwork
   estimated without it (rank-one leave-one-out), he the house's lean then,
   the line the model's own through every poll */
function yardModel(rows, m) {
  const at = new Map();
  for (const r of rows) {
    const y = m.yard(r.key);
    if (y) at.set(r.key, { v: r2(y.v), he: y.he == null ? null : r2(y.he), n: m.keys.size - 1 });
  }
  const dayOf = (mid) => Math.min(PRIMM.t1, Math.max(PRIMM.t0 + 1, Math.round(mid / 86400000)));
  return { at, line: m.line(), member: new Set(rows.filter((r) => at.has(r.key)).map((r) => r.key)),
    outside: (mid, firm) => {
      const d = dayOf(mid), v = m.levelAt(d) ?? (() => { const e = m.months.reduce((b, q) => (Math.abs(q.day - d) < Math.abs(b.day - d) ? q : b), m.months[0]); return e ? e.v : null; })();
      const he = m.houses.includes(firm) && !m.lone.has(firm) ? m.leanAt(firm, d) : null;
      return v == null ? null : { v: r2(v), he: he == null ? null : r2(he), n: m.keys.size };
    } };
}
const yardBy = {
  lnp: TPM && TPM.pub ? yardModel(tppRows, TPM.pub) : yardSeries(tppRows, houseEffect, KF ? KF_NOW.tpp : null),
  imp: TPM ? yardModel(tppRowsSynth, TPM.imp) : yardSeries(tppRowsSynth, synthEffect, KF ? KF_NOW.imp : null),
  onimp: TPM ? yardModel(tppRowsSynthOn, TPM.on) : yardSeries(tppRowsSynthOn, synthOnEffect, KF ? KF_NOW.on : null),
  onp: yardSeries(altAON.rows, altAON.adjusted ? altAON.he : null, null),
};
const yardLine = Object.fromEntries(Object.entries(yardBy).map(([k, s]) => [k, s.line]));
// which waves have a figure on each series (an SMS wave's yardstick is only
// worth carrying where it has a figure to hold against it)
const YARD_HAS = { lnp: (p) => p.tpp_alp != null, imp: (p) => impFields(p).alpImp != null, onimp: (p) => impFields(p).alpOnImp != null,
                   onp: (p) => !!(ALT_BY.get(p.date + "|" + p.pollster) || {}).ao };
const ydOf = (p) => {
  const key = p.date + "|" + p.pollster, o = {};
  for (const [k, s] of Object.entries(yardBy)) {
    // a member with no other poll in reach has nothing to be held against
    const y = s.at.has(key) ? s.at.get(key) : !s.member.has(key) && YARD_HAS[k](p) ? s.outside(midMs(p), p.pollster) : null;
    if (y) o[k] = y;
  }
  return Object.keys(o).length ? o : null;
};
// a two-party share outside 20-80 is arithmetic gone wrong, not data (a
// null lean is the model's one-off house: none measured, none taken out)
for (const [k, s] of Object.entries(yardBy)) {
  for (const [key, y] of s.at) {
    if (!Number.isFinite(y.v) || !(Number.isFinite(y.he) || y.he === null) || y.v < 20 || y.v > 80)
      throw new Error(`poll yardstick out of range (${k} ${key}): ${JSON.stringify(y)}`);
  }
}
/* The same for each party's primary, for the Primary tab's How it counts:
   the headline primary estimator (§7e's nowcast construction, each party on
   its own house effects) read at the wave's fieldwork midpoint, window open
   both ways, the wave left out. Compact, at the one decimal the rail prints
   (so its sums check down the column): pyd = { n, <party>: [v, he] } - v the
   other polls' estimate, he this house's lean on the party then (null where
   none is measured), n the most other polls any party's estimate rests on.
   No line or patch: that rail draws one strip per party, not a chart. A
   wave the aggregate never takes (an SMS poll) still meets the polls around
   it, all of them in, as ydOf's outsiders do. */
const primYardBy = PRIMM ? {} : Object.fromEntries(PRIMARY_KEYS.map((k) => [k, yardSeries(primaryRows[k], primaryHE[k], KF ? ((KF_NOW.primary || {})[k] || null) : null, true)]));
/* federal: the model's – the average pollster at the wave's fieldwork
   midpoint estimated without it (leave-one-out), and the house's lean then;
   n the other polls within four weeks either side. A wave the model never
   takes meets the line with every poll in. */
const pmYard = PRIMM ? (() => {
  const out = new Map();
  for (const r of PRIMM.readings) {
    const inf = PRIMM.fit.influence(r.idx);
    if (!inf) continue;
    const n = PRIMM.readings.filter((q) => q !== r && Math.abs(q.day - r.day) <= HE_WINDOW).length;
    out.set(r.key, { level: inf.level, he: inf.he, dNow: inf.dNow, n });
  }
  return out;
})() : null;
const pydOf = (p) => {
  if (PRIMM) {
    const key = p.date + "|" + p.pollster, y = pmYard.get(key), o = {};
    if (y) {
      PRIMARY_KEYS.forEach((k, q) => { if (primaryVal(p, k) != null) o[k] = [r1(100 * y.level[q]), y.he ? r1(100 * y.he[q]) : null]; });
      return Object.keys(o).length ? { n: y.n, ...o } : null;
    }
    const day = Math.round((pmDay(p.dateStart || p.date) + pmDay(p.date)) / 2), lv = PRIMM.fit.levelAt(day);
    if (!lv) return null;
    const lean = PRIMM.fit.L.coef.has(p.pollster) && !PRIMM.fit.L.lone.has(p.pollster) ? PRIMM.fit.leanPath(p.pollster, [day])[0] : null;
    PRIMARY_KEYS.forEach((k, q) => { if (primaryVal(p, k) != null) o[k] = [r1(100 * lv[q]), lean ? r1(100 * lean[q]) : null]; });
    return Object.keys(o).length ? { n: PRIMM.readings.filter((q) => Math.abs(q.day - day) <= HE_WINDOW).length, ...o } : null;
  }
  const key = p.date + "|" + p.pollster, o = {};
  let n = 0;
  for (const k of PRIMARY_KEYS) {
    const s = primYardBy[k];
    const y = s.at.has(key) ? s.at.get(key) : !s.member.has(key) && primaryVal(p, k) != null ? s.outside(midMs(p), p.pollster) : null;
    if (y) { o[k] = [r1(y.v), y.he == null ? null : r1(y.he)]; n = Math.max(n, y.n); }
  }
  return Object.keys(o).length ? { n, ...o } : null;
};
// a primary share past 0-70 is arithmetic gone wrong, not data
for (const [k, s] of Object.entries(primYardBy)) {
  for (const [key, y] of s.at) {
    if (!Number.isFinite(y.v) || !Number.isFinite(y.he) || y.v < 0 || y.v > 70)
      throw new Error(`primary yardstick out of range (${k} ${key}): ${JSON.stringify(y)}`);
  }
}

/* ---- 4. leadership monthly – gap-aware (no interpolation) --------------
   Rows exist only for months with at least one published leadership reading;
   a leader not polled that month carries null. The panels filter nulls, so
   lines connect real readings instead of inventing a monthly path across
   the source data's gaps (e.g. Jan–Mar 2026). */
// aggregates carry one decimal, as every other figure the site quotes does;
// null-safe, since a leader not polled that month is null, not zero
const r1n = (v) => (v == null ? null : r1(v));
/* House effects on leader NET ratings. Estimated within strata – a firm's
   neighbours must share its metric (approval vs favourability are different
   questions) and, for the opposition slot, its leader era (Ley and Taylor are
   different people). Without that stratification the Feb 2026 handover and the
   metric mix would be booked as house lean.

   These are the largest house effects in the archive: Resolve runs +7.8 on the
   opposition leader where Newspoll runs −7.0, a ~15pp span. Applying them is
   defensible because a net is a difference of two proportions and so already
   scale-free – unlike preferred PM, which is deliberately NOT adjusted (see
   the note there). */
const APPR_SLOTS = [["alb", "alb"], ["opp", "opp"], ["han", "han"]];
const apprHE = {};
for (const [prop, lk] of APPR_SLOTS) {
  const rows = apprAgg.filter((p) => p[prop] != null).map((p) => ({
    firm: p.firm, mid: midMs({ date: p.date }), n: rowN(POLL_BY_KEY.get(p.date + "|" + p.firm)),
    x: p[prop],
    strat: metricOf(p.firm, lk, p.date) + "|" + (lk === "opp" ? eraOf(p.date) : "-"),
  }));
  apprHE[lk] = houseEffectsStrat(rows);
}

/* A preferred-PM reading as a share of those who NAMED someone, rather than of
   all respondents. The denominator is that poll's own contest, so a two-way is
   divided by two names and a three-way by three – which is what makes houses
   with very different "uncommitted" shares (16% to 50% here) comparable at all. */
const prefShare = (p, k) => {
  const den = (p.alb || 0) + (p.opp || 0) + (p.han || 0);
  return den > 0 && p[k] != null ? (p[k] / den) * 100 : null;
};

/* Sampling variance of ONE net reading, in points². A net is a DIFFERENCE of
   two proportions drawn from the same sample, so it does not carry p(1−p):
     Var(a − d) = (a + d − (a−d)²) / n,  i.e. pq = 100·(app+dis) − net²
   which is why this cannot reuse the share floor the 2PP and the primaries
   use – on a −19 net with a 36/57 split it is roughly twice as wide.
   Where the house published no split we assume no don't-knows, the widest
   that floor can be: an interval too generous is the smaller sin. */
const netPq = (net, sp) => {
  const sum = (sp && sp.app != null && sp.dis != null) ? sp.app + sp.dis : 100;
  return Math.max(0, 100 * sum - net * net);
};
/* Preferred PM's monthly means get the monthly construction every vote
   series gets – sample-weighted, a house's repeat waves in the month counted
   as sqrt(m) – but no house adjustment (the note in leaderMonths below says
   why). They were plain means, which let a house that asked twice in a month
   count twice. */
const ppmN = (r) => rowN(POLL_BY_KEY.get(r.date + "|" + r.firm));
const wMeanOf = (rows, f) => {
  const pts = rows.map((r) => ({ r, v: f(r) })).filter((d) => d.v != null);
  if (!pts.length) return null;
  const waves = new Map();
  for (const d of pts) waves.set(d.r.firm, (waves.get(d.r.firm) || 0) + 1);
  let sw = 0, swx = 0;
  for (const d of pts) { const w = ppmN(d.r) / Math.sqrt(waves.get(d.r.firm)); sw += w; swx += w * d.v; }
  return swx / sw;
};

/* ...and their 95% intervals, taken the way net approval's are
   (weightedWithSe: the larger of the houses' spread and the sampling floor)
   on the same weights. The spread term is what makes an interval honest
   here: preferred PM's house differences are question format, not lean,
   so a three-way Albanese read by Resolve (35% uncommitted) and by Newspoll
   (16%) disagree by far more than sampling - and the interval says so
   rather than a line pretending to a precision the houses don't share.
   `pq` is a lead's own variance where the reading is a margin (netPq: the
   difference of two shares of one sample), a share's p(1-p) otherwise. */
const wCiOf = (rows, f, pqf) => {
  const waves = new Map();
  const kept = rows.map((r) => ({ r, v: f(r) })).filter((d) => d.v != null);
  if (!kept.length) return null;
  for (const d of kept) waves.set(d.r.firm, (waves.get(d.r.firm) || 0) + 1);
  const pts = kept.map((d) => ({ w: ppmN(d.r) / Math.sqrt(waves.get(d.r.firm)), x: d.v, n: ppmN(d.r),
    ...(pqf ? { pq: pqf(d.r, d.v) } : {}) }));
  const r = weightedWithSe(pts);
  return r ? { v: r1n(r.v), ci: r1(1.96 * r.se) } : null;
};
const leadOf = (a, b) => (r) => (r[a] != null && r[b] != null ? r[a] - r[b] : null);
const leadPq = (a, b) => (r, lead) => netPq(lead, { app: r[a], dis: r[b] });
const ciOf = (e) => (e ? e.ci : null);

const leaderMonths = MONTHS.map((ym) => {
  const pp = ppm.filter((p) => ymOf(p.date) === ym);
  // a three-way prompt is a different question, never averaged with a two-way
  const pp2 = pp.filter((p) => p.han == null);
  const pp3 = pp.filter((p) => p.han != null);
  // …and the opposition slot is two PEOPLE: Ley's readings and Taylor's never
  // share a mean, or the Feb 2026 handover reads as a move in one man's
  // numbers. Feb 2026 holds both, so that month carries both key families.
  const pp2L = pp2.filter((p) => eraOf(p.date) === "ley"), pp2T = pp2.filter((p) => eraOf(p.date) === "taylor");
  const pp3L = pp3.filter((p) => eraOf(p.date) === "ley"), pp3T = pp3.filter((p) => eraOf(p.date) === "taylor");
  // …and Albanese v Hanson is a third question again, asked with the opposition
  // leader's name absent, so it lives in its own array and its own series
  const ppH = D.ppmHeadToHead.filter((r) => ymOf(r.date) === ym);
  const rows = apprAgg.filter((p) => ymOf(p.date) === ym);
  if (!pp.length && !rows.length && !ppH.length) return null;
  // approval and favourability are different questions – routed PER LEADER by
  // that leader's metric at the firm, never pooled into one mean
  const apprN = (p) => rowN(POLL_BY_KEY.get(p.date + "|" + p.firm));
  const split = (prop, lk, pool = rows) => {
    const ap = [], fv = [];
    const deb = (p, v) => v - heV(apprHE[lk] || {}, p.firm, ymMidMs(ym));   // debias on this leader's own house effects, as of this month
    pool.forEach((p) => {
      const n = apprN(p);
      if (p[prop] != null) {
        // houses are equally weighted here, not samples: this is a handful of
        // houses answering the same question, not one pooled sample
        const pt = { w: 1, x: deb(p, p[prop]), n, pq: netPq(p[prop], p.splits ? p.splits[lk] : null), firm: p.firm };
        (metricOf(p.firm, lk, p.date) === "fav" ? fv : ap).push(pt);
      }
      // a firm that published BOTH measures contributes its second reading to
      // the other line, rather than having it quietly dropped
      const alt = p.splits && p.splits.fav ? p.splits.fav[lk] : null;
      if (alt != null && metricOf(p.firm, lk, p.date) !== "fav")
        fv.push({ w: 1, x: deb(p, alt), n, pq: netPq(alt, null), firm: p.firm });
    });
    const est = (arr) => {
      if (!arr.length) return { v: null, ci: null };
      // ...and a house that answered m times this month counts for sqrt(m),
      // not m - the same deflation the monthly vote estimates apply
      const waves = new Map();
      for (const p of arr) waves.set(p.firm, (waves.get(p.firm) || 0) + 1);
      for (const p of arr) p.w /= Math.sqrt(waves.get(p.firm));
      const r = weightedWithSe(arr);
      return { v: r1n(r.v), ci: r1(1.96 * r.se) };
    };
    const a = est(ap), f = est(fv);
    return { net: a.v, fav: f.v, netCi: a.ci, favCi: f.ci };
  };
  const A = split("alb", "alb"), H = split("han", "han");
  // the opposition office, per era – the same measurement, run once over the
  // readings of each person who held it
  const OL = split("opp", "opp", rows.filter((p) => eraOf(p.date) === "ley"));
  const OT = split("opp", "opp", rows.filter((p) => eraOf(p.date) === "taylor"));
  return {
    ym, x: mx(ym),
    /* Preferred PM is deliberately NOT house-effect-adjusted. Its apparent
       house effects are large (Newspoll +4.1 on Albanese, Resolve −4.6) but
       they are SAME-SIGNED across both leaders in 7 of 8 houses – a house that
       runs Albanese high runs the opposition leader high too. That is the
       signature of a format difference, not partisan lean: Resolve leaves ~35%
       uncommitted where Newspoll leaves ~16%, so every share it reports is
       lower. Subtracting a constant would shift the level without restoring
       comparability; the correct fix for that is normalising to the decided
       share, which changes what the number MEANS and so isn't done silently.
       So it is offered as a SECOND series (…_prefN) behind a labelled toggle,
       never as a replacement: _pref stays exactly what pollsters published.
       Note the normalised view removes the undecided-share difference but NOT
       the contest-size one – a leader's share among the decided is naturally
       lower in a three-way than a two-way. */
    /* …and split by QUESTION FORMAT, because a three-way question mechanically
       depresses both majors: a leader's share is naturally lower when the
       prompt offers three names. Blending the two put a hole in the line
       exactly where three-way polling arrived — June 2026 reads 37.3 blended
       against 42.5 among two-way polls alone, a trough that is question design
       rather than opinion, and about 2pp of the cycle's apparent decline is
       the same artefact. Two-way runs the whole cycle (54 polls, all 14
       months); three-way is recent and partial (15 polls, 7 months). */
    alb_pref: r1n(wMeanOf(pp2, (p) => p.alb)),
    /* ley_* / taylor_*: the one opposition series keyed by who was asked. A
       pre-handover month carries ley_* only, a month since carries taylor_*,
       and Feb 2026 – where both were measured – carries both, so neither
       person's line borrows the other's readings. */
    ley_pref: r1n(wMeanOf(pp2L, (p) => p.opp)), taylor_pref: r1n(wMeanOf(pp2T, (p) => p.opp)),
    hanson_pref: null,
    alb_prefN: r1n(wMeanOf(pp2, (p) => prefShare(p, "alb"))),
    ley_prefN: r1n(wMeanOf(pp2L, (p) => prefShare(p, "opp"))),
    taylor_prefN: r1n(wMeanOf(pp2T, (p) => prefShare(p, "opp"))),
    hanson_prefN: null,
    alb_pref3: r1n(wMeanOf(pp3, (p) => p.alb)),
    ley_pref3: r1n(wMeanOf(pp3L, (p) => p.opp)), taylor_pref3: r1n(wMeanOf(pp3T, (p) => p.opp)),
    hanson_pref3: r1n(wMeanOf(pp3, (p) => p.han)),
    alb_prefN3: r1n(wMeanOf(pp3, (p) => prefShare(p, "alb"))),
    ley_prefN3: r1n(wMeanOf(pp3L, (p) => prefShare(p, "opp"))),
    taylor_prefN3: r1n(wMeanOf(pp3T, (p) => prefShare(p, "opp"))),
    hanson_prefN3: r1n(wMeanOf(pp3, (p) => prefShare(p, "han"))),
    /* Albanese v Hanson, head to head. Not a slice of either line above: it is
       asked as its own contest, Albanese runs ~7pp higher against Hanson than
       against the opposition leader, and only some houses ask it (11 polls,
       Apr 2026 on), so it is a third series rather than a filter on the first. */
    alb_prefH: r1n(wMeanOf(ppH, (r) => r.alb)), hanson_prefH: r1n(wMeanOf(ppH, (r) => r.han)), taylor_prefH: null, ley_prefH: null,
    alb_prefCi: ciOf(wCiOf(pp2, (p) => p.alb)),
    ley_prefCi: ciOf(wCiOf(pp2L, (p) => p.opp)), taylor_prefCi: ciOf(wCiOf(pp2T, (p) => p.opp)),
    alb_pref3Ci: ciOf(wCiOf(pp3, (p) => p.alb)),
    ley_pref3Ci: ciOf(wCiOf(pp3L, (p) => p.opp)), taylor_pref3Ci: ciOf(wCiOf(pp3T, (p) => p.opp)),
    hanson_pref3Ci: ciOf(wCiOf(pp3, (p) => p.han)),
    alb_prefHCi: ciOf(wCiOf(ppH, (r) => r.alb)), hanson_prefHCi: ciOf(wCiOf(ppH, (r) => r.han)),
    /* Albanese's lead in each head-to-head, taken POLL BY POLL (each poll's
       own margin, then the month's mean) so its interval carries a margin's
       variance - not two shares' intervals added as if independent, when
       both come out of one sample and move against each other */
    ...(() => {
      const o = {};
      for (const [k, pool, b] of [["ley", pp2L, "opp"], ["taylor", pp2T, "opp"], ["hanson", ppH, "han"]]) {
        const e = wCiOf(pool, leadOf("alb", b), leadPq("alb", b));
        o["lead_" + k] = e ? e.v : null;
        o["lead_" + k + "Ci"] = e ? e.ci : null;
      }
      return o;
    })(),
    alb_net: A.net, ley_net: OL.net, taylor_net: OT.net, hanson_net: H.net,
    alb_fav: A.fav, ley_fav: OL.fav, taylor_fav: OT.fav, hanson_fav: H.fav,
    alb_netCi: A.netCi, ley_netCi: OL.netCi, taylor_netCi: OT.netCi, hanson_netCi: H.netCi,
    alb_favCi: A.favCi, ley_favCi: OL.favCi, taylor_favCi: OT.favCi, hanson_favCi: H.favCi,
    /* JUR: the month's holder of each multi-holder key, read off its
       readings' dates. A month whose readings straddle a change would
       average two people into one figure, so it is flagged here (none
       does yet: every change fell between two months' polls) */
    ...(JUR ? (() => {
      const o = {};
      const name = (slot, dates) => {
        const ns = [...new Set(dates.map((d) => holderOf(slot, d)).filter(Boolean))];
        if (ns.length > 1) console.warn(`  leadership ${ym}: the ${slot} readings straddle ${ns.join(" → ")} – the month averages both`);
        return ns.length ? ns[ns.length - 1] : null;
      };
      const albD = pp.concat(ppH).map((p) => p.date).concat(rows.filter((p) => p.alb != null).map((p) => p.date));
      const leyD = pp2L.concat(pp3L).filter((p) => p.opp != null).map((p) => p.date)
        .concat(rows.filter((p) => p.opp != null && eraOf(p.date) === "ley").map((p) => p.date));
      const hanD = pp3.concat(ppH).map((p) => p.date).concat(rows.filter((p) => p.han != null).map((p) => p.date));
      if (albD.length) o.alb_who = name("alb", albD);
      if (leyD.length) o.ley_who = name("opp", leyD);
      if (hanD.length) o.hanson_who = name("han", hanD);
      return o;
    })() : {}),
  };
}).filter(Boolean);

/* ---- 4b. leaders' current readings ----------------------------------------
   What each leader readout quotes – built as the headline is
   (currentReading), not the last calendar month, which early in a month is
   one or two houses. Nets: debiased on the same stratified house effects as
   the monthly lines and, as there, houses weighted equally; Albanese's and
   Taylor's approval on the headline's three-week window, the thinner
   measures on six weeks. Preferred PM: the six-week window (a handful of houses
   ask each format), sample-weighted, not house-adjusted (see leaderMonths).
   The opposition slot reads Taylor's era only – the office's holder now.
   Keyed as the monthly series are (alb_net, taylor_pref3…); integers, as the
   monthly readings are. A key with no poll in its window is absent, and the
   panel falls back to the latest monthly reading. */
const leaderNow = (() => {
  const out = {};
  const put = (key, r) => { if (r) out[key] = { ...r, v: r1n(r.v), prev: r.prev != null ? r1n(r.prev) : null }; };
  const taylorEra = (p) => eraOf(p.date) === "taylor";
  for (const [prop, lk, id, pool] of [["alb", "alb", "alb", apprAgg.filter(curOf("alb"))], ["opp", "opp", "taylor", apprAgg.filter(taylorEra)], ["han", "han", "hanson", apprAgg.filter(curOf("han"))]]) {
    for (const metric of ["net", "fav"]) {
      const rows = [];
      for (const p of pool) {
        const n = rowN(POLL_BY_KEY.get(p.date + "|" + p.firm)), mid = midMs({ date: p.date });
        const own = metricOf(p.firm, lk, p.date) === "fav" ? "fav" : "net";
        if (p[prop] != null && own === metric) rows.push({ firm: p.firm, mid, x: p[prop], n, w0: 1, pq: netPq(p[prop], p.splits ? p.splits[lk] : null) });
        // a firm that published both measures lends its second reading to the other line, as the monthly lines do
        const alt = p.splits && p.splits.fav ? p.splits.fav[lk] : null;
        if (metric === "fav" && alt != null && own !== "fav") rows.push({ firm: p.firm, mid, x: alt, n, w0: 1, pq: netPq(alt, null) });
      }
      // approval of the two majors' leaders is asked by four or five houses
      // every three weeks; favourability, and Hanson's approval, by two or so
      // (Apr–Sep 2026: a single house in the three weeks before 40 of 176
      // days), so those read the six-week window
      // (/vic/'s pollsters ask every leader measure only now and then, so
      // all of them read the six-week window there)
      put(id + "_" + metric, currentReading(rows, apprHE[lk], metric === "net" && id !== "hanson" && !JUR ? HEADLINE_K : SPARSE_K));
    }
  }
  const ppRows = (pool, f) => pool.map((p) => ({ firm: p.firm, mid: midMs({ date: p.date }), x: f(p), n: ppmN(p) }))
    .filter((r) => r.x != null);
  const pp2 = ppm.filter((p) => p.han == null), pp3 = ppm.filter((p) => p.han != null);
  // a contest is its current PAIRING's: both sides from polls under the
  // sitting holders (curOf passes every federal reading)
  const cur2 = pp2.filter(curOf("alb")), cur3 = pp3.filter(curOf("alb")).filter(curOf("han"));
  const curH = D.ppmHeadToHead.filter(curOf("alb")).filter(curOf("han"));
  const sets = {
    alb_pref: ppRows(cur2, (p) => p.alb), taylor_pref: ppRows(cur2.filter(taylorEra), (p) => p.opp),
    alb_pref3: ppRows(cur3, (p) => p.alb), taylor_pref3: ppRows(cur3.filter(taylorEra), (p) => p.opp),
    hanson_pref3: ppRows(cur3, (p) => p.han),
    alb_prefH: ppRows(curH, (r) => r.alb), hanson_prefH: ppRows(curH, (r) => r.han),
  };
  for (const [key, rows] of Object.entries(sets)) put(key, currentReading(rows, null, SPARSE_K));
  return out;
})();

/* ---- 4c. each wave's leader gaps against the waves around it -----------
   §3c for the leadership rail: Albanese's net minus a rival's, on the one
   question a wave put to both (approval with approval, favourability with
   favourability), held against the same gap from the OTHER waves around its
   fieldwork midpoint. Each side is leaderNow's reading - houses weighted
   equally, the stratified leans taken out, the same window (three weeks for
   the majors' approval federally, six otherwise) - read with the window open
   both ways, among readings of the SAME office-holder (Ley and Taylor are
   different people; on /vic/ so are Andrews, Allan and Carroll).
     ldYd["opp|net" | "opp|fav" | "han|net" | "han|fav"]: { v, he, n, p }
       v the other waves' gap, he this house's lean on the gap then (its
       Albanese lean minus its rival lean), p the line without this wave.
     ldYardLine[combo]: [[iso, v]] the gap line every 4 days to the newest
       poll, null where either side has no reading in reach. */
const ldYard = (() => {
  const MONTH_SET = new Set(MONTHS);
  const DAY = 86400000;
  const holderAt = (slot, iso) => (JUR ? holderOf(slot, iso) : slot === "opp" ? eraOf(iso) : slot);
  const K = (slot, metric) => (metric === "net" && slot !== "han" && !JUR ? HEADLINE_K : SPARSE_K);
  const rows = {};                                // slot|metric -> rows with holder
  for (const slot of ["alb", "opp", "han"]) {
    for (const metric of ["net", "fav"]) {
      const out = rows[slot + "|" + metric] = [];
      for (const a of apprAgg) {
        const P = POLL_BY_KEY.get(a.date + "|" + a.firm);
        const base = { key: a.date + "|" + a.firm, firm: a.firm, mid: P ? midMs(P) : midMs({ date: a.date }), n: rowN(P), w0: 1, holder: holderAt(slot, a.date) };
        const own = metricOf(a.firm, slot, a.date) === "fav" ? "fav" : "net";
        if (a[slot] != null && own === metric) out.push({ ...base, x: a[slot], pq: netPq(a[slot], a.splits ? a.splits[slot] : null) });
        const alt = a.splits && a.splits.fav ? a.splits.fav[slot] : null;
        if (metric === "fav" && alt != null && own !== "fav") out.push({ ...base, x: alt, pq: netPq(alt, null) });
      }
    }
  }
  const side = (slot, metric, t, skip) => {
    const holder = holderAt(slot, new Date(t).toISOString().slice(0, 10));
    const rs = rows[slot + "|" + metric].filter((r) => r.holder === holder);
    const e = weightedWithSe(aroundPts(rs, apprHE[slot], t, skip, K(slot, metric)));
    return e;
  };
  const gapAt = (riv, metric, t, skip) => {
    const A = side("alb", metric, t, skip), R = side(riv, metric, t, skip);
    return A && R ? { v: A.v - R.v, n: Math.min(A.n, R.n) } : null;
  };
  const first = apprAgg.length ? Math.min(...apprAgg.filter((a) => MONTH_SET.has(ymOf(a.date))).map((a) => midMs({ date: a.date }))) : null;
  const g = [];
  if (first != null && Number.isFinite(first)) { for (let d = Math.floor(first / DAY); d < KF_T1; d += YARD_STEP) g.push(d); g.push(KF_T1); }
  const line = {}, at = new Map(), breaks = {};
  for (const riv of ["opp", "han"]) {
    for (const metric of ["net", "fav"]) {
      const combo = riv + "|" + metric;
      const vAt = (d, skip) => { const e = gapAt(riv, metric, Math.min(d * DAY, refNow), skip); return e ? r1(e.v) : null; };
      line[combo] = g.map((d) => [new Date(d * DAY).toISOString().slice(0, 10), vAt(d, null)]);
      /* where either office changes hands the gap is between other people:
         the first grid day under the new holders, so the line breaks there */
      const who = (d) => { const iso = new Date(d * DAY).toISOString().slice(0, 10); return holderAt("alb", iso) + "|" + holderAt(riv, iso); };
      breaks[combo] = g.filter((d, i) => i > 0 && who(d) !== who(g[i - 1])).map((d) => new Date(d * DAY).toISOString().slice(0, 10));
      const has = (r) => rows["alb|" + metric].some((q) => q.key === r.key) && rows[riv + "|" + metric].some((q) => q.key === r.key);
      for (const r of rows[riv + "|" + metric]) {
        if (!MONTH_SET.has(ymOf(r.key.slice(0, 10))) || !has(r)) continue;
        const e = gapAt(riv, metric, r.mid, r.key);
        if (!e) continue;
        const win = Math.max(K("alb", metric).window, K(riv, metric).window);
        const idx = g.map((d, i) => (Math.abs(d * DAY - r.mid) <= win * DAY ? i : -1)).filter((i) => i >= 0);
        const o = at.get(r.key) || {};
        o[combo] = { v: r2(e.v), he: r2(heV(apprHE.alb, r.firm, r.mid) - heV(apprHE[riv], r.firm, r.mid)), n: e.n,
                     ...(idx.length ? { p: { i: idx[0], v: idx.map((i) => vAt(g[i], r.key)) } } : {}) };
        at.set(r.key, o);
      }
    }
  }
  for (const o of at.values()) for (const [c, y] of Object.entries(o)) { const t = trimPatch(y.p, line[c]); if (t) y.p = t; else delete y.p; }
  // drop a combo no wave was ever asked on, so the payload carries no empty line
  for (const c of Object.keys(line)) if (line[c].every((r) => r[1] == null)) delete line[c];
  for (const c of Object.keys(breaks)) if (!line[c] || !breaks[c].length) delete breaks[c];
  return { at, line, breaks };
})();

/* The preferred-PM margin now – PM minus two-way opponent, as Past cycles
   draws it – for the sitting term's latest point there (§10) and for the
   Leadership panel's head. TWO-WAY rows only: a three-way prompt (Hanson
   offered: Albanese 31, Taylor 15) is a different contest, a mixed pool
   read the margin +9.6 against the two-way +2 in Oct 2026; her own lead
   is ppmHMarginNow's pool. Taylor's era; sample-weighted, never
   house-adjusted, the six-week window, as the preferred-PM readings are.
   A margin is a difference of two shares, so it carries a net's sampling
   variance. */
const ppmMarginNow = currentReading(ppm.filter((p) => p.han == null && p.alb != null && p.opp != null && eraOf(p.date) === "taylor" && curOf("alb")(p))
  .map((p) => ({ firm: p.firm, mid: midMs({ date: p.date }), x: p.alb - p.opp, n: ppmN(p),
                 pq: Math.max(0, 100 * (p.alb + p.opp) - (p.alb - p.opp) ** 2) })), null, SPARSE_K);
/* Albanese-over-Hanson preferred-PM margin now, for the sitting term's
   latest point in Past cycles: the H2H pair's own pool (its waves all sit
   in the Taylor era, so no era filter is needed), the same six-week
   window and sample weighting as ppmMarginNow. */
const ppmHMarginNow = currentReading(D.ppmHeadToHead.filter((r) => r.alb != null && r.han != null)
  .map((r) => ({ firm: r.firm, mid: midMs({ date: r.date }), x: r.alb - r.han, n: ppmN(r),
                 pq: Math.max(0, 100 * (r.alb + r.han) - (r.alb - r.han) ** 2) })), null, SPARSE_K);
/* Both leads for the Leadership panel's head, which says "leads" only where
   the lead clears its own margin: each poll's lead pooled, its variance the
   difference of two shares of ONE sample (the shares move against each
   other, so the lead's margin is wider than the two shares' margins
   combined would suggest). The opposition lead is the TWO-WAY question's
   only, as the panel's bars and leaderNow.alb_pref are – ppmMarginNow
   above takes exactly that basis; the Hanson lead is its own
   head-to-head pool, two-way already. */
const leaderLead = {
  taylor: ppmMarginNow ? { v: ppmMarginNow.v, ci95: ppmMarginNow.ci95 } : null,
  hanson: ppmHMarginNow ? { v: ppmHMarginNow.v, ci95: ppmHMarginNow.ci95 } : null,
};

/* A card's house credit-list names only houses still ASKING the question:
   anyone with a reading in the six months before the series' own newest.
   Deriving rather than writing names into copy isn't enough on its own -
   scoped to the chart's whole span, the derivation kept crediting Freshwater
   on the direction panel long after it stopped asking it (its last reading
   is Oct 2025; it polled voting intention into May 2026). Ordering is
   most-readings-first inside the window, ties alphabetical. */
const CURRENT_HOUSE_MS = 183 * 86400000;
const creditHouses = (items, firmOf, xOf) => {
  if (!items.length) return [];
  const newest = Math.max(...items.map(xOf));
  const n = {};
  for (const it of items) {
    if (newest - xOf(it) > CURRENT_HOUSE_MS) continue;
    const f = firmOf(it);
    n[f] = (f in n) ? n[f] + 1 : 1;
  }
  return Object.keys(n).sort((a, b) => n[b] - n[a] || a.localeCompare(b));
};
/* The caption list is WIDER than the active count: a house with a declared
   stop (pollsterRules.stopped) still contributed readings to the series and
   a reader meeting its dots needs the name – but it must sit LAST and be
   labelled "(inactive)", so the list never claims a live roster. A declared
   stop caps the recency window too: whatever the six-month rule would say
   (a stopped house often sits inside it on a series it feeds), a stopped
   house is inactive. The active houses and ordering are otherwise exactly
   creditHouses'; an optional `display` canonicalises house-announcement
   sub-brands to the name the site uses. */
const STOPPED_HOUSES = new Map(
  Object.entries(D.pollsterRules || {}).filter(([, r]) => r && r.stopped));
const creditHousesWithStopped = (items, firmOf, xOf, display = (f) => f) => {
  const active = creditHouses(items, firmOf, xOf).filter((f) => !STOPPED_HOUSES.has(f));
  const stopped = [...new Set(items.map(firmOf))]
    .filter((f) => !active.includes(f) && STOPPED_HOUSES.has(f))
    .sort((a, b) => a.localeCompare(b))
    .map((f) => `${display(f)} (inactive)`);
  return [...active.map(display), ...stopped];
};

/* ---- 5. national direction – right track / wrong track ------------------
   Federally every direction figure now comes from the model in §5m below
   (2026-11-22); what follows is the earlier recipe, still the path for a
   jurisdiction without the model and the source of the leans §5's other
   consumers read. The earlier recipe gave it the SAME treatment as the 2PP
   and the primaries: sample-weighted,
   house-effect-adjusted monthly means. The houses asking this question are
   not the ones publishing a 2PP, and they don't all poll every month, so a
   plain mean would step with WHO polled rather than with what people think.
   (The raw spread between Roy Morgan and Essential looks enormous, but most
   of it is the trend, not the house: measured against a local consensus the
   two sit ~1.5pp apart – which is exactly why this is estimated rather than
   eyeballed.)
   `unsure` is taken as the remainder so the three shares always total 100
   and the readout bar can't leave a gap. */
const DIR = D.direction || [];
/* The wave's weight on the series: the joined poll row's n where the same
   wave measured voting intention, the direction row's own n where the
   wave's writer filed one (SEC Newgate), else the standing 1200 default. */
const dirSample = (d) => {
  const p = POLL_BY_KEY.get(d.date + "|" + d.pollster);
  if (p) return rowN(p);
  return Math.min(d.sample || 1200, SAMPLE_CAP);
};

/* ---- 5m. national direction: the Bayesian model (federal, 2026-11-22) ----
   Every figure the National direction panel prints – the line back to 2007,
   today's reading and its change, each pollster's lean, the All-polls rail's
   "against the trend" and "in today's figure" – comes from one state-space
   model over every reading on file (./direction-model.mjs explains it; the
   prototype, backtest and review are in .build/analysis/direction-bayes/).
   Readings: the live direction[] rows, the houses' back history
   (data/direction-history.json, corrected below), Ipsos's What Worries the
   World Australia figures and the Lowy Institute's and McKinnon's
   satisfaction questions – different questions and formats enter through
   each pollster's lean, measured on the ratio of right to wrong, which a
   forced choice or an unsure option leaves comparable. /vic/ asks no
   direction question: there DIRM is null and the older recipe below runs on
   its empty series exactly as before. */
const DIR_DAY = (iso) => Math.floor(Date.parse(iso.slice(0, 10) + "T00:00:00Z") / 86400000);
const DIR_ISO = (d) => new Date(d * 86400000).toISOString().slice(0, 10);
/* Corrections to the back history found by the 2026-11-22 release-date
   audit (.build/analysis/direction-bayes/morgan-release-dates.json, issues),
   keyed end|right|wrong. The backfill (backfill-direction-history.mjs) should
   learn them; until it does they are applied as the file is read.
     · five Oct–Dec "2015" rows are the late-2013 waves (a table heading set
       the year): four repeat waves already on file, the fifth moves to 2013;
     · two-week pools of Dec 11 2022 and May 14 2023 overlap the one-week
       readings ending the same day, so they are dropped, and every Aug 2022 –
       Nov 2023 row (filed with start = end) gets its week back;
     · three label typos ("23/34" 2012, "18/29" 2020, "February 20" 2025). */
/* days opinion may move at once: federal elections and changes of prime
   minister since the record begins */
const DIR_JUMPS = ["2007-11-24", "2010-06-24", "2010-08-21", "2013-06-27", "2013-09-07", "2015-09-15",
  "2016-07-02", "2018-08-24", "2019-05-18", "2022-05-21", "2025-05-03"];
const MONTH_SET_EARLY = new Set(MONTHS);
const DIR_HIST_DROP = new Set(["2015-11-03|45.5|31", "2015-11-17|48.5|32.5", "2015-12-01|48|35", "2015-12-15|42|38.5",
  "2022-12-11|45.7|37.9", "2023-05-14|39.4|45.1"]);
const DIR_HIST_REDATE = {
  "2015-10-20|42.5|28.5": ["2013-10-19", "2013-10-20"], "2012-06-17|39|44": ["2012-06-16", "2012-06-24"],
  "2020-07-29|49|34.5": ["2020-07-11", "2020-07-19"], "2025-02-20|34.6|49.6": ["2025-02-17", "2025-02-23"],
};
const DIR_HIST_TWO_WEEK = new Set(["2022-12-16|45.5|39.1", "2023-01-15|45|38.5", "2023-01-29|43.5|38.7"]);
const DIRM = (() => {
  if (JUR || !DIR.length) return null;
  const tStart = Date.now();
  const rd = (f) => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, "data", f), "utf8")); } catch { return null; } };
  const HIST = (rd("direction-history.json") || {}).waves || [], IPS = (rd("ipsos-direction.json") || {}).waves || [], LOWY = (rd("lowy-direction.json") || {}).waves || [];
  const fmtOf = (house, unsure) => DIR_FORMAT[house] || (unsure != null && unsure >= 2 ? "u" : "f");
  const readings = [];
  const add = (r) => {
    if (!(r.R > 0 && r.W > 0) || !r.end) return;
    const s = DIR_DAY(r.start || r.end), e = DIR_DAY(r.end);
    const fmt = fmtOf(r.house, r.U);
    readings.push({ ...r, start: r.start || r.end, fmt, mid: Math.round((Math.min(s, e) + e) / 2), U: fmt === "u" ? (r.U ?? Math.max(0, 100 - r.R - r.W)) : null });
  };
  for (const d of DIR) add({ house: d.pollster, src: "live", key: d.date + "|" + d.pollster, start: d.dateStart || d.date, end: d.date,
    R: d.right, W: d.wrong, U: d.unsure, n: dirSample(d), sample: (POLL_BY_KEY.get(d.date + "|" + d.pollster) || {}).sample || d.sample || null, url: d.url || null });
  const liveKeys = new Set(DIR.map((d) => `${d.pollster}|${d.date}|${d.right}|${d.wrong}`));
  const histHouse = (w) => HOUSE_RENAMES[w.pollster || "Roy Morgan"] || w.pollster || "Roy Morgan";
  /* a dateless reprint (only the day an outlet printed it) that repeats a
     dated wave of the same house from the ten days before, within half a
     point, is that wave again (Crikey, 18 Mar and 13 Jun 2008) */
  const reprint = (w) => !w.end && w.published && HIST.some((x) => x !== w && x.end && histHouse(x) === histHouse(w)
    && DIR_DAY(w.published) - DIR_DAY(x.end) >= 0 && DIR_DAY(w.published) - DIR_DAY(x.end) <= 10
    && Math.abs(x.right - w.right) <= 0.5 && Math.abs(x.wrong - w.wrong) <= 0.5);
  for (const w of HIST) {
    if (w.right == null || w.wrong == null || reprint(w)) continue;
    const house = histHouse(w), k = `${w.end}|${w.right}|${w.wrong}`;
    if (DIR_HIST_DROP.has(k) || liveKeys.has(`${house}|${w.end}|${w.right}|${w.wrong}`)) continue;
    let start, end;
    if (DIR_HIST_REDATE[k]) [start, end] = DIR_HIST_REDATE[k];
    else if (w.end) { start = w.start || w.dateStart || w.end; end = w.end; }
    else if (w.month) { start = w.month + "-01"; end = DIR_ISO(DIR_DAY(w.month + "-01") + 31).slice(0, 7) + "-01"; end = DIR_ISO(DIR_DAY(end) - 1); }
    else if (w.published) start = end = w.published;
    else continue;
    if (house === "Roy Morgan" && start === end && end >= "2022-08-01" && end <= "2023-11-30")
      start = DIR_ISO(DIR_DAY(end) - (DIR_HIST_TWO_WEEK.has(k) ? 13 : 6));
    add({ house, src: "history", start, end, R: w.right, W: w.wrong, U: w.unsure, n: Math.min(w.sample || 1200, SAMPLE_CAP),
      sample: w.sample || null, url: w.url || null,
      label: w.label || (w.month ? `${MNF[+w.month.slice(5, 7) - 1]} ${w.month.slice(0, 4)}` : null) });
  }
  for (const w of IPS) if (w.australia && w.australia.right != null && w.start && w.end)
    add({ house: "Ipsos", src: "ipsos", start: w.start, end: w.end, R: w.australia.right, W: w.australia.wrong,
      n: Math.min(w.australia.sample || 1000, SAMPLE_CAP), sample: w.australia.sample || null, sampleApprox: !!w.australia.sampleApprox, url: w.sourceUrl || null, ym: w.month,
      label: w.fieldwork || null });
  for (const w of LOWY) add({ house: "Lowy Institute", src: "lowy", start: w.start, end: w.end, R: w.satisfied, W: w.dissatisfied,
    n: Math.min(w.sample || 1200, SAMPLE_CAP), sample: w.sample || null, url: w.url || null, label: w.field || null, modeChange: !!w.modeChange });
  readings.sort((a, b) => a.mid - b.mid || a.house.localeCompare(b.house));
  const t1 = DIR_DAY(LATEST_ISO), tFirst = readings[0].mid;
  /* the days the panel prints: mid-month back to the first reading (the
     current month at the newest poll, so the line ends on the headline), the
     yardstick grid of the current term (every YARD_STEP days to KF_T1), each
     Ipsos wave's middle day (the world comparison), and a month ago */
  const months = [];
  for (let y = Number(DIR_ISO(tFirst).slice(0, 4)), m = Number(DIR_ISO(tFirst).slice(5, 7)); ; m++) {
    if (m > 12) { m = 1; y++; }
    const ym = `${y}-${String(m).padStart(2, "0")}`;
    if (DIR_DAY(ym + "-01") > t1) break;
    const day = ym === LATEST_ISO.slice(0, 7) ? t1 : Math.min(DIR_DAY(ym + "-15"), t1);
    if (day >= tFirst) months.push({ ym, day });
  }
  const curFirst = Math.min(...readings.filter((r) => MONTHS.includes(DIR_ISO(r.mid).slice(0, 7))).map((r) => r.mid));
  const yard = [];
  for (let d = curFirst; d < KF_T1; d += YARD_STEP) yard.push(d);
  yard.push(KF_T1);
  const ipsDays = readings.filter((r) => r.src === "ipsos").map((r) => r.mid);
  const days = [...new Set([...months.map((m) => m.day), ...yard, ...ipsDays, t1, t1 - 30])];
  const jumps = new Set(DIR_JUMPS.map(DIR_DAY));
  const fit = fitDirection(readings, { t1, days, jumps, nDraw: +(process.env.DIR_NDRAW || 2000), track: ["Ipsos"] });
  const S = (a) => ({ v: dmean(a), lo: dquant(a, 0.025), hi: dquant(a, 0.975) });
  const half = (a) => r1((dquant(a, 0.975) - dquant(a, 0.025)) / 2);
  const inMonth = (ym) => readings.filter((r) => DIR_ISO(r.mid).slice(0, 7) === ym).length;
  const row = ({ ym, day }) => {
    const s = fit.shares(day), right = r1(dmean(s.R)), wrong = r1(dmean(s.W));
    return { ym, x: mx(ym), right, wrong, unsure: r1(Math.max(0, 100 - right - wrong)), net: r1(dmean(s.NET)),
      n: inMonth(ym), rightCi: half(s.R), wrongCi: half(s.W), netCi: half(s.NET) };
  };
  const series = months.map(row);
  const byYm = new Map(series.map((m) => [m.ym, m]));
  const direction = MONTHS.map((ym) => byYm.get(ym)).filter(Boolean);
  /* today, its change on a month ago and since the term's first month: the
     posterior of each difference itself (the mood then estimated with every
     poll since), significant when its 95% band excludes zero */
  const now = fit.shares(t1), prev = fit.shares(t1 - 30);
  const chg = now.NET.map((v, i) => v - prev.NET[i]);
  const firstDay = months.find((m) => m.ym === MONTHS[0])?.day;
  const since = firstDay != null ? now.NET.map((v, i) => v - fit.shares(firstDay).NET[i]) : null;
  const cS = S(chg), sS = since ? S(since) : null;
  const nowRight = r1(dmean(now.R)), nowWrong = r1(dmean(now.W));
  const directionNow = {
    right: nowRight, wrong: nowWrong, unsure: r1(Math.max(0, 100 - nowRight - nowWrong)), net: r1(dmean(now.NET)),
    rightCi: half(now.R), wrongCi: half(now.W), netCi: half(now.NET),
    n: readings.filter((r) => t1 - r.mid <= HL_WINDOW && r.mid <= t1).length,
    chg: r1(cS.v), changeCi95: r1((cS.hi - cS.lo) / 2), changeLo: r1(cS.lo), changeHi: r1(cS.hi),
    changeSig: cS.lo > 0 || cS.hi < 0, pUp: r2(dmean(chg.map((v) => (v > 0 ? 1 : 0)))),
    ...(sS ? { sinceTerm: { from: MONTHS[0], chg: r1(sS.v), lo: r1(sS.lo), hi: r1(sS.hi), sig: sS.lo > 0 || sS.hi < 0 } } : {}),
    method: "bayes", draws: fit.n,
  };
  /* each house's lean today: its printed right and wrong against the average
     pollster's, format included (a forced choice runs high on both) */
  const curHouses = [...new Set(readings.filter((r) => MONTHS.includes(DIR_ISO(r.mid).slice(0, 7))).map((r) => r.house))];
  const allN = (h) => readings.filter((r) => r.house === h && dirLeanHouse(r) === h).length;
  const houseEffects = { right: {}, wrong: {}, net: {} };
  for (const h of curHouses) {
    const { dR, dW } = fit.leanPts(h), n = allN(h);
    houseEffects.right[h] = { v: r1(dmean(dR)), n }; houseEffects.wrong[h] = { v: r1(dmean(dW)), n };
    houseEffects.net[h] = { v: r1(dmean(dR) - dmean(dW)), n };
  }
  /* per live reading of this term: what it does to today's net (its
     footprint) and the trend at its fieldwork without it (its yardstick) */
  const effByKey = new Map(), ydAt = new Map();
  readings.forEach((r, i) => {
    if (r.src !== "live" || !MONTH_SET_EARLY.has(DIR_ISO(r.mid).slice(0, 7))) return;
    const inf = fit.influence(i);
    if (!inf) return;
    effByKey.set(r.key, { lo: r1(directionNow.net - inf.dNow), hi: directionNow.net, w: 1 });
    const n = readings.filter((q, j) => j !== i && Math.abs(q.mid - r.mid) <= HE_WINDOW).length;
    ydAt.set(r.key, { v: r2(inf.level), he: r2(inf.he), n });
  });
  const yardLine = yard.map((d) => [DIR_ISO(d), r1(dmean(fit.shares(d).NET))]);
  /* dots: the pre-term readings, and this term's readings that have no
     direction[] row (Ipsos, McKinnon) – no All-polls row to open */
  const termStart = MONTHS[0], dispHouse = (h) => h;
  const dot = (r) => ({ x: dx(r.end), ym: r.end.slice(0, 7), pollster: dispHouse(r.house), dateLabel: r.label || fwLabel(r.start !== r.end ? r.start : null, r.end),
    released: r.end, fmid: DIR_ISO(r.mid), right: r.R, wrong: r.W, unsure: r.fmt === "u" ? r.U : null, sample: r.sample,
    ...(r.sampleApprox ? { sampleApprox: true } : {}), ...(r.modeChange ? { modeChange: true } : {}), ...(r.url ? { url: r.url } : {}) });
  const preDots = readings.filter((r) => r.end.slice(0, 7) < termStart).map(dot).sort((a, b) => a.x - b.x);
  const extraDots = readings.filter((r) => r.src !== "live" && r.end.slice(0, 7) >= termStart).map((r) => ({ ...dot(r), noRow: true }));
  const directionPre = {
    from: "2022-03", to: termStart,
    houses: [...new Set(readings.filter((r) => { const ym = r.end.slice(0, 7); return ym >= "2022-03" && ym < termStart; }).map((r) => r.house))],
    series: series.filter((m) => m.ym >= "2022-03" && m.ym < termStart),
    solo: series.filter((m) => m.ym < "2022-03"),
    polls: preDots, gapAtJoin: null, model: true,
  };
  /* Ipsos' Global Average on the panel's terms: each wave's world ratio of
     right to wrong moved by Ipsos's lean on that day – the shift the model
     gives Ipsos Australia – and split with Australia's undecided share.
     Ipsos's Australia-and-world gap is kept exactly; the assumption is the
     one any Ipsos comparison of Australia with the world makes, that its
     Australian and world samples share its lean in the same month. */
  const sb = fit.bal, su = fit.und, LG = (p) => Math.log(p / (1 - p));
  const worldAdj = IPS.filter((w) => w.globalAverage && w.globalAverage.right != null && w.start && w.end).map((w) => {
    const day = Math.round((DIR_DAY(w.start) + DIR_DAY(w.end)) / 2), slb = sb.slotOfDay.get(day), slu = su.slotOfDay.get(day);
    if (slb == null || slu == null) return null;
    const lw = LG(w.globalAverage.right / (w.globalAverage.right + w.globalAverage.wrong));
    const R = [], W = [];
    for (let i = 0; i < fit.n; i++) {
      const u = fit.logistic(su.draws[i].m[slu]), b = fit.logistic(lw - sb.draws[i].tr.Ipsos[slb]);
      R.push(100 * (1 - u) * b); W.push(100 * (1 - u) * (1 - b));
    }
    return { ym: w.month, x: dx(DIR_ISO(day)), field: w.fieldwork || null, right: r1(dmean(R)), wrong: r1(dmean(W)),
      printed: { right: w.globalAverage.right, wrong: w.globalAverage.wrong } };
  }).filter(Boolean);
  const kap = (f) => Object.fromEntries([...f.kappa].map(([h, k]) => [h, k]));
  const top = (f) => f.rows[0].th;
  console.log(`direction model: ${readings.length} readings (${[...new Set(readings.map((r) => r.house))].length} houses) in ${((Date.now() - tStart) / 1000).toFixed(1)}s`
    + ` | now R ${directionNow.right} W ${directionNow.wrong} U ${directionNow.unsure} net ${directionNow.net} ±${directionNow.netCi}`
    + ` | month ${directionNow.chg} [${directionNow.changeLo}, ${directionNow.changeHi}] P(up) ${directionNow.pUp}`
    + ` | best balance ${JSON.stringify(top(sb))} undecided ${JSON.stringify(top(su))}`
    + ((sb.edges.length || su.edges.length) ? ` | GRID EDGE balance [${sb.edges}] undecided [${su.edges}]` : "")
    + ` | κ ${JSON.stringify(kap(sb))}`);
  return { readings, direction, series, directionNow, houseEffects, effByKey, yard: { at: ydAt, line: yardLine },
    directionPre, extraDots, worldAdj, extraHouses: curHouses.filter((h) => !DIR.some((d) => d.pollster === h)) };
})();
const dirRows = (field) => DIR.filter((d) => d[field] != null).map((d) => ({
  ym: ymOf(d.date), mid: midMs(d), x: d[field], n: dirSample(d), firm: d.pollster,
}));
const dirHe = { right: houseEffectsFor(dirRows("right")), wrong: houseEffectsFor(dirRows("wrong")) };
/* Hoisted from below: the net series and its own house effects (a net's
   variance is a difference of two proportions', never a borrowed share's)
   serve both the headline's change test and the per-reading footprint, so
   one construction feeds every user. */
const dirNetRows = DIR.filter((d) => d.right != null && d.wrong != null).map((d) => ({
  mid: midMs(d), x: d.right - d.wrong, n: dirSample(d), firm: d.pollster,
  pq: Math.max(0, 100 * (d.right + d.wrong) - (d.right - d.wrong) ** 2),
}));
const dirHeNet = houseEffectsFor(dirNetRows);
/* What one reading does to today's national-direction figure, keyed
   date|pollster exactly as the poll rows' effByKey is. The headline net is a
   difference of two SHARE nowcasts, so the footprint is the difference of
   their two leave-one-out recomputes; the at-day pair (for readings outside
   today's window) works the same way on the release day itself. */
const dirEffByKey = DIRM ? DIRM.effByKey : (() => {
  const ms = new Set(MONTHS);            // current-term months only: older
                                         // readings never surface as rows
  const keyed = (field) => DIR.filter((d) => d[field] != null).map((d) =>
    ({ key: d.date + "|" + d.pollster, mid: midMs(d), x: d[field], n: dirSample(d), firm: d.pollster }));
  const rowsR = keyed("right"), rowsW = keyed("wrong");
  const curR = nowcastAdj(rowsR, dirHe.right, refNow), curW = nowcastAdj(rowsW, dirHe.wrong, refNow);
  if (!curR || !curW) return new Map();
  const hi = r1(curR.v - curW.v);
  const inWin = (key) => rowsR.some((r) => r.key === key
    && ddays(refNow, r.mid) >= 0 && ddays(refNow, r.mid) <= HL_WINDOW);
  const netAt = (rows, he, key, at) => {
    const yes = nowcastAdj(rows, he, at), no = nowcastAdj(rows.filter((q) => q.key !== key), he, at);
    return yes && no ? { yes, no } : null;
  };
  const out = new Map();
  for (const d of DIR) {
    if (d.right == null || d.wrong == null || !ms.has(ymOf(d.date))) continue;
    const key = d.date + "|" + d.pollster;
    const loR = netAt(rowsR, dirHe.right, key, refNow), loW = netAt(rowsW, dirHe.wrong, key, refNow);
    if (!loR || !loW) continue;          // the reading is the window's only one
    const eff = { lo: r1(loR.no.v - loW.no.v), hi, w: inWin(key) ? 1 : 0 };
    /* the at-day "it moved the figure when it came out" pair only when the
       day held a figure to move: this series is thin, and against a window
       of one or two readings that number would measure the window's
       turnover, not the wave's weight */
    if (!eff.w) {
      const at = new Date(d.date).getTime();
      const tR = netAt(rowsR, dirHe.right, key, at), tW = netAt(rowsW, dirHe.wrong, key, at);
      if (tR && tW && tR.yes.n >= 3 && tW.yes.n >= 3)
        eff.t = { lo: r1(tR.no.v - tW.no.v), hi: r1(tR.yes.v - tW.yes.v) };
    }
    out.set(key, eff);
  }
  return out;
})();
/* Each reading against the readings around it (§3c's construction on the
   headline's own terms: the net is the right nowcast minus the wrong one,
   each house-adjusted on its own series), and the line the chart draws.
   yd: { v, he, n } - the other readings' net at this one's fieldwork
   midpoint, and this house's net lean then (right lean minus wrong lean). */
const dirYard = DIRM ? DIRM.yard : (() => {
  const keyed = (field) => DIR.filter((d) => d[field] != null).map((d) =>
    ({ key: d.date + "|" + d.pollster, mid: midMs(d), x: d[field], n: dirSample(d), firm: d.pollster }));
  const rowsR = keyed("right"), rowsW = keyed("wrong");
  const netAt = (t, skip) => {
    const r = weightedWithSe(aroundPts(rowsR, dirHe.right, t, skip)), w = weightedWithSe(aroundPts(rowsW, dirHe.wrong, t, skip));
    return r && w ? { v: r.v - w.v, n: Math.max(r.n, w.n) } : null;
  };
  const DAY = 86400000, ms = new Set(MONTHS);
  const first = DIR.filter((d) => ms.has(ymOf(d.date))).map(midMs);
  const g = [];
  if (first.length) { for (let d = Math.floor(Math.min(...first) / DAY); d < KF_T1; d += YARD_STEP) g.push(d); g.push(KF_T1); }
  const netV = (d, skip) => { const e = netAt(Math.min(d * DAY, refNow), skip); return e ? r1(e.v) : null; };
  const at = new Map();
  for (const d of DIR) {
    if (d.right == null || d.wrong == null || !ms.has(ymOf(d.date))) continue;
    const key = d.date + "|" + d.pollster, mid = midMs(d);
    const e = netAt(mid, key);
    if (!e) continue;
    // the line without this reading where it reaches (see §3c's patch)
    const idx = g.map((x, i) => (Math.abs(x * DAY - mid) <= HEADLINE_K.window * DAY ? i : -1)).filter((i) => i >= 0);
    at.set(key, { v: r2(e.v), he: r2(heV(dirHe.right, d.pollster, mid) - heV(dirHe.wrong, d.pollster, mid)), n: e.n,
                  ...(idx.length ? { p: { i: idx[0], v: idx.map((i) => netV(g[i], key)) } } : {}) });
  }
  const line = g.map((d) => [new Date(d * DAY).toISOString().slice(0, 10), netV(d, null)]);
  for (const y of at.values()) { const t = trimPatch(y.p, line); if (t) y.p = t; else delete y.p; }
  return { at, line };
})();
/* a lone wave carries real weight in a 21-day window of this thin series:
   its post-election window legitimately swung 8 points on one wave. Unlike
   the 2PP footprint's ±4 (ten-poll windows), the tripwire here only catches
   arithmetic pathology – past ±10 the estimator itself is suspect. */
for (const [k, eff] of dirEffByKey) {
  for (const e of [eff, ...(eff.t ? [eff.t] : [])]) {
    if (!Number.isFinite(e.lo) || !Number.isFinite(e.hi) || Math.abs(e.hi - e.lo) > 10)
      throw new Error(`direction footprint out of range (${k}): ${JSON.stringify(e)}`);
  }
}
// Who actually asks this question, most-active first – derived rather than
// written into the copy, so the panel can't claim a house that has stopped
// polling it (or miss one that has started). Recency-scoped via creditHouses:
// chart-span alone still credited Freshwater eleven months after its last
// reading.
const MONTH_SET = new Set(MONTHS);
/* federally the line is built from Ipsos's and McKinnon's readings too
   (§5m), so they are credited beside the direction[] houses */
const DIR_CREDIT = DIR.filter((d) => MONTH_SET.has(ymOf(d.date))).map((d) => ({ pollster: d.pollster, date: d.date }))
  .concat(DIRM ? DIRM.extraDots.map((d) => ({ pollster: d.pollster, date: d.released })) : []);
const directionHouses = creditHouses(DIR_CREDIT, (d) => d.pollster, (d) => Date.parse(d.date));
// The caption's name-list takes the same houses plus any STOPPED contributors,
// listed last as "Name (inactive)" – directionHouses stays the active count
// for the How-to-read line ("Only N houses ask this question").
const directionHousesAll = creditHousesWithStopped(DIR_CREDIT, (d) => d.pollster, (d) => Date.parse(d.date));
// The month each STOPPED house went quiet on this question - one past its
// last direction reading - so the caption can date "became inactive in …"
// instead of a bare "has stopped asking". Keyed by firm, "YYYY-MM".
const dirLastYm = {};
for (const d of DIR) {
  if (!MONTH_SET.has(ymOf(d.date)) || !STOPPED_HOUSES.has(d.pollster)) continue;
  const ym = ymOf(d.date);
  if (!(d.pollster in dirLastYm) || ym > dirLastYm[d.pollster]) dirLastYm[d.pollster] = ym;
}
const directionStoppedSince = {};
for (const [f, ym] of Object.entries(dirLastYm)) {
  const y = Number(ym.slice(0, 4)), m = Number(ym.slice(5));
  directionStoppedSince[f] = m === 12 ? (y + 1) + "-01" : y + "-" + String(m + 1).padStart(2, "0");
}
// The favourability houses present in the approval series. Fav is per-row,
// not per-house: favFirms' rows are fav through and through, but Resolve's
// likeability rides its approval rows as detail.fav (and Hanson pre-Jul-2026
// in her positional slot via the resolve|han override) - the monthly lines,
// the current readings and the gap rails all pool those alt readings onto
// the fav line, so the roster counts a house wherever a row carries a
// favourability READING (metric exists and has a value), not wherever the
// firm is classed a favourability house. Same treatment: current houses in
// creditHouses order, any stopped house last as "Name (inactive)".
const favHouses = creditHousesWithStopped(
  appr.filter((r) =>
    APPR_SLOTS.some(([, lk]) => metricOf(r.firm, lk, r.date) === "fav" && r[lk] != null) ||
    !!(r.splits && r.splits.fav && APPR_SLOTS.some(([, lk]) => r.splits.fav[lk] != null))),
  (r) => r.firm, (r) => Date.parse(r.date));
// The complement roster: the net-APPROVAL houses of the approval series.
// The federal page's net-mode copies name them; the same window and
// "(inactive)" tail apply.
const apprHouses = creditHousesWithStopped(
  appr.filter((r) => !FAV_FIRMS.has(canonFirm(r.firm))),
  (r) => r.firm, (r) => Date.parse(r.date));
// Every published reading behind the monthly line, for the panel's scatter.
// Taken from the direction series rather than from the poll rows, because a
// few waves asked this question without publishing voting intention and so
// have no poll row to hang on – plotting only the joined ones would quietly
// drop them from a chart that DOES average them.
// Field names match what the chart tooltip reads off a scatter point
// (pollster / dateLabel / sample), so a direction dot identifies its poll the
// same way a 2PP or primary dot does. Sample is joined from the voting-intention
// poll where there is one; direction-only waves carry what their writer filed
// (SEC Newgate publishes its n in the methodology block), null where neither
// has it.
const directionPolls = DIR
  .filter((d) => MONTH_SET.has(ymOf(d.date)))
  .map((d) => {
    const p = POLL_BY_KEY.get(d.date + "|" + d.pollster);
    return {
      x: dx(d.date), ym: ymOf(d.date), pollster: d.pollster,
      dateLabel: fwLabel(d.dateStart, d.date), released: d.date,
      ...(d.dateStart ? { fmid: fmidIso(d.dateStart, d.date) } : {}),
      sample: (p && p.sample) || d.sample || null,
      right: d.right, wrong: d.wrong, unsure: d.unsure,
    };
  })
  .sort((a, b) => a.x - b.x);
if (DIRM) { directionPolls.push(...DIRM.extraDots); directionPolls.sort((a, b) => a.x - b.x); }
const dirRight = monthlyAdj(dirRows("right"), dirHe.right);
const dirWrong = monthlyAdj(dirRows("wrong"), dirHe.wrong);
const dirWrongBy = new Map(dirWrong.map((m) => [m.ym, m]));
/* Poll-level readings, keyed onto the poll each was asked in so the archive
   table can show the rows the monthly line above is built from, each with the
   firm's movement on its OWN previous reading (houses differ enough that a
   cross-house change would be noise). Readings from waves that published no
   voting intention have no poll row to key onto – the archive's row set is
   polls that measured voting intention – so those become rows of their own on
   the direction facet (directionOnlyPolls below). */
const DIR_BY = new Map();
{
  const last = {};
  for (const d of [...DIR].sort((a, b) => a.date.localeCompare(b.date))) {
    const net = r1(d.right - d.wrong);
    const prev = last[d.pollster];
    DIR_BY.set(d.date + "|" + d.pollster, {
      right: d.right, wrong: d.wrong, unsure: d.unsure, net,
      ...(dirEffByKey.has(d.date + "|" + d.pollster) ? { eff: dirEffByKey.get(d.date + "|" + d.pollster) } : {}),
      ...(dirYard.at.has(d.date + "|" + d.pollster) ? { yd: dirYard.at.get(d.date + "|" + d.pollster) } : {}),
      // unsure moves on the house's last reading too, so the facet's three
      // share columns each carry their change (a two-answer house's 0 has none)
      ...(prev ? { chg: { net: r1(net - prev.net), right: r1(d.right - prev.right),
                          wrong: r1(d.wrong - prev.wrong),
                          ...(d.unsure > 0 && prev.unsure > 0 ? { unsure: r1(d.unsure - prev.unsure) } : {}) }, ref: prev.date } : {}),
    });
    last[d.pollster] = { net, right: d.right, wrong: d.wrong, unsure: d.unsure, date: d.date };
  }
}

/* Each house's client as the archive table prints it, off its polls[] rows
   (latest wave's figure wins); self-published houses fall to the views'
   "Self-published" wording below. Needed here because a direction-only wave
   has no poll row to copy the label from. */
const CLIENT_BY_HOUSE = new Map();
for (const p of POLLS)
  if (p.client && p.client !== "—") CLIENT_BY_HOUSE.set(p.pollster, p.client);

/* The readings above from waves with no voting-intention poll to join onto,
   as rows of their own for the archive table's direction facet – SEC Newgate,
   which asks only this question, is on file for exactly this, and Essential's
   three national-mood-only waves of May–Aug 2025 (its VI series paused
   between the election and the 2025-09-30 wave) join by the same rule.
   Shaped like an individualPolls row, with empty stubs where the wave
   measured nothing (p / appr), and merged by house+date so one report can
   carry both mood and ratings. Preferred-PM enrichment is applied after
   its helper definitions below. The historic dataset key stays for consumers;
   the facets include each supplemental row only for measures it owns. */
const auxiliaryWaves = new Map();
for (const d of DIR) {
  if (d.date < ELECTION.date || POLL_BY_KEY.has(d.date + "|" + d.pollster)) continue;
  const w = auxiliaryWaves.get(d.date + "|" + d.pollster) || { date: d.date, pollster: d.pollster };
  w.direction = d;
  auxiliaryWaves.set(d.date + "|" + d.pollster, w);
}
for (const a of APPR_BY.values()) {
  if (a.date < ELECTION.date || POLL_BY_KEY.has(a.date + "|" + a.firm)) continue;
  const w = auxiliaryWaves.get(a.date + "|" + a.firm) || { date: a.date, pollster: a.firm };
  w.approval = a;
  auxiliaryWaves.set(a.date + "|" + a.firm, w);
}
const directionOnlyPolls = [...auxiliaryWaves.values()].map((w) => {
  const d = w.direction || {}, a = w.approval || {};
  const ym = ymOf(w.date), fym = d.dateStart ? ymOf(d.dateStart) : null;
  const field = fwLabel(d.dateStart, w.date);
  const meta = Object.keys(d).length ? d : a;
  return {
    ym, x: mx(ym) + (dayOf(w.date) - 15) / 365, day: dayOf(w.date),
    pollster: w.pollster,
    ...(fym != null && fym !== ym ? { fym } : {}),
    field, dateLabel: field, released: w.date, sample: d.sample ?? a.sample ?? null,
    ...(d.dateStart ? { fmid: fmidIso(d.dateStart, w.date) } : {}),
    ...(meta.url ? { url: meta.url } : {}),
    ...(meta.published ? { published: meta.published } : {}),
    ...(meta.methodUrl ? { methodUrl: meta.methodUrl } : {}),
    ...(d.sampleEff != null ? { sampleEff: d.sampleEff } : {}),
    client: CLIENT_BY_HOUSE.get(w.pollster) || "Self-published",
    p: {}, appr: buildAppr(w.date, w.pollster), chg: null,
    ...(d.right != null ? { dir: DIR_BY.get(w.date + "|" + w.pollster) } : {}),
  };
}).sort((a, b) => a.x - b.x || a.released.localeCompare(b.released));

/* ---- 5dh. national direction BACK HISTORY, one house at a time ----------
   data/direction-history.json (rebuilt by .build/backfill-direction-history.mjs)
   carries each house's printed waves before the live direction[] file opens:
   Roy Morgan's tables and sourced releases, SEC Newgate's reprinted national
   chart (series colours identify right/wrong even when they cross), and
   RedBridge's image trend, independently read in two reports. The live rows
   above take over from there — Essential's national-mood question starts June
   2022 — so EVERY house's run is monthly means of its own printed waves,
   nothing pooled across houses, nothing house-effect adjusted and no
   confidence interval (those are the pooled model's, above; this is the
   published record, as the confidence panel's §5l deep series is). A month
   no wave printed stays absent rather than being filled in. Where the two
   files know the same wave, the live row is the one counted. */
const dirHistory = (() => {
  if (JUR) return null;            // federal history only; /vic/ has its own run
  const file = path.join(ROOT, "data", "direction-history.json");
  const old = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : { waves: [] };
  const rows = old.waves.filter((w) => (w.end || w.published || w.month) && (w.right != null || w.wrong != null))
    .map((w) => ({
      // Reprinted house series give an exact month, not fieldwork days. The
      // mid-month date is chart geometry only; `month` stays the identity.
      date: w.end || w.published || `${w.month}-15`, month: w.month,
      pollster: w.pollster || "Roy Morgan", sample: w.sample ?? null,
      right: w.right, wrong: w.wrong,
      unsure: w.unsure != null ? w.unsure : w.right != null && w.wrong != null
        ? Math.max(0, r1(100 - w.right - w.wrong)) : null,
      ...(w.question ? { question: w.question, rightLabel: w.rightLabel, wrongLabel: w.wrongLabel } : {}),
      // a table row duplicating a live wave on figures alone still drops out
      key: `${w.month || w.end}|${w.right}|${w.wrong}`,
    }));
  const liveKeys = new Set(DIR.map((d) => `${d.month || d.date}|${d.right}|${d.wrong}`));
  const byHouse = new Map();
  for (const w of rows) if (!liveKeys.has(w.key)) {
    if (!byHouse.has(w.pollster)) byHouse.set(w.pollster, []);
    byHouse.get(w.pollster).push(w);
  }
  for (const d of DIR) {
    if (d.right == null || d.wrong == null) continue;
    if (!byHouse.has(d.pollster)) byHouse.set(d.pollster, []);
    byHouse.get(d.pollster).push({ date: d.date, right: d.right, wrong: d.wrong,
      unsure: d.unsure != null ? d.unsure : Math.max(0, r1(100 - d.right - d.wrong)) });
  }
  const houses = {}, wordings = {};
  for (const [house, ws] of byHouse) {
    const months = new Map();
    for (const w of ws) {
      const ym = w.month || ymOf(w.date);
      if (!months.has(ym)) months.set(ym, { ym, n: 0, right: 0, wrong: 0, unsure: 0, rn: 0, wn: 0, un: 0, samples: [] });
      const m = months.get(ym);
      m.n++;
      if (w.right != null) { m.rn++; m.right += w.right; }
      if (w.wrong != null) { m.wn++; m.wrong += w.wrong; }
      if (w.unsure != null) { m.un++; m.unsure += w.unsure; }
      if (w.sample != null) m.samples.push(w.sample);
      if (w.question) wordings[house] = { question: w.question, rightLabel: w.rightLabel, wrongLabel: w.wrongLabel };
    }
    const pts = [...months.values()].sort((a, b) => a.ym.localeCompare(b.ym)).map((m) => ({
      ym: m.ym, x: mx(m.ym), n: m.n,
      right: m.rn ? r1(m.right / m.rn) : null,
      wrong: m.wn ? r1(m.wrong / m.wn) : null,
      unsure: m.un ? r1(m.unsure / m.un) : null,
      ...(m.samples.length ? { samples: m.samples } : {}),
      ...(wordings[house] || {}),
    }));
    if (pts.length) houses[house] = pts;
  }
  if (!Object.keys(houses).length) return null;
  const all = Object.values(houses).flat();
  return { houses, wordings, from: all.reduce((a, p) => (p.ym < a ? p.ym : a), all[0].ym),
    sources: old.sources || [] };
})();

/* ---- 5di. Ipsos Australia-and-world national direction. What Worries the
   World publishes Australia and its own global average, not an estimate we
   can average together again. Quantiles are over participating COUNTRIES
   only, each country's net direction, excluding that global average. */
const directionWorld = (() => {
  if (JUR) return null;
  const file = path.join(ROOT, "data", "ipsos-direction.json");
  if (!fs.existsSync(file)) return null;
  const doc = JSON.parse(fs.readFileSync(file, "utf8"));
  const q = (sorted, p) => {
    const at = (sorted.length - 1) * p, lo = Math.floor(at), hi = Math.ceil(at);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (at - lo);
  };
  const waves = [];
  for (const w of doc.waves || []) {
    const ym = w.month, au = w.australia, world = w.globalAverage;
    if (!/^\d{4}-(?:0[1-9]|1[0-2])$/.test(ym || "")) throw new Error(`Ipsos direction: bad month ${ym}`);
    for (const [who, r] of [["Australia", au], ["Global average", world]]) {
      if (r == null || ![r.right, r.wrong].every((v) => Number.isFinite(v) && v >= 0 && v <= 100))
        throw new Error(`Ipsos ${ym}: no complete printed split for ${who}`);
      if (r.sample != null && (!Number.isInteger(r.sample) || r.sample <= 0))
        throw new Error(`Ipsos ${ym}: invalid n for ${who}`);
    }
    const nets = (w.countries || []).filter((c) => Number.isFinite(c.right) && Number.isFinite(c.wrong))
      .map((c) => c.right - c.wrong).sort((a, b) => a - b);
    const band = nets.length >= 4 ? {
      n: nets.length,
      p10: q(nets, 0.1), q25: q(nets, 0.25), p50: q(nets, 0.5), p75: q(nets, 0.75), p90: q(nets, 0.9),
    } : null;
    waves.push({ ym, x: mx(ym),
      auRight: au.right, auWrong: au.wrong, auNet: r1(au.right - au.wrong), auN: au.sample ?? null,
      ...(au.sampleApprox ? { auSampleApprox: true } : {}),
      worldRight: world.right, worldWrong: world.wrong, worldNet: r1(world.right - world.wrong), worldN: world.sample ?? null,
      band, fieldwork: w.fieldwork || null, start: w.start ?? null, end: w.end ?? null,
      source: w.source || doc.source || "Ipsos What Worries the World",
      url: w.sourceUrl || w.url || null });
  }
  waves.sort((a, b) => a.ym.localeCompare(b.ym));
  return { waves, source: doc.source || "Ipsos What Worries the World" };
})();

// Lowy asks about national satisfaction with a distinct question wording.
// Its observations sit in the main chart's separate-wording lane, never the
// pooled estimator, Ipsos' global average or its country distributions.
const directionLowy = JUR ? null : (() => {
  const file = path.join(ROOT, "data", "lowy-direction.json");
  if (!fs.existsSync(file)) return null;
  const doc = JSON.parse(fs.readFileSync(file, "utf8"));
  return { ...doc, waves: doc.waves.map((w) => ({ ...w, x: dx(w.end) })) };
})();

/* ---- 5i. issues waves – per-wave what-matters / who's-best data, keyed to
   the archive row the question was asked in. Same join convention as
   direction above: each salience/ownership wave in data/issues.json carries
   its poll's (or direction row's) date|pollster key, so it rides that row
   where one exists (RedBridge/Accent, Resolve, YouGov, DemosAU) and the
   direction-only row where that's the wave's only home (SEC Newgate – the
   G4 ownership waves date off its direction[] rows). SEC's unprompted-
   concerns and best-party banks ride its direction rows too, straight from
   data/sec-issues.json by survey month. Ipsos asks issues and nothing
   else, so its waves become rows of their own below (issuesOnlyPolls),
   shaped like directionOnlyPolls. A wave that attached to no row would
   vanish from the issues facet silently, so any wave outside the known
   join classes fails the build here. ISSUES_FILE is hoisted out of §7h,
   which pools the same file. */
const ISSUES_FILE = (() => {
  if (JUR) return null;   // federal side data – absent for another jurisdiction
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, "data", "issues.json"), "utf8")); }
  catch { return null; }
})();
const SEC_ISSUES_FILE = (() => {
  if (JUR) return null;   // federal side data – absent for another jurisdiction
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, "data", "sec-issues.json"), "utf8")); }
  catch { return null; }
})();
/* SEC Newgate's per-state state-direction readings (banked by
   extract-secnewgate.mjs) and Roy Morgan's release-prose direction splits
   (gender pair, voting-intention wrong-shares, state extremes – banked by
   extract-roymorgan-direction.mjs). Both feed the National direction
   panel's group select (§5 directionStates/directionGroups/directionStateNote). */
const SEC_STATES = (() => {
  if (JUR) return null;   // federal side data – absent for another jurisdiction
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, "data", "sec-direction-states.json"), "utf8")); }
  catch { return null; }
})();
const RM_DIR_GROUPS = (() => {
  if (JUR) return null;   // federal side data – absent for another jurisdiction
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, "data", "roymorgan-direction-groups.json"), "utf8")); }
  catch { return null; }
})();
/* Essential's national-mood breakdowns, banked by
   extract-essential-direction.mjs out of the assimilated CSV mirror into
   data/essential-direction-groups.json: Men/Women and 18–34/35–54/55+
   right/wrong/unsure cells per wave, keyed by tracker date with dirRow –
   the polls.json direction-row date the wave's TOTAL reconciled with,
   which is the key the group select's dot tips join on. */
const ESS_DIR_GROUPS = (() => {
  if (JUR) return null;   // federal side data – absent for another jurisdiction
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, "data", "essential-direction-groups.json"), "utf8")); }
  catch { return null; }
})();
/* RedBridge/Accent's national-direction breakdowns, hand-entered into
   data/redbridge-direction-groups.json from the three AFR data-table
   statements that carry them (Nov 2025 Tables 47–48, Jan 2026 Table 27,
   May 2026 Table 38 – the only statements with the section; the store's
   _about records the full checked set). Cells are dim-blocked printed
   rows; the wave's `total` is the statement's all-voters row, which
   reconciles exactly with the polls.json direction row for its date. */
const RB_DIR_GROUPS = (() => {
  if (JUR) return null;   // federal side data – absent for another jurisdiction
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, "data", "redbridge-direction-groups.json"), "utf8")); }
  catch { return null; }
})();
/* Essential's national-mood splits, columned out of the assimilated CSV
   (data/essential-report.csv): every wave's trend table carries Male/Female
   and 18-34/35-54/55+ cuts beside the headline print – keyed here by the
   CSV's report date, matched to a direction row by its printed headline
   (the CSV's date is the Guardian stamp, a day either way of the row's
   fieldwork date). national_mood lines are never quote-bearing. */
const ESS_DIR = (() => {
  if (JUR) return null;   // federal side data – absent for another jurisdiction
  try {
    const txt = fs.readFileSync(path.join(ROOT, "data", "essential-report.csv"), "utf8");
    const DIMS = new Set(["Trend", "Male", "Female", "18-34", "35-54", "55+"]);
    const waves = {};
    for (const ln of txt.split(/\r?\n/)) {
      if (!ln.startsWith("national_mood,")) continue;
      const c = ln.split(",");
      const dim = c[3], answer = c[4], date = c[7], v = +c[8];
      if (!DIMS.has(dim) || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(v)) continue;
      if (answer !== "Right direction" && answer !== "Wrong track") continue;
      const w = (waves[date] ??= {});
      (w[dim] ??= {})[answer === "Right direction" ? "r" : "w"] = v;
    }
    return Object.keys(waves).length ? { waves } : null;
  } catch { return null; }
})();
/* The confidence panel's series (§5j): four published confidence gauges —
   the ANZ–Roy Morgan and Roy Morgan index series, Westpac–MI consumer
   sentiment and NAB's monthly business survey (a net balance the panel
   draws shifted +100; this payload keeps its printed figures) — built by
   .build/confidence.mjs from each house's own releases. The panel dots
   these prints raw and draws a recency-weighted smoothed trend on top
   (render side, rd-panels.jsx) - this payload stays the published
   readings. */
const CONF_FILE = (() => {
  if (JUR) return null;   // federal side data – absent for another jurisdiction
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, "data", "confidence.json"), "utf8")); }
  catch { return null; }
})();
/* Its DEEP back-history (§5k): the four gauges back to their series
   starts (consumer 1973, NAB conditions 1997, Westpac 2010, business
   2010), built by .build/confidence-history.mjs — one row per survey
   month {ym, v}, the monthly-frequency sibling of the releases file.
   This is what the past-term bands and the draw-a-term lines are
   aligned from; the current term never reads it (its monthly rows
   duplicate the live releases, which win). */
const CONF_HISTORY_FILE = (() => {
  if (JUR) return null;   // federal side data – absent for another jurisdiction
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, "data", "confidence-history.json"), "utf8")); }
  catch { return null; }
})();
/* The Economic sentiment panel's "Inflation & growth" view (§5m): the ABS
   CPI, GDP-per-capita and unemployment-rate series and their OECD
   comparators, built by
   .build/macro.mjs straight off the ABS and OECD data APIs — the payloads
   stay the published (or index-derived, per the file's _about) annual
   changes (the unemployment lane rides its published level), per-row
   {date, v}; dots and any splice are render-side. */
const MACRO_FILE = (() => {
  if (JUR) return null;   // federal side data – absent for another jurisdiction
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, "data", "macro.json"), "utf8")); }
  catch { return null; }
})();
const ISSUE_SHARED = ["col", "housing", "health", "economy", "immigration", "climate", "crime", "security"];
const ISS_ONLY = new Set(["Ipsos"]);   // issues houses with no poll/direction rows to join
const ISS_BY = new Map();              // "date|pollster" → the wave's issues payload
{
  const labelOf = (k) => ((ISSUES_FILE && ISSUES_FILE.issues) || {})[k] || k;
  const put = (key, patch) => ISS_BY.set(key, { ...(ISS_BY.get(key) || {}), ...patch });
  const unhomed = [];
  if (ISSUES_FILE) {
    /* The issues file's history runs further back than the archive (Resolve
       has ownership waves from 2021; the All-polls table starts with the
       current term): a wave in a month the archive doesn't cover simply has
       no row to join and is pooled by §7h only. A wave inside the archive's
       months with no row to join is a broken join and fails the build. */
    const homeless = (w) => {
      if (!MONTH_SET.has(ymOf(w.date))) return false;
      unhomed.push(w.date + "|" + w.pollster);
      return true;
    };
    for (const w of ISSUES_FILE.salience) {
      const key = w.date + "|" + w.pollster;
      if (w.pollster !== "Ipsos" && !POLL_BY_KEY.has(key) && !DIR_BY.has(key)) { homeless(w); continue; }
      const entries = Object.entries(w.issues).filter(([, v]) => v && v.top3 != null)
        .sort((a, b) => b[1].top3 - a[1].top3);
      const patch = { sal: entries.slice(0, 8).map(([k, v]) => v.r1 != null ? [labelOf(k), v.top3, v.r1] : [labelOf(k), v.top3]) };
      if (entries.length) patch.top = entries[0][0];
      put(key, patch);
    }
    for (const w of ISSUES_FILE.ownership) {
      const key = w.date + "|" + w.pollster;
      if (w.pollster !== "Ipsos" && !POLL_BY_KEY.has(key) && !DIR_BY.has(key)) { homeless(w); continue; }
      const cur = ISS_BY.get(key) || {};
      put(key, {
        own: w.issues,
        ...(w.options ? { opts: w.options } : {}),
        ...(w.question ? { q: w.question } : {}),
        ...(cur.top ? {} : { top: ISSUE_SHARED.find((k) => w.issues[k]) || Object.keys(w.issues)[0] }),
      });
    }
  }
  if (SEC_ISSUES_FILE && SEC_ISSUES_FILE.series) {
    const byMonth = {};
    for (const [label, sights] of Object.entries(SEC_ISSUES_FILE.series))
      for (const s of sights || []) if (s && s.mention != null) (byMonth[s.month] ||= {})[label] = s.mention;
    const bp = SEC_ISSUES_FILE.bestParty || {};
    for (const d of DIR.filter((x) => x.pollster === "SEC Newgate")) {
      const ym = ymOf(d.date), key = d.date + "|" + d.pollster;
      const m = byMonth[ym], b = bp[ym];
      if (m) put(key, { conc: Object.entries(m).sort((a, b2) => b2[1] - a[1]).slice(0, 8)
        .map(([l, v]) => [l, v]), top: (ISS_BY.get(key) || {}).top || "col" });
      if (b) put(key, { bp: b, top: (ISS_BY.get(key) || {}).top || "col" });
    }
  }
  if (unhomed.length)
    throw new Error(`issues waves with no archive row to join: ${unhomed.join(", ")}`);
  /* …and onto the direction-only rows, which were emitted just above this
     block: SEC Newgate's waves are exactly the ones carrying conc/bp. */
  for (const p of directionOnlyPolls) {
    const iss = ISS_BY.get(p.released + "|" + p.pollster);
    if (iss) p.iss = iss;
  }
}

/* Ipsos's waves, as rows of their own for the archive's issues facet – the
   one house that publishes its issue questions with no voting-intention or
   direction row for them to ride on. Empty stubs (p / appr) as with
   directionOnlyPolls; its release link is the wave's report PDF.
   `published` here is DATE-ONLY: Ipsos stamps no clock a page could quote,
   and a re-hosted PDF keeps re-dating - but the FIRST CDN landing of a
   wave's earliest variant is provable from the extractor's ipsos-src
   sidecars (uploadedAt, else pdfCreated, else firstSeenAt; Jun 2026 shipped
   two copies two minutes apart - the wave takes the earlier) and, for the
   latest wave, from the issuesmonitor page's own dateModified. The rows
   used to carry no stamp and show fieldwork only; the publish DATE was
   knowable all along, only the hour never was. */
const issuesOnlyPolls = (() => {
  if (!ISSUES_FILE) return [];
  const MON3_IX = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
  const pdfYm = (u) => {
    const m = /^IM_Nat_([A-Za-z]+?)_?(\d{2})(?:_|\.|$)/.exec(path.basename(decodeURIComponent(u || "")));
    const mo = m && MON3_IX[m[1].slice(0, 3).toLowerCase()];
    return mo ? `20${m[2]}-${String(mo).padStart(2, "0")}` : null;
  };
  const firstLanding = (() => {
    const dir = path.join(ROOT, ".build", "ipsos-src"), out = new Map();
    if (fs.existsSync(dir))
      for (const f of fs.readdirSync(dir)) {
        if (!f.endsWith(".json")) continue;
        let j; try { j = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")); } catch { continue; }
        if (!j || j.kind !== "report") continue;
        const ym = pdfYm(j.pdf);
        if (!ym) continue;
        const at = (j.uploadedAt || j.pdfCreated || j.firstSeenAt || "").slice(0, 10);
        if (at && (!out.get(ym) || at < out.get(ym))) out.set(ym, at);
      }
    return out;
  })();
  const byDate = new Map();
  for (const w of [...ISSUES_FILE.salience, ...ISSUES_FILE.ownership])
    if (ISS_ONLY.has(w.pollster) && MONTH_SET.has(ymOf(w.date))) byDate.set(w.date, w);
  return [...byDate.values()].map((w) => {
    const ym = ymOf(w.date), fym = w.dateStart ? ymOf(w.dateStart) : null;
    const field = fwLabel(w.dateStart, w.date);
    const pub = firstLanding.get(pdfYm(w.source) || ym) || null;
    return {
      ym, x: mx(ym) + (dayOf(w.date) - 15) / 365, day: dayOf(w.date),
      pollster: w.pollster,
      ...(fym != null && fym !== ym ? { fym } : {}),
      field, dateLabel: field, released: w.date, sample: w.sample ?? null,
      ...(w.dateStart ? { fmid: fmidIso(w.dateStart, w.date) } : {}),
      ...(pub ? { published: pub } : {}),
      ...(w.sampleEff != null ? { sampleEff: w.sampleEff } : {}),
      ...(w.source ? { url: w.source } : {}),
      ...(w.methodUrl ? { methodUrl: w.methodUrl } : {}),
      client: "Self-published",
      p: {}, appr: {}, chg: null,
      iss: ISS_BY.get(w.date + "|" + w.pollster),
    };
  }).sort((a, b) => a.x - b.x || a.released.localeCompare(b.released));
})();

/* Both lines carry their interval, on the same terms as the 2PP: the spread
   between the houses that asked, floored by sampling error. Three houses ask
   this question and some months rest on one of them, so these are the widest
   bands on the site – which is the honest shape of a series this thin, and
   was previously only said in the caption. */
const dirRightRows = dirRows("right"), dirWrongRows = dirRows("wrong");
const directionOld = DIRM ? null : dirRight.map((m) => {
  const w = dirWrongBy.get(m.ym);
  if (!w) return null;
  const right = r1(m.v), wrong = r1(w.v);
  const rSe = monthWithSe(dirRightRows, dirHe.right, m.ym);
  const wSe = monthWithSe(dirWrongRows, dirHe.wrong, m.ym);
  // unsure is the remainder, floored at 0: right and wrong are independently
  // estimated series, and a thin month's two estimates can cross 100 - a
  // negative share prints nonsense and breaks the stacked bar's geometry
  return { ym: m.ym, x: m.x, right, wrong, unsure: r1(Math.max(0, 100 - right - wrong)),
           net: r1(right - wrong), n: m.k,
           rightCi: rSe ? r1(1.96 * rSe.se) : null,
           wrongCi: wSe ? r1(1.96 * wSe.se) : null };
}).filter(Boolean);
const direction = DIRM ? DIRM.direction : directionOld;

/* The panel's current reading: the headline construction – three-week
   window, house-adjusted – not the last calendar month, which early in a
   month is one Roy Morgan wave. Right and wrong are each their own nowcast,
   unsure the remainder, as in the monthly rows. The net's change is tested
   on its own series with its own house effects (never borrowed between
   measures): a net is a difference of two proportions, with the net's
   sampling variance, not a share's. */
const directionNowOld = DIRM ? null : (() => {
  const r = currentReading(dirRightRows, dirHe.right), w = currentReading(dirWrongRows, dirHe.wrong);
  const net = currentReading(dirNetRows, dirHeNet);
  if (!r || !w) return null;
  const out = { right: r.v, wrong: w.v, unsure: r1(Math.max(0, 100 - r.v - w.v)), net: r1(r.v - w.v),
                rightCi: r.ci95, wrongCi: w.ci95, n: Math.max(r.n, w.n) };
  if (r.prev != null && w.prev != null) {
    out.chg = r1((r.v - w.v) - (r.prev - w.prev));
    if (net && net.changeCi95 != null) { out.changeCi95 = net.changeCi95; out.changeSig = Math.abs(out.chg) > net.changeCi95; }
  }
  return out;
})();
const directionNow = DIRM ? DIRM.directionNow : directionNowOld;

/* ---- 5dp. national direction, the houses' runs before this term ----
   SEC Newgate starts the multi-house span in March 2022, Essential joins
   in June 2022 and RedBridge/Accent in February 2024. Every printed wave
   joins in its own month; these are not treated as a continuously staffed
   panel of four. The estimator is the headline's – sample-weighted
   monthly means, repeat waves deflated to sqrt(m), intervals from the
   spread floored by sampling error. Two-house stretches use pairLeanFor
   (an unidentified level means no whole gap can be assigned to one house);
   three or more houses use houseEffectsFor as the current-term series
   does. House-reprinted series carry an exact month only, placed at its
   midpoint in the model but labelled with their month and no fieldwork
   days. Before March 2022 Roy Morgan's printed waves alone supply the
   series. Waves with no printed sample take the standing 1200 default. */
const DIR_PRE_FROM = "2022-03";
const DIR_PRE_HOUSES = ["Roy Morgan", "SEC Newgate", "Essential", "RedBridge/Accent", "Freshwater"];
const dirPreLeanFor = (rows) => {
  const firms = [...new Set(rows.map((r) => r.firm))];
  const multiple = houseEffectsFor(rows);
  const pairs = new Map();
  const at = (firm, t) => {
    // Coverage varies by month. Only the multi-house estimator can charge an
    // individual house a whole measured lean; where just two houses overlap,
    // use those two houses' own pair, half the unidentified gap either side.
    const here = [...new Set(rows.filter((r) => Math.abs(ddays(r.mid, t)) <= HE_WINDOW).map((r) => r.firm))];
    if (here.length < 3) {
      const key = here.join("|");
      if (!pairs.has(key)) pairs.set(key, pairLeanFor(rows.filter((r) => here.includes(r.firm))));
      return pairs.get(key).at(firm, t);
    }
    return multiple.at(firm, t);
  };
  return { firms, estimable: multiple.estimable, evidenceN: multiple.evidenceN,
    snapshot: multiple.snapshot, at,
    gapAt: (t) => firms.length < 2 ? null : at(firms[0], t) - at(firms[1], t) };
};
const directionPre = (() => {
  if (DIRM) return DIRM.directionPre;
  if (JUR || !direction.length) return null;
  const to = direction[0].ym;                    // exclusive: the pooled series takes over here
  const inPre = (ym) => ym && ym >= DIR_PRE_FROM && ym < to;
  const live = DIR.filter((d) => d.right != null && d.wrong != null && inPre(ymOf(d.date)));
  const liveKeys = new Set(DIR.map((d) => `${d.pollster}|${d.date}|${d.right}|${d.wrong}`));
  const file = path.join(ROOT, "data", "direction-history.json");
  const hist = (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")).waves : [])
    .filter((w) => (w.end || w.month) && w.right != null && w.wrong != null && inPre(w.month || ymOf(w.end))
      && w.pollster !== "McKinnon"
      && !liveKeys.has(`${w.pollster || "Roy Morgan"}|${w.end}|${w.right}|${w.wrong}`))
    .map((w) => ({ date: w.end || `${w.month}-15`, dateStart: w.start && w.start !== w.end ? w.start : null,
      month: w.month || null, pollster: w.pollster || "Roy Morgan", right: w.right, wrong: w.wrong, sample: w.sample,
      dateLabel: w.label || (w.month ? `${MNF[+w.month.slice(5, 7) - 1]} ${w.month.slice(0, 4)}` : null), url: w.url || null }));
  const waves = [...live.map((d) => ({ date: d.date, dateStart: d.dateStart || null, pollster: d.pollster,
      right: d.right, wrong: d.wrong, sample: dirSample(d), dateLabel: null, url: d.url || null })), ...hist]
    .filter((w) => DIR_PRE_HOUSES.includes(w.pollster))
    .sort((a, b) => a.date.localeCompare(b.date));
  if (new Set(waves.map((w) => w.pollster)).size < 2) return null;
  const rowsOf = (k) => waves.map((w) => ({ ym: w.month || ymOf(w.date), mid: midMs(w), x: w[k],
    n: Math.min(w.sample || 1200, SAMPLE_CAP), firm: w.pollster }));
  const rR = rowsOf("right"), rW = rowsOf("wrong");
  const he = { right: dirPreLeanFor(rR), wrong: dirPreLeanFor(rW) };
  const months = [];
  for (let y = +DIR_PRE_FROM.slice(0, 4), m = +DIR_PRE_FROM.slice(5, 7); ; m++) {
    if (m > 12) { m = 1; y++; }
    const ym = `${y}-${String(m).padStart(2, "0")}`;
    if (ym >= to) break;
    months.push(ym);
  }
  const series = months.map((ym) => {
    const r = monthWithSe(rR, he.right, ym), w = monthWithSe(rW, he.wrong, ym);
    if (!r || !w) return null;
    const right = r1(r.v), wrong = r1(w.v);
    return { ym, x: mx(ym), right, wrong, unsure: r1(Math.max(0, 100 - right - wrong)), net: r1(right - wrong),
      n: r.n, rightCi: r1(1.96 * r.se), wrongCi: r1(1.96 * w.se) };
  }).filter(Boolean);
  // the waves themselves, as the panel's dots (the current term's are directionPolls)
  const polls = waves.map((w) => ({ x: mx(ymOf(w.date)) + (dayOf(w.date) - 15) / 365, pollster: w.pollster,
    released: w.date, dateLabel: w.dateLabel || fwLabel(w.dateStart, w.date), right: w.right, wrong: w.wrong,
    sample: w.sample ?? null,
    ...(w.url ? { url: w.url } : {}) }));
  /* Before March 2022 Roy Morgan asked alone. Its months are built the same
     way (monthWithSe: sample-weighted, sqrt(m) repeat deflation, the
     interval from the spread between its waves floored by sampling error)
     with no lean to remove – one house has no consensus to lean from – so
     the line and its band run on in the same form behind the pooled
     stretch. A month no wave printed stays absent; the panel breaks the
     line across gaps longer than a quarter. */
  const solo = (() => {
    const ws = (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")).waves : [])
      .filter((w) => (w.end || w.published) && w.right != null && w.wrong != null
        && (w.pollster || "Roy Morgan") === "Roy Morgan" && ymOf(w.end || w.published) < DIR_PRE_FROM)
      .map((w) => ({ date: w.end || w.published, dateStart: w.start && w.start !== w.end ? w.start : null,
        pollster: "Roy Morgan", right: w.right, wrong: w.wrong, sample: w.sample, dateLabel: w.label || null, url: w.url || null }))
      .sort((a, b) => a.date.localeCompare(b.date));
    const rows = (k) => ws.map((w) => ({ ym: ymOf(w.date), mid: midMs(w), x: w[k], n: Math.min(w.sample || 1200, SAMPLE_CAP), firm: w.pollster }));
    const sr = rows("right"), sw = rows("wrong");
    const yms = [...new Set(sr.map((r) => r.ym))].sort();
    const series = yms.map((ym) => {
      const r = monthWithSe(sr, null, ym), w = monthWithSe(sw, null, ym);
      if (!r || !w) return null;
      const right = r1(r.v), wrong = r1(w.v);
      return { ym, x: mx(ym), right, wrong, unsure: r1(Math.max(0, 100 - right - wrong)), net: r1(right - wrong),
        n: r.n, rightCi: r1(1.96 * r.se), wrongCi: r1(1.96 * w.se) };
    }).filter(Boolean);
    return { series, waves: ws };
  })();
  for (const w of solo.waves) polls.push({ x: mx(ymOf(w.date)) + (dayOf(w.date) - 15) / 365, pollster: w.pollster,
    released: w.date, dateLabel: w.dateLabel || fwLabel(w.dateStart, w.date), right: w.right, wrong: w.wrong,
    sample: w.sample ?? null,
    ...(w.url ? { url: w.url } : {}) });
  polls.sort((a, b) => a.x - b.x);
  const gap = (k) => { const g = he[k].gapAt(Date.parse(to + "-01T00:00:00Z")); return g == null ? null : r1(g); };
  return { from: DIR_PRE_FROM, to, houses: he.right.firms, series, polls, solo: solo.series,
    // firms[0] minus firms[1] at the hand-over, for Info and the build log
    gapAtJoin: { right: gap("right"), wrong: gap("wrong") } };
})();

/* The panel's GROUP views (the select on the National direction chart).
   Two federal-only sources, both left as printed – never house-adjusted,
   never smoothed; the panel caption says so:
   · directionStates – SEC Newgate's per-State state-direction readings from
     data/sec-direction-states.json (its own question, "perceived direction
     of individual states", five mainland states). right only before the
     cache horizon; points ride `x` exactly (no estimation). NOT in the
     panel's select: each state rates its own direction, not the nation's,
     so it is no subgroup of the national question – it waits for a home
     of its own.
   · directionGroups – the subgroup views, every split read OFF ITS OWN
     WAVE and anchored to the national headline, never pooled as raw
     prints: Roy Morgan's "Analysis by …" prose splits from
     data/roymorgan-direction-groups.json (the gender pair, and the
     voting-intention right/wrong shares; ALP's right share plus the
     wrong-share of every other group – a fortnight that printed no cut
     for a group simply leaves that wave out of its pool),
     Essential's banked mood splits from
     data/essential-direction-groups.json (gender and age bands on the
     wave field of every Essential wave: right/wrong/unsure cells; the
     unsure cell never charts), and RedBridge/Accent's statement
     tables from data/redbridge-direction-groups.json (vote, vote
     softness, generation, gender, location, education and home
     ownership on the three waves that print them; income, stress and
     the Nov-only trims are banked, not surfaced). Houses MERGE at
     group level exactly the
     way they merge at all-voters level: each wave's group figure is
     differenced against the all-voters figure its own release printed
     (the wave's house lean cancels in the difference, so no group-grain
     house effects are needed), the gaps pool n-weighted month by month
     across houses, and the pooled gap rides the lean-adjusted
     all-voters headline. Men appears once – Essential's, Roy
     Morgan's and RedBridge/Accent's readings meet in one line, each
     house's own readings still shown dot by dot.
   · directionStateNote – the latest Roy Morgan release's printed state
     highest/lowest extremes; the full state table is paywalled, so the
     extremes are the only state cut that exists.

   Tip provenance: every group/state series row that joins a polls.json
   direction row carries that row's pollster / dateLabel / released /
   sample fields, the exact fields TrendChart's dot tip reads off meta
   (see directionPolls below for the same contract), so a group dot
   identifies its wave – fieldwork window, n where a sample is on file,
   and the click-through to the archive row – the way a headline dot
   does. A banked month or wave with no row to join simply carries none
   of the fields, and the render layer falls back to the month label. */
const dirTipOf = (d) => ({
  pollster: d.pollster,
  dateLabel: fwLabel(d.dateStart, d.date),
  released: d.date,
  sample: POLL_BY_KEY.get(d.date + "|" + d.pollster)?.sample || d.sample || null,
});
const directionStateNote = (() => {
  if (!RM_DIR_GROUPS?.waves) return null;
  const dates = Object.keys(RM_DIR_GROUPS.waves).filter((d) => RM_DIR_GROUPS.waves[d]?.stateExtremes).sort();
  const d = dates[dates.length - 1];
  return d ? { date: d, ...RM_DIR_GROUPS.waves[d].stateExtremes } : null;
})();
/* §5t Trust in the federal government – the National mood section's Trust
   view. Hand-filed in data/trust-government.json: every survey words the
   question its own way (confidence v trust, four-point v 0–10, "the
   national government" v "people in government"), so nothing here is
   pooled or lean-adjusted. ANUpoll (role "line") is the only one asked
   quarterly and draws the line; its 2024 move from the Life in Australia
   panel to ORU's opt-in panel is a break the chart keeps visible (`panel`).
   "dot" series ride as their own readings over that line; "long" series
   draw the long view, each on its own. Every reading gains its x. */
const trustGov = (() => {
  if (JUR) return null; // federal trust only; a state build has no Trust view
  let src;
  try { src = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "trust-government.json"), "utf8")); }
  catch { return null; }
  const series = (src.series || []).map((s) => ({
    ...s,
    readings: [...s.readings].sort((a, b) => a.date.localeCompare(b.date)).map((r) => ({ ...r, x: mx(r.date) })),
  }));
  if (!series.some((s) => s.role === "line")) return null;
  /* ---- 5t. one line from every survey (trust-model.mjs, 2026-11-22) -----
     ANUpoll, Scanlon, the AES, the OECD survey, Edelman, Essential and
     McKinnon, each through its own lean (ANUpoll's and Scanlon's earlier
     panels as surveys of their own), printed on the AES's terms (TRUST_REF). The OECD
     and Edelman global averages are moved onto the same terms by their own
     survey's lean in Australia. */
  /* the survey whose terms the line is printed on: the AES since 2026-11-23
     (user decision; it reaches back to 1969, so history sharpens and the
     present widens), ANUpoll's current panel before */
  const TRUST_REF = "AES";
  const TRUST_N = { "ANUpoll (Life in Australia)": 3000, ANUpoll: 3500, Essential: 1000, "Essential (federal parliament)": 1000, McKinnon: 4300, "Scanlon (telephone)": 1500, Scanlon: 3500, AES: 2000, "OECD Australia": 2000, Edelman: 1150, AustraliaSCAN: 2000 };
  const houseOf = (s, r) => s.id === "anupoll" ? (r.panel === "lia" ? "ANUpoll (Life in Australia)" : "ANUpoll")
    : s.id === "scanlon" ? (r.mode === "tel" ? "Scanlon (telephone)" : "Scanlon")
    : ({ essential: "Essential", "essential-parliament": "Essential (federal parliament)", mckinnon: "McKinnon", aes: "AES", "oecd-au": "OECD Australia", edelman: "Edelman", australiascan: "AustraliaSCAN" })[s.id] || null;
  const TDAY = (ym) => Math.floor(Date.parse(ym + "-15T00:00:00Z") / 86400000);
  const readings = [];
  for (const s of series) for (const r of s.readings) {
    const house = houseOf(s, r);
    if (house) readings.push({ house, day: TDAY(r.date), v: r.v, n: r.n || TRUST_N[house], sid: s.id, date: r.date });
  }
  const tFirst = Math.min(...readings.map((r) => r.day)), tLast = Math.max(...readings.map((r) => r.day));
  const ymOfDay = (d) => new Date(d * 86400000).toISOString().slice(0, 7);
  const months = [];
  for (let y = +ymOfDay(tFirst).slice(0, 4), m = +ymOfDay(tFirst).slice(5, 7); ; m++) {
    if (m > 12) { m = 1; y++; }
    const ym = `${y}-${String(m).padStart(2, "0")}`, day = TDAY(ym);
    if (day > tLast) break;
    if (day >= tFirst) months.push({ ym, day });
  }
  /* "since just after the latest election": the first ANUpoll wave after it */
  const lastElec = ["2022-05-21", "2025-05-03"].filter((d) => TDAY(d.slice(0, 7)) <= tLast).pop();
  const anu = series.find((s) => s.id === "anupoll");
  const afterElec = lastElec && anu.readings.find((r) => r.date > lastElec.slice(0, 7));
  const yearAgo = tLast - 365, elecDay = afterElec ? TDAY(afterElec.date) : null;
  const t0 = Date.now();
  const fit = fitTrust(readings, { core: new Set(["ANUpoll", "Essential", "McKinnon", "Scanlon", "AES", "OECD Australia", "Edelman"]), ref: TRUST_REF,
    days: [...months.map((m) => m.day), yearAgo, ...(elecDay ? [elecDay] : [])], nDraw: 1000 });
  const at = (day) => fit.draws.map((d) => d.v[fit.slotOfDay.get(day)]);
  /* changes are measured on the pooled level with the reference's lean held
     at today's value, so a change is movement in trust, not the reference
     survey's own drift (2026-11-23) */
  const atPooled = (day) => fit.draws.map((d) => 100 / (1 + Math.exp(-(d.m[fit.slotOfDay.get(day)] + d.hRef))));
  const S = (a) => ({ v: r1(tmean(a)), lo: r1(tquant(a, 0.025)), hi: r1(tquant(a, 0.975)) });
  /* the line is drawn from the start of the run of months, ending now, whose
     95% band is under BAND_MAX points: 20 at first (user decision 2026-11-22),
     25 since the user asked for a line from 2010 (2026-11-23), where the band
     runs 18–23 points wide; the month of the pandemic jump itself (its band
     widens for a moment by design) doesn't break the run */
  const BAND_MAX = 25;
  /* earlier, the line is drawn dashed with a fainter band where its band is
     under BAND_FAINT points – from 1993, when AustraliaSCAN and the AES give
     yearly-ish readings (user ask 2026-11-23: "extended drawn") */
  const BAND_FAINT = 36;
  const mRows = months.map(({ ym, day }) => { const s = S(at(day)); return { ym, x: mx(ym), ...s, on: s.hi - s.lo < BAND_MAX, faint: s.hi - s.lo < BAND_FAINT }; });
  const jumpYms = new Set(["2020-03"]);
  let firstOn = mRows.length - 1;
  while (firstOn > 0 && (mRows[firstOn - 1].on || jumpYms.has(mRows[firstOn - 1].ym))) firstOn--;
  let firstFaint = firstOn;
  while (firstFaint > 0 && mRows[firstFaint - 1].faint) firstFaint--;
  const nowA = at(tLast), diffS = (a, b) => { const d = a.map((v, i) => v - b[i]); const s = S(d); return { chg: s.v, lo: s.lo, hi: s.hi, sig: s.lo > 0 || s.hi < 0, pUp: r2(d.filter((v) => v > 0).length / d.length) }; };
  /* "the lowest since <month>": the latest earlier month whose line sits at
     or below today's, provided today sits significantly below every month
     between (95% of draws) – else no claim; "record" when no earlier month
     in the span is at or below today */
  const extreme = (fromYm, low) => {
    const span = months.filter((m) => m.ym >= fromYm && m.day < tLast - 60);
    const nowMean = tmean(nowA);
    const atOrBeyond = span.filter((m) => (low ? tmean(at(m.day)) <= nowMean : tmean(at(m.day)) >= nowMean));
    const last = atOrBeyond[atOrBeyond.length - 1];
    const between = span.filter((m) => !last || m.day > last.day);
    const sigBetween = between.every((m) => { const a = at(m.day); let k = 0; for (let i = 0; i < a.length; i++) if (low ? nowA[i] < a[i] : nowA[i] > a[i]) k++; return k / a.length >= 0.95; });
    if (!sigBetween || !between.length) return null;
    return last ? { since: last.ym } : { record: true };
  };
  const leanAdj = (house, day) => fit.leanAt(house, day);
  const adj = {};
  for (const r of readings) (adj[r.sid] ||= []).push({ date: r.date, x: mx(r.date), v: r1(trustTerms(r.v, leanAdj(r.house, r.day))) });
  /* a global average moves onto the reference's terms by its own survey's lean in
     Australia, as the Ipsos world figure does on the direction chart */
  const avgAdj = (sid, house) => { const s = series.find((x) => x.id === sid); return s ? s.readings.map((r) => ({ date: r.date, x: mx(r.date), v: r1(trustTerms(r.v, leanAdj(house, TDAY(r.date)))), printed: r.v, countries: r.countries })) : []; };
  const oecdAvgAdj = avgAdj("oecd-avg", "OECD Australia"), edelmanAvgAdj = avgAdj("edelman-avg", "Edelman");
  const brk = (a, b, day) => r1(trustTerms(50, -leanAdj(a, day)) - trustTerms(50, -leanAdj(b, day)));
  const model = {
    ref: TRUST_REF, method: "bayes", draws: fit.n, months: mRows, firstOn: mRows[firstOn].ym, bandMax: BAND_MAX, firstFaint: mRows[firstFaint].ym, bandFaint: BAND_FAINT,
    now: { ym: ymOfDay(tLast), x: mx(ymOfDay(tLast)), ...S(nowA),
      year: { from: ymOfDay(yearAgo), ...diffS(nowA, atPooled(yearAgo)) },
      ...(elecDay ? { election: { date: lastElec, ym: afterElec.date, ...diffS(nowA, atPooled(elecDay)) } } : {}),
      low2020: extreme("2020-01", true), high2020: extreme("2020-01", false), lowOn: extreme(mRows[firstOn].ym, true) },
    adj, oecdAvgAdj, edelmanAvgAdj,
    /* how far an earlier panel read above the current one, in points near 50% */
    breaks: { anupoll: brk("ANUpoll (Life in Australia)", "ANUpoll", TDAY("2024-01")), scanlon: brk("Scanlon (telephone)", "Scanlon", TDAY("2018-07")) },
  };
  console.log(`trust model: ${readings.length} readings in ${((Date.now() - t0) / 1000).toFixed(1)}s | now ${model.now.v} [${model.now.lo}, ${model.now.hi}] on ${TRUST_REF}'s terms`
    + ` | year ${model.now.year.chg} [${model.now.year.lo}, ${model.now.year.hi}] | line from ${model.firstOn} | breaks ANU ${model.breaks.anupoll} Scanlon ${model.breaks.scanlon}`
    + ` | best ${JSON.stringify(fit.best)}${fit.edges.length ? " | GRID EDGE " + fit.edges : ""}`);
  return { series, model };
})();
const directionStates = (() => {
  if (!SEC_STATES?.series) return null;
  // the states bank keys by month; the tip row resolves the wave-END month
  // first, then the publication and fieldwork-start months (the same
  // resolution the expanded-poll breakdown ledger uses)
  const secTipByMonth = (() => {
    const byMonth = new Map();
    const pass = (read) => {
      for (const d of DIR.filter((x) => x.pollster === "SEC Newgate")) {
        const s = read(d);
        if (s) { const ym = ymOf(String(s).slice(0, 10)); if (!byMonth.has(ym)) byMonth.set(ym, d); }
      }
    };
    pass((d) => d.date); pass((d) => d.published); pass((d) => d.dateStart);
    return byMonth;
  })();
  const perState = {};
  for (const st of SEC_STATES.states || []) {
    const rows = SEC_STATES.series[st] || [];
    perState[st] = {
      label: st,
      source: "SEC Newgate",
      head: rows.length ? rows[rows.length - 1] : null,
      series: rows.map((r) => ({
        ym: r.month, x: mx(r.month), right: r.right, wrong: r.wrong ?? null,
        ...(secTipByMonth.get(r.month) ? dirTipOf(secTipByMonth.get(r.month)) : {}),
      })),
    };
  }
  return perState;
})();
const directionGroups = (() => {
  const out = {};
  const dirRowByDate = (pollster) => {
    const m = new Map();
    for (const d of DIR.filter((x) => x.pollster === pollster)) m.set(d.date, d);
    return m;
  };
  /* Substrate: one row per (group, wave), ALREADY DIFFERENCED against the
     all-voters figure the same wave printed – gapR/gapW are the group's
     right/wrong minus the wave's all-voters right/wrong, so a house's
     lean on the headline level never enters the pool. The approximate
     95% margin on a gap is the subset-of-total one: the group sits
     inside the total, so the gap's variance is p(1−p)(1/n_group −
     1/n_all), not the sum of the two. The group's base is the wave's
     effective sample (rowN / HL_DEFF, the voting-intention row filed
     beside the direction row; a wave with no sample on file takes
     rowN's standing 1200 convention) times the group's share of adults
     or of that wave's voting intention. A group whose share cannot be
     pinned (Roy Morgan folds its "Other" voters into the Independent
     figure) carries n: null and no margin – it pools at equal weight. */
  const gapMarg = (v, n, eff) =>
    v == null || !n || n >= eff ? null
    : r1(196 * Math.sqrt((v / 100) * (1 - v / 100) * (1 / n - 1 / eff)));
  const acc = (label, dim, pollster, pt, eff, share, meta) => {
    const g = (out[label] ??= { label, dim, pollsters: [], rows: [] });
    if (!g.pollsters.includes(pollster)) g.pollsters.push(pollster);
    const n = eff && share ? Math.round(eff * share) : null;
    g.rows.push({
      ...pt, pollster, n,
      gapR: pt.right == null || pt.refRight == null ? null : r1(pt.right - pt.refRight),
      gapW: pt.wrong == null || pt.refWrong == null ? null : r1(pt.wrong - pt.refWrong),
      gapCiR: gapMarg(pt.right, n, eff),
      gapCiW: gapMarg(pt.wrong, n, eff),
      ...meta,
    });
  };
  if (RM_DIR_GROUPS?.waves) {
    const rmRows = dirRowByDate("Roy Morgan");
    // the wave's voting-intention shares, as fractions of the whole sample
    const RM_VOTE = { "One Nation voters": "onp", "Coalition voters": "lnp", "Greens voters": "grn", "Labor voters": "alp" };
    const voteShare = (label) => (vi) => {
      const k = RM_VOTE[label];
      if (!vi || !k || vi[k] == null) return null;
      return (vi[k] / 100) * (1 - (vi.undecided || 0) / 100);
    };
    /* differencing needs the all-voters figure, and Roy Morgan's own
       all-voters print IS the polls.json direction row: a wave the row
       bank never reached cannot be differenced, so it joins no pool */
    const push = (label, dim, date, right, wrong, share) => {
      const row = rmRows.get(date) || null;
      if (!row) return;
      const vi = POLL_BY_KEY.get(date + "|Roy Morgan") || null;
      const sh = typeof share === "function" ? share(vi) : share;
      acc(label, dim, "Roy Morgan", {
        date, ym: ymOf(date), right, wrong,
        refRight: row.right, refWrong: row.wrong,
      }, rowN(vi) / HL_DEFF, sh, dirTipOf(row));
    };
    for (const [date, w] of Object.entries(RM_DIR_GROUPS.waves)) {
      if (w.gender) {
        push("Men", "gender", date, w.gender.Men.r, w.gender.Men.w, SEX_SHARE.Men);
        push("Women", "gender", date, w.gender.Women.r, w.gender.Women.w, SEX_SHARE.Women);
      }
      if (w.vote) {
        push("One Nation voters", "vote", date, null, w.vote["One Nation"].w, voteShare("One Nation voters"));
        push("Coalition voters", "vote", date, null, w.vote["L-NP"].w, voteShare("Coalition voters"));
        push("Other party voters", "vote", date, null, w.vote.Other.w, null);
        push("Independent voters", "vote", date, null, w.vote.Independent.w, null);
        push("Greens voters", "vote", date, null, w.vote.Greens.w, voteShare("Greens voters"));
        push("Labor voters", "vote", date, w.vote.ALP.r ?? null, w.vote.ALP.w, voteShare("Labor voters"));
      }
    }
  }
  if (ESS_DIR_GROUPS?.waves) {
    const essRows = dirRowByDate("Essential");
    const push = (label, dim, date, cell, wave, share) => {
      const row = wave.dirRow ? essRows.get(wave.dirRow) : null;
      const vi = wave.dirRow ? POLL_BY_KEY.get(wave.dirRow + "|Essential") : null;
      // the wave's own TOTAL cell is the reference: the figure printed
      // beside the bands in the same report
      acc(label, dim, "Essential", {
        date, ym: ymOf(date), right: cell.r, wrong: cell.w,
        refRight: wave.total ? wave.total.r : null,
        refWrong: wave.total ? wave.total.w : null,
      }, rowN(vi || row) / HL_DEFF, share, row ? dirTipOf(row) : {});
    };
    for (const [date, w] of Object.entries(ESS_DIR_GROUPS.waves)) {
      push("Men", "gender", date, w.Men, w, SEX_SHARE.Men);
      push("Women", "gender", date, w.Women, w, SEX_SHARE.Women);
      push("18–34", "age", date, w["18–34"], w, AGE_SHARE["18-34"]);
      push("35–54", "age", date, w["35–54"], w, AGE_SHARE["35-54"]);
      push("55+", "age", date, w["55+"], w, AGE_SHARE["55+"]);
    }
  }
  if (RB_DIR_GROUPS?.waves) {
    const rbRows = dirRowByDate("RedBridge/Accent");
    /* Only gender can be sized: the statements print no group bases,
       and the vote-intention cuts are shares of ALL voters while the
       poll row's primaries exclude undecided – with no undecided share
       on the row or in the statement, a vote group's size can't be
       pinned without inventing a figure. Every other group pools at
       equal weight with no margin. Income, stress and the Nov-only
       trims stay banked – a print that appeared once gives the select
       a one-point series. */
    const VOTE_LABEL = {
      "Labor": "Labor voters", "Coalition": "Coalition voters",
      "Liberal": "Liberal voters", "CLP/LNP/Nat": "CLP/LNP/Nat voters",
      "One Nation": "One Nation voters", "Greens": "Greens voters",
      "Other parties and candidates": "Other voters",
      "Undecided / will not vote": "Undecided voters",
    };
    const SOFT_LABEL = { "Solid": "Solid voters", "Soft": "Soft voters", "Very soft": "Very soft voters" };
    const DIMS = ["vote", "softness", "generation", "gender", "location", "education", "ownership"];
    const push = (label, dim, date, cell, share) => {
      if (!cell) return;
      const row = rbRows.get(date) || null;
      if (!row) return;
      const vi = POLL_BY_KEY.get(date + "|RedBridge/Accent") || null;
      acc(label, dim, "RedBridge/Accent", {
        date, ym: ymOf(date), right: cell.r, wrong: cell.w,
        refRight: row.right, refWrong: row.wrong,
      }, rowN(vi || row) / HL_DEFF, share, dirTipOf(row));
    };
    for (const [date, w] of Object.entries(RB_DIR_GROUPS.waves)) {
      const dims = w.dims || {};
      for (const dim of DIMS) {
        for (const [printed, cell] of Object.entries(dims[dim] || {})) {
          const label = dim === "vote" ? (VOTE_LABEL[printed] || printed)
            : dim === "softness" ? (SOFT_LABEL[printed] || printed)
            : printed;
          push(label, dim, date, cell, dim === "gender" ? SEX_SHARE[printed] ?? null : null);
        }
      }
    }
  }
  /* Merge: pool the per-wave gaps n-weighted month by month (a wave
     with no size joins at equal weight), turn each month's pool into a
     point ON the lean-adjusted all-voters line for that month, and keep
     every house's own readings beside the line as dots anchored the
     same way. The pooled gap's margin pools the per-wave margins as
     √(Σ(wᵢcᵢ)²)/Σwᵢ – independent waves, so the variances add; a pool
     of only unsized waves carries none. A wave older than the headline
     era (the `direction` series starts May 2025) has no month to anchor
     to, and drops. */
  const byYm = new Map((direction || []).map((p) => [p.ym, p]));
  const pool = (rows, gapKey, ciKey) => {
    const ws = rows.filter((r) => r[gapKey] != null);
    if (!ws.length) return { v: null, ci: null };
    const wOf = (r) => r.n || 1;
    const W = ws.reduce((s, r) => s + wOf(r), 0) || ws.length;
    const v = r1(ws.reduce((s, r) => s + wOf(r) * r[gapKey], 0) / W);
    const ci = ws.some((r) => r[ciKey] != null)
      ? r1(Math.sqrt(ws.reduce((s, r) => (r[ciKey] != null ? s + wOf(r) ** 2 * r[ciKey] ** 2 : s), 0)) / W) : null;
    return { v, ci };
  };
  const emit = {};
  for (const [label, g] of Object.entries(out)) {
    const byMonth = new Map();
    for (const r of g.rows) { let a = byMonth.get(r.ym); if (!a) byMonth.set(r.ym, a = []); a.push(r); }
    const series = [], raw = [];
    for (const [ym, rs] of [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      const H = byYm.get(ym);
      if (!H) continue;
      const pr = pool(rs, "gapR", "gapCiR"), pw = pool(rs, "gapW", "gapCiW");
      series.push({
        ym, x: H.x,
        right: pr.v == null || H.right == null ? null : r1(H.right + pr.v),
        wrong: pw.v == null || H.wrong == null ? null : r1(H.wrong + pw.v),
        rightCi: pr.ci, wrongCi: pw.ci,
        gapR: pr.v, gapW: pw.v,
      });
      for (const r of rs) raw.push({
        date: r.date, ym,
        x: mx(ym) + (dayOf(r.date) - 15) / 365,
        pollster: r.pollster,
        right: r.gapR == null || H.right == null ? null : r1(H.right + r.gapR),
        wrong: r.gapW == null || H.wrong == null ? null : r1(H.wrong + r.gapW),
        gapR: r.gapR, gapW: r.gapW,
        ...(r.released ? { dateLabel: r.dateLabel, released: r.released, sample: r.sample } : {}),
      });
    }
    emit[label] = {
      label, dim: g.dim,
      houses: [...g.pollsters].sort(),
      sized: g.rows.some((r) => r.n != null),
      series, raw,
    };
  }
  return Object.keys(emit).length ? emit : null;
})();

/* The same banks again, joined onto single waves so an expanded poll
   can list, under its national direction line, the breakdowns ITS OWN
   release printed: SEC Newgate's five-state perceived-direction table
   (banked per wave-END month), Roy Morgan's release-prose gender /
   voting-intention splits plus its printed state extremes (banked per
   release date; the full state table is paywalled, so the release's
   named most/least states are the only state cut there is), and
   Essential's
   national-mood gender / age trend cuts (banked per report date in the
   assimilated CSV; the wave is found by its printed headline figures,
   not its date – the Guardian stamp wanders a day either way).
   Figures as printed – never house-adjusted or smoothed. A wave whose
   release printed no split at all carries nothing, and availability is
   per-wave.
   Attached HERE because the loaders above hadn't landed when DIR_BY was
   computed – decorate the committed DIR_BY entries in place and dir's
   three emitters (directionOnlyPolls, §6 individualPolls, §6c Latest)
   carry `bg` automatically. */
{
  const attach = (key, rows) => { const e = DIR_BY.get(key); if (e && rows) e.bg = rows; };
  if (SEC_STATES?.series) {
    // the states bank keys by month; a wave's own month is tried first,
    // then publication month, then the fieldwork-start month (the Nov-2025
    // wave ended in the report's month but ran from October)
    for (const d of DIR) {
      if (d.pollster !== "SEC Newgate") continue;
      const ym = [d.date, d.published, d.dateStart].filter(Boolean).map((s) => ymOf(String(s).slice(0, 10)))
        .find((m) => (SEC_STATES.states || []).some((st) => (SEC_STATES.series[st] || []).some((r) => r.month === m)));
      if (!ym) continue;
      const cuts = (SEC_STATES.states || [])
        .map((st) => { const r = (SEC_STATES.series[st] || []).find((x) => x.month === ym); return r ? { label: st, right: r.right, wrong: r.wrong ?? null } : null; })
        .filter((c) => c && c.wrong != null);
      if (cuts.length) attach(d.date + "|" + d.pollster, [{ head: "By state, % right–wrong:", cuts }]);
    }
  }
  if (RM_DIR_GROUPS?.waves) {
    const partOf = { "One Nation": "onp", "L-NP": "lnp", "ALP": "alp", "Greens": "grn", "Independent": "ind", "Other": "oth" };
    const labOf = { "One Nation": "One Nation", "L-NP": "Coalition", "ALP": "Labor", "Greens": "Greens", "Independent": "Independents", "Other": "Other parties" };
    const RM_STATE_ABBR = { "New South Wales": "NSW", Victoria: "VIC", Queensland: "QLD", "South Australia": "SA", "Western Australia": "WA", Tasmania: "TAS", "Australian Capital Territory": "ACT", "Northern Territory": "NT" };
    for (const [date, w] of Object.entries(RM_DIR_GROUPS.waves)) {
      const rows = [];
      if (w.gender)
        rows.push({ head: "By gender, % right–wrong:",
          cuts: ["Men", "Women"].filter((g) => w.gender[g]).map((g) => ({ label: g, right: w.gender[g].r ?? null, wrong: w.gender[g].w })) });
      if (w.vote)
        rows.push({ head: "By voting intention, % saying wrong track:", form: "wrong",
          cuts: Object.keys(labOf).filter((g) => w.vote[g]).map((g) => ({ label: labOf[g], k: partOf[g], right: w.vote[g].r ?? null, wrong: w.vote[g].w })) });
      // the release's printed state extremes – the full table is paywalled,
      // so the named most/least pair is the whole state cut; abbreviations
      // match the SEC bank's so the two state rows read alike
      if (w.stateExtremes)
        rows.push({ head: "State extremes, % wrong track:", form: "wrong",
          cuts: ["highest", "lowest"].map((tag) => ({ label: RM_STATE_ABBR[w.stateExtremes[tag].state] ?? w.stateExtremes[tag].state, wrong: w.stateExtremes[tag].w })) });
      if (rows.length) attach(date + "|Roy Morgan", rows);
    }
  }
  if (ESS_DIR?.waves) {
    // matched to its wave by the printed headline, never by date alone –
    // two captures can sit a day apart (2022-08-08 vs 2022-08-09), and
    // the figures are what the row and the table share
    const DAY = 864e5;
    for (const d of DIR) {
      if (d.pollster !== "Essential" || d.right == null || d.wrong == null) continue;
      const anchor = +new Date(String(d.published || d.date).slice(0, 10) + "T00:00Z");
      let best = null;
      for (const [dt, w] of Object.entries(ESS_DIR.waves)) {
        if (w.Trend?.r !== d.right || w.Trend?.w !== d.wrong) continue;
        const gap = Math.abs(+new Date(dt + "T00:00Z") - anchor);
        if (gap <= 7 * DAY && (!best || gap < best.gap)) best = { gap, w };
      }
      if (!best) continue;
      const rows = [];
      const pick = (dim) => best.w[dim] ? { label: dim, right: best.w[dim].r ?? null, wrong: best.w[dim].w } : null;
      // Men/Women, not the CSV's Male/Female – the Roy Morgan bank beside
      // this one renders the same split that way
      const gender = ["Male", "Female"].map((dim, i) => { const c = pick(dim); return c ? { ...c, label: ["Men", "Women"][i] } : null; }).filter(Boolean);
      if (gender.length === 2) rows.push({ head: "By gender, % right–wrong:", cuts: gender });
      const age = [{ dim: "18-34", label: "18–34" }, { dim: "35-54", label: "35–54" }, { dim: "55+", label: "55+" }]
        .map(({ dim, label }) => { const c = pick(dim); return c ? { ...c, label } : null; }).filter(Boolean);
      if (age.length === 3) rows.push({ head: "By age, % right–wrong:", cuts: age });
      if (rows.length) attach(d.date + "|" + d.pollster, rows);
    }
  }
}

/* ---- per-poll leadership / alt builders -------------------------------- */
const oppKey = JUR
  ? (name) => (name === JUR.eras.opp[JUR.eras.opp.length - 1].name ? "taylor" : "ley")   // see eraOf
  : (name) => (name === "Ley" ? "ley" : "taylor");
function buildPpm(date, firm) {
  const k = date + "|" + firm, p = PPM_BY.get(k);
  if (!p) return {};
  // every preferred-PM contest this poll published, as its own set – the main
  // row, any extra contests (7th element), then the Albanese-v-Hanson H2. Each
  // is a distinct MEASURE (two-way vs three-way etc.), never merged.
  const contest = (alb, opp, han, kind = null) => {
    const s = { alb };
    if (opp != null) s[oppKey(p.oppName)] = opp;
    if (han != null) s.hanson = han;
    if (kind === "2pmp") s.label = "Two-PM preferred";
    s.unc = Math.max(0, Math.round(100 - (alb + (opp || 0) + (han || 0))));
    return s;
  };
  const sets = [contest(p.alb, p.opp, p.han)];
  if (Array.isArray(p.extra)) {
    for (const c of p.extra) sets.push(contest(c.alb, c.opp ?? null, c.hanson ?? c.han ?? null, c.kind ?? null));
  }
  const h2 = H2_BY.get(k);
  if (h2) sets.push({ alb: h2.alb, hanson: h2.han, unc: Math.max(0, 100 - h2.alb - h2.han) });
  return sets.length > 1 ? { ppmSets: sets } : { ppm: sets[0] };
}
for (const p of directionOnlyPolls) Object.assign(p, buildPpm(p.released, p.pollster));
function buildAppr(date, firm) {
  const a = APPR_BY.get(date + "|" + firm);
  if (!a) return { alb: null, taylor: null, hanson: null, albNet: null, taylorNet: null, hansonNet: null, oppName: null, metric: null, ...(JUR ? { who: whoAt(date) } : {}) };
  const sp = a.splits || {};
  // the SECOND measure, where a firm published both for the same leader. Skipped
  // when favourability is already that leader's primary metric at this firm, so
  // the same number never appears twice under two names.
  const favNets = sp.fav || {};
  const altOf = (srcKey) => {
    if (metricOf(firm, srcKey, date) === "fav") return null;
    const v = favNets[srcKey];
    return v == null ? null : { metric: "fav", net: v };
  };
  const alt = { alb: altOf("alb"), taylor: altOf("opp"), hanson: altOf("han") };
  const anyAlt = alt.alb || alt.taylor || alt.hanson;
  return {
    // splits render as micro bars in the detail views where published;
    // most rows are net-only, so these are usually null
    alb: sp.alb || null, taylor: sp.opp || null, hanson: sp.han || null,
    albNet: a.alb, taylorNet: a.opp ?? null, hansonNet: a.han ?? null,
    oppName: a.oppName || null,
    // per-leader metric – a poll can be approval for some, favourability for others
    metricBy: { alb: metricOf(firm, "alb", date), taylor: metricOf(firm, "opp", date), hanson: metricOf(firm, "han", date) },
    ...(anyAlt ? { alt } : {}),
    ...(JUR ? { who: whoAt(date) } : {}),
  };
}
function buildAlt(date, firm) {
  const a = ALT_BY.get(date + "|" + firm), out = {};
  if (a && a.ao != null) out.tppAlt = { alp: r1(a.ao), onp: r1(100 - a.ao) };
  if (a && a.lo != null) out.tppAlt2 = { lnp: r1(a.lo), onp: r1(100 - a.lo) };
  return out;
}
/* tpp3 is a per-poll field (Fox & Hedgehog prints a three-cornered
   preferred every wave; Roy Morgan (SMS) printed one for its 13–14 May
   2026 post-budget special), so it rides with the row rather than a join
   map, the same way undecided and tppFlows do. */
function build3cp(p) {
  if (!p.tpp3) return {};
  return { tppKind: "3cp", tpp3: { alp: r1(p.tpp3.alp), lnp: r1(p.tpp3.lnp), onp: r1(p.tpp3.onp) } };
}
function primaryOf(p) {
  // the shares as printed - a rescaled (undecidedIn) wave shows its own table
  if (p.pubPrim) p = p.pubPrim;
  return { alp: p.alp, lnp: p.lnp, grn: p.grn, onp: p.onp, oth: (p.ind == null && p.oth == null) ? null : r1((p.ind ?? 0) + (p.oth ?? 0)) };
}
// normalised ALP 2PP share (pairs that don't sum to 100 – e.g. an
// undecided-inclusive 48/47 – are rescaled) for scatter / lean maths
const alpNOf = (p) => (p.tpp_alp == null ? null : r1(share2pp(p)));

/* THREE questions, and they are not the same one. Roy Morgan asks who you
   would vote for and reports the share who can't say — undecided on FIRST
   preferences, set aside before its primaries are reported, which is why they
   sum to 100. Essential's undecided is downstream of that: its published
   two-party pair sums to under 100 because the people who wouldn't nominate a
   side are still in it, so the shortfall IS the undecided share, after
   preferences. That is already recorded once, as pollsterRules — so it is
   derived here rather than typed in again, and it is drawn as its own line
   rather than averaged into the other, exactly as approval and favourability
   are kept apart. Resolve's is the mirror question: respondents HAVE named a
   party, but when asked "How firm are you with your vote?" not all are
   firm — TOTAL SOFT is the share who might still move. It rides the same
   `undecided` row field with its own basis, because it belongs to the same
   panel (the movable share of the electorate) and no wave carries two of
   these bases at once. */
const TPP_UNDECIDED = new Set(Object.entries(D.pollsterRules || {})
  .filter(([, r]) => r && r.tppIncludesUndecided).map(([firm]) => firm));
/* the rolling collection page a pollster's dated release also lives at
   (Essential's Federal Political Insights hub, which carries the current
   tables alongside each numbered report). Declared once as a pollster rule
   and attached to that house's releases so the expanded poll can offer both
   addresses – the dated page and the hub – without typing the hub URL onto
   every wave. */
const RELEASE_HUB = new Map(Object.entries(D.pollsterRules || {})
  .filter(([, r]) => r && r.releaseHub).map(([firm, r]) => [firm, r.releaseHub]));
const REPORT_OVERVIEW = new Map(Object.entries(D.pollsterRules || {})
  .filter(([, r]) => r && r.overviewUrl).map(([firm, r]) => [firm, r.overviewUrl]));
/* What each house's primary-vote shares are OF, printed beside every sample
   ("1,500 D"): D = decided voters, undecideds set aside with no leaner
   question; D+L = decided plus leaners (undecideds asked which way they
   lean, the rest set aside); A = all voters, undecideds kept in the base,
   so the parties add to less than 100 (Essential asks a leaner but keeps
   those still unsure in - a leaner moves people between rows, never out of
   the base, so it is still A); F = forced choice, no undecided option, so
   everyone is allocated and the parties add to 100 (Resolve; user call
   2026-11-21 - not A, which would say undecideds sit in its shares). A house whose two-party figure has another base than its
   primaries carries a per-facet pair: the 2PP views' default, the implied
   2PP, is read off Essential's primaries rescaled to leave the undecided out
   (poolPrim) - D+L. "As published" (facet key twoppPub, which falls back to
   the primaries' base) prints its 2PP+ pair raw, unsure still in (44-52) - A.
   Each is the house's own methodology statement (in the repo's -src caches
   where noted). A sub-series - "Newspoll (pooled)", "DemosAU (MRP)",
   "Roy Morgan (SMS)" - reads its parent's. A house with no statement found
   prints no letter rather than a guess (Wolf & Smith, Agenda C Synesis). */
const POLL_BASES = {
  "Newspoll": "D+L",          // APC statement: leaner question (extract-sampleeff)
  "DemosAU": "D+L",           // demosau-src: "Initial undecided voters were asked a leaner question"
  "RedBridge/Accent": "D+L",  // redbridge-src: "Undecided respondents were asked a leaner question"
  "Redbridge": "D+L",
  "Freshwater": "D+L",        // methodology statement: undecideds asked a 'squeeze' question
  "Fox & Hedgehog": "D+L",    // foxhedgehog-src: "given a leaner question"
  "EMRS (Tas)": "D+L",        // emrs-src: "Decided Voters Supporting or Leaning towards"
  "YouGov": "D",              // news24-src: "Primary vote, excluding undecided voters"
  "Roy Morgan": "D",          // "x% can't say who they would vote for", set aside; no leaner stated
  "Spectre Strategy": "D",    // spectre-src: "undecided before apportionment"
  "Resolve": "F",             // no undecided option (a forced choice)
  // methodology page: "Participants answering 'Unsure' are NOT excluded from
  // published results"; questionnaire Q23 "Well which party are you currently
  // leaning towards?" asked of Q21 don't-knows
  "Essential": { primary: "A", twopp: "D+L" },
};
const pollBases = Object.fromEntries([...new Set(POLLS.map((p) => p.pollster))]
  .map((h) => [h, POLL_BASES[h] || POLL_BASES[h.replace(/\s*\([^)]*\)$/, "")] || null])
  .filter(([, b]) => b));
const undecidedOf = (p) => {
  if (p.undecided != null) return { v: p.undecided, basis: "first" };
  if (p.soft != null) return { v: p.soft, basis: "soft" };
  if (TPP_UNDECIDED.has(p.pollster) && p.tpp_alp != null && p.tpp_lnp != null) {
    const gap = r1(100 - (p.tpp_alp + p.tpp_lnp));
    // a pair that does sum to 100 is a normalised one, not a nil reading
    if (gap > 0.5) return { v: gap, basis: "tpp" };
  }
  return null;
};
/* ---- 5b. change indicators – each measure vs the SAME pollster's previous
   poll that reported it. Tracks the last non-null value per pollster+measure
   over date-sorted polls, so a delta compares like-for-like even when a firm
   skips a measure some waves (this is how a pollster's own "+6, best since
   December" reads). Keyed date|pollster → { d:{measure:Δ}, r:{measure:refISO} }. */
const CHG_MEASURES = {
  alp2pp:    (p, a, pm) => p.tpp_alp ?? null,
  // as printed, like the figures beside them (primaryOf)
  pAlp:      (p, a, pm) => (p.pubPrim || p).alp ?? null,
  pLnp:      (p, a, pm) => (p.pubPrim || p).lnp ?? null,
  pGrn:      (p, a, pm) => (p.pubPrim || p).grn ?? null,
  pOnp:      (p, a, pm) => (p.pubPrim || p).onp ?? null,
  /* "Other" on screen is IND+OTH combined (primaryVal's oth branch), so the
     delta must compare the combined series – a wave filing ind-only shows a
     Other cell but would look missing to a p.oth-only delta. */
  pOth:      (p, a, pm) => primaryVal(p.pubPrim || p, "oth"),
  // the movable share – "can't say" beside the primaries (Roy Morgan), the
  // shortfall inside the two-party pair (Essential), and the not-firm share
  // of the decided (Resolve). Each is that house's own series, so a delta
  // compares like with like
  und:       (p, a, pm) => (undecidedOf(p) || {}).v ?? null,
  // Roy Morgan/RedBridge's other published 2PP – the pair allocated on
  // 2025-election preference flows. Only those two houses carry it, so the
  // series is each house's own and the delta keys to its previous wave
  flows:     (p, a, pm) => p.tpp_flows ?? null,
  /* RedBridge/Accent's cohort forced-choice figures, one measure each: the
     Labor share when Coalition voters are pressed into Labor-v-One Nation
     (tpp_split_on.lnp) and when One Nation voters are pressed Labor-v-the
     Coalition (tpp_split.onp), plus the Greens/other cohorts on both
     questions. One house prints them, so each series is that house's own
     and the delta keys to its previous wave. */
  splitCoal: (p) => (p.tpp_split_on && p.tpp_split_on.lnp != null ? p.tpp_split_on.lnp : null),
  splitOnp:  (p) => (p.tpp_split && p.tpp_split.onp != null ? p.tpp_split.onp : null),
  splitGrn:   (p) => (p.tpp_split && p.tpp_split.grn != null ? p.tpp_split.grn : null),
  splitGrnOn: (p) => (p.tpp_split_on && p.tpp_split_on.grn != null ? p.tpp_split_on.grn : null),
  splitOth:   (p) => (p.tpp_split && p.tpp_split.oth != null ? p.tpp_split.oth : null),
  splitOthOn: (p) => (p.tpp_split_on && p.tpp_split_on.oth != null ? p.tpp_split_on.oth : null),
  // every implied-eligible wave's own implied figure – its primaries read
  // through the fixed 2025 flow table (the same number the detail shows as
  // alpImp). The series the implied-basis "Since last wave" moves key to,
  // whether or not the poll printed a pair of its own
  imp:       (p, a, pm) => (impOk(p) ? r1(impliedAlp2pp(p)) : null),
  // the same wave re-read under the ALP-v-ON first-principles flow set – the
  // number the detail shows as alpOnImp; its own series per pollster
  impOn:     (p, a, pm) => (impOk(p) ? r1(impliedOn(p)) : null),
  albNet:    (p, a, pm) => (a ? a.alb ?? null : null),
  taylorNet: (p, a, pm) => (a ? a.opp ?? null : null),
  hansonNet: (p, a, pm) => (a ? a.han ?? null : null),
  // favourability, whichever slot holds it: the primary net where that is the
  // leader's metric at the house, else the release's second reading
  // (detail.fav - Resolve's likeability beside its performance question)
  albFav:    (p, a) => favOf(p, a, "alb"),
  taylorFav: (p, a) => favOf(p, a, "opp"),
  hansonFav: (p, a) => favOf(p, a, "han"),
  // the One Nation head-to-head 2PPs, each tracked as its own measure so the
  // 2nd/3rd matchups get their own change vs the pollster's last publication
  altAlpOn:  (p, a, pm, alt) => (alt ? alt.ao ?? null : null),
  altLnpOn:  (p, a, pm, alt) => (alt ? alt.lo ?? null : null),
  // preferred PM – the MAIN contest only (extra matchups aren't comparable)
  ppmAlb:    (p, a, pm) => (pm ? pm.alb ?? null : null),
  ppmOpp:    (p, a, pm) => (pm ? pm.opp ?? null : null),
  ppmHan:    (p, a, pm) => (pm ? pm.han ?? null : null),
};
function favOf(p, a, lk) {
  if (!a) return null;
  return metricOf(p.pollster, lk, p.date) === "fav" ? a[lk] ?? null : (a.splits && a.splits.fav ? a.splits.fav[lk] ?? null : null);
}
/* a leader's change is to the same question about the same person: a net
   series is keyed by its metric (Resolve rated Hanson on likeability until
   July 2026, performance after - a +5 performance is not 9 down on a +14
   likeability) and the opposition leader's by name (Ley's last -23 is not
   Taylor's baseline) */
const CHG_LEADER = { albNet: "alb", taylorNet: "opp", hansonNet: "han", albFav: "alb", taylorFav: "opp", hansonFav: "han" };
const chgSeries = (p, a, k) => {
  const lk = CHG_LEADER[k];
  if (!lk) return "";
  return (k.endsWith("Net") ? "|" + metricOf(p.pollster, lk, p.date) : "") + (lk === "opp" && a && a.oppName ? "|" + a.oppName : "");
};
const chgByKey = {};
const lastMV = {};   // "pollster|measure" → { val, date }
for (const p of [...POLLS].sort((a, b) => a.date.localeCompare(b.date) || a.pollster.localeCompare(b.pollster))) {
  const a = APPR_BY.get(p.date + "|" + p.pollster);
  const pm = PPM_BY.get(p.date + "|" + p.pollster);
  const alt = ALT_BY.get(p.date + "|" + p.pollster);
  const d = {}, r = {};
  for (const [k, fn] of Object.entries(CHG_MEASURES)) {
    const v = fn(p, a, pm, alt);
    if (v == null) continue;
    const mk = p.pollster + "|" + k + chgSeries(p, a, k), prev = lastMV[mk];
    if (prev) { d[k] = +(v - prev.val).toFixed(1); r[k] = prev.date; }
    lastMV[mk] = { val: v, date: p.date };
  }
  chgByKey[p.date + "|" + p.pollster] = Object.keys(d).length ? { d, r } : null;
}

/* ---- 5c. undecided ------------------------------------------------------
   The share who say they can't say who they'd vote for. It is published
   BESIDE the primaries, not inside them – a Roy Morgan wave reading 27/27/21
   has already set these people aside, which is why its shares sum to 100 –
   so the tracker was dropping the one number that says how much of the
   electorate is not yet in the figures above. Soft support is what a third
   party surging is made of, so this is worth its own line.

   One house asks it weekly, which is a series, not an aggregate: no house
   effect is estimable against a single publisher, so this is a plain monthly
   mean of published readings and the panel says whose. A wave that published
   no figure is absent rather than zero. */
/* The panel's five lines, three undecided questions on one chart and two
   pollsters' soft shares on the other. Each line is ONE question, never an
   average of two:
     first   "Asked once": can't say, and the pollster asks no follow-up
             (Roy Morgan, Spectre)
     leaner  "After a follow-up": still can't say after being asked which
             party they lean to (Newspoll, RedBridge, DemosAU, Essential,
             Fox & Hedgehog)
     tpp     "After preferences": won't choose between Labor and the
             Coalition when asked which they'd put higher (Spectre) – it also
             counts minor-party voters who won't rank the two majors
     soft    Resolve's soft share: named a party but not firm in it
     softRB  RedBridge's soft plus very soft: not solid
   Until 2026-11-23 the soft chart drew ONE monthly average of Resolve (about
   26%) and RedBridge (about 50%): two questions twenty-five points apart, so
   the line fell to Resolve's level in every month RedBridge skipped (July
   and August 2025, September 2026) and climbed back when it reported – dips
   the voters never made, and a "risen significantly" verdict built on them.
   After preferences was the same kind of average, of Spectre (11–13%) and
   Essential (4–7%), so it leapt to 13 in any month only Spectre reported.
   Essential's two-party shortfall stays in its own poll's detail: it is its
   primary undecided again (within a point every month, already on the
   follow-up line), not an answer to a preference question. Each line
   carries its own colour token, so no two lines are told apart by a dash. */
const UNDECIDED_BASES = [
  { id: "first", kind: "und", label: "Asked once", color: "var(--dec-once)",
    note: "can’t say who they would vote for, and the pollster asks no follow-up – set aside before the shares are reported" },
  { id: "leaner", kind: "und", label: "After a follow-up", color: "var(--dec-leaner)",
    note: "still can’t say after a follow-up asking which party they lean to – treatment in the published vote figures varies by house" },
  { id: "tpp", kind: "und", house: "Spectre Strategy", label: "After preferences", color: "var(--dec-pref)",
    note: "won’t choose between Labor and the Coalition when asked which they would put higher, including some who named a minor party" },
  { id: "soft", kind: "soft", house: "Resolve", label: "Resolve", color: "var(--dec-resolve)",
    note: "named a party but call their vote soft, not firm (Resolve asks everyone; no undecided option)" },
  { id: "softRB", kind: "soft", house: "RedBridge/Accent", label: "RedBridge", color: "var(--dec-redbridge)",
    note: "named a party or a lean but call their vote soft or very soft, not solid" },
];
const decidedHistoryPolls = JUR ? [] : Object.entries(cyclePolls).flatMap(([term, rows]) => rows.map((p) => ({
  ...p,
  pollster: p.firm === "Resolve Strategic" ? "Resolve" : p.firm === "RedBridge Group" ? "RedBridge/Accent" : p.firm,
  decidedTerm: +term,
})));
const undecidedRowsFor = (rows) => rows.flatMap((p) => [
  /* undecidedOf's "tpp" basis (Essential's two-party shortfall) stays in the
     poll's own detail: it is the same undecided voters as its primary */
  ...(undecidedOf(p) && undecidedOf(p).basis !== "tpp" ? [{ p, u: undecidedOf(p) }] : []),
  ...(p.undecidedLeaner != null ? [{ p, u: { v: p.undecidedLeaner, basis: "leaner" } }] : []),
  ...(p.pollster === "Essential" && p.undecidedIn != null
    ? [{ p, u: { v: p.undecidedIn, basis: "leaner" } }] : []),
  /* Spectre's undecided on its Labor-v-Coalition preference question.
     `lnponp` is a legacy key name: it holds the FIRST contest Spectre prints,
     Labor v Coalition (extract-spectre.mjs; the ledger labels it so), not
     Coalition v One Nation; alponp, its Labor-v-One Nation contest, stays in
     the poll detail. */
  ...(p.tpp_undecided?.lnponp != null
    ? [{ p, u: { v: p.tpp_undecided.lnponp, basis: "tpp" } }] : []),
  /* RedBridge's non-solid share of its decided-plus-leaner vote intention,
     its own line (softRB). Spectre's two-way soft share also includes
     unresolved undecideds, so it stays out; this adds to the panel series,
     never the per-poll ledger. */
  ...(p.pollster === "RedBridge/Accent" && Number.isFinite(p.firmness?.all?.[1]) && Number.isFinite(p.firmness?.all?.[2])
    ? [{ p, u: { v: p.firmness.all[1] + p.firmness.all[2], basis: "softRB" } }] : []),
]).filter((r) => !noAggPoll(r.p));
const undecidedRows = undecidedRowsFor(POLLS);
const makeUndecidedSeries = (b, rows) => {
  const rs = rows || undecidedRows.filter((r) => r.u.basis === b.id);
  if (!rs.length) return null;
  const polls = rs.map(({ p, u }) => ({
    x: dx(p.date), ym: ymOf(p.date), pollster: p.pollster,
    dateLabel: fwLabel(p.dateStart, p.date), released: p.date,
    sample: p.sample ?? null,
    /* rowN's effective-sample rule must see sampleEff on the mapped row too:
       without it the monthly means below weight a sampleEff wave (Essential
       files one) by its raw sample while the panel's nowcast weighs the same
       wave by sampleEff×HL_DEFF - one measure, two weights */
    ...(p.sampleEff != null ? { sampleEff: p.sampleEff } : {}),
    v: u.v, basis: b.id,
  })).sort((a, b2) => a.x - b2.x);
  const monthly = MONTHS.map((ym) => {
    const m = polls.filter((d) => d.ym === ym);
    if (!m.length) return null;
    let sw = 0, swx = 0;
    for (const r of m) { const n = rowN(r); sw += n; swx += n * r.v; }
    return { ym, x: mx(ym), v: r1(swx / sw), k: m.length };
  }).filter(Boolean);
  const last = polls[polls.length - 1];
  const prev = [...polls].reverse().find((d) => d.pollster === last.pollster && d.x < last.x);
  const vals = polls.map((d) => d.v);
  /* The figure the tile quotes, built as the headline is: the six-week
     nowcast (a sparse measure, with different houses on different bases), and
     the same a month earlier. It used to be the newest single poll, which put
     one DemosAU wave's "1%" beside a line sitting near 4.5. No house
     adjustment: each house's undecided share is its own question's answer,
     not a lean on a shared one. Null when the window holds no poll. */
  const now = currentReading(rs.map(({ p, u }) => ({ mid: midMs(p), x: u.v, n: rowN(p), firm: p.pollster })),
                             null, SPARSE_K);
  return {
    id: b.id, kind: b.kind, label: b.label, note: b.note, color: b.color, ...(b.house ? { house: b.house } : {}),
    houses: creditHouses(polls, (d) => d.pollster, (d) => Date.parse(d.released)),
    polls, monthly, n: polls.length,
    lo: Math.min(...vals), hi: Math.max(...vals),
    latest: { v: last.v, firm: last.pollster, released: last.released, field: last.dateLabel,
              chg: prev ? r1(last.v - prev.v) : null, refDate: prev ? prev.released : null },
    now,
  };
};
const undecidedSeries = UNDECIDED_BASES.map((b) => makeUndecidedSeries(b)).filter(Boolean);
const decidedHistoryGroups = (keep, mapWave) => {
  const groups = new Map();
  for (const p of decidedHistoryPolls) {
    if (!keep(p)) continue;
    if (!groups.has(p.decidedTerm)) groups.set(p.decidedTerm, []);
    groups.get(p.decidedTerm).push(mapWave(p));
  }
  return [...groups.entries()].map(([year, waves]) => ({ year, waves: waves.sort((a, b) => a.x - b.x) })).sort((a, b) => a.year - b.year);
};
/* the past terms' soft lines, one per house and term, fitted like today's
   (fitSoftLine below; past polls do not change, so the fits are cheap and
   stable). Each term's line runs from its house's first poll to its last. */
const SOFT_HIST_BASES = UNDECIDED_BASES.filter((b) => b.kind === "soft");
const decidedSoftHistory = (() => {
  const terms = [];
  const elections = Object.values(ELECTIONS).filter((e) => e && e.date).map((e) => e.date).sort();
  const rows = undecidedRowsFor(decidedHistoryPolls).filter((r) => SOFT_HIST_BASES.some((b) => b.id === r.u.basis));
  for (const year of [...new Set(rows.map((r) => r.p.decidedTerm))].sort()) {
    const to = elections.find((d) => +d.slice(0, 4) === year), from = elections[elections.indexOf(to) - 1];
    if (!to || !from) continue;
    for (const b of SOFT_HIST_BASES) {
      const rs = rows.filter((r) => r.p.decidedTerm === year && r.u.basis === b.id && r.p.date > from && r.p.date < to);
      if (!rs.length) continue;
      const polls = rs.map(({ p, u }) => ({
        x: dx(p.date), ym: ymOf(p.date), pollster: p.pollster,
        dateLabel: fwLabel(p.dateStart, p.date), released: p.date,
        sample: p.sample ?? null, ...(p.sampleEff != null ? { sampleEff: p.sampleEff } : {}),
        v: u.v, basis: b.id,
      })).sort((q, r) => q.x - r.x);
      /* fewer than four polls make no line (RedBridge's three before the
         2025 election): they stay on the chart as dots */
      const fit = rs.length >= 4 ? fitSoftLine(rs, { from, to, seed: 20261123 + year + (b.id === "soft" ? 0 : 1), first: true }) : null;
      terms.push({ year, id: b.id, house: b.house, label: b.label, color: b.color, houses: [b.house], polls,
        monthly: fit ? fit.months.map((m) => ({ ym: m.ym, x: mx(m.ym), v: r1(m.v), lo: r1(m.lo), hi: r1(m.hi) })) : [] });
    }
  }
  return { terms };
})();
/* Resolve's "not firm" share by age band (polls.json `softAge`), for the
   Undecided panel's By age view: every wave, the pooled current figure (its
   last SOFT_AGE_POOL waves) and the same pool over the term's first waves,
   which the change sentence compares against. Resolve files no age-band
   counts, so each band's base is the wave's effective sample times the
   band's share of adults (ABS 2021 Census: 18–34 29.5%, 35–54 33.4%, 55+
   37.1% of those 18 and over) – the weighting Resolve's sample is drawn to.
   The 95% margin is binomial on the pooled base. */
const SOFT_AGE_POOL = 3;
const softAgeWaveOf = (p) => ({
  x: dx(p.date), ym: ymOf(p.date), released: p.date, dateLabel: fwLabel(p.dateStart, p.date),
  pollster: p.pollster, sample: p.sample ?? null,
  soft: { ...p.softAge },
  n: Object.fromEntries(Object.keys(AGE_SHARE).map((k) => [k, Math.round(rowN(p) / HL_DEFF * AGE_SHARE[k])])),
});
const softAgeWaves = POLLS.filter((p) => p.softAge).sort((a, b) => (a.date < b.date ? -1 : 1)).map(softAgeWaveOf);
const decidedAgeHistory = decidedHistoryGroups((p) => p.softAge, softAgeWaveOf);
const softAgePooled = (ws) => Object.fromEntries(Object.keys(AGE_SHARE).map((k) => {
  let sn = 0, snv = 0;
  for (const w of ws) { sn += w.n[k]; snv += w.n[k] * w.soft[k]; }
  if (!sn) return [k, { v: null, ci95: null, n: 0 }];
  const v = snv / sn, q = v / 100;
  return [k, { v: r1(v), ci95: r1(196 * Math.sqrt(q * (1 - q) / sn)), n: Math.round(sn) }];
}));
const softAge = softAgeWaves.length >= 2 * SOFT_AGE_POOL ? (() => {
  const last = softAgeWaves.slice(-SOFT_AGE_POOL), first = softAgeWaves.slice(0, SOFT_AGE_POOL);
  return {
    houses: creditHouses(softAgeWaves, (w) => w.pollster, (w) => Date.parse(w.released)),
    waves: softAgeWaves,
    pool: SOFT_AGE_POOL,
    now: { from: last[0].dateLabel, to: last[SOFT_AGE_POOL - 1].dateLabel, ...softAgePooled(last) },
    base: { from: first[0].dateLabel, to: first[SOFT_AGE_POOL - 1].dateLabel, ...softAgePooled(first) },
  };
})() : null;
/* ---- 5bm. the decidedness lines on the model (federal) -------------------
   Every line is the primary model with two categories (primary-model.mjs
   fitUndecided). The two undecided questions pool their pollsters: each
   pollster's lean on the question (its own wording) drifts, the regular
   pollsters average zero, each counting once, and the band is the
   posterior's. This replaced a monthly average whose level jumped with
   whichever pollsters reported that month (RedBridge reads 1.6 above the
   average pollster after its leaner, Fox & Hedgehog 2.0 below). After
   preferences and the two soft lines are one house each, so the same model
   there is a smoother of that
   house's own polls with no lean: each poll is a sample (its effective
   size, its rounding), the share drifts a little a day, and a month with no
   poll is interpolated, never a jump. Each tile's figure, its change on a
   month and since the term's first month come from the same draws. Past
   terms' undecided lines are fitted the same way, term by term, by
   .build/build-undecided-history.mjs into data/undecided-history-model.json
   (their polls do not change), read here for the panel's window; past soft
   lines are fitted here (decidedSoftHistory). */
function termMonths(from, to) {
  const t0 = pmDay(from), t1 = pmDay(to), out = [];
  for (let d = new Date(from.slice(0, 7) + "-01T00:00:00Z"); ; d.setUTCMonth(d.getUTCMonth() + 1)) {
    const ym = d.toISOString().slice(0, 7);
    if (pmDay(ym + "-01") > t1) break;
    const mid = Math.min(pmDay(ym + "-15"), t1);
    if (mid > t0) out.push({ ym, day: mid });
  }
  return out;
}
function fitSoftLine(rows, { from, to, seed, pairs = [], first = false, nDraw = 2000 }) {
  const readings = rows.map(({ p, u }, i) => {
    const s0 = pmDay(p.dateStart || p.date), e = pmDay(p.date);
    return { house: p.pollster, day: Math.round((s0 + e) / 2), n: rowN(p) / HL_DEFF, und: u.v, idx: i };
  }).sort((a, b) => a.day - b.day);
  if (readings.length < 4) return null;
  let months = termMonths(from, to);
  /* a past term's line spans its house's polls only */
  if (first) months = months.filter((m) => m.day >= readings[0].day - 15 && m.day <= readings[readings.length - 1].day + 15);
  return fitUndecided(readings, { t0: pmDay(from), t1: pmDay(to), months, pairs: pairs.length ? pairs : [], seed, max: 100, nDraw });
}
const UNDM = JUR ? null : (() => {
  const tStart = Date.now();
  const t0 = pmDay(ELECTION.date), t1 = pmDay(LATEST_ISO);
  const months = MONTHS.map((ym) => ({ ym, day: ym === LATEST_ISO.slice(0, 7) ? t1 : Math.min(pmDay(ym + "-15"), t1) })).filter((m) => m.day > t0);
  const out = {};
  UNDECIDED_BASES.forEach((b, bi) => {
    const id = b.id;
    const readings = undecidedRows.filter((r) => r.u.basis === id && !/^EMRS/.test(r.p.pollster)).map(({ p, u }, i) => {
      const s = pmDay(p.dateStart || p.date), e = pmDay(p.date);
      return { house: p.pollster, day: Math.round((s + e) / 2), n: rowN(p) / HL_DEFF, und: u.v, idx: i };
    }).sort((a, b2) => a.day - b2.day);
    if (readings.length < 4) return;
    const firstMonth = months.find((m) => m.day >= readings[0].day) || months[0];
    const fit = fitUndecided(readings, { t0, t1, months, pairs: [[t1, t1 - 30], [t1, firstMonth.day]],
      seed: 20261126 + bi, max: b.kind === "soft" ? 100 : 50 });
    if (fit) out[id] = { ...fit, firstYm: firstMonth.ym };
  });
  console.log(`decidedness model: ${Object.entries(out).map(([id, f]) => `${id} ${r1(f.now.v)} [${r1(f.now.lo)}, ${r1(f.now.hi)}] (${f.n} polls, zero ${f.core.join("/") || "–"})`).join(" | ")} in ${((Date.now() - tStart) / 1000).toFixed(1)}s`);
  return out;
})();
for (const s of undecidedSeries) {
  const f = UNDM && UNDM[s.id];
  if (!f) continue;
  const [mo, since] = f.pairs;
  s.monthly = f.months.map((m) => ({ ym: m.ym, x: mx(m.ym), v: r1(m.v), lo: r1(m.lo), hi: r1(m.hi), ci: r1(m.ci),
    k: s.polls.filter((d) => d.ym === m.ym).length }));
  s.now = { v: r1(f.now.v), ci95: r1(f.now.ci), lo: r1(f.now.lo), hi: r1(f.now.hi), n: s.polls.filter((d) => ddays(refNow, Date.parse(d.released)) <= SPARSE_K.window).length,
    chg: r1(mo.v), changeCi95: r1(mo.ci), changeSig: mo.lo > 0 || mo.hi < 0, pUp: r2(mo.pUp),
    since: { from: f.firstYm, chg: r1(since.v), lo: r1(since.lo), hi: r1(since.hi), sig: since.lo > 0 || since.hi < 0, pUp: r2(since.pUp) },
    model: true };
  /* a one-house line has no lean to report: its pollster IS its zero */
  if (!s.house) {
    s.leans = Object.fromEntries(Object.entries(f.leans).map(([h, l]) => [h, { v: r1(l.v), lo: r1(l.lo), hi: r1(l.hi) }]));
    s.zero = f.core;
  }
  s.model = true;
}
/* The gaps between the undecided lines today, from the fits' draws paired
   at random (the fits are independent), each significant when its 95%
   interval excludes zero:
     tpp − first     after preferences over asked once: the voters who can
                     name a party but won't rank Labor against the Coalition
                     (Spectre asks both of the same voters, and its lean on
                     asked once is about zero)
     first − leaner  asked once over after a follow-up: a follow-up can only
                     shrink a pollster's own undecided share, but different
                     pollsters ask each way, so this gap also carries how
                     differently they poll – the panel says so */
const gapOf = (a, b) => {
  const A = UNDM && UNDM[a], B = UNDM && UNDM[b];
  if (!A || !B || !A.nowDraws || !B.nowDraws) return null;
  const n = Math.min(A.nowDraws.length, B.nowDraws.length), d = new Float64Array(n);
  for (let i = 0; i < n; i++) d[i] = A.nowDraws[i] - B.nowDraws[(i * 7919) % n];
  const lo = pmQuant(d, 0.025), hi = pmQuant(d, 0.975), v = pmMean(d);
  return { a, b, v: r1(v), lo: r1(lo), hi: r1(hi), sig: lo > 0 || hi < 0 };
};
const undecidedGaps = [gapOf("tpp", "first"), gapOf("first", "leaner")].filter(Boolean);
/* the past terms' modelled lines (build-undecided-history.mjs) and the polls
   behind them, for the panel's window; federal only */
const undecidedHistory = JUR ? null : (() => {
  let M = null, W = null;
  try { M = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "undecided-history-model.json"), "utf8")); } catch { return null; }
  try { W = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "undecided-history.json"), "utf8")); } catch { return null; }
  const polls = W.waves.filter((w) => w.und > 0 && (w.basis === "first" || w.basis === "leaner") && w.end < ELECTION.date)
    .map((w) => ({ x: dx(w.end), v: w.und, basis: w.basis, pollster: w.house, dateLabel: fwLabel(w.start, w.end), released: w.end, sample: w.n ?? null }));
  return { terms: M.terms, polls, built: M.built, src: M.src || null };
})();
const undecided = undecidedSeries.length ? {
  series: undecidedSeries,
  ...(undecidedHistory ? { history: undecidedHistory } : {}),
  ...(undecidedGaps.length ? { gaps: undecidedGaps } : {}),
  softAge,
  n: undecidedRows.length,
  houses: creditHouses(undecidedRows, (r) => r.p.pollster, (r) => Date.parse(r.p.date)),
} : null;

/* ---- 5c2. how firm each party's vote is ------------------------------------
   RedBridge/Accent's vote-softness table (polls.json `firmness`): for all
   voters and each party's voters, the share who are solid (certain they will
   vote that way), soft (may change) and very soft (undecided until prompted,
   or will probably change). The panel quotes the solid share – "certain of
   their vote" – per party.
   One house, monthly, so like the undecided lines this is that house's own
   series, not an aggregate. The current figure pools its last FIRM_POOL
   waves, each weighted by the party's effective respondents in it (the
   wave's effective sample times the party's primary), because one wave's
   One Nation or Greens cell rests on a hundred to three hundred people. The
   95% margin is binomial on that pooled base. The "Other" group is the row's
   independents and minor parties (RedBridge files them all under `ind`).
   Spectre's [firm, soft] pairs emit for its own poll detail, but stay out of
   this pool: its national soft share explicitly adds undecided voters and
   its chart has neither RedBridge's three categories nor an Other cohort. */
const FIRM_POOL = 3;
const FIRM_PARTIES = ["alp", "lnp", "onp", "grn", "oth"];
const firmRows = POLLS.filter((p) => p.pollster === "RedBridge/Accent" && p.firmness).sort((a, b) => (a.date < b.date ? -1 : 1));
const firmShare = (p, k) => (k === "oth" ? (p.ind ?? 0) + (p.oth ?? 0) : p[k]);
const firmWaveOf = (p) => {
  const eff = rowN(p) / HL_DEFF;
  const solid = {}, n = {};
  for (const k of ["all", ...FIRM_PARTIES]) {
    const v = p.firmness[k]?.[0];
    const share = k === "all" ? 100 : firmShare(p, k);
    if (!Number.isFinite(v) || !Number.isFinite(share) || share <= 0) continue;
    solid[k] = v;
    n[k] = Math.round(eff * share / 100);
  }
  return {
    x: dx(p.date), ym: ymOf(p.date), released: p.date, dateLabel: fwLabel(p.dateStart, p.date),
    pollster: p.pollster, sample: p.sample ?? null, solid, n,
    ...(p.firmnessNote ? { methodNote: p.firmnessNote } : {}),
    ...(p.decidedTerm && (p.firmnessSource || p.releaseUrl) ? { source: p.firmnessSource || p.releaseUrl } : {}),
  };
};
const firmWaves = firmRows.map(firmWaveOf);
const firmPooled = (ws) => Object.fromEntries(["all", ...FIRM_PARTIES].map((k) => {
  let sn = 0, snv = 0;
  for (const w of ws) {
    if (!Number.isFinite(w.solid[k]) || !(w.n[k] > 0)) continue;
    sn += w.n[k]; snv += w.n[k] * w.solid[k];
  }
  // a pool where no pooled wave filed the cohort's base (a wave can carry no
  // ind/oth at all, and "oth" derives from them) divides by zero - stay
  // absent (the usual null-for-no-figure contract) instead of printing NaN
  if (!sn) return [k, { v: null, ci95: null, n: 0 }];
  const v = snv / sn, q = v / 100;
  return [k, { v: r1(v), ci95: r1(196 * Math.sqrt(q * (1 - q) / sn)), n: Math.round(sn) }];
}));
const firmness = firmWaves.length >= FIRM_POOL ? (() => {
  const pool = firmWaves.slice(-FIRM_POOL);
  return {
    houses: creditHouses(firmWaves, (w) => w.pollster, (w) => Date.parse(w.released)),
    waves: firmWaves,
    pool: FIRM_POOL,
    now: { from: pool[0].dateLabel, to: pool[pool.length - 1].dateLabel, ...firmPooled(pool) },
    // the term's first waves, pooled the same way, for the change sentence
    base: { from: firmWaves[0].dateLabel, to: firmWaves[FIRM_POOL - 1].dateLabel, ...firmPooled(firmWaves.slice(0, FIRM_POOL)) },
  };
})() : null;
const decidedFirmHistory = decidedHistoryGroups((p) => p.pollster === "RedBridge/Accent" && p.firmness, firmWaveOf);
const decidednessHistory = JUR ? null : {
  soft: decidedSoftHistory,
  softAge: { pool: SOFT_AGE_POOL, terms: decidedAgeHistory },
  firmness: { pool: FIRM_POOL, terms: decidedFirmHistory },
};

/* ---- 5j. economic sentiment – business and consumer confidence ---------
   Four published sentiment gauges on one plot (data/confidence.json, built
   by .build/confidence.mjs from each house's own releases): the ANZ-Roy
   Morgan Consumer Confidence weekly reading and Westpac–Melbourne
   Institute's monthly Consumer Sentiment; Roy Morgan's monthly Business
   Confidence and the NAB Monthly Business Survey. The first three are
   index series with 100 as neutral; NAB prints a NET BALANCE (share
   optimistic minus pessimistic, 0 = neutral) – its rows stay true
   published figures and the PANEL shifts the line +100 so the shared
   neutral line holds. Conditions (cond/condChg) ride the NAB rows for
   the read-row text. Like the undecided lines these are each house's own
   series, not an aggregate – no house effect is estimable against a
   single publisher, and no election-result anchor exists to adjust
   toward. The panel draws the published series; the current reading is
   the latest release, with the change it printed. */
/* A row's fieldwork label: the consumer lanes print their survey window,
   a business release its one survey month; what wasn't printed stays a
   release date. One law for the panel dots and the archive rows below. */
const confFieldLabel = (r) => (r.fwStart ? fwLabel(r.fwStart, r.fwEnd || r.date)
  : r.fwm ? monthName(+r.fwm.slice(5, 7))
  : fwLabel(null, r.date));
const confidence = CONF_FILE ? Object.fromEntries(["consumer", "westpacConsumer", "business", "nabBusiness", "demosauConsumer"].map((k) => {
  const s = CONF_FILE[k];
  if (!s) return [k, null];   // a lane added to the file later never breaks an older checkout
  const polls = s.rows.map((r) => ({ x: dx(r.date), ym: ymOf(r.date), released: r.date, v: r.v, chg: r.chg ?? null, url: r.url, dateLabel: confFieldLabel(r),
    ...(k === "nabBusiness" ? { cond: r.cond, condChg: r.condChg ?? null } : {}) }))
    .filter((r) => r.x >= dx("2019-08-13"))   // the feed's dense coverage begins here (later lanes start later)
    .sort((a, b) => a.x - b.x);
  const last = polls[polls.length - 1];
  return [k, {
    label: s.label, base: s.base,
    polls,
    latest: last ? { v: last.v, chg: last.chg, released: last.released, url: last.url,
      ...(k === "nabBusiness" ? { cond: last.cond, condChg: last.condChg } : {}) } : null,
  }];
})) : null;

/* The four confidence gauges as ARCHIVE RELEASES for the All-polls table's
   confidence facet: one row per release in the term so far, shaped like
   directionOnlyPolls with its empty p / appr stubs, so a release never
   counts as a poll and the other facets never see these rows. The lane's
   product sits where a poll row's client sits; the figure and its printed
   change are the release's own, and `vs` is the lane's neutral print (NAB
   is the odd one out at 0 – drawn +100 only where a shared neutral line
   is plotted; here it keeps the figure the survey printed). */
/* Lane tuple: [confidence key, byline client, product line, neutral anchor,
   constant sample fallback]. The sample law is per-release provenance: a
   row's cell is the release's OWN printed figure (confidence.json row.n,
   read off its release by .build/confidence.mjs), the lane constant
   standing in where a house prints one (Westpac–MI's every bulletin:
   "conducted by OZINFO & DYNATA… based on 1200 adults"), else an honest
   em‑dash – never an invented constant. The fieldwork column is the
   release's own
   window (fwLabel of row.fwStart–row.fwEnd); a business release's one‑date
   survey month (row.fwm) prints as its month label; what wasn't printed
   stays a release date. Any sort of the table appends the fieldwork
   year's 'YY suffix, so `year` rides every row – String(undefined) would
   print "’de". */
const CONF_LANES = [
  ["consumer", "ANZ–Roy Morgan", "Consumer confidence", 100, null],
  ["westpacConsumer", "Westpac–MI", "Consumer sentiment", 100, 1200],
  ["demosauConsumer", "DemosAU", "Consumer sentiment", 50, null],
  ["business", "Roy Morgan", "Business confidence", 100, null],
  ["nabBusiness", "NAB", "Business confidence", 0, null],
];
const confidenceOnlyPolls = (() => {
  if (!CONF_FILE) return [];
  const out = [], eX = dx(ELECTION.date);
  for (const [k, by, product, vs, sample] of CONF_LANES) {
    const s = CONF_FILE[k];
    if (!s) continue;
    // `first` rides the conf payload because a null chg is two different
    // events - the lane's first release of the term, or the house printed
    // no numeric change (Roy Morgan's "virtually unchanged" waves). The
    // phone card's null-change line can only tell them apart with this flag.
    let first = true;
    let prevV = null;
    for (const r of s.rows) {
      if (dx(r.date) < eX) continue;
      const ym = ymOf(r.date);
      const field = confFieldLabel(r);
      out.push({
        ym, x: mx(ym) + (dayOf(r.date) - 15) / 365, day: dayOf(r.date),
        pollster: by, field, dateLabel: field, released: r.date,
        // the release date IS these waves' publication date (the extractor
        // stamps a date, never a clock time — the date-only Ipsos precedent);
        // the header sentence and the row cell's "released X" sub both read
        // p.published, so without this key a confidence release never said
        // when it came out
        published: r.date,
        sample: r.n ?? sample,
        ...(r.fwStart ? { fmid: fmidIso(r.fwStart, r.fwEnd || r.date) } : {}),
        // the field cell prints the survey month (business lane) — the
        // printed year must be that month's own year, or a January
        // release covering December renders "Dec '26"
        year: r.fwm && !r.fwStart ? +r.fwm.slice(0, 4) : +r.date.slice(0, 4),
        ...(r.url ? { url: r.url } : {}),
        client: product,
        p: {}, appr: {}, chg: null,
        conf: { k, lab: product, v: r.v, chg: r.chg ?? null, vs,
          ...(first ? { first: true } : {}),
          // printed change absent (a "virtually unchanged" verdict wave):
          // back it with the measured move on the lane's previous term
          // release, flagged chgCalc so the render can mark it calculated
          // and never pass it off as the house's print
          ...(r.chg == null && prevV != null ? { chgCalc: r1(r.v - prevV) } : {}),
          ...(k === "nabBusiness" && r.cond != null ? { cond: r.cond, condChg: r.condChg ?? null } : {}) },
      });
      first = false;
      prevV = r.v;
    }
  }
  return out.sort((a, b) => a.x - b.x || a.released.localeCompare(b.released));
})();

/* ---- 5b. where One Nation's gains came from ------------------------------
   From the vote-switching tables DemosAU and YouGov publish (built into
   data/vote-switching.json by .build/vote-switching.mjs): each 2025-vote
   group's share now voting One Nation. Weighted by that group's share of the
   2025 formal vote, that is how many points of the national vote One Nation
   has drawn from it; each group's part of the total drawn from everyone who
   did NOT vote One Nation in 2025 is the share plotted – "of One Nation's
   gain, x% came from Coalition voters".
   - Weights are the 2025 result, not each sample's own recalled vote: the
     question is about the electorate, and both houses weight to 2025 vote.
   - Other parties and independents are one group: DemosAU never splits them,
     so YouGov's two rows are combined at their own weights to match.
   - Voters who can't recall a 2025 vote, or didn't cast one, are left out of
     the split: only DemosAU shows them, and neither house says how many there
     are. So are One Nation's own 2025 voters – they are what it kept, not
     what it gained.
   - A wave missing a group (YouGov 24 Mar 2026 printed no "other" column)
     can't be split, and is skipped.
   - DemosAU's table stores only segments that round above zero, so a group
     row with no One Nation cell is a 0.
   - An MRP taken to reuse its house's own waves (reusesWaves) sits out, as
     it sits out of the aggregates: its respondents already count through
     those waves. Its table still reaches the CSV export (VS_BY_POLL).
   This section reads the tables; every figure the panel prints comes from
   the switching model (§5bm below). */
const VOTE_SWITCHING = (() => {
  if (JUR) return null;   // federal side data – absent for another jurisdiction
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, "data", "vote-switching.json"), "utf8")); }
  catch { return null; }
})();
/* Each wave's rates – % of each 2025 group now voting One Nation, and of One
   Nation's own 2025 voters still with it – keyed onto its poll for the
   archive's CSV export. YouGov's independents and other parties fold at their
   2025 weights, as the panel folds them. A group the wave didn't print is
   null, so a partial table still exports what it has. */
const VS_BY_POLL = new Map();
if (Array.isArray(VOTE_SWITCHING?.waves) && VOTE_SWITCHING.weights2025) {
  const W = VOTE_SWITCHING.weights2025;
  for (const w of VOTE_SWITCHING.waves) {
    const on = (g) => (w.rows && w.rows[g] ? (w.rows[g].onp ?? 0) : null);
    const oth = w.rows && w.rows.ind
      ? (on("ind") == null || on("oth") == null ? null : r1((W.ind * on("ind") + W.oth * on("oth")) / (W.ind + W.oth)))
      : on("oth");
    VS_BY_POLL.set(w.date + "|" + w.pollster, { lnp: on("lnp"), alp: on("alp"), grn: on("grn"), oth, onp: on("onp") });
  }
}
const ON_SOURCE_GROUPS = [
  { id: "lnp", label: "Coalition voters", color: "var(--lnp)", note: "voted Liberal or National in 2025" },
  { id: "alp", label: "Labor voters", color: "var(--alp)", note: "voted Labor in 2025" },
  { id: "oth", label: "Other voters", color: "var(--oth)", note: "voted for another party or an independent in 2025" },
  { id: "grn", label: "Greens voters", color: "var(--grn)", note: "voted Greens in 2025" },
];
/* The reverse read of the same recall tables (the "where they're going"
   views of §5b): a wave's 2025-cohort row as five DESTINATION shares of
   that cohort – kept (the cohort's own party), then the other parties
   present in the recall table, and oth, which folds the independents and
   YouGov's community-strong cell in, as the gain shares' oth branch
   already does. RedBridge's printed `und` residue cell (no other house
   prints one) is renormalised out so a row still sums to its decided
   cohort; absent cells read as zero, the gain rates' own convention (a
   chart read rounds small cells away). */
const GO_COHORTS = ["lnp", "alp", "grn"];
const GO_DESTS = { lnp: ["kept", "onp", "alp", "grn", "oth"],
                   alp: ["kept", "onp", "lnp", "grn", "oth"],
                   grn: ["kept", "onp", "alp", "lnp", "oth"] };
const goDestRow = (row, cohort) => {
  if (!row) return null;
  const und = Math.min(99, row.und ?? 0), k = 100 / (100 - und);
  const cell = (name) => (row[name] ?? 0) * k;
  const cs = (row["community-strong"] ?? row["community-strong-australia"] ?? 0) * k;
  return Object.fromEntries(GO_DESTS[cohort].map((d) => [d, r1(d === "kept" ? cell(cohort) : d === "oth" ? cell("oth") + cell("ind") + cs : cell(d))]));
};
const onSourceWaves = (() => {
  if (!Array.isArray(VOTE_SWITCHING?.waves) || !VOTE_SWITCHING.weights2025) return [];
  const W = VOTE_SWITCHING.weights2025;
  return VOTE_SWITCHING.waves.map((w) => {
    const p = POLL_BY_KEY.get(w.date + "|" + w.pollster);
    if (p && reusesWaves(p)) return null;
    const toOn = (g) => (w.rows?.[g] ? (w.rows[g].onp ?? 0) : null);
    const gain = {
      lnp: toOn("lnp") == null ? null : W.lnp * toOn("lnp") / 100,
      alp: toOn("alp") == null ? null : W.alp * toOn("alp") / 100,
      grn: toOn("grn") == null ? null : W.grn * toOn("grn") / 100,
      oth: w.rows.ind
        ? (toOn("ind") == null || toOn("oth") == null ? null : (W.ind * toOn("ind") + W.oth * toOn("oth")) / 100)
        : (toOn("oth") == null ? null : (W.ind + W.oth) * toOn("oth") / 100),
    };
    if (Object.values(gain).some((v) => v == null) || toOn("onp") == null) return null;
    const drawn = Object.values(gain).reduce((s, v) => s + v, 0);
    const kept = W.onp * toOn("onp") / 100;
    return {
      pollster: w.pollster, date: w.date, dateStart: w.dateStart, sample: w.sample, source: w.source,
      read: w.read, x: dx(w.date), ym: ymOf(w.date),
      share: Object.fromEntries(Object.entries(gain).map(([k, v]) => [k, r1(100 * v / drawn)])),
      pts: Object.fromEntries(Object.entries(gain).map(([k, v]) => [k, r1(v)])),
      drawn: r1(drawn), kept: r1(kept), keptPct: toOn("onp"),
      // % of each 2025 group now voting One Nation (YouGov's independents and
      // other parties folded at their own 2025 weights, to match DemosAU)
      toOn: { lnp: toOn("lnp"), alp: toOn("alp"), grn: toOn("grn"),
              oth: w.rows.ind ? r1((W.ind * toOn("ind") + W.oth * toOn("oth")) / (W.ind + W.oth)) : toOn("oth") },
      // the Coalition, Labor and Greens rows as destination shares (goDestRow)
      dest: { lnp: goDestRow(w.rows.lnp, "lnp"), alp: goDestRow(w.rows.alp, "alp"), grn: goDestRow(w.rows.grn, "grn") },
      // what the table itself adds up to (gains + kept; DemosAU's non-recall
      // group excluded) beside the wave's published One Nation primary
      implied: r1(drawn + kept), onp: w.onp,
    };
  }).filter(Boolean).sort((a, b) => a.x - b.x);
})();
/* ---- 5bm. the switching model (switch-model.mjs) -------------------------
   Every figure the panel and the replay print – each 2025 group's share now
   backing One Nation, One Nation's gain split and the share of its own 2025
   voters it kept, where the Coalition's, Labor's and the Greens' 2025 voters
   are going, the masthead replay's switching table – comes from one model of
   the five groups' rows (the module's header has the construction and the
   evidence; the prototype, backtest and fake-data check are in
   .build/analysis/switch-bayes/). Until 2026-11-24 each figure was its own
   six-week pool with no house adjustment.
   - It reads the tables the recipe read (onSourceWaves: every 2025 group
     printed – the user's complete-tables ruling – and an MRP reusing its
     house's waves left out), each row closed over the five: RedBridge's
     undecided cell out, the independents and YouGov's Community Strong cell
     in with others, YouGov's independents' and other parties' rows folded
     at their 2025 weights. DemosAU's can't-recall group is a row, not a
     column, and stays out.
   - A row's sample is the poll's (rowN, on the site's design effect) times
     the group's 2025 share: both houses weight to the 2025 result.
   - A line runs from the first table's month, each month at its middle and
     the current month at the newest poll of any kind (every line on the
     page ends there); its band is the 95% interval.
   - The change on a month ago and the change since the first month are the
     same draws read at two days. A "since February" claim needs Holm's
     correction across the lines it is chosen from: the four rates in One
     Nation's view, a cohort's five destinations in its own.
   - The gain split is worked out draw by draw (each group's points of the
     national vote are its 2025 share times its rate), so its interval
     carries every row's uncertainty – the recipe pushed the rates' margins
     through a first-order formula.
   - Two houses publish regularly, and each counts once: a figure sits
     midway between YouGov's and DemosAU's (a lean each is measured, not
     assumed); RedBridge's one table leans as it likes and moves nothing. */
const SWITCH_KEYS = ["alp", "lnp", "grn", "onp", "oth"];
const SW_SHARE25 = VOTE_SWITCHING && VOTE_SWITCHING.weights2025
  ? (({ alp, lnp, grn, onp, ind, oth }) => ({ alp, lnp, grn, onp, oth: ind + oth }))(VOTE_SWITCHING.weights2025) : null;
/* a printed row as the five, closed to 100: und/dnr out, any other cell
   (independents, Community Strong) with others */
const swClosed = (r) => {
  if (!r) return null;
  const colOf = (k) => (k === "und" || k === "dnr" ? null : SWITCH_KEYS.includes(k) ? k : "oth");
  const o = Object.fromEntries(SWITCH_KEYS.map((k) => [k, 0]));
  for (const [k, v] of Object.entries(r)) { const c = colOf(k); if (c && Number.isFinite(v)) o[c] += v; }
  const s = SWITCH_KEYS.reduce((t, k) => t + o[k], 0);
  return s > 0 ? Object.fromEntries(SWITCH_KEYS.map((k) => [k, (100 * o[k]) / s])) : null;
};
const SW_TABLES = (() => {
  if (!onSourceWaves.length || !SW_SHARE25) return [];
  const W = VOTE_SWITCHING.weights2025;
  const byKey = new Map(VOTE_SWITCHING.waves.map((w) => [w.date + "|" + w.pollster, w]));
  return onSourceWaves.map((sw) => {
    const R = byKey.get(sw.date + "|" + sw.pollster)?.rows || {};
    const rows = Object.fromEntries(["alp", "lnp", "grn", "onp"].map((g) => [g, swClosed(R[g])]));
    if (R.ind) {
      const a = swClosed(R.ind), b = swClosed(R.oth);
      rows.oth = a && b ? Object.fromEntries(SWITCH_KEYS.map((k) => [k, (W.ind * a[k] + W.oth * b[k]) / (W.ind + W.oth)])) : null;
    } else rows.oth = swClosed(R.oth);
    if (SWITCH_KEYS.some((g) => !rows[g])) return null;
    const p = POLL_BY_KEY.get(sw.date + "|" + sw.pollster);
    const s = pmDay(sw.dateStart || sw.date), e = pmDay(sw.date);
    return { key: sw.date + "|" + sw.pollster, house: sw.pollster, date: sw.date, ym: sw.ym, day: Math.round((s + e) / 2),
             n: rowN(p || { sample: sw.sample }), rows };
  }).filter(Boolean);
})();
const swR3 = (v) => Math.round(v * 1000) / 1000;
const SWM = (() => {
  if (!SW_TABLES.length) return null;
  const T0 = Date.now();
  const t1 = pmDay(LATEST_ISO), t0 = Math.min(...SW_TABLES.map((t) => t.day)) - 1;
  const firstYm = new Date((t0 + 1) * 86400000).toISOString().slice(0, 7), curYm = LATEST_ISO.slice(0, 7);
  const months = MONTHS.filter((ym) => ym >= firstYm)
    .map((ym) => ({ ym, day: ym === curYm ? t1 : Math.min(Math.max(pmDay(ym + "-15"), t0 + 1), t1) }));
  const first = months[0].day, prev = t1 - 30;
  const fit = fitSwitch(SW_TABLES, { share2025: SW_SHARE25, t0, t1, days: [...months.map((m) => m.day), prev],
    jumps: new Set(PRIM_JUMPS.map(pmDay)), nDraw: +(process.env.SW_NDRAW || 2000), seed: 20261124, M: 64 });
  const qi = (k) => SWITCH_KEYS.indexOf(k);
  /* one cell's draws (points) at a day; the gain split's draws for a group */
  const cell = (c, k, d) => swCol(fit.shares(c, d), qi(k));
  const GAIN = ["lnp", "alp", "grn", "oth"];
  const gainAt = (d) => {
    const rate = Object.fromEntries(GAIN.map((g) => [g, cell(g, "onp", d)])), n = rate.lnp.length;
    const pts = Object.fromEntries(GAIN.map((g) => [g, rate[g].map((v) => SW_SHARE25[g] * v / 100)]));
    const drawn = Float64Array.from({ length: n }, (_, i) => GAIN.reduce((t, g) => t + pts[g][i], 0));
    const share = Object.fromEntries(GAIN.map((g) => [g, pts[g].map((v, i) => 100 * v / drawn[i])]));
    return { pts, share, drawn };
  };
  const sm = (a) => { const lo = swQuant(a, 0.025), hi = swQuant(a, 0.975); return { v: swMean(a), lo, hi, ci: (hi - lo) / 2 }; };
  const diff = (a, b) => a.map((v, i) => v - b[i]);
  /* a current reading in the panels' shape: today, a month ago and the
     change between them (the same draws at both days) */
  const reading = (nowA, prevA) => {
    const s = sm(nowA), p = sm(prevA), dA = diff(nowA, prevA), d = sm(dA);
    return { v: r1(s.v), ci95: r1(s.ci), lo: r1(s.lo), hi: r1(s.hi), prev: r1(p.v),
             chg: r1(d.v), changeCi95: r1(d.ci), changeLo: r1(d.lo), changeHi: r1(d.hi), changeSig: d.lo > 0 || d.hi < 0,
             pUp: r2(swMean(dA.map((v) => (v > 0 ? 1 : 0)))), method: "bayes" };
  };
  const kOf = (ym) => SW_TABLES.filter((t) => t.ym === ym).length;
  const line = (f) => months.map((m) => { const s = sm(f(m.day)); return { ym: m.ym, x: mx(m.ym), v: r1(s.v), ci95: r1(s.ci), lo: r1(s.lo), hi: r1(s.hi), k: kOf(m.ym) }; });
  /* change since the first month, Holm-adjusted across a family of lines */
  const sinceFamily = (items) => {
    const rows = items.map(({ id, f }) => {
      const a = f(t1), b = f(first), d = diff(a, b), s = sm(d);
      return { id, from: r1(swMean(b)), to: r1(swMean(a)), chg: r1(s.v), lo: r1(s.lo), hi: r1(s.hi), p: swP(d) };
    });
    const ord = rows.map((r, i) => i).sort((a, b) => rows[a].p - rows[b].p);
    let run = 0;
    ord.forEach((i, j) => { run = Math.max(run, Math.min(1, (rows.length - j) * rows[i].p)); rows[i].padj = run; });
    return Object.fromEntries(rows.map((r) => [r.id, { ...r, p: swR3(r.p), padj: swR3(r.padj), sig: r.padj < 0.05 }]));
  };
  const gNow = gainAt(t1), gPrev = gainAt(prev);
  const rates = Object.fromEntries(GAIN.map((g) => [g, {
    now: reading(cell(g, "onp", t1), cell(g, "onp", prev)),
    monthly: line((d) => cell(g, "onp", d)),
  }]));
  const gains = Object.fromEntries(GAIN.map((g) => [g, {
    now: { ...reading(gNow.share[g], gPrev.share[g]), pts: r1(swMean(gNow.pts[g])) },
    monthly: months.map((m) => { const s = sm(gainAt(m.day).share[g]); return { ym: m.ym, x: mx(m.ym), v: r1(s.v), ci95: r1(s.ci), k: kOf(m.ym) }; }),
  }]));
  const kept = { now: reading(cell("onp", "onp", t1), cell("onp", "onp", prev)), monthly: line((d) => cell("onp", "onp", d)) };
  const rateTrend = sinceFamily(GAIN.map((g) => ({ id: g, f: (d) => cell(g, "onp", d) })));
  /* Coalition v Labor rates, today: the difference and the ratio */
  const rl = cell("lnp", "onp", t1), ra = cell("alp", "onp", t1), dLA = sm(diff(rl, ra)), rr = sm(rl.map((v, i) => v / ra[i]));
  const compare = { diff: r1(dLA.v), diffLo: r1(dLA.lo), diffHi: r1(dLA.hi), apart: dLA.lo > 0 || dLA.hi < 0,
                    ratio: r2(rr.v), ratioLo: r2(rr.lo), ratioHi: r2(rr.hi) };
  /* where a cohort's voters are going: GO_DESTS order (kept first) */
  const destParty = (c, dId) => (dId === "kept" ? c : dId);
  const going = Object.fromEntries(GO_COHORTS.map((c) => {
    const f = (dId) => (d) => cell(c, destParty(c, dId), d);
    const dests = Object.fromEntries(GO_DESTS[c].map((dId) => [dId, { now: reading(f(dId)(t1), f(dId)(prev)), monthly: line(f(dId)) }]));
    const apart = {};
    for (const a of GO_DESTS[c]) for (const b of GO_DESTS[c]) if (a !== b) {
      const s = sm(diff(f(a)(t1), f(b)(t1)));
      apart[a + "|" + b] = s.lo > 0 || s.hi < 0;
    }
    return [c, { dests, apart, trend: sinceFamily(GO_DESTS[c].map((dId) => ({ id: dId, f: f(dId) }))) }];
  }));
  /* each regular house's lean on the One Nation rates today (its printed
     share minus the line), for Info */
  const leans = Object.fromEntries(fit.houses.filter((h) => !fit.lone.has(h)).map((h) => [h, Object.fromEntries(
    [...GAIN, "onp"].map((g) => { const l = fit.lean(g, h); return [g === "onp" ? "kept" : g, l ? r1(swMean(swCol(l, qi("onp")))) : null]; }))]));
  /* the switching table today, for the replay: points of the 2025 vote
     each 2025 group now gives each party */
  const table = Object.fromEntries(SWITCH_KEYS.map((g) => {
    const d = fit.shares(g, t1);
    return [g, Object.fromEntries(SWITCH_KEYS.map((k) => [k, r2(SW_SHARE25[g] * swMean(swCol(d, qi(k))) / 100)]))];
  }));
  const th = fit.theta;
  console.log(`switching model: ${SW_TABLES.length} tables (${[...new Set(SW_TABLES.map((t) => t.house))].join(", ")}) in ${((Date.now() - T0) / 1000).toFixed(1)}s`
    + ` | Coalition→ON ${rates.lnp.now.v} ±${rates.lnp.now.ci95}, Labor→ON ${rates.alp.now.v} ±${rates.alp.now.ci95}, kept ${kept.now.v}`
    + ` | ESS ${fit.settings.ess.toFixed(1)} of 64 | κ ${JSON.stringify(Object.fromEntries([...fit.settings.kappa].filter(([h]) => !fit.lone.has(h))))}`
    + ` | ω ${SWITCH_KEYS.map((k) => k + " " + th["w_" + k].toPrecision(2)).join(" ")}`);
  return { t1, first, firstYm, months, rates, gains, kept, rateTrend, compare, going, leans, table, drawn: r1(swMean(gNow.drawn)) };
})();
const onSources = onSourceWaves.length && SWM ? {
  model: true,
  series: ON_SOURCE_GROUPS.map((g) => {
    const polls = onSourceWaves.map((w) => ({
      x: w.x, ym: w.ym, pollster: w.pollster, dateLabel: fwLabel(w.dateStart, w.date), released: w.date,
      sample: w.sample ?? null, v: w.share[g.id], pts: w.pts[g.id],
    }));
    /* the panel's two views of a group: its part of One Nation's gain
       (now, monthly), and its rate - the share of its 2025 voters now
       backing One Nation - before any split (rate: now, monthly, a dot
       per poll as printed) */
    const rate = {
      ...SWM.rates[g.id],
      polls: onSourceWaves.filter((w) => w.toOn[g.id] != null).map((w) => ({
        x: w.x, ym: w.ym, pollster: w.pollster, dateLabel: fwLabel(w.dateStart, w.date), released: w.date,
        sample: w.sample ?? null, v: w.toOn[g.id],
      })),
      trend: SWM.rateTrend[g.id],
    };
    return { ...g, polls, monthly: SWM.gains[g.id].monthly, n: polls.length, now: SWM.gains[g.id].now, rate };
  }),
  /* One Nation's own 2025 voters still with it */
  kept: { ...SWM.kept, polls: onSourceWaves.map((w) => ({ x: w.x, ym: w.ym, pollster: w.pollster, dateLabel: fwLabel(w.dateStart, w.date), released: w.date, sample: w.sample ?? null, v: w.keptPct })) },
  compare: SWM.compare,
  since: SWM.firstYm,
  leans: SWM.leans,
  /* the tables behind the figures: how many, whose, and who published in
     the last six weeks (the section's meta line) */
  now: { drawn: SWM.drawn, window: SPARSE_K.label, tables: SW_TABLES.length,
         n: SW_TABLES.filter((t) => { const d = SWM.t1 - t.day; return d >= 0 && d <= SPARSE_K.window; }).length,
         houses: [...new Set(SW_TABLES.filter((t) => { const d = SWM.t1 - t.day; return d >= 0 && d <= SPARSE_K.window; }).map((t) => t.house))] },
  waves: onSourceWaves.map(({ x, ym, ...w }) => ({ dateLabel: fwLabel(w.dateStart, w.date), ...w })),
  houses: creditHouses(onSourceWaves, (w) => w.pollster, (w) => Date.parse(w.date)),
  weights: VOTE_SWITCHING.weights2025,
  /* the reverse read, for the panel's Coalition, Labor and Greens views:
     each cohort's 2025 voters as destination shares (kept, then GO_DESTS),
     the model's now and month-by-month line, a dot per poll as printed
     (goDestRow's folds documented there); apart: which two destinations'
     shares differ beyond their joint 95% interval today; trend: the change
     since the first month, Holm across the five */
  going: GO_COHORTS.map((c) => ({
    id: c,
    weight: VOTE_SWITCHING.weights2025[c],
    apart: SWM.going[c].apart,
    dests: GO_DESTS[c].map((d) => ({
      id: d,
      ...SWM.going[c].dests[d],
      trend: SWM.going[c].trend[d],
      polls: onSourceWaves.filter((w) => w.dest?.[c]).map((w) => ({
        x: w.x, ym: w.ym, pollster: w.pollster, dateLabel: fwLabel(w.dateStart, w.date), released: w.date,
        sample: w.sample ?? null, v: w.dest[c][d],
      })),
    })),
  })),
} : null;

/* The switching table, for the masthead dial's replay (wm-story.jsx), whose
   four primary bars trade mass in these proportions: the model's table
   today (§5bm) – each 2025 group's row as points of the 2025 vote now with
   Labor, the Coalition, the Greens, One Nation and everyone else.
   - Everyone else is one group on both sides, as in the model's rows.
   - One table, not month by month: each table already counts the switching
     from the election to its date, and the replay spreads one pattern over
     the months, scaled to each month's movement (buildDialStory), so the
     exchange never animates the month-to-month wobble of the estimates.
     Until 2026-11-24 the pattern was every table pooled at once; the model's
     table today is the same question answered with the latest evidence.
   flows[i][j]: points of the 2025 vote now with party j that voted for
   group i in 2025 (i = j: kept). */
const switchFlows = SWM ? { keys: SWITCH_KEYS, flows: SWM.table, tables: SW_TABLES.length,
  from: SW_TABLES[0].date, to: SW_TABLES[SW_TABLES.length - 1].date,
  houses: [...new Set(SW_TABLES.map((t) => t.house))], model: true } : null;

/* ---- 5c. the vote by group: the tables ---------------------------------------
   data/demographics.json (.build/demographics.mjs) – each house's groups, per
   wave, as published. The figures built from them are §7g: they anchor on
   the current primaries (§7e), so they are assembled after those. */
const DEMOGRAPHICS = (() => {
  if (JUR) return null;   // federal side data – absent for another jurisdiction
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, "data", "demographics.json"), "utf8")); }
  catch { return null; }
})();
/* the national census income histograms the income tab standardises
   through (§7g-income; built by .build/extract-income-dist.mjs) */
const INCOME_DIST = (() => {
  if (JUR) return null;   // federal side data – absent for another jurisdiction
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, "data", "income-dist.json"), "utf8")); }
  catch { return null; }
})();
/* adults by single year of age, along which a house's age bands are read
   at the common 18–34 / 35–54 / 55+ it doesn't print (§7g-age; built by
   .build/extract-age-dist.mjs). Every harmonize here reads through it, so
   the pools, the group-view dots, the export and the roster agree. */
const AGE_DIST = (() => {
  if (JUR) return null;   // federal side data – absent for another jurisdiction
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, "data", "age-dist.json"), "utf8")); }
  catch { return null; }
})();
const harmonize = (w) => harmonizeRaw(w, { ageDist: AGE_DIST });
// the wave's poll row: its own date, or – Resolve's series date sits a day or
// so off its polls.json row – the nearest row of that house within four days
const demoPollOf = (w) => {
  const ms = Date.parse(w.date);
  return POLLS.filter((q) => q.pollster === w.pollster && Math.abs(Date.parse(q.date) - ms) <= 4 * 86400000)
    .sort((a, b) => Math.abs(Date.parse(a.date) - ms) - Math.abs(Date.parse(b.date) - ms))[0] || null;
};
/* Pooled releases (Newspoll's ~75-day quarterly tables, n≈5,000; Roy
   Morgan's seven-month country-of-birth pool, n≈26,000) combine a house's
   regular waves, so none reads as one fieldwork wave: dated at its end, a
   quarter would sit in its last month as if freshly polled. The "(pooled)"
   label marks them, not the fieldwork's length: a single long survey – the
   MRPs, 37–49 days for DemosAU's – is one reading, placed exactly as the
   headline places every poll (midpoint for the window, end month for the
   line, rowN), and counts in §7g as it does there (ruling 2026-10-11; the
   35-day span test that kept the MRPs out went with it).
   A "(pooled)" release is the house's own regular waves inside its dates,
   their tables combined – each of Newspoll's five so far is exactly its
   three or four fortnightly waves, samples summing to the pool's n – so
   §7g reads it AS those waves: each carries the pool's group gaps at its
   own dates, weighted as that wave is in the headline (rowN of the wave,
   not a share of the pool's n, which SAMPLE_CAP would cut). Only its tables are
   used this way; its vote figures stay out of the aggregates (NO_AGG_HOUSES),
   since those waves' own figures are already in them. A long wave whose
   parts can't be found or don't sum to its sample has none (null), and
   sits out of §7g altogether. (Ruling 2026-10-11.) */
const isPooledRelease = (r) => / \(pooled\)$/.test(r.pollster || "");
const pooledParts = (p) => {
  const house = p && p.sample ? p.pollster.replace(/ \(pooled\)$/, "") : null;
  if (!house || house === p.pollster) return null;
  const parts = POLLS.filter((q) => q.pollster === house && q.sample && (q.dateStart || q.date) >= p.dateStart && q.date <= p.date);
  const sum = parts.reduce((a, q) => a + q.sample, 0);
  return parts.length && Math.abs(sum - p.sample) <= 0.01 * p.sample ? parts : null;
};
/* A table's shares taken to 100 (DEMO_KEYS order: §7g's), and a wave's own
   all-voters figure: the table's where it prints one, else the published
   primaries. A printed zero stays 0 but an ABSENT key stays null – an
   unprinted party (RedBridge Jul 2025's Others folds One Nation in) is
   never read as a zero share by any pool downstream. */
const DEMO_KEYS = ["alp", "lnp", "onp", "grn", "oth"];
const demoNorm = (s) => {
  const t = DEMO_KEYS.reduce((a, k) => a + (+s[k] || 0), 0);
  return t > 0 ? Object.fromEntries(DEMO_KEYS.map((k) => [k, s[k] == null ? null : 100 * (+s[k] || 0) / t])) : null;
};
/* a shares-map's own five-party total – the group tables' and the income
   bands' common normaliser beside demoNorm */
const total = (s) => DEMO_KEYS.reduce((a, k) => a + s[k], 0);
const demoTotalOf = (w, p) => (w.total && Object.keys(w.total).length ? demoNorm(w.total)
  : p && p.alp != null ? demoNorm({ alp: p.alp, lnp: p.lnp, onp: p.onp ?? 0, grn: p.grn ?? 0, oth: (p.ind ?? 0) + (p.oth ?? 0) }) : null);
/* Each wave's figures for the common groups – exactly what §7g pools – keyed
   onto its poll row, so the archive's CSV export carries them. `v` follows
   DEMO_GROUPS (null where the poll didn't ask), each [alp, lnp, grn, onp,
   oth] as published (RedBridge's two school rows merged, as the pooling
   merges them; an unprinted party is null, never a zero – RedBridge Jul
   2025 has no One Nation cut at all); `r` is how the figures were read;
   `t` is the wave's own all-voters figure in the same order, taken to 100,
   so the panel can plot each poll's gap from it as §7g pools it. `d` is
   the wave's table exactly
   as the house printed it – every cut but RedBridge's vote firmness, each
   group [label, [alp, lnp, grn, onp, oth]] in the house's own order – for
   the All-polls demographics facet: its rows compare two of these groups
   (YouGov's 65+ and DemosAU's regional-or-rural voters join no common
   group, so `v` alone can't serve them) and an opened poll shows the lot. */
const DEMO_GROUPS = DEMO_SETS.flatMap((st) => st.groups)
  /* the two standardised income bands close the list – appended LAST so
     every common group's slot keeps its place: the primary chart's group
     views (and the CSV export) find a wave's income reads by this index */
  .concat(INCOME_STD_BANDS.map((b) => b.group));
const DEMO_RAW_DIMS = ["gender", "age", "generation", "education", "income", "working", "occupation", "country", "state", "location", "housing", "language", "religion", "children", "class", "stress", "electorate"];
const DEMO_BY_POLL = new Map();

/* DemosAU MRP preference flows, all regions. The reports print each contest's
   flows by region only (Inner Metro, Outer Metro, Regional/Rural); `all` is
   the site's weighting of those cells, carried beside them as pf.all. Each
   cohort's region weight is the region's 2025 enrolment (AEC demographic
   classification, data/aec-2025-division-class.json; Regional = provincial +
   rural) times that cohort's share of the vote there in the same MRP
   (demographics.json's location table), so a region counts by how many of
   that cohort's voters live in it. Whole numbers, as the regions print. */
const AEC_CLASS = (() => {
  if (JUR) return null;
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, "data", "aec-2025-division-class.json"), "utf8")); }
  catch { return null; }
})();
const PF_REGION_ENROL = AEC_CLASS ? AEC_CLASS.divisions.reduce((o, d) => {
  const k = d.class === "provincial" || d.class === "rural" ? "regional" : d.class;
  o[k] = (o[k] || 0) + d.enrolment;
  return o;
}, {}) : null;
const PF_LOC = { inner: "Inner metro", outer: "Outer metro", regional: "Reg & Rur" };
function prefFlowsOut(p) {
  const pf = p.pref_flows;
  const w = (DEMOGRAPHICS?.waves || []).find((x) => x.pollster === p.pollster && x.date === p.date);
  const loc = w && w.dims && w.dims.location;
  if (!PF_REGION_ENROL || !loc || !Object.values(PF_LOC).every((l) => loc[l])) return pf;
  const one = (t, ks) => {
    if (!t || !["inner", "outer", "regional"].every((r) => t[r])) return null;
    const o = {};
    for (const k of ks) {
      let num = 0, den = 0;
      for (const r of ["inner", "outer", "regional"]) {
        const wt = PF_REGION_ENROL[r] * (loc[PF_LOC[r]][k] || 0);
        num += wt * t[r][k]; den += wt;
      }
      if (den > 0) o[k] = Math.round(num / den);
    }
    return o;
  };
  const all = { alp_onp: one(pf.alp_onp, ["lnp", "grn", "oth"]), lnp_onp: one(pf.lnp_onp, ["alp", "grn", "oth"]) };
  return all.alp_onp || all.lnp_onp ? { ...pf, all } : pf;
}
for (const w of (Array.isArray(DEMOGRAPHICS?.waves) ? DEMOGRAPHICS.waves : [])) {
  const p = demoPollOf(w);
  if (!p) continue;
  const h = harmonize(w);
  /* a model taken to reuse its house's own waves (reusesWaves) joins no
     group, so it carries none – no group-view dot, no export columns – and
     `x` tells the facet why; its printed table still shows (d) */
  const reuse = reusesWaves(p);
  /* the wave's standardised income reads fill the two band slots at v's
     tail. No house prints those bands, so the slot IS §7g's pooled figure
     for the wave (the fitted line's read, normalised the pool's way) – a
     group-view dot or CSV cell then matches exactly what the pools saw */
  const inc = reuse ? null : incomeStandardise(w.pollster, w.dims && w.dims.income, midMs(p));
  const v = DEMO_GROUPS.map((g) => {
    if (reuse) return null;
    if (INCOME_STD_BANDS.some((b) => b.group === g)) {
      const sh = inc && inc.shares[g] && demoNorm(inc.shares[g]);
      return sh ? ["alp", "lnp", "grn", "onp", "oth"].map((k) => (sh[k] == null ? null : r1(sh[k]))) : null;
    }
    const st = DEMO_SETS.find((x) => x.groups.includes(g));
    const sh = h[st.id] && h[st.id][g];
    return sh ? ["alp", "lnp", "grn", "onp", "oth"].map((k) => (sh[k] == null ? null : r1(sh[k]))) : null;
  });
  /* each group's subsample size, estimated exactly the wv rug's way (rowN
     times the group's rough share of voters), so a group-view poll dot's
     tooltip can say how many respondents its figure rests on */
  const n = DEMO_GROUPS.map((g) => Math.round(rowN(p) * DEMO_SHARE[g]));
  while (v.length && v[v.length - 1] == null) { v.pop(); n.pop(); }
  const tot = demoTotalOf(w, p);
  /* the age groups read off the house's own bands rather than printed
     (§7g-age): the facet keeps to printed pairs and the opened poll says
     which of its groups count as estimates */
  const ag = reuse ? null : ageStandardise(w.dims && w.dims.age, AGE_DIST);
  const ar = ag ? ag.read.filter((g) => v[DEMO_GROUPS.indexOf(g)]) : [];
  const d = Object.fromEntries(DEMO_RAW_DIMS.filter((k) => w.dims && w.dims[k]).map((k) => [k,
    Object.entries(w.dims[k]).map(([g, s]) => [g, ["alp", "lnp", "grn", "onp", "oth"].map((q) => (s[q] != null ? r1(+s[q]) : null))])]));
  /* a pooled release's parts (pooledParts), where its groups reach the
     charts as §7g pools them: one group-view dot per part, each at the
     part's own date (x as individualPolls places a row) and anchored on
     the part's month, `k` its weighting n over the release's (so the
     group's n × k is the part's, as §7g sizes it), `l` its fieldwork –
     never one dot at the release's end month */
  const pp = v.some(Boolean) && isPooledRelease(p) ? pooledParts(p) : null;
  // a wave everything harmonised out of (the pooled birth-country release
  // joins no common group) still carries its raw cuts to the facet
  if (v.some(Boolean) || Object.keys(d).length) DEMO_BY_POLL.set(p.date + "|" + p.pollster,
    { r: w.read, v, d, n, ...(reuse ? { x: "reuse" } : {}), ...(ar.length ? { ar } : {}), ...(tot ? { t: ["alp", "lnp", "grn", "onp", "oth"].map((k) => (tot[k] == null ? null : r1(tot[k]))) } : {}),
      ...(w.onp2025 ? { onp2025: w.onp2025 } : {}),
      ...(pp ? { sp: pp.map((q) => ({ x: mx(ymOf(q.date)) + (dayOf(q.date) - 15) / 365, ym: ymOf(q.date), k: rowN(q) / rowN(p), l: fwLabel(q.dateStart, q.date) })) } : {}) });
}
/* Solo single-territory readings for the ACT/NT/Tas group. Displayed on the
   trio's view (open dots, flagged solo) and NEVER pooled, lined or counted
   in any aggregate: a cut of one territory is not the trio's people. Two
   sources, every figure the house's own print in DEMO_KEYS order:
   - the crosstabs' Tas/ACT/NT state cuts (Roy Morgan's Tas-only cut;
     DemosAU (MRP)'s three rows), from the same demographics.json dims the
     common groups are harmonised from;
   - a no-aggregate "(Tas)" state house (today EMRS): the whole poll IS the
     territory, so the row's own primaries are the printed reading – the
     suffix is parsed, so any future "(ACT)"/"(NT)" house flows in the same
     way. */
const SOLO_TERMS = ["Tas", "ACT", "NT"];
const SOLO_BY_POLL = new Map();
for (const w of (Array.isArray(DEMOGRAPHICS?.waves) ? DEMOGRAPHICS.waves : [])) {
  const st = w.dims && w.dims.state;
  const cuts = st ? SOLO_TERMS.filter((t) => st[t] && Object.keys(st[t]).length) : [];
  if (!cuts.length) continue;
  const p = demoPollOf(w);
  if (!p) continue;
  const list = cuts.map((t) => ({ terr: t, ...Object.fromEntries(DEMO_KEYS.map((k) => [k, st[t][k] == null ? null : +st[t][k]])) }));
  SOLO_BY_POLL.set(p.date + "|" + p.pollster, (SOLO_BY_POLL.get(p.date + "|" + p.pollster) || []).concat(list));
}
for (const p of POLLS) {
  const m = /\((Tas|ACT|NT)\)$/.exec(p.pollster || "");
  if (!m || !noAggPoll(p) || p.alp == null) continue;
  // whole: the whole poll IS the territory – drawn at its raw printed share
  SOLO_BY_POLL.set(p.date + "|" + p.pollster,
    [{ terr: m[1], whole: true, alp: p.alp ?? null, lnp: p.lnp ?? null, onp: p.onp ?? null, grn: p.grn ?? null,
       oth: p.ind != null || p.oth != null ? (p.ind ?? 0) + (p.oth ?? 0) : null }]);
}

/* ---- 6. individual polls (full archive) -------------------------------- */

/* ---- 6a. a poll's outbound links, named for what is behind each -------- */

/* The citation watchdog's ledger (data/link-health.json — .build/
   check-citations.mjs, weekly): per cited url, its last verdict and the
   date a Wayback Machine capture was secured. linksOf annotates each
   emitted link whose live target is not plainly healthy — paywalled,
   moved or gone — so the views can offer the archived copy beside it:
   the dated capture where the ledger holds a stamp, archive.org's
   latest capture (the /web/2/ form) where it does not. A healthy link
   earns nothing: a fallback is only a fallback where the live link can
   fail the reader. The ledger file is optional at build time; a clone
   without it simply builds the links as before. */
const LINK_HEALTH = (() => {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "link-health.json"), "utf8"));
    return new Map((j.links || []).map((e) => [e.url, e]));
  } catch { return new Map(); }
})();
const LINK_FALLBACK_VERDICTS = new Set(["wall", "moved", "gone"]);
const WAYBACK_MONTHS = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];
const waybackAnnotate = (l) => {
  const h = l && l.href ? LINK_HEALTH.get(l.href) : null;
  if (!h || l.pending) return;
  // the /web/<yyyymmdd>/ form resolves to the nearest capture at the stamp
  // date; for a stamped entry that is the very capture the pass secured
  if (h.wayback && LINK_FALLBACK_VERDICTS.has(h.verdict)) {
    const ymd = h.wayback.replace(/-/g, "");
    l.wb = `https://web.archive.org/web/${ymd}/${l.href}`;
    const day = Number(ymd.slice(6)), mon = WAYBACK_MONTHS[Number(ymd.slice(4, 6)) - 1], yr = ymd.slice(0, 4);
    const why = h.verdict === "wall" ? "paywalled or blocked on the live site"
      : h.verdict === "gone" ? "gone from the live site" : "moved or redirected on the live site";
    l.wbTitle = `The live link is ${why}. This is the page as the Wayback Machine captured it on ${day} ${mon} ${yr}.`;
  } else if (!h.wayback && LINK_FALLBACK_VERDICTS.has(h.verdict)) {
    // failing on the live site and never stamped: offer archive.org's
    // latest capture, if it holds one
    l.wb = `https://web.archive.org/web/2/${l.href}`;
    const why = h.verdict === "wall" ? "paywalled or blocked on the live site"
      : h.verdict === "gone" ? "dead on the live site" : "moved or redirected on the live site";
    l.wbTitle = `The live link is ${why}. This is the latest capture the Wayback Machine holds, if it has one.`;
  }
};
/* One list, built here, that both redesign views render as is, so a link
   can't open the AFR article in Latest polls and Accent's page in All polls
   under the same words. Each link says whose it is: the house's own release
   ("Accent’s release"), its APC methodology statement, or the press report
   the row was read from, named by outlet ("AFR report"), which also tells
   a reader before the click that it is probably paywalled. A house whose
   releases also have a home — pollsterRules.releaseHub, today Essential's
   Federal Political Insights and SMH's Resolve Political Monitor page —
   gets its rolling series page as a further link, sitting beside the
   dated release it complements. */
// hosts that are the pollster's own (its release, report PDF or statement)
const OWN_HOSTS = ["roymorgan.com", "spectrestrategy.com", "demosau.com", "essentialreport.com.au",
  "usrfiles.com", "accent-research.com", "foxhedgehog.com.au", "freshwaterstrategy.com", "yougov.com",
  "pyxispolling.com", "resolvestrategic.com", "secnewgate.com.au", "ipsos.com"];
// the press or commissioning page a row cites, as its link reads
const CITE_LABEL = {
  "afr.com": "AFR report", "theaustralian.com.au": "The Australian’s report", "smh.com.au": "SMH report",
  "theage.com.au": "The Age’s report", "thenewdaily.com.au": "The New Daily’s report",
  "thenightly.com.au": "The Nightly’s report", "skynews.com.au": "Sky News report", "news24.com.au": "News24 report",
  "capitalbrief.com": "Capital Brief report", "theguardian.com": "Guardian report",
  "dailytelegraph.com.au": "Telegraph report", "heraldsun.com.au": "Herald Sun report",
  "couriermail.com.au": "Courier-Mail report", "thechronicle.com.au": "Chronicle report",
  "news.com.au": "news.com.au report", "theadvertiser.com.au": "Advertiser report",
  "thewest.com.au": "West Australian report", "abc.net.au": "ABC report", "heraldsun.com": "Herald Sun report",
  "pollbludger.net": "Poll Bludger post", "x.com": "Post on X", "twitter.com": "Post on X",
  "australiainstitute.org.au": "Australia Institute report", "climatecouncil.org.au": "Climate Council report",
  // Blueprint's report sits on a raw S3 host - name it, else it fell back to "Report (<host>)"
  "blueprintinstitute.s3.ap-southeast-2.amazonaws.com": "Report",
};
// the house as its own release is signed (Accent files RedBridge/Accent's)
const RELEASE_BY = { "RedBridge/Accent": "Accent", Redbridge: "RedBridge", "Spectre Strategy": "Spectre" };
/* Where a house files each wave's release / APC statement, for a link it
   has not posted yet: only houses that post one for every wave, at an
   address that lists them. DemosAU's report is its statement (oneDoc). */
const PENDING_AT = {
  "RedBridge/Accent": { release: "https://www.accent-research.com/projects", method: "https://www.accent-research.com/projects" },
  DemosAU: { release: "https://demosau.com/methodology-statements/", method: "https://demosau.com/methodology-statements/", oneDoc: true },
  Newspoll: { method: "https://pyxispolling.com/apc" },
  YouGov: { method: "https://yougov.com/about/methodology/australian-polling-council" },
  Essential: { method: "https://essentialreport.com.au/methodology" },
};
/* The "eff. TBC" marker beside a filing house's un-stamped wave links TBC to
   the page where the house will file the wave's APC statement — per house
   (user call 2026-10-12: YouGov's belongs at YouGov's own APC page, not
   Newspoll's pyxispolling.com/apc register). The same landings the pending
   links above use; any house without an entry renders TBC unlinked. */
const effTbcUrls = Object.fromEntries(Object.entries(PENDING_AT).map(([house, at]) => [house, at.method]));
// a pending link only on the house's newest wave, and only while it is recent
// (a wave the house never posted for stops promising once the next one lands)
const PENDING_DAYS = 60;
const NEWEST_OF = new Map();
for (const p of POLLS) if (!NEWEST_OF.has(p.pollster) || p.date > NEWEST_OF.get(p.pollster)) NEWEST_OF.set(p.pollster, p.date);
const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };
const onHost = (h, list) => list.some((d) => h === d || h.endsWith("." + d));
const linksOf = (p) => {
  const urlOwn = p.url && onHost(hostOf(p.url), OWN_HOSTS);
  const rel = p.releaseUrl || (urlOwn ? p.url : null);
  const house = p.pollster.replace(/\s*\(.*\)$/, "");   // "Roy Morgan (SMS)", "DemosAU (MRP)"
  const by = RELEASE_BY[house] || house;
  const at = PENDING_AT[p.pollster] || {};
  const waiting = NEWEST_OF.get(p.pollster) === p.date && (Date.parse(LATEST_ISO) - Date.parse(p.date)) / 86400000 <= PENDING_DAYS;
  const both = rel && p.methodUrl === rel;
  const runningData = house === "DemosAU" && p.date >= "2026-10-26";
  const out = [];
  if (rel) out.push({ k: "release", t: by + "’s release" + (runningData ? " (with running data series)" : "") + (both ? ", with methodology" : ""), href: rel,
    title: both ? by + "’s own release of this poll, which includes its APC methodology statement" : by + "’s own release of this poll" });
  else if (waiting && at.release) out.push({ k: "release", pending: true, t: by + "’s release" + (at.release === at.method ? (at.oneDoc ? ", with methodology" : " and methodology") : "") + ": not yet out", href: at.release,
    title: by + " hasn’t posted this poll’s release yet. This opens the page where it files them." });
  if (RELEASE_HUB.has(house)) out.push({ k: "series", t: "Running data series", href: RELEASE_HUB.get(house),
    title: by + "’s rolling report collection – every wave of the house’s series, the historical vote tables included" });
  // Newspoll's pooled waves are the only rows carrying a tablesUrl: The
  // Australian posts its demographic-tables supplement on its origin CDN
  // (no redirect off the article page), so it links alongside the release
  if (p.tablesUrl) out.push({ k: "tables", t: "Demographic tables (PDF)", href: p.tablesUrl,
    title: "The Australian’s published demographic and breakdown tables for this poll" });
  /* RedBridge/Accent's APC statement is the wave's accent-research.com
     publication in full - label the link what it opens, not the statement's
     Polling-Council role alone (user call 2026-11-12) */
  const methodLabel = /^redbridge/i.test(house) ? "Full publication" : "APC methodology";
  if (p.methodUrl && !both) out.push({ k: "method", t: methodLabel, href: p.methodUrl,
    title: /^redbridge/i.test(house)
      ? "The full Accent Research publication – this poll’s Australian Polling Council methodology statement"
      : "This poll’s Australian Polling Council methodology statement" });
  else if (!p.methodUrl && waiting && at.method && !(!rel && at.release === at.method))
    out.push({ k: "method", pending: true, t: methodLabel + ": not yet out", href: at.method,
      title: by + " hasn’t posted this poll’s Australian Polling Council methodology statement yet. This opens the page where it files them." });
  if (p.url && !urlOwn) {
    const h = hostOf(p.url);
    const key = Object.keys(CITE_LABEL).find((d) => onHost(h, [d]));
    out.push({ k: "cite", t: key ? CITE_LABEL[key] : "Report (" + h + ")", href: p.url, title: "The published report this poll’s figures were read from" });
    if (REPORT_OVERVIEW.has(house)) out.push({ k: "overview", t: by + " landing-page overview", href: REPORT_OVERVIEW.get(house),
      title: "The publisher’s standing overview of this pollster’s coverage and latest reports" });
  }
  // the archived copy rides on the link it falls back for (§6a header)
  for (const l of out) waybackAnnotate(l);
  return out;
};

// the rows built before linksOf (SEC Newgate's and Essential's mood-only
// waves, Ipsos's issues waves, the confidence gauges' releases) carry
// `url` alone; they take the same list, or the views, which read only
// `links`, show them none
for (const p of [...directionOnlyPolls, ...issuesOnlyPolls, ...confidenceOnlyPolls])
  p.links = linksOf({ pollster: p.pollster, url: p.url, methodUrl: p.methodUrl, date: p.released });

/* tpp_split_on waves whose lnp is hand-derived, not extractor-read —
   exactly the one documented in polls.schema.json's tpp_split_on note
   (Jun 2026). Read by both per-poll emitters (as splitCoalEst) and by the
   forced-choice panel below (as est), so the one marks the other. */
const HAND_SPLIT_ON = new Set(["2026-06-26"]);
/* A projection's seats as the views list them: Labor, One Nation, the
   Coalition, the Greens and Others (`oth`). The MRP rows filed before the
   May–Jul 2026 model split Others into independents, Centre Alliance and
   KAP (`ind`/`ca`/`kap`), and the redesign's seat line and the CSV read
   `oth` alone, so those rows showed no Others at all. Folded here: a lone
   part keeps its range; several sum their central figures and changes
   (ranges don't add). */
const seatsOut = (s) => {
  if (!s?.p || s.p.oth) return s;
  const parts = ["ind", "ca", "kap"].filter((k) => s.p[k]);
  if (!parts.length) return s;
  const sumOf = (f) => (parts.every((k) => s.p[k][f] != null) ? parts.reduce((a, k) => a + s.p[k][f], 0) : null);
  const oth = parts.length === 1 ? { ...s.p[parts[0]] }
    : { ...(sumOf("est") != null ? { est: sumOf("est") } : {}), ...(sumOf("chg") != null ? { chg: sumOf("chg") } : {}) };
  return { ...s, p: { ...Object.fromEntries(Object.entries(s.p).filter(([k]) => !parts.includes(k))), oth } };
};

const individualPolls = POLLS.map((p) => {
  const ym = ymOf(p.date), day = dayOf(p.date);
  const fym = p.dateStart ? ymOf(p.dateStart) : null;
  const field = fwLabel(p.dateStart, p.date);
  return {
    ym, x: mx(ym) + (day - 15) / 365, day, pollster: p.pollster,
    /* Fieldwork's start month, when it spanned a boundary. Roy Morgan's
       first wave of the term closed 1 June but ran 5 May–1 Jun, and a span
       label read off the ym bucket loudly opened the archive in June while
       every row said its fieldwork began in May. Only carried when it
       differs from ym, so the byte cost lands only on straddling waves. */
    ...(fym != null && fym !== ym ? { fym } : {}),
    field, dateLabel: field, released: p.date, sample: p.sample ?? null,
    /* fieldwork not yet published (a DemosAU wave filed from the Capital
       Brief article before DemosAU's methodology PDF; a Resolve wave filed
       from the monitor csv before the SMH article carries its dates):
       `field` is the provisional window that places it on the charts and in
       the headline, and the views say "TBC" instead, linking
       `fieldUrl`, where the dates will be published — EXCEPT the masthead's
       phone compact line, which drops the word (its "today"-shortened form
       sheds TBC; the big-screen masthead keeps it — user call 2026-10-12).
       Leaves with the dates
       (extract-demosau.mjs; Resolve's hand-stamp on the SMH article). */
    ...(p.fieldworkPending ? { fieldPending: true, fieldUrl: fieldTbcUrl(p.pollster) } : {}),
    /* fieldwork mid-date ISO (see fmidIso) – the x basis every detail
       mini-chart draws the wave's own marker on; `released` is fieldwork's
       last day, so a marker at it sits right of the window it claims –
       plus midMs's exact midpoint in ms: an odd-length window's mid lands
       on a half-day and the estimator's day-clock arithmetic (lean
       neighbours, window edges) reads it off, so the client-side primary
       recompute (pv-agg.js) diverges by whole tenths if it only ever sees
       the truncated fmid date. A row with no dateStart needs neither:
       its mid IS its released day */
    ...(p.dateStart ? { fmid: fmidIso(p.dateStart, p.date), mid: midMs(p) } : {}),
    // the commissioning publisher, exactly as the Latest-polls table shows
    // it – "Self-published" where the wave reported under no client
    client: p.client && p.client !== "—" ? p.client : "Self-published",
    /* the house's own published effective n, where one was published in the
       house's APC methodology statement. Houses that publish none get no field at all
       and a "—" in the views; the estimator's derived weighting n is
       internal to rowN() and is never surfaced per-poll. */
    ...(p.sampleEff != null ? { sampleEff: p.sampleEff } : {}),
    // a no-aggregate wave: the row renders with its figures whole, but every
    // series, monthly point and house effect above was built WITHOUT it -
    // the detail view's "How it counts" rail says why (see NO_AGG_HOUSES)
    ...(noAggPoll(p) ? { noAgg: true, noAggWhy: noAggNoteFor(p) } : {}),
    /* the house-level exclusion apart from noAgg's row-level one: apprAgg
       and the 3PP aggregates skip NO_AGG_HOUSES only, so row-level out rows
       (a combined wave, an MRP) DO count there - the leadership charts draw
       their dots at that altitude */
    ...(NO_AGG_HOUSES.has(p.pollster) ? { noAggHouse: true } : {}),
    /* When the wave was PUBLISHED, where the cited release says so. The
       archive's row detail has always had a line labelled "Published" and has
       always filled it with `released`, which is the last day of FIELDWORK -
       the same substitution the Latest-polls column was corrected for. Carried
       whole, clock and all, so the view can print the hour beside the date and
       fall back honestly where no release recorded one. */
    ...(p.published ? { published: p.published } : {}),
    ...(undecidedOf(p) ? { undecided: undecidedOf(p).v, undecidedBasis: undecidedOf(p).basis } : {}),
    /* A separate per-poll display basis from undecidedOf: RedBridge's
       all-voters [solid, soft, verySoft] triple, or Spectre's two-way
       [firm, soft] pair. Never route these through the can't-say series. */
    ...(p.firmness && p.firmness.all ? { firmAll: p.firmness.all } : {}),
    ...(p.undecidedLeaner != null ? { undecidedLeaner: p.undecidedLeaner } : {}),
    ...(p.tpp_undecided ? { tppUndecided: p.tpp_undecided } : {}),
    // election-flows 2PP, ALP share (Roy Morgan; RedBridge/Accent since the
    // Aug 2026 wave) – absent, not zero, where no flows pair was published
    ...(p.tpp_flows != null ? { tppFlows: p.tpp_flows } : {}),
    // voting CONSIDERATION (multi-select "which parties would you consider
    // voting for" shares; YouGov News24/serious waves, Essential's
    // consideration module, YouGov (MRP)'s Climate Council and Blueprint
    // Institute waves, and RedBridge/Accent's April 2026 0–10 propensity
    // battery filed as four tiers – the canonical map plus the looser/
    // not/never triple) – absent where a wave asked no consideration
    // question; display-only
    ...(p.consideration ? { cons: p.consideration, consBasis: p.consBasis,
      ...(p.considerationLoose ? { consLoose: p.considerationLoose } : {}),
      ...(p.considerationNot ? { consNot: p.considerationNot } : {}),
      ...(p.considerationNever ? { consNever: p.considerationNever } : {}) } : {}),
    /* RedBridge/Accent's cohort forced-choice figures (absent-not-zero):
       the Labor share when Coalition voters are pressed into Labor-v-One
       Nation (tpp_split_on.lnp) and when One Nation voters are pressed
       Labor-v-the Coalition (tpp_split.onp), plus the Greens/other
       cohorts on both questions – the Coalition/One Nation pair are the
       same fields the respondent-allocated-preferences panel charts; the
       archive detail lists them all in after-preferences, and
       Jun 2026's press-only Coalition figure carries splitCoalEst. */
    ...(p.tpp_split_on && p.tpp_split_on.lnp != null
      ? { splitCoal: p.tpp_split_on.lnp, ...(HAND_SPLIT_ON.has(p.date) ? { splitCoalEst: true } : {}) }
      : {}),
    ...(p.tpp_split && p.tpp_split.onp != null ? { splitOnp: p.tpp_split.onp } : {}),
    ...(p.tpp_split && p.tpp_split.grn != null ? { splitGrn: p.tpp_split.grn } : {}),
    ...(p.tpp_split_on && p.tpp_split_on.grn != null ? { splitGrnOn: p.tpp_split_on.grn } : {}),
    ...(p.tpp_split && p.tpp_split.oth != null ? { splitOth: p.tpp_split.oth } : {}),
    ...(p.tpp_split_on && p.tpp_split_on.oth != null ? { splitOthOn: p.tpp_split_on.oth } : {}),
    // this poll's pull on the standing aggregates (leave-one-out, §3b) –
    // absent where the wave sits in none of the three series
    ...(effByKey.has(p.date + "|" + p.pollster) ? { eff: effByKey.get(p.date + "|" + p.pollster) } : {}),
    // the polls around this one, each series it has a figure on (§3c),
    // and its leader gaps against the waves around it (§4c)
    ...(ydOf(p) ? { yd: ydOf(p) } : {}),
    // the same per party, on its printed primaries (§3c)
    ...(pydOf(p) ? { pyd: pydOf(p) } : {}),
    ...(ldYard.at.has(p.date + "|" + p.pollster) ? { ldYd: ldYard.at.get(p.date + "|" + p.pollster) } : {}),
    alp: p.tpp_alp ?? null, lnp: p.tpp_lnp ?? null, alpN: alpNOf(p),
    // this wave's implied 2PP (its own primaries at the 2025 flow table) –
    // emitted under impShow's display rule: documented sum anomalies show
    // rebased to 100, an UNDOCUMENTED sum failure withholds the figure so
    // the table's "primaries don't add to 100" tripwire stays lit;
    // alpOnImp is the same re-read under the ALP-v-ON frozen table (flows.mjs FP_ON)
    ...impFields(p),
    p: primaryOf(p), ...buildAlt(p.date, p.pollster), ...build3cp(p), ...buildPpm(p.date, p.pollster),
    // the pooled shares, where they differ from the printed ones (poolPrim):
    // pv-agg's in-browser recompute must read exactly what the server pooled
    ...(p.pubPrim ? { pp: { alp: p.alp, lnp: p.lnp, grn: p.grn, onp: p.onp, oth: (p.ind == null && p.oth == null) ? null : (p.ind ?? 0) + (p.oth ?? 0) } } : {}),
    /* what the printed primaries are of, for the source-polls download and
       the poll detail: undIn = the printed undecided share a house keeps in
       its base (the shares shown add to 100 with it); sumNote = the wave's
       own documented reason its shares don't add to 100 */
    ...(p.undecidedIn != null ? { undIn: p.undecidedIn } : {}),
    ...(p.sumNote ? { sumNote: p.sumNote } : {}),
    appr: buildAppr(p.date, p.pollster), chg: chgByKey[p.date + "|" + p.pollster],
    ...(JUR ? { who: whoAt(p.date) } : {}),
    // link back to the published release/report this row came from (the
    // citation Wikipedia carries for it). Omitted where no source is cited,
    // so the views can fall back to plain text.
    ...(p.url ? { url: p.url } : {}),
    // the pollster's own release page, when it isn't what `url` cites – the
    // expanded poll links it as "Pollster's release" (RedBridge/Accent waves,
    // whose citation is the AFR write-up; Capital Brief-commissioned DemosAU
    // waves, where `url` is the Capital Brief piece and the release is the
    // statement-bearing report PDF)
    ...(p.releaseUrl ? { releaseUrl: p.releaseUrl } : {}),
    // plus the house's rolling collection page alongside the dated release
    // (releaseHub in pollsterRules – Essential's Federal Political Insights),
    // so both addresses ride under the one pointer
    ...(p.releaseUrl && RELEASE_HUB.has(p.pollster) ? { releaseHub: RELEASE_HUB.get(p.pollster) } : {}),
    // the wave's APC methodology statement (YouGov/Newspoll only)
    ...(p.methodUrl ? { methodUrl: p.methodUrl } : {}),
    // the links the redesign's opened poll shows, each named for its source (§6a)
    links: linksOf(p),
    /* a PROVISIONAL row: filed from Poll Bludger's poll-data feed by the
       fallback agent because the house's own extractor had not landed the
       wave (see mergedPolls above). The view names the source and says the
       figures are second-hand; the row leaves when the real one arrives. */
    ...(p.provisional ? { provisional: p.provisional.source || "Poll Bludger" }
      : PROVISIONAL_APPR.has(p.date + "|" + p.pollster)
        ? { provisional: "Poll Bludger", provisionalScope: "leaders", provisionalUrl: "https://www.pollbludger.net/fed2028/bludgertrack/polldata.htm" } : {}),
    // right-track / wrong-track, where this poll asked it
    ...(DIR_BY.has(p.date + "|" + p.pollster) ? { dir: DIR_BY.get(p.date + "|" + p.pollster) } : {}),
    // this wave's issue salience / best-party figures, where it asked them
    ...(ISS_BY.has(p.date + "|" + p.pollster) ? { iss: ISS_BY.get(p.date + "|" + p.pollster) } : {}),
    // seat projections – MRPs only. Carried verbatim; their change basis is the
    // last ELECTION, not the pollster's previous poll, so it travels with the
    // data rather than being inferred by the views.
    ...(p.seats ? { seats: seatsOut(p.seats) } : {}),
    // the vote by group and the vote-switching rates, for the CSV export
    ...(DEMO_BY_POLL.has(p.date + "|" + p.pollster) ? { grp: DEMO_BY_POLL.get(p.date + "|" + p.pollster) } : {}),
    // single-territory readings for the ACT/NT/Tas view (§5c; display-only)
    ...(SOLO_BY_POLL.has(p.date + "|" + p.pollster) ? { solo: SOLO_BY_POLL.get(p.date + "|" + p.pollster) } : {}),
    ...(VS_BY_POLL.has(p.date + "|" + p.pollster) ? { sw: VS_BY_POLL.get(p.date + "|" + p.pollster) } : {}),
    // DemosAU MRP's printed preference flows by region (polls.json pref_flows;
    // display-only: the opened poll's Preferences line cycles its regions)
    ...(p.pref_flows ? { pf: prefFlowsOut(p) } : {}),
  };
}).sort((a, b) => a.x - b.x || a.released.localeCompare(b.released));

/* ---- 6b. external aggregates — the comparator lines the hero can draw ----
   Two other public 2PP aggregates cover this term, and a reader who lands on
   the front page reasonably asks "what do they say?" – so the hero can
   overlay both, each drawn from the figures its author published.
   BludgerTrack's arrives machine-ready: the dated outliers-excluded trend
   values its own page draws as the trend line and prints as its headline
   2PP (ALP2out, fixed from ALP2in 2026-10-02,
   .matilda/bt-line-accuracy-2026-10.md), mirrored to
   data/bludgertrack-2pp.json by .build/extract-bludgertrack.mjs. Kevin
   Bonham publishes only his CURRENT figures, in his blog's sidebar, but every
   page of the blog carries them, so the archive's captures of the whole site
   recover his record (.build/bonham-wayback-backfill.mjs) and the sidebar
   scraper grows it forward (.build/extract-bonham-sidebar.mjs), both into
   data/bonham-2pp.json.
   Until 2026-10-05 his Coalition line was instead a rebuild of his method
   over our polls (.build/newtracker/bonham-replica.mjs), sampled on the 15th
   of each month. Against 104 of his published figures it ran a mean 0.44
   high and swung harder than he did, so the chart showed him half a point
   kinder to Labor than BludgerTrack, where his own figures sit level with
   it, and zig-zagged from February to May 2026
   (.matilda/outside-estimates-review-2026-10-05.md). The rebuild stays as a
   check: .build/check-bonham-replica.mjs, and the line gen-data logs below
   when run on its own.
   Both are ALP's share of a two-party contest, exactly the lines the hero
   itself draws; the view adds the credit
   and the links. */
const readDataJson = (name) => {
  if (JUR) return null;   // federal side data – absent for another jurisdiction
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, "data", name), "utf8")); }
  catch { return null; }
};
const BTRACK = readDataJson("bludgertrack-2pp.json");
const KBONHAM = readDataJson("bonham-2pp.json");
const xOfIso = (iso) => mx(ymOf(iso)) + (dayOf(iso) - 15) / 365;   // the individualPolls day convention
/* BludgerTrack arrives as the same ~weekly-keyed trend lattice his own page
   draws (ALP2out since 2026-10-02 — before that the extractor mirrored
   ALP2in, his per-release dot series, which rendered as jitter, user
   2026-10-02: "way too bumpy"). The month-anchor lattice it is sampled to
   below tracks the genuine smooth trend within 0.03/0.17pts (mean/max over
   the term); sampling kept for lattice-consistency with every other line
   here — linear interpolation to each mid-month anchor, plus one live tail
   vertex. 2out back-casts (old values drift as polls land), so the mirror
   refreshes on schedule via pollbludger-updater.sh. */
const btMidMonth = (ym) => {
  const t = Date.parse(ym + "-15T00:00:00Z");
  let prev = null, next = null;
  for (const [iso, alp] of BTRACK.series) {
    const at = Date.parse(iso + "T00:00:00Z");
    if (at <= t) prev = [at, alp]; else if (!next) { next = [at, alp]; break; }
  }
  if (!prev || !next) return null;                 // never extrapolate
  if (next[0] === t) return next[1];
  const w = (t - prev[0]) / (next[0] - prev[0]);
  return prev[1] + w * (next[1] - prev[1]);
};
/* Bonham's figures are a daily index he updates every few days, so the
   figure on show on any day is his latest stamp. His lines are drawn as ours
   is: each complete calendar month's average of the figure on show each
   day, at mid-month. A one-day reading per month aliased his three-to-
   four-week poll cycle into a zig-zag (eight changes of direction in ten
   months; six for monthly averages, his own rhythm). Each line starts at
   his first figure (the aggregate's launch, the shadow's introduction) and
   ends on his current one, the figure the hero's key quotes. A month
   counts as complete once the data (the newest poll's release or his
   newest stamp) has reached its last day: data dates, never the wall
   clock, as everywhere else here. */
const KB_ASOF = [LATEST_PUB_ISO, KBONHAM?.series?.at(-1)?.[0], KBONHAM?.shadow?.at(-1)?.[0]]
  .filter(Boolean).sort().at(-1);
function publishedMonthly(rows) {
  const DAY = 86400000;
  const sums = new Map();                          // ym -> [sum, days]
  let k = 0, cur = null;
  for (let t = Date.parse(rows[0][0] + "T00:00:00Z"), end = Date.parse(KB_ASOF + "T00:00:00Z"); t <= end; t += DAY) {
    const iso = new Date(t).toISOString().slice(0, 10);
    while (k < rows.length && rows[k][0] <= iso) cur = rows[k++][1];
    const s = sums.get(ymOf(iso)) || [0, 0];
    s[0] += cur; s[1] += 1;
    sums.set(ymOf(iso), s);
  }
  const pts = [{ x: xOfIso(rows[0][0]), y: rows[0][1] }];
  for (const [ym, [sum, n]] of sums) {
    const [y, m] = ym.split("-").map(Number);
    if (n < new Date(Date.UTC(y, m, 0)).getUTCDate()) continue;   // the first month, or one still running
    pts.push({ x: mx(ym), y: r2(sum / n) });
  }
  const [lastIso, lastAlp] = rows[rows.length - 1];
  if (xOfIso(lastIso) > pts[pts.length - 1].x + 0.002) pts.push({ x: xOfIso(lastIso), y: lastAlp });
  return pts;
}
const extAgg = {
  bt: BTRACK && BTRACK.series?.length
    ? {
        points: (() => {
          const pts = MONTHS.map((ym) => {
            const y = btMidMonth(ym);
            return y == null ? null : { x: mx(ym), y };
          }).filter(Boolean);
          const [iso, alp] = BTRACK.series[BTRACK.series.length - 1];
          const tx = xOfIso(iso);
          if (!pts.length || tx > pts[pts.length - 1].x + 0.002) pts.push({ x: tx, y: alp });
          return pts;
        })(),
        feed: "www.pollbludger.net/fed2028/bludgertrack",
      }
    : null,
  bonham: KBONHAM && KBONHAM.series?.length
    ? {
        line: publishedMonthly(KBONHAM.series),
        /* his One Nation shadow-2PP: primary-derived off his own
           2025-preference estimates and pooled as the latest ten polls
           (≤2 a house), so no comparability claim with our frozen-flow
           implied line; the hero draws it only on the Labor v One Nation
           contest */
        shadow: KBONHAM.shadow?.length ? publishedMonthly(KBONHAM.shadow) : null,
        /* ?m=0 pins Blogspot's desktop template so the link opens his
           sidebar (where the figure lives) even on a phone */
        site: "kevinbonham.blogspot.com/?m=0",
      }
    : null,
};
/* the rebuild of his method, kept as a check on his figures: its reading
   on the day of his newest stamp, beside the stamp */
if (KBONHAM?.series?.length) {
  const [kbIso, kbAlp] = KBONHAM.series[KBONHAM.series.length - 1];
  const reb = bonhamReplica(POLLS, kbIso).daily.at(-1);
  console.log("bonham: as published", kbAlp, "on", kbIso, "| his method rebuilt over our polls", reb ? reb.sm : null,
    "|", KBONHAM.series.length, "stamps,", KBONHAM.shadow?.length || 0, "shadow change points");
}

/* ---- 7. latest polls – the most recent reading from each ACTIVE house ----
   This was a flat three-week window, which is a rule about weekly houses. It
   silently dropped every monthly one, so it became adaptive: half again the
   house's OWN median interval. That fixed the monthly houses and granted the
   irregular ones unbounded courtesy - Spectre Strategy polled every three to
   five months and so earned a seven-MONTH stay on a table headed "the most
   recent poll from each active pollster".

   Now a flat seven weeks. Every regularly publishing house polls inside six
   (the slowest observed non-hiatus gap was DemosAU, 53 days), so the window
   covers one missed wave for any of them and drops a house that has actually
   stopped, whatever its history says. Silence is measured against the dataset
   clock - LATEST_ISO, not the wall clock - so a universal pause (everyone
   stops over Christmas) doesn't count against any house. The projections
   panel answers a different question with a different rule: a house's slot
   there holds, overdue, until its release is recorded, so only a hand-
   declared stop (pollsterRules.stopped) takes one off it. */
const LATEST_WINDOW_DAYS = 49;
const canon = (n) => n.replace(/\s*\(.*?\)\s*/g, "").replace(/\s*\/\s*Accent.*$/i, "").trim();
const latestMs = Date.parse(LATEST_ISO);
/* a NO_AGG release never takes the "latest" seat: the seat answers "each
   house's newest current reading", and a ten-week pooled average (or an SMS
   one-off) is not one. canon() otherwise lets a quarterly pool steal its
   parent house's seat whenever its window END is the freshest date in the
   house — Newspoll's 18 Sep quarter sat over its 17 Sep wave — while the
   projection's fallback put the parent back as a SECOND row, so the table
   carried the house twice. Their waves display in the archive instead.
   One exception (user call 2026-10-12): a house's MRP takes a row of its
   OWN, beside the house's regular poll rather than in its seat. A model
   taken to reuse the house's waves (reusesWaves) is outside the aggregates,
   but it is a new release with a new seat projection, and the masthead
   names it when it is the newest; a pooled re-cut of waves already in the
   table is neither. Its row carries the outside-the-aggregates note. */
const isMrp = (p) => /\(MRP\)$/.test(p.pollster || "");
const recent = POLLS.filter((p) => (!noAggPoll(p) || (isMrp(p) && reusesWaves(p) && p.noAgg == null && !NO_AGG_HOUSES.has(p.pollster)))
  && (latestMs - Date.parse(p.date)) / 86400000 <= LATEST_WINDOW_DAYS);
const perHouse = new Map();
for (const p of recent.sort((a, b) => a.date.localeCompare(b.date))) perHouse.set(isMrp(p) ? p.pollster : canon(p.pollster), p);
const pollsterTable = [...perHouse.values()].map((p) => {
  const m = Number(p.date.slice(5, 7)), day = dayOf(p.date);
  return {
    pollster: p.pollster, client: p.client && p.client !== "—" ? p.client : "Self-published",
    field: fwLabel(p.dateStart, p.date), released: p.date, releasedLabel: `${day} ${monthName(m)}`,
    // fieldwork not yet published: the views say TBC (see individualPolls)
    ...(p.fieldworkPending ? { fieldPending: true, fieldUrl: fieldTbcUrl(p.pollster) } : {}),
    /* When the poll was PUBLISHED, where the cited source says so. `released`
       above is the last day of fieldwork, which is not the same thing and is
       what the "Published" column had been showing for want of anything else.
       `pubSort` is what that column sorts on, so the ordering means the same
       thing the heading does. */
    ...(p.published ? {
      published: p.published,
      publishedLabel: `${dayOf(p.published)} ${monthName(Number(p.published.slice(5, 7)))}`,
    } : {}),
    pubSort: p.published || p.date,
    sample: p.sample ?? null,
    ...(p.sampleEff != null ? { sampleEff: p.sampleEff } : {}),
    ...(undecidedOf(p) ? { undecided: undecidedOf(p).v, undecidedBasis: undecidedOf(p).basis } : {}),
    // vote-firmness pair/triple, same as the archive emitter
    ...(p.firmness && p.firmness.all ? { firmAll: p.firmness.all } : {}),
    ...(p.undecidedLeaner != null ? { undecidedLeaner: p.undecidedLeaner } : {}),
    ...(p.tpp_undecided ? { tppUndecided: p.tpp_undecided } : {}),
    ...(p.tpp_flows != null ? { tppFlows: p.tpp_flows } : {}),
    // voting consideration, same as the archive emitter above
    ...(p.consideration ? { cons: p.consideration, consBasis: p.consBasis,
      ...(p.considerationLoose ? { consLoose: p.considerationLoose } : {}),
      ...(p.considerationNot ? { consNot: p.considerationNot } : {}),
      ...(p.considerationNever ? { consNever: p.considerationNever } : {}) } : {}),
    // RedBridge/Accent's cohort forced-choice figures, same as the archive
    // emitter above (Latest-detail opens read this row set)
    ...(p.tpp_split_on && p.tpp_split_on.lnp != null
      ? { splitCoal: p.tpp_split_on.lnp, ...(HAND_SPLIT_ON.has(p.date) ? { splitCoalEst: true } : {}) }
      : {}),
    ...(p.tpp_split && p.tpp_split.onp != null ? { splitOnp: p.tpp_split.onp } : {}),
    ...(p.tpp_split && p.tpp_split.grn != null ? { splitGrn: p.tpp_split.grn } : {}),
    ...(p.tpp_split_on && p.tpp_split_on.grn != null ? { splitGrnOn: p.tpp_split_on.grn } : {}),
    ...(p.tpp_split && p.tpp_split.oth != null ? { splitOth: p.tpp_split.oth } : {}),
    ...(p.tpp_split_on && p.tpp_split_on.oth != null ? { splitOthOn: p.tpp_split_on.oth } : {}),
    // this poll's own primaries implied at the fixed 2025 flows (same
    // impShow display rule as the archive emitter above) – the implied
    // line's default basis
    ...impFields(p),
    // this poll's pull on the standing aggregates (leave-one-out, §3b) –
    // absent where the wave sits in none of the three series
    ...(effByKey.has(p.date + "|" + p.pollster) ? { eff: effByKey.get(p.date + "|" + p.pollster) } : {}),
    // same no-aggregate flag as the archive emitter (see NO_AGG_HOUSES), so a
    // no-agg wave that ever lands in the Latest window carries the note too
    ...(noAggPoll(p) ? { noAgg: true, noAggWhy: noAggNoteFor(p) } : {}),
    alp2pp: p.tpp_alp ?? null, lnp2pp: p.tpp_lnp ?? null,
    p: primaryOf(p), ...buildAlt(p.date, p.pollster), ...build3cp(p), ...buildPpm(p.date, p.pollster),
    // the pooled shares, where they differ from the printed ones (poolPrim):
    // pv-agg's in-browser recompute must read exactly what the server pooled
    ...(p.pubPrim ? { pp: { alp: p.alp, lnp: p.lnp, grn: p.grn, onp: p.onp, oth: (p.ind == null && p.oth == null) ? null : (p.ind ?? 0) + (p.oth ?? 0) } } : {}),
    appr: buildAppr(p.date, p.pollster), chg: chgByKey[p.date + "|" + p.pollster],
    ...(JUR ? { who: whoAt(p.date) } : {}),
    ...(p.url ? { url: p.url } : {}),
    // the pollster's own release page when `url` cites something else (same
    // rule as the archive emitter above — RedBridge/Accent AFR citations,
    // Capital Brief-commissioned DemosAU waves)
    ...(p.releaseUrl ? { releaseUrl: p.releaseUrl } : {}),
    // plus the rolling collection page where pollsterRules ships a releaseHub,
    // so both addresses ride under the one pointer (archive emitter above)
    ...(p.releaseUrl && RELEASE_HUB.has(p.pollster) ? { releaseHub: RELEASE_HUB.get(p.pollster) } : {}),
    // APC methodology statement link (YouGov/Newspoll only)
    ...(p.methodUrl ? { methodUrl: p.methodUrl } : {}),
    // the same named links as the archive emitter (§6a)
    links: linksOf(p),
    ...(DIR_BY.has(p.date + "|" + p.pollster) ? { dir: DIR_BY.get(p.date + "|" + p.pollster) } : {}),
    ...(ISS_BY.has(p.date + "|" + p.pollster) ? { iss: ISS_BY.get(p.date + "|" + p.pollster) } : {}),
    // a modelled chamber travels with the poll here too, not only into the
    // archive – a projection published this week belongs in Latest polls
    ...(p.seats ? { seats: seatsOut(p.seats) } : {}),
  };
}).sort((a, b) => b.released.localeCompare(a.released));

/* Leadership's Latest card may come from a report that measured no VI. It
   replaces only that measure's row; primaries and 2PP keep the latest vote
   release rather than showing a dash-only card against a newer date. */
const hasLeadReading = (p) => ["albNet", "taylorNet", "hansonNet"].some((k) => p.appr?.[k] != null) || !!p.ppm || !!p.ppmSets;
const latestAuxLead = new Map();
for (const p of directionOnlyPolls) {
  if (!hasLeadReading(p) || (latestMs - Date.parse(p.released)) / 86400000 > LATEST_WINDOW_DAYS) continue;
  const house = canon(p.pollster), prev = latestAuxLead.get(house);
  if (!prev || prev.released < p.released) latestAuxLead.set(house, p);
}
for (const p of pollsterTable) {
  const q = latestAuxLead.get(canon(p.pollster));
  if (!q || q.released < p.released) continue;
  const date = new Date(q.released + "T00:00:00Z"), day = date.getUTCDate();
  p.leadershipLatest = {
    pollster: q.pollster, client: q.client, field: q.field, released: q.released,
    releasedLabel: `${day} ${monthName(date.getUTCMonth() + 1)}`,
    published: q.published, pubSort: q.published || q.released,
    ...(q.published ? { publishedLabel: `${dayOf(q.published)} ${monthName(Number(q.published.slice(5, 7)))}` } : {}),
    sample: q.sample ?? null, p: {}, appr: q.appr,
    ...(q.ppm ? { ppm: q.ppm } : {}), ...(q.ppmSets ? { ppmSets: q.ppmSets } : {}),
    ...(q.dir ? { dir: q.dir } : {}), ...(q.url ? { url: q.url } : {}),
    ...(q.methodUrl ? { methodUrl: q.methodUrl } : {}), links: q.links || [], chg: null,
  };
}

/* ---- 7b. headline 2PP – trailing 21d, 7d half-life, debiased ----------- */
const headlineTpp = (ref) => {
  const r = nowcastAdj(tppRows, houseEffect, ref);
  return r ? { alp: r.v, n: r.n, se: r.se, nEff: r.nEff, ci95: r.ci95 } : null;
};
/* federal (§2t): the model's, with its interval and its own change test */
const tpmNow = (m, n) => m && tppNowOut(m, n);
const tpmChg = (m) => (m ? tppChgOut(m) : {});
const hlNow = (KF ? kfNow(KF_NOW.tpp) : TPM && TPM.pub ? tpmNow(TPM.pub, TPM.pub.n) : headlineTpp(refNow)) || { alp: agg2pp[agg2pp.length - 1].alp, n: 0 };
const hl1mo = KF ? (KF_NOW.tpp && KF_NOW.tpp.change ? { alp: r1(KF_NOW.tpp.change.prev) } : null) : TPM && TPM.pub ? { alp: r1(TPM.pub.prev.v) } : headlineTpp(refNow - 30 * 86400000);

/* The synthetic series' nowcast, on the identical window/half-life/house-
   effect machinery as the headline. Kept next to it in the payload so the
   comparison the diagnostic makes (published vs flow-table-implied) is two
   numbers estimated the same way at the same instant – the only thing that
   differs is WHAT the rows measure. No fallback synthesis: if the window is
   empty the diagnostic has nothing to say this week. */
const synthHeadline = (ref) => {
  const r = nowcastAdj(tppRowsSynth, synthEffect, ref);
  return r ? { alp: r.v, n: r.n, se: r.se, nEff: r.nEff, ci95: r.ci95 } : null;
};
const synthNow = KF ? kfNow(KF_NOW.imp) : TPM ? tpmNow(TPM.imp, tppLin.n) : synthHeadline(refNow);
const synth1mo = KF ? (KF_NOW.imp && KF_NOW.imp.change ? { alp: r1(KF_NOW.imp.change.prev) } : null) : TPM ? { alp: r1(TPM.imp.prev.v) } : synthHeadline(refNow - 30 * 86400000);
/* The implied headline's month-on-month significance, on the same RSS rule
   the published headline uses (two independent 21d windows). Emitted beside
   synthLatest so the hero's "within the margin" caveat reads the implied
   basis it displays. */
const synthChg = KF ? kfChgOf(KF_NOW.imp) : TPM ? tpmChg(TPM.imp) : (synthNow && synth1mo && synthNow.se != null && synth1mo.se != null)
  ? (() => {
      const seChg = Math.sqrt(synthNow.se ** 2 + synth1mo.se ** 2);
      return { changeSe: r1(seChg), changeCi95: r1(1.96 * seChg), changeSig: Math.abs(synthNow.alp - synth1mo.alp) > 1.96 * seChg };
    })()
  : {};

/* ---- 7c. flow-drift residual tracker -------------------------------------
   How far published 2PPs are running from what the SAME polls' primaries
   would imply under the flow table (flows.mjs). Both row sets already exist
   keyed date|pollster, so the residual is a join, not a new estimator. A
   house's residual carries a fixed method offset (its allocation basis;
   Essential's undecided-inclusive pair was already rebased inside share2pp,
   so what remains is its own convention), so drift is identified only from
   CHANGE WITHIN a house: subtract the firm's own election-anchored
   baseline, then pool the anomalies across houses through the standing
   monthly/nowcast machinery with NULL house effects – the firm baselines
   ARE the debias. If the table's flows still held and methods were stable
   the series sits at zero; movement reads as industry-wide drift. It is a
   diagnostic and adjusts no other figure on the page, and only houses that
   publish a 2PP can appear: a wave that prints none (much of Newspoll's
   and Resolve's output) carries no residual either way. Each residual row
   carries the published pair's OWN sampling variance (pq from the rebased
   share) as its floor term – a share scale does not transfer to a
   difference series, whose mean can sit at zero and leave p(1−p) negative
   if it were measured off the anomaly mean. */
const FLOW_BASE_DAYS = 180;   // baseline anchor window after the election
const FLOW_BASE_MIN = 3;      // min residuals to locate a house's baseline
/* The published pair's own percent of preferences flowing to Labor,
   recovered per wave from the primary votes the wave also filed:
   (published ALP share − ALP primary) over the non-major share. The
   published side is the house's allocation as filed (respondent-allocated
   basis – share2pp has already rebased undecided-inclusive pairs to 100
   before this point, so no rebase is needed here either). Carried into the
   drift chart's hover tips so a reader can see WHERE preferences went, not
   only that the pair wandered (user request 2026-10-05); the same helper
   serves the ALP-v-ON pairing with onp as the other primary. */
const flowToAlp = (pairA, own, other) => {
  const prefs = 100 - own - other;
  return prefs > 0.5 ? ((pairA - own) / prefs) * 100 : null;
};
const driftSynthByKey = new Map(tppRowsSynth.map((r) => [r.key, r.x]));
const driftResid = [];
for (const r of tppRows) {
  const imp = driftSynthByKey.get(r.key);
  if (imp == null) continue;
  const p = POLL_BY_KEY.get(r.key);
  const fl = p && p.alp != null && p.lnp != null ? flowToAlp(r.x, p.alp, p.lnp) : null;
  driftResid.push({ ...r, pq: (r.x / 100) * (1 - r.x / 100) * 1e4, x: r.x - imp, fl });
}
const driftByFirm = new Map();
for (const r of driftResid) {
  if (!driftByFirm.has(r.firm)) driftByFirm.set(r.firm, []);
  driftByFirm.get(r.firm).push(r);
}
/* A firm's method offset is read at the election – the one moment the
   electorate's actual flows are known. A house whose coverage starts late
   (Fox & Hedgehog began Jan 2026) has no window to read, so it anchors on
   its own first waves and its series can only speak about drift SINCE it
   started; meta.baseFrom says which anchor each firm got. */
const FLOW_BASE_FROM = {};
{
  const elecMs = new Date(ELECTION.date).getTime();
  for (const [firm, rows] of driftByFirm) {
    rows.sort((a, b) => a.mid - b.mid);
    const win = rows.filter((r) => ddays(r.mid, elecMs) >= 0 && ddays(r.mid, elecMs) <= FLOW_BASE_DAYS);
    const anchored = win.length >= FLOW_BASE_MIN;
    const src = anchored ? win : rows.slice(0, FLOW_BASE_MIN);
    if (src.length < FLOW_BASE_MIN) continue;
    FLOW_BASE_FROM[firm] = {
      base: src.reduce((s, r) => s + r.n * r.x, 0) / src.reduce((s, r) => s + r.n, 0),
      from: anchored ? ELECTION.date : src[src.length - 1].key.split("|")[0],
    };
  }
}
const driftAnom = driftResid
  .filter((r) => FLOW_BASE_FROM[r.firm])
  .map((r) => ({ ym: r.ym, mid: r.mid, x: r.x - FLOW_BASE_FROM[r.firm].base, n: r.n, pq: r.pq, firm: r.firm, key: r.key,
                 fl: r.fl ?? null }));
/* The per-house implied-flow fit is deleted (2026-09-19). It asked whether
   each house's allocation could be recovered from its own published 2PP and
   primary swings, and the numbers answered no: the ridge's own standard
   errors ran +/-4 to +/-9.5 on shares whose whole range of interest is
   perhaps fifteen points, and tested against the election row exactly two of
   fifteen fitted cells cleared 1.96*se -- both Roy Morgan's. On the
   Labor-v-One-Nation pairing not one of six cleared it. The flows are not
   derivable at this signal-to-noise, so the table that presented them as if
   they were is gone, and so is the machinery behind it.

   The drift diagnostic this section still emits is untouched, and is the part
   that always worked: it measures each house's published-minus-implied gap
   against that house's OWN baseline, which needs no per-bucket split and
   carries no such error. What is gone is only the attempt to say which bucket
   a house's gap came from. Recoverable from git if enough houses ever publish
   enough waves to make the fit identifiable.
 */
const driftMonths = MONTHS.map((ym) => {
  const r = monthWithSe(driftAnom, null, ym);
  return r && { ym, x: mx(ym), v: r1(r.v), ci95: r1(1.96 * r.se), k: r.n };
}).filter(Boolean);
const driftNow = nowcastAdj(driftAnom, null, refNow);
const flowDrift = {
  months: driftMonths,
  now: driftNow && { v: driftNow.v, ci95: driftNow.ci95, n: driftNow.n, nEff: driftNow.nEff },
  /* per-house anomaly series for the faint background lines – same ragged
     {ym, v} shape houseLean carries, plain n-weighted monthly means;
     fl is the same n-weighted mean of the respondent flow to Labor over the
     waves that carry one */
  houses: Object.fromEntries(Object.keys(FLOW_BASE_FROM).sort().map((f) => [f,
    MONTHS.map((ym) => {
      const rs = driftAnom.filter((r) => r.firm === f && r.ym === ym);
      if (!rs.length) return null;
      const w = rs.reduce((s, r) => s + r.n, 0);
      const fs = rs.filter((r) => r.fl != null), fw = fs.reduce((s, r) => s + r.n, 0);
      return { ym, v: r1(rs.reduce((s, r) => s + r.n * r.x, 0) / w),
               ...(fs.length ? { fl: r1(fs.reduce((s, r) => s + r.n * r.fl, 0) / fw) } : {}) };
    }).filter(Boolean),
  ])),
  meta: {
    table: FLOW_TABLE,
    baseDays: FLOW_BASE_DAYS,
    anchor: ELECTION.date,
    baseFrom: Object.fromEntries(Object.entries(FLOW_BASE_FROM).map(([f, b]) => [f, b.from])),
    houses: Object.keys(FLOW_BASE_FROM).sort(),
  },
  /* one dot per published wave, so the drift chart's poll cloud can report a
     wave's own gap on hover like every other chart's – the anomaly the
     houses' lines average, in the scatter shape the other poll clouds carry.
     Display-only: the estimator inputs are driftAnom above. */
  polls: driftAnom.map((r) => {
    const p = POLL_BY_KEY.get(r.key);
    return p && { x: dx(p.date), v: r1(r.x), pollster: r.firm,
                  dateLabel: fwLabel(p.dateStart, p.date), released: p.date,
                  sample: p.sample ?? null,
                  ...(r.fl != null ? { fl: r1(r.fl) } : {}) };
  }).filter(Boolean).sort((a, b) => a.x - b.x || a.pollster.localeCompare(b.pollster)),
};

/* ---- 7d. flow-drift, Labor-vs-One-Nation pairing --------------------------
   The §7c diagnostic re-run on the ALP-v-ON head-to-head totals instead of
   the classic 2PP. Same estimator end to end — published-vs-implied
   residuals rebased to each house's own baseline, pooled with NULL house
   effects — with two differences forced by the data:

   1. The published total is an altTpp row (alpVsOnp_alp, already an ALP
      share of the pairing), joined date|firm to the poll row for its
      primaries. The implied side reads those primaries through a frozen
      flow table for THIS pairing:
          implied = alp + lnp·f_lnp + grn·f_grn + (ind+oth)·f_oth
      — and no election count of an ALP-v-ON pairing exists, so the frozen
      table cannot be election-anchored like §7c's. It is BUILT: the 2025
      Senate ballots' ranking of Labor against One Nation, read through the
      lower-house counts of that pairing, each set beside the Senate ballots
      of the same places (Hunter 2025, SA 2026, Secret Harbour 2026,
      Queensland 2017/2020). Cells and provenance live with FP_ON in
      flows.mjs: 27 / 91 / 55 to Labor, ± 4 / 2.5 / 4 (Coalition cell
      revised 2026-11-03 from 30 ± 3; 2026-10-11 from 31.5 / 89 / 53,
      ± 2.5 / 3 / 3; the Coalition cell came down from 72% to One Nation on
      2026-09-11).
      This is the
      table the page QUOTES the pairing on (§7f), and it was chosen over
      RedBridge/Accent's respondent-allocated splits (tpp_split_on — the
      only published per-cohort allocation of the pairing, kept below as
      the panel's measured RedBridge row) because revealed ballots beat a
      stated allocation with no count to anchor, and respondents answer
      without the how-to-vote card that close to half of Coalition voters
      copy; the
      published head-to-heads themselves stay the corroboration this panel
      monitors. meta.anchor says null and the copy says so. (The drift
      series is baseline-subtracted per house anyway, so a level offset in
      the table costs nothing; only a table whose cohort mixes drift from
      the industry's would.)

   2. No house's residual can be read at the election (no pairing totals
      are published this soon after it in-sample either — the earliest
      ALP-v-ON row is eight months in), so every firm anchors on its own
      first FLOW_ON_BASE_MIN residuals and meta.baseFrom records which date
      each series can speak from. */
/* Constants for the block above: the frozen table (FP_ON, FP_ON_BAND) lives
   in flows.mjs and impliedOn() is hoisted to §0 beside impOk – the implied-basis
   chart series (§1d) and the per-wave alpOnImp dots are parked in front of
   this section – and its eligibility rule IS impOk (identical predicate),
   so fullPrimOn stays impOk. With no published ALP-v-ON totals at all the
   block collapses to empty payload cells and flowDriftOn is emitted null. */
const FLOW_ON_BASE_MIN = 3;
const driftOnResid = [];
for (const [key, v] of ALT_BY.entries()) {
  if (v.ao == null) continue;
  const p = POLL_BY_KEY.get(key);
  if (!p || noAggPoll(p) || !impOk(p)) continue;
  const x = v.ao;                          // published ALP share of the pairing (0-100)
  driftOnResid.push({ ym: ymOf(p.date), mid: midMs(p), n: rowN(p), firm: key.split("|")[1], key,
                      pq: (x / 100) * (1 - x / 100) * 1e4, x: x - impliedOn(p),
                      fl: flowToAlp(x, p.alp, p.onp) });
}
const driftOnByFirm = new Map();
for (const r of driftOnResid) {
  if (!driftOnByFirm.has(r.firm)) driftOnByFirm.set(r.firm, []);
  driftOnByFirm.get(r.firm).push(r);
}
const FLOW_ON_BASE_FROM = {};
for (const [firm, rows] of driftOnByFirm) {
  rows.sort((a, b) => a.mid - b.mid);
  const src = rows.slice(0, FLOW_ON_BASE_MIN);
  if (src.length < FLOW_ON_BASE_MIN) continue;
  FLOW_ON_BASE_FROM[firm] = {
    base: src.reduce((s, r) => s + r.n * r.x, 0) / src.reduce((s, r) => s + r.n, 0),
    from: src[src.length - 1].key.split("|")[0],
  };
}
const driftOnAnom = driftOnResid
  .filter((r) => FLOW_ON_BASE_FROM[r.firm])
  .map((r) => ({ ym: r.ym, mid: r.mid, x: r.x - FLOW_ON_BASE_FROM[r.firm].base, n: r.n, pq: r.pq, firm: r.firm, key: r.key,
                 fl: r.fl ?? null }));
const driftOnMonths = MONTHS.map((ym) => {
  const r = monthWithSe(driftOnAnom, null, ym);
  return r && { ym, x: mx(ym), v: r1(r.v), ci95: r1(1.96 * r.se), k: r.n };
}).filter(Boolean);
const driftOnNow = nowcastAdj(driftOnAnom, null, refNow);
const flowDriftOn = driftOnAnom.length ? {
  months: driftOnMonths,
  now: driftOnNow && { v: driftOnNow.v, ci95: driftOnNow.ci95, n: driftOnNow.n, nEff: driftOnNow.nEff },
  /* per-house anomaly series for the faint background lines — same ragged
     {ym, v} shape §7c's houses carry; fl is the n-weighted mean respondent
     flow to Labor over the waves that carry one */
  houses: Object.fromEntries(Object.keys(FLOW_ON_BASE_FROM).sort().map((f) => [f,
    MONTHS.map((ym) => {
      const rs = driftOnAnom.filter((r) => r.firm === f && r.ym === ym);
      if (!rs.length) return null;
      const w = rs.reduce((s, r) => s + r.n, 0);
      const fs = rs.filter((r) => r.fl != null), fw = fs.reduce((s, r) => s + r.n, 0);
      return { ym, v: r1(rs.reduce((s, r) => s + r.n * r.x, 0) / w),
               ...(fs.length ? { fl: r1(fs.reduce((s, r) => s + r.n * r.fl, 0) / fw) } : {}) };
    }).filter(Boolean),
  ])),
  meta: {
    /* anchor null: no count of this pairing exists, so there is no election
       date for the copy to measure a baseline from. */
    anchor: null,
    baseFrom: Object.fromEntries(Object.entries(FLOW_ON_BASE_FROM).map(([f, b]) => [f, b.from])),
    houses: Object.keys(FLOW_ON_BASE_FROM).sort(),
  },
  // display-only per-wave dots, §7c-parity: the anomaly behind each hover
  polls: driftOnAnom.map((r) => {
    const p = POLL_BY_KEY.get(r.key);
    return p && { x: dx(p.date), v: r1(r.x), pollster: r.firm,
                  dateLabel: fwLabel(p.dateStart, p.date), released: p.date,
                  sample: p.sample ?? null,
                  ...(r.fl != null ? { fl: r1(r.fl) } : {}) };
  }).filter(Boolean).sort((a, b) => a.x - b.x || a.pollster.localeCompare(b.pollster)),
} : null;

/* ---- 7db. "forced to choose" respondent splits, as lines ------------------
   The data under what was /preference-flows/' #forced section until
   2026-10-10, moved into the All-polls flow-drift section: RedBridge/Accent
   is the one house printing a respondent-allocated two-party BY FIRST
   PREFERENCE every month — tpp_split_on (the Labor-v-One Nation choice, by
   Coalition/Greens/other voters) and tpp_split (the Labor-v-Coalition
   choice, by Greens/One Nation/other voters). The panel draws two pairs of
   lines from them: what Coalition voters pick when pushed to Labor-or-ON
   (coal) and what One Nation voters pick when pushed to Labor-or-Coalition
   (on). a is the named cohort's share to Labor, b its complement to the
   rival. Jun 2026's coal row is the hand-derived 36/64 documented in
   polls.schema.json's tpp_split_on note. Passthrough display data, noAgg
   rows included: nothing here feeds an estimator. */
const flowForced = (() => {
  const rows = D.polls.filter((p) => p.pollster === "RedBridge/Accent" && (p.tpp_split || p.tpp_split_on))
                    .sort((a, b) => (a.date < b.date ? -1 : 1));
  if (!rows.length) return null;
  /* ym rides the FIELDWORK window (dateStart), matching the wave label
     convention the section ships with (a late-month wave filed at the next
     month's start still reads as its fieldwork month – Sep 2026's is
     date 2026-10-02 fw 2026-09-28 → "2026-09"). Each wave carries every
     cohort's Labor share on the one date, so the two charts group by
     QUESTION (Labor v One Nation / Labor v the Coalition) with one line
     per cohort, rather than by voter cohort as before. */
  const wave = (p) => {
    const mid = fmidIso(p.dateStart || p.date, p.date), y = +mid.slice(0, 4), mo = +mid.slice(5, 7), dy = +mid.slice(8);
    const dim = new Date(Date.UTC(y, mo, 0)).getUTCDate();
    return { date: p.date, ym: ymOf(p.dateStart || p.date),
             xm: Math.round((y * 12 + mo - 1 + (dy - 1) / dim) * 1e4) / 1e4,
             win: fwLabel(p.dateStart, p.date) + " " + y,
             n: p.sample ?? null, url: p.releaseUrl || p.url || null };
  };
  const vsOn = [], vsCoal = [];
  for (const p of rows) {
    /* HAND_SPLIT_ON lives with the emitters: estCohort names exactly which
       cohort's figure is derived (June 2026's Coalition split combines the
       printed CLP/LNP/Nat and Liberal rows); every other cell is verbatim. */
    if (p.tpp_split_on) {
      const w = wave(p);
      for (const ck of ["lnp", "grn", "oth"]) if (p.tpp_split_on[ck] != null) w[ck === "lnp" ? "coal" : ck] = p.tpp_split_on[ck];
      if (HAND_SPLIT_ON.has(p.date)) w.estCohort = "coal";
      if (w.coal != null || w.grn != null || w.oth != null) vsOn.push(w);
    }
    if (p.tpp_split) {
      const w = wave(p);
      for (const ck of ["grn", "onp", "oth"]) if (p.tpp_split[ck] != null) w[ck] = p.tpp_split[ck];
      if (w.grn != null || w.onp != null || w.oth != null) vsCoal.push(w);
    }
  }
  /* the 2025 election's OWN reading of the Labor-v-Coalition question. ALL
     FOUR carriers are the AEC's counted flows in the 115 CLASSIC seats
     (final pair Labor v Coalition), typed from
     `node .build/aec-2025-region-tpp-flows.mjs`'s output, which sums the
     vendored HouseTcpFlowByDivision file (where each candidate's own
     first-preference ballots finished; in a classic seat that is the
     two-party flow, ballot by ballot). The three region carriers are each
     class's classic seats (inner 25/43, outer 40/45, regional+rural
     50/62) and `all` is the same 115 seats whole, so the parts
     ballot-weight to the whole exactly (2026-10-19 reader report: the
     regions had been shown against the all-150-seat national figure).
     The AEC publishes TPP flows by party nationally and by state only, so
     the 35 non-classic seats can't join a seat-class cut. Its all-150-seat
     figures (FLOW_FED, 88.19/25.50/54.55) stay the estimator's constants
     in flows.mjs and ride `all` as `nat` for the footnote: GRN and ON sit
     within a point of them, Others ~6 points lower without the teal and
     independent seats. Until 2026-10-19 (1f337e42 and before) these were a
     replay of the distribution of preferences that blended origins in
     cascaded piles (GRN 80.45, ON 33.02) — never go back to it.
     xm is the election DAY on the waves' month-index scale
     (year·12 + month−1 + the day's share of its month), derived from the
     date: a hand-typed 24314.0645 put the rings ten months late, in
     March 2026, beside the first wave */
  const elec2025r = (() => {
    const d = "2025-05-03", y = +d.slice(0, 4), mo = +d.slice(5, 7), dy = +d.slice(8);
    const dim = new Date(Date.UTC(y, mo, 0)).getUTCDate();
    const xm = Math.round((y * 12 + mo - 1 + (dy - 1) / dim) * 1e4) / 1e4;
    /* scopeTtl leads the tip's title, scopeNote names the seats and their
       classic-seat coverage (cov) */
    const counted = (ttl, of, cov, grn, onp, oth) => ({ date: d, xm, win: "as counted", der: true, cov,
      scopeTtl: ttl, scopeNote: of + " (their " + cov + " seats that finished Labor v Coalition — the AEC publishes its two-party flows nationally and by state only)",
      grn, onp, oth });
    const pc = (v) => Math.round(v * 1e4) / 100;
    return { all: { ...counted("Labor-v-Coalition seats", "every seat that finished Labor v Coalition", "115 of 150", 87.46, 25.86, 48.33),
                    nat: { grn: pc(FLOW_FED.grn), onp: pc(FLOW_FED.onp), oth: pc(FLOW_FED.oth) } },
      inner: counted("Inner metro seats", "the seats classed inner metro", "25 of 43", 90.29, 25.99, 51.57),
      outer: counted("Outer metro seats", "the seats classed outer metro", "40 of 45", 86.95, 27.65, 48.88),
      regional: counted("Regional or rural seats", "the seats classed regional or rural", "50 of 62", 85.76, 24.76, 47.19) };
  })();
  /* the counts that MEASURED the Labor-v-One-Nation choice the second
     chart asks: crosses on the chart's own day, joined to no line (user
     2026-10-13; Farrer's four Coalition reads were removed the same day —
     its runners were Liberal-v-Nationals and Liberal/One Nation
     INDEPENDENT contests, and an independent-national count can't speak
     to One Nation voters' choices). Figures and labels as the
     preference-flows explainer's readings table — Hunter is the AEC's own
     count in the one 2025 seat One Nation ran Labor to the final pair,
     typed from the vendored TCP flow-by-division file
     (data/aec-2025-tcp-flow-by-division.csv: Nationals 3,461 of 20,290
     to Labor; Greens 7,241 of 8,286; the five minor-party piles — Legalise
     Cannabis, Animal Justice, Family First, Shooters, Trumpet of Patriots —
     6,642 of 16,503; no Liberal stood, so its Coalition cell is Nationals-
     only). SA is THIS SITE's estimate from the published distributions
     (.build/estimate-state-flows.py's 25 Labor v One Nation finals, the
     state commission's own flows due late 2026), with its tested 90%
     misses (err) and Bonham's figures beside it (alt) - user 2026-10-21:
     a cross with no range hid that the two estimates differ; its Others
     are ALL other voters (the table's "All other voters", like Hunter's
     five minor parties), not Bonham's independents-only figure. Secret
     Harbour is Green's count of the early voting centre, 47% of the votes
     (part: drawn hollow) - Green and Bonham both put the whole seat's
     Liberal flow a little more Labor's way. kind: "count" | "est" | "part". */
  /* Secret Harbour (user 2026-10-22: "data for all polling booths"): no
     whole-seat count by party exists, but the early polling place's count
     sheets (47% of the votes) plus the rest of the seat's first preferences
     and two-candidate total pin it down - .build/secret-harbour-flows.py,
     data/secret-harbour-flows.json. range: the spread over ways of dividing
     the rest's known total between parties, not a tested 90% error. */
  const shf = (() => {
    try { return JSON.parse(fs.readFileSync(path.join(ROOT, "data", "secret-harbour-flows.json"), "utf8")); } catch { return null; }
  })();
  const saC = (() => {
    try { return JSON.parse(fs.readFileSync(path.join(ROOT, "data", "state-flows-backtest.json"), "utf8")).contests["sa-2026-alp-onp"]; } catch { return null; }
  })();
  const byX = (d) => {
    const y = +d.slice(0, 4), mo = +d.slice(5, 7), dy = +d.slice(8);
    const dim = new Date(Date.UTC(y, mo, 0)).getUTCDate();
    return Math.round((y * 12 + mo - 1 + (dy - 1) / dim) * 1e4) / 1e4;
  };
  const bys = [
    { key: "hunter", date: "2025-05-03", xm: byX("2025-05-03"), label: "Hunter 2025", win: "3 May 2025",
      kind: "count", coal: 17.06, grn: 87.39, oth: 40.25, lbl: { coal: "Nationals", oth: "five minor parties" },
      sub: "The AEC’s count of the full distribution of preferences" },
    ...(saC && saC.model && saC.err90 ? [{ key: "sa2026", date: "2026-03-21", xm: byX("2026-03-21"), label: "South Australia 2026", win: "21 Mar 2026",
      kind: "est", coal: Math.round(saC.model.lib * 10) / 10, grn: Math.round(saC.model.grn * 10) / 10, oth: Math.round(saC.model.oth * 10) / 10,
      err: { coal: saC.err90.lib, grn: saC.err90.grn, oth: saC.err90.oth },
      alt: { coal: "Bonham 33.9", grn: "Bonham 84.8", oth: "independents " + saC.model.ind.toFixed(1) + ", Bonham 55.9" },
      lbl: { coal: "Liberal", oth: "all others" },
      sub: "This site’s estimate from the published distributions, " + saC.seats + " seats" }] : []),
    shf ? { key: "harbour", date: "2026-08-29", xm: byX("2026-08-29"), label: "Secret Harbour by-election", win: "29 Aug 2026",
      kind: "est", coal: Math.round(shf.estimate.lib * 10) / 10, grn: Math.round(shf.estimate.grn * 10) / 10, oth: Math.round(shf.estimate.oth * 10) / 10,
      range: { coal: shf.range.lib, grn: shf.range.grn, oth: shf.range.oth },
      alt: { coal: "early voting centre counted " + shf.early_polling_place.lib.toFixed(1), grn: "early voting centre counted " + shf.early_polling_place.grn.toFixed(1),
             oth: "early voting centre counted " + shf.early_polling_place.oth.toFixed(1) },
      lbl: { coal: "Liberal", oth: "all others" },
      sub: "This site’s estimate: the early voting centre’s count (" + Math.round(shf.early_share) + "% of the votes) plus the rest of the seat’s totals" }
    : { key: "harbour", date: "2026-08-29", xm: byX("2026-08-29"), label: "Secret Harbour by-election", win: "29 Aug 2026",
      kind: "part", coal: 29.8, grn: 90.0, lbl: { coal: "Liberal" },
      sub: "Green’s count of the early voting centre: 47% of the votes" },
  ];
  /* DemosAU's MRP reports print one national respondent flow beside
     RedBridge's: One Nation voters' share reaching Labor in Labor-v-Coalition
     contests (pref_flows.onp_alp_lnp, from full five-option rankings over the
     MRP sample). It rides the Labor v Coalition chart as marks, not a line –
     three quarterly readings, another house. */
  /* xm/win for the DemosAU marks, shared by the ledger's contests. An MRP
     spans six to seven weeks, so its triangle sits at the window's TRUE
     midpoint on the ledger lines' month-index axis – xm is year·12 +
     (month−1) + the day-of-month's share of its own month, the scale
     RdFlowSpark anchors every mark to (a house wave rides its own Mon→Mon midpoint off-slot
     too, since 2026-10-13's fleet anchoring). win hands the tooltip the
     printed window itself ("4 Aug–19 Sep 2026"): a midpoint sits between
     the whole-month ticks. */
  const mrpX = (p) => {
    const mid = fmidIso(p.dateStart || p.date, p.date);
    const y = +mid.slice(0, 4), mo = +mid.slice(5, 7), dy = +mid.slice(8);
    const dim = new Date(Date.UTC(y, mo, 0)).getUTCDate();
    return { xm: Math.round((y * 12 + mo - 1 + (dy - 1) / dim) * 1e4) / 1e4,
             win: fwLabel(p.dateStart, p.date) + " " + y };
  };
  const demos = D.polls.filter((p) => p.pollster === "DemosAU (MRP)" && p.pref_flows && p.pref_flows.onp_alp_lnp != null)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((p) => ({ date: p.date, ...mrpX(p), n: p.sample ?? null, onp: p.pref_flows.onp_alp_lnp }));
  /* national-only, no region cells (the MRP reports' Labor-v-Coalition
     split is never regional), so a named menu region drops these triangles
     with RedBridge's waves (user 2026-10-13) */
  /* The same reports' regional Labor-v-One-Nation tables make the pair's
     other chart too – one diamond per cohort per MRP wave, at the same
     true-midpoint x as demos. The figures are carried four ways, like lnpOn
     below: inner/outer/regional as printed (the reports' lnp key renames
     to coal) and `all` as prefFlowsOut's enrolment-and-vote weighting of
     them – computable, but our arithmetic, not a figure the report adds
     up for you, so the page marks it wt wherever the region select's
     "All voters" option shows. The select rekeys a wave, never recomputes. */
  const demosOn = D.polls.filter((p) => p.pollster === "DemosAU (MRP)" && p.pref_flows && p.pref_flows.alp_onp)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((p) => {
      const all = prefFlowsOut(p).all;
      if (!all || !all.alp_onp || all.alp_onp.lnp == null || all.alp_onp.grn == null || all.alp_onp.oth == null) return null;
      const out = { date: p.date, ...mrpX(p), n: p.sample ?? null,
                    all: { coal: all.alp_onp.lnp, grn: all.alp_onp.grn, oth: all.alp_onp.oth } };
      for (const r of ["inner", "outer", "regional"]) {
        const t = p.pref_flows.alp_onp[r];
        out[r] = t && t.lnp != null && t.grn != null && t.oth != null ? { coal: t.lnp, grn: t.grn, oth: t.oth } : null;
      }
      return out;
    }).filter(Boolean);
  /* The reports' other printed pairing, Coalition-v-One-Nation: each cohort's
     share reaching the Coalition, by region (pref_flows.lnp_onp). It powers
     the section's third, DemosAU-only chart. Each wave carries the figures
     four ways – inner/outer/regional as printed, `all` as prefFlowsOut's
     enrolment-and-vote weighting of them (the site's arithmetic, marked wt
     wherever the region filter's "All voters" option shows them) – so the
     page's region select only rekeys a wave, never recomputes it. */
  const lnpOn = D.polls.filter((p) => p.pollster === "DemosAU (MRP)" && p.pref_flows && p.pref_flows.lnp_onp)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((p) => {
      const all = prefFlowsOut(p).all;
      if (!all || !all.lnp_onp || !["alp", "grn", "oth"].every((k) => all.lnp_onp[k] != null)) return null;
      const out = { date: p.date, ym: ymOf(p.dateStart || p.date), ...mrpX(p), n: p.sample ?? null, url: p.releaseUrl || p.url || null,
                    house: "DemosAU (MRP)", all: all.lnp_onp };
      for (const r of ["inner", "outer", "regional"]) out[r] = p.pref_flows.lnp_onp[r] || null;
      return out;
    }).filter(Boolean);
  return vsOn.length && vsCoal.length ? { house: "RedBridge/Accent", vsOn, vsCoal, elec2025r, bys, ...(demos.length ? { demos } : {}), ...(demosOn.length ? { demosOn } : {}), ...(lnpOn.length ? { lnpOn } : {}) } : null;
})();

/* Nowcasts for the alternative matchups, on the same window/half-life. Null
   where the series can't support one (no reading inside the trailing window),
   which the hero reads as "fall back to the last monthly point". */
function altNowcast(s) {
  if (!s.adjusted) return null;                       // no house effects ⇒ too thin to nowcast
  const now = nowcastAdj(s.rows, s.he, refNow), prev = nowcastAdj(s.rows, s.he, refNow - 30 * 86400000);
  if (!now) return null;
  const out = { a: now.v, b: r1(100 - now.v), n: now.n, aPrev: prev ? prev.v : null, se: now.se, ci95: now.ci95, nEff: now.nEff };
  if (prev) {
    const seChg = Math.sqrt(now.se ** 2 + prev.se ** 2);
    out.changeCi95 = r1(1.96 * seChg);
    out.changeSig = Math.abs(now.v - prev.v) > 1.96 * seChg;
  }
  return out;
}
const altLatest = { alp_on: altNowcast(altAON), lnp_on: altNowcast(altLON) };

/* flowHistory – the preference-flow history chart's per-jurisdiction series,
   each the share of the bucket's ballots that ended with Labor at each
   election, per cent. fed is the FLOW_HISTORY display table typed in
   flows.mjs: the AEC's own counts. The states are ESTIMATES – no state
   commission publishes where each party's voters ended up – read from
   data/state-flows-est.csv, which .build/estimate-state-flows.py writes from
   the distributions of preferences with the two-class pile model (each
   excluded pile split into its own first preferences and the ballots it
   inherited). Every figure carries err90, the 90th-percentile error the
   model showed at that election's classic-seat count when run on federal
   elections whose counts are known (data/state-flows-backtest.json). The
   parsers' own flow_* columns in data/state-flows.csv blend a pile's
   inherited ballots into its party's split – the Greens 2–7 points low on
   the same test – and are never drawn.
   New South Wales is COUNTED, not estimated: its commission publishes every
   ballot's preferences, so parse-nsw-state-flows.py counts each party's
   voters exactly and the estimator passes them through (method "counted",
   no error bar; its exhausted share rides along, NSW being optional
   preferential). And the chart's NSW line is the parser's NOTIONAL cut
   (data/state-flows-nsw-allseats.json): the same ballots read as a Labor v
   Coalition contest in EVERY district, Antony Green's and the site's
   statewide two-party basis – user call 2026-10-22, "count all seats
   wherever the data allows"; its 2007 entry is the NSW Parliamentary
   Library's printed tally-sheet count (parse-nsw-2007-supplement.py),
   prepended ahead of the 2015-23 ballot-file scans. The classic-seats
   counts stay beside it from 2015 (FH.nsw.classic, null for 2007) for
   the tooltip's like-for-like with the other states;
   views still stuck on the classic cut – the other states' estimates, the
   federal 1996-2001 counts and the seat-class cut – list those years in
   hollowYears, and the chart marks those points open.
   Shown (user calls 2026-10-20): elections whose counts reached a Labor v
   Coalition final in at least STATE_MIN_CLASSIC seats (classicFrom marks
   where a counted line's classic-seats sidecar begins) – smaller counts'
   errors run wider: the Northern Territory's and South Australia's 2026
   (13 Labor v Liberal finals among 25 Labor v One Nation ones). Victoria's
   2006-18 counts, stopped once a candidate passed half the vote, run
   26-32 classic seats – under their own floor STATE_MIN_CLASSIC_JUR.vic,
   their error measured at that size under the same stopping rule (the
   estimator's vicstop band, user call 2026-10-23). One Nation's
   line (user call 2026-10-20): a COUNT is always drawn (NSW: every ballot
   counted, whatever One Nation's share); an ESTIMATE only where at least
   the backtest's onp_min_ballots One Nation ballots stand behind it – the
   smallest base the calibration tested (its draws' 5th percentile, ~39,000).
   Below it the federal back-test missed by 4-5 points, outside the bar. A
   vote-share cut (2%, 1.5%) tracked the wrong thing. A state
   counting Liberal and National piles apart has both as the Coalition, so
   the others line is the crossbench alone. fed.backtest carries the test's
   headline figures for the Info entry. Federal-only: the Vic build reads
   neither file and carries the federal series alone. */
const STATE_MIN_CLASSIC = 40;
// per-jurisdiction floors (user call 2026-10-23): Victoria's 2006-18 counts
// stopped once a candidate passed half the vote, so its classic counts run
// 26-32; their error was measured under that same stopping rule (the
// estimator's vicstop band, 24-34 seats), which the random-seat grid never
// reaches down to - so vic shows at the band's own floor
const STATE_MIN_CLASSIC_JUR = { vic: 24 };
const STATE_BUCKETS = ["grn", "onp", "oth"];
const flowHistory = (() => {
  const h = { fed: { label: "Federal", elections: "Australian federal elections", years: FLOW_HISTORY.years, grn: FLOW_HISTORY.grn, onp: FLOW_HISTORY.onp, oth: FLOW_HISTORY.oth } };
  const JURIS = {
    // short is the jurisdiction picker's chip face (user call 2026-10-20);
    // label stays full for the chart's unit line, tooltip and aria text
    vic: { label: "Victoria", short: "Vic", elections: "Victorian state elections", srcAs: "the Victorian Electoral Commission’s distributions of preferences" },
    wa: { label: "Western Australia", short: "WA", elections: "Western Australian state elections", srcAs: "the Western Australian Electoral Commission’s distributions of preferences" },
    sa: { label: "South Australia", short: "SA", elections: "South Australian state elections", srcAs: "the Electoral Commission SA’s distributions of preferences" },
    qld: { label: "Queensland", short: "Qld", elections: "Queensland state elections", srcAs: "the Electoral Commission of Queensland’s distributions of preferences" },
    nt: { label: "Northern Territory", short: "NT", elections: "Northern Territory elections", srcAs: "the NT Electoral Commission’s distributions of preferences" },
    nsw: { label: "New South Wales", short: "NSW", elections: "New South Wales state elections", srcAs: "the NSW Electoral Commission’s ballot-level preference data" },
  };
  if (JUR) return h;
  /* fed.sen: the SENATE's flows beside the House's (user 2026-10-22, the
     explainer chart's House: Upper view) — FLOW_HISTORY_SENATE in flows.mjs,
     computed from the AEC's ballot-level formal-preferences zips for the
     four elections since group voting tickets went (2016–2025; the
     committed counts sit in .build/aec-flow-src/senate-atl/). ATL ballots
     only, each draw cell the share of the family's ATL ballots naming a
     major that names Labor first; the nei arrays hold the "named neither
     major" share the Senate tooltip prints (never "exhausted" — every
     ballot is live at the count's end). A family with no ATL ballots in a
     state-year is null (One Nation: ACT in all four, NT until 2025),
     never zero. Federal-only by position: the Vic build returns above. */
  h.fed.sen = { label: "Senate", short: "Senate", senate: true, elections: "Australian Senate elections",
    years: [...FLOW_HISTORY_SENATE.years],
    grn: [...FLOW_HISTORY_SENATE.grn], grnNei: [...FLOW_HISTORY_SENATE.grnNei],
    onp: [...FLOW_HISTORY_SENATE.onp], onpNei: [...FLOW_HISTORY_SENATE.onpNei],
    oth: [...FLOW_HISTORY_SENATE.oth], othNei: [...FLOW_HISTORY_SENATE.othNei],
    states: Object.fromEntries(Object.entries(FLOW_HISTORY_SENATE.states).map(([k, s]) => [k,
      { label: s.label, short: s.short, elections: "Senate elections in " + s.label, senState: true,
        years: [...FLOW_HISTORY_SENATE.years],
        grn: [...s.grn], grnNei: [...s.grnNei],
        onp: [...s.onp], onpNei: [...s.onpNei],
        oth: [...s.oth], othNei: [...s.othNei] }])) };
  /* fed.senOn: the SAME Senate ballots cut the other way (user 2026-10-22,
     the explainer's Labor v One Nation tab under House: Upper) —
     FLOW_HISTORY_SENATE_ON in flows.mjs, from the pa blocks of the same
     committed counts (.build/aec-flow-src/senate-atl/counts.json, folded in
     by merge_pa_counts.py). Each cohort's draw cell is the share of its
     ATL ballots ranking Labor ahead of One Nation, of those naming either
     (a ballot naming only one of the pair counts its way, as the House
     cut's "naming at least one major" does); the nei triples hold its
     "named neither" share, never "exhausted". Nulls mark a state-year One
     Nation filed no Senate ticket in (the ACT: all four — the menu drops
     it). Federal-only like the rest. */
  h.fed.senOn = { label: "Senate", short: "Senate", senateOn: true, elections: "Australian Senate elections",
    years: [...FLOW_HISTORY_SENATE_ON.years],
    coal: [...FLOW_HISTORY_SENATE_ON.coal], coalNei: [...FLOW_HISTORY_SENATE_ON.coalNei],
    grn: [...FLOW_HISTORY_SENATE_ON.grn], grnNei: [...FLOW_HISTORY_SENATE_ON.grnNei],
    oth: [...FLOW_HISTORY_SENATE_ON.oth], othNei: [...FLOW_HISTORY_SENATE_ON.othNei],
    states: Object.fromEntries(Object.entries(FLOW_HISTORY_SENATE_ON.states).map(([k, s]) => [k,
      { label: s.label, short: s.short, elections: "Senate elections in " + s.label, senStateOn: true,
        years: [...FLOW_HISTORY_SENATE_ON.years],
        coal: [...s.coal], coalNei: [...s.coalNei],
        grn: [...s.grn], grnNei: [...s.grnNei],
        oth: [...s.oth], othNei: [...s.othNei] }])) };
  /* fed.senCon: the same Senate ballots' THIRD cut (user 2026-10-24, the
     explainer's Coalition v One Nation tab under House: Upper) —
     FLOW_HISTORY_SENATE_CON in flows.mjs, from the pc blocks of the same
     committed counts (.build/aec-flow-src/senate-atl/counts.json, folded
     in by merge_pc_counts.py). The Coalition is a contest side here, so
     the cohorts are Labor / Greens / others and a draw cell is the share
     ranking the COALITION ahead of One Nation, of the cohort's ATL
     ballots naming either (a ballot naming only one of the pair counts
     its way); the nei triples hold its "named neither" share. Nulls mark
     a state-year the count never saw One Nation ATL ballots in (the ACT:
     all four — the menu drops it). Federal-only like the rest. */
  h.fed.senCon = { label: "Senate", short: "Senate", senateCon: true, elections: "Australian Senate elections",
    years: [...FLOW_HISTORY_SENATE_CON.years],
    alp: [...FLOW_HISTORY_SENATE_CON.alp], alpNei: [...FLOW_HISTORY_SENATE_CON.alpNei],
    grn: [...FLOW_HISTORY_SENATE_CON.grn], grnNei: [...FLOW_HISTORY_SENATE_CON.grnNei],
    oth: [...FLOW_HISTORY_SENATE_CON.oth], othNei: [...FLOW_HISTORY_SENATE_CON.othNei],
    states: Object.fromEntries(Object.entries(FLOW_HISTORY_SENATE_CON.states).map(([k, s]) => [k,
      { label: s.label, short: s.short, elections: "Senate elections in " + s.label, senStateCon: true,
        years: [...FLOW_HISTORY_SENATE_CON.years],
        alp: [...s.alp], alpNei: [...s.alpNei],
        grn: [...s.grn], grnNei: [...s.grnNei],
        oth: [...s.oth], othNei: [...s.othNei] }])) };
  /* nsw.sen: the NSW LEGISLATIVE COUNCIL's flows beside the Assembly's —
     the one state upper house whose commission publishes the ballots (NSW
     abolished group tickets in 1999), so the explainer's Upper view shows
     it alone, no other state. FLOW_HISTORY_NSW_LC in flows.mjs, counted
     from the NSWEC's ballot-level zips (.build/nswec-lc-flow-src/), the
     four elections 2011–2023, ATL only like the Senate series. Most LC
     papers are a single "1", so oneOnly rides along for the caption.
     Federal-only by position: the Vic build returned above. Attached
     AFTER the JURIS loop below builds h.nsw from the estimate CSV — this
     spread would not survive it. */
  const NSW_SEN = { label: "NSW Legislative Council", short: "NSW LC", senate: true, lc: true, elections: "NSW Legislative Council elections",
    years: [...FLOW_HISTORY_NSW_LC.years],
    grn: [...FLOW_HISTORY_NSW_LC.grn], grnNei: [...FLOW_HISTORY_NSW_LC.grnNei],
    onp: [...FLOW_HISTORY_NSW_LC.onp], onpNei: [...FLOW_HISTORY_NSW_LC.onpNei],
    oth: [...FLOW_HISTORY_NSW_LC.oth], othNei: [...FLOW_HISTORY_NSW_LC.othNei],
    oneOnly: [...FLOW_HISTORY_NSW_LC.oneOnly] };
  /* nsw.senOn: the SAME Council ballots' Labor-v-One-Nation cut (2026-10-23,
     FLOW_HISTORY_NSW_LC_ON in flows.mjs, from the pa blocks of the same
     NSWEC counts) — the explainer's One Nation tab under Upper. 2011/2015
     are null: One Nation ran no LC group either year, a gap never a zero.
     Same position rule as NSW_SEN: declared after the JUR return (never in
     the Vic build), attached after the JURIS loop below. */
  const NSW_SEN_ON = { label: "NSW Legislative Council", short: "NSW LC", senateOn: true, lc: true, elections: "NSW Legislative Council elections",
    years: [...FLOW_HISTORY_NSW_LC_ON.years],
    coal: [...FLOW_HISTORY_NSW_LC_ON.coal], coalNei: [...FLOW_HISTORY_NSW_LC_ON.coalNei],
    grn: [...FLOW_HISTORY_NSW_LC_ON.grn], grnNei: [...FLOW_HISTORY_NSW_LC_ON.grnNei],
    oth: [...FLOW_HISTORY_NSW_LC_ON.oth], othNei: [...FLOW_HISTORY_NSW_LC_ON.othNei],
    oneOnly: [...FLOW_HISTORY_NSW_LC_ON.oneOnly] };
  /* nsw.senCon: the SAME Council ballots' Coalition-v-One-Nation cut
     (2026-10-24, FLOW_HISTORY_NSW_LC_CON in flows.mjs, from the pc blocks
     of the same NSWEC counts) — the explainer's Coalition v One Nation
     tab under Upper. 2011/2015 are null: One Nation ran no LC group
     either year, a gap never a zero. Same position rule as the rest:
     declared after the JUR return (never in the Vic build), attached
     after the JURIS loop below. */
  const NSW_SEN_CON = { label: "NSW Legislative Council", short: "NSW LC", senateCon: true, lc: true, elections: "NSW Legislative Council elections",
    years: [...FLOW_HISTORY_NSW_LC_CON.years],
    alp: [...FLOW_HISTORY_NSW_LC_CON.alp], alpNei: [...FLOW_HISTORY_NSW_LC_CON.alpNei],
    grn: [...FLOW_HISTORY_NSW_LC_CON.grn], grnNei: [...FLOW_HISTORY_NSW_LC_CON.grnNei],
    oth: [...FLOW_HISTORY_NSW_LC_CON.oth], othNei: [...FLOW_HISTORY_NSW_LC_CON.othNei],
    oneOnly: [...FLOW_HISTORY_NSW_LC_CON.oneOnly] };
  /* fed.states: the same counts split by state, for the explainer's
     Federal sub-row (user 2026-10-21): data/fed-state-flows.json, written by
     .build/fed-state-flows.py from the AEC's per-state TPP flow downloads
     (2004–2025; 1996–2001 exists only as the national classic cut). AEC
     counts like the national series — no error bars, a year One Nation
     never counted in a state is null. Guarded: a missing file drops the
     sub-row; federal-only (the Vic build returns above). */
  try {
    const fsf = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "fed-state-flows.json"), "utf8"));
    h.fed.states = Object.fromEntries(Object.entries(fsf.states).map(([k, s]) => [k,
      { label: s.label, short: s.short, elections: "federal elections in " + s.label, fedState: true,
        years: [...fsf.years], grn: [...s.grn], onp: [...s.onp], oth: [...s.oth] }]));
  } catch { /* not yet written */ }
  /* fed.classes: the same counted family split by seat type, for the
     explainer's four class views (user request 2026-10-22): data/
     fed-class-flows.json, written by .build/fed-class-flows.py from the
     AEC's per-division TCP flow tables (eleven elections 1996–2025 —
     1996–2001 from their statistics packs via aec-tcp-history.py, 2004
     on from the downloads; 1996 is now the floor on both sides, the
     classification store's 1996/1998 blocks transcribed 2026-10-22 from
     the AEC's whole-chamber "Divisional Classifications" pages — and the
     per-division flow table reaches it natively)
     grouped by the AEC's own per-election division classifications —
     the election's own table, so a recategorised seat moves classes with
     it. AEC counts like the national series — no error bars, a class-
     year a bucket's ballots never reached a classic seat there is null
     (One Nation barely stood in inner-metropolitan seats in 2010–2013).
     Guarded like fed.states: a missing file drops the four options.
     Since 2026-10-23 (user-approved plan, "don't accept 'can't be
     done'") the views SWITCH BASIS in place: before 2004 the classic
     seats are all any product reaches (ringed), from 2004 the count
     covers every seat — the TPP-by-division cut pairs Labor and the
     Coalition everywhere, and the ballots sitting on a non-classic
     final pair are recovered from the state flow table's leftovers
     (the store's allSeats block; the lump line sums the buckets so the
     three-cornered Coalition drift never touches it). Cells whose
     state's crossbench seats span seat types are the allSeats.est
     estimates (diamonds on the page) - fitted to each seat's counted
     minor-party total since 2026-10-25, so the lump line stays a count
     there (allSeats.lumpEst names the few drift-spread exceptions). The user's lumped minor line —
     the 4th line — runs 1996–2025, classic-based ahead of 2004 like
     the buckets. */
  try {
    const fcf = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "fed-class-flows.json"), "utf8"));
    const CLASS_CUT = 2004;
    /* the lane reader: the four seat types (store classes/allSeats over
       fcf.years) and the fifteen SEIFA fifths (store seifa.classes/
       seifa.allSeats over seifa.years — five per index, each record's ix
       tagging it "irsad"/"ieo"/"ier" so the menu splits its three
       optgroups and the captions name the right index — emitted into the
       SAME bank with a seifa marker so the chart captions fork on
       S.seifa; every other consumer sees one flat list of class views)
       run one mapping over their own year arrays */
    const laneClasses = (classes, all, laneYears, seifa) =>
      Object.fromEntries(Object.entries(classes).map(([k, s]) => {
        /* a SEIFA record may carry its own span (IEO and IER open at
           1998, IRSAD at 2001 - 2026-10-25) */
        const years = s.years || laneYears;
        const A = (all || {})[k] || {};
        const pick = (b) => years.map((y, i) => (y >= CLASS_CUT && A[b] ? A[b][i] : s[b][i]));
        const est = (b) => years.map((y, i) => (y >= CLASS_CUT && A.est && A.est[b] ? !!A.est[b][i] : false));
        const ballots = (b) => years.map((y, i) => (y >= CLASS_CUT ? ((A.votes || {})[b] || [])[i] || null : (s.votes || {})[b] ? s.votes[b][i] : null));
        const buckets = ["grn", "onp", "oth"];
        /* the lump is a count wherever the store says so (the 2026-10-25
           count-anchored fit honours every seat's own minor total); only a
           three-cornered drift spread across groups flags it */
        const estLump = years.map((y, i) => (y >= CLASS_CUT && A.lumpEst ? !!A.lumpEst[i] : false));
        return [k,
          { label: s.label, short: s.short,
            /* the record's own scope copy — the grouping and its index;
               every index ranks on one basis (the interpolated percentile
               inside the census window), which How it's built explains */
            elections: seifa ? "federal elections in the " + s.desc + " of seats by " + s.ix.toUpperCase()
                             : "federal elections in " + s.short + " seats",
            fedClass: true, ...(seifa ? { seifa: true, ix: s.ix } : {}),
            hollowYears: years.filter((y) => y < CLASS_CUT),
            years: [...years], grn: pick("grn"), onp: pick("onp"), oth: pick("oth"),
            lump: A.lump ? [...A.lump] : null,
            estGrn: est("grn"), estOnp: est("onp"), estOth: est("oth"), estLump,
            ballots: Object.fromEntries([...buckets, "lump"].map((b) => [b,
              b === "lump" ? (A.lumpVotes ? [...A.lumpVotes] : years.map(() => null)) : ballots(b)])) }];
      }));
    h.fed.classes = { ...laneClasses(fcf.classes, fcf.allSeats, fcf.years, false),
                      ...(fcf.seifa ? laneClasses(fcf.seifa.classes, fcf.seifa.allSeats, fcf.seifa.years, true) : {}) };
  } catch { /* not yet written */ }
  let csv = null, bt = null;
  try { csv = fs.readFileSync(path.join(ROOT, "data", "state-flows-est.csv"), "utf8"); } catch { /* not yet written */ }
  try { bt = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "state-flows-backtest.json"), "utf8")); } catch { /* ditto */ }
  if (!csv || !bt) return h;
  const onpMin = bt.onp_min_ballots || Infinity;
  /* the federal series before its counts (user 2026-10-21): the AEC
     counted no flow by party before 1996, but every seat's full
     distribution exists from 1984, so the estimator's federal_hist
     classic-seat estimates (1984-93) draw ahead of FLOW_HISTORY's counts,
     each with the calibration's 90% error at its seat count - the method
     and the bars of the state lines, tried on the ten counted federal
     elections since 1996. 1983 stays out (its counts stopped at a
     majority); 2004 is counted. One Nation by the state rule. */
  {
    const FHh = bt.federal_hist || {};
    const pre = Object.keys(FHh).map(Number).filter((y) => y < h.fed.years[0]).sort((a, b) => a - b);
    if (pre.length) {
      const cell = (y, b) => {
        const d = FHh[y][b];
        return d && d.err90 != null && (b !== "onp" || d.ballots >= onpMin) ? d : null;
      };
      const val = (b) => pre.map((y) => (cell(y, b) ? Math.round(cell(y, b).model * 10) / 10 : null));
      const err = (b) => pre.map((y) => (cell(y, b) ? Math.round(cell(y, b).err90 * 10) / 10 : null));
      const none = h.fed.years.map(() => null);
      h.fed = { ...h.fed, years: [...pre, ...h.fed.years], estYears: pre,
        grn: [...val("grn"), ...h.fed.grn], onp: [...val("onp"), ...h.fed.onp], oth: [...val("oth"), ...h.fed.oth],
        grnErr: [...err("grn"), ...none], onpErr: [...err("onp"), ...none], othErr: [...err("oth"), ...none] };
    }
  }
  // the national chart's classic-seats years (user 2026-10-22): 1996-2001's
  // counts survive only as the national classic cut (state splits start
  // 2004); the estimated 1984-93 lead-in carries its error bars instead
  h.fed.hollowYears = h.fed.years.filter((y) => y >= 1996 && y < 2004);
  const lines = csv.split(/\r?\n/).filter((ln) => ln.trim());
  const head = (lines.shift() || "").split(",");
  const ci = Object.fromEntries(head.map((x, i) => [x, i]));
  const bag = {};
  lines.forEach((ln) => {
    const c = ln.split(",");
    const jur = c[ci.jurisdiction], year = +c[ci.year], b = c[ci.party];
    const minCl = STATE_MIN_CLASSIC_JUR[jur] || STATE_MIN_CLASSIC;
    if (!JURIS[jur] || +c[ci.n_classic] < minCl || !STATE_BUCKETS.includes(b)) return;
    // NSW's rows are COUNTS (method "counted": ballot-level data) and carry
    // no error; every estimate must carry its calibrated one
    const counted = c[ci.method] === "counted";
    if (c[ci.est_flow_to_alp] === "" || (!counted && c[ci.err90] === "")) return;
    if (b === "onp" && !counted && +c[ci.est_alp_votes] + +c[ci.est_coal_votes] < onpMin) return;
    ((bag[jur] ||= {})[year] ||= {})[b] = { v: Math.round(+c[ci.est_flow_to_alp] * 1000) / 10,
      e: counted ? null : Math.round(+c[ci.err90] * 10) / 10, counted,
      // exhausted share: optional-preferential counts only (NSW, Qld to 2015)
      x: c[ci.exhausted_share] !== "" ? Math.round(+c[ci.exhausted_share] * 1000) / 10 : null };
  });
  const errs = { grn: [], onp: [], oth: [] };
  for (const [jk, meta] of Object.entries(JURIS)) {
    const years = Object.keys(bag[jk] || {}).map(Number).sort((a, b) => a - b);
    if (!years.length) continue;
    const col = (b, k) => years.map((y) => (bag[jk][y][b] ? bag[jk][y][b][k] : null));
    STATE_BUCKETS.forEach((b) => errs[b].push(...col(b, "e").filter((e) => e != null)));
    // counted (NSW) or estimated, never a mix within one jurisdiction
    const isCounted = years.every((y) => Object.values(bag[jk][y]).every((x) => x.counted));
    h[jk] = { label: meta.label, short: meta.short, elections: meta.elections, srcAs: meta.srcAs,
      estimated: !isCounted, counted: isCounted,
      // an estimate is a classic-seats figure – mark every year open (NSW
      // is the state on the all-seats basis; its marker flag clears below)
      hollowYears: isCounted ? null : [...years],
      asOf: years.length > 1 ? years[0] + "–" + years[years.length - 1] : String(years[0]),
      years, grn: col("grn", "v"), onp: col("onp", "v"), oth: col("oth", "v"),
      grnErr: col("grn", "e"), onpErr: col("onp", "e"), othErr: col("oth", "e"),
      ...(STATE_BUCKETS.some((b) => col(b, "x").some((x) => x != null))
        ? { grnExh: col("grn", "x"), onpExh: col("onp", "x"), othExh: col("oth", "x"),
            opv: years.filter((y) => Object.values(bag[jk][y]).some((x) => x.x != null)) } : null) };
  }
  /* NSW on the all-seats basis (user call 2026-10-22: "count all seats
     wherever the data allows"): the notional Labor v Coalition scan of
     every district's ballots (data/state-flows-nsw-allseats.json) draws
     the line; the classic-seats counts move beside it for the tooltip's
     like-for-like against the other states, whose data allows nothing
     else. Guarded like the other side-stores: a missing file keeps the
     classic-seats line (still marked open, hollowYears above stands). */
  try {
    const nswAll = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "state-flows-nsw-allseats.json"), "utf8"));
    if (h.nsw && nswAll && nswAll.years && nswAll.years.length) {
      const ix = Object.fromEntries(nswAll.years.map((y, i) => [y, i]));
      /* 2007's tally-sheet count (parse-nsw-2007-supplement.py) predates the
         ballot-file years the estimator rows cover – prepend it to the view:
         an all-seats count like the rest of the store, no classic sidecar
         figure (nothing counted 2007's classic seats) */
      const extra = nswAll.years.filter((y) => !h.nsw.years.includes(y)).sort((a, b) => a - b);
      if (extra.length) {
        h.nsw = { ...h.nsw, years: [...extra, ...h.nsw.years] };
        for (const k of ["grn", "onp", "oth", "grnExh", "onpExh", "othExh"])
          h.nsw[k] = [...extra.map(() => null), ...h.nsw[k]];
        h.nsw.asOf = h.nsw.years[0] + "–" + h.nsw.years[h.nsw.years.length - 1];
      }
      const pick = (k) => h.nsw.years.map((y) => (ix[y] != null && nswAll[k] ? nswAll[k][ix[y]] : null));
      /* 2007's tally sheets covered the 73 Labor-v-Coalition districts — a
         classic-coverage point, so it rings hollow like the other states */
      h.nsw = { ...h.nsw, allSeats: true, hollowYears: extra.length ? [...extra] : null,
        classic: { grn: h.nsw.grn, grnExh: h.nsw.grnExh, onp: h.nsw.onp, onpExh: h.nsw.onpExh, oth: h.nsw.oth, othExh: h.nsw.othExh },
        classicFrom: extra.length ? h.nsw.years[extra.length] : null,
        grn: pick("grn"), onp: pick("onp"), oth: pick("oth"),
        grnExh: pick("grnExh"), onpExh: pick("onpExh"), othExh: pick("othExh") };
      h.nsw.opv = h.nsw.years.filter((y, i) => h.nsw.grnExh[i] != null || h.nsw.onpExh[i] != null || h.nsw.othExh[i] != null);
    }
  } catch { /* not yet written */ }
  // NSW's Upper house rides beside its Assembly lines (declared above, after
  // the JUR return, so the Vic build never carries it; see NSW_SEN there) —
  // all three pairings (sen / senOn / senCon) in the one slot
  if (h.nsw) { h.nsw.sen = NSW_SEN; h.nsw.senOn = NSW_SEN_ON; h.nsw.senCon = NSW_SEN_CON; }
  // the back-test's headline figures: mean miss against the AEC's counts over
  // the federal elections (One Nation's from 2016, its first wide field)
  const mae = (b, k, from = 0) => {
    const v = Object.entries(bt.federal || {}).filter(([y, d]) => +y >= from && d[b]).map(([, d]) => Math.abs(d[b][k] - d[b].counted));
    return v.length ? Math.round((v.reduce((s, x) => s + x, 0) / v.length) * 10) / 10 : null;
  };
  const qld = Object.values(bt.qld_check || {}).flatMap((d) => Object.values(d).map((x) => Math.abs(x.model - x.counted)));
  // NSW, where the ballots are counted: the model's reading against the count
  const nswMax = (b) => {
    const v = Object.values(bt.nsw_check || {}).filter((d) => d[b]).map((d) => Math.abs(d[b].model - d[b].counted));
    return v.length ? Math.round(Math.max(...v) * 10) / 10 : null;
  };
  // ... and its exhausted share against the counted one, every group: the
  // test of the optional-preferential estimates (Qld to 2015)
  const nswExh = () => {
    const v = Object.values(bt.nsw_check || {}).flatMap((d) => Object.values(d))
      .filter((x) => x.exh_model != null).map((x) => Math.abs(x.exh_model - x.exh_counted));
    return v.length ? Math.round(Math.max(...v) * 10) / 10 : null;
  };
  const span = (v) => (v.length ? [Math.min(...v), Math.max(...v)] : null);
  h.fed.backtest = {
    elections: Object.keys(bt.federal || {}).length, minClassic: STATE_MIN_CLASSIC,
    fedEst: h.fed.estYears || null,
    /* vic's stop-rule band (the 2026-10-23 call's measurement): the
       estimator's vicstop block, so the Info entry can quote the error
       measured under the VEC's own stopping rule at Vic-sized counts */
    vicstop: bt.vicstop && bt.vicstop.grn ? {
      grn: bt.vicstop.grn.p90, oth: bt.vicstop.oth ? bt.vicstop.oth.p90 : null,
      onp: bt.vicstop.onp ? bt.vicstop.onp.p90 : null,
      band: (bt.vicstop.band && bt.vicstop.band.band) || null,
    } : null,
    grn: { model: mae("grn", "model"), replay: mae("grn", "replay") },
    oth: { model: mae("oth", "model"), replay: mae("oth", "replay") },
    onp: { model: mae("onp", "model", 2016), replay: mae("onp", "replay", 2016) },
    err90: { grn: span(errs.grn), onp: span(errs.onp), oth: span(errs.oth) }, onpMinBallots: bt.onp_min_ballots || null,
    qld: qld.length ? Math.round(Math.max(...qld) * 10) / 10 : null, qldSource: bt.qld_source || null,
    nsw: bt.nsw_check ? { grn: nswMax("grn"), oth: nswMax("oth"), exh: nswExh() } : null,
    /* the others estimates' lean (user 2026-10-21 review): the calibration's
       mean signed miss at the state sizes, and the model-minus-count gap in
       every NSW election - both below zero, so the Info entry says so */
    /* ... and the Greens estimates lean HIGH (2026-10-21, once 1996-2007
       joined the trials): the calibration's mean signed miss, and the
       federal elections it was largest in */
    grnLean: {
      cal: span(Object.values(bt.calibration || {}).map((t) => t.grn && t.grn.bias).filter((x) => x != null)),
      worst: Object.entries(bt.federal || {}).filter(([, d]) => d.grn && d.grn.model - d.grn.counted >= 2)
        .map(([y, d]) => ({ year: +y, miss: Math.round((d.grn.model - d.grn.counted) * 10) / 10 })) },
    othLean: {
      cal: span(Object.values(bt.calibration || {}).map((t) => t.oth && t.oth.bias).filter((x) => x != null)),
      nsw: span(Object.values(bt.nsw_check || {}).filter((d) => d.oth).map((d) => Math.round((d.oth.model - d.oth.counted) * 10) / 10)) },
    /* the Labor v One Nation contest's bars: Greens/others from the
       calibration at its seat count, the Liberal cell from the federal seats
       where Labor faced a non-Coalition finalist (largest miss of six) */
    contest: (() => {
      const c = (bt.contests || {})["sa-2026-alp-onp"];
      return c && c.err90 ? { seats: c.seats, err: c.err90, elections: Object.keys(bt.noncoal_check || {}).length } : null;
    })() };
  return h;
})();

/* primaryHistory – behind the explainer chart's "View: Primary votes" flip
   (2026-10-23): every party family's share of the formal first-preference
   vote at each federal election since 1972, national and per state, House
   and Senate. data/primary-history.json, written by
   .build/aec-primary-history.py from the committed AEC first-preference
   downloads (.build/aec-flow-src/fpv/, 2004–2025) and its typed HISTORY
   block (1972–2001). A named minor carries its own line only where the
   view's vote reached the file's foldPt (4%) – below it the share folds
   into oth and the line gaps (a null, never a zero). Federal data by
   position: the Vic build carries it exactly like the flow history's
   federal table. Guarded like the flow side stores: a missing file drops
   the flip (the chart keeps Preference flows alone). */
const primaryHistory = (() => {
  try {
    const { _comment, ...ph } = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "primary-history.json"), "utf8"));
    return ph;
  } catch { return null; }
})();

/* informal-history.json – the explainer chart's View: Informal votes
   flip; informal ballots as a share of ballots cast per federal
   election, national + states + House and Senate, plus federal seat
   classes and IRSAD/IEO quintiles. Same guarded-read posture: a missing
   file drops the flip, never the build. */
const informalHistory = (() => {
  try {
    const { _comment, ...ih } = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "informal-history.json"), "utf8"));
    return ih;
  } catch { return null; }
})();

/* primaryHistory.stateElections – the same chart's STATE-election views
   (user 2026-10-23: "what about primary votes for state elections, lower
   and upper houses"; scope: the six jurisdictions the flow bank covers
   under Lower, plus the NSW, Vic, SA and WA Legislative Councils under
   Upper – the chambers whose official counts let the bank book every
   family's share; Tas's fifteen-by-five-member Hare-Clark Council sits
   out for the same reason the flow chart's Council note gives). The
   assemblies' first preferences come from the state flow parsers' one CSV
   (data/state-flows.csv, prim_share – the same vote figures their flows
   are estimated from); the Council's family shares ride its own NSWEC
   count bank (.build/nswec-lc-flow-src/counts.json, above-the-line papers
   like the Senate view). The Coalition view merges the Liberal and
   Nationals lines (Queensland's merger rows carry the lot under lib; the
   NT's is the CLP whole), and a named minor folds under the same 4% as
   the national views, its share joining Others. The srcLine map mirrors
   the flowHistory JURIS credits – the primary view names the commission's
   official results where the flows' srcAs names its distributions; both
   homes move together. The jurisdiction meta mirrors the JURIS map's copy
   too – the Territory's classic-seat tally sits under the flow
   estimator's floor, so it never joins the flow history's menu, but its
   first preferences stand on their own here (a primary chart needs no
   classic-seat count). Federal-only by position: the Vic build returns
   without them, as the flow history does. */
if (primaryHistory && !JUR) {
  const FOLD = primaryHistory.foldPt || 4;
  const r2p = (v) => Math.round(v * 100) / 100;
  const STE = [
    ["vic", "Vic", "Victoria", "Victorian state elections", "the Victorian Electoral Commission’s official results"],
    ["wa", "WA", "Western Australia", "Western Australian state elections", "the Western Australian Electoral Commission’s official results"],
    ["sa", "SA", "South Australia", "South Australian state elections", "the Electoral Commission SA’s official results"],
    ["qld", "Qld", "Queensland", "Queensland state elections", "the Electoral Commission of Queensland’s official results"],
    ["nt", "NT", "Northern Territory", "Northern Territory elections", "the NT Electoral Commission’s official results"],
    ["nsw", "NSW", "New South Wales", "New South Wales state elections", "the NSW Electoral Commission’s official results"],
  ];
  const ste = {};
  try {
    const STE_KEYS = ["alp", "lnp", "grn", "onp", "oth"];
    const csvSTE = fs.readFileSync(path.join(ROOT, "data", "state-flows.csv"), "utf8");
    const bag = {};
    csvSTE.split(/\r?\n/).slice(1).forEach((ln) => {
      if (!ln.trim()) return;
      const c = ln.split(",");
      // jurisdiction,year,party,prim_votes,prim_share,… – nat merges into lib
      ((bag[c[0]] ||= {})[+c[1]] ||= {})[c[2]] = +c[4];
    });
    for (const [jk, short, label, elections, srcLine] of STE) {
      const byYear = bag[jk];
      if (!byYear) continue;   // a jurisdiction the CSV never covers stays out
      const years = Object.keys(byYear).map(Number).sort((a, b) => a - b);
      const lines = Object.fromEntries(STE_KEYS.map((k) => [k, []]));
      years.forEach((y) => {
        const row = byYear[y];
        const cell = (k) => row[k] || 0;
        const g = cell("grn"), o = cell("onp");
        const gIn = g >= FOLD, oIn = o >= FOLD;
        lines.alp.push(r2p(cell("alp")));
        lines.lnp.push(r2p(cell("lib") + cell("nat")));
        lines.grn.push(gIn ? r2p(g) : null);   // a sub-fold family gaps, never zeroes
        lines.onp.push(oIn ? r2p(o) : null);
        lines.oth.push(r2p(cell("oth") + (gIn ? 0 : g) + (oIn ? 0 : o)));
      });
      ste[jk] = { label, short, elections, srcLine,
        years, alp: lines.alp, lnp: lines.lnp, grn: lines.grn, onp: lines.onp, oth: lines.oth };
    }
  } catch { /* no flows CSV: the national primary views still stand */ }
  /* the NSW Legislative Council view, banked beside the Assembly's exactly
     as the flow side banks FH.nsw.sen: the same committed NSWEC count
     (atlByFamily shares of the above-the-line papers). PHON ran no Council
     group before 2019 – a zero-ballot family is null, never a zero. */
  try {
    const lc = JSON.parse(fs.readFileSync(path.join(ROOT, ".build", "nswec-lc-flow-src", "counts.json"), "utf8"));
    const years = Object.keys(lc.events || {}).map(Number).sort((a, b) => a - b);
    if (ste.nsw && years.length) {
      const fam = (y, k) => ((lc.events[y].atlByFamily || {})[k] || 0) / lc.events[y].atl * 100;
      const gate = (y, k) => { const v = fam(y, k); return v >= FOLD ? r2p(v) : null; };
      ste.nsw.sen = { label: "NSW Legislative Council", short: "NSW LC", lc: true,
        elections: "NSW Legislative Council elections",
        srcLine: "the NSW Electoral Commission’s ballot-level preference files",
        years,
        alp: years.map((y) => r2p(fam(y, "ALP"))),
        lnp: years.map((y) => r2p(fam(y, "COAL"))),
        grn: years.map((y) => gate(y, "GRN")),
        onp: years.map((y) => gate(y, "PHON")),
        oth: years.map((y) => r2p(fam(y, "OTHER") + (fam(y, "GRN") < FOLD ? fam(y, "GRN") : 0) + (fam(y, "PHON") < FOLD ? fam(y, "PHON") : 0))) };
    }
  } catch { /* counts bank missing: the Council view stays out */ }
  /* the Vic, SA and WA Legislative Councils (2026-10-24, user "why only
     nsw state upper house?… yes"): full-formal banks parsed per
     commission in .build/state-lc-primaries/ (parse-<jur>-lc.py, {jur}.json
     – byFamily shares of EVERY formal first preference, so no ATL
     qualifier rides these the way NSW's ballot-paper count's does).
     WAEC party codes are year-qualified ({code}:{year}) in the parser, so
     a recycled code can never silently mis-map here. A jurisdiction the
     Assembly CSV never covered keeps no Council view either. */
  const LC_SRC = {
    vic: ["Victorian Legislative Council", "Vic LC", "the Victorian Electoral Commission’s official results"],
    sa: ["South Australian Legislative Council", "SA LC", "the Electoral Commission SA’s official results"],
    wa: ["Western Australian Legislative Council", "WA LC", "the Western Australian Electoral Commission’s official results"],
  };
  for (const [jk, [label, short, srcLine]] of Object.entries(LC_SRC)) {
    try {
      const lc = JSON.parse(fs.readFileSync(path.join(ROOT, ".build", "state-lc-primaries", `${jk}.json`), "utf8"));
      const years = Object.keys(lc.events || {}).map(Number).sort((a, b) => a - b);
      if (!ste[jk] || !years.length) continue;
      const fam = (y, k) => ((lc.events[y].byFamily || {})[k] || 0) / lc.events[y].formal * 100;
      const gate = (y, k) => { const v = fam(y, k); return v >= FOLD ? r2p(v) : null; };
      ste[jk].sen = { label, short, lc: true,
        elections: `${label} elections`,
        srcLine,
        years,
        alp: years.map((y) => r2p(fam(y, "ALP"))),
        lnp: years.map((y) => r2p(fam(y, "COAL"))),
        grn: years.map((y) => gate(y, "GRN")),
        onp: years.map((y) => gate(y, "ONP")),
        oth: years.map((y) => r2p(fam(y, "OTHER") + (fam(y, "GRN") < FOLD ? fam(y, "GRN") : 0) + (fam(y, "ONP") < FOLD ? fam(y, "ONP") : 0))) };
    } catch { /* bank missing: that Council view stays out */ }
  }
  if (Object.keys(ste).length) primaryHistory.stateElections = ste;
}

/* twoPPHistory – behind the explainer chart's "View: 2PP" flip (2026-10-23,
   the facets the user asked for beside the sibling "View: Primary votes":
   national, each state and territory, and the AEC demographic-rating seat
   classifications). data/2pp-history.json, written by .build/aec-2pp-history.py:
   Labor's and the Coalition's two-party-preferred shares at each federal
   election – national 1972–2025 (polls.json's canonical election records,
   the same figures every past-cycle panel quotes), states and the four
   seat classes 1996–2025 (the AEC's per-division notional counts summed:
   TPP-by-division downloads 2004 on, statistics-pack HTPP tables before).
   fed.sen rides the House: control's Upper (2026-10-24): the IMPLIED
   Senate two-party from the committed ATL tallies, national and the eight
   states 2016–2025 – an estimate, never a count, and no classes (the
   Senate has no divisions). nswLc rides beside it as the Upper menu's one
   banked state council (2026-10-24, user "add it"): the implied NSW
   Legislative Council two-party from the committed NSWEC ballot record,
   2011–2023 – the same implied estimation, one jurisdiction's view.
   Guarded like the primary
   lane: a missing file drops the flip. */
const twoPPHistory = (() => {
  try {
    const { _comment, ...tp } = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "2pp-history.json"), "utf8"));
    return tp;
  } catch { return null; }
})();

/* ---- 7e. current primary = the 21-day nowcast, per party -----------------
   The reader-facing "current primary" is the headline construction itself –
   trailing 21d, 7d half-life, per-party house effects, sqrt-wave deflation –
   NOT the calendar month-to-date mean: early in a month that mean is a
   two-poll, shock-pure panel and runs points off every smoothed comparator
   in fast moves (2026-09-09 audit, .matilda/divergence-vs-bonham-bludger-2026-09.md,
   advisory A1). aggPrimary STAYS monthly – that series draws the charts and
   feeds the prediction history; this object is the point estimate the site
   quotes. The five-party check is aggPrimary's own, applied to the window:
   debiased per party, plain-window total alongside, renormalised only if the
   totals disagree by more than half a point. */
const primaryNowAt = (ref, skip = null) => {
  /* federal: the model's posterior mean at that day (today or a month ago,
     the days §2m drew); n is the polls in the 21 days to it */
  if (PRIMM && skip == null) {
    const day = pmDay(new Date(ref).toISOString()), a = PRIMM.at.get(day);
    if (!a) throw new Error(`primaryNowAt: the model drew no shares for ${new Date(ref).toISOString().slice(0, 10)}`);
    const out = Object.fromEntries(PRIMARY_KEYS.map((k) => [k, r1(a[k].v)]));
    const n = PRIMM.readings.filter((r) => r.day <= day && day - r.day <= HL_WINDOW).length;
    return { ...out, n, parties: {}, plainTotal: null, adjTotal: null, rescaled: false, model: true };
  }
  if (KF) {   // /vic/: each party's trend at that day (§1a); null before a party's first reading
    const per = KF_NOW.primary || {}, out = {};
    for (const k of PRIMARY_KEYS) {
      const kf = per[k], day = kfDay(ref);
      if (!kf || day < kf.t0) return null;
      out[k] = r1(kfAt(kf, day).mu);
    }
    return { ...out, n: Math.max(...PRIMARY_KEYS.map((k) => per[k].obs.length)), parties: {}, plainTotal: null, adjTotal: null, rescaled: false };
  }
  const rowsOf = (k) => (skip ? primaryRows[k].filter((r) => r.key !== skip) : primaryRows[k]);
  const win = (k) => rowsOf(k).filter((r) => { const d = ddays(ref, r.mid); return d >= 0 && d <= HL_WINDOW; });
  const adj = {}, parties = {};
  let plainTotal = 0, adjTotal = 0, n = 0;
  for (const k of PRIMARY_KEYS) {
    const rows = win(k);
    if (!rows.length) return null;
    const est = weightedWithSe(nowcastPts(rowsOf(k), primaryHE[k], ref));
    adj[k] = est.v;
    const plain = mean(rows.map((r) => r.x));
    parties[k] = { plain: r2(plain), adj: r2(est.v) };
    plainTotal += plain; adjTotal += est.v;
    n = Math.max(n, est.n);
  }
  const rescaled = Math.abs(adjTotal - plainTotal) > 0.5;
  const out = {};
  for (const k of PRIMARY_KEYS) out[k] = r1(rescaled ? adj[k] * (plainTotal / adjTotal) : adj[k]);
  return { ...out, n, parties, plainTotal, adjTotal, rescaled };
};
const primaryNow = primaryNowAt(refNow);
/* Each primary's month-on-month move, tested as the 2PP's is (synthChg,
   §7b): the party's nowcast now against the same thirty days earlier, two
   independent windows, the margin their root-sum-square. Unrescaled - the
   five-party renormalisation above is a display check, not a reading. The
   change log's findings read it (§8d); null on /vic/, whose lines are the
   Kalman trend. */
const primaryChg = KF ? null : PRIMM ? Object.fromEntries(PRIMARY_KEYS.map((k) => {
  const c = PRIMM.chg[k];
  return [k, { chg: c.chg, changeCi95: c.changeCi95, changeSig: c.changeSig, lo: c.lo, hi: c.hi, pUp: c.pUp }];
})) : Object.fromEntries(PRIMARY_KEYS.map((k) => {
  const nw = weightedWithSe(nowcastPts(primaryRows[k], primaryHE[k], refNow));
  const pv = weightedWithSe(nowcastPts(primaryRows[k], primaryHE[k], refNow - 30 * 86400000));
  if (!nw || !pv) return [k, null];
  const seChg = Math.sqrt(nw.se ** 2 + pv.se ** 2);
  return [k, { chg: r1(nw.v - pv.v), changeCi95: r1(1.96 * seChg), changeSig: Math.abs(nw.v - pv.v) > 1.96 * seChg }];
}));

/* The constants the Primary tab's ALL POLLSTERS menu recompute reads (the
   client engine in pv-agg.js): one emission, exactly the DEFF comment's
   rule, so the two engines can't drift apart. The client mirrors §2's
   construction (weightedWithSe/nowcastPts/monthWithSe/houseEffectsFor)
   over the emitted individualPolls - whose noAgg flag already bakes in
   every eligibility decision made above - fed the same rows. */
const aggSpec = { window: HL_WINDOW, half: HL_HALF, taper: HL_TAPER, deff: HL_DEFF,
                  sampleCap: SAMPLE_CAP, heWindow: HE_WINDOW, heHalf: HE_HALF, shrinkK: SHRINK_K,
                  // the leans panel's staleness cut (houseLean), which the flow editor re-draws
                  leanStaleDays: LEAN_STALE_DAYS };
/* the menu's ticks: every house that feeds the term's aggregates, in
   first-appearance order (a stopped house stays - its months still count) */
const pvHouses = [...new Set(POLLS.filter((p) => !noAggPoll(p)).map((p) => p.pollster))];
/* federal: what the menu's browser copy of the model (pm-engine.js, generated
   from primary-model.mjs) needs to re-run it on the ticked houses – the
   settings at their mode, each house's noise, the election-day prior, the
   jump days, the month days and the polls as the model reads them. With
   every house ticked the menu shows the build's own figures (latest.primary
   and prev, a month ago); a subset is the model at these settings. */
const primModel = PRIMM ? (() => {
  const S = PRIMM.fit.settings, th = pmUnpack(S.mode, PM_PARTIES.length, PRIMM.fit.ctx.prior.names);
  const an = PRIMM.fit.ctx.anchor;
  return { t0: PRIMM.t0, t1: PRIMM.t1, months: PRIMM.months.map((m) => [m.ym, m.day]), window: HL_WINDOW,
    th: { w: Array.from(th.w, (v) => +v.toPrecision(6)), ...Object.fromEntries(["d", "s", "J", "nu", "tau"].map((k) => [k, +th[k].toPrecision(6)])) },
    kappa: Object.fromEntries([...S.kappa].map(([h, k]) => [h, k])), anchor: { mean: Array.from(an.mean, (v) => +v.toPrecision(8)), cov: Array.from(an.cov, (v) => +v.toPrecision(8)) },
    jumps: PRIM_JUMPS.map(pmDay), minCore: 4,
    obs: PRIMM.readings.map((r) => [r.house, r.day, r2(r.n), r.step, r.cats, r.vals]),
    prev: Object.fromEntries(PRIMARY_KEYS.map((k) => [k, r1(PRIMM.prev[k].v)])),
    /* a state build's line has no One Nation before a poll printed it apart
       (aggPrimary's rule); a subset's line keeps the same day */
    onFirst: JUR && PRIMM.onFirst != null ? PRIMM.onFirst : null,
    /* and carries its line through a month with no poll (§2m's months) */
    carry: !!JUR };
})() : null;

/* ---- 7eb. each poll's footprint on the current primaries -----------------
   §3b's leave-one-out on the five-party nowcast, for the Primary tab's How it
   counts: the current primaries recomputed without the wave (the same rows,
   house effects and rescale rule - only the wave's own rows drop), beside
   the standing figures, identically rounded. Compact, as pyd: peff =
   { w: 1, <party>: [lo, hi] } for a wave inside the 21-day window, or
   { w: 0, t: { <party>: [lo, hi] } } for one outside it - the same pair read
   at the wave's own publication day (t absent where that day can't be
   estimated). /vic/: today's trend without the wave, rerun through each
   party's filter (every poll sits in the trend, so w is 1). */
const primEffByKey = (() => {
  const out = new Map();
  if (!primaryNow) return out;
  /* federal: every poll is in the model, so each has a footprint (w 1): the
     current primaries without the wave, through the smoother's
     cross-covariance (rank-one leave-one-out, settings at their mode) */
  if (PRIMM) {
    for (const r of PRIMM.readings) {
      const y = pmYard.get(r.key);
      if (!y) continue;
      const p = POLLS[r.idx], eff = { w: 1 };
      PRIMARY_KEYS.forEach((k, q) => { if (primaryVal(p, k) != null) eff[k] = [r1(primaryNow[k] - 100 * y.dNow[q]), primaryNow[k]]; });
      out.set(r.key, eff);
    }
    for (const [k, eff] of out) for (const [party, e] of Object.entries(eff)) {
      if (!Array.isArray(e)) continue;
      if (!Number.isFinite(e[0]) || Math.abs(e[1] - e[0]) > 4) throw new Error(`primary footprint out of range (${k} ${party}): ${JSON.stringify(e)}`);
    }
    return out;
  }
  const KFP = KF ? (KF_NOW.primary || {}) : null;
  const hiNow = primaryNow;
  for (const p of POLLS) {
    if (noAggPoll(p)) continue;
    const key = p.date + "|" + p.pollster;
    if (KF) {
      const eff = { w: 1 };
      for (const k of PRIMARY_KEYS) {
        const kf = KFP[k];
        if (!kf || !kf.obs.some((o) => o.key === key)) continue;
        const lo = kalmanRun(kf.obs.filter((o) => o.key !== key), { ...kf.opts, smooth: false }).final.mu;
        eff[k] = [r1(lo), r1(kf.final.mu)];
      }
      if (Object.keys(eff).length > 1) out.set(key, eff);
      continue;
    }
    const has = PRIMARY_KEYS.filter((k) => primaryRows[k].some((r) => r.key === key));
    if (!has.length) continue;
    const mid = primaryRows[has[0]].find((r) => r.key === key).mid;
    if (ddays(refNow, mid) >= 0 && ddays(refNow, mid) <= HL_WINDOW) {
      const lo = primaryNowAt(refNow, key);
      if (!lo) continue;
      const eff = { w: 1 };
      for (const k of has) eff[k] = [lo[k], hiNow[k]];
      out.set(key, eff);
    } else {
      /* outside today's window: the move it made on its own day, read with
         the rows that existed then (nowcastPts drops later ones) */
      const at = new Date(p.date).getTime();
      const hi = primaryNowAt(at), lo = primaryNowAt(at, key);
      const t = hi && lo ? Object.fromEntries(has.map((k) => [k, [lo[k], hi[k]]])) : null;
      out.set(key, { w: 0, ...(t ? { t } : {}) });
    }
  }
  // one wave moving a party's nowcast past four points is a bug in this file
  for (const [k, eff] of out) for (const [party, e] of Object.entries({ ...eff, ...(eff.t || {}) })) {
    if (!Array.isArray(e)) continue;
    if (!Number.isFinite(e[0]) || !Number.isFinite(e[1]) || Math.abs(e[1] - e[0]) > 4)
      throw new Error(`primary footprint out of range (${k} ${party}): ${JSON.stringify(e)}`);
  }
  return out;
})();
for (const r of individualPolls) {
  const e = primEffByKey.get(r.released + "|" + r.pollster);
  if (e) r.peff = e;
}

/* ---- 7g. the vote by group (age, gender, education, place, home) -------------

  Election marks for the By-state small multiples: each group's 2025 first
  preference result, per panel party in DEMO_KEYS order. From the AEC's
  per-state first-prefs-by-vote-type pages (event 31496,
  HouseStateFirstPrefsByPartyByVoteType-31496-<state>.htm); Coalition rows
  summed (Liberal + The Nationals; + Liberal National Party of Queensland in
  Qld, + Country Liberal in the NT). Non-NSW/Vic/Qld = national less
  NSW+Vic+Qld (the panel's non-eastern-mainland group pools SA/WA/Tas/ACT/NT;
  SA's and WA's marks come from their own state pages); the trio's is the
  TAS, ACT and NT pages vote-summed (763,586 formal votes; One Nation ran no
  ACT lower-house candidates). x is the
  election's mid-month mark, as aggPrimary's election row carries. Nat is
  the national share, so the All-voters line can be led back to its own
  election point in the guide tip (no ring - it draws no panel of its
  own). */
const DEMO_STATE_ELECTION = {

  /* polling day itself, where the all-voters ring sits: the group lines
     (§7gm) start in the election month, and a dotted lead-in joins them */
  x: JUR ? mx("2025-05") : dx(ELECTION.date),
  groups: {
    "Nat": [34.56, 31.82, 6.4, 12.2, 15.01],
    "NSW": [35.2, 31.53, 6.02, 11.06, 16.19],
    "Vic": [33.95, 32.2, 5.79, 13.59, 14.48],
    "Qld": [30.98, 34.91, 7.84, 11.76, 14.5],
    "SA": [38.31, 28.45, 6.15, 13.42, 13.68],
    "WA": [35.59, 31.55, 7.61, 11.97, 13.28],
    "ACT/NT/Tas": [40.95, 24.52, 3.97, 12.49, 18.07],
    "Non-NSW/Vic/Qld": [37.64, 29.01, 6.34, 12.55, 14.45],
  },
};

/* The same marks for the By-location lines: each classification's 2025
   first-preference result, computed from the AEC's 150 division pages
   (event 31496 HouseDivisionPage-*) summed over the divisions the divisional
   classifications page (HouseDivisionClassifications-31496-NAT) puts in
   each demographic class, party bucketing as the state marks'. Sums and
   bucket shares: .matilda/aec-loc-election.mjs; its national column
   reproduces the early-rounded Nat row [34.56, 31.82, 6.4, 12.2, 15.01]
   within 0.07, so Nat stays that official row for consistency with every
   other election display. Keys are the location set's group labels. */
const DEMO_LOC_ELECTION = {

  /* polling day itself, where the all-voters ring sits: the group lines
     (§7gm) start in the election month, and a dotted lead-in joins them */
  x: JUR ? mx("2025-05") : dx(ELECTION.date),
  groups: {
    "Nat": [34.56, 31.82, 6.4, 12.2, 15.01],
    "Inner metro": [38.35, 27.98, 3.49, 16.5, 13.68],
    "Outer metro": [39.28, 30.21, 6.18, 11.87, 12.45],
    "Provincial": [35.2, 32.6, 8.01, 11.22, 12.97],
    "Rural": [24.41, 37.68, 8.94, 8.41, 20.56],
  },
};

/* The Australian Election Study 2025 (ANU/Griffith; post-election
   self-completion survey, 2,070 respondents, GREG-weighted to the
   electorate): each group's House first preference at the 3 May 2025
   election, computed from the AES's own respondent file (ADA 100279,
   general release) by .build/extract-aes-2025.py into
   data/aes-2025-groups.json – weighted, out of formal first preferences,
   One Nation coded apart. The respondent file is the ADA's and is not
   committed; its header has the coding. Shares computed this way sit within
   about 1 point of the AES report's printed gender figures (Women
   36/28/17, report 36/28/18) and 0.5–2.5 points of a few of its generation
   figures (Millennials Labor 34.9, report 37) – the report's own vote
   variable and adjustment aren't published with the general file.
   Charts with a group the AES measures the same way get it: gender, age,
   generation, education, housing, work status. State and location keep the
   AEC's counted result instead.

   Election-time marks, as the By-state and By-location election rings are
   (user ruling 2026-11-02: plotted like a poll, kept out of the pools).
   Each point is placed as a poll dot is: the group's gap from the AES's own
   all-respondents figure, added to the 2025 result (DEMO_STATE_ELECTION's
   Nat row), so the survey's own lean drops out and the diamond sits on the
   lines' scale; the tip quotes the AES's share and the respondents behind
   it. Never in a pooled figure, a monthly line or §7gb's trend test: one
   recalled-vote survey at the head of a series would steer the slope tests
   by its method, not by any change. */
const DEMO_AES = (() => {
  if (JUR) return null;
  let src;
  try { src = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "aes-2025-groups.json"), "utf8")); }
  catch { return null; }
  const nat = DEMO_STATE_ELECTION.groups.Nat;
  const elec = Object.fromEntries(DEMO_KEYS.map((k, i) => [k, nat[i]]));
  const all = src.all;
  const sets = {};
  for (const [id, groups] of Object.entries(src.sets)) {
    sets[id] = { groups: Object.fromEntries(Object.entries(groups).map(([g, v]) => [g, {
      n: v.n,
      /* per party: [the AES's share, plotted y = the result + the gap from
         the AES's own figure, that gap's 95% margin (the extractor's
         gap_ci: GREG weights' effective n, group and rest independent)] -
         the margin is the baseline's own error wherever a figure is read
         "since the election" off it (rdPrimary's stat rows and faller,
         §7gb's election test) */
      ...Object.fromEntries(DEMO_KEYS.map((k) => [k, [v[k], r1(Math.max(0, elec[k] + (v[k] - all[k]))), v.ci ? v.ci[k] : null]])),
    }])) };
  }
  // all: the AES's own all-respondents shares, each group's gap measured from them
  // (DEMO_RESOLVE_BETA, below, is the same-house check §7gb's election test reads)
  return { x: DEMO_STATE_ELECTION.x, respondents: src.respondents, src: src.source, elec,
           all: Object.fromEntries(DEMO_KEYS.map((k) => [k, all[k]])), sets };
})();
/* Resolve's same-house differential swings since the election, from the
   seat model's vote layer (data/seat-vote-layer.json β: each age and gender
   cell's movement less the national, Resolve's recent waves against its
   2025-05-03 election-day wave, self-centred; party keys alp/lnp/on/grn/oth).
   The check §7gb's election test runs a claim against; null where the file
   is absent (a clone without the model's outputs builds the test without
   the check). */
const DEMO_RESOLVE_BETA = (() => {
  if (JUR) return null;
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, "data", "seat-vote-layer.json"), "utf8")).beta.dims; }
  catch { return null; }
})();
/* The polls at the election (user call 2026-11-03, after
   .build/analysis/group-poll-error-2025): each group's figure in the six
   weeks before the 3 May 2025 election, from the houses' own published
   tables (data/demographics-2025-election.json, written by
   .build/extract-demographics-2025-election.mjs from BludgerTrack's record
   of every release's crosstabs). It is built exactly as each group's
   current figure is:
   - every poll's gap from its own all-voters figure, pooled over the
     six-week window with the same recency and sample weights;
   - a house's repeat waves as sqrt(m), a pooled release read as its own
     waves;
   - but the window ends on election day, anchored on the 2025 result.
   "Since the election" is measured from this wherever a house cut the
   group before the election (gender, age, education, housing, work status,
   language at home), so both ends are the same instruments and a
   difference is movement. The AES (DEMO_AES) stays on the charts as its
   own reading. Before the election it differed from these polls by more
   than both margins on several gaps (Labor's and the Greens' gender gaps,
   the Coalition among the young and the retired), and the polls' readings
   held all term, so measured against the AES, part of the "change" was
   the two instruments. Generations keep the AES baseline: no house cut
   them before the election.
   A table that never printed One Nation (RedBridge's crosstabs) keeps it
   and others null, and its printed shares, already decided voters'
   percentages, are taken as printed rather than rescaled over three
   parties. Null on /vic/ and where the file is absent. */
/* ---- 7gm. the vote-by-group model (federal; group-span.mjs fitSpan) --------
   Each group's gap from all voters – the group's shares against the same
   poll's all-voters shares, on nested log-ratios, so the poll's lean on the
   level cancels as it always has – is ONE slow random walk from the group's
   first reading (the Australian Election Study 1987, the count 1993 for the
   states, 1996 for the AEC seat types) to today, so it has one value on each
   polling day, read from both sides of it. Each pollster has its own
   reading of the gap (a house that finds young voters greener than the
   others do), fixed while it keeps publishing the cut and shrunk to the
   average house's; the AES is one more house. Where the count cuts the
   group (each state's and each AEC seat type's result against the nation's)
   the gap is the counted one on polling day, and the polls' shared offset
   from the count is a walk of its own: measured at each election, carried
   into the term, drifting until the next count. The settings are shared by
   a set's groups and integrated over a grid.
   A group's figures are the all-voters figures moved by its gap, draw by
   draw: this term's from the national model (§2m), each past term's from
   its line as the vote charts draw it (§8v, through the counts), so a
   group's line meets the next term's on polling day and, where the count
   cuts the group, passes through the count. The readings: every crosstab
   of the past terms (data/group-history-waves.json, 2006–25, which holds
   the tables of the six weeks before the 2025 election too), this term's
   (§7g's: harmonize, pooled releases as their parts, models reusing waves
   left out), the AES at every election (data/aes-groups-history.json;
   2025 from its respondent file, data/aes-2025-groups.json) and the counts
   (data/group-counts.json from the AEC results in map/data; 2025 as the
   charts' own rings). */
const GROUP_INSTR = 1.5;
const GROUP_HOUSE = { "Resolve Strategic": "Resolve" };
const GROUP_SPAN = JUR || !PRIMM || !DEMOGRAPHICS || !Array.isArray(DEMOGRAPHICS.waves) ? null : (() => {
  const tStart = Date.now();
  const rdJ = (f) => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, "data", f), "utf8")); } catch { return null; } };
  const GHW = rdJ("group-history-waves.json"), AESH = rdJ("aes-groups-history.json"), AES25 = rdJ("aes-2025-groups.json"), CNT = rdJ("group-counts.json");
  const VHM = rdJ("vote-history-model.json");
  const vhmInput = (() => { try { return createHash("sha1").update(JSON.stringify({ e: D.elections, c: D.cyclePolls, b: D.cyclePollBases })).digest("hex").slice(0, 12); } catch { return null; } })();
  const vhmOK = !!(VHM && VHM.input === vhmInput && VHM.terms.some((t) => t.nest));
  if (!vhmOK) console.warn("group model: data/vote-history-model.json is stale or lacks the nested moments (run node .build/build-vote-history.mjs) – no past terms by group");
  const t0E = pmDay(ELECTION.date);
  const raw = [];
  const dayMid = (q) => Math.round((pmDay(q.dateStart || q.date) + pmDay(q.date)) / 2);
  const read = (src, set, group, house, g, t, reads) => {
    for (const r of reads) {
      const q = gapReading({ g, t, n: r.n * DEMO_SHARE[group], s: DEMO_SHARE[group] });
      if (q) raw.push({ src, set, group, house: GROUP_HOUSE[house] || house, day: r.day, ...q });
    }
  };
  const harmSets = (w, norm) => {
    const h = harmonize(w), out = [];
    for (const set of DEMO_SETS) for (const group of set.groups) { const g = h[set.id] && h[set.id][group] && norm(h[set.id][group]); if (g) out.push([set.id, group, g]); }
    return out;
  };
  const normE = (o) => (o && DEMO_KEYS.every((k) => o[k] != null) ? demoNorm(o) : o && o.alp != null ? demoNorm(o) : null);
  /* the past terms' crosstabs (to the 2025 election) */
  if (GHW) for (const w of GHW.waves) {
    if (!w.dims || !w.date || w.date >= ELECTION.date) continue;
    const tot = normE(w.total);
    if (!tot) continue;
    const reads = (w.parts && w.parts.length ? w.parts : [w]).map((q) => ({ day: dayMid(q.dateStart ? q : { date: q.date, dateStart: w.dateStart }), n: rowN({ sample: q.sample || w.sample }) / HL_DEFF }));
    for (const [setId, group, g] of harmSets(w, normE)) read("poll", setId, group, w.pollster, g, tot, reads);
  }
  /* this term's (§7g's reading) */
  for (const w of DEMOGRAPHICS.waves) {
    const p = demoPollOf(w), tot = demoTotalOf(w, p);
    if (!tot || (p && reusesWaves(p))) continue;
    const parts = isPooledRelease(w) ? pooledParts(p) : null;
    if (isPooledRelease(w) && !parts) continue;
    const r0 = p || w, n = rowN(p || { sample: w.sample });
    const reads = (parts || [r0]).map((q) => ({ day: dayMid(q), n: (parts ? rowN(q) : n) / HL_DEFF }));
    for (const [setId, group, g] of harmSets(w, demoNorm)) read("poll", setId, group, w.pollster, g, tot, reads);
    const inc = incomeStandardise(w.pollster, w.dims && w.dims.income, midMs(r0));
    if (inc) for (const b of INCOME_STD_BANDS) { const g = inc.shares[b.group] && demoNorm(inc.shares[b.group]); if (g) read("poll", "income", b.group, w.pollster, g, tot, reads); }
  }
  /* the AES at every election: each group against the AES's own total, on
     polling day (weighted samples: design effect ~1.5, else 1.2) */
  const aesYears = [];
  for (const [yr, A] of Object.entries((AESH && AESH.elections) || {})) {
    const useA = yr === "2025" && AES25 && AES25.all ? { ...AES25, weighted: true, date: ELECTION.date } : A;
    if (!useA || !useA.all || !useA.date) continue;
    const tot = useA.all, d = pmDay(useA.date);
    aesYears.push(yr);
    for (const set of DEMO_SETS) for (const group of set.groups) {
      const c = useA.sets && useA.sets[set.id] && useA.sets[set.id][group];
      if (!c || !(c.n >= 30)) continue;
      read("aes", set.id, group, "AES", c, tot, [{ day: d, n: c.n / (useA.weighted ? 1.5 : 1.2) / DEMO_SHARE[group] }]);
    }
  }
  /* the counts: each state's and AEC seat type's result against the
     nation's, on polling day; 2025 as the charts' rings (DEMO_*_ELECTION) */
  const asObj = (arr) => Object.fromEntries(DEMO_KEYS.map((k, i) => [k, arr[i]]));
  const counted = new Map();          // "set|group" → Map(election day → the group's counted shares)
  const addCount = (setId, group, day, g, t) => {
    const q = countReading(g, t);
    raw.push({ src: "count", set: setId, group, house: "Count", day, ...q });
    const k = setId + "|" + group; (counted.get(k) || counted.set(k, new Map()).get(k)).set(day, { g, t });
  };
  for (const [yr, E] of Object.entries((CNT && CNT.elections) || {})) {
    if (yr >= ELECTION.date.slice(0, 4)) continue;
    const d = pmDay(E.date), nat = asObj(E.Nat.pct);
    for (const setId of ["state", "location"]) for (const [group, c] of Object.entries(E[setId] || {})) addCount(setId, group, d, asObj(c.pct), nat);
  }
  for (const [Eg, setId] of [[DEMO_STATE_ELECTION, "state"], [DEMO_LOC_ELECTION, "location"]]) for (const [group, arr] of Object.entries(Eg.groups)) {
    if (group === "Nat" || !DEMO_SETS.some((st) => st.id === setId && st.groups.includes(group))) continue;
    addCount(setId, group, t0E, asObj(arr), asObj(Eg.groups.Nat));
  }
  /* the days asked for: this term's months (from the election month's
     middle) and today, and every past term's months and polling days */
  const { t1, months: monthsP, emDay } = PRIMM, P = PM_PARTIES.length;
  const emYm = ELECTION.date.slice(0, 7);
  const months = [{ ym: emYm, day: emDay }, ...monthsP.filter((m) => m.ym !== emYm)];
  const vhTerms = vhmOK ? VHM.terms.filter((t) => t.nest && t.days && t.days[1] <= t0E) : [];
  const days = [...new Set([...months.map((m) => m.day), t1, t0E, ...vhTerms.flatMap((t) => [...t.days, ...t.nest.map((r) => r[0])])])].sort((a, b) => a - b);
  /* this term's national draws on the nested scale */
  const natNest = new Map([...months.map((m) => m.day), t1].map((d) => {
    const sh = PRIMM.fit.shares(d), n = sh.length / P;
    return [d, Array.from({ length: n }, (_, i) => nestCoords(Array.from(sh.subarray(i * P, i * P + P))))];
  }));
  const resNest = nestCoords(nestCats(asObj(DEMO_STATE_ELECTION.groups.Nat), 4));
  const resSh = nestShares(resNest, 4);
  const lvlOf = (lanes) => 2 + (lanes.includes("grn") ? 1 : 0) + (lanes.includes("onp") ? 1 : 0);
  const keyIdx = (lanes) => { const L = lanes.filter((k) => k !== "tpp"); return DEMO_KEYS.map((k) => L.indexOf(k)); };
  /* a column's mean and 95% half-width, sorted once */
  const mci = (c) => { const s = Float64Array.from(c).sort(), q = (p) => { const i = (s.length - 1) * p, lo = Math.floor(i); return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (i - lo); }; return { v: pmMean(c), ci: (q(0.975) - q(0.025)) / 2 }; };
  const sumCols = (cols) => cols.map((c) => (c ? mci(c) : null));
  const NG = 600;
  const cur = new Map(), hist = new Map(), settings = {}, predErr = [];
  for (const setId of [...new Set(raw.map((r) => r.set))]) {
    const useMu = setId === "state" || setId === "location";
    const fit = fitSpan(raw.filter((r) => r.set === setId), { days, pair: [t0E, t1], useMu, predFrom: t0E });
    settings[setId] = fit.settings[0];
    for (const [group, g] of fit.groups) {
      for (const e of g.pred) predErr.push(...e);
      const rng = gsRng(20261125 + group.length * 7919 + setId.length);
      /* one set of gap draws per day and count, all four coordinates (a term
         drawing fewer parties apart reads the first of them), so the two
         terms meeting on a polling day read the very same draws there */
      const gdCache = new Map();
      const gapDraws = (d, n) => {
        const k = d + "|" + n;
        if (!gdCache.has(k)) { const mix = g.at.get(d); gdCache.set(k, mix ? drawMix(mix, n, gsRng(d * 31 + group.length * 7919 + setId.length), 4) : null); }
        return gdCache.get(k);
      };
      /* this term: the national model's draws moved by the gap's */
      const sumAt = (d, natFn, n) => {
        const gd = gapDraws(d, n);
        if (!gd) return null;
        const cols = PM_PARTIES.map(() => new Float64Array(gd.length));
        for (let i = 0; i < gd.length; i++) { const base = natFn(i), sh = nestShares(base.map((v, k) => v + gd[i][k]), 4); for (let q = 0; q < P; q++) cols[q][i] = 100 * sh[q]; }
        return Object.fromEntries(PM_PARTIES.map((k, q) => [k, mci(cols[q])]));
      };
      const firstTerm = Math.max(g.first, emDay);
      const nN = natNest.get(t1).length;
      const since = (() => {
        const pd = g.pair.length ? drawMix(g.pair, nN, rng, 8) : null;
        if (!pd) return null;
        const nd = natNest.get(t1), n = pd.length;
        const cols = PM_PARTIES.map(() => ({ gap: new Float64Array(n), lr: new Float64Array(n), g0: 0, g1: 0, a1: 0 }));
        for (let i = 0; i < n; i++) {
          const g0 = nestShares(resNest.map((v, k) => v + pd[i][k]), 4), g1 = nestShares(nd[i].map((v, k) => v + pd[i][4 + k]), 4), a1 = nestShares(nd[i], 4);
          for (let q = 0; q < P; q++) {
            const c = cols[q];
            c.gap[i] = 100 * ((g1[q] - a1[q]) - (g0[q] - resSh[q]));
            c.lr[i] = Math.log(g1[q] / a1[q]) - Math.log(g0[q] / resSh[q]);
            c.g0 += 100 * g0[q] / n; c.g1 += 100 * g1[q] / n; c.a1 += 100 * a1[q] / n;
          }
        }
        const sm = (a) => { const m = pmMean(a), lo = pmQuant(a, 0.025), hi = pmQuant(a, 0.975), sd = (hi - lo) / 3.92; return { v: m, lo, hi, z: sd > 0 ? m / sd : 0 }; };
        return Object.fromEntries(PM_PARTIES.map((k, q) => [k, { gap: sm(cols[q].gap), lr: sm(cols[q].lr), g0: cols[q].g0, g1: cols[q].g1, a0: 100 * resSh[q], a1: cols[q].a1 }]));
      })();
      /* where the count cuts the group, the polls' shared offset from it
         (μ), month by month, in points per party: what a poll's own reading
         of the group is moved by to sit on the line's footing (the dots) */
      const muOff = useMu ? months.filter((m) => m.day >= firstTerm - 15).map((m) => {
        const mix = g.at.get(m.day);
        if (!mix || !mix[0].mu) return null;
        const nd = natNest.get(m.day), nb = [0, 1, 2, 3].map((k) => nd.reduce((a, e) => a + e[k], 0) / nd.length);
        const gb = [0, 1, 2, 3].map((k) => mix.reduce((a, c) => a + c.w * c.m[k], 0)), mb = [0, 1, 2, 3].map((k) => mix.reduce((a, c) => a + c.w * c.mu[k], 0));
        const s0 = nestShares(nb.map((v, k) => v + gb[k]), 4), s1 = nestShares(nb.map((v, k) => v + gb[k] + mb[k]), 4);
        return [m.ym, ...DEMO_KEYS.map((k) => { const q = PM_PARTIES.indexOf(k); return r2(100 * (s1[q] - s0[q])); })];
      }).filter(Boolean) : null;
      cur.set(setId + "|" + group, {
        since, muOff,
        now: sumAt(t1, (i) => natNest.get(t1)[i], nN),
        election: g.first <= t0E ? sumAt(t0E, () => resNest, nN) : null,
        monthly: months.filter((m) => m.day >= firstTerm - 15).map((m) => ({ ym: m.ym, s: sumAt(m.day, (i) => natNest.get(m.day)[i], nN) })).filter((m) => m.s),
        sources: g.sources, houses: g.houses, beta: g.beta,
      });
      /* the past terms: each month's all-voters line (§8v's, drawn through
         the counts) moved by the gap, and both polling days on the counts */
      const cset = counted.get(setId + "|" + group) || new Map();
      /* a counted end whose term folds the Greens or One Nation into others
         (as the all-voters history does where its count lists the party):
         the folded party's own count, for the ring's centre dot */
      const incAt = (d, yr, lanes) => {
        const g0 = cset.has(d) ? cset.get(d).g : null, E = ELECTIONS["e" + yr];
        if (!g0 || !E) return null;
        const ks = ["grn", "onp"].filter((k) => !lanes.includes(k) && E[k] > 0 && g0[k] != null);
        return ks.length ? Object.fromEntries(ks.map((k) => [k, r1(g0[k])])) : null;
      };
      const terms = [];
      for (const t of vhTerms) {
        if (g.first > t.days[1]) continue;
        const lanes = t.lanes.filter((k) => k !== "tpp"), lev = lvlOf(lanes), ki = keyIdx(t.lanes);
        const row = (draws) => { const s = sumCols(lanes.map((_, q) => Float64Array.from(draws.map((sh) => 100 * sh[q])))); return [...ki.map((i) => (i < 0 ? null : r1(s[i].v))), ...ki.map((i) => (i < 0 ? null : r1(s[i].ci)))]; };
        const curEl = cur.get(setId + "|" + group).election;
        const end = (d, cnt) => {
          if (d < g.first) return null;
          /* the 2025 election: this term's polling-day estimate itself, so the
             two terms meet on one figure */
          if (d === t0E && lev === 4 && curEl) return [...DEMO_KEYS.map((k) => r1(curEl[k].v)), ...DEMO_KEYS.map((k) => r1(curEl[k].ci))];
          /* a counted polling day: the count itself, as the all-voters line
             ends on its own – the vote charts' count moved by the group's
             counted gap (like with like: the AEC's group against the AEC's
             nation), the band shut */
          if (cset.has(d)) {
            const { g: gc, t: tc } = cset.get(d);
            const fold = (o) => ({ alp: o.alp, lnp: o.lnp, grn: lanes.includes("grn") ? o.grn : null, onp: lanes.includes("onp") ? o.onp : null,
              oth: (o.oth || 0) + (lanes.includes("onp") ? 0 : o.onp || 0) + (lanes.includes("grn") ? 0 : o.grn || 0) });
            const nat = nestCoords(nestCats(Object.fromEntries(lanes.map((k) => [k, cnt[k]])), lev, 0.005));
            const zg = nestCoords(nestCats(fold(gc), lev, 0.05)), zt = nestCoords(nestCats(fold(tc), lev, 0.05));
            const sh = nestShares(nat.map((v, k) => v + zg[k] - zt[k]), lev);
            return [...ki.map((i) => (i < 0 ? null : r1(100 * sh[i]))), ...ki.map((i) => (i < 0 ? null : 0))];
          }
          const nat = nestCoords(nestCats(Object.fromEntries(lanes.map((k) => [k, cnt[k]])), lev, 0.005));
          const gd = gapDraws(d, NG);
          return gd ? row(gd.map((e) => nestShares(nat.map((v, k) => v + e[k]), lev))) : null;
        };
        const ms = [];
        t.nest.forEach((r, j) => {
          const d = r[0];
          if (d < g.first - 15) return;
          const m = r.slice(1, 1 + lev), C = new Float64Array(lev * lev);
          let u = 1 + lev;
          for (let a = 0; a < lev; a++) for (let b = a; b < lev; b++) { C[a * lev + b] = r[u]; C[b * lev + a] = r[u]; u++; }
          const gd = gapDraws(d, NG);
          if (!gd) return;
          const nd = drawMix([{ w: 1, m: Float64Array.from(m), C }], NG, rng, lev);
          ms.push([+t.series.alp[j][0].toFixed(3), ...row(gd.map((e, i) => nestShares(nd[i].map((v, k) => v + e[k]), lev)))]);
        });
        const open = end(t.days[0], t.open), close = end(t.days[1], t.close);
        if (ms.length + (open ? 1 : 0) + (close ? 1 : 0) < 2) continue;
        const inc = [incAt(t.days[0], t.year, lanes), incAt(t.days[1], t.src, lanes)];
        terms.push({ year: t.year, open, close, counted: [cset.has(t.days[0]), cset.has(t.days[1])], months: ms, ...(inc[0] || inc[1] ? { inc } : {}) });
      }
      if (terms.length) hist.set(setId + "|" + group, { terms, houses: g.houses, n: g.n });
    }
  }
  /* the one-step test (Info's "How it's built"): this term's polls, each
     predicted from the readings before it */
  const predMae = predErr.length ? predErr.reduce((a, b) => a + b, 0) / predErr.length : null;
  console.log(`group model one-step test: this term's polls' group figures missed by ${predMae == null ? "–" : predMae.toFixed(2)} points on average (${predErr.length} party figures)`);
  console.log(`group model: ${raw.length} readings (${raw.filter((r) => r.src === "aes").length} AES, ${raw.filter((r) => r.src === "count").length} counts), ${cur.size} groups, past terms for ${hist.size} in ${((Date.now() - tStart) / 1000).toFixed(1)}s | settings ${JSON.stringify(settings)}`);
  if (process.env.GS_DUMP) fs.writeFileSync(process.env.GS_DUMP, JSON.stringify({ cur: Object.fromEntries(cur), hist: Object.fromEntries(hist) }));
  return { cur, hist, vhTerms, aesYears };
})();
const GROUPM = GROUP_SPAN ? GROUP_SPAN.cur : null;
/* the past terms by group (§7gm), shipped as build.mjs's lazily fetched
   group-history file: per term its polling days and lanes, and per group
   each month's [x, Labor, Coalition, One Nation, Greens, others, then each
   one's 95% half-width] (null where the term folds the party into
   others), its two polling days the same way, and which of them the count
   cut (the line passes through a count there; elsewhere the polling-day
   figure is the model's estimate) */
const GROUP_HIST = GROUP_SPAN && GROUP_SPAN.hist.size ? (() => {
  const terms = GROUP_SPAN.vhTerms.map((t) => {
    const sets = {};
    for (const [key, h] of GROUP_SPAN.hist) {
      const T = h.terms.find((q) => q.year === t.year);
      if (!T) continue;
      const [setId, group] = key.split("|");
      (sets[setId] ||= {})[group] = { open: T.open, close: T.close, counted: T.counted, months: T.months, ...(T.inc ? { inc: T.inc } : {}) };
    }
    return { year: t.year, src: t.src, from: new Date(t.days[0] * 864e5).toISOString().slice(0, 10), to: new Date(t.days[1] * 864e5).toISOString().slice(0, 10),
             a: t.a, b: t.b, lanes: t.lanes.filter((k) => k !== "tpp"), sets };
  }).filter((t) => Object.keys(t.sets).length);
  return { _about: "Generated by gen-data §7gm (group-span.mjs) – each past term's primary vote by group: the vote charts' all-voters line (§8v) moved by the group's modelled gap from all voters; rows [x, alp, lnp, onp, grn, oth, then each one's 95% half-width].", aes: GROUP_SPAN.aesYears, terms };
})() : null;
const DEMO_ELECTION = (() => {
  if (JUR) return null;
  let src;
  try { src = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "demographics-2025-election.json"), "utf8")); }
  catch { return null; }
  const nat = DEMO_STATE_ELECTION.groups.Nat;
  const ELEC = Object.fromEntries(DEMO_KEYS.map((k, i) => [k, nat[i]]));
  const ELEC_T = total(ELEC);
  const ref = Date.parse(src.election + "T00:00:00Z");
  const norm = (s) => (s && DEMO_KEYS.every((k) => s[k] != null) ? demoNorm(s) : s);
  const rows = {};
  for (const w of src.waves) {
    const tot = norm(w.total);
    if (!tot) continue;
    // a pooled release reads as its own waves, each at its own dates and sample
    const reads = (w.parts || [w]).map((q) => ({ mid: midMs(q), n: rowN(q) }));
    const h = harmonize(w);
    for (const set of DEMO_SETS) for (const group of set.groups) {
      const g = h[set.id] && h[set.id][group] && norm(h[set.id][group]);
      if (!g) continue;
      for (const { mid, n } of reads) for (const k of DEMO_KEYS) {
        if (g[k] == null || tot[k] == null) continue;
        (rows[set.id + "|" + group + "|" + k] ||= []).push({ mid, x: ELEC[k] + (g[k] - tot[k]), n: n * DEMO_SHARE[group], firm: w.pollster, rel: w.date });
      }
    }
  }
  const inW = (r) => { const d = ddays(ref, r.mid); return d >= 0 && d <= SPARSE_K.window; };
  const sets = {};
  for (const set of DEMO_SETS) for (const group of set.groups) {
    const key = (k) => set.id + "|" + group + "|" + k;
    const est = Object.fromEntries(DEMO_KEYS.map((k) => [k, weightedWithSe(nowcastPts(rows[key(k)] || [], null, ref, SPARSE_K))]));
    if (DEMO_KEYS.some((k) => !est[k])) continue;
    const raw = Object.fromEntries(DEMO_KEYS.map((k) => [k, Math.max(0, est[k].v)]));
    const t = DEMO_KEYS.reduce((a, k) => a + raw[k], 0);
    // polls, not rows: a pooled release's waves count once
    const inRows = (rows[key("alp")] || []).filter(inW);
    /* federal: the group model's figure on election day (the count moved by
       the group's gap then), its 95% interval as the margin */
    const gm = GROUPM && GROUPM.get(set.id + "|" + group), ge = gm && gm.election;
    (sets[set.id] ||= { groups: {} }).groups[group] = {
      n: new Set(inRows.map((r) => r.firm + "|" + r.rel)).size,
      houses: [...new Set(inRows.map((r) => r.firm))],

      /* per party: [the group's figure on the result's scale (the 2025
         result plus the pooled gap: where the chart marks it), its 95%
         margin] - the gap itself is the first less elec */
      ...Object.fromEntries(DEMO_KEYS.map((k) => [k, [r1(ELEC_T * raw[k] / t), r1(1.96 * est[k].se)]])),
      ...(ge ? Object.fromEntries(DEMO_KEYS.map((k) => [k, [r1(ELEC_T * ge[k].v / 100), r1(ge[k].ci)]])) : {}),
      ...(ge ? { model: true } : {}),
    };
  }
  if (!Object.keys(sets).length) return null;
  return { x: DEMO_STATE_ELECTION.x, window: SPARSE_K.label, src: src.source, elec: ELEC, sets, ...(GROUPM ? { model: true } : {}) };
})();
/* How each group voted at the 2025 election: ONE estimate from the two
   election-time readings (user call 2026-11-10: "proceed as you recommend").
   No ballot records a voter's age or sex, so the polls before the election
   (DEMO_ELECTION) and the Australian Election Study after it (DEMO_AES) are
   each an instrument, and neither is the truth. Where the count does settle
   it - each state's and each AEC region class's gap from the nation, 37
   cells - the two missed by about the same amount beyond their sampling
   error (polls 1.7 points a cell, the AES 1.6), their misses were unrelated
   (r +0.08), and a weighted mean beat either alone (typical miss 1.7 points,
   against the polls' 2.3 and the AES's 3.1). On the demographic cells the
   two disagree beyond sampling by the same 2.2 points as on the counted
   cells. At 2013-2022 (76 state cells, backtest-2013-22.py) the mean again
   beat both: 2.0 points against the polls' 2.5 and the AES's 2.8.
   (.build/analysis/group-poll-error-2025/combine-test.py and README s6.)
   So each cell is the 2025 result plus a weighted mean of the two GAPS from
   all voters - a gap, because each source's own miss on the level cancels
   in it and the count supplies the level exactly:
   - each source's weight is 1 / (its sampling variance + DEMO_INSTR²), the
     instrument error counted once for each, which leaves the polls about
     60-65% and the AES 35-40%;
   - a group only one source cut (the generations: AES; language at home:
     polls) keeps that source, its margin widened by the same DEMO_INSTR;
   - an AES cell resting on fewer than DEMO_VOTE_MIN respondents for the
     party (One Nation in most groups: 38 in the whole file) sits out where
     the polls cut the group - its binomial margin at a share near zero is
     too narrow to weigh by.
   A group is then taken to the result's total, as DEMO_ELECTION's is.
   This is the mark the charts draw at the election. It is NOT what "since
   the election" is measured from: that stays the polls' own reading
   (DEMO_ELECTION; the AES for generations), the same instruments at both
   ends - measured from this, about 40% of the two instruments' difference
   would read as change. Per party: [the estimate, its 95% margin, the
   polls' figure or null, the AES's or null - both on the result's scale]. */
const DEMO_INSTR = GROUP_INSTR;
const DEMO_VOTE_MIN = 10;
const DEMO_VOTE = (() => {
  if (!DEMO_ELECTION && !DEMO_AES) return null;
  const E = DEMO_ELECTION || DEMO_AES;
  const ELEC = E.elec, ELEC_T = total(ELEC), T2 = DEMO_INSTR * DEMO_INSTR;
  const sets = {};
  for (const set of DEMO_SETS) for (const group of set.groups) {
    const pg = DEMO_ELECTION && DEMO_ELECTION.sets[set.id] && DEMO_ELECTION.sets[set.id].groups[group];
    const ag = DEMO_AES && DEMO_AES.sets[set.id] && DEMO_AES.sets[set.id].groups[group];
    if (!pg && !ag) continue;
    const cell = {}; let both = false;
    for (const k of DEMO_KEYS) {
      const p = pg && pg[k], a = ag && ag[k] && ag[k][2] != null ? ag[k] : null;
      const aUse = a && !(p && ag.n * a[0] / 100 < DEMO_VOTE_MIN);
      const parts = [];
      if (p) parts.push([p[0] - ELEC[k], (p[1] / 1.96) ** 2 + T2]);
      if (aUse) parts.push([a[0] - DEMO_AES.all[k], (a[2] / 1.96) ** 2 + T2]);
      if (!parts.length) { cell[k] = null; continue; }
      if (parts.length === 2) both = true;
      const w = parts.reduce((s, q) => s + 1 / q[1], 0);
      cell[k] = { v: Math.max(0, ELEC[k] + parts.reduce((s, q) => s + q[0] / q[1], 0) / w), ci: 1.96 * Math.sqrt(1 / w),
                  p: p ? p[0] : null, a: aUse ? a[1] : null };
    }
    if (DEMO_KEYS.some((k) => !cell[k])) continue;
    const t = DEMO_KEYS.reduce((s, k) => s + cell[k].v, 0);
    (sets[set.id] ||= { groups: {} }).groups[group] = {
      src: both ? "both" : pg ? "polls" : "aes",
      polls: pg ? { n: pg.n, houses: pg.houses } : null, aesN: ag ? ag.n : null,
      ...Object.fromEntries(DEMO_KEYS.map((k) => [k, [r1(ELEC_T * cell[k].v / t), r1(cell[k].ci), cell[k].p, cell[k].a]])),
    };
  }
  if (!Object.keys(sets).length) return null;
  /* federal: the mark is the group model's estimate for polling day (§7gm),
     which already weighs the polls before and after it, the AES and the
     count; the polls' and the AES's own figures stay on the tip */
  if (GROUPM) for (const [setId, st] of Object.entries(sets)) for (const [group, cell] of Object.entries(st.groups)) {
    const gm = GROUPM.get(setId + "|" + group), ge = gm && gm.election;
    if (!ge) continue;
    for (const k of DEMO_KEYS) if (cell[k]) cell[k] = [r1(ELEC_T * ge[k].v / 100), r1(ge[k].ci), cell[k][2], cell[k][3]];
    cell.model = true;
  }
  return { x: E.x, elec: ELEC, instr: DEMO_INSTR, aesSrc: DEMO_AES ? DEMO_AES.src : null, sets, ...(GROUPM ? { model: true } : {}) };
})();

/* One figure per group and party, built as the headline is. Each poll says
   how far a group sits from that poll's own all-voters figure – One Nation
   ten points lower among 18–34s, say. Those gaps are pooled over the six-week
   window (recency- and sample-weighted, a house's repeat waves as sqrt(m);
   about one poll a week per group, so the headline's three weeks would often
   hold one poll or none) and added to the current primaries (§7e). Measuring
   each poll against its own total removes its house lean exactly – a
   group-level house effect could never be estimated from four houses – and
   puts every group on the level of the figures the site quotes. Groups pool
   only where the houses cut the population the same way (demo-groups.mjs).
   The panel's charts carry each group's MONTHLY line too, built as every
   monthly line here is (monthWithSe: sample-weighted, repeat waves as
   sqrt(m)), each month's pooled gaps added to that month's aggregate
   primaries – so a group's line sits against the all-voters line the way its
   current figure sits against the current primaries.
   The anchor is the quoted set exactly as quoted, never rescaled to 100. §7e
   and aggPrimary deliberately leave a set short of 100 (99.7, say) unless
   the house adjustment drifts, and rescaling it here read +0.1 on the
   biggest parties: an all-voters row billed as the headline's own figure
   that didn't match the hero. A poll's gaps sum to zero (its group and its
   total are both taken to 100 first), so each group sums to its anchor's
   total; a group is rescaled only when a share is clamped at zero, and then
   to that total. */
/* A pooled release (isPooledRelease, §5c) joins as the waves it pooled
   (pooledParts): each part's rows carry the release's gaps at the part's
   own mid-date and month, sized as that wave (rowN), so
   the window takes in only the parts inside it and each month's line only
   that month's parts – the house's repeat-wave sqrt(m) then counts them as
   the separate waves they were. The parts are still one poll to a reader:
   the rug draws one dot per release (its in-window parts' samples summed)
   and the group's poll count counts it once. A long wave without parts
   sits out, as every pooled wave did before 2026-10-11. */
// set|group -> the monthly rows §7gb tests (§7g's rowsT), never emitted
const DEMO_TEST_MONTHLY = new Map();
/* §7g-income's standardiser: a wave's income dim becomes standardised
   band shares by fitting, per party, a vote-share line over the
   quantile axis through the house's printed brackets (INCOME_GRIDS,
   mapped to quantiles via the census histograms), and reading it at
   INCOME_STD_BANDS' midpoints. The 8acacb93 naive design pooled each
   house's lowest and highest BRACKETS directly – YouGov's ~66% of
   households and DemosAU's ~46% of persons were pooled as if the same
   group of people, and the pooled bias drifted with the window's house
   mix. Here every house's brackets meet on the quantile axis instead,
   and every wave reads at the SAME two bands of the electorate.
   Each wave's dollars deflate to census dollars at the wage level of its
   own fieldwork midpoint (ms). Only INCOME_POOL_BASES houses standardise
   (both bases today): a wave of another basis returns null, so it joins no
   pool, fills no group-view slot and leaves the roster.
   Standard for one wave and group, or null (another basis, no grid variant
   the wave printed at least two cells of, or no census distribution). */
function incomeStandardise(house, dim, ms) {
  if (!dim || !INCOME_DIST || !INCOME_GRIDS[house] || !INCOME_POOL_BASES.includes(INCOME_GRIDS[house].basis)) return null;
  const variants = incomeQuantiles(house, INCOME_DIST, ms);
  if (!variants) return null;
  /* the era's own layout: the variant the wave printed the most cells
     of – eras never share keys, so the match is unambiguous */
  const fitted = variants
    .map((v) => ({ fit: incomeFit(v.cells, dim), cells: v.cells, present: v.cells.filter((c) => dim[c.key]) }))
    .filter((x) => x.fit)
    .sort((a, b) => b.present.length - a.present.length)[0];
  if (!fitted) return null;
  const shares = {};
  for (const { group, lo, hi } of INCOME_STD_BANDS) {
    const mid = (lo + hi) / 2, sh = {};
    for (const k of DEMO_KEYS) {
      const f = fitted.fit.fits[k], sup = fitted.fit.support[k];
      /* a standard band outside the printed cells' support is never
         extrapolated (a partial YouGov row holding only its top two
         brackets reads nothing at the lower band) */
      if (f && sup && mid >= sup[0] && mid <= sup[1]) sh[k] = f.a + f.b * mid;
    }
    if (Object.keys(sh).length) shares[group] = sh;
  }
  if (!Object.keys(shares).length) return null;
  const inCells = fitted.cells.filter((c) => dim[c.key]);
  return { shares, band: [inCells[0].key, inCells[inCells.length - 1].key] };
}
// pooling machinery for §7g and §7g-income: one builder, two row stores
function demoBuild(rows, rowsM, setsSpec, allbyYm, ALL, ALL_T, SPARSE, SHARES) {
  const housesIn = (rs) => [...new Set(rs.filter((r) => { const d = ddays(refNow, r.mid); return d >= 0 && d <= SPARSE.window; }).map((r) => r.firm))];
  const inW = (r) => { const d = ddays(refNow, r.mid); return d >= 0 && d <= SPARSE.window; };
  return setsSpec.map((set) => {
    const groups = set.groups.map((group) => {
      const key = (k) => set.id + "|" + group + "|" + k;
      const est = Object.fromEntries(DEMO_KEYS.map((k) => [k, weightedWithSe(nowcastPts(rows[key(k)] || [], null, refNow, SPARSE))]));
      if (DEMO_KEYS.some((k) => !est[k])) return null;
      const raw = Object.fromEntries(DEMO_KEYS.map((k) => [k, Math.max(0, est[k].v)]));
      const t = DEMO_KEYS.reduce((a, k) => a + raw[k], 0);
      /* [ym, …shares in DEMO_KEYS order, …each share's 95% margin in the same
         order], months the group was polled in. The margin is monthWithSe's,
         the interval every monthly line on the site is drawn with – a month
         resting on one poll shows its sampling floor – scaled as its share
         is. The panel draws it as the band around the group's line. */
      const monthlyOf = (rs) => MONTHS.map((ym) => {
        const m = DEMO_KEYS.map((k) => monthWithSe(rs[key(k)] || [], null, ym));
        if (m.some((e) => !e)) return null;
        const mv = m.map((e) => Math.max(0, e.v)), mt = mv.reduce((a, b) => a + b, 0);
        const T = total(allbyYm.get(ym));
        return [ym, ...mv.map((v) => r1(T * v / mt)), ...m.map((e) => r1(1.96 * e.se * T / mt))];
      }).filter(Boolean);
      const monthly = monthlyOf(rowsM);
      /* the rug above the group's whisker: each wave the window holds, with
         its own reading on the display scale. The px arrays are rebuilt off
         the alp-anchored win list by wave identity (firm|release) – a wave
         that printed no such party leaves a null where its dot would be
         (WvRug draws none; before the fold case existed each key's rows
         were identical and this map was a straight filter/sort). The wave's
         release date rides each pd entry so the panel can key the dot back
         to its poll row (AP.pollRowKey) and open the poll on click. */
      const wId = (r) => r.firm + "|" + r.rel;
      // a pooled release's parts are one poll here: one dot, their samples summed
      const win = [...(rows[key("alp")] || []).filter(inW).sort((a, b) => a.mid - b.mid)
        .reduce((m, r) => { const e = m.get(wId(r)); if (e) e.n += r.n; else m.set(wId(r), { ...r }); return m; }, new Map()).values()];
      const pd = win.map((r) => ({ f: r.firm, l: r.lab, n: Math.round(r.n), r: r.rel }));
      const px = Object.fromEntries(DEMO_KEYS.map((k) => {
        const byW = new Map((rows[key(k)] || []).filter(inW).map((r) => [wId(r), r.x]));
        return [k, win.map((r) => { const x = byW.get(wId(r)); return x == null ? null : r1(ALL_T * x / t); })];
      }));
      /* federal: the group model's figures (§7gm) – today's, on the quoted
         total, with their 95% intervals, and its monthly line – in place
         of the pooled window's; the window still decides which groups show
         and feeds the credits and the rug */
      const gm = GROUPM && GROUPM.get(set.id + "|" + group);
      if (gm && gm.now) return {
        label: group,
        v: Object.fromEntries(DEMO_KEYS.map((k) => [k, r1(ALL_T * gm.now[k].v / 100)])),
        ci: Object.fromEntries(DEMO_KEYS.map((k) => [k, r1(gm.now[k].ci)])),
        n: win.length, houses: housesIn(rows[key("alp")] || []),
        monthly: gm.monthly.map(({ ym, s }) => {
          const T = total(allbyYm.get(ym) || ALL);
          return [ym, ...DEMO_KEYS.map((k) => r1(T * s[k].v / 100)), ...DEMO_KEYS.map((k) => r1(s[k].ci))];
        }),
        /* polling day itself (the model's estimate; on the count where the
           count cuts the group), where the line starts – the past term's
           line ends on the same figure – and, where the count cuts the
           group, the polls' shared offset from it each month (muOff) */
        ...(gm.election ? { el: [...DEMO_KEYS.map((k) => r1(gm.election[k].v)), ...DEMO_KEYS.map((k) => r1(gm.election[k].ci))] } : {}),
        ...(gm.muOff ? { mo: gm.muOff } : {}),
        /* the rug's readings (each wave's gap on today's all-voters figure),
           where the count cuts the group moved by today's offset of the
           polls from it, so they sit about the figure they feed */
        pd, px: gm.muOff && gm.muOff.length ? (() => { const off = gm.muOff[gm.muOff.length - 1]; return Object.fromEntries(DEMO_KEYS.map((k, j) => [k, px[k].map((x) => (x == null ? null : r1(x - off[1 + j])))])); })() : px,
        share: DEMO_SHARE[group], model: true,
      };
      return {
        label: group,
        v: Object.fromEntries(DEMO_KEYS.map((k) => [k, r1(ALL_T * raw[k] / t)])),
        ci: Object.fromEntries(DEMO_KEYS.map((k) => [k, r1(1.96 * est[k].se)])),
        // polls, not rows: a pooled release's parts count once
        n: win.length, houses: housesIn(rows[key("alp")] || []), monthly,
        pd, px,
        /* the group's rough share of adults (demo-groups' DEMO_SHARE): the
           panel's headline ranks its claims by how far each moves the make-up
           of a party's voters from the electorate's, share x (group ÷ all − 1) */
        share: DEMO_SHARE[group],
      };
    }).filter(Boolean);
    return { tab: set.tab, id: set.id, label: set.label, groups,
             houses: [...new Set(groups.flatMap((g) => g.houses))] };
  }).filter((s) => s.groups.length);
}

const { demo: demographics, income: demoIncome } = (() => {
  const waves = Array.isArray(DEMOGRAPHICS?.waves) ? DEMOGRAPHICS.waves : [];
  if (!waves.length || !primaryNow) return { demo: null, income: null };
  const pick = (s) => Object.fromEntries(DEMO_KEYS.map((k) => [k, s[k]]));
  const ALL = pick(primaryNow), ALL_T = total(ALL);
  // each month's aggregate primaries as the primary chart draws them (the monthly anchor)
  const allByYm = new Map(aggPrimary.filter((d) => !d.election).map((d) => [d.ym, pick(d)]));
  const rows = {};                                // "set|group|party" -> nowcast rows
  const rowsM = {};                               // … -> monthly rows, anchored on each month's primaries
  const rowsT = {};                               // … -> the same for §7gb's trend test (a pooled release once)
  // the income tab's rows: "income|<Lower|Higher> earners|<party>" under its
  // own stores; iRowsT is §7gb's trend-test variant (a pooled release ONCE)
  const iRows = {}, iRowsM = {}, iRowsT = {};
  const inWindow = [];                            // the waves the window holds, for the credits
  const incInWindow = [];                         // the income tab's own, keeping the shares apart
  const ageEst = new Map();                       // house -> the age groups its in-window waves had read, not printed
  for (const w of waves) {
    const p = demoPollOf(w), tot = demoTotalOf(w, p);
    if (!tot) continue;
    // a model reusing the house's own waves' respondents (reusesWaves) sits out
    if (p && reusesWaves(p)) continue;
    const r0 = p || w, n = rowN(p || { sample: w.sample });
    // a pooled release reads as its parts; one without parts sits out
    const parts = isPooledRelease(w) ? pooledParts(p) : null;
    if (isPooledRelease(w) && !parts) continue;
    const reads = (parts || [r0]).map((q) => ({ mid: midMs(q), ym: ymOf(q.date), n: parts ? rowN(q) : n }));
    const h = harmonize(w);
    // the fieldwork label the Who-votes rug cites for each dot's poll
    const lab = fwLabel(r0.dateStart, r0.date);
    let used = false;
    for (const set of DEMO_SETS) for (const group of set.groups) {
      const g = h[set.id] && h[set.id][group] && demoNorm(h[set.id][group]);
      if (!g) continue;
      used = true;
      for (const { mid, ym, n } of reads) {
        const M = allByYm.get(ym);
        for (const k of DEMO_KEYS) {
          // a party the wave never printed contributes nothing – the fold
          // of its Others is not a zero share of the unprinted party
          if (g[k] == null || tot[k] == null) continue;
          (rows[set.id + "|" + group + "|" + k] ||= []).push({ mid, x: ALL[k] + (g[k] - tot[k]), n: n * DEMO_SHARE[group], firm: w.pollster, lab, rel: r0.date });
          if (M) (rowsM[set.id + "|" + group + "|" + k] ||= []).push({ ym, mid, x: M[k] + (g[k] - tot[k]), n: n * DEMO_SHARE[group], firm: w.pollster });
        }
      }
      /* the trend test's rows: a wave as above, but a pooled release ONCE,
         in its midpoint's month with its parts' samples summed. Spread over
         its parts, one quarterly gap fills three or four months with the
         same figure, and §7gb's t-tests – slope against the months' own
         scatter, months − 2 degrees of freedom – read that as several
         readings that happen to agree (Newspoll's Q3-2025 University gap
         alone carried a Labor "move" at t 3.1 on 2026-10-11 data, every
         other house flat) */
      const one = parts ? { mid: midMs(r0), ym: ymOf(new Date(midMs(r0)).toISOString()), n: reads.reduce((a, r) => a + r.n, 0) } : reads[0];
      const MT = allByYm.get(one.ym);
      if (MT) for (const k of DEMO_KEYS) {
        if (g[k] == null || tot[k] == null) continue;
        (rowsT[set.id + "|" + group + "|" + k] ||= []).push({ ym: one.ym, mid: one.mid, x: MT[k] + (g[k] - tot[k]), n: one.n * DEMO_SHARE[group], firm: w.pollster });
      }
    }
    /* the wave's standardised income bands, beside the harmonized groups
       (never the SAME shared rows maps: an income wave feeds no common-
       group pool, nor would a common-group wave accidentally feed the
       income tab). incomeStandardise fits the wave's printed brackets
       and reads them at the standard bands; a wave whose layout fits
       nothing (single-cell partials, no grid variant) joins nothing. */
    const inc = incomeStandardise(w.pollster, w.dims && w.dims.income, midMs(r0));
    let iUsed = false;
    if (inc) {
      for (const { group: grp } of INCOME_STD_BANDS) {
        const g = inc.shares[grp] && demoNorm(inc.shares[grp]);
        if (!g) continue;
        iUsed = true;
        for (const { mid, ym, n } of reads) {
          for (const k of DEMO_KEYS) {
            if (g[k] == null || tot[k] == null) continue;
            (iRows["income|" + grp + "|" + k] ||= []).push({ mid, x: ALL[k] + (g[k] - tot[k]), n: n * DEMO_SHARE[grp], firm: w.pollster, lab, rel: r0.date });
            const M = allByYm.get(ym);
            if (M) (iRowsM["income|" + grp + "|" + k] ||= []).push({ ym, mid, x: M[k] + (g[k] - tot[k]), n: n * DEMO_SHARE[grp], firm: w.pollster });
          }
        }
        /* the trend test's income rows: as rowsT above, a pooled release
           ONCE in its midpoint's month with its parts' samples summed –
           Newspoll's quarterly income table spread over its parts would
           read as three or four months that happen to agree */
        const one = parts ? { mid: midMs(r0), ym: ymOf(new Date(midMs(r0)).toISOString()), n: reads.reduce((a, r) => a + r.n, 0) } : reads[0];
        const MT = allByYm.get(one.ym);
        if (MT) for (const k of DEMO_KEYS) {
          if (g[k] == null || tot[k] == null) continue;
          (iRowsT["income|" + grp + "|" + k] ||= []).push({ ym: one.ym, mid: one.mid, x: MT[k] + (g[k] - tot[k]), n: one.n * DEMO_SHARE[grp], firm: w.pollster });
        }
      }
    }
    // in the window when any part is; ranked by its newest
    const ds = reads.map((r) => ddays(refNow, r.mid)).filter((d) => d >= 0 && d <= SPARSE_K.window);
    if (used && ds.length) inWindow.push({ w, p, d: Math.min(...ds) });
    /* §7g-age: a house whose age groups in the window are read off its own
       bands, and which groups – the Age tab's dek says whose are estimates */
    const agR = used && ds.length ? ageStandardise(w.dims && w.dims.age, AGE_DIST) : null;
    if (agR) for (const g of agR.read) if (h.age && h.age[g]) (ageEst.get(w.pollster) || ageEst.set(w.pollster, new Set()).get(w.pollster)).add(g);
    if (iUsed && ds.length) incInWindow.push({ w, p, d: Math.min(...ds), band: inc ? inc.band : null });
  }
  const sets = demoBuild(rows, rowsM, DEMO_SETS.map((s) => ({ tab: s.tab, id: s.id, label: s.label, groups: s.groups })), allByYm, ALL, ALL_T, SPARSE_K, DEMO_SHARE);
  // the trend test's months (rowsT for the harmonised sets, iRowsT for the
  // income bands), kept off the page
  const testMonthly = (rowsTg) => MONTHS.map((ym) => {
    const m = DEMO_KEYS.map((k) => monthWithSe(rowsTg[k] || [], null, ym));
    if (m.some((e) => !e)) return null;
    const mv = m.map((e) => Math.max(0, e.v)), mt = mv.reduce((a, b) => a + b, 0);
    const anchor = allByYm.get(ym) || {};
    const T = DEMO_KEYS.reduce((a, k) => a + (anchor[k] || 0), 0);
    return [ym, ...mv.map((v) => r1(T * v / mt)), ...m.map((e) => r1(1.96 * e.se * T / mt))];
  }).filter(Boolean);
  for (const set of DEMO_SETS) for (const group of set.groups) {
    const rowsTg = Object.fromEntries(DEMO_KEYS.map((k) => [k, rowsT[set.id + "|" + group + "|" + k] || []]));
    DEMO_TEST_MONTHLY.set(set.id + "|" + group, testMonthly(rowsTg));
  }
  for (const { group: grp } of INCOME_STD_BANDS) {
    const rowsTg = Object.fromEntries(DEMO_KEYS.map((k) => [k, iRowsT["income|" + grp + "|" + k] || []]));
    DEMO_TEST_MONTHLY.set("income|" + grp, testMonthly(rowsTg));
  }
  /* the age set's estimated figures: the houses in pooling order, the
     groups in the set's own order */
  const ageSet = sets.find((s) => s.id === "age");
  if (ageSet && ageEst.size) ageSet.est = {
    houses: ageSet.houses.filter((h) => ageEst.has(h)),
    groups: ageSet.groups.map((g) => g.label).filter((g) => [...ageEst.values()].some((x) => x.has(g))),
  };
  const tabs = DEMO_TABS.map((t) => ({ ...t, sets: sets.filter((s) => s.tab === t.id).map(({ tab, ...s }) => s) }))
    .filter((t) => t.sets.length);
  if (!tabs.length) return { demo: null, income: null };
  inWindow.sort((a, b) => a.d - b.d);
  incInWindow.sort((a, b) => a.d - b.d);
  const demo = {
    all: Object.fromEntries(DEMO_KEYS.map((k) => [k, r1(ALL[k])])),
    // the monthly lines' party order, and the all-voters line they sit against
    order: DEMO_KEYS,
    allMonthly: [...allByYm.entries()].map(([ym, a]) => [ym, ...DEMO_KEYS.map((k) => r1(a[k]))]),
    window: SPARSE_K.label, tabs, ...(GROUPM ? { model: true } : {}),
    /* every house that has ever fed each group (any party's rows, so a
       One-Nation-less fold still counts), most waves first – the Info
       entry's "which pollsters count where", derived so it can't drift from
       the pooling again. Per set, groups fed by the same houses share a line. */
    roster: tabs.flatMap((t) => t.sets.map((s) => {
      const lines = [];
      for (const g of s.groups) {
        const cnt = new Map();
        for (const k of DEMO_KEYS) for (const r of rows[s.id + "|" + g.label + "|" + k] || []) {
          const c = cnt.get(r.firm) || new Set();
          cnt.set(r.firm, c.add(r.rel));
        }
        const houses = [...cnt].sort((a, b) => b[1].size - a[1].size || (a[0] < b[0] ? -1 : 1)).map(([f]) => f);
        const same = lines.find((l) => l.houses.join("|") === houses.join("|"));
        if (same) same.groups.push(g.label); else lines.push({ groups: [g.label], houses });
      }
      return { id: s.id, label: s.label || t.label, lines };
    })),
    houses: creditHouses(inWindow, (r) => r.w.pollster, (r) => Date.parse(r.w.date)),
    // the polls the window holds, newest first (the Info entry's working)
    polls: inWindow.map(({ w, p }) => ({
      pollster: w.pollster === "RedBridge/Accent" ? "RedBridge" : w.pollster,
      dateLabel: p ? fwLabel(p.dateStart, p.date) : fwLabel(w.dateStart, w.date),
      source: w.source || null,
      // the groups it feeds on the panel: a set without a tab on the page is left out
      sets: DEMO_SETS.filter((s) => { const h = harmonize(w)[s.id]; return h && Object.keys(h).length && tabs.some((t) => t.id === s.tab); })
        .map((s) => s.id),
    })),
  };
  /* the income tab, emitted beside (never inside) D.demographics so the
     classic design's data-driven panel never sees it (repo rule 5) – its
     own houses, polls, groups and window so a house's income waves can
     leave the shared window without making the classic panel's credits
     lie. Null whenever no wave fed it (a vintage with no income printer,
     or /vic/, whose DEMOGRAPHICS load already nulls). The roster's a
     one-line entry under the panel's own working. */
  let income = null;
  /* a bracket label in the pill's compact clause form, never the house's
     spelled-out grid key: "Under $100k" → "< $100k", "$150k+"/"$3,000+
     a week"/"$100k or more" → "≥ $150k"/"≥ $3,000 a week"/"≥ $100k" */
  const bandLabel = (s) => {
    const m = String(s);
    if (/^Under\s+/i.test(m)) return "< " + m.replace(/^Under\s+/i, "");
    if (/\s+or more$/i.test(m)) return "≥ " + m.replace(/\s+or more$/i, "");
    if (/^(\$[\d,]+k?)\+(\s|$)/.test(m)) return "≥ " + m.replace(/^(\$[\d,]+k?)\+/, "$1");
    return m;
  };
  {
    const iSets = demoBuild(iRows, iRowsM, [{ id: "income", label: null, groups: INCOME_STD_BANDS.map((b) => b.group) }], allByYm, ALL, ALL_T, SPARSE_K, DEMO_SHARE);
    if (iSets.length) {
      const iHouses = creditHouses(incInWindow, (r) => r.w.pollster, (r) => Date.parse(r.w.date));
      income = {
        id: "income", label: "Income",
        houses: iHouses,
        sets: [{
          id: "income", label: null,
          /* the note the sethead pill leads with: every house fitted in
             its own brackets and READ at the same two bands of the
             electorate – the dek says so up front, the pill spells each
             house's own end brackets */
          note: "each house's own brackets, household or personal income, read at the same two bands of the electorate (bottom half, top 15%+)",
          /* each house's own end brackets as its newest in-window wave
             printed them (incInWindow rides newest-first), so a switch of
             layout era never shows the stale era's brackets – compacted
             for the clause form the pill renders (bandLabel: "Under $X"
             → "< $X", "$X+"/"$X or more" → "≥ $X"), with the house's
             income basis beside them, since a personal-income bracket
             and a household one are not the same money */
          bands: Object.fromEntries(incInWindow.filter((e) => e.band)
            .filter((e, i, a) => a.findIndex((x) => x.w.pollster === e.w.pollster) === i)
            .map((e) => [e.w.pollster, { low: [bandLabel(e.band[0])], high: [bandLabel(e.band[1])], basis: INCOME_GRIDS[e.w.pollster].basis }])),
          groups: iSets[0].groups.map((g, gi) => {
            const band = INCOME_STD_BANDS[gi];
            /* the income cut-offs behind the row label's parenthetical
               (rd-panels' RdIncomeCut): the band's outer quantile edge
               priced in each pooled basis' dollars at the build's
               reference date – one clause per basis, household first
               (INCOME_POOL_BASES' order) */
            const share = band.hi === 1 ? band.lo : band.hi;
            const cuts = INCOME_POOL_BASES.map((basis) => ({ basis, ots: incomeEdge(basis, share, INCOME_DIST, refNow) })).filter((c) => c.ots != null);
            return { ...g,
              bare: band.group.replace(/\s*\(.*\)$/, ""),
              pct: band.hi === 1 ? 0 : 1,
              cuts: cuts.length ? cuts : null };
          }),
          houses: iSets[0].houses,
        }],
        polls: incInWindow.map(({ w, p }) => ({
          pollster: w.pollster === "RedBridge/Accent" ? "RedBridge" : w.pollster,
          dateLabel: p ? fwLabel(p.dateStart, p.date) : fwLabel(w.dateStart, w.date),
          source: w.source || null,
          sets: ["income"],
        })),
        /* the roster the ledgers print: the set's houses, by their waves
           (iSets[0].houses, computed over the pooled rows isn't what a
           reader counts – the roster lists each house that HAS an income
           wave the build read, so a house's lone Oct-2025 read still shows) */
        roster: Object.keys(INCOME_GRIDS).filter((house) =>
          (DEMOGRAPHICS?.waves || []).some((w) => w.pollster === house && incomeStandardise(house, w.dims && w.dims.income, midMs(demoPollOf(w) || w)))),
        window: SPARSE_K.label,
        // the moment the earner rows' cut-offs are priced at (incomeEdge's ms)
        cutsAt: new Date(refNow).toISOString(),
      };
    }
  }
  return { demo, income };
})();
/* The all-voters row and dashed line ARE the quoted figures – the panel bills
   them as the headline's own – so a rescale creeping back in fails the build
   instead of shipping a second current figure beside the hero's. */
if (demographics) {
  const aggBy = new Map(aggPrimary.map((d) => [d.ym, d]));
  const off = [["now", demographics.all, primaryNow],
    ...demographics.allMonthly.map(([ym, ...v]) => [ym, Object.fromEntries(DEMO_KEYS.map((k, i) => [k, v[i]])), aggBy.get(ym)])]
    .filter(([, a, q]) => DEMO_KEYS.some((k) => a[k] !== q[k]));
  if (off.length) throw new Error(`vote-by-group all voters != the quoted primaries at ${off.map(([w]) => w).join(", ")} – the panel would contradict the hero and the primary chart`);
}

/* ---- 7gb. the composition of each party's vote, moving or not --------------
   The Who-votes trend block's statistics. Per set x group x party combo, a
   two-stage test on the group's monthly line against the all-voters line:
   first a weighted least squares slope of the group's GAP from the average,
   then the same fit on ln(group/all) – a group merely keeping its share of
   a party that has grown everywhere holds a constant RATIO to the average,
   so an absolute-gap slope alone reads pace-keeping as divergence. Only
   combos significant on both, in the same direction, count as a
   proportionality break, and only they reach the renderer, which titles
   and deks the block from this list.
   Monthly rows carry no n – their last five members are each party's 95%
   margin, monthWithSe's sampling-floor-aware interval – so each month is
   weighted by the party margin's precision, 1/se². Adjacent pooled months
   share polls, so every t-stat is optimistic on its face; combos on seven
   or fewer monthly points are marked thin so the copy can hedge them. */
const demoTrend = (() => {
  if (!demographics || !demographics.tabs) return null;
  const KEYS = demographics.order;
  const anchor = new Map(demographics.allMonthly.map((r) => [r[0], r]));
  const ymIdx = new Map(demographics.allMonthly.map((r, i) => [r[0], i]));
  const wls = (xs, ys, ws) => {
    const n = xs.length;
    const W = ws.reduce((a, b) => a + b, 0);
    let xm = 0, ym = 0;
    for (let i = 0; i < n; i++) { xm += ws[i] * xs[i]; ym += ws[i] * ys[i]; }
    xm /= W; ym /= W;
    let Sxx = 0, Sxy = 0;
    for (let i = 0; i < n; i++) { const dx = xs[i] - xm; Sxx += ws[i] * dx * dx; Sxy += ws[i] * dx * (ys[i] - ym); }
    const slope = Sxy / Sxx;
    let sse = 0;
    for (let i = 0; i < n; i++) { const d = ys[i] - (ym + slope * (xs[i] - xm)); sse += ws[i] * d * d; }
    if (n - 2 < 3) return null;
    const at = (x) => ym + slope * (x - xm);
    return { slope, t: slope / Math.sqrt((sse / (n - 2)) / Sxx), at };
  };
  const rr = (v) => Math.round(v * 100) / 100;
  /* Two-sided tail probabilities. zTail: P(|Z| > z), Abramowitz & Stegun
     7.1.26 (error under 1.5e-7). tTail: P(|T| > t) on df degrees of freedom,
     the regularised incomplete beta I_x(df/2, 1/2) at x = df/(df + t²) by its
     continued fraction (Numerical Recipes betacf). tQ: the two-sided 95%
     point of t, by bisection on tTail. */
  const zTail = (z) => {
    const x = Math.abs(z) / Math.SQRT2, t = 1 / (1 + 0.3275911 * x);
    return t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429)))) * Math.exp(-x * x);
  };
  const lgam = (x) => {
    const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
    let y = x, tmp = x + 5.5, ser = 1.000000000190015;
    tmp -= (x + 0.5) * Math.log(tmp);
    for (const ci of c) ser += ci / ++y;
    return -tmp + Math.log(2.5066282746310005 * ser / x);
  };
  const betacf = (a, b, x) => {
    let c = 1, d = 1 - (a + b) * x / (a + 1);
    d = 1 / (Math.abs(d) < 1e-30 ? 1e-30 : d);
    let h = d;
    for (let m = 1; m <= 200; m++) {
      const m2 = 2 * m;
      let aa = m * (b - m) * x / ((a + m2 - 1) * (a + m2));
      d = 1 + aa * d; d = 1 / (Math.abs(d) < 1e-30 ? 1e-30 : d); c = 1 + aa / c; c = Math.abs(c) < 1e-30 ? 1e-30 : c; h *= d * c;
      aa = -(a + m) * (a + b + m) * x / ((a + m2) * (a + m2 + 1));
      d = 1 + aa * d; d = 1 / (Math.abs(d) < 1e-30 ? 1e-30 : d); c = 1 + aa / c; c = Math.abs(c) < 1e-30 ? 1e-30 : c;
      const del = d * c; h *= del;
      if (Math.abs(del - 1) < 3e-12) break;
    }
    return h;
  };
  const ibeta = (a, b, x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    const bt = Math.exp(lgam(a + b) - lgam(a) - lgam(b) + a * Math.log(x) + b * Math.log(1 - x));
    return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b;
  };
  const tTail = (t, df) => ibeta(df / 2, 0.5, df / (df + t * t));
  const tQ = (df) => { let lo = 1.9, hi = 15; for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (tTail(m, df) > 0.05) lo = m; else hi = m; } return (lo + hi) / 2; };
  /* Holm's step-down adjustment: each p times the number of tests not yet
     passed, held non-decreasing in rank. A family's claims at padj < 0.05
     carry under a 1-in-20 chance of naming ANY false move, whatever the
     dependence between the tests (states nest, age bands and generations
     overlap). */
  const holm = (items) => {
    const live = items.filter((r) => Number.isFinite(r.p)).sort((a, b) => a.p - b.p);
    let run = 0;
    live.forEach((r, k) => { run = Math.max(run, Math.min(1, (live.length - k) * r.p)); r.padj = run; });
    return live.length;
  };
  const out = {};
  /* the income tab's two standard bands run the relative test from
     their own iRowsT months (a pooled release counted once, as every set
     here). Appended as a tab of the loop's own shape, so an earnings
     proportionality break takes its place beside the harmonised groups' –
     in the moves, and in the significance table's rows under "By income" */
  const trendTabs = !demoIncome ? demographics.tabs : demographics.tabs.concat([{
    id: "income", label: "Income",
    sets: [{ id: "income", label: "By income", groups: demoIncome.sets[0].groups }],
  }]);
  for (let pid = 0; pid < KEYS.length; pid++) {
    const party = KEYS[pid];
    const moves = [];
    // rows: every group tested, PASS OR FAIL, so the Who-votes table can
    // show the whole battery; `moves` is the copy's list: the rows whose
    // Holm-adjusted relative change clears 95% and isn't withheld
    const rows = [];
    let windowYm = null;
    for (const tab of trendTabs) {
      for (const st of tab.sets) {
        for (const g of st.groups) {
          const xs = [], gs = [], as = [], ws = [];
          /* the test's own months (DEMO_TEST_MONTHLY): the drawn line's,
             except that a pooled release counts once, not once per part */
          /* federal: the group model's own move against all voters since
             polling day (§7gm since), on the log ratio alone – the group's
             share over the national share, then and now, from the two days'
             draws together. Absolute moves don't count (user ruling
             2026-11-24): a party growing everywhere widens every point gap
             with no change in who its voters are */
          const gmS = GROUPM && GROUPM.get(st.id + "|" + g.label), sv = gmS && gmS.since && gmS.since[party];
          if (sv) {
            const fromYm = ELECTION.date.slice(0, 7), toYm = demographics.allMonthly[demographics.allMonthly.length - 1][0];
            if (!windowYm || fromYm < windowYm) windowYm = fromYm;
            rows.push({ tab: tab.id, set: st.id, setLabel: st.label || tab.label, group: g.label, from: fromYm, to: toYm,
              dir: sv.lr.v >= 0 ? 1 : -1, tAbs: rr(sv.gap.z), tLR: rr(sv.lr.z), thin: false, months: (g.monthly || []).length,
              g0: rr(sv.g0), g1: rr(sv.g1), a0: rr(sv.a0), a1: rr(sv.a1), rel: rr(sv.gap.v), model: true,
              r0: rr(sv.g0 / sv.a0), r1: rr(sv.g1 / sv.a1),
              lr: +sv.lr.v.toFixed(4), lrLo: +sv.lr.lo.toFixed(4), lrHi: +sv.lr.hi.toFixed(4), p: zTail(sv.lr.z),
              gapLo: rr(sv.gap.lo), gapHi: rr(sv.gap.hi) });
            continue;
          }
          const tm = DEMO_TEST_MONTHLY.get(st.id + "|" + g.label) || g.monthly || [];
          for (const row of tm) {
            const a = anchor.get(row[0]);
            if (!a) continue;
            xs.push(ymIdx.get(row[0]));
            gs.push(row[1 + pid]);
            as.push(a[1 + pid]);
            // precision weight from the party's own 95% margin this month
            const se = Math.max(0.5, row[6 + pid]) / 1.96;
            ws.push(1 / (se * se));
          }
          if (xs.length < 5) continue;
          const firstYm = tm[0]?.[0];
          if (firstYm && (!windowYm || firstYm < windowYm)) windowYm = firstYm;
          const f1 = wls(xs, gs.map((v, i) => v - as[i]), ws);
          const lx = [], ly = [], lw = [];
          for (let i = 0; i < xs.length; i++) {
            if (gs[i] <= 0.05 || as[i] <= 0.05) continue;
            lx.push(xs[i]); ly.push(Math.log(gs[i] / as[i])); lw.push(ws[i]);
          }
          const f2 = lx.length >= 5 ? wls(lx, ly, lw) : null;
          const lo = Math.min(...xs), hi = Math.max(...xs);
          const gl = wls(xs, gs, ws), al = wls(xs, as, ws);
          const g0 = rr(gl.at(lo)), g1 = rr(gl.at(hi)), a0 = rr(al.at(lo)), a1 = rr(al.at(hi));
          /* the relative test (user ruling 2026-11-24: absolute moves don't
             count – a party growing everywhere widens every point gap): the
             slope of log(group / all voters) across the window, as a change
             from the first fitted month to the last, its 95% interval on
             Student's t with the fit's own degrees of freedom */
          let lrv = null, lrLo = null, lrHi = null, p = null, r0 = null, r1 = null;
          if (f2) {
            const lx0 = Math.min(...lx), lx1 = Math.max(...lx), span = lx1 - lx0, df = lx.length - 2;
            lrv = f2.slope * span;
            const se = Math.abs(f2.slope / f2.t) * span, q = tQ(df);
            lrLo = lrv - q * se; lrHi = lrv + q * se; p = tTail(f2.t, df);
            r0 = rr(Math.exp(f2.at(lx0))); r1 = rr(Math.exp(f2.at(lx1)));
          }
          rows.push({
            tab: tab.id, set: st.id, setLabel: st.label || tab.label, group: g.label,
            from: demographics.allMonthly[lo][0], to: demographics.allMonthly[hi][0],
            dir: (f2 ? f2.t : f1 ? f1.t : 0) >= 0 ? 1 : -1,
            tAbs: f1 ? rr(f1.t) : null, tLR: f2 ? rr(f2.t) : null,
            // seven or fewer monthly points: a handful of waves, one or two houses
            thin: xs.length <= 7, months: xs.length,
            g0, g1, a0, a1, rel: rr((g1 - g0) - (a1 - a0)), r0, r1,
            ...(f2 ? { lr: +lrv.toFixed(4), lrLo: +lrLo.toFixed(4), lrHi: +lrHi.toFixed(4), p } : {}),
          });
        }
      }
    }
    /* one family per party: every group tested, Holm-adjusted (above) */
    const tested = holm(rows);
    /* on the model, the same-house check (the election test's below) can
       withhold a move: rows carry it once elecRows is built */
    /* The election test (user rulings 2026-11-02 and 2026-11-03), beside
       – never inside – the slope test above: for every group with an
       election-time figure, has its gap from all voters moved since the
       election? The gap now is the group's current pooled figure less the
       current primaries (the dot plot's own "vs all voters").
       The gap then is the polls' own at the election (DEMO_ELECTION: the
       same houses' tables over the six weeks before 3 May 2025, pooled as
       the current figure is), so both ends are the same instruments.
       Measured against the Australian Election Study instead, part of the
       "change" was the two instruments disagreeing: Labor's and the
       Greens' gender gaps, the Greens among voters with Year 12 or less
       and others among outright owners read as shifts that the polls'
       own readings don't show (.build/analysis/group-poll-error-2025 §4).
       Where no house cut the group before the election (the generations)
       the gap then is still the AES's (group less all respondents), and
       the row says so (base "aes").
       Significant when the change clears both margins combined: the
       current figure's and the baseline's (the polls' pooled margin, or
       the AES cell's gap_ci, so a thin AES cell gates its own claims out).
       An endpoint comparison, never a point in the slope fit. */
    const elecRows = [];
    if (DEMO_ELECTION || DEMO_AES) for (const tab of demographics.tabs) for (const st of tab.sets) {
      const pe = DEMO_ELECTION && DEMO_ELECTION.sets[st.id];
      const ae = DEMO_AES && DEMO_AES.sets[st.id];
      if (!pe && !ae) continue;
      for (const g of st.groups) {
        if (g.v[party] == null) continue;
        /* the baseline: the polls' election-time figure where the houses cut
           the group then, else the AES's - gThen/allThen are the group's
           and all voters' shares on that baseline's own scale, for the
           ratio half below */
        const pg = pe && pe.groups[g.label], p = pg && pg[party];
        const ag = !p && ae && ae.groups[g.label], a = ag && ag[party];
        let base, then, ciThen, gThen, allThen, nBase, houses = null;
        if (p) {
          base = "polls"; then = p[0] - DEMO_ELECTION.elec[party]; ciThen = p[1];
          gThen = p[0]; allThen = DEMO_ELECTION.elec[party]; nBase = pg.n; houses = pg.houses;
        } else if (a && a[2] != null) {
          base = "aes"; then = a[1] - DEMO_AES.elec[party]; ciThen = a[2];
          gThen = a[0]; allThen = DEMO_AES.all[party]; nBase = ag.n;
        } else continue;
        const gmE = GROUPM && GROUPM.get(st.id + "|" + g.label), se = gmE && gmE.since && gmE.since[party];
        const now = g.v[party] - demographics.all[party];
        /* federal: the change is the group model's own posterior (the two
           days' gaps are drawn jointly, so the change's interval is the
           change's, not the two margins added as if independent) */
        const ci = se ? (se.gap.hi - se.gap.lo) / 2 : Math.sqrt((g.ci[party] || 0) ** 2 + ciThen ** 2);
        const d = se ? se.gap.v : now - then;
        /* and the ratio half, as the slope test pairs its two: a party that
           has grown everywhere widens a low group's point gap while the
           group keeps its share of it (One Nation, ~6 to ~25 since the
           election), so the gap alone reads pace-keeping as divergence.
           ln(group / all) now against then, each side's error carried onto
           the log scale (delta method) off its own margin; a zero share
           then has no ratio to test, so it can't pass */
        const gNow = g.v[party], allNow = demographics.all[party];
        const lrOk = gNow > 0.05 && allNow > 0.05 && gThen > 0.05 && allThen > 0.05;
        const lr = se ? se.lr.v : lrOk ? Math.log(gNow / allNow) - Math.log(gThen / allThen) : null;
        const lrCi = se ? (se.lr.hi - se.lr.lo) / 2 : lrOk ? Math.sqrt(((g.ci[party] || 0) / gNow) ** 2 + (ciThen / gThen) ** 2) : null;
        const sigLR = lr != null && Math.abs(lr) > lrCi;
        /* the same-house check (user ruling 2026-11-02): where Resolve's own
           election-day wave gives the same quantity - the cell's movement
           less the national, within one house so its lean cancels (the
           model's vote layer, data/seat-vote-layer.json β, age and gender) -
           a claim stands only if that estimate doesn't disagree with ours
           beyond the two margins combined. Labor's gender gap is the case
           that made the rule: measured from the AES this test read it
           closing, Resolve's own waves read it widening */
        const rb = DEMO_RESOLVE_BETA && DEMO_RESOLVE_BETA[st.id] && DEMO_RESOLVE_BETA[st.id][g.label]
          && DEMO_RESOLVE_BETA[st.id][g.label][party === "onp" ? "on" : party];
        const check = rb ? { beta: rr(rb.beta), ci: rr(1.96 * rb.se),
          conflict: Math.abs(d - rb.beta) > Math.sqrt(ci ** 2 + (1.96 * rb.se) ** 2) } : null;
        const sig = Math.abs(d) > ci && sigLR && Math.sign(d) === Math.sign(lr);
        elecRows.push({ tab: tab.id, set: st.id, setLabel: st.label || tab.label, group: g.label, base,
          then: rr(then), now: rr(now), d: rr(d), ci: rr(ci), ciNow: rr(g.ci[party] || 0), ciThen: rr(ciThen),
          // the baseline's own count: polls in the election window, or AES respondents in the group
          n: nBase, ...(houses ? { houses } : {}),
          rThen: lrOk ? rr(gThen / allThen) : null, rNow: lrOk ? rr(gNow / allNow) : null,
          sigGap: Math.abs(d) > ci, sigLR, sig, check,
          // what the copy may cite: significant AND not contradicted by the same-house check
          claim: sig && !(check && check.conflict) });
      }
    }
    /* on the model the change test and the election test measure one thing
       (the move since polling day), so a move the same-house check
       contradicts is withheld from the moves as it is from the claims */
    const modelMoves = rows.some((r) => r.model);
    if (modelMoves) for (const r of rows) {
      const e = elecRows.find((q) => q.set === r.set && q.group === r.group);
      if (e && e.check) r.check = e.check;
    }
    /* a move: its relative change clears 95% after Holm across the party's
       tested groups, and no same-house reading contradicts it */
    for (const r of rows) {
      r.sigAlone = Number.isFinite(r.p) && r.p < 0.05;
      r.sig = Number.isFinite(r.padj) && r.padj < 0.05;
      if (r.p != null) { r.p = +r.p.toPrecision(3); r.padj = +r.padj.toPrecision(3); }
      if (r.sig && !(r.check && r.check.conflict)) moves.push(r);
    }
    moves.sort((a, b) => a.p - b.p);
    out[party] = { windowYm, moves, rows, tested, elec: elecRows, ...(modelMoves ? { model: true } : {}) };
  }
  /* ---- the gap charts' test (Who votes for whom, "Gaps between groups"):
     has one group's vote moved against another's, relative to it, since
     the election? On the model it is the two groups' own relative moves
     differenced – log(gA/gB) then and now is log(gA/all) less log(gB/all),
     so the national line cancels exactly – with the groups' posteriors
     independent, as the model fits them (one walk per group). The income
     bands, off the model, take the slope of log(gA/gB) across their months,
     as their test against all voters does. A set's family is every pair
     of its groups (a state never against its own bucket) times every
     party, Holm-adjusted; only the pairs that pass are shipped, with the
     family's size. A pair is stored once, a before b in the set's order. */
  const NEST = { SA: "Non-NSW/Vic/Qld", WA: "Non-NSW/Vic/Qld", "ACT/NT/Tas": "Non-NSW/Vic/Qld" };
  const gapTests = {};
  for (const tab of trendTabs) for (const st of tab.sets) {
    const fam = [], G = st.groups;
    for (let i = 0; i < G.length; i++) for (let j = i + 1; j < G.length; j++) {
      const A = G[i].label, B = G[j].label;
      if (NEST[A] === B || NEST[B] === A) continue;
      for (let pid = 0; pid < KEYS.length; pid++) {
        const party = KEYS[pid];
        const sa = GROUPM && GROUPM.get(st.id + "|" + A)?.since?.[party];
        const sb = GROUPM && GROUPM.get(st.id + "|" + B)?.since?.[party];
        if (sa && sb) {
          const sd = (x) => (x.lr.hi - x.lr.lo) / 3.92;
          const d = sa.lr.v - sb.lr.v, se = Math.hypot(sd(sa), sd(sb));
          if (!(se > 0)) continue;
          fam.push({ a: A, b: B, party, r0: sa.g0 / sb.g0, r1: sa.g1 / sb.g1, lr: d, lo: d - 1.96 * se, hi: d + 1.96 * se, p: zTail(d / se), model: true });
          continue;
        }
        const ma = DEMO_TEST_MONTHLY.get(st.id + "|" + A), mb = new Map((DEMO_TEST_MONTHLY.get(st.id + "|" + B) || []).map((r) => [r[0], r]));
        if (!ma) continue;
        const lx = [], ly = [], lw = [];
        for (const ra of ma) {
          const rb = mb.get(ra[0]), ga = ra[1 + pid], gb = rb && rb[1 + pid];
          if (!rb || !(ga > 0.05) || !(gb > 0.05) || !ymIdx.has(ra[0])) continue;
          const va = (Math.max(0.5, ra[6 + pid]) / 1.96 / ga) ** 2, vb = (Math.max(0.5, rb[6 + pid]) / 1.96 / gb) ** 2;
          lx.push(ymIdx.get(ra[0])); ly.push(Math.log(ga / gb)); lw.push(1 / (va + vb));
        }
        const f = lx.length >= 5 ? wls(lx, ly, lw) : null;
        if (!f || !Number.isFinite(f.t)) continue;
        const x0 = Math.min(...lx), x1 = Math.max(...lx), span = x1 - x0, df = lx.length - 2;
        const d = f.slope * span, se = Math.abs(f.slope / f.t) * span, q = tQ(df);
        fam.push({ a: A, b: B, party, r0: Math.exp(f.at(x0)), r1: Math.exp(f.at(x1)), lr: d, lo: d - q * se, hi: d + q * se, p: tTail(f.t, df),
          from: demographics.allMonthly[x0][0], to: demographics.allMonthly[x1][0] });
      }
    }
    const m = holm(fam);
    if (!m) continue;
    gapTests[st.id] = { tested: m, pass: fam.filter((r) => r.padj < 0.05).sort((x, y) => x.p - y.p).map((r) => ({
      a: r.a, b: r.b, party: r.party, r0: rr(r.r0), r1: rr(r.r1), lr: +r.lr.toFixed(4), lo: +r.lo.toFixed(4), hi: +r.hi.toFixed(4),
      p: +r.p.toPrecision(3), padj: +r.padj.toPrecision(3), ...(r.model ? { model: true } : { from: r.from, to: r.to }) })) };
  }
  out._gaps = gapTests;
  return out;
})();
/* the gap charts' pair tests, shipped apart from the per-party map */
const demoGaps = demoTrend ? demoTrend._gaps : null;
if (demoTrend) delete demoTrend._gaps;

/* ---- 7h. the issues: what matters, and who is trusted with it --------------
   data/issues.json (.build/issues.mjs) – each house's issue questions, per
   wave, as published. Three figures come out of it, each built as the
   headline is (the six-week window: a house or two asks each month, so the
   headline's three weeks would often hold one poll or none).
   Who is best on each issue (ownership). Resolve, RedBridge and Ipsos ask
   which party is best on an issue every month, YouGov (Aug 2026) and
   DemosAU (Feb 2026) once each, SEC Newgate the best party to manage the
   cost of living every two months, and they offer different options:
   Resolve no Greens and, until July 2026, no One Nation; Ipsos no One
   Nation until June 2026; RedBridge "all about equal" and the Liberals and
   Nationals apart; YouGov and DemosAU a single don't-know; SEC Newgate
   One Nation and the Greens only from May 2026, "neither" and "can't say"
   not shown separately from then. DemosAU's February poll
   has too few other houses' polls around it for a lean to be measured, so
   it pools as published. The part every current
   question shares is the choice between Labor, the Coalition and One
   Nation, so each wave is read as those three's shares of the voters who
   named one of them, and only those waves pool – the questions match there
   and nowhere else. Pooled in the six-week window (sample- and recency-
   weighted, a house's repeat waves as sqrt(m)), less each house's lean on
   each party's share (houseEffectsFor: with three regular houses there are
   neighbours enough to measure one; each party's leans sum to zero across
   a house's three shares, so the pooled shares still make 100). Few polls
   have offered all three parties, so the shrunk leans are small yet – about
   a point of Ipsos's eight-point Labor lean in Sep 2026. Ipsos asks only
   its month's five top issues. `leadSig` says whether the leader's margin
   over the runner-up clears its own 95% margin, the difference of two
   shares of one sample carrying its own variance, as the leader nets do.
   Where it doesn't, `pairSig` says whether the runner-up's margin over the
   third clears ITS margin: two parties the polls can't separate, both
   clearly ahead of the one left behind.
   What matters (salience): the share putting each issue in their top three.
   RedBridge asks which issues matter most to your vote (rank three of 14),
   Ipsos which are the most important facing Australia (pick three of 19);
   both monthly. The wording sets them a steady distance apart – RedBridge
   about 14 points higher on health, 7 lower on housing (Sep 2026) – so each wave is
   moved half that distance toward the other (pairLeanFor) and pooled in the
   same window. DemosAU (an open question, one answer, coded by AI into
   categories that change month to month) and Spectre (every three months,
   bundled categories) aren't pooled; the Info entry cites them as checks.
   And by group: RedBridge's table for each issue by vote, generation,
   gender, place, education and home, the group's sample taken as the
   poll's times the group's rough share of voters (only its sampling floor
   depends on that share), beside RedBridge's own all-voters figure – the
   groups are its alone, so the row above them must be too. ISSUES_FILE and
   ISSUE_SHARED are read and keyed up in §5i, which hangs each wave on its
   archive row before the pooling below runs. */
const OWN3 = ["alp", "lnp", "onp"];
const ISSUE_GROUP_SETS = [
  { id: "vote", label: "Vote" }, { id: "generation", label: "Age" }, { id: "gender", label: "Gender" },
  { id: "education", label: "Education" }, { id: "location", label: "Place" }, { id: "housing", label: "Home" },
];
/* Each group's rough share of a poll's respondents: it sizes that group's
   sampling-error floor and nothing else. Vote groups from the poll's own
   primaries, less the eight per cent RedBridge reports can't or won't say
   (its "Undecided / will not vote"); its Liberal and Nationals-side voters
   split the Coalition about 65:35, their 2025 shares of the Coalition vote. */
const issueGroupShare = (set, g, p) => {
  if (set === "vote") {
    const d = 0.92, lnp = (p && p.lnp) || 0;
    return { Labor: (p?.alp || 0) / 100 * d, Coalition: lnp / 100 * d, Liberal: 0.65 * lnp / 100 * d,
             "Nationals, LNP and CLP": 0.35 * lnp / 100 * d, "One Nation": (p?.onp || 0) / 100 * d,
             Greens: (p?.grn || 0) / 100 * d, Others: (((p?.ind || 0) + (p?.oth || 0)) / 100) * d, Undecided: 0.08 }[g] || null;
  }
  if (set === "education") return { "Below Year 12": 0.156, "Year 12": 0.244, "TAFE or trade": 0.31, University: 0.29 }[g] || null;
  if (set === "housing") return { "Own outright": 0.32, Mortgage: 0.36, "Renting and other": 0.32 }[g] || null;
  return DEMO_SHARE[g] || null;
};
/* ---- 7hm. the issues model (issue-model.mjs; readings from every issue
   store by issue-readings.mjs) -------------------------------------------
   What matters: one line per issue, the share who would put it in their top
   three, on the scale of the average regular top-three pollster (RedBridge
   and Ipsos, each counting once). Every other way of asking – the one most
   important issue (AES, ANUpoll), pick five (JWS Research), an open question
   (SEC Newgate), Ipsos's other list (What Worries the World), Freshwater's
   up-to-three – reads the same line through a lean of its own per issue. The
   line follows Ipsos's question through time (Ipsos's "environment" for
   climate change: Ipsos asks no climate item), and today's level is the two
   regular pollsters' average: the line moved by half the gap between them
   measured today, one constant for every month.
   Who is best: Labor v the Coalition (d = log of Labor's to the Coalition's
   share) and One Nation v the two (o), each its own line, the three shares
   read off both; d follows Ipsos's question through time (Resolve's for
   immigration, national security and climate change, which Ipsos seldom
   asks), o RedBridge's; today's level is the average of the three regular
   pollsters, RedBridge, Resolve and Ipsos. Settings on a grid, κ per house;
   figures are summaries of 1,000 seeded draws per line. Backtest (each poll
   predicted from those fielded before it, 2008–2026): Ipsos's top three 2.0
   points v 2.2 for its own previous reading, 95% intervals covering 95%;
   this term's RedBridge and Ipsos 1.90 v 1.90 for the six-week pool it
   replaced; Labor v Coalition 2.6–2.8 v 2.9–3.1. */
const IM_SAL_ANCHOR = (k) => (k === "climate" ? "Ipsos (environment)" : "Ipsos");
const IM_SAL_CONV = ["RedBridge/Accent", "Ipsos"];
const IM_D_ANCHOR = (k) => (["immigration", "security", "climate"].includes(k) ? "Resolve" : "Ipsos");
const IM_OWN_CONV = ["RedBridge/Accent", "Resolve", "Ipsos"];
const IM_GRID_SAL = { w: [0.013, 0.019, 0.028], d: [0.004, 0.008, 0.016], tau: [0, 0.08], J: [0, 0.4, 0.8], s: [0.25] };
const IM_GRID_D = { w: [0.008, 0.012, 0.018], d: [0.003, 0.006, 0.012], tau: [0, 0.03], J: [0.1, 0.2, 0.4], s: [0.1] };
const IM_GRID_O = { w: [0.012, 0.018, 0.027], d: [0.0002, 0.0008, 0.003, 0.008], tau: [0, 0.03], J: [0], s: [0.1] };
const IM_NDRAW = +(process.env.IM_NDRAW || 1000);
const ISSM = (() => {
  if (!ISSUES_FILE) return null;
  const T0 = Date.now();
  const DAYn = (iso) => Math.floor(Date.parse(iso.slice(0, 10) + "T00:00:00Z") / 86400000);
  const ISOd = (d) => new Date(d * 86400000).toISOString().slice(0, 10);
  const pollOf = (w) => POLLS.find((q) => q.pollster === w.pollster && q.date === w.date) || null;
  const { sal, own } = buildIssueReadings({ root: ROOT, issuesFile: ISSUES_FILE, pollOf, rowN, keys: ISSUE_SHARED });
  const t1 = DAYn(LATEST_ISO), tPrev = t1 - 30;
  /* changes of prime minister or government, where who is trusted can turn
     at once; COVID's arrival for what matters */
  const PM_DAYS = ["2007-11-24", "2010-06-24", "2013-06-27", "2013-09-07", "2015-09-15", "2018-08-24", "2022-05-21"].map(DAYn);
  const COVID = DAYn("2020-03-15");
  /* output days: the 15th of every month from a line's first reading (the
     latest poll day in the current month), plus the latest poll day and the
     day thirty before it */
  const ymOfDay = (d) => ISOd(d).slice(0, 7);
  const monthList = (a) => {
    const out = [];
    for (let y = +ymOfDay(a).slice(0, 4), m = +ymOfDay(a).slice(5, 7); ; m === 12 ? (y++, m = 1) : m++) {
      const ym = `${y}-${String(m).padStart(2, "0")}`;
      if (ym > ymOfDay(t1)) break;
      out.push({ ym, day: Math.max(a, Math.min(DAYn(ym + "-15"), t1)) });
    }
    return out;
  };
  const outDays = (a) => [...new Set([...monthList(a).map((m) => m.day), t1, tPrev])].sort((x, y) => x - y);
  const salRows = sal.map((r, i) => { const o = imSalObs(r.p, r.n, r.step); return { day: r.day, house: r.house, issue: r.issue, y: o.y, v: o.v + (r.avg ? 0.004 : 0), i, raw: r }; });
  const dRows = [], oRows = [];
  own.forEach((r, i) => {
    const ob = imOwnObs(r, r.n, r.step);
    dRows.push({ day: r.day, house: r.house, issue: r.issue, ...ob.d, i, raw: r });
    if (ob.o) oRows.push({ day: r.day, house: r.house, issue: r.issue, ...ob.o, i, raw: r });
  });
  const SS = imBuildSeries(salRows, { core: (k) => new Set([IM_SAL_ANCHOR(k)]), wide: IM_WIDE_SAL, p0: 1.5, minCore: 1, jumps: [COVID], outDays });
  const SD = imBuildSeries(dRows, { core: (k) => new Set([IM_D_ANCHOR(k)]), wide: IM_WIDE_OWN, p0: 1, minCore: 1, jumps: PM_DAYS, outDays });
  const SO = imBuildSeries(oRows, { core: () => new Set(["RedBridge/Accent"]), wide: IM_WIDE_OWN, p0: 1, minCore: 1, outDays });
  for (const S of [...SS, ...SD, ...SO]) if (S.t1 < t1) S.t1 = t1;
  const stS = imFit(SS, IM_GRID_SAL), stD = imFit(SD, IM_GRID_D), stO = imFit(SO, IM_GRID_O);
  const edges = [...stS.edges.map((e) => "salience " + e), ...stD.edges.map((e) => "Labor v Coalition " + e), ...stO.edges.map((e) => "One Nation " + e)];
  if (edges.length) console.warn("issues model: settings on a grid edge –", edges.join(", "));
  const T1 = Date.now();
  /* one line's published draws: the line plus the convention houses' mean
     lean today (the anchor's lean is zero), and the smoothed lean of every
     house at each of its reading days (to move a dot onto the line) */
  const pubOf = (S, st, conv, seed) => {
    const days = outDays(S.t0);
    const dr = imDrawSeries(S, st, { nDraw: IM_NDRAW, seed, keepDays: days });
    const hs = conv.filter((h) => h === S.core[0] || dr.leans.has(h));
    const shift = new Float64Array(IM_NDRAW);
    for (const h of hs) if (h !== S.core[0]) { const a = dr.leans.get(h); for (let i = 0; i < IM_NDRAW; i++) shift[i] += a[i] / hs.length; }
    const at = (d) => { const a = dr.at(d); if (!a) return null; const o = new Float64Array(IM_NDRAW); for (let i = 0; i < IM_NDRAW; i++) o[i] = a[i] + shift[i]; return o; };
    let sMean = 0; for (const v of shift) sMean += v / IM_NDRAW;
    /* the leans today, each house's own (mean over draws, log scale) */
    const leanNow = new Map([[S.core[0], 0], ...[...dr.leans].map(([h, a]) => [h, a.reduce((x, y) => x + y, 0) / a.length])]);
    const coefs = {}, rDays = [...new Set(S.obs.map((o) => o.t))];
    for (const [h, lr] of S.lean) if (!S.lone.has(h) && h !== S.core[0]) coefs[h] = lr;
    const lm = Object.keys(coefs).length ? imMoments(S, st, rDays, coefs) : {};
    const dayIdx = new Map(rDays.map((d, j) => [d, j]));
    const leanAt = (h, d) => (h === S.core[0] ? 0 : lm[h] ? lm[h][dayIdx.get(d)].m : leanNow.get(h) ?? 0);
    return { S, days, at, sMean, leanNow, leanAt, hs, months: monthList(S.t0) };
  };
  const q3 = (a, f) => { const t = Float64Array.from(a, f); return [imQuant(t, 0.5), imQuant(t, 0.025), imQuant(t, 0.975)]; };
  const pct = (x) => 100 * imExpit(x);
  /* ---- what matters ---- */
  const salience = {};
  SS.forEach((S, si) => {
    const k = S.key, P = pubOf(S, stS, IM_SAL_CONV, 7301 + si);
    const now = P.at(t1), prev = P.at(tPrev);
    const [v, lo, hi] = q3(now, pct);
    const chgD = Float64Array.from(now, (x, i) => pct(x) - pct(prev[i]));
    const [chg, cLo, cHi] = q3(chgD, (x) => x);
    let up = 0; for (const x of chgD) if (x > 0) up++;
    /* the steady gap between the two regular pollsters today, RedBridge minus Ipsos (points) */
    const g = P.leanNow.has("RedBridge/Accent") && P.leanNow.has("Ipsos") ? (() => {
      const m = imQuant(Float64Array.from(now), 0.5) - P.sMean;
      return pct(m + P.leanNow.get("RedBridge/Accent")) - pct(m + P.leanNow.get("Ipsos"));
    })() : null;
    const months = P.months.map(({ ym, day }) => { const a = P.at(day); const [m, l, h] = q3(a, pct); return [ym, r1(m), r1(l), r1(h)]; });
    /* every reading, moved onto the line: printed log-odds less the house's
       lean that day plus today's convention shift */
    const dots = S.obs.map((o) => {
      const r = o.raw.raw || o.raw;
      const adj = pct(o.y - P.leanAt(o.house, o.t) + P.sMean);
      return [r2(dx(r.date)), o.house, r.date, r.p, Math.round(r.n), r1(adj), r.fmt, r.avg ? 1 : 0];
    });
    salience[k] = { v: r1(v), lo: r1(lo), hi: r1(hi), ci: r1((hi - lo) / 2), chg: r1(chg), chgLo: r1(cLo), chgHi: r1(cHi),
      pUp: Math.round(1000 * up / IM_NDRAW) / 1000, changeSig: cLo > 0 || cHi < 0, gap: g != null ? r1(g) : null,
      leans: Object.fromEntries([...P.leanNow].map(([h, l]) => [h, r2(l)])), houses: S.houses, months, dots };
  });
  /* ---- who is best ---- */
  const ownership = {};
  const OWN3q = ["alp", "lnp", "onp"];
  SD.forEach((S, si) => {
    const k = S.key, Pd = pubOf(S, stD, IM_OWN_CONV, 7401 + si);
    const So = SO.find((x) => x.key === k), Po = So ? pubOf(So, stO, IM_OWN_CONV, 7501 + si) : null;
    const share3 = (dd, oo) => { const on = imExpit(oo), a = (1 - on) * imExpit(dd); return { alp: 100 * a, lnp: 100 * (1 - on - a), onp: 100 * on }; };
    const draws3 = (day) => {
      const dd = Pd.at(day), oo = Po && Po.at(day);
      if (!dd || !oo) return null;
      const out = { alp: new Float64Array(IM_NDRAW), lnp: new Float64Array(IM_NDRAW), onp: new Float64Array(IM_NDRAW) };
      for (let i = 0; i < IM_NDRAW; i++) { const s3 = share3(dd[i], oo[i]); for (const q of OWN3q) out[q][i] = s3[q]; }
      return out;
    };
    const months2 = Pd.months.map(({ ym, day }) => { const [m, l, h] = q3(Pd.at(day), pct); return [ym, r1(m), r1(l), r1(h)]; });
    const o0 = Po ? Po.months[0].ym : null;
    const months3 = Po ? Pd.months.filter((m) => m.ym >= o0).map(({ ym, day }) => {
      const D3 = draws3(day); if (!D3) return null;
      const b = OWN3q.map((q) => q3(D3[q], (x) => x));
      return [ym, ...b.map((x) => r1(x[0])), ...b.map((x) => r1((x[2] - x[1]) / 2))];
    }).filter(Boolean) : [];
    let cur = null;
    const N3 = draws3(t1), P3 = draws3(tPrev);
    if (N3) {
      const v = {}, ci = {}, lo = {}, hi = {}, chg = {}, chgSig = {};
      for (const q of OWN3q) {
        const [m, l, h] = q3(N3[q], (x) => x); v[q] = r1(m); lo[q] = r1(l); hi[q] = r1(h); ci[q] = r1((h - l) / 2);
        if (P3) { const c = Float64Array.from(N3[q], (x, i) => x - P3[q][i]); const [cm, cl, ch] = q3(c, (x) => x); chg[q] = r1(cm); chgSig[q] = cl > 0 || ch < 0; }
      }
      const order = [...OWN3q].sort((a, b) => imQuant(N3[b], 0.5) - imQuant(N3[a], 0.5));
      const gapOf = (a, b) => { const gd = Float64Array.from(N3[a], (x, i) => x - N3[b][i]); const [m, l, h] = q3(gd, (x) => x); let pos = 0; for (const x of gd) if (x > 0) pos++; return { m, l, h, p: pos / IM_NDRAW }; };
      const G1 = gapOf(order[0], order[1]), leadSig = G1.p >= 0.975;
      const G2 = leadSig ? null : gapOf(order[1], order[2]);
      cur = { v, ci, lo, hi, chg, chgSig, lead: order[0], runner: order[1], third: order[2],
        gap: r1(G1.m), gapCi: r1((G1.h - G1.l) / 2), gapLo: r1(G1.l), gapHi: r1(G1.h), pLead: Math.round(1000 * G1.p) / 1000, leadSig,
        ...(G2 ? { gap2: r1(G2.m), gap2Ci: r1((G2.h - G2.l) / 2), pairSig: G2.p >= 0.975 } : {}) };
    }
    /* a three-way share figure at a given month (the parked change view) */
    const at3 = (ym) => {
      const m = Pd.months.find((x) => x.ym === ym); if (!m) return null;
      const D3 = draws3(m.day); if (!D3) return null;
      const order = [...OWN3q].sort((a, b) => imQuant(D3[b], 0.5) - imQuant(D3[a], 0.5));
      const p = (a, b) => { let n = 0; for (let i = 0; i < IM_NDRAW; i++) if (D3[a][i] > D3[b][i]) n++; return n / IM_NDRAW; };
      const leadSig = p(order[0], order[1]) >= 0.975;
      return { lead: order[0], runner: order[1], third: order[2], leadSig, ...(leadSig ? {} : { pairSig: p(order[1], order[2]) >= 0.975 }) };
    };
    /* each house's lean on each party's share today, the leading party's
       figure as the rail quotes it: its shares at the line plus its leans,
       less the line's */
    const leanShares = (h) => {
      const dm = imQuant(Pd.at(t1), 0.5), om = Po ? imQuant(Po.at(t1), 0.5) : null;
      if (om == null) return null;
      const ld = Pd.leanNow.get(h), lo_ = Po.leanNow.get(h);
      if (ld == null) return null;
      const base = share3(dm, om), hs = share3(dm + ld - Pd.sMean, om + (lo_ ?? Po.sMean) - Po.sMean);
      return Object.fromEntries(OWN3q.map((q) => [q, r1(hs[q] - base[q])]));
    };
    const dots2 = S.obs.map((o) => { const r = o.raw.raw || o.raw; return [r2(dx(r.date)), o.house, r.date, r1(100 * r.alp / (r.alp + r.lnp))]; });
    ownership[k] = { cur, months2, months3, at3, leanShares, houses: [...new Set([...S.houses, ...(So ? So.houses : [])])], dots2 };
  });
  const T2 = Date.now();
  console.log(`issues model: ${sal.length} what-matters readings (${new Set(sal.map((r) => r.house)).size} question forms), ${own.length} who-is-best; salience ${JSON.stringify(stS.best)}, d ${JSON.stringify(stD.best)}, o ${JSON.stringify(stO.best)}; fit ${T1 - T0} ms, lines ${T2 - T1} ms`);
  return { salience, ownership, t1, settings: { sal: stS.best, d: stD.best, o: stO.best },
           kappa: { sal: Object.fromEntries(stS.kappa), d: Object.fromEntries(stD.kappa), o: Object.fromEntries(stO.kappa) } };
})();
const issues = (() => {
  const F = ISSUES_FILE;
  if (!F || !Array.isArray(F.ownership) || !Array.isArray(F.salience)) return null;
  const pollOf = (w) => POLLS.find((q) => q.pollster === w.pollster && q.date === w.date) || null;
  const inWin = (mid) => { const d = ddays(refNow, mid); return d >= 0 && d <= SPARSE_K.window; };
  // ---- who is best: three-way rows per issue and party
  const own = {};                                // issue → { alp: rows, lnp: rows, onp: rows, lead pairs }
  const dots = {};                               // issue → [[x, pollster, date, alp, lnp, onp]]
  const grnTop = {};                             // issue → the newest in-window reading a Greens-offering house has the Greens first in
  const wavesIn = [];
  for (const w of F.ownership) {
    const p = pollOf(w) || { date: w.date, dateStart: w.dateStart, sample: w.sample, sampleEff: w.sampleEff };
    const mid = midMs(p), n0 = rowN(p), firm = w.pollster;
    let used = false;
    for (const k of ISSUE_SHARED) {
      const sh = w.issues[k];
      if (!sh || sh.onp == null || sh.alp == null || sh.lnp == null) continue;   // not the three-way question
      const named = sh.alp + sh.lnp + sh.onp;
      if (!(named > 0)) continue;
      used = true;
      const n = n0 * named / 100, ym = ymOf(w.date);
      const s3 = Object.fromEntries(OWN3.map((q) => [q, 100 * sh[q] / named]));
      const o = (own[k] ||= { alp: [], lnp: [], onp: [] });
      for (const q of OWN3) o[q].push({ ym, mid, x: s3[q], n, firm, s3 });
      // [x, pollster, fieldwork end, …three-way shares]: the chart's dots, each one its poll's archive row
      (dots[k] ||= []).push([r2(dx(w.date)), firm, w.date, ...OWN3.map((q) => r1(s3[q]))]);
      if (sh.grn != null && inWin(mid) && sh.grn > Math.max(sh.alp, sh.lnp, sh.onp)
          && (!grnTop[k] || grnTop[k].date < w.date)) {
        // the runner-up party on the same raw ballot: raw shares sit beside
        // the row's three-way renormalised ones, so "first (26)" only reads
        // right against the 18 the next party held on the same ballot
        const nx = [...OWN3, "oth"].filter((q) => sh[q] != null).sort((a, b) => sh[b] - sh[a])[0];
        grnTop[k] = { house: firm === "RedBridge/Accent" ? "RedBridge" : firm, grn: sh.grn, date: w.date, next: nx, nextV: sh[nx] };
      }
    }
    if (used && inWin(mid)) wavesIn.push({ w, p, d: ddays(refNow, mid) });
  }
  /* the Who's-trusted change view's snapshot month: November 2025, when
     RedBridge's six-issue set is the month's only three-party reading –
     crime, economy and everything else tile "Not polled" (user's call
     2026-10-10, over April 2026, which sat too close to now to show
     movement) */
  const SNAP0 = "2025-11";
  // ---- what matters: RedBridge's and Ipsos's top three, all voters
  const salRows = {}, salR1 = {};
  for (const w of F.salience) {
    const p = pollOf(w) || { date: w.date, dateStart: w.dateStart, sample: w.sample, sampleEff: w.sampleEff };
    for (const [k, v] of Object.entries(w.issues)) {
      const base = { ym: ymOf(w.date), mid: midMs(p), n: rowN(p), firm: w.pollster };
      // a null top3 must not enter as a point: x - heV coerces null to 0
      // downstream, reading the wave as 0% salience with no error anywhere
      if (v.top3 != null) (salRows[k] ||= []).push({ ...base, x: v.top3, date: w.date });
      // ranked first: RedBridge ranks its three, Ipsos doesn't
      if (v.r1 != null) (salR1[k] ||= []).push({ ...base, x: v.r1 });
    }
  }
  const houseName = (f) => (f === "RedBridge/Accent" ? "RedBridge" : f);
  /* each house's newest poll on the issue, as published, for the reader to
     see the two apart: within two months of the newest poll, so a house that
     stopped asking drops out */
  const salBy = (k) => [...new Set((salRows[k] || []).map((r) => r.firm))].map((f) => {
    const r = salRows[k].filter((x) => x.firm === f && x.mid <= refNow).sort((a, b) => b.mid - a.mid)[0];
    return r && ddays(refNow, r.mid) <= 61 ? { house: houseName(f), v: r.x, date: r.date } : null;
  }).filter(Boolean);
  /* today's figure from the issues model (§7hm): the line's median and 95%
     interval, its change on thirty days before (tested on the draws), and
     RedBridge's first-rank share as RedBridge's own (one house, no lean) */
  const salNow = (k) => {
    const m = ISSM && ISSM.salience[k];
    if (!m) return null;
    const r1v = salR1[k] && currentReading(salR1[k], null, SPARSE_K);
    return { v: m.v, ci: m.ci, lo: m.lo, hi: m.hi, r1: r1v ? r1v.v : null, by: salBy(k),
             // the steady gap between the two regular houses today, RedBridge minus Ipsos
             ...(m.gap != null ? { gap: { houses: ["RedBridge", "Ipsos"], v: m.gap } } : {}),
             chg: m.chg, changeSig: m.changeSig, chgLo: m.chgLo, chgHi: m.chgHi };
  };
  const E0 = ymOf(ELECTION.date);
  const list = ISSUE_SHARED.map((k) => {
    const o = own[k], MO = ISSM && ISSM.ownership[k], MS = ISSM && ISSM.salience[k];
    /* who is best today, from the issues model (§7hm): the three shares'
       medians and 95% intervals, the leader's margin over the runner-up
       tested on the draws (leadSig: ahead in 97.5% of them), and where it
       isn't, whether the runner-up is clear of the third (pairSig) */
    let ownNow = null;
    if (MO && MO.cur) {
      const c = MO.cur;
      ownNow = { v: c.v, ci: c.ci, lo: c.lo, hi: c.hi, chg: c.chg, chgSig: c.chgSig,
        n: o ? Math.round(o.alp.filter((r) => inWin(r.mid)).reduce((a, r) => a + r.n, 0)) : null,
        lead: c.lead, runner: c.runner, third: c.third, gap: c.gap, gapCi: c.gapCi, gapLo: c.gapLo, gapHi: c.gapHi, pLead: c.pLead, leadSig: c.leadSig,
        ...(c.gap2 != null ? { gap2: c.gap2, gap2Ci: c.gap2Ci, pairSig: c.pairSig } : {}),
        houses: o ? [...new Set(o.alp.filter((r) => inWin(r.mid)).map((r) => houseName(r.firm)))] : [] };
    }
    /* [ym, alp, lnp, onp, ±alp, ±lnp, ±onp] – the model's month by month,
       from the first month One Nation was offered by name (the three shares
       need it); the half-widths are half the 95% interval */
    const monthly = MO ? MO.months3 : [];
    /* the parked change view's snapshot month, on the model's draws */
    const snap = MO ? MO.at3(SNAP0) : null;
    /* What matters' term view: the model's months since the election as
       [ym, v, ±, lo, hi], and every reading this term moved onto the line as
       [x, house, wave date, printed share, n, moved share, question form] –
       the printed share feeds the client's within-house trend tests */
    const salM = MS ? MS.months.filter((m) => m[0] >= E0).map((m) => [m[0], m[1], r1((m[3] - m[2]) / 2), m[2], m[3]]) : [];
    const salD = MS ? MS.dots.filter((d) => d[2] >= ELECTION.date && !d[7]).map((d) => d.slice(0, 7)) : [];
    return { id: k, label: F.issues[k], imp: salNow(k), own: ownNow, monthly,
             ...(salM.length ? { salMonthly: salM } : {}), ...(salD.length ? { salDots: salD } : {}),
             ...(snap ? { snap } : {}),
             dots: (dots[k] || []).sort((a, b) => a[0] - b[0]), ...(grnTop[k] ? { grnTop: grnTop[k] } : {}) };
  }).filter((it) => it.own || it.imp);
  if (!list.length) return null;
  // ordered by how many voters put the issue in their top three
  list.sort((a, b) => (b.imp?.v ?? -1) - (a.imp?.v ?? -1));
  // ---- what matters to whom: RedBridge's tables by group
  const gRows = {};                              // set|group|issue → rows
  let gHouse = null, gNewest = null;
  for (const w of F.salienceGroups || []) {
    const p = pollOf(w);
    const mid = midMs(p || w), n0 = rowN(p || { sample: w.sample, sampleEff: w.sampleEff });
    for (const [k, dims] of Object.entries(w.issues)) for (const [set, gs] of Object.entries(dims)) {
      if (!ISSUE_GROUP_SETS.some((s) => s.id === set)) continue;
      for (const [g, v] of Object.entries(gs)) {
        const share = issueGroupShare(set, g, p);
        if (!share) continue;
        (gRows[set + "|" + g + "|" + k] ||= []).push({ mid, x: v.r1 + v.r2 + v.r3, n: n0 * share, firm: w.pollster, date: w.date });
      }
    }
    if (inWin(mid)) { gHouse = w.pollster; if (!gNewest || w.date > gNewest) gNewest = w.date; }
  }
  // the trend table's window: waves touched down since election day itself
  const elect0 = new Date(ELECTION.date).getTime();
  const groupTabs = ISSUE_GROUP_SETS.map((s) => {
    const keys = Object.keys(gRows).filter((key) => key.startsWith(s.id + "|"));
    // the groups and issues the window holds, in the order the house prints them
    const inw = keys.filter((key) => gRows[key].some((r) => inWin(r.mid)));
    // the newest in-window wave's own printed order first, then anything older
    const newestW = (F.salienceGroups || []).filter((w) => inWin(midMs(pollOf(w) || w)))
      .sort((a, b) => (a.date < b.date ? 1 : -1))[0];
    const printed = newestW ? Object.keys(Object.values(newestW.issues)[0]?.[s.id] || {}) : [];
    const seenNow = new Set(inw.map((key) => key.split("|")[1]));
    const groupsSeen = [...new Set([...printed.filter((g) => seenNow.has(g)), ...seenNow])];
    const issuesSeen = list.map((it) => it.id).filter((k) => inw.some((key) => key.endsWith("|" + k)))
      .concat([...new Set(inw.map((key) => key.split("|")[2]))].filter((k) => !ISSUE_SHARED.includes(k)));
    if (!groupsSeen.length || !issuesSeen.length) return null;
    const cells = Object.fromEntries(groupsSeen.map((g) => [g, Object.fromEntries(issuesSeen.map((k) => {
      const e = gRows[s.id + "|" + g + "|" + k] && weightedWithSe(nowcastPts(gRows[s.id + "|" + g + "|" + k], null, refNow, SPARSE_K));
      return [k, e ? { v: r1(e.v), ci: r1(1.96 * e.se) } : null];
    }))]));
    /* the trend table's raw series: this house's waves since the election as
       [decimal-year x, share, effective n], per group per issue; all-voters
       takes the group house's own line, as the table's row does (never the
       pooled one above) */
    const trOf = (rs) => (rs || []).filter((r) => r.mid >= elect0).map((r) => [r2(dx(r.date)), r1(r.x), Math.round(r.n)]);
    const tr = {
      all: Object.fromEntries(issuesSeen.map((k) => [k, trOf((salRows[k] || []).filter((r) => r.firm === gHouse))])),
      g: Object.fromEntries(groupsSeen.map((g) => [g, Object.fromEntries(issuesSeen.map((k) => [k, trOf(gRows[s.id + "|" + g + "|" + k])]))])),
    };
    return { id: s.id, label: s.label, groups: groupsSeen, issues: issuesSeen, cells, tr };
  }).filter(Boolean);
  wavesIn.sort((a, b) => a.d - b.d);
  /* the group table's all-voters row: the group house's own reading, never
     the pooled one above – its groups average to its figure, not the pool's */
  const gAll = {};
  for (const k of new Set(groupTabs.flatMap((t) => t.issues))) {
    const e = salRows[k] && currentReading(salRows[k].filter((r) => r.firm === gHouse), null, SPARSE_K);
    if (e) gAll[k] = { v: e.v, ci: e.ci95 };
  }
  // the largest lean taken off a three-way share today, from a house with a poll in the window (the Info entry)
  let leanMax = null;
  for (const it of list) if (it.own && ISSM && ISSM.ownership[it.id]) for (const f of new Set(own[it.id].alp.filter((r) => inWin(r.mid)).map((r) => r.firm))) {
    const ls = ISSM.ownership[it.id].leanShares(f);
    if (ls) for (const q of OWN3) if (Math.abs(ls[q]) >= 0.05 && (!leanMax || Math.abs(ls[q]) > Math.abs(leanMax.v))) leanMax = { house: houseName(f), party: q, issue: it.id, v: ls[q] };
  }
  /* credited: the houses with a poll in the window, and each house whose
     newest poll sets the grey bars' level through its gap to the other,
     even once that poll has left the window (Ipsos's, for part of each month) */
  const salCredit = [...new Map(list.flatMap((it) => (it.imp?.gap ? it.imp.by : []).map((b) => [b.house, b]))).values()];
  /* Enrich the archive rows' iss payloads (hung on their rows in §5i) with
     what the expanded poll's "How it counts" rail quotes: whether the wave
     sits in the window today's estimate draws on, and this house's measured
     lean on the figure the rail headlines. Ownership takes the leading
     party's share lean (the ownHE estimator above); salience takes the
     pair's wording gap, oriented so this house's reading minus the other's
     is the sign (pairLeanFor splits it half each – the rail prints this
     house's half). SEC Newgate's concerns bank and every house's raw
     as-filed shares aren't pooled series, so their rows carry no lean. */
  /* …two passes, one per question family: a wave that asked both (every
     RedBridge and Ipsos wave) collects both leans onto the one plus. The w
     flag says the wave counts toward today's estimate in AT LEAST ONE
     family, mirroring the pooling above: salience waves always pool,
     ownership waves only when some issue asked the three-way figures. */
  for (const w of F.salience) {
    const iss = ISS_BY.get(w.date + "|" + w.pollster);
    if (!iss || !iss.top || !iss.sal) continue;
    const p = pollOf(w) || { date: w.date, dateStart: w.dateStart };
    const plus = iss.plus || (iss.plus = { w: inWin(midMs(p)) ? 1 : 0 });
    const g = ISSM && ISSM.salience[iss.top] ? ISSM.salience[iss.top].gap : null;
    if (g != null && (w.pollster === "RedBridge/Accent" || w.pollster === "Ipsos")) plus.pair = w.pollster === "RedBridge/Accent" ? g : r1(-g);
  }
  for (const w of F.ownership) {
    const iss = ISS_BY.get(w.date + "|" + w.pollster);
    if (!iss || !iss.own) continue;
    const p = pollOf(w) || { date: w.date, dateStart: w.dateStart };
    const used = ISSUE_SHARED.some((k) => { const s = w.issues[k];
      return s && s.alp != null && s.lnp != null && s.onp != null; });
    const plus = iss.plus || (iss.plus = { w: used && inWin(midMs(p)) ? 1 : 0 });
    const k = iss.top, sh = k && w.issues[k];
    if (sh && OWN3.every((q) => sh[q] != null)) {
      const q = OWN3.reduce((a, b) => (sh[b] > sh[a] ? b : a));
      const ls = ISSM && ISSM.ownership[k] ? ISSM.ownership[k].leanShares(w.pollster) : null;
      const v = ls ? ls[q] : 0;
      plus.lead = q;
      if (Math.abs(v) >= 0.05) plus.lean = r1(v);
    }
  }
  return {
    window: SPARSE_K.label, parties: OWN3, list, labels: F.issues, leanMax, snapYm: SNAP0,
    houses: creditHouses([...wavesIn.map((r) => ({ f: houseName(r.w.pollster), t: Date.parse(r.w.date) })),
                          ...salCredit.filter((b) => !wavesIn.some((r) => houseName(r.w.pollster) === b.house))
                            .map((b) => ({ f: b.house, t: Date.parse(b.date) }))], (r) => r.f, (r) => r.t),
    // the polls the window holds, newest first (the Info entry's working)
    polls: wavesIn.map(({ w, p }) => ({
      pollster: houseName(w.pollster),
      dateLabel: fwLabel(p.dateStart, p.date), source: w.source || null,
      options: w.options || null,
    })),
    groups: groupTabs.length ? { tabs: groupTabs, house: houseName(gHouse), all: gAll,
                                 newest: gNewest, window: SPARSE_K.label } : null,
  };
})();
/* The issues' long view (build.mjs's issues-history sidecar, fetched when a
   window behind this term opens): per issue, what matters month by month as
   far back as any poll reaches, with every reading moved onto the line, and
   Labor's share of those naming Labor or the Coalition, month by month, with
   each poll's printed two-way share. */
const ISSUES_HIST = ISSM ? {
  issues: Object.fromEntries(ISSUE_SHARED.map((k) => [k, {
    sal: ISSM.salience[k] ? { months: ISSM.salience[k].months, dots: ISSM.salience[k].dots } : null,
    own: ISSM.ownership[k] ? { months: ISSM.ownership[k].months2, dots: ISSM.ownership[k].dots2 } : null,
  }])),
} : null;
if (issues) {
  // three-way shares are shares of one whole: a pooled set that doesn't make 100 is a bug
  for (const it of issues.list) if (it.own) {
    const t = OWN3.reduce((a, q) => a + it.own.v[q], 0);
    if (Math.abs(t - 100) > 0.3) throw new Error(`issues: ${it.id} three-way shares sum to ${t}`);
  }
}

/* ---- 7f. ALP–ON current figure: primaries through the first-principles
   flow set ---------------------------------------------------------------
   No election count of an ALP-v-ON pairing exists, and by mid-2026 the
   industry was quoting that pairing three points apart house to house under
   uncoordinated respondent allocations. The figure this page QUOTES for the
   pairing therefore comes from one uniform flow set applied to the §7e
   current primaries. The set itself is FP_ON (flows.mjs, where the
   provenance lives). The pollsters' published head-to-heads are demoted to
   corroboration: they remain the alt2pp/altLatest series and the
   flowDriftOn monitor's input.

   The level is quoted with BOTH its doubts: band, the table's own range
   (linear stack, share scale), and cs, the polls' 95% sampling interval on
   the same figure, combined in quadrature as ci95 - the margin every
   reader-facing ± and "too close to call" verdict reads. Until 2026-10-11
   the level carried band alone, on the argument that a sampling interval
   would be false precision with no count to check the table against. That
   left the sampling error out rather than the table's doubt in: the hero
   called Labor "ahead" on a 4.0-point lead against a ±2.6 flow range when
   the same polls' sampling error alone was ±3.8 on the lead. */
const impliedOnFp = (p) => p.alp + p.lnp * FP_ON.lnp + p.grn * FP_ON.grn + p.oth * FP_ON.oth;
const onImp = primaryNow && (() => {
  const a = impliedOnFp(primaryNow);
  const band = primaryNow.lnp * FP_ON_BAND.lnp + primaryNow.grn * FP_ON_BAND.grn
             + primaryNow.oth * FP_ON_BAND.oth;   // linear worst-case stack, share scale
  const prev = primaryNowAt(refNow - 30 * 86400000);
  /* The month-on-month significance, which the BAND above cannot supply.

     The table is frozen, so it is the same table at both dates and its
     error enters the difference scaled by the primary MOVES rather than the
     primary LEVELS - 0.02 points a month against ~1.3 on the level, a
     factor of ~70. What is left driving the change is ordinary sampling
     error, and that is estimable - the same sampling error the level's cs
     carries.

     Taken from the row-level series rather than by propagating primaryNow's
     per-party SEs through impliedOnFp: the primaries are shares summing to
     100 and are negatively correlated, so combining their SEs as if they
     were independent would overstate the error. Each tppRowsSynthOn row is
     already one scalar, which sidesteps the covariance entirely. It is the
     same quantity by either route - the row nowcast reads 51.2/51.9 against
     the aggregate-primaries 51.2/52.0 - so the SE belongs to the figure.

     Same RSS rule as synthChg (§1b) and altNowcast (§6): three of the four
     basis x contest cells made this call already, the PUBLISHED ALP-v-ON
     among them. */
  const nw = KF || TPM ? null : nowcastAdj(tppRowsSynthOn, synthOnEffect, refNow);
  const pv = KF || TPM ? null : nowcastAdj(tppRowsSynthOn, synthOnEffect, refNow - 30 * 86400000);
  const chg = KF ? kfChgOf(KF_NOW.on) : TPM ? tpmChg(TPM.on) : (nw && pv && nw.se != null && pv.se != null)
    ? (() => {
        const seChg = Math.sqrt(nw.se ** 2 + pv.se ** 2);
        return { changeSe: r1(seChg), changeCi95: r1(1.96 * seChg),
                 changeSig: Math.abs(nw.v - pv.v) > 1.96 * seChg };
      })()
    : {};
  // the level's sampling interval: the nowcast's own (or the trend's, /vic/),
  // the interval synthLatest quotes on the classic pairing
  const lvl = KF ? kfNow(KF_NOW.on) : TPM ? tpmNow(TPM.on, tppLin.n) : nw;
  const cs = lvl && lvl.ci95 != null ? lvl.ci95 : null;
  return { a: r1(a), b: r1(100 - a), band: r1(band),
           ...(cs != null ? { cs: r1(cs), ci95: r1(Math.hypot(cs, band)) } : { ci95: r1(band) }),
           n: primaryNow.n, aPrev: prev ? r1(impliedOnFp(prev)) : null, ...chg };
})();

/* ---- 8. headline readings ---------------------------------------------- */
/* The reader-facing count. Products stay distinct series everywhere above –
   an (MRP) release is its own schedule, its own house effect – but this
   number says POLLSTERS, and "YouGov (MRP)" is YouGov. */
const houses = new Set(POLLS.map((p) => p.pollster.replace(/ \((MRP|SMS|pooled)\)$/, "")));
const fmtDate = (iso) => { const [y, m, d] = iso.split("-").map(Number); return `${d} ${MNF[m - 1]} ${y}`; };
/* Which rival leads the board: Labor's main rival goes first, in the hero
   and in every legend that lists the two contests.

   Ranked on the IMPLIED basis, always, whatever the hero's own toggle says.
   That is not a shortcut: the two contests are only comparable when they are
   read through one frozen table, because the published ALP-v-ON figures are
   each house's private allocation and the published ALP-v-L/NP figures are a
   different private allocation again.

   The ruling is one margin test, month by month (a pure function of the
   data, so every build reproduces it). One Nation takes the spot only in a
   month it runs Labor closer AFTER PREFERENCES by more than the gap's own
   margin; every other month the Coalition holds it. The gap is read poll by
   poll (the two implied figures come from the same primaries, so most of
   their sampling error cancels in it: per respondent the variance is that of
   the flow difference between the two tables) and its margin adds the One
   Nation table's own range, which no number of polls can narrow.

   The Coalition is the default because Labor v Coalition is the two-party
   figure every pollster publishes, it has an election count to anchor it,
   and it carries no assumed flow table, so its margin is the tighter one.
   Until 2026-10-13 a tie went to the rival clearly ahead on FIRST
   preferences, which handed One Nation the spot from February 2026 on a 2PP
   gap no month ever cleared (never more than 1.2 points, against a margin
   near 1.45); the user's call was that the default contest should be the
   2PP one. Before 2026-10-11 a fixed one-point deadband decided it. Each
   month's ruling records why (why: "2pp" when the gap decided it,
   "default" otherwise). */
/* federal (§2t): the same two tests on the model's draws, month by month -
   the gap between the two implied pairs (its 95% interval with the ALP-v-ON
   table's range added) and One Nation's primary less the Coalition's */
const rivalEvidence = TPM ? Object.fromEntries(MONTHS.map((ym) => {
  const i = TPM.gap.months.findIndex((m) => m.ym === ym);
  if (i < 0) return [ym, null];
  const g = TPM.gap.months[i], q = TPM.prim.months[i];
  return [ym, { gap: g.v, gapM: Math.hypot(g.ci, TPM.cf.get(g.day) || 0), prim: q.v, primM: q.ci }];
})) : (() => {
  const onBy = new Map(tppRowsSynthOn.map((r) => [r.key, r]));
  const share = (p) => {
    const q = { alp: p.alp || 0, lnp: p.lnp || 0, grn: p.grn || 0, onp: p.onp || 0, oth: (p.ind || 0) + (p.oth || 0) };
    const t = q.alp + q.lnp + q.grn + q.onp + q.oth;
    return t ? Object.fromEntries(Object.entries(q).map(([k, v]) => [k, v / t])) : null;
  };
  // each respondent's flow to Labor against the Coalition minus against One
  // Nation, in points: the 2PP gap's per-respondent spread (pq)
  const dGap = { alp: 0, lnp: -100 * FP_ON.lnp, grn: 100 * (FLOW.grn - FP_ON.grn),
                 onp: 100 * FLOW.onp, oth: 100 * (FLOW.oth - FP_ON.oth) };
  const gapRows = [], primRows = [];
  for (const r of tppRowsSynth) {
    const o = onBy.get(r.key), p = POLL_BY_KEY.get(r.key), q = p && share(p);
    if (!o || !q) continue;
    const m1 = Object.keys(dGap).reduce((t, k) => t + q[k] * dGap[k], 0);
    const m2 = Object.keys(dGap).reduce((t, k) => t + q[k] * dGap[k] ** 2, 0);
    gapRows.push({ ...r, x: r.x - o.x, pq: Math.max(m2 - m1 * m1, 1) });
    primRows.push({ ...r, x: p.onp - p.lnp, pq: Math.max(1e4 * ((q.onp + q.lnp) - (q.onp - q.lnp) ** 2), 1) });
  }
  const gapHE = houseEffectsFor(gapRows), primHE = houseEffectsFor(primRows);
  const cfBy = Object.fromEntries(agg2ppSynthOn.map((d) => [d.ym, d.cf]));
  return Object.fromEntries(MONTHS.map((ym) => {
    const g = monthWithSe(gapRows, gapHE, ym), q = monthWithSe(primRows, primHE, ym);
    return [ym, g && {
      gap: g.v, gapM: Math.hypot(1.96 * g.se, cfBy[ym] || 0),
      prim: q ? q.v : null, primM: q ? 1.96 * q.se : null,
    }];
  }));
})();
/* The walk is kept month by month, not just its end: Past cycles draws the
   sitting term's 2PP against whichever rival held the spot in each month, so
   that line and the hero can never disagree about who Labor was facing. */
const rivalWalk = (() => {
  return agg2ppSynth.map((d) => {
    const e = d.election ? null : rivalEvidence[d.ym];
    if (e && e.gap > e.gapM) return { ym: d.ym, who: "alp_on", why: "2pp" };    // One Nation clearly closer
    return { ym: d.ym, who: "alp_lnp", why: e && e.gap < -e.gapM ? "2pp" : "default" };
  });
})();
const rivalLead = rivalWalk.length ? rivalWalk[rivalWalk.length - 1].who : "alp_lnp";
const rivalByYm = Object.fromEntries(rivalWalk.map((r) => [r.ym, r.who]));
const rivalWhyByYm = Object.fromEntries(rivalWalk.map((r) => [r.ym, r.why]));

/* The primary-vote facet's column order, shared by the Latest and All-polls
   tables. Highest aggregate sits leftmost – but the ALP/ON/LNP primaries have
   crossed and recrossed this term on 0.2-0.5-point monthly differences, and a
   naive "rank this month's numbers" rule would shuffle the columns on moves
   the page would not otherwise call real. A fixed deadband (the rival ruling
   used the same one until 2026-10-11, when it moved to margin tests):
   a party overtakes the one above it only when its aggregate leads by more
   than PRIMARY_DEADBAND, and then holds the slot until the reverse happens.
   Walked forward monthly from the election anchor rather than stored, so the
   order is a pure function of the data and every build reproduces it.
   Since 2026-10-03 the All-polls house-lean tab row, the Latest-and-
   next primary facet AND the redesign All-polls tab's primary facet ride
   the SAME emission (rd-allpolls.jsx hlViews and prims, rd-polls.jsx
   plParties) alongside the Latest/All-polls table columns – as do, from
   the same day, the redesign tab's expanded-poll primary ladder, its
   modelled-seats sentence, its row primary dots and its issues
   ownership dots (RdApDetail prim/seats + the row strip's rd-ap-dots,
   all rd-allpolls.jsx). Change the walk here and every surface moves
   together. */
const PRIMARY_DEADBAND = 1.0;
const primaryOrder = (() => {
  const order = [...PRIMARY_KEYS];
  for (const m of aggPrimary) {
    if (PRIMARY_KEYS.some((k) => m[k] == null)) continue;
    let moved = true;
    while (moved) {
      moved = false;
      for (let i = order.length - 2; i >= 0; i--) {
        if (m[order[i + 1]] > m[order[i]] + PRIMARY_DEADBAND) {
          [order[i], order[i + 1]] = [order[i + 1], order[i]];
          moved = true;
        }
      }
    }
  }
  return order;
})();

/* The release the masthead names as its "Latest poll": the newest by
   PUBLICATION among every poll LATEST_PUB_ISO reads, so the name and the
   "published …" stamp beside it always come from the same row. It used to
   be the newest row of the Latest polls table, which leaves out releases
   that join no aggregate. On 12 Oct 2026 DemosAU's quarterly MRP,
   published that morning, set the stamp to "today" while the name stayed
   on the Newspoll from the night before. */
/* The >= tie-break keeps the LAST same-day row (POLLS walks oldest first),
   not the first: two houses publishing together, the masthead names the
   one with the fresher fieldwork rather than an arbitrary earlier entry. */
const NEWEST_PUB = POLLS.reduce((b, p) => ((p.published || p.date) >= (b ? b.published || b.date : "") ? p : b), null);

const latest = {
  alp2pp: hlNow.alp, lnp2pp: r1(100 - hlNow.alp),
  alp2ppPrev: hl1mo ? hl1mo.alp : agg2pp[agg2pp.length - 2].alp,
  /* Uncertainty on the headline, and on the month-on-month change. The change
     is a difference of two independent windows (21d apart, no shared polls),
     so its SE is the root-sum-square. changeSig says whether the movement
     clears its own 95% interval – the arrow is qualified when it doesn't. */
  alp2ppSe: hlNow.se ?? null,
  alp2ppCi95: hlNow.ci95 ?? null,
  alp2ppNEff: hlNow.nEff ?? null,
  ...(KF ? kfChgOf(KF_NOW.tpp) : TPM && TPM.pub ? tpmChg(TPM.pub) : hl1mo && hlNow.se != null ? (() => {
    const seChg = Math.sqrt(hlNow.se ** 2 + hl1mo.se ** 2);
    const chg = hlNow.alp - hl1mo.alp;
    return { changeSe: r1(seChg), changeCi95: r1(1.96 * seChg), changeSig: Math.abs(chg) > 1.96 * seChg };
  })() : {}),
  /* The quoted "current primary" – the §7e nowcast, NOT aggPrimary's last
     monthly point (that stays the chart series). Shares only; the window
     count rides as primaryNow's own n where a reader needs it. */
  primary: primaryNow && Object.fromEntries(PRIMARY_KEYS.map((k) => [k, primaryNow[k]])),
  /* federal: the model's view of the same figures – each share's 95%
     interval, its change on a month (the posterior of the difference: sig
     when the interval excludes zero, pUp the chance it rose), the chance
     each party is ahead of each other, and where the count would land if
     the polls missed as they have at past elections (each share less the
     2007–2025 average miss, that miss's spread added) */
  primaryModel: PRIMM ? (() => {
    const N = PRIMM.fit.nDraw, P = PM_PARTIES.length, nowD = PRIMM.fit.shares(PRIMM.t1), rng = (() => { let x = 20261124; return () => { x = (x * 1103515245 + 12345) >>> 0; return x / 4294967296; }; })();
    const gauss = () => { let u = 0, v = 0; while (!u) u = rng(); v = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
    const elec = Object.fromEntries(PM_PARTIES.map((k, q) => {
      const c = Array.from({ length: N }, (_, i) => 100 * nowD[i * P + q] - PRIM_MISS[k][0] + PRIM_MISS[k][1] * gauss());
      return [k, [r1(pmQuant(c, 0.025)), r1(pmQuant(c, 0.975))]];
    }));
    return {
      method: "bayes", draws: N, ...Object.fromEntries(["lo", "hi", "ci"].map((f) => [f, Object.fromEntries(PRIMARY_KEYS.map((k) => [k, r1(PRIMM.now[k][f])]))])),
      chg: PRIMM.chg, pAhead: PRIMM.pAhead, electionBand: elec, miss: PRIM_MISS,
      houses: PRIMM.fit.L.houses.length + PRIMM.fit.L.lone.size, zeroHouses: PRIMM.fit.L.core,
    };
  })() : null,
  /* The ALP–ON pairing's ONLY quoted level: the §7f implied figure (uniform
     first-principles flow set on the §7e primaries). ci95 is its margin -
     the sampling interval (cs) and the flow table's range (band) added in
     quadrature. Pollsters' published head-to-heads stay in altLatest as
     corroboration. */
  onImp,
  updated: fmtDate(LATEST_ISO), updatedISO: LATEST_ISO,
  published: fmtDate(LATEST_PUB_ISO), publishedISO: LATEST_PUB_ISO,
  /* the masthead's "Latest poll" (see NEWEST_PUB): pollster and fieldwork,
     linked to the release – the pollster's own page over a media citation */
  newest: NEWEST_PUB && {
    pollster: NEWEST_PUB.pollster, field: fwLabel(NEWEST_PUB.dateStart, NEWEST_PUB.date),
    ...(NEWEST_PUB.fieldworkPending ? { fieldPending: true, fieldUrl: fieldTbcUrl(NEWEST_PUB.pollster) } : {}),
    url: NEWEST_PUB.releaseUrl || NEWEST_PUB.url || null,
  },
  /* the id the hero opens on, and the order every legend listing the
     two Labor contests should use */
  rivalLead,
  /* the primary-vote facet's column order in the poll tables – highest
     aggregate leftmost, an overtake only once a full point clears */
  primaryOrder,
  /* the masthead's "Next election" fact: the federal term's latest legal
     date, or another jurisdiction's own (Victoria's is fixed by law) */
  nextElectionDue: JUR ? JUR.nextElection.label : "By 20 May 2028",
  ...(JUR ? { nextElectionISO: JUR.nextElection.date, nextElectionFixed: !!JUR.nextElection.fixed } : {}),
  pollsTracked: individualPolls.length, housesTracked: houses.size,
  /* deff rides in the payload so the page's discord engine reads the SAME
     constant the node estimator used (it lives in an untransformed asset and
     used to mirror 1.6 by hand, free to drift). */
  /* recipeAlp2pp: the three-week window's published 2PP, kept beside the
     model's (§2t) as the parity control deff-backtest.mjs holds its copy of
     the window recipe to */
  method: { kind: KF ? "kalman" : TPM ? "model" : "weighted house-effect-adjusted mean",
    ...(TPM ? { recipeAlp2pp: (() => { const h = headlineTpp(refNow); return h ? r1(h.alp) : null; })() } : {}), windowDays: HL_WINDOW, halfLifeDays: HL_HALF, taperDays: HL_TAPER, shrinkK: SHRINK_K, nPolls: hlNow.n, deff: HL_DEFF },
};

/* ---- 8b. show-your-working: the rows behind the two headline estimates ---
   The glossary's weighted-aggregate entry prints the headline as tables of
   its own inputs, so a reader can reproduce the number from data/polls.json
   by hand rather than take a formula on trust. Built line-for-line from
   nowcastAdj (the 21-day 2PP window) and primaryNow (the §7e 21-day
   ALP-primary nowcast) – same helpers, same weights – so each
   table's Σwᵢxᵢ ÷ Σwᵢ line reproduces the figure in the hero. The console
   lines at the end compare these sums against the estimates themselves, so
   estimator drift that an emitted table would now contradict shows in the
   build log. */
const dayMon = (ms) => { const t = new Date(ms); return `${t.getUTCDate()} ${MN[t.getUTCMonth()]}`; };
/* a wave's fieldwork as it fits the table – "10–16 Aug" in-month, so the
   range columns stay narrow; the window and month these tables describe are
   days-to-weeks old, the year is never in doubt at view time */
const fwText = (p) => {
  if (!p.dateStart || p.dateStart === p.date) return dayMon(new Date(p.date).getTime());
  const s = new Date(p.dateStart), e = new Date(p.date);
  return s.getUTCMonth() === e.getUTCMonth()
    ? `${s.getUTCDate()}–${dayMon(e.getTime())}`
    : `${dayMon(s.getTime())} – ${dayMon(e.getTime())}`;
};
const showWorking = KF ? {} : (() => {   // /vic/'s figures are the trend's: no 21-day tables
  // 2PP: polls whose fieldwork mid falls inside the trailing window – the
  /* federal (§2t): the published pair's model has no window of weights;
     its working is each recent published figure, the house's lean then, the
     figure less the lean, the line at its fieldwork without it, and its pull */
  let tppModelWork = null;
  if (TPM && TPM.pub) {
    const rows = tppRows.filter((a) => { const d = ddays(refNow, a.mid); return d >= 0 && d <= HL_WINDOW; }).sort((a, b) => a.mid - b.mid).map((a) => {
      const p = POLL_BY_KEY.get(a.key), y = TPM.pub.yard(a.key);
      return { firm: a.firm, fw: fwText(p), mid: dayMon(a.mid), pair: p.tpp_lnp != null ? `${p.tpp_alp}–${p.tpp_lnp}` : `${p.tpp_alp}`,
               x: r2(a.x), lean: y && y.he != null ? r2(y.he) : null, adj: y && y.he != null ? r2(a.x - y.he) : null,
               level: y ? r2(y.v) : null, pull: y ? r2(y.dNow) : null };
    });
    tppModelWork = { model: true, rows, k: rows.length, ref: dayMon(refNow), v: hlNow.alp, lo: r1(TPM.pub.now.lo), hi: r1(TPM.pub.now.hi),
      polls: TPM.pub.n, houses: TPM.pub.houses.length + TPM.pub.lone.size };
  }
  // filter is nowcastAdj's own predicate, ref and constants included
  const tppRowsIn = TPM && TPM.pub ? [] : tppRows.filter((a) => { const d = ddays(refNow, a.mid); return d >= 0 && d <= HL_WINDOW; });
  tppRowsIn.sort((a, b) => a.mid - b.mid);
  let tpp = null;
  if (tppRowsIn.length) {
    const waves = new Map();
    for (const a of tppRowsIn) waves.set(a.firm, (waves.get(a.firm) || 0) + 1);
    let sw = 0, swx = 0;
    const rows = tppRowsIn.map((a) => {
      const p = POLL_BY_KEY.get(a.key);
      const d = ddays(refNow, a.mid);
      const w = a.n * recencyW(d) / Math.sqrt(waves.get(a.firm));
      const lean = heV(houseEffect, a.firm, refNow);
      const adj = a.x - lean;
      sw += w; swx += adj * w;
      return { firm: a.firm, fw: fwText(p), mid: dayMon(a.mid), d: r1(d),
               pair: p.tpp_lnp != null ? `${p.tpp_alp}–${p.tpp_lnp}` : `${p.tpp_alp}`,
               x: r2(a.x), lean: r2(lean), adj: r2(adj),
               n: Math.round(a.n), m: waves.get(a.firm), w: r2(w) };
    });
    tpp = { rows, k: tppRowsIn.length, sw: r2(sw), swx: r2(swx), mean: r2(swx / sw), v: r1(swx / sw) };
  }
  /* ALP primary: the §7e nowcast window – rebuilt from POLLS only so each
     row can name its fieldwork; the wave counts, weights and lean calls are
     the estimator's own. The five-party check rides from primaryNow itself
     (ONE source for it); the Σ of THIS table's rows must reproduce it,
     which the guard below enforces. */
  let primary = null;
  /* federal: the model has no window of weights. Its working is each recent
     poll (fieldwork midpoint in the 21 days to the newest) with its printed
     Labor share, the house's lean then, the share less the lean, and its
     pull – how far today's Labor figure would move without it */
  if (PRIMM && primaryNow) {
    const rows = PRIMM.readings.filter((r) => r.day <= PRIMM.t1 && PRIMM.t1 - r.day <= HL_WINDOW).map((r) => {
      const p = POLLS[r.idx], y = pmYard.get(r.key), lean = y && y.he ? 100 * y.he[0] : null;
      return { firm: p.pollster, fw: fwText(p), mid: dayMon(midMs(p)), x: r2(p.alp), lean: lean == null ? null : r2(lean),
               adj: lean == null ? null : r2(p.alp - lean), level: y ? r2(100 * y.level[0]) : null, pull: y ? r2(100 * y.dNow[0]) : null };
    });
    primary = { model: true, rows, k: rows.length, ref: dayMon(refNow), v: primaryNow.alp,
                lo: r1(PRIMM.now.alp.lo), hi: r1(PRIMM.now.alp.hi), polls: PRIMM.readings.length,
                houses: PRIMM.fit.L.houses.length + PRIMM.fit.L.lone.size, zero: PRIMM.fit.L.core.length };
  }
  else if (primaryNow) {
    const wPolls = POLLS.filter((p) => { if (p.alp == null) return false; if (noAggPoll(p)) return false; const d = ddays(refNow, midMs(p)); return d >= 0 && d <= HL_WINDOW; });
    wPolls.sort((a, b) => midMs(a) - midMs(b));
    const waves = new Map();
    for (const p of wPolls) waves.set(p.pollster, (waves.get(p.pollster) || 0) + 1);
    let sw = 0, swx = 0;
    const rows = wPolls.map((p) => {
      const n = rowN(p);
      const d = ddays(refNow, midMs(p));
      const w = n * recencyW(d) / Math.sqrt(waves.get(p.pollster));
      const lean = heV(primaryHE.alp, p.pollster, refNow);
      const adj = p.alp - lean;
      sw += w; swx += adj * w;
      return { firm: p.pollster, fw: fwText(p), mid: dayMon(midMs(p)), d: r1(d),
               x: r2(p.alp), lean: r2(lean), adj: r2(adj),
               n: Math.round(n), m: waves.get(p.pollster), w: r2(w) };
    });
    primary = { rows, k: wPolls.length, ref: dayMon(refNow),
                sw: r2(sw), swx: r2(swx), mean: r2(swx / sw),
                parties: primaryNow.parties,
                plainTotal: r2(primaryNow.plainTotal), adjTotal: r2(primaryNow.adjTotal),
                rescaled: primaryNow.rescaled,
                v: r1(primaryNow.rescaled ? (swx / sw) * (primaryNow.plainTotal / primaryNow.adjTotal) : swx / sw) };
  }
  return { tpp: tppModelWork || tpp, primary };
})();
/* The tables must say what the estimates say – drift here means an emitted
   table contradicts the hero it claims to explain. Fail the build, don't
   warn-and-ship a page that disagrees with itself. */
if (showWorking.tpp && showWorking.tpp.v !== hlNow.alp)
  throw new Error(`show-working 2pp ${showWorking.tpp.v} != headline ${hlNow.alp} – emitted table would contradict the hero`);
if (!KF && showWorking.primary && showWorking.primary.v !== primaryNow.alp)
  throw new Error(`show-working primary ${showWorking.primary.v} != primaryNow ${primaryNow.alp} – emitted table would contradict the hero`);
console.log("showWorking:",
  showWorking.tpp ? `2pp mean ${showWorking.tpp.mean}% over ${showWorking.tpp.k} polls` : "2pp window empty",
  "|",
  showWorking.primary ? `primary mean ${showWorking.primary.mean}% (21d to ${showWorking.primary.ref})` : "primary nowcast window empty");

/* ---- 9. events (chart markers) ----------------------------------------- */
const events = EVENTS.map((e) => ({
  date: e.date, x: dx(e.date), short: e.short, label: e.label, desc: e.desc, major: !!e.major,
}));

/* ---- 10. historical cycles, aligned to each winning election ----------- */
const MS_MONTH = 365.25 / 12;
const monthsSince = (iso, eDate) => (new Date(iso) - new Date(eDate)) / 86400000 / MS_MONTH;
/* A month's value is the site's monthly construction: a house's repeat
   readings in the month count as sqrt(m), and each weighs its sample (`n`,
   where the archive has one – mostly it has none, so houses weigh the same)
   or `w0` (the leader nets weight houses equally, as the live panel does).
   Readings arrive already debiased where the measure is (debiasTerm).
   Points without a firm – the sitting term's monthly aggregates, built this
   way already – average as they are. */
function monthOfReadings(b) {
  const waves = new Map();
  for (const p of b) if (p.firm) waves.set(p.firm, (waves.get(p.firm) || 0) + 1);
  let sw = 0, swx = 0;
  for (const p of b) {
    const w = (p.w0 ?? p.n ?? 1) / Math.sqrt(p.firm ? waves.get(p.firm) : 1);
    sw += w; swx += w * p.v;
  }
  return swx / sw;
}
function cycleSeries(points, base, cap = 36) {
  const known = {}, buckets = {};
  for (const p of points) { if (p.v == null) continue; const k = Math.round(p.m); if (k < 0 || k > cap) continue; (buckets[k] ||= []).push(p); }
  for (const k of Object.keys(buckets)) known[k] = monthOfReadings(buckets[k]);
  if (base != null) known[0] = base;
  const maxM = Math.min(cap, Math.max(...Object.keys(known).map(Number)));
  const idxs = []; for (let i = 0; i <= maxM; i++) idxs.push(i);
  const filled = fillSeries(known, idxs);
  // Gaps BEFORE the first reading are not interpolation, they're invention:
  // fillSeries carries the earliest known value backwards, which drew Morrison
  // at +40 from the 2019 election when that is his April-2020 COVID rally – the
  // file then held one approval row for the whole first year of the term.
  // Leave them null so the line starts where the polling does.
  // (That hole was a gap in the DATA, not in the polling: the Newspoll and
  // Essential ratings from Jul 2019 on have since been entered, and the 2019
  // cycle now starts at m2. The rule stands regardless of who is missing.)
  const firstKnown = Math.min(...Object.keys(known).map(Number));
  /* `obs` marks the months a reading actually landed in, as opposed to the
     ones fillSeries drew a line across. The values either side of a gap are
     measured; the value IN it is the interpolation's own invention, and the
     chart dashes those segments rather than let a solid line assert a month
     nobody polled. `in known` and not a truthiness test: a net approval of
     exactly 0 is a real reading. */
  return { months: idxs, vals: idxs.map((i) => (i < firstKnown ? null : r1(filled[i]))),
           obs: idxs.map((i) => i >= firstKnown && i in known) };
}
/* Another jurisdiction carries only its sitting term until its own past
   terms are gathered (the /vic/ Past cycles tab is a follow-up): the term
   started by the baseline election, with each office's handovers as the
   splices the federal rows carry. */
function jurCycles() {
  const year = Number(ELECTION.date.slice(0, 4));
  const spl = (eras) => (eras.length > 1
    ? { isos: eras.slice(1).map((e) => e.from), names: eras.map((e) => e.name) } : null);
  const pmE = JUR.eras.alb, opE = JUR.eras.opp;
  const pmSpl = spl(pmE), oppSpl = spl(opE);
  return [{ year, gov: "alp", opp: "lnp", pm: pmE.map((e) => e.name).join(" → "), lead: pmE[pmE.length - 1].name,
    oppLead: opE.map((e) => e.name).join(" → "), current: true, eDate: ELECTION.date,
    ...(pmSpl ? { pmSpl } : {}), ...(oppSpl ? { oppSpl } : {}) }];
}
const CYC_META = JUR ? jurCycles() : [
  /* Pre-1987 rows ship against the aeforecasts F2F Morgan import: their 2PP
     series is the IMPLIED last-election-flows figure (FLOW_ERAS in flows.mjs,
     tppEra-tagged rows), not anything Morgan itself published — the method
     note lives in cyclePollBases. ePrim/eTpp are the governing side's
     official result, filled in from the elections table below the array.
     The 1969 row was the trial extension of that pattern past 1972; the
     1961, 1963 and 1966 rows are the batch extension past it, and the
     1943–1958 rows the wartime-and-Menzies extension past that (the
     aeforecasts mirror's first federal row is 1943-06-01). Approval
     buckets stay empty this far back (no Gallup-audited PM ratings),
     which the approval consumers tolerate. */
  /* Curtin died in office 5 Jul 1945; Forde's eight-day caretaker stint is
     folded into the handover the way no other row itemises a week-long
     commission. Fadden led the Coalition into the 1943 election and stood
     down after it; Menzies resumed on 22 Sep 1943 (APH shadow-ministry
     register) and led the opposition until 1949. */
  { year: 1943, gov: "alp", opp: "lnp", pm: "Curtin → Chifley", lead: "Curtin", oppLead: "Fadden → Menzies", eDate: "1943-08-21", src: 1946, appr: 1943,
    pmSpl: { iso: "1945-07-05", names: ["Curtin", "Chifley"] },
    oppSpl: { iso: "1943-09-22", names: ["Fadden", "Menzies"] } },
  { year: 1946, gov: "alp", opp: "lnp", pm: "Chifley", lead: "Chifley", oppLead: "Menzies", eDate: "1946-09-28", src: 1949, appr: 1946 },
  /* Chifley led Labor into the 1951 election and died on 13 Jun 1951;
     Evatt succeeded him on 20 Jun, so the handover belongs to the 1951
     term, not the 1949 one. */
  { year: 1949, gov: "lnp", opp: "alp", pm: "Menzies", lead: "Menzies", oppLead: "Chifley", eDate: "1949-12-10", src: 1951, appr: 1949 },
  { year: 1951, gov: "lnp", opp: "alp", pm: "Menzies", lead: "Menzies", oppLead: "Chifley → Evatt", eDate: "1951-04-28", src: 1954, appr: 1951,
    oppSpl: { iso: "1951-06-20", names: ["Chifley", "Evatt"] } },
  { year: 1954, gov: "lnp", opp: "alp", pm: "Menzies", lead: "Menzies", oppLead: "Evatt", eDate: "1954-05-29", src: 1955, appr: 1954 },
  { year: 1955, gov: "lnp", opp: "alp", pm: "Menzies", lead: "Menzies", oppLead: "Evatt", eDate: "1955-12-10", src: 1958, appr: 1955 },
  { year: 1958, gov: "lnp", opp: "alp", pm: "Menzies", lead: "Menzies", oppLead: "Evatt → Calwell", eDate: "1958-11-22", src: 1961, appr: 1958,
    oppSpl: { iso: "1960-03-07", names: ["Evatt", "Calwell"] } },
  { year: 1961, gov: "lnp", opp: "alp", pm: "Menzies", lead: "Menzies", oppLead: "Calwell", eDate: "1961-12-09", src: 1963, appr: 1961 },
  { year: 1963, gov: "lnp", opp: "alp", pm: "Menzies → Holt", lead: "Menzies", oppLead: "Calwell", eDate: "1963-11-30", src: 1966, appr: 1963,
    pmSpl: { iso: "1966-01-26", names: ["Menzies", "Holt"] } },
  { year: 1966, gov: "lnp", opp: "alp", pm: "Holt → McEwen → Gorton", lead: "Holt", oppLead: "Calwell → Whitlam", eDate: "1966-11-26", src: 1969, appr: 1966,
    pmSpl: { isos: ["1967-12-19", "1968-01-10"], names: ["Holt", "McEwen", "Gorton"] },
    oppSpl: { iso: "1967-02-08", names: ["Calwell", "Whitlam"] } },
  { year: 1969, gov: "lnp", opp: "alp", pm: "Gorton → McMahon", lead: "Gorton", oppLead: "Whitlam", eDate: "1969-10-25", src: 1972, appr: 1969,
    pmSpl: { iso: "1971-03-10", names: ["Gorton", "McMahon"] } },
  { year: 1972, gov: "alp", opp: "lnp", pm: "Whitlam", lead: "Whitlam", oppLead: "McMahon → Snedden", eDate: "1972-12-02", src: 1974, appr: 1972,
    oppSpl: { iso: "1972-12-20", names: ["McMahon", "Snedden"] } },
  /* The dismissal: Fraser was caretaker PM from 11 Nov 1975 to the 13 Dec
     election, with Whitlam leading the opposition — and the Morgan Gallup
     column rated them in those roles for those five weeks. Both offices
     split on the day, so the last month's readings sit on the right lines. */
  { year: 1974, gov: "alp", opp: "lnp", pm: "Whitlam → Fraser", lead: "Whitlam", oppLead: "Snedden → Fraser → Whitlam", eDate: "1974-05-18", src: 1975, appr: 1974,
    pmSpl: { iso: "1975-11-11", names: ["Whitlam", "Fraser"] },
    oppSpl: { isos: ["1975-03-21", "1975-11-11"], names: ["Snedden", "Fraser", "Whitlam"] } },
  /* Whitlam led the opposition for the whole 1975 term; Hayden replaced him
     on 22 Dec 1977, twelve days into the NEXT term — so the handover sits on
     the 1977 row, the way McMahon → Snedden (1972) and Shorten → Albanese
     (2019) do. It used to sit here dated 1977-02-10, a date nothing
     happened on. */
  { year: 1975, gov: "lnp", opp: "alp", pm: "Fraser", lead: "Fraser", oppLead: "Whitlam", eDate: "1975-12-13", src: 1977, appr: 1975 },
  { year: 1977, gov: "lnp", opp: "alp", pm: "Fraser", lead: "Fraser", oppLead: "Whitlam → Hayden", eDate: "1977-12-10", src: 1980, appr: 1977,
    oppSpl: { iso: "1977-12-22", names: ["Whitlam", "Hayden"] } },
  // Hawke took the leadership on 3 Feb 1983, the morning Fraser called the election
  { year: 1980, gov: "lnp", opp: "alp", pm: "Fraser", lead: "Fraser", oppLead: "Hayden → Hawke", eDate: "1980-10-18", src: 1983, appr: 1980,
    oppSpl: { iso: "1983-02-03", names: ["Hayden", "Hawke"] } },
  { year: 1983, gov: "alp", opp: "lnp", pm: "Hawke", lead: "Hawke", oppLead: "Fraser → Peacock", eDate: "1983-03-05", src: 1984, appr: 1983,
    oppSpl: { iso: "1983-03-11", names: ["Fraser", "Peacock"] } },
  { year: 1984, gov: "alp", opp: "lnp", pm: "Hawke", lead: "Hawke", oppLead: "Peacock → Howard", eDate: "1984-12-01", src: 1987, appr: 1984,
    oppSpl: { iso: "1985-09-05", names: ["Peacock", "Howard"] } },
  { year: 1987, gov: "alp", opp: "lnp", pm: "Hawke", lead: "Hawke", oppLead: "Howard → Peacock", eDate: "1987-07-11", src: 1990, appr: 1987,
    oppSpl: { iso: "1989-05-09", names: ["Howard", "Peacock"] } },
  { year: 1990, gov: "alp", opp: "lnp", pm: "Hawke → Keating", lead: "Hawke", oppLead: "Hewson", eDate: "1990-03-24", src: 1993, appr: 1990,
    pmSpl: { iso: "1991-12-19", names: ["Hawke", "Keating"] } },
  { year: 1993, gov: "alp", opp: "lnp", pm: "Keating", lead: "Keating", oppLead: "Hewson → Downer → Howard", eDate: "1993-03-13", src: 1996, appr: 1993,
    oppSpl: { isos: ["1994-05-23", "1995-01-30"], names: ["Hewson", "Downer", "Howard"] } },
  { year: 1996, gov: "lnp", opp: "alp", pm: "Howard", lead: "Howard", oppLead: "Beazley", eDate: "1996-03-02", src: 1998, appr: 1996 },
  { year: 1998, gov: "lnp", opp: "alp", pm: "Howard", lead: "Howard", oppLead: "Beazley", eDate: "1998-10-03", src: 2001, appr: 1998 },
  { year: 2001, gov: "lnp", opp: "alp", pm: "Howard", lead: "Howard", oppLead: "Beazley → Crean → Latham", eDate: "2001-11-10", src: 2004, appr: 2001,
    oppSpl: { isos: ["2001-11-22", "2003-12-02"], names: ["Beazley", "Crean", "Latham"] } },
  { year: 2004, gov: "lnp", opp: "alp", pm: "Howard", lead: "Howard", oppLead: "Latham → Beazley → Rudd", eDate: "2004-10-09", src: 2007, appr: 2004,
    oppSpl: { isos: ["2005-01-28", "2006-12-04"], names: ["Latham", "Beazley", "Rudd"] } },
  { year: 2007, gov: "alp", opp: "lnp", pm: "Rudd → Gillard", lead: "Rudd", oppLead: "Nelson → Turnbull → Abbott", eDate: "2007-11-24", src: 2010, appr: 2007,
    pmSpl: { iso: "2010-06-24", names: ["Rudd", "Gillard"] },
    oppSpl: { isos: ["2008-09-16", "2009-12-01"], names: ["Nelson", "Turnbull", "Abbott"] } },
  { year: 2010, gov: "alp", opp: "lnp", pm: "Gillard → Rudd", lead: "Gillard", oppLead: "Abbott", eDate: "2010-08-21", src: 2013, appr: 2010,
    pmSpl: { iso: "2013-06-27", names: ["Gillard", "Rudd"] } },
  { year: 2013, gov: "lnp", opp: "alp", pm: "Abbott → Turnbull", lead: "Abbott", oppLead: "Shorten", eDate: "2013-09-07", src: 2016, appr: 2013,
    pmSpl: { iso: "2015-09-15", names: ["Abbott", "Turnbull"] } },
  { year: 2016, gov: "lnp", opp: "alp", pm: "Turnbull → Morrison", lead: "Turnbull", oppLead: "Shorten", eDate: "2016-07-02", src: 2019, appr: 2016,
    pmSpl: { iso: "2018-08-24", names: ["Turnbull", "Morrison"] },
    oppSpl: { iso: "2019-05-27", names: ["Shorten", "Albanese"] } },
  /* Shorten → Albanese carries the iso here (like every other mid-term
     opposition change) because the preferred-PM pairing eras need it to
     name themselves; for the approval panels his era holds no post-
     election readings, so the eras collapse to one and nothing redraws. */
  { year: 2019, gov: "lnp", opp: "alp", pm: "Morrison", lead: "Morrison", oppLead: "Shorten → Albanese", eDate: "2019-05-18", src: 2022, appr: 2019,
    oppSpl: { iso: "2019-05-27", names: ["Shorten", "Albanese"] } },
  { year: 2022, gov: "alp", opp: "lnp", pm: "Albanese", lead: "Albanese", oppLead: "Dutton", eDate: "2022-05-21", src: 2025, appr: 2022 },
  { year: 2025, gov: "alp", opp: "lnp", pm: "Albanese", lead: "Albanese", oppLead: "Ley → Taylor", current: true, eDate: "2025-05-03",
    oppSpl: { iso: OPP_SPLICE_ISO, names: ["Ley", "Taylor"] } },
];
/* The opening result a term's vote lines anchor to is read from the one
   canonical home - the elections table in polls.json, whose alp/lnp primaries
   are the AEC two-decimal first-preference shares: ePrim is the governing
   side's primary and eTpp its two-party share at the election that STARTED
   the term. These used to be per-row literals above; they carried rounding,
   and three disagreed with the AEC figure outright (1996's Coalition primary
   sat at 46.9 against 47.25, 1998's at 39.2 against 39.52, and 1974's held
   the summary-table 44.9 that drops WA's National Alliance). */
for (const c of CYC_META) {
  const e = ELECTIONS["e" + c.year];
  c.ePrim = e[c.gov];
  c.eTpp = e["tpp_" + c.gov];
}

/* ---- 4m. the leadership model (leader-model.mjs, 2026-11-23) -----------
   (user ask 2026-11-23: the primary vote's Bayesian treatment for the
   leaders' ratings and preferred PM, and their history.) Prototype,
   backtests and the approval-v-favourability evidence are in
   .build/analysis/leader-bayes/ (not committed).

   SERIES. A rating series is one person in one office (Hawke as prime
   minister, Peacock's second stint leading the opposition, Hanson leading
   One Nation); a preferred-PM series is one pairing (Keating v Hewson),
   read as the PM's share of those who chose one of the two – the basis of
   the two-party preferred, so a forced pair (Newspoll's two-PM preferred,
   2PMP, from Nov 2026) is the same kind of number. Each series starts
   fresh when its person or pairing starts, so a new leader's line is never
   joined to the old one's. Settings are shared by all series of a family;
   leans are each series' own.

   RATINGS. Approval houses set the level: the average regular pollster
   asking approval (or satisfaction), each counting once. Favourability
   houses (RedBridge, DemosAU, Freshwater, Spectre, Resolve's likeability,
   CT Group's one 2023 wave) and different scales (ReachTEL's five-point
   performance rating, Fox & Hedgehog's "your view" question) lean but set
   no zero, as the direction model's satisfaction houses do. A house that
   leaves more people unsure prints a smaller net, so each house's reading
   is scaled by (1 − its unsure share) / (1 − the regular houses'), from
   the shares it printed. Tested against keeping the two questions apart
   (analysis combine.mjs): one line predicts favourability polls far better
   (3.7 v 4.3 points) and approval polls about as well (3.9 v 3.9); two
   correlated lines did no better than one.

   Backtests, predicting each poll before it was published, against this
   page's recipe rebuilt to use only earlier polls: ratings 4.2 v 4.6 net
   points (3,394 polls, 1971–2026), this term 3.8 v 4.4; preferred PM 2.2 v
   2.5 (share of those who chose, 1,103 polls), since 2022 2.0 v 2.6; 95%
   bands covering 94–96%. A damped trend and faster early-tenure movement
   were tried and dropped (no gain in prediction). */
const LDM = JUR ? null : (() => {
  const T0 = Date.now();
  const DAYn = (iso) => Math.floor(Date.parse(iso.slice(0, 10) + "T00:00:00Z") / 86400000);
  const ISOd = (d) => new Date(d * 86400000).toISOString().slice(0, 10);
  // A leadership-only release can postdate the newest voting-intention row.
  const t1 = DAYn([...apprAgg, ...ppm].reduce((m, r) => r.date > m ? r.date : m, LATEST_ISO));
  const ELEC_DAYS = Object.values(ELECTIONS).map((e) => e && e.date).filter(Boolean).map(DAYn);
  const PARTY_OF = { Whitlam: "alp", Hayden: "alp", Hawke: "alp", Keating: "alp", Beazley: "alp", Crean: "alp", Latham: "alp", Rudd: "alp", Gillard: "alp", Shorten: "alp", Albanese: "alp",
    Gorton: "lnp", McMahon: "lnp", Snedden: "lnp", Fraser: "lnp", Peacock: "lnp", Howard: "lnp", Hewson: "lnp", Downer: "lnp", Nelson: "lnp", Turnbull: "lnp", Abbott: "lnp", Morrison: "lnp", Dutton: "lnp", Ley: "lnp", Taylor: "lnp", Hanson: "onp" };
  /* each office's holders from CYC_META's handovers: [{ person, from, to }] */
  const stintsOf = (office) => {
    const raw = [];
    CYC_META.forEach((c, i) => {
      const next = CYC_META[i + 1], end = next ? next.eDate : "2099-01-01";
      const spl = office === "pm" ? c.pmSpl : c.oppSpl;
      const names = spl ? spl.names : [office === "pm" ? c.lead : c.oppLead];
      const bounds = [c.eDate, ...(spl ? spl.isos || [spl.iso] : []), end];
      names.forEach((nm, k) => raw.push({ person: nm, from: bounds[k], to: bounds[k + 1] }));
    });
    /* a split dated past its term's end (Shorten → Albanese, 27 May 2019, on
       both the 2016 and 2019 rows) leaves an empty stint: dropped, then a
       person's consecutive stints across elections merged */
    const ok = raw.filter((s) => s.to > s.from).sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0));
    const m = [];
    for (const s of ok) { const l = m[m.length - 1]; if (l && l.person === s.person && l.to >= s.from) { if (s.to > l.to) l.to = s.to; } else m.push({ ...s, party: PARTY_OF[s.person] || null }); }
    for (let i = 0; i + 1 < m.length; i++) if (m[i].to > m[i + 1].from) m[i].to = m[i + 1].from;
    return m;
  };
  const PM_ST = stintsOf("pm"), OPP_ST = stintsOf("opp");
  const at = (list, iso) => list.find((s) => iso >= s.from && iso < s.to) || null;
  const midOf = (date, firm) => { const P = POLL_BY_KEY.get(date + "|" + firm); return P && P.dateStart ? Math.round((DAYn(P.dateStart) + DAYn(date)) / 2) : DAYn(date) - 1; };
  /* rating scales that are not the approve/disapprove question: they lean, they set no zero */
  const SCALE_HOUSES = new Set(["ReachTEL", "Fox & Hedgehog"]);
  /* preferred-PM questions that offer "Neither" (RedBridge: Albanese / Ley /
     About the same / Neither / Not sure). Neither takes the opposition
     leader's would-be backers far more than the PM's (Nov 2025: 35% of
     Coalition voters, 69% of One Nation's, 7% of Labor's), so the decided
     share isn't the regular question's: they lean, they set no zero */
  const NEITHER_PPM = new Set(["RedBridge/Accent"]);
  const ratings = [], ppmRows = [];
  const csvRows = (f) => {
    const p = path.join(ROOT, "data", f);
    if (!fs.existsSync(p)) return [];
    const L = fs.readFileSync(p, "utf8").trim().split("\n"), h = L[0].split(",");
    return L.slice(1).map((l) => { const v = l.match(/("([^"]|"")*"|[^,]*)(,|$)/g).map((x) => x.replace(/,$/, "").replace(/^"|"$/g, "")); return Object.fromEntries(h.map((k, i) => [k, v[i] === "" || v[i] == null ? null : v[i]])); });
  };
  const BULL = csvRows("bulletin-leader-approval.csv"), ACN = csvRows("acnielsen-polls.csv");
  const near = (rows, iso, tol) => rows.filter((x) => Math.abs(DAYn(x.date) - DAYn(iso)) <= tol);
  const stintKey = (role, S) => role + ":" + S.person + ":" + S.from;
  /* past terms: cycleApproval, with the printed splits its sources carry */
  for (const rows of Object.values(cycleAppr)) for (const r of rows) {
    const iso = r.date, firm = HOUSE_RENAMES[r.firm] || r.firm;
    if (iso >= "2025-05-03") continue;                         // this term's rows are D.approval's
    const pmS = at(PM_ST, iso), opS = at(OPP_ST, iso);
    const metric = r.metric || metricOf(firm, "alb");
    for (const [k, role, S] of [["pmNet", "pm", pmS], ["oppNet", "opp", opS]]) {
      if (r[k] == null || !S) continue;
      let R = null, W = null, U = null;
      if (firm === "Morgan Gallup") {
        const m = near(BULL, iso, 3).find((x) => (role === "pm" ? x.role === "pm" : x.role === "opposition") && x.net != null && Math.abs(+x.net - r[k]) <= 1);
        if (m && m.approve != null) { R = +m.approve; W = +m.disapprove; U = m.undecided != null ? +m.undecided : 100 - R - W; }
      } else if (/Nielsen/.test(firm)) {
        const m = near(ACN, iso, 3)[0], ks = role === "pm" ? ["pm_approve", "pm_disapprove", "pm_uncommitted"] : ["ol_approve", "ol_disapprove", "ol_uncommitted"];
        if (m && m[ks[0]] != null && Math.abs(+m[ks[0]] - +m[ks[1]] - r[k]) <= 1) { R = +m[ks[0]]; W = +m[ks[1]]; U = m[ks[2]] != null ? +m[ks[2]] : 100 - R - W; }
      }
      ratings.push({ day: DAYn(iso) - 1, date: iso, house: firm, role, person: S.person, party: S.party, from: S.from, to: S.to, series: stintKey(role, S),
        metric, net: r[k], R, W, U, n: firm === "Morning Consult" ? 3000 : 1200, ...(SCALE_HOUSES.has(firm) ? { format: "scale" } : {}) });
    }
    if (r.pmPpm != null && r.oppPpm != null && pmS && opS && r.pmPpm > 0 && r.oppPpm > 0)
      ppmRows.push({ day: DAYn(iso) - 1, date: iso, house: firm, kind: "two", contest: "pm-opp", pm: pmS.person, opp: opS.person, pmParty: pmS.party, oppParty: opS.party,
        series: "pm-opp:" + pmS.person + ":" + pmS.from + ":" + opS.person + ":" + opS.from, to: pmS.to < opS.to ? pmS.to : opS.to, a: r.pmPpm, b: r.oppPpm, n: 1200 });
  }
  /* this term: the approval rows every leadership figure reads (apprAgg) */
  const curPm = at(PM_ST, LATEST_ISO), oppNow = (iso) => at(OPP_ST, iso);
  for (const p of apprAgg) {
    const day = midOf(p.date, p.firm), n = rowN(POLL_BY_KEY.get(p.date + "|" + p.firm));
    for (const [lk, role] of [["alb", "pm"], ["opp", "opp"], ["han", "han"]]) {
      const S = role === "pm" ? at(PM_ST, p.date) : role === "opp" ? oppNow(p.date) : { person: "Hanson", party: "onp", from: "2025-05-03", to: "2099-01-01" };
      if (!S) continue;
      const sp = p.splits && p.splits[lk];
      const R = sp && sp.app != null ? sp.app : null, W = sp && sp.dis != null ? sp.dis : null;
      const U = sp && sp.unsure != null ? sp.unsure : R != null && W != null ? Math.max(0, 100 - R - W) : null;
      const base = { day, date: p.date, role, person: S.person, party: S.party, from: S.from, to: S.to, series: stintKey(role, S), n };
      if (p[lk] != null) ratings.push({ ...base, house: p.firm, metric: metricOf(p.firm, lk, p.date), net: p[lk], R, W, U, ...(SCALE_HOUSES.has(p.firm) ? { format: "scale" } : {}) });
      const fv = p.splits && p.splits.fav ? p.splits.fav[lk] : null;
      if (fv != null && metricOf(p.firm, lk, p.date) !== "fav") ratings.push({ ...base, house: p.firm + " (likeability)", metric: "fav", net: fv, R: null, W: null, U: null });
    }
  }
  for (const p of ppm) {
    const day = midOf(p.date, p.firm), n = ppmN(p), S = oppNow(p.date), P = at(PM_ST, p.date);
    if (!S || !P) continue;
    const base = { day, date: p.date, contest: "pm-opp", pm: P.person, opp: S.person, pmParty: P.party, oppParty: S.party, series: "pm-opp:" + P.person + ":" + P.from + ":" + S.person + ":" + S.from, to: P.to < S.to ? P.to : S.to, n };
    if (p.han == null && p.alb > 0 && p.opp > 0) ppmRows.push({ ...base, house: p.firm, kind: NEITHER_PPM.has(p.firm) ? "neither" : "two", a: p.alb, b: p.opp });
    for (const e of p.extra || []) if (e.alb > 0 && e.opp > 0)
      ppmRows.push({ ...base, house: e.kind === "2pmp" ? p.firm + " (2PMP)" : p.firm, kind: e.kind === "2pmp" ? "2pmp" : NEITHER_PPM.has(p.firm) ? "neither" : "two", a: e.alb, b: e.opp });
  }
  for (const r of D.ppmHeadToHead) if (r.alb > 0 && r.han > 0)
    ppmRows.push({ day: midOf(r.date, r.firm), date: r.date, house: r.firm, kind: "two", contest: "alb-han", pm: "Albanese", opp: "Hanson", pmParty: "alp", oppParty: "onp",
      series: "alb-han:Albanese:Hanson", to: "2099-01-01", a: r.alb, b: r.han, n: ppmN(r) });
  /* output days: the 15th of every month a series spans (its first to its
     last reading), the latest poll day for a series still running, and the
     month before it (the change) */
  const monthDays = (a, b, rs) => {
    const out = [];
    const d0 = new Date(a * 86400000), d1 = new Date(b * 86400000);
    for (let y = d0.getUTCFullYear(), m = d0.getUTCMonth(); y < d1.getUTCFullYear() || (y === d1.getUTCFullYear() && m <= d1.getUTCMonth()); m === 11 ? (y++, m = 0) : m++) {
      const d = Math.min(b, Math.max(a, Math.floor(Date.UTC(y, m, 15) / 86400000)));
      out.push(d);
    }
    if (rs.some((r) => r.to > LATEST_ISO || r.contest === "alb-han")) out.push(t1, t1 - 30);
    return [...new Set(out)].sort((x, y) => x - y);
  };
  /* the settings grids: each spans its posterior on the prototype's wider grid with room either side */
  const GRID_R = { w: [0.0075, 0.01, 0.014], d: [0.0007, 0.0015, 0.003], s: [0.02, 0.05, 0.1], tau: [0, 0.01, 0.02], J: [0.05, 0.1, 0.2] };
  const GRID_P = { w: [0.014, 0.02, 0.03], d: [0.002, 0.004, 0.008], s: [0.03, 0.1, 0.25], tau: [0, 0.03, 0.06], J: [0.15, 0.3, 0.6] };
  const RS = ldRatingSeries(ratings, { jumpsIn: ELEC_DAYS, monthDays: (a, b, rs) => monthDays(a, Math.max(b, rs.some((r) => r.to > LATEST_ISO) ? t1 : b), rs) });
  const PS = ldPpmSeries(ppmRows, { jumpsIn: ELEC_DAYS, monthDays: (a, b, rs) => monthDays(a, Math.max(b, rs.some((r) => r.contest === "alb-han" || (r.to || "") > LATEST_ISO) ? t1 : b), rs) });
  /* a running series reads to the latest poll day: its last reading may be days before */
  for (const S of [...RS, ...PS]) if (S.outDays.includes(t1) && t1 > S.t1) S.t1 = t1;
  const stR = ldFit(RS, GRID_R), stP = ldFit(PS, GRID_P);
  if (stR.edges.length || stP.edges.length) console.warn("leaderModel: settings on a grid edge –", [...stR.edges.map((e) => "ratings " + e), ...stP.edges.map((e) => "ppm " + e)].join(", "));
  const T1 = Date.now();
  /* ---- ratings: monthly lines for every series; the favourability read
     where favourability houses polled the leader (each regular one counting
     once: its printed figure, c·m + lean) ---- */
  const favCoefOf = (S) => {
    const hs = S.favHouses.filter((h) => !S.lone.has(h) && S.cnt[h] >= 3);
    if (!hs.length) return null;
    const v = new Float64Array(S.N);
    for (const h of hs) { const c = ldHouseCoef(S, h, S.cOf(h)); for (let i = 0; i < S.N; i++) v[i] += c[i] / hs.length; }
    return { v, houses: hs, from: Math.min(...S.obs.filter((o) => hs.includes(o.house)).map((o) => o.t)) };
  };
  const ymOfDay = (d) => ISOd(d).slice(0, 7);
  /* Past cycles' month days (ldCycleLines): every term's election day plus
     whole months (MS_MONTH), read off each series that spans them. Within
     half a month of a series' first or last reading the day reads that end,
     as a poll in the month's half-month either side counted for it */
  const CYC_DAYS = [];
  CYC_META.forEach((c, i) => {
    const e0 = DAYn(c.eDate), next = CYC_META[i + 1], end = next ? DAYn(next.eDate) : t1 + 31;
    for (let k = 0; ; k++) { const d = Math.round(e0 + k * MS_MONTH); if (d > end + 16) break; CYC_DAYS.push(d); }
  });
  const cycDaysOf = (S) => CYC_DAYS.filter((d) => d >= S.t0 - MS_MONTH / 2 && d <= S.t1 + MS_MONTH / 2);
  const evalDays = (S, cd) => [...S.outDays, ...cd.map((d) => Math.min(S.t1, Math.max(S.t0, d)))];
  const rSeries = RS.map((S) => {
    const fc = favCoefOf(S), cd = cycDaysOf(S), n = S.outDays.length;
    const mm = ldMoments(S, stR, evalDays(S, cd), fc ? { main: null, fav: fc.v } : { main: null });
    const months = S.outDays.map((d, j) => ({ d, v: 100 * mm.main[j].m, ci: 196 * mm.main[j].sd, ...(fc && d >= fc.from ? { fv: 100 * mm.fav[j].m, fci: 196 * mm.fav[j].sd } : {}) }));
    return { S, fc, months, cyc: new Map(cd.map((d, j) => [d, 100 * mm.main[n + j].m])) };
  });
  const pSeries = PS.map((S) => {
    const cd = cycDaysOf(S), n = S.outDays.length;
    const mm = ldMoments(S, stP, evalDays(S, cd));
    const sh = (z) => 100 / (1 + Math.exp(-z));
    /* the lead among those who chose, 2s − 1, with its interval read through the logistic */
    const months = S.outDays.map((d, j) => { const m = mm.main[j].m, sd = mm.main[j].sd; return { d, v: 2 * sh(m) - 100, lo: 2 * sh(m - 1.96 * sd) - 100, hi: 2 * sh(m + 1.96 * sd) - 100 }; });
    return { S, months, cyc: new Map(cd.map((d, j) => [d, 2 * sh(mm.main[n + j].m) - 100])) };
  });
  const T2 = Date.now();
  /* ---- this term: draws for the readouts (now, a month ago, the change) ---- */
  const curR = (role, person) => rSeries.find((x) => x.S.role === role && x.S.person === person && x.S.outDays.includes(t1));
  const sumDraws = (now, prev) => {
    const lo = quant(now, 0.025), hi = quant(now, 0.975), v = mean(now), sd = Math.sqrt(mean(Array.from(now, (x) => (x - v) ** 2)));
    const o = { v: r1(v), se: r2(sd), ci95: r1((hi - lo) / 2), lo: r1(lo), hi: r1(hi) };
    if (prev) {
      const dd = now.map((x, i) => x - prev[i]), dlo = quant(dd, 0.025), dhi = quant(dd, 0.975), pUp = mean(Array.from(dd, (x) => (x > 0 ? 1 : 0)));
      Object.assign(o, { prev: r1(mean(prev)), chg: r1(mean(dd)), changeCi95: r1((dhi - dlo) / 2), changeSig: dlo > 0 || dhi < 0, pUp: r2(pUp) });
    }
    return o;
  };
  const quant = (a, q) => { const s = Float64Array.from(a).sort(); const i = (s.length - 1) * q, lo = Math.floor(i); return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (i - lo); };
  const mean = (a) => { let s = 0; for (const v of a) s += v; return s / a.length; };
  const now = {};
  const recent = (S, test) => S.obs.filter((o) => o.t > t1 - 42 && test(o)).length;
  for (const [key, role, person] of [["alb", "pm", curPm ? curPm.person : "Albanese"], ["taylor", "opp", (oppNow(LATEST_ISO) || {}).person], ["hanson", "han", "Hanson"]]) {
    const X = curR(role, person); if (!X) continue;
    const coefs = X.fc ? { net: null, fav: X.fc.v } : { net: null };
    const dr = ldDrawReads(X.S, stR, [t1, t1 - 30], coefs, { nDraw: 2000, seed: 20261123 + key.length });
    const sc = (a) => a.map((x) => 100 * x);
    now[key + "_net"] = { ...sumDraws(sc(dr.net[0]), sc(dr.net[1])), n: recent(X.S, (o) => o.raw.metric === "approval"), method: "bayes" };
    if (X.fc && X.S.obs.some((o) => o.t > t1 - 183 && X.fc.houses.includes(o.house)))
      now[key + "_fav"] = { ...sumDraws(sc(dr.fav[0]), sc(dr.fav[1])), n: recent(X.S, (o) => o.raw.metric === "fav"), method: "bayes" };
  }
  /* preferred PM now: each running pairing's lead among those who chose and
     the PM's share of them; which side leads, as a probability */
  const pnow = {};
  for (const X of pSeries.filter((x) => x.S.outDays.includes(t1))) {
    const dr = ldDrawReads(X.S, stP, [t1, t1 - 30], { main: null }, { nDraw: 2000, seed: 20261124 + X.S.id.length });
    const lead = (a) => a.map((z) => 200 / (1 + Math.exp(-z)) - 100);
    const L = sumDraws(lead(dr.main[0]), lead(dr.main[1])), s = sumDraws(dr.main[0].map((z) => 100 / (1 + Math.exp(-z))));
    const key = X.S.contest === "alb-han" ? "hanson" : "taylor";
    pnow[key] = { pm: X.S.pm, opp: X.S.opp, lead: { ...L, pAhead: r2(mean(Array.from(lead(dr.main[0]), (x) => (x > 0 ? 1 : 0)))) }, share: s, n: recent(X.S, () => true) };
  }
  /* ---- the three-way question (this term): Albanese, the opposition
     leader and Hanson as shares of those who named one, on the primary
     model's engine (three categories; regular houses set the level) ---- */
  let three = null;
  {
    const rs = ppm.filter((p) => p.han != null && p.alb > 0 && p.opp > 0 && p.han > 0 && eraOf(p.date) === "taylor")
      .map((p, i) => ({ day: midOf(p.date, p.firm), house: p.firm, n: ppmN(p) * (p.alb + p.opp + p.han) / 100, cats: [[0], [1], [2]], vals: [p.alb, p.opp, p.han], full: true, step: pmStep([p.alb, p.opp, p.han]), idx: i }));
    if (rs.length >= 4) {
      const f5 = rs.slice(0, 5).map((r) => r.vals.map((v) => v / (r.vals[0] + r.vals[1] + r.vals[2])));
      const avg = [0, 1, 2].map((k) => f5.reduce((a, v) => a + v[k], 0) / f5.length);
      const t0 = Math.min(...rs.map((r) => r.day)) - 1;
      const anchor = { mean: Float64Array.from([Math.log(avg[0] / avg[2]), Math.log(avg[1] / avg[2])]), cov: Float64Array.from([0.25, 0.1, 0.1, 0.25]) };
      const mdays = monthDays(t0 + 1, t1, [{ to: "2099-01-01" }]).filter((d) => d > t0);
      const cnt3 = {}; for (const r of rs) cnt3[r.house] = (cnt3[r.house] || 0) + 1;
      const core3 = new Set(Object.keys(cnt3).filter((h) => cnt3[h] >= 4 && !NEITHER_PPM.has(h)));
      const fit = fitPrimary(rs, { t0, t1, anchor, jumps: new Set(), parties: ["alb", "opp", "han"], days: [...new Set([...mdays, t1, t1 - 30])], pairs: [[t1, t1 - 30]], nDraw: 2000, seed: 20261125, M: 16, minCore: 4, coreOverride: core3 });
      const d = fit.shares(t1), dp = fit.shares(t1 - 30), n = d.length / 3;
      const colK = (A, k) => Float64Array.from({ length: n }, (_, i) => 100 * A[i * 3 + k]);
      const o = {};
      ["alb", "opp", "han"].forEach((k, j) => { o[k] = sumDraws(colK(d, j), colK(dp, j)); });
      const secondH = mean(Array.from({ length: n }, (_, i) => (d[i * 3 + 2] > d[i * 3 + 1] ? 1 : 0)));
      const firstA = mean(Array.from({ length: n }, (_, i) => (d[i * 3] > Math.max(d[i * 3 + 1], d[i * 3 + 2]) ? 1 : 0)));
      /* each month's shares (mid-month, the latest month at the newest poll): mean and 95% interval */
      const months = mdays.map((dd) => { const A = fit.shares(dd); return { d: dd, ...Object.fromEntries(["alb", "opp", "han"].map((k, j) => { const c = colK(A, j); return [k, [mean(c), (quant(c, 0.975) - quant(c, 0.025)) / 2]]; })) }; });
      three = { ...o, pHansonOverOpp: r2(secondH), pAlbFirst: r2(firstA), n: rs.filter((r) => r.day > t1 - 42).length, houses: [...new Set(rs.map((r) => r.house))], months };
    }
  }
  /* each house's lean now, per office: its printed net less the average approval pollster's (c·m + lean − m) */
  const leans = {};
  for (const [lk, role] of [["alb", "pm"], ["opp", "opp"], ["han", "han"]]) {
    const X = rSeries.find((x) => x.S.role === role && x.S.outDays.includes(t1)); if (!X) continue;
    const o = {};
    for (const h of X.S.houses) {
      if (X.S.lone.has(h)) continue;
      const c = ldHouseCoef(X.S, h, X.S.cOf(h)); c[0] -= 1;
      const mm = ldMoments(X.S, stR, [t1], { h: c });
      o[h.replace(" (likeability)", "")] = { v: r1(100 * mm.h[0].m), n: X.S.cnt[h], ...(/likeability/.test(h) ? { metric: "fav" } : {}) };
    }
    leans[lk] = o;
  }
  const T3 = Date.now();
  console.log(`leaderModel: ${RS.length} rating series (${ratings.length} readings), ${PS.length} preferred-PM pairings (${ppmRows.length}); ratings ${JSON.stringify(stR.best)}, ppm ${JSON.stringify(stP.best)}; fit ${T1 - T0} ms, lines ${T2 - T1} ms, now ${T3 - T2} ms`);
  return { t1, rSeries, pSeries, now, pnow, three, leans, stR, stP, ymOfDay, ISOd, PM_ST, OPP_ST, neither: [...NEITHER_PPM] };
})();

/* ---- 4m'. the model's figures into the panel's shapes -------------------
   The nets (alb_net, taylor_net, ley_net, hanson_net and their _fav twins)
   are replaced where they stand, in leaderMonths and leaderNow, so every
   reader of them – both designs, the change log, Past cycles' sitting term
   – quotes the model. Preferred PM is a different basis (of those who
   chose), so it travels in its own keys (lead_* in leaderMonths, read by
   the redesign alone, and leaderModel); the published-basis _pref keys the
   old design reads stay as they were. */
let leaderModel = null;
if (LDM) {
  const lmByYm = new Map(leaderMonths.map((r) => [r.ym, r]));
  const mid15 = (ym) => Math.floor(Date.UTC(+ym.slice(0, 4), +ym.slice(5, 7) - 1, 15) / 86400000);
  const dayFor = (ym) => Math.min(mid15(ym), LDM.t1);
  const termA = DAYn0(ELECTIONS["e2025"] ? ELECTIONS["e2025"].date : "2025-05-03");
  function DAYn0(iso) { return Math.floor(Date.parse(iso.slice(0, 10) + "T00:00:00Z") / 86400000); }
  /* this term's months, every month the model reads (a month no house polled
     the leaders gets a row of nets only) */
  for (const ym of MONTHS) {
    const d = dayFor(ym);
    if (d < termA) continue;
    let row = lmByYm.get(ym);
    for (const X of LDM.rSeries) {
      const j = X.S.outDays.indexOf(d); if (j < 0) continue;
      const key = X.S.role === "pm" ? "alb" : X.S.role === "han" ? "hanson" : X.S.person === "Ley" ? "ley" : X.S.person === "Taylor" ? "taylor" : null;
      if (!key) continue;
      if (!row) { row = { ym, x: mx(ym) }; lmByYm.set(ym, row); leaderMonths.push(row); }
      const m = X.months[j];
      row[key + "_net"] = r1(m.v); row[key + "_netCi"] = r1(m.ci);
      if (m.fv != null) { row[key + "_fav"] = r1(m.fv); row[key + "_favCi"] = r1(m.fci); } else if (row[key + "_fav"] != null) { row[key + "_fav"] = null; row[key + "_favCi"] = null; }
    }
    /* Ley and Taylor: a month either does not span carries no value of theirs */
    for (const X of LDM.pSeries) {
      const j = X.S.outDays.indexOf(d); if (j < 0) continue;
      const key = X.S.contest === "alb-han" ? "hanson" : X.S.opp === "Ley" ? "ley" : X.S.opp === "Taylor" ? "taylor" : null;
      if (!key || !row) continue;
      const m = X.months[j];
      row["lead_" + key] = r1(m.v); row["lead_" + key + "Lo"] = r1(m.lo); row["lead_" + key + "Hi"] = r1(m.hi); row["lead_" + key + "Ci"] = r1((m.hi - m.lo) / 2);
    }
  }
  /* the three-way question: shares of those who named one of the three
     (the model's monthly reads replace the published-basis means; the old
     design never drew them) */
  if (LDM.three) {
    for (const row of leaderMonths) for (const k of ["alb", "ley", "taylor", "hanson"]) { row[k + "_pref3"] = null; row[k + "_pref3Ci"] = null; }
    for (const m of LDM.three.months) {
      const row = lmByYm.get(LDM.ymOfDay(m.d)); if (!row) continue;
      row.alb_pref3 = r1(m.alb[0]); row.alb_pref3Ci = r1(m.alb[1]);
      row.taylor_pref3 = r1(m.opp[0]); row.taylor_pref3Ci = r1(m.opp[1]);
      row.hanson_pref3 = r1(m.han[0]); row.hanson_pref3Ci = r1(m.han[1]);
    }
  }
  leaderMonths.sort((a, b) => (a.ym < b.ym ? -1 : 1));
  /* a month outside a series' span keeps no model value: the recipe's figure there would be a different construction */
  for (const row of leaderMonths) {
    const d = dayFor(row.ym);
    for (const key of ["alb", "ley", "taylor", "hanson"]) {
      const X = LDM.rSeries.find((x) => (key === "alb" ? x.S.role === "pm" : key === "hanson" ? x.S.role === "han" : x.S.person === (key === "ley" ? "Ley" : "Taylor")) && x.S.outDays.includes(d));
      if (!X && d >= termA) { row[key + "_net"] = null; row[key + "_netCi"] = null; row[key + "_fav"] = null; row[key + "_favCi"] = null; }
    }
    for (const key of ["ley", "taylor", "hanson"]) {
      const X = LDM.pSeries.find((x) => (key === "hanson" ? x.S.contest === "alb-han" : x.S.opp === (key === "ley" ? "Ley" : "Taylor")) && x.S.outDays.includes(d));
      if (!X) { row["lead_" + key] = null; row["lead_" + key + "Ci"] = null; delete row["lead_" + key + "Lo"]; delete row["lead_" + key + "Hi"]; }
    }
  }
  for (const k of Object.keys(leaderNow)) if (/_(net|fav)$/.test(k)) delete leaderNow[k];
  Object.assign(leaderNow, LDM.now);
  /* preferred PM on the model's basis – each side's share of those who chose
     between the two, and of those who named one of the three – in keys of
     their own (the old design reads the published-basis alb_pref) */
  const sh2 = (P, side) => (P ? { v: side ? r1(100 - P.share.v) : P.share.v, ci95: P.share.ci95, se: P.share.se, n: P.n, method: "bayes" } : null);
  for (const [k, v] of [["alb_prefD", sh2(LDM.pnow.taylor, 0)], ["taylor_prefD", sh2(LDM.pnow.taylor, 1)], ["alb_prefHD", sh2(LDM.pnow.hanson, 0)], ["hanson_prefHD", sh2(LDM.pnow.hanson, 1)]]) if (v) leaderNow[k] = v;
  if (LDM.three) for (const [k, j] of [["alb_pref3", "alb"], ["taylor_pref3", "opp"], ["hanson_pref3", "han"]]) leaderNow[k] = { ...LDM.three[j], n: LDM.three.n, method: "bayes" };
  /* the lead test in the panel's head: the model's lead among those who chose */
  leaderLead.taylor = LDM.pnow.taylor ? { v: LDM.pnow.taylor.lead.v, ci95: LDM.pnow.taylor.lead.ci95, basis: "decided" } : null;
  leaderLead.hanson = LDM.pnow.hanson ? { v: LDM.pnow.hanson.lead.v, ci95: LDM.pnow.hanson.lead.ci95, basis: "decided" } : null;
  for (const lk of Object.keys(apprHE)) if (LDM.leans[lk]) apprHE[lk] = { ...apprHE[lk], snapshot: () => LDM.leans[lk] };
  /* the history: every series' monthly line ([x, v, ±] ratings; [x, v, lo, hi]
     preferred PM), one decimal */
  const xOfDay = (d) => { const iso = LDM.ISOd(d); return dx(iso); };
  leaderModel = {
    t1: LDM.ISOd(LDM.t1),
    /* pollsters whose head-to-head offers "Neither": not drawn on the decided-basis lead chart */
    neither: LDM.neither,
    ratings: LDM.rSeries.map(({ S, months }) => ({
      id: S.id, role: S.role, person: S.person, party: S.party, from: S.from, to: S.to < "2099" ? S.to : null,
      houses: [...new Set(S.obs.map((o) => o.house))].length,
      m: months.map((m) => [r2(xOfDay(m.d)), r1(m.v), r1(m.ci), ...(m.fv != null ? [r1(m.fv), r1(m.fci)] : [])]),
    })),
    ppm: LDM.pSeries.map(({ S, months }) => ({
      id: S.id, contest: S.contest, pm: S.pm, opp: S.opp, pmParty: S.pmParty, oppParty: S.oppParty,
      m: months.map((m) => [r2(xOfDay(m.d)), r1(m.v), r1(m.lo), r1(m.hi)]),
    })),
    now: LDM.pnow, three: LDM.three,
    settings: { ratings: LDM.stR.best, ppm: LDM.stP.best },
  };
}

/* ---- 5k. confidence against past terms ---------------------------------
   The confidence panel's month-since-election reframe, past-cycles style:
   this term's gauge line over the middle half and middle 80% of the past
   terms the deep history (data/confidence-history.json, CONF_HISTORY_FILE)
   reaches. Each view's PRIMARY gauge bands (the ANZ–Roy Morgan consumer
   and Roy Morgan business index series): Westpac–MI's file now runs
   1974 → (§5l carries it), but the band stays the two MAIN gauges — a
   whole-point-rounded pre-2010 lane has no business pooling beside the
   fifty-year ANZ–RM decimal run — and NAB's deep series is a conditions
   DEVIATION, not a confidence figure, so neither lanes in. Westpac–MI's
   TERMS still ship (bandless): the panel's draw-a-past-term lifts the
   other house's same term as a dotted twin beside the main gauge's line,
   each in its own lane colour, never blended in. A term joins its lane's pool
   only when interpolation reaches its election month (the consumer
   history opens March 1973, inside the already-running 1972 term, so
   that term never bands); quarterly-era months fill straight-line
   between anchors, as the past-cycles charts do. Values are per survey
   month on the election-relative month grid (0 = the term's election
   month), the band is over every month 0..36 with three or more terms
   standing, and `n` travels with each row so the renderer can PALER the
   stretches built from few terms (long parliaments outlive short ones,
   exactly as the past-cycles ribbon thins). */
const CONF_HIST_MAXM = 36;
/* Which of the shipped lanes pool a past-terms BAND. The alt lane draws
   its terms only (the renderer's dotted twin); a band of whole-point
   mirror years never pools beside the main gauges' decimals. */
const CONF_HIST_BAND = new Set(["consumer", "business"]);
/* rd-panels' kernel smooth (symmetric half-life, weights under 0.02
   dropped), over a term's month grid; a month with no value stays null */
const CONF_TERM_HL = 60;
function confTermSmooth(v) {
  const decay = Math.LN2 / (CONF_TERM_HL / 365.25);
  const pts = v.map((y, m) => (y == null ? null : { x: m / 12, y })).filter(Boolean);
  const out = v.map(() => null);
  for (const p of pts) {
    let ws = 0, wt = 0;
    for (const q of pts) {
      const w = Math.exp(-decay * Math.abs(q.x - p.x));
      if (w < 0.02) continue;
      ws += w; wt += w * q.y;
    }
    out[Math.round(p.x * 12)] = wt / ws;
  }
  return out;
}
const confHistory = (() => {
  if (!CONF_HISTORY_FILE) return null;   // the back-history file simply isn't there (JUR, fresh clone)
  const ymIdx = (ym) => +ym.slice(0, 4) * 12 + (+ym.slice(5, 7) - 1);
  return Object.fromEntries(["consumer", "business", "westpacConsumer"].map((k) => {
    const s = CONF_HISTORY_FILE[k];
    if (!s || !Array.isArray(s.rows) || !s.rows.length) return [k, null];
    const byIdx = new Map(s.rows.map((r) => [ymIdx(r.ym), r.v]));
    const first = ymIdx(s.rows[0].ym), last = ymIdx(s.rows[s.rows.length - 1].ym);
    const terms = [];
    for (let i = 0; i + 1 < CYC_META.length; i++) {
      const c = CYC_META[i];
      const start = ymIdx(c.eDate.slice(0, 7));
      const span = Math.min(ymIdx(CYC_META[i + 1].eDate.slice(0, 7)) - start, CONF_HIST_MAXM);
      if (start < first || start > last) continue;   // the history starts mid-term (1972) or never reached it
      /* Anchor window reaches back before the term: the pre-1987 rows are
         quarterly and even later the odd month is skipped, so the term's
         election month itself usually sits BETWEEN two readings – the
         straight-line join across it is exactly what the quarterly-era
         fill below does for every other gap. What the guard demands is
         the join: a reading at or before the election month and one
         after it. */
      const anchors = [];
      for (let m = -12; m <= span; m++) { const v = byIdx.get(start + m); if (v != null) anchors.push({ m, v }); }
      if (anchors.length < 2 || anchors[0].m > 0 || anchors[anchors.length - 1].m <= 0) continue;
      const v = [];
      for (let m = 0; m <= CONF_HIST_MAXM; m++) {
        if (m > span || m > anchors[anchors.length - 1].m) { v.push(null); continue; }
        let j = 0;
        while (j < anchors.length - 1 && anchors[j + 1].m <= m) j++;
        const a = anchors[j], b = anchors[Math.min(j + 1, anchors.length - 1)];
        const t = b.m === a.m ? 0 : (m - a.m) / (b.m - a.m);
        v.push(+(a.v + (b.v - a.v) * t).toFixed(2));
      }
      terms.push({ year: c.year, span, eYm: c.eDate.slice(0, 7), v });
    }
    /* The band needs its three-term crowd, as the past-cycles ribbon
       does; below that a "band" is just the two lines' gap relabelled. */
    /* The band pools each term as the panel draws a line: through the
       same symmetric kernel smooth (CONF_TERM_HL, the panel's TERM_HL –
       the monthly gauges' half-life), run inside the term, so the band
       sits behind lines built the same way as the one in front of it.
       The shipped term rows stay unsmoothed: the panel smooths a lifted
       term itself, and the CSV carries the printed months. */
    const sm = terms.map((t) => confTermSmooth(t.v));
    const band = [];
    if (terms.length >= 3 && CONF_HIST_BAND.has(k)) {
      for (let m = 0; m <= CONF_HIST_MAXM; m++) {
        const nums = sm.map((v) => v[m]).filter((v) => v != null).sort((a, b) => a - b);
        if (nums.length < 3) continue;
        const pct = (p) => { const i = (nums.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i); return nums[lo] + (nums[hi] - nums[lo]) * (i - lo); };
        band.push({ m, n: nums.length,
          mean: +(nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2),
          q1: +pct(0.25).toFixed(2), q3: +pct(0.75).toFixed(2),
          p10: +pct(0.1).toFixed(2), p90: +pct(0.9).toFixed(2) });
      }
    }
    return [k, { terms, band }];
  }));
})();
/* --- §5l. confidence history as a CALENDAR series ----------------------
   The past-terms payload above re-bases every term on its own election
   month; this is the same history file as-calendar, one {ym, v} point per
   survey month, so the confidence panel's time window (its ‹ › term
   stepper, span chips and strip) can reach each house's full published run
   and extend the live lines backwards. Only the lanes whose printed basis the live chart
   already draws travel: NAB's deep net-balance series (nabConfidence in
   the history file) now rides too, renamed to the payload's nabBusiness;
   the conditions DEVIATION lane (nabConditions — H3 CSV, never the printed
   net balance, the confidence-history skill's "never arithmetic-merge"
   trap) stays on disk and out of the page. */
const confDeep = (() => {
  if (!CONF_HISTORY_FILE) return null;
  const out = {};
  for (const [src, k] of [["consumer", "consumer"], ["westpacConsumer", "westpacConsumer"], ["business", "business"], ["nabConfidence", "nabBusiness"]]) {
    const s = CONF_HISTORY_FILE[src];
    if (s && Array.isArray(s.rows) && s.rows.length) out[k] = s.rows.map((r) => ({ ym: r.ym, v: r.v }));
  }
  return Object.keys(out).length ? out : null;
})();
/* --- §5m. macro lanes for the "Inflation & growth" view ----------------
   data/macro.json (built by .build/macro.mjs off the ABS and OECD data
   APIs) passes through as-is: cpi/cpiMonthly inflation, the ausGap
   deviation-from-target derivation, gdppc real GDP per capita and rnndi
   real net national disposable income per capita, the unemp unemployment
   rate (the only lane drawn as a level, not an annual change), hhdi
   real household disposable income per capita (computed by the
   extractor from ABS figures), the gdppcLevel/rnndiLevel printed and
   hhdiLevel computed per-person dollar levels (the growth
   chart's "Actual" switch), and the OECD comparators
   (oecdCpi printed aggregate; oecdGdppc off the OECD's printed
   per-capita GDP index; oecdCpiMed and oecdCpiGap the extractor's
   member-country medians), and giniHilda/giniSih the income Gini
   coefficient from the HILDA survey and the ABS's income survey (read
   off the ABS's pages). prod real GDP per hour worked and aweReal
   real full-time weekly earnings (computed by the extractor from ABS
   figures, 2026-11-16) join the Australian lanes; oecdGdpMed,
   oecdUnempMed, oecdProdMed, oecdWageMed and oecdGiniMed are their
   OECD member-country medians, all computed by the extractor. The
   view reads the raw {date, v} rows and
   splices the quarterly CPI history onto the printed monthly era
   render-side. */
const macro = (() => {
  if (!MACRO_FILE) return null;
  const out = {};
  for (const k of ["cpi", "cpiMonthly", "ausGap", "gdppc", "rnndi", "unemp", "oecdCpi", "oecdCpiMed", "oecdCpiGap", "oecdGdppc", "gdppcLevel", "rnndiLevel", "hhdi", "hhdiLevel", "giniHilda", "giniSih", "prod", "prodLevel", "aweReal", "oecdGdpMed", "oecdUnempMed", "oecdProdMed", "oecdWageMed", "oecdGiniMed"]) {
    const lane = MACRO_FILE[k];
    if (lane && Array.isArray(lane.rows) && lane.rows.length)
      out[k] = { label: lane.label, basis: lane.basis, rows: lane.rows.map((r) => ({ date: r.date, v: r.v })) };
  }
  return Object.keys(out).length ? out : null;
})();
/* A term that changed leaders mid-stream is not one line. The pooled net /
   oppnet series stay (they fit the domain, the change-since base and the
   peer average), and beside them each person gets his own monthly run, built
   from his own readings alone: the handover month – where both men's polls
   land in one bucket – then holds both readings instead of averaging two
   people into one. Null when the splice has only one side measured (e.g.
   Shorten resigned days after the 2016 term's last rating, so no Albanese
   run exists to draw there), and the chart falls back to the pooled line. */
function eraSeries(points, spl, cap) {
  if (!spl) return null;
  /* One boundary (iso) splits a term in two; longer successions
     (Beazley → Crean → Latham) carry a whole list of handover dates. */
  const isos = spl.isos || [spl.iso];
  const eras = spl.names.map((name, i) => {
    const lo = i > 0 ? isos[i - 1] : null, hi = i < isos.length ? isos[i] : null;
    const pts = points.filter((p) => (!lo || p.iso >= lo) && (!hi || p.iso < hi));
    return pts.length ? { name, from: lo, ...cycleSeries(pts, null, cap) } : null;
  }).filter(Boolean);
  return eras.length > 1 ? eras : null;
}
/* Preferred-PM is a pairing, not an office: the pairing changes whenever
   EITHER leader changes, so its eras splice on the union of both sides'
   handover dates and name themselves "PM v Opponent" per segment. Person
   lists are the CYC_META display strings split on "→" (they agree with the
   spl names by construction); an office that changed hands but holds no
   ppm readings before the handover contributes an empty segment and the
   lines collapse – 2019's Shorten segment evaporates, leaving one
   Morrison v Albanese pairing; 2001's Beazley fortnight does the same. */
const splIsos = (spl) => (spl ? (spl.isos || [spl.iso]) : []);
const eraNameAt = (isos, names, iso) =>
  names[Math.min(isos.filter((b) => b <= iso).length, names.length - 1)];
const ppmPairName = (c, iso) =>
  eraNameAt(splIsos(c.pmSpl), c.pm.split(" → "), iso) + " v " +
  eraNameAt(splIsos(c.oppSpl), c.oppLead.split(" → "), iso);
function ppmErasFor(c, points, cap) {
  const isos = [...new Set([...splIsos(c.pmSpl), ...splIsos(c.oppSpl)])].sort();
  if (!isos.length) return null;
  const segs = isos.map((b, i) => [i ? isos[i - 1] : null, b])
    .concat([[isos[isos.length - 1], null]]);
  const eras = segs.map(([lo, hi]) => {
    const pts = points.filter((p) => (!lo || p.iso >= lo) && (!hi || p.iso < hi));
    return pts.length
      ? { name: ppmPairName(c, lo ?? pts[0].iso), from: lo, ...cycleSeries(pts, null, cap) }
      : null;
  }).filter(Boolean);
  return eras.length > 1 ? eras : null;
}
/* Hanson rides on the opposition-leader chart behind a toggle. Built WITHOUT
   fillSeries, unlike every other cycle series: she has seven approval-metric
   readings across part of one term, and interpolating between them would make
   most of the line invention rather than measurement. Months nobody asked the
   question stay null, and the chart simply spans the gap. */
function sparseSeries(points, months, cap) {
  const b = {};
  for (const p of points) {
    if (p.v == null) continue;
    const k = Math.round(p.m);
    if (k < 0 || k > cap) continue;
    (b[k] ||= []).push(p);
  }
  return months.map((m) => (b[m] ? r1(monthOfReadings(b[m])) : null));
}
/* ---- how the final polls have done, cycle by cycle --------------------
   The page's own caveat is that no aggregate can measure error shared across
   the whole industry about ITSELF. This is the only place that error is
   visible: every past election with a dated final poll, each with a result
   to check that poll against, and the honest answer of how far out they were.

   The rule, stated once here so the number is reproducible: every house's LAST
   poll with a 2PP in the 14 days before polling day, one per house, equally
   weighted. Not sample-weighted - each house is a separate attempt at the same
   question and the interesting quantity is how many of them missed the same
   way, not how many people they rang. Exit polls are excluded: they measure
   voters leaving a booth, not an electorate deciding, and would flatter the
   record they belong to. Pre-1993 the 2PP scored is IMPLIED last-election-
   flows on F2F Morgan primaries (FLOW_ERAS; see the CYC_META note), so a
   single-house era's miss folds poll error and flow-constant drift into one
   figure. Essential's undecided-inclusive pair is normalised
   first, the same way the trend series normalises it, or its 48/47 would score
   as a 4-point miss that is really an arithmetic difference. A 1977 window
   override once lived here: the aeforecasts mirror ends at Morgan's
   20 November wave, twenty days out, and the cycle scored it at 21 days.
   The campaign's actual final wave (fieldwork 26/27 Nov, printed in The
   Bulletin's election-day issue) is restored in the data and lands 13 days
   out, so 1977 is scored under the standard window like every other
   election. One wave never reaches the board: an ACC_EXCLUDED row
   (YouGov MRP's 2025 modelled wave) is a seat model's national readout,
   not a poll answering the question the field was asked - and the same
   firm fielded a later conventional poll, which stands as its final word.
   It is drawn nowhere and counted nowhere here. */
const ACC_WINDOW_DAYS = 14;
/* Same operation, renamed on the letterhead. Only renames go in here - Galaxy
   and YouGov are NOT merged, because merging houses to build one longer record
   is a claim about continuity of method that this table is in no position to
   make. */
const ACC_CANON = {
  "Morgan": "Roy Morgan", "Newspoll-YouGov": "Newspoll",
  "Resolve Strategic": "Resolve", "Freshwater Strategy": "Freshwater",
  "RedBridge/Accent": "RedBridge", "Spectre Strategy": "Spectre",
};
const accCanon = (f) => ACC_CANON[f] || f;
/* Left off the board entirely: a modelled wave is not a poll, and where the
   same firm also filed a later conventional final poll the model is not
   even its freshest word - one attempt per house is the rule, and two name
   strings do not make two houses. The fixture test pins the exclusion.
   User call 2026-11-04. */
const ACC_EXCLUDED = new Set(["YouGov MRP"]);
const accuracyCycles = CYC_META.filter((c) => !c.current && c.src).map((c) => {
  const e = ELECTIONS["e" + c.src];
  const eMs = new Date(e.date).getTime();
  const winDays = ACC_WINDOW_DAYS;
  const inWindow = (cyclePolls[c.src] || []).filter((p) => {
    if (p.firm === "Election" || /exit/i.test(p.firm)) return false;
    if (p.tpp_alp == null) return false;
    // a mirror date that only names the month (dateApprox) can't be placed
    // inside a 14-day window: "May 1954" may have been fielded on the 2nd
    if (p.dateApprox) return false;
    const d = ddays(eMs, new Date(p.date).getTime());
    return d >= 0 && d <= winDays;
  });
  const byHouse = new Map();
  for (const p of [...inWindow].sort((a, b) => a.date.localeCompare(b.date)))
    byHouse.set(accCanon(p.firm), p);
  /* Raw error kept beside the display pair: the sign test below must read
     the unrounded figure – a +0.04 miss displays as 0.0 but is still a miss
     on the Coalition's side, and rounding it before the sign test would
     silently flip one-sidedness on a dead-heat display. The imp side re-reads
     the same poll through the implied basis: its primaries put through ONE
     flow table, the one counted at the election that opened the term
     (FLOW_LEF) – the eve-of-poll-fair normaliser, which takes each house's
     own allocation method out of its score. Era rows already score implied
     figures (tppEra, FLOW_ERAS), so for them both bases are the one number. */
  const raw = [...byHouse.entries()]
    .filter(([firm]) => !ACC_EXCLUDED.has(firm))
    .map(([firm, p]) => {
      const alp = share2pp(p);
      const imp = p.tppEra != null ? alp : impliedLefAlp2pp(FLOW_LEF[c.year], p);
      return { firm, date: p.date, alp, errRaw: alp - e.tpp_alp, imp };
    });
  if (!raw.length) return null;
  const houses = raw.map((h) => ({
    firm: h.firm, date: h.date, alp2pp: r1(h.alp), err: r1(h.errRaw),
    alp2ppImp: h.imp == null ? null : r1(h.imp),
    errImp: h.imp == null ? null : r1(h.imp - e.tpp_alp),
  })).sort((a, b) => Math.abs(a.err) - Math.abs(b.err));
  const meanPoll = houses.reduce((t, h) => t + h.alp2pp, 0) / houses.length;
  const err = meanPoll - e.tpp_alp;
  const impHouses = houses.filter((h) => h.errImp != null);
  const impRaw = raw.filter((h) => h.imp != null).map((h) => h.imp - e.tpp_alp);
  const impMean = impHouses.length
    ? impHouses.reduce((t, h) => t + h.alp2ppImp, 0) / impHouses.length
    : null;
  return {
    // labelled by the election being CALLED, which is the one a reader
    // remembers – not the election that started the term
    year: c.src, eDate: e.date, result: e.tpp_alp,
    mean: r1(meanPoll), err: r1(err), absErr: r1(Math.abs(err)),
    houses, n: houses.length,
    // did they all miss the same way? one-sided error is the signature of a
    // problem in the industry rather than noise in a house. It takes two
    // houses to agree: a lone house always "misses one way", which flagged
    // every single-poll election of the 1970s and 80s as an industry failure
    sameSide: raw.length >= 2 && (raw.every((h) => h.errRaw > 0) || raw.every((h) => h.errRaw < 0)),
    worst: r1(Math.max(...houses.map((h) => Math.abs(h.err)))),
    // the implied-flows reckoning of the same row (see the raw note); the
    // mean mirrors the published side's arithmetic – a mean OF the rounded
    // display values – so the card and the dots never disagree
    meanImp: impMean == null ? null : r1(impMean),
    errImp: impMean == null ? null : r1(impMean - e.tpp_alp),
    absErrImp: impMean == null ? null : r1(Math.abs(impMean - e.tpp_alp)),
    sameSideImp: impRaw.length >= 2 && (impRaw.every((v) => v > 0) || impRaw.every((v) => v < 0)),
    worstImp: impHouses.length ? r1(Math.max(...impHouses.map((h) => Math.abs(h.errImp)))) : null,
  };
}).filter(Boolean);
const accuracy = accuracyCycles.length ? (() => {
  const firmsFor = (errOf) => {
    const byFirm = new Map();
    for (const c of accuracyCycles)
      for (const h of c.houses) {
        const err = errOf(h);
        if (err == null) continue;
        const e = byFirm.get(h.firm) || { firm: h.firm, cycles: [] };
        e.cycles.push({ year: c.year, err });
        byFirm.set(h.firm, e);
      }
    return [...byFirm.values()].map((f) => ({
      firm: f.firm, n: f.cycles.length, cycles: f.cycles,
      meanErr: r1(f.cycles.reduce((t, c) => t + c.err, 0) / f.cycles.length),
      meanAbs: r1(f.cycles.reduce((t, c) => t + Math.abs(c.err), 0) / f.cycles.length),
    })).sort((a, b) => b.n - a.n || a.meanAbs - b.meanAbs);
  };
  const abs = accuracyCycles.map((c) => c.absErr);
  const absImp = accuracyCycles.filter((c) => c.absErrImp != null).map((c) => c.absErrImp);
  return {
    windowDays: ACC_WINDOW_DAYS, cycles: accuracyCycles,
    firms: firmsFor((h) => h.err),
    firmsImp: firmsFor((h) => h.errImp),
    meanAbs: r1(abs.reduce((t, v) => t + v, 0) / abs.length),
    meanAbsImp: absImp.length ? r1(absImp.reduce((t, v) => t + v, 0) / absImp.length) : null,
    worstCycle: accuracyCycles.reduce((w, c) => (c.absErr > w.absErr ? c : w)),
  };
})() : null;

/* ---- each pollster's historical lean on the election result ------------
   The primary-vote leans panel's second reading (user call 2026-11-20):
   besides each pollster's gap to the others polling beside it, its record
   against the count. The final-polls rule, applied to each party's primary:
   every house's LAST poll within ACC_WINDOW_DAYS of polling day, one poll
   per house, ACC_CANON renames, ACC_EXCLUDED and exit polls out, an
   approximate (month-only) date out. Its primaries are scaled to sum to 100
   first, so a house that prints undecided voters (Essential 2022, 93) is
   scored on decided voters as the count is. A party is scored only where
   both poll and count name it; "others" is everyone else, so where the
   count folds One Nation into the others (2004-2016) the poll's One Nation
   joins its others too, and a poll without One Nation beside a count with
   it scores neither. Elections since 1987, the start of the primaries
   backtest, before which the houses' methods share nothing with today's.
   Per party, per house: one row per election, {year, poll, result, err}. */
const ELECTION_LEAN_FROM = 1987;
const electionLean = (() => {
  const parties = ["alp", "lnp", "grn", "onp", "oth"];
  const out = Object.fromEntries(parties.map((k) => [k, {}]));
  const years = [];
  for (const c of CYC_META.filter((c) => !c.current && c.src && Number(c.src) >= ELECTION_LEAN_FROM)) {
    const e = ELECTIONS["e" + c.src];
    if (!e) continue;
    const eMs = new Date(e.date).getTime();
    const byHouse = new Map();
    for (const p of [...(cyclePolls[c.src] || [])].sort((a, b) => a.date.localeCompare(b.date))) {
      if (p.firm === "Election" || /exit/i.test(p.firm) || p.dateApprox || p.alp == null || p.lnp == null) continue;
      const d = ddays(eMs, new Date(p.date).getTime());
      if (d < 0 || d > ACC_WINDOW_DAYS) continue;
      byHouse.set(accCanon(p.firm), p);
    }
    let any = false;
    for (const [firm, p] of byHouse) {
      if (ACC_EXCLUDED.has(firm)) continue;
      const restOf = (o) => Object.entries(o).filter(([k, v]) => !["date", "firm", "alp", "lnp", "grn", "onp"].includes(k)
        && !/^tpp/.test(k) && typeof v === "number").reduce((t, [, v]) => t + v, 0);
      const tot = ["alp", "lnp", "grn", "onp"].reduce((t, k) => t + (p[k] || 0), 0) + restOf(p);
      if (!(tot > 50)) continue;
      const sc = (v) => (v * 100) / tot;
      const foldOn = e.onp == null;
      const cell = {
        alp: [sc(p.alp), e.alp], lnp: [sc(p.lnp), e.lnp],
        grn: p.grn != null && e.grn != null ? [sc(p.grn), e.grn] : null,
        onp: p.onp != null && e.onp != null ? [sc(p.onp), e.onp] : null,
        oth: e.oth == null ? null
          : foldOn ? [sc(restOf(p) + (p.onp || 0)), e.oth]
          : p.onp != null ? [sc(restOf(p)), e.oth] : null,
      };
      for (const k of parties) {
        if (!cell[k] || cell[k][1] == null) continue;
        any = true;
        (out[k][firm] ||= []).push({ year: c.src, poll: r1(cell[k][0]), result: r1(cell[k][1]), err: r2(cell[k][0] - cell[k][1]) });
      }
    }
    if (any) years.push(c.src);
  }
  return years.length ? { from: ELECTION_LEAN_FROM, windowDays: ACC_WINDOW_DAYS, years, canon: ACC_CANON, parties: out } : null;
})();

/* ---- the past terms' 2PP, on the implied basis ----------------------------
   Every term's line reads its polls the way the sitting term's implied 2PP
   does: primaries through ONE flow table, the one counted at the election
   that opened the term (FLOW_LEF in flows.mjs – last-election flows, the
   only table anyone inside the term could have used). So a line moves when
   voting intentions moved, never because the houses' allocation methods
   changed, and every term back to 1987 is on the same footing as today's.
   The 1972–84 Morgan rows already carry this figure (tppEra, FLOW_ERAS).
   The election row is the count itself and stays so. The houses' own
   published 2PPs are untouched in the data and still score the final polls
   (accuracyCycles), because there the question is what the pollsters said. */
const cycleTppImp = (p, c) => {
  const pub = p["tpp_" + c.gov] ?? null;
  if (p.firm === "Election" || p.tppEra != null) return pub;
  const t = FLOW_LEF[c.year];
  if (!t) return pub;
  const a = impliedLefAlp2pp(t, p);
  if (a == null) return null;
  return r2(c.gov === "alp" ? a : 100 - a);
};
/* The sitting term's contest eras: one run per stretch of months against the
   same rival, named for it. Null while the term has only ever had one. */
const RIVAL_NAME = { alp_lnp: "v Coalition", alp_on: "v One Nation" };
function rivalEras(pts, c, cap) {
  const segs = [];
  for (const p of pts) {
    if (!segs.length || segs[segs.length - 1].who !== p.who) segs.push({ who: p.who, from: p.iso, why: p.why, pts: [] });
    segs[segs.length - 1].pts.push(p);
  }
  if (segs.length < 2) return null;
  // why: what handed over the spot ("2pp": the gap cleared its margin; "default": it didn't)
  return segs.map((s, i) => ({ name: c.lead + " " + RIVAL_NAME[s.who], rival: s.who, from: i ? s.from : null,
                               ...(i && s.why ? { why: s.why } : {}),
                               ...cycleSeries(s.pts, i === 0 ? c.eTpp : null, cap) }));
}
/* Each term's readings debiased as the site's live series are: house effects
   measured within the term against its own consensus (houseEffectsFor – a
   lean belongs to a house at a time, so it is never carried across terms),
   each reading corrected by its house's lean as of its date. Until Newspoll
   joined it in August 1987 Morgan polled alone, so there is no consensus to
   measure against and nothing moves. The election rows some archives end on
   are results, not a house, so they never enter the estimate. `strat` keeps
   a measure's people apart (a leader net's era), as the live panel does. */
const debiasTerm = (pts, strat) => {
  const he = houseEffectsFor(pts.filter((p) => p.v != null && p.firm && p.firm !== "Election")
    .map((p) => ({ firm: p.firm, mid: p.t, x: p.v, n: p.n || 1200, ...(strat ? { strat: strat(p) } : {}) })));
  return pts.map((p) => (p.v == null || !p.firm ? p : { ...p, v: p.v - heV(he, p.firm, p.t) }));
};
const eraIndex = (spl) => (p) => splIsos(spl).filter((b) => b <= p.iso).length;

/* Past cycles' leader lines on the leadership model (§4m), so a term reads
   here as it does on the leadership chart. Month m of a term is read off the
   model's line for whoever held the office on that day (a rating series is a
   person in an office, a preferred-PM series a PM–opposition-leader
   pairing), evaluated on that day (§4m's CYC_DAYS); a series has no value
   more than half a month before its first reading or after its last. Preferred PM is the lead among those who
   chose one of the two, the leadership chart's basis. Each person (pairing)
   is its own run, and a term with two or more is split into them (the eras
   the charts draw); the pooled line under them, which fits the domain, the
   change-since base and the peer average, joins the runs across a handover
   gap and holds its last value to the term's end, as cycleSeries' lines do.
   obs: a reading of the run's series landed in the month. */
function ldCycleLines(c, months) {
  if (!LDM) return null;
  const e0 = Date.parse(c.eDate) / 86400000;
  const dayOf = (k) => Math.round(e0 + k * MS_MONTH);      // = §4m's CYC_DAYS
  const isoOf = (d) => new Date(d * 86400000).toISOString().slice(0, 10);
  const atSt = (list, iso) => list.find((x) => iso >= x.from && iso < x.to) || null;
  const rById = new Map(LDM.rSeries.map((x) => [x.S.id, x])), pById = new Map(LDM.pSeries.map((x) => [x.S.id, x]));
  const han = LDM.rSeries.find((x) => x.S.role === "han") || null, h2h = LDM.pSeries.find((x) => x.S.contest === "alb-han") || null;
  const seriesAt = (kind, iso) => {
    const P = atSt(LDM.PM_ST, iso), O = atSt(LDM.OPP_ST, iso);
    if (kind === "pm") return P ? rById.get("pm:" + P.person + ":" + P.from) : null;
    if (kind === "opp") return O ? rById.get("opp:" + O.person + ":" + O.from) : null;
    if (kind === "ppm") return P && O ? pById.get("pm-opp:" + P.person + ":" + P.from + ":" + O.person + ":" + O.from) : null;
    return kind === "han" ? han : h2h;
  };
  const nameOf = (X) => (X.S.contest ? X.S.pm + " v " + X.S.opp : X.S.person);
  const fromOf = (X) => (X.S.contest ? X.S.id.split(":").filter((q) => /^\d{4}-\d\d-\d\d$/.test(q)).sort().pop() : X.S.from);
  const grid = (kind) => {
    const runs = new Map();
    const raw = months.map((k, i) => {
      const d = dayOf(k), X = seriesAt(kind, isoOf(d));
      if (!X) return null;
      const v = X.cyc.get(d);
      if (v == null) return null;
      if (!runs.has(X.S.id)) {
        const seen = new Set(X.S.obs.map((o) => Math.round(monthsSince(o.raw.date, c.eDate))));
        runs.set(X.S.id, { X, vals: months.map(() => null), obs: months.map((m) => seen.has(m)), first: i });
      }
      runs.get(X.S.id).vals[i] = r1(v);
      return { v, id: X.S.id };
    });
    const known = {}; raw.forEach((r, i) => { if (r) known[i] = r.v; });
    const ks = Object.keys(known).map(Number);
    const filled = fillSeries(known, months.map((_, i) => i));
    const vals = months.map((_, i) => (!ks.length || i < ks[0] ? null : r1(filled[i])));
    const obs = months.map((_, i) => !!raw[i] && runs.get(raw[i].id).obs[i]);
    const rs = [...runs.values()].sort((a, b) => a.first - b.first);
    for (const r of rs) r.obs = r.obs.map((b, i) => b && r.vals[i] != null);
    const eras = rs.length > 1 ? rs.map((r, j) => ({ name: nameOf(r.X), from: j ? fromOf(r.X) : null, months, vals: r.vals, obs: r.obs })) : null;
    return { vals, obs, eras, first: rs.length ? nameOf(rs[0].X) : null };
  };
  return { pm: grid("pm"), opp: grid("opp"), ppm: grid("ppm"), han: grid("han"), ppmh: grid("ppmh") };
}

const CYCLE_DEFS = CYC_META.map((c) => {
  let primPts, tppPts, netPts, oppPts, hanPts, oppPrimPts, onpPts, ppmPts, ppmhPts = [];
  if (c.current) {
    primPts = aggPrimary.map((d) => ({ m: monthsSince(d.ym + "-15", c.eDate), v: d.alp }));
    /* The sitting term is drawn on the site's default basis, the implied 2PP,
       and against the rival the hero's own ruling names in each month
       (rivalWalk): Labor v Coalition until One Nation took the spot, Labor v
       One Nation after. Every past term had one rival throughout – the other
       party of government – so only this line can change contest, and it
       carries its eras (tppEras below) so the chart can mark where it did.
       The election row is the count, which is month 0's base either way. */
    const onBy = Object.fromEntries(agg2ppSynthOn.map((d) => [d.ym, d]));
    tppPts = agg2ppSynth.filter((d) => !d.election).map((d) => {
      const who = rivalByYm[d.ym] === "alp_on" && onBy[d.ym] ? "alp_on" : "alp_lnp";
      return { m: monthsSince(d.ym + "-15", c.eDate), v: who === "alp_on" ? onBy[d.ym].a : d.alp,
               who, why: rivalWhyByYm[d.ym], iso: d.ym + "-01" };
    });
    /* The opposition chart reads the SAME term from the other side of the
       ballot box: same polls, same months, the losing party's column. Anchors
       come from the election that started the term (ELECTIONS carries every
       party's result per election, so no CYC_META constants are needed). No
       opposition-2PP series exists: 2PP sums to 100, so it would be an exact
       mirror of the government line. */
    oppPrimPts = aggPrimary.map((d) => ({ m: monthsSince(d.ym + "-15", c.eDate), v: d[c.opp] }));
    onpPts = aggPrimary.map((d) => ({ m: monthsSince(d.ym + "-15", c.eDate), v: d.onp }));
    // approval-metric readings only – the historical cycle series are
    // approve−disapprove, so favourability rows would contaminate them
    const apprOnly = apprAgg.filter((a) => metricOf(a.firm, "alb") !== "fav");   // PM approval only, not favourability
    const leaderPt = (a, v) => ({ m: monthsSince(a.date, c.eDate), v, iso: a.date, firm: a.firm, t: Date.parse(a.date), w0: 1 });
    netPts = debiasTerm(apprOnly.map((a) => leaderPt(a, a.alb)));
    oppPts = debiasTerm(apprOnly.map((a) => leaderPt(a, a.opp)), (p) => eraOf(p.iso));
    // current-term ppm readings are the live ppm table's per-wave margin –
    // sample-weighted, never house-adjusted, as the live panel is; TWO-WAY
    // rows only: a three-way prompt (han != null) is a different question
    // (Albanese 31, Taylor 15) that read the margin +9.6 against the
    // two-way +2 in Oct 2026; its own lead is ppmHMarginNow's pool
    ppmPts = ppm.filter((p) => p.han == null && p.alb != null && p.opp != null)
      .map((p) => ({ m: monthsSince(p.date, c.eDate), v: p.alb - p.opp, iso: p.date, firm: p.firm, t: Date.parse(p.date), n: ppmN(p) }));
    // Albanese v Hanson on the same per-wave margin basis: a third question
    // asked as its own contest this term only (ppH above), so it takes the
    // live panel's treatment too – never house-adjusted, sparse months
    ppmhPts = D.ppmHeadToHead.filter((r) => r.alb != null && r.han != null)
      .map((r) => ({ m: monthsSince(r.date, c.eDate), v: r.alb - r.han, iso: r.date, firm: r.firm, t: Date.parse(r.date), n: ppmN(r) }));
    // Hanson's metric is filtered per row and per DATE – Resolve rated her on
    // likeability until the 6-11 Jul 2026 wave and on performance after it, so
    // an unbounded firm test would put favourability on an approval line.
    hanPts = debiasTerm(apprAgg.filter((a) => metricOf(a.firm, "han", a.date) !== "fav").map((a) => leaderPt(a, a.han)));
  } else {
    const ps = cyclePolls[c.src], as = cycleAppr[c.appr];
    const pollPt = (p, v) => ({ m: monthsSince(p.date, c.eDate), v, iso: p.date, firm: p.firm, t: Date.parse(p.date) });
    primPts = debiasTerm(ps.map((p) => pollPt(p, p[c.gov])));
    tppPts = debiasTerm(ps.map((p) => pollPt(p, cycleTppImp(p, c))));
    oppPrimPts = debiasTerm(ps.map((p) => pollPt(p, p[c.opp])));
    onpPts = debiasTerm(ps.map((p) => pollPt(p, p.onp)));
    // same rule as the current cycle: these lines are approve−disapprove, so a
    // favourability net never enters them. Historical rows may name the metric
    // in a 5th element; otherwise the firm decides. Matters most for the 2022
    // cycle, where Freshwater and RedBridge report favourability.
    const apprRows = as.filter((r) => (r.metric || metricOf(r.firm, "alb")) !== "fav");
    const netPt = (r, v) => ({ m: monthsSince(r.date, c.eDate), v, iso: r.date, firm: r.firm, t: Date.parse(r.date), w0: 1 });
    netPts = debiasTerm(apprRows.map((r) => netPt(r, r.pmNet)), eraIndex(c.pmSpl));
    oppPts = debiasTerm(apprRows.map((r) => netPt(r, r.oppNet)), eraIndex(c.oppSpl));
    // preferred-PM rides the same approval waves: margin per wave, PM minus
    // opponent. Pairing-neutral number, so it filters ALL rows, not the
    // favourability-safe apprRows – Freshwater reports approval as
    // favourability but its ppm readings stand independently
    ppmPts = as.filter((r) => r.pmPpm != null && r.oppPpm != null)
      .map((r) => ({ m: monthsSince(r.date, c.eDate), v: r.pmPpm - r.oppPpm, iso: r.date, firm: r.firm, t: Date.parse(r.date) }));
    // no past cycle rated Hanson: cycleApproval carries pmNet and oppNet only
    hanPts = [];
    // and none asked the Albanese–Hanson pair, a 2026 question
    ppmhPts = [];
  }
  /* The month cap is the term's own length, not a flat 36: 1998, 2004 and
     2010 ran 36.5-37.5 months, and the flat cap silently dropped their
     closing weeks from the drawn lines while endRes ringed the closing
     election ~1.5 months past where the line stopped. cyclePolls is keyed
     by the term, so a longer cap can never pull in a neighbouring term's
     readings - it only stopped cutting real ones off. */
  const cap = c.current ? Math.max(1, Math.round(monthsSince(LATEST_ISO, c.eDate)))
    : (ELECTIONS["e" + c.src] ? Math.round(monthsSince(ELECTIONS["e" + c.src].date, c.eDate)) : 36);
  const prim = cycleSeries(primPts, c.ePrim, cap);
  const tpp = cycleSeries(tppPts, c.eTpp, cap);
  const eOpp = ELECTIONS["e" + c.year];             // the election that STARTED the term
  // and the one that ENDED it, for the past-cycles election rings: the vote
  // cards ring both counts against each drawn term's line - the 2PP card its
  // two-party share, and the two primary cards each side's first preferences
  // (primary/oppr name the CARD, so primary is the government's figure and
  // oppr the opposition's, whoever held which office). The sitting term has
  // none - its result is uncounted.
  const eClose = c.current ? null : ELECTIONS["e" + c.src];
  const endRes = eClose && eClose["tpp_" + c.gov] != null
    ? { x: +monthsSince(eClose.date, c.eDate).toFixed(3), tpp: eClose["tpp_" + c.gov],
        primary: eClose[c.gov], oppr: eClose[c.opp] }
    : null;
  const oppr = cycleSeries(oppPrimPts, eOpp[c.opp], cap);
  /* One Nation's overlay keeps the vote-series machinery but its history has
     a hole: houses didn't report it separately before 2016, and the elections
     table records `onp: null` for 2010/2013. cycleSeries on an empty list
     degrades to zero rows, so those terms emit a null-padding grid and simply
     draw nothing when the overlay is on. */
  const onp = cycleSeries(onpPts, eOpp.onp, cap);
  const net = cycleSeries(netPts, null, cap);
  const opp = cycleSeries(oppPts, null, cap);
  const ppmm = cycleSeries(ppmPts, null, cap);
  const months = prim.months;
  // trailing months beyond a measure's range hold its last value; leading
  // nulls stay null (see cycleSeries)
  const align = (s) => months.map((m) => {
    const i = s.months.indexOf(m);
    if (i >= 0) return s.vals[i];
    return m < s.months[0] ? null : s.vals[s.vals.length - 1];
  });
  /* Same alignment for the observed flags, with one difference: `align` HOLDS
     a measure's last value across months past its range, and a held value is
     not a reading. Anything outside the measure's own months is false. */
  const alignObs = (s) => months.map((m) => {
    const i = s.months.indexOf(m);
    return i >= 0 ? s.obs[i] : false;
  });
  /* The PM's net approval LEAD over his strongest rival, as a series in
     its own right - the summary table's "PM net approval, lead" measure
     promoted to a Past-cycles line (user call 2026-10-17): per month,
     net approval less the higher of the opposition leader's and Hanson's
     net, computed ON the aligned month grids so the card's line and
     every summary cell are the same arithmetic everywhere on the page.
     Hanson joins where her sparse series read her; no past term rated
     her, so every past term's rival is its opposition leader alone. A
     held leg (a month the leader went unrated) still pairs, exactly as
     the other aligned grids hold their values. The per-wave dots beside
     the line are one wave's own pair difference and can sit off it in a
     mixed-house month - the usual dots-vs-line split, not a bug. */
  /* federal: the leader lines are the leadership model's (ldCycleLines) */
  const LC = ldCycleLines(c, months);
  const netA = LC ? LC.pm.vals : align(net), oppA = LC ? LC.opp.vals : align(opp);
  const hanA = LC ? LC.han.vals : sparseSeries(hanPts, months, cap);
  const leadGrid = months.map((m, i) => {
    const n = netA[i], o = oppA[i], h = hanA[i];
    const rival = Math.max(o != null ? o : -Infinity, h != null ? h : -Infinity);
    return n != null && rival !== -Infinity ? +(n - rival).toFixed(2) : null;
  });
  /* a lead month was polled when both legs were - where either flag is
     missing the "measured" gate fails. The pairing eras and single-pair
     name ride one pseudo point per measured month (ppmErasFor buckets
     points by month and eras splice on the union of both offices'
     handover dates, like preferred PM's), and its iso need only invert
     monthsSince - a boundary month's pairing is whoever held office on
     the month's nominal date. */
  const netO = LC ? LC.pm.obs : alignObs(net), oppO = LC ? LC.opp.obs : alignObs(opp);
  const leadObs = netO.map((b, i) => b && oppO[i]);
  const monthIso = (m) => new Date(Date.parse(c.eDate) + m * MS_MONTH * 86400000).toISOString().slice(0, 10);
  const leadPts = months.map((m, i) =>
    leadGrid[i] != null && leadObs[i] ? { m, v: leadGrid[i], iso: monthIso(m), n: 1, obs: true } : null).filter(Boolean);
  return {
    year: c.year, gov: c.gov, opp: c.opp, pm: c.pm, lead: c.lead, oppLead: c.oppLead, current: !!c.current,
    eDate: c.eDate,
    ...(endRes ? { endRes } : {}),
    months, primary: prim.vals, tpp: tpp.vals, net: netA, oppnet: oppA,
    oppr: oppr.vals,
    ppmm: LC ? LC.ppm.vals : align(ppmm),
    pmlead: leadGrid,
    // the null-padded form align() can't produce alone: with no ONP readings
    // on record (2010/13), s.months is empty and align has nothing to index
    onp: onp.months.length ? align(onp) : months.map(() => null),
    obs: { primary: prim.obs, tpp: tpp.obs, net: netO, oppnet: oppO,
           oppr: oppr.obs, onp: alignObs(onp), ppmm: LC ? LC.ppm.obs : alignObs(ppmm), pmlead: leadObs },
    han: hanA,
    // like Hanson's: this-term-only readings, sparse over the month grid
    ppmh: LC ? LC.ppmh.vals : sparseSeries(ppmhPts, months, cap),
    netEras: LC ? LC.pm.eras : eraSeries(netPts, c.pmSpl, cap), oppEras: LC ? LC.opp.eras : eraSeries(oppPts, c.oppSpl, cap),
    tppEras: c.current ? rivalEras(tppPts, c, cap) : null,
    ppmEras: LC ? LC.ppm.eras : ppmErasFor(c, ppmPts, cap),
    // pairing name for the single-line legend when the pairing never
    // changed inside the measured window (e.g. "Albanese v Dutton")
    ppmPair: LC ? LC.ppm.first : ppmPts.length ? ppmPairName(c, ppmPts[0].iso) : null,
    // the lead's own pairing splice and name, on the same union-of-splices
    // grid as preferred PM's (the pairing changes when EITHER office does)
    pmleadEras: ppmErasFor(c, leadPts, cap),
    pmleadPair: leadPts.length ? ppmPairName(c, leadPts[0].iso) : null,
  };
});

/* The sitting term's latest point is the figure the site quotes now, not the
   current month so far: early in a month that month rests on a poll or two,
   the weakness that moved the headline itself to the nowcast (§7e). The 2PP
   is the hero's own – the implied figure against the rival it names (§7b,
   §7f) – the primaries are §7e's, the leader lines the current readings
   (§4b). Every other point, and every past term's, is a whole month's; this
   is the one the page's sentence ("16 months in, …") compares. The era run
   that ends there ends on the same figure. */
{
  const cur = CYCLE_DEFS.find((c) => c.current);
  if (cur && cur.months.length) {
    const i = cur.months.length - 1, m = cur.months[i];
    const now = {
      tpp: rivalLead === "alp_on" ? (onImp ? onImp.a : null) : (synthNow ? synthNow.alp : null),
      primary: primaryNow ? primaryNow[cur.gov] : null, oppr: primaryNow ? primaryNow[cur.opp] : null,
      onp: primaryNow ? primaryNow.onp : null,
      net: leaderNow.alb_net ? leaderNow.alb_net.v : null, oppnet: leaderNow.taylor_net ? leaderNow.taylor_net.v : null,
      han: leaderNow.hanson_net ? leaderNow.hanson_net.v : null,
      /* preferred PM on the model's basis where it runs: the lead among
         those who chose, read off the shares the leadership panel's bars print */
      ppmm: LDM ? (LDM.pnow.taylor ? r1(2 * LDM.pnow.taylor.share.v - 100) : null) : ppmMarginNow ? ppmMarginNow.v : null,
      ppmh: LDM ? (LDM.pnow.hanson ? r1(2 * LDM.pnow.hanson.share.v - 100) : null) : ppmHMarginNow ? ppmHMarginNow.v : null,
      /* the figure its chart opens on - the live pools' lead over the
         stronger of the leader of the opposition and Hanson */
      pmlead: leaderNow.alb_net && leaderNow.taylor_net
        ? r1(leaderNow.alb_net.v - Math.max(leaderNow.taylor_net.v, leaderNow.hanson_net ? leaderNow.hanson_net.v : -Infinity))
        : null,
    };
    /* Era runs are bucketed poll by poll, so a reading from the last days of
       a month can land one month past the term's latest (months since the
       election round up): no run draws past it, and the last run ends on the
       same current figure as the line it belongs to. A split that trimming
       leaves with one run is no split, as eraSeries rules. */
    const endRuns = (key, v) => {
      const eras = cur[key];
      if (!eras) return;
      for (const e of eras) {
        const cut = e.months.findIndex((x) => x > m);
        if (cut >= 0) { e.months = e.months.slice(0, cut); e.vals = e.vals.slice(0, cut); if (e.obs) e.obs = e.obs.slice(0, cut); }
      }
      const kept = eras.filter((e) => e.vals.some((x) => x != null));
      const e = kept[kept.length - 1], j = e ? e.months.indexOf(m) : -1;
      if (j >= 0 && v != null) { e.vals[j] = r1(v); if (e.obs) e.obs[j] = true; }
      cur[key] = kept.length > 1 ? kept : null;
    };
    for (const [k, v] of Object.entries(now)) {
      if (v == null || !Number.isFinite(v) || !cur[k]) continue;
      cur[k][i] = r1(v);
      if (cur.obs[k]) cur.obs[k][i] = true;
    }
    endRuns("tppEras", now.tpp);
    endRuns("oppEras", now.oppnet);
    endRuns("netEras", now.net);
    endRuns("ppmEras", now.ppmm);
    endRuns("pmleadEras", now.pmlead);
  }
}

/* ---- publication cadence, for "next expected polls" ---------------------
   Two quantities per house, both measured rather than assumed:

   cadence – the median gap between its own consecutive fieldwork-end dates
     over the last 8 waves. The regulars are extremely regular: Roy Morgan's
     last eight gaps are 7,7,7,7,7,7,7,7 and YouGov's are 14 except one 13.

   lag – days from fieldwork close to publication, taken from the poll's own
     `published` date where one is recorded, and otherwise read out of release
     URLs that carry their own date (roymorgan.com/findings/...-august-17-2026,
     essentialreport.com.au/reports/25-march-2026). 38 Roy Morgan releases give
     a median of 1 day, range 0-2, which is where the global default comes from.
     A house with neither still falls back to that default - so the way to make
     a house's prediction its own rather than the field's average is to record
     `published` on its polls.

   Only houses on a genuine cadence are published: at least 4 waves, a spread
   small relative to the interval, and not declared stopped. Silence alone
   does not remove one - an unrecorded release keeps its house on the
   projection, the slot itself rolling after a short grace, until the wave
   is recorded. A house that has broken its own pattern is not "expected"
   and is left out rather than given a made-up date. */
const CAD_DEFAULT_LAG = 1;
/* npMonthEndSlot, taken from the SHIPPED np-project.js (a classic browser
   script, so run in a vm rather than imported): the month-end rule's record
   below is measured with the same function the page projects with. */
const CAD_ME_BREAK = 14;       // days off the month-end slot that mean another month-end, not a slip
const CAD_ME_MAX_BREAKS = 2;   // of the last eight, before the rule is judged not to hold
const NP_MONTH_END_SLOT = (() => {
  const ctx = { window: { AP: {} } };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(HERE, "assets", "np-project.js"), "utf8"), ctx);
  return ctx.window.AP.npMonthEndSlot;
})();
/* The weekday, the hour and the spread are all read off a RECENT window, not
   the whole record - the same eight-wave window the cadence itself uses, plus
   a little slack so a house does not lose its habit to one sample. A house's
   schedule is a current fact about it, and its early record is often a
   different house: Roy Morgan's release slugs are Monday in only two thirds of
   the full run, because the 2025 ones are named for the fieldwork end, and
   Monday in eleven of the last twelve. Judging it on all 39 hid the schedule
   it actually keeps. */
const CAD_RECENT = 12;
// timed releases needed before the hour span drops its single earliest and latest
const CAD_TRIM_MIN = 8;
/* How many recent releases the panel LISTS when a row is opened. Deliberately
   fewer than the window the estimate is taken over: five is what a reader will
   actually read down, and the row says how many intervals the median really
   covers rather than letting the list imply it. */
const CAD_SHOW = 5;
/* Intervals are measured between RELEASES where a house has recorded enough of
   them, and between fieldwork ends only where it has not.

   The panel forecasts a publication, so a publication is the thing whose
   rhythm it should be extrapolating - and fieldwork ends are a much noisier
   proxy for it than they look. Newspoll's last eight fieldwork gaps run
   18,28,21,31,18,21,21,22, which reads as a house that wanders between two
   and four and a half weeks; its last eight PUBLICATION gaps are
   21,28,21,28,21,21,21,21. It goes out three weeks apart, six times in eight,
   and the wobble was entirely in when its fieldwork happened to close. That
   noise was being carried into the projection and then into a ± that called a
   metronomic house give-or-take a week.

   The run has to be UNBROKEN back from the newest release, not merely long: an
   undated release between two dated ones makes a "gap" two waves wide, which
   would poison the median far worse than the fieldwork dates ever did. */
const CAD_PUB_MIN = 4;         // publication intervals before that basis is used
const CAD_DOW_MIN = 5;         // dated releases before a weekday can be a habit
const CAD_DOW_SHARE = 0.8;     // and the share of them that must share it
const CAD_MIN_POLLS = 4;
/* One further gate, learned the hard way from Fox & Hedgehog: 86 days
   silent on a 44-day cycle, and a window of ±15 days – and it still sorted
   ABOVE metronomic Roy Morgan, because a wide window can centre on an early
   date. So the window must be tight relative to the interval: "some time in
   a 30-day range" is not a forecast, and printing one next to a house that
   really is weekly devalues both.

   A silence cliff used to sit beside it: past 1.5 intervals unpublished a
   house was judged to have stopped and dropped from the projection. That
   turned a blown slot into a vanished one – exactly when a reader most
   needs to see it. Silence is not evidence of stoppage any more: an
   unrecorded release keeps its HOUSE on the list (the dated slot itself
   rolls on after a short grace; a window holds its seat) until the wave is
   recorded, and a house that has genuinely stopped (Fox & Hedgehog among
   them) is removed by hand instead, via pollsterRules.stopped. */
const CAD_MAX_REL_SPREAD = 0.30;
/* The spread is half the RANGE of a house's recent intervals with the single
   most extreme at each end set aside - not a robust SD off the MAD, which is
   what this used to be. The MAD is zero whenever more than half the gaps are
   identical, and more than half of them ARE identical here, because these
   houses are on schedules. Newspoll's last eight gaps are 18,28,21,31,18,21,
   21,22: six sit within a day of three weeks and two are a month, and the MAD
   read that as +/- 3 days, which the weekday snap then rounded away to a flat
   date. A house that goes an extra week between polls a quarter of the time
   does not have a flat date - and Newspoll, Resolve and Essential all do.

   The trim is what keeps it from being the plain range, which any single freak
   gap would own: DemosAU took six months off between its first two federal
   waves, and untrimmed that one 184-day gap alone made its window wider than
   its own interval and dropped it off the panel. Set aside one value at each
   end and its remaining six gaps run 20 to 53 days, which is the house.

   But only a FREAK is set aside - an end gap more than half an interval off
   the cadence (CAD_TRIM_FREAK). The trim used to drop both ends
   unconditionally, and for a weekday house the single most extreme gap is
   usually its one week-late slip: Newspoll's 21,28,21,21,21,21,21,21 lost
   the 28, read ±0, and the panel claimed an exact Sunday with no
   alternative. The walk-forward backtest (.build/newtracker/np-backtest.mjs,
   last 14 releases per house) had exact-day claims hitting 25 of 30 - 11 of
   16 outside Roy Morgan, the misses a week off. Trimming only freaks took it
   from 61/77 to 66/77 with the dates unchanged (exact-day claims 18/19):
   the week slip the record shows is now the "or the Sunday after" the row
   names. DemosAU's 184-day gap is still a freak. */
const CAD_SPREAD_TRIM = 4;     // gaps needed before an end value can be spared
const CAD_TRIM_FREAK = 0.5;    // an end is spared only this far (x cadence) off the cadence
/* …and beyond THIS there is no rhythm to state at all: a window wider than
   three quarters of the interval says only "some time in the next couple of
   cycles", which is not worth a reader's attention. Between the two, a house
   gets a window instead of a day. */
const CAD_LOOSE_MAX_REL_SPREAD = 0.75;
/* A house that keeps a weekday publishes in SLOTS, so a gap of two slots is
   a release it skipped, not a slow one. Roy Morgan missed the week of 5 Oct
   2026 (29 Sep -> 12 Oct, 13 days) and then 19 Oct: measured raw, the second
   long gap alone took its spread to 3 on a 7-day interval, demoting a
   house with eleven Mondays in its last twelve releases to a window that
   reached a Thursday - and every further fortnight dragged the median
   through 7.5 and 10.5, intervals it never once kept. So for a weekday
   house a gap within CAD_SLOT_TOL of a whole number of intervals counts as
   that many slots, the last of them a normal one (13 -> 6, 14 -> 7), and
   the panel says how many releases that sets aside.

   But a skipped slot repeated is a new rhythm. When the newest
   CAD_RHYTHM_RUN gaps or more agree with each other and sit at a multiple
   of the interval before them (or it at a multiple of theirs), the house
   has changed schedule: the run alone is its interval and its spread, from
   the first gap of it - no blend of the old and the new. Two fortnights in
   a row is still a house that skipped twice; the third makes it
   fortnightly. */
const CAD_SLOT_TOL = 2;        // days a gap may sit off a whole number of slots
const CAD_RHYTHM_RUN = 3;      // like gaps in a row before a new interval is believed
const slotMultiple = (gap, unit) => {
  const k = Math.round(gap / unit);
  return k >= 2 && Math.abs(gap - k * unit) <= CAD_SLOT_TOL ? k : 0;
};
function slotRhythm(gaps, rawCadence) {
  const newest = gaps[gaps.length - 1];
  let n = 0;
  while (n < gaps.length && Math.abs(gaps[gaps.length - 1 - n] - newest) <= CAD_SLOT_TOL) n++;
  const run = gaps.slice(gaps.length - n);
  const before = gaps.slice(0, gaps.length - n).slice(-8);
  const m = medianOf(run.slice(-8)), u = before.length ? medianOf(before) : null;
  if (u && (slotMultiple(m, u) || slotMultiple(u, m))) {
    if (n >= CAD_RHYTHM_RUN) return { cadence: m, gaps: run, rhythmFrom: u, runLen: n };
    // a short run of long gaps: skipped slots on the old interval
    if (slotMultiple(m, u)) return { cadence: u, gaps };
  }
  return { cadence: rawCadence, gaps };
}
const MONTH_NAMES_L = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
                        july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 };
function pubDateFromUrl(url) {
  if (!url) return null;
  let m = url.match(/([a-z]+)-(\d{1,2})-(\d{4})/i);                    // ...-august-17-2026
  if (m && MONTH_NAMES_L[m[1].toLowerCase()])
    return `${m[3]}-${String(MONTH_NAMES_L[m[1].toLowerCase()]).padStart(2, "0")}-${String(m[2]).padStart(2, "0")}`;
  m = url.match(/\/(\d{1,2})-([a-z]+)-(\d{4})/i);                      // .../25-march-2026
  if (m && MONTH_NAMES_L[m[2].toLowerCase()])
    return `${m[3]}-${String(MONTH_NAMES_L[m[2].toLowerCase()]).padStart(2, "0")}-${String(m[1]).padStart(2, "0")}`;
  return null;
}

const lagSamples = {}, timeSamples = {}, dowSamples = {};
for (const p of POLLS) {
  /* A RECORDED publication date beats one parsed out of a URL slug, and until
     now only the slug was read - so the lag was measured for exactly the two
     houses whose URLs happen to carry a date, and every other house fell back
     to the global default having contributed nothing to it. `published` is in
     the schema, was being entered, and was reaching nothing. */
  const pubRaw = p.published || pubDateFromUrl(p.url);
  if (!pubRaw) continue;
  /* `published` may carry a clock time - "2026-07-15T05:00". Take the DATE
     half for the lag and never hand the whole string to Date.parse beside a
     bare date: "2026-07-15T05:00" parses as local midnight-plus-five and
     "2026-07-14" as UTC midnight, so subtracting one from the other measures
     the timezone as well as the gap. Slicing keeps both operands in the same
     frame, which is the only reason the lag stays a whole number of days. */
  const pub = pubRaw.slice(0, 10);
  const clock = /T(\d{2}):(\d{2})/.exec(pubRaw);
  if (clock) (timeSamples[p.pollster] ||= []).push(+clock[1] * 60 + +clock[2]);
  (dowSamples[p.pollster] ||= []).push(new Date(pub + "T00:00:00Z").getUTCDay());
  const d = Math.round((Date.parse(pub) - Date.parse(p.date)) / 86400000);
  // a shared or rolling release URL (Roy Morgan covers 3 waves in one post,
  // Essential cites a report index) produces a nonsense gap – drop those
  if (d < 0 || d > 30) continue;
  (lagSamples[p.pollster] ||= []).push(d);
}

/* One RELEASE per entry, not one row. Two Resolve rows carry the same
   fieldwork start, the same sample, the same 2PP, the same story URL and the
   same publication minute, differing only in a fieldwork end two days apart -
   one release recorded twice. Left in, it put a 2-day gap in a house that
   polls every four weeks and dragged the spread with it. So rows that share a
   publication date are collapsed to the last of them: a house's interval is
   the gap between the things it PUBLISHED. */
const byHouse = {};
/* A PROVISIONAL row (Poll Bludger fallback: second-hand, no `published`)
   stays out of the rhythm's measurement - left in, its missing date broke
   the unbroken published tail and flipped the house onto fieldwork gaps
   for as long as it was live, re-measuring the window (RedBridge ±1 week
   → an exact day, Spectre ±18 → ±2). It still MOVES THE ANCHOR, though:
   the page shows the wave, so the projection must not call its slot
   overdue. The newest one per house is kept aside for that. */
const provLast = {};
for (const p of POLLS) {
  if (p.provisional) {
    if (!provLast[p.pollster] || p.date > provLast[p.pollster].date) provLast[p.pollster] = p;
    continue;
  }
  const r = (byHouse[p.pollster] ||= []);
  const pub = (p.published || "").slice(0, 10) || null;
  /* the clock rides along with the date, because the panel now SHOWS the
     releases it projects from and an hour is half of what a release time is.
     Recorded values only - never one parsed out of a URL slug, which is a
     date at best and, for the house that publishes three waves in one post,
     not even that */
  const cl = /T(\d{2}):(\d{2})/.exec(p.published || "");
  const mins = cl ? +cl[1] * 60 + +cl[2] : null;
  if (pub && r.length && r[r.length - 1].pub === pub) r[r.length - 1].date = p.date;
  // the release itself, so the date in the list can be the way to it. Rows
  // that collapse into one release share its URL, which is what identified
  // them as one release in the first place.
  else r.push({ date: p.date, pub, mins, url: p.url || null });
}
/* A TRACKED house files no poll row at all, yet the site tracks its releases
   for another panel - SEC Newgate's Mood of the Nation feeds national
   direction, Ipsos's Issues Monitor feeds the issues panel. pollsterRules
   marks them ("tracked": true) so the release calendar can lay their slots
   out beside the polls, labelled for what they are. The rows are minted in
   exactly the shape the poll walk above produces (and ride the same
   measurement code), tagged `tracked` so every poll-cadence consumer can
   keep them out and only the calendar lets them in - the main projections
   say what the poll schedule is, and a direction survey is not one. */
{
  const dirFirms = {};
  for (const w of D.direction || []) if (w.published) (dirFirms[w.pollster] ||= []).push(w);
  for (const firm of Object.keys(dirFirms)) {
    // a poll house's own walk already covers it; and unmarked houses stay out
    if (byHouse[firm] || (D.pollsterRules?.[firm] || {}).tracked !== true) continue;
    const ws = dirFirms[firm].slice().sort((a, b) => String(a.published).localeCompare(String(b.published)));
    const rows = ws.map((w) => {
      const pub = w.published.slice(0, 10);
      const cl = /T(\d{2}):(\d{2})/.exec(w.published);
      return { date: w.date, pub, mins: cl ? +cl[1] * 60 + +cl[2] : null, url: w.url || null };
    });
    rows.tracked = "direction";
    byHouse[firm] = rows;
  }
}
/* Ipsos's releases are PDFs, dated only by what the .build/ipsos-src sidecars
   record about when they appeared - the CDN's last-modified at first fetch
   (uploadedAt), else the PDF's own creation, else when this site's job first
   saw it. One row per release date (a re-uploaded version fetched twice under
   a renamed link shares its date and collapses); the IM_Nat_ name gate keeps
   the bound previous-year volume out, which is not a release in this rhythm. */
{
  const dir = path.join(ROOT, ".build", "ipsos-src");
  if ((D.pollsterRules?.["Ipsos"] || {}).tracked === true && !byHouse["Ipsos"] && fs.existsSync(dir)) {
    const posts = {};
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith(".json")) continue;
      try {
        const j = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
        if (j.kind !== "report" || !/^IM_Nat_/.test(path.basename(decodeURIComponent(j.pdf || "")))) continue;
        const at = (j.uploadedAt || j.pdfCreated || j.firstSeenAt || "").slice(0, 10);
        if (at) posts[at] = j.pdf;
      } catch (e) { /* a half-written sidecar is a skip, never a build failure */ }
    }
    const days = Object.keys(posts).sort();
    if (days.length >= CAD_MIN_POLLS) {
      const rows = days.map((d) => ({ date: d, pub: d, mins: null, url: posts[d] || null }));
      rows.tracked = "issues";
      byHouse["Ipsos"] = rows;
    }
  }
}
/* The ECONOMIC-SENTIMENT gauges publish on their own rhythms too - ANZ-Roy
   Morgan consumer confidence weekly, Westpac-MI sentiment, Roy Morgan
   business confidence and NAB's business survey monthly - and the Economic
   sentiment panel's own Release calendar fold is where a reader plans
   around them (RdConfCal; the Latest-polls fold filters them back out).
   Minted like the monitors
   above from the release dates data/confidence.json records, in the same
   row shape, so the one measurement block below decides date vs window for
   them as it does for every house. The series NAME is the row's firm:
   "Roy Morgan Business Confidence" is not the Roy Morgan poll's walk, and
   pollsterRules knows no such firm, so each row also carries its
   where-it-lands-first page itself (siteUrl - the pollCadence push reads
   it in place of a pollsterRules site). No clocks are recorded, so these
   stay untimed; the weekly/monthly weekday habit is sampled like a poll
   house's all the same. */
{
  const CONF_TRACKS = {
    consumer: "ANZ–Roy Morgan Consumer Confidence",
    westpacConsumer: "Westpac–MI Consumer Sentiment",
    business: "Roy Morgan Business Confidence",
    nabBusiness: "NAB Monthly Business Survey",
  };
  const CONF_SITES = {
    consumer: "https://www.roymorgan.com/findings",
    westpacConsumer: "https://www.westpaciq.com.au/economics/",
    business: "https://www.roymorgan.com/findings",
    nabBusiness: "https://www.nab.com.au/news/economy-markets",
  };
  for (const [lane, name] of Object.entries(CONF_TRACKS)) {
    const s = CONF_FILE && CONF_FILE[lane];
    if (!s || !(s.rows || []).length) continue;
    // one release per day: a same-day re-reading keeps the last URL
    const rel = {};
    for (const w of s.rows) if (w && w.date) rel[w.date] = w.url || null;
    const days = Object.keys(rel).sort();
    if (days.length < CAD_MIN_POLLS) continue;
    const rows = days.map((d) => ({ date: d, pub: d, mins: null, url: rel[d] }));
    rows.tracked = "confidence";
    rows.siteUrl = CONF_SITES[lane] || null;
    (dowSamples[name] ||= []).push(...days.map((d) => new Date(d + "T00:00:00Z").getUTCDay()));
    byHouse[name] = rows;
  }
}
const pollCadence = [];
/* A house's SUB-SERIES - its MRP, or a pooled re-cut of its waves - is
   measured here too, but into a list of its own (subCadence) that only the
   Latest-and-next table reads, where the series sits as a compact row under
   its parent (user call 2026-11-02). Kept out of pollCadence for the reasons
   the skip below gives: the ticker, the release calendar, the scorer and
   the skip-confirm agents all walk pollCadence, and none of them should
   see a second Newspoll- or DemosAU-branded slot.

   The measurement is the plain interval one, with no house machinery: these
   series keep no weekday or hour, are released a handful of times a year,
   and are read off the published sequence whenever every release carries
   its date (at CAD_MIN_POLLS releases the house rule's CAD_PUB_MIN would put
   DemosAU's MRP on fieldwork gaps plus a one-day default lag, when its real
   lag is three weeks). Always a window, never a dated slot: a quarterly
   product's ± is weeks, and a missed window holds its seat rather than
   rolling a whole quarter on. And no summer break: the pooled Newspoll
   quarter came out on 26 Dec 2025, from waves already in hand. */
const SUB_RE = /^(.*\S)\s+\((MRP|pooled)\)$/;
const subCadence = [];
const subCadenceOf = (firm, rows) => {
  if (rows.length < CAD_MIN_POLLS) return null;
  const allPub = rows.every((r) => r.pub);
  const seq = allPub ? rows.map((r) => r.pub) : rows.map((r) => r.date);
  const gaps = seq.slice(1).map((d, i) => Math.round((Date.parse(d) - Date.parse(seq[i])) / 86400000));
  const g8 = gaps.slice(-8);
  const cadence = medianOf(g8);
  if (!cadence || cadence <= 0) return null;
  const trimmed = [...g8].sort((a, b) => a - b);
  if (trimmed.length >= CAD_SPREAD_TRIM) {
    if (trimmed[trimmed.length - 1] > cadence * (1 + CAD_TRIM_FREAK)) trimmed.pop();
    if (trimmed[0] < cadence * (1 - CAD_TRIM_FREAK)) trimmed.shift();
  }
  const spread = Math.max(1, Math.round((trimmed[trimmed.length - 1] - trimmed[0]) / 2));
  if (spread / cadence > CAD_LOOSE_MAX_REL_SPREAD) return null;
  const ls = lagSamples[firm] || [];
  const start = Math.max(0, rows.length - CAD_SHOW);
  const at = (r) => (r && (allPub ? r.pub : r.date)) || null;
  return {
    pollster: firm, sub: SUB_RE.exec(firm)[1],
    last: seq[seq.length - 1], cadence, loose: true, noSummer: true,
    spread, spreadEarly: Math.max(0, cadence - trimmed[0]), spreadLate: Math.max(0, trimmed[trimmed.length - 1] - cadence),
    basis: allPub ? "published" : "fieldwork",
    lag: allPub ? 0 : (ls.length >= 2 ? medianOf(ls) : CAD_DEFAULT_LAG),
    lagMeasured: allPub ? 0 : ls.length,
    releaseFrom: null, releaseTo: null, releaseMid: null, releaseTimed: 0, releaseVals: null,
    releaseMins: null, releaseDow: null, releaseDowN: 0, declared: [],
    waves: rows.length, site: (D.pollsterRules?.[firm] || {}).site || null,
    skipped: [], skippedMonths: [],
    recent: rows.slice(start).map((r, i) => {
      const from = at(rows[start + i - 1]), to = at(r);
      return { field: r.date, pub: r.pub, mins: r.mins, url: r.url, since: from,
               gap: from && to ? Math.round((Date.parse(to) - Date.parse(from)) / 86400000) : null };
    }),
    gapsUsed: g8.length,
  };
};
for (const [firm, rows] of Object.entries(byHouse)) {
  if (SUB_RE.test(firm)) {
    const c = subCadenceOf(firm, rows);
    if (c) subCadence.push(c);
  }
}
for (const [firm, rows] of Object.entries(byHouse)) {
  const dates = rows.map((r) => r.date).sort();
  /* a NO_AGG series has no "next poll" to project: the quarterly pooled
     Newspoll and its one-off siblings are demographics products, not a
     release rhythm a reader plans around, and the parent's own walk already
     answers when The Australian's polling next lands. Its slot otherwise
     rode every cadence consumer (the table's Next column, the ticker, the
     calendar fold) as a second Newspoll-branded entry. A house's MRP series
     is skipped on the same grounds: a model over months of the house's own
     polling, whose next poll the parent's walk already projects. DemosAU's
     quarterly model became measurable with its fourth release (12 Oct 2026)
     and joined the ticker as "DemosAU (MRP) 78 days (maybe)". */
  if (NO_AGG_HOUSES.has(firm) || /\(MRP\)$/.test(firm)) continue;
  if (dates.length < CAD_MIN_POLLS) continue;
  // the unbroken dated tail – see CAD_PUB_MIN
  let tail = 0;
  while (tail < rows.length && rows[rows.length - 1 - tail].pub) tail++;
  const pubDates = tail > CAD_PUB_MIN ? rows.slice(rows.length - tail).map((r) => r.pub) : null;
  const basis = pubDates ? "published" : "fieldwork";
  // the sequence the interval is measured along, and the date it is projected from
  const seq = pubDates || dates;
  const gaps = seq.slice(1).map((d, i) => Math.round((Date.parse(d) - Date.parse(seq[i])) / 86400000));
  const rawCadence = medianOf(gaps.slice(-8));
  if (!rawCadence || rawCadence <= 0) continue;
  /* Some houses keep a weekday, not just an interval. Newspoll and Resolve
     have published on a Sunday evening every one of the nine times each has
     been dated, Essential and YouGov on a Wednesday. So this is recorded where
     it is a habit rather than a tendency: a weekday that has taken at least
     four fifths of the house's recent dated releases, over at least five of
     them. A house that fails it is projected from its interval alone, which is
     right - DemosAU has published on a Monday, a Friday and a Tuesday, and no
     weekday it keeps is a thing that exists to be found. */
  const ds = (dowSamples[firm] || []).slice(-CAD_RECENT);
  const dowTally = {};
  ds.forEach((v) => (dowTally[v] = (dowTally[v] || 0) + 1));
  const dowTop = Object.entries(dowTally).sort((a, b) => b[1] - a[1])[0];
  const dowHabit = ds.length >= CAD_DOW_MIN && dowTop && dowTop[1] / ds.length >= CAD_DOW_SHARE
    ? Number(dowTop[0]) : null;
  const decl = (D.pollsterRules?.[firm] || {}).release || null;
  /* slots, for a house on a weekday interval - see CAD_SLOT_TOL. The
     month-end and calendar-month rhythms measure their own misses below. */
  const slotted = (decl && decl.dow != null ? decl.dow : dowHabit) != null && !decl?.monthEnd && !decl?.month;
  const rhythm = slotted ? slotRhythm(gaps, rawCadence) : { cadence: rawCadence, gaps };
  const cadence = rhythm.cadence;
  /* A release INSIDE a slot does not move the rhythm: a client-commissioned
     one-off beside the regular tracker (Redbridge's Australia Institute
     extra, 18 Feb 2026, published 17 and 11 days from the monthly waves
     either side) splits one slot's length across two intervals, and measured
     raw both halves read as misses. Two of them alone took RedBridge's
     spread past CAD_MAX_REL_SPREAD - demoting a named day to a window on
     evidence from a slot that never broke. So adjacent below-median gaps
     whose sum IS the median are fused back into the slot they split, and
     the recent-eight window for the spread is cut from the fused list. The
     guards are the test: only a pair BOTH below the median sums to one
     slot's length (two genuine slots sit AT it; a weekly house's pair sums
     to two slots), so a real interval is never collapsed. The interval
     itself keeps the raw-measured median - the fusion repairs the miss
     measurement, not the rhythm. */
  const fused = [];
  const rg = rhythm.gaps;
  for (let i = 0; i < rg.length; i++) {
    if (i + 1 < rg.length && rg[i] < cadence && rg[i + 1] < cadence &&
        Math.abs(rg[i] + rg[i + 1] - cadence) <= 2) {
      fused.push(rg[i] + rg[i + 1]);
      i++;
    } else fused.push(rg[i]);
  }
  // a skipped slot is the slots it spans, the last of them a normal one
  let slotsSkipped = 0;
  const slotGaps = fused.slice(-8).map((g) => {
    const k = slotted ? slotMultiple(g, cadence) : 0;
    slotsSkipped += k ? k - 1 : 0;
    return k ? g - (k - 1) * cadence : g;
  });
  let last = seq[seq.length - 1];
  /* a provisional wave newer than the record anchors the next slot: on the
     published basis at its fieldwork end plus the house's measured lag (its
     publication was never recorded), else at the fieldwork end itself */
  const prov = provLast[firm];
  const lastProvisional = !!prov && prov.date > rows[rows.length - 1].date;
  if (lastProvisional) {
    const pls = lagSamples[firm] || [];
    const plag = basis === "published" ? (pls.length ? Math.round(medianOf(pls)) : CAD_DEFAULT_LAG) : 0;
    last = new Date(Date.parse(prov.date) + plag * 86400000).toISOString().slice(0, 10);
  }
  /* The only way OFF the projection: declared stopped by hand. Silence on
     its own no longer removes a house – an unrecorded release keeps its
     house on the list (the dated slot itself rolls on after a short grace;
     a window holds its seat) until the wave is recorded (see
     CAD_MAX_REL_SPREAD above). */
  if ((D.pollsterRules?.[firm] || {}).stopped) continue;
  const ts = (timeSamples[firm] || []).slice(-CAD_RECENT);
  /* Half the range of the recent slot gaps, a freak least or greatest set
     aside - see CAD_SPREAD_TRIM. Floored at a day: even Roy Morgan's perfect
     7-day cadence still moves a day either side on publication. */
  const trimmed = [...slotGaps].sort((a, b) => a - b);
  if (trimmed.length >= CAD_SPREAD_TRIM) {
    if (trimmed[trimmed.length - 1] > cadence * (1 + CAD_TRIM_FREAK)) trimmed.pop();
    if (trimmed[0] < cadence * (1 - CAD_TRIM_FREAK)) trimmed.shift();
  }
  let spread = Math.max(1, Math.round((trimmed[trimmed.length - 1] - trimmed[0]) / 2));
  /* The misses don't fall equally either side of the interval. A house slips
     a wave LATE far more readily than it brings one forward, and in the
     current record literally so: every weekday house's off-median intervals
     are long ones, none short. Half the range cannot say that, so the two
     sides are booked separately too - the panel can then state "or the
     Sunday after" instead of pretending an early Sunday has any precedent.
     NOT floored like spread: a zero is exactly the signal being carried. */
  let spreadEarly = Math.max(0, cadence - trimmed[0]);
  let spreadLate = Math.max(0, trimmed[trimmed.length - 1] - cadence);
  /* Tight enough to name a DAY, or only a window?

     This used to be one test with one outcome: fail it and the house vanished
     from the panel entirely. DemosAU is why that was wrong. It had polled nine
     times, was active, and its own record projected the next fieldwork ending
     7 Aug ± 15 days - a window that contained the wave it actually filed on 20
     Aug. The panel knew, and threw the house away for being ±15 rather than
     ±3, so a reader saw a list that silently claimed to be the whole field.

     So the strict test now decides the FORM of the entry, not whether there is
     one. Inside it, a date. Outside it but still on a rhythm, the window the
     data actually supports - which is a real forecast, just a wider one. Past
     LOOSE_MAX there is no rhythm left to state and the house is dropped, which
     is where "we don't know" is the honest answer. */
  /* A CALENDAR-MONTH rhythm (DemosAU): one wave each month on no pattern of
     day, so the window is the month itself - measured as an interval, the
     median's ± always spills past the month's ends, which the rhythm rules
     out. Declared, not inferred: the points sit inside months well enough
     but nothing in the data marks the month as the unit. Implies loose. */
  const calMonth = !!decl?.month;
  /* ...and WHERE inside the month: the day-of-month range the house has
     actually filed on, measured over the same published sequence the
     intervals were. Nothing declares it - it re-measures itself every build
     as the record grows, so an early-January outlier widens it and a steady
     run keeps it narrow. A day-of-month window alone is not compatible with
     the recency of the last release: the next window's open also has to
     respect the shortest elapsed gap between releases in this same sequence. */
  const calDays = !calMonth ? null : (() => {
    const ds = seq.map((d) => Number(d.slice(8, 10)));
    return [Math.min(...ds), Math.max(...ds)];
  })();
  const minPubGap = calMonth ? Math.min(...gaps) : null;
  /* A MONTH-END rhythm (RedBridge/Accent): the house's weekday nearest each
     month's last day - see npMonthEndSlot in np-project.js, run here
     through NP_MONTH_END_SLOT so the rule measured is the rule projected.
     Declared (release.monthEnd), but its precision is MEASURED: the rule is
     replayed along the published sequence, each release against the slot
     the one before it named, and the ± comes from those misses. A miss of
     two weeks or more (CAD_ME_BREAK) is not imprecision in the rule but a
     wave belonging to another month-end altogether - a summer break, the
     house's pre-2026 schedule - so breaks are set aside from the ±, and more
     than CAD_ME_MAX_BREAKS of them in the last eight means the rule is not
     holding and the interval projection stands in. It also needs the
     published basis and a weekday to aim at. */
  const meDow = decl && decl.dow != null ? decl.dow : dowHabit;
  let monthEnd = !!decl?.monthEnd && !calMonth && basis === "published" && meDow != null;
  let monthEndKept = null, monthEndN = null;
  if (monthEnd) {
    /* Each release against the slot its anchor named - where the anchor is
       the last release that KEPT the rhythm. A release that falls short of
       the slot while the next one lands on it exactly is an extra inside the
       slot (the Australia Institute wave of 18 Feb 2026, filed between the
       1 Feb and 1 Mar monthlies): skipped, anchor kept - the same repair the
       interval gaps get from the fusion above. */
    const off = (d, anchor) =>
      Math.round((Date.parse(d) - NP_MONTH_END_SLOT(Date.parse(anchor), meDow)) / 86400000);
    const all = [];
    let anchor = seq[0];
    for (let i = 1; i < seq.length; i++) {
      const r = off(seq[i], anchor);
      if (r < 0 && i + 1 < seq.length && off(seq[i + 1], anchor) === 0) continue;
      all.push(r);
      anchor = seq[i];
    }
    const res = all.slice(-8);
    const kept = res.filter((r) => Math.abs(r) < CAD_ME_BREAK).sort((a, b) => a - b);
    if (res.length - kept.length > CAD_ME_MAX_BREAKS || kept.length < CAD_SPREAD_TRIM) monthEnd = false;
    else {
      monthEndKept = res.filter((r) => r === 0).length;
      monthEndN = res.length;
      spread = Math.max(1, Math.round((kept[kept.length - 1] - kept[0]) / 2));
      spreadEarly = Math.max(0, -kept[0]);
      spreadLate = Math.max(0, kept[kept.length - 1]);
    }
  }
  const rel = spread / cadence;
  const dated = rel <= CAD_MAX_REL_SPREAD && !calMonth;
  if (!dated && !calMonth && rel > CAD_LOOSE_MAX_REL_SPREAD) continue;
  const ls = lagSamples[firm] || [];
  /* A DECLARED schedule, where the data cannot measure one the house plainly
     keeps. It is not a nicer default - it is a claim entered by hand in
     pollsterRules, carried through labelled, and meant to be deleted once
     enough `published` values exist to measure the same thing. */
  const declMins = decl && /^\d{1,2}:\d{2}$/.test(decl.time || "")
    ? Number(decl.time.split(":")[0]) * 60 + Number(decl.time.split(":")[1]) : null;
  /* eveningBefore (pollsterRules.release.eveningBefore): the wave is
     readable the EVENING BEFORE its canon stamp - News24's wave drops ~9pm
     Tuesday while the byline the next morning says 5:00AM, having been
     rewritten overnight. Canon `published` stays the final byline (the
     restamp leg in extract-news24.mjs keeps that true even for a wave the
     drop-eve comb files), so everything measured here keeps saying
     Wednesday; this datum is how the projection (np-project) shows what a
     reader can actually act on - "Tuesday 9pm" - beside the canon record. */
  const eveMins = decl && /^\d{1,2}:\d{2}$/.test(decl.eveningBefore || "")
    ? Number(decl.eveningBefore.split(":")[0]) * 60 + Number(decl.eveningBefore.split(":")[1]) : null;
  const releaseDow = calMonth ? null : (decl && decl.dow != null ? decl.dow : dowHabit);
  const timed = ts.length >= 5;
  /* The SPAN is taken with one sample trimmed off each end once there are
     enough to spare. Newspoll files at 8pm ten times in twelve, 9pm twice, and
     once - a real release, 19 Jan 2026 - at 7:11am on a Monday. Taken raw the
     span is "7am-9pm", which is too wide to print, so the label fell back to
     the median and called an evening house "8 pm" as if that were the whole
     habit. Trimming one each side keeps a habit's genuine width (8-9pm) while
     a single stray, early or late, waits out its window instead of setting
     the span. The median (releaseMid/releaseMins) is left on the full set: it
     is robust already, and it is the value the panel decides on. */
  const tsSorted = ts.slice().sort((a, b) => a - b);
  const tsSpan = tsSorted.length >= CAD_TRIM_MIN ? tsSorted.slice(1, -1) : tsSorted;
  /* A scheduled house files AT a clock time, so its recorded times form a
     few tight clusters, not a spread: YouGov is 5am twelve times and 6am
     twice and never once between them, which the label must be able to say
     as "5 or 6 am" instead of a 5-6am span that claims filings that have
     never happened. An anchor has to be SEEN twice - a single observation
     at an exact time is a sample of a scattered habit (Roy Morgan's
     afternoons), not evidence of a scheduled one; Resolve's near-6pm blog
     stamps cluster the same way as jitter around one anchor, not as
     several, and are likewise excluded from the discrete form. A paragraph
     break at more than four minutes between neighbours splits a cluster;
     centres ship rounded to five minutes, the filing precision a scheduled
     release actually keeps. The label, not this row, decides whether the
     anchors displace the span. */
  const RELEASE_ANCHOR_GAP = 4;
  const clusters = [];
  for (const m of tsSpan) {
    const lastC = clusters[clusters.length - 1];
    if (lastC && m - lastC[lastC.length - 1] <= RELEASE_ANCHOR_GAP) lastC.push(m);
    else clusters.push([m]);
  }
  const releaseVals = clusters.length >= 2 && clusters.length <= 3 && clusters.every((c) => c.length >= 2)
    ? clusters.map((c) => Math.round(c.reduce((a, b) => a + b, 0) / c.length / 5) * 5)
    : null;
  pollCadence.push({
    pollster: firm,
    // a tracked-release house ("direction" | "issues"): the calendar lets it
    // in labelled, every poll projection keeps it out (np-project's gate)
    ...(rows.tracked ? { tracked: rows.tracked } : {}),
    last,
    // the anchor is a provisional wave's ESTIMATED publication, not a record
    ...(lastProvisional ? { lastProvisional: true } : {}),
    cadence,
    loose: !dated,
    spread,
    spreadEarly,
    spreadLate,
    basis,
    /* A publication-based projection is anchored on the last publication and
       steps a whole interval to the next one, so there is no lag left to add -
       it is already inside the number. Zeroed rather than special-cased in the
       view, which does the same arithmetic either way. */
    lag: basis === "published" ? 0 : (ls.length >= 5 ? medianOf(ls) : CAD_DEFAULT_LAG),
    lagMeasured: basis === "published" ? 0 : (ls.length >= 5 ? ls.length : 0),
    /* What time of day the house actually files, where enough releases have
       been timed to call it a habit - same five-sample gate the lag uses, for
       the same reason. Reported as the observed SPAN rather than an average:
       YouGov has filed at 5am and 6am and never between, and the span's
       bounds are the honest shape only where the times really do run across
       it (Roy Morgan); where they cluster on exact anchors, releaseVals
       carries those and the label says "5 or 6 am" instead. Minutes past
       midnight, house local time - which is eastern, and is not converted
       for the reader's own zone because the release schedule is a fact about
       the publisher, not about the reader. */
    releaseFrom: timed ? Math.min(...tsSpan) : declMins,
    releaseTo: timed ? Math.max(...tsSpan) : declMins,
    // the middle as well as the ends: one late release should not be allowed
    // to widen a house's stated hour into something it almost never does
    releaseMid: timed ? medianOf(ts) : declMins,
    releaseTimed: timed ? ts.length : 0,
    // 2-3 exact filing times, each observed at least twice, else null
    releaseVals: timed ? releaseVals : null,
    /* The one clock reading the panel decides ON, as opposed to the ones it
       prints: minutes past midnight, eastern, of the moment a wave is expected
       to be out. Null where the house has never been timed, and the panel then
       gives it the whole day rather than inventing an hour for it. */
    releaseMins: timed ? medianOf(ts) : declMins,
    releaseDow,
    releaseDowN: releaseDow == null ? 0 : (decl && decl.dow != null ? 0 : dowTop[1]),
    // which parts of this are stated rather than measured, so the panel can say so
    declared: decl ? [decl.dow != null && "day", declMins != null && !timed && "hour",
      calMonth && "calendar-month rhythm", monthEnd && "month-end rhythm",
      eveMins != null && "evening-before availability"].filter(Boolean) : [],
    // the wave readable the evening BEFORE its canon stamp (declared; see above)
    ...(eveMins != null ? { eveningBeforeMins: eveMins } : {}),
    /* the month-end rule and how many of the last monthEndN releases it
       named exactly - the panel's foot says so instead of quoting a median
       interval the projection no longer steps by */
    ...(monthEnd ? { monthEnd: true, monthEndKept, monthEndN } : {}),
    /* The month itself is the projection, not a median ± spread: npProject's
       window is the measured day-of-month range (calDays) of the month
       after the last wave, with the bare 1st-to-last month as its fallback.
       minPubGap keeps that day-of-month bracket compatible with the shortest
       elapsed interval between releases in the same sequence. */
    ...(calMonth ? { calMonth: true, calDays, minPubGap } : {}),
    waves: dates.length,
    // the house's own release index, so a reader can go and check - a
    // tracked confidence series carries its page on the rows themselves,
    // pollsterRules knowing no such firm
    site: rows.siteUrl || (D.pollsterRules?.[firm] || {}).site || null,
    /* Slots confirmed absent AT THE PUBLISHER by the house's skip-confirm
       agent (pollsterRules.skippedSlots), where one exists. The projection
       rolls straight past them instead of holding the slot open as
       "(or N days ago)" for a release the agent verified was never filed. */
    skipped: (D.pollsterRules?.[firm] || {}).skippedSlots || [],
    /* The month-grain counterpart for calendar-month houses
       (pollsterRules.skippedMonths, "YYYY-MM" of the SLOT month confirmed
       absent); only meaningful beside calMonth above. */
    skippedMonths: (D.pollsterRules?.[firm] || {}).skippedMonths || [],
    /* The releases behind the projection, most recent last, so the panel can
       show its working rather than asking to be believed. The interval is the
       gap between FIELDWORK ends - the same quantity the median is taken over
       - and the publication date and hour are carried beside it where the
       release recorded one. */
    recent: (() => {
      /* The interval is measured against the release BEFORE this one in the
         house's record, not the one below it in this list. Taken within the
         slice, the oldest line had no predecessor to measure from and showed
         nothing - so a list of five releases reported four intervals when a
         fifth was sitting right there, one row further back than the panel
         happens to print. `since` carries what each was measured from, which
         is the only way the bottom line's interval can be checked at all. */
      const start = Math.max(0, rows.length - CAD_SHOW);
      // measured along the same sequence the median was taken over, or the
      // column would quietly disagree with the line underneath it
      const at = (r) => (r && (basis === "published" ? r.pub : r.date)) || null;
      return rows.slice(start).map((r, i) => {
        const from = at(rows[start + i - 1]), to = at(r);
        return {
          field: r.date, pub: r.pub, mins: r.mins, url: r.url,
          since: from,
          gap: from && to ? Math.round((Date.parse(to) - Date.parse(from)) / 86400000) : null,
        };
      });
    })(),
    // how many intervals the median and the spread were actually taken over,
    // which is more than the panel shows and should not be implied otherwise
    gapsUsed: slotGaps.length,
    // releases the slot count set aside inside those gaps (CAD_SLOT_TOL)
    ...(slotsSkipped ? { slotsSkipped } : {}),
    /* a schedule change believed on a run of CAD_RHYTHM_RUN: the interval it
       left and the release the new one is measured from */
    ...(rhythm.rhythmFrom ? { rhythmFrom: rhythm.rhythmFrom, rhythmSince: seq[seq.length - 1 - rhythm.runLen] } : {}),
  });
}
pollCadence.sort((a, b) => a.cadence - b.cadence);

/* ---- per-cycle source rows, for the Past-cycles download ----------------
   The charts are monthly aggregates; these are the individual readings behind
   them, so the aggregation can actually be checked. Keyed by CYCLE year (the
   election that STARTED the term, i.e. what the legend calls it) – cyclePolls
   is stored under the election that ENDED the term and cycleApproval under the
   one that began it, and exporting those raw keys would silently misalign the
   two halves. The current cycle is omitted: its source rows are individualPolls,
   already in the payload, and the export reads them from there. */
const cycleSource = {};
/* ---- Trove newspaper coverage per term ----------------------------------
   The archives/trove harvest (refresh-trove-archive products) counted per
   term [election, next election). Goes on the sidecar so a solo term can
   say how thick its newspaper record is; missing files (no local harvest)
   leave no key and the panel shows nothing. */
const troveByTerm = (() => {
  if (JUR) return null;   // federal newspaper record – absent for another jurisdiction
  try {
    const monFile = path.join(ROOT, "data", "trove-mentions-monthly.csv");
    if (!fs.existsSync(monFile)) return null;
    const months = fs.readFileSync(monFile, "utf8").trim().split("\n").slice(1)
      .map((l) => { const [y, m, a] = l.split(",").map(Number); return { k: y * 12 + m, a }; });
    const pollFile = path.join(ROOT, "data", "trove-poll-articles.csv");
    const pollIsos = fs.existsSync(pollFile)
      ? fs.readFileSync(pollFile, "utf8").trim().split("\n").slice(1)
        .map((l) => l.split(",")[1]).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
      : [];
    const out = {};
    for (let i = 0; i + 1 < CYC_META.length; i++) {
      const a = CYC_META[i], b = CYC_META[i + 1]; // rows are year-sorted
      const k1 = +a.eDate.slice(0, 4) * 12 + +a.eDate.slice(5, 7);
      const k2 = +b.eDate.slice(0, 4) * 12 + +b.eDate.slice(5, 7);
      let articles = 0, pollArticles = 0;
      for (const mo of months) if (mo.k >= k1 && mo.k < k2) articles += mo.a;
      for (const iso of pollIsos) if (iso >= a.eDate && iso < b.eDate) pollArticles++;
      if (articles > 0) out[a.year] = { articles, pollArticles };
    }
    return out;
  } catch { return null; }
})();
/* Each row says what its shares are of (2026-11-20). The download used to
   carry five party columns, so a 1958–87 row whose DLP or Democrats rode
   their own lane read as short of 100 – as if undecideds were mixed in –
   when it was a decided-basis poll missing a column. Now each row carries:
     dlp, dem   the era's own minor-party lanes, where printed;
     und        the undecided share left unprinted in the base, on a row
                short of 100 beyond rounding (under 98, validate.mjs §8c's
                tolerance) in a firm×term cyclePollBases declares
                {undecided: true} – Essential and Ipsos 2019–25 and three
                single polls. A basis can cover a house's whole term but be
                declared for one poll (Resolve's 97), so a row that adds to
                98–102 is rounding, never 1–2% undecided. With und the row
                adds to 100;
     sum        the row's total, when it misses 100 by more than rounding
                with no undecided basis – the source's own shortfall or
                excess, never read as undecided.
   A term's `notes` give the declared reason per house for its flagged rows;
   the pre-1987 era notes are provenance for the implied 2PP, not reasons for
   a total, so an era row's `sum` goes out bare. A row with only the majors
   (no remainder to total) carries nothing, as validate.mjs §8c skips it. */
const CYC_BASES = D.cyclePollBases || {};
const CYC_LANES = ["alp", "lnp", "grn", "onp", "oth", "dem", "dlp"];
const cycRowBase = (p, c) => {
  if (p.firm === "Election" || p.alp == null || p.lnp == null) return {};
  if (p.tppEra == null && p.oth == null && (p.grn == null || p.onp == null)) return {};
  const sum = CYC_LANES.reduce((s, k) => s + (p[k] ?? 0), 0);
  const b = CYC_BASES[c.src + "|" + p.firm];
  if (Math.abs(sum - 100) <= 2) return {};            // rounding, as §8c reads it
  return b && b.undecided && sum < 100 ? { und: r1(100 - sum) } : { sum: r1(sum) };
};
for (const c of CYC_META) {
  if (c.current) continue;
  const mo = (d) => Math.round(monthsSince(d, c.eDate) * 10) / 10;
  const notes = {};
  const polls = (cyclePolls[c.src] || []).map((p) => {
    const base = cycRowBase(p, c);
    const b = CYC_BASES[c.src + "|" + p.firm];
    if (b && p.tppEra == null && (base.und != null || base.sum != null)) notes[p.firm] = typeof b === "string" ? b : b.note;
    return {
      date: p.date, ...(p.dateApprox ? { dateApprox: p.dateApprox } : {}), firm: p.firm, m: mo(p.date),
      alp: p.alp ?? null, lnp: p.lnp ?? null, grn: p.grn ?? null,
      onp: p.onp ?? null, oth: p.oth ?? null,
      ...(p.dlp != null ? { dlp: p.dlp } : {}), ...(p.dem != null ? { dem: p.dem } : {}), ...base,
      tpp_alp: p.tpp_alp ?? null, tpp_lnp: p.tpp_lnp ?? null,
      // the figure the term's line is built from (cycleTppImp): each wave's
      // primaries at the opening election's flows; the house's own published
      // pair rides beside it for the download
      ...(() => {
        if (p.firm === "Election") return {};
        const alp = cycleTppImp(p, { ...c, gov: "alp" });
        return alp == null ? {} : { imp_alp: r1(alp) };        // Coalition side is 100 − this
      })(),
    };
  });
  cycleSource[c.year] = {
    ...(troveByTerm && troveByTerm[c.year] ? { trove: troveByTerm[c.year] } : {}),
    polls,
    ...(Object.keys(notes).length ? { notes } : {}),
    approval: (cycleAppr[c.appr] || []).map((r) => ({
      date: r.date, firm: r.firm, m: mo(r.date),
      pmNet: r.pmNet ?? null, oppNet: r.oppNet ?? null,
      metric: r.metric || metricOf(r.firm, "alb"),
      // preferred PM travels with the wave that asked it. Nothing charts it
      // for a past cycle yet; it rides out to the download so that when the
      // history is thick enough to plot, the data is already here.
      pmPpm: r.pmPpm ?? null, oppPpm: r.oppPpm ?? null,
    })),
  };
}

/* ---- 8v. the vote charts' history: past terms drawn through the counts ----
   (user ask 2026-11-21: extend the primary vote chart back in time as the
   National direction and Economic sentiment charts are, without drawing
   the polls' known misses as if they were the vote.) The evidence behind
   every choice here is .build/analysis/poll-error-timing/README.md, run on
   the 21 elections since 1972 with this estimator:
     - a miss does not carry into the next term: the first polls after an
       election sit back on the count, plus the winner's honeymoon;
     - consecutive elections' misses are unrelated (r about 0);
     - a miss does not scale with how much a party really moved, so the
       correction is a drift over time, never a rescaling of the moves;
     - about 0.4 of a term's polling-day miss is already in its first
       polls (0.17–0.56 across windows and eras, wide intervals); when the
       rest arrived the record cannot say, so it is spread evenly - the
       expected correction at each date if it arrived at an unknown moment.
   So each completed term's monthly line - the site's own construction,
   readings less the term's house leans (houseEffectsFor, as debiasTerm),
   calendar months as the sitting term's are, sqrt(m) repeat deflation -
   is corrected by
       e × (VH_W0 + (1 − VH_W0) × f)
   where e is the production estimate on polling day (21-day window,
   recency weights, the term's leans) less the count, and f the share of
   the term elapsed. The line opens on one count and closes exactly on the
   next. Its band adds to the month's sampling interval the doubt about
   the bias left once the count is known: a bias b(t) that starts the term
   with variance VH_W0·V and drifts to V by polling day (V, the lane's mean
   squared miss over the record) has, given e, variance V·g(1 − g) with
   g = VH_W0 + (1 − VH_W0)·f - at mid-term (g = 0.7) about ±1.6 points for
   Labor and ±1.7 for the Coalition, shutting to nothing on the count. A term with no dated
   poll in its final three weeks (1954–63, the sparse Gallup years) has no
   polling-day estimate to measure: its line is the polls alone, its band
   the unmeasured bias's own, V·g.
   Lanes: Labor, the Coalition, and the Greens or One Nation in a term
   whose closing count lists the party and whose polls list it in at
   least two of every five (the Greens' 1993–96 polls: 104 of 209); everyone else is "others", in the polls and the counts
   alike, so a term's Others always means what its closing count means
   (One Nation sits inside it 2001–16, the Greens before 1993). A row
   whose base keeps undecided voters (cycRowBase's und) is put on a decided
   basis first, as poolPrim does the sitting term's. The 2PP is Labor's
   implied share at the opening election's flows (cycleTppImp, Past
   cycles' measure), scored on the counted 2PP. The sitting term is left
   exactly as it is: no count has measured it yet. */
const VH_W0 = 0.4;
const voteHistory = JUR ? null : (() => {
  const SEP = ["alp", "lnp", "grn", "onp"];
  const MS_DAY = 86400000;
  const isoX = (ms) => dx(new Date(ms).toISOString().slice(0, 10));
  const terms = [];
  for (const c of CYC_META) {
    if (c.current || !c.src) continue;
    const eO = ELECTIONS["e" + c.year], eC = ELECTIONS["e" + c.src];
    if (!eO || !eC) continue;
    const tO = Date.parse(eO.date), tC = Date.parse(eC.date);
    const xO = dx(eO.date), xC = dx(eC.date);
    const src = (cyclePolls[c.src] || [])
      .filter((p) => p.firm !== "Election" && !/exit/i.test(p.firm || "") && !ACC_EXCLUDED.has(p.firm))
      .filter((p) => { const t = Date.parse(p.date); return t > tO && t <= tC; });
    if (!src.length) continue;
    const lanes = SEP.filter((k) => k === "alp" || k === "lnp"
      || (eC[k] > 0 && src.filter((p) => p[k] != null).length >= 0.4 * src.length));
    const all = lanes.concat(["oth", "tpp"]);
    const countOf = (e, k) => {
      if (k === "tpp") return e.tpp_alp ?? null;
      if (k === "oth") return r2(100 - lanes.reduce((s, q) => s + (e[q] || 0), 0));
      return k === "alp" || k === "lnp" || e[k] > 0 ? e[k] : null;
    };
    // each poll's lane values, on a decided basis
    const read = src.map((p) => {
      const und = cycRowBase(p, c).und;
      const kk = und != null ? 100 / (100 - und) : 1;
      const v = {};
      for (const q of lanes) v[q] = p[q] != null ? p[q] * kk : null;
      v.oth = lanes.every((q) => v[q] != null) ? 100 - lanes.reduce((s, q) => s + v[q], 0) : null;
      v.tpp = cycleTppImp(p, { ...c, gov: "alp" });
      return { p, v, mid: Date.parse(p.date), ym: ymOf(p.date) };
    });
    const otherIncludes = (e) => SEP.filter((k) => e[k] > 0 && !lanes.includes(k));
    const otherIncludedVotes = (e) => Object.fromEntries(otherIncludes(e).map((k) => [k, e[k]]));
    /* a and b unrounded: the charts' term windows are the same dx of the same
       dates, and a ring a rounding outside its window is culled */
    const out = { year: c.year, src: c.src, gov: c.gov, pm: c.pm, a: xO, b: xC, lanes: all,
                  otherIncludes: { open: otherIncludes(eO), close: otherIncludes(eC) },
                  otherIncludedVotes: { open: otherIncludedVotes(eO), close: otherIncludedVotes(eC) },
                  miss: {}, open: {}, close: {}, n: src.length, series: {} };
    for (const k of all) {
      const rows = read.filter((r) => r.v[k] != null)
        .map((r) => ({ ym: r.ym, mid: r.mid, x: r.v[k], n: rowN(r.p), firm: r.p.firm, approx: !!r.p.dateApprox }));
      out.open[k] = countOf(eO, k);
      out.close[k] = countOf(eC, k);
      if (!rows.length) { out.miss[k] = null; out.series[k] = []; continue; }
      const he = houseEffectsFor(rows);
      /* polling day as the accuracy record reads it: a month-only mirror
         date can't be placed inside a three-week window */
      const day = weightedWithSe(nowcastPts(rows.filter((r) => !r.approx), he, tC, HEADLINE_K));
      out.miss[k] = day && out.close[k] != null ? r2(day.v - out.close[k]) : null;
      if (day) out.missK = Math.max(out.missK || 0, day.n);
      const yms = [...new Set(rows.map((r) => r.ym))].sort();
      out.series[k] = yms.map((ym) => {
        const m = monthWithSe(rows, he, ym);
        const inM = rows.filter((r) => r.ym === ym);
        let x = mx(ym);
        /* a month's point sits mid-month unless that puts it on the far
           side of the election the month's polls follow or precede; then
           it sits at their mean date */
        if (x > xC - 1 / 365 || x < xO + 1 / 365) {
          const mean = inM.reduce((s, r) => s + r.mid, 0) / inM.length;
          x = Math.min(xC - 0.5 / 365, Math.max(xO + 0.5 / 365, isoX(mean)));
        }
        return { ym, x: +x.toFixed(4), raw: m.v, se: m.se, k: inM.length };
      });
    }
    terms.push(out);
  }
  /* V, each lane's mean squared miss over the elections whose final three
     weeks held two dated polls or more (a measured miss, not one poll's
     luck); the band's whole scale */
  const V = {};
  for (const k of ["alp", "lnp", "grn", "onp", "oth", "tpp"]) {
    const es = terms.filter((t) => t.miss[k] != null && (t.missK || 0) >= 2).map((t) => t.miss[k]);
    V[k] = es.length ? es.reduce((s, e) => s + e * e, 0) / es.length : null;
  }
  for (const t of terms) {
    for (const k of t.lanes) {
      const e = t.miss[k], Vk = V[k] ?? V.oth;
      t.series[k] = t.series[k].map((m) => {
        const f = Math.min(1, Math.max(0, (m.x - t.a) / (t.b - t.a)));
        const g = VH_W0 + (1 - VH_W0) * f;
        const biasVar = e != null ? Vk * g * (1 - g) : Vk * g;
        const v = e != null ? m.raw - e * g : m.raw;
        return [m.x, r2(v), r2(m.raw), r2(1.96 * Math.sqrt(m.se * m.se + biasVar)), m.k, r2(1.96 * m.se)];
      });
    }
    delete t.missK;
  }
  /* federal: the primaries' past terms on the site's model
     (.build/build-vote-history.mjs → data/vote-history-model.json): each
     term fitted as the sitting term is, then moved toward its closing count
     by the rule above on the model's log-ratio scale, so no share is moved
     below zero; from 1987 the 2PP too (the model's draws read through the
     opening election's flows, moved on the logit scale). Earlier terms'
     2PP lane stays this construction. Used only while the
     file is current with its inputs (cyclePolls, the elections, the bases);
     a stale file leaves the monthly averages in place and says so (and
     test-vote-history-model.mjs fails until it is rebuilt). */
  const VHM = (() => {
    try { return JSON.parse(fs.readFileSync(path.join(ROOT, "data", "vote-history-model.json"), "utf8")); } catch { return null; }
  })();
  const vhmInput = (() => { try { return createHash("sha1").update(JSON.stringify({ e: D.elections, c: D.cyclePolls, b: D.cyclePollBases })).digest("hex").slice(0, 12); } catch { return null; } })();
  let vhmUsed = false;
  if (VHM && VHM.input === vhmInput) {
    for (const t of terms) {
      const m = VHM.terms.find((q) => q.year === t.year && q.src === t.src);
      if (!m) continue;
      for (const k of m.lanes) {
        if (!t.lanes.includes(k)) continue;
        t.series[k] = m.series[k]; t.miss[k] = m.miss[k]; t.open[k] = m.open[k]; t.close[k] = m.close[k];
      }
      t.model = true;
    }
    for (const k of ["alp", "lnp", "grn", "onp", "oth", "tpp"]) if (VHM.rms[k] != null) V[k] = VHM.rms[k] ** 2;
    vhmUsed = true;
  } else if (VHM) console.warn("voteHistory: data/vote-history-model.json is stale (run node .build/build-vote-history.mjs) – past terms drawn as monthly averages");
  console.log("voteHistory:", terms.length, "terms;", vhmUsed ? "primaries on the model;" : "",
    "rms miss " + Object.entries(V).map(([k, v]) => k + " " + (v == null ? "–" : Math.sqrt(v).toFixed(2))).join(", ") + ";",
    "unmeasured", terms.filter((t) => t.miss.alp == null).map((t) => t.year + "–" + String(t.src).slice(2)).join(" ") || "none");
  return { w0: VH_W0, rms: Object.fromEntries(Object.entries(V).map(([k, v]) => [k, v == null ? null : r2(Math.sqrt(v))])), terms, ...(vhmUsed ? { model: true } : {}) };
})();

/* Past cycles' vote lines are the vote history's (§8v): each past term's
   model line moved toward its closing count, the line the 2PP and primary
   charts draw for that term, so a term reads the same on both pages. Month
   m is the history read at that day, between its monthly points; month 0
   stays the opening count, and the lead-in from it to the first point is
   filled as before. The dots stay the polls themselves. A lane the history
   doesn't carry (One Nation where few polls named it) keeps the monthly
   average. */
if (voteHistory) for (const c of CYCLE_DEFS) {
  if (c.current) continue;
  const T = voteHistory.terms.find((t) => t.year === c.year);
  if (!T || !T.series.alp || !T.series.alp.length) continue;
  /* a history that starts well after the term's first poll would draw a
     straight lead-in over real polls: such a term keeps its monthly averages */
  const firstObs = c.obs.primary.indexOf(true);
  if (firstObs > 0 && T.series.alp[0][0] > dx(c.eDate) + (firstObs + 1.5) * MS_MONTH / 365.25) { console.warn("cycles: " + c.year + " vote history starts late – monthly averages kept"); continue; }
  const e0 = Date.parse(c.eDate);
  const xOf = (m) => dx(new Date(e0 + m * MS_MONTH * 86400000).toISOString().slice(0, 10));
  const read = (lane, flip) => {
    const S = T.series[lane];
    if (!S || !S.length) return null;
    const half = 0.5 / 12;
    const at = (x) => {
      if (x < S[0][0] - half || x > S[S.length - 1][0] + half) return null;
      if (x <= S[0][0]) return S[0][1];
      if (x >= S[S.length - 1][0]) return S[S.length - 1][1];
      let j = 0; while (S[j + 1][0] < x) j++;
      const a = S[j], b = S[j + 1];
      return a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]);
    };
    return c.months.map((m) => { const v = at(xOf(m)); return v == null ? null : flip ? 100 - v : v; });
  };
  const put = (key, vals) => {
    if (!vals || !c[key]) return;
    const known = {};
    if (c[key][0] != null) known[0] = c[key][0];          // the opening count
    vals.forEach((v, i) => { if (v != null && i > 0) known[i] = v; });
    const ks = Object.keys(known).map(Number);
    if (ks.length < 2) return;
    const last = Math.max(...ks), first = Math.min(...ks);
    const filled = fillSeries(known, c.months.map((_, i) => i));
    c[key] = c.months.map((_, i) => (i < first ? null : i > last ? c[key][i] : r1(filled[i])));
  };
  put("primary", read(c.gov));
  put("oppr", read(c.opp));
  put("tpp", read("tpp", c.gov !== "alp"));
  if (T.lanes.includes("onp")) put("onp", read("onp"));
  c.voteModel = true;
}

/* ---- 8d. the change log ---------------------------------------------------
   The Info tab's change log: what moved the two-party preferred estimate,
   and which statistical findings appeared or fell away. Since 2026-10-12
   (user: the log "doesn't log changes in net favorability, subpopulation
   primary vote, even primary vote, or pollster lean"; then "national
   direction", "issues") each poll entry also quotes the primaries, leader
   ratings and direction that moved and the polling houses' house effects,
   and the findings cover every measure carrying a month-on-month test plus
   the issues' best-party verdicts. Subgroup primaries stay out as figures –
   hundreds of small-sample cells – their significance breaks are already
   findings. State is computed
   every build, but appended to data/changelog.json ONLY on a real site
   refresh (AUSPOL_SITE_REFRESH=1 – refresh_site's federal builds), never on
   quiet refreshes: the state stays frozen at the last logged refresh, so an
   entry's "moved a → b" reads entry to entry, and a drift-only run leaves
   the tree untouched (a dirty tree is what makes the unattended jobs refuse
   their slot). Every other caller – npm test, probes, dev builds, /vic/ –
   just carries the committed entries through to the page. */
const changelog = JUR ? null : (() => {
  let committed = { state: null, entries: [] };
  try { committed = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "changelog.json"), "utf8")); } catch { /* first ship: init below */ }
  const moves = {}, movesMeta = {};
  for (const [party, o] of Object.entries(demoTrend || {})) {
    for (const m of (o && o.moves) || []) {
      const k = `${party}|${m.set}|${m.group}`;
      moves[k] = m.dir > 0 ? 1 : -1;
      movesMeta[k] = { party, group: m.group, setLabel: m.setLabel };
    }
  }
  const pollInfo = {};
  for (const p of POLLS) {
    pollInfo[`${p.date}|${p.pollster}`] = {
      name: p.pollster,
      fw: p.fieldworkPending || !p.dateStart ? "fieldwork dates TBC" : fwLabel(p.dateStart, p.date),
      sample: p.sample ?? null,
      url: p.releaseUrl || p.url || null,
    };
  }
  const onNow = onImp ? onImp.a : (altLatest.alp_on ? altLatest.alp_on.a : null);
  const leadPair = rivalLead === "alp_on" ? "alp_on" : "alp_lnp";
  const leadBasis = rivalLead === "alp_on" ? (onImp ? "imp" : "pub") : (synthNow ? "imp" : "pub");
  /* the House effect column's figure on the headline's pairing and basis
     (the all-history snapshot the All polls table prints) */
  const leanHe = { "alp_on|imp": synthOnEffectM, "alp_on|pub": altAON.he, "alp_lnp|imp": synthEffectM, "alp_lnp|pub": houseEffectM }[`${leadPair}|${leadBasis}`];
  const lean = leanHe && typeof leanHe.snapshot === "function"
    ? { key: `${leadPair}|${leadBasis}`, v: Object.fromEntries(Object.entries(leanHe.snapshot(Infinity)).map(([h, o]) => [h, o.v])) }
    : null;
  /* every measure whose month-on-month move is significant, on the test
     its own panel reads: family|measure → ±1, and the label an entry names */
  const sig = {}, sigMeta = {};
  const putSig = (key, label, r) => {
    if (r && r.changeSig && r.chg) { sig[key] = r.chg > 0 ? 1 : -1; sigMeta[key] = label; }
  };
  const PRIM_LAB = { alp: "Labor’s", lnp: "the Coalition’s", grn: "the Greens’", onp: "One Nation’s", oth: "others’" };
  for (const k of PRIMARY_KEYS) putSig(`prim|${k}`, `${PRIM_LAB[k]} primary vote`, primaryChg && primaryChg[k]);
  const LEADERS = { alb: "Albanese", taylor: "Taylor", hanson: "Hanson" };
  const leaders = {};
  for (const [id, who] of Object.entries(LEADERS)) {
    for (const [metric, what] of [["net", "net approval"], ["fav", "net favourability"]]) {
      const r = leaderNow[`${id}_${metric}`];
      if (!r) continue;
      leaders[`${id}_${metric}`] = r.v;
      putSig(`lead|${id}_${metric}`, `${who}’s ${what}`, r);
    }
  }
  /* federally the model's lead among those who chose (§4m), the test the panel reads */
  putSig("ppm|alb_taylor", "Albanese’s preferred-PM margin over Taylor", LDM ? LDM.pnow.taylor && LDM.pnow.taylor.lead : ppmMarginNow);
  putSig("ppm|alb_hanson", "Albanese’s preferred-PM margin over Hanson", LDM ? LDM.pnow.hanson && LDM.pnow.hanson.lead : ppmHMarginNow);
  putSig("dir|net", "the right-track-minus-wrong-track net", directionNow);
  for (const it of (issues && issues.list) || []) {
    const lab = String(it.label || it.id).toLowerCase();
    putSig(`iss|${it.id}|imp`, `the share naming ${lab} a top-three issue`, it.imp);
    if (it.own) {
      for (const q of OWN3) {
        putSig(`iss|${it.id}|${q}`, `${PRIM_LAB[q]} share as the best party on ${lab}`,
          { chg: it.own.chg[q], changeSig: it.own.chgSig[q] });
      }
    }
  }
  /* the Who's trusted verdict per issue: the party that leads significantly
     as the best party, or "" where none does */
  const issLead = {}, issLabel = {};
  for (const it of (issues && issues.list) || []) {
    if (!it.own) continue;
    issLead[it.id] = it.own.leadSig ? it.own.lead : "";
    issLabel[it.id] = it.label || it.id;
  }
  for (const g of (onSources && onSources.series) || []) {
    const grp = g.label.replace(/ voters$/, "").replace(/^Other$/, "other");
    putSig(`onsrc|${g.id}`, `the share of One Nation’s gains drawn from 2025 ${grp} voters`, g.now);
    putSig(`onrate|${g.id}`, `the share of 2025 ${grp} voters now backing One Nation`, g.rate && g.rate.now);
  }
  const nextState = stateOf({
    lead: rivalLead === "alp_on"
      ? { pair: "alp_on", basis: onImp ? "imp" : "pub", alp: onNow }
      : { pair: "alp_lnp", basis: synthNow ? "imp" : "pub", alp: synthNow ? synthNow.alp : (hlNow ? hlNow.alp : null) },
    imp: synthNow ? synthNow.alp : null,
    pub: hlNow && hlNow.alp != null ? hlNow.alp : null,
    on: onNow,
    momSig: !!(synthChg && synthChg.changeSig),
    flows: flowsOf(FLOW, FP_ON, FP_ON_BAND),
    polls: Object.keys(pollInfo),
    moves, movesMeta,
    prim: primaryNow ? Object.fromEntries(PRIMARY_KEYS.map((k) => [k, primaryNow[k]])) : null,
    leaders, lean, sig, sigMeta,
    dir: directionNow ? { right: directionNow.right, wrong: directionNow.wrong, net: directionNow.net } : null,
    issLead, issLabel,
    /* the four confidence gauges' latest printed readings (§5j): null when
       the file or a lane is absent – the log compares the field only when
       both sides carry it, so a state written before 2026-10-20 migrates
       with one widen entry */
    conf: confidence
      ? Object.fromEntries(CONF_LANES.map(([k]) => [k, confidence[k] && confidence[k].latest ? confidence[k].latest.v : null]))
      : null,
  });
  if (process.env.AUSPOL_SITE_REFRESH) {
    const iso = new Date().toLocaleDateString("sv-SE", { timeZone: "Australia/Sydney" });
    const file = path.join(ROOT, "data", "changelog.json");
    if (!committed.state) {
      const seeded = initChangelog(nextState, iso);
      writeAtomic(file, JSON.stringify(seeded, null, 2) + "\n");
      console.log(`changelog: seeded ${iso} (recording begins at ${seeded.state.lead ? seeded.state.lead.alp : "—"})`);
      return seeded.entries;
    }
    const d = diffChangelog(committed.state, committed.entries || [], nextState, iso, pollInfo, HOUSE_RENAMES);
    if (d.appended.length) {
      writeAtomic(file, JSON.stringify({ state: d.state, entries: d.entries }, null, 2) + "\n");
      console.log("changelog: +" + d.appended.map((e) => e.kind).join("+") + " →", d.appended.map((e) => e.text.length <= 72 ? e.text : e.text.slice(0, 69) + "…").join(" | "));
    } else {
      console.log("changelog: quiet refresh (state unchanged)");
    }
    return d.entries;
  }
  return committed.entries || [];
})();

/* ---- §8e Public opinion (/public-opinion/) ---------------------------------
   The /public-opinion/ page (the ☰ menu page that was the /ad-hocs/
   catalogue, and until 2026-10-21 /beyond-the-vote/): what the pollsters
   ask beyond voting intention, by topic.
   public-opinion.mjs reads the twelve hand-curated one-off stores
   (data/*-one-offs.json), files every question on adhoc-themes.mjs's topic
   map (an unmapped id throws, so a new wave fails the build rather than
   landing unsorted), and builds the page's trackers and cards with their
   figures and margin rules – the same design effect as the aggregate's, so a
   "level" on that page means what it means here. The static article in
   build.mjs reads this same payload. Federal only. */
/* The /public-opinion/ tracker dots open their wave's All-polls row when
   the wave sits behind one of the four emitted row sets. PUBOP_HOUSES maps
   each one-off store key to the pollster name its rows carry in the row
   sets ("RedBridge/Accent" for the redbridge store, "YouGov" and
   "SEC Newgate" for the news24 and secnewgate stores' short forms...), and
   a wave pairs with a row on (store key, fieldwork end) or, when the
   store's date is the release day beside the row's fieldwork end
   (Essential's direction catalogue runs a day behind the store), (store
   key, fieldwork start). Each key answers the row's exact client
   pollRowKey string and the archive facet its set opens on; the poll facet
   wins a wave two sets both hold */
const pubopRowKeys = new Map();
if (!JUR) {
  /* the emitted rows shed their source datum's dateStart, but Essential's
     store waves sit a day AFTER their poll/direction row (its direction
     catalogue runs a day behind the store), so the start-date key space
     needs the raw datum beside each row. Only the poll and direction row
     sets are readable this way – and only they can ever match a one-off
     store, so no other source is spanned */
  const pubopSrcStart = new Map();
  for (const src of [POLLS, DIR]) for (const p of src)
    if (p.dateStart) { const k = p.pollster + "|" + p.date; if (!pubopSrcStart.has(k)) pubopSrcStart.set(k, p.dateStart); }
  const rowSets = [[individualPolls, "twopp"], [directionOnlyPolls || [], "direction"], [issuesOnlyPolls || [], "issues"], [confidenceOnlyPolls || [], "confidence"]];
  for (const [storeKey, def] of Object.entries(PUBOP_HOUSES)) {
    for (const [rows, facet] of rowSets) {
      for (const r of rows) {
        if (r.pollster !== def.full && r.pollster !== def.short) continue;
        const pay = { rk: r.pollster + "|" + r.released, fk: facet };
        const ek = storeKey + "|e|" + r.released;
        if (!pubopRowKeys.has(ek)) pubopRowKeys.set(ek, pay);
        const ds0 = r.dateStart || pubopSrcStart.get(pay.rk);
        if (ds0) { const sk = storeKey + "|s|" + ds0; if (!pubopRowKeys.has(sk)) pubopRowKeys.set(sk, pay); }
      }
    }
  }
}
const oneOffsSource = JUR ? null : buildPublicOpinion(readOneOffStores(ROOT), { deff: HL_DEFF, rowKeys: pubopRowKeys });
/* the page's count of topics, counted as its own topic list counts them
   (a topic with neither cards nor a list is left off): the main bundle's
   copy of it, for the page's dek and the More menu's line, which render
   before the sidecar has loaded, or without it */
const publicOpinionTopics = oneOffsSource ? oneOffsSource.topics.filter((t) => t.blocks.length || t.more.length).length : null;
/* the catalogue's newest entry, on the same contract, for the More menu's
   "Latest entry" date beside its line: the max of every tracker's and
   listed question's publication date (`pub`), with the fieldwork dates
   (`last`/`wave`) beneath as the fallback for a store that files none - the
   figure names the day the reading reached the page, not the day fieldwork
   ended (ISO strings sort lexicographically) */
const publicOpinionLatest = oneOffsSource
  ? oneOffsSource.topics
      .filter((t) => t.blocks.length || t.more.length)
      .flatMap((t) => [...t.blocks.map((b) => [b.pub, b.last, b.wave]), ...t.more.map((m) => [m.pub, m.last, m.wave])].flat())
      .filter(Boolean)
      .sort()
      .at(-1) ?? null
  : null;

/* the House as it stands, for the More menu's Election map line (/map/): who
   holds each seat today - the 2025 count's winners, then every change since
   (the Farrer by-election, members who changed party), read off the map's own
   committed data (map/data, built by .build/map/). Seats by party family as
   the map colours them (Community Strong with the independents), and how many
   seats have changed hands or party since the election. The Senate sits
   beside it (senate-now.json, the APH seating plan's party per senator), so
   the menu's figure can give the leader's share of each chamber. Federal
   only; null when the map's House data is absent */
const house = (() => {
  if (JUR) return null;
  try {
    const res = JSON.parse(fs.readFileSync(path.join(ROOT, "map", "data", "res-2025.json"), "utf8"));
    const now = JSON.parse(fs.readFileSync(path.join(ROOT, "map", "data", "data-now.json"), "utf8"));
    const fam = (ab) => (ab === "ALP" ? "alp" : ["LP", "LNP", "NP", "CLP", "NAT", "LNQ"].includes(ab) ? "lnp" : ab === "GRN" ? "grn"
      : ab === "ON" || ab === "HAN" ? "onp" : ["IND", "", "NAFD", "CSA"].includes(ab) ? "ind" : "oth");
    const seats = { alp: 0, lnp: 0, grn: 0, onp: 0, ind: 0, oth: 0 };
    let changed = 0;
    for (const d of res.divs) {
      const won = d.c.find((c) => c[6]);
      const h = now.holders[d.n];
      const ab = h ? h.ab : won[1];
      if (h && (h.n !== won[0] || h.ab !== won[1])) changed++;
      seats[fam(ab)]++;
    }
    /* today's Senate, tallied on the same party families: its own try so a
       missing floor file costs only the Senate figure, never the House line */
    const senate = (() => {
      try {
        const sen = JSON.parse(fs.readFileSync(path.join(ROOT, "map", "data", "senate-now.json"), "utf8"));
        const s = { alp: 0, lnp: 0, grn: 0, onp: 0, ind: 0, oth: 0 };
        for (const m of sen.senators) s[fam(m.ab)]++;
        return { asOf: sen.asOf, total: sen.senators.length, seats: s };
      } catch (e) { console.warn("gen-data: the map's Senate data is unreadable (" + e.message + ")"); return null; }
    })();
    return { asOf: now.asOf, total: res.divs.length, seats, changed, ...(senate ? { senate } : {}) };
  } catch (e) { console.warn("gen-data: the map's House data is unreadable (" + e.message + ")"); return null; }
})();

/* the seat model's latest official run, for the More menu's Election model line (/model/, built by
   .build/analysis/seat-model and .build/model): its headline (written by the page's own rules,
   .build/model/views.mjs, and stored in the run), the leading parties' average seats and chances, and the
   date its polls run to. /vic/ quotes the Victorian run (the page's Victorian view); any other
   jurisdiction has none; null when the run is absent */
const seatModel = (() => {
  const file = JUR ? (JUR.id === "vic" ? "seat-model-vic-2026.json" : null) : "seat-model-2028-nowcast.json";
  if (!file) return null;
  try {
    const r = JSON.parse(fs.readFileSync(path.join(ROOT, "data", file), "utf8"));
    const n = r.national;
    return { headline: n.headline || null, pollsTo: r.meta.window ? r.meta.window.to : r.meta.pollsTo || null, draws: r.meta.draws,
      expectedSeats: n.expectedSeats, mostSeats: n.mostSeats, majority: n.majority };
  } catch (e) { console.warn("gen-data: the seat model's run is unreadable (" + e.message + ")"); return null; }
})();

/* ---- emit the dataset asset -------------------------------------------- */
const out = `/* auspol tracker – REAL Australian ${JUR ? JUR.adj + " state" : "federal"} polling data.
   Generated from ${JUR ? "data/vic-polls.json (via .build/vic/to-main-schema.mjs)" : "data/polls.json"} by .build/newtracker/gen-data.mjs – do
   not edit by hand.  Spine: ${JUR ? ELECTION.date.slice(0, 4) + " " + JUR.adj + " election (" + ELECTION.date + ")" : "2025 federal election (3 May 2025)"} → ${latest.updated}.
   2PP aggregate: sample- & recency-weighted, house-effect-adjusted mean;
   every monthly estimate deflates a house's repeat waves in the month to
   the square root of their number, the same rule the nowcast window applies.
   Opposition-leader figures splice Sussan Ley → Angus Taylor (13 Feb 2026);
   the opposition slot is an office, not a person.  The confidence panel
   pairs consumer- and business-confidence indices (each house's own
   series, 100 = neutral) – context, not a predictor. */

window.AUSPOL = (function () {
  const PARTIES = {
    alp: { id: "alp", name: "Labor", short: "ALP", color: "var(--alp)" },
    lnp: { id: "lnp", name: "Coalition", short: "L/NP", color: "var(--lnp)" },
    grn: { id: "grn", name: "Greens", short: "GRN", color: "var(--grn)" },
    onp: { id: "onp", name: "One Nation", short: "ON", color: "var(--onp)" },
    oth: { id: "oth", name: "Others / Ind.", short: "OTH", color: "var(--oth)" },
  };
  const MONTHS = ${JSON.stringify(MONTHS)};
  const MN = ${JSON.stringify(MN)};
  const MNF = ${JSON.stringify(MNF)};
  function mx(ym) { const [y, m] = ym.split("-").map(Number); return y + (m - 1 + 0.5) / 12; }
  const monthName = (m) => MN[m - 1];
  const monthNameFull = (m) => MNF[m - 1];

  const LEADERS = ${JUR ? JSON.stringify([
    ["alb", "alb", "ALP", "var(--alp)"], ["taylor", "opp", "L/NP", "var(--lnp)"], ["hanson", "han", "ON", "var(--onp)"],
  ].map(([id, slot, party, color]) => { const e = JUR.eras[slot][JUR.eras[slot].length - 1]; return { id, name: e.name, short: e.name, party, color }; })) : `[
    { id: "alb", name: "Albanese", short: "Albanese", party: "ALP", color: "var(--alp)" },
    { id: "taylor", name: "Taylor", short: "Taylor", party: "L/NP", color: "var(--lnp)" },
    { id: "hanson", name: "Hanson", short: "Hanson", party: "ON", color: "var(--onp)" },
  ]`};

  const agg2pp = ${JSON.stringify(agg2pp)};
  const aggPrimary = ${JSON.stringify(aggPrimary)};
  const alt2pp = ${JSON.stringify(alt2pp)};
  // nowcast per alternative matchup – null where the series is too thin
  const altLatest = ${JSON.stringify(altLatest)};
  /* Implied 2PP: the polls' primaries read through the single AEC-2025 flow
     table in flows.mjs, on the SAME estimator (house effects, window,
     half-life) as the published series above. This is the site's DEFAULT
     2PP basis – the hero, the share card and this comment's consumers quote
     synthLatest; latest.alp2pp stays the respondent-allocated
     (= the houses' own published) basis beside it, and the flow-drift
     tracker below watches the gap between the two. What a fixed table
     cannot do is FOLLOW real preference drift after 2025: that is §7c's
     content, and a stale-flow table reads as level error, not movement. Its
     election anchor is likewise a consistency check, not a forecast
     agreement (the TPP table was built FROM that count, so it reproduces
     55.2 by construction – §1b). */
  const synth2pp = ${JSON.stringify(agg2ppSynth)};
  const synthLatest = ${JSON.stringify(synthNow ? { ...synthNow, ...synthChg, lnp: r1(100 - synthNow.alp), prev: synth1mo ? synth1mo.alp : null } : null)};
  /* Implied ALP–ON monthly series (gen-data §1d): every poll's primaries
     read through the ALP-v-ON frozen flow set (FP_ON, first-principles –
     no election count of the pairing exists) on the same estimator. This
     pairing's implied basis IS its default quoted basis (latest.onImp);
     the toggle restates it against the pollsters' own head-to-heads
     (alt2pp.alp_on/altLatest). It has no election anchor. ci95 is the
     month's MARGIN: its 95% sampling interval (cs) and the flow table's own
     range (cf) added in quadrature - a margin, never a "95% interval". */
  const synthOn = ${JSON.stringify(agg2ppSynthOn)};
  /* What an opened poll is held against (gen-data §3c): the headline's
     estimator read along the term with its window open both ways, every 4
     days to the newest poll, per series (lnp, imp, onimp, onp) and for the
     national-direction net (dir). The poll's own comparison (its yd) leaves
     the poll out. */
  const yardLine = ${JSON.stringify({ ...yardLine, dir: dirYard.line })};
  // the leader-gap lines the same way (§4c), keyed rival|question
  const ldYardLine = ${JSON.stringify(ldYard.line)};
  // the first day under new office-holders on each of those lines: they break there
  const ldYardBreaks = ${JSON.stringify(ldYard.breaks)};
  /* Flow-sensitivity bracket for the implied series above (gen-data §1c):
     each month's {lo, hi} = implied ALP 2PP with the ONP→ALP share at its
     last two COUNTED election tables (2022 and 2025, TPP cut). A
     sensitivity bracket, NOT an interval – its width is what the One
     Nation conversion is worth at that month's ONP primary. Only
     meaningful beside the implied line; the hero draws it with the
     basis comparison. */
  const flowSens = ${JSON.stringify(synthBand)};
  /* The rival ruling month by month (§8's rivalWalk): Labor's main rival
     each month, margin-gated (2PP first, first preferences on a tie), with
     the test that decided it (why). Past cycles draws the
     sitting term's 2PP – line and dots – against this month's rival. */
  const rivalWalk = ${JSON.stringify(rivalWalk)};
  /* The flow tables Past cycles reads each term through (flows.mjs FLOW_LEF,
     plus the sitting term's FLOW), for Info's show-the-working table: ALP
     shares per bucket, the one lumped flow where no split was published, and
     each table's miss on the next election's primaries (bt, ALP points). */
  /* how far each era's final poll (the last within 60 days of the vote)
     missed the official 2PP, against how far its Labor primary missed: the
     conversion through a flow table is the small error inside the poll's
     own (Info's "How well it works") */
  const lefPollMiss = ${JSON.stringify((() => {
    const miss = (lo, hi) => {
      const v = Object.entries(cyclePolls).map(([cy, ps]) => {
        const e = ELECTIONS["e" + cy];
        if (!e || +cy < lo || +cy > hi) return null;
        const pre = ps.filter((p) => p.date < e.date && p.tpp_alp != null && (Date.parse(e.date) - Date.parse(p.date)) / 864e5 <= 60)
          .sort((a, b) => (a.date < b.date ? -1 : 1));
        const last = pre[pre.length - 1];
        return last ? { tpp: Math.abs(last.tpp_alp - e.tpp_alp), prim: Math.abs(last.alp - e.alp) } : null;
      }).filter(Boolean);
      const avg = (k) => Math.round((v.reduce((s, x) => s + x[k], 0) / v.length) * 10) / 10;
      return v.length ? { n: v.length, tpp: avg("tpp"), prim: avg("prim") } : null;
    };
    return { pre: miss(0, 1984), post: miss(1985, 9999) };
  })())};
  const lefTables = ${JSON.stringify([
    /* fit: the one flow each era election solved, the rest fixed (user
       review 2026-10-21) - "others" to 1954 (no headline minor yet), none
       in 1955 (the pooled DLP 27%: the solved 0.2% misread 1957-58), the
       DLP to 1975, the Democrats from 1977 (others 45% and, once its vote
       collapsed, the DLP 27% fixed); 1975's Democrat 50% is a debut guess */
    ...Object.entries(FLOW_ERAS).map(([y, t]) => ({ year: +y, era: true, dlp: t.dlp ?? null, dem: t.dem ?? null, oth: t.oth, bt: t.bt ?? null,
      fit: +y <= 1954 ? "oth" : +y === 1955 ? null : +y <= 1975 ? "dlp" : "dem", assumed: +y === 1975 ? "dem" : null })),
    ...Object.entries(FLOW_LEF).map(([y, t]) => ({ year: +y, grn: t.grn ?? null, onp: t.onp ?? null, oth: t.oth ?? null, minor: t.minor ?? null, bt: t.bt, anchor: t.anchor ?? 0 })),
    { year: 2025, grn: FLOW.grn, onp: FLOW.onp, oth: FLOW.oth, minor: null, bt: null },
  ])};
  /* The two frozen tables the implied figures are read through, as the
     share of each party's voters that reaches Labor: against the Coalition
     the counted one (flows.mjs FLOW, or the jurisdiction's), against One
     Nation the built one (flows.mjs FP_ON) with its ± range. One home, so
     All polls' implied sampling floors and Info's working read the numbers
     the estimator reads. */
  const flowTables = ${JSON.stringify({
    lnp: { alp: 1, lnp: 0, grn: FLOW.grn, onp: FLOW.onp, oth: FLOW.oth },
    onp: { alp: 1, lnp: FP_ON.lnp, grn: FP_ON.grn, onp: 0, oth: FP_ON.oth },
    onBand: FP_ON_BAND,
    /* for the More menu's flow editor (pv-agg.js flowAgg), which re-reads
       every poll through a reader's own table: the three-cornered term the
       classic formula adds, and the 2022 One Nation cell §1c's band is
       drawn against (null where there is no band) */
    cnr: JUR ? (JUR.flows.threeCorner || 0) : FLOW_3CNR,
    onp22: synthBand ? ONP_FLOW_2022 : null,
  })};
  /* The preference-flow history chart's per-jurisdiction series: the share
     of each bucket's ballots that ended with Labor at each election, per
     cent. fed is the FLOW_HISTORY display table typed in flows.mjs; each
     state is aggregated here from data/state-flows.csv (the state-election
     parsers' one CSV) so the explainer's chart picks up a jurisdiction the
     day its rows land, and the Info glossary chart reads the same home. srcAs
     folds Nationals into others (a jurisdiction that counts them apart sets
     it false and names the columns instead). */
  const flowHistory = ${JSON.stringify(flowHistory)};
  /* The primary-vote history behind the explainer chart's View: Primary
     votes flip – each party family's share of the formal first-preference
     vote at each federal election, national and per state, House and
     Senate; nulls are below the 4% fold, never zeros. */
  const primaryHistory = ${JSON.stringify(primaryHistory)};
  /* The two-party-preferred history behind the explainer chart's View: 2PP
     flip – Labor's and the Coalition's 2PP shares at each federal election,
     national since 1972, per state and per seat class 1996–2025; the pair
     sums to 100 by construction. fed.sen is the IMPLIED Senate two-party
     (no official one exists – the AEC counts no 2PP in the Senate): ATL
     tallies only, the four post-GVT events 2016–2025, national plus the
     eight states, no classes, implied: true. */
  const twoPPHistory = ${JSON.stringify(twoPPHistory)};
  /* The informal-vote history behind the explainer chart's View: Informal
     votes flip – informal ballots as a share of ballots cast (informal ÷
     formal+informal), per cent, per federal election. House national
     1901–2025 and per state; Senate 1903–2022 (no AEC machine-readable
     2025 Senate informal product yet); federal House by AEC seat class
     1996–2025 and by IRSAD and IEO quintile 2001–2025. */
  const informalHistory = ${JSON.stringify(informalHistory)};
  // which measures carry a house-effect adjustment (drives the method labels)
  const adjusted = ${JSON.stringify({ tpp: true, primary: true, alp_on: altAON.adjusted, lnp_on: altLON.adjusted, ppm: false, appr: true, synth: synthEffect.estimable })};
  /* Per-measure house effects, {firm: {v, n}} – snapshots read at t=Infinity,
     i.e. each firm's lean pooled over its whole history (the adjustment the
     estimator applies is read at each figure's own reference time instead;
     see houseEffectsFor). v = pp that firm runs above the cross-house
     consensus on THAT measure; n = readings behind the estimate.
     A firm absent from a map has too few readings to estimate – which the UI
     must show as "—", never as 0. */
  const houseEffects = ${JSON.stringify({
    tpp: houseEffectM.snapshot(Infinity),
    /* federal: each house's lean today from the model, n its polls this term */
    primary: PRIMM ? Object.fromEntries(PRIMARY_KEYS.map((k) => [k, Object.fromEntries(Object.entries(PRIMM.leanNow)
      .map(([h, l]) => [h, { v: r1(l[k].v), n: PRIMM.fit.cnt[h] }]))]))
      : Object.fromEntries(Object.entries(primaryHE).map(([k, h]) => [k, h.snapshot(Infinity)])),
    alp_on: altAON.he.snapshot(Infinity),
    appr: Object.fromEntries(Object.entries(apprHE).map(([lk, h]) => [lk, h.snapshot(Infinity)])),
    synth: synthEffectM.snapshot(Infinity),
    /* the ALP-v-ON twin of synth: a house's lean on the implied ALP–ON
       reading (the pairing's default basis), so the tables' Lean / House
       effect columns and the breakdown's rows can follow that matchup
       instead of reading the classic pair whatever the page is showing */
    synthOn: synthOnEffectM.snapshot(Infinity),
  })};
  const houseLean = ${JSON.stringify(houseLean)};
  /* Flow-drift residual tracker (gen-data §7c): each poll's published 2PP
     minus what its primaries imply under the flow table in flows.mjs, with
     every house's method offset removed against its own election-anchored
     baseline and the anomalies pooled monthly + nowcast. DIAGNOSTIC ONLY –
     see the Flow-drift panel's note; it adjusts no other figure. */
  const flowDrift = ${JSON.stringify(flowDrift)};
  /* the same diagnostic for the ALP-v-ON head-to-head (§7d) – null when the
     published per-cohort splits that anchor its implied table are absent */
  const flowDriftOn = ${JSON.stringify(flowDriftOn)};
  /* RedBridge/Accent's monthly "forced to choose" respondent splits, per
     contest, for the All-polls flow-drift section's two forced-choice line
     charts (gen-data §7db) – display data only */
  const flowForced = ${JSON.stringify(flowForced)};
  const leaderMonths = ${JSON.stringify(leaderMonths)};
  const direction = ${JSON.stringify(direction)};
  /* The direction panel's GROUP views (§5): SEC Newgate's per-State
     state-direction series, the subgroup views as headline-anchored
     pooled group gaps (each poll differenced against its own wave
     first, so house lean never enters the pool), and Roy Morgan's
     latest printed state extremes note. */
  const directionStates = ${JSON.stringify(directionStates)};
  const directionGroups = ${JSON.stringify(directionGroups)};
  const directionStateNote = ${JSON.stringify(directionStateNote)};
  /* §5t: trust in the federal government, hand-filed, never pooled */
  const trustGov = ${JSON.stringify(trustGov)};
  const directionHouseEffects = ${JSON.stringify(DIRM ? DIRM.houseEffects : { right: dirHe.right.snapshot(Infinity), wrong: dirHe.wrong.snapshot(Infinity), net: dirHeNet.snapshot(Infinity) })};
  /* Ipsos' Global Average moved onto the panel's terms by Ipsos's lean on
     each wave's day (§5m), the main chart's dashed reference; null on /vic/ */
  const directionWorldAdj = ${JSON.stringify(DIRM ? DIRM.worldAdj : null)};
  const directionHouses = ${JSON.stringify(directionHouses)};
  /* name-list for the direction card's caption: the active houses plus any
     STOPPED contributor, listed last, labelled "(inactive)". Keep counting
     active houses off directionHouses (the How-to-read line). */
  const directionHousesAll = ${JSON.stringify(directionHousesAll)};
  /* per stopped house, the month it went quiet on the direction question
     ("YYYY-MM", one past its last reading) – the caption's "became inactive
     in <Month YYYY>" date */
  const directionStoppedSince = ${JSON.stringify(directionStoppedSince)};
  /* the net-FAVOURABILITY houses in the approval series, active first, a
     stopped house last as "Name (inactive)" – the approval card's fav-mode
     subtitle names them, so it can't drop a house that started (Spectre) */
  const favHouses = ${JSON.stringify(favHouses)};
  /* the complement roster, net-APPROVAL houses of the same series, same
     window and "(inactive)" tail – the approval card's net-mode subtitle,
     the redesign leadership captions and its section meta name them, so
     none of those can fall behind a house that started or stopped */
  const apprHouses = ${JSON.stringify(apprHouses)};
  const directionPolls = ${JSON.stringify(directionPolls)};
  /* the direction question's back history (§5dh): per house, monthly means
     of its OWN printed waves — Roy Morgan from the GCR tables and archived
     releases, the live direction[] rows from where each house starts. The
     direction panel's history window and government strip read this; the
     pooled model above never covers these years. */
  const dirHistory = ${JSON.stringify(dirHistory)};
  const directionPre = ${JSON.stringify(directionPre)};
  const directionWorld = ${JSON.stringify(directionWorld)};
  const directionLowy = ${JSON.stringify(directionLowy)};
  /* direction readings with no voting-intention poll to join onto (SEC
     Newgate asks only this question), shaped as archive-table rows – the
     All-polls table's direction facet lists these beside the joined ones */
  const directionOnlyPolls = ${JSON.stringify(directionOnlyPolls)};
  /* Ipsos's issues waves (§5i): the one house on the page with no voting-
     intention or direction row for its issue questions to ride on, so they
     are rows of their own for the All-polls table's issues facet – every
     other house's issues data hangs off its poll/direction rows via iss */
  const issuesOnlyPolls = ${JSON.stringify(issuesOnlyPolls)};
  /* The confidence gauges' term releases (§5j) as rows of their own for the
     All-polls table's confidence facet – releases, not polls, so they
     never join the other facets' rows or the poll count */
  const confidenceOnlyPolls = ${JSON.stringify(confidenceOnlyPolls)};
  const directionAvailable = ${direction.length > 0};
  const undecided = ${JSON.stringify(undecided)};
  /* The confidence gauges (§5j): the consumer- and business-confidence
     series, 100 = neutral (NAB its own 0-neutral net balance), one
     publisher apiece – the published line, not an aggregate. */
  const confidence = ${JSON.stringify(confidence)};
  /* The gauges' past-term context (§5k): per view-primary lane, each term
     aligned to its election month and the pooled middle-half / middle-80%
     band – what the "past terms" ribbon and draw-a-term lines read. */
  const confHistory = ${JSON.stringify(confHistory)};
  /* the vote charts' history (§8v): each past term's lines drawn through its
     two counts, with the polls' own figures beside them - null off the
     federal page */
  const voteHistory = ${JSON.stringify(voteHistory)};
  /* The history file as a calendar series (§5l): one {ym, v} point per
     survey month per lane, what the confidence panel's complete-history
     window draws behind the live lines. */
  const confDeep = ${JSON.stringify(confDeep)};
  /* The ABS/OECD price and output series (§5m): the Economic sentiment
     panel's Inflation & growth view — published (or index-derived) annual
     changes, raw {date, v} rows. */
  const macro = ${JSON.stringify(macro)};
  /* How firm each party's vote is (§5c2): RedBridge's vote-softness table,
     the share of each party's voters certain of their vote. */
  const firmness = ${JSON.stringify(firmness)};
  /* The completed terms' decidedness readings: national soft share, Resolve
     age bands and RedBridge party cohorts, kept outside the current-term
     pools above. */
  const decidednessHistory = ${JSON.stringify(decidednessHistory)};
  /* Where One Nation's gains came from (§5b): per wave, each 2025-vote
     group's part of what One Nation drew from outside its own 2025 vote,
     from DemosAU's and YouGov's vote-switching tables. */
  const onSources = ${JSON.stringify(onSources)};
  /* The whole vote-switching table, pooled (§5b): points of the 2025 vote
     each party now holds from each 2025 group - the proportions the
     masthead dial's replay trades its bars' mass in. */
  const switchFlows = ${JSON.stringify(switchFlows)};
  /* Current readings (gen-data currentReading): the leaders' nets and
     preferred PM, and the national direction – nowcasts, as the headline. */
  const leaderNow = ${JSON.stringify(leaderNow)};
  const leaderLead = ${JSON.stringify(leaderLead)};
  /* the leadership model (§4m): every series' monthly line back to 1971 –
     ratings per leader per office, preferred PM per pairing (the PM's lead
     among those who chose) – with this term's preferred-PM readouts; null
     off the federal page */
  const leaderModel = ${JSON.stringify(leaderModel)};
  const directionNow = ${JSON.stringify(directionNow)};
  /* The vote by group (§7g): per tab, each common group's
     pooled figure per party, with its margin, beside the current primaries. */
  const demographics = ${JSON.stringify(demographics)};
  /* The income cut of the vote (§7g): its OWN payload, beside (never
     inside) demographics – the classic design's data-driven panel would
     draw any tab it found there. Each house's lowest and highest income
     bracket join as the pooled gaps from its own total. */
  const demoIncome = ${JSON.stringify(demoIncome)};
  /* Composition trend (§7gb): per party, the groups that have moved toward
     or away from it out of proportion to the all-voters line. */
  const demoTrend = ${JSON.stringify(demoTrend)};
  /* Gaps between groups (§7gb): per set, the pairs whose relative gap has
     moved since the election, Holm-adjusted across the set's pairs and
     parties, and how many were tested. */
  const demoGaps = ${JSON.stringify(demoGaps)};
  /* The By-state panels' 2025 election marks (§7g): each group's result per
     party, in order, with the election's mid-month x. */
  const demoStateElection = ${JSON.stringify(DEMO_STATE_ELECTION)};
  /* The By-location chart's 2025 election marks (§7g), same shape: one ring
     per classification line at May 2025. */
  const demoLocElection = ${JSON.stringify(DEMO_LOC_ELECTION)};
  /* The Australian Election Study 2025's vote by group (§7g DEMO_AES,
     from its respondent file): election-time marks, never pooled. */
  const demoAes = ${JSON.stringify(DEMO_AES)};
  /* The polls at the 2025 election (§7g DEMO_ELECTION): each group's figure
     over the six weeks before polling day, pooled as the current figures
     are - the baseline "since the election" reads from. */
  const demoElection = ${JSON.stringify(DEMO_ELECTION)};
  /* The vote by group at the 2025 election (§7g DEMO_VOTE): the polls then
     and the AES in one estimate, the mark the charts draw at the election */
  const demoVote = ${JSON.stringify(DEMO_VOTE)};
  /* The issues (§7h): per issue, who voters think is best (three-way,
     pooled) and how many put it in their top three, plus the top three by
     group. */
  const issues = ${JSON.stringify(issues)};
  // the common groups, in the order a poll row's grp.v follows (the export's columns)
  const demoGroups = ${JSON.stringify(DEMO_GROUPS)};
  const accuracy = ${JSON.stringify(accuracy)};
  // each pollster's final polls against the count, per party (§ electionLean)
  const electionLean = ${JSON.stringify(electionLean)};
  /* The external aggregates the hero can overlay (§6b): BludgerTrack's
     machine trend, and Kevin Bonham's line as a RECONSTRUCTION of his
     published method with his as-published sidebar stamps beside it –
     the One Nation shadow estimate rides AS PUBLISHED. */
  const extAgg = ${JSON.stringify(extAgg)};
  const individualPolls = ${JSON.stringify(individualPolls)};
  // what each house's primary shares are of: D / D+L / A (POLL_BASES)
  const pollBases = ${JSON.stringify(pollBases)};
  /* a sample as the tables print it: "1,500 D" - the count, then what the
     house's primary shares are of (pollBases); a house with no declared
     base prints the count alone. n overrides the count (an eff. sample). */
  const pollBaseOf = (house, facet, p) => {
    if (house === "DemosAU" && p?.undecided != null) return "D";
    const b = house && pollBases[house];
    if (!b) return null;
    return typeof b === "string" ? b : (b[facet] || b.primary);
  };
  // the plain-text form, for labels and titles
  const sampleTxt = (p, facet) => {
    const v = p && p.sample;
    if (v == null) return null;
    const b = pollBaseOf(p.pollster, facet, p);
    return (+v).toLocaleString() + (b ? "\u00a0" + b : "");
  };
  /* the rendered form: the letters set in small caps (.rd-smc, user call
     2026-11-20). facet "twopp" picks a house's two-party base where it has
     its own (Essential); anything else reads the primaries' base. */
  const sampleEl = (p, facet) => {
    const v = p && p.sample;
    if (v == null) return null;
    const b = pollBaseOf(p.pollster, facet, p), R = window.React;
    const n = (+v).toLocaleString();
    return b ? R.createElement(R.Fragment, null, n + "\u00a0", R.createElement("span", { className: "rd-smc" }, b)) : n;
  };
  const pollsterTable = ${JSON.stringify(pollsterTable)};
  // where each eff-filing house posts its APC statements (the "eff. TBC"
  // link's targets; derived from PENDING_AT's method landings, gen-data-side)
  const effTbcUrls = ${JSON.stringify(effTbcUrls)};
  const latest = ${JSON.stringify(latest)};
  /* the Primary tab's in-browser pollster-subset recompute (pv-agg.js):
     the estimator constants it runs on (the source lines carry the drift
     rule: change a constant there, it tracks here) and the canonical
     house roster the menu lists (aggregable houses, first-seen order) */
  const aggSpec = ${JSON.stringify(aggSpec)};
  const primModel = ${JSON.stringify(primModel)};
  const pvHouses = ${JSON.stringify(pvHouses)};
  const showWorking = ${JSON.stringify(showWorking)};
  /* the implied two-party figures' linear summary of the primary model (§2t),
     for the flow editor */
  const tppLin = ${JSON.stringify(tppLin)};
  const events = ${JSON.stringify(events)};
  /* The Info tab's change log (gen-data §8d): poll additions, preference-
     flow assumption changes and significance findings, appended on each
     site refresh; null on a jurisdiction page. */
  const changelog = ${JSON.stringify(changelog)};

  const CYCLE_DEFS = ${JSON.stringify(CYCLE_DEFS)};
  /* Individual readings behind each past cycle's lines – its dots, and the
     Past-cycles download that makes the charts checkable rather than just
     assertions.

     At ~240KB it is the largest thing the page could carry, and nothing
     outside that one tab reads it. It used to ride in the document as an inert
     <script type="application/json"> block: cheap to PARSE, since the HTML
     parser skips it, but every visitor still paid to DOWNLOAD it whether or
     not they ever opened Past cycles. So it is a file now, fetched when the
     tab opens, named by a hash of its own bytes so it caches immutably.

     Two doors, deliberately. loadCycleSource() is the async one the tab calls
     on mount; D.cycleSource stays a plain synchronous read so the render path
     is unchanged, answering {} until the file lands and the tab re-renders. A
     failed fetch is not fatal: the lines still draw from the aggregates, the
     CSV comes out short rather than the tab dying, and the tab reads the same
     emptiness to offer a retry. Two tries, one beat apart; on the second miss
     the promise is dropped (never settled to {}), so calling again really
     does refetch. */
  /* the past terms' primary vote by group (build.mjs's group-history sidecar),
     fetched the first time a group view opens a window behind this term;
     D.groupHistory answers null until it lands */
  let _groupHist = null, _groupHistPromise = null;
  const loadGroupHistory = () => {
    if (_groupHist) return Promise.resolve(_groupHist);
    if (!_groupHistPromise) {
      const url = window.AP_GROUP_HIST;
      _groupHistPromise = (url ? fetch(url).then((r) => (r.ok ? r.json() : Promise.reject(new Error("group history HTTP " + r.status)))) : Promise.resolve(null))
        .then((j) => { _groupHist = j; return j; })
        .catch((e) => { console.error("group history failed to load", e); _groupHistPromise = null; return null; });
    }
    return _groupHistPromise;
  };
  /* the issues' long view (build.mjs's issues-history sidecar), fetched the
     first time an Issues chart opens a window behind this term */
  let _issuesHist = null, _issuesHistPromise = null;
  const loadIssuesHistory = () => {
    if (_issuesHist) return Promise.resolve(_issuesHist);
    if (!_issuesHistPromise) {
      const url = window.AP_ISSUES_HIST;
      _issuesHistPromise = (url ? fetch(url).then((r) => (r.ok ? r.json() : Promise.reject(new Error("issue-history HTTP " + r.status)))) : Promise.resolve(null))
        .then((j) => { _issuesHist = j; return j; })
        .catch((e) => { console.error("issue-history sidecar failed to load", e); _issuesHistPromise = null; return null; });
    }
    return _issuesHistPromise;
  };
  let _cycleSource = null;
  let _cyclePromise = null;
  const loadCycleSource = () => {
    if (_cycleSource) return Promise.resolve(_cycleSource);
    if (!_cyclePromise) {
      const url = window.AP_CYCLE_SRC;
      const attempt = () => url
        ? fetch(url).then((r) => (r.ok ? r.json() : Promise.reject(new Error("cycle source HTTP " + r.status))))
        : Promise.resolve({});
      _cyclePromise = attempt()
        .catch(() => new Promise((res, rej) => setTimeout(() => attempt().then(res, rej), 1200)))
        .then((j) => { _cycleSource = j; return j; })
        .catch((e) => { console.error("cycle source failed to load", e); _cyclePromise = null; return {}; });
    }
    return _cyclePromise;
  };
  /* The questions behind the /public-opinion/ page – the same lazily
     fetched sidecar contract as cycle-source above, for the same reason: read
     by nothing outside that one tab's page. The app asset kicks this loader
     once the browser turns idle, so the page opens on a warm cache rather
     than its loading line; the promise is the one keeper either way. */
  let _oneOffs = null;
  let _oneOffsPromise = null;
  const loadOneOffs = () => {
    if (_oneOffs) return Promise.resolve(_oneOffs);
    if (!_oneOffsPromise) {
      const url = window.AP_ONEOFF_SRC;
      const attempt = () => url
        ? fetch(url).then((r) => (r.ok ? r.json() : Promise.reject(new Error("one-offs source HTTP " + r.status))))
        : Promise.resolve({});
      _oneOffsPromise = attempt()
        .catch(() => new Promise((res, rej) => setTimeout(() => attempt().then(res, rej), 1200)))
        .then((j) => { _oneOffs = j; return j; })
        .catch((e) => { console.error("one-offs source failed to load", e); _oneOffsPromise = null; return {}; });
    }
    return _oneOffsPromise;
  };
  /* Measured publication rhythm per house – drives "Next expected polls".
     The dates themselves are computed in the browser against the real current
     date, so the panel stays honest as the page ages. */
  const pollCadence = ${JSON.stringify(pollCadence)};
  /* the same measure for each house's MRP or pooled series (subCadence,
     §cadence) - read only by the Latest-and-next table's compact sub-rows */
  const subCadence = ${JSON.stringify(subCadence)};
  /* the /public-opinion/ page's count of topics (§8e) - null off the federal page */
  const publicOpinionTopics = ${JSON.stringify(publicOpinionTopics)};
  /* its catalogue's newest wave (same contract) - the menu's "Latest entry" */
  const publicOpinionLatest = ${JSON.stringify(publicOpinionLatest)};
  /* the House as it stands (/map/'s data) - the menu's Election map line; null off the federal page */
  const house = ${JSON.stringify(house)};
  /* the seat model's latest run (/model/) - the menu's Election model line; null off the federal page */
  const seatModel = ${JSON.stringify(seatModel)};
  /* which All-polls rows a public-opinion wave pairs to (§8e): rk → { h:
     the pollster's store key, n: questions, t: topic shorts }. The poll
     ledger's "Public opinion" line reads it - null off the federal page */
  const publicOpinionByRow = ${JSON.stringify(oneOffsSource ? oneOffsSource.byRow : null)};
  const cycles = CYCLE_DEFS.map((c) => ({
    year: c.year, gov: c.gov, opp: c.opp, pm: c.pm, lead: c.lead, oppLead: c.oppLead, current: c.current, ...(c.voteModel ? { voteModel: true } : {}),
    eDate: c.eDate,
    ...(c.endRes ? { endRes: c.endRes } : {}),
    color: PARTIES[c.gov].color, span: c.months[c.months.length - 1],
    base: { tpp: c.tpp[0], primary: c.primary[0], net: c.net[0], oppnet: c.oppnet[0], han: c.han[0],
            oppr: c.oppr[0], onp: c.onp[0], ppmm: c.ppmm[0], ppmh: c.ppmh[0], pmlead: c.pmlead[0] },
    // han is sparse, so "end" is its last READING, not its last slot;
    // onp, ppmm and ppmh follow it — all grid as all-null on some cycles
    end: { tpp: c.tpp[c.tpp.length - 1], primary: c.primary[c.primary.length - 1], net: c.net[c.net.length - 1], oppnet: c.oppnet[c.oppnet.length - 1], han: [...c.han].reverse().find((v) => v != null) ?? null,
           oppr: c.oppr[c.oppr.length - 1], onp: [...c.onp].reverse().find((v) => v != null) ?? null,
           ppmm: [...c.ppmm].reverse().find((v) => v != null) ?? null,
           ppmh: [...c.ppmh].reverse().find((v) => v != null) ?? null,
           // grid-aligned like net, not held: the reverse-find is the cycle's
           // last measured month, not a slot beyond it */
           pmlead: [...c.pmlead].reverse().find((v) => v != null) ?? null },
    points: {
      tpp: c.months.map((m, i) => ({ x: m, y: c.tpp[i] })),
      primary: c.months.map((m, i) => ({ x: m, y: c.primary[i] })),
      net: c.months.map((m, i) => ({ x: m, y: c.net[i] })),
      oppnet: c.months.map((m, i) => ({ x: m, y: c.oppnet[i] })),
      han: c.months.map((m, i) => ({ x: m, y: c.han[i] })),
      oppr: c.months.map((m, i) => ({ x: m, y: c.oppr[i] })),
      onp: c.months.map((m, i) => ({ x: m, y: c.onp[i] })),
      ppmm: c.months.map((m, i) => ({ x: m, y: c.ppmm[i] })),
      ppmh: c.months.map((m, i) => ({ x: m, y: c.ppmh[i] })),
      pmlead: c.months.map((m, i) => ({ x: m, y: c.pmlead[i] })),
    },
    raw: { tpp: c.tpp, primary: c.primary, net: c.net, oppnet: c.oppnet, han: c.han, months: c.months, obs: c.obs,
           oppr: c.oppr, onp: c.onp, ppmm: c.ppmm, ppmh: c.ppmh, pmlead: c.pmlead,
           ...(c.netEras ? { netEras: c.netEras } : {}), ...(c.oppEras ? { oppEras: c.oppEras } : {}),
           ...(c.ppmEras ? { ppmEras: c.ppmEras } : {}), ...(c.ppmPair ? { ppmPair: c.ppmPair } : {}),
           ...(c.pmleadEras ? { pmleadEras: c.pmleadEras } : {}), ...(c.pmleadPair ? { pmleadPair: c.pmleadPair } : {}),
           ...(c.tppEras ? { tppEras: c.tppEras } : {}) },
  }));

  return {
    PARTIES, MONTHS, mx, monthName, monthNameFull,
    agg2pp, aggPrimary, tppLin, LEADERS, leaderMonths, alt2pp, altLatest, synth2pp, synthLatest, synthOn, yardLine, ldYardLine, ldYardBreaks, flowSens, rivalWalk, lefTables, lefPollMiss, flowTables, flowHistory, primaryHistory, twoPPHistory, informalHistory, adjusted, houseEffects, houseLean, flowDrift, flowDriftOn, flowForced, direction, directionStates, directionGroups, directionStateNote, trustGov, directionAvailable, directionHouseEffects, directionHouses, directionHousesAll, directionStoppedSince, dirHistory, directionPre, directionWorld, directionWorldAdj, directionLowy, favHouses, apprHouses, directionPolls, directionOnlyPolls, issuesOnlyPolls, confidenceOnlyPolls, directionNow, leaderNow, leaderLead, leaderModel, undecided, confidence, confHistory, voteHistory, confDeep, macro, firmness, decidednessHistory, onSources, switchFlows, demographics, demoIncome, demoTrend, demoGaps, demoStateElection, demoLocElection, demoAes, demoElection, demoVote, demoGroups, issues, accuracy, electionLean,
    extAgg,
    individualPolls, pollBases, pollBaseOf, sampleTxt, sampleEl, pollsterTable, effTbcUrls, latest, cycles, events, showWorking, changelog, aggSpec, primModel, pvHouses,
    undecidedCellOf: (p) => {
      const base = pollBaseOf(p.pollster, "primary");
      if (base === "F") return { v: 0, included: null, label: "not allowed" };
      const v = typeof p.undIn === "number" ? p.undIn
        : p.undecidedLeaner != null ? p.undecidedLeaner
        : p.undecidedBasis === "soft" ? null : p.undecided;
      if (v == null) {
        if (p.pollster === "DemosAU (MRP)" && base === "D+L") return { v: null, included: false, label: "excluded" };
        return null;
      }
      const included = base === "A" || typeof p.undIn === "number";
      return ({ v: Math.round(v * 2) / 2, included, label: included ? "included" : "excluded" });
    },
    // a getter, so existing callers keep reading D.cycleSource unchanged –
    // empty until loadCycleSource() has resolved
    get cycleSource() { return _cycleSource || {}; },
    loadCycleSource,
    // null until loadGroupHistory() has resolved (federal; the sidecar build.mjs ships)
    get groupHistory() { return _groupHist; },
    loadGroupHistory,
    // null until loadIssuesHistory() has resolved (federal)
    get issuesHistory() { return _issuesHist; },
    loadIssuesHistory,
    // the /public-opinion/ page's questions, on the same contract
    get oneOffs() { return _oneOffs || {}; },
    loadOneOffs, publicOpinionTopics, publicOpinionLatest, publicOpinionByRow, house, seatModel,
    pollCadence, subCadence,
    domain: { x0: mx(MONTHS[0]) - 0.06, x1: mx(MONTHS[MONTHS.length - 1]) + 0.04 },${JUR ? `
    // the jurisdiction this page covers (absent on the federal page)
    jur: ${JSON.stringify(JUR)},` : ""}
  };
})();
`;
writeAtomic(DATA_ASSET, out);
/* Sidecar, inlined by build.mjs as an application/json block. Kept out of the
   JS module on purpose – see the note beside loadCycleSource above. */
writeAtomic(CYCLE_SOURCE_ASSET, JSON.stringify(cycleSource));
/* The /public-opinion/ page's sidecar (§8e); federal-only – the Vic build's
   client never mounts the page, and its AP_ONEOFF_SRC is null. */
if (!JUR) writeAtomic(ONEOFFS_ASSET, JSON.stringify(oneOffsSource));
/* the past terms by group (§7gm GROUP_HIST): build.mjs ships it as the
   lazily fetched group-history sidecar; "null" when the model couldn't run */
if (!JUR) writeAtomic(GROUP_HIST_ASSET, JSON.stringify(GROUP_HIST));
/* the issues' long view (§7hm ISSUES_HIST): the lazily fetched issues-history sidecar */
if (!JUR) writeAtomic(ISSUES_HIST_ASSET, JSON.stringify(ISSUES_HIST));

/* ---- sanity summary ---------------------------------------------------- */
console.log("cycle leader splits:", CYCLE_DEFS.map((c) => {
  const parts = [];
  if (c.netEras) parts.push("pm: " + c.netEras.map((e) => `${e.name} m${e.months[0]}–${e.months[e.months.length - 1]}`).join(" | "));
  if (c.oppEras) parts.push("opp: " + c.oppEras.map((e) => `${e.name} m${e.months[0]}–${e.months[e.months.length - 1]}`).join(" | "));
  return parts.length ? `${c.year}(${parts.join("; ")})` : null;
}).filter(Boolean).join(" "));
console.log("cycle 2PP contests:", CYCLE_DEFS.filter((c) => c.tppEras).map((c) => `${c.year}: ` +
  c.tppEras.map((e) => `${e.name} m${e.months.find((m, i) => e.vals[i] != null)}–${e.months[e.months.length - 1]}`).join(" | ")).join(" ") || "one rival throughout");
console.log("MONTHS:", MONTHS.length, MONTHS[0], "→", MONTHS[MONTHS.length - 1]);
console.log("agg2pp:", agg2pp.length, "pts | first:", agg2pp[0], "| last:", agg2pp[agg2pp.length - 1]);
console.log("synth2pp:", agg2ppSynth.length, "pts | anchor(implied):", agg2ppSynth[0].alp, "vs count 55.2 | last:", agg2ppSynth[agg2ppSynth.length - 1]);
console.log("synthOn:", agg2ppSynthOn.length, "pts | no anchor (no ALP–ON count exists) | last:", agg2ppSynthOn[agg2ppSynthOn.length - 1]);
if (KF) console.log("kalman trend (smoothness per series; a refit is a hand call):\n  " + kfLog.join("\n  "));
console.log("synthLatest:", synthNow ? `ALP ${synthNow.alp} (n=${synthNow.n}, se=${synthNow.se.toFixed(2)}) vs published ${hlNow.alp} → Δ${r1(synthNow.alp - hlNow.alp)}` : "none (window empty)");
console.log("flowSens:", synthBand
  ? `${synthBand.length} pts | bracket at election: ${synthBand[0].lo}–${synthBand[0].hi} | last month: ${synthBand[synthBand.length - 1].lo}–${synthBand[synthBand.length - 1].hi} (width ${r1(synthBand[synthBand.length - 1].hi - synthBand[synthBand.length - 1].lo)}pt)`
  : "null (federal-only sensitivity; jurisdiction build)");
console.log("aggPrimary last:", aggPrimary[aggPrimary.length - 1]);
console.log("primaryNow:", primaryNow ? PRIMARY_KEYS.map((k) => `${k} ${primaryNow[k]}`).join(" ") : "null (empty window)", primaryNow ? `| n=${primaryNow.n}${primaryNow.rescaled ? ", rescaled" : ""}` : "");
console.log("onImp: ALP v ON first-principles implied:", onImp ? `${onImp.a}–${onImp.b} ± ${onImp.ci95} (sampling ${onImp.cs ?? "–"}, flows ${onImp.band}; n=${onImp.n})` : "null (empty window)");
console.log("alt2pp alp_on:", alt2pp.alp_on.length, "pts (last", alt2pp.alp_on.at(-1)?.ym, ") | lnp_on:", alt2pp.lnp_on.length, "pts (last", alt2pp.lnp_on.at(-1)?.ym, ")");
console.log("leaderMonths:", leaderMonths.length, "rows:", leaderMonths.map((r) => r.ym).join(","));
console.log("  last:", JSON.stringify(leaderMonths[leaderMonths.length - 1]));
console.log("  pref ranges alb/ley/tay/han:", ["alb", "ley", "taylor", "hanson"].map((k) => { const v = leaderMonths.map((r) => r[k + "_pref"]).filter((x) => x != null); return v.length ? Math.min(...v) + ".." + Math.max(...v) : "none"; }).join(" | "));
console.log("  net ranges alb/ley/tay/han:", ["alb", "ley", "taylor", "hanson"].map((k) => { const v = leaderMonths.map((r) => r[k + "_net"]).filter((x) => x != null); return v.length ? Math.min(...v) + ".." + Math.max(...v) : "none"; }).join(" | "));
console.log("  fav ranges alb/ley/tay/han:", ["alb", "ley", "taylor", "hanson"].map((k) => { const v = leaderMonths.map((r) => r[k + "_fav"]).filter((x) => x != null); return v.length ? Math.min(...v) + ".." + Math.max(...v) : "none"; }).join(" | "));
console.log("  fav months:", leaderMonths.filter((r) => r.alb_fav != null || r.taylor_fav != null || r.hanson_fav != null).map((r) => r.ym).join(","));
console.log("  approval months:", leaderMonths.filter((r) => r.alb_net != null).map((r) => r.ym).join(","));
console.log("individualPolls:", individualPolls.length, "| no 2PP:", individualPolls.filter((p) => p.alp == null).length, "| with ppm:", individualPolls.filter((p) => p.ppm || p.ppmSets).length, "| with appr:", individualPolls.filter((p) => p.appr.albNet != null).length);
console.log("pollsterTable:", pollsterTable.length, "→", pollsterTable.map((r) => `${r.pollster} ${r.releasedLabel}${r.alp2pp == null ? " (no 2PP)" : ""}`).join(" | "));
console.log("houseEffects (2PP):", Object.entries(houseEffectM.snapshot(Infinity)).sort((a, b) => b[1].v - a[1].v).map(([f, h]) => `${f} ${h.v > 0 ? "+" : ""}${h.v}(n=${h.n})`).join(", "));
console.log("flowDrift:", flowDrift.meta.houses.length, "houses | now:", JSON.stringify(flowDrift.now), "| last month:", JSON.stringify(flowDrift.months[flowDrift.months.length - 1]));
console.log("  baseFrom:", Object.entries(flowDrift.meta.baseFrom).map(([f, d]) => `${f}→${d}`).join(", "));
if (flowDriftOn) {
  console.log("flowDriftOn:", flowDriftOn.meta.houses.length, "houses | now:", JSON.stringify(flowDriftOn.now), "| last month:", JSON.stringify(flowDriftOn.months[flowDriftOn.months.length - 1]));
  console.log("  baseFrom:", Object.entries(flowDriftOn.meta.baseFrom).map(([f, d]) => `${f}→${d}`).join(", "));
} else {
  console.log("flowDriftOn: skipped (no published ALP-v-ON head-to-heads to monitor)");
}
console.log("headline 2PP:", hlNow, "| 1mo ago:", hl1mo);
console.log("pollCadence:", pollCadence.length, "houses on a pattern →",
  pollCadence.map((c) => {
    const WDS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const hh = c.releaseMins == null ? "" : ` @${String(Math.floor(c.releaseMins / 60)).padStart(2, "0")}:${String(c.releaseMins % 60).padStart(2, "0")}`;
    return `${c.pollster} ${c.cadence}d±${c.spread} lag${c.lag}${c.lagMeasured ? "(n=" + c.lagMeasured + ")" : ""}`
      + (c.releaseDow == null ? "" : ` ${WDS[c.releaseDow]}${c.releaseDowN ? "(" + c.releaseDowN + "/" + Math.min(CAD_RECENT, (dowSamples[c.pollster] || []).length) + ")" : ""}`)
      + hh + ` <${c.basis}>` + (c.declared.length ? ` [declared ${c.declared.join("+")}]` : "") + (c.loose ? " LOOSE" : "");
  }).join(" | "));
console.log("subCadence:", subCadence.map((c) => `${c.pollster} ${c.cadence}d±${c.spread} <${c.basis}> last ${c.last}`).join(" | ") || "none");
console.log("events:", events.length, "(major:", events.filter((e) => e.major).length + ")");
console.log("cycles:", CYCLE_DEFS.map((c) => `${c.year} m0..${c.months.at(-1)} tpp ${c.tpp[0]}→${c.tpp.at(-1)} prim ${c.primary[0]}→${c.primary.at(-1)} net ${c.net[0]}→${c.net.at(-1)} opp ${c.oppnet[0]}→${c.oppnet.at(-1)}`).join("\n        "));
console.log("cycle ranges: tpp", ...(() => { const v = CYCLE_DEFS.flatMap((c) => c.tpp); return [Math.min(...v), Math.max(...v)]; })(), "| prim", ...(() => { const v = CYCLE_DEFS.flatMap((c) => c.primary); return [Math.min(...v), Math.max(...v)]; })(), "| net", ...(() => { const v = CYCLE_DEFS.flatMap((c) => c.net); return [Math.min(...v), Math.max(...v)]; })(), "| oppnet", ...(() => { const v = CYCLE_DEFS.flatMap((c) => c.oppnet); return [Math.min(...v), Math.max(...v)]; })());
