/* ====================================================================
   NEXT EXPECTED POLLS – walk-forward backtest

   np-score.mjs grades the projection's LIVE bets, one per house per
   release, so its record grows by a handful a month – six resolved bets
   after its first three weeks, too few to tune anything against. This
   replays the record instead: for each house's recent releases it rebuilds
   the dataset as it stood the morning after the PREVIOUS release, runs the
   real gen-data.mjs and the shipped np-project.js on it, and scores the
   house's first projected slot against the release that actually followed.
   Same claim, same window, same hit rule as np-score (published inside
   [release - winHalf, release + winHalf]).

   As-of rules – what the replay may know on the morning after `prev`:
     - polls rows published on or before `prev` (fieldwork end standing in
       where a row records no publication date);
     - pollsterRules.skippedSlots dated on or before `prev`, and
       skippedMonths for months before `prev`'s month (both are confirmed
       the morning after the slot passes);
     - no provisional fallback rows.
   What it cannot rewind: the CODE and constants are today's, and the
   hand-declared pollsterRules (release, stopped) are today's. That is the
   point for tuning – it answers "how would the current rules have done" –
   but it flatters rules fitted to the same record, so read a change's
   DELTA, not its absolute rate.

   Isolation: gen-data reads GEN_DATA_POLLS and writes into GEN_DATA_OUT, a
   temp directory; the working tree's polls.json and assets are never
   touched, so this is safe beside running updaters.

   Usage:  node .build/newtracker/np-backtest.mjs [--n 14] [--house "Newspoll"] [--json]
   ~0.3s per replayed release. Informational: exits 0 unless it cannot run.
   ==================================================================== */

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const DAY = 86400000;
const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
const argv = process.argv.slice(2);
const argOf = (k) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : null);
const N = Number(argOf("--n") || 14);
const ONLY = argOf("--house");
const JSON_OUT = argv.includes("--json");

const SRC = readFileSync(path.join(ROOT, "data", "polls.json"), "utf8");
const PROJECT = readFileSync(path.join(HERE, "assets", "np-project.js"), "utf8");
const TMP = mkdtempSync(path.join(tmpdir(), "np-backtest-"));
const POLLS_TMP = path.join(TMP, "polls.json");

/* gen-data on a dataset, then the shipped projection on its output, in a
   fresh vm context each time so no replay leaks into the next */
function run(D, now) {
  writeFileSync(POLLS_TMP, JSON.stringify(D));
  execFileSync(process.execPath, [path.join(HERE, "gen-data.mjs")], {
    env: { ...process.env, GEN_DATA_POLLS: POLLS_TMP, GEN_DATA_OUT: TMP },
    stdio: "ignore",
  });
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(readFileSync(path.join(TMP, "9f09dca2-bd46-49a8-8ae1-51847608cf92.js"), "utf8"), ctx);
  ctx.window.AP = { D: ctx.window.AUSPOL };
  vm.runInContext(PROJECT, ctx);
  return { cad: ctx.window.AUSPOL.pollCadence || [], rows: now ? ctx.window.AP.nextPolls(now).rows : [] };
}

/* houses: every one the current record projects */
const houses = run(JSON.parse(SRC), null).cad.map((c) => c.pollster)
  .filter((h) => !ONLY || h === ONLY);

const results = [];
for (const house of houses) {
  const base = JSON.parse(SRC);
  // one release per publication date, as gen-data collapses them
  const pubs = [...new Set(base.polls.filter((p) => p.pollster === house && p.published)
    .map((p) => p.published.slice(0, 10)))].sort();
  for (let k = Math.max(1, pubs.length - N); k < pubs.length; k++) {
    const prev = pubs[k - 1], actual = pubs[k];
    const D = JSON.parse(SRC);
    D.polls = D.polls.filter((p) => ((p.published || "").slice(0, 10) || p.date) <= prev);
    D.fallbackPolls = [];
    D.fallbackApproval = [];
    for (const r of Object.values(D.pollsterRules || {})) {
      if (r.skippedSlots) r.skippedSlots = r.skippedSlots.filter((d) => d <= prev);
      if (r.skippedMonths) r.skippedMonths = r.skippedMonths.filter((m) => m < prev.slice(0, 7));
    }
    let out;
    try { out = run(D, { day: Date.parse(prev) + DAY, mins: 6 * 60 }); }
    catch (e) { results.push({ house, prev, actual, skip: "gen-data failed on the as-of data" }); continue; }
    const row = out.rows.find((r) => r.pollster === house && r.ahead === 0);
    if (!row) { results.push({ house, prev, actual, skip: "not on the projection yet" }); continue; }
    const win = row.winHalf || 0;
    const off = Math.round((Date.parse(actual) - row.release) / DAY);
    const c = out.cad.find((x) => x.pollster === house);
    results.push({
      house, prev, actual, predicted: iso(row.release), win, off, hit: Math.abs(off) <= win,
      kind: row.calMonth ? "calMonth" : row.loose ? "loose" : "dated", basis: c?.basis ?? null,
    });
  }
}
rmSync(TMP, { recursive: true, force: true });

if (JSON_OUT) { console.log(JSON.stringify(results, null, 1)); process.exit(0); }

const scored = results.filter((r) => !r.skip);
const rate = (rs) => `${rs.filter((r) => r.hit).length}/${rs.length}`;
const medAbs = (rs) => {
  const e = rs.map((r) => Math.abs(r.off)).sort((a, b) => a - b);
  if (!e.length) return "–";
  const m = e.length >> 1;
  return `${e.length % 2 ? e[m] : (e[m - 1] + e[m]) / 2}d`;
};
const meanWin = (rs) => (rs.length ? `±${(rs.reduce((a, r) => a + r.win, 0) / rs.length).toFixed(1)}d` : "–");

console.log(`next-polls backtest · last ${N} releases per house · today's rules replayed on as-of data\n`);
console.log("house              hit      med|err|  mean window");
for (const h of houses) {
  const rs = scored.filter((r) => r.house === h);
  const sk = results.filter((r) => r.house === h && r.skip).length;
  console.log(`${h.padEnd(18)} ${rate(rs).padEnd(8)} ${medAbs(rs).padEnd(9)} ${meanWin(rs)}${sk ? `   (${sk} not scorable)` : ""}`);
}
/* by claimed width: an exact-day claim that misses one time in three is a
   different failure from a ±1-week claim doing the same */
const bucket = (r) => (r.win === 0 ? "exact day" : r.win <= 7 ? "within a week" : "wider");
console.log("\nby claimed window:");
for (const b of ["exact day", "within a week", "wider"]) {
  const rs = scored.filter((r) => bucket(r) === b);
  if (rs.length) console.log(`  ${b.padEnd(14)} ${rate(rs)}`);
}
/* the summer break moves every house's schedule, and no rule models it */
const summer = (r) => /-(12|01)-/.test(r.actual) || /-(12|01)-/.test(r.predicted);
console.log(`\nslots touching Dec/Jan: ${rate(scored.filter(summer))} · the rest: ${rate(scored.filter((r) => !summer(r)))}`);
console.log(`\noverall: ${rate(scored)} · median |error| ${medAbs(scored)} · mean window ${meanWin(scored)}`);
const misses = scored.filter((r) => !r.hit);
if (misses.length) {
  console.log("\nmisses:");
  for (const r of misses)
    console.log(`  ${r.house.padEnd(18)} predicted ${r.predicted} ±${r.win}  published ${r.actual}  (${r.off > 0 ? "+" : ""}${r.off}d, ${r.kind}, ${r.basis})`);
}
