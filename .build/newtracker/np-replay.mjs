/* ====================================================================
   NEXT EXPECTED POLLS – as-of replay

   Rebuilds the dataset as it stood the morning after a given release and
   runs the real gen-data.mjs and the shipped np-project.js on it, so a
   projection that was never observed live can be reconstructed exactly as
   the page would have shown it. Two consumers:

     np-backtest.mjs - scores the projection over each house's record
     np-score.mjs    - reconstructs a bet the daily scorer missed (a run
                       that never happened while that slot was open)

   As-of rules – what a replay may know on the morning after `prev`:
     - polls rows published on or before `prev` (fieldwork end standing in
       where a row records no publication date);
     - pollsterRules.skippedSlots dated on or before `prev`, and
       skippedMonths for months before `prev`'s month (both are confirmed
       the morning after the slot passes);
     - no provisional fallback rows.
   What it cannot rewind: the code and constants are today's, and so are
   the hand-declared pollsterRules (release, stopped).

   Isolation: gen-data reads GEN_DATA_POLLS and writes into GEN_DATA_OUT, a
   temp directory; the working tree's polls.json and assets are never
   touched, so replays are safe beside running updaters. ~0.3s each.
   ==================================================================== */

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DAY = 86400000;
let TMP = null;

/* gen-data on a dataset, then the shipped projection on its output, in a
   fresh vm context each time so no replay leaks into the next. `now` is
   {day, mins} as npProject takes it; null skips the projection. */
export function runProjection(D, now) {
  TMP ||= mkdtempSync(path.join(tmpdir(), "np-replay-"));
  const pollsTmp = path.join(TMP, "polls.json");
  writeFileSync(pollsTmp, JSON.stringify(D));
  execFileSync(process.execPath, [path.join(HERE, "gen-data.mjs")], {
    env: { ...process.env, GEN_DATA_POLLS: pollsTmp, GEN_DATA_OUT: TMP },
    stdio: "ignore",
  });
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(readFileSync(path.join(TMP, "9f09dca2-bd46-49a8-8ae1-51847608cf92.js"), "utf8"), ctx);
  ctx.window.AP = { D: ctx.window.AUSPOL };
  vm.runInContext(readFileSync(path.join(HERE, "assets", "np-project.js"), "utf8"), ctx);
  return { cad: ctx.window.AUSPOL.pollCadence || [], rows: now ? ctx.window.AP.nextPolls(now).rows : [] };
}

/* the dataset `srcText` (polls.json's text) cut back to the morning after
   `prev` (YYYY-MM-DD), projected at 06:00 Sydney that morning */
export function replayAsOf(srcText, prev) {
  const D = JSON.parse(srcText);
  D.polls = D.polls.filter((p) => ((p.published || "").slice(0, 10) || p.date) <= prev);
  D.fallbackPolls = [];
  D.fallbackApproval = [];
  for (const r of Object.values(D.pollsterRules || {})) {
    if (r.skippedSlots) r.skippedSlots = r.skippedSlots.filter((d) => d <= prev);
    if (r.skippedMonths) r.skippedMonths = r.skippedMonths.filter((m) => m < prev.slice(0, 7));
  }
  return runProjection(D, { day: Date.parse(prev) + DAY, mins: 6 * 60 });
}

export function cleanup() {
  if (TMP) rmSync(TMP, { recursive: true, force: true });
  TMP = null;
}
