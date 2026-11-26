import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "writer-heartbeat-test-"));
const script = path.resolve(".build/check-writer-heartbeat.mjs");
const run = (command, args, options = {}) => execFileSync(command, args, {
  cwd: dir, encoding: "utf8", maxBuffer: 8 * 1024 * 1024, ...options,
});
const commit = (message) => {
  run("git", ["add", "history.txt"]);
  run("git", ["commit", "-q", "-m", message]);
};

try {
  run("git", ["init", "--initial-branch=main", "-q"]);
  run("git", ["config", "user.name", "human"]);
  run("git", ["config", "user.email", "human@example.test"]);
  fs.writeFileSync(path.join(dir, "history.txt"), "start\n");
  commit("baseline");

  for (let i = 0; i < 60; i++) {
    fs.appendFileSync(path.join(dir, "history.txt"), `${i}\n`);
    commit(`human ${i} ${"x".repeat(20000)}`);
  }
  const wholeLog = run("git", ["log", "HEAD", "--format=%ct%x00%an%x00%s", "-z"]);
  assert(Buffer.byteLength(wholeLog) > 1024 * 1024, "the fixture exercises the old buffer-limit failure");

  run("git", ["-c", "user.name=github-actions[bot]", "-c", "user.email=bot@example.test", "commit", "-q", "--allow-empty", "-m", "latest model run"]);
  const output = run(process.execPath, [script, "--json"]);
  const status = JSON.parse(output.slice(output.indexOf("{")));
  assert.equal(status.ref, "main");
  assert.equal(status.last_automation_commit.subject, "latest model run");
  assert(status.age_h < 60 && !status.stalled && !status.error, JSON.stringify(status));

  console.log("writer heartbeat: a >1 MiB history resolves to the newest automation commit");
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
