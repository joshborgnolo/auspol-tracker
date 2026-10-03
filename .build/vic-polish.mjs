#!/usr/bin/env node
// vic-polish — the Vic-page review LOOP: alternates a builder agent and a
// reviewer agent (headless matilda sessions) until the reviewer finds the
// /vic/ satellite up to the main page's standard, per .build/vic-main-
// standard.md. Built for unattended overnight runs from .build/vic-polish.sh,
// which runs it inside the dedicated clone (never the user's shared checkout:
// push_main's conflict rungs reset --hard, and the writers lock assumes a
// nobody-edits checkout — the launchd-clone precedent in install-launchd.sh).
//
// One round:
//   1. porcelain snapshot
//   2. BUILDER session  (25m / 80 tool calls; edits only vic-scope paths)
//   3. deterministic GATE (refresh-vic → validate → site-shell --check →
//      audit probe → npm test) — builder claims are never believed
//   4. REVIEWER session (10m / 25 tool calls; reads the standard, the audit
//      pack, the sources; answers VP_VERDICT JSON — observation, never code)
//   5. ledger update (open/closed/stuck gaps) + accepted-round commit+push
//      through push_main (accepted = gate green and scope clean)
//
// TRUST MODEL, transferred from adjudicate.mjs: an invalid reviewer emission
// (unparseable, poisoned, or shape-violating) is retried ONCE; still invalid
// stops the run inconclusive, always exit 0 — an invalid verdict is a no-op,
// never an incident. The LLM sessions are the only non-deterministic parts;
// git scope, the gate, the ledger and the status line are not.
//
// Usage:
//   node .build/vic-polish.mjs [--repo <dir>] [--rounds=N] [--hours=N]
//     [--max-sessions=N] [--builder-wall=25m] [--reviewer-wall=10m]
//     [--no-push] [--force] [--skip-gate] [--skip-npm-test]
// Last stdout line is always `VPOLISH_STATUS {json}`; exit is always 0.
import { readFileSync, existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  STATUS_TAG, builderAllowed, parseVerdict, builderSummary,
  readLedger, writeLedger, sessions24h, mergeLedgerGaps,
  LEDGER_PATH, REPORTS_DIR,
} from "./vic-polish-lib.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));

const MAX_ROUNDS_DEF = 5;
const RUN_HOURS_DEF = 6;
const BREAKER_MAX_DEF = 20; // agent sessions (builder+reviewer) per rolling 24h
const BUILDER_WALL_DEF = "25m";
const REVIEWER_WALL_DEF = "10m";
const BUILDER_TOOLS = 80;
const REVIEWER_TOOLS = 25; // the reviewer verifies claims with local reads before filing
const REVIEWER_RETRIES = 1;

const argv = process.argv.slice(2);
// Both --name=value and --name value forms; a missing/flag-style next token
// means the value form was never passed (flags stay FLAG-only).
const ARGV = (n) => {
  const eq = argv.find((x) => x.startsWith("--" + n + "="));
  if (eq) return eq.slice(n.length + 3);
  const i = argv.indexOf("--" + n);
  if (i >= 0 && i + 1 < argv.length && !argv[i + 1].startsWith("--")) return argv[i + 1];
  return null;
};
const FLAG = (n) => argv.includes("--" + n);

const done = (s) => { console.log(STATUS_TAG + " " + JSON.stringify(s)); process.exit(0); };
// A --repo flag that parses to nothing must never silently retarget the
// loop at this checkout — refuse instead.
if ((argv.includes("--repo") || argv.some((x) => x.startsWith("--repo="))) && !ARGV("repo")) {
  console.log(STATUS_TAG + " " + JSON.stringify({ ran: false, why: "--repo passed without a directory" }));
  process.exit(0);
}
const repo = path.resolve(ARGV("repo") || path.resolve(HERE, ".."));
const MAX_ROUNDS = Math.max(1, parseInt(ARGV("rounds") || MAX_ROUNDS_DEF, 10) || MAX_ROUNDS_DEF);
const RUN_HOURS = Math.max(0.5, parseFloat(ARGV("hours") || RUN_HOURS_DEF) || RUN_HOURS_DEF);
const BREAKER_MAX = Math.max(1, parseInt(ARGV("max-sessions") || BREAKER_MAX_DEF, 10) || BREAKER_MAX_DEF);
const BUILDER_WALL = ARGV("builder-wall") || BUILDER_WALL_DEF;
const REVIEWER_WALL = ARGV("reviewer-wall") || REVIEWER_WALL_DEF;
const NO_PUSH = FLAG("no-push");
const FORCE = FLAG("force");
const SKIP_GATE = FLAG("skip-gate"); // fixture-test seam: git/llm logic only
const SKIP_NPM_TEST = FLAG("skip-npm-test");

const isoNow = () => new Date().toISOString();
const wallMs = (w) => { const m = String(w).match(/^(\d+)([smh])$/); if (!m) return 600e3; const n = +m[1]; return n * ({ s: 1e3, m: 60e3, h: 3600e3 })[m[2]]; };
// Stop starting a round when the run wall can no longer hold one, sized off
// the CONFIGURED walls: builder + (reviewer with its retry) + gate slack.
// A fixed 40m floor made short-budget smoke runs cap before round 1.
const MIN_ROUND_REMAIN_MS = wallMs(BUILDER_WALL) + wallMs(REVIEWER_WALL) * (1 + REVIEWER_RETRIES) + 5 * 60e3;

// ---- git helpers --------------------------------------------------------------
function git(args, { allowFail = false, env = {} } = {}) {
  const r = spawnSync("git", ["-C", repo, ...args], { encoding: "utf8", env: { ...process.env, GIT_TERMINAL_PROMPT: "0", ...env } });
  if (r.error || (r.status !== 0 && !allowFail)) {
    throw new Error(`git ${args.join(" ")} failed: ${r.error ? r.error.message : (r.stderr || "").trim().slice(0, 300)}`);
  }
  return { status: r.status || 0, stdout: r.stdout || "", stderr: r.stderr || "" };
}

// Porcelain snapshot as a Map of path → "tracked-modified"|"untracked".
// -z output: records are "XY <path>" NUL-separated; rename/copy records carry
// a second NUL field (the source path) which we skip. -uall so a first-run
// untracked .build/vic-src/ enumerates its files individually (the ledger
// commit and the scratch keep list both need file-level truth).
function porcelain() {
  const out = git(["status", "--porcelain=v1", "-z", "--untracked-files=all"]).stdout;
  const parts = out.split("\0").filter(Boolean);
  const m = new Map();
  for (let i = 0; i < parts.length; i++) {
    const rec = parts[i];
    const xy = rec.slice(0, 2);
    let p = rec.slice(3);
    if (xy[0] === "R" || xy[0] === "C") { i++; } // consume the source-path field
    m.set(p, xy.includes("?") ? "untracked" : "modified");
  }
  return m;
}

// Revert what the LLM sessions left outside their remit. Files dirty BEFORE
// the session are never touched (sibling-runner dirt is not ours) — in the
// dedicated runner clone there should be none; in tests the baseline commit
// gives a clean tree. tracked → git checkout --; untracked outside any
// allowed dir → delete (recorded); untracked in scratch → left (never staged).
function scopeEnforce(before, { readOnly = false } = {}) {
  const after = porcelain();
  const reverted = [], deleted = [], kept = [];
  for (const [p, kind] of after) {
    if (!builderAllowed(p) || readOnly) {
      if (before.has(p)) continue; // pre-existing dirt: not ours to move
      if (kind === "modified") { git(["checkout", "--", p]); reverted.push(p); }
      else {
        const isScratch = p.startsWith(".build/vic-src/") && !readOnly;
        if (isScratch) { kept.push(p); continue; }
        rmSync(path.join(repo, p), { force: true, recursive: true });
        deleted.push(p);
      }
    }
  }
  return { reverted, deleted, kept };
}

// ---- agent sessions -------------------------------------------------------------
function cliPresent() {
  const w = spawnSync("which", ["matilda"], { encoding: "utf8" });
  return w.status === 0 && w.stdout.trim() ? true : false;
}

function runAgent(promptFile, contextBlock, { wall, tools }) {
  const prompt = readFileSync(promptFile, "utf8") + "\n\n" +
    "## Round context (JSON)\n\n```json\n" + JSON.stringify(contextBlock, null, 2) + "\n```\n";
  const res = spawnSync("matilda", [
    "-p", prompt,
    "--yolo",
    "--output-format", "text",
    "--max-wall-time", wall,
    "--max-tool-calls", String(tools),
  ], {
    encoding: "utf8", cwd: repo, timeout: wallMs(wall) + 180e3,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  });
  return { status: res.status, stdout: res.stdout || "", stderr: res.stderr || "", error: res.error };
}

// ---- deterministic gate -----------------------------------------------------------
function runGate(roundDir) {
  const steps = [];
  const run = (name, cmd, args, env = {}) => {
    const r = spawnSync(cmd, args, { encoding: "utf8", cwd: repo, env: { ...process.env, GIT_TERMINAL_PROMPT: "0", ...env } });
    steps.push({ name, ok: r.status === 0, code: r.status, tail: (r.stderr || r.stdout || "").trim().split("\n").slice(-3).join(" | ").slice(0, 400) });
    return r.status === 0;
  };
  let ok = true;
  ok = run("refresh-vic", "node", [".build/refresh-vic.mjs"]) && ok;
  ok = run("validate", "node", [".build/newtracker/validate.mjs"]) && ok;
  ok = run("site-shell-check", "node", [".build/site-shell.mjs", "--check"]) && ok;
  ok = run("probe-pack", "node", [".build/probe-vic-standard.mjs"], { VP_PACK_OUT: path.join(roundDir, "pack.json") }) && ok;
  if (!SKIP_NPM_TEST) ok = run("npm-test", "npm", ["test"]) && ok;
  return { ok, steps };
}

// ---- commit + push ---------------------------------------------------------------
function commitRound(msg, files) {
  if (!files.length) return null;
  git(["add", "--", ...files]);
  git(["commit", "-q", "-m", msg], {
    env: {
      GIT_AUTHOR_NAME: "vic-polish loop", GIT_AUTHOR_EMAIL: "vic-polish@localhost",
      GIT_COMMITTER_NAME: "vic-polish loop", GIT_COMMITTER_EMAIL: "vic-polish@localhost",
    },
  });
  const rev = git(["rev-parse", "--short=8", "HEAD"]).stdout.trim();
  if (NO_PUSH) return { rev, pushed: false, why: "no-push" };
  const script = [
    'REPO="$1"; LOG="$REPO/.build/logs/vic-polish.log"; mkdir -p "$(dirname "$LOG")"',
    'log(){ printf "%s %s\\n" "$(date -u +%FT%TZ)" "$*" >> "$LOG"; }',
    'export AUSPOL_RUNNER_CLONE=1; unset AUSPOL_PR_GATE',
    'source .build/git-push-main.sh; shift; push_main "$@"',
  ].join("\n");
  const r = spawnSync("bash", ["-c", script, "vc", repo, msg, ...files], { encoding: "utf8", cwd: repo, env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } });
  return { rev, pushed: r.status === 0, why: r.status === 0 ? undefined : (r.stderr || r.stdout || "").trim().slice(-300) };
}

// ==================================================================================
if (!existsSync(path.join(repo, ".git"))) done({ ran: false, why: `${repo} is not a git checkout` });
if (SKIP_GATE && !NO_PUSH) done({ ran: false, why: "--skip-gate requires --no-push (test seam)" });
if (!process.env.MATILDA_API_KEY) done({ ran: false, why: "no-key" });
if (!cliPresent()) done({ ran: false, why: "no-cli" });

const ledger = readLedger(repo);
if (!FORCE && sessions24h(ledger) >= BREAKER_MAX) {
  done({ ran: false, why: "breaker", sessions24h: sessions24h(ledger), max: BREAKER_MAX });
}

const startedAt = isoNow();
const deadline = Date.now() + RUN_HOURS * 3600e3;
const runRec = { started: startedAt, rounds: [] };
ledger.sessions.push(startedAt);

const dirtyBaseline = [...porcelain().keys()];
if (dirtyBaseline.length && !SKIP_GATE) {
  // The wrapper resets dead-run leftovers before calling us; dirt here means
  // someone is working in the loop's checkout — never risk their work.
  done({ ran: false, why: `checkout not clean at start (${dirtyBaseline.slice(0, 5).join(", ")}…)` });
}

let verdict = "cap";
let roundsRun = 0;
const commits = [];

// Commit everything the loop legitimately owns right now: builder-scope
// files (only when gateOk — a red gate means the round is unaccepted) plus
// the committed ledger. Ledger dirtiness is judged BEFORE writeLedger — the
// write itself would make a first run always look "already existed".
function commitDirtyFiles(msg, { gateOk = true } = {}) {
  const dirtyNow = porcelain();
  const commitFiles = [...dirtyNow.keys()].filter((p) => builderAllowed(p) && p !== LEDGER_PATH);
  const ledgerDirty = dirtyNow.has(LEDGER_PATH) || !existsSync(path.join(repo, LEDGER_PATH));
  writeLedger(repo, ledger);
  const files = [];
  if (gateOk) files.push(...commitFiles);
  if (ledgerDirty) files.push(LEDGER_PATH);
  const skipped = commitFiles.length && !gateOk ? commitFiles : null;
  if (!files.length) return { skipped };
  const c = commitRound(msg, files);
  if (c) commits.push(c.rev);
  return { c, skipped };
}

for (let round = 1; round <= MAX_ROUNDS; round++) {
  if (Date.now() + MIN_ROUND_REMAIN_MS > deadline) { verdict = roundsRun ? "timecap" : "cap"; break; }
  const roundIso = isoNow();
  const roundDir = path.join(repo, REPORTS_DIR, `${roundIso.replace(/[:.]/g, "")}-r${round}`);
  mkdirSync(roundDir, { recursive: true });
  const rec = { round, started: roundIso };
  const openBefore = Object.values(ledger.gaps).filter((r) => r.status === "open" || r.status === "stuck");

  // -- builder -----------------------------------------------------------------
  const before = porcelain();
  ledger.sessions.push(isoNow()); // every agent session costs the breaker budget
  const b = runAgent(path.join(repo, ".build/vic-polish-builder-prompt.md"), {
    round, roundsMax: MAX_ROUNDS,
    openGaps: openBefore.map(({ id, area, claim, evidence, status, seen }) => ({ id, area, claim, evidence, status, seenRounds: seen.length })),
    lastRoundSummary: runRec.rounds.length ? runRec.rounds[runRec.rounds.length - 1].builderSummary || null : null,
    reportsDir: path.relative(repo, roundDir),
  }, { wall: BUILDER_WALL, tools: BUILDER_TOOLS });
  rec.builder = { exit: b.status, summary: builderSummary(b.stdout) };
  writeFileSync(path.join(roundDir, "builder.out"), (b.stdout || "") + "\n--- STDERR ---\n" + (b.stderr || ""));
  if (b.error) { rec.builder.error = String(b.error.message || b.error); }

  const scopeB = scopeEnforce(before);
  if (scopeB.reverted.length || scopeB.deleted.length) rec.builderScopeViolations = [...scopeB.reverted, ...scopeB.deleted];

  // -- gate --------------------------------------------------------------------
  const gate = SKIP_GATE ? { ok: true, steps: [{ name: "skipped", ok: true }] } : runGate(roundDir);
  rec.gate = gate;
  const scopeG = scopeEnforce(before); // gate-generated/generated-file drift reverts too
  const scope = { ...scopeB, reverted: [...scopeB.reverted, ...scopeG.reverted], deleted: [...scopeB.deleted, ...scopeG.deleted] };

  // -- reviewer ----------------------------------------------------------------
  let vr = null, vAttempts = 0;
  pack: while (vAttempts <= REVIEWER_RETRIES) {
    vAttempts++;
    const reviewerBefore = porcelain();
    ledger.sessions.push(isoNow()); // reviewer sessions also cost the breaker budget
    const r = runAgent(path.join(repo, ".build/vic-polish-reviewer-prompt.md"), {
      round,
      openGaps: Object.values(ledger.gaps).filter((g) => g.status !== "closed")
        .map(({ id, area, claim, evidence, status, seen }) => ({ id, area, claim, evidence, status, seenRounds: seen.length })),
      auditPack: existsSync(path.join(roundDir, "pack.json")) ? REPORTS_DIR + "/" + path.basename(roundDir) + "/pack.json" : null,
      standard: ".build/vic-main-standard.md",
      ...(vAttempts > 1 && vr ? { previousEmissionInvalid: vr.why } : {}),
    }, { wall: REVIEWER_WALL, tools: REVIEWER_TOOLS });
    const scopeR = scopeEnforce(reviewerBefore, { readOnly: true });
    if (scopeR.reverted.length || scopeR.deleted.length) {
      rec.reviewerScopeViolations = [...scopeR.reverted, ...scopeR.deleted];
      vr = { ok: false, why: `reviewer tried to modify files (${rec.reviewerScopeViolations.join(", ")}) — observation only` };
      continue pack;
    }
    vr = parseVerdict(r.stdout);
    if (vr.ok) { rec.reviewer = { exit: r.status, verdict: vr.verdict.verdict, gaps: (vr.verdict.gaps || []).length, attempts: vAttempts }; writeFileSync(path.join(roundDir, "reviewer.out"), (r.stdout || "") + "\n--- STDERR ---\n" + (r.stderr || "")); break pack; }
    rec.reviewer = { exit: r.status, invalid: vr.why, attempts: vAttempts };
    writeFileSync(path.join(roundDir, `reviewer-${vAttempts}.out`), (r.stdout || "") + "\n--- STDERR ---\n" + (r.stderr || ""));
  }
  if (!vr || !vr.ok) {
    rec.finished = isoNow();
    runRec.rounds.push(rec);
    ledger.runs.push({ ...runRec, verdict: "invalid", finished: rec.finished });
    commitDirtyFiles(`vicpoll: polish round ${round}/${MAX_ROUNDS} (vic-polish) — invalid run`, { gateOk: false });
    done({ ran: true, rounds: rec.round, verdict: "invalid", why: vr ? vr.why : "reviewer session failed", commits });
  }

  // -- ledger + gap state --------------------------------------------------------
  const gaps = vr.verdict.gaps || [];
  const mg = mergeLedgerGaps(ledger, gaps, roundIso);
  rec.openAfter = mg.open.map((g) => g.id);

  rec.finished = isoNow();
  runRec.rounds.push(rec);
  roundsRun = round;

  const passRound = vr.verdict.verdict === "pass" && gate.ok;
  const stuckRound = mg.stuckList.length > 0;
  const endVerdict = stuckRound ? "stuck"
    : passRound ? "pass"
    : (round === MAX_ROUNDS || Date.now() + MIN_ROUND_REMAIN_MS > deadline)
      ? (vr.verdict.verdict === "pass" ? "gate-red" : "gaps")
      : null;
  if (endVerdict) ledger.runs.push({ ...runRec, verdict: endVerdict, finished: rec.finished });

  // -- commit + push ------------------------------------------------------------
  const msg = `vicpoll: polish round ${round}/${MAX_ROUNDS} (vic-polish)` +
    (rec.builder.summary ? ` — ${rec.builder.summary}` : "") +
    (mg.open.length ? ` — open gaps: ${mg.open.map((g) => g.id).join(", ")}` : " — reviewer clean");
  const cc = commitDirtyFiles(msg, { gateOk: gate.ok });
  if (cc.c) rec.commit = cc.c;
  if (cc.skipped) rec.commitSkipped = "gate red — builder edits left uncommitted (ledger-only commit)";

  if (endVerdict) {
    done({
      ran: true, rounds: roundsRun, verdict: endVerdict, commits,
      ...(mg.open.length ? { openGaps: mg.open.map((g) => g.id) } : {}),
      ...(stuckRound ? { stuck: mg.stuckList.map((g) => g.id) } : {}),
    });
  }
  verdict = vr.verdict.verdict === "pass" ? "gate-red" : "gaps"; // reviewer happy but the gate is not — keep looping
}

ledger.runs.push({ ...runRec, verdict, finished: isoNow() });
commitDirtyFiles(`vicpoll: polish ${verdict} (vic-polish)`, { gateOk: false });
done({
  ran: true, rounds: roundsRun, verdict, commits,
  openGaps: Object.values(ledger.gaps).filter((r) => r.status === "open").map((r) => r.id),
});
