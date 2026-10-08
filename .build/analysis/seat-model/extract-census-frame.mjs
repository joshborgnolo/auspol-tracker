#!/usr/bin/env node
/* extract-census-frame.mjs — W1 of .build/analysis/seat-model-plan.md.
   Build data/census-2021-divisions.json: per-division 2021 Census counts for
   the demographic dims the seat model's β exposure layer needs.

   Source: ABS 2021 Census General Community Profile, Commonwealth Electoral
   Divisions (datapack, short-header). The 2021 CED structure is the 151
   divisions the 2022 election was fought on — which is exactly what the
   §Validation.3 holdout (as-of-April-2025 model, 2022 baseline) needs.
   Mapping those 151 to the 150 divisions the 2025 election was fought on is
   a separate, documented approximation step (W1b, with W8's redistribution
   work); it is NOT done here.

   Emitted cells are RAW COUNTS (and G02 medians), not shares — normalising
   bases (adults 18+, persons 15+, households) is model-layer business; poll
   bracket vocabularies vary by house and by wave, so the frame keeps census
   granularity and lets the model compose.

   Dims and their source tables (bases ABS-defines):
     age/gender/language   G01   (persons, usual residence)
     medians               G02   (division-level medians)
     income bands          G17B+G17C (persons 15+, weekly personal income)
     tenure                G37   (occupied private dwellings)
     education             G43   (persons 15+, non-school qualification)

   Cache: .build/analysis/seat-model/cache/gcp-ced/ (gitignored). --fetch
   refreshes it. Run from the repo root:
     node .build/analysis/seat-model/extract-census-frame.mjs [--fetch]
   Then: node .build/analysis/seat-model/test-census-frame.mjs  */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const URL = "https://www.abs.gov.au/census/find-census-data/datapacks/download/2021_GCP_CED_for_AUS_short-header.zip";
const DIR = ".build/analysis/seat-model/cache/gcp-ced";
const ZIP = DIR + ".zip";
const SUB = "2021 Census GCP Commonwealth Electroral Division for AUS"; // ABS's own misspelling, yes
const TABLES = ["G01", "G02", "G17B", "G17C", "G37", "G43"];
// G17 spills its P (persons) income columns across G17B (bands up to 500_649)
// and G17C (650_799 up + totals); G17A is male/female only.
const OUT = "data/census-2021-divisions.json";
const NAMES = ".build/analysis/seat-model/src/ced-2021-names.json";

if (process.argv.includes("--fetch") || !existsSync(DIR)) {
  mkdirSync(DIR, { recursive: true });
  console.log("fetching ABS datapack…");
  execFileSync("curl", ["-sL", "--fail", "-o", ZIP, URL], { stdio: "inherit" });
  execFileSync("unzip", ["-q", "-o", ZIP, "-d", DIR], { stdio: "inherit" });
}

const sha256 = (f) => createHash("sha256").update(readFileSync(f)).digest("hex");
const rowsOf = (t) => {
  const lines = readFileSync(`${DIR}/${SUB}/2021Census_${t}_AUST_CED.csv`, "utf8").trim().split(/\r?\n/);
  const head = lines[0].split(",");
  return lines.slice(1).map((l) => Object.fromEntries(l.split(",").map((c, i) => [head[i], c])));
};
const table = Object.fromEntries(TABLES.map((t) => [t, new Map(rowsOf(t).map((r) => [r.CED_CODE_2021, r]))]));
const num = (row, key) => { const v = Number(row?.[key]); return Number.isFinite(v) ? v : 0; };

const STE = { 1: "NSW", 2: "VIC", 3: "QLD", 4: "SA", 5: "WA", 6: "TAS", 7: "NT", 8: "ACT" };
const names = JSON.parse(readFileSync(NAMES, "utf8")).divisions
  .filter((d) => !/usual|Migratory/i.test(d.name));

const AGE_BANDS = ["0_4", "5_14", "15_19", "20_24", "25_34", "35_44", "45_54", "55_64", "65_74", "75_84"]; // Age_85ov_P has no _yr infix
const INCOME_BANDS = ["Neg_Nil_income", "1_149", "150_299", "300_399", "400_499", "500_649",
  "650_799", "800_999", "1000_1249", "1250_1499", "1500_1749", "1750_1999",
  "2000_2999", "3000_3499", "3500_more"];

const divisions = names.map(({ code, name }) => {
  const g01 = table.G01.get(code), g02 = table.G02.get(code),
        g17b = table.G17B.get(code), g17c = table.G17C.get(code),
        g37 = table.G37.get(code), g43 = table.G43.get(code);
  if (!g01 || !g17b || !g17c || !g37 || !g43) throw new Error(`missing table rows for ${code} ${name}`);
  const g17 = { ...g17b, ...g17c };
  return {
    code, name, state: STE[code[3]],
    persons: num(g01, "Tot_P_P"),
    gender: { m: num(g01, "Tot_P_M"), f: num(g01, "Tot_P_F") },
    ageCounts: Object.fromEntries([
      ...AGE_BANDS.map((b) => [b, num(g01, `Age_${b}_yr_P`)]),
      ["85ov", num(g01, "Age_85ov_P")],
    ]),
    persons15Plus: num(g43, "P_15_yrs_over_P"),
    englishOnlyHome: num(g01, "Lang_used_home_Eng_only_P"),
    incomeWeeklyPersons15: {
      bands: Object.fromEntries(INCOME_BANDS.map((b) => [b, num(g17, `P_${b}_Tot`)])),
      notStated: num(g17, "P_PI_NS_ns_Tot"), total: num(g17, "P_Tot_Tot"),
    },
    tenureDwellings: {
      ownOutright: num(g37, "O_OR_Total"), mortgage: num(g37, "O_MTG_Total"),
      rented: num(g37, "R_Tot_Total"), otherTenure: num(g37, "Oth_ten_type_Total"),
      notStated: num(g37, "Ten_type_NS_Total"), total: num(g37, "Total_Total"),
    },
    education15Plus: {
      postgrad: num(g43, "non_sch_qual_PostGrad_Dgre_P"), gradDipCert: num(g43, "non_sch_qual_Gr_Dip_Gr_Crt_P"),
      bachelor: num(g43, "non_sch_qual_Bchelr_Degree_P"), advDiploma: num(g43, "non_sch_qual_Advnd_Dip_Dip_P"),
      cert34: num(g43, "non_sch_qual_Cert3a4_Level_P"), cert12: num(g43, "non_sch_qual_Cert1a2_Level_P"),
      nfd: num(g43, "non_sch_qual_Certnfd_Level_P"),
    },
    medians: {
      age: num(g02, "Median_age_persons"), personalIncWeekly: num(g02, "Median_tot_prsnl_inc_weekly"),
      householdIncWeekly: num(g02, "Median_tot_hhd_inc_weekly"), familyIncWeekly: num(g02, "Median_tot_fam_inc_weekly"),
      mortgageMonthly: num(g02, "Median_mortgage_repay_monthly"), rentWeekly: num(g02, "Median_rent_weekly"),
      householdSize: num(g02, "Average_household_size"), personsPerBedroom: num(g02, "Average_num_psns_per_bedroom"),
    },
  };
});

const out = {
  _about: "W1 of .build/analysis/seat-model-plan.md — 2021 Census demographic frame per federal division (151 divisions = the 2022-election boundaries; the census CED structure). Raw counts, not shares: model layer composes poll-aligned buckets. Bases: income/education are persons 15+, tenure is occupied private dwellings, the rest persons. ageCounts are ABS bands incl. 15_19/20_24 — the 18+ approximation (16–17 excluded) lives in the model layer. Built by .build/analysis/seat-model/extract-census-frame.mjs; pinned by test-census-frame.mjs. Refresh: rerun with --fetch; when the 2026 Census releases (~June 2027) build census-2026-divisions.json beside this rather than overwriting.",
  _provenance: { source: URL, zipSha256: sha256(ZIP), tables: TABLES, extractedAt: new Date().toISOString().slice(0, 10) },
  divisions,
};
writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n");
console.log(`wrote ${OUT}: ${divisions.length} divisions`);
