#!/usr/bin/env node
/* bootstrap-1961-66-cycles.mjs — one-time structural edit of data/polls.json
   for the 1961, 1963 and 1966 past-cycles, the batch extension past 1972
   that the 1969-72 trial cycle (bootstrap-1969-cycle.mjs) opened. Refuses
   to re-run if any of its artefacts already exist, so a second invocation
   is a clean no-op: this is a DATA edit, not a migration runner.

     node .build/bootstrap-1961-66-cycles.mjs          # dry-run (default)
     node .build/bootstrap-1961-66-cycles.mjs --apply  # write polls.json

   Adds:
   - elections.e1961/e1963/e1966 — official counts. Primaries per the AEC
     first-preference tables as cross-checked on the election articles of
     record (Liberal + Country shown combined, as every elections row
     carries them), two-party per the AEC TPP series (aec.gov.au/
     Elections/Federal_Elections/tpp-results.htm — the 1961 row's ALP
     50.50 is the near-miss election where Labor took the count and
     Menzies kept the seats). Primaries at two decimals like the era rows;
     oth folds DLP+rest at 1-dp.
       1961-12-09  ALP 47.90  LNP 42.09  oth 10.0 (DLP 8.71 + 1.29)  TPP 50.5/49.5
       1963-11-30  ALP 45.47  LNP 46.03  oth  8.5 (DLP 7.44 + 1.06)  TPP 47.4/52.6
       1966-11-26  ALP 39.98  LNP 49.98  oth 10.0 (DLP 7.31 + 1.45+1.27) TPP 43.1/56.9
   - cyclePolls buckets "1963", "1966", "1969" — keyed term-CLOSE year
     like the rest of cyclePolls — each opened with its closing "Election"
     sentinel row. Bucket "1966" additionally seeds the 1964-11-21 and
     1964-11-28 Morgan waves as CURATED rows: the mirror carries both as
     distinct fortnightly releases a week apart (its own "Exact date
     given" notes), but the assimilator's ±14d wave-match is symmetric in
     this date order, so seeding neither (or only one) drops the second;
     both are curated here and both mirror rows re-key against them by
     design (bootstrap-1969-cycle.mjs did the same for the 1972-11
     election-eve pair). The remaining F2F Morgan waves land via
     .build/assimilate-bonham-additional-aeforecasts.mjs — run it --apply
     AFTER this script (OLDEST_ELECTION and TPP_ERA_BY_BUCKET there have
     already moved, and bucketFor() needs these keys).
   - cycleApproval "1961", "1963", "1966" — EMPTY term-buckets (no GL
     data this far back; gen-data's CYCLE_DEFS loop dereferences the key).
   - cyclePollBases "1963|Morgan", "1966|Morgan", "1969|Morgan" — the
     provenance record for the implied FLOW_ERAS basis of each bucket's
     era rows (validate's 8c can never authority-check a printed-table
     basis that doesn't exist). */
import { readFileSync } from "node:fs";
import { writeAtomic } from "./atomic-write.mjs";

const APPLY = process.argv.includes("--apply");
const D = JSON.parse(readFileSync("data/polls.json", "utf8"));

const NEW = {
  e1961: { date: "1961-12-09", lnp: 42.09, alp: 47.90, grn: 0, onp: 0, oth: 10.0, tpp_lnp: 49.5, tpp_alp: 50.5 },
  e1963: { date: "1963-11-30", lnp: 46.03, alp: 45.47, grn: 0, onp: 0, oth: 8.5, tpp_lnp: 52.6, tpp_alp: 47.4 },
  e1966: { date: "1966-11-26", lnp: 49.98, alp: 39.98, grn: 0, onp: 0, oth: 10.0, tpp_lnp: 56.9, tpp_alp: 43.1 },
};

for (const k of Object.keys(NEW))
  if (D.elections[k]) throw new Error("bootstrap already applied: elections." + k + " exists");
for (const y of ["1963", "1966", "1969"])
  if (D.cyclePolls[y]) throw new Error("bootstrap already applied: cyclePolls." + y + " exists");
for (const y of ["1961", "1963", "1966"])
  if (D.cycleApproval[y]) throw new Error("bootstrap already applied: cycleApproval." + y + " exists");
for (const k of ["1963|Morgan", "1966|Morgan", "1969|Morgan"])
  if (D.cyclePollBases[k]) throw new Error("bootstrap already applied: cyclePollBases." + k + " exists");

/* elections — insert before e1969 (its tail has appended chronology since
   the 39de76c era import) */
{
  const out = {};
  for (const [k, v] of Object.entries(D.elections)) {
    if (k === "e1969") Object.assign(out, NEW);
    out[k] = v;
  }
  D.elections = out;
}

/* cyclePolls — buckets placed ahead of "1972" so the keys stay ascending */
{
  // 1964-11-21 & 1964-11-28 F2F Morgan Gallup, mirror-transcribed, exact
  // dates upstream; era-row shape (dem/dlp itemised, raw OTH, implied 2PP
  // through FLOW_ERAS[1963]: 47 + 0.1952·7 + 0.45·1 = 48.8 /
  // 48 + 0.1952·6 + 0.45·1 = 49.6)
  const curatedWaves = [
    {
      date: "1964-11-21", firm: "Morgan",
      lnp: 45, alp: 47, grn: null, onp: null,
      dem: null, dlp: 7, oth: 1,
      tpp_lnp: 51.2, tpp_alp: 48.8,
      tppEra: "1963",
    },
    {
      date: "1964-11-28", firm: "Morgan",
      lnp: 45, alp: 48, grn: null, onp: null,
      dem: null, dlp: 6, oth: 1,
      tpp_lnp: 50.4, tpp_alp: 49.6,
      tppEra: "1963",
    },
  ];
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
    if (k === "1972") {
      out["1963"] = [sentinel("1963")];
      out["1966"] = [...curatedWaves, sentinel("1966")];
      out["1969"] = [sentinel("1969")];
    }
    out[k] = v;
  }
  D.cyclePolls = out;
}

/* cycleApproval — empty term-open buckets, ahead of "1969" */
{
  const out = {};
  for (const [k, v] of Object.entries(D.cycleApproval)) {
    if (k === "1969") { out["1961"] = []; out["1963"] = []; out["1966"] = []; }
    out[k] = v;
  }
  D.cycleApproval = out;
}

/* provenance notes — the implied-2PP basis of each bucket's era rows,
   mirroring the existing notes with each era's own backtest figure */
const note = (open, bt) =>
  "F2F Morgan Gallup waves from the aeforecasts mirror (no live-poll metadata upstream). Morgan published no national 2PP this far back, so tpp is IMPLIED last-election-flows: primaries read through the "
  + open + " election's calibrated constants (FLOW_ERAS[" + open + "] in flows.mjs, anchored to that election's official 2PP – the Kevin Bonham Wonk Central method; right-edge backtest "
  + bt + " vs official, inside the ±0.6 pre-1983 LEF error budget quoted in the piece). Democrats/DLP primaries are itemised in dem/dlp row fields (the era's changeable minor-party print conventions make folding them into oth unreliable); the tppEra row tag names the era set used.";

D.cyclePollBases["1963|Morgan"] = note("1961", "+0.27");
D.cyclePollBases["1966|Morgan"] = note("1963", "−0.47");
D.cyclePollBases["1969|Morgan"] = note("1966", "−0.02");

const summary = { elections: Object.keys(NEW).length, buckets: 3, approvalBuckets: 3, bases: 3 };
console.log("bootstrap-1961-66 " + (APPLY ? "APPLY" : "dry-run") + ": " + JSON.stringify(summary));
if (APPLY) {
  writeAtomic("data/polls.json", JSON.stringify(D, null, 2) + "\n");
  console.log("wrote data/polls.json");
}
