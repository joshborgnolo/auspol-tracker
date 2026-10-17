#!/usr/bin/env node
/* bootstrap-1969-approval.mjs — one-time assimilate of the Trove-mined
   Morgan Gallup leadership readings into cycleApproval.1969, the empty
   bucket the 1943-58 bootstrap opened.

     node .build/bootstrap-1969-approval.mjs          # dry-run (default)
     node .build/bootstrap-1969-approval.mjs --apply  # write polls.json

   Source of truth: data/trove-leader-approval.csv (hand-QA'd store,
   committed 73780ff; see the auspol-trove-vi-mining skill). Selection
   contract:
   - measure = job-rating AND base = all. The own-voters "first choice for
     party leader" Gallup series is a different quantity and never merges
     (per the skill's warning).
   - date in [1971-03-10, 1972-12-02) — i.e. the McMahon half of the
     1969-led term (pmSpl hands Gorton → McMahon at 1971-03-10), so every
     landed wave is McMahon v Whitlam and the pmNet series is one leader
     throughout. (The CSV's first paired wave is 1971-04-15, so the clamp
     bites nothing today but guards any pre-March rows a future mining
     pass adds.)
   - leaders mcmahon / whitlam only. Bob Hawke's 1971-72 ACTU-president
     job-ratings in the same CSV are excluded: not a party leader, doesn't
     fit the pmNet/oppNet schema.
   - pmNet/oppNet = approve − disapprove, matching every existing Morgan
     Gallup/ Bulletin assimilated row (1973-06-15 on, 47-34 = +13 etc.).
   Dates are taken as printed in the CSV: fieldwork-completion days where
   the retrospective table prints them, the 15th-of-month convention else
   — the same convention the bulletin-gallup assimilator already used.
   Refuses to re-run if the bucket is non-empty. */
import { readFileSync } from "node:fs";
import { writeAtomic } from "./atomic-write.mjs";

const APPLY = process.argv.includes("--apply");
const D = JSON.parse(readFileSync("data/polls.json", "utf8"));

if ((D.cycleApproval["1969"] || []).length)
  throw new Error("bootstrap already applied: cycleApproval.1969 is non-empty");
if (!D.cycleApproval["1969"]) throw new Error("cycleApproval.1969 key missing — run the guardrails before this");

const parseCsv = (line) => {
  const out = []; let cur = "", q = false;
  for (const c of line) {
    if (c === '"') { q = !q; continue; }
    if (c === "," && !q) { out.push(cur); cur = ""; continue; }
    cur += c;
  }
  out.push(cur);
  return out;
};
const lines = readFileSync("data/trove-leader-approval.csv", "utf8").trim().split("\n");
const rows = lines.slice(1).map(parseCsv);

const want = rows.filter((r) =>
  r[0] >= "1971-03-10" && r[0] < "1972-12-02"
  && r[3] === "job-rating" && r[7] === "all" && r[4] !== ""
  && (r[1] === "william_mcmahon" || r[1] === "gough_whitlam"));

const byDate = new Map();
for (const r of want) {
  const g = byDate.get(r[0]) || {};
  g[r[1]] = { ap: Number(r[4]), dis: Number(r[5]) };
  byDate.set(r[0], g);
}
const dates = [...byDate.keys()].sort();
for (const d of dates) {
  const g = byDate.get(d);
  if (!(g.william_mcmahon && g.gough_whitlam))
    throw new Error("unpaired wave at " + d + ": " + JSON.stringify(Object.keys(g)));
}
if (dates.length < 10)
  throw new Error("expected ~12 paired waves, got " + dates.length + " — aborting before a partial fill");

const out = dates.map((d) => {
  const g = byDate.get(d);
  return {
    date: d, firm: "Morgan Gallup",
    pmNet: g.william_mcmahon.ap - g.william_mcmahon.dis,
    oppNet: g.gough_whitlam.ap - g.gough_whitlam.dis,
    pmPpm: null, oppPpm: null,
  };
});

console.log("bootstrap-1969-approval " + (APPLY ? "APPLY" : "dry-run") + ":",
  JSON.stringify({ waves: out.length, first: out[0], last: out[out.length - 1] }));
if (APPLY) {
  D.cycleApproval["1969"] = out;
  writeAtomic("data/polls.json", JSON.stringify(D, null, 2) + "\n");
  console.log("wrote data/polls.json");
}
