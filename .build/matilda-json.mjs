// One Matilda call that must answer with a single JSON object — shared by the
// readers that let Matilda say WHERE a figure is (extract-redbridge-afr.mjs:
// which OCR line; newspoll-read.mjs: which sentence) while the caller checks
// every figure itself. Matilda never supplies a number the caller keeps
// without re-reading it from the cited evidence.
//
// Availability: the CLI on PATH (the laptop authenticates through
// ~/.matilda), else — only where MATILDA_API_KEY is set, i.e. CI — the
// pinned package is installed on demand, the same pin adjudicate.mjs uses.
// No CLI and no key: matildaCli() returns null and callers keep their
// deterministic path.
import { spawnSync, execSync } from "node:child_process";

const CLI_PKG = "@maincode-ai/matilda-code@0.21.4"; // the pin agent-repair.yml runs

let cached;
export function matildaCli() {
  if (cached !== undefined) return cached;
  if (process.env.MATILDA_DISABLE === "1") return (cached = null);
  const which = spawnSync("which", ["matilda"], { encoding: "utf8" });
  if (which.status === 0 && which.stdout.trim()) return (cached = which.stdout.trim());
  if (!process.env.MATILDA_API_KEY) return (cached = null);
  try { execSync(`npm i -g ${CLI_PKG}`, { stdio: "ignore", timeout: 240_000 }); return (cached = "matilda"); }
  catch { return (cached = null); }
}

function askOnce(cli, prompt, wall, tools) {
  // tools are never needed (the bundle is complete) but a stray read must
  // not abort the run: RedBridge's Dec 2025 chart died on a 0 budget
  const res = spawnSync(cli, ["-p", prompt, "--output-format", "text", "--max-wall-time", wall, "--max-tool-calls", String(tools)],
    { encoding: "utf8", timeout: 300_000, maxBuffer: 16 << 20, env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } });
  if (res.error) throw new Error(`matilda spawn failed: ${res.error.message}`);
  if (res.status !== 0) throw new Error(`matilda exit ${res.status}: ${(res.stderr || res.stdout || "").trim().slice(0, 300)}`);
  const raw = res.stdout.trim().replace(/^```(?:json)?\s*/, "").replace(/```\s*$/, "");
  const i0 = raw.indexOf("{"), i1 = raw.lastIndexOf("}");
  if (i0 < 0 || i1 <= i0) throw new Error("matilda answered with no JSON object");
  return JSON.parse(raw.slice(i0, i1 + 1));
}

// One retry: RedBridge's Nov and Dec 2025 charts each once ended the model's
// turn on hidden reasoning with no answer (MAX_TOKENS).
export function askMatildaJson(prompt, { wall = "3m", tools = 3, onRetry = () => {} } = {}) {
  const cli = matildaCli();
  if (!cli) throw new Error("matilda unavailable (no CLI, no MATILDA_API_KEY)");
  try { return askOnce(cli, prompt, wall, tools); }
  catch (e) { onRetry(e); return askOnce(cli, prompt, wall, tools); }
}
