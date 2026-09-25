/* Race tests for push_main (.build/git-push-main.sh) — the push every
   writing wrapper routes through. CI writers no longer queue behind one
   shared concurrency group, so two houses can land at once and this function
   is what keeps that safe. The test builds a scratch origin and two clones,
   each carrying the REAL git-push-main.sh plus a toy wrapper whose "build"
   derives index.html, feed.xml and a content-hashed asset from the data, and
   races them through a hook that lets the other clone land first:

     A  different data files      rung 1+2: rebase with the generated files
                                  rebuilt, not merged; both rows land
     B  rows side by side         rung 3: data conflict → reset + one re-run
     C  the same row twice        the rebase leaves nothing; success, no push
     D  the race lost twice       "FAIL push race", exit 1 (classified transient)
     E  AUSPOL_PR_GATE=1          commit stays local
     F  AUSPOL_RUNNER_CLONE=1     the laptop's clone drops an interrupted run's
                                  leftovers under the lock instead of refusing

   Run: node .build/test-push-main.mjs */
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, copyFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import assert from "node:assert/strict";

const HELPER = path.resolve(".build/git-push-main.sh");
const root = mkdtempSync(path.join(tmpdir(), "pushmain-"));
const git = (cwd, ...args) =>
  execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

// ---- the toy repo --------------------------------------------------------------
const TOY = {
  "data/polls.json": '{\n "rows": [\n  {"id": "seed"}\n ]\n}\n',
  "data/other.json": '{\n "rows": [\n  {"id": "seed-other"}\n ]\n}\n',
  // extract: idempotently add $TOY_ROW to the top of $TOY_FILE
  ".build/toy-extract.mjs": `import { readFileSync, writeFileSync } from "node:fs";
const file = process.env.TOY_FILE, row = process.env.TOY_ROW;
const text = readFileSync(file, "utf8");
if (text.includes('"id": "' + row + '"')) { console.log('TOY_STATUS {"changed":false}'); process.exit(0); }
const lines = text.split("\\n");
lines.splice(lines.findIndex((l) => l.includes('"rows": [')) + 1, 0, '  {"id": "' + row + '"},');
writeFileSync(file, lines.join("\\n"));
console.log('TOY_STATUS {"changed":true}');
`,
  // build: every generated file is a pure function of both data files
  ".build/newtracker/build.mjs": `import { readFileSync, writeFileSync, readdirSync, unlinkSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
const ids = ["data/polls.json", "data/other.json"].flatMap((f) => JSON.parse(readFileSync(f, "utf8")).rows.map((r) => r.id)).sort();
const body = ids.join(",");
writeFileSync("index.html", "<!doctype html><!-- " + body + " -->\\n");
writeFileSync("feed.xml", "<feed>" + body + "</feed>\\n");
mkdirSync("assets", { recursive: true });
for (const f of readdirSync("assets")) if (/^layer-.*\\.js$/.test(f)) unlinkSync("assets/" + f);
writeFileSync("assets/layer-" + createHash("sha1").update(body).digest("hex").slice(0, 8) + ".js", "window.ids=" + JSON.stringify(ids) + ";\\n");
`,
  ".build/newtracker/validate.mjs": `import { readFileSync } from "node:fs";
for (const f of ["data/polls.json", "data/other.json"]) JSON.parse(readFileSync(f, "utf8"));
`,
  ".build/newtracker/render-card.mjs": "",
  ".build/newtracker/render-favicon.mjs": "",
  // the wrapper: the real wrappers' shape, cut down
  ".build/toy-updater.sh": `#!/bin/bash
set -uo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO"
LOG=".build/logs/toy.log"; mkdir -p .build/logs
log() { echo "$(date '+%Y-%m-%d %H:%M:%S') $*" >> "$LOG"; }
. "$REPO/.build/git-push-main.sh"
acquire_slot_lock
freshness_sync || exit 0
OUT="$(node .build/toy-extract.mjs)" || { log "FAIL extract (exit 1): $OUT"; exit 1; }
echo "$OUT" | grep -q '"changed":true' || exit 0
node .build/newtracker/validate.mjs >> "$LOG" 2>&1 || { log "FAIL validate"; exit 1; }
refresh_site || exit 1
git add data/ index.html feed.xml assets/ || exit 1
git commit -qm "toy: $TOY_ROW" >> "$LOG" 2>&1 || { log "FAIL git commit"; exit 1; }
# test hook: another writer lands between our commit and our push
if [ -n "\${TOY_RACE_HOOK:-}" ] && { [ -z "\${AUSPOL_PUSH_RERUN:-}" ] || [ -n "\${TOY_RACE_ALWAYS:-}" ]; }; then
  bash -c "$TOY_RACE_HOOK"
fi
push_main "toy: $TOY_ROW" data/ index.html feed.xml assets/ || exit 1
log "OK pushed: toy: $TOY_ROW"
`,
  ".gitignore": ".build/logs/\n.build/locks/\n",
};

const origin = path.join(root, "origin.git");
git(root, "init", "-q", "--bare", "-b", "main", origin);
const seed = path.join(root, "seed");
git(root, "init", "-q", "-b", "main", seed);
for (const [f, body] of Object.entries(TOY)) {
  mkdirSync(path.dirname(path.join(seed, f)), { recursive: true });
  writeFileSync(path.join(seed, f), body);
}
mkdirSync(path.join(seed, ".build"), { recursive: true });
copyFileSync(HELPER, path.join(seed, ".build/git-push-main.sh"));
execFileSync("node", [".build/newtracker/build.mjs"], { cwd: seed });
git(seed, "-c", "user.name=seed", "-c", "user.email=seed@example.com", "add", "-A");
git(seed, "-c", "user.name=seed", "-c", "user.email=seed@example.com", "commit", "-qm", "seed");
git(seed, "remote", "add", "origin", origin);
git(seed, "push", "-q", "origin", "main");

const clone = (name) => {
  const dir = path.join(root, name);
  git(root, "clone", "-q", origin, dir);
  git(dir, "config", "user.name", name);
  git(dir, "config", "user.email", `${name}@example.com`);
  return dir;
};
const one = clone("one"), two = clone("two");

// run a clone's toy wrapper; `race` is the other clone's run, fired from the hook
const cleanEnv = () => {
  const env = { ...process.env };
  for (const k of ["TOY_RACE_HOOK", "TOY_RACE_ALWAYS", "AUSPOL_PUSH_RERUN", "AUSPOL_PR_GATE", "GITHUB_ACTIONS"]) delete env[k];
  return env;
};
const hookFor = (dir, file, row) =>
  `env -u TOY_RACE_HOOK -u TOY_RACE_ALWAYS -u AUSPOL_PUSH_RERUN TOY_FILE=${file} TOY_ROW=${row} bash '${dir}/.build/toy-updater.sh'`;
function run(dir, file, row, extra = {}) {
  const r = spawnSync("bash", [path.join(dir, ".build/toy-updater.sh")], {
    encoding: "utf8", env: { ...cleanEnv(), TOY_FILE: file, TOY_ROW: row, ...extra },
  });
  const log = existsSync(path.join(dir, ".build/logs/toy.log")) ? readFileSync(path.join(dir, ".build/logs/toy.log"), "utf8") : "";
  writeFileSync(path.join(dir, ".build/logs/toy.log"), ""); // one scenario per read
  return { code: r.status, log, stderr: r.stderr };
}
const originFile = (f) => git(one, "show", `origin/main:${f}`);
const fetchBoth = () => { git(one, "fetch", "-q", "origin"); git(two, "fetch", "-q", "origin"); };
// what a fresh build of origin/main's data would produce — generated files must match it
function assertOriginConsistent(label) {
  const check = path.join(root, "check-" + label);
  git(root, "clone", "-q", origin, check);
  const before = readFileSync(path.join(check, "index.html"), "utf8");
  execFileSync("node", [".build/newtracker/build.mjs"], { cwd: check });
  assert.equal(readFileSync(path.join(check, "index.html"), "utf8"), before, `${label}: origin's index.html is what its data builds`);
  assert.equal(git(check, "status", "--porcelain"), "", `${label}: a rebuild of origin/main changes nothing (assets/feed consistent)`);
}

// ---- A: different data files — rung 1 + 2 --------------------------------------
let r = run(one, "data/polls.json", "a1", { TOY_RACE_HOOK: hookFor(two, "data/other.json", "a2") });
assert.equal(r.code, 0, "A exits 0\n" + r.log + r.stderr);
assert.match(r.log, /push rejected; rebasing onto origin\/main/, "A took the rebase path");
assert.doesNotMatch(r.log, /re-running|FAIL/, "A needed no re-run\n" + r.log);
fetchBoth();
assert.match(originFile("data/polls.json"), /"a1"/, "A: our row landed");
assert.match(originFile("data/other.json"), /"a2"/, "A: their row survived");
assert.match(originFile("index.html"), /a1.*a2|a2.*a1/, "A: index.html was rebuilt from BOTH rows");
assertOriginConsistent("A");

// ---- B: rows side by side in one file — rung 3 ---------------------------------
r = run(one, "data/polls.json", "b1", { TOY_RACE_HOOK: hookFor(two, "data/polls.json", "b2") });
assert.equal(r.code, 0, "B exits 0\n" + r.log + r.stderr);
assert.match(r.log, /conflicted on data.*re-running toy-updater\.sh once/, "B re-ran on the fresh base\n" + r.log);
fetchBoth();
assert.match(originFile("data/polls.json"), /"b1"/, "B: our row landed on the re-run");
assert.match(originFile("data/polls.json"), /"b2"/, "B: their row survived");
assertOriginConsistent("B");
assert.equal(existsSync(path.join(one, ".build/locks/writers.lock")), false, "B: the re-run released the writers lock");

// ---- C: the same row from both sides ------------------------------------------
r = run(one, "data/polls.json", "c1", { TOY_RACE_HOOK: hookFor(two, "data/polls.json", "c1") });
assert.equal(r.code, 0, "C exits 0\n" + r.log + r.stderr);
assert.match(r.log, /nothing of ours left after the rebase|re-running/, "C: recognised the change as already landed\n" + r.log);
fetchBoth();
assert.equal((originFile("data/polls.json").match(/"c1"/g) || []).length, 1, "C: the row landed once");
assert.equal(git(one, "rev-parse", "HEAD"), git(one, "rev-parse", "origin/main"), "C: nothing left unpushed");
assertOriginConsistent("C");

// ---- D: the race lost twice ------------------------------------------------------
// a fresh row every time the hook fires ($RANDOM expands inside the hook's bash -c)
const hookD = hookFor(two, "data/polls.json", "d-$RANDOM$RANDOM");
r = run(one, "data/polls.json", "d1", { TOY_RACE_HOOK: hookD, TOY_RACE_ALWAYS: "1" });
assert.equal(r.code, 1, "D exits 1\n" + r.log + r.stderr);
assert.match(r.log, /re-running toy-updater\.sh once/, "D re-ran once");
assert.match(r.log, /FAIL push race/, "D gave up with the transient signature\n" + r.log);
assert.equal((r.log.match(/re-running/g) || []).length, 1, "D re-ran exactly once");
fetchBoth();
assertOriginConsistent("D");
git(one, "reset", "-q", "--hard", "origin/main");

// ---- E: agent sessions never push ----------------------------------------------
const tipBefore = git(one, "rev-parse", "origin/main");
r = run(one, "data/polls.json", "e1", { AUSPOL_PR_GATE: "1" });
assert.equal(r.code, 0, "E exits 0\n" + r.log);
assert.match(r.log, /commit left local/, "E left the commit local");
git(one, "fetch", "-q", "origin");
assert.equal(git(one, "rev-parse", "origin/main"), tipBefore, "E: origin untouched");

// ---- F: the laptop's runner clone heals an interrupted run's leftovers ------------
// (acquire_slot_lock, under the lock, only when AUSPOL_RUNNER_CLONE=1)
git(one, "reset", "-q", "--hard", "origin/main");
writeFileSync(path.join(one, "data/other.json"), readFileSync(path.join(one, "data/other.json"), "utf8").replace("seed-other", "half-written"));
r = run(one, "data/polls.json", "f1", { AUSPOL_RUNNER_CLONE: "1" });
assert.equal(r.code, 0, "F exits 0\n" + r.log + r.stderr);
assert.match(r.log, /runner clone: discarding an interrupted run's uncommitted leftovers/, "F healed\n" + r.log);
fetchBoth();
assert.doesNotMatch(originFile("data/other.json"), /half-written/, "F: the leftover never reached origin");
assert.match(originFile("data/polls.json"), /"f1"/, "F: the run itself landed");

console.log("test-push-main: ok");
