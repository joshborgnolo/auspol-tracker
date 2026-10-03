/* Fixture test for the vic-polish loop: vic-polish-lib.mjs contract tests,
   then the orchestrator (.build/vic-polish.mjs) against throwaway git repos
   with a stubbed `matilda` CLI on PATH (the test-adjudicate.mjs pattern).
   Run: node .build/test-vic-polish.mjs */
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";

const {
  parseVerdict, builderAllowed, builderSummary,
  readLedger, mergeLedgerGaps, blankLedger, sessions24h, gapKey,
} = await import("./vic-polish-lib.mjs");

// ---- A. contract table -----------------------------------------------------------
{
  const good = { verdict: "gaps", gaps: [{ id: "tpp-no-hover", area: "visual", claim: "no hover on dots", evidence: "pack check x; vic/index.html:120" }] };
  assert.equal(parseVerdict(`VP_VERDICT ${JSON.stringify(good)}`).ok, true);
  assert.equal(parseVerdict("prose\nVP_VERDICT {\"verdict\":\"pass\",\"gaps\":[]}").ok, true);
  assert.equal(parseVerdict("prose and no line").ok, false, "missing tag");
  assert.equal(parseVerdict("VP_VERDICT {\"verdict\":\"gaps\",\"gaps\":[]}").ok, false, "empty gaps means pass");
  assert.equal(parseVerdict("VP_VERDICT {\"verdict\":\"pass\",\"gaps\":[{\"id\":\"a\",\"area\":\"data\",\"claim\":\"c\",\"evidence\":\"e\",\"code\":\"rm\"}]}").ok, false, "poison key on a gap");
  assert.equal(parseVerdict("VP_VERDICT {\"verdict\":\"gaps\",\"gaps\":[{\"id\":\"a\",\"area\":\"audio\",\"claim\":\"c\",\"evidence\":\"e\"}]}").ok, false, "unknown area");
  assert.equal(parseVerdict("VP_VERDICT {\"verdict\":\"gaps\",\"gaps\":[{\"id\":\"BAD ID!\",\"area\":\"data\",\"claim\":\"c\",\"evidence\":\"e\"}]}").ok, false, "id charset");
  assert.equal(parseVerdict(`VP_VERDICT {"verdict":"gaps","gaps":${JSON.stringify([{ id: "a", area: "data", claim: "c", evidence: "e" }, { id: "a", area: "data", claim: "c", evidence: "e" }])}}`).ok, false, "duplicate ids");
  const many = Array.from({ length: 13 }, (_, i) => ({ id: `g-${i}`, area: "data", claim: "c", evidence: "e" }));
  assert.equal(parseVerdict(`VP_VERDICT ${JSON.stringify({ verdict: "gaps", gaps: many })}`).ok, false, "over MAX_GAPS");
  const long = { verdict: "gaps", gaps: [{ id: "a", area: "data", claim: "x".repeat(301), evidence: "e" }] };
  assert.equal(parseVerdict(`VP_VERDICT ${JSON.stringify(long)}`).ok, false, "claim too long");
  assert.ok(builderAllowed("vic/index.html"));
  assert.ok(builderAllowed(".build/refresh-vic.mjs"));
  assert.ok(builderAllowed(".build/vic-src/evidence.txt"));
  assert.ok(!builderAllowed(".build/vic-src/polish-ledger.json"), "ledger is loop-owned");
  assert.ok(!builderAllowed(".build/vic-src/polish-reports/x.json"), "reports are loop-owned");
  assert.ok(!builderAllowed(".build/probe-vic-standard.mjs"), "may not weaken the watchdog");
  assert.ok(!builderAllowed("index.html"));
  assert.ok(!builderAllowed(".build/vic-polish.mjs"));
  assert.equal(builderSummary("lines\nBUILDER_SUMMARY one\nthen\nBUILDER_SUMMARY two\n"), "two");

  // ledger merge rules: open → stuck at 3rd sighting; quiet-close at 2 misses
  const l = blankLedger();
  const gap = { id: "g", area: "data", claim: "c", evidence: "e" };
  let m = mergeLedgerGaps(l, [gap], "t1");
  assert.equal(m.open.length, 1);
  m = mergeLedgerGaps(l, [gap], "t2");
  m = mergeLedgerGaps(l, [], "t3"); // one miss
  assert.equal(l.gaps["data:g"].status, "open");
  m = mergeLedgerGaps(l, [], "t4"); // second miss → closed-quiet
  assert.equal(l.gaps["data:g"].status, "closed");
  m = mergeLedgerGaps(l, [gap], "t5"); // reopens
  assert.equal(l.gaps["data:g"].status, "open");
  mergeLedgerGaps(l, [gap], "t6");
  assert.equal(l.gaps["data:g"].status, "stuck", "stuck at the STUCK_AFTERth sighting");
  assert.ok(gapKey(gap) === "data:g");
  assert.ok(sessions24h({ sessions: [new Date().toISOString(), "2000-01-01T00:00:00.000Z"] }) === 1);
  console.log("contract table: ok");
}

// ---- B. orchestrator against temp repos + stub CLI --------------------------------
const bin = mkdtempSync(path.join(tmpdir(), "vp-bin-"));
const stub = `#!/usr/bin/env node
// stub matilda CLI: VP_STUB_MODE = "<builder>+<reviewer>".
// builder: noedit | edit (appends a comment to vic/index.html)
//          | violate (also dirties the OUT-OF-SCOPE main index.html)
// reviewer: pass | gaps-2 (gaps on round 1 only) | gaps-forever
//          | garbage | poison | poison-then-pass | violate-pass
const fs = require("fs");
const argv = process.argv.slice(2);
const p = argv[argv.indexOf("-p") + 1] || "";
const mode = process.env.VP_STUB_MODE || "edit+pass";
const [bm, rm] = mode.split("+");
const round = (p.match(/"round":\\s*(\\d+)/) || [0, 1])[1];
if (p.includes("STUB-BUILDER")) {
  if (bm === "edit" || bm === "violate") fs.appendFileSync("vic/index.html", "<!-- stub edit r" + round + " -->\\n");
  if (bm === "violate") fs.appendFileSync("index.html", "// stub junk must be reverted\\n");
  console.log("work\\nBUILDER_SUMMARY stub round " + round);
  process.exit(0);
}
if (p.includes("STUB-REVIEWER")) {
  const emit = (v) => { console.log("hmm\\nVP_VERDICT " + JSON.stringify(v)); };
  const gA = { id: "g-alpha", area: "visual", claim: "alpha claim", evidence: "pack#x" };
  const gB = { id: "g-beta", area: "data", claim: "beta claim", evidence: "data/vic-polls.json:1" };
  if (rm === "violate-pass" && !p.includes("previousEmissionInvalid")) fs.appendFileSync("index.html", "// reviewer junk\\n");
  if (rm === "garbage") { console.log("I cannot help with that."); process.exit(0); }
  if (rm === "poison") { emit({ verdict: "gaps", gaps: [{ ...gA, code: "x()" }] }); process.exit(0); }
  if (rm === "poison-then-pass" && !p.includes("previousEmissionInvalid")) { emit({ verdict: "gaps", gaps: [{ ...gA, snippet: "<div/>" }] }); process.exit(0); }
  if (rm === "gaps-2" && round < 2) { emit({ verdict: "gaps", gaps: [gA, gB] }); process.exit(0); }
  if (rm === "gaps-forever") { emit({ verdict: "gaps", gaps: [gA] }); process.exit(0); }
  emit({ verdict: "pass", gaps: [] });
  process.exit(0);
}
console.log("unrecognised prompt");
process.exit(1);
`;
writeFileSync(path.join(bin, "matilda"), stub);
chmodSync(path.join(bin, "matilda"), 0o755);

const ORCH = path.resolve(".build/vic-polish.mjs");

function makeRepo() {
  const d = mkdtempSync(path.join(tmpdir(), "vp-repo-"));
  const w = (f, s) => { mkdirSync(path.dirname(path.join(d, f)), { recursive: true }); writeFileSync(path.join(d, f), s); };
  w("vic/index.html", "<html>vic page</html>\n");
  w("index.html", "<html>main page</html>\n");
  w("data/vic-polls.json", '{"polls":[],"threeParty":[],"leadership":[]}\n');
  w(".gitignore", ".build/vic-src/polish-reports/\n");
  w(".build/vic-polish-builder-prompt.md", "STUB-BUILDER prompt for tests\n");
  w(".build/vic-polish-reviewer-prompt.md", "STUB-REVIEWER prompt for tests\n");
  w(".build/vic-main-standard.md", "the yardstick\n");
  const g = (args) => spawnSync("git", ["-C", d, ...args], { encoding: "utf8" });
  g(["init", "-q"]);
  g(["config", "user.email", "test@example.com"]);
  g(["config", "user.name", "test"]);
  g(["add", "-A"]);
  g(["commit", "-qm", "baseline"]);
  return d;
}

function vpRun(repo, { mode, env = {}, extra = [] }) {
  const r = spawnSync(process.execPath, [ORCH, "--repo", repo, "--skip-gate", "--no-push", "--rounds=5", "--hours=1", ...extra], {
    encoding: "utf8",
    env: { ...process.env, PATH: bin + path.delimiter + process.env.PATH, MATILDA_API_KEY: "stub", VP_STUB_MODE: mode, ...env },
  });
  const last = r.stdout.trim().split("\n").pop();
  assert.ok(last.startsWith("VPOLISH_STATUS "), `no status line: ${r.stdout}\n${r.stderr}`);
  assert.equal(r.status, 0, "orchestrator must always exit 0: " + last);
  const lines = r.stdout.trim().split("\n").filter((l) => l.startsWith("VPOLISH_STATUS "));
  assert.equal(lines.length, 1, "exactly one status line");
  const parsed = JSON.parse(last.slice(15));
  if (process.env.VP_TEST_DEBUG && parsed.verdict === "invalid") {
    console.error("--- invalid-run diagnostics (VP_TEST_DEBUG) ---\n" + r.stdout + "\n--- stderr ---\n" + r.stderr);
  }
  return { status: parsed, stdout: r.stdout, stderr: r.stderr };
}
const gitShow = (repo, f) => spawnSync("git", ["-C", repo, "show", `HEAD:${f}`], { encoding: "utf8" }).stdout;
const gitPorc = (repo) => spawnSync("git", ["-C", repo, "status", "--porcelain"], { encoding: "utf8" }).stdout.trim();
const gitLog = (repo) => spawnSync("git", ["-C", repo, "log", "--format=%s", "-n", "10"], { encoding: "utf8" }).stdout;

// B1 happy path: builder edits, reviewer passes, one commit lands
{
  const repo = makeRepo();
  const s = vpRun(repo, { mode: "edit+pass" }).status;
  assert.equal(s.ran, true); assert.equal(s.verdict, "pass"); assert.equal(s.rounds, 1);
  assert.equal(s.commits.length, 1, "one round commit");
  assert.ok(gitShow(repo, "vic/index.html").includes("stub edit r1"), "builder edit landed");
  assert.equal(gitShow(repo, "index.html"), "<html>main page</html>\n", "main page untouched");
  assert.equal(gitPorc(repo), "", "tree clean after commit (gitignored reports aside)");
  assert.ok(gitLog(repo).includes("vicpoll: polish round 1/5"), "commit message");
}
console.log("B1 happy path: ok");

// B2 gaps on round 1 then pass; a second run quiets the gaps to closed
{
  const repo = makeRepo();
  const s1 = vpRun(repo, { mode: "edit+gaps-2" }).status;
  assert.equal(s1.rounds, 2); assert.equal(s1.verdict, "pass"); assert.equal(s1.commits.length, 2);
  assert.deepEqual(s1.openGaps.sort(), ["g-alpha", "g-beta"]);
  const s2 = vpRun(repo, { mode: "noedit+pass" }).status;
  assert.equal(s2.rounds, 1); assert.equal(s2.verdict, "pass");
  const ledger = readLedger(repo);
  assert.equal(ledger.gaps["visual:g-alpha"].status, "closed", "unresurfaced gaps close after QUIET_AFTER");
  assert.ok(existsSync(path.join(repo, ".build/vic-src/polish-ledger.json")), "ledger file present");
  assert.ok(gitShow(repo, ".build/vic-src/polish-ledger.json").length > 50, "ledger committed");
}
console.log("B2 gap lifecycle: ok");

// B3 same gap forever → stuck stop at the STUCK_AFTERth sighting
{
  const repo = makeRepo();
  const s = vpRun(repo, { mode: "edit+gaps-forever" }).status;
  assert.equal(s.verdict, "stuck"); assert.equal(s.rounds, 3);
  assert.deepEqual(s.stuck, ["g-alpha"]);
}
console.log("B3 stuck stop: ok");

// B4 builder scope violation is reverted, recorded, and not committed
{
  const repo = makeRepo();
  const s = vpRun(repo, { mode: "violate+pass" }).status;
  assert.equal(s.verdict, "pass");
  assert.equal(gitShow(repo, "index.html"), "<html>main page</html>\n", "out-of-scope edit reverted");
  const ledger = readLedger(repo);
  assert.deepEqual(ledger.runs[ledger.runs.length - 1].rounds[0].builderScopeViolations, ["index.html"]);
}
console.log("B4 builder scope revert: ok");

// B5 reviewer scope violation is reverted and retired-then-resolved
{
  const repo = makeRepo();
  const s = vpRun(repo, { mode: "noedit+violate-pass" }).status;
  assert.equal(s.verdict, "pass", "violation attempt 1, clean pass attempt 2");
  assert.equal(gitShow(repo, "index.html"), "<html>main page</html>\n", "reviewer junk reverted");
  const ledger = readLedger(repo);
  assert.deepEqual(ledger.runs[ledger.runs.length - 1].rounds[0].reviewerScopeViolations, ["index.html"]);
}
console.log("B5 reviewer scope revert: ok");

// B6 invalid reviewer emissions: garbage twice → invalid; poison-then-pass retries once
{
  const repo = makeRepo();
  const s = vpRun(repo, { mode: "noedit+garbage" }).status;
  assert.equal(s.verdict, "invalid");
  assert.match(s.why, /VP_VERDICT/);
  assert.equal(s.commits.length, 1, "an invalid run still lands its ledger commit (the empty-commits bug)");
  assert.ok(gitShow(repo, ".build/vic-src/polish-ledger.json").length > 50, "invalid run's ledger committed");
  assert.equal(gitPorc(repo), "", "tree clean after the invalid-run commit");
  const repo2 = makeRepo();
  const s2 = vpRun(repo2, { mode: "edit+poison-then-pass" }).status;
  assert.equal(s2.verdict, "pass", "one retry rescues a poisoned first emission");
}
console.log("B6 invalid/retry: ok");

// B7 no key → clean skip; breaker guards the 24h spend; --force overrides
{
  const repo = makeRepo();
  const env = { MATILDA_API_KEY: "" };
  const r = spawnSync(process.execPath, [ORCH, "--repo", repo, "--skip-gate", "--no-push"], { encoding: "utf8", env: { ...process.env, PATH: bin + path.delimiter + process.env.PATH, ...env } });
  const last = r.stdout.trim().split("\n").pop();
  assert.deepEqual(JSON.parse(last.slice(15)), { ran: false, why: "no-key" });

  const repo2 = makeRepo();
  const seeded = blankLedger();
  seeded.sessions = Array.from({ length: 21 }, () => new Date().toISOString());
  mkdirSync(path.join(repo2, ".build/vic-src"), { recursive: true });
  writeFileSync(path.join(repo2, ".build/vic-src/polish-ledger.json"), JSON.stringify(seeded));
  const s = vpRun(repo2, { mode: "noedit+pass" }).status;
  assert.equal(s.ran, false); assert.equal(s.why, "breaker");
  const s2 = vpRun(repo2, { mode: "noedit+pass", extra: ["--force"] }).status;
  assert.equal(s2.ran, true, "--force lifts the breaker");
}
console.log("B7 key/breaker: ok");

console.log("test-vic-polish: all ok");
