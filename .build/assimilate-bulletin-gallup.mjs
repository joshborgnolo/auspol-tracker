#!/usr/bin/env node
/* assimilate-bulletin-gallup.mjs — fold data/bulletin-leader-approval.csv
   (the Morgan Gallup leader ratings read out of The Bulletin, 1973–1984, by
   extract-bulletin-gallup.mjs) into data/polls.json's cycleApproval, one
   row per wave per term, so the pre-1987 past-cycle leadership lines draw.

     node .build/assimilate-bulletin-gallup.mjs            # report only
     node .build/assimilate-bulletin-gallup.mjs --apply    # write polls.json

   Row shape is the cycleApproval one ({date, firm, pmNet, oppNet, pmPpm,
   oppPpm}); firm is "Morgan Gallup"; pmPpm/oppPpm are null throughout —
   the column did not run a better-PM series in this era (absent, not
   zero). A wave contributes pmNet from the leader the era table calls PM on
   that date and oppNet from the opposition leader; a wave rated only one
   of them carries null for the other, which the cycle series skips.

   Terms are keyed by the election that STARTED them, as cycleApproval is
   everywhere: a date falls in [that election, the next). Readings before
   the 1972 election (McMahon's term) have no cycle and are left out.

   Idempotent: every existing "Morgan Gallup" row in the touched terms is
   replaced by the CSV's; rows from other houses are untouched. Nothing else
   in polls.json is written. */
import { readFileSync } from "node:fs";
import { writeJsonAtomic } from "./atomic-write.mjs";

const CSV = "data/bulletin-leader-approval.csv";
const OUT = "data/polls.json";
const FIRM = "Morgan Gallup";
const APPLY = process.argv.includes("--apply");
const ELECTIONS = ["1972-12-02", "1974-05-18", "1975-12-13", "1977-12-10", "1980-10-18", "1983-03-05", "1984-12-01", "1987-07-11"];
const termOf = (date) => { let t = null; for (const e of ELECTIONS) if (date >= e) t = e; return t && t !== ELECTIONS[ELECTIONS.length - 1] ? t.slice(0, 4) : null; };

const lines = readFileSync(CSV, "utf8").split("\n").filter(Boolean);
const hdr = lines[0].split(",");
const col = (name) => hdr.indexOf(name);
const rows = lines.slice(1).map((l) => {
  // the label column is JSON-quoted and may hold commas: split around it
  const m = /^([^"]*)"((?:[^"\\]|\\.)*)"(.*)$/.exec(l);
  const cells = m ? [...m[1].split(",").slice(0, -1), JSON.parse(`"${m[2]}"`), ...m[3].split(",").slice(1)] : l.split(",");
  return Object.fromEntries(hdr.map((h, i) => [h, cells[i]]));
});

const byDate = new Map(); // term|date → {pmNet, oppNet}
const skipped = { other: 0, unknown: 0, preCycle: 0 };
for (const r of rows) {
  if (r.role === "other") { skipped.other++; continue; }
  if (r.role !== "pm" && r.role !== "opposition") { skipped.unknown++; continue; }
  const term = termOf(r.date);
  if (!term) { skipped.preCycle++; continue; }
  const k = `${term}|${r.date}`;
  const w = byDate.get(k) || { term, date: r.date, pmNet: null, oppNet: null };
  const net = Number(r.approve) - Number(r.disapprove);
  if (r.role === "pm") w.pmNet = net; else w.oppNet = net;
  byDate.set(k, w);
}

const D = JSON.parse(readFileSync(OUT, "utf8"));
const perTerm = {};
for (const w of byDate.values()) (perTerm[w.term] ||= []).push({ date: w.date, firm: FIRM, pmNet: w.pmNet, oppNet: w.oppNet, pmPpm: null, oppPpm: null });

/* The 1984 term (Dec 1984 – Jul 1987) outruns The Bulletin's digitised run,
   which ends in 1984; Newspoll's own archive starts in Nov 1985 (Hawke PM,
   Howard opposition leader from Sep 1985), so its in-term waves fill the
   back half exactly as assimilate-1987-cycle-csv.mjs fills the 1987 term:
   nets as filed in newspoll-leader-net-satisfaction.csv, better-PM shares
   from newspoll-better-pm.csv where the wave asked it. */
const NEWSPOLL = "Newspoll";
const csvRows = (f) => readFileSync(f, "utf8").trim().split("\n").map((l) => l.split(","));
const num = (v) => (v === "" || v == null ? null : Number(v));
const sat = csvRows("data/newspoll-leader-net-satisfaction.csv");
const bp = csvRows("data/newspoll-better-pm.csv");
const bpBy = Object.fromEntries(bp.slice(1).map((c) => [c[0], c]));
const [satPm, satOpp] = [sat[0].indexOf("bob_hawke"), sat[0].indexOf("john_howard")];
const [bpPm, bpOpp] = [bp[0].indexOf("bob_hawke"), bp[0].indexOf("john_howard")];
const np1984 = sat.slice(1).filter((c) => c[0] >= "1984-12-01" && c[0] < "1987-07-11" && num(c[satPm]) != null)
  .map((c) => ({ date: c[0], firm: NEWSPOLL, pmNet: num(c[satPm]), oppNet: num(c[satOpp]),
    pmPpm: bpBy[c[0]] ? num(bpBy[c[0]][bpPm]) : null, oppPpm: bpBy[c[0]] ? num(bpBy[c[0]][bpOpp]) : null }));
(perTerm["1984"] ||= []).push(...np1984);
console.log(`Newspoll 1984-term waves: ${np1984.length} (${np1984.filter((r) => r.pmPpm != null).length} with better-PM)`);

let changed = false;
for (const [term, newRows] of Object.entries(perTerm)) {
  const existing = (D.cycleApproval[term] || []).filter((r) => r.firm !== FIRM && !(term === "1984" && r.firm === NEWSPOLL));
  const merged = [...existing, ...newRows].sort((a, b) => a.date.localeCompare(b.date) || a.firm.localeCompare(b.firm));
  const before = JSON.stringify(D.cycleApproval[term] || []);
  if (JSON.stringify(merged) !== before) { changed = true; D.cycleApproval[term] = merged; }
  const both = newRows.filter((r) => r.pmNet != null && r.oppNet != null).length;
  newRows.sort((a, b) => a.date.localeCompare(b.date));
  console.log(`cycleApproval.${term}: ${newRows.length} waves (${both} with both leaders), ${existing.length} rows from other houses kept, ${newRows[0].date} → ${newRows[newRows.length - 1].date}`);
}
console.log(`skipped: ${skipped.other} non-leader readings, ${skipped.unknown} unresolved roles, ${skipped.preCycle} pre-1972-election`);
if (APPLY && changed) { writeJsonAtomic(OUT, D); console.log(`wrote ${OUT}`); }
else if (APPLY) console.log("no change");
else console.log("dry run (pass --apply to write)");
