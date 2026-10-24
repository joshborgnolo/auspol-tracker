/* validate.mjs – integrity gate over data/polls.json, run as the first step of
   every build. Replaces the old runtime console check in auspol-polling.html,
   which reported the same 7 known-good rows on every page load and had
   therefore stopped being read.

   The rule here: anything a check flags is either a real mistake (build fails)
   or a documented, deliberate exception recorded IN the data via `sumNote` /
   `tppSumNote` / pollsterRules (polls[]) or `cyclePollBases` (cycle rows).
   There is no third category, so a clean run means clean.
   Exported so build.mjs can call it; runnable on its own for a quick check. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { impliedAlp2pp, FLOW_ERAS, impliedEraAlp2pp } from "./flows.mjs";
import { canonHouse } from "./house-renames.mjs";
import { fieldTbcUrl } from "./field-tbc.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const ISO_PUBLISHED = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/;
/* A day key is not real until it round-trips through Date: "2025-02-31"
   fits ISO_DAY but parses silently onto 2 March, and gen-data's dx() then
   draws the row under a date that never happened. Every day-precision
   date below routes through this; the day+minute `published` stamps keep
   their pattern (the time part is optional) but validate their day part. */
const validISO = (s) => {
  if (typeof s !== "string" || !ISO_DAY.test(s)) return false;
  const t = Date.parse(s);
  return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === s;
};
// ~1 day of grace: an 8pm UTC build should not fail a poll dated the
// Australian morning that follows its UTC day.
const TOMORROW = new Date(Date.now() + 24 * 3600e3).toISOString().slice(0, 10);

export function validate(D) {
  const errors = [], exempted = [];
  const rules = D.pollsterRules || {};
  const CORE = ["alp", "lnp", "grn", "onp"];
  const ALL = ["alp", "lnp", "grn", "onp", "ind", "oth"];
  // era rows (tppEra-tagged, pre-1987 Morgan import) itemise Democrats/DLP
  // on the row; they join the Σ (null → 0 elsewhere) and carry a tighter
  // plausible bound than the 0–70 majors lane
  const ERA_MINORS = ["dem", "dlp"];
  const RANGES = [["tpp_alp", 30, 70], ["tpp_lnp", 30, 70], ...ALL.map((k) => [k, 0, 70]), ...ERA_MINORS.map((k) => [k, 0, 30])];
  const n0 = (v) => (v == null ? 0 : v);

  // Pollsters tracked in polls[] that legitimately carry no pollsterRules
  // entry (they have no extractor/routing logic — most are one-off or
  // special-purpose labels). Anything else is a typo splitting a series.
  const KNOWN_POLLSTERS = new Set([
    ...Object.keys(rules),
    "Election Result",   // isElection rows: the result, not a poll
    "Spectre Strategy",  // boutique house, no automated feed
    "Wolf & Smith",      // boutique house (AFR-commissioned, ad hoc)
    "Redbridge",         // pre-"RedBridge/Accent" Australia Institute waves
    "Roy Morgan (SMS)",  // single SMS-mode Morgan release, mode tag not a house
    "Roy Morgan (pooled)", // finding 10341's 7-month Single Source cross-section
    "Newspoll (pooled)", // quarterly aggregate releases, no aggregate weight
    "Agenda C Synesis",  // one-off news.com.au poll
    "EMRS (Tas)",        // Tasmanian-only federal waves, machine-read since
                         // 2026-10-10 (extract-emrs.mjs), canon-verified per run
  ]);

  let prevTs = -Infinity, prevDate = null;
  const seen = new Set();
  const seenRelease = new Map();

  D.polls.forEach((p, i) => {
    const where = `#${i} ${p.date} · ${p.pollster}`;
    const fail = (t, d) => errors.push({ type: t, poll: where, detail: d });
    const excuse = (t, d, why) => exempted.push({ type: t, poll: where, detail: d, why });

    // 0. the pollster label is a known house. A misspelling doesn't warn
    //    anywhere else – it splits the house's series on the site.
    if (!KNOWN_POLLSTERS.has(p.pollster))
      fail("unknown-pollster", `pollster "${p.pollster}" is not in pollsterRules or the known-labels list`);

    // 0b. shares inside plausible electoral bounds. A 2PP outside 30–70 or a
    //     primary above 70 (or negative) has never happened federally.
    for (const [k, lo, hi] of RANGES) {
      const v = p[k];
      if (v != null && (v < lo || v > hi)) fail("range", `${k} = ${v} (bounds ${lo}–${hi})`);
    }
    // 0c. the undecided and not-firm shares are shares too — with no cap,
    //     a decimal slip (65 for 6.5) sails into the Decidedness panel.
    //     Roy Morgan's record undecided wave ran 9.5; Resolve's not-firm
    //     share has never left the 17–39 lane.
    if (p.undecided != null && !(p.undecided >= 0 && p.undecided <= 30))
      fail("undecided-range", `undecided = ${p.undecided} (bounds 0–30)`);
    if (p.soft != null && !(p.soft >= 0 && p.soft <= 60))
      fail("soft-range", `soft = ${p.soft} (bounds 0–60)`);

    // 1. full primary sets total ~100 (majors-only polls are partial by design)
    if (CORE.every((k) => p[k] != null)) {
      const sum = ALL.reduce((s, k) => s + n0(p[k]), 0);
      if (Math.abs(sum - 100) > 2) {
        if (p.sumNote) excuse("primary-sum", `Σ shares = ${sum.toFixed(1)} (expected ~100)`, p.sumNote);
        else fail("primary-sum", `Σ shares = ${sum.toFixed(1)} (expected ~100)`);
      }
    }
    // 2. a reported 2PP pair totals ~100, unless the house publishes an
    //    undecided-inclusive 2PP (Essential does – declared in pollsterRules)
    //    or this specific row's anomaly is documented via `tppSumNote`.
    if (p.tpp_alp != null && p.tpp_lnp != null) {
      const t = p.tpp_alp + p.tpp_lnp;
      if (Math.abs(t - 100) > 1) {
        if (rules[p.pollster]?.tppIncludesUndecided)
          excuse("2pp-sum", `2PP ${p.tpp_alp} + ${p.tpp_lnp} = ${t.toFixed(1)} (expected ~100)`, "tppIncludesUndecided rule");
        else if (p.tppSumNote)
          excuse("2pp-sum", `2PP ${p.tpp_alp} + ${p.tpp_lnp} = ${t.toFixed(1)} (expected ~100)`, p.tppSumNote);
        else
          fail("2pp-sum", `2PP ${p.tpp_alp} + ${p.tpp_lnp} = ${t.toFixed(1)} (expected ~100)`);
      }
    }
    // 2b. tpp_flows (2025-election-flows 2PP) is the ALP share
    //     alone; the L-NP half is its complement and is never stored. A value
    //     outside 40–65 means a misparse, not an electorate. Roy Morgan and
    //     RedBridge/Accent are the pollsters who publish a flows pair.
    if (p.tpp_flows != null && !(p.tpp_flows >= 40 && p.tpp_flows <= 65))
      fail("flows-range", `tpp_flows = ${p.tpp_flows}`);
    if (p.tpp_flows != null && !["Roy Morgan", "RedBridge/Accent"].includes(p.pollster))
      fail("flows-pollster", `tpp_flows on a row for ${p.pollster}`);
    // 2b1. tpp_split (RedBridge/Accent's published per-cohort allocation to
    //      Labor) carries all three buckets or none, each a plausible flow
    //      share – a bucket at 0/100 is a Table-1 misparse, not an electorate.
    if (p.tpp_split != null) {
      if (p.pollster !== "RedBridge/Accent")
        fail("split-pollster", `tpp_split on a row for ${p.pollster}`);
      const ts = ["grn", "onp", "oth"].map((k) => p.tpp_split[k]);
      if (ts.some((v) => v == null))
        fail("split-shape", `tpp_split missing a bucket: ${JSON.stringify(p.tpp_split)}`);
      else
        for (const [k, v] of [["grn", ts[0]], ["onp", ts[1]], ["oth", ts[2]]])
          if (!(v >= 1 && v <= 99)) fail("split-range", `tpp_split.${k} = ${v}`);
    }
    // 2b1b. tpp_split_on – the same Table-1 allocation for the Labor-vs-One-
    //      Nation contest (Coalition/Greens/Other cohorts' shares to Labor).
    //      Feb–Jun 2026 reports print the Coalition cohort as CLP/LNP/Nat +
    //      Liberal; the extractor combines those two published sub-flows with
    //      the wave's own printed sub-primaries, so the pair discipline is
    //      the same and the combined figure must still land in 1–99.
    if (p.tpp_split_on != null) {
      if (p.pollster !== "RedBridge/Accent")
        fail("spliton-pollster", `tpp_split_on on a row for ${p.pollster}`);
      const tso = ["lnp", "grn", "oth"].map((k) => p.tpp_split_on[k]);
      if (tso.some((v) => v == null))
        fail("spliton-shape", `tpp_split_on missing a bucket: ${JSON.stringify(p.tpp_split_on)}`);
      else
        for (const [k, v] of [["lnp", tso[0]], ["grn", tso[1]], ["oth", tso[2]]])
          if (!(v >= 1 && v <= 99)) fail("spliton-range", `tpp_split_on.${k} = ${v}`);
    }
    // 2b1c. firmness – RedBridge/Accent's vote-softness table: for all voters
    //      and each party's voters, [solid, soft, very soft] as whole
    //      percentages of one base. All six groups or none, each triple
    //      summing to ~100 (a stray cell is a misparse).
    if (p.firmness != null) {
      if (p.pollster !== "RedBridge/Accent")
        fail("firm-pollster", `firmness on a row for ${p.pollster}`);
      for (const k of ["all", "alp", "lnp", "onp", "grn", "oth"]) {
        const t = p.firmness[k];
        if (!Array.isArray(t) || t.length !== 3 || t.some((v) => !(v >= 0 && v <= 100)))
          fail("firm-shape", `firmness.${k} = ${JSON.stringify(t)}`);
        else if (Math.abs(t[0] + t[1] + t[2] - 100) > 2)
          fail("firm-sum", `firmness.${k} sums to ${t[0] + t[1] + t[2]}`);
      }
    }
    // 2b1ca. consideration – "which parties would you consider voting for"
    //      (multi-select, so no sum discipline). YouGov's News24/serious
    //      waves, Essential's consideration module (its Feb and June 2026
    //      waves band it definitely/open/never – tiered below), YouGov
    //      (MRP)'s Climate Council and Blueprint Institute waves, and
    //      RedBridge/Accent's April 2026 0–10 propensity battery (filed as
    //      three all-voter tiers – below). Party keys from
    //      alp/lnp/grn/onp/ind/oth/none
    //      (only the Blueprint wave offered an Independent option, so ind
    //      rides it alone), at least one, each a percentage or a
    //      hand-entered .5 multiple. consBasis is the row's short basis
    //      label under the figures ("consider", "seriously consider",
    //      RedBridge's range-bracketed tiers) and mandatory with the field.
    if (p.consideration != null) {
      if (!["YouGov", "YouGov (MRP)", "Essential", "RedBridge/Accent"].includes(p.pollster))
        fail("cons-pollster", `consideration on a row for ${p.pollster}`);
      const keys = Object.keys(p.consideration).filter((k) => p.consideration[k] != null);
      if (!keys.length) fail("cons-shape", "consideration carries no figures");
      for (const k of Object.keys(p.consideration))
        if (!["alp", "lnp", "grn", "onp", "ind", "oth", "none"].includes(k))
          fail("cons-key", `consideration.${k} is not a party key`);
      for (const k of keys) {
        const v = p.consideration[k];
        if (!(v >= 1 && v <= 99))
          fail("cons-range", `consideration.${k} = ${v}`);
      }
      if (typeof p.consBasis !== "string" || !p.consBasis.trim())
        fail("cons-basis", `consideration without consBasis on ${p.pollster} ${p.date}`);
      else if (p.consBasis.length > 40)
        fail("cons-basis", `consBasis too long on ${p.pollster} ${p.date}: ${p.consBasis}`);
      // 2b1cb. the extra tiers around the canonical firm-intent map:
      //      RedBridge/Accent's April 2026 0–10 propensity battery (loose
      //      = 4–10 of 10, canonical = 7+ of 10, not = 0–3 of 10, never
      //      = 0 of 10) and Essential's Feb/June 2026 banding
      //      (canonical = "definitely vote", loose = definitely + open,
      //      never = "would never vote"). Tiers ride the canonical
      //      vocabulary, need the canonical map beside them, and loose
      //      must never dip below the canonical share on a shared key.
      for (const f of ["considerationLoose", "considerationNot", "considerationNever"]) {
        if (p[f] == null) continue;
        if (!["RedBridge/Accent", "Essential"].includes(p.pollster))
          fail("cons-tier-pollster", `${f} on a row for ${p.pollster}`);
        for (const k of Object.keys(p[f]))
          if (!["alp", "lnp", "grn", "onp", "ind", "oth", "none"].includes(k))
            fail("cons-tier-key", `${f}.${k} is not a party key`);
        for (const k of Object.keys(p[f]).filter((k) => p[f][k] != null)) {
          const v = p[f][k];
          if (!(v >= 1 && v <= 99))
            fail("cons-tier-range", `${f}.${k} = ${v}`);
          if (f === "considerationLoose" && typeof p.consideration[k] === "number" && v < p.consideration[k])
            fail("cons-tier-order", `${f}.${k} = ${v} below canonical ${p.consideration[k]}`);
        }
      }
      //      the rebase is ASYMMETRIC: a consider-end figure counts the
      //      party's own voters (primary + (100 − primary) × share among the
      //      asked), a not/never-end figure does not (just
      //      (100 − primary) × share) — so loose + not ≤ 100 per key and
      //      never ≤ not (the 0/10 band nests inside 0–3).
      if (p.considerationNot != null && p.considerationLoose != null)
        for (const k of Object.keys(p.considerationNot).filter((k) => p.considerationNot[k] != null && p.considerationLoose[k] != null))
          if (p.considerationLoose[k] + p.considerationNot[k] > 100)
            fail("cons-tier-sum", `considerationLoose.${k} + considerationNot.${k} = ${p.considerationLoose[k] + p.considerationNot[k]} over 100`);
      if (p.considerationNot != null && p.considerationNever != null)
        for (const k of Object.keys(p.considerationNever).filter((k) => p.considerationNever[k] != null && p.considerationNot[k] != null))
          if (p.considerationNever[k] > p.considerationNot[k])
            fail("cons-tier-nest", `considerationNever.${k} = ${p.considerationNever[k]} above considerationNot.${k} ${p.considerationNot[k]}`);
    } else if (p.consBasis != null || p.considerationLoose != null || p.considerationNot != null || p.considerationNever != null)
      fail("cons-basis", `consBasis/tier fields without consideration on ${p.pollster} ${p.date}`);
    // 2b1d. softAge – Resolve's "not firm" share by age band, the three
    //      bands or none, each a percentage.
    if (p.softAge != null) {
      if (p.pollster !== "Resolve")
        fail("softage-pollster", `softAge on a row for ${p.pollster}`);
      for (const k of ["18-34", "35-54", "55+"])
        if (!(p.softAge[k] >= 0 && p.softAge[k] <= 100))
          fail("softage-shape", `softAge.${k} = ${p.softAge[k]}`);
    }
    // 2b2. tpp3 (the three-cornered preferred Fox & Hedgehog prints every
    //      wave and Roy Morgan (SMS) printed for its 13–14 May 2026 post-
    //      budget special) carries all three slices or none, each in
    //      bounds, and the trio sums ~100 –
    //      the same sum discipline as the 2PP pair.
    if (p.tpp3 != null) {
      if (!["Fox & Hedgehog", "Roy Morgan (SMS)"].includes(p.pollster))
        fail("3cp-pollster", `tpp3 on a row for ${p.pollster}`);
      const t3 = ["alp", "lnp", "onp"].map((k) => p.tpp3[k]);
      if (t3.some((v) => v == null))
        fail("3cp-shape", `tpp3 missing a slice: ${JSON.stringify(p.tpp3)}`);
      else {
        for (const [k, v] of [["alp", t3[0]], ["lnp", t3[1]], ["onp", t3[2]]])
          if (v < 10 || v > 70) fail("3cp-range", `tpp3.${k} = ${v}`);
        const s = t3[0] + t3[1] + t3[2];
        if (Math.abs(s - 100) > 1) fail("3cp-sum", `Σ tpp3 = ${s.toFixed(1)} (expected ~100)`);
      }
    }
    // 2c. releaseUrl, where present, is the pollster's OWN release page – an
    //     absolute https URL. Anything else is a hand-entry slip, not a
    //     weird source.
    if (p.releaseUrl != null && (typeof p.releaseUrl !== "string" || !/^https:\/\/.+\..+\//.test(p.releaseUrl)))
      fail("release-url", `releaseUrl = ${JSON.stringify(p.releaseUrl)}`);
    // 2c2. methodUrl, where present, is the wave's APC methodology statement
    //      (YouGov's statement PDF, Newspoll's Pyxis statement page, the
    //      RedBridge/Accent wave's usrfiles.com report PDF, DemosAU's
    //      statement PDF off its methodology-statements index, Essential's
    //      ONE living disclosure-statement PDF shared by every covered wave
    //      – refreshed in place when the house re-uploads it, Fox &
    //      Hedgehog's per-wave APC statement off its news-den release
    //      page, hand-entered – that house has no extractor) –
    //      an absolute https URL, stamped by extract-sampleeff.mjs for
    //      the automated houses. Only those houses have a source to link.
    if (p.methodUrl != null && (typeof p.methodUrl !== "string" || !/^https:\/\/.+\..+\//.test(p.methodUrl)))
      fail("method-url", `methodUrl = ${JSON.stringify(p.methodUrl)}`);
    if (p.methodUrl != null && !["YouGov", "Newspoll", "RedBridge/Accent", "RedBridge/Accent (MRP)", "DemosAU", "DemosAU (MRP)", "Essential", "Fox & Hedgehog"].includes(p.pollster))
      fail("method-url", `methodUrl on a row for ${p.pollster}`);
    // 2c3. tablesUrl is The Australian's demographic-tables supplement PDF
    //      for a pooled Newspoll wave, hosted on its origin CDN – only those
    //      rows have such a document to link.
    if (p.tablesUrl != null && (typeof p.tablesUrl !== "string" || !/^https:\/\/.+\..+\//.test(p.tablesUrl)))
      fail("tables-url", `tablesUrl = ${JSON.stringify(p.tablesUrl)}`);
    if (p.tablesUrl != null && p.pollster !== "Newspoll (pooled)")
      fail("tables-url", `tablesUrl on a row for ${p.pollster}`);
    // 2d. sampleEff (the house's published effective sample size) is a whole
    //     number never below 200 and never above its own raw sample – a
    //     design effect can only deflate. Absent-not-filled means the house
    //     files no such figure (or, for DemosAU/YouGov MRPs, "n/a for MRP"),
    //     it is never a zero.
    if (p.sampleEff != null && (!Number.isInteger(p.sampleEff) || p.sampleEff < 200))
      fail("sample-eff", `sampleEff = ${JSON.stringify(p.sampleEff)}`);
    if (p.sampleEff != null && p.sample > 0 && p.sampleEff > p.sample * 1.05)
      fail("sample-eff", `sampleEff ${p.sampleEff} exceeds raw sample ${p.sample}`);
    // 2e. a row-level `noAgg` is ONE release of a regular house that stays
    //     out of every aggregate while the house's tracker rows count
    //     (gen-data's NO_AGG_ROW_NOTE / noAggPoll) – the token names the
    //     release and must be one gen-data has a note for. A whole no-
    //     aggregate HOUSE files under a suffix label instead (NO_AGG in
    //     pollsterRules / gen-data's NO_AGG_HOUSES).
    if (p.noAgg != null && !["shifts"].includes(p.noAgg))
      fail("no-agg", `noAgg token "${p.noAgg}": gen-data has no NO_AGG_ROW_NOTE for it`);
    // 3. dates are real ISO YYYY-MM-DD days, not in the future, run
    //    oldest→newest, and fieldwork starts before it ends
    if (!validISO(p.date)) fail("date-format", `date "${p.date}" is not a real YYYY-MM-DD day`);
    if (p.dateStart != null && !validISO(p.dateStart)) fail("date-format", `dateStart "${p.dateStart}" is not a real YYYY-MM-DD day`);
    if (p.date > TOMORROW) fail("future-date", `date ${p.date} is after today`);
    const ts = Date.parse(p.date);
    if (isNaN(ts)) fail("bad-date", `unparseable date "${p.date}"`);
    else {
      if (ts < prevTs) fail("date-order", `precedes previous entry (${prevDate})`);
      prevTs = ts; prevDate = p.date;
    }
    if (p.dateStart != null) {
      const ds = Date.parse(p.dateStart);
      if (isNaN(ds)) fail("bad-date", `unparseable dateStart "${p.dateStart}"`);
      else if (!isNaN(ts) && ds > ts) fail("date-range", `dateStart ${p.dateStart} is after date ${p.date}`);
    }
    // 3b. an (MRP)-labelled row must carry its fieldwork window: gen-data's
    //     reusesWaves anchors an MRP wave on dateStart+date, and without the
    //     window the MRP row would leak into the aggregates it reuses.
    if (/\(MRP\)/.test(String(p.pollster)) && p.dateStart == null)
      fail("mrp-datestart", "(MRP) row without dateStart – gen-data reusesWaves anchors on the window");
    // 4. duplicate date+pollster – usually an accidental paste. Keyed on the
    //    CANONICAL name: a pre/post-rebrand spelling pair ("Redbridge" beside
    //    "RedBridge/Accent") doesn't collide here unless this gate uses the
    //    name gen-data will actually see.
    const key = p.date + "|" + canonHouse(p.pollster);
    if (seen.has(key)) fail("duplicate", "same date + pollster already present");
    seen.add(key);
    // 4b. duplicate release event: one house's two rows sharing one
    //     `published` timestamp means two tracker waves for one published
    //     wave – a mis-keyed date, or a scenario/counterfactual pair leaked
    //     in as if it were a second wave (the Resolve Feb-2026 Ley pair,
    //     filed 02-12 and 02-14 off the one 15-Feb release). Check 4 can't
    //     see it because the dates differ; the estimator sees two waves and
    //     double-weights the house. Rows without `published` can't be keyed
    //     to a release, so they're out of scope here.
    if (p.published != null) {
      // published is ISO (day or day+minute precision), sits on/after
      // fieldwork end, and is not in the future
      if (typeof p.published !== "string" || !ISO_PUBLISHED.test(p.published))
        fail("published-format", `published = ${JSON.stringify(p.published)}`);
      else {
        if (p.published.slice(0, 10) > TOMORROW) fail("future-date", `published ${p.published} is after today`);
        if (ISO_DAY.test(p.date) && p.published.slice(0, 10) < p.date)
          fail("published-order", `published ${p.published} precedes fieldwork-end ${p.date}`);
      }
      const rk = canonHouse(p.pollster) + "|" + p.published;
      if (seenRelease.has(rk))
        fail("same-release", `shares published=${p.published} with the ${seenRelease.get(rk)} row – one release, two waves`);
      seenRelease.set(rk, p.date);
    }
    // 5. real polls carry a sample size. Rows the updaters assimilate from a
    //    house's published dataset legitimately have none (the feed doesn't
    //    carry one) and declare themselves via `assimilated` instead.
    //    `samplePending` is the rare third case: a wave landed with its full
    //    data verified, but the house's per-wave n is published in a document
    //    not yet posted (adjudicated for YouGov's News24 waves, whose n arrives
    //    in the APC methodology PDF on the yougov cloudfront account — the
    //    row carries the flag until that URL is on the row and the real n is
    //    filled). gen-data.mjs prices the gap at the implicit n=1200 regardless;
    //    the flag is transient and must leave the file with the backfill.
    const noSample = !(p.sample > 0);
    if (!p.isElection && !p.assimilated && noSample && !p.samplePending)
      fail("sample", `sample = ${p.sample}`);
    if (!p.isElection && p.samplePending && noSample)
      excuse("sample-pending", "no sample", "house per-wave n unpublished at landing; implicit 1200 until backfill");
    // 5a. `fieldworkPending`: a DemosAU wave filed from the Capital Brief
    //     article before the methodology PDF (extract-demosau.mjs, user call
    //     2026-10-05). Its date/dateStart are a provisional window — placing
    //     it on the charts and in the headline — and the site says "Fieldwork
    //     TBC". The PDF writes the real window and drops the flag; a flag on a
    //     row that already carries its methodology link has outlived that.
    if (p.fieldworkPending) {
      if (p.methodUrl) fail("fieldwork-pending", "fieldworkPending on a row that already has its methodUrl");
      // its "TBC" must link where the dates will appear (field-tbc.mjs)
      else if (!fieldTbcUrl(p.pollster)) fail("fieldwork-pending", `no page for ${p.pollster}'s TBC to link to – add the house to field-tbc.mjs`);
      else excuse("fieldwork-pending", "provisional fieldwork window", "published before the house's methodology statement; dates replaced when it lands");
    }
  });

  // 5b. election rows are labelled as elections, and only elections carry the
  //     Election Result label – a crossed pairing would feed a result into
  //     the poll aggregate or a poll into the result anchoring.
  D.polls.forEach((p, i) => {
    if (p.isElection && p.pollster !== "Election Result")
      errors.push({ type: "election-label", poll: `#${i} ${p.date} · ${p.pollster}`, detail: "isElection row not labelled Election Result" });
    if (!p.isElection && p.pollster === "Election Result")
      errors.push({ type: "election-label", poll: `#${i} ${p.date} · ${p.pollster}`, detail: "Election Result label without isElection" });
  });

  /* 10. leadership and alternative-pairing shares stay in lane, and a row's
     published slices never total over 100 (unsure/don't-know makes the
     remainder, so 100+tolerance is a hard ceiling – a column landing at 103
     is a misparse, not an electorate). Checks 1–2 give the polls[] shares
     that discipline; these series have had equivalent misparses silently
     pass before (e.g. a Slightly/Very approval pair entered as its own
     sum). Preferred-PM slices print against the decided base in every
     house behind this data, so 0–100 per slot is the hard bound; altTpp
     matchup shares use the same 30–70 lane as a 2PP (check 0b). */
  const shareBad = (v) => v != null && (v < 0 || v > 100);
  const TPP_LANE = [30, 70];
  (D.ppm || []).forEach((r, i) => {
    const where = `ppm #${i} ${r.date} · ${r.firm}`;
    const slots = [["alb", r.alb], ["opp", r.opp], ["han", r.han]].filter(([, v]) => v != null);
    for (const [k, v] of slots)
      if (shareBad(v)) errors.push({ type: "share-range", poll: where, detail: `${k} = ${v} (bounds 0–100)` });
    const sum = slots.reduce((s, [, v]) => s + v, 0);
    if (slots.length === 3 && sum > 101)
      errors.push({ type: "ppm-sum", poll: where, detail: `Σ preferred-PM slots = ${sum.toFixed(1)} (ceiling 100)` });
    (r.extra || []).forEach((e, j) => {
      const whereX = `${where} extra[${j}]`;
      for (const [k, v] of Object.entries(e))
        if (shareBad(v)) errors.push({ type: "share-range", poll: whereX, detail: `${k} = ${v} (bounds 0–100)` });
      const sumX = Object.values(e).reduce((s, v) => s + v, 0);
      if (sumX > 101)
        errors.push({ type: "ppm-sum", poll: whereX, detail: `Σ = ${sumX.toFixed(1)} (ceiling 100)` });
    });
  });
  (D.ppmHeadToHead || []).forEach((r, i) => {
    const where = `ppmHeadToHead #${i} ${r.date} · ${r.firm}`;
    for (const [k, v] of [["alb", r.alb], ["han", r.han]])
      if (v != null && shareBad(v)) errors.push({ type: "share-range", poll: where, detail: `${k} = ${v} (bounds 0–100)` });
    if (r.alb != null && r.han != null && r.alb + r.han > 101)
      errors.push({ type: "h2h-sum", poll: where, detail: `alb ${r.alb} + han ${r.han} = ${(r.alb + r.han).toFixed(1)} (ceiling 100)` });
  });
  (D.approval || []).forEach((r, i) => {
    const where = `approval #${i} ${r.date} · ${r.firm}`;
    for (const [k, v] of [["alb", r.alb], ["opp", r.opp], ["han", r.han]])
      if (v != null && (v < -100 || v > 100)) errors.push({ type: "net-range", poll: where, detail: `${k} net = ${v} (bounds −100–100)` });
    for (const who of ["alb", "opp", "han"]) {
      const d = r.detail?.[who];
      if (!d) continue;
      for (const [k, v] of Object.entries(d))
        if (shareBad(v)) errors.push({ type: "share-range", poll: `${where} detail.${who}`, detail: `${k} = ${v} (bounds 0–100)` });
      const appDis = (d.app ?? 0) + (d.dis ?? 0);
      if (d.app != null && d.dis != null && appDis > 101)
        errors.push({ type: "approval-sum", poll: `${where} detail.${who}`, detail: `app ${d.app} + dis ${d.dis} = ${appDis.toFixed(1)} (ceiling 100)` });
    }
  });
  (D.altTpp || []).forEach((r, i) => {
    const where = `altTpp #${i} ${r.date} · ${r.firm}`;
    for (const [k, v] of Object.entries(r)) {
      if (!/_/.test(k) || v == null) continue;
      const [lo, hi] = TPP_LANE;
      if (v < lo || v > hi) errors.push({ type: "range", poll: where, detail: `${k} = ${v} (bounds ${lo}–${hi})` });
    }
  });
  (D.direction || []).forEach((d, i) => {
    const where = `direction #${i} ${d.date} · ${d.pollster}`;
    for (const [k, v] of [["right", d.right], ["wrong", d.wrong], ["unsure", d.unsure]])
      if (v != null && shareBad(v)) errors.push({ type: "share-range", poll: where, detail: `${k} = ${v} (bounds 0–100)` });
  });

  /* 11. assimilated rows are exempt from the sample-size check (5) because
     their producer publishes no per-wave n — the estimator quietly prices
     the gap as n=1200 (gen-data.mjs), a weight adjudicated sensible for
     exactly the houses whose assimilators live in .build today. A NEW
     house arriving here means someone shipped an unsampled series without
     thinking through that weight: either the house belongs on this list
     (confirm its typical n makes 1200 sane, then add it with a comment) or
     the rows shouldn't be assimilated. Fails either way until adjudicated. */
  const ASSIMILATED_OK = new Set(["Essential", "Resolve"]);
  D.polls.forEach((p, i) => {
    if (p.assimilated && !ASSIMILATED_OK.has(p.pollster))
      errors.push({ type: "assimilated-house", poll: `#${i} ${p.date} · ${p.pollster}`,
                    detail: "assimilated row from a house with no adjudicated implicit-n convention" });
  });

  // 6. direction rows are a proportion split; a `published` stamp on one
  // follows the same rules as the poll rows' (format, order, future). Two
  // rows sharing date + pollster are one wave filed twice, the same bug
  // check 4 catches for polls[].
  const dirSeen = new Set();
  (D.direction || []).forEach((d, i) => {
    const dkey = d.date + "|" + d.pollster;
    if (dirSeen.has(dkey))
      errors.push({ type: "duplicate", poll: `direction #${i} ${d.date} · ${d.pollster}`, detail: "same date + pollster already present" });
    dirSeen.add(dkey);
    if (d.date != null && !validISO(d.date))
      errors.push({ type: "date-format", poll: `direction #${i} ${d.date} · ${d.pollster}`, detail: `date "${d.date}" is not a real YYYY-MM-DD day` });
    if (d.published != null) {
      if (typeof d.published !== "string" || !ISO_PUBLISHED.test(d.published))
        errors.push({ type: "published-format", poll: `direction #${i} ${d.date} · ${d.pollster}`, detail: `published = ${JSON.stringify(d.published)}` });
      else {
        if (d.published.slice(0, 10) > TOMORROW)
          errors.push({ type: "future-date", poll: `direction #${i} ${d.date} · ${d.pollster}`, detail: `published ${d.published} is after today` });
        if (validISO(d.date) && d.published.slice(0, 10) < d.date)
          errors.push({ type: "published-order", poll: `direction #${i} ${d.date} · ${d.pollster}`, detail: `published ${d.published} precedes fieldwork-end ${d.date}` });
      }
    }
    const sum = n0(d.right) + n0(d.wrong) + n0(d.unsure);
    if (Math.abs(sum - 100) > 1)
      errors.push({ type: "direction-sum", poll: `direction #${i} ${d.date} · ${d.pollster}`, detail: `Σ = ${sum.toFixed(1)}` });
    // methodUrl, where present, is the wave's APC methodology statement —
    // SEC Newgate's MOTN statement PDF off its disclosure-statements
    // library (the per-wave statements list at
    // secnewgate.com.au/disclosure-statements, stamped by
    // extract-secnewgate.mjs) — an absolute https URL, on the same terms
    // as the poll rows' check 2c2. Only SEC has a source to link.
    if (d.methodUrl != null && (typeof d.methodUrl !== "string" || !/^https:\/\/.+\..+\//.test(d.methodUrl)))
      errors.push({ type: "method-url", poll: `direction #${i} ${d.date} · ${d.pollster}`, detail: `methodUrl = ${JSON.stringify(d.methodUrl)}` });
    if (d.methodUrl != null && d.pollster !== "SEC Newgate")
      errors.push({ type: "method-url", poll: `direction #${i} ${d.date} · ${d.pollster}`, detail: "methodUrl on a direction row with no APC statement source" });
  });

  /* 7. a 2PP column has to agree with the primaries printed beside it.
     Preferences are not free: a party on 37 primary with the Greens on 12
     cannot also be on 44 two-party preferred. Checked as a MEAN over a whole
     series rather than per poll, because the flow constants below are rough
     (a single poll can sit 3-4 points off them for real reasons); a whole
     series sitting on the wrong side of them is an inverted column, not
     preference drift.

     This is here because the 2022-25 term's cycle polls had exactly that: the
     L/NP figure was stored in tpp_alp for all 291 rows, and the Past-cycles
     chart drew Labor's last term as a slide from 52.1 to 47.7 through a term
     it won 55.2. Nothing in the build noticed for as long as the file existed.

     Constants come from the AEC's published preference-flow products for
     each election, aggregated by .build/aec-flows.py (TCP download) and
     .build/aec-tpp-flows.py (TPP download):
       2022 (Event 27966, TCP): GRN→ALP 83.71% (1,199,015 v 233,317) ·
         ON 35.33% (243,683 v 446,107) · IND 58.32% (174,234 v 124,523) ·
         ind+oth lumped 44.30% (661,807 v 832,212)
       2025 (Event 31496, TCP): GRN→ALP 86.83% (1,279,081 v 194,050) ·
         ON 27.10% (244,177 v 656,962) · IND 63.56% (294,426 v 168,775) ·
         ind+oth lumped 48.49% (711,699 v 756,292)
       2025 (Event 31496, TPP — SHIPPED): GRN→ALP 88.19%
         (1,666,851 v 223,126) · ON 25.50% (252,917 v 738,897) · IND
         67.15% (756,196 v 369,855) · ind+oth lumped 54.55%
         (1,268,209 v 1,056,696)
     The 2025-lumped TPP set is the one in force: the AEC TPP products
     redistribute every formal ballot ALP v Coalition across all 150 seats
     (the TCP products drop seats where the from-party was never excluded
     and implicitly treat flows to non-major finals as neutral). Measured
     against the 121 current-term polls that publish 2PP (mean |per-house
     bias|, .build/flow-validate.mjs): 2025-TPP-lumped 0.774 < 2025-lumped
     1.01 < 2022-lumped 1.14 ≈ the old {0.82,0.35,0.50} placeholders <
     2025-split 1.24 < 2022-split 1.80. It is also the cut Roy Morgan's
     "2025 election" flow-2PP tracks (MAE 0.43 v 0.94 TCP-renorm v 2.79
     TCP-web-raw over 38 waves), i.e. the cut the polling industry quotes.
     Lumping IND+OTH beats splitting (not all houses publish an IND series,
     and poll-house 2PPs are respondent-allocated, not raw-flow
     reconstructions). 2025's ON→ALP share collapsed 8pts on 2022
     (35.3→27.1% TCP) while GRN and IND drifted Labor's way – election-level
     movement no single constant set carries. Re-derive after the next
     federal election, from the SAME cut (TPP download).

     SA's 2026 election independently confirms these constants have to stay
     coarse. The Tally Room's 3CP analysis of that count (tallyroom.com.au/
     64676) found the same party's preferences redistributing by contest AND
     by seat: Greens → Labor ~80% in ALP–One Nation contests (and stronger
     against the Liberals), but only ~67% in Elizabeth, a donkey-vote seat
     where ON made the final two; Liberal → ON ranging 53 to 73.5% across
     seats. No election-wide constant – fresh or stale – survives that
     variance, which is why synthetic-2PP was rejected as a shipped series
     in favour of the published-poll aggregate plus the altTpp matchups.
     Slack of ±3 keeps this an inversion check rather than a flow check.

     The constants themselves live in flows.mjs, imported here and by
     gen-data.mjs so this gate and the synthetic-2PP diagnostic on the site
     always share one definition. */
  const orientation = (rows, label, alpKey, tppKey) => {
    const ds = rows.map((p) => {
      // era rows invert against the FLOW_ERAS set their tppEra tag names;
      // everything else uses the 2025 constants
      const im = p.tppEra != null
        ? impliedEraAlp2pp(FLOW_ERAS[p.tppEra], { ...p, alp: p[alpKey] })
        : impliedAlp2pp({ ...p, alp: p[alpKey] });
      return im == null || p[tppKey] == null ? null : p[tppKey] - im;
    }).filter((v) => v != null);
    if (ds.length < 20) return;                       // too few to judge a series
    const m = ds.reduce((a, b) => a + b, 0) / ds.length;
    if (Math.abs(m) > 3)
      errors.push({ type: "2pp-flip", poll: label,
        detail: `2PP averages ${m > 0 ? "+" : ""}${m.toFixed(1)} vs what its own primaries imply `
              + `over ${ds.length} rows – the ALP/L-NP pair is probably swapped` });
  };
  /* An election's own pair has a hard bound the polls' don't: Labor's 2PP
     is its primary plus some share of everyone else's, so it sits between
     its primary and 100 minus the Coalition's. A swapped pair breaks it
     whenever the primaries aren't level – e1951/e1954 shipped swapped from
     the 1943–58 bootstrap's literal and nothing caught them. 0.15 of slack
     for two-decimal primaries against a one-decimal 2PP. */
  for (const [k, e] of Object.entries(D.elections || {})) {
    if (e.alp == null || e.lnp == null || e.tpp_alp == null) continue;
    if (e.tpp_alp < e.alp - 0.15 || e.tpp_alp > 100 - e.lnp + 0.15 || Math.abs(e.tpp_alp + e.tpp_lnp - 100) > 0.15)
      errors.push({ type: "2pp-flip", poll: `elections.${k}`,
        detail: `ALP 2PP ${e.tpp_alp} lies outside ALP primary ${e.alp} … 100 − L/NP primary ${e.lnp}`
              + ` (or the pair doesn't sum to 100) – the ALP/L-NP pair is probably swapped` });
  }
  /* dateApprox marks a mirror date that only names the month (the
     accuracy window skips it, the dots print the month alone) – an era-row
     property, set by .build/fix-1943-58-cycles.mjs and the assimilator. */
  for (const [cycle, rows] of Object.entries(D.cyclePolls || {}))
    for (const p of rows)
      if (p.dateApprox != null && (p.dateApprox !== "month" || p.tppEra == null))
        errors.push({ type: "date-approx", poll: `cyclePolls.${cycle} ${p.date} ${p.firm}`,
          detail: `dateApprox ${JSON.stringify(p.dateApprox)} – only "month", and only on a tppEra row` });
  orientation(D.polls.filter((p) => !p.isElection), "polls[] (current term)", "alp", "tpp_alp");
  for (const [cycle, rows] of Object.entries(D.cyclePolls || {}))
    orientation(rows.filter((p) => p.firm !== "Election"), `cyclePolls.${cycle}`, "alp", "tpp_alp");

  /* 8. one house, one reading, one date – in the cycle arrays too. Check 4
     covers polls[] alone, which is why two different Morgan waves sat on
     2011-10-23 for as long as the file existed: the 25-26 Oct phone poll had
     been keyed to the 22-23 Oct face-to-face poll's date. Nothing looks wrong
     on the page, which is the problem – a stacked pair is invisible on a chart
     that means the month it falls in, and silently double-weights one house in
     that month's mean. Two DIFFERENT readings on one date are always either a
     mis-keyed date or a house that needs naming apart; they are never both
     right, so this is an error rather than something `sumNote` can excuse. */
  const cycleDupes = (obj, label) => {
    for (const [cycle, rows] of Object.entries(obj || {})) {
      const seenHere = new Set();
      for (const r of rows) {
        const key = r.date + "|" + r.firm;
        if (seenHere.has(key))
          errors.push({ type: "duplicate", poll: `${label}.${cycle} ${r.date} · ${r.firm}`,
                        detail: "same date + firm already present in this cycle" });
        seenHere.add(key);
      }
    }
  };
  cycleDupes(D.cyclePolls, "cyclePolls");
  cycleDupes(D.cycleApproval, "cycleApproval");

  /* 8b. cycle arrays run chronologically like polls[] does (check 3), carry
     ISO dates, and keep shares inside plausible bounds. A mis-sorted cycle
     row breaks the Past-cycles renderer's assumptions the same way a
     mis-sorted polls[] row breaks the estimator. */
  if (D.cyclePolls) {
    for (const [cycle, rows] of Object.entries(D.cyclePolls)) {
      let prev = "";
      rows.forEach((r, i) => {
        const where = `cyclePolls.${cycle} #${i} ${r.date} · ${r.firm}`;
        if (!ISO_DAY.test(r.date))
          errors.push({ type: "date-format", poll: where, detail: `date "${r.date}" is not YYYY-MM-DD` });
        if (r.date < prev)
          errors.push({ type: "date-order", poll: where, detail: `precedes previous entry (${prev})` });
        prev = r.date;
        for (const [k, lo, hi] of RANGES) {
          const v = r[k];
          if (v != null && (v < lo || v > hi))
            errors.push({ type: "range", poll: where, detail: `${k} = ${v} (bounds ${lo}–${hi})` });
        }
      });
    }
  }
  if (D.cycleApproval) {
    for (const [cycle, rows] of Object.entries(D.cycleApproval)) {
      let prev = "";
      rows.forEach((r, i) => {
        if (!ISO_DAY.test(r.date))
          errors.push({ type: "date-format", poll: `cycleApproval.${cycle} #${i} ${r.date} · ${r.firm}`, detail: `date "${r.date}" is not YYYY-MM-DD` });
        if (r.date < prev)
          errors.push({ type: "date-order", poll: `cycleApproval.${cycle} #${i} ${r.date} · ${r.firm}`, detail: `precedes previous entry (${prev})` });
        prev = r.date;
      });
    }
  }

  /* 8c. cycle primary sets also total ~100, with firm×era bases declared in
     `cyclePollBases` ("cycle|firm" → note) rather than per-row notes: whole
     eras publish one consistent basis, so repeating a note per row would be
     copy-paste noise. The declared bases, all adjudicated against the source
     tables:
       – 1946…1987 Morgan (tppEra rows): F2F Morgan Gallup pre-1987, the era
         where minors ride dem/dlp on the row rather than inside oth. Σ over
         {"alp","lnp"}+{"dem","dlp"}+{"oth"} (grn/onp did not exist as
         published columns).
       – 1998/2001/2004 Morgan: the printed table splits ALP/L-NP/... each
         minor party into its own column AND carries an OTH column, so the
         extracted majors+OTH Σ runs 102.5–106.5. Faithful to
         data/roymorgan/roymorgan-primary-*.csv verbatim cells.
       – 2022/2025 Essential, 2022/2025 Ipsos, 2025 Dynata: primaries exclude
         undecided without a rebase, Σ runs 90–97.
     An undeclared firm×era off 100±2 is a transcription bug, so it fails. */
  const bases = D.cyclePollBases || {};
  for (const [cycle, rows] of Object.entries(D.cyclePolls || {})) {
    rows.forEach((r, i) => {
      // era rows: Σ over the lanes the era actually published
      const lanes = r.tppEra != null ? ["alp", "lnp", "dem", "dlp", "oth"] : ALL;
      const core = r.tppEra != null ? ["alp", "lnp"] : CORE;
      if (!core.every((k) => r[k] != null)) return;
      const sum = lanes.reduce((s, k) => s + n0(r[k]), 0);
      if (Math.abs(sum - 100) <= 2) return;
      const basis = bases[cycle + "|" + r.firm];
      const where = `cyclePolls.${cycle} #${i} ${r.date} · ${r.firm}`;
      if (basis) exempted.push({ type: "primary-sum", poll: where, detail: `Σ shares = ${sum.toFixed(1)} (basis: ${basis})` });
      else errors.push({ type: "primary-sum", poll: where, detail: `Σ shares = ${sum.toFixed(1)} (expected ~100; no declared basis for ${cycle} ${r.firm})` });
    });
  }

  // 9. every leadership row should key onto a poll's fieldwork-end date, or it
  //    is a leadership-only wave – flagged as info, since a drifted date looks
  //    exactly like one (the Essential Dec-2025 / Mar-2026 bug). Dates on
  //    leadership rows are ISO-checked here too since check 3 only walks
  //    polls[]; the same real-day gate now covers the h2h/altTpp series (Δ§9a),
  //    which gen-data dx()s just the same. Duplicates are rejected per series,
  //    keyed date + firm like check 8's cycle rows.
  for (const [rows, label] of [[D.ppm, "ppm"], [D.approval, "approval"], [D.ppmHeadToHead, "ppmHeadToHead"], [D.altTpp, "altTpp"]]) {
    const seenHere = new Set();
    (rows || []).forEach((r, i) => {
      if (!validISO(r.date))
        errors.push({ type: "date-format", poll: `${label} #${i} ${r.date} · ${r.firm}`, detail: `date "${r.date}" is not a real YYYY-MM-DD day` });
      const key = r.date + "|" + r.firm;
      if (seenHere.has(key))
        errors.push({ type: "duplicate", poll: `${label} #${i} ${r.date} · ${r.firm}`, detail: "same date + firm already present in this series" });
      seenHere.add(key);
    });
  }
  const pollKeys = new Set(D.polls.map((p) => p.date + "|" + p.pollster));
  const orphans = [...D.ppm, ...D.approval]
    .filter((r) => !pollKeys.has(r.date + "|" + r.firm))
    .map((r) => `${r.date} · ${r.firm}`);

  /* 12. fallbackPolls – provisional rows the Poll Bludger fallback filed
     (.build/extract-pollbludger.mjs) for waves the house's own extractor
     missed. gen-data merges them into the page only where no canonical row
     sits within a few days, so they get the shape checks a poll row gets
     (ISO dates, ranges, Σ ≈ 100 − undecided, a tracked house, the
     provenance stamp) but NOT a no-overlap check: a canonical row landing
     beside one is the intended handover, and the fallback agent prunes the
     shadowed row on its next run – the house's wrapper must not fail
     validate in between. */
  const fb = D.fallbackPolls;
  if (fb !== undefined && !Array.isArray(fb))
    errors.push({ type: "fallback-shape", poll: "fallbackPolls", detail: "not an array" });
  let prevFb = null;
  (Array.isArray(fb) ? fb : []).forEach((p, i) => {
    const where = `fallbackPolls #${i} ${p.date} · ${p.pollster}`;
    const fail = (t, d) => errors.push({ type: t, poll: where, detail: d });
    if (!KNOWN_POLLSTERS.has(p.pollster)) fail("pollster", `unknown pollster label ${JSON.stringify(p.pollster)}`);
    for (const k of ["date", "dateStart"]) if (!validISO(p[k] || "")) fail("date-format", `${k} "${p[k]}" is not a real YYYY-MM-DD day`);
    if (p.dateStart > p.date) fail("date-order", `dateStart ${p.dateStart} after date ${p.date}`);
    if (prevFb && p.date < prevFb) fail("date-order", `precedes previous entry (${prevFb})`);
    prevFb = p.date;
    for (const [k, lo, hi] of RANGES) { const v = p[k]; if (v != null && (v < lo || v > hi)) fail("range", `${k} = ${v} (bounds ${lo}–${hi})`); }
    if (!CORE.every((k) => p[k] != null)) fail("primaries", "a core primary is missing");
    else {
      const sum = ALL.reduce((a, k) => a + n0(p[k]), 0) + n0(p.undecided);
      if (Math.abs(sum - 100) > 1) fail("primary-sum", `Σ shares + undecided = ${sum.toFixed(1)} (expected ~100)`);
    }
    if ((p.tpp_alp == null) !== (p.tpp_lnp == null)) fail("tpp", "half a 2PP pair");
    if (p.provisional?.source !== "Poll Bludger" || !p.provisional?.feedId) fail("provenance", "missing provisional {source, feedId} stamp");
    if (p.isElection) fail("fallback-shape", "an election row cannot be provisional");
  });

  /* 13. fallbackApproval – provisional leader-satisfaction rows from the
     same fallback: approval[] shape, nets equal to the splits, a known
     firm, the provenance stamp. No overlap check, for the reason check 12
     gives. */
  const fa = D.fallbackApproval;
  if (fa !== undefined && !Array.isArray(fa))
    errors.push({ type: "fallback-shape", poll: "fallbackApproval", detail: "not an array" });
  (Array.isArray(fa) ? fa : []).forEach((r, i) => {
    const where = `fallbackApproval #${i} ${r.date} · ${r.firm}`;
    const fail = (t, d) => errors.push({ type: t, poll: where, detail: d });
    if (!KNOWN_POLLSTERS.has(r.firm)) fail("pollster", `unknown firm label ${JSON.stringify(r.firm)}`);
    if (!validISO(r.date || "")) fail("date-format", `date "${r.date}" is not a real YYYY-MM-DD day`);
    for (const k of ["alb", "opp"]) {
      const sp = r.detail?.[k];
      if (r[k] == null && !sp) continue;
      if (!sp || sp.app == null || sp.dis == null) { fail("approval-split", `${k} net without a split`); continue; }
      if (sp.app < 0 || sp.dis < 0 || sp.app + sp.dis > 100) fail("range", `${k} split ${sp.app}/${sp.dis}`);
      if (r[k] !== sp.app - sp.dis) fail("approval-net", `${k} net ${r[k]} ≠ ${sp.app} − ${sp.dis}`);
    }
    if (r.alb == null && r.opp == null) fail("approval-split", "neither leader rated");
    if (r.opp != null && !r.oppName) fail("approval-split", "opp net without oppName");
    if (r.provisional?.source !== "Poll Bludger" || !r.provisional?.feedId) fail("provenance", "missing provisional {source, feedId} stamp");
  });

  /* 14. events[] are real past facts rendered as chart annotations. gen-data
     both dx()s e.date (so a pattern-only-invalid day would slide out of
     position) and keys a lookup by it (sxByDate), so duplicates and
     non-ISO days are bugs here, and the visible copy (short + label) is
     required rather than empty-stringed past. */
  let prevEv = null;
  for (const e of D.events || []) {
    if (!validISO(e.date))
      errors.push({ type: "date-format", poll: `events ${e.date} · ${e.label ?? ""}`, detail: `date "${e.date}" is not a real YYYY-MM-DD day` });
    else if (e.date > TOMORROW)
      errors.push({ type: "future-date", poll: `events ${e.date} · ${e.label ?? ""}`, detail: `date ${e.date} is after today` });
    for (const k of ["short", "label"])
      if (typeof e[k] !== "string" || !e[k].trim())
        errors.push({ type: "event-shape", poll: `events ${e.date ?? ""}`, detail: `${k} is missing or empty` });
    if (prevEv === e.date)
      errors.push({ type: "duplicate", poll: `events ${e.date} · ${e.label ?? ""}`, detail: "another event already has this date" });
    else if (prevEv && e.date < prevEv)
      errors.push({ type: "date-order", poll: `events ${e.date} · ${e.label ?? ""}`, detail: `precedes previous event (${prevEv})` });
    prevEv = e.date;
  }

  return { errors, exempted, orphans: [...new Set(orphans)] };
}

/* data/changelog.json – the Info-tab change log gen-data §8d appends to on
   each site refresh. Shape only: the figures it records were checked when
   the estimator computed them, not re-audited here. */
export function validateChangelog() {
  const errors = [];
  const fail = (where, t, d) => errors.push({ type: t, poll: where, detail: d });
  let C = null;
  try { C = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "changelog.json"), "utf8")); }
  catch { fail("changelog.json", "changelog", "missing or unparseable"); return errors; }
  if (!C.state || typeof C.state !== "object") fail("changelog.json", "changelog-shape", "no state object");
  if (!Array.isArray(C.entries)) {
    fail("changelog.json", "changelog-shape", "entries is not an array");
    return errors;
  }
  const KINDS = new Set(["seed", "meta", "flows", "poll", "finding", "conf"]);
  let prev = null;
  C.entries.forEach((e, i) => {
    const where = `changelog #${i} (${e && e.kind})`;
    if (!e || typeof e !== "object") { fail(where, "changelog-shape", "entry is not an object"); return; }
    if (typeof e.text !== "string" || !e.text.trim()) fail(where, "changelog-shape", "entry without text");
    if (!KINDS.has(e.kind)) fail(where, "changelog-shape", `unknown kind "${e.kind}"`);
    if (!ISO_DAY.test(e.date || "")) fail(where, "date-format", `date "${e.date}" is not YYYY-MM-DD`);
    else {
      if (prev && e.date < prev) fail(where, "date-order", `precedes previous entry (${prev})`);
      prev = e.date;
    }
    if (typeof e.label !== "string" || !e.label) fail(where, "changelog-shape", "entry without a display label");
    if (e.url != null && typeof e.url !== "string") fail(where, "changelog-shape", `url = ${JSON.stringify(e.url)}`);
  });
  return errors;
}

/* data/pew-econ-sentiment.json – the hand-curated Pew Global Attitudes
   economy-rating record (see its _about). Figures transcribe Pew's topline
   and methodology database, so the gate is internal consistency: the
   four-point split reconciles with the printed totals, chg reconciles with
   the same-series predecessor, and every wave either carries its full
   methodology or is a documented gap (panel June/March 2020–21 and phone
   2008/2013 have no methods-database row). */
export function validatePewSentiment() {
  const errors = [];
  const fail = (where, t, d) => errors.push({ type: t, poll: where, detail: d });
  let P = null;
  try { P = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "pew-econ-sentiment.json"), "utf8")); }
  catch { fail("pew-econ-sentiment.json", "pew-shape", "missing or unparseable"); return errors; }
  if (!Array.isArray(P.rows) || !P.rows.length) {
    fail("pew-econ-sentiment.json", "pew-shape", "rows is not a non-empty array");
    return errors;
  }
  // waves with no methodology row in Pew's methods database (documented in _about)
  const KNOWN_METHOD_GAPS = new Set(["June, 2020|panel", "March, 2021|panel", "Spring, 2008|phone", "Spring, 2013|phone"]);
  const seenWave = new Set();
  const prevV = {}, prevFw = {};
  P.rows.forEach((r, i) => {
    const where = `pew #${i} "${r.wave}" (${r.series})`;
    if (!r.wave || !["panel", "phone"].includes(r.series)) fail(where, "pew-shape", "needs {wave, series: panel|phone}");
    const key = `${r.wave}|${r.series}`;
    if (seenWave.has(key)) fail(where, "pew-shape", "duplicate wave+series");
    seenWave.add(key);
    for (const k of ["v", "good", "dk"]) {
      if (typeof r[k] !== "number" || r[k] < 0 || r[k] > 100) fail(where, "range", `${k} = ${r[k]}`);
    }
    if (r.v + r.good + r.dk > 101 || r.v + r.good > 100)
      fail(where, "total", `bad ${r.v} + good ${r.good} + dk ${r.dk} = ${r.v + r.good + r.dk}`);
    const d = r.detail || {};
    for (const k of ["vg", "sg", "sb", "vb"]) {
      if (typeof d[k] !== "number") fail(where, "detail", `detail.${k} missing`);
    }
    if (typeof d.vg === "number") {
      if (Math.abs(d.vg + d.sg - r.good) > 1) fail(where, "detail-sum", `vg+sg = ${d.vg + d.sg} vs printed TOTAL Good ${r.good}`);
      if (Math.abs(d.sb + d.vb - r.v) > 1) fail(where, "detail-sum", `sb+vb = ${d.sb + d.vb} vs printed TOTAL Bad ${r.v}`);
    }
    for (const k of ["fwStart", "fwEnd", "published"]) {
      if (r[k] != null && !ISO_DAY.test(r[k])) fail(where, "date-format", `${k} "${r[k]}" is not YYYY-MM-DD`);
    }
    if (r.fwStart && r.fwEnd && r.fwStart > r.fwEnd) fail(where, "date-order", `fwStart ${r.fwStart} after fwEnd ${r.fwEnd}`);
    if (r.fwEnd && r.published && r.published < r.fwEnd) fail(where, "date-order", `published ${r.published} before fwEnd ${r.fwEnd}`);
    if (!KNOWN_METHOD_GAPS.has(key)) {
      for (const k of ["fwStart", "fwEnd", "n", "marginError", "designEffect", "vendor"]) {
        if (r[k] == null) fail(where, "pew-method", `missing ${k} (no documented gap)`);
      }
    }
    if (r.n != null && (typeof r.n !== "number" || r.n < 100 || r.n > 1e5)) fail(where, "range", `n = ${r.n}`);
    if (r.marginError != null && (!(r.marginError > 0) || r.marginError > 10)) fail(where, "range", `marginError = ${r.marginError}`);
    if (r.designEffect != null && (!(r.designEffect >= 1) || r.designEffect > 5)) fail(where, "range", `designEffect = ${r.designEffect}`);
    const pv = prevV[r.series];
    if (pv == null ? r.chg != null : r.chg !== r.v - pv)
      fail(where, "pew-chg", `chg ${r.chg} ≠ v − same-series predecessor (${pv == null ? "none expected" : `${r.v} − ${pv} = ${r.v - pv}`})`);
    prevV[r.series] = r.v;
    if (r.fwEnd) {
      if (prevFw[r.series] && r.fwEnd < prevFw[r.series]) fail(where, "date-order", `fwEnd precedes previous ${r.series} row (${prevFw[r.series]})`);
      prevFw[r.series] = r.fwEnd;
    }
  });
  return errors;
}

/* data/roymorgan-direction-groups.json – Roy Morgan's "Analysis by …"
   prose splits, cache-extracted by extract-roymorgan-direction.mjs. Every
   wave's wave-date must already exist as a direction[] row in polls.json
   (the reader only files a wave whose national pair reconciles), and each
   wave must carry gender/vote and (for waves that print them) state
   extremes. Figures transcodes one anchor's prose, so the gate is shape +
   plausibility: every share 0-100, right+wrong ≤ 100.6 (rounding), and
   every wave that carries stateExtremes actually carries both a "high"
   and a "low" whose states are full names from the canonical set. */
export function validateDirectionGroups() {
  const errors = [];
  const fail = (where, t, d) => errors.push({ type: t, poll: where, detail: d });
  let G = null;
  try { G = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "roymorgan-direction-groups.json"), "utf8")); }
  catch { fail("roymorgan-direction-groups.json", "direction-groups-shape", "missing or unparseable"); return errors; }
  if (!G || typeof G !== "object" || !G.waves || typeof G.waves !== "object") {
    fail("roymorgan-direction-groups.json", "direction-groups-shape", "no waves object");
    return errors;
  }
  const P = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "polls.json"), "utf8"));
  const rmDirDates = new Set((P.direction || []).filter((d) => d.pollster === "Roy Morgan").map((d) => d.date));
  const STATES = new Set(["New South Wales", "Victoria", "Queensland", "South Australia", "Western Australia", "Tasmania"]);
  for (const [date, wave] of Object.entries(G.waves)) {
    const where = `roymorgan-direction-groups ${date}`;
    if (!ISO_DAY.test(date)) fail(where, "date-format", `date "${date}" is not YYYY-MM-DD`);
    if (!rmDirDates.has(date)) fail(where, "provenance", `no Roy Morgan direction[] row on ${date}`);
    if (!wave.gender && !wave.vote && !wave.stateExtremes)
      fail(where, "direction-groups-shape", "wave carries no split blocks at all");
    for (const [blockName, block] of [["gender", wave.gender], ["vote", wave.vote]]) {
      if (!block) continue;
      for (const [grp, cells] of Object.entries(block)) {
        const w2 = `${where} ${blockName}.${grp}`;
        for (const k of ["w", "r", "right", "wrong"]) {
          if (cells[k] != null) {
            if (typeof cells[k] !== "number" || cells[k] < 0 || cells[k] > 100) fail(w2, "range", `${k} = ${cells[k]}`);
          }
        }
        const r = cells.r ?? cells.right;
        const w = cells.w ?? cells.wrong;
        if ((typeof r === "number" && typeof w === "number") && r + w > 100.6)
          fail(w2, "total", `right+wrong ${r + w} > 100.6`);
      }
    }
    if (wave.stateExtremes != null) {
      const hi = wave.stateExtremes.highest, lo = wave.stateExtremes.lowest;
      if (!hi || !lo) fail(`${where} stateExtremes`, "direction-groups-shape", "carry both highest and lowest");
      else {
        for (const [tag, pt] of [["highest", hi], ["lowest", lo]]) {
          if (!STATES.has(pt.state)) fail(`${where} stateExtremes.${tag}`, "direction-groups-shape", `state "${pt.state}" not a full name`);
          if (typeof pt.w !== "number" || pt.w < 0 || pt.w > 100) fail(`${where} stateExtremes.${tag}`, "range", `w = ${pt.w}`);
        }
        if (hi.state === lo.state && hi.w !== lo.w)
          fail(`${where} stateExtremes`, "direction-groups-shape", `both are ${hi.state} but ${hi.w} ≠ ${lo.w}`);
      }
    }
  }
  return errors;
}

/* data/sec-direction-states.json – SEC Newgate's "Mood of the Nation"
   state splits. The extractor banks them as waves land; the gate is shape
   + plausibility: every state series is keyed by "YYYY-MM", every row
   carries a 0-100 right figure, wrong (when present) likewise, and every
   state's key is a member of the printed five-state label list. The store
   is referenced against itself only; the pieces the direction panel
   actually reads are emitted by gen-data. */
export function validateSecDirectionStates() {
  const errors = [];
  const fail = (where, t, d) => errors.push({ type: t, poll: where, detail: d });
  let S = null;
  try { S = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "sec-direction-states.json"), "utf8")); }
  catch { fail("sec-direction-states.json", "sec-direction-states-shape", "missing or unparseable"); return errors; }
  if (!S || typeof S !== "object" || !Array.isArray(S.states) || typeof S.series !== "object" || !S.series) {
    fail("sec-direction-states.json", "sec-direction-states-shape", "needs {states[], series{}}");
    return errors;
  }
  const SET = new Set(["NSW", "VIC", "QLD", "SA", "WA"]);
  for (const st of S.states) if (!SET.has(st)) fail(`sec-direction-states ${st}`, "sec-direction-states-shape", `state "${st}" not in ${[...SET].join("/")}`);
  for (const st of S.states) {
    const rows = S.series[st];
    if (!Array.isArray(rows)) { fail(`sec-direction-states ${st}`, "sec-direction-states-shape", "no series array"); continue; }
    let prev = null;
    for (const row of rows) {
      const where = `sec-direction-states ${st} ${row && row.month}`;
      if (!row || typeof row !== "object") { fail(where, "sec-direction-states-shape", "row is not an object"); continue; }
      if (!/^\d{4}-\d{2}$/.test(row.month || "")) fail(where, "date-format", `month "${row.month}" is not YYYY-MM`);
      else {
        if (prev && row.month < prev) fail(where, "date-order", `precedes previous row (${prev})`);
        prev = row.month;
      }
      for (const k of ["right", "wrong"]) {
        if (row[k] != null && (typeof row[k] !== "number" || row[k] < 0 || row[k] > 100)) fail(where, "range", `${k} = ${row[k]}`);
      }
      if (typeof row.right !== "number") fail(where, "sec-direction-states-shape", "row carries no right figure");
    }
  }
  return errors;
}

/* data/essential-direction-groups.json – Essential's national-mood
   breakdowns, banked from the CSV mirror by extract-essential-direction.mjs.
   Shape + plausibility + coverage: every wave key is a tracker-dated ISO
   day carrying its csv anchor date, the five bands plus total each hold
   r/w/u shares 0–100 summing to 100±2 (the extractor's own print
   tolerance), dirRow where present names an Essential direction[] row in
   polls.json, and every Essential direction row in polls.json is covered
   by exactly one wave's dirRow – a silently dropped wave. */
export function validateEssDirectionGroups() {
  const errors = [];
  const fail = (where, t, d) => errors.push({ type: t, poll: where, detail: d });
  let S = null;
  try { S = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "essential-direction-groups.json"), "utf8")); }
  catch { fail("essential-direction-groups.json", "ess-direction-groups-shape", "missing or unparseable"); return errors; }
  if (!S || typeof S !== "object" || !S.waves || typeof S.waves !== "object") {
    fail("essential-direction-groups.json", "ess-direction-groups-shape", "no waves object");
    return errors;
  }
  const P = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "polls.json"), "utf8"));
  const essDirDates = new Set((P.direction || []).filter((d) => d.pollster === "Essential").map((d) => d.date));
  const taken = new Map();
  for (const [date, wave] of Object.entries(S.waves)) {
    const where = `essential-direction-groups ${date}`;
    if (!ISO_DAY.test(date)) fail(where, "date-format", `date "${date}" is not YYYY-MM-DD`);
    if (!wave || typeof wave !== "object") { fail(where, "ess-direction-groups-shape", "wave is not an object"); continue; }
    if (!ISO_DAY.test(wave.csv || "")) fail(where, "date-format", `csv anchor "${wave.csv}" is not YYYY-MM-DD`);
    for (const grp of ["total", "Men", "Women", "18–34", "35–54", "55+"]) {
      const c = wave[grp];
      const w2 = `${where} ${grp}`;
      if (!c || typeof c !== "object") { fail(w2, "ess-direction-groups-shape", `missing ${grp} cell`); continue; }
      for (const k of ["r", "w", "u"]) {
        if (typeof c[k] !== "number" || c[k] < 0 || c[k] > 100) fail(w2, "range", `${k} = ${c[k]}`);
      }
      if (typeof c.r === "number" && typeof c.w === "number" && typeof c.u === "number" && Math.abs(c.r + c.w + c.u - 100) > 2)
        fail(w2, "total", `r+w+u ${c.r + c.w + c.u} out by more than 2`);
    }
    if (wave.dirRow != null) {
      if (!essDirDates.has(wave.dirRow)) fail(where, "provenance", `dirRow ${wave.dirRow} names no Essential direction[] row`);
      else {
        if (taken.has(wave.dirRow)) fail(where, "provenance", `dirRow ${wave.dirRow} is also claimed by wave ${taken.get(wave.dirRow)}`);
        taken.set(wave.dirRow, date);
      }
    }
  }
  for (const d of essDirDates) {
    if (!taken.has(d)) fail("essential-direction-groups.json", "coverage", `Essential direction row ${d} is claimed by no wave`);
  }
  return errors;
}

/* data/redbridge-direction-groups.json – RedBridge/Accent's AFR data-table
   statement national-direction breakdowns, machine-banked by
   .build/extract-redbridge-direction.mjs from the committed statement
   texts (the council-accepted methodology PDFs behind the poll rows'
   methodUrl). Shape + plausibility + reconciliation: every wave key is
   an ISO day on which polls.json has a RedBridge/Accent direction[]
   row; the wave's printed all-voters total must reconcile exactly with
   that row's right/wrong and its unsure (row's remainder); every
   printed cell is a {r,w,u} triple whose elements are 0–100 and sum to
   100±1 (the tables print integers). There is no wave-date roster: the
   extractor's own guard chain (a printed section ⇒ the row exists and
   matches; a recorded store wave re-reads figure for figure) is the
   coverage contract, so a newly printed section validates the moment it
   lands. The June-2025 direction row's provenance is the November
   statement's trend figure, not a table, so it has no wave here. */
export function validateRbDirectionGroups() {
  const errors = [];
  const fail = (where, t, d) => errors.push({ type: t, poll: where, detail: d });
  let S = null;
  try { S = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "redbridge-direction-groups.json"), "utf8")); }
  catch { fail("redbridge-direction-groups.json", "rb-direction-groups-shape", "missing or unparseable"); return errors; }
  if (!S || typeof S !== "object" || !S.waves || typeof S.waves !== "object") {
    fail("redbridge-direction-groups.json", "rb-direction-groups-shape", "no waves object");
    return errors;
  }
  const P = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "polls.json"), "utf8"));
  const rbDirByDate = new Map((P.direction || []).filter((d) => d.pollster === "RedBridge/Accent").map((d) => [d.date, d]));
  const ALLOWED_DIMS = new Set(["vote", "softness", "income", "ownership", "stress", "generation", "gender", "location", "religion", "education", "language", "birthplace"]);
  for (const [date, wave] of Object.entries(S.waves)) {
    const where = `redbridge-direction-groups ${date}`;
    if (!ISO_DAY.test(date)) fail(where, "date-format", `date "${date}" is not YYYY-MM-DD`);
    if (!wave || typeof wave !== "object") { fail(where, "rb-direction-groups-shape", "wave is not an object"); continue; }
    const row = rbDirByDate.get(date);
    if (!row) fail(where, "provenance", `no RedBridge/Accent direction[] row on ${date}`);
    if (!wave.src || typeof wave.src !== "object" || typeof wave.src.url !== "string" || typeof wave.src.tables !== "string")
      fail(where, "rb-direction-groups-shape", "src carries no {url, tables}");
    const total = wave.total;
    if (!total || typeof total !== "object") fail(`${where} total`, "rb-direction-groups-shape", "no total cell");
    else if (row) {
      if (total.r !== row.right) fail(`${where} total`, "reconcile", `total.r ${total.r} ≠ direction row right ${row.right}`);
      if (total.w !== row.wrong) fail(`${where} total`, "reconcile", `total.w ${total.w} ≠ direction row wrong ${row.wrong}`);
      const u = row.unsure != null ? row.unsure : (typeof row.right === "number" && typeof row.wrong === "number" ? 100 - row.right - row.wrong : null);
      if (u != null && total.u !== u) fail(`${where} total`, "reconcile", `total.u ${total.u} ≠ direction row unsure ${u}`);
    }
    if (!wave.dims || typeof wave.dims !== "object") { fail(where, "rb-direction-groups-shape", "no dims object"); continue; }
    for (const [dim, table] of Object.entries(wave.dims)) {
      if (!ALLOWED_DIMS.has(dim)) fail(where, "rb-direction-groups-shape", `unknown dim "${dim}"`);
      if (!table || typeof table !== "object") continue;
      for (const [grp, cell] of Object.entries(table)) {
        const w2 = `${where} ${dim}.${grp}`;
        if (!cell || typeof cell !== "object") { fail(w2, "rb-direction-groups-shape", "cell is not an object"); continue; }
        for (const k of ["r", "w", "u"]) {
          if (typeof cell[k] !== "number" || cell[k] < 0 || cell[k] > 100) fail(w2, "range", `${k} = ${cell[k]}`);
        }
        if (typeof cell.r === "number" && typeof cell.w === "number" && typeof cell.u === "number" && Math.abs(cell.r + cell.w + cell.u - 100) > 1)
          fail(w2, "total", `r+w+u ${cell.r + cell.w + cell.u} out by more than 1`);
      }
    }
  }
  return errors;
}

/* primary-history.json — the shares behind the flows-explained chart's
   "View: Primary votes" flip. Shape + fold contract only (the figures'
   AEC-derivation is pinned by test-primary-history.mjs): every view's
   years ascend with alp/lnp/oth drawn alongside as numbers; a named
   minor's cell is null (folded, never 0) or at the file's foldPt; and the
   shown lines plus oth rejoin to 100 per year — oth is the fold, not a
   counted series. */
export function validatePrimaryHistory() {
  const errors = [];
  const fail = (where, t, d) => errors.push({ type: t, poll: where, detail: d });
  let S = null;
  try { S = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "primary-history.json"), "utf8")); }
  catch { fail("primary-history.json", "primary-history-shape", "missing or unparseable"); return errors; }
  const FOLD = typeof S.foldPt === "number" && S.foldPt > 0 && S.foldPt < 20 ? S.foldPt : (fail("primary-history.json", "primary-history-shape", `bad foldPt ${S.foldPt}`), null);
  const GATED = ["grn", "onp", "dem", "dlp", "uap", "xnt", "jln", "ind"];
  const checkView = (where, v) => {
    if (!v || typeof v !== "object") { fail(where, "primary-history-shape", "view is not an object"); return; }
    if (typeof v.label !== "string" || typeof v.elections !== "string") fail(where, "primary-history-shape", "no label/elections copy");
    const ys = v.years;
    if (!Array.isArray(ys) || !ys.length || !ys.every((y) => Number.isInteger(y))) { fail(where, "primary-history-shape", "bad years"); return; }
    if (!ys.every((y, i) => i === 0 || y > ys[i - 1])) fail(where, "primary-history-shape", "years out of order");
    for (const k of ["alp", "lnp", "oth"]) {
      if (!Array.isArray(v[k]) || v[k].length !== ys.length) { fail(where, "primary-history-shape", `${k} not aligned to years`); continue; }
      v[k].forEach((x, i) => {
        if (typeof x !== "number" || x < 0 || x > 100) fail(where, "range", `${k}[${ys[i]}] = ${x} (must be a 0–100 number — only lines above the fold gap)`);
      });
    }
    const foldHere = (typeof v.foldPt === "number" && v.foldPt > 0 && v.foldPt <= 20) ? v.foldPt : FOLD;
    if (v.foldPt != null && foldHere !== v.foldPt) fail(where, "primary-history-shape", `bad record foldPt ${v.foldPt}`);
    if (v.seifa === true && v.foldPt == null) fail(where, "primary-history-shape", "a seifa fifth record carries no foldPt — its halved fold gate must be explicit");
    for (const k of GATED) {
      if (v[k] == null) continue;
      if (!Array.isArray(v[k]) || v[k].length !== ys.length) { fail(where, "primary-history-shape", `${k} not aligned to years`); continue; }
      v[k].forEach((x, i) => {
        if (x == null) return;
        if (foldHere != null && (typeof x !== "number" || x < foldHere - 0.005 || x > 100)) fail(where, "fold", `${k}[${ys[i]}] = ${x} (below the fold—fold to null, never a sub-fold count or 0)`);
      });
    }
    ys.forEach((y, i) => {
      const shown = ["alp", "lnp", ...GATED].reduce((t, k) => t + (Array.isArray(v[k]) && v[k][i] != null ? v[k][i] : 0), 0);
      if (Array.isArray(v.oth) && v.oth[i] != null && Math.abs(shown + v.oth[i] - 100) > 0.06)
        fail(where, "reconcile", `${y}: lines ${Math.round(shown * 100) / 100} + oth ${v.oth[i]} ≠ 100`);
    });
  };
  if (!S.fed || typeof S.fed !== "object") { fail("primary-history.json", "primary-history-shape", "no fed view"); return errors; }
  checkView("fed", S.fed);
  if (S.fed.sen) checkView("fed.sen", S.fed.sen); else fail("primary-history.json", "primary-history-shape", "no fed.sen view");
  if (!S.fed.states || typeof S.fed.states !== "object") fail("primary-history.json", "primary-history-shape", "no fed.states");
  else for (const [st, v] of Object.entries(S.fed.states)) checkView(`fed.${st}`, v);
  for (const [st, v] of Object.entries((S.fed.sen && S.fed.sen.states) || {})) checkView(`fed.sen.${st}`, v);
  /* the seat-class views (House only): four AEC classifications riding
     the divisions' 1996–2025 span, plus the five IRSAD fifths on the index
     series' own 2001–2025 — a division rides its election's own grouping */
  if (!S.fed.classes || typeof S.fed.classes !== "object") fail("primary-history.json", "primary-history-shape", "no fed.classes");
  else for (const [ck, v] of Object.entries(S.fed.classes)) {
    checkView(`fed.${ck}`, v);
    if (Array.isArray(v.years) && v.years.length) {
      const span0 = v.seifa ? 2001 : 1996;
      if (v.years[0] !== span0 || v.years[v.years.length - 1] !== 2025)
        fail(`primary-history.json fed.${ck}`, "primary-history-shape", `class span ${v.years[0]}–${v.years[v.years.length - 1]}, expected ${span0}–2025`);
    }
    if (v.seifa === true && typeof v.short !== "string")
      fail(`primary-history.json fed.${ck}`, "primary-history-shape", "seifa record short is not a string");
  }
  return errors;
}

/* 2pp-history.json — the shares behind the flows-explained chart's "View:
   2PP" flip (2026-10-23). Shape only (the figures' AEC recomposition is
   pinned at generation by aec-2pp-history.py and by test-2pp-history.mjs):
   every view's years ascend with alp/lnp drawn as 0–100 numbers that
   recommbine to 100 per year (the file emits Labor's cell; the Coalition
   cell is by construction 100 minus it — no third share exists in a
   two-party count). fed.sen is the IMPLIED senate two-party (no official
   one exists — the AEC counts no 2PP in the Senate): ATL tallies only,
   the four post-GVT events 2016–2025, national plus the eight states,
   no classes, and it must carry implied: true so no reader takes an
   estimate for a record. nswLc is its only state-upper-house sibling
   (2026-10-24): the implied NSW Legislative Council two-party over the
   NSWEC ballot record, 2011–2023 — the same implied:true contract, one
   jurisdiction, no state or class cuts. National spans 1972–2025 (canonical election
   records), the state and class cuts the AEC counts' 1996–2025 span
   (tppdiv downloads 2004 on; the statistics packs' HTPP tables
   1996–2001). */
export function validate2ppHistory() {
  const errors = [];
  const fail = (where, t, d) => errors.push({ type: t, poll: where, detail: d });
  let S = null;
  try { S = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "2pp-history.json"), "utf8")); }
  catch { fail("2pp-history.json", "2pp-history-shape", "missing or unparseable"); return errors; }
  const checkView = (where, v) => {
    if (!v || typeof v !== "object") { fail(where, "2pp-history-shape", "view is not an object"); return; }
    if (typeof v.label !== "string" || typeof v.elections !== "string") fail(where, "2pp-history-shape", "no label/elections copy");
    const ys = v.years;
    if (!Array.isArray(ys) || !ys.length || !ys.every((y) => Number.isInteger(y))) { fail(where, "2pp-history-shape", "bad years"); return; }
    if (!ys.every((y, i) => i === 0 || y > ys[i - 1])) fail(where, "2pp-history-shape", "years out of order");
    for (const k of ["alp", "lnp"]) {
      if (!Array.isArray(v[k]) || v[k].length !== ys.length) { fail(where, "2pp-history-shape", `${k} not aligned to years`); continue; }
      v[k].forEach((x, i) => {
        if (typeof x !== "number" || x < 0 || x > 100) fail(where, "range", `${k}[${ys[i]}] = ${x} (must be a 0–100 number)`);
      });
    }
    if (Array.isArray(v.alp) && Array.isArray(v.lnp) && v.alp.length === ys.length && v.lnp.length === ys.length)
      ys.forEach((y, i) => {
        if (Math.abs(v.alp[i] + v.lnp[i] - 100) > 0.02)
          fail(where, "reconcile", `${y}: alp ${v.alp[i]} + lnp ${v.lnp[i]} ≠ 100 (a two-party pair sums to the count)`);
      });
  };
  if (!S.fed || typeof S.fed !== "object") { fail("2pp-history.json", "2pp-history-shape", "no fed view"); return errors; }
  checkView("fed", S.fed);
  if (S.fed.years && S.fed.years.length >= 2) {
    if (S.fed.years[0] !== 1972 || S.fed.years[S.fed.years.length - 1] !== 2025)
      fail("2pp-history.json", "2pp-history-shape", `national span ${S.fed.years[0]}–${S.fed.years[S.fed.years.length - 1]}, expected 1972–2025`);
  }
  for (const sect of ["states", "classes"]) {
    if (!S.fed[sect] || typeof S.fed[sect] !== "object") { fail("2pp-history.json", "2pp-history-shape", `no fed.${sect}`); continue; }
    for (const [k, v] of Object.entries(S.fed[sect])) {
      checkView(`fed.${k}`, v);
      /* the IRSAD fifths ride the classes bank on the index series' own
         2001–2025 span; every other cut joins the AEC counts at 1996 */
      const cutStart = v.seifa ? 2001 : 1996;
      if (v.seifa === true && sect !== "classes")
        fail(`2pp-history.json fed.${k}`, "2pp-history-shape", "seifa flag outside the classes bank");
      if (sect === "classes" && v.seifa === true && v.short !== undefined && typeof v.short !== "string")
        fail(`2pp-history.json fed.${k}`, "2pp-history-shape", "seifa record short is not a string");
      if (Array.isArray(v.years) && v.years.length && (v.years[0] !== cutStart || v.years[v.years.length - 1] !== 2025))
        fail(`2pp-history.json fed.${k}`, "2pp-history-shape", `cut span starts ${v.years[0]}, expected ${v.seifa ? "the index series' 2001–2025" : "the AEC counts' 1996–2025"}`);
    }
  }
  // fed.sen: the implied Senate two-party (never counted — pinned hard so no
  // reader mistakes the estimate for a record, and no classes are ever cut
  // from a chamber the classifications don't join to).
  const SEN_YRS = [2016, 2019, 2022, 2025];
  const SEN_STATE_KEYS = ["nsw", "vic", "qld", "wa", "sa", "tas", "act", "nt"];
  const sen = S.fed.sen;
  if (!sen || typeof sen !== "object") { fail("2pp-history.json", "2pp-history-shape", "no fed.sen implied view"); return errors; }
  if (sen.implied !== true) fail("2pp-history.json fed.sen", "2pp-history-shape", "senate view must carry implied: true — it is an estimate, not a count");
  if (sen.classes) fail("2pp-history.json fed.sen", "2pp-history-shape", "no division-class cuts exist for the Senate");
  checkView("fed.sen", sen);
  if (JSON.stringify(sen.years) !== JSON.stringify(SEN_YRS))
    fail("2pp-history.json fed.sen", "2pp-history-shape", `senate years ${JSON.stringify(sen.years)}, expected the post-GVT events [2016,2019,2022,2025]`);
  const senStates = sen.states && typeof sen.states === "object" ? sen.states : null;
  if (!senStates || JSON.stringify(Object.keys(senStates).sort()) !== JSON.stringify([...SEN_STATE_KEYS].sort())) {
    fail("2pp-history.json fed.sen", "2pp-history-shape", "senate view must hold exactly the eight state cuts");
  } else {
    for (const [k, v] of Object.entries(senStates)) {
      if (typeof v.short !== "string" || !v.short) fail(`2pp-history.json fed.sen.${k}`, "2pp-history-shape", "state cut carries no short name");
      checkView(`fed.sen.${k}`, v);
      if (JSON.stringify(v.years) !== JSON.stringify(SEN_YRS))
        fail(`2pp-history.json fed.sen.${k}`, "2pp-history-shape", `state cut years ${JSON.stringify(v.years)}, expected [2016,2019,2022,2025]`);
    }
  }
  // nswLc: the implied senate view's only state-upper-house sibling (the
  // NSWEC's ballot-level record is the only state upper-house count of
  // voters' own preferences) — the same implied:true contract, one
  // jurisdiction's view, no state or class cuts beside it.
  const LC_YRS = [2011, 2015, 2019, 2023];
  const lc = S.nswLc;
  if (!lc || typeof lc !== "object") { fail("2pp-history.json", "2pp-history-shape", "no nswLc implied view"); return errors; }
  if (lc.implied !== true) fail("2pp-history.json nswLc", "2pp-history-shape", "the council view must carry implied: true — it is an estimate, not a count");
  if (lc.states || lc.classes) fail("2pp-history.json nswLc", "2pp-history-shape", "one jurisdiction's implied view: no state or class cuts");
  checkView("nswLc", lc);
  if (JSON.stringify(lc.years) !== JSON.stringify(LC_YRS))
    fail("2pp-history.json nswLc", "2pp-history-shape", `council years ${JSON.stringify(lc.years)}, expected the banked elections [2011,2015,2019,2023]`);
  return errors;
}

// argv[1] is undefined under `node -e 'import("…validate.mjs")'` – the
// gate must skip the CLI block there, not throw on path.resolve().
if (process.argv[1] != null && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const D = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "polls.json"), "utf8"));
  const { errors, exempted, orphans } = validate(D);
  errors.push(...validateChangelog());
  errors.push(...validatePrimaryHistory());
  errors.push(...validate2ppHistory());
  errors.push(...validatePewSentiment());
  errors.push(...validateDirectionGroups());
  errors.push(...validateSecDirectionStates());
  errors.push(...validateEssDirectionGroups());
  errors.push(...validateRbDirectionGroups());
  console.log(`polls ${D.polls.length} · errors ${errors.length} · documented exceptions ${exempted.length} · leadership-only rows ${orphans.length}`);
  if (errors.length) { console.error("\nERRORS:"); errors.forEach((e) => console.error(`  ${e.type.padEnd(13)} ${e.poll} – ${e.detail}`)); }
  if (exempted.length) { console.log("\nDocumented exceptions (expected, not problems):"); exempted.forEach((e) => console.log(`  ${e.type.padEnd(13)} ${e.poll} – ${e.detail}`)); }
  // the errors again, last: the wrappers append this output to their logs and
  // CI keeps only each log's tail, where ~270 exception lines had pushed the
  // ERRORS block out of view (Essential's 2026-09-29 15:01Z failure left no
  // trace of which rule failed)
  if (errors.length && exempted.length) {
    console.error(`\nERRORS (repeated after the exceptions): ${errors.length}`);
    errors.forEach((e) => console.error(`  ${e.type.padEnd(13)} ${e.poll} – ${e.detail}`));
  }
  process.exit(errors.length ? 1 : 0);
}
