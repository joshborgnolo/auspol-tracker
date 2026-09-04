// Add Resolve's vote-firmness series to the current-term Resolve rows in
// polls.json. The CSV carries TOTAL SOFT National per wave; the tracker row
// gets `soft: n` (the other number in the published pair — TOTAL HARD, the
// "committed" share — is 100 - n). Dry-run by default; --apply writes.
//
// Tolerant ±2d date matching, same as the approval backfill: the tracker's
// Resolve waves are keyed on publication date while the CSV keys the wave's
// own date, and the two drift by a day in either direction on some waves.
import { readFileSync } from "node:fs";
import { writeAtomic } from "./atomic-write.mjs";

const APPLY = process.argv.includes("--apply");

const csv = readFileSync("data/resolve-political-monitor.csv", "utf8").trim().split("\n").slice(1)
  .map((l) => l.split(","))
  .filter(([ds, , , , answer, dim, key]) => ds === "vote_firmness" && answer === "TOTAL SOFT" && dim === "region" && key === "National")
  .map(([, , , , , , , date, v]) => ({ date, v: +v }));

const DAY = 86400000;
const softNear = (iso) => {
  const t = Date.parse(iso);
  const hit = csv.find((r) => r.date === iso)
    || csv.filter((r) => Math.abs(Date.parse(r.date) - t) / DAY <= 2).sort((a, b) => Math.abs(Date.parse(a.date) - t) - Math.abs(Date.parse(b.date) - t))[0];
  return hit || null;
};

const D = JSON.parse(readFileSync("data/polls.json", "utf8"));
let matched = 0;
const misses = [];
for (const p of D.polls) {
  if (p.pollster !== "Resolve") continue;
  const f = softNear(p.date);
  if (!f) { misses.push(p.date); continue; }
  if (f.date !== p.date) console.log(`  ${p.date}: soft ${f.v} from CSV wave ${f.date}`);
  p.soft = f.v;
  matched++;
}

console.log(`mode: ${APPLY ? "APPLY" : "dry-run"}`);
console.log(`Resolve waves matched a TOTAL SOFT reading: ${matched}`);
console.log(`no CSV firmness wave within 2d: ${misses.length}`);
misses.forEach((d) => console.log("  -", d));
if (misses.length) console.log("(waves without a reading are left without a 'soft' key, not zeroed)");

if (APPLY) {
  const out = JSON.stringify(D, null, 2) + "\n";
  writeAtomic("data/polls.json", out);
  console.log(`wrote data/polls.json (${(out.length / 1e6).toFixed(2)} MB)`);
}
