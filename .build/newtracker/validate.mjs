/* validate.mjs – integrity gate over data/polls.json, run as the first step of
   every build. Replaces the old runtime console check in auspol-polling.html,
   which reported the same 7 known-good rows on every page load and had
   therefore stopped being read.

   The rule here: anything a check flags is either a real mistake (build fails)
   or a documented, deliberate exception recorded IN the data via `sumNote` /
   pollsterRules. There is no third category, so a clean run means clean.
   Exported so build.mjs can call it; runnable on its own for a quick check. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");

export function validate(D) {
  const errors = [], exempted = [];
  const rules = D.pollsterRules || {};
  const CORE = ["alp", "lnp", "grn", "onp"];
  const ALL = ["alp", "lnp", "grn", "onp", "ind", "oth"];
  const n0 = (v) => (v == null ? 0 : v);

  let prevTs = -Infinity, prevDate = null;
  const seen = new Set();

  D.polls.forEach((p, i) => {
    const where = `#${i} ${p.date} · ${p.pollster}`;
    const fail = (t, d) => errors.push({ type: t, poll: where, detail: d });
    const excuse = (t, d) => exempted.push({ type: t, poll: where, detail: d, why: p.sumNote });

    // 1. full primary sets total ~100 (majors-only polls are partial by design)
    if (CORE.every((k) => p[k] != null)) {
      const sum = ALL.reduce((s, k) => s + n0(p[k]), 0);
      if (Math.abs(sum - 100) > 2)
        (p.sumNote ? excuse : fail)("primary-sum", `Σ shares = ${sum.toFixed(1)} (expected ~100)`);
    }
    // 2. a reported 2PP pair totals ~100, unless the house publishes an
    //    undecided-inclusive 2PP (Essential does – declared in pollsterRules)
    if (p.tpp_alp != null && p.tpp_lnp != null) {
      const t = p.tpp_alp + p.tpp_lnp;
      if (Math.abs(t - 100) > 1) {
        const ok = rules[p.pollster]?.tppIncludesUndecided || p.sumNote;
        (ok ? excuse : fail)("2pp-sum", `2PP ${p.tpp_alp} + ${p.tpp_lnp} = ${t.toFixed(1)} (expected ~100)`);
      }
    }
    // 3. dates parse, run oldest→newest, and fieldwork starts before it ends
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
    // 5. real polls carry a sample size. Rows the updaters assimilate from a
    //    house's published dataset legitimately have none (the feed doesn't
    //    carry one) and declare themselves via `assimilated` instead.
    if (!p.isElection && !p.assimilated && !(p.sample > 0)) fail("sample", `sample = ${p.sample}`);
  });

  // 6. direction rows are a proportion split
  (D.direction || []).forEach((d, i) => {
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

     Constants come from the AEC 2022 TCP flow file (Event 27966,
     HouseTcpFlowByPartyDownload-27966.txt), aggregated from per-party flows:
       GRN → ALP 83.71% / L·NP 16.29%        (1,199,015 vs 233,317 votes)
       ON  → ALP 35.33% / L·NP 64.67%        (  243,683 vs 446,107)
       IND → ALP 58.32% / L·NP 41.68%        (  174,234 vs 124,523)
       (ind+oth lumped) → ALP 44.30%         (  661,807 vs 832,212)
     The lumped figure is what runs here: polls that split IND from OTH don't
     all publish both series, and using only the lumped bucket keeps the check
     uniform across houses. An attempted split-IND variant sits FURTHER off
     published 2PP (mean |house bias| 1.80 vs 1.14 for lumped vs 1.32 for the
     old {0.82,0.35,0.50} placeholders) – poll-house 2PPs are themselves
     respondent-allocated and don't match raw AEC flows. Slack of ±3 keeps
     this an inversion check rather than a flow check. */
  const FLOW = { grn: 0.837, onp: 0.353, oth: 0.443 };
  const impliedAlp = (p) => {
    if (p.alp == null) return null;
    const oth = n0(p.ind) + n0(p.oth);
    return p.alp + FLOW.grn * n0(p.grn) + FLOW.onp * n0(p.onp) + FLOW.oth * oth;
  };
  const orientation = (rows, label, alpKey, tppKey) => {
    const ds = rows.map((p) => {
      const im = impliedAlp({ ...p, alp: p[alpKey] });
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

  // 9. every leadership row should key onto a poll's fieldwork-end date, or it
  //    is a leadership-only wave – flagged as info, since a drifted date looks
  //    exactly like one (the Essential Dec-2025 / Mar-2026 bug)
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
