#!/usr/bin/env node
/* bootstrap-1943-58-cycles.mjs — one-time structural edit of data/polls.json
   for the 1943, 1946, 1949, 1951, 1954, 1955 and 1958 past-cycles, the
   batch extension past 1961 that bootstrap-1961-66-cycles.mjs opened.
   Refuses to re-run if any of its artefacts already exist, so a second
   invocation is a clean no-op: this is a DATA edit, not a migration runner.

     node .build/bootstrap-1943-58-cycles.mjs          # dry-run (default)
     node .build/bootstrap-1943-58-cycles.mjs --apply  # write polls.json

   Adds:
   - elections.e1943…e1958 — official counts. Primaries from the election
     articles' results tables (Psephos-derived; UAP/Liberal + Country shown
     combined, as every elections row carries them), two-party per the AEC
     TPP series from 1949 on (aec.gov.au/Elections/Federal_Elections/
     tpp-results.htm) — the 1943/1946 pairs are the published
     Mackerras-estimate figures, since the AEC series starts in 1949.
     Primaries at two decimals like the 1961-66 rows; 1943's oth at 1-dp.
       1943-08-21  ALP 49.93  LNP 30.44  oth 19.6                    TPP 58.2/41.8†
       1946-09-28  ALP 49.71  LNP 43.65  oth  6.64                   TPP 54.1/45.9†
       1949-12-10  ALP 45.98  LNP 50.26  oth  3.76                   TPP 49.0/51.0
       1951-04-28  ALP 47.63  LNP 50.34  oth  2.03                   TPP 49.3/50.7
       1954-05-29  ALP 50.07  LNP 47.57  oth  2.36                   TPP 50.7/49.3
       1955-12-10  ALP 44.65  LNP 47.67  oth  7.68 (DLP 5.17 + 2.51) TPP 45.8/54.2
       1958-11-22  ALP 42.81  LNP 46.55  oth 10.64 (DLP 9.41 + 1.23) TPP 45.9/54.1
       † Mackerras-estimate two-party, not the AEC series
   - cyclePolls buckets "1946"…"1961" — keyed term-CLOSE year like the rest
     of cyclePolls — each opened with its closing "Election" sentinel row.
     No wave is curated here: the whole F2F Morgan stock of these terms
     lands via .build/assimilate-bonham-additional-aeforecasts.mjs — run it
     --apply AFTER this script (OLDEST_ELECTION and TPP_ERA_BY_BUCKET there
     have already moved, and bucketFor() needs these keys). The 1960-02-15
     mirror pair is deliberately excluded there: two conflicting
     transcriptions of the one wave (49/46 v 45/48, the second tagged
     #Transcribed) with no in-repo source to adjudicate them.
   - cycleApproval "1943"…"1958" — EMPTY term-buckets (no GL data this far
     back; gen-data's CYCLE_DEFS loop dereferences the key).
   - cyclePollBases "<bucket>|Morgan" — the provenance record for the
     implied FLOW_ERAS basis of each bucket's era rows (validate's 8c can
     never authority-check a printed-table basis that doesn't exist). Four
     of the seven eras miss the ±0.6 pre-1983 LEF error budget at their
     right-edge backtest (the flows.mjs FLOW_ERAS comment records why: a
     12% independent vote in 1943, splinter-Labor remnants in the 1940s
     "others", and the DLP's post-1955 realignment), so each note quotes
     its own figure as it stands instead of the budget line. */
import { readFileSync } from "node:fs";
import { writeAtomic } from "./atomic-write.mjs";

const APPLY = process.argv.includes("--apply");
const D = JSON.parse(readFileSync("data/polls.json", "utf8"));

const NEW = {
  e1943: { date: "1943-08-21", lnp: 30.44, alp: 49.93, grn: 0, onp: 0, oth: 19.6, tpp_lnp: 41.8, tpp_alp: 58.2 },
  e1946: { date: "1946-09-28", lnp: 43.65, alp: 49.71, grn: 0, onp: 0, oth: 6.64, tpp_lnp: 45.9, tpp_alp: 54.1 },
  e1949: { date: "1949-12-10", lnp: 50.26, alp: 45.98, grn: 0, onp: 0, oth: 3.76, tpp_lnp: 51.0, tpp_alp: 49.0 },
  e1951: { date: "1951-04-28", lnp: 50.34, alp: 47.63, grn: 0, onp: 0, oth: 2.03, tpp_lnp: 49.3, tpp_alp: 50.7 },
  e1954: { date: "1954-05-29", lnp: 47.57, alp: 50.07, grn: 0, onp: 0, oth: 2.36, tpp_lnp: 50.7, tpp_alp: 49.3 },
  e1955: { date: "1955-12-10", lnp: 47.67, alp: 44.65, grn: 0, onp: 0, oth: 7.68, tpp_lnp: 54.2, tpp_alp: 45.8 },
  e1958: { date: "1958-11-22", lnp: 46.55, alp: 42.81, grn: 0, onp: 0, oth: 10.64, tpp_lnp: 54.1, tpp_alp: 45.9 },
};

for (const k of Object.keys(NEW))
  if (D.elections[k]) throw new Error("bootstrap already applied: elections." + k + " exists");
for (const y of ["1946", "1949", "1951", "1954", "1955", "1958", "1961"])
  if (D.cyclePolls[y]) throw new Error("bootstrap already applied: cyclePolls." + y + " exists");
for (const y of ["1943", "1946", "1949", "1951", "1954", "1955", "1958"])
  if (D.cycleApproval[y]) throw new Error("bootstrap already applied: cycleApproval." + y + " exists");
for (const k of ["1946|Morgan", "1949|Morgan", "1951|Morgan", "1954|Morgan", "1955|Morgan", "1958|Morgan", "1961|Morgan"])
  if (D.cyclePollBases[k]) throw new Error("bootstrap already applied: cyclePollBases." + k + " exists");

/* elections — insert before e1961, the batch's chronological successor */
{
  const out = {};
  for (const [k, v] of Object.entries(D.elections)) {
    if (k === "e1961") Object.assign(out, NEW);
    out[k] = v;
  }
  D.elections = out;
}

/* cyclePolls — buckets placed ahead of "1963" so the keys stay ascending */
{
  const sentinel = (key) => {
    const close = D.elections["e" + key];
    return {
      date: close.date, firm: "Election",
      lnp: close.lnp, alp: close.alp, grn: 0, onp: 0, oth: close.oth,
      tpp_lnp: close.tpp_lnp, tpp_alp: close.tpp_alp,
    };
  };
  const out = {};
  for (const [k, v] of Object.entries(D.cyclePolls)) {
    if (k === "1963") {
      for (const y of ["1946", "1949", "1951", "1954", "1955", "1958", "1961"])
        out[y] = [sentinel(y)];
    }
    out[k] = v;
  }
  D.cyclePolls = out;
}

/* cycleApproval — empty term-open buckets, ahead of "1961" */
{
  const out = {};
  for (const [k, v] of Object.entries(D.cycleApproval)) {
    if (k === "1961")
      for (const y of ["1943", "1946", "1949", "1951", "1954", "1955", "1958"])
        out[y] = [];
    out[k] = v;
  }
  D.cycleApproval = out;
}

/* provenance notes — the implied-2PP basis of each bucket's era rows,
   mirroring the 1961-66 notes. The 1943 and 1946 sets calibrate against
   estimated two-party figures, not the AEC series; four right-edge
   backtests miss the ±0.6 budget and say so. */
const note = (open, bt, inBudget) => {
  const anchor = open === "1943" || open === "1946"
    ? "that election's published Mackerras-estimate 2PP – the AEC's own TPP series starts in 1949"
    : "that election's official 2PP";
  return "F2F Morgan Gallup waves from the aeforecasts mirror (no live-poll metadata upstream). Morgan published no national 2PP this far back, so tpp is IMPLIED last-election-flows: primaries read through the "
    + open + " election's calibrated constants (FLOW_ERAS[" + open + "] in flows.mjs, anchored to " + anchor
    + " – the Kevin Bonham Wonk Central method; right-edge backtest "
    + bt + (inBudget ? ", inside the ±0.6 pre-1983 LEF error budget quoted in the piece"
                     : ", a miss outside the ±0.6 pre-1983 LEF error budget quoted in the piece")
    + (open === "1943" ? " against an estimated close itself" : "")
    + "). Democrats/DLP primaries are itemised in dem/dlp row fields (the era's changeable minor-party print conventions make folding them into oth unreliable); the tppEra row tag names the era set used.";
};

D.cyclePollBases["1946|Morgan"] = note("1943", "−1.4 vs the closing election's estimated 2PP", false);
D.cyclePollBases["1949|Morgan"] = note("1946", "−1.33 vs official", false);
D.cyclePollBases["1951|Morgan"] = note("1949", "−0.76 vs official", false);
D.cyclePollBases["1954|Morgan"] = note("1951", "+0.43 vs official", true);
D.cyclePollBases["1955|Morgan"] = note("1954", "−0.01 vs official", true);
D.cyclePollBases["1958|Morgan"] = note("1955", "−2.52 vs official – the DLP's post-split realignment", false);
D.cyclePollBases["1961|Morgan"] = note("1958", "+0.33 vs official", true);

const summary = { elections: Object.keys(NEW).length, buckets: 7, approvalBuckets: 7, bases: 7 };
console.log("bootstrap-1943-58 " + (APPLY ? "APPLY" : "dry-run") + ": " + JSON.stringify(summary));
if (APPLY) {
  writeAtomic("data/polls.json", JSON.stringify(D, null, 2) + "\n");
  console.log("wrote data/polls.json");
}
