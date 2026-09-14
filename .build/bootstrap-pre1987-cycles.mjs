#!/usr/bin/env node
/* bootstrap-pre1987-cycles.mjs — one-time structural edit of data/polls.json
   for the pre-1987 cycle rollout. Refuses to re-run if any of its artefacts
   already exist, so a second invocation is a clean no-op: this is a DATA
   edit, not a migration runner.

     node .build/bootstrap-pre1987-cycles.mjs          # dry-run (default)
     node .build/bootstrap-pre1987-cycles.mjs --apply  # write polls.json

   Adds:
   - elections.e1972…e1984 — official counts (primaries/2PP as published,
     1-dp like the existing rows; sources: AEC TPP series aec.gov.au/
     Elections/Federal_Elections/tpp-results.htm, primaries per the
     pappubahry election-statistics cut, which reproduces the AEC totals).
   - cyclePolls buckets 1974, 1975, 1977, 1980, 1983, 1984, 1987 — each
     opened with its closing "Election" sentinel row (same shape as the
     existing buckets). Poll rows land via
     .build/assimilate-bonham-additional-aeforecasts.mjs (run it --apply
     AFTER this script: bucketFor() and the bucket pool both need the keys).
   - cycleApproval empty term-buckets 1972…1984 (cycle rows have no GL data
     this far back; gen-data's CYCLE_DEFS loop dereferences the key).
   - cyclePollBases notes "1974|Morgan"…"1987|Morgan" — the provenance
     record for the implied-2PP basis of the era rows (validate's 8c can
     never authority-check a printed-table basis that doesn't exist). */
import { readFileSync } from "node:fs";
import { writeAtomic } from "./atomic-write.mjs";

const APPLY = process.argv.includes("--apply");
const D = JSON.parse(readFileSync("data/polls.json", "utf8"));

/* official results (ALP 2PP share first) – see header for sources */
const NEW_ELECTIONS = {
  e1972: { date: "1972-12-02", lnp: 41.5, alp: 49.6, grn: 0, onp: 0, oth: 8.9, tpp_lnp: 47.3, tpp_alp: 52.7 },
  e1974: { date: "1974-05-18", lnp: 44.9, alp: 49.3, grn: 0, onp: 0, oth: 5.8, tpp_lnp: 48.3, tpp_alp: 51.7 },
  e1975: { date: "1975-12-13", lnp: 53.1, alp: 42.8, grn: 0, onp: 0, oth: 4.1, tpp_lnp: 55.7, tpp_alp: 44.3 },
  e1977: { date: "1977-12-10", lnp: 48.1, alp: 39.7, grn: 0, onp: 0, oth: 12.2, tpp_lnp: 54.6, tpp_alp: 45.4 },
  e1980: { date: "1980-10-18", lnp: 46.4, alp: 45.2, grn: 0, onp: 0, oth: 8.4, tpp_lnp: 50.4, tpp_alp: 49.6 },
  e1983: { date: "1983-03-05", lnp: 43.6, alp: 49.5, grn: 0, onp: 0, oth: 6.9, tpp_lnp: 46.8, tpp_alp: 53.2 },
  e1984: { date: "1984-12-01", lnp: 45.0, alp: 47.6, grn: 0, onp: 0, oth: 7.4, tpp_lnp: 48.2, tpp_alp: 51.8 },
};

/* cycle bucket -> closing election key; opening election (the FLOW_ERAS key
   the cycle's implied-2PP rows are tagged with) is one term earlier */
const NEW_BUCKETS = ["1974", "1975", "1977", "1980", "1983", "1984", "1987"];

for (const [k, e] of Object.entries(NEW_ELECTIONS))
  if (D.elections[k]) throw new Error("bootstrap already applied: elections." + k + " exists");
for (const y of NEW_BUCKETS)
  if (D.cyclePolls[y]) throw new Error("bootstrap already applied: cyclePolls." + y + " exists");

/* elections rows */
Object.assign(D.elections, NEW_ELECTIONS);

/* cycle buckets, each seeded with its closing Election sentinel */
for (const y of NEW_BUCKETS) {
  const e = D.elections["e" + y];
  D.cyclePolls[y] = [{
    date: e.date, firm: "Election",
    lnp: e.lnp, alp: e.alp, grn: 0, onp: 0, oth: e.oth,
    tpp_lnp: e.tpp_lnp, tpp_alp: e.tpp_alp,
  }];
}
/* re-key ascending (1990+ buckets stay in place after the new front block) */
D.cyclePolls = Object.fromEntries(Object.entries(D.cyclePolls).sort((a, b) => Number(a[0]) - Number(b[0])));

/* empty approval term-buckets (cycle year = term-open; gen-data requires the key) */
for (const y of ["1972", "1974", "1975", "1977", "1980", "1983", "1984"]) {
  if (D.cycleApproval[y]) throw new Error("bootstrap already applied: cycleApproval." + y + " exists");
  D.cycleApproval[y] = [];
}
D.cycleApproval = Object.fromEntries(Object.entries(D.cycleApproval).sort((a, b) => Number(a[0]) - Number(b[0])));

/* provenance notes — one per new bucket, tied to the implied-flows era set
   that opens the term (FLOW_ERAS in .build/newtracker/flows.mjs) */
const note = (open, extra) =>
  "F2F Morgan Gallup waves from the aeforecasts mirror (no live-poll metadata upstream). Morgan published no national 2PP this far back, so tpp is IMPLIED last-election-flows: primaries read through the "
  + open + " election's calibrated constants (FLOW_ERAS[" + open + "] in flows.mjs, anchored to that election's official 2PP – the Kevin Bonham Wonk Central method; right-edge backtest −0.04…−0.35 vs official, inside the ±0.6 pre-1983 LEF error budget quoted in the piece). "
  + extra
  + " Democrats/DLP primaries are itemised in dem/dlp row fields (the era's changeable minor-party print conventions make folding them into oth unreliable); the tppEra row tag names the era set used.";

const BASES = {
  "1974|Morgan": note("1972", ""),
  "1975|Morgan": note("1974", ""),
  "1977|Morgan": note("1975", "The Democrat debut is the adjudicated structural break: no prior Democrat flow existed, so the 1975 set carries dem=0.50 as the documented debut assumption (contemporary pollsters handled the debut the same way). "),
  "1980|Morgan": note("1977", ""),
  "1983|Morgan": note("1980", ""),
  "1984|Morgan": note("1983", ""),
  "1987|Morgan": note("1984", ""),
};
for (const [k, v] of Object.entries(BASES)) {
  if (D.cyclePollBases[k]) throw new Error("bootstrap already applied: cyclePollBases." + k + " exists");
  D.cyclePollBases[k] = v;
}

const summary = { elections: Object.keys(NEW_ELECTIONS).length, buckets: NEW_BUCKETS.length, approvalBuckets: 7, bases: Object.keys(BASES).length };
console.log("bootstrap " + (APPLY ? "APPLY" : "dry-run") + ":", JSON.stringify(summary));
if (APPLY) {
  writeAtomic("data/polls.json", JSON.stringify(D, null, 2) + "\n");
  console.log("wrote data/polls.json");
}
