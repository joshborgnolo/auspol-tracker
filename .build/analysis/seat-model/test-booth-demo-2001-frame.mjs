/* test-booth-demo-2001-frame.mjs — pin data/booth-demo-2001.json and
   the 2001-election CD allocation
   (derive-booth-demo-2001-frame.py + derive-cd-2001-ced-2001set.py):
   the /map/ People lanes' floor year, the 2001 census measured
   against its own election (measured-only — the election sits inside
   the interp era's brackets but its census night was ~3 months before
   election day; the SEIFA pcti side already classes 2001 measured).

   Invariants (universe + value pins measured 2026-10-28 on the first
   green emission):

   1. Store header: election 2001, censusEdition 2001, no demoInterp
      record anywhere (never a blend); income keys live via the
      shared 2001-edition engine (B 30/B 31, $2,000+ top edge).
   2. Universe: 7,701 booths in the venue store's exact order; CD-join
      classes 6,311 inherited from the 2004 store / 738 pointed
      point-in-polygon / 4 pip-miss / 143 suburb-tier null /
      505 coordinate-less null; 780 join-total null rows of the
      classes plus the venues standing in tally-less pseudo CDs.
      150 divisions.
   3. The allocation (seifa-src/cd-2001-ced-2001set.json): 37,209
      units, 37,116 placed (0 straddle — the 2001-era set sits inside
      its own polygons, 14 by first vertex), 93 unplaced all the ABS
      offshore-migratory class (8,249 people), 0 profile-free pseudos.
   4. National pins recompute the published census anchors (persons
      18,644,579 after the drop class — letter-for-letter the 2004
      lane's figure, the two allocs dropping the same offshore
      class); anchors Lingiari/Sydney stated in 2001-set sums and
      Gwydir printed verbatim (a 2001-era division the 2003ed lane
      never holds).
*/
import { readFileSync } from "node:fs";

let failures = 0;
const eq = (a, b, msg) => {
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    failures++;
    console.error(`FAIL ${msg}: got ${JSON.stringify(a)} want ${JSON.stringify(b)}`);
  }
};
const ok = (c, msg) => {
  if (!c) {
    failures++;
    console.error(`FAIL ${msg}`);
  }
};

const d = JSON.parse(readFileSync("data/booth-demo-2001.json", "utf8"));
const alloc = JSON.parse(readFileSync(
  ".build/analysis/seat-model/seifa-src/cd-2001-ced-2001set.json", "utf8"));

// 1. header + never-a-blend contracts + the 2001-edition incomeCuts
eq([d.election, d.censusEdition], [2001, 2001],
  "the frame store reads its own election on its own census");
ok(!("demoInterp" in d) && !("demoI" in d),
  "measured-only: no interp record on the store");
{
  let interp = 0;
  for (const b of d.booths) interp += ("demoI" in b);
  for (const x of d.divisions) interp += ("demoI" in x);
  ok(interp === 0, "no demoI rows anywhere (measured-only)");
}
eq(d.incomeCuts, {
  loQuantile: 0.25, loCutWeekly: 456.13, hiEdgeWeekly: 2000,
  hiNationalShare: 0.103255, dollarsYear: 2001,
  adultsWeights: "data/income-dist.json",
  medianBasis: "households (shares are per-adult)",
}, "frame incomeCuts (2001 edition: $2,000+ top edge)");
{
  let incBlocks = 0, incNull = 0, badShare = 0;
  for (const b of d.booths) {
    if (!b.demo) continue;
    if (b.demo.loinc != null || b.demo.incMed != null) incBlocks++;
    if (b.demo.langOther !== null &&
        (b.demo.loinc === null && b.demo.incMed === null)) incNull++;
    for (const k of ["loinc", "hiinc"]) {
      const v = b.demo[k];
      if (v != null && !(v >= 0 && v <= 1)) badShare++;
    }
  }
  ok(incBlocks > 0 && incNull === 0 && !badShare,
    `income lanes live on every full-table join block ` +
    `(${incBlocks} with, ${incNull} full-table holes, ${badShare} bad)`);
}

// 2. store universe + the join-class ledger
const c = d.counts;
eq([c.booths, c.boothsGeo, c.boothsGeoMissing, c.boothsGeoEmpty,
  c.divisions, c.cdsBcpTally, c.cdsAlloc, c.cdsShortTable,
  c.personsShortTable],
  [7701, 6921, 780, 0, 150, 35289, 37116, 2, 751],
  "frame store universe pins");
eq([c.boothsCdInherit2004, c.boothsCdPip, c.cdsAlloc,
  c.boothsCdPipMiss, c.boothsSuburbTier, c.boothsNoCoords],
  [6311, 738, 37116, 4, 143, 505],
  "CD-join class ledger (inherit / pip / honest-null tiers)");
eq(c.national, {
  persons: 18644579, langOther: 0.1594, fborn: 0.2318, uni: 0.1461,
  blue: 0.2951, age0_14: 0.2088, age65ov: 0.1265,
  cob: {
    uk: 0.0585, ind: 0.0054, chn: 0.0081, nzl: 0.0201, phl: 0.0059,
    vnm: 0.0087, zaf: 0.0045, ita: 0.0124, lka: 0.003,
  },
  u15: 0.2088, y12less: 0.5756, atsci: 0.0209, onepar: 0.1545,
  rel: {
    norel: 0.1716, cath: 0.2956, angl: 0.2292, unch: 0.0737,
    pres: 0.0377, orth: 0.0335, budd: 0.0211, isl: 0.0167,
    hind: 0.0057, jew: 0.005,
  },
  ten: { mort: 0.2783, rent: 0.2758, own: 0.4171, rentPub: 0.0472 },
  loinc: 0.2502, hiinc: 0.1033, incMed: 786,
}, "national == the 2004 lane's figure (same tally, same offshore drop)");
// booth order == the venue store's
{
  const v = JSON.parse(readFileSync("data/booth-seifa-2001.json",
    "utf8"));
  eq(d.booths.map((b) => `${b.div}|${b.boothId}`),
    v.booths.map((b) => `${b.div}|${b.boothId}`), "frame booth order");
}
// well-formed booth demo blocks
{
  let badShare = 0, nulls = 0;
  for (const b of d.booths) {
    if (b.demo === null) { nulls++; continue; }
    for (const k of ["langOther", "fborn", "uni", "blue"]) {
      const x = b.demo[k];
      if (x != null && !(x >= 0 && x <= 1)) badShare++;
    }
  }
  ok(!badShare, `frames shares inside [0,1] (${badShare} bad)`);
  eq(nulls, c.boothsGeoMissing + c.boothsGeoEmpty,
    "null rows == the missing+empty classes");
}

// 3. the 2001-election allocation
eq([alloc.unit, alloc.unitCount, alloc.placed, alloc.split,
  alloc.fallback],
  ["CD_CODE_2001", 37209, 37116, 0, 14], "alloc universe");
eq(alloc.divisions.length, 150, "alloc holds the 2001-era 150 divisions");
ok(alloc.divisions.includes("Gwydir") &&
   !alloc.divisions.includes("Bonner"),
  "the era set itself (Gwydir in, Bonner not yet)");
eq([alloc.offshoreClass.offshoreMigratory.name,
  alloc.offshoreClass.offshoreMigratory.units,
  alloc.offshoreClass.offshoreMigratory.population],
  ["Off-Shore Areas & Migratory", 93, 8249],
  "the 93 offshore balance units, 8,249 people");
eq(alloc.offshoreClass.profileFreePseudo.units, 0,
  "no profile-free pseudos outside the era polygons");
eq(alloc.unplacedUnscored.length, 93, "unplaced == offshore class");

// 4. division anchors (2001-set sums)
{
  const divs = new Map(d.divisions.map((x) => [x.div, x]));
  const L = divs.get("Lingiari");
  eq([L.persons, L.langOther, L.fborn, L.uni, L.blue],
    [102909, 0.3159, 0.1206, 0.1093, 0.3511],
    "Lingiari 2001-set (moves vs the 2003ed lane)");
  const S = divs.get("Sydney");
  eq([S.persons, S.langOther, S.fborn, S.uni, S.blue],
    [158113, 0.2561, 0.4111, 0.3653, 0.1094],
    "Sydney unchanged across the two era sets");
  const G = divs.get("Gwydir");
  eq([G.persons, G.langOther, G.fborn, G.uni, G.blue],
    [125105, 0.0209, 0.06, 0.0734, 0.3561],
    "Gwydir (a 2001-era division the 2003ed lane never holds)");
  const M = divs.get("Macarthur");
  eq([M.persons, M.langOther, M.fborn, M.uni, M.blue],
    [129851, 0.1508, 0.2197, 0.0859, 0.345], "Macarthur");
  eq(divs.get("Bonner"), undefined, "Bonner is a 2003-edition seat");
  const sum = d.divisions.reduce((t, x) => t + x.persons, 0);
  eq(sum, 18644579, "sum of division persons == national persons");
}

// 5. the birthplace menu (the B 06 country rows, uk-led, on the
//    measured store; counts.national.cob pins the extractor's own
//    printed national pool so the store's pool can be read without a
//    recompute)
eq(d.cobKeys, ["uk", "ind", "chn", "nzl", "phl", "vnm", "zaf", "ita", "lka"],
  "cob menu order (whole-UK leading like eng leads the 2021-era menu)");
eq(c.national.cob, {
  uk: 0.0585, ind: 0.0054, chn: 0.0081, nzl: 0.0201, phl: 0.0059,
  vnm: 0.0087, zaf: 0.0045, ita: 0.0124, lka: 0.003,
}, "national birthplace pool (the extractor's printed shares)");
{
  const divs = new Map(d.divisions.map((x) => [x.div, x]));
  const M = divs.get("Moore");
  eq([M.cob.uk, M.cob.ind, M.cob.chn, M.cob.vnm, M.cob.ita],
    [0.2004, 0.0056, 0.0019, 0.0019, 0.0061],
    "Moore tops the menu (the app's uk park cap sits just above the max)");
  const S = divs.get("Sydney");
  eq([S.cob.uk, S.cob.chn, S.cob.ind, S.cob.vnm, S.cob.ita],
    [0.0763, 0.0264, 0.0061, 0.0113, 0.0067], "Sydney birthplace anchors");
  const G = divs.get("Gwydir");
  eq([G.cob.uk, G.cob.ita], [0.0209, 0.0017], "Gwydir birthplace anchors");
  let missing = 0, bad = 0;
  for (const x of d.divisions) {
    for (const k of d.cobKeys) {
      const v = x.cob && x.cob[k];
      if (v == null && k in (x.cob || {})) { /* explicit null ok */ }
      if (!(k in (x.cob || {}))) missing++;
      if (v != null && !(v >= 0 && v <= 1)) bad++;
    }
  }
  for (const b of d.booths) {
    if (b.demo === null) continue;
    if (!b.demo.cob) { missing++; continue; }
    for (const k of d.cobKeys) {
      if (!(k in b.demo.cob)) missing++;
      const v = b.demo.cob[k];
      if (v != null && !(v >= 0 && v <= 1)) bad++;
    }
  }
  ok(missing === 0, `every demo row carries all nine cob keys (${missing} missing)`);
  ok(!bad, `cob shares inside [0,1] (${bad} bad)`);
}

if (failures) {
  console.error(`\n${failures} FAILURES`);
  process.exit(1);
}
console.log("OK: data/booth-demo-2001.json + cd-2001-ced-2001set.json pinned (frame floor year)");
