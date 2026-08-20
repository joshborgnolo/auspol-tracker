/* validate.mjs — integrity gate over data/polls.json, run as the first step of
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
    //    undecided-inclusive 2PP (Essential does — declared in pollsterRules)
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
    // 4. duplicate date+pollster — usually an accidental paste
    const key = p.date + "|" + p.pollster;
    if (seen.has(key)) fail("duplicate", "same date + pollster already present");
    seen.add(key);
    // 5. real polls carry a sample size
    if (!p.isElection && !(p.sample > 0)) fail("sample", `sample = ${p.sample}`);
  });

  // 6. direction rows are a proportion split
  (D.direction || []).forEach((d, i) => {
    const sum = n0(d.right) + n0(d.wrong) + n0(d.unsure);
    if (Math.abs(sum - 100) > 1)
      errors.push({ type: "direction-sum", poll: `direction #${i} ${d.date} · ${d.pollster}`, detail: `Σ = ${sum.toFixed(1)}` });
  });

  // 7. every leadership row should key onto a poll's fieldwork-end date, or it
  //    is a leadership-only wave — flagged as info, since a drifted date looks
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
  if (errors.length) { console.error("\nERRORS:"); errors.forEach((e) => console.error(`  ${e.type.padEnd(13)} ${e.poll} — ${e.detail}`)); }
  if (exempted.length) { console.log("\nDocumented exceptions (expected, not problems):"); exempted.forEach((e) => console.log(`  ${e.type.padEnd(13)} ${e.poll} — ${e.detail}`)); }
  process.exit(errors.length ? 1 : 0);
}
