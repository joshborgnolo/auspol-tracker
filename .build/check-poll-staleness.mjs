#!/usr/bin/env node
// check-poll-staleness.mjs — watchdog for a wave that landed as a CLONE of
// the wave before it.
//
// The failure mode, proven on YouGov's 6 Oct 2026 wave: a source serves stale
// figures under a fresh date (that wave's PPM embed repeated the previous
// wave's tables) and an extractor that reads it faithfully files last week's
// numbers as this week's. The extraction-side staleness checks (n24Prefer et
// al.) page at filing time on the houses that have them; this job is the
// fleet-wide backstop for the houses that don't — a scraper reading a cached
// or mis-served previous page clones EVERY figure family, and a whole wave
// repeating the previous wave figure-for-figure is not something sampling
// noise can produce across ≥6 fields at once.
//
// Per house: the newest wave is compared figure-by-figure with the wave
// before it, across every family both rows carry (primary VI, 2PP, ppm,
// head-to-head ppm, approval, alt 2PP, national direction). Fires only when
// at least ST_FIELDS comparable fields exist and EVERY one is identical —
// a single-family tie (2PP unmoved is common) never pages.
//
// Exit 0 = nothing cloned. Exit 1 = a house's latest wave is an exact repeat
// (the failure IS the message, same convention as check-poll-thinness).
import { readFileSync } from "node:fs";

const OUT = process.env.ST_OUT ?? "data/polls.json";
const WINDOW_DAYS = +(process.env.ST_WINDOW ?? 120); // only houses still reporting
const GRACE_DAYS = +(process.env.ST_GRACE ?? 1);     // a same-night correction beats the page
const MIN_FIELDS = +(process.env.ST_FIELDS ?? 6);    // comparable fields before we can judge
const DAY = 86_400_000;

// Documented exceptions, same idea as validate.mjs / check-poll-thinness.mjs:
// a wave that genuinely re-stated the previous figures (verified against the
// release itself, not assumed). An entry here hides a real hole just as
// effectively as it silences a false alarm. Format:
//   { house: "YouGov", date: "2026-10-06", why: "release verbatim repeats 21 Sep; human-adjudicated" }
const EXCEPTIONS = [];

const D = JSON.parse(readFileSync(OUT, "utf8"));

// Figure families, each { key, fields }. A field is comparable only when BOTH
// waves carry it non-null; a family is evaluable when ≥1 field compares.
const POLL_FAMILIES = [
  ["vi", ["alp", "lnp", "grn", "onp", "ind", "oth"]],
  ["tpp", ["tpp_alp", "tpp_lnp"]],
];
const SECTION_FAMILIES = [
  ["ppm", "firm", ["alb", "opp", "han"]],
  ["ppmHeadToHead", "firm", ["alb", "han"]],
  ["approval", "firm", ["alb", "opp", "han"]],
  ["altTpp", "firm", ["alpVsOnp_alp", "lnpVsOnp_lnp"]],
  ["direction", "pollster", ["right", "wrong", "unsure"]],
];

const today = Date.now();
const inWindow = (d) => today - Date.parse(`${d}T00:00:00Z`) <= WINDOW_DAYS * DAY;
const pastGrace = (d) => today - Date.parse(`${d}T00:00:00Z`) > GRACE_DAYS * DAY;

const houses = new Map(); // house -> wave rows, newest last
for (const r of D.polls ?? []) {
  if (!r.pollster || !r.date) continue;
  if (!houses.has(r.pollster)) houses.set(r.pollster, []);
  houses.get(r.pollster).push(r);
}

const sectionRow = (sec, key, house, date) =>
  (D[sec] ?? []).find((r) => (r[key] ?? "") === house && r.date === date) ?? null;

// Fields of `fields` present non-null in BOTH rows -> [comparable, tied]
const compareFields = (a, b, fields) => {
  let comparable = 0, tied = 0;
  for (const f of fields) {
    if (a?.[f] == null || b?.[f] == null) continue;
    comparable++;
    if (a[f] === b[f]) tied++;
  }
  return [comparable, tied];
};

const findings = [];
for (const [house, waves] of houses) {
  waves.sort((a, b) => a.date.localeCompare(b.date));
  const latest = waves.at(-1);
  if (!latest || !inWindow(latest.date) || !pastGrace(latest.date)) continue;
  // the previous DISTINCT wave (guard against a same-date dupe ever existing)
  let prev = null;
  for (let i = waves.length - 2; i >= 0; i--) if (waves[i].date !== latest.date) { prev = waves[i]; break; }
  if (!prev) continue;

  let comparable = 0, tied = 0;
  const parts = [];
  const take = (label, a, b, fields) => {
    const [c, t] = compareFields(a, b, fields);
    if (!c) return;
    comparable += c; tied += t;
    parts.push(`${label} ${t}/${c} tied`);
  };
  for (const [label, fields] of POLL_FAMILIES) take(label, latest, prev, fields);
  for (const [sec, key, fields] of SECTION_FAMILIES)
    take(sec, sectionRow(sec, key, house, latest.date), sectionRow(sec, key, house, prev.date), fields);

  if (comparable >= MIN_FIELDS && tied === comparable) {
    findings.push({ house, date: latest.date, previous: prev.date, fields: comparable, parts });
  }
}

const excepted = (f) => EXCEPTIONS.some((e) => e.house === f.house && e.date === f.date);
const skipped = findings.filter(excepted).length;
for (let i = findings.length - 1; i >= 0; i--) if (excepted(findings[i])) findings.splice(i, 1);

findings.sort((a, b) => b.date.localeCompare(a.date) || a.house.localeCompare(b.house));
const say = (o) => console.log(`ST_STATUS ${JSON.stringify(o)}`);

if (!findings.length) {
  say({ stale: 0, excepted: skipped, housesChecked: houses.size, windowDays: WINDOW_DAYS, fired: false });
  process.exit(0);
}
console.error(`${findings.length} house(s) whose latest wave repeats the previous wave figure-for-figure:`);
for (const f of findings)
  console.error(`  ${f.date}  ${f.house}: all ${f.fields} comparable fields identical to its ${f.previous} wave (${f.parts.join(", ")})`);
console.error(`\nA whole wave cloning the wave before it is a stale-source failure, not sampling noise:`);
console.error(`the source served last release's figures under a fresh date and the extractor believed it.`);
console.error(`Adjudicate against the release itself; if the house genuinely re-stated the figures,`);
console.error(`record that in EXCEPTIONS here with the evidence, otherwise fix the affected rows.`);
say({ stale: findings.length, excepted: skipped, findings, housesChecked: houses.size, windowDays: WINDOW_DAYS, fired: true });
process.exit(1);
