/* Tests for .build/transient-streak.sh — the rule that lets a soft verdict
   (an updater's transient failure, a watchdog's inconclusive one) stay green
   once but not for ever. Driven end to end: the real script, a fake `gh` on
   PATH that answers each API path from a fixture file through the real jq
   (so the script's own --jq filters are what get tested), and a run history
   built relative to now.
   Run: node .build/test-streaks.mjs */
import { mkdtempSync, writeFileSync, rmSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";

const REPO = "o/r", RUN = 1000, WF = 77;
const hoursAgo = (h) => new Date(Date.now() - h * 3600e3).toISOString().replace(/\.\d+Z$/, "Z");

// `gh api <path> [flags] --jq <filter>` → jq -r <filter> <fixture for path>
const FAKE_GH = `#!/bin/bash
[ "$1" = api ] || { echo "fake gh: api only" >&2; exit 1; }
shift; path=""; filter="."
while [ $# -gt 0 ]; do
  case "$1" in --jq) filter="$2"; shift 2 ;; -*) shift ;; *) [ -z "$path" ] && path="$1"; shift ;; esac
done
f="$FAKE_GH_DIR/$(printf '%s' "\${path%%\\?*}" | tr '/' '_').json"
[ -f "$f" ] || { echo "fake gh: no fixture for $path" >&2; exit 1; }
exec jq -r "$filter" "$f"
`;

/* history: newest first, each { hours, conclusion, steps: [[name, conclusion], ...] } */
function streak(history, env = {}) {
  const dir = mkdtempSync(join(tmpdir(), "streak-"));
  const put = (path, obj) => writeFileSync(join(dir, path.replace(/\//g, "_") + ".json"), JSON.stringify(obj));
  put(`repos/${REPO}/actions/runs/${RUN}`, { workflow_id: WF });
  const runs = [{ id: RUN, created_at: hoursAgo(0), conclusion: "success" }];
  history.forEach((h, i) => {
    const id = 900 - i;
    runs.push({ id, created_at: hoursAgo(h.hours), conclusion: h.conclusion ?? "success" });
    put(`repos/${REPO}/actions/runs/${id}/jobs`, { jobs: [{ name: "job", steps: h.steps.map(([name, conclusion]) => ({ name, conclusion })) }] });
  });
  put(`repos/${REPO}/actions/workflows/${WF}/runs`, { workflow_runs: runs });
  writeFileSync(join(dir, "gh"), FAKE_GH);
  chmodSync(join(dir, "gh"), 0o755);
  const r = spawnSync("bash", [".build/transient-streak.sh"], {
    encoding: "utf8",
    env: { ...process.env, PATH: `${dir}:${process.env.PATH}`, FAKE_GH_DIR: dir, GITHUB_REPOSITORY: REPO, GITHUB_RUN_ID: String(RUN), GITHUB_STEP_SUMMARY: "", ...env },
  });
  rmSync(dir, { recursive: true, force: true });
  return { code: r.status, out: r.stdout + r.stderr };
}

// ---- the updaters' rule (the default kind) --------------------------------------
const UPD = "Run the roymorgan updater", MARK = "Note a transient upstream failure";
const soft = (hours) => ({ hours, steps: [[UPD, "success"], [MARK, "success"]] });
const clean = (hours) => ({ hours, steps: [[UPD, "success"], [MARK, "skipped"]] });
const gated = (hours) => ({ hours, steps: [[UPD, "skipped"]] }); // the updater never ran

let r = streak([soft(3), soft(13)]);
assert.equal(r.code, 1, "two earlier transient runs over 13h escalate\n" + r.out);
assert.match(r.out, /escalating to repair/);
r = streak([soft(3), soft(5)]);
assert.equal(r.code, 0, "the same streak inside 12h stays green\n" + r.out);
r = streak([soft(3), clean(5), soft(20)]);
assert.equal(r.code, 0, "a clean run ends the streak\n" + r.out);
r = streak([soft(3), gated(4), gated(6), soft(13)]);
assert.equal(r.code, 1, "runs whose updater never ran are stepped over, not a break\n" + r.out);
r = streak([soft(3), { hours: 13, conclusion: "failure", steps: [[UPD, "failure"]] }]);
assert.equal(r.code, 0, "an escalated (red) run starts a fresh streak\n" + r.out);

// ---- the watchdogs' rule ------------------------------------------------------------
const CHECK = "Run the site check", NOTE = "Note an inconclusive verdict";
const unsure = (hours) => ({ hours, steps: [[CHECK, "success"], [NOTE, "success"]] });
const sure = (hours) => ({ hours, steps: [[CHECK, "success"], [NOTE, "skipped"]] });
const W = { STREAK_KIND: "inconclusive", STREAK_RAN: "^Run the site check$", STREAK_MIN: "3", STREAK_HOURS: "12" };

r = streak([unsure(1), unsure(6), unsure(13)], W);
assert.equal(r.code, 1, "three inconclusive runs over 12h+: blind\n" + r.out);
assert.match(r.out, /watchdog is blind/);
r = streak([unsure(1), sure(2), unsure(13), unsure(14)], W);
assert.equal(r.code, 0, "one conclusive run since means it can still see\n" + r.out);
r = streak([unsure(1), { hours: 5, steps: [[CHECK, "skipped"]] }, unsure(6), unsure(13)], W);
assert.equal(r.code, 1, "a run that skipped the check (a failed Pages deploy) is stepped over\n" + r.out);
// a watchdog that runs on every deploy needs the deeper walk to reach 12h back
const dense = Array.from({ length: 30 }, (_, i) => unsure(0.5 + i * 0.5)); // 30 runs over 15h
r = streak(dense, W);
assert.equal(r.code, 0, "15 runs (the updaters' depth) reach only 7.5h back\n" + r.out);
r = streak(dense, { ...W, STREAK_MAX_RUNS: "60" });
assert.equal(r.code, 1, "the deeper walk reaches the 12h\n" + r.out);
r = streak([unsure(1)], { STREAK_KIND: "inconclusive" });
assert.notEqual(r.code, 0, "the watchdog kind must name its check step");

console.log("test-streaks: ok");
