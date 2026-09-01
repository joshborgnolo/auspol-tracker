#!/usr/bin/env node
// check-poll-thinness.mjs — watchdog for waves that landed but landed THIN.
//
// check-coverage.mjs asks "did we miss a wave?" and deliberately reads only
// (pollster, fieldwork-end) pairs. Nothing asked the next question: "did the
// wave arrive with the rows it normally carries?" That is the YouGov agent's
// predicted failure — the News24/Chrome enrichment leg degrades to
// Wikipedia-only by design, so the wave still lands, as a VI row with no
// published, no ppm/approval/altTpp. It is indistinguishable from a healthy
// wave unless someone reads status.news24 in a log nobody reads.
//
// Self-calibrating rather than a hardcoded per-house table: a section is
// EXPECTED of a house only when that house carries it on >= EXPECT_RATE of its
// recent waves. Newspoll never files altTpp, so altTpp is never expected of
// Newspoll; nothing needs to be told that. A house that genuinely stops
// reporting something drifts below the threshold and stops being asked for it.
//
// Exit 0 = nothing thin. Exit 1 = at least one thin wave (the failure IS the
// message, same convention as coverage-check).
import { readFileSync } from "node:fs";

const OUT = process.env.PT_OUT ?? "data/polls.json";
const WINDOW_DAYS = +(process.env.PT_WINDOW ?? 120); // ignore settled history
const GRACE_DAYS = +(process.env.PT_GRACE ?? 2);     // enrichment may still be in flight
const EXPECT_RATE = +(process.env.PT_RATE ?? 0.8);   // conservative: watchdogs that cry wolf get muted
const MIN_WAVES = 4;                                  // too few waves to infer a pattern
const DAY = 86_400_000;

// Documented exceptions, same idea as validate.mjs: a wave the house genuinely
// did not report, as opposed to one the pipeline failed to fetch. Add only
// AFTER adjudicating against the release — an exception here hides a real hole
// just as effectively as it silences a false alarm. Format:
//   { house: "YouGov", date: "2026-06-16", missing: "ppm", why: "..." }
const EXCEPTIONS = [];

const polls = JSON.parse(readFileSync(OUT, "utf8"));
const DERIVED = [["ppm", "firm"], ["approval", "firm"], ["altTpp", "firm"], ["ppmHeadToHead", "firm"]];

const today = Date.now();
const inWindow = (d) => today - Date.parse(`${d}T00:00:00Z`) <= WINDOW_DAYS * DAY;
const pastGrace = (d) => today - Date.parse(`${d}T00:00:00Z`) > GRACE_DAYS * DAY;

// house -> [wave rows], newest last, recent window only
const houses = new Map();
for (const r of polls.polls ?? []) {
  const h = r.pollster;
  if (!h || !r.date || !inWindow(r.date)) continue;
  if (!houses.has(h)) houses.set(h, []);
  houses.get(h).push(r);
}

const has = (sec, key, house, date) =>
  (polls[sec] ?? []).some((r) => (r[key] ?? "") === house && r.date === date);

// A house that only STARTED filing a section recently must not be blamed for
// the waves that predate it. Roy Morgan's altTpp begins 2026-05-17 and
// YouGov's `published` begins 2026-05-19; without this, every earlier wave
// reads as thin. Expectation starts at a section's first appearance, over ALL
// history rather than the window, so the window edge can't fake a start date.
const firstSeen = (rows, key, house, ok = () => true) =>
  rows.filter((r) => (r[key] ?? "") === house && ok(r)).map((r) => r.date).sort()[0] ?? null;

const findings = [];
for (const [house, waves] of houses) {
  if (waves.length < MIN_WAVES) continue;
  waves.sort((a, b) => a.date.localeCompare(b.date));

  for (const [sec, key] of DERIVED) {
    const since = firstSeen(polls[sec] ?? [], key, house);
    if (!since) continue; // house has never filed this section at all
    const scope = waves.filter((w) => w.date >= since);
    if (scope.length < MIN_WAVES) continue;
    const rate = scope.filter((w) => has(sec, key, house, w.date)).length / scope.length;
    if (rate < EXPECT_RATE) continue; // not this house's habit — never expected
    for (const w of scope) {
      if (!pastGrace(w.date)) continue;
      if (!has(sec, key, house, w.date))
        findings.push({ house, date: w.date, missing: sec, rate: +(rate * 100).toFixed(0) });
    }
  }

  // `published` is the other tell: the enrichment leg supplies it, so a wave
  // that landed Wikipedia-only lacks it while its siblings have it.
  const pubSince = firstSeen(polls.polls ?? [], "pollster", house, (r) => !!r.published);
  const pubScope = pubSince ? waves.filter((w) => w.date >= pubSince) : [];
  const pubRate = pubScope.length >= MIN_WAVES
    ? pubScope.filter((w) => w.published).length / pubScope.length : 0;
  if (pubRate >= EXPECT_RATE) {
    for (const w of pubScope) {
      if (!pastGrace(w.date) || w.published) continue;
      findings.push({ house, date: w.date, missing: "published", rate: +(pubRate * 100).toFixed(0) });
    }
  }
}

const excepted = (f) => EXCEPTIONS.some((e) =>
  e.house === f.house && e.date === f.date && e.missing === f.missing);
const skipped = findings.filter(excepted).length;
for (let i = findings.length - 1; i >= 0; i--) if (excepted(findings[i])) findings.splice(i, 1);

findings.sort((a, b) => b.date.localeCompare(a.date) || a.house.localeCompare(b.house));
const say = (o) => console.log(`PT_STATUS ${JSON.stringify(o)}`);

if (!findings.length) {
  say({ thin: 0, excepted: skipped, housesChecked: houses.size, windowDays: WINDOW_DAYS, fired: false });
  process.exit(0);
}
console.error(`${findings.length} thin wave field(s) — a wave landed without rows its house normally carries:`);
for (const f of findings)
  console.error(`  ${f.date}  ${f.house}: no ${f.missing} row (house files it on ${f.rate}% of recent waves)`);
console.error(`\nUsually the enrichment leg degraded and the base row landed alone.`);
console.error(`For YouGov that is the News24/Chrome path: check status.news24 in .build/logs/news24.log,`);
console.error(`then re-run to let the upgrade gate backfill the wave in place.`);
say({ thin: findings.length, excepted: skipped, findings, housesChecked: houses.size, windowDays: WINDOW_DAYS, fired: true });
process.exit(1);
