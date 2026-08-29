// One-off: unify the AFR / RedBridge Group / Accent Research series under a
// single pollster label.
//
// THE PROBLEM
// The same monthly AFR poll sits in polls.json under two names. Ten waves from
// 2025-06-30 to 2026-04-30 were hand-entered as "Redbridge"; the three from
// 2026-05-28 on were written by extract-redbridge.mjs as "RedBridge / Accent",
// which is the label pollsterRules already keys on and the one the extractor
// will keep producing. That split is not cosmetic:
//
//   - House effects are estimated per firm string (gen-data.mjs, hOf), so the
//     aggregate has been fitting TWO house effects for one house, each off a
//     short series, instead of one off thirteen waves.
//   - extract-redbridge.mjs refuses to duplicate a wave already committed under
//     the other name, so four of its seven candidate waves sat outside its
//     verification loop entirely — it could not check the figures it had.
//   - check-coverage.mjs reads "Redbridge" as a house that stopped publishing
//     in April, which is a permanent false alarm.
//
// WHAT MOVES, AND WHAT DOES NOT
// Only the AFR-commissioned waves. The 2026-02-12 wave under "Redbridge" is
// client "Australia Inst." — RedBridge polling for a different client is a
// different product, and extract-redbridge.mjs's header says so explicitly
// ("Redbridge is used for other clients and never collides here"). It keeps
// its own label deliberately; merging it would invent a series the house never
// published.
//
// Companion ppm / approval / altTpp rows key on `firm` and every one of their
// "Redbridge" dates is an AFR date, so they all move with the polls rows.
//
// Usage: node .build/migrate-redbridge-label.mjs [--apply]
//   without --apply it prints what it would change and writes nothing.
import { readFileSync, writeFileSync, renameSync } from "node:fs";

const APPLY = process.argv.includes("--apply");
const OUT = "data/polls.json";
const FROM = "Redbridge";
const TO = "RedBridge / Accent";

const orig = readFileSync(OUT, "utf8");
const trailingNl = orig.endsWith("\n") ? "\n" : "";
const D = JSON.parse(orig);

// The AFR waves are the migration set; everything else under the old label stays.
const afrDates = new Set(
  D.polls.filter((p) => p.pollster === FROM && p.client === "AFR").map((p) => p.date));
const staying = D.polls.filter((p) => p.pollster === FROM && p.client !== "AFR");

const moved = { polls: [], ppm: [], approval: [], altTpp: [], ppmHeadToHead: [] };

for (const p of D.polls) {
  if (p.pollster === FROM && afrDates.has(p.date) && p.client === "AFR") {
    p.pollster = TO;
    moved.polls.push(p.date);
  }
}
for (const key of ["ppm", "approval", "altTpp", "ppmHeadToHead"]) {
  for (const r of D[key] ?? []) {
    if (r.firm === FROM && afrDates.has(r.date)) {
      r.firm = TO;
      moved[key].push(r.date);
    }
  }
}

// Nothing may be left keyed to the old label except the deliberate exception —
// a stray row would silently keep its own house effect.
const leftovers = [
  ...D.polls.filter((p) => p.pollster === FROM).map((p) => `polls ${p.date} (${p.client})`),
  ...["ppm", "approval", "altTpp", "ppmHeadToHead"].flatMap((k) =>
    (D[k] ?? []).filter((r) => r.firm === FROM).map((r) => `${k} ${r.date}`)),
];

for (const [k, v] of Object.entries(moved)) if (v.length) console.log(`${k}: ${v.length} row(s) -> "${TO}"  [${v.join(", ")}]`);
console.log(`\nleft under "${FROM}": ${leftovers.length ? leftovers.join(", ") : "(none)"}`);
console.log(`expected to remain: ${staying.map((p) => `${p.date} (${p.client})`).join(", ") || "(none)"}`);

const unexpected = leftovers.filter((l) => !staying.some((p) => l.includes(p.date)));
if (unexpected.length) {
  console.error(`\nABORT: rows still under "${FROM}" that are not the documented exception: ${unexpected.join(", ")}`);
  process.exit(2);
}

if (!APPLY) {
  console.log("\n(dry run — pass --apply to write)");
  process.exit(0);
}
const tmp = OUT + ".tmp";
writeFileSync(tmp, JSON.stringify(D, null, 2) + trailingNl);
renameSync(tmp, OUT);
console.log(`\nwrote ${OUT}`);
