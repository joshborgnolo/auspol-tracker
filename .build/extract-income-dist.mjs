#!/usr/bin/env node
/* extract-income-dist.mjs — build data/income-dist.json: the national weekly
   INCOME HISTOGRAMS of voting-age adults that the Who-votes Income tab's
   standardised pooling needs (gen-data §7g-income). Every house's printed
   income brackets are mapped onto the electorate's income-quantile axis
   through these, then a weighted least-squares line per party per wave is
   read at common bands (bottom 50%, top 15%).

   Two axes, each a national histogram of ADULTS (18+) over weekly income in
   2021 census dollars – a poll's respondent is one adult, so a quantile of
   the electorate is a share of adults, not of households:
     household  adults by their household's income: G33 (households by
                income, family v non-family) re-weighted by adults per
                household, below
     personal   adults by their own income: G17B+G17C (persons 15+) less
                the 15–17-year-olds
   Source: ABS 2021 Census General Community Profile, Commonwealth Electoral
   Divisions short-header datapack – the SAME zip extract-census-frame.mjs
   caches, shared from its dir (fresh fetch when absent, or --fetch).

   Adults per household (the GCP carries no persons-by-household-income
   table; TableBuilder's HIND × AGEP person count is the exact one and needs
   an ABS login):
   - Family households in an income band carry that band's family mix from
     G32 (family income by composition: couple without children, couple with
     children, one parent, other family), each family type's adults from
     G27 (relationship in household by age): 2 partners or 1 lone parent;
     adult children (non-dependent children, plus dependent students 15–24
     less the 15–17-year-olds, G04 single years) spread over the families
     with children; other related and unrelated adults spread over every
     family. A family's income band stands in for its household's.
   - Non-family households all carry the national mean of adults per
     non-family household (G27 lone persons + group-household members over
     G35's non-family households) – lone persons and group households are
     not split by income in the GCP.
   So the composition gradient (one-parent families and lone persons at the
   bottom, couples above) is in; the within-type gradient (adult children
   adding income) is not. Citizenship is not in either axis (no GCP cross).

   Method notes carried into _about:
   - National histogram = sum over every CED row. Not-stated rows (personal
     PI_NS; household Partial/All-not-stated) are dropped, so shares are of
     those stating an income – matching the polls (a prefer-not-to-say
     income row never joins a vote grid either). Partial-stated households
     (5% of households) lean larger, so the household axis sits slightly low.
   - Negative/Nil income merges into the $1–149 band ($0–149 from here).
   - 15–17-year-olds leave the personal axis in proportion to the 15–19
     band's income spread (the GCP's youngest income band is 15–19).
   - gen-data maps a poll's annual-$ bracket edges into census-weekly 2021
     dollars via ×1000/weeksPerYear and divides by the wage index at the
     wave's fieldwork midpoint: awe.series is ABS 6302.0 average weekly
     ordinary time earnings, full-time adults, seasonally adjusted (May and
     November, fetched from the ABS data API), awe.census that series at
     census night (10 Aug 2021, interpolated). Inside a histogram band the
     mass is uniform; inside the open top band it follows the Pareto tail
     the two bands below it imply.
   Refresh: rerun on each new AWE release (May/Nov, out Aug/Feb) to extend
   awe.series – gen-data extrapolates past its last point at the trailing
   year's growth until then. On the 2026-census datapack (~June 2027) the
   URL, SUB folder and every band column below change (ABS resets income
   ranges each census): rewrite those lists, rerun with --fetch, and move
   awe.census to 11 Aug 2026. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = path.join(ROOT, ".build", "analysis", "seat-model", "cache", "gcp-ced");
const ZIP = DIR + ".zip";
const URL = "https://www.abs.gov.au/census/find-census-data/datapacks/download/2021_GCP_CED_for_AUS_short-header.zip";
const SUB = "2021 Census GCP Commonwealth Electroral Division for AUS"; // ABS's own misspelling
const WEEKS = 365.25 / 7;
const CENSUS_DATE = "2021-08-10";
/* ABS 6302.0 AWE: MEASURE 3 (FT adult ordinary time) · ESTIMATE 1 · persons
   · all sectors · all industries · seasonally adjusted · Australia · half-
   yearly. S1 is May, S2 November (the survey's reference pay periods sit
   mid-month). */
const AWE_API = "https://data.api.abs.gov.au/rest/data/ABS,AWE,1.0.0/3.1.3.7.TOT.20.AUS.S?startPeriod=2021";
// the series as fetched 2026-10-18, used when the API is unreachable
const AWE_FALLBACK = [["2021-05-15", 1737.1], ["2021-11-15", 1748.4], ["2022-05-15", 1769.8],
  ["2022-11-15", 1807.7], ["2023-05-15", 1838.1], ["2023-11-15", 1888.8], ["2024-05-15", 1923.4],
  ["2024-11-15", 1975.8], ["2025-05-15", 2010], ["2025-11-15", 2051.1], ["2026-05-15", 2083.7]];

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
  return { lines: lines.slice(1), idx, head };
};
// national sum of one column over every division row
const sumCol = ({ lines, idx }, name) => {
  const i = idx.get(name);
  if (i == null) throw new Error(`column ${name} not found`);
  let n = 0;
  for (const l of lines) { const v = Number(l.split(",")[i]); if (Number.isFinite(v)) n += v; }
  return n;
};
// a column found among several tables (G17's and G27's bands split across parts)
const multi = (ts) => (name) => {
  const hits = ts.filter((t) => t.idx.has(name));
  if (!hits.length) throw new Error(`column ${name} not found`);
  return hits.reduce((a, t) => a + sumCol(t, name), 0);
};

/* ---- age: the 15–17s inside the census's 15–19 and 15–24 bands (G04) */
const ageSum = multi([csv("G04A"), csv("G04B")]);
const age = (y) => ageSum(`Age_yr_${y}_P`);
const n1517 = age(15) + age(16) + age(17), n1519 = n1517 + age(18) + age(19);

/* ---- personal axis: G17 persons 15+, less the 15–17s ---------------------- */
const g17 = multi([csv("G17B"), csv("G17C")]);
const g17h = [csv("G17B"), csv("G17C")].flatMap((t) => t.head);
const f1517 = n1517 / n1519;
// the band's 15–19 column: G17's short headers don't share one spelling
const col1519 = (tot) => {
  const stem = tot.replace(/_Tot$/, "");
  const c = g17h.find((h) => h.startsWith(stem) && /15_19/.test(h))
    || (stem === "P_Neg_Nil_income" ? g17h.find((h) => /^P_Neg/.test(h) && /15_19/.test(h)) : null);
  if (!c) throw new Error(`no 15–19 column for ${tot}`);
  return c;
};
const personal = [["P_Neg_Nil_income_Tot,P_1_149_Tot", 0, 149], ["P_150_299_Tot", 150, 299],
  ["P_300_399_Tot", 300, 399], ["P_400_499_Tot", 400, 499], ["P_500_649_Tot", 500, 649],
  ["P_650_799_Tot", 650, 799], ["P_800_999_Tot", 800, 999], ["P_1000_1249_Tot", 1000, 1249],
  ["P_1250_1499_Tot", 1250, 1499], ["P_1500_1749_Tot", 1500, 1749], ["P_1750_1999_Tot", 1750, 1999],
  ["P_2000_2999_Tot", 2000, 2999], ["P_3000_3499_Tot", 3000, 3499], ["P_3500_more_Tot", 3500, null]]
  .map(([cols, lo, hi]) => ({ lo, hi, n: Math.round(cols.split(",").reduce((a, c) => a + g17(c) - f1517 * g17(col1519(c)), 0)) }));

/* ---- adults per family type and per non-family household (G27, G32, G35) */
const g27 = multi([csv("G27A"), csv("G27B")]);
const rel = (r, band) => g27(`P_${r}_${band}`);
const over24 = (r) => rel(r, "Tot") - rel(r, "0_14") - rel(r, "15_24");
const f1824 = 1 - n1517 / (n1519 + age(20) + age(21) + age(22) + age(23) + age(24));
const couples = (rel("Ptn_in_RM", "Tot") + rel("Ptn_in_DFM", "Tot")) / 2;
// dependent students are 15–24; nearly every 15–17 is one (school), so the adults are the rest
const adultKids = Math.max(0, rel("DpStu", "15_24") - n1517) + rel("NDpChl", "Tot") - rel("NDpChl", "0_14");
const othAdults = ["OthRI", "URI_in_FH"].reduce((a, r) => a + over24(r) + f1824 * rel(r, "15_24"), 0);
const g32 = csv("G32"), g35 = csv("G35");
const famTot = { c0: sumCol(g32, "Tot_cpl_fam_no_child"), c1: sumCol(g32, "Tot_cpl_fam_wth_chld"),
  op: sumCol(g32, "Tot_One_parent_fam"), of: sumCol(g32, "Tot_Other_fam") };
const nFam = famTot.c0 + famTot.c1 + famTot.op + famTot.of;
const kidsPer = adultKids / (famTot.c1 + famTot.op), othPer = othAdults / nFam;
const ADULTS = { c0: 2 + othPer, c1: 2 + kidsPer + othPer, op: 1 + kidsPer + othPer, of: 2 + othPer };
const nonFamHh = sumCol(g35, "Total_NonFamHhold");
const nonFamAdults = (rel("LonePsn", "Tot") - rel("LonePsn", "0_14") + rel("GrpH_Mem", "Tot") - rel("GrpH_Mem", "0_14")) / nonFamHh;

/* ---- household axis: G33 households, each band's adults ------------------- */
const g33 = csv("G33");
const hcol = (stem, kind) => {
  const c = g33.head.find((h) => h.startsWith(stem + "_") && (kind === "non" ? /Non/i.test(h) : /fam/i.test(h) && !/Non/i.test(h)));
  if (!c) throw new Error(`no G33 ${kind} column for ${stem}`);
  return c;
};
const fcols = (stem) => {
  const cs = g32.head.filter((h) => h.startsWith(stem + "_") && !/_Tot$/.test(h));
  const pick = (re) => { const c = cs.find((h) => re.test(h)); if (!c) throw new Error(`no G32 column ${re} for ${stem}`); return c; };
  return { c0: pick(/no_child/), c1: pick(/(with|wth)_ch/), op: pick(/One_parent/), of: pick(/Other_fam/) };
};
const HBANDS = [[0, 149], [150, 299], [300, 399], [400, 499], [500, 649], [650, 799], [800, 999],
  [1000, 1249], [1250, 1499], [1500, 1749], [1750, 1999], [2000, 2499], [2500, 2999], [3000, 3499],
  [3500, 3999], [4000, null]];
const hstem = (lo, hi) => `HI_${lo || 1}_${hi == null ? "more" : hi}`;
const fstem = (lo, hi) => `FI_${lo || 1}_${hi == null ? "more" : hi}`;
const household = HBANDS.map(([lo, hi], i) => {
  const fam = sumCol(g33, hcol(hstem(lo, hi), "fam")) + (i ? 0 : sumCol(g33, "Neg_Nil_inc_fam_households"));
  const non = sumCol(g33, hcol(hstem(lo, hi), "non")) + (i ? 0 : sumCol(g33, "Neg_Nil_inc_Non_fam_househlds"));
  const fc = fcols(fstem(lo, hi));
  const mix = Object.fromEntries(Object.entries(fc).map(([k, c]) => [k, sumCol(g32, c)
    + (i ? 0 : sumCol(g32, { c0: "Neg_Nil_inc_cpl_fam_no_child", c1: "Neg_Nil_inc_cpl_fam_wth_chld", op: "Neg_Nil_inc_One_parent_fam", of: "Neg_Nil_inc_Other_fam" }[k]))]));
  const mixN = mix.c0 + mix.c1 + mix.op + mix.of;
  const famPer = Object.keys(ADULTS).reduce((a, k) => a + mix[k] * ADULTS[k], 0) / mixN;
  return { lo, hi, n: Math.round(fam * famPer + non * nonFamAdults), households: fam + non };
});

/* ---- the wage index ------------------------------------------------------- */
let aweSeries = AWE_FALLBACK, aweSource = "fallback table (ABS API unreachable at build)";
try {
  const txt = execFileSync("curl", ["-s", "--fail", "-m", "20", "-H", "Accept: application/vnd.sdmx.data+csv", AWE_API], { encoding: "utf8" });
  const rows = txt.trim().split(/\r?\n/).slice(1).map((l) => l.split(","))
    .map((c) => { const m = /^(\d{4})-S([12])$/.exec(c[9]); return m ? [`${m[1]}-${m[2] === "1" ? "05" : "11"}-15`, +c[10]] : null; })
    .filter((r) => r && Number.isFinite(r[1])).sort((a, b) => a[0].localeCompare(b[0]));
  if (rows.length >= AWE_FALLBACK.length) { aweSeries = rows; aweSource = "ABS data API, " + new Date().toISOString().slice(0, 10); }
} catch { /* keep the fallback */ }
const at = (iso) => {
  const t = Date.parse(iso), s = aweSeries.map(([d, v]) => [Date.parse(d), v]);
  for (let i = 1; i < s.length; i++) if (t <= s[i][0]) return s[i - 1][1] + (s[i][1] - s[i - 1][1]) * (t - s[i - 1][0]) / (s[i][0] - s[i - 1][0]);
  throw new Error("census date outside the AWE series");
};

const total = (bands) => bands.reduce((a, b) => a + b.n, 0);
const out = {
  weeksPerYear: +WEEKS.toFixed(5),
  awe: { census: { date: CENSUS_DATE, value: +at(CENSUS_DATE).toFixed(2) }, series: aweSeries, source: aweSource },
  axes: {
    household: { base: "adults 18+ in occupied private dwellings, by weekly household income ($2021)", bands: household, total: total(household),
      adultsPer: { coupleNoChildren: +ADULTS.c0.toFixed(3), coupleWithChildren: +ADULTS.c1.toFixed(3), oneParent: +ADULTS.op.toFixed(3), otherFamily: +ADULTS.of.toFixed(3), nonFamily: +nonFamAdults.toFixed(3) } },
    personal: { base: "adults 18+, by weekly personal income ($2021)", bands: personal, total: total(personal) },
  },
  _about: "National weekly-income histograms of voting-age adults for the Who-votes Income tab's standardised pooling (gen-data §7g-income), from the 2021 Census GCP commonwealth-electoral-division tables. household: G33 households by income re-weighted to adults – each band's family households carry that band's G32 family mix at G27-derived adults per family type, non-family households the national adults per non-family household (adultsPer); band.households keeps the raw count. personal: G17B+G17C persons 15+ less the 15–17s (G04 single years, spread over the 15–19 band's incomes). Not-stated dropped; Negative/Nil folded into $0–149; citizenship not applied. Poll brackets map in by edge×1000/weeksPerYear ÷ (AWE at the wave's fieldwork midpoint ÷ awe.census.value), awe.series being ABS 6302.0 FT-adult ordinary-time earnings, seasonally adjusted, extrapolated past its last point at the trailing year's growth; uniform inside bands, Pareto inside the open top band. Built by .build/extract-income-dist.mjs: rerun on each AWE release; the 2026 census datapack (~June 2027) needs new band columns there.",
};
writeFileSync(path.join(ROOT, "data", "income-dist.json"), JSON.stringify(out, null, 1) + "\n");
const hh = total(household.map((b) => ({ n: b.households })));
console.log(`wrote data/income-dist.json — AWE census ${out.awe.census.value} (${aweSource}, last ${aweSeries.at(-1).join(" ")}); household: ${hh.toLocaleString()} households → ${total(household).toLocaleString()} adults (adults/hh ${JSON.stringify(out.axes.household.adultsPer)}); personal 18+ n=${total(personal).toLocaleString()} (15–17 share of 15–19 ${f1517.toFixed(3)})`);
