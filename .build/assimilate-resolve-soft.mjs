// Add Resolve's vote-firmness series to the current-term Resolve rows in
// polls.json. The CSV carries TOTAL SOFT per wave, nationally and by age
// band; the tracker row gets `soft: n` (the other number in the published
// pair — TOTAL HARD, the "committed" share — is 100 - n) and
// `softAge: { "18-34", "35-54", "55+" }`. New waves get both from
// assimilate-resolve-vi.mjs; this fills rows curated before it, and any row
// missing either. Dry-run by default; --apply writes.
//
// Tolerant ±2d date matching, same as the approval backfill: the tracker's
// Resolve waves are keyed on publication date while the CSV keys the wave's
// own date, and the two drift by a day in either direction on some waves.
import { readFileSync } from "node:fs";
import { writeAtomic } from "./atomic-write.mjs";
import { parseLine } from "./resolve-rpm-csv.mjs";

const APPLY = process.argv.includes("--apply");

const AGE_KEYS = { "age-18-34": "18-34", "age-35-54": "35-54", "age-55+": "55+" };
const waves = new Map();
for (const r of readFileSync("data/resolve-political-monitor.csv", "utf8").trim().split("\n").slice(1).map(parseLine)) {
  if (r.dataset !== "vote_firmness" || r.answer !== "TOTAL SOFT") continue;
  const w = waves.get(r.date) || waves.set(r.date, { date: r.date, age: {} }).get(r.date);
  if (r.dimension === "region" && r.key === "National") w.v = Math.round(+r.value_pct);
  if (r.dimension === "age" && AGE_KEYS[r.key]) w.age[AGE_KEYS[r.key]] = Math.round(+r.value_pct);
}
const csv = [...waves.values()].filter((w) => w.v != null);

const DAY = 86400000;
const softNear = (iso) => {
  const t = Date.parse(iso);
  const hit = csv.find((r) => r.date === iso)
    || csv.filter((r) => Math.abs(Date.parse(r.date) - t) / DAY <= 2).sort((a, b) => Math.abs(Date.parse(a.date) - t) - Math.abs(Date.parse(b.date) - t))[0];
  return hit || null;
};

const D = JSON.parse(readFileSync("data/polls.json", "utf8"));
let matched = 0, filled = 0;
const misses = [];
for (const p of D.polls) {
  if (p.pollster !== "Resolve" || p.date < "2025-05-04") continue;
  const f = softNear(p.date);
  if (!f) { misses.push(p.date); continue; }
  matched++;
  if (f.date !== p.date) console.log(`  ${p.date}: firmness from CSV wave ${f.date}`);
  const age = Object.keys(f.age).length === 3 ? f.age : null;
  if (p.soft !== f.v || (age && JSON.stringify(p.softAge) !== JSON.stringify(age))) filled++;
  p.soft = f.v;
  if (age) p.softAge = age;
}

console.log(`mode: ${APPLY ? "APPLY" : "dry-run"}`);
console.log(`Resolve waves matched a firmness reading: ${matched} (${filled} gain or change a value)`);
console.log(`no CSV firmness wave within 2d: ${misses.length}`);
misses.forEach((d) => console.log("  -", d));
if (misses.length) console.log("(waves without a reading are left without the keys, not zeroed)");

if (APPLY && filled) {
  const out = JSON.stringify(D, null, 2) + "\n";
  writeAtomic("data/polls.json", out);
  console.log(`wrote data/polls.json (${(out.length / 1e6).toFixed(2)} MB)`);
}
