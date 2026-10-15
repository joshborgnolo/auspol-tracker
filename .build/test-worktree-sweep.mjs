#!/usr/bin/env node
/* test-worktree-sweep.mjs — pins .build/worktree-sweep.sh, the weekly launchd
   janitor born of the 2026-10-15 bloat sweep (14 abandoned worktrees, 1.16GB).
   The wrapper removes a worktree only when it is clean AND fully merged into
   origin/main AND idle (AUSPOL_SWEEP_IDLE_SECS), prunes stale registrations,
   and deletes merged worktree-* branches. Each guard class gets a fixture
   worktree in a scratch repo; the sweep must touch exactly the janitor case
   and nothing else.

   macOS-only: the wrapper is a launchd tool whose laptop job launches from
   ~/Library (launchd/run.sh territory); on CI's ubuntu it prints a skip. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = path.join(ROOT, ".build", "worktree-sweep.sh");
const LOCK = "/tmp/auspol-agent-locks/worktree-sweep.lock";

if (process.platform !== "darwin") {
  console.log("SKIP: worktree-sweep is a macOS/launchd tool");
  process.exit(0);
}
assert.ok(fs.existsSync(SCRIPT), "the sweep wrapper exists");
assert.ok(fs.readFileSync(SCRIPT, "utf8").includes("--apply"),
  "the wrapper keeps its dry-run-by-default posture (an --apply mode)");

fs.rmSync(LOCK, { recursive: true, force: true }); // never a stale lock from a real run
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "auspol-wt-sweep-"));
const main = path.join(scratch, "main");
const sh = (cmd, args, cwd, env = {}) =>
  execFileSync(cmd, args, { cwd, env: { ...process.env, ...env }, stdio: "pipe" }).toString();
const git = (args, cwd = main) => sh("git", args, cwd);

try {
  sh("git", ["init", "-q", "-b", "main", main], scratch);
  git(["config", "user.email", "sweep-test@example.invalid"]);
  git(["config", "user.name", "Sweep Test"]);
  fs.writeFileSync(path.join(main, "seed.txt"), "seed\n");
  git(["add", "seed.txt"]);
  git(["commit", "-q", "-m", "seed"]);
  sh("git", ["clone", "-q", "--bare", main, path.join(scratch, "origin.git")], scratch);
  git(["remote", "add", "origin", path.join(scratch, "origin.git")]);
  git(["push", "-q", "-u", "origin", "main"]);

  // the wrapper sweeps the repo it lives in
  fs.mkdirSync(path.join(main, ".build"), { recursive: true });
  fs.copyFileSync(SCRIPT, path.join(main, ".build", "worktree-sweep.sh"));

  // fixture 1: merged + clean + on a worktree-* branch → swept, branch deleted
  git(["worktree", "add", "-q", "-b", "worktree-merged", path.join(scratch, "wt-merged")]);
  // fixture 2: dirty → skipped
  git(["worktree", "add", "-q", "-b", "worktree-dirty", path.join(scratch, "wt-dirty")]);
  fs.writeFileSync(path.join(scratch, "wt-dirty", "junk.txt"), "uncommitted\n");
  // fixture 3: unmerged commit → skipped
  git(["worktree", "add", "-q", "-b", "worktree-unmerged", path.join(scratch, "wt-unmerged")]);
  fs.writeFileSync(path.join(scratch, "wt-unmerged", "ahead.txt"), "unpushed\n");
  git(["add", "ahead.txt"], path.join(scratch, "wt-unmerged"));
  git(["commit", "-q", "-m", "unpushed work"], path.join(scratch, "wt-unmerged"));
  // fixture 4: detached HEAD → skipped
  git(["worktree", "add", "-q", "--detach", path.join(scratch, "wt-detached")]);
  // fixture 5: merged branch with no worktree → branch deleted (prefix-only)
  git(["branch", "worktree-husk"]);
  // fixture 6: merged branch NOT named worktree-* → left alone
  git(["branch", "feature-keep"]);

  const sweep = (extraEnv = {}, args = ["--apply"]) =>
    sh("bash", ["main/.build/worktree-sweep.sh", ...args], scratch,
      { AUSPOL_SWEEP_IDLE_SECS: "0", ...extraEnv });

  let out = sweep({}, []); // dry run: no --apply, nothing may move
  assert.ok(fs.existsSync(path.join(scratch, "wt-merged")), "dry run removes nothing");
  assert.ok(out.includes("dry run"), "dry run says so");

  out = sweep({ AUSPOL_SWEEP_IDLE_SECS: "172800" }); // the real idle window: a
  // fresh worktree is minutes old and must read as active, not abandoned
  assert.ok(fs.existsSync(path.join(scratch, "wt-merged")), "idle gate keeps a fresh worktree");
  assert.ok(out.includes("SKIP (active)"), "the idle skip reports itself");

  out = sweep(); // AUSPOL_SWEEP_IDLE_SECS=0: janitor behaviour on ancient fixtures
  assert.ok(!fs.existsSync(path.join(scratch, "wt-merged")), "merged+clean worktree swept");
  assert.ok(fs.existsSync(path.join(scratch, "wt-dirty")), "dirty worktree kept");
  assert.ok(fs.existsSync(path.join(scratch, "wt-unmerged")), "unmerged worktree kept");
  assert.ok(fs.existsSync(path.join(scratch, "wt-detached")), "detached worktree kept");
  assert.ok(out.includes("SKIP (dirty)") && out.includes("SKIP (unmerged)") && out.includes("SKIP (detached)"),
    "each skip class reports itself");

  const branches = git(["branch", "--format=%(refname:short)"]);
  assert.ok(!branches.split("\n").includes("worktree-merged"), "swept worktree's branch deleted");
  assert.ok(!branches.split("\n").includes("worktree-husk"), "merged worktree-* husk branch deleted");
  assert.ok(branches.split("\n").includes("feature-keep"), "non-worktree-* branch left alone");
  assert.ok(branches.split("\n").includes("worktree-dirty"), "skipped worktree's branch kept");
} finally {
  fs.rmSync(scratch, { recursive: true, force: true });
  fs.rmSync(LOCK, { recursive: true, force: true });
}
console.log("PASS: worktree-sweep – janitor case swept (worktree + branch), dirty/unmerged/detached/active kept, prefixed branch husk deleted");
