#!/usr/bin/env node
// Gate for the DemosAU hourly sweep in demosau-update.yml: exit 0 while a
// Capital Brief hand-entered wave is still awaiting its methodology PDF.
// The exit-3 repair path adds the polls row WITHOUT methodUrl; the row only
// gains one when a human reconciles it against the landed PDF, so "recent
// DemosAU row with no methodUrl" IS the pending signal — it clears itself at
// reconciliation, no marker file to go stale. The age window is a safety cap
// in case reconciliation never happens. Reads committed data only, no fetch.
// Exit 0 pending, exit 1 nothing pending. POLLS_JSON overrides the data path
// (tests).
import { readFileSync } from "node:fs";

const WATCH_HOURS = 36;
const POLLS = process.env.POLLS_JSON || "data/polls.json";

// Row stamps are Australia/Sydney wall clock ("YYYY-MM-DDTHH:MM" or a bare
// date). AEST/AEDT only ever sit at +10/+11; pinning +10 wobbles the window
// edge by an hour at most — harmless for a watch gate.
function toMillis(stamp) {
  const m = String(stamp || "").match(/^(\d{4})-(\d{2})-(\d{2})(?:T?\s?(\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return null;
  const [, y, mo, d, h = "23", mi = "59", s = "59"] = m; // date-only → end of day
  return Date.UTC(+y, +mo - 1, +d, +h, +mi, +s) - 10 * 3600e3;
}

const rows = JSON.parse(readFileSync(POLLS, "utf8")).polls;
const cutoff = Date.now() - WATCH_HOURS * 3600e3;
const pending = rows.filter(
  (r) =>
    r.pollster === "DemosAU" && // excludes "DemosAU (MRP)"
    !r.methodUrl &&
    (toMillis(r.published || r.date) ?? 0) > cutoff,
);

console.log(
  `DEMOSAU_PENDING ${JSON.stringify({
    pending: pending.length,
    rows: pending.map((r) => `${r.client || "?"} ${r.date}`),
    watchHours: WATCH_HOURS,
  })}`,
);
process.exit(pending.length ? 0 : 1);
