/* Tests for the dispatch clock (.build/dispatch-clock/): the Sydney-minute
   matching (both sides of DST), the committed table's integrity — every
   workflow it names exists and can be dispatched — a full tick against a
   stubbed fetch, checking the exact GitHub API call the Worker makes, and
   served.mjs, which reads the clock's work back out of the run list: the
   cron backup's skip rule and the daily heartbeat.
   Run: node .build/test-dispatch-clock.mjs */
import { readFileSync, existsSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import { dueWorkflows, nextSlots, sydneyClock, tick, SAFE_WORKFLOW } from "./dispatch-clock/clock.mjs";
import { cronMatcher, backupVerdict, clockHealth, slim } from "./dispatch-clock/served.mjs";

const table = JSON.parse(readFileSync(".build/dispatch-clock/schedule.json", "utf8"));

// ---- Sydney wall-clock matching ------------------------------------------------
const toy = { slots: [
  { workflow: "roymorgan-update.yml", day: "Mon", time: "15:40", label: "release window" },
  { workflow: "roymorgan-update.yml", day: "daily", time: "06:00", label: "daily sweep" },
  { workflow: "essential-update.yml", day: "Wed", time: "00:50", label: "release window" },
  { workflow: "../../evil", day: "daily", time: "06:00", label: "never dispatched" },
] };
// Mon 21 Sep 2026 15:40 AEST (UTC+10) = 05:40Z
assert.deepEqual(sydneyClock(new Date("2026-09-21T05:40:00Z")), { day: "Mon", time: "15:40" });
assert.deepEqual(dueWorkflows(toy, new Date("2026-09-21T05:40:00Z")), ["roymorgan-update.yml"]);
assert.deepEqual(dueWorkflows(toy, new Date("2026-09-21T05:41:00Z")), [], "the minute after is quiet");
assert.deepEqual(dueWorkflows(toy, new Date("2026-09-21T05:40:59Z")), ["roymorgan-update.yml"], "seconds don't matter");
// Mon 11 Jan 2027 15:40 AEDT (UTC+11) = 04:40Z — same table, no retune
assert.deepEqual(dueWorkflows(toy, new Date("2027-01-11T04:40:00Z")), ["roymorgan-update.yml"], "DST moves UTC, not the table");
// a daily slot, and a slot just after Sydney midnight (Tue 14:50Z = Wed 00:50 AEST)
assert.deepEqual(dueWorkflows(toy, new Date("2026-09-24T20:00:00Z")), ["roymorgan-update.yml"], "daily 06:00; the unsafe name is dropped");
assert.deepEqual(dueWorkflows(toy, new Date("2026-09-22T14:50:00Z")), ["essential-update.yml"], "Wed 00:50 is still Tue in UTC");
assert.equal(sydneyClock(new Date("2026-09-22T14:00:00Z")).time, "00:00", "midnight is 00, never 24");
const next = nextSlots(toy, new Date("2026-09-21T05:00:00Z"), 3);
assert.deepEqual(next.map((x) => x.sydney), [{ day: "Mon", time: "15:40" }, { day: "Tue", time: "06:00" }, { day: "Wed", time: "00:50" }]);
assert.deepEqual(next.map((x) => x.workflows[0]), ["roymorgan-update.yml", "roymorgan-update.yml", "essential-update.yml"]);

// ---- the committed table ----------------------------------------------------------
assert.equal(table.timezone, "Australia/Sydney");
assert.ok(table.slots.length > 20, "the table carries the combs");
for (const s of table.slots) {
  assert.match(s.workflow, SAFE_WORKFLOW, `safe workflow name: ${s.workflow}`);
  assert.match(s.day, /^(daily|Sun|Mon|Tue|Wed|Thu|Fri|Sat)$/, `day: ${JSON.stringify(s)}`);
  assert.match(s.time, /^([01]\d|2[0-3]):[0-5]\d$/, `time: ${JSON.stringify(s)}`);
}
for (const wf of new Set(table.slots.map((s) => s.workflow))) {
  const path = `.github/workflows/${wf}`;
  assert.ok(existsSync(path), `${wf} exists`);
  // a dispatch to a workflow without this trigger is a 422 every minute
  assert.match(readFileSync(path, "utf8"), /^\s{2}workflow_dispatch:/m, `${wf} accepts workflow_dispatch`);
}
// Roy Morgan's Monday comb is dispatched — the window GitHub's cron dropped
// on 14 and 21 Sep 2026
assert.ok(table.slots.some((s) => s.workflow === "roymorgan-update.yml" && s.day === "Mon" && /release window/.test(s.label)));

// ---- one tick, end to end, against a stubbed fetch ---------------------------------
const calls = [];
globalThis.fetch = async (url, init = {}) => {
  calls.push({ url: String(url), init });
  if (String(url).endsWith("schedule.json")) return new Response(JSON.stringify(toy), { status: 200 });
  return new Response(null, { status: 204 });
};
const env = { REPO: "owner/repo", TABLE_URL: "https://example.test/schedule.json", GITHUB_TOKEN: "t0ken" };
const out = await tick(new Date("2026-09-21T05:40:00Z"), env);
assert.deepEqual(out, [{ workflow: "roymorgan-update.yml", status: 204 }]);
const post = calls.find((c) => c.init.method === "POST");
assert.equal(post.url, "https://api.github.com/repos/owner/repo/actions/workflows/roymorgan-update.yml/dispatches");
assert.equal(post.init.headers.authorization, "Bearer t0ken");
assert.deepEqual(JSON.parse(post.init.body), { ref: "main" });
calls.length = 0;
assert.deepEqual(await tick(new Date("2026-09-21T05:41:00Z"), env), [], "a quiet minute dispatches nothing");
assert.equal(calls.filter((c) => c.init.method === "POST").length, 0);

// ---- served.mjs: cron lines as GitHub reads them ------------------------------------
const at = (s) => new Date(s);
const comb = cronMatcher("0,10,20,30,40,50 6 * * 1"); // Mon 16:00–16:50 AEST
assert.ok(comb(at("2026-09-21T06:10:00Z")) && !comb(at("2026-09-21T06:15:00Z")) && !comb(at("2026-09-22T06:10:00Z")));
assert.ok(cronMatcher("*/15 * * * *")(at("2026-09-21T03:45:00Z")) && !cronMatcher("*/15 * * * *")(at("2026-09-21T03:44:00Z")));
assert.ok(cronMatcher("5 9 * * 0")(at("2026-09-20T09:05:00Z")) && cronMatcher("5 9 * * 7")(at("2026-09-20T09:05:00Z")), "7 is Sunday too");
assert.ok(cronMatcher("0 12 1-7 * 1")(at("2026-09-01T12:00:00Z")), "two restricted day fields OR (POSIX)");
for (const bad of ["", "0 20 * *", "61 * * * *", "a b c d e", "0 20 L * *"]) assert.throws(() => cronMatcher(bad), `rejects "${bad}"`);

// ---- the backup's skip rule -----------------------------------------------------------
const run = (created_at, conclusion = "success", status = "completed") => ({ path: ".github/workflows/roymorgan-update.yml", created_at, conclusion, status });
const late = Date.parse("2026-09-21T09:40:00Z"); // GitHub's cron, 3h40m after the comb
const all = ["06:00", "06:10", "06:20", "06:30", "06:40", "06:50"].map((m) => run(`2026-09-21T${m}:41Z`));
assert.equal(backupVerdict("0,10,20,30,40,50 6 * * 1", slim(all), late).served, true, "every slot started on time: the backup is a duplicate");
assert.equal(backupVerdict("0,10,20,30,40,50 6 * * 1", slim(all.slice(0, 3)), late).served, false, "the clock stopped at 06:20: the backup runs");
const failed = [...all.slice(0, 5), run("2026-09-21T06:50:41Z", "failure")];
assert.equal(backupVerdict("0,10,20,30,40,50 6 * * 1", slim(failed), late).served, false, "a failed dispatched run earns its backup");
const running = [...all.slice(0, 5), run("2026-09-21T06:50:41Z", null, "in_progress")];
assert.equal(backupVerdict("0,10,20,30,40,50 6 * * 1", slim(running), late).served, true, "a run still going counts");
assert.equal(backupVerdict("0,10,20,30,40,50 6 * * 1", slim([run("2026-09-21T06:07:00Z")]), late).served, false, "a run 7 min off a slot is not that slot's");
assert.equal(backupVerdict("2 19 * * *", slim(all), late).served, false, "a slot the clock never carried always runs");
assert.equal(backupVerdict("0 20 * * 1", slim(all), Date.parse("2026-09-24T12:00:00Z")).served, false, "no slot of the line in the last day: run");

// ---- the heartbeat -------------------------------------------------------------------
const tbl = { slots: [
  { workflow: "roymorgan-update.yml", day: "daily", time: "06:00", label: "daily sweep" },
  { workflow: "resolve-update.yml", day: "daily", time: "07:00", label: "daily sweep" },
  { workflow: "news24-update.yml", day: "daily", time: "06:20", label: "daily sweep" },
  { workflow: "essential-update.yml", day: "daily", time: "07:45", label: "daily sweep" },
] };
const noon = Date.parse("2026-09-25T02:00:00Z"); // 12:00 AEST, after all four
const d = (wf, t) => ({ path: `.github/workflows/${wf}`, created_at: t, conclusion: "failure", status: "completed" });
const ran = [d("roymorgan-update.yml", "2026-09-24T20:00:40Z"), d("news24-update.yml", "2026-09-24T20:20:40Z"),
  d("resolve-update.yml", "2026-09-24T21:00:40Z"), d("essential-update.yml", "2026-09-24T21:45:40Z")];
assert.deepEqual(clockHealth(tbl, slim(ran), noon), { verdict: "healthy", due: 4, served: 4, unserved: [] },
  "a started run counts whatever its conclusion: the clock's job is to start it");
assert.equal(clockHealth(tbl, slim(ran.slice(0, 3)), noon).verdict, "degraded");
assert.equal(clockHealth(tbl, slim(ran.slice(0, 1)), noon).verdict, "dead");
assert.equal(clockHealth(tbl, [], noon).verdict, "dead");
assert.equal(clockHealth(tbl, slim([d("resolve-update.yml", "2026-09-24T20:00:40Z")]), noon).served, 0, "the right workflow, not just any run");
assert.equal(clockHealth(tbl, [], Date.parse("2026-09-24T20:05:00Z"), { hours: 0.2 }).due, 0, "a slot 5 min old hasn't settled");

// ---- the CLI, through its test seams ---------------------------------------------------
const tmp = mkdtempSync(join(tmpdir(), "served-"));
const cli = (mode, env) => spawnSync(process.execPath, [".build/dispatch-clock/served.mjs", mode], { encoding: "utf8", env: { ...process.env, GH_TOKEN: "", ...env } });
writeFileSync(join(tmp, "runs.json"), JSON.stringify(all));
writeFileSync(join(tmp, "out"), "");
let c = cli("backup", { SERVED_RUNS: join(tmp, "runs.json"), SERVED_NOW: "2026-09-21T09:40:00Z", CRON: "0,10,20,30,40,50 6 * * 1", GITHUB_OUTPUT: join(tmp, "out") });
assert.equal(c.status, 0);
assert.match(c.stdout, /^SERVED \{.*"served":true/m);
assert.equal(readFileSync(join(tmp, "out"), "utf8"), "served=true\n");
c = cli("backup", { SERVED_RUNS: join(tmp, "missing.json"), CRON: "0 20 * * *", GITHUB_OUTPUT: join(tmp, "out") });
assert.equal(c.status, 0, "an unreadable run list still exits 0...");
assert.match(readFileSync(join(tmp, "out"), "utf8"), /served=false\n$/, "...and runs the update");
c = cli("heartbeat", { SERVED_RUNS: join(tmp, "missing.json") });
assert.equal(c.status, 1, "heartbeat: unreadable history is inconclusive");
writeFileSync(join(tmp, "none.json"), "[]");
c = cli("heartbeat", { SERVED_RUNS: join(tmp, "none.json"), SERVED_NOW: "2026-09-25T02:00:00Z" });
assert.equal(c.status, 3, "heartbeat: nothing dispatched against the committed table is a dead clock");
assert.match(c.stdout, /the clock looks dead/);
rmSync(tmp, { recursive: true, force: true });

console.log("test-dispatch-clock: ok");
