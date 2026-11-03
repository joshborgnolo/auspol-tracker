#!/usr/bin/env node
/* extract-demographics-2025-election.mjs – the houses' published group tables from the weeks before the 2025
   federal election, for Who votes for whom's "since the election" baseline (gen-data §7g DEMO_ELECTION).

   Why: data/demographics.json starts after the election, so until 2026-11-03 the site measured "since the
   election" against the Australian Election Study 2025 – another instrument. Before the election the polls
   already read several groups differently from the AES, by more than both margins, and they did so all term
   (.build/analysis/group-poll-error-2025, README §2). Each poll is now measured from the same polls at the
   election. The AES stays on the charts as its own reading, and generations still use it, because no house cut
   generations before the election.

   Source: Poll Bludger's BludgerTrack poll table for the 2022–25 term, copied into the repo as
   .build/analysis/group-poll-error-2025/bludgertrack-2022-25.json (its extract-bludgertrack.mjs re-fetches
   pollbludger.net/fed2025/bludgertrack/xml/current.xml). The feed keeps each house's printed crosstabs per
   release. The release checks are that folder's lib.mjs:
     - a release is dropped if its gender or age cells' samples sum more than 10% from its n (YouGov 14–19 Mar
       2025's cells are shuffled);
     - a cell is dropped if its primaries imply a 2PP more than 4 points from the 2PP printed beside it
       (Newspoll's pooled renters, Mar–Apr 2025).

   Kept: releases ending 1 Mar – 2 May 2025 (gen-data's six-week window ending on election day takes what it
   needs), the sets the AES test covers plus language:
     gender     Men, Women
     age        18–34, 35–49, 50–64, 65+ as printed (gen-data reads 35–54 and 55+ off them, as it reads these
                houses' bands today)
     education  Year 12 or less (printed "No tertiary"), TAFE or trade ("TAFE/Tech"), University
     housing    Own outright, Mortgage, Renting
     working    Full time, Part time, Retired, Other (Other joins no group, as today)
     language   English only, Other language ("LOTE")
   State and location are left out: their baseline is the AEC count. Income is left out: its standardiser's
   grids are keyed to the houses' post-election brackets.

   Shares are decided voters' (a printed undecided is taken out), One Nation and others only where the house
   printed One Nation (RedBridge's crosstabs carry none: both null, never a fold). `total` is the release's
   all-voters row (its national figures, or Newspoll's men and women combined). Newspoll's pooled quarter
   carries its fortnightly waves as `parts` (their samples sum to the pool's n), so gen-data reads it as those
   waves, as it reads every Newspoll (pooled) release.

   Run from the repo root:  node .build/extract-demographics-2025-election.mjs
   Writes data/demographics-2025-election.json. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { releases, J } from "./analysis/group-poll-error-2025/lib.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FROM = "2025-03-01", TO = "2025-05-02";
const SITE_NAME = { Newspoll: "Newspoll (pooled)", YouGov: "YouGov", RedBridge: "RedBridge/Accent", Resolve: "Resolve", Essential: "Essential", DemosAU: "DemosAU" };
const DIMS = {
  gender: { Male: "Men", Female: "Women" },
  age: { "Age 18-34": "18–34", "Age 35-49": "35–49", "Age 50-64": "50–64", "Age 65+": "65+" },
  education: { "No tertiary": "Year 12 or less", "TAFE/Tech": "TAFE or trade", University: "University" },
  housing: { "Own outright": "Own outright", Mortgage: "Mortgage", Rent: "Renting" },
  working: { "Full time": "Full time", "Part time": "Part time", Retired: "Retired", Other: "Other" },
  language: { "English only": "English only", LOTE: "Other language" },
};
const KEYS = ["alp", "lnp", "grn", "onp", "oth"];
const r1 = (x) => (x == null ? null : Math.round(x * 10) / 10);
const cellOf = (s) => Object.fromEntries(KEYS.map((k) => [k, r1(s[k])]));

const BT = J(".build/analysis/group-poll-error-2025/bludgertrack-2022-25.json");
const { list } = releases();
const waves = [], dropped = [];
for (const R of list) {
  if (!SITE_NAME[R.house] || R.end < FROM || R.end > TO) continue;
  const dims = {};
  for (const [dim, map] of Object.entries(DIMS)) {
    for (const [scope, label] of Object.entries(map)) {
      const c = R.cells[scope];
      if (!c) continue;
      if (c.flags.length) { dropped.push(`${R.house} ${R.start}..${R.end} ${scope}: ${c.flags.join("; ")}`); continue; }
      (dims[dim] ||= {})[label] = cellOf(c.s);
    }
  }
  if (!Object.keys(dims).length) continue;
  if (R.flags.length) { dropped.push(`${R.house} ${R.start}..${R.end}: ${R.flags.join("; ")}`); continue; }
  if (!R.all) { dropped.push(`${R.house} ${R.start}..${R.end}: no all-voters row`); continue; }
  const w = { pollster: SITE_NAME[R.house], date: R.end, dateStart: R.start, sample: R.all.n, total: cellOf(R.all.s) };
  if (R.house === "Newspoll") {
    // a pooled quarter: its fortnightly waves inside the dates, samples summing to the pool's n
    const parts = BT.rows.filter((r) => r.pollster === "Newspoll" && r.scope === "NAT" && r.start >= R.start && r.end <= R.end && r.n)
      .map((r) => ({ dateStart: r.start, date: r.end, sample: r.n }));
    const sum = parts.reduce((a, q) => a + q.sample, 0);
    if (!parts.length || Math.abs(sum - R.all.n) > 0.01 * R.all.n) { dropped.push(`Newspoll ${R.start}..${R.end}: parts sum ${sum} of ${R.all.n}`); continue; }
    w.parts = parts;
  }
  w.dims = dims;
  waves.push(w);
}
waves.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.pollster < b.pollster ? -1 : 1));
const out = {
  _about: "Each house's published group tables from the weeks before the 2025 federal election (fieldwork ending 1 Mar – 2 May 2025), copied from BludgerTrack's 2022–25 poll table by .build/extract-demographics-2025-election.mjs – see its header. Shares are decided voters' (%); onp/oth null where the house printed no One Nation; total = the release's all-voters row; parts = a pooled release's own waves. gen-data §7g pools these over the six weeks ending on election day as it pools the current figures, and measures 'since the election' from them.",
  source: BT.source,
  feedDate: BT.feedDate,
  election: "2025-05-03",
  waves,
};
const dst = path.join(ROOT, "data", "demographics-2025-election.json");
fs.writeFileSync(dst, JSON.stringify(out, null, 1) + "\n");
console.log(`wrote ${path.relative(ROOT, dst)}: ${waves.length} releases (${[...new Set(waves.map((w) => w.pollster))].join(", ")})`);
for (const d of dropped) console.log("  dropped " + d);
