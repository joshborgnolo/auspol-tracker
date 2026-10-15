#!/usr/bin/env node
/* extract-income-dist.mjs — build data/income-dist.json: the national weekly
   INCOME HISTOGRAMS the Who-votes Income tab's standardised pooling needs
   (gen-data §7g-income, the 2026-10-16 latent-curve redesign of 8acacb93's
   naive extreme-band tilts): every house's printed income brackets are
   mapped onto the electorate's income-quantile axis through these, then a
   weighted least-squares line per party per wave is read at common bands
   (bottom 50%, top 15%).

   Two axes, each a national histogram of weekly income in 2021 census
   dollars:
     household  G33 (occupied private dwellings, family + non-family totals)
     personal   G17B+G17C (persons 15+, weekly personal income)
   Source: ABS 2021 Census General Community Profile, Commonwealth Electoral
   Divisions short-header datapack — the SAME zip extract-census-frame.mjs
   caches, shared from its dir (fresh fetch when absent, or --fetch).

   Method notes carried into _about:
   - National histogram = sum of `_Tot` columns over every CED row.
     Not-stated rows (personal PI_NS; household Partial/All-not-stated) are
     dropped, so shares are of those stating an income — matching the polls
     (a prefer-not-to-say income row never joins a vote grid either).
   - Negative/Nil income merges into the $1–149 band ($0–149 from here).
   - gen-data maps a poll's annual-$ bracket edges into census-weekly 2021
     dollars via ×1000/52.142857/AWE_RATIO and interpolates uniformly within
     histogram bands.
   - AWE_RATIO indexes the 2021-dollar axis to current nominal dollars:
     average weekly ordinary time earnings, full-time adults, seasonally
     adjusted (ABS 6302.0), May 2021 $1,737.10 → May 2026 $2,083.00
     (same-quarter comparison, verified 2026-10-16). The household axis uses
     the same ratio — household income growth is not AWE's headline, but any
     plausible alternative lies within the error the histogram interpolation
     already carries, so one indexed constant beats two fake-precise ones.
   Refresh: rerun with --fetch on the 2026-census datapack's arrival (and
   re-verify AWE_RATIO); nothing else schedules it. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = path.join(ROOT, ".build", "analysis", "seat-model", "cache", "gcp-ced");
const ZIP = DIR + ".zip";
const URL = "https://www.abs.gov.au/census/find-census-data/datapacks/download/2021_GCP_CED_for_AUS_short-header.zip";
const SUB = "2021 Census GCP Commonwealth Electroral Division for AUS"; // ABS's own misspelling
const AWE_MAY2021 = 1737.10, AWE_MAY2026 = 2083.00; // ABS 6302.0 s.a. FT-adult ordinary time
const WEEKS = 365.25 / 7;

if (!existsSync(DIR) || process.argv.includes("--fetch")) {
  mkdirSync(DIR, { recursive: true });
  console.log("fetching ABS 2021 GCP datapack (shared with the seat-model cache)…");
  execFileSync("curl", ["-sL", "--fail", "-o", ZIP, URL], { stdio: "inherit" });
  execFileSync("unzip", ["-q", "-o", ZIP, "-d", DIR], { stdio: "inherit" });
}

const csv = (t) => {
  const f = path.join(DIR, SUB, `2021Census_${t}_AUST_CED.csv`);
  const lines = readFileSync(f, "utf8").trim().split(/\r?\n/);
  const head = lines[0].split(",");
  const idx = new Map(head.map((h, i) => [h, i]));
  return { lines: lines.slice(1), idx };
};
// national sum of one column over every division row
const sumCol = ({ lines, idx }, name) => {
  const i = idx.get(name);
  if (i == null) throw new Error(`column ${name} not found`);
  let n = 0;
  for (const l of lines) { const v = Number(l.split(",")[i]); if (Number.isFinite(v)) n += v; }
  return n;
};
const g17 = [csv("G17B"), csv("G17C")], g33 = csv("G33");
/* G17's bands split across G17B and G17C – skip the table not carrying one */
const pSum = (name) => {
  const hits = g17.filter((t) => t.idx.has(name));
  if (!hits.length) throw new Error(`column ${name} not found in G17B/G17C`);
  return hits.reduce((a, t) => a + sumCol(t, name), 0);
};

/* [{ lo, hi, n }], weekly 2021 dollars, open top as hi: null. Personal adds
   a 3000_3499 band before its open top; household's top is 4000+. G17B's
   Negative/Nil and 1–149 columns merge into the $0–149 band. */
const personal = [["P_Neg_Nil_income_Tot,P_1_149_Tot", 0, 149], ["P_150_299_Tot", 150, 299],
  ["P_300_399_Tot", 300, 399], ["P_400_499_Tot", 400, 499], ["P_500_649_Tot", 500, 649],
  ["P_650_799_Tot", 650, 799], ["P_800_999_Tot", 800, 999], ["P_1000_1249_Tot", 1000, 1249],
  ["P_1250_1499_Tot", 1250, 1499], ["P_1500_1749_Tot", 1500, 1749], ["P_1750_1999_Tot", 1750, 1999],
  ["P_2000_2999_Tot", 2000, 2999], ["P_3000_3499_Tot", 3000, 3499], ["P_3500_more_Tot", 3500, null]]
  .map(([cols, lo, hi]) => ({ lo, hi, n: cols.split(",").reduce((a, c) => a + pSum(c), 0) }));

const household = [["HI_1_149_Tot", 0, 149], ["HI_150_299_Tot", 150, 299], ["HI_300_399_Tot", 300, 399],
  ["HI_400_499_Tot", 400, 499], ["HI_500_649_Tot", 500, 649], ["HI_650_799_Tot", 650, 799],
  ["HI_800_999_Tot", 800, 999], ["HI_1000_1249_Tot", 1000, 1249], ["HI_1250_1499_Tot", 1250, 1499],
  ["HI_1500_1749_Tot", 1500, 1749], ["HI_1750_1999_Tot", 1750, 1999], ["HI_2000_2499_Tot", 2000, 2499],
  ["HI_2500_2999_Tot", 2500, 2999], ["HI_3000_3499_Tot", 3000, 3499], ["HI_3500_3999_Tot", 3500, 3999],
  ["HI_4000_more_Tot", 4000, null]].map(([b, lo, hi]) => ({ lo, hi, n: sumCol(g33, b) }));
household[0].n += sumCol(g33, "Negative_Nil_income_Tot");

const total = (bands) => bands.reduce((a, b) => a + b.n, 0);
const out = {
  aweRatio: +(AWE_MAY2026 / AWE_MAY2021).toFixed(4),
  weeksPerYear: +WEEKS.toFixed(5),
  axes: {
    household: { base: "occupied private dwellings, weekly household income ($2021)", bands: household, total: total(household) },
    personal: { base: "persons 15+, weekly personal income ($2021)", bands: personal, total: total(personal) },
  },
  _about: "National weekly-income histograms for the Who-votes Income tab's standardised pooling (gen-data §7g-income): 2021 Census GCP commonwealth-electoral-division sums (household G33, personal G17B+G17C; not-stated dropped, Negative/Nil folded into $0–149), $ axis wage-indexed 2021→2026 by aweRatio = AWE(ABS 6302.0 s.a. full-time adult ordinary time) May 2026 $2,083.00 / May 2021 $1,737.10 (the household axis rides the same ratio — one indexed constant, honestly labelled, rather than two fake-precise ones). Poll brackets map in by edge×1000/weeksPerYear/aweRatio with uniform interpolation inside histogram bands; above the open top band an edge saturates to quantile 1. Built by .build/extract-income-dist.mjs; refresh with --fetch on a new census datapack (2026 census ~June 2027) and re-verify aweRatio.",
};
writeFileSync(path.join(ROOT, "data", "income-dist.json"), JSON.stringify(out, null, 1) + "\n");
const med = (ax) => {
  let cum = 0;
  for (const b of ax.bands) { cum += b.n; if (cum >= ax.total / 2) return `${b.lo}–${b.hi ?? "∞"}`; }
};
console.log(`wrote data/income-dist.json — aweRatio ${out.aweRatio}; household n=${total(household).toLocaleString()} (median band ${med(out.axes.household)}), personal n=${total(personal).toLocaleString()} (median band ${med(out.axes.personal)})`);
