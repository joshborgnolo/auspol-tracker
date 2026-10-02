#!/usr/bin/env node
// Validates the Bonham-method reconstruction (.build/newtracker/bonham-replica.mjs)
// against his AS-PUBLISHED sidebar stamps (data/bonham-2pp.json, kept by
// extract-bonham-sidebar.mjs + bonham-wayback-backfill.mjs) — the honest
// answer to "how close does the replica track the lines he actually
// published?". Prints one line of deviation stats plus the worst dates.
//
// A reminder inside the file about meaning: his methods page gives us the
// recipe but not every ingredient (per-house accuracy weights beyond
// Newspoll/RedBridge, his judgment house effects), so the replica is
// expected to sit within about half a point, not on top of him. A step
// change in the mean deviation after a given date usually means one of
// his published rule tweaks (see B_RULE_DATES) hasn't been mirrored yet.
//
// Usage: node .build/check-bonham-replica.mjs
// Exit: 0 always — this is a report, not a gate (the published anchors
//        grow weekly; a hard threshold would fire on HIS corrections).

import { readFileSync } from "node:fs";
import { bonhamReplica } from "./newtracker/bonham-replica.mjs";

const polls = JSON.parse(readFileSync("data/polls.json", "utf8")).polls;
const kb = JSON.parse(readFileSync("data/bonham-2pp.json", "utf8"));
const today = new Date().toISOString().slice(0, 10);

const rep = bonhamReplica(polls, today);
const smByIso = new Map(rep.daily.map((d) => [d.iso, d.sm]));

const rows = [];
for (const [iso, published] of kb.series) {
  const sm = smByIso.get(iso);
  if (sm == null) continue;
  rows.push({ iso, published, replica: sm, dev: Math.round((sm - published) * 10) / 10 });
}
const abs = rows.map((r) => Math.abs(r.dev)).sort((a, b) => a - b);
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;

console.log(`anchors compared : ${rows.length} of ${kb.series.length} published stamps (${kb.series[0][0]} .. ${kb.series.at(-1)[0]})`);
console.log(`replica span     : ${rep.start} .. ${rep.end} (${rep.daily.length} smoothed days)`);
if (!rows.length) { console.log("no overlapping anchors"); process.exit(0); }
console.log(`mean |dev|       : ${mean(abs).toFixed(2)} pts`);
console.log(`median |dev|     : ${abs[Math.floor(abs.length / 2)].toFixed(1)} pts`);
console.log(`max |dev|        : ${abs[abs.length - 1].toFixed(1)} pts`);
console.log(`signed mean dev  : ${mean(rows.map((r) => r.dev)).toFixed(2)} pts (replica minus published)`);
console.log("worst dates      :");
for (const r of [...rows].sort((a, b) => Math.abs(b.dev) - Math.abs(a.dev)).slice(0, 6))
  console.log(`  ${r.iso}  his ${r.published.toFixed(1)}  replica ${r.replica.toFixed(1)}  dev ${r.dev > 0 ? "+" : ""}${r.dev.toFixed(1)}`);
