/* ====================================================================
   COVERAGE DOCTOR — the triage layer above check-coverage.mjs

   check-coverage answers one raw question ("is a wave on the witness that we
   don't have?") and exits 0/1/3. This doctor runs that check IN-PROCESS (the
   .build/logs/coverage-latest.json artifact is gitignored, so another job
   could never read it — anything that classifies the result must invoke the
   check itself) and routes the outcome to one of four classes, each with its
   own consequence in .github/workflows/coverage-check.yml:

     exit 0  clean        nothing on the witness is unaccounted for
     exit 1  monitoring-  the CHECK could not run (Wikipedia unreachable, its
             outage       table changed shape, or no parseable status). NOT
                          evidence of a missing poll, and the coverage
                          watchdog's standing rule is inconclusive ≠ alarm:
                          logged for the record, the workflow stays green.
                          Deliberately the same code the checker itself uses
                          for inconclusive — a class, not a failure.
     exit 2  defect       POSITIVE evidence we missed a real wave: the
                          witness lists one we lack, or a house is overdue
                          AND the witness has a newer wave from it. This is
                          the only class that fires the Matilda repair job -
                          a repair agent gets evidence with dates on it,
                          never a vague "something is silent".
     exit 4  report-only  a house is past its own cadence and the witness
                          agrees it has published nothing yet - genuine
                          silence, unexplained by any confirmed absence.
                          Worth one line in the run summary, never a repair:
                          firing an API-spending agent at a publisher who
                          simply hasn't published teaches the system to cry
                          wolf. NOT check-coverage's own 3 - that code means
                          "actionable" there, so report-only got its own
                          code rather than overloading it.

   What makes silence CLEAN instead of class 4: the house's own record of
   confirmed absences. pollsterRules.skippedSlots (dated houses, written by
   essential-confirm-skip.mjs) and .skippedMonths (calendar-month houses,
   demosau-confirm-skip.mjs) name slots an agent has POSITIVELY verified
   never filed, and `stopped` names a house offline by declaration. An
   overdue house whose silence a confirmed skip covers is explained, not
   suspicious.

   A missing wave is never explained away by those records: evidence that a
   wave EXISTS beats our record that a slot was absent (a rotten
   skip-confirm is itself a defect), so class 2 takes everything the
   witness supports.

   Output: a human summary plus a DOCTOR_STATUS {json} line for the log.
   Env seams for testing: DOCTOR_CHECK_CMD replaces the check command,
   DOCTOR_POLLS replaces data/polls.json.
   ==================================================================== */

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const POLLS = process.env.DOCTOR_POLLS || ROOT + "data/polls.json";

const res = process.env.DOCTOR_CHECK_CMD
  ? spawnSync(process.env.DOCTOR_CHECK_CMD, { cwd: ROOT, encoding: "utf8", shell: true })
  : spawnSync(process.execPath, [".build/check-coverage.mjs", "--quiet"], { cwd: ROOT, encoding: "utf8" });

const statusLine = ((res.stdout || "") + "\n" + (res.stderr || ""))
  .split("\n").filter((l) => l.startsWith("COVERAGE_STATUS ")).pop();
let st = null;
if (statusLine) { try { st = JSON.parse(statusLine.slice("COVERAGE_STATUS ".length)); } catch { /* reported below */ } }

const emit = (verdict, detail) => console.log("DOCTOR_STATUS " + JSON.stringify({ verdict, checked: st?.checked ?? null, ...detail }));

// class 1 — the check itself never produced a verdict
if (!st || res.status === 1) {
  const why = st?.error || `check-coverage exited ${res.status} without a parseable COVERAGE_STATUS line`;
  console.log(`doctor class 1 (monitoring-outage): the witness check is inconclusive — ${why}`);
  emit(1, { reason: why, error: st?.error ?? null });
  process.exit(1);
}

const rules = JSON.parse(readFileSync(POLLS, "utf8")).pollsterRules || {};
/* A silence is explained when the house's own confirmed-absence record covers
   the period since its last wave: a dated slot day later than that wave, a
   slot month after it, or a hand declaration that the house has stopped. */
const explanation = (house, last) => {
  const r = rules[house] || {};
  if (r.stopped) return "declared stopped in pollsterRules";
  if ((r.skippedSlots || []).some((d) => d > last)) return "slot day(s) confirmed absent at the publisher";
  if ((r.skippedMonths || []).some((m) => m + "-01" > last)) return "slot month(s) confirmed absent at the publisher";
  return null;
};

// class 2 — witness-supported evidence of a missed wave
const defects = [];
for (const m of st.missing || []) {
  defects.push(`${m.date}  ${m.house}${m.mrp ? " (MRP)" : ""} — listed by the witness, not in polls.json`);
}
for (const o of st.overdue || []) {
  if (o.witness_newer) defects.push(`${o.house}: ${o.days_since}d quiet (cadence ~${o.cadence_days}d) and the witness has a ${o.witness_newer} wave — missed, not quiet`);
}
if (defects.length) {
  console.log(`doctor class 2 (defect): ${defects.length} witness-supported gap(s) — repair fires:`);
  for (const d of defects) console.log("  " + d);
  emit(2, { defects });
  process.exit(2);
}

// classes 4 / 0 — quiet houses: unjustified silence vs explained absence
const silent = [], explainedQuiet = [];
for (const o of st.overdue || []) {
  const why = explanation(o.house, o.last);
  const line = `${o.house}: last wave ${o.last}, ${o.days_since}d ago (cadence ~${o.cadence_days}d), witness agrees nothing newer`;
  if (why) explainedQuiet.push(`${line} — explained: ${why}`);
  else silent.push(`${line} — UNEXPLAINED silence`);
}
for (const q of explainedQuiet) console.log("doctor: explained quiet — " + q);
if (silent.length) {
  console.log(`doctor class 4 (report-only): ${silent.length} house(s) silent with no confirmed absence — never a repair:`);
  for (const s of silent) console.log("  " + s);
  emit(4, { silent });
  process.exit(4);
}

console.log(`doctor class 0 (clean): ${Object.keys(st.houses || {}).length} houses checked against ${st.witness_waves} witness waves; nothing missing, no unexplained silence`);
emit(0, {});
process.exit(0);
