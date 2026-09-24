/* Invariants across .github/workflows/ that have each broken something
   before, checked from the files themselves (no YAML library: the shapes
   checked are simple, and a parse that stops matching fails loudly).

   1. runs-on is pinned (ubuntu-24.04), never a moving label — ubuntu-latest
      moves to Ubuntu 26 from 2026-10-19.
   2. every third-party action is pinned to a full commit SHA.
   3. the reusable-workflow permissions CEILING: every caller of
      poll-agent.yml grants at least what poll-agent's job asks for. A
      one-sided widening makes every caller an invalid workflow at its next
      trigger (0c3a2ba, 2026-09-06: all eight pipelines, "Startup failure").
   4. agent-repair's watch list and schedule-tune's trigger list name real
      workflows, and every updater with a tuned cron block retriggers the
      tuner when it lands a wave (news24-update was missing until
      2026-09-25, so its block only moved weekly).
   Run: node .build/test-workflows.mjs */
import { readFileSync, readdirSync } from "node:fs";
import assert from "node:assert/strict";

const DIR = ".github/workflows";
const files = readdirSync(DIR).filter((f) => f.endsWith(".yml")).sort();
const text = Object.fromEntries(files.map((f) => [f, readFileSync(`${DIR}/${f}`, "utf8")]));
const nameOf = (t) => /^name:\s*(.+?)\s*$/m.exec(t)?.[1];

// ---- 1 + 2 -----------------------------------------------------------------------
for (const f of files) {
  for (const m of text[f].matchAll(/^\s*runs-on:\s*(.+?)\s*$/gm))
    assert.equal(m[1], "ubuntu-24.04", `${f}: runs-on ${m[1]} — pin the image`);
  for (const m of text[f].matchAll(/^\s*(?:-\s*)?uses:\s*([^\s#]+)/gm)) {
    const ref = m[1];
    if (ref.startsWith("./")) continue; // a reusable workflow in this repo
    assert.match(ref, /^[\w.-]+\/[\w.-]+(?:\/[\w./-]+)?@[0-9a-f]{40}$/, `${f}: ${ref} is not pinned to a commit SHA`);
  }
}

// ---- 3: the permissions ceiling ----------------------------------------------------
const LEVEL = { none: 0, read: 1, write: 2 };
// a `permissions:` mapping whose key line sits at `indent` spaces
function permsAt(t, indent) {
  const pad = " ".repeat(indent);
  const m = new RegExp(`^${pad}permissions:[ \\t]*(\\{\\})?[ \\t]*(?:#.*)?\\n((?:${pad}  [a-z-]+:.*\\n)*)`, "m").exec(t);
  if (!m) return null;
  if (m[1]) return {};
  return Object.fromEntries([...m[2].matchAll(/^\s+([a-z-]+):\s*([a-z]+)/gm)].map((x) => [x[1], x[2]]));
}
const agent = text["poll-agent.yml"];
const asked = permsAt(agent, 4); // jobs.update.permissions
assert.ok(asked && Object.keys(asked).length, "poll-agent.yml's update job declares its permissions");
const callers = files.filter((f) => /^\s+uses: \.\/\.github\/workflows\/poll-agent\.yml/m.test(text[f]));
assert.ok(callers.length >= 12, `every house calls poll-agent.yml (found ${callers.length})`);
for (const f of callers) {
  const granted = permsAt(text[f], 0);
  assert.ok(granted, `${f}: no top-level permissions block`);
  for (const [scope, level] of Object.entries(asked))
    assert.ok((LEVEL[granted[scope]] ?? 0) >= LEVEL[level],
      `${f} grants ${scope}: ${granted[scope] ?? "none"}, but poll-agent.yml's job asks for ${level} — every caller would fail to start`);
}

// ---- 4: the trigger lists ------------------------------------------------------------
const names = new Set(files.map((f) => nameOf(text[f])));
const listUnder = (t, key) => {
  const m = new RegExp(`^\\s+${key}:[^\\n]*\\n((?:\\s+- [^\\n]+\\n)+)`, "m").exec(t);
  return m ? [...m[1].matchAll(/-\s+([\w-]+)/g)].map((x) => x[1]) : [];
};
const repairList = listUnder(text["agent-repair.yml"], "workflows");
assert.ok(repairList.length > 5, "agent-repair.yml's watch list parsed");
for (const w of repairList) assert.ok(names.has(w), `agent-repair watches '${w}', which is no workflow's name`);
assert.ok(!repairList.includes("agent-repair"), "agent-repair must not watch itself");

const tuneList = listUnder(text["schedule-tune.yml"], "workflows");
for (const w of tuneList) assert.ok(names.has(w), `schedule-tune listens for '${w}', which is no workflow's name`);
for (const f of callers)
  if (text[f].includes("# tune-schedules:begin"))
    assert.ok(tuneList.includes(nameOf(text[f])), `${f} has a tuned block but schedule-tune.yml doesn't run when it lands a wave`);

console.log(`test-workflows: ok (${files.length} workflows, ${callers.length} poll-agent callers)`);
