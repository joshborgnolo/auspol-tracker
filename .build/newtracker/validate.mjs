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
import { impliedAlp2pp } from "./flows.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const ISO_PUBLISHED = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/;
// ~1 day of grace: an 8pm UTC build should not fail a poll dated the
// Australian morning that follows its UTC day.
const TOMORROW = new Date(Date.now() + 24 * 3600e3).toISOString().slice(0, 10);

export function validate(D) {
  const errors = [], exempted = [];
  const rules = D.pollsterRules || {};
  const CORE = ["alp", "lnp", "grn", "onp"];
  const ALL = ["alp", "lnp", "grn", "onp", "ind", "oth"];
  const RANGES = [["tpp_alp", 30, 70], ["tpp_lnp", 30, 70], ...ALL.map((k) => [k, 0, 70])];
  const n0 = (v) => (v == null ? 0 : v);

  // Pollsters tracked in polls[] that legitimately carry no pollsterRules
  // entry (they have no extractor/routing logic — most are one-off or
  // special-purpose labels). Anything else is a typo splitting a series.
  const KNOWN_POLLSTERS = new Set([
    ...Object.keys(rules),
    "Election Result",   // isElection rows: the result, not a poll
    "Spectre Strategy",  // boutique house, no automated feed
    "Wolf & Smith",      // boutique house (AFR-commissioned, ad hoc)
    "Redbridge",         // pre-"RedBridge / Accent" Australia Institute waves
    "Roy Morgan (SMS)",  // single SMS-mode Morgan release, mode tag not a house
    "Agenda C Synesis",  // one-off news.com.au poll
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
    if (p.tpp_flows != null && !["Roy Morgan", "RedBridge / Accent"].includes(p.pollster))
      fail("flows-pollster", `tpp_flows on a row for ${p.pollster}`);
    // 2b2. tpp3 (Fox & Hedgehog's three-cornered preferred) carries all
    //      three slices or none, each in bounds, and the trio sums ~100 –
    //      the same sum discipline as the 2PP pair.
    if (p.tpp3 != null) {
      if (p.pollster !== "Fox & Hedgehog")
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
    if (p.methodUrl != null && !["YouGov", "Newspoll", "RedBridge / Accent", "RedBridge / Accent (MRP)", "DemosAU", "DemosAU (MRP)", "Essential", "Fox & Hedgehog"].includes(p.pollster))
      fail("method-url", `methodUrl on a row for ${p.pollster}`);
    // 2d. sampleEff (the house's published effective sample size) is a whole
    //     number never below 200 and never above its own raw sample – a
    //     design effect can only deflate. Absent-not-filled means the house
    //     files no such figure (or, for DemosAU/YouGov MRPs, "n/a for MRP"),
    //     it is never a zero.
    if (p.sampleEff != null && (!Number.isInteger(p.sampleEff) || p.sampleEff < 200))
      fail("sample-eff", `sampleEff = ${JSON.stringify(p.sampleEff)}`);
    if (p.sampleEff != null && p.sample > 0 && p.sampleEff > p.sample * 1.05)
      fail("sample-eff", `sampleEff ${p.sampleEff} exceeds raw sample ${p.sample}`);
    // 3. dates are ISO YYYY-MM-DD, not in the future, run oldest→newest, and
    //    fieldwork starts before it ends
    if (!ISO_DAY.test(p.date)) fail("date-format", `date "${p.date}" is not YYYY-MM-DD`);
    if (p.dateStart != null && !ISO_DAY.test(p.dateStart)) fail("date-format", `dateStart "${p.dateStart}" is not YYYY-MM-DD`);
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
    // 4. duplicate date+pollster – usually an accidental paste
    const key = p.date + "|" + p.pollster;
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
      const rk = p.pollster + "|" + p.published;
      if (seenRelease.has(rk))
        fail("same-release", `shares published=${p.published} with the ${seenRelease.get(rk)} row – one release, two waves`);
      seenRelease.set(rk, p.date);
    }
    // 5. real polls carry a sample size. Rows the updaters assimilate from a
    //    house's published dataset legitimately have none (the feed doesn't
    //    carry one) and declare themselves via `assimilated` instead.
    if (!p.isElection && !p.assimilated && !(p.sample > 0)) fail("sample", `sample = ${p.sample}`);
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

  // 6. direction rows are a proportion split
  (D.direction || []).forEach((d, i) => {
    if (d.date != null && !ISO_DAY.test(d.date))
      errors.push({ type: "date-format", poll: `direction #${i} ${d.date} · ${d.pollster}`, detail: `date "${d.date}" is not YYYY-MM-DD` });
    const sum = n0(d.right) + n0(d.wrong) + n0(d.unsure);
    if (Math.abs(sum - 100) > 1)
      errors.push({ type: "direction-sum", poll: `direction #${i} ${d.date} · ${d.pollster}`, detail: `Σ = ${sum.toFixed(1)}` });
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
      const im = impliedAlp2pp({ ...p, alp: p[alpKey] });
      return im == null || p[tppKey] == null ? null : p[tppKey] - im;
    }).filter((v) => v != null);
    if (ds.length < 20) return;                       // too few to judge a series
    const m = ds.reduce((a, b) => a + b, 0) / ds.length;
    if (Math.abs(m) > 3)
      errors.push({ type: "2pp-flip", poll: label,
        detail: `2PP averages ${m > 0 ? "+" : ""}${m.toFixed(1)} vs what its own primaries imply `
              + `over ${ds.length} rows – the ALP/L-NP pair is probably swapped` });
  };
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
      if (!CORE.every((k) => r[k] != null)) return;
      const sum = ALL.reduce((s, k) => s + n0(r[k]), 0);
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
  //    polls[].
  for (const [rows, label] of [[D.ppm, "ppm"], [D.approval, "approval"]]) {
    (rows || []).forEach((r, i) => {
      if (!ISO_DAY.test(r.date))
        errors.push({ type: "date-format", poll: `${label} #${i} ${r.date} · ${r.firm}`, detail: `date "${r.date}" is not YYYY-MM-DD` });
    });
  }
  const pollKeys = new Set(D.polls.map((p) => p.date + "|" + p.pollster));
  const orphans = [...D.ppm, ...D.approval]
    .filter((r) => !pollKeys.has(r.date + "|" + r.firm))
    .map((r) => `${r.date} · ${r.firm}`);

  return { errors, exempted, orphans: [...new Set(orphans)] };
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const D = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "polls.json"), "utf8"));
  const { errors, exempted, orphans } = validate(D);
  console.log(`polls ${D.polls.length} · errors ${errors.length} · documented exceptions ${exempted.length} · leadership-only rows ${orphans.length}`);
  if (errors.length) { console.error("\nERRORS:"); errors.forEach((e) => console.error(`  ${e.type.padEnd(13)} ${e.poll} – ${e.detail}`)); }
  if (exempted.length) { console.log("\nDocumented exceptions (expected, not problems):"); exempted.forEach((e) => console.log(`  ${e.type.padEnd(13)} ${e.poll} – ${e.detail}`)); }
  process.exit(errors.length ? 1 : 0);
}
