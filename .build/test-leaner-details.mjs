import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";

process.env.RB_LIB = "1";
const { parseUndecidedLeaner: parseRedBridgeLeaner } = await import("./extract-redbridge.mjs");

for (const [name, value] of [
  ["afr-redbridge-group-and-accent-research-november-2026-federal-poll", 6],
  ["afr,-redbridge-group-and-accent-research-july-2026-federal-poll", 7],
]) {
  const txt = readFileSync(path.join(".build/redbridge-src", `${name}.txt`), "utf8");
  assert.deepEqual(parseRedBridgeLeaner(txt), { value }, `${name}: exact leaner-excluded share`);
}
assert.ok(parseRedBridgeLeaner("the methodology text moved").error, "a lost RedBridge methodology anchor is guarded");

const scratch = mkdtempSync(path.join(tmpdir(), "newspoll-leaner-"));
const out = path.join(scratch, "polls.json");
const before = JSON.parse(readFileSync("data/polls.json", "utf8"));
const november = before.polls.find((p) => p.pollster === "Newspoll" && p.date === "2026-11-19");
delete november.sampleEff;
delete november.methodUrl;
november.undecidedLeaner = 7;
let missing = 0;
for (const p of before.polls) {
  if (p.pollster === "Newspoll" && p.sampleEff != null) { delete p.undecidedLeaner; missing++; }
}
writeFileSync(out, JSON.stringify(before, null, 2) + "\n");
assert.ok(missing >= 1, "the replay starts with already-eff-stamped Newspoll rows needing the new field");
const run = () => {
  const stdout = execFileSync(process.execPath, [".build/extract-sampleeff.mjs", "no-network-leg"], {
    encoding: "utf8", env: { ...process.env, SAMPLEEFF_OUT: out },
  });
  return JSON.parse(stdout.trim().split("\n").at(-1).replace(/^SAMPLEEFF_STATUS /, ""));
};

const first = run();
assert.ok(first.leaner >= 1, "cached Newspoll statements stamp their leaner-excluded share");
const stamped = JSON.parse(readFileSync(out, "utf8"));
assert.equal(stamped.polls.find((p) => p.pollster === "Newspoll" && p.date === "2026-11-19").undecidedLeaner, 6, "the first APC statement supersedes the release chart's figure");
const latest = stamped.polls.filter((p) => p.pollster === "Newspoll" && p.sampleEff != null).sort((a, b) => b.date.localeCompare(a.date))[0];
assert.equal(latest.date, "2026-10-29");
assert.equal(latest.undecidedLeaner, 5);
const beforeSecondRun = readFileSync(out, "utf8");
assert.equal(run().changed, false, "the second cached backfill is a no-op");
assert.equal(readFileSync(out, "utf8"), beforeSecondRun, "and leaves the data file byte-identical");

const conflict = JSON.parse(beforeSecondRun);
conflict.polls.find((p) => p.pollster === "Newspoll" && p.date === latest.date).undecidedLeaner++;
writeFileSync(out, JSON.stringify(conflict, null, 2) + "\n");
assert.throws(run, (e) => e.status === 2, "a mismatch on a statement-backed wave remains fatal");

console.log("PASS: RedBridge and Newspoll leaner exclusions parse, backfill and reconcile automatically");
