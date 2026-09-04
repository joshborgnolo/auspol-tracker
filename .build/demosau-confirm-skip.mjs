// Confirms a passed DemosAU slot MONTH really is absent at the publisher and,
// only then, records it in pollsterRules.skippedMonths so the "Next expected
// polls" projection rolls the calendar-month slot one month on instead of
// holding red "N days overdue" on a month that never filed.
//
// Run by demosau-updater.sh AFTER the extractor only, and only on a no-change
// run: a changed sweep means the site HAS new data, so there is nothing to
// confirm. The month-grain counterpart of essential-confirm-skip.mjs, with
// the same standard of evidence - the projection's never-rolled-forward-on-
// a-guess rule only moves out of the way for a slot whose absence is
// POSITIVELY verified, so the script refuses to write unless all of these
// hold:
//
//   1. the extractor exited 0 this run (the updater only invokes us then) and
//      its DEMOSAU_STATUS lists the report titles it considered — proof the
//      publisher index WAS crawled just now, not assumed
//   2. the crawl is complete: missing_rows empty. A wave reference the
//      extractor could not parse could BE this month's wave, which makes
//      absence unprovable — refuse and ask for a human, don't skip
//   3. the newest wave the crawl saw (verified + added dates) predates the
//      slot month — the positive measure of "nothing was published in it".
//      Anything else (no change, quiet page) is negative evidence and is
//      never enough
//   4. it is at least 05:00 in Australia/Sydney on the day AFTER the slot's
//      measured filing window closes (the calDays max day, clamped to the
//      month) — written in the Sydney frame via Intl, not UTC math
//   5. the month isn't listed already (idempotent; silent no-op)
//
// When all five hold it appends the slot month (YYYY-MM) to skippedMonths in
// data/polls.json and exits 3; the updater then validates, rebuilds and
// commits. Every other outcome exits 0 having changed nothing — a failed
// check is a miss, never an error, because the updater runs unattended.
// (Exit 1 is the explicit refused-look-a-human case for check 2 and the
// failed test of check 3, matching the Essential agent's contract.)
//
// Usage: node .build/demosau-confirm-skip.mjs '<DEMOSAU_STATUS json>'

import { readFileSync } from "node:fs";
import { writeAtomic } from "./atomic-write.mjs";
import { fileURLToPath } from "node:url";

// fileURLToPath, not URL.pathname: the working copy's path carries a space,
// and pathname leaves it percent-encoded (the write then can't find the repo)
const REPO = fileURLToPath(new URL("..", import.meta.url));
const DAY = 86400000;

const status = JSON.parse(process.argv[2] || "null");
if (!status || status.error || !Array.isArray(status.candidates) || !status.candidates.length) {
  console.log("skip-confirm: no evidence — extractor status carries no crawl result");
  process.exit(0);
}
if ((status.missing_rows || []).length) {
  console.log(`SKIP-CONFIRM REFUSED: the crawl saw wave references it could not fill (${status.missing_rows.length} missing row(s)) — absence can't be proven from an incomplete crawl. Needs a human, not a skip.`);
  process.exit(1);
}

// The current projection's DemosAU slot month, read out of the freshly built
// data asset — the same number the live page is showing, so what we test is
// what a reader is waiting on.
const src = readFileSync(new URL("./newtracker/assets/9f09dca2-bd46-49a8-8ae1-51847608cf92.js", import.meta.url), "utf8");
global.window = {};
eval(src);
const c = (window.AUSPOL.pollCadence || []).find((r) => r.pollster === "DemosAU");
if (!c || !c.calMonth) {
  console.log("skip-confirm: no calendar-month DemosAU cadence row in the built data; nothing to do");
  process.exit(0);
}

// The slot month under test is the next UNVERIFIED one: the house's own
// month-after-last projection, stepped past months already confirmed absent.
// Mirrors the calMonth branch of .build/newtracker/assets/np-project.js.
const ld = new Date(Date.parse(c.last));
let sm = (ld.getUTCMonth() + 1) % 12;
let sy = ld.getUTCFullYear() + (ld.getUTCMonth() === 11 ? 1 : 0);
while ((c.skippedMonths || []).includes(`${sy}-${String(sm + 1).padStart(2, "0")}`)) {
  sm += 1;
  if (sm > 11) { sm = 0; sy += 1; }
}
const slotYm = `${sy}-${String(sm + 1).padStart(2, "0")}`;
// The window closes on the measured max filing day, clamped to the slot
// month's own last day — the same clamp the projection applies.
const monthLen = new Date(Date.UTC(sy, sm + 1, 0)).getUTCDate();
const closeDay = c.calDays ? Math.min(c.calDays[1], monthLen) : monthLen;
const closeISO = `${slotYm}-${String(closeDay).padStart(2, "0")}`;

// 4. The time gate, in Sydney wall time both sides: now >= close+1 at 05:00.
const tz = "Australia/Sydney";
const sydParts = (ms) => Object.fromEntries(
  new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(ms).filter((p) => p.type !== "literal").map((p) => [p.type, p.value]));
// Sydney civil time for an instant, via the round-trip through its parts.
const sydMs = (ms) => {
  const p = sydParts(ms);
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
};
const now = Date.now();
// close+1 05:00 Sydney as a UTC instant: take that civil time as if UTC, then
// subtract Sydney's offset from UTC at that moment. One fixed-point pass is
// enough — the offset only jumps at a DST boundary (02:00/03:00, hours away
// from both inputs here).
const gateDay = new Date(Date.parse(closeISO + "T00:00:00Z") + DAY).toISOString().slice(0, 10);
const gateAsUtc = Date.parse(`${gateDay}T05:00:00Z`);
const gateUtc = gateAsUtc - (sydMs(gateAsUtc) - gateAsUtc);
if (now < gateUtc) {
  console.log(`skip-confirm: too early for ${slotYm} (window closes ${closeISO}; Sydney now ${new Intl.DateTimeFormat("en-AU", { timeZone: tz, dateStyle: "medium", timeStyle: "short" }).format(now)}; gate is ${gateDay} 05:00 Sydney)`);
  process.exit(0);
}

// 3. Positive evidence: the newest wave the crawl saw predates the slot month.
const newest = [...(status.verified || []), ...(status.added || [])]
  .map((v) => v && v.date).filter(Boolean).sort().pop();
if (!newest) {
  console.log("skip-confirm: no dated waves in the crawl result — inconclusive, not an absence");
  process.exit(0);
}
if (!(Date.parse(newest) < Date.parse(slotYm + "-01"))) {
  console.log(`SKIP-CONFIRM REFUSED: slot month ${slotYm} is overdue but the publisher's newest wave is dated ${newest} — the index shows something AT OR PAST the slot month. Needs a human, not a skip.`);
  process.exit(1);
}

// 5. Idempotence + write.
const pollsPath = REPO + "data/polls.json";
const polls = JSON.parse(readFileSync(pollsPath, "utf8"));
const rules = polls.pollsterRules?.DemosAU ?? (polls.pollsterRules.DemosAU = {});
const list = rules.skippedMonths ?? (rules.skippedMonths = []);
if (list.includes(slotYm)) {
  console.log(`skip-confirm: ${slotYm} already recorded`);
  process.exit(0);
}
list.push(slotYm);
list.sort();
writeAtomic(pollsPath, JSON.stringify(polls, null, 2) + "\n");
console.log(`SKIP-CONFIRMED ${slotYm}: the publisher's newest wave is ${newest}, the ${closeISO} 05:00-Sydney gate passed; appended to pollsterRules.DemosAU.skippedMonths`);
process.exit(3);
