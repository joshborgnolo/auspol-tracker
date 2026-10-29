#!/usr/bin/env node
// Essential one-offs adjudication — Matilda answers which TOPIC a never-seen
// Essential question dataset belongs to (and what its manifest id should
// be), so a new wave files itself the same day instead of sitting in the
// fail-closed gate until a human session (2026-10-29, after the 27 Oct wave
// held a full day). Sibling of adjudicate.mjs (the wave-adjudication pass):
//
//   1. essential-oneoffs.mjs --cases <file>   → pending datasets, words only
//   2. THIS SCRIPT                            → Matilda routing verdict
//   3. essential-oneoffs.mjs --decisions <file>
//                                             → validates every stanza
//                                               itself and folds survivors
//                                               into the committed ledger —
//                                               the build's audit stays the
//                                               hard gate either way.
//
// TRUST MODEL mirrors the adjudicator's: the evidence bundle carries
// question WORDS (dataset id, question text, chart titles, wave dates —
// never a figure). The verdict routes only: {id, ds, theme, note}, or defer
// per case. Everything the builder cannot validate is dropped there; this
// script never writes the ledger or the store. The CLI posture matches
// adjudicate.mjs (no tool surface, print mode, one retry via matildaJson;
// no key/CLI → skipped, the wrapper's ci-alert lane covers it).
//
// Usage:
//   node .build/essential-oneoffs-adjudicate.mjs --cases <cases.json> --out <verdict.json>
// Exit is ALWAYS 0; the last stdout line is:
//   ESS1OFF_ADJ_STATUS {"ran":false,"why":"no-cases"|"no-cli"|"no-verdict"}
//   ESS1OFF_ADJ_STATUS {"ran":true,"applied":true,"decisions":n,"deferred":m}
//   ESS1OFF_ADJ_STATUS {"ran":true,"applied":false,"why":"<detail>"}

import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { matildaCli } from "./matilda-json.mjs";
import { THEMES } from "./newtracker/adhoc-themes.mjs";

const WALL = "4m";        // a verdict is one JSON object; anything longer is a hang
const TOOL_BUDGET = 12;   // the bundle is complete — at most a couple of local reads
const MAX_CASES = 24;     // one LLM call; a monthly wave asks ~8 at most
const PROMPT_PATH = ".build/essential-oneoffs-adjudicate-prompt.md";

const argv = process.argv.slice(2);
const argOf = (k) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : null);
const casesPath = argOf("--cases");
const outPath = argOf("--out");
const done = (s) => { console.log("ESS1OFF_ADJ_STATUS " + JSON.stringify(s)); process.exit(0); };

if (!casesPath || !existsSync(casesPath)) done({ ran: false, why: "no-cases" });
let bundle = null;
try { bundle = JSON.parse(readFileSync(casesPath, "utf8")); } catch { done({ ran: false, why: "cases unreadable" }); }
const cases = Array.isArray(bundle && bundle.cases) ? bundle.cases : [];
if (!cases.length) done({ ran: false, why: "no-cases" });
if (cases.length > MAX_CASES) done({ ran: false, why: `too many cases (${cases.length} > ${MAX_CASES})` });
const cli = matildaCli();
if (!cli) done({ ran: false, why: "no-cli" });

const themeLines = THEMES.map((t) => `  "${t.id}" — ${t.title}: ${t.dek}`).join("\n");
const prompt = readFileSync(PROMPT_PATH, "utf8")
  .replace("{{THEMES}}", themeLines)
  .replace("{{CASES}}", JSON.stringify({ house: "essential", cases }, null, 2));

const res = spawnSync(cli, [
  "-p", prompt,
  "--exclude-tools", "shell,write,edit",
  "--output-format", "text",
  "--max-wall-time", WALL,
  "--max-tool-calls", String(TOOL_BUDGET),
], { encoding: "utf8", timeout: 360_000, env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } });
if (res.error) done({ ran: true, applied: false, why: `cli spawn failed: ${res.error.message}` });
if (res.status !== 0) done({ ran: true, applied: false, why: `cli exit ${res.status}: ${(res.stderr || res.stdout || "").trim().slice(0, 300)}` });

let raw = (res.stdout || "").trim();
if (raw.startsWith("```")) raw = raw.replace(/^```(?:json)?\s*/, "").replace(/```\s*$/, "").trim();
const i0 = raw.indexOf("{"), i1 = raw.lastIndexOf("}");
if (i0 < 0 || i1 <= i0) done({ ran: true, applied: false, why: "verdict prose carried no JSON object" });
let verdict = null;
try { verdict = JSON.parse(raw.slice(i0, i1 + 1)); }
catch (e) { done({ ran: true, applied: false, why: `verdict JSON unreadable: ${e.message}` }); }
if (!verdict || !Array.isArray(verdict.decisions)) done({ ran: true, applied: false, why: "verdict carries no decisions array" });
/* the builder re-checks everything downstream; here we only drop what is
   structurally unusable (a stanza-shaped entry, or an explicit defer) */
const usable = verdict.decisions.filter((d) => d && typeof d === "object" && (d.defer === true || (typeof d.ds === "string" && typeof d.id === "string" && typeof d.theme === "string")));
if (!usable.length) done({ ran: true, applied: false, why: "no usable decisions in the verdict" });
const kept = { decisions: usable };
if (outPath) writeFileSync(outPath, JSON.stringify(kept, null, 2) + "\n");
const deferred = usable.filter((d) => d.defer === true).length;
done({ ran: true, applied: usable.length - deferred > 0, decisions: usable.length - deferred, deferred });
