/* gen-data.mjs — extract REAL data from auspol-polling.html and emit the
   dataset asset for "NEW Auspol Tracker (Standalone).html" (window.AUSPOL).
   Methodology matches the established aggregate (see transform.mjs):
   2PP = sample- & recency-weighted, house-effect-adjusted mean; primaries =
   monthly means; leadership = monthly means of published readings, with the
   opposition slot spliced Ley → Taylor (handover 13 Feb 2026).
   Run: node .build/newtracker/gen-data.mjs */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const D = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "polls.json"), "utf8"));
const DATA_ASSET = path.join(HERE, "assets", "9f09dca2-bd46-49a8-8ae1-51847608cf92.js");

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
// wave (a two-way alongside a three-way, etc.) — different measures, kept whole
// 8th element (optional) = published splits {app,dis} per leader

/* ---- approval vs favourability — different questions, never blended ----
   Mirrors the source file's LEADER_NET_METRIC (keyed by canonical firm):
   Redbridge, DemosAU and Freshwater publish net FAVOURABILITY (positive −
   negative); everyone else publishes net APPROVAL (approve − disapprove). */
// metric is per-(firm, leader): a firm can ask APPROVAL of some leaders and
// FAVOURABILITY of others in the SAME poll (Resolve rates the majors on
// approval — its "good/poor job" is an approval measure — but Hanson on
// likeability = favourability). Performance ≡ approval; likeability ≡ fav.
// fav for every leader. Spectre added Jul 2026: its release labels the question
// favourable / unfavourable, not approve / disapprove.
const FAV_FIRMS = new Set(D.metricRules.favFirms);
/* Per (firm|leaderKey), and DATE-BOUNDED — what a house asks about a leader can
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
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const meanOf = (rows, f) => { const v = rows.map(f).filter((x) => x != null); return v.length ? mean(v) : null; };

const ELECTION = ELECTIONS.e2025;                       // 3 May 2025 baseline
const LATEST_ISO = POLLS.reduce((m, p) => (p.date > m ? p.date : m), "0000");

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
const midMs = (p) => (new Date(p.dateStart || p.date).getTime() + new Date(p.date).getTime()) / 2;
const share2pp = (p) => (p.tpp_lnp != null && p.tpp_alp + p.tpp_lnp > 0) ? (p.tpp_alp / (p.tpp_alp + p.tpp_lnp)) * 100 : p.tpp_alp;
const ddays = (a, b) => (a - b) / 86400000;
const HL_WINDOW = 21, HL_HALF = 7;
const tppRows = POLLS.filter((p) => p.tpp_alp != null).map((p) => ({ ym: ymOf(p.date), mid: midMs(p), x: share2pp(p), n: Math.min(p.sample || 1200, SAMPLE_CAP), firm: p.pollster }));

/* A house effect is that pollster's mean deviation from the cross-house
   consensus ON THAT MEASURE — never borrowed between measures, because a firm
   that leans Labor on the classic 2PP has no reason to lean the same way on an
   ALP-v-ON head-to-head or on a primary share. Shrunk toward zero by SHRINK_K
   so a house with one or two readings barely moves. Returns {} when nothing is
   estimable (a measure only two houses ask), which makes the caller fall back
   to a plain mean rather than a fabricated adjustment. */
function houseEffectsFor(rows) {
  const err = new Map();
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
    if (!err.has(a.firm)) err.set(a.firm, []);
    err.get(a.firm).push(a.x - swx / sw);
  }
  const he = {};
  // {v, n}: n is how many of that firm's readings fed the estimate, so the UI
  // can distinguish "no lean" from "not enough polls to say"
  for (const [firm, e] of err) he[firm] = { v: r1((e.length / (e.length + SHRINK_K)) * mean(e)), n: e.length };
  return he;
}
const heV = (he, firm) => (he[firm] ? he[firm].v : 0);
const houseEffectsStrat = houseEffectsFor;   // same estimator; rows carry `strat`
const OPP_SPLICE_ISO = "2026-02-13";         // Taylor replaces Ley — a different person
// sample-weighted, house-effect-adjusted monthly mean of a row set
function monthlyAdj(rows, he) {
  return MONTHS.map((ym) => {
    const rs = rows.filter((r) => r.ym === ym);
    if (!rs.length) return null;
    let sw = 0, swx = 0;
    for (const r of rs) { sw += r.n; swx += r.n * (r.x - heV(he, r.firm)); }
    return { ym, x: mx(ym), v: swx / sw, k: rs.length };
  }).filter(Boolean);
}
// trailing recency-weighted nowcast (same window/half-life as the headline 2PP)
/* Design effect for a live national sample — the same 1.6 the discord engine
   uses for its sampling-error floor, so the two agree. */
const HL_DEFF = 1.6;

/* Weighted nowcast over the trailing window, WITH its uncertainty. Two
   estimates, larger wins:
     seSpread — how far the polls in the window disagree about the weighted
                mean. Var(mean) = sigma^2/nEff with nEff = Kish's effective
                count; the weighted DOF correction reduces it to
                sqrt(wVar / (nEff - 1)).
     seFloor  — what sampling error alone would give even if every house
                agreed exactly. Carries the estimate when nEff <= 1.
   seSpread already contains sampling noise, house residue and real movement
   inside the window, so it is usually the binding one. Neither can see error
   shared across the whole industry — no aggregate can measure that about
   itself, which is why the copy says so rather than implying otherwise. */
function nowcastAdj(rows, he, ref) {
  let sw = 0, sw2 = 0, swx = 0, n = 0;
  const pts = [];
  for (const a of rows) {
    const d = ddays(ref, a.mid);
    if (d < 0 || d > HL_WINDOW) continue;
    const w = a.n * Math.exp(-LN2 * d / HL_HALF);
    const x = a.x - heV(he, a.firm);
    sw += w; sw2 += w * w; swx += w * x; n++;
    pts.push({ w, x, n: a.n });
  }
  if (!sw) return null;
  const mean = swx / sw;
  const nEff = (sw * sw) / sw2;
  const wVar = pts.reduce((t, p) => t + p.w * (p.x - mean) ** 2, 0) / sw;
  const seSpread = nEff > 1 ? Math.sqrt(wVar / (nEff - 1)) : Infinity;
  const pq = (mean / 100) * (1 - mean / 100) * 1e4;             // percentage points
  const seFloor = Math.sqrt(pts.reduce((t, p) => t + p.w * p.w * HL_DEFF * pq / p.n, 0)) / sw;
  const se = Math.max(Number.isFinite(seSpread) ? seSpread : 0, seFloor);
  return { v: r1(mean), n, se: Math.round(se * 100) / 100, nEff: r1(nEff), ci95: r1(1.96 * se) };
}

const houseEffect = houseEffectsFor(tppRows);
const hOf = (firm) => heV(houseEffect, firm);

/* ---- 1. monthly 2PP (weighted, debiased) + election-day anchor --------- */
const agg2pp = MONTHS.map((ym) => {
  const rows = tppRows.filter((r) => r.ym === ym);
  if (!rows.length) return null;
  let sw = 0, swx = 0;
  for (const r of rows) { sw += r.n; swx += r.n * (r.x - hOf(r.firm)); }
  return { ym, x: mx(ym), alp: r1(swx / sw), lnp: r1(100 - swx / sw) };
}).filter(Boolean);
agg2pp.unshift({ ym: ymOf(ELECTION.date), x: dx(ELECTION.date), alp: ELECTION.tpp_alp, lnp: ELECTION.tpp_lnp, election: true });

/* ---- 2. monthly primary vote + election-day anchor --------------------- */
/* Primaries get the SAME treatment as the headline 2PP — sample-weighted and
   house-effect-adjusted, per party. This matters more here than on the 2PP:
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
    .map((p) => ({ ym: ymOf(p.date), mid: midMs(p), x: primaryVal(p, k), n: Math.min(p.sample || 1200, SAMPLE_CAP), firm: p.pollster }));
  primaryHE[k] = houseEffectsFor(primaryRows[k]);
}
const aggPrimary = MONTHS.map((ym) => {
  const rows = POLLS.filter((p) => ymOf(p.date) === ym);
  if (!rows.length) return null;
  const o = { ym, x: mx(ym) };
  let plainTotal = 0;
  for (const k of PRIMARY_KEYS) {
    const rs = primaryRows[k].filter((r) => r.ym === ym);
    if (!rs.length) { o[k] = 0; continue; }
    let sw = 0, swx = 0;
    for (const r of rs) { sw += r.n; swx += r.n * (r.x - heV(primaryHE[k], r.firm)); }
    o[k] = swx / sw;
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
  ym: ymOf(ELECTION.date), x: dx(ELECTION.date), election: true,
  alp: ELECTION.alp, lnp: ELECTION.lnp, grn: ELECTION.grn,
  onp: ELECTION.onp ?? 0, oth: r1(ELECTION.oth ?? 0),
});

/* ---- 3. alt head-to-head 2PP (ALP v ON, L/NP v ON) --------------------- */
/* The ON head-to-heads are published figures, so they get the same weighted,
   debiased treatment as the classic 2PP WHEREVER it's estimable. It is for
   ALP v ON (40 polls, 9 houses); it is not for L/NP v ON (5 polls, 2 houses —
   no reading has 3 neighbours, so houseEffectsFor returns {} and no poll falls
   in the nowcast window). That series therefore stays an honest plain mean and
   reports no nowcast, rather than pretending to a precision it can't support. */
const POLL_BY_KEY = new Map(POLLS.map((p) => [p.date + "|" + p.pollster, p]));
function altRowsFor(field) {
  const out = [];
  for (const [key, v] of ALT_BY.entries()) {
    if (v[field] == null) continue;
    const p = POLL_BY_KEY.get(key);
    const date = key.split("|")[0];
    out.push({ ym: ymOf(date), mid: p ? midMs(p) : new Date(date).getTime(),
               x: v[field], n: Math.min((p && p.sample) || 1200, SAMPLE_CAP), firm: key.split("|")[1] });
  }
  return out;
}
function altSeries(field) {
  const rows = altRowsFor(field);
  const he = houseEffectsFor(rows);
  const adjusted = Object.keys(he).length > 0;
  const monthly = adjusted
    ? monthlyAdj(rows, he).map((d) => ({ ym: d.ym, x: d.x, a: r1(d.v), b: r1(100 - d.v) }))
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

/* ---- 4. leadership monthly — gap-aware (no interpolation) --------------
   Rows exist only for months with at least one published leadership reading;
   a leader not polled that month carries null. The panels filter nulls, so
   lines connect real readings instead of inventing a monthly path across
   the source data's gaps (e.g. Jan–Mar 2026). */
const rnd = (v) => (v == null ? null : Math.round(v));
/* House effects on leader NET ratings. Estimated within strata — a firm's
   neighbours must share its metric (approval vs favourability are different
   questions) and, for the opposition slot, its leader era (Ley and Taylor are
   different people). Without that stratification the Feb 2026 handover and the
   metric mix would be booked as house lean.

   These are the largest house effects in the archive: Resolve runs +7.8 on the
   opposition leader where Newspoll runs −7.0, a ~15pp span. Applying them is
   defensible because a net is a difference of two proportions and so already
   scale-free — unlike preferred PM, which is deliberately NOT adjusted (see
   the note there). */
const APPR_SLOTS = [["alb", "alb"], ["opp", "opp"], ["han", "han"]];
const apprHE = {};
for (const [prop, lk] of APPR_SLOTS) {
  const rows = appr.filter((p) => p[prop] != null).map((p) => ({
    firm: p.firm, mid: midMs({ date: p.date }), n: Math.min((POLL_BY_KEY.get(p.date + "|" + p.firm) || {}).sample || 1200, SAMPLE_CAP),
    x: p[prop],
    strat: metricOf(p.firm, lk, p.date) + "|" + (lk === "opp" ? (p.date < OPP_SPLICE_ISO ? "ley" : "taylor") : "-"),
  }));
  apprHE[lk] = houseEffectsStrat(rows);
}

/* A preferred-PM reading as a share of those who NAMED someone, rather than of
   all respondents. The denominator is that poll's own contest, so a two-way is
   divided by two names and a three-way by three — which is what makes houses
   with very different "uncommitted" shares (16% to 50% here) comparable at all. */
const prefShare = (p, k) => {
  const den = (p.alb || 0) + (p.opp || 0) + (p.han || 0);
  return den > 0 && p[k] != null ? (p[k] / den) * 100 : null;
};

const leaderMonths = MONTHS.map((ym) => {
  const pp = ppm.filter((p) => ymOf(p.date) === ym);
  const rows = appr.filter((p) => ymOf(p.date) === ym);
  if (!pp.length && !rows.length) return null;
  // approval and favourability are different questions — routed PER LEADER by
  // that leader's metric at the firm, never pooled into one mean
  const split = (prop, lk) => {
    const ap = [], fv = [];
    const deb = (p, v) => v - heV(apprHE[lk] || {}, p.firm);   // debias on this leader's own house effects
    rows.forEach((p) => {
      if (p[prop] != null) (metricOf(p.firm, lk, p.date) === "fav" ? fv : ap).push(deb(p, p[prop]));
      // a firm that published BOTH measures contributes its second reading to
      // the other line, rather than having it quietly dropped
      const alt = p.splits && p.splits.fav ? p.splits.fav[lk] : null;
      if (alt != null && metricOf(p.firm, lk, p.date) !== "fav") fv.push(deb(p, alt));
    });
    return { net: ap.length ? rnd(mean(ap)) : null, fav: fv.length ? rnd(mean(fv)) : null };
  };
  const A = split("alb", "alb"), O = split("opp", "opp"), H = split("han", "han");
  return {
    ym, x: mx(ym),
    /* Preferred PM is deliberately NOT house-effect-adjusted. Its apparent
       house effects are large (Newspoll +4.1 on Albanese, Resolve −4.6) but
       they are SAME-SIGNED across both leaders in 7 of 8 houses — a house that
       runs Albanese high runs the opposition leader high too. That is the
       signature of a format difference, not partisan lean: Resolve leaves ~35%
       uncommitted where Newspoll leaves ~16%, so every share it reports is
       lower. Subtracting a constant would shift the level without restoring
       comparability; the correct fix for that is normalising to the decided
       share, which changes what the number MEANS and so isn't done silently.
       So it is offered as a SECOND series (…_prefN) behind a labelled toggle,
       never as a replacement: _pref stays exactly what pollsters published.
       Note the normalised view removes the undecided-share difference but NOT
       the contest-size one — a leader's share among the decided is naturally
       lower in a three-way than a two-way. */
    alb_pref: rnd(meanOf(pp, (p) => p.alb)), taylor_pref: rnd(meanOf(pp, (p) => p.opp)), hanson_pref: rnd(meanOf(pp, (p) => p.han)),
    alb_prefN: rnd(meanOf(pp, (p) => prefShare(p, "alb"))),
    taylor_prefN: rnd(meanOf(pp, (p) => prefShare(p, "opp"))),
    hanson_prefN: rnd(meanOf(pp, (p) => prefShare(p, "han"))),
    alb_net: A.net, taylor_net: O.net, hanson_net: H.net,
    alb_fav: A.fav, taylor_fav: O.fav, hanson_fav: H.fav,
  };
}).filter(Boolean);

/* ---- 5. national direction — right track / wrong track ------------------
   Given the SAME treatment as the 2PP and the primaries: sample-weighted,
   house-effect-adjusted monthly means. The houses asking this question are
   not the ones publishing a 2PP, and they don't all poll every month, so a
   plain mean would step with WHO polled rather than with what people think.
   (The raw spread between Roy Morgan and Essential looks enormous, but most
   of it is the trend, not the house: measured against a local consensus the
   two sit ~1.5pp apart — which is exactly why this is estimated rather than
   eyeballed.)
   `unsure` is taken as the remainder so the three shares always total 100
   and the readout bar can't leave a gap. */
const DIR = D.direction || [];
const dirSample = (d) => {
  const p = POLL_BY_KEY.get(d.date + "|" + d.pollster);
  return Math.min((p && p.sample) || 1200, SAMPLE_CAP);
};
const dirRows = (field) => DIR.filter((d) => d[field] != null).map((d) => ({
  ym: ymOf(d.date), mid: midMs(d), x: d[field], n: dirSample(d), firm: d.pollster,
}));
const dirHe = { right: houseEffectsFor(dirRows("right")), wrong: houseEffectsFor(dirRows("wrong")) };
// Who actually asks this question, most-active first — derived rather than
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
// have no poll row to hang on — plotting only the joined ones would quietly
// drop them from a chart that DOES average them.
// Field names match what the chart tooltip reads off a scatter point
// (pollster / dateLabel / sample), so a direction dot identifies its poll the
// same way a 2PP or primary dot does. Sample is joined from the voting-intention
// poll where there is one — the few direction-only waves simply have none.
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
   voting intention have no row to key onto — the archive's row set is polls
   that measured voting intention — so those show up only in the series. */
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

const direction = dirRight.map((m) => {
  const w = dirWrongBy.get(m.ym);
  if (!w) return null;
  const right = r1(m.v), wrong = r1(w.v);
  return { ym: m.ym, x: m.x, right, wrong, unsure: r1(100 - right - wrong),
           net: r1(right - wrong), n: m.k };
}).filter(Boolean);

/* ---- per-poll leadership / alt builders -------------------------------- */
const oppKey = (name) => (name === "Ley" ? "ley" : "taylor");
function buildPpm(date, firm) {
  const k = date + "|" + firm, p = PPM_BY.get(k);
  if (!p) return {};
  // every preferred-PM contest this poll published, as its own set — the main
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
    // per-leader metric — a poll can be approval for some, favourability for others
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
// normalised ALP 2PP share (pairs that don't sum to 100 — e.g. an
// undecided-inclusive 48/47 — are rescaled) for scatter / lean maths
const alpNOf = (p) => (p.tpp_alp == null ? null : r1(share2pp(p)));

/* ---- 5b. change indicators — each measure vs the SAME pollster's previous
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
  albNet:    (p, a, pm) => (a ? a.alb ?? null : null),
  taylorNet: (p, a, pm) => (a ? a.opp ?? null : null),
  hansonNet: (p, a, pm) => (a ? a.han ?? null : null),
  // the One Nation head-to-head 2PPs, each tracked as its own measure so the
  // 2nd/3rd matchups get their own change vs the pollster's last publication
  altAlpOn:  (p, a, pm, alt) => (alt ? alt.ao ?? null : null),
  altLnpOn:  (p, a, pm, alt) => (alt ? alt.lo ?? null : null),
  // preferred PM — the MAIN contest only (extra matchups aren't comparable)
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

/* ---- 6. individual polls (full archive) -------------------------------- */
const individualPolls = POLLS.map((p) => {
  const ym = ymOf(p.date), day = dayOf(p.date);
  const field = fwLabel(p.dateStart, p.date);
  return {
    ym, x: mx(ym) + (day - 15) / 365, day, pollster: p.pollster,
    field, dateLabel: field, released: p.date, sample: p.sample ?? null,
    alp: p.tpp_alp ?? null, lnp: p.tpp_lnp ?? null, alpN: alpNOf(p),
    p: primaryOf(p), ...buildAlt(p.date, p.pollster), ...buildPpm(p.date, p.pollster),
    appr: buildAppr(p.date, p.pollster), chg: chgByKey[p.date + "|" + p.pollster],
    // link back to the published release/report this row came from (the
    // citation Wikipedia carries for it). Omitted where no source is cited,
    // so the views can fall back to plain text.
    ...(p.url ? { url: p.url } : {}),
    // right-track / wrong-track, where this poll asked it
    ...(DIR_BY.has(p.date + "|" + p.pollster) ? { dir: DIR_BY.get(p.date + "|" + p.pollster) } : {}),
    // seat projections — MRPs only. Carried verbatim; their change basis is the
    // last ELECTION, not the pollster's previous poll, so it travels with the
    // data rather than being inferred by the views.
    ...(p.seats ? { seats: p.seats } : {}),
  };
}).sort((a, b) => a.x - b.x || a.released.localeCompare(b.released));

/* ---- 7. latest polls — most recent reading per house (last 3 weeks) ---- */
const canon = (n) => n.replace(/\s*\(.*?\)\s*/g, "").replace(/\s*\/\s*Accent.*$/i, "").trim();
const cutoff = new Date(LATEST_ISO); cutoff.setDate(cutoff.getDate() - 21);
const recent = POLLS.filter((p) => new Date(p.date) >= cutoff);
const perHouse = new Map();
for (const p of recent.sort((a, b) => a.date.localeCompare(b.date))) perHouse.set(canon(p.pollster), p);
const pollsterTable = [...perHouse.values()].map((p) => {
  const m = Number(p.date.slice(5, 7)), day = dayOf(p.date);
  return {
    pollster: p.pollster, client: p.client && p.client !== "—" ? p.client : "Self-published",
    field: fwLabel(p.dateStart, p.date), released: p.date, releasedLabel: `${day} ${monthName(m)}`,
    sample: p.sample ?? null,
    alp2pp: p.tpp_alp ?? null, lnp2pp: p.tpp_lnp ?? null,
    p: primaryOf(p), ...buildAlt(p.date, p.pollster), ...buildPpm(p.date, p.pollster),
    appr: buildAppr(p.date, p.pollster), chg: chgByKey[p.date + "|" + p.pollster],
    ...(p.url ? { url: p.url } : {}),
    ...(DIR_BY.has(p.date + "|" + p.pollster) ? { dir: DIR_BY.get(p.date + "|" + p.pollster) } : {}),
  };
}).sort((a, b) => b.released.localeCompare(a.released));

/* ---- 7b. headline 2PP — trailing 21d, 7d half-life, debiased ----------- */
const headlineTpp = (ref) => {
  const r = nowcastAdj(tppRows, houseEffect, ref);
  return r ? { alp: r.v, n: r.n, se: r.se, nEff: r.nEff, ci95: r.ci95 } : null;
};
const refNow = new Date(LATEST_ISO).getTime();
const hlNow = headlineTpp(refNow) || { alp: agg2pp[agg2pp.length - 1].alp, n: 0 };
const hl1mo = headlineTpp(refNow - 30 * 86400000);

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
const houses = new Set(POLLS.map((p) => p.pollster));
const fmtDate = (iso) => { const [y, m, d] = iso.split("-").map(Number); return `${d} ${MNF[m - 1]} ${y}`; };
const latest = {
  alp2pp: hlNow.alp, lnp2pp: r1(100 - hlNow.alp),
  alp2ppPrev: hl1mo ? hl1mo.alp : agg2pp[agg2pp.length - 2].alp,
  /* Uncertainty on the headline, and on the month-on-month change. The change
     is a difference of two independent windows (21d apart, no shared polls),
     so its SE is the root-sum-square. changeSig says whether the movement
     clears its own 95% interval — the arrow is qualified when it doesn't. */
  alp2ppSe: hlNow.se ?? null,
  alp2ppCi95: hlNow.ci95 ?? null,
  alp2ppNEff: hlNow.nEff ?? null,
  ...(hl1mo && hlNow.se != null ? (() => {
    const seChg = Math.sqrt(hlNow.se ** 2 + hl1mo.se ** 2);
    const chg = hlNow.alp - hl1mo.alp;
    return { changeSe: r1(seChg), changeCi95: r1(1.96 * seChg), changeSig: Math.abs(chg) > 1.96 * seChg };
  })() : {}),
  updated: fmtDate(LATEST_ISO), updatedISO: LATEST_ISO,
  nextElectionDue: "By May 2028", pollsTracked: individualPolls.length, housesTracked: houses.size,
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
  // at +40 from the 2019 election when that is his April-2020 COVID rally and
  // no leader approval was published for the first eleven months of the term.
  // Leave them null so the line starts where the polling does.
  const firstKnown = Math.min(...Object.keys(known).map(Number));
  return { months: idxs, vals: idxs.map((i) => (i < firstKnown ? null : r1(filled[i]))) };
}
const CYC_META = [
  { year: 2010, gov: "alp", opp: "lnp", pm: "Gillard", lead: "Gillard", oppLead: "Abbott", eDate: "2010-08-21", ePrim: 38.0, eTpp: 50.1, src: 2013, appr: 2010 },
  { year: 2013, gov: "lnp", opp: "alp", pm: "Abbott → Turnbull", lead: "Abbott", oppLead: "Shorten", eDate: "2013-09-07", ePrim: 45.6, eTpp: 53.5, src: 2016, appr: 2013 },
  { year: 2016, gov: "lnp", opp: "alp", pm: "Turnbull → Morrison", lead: "Turnbull", oppLead: "Shorten", eDate: "2016-07-02", ePrim: 42.0, eTpp: 50.4, src: 2019, appr: 2016 },
  { year: 2019, gov: "lnp", opp: "alp", pm: "Morrison", lead: "Morrison", oppLead: "Shorten → Albanese", eDate: "2019-05-18", ePrim: 41.44, eTpp: 51.53, src: 2022, appr: 2019 },
  { year: 2022, gov: "alp", opp: "lnp", pm: "Albanese", lead: "Albanese", oppLead: "Dutton", eDate: "2022-05-21", ePrim: 32.6, eTpp: 52.1, src: 2025, appr: 2022 },
  { year: 2025, gov: "alp", opp: "lnp", pm: "Albanese", lead: "Albanese", oppLead: "Ley → Taylor", current: true, eDate: "2025-05-03", ePrim: 34.6, eTpp: 55.2 },
];
const CYCLE_DEFS = CYC_META.map((c) => {
  let primPts, tppPts, netPts, oppPts;
  if (c.current) {
    primPts = aggPrimary.map((d) => ({ m: monthsSince(d.ym + "-15", c.eDate), v: d.alp }));
    tppPts = agg2pp.map((d) => ({ m: monthsSince(d.ym + "-15", c.eDate), v: d.alp }));
    // approval-metric readings only — the historical cycle series are
    // approve−disapprove, so favourability rows would contaminate them
    const apprOnly = appr.filter((a) => metricOf(a.firm, "alb") !== "fav");   // PM approval only, not favourability
    netPts = apprOnly.map((a) => ({ m: monthsSince(a.date, c.eDate), v: a.alb }));
    oppPts = apprOnly.map((a) => ({ m: monthsSince(a.date, c.eDate), v: a.opp }));
  } else {
    const ps = cyclePolls[c.src], as = cycleAppr[c.appr];
    primPts = ps.map((p) => ({ m: monthsSince(p.date, c.eDate), v: p[c.gov] }));
    tppPts = ps.map((p) => ({ m: monthsSince(p.date, c.eDate), v: p["tpp_" + c.gov] }));
    // same rule as the current cycle: these lines are approve−disapprove, so a
    // favourability net never enters them. Historical rows may name the metric
    // in a 5th element; otherwise the firm decides. Matters most for the 2022
    // cycle, where Freshwater and RedBridge report favourability.
    const apprRows = as.filter((r) => (r.metric || metricOf(r.firm, "alb")) !== "fav");
    netPts = apprRows.map((r) => ({ m: monthsSince(r.date, c.eDate), v: r.pmNet }));
    oppPts = apprRows.map((r) => ({ m: monthsSince(r.date, c.eDate), v: r.oppNet }));
  }
  const cap = c.current ? Math.max(1, Math.round(monthsSince(LATEST_ISO, c.eDate))) : 36;
  const prim = cycleSeries(primPts, c.ePrim, cap);
  const tpp = cycleSeries(tppPts, c.eTpp, cap);
  const net = cycleSeries(netPts, null, cap);
  const opp = cycleSeries(oppPts, null, cap);
  const months = prim.months;
  // trailing months beyond a measure's range hold its last value; leading
  // nulls stay null (see cycleSeries)
  const align = (s) => months.map((m) => {
    const i = s.months.indexOf(m);
    if (i >= 0) return s.vals[i];
    return m < s.months[0] ? null : s.vals[s.vals.length - 1];
  });
  return {
    year: c.year, gov: c.gov, opp: c.opp, pm: c.pm, lead: c.lead, oppLead: c.oppLead, current: !!c.current,
    eDate: c.eDate,
    months, primary: prim.vals, tpp: tpp.vals, net: align(net), oppnet: align(opp),
  };
});

/* ---- publication cadence, for "next expected polls" ---------------------
   Two quantities per house, both measured rather than assumed:

   cadence — the median gap between its own consecutive fieldwork-end dates
     over the last 8 waves. The regulars are extremely regular: Roy Morgan's
     last eight gaps are 7,7,7,7,7,7,7,7 and YouGov's are 14 except one 13.

   lag — days from fieldwork close to publication, read out of the release URLs
     that carry their own date (roymorgan.com/findings/...-august-17-2026,
     essentialreport.com.au/reports/25-march-2026). 38 Roy Morgan releases give
     a median of 1 day, range 0-2, which is where the global default comes from.
     Houses whose URLs carry no date fall back to that default.

   Only houses on a genuine cadence are published: at least 4 waves, a spread
   small relative to the interval (MAD/median <= 0.35), and still active. A
   house that has broken its own pattern is not "expected" and is left out
   rather than given a made-up date. */
const CAD_DEFAULT_LAG = 1;
const CAD_MIN_POLLS = 4;
const CAD_MAX_REL_MAD = 0.35;
/* Two further gates, both learned the hard way from Fox & Hedgehog, which
   sailed through the first version: 86 days silent on a 44-day cycle, and a
   window of ±15 days — and it still sorted ABOVE metronomic Roy Morgan,
   because a wide window can centre on an early date. So:
     ACTIVE — a house must be inside 1.5 of its own intervals, not 2. Past
       that it has stopped, and "expected" is the wrong word for it.
     USABLE — the window must be tight relative to the interval. "Some time
       in a 30-day range" is not a forecast, and printing one next to a house
       that really is weekly devalues both. */
const CAD_MAX_SILENT = 1.5;
const CAD_MAX_REL_SPREAD = 0.30;
const MONTH_NAMES_L = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
                        july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 };
const medianOf = (a) => {
  const v = [...a].sort((x, y) => x - y);
  if (!v.length) return null;
  return v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2;
};

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

const lagSamples = {};
for (const p of POLLS) {
  const pub = pubDateFromUrl(p.url);
  if (!pub) continue;
  const d = Math.round((Date.parse(pub) - Date.parse(p.date)) / 86400000);
  // a shared or rolling release URL (Roy Morgan covers 3 waves in one post,
  // Essential cites a report index) produces a nonsense gap — drop those
  if (d < 0 || d > 30) continue;
  (lagSamples[p.pollster] ||= []).push(d);
}

const byHouse = {};
for (const p of POLLS) (byHouse[p.pollster] ||= []).push(p.date);
const pollCadence = [];
for (const [firm, dates] of Object.entries(byHouse)) {
  dates.sort();
  if (dates.length < CAD_MIN_POLLS) continue;
  const gaps = dates.slice(1).map((d, i) => Math.round((Date.parse(d) - Date.parse(dates[i])) / 86400000)).slice(-8);
  const cadence = medianOf(gaps);
  if (!cadence || cadence <= 0) continue;
  const mad = medianOf(gaps.map((g) => Math.abs(g - cadence)));
  if (mad / cadence > CAD_MAX_REL_MAD) continue;                       // not on a pattern
  const last = dates[dates.length - 1];
  if ((Date.parse(LATEST_ISO) - Date.parse(last)) / 86400000 > CAD_MAX_SILENT * cadence) continue;
  const spread = Math.max(1, Math.round(1.4826 * mad));
  if (spread / cadence > CAD_MAX_REL_SPREAD) continue;                 // window too loose to be a forecast
  const ls = lagSamples[firm] || [];
  pollCadence.push({
    pollster: firm,
    last,
    cadence,
    // MAD -> robust SD, floored at 1 day: even Roy Morgan's perfect 7-day
    // cadence still moves a day either side on publication
    spread,
    lag: ls.length >= 5 ? medianOf(ls) : CAD_DEFAULT_LAG,
    lagMeasured: ls.length >= 5 ? ls.length : 0,
    waves: dates.length,
  });
}
pollCadence.sort((a, b) => a.cadence - b.cadence);

/* ---- per-cycle source rows, for the Past-cycles download ----------------
   The charts are monthly aggregates; these are the individual readings behind
   them, so the aggregation can actually be checked. Keyed by CYCLE year (the
   election that STARTED the term, i.e. what the legend calls it) — cyclePolls
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
    })),
  };
}

/* ---- emit the dataset asset -------------------------------------------- */
const out = `/* auspol tracker — REAL Australian federal polling data.
   Generated from data/polls.json by .build/newtracker/gen-data.mjs — do
   not edit by hand.  Spine: 2025 federal election (3 May 2025) → ${latest.updated}.
   2PP aggregate: sample- & recency-weighted, house-effect-adjusted mean.
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
  // nowcast per alternative matchup — null where the series is too thin
  const altLatest = ${JSON.stringify(altLatest)};
  // which measures carry a house-effect adjustment (drives the method labels)
  const adjusted = ${JSON.stringify({ tpp: true, primary: true, alp_on: altAON.adjusted, lnp_on: altLON.adjusted, ppm: false, appr: true })};
  /* Per-measure house effects, {firm: {v, n}}. v = pp that firm runs above the
     cross-house consensus on THAT measure; n = readings behind the estimate.
     A firm absent from a map has too few readings to estimate — which the UI
     must show as "—", never as 0. */
  const houseEffects = ${JSON.stringify({ tpp: houseEffect, primary: primaryHE, alp_on: altAON.he, appr: apprHE })};
  const leaderMonths = ${JSON.stringify(leaderMonths)};
  const direction = ${JSON.stringify(direction)};
  const directionHouseEffects = ${JSON.stringify({ right: dirHe.right, wrong: dirHe.wrong })};
  const directionHouses = ${JSON.stringify(directionHouses)};
  const directionPolls = ${JSON.stringify(directionPolls)};
  const directionAvailable = ${direction.length > 0};
  const individualPolls = ${JSON.stringify(individualPolls)};
  const pollsterTable = ${JSON.stringify(pollsterTable)};
  const latest = ${JSON.stringify(latest)};
  const events = ${JSON.stringify(events)};

  const CYCLE_DEFS = ${JSON.stringify(CYCLE_DEFS)};
  /* Individual readings behind each past cycle's lines — powers the Past-cycles
     download, so the charts are checkable rather than just assertions. */
  const cycleSource = ${JSON.stringify(cycleSource)};
  /* Measured publication rhythm per house — drives "Next expected polls".
     The dates themselves are computed in the browser against the real current
     date, so the panel stays honest as the page ages. */
  const pollCadence = ${JSON.stringify(pollCadence)};
  const cycles = CYCLE_DEFS.map((c) => ({
    year: c.year, gov: c.gov, opp: c.opp, pm: c.pm, lead: c.lead, oppLead: c.oppLead, current: c.current,
    eDate: c.eDate,
    color: PARTIES[c.gov].color, span: c.months[c.months.length - 1],
    base: { tpp: c.tpp[0], primary: c.primary[0], net: c.net[0], oppnet: c.oppnet[0] },
    end: { tpp: c.tpp[c.tpp.length - 1], primary: c.primary[c.primary.length - 1], net: c.net[c.net.length - 1], oppnet: c.oppnet[c.oppnet.length - 1] },
    points: {
      tpp: c.months.map((m, i) => ({ x: m, y: c.tpp[i] })),
      primary: c.months.map((m, i) => ({ x: m, y: c.primary[i] })),
      net: c.months.map((m, i) => ({ x: m, y: c.net[i] })),
      oppnet: c.months.map((m, i) => ({ x: m, y: c.oppnet[i] })),
    },
    raw: { tpp: c.tpp, primary: c.primary, net: c.net, oppnet: c.oppnet, months: c.months },
  }));

  return {
    PARTIES, MONTHS, mx, monthName, monthNameFull,
    agg2pp, aggPrimary, LEADERS, leaderMonths, alt2pp, altLatest, adjusted, houseEffects, direction, directionAvailable, directionHouseEffects, directionHouses, directionPolls,
    individualPolls, pollsterTable, latest, cycles, events,
    cycleSource, pollCadence,
    domain: { x0: mx(MONTHS[0]) - 0.06, x1: mx(MONTHS[MONTHS.length - 1]) + 0.04 },
  };
})();
`;
fs.writeFileSync(DATA_ASSET, out);

/* ---- sanity summary ---------------------------------------------------- */
console.log("MONTHS:", MONTHS.length, MONTHS[0], "→", MONTHS[MONTHS.length - 1]);
console.log("agg2pp:", agg2pp.length, "pts | first:", agg2pp[0], "| last:", agg2pp[agg2pp.length - 1]);
console.log("aggPrimary last:", aggPrimary[aggPrimary.length - 1]);
console.log("alt2pp alp_on:", alt2pp.alp_on.length, "pts (last", alt2pp.alp_on.at(-1)?.ym, ") | lnp_on:", alt2pp.lnp_on.length, "pts (last", alt2pp.lnp_on.at(-1)?.ym, ")");
console.log("leaderMonths:", leaderMonths.length, "rows:", leaderMonths.map((r) => r.ym).join(","));
console.log("  last:", JSON.stringify(leaderMonths[leaderMonths.length - 1]));
console.log("  pref ranges alb/tay/han:", ["alb", "taylor", "hanson"].map((k) => { const v = leaderMonths.map((r) => r[k + "_pref"]).filter((x) => x != null); return v.length ? Math.min(...v) + ".." + Math.max(...v) : "none"; }).join(" | "));
console.log("  net ranges alb/tay/han:", ["alb", "taylor", "hanson"].map((k) => { const v = leaderMonths.map((r) => r[k + "_net"]).filter((x) => x != null); return v.length ? Math.min(...v) + ".." + Math.max(...v) : "none"; }).join(" | "));
console.log("  fav ranges alb/tay/han:", ["alb", "taylor", "hanson"].map((k) => { const v = leaderMonths.map((r) => r[k + "_fav"]).filter((x) => x != null); return v.length ? Math.min(...v) + ".." + Math.max(...v) : "none"; }).join(" | "));
console.log("  fav months:", leaderMonths.filter((r) => r.alb_fav != null || r.taylor_fav != null || r.hanson_fav != null).map((r) => r.ym).join(","));
console.log("  approval months:", leaderMonths.filter((r) => r.alb_net != null).map((r) => r.ym).join(","));
console.log("individualPolls:", individualPolls.length, "| no 2PP:", individualPolls.filter((p) => p.alp == null).length, "| with ppm:", individualPolls.filter((p) => p.ppm || p.ppmSets).length, "| with appr:", individualPolls.filter((p) => p.appr.albNet != null).length);
console.log("pollsterTable:", pollsterTable.length, "→", pollsterTable.map((r) => `${r.pollster} ${r.releasedLabel}${r.alp2pp == null ? " (no 2PP)" : ""}`).join(" | "));
console.log("houseEffects (2PP):", Object.entries(houseEffect).sort((a, b) => b[1].v - a[1].v).map(([f, h]) => `${f} ${h.v > 0 ? "+" : ""}${h.v}(n=${h.n})`).join(", "));
console.log("headline 2PP:", hlNow, "| 1mo ago:", hl1mo);
console.log("pollCadence:", pollCadence.length, "houses on a pattern →",
  pollCadence.map((c) => `${c.pollster} ${c.cadence}d±${c.spread} lag${c.lag}${c.lagMeasured ? "(n=" + c.lagMeasured + ")" : ""}`).join(" | "));
console.log("events:", events.length, "(major:", events.filter((e) => e.major).length + ")");
console.log("cycles:", CYCLE_DEFS.map((c) => `${c.year} m0..${c.months.at(-1)} tpp ${c.tpp[0]}→${c.tpp.at(-1)} prim ${c.primary[0]}→${c.primary.at(-1)} net ${c.net[0]}→${c.net.at(-1)} opp ${c.oppnet[0]}→${c.oppnet.at(-1)}`).join("\n        "));
console.log("cycle ranges: tpp", ...(() => { const v = CYCLE_DEFS.flatMap((c) => c.tpp); return [Math.min(...v), Math.max(...v)]; })(), "| prim", ...(() => { const v = CYCLE_DEFS.flatMap((c) => c.primary); return [Math.min(...v), Math.max(...v)]; })(), "| net", ...(() => { const v = CYCLE_DEFS.flatMap((c) => c.net); return [Math.min(...v), Math.max(...v)]; })(), "| oppnet", ...(() => { const v = CYCLE_DEFS.flatMap((c) => c.oppnet); return [Math.min(...v), Math.max(...v)]; })());
