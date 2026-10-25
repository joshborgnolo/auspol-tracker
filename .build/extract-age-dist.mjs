#!/usr/bin/env node
/* extract-age-dist.mjs — build data/age-dist.json: Australia's adults by
   single year of age, the population the Who-votes Age tab reads every
   house's age bands along (gen-data §7g-age, demo-groups' ageStandardise).
   A house whose bands don't meet the common 18–34 / 35–54 / 55+ (Newspoll's
   35–49 / 50–64 / 65+, YouGov's 35–49 / 50+) has each party's cumulative
   vote laid along the adults' age axis through its printed cells and read
   at the common edges; these counts are how many adults each year holds.

   Source: ABS Estimated Resident Population by single year of age (ERP_Q,
   persons, Australia), the latest quarter the data API serves. Residents,
   not citizens: no single-year citizenship cross is published between
   censuses, and the axis only places edges inside a printed band – where a
   house's edge already meets a common one, nothing here is used.
   Age 100 is the ERP's 100-and-over.
   Refresh: rerun whenever – the age profile moves a fraction of a point a
   year. */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const API = "https://data.api.abs.gov.au/rest/data/ABS,ERP_Q,1.0.0/1.3..AUS.Q?startPeriod=2025-Q1";

const res = await fetch(API, { headers: { Accept: "application/vnd.sdmx.data+csv" } });
if (!res.ok) throw new Error(`ABS data API ${res.status}`);
const rows = (await res.text()).trim().split(/\r?\n/).slice(1).map((l) => l.split(","));
// DATAFLOW,MEASURE,SEX,AGE,REGION,FREQ,TIME_PERIOD,OBS_VALUE,…
const quarter = rows.map((r) => r[6]).sort().at(-1);
const counts = new Array(101).fill(null);
for (const r of rows) if (r[6] === quarter && /^\d+$/.test(r[3]) && +r[3] <= 100) counts[+r[3]] = +r[7];
if (counts.slice(18).some((c) => !(c > 0))) throw new Error(`ERP ${quarter}: missing single years`);

const out = {
  _about: "Australia's adults by single year of age, for the Who-votes Age tab's reading of every house's age bands at the common 18–34 / 35–54 / 55+ (gen-data §7g-age, demo-groups ageStandardise). ABS ERP_Q, persons, Australia; adults[i] is age 18 + i, the last entry the ERP's 100-and-over. Residents, not citizens. Built by .build/extract-age-dist.mjs.",
  source: `ABS ERP_Q ${quarter}, data API`,
  quarter,
  from: 18,
  adults: counts.slice(18),
};
writeFileSync(path.join(ROOT, "data", "age-dist.json"), JSON.stringify(out) + "\n");
console.log(`data/age-dist.json: ERP ${quarter}, ${out.adults.length} single years, ${out.adults.reduce((a, b) => a + b, 0).toLocaleString()} adults`);
