#!/usr/bin/env node
/* refresh.mjs - the election model's daily run (.build/seat-model-refresh.sh drives it; the
   seat-model-refresh workflow starts that at the dispatch clock's slot and on its cron twin).

   Gate: the model re-runs only when something it reads has moved. The vote layer is rebuilt from
   the current polls into a temp file and compared with the committed one, provenance aside (its
   date stamp moves every day; its content moves only with the polls); every other input is
   compared by hash with the official nowcast's own provenance (calibration, flows, the engine).
   Nothing moved -> a no-op, so the clock's run and the cron twin can both fire every day.

   Something moved (or --force) -> data/seat-vote-layer.json, both official runs (nowcast, which
   also writes its line in data/seat-model-2028-history.jsonl, and the election-day forecast),
   the page's stores (.build/model/export.mjs), the page assembly (.build/model/assemble.mjs), then
   the guards below and the bundle test (the page must still reproduce the engine draw for draw).
   A guard that fails exits 1 before the wrapper commits anything.

   Last line: MODEL_STATUS {"changed":bool,...} - the wrapper reads it.
   Usage: node .build/model/refresh.mjs [--force] [--dry]   (--dry: report the gate, write nothing) */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const FORCE = process.argv.includes("--force"), DRY = process.argv.includes("--dry");
const VOTE = "data/seat-vote-layer.json", NOW = "data/seat-model-2028-nowcast.json", FC = "data/seat-model-2028-forecast.json";
const J = (f) => JSON.parse(readFileSync(f, "utf8"));
const sha16 = (f) => createHash("sha256").update(readFileSync(f)).digest("hex").slice(0, 16);
const status = (o) => { console.log("MODEL_STATUS " + JSON.stringify(o)); };
const run = (args, env = {}) => execFileSync(process.execPath, args, { env: { ...process.env, ...env }, encoding: "utf8", maxBuffer: 1 << 28, stdio: ["ignore", "pipe", "inherit"] });
const content = (v) => { const { _provenance, ...rest } = v; return JSON.stringify(rest); };

// ---- the gate --------------------------------------------------------------------------
const tmp = mkdtempSync(join(tmpdir(), "auspol-model-"));
const fresh = join(tmp, "vote.json");
try {
  run([".build/analysis/seat-model/vote-layer.mjs"], { AUSPOL_VOTE_OUT: fresh });
} catch (e) {
  rmSync(tmp, { recursive: true, force: true });
  console.error("vote layer failed");
  process.exit(1);
}
const voteMoved = content(J(fresh)) !== content(J(VOTE));
const prov = J(NOW)._provenance.inputs;
const inputsMoved = Object.entries(prov).filter(([f, h]) => f !== VOTE && sha16(f) !== h).map(([f]) => f);
const pollsTo = J(fresh).diagnostics.recentWindow.to;
if (!voteMoved && !inputsMoved.length && !FORCE) {
  rmSync(tmp, { recursive: true, force: true });
  status({ changed: false, pollsTo });
  process.exit(0);
}
if (DRY) {
  rmSync(tmp, { recursive: true, force: true });
  status({ changed: true, dry: true, pollsTo, voteMoved, inputsMoved, forced: FORCE });
  process.exit(0);
}

// ---- the runs --------------------------------------------------------------------------
copyFileSync(fresh, VOTE);
rmSync(tmp, { recursive: true, force: true });
for (const mode of ["nowcast", "forecast"]) process.stdout.write(run([".build/analysis/seat-model/swing-simulate.mjs"], { AUSPOL_SIM_MODE: mode }));
process.stdout.write(run([".build/model/export.mjs"]));
process.stdout.write(run([".build/model/assemble.mjs"]));

// ---- guards: a run that breaks these is not published ------------------------------------
const fail = (why) => { console.error(`guard: ${why}`); process.exit(1); };
for (const f of [NOW, FC]) {
  const r = J(f), e = r.national.expectedSeats, d = r.national.seatDistribution;
  const total = Object.values(e).reduce((a, b) => a + b, 0);
  if (Math.abs(total - 150) > 0.5) fail(`${f}: expected seats sum to ${total}, not 150`);
  // an average may sit outside its 90% range when the seats are rare events (others: 0.01 on a 0-0
  // range), so the check is only what must hold: a seat count, and an ordered range
  for (const [k, v] of Object.entries(e)) if (!(v >= 0 && v <= 150 && d[k].p05 <= d[k].p95 && d[k].p95 <= 150)) fail(`${f}: ${k} average ${v}, range ${d[k].p05}-${d[k].p95}`);
  if (r.seats.length !== 150) fail(`${f}: ${r.seats.length} seats`);
  if (!r.national.headline) fail(`${f}: no headline`);
  if (r.meta.nowcast && JSON.stringify(r.meta.nowcast) !== JSON.stringify(J(VOTE).national.nowcast)) fail(`${f}: ran on another vote than the vote layer's`);
}
process.stdout.write(run([".build/model/test-model-bundle.mjs"]));

const N = J(NOW);
status({ changed: true, pollsTo, voteMoved, inputsMoved, forced: FORCE, headline: N.national.headline, expectedSeats: N.national.expectedSeats, majority: N.national.majority });
