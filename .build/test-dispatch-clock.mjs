/* Tests for the dispatch clock (.build/dispatch-clock/): the Sydney-minute
   matching (both sides of DST), the committed table's integrity — every
   workflow it names exists and can be dispatched — and a full tick against a
   stubbed fetch, checking the exact GitHub API call the Worker makes.
   Run: node .build/test-dispatch-clock.mjs */
import { readFileSync, existsSync } from "node:fs";
import assert from "node:assert/strict";
import { dueWorkflows, nextSlots, sydneyClock, tick, SAFE_WORKFLOW } from "./dispatch-clock/clock.mjs";

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

console.log("test-dispatch-clock: ok");
