/* Unit tests for demo-watch.mjs – the reminders watch over the hand-entered
   houses' breakdowns behind data/demographics.json (Roy Morgan, Newspoll,
   Fox & Hedgehog, Freshwater) – against the committed findings caches in
   .build/roymorgan-src and synthetic poll rows. The signatures must hit the
   shapes the real releases have taken (10363's per-state subsamples,
   10341's Country of Birth title) and miss plain direction prose (10328's
   "Analysis by gender … wrong direction"). No network.
   Run: node .build/test-demo-watch.mjs */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { ROOT } from "./crosstab-sources.mjs";
import { rmSignsWhy, rmFindingId, watchReminders } from "./demo-watch.mjs";

const NOW = new Date("2026-10-09T00:00:00Z");

// ---- signatures against the real caches -------------------------------------
const rmDir = path.join(ROOT, ".build", "roymorgan-src");
const load = (id) => JSON.parse(readFileSync(path.join(rmDir, readdirSync(rmDir).find((x) => x.startsWith(`release-${id}-`))), "utf8"));
const hit = rmSignsWhy(load("10363"));
assert.ok(hit && hit.includes("per-state subsamples"), `findings 10363's (n=765)-style state tables trip the subsample signature (got ${JSON.stringify(hit)})`);
for (const id of ["10328", "10333", "10343", "10353"])
  assert.equal(rmSignsWhy(load(id)), null, `findings ${id} trips nothing (its gender line is direction prose, not a table)`);
// tags must not hide a real shape: the cache keeps HTML
assert.ok(/<[^>]+>/.test(load("10363").content), "the committed cache is HTML – the signatures run on it stripped");
console.log("1. RM release signatures: OK");

// finding id from a poll row's url
assert.equal(rmFindingId("https://www.roymorgan.com/findings/10363-a-lnp-lead-in-2-party-preferred"), "10363");
assert.equal(rmFindingId("https://www.roymorgan.com/morgan-poll"), null);

// ---- (a) the pooled-aggregate key match --------------------------------------
const POLL = { pollster: "Newspoll (pooled)", date: "2026-09-18" };        // 21 days before NOW: past NP_POOLED_LAG_DAYS
const rmReleaseFor10363 = (id) => (id === "10363" ? load("10363") : null);
const watch = (over = {}) => watchReminders({
  polls: [], waves: [], knownSkip: {}, rmReleaseFor: () => null, now: NOW, ...over,
});
{
  const got = watch({ polls: [POLL] });
  assert.equal(got.length, 1, "an unentered pooled row 21 days old reminds");
  assert.ok(got[0].startsWith("Newspoll (pooled)|2026-09-18: "), "the reminder names the wave key");
}
assert.equal(watch({ polls: [POLL], waves: [POLL] }).length, 0, "the row on file clears it");
assert.equal(watch({ polls: [POLL], knownSkip: { "Newspoll (pooled)|2026-09-18": "checked, no table" } }).length, 0, "KNOWN_SKIP clears it");
assert.equal(watch({ polls: [{ pollster: "Newspoll (pooled)", date: "2026-10-05" }] }).length, 0, "a fresher aggregate still gets its grace");
assert.equal(watch({ polls: [{}] }).length, 0);
{
  const got = watch({ polls: [{ pollster: "Roy Morgan (pooled)", date: "2026-07-31" }] });
  assert.equal(got.length, 1, "Roy Morgan (pooled) rows are watched the same way");
}
console.log("2. pooled-aggregate key match: OK");

// ---- (a2) the Newspoll-quiet cadence -----------------------------------------
{
  const quiet = watch({ polls: [{ pollster: "Newspoll (pooled)", date: "2026-05-01" }], waves: [{ pollster: "Newspoll (pooled)", date: "2026-05-01" }] });
  assert.equal(quiet.length, 1, "the old wave on file clears the row reminder, leaving the cadence one");
  assert.ok(quiet[0].startsWith("Newspoll (pooled): no quarterly aggregate in 161 days"), `cadence reminder counts the silence (got ${JSON.stringify(quiet)})`);
}
assert.equal(watch({ polls: [POLL], waves: [POLL] }).length, 0, "a quarter this old is in rhythm: no cadence");
console.log("3. Newspoll cadence: OK");

// ---- (b) the Roy Morgan findings-cache probe ---------------------------------
const RM = { pollster: "Roy Morgan", date: "2026-09-27", url: "https://www.roymorgan.com/findings/10363-x" };
{
  const got = watch({ polls: [RM], rmReleaseFor: rmReleaseFor10363 });
  assert.equal(got.length, 1, "a fresh RM wave whose cache carries state subsamples reminds");
  assert.ok(got[0].startsWith("Roy Morgan|2026-09-27: ") && got[0].includes("per-state subsamples"), `reminder names the wave and why (got ${JSON.stringify(got)})`);
}
assert.equal(watch({ polls: [RM], waves: [RM], rmReleaseFor: rmReleaseFor10363 }).length, 0, "the wave on file clears it");
assert.equal(watch({ polls: [RM], knownSkip: { "Roy Morgan|2026-09-27": "checked, no table" }, rmReleaseFor: rmReleaseFor10363 }).length, 0, "KNOWN_SKIP clears it");
assert.equal(watch({ polls: [RM], rmReleaseFor: () => load("10328") }).length, 0, "a direction-prose cache stays silent");
assert.equal(watch({ polls: [RM] }).length, 0, "no cache: silent");
assert.equal(watch({ polls: [{ ...RM, url: "https://www.roymorgan.com/morgan-poll" }], rmReleaseFor: rmReleaseFor10363 }).length, 0, "no finding id: silent");
assert.equal(watch({ polls: [{ ...RM, date: "2026-07-01" }], rmReleaseFor: rmReleaseFor10363 }).length, 0, "older than RM_WATCH_DAYS: the probe only covers fresh arrivals");
console.log("4. RM probe: OK");

// ---- DEMO_STATUS carries reminders -------------------------------------------
const src = readFileSync(path.join(ROOT, ".build", "demographics.mjs"), "utf8");
assert.ok(src.includes('console.log("reminder", r)'), "reminders print to the log the wrapper greps");
assert.ok(/dropped, reminders, skipped/.test(src), "the DEMO_STATUS line carries reminders where parse_reminders reads them");
console.log("5. DEMO_STATUS carries reminders: OK");

console.log("test-demo-watch PASS");
