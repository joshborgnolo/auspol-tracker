#!/usr/bin/env node
// Wave adjudication — the LLM pass that resolves the judgement calls the
// deterministic extractors deliberately pause on (see MATILDA.md). Runs ONLY
// from the house wrapper, between `extract` and `validate`, and only when the
// extractor's status JSON carries a non-empty `ambiguous` array:
//
//   1. extractor --adjudicate        → emits cases + holds the ambiguous waves
//   2. THIS SCRIPT                   → LLM verdict (routing only, never data)
//   3. extractor --decisions <verdict-file>
//                                    → applies the verdicts; its own guard
//                                      suite re-verifies every row produced.
//                                      The pollbludger extractor still needs
//                                      --apply here — ledger persistence
//                                      lives inside APPLY.
//
// TRUST MODEL. The LLM gets an evidence bundle (the cases plus the nearby
// rows the extractor assembled) and answers with JSON: one routing decision
// per case from a FIXED action enum. It cannot propose figures — anything
// carrying data fields is a corrupted verdict and the whole run falls back
// to deterministic behaviour, STAYING GREEN (fall back, stay green; the pb
// grace clock and RM's file/skip rules are unchanged today). An invalid
// verdict is a no-op, not an incident. Verdicts that must outlive the run
// (never_file, dup_of) are written to a per-house ledger by the EXTRACTOR
// (not here); the ledger is committed by the wrapper, so each ambiguity is
// resolved once, not re-litigated on every slot.
//
// Invocation honours the repo's agent conventions: the pinned CLI, print
// mode, a hard wall-clock, and MATILDA_API_KEY already known to CI. No key
// (a fork, a PR run, the laptop launchd copy) → skipped, deterministic path.
//
// Usage:
//   node .build/adjudicate.mjs --house <roymorgan|pollbludger> \
//        --status-file <status.json> --out <verdict-file>
// Exit is ALWAYS 0; the last stdout line is `ADJ_STATUS {json}`:
//   {ran:false, why:"no-cases"|"no-key"|"no-cli"}   nothing to do / cannot
//   {ran:true, applied:true, cases, decisions}       verdict file written
//   {ran:true, applied:false, why:<detail>}          LLM failed or its
//                                                    verdict was rejected —
//                                                    wrapper must re-run the
//                                                    extractor WITHOUT
//                                                    --adjudicate (today's
//                                                    deterministic rules)
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { spawnSync, execSync } from "node:child_process";
import path from "node:path";

const CLI_PKG = "@maincode-ai/matilda-code@0.21.4"; // the pin agent-repair.yml runs
const WALL = "4m";      // a verdict is one JSON object; anything longer is a hang
const TOOL_BUDGET = 12; // the bundle is complete — at most a couple of local reads
const MAX_CASES = 5;    // one LLM call per wrapper run, at most this many cases
const PROMPT = {
  roymorgan: ".build/roymorgan-adjudicate-prompt.md",
  pollbludger: ".build/pollbludger-adjudicate-prompt.md",
};

// data-carrying fields a verdict must never grow: routing only. Anything in
// this list on a decision object poisons the whole verdict.
const POISON_KEYS = new Set([
  "alp", "lnp", "grn", "onp", "ind", "oth", "und", "undecided", "sample",
  "tpp_alp", "tpp_lnp", "tpp_flows", "tpp_onp", "lib", "nat", "right",
  "wrong", "unsure", "date", "dateStart", "published",
]);

const { validateCases } = await import("./adjudicate-cases.mjs");

const argv = process.argv.slice(2);
const argOf = (k) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : null);
const house = argOf("--house");
const statusFile = argOf("--status-file");
const out = argOf("--out");
const done = (s) => { console.log("ADJ_STATUS " + JSON.stringify(s)); process.exit(0); };

if (!PROMPT[house]) done({ ran: false, why: `unknown house ${house}` });
if (!statusFile || !existsSync(statusFile)) done({ ran: false, why: `status file ${statusFile} not found` });
if (!out) done({ ran: false, why: "--out is required" });

let status;
try { status = JSON.parse(readFileSync(statusFile, "utf8")); }
catch (e) { done({ ran: false, why: `status file unreadable: ${e.message}` }); }

const cases = Array.isArray(status.ambiguous) ? status.ambiguous : [];
if (!cases.length) done({ ran: false, why: "no-cases" });
if (cases.length > MAX_CASES) done({ ran: false, why: `too many cases (${cases.length} > ${MAX_CASES}); extractor will defer them` });

const rule = validateCases(house, cases);
if (!rule.ok) done({ ran: false, why: `case emission invalid: ${rule.why}` });

if (!process.env.MATILDA_API_KEY) done({ ran: false, why: "no-key" });
const which = spawnSync("which", ["matilda"], { encoding: "utf8" });
let cli = which.status === 0 && which.stdout.trim() ? which.stdout.trim() : null;
if (!cli) {
  try { execSync(`npm i -g ${CLI_PKG}`, { stdio: "ignore", timeout: 240_000 }); cli = "matilda"; }
  catch (e) { done({ ran: false, why: `cli install failed: ${e.message}` }); }
}

const prompt = readFileSync(PROMPT[house], "utf8") +
  "\n\n## Evidence bundle (JSON)\n\n```json\n" +
  JSON.stringify({ house, generated: new Date().toISOString(), cases }, null, 2) +
  "\n```\n";

const res = spawnSync(cli, [
  "-p", prompt,
  "--yolo",
  "--output-format", "text",
  "--max-wall-time", WALL,
  "--max-tool-calls", String(TOOL_BUDGET),
], { encoding: "utf8", timeout: 360_000, env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } });
if (res.error) done({ ran: true, applied: false, why: `cli spawn failed: ${res.error.message}` });
if (res.status !== 0) done({ ran: true, applied: false, why: `cli exit ${res.status}: ${(res.stderr || res.stdout || "").trim().slice(0, 300)}` });

const text = (res.stdout || "").trim();
let raw = text;
if (raw.startsWith("```")) raw = raw.replace(/^```(?:json)?\s*/, "").replace(/```\s*$/, "").trim();
const i0 = raw.indexOf("{"), i1 = raw.lastIndexOf("}");
if (i0 < 0 || i1 <= i0) done({ ran: true, applied: false, why: "verdict prose carried no JSON object" });
let verdict;
try { verdict = JSON.parse(raw.slice(i0, i1 + 1)); }
catch (e) { done({ ran: true, applied: false, why: `verdict is not JSON: ${e.message}` }); }

const decisions = verdict && Array.isArray(verdict.decisions) ? verdict.decisions : null;
if (!decisions || !decisions.length) done({ ran: true, applied: false, why: "verdict carried no decisions" });
if (decisions.length > cases.length) done({ ran: true, applied: false, why: `more decisions (${decisions.length}) than cases (${cases.length})` });

const check = validateCases(house, cases, decisions);
if (!check.ok) done({ ran: true, applied: false, why: `verdict rejected: ${check.why}` });
for (const d of decisions) {
  for (const k of Object.keys(d)) {
    if (POISON_KEYS.has(k)) done({ ran: true, applied: false, why: `verdict decision ${d.case} carries data field "${k}" — routing only` });
  }
}

mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify({
  house,
  generated: new Date().toISOString(),
  cases: cases.map((c) => c.case),
  decisions: decisions.map((d) => ({ ...d, reason: String(d.reason || "").slice(0, 240) })),
}, null, 2) + "\n");
done({ ran: true, applied: true, cases: cases.length, decisions: decisions.length });
