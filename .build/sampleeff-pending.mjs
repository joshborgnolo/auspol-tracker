#!/usr/bin/env node
// Gate for the sampleeff hourly sweep in sampleeff-update.yml: exit 0 while
// a recently filed wave is still awaiting its APC statement — sampleEff
// and/or methodUrl unstamped — so the workflow sweeps hourly until
// extract-sampleeff.mjs picks the statement up. The signals map the
// extractor's own reach (NEED_HOUSES in extract-sampleeff.mjs;
// test-sampleeff-pending.mjs pins the two lists to the same houses):
//
//   YouGov / Newspoll / DemosAU – the statement pass fills eff + methodUrl
//   Essential                   – its leg only fills rows with no methodUrl
//   (MRP) rows                  – never eff-stamped; methodUrl is all they gain
//   (pooled) rows               – the offline sum of the house's own waves
//   SEC Newgate                 – direction[] rows, eff read off the row's
//                                 own methodUrl
//   RedBridge/Accent            – offline leg off the committed redbridge-src
//                                 caches, and redbridge-updater runs it
//                                 in-commit the moment a cache moves; an
//                                 unstamped recent Accent wave is never
//                                 gate-worthy
//
// The age window is a safety cap: statements post with their releases, so a
// wave older than WATCH_HOURS either is never getting a statement (the
// accepted YouGov holes — waves that aged out of the rolling APC listing
// unstamped) or is the weekly sweep's job; the hourly sweep retires
// regardless. Reads committed data only, no fetch.
// Exit 0 pending, exit 1 nothing pending. POLLS_JSON overrides the data
// path (tests).
import { readFileSync } from "node:fs";

const WATCH_HOURS = 168; // 7 days
const POLLS = process.env.POLLS_JSON || "data/polls.json";
const WATCH_BASES = ["YouGov", "Newspoll", "DemosAU", "Essential"];

/* Row stamps are Australia/Sydney wall clock ("YYYY-MM-DDTHH:MM" or a bare
   date). AEST/AEDT only ever sit at +10/+11; pinning +10 wobbles the window
   edge by an hour at most — harmless for a watch gate. */
function toMillis(stamp) {
  const m = String(stamp || "").match(/^(\d{4})-(\d{2})-(\d{2})(?:T?\s?(\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return null;
  const [, y, mo, d, h = "23", mi = "59", s = "59"] = m; // date-only → end of day
  return Date.UTC(+y, +mo - 1, +d, +h, +mi, +s) - 10 * 3600e3;
}

const D = JSON.parse(readFileSync(POLLS, "utf8"));
const cutoff = Date.now() - WATCH_HOURS * 3600e3;
const fresh = (r) => (toMillis(r.published || r.date) ?? 0) > cutoff;

const pending = [];
for (const p of D.polls || []) {
  if (!fresh(p)) continue;
  const m = / \((MRP|pooled)\)$/.exec(p.pollster || "");
  const base = m ? p.pollster.slice(0, m.index) : p.pollster;
  if (!WATCH_BASES.includes(base)) continue;
  const need =
    m?.[1] === "MRP" ? p.methodUrl == null :
    m?.[1] === "pooled" ? p.sampleEff == null :
    base === "Essential" ? p.methodUrl == null :
    p.sampleEff == null || p.methodUrl == null;
  if (need) pending.push(p);
}
for (const d of D.direction || []) {
  if (d.pollster === "SEC Newgate" && d.methodUrl && d.sampleEff == null && fresh(d)) pending.push(d);
}

console.log(
  `SAMPLEEFF_PENDING ${JSON.stringify({
    pending: pending.length,
    rows: pending.map((r) => `${r.pollster} ${r.date}`),
    watchHours: WATCH_HOURS,
  })}`,
);
process.exit(pending.length ? 0 : 1);
