#!/usr/bin/env node
/* benchmark-snapshot.mjs — append a dated row to data/seat-model-benchmarks.json.

   W7 of .build/analysis/seat-model-plan.md: the four outside seat models
   (poliwave, globalelectionsimulator, theswingison, aeforecasts) publish
   live medians that nobody archives; this hand-run script is the memory.
   Values are entered by hand from the sites — the file is the durable
   record, the script only guards the shape.

   Usage:
     node .build/analysis/seat-model/benchmark-snapshot.mjs \
       --date 2026-10-08 --set poliwave=78 ges=73 swingison=69 aef=68 \
       [--note "why this snapshot"] [--key alpMedian]

   Idempotent by (date, key): re-running the same day replaces that row.
   Numbers must be integers 0–150. Run from the repo root. */
import { readFileSync, writeFileSync } from "node:fs";

const FILE = "data/seat-model-benchmarks.json";
const MODELS = ["poliwave", "ges", "swingison", "aef"];
const args = process.argv.slice(2);
const get = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : null; };

const date = get("--date") || new Date().toISOString().slice(0, 10);
const key = get("--key") || "alpMedian";
const note = get("--note");
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { console.error("bad --date (want YYYY-MM-DD)"); process.exit(1); }
const setIdx = args.indexOf("--set");
if (setIdx < 0 || !args[setIdx + 1]) { console.error("--set model=seats ... is required"); process.exit(1); }
const entries = {};
for (const tok of args.slice(setIdx + 1).filter((a) => !a.startsWith("--") && a.includes("="))) {
  const eq = tok.indexOf("=");
  const model = tok.slice(0, eq), raw = tok.slice(eq + 1);
  if (!MODELS.includes(model)) { console.error(`unknown model "${model}" — known: ${MODELS.join(", ")}`); process.exit(1); }
  const seats = Number(raw);
  if (!Number.isInteger(seats) || seats < 0 || seats > 150) { console.error(`bad seat count for ${model}: ${raw}`); process.exit(1); }
  entries[model] = seats;
}
if (!Object.keys(entries).length) { console.error("no model=seats pairs after --set"); process.exit(1); }

const db = JSON.parse(readFileSync(FILE, "utf8"));
const row = { date, key, ...entries, ...(note ? { note } : {}) };
const i = db.snapshots.findIndex((s) => s.date === date && s.key === key);
if (i >= 0) db.snapshots[i] = row; else db.snapshots.push(row);
db.snapshots.sort((a, b) => a.date < b.date ? -1 : 1);
writeFileSync(FILE, JSON.stringify(db, null, 2) + "\n");
console.log(`${i >= 0 ? "updated" : "added"} ${date} (${key}): ` +
  MODELS.filter((m) => m in entries).map((m) => `${m}=${entries[m]}`).join(" "));
