// Confirms a passed RedBridge/Accent release slot really is absent from the
// AFR and, only then, records it in pollsterRules.skippedSlots so the "Next
// expected polls" projection rolls to the house's late step (the Sunday a
// week on: 28 days becomes 35, as 29 Mar -> 3 May and 28 Jun -> 2 Aug did)
// instead of holding "today · due …" on a release that never came.
//
// The release night is a sequence, and the updater's crons are its checks:
// AFR files the wave at 6pm or 8pm eastern, so the release-window sweeps
// look from 6pm, again through 8pm, and the 9pm follow-up is the last word.
// A later look subsumes the earlier ones — a wave out at 6pm is still on the
// topic page at 9pm — so this script needs only the run it is called from,
// provided that run is past the gate and actually read the page.
//
// Run by redbridge-updater.sh AFTER the extractor only, and only on a
// no-change run. It refuses to write unless every check passes:
//
//   1. the extractor's RB_STATUS carries afrTopic — the topic page was
//      fetched THIS run and its own story list parsed (a page without the
//      list is no evidence, and the extractor then omits afrTopic)
//   2. it is past the gate in Australia/Sydney on the slot day: an hour
//      after the house's latest recorded filing time (releaseTo, 8pm now),
//      so 9pm — computed in the Sydney frame via Intl, not UTC math
//   3. the topic's newest story was first published BEFORE the slot day
//      began in Sydney. A story on the slot day itself may be the wave (or
//      a state poll the page files under the same topic) — that needs a
//      human, not a skip, and exits 1
//   4. the slot isn't listed already (idempotent; silent no-op)
//
// The slot tested is the one the live page shows: the built data asset plus
// the shipped np-project.js, eval'd (the np-score.mjs harness), so a second
// skip — the rolled 35-day Sunday itself passing — is confirmed the same way.
//
// When all hold it appends the slot ISO to skippedSlots in data/polls.json
// and exits 3; the updater then validates, rebuilds and commits. Every other
// outcome exits 0 having changed nothing, except the refusal in 3.
//
// Usage: node .build/redbridge-confirm-skip.mjs '<RB_STATUS json>'
//   RB_NOW=<ISO instant> overrides the clock (tests only).

import { readFileSync } from "node:fs";
import { writeAtomic } from "./atomic-write.mjs";
import { fileURLToPath } from "node:url";

const REPO = fileURLToPath(new URL("..", import.meta.url));
const FIRM = "RedBridge/Accent";
const DAY = 86400000;
const tz = "Australia/Sydney";

const status = JSON.parse(process.argv[2] || "null");
const topic = status && status.afrTopic;
if (!topic || !(topic.stories >= 1) || !Date.parse(topic.newest)) {
  console.log(`skip-confirm: no evidence — RB_STATUS lacks a parsed AFR topic list (${JSON.stringify(topic)})`);
  process.exit(0);
}
const now = process.env.RB_NOW ? Date.parse(process.env.RB_NOW) : Date.now();

const sydParts = (ms) => Object.fromEntries(
  new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(ms).filter((p) => p.type !== "literal").map((p) => [p.type, p.value]));
// Sydney civil time for an instant, as a UTC-frame stamp
const sydMs = (ms) => {
  const p = sydParts(ms);
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
};
// a Sydney civil time (UTC-frame stamp) back to its instant; one fixed-point
// pass is enough away from the 02:00/03:00 DST jump
const sydToUtc = (civil) => civil - (sydMs(civil) - civil);
const sydNowLabel = () => new Intl.DateTimeFormat("en-AU", { timeZone: tz, dateStyle: "medium", timeStyle: "short" }).format(now);

// The projection as the page runs it, at this Sydney moment
const assets = new URL("./newtracker/assets/", import.meta.url);
global.window = {};
eval(readFileSync(new URL("9f09dca2-bd46-49a8-8ae1-51847608cf92.js", assets), "utf8"));
window.AP = { D: window.AUSPOL };
eval(readFileSync(new URL("np-project.js", assets), "utf8"));
const civilNow = sydMs(now);
const day = Math.floor(civilNow / DAY) * DAY;
const row = window.AP.nextPolls({ day, mins: (civilNow - day) / 60000 }).rows
  .find((r) => r.pollster === FIRM && r.ahead === 0);
if (!row || row.summer || row.loose) {
  console.log(`skip-confirm: no dated ${FIRM} slot in the projection; nothing to do`);
  process.exit(0);
}
const slotISO = new Date(row.release).toISOString().slice(0, 10);

// 2. The gate: an hour past the latest recorded filing, on the slot day
const gateMins = (row.releaseTo != null ? row.releaseTo : 20 * 60) + 60;
const gateUtc = sydToUtc(row.release + gateMins * 60000);
if (now < gateUtc) {
  const hh = String(Math.floor(gateMins / 60)).padStart(2, "0"), mm = String(gateMins % 60).padStart(2, "0");
  console.log(`skip-confirm: too early for slot ${slotISO} (Sydney now ${sydNowLabel()}; gate is ${slotISO} ${hh}:${mm} Sydney)`);
  process.exit(0);
}

// 3. Positive evidence: the topic's newest story predates the slot day
const slotStartUtc = sydToUtc(row.release);
if (!(Date.parse(topic.newest) < slotStartUtc)) {
  console.log(`SKIP-CONFIRM REFUSED: slot ${slotISO} has passed with no wave recorded, but the AFR topic's newest story (${topic.newest}, ${topic.newestUrl}) is ON or AFTER the slot day — it may be the wave. Needs a human, not a skip.`);
  process.exit(1);
}

// 4. Idempotence + write
const pollsPath = REPO + "data/polls.json";
const polls = JSON.parse(readFileSync(pollsPath, "utf8"));
const rules = (polls.pollsterRules ||= {})[FIRM] ||= {};
const list = rules.skippedSlots ||= [];
if (list.includes(slotISO)) {
  console.log(`skip-confirm: ${slotISO} already recorded`);
  process.exit(0);
}
list.push(slotISO);
list.sort();
writeAtomic(pollsPath, JSON.stringify(polls, null, 2) + "\n");
console.log(`SKIP-CONFIRMED ${slotISO}: AFR topic list (${topic.stories} stories, fetched ${topic.fetchedAt}) has nothing since ${topic.newest.slice(0, 10)}, Sydney now ${sydNowLabel()}; appended to pollsterRules.${FIRM}.skippedSlots`);
process.exit(3);
