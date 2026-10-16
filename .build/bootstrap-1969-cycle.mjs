#!/usr/bin/env node
/* bootstrap-1969-cycle.mjs — one-time structural edit of data/polls.json
   for the 1969 past-cycle (term 1969-10-25 → 1972-12-02), the trial of the
   pre-1972 extension. Refuses to re-run if any of its artefacts already
   exist, so a second invocation is a clean no-op: this is a DATA edit, not
   a migration runner. Modelled on bootstrap-pre1987-cycles.mjs (39de76c).

     node .build/bootstrap-1969-cycle.mjs          # dry-run (default)
     node .build/bootstrap-1969-cycle.mjs --apply  # write polls.json

   Adds:
   - elections.e1969 — official counts. Primaries per the Parliamentary
     Library cut (ALP 46.95, Coalition 43.33 — Liberal 34.77 + Country
     8.56 — DLP 6.02, others 3.70), two-party per the AEC TPP series
     (aec.gov.au/Elections/Federal_Elections/tpp-results.htm). Primaries
     carried as the AEC two-decimal first-preference shares like every
     elections row (alp 46.95, lnp 43.33), oth at 1-dp (9.7 from
     6.02+3.70=9.72), tpp 50.2/49.8.
     Cross-checked against the repo's own data/roymorgan-{primary-vote,
     two-party-preferred} election anchor rows.
   - cyclePolls bucket "1972" — keyed term-CLOSE year like the rest of
     cyclePolls (this is cycle 1969's data home; CYC_META.src 1972) —
     seeded with THREE rows: the closing "Election" sentinel built from
     e1972, and the final fortnight's pair of Morgan waves (1972-11-15
     and election-eve 1972-11-25) as CURATED rows. The mirror carries
     both as distinct fortnightly waves, but the assimilator's ±14d
     wave-match is symmetric in this date order — seeding only 11-25
     drops the 11-15 insert, seeding only 11-15 drops 11-25, and
     seeding neither drops whichever comes second — so BOTH are
     curated here and both mirror rows re-key against them by design
     (the accuracy panel's 14-day window needs the terminal wave). The
     other 19 F2F Morgan waves (1969-12 … 1972-10-15) land via
     .build/assimilate-bonham-additional-aeforecasts.mjs (run it --apply
     AFTER this script: OLDEST_ELECTION and TPP_ERA_BY_BUCKET there have
     already moved for 1969, and bucketFor() needs the "1972" key).
   - cycleApproval "1969" — EMPTY term-bucket (no GL data this far back;
     gen-data's CYCLE_DEFS loop dereferences the key).
   - cyclePollBases "1972|Morgan" — the provenance record for the implied
     FLOW_ERAS[1969] basis of the era rows (validate's 8c can never
     authority-check a printed-table basis that doesn't exist). */
import { readFileSync } from "node:fs";
import { writeAtomic } from "./atomic-write.mjs";

const APPLY = process.argv.includes("--apply");
const D = JSON.parse(readFileSync("data/polls.json", "utf8"));

const E1969 = { date: "1969-10-25", lnp: 43.33, alp: 46.95, grn: 0, onp: 0, oth: 9.7, tpp_lnp: 49.8, tpp_alp: 50.2 };

if (D.elections.e1969) throw new Error("bootstrap already applied: elections.e1969 exists");
if (D.cyclePolls["1972"]) throw new Error("bootstrap already applied: cyclePolls.1972 exists");
if (D.cycleApproval["1969"]) throw new Error("bootstrap already applied: cycleApproval.1969 exists");
if (D.cyclePollBases["1972|Morgan"]) throw new Error("bootstrap already applied: cyclePollBases.1972|Morgan exists");

/* elections — insert e1969 immediately before e1972 (the tail is appended
   chronology since the 39de76c era import) */
{
  const out = {};
  for (const [k, v] of Object.entries(D.elections)) {
    if (k === "e1972") out.e1969 = E1969;
    out[k] = v;
  }
  D.elections = out;
}

/* cyclePolls — bucket "1972" seeded with the curated final-fortnight
   Morgan pair and the closing Election sentinel (see header), placed
   ahead of "1974" so the keys stay ascending */
{
  const close = D.elections.e1972;
  // 1972-11-15 & 1972-11-25 F2F Morgan Gallup, mirror-transcribed;
  // era-row shape (dem/dlp itemised, raw OTH, implied 2PP through
  // FLOW_ERAS[1969]: 49 + 0.2633·5 + 0.45·5 = 52.6 / 50 + 0.2633·5 +
  // 0.45·3 = 52.7)
  const curatedWaves = [
    {
      date: "1972-11-15", firm: "Morgan",
      lnp: 41, alp: 49, grn: null, onp: null,
      dem: null, dlp: 5, oth: 5,
      tpp_lnp: 47.4, tpp_alp: 52.6,
      tppEra: "1969",
    },
    {
      date: "1972-11-25", firm: "Morgan",
      lnp: 42, alp: 50, grn: null, onp: null,
      dem: null, dlp: 5, oth: 3,
      tpp_lnp: 47.3, tpp_alp: 52.7,
      tppEra: "1969",
    },
  ];
  const sentinel = {
    date: close.date, firm: "Election",
    lnp: close.lnp, alp: close.alp, grn: 0, onp: 0, oth: close.oth,
    tpp_lnp: close.tpp_lnp, tpp_alp: close.tpp_alp,
  };
  const out = {};
  for (const [k, v] of Object.entries(D.cyclePolls)) {
    if (k === "1974") out["1972"] = [...curatedWaves, sentinel];
    out[k] = v;
  }
  D.cyclePolls = out;
}

/* cycleApproval — empty term-open bucket for cycle 1969, ahead of "1972" */
{
  const out = {};
  for (const [k, v] of Object.entries(D.cycleApproval)) {
    if (k === "1972") out["1969"] = [];
    out[k] = v;
  }
  D.cycleApproval = out;
}

/* provenance note — the implied-2PP basis of the era rows, mirroring the
   existing 1974+ notes but with this era's own backtest figure */
D.cyclePollBases["1972|Morgan"] =
  "F2F Morgan Gallup waves from the aeforecasts mirror (no live-poll metadata upstream). Morgan published no national 2PP this far back, so tpp is IMPLIED last-election-flows: primaries read through the 1969 election's calibrated constants (FLOW_ERAS[1969] in flows.mjs, anchored to that election's official 2PP – the Kevin Bonham Wonk Central method; right-edge backtest −0.07 vs official, inside the ±0.6 pre-1983 LEF error budget quoted in the piece). Democrats/DLP primaries are itemised in dem/dlp row fields (the era's changeable minor-party print conventions make folding them into oth unreliable); the tppEra row tag names the era set used.";

const summary = { elections: "+e1969", bucket: "+1972", approvalBucket: "+1969", bases: 1 };
console.log("bootstrap-1969 " + (APPLY ? "APPLY" : "dry-run") + ": " + JSON.stringify(summary));
if (APPLY) {
  writeAtomic("data/polls.json", JSON.stringify(D, null, 2) + "\n");
  console.log("wrote data/polls.json");
}
