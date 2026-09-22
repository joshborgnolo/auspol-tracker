/* Unit test for tune-schedules.mjs — the schedule tuner behind
   schedule-tune.yml. Runs the tuner's exported `tune()` against a synthetic
   dataset and a scratch copy of marker-bearing workflow files, and asserts
   the shape of what it writes: the comb brackets the recorded release hours,
   UTC conversion honours the DST offset in force, a stopped house keeps only
   its sweep, a house with no weekday gets its trimmed daily bracket, and
   hand-authored lines outside the markers survive a rewrite.
   Run: node .build/test-tune-schedules.mjs */
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import assert from "node:assert/strict";

const { tune } = await import("./tune-schedules.mjs");

// ---- fixture data -----------------------------------------------------------
const poll = (pollster, published) => ({
  pollster, published, date: published.slice(0, 10), client: "—", sample: 1000,
  alp: 30, lnp: 30, grn: 12, onp: 15, ind: 8, oth: 5, tpp_alp: 51, tpp_lnp: 49,
});
const polls = [
  // Roy Morgan: Monday habit (declared), last eight span 15:56–17:00
  ...["2026-08-03T16:25", "2026-08-10T16:17", "2026-08-17T16:22", "2026-08-24T16:30",
      "2026-08-31T17:00", "2026-09-07T16:30", "2026-09-14T16:36", "2026-09-21T15:56"]
    .map((p) => poll("Roy Morgan", p)),
  // Newspoll: Sunday habit (measured), 20:00 mostly, twice 21:00, one Monday stray
  ...["2026-04-19T20:00", "2026-05-17T21:00", "2026-06-07T20:00", "2026-06-28T20:00",
      "2026-07-19T20:00", "2026-08-09T20:00", "2026-08-30T20:00", "2026-09-20T21:00",
      "2026-01-19T07:11"]
    .map((p) => poll("Newspoll", p)),
  // DemosAU: calendar-month rhythm, no weekday; midnight and evening strays
  ...["2026-01-27T00:00", "2026-02-23T20:30", "2026-04-17T05:00", "2026-05-22T05:00",
      "2026-06-22T08:50", "2026-07-13T08:44", "2026-08-24T08:51", "2026-09-17T08:30"]
    .map((p) => poll("DemosAU", p)),
  // a duplicate publication minute — one release recorded twice
  poll("Resolve", "2026-09-13T18:00"), poll("Resolve", "2026-09-13T18:00"),
  // Fox & Hedgehog: declared stopped
  poll("Fox & Hedgehog", "2026-05-31T06:42"),
];
const data = {
  polls,
  pollsterRules: {
    "Roy Morgan": { release: { dow: 1, time: "16:30" } },
    "DemosAU": { release: { month: true } },
    "Fox & Hedgehog": { stopped: true },
  },
};

// ---- scratch workflow files ------------------------------------------------
const dir = mkdtempSync(path.join(tmpdir(), "tune-"));
const files = ["roymorgan-update.yml", "resolve-update.yml", "essential-update.yml",
  "redbridge-update.yml", "newspoll-update.yml", "newspoll-watch.yml", "demosau-update.yml",
  "spectre-update.yml", "foxhedgehog-update.yml"];
for (const f of files) {
  writeFileSync(path.join(dir, f), [
    "name: x", "on:", "  schedule:",
    "    # tune-schedules:begin", "    # tune-schedules:end",
    "    - cron: '2 19 * * *' # hand-authored, must survive",
    "  workflow_dispatch:", "",
  ].join("\n"));
}

const crons = (text) => [...text.matchAll(/- cron: '([^']+)'\s*# (.*)/g)].map((m) => ({ cron: m[1], note: m[2] }));

// ---- AEST (UTC+10): September ------------------------------------------------
let res = tune({ data, workflowsDir: dir, now: new Date("2026-09-22T00:00:00Z"), apply: false });
assert.deepEqual(res.map((r) => r.status), files.map(() => "stale"), "dry run marks every block stale");
const before = readFileSync(path.join(dir, "roymorgan-update.yml"), "utf8");
res = tune({ data, workflowsDir: dir, now: new Date("2026-09-22T00:00:00Z"), apply: true });
assert.deepEqual(res.map((r) => r.status), files.map(() => "updated"));
assert.notEqual(readFileSync(path.join(dir, "roymorgan-update.yml"), "utf8"), before, "apply rewrites the file");

const rm = readFileSync(path.join(dir, "roymorgan-update.yml"), "utf8");
assert.ok(rm.includes("- cron: '2 19 * * *' # hand-authored, must survive"), "hand-authored line kept");
assert.ok(rm.includes("Eastern UTC+10 at generation"), "offset recorded in the header");
assert.ok(rm.includes("Mon habit (declared in pollsterRules)"), "declared weekday cited");
assert.ok(rm.includes("files 15:56–17:00 eastern"), "release span cited");
const rmCrons = crons(rm);
// comb starts on the 10-minute grid at least PRE_ROLL before the earliest recent
// release (15:56 → 15:40 eastern = 05:40 UTC) and reaches past the latest (17:00
// → 17:40 = 07:40 UTC), every 10 min, Mondays
assert.ok(rmCrons.some((c) => c.cron === "40,50 5 * * 1" && /Mon 15:40–15:50/.test(c.note)), "comb start " + JSON.stringify(rmCrons));
assert.ok(rmCrons.some((c) => c.cron === "0,10,20,30,40,50 6 * * 1"), "comb middle hour");
assert.ok(rmCrons.some((c) => c.cron === "0,10,20,30,40 7 * * 1" && /release window/.test(c.note)), "comb end hour");
assert.ok(rmCrons.some((c) => c.cron === "0 8 * * 1" && /follow-up/.test(c.note)), "first hourly follow-up");
assert.ok(rmCrons.some((c) => c.cron === "0 20 * * *" && /daily 06:00/.test(c.note)), "daily sweep");
assert.ok(rmCrons.some((c) => c.cron === "0 9 * * 2" && /Tue 19:00/.test(c.note)), "next-day evening");
assert.ok(!rmCrons.some((c) => c.cron === "0 20 * * 2"), "next-day morning folds into the daily sweep");

// Newspoll: measured Sunday habit, sparse mode, the Monday stray ignored
const np = crons(readFileSync(path.join(dir, "newspoll-update.yml"), "utf8"));
assert.ok(np.some((c) => c.cron === "50 9 * * 0" && /sparse/.test(c.note)), "sparse start 19:50 Sun " + JSON.stringify(np));
assert.ok(!np.some((c) => /every 10 min/.test(c.note)), "no comb in sparse mode");
assert.ok(readFileSync(path.join(dir, "newspoll-update.yml"), "utf8").includes("Sun habit (8/9 recent dated releases)"));
// the watchdog combs the habitual hour itself: 20:00–21:30 every 20 min
const nw = crons(readFileSync(path.join(dir, "newspoll-watch.yml"), "utf8"));
assert.ok(nw.some((c) => c.cron === "0,20,40 10 * * 0"), "watch comb 20:00–20:40 " + JSON.stringify(nw));
assert.ok(nw.some((c) => c.cron === "0,20 11 * * 0"), "watch comb 21:00–21:20");

// DemosAU: no weekday → trimmed daily bracket (05:00–08:51 once the midnight
// and 20:30 strays are set aside): 04:50, 08:30 (median floor), 10:00
const dm = crons(readFileSync(path.join(dir, "demosau-update.yml"), "utf8"));
assert.deepEqual(dm.filter((c) => /no weekday/.test(c.note)).map((c) => c.cron),
  ["50 18 * * *", "30 22 * * *", "0 0 * * *"], JSON.stringify(dm));

// stopped: sweep only
const fh = crons(readFileSync(path.join(dir, "foxhedgehog-update.yml"), "utf8"));
assert.deepEqual(fh.map((c) => c.cron), ["35 20 * * *", "2 19 * * *"], JSON.stringify(fh));
assert.ok(readFileSync(path.join(dir, "foxhedgehog-update.yml"), "utf8").includes("declared stopped"));

// a house with too few releases to measure: sweep only, no crash
const sp = crons(readFileSync(path.join(dir, "spectre-update.yml"), "utf8"));
assert.deepEqual(sp.map((c) => c.cron), ["50 20 * * *", "2 19 * * *"], JSON.stringify(sp));

// idempotent: a second apply is a no-op, --check would pass
res = tune({ data, workflowsDir: dir, now: new Date("2026-09-22T00:00:00Z"), apply: false });
assert.deepEqual(res.map((r) => r.status), files.map(() => "current"), "second run finds everything current");

// ---- AEDT (UTC+11): January — the same eastern comb, an hour earlier in UTC ----
res = tune({ data, workflowsDir: dir, now: new Date("2027-01-12T00:00:00Z"), apply: true });
assert.equal(res.find((r) => r.target.workflow === "roymorgan-update.yml").status, "updated", "DST shift is a change");
const rmDst = readFileSync(path.join(dir, "roymorgan-update.yml"), "utf8");
assert.ok(rmDst.includes("Eastern UTC+11 at generation"));
assert.ok(crons(rmDst).some((c) => c.cron === "40,50 4 * * 1" && /Mon 15:40–15:50/.test(c.note)), "comb start shifts to 04:40 UTC");
// and a slot that crosses UTC midnight moves to the previous weekday: the
// daily sweep at 06:00 eastern is 19:00 UTC the day before — daily stays daily
assert.ok(crons(rmDst).some((c) => c.cron === "0 19 * * *" && /daily 06:00/.test(c.note)));

// ---- a file without markers is reported, not silently skipped ----------------
writeFileSync(path.join(dir, "spectre-update.yml"), "name: x\non:\n  schedule:\n    - cron: '1 1 * * *'\n");
res = tune({ data, workflowsDir: dir, now: new Date("2026-09-22T00:00:00Z"), apply: true });
assert.equal(res.find((r) => r.target.workflow === "spectre-update.yml").status, "no-markers");

console.log("test-tune-schedules: ok");
