#!/usr/bin/env node
// Life satisfaction freshness. data/life-satisfaction.json is hand-filed:
// no extractor reads ANUpoll, AIHW or the ABS, so without this a new wave
// would sit unfiled and the National mood view would quietly age.
//
// Each source is measured against its own publishing rhythm:
//   ANUpoll   the newest wave on file is more than ANU_DAYS old (it reports
//             several times a year, a few weeks after fieldwork).
//   HILDA     AIHW had 2024 up by May 2026, so from July the year two back
//             should be on file.
//   checked   nobody has recorded looking for new releases in CHECK_DAYS
//             (set `checked` to today after looking, filed or not). This is
//             what catches the General Social Survey, Scanlon and a new
//             DemosAU wave, which have no short rhythm to measure.
//
// Exit: 0 fresh, 3 stale (report-only: the workflow files a ci-alert issue
// and stays green), 1 the file could not be read. Last stdout line:
// LIFE_STATUS {json}.
// Usage: node .build/check-life-satisfaction.mjs [--today YYYY-MM-DD]

import { readFileSync } from "node:fs";

export const ANU_DAYS = 270, CHECK_DAYS = 100;

export function lifeStaleness(data, today) {
  const T = Date.parse(today + "T00:00:00Z"), days = (iso) => Math.round((T - Date.parse(iso + "T00:00:00Z")) / 86400000);
  const newest = (id) => data.series.find((s) => s.id === id).readings.map((r) => r.date).sort().at(-1);
  const stale = [];
  const anu = newest("anupoll"), anuAge = days(anu + "-15");
  if (anuAge > ANU_DAYS) stale.push(`ANUpoll: newest wave on file is ${anu}, ${anuAge} days old (limit ${ANU_DAYS})`);
  const hilda = +newest("hilda"), expect = +today.slice(0, 4) - (+today.slice(5, 7) >= 7 ? 2 : 3);
  if (hilda < expect) stale.push(`HILDA: newest year on file is ${hilda}; AIHW should have ${expect} by now`);
  const age = data.checked ? days(data.checked) : Infinity;
  if (age > CHECK_DAYS) stale.push(`sources last checked ${data.checked || "never"} (limit ${CHECK_DAYS} days): look for new ANUpoll, AIHW, ABS, Scanlon and DemosAU releases, then set "checked"`);
  return stale;
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("check-life-satisfaction.mjs")) {
  const i = process.argv.indexOf("--today");
  const today = i > 0 ? process.argv[i + 1] : new Date().toISOString().slice(0, 10);
  const status = { verdict: null, today, stale: [], error: null };
  const done = (code) => { console.log("LIFE_STATUS " + JSON.stringify(status)); process.exit(code); };
  try { status.stale = lifeStaleness(JSON.parse(readFileSync("data/life-satisfaction.json", "utf8")), today); }
  catch (e) { status.error = e.message; done(1); }
  status.verdict = status.stale.length ? "stale" : "fresh";
  for (const s of status.stale) console.log("  " + s);
  done(status.stale.length ? 3 : 0);
}
