#!/usr/bin/env node
// Outside-estimate freshness — the watchdog for the hero's comparator lines.
//
// BludgerTrack's trend (data/bludgertrack-2pp.json) and Kevin Bonham's
// figures (data/bonham-2pp.json) are refreshed four times a day inside
// pollbludger-updater.sh, best-effort: a failed extract only logs a WARN
// there, by design, so a comparator can never take down a poll agent. The
// cost is that a broken scraper would freeze a line, and the figure the key
// quotes, without anyone being told. This is the check that tells.
//
// Each mirror is measured against the polls, not the wall clock. Both men
// update when polls land, so a mirror is stale when a poll released well
// after its newest figure is already on the site: a broken scraper, a moved
// page, or the author pausing (worth knowing either way). No new polls, no
// alarm.
//   Bonham        his newest stamp trails the newest release his aggregate
//                 takes (his excluded houses and MRPs aside) by more than
//                 BONHAM_DAYS. He usually updates the day a poll lands but
//                 sometimes batches a few: replayed over his recovered
//                 record, this bar fires only in June and early July 2026,
//                 where the archive's captures are thin, and five days was
//                 his longest wait elsewhere.
//   BludgerTrack  the feed's date trails the newest release by more than
//                 BT_DAYS. He takes a few days at times, so the bar is
//                 looser.
//
// Exit: 0 fresh, 3 stale (report-only, as the coverage doctor's class 3:
// the workflow files a ci-alert issue and stays green), 1 a file could
// not be read. Last stdout line: CMP_STATUS {json}.
// Usage: node .build/check-comparators.mjs

import { readFileSync } from "node:fs";
import { B_EXCLUDED } from "./newtracker/bonham-replica.mjs";

const BONHAM_DAYS = 7;
const BT_DAYS = 10;
const DAY = 86400000;

const status = { verdict: null, newestRelease: null, bonham: null, bludgertrack: null, stale: [], error: null };
const done = (code) => { console.log("CMP_STATUS " + JSON.stringify(status)); process.exit(code); };
const read = (p) => JSON.parse(readFileSync(p, "utf8"));

let polls, kb, bt;
try {
  polls = read("data/polls.json").polls;
  kb = read("data/bonham-2pp.json");
  bt = read("data/bludgertrack-2pp.json");
} catch (e) { status.error = e.message; done(1); }

const releaseOf = (p) => (p.published ? p.published.slice(0, 10) : p.date);
const newest = (rows) => rows.reduce((m, p) => (releaseOf(p) > m ? releaseOf(p) : m), "0000-00-00");
const live = polls.filter((p) => !p.isElection);
const lagDays = (later, earlier) => Math.round((Date.parse(later) - Date.parse(earlier)) / DAY);

status.newestRelease = newest(live);
const kbNewest = newest(live.filter((p) => !B_EXCLUDED.has(p.pollster) && !/\(MRP\)/.test(p.pollster)));
const kbStamp = kb.series?.at(-1)?.[0] || null;
status.bonham = { stamp: kbStamp, newestTakenRelease: kbNewest, lagDays: kbStamp ? lagDays(kbNewest, kbStamp) : null, limit: BONHAM_DAYS };
const btDate = (bt.feedDate || "").slice(0, 10) || null;
status.bludgertrack = { feedDate: btDate, lagDays: btDate ? lagDays(status.newestRelease, btDate) : null, limit: BT_DAYS };

if (!kbStamp || status.bonham.lagDays > BONHAM_DAYS)
  status.stale.push(`Bonham: newest stamp ${kbStamp} trails a poll released ${kbNewest} by ${status.bonham.lagDays} days`);
if (!btDate || status.bludgertrack.lagDays > BT_DAYS)
  status.stale.push(`BludgerTrack: feed dated ${btDate} trails a poll released ${status.newestRelease} by ${status.bludgertrack.lagDays} days`);

status.verdict = status.stale.length ? "stale" : "fresh";
for (const s of status.stale) console.log("  " + s);
done(status.stale.length ? 3 : 0);
