/* gen-data.mjs – extract REAL data from auspol-polling.html and emit the
   dataset asset for index.html (window.AUSPOL).
   Methodology matches the established aggregate (see transform.mjs):
   2PP headline = sample- & recency-weighted, house-effect-adjusted nowcast;
   every monthly estimate (2PP, primaries, synthetic, alt head-to-heads,
   direction) = sample-weighted, house-effect-adjusted monthly mean from ONE
   construction, with a house's repeat waves in a window or month deflated
   to the square root of their number; leadership = monthly means of
   published readings, with the opposition slot spliced Ley → Taylor
   (handover 13 Feb 2026).
   Run: node .build/newtracker/gen-data.mjs */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { impliedAlp2pp } from "./flows.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const D = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "polls.json"), "utf8"));

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

   Only the CURRENT cycle. Past-cycle firm strings are canonicalised
   separately, by ACC_CANON, where the rules are stricter — see the comment
   there on why Galaxy and YouGov are not merged.

   Products are not names: the (MRP) variants are a different piece of work on
   their own schedule and are not folded into the tracking poll. */
const HOUSE_RENAMES = { "Redbridge": "RedBridge / Accent" };
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
const DATA_ASSET = path.join(HERE, "assets", "9f09dca2-bd46-49a8-8ae1-51847608cf92.js");
const CYCLE_SOURCE_ASSET = path.join(HERE, "assets", "cycle-source.json");

/* ---- canonical dataset ------------------------------------------------
   data/polls.json is the single source of truth. It used to be scraped out of
   auspol-polling.html with a bracket-counting scanner and eval(); that file is
   now a frozen historical artefact and nothing reads it. */
const ELECTIONS = D.elections;
const EVENTS = D.events;
const POLLS = D.polls.filter((p) => !p.isElection);
const ppm = D.ppm;
const appr = D.approval.map((r) => ({ ...r, splits: r.detail ?? null }));
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
  return y + doy / 365;
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

const ELECTION = ELECTIONS.e2025;                       // 3 May 2025 baseline
const LATEST_ISO = POLLS.reduce((m, p) => (p.date > m ? p.date : m), "0000");
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
const HE_WINDOW = 28, SHRINK_K = 8, SAMPLE_CAP = 3000, LN2 = Math.log(2);
/* Design effect for a live national sample – the same 1.6 the discord engine
   uses for its sampling-error floor, so the two agree. */
const HL_DEFF = 1.6;
/* A poll's n on the derived scale. Where the house files a published
   effective sample size (polls.json `sampleEff` – Newspoll, YouGov,
   Essential, DemosAU via APC methodology statements), that figure is
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
const HL_WINDOW = 21, HL_HALF = 7;
const tppRows = POLLS.filter((p) => p.tpp_alp != null).map((p) => ({ ym: ymOf(p.date), mid: midMs(p), x: share2pp(p), n: rowN(p), firm: p.pollster, key: p.date + "|" + p.pollster }));
/* Synthetic 2PP rows: each poll's primaries read through the single measured
   flow table in flows.mjs (AEC 2025, Event 31496). This series answers a
   different, narrower question than the published 2PP above – "what would
   these primaries mean if 2025's preference flows still held?" – and it is a
   diagnostic ONLY: houses' own allocations (respondent-allocated, previous-
   election, proprietary) move with real preference behaviour, a fixed table
   cannot, so the synthetic series can never become the headline. Rows need a
   full primary set with no documented anomaly (sumNote) – a set that doesn't
   total ~100 can't be read through a 100-point flow table. */
const tppRowsSynth = POLLS
  .filter((p) => p.alp != null && p.lnp != null && p.grn != null && p.onp != null && !p.sumNote)
  .map((p) => ({ ym: ymOf(p.date), mid: midMs(p), x: impliedAlp2pp(p), n: rowN(p), firm: p.pollster, key: p.date + "|" + p.pollster }));

/* A house effect is that pollster's lean AWAY FROM the cross-house consensus
   on that measure – never borrowed between measures, because a firm that
   leans Labor on the classic 2PP has no reason to lean the same way on an
   ALP-v-ON head-to-head or on a primary share. Each poll's deviation is
   measured against the n-weighted consensus of other polls around it in time
   (±HE_WINDOW days, at least 3, same-stratum only). Those deviations are
   pooled with recency decay (HE_HALF-day half-life) and shrunk toward zero by
   SHRINK_K on the decayed count, and the lean is READ at the time it is
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
  for (const d of devs) {
    evidenceN[d.firm] = (evidenceN[d.firm] || 0) + 1;
    if (evidenceFrom[d.firm] == null || d.mid < evidenceFrom[d.firm]) evidenceFrom[d.firm] = d.mid;
  }
  const at = (firm, t) => {
    let sw = 0, swx = 0;
    for (const d of devs) {
      if (d.firm !== firm || d.mid > t) continue;
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
  return { at, evidenceN, evidenceFrom, snapshot, estimable: devs.length > 0 };
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
const eraOf = (iso) => (iso < OPP_SPLICE_ISO ? "ley" : "taylor");
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
function nowcastAdj(rows, he, ref) {
  const pts = [];
  const waves = new Map();                    // firm -> wave count inside the window
  for (const a of rows) {
    const d = ddays(ref, a.mid);
    if (d < 0 || d > HL_WINDOW) continue;
    waves.set(a.firm, (waves.get(a.firm) || 0) + 1);
    pts.push({ w: a.n * Math.exp(-LN2 * d / HL_HALF), x: a.x - heV(he, a.firm, ref), n: a.n, firm: a.firm });
  }
  /* A house with m waves in the window has not measured the electorate m
     independent times - same method, same house-effect residue - so its
     m readings count for sqrt(m), the midpoint between "independent" (m)
     and "one reading" (1). Weekly Morgan still outweighs monthly everyone
     else for genuinely measuring more often, ~1.7x rather than 3x - it
     just can't be half the sample by showing up three times. */
  for (const p of pts) p.w /= Math.sqrt(waves.get(p.firm));
  const r = weightedWithSe(pts);
  return r && { v: r1(r.v), n: r.n, se: r2(r.se), nEff: r1(r.nEff), ci95: r1(1.96 * r.se) };
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
                                         x: r.x - heV(he, r.firm, ymMidMs(ym)), n: r.n })));
}

const houseEffect = houseEffectsFor(tppRows);
/* The synthetic series gets its OWN house effects, measured against its own
   consensus – a house whose primaries run ALP-high is a different bias from
   the same house's published-2PP lean, and the comment on houseEffectsFor
   (never borrow between measures) applies doubly here. */
const synthEffect = houseEffectsFor(tppRowsSynth);

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
  primaryRows[k] = POLLS.filter((p) => primaryVal(p, k) != null)
    .map((p) => ({ ym: ymOf(p.date), mid: midMs(p), x: primaryVal(p, k), n: rowN(p), firm: p.pollster }));
  primaryHE[k] = houseEffectsFor(primaryRows[k]);
}
/* houseLean reads the SAME estimators as time series – each firm's decayed
   lean sampled at every month's midpoint from the month its first evidence
   poll lands, so the House-lean chart under Poll disagreement draws how a
   house's lean has walked, not just where it stands. Keyed by measure –
   the 2PP plus the ALP / L/NP / ON primaries (matching the Poll-
   disagreement trio; lives after primaryHE exists). A firm under 3 evidence
   polls on a measure is absent from that measure's map, never drawn flat. */
const houseLean = Object.fromEntries([["tpp", houseEffect], ["alp", primaryHE.alp], ["lnp", primaryHE.lnp], ["onp", primaryHE.onp]]
  .map(([k, he]) => [k, Object.fromEntries(Object.entries(he.evidenceN).filter(([, n]) => n >= 3).map(([firm]) => [
    firm,
    MONTHS.filter((ym) => ymMidMs(ym) >= he.evidenceFrom[firm])
      .map((ym) => ({ ym, v: r1(he.at(firm, ymMidMs(ym))) })),
  ]))]),
);
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
    if (!rs.length) { o[k] = 0; continue; }
    const est = monthWithSe(primaryRows[k], primaryHE[k], ym);
    o[k] = est.v;
    o.ci[k] = r1(1.96 * est.se);
    plainTotal += mean(rs.map((r) => r.x));
  }
  const adjTotal = PRIMARY_KEYS.reduce((s, k) => s + o[k], 0);
  if (adjTotal > 0 && Math.abs(adjTotal - plainTotal) > 0.5) {
    for (const k of PRIMARY_KEYS) o[k] *= plainTotal / adjTotal;
  }
  for (const k of PRIMARY_KEYS) o[k] = r1(o[k]);
  return o;
}).filter(Boolean);
aggPrimary.unshift({
  ym: ymOf(ELECTION.date), x: dx(ELECTION.date), election: true, ci: {},
  alp: ELECTION.alp, lnp: ELECTION.lnp, grn: ELECTION.grn,
  onp: ELECTION.onp ?? 0, oth: r1(ELECTION.oth ?? 0),
});

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
     m   – the ALP-v-ON line was measured against its MONTHLY mean (the
           series is too thin to nowcast), so w speaks about that month
   Series: `lnp` for a poll with a published classic pair; `imp` instead for
   a poll with no pair at all – its primaries still pull the implied 2PP; and
   `onp` additionally wherever the wave printed an ALP-v-ON head-to-head.
   Keys are absent (not null) wherever the poll has no row in that series. An
   empty 21-day window for the classic/implied nowcast emits nothing rather
   than mixing bases against the monthly-fallback the headline would show. */
const effByKey = (() => {
  const ref = new Date(LATEST_ISO).getTime();
  const cur2pp = nowcastAdj(tppRows, houseEffect, ref);
  const curSynth = nowcastAdj(tppRowsSynth, synthEffect, ref);
  const synthKeys = new Set(tppRowsSynth.map((r) => r.key));
  const inWin = (rows, key) => rows.some((r) => r.key === key
    && ddays(ref, r.mid) >= 0 && ddays(ref, r.mid) <= HL_WINDOW);
  const loo = (rows, he, key) => { const r = nowcastAdj(rows.filter((q) => q.key !== key), he, ref); return r ? r.v : null; };
  /* the ON matchup's CURRENT basis, mirroring altNowcast's gate: a nowcast
     where the series supports one, else the last monthly point it draws */
  const onpNow = altAON.adjusted ? nowcastAdj(altAON.rows, altAON.he, ref) : null;
  const onpMonth = alt2pp.alp_on.length ? alt2pp.alp_on[alt2pp.alp_on.length - 1] : null;
  const out = new Map();
  for (const p of POLLS) {
    const key = p.date + "|" + p.pollster;
    const eff = {};
    if (p.tpp_alp != null && cur2pp) {
      const lo = loo(tppRows, houseEffect, key);
      if (lo != null) eff.lnp = { lo: r1(lo), hi: r1(cur2pp.v), w: inWin(tppRows, key) ? 1 : 0 };
    } else if (p.tpp_alp == null && synthKeys.has(key) && curSynth) {
      const lo = loo(tppRowsSynth, synthEffect, key);
      if (lo != null) eff.imp = { lo: r1(lo), hi: r1(curSynth.v), w: inWin(tppRowsSynth, key) ? 1 : 0 };
    }
    const ao = ALT_BY.get(key) && ALT_BY.get(key).ao;
    if (ao != null) {
      if (onpNow) {
        const r = nowcastAdj(altAON.rows.filter((q) => q.key !== key), altAON.he, ref);
        if (r) eff.onp = { lo: r1(r.v), hi: r1(onpNow.v), w: inWin(altAON.rows, key) ? 1 : 0 };
      } else if (onpMonth) {
        const rest = altAON.rows.filter((q) => q.key !== key && q.ym === onpMonth.ym);
        const est = altAON.adjusted ? monthWithSe(rest, altAON.he, onpMonth.ym) : null;
        const lo = est ? est.v : (rest.length ? mean(rest.map((q) => q.x)) : null);
        if (lo != null) eff.onp = { lo: r1(lo), hi: r1(onpMonth.a), w: inWin(altAON.rows, key) ? 1 : 0, m: 1 };
      }
    }
    if (Object.keys(eff).length) out.set(key, eff);
  }
  return out;
})();
/* guard the estimator's own arithmetic: one wave may lean a weighted
   aggregate a point or so (the window carries ~ten), anything past that is a
   bug in this file, not data – measured moves run ±0.1–1pp */
for (const [k, eff] of effByKey) {
  for (const e of Object.values(eff)) {
    if (!Number.isFinite(e.lo) || !Number.isFinite(e.hi) || Math.abs(e.hi - e.lo) > 4)
      throw new Error(`poll footprint out of range (${k}): ${JSON.stringify(e)}`);
  }
}

/* ---- 4. leadership monthly – gap-aware (no interpolation) --------------
   Rows exist only for months with at least one published leadership reading;
   a leader not polled that month carries null. The panels filter nulls, so
   lines connect real readings instead of inventing a monthly path across
   the source data's gaps (e.g. Jan–Mar 2026). */
const rnd = (v) => (v == null ? null : Math.round(v));
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
  const rows = appr.filter((p) => p[prop] != null).map((p) => ({
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
  const rows = appr.filter((p) => ymOf(p.date) === ym);
  if (!pp.length && !rows.length && !ppH.length) return null;
  // approval and favourability are different questions – routed PER LEADER by
  // that leader's metric at the firm, never pooled into one mean
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
      return { v: rnd(r.v), ci: r1(1.96 * r.se) };
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
    alb_pref: rnd(meanOf(pp2, (p) => p.alb)),
    /* ley_* / taylor_*: the one opposition series keyed by who was asked. A
       pre-handover month carries ley_* only, a month since carries taylor_*,
       and Feb 2026 – where both were measured – carries both, so neither
       person's line borrows the other's readings. */
    ley_pref: rnd(meanOf(pp2L, (p) => p.opp)), taylor_pref: rnd(meanOf(pp2T, (p) => p.opp)),
    hanson_pref: null,
    alb_prefN: rnd(meanOf(pp2, (p) => prefShare(p, "alb"))),
    ley_prefN: rnd(meanOf(pp2L, (p) => prefShare(p, "opp"))),
    taylor_prefN: rnd(meanOf(pp2T, (p) => prefShare(p, "opp"))),
    hanson_prefN: null,
    alb_pref3: rnd(meanOf(pp3, (p) => p.alb)),
    ley_pref3: rnd(meanOf(pp3L, (p) => p.opp)), taylor_pref3: rnd(meanOf(pp3T, (p) => p.opp)),
    hanson_pref3: rnd(meanOf(pp3, (p) => p.han)),
    alb_prefN3: rnd(meanOf(pp3, (p) => prefShare(p, "alb"))),
    ley_prefN3: rnd(meanOf(pp3L, (p) => prefShare(p, "opp"))),
    taylor_prefN3: rnd(meanOf(pp3T, (p) => prefShare(p, "opp"))),
    hanson_prefN3: rnd(meanOf(pp3, (p) => prefShare(p, "han"))),
    /* Albanese v Hanson, head to head. Not a slice of either line above: it is
       asked as its own contest, Albanese runs ~7pp higher against Hanson than
       against the opposition leader, and only some houses ask it (11 polls,
       Apr 2026 on), so it is a third series rather than a filter on the first. */
    alb_prefH: rnd(meanOf(ppH, (r) => r.alb)), hanson_prefH: rnd(meanOf(ppH, (r) => r.han)), taylor_prefH: null, ley_prefH: null,
    alb_net: A.net, ley_net: OL.net, taylor_net: OT.net, hanson_net: H.net,
    alb_fav: A.fav, ley_fav: OL.fav, taylor_fav: OT.fav, hanson_fav: H.fav,
    alb_netCi: A.netCi, ley_netCi: OL.netCi, taylor_netCi: OT.netCi, hanson_netCi: H.netCi,
    alb_favCi: A.favCi, ley_favCi: OL.favCi, taylor_favCi: OT.favCi, hanson_favCi: H.favCi,
  };
}).filter(Boolean);

/* ---- 5. national direction – right track / wrong track ------------------
   Given the SAME treatment as the 2PP and the primaries: sample-weighted,
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
const dirSample = (d) => {
  const p = POLL_BY_KEY.get(d.date + "|" + d.pollster);
  return rowN(p);
};
const dirRows = (field) => DIR.filter((d) => d[field] != null).map((d) => ({
  ym: ymOf(d.date), mid: midMs(d), x: d[field], n: dirSample(d), firm: d.pollster,
}));
const dirHe = { right: houseEffectsFor(dirRows("right")), wrong: houseEffectsFor(dirRows("wrong")) };
// Who actually asks this question, most-active first – derived rather than
// written into the copy, so the panel can't claim a house that has stopped
// polling it (or miss one that has started). Scoped to the months the chart
// covers, for the same reason.
const MONTH_SET = new Set(MONTHS);
const dirHouseCount = {};
for (const d of DIR) {
  if (!MONTH_SET.has(ymOf(d.date))) continue;
  dirHouseCount[d.pollster] = (dirHouseCount[d.pollster] || 0) + 1;
}
const directionHouses = Object.keys(dirHouseCount)
  .sort((a, b) => dirHouseCount[b] - dirHouseCount[a] || a.localeCompare(b));
// Every published reading behind the monthly line, for the panel's scatter.
// Taken from the direction series rather than from the poll rows, because a
// few waves asked this question without publishing voting intention and so
// have no poll row to hang on – plotting only the joined ones would quietly
// drop them from a chart that DOES average them.
// Field names match what the chart tooltip reads off a scatter point
// (pollster / dateLabel / sample), so a direction dot identifies its poll the
// same way a 2PP or primary dot does. Sample is joined from the voting-intention
// poll where there is one – the few direction-only waves simply have none.
const directionPolls = DIR
  .filter((d) => MONTH_SET.has(ymOf(d.date)))
  .map((d) => {
    const p = POLL_BY_KEY.get(d.date + "|" + d.pollster);
    return {
      x: dx(d.date), ym: ymOf(d.date), pollster: d.pollster,
      dateLabel: fwLabel(d.dateStart, d.date), released: d.date,
      sample: (p && p.sample) || null,
      right: d.right, wrong: d.wrong, unsure: d.unsure,
    };
  })
  .sort((a, b) => a.x - b.x);
const dirRight = monthlyAdj(dirRows("right"), dirHe.right);
const dirWrong = monthlyAdj(dirRows("wrong"), dirHe.wrong);
const dirWrongBy = new Map(dirWrong.map((m) => [m.ym, m]));
/* Poll-level readings, keyed onto the poll each was asked in so the archive
   table can show the rows the monthly line above is built from, each with the
   firm's movement on its OWN previous reading (houses differ enough that a
   cross-house change would be noise). Readings from waves that published no
   voting intention have no row to key onto – the archive's row set is polls
   that measured voting intention – so those show up only in the series. */
const DIR_BY = new Map();
{
  const last = {};
  for (const d of [...DIR].sort((a, b) => a.date.localeCompare(b.date))) {
    const net = r1(d.right - d.wrong);
    const prev = last[d.pollster];
    DIR_BY.set(d.date + "|" + d.pollster, {
      right: d.right, wrong: d.wrong, unsure: d.unsure, net,
      ...(prev ? { chg: { net: r1(net - prev.net), right: r1(d.right - prev.right),
                          wrong: r1(d.wrong - prev.wrong) }, ref: prev.date } : {}),
    });
    last[d.pollster] = { net, right: d.right, wrong: d.wrong, date: d.date };
  }
}

/* Both lines carry their interval, on the same terms as the 2PP: the spread
   between the houses that asked, floored by sampling error. Three houses ask
   this question and some months rest on one of them, so these are the widest
   bands on the site – which is the honest shape of a series this thin, and
   was previously only said in the caption. */
const dirRightRows = dirRows("right"), dirWrongRows = dirRows("wrong");
const direction = dirRight.map((m) => {
  const w = dirWrongBy.get(m.ym);
  if (!w) return null;
  const right = r1(m.v), wrong = r1(w.v);
  const rSe = monthWithSe(dirRightRows, dirHe.right, m.ym);
  const wSe = monthWithSe(dirWrongRows, dirHe.wrong, m.ym);
  return { ym: m.ym, x: m.x, right, wrong, unsure: r1(100 - right - wrong),
           net: r1(right - wrong), n: m.k,
           rightCi: rSe ? r1(1.96 * rSe.se) : null,
           wrongCi: wSe ? r1(1.96 * wSe.se) : null };
}).filter(Boolean);

/* ---- per-poll leadership / alt builders -------------------------------- */
const oppKey = (name) => (name === "Ley" ? "ley" : "taylor");
function buildPpm(date, firm) {
  const k = date + "|" + firm, p = PPM_BY.get(k);
  if (!p) return {};
  // every preferred-PM contest this poll published, as its own set – the main
  // row, any extra contests (7th element), then the Albanese-v-Hanson H2. Each
  // is a distinct MEASURE (two-way vs three-way etc.), never merged.
  const contest = (alb, opp, han) => {
    const s = { alb };
    if (opp != null) s[oppKey(p.oppName)] = opp;
    if (han != null) s.hanson = han;
    s.unc = Math.max(0, Math.round(100 - (alb + (opp || 0) + (han || 0))));
    return s;
  };
  const sets = [contest(p.alb, p.opp, p.han)];
  if (Array.isArray(p.extra)) {
    for (const c of p.extra) sets.push(contest(c.alb, c.opp ?? null, c.hanson ?? c.han ?? null));
  }
  const h2 = H2_BY.get(k);
  if (h2) sets.push({ alb: h2.alb, hanson: h2.han, unc: Math.max(0, 100 - h2.alb - h2.han) });
  return sets.length > 1 ? { ppmSets: sets } : { ppm: sets[0] };
}
function buildAppr(date, firm) {
  const a = APPR_BY.get(date + "|" + firm);
  if (!a) return { alb: null, taylor: null, hanson: null, albNet: null, taylorNet: null, hansonNet: null, oppName: null, metric: null };
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
  };
}
function buildAlt(date, firm) {
  const a = ALT_BY.get(date + "|" + firm), out = {};
  if (a && a.ao != null) out.tppAlt = { alp: r1(a.ao), onp: r1(100 - a.ao) };
  if (a && a.lo != null) out.tppAlt2 = { lnp: r1(a.lo), onp: r1(100 - a.lo) };
  return out;
}
function primaryOf(p) {
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
  pAlp:      (p, a, pm) => p.alp ?? null,
  pLnp:      (p, a, pm) => p.lnp ?? null,
  pGrn:      (p, a, pm) => p.grn ?? null,
  pOnp:      (p, a, pm) => p.onp ?? null,
  pOth:      (p, a, pm) => p.oth ?? null,
  // the movable share – "can't say" beside the primaries (Roy Morgan), the
  // shortfall inside the two-party pair (Essential), and the not-firm share
  // of the decided (Resolve). Each is that house's own series, so a delta
  // compares like with like
  und:       (p, a, pm) => (undecidedOf(p) || {}).v ?? null,
  // Roy Morgan/RedBridge's other published 2PP – the pair allocated on
  // 2025-election preference flows. Only those two houses carry it, so the
  // series is each house's own and the delta keys to its previous wave
  flows:     (p, a, pm) => p.tpp_flows ?? null,
  albNet:    (p, a, pm) => (a ? a.alb ?? null : null),
  taylorNet: (p, a, pm) => (a ? a.opp ?? null : null),
  hansonNet: (p, a, pm) => (a ? a.han ?? null : null),
  // the One Nation head-to-head 2PPs, each tracked as its own measure so the
  // 2nd/3rd matchups get their own change vs the pollster's last publication
  altAlpOn:  (p, a, pm, alt) => (alt ? alt.ao ?? null : null),
  altLnpOn:  (p, a, pm, alt) => (alt ? alt.lo ?? null : null),
  // preferred PM – the MAIN contest only (extra matchups aren't comparable)
  ppmAlb:    (p, a, pm) => (pm ? pm.alb ?? null : null),
  ppmOpp:    (p, a, pm) => (pm ? pm.opp ?? null : null),
  ppmHan:    (p, a, pm) => (pm ? pm.han ?? null : null),
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
    const mk = p.pollster + "|" + k, prev = lastMV[mk];
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
const UNDECIDED_BASES = [
  { id: "first", label: "First preference", dashed: false,
    note: "can’t say who they would vote for – set aside before the shares are reported" },
  { id: "tpp", label: "After preferences", dashed: true,
    note: "won’t nominate a side – still inside the published two-party pair, which is why it sums to under 100" },
  { id: "soft", label: "Not firm", dash: "1 3",
    note: "named a party but might still move – the soft share of the decided, Resolve’s “how firm are you”" },
];
const undecidedRows = POLLS.map((p) => ({ p, u: undecidedOf(p) })).filter((r) => r.u);
const undecidedSeries = UNDECIDED_BASES.map((b) => {
  const rs = undecidedRows.filter((r) => r.u.basis === b.id);
  if (!rs.length) return null;
  const polls = rs.map(({ p, u }) => ({
    x: dx(p.date), ym: ymOf(p.date), pollster: p.pollster,
    dateLabel: fwLabel(p.dateStart, p.date), released: p.date,
    sample: p.sample ?? null, v: u.v, basis: b.id,
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
  return {
    id: b.id, label: b.label, note: b.note, dashed: b.dashed, dash: b.dash,
    houses: [...new Set(polls.map((d) => d.pollster))],
    polls, monthly, n: polls.length,
    lo: Math.min(...vals), hi: Math.max(...vals),
    latest: { v: last.v, firm: last.pollster, released: last.released, field: last.dateLabel,
              chg: prev ? r1(last.v - prev.v) : null, refDate: prev ? prev.released : null },
  };
}).filter(Boolean);
const undecided = undecidedSeries.length ? {
  series: undecidedSeries,
  n: undecidedRows.length,
  houses: [...new Set(undecidedRows.map((r) => r.p.pollster))],
} : null;

/* ---- 6. individual polls (full archive) -------------------------------- */
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
    ...(fym !== ym ? { fym } : {}),
    field, dateLabel: field, released: p.date, sample: p.sample ?? null,
    // the commissioning publisher, exactly as the Latest-polls table shows
    // it – "Self-published" where the wave reported under no client
    client: p.client && p.client !== "—" ? p.client : "Self-published",
    /* the house's own published effective n, where one was filed with the
       Australian Polling Council. Houses that file none get no field at all
       and a "—" in the views; the estimator's derived weighting n is
       internal to rowN() and is never surfaced per-poll. */
    ...(p.sampleEff != null ? { sampleEff: p.sampleEff } : {}),
    /* When the wave was PUBLISHED, where the cited release says so. The
       archive's row detail has always had a line labelled "Published" and has
       always filled it with `released`, which is the last day of FIELDWORK -
       the same substitution the Latest-polls column was corrected for. Carried
       whole, clock and all, so the view can print the hour beside the date and
       fall back honestly where no release recorded one. */
    ...(p.published ? { published: p.published } : {}),
    ...(undecidedOf(p) ? { undecided: undecidedOf(p).v, undecidedBasis: undecidedOf(p).basis } : {}),
    // election-flows 2PP, ALP share (Roy Morgan; RedBridge/Accent since the
    // Aug 2026 wave) – absent, not zero, where no flows pair was published
    ...(p.tpp_flows != null ? { tppFlows: p.tpp_flows } : {}),
    // this poll's pull on the standing aggregates (leave-one-out, §3b) –
    // absent where the wave sits in none of the three series
    ...(effByKey.has(p.date + "|" + p.pollster) ? { eff: effByKey.get(p.date + "|" + p.pollster) } : {}),
    alp: p.tpp_alp ?? null, lnp: p.tpp_lnp ?? null, alpN: alpNOf(p),
    p: primaryOf(p), ...buildAlt(p.date, p.pollster), ...buildPpm(p.date, p.pollster),
    appr: buildAppr(p.date, p.pollster), chg: chgByKey[p.date + "|" + p.pollster],
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
    // right-track / wrong-track, where this poll asked it
    ...(DIR_BY.has(p.date + "|" + p.pollster) ? { dir: DIR_BY.get(p.date + "|" + p.pollster) } : {}),
    // seat projections – MRPs only. Carried verbatim; their change basis is the
    // last ELECTION, not the pollster's previous poll, so it travels with the
    // data rather than being inferred by the views.
    ...(p.seats ? { seats: p.seats } : {}),
  };
}).sort((a, b) => a.x - b.x || a.released.localeCompare(b.released));

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
const recent = POLLS.filter((p) => (latestMs - Date.parse(p.date)) / 86400000 <= LATEST_WINDOW_DAYS);
const perHouse = new Map();
for (const p of recent.sort((a, b) => a.date.localeCompare(b.date))) perHouse.set(canon(p.pollster), p);
const pollsterTable = [...perHouse.values()].map((p) => {
  const m = Number(p.date.slice(5, 7)), day = dayOf(p.date);
  return {
    pollster: p.pollster, client: p.client && p.client !== "—" ? p.client : "Self-published",
    field: fwLabel(p.dateStart, p.date), released: p.date, releasedLabel: `${day} ${monthName(m)}`,
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
    ...(p.tpp_flows != null ? { tppFlows: p.tpp_flows } : {}),
    // this poll's pull on the standing aggregates (leave-one-out, §3b) –
    // absent where the wave sits in none of the three series
    ...(effByKey.has(p.date + "|" + p.pollster) ? { eff: effByKey.get(p.date + "|" + p.pollster) } : {}),
    alp2pp: p.tpp_alp ?? null, lnp2pp: p.tpp_lnp ?? null,
    p: primaryOf(p), ...buildAlt(p.date, p.pollster), ...buildPpm(p.date, p.pollster),
    appr: buildAppr(p.date, p.pollster), chg: chgByKey[p.date + "|" + p.pollster],
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
    ...(DIR_BY.has(p.date + "|" + p.pollster) ? { dir: DIR_BY.get(p.date + "|" + p.pollster) } : {}),
    // a modelled chamber travels with the poll here too, not only into the
    // archive – a projection published this week belongs in Latest polls
    ...(p.seats ? { seats: p.seats } : {}),
  };
}).sort((a, b) => b.released.localeCompare(a.released));

/* ---- 7b. headline 2PP – trailing 21d, 7d half-life, debiased ----------- */
const headlineTpp = (ref) => {
  const r = nowcastAdj(tppRows, houseEffect, ref);
  return r ? { alp: r.v, n: r.n, se: r.se, nEff: r.nEff, ci95: r.ci95 } : null;
};
const refNow = new Date(LATEST_ISO).getTime();
const hlNow = headlineTpp(refNow) || { alp: agg2pp[agg2pp.length - 1].alp, n: 0 };
const hl1mo = headlineTpp(refNow - 30 * 86400000);

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
const synthNow = synthHeadline(refNow);
const synth1mo = synthHeadline(refNow - 30 * 86400000);

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

/* ---- 8. headline readings ---------------------------------------------- */
/* The reader-facing count. Products stay distinct series everywhere above –
   an (MRP) release is its own schedule, its own house effect – but this
   number says POLLSTERS, and "YouGov (MRP)" is YouGov. */
const houses = new Set(POLLS.map((p) => p.pollster.replace(/ \((MRP|SMS)\)$/, "")));
const fmtDate = (iso) => { const [y, m, d] = iso.split("-").map(Number); return `${d} ${MNF[m - 1]} ${y}`; };
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
  ...(hl1mo && hlNow.se != null ? (() => {
    const seChg = Math.sqrt(hlNow.se ** 2 + hl1mo.se ** 2);
    const chg = hlNow.alp - hl1mo.alp;
    return { changeSe: r1(seChg), changeCi95: r1(1.96 * seChg), changeSig: Math.abs(chg) > 1.96 * seChg };
  })() : {}),
  updated: fmtDate(LATEST_ISO), updatedISO: LATEST_ISO,
  published: fmtDate(LATEST_PUB_ISO), publishedISO: LATEST_PUB_ISO,
  nextElectionDue: "By 20 May 2028", pollsTracked: individualPolls.length, housesTracked: houses.size,
  method: { kind: "weighted house-effect-adjusted mean", windowDays: HL_WINDOW, halfLifeDays: HL_HALF, shrinkK: SHRINK_K, nPolls: hlNow.n },
};

/* ---- 9. events (chart markers) ----------------------------------------- */
const events = EVENTS.map((e) => ({
  date: e.date, x: dx(e.date), short: e.short, label: e.label, desc: e.desc, major: !!e.major,
}));

/* ---- 10. historical cycles, aligned to each winning election ----------- */
const MS_MONTH = 365.25 / 12;
const monthsSince = (iso, eDate) => (new Date(iso) - new Date(eDate)) / 86400000 / MS_MONTH;
function cycleSeries(points, base, cap = 36) {
  const known = {}, buckets = {};
  for (const { m, v } of points) { if (v == null) continue; const k = Math.round(m); if (k < 0 || k > cap) continue; (buckets[k] ||= []).push(v); }
  for (const k of Object.keys(buckets)) known[k] = mean(buckets[k]);
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
const CYC_META = [
  { year: 1987, gov: "alp", opp: "lnp", pm: "Hawke", lead: "Hawke", oppLead: "Howard → Peacock", eDate: "1987-07-11", ePrim: 45.8, eTpp: 50.8, src: 1990, appr: 1987,
    oppSpl: { iso: "1989-05-09", names: ["Howard", "Peacock"] } },
  { year: 1990, gov: "alp", opp: "lnp", pm: "Hawke → Keating", lead: "Hawke", oppLead: "Hewson", eDate: "1990-03-24", ePrim: 39.4, eTpp: 49.9, src: 1993, appr: 1990,
    pmSpl: { iso: "1991-12-19", names: ["Hawke", "Keating"] } },
  { year: 1993, gov: "alp", opp: "lnp", pm: "Keating", lead: "Keating", oppLead: "Hewson → Downer → Howard", eDate: "1993-03-13", ePrim: 44.9, eTpp: 51.4, src: 1996, appr: 1993,
    oppSpl: { isos: ["1994-05-23", "1995-01-30"], names: ["Hewson", "Downer", "Howard"] } },
  { year: 1996, gov: "lnp", opp: "alp", pm: "Howard", lead: "Howard", oppLead: "Beazley", eDate: "1996-03-02", ePrim: 46.9, eTpp: 53.6, src: 1998, appr: 1996 },
  { year: 1998, gov: "lnp", opp: "alp", pm: "Howard", lead: "Howard", oppLead: "Beazley", eDate: "1998-10-03", ePrim: 39.2, eTpp: 49.0, src: 2001, appr: 1998 },
  { year: 2001, gov: "lnp", opp: "alp", pm: "Howard", lead: "Howard", oppLead: "Beazley → Crean → Latham", eDate: "2001-11-10", ePrim: 43.0, eTpp: 51.0, src: 2004, appr: 2001,
    oppSpl: { isos: ["2001-11-22", "2003-12-02"], names: ["Beazley", "Crean", "Latham"] } },
  { year: 2004, gov: "lnp", opp: "alp", pm: "Howard", lead: "Howard", oppLead: "Latham → Beazley → Rudd", eDate: "2004-10-09", ePrim: 46.7, eTpp: 52.7, src: 2007, appr: 2004,
    oppSpl: { isos: ["2005-01-28", "2006-12-04"], names: ["Latham", "Beazley", "Rudd"] } },
  { year: 2007, gov: "alp", opp: "lnp", pm: "Rudd → Gillard", lead: "Rudd", oppLead: "Nelson → Turnbull → Abbott", eDate: "2007-11-24", ePrim: 43.4, eTpp: 52.7, src: 2010, appr: 2007,
    pmSpl: { iso: "2010-06-24", names: ["Rudd", "Gillard"] },
    oppSpl: { isos: ["2008-09-16", "2009-12-01"], names: ["Nelson", "Turnbull", "Abbott"] } },
  { year: 2010, gov: "alp", opp: "lnp", pm: "Gillard → Rudd", lead: "Gillard", oppLead: "Abbott", eDate: "2010-08-21", ePrim: 38.0, eTpp: 50.1, src: 2013, appr: 2010,
    pmSpl: { iso: "2013-06-27", names: ["Gillard", "Rudd"] } },
  { year: 2013, gov: "lnp", opp: "alp", pm: "Abbott → Turnbull", lead: "Abbott", oppLead: "Shorten", eDate: "2013-09-07", ePrim: 45.6, eTpp: 53.5, src: 2016, appr: 2013,
    pmSpl: { iso: "2015-09-15", names: ["Abbott", "Turnbull"] } },
  { year: 2016, gov: "lnp", opp: "alp", pm: "Turnbull → Morrison", lead: "Turnbull", oppLead: "Shorten", eDate: "2016-07-02", ePrim: 42.0, eTpp: 50.4, src: 2019, appr: 2016,
    pmSpl: { iso: "2018-08-24", names: ["Turnbull", "Morrison"] },
    oppSpl: { iso: "2019-05-27", names: ["Shorten", "Albanese"] } },
  /* Shorten → Albanese carries the iso here (like every other mid-term
     opposition change) because the preferred-PM pairing eras need it to
     name themselves; for the approval panels his era holds no post-
     election readings, so the eras collapse to one and nothing redraws. */
  { year: 2019, gov: "lnp", opp: "alp", pm: "Morrison", lead: "Morrison", oppLead: "Shorten → Albanese", eDate: "2019-05-18", ePrim: 41.44, eTpp: 51.53, src: 2022, appr: 2019,
    oppSpl: { iso: "2019-05-27", names: ["Shorten", "Albanese"] } },
  { year: 2022, gov: "alp", opp: "lnp", pm: "Albanese", lead: "Albanese", oppLead: "Dutton", eDate: "2022-05-21", ePrim: 32.6, eTpp: 52.1, src: 2025, appr: 2022 },
  { year: 2025, gov: "alp", opp: "lnp", pm: "Albanese", lead: "Albanese", oppLead: "Ley → Taylor", current: true, eDate: "2025-05-03", ePrim: 34.6, eTpp: 55.2,
    oppSpl: { iso: OPP_SPLICE_ISO, names: ["Ley", "Taylor"] } },
];
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
  for (const { m, v } of points) {
    if (v == null) continue;
    const k = Math.round(m);
    if (k < 0 || k > cap) continue;
    (b[k] ||= []).push(v);
  }
  return months.map((m) => (b[m] ? r1(mean(b[m])) : null));
}
/* ---- how the final polls did, cycle by cycle --------------------------
   The page's own caveat is that no aggregate can measure error shared across
   the whole industry about ITSELF. This is the only place that error is
   visible: twelve past elections, each with a result to check the final polls
   against, and the honest answer of how far out they were.

   The rule, stated once here so the number is reproducible: every house's LAST
   poll with a 2PP in the 14 days before polling day, one per house, equally
   weighted. Not sample-weighted - each house is a separate attempt at the same
   question and the interesting quantity is how many of them missed the same
   way, not how many people they rang. Exit polls are excluded: they measure
   voters leaving a booth, not an electorate deciding, and would flatter the
   record they belong to. Essential's undecided-inclusive pair is normalised
   first, the same way the trend series normalises it, or its 48/47 would score
   as a 4-point miss that is really an arithmetic difference. */
const ACC_WINDOW_DAYS = 14;
/* Same operation, renamed on the letterhead. Only renames go in here - Galaxy
   and YouGov are NOT merged, because merging houses to build one longer record
   is a claim about continuity of method that this table is in no position to
   make. */
const ACC_CANON = {
  "Morgan": "Roy Morgan", "Newspoll-YouGov": "Newspoll",
  "Resolve Strategic": "Resolve", "Freshwater Strategy": "Freshwater",
  "Redbridge/Accent": "RedBridge", "Spectre Strategy": "Spectre",
};
const accCanon = (f) => ACC_CANON[f] || f;
const accuracyCycles = CYC_META.filter((c) => !c.current && c.src).map((c) => {
  const e = ELECTIONS["e" + c.src];
  const eMs = new Date(e.date).getTime();
  const inWindow = (cyclePolls[c.src] || []).filter((p) => {
    if (p.firm === "Election" || /exit/i.test(p.firm)) return false;
    if (p.tpp_alp == null) return false;
    const d = ddays(eMs, new Date(p.date).getTime());
    return d >= 0 && d <= ACC_WINDOW_DAYS;
  });
  const byHouse = new Map();
  for (const p of [...inWindow].sort((a, b) => a.date.localeCompare(b.date)))
    byHouse.set(accCanon(p.firm), p);
  const houses = [...byHouse.entries()].map(([firm, p]) => ({
    firm, date: p.date, alp2pp: r1(share2pp(p)), err: r1(share2pp(p) - e.tpp_alp),
  })).sort((a, b) => Math.abs(a.err) - Math.abs(b.err));
  if (!houses.length) return null;
  const meanPoll = houses.reduce((t, h) => t + h.alp2pp, 0) / houses.length;
  const err = meanPoll - e.tpp_alp;
  return {
    // labelled by the election being CALLED, which is the one a reader
    // remembers – not the election that started the term
    year: c.src, eDate: e.date, result: e.tpp_alp,
    mean: r1(meanPoll), err: r1(err), absErr: r1(Math.abs(err)),
    houses, n: houses.length,
    // did they all miss the same way? one-sided error is the signature of a
    // problem in the industry rather than noise in a house
    sameSide: houses.every((h) => h.err > 0) || houses.every((h) => h.err < 0),
    worst: r1(Math.max(...houses.map((h) => Math.abs(h.err)))),
  };
}).filter(Boolean);
const accuracy = accuracyCycles.length ? (() => {
  const byFirm = new Map();
  for (const c of accuracyCycles)
    for (const h of c.houses) {
      const e = byFirm.get(h.firm) || { firm: h.firm, cycles: [] };
      e.cycles.push({ year: c.year, err: h.err });
      byFirm.set(h.firm, e);
    }
  const firms = [...byFirm.values()].map((f) => ({
    firm: f.firm, n: f.cycles.length, cycles: f.cycles,
    meanErr: r1(f.cycles.reduce((t, c) => t + c.err, 0) / f.cycles.length),
    meanAbs: r1(f.cycles.reduce((t, c) => t + Math.abs(c.err), 0) / f.cycles.length),
  })).sort((a, b) => b.n - a.n || a.meanAbs - b.meanAbs);
  const abs = accuracyCycles.map((c) => c.absErr);
  return {
    windowDays: ACC_WINDOW_DAYS, cycles: accuracyCycles, firms,
    meanAbs: r1(abs.reduce((t, v) => t + v, 0) / abs.length),
    worstCycle: accuracyCycles.reduce((w, c) => (c.absErr > w.absErr ? c : w)),
  };
})() : null;

const CYCLE_DEFS = CYC_META.map((c) => {
  let primPts, tppPts, netPts, oppPts, hanPts, oppPrimPts, onpPts, ppmPts;
  if (c.current) {
    primPts = aggPrimary.map((d) => ({ m: monthsSince(d.ym + "-15", c.eDate), v: d.alp }));
    tppPts = agg2pp.map((d) => ({ m: monthsSince(d.ym + "-15", c.eDate), v: d.alp }));
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
    const apprOnly = appr.filter((a) => metricOf(a.firm, "alb") !== "fav");   // PM approval only, not favourability
    netPts = apprOnly.map((a) => ({ m: monthsSince(a.date, c.eDate), v: a.alb, iso: a.date }));
    oppPts = apprOnly.map((a) => ({ m: monthsSince(a.date, c.eDate), v: a.opp, iso: a.date }));
    // current-term ppm readings are the live ppm table's per-wave margin
    ppmPts = ppm.map((p) => ({ m: monthsSince(p.date, c.eDate), v: p.alb - p.opp, iso: p.date }));
    // Hanson's metric is filtered per row and per DATE – Resolve rated her on
    // likeability until the 6-11 Jul 2026 wave and on performance after it, so
    // an unbounded firm test would put favourability on an approval line.
    hanPts = appr.filter((a) => metricOf(a.firm, "han", a.date) !== "fav")
                 .map((a) => ({ m: monthsSince(a.date, c.eDate), v: a.han }));
  } else {
    const ps = cyclePolls[c.src], as = cycleAppr[c.appr];
    primPts = ps.map((p) => ({ m: monthsSince(p.date, c.eDate), v: p[c.gov] }));
    tppPts = ps.map((p) => ({ m: monthsSince(p.date, c.eDate), v: p["tpp_" + c.gov] }));
    oppPrimPts = ps.map((p) => ({ m: monthsSince(p.date, c.eDate), v: p[c.opp] }));
    onpPts = ps.map((p) => ({ m: monthsSince(p.date, c.eDate), v: p.onp }));
    // same rule as the current cycle: these lines are approve−disapprove, so a
    // favourability net never enters them. Historical rows may name the metric
    // in a 5th element; otherwise the firm decides. Matters most for the 2022
    // cycle, where Freshwater and RedBridge report favourability.
    const apprRows = as.filter((r) => (r.metric || metricOf(r.firm, "alb")) !== "fav");
    netPts = apprRows.map((r) => ({ m: monthsSince(r.date, c.eDate), v: r.pmNet, iso: r.date }));
    oppPts = apprRows.map((r) => ({ m: monthsSince(r.date, c.eDate), v: r.oppNet, iso: r.date }));
    // preferred-PM rides the same approval waves: margin per wave, PM minus
    // opponent. Pairing-neutral number, so it filters ALL rows, not the
    // favourability-safe apprRows – Freshwater reports approval as
    // favourability but its ppm readings stand independently
    ppmPts = as.filter((r) => r.pmPpm != null && r.oppPpm != null)
      .map((r) => ({ m: monthsSince(r.date, c.eDate), v: r.pmPpm - r.oppPpm, iso: r.date }));
    // no past cycle rated Hanson: cycleApproval carries pmNet and oppNet only
    hanPts = [];
  }
  const cap = c.current ? Math.max(1, Math.round(monthsSince(LATEST_ISO, c.eDate))) : 36;
  const prim = cycleSeries(primPts, c.ePrim, cap);
  const tpp = cycleSeries(tppPts, c.eTpp, cap);
  const eOpp = ELECTIONS["e" + c.year];             // the election that STARTED the term
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
  return {
    year: c.year, gov: c.gov, opp: c.opp, pm: c.pm, lead: c.lead, oppLead: c.oppLead, current: !!c.current,
    eDate: c.eDate,
    months, primary: prim.vals, tpp: tpp.vals, net: align(net), oppnet: align(opp),
    oppr: oppr.vals,
    ppmm: align(ppmm),
    // the null-padded form align() can't produce alone: with no ONP readings
    // on record (2010/13), s.months is empty and align has nothing to index
    onp: onp.months.length ? align(onp) : months.map(() => null),
    obs: { primary: prim.obs, tpp: tpp.obs, net: alignObs(net), oppnet: alignObs(opp),
           oppr: oppr.obs, onp: alignObs(onp), ppmm: alignObs(ppmm) },
    han: sparseSeries(hanPts, months, cap),
    netEras: eraSeries(netPts, c.pmSpl, cap), oppEras: eraSeries(oppPts, c.oppSpl, cap),
    ppmEras: ppmErasFor(c, ppmPts, cap),
    // pairing name for the single-line legend when the pairing never
    // changed inside the measured window (e.g. "Albanese v Dutton")
    ppmPair: ppmPts.length ? ppmPairName(c, ppmPts[0].iso) : null,
  };
});

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
   does not remove one - an unrecorded release holds its slot, overdue, until
   it is recorded. A house that has broken its own pattern is not "expected"
   and is left out rather than given a made-up date. */
const CAD_DEFAULT_LAG = 1;
/* The weekday, the hour and the spread are all read off a RECENT window, not
   the whole record - the same eight-wave window the cadence itself uses, plus
   a little slack so a house does not lose its habit to one sample. A house's
   schedule is a current fact about it, and its early record is often a
   different house: Roy Morgan's release slugs are Monday in only two thirds of
   the full run, because the 2025 ones are named for the fieldwork end, and
   Monday in eleven of the last twelve. Judging it on all 39 hid the schedule
   it actually keeps. */
const CAD_RECENT = 12;
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
   unrecorded release HOLDS its slot, marked overdue, until it is recorded,
   and a house that has genuinely stopped (Fox & Hedgehog among them) is
   removed by hand instead, via pollsterRules.stopped. */
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
   end and its remaining six gaps run 20 to 53 days, which is the house. */
const CAD_SPREAD_TRIM = 4;     // gaps needed before an end value can be spared
/* …and beyond THIS there is no rhythm to state at all: a window wider than
   three quarters of the interval says only "some time in the next couple of
   cycles", which is not worth a reader's attention. Between the two, a house
   gets a window instead of a day. */
const CAD_LOOSE_MAX_REL_SPREAD = 0.75;
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
for (const p of POLLS) {
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
const pollCadence = [];
for (const [firm, rows] of Object.entries(byHouse)) {
  const dates = rows.map((r) => r.date).sort();
  if (dates.length < CAD_MIN_POLLS) continue;
  // the unbroken dated tail – see CAD_PUB_MIN
  let tail = 0;
  while (tail < rows.length && rows[rows.length - 1 - tail].pub) tail++;
  const pubDates = tail > CAD_PUB_MIN ? rows.slice(rows.length - tail).map((r) => r.pub) : null;
  const basis = pubDates ? "published" : "fieldwork";
  // the sequence the interval is measured along, and the date it is projected from
  const seq = pubDates || dates;
  const gaps = seq.slice(1).map((d, i) => Math.round((Date.parse(d) - Date.parse(seq[i])) / 86400000));
  const cadence = medianOf(gaps.slice(-8));
  if (!cadence || cadence <= 0) continue;
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
  for (let i = 0; i < gaps.length; i++) {
    if (i + 1 < gaps.length && gaps[i] < cadence && gaps[i + 1] < cadence &&
        Math.abs(gaps[i] + gaps[i + 1] - cadence) <= 2) {
      fused.push(gaps[i] + gaps[i + 1]);
      i++;
    } else fused.push(gaps[i]);
  }
  const slotGaps = fused.slice(-8);
  const last = seq[seq.length - 1];
  /* The only way OFF the projection: declared stopped by hand. Silence on
     its own no longer removes a house – an unrecorded release holds its
     slot until it is recorded (see CAD_MAX_REL_SPREAD above). */
  if ((D.pollsterRules?.[firm] || {}).stopped) continue;
  const ts = (timeSamples[firm] || []).slice(-CAD_RECENT);
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
  /* Half the range of the recent slot gaps, least and greatest set aside -
     see CAD_SPREAD_TRIM. Floored at a day: even Roy Morgan's perfect 7-day
     cadence still moves a day either side on publication. */
  const trimmed = [...slotGaps].sort((a, b) => a - b);
  if (trimmed.length >= CAD_SPREAD_TRIM) { trimmed.pop(); trimmed.shift(); }
  const spread = Math.max(1, Math.round((trimmed[trimmed.length - 1] - trimmed[0]) / 2));
  /* The misses don't fall equally either side of the interval. A house slips
     a wave LATE far more readily than it brings one forward, and in the
     current record literally so: every weekday house's off-median intervals
     are long ones, none short. Half the range cannot say that, so the two
     sides are booked separately too - the panel can then state "or the
     Sunday after" instead of pretending an early Sunday has any precedent.
     NOT floored like spread: a zero is exactly the signal being carried. */
  const spreadEarly = Math.max(0, cadence - trimmed[0]);
  const spreadLate = Math.max(0, trimmed[trimmed.length - 1] - cadence);
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
  const decl = (D.pollsterRules?.[firm] || {}).release || null;
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
     run keeps it narrow. DemosAU at present: the 9th to the 27th. */
  const calDays = !calMonth ? null : (() => {
    const ds = seq.map((d) => Number(d.slice(8, 10)));
    return [Math.min(...ds), Math.max(...ds)];
  })();
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
  const releaseDow = calMonth ? null : (decl && decl.dow != null ? decl.dow : dowHabit);
  const timed = ts.length >= 5;
  pollCadence.push({
    pollster: firm,
    last,
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
       YouGov has filed at 5am five times and 6am once, and "5-6am" is the
       precise statement about that while "5am" and "5.10am" are both fictions
       of different kinds. Minutes past midnight, house local time - which is
       eastern, and is not converted for the reader's own zone because the
       release schedule is a fact about the publisher, not about the reader. */
    releaseFrom: timed ? Math.min(...ts) : declMins,
    releaseTo: timed ? Math.max(...ts) : declMins,
    // the middle as well as the ends: one late release should not be allowed
    // to widen a house's stated hour into something it almost never does
    releaseMid: timed ? medianOf(ts) : declMins,
    releaseTimed: timed ? ts.length : 0,
    /* The one clock reading the panel decides ON, as opposed to the ones it
       prints: minutes past midnight, eastern, of the moment a wave is expected
       to be out. Null where the house has never been timed, and the panel then
       gives it the whole day rather than inventing an hour for it. */
    releaseMins: timed ? medianOf(ts) : declMins,
    releaseDow,
    releaseDowN: releaseDow == null ? 0 : (decl && decl.dow != null ? 0 : dowTop[1]),
    // which parts of this are stated rather than measured, so the panel can say so
    declared: decl ? [decl.dow != null && "day", declMins != null && !timed && "hour",
      calMonth && "calendar-month rhythm"].filter(Boolean) : [],
    /* The month itself is the projection, not a median ± spread: npProject's
       window is the measured day-of-month range (calDays) of the month
       after the last wave, with the bare 1st-to-last month as its fallback. */
    ...(calMonth ? { calMonth: true, calDays } : {}),
    waves: dates.length,
    // the house's own release index, so a reader can go and check
    site: (D.pollsterRules?.[firm] || {}).site || null,
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
for (const c of CYC_META) {
  if (c.current) continue;
  const mo = (d) => Math.round(monthsSince(d, c.eDate) * 10) / 10;
  cycleSource[c.year] = {
    polls: (cyclePolls[c.src] || []).map((p) => ({
      date: p.date, firm: p.firm, m: mo(p.date),
      alp: p.alp ?? null, lnp: p.lnp ?? null, grn: p.grn ?? null,
      onp: p.onp ?? null, oth: p.oth ?? null,
      tpp_alp: p.tpp_alp ?? null, tpp_lnp: p.tpp_lnp ?? null,
    })),
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

/* ---- emit the dataset asset -------------------------------------------- */
const out = `/* auspol tracker – REAL Australian federal polling data.
   Generated from data/polls.json by .build/newtracker/gen-data.mjs – do
   not edit by hand.  Spine: 2025 federal election (3 May 2025) → ${latest.updated}.
   2PP aggregate: sample- & recency-weighted, house-effect-adjusted mean;
   every monthly estimate deflates a house's repeat waves in the month to
   the square root of their number, the same rule the nowcast window applies.
   Opposition-leader figures splice Sussan Ley → Angus Taylor (13 Feb 2026);
   the opposition slot is an office, not a person.  "National direction"
   carries no source series yet and renders an empty state. */

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

  const LEADERS = [
    { id: "alb", name: "Albanese", short: "Albanese", party: "ALP", color: "var(--alp)" },
    { id: "taylor", name: "Taylor", short: "Taylor", party: "L/NP", color: "var(--lnp)" },
    { id: "hanson", name: "Hanson", short: "Hanson", party: "ON", color: "var(--onp)" },
  ];

  const agg2pp = ${JSON.stringify(agg2pp)};
  const aggPrimary = ${JSON.stringify(aggPrimary)};
  const alt2pp = ${JSON.stringify(alt2pp)};
  // nowcast per alternative matchup – null where the series is too thin
  const altLatest = ${JSON.stringify(altLatest)};
  /* Synthetic 2PP diagnostic: the polls' primaries read through the single
     AEC-2025 flow table in flows.mjs, on the SAME estimator (house effects,
     window, half-life) as the published series above. A diagnostic, not a
     shadow headline: its election "anchor" is the table read back onto the
     count's own primaries (54.2 vs the actual 55.2), and its nowcast will
     sit ~0.7pt under the published blend for as long as houses' own
     allocations run ALP-side of a fixed 2025 table. The UI shows it as a
     non-default overlay / method-page comparison, never as a correction. */
  const synth2pp = ${JSON.stringify(agg2ppSynth)};
  const synthLatest = ${JSON.stringify(synthNow ? { ...synthNow, lnp: r1(100 - synthNow.alp), prev: synth1mo ? synth1mo.alp : null } : null)};
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
    tpp: houseEffect.snapshot(Infinity),
    primary: Object.fromEntries(Object.entries(primaryHE).map(([k, h]) => [k, h.snapshot(Infinity)])),
    alp_on: altAON.he.snapshot(Infinity),
    appr: Object.fromEntries(Object.entries(apprHE).map(([lk, h]) => [lk, h.snapshot(Infinity)])),
    synth: synthEffect.snapshot(Infinity),
  })};
  const houseLean = ${JSON.stringify(houseLean)};
  const leaderMonths = ${JSON.stringify(leaderMonths)};
  const direction = ${JSON.stringify(direction)};
  const directionHouseEffects = ${JSON.stringify({ right: dirHe.right.snapshot(Infinity), wrong: dirHe.wrong.snapshot(Infinity) })};
  const directionHouses = ${JSON.stringify(directionHouses)};
  const directionPolls = ${JSON.stringify(directionPolls)};
  const directionAvailable = ${direction.length > 0};
  const undecided = ${JSON.stringify(undecided)};
  const accuracy = ${JSON.stringify(accuracy)};
  const individualPolls = ${JSON.stringify(individualPolls)};
  const pollsterTable = ${JSON.stringify(pollsterTable)};
  const latest = ${JSON.stringify(latest)};
  const events = ${JSON.stringify(events)};

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
     failed fetch is not fatal: the lines still draw from the aggregates, and
     the CSV comes out short rather than the tab dying. */
  let _cycleSource = null;
  let _cyclePromise = null;
  const loadCycleSource = () => {
    if (_cycleSource) return Promise.resolve(_cycleSource);
    if (!_cyclePromise) {
      const url = window.AP_CYCLE_SRC;
      _cyclePromise = (url ? fetch(url).then((r) => (r.ok ? r.json() : {})) : Promise.resolve({}))
        .catch((e) => { console.error("cycle source failed to load", e); return {}; })
        .then((j) => { _cycleSource = j; return j; });
    }
    return _cyclePromise;
  };
  /* Measured publication rhythm per house – drives "Next expected polls".
     The dates themselves are computed in the browser against the real current
     date, so the panel stays honest as the page ages. */
  const pollCadence = ${JSON.stringify(pollCadence)};
  const cycles = CYCLE_DEFS.map((c) => ({
    year: c.year, gov: c.gov, opp: c.opp, pm: c.pm, lead: c.lead, oppLead: c.oppLead, current: c.current,
    eDate: c.eDate,
    color: PARTIES[c.gov].color, span: c.months[c.months.length - 1],
    base: { tpp: c.tpp[0], primary: c.primary[0], net: c.net[0], oppnet: c.oppnet[0], han: c.han[0],
            oppr: c.oppr[0], onp: c.onp[0], ppmm: c.ppmm[0] },
    // han is sparse, so "end" is its last READING, not its last slot;
    // onp and ppmm follow it — both grid as all-null on some cycles
    end: { tpp: c.tpp[c.tpp.length - 1], primary: c.primary[c.primary.length - 1], net: c.net[c.net.length - 1], oppnet: c.oppnet[c.oppnet.length - 1], han: [...c.han].reverse().find((v) => v != null) ?? null,
           oppr: c.oppr[c.oppr.length - 1], onp: [...c.onp].reverse().find((v) => v != null) ?? null,
           ppmm: [...c.ppmm].reverse().find((v) => v != null) ?? null },
    points: {
      tpp: c.months.map((m, i) => ({ x: m, y: c.tpp[i] })),
      primary: c.months.map((m, i) => ({ x: m, y: c.primary[i] })),
      net: c.months.map((m, i) => ({ x: m, y: c.net[i] })),
      oppnet: c.months.map((m, i) => ({ x: m, y: c.oppnet[i] })),
      han: c.months.map((m, i) => ({ x: m, y: c.han[i] })),
      oppr: c.months.map((m, i) => ({ x: m, y: c.oppr[i] })),
      onp: c.months.map((m, i) => ({ x: m, y: c.onp[i] })),
      ppmm: c.months.map((m, i) => ({ x: m, y: c.ppmm[i] })),
    },
    raw: { tpp: c.tpp, primary: c.primary, net: c.net, oppnet: c.oppnet, han: c.han, months: c.months, obs: c.obs,
           oppr: c.oppr, onp: c.onp, ppmm: c.ppmm,
           ...(c.netEras ? { netEras: c.netEras } : {}), ...(c.oppEras ? { oppEras: c.oppEras } : {}),
           ...(c.ppmEras ? { ppmEras: c.ppmEras } : {}), ...(c.ppmPair ? { ppmPair: c.ppmPair } : {}) },
  }));

  return {
    PARTIES, MONTHS, mx, monthName, monthNameFull,
    agg2pp, aggPrimary, LEADERS, leaderMonths, alt2pp, altLatest, synth2pp, synthLatest, adjusted, houseEffects, houseLean, direction, directionAvailable, directionHouseEffects, directionHouses, directionPolls, undecided, accuracy,
    individualPolls, pollsterTable, latest, cycles, events,
    // a getter, so existing callers keep reading D.cycleSource unchanged –
    // empty until loadCycleSource() has resolved
    get cycleSource() { return _cycleSource || {}; },
    loadCycleSource,
    pollCadence,
    domain: { x0: mx(MONTHS[0]) - 0.06, x1: mx(MONTHS[MONTHS.length - 1]) + 0.04 },
  };
})();
`;
fs.writeFileSync(DATA_ASSET, out);
/* Sidecar, inlined by build.mjs as an application/json block. Kept out of the
   JS module on purpose – see the note beside loadCycleSource above. */
fs.writeFileSync(CYCLE_SOURCE_ASSET, JSON.stringify(cycleSource));

/* ---- sanity summary ---------------------------------------------------- */
console.log("cycle leader splits:", CYCLE_DEFS.map((c) => {
  const parts = [];
  if (c.netEras) parts.push("pm: " + c.netEras.map((e) => `${e.name} m${e.months[0]}–${e.months[e.months.length - 1]}`).join(" | "));
  if (c.oppEras) parts.push("opp: " + c.oppEras.map((e) => `${e.name} m${e.months[0]}–${e.months[e.months.length - 1]}`).join(" | "));
  return parts.length ? `${c.year}(${parts.join("; ")})` : null;
}).filter(Boolean).join(" "));
console.log("MONTHS:", MONTHS.length, MONTHS[0], "→", MONTHS[MONTHS.length - 1]);
console.log("agg2pp:", agg2pp.length, "pts | first:", agg2pp[0], "| last:", agg2pp[agg2pp.length - 1]);
console.log("synth2pp:", agg2ppSynth.length, "pts | anchor(implied):", agg2ppSynth[0].alp, "vs count 55.2 | last:", agg2ppSynth[agg2ppSynth.length - 1]);
console.log("synthLatest:", synthNow ? `ALP ${synthNow.alp} (n=${synthNow.n}, se=${synthNow.se.toFixed(2)}) vs published ${hlNow.alp} → Δ${r1(synthNow.alp - hlNow.alp)}` : "none (window empty)");
console.log("aggPrimary last:", aggPrimary[aggPrimary.length - 1]);
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
console.log("houseEffects (2PP):", Object.entries(houseEffect.snapshot(Infinity)).sort((a, b) => b[1].v - a[1].v).map(([f, h]) => `${f} ${h.v > 0 ? "+" : ""}${h.v}(n=${h.n})`).join(", "));
console.log("headline 2PP:", hlNow, "| 1mo ago:", hl1mo);
console.log("pollCadence:", pollCadence.length, "houses on a pattern →",
  pollCadence.map((c) => {
    const WDS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const hh = c.releaseMins == null ? "" : ` @${String(Math.floor(c.releaseMins / 60)).padStart(2, "0")}:${String(c.releaseMins % 60).padStart(2, "0")}`;
    return `${c.pollster} ${c.cadence}d±${c.spread} lag${c.lag}${c.lagMeasured ? "(n=" + c.lagMeasured + ")" : ""}`
      + (c.releaseDow == null ? "" : ` ${WDS[c.releaseDow]}${c.releaseDowN ? "(" + c.releaseDowN + "/" + Math.min(CAD_RECENT, (dowSamples[c.pollster] || []).length) + ")" : ""}`)
      + hh + ` <${c.basis}>` + (c.declared.length ? ` [declared ${c.declared.join("+")}]` : "") + (c.loose ? " LOOSE" : "");
  }).join(" | "));
console.log("events:", events.length, "(major:", events.filter((e) => e.major).length + ")");
console.log("cycles:", CYCLE_DEFS.map((c) => `${c.year} m0..${c.months.at(-1)} tpp ${c.tpp[0]}→${c.tpp.at(-1)} prim ${c.primary[0]}→${c.primary.at(-1)} net ${c.net[0]}→${c.net.at(-1)} opp ${c.oppnet[0]}→${c.oppnet.at(-1)}`).join("\n        "));
console.log("cycle ranges: tpp", ...(() => { const v = CYCLE_DEFS.flatMap((c) => c.tpp); return [Math.min(...v), Math.max(...v)]; })(), "| prim", ...(() => { const v = CYCLE_DEFS.flatMap((c) => c.primary); return [Math.min(...v), Math.max(...v)]; })(), "| net", ...(() => { const v = CYCLE_DEFS.flatMap((c) => c.net); return [Math.min(...v), Math.max(...v)]; })(), "| oppnet", ...(() => { const v = CYCLE_DEFS.flatMap((c) => c.oppnet); return [Math.min(...v), Math.max(...v)]; })());
