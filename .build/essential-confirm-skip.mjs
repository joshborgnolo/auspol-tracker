// Confirms a passed Essential release slot really is absent at the publisher
// and, only then, records it in pollsterRules.skippedSlots so the "Next
// expected polls" projection rolls to the following slot instead of holding
// "(or N days ago)" on a release that never came.
//
// Run by essential-updater.sh AFTER the extractor only, and only on a
// no-change run: the updater's changed branch means the site HAS new data,
// so there is nothing to confirm. The script refuses to write unless every
// evidence check passes:
//
//   1. the extractor exited 0 this run (the updater only invokes us then) and
//      its ESSENTIAL_STATUS carried a parseable latest_report_date — proof
//      the publisher index WAS fetched just now, not assumed
//   2. latest_report_date is OLDER than the day after the slot — the one
//      positive measure of "nothing new was published". Anything else (no
//      change, quiet page) is negative evidence and is never enough
//   3. it is at least 05:00 in Australia/Sydney on slot+1 — written in the
//      Sydney frame via Intl, not UTC math, so AEDT/AEST drift can't move it
//   4. the slot isn't listed already (idempotent; silent no-op)
//
// When all four hold it appends the slot ISO to skippedSlots in
// data/polls.json and exits 3; the updater then validates, rebuilds and
// commits. Every other outcome exits 0 having changed nothing — a failed
// check is a miss, never an error, because the updater runs unattended.
//
// Usage: node .build/essential-confirm-skip.mjs '<ESSENTIAL_STATUS json>'
// The status JSON must include latest_report_date (extractor >= Sep 2026).

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// fileURLToPath, not URL.pathname: the working copy's path carries a space,
// and pathname leaves it percent-encoded (the write then can't find the repo)
const REPO = fileURLToPath(new URL("..", import.meta.url));
const DAY = 86400000;

const status = JSON.parse(process.argv[2]);
if (!status || typeof status.latest_report_date !== "string" || !Date.parse(status.latest_report_date)) {
  console.log(`skip-confirm: no evidence — extractor status lacks latest_report_date (${status && status.latest_report_date})`);
  process.exit(0);
}

// The current projection's Essential slot, read out of the freshly built
// data asset — the same number the live page is showing, so what we test is
// what a reader is waiting on.
const src = readFileSync(new URL("./newtracker/assets/9f09dca2-bd46-49a8-8ae1-51847608cf92.js", import.meta.url), "utf8");
global.window = {};
eval(src);
const c = (window.AUSPOL.pollCadence || []).find((r) => r.pollster === "Essential");
if (!c) {
  console.log("skip-confirm: no Essential cadence row in the built data; nothing to do");
  process.exit(0);
}
const dayFloor = (ms) => {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
};
const snap = (ms) => {
  if (c.releaseDow == null) return ms;
  let d = c.releaseDow - new Date(ms).getUTCDay();
  if (d > 3) d -= 7;
  if (d < -3) d += 7;
  return ms + d * DAY;
};
// Mirror npProject's own slot walk, including the roll past already-skipped
// slots (one week per skip for a dated house — Essential's only measured
// late step), so the slot tested here is the next UNVERIFIED expectation.
let field = Date.parse(c.last) + c.cadence * DAY;
let release = dayFloor(snap(field + c.lag * DAY));
while ((c.skipped || []).includes(new Date(release).toISOString().slice(0, 10))) {
  field += (c.releaseDow != null ? 7 : c.cadence) * DAY;
  release = dayFloor(snap(field + c.lag * DAY));
}
const slotISO = new Date(release).toISOString().slice(0, 10);

// 3. The time gate, in Sydney wall time both sides: now >= slot+1 at 05:00.
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
// slot+1 05:00 Sydney as a UTC instant: take that civil time as if UTC, then
// subtract Sydney's offset from UTC at that moment. One fixed-point pass is
// enough — the offset only jumps at a DST boundary (02:00/03:00, hours away
// from both inputs here).
const slotNextDay = new Date(Date.parse(slotISO + "T00:00:00Z") + DAY).toISOString().slice(0, 10);
const gateAsUtc = Date.parse(`${slotNextDay}T05:00:00Z`);
const gateUtc = gateAsUtc - (sydMs(gateAsUtc) - gateAsUtc);
if (now < gateUtc) {
  console.log(`skip-confirm: too early for slot ${slotISO} (Sydney now ${new Intl.DateTimeFormat("en-AU", { timeZone: tz, dateStyle: "medium", timeStyle: "short" }).format(now)}; gate is ${slotNextDay} 05:00 Sydney)`);
  process.exit(0);
}

// 2. Positive evidence: the newest report predates the day after the slot.
const latestMs = Date.parse(status.latest_report_date);
const slotNextMs = Date.parse(slotISO + "T00:00:00Z") + DAY;
if (!(latestMs < slotNextMs)) {
  console.log(`SKIP-CONFIRM REFUSED: slot ${slotISO} is overdue but the publisher's newest report is dated ${status.latest_report_date.slice(0, 10)} — the index shows something AT OR PAST the slot. Needs a human, not a skip.`);
  process.exit(1);
}

// 4. Idempotence + write.
const pollsPath = REPO + "data/polls.json";
const polls = JSON.parse(readFileSync(pollsPath, "utf8"));
const rules = polls.pollsterRules?.Essential ?? (polls.pollsterRules.Essential = {});
const list = rules.skippedSlots ?? (rules.skippedSlots = []);
if (list.includes(slotISO)) {
  console.log(`skip-confirm: ${slotISO} already recorded`);
  process.exit(0);
}
list.push(slotISO);
list.sort();
writeFileSync(pollsPath, JSON.stringify(polls, null, 2) + "\n");
console.log(`SKIP-CONFIRMED ${slotISO}: extractor says the publisher's newest report is ${status.latest_report_date.slice(0, 10)} ("${status.latest_report_title || "?"}"), Sydney gate passed; appended to pollsterRules.Essential.skippedSlots`);
process.exit(3);
