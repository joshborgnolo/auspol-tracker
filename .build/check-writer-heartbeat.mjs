// Writer heartbeat: has the automated pipeline landed ANYTHING recently?
//
// WHY THIS EXISTS
// Every data wrapper fails silently — that is their design ("churning compute
// on an upstream that has not moved buys nothing"), and it means a broken
// writer and a quiet news week produce identical logs. The 2026-09-05..07
// writers-lock outage ran for two days with every slot reporting success.
// The coverage doctor answers "is a poll missing from the DATA?" against an
// external witness; this answers the orthogonal question "is the AUTOMATION
// still landing commits at all?" — schedulers disabled, workflows failing at
// checkout, token permissions lost. Those break the pipeline without touching
// any data file, so no data-level check will ever see them.
//
// The metronome is the automation's own commit stream on main: the
// next-polls projection scores daily, the citation ledger and model read
// refresh on schedule, poll wrappers commit whenever a house releases.
// Authored by github-actions[bot], so hand-committed human work cannot mask
// an automation stall. In normal operation the worst observed gap between bot
// commits is under 48h... barely — one silently dropped run of the daily
// score job produced a 47.6h gap (2026-09-04 → 09-06), so a 48h threshold
// would page on ordinary jitter. 60h tolerates one fully missed day of every
// daily job plus scheduler lateness, and still pages within two-and-a-half
// days of a total automation outage.
//
// Local backups complicate nothing: if GitHub-side commits stop but launchd
// keeps the site fresh, that is still worth an email — the primary path and
// the repair agents are down.
//
// Usage: node .build/check-writer-heartbeat.mjs [--json]
//   exit 0 = heartbeat present (bot commit within MAX_SILENCE_H)
//   exit 1 = inconclusive (git history unreadable)
//   exit 3 = stalled (no bot commit within MAX_SILENCE_H) — distinct from the
//            extractors' 1/2 so a wrapper can tell a finding from a fault
import { execFileSync } from "node:child_process";

const JSON_ONLY = process.argv.includes("--json");

// Two missed days of the daily metronome page; one does not. See header.
const MAX_SILENCE_H = 60;

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" });
}

const status = {
  threshold_h: MAX_SILENCE_H,
  ref: null,
  checked_at: new Date().toISOString(),
  last_automation_commit: null,
  age_h: null,
};

try {
  // CI checkouts sit on a detached HEAD and (fetch-depth < all) may not
  // carry an origin/main ref at all; walk the fallbacks instead of throwing.
  // Prefer origin/main (the shared record); the caller (wrapper or workflow)
  // is responsible for freshness.
  for (const ref of ["origin/main", "main", "HEAD"]) {
    try {
      git(["rev-parse", "--verify", "-q", `${ref}^{commit}`]);
      status.ref = ref;
      break;
    } catch { /* ref absent in this checkout */ }
  }
  if (!status.ref) throw new Error("no usable git ref in this checkout");

  const log = git(["log", status.ref, "--format=%ct%x00%an%x00%s", "-z"]);
  // Records are NUL-separated (subjects can contain newlines in theory);
  // fields are NUL-separated within a record.
  const recs = log.split("\0");
  for (let i = 0; i + 2 < recs.length; i += 3) {
    const ts = Number(recs[i]);
    const author = recs[i + 1];
    const subject = recs[i + 2];
    if (author !== "github-actions[bot]") continue;
    status.last_automation_commit = {
      at: new Date(ts * 1000).toISOString(),
      subject: subject.slice(0, 80),
    };
    status.age_h = Math.round(((Date.now() / 1000 - ts) / 3600) * 10) / 10;
    break;
  }
} catch (e) {
  status.error = e.message;
  console.log("HEARTBEAT_STATUS " + JSON.stringify(status));
  if (!JSON_ONLY) console.error("writer heartbeat inconclusive: " + e.message);
  process.exit(1);
}

if (!status.last_automation_commit) {
  // Nothing from the bot anywhere in the fetched history — the deepest
  // silence measurable from here.
  status.stalled = true;
  console.log("HEARTBEAT_STATUS " + JSON.stringify(status));
  if (!JSON_ONLY)
    console.error(
      "STALLED: no github-actions[bot] commit in the fetched history of " +
        status.ref
    );
  process.exit(3);
}

if (status.age_h > MAX_SILENCE_H) {
  status.stalled = true;
  console.log("HEARTBEAT_STATUS " + JSON.stringify(status));
  if (!JSON_ONLY)
    console.error(
      `STALLED: automation silent for ${status.age_h}h (threshold ${MAX_SILENCE_H}h) — ` +
        `last bot commit ${status.last_automation_commit.at} "${status.last_automation_commit.subject}"`
    );
  process.exit(3);
}

console.log("HEARTBEAT_STATUS " + JSON.stringify(status));
if (!JSON_ONLY)
  console.log(
    `heartbeat: alive — last automation commit ${status.age_h}h ago ` +
      `("${status.last_automation_commit.subject}")`
  );
