/* bonham-replica.mjs – a reconstruction of Kevin Bonham's 2025-2028 federal
   2PP aggregate from the tracker's own poll dataset, for the hero chart's
   external-comparator overlay.

   WHY A RECONSTRUCTION AT ALL
   Bonham publishes only the CURRENT two figures in his blog sidebar
   (classic 2PP and One Nation shadow-2PP) plus occasional roundups; the
   historical series is not downloadable. His METHOD, however, is published
   in full (the 2025-09-26 methods page and its update log), his conversion
   formula is published with exact coefficients (the "Interim Last-Election
   Preference Flows" block in the 2025-09 poll roundup), and his published
   figures since Oct 2025 are recoverable (sidebar scrapes + Wayback). So
   the comparator line is our run of HIS documented method over OUR poll
   set, validated against his real published stamps; it is labelled a
   reconstruction wherever it is drawn.

   THE METHOD AS PUBLISHED (methods page, kevinbonham.blogspot.com/2025/09/
   2025-2028-2pp-aggregate-methods-page.html, retrieved 2026-10-02):
   - activity: the aggregate is live when at least three polls by at least
     two pollsters carry an age weighting above 0.5; otherwise it freezes
     and the frozen span is interpolated when it re-activates
   - last-election 2PP: each poll's primaries are converted by his own
     preference-flow estimate; published 2PPs "do not affect the aggregate"
   - age weighting: a poll joins on its release day; weighted data age =
     0.6 x age of youngest fieldwork day + 0.4 x age of oldest (60:40 since
     6 Oct 2025); weight is 5 while the weighted age is 7 days or less, then
     decays x0.618 per week (calculated daily)
   - anti-swamping: only the two heaviest age-weighted polls per pollster
   - accuracy weighting: 0.50 (worst) .. 1.50 (best) from his election
     table rankings; as of the methods page Newspoll 1.35, RedBridge 1.11;
     a new pollster gets 0.8; otherwise the exact per-house numbers are not
     published and default to 1.0 here; no sample-size weighting except
     n<900 halved; commissioned and "junk" polls excluded
   - house effects: applied where a house's average difference from the
     aggregate over the term is at least half a point (his "average of the
     last six differences" temporary-divergence variant is judgment and is
     not replicable; term-to-date mean only, iterated once against an
     uncorrected first pass)
   - inclusion: ALP/LNP/GRN primaries minimum; no One Nation breakout
     downweighted half (banned outright from 24 Jan 2026); MRPs excluded
     (any data more than a month old at first report, formalised 27 Jul 26);
     SMS-majority polls excluded (25 Feb 26); undecided >= 10% excluded
     (31 May 26); resets on a change of Prime Minister (none so far)
   - display: the quoted figure is the 7-day smoothed aggregate
   - conversion (roundup "Interim Last-Election Preference Flows"):
     2PP = ALP + .8819*GRN + .2550*ON + .3619*TOP + .6757*IND + .4485*OTH
           + 0.09   (0.07 three-cornered + 0.02 Bradfield residual)
     with his composite for Others-including-IND = .5736 (the tracker's
     combined ind bucket where oth is null). TOP is not split out by any
     current pollster.

   KNOWN UNKNOWNS (why this is a replica, not a mirror): per-house accuracy
   weights beyond Newspoll 1.35 / RedBridge 1.11 are not published; his
   house-effect assignments are partly judgment; his exact state at any
   past date (he recomputes daily and does not publish the log) is gone.
   Validated against: his own canaries (woke 29 Jun 2025; 56.3 smoothed at
   the 26 Sep 25 methods page; raw-daily extrema 57.2 high / 55.5 low; the
   two roundup worked examples to about half a point) and the published
   sidebar stamps kept in data/bonham-2pp.json — measured by
   .build/check-bonham-replica.mjs: over the 49 stamps of 2025-10-05 ..
   2026-09-30, mean |dev| 0.56 pts, median 0.5, max 1.5, signed mean +0.54
   (the replica runs about half a point ALP-above his: exactly the
   accuracy-weights missing from the recipe, whose direction is
   Newspoll-heavy), and dead-on 52.3 at the latest stamp. */

const DAY = 86400000;
const d2iso = (ms) => new Date(ms).toISOString().slice(0, 10);
const iso2ms = (iso) => Date.parse(iso + "T00:00:00Z");
const r1 = (x) => Math.round(x * 10) / 10;

/* his conversion coefficients, exactly as published */
export const B_FLOWS = { grn: 0.8819, onp: 0.255, ind: 0.6757, oth: 0.4485, indOth: 0.5736, intercept: 0.09 };
/* accuracy weights: the two values his methods page publishes; 0.8 for
   houses polling their first term (his standing "new pollster" rule);
   1.0 where the exact number is not public */
export const B_ACC = { Newspoll: 1.35, "RedBridge/Accent": 1.11 };
const B_ACC_NEW = 0.8;
const B_ACC_NEW_HOUSES = new Set(["DemosAU", "Spectre Strategy", "Fox & Hedgehog"]);
/* houses his aggregate does NOT carry at all: not on his inclusion list
   (Agenda C Synesis – his named commissioned example – Wolf & Smith), the
   SMS-majority Morgan variant (25 Feb 26 rule), and MRP products */
const B_EXCLUDED = new Set(["Agenda C Synesis", "Wolf & Smith", "Election Result", "Roy Morgan (SMS)"]);
const B_RULE_DATES = { onpBan: "2026-01-24", smsBan: "2026-02-25", undBan: "2026-05-31", mrpBan: "2026-07-27" };
const RESET_AT = "2025-05-03"; // the term; a PM change would reset this (none yet)
const AGE_MAX_W = 5, AGE_FREE = 7, AGE_WEEK_DECAY = 0.618; // published constants
const HE_MIN = 0.5, HE_MIN_POLLS = 3;                      // his half-point rule; needs a few polls to see

const bFlows2pp = (p) => {
  if (p.alp == null || p.lnp == null || p.grn == null) return null;
  const indOth = p.oth != null
    ? (p.ind || 0) * B_FLOWS.ind + p.oth * B_FLOWS.oth
    : (p.ind || 0) * B_FLOWS.indOth;
  return p.alp + p.grn * B_FLOWS.grn + (p.onp || 0) * B_FLOWS.onp + indOth + B_FLOWS.intercept;
};
const accOf = (firm) => B_ACC[firm] ?? (B_ACC_NEW_HOUSES.has(firm) ? B_ACC_NEW : 1.0);
/* weighted data age in days: 60:40 youngest:oldest fieldwork day – the
   methods page's 6 Oct 2025 update notes it ran 2:1 before then and the
   change was not backrun, so the cutover is honoured here */
const AGE_MIX_SWITCH = "2025-10-06";
const dataAge = (p, tMs, tIso) => {
  const [a, b] = tIso < AGE_MIX_SWITCH ? [2 / 3, 1 / 3] : [0.6, 0.4];
  return (a * (tMs - iso2ms(p.date)) + b * (tMs - iso2ms(p.dateStart || p.date))) / DAY;
};
const ageW = (a) => (a <= AGE_FREE ? AGE_MAX_W : AGE_MAX_W * Math.pow(AGE_WEEK_DECAY, (a - AGE_FREE) / 7));
const releaseOf = (p) => (p.published ? p.published.slice(0, 10) : p.date);

let PREP_CACHE = null;
function poolsPrep(polls) {
  if (PREP_CACHE && PREP_CACHE.src === polls) return PREP_CACHE.rows;
  const rows = [];
  for (const p of polls) {
    if (p.isElection) continue;
    const release = releaseOf(p);
    if (release < RESET_AT) continue;
    const firm = p.pollster;
    let excluded = B_EXCLUDED.has(firm) || /\(MRP\)/.test(firm);
    // MRP rule as he formalised it: data more than a month old at release
    if (!excluded && p.dateStart && release >= B_RULE_DATES.mrpBan
        && iso2ms(release) - iso2ms(p.dateStart) > 31 * DAY) excluded = true;
    const row = { date: p.date, dateStart: p.dateStart };
    rows.push({
      row, firm, release,
      releaseMs: iso2ms(release),
      x: bFlows2pp(p),
      und: p.undecided ?? null,
      small: p.sample != null && p.sample < 900,
      noOnp: p.onp == null,
      excluded,
    });
  }
  rows.sort((a, b) => (a.release < b.release ? -1 : 1));
  PREP_CACHE = { src: polls, rows };
  return rows;
}

/* one day's aggregate: activity gate, anti-swamp to the two heaviest per
   house, weighted mean of corrected values. effects = {firm: pp} or null. */
function aggregateAt(prepared, tIso, effects) {
  const tMs = iso2ms(tIso);
  const cand = [];
  for (const pp of prepared) {
    if (pp.release > tIso || pp.excluded || pp.x == null) continue;
    if (B_RULE_DATES.undBan <= tIso && pp.und != null && pp.und >= 10) continue;
    if (B_RULE_DATES.onpBan <= tIso && pp.noOnp) continue;
    const aw = ageW(dataAge(pp.row, tMs, tIso));
    cand.push({ pp, aw, w: aw * accOf(pp.firm) * (pp.small ? 0.5 : 1) * (pp.noOnp ? 0.5 : 1) });
  }
  const active = cand.filter((c) => c.aw > 0.5);
  if (active.length < 3 || new Set(active.map((c) => c.pp.firm)).size < 2) return null;
  const byFirm = new Map();
  for (const c of cand) {
    const a = byFirm.get(c.pp.firm) || [];
    a.push(c); byFirm.set(c.pp.firm, a);
  }
  let sw = 0, swx = 0;
  for (const [firm, arr] of byFirm) {
    arr.sort((a, b) => b.aw - a.aw || (a.pp.release < b.pp.release ? 1 : -1));
    for (const c of arr.slice(0, 2)) {
      const x = c.pp.x - (effects ? effects[firm] || 0 : 0);
      sw += c.w; swx += c.w * x;
    }
  }
  return sw > 0 ? swx / sw : null;
}

/* house effects at t: each house's mean deviation (its polls' conversions
   minus the UNCORRECTED smoothed aggregate at their release days), kept
   only past the half-point bar and with enough polls to see it */
function effectsAt(prepared, tIso, rawSmoothByIso) {
  const devs = new Map();
  for (const pp of prepared) {
    if (pp.release > tIso || pp.excluded || pp.x == null) continue;
    if (tIso >= B_RULE_DATES.undBan && pp.und != null && pp.und >= 10) continue;
    if (tIso >= B_RULE_DATES.onpBan && pp.noOnp) continue;
    const agg = rawSmoothByIso.get(pp.release);
    if (agg == null) continue;
    const a = devs.get(pp.firm) || { s: 0, n: 0 };
    a.s += pp.x - agg; a.n += 1; devs.set(pp.firm, a);
  }
  const out = {};
  for (const [firm, d] of devs) {
    if (d.n < HE_MIN_POLLS) continue;
    const m = d.s / d.n;
    if (Math.abs(m) >= HE_MIN) out[firm] = m;
  }
  return out;
}

/* The full run: daily raw values from the first active day to endIso
   (inclusive), frozen spans interpolated as he does, then the 7-day
   smoothed series he quotes. Returns { start, end, daily: [{iso, raw,
   sm}], effects, meta } – daily entries absent before the aggregate
   first wakes. */
export function bonhamReplica(polls, endIso) {
  const prepared = poolsPrep(polls);
  const firstRelease = prepared.length ? prepared[0].release : null;
  if (!firstRelease) return { start: null, end: endIso, daily: [], effects: {}, meta: { note: "no in-scope polls" } };
  const isoDays = [];
  for (let ms = iso2ms(firstRelease), end = iso2ms(endIso); ms <= end; ms += DAY) isoDays.push(d2iso(ms));
  /* pass 0: no house effects – his deviations are measured against the
     running uncorrected aggregate (frozen spans filled, 7-day smoothed,
     as displayed) at each poll's own release day */
  const raw0 = isoDays.map((iso) => aggregateAt(prepared, iso, null));
  const sm0 = movAvgSeries(freezeFill(raw0));
  const smoothByIso = new Map(isoDays.map((iso, i) => [iso, sm0[i]]));
  /* pass 1: apply each house's term-to-date deviation past the half-point bar */
  let effectsNow = {};
  const raw1 = isoDays.map((iso) => {
    effectsNow = effectsAt(prepared, iso, smoothByIso);
    return aggregateAt(prepared, iso, effectsNow);
  });
  const filled1 = freezeFill(raw1);
  const sm = movAvgSeries(filled1);
  const all = isoDays.map((iso, i) => ({ iso, raw: filled1[i] == null ? null : r1(filled1[i]), sm: sm[i] == null ? null : r1(sm[i]) }));
  const firstIdx = all.findIndex((d) => d.sm != null);
  const daily = firstIdx > 0 ? all.slice(firstIdx) : all;
  const raws = daily.map((d) => d.raw).filter((v) => v != null);
  return {
    start: daily.length ? daily[0].iso : null,
    end: endIso,
    daily,
    effects: effectsNow,
    meta: {
      rawMax: raws.length ? Math.max(...raws) : null,
      rawMin: raws.length ? Math.min(...raws) : null,
      included: prepared.filter((p) => !p.excluded).length,
      excluded: prepared.filter((p) => p.excluded).length,
    },
  };
}

function movAvgSeries(raw, win = 7) {
  const out = new Array(raw.length).fill(null);
  let sum = 0, k = 0;
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] != null) { sum += raw[i]; k++; }
    if (i - win >= 0 && raw[i - win] != null) { sum -= raw[i - win]; k--; }
    if (i >= win - 1 && k > 0) out[i] = sum / k;
  }
  return out;
}
/* his freeze rule: while the gate is off the aggregate sits at its last
   value, and the frozen span is interpolated once it wakes */
function freezeFill(raw) {
  const out = raw.slice();
  let last = null, lastI = -1;
  for (let i = 0; i < out.length; i++) {
    if (out[i] != null) {
      if (last != null && i - lastI > 1)
        for (let j = lastI + 1; j < i; j++) out[j] = last + ((out[i] - last) * (j - lastI)) / (i - lastI);
      last = out[i]; lastI = i;
    }
  }
  return out;
}
