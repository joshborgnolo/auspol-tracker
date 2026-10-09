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

const { tune, dispatchTable } = await import("./tune-schedules.mjs");

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
// SEC Newgate: direction-only, so its upload stamps live on data.direction
const direction = ["2025-07-29T16:58", "2025-09-24T11:16", "2025-11-10T17:24", "2026-02-17T16:51",
  "2026-05-27T13:03", "2026-07-21T16:50", "2026-09-22T15:29"]
  .map((published) => ({ pollster: "SEC Newgate", published, date: published.slice(0, 10), right: 30, wrong: 50 }));
const data = {
  polls, direction,
  pollsterRules: {
    "Roy Morgan": { release: { dow: 1, time: "16:30" } },
    "DemosAU": { release: { month: true } },
    "Fox & Hedgehog": { stopped: true },
  },
};

// ---- scratch workflow files ------------------------------------------------
const dir = mkdtempSync(path.join(tmpdir(), "tune-"));
const files = ["roymorgan-update.yml", "resolve-update.yml", "essential-update.yml",
  "redbridge-update.yml", "newspoll-update.yml", "newspoll-watch.yml", "news24-update.yml", "demosau-update.yml",
  "spectre-update.yml", "foxhedgehog-update.yml", "secnewgate-update.yml", "ipsos-update.yml", "emrs-update.yml"];
// each file keeps one hand-authored slot on a minute of its own (nine
// writers on one minute would trip the collision audit, rightly)
files.forEach((f, i) => {
  writeFileSync(path.join(dir, f), [
    "name: x", "on:", "  schedule:",
    "    # tune-schedules:begin", "    # tune-schedules:end",
    `    - cron: '${2 + i} 19 * * *' # hand-authored, must survive`,
    "  workflow_dispatch:", "jobs:", "  run:", "    uses: ./.github/workflows/poll-agent.yml", "",
  ].join("\n"));
});

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
assert.ok(np.some((c) => c.cron === "52 9 * * 0" && /sparse/.test(c.note)), "sparse start 19:52 Sun (phase 2) " + JSON.stringify(np));
assert.ok(!np.some((c) => /every 10 min/.test(c.note)), "no comb in sparse mode");
assert.ok(readFileSync(path.join(dir, "newspoll-update.yml"), "utf8").includes("Sun habit (8/9 recent dated releases)"));
// the watchdog combs the habitual hour itself: 20:00–21:30 every 20 min
const nw = crons(readFileSync(path.join(dir, "newspoll-watch.yml"), "utf8"));
assert.ok(nw.some((c) => c.cron === "4,24,44 10 * * 0"), "watch comb 20:04–20:44 (phase 4) " + JSON.stringify(nw));
assert.ok(nw.some((c) => c.cron === "4,24 11 * * 0"), "watch comb 21:04–21:24");

// DemosAU: no weekday → trimmed daily bracket (05:00–08:51 once the midnight
// and 20:30 strays are set aside): 04:50, 08:30 (median floor), 10:00
const dm = crons(readFileSync(path.join(dir, "demosau-update.yml"), "utf8"));
assert.deepEqual(dm.filter((c) => /no weekday/.test(c.note)).map((c) => c.cron),
  ["50 18 * * *", "30 22 * * *", "0 0 * * *"], JSON.stringify(dm));

// stopped: sweep only
const fh = crons(readFileSync(path.join(dir, "foxhedgehog-update.yml"), "utf8"));
assert.deepEqual(fh.map((c) => c.cron), ["35 20 * * *", "11 19 * * *"], JSON.stringify(fh));
assert.ok(readFileSync(path.join(dir, "foxhedgehog-update.yml"), "utf8").includes("declared stopped"));

// a house with too few releases to measure: sweep only, no crash
const sp = crons(readFileSync(path.join(dir, "spectre-update.yml"), "utf8"));
assert.deepEqual(sp.map((c) => c.cron), ["50 20 * * *", "10 19 * * *"], JSON.stringify(sp));

// weekdays mode. SEC Newgate's hours measured off data.direction
// (11:16–17:24, untrimmed): Mon–Fri 11:00–18:00 every 20 min, two hourly
// follow-ups, the late backstop; nothing on a weekend
const sec = crons(readFileSync(path.join(dir, "secnewgate-update.yml"), "utf8"));
assert.ok(sec.some((c) => c.cron === "0,20,40 1 * * 1,2,3,4,5" && /Mon\/Tue\/Wed\/Thu\/Fri 11:00–11:40/.test(c.note)), "SEC comb start " + JSON.stringify(sec));
assert.ok(sec.some((c) => c.cron === "0 8 * * 1,2,3,4,5" && /18:00 — weekday release hours/.test(c.note)), "SEC comb end");
assert.deepEqual(sec.filter((c) => /follow-up|late backstop/.test(c.note)).map((c) => c.cron),
  ["0 9 * * 1,2,3,4,5", "0 10 * * 1,2,3,4,5", "30 12 * * 1,2,3,4,5"]);
assert.ok(sec.filter((c) => !/hand-authored/.test(c.note)).every((c) => c.cron.endsWith(" * * 1,2,3,4,5")), "weekdays only");
assert.ok(readFileSync(path.join(dir, "secnewgate-update.yml"), "utf8").includes("files 11:16–17:24 eastern (last 7 timed releases"));
// Ipsos's hours are declared on its TARGETS entry (11:43–16:34): 11:20–17:00
const ip = crons(readFileSync(path.join(dir, "ipsos-update.yml"), "utf8"));
assert.ok(ip.some((c) => c.cron === "20,40 1 * * 1,2,3,4,5"), "Ipsos comb start " + JSON.stringify(ip));
assert.ok(ip.some((c) => c.cron === "0 7 * * 1,2,3,4,5" && /17:00 — weekday release hours/.test(c.note)), "Ipsos comb end");
assert.ok(readFileSync(path.join(dir, "ipsos-update.yml"), "utf8").includes("declared in tune-schedules TARGETS"));

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

// ---- the dispatch table: the same slots in eastern wall-clock, DST-proof --------
const table = path.join(dir, "clock", "schedule.json");
res = tune({ data, workflowsDir: dir, now: new Date("2026-09-22T00:00:00Z"), apply: true, tablePath: table });
assert.equal(res.tableStatus, "updated", "the first apply writes the table");
const tableText = readFileSync(table, "utf8");
const tj = JSON.parse(tableText);
assert.equal(tj.timezone, "Australia/Sydney");
const rmSlots = tj.slots.filter((x) => x.workflow === "roymorgan-update.yml");
assert.ok(rmSlots.some((x) => x.day === "Mon" && x.time === "15:40" && /release window/.test(x.label)), "comb start in eastern time " + JSON.stringify(rmSlots));
assert.ok(rmSlots.some((x) => x.day === "Mon" && x.time === "17:40"), "comb end");
assert.ok(rmSlots.some((x) => x.day === "daily" && x.time === "06:00" && x.label === "daily sweep"), "daily sweep");
assert.ok(!rmSlots.some((x) => x.day === "Tue" && x.time === "06:00"), "next-day morning folds into the daily sweep, as in cron");
assert.ok(tj.slots.some((x) => x.workflow === "newspoll-watch.yml" && x.day === "Sun" && x.time === "20:04"), "the watchdog's comb is dispatched too");
const ipSlots = tj.slots.filter((x) => x.workflow === "ipsos-update.yml");
assert.deepEqual([...new Set(ipSlots.map((x) => x.day))], ["Mon", "Tue", "Wed", "Thu", "Fri"], "Ipsos is dispatched on weekdays only");
assert.equal(ipSlots.filter((x) => x.day === "Wed").length, 21, "Ipsos: 18 comb slots (11:20–17:00), follow-ups at 18:00 and 19:00, the 22:30 backstop");
assert.equal(tableText.split("\n").filter((l) => l.startsWith("  {")).length, tj.slots.length, "one slot per line");
assert.equal(tj.generatedAt, "2026-09-22T00:00:00.000Z", "generatedAt stamps the tune's clock");
// DST rewrites every cron block; the table has no UTC in it and stays put
res = tune({ data, workflowsDir: dir, now: new Date("2027-01-12T00:00:00Z"), apply: true, tablePath: table });
assert.equal(res.find((r) => r.target.workflow === "roymorgan-update.yml").status, "updated", "blocks move with DST");
assert.equal(res.tableStatus, "current", "the table does not");
assert.equal(readFileSync(table, "utf8"), tableText, "generatedAt included");

// generatedAt moves only when the slot list does: the heartbeat's scored
// window resets exactly then, and not with every regenerate
const t1 = dispatchTable([], { now: new Date("2026-09-22T00:00:00Z") });
assert.equal(t1.generatedAt, "2026-09-22T00:00:00.000Z", "a fresh table takes the tune clock");
assert.equal(dispatchTable([], { previous: t1, now: new Date("2026-09-29T00:00:00Z") }).generatedAt, t1.generatedAt, "unchanged slots keep the stamp");
const t3 = dispatchTable([{ target: { workflow: "w-update.yml" }, slots: [{ dow: null, mins: 360, label: "daily sweep" }] }],
  { previous: t1, now: new Date("2026-09-29T00:00:00Z") });
assert.equal(t3.generatedAt, "2026-09-29T00:00:00.000Z", "a changed slot list re-stamps");
assert.ok(t3.slots.some((s) => s.workflow === "w-update.yml" && s.time === "06:00" && s.day === "daily"));

// ---- the collision audit: per-house queues never collide; a shared group does ----
res = tune({ data, workflowsDir: dir, now: new Date("2026-09-22T00:00:00Z"), apply: true });
assert.deepEqual(res.audit.triples, [], "no minute with three runs of one group");
// poll-agent callers queue per house (writers-${{ inputs.house }}, an
// expression), so three of them on one minute cost nothing
const rb = readFileSync(path.join(dir, "redbridge-update.yml"), "utf8");
writeFileSync(path.join(dir, "redbridge-update.yml"), rb.replace("  workflow_dispatch:", "    - cron: '0 9 * * 1' # hand-authored on Roy Morgan + Resolve's next-day slot\n  workflow_dispatch:"));
res = tune({ data, workflowsDir: dir, now: new Date("2026-09-22T00:00:00Z"), apply: false });
assert.deepEqual(res.audit.triples, [], "separate queues: a shared minute is no collision");
// three workflows in ONE literal group on one minute → a triple → nothing written
for (const z of ["zz1", "zz2", "zz3"])
  writeFileSync(path.join(dir, `${z}.yml`), "name: z\non:\n  schedule:\n    - cron: '0 9 * * 1'\nconcurrency:\n  group: shared-queue\n");
res = tune({ data, workflowsDir: dir, now: new Date("2027-01-12T00:00:00Z"), apply: true, tablePath: table });
assert.ok(res.audit.triples.length >= 1 && /Mon 09:00 UTC \[shared-queue\]/.test(res.audit.triples[0]), JSON.stringify(res.audit));
assert.ok(res.every((r) => r.status !== "updated"), "a collision blocks every write");
for (const z of ["zz1", "zz2", "zz3"]) writeFileSync(path.join(dir, `${z}.yml`), "name: z\non:\n  workflow_dispatch:\n");
writeFileSync(path.join(dir, "redbridge-update.yml"), rb);

// ---- a file without markers is reported, not silently skipped ----------------
writeFileSync(path.join(dir, "spectre-update.yml"), "name: x\non:\n  schedule:\n    - cron: '1 1 * * *'\n");
res = tune({ data, workflowsDir: dir, now: new Date("2026-09-22T00:00:00Z"), apply: true });
assert.equal(res.find((r) => r.target.workflow === "spectre-update.yml").status, "no-markers");

// ---- the fixed twins: FIXED_SLOTS' own cron lines follow the DST offset ------
const twinFile = (name) => writeFileSync(path.join(dir, name), [
  "name: x", "on:", "  schedule:",
  "    # tune-fixed:begin", "    # tune-fixed:end",
  "  workflow_dispatch:", "",
].join("\n"));
twinFile("np-score.yml");
twinFile("prediction-refresh.yml");
res = tune({ data, workflowsDir: dir, now: new Date("2026-09-22T00:00:00Z"), apply: true });
assert.deepEqual(res.fixedTwins.map((t) => t.status), ["updated", "updated"], "the first tune writes both twin lines");
assert.ok(crons(readFileSync(path.join(dir, "np-score.yml"), "utf8")).some((c) => c.cron === "15 21 * * *"), "07:15 Sydney is 21:15 UTC in AEST");
assert.ok(crons(readFileSync(path.join(dir, "prediction-refresh.yml"), "utf8")).some((c) => c.cron === "0 3 * * *"), "13:00 Sydney is 03:00 UTC in AEST");
res = tune({ data, workflowsDir: dir, now: new Date("2027-01-12T00:00:00Z"), apply: true });
assert.deepEqual(res.fixedTwins.map((t) => t.status), ["updated", "updated"], "the DST switch moves the twins");
assert.ok(crons(readFileSync(path.join(dir, "np-score.yml"), "utf8")).some((c) => c.cron === "15 20 * * *"), "07:15 Sydney is 20:15 UTC in AEDT");
assert.ok(crons(readFileSync(path.join(dir, "prediction-refresh.yml"), "utf8")).some((c) => c.cron === "0 2 * * *"), "13:00 Sydney is 02:00 UTC in AEDT");
res = tune({ data, workflowsDir: dir, now: new Date("2027-01-12T00:00:00Z"), apply: true });
assert.deepEqual(res.fixedTwins.map((t) => t.status), ["current", "current"], "and then they rest");
// a fixture (or fork) without the twin files: reported, not fatal
res = tune({ data, workflowsDir: mkdtempSync(path.join(tmpdir(), "tune-empty-")), now: new Date("2026-09-22T00:00:00Z"), apply: false });
assert.deepEqual(res.fixedTwins.map((t) => t.status), ["no-file", "no-file"], "absent twin files are reported, skipped");

console.log("test-tune-schedules: ok");
