#!/usr/bin/env node
/* refresh.mjs - the election models' daily run (.build/seat-model-refresh.sh drives it; the
   seat-model-refresh workflow starts that at the dispatch clock's slot and on its cron twin).

   Two models, each with its own gate - it re-runs only when something it reads has moved:
     federal 2028: the vote layer is rebuilt from the current polls into a temp file and compared with
       the committed one, provenance aside (its date stamp moves every day; its content moves only with
       the polls); every other input is compared by hash with the official nowcast's own provenance.
       Moved -> data/seat-vote-layer.json, both official runs (nowcast + its history line, forecast),
       the page's stores (.build/model/export.mjs).
     Victoria, 28 November 2026: the /vic/ polling average (vic-inputs.mjs vicVote) against the run's
       own, and the run's other inputs by hash (data/vic-polls.json aside: the vote stands for it).
       Moved -> vic-simulate.mjs (+ its history line), export-vic.mjs. After election day the run is
       left as it stood: the page shows it as the model's last word before the election.
   Then, if either ran: the changing-hands reasons (reasons.mjs), the page assembly, the guards below and the bundle test (the page must still
   reproduce the engine draw for draw). A guard that fails exits 1 before the wrapper commits anything.
   Nothing moved -> a no-op, so the clock's run and the cron twin can both fire every day.

   Last line: MODEL_STATUS {"changed":bool,"fed":{...},"vic":{...}} - the wrapper reads it.
   Usage: node .build/model/refresh.mjs [--force] [--dry]   (--dry: report the gates, write nothing) */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { VIC, vicVote } from "../analysis/seat-model/vic-inputs.mjs";

const FORCE = process.argv.includes("--force"), DRY = process.argv.includes("--dry");
const VOTE = "data/seat-vote-layer.json", NOW = "data/seat-model-2028-nowcast.json", FC = "data/seat-model-2028-forecast.json", VRUN = "data/seat-model-vic-2026.json";
const J = (f) => JSON.parse(readFileSync(f, "utf8"));
const sha16 = (f) => createHash("sha256").update(readFileSync(f)).digest("hex").slice(0, 16);
const status = (o) => { console.log("MODEL_STATUS " + JSON.stringify(o)); };
const run = (args, env = {}) => execFileSync(process.execPath, args, { env: { ...process.env, ...env }, encoding: "utf8", maxBuffer: 1 << 28, stdio: ["ignore", "pipe", "inherit"] });
const content = (v) => { const { _provenance, ...rest } = v; return JSON.stringify(rest); };
const sydneyToday = new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Sydney" }).format(new Date());

// ---- the federal gate -------------------------------------------------------------------
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
const inputsMoved = Object.entries(J(NOW)._provenance.inputs).filter(([f, h]) => f !== VOTE && sha16(f) !== h).map(([f]) => f);
const fed = { changed: FORCE || voteMoved || inputsMoved.length > 0, pollsTo: J(fresh).diagnostics.recentWindow.to, voteMoved, inputsMoved };

// ---- the Victorian gate ------------------------------------------------------------------
const vicDone = sydneyToday > VIC.election;
let vic = { changed: false, frozen: vicDone };
if (!vicDone) {
  let vv;
  try { vv = await vicVote(); } catch (e) { rmSync(tmp, { recursive: true, force: true }); console.error(`Victorian vote failed: ${e.message}`); process.exit(1); }
  const R = J(VRUN);
  const vMoved = JSON.stringify(vv.nowcast) !== JSON.stringify(R.meta.nowcast) || vv.pollsTo !== R.meta.pollsTo;
  const vInputs = Object.entries(R._provenance.inputs).filter(([f, h]) => f !== "data/vic-polls.json" && sha16(f) !== h).map(([f]) => f);
  vic = { changed: FORCE || vMoved || vInputs.length > 0, pollsTo: vv.pollsTo, voteMoved: vMoved, inputsMoved: vInputs };
}

if (!fed.changed && !vic.changed) { rmSync(tmp, { recursive: true, force: true }); status({ changed: false, fed, vic }); process.exit(0); }
if (DRY) { rmSync(tmp, { recursive: true, force: true }); status({ changed: true, dry: true, fed, vic }); process.exit(0); }

// ---- the runs --------------------------------------------------------------------------
if (fed.changed) {
  copyFileSync(fresh, VOTE);
  for (const mode of ["nowcast", "forecast"]) process.stdout.write(run([".build/analysis/seat-model/swing-simulate.mjs"], { AUSPOL_SIM_MODE: mode }));
  process.stdout.write(run([".build/model/export.mjs"]));
}
rmSync(tmp, { recursive: true, force: true });
if (vic.changed) {
  process.stdout.write(run([".build/analysis/seat-model/vic-simulate.mjs"]));
  process.stdout.write(run([".build/model/export-vic.mjs"]));
}
process.stdout.write(run([".build/model/reasons.mjs"]));
process.stdout.write(run([".build/model/assemble.mjs"]));

// ---- guards: a run that breaks these is not published ------------------------------------
const fail = (why) => { console.error(`guard: ${why}`); process.exit(1); };
for (const f of [NOW, FC, VRUN]) {
  const r = J(f), e = r.national.expectedSeats, d = r.national.seatDistribution, T = r.meta.seatsTotal || 150;
  const total = Object.values(e).reduce((a, b) => a + b, 0);
  if (Math.abs(total - T) > 0.5) fail(`${f}: expected seats sum to ${total}, not ${T}`);
  // an average may sit outside its 90% range when the seats are rare events (others: 0.01 on a 0-0
  // range), so the check is only what must hold: a seat count, and an ordered range
  for (const [k, v] of Object.entries(e)) if (!(v >= 0 && v <= T && d[k].p05 <= d[k].p95 && d[k].p95 <= T)) fail(`${f}: ${k} average ${v}, range ${d[k].p05}-${d[k].p95}`);
  if (r.seats.length !== T) fail(`${f}: ${r.seats.length} seats`);
  if (!r.national.headline) fail(`${f}: no headline`);
  if (f !== VRUN && r.meta.nowcast && JSON.stringify(r.meta.nowcast) !== JSON.stringify(J(VOTE).national.nowcast)) fail(`${f}: ran on another vote than the vote layer's`);
}
process.stdout.write(run([".build/model/test-model-bundle.mjs"]));

const N = J(NOW), V = J(VRUN);
status({ changed: true, fed: { ...fed, headline: N.national.headline, expectedSeats: N.national.expectedSeats },
  vic: { ...vic, headline: V.national.headline, expectedSeats: V.national.expectedSeats }, pollsTo: fed.pollsTo, vicPollsTo: V.meta.pollsTo });
