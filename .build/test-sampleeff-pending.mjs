/* Unit test for sampleeff-pending.mjs — the gate for sampleeff-update.yml's
   hourly sweep. Fixtures are rolled per run (the window is relative to
   Date.now()), keeping 2-day margins off the 7-day edge so the Sydney
   +10/+11 wobble in the gate's clock can't flip an assertion.
   Run: node .build/test-sampleeff-pending.mjs */
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";

const GATE = path.join(import.meta.dirname, "sampleeff-pending.mjs");
const WATCH_HOURS = Number(readFileSync(GATE, "utf8").match(/const WATCH_HOURS = (\d+)/)[1]);
assert.equal(WATCH_HOURS % 24, 0, "watch window is a whole number of days");

const tmp = mkdtempSync(path.join(tmpdir(), "sampleeff-pending-"));
// Wall-clock stamps 2h inside Sydney's +11 so the gate's pinned +10 parse
// stays on the same side of every edge (margins below are >= 24h anyway).
const sydneyStamp = (hoursAgo) => {
  const t = new Date(Date.now() - hoursAgo * 3600e3 + 11 * 3600e3);
  return t.toISOString().slice(0, 16);
};
const INSIDE = sydneyStamp(48); // 2 days ago — pending age
const OUTSIDE = sydneyStamp(WATCH_HOURS + 48); // 2 days past the window

const gate = (polls, direction = []) => {
  const f = path.join(tmp, `fixture-${Math.random().toString(36).slice(2)}.json`);
  writeFileSync(f, JSON.stringify({ polls, direction }));
  const r = spawnSync(process.execPath, [GATE], { env: { ...process.env, POLLS_JSON: f }, encoding: "utf8" });
  if (r.error) throw r.error;
  assert.match(r.stdout, /^SAMPLEEFF_PENDING \{.*\}$/m, "status line printed");
  return r.status;
};

// fresh unstamped waves keep the hourly sweep lit
assert.equal(gate([{ pollster: "Newspoll", date: "2026-10-08", published: INSIDE }]), 0, "recent Newspoll unstamped");
assert.equal(gate([{ pollster: "YouGov", date: "2026-10-06", published: INSIDE }]), 0, "recent YouGov unstamped");
assert.equal(gate([{ pollster: "Newspoll", date: "2026-10-08", published: INSIDE, sampleEff: 1400 }]), 0, "eff without methodUrl still pending");
assert.equal(gate([{ pollster: "DemosAU", date: "2026-10-04", published: INSIDE, sampleEff: 1200 }]), 0, "DemosAU eff-stamped but methodUrl missing");
assert.equal(gate([{ pollster: "Essential", date: "2026-10-06", published: INSIDE }]), 0, "Essential wave not yet in the living statement");
assert.equal(gate([{ pollster: "DemosAU (MRP)", date: "2026-09-19", published: INSIDE, sampleEff: 9999 }]), 0, "MRP waiting on its methodUrl");
assert.equal(gate([{ pollster: "Newspoll (pooled)", date: "2026-10-08", published: INSIDE }]), 0, "pooled wave waiting on the offline sum");
assert.equal(
  gate([], [{ pollster: "SEC Newgate", date: "2026-10-10", published: INSIDE, methodUrl: "https://example/sec.pdf", sample: 1000 }]),
  0,
  "SEC direction row awaiting its eff read",
);

// nothing pending: the hourly run stays asleep
assert.equal(gate([]), 1, "no polls at all");
assert.equal(gate([{ pollster: "Newspoll", date: "2026-10-08", published: INSIDE, sampleEff: 1400, methodUrl: "https://x/y" }]), 1, "fully stamped wave");
assert.equal(gate([{ pollster: "Newspoll", date: "2026-09-01", published: OUTSIDE }]), 1, "stale unstamped wave rides the weekly sweep");
assert.equal(gate([{ pollster: "YouGov", date: "2026-09-21", published: OUTSIDE, sampleEff: 800 }]), 1, "old wave missing only methodUrl is accepted steady state");
assert.equal(gate([{ pollster: "DemosAU (MRP)", date: "2026-09-19", published: INSIDE, methodUrl: "https://x/y" }]), 1, "MRPs are never eff-stamped");
assert.equal(gate([{ pollster: "RedBridge/Accent", date: "2026-10-06", published: INSIDE }]), 1, "Accent self-serves from its own updater");
assert.equal(gate([{ pollster: "Essential", date: "2026-10-06", published: INSIDE, methodUrl: "https://x/y" }]), 1, "Essential linked row: the leg never revisits eff");
assert.equal(gate([], [{ pollster: "SEC Newgate", date: "2026-10-10", published: INSIDE, methodUrl: "https://x/sec.pdf", sampleEff: 660 }]), 1, "SEC stamped");

/* The gate's house list must stay a strict subset of NEED_HOUSES minus
   RedBridge/Accent (its offline leg): a new statement-leg house added to the
   extractor without a matching gate entry would never be swept hourly. */
const need = [...new Set(
  readFileSync(path.join(import.meta.dirname, "extract-sampleeff.mjs"), "utf8")
    .match(/const NEED_HOUSES = \[([^\]]+)\]/)[1]
    .match(/"[^"]+"/g)
    .map((s) => s.slice(1, -1).replace(/ \((MRP|pooled)\)$/, ""))
    .filter((h) => h !== "RedBridge/Accent"),
)];
const watch = readFileSync(GATE, "utf8").match(/const WATCH_BASES = \[([^\]]+)\]/)[1].match(/"[^"]+"/g).map((s) => s.slice(1, -1));
assert.deepEqual([...need].sort(), [...watch].sort(), "gate houses mirror NEED_HOUSES bases (− RedBridge/Accent)");

console.log("test-sampleeff-pending: ok");
