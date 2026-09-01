// Fixture test for np-score.mjs — the calibration logger's verdict logic,
// exercised end to end without waiting weeks for real resolutions.
//
// The scorer derives every verdict from the log CROSSED WITH polls.json at
// report time, so a fully synthetic pair of fixtures (an np-calibration.jsonl
// of hand-written tuples + a polls.json with just the waves they resolve
// against) drives it through every verdict class via the script's own env
// seams (NP_SCORE_JSONL / NP_SCORE_REPORT / NP_SCORE_POLLS). The assertions
// cover the four verdicts + pending, the primary/rolled buckets, the
// skip-and-void exclusions, the midpoint-error medians, and the logger's
// append-only-on-identity-change rule against the LIVE built asset.
//
// House names must be REAL ones present in the built asset's cadence table
// (the pending verdict requires the house to still be on the projection).
//
// Run after a rebuild, like the sim:
//   node .build/newtracker/build.mjs
//   node .build/newtracker/test-np-score.mjs
// Exits non-zero if any expectation fails.

import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCORE = fileURLToPath(new URL("./np-score.mjs", import.meta.url));
const dir = mkdtempSync(join(tmpdir(), "np-score-test-"));
const JSONL = join(dir, "cal.jsonl");
const REPORT = join(dir, "report.md");
const POLLS = join(dir, "polls.json");

let fails = 0;
const ok = (name, cond, extra = "") => {
  if (!cond) fails++;
  console.log(`  ${cond ? "ok  " : "FAIL"} ${name}${cond ? "" : (extra ? `\n      ${extra}` : "")}`);
};

/* --- the synthetic record. Essential chain:
     E1 hit (the 29 Jul wave lands on the window's centre) →
     E2 skip (the real 26 Aug slot shape, confirmed absent in the fixture's
       own rules) →
     E3 void (its successor's anchor matches no wave — a supersede with no
       publisher evidence) →
     E4 pending (latest).
   DemosAU chain:
     D1 rolled hit → D2 miss (published 14d after the window's centre, well
       outside it) → D3 month skip (2026-09 in the fixture's skippedMonths)
       → D4 pending. */
const rec = (o) => JSON.stringify({
  ts: "2026-07-02T00:00:00.000Z", syd: "2026-07-02 10:00", pollster: "Essential",
  kind: "dated", anchor: "", release: "", open: "", close: "", winHalf: 0, rolled: false, ahead: 0, ...o,
});
writeFileSync(JSONL, [
  rec({ anchor: "2026-07-01", release: "2026-07-29", open: "2026-07-22", close: "2026-08-05", winHalf: 7 }),
  rec({ ts: "2026-07-30T00:00:00.000Z", anchor: "2026-07-29", release: "2026-08-26", open: "2026-08-19", close: "2026-09-02", winHalf: 7 }),
  rec({ ts: "2026-08-27T00:00:00.000Z", anchor: "2026-07-29", release: "2026-09-02", open: "2026-08-26", close: "2026-09-09", winHalf: 7, rolled: true }),
  rec({ ts: "2026-08-28T00:00:00.000Z", anchor: "2026-08-20", release: "2026-09-02", open: "2026-08-26", close: "2026-09-09", winHalf: 7, rolled: true }),
  rec({ ts: "2026-06-23T00:00:00.000Z", pollster: "DemosAU", kind: "calMonth", anchor: "2026-06-22", release: "2026-07-18", open: "2026-07-09", close: "2026-07-27", winHalf: 9, rolled: true }),
  rec({ ts: "2026-07-14T00:00:00.000Z", pollster: "DemosAU", kind: "calMonth", anchor: "2026-07-13", release: "2026-08-10", open: "2026-08-08", close: "2026-08-12", winHalf: 2 }),
  rec({ ts: "2026-08-25T00:00:00.000Z", pollster: "DemosAU", kind: "calMonth", anchor: "2026-08-24", release: "2026-09-18", open: "2026-09-09", close: "2026-09-27", winHalf: 9 }),
  rec({ ts: "2026-08-26T00:00:00.000Z", pollster: "DemosAU", kind: "calMonth", anchor: "2026-08-24", release: "2026-10-18", open: "2026-10-09", close: "2026-10-27", winHalf: 9 }),
].join("\n") + "\n");

/* the matching polls.json: each wave keys by recorded published date, exactly
   the shape the scorer reads (and nothing else - no schema extras needed) */
writeFileSync(POLLS, JSON.stringify({
  pollsterRules: {
    Essential: { skippedSlots: ["2026-08-26"] },
    DemosAU: { skippedMonths: ["2026-09"] },
  },
  polls: [
    { pollster: "Essential", date: "2026-06-29", published: "2026-07-01T04:36" },
    { pollster: "Essential", date: "2026-07-27", published: "2026-07-29T01:00" },
    { pollster: "DemosAU", date: "2026-06-18", published: "2026-06-22T08:50" },
    { pollster: "DemosAU", date: "2026-07-08", published: "2026-07-13T08:44" },
    { pollster: "DemosAU", date: "2026-08-20", published: "2026-08-24T08:51" },
  ],
}));

const run = spawnSync(process.execPath, [SCORE, "--report"], {
  env: { ...process.env, NP_SCORE_JSONL: JSONL, NP_SCORE_REPORT: REPORT, NP_SCORE_POLLS: POLLS },
  encoding: "utf8",
});
ok("report run exits 0", run.status === 0, run.stderr || run.stdout);
const md = readFileSync(REPORT, "utf8");
const has = (s) => md.includes(s);

// every verdict class, with its note
ok("hit, on the centre", has("hit - published Wed 29 Jul 26"));
ok("rolled hit is its own line", has("| yes | hit - published Mon 13 Jul 26"));
ok("miss names the lateness", has("miss - published Mon 24 Aug 26 (14d late)"));
ok("dated slot skip", has("| Wed 26 Aug 26 | Wed 19 Aug 26 - Wed 2 Sep 26 |  | skip - confirmed absent at the publisher |"));
ok("month skip names the month", has("| 2026-09 (month) | Wed 9 Sep 26 - Sun 27 Sep 26 |  | skip - confirmed absent at the publisher (2026-09) |"));
ok("void for a supersede without evidence", has("void - superseded with no wave and no skip"));
ok("the two latest tuples stay pending", (md.match(/pending - open; window closes/g) || []).length === 2);

// the summary table: per-house rows, and exclusions kept out of the rates
ok("Essential: 1/1 primary, 0d error, 1 skip, 1 void", has("| Essential | 1/1 (100%) | 0d | – | 1 | 1 |"));
ok("DemosAU: 0/1 primary (14d err), 1/1 rolled, 1 skip", has("| DemosAU | 0/1 (0%) | 14d | 1/1 (100%) | 1 | – |"));
ok("overall rate and buckets", has("**Overall: 1/2 (50%) primary · median midpoint error 7d · 1/1 rolled · 2 skip · 1 void · 2 pending**"));

// midpoint error is the cross-house metric: med(|0|) = 0, med(|14|) = 14,
// med(|0,14|) = 7 - asserted exactly above, so a hit-rate-only report or an
// error computed from the window EDGE instead of the centre would fail here

/* --- the logger against the live built asset: first run logs every house,
   second run appends NOTHING — the daily tick (inDays/overdue/missed) must
   not trip the identity-tuple rule. */
const LIVE = join(dir, "live.jsonl");
const first = spawnSync(process.execPath, [SCORE], { env: { ...process.env, NP_SCORE_JSONL: LIVE }, encoding: "utf8" });
const second = spawnSync(process.execPath, [SCORE], { env: { ...process.env, NP_SCORE_JSONL: LIVE }, encoding: "utf8" });
ok("logger: first run appends the live tuples", /appended [1-9]\d* tuple/.test(first.stdout), first.stdout + first.stderr);
ok("logger: second run appends nothing (no tick-driven lines)", /no tuple changes/.test(second.stdout), second.stdout + second.stderr);

rmSync(dir, { recursive: true, force: true });
console.log(fails ? `\n${fails} FAILED` : "\nnp-score test: all expectations held");
process.exit(fails ? 1 : 0);
