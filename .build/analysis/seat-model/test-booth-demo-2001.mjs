/* test-booth-demo-2001.mjs — pin data/booth-demo-2004.json and
   data/booth-demo-2004-c1.json (derive-booth-demo-2001.py,
   derive-booth-demo-2004c1.py: the 2004 people lane's two census
   sides — the election's own intercensal blend year) plus its
   blending contract on data/booth-demo-2004.json itself.

   Invariants (universe + value pins measured 2026-10-28 on the first
   green emissions):

   1. c0 (measured, 2001 census): 8,234 booths in the venue store's
      exact order; geo profile 6,720 in / 1,513 missing / 1 empty;
      150 divisions; the alloc universe counted 37,115 placed +
      93 offshore-migratory dropped (8,249 people, named in the
      alloc JSON's offshoreClass) + 1 profile-free pseudo. National
      pins recompute against the published census anchors (persons
      18,644,579 after the drop class; langOther 0.1594; age65ov
      0.1265). Lingiari/Sydney rows printed verbatim.
   2. The alloc membership map (seifa-src/cd-2001-ced-2003ed.json):
      unitCount 37,209, placed 37,101, 108 outside era polygons
      (93 offshore + 1 pseudo + 14 rescued), all 150 divisions.
   3. c1 (far side, 2006 census): 8,234 booths same order; PIP profile
      6,825 in / 1,386 miss / 23 empty; allocation universe 38,704
      placed of 38,713. National persons 19,813,809.
   4. The interp contract on data/booth-demo-2004.json: demoInterp
      record complete (f 0.634373 == data/booth-seifa-2004.json's own
      _pcti.f, c0 2001 / c1 2006, nearest 2006, census nights), counts
      demoI national exactly the c0/c1 share blend at f for the
      share lanes, lo/inc-follows its own doctrine for the income
      arm: the two sides' hi edges differ ($2,000+ in the 2001 grid
      vs $3,000+ in the 2006 grid) so demoI hiinc and incMed pin to
      the nearest side (2006) — never a mixed-edge blend — while
      loinc, whose 25th-percentile cut is edition-semantic, blends
      as usual. incomeCutsI carries the nearest side's edge + the
      sides record of both. Booths: demoI null iff either side's
      demo is null, inside a live block each lane follows its rule.
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

const d = JSON.parse(readFileSync("data/booth-demo-2004.json", "utf8"));
const c1 = JSON.parse(readFileSync("data/booth-demo-2004-c1.json", "utf8"));
const alloc = JSON.parse(readFileSync(
  ".build/analysis/seat-model/seifa-src/cd-2001-ced-2003ed.json", "utf8"));

// 1. c0 store universe
const c = d.counts;
eq([d.election, d.censusEdition], [2004, 2001], "c0 header");
eq([c.booths, c.boothsGeo, c.boothsGeoMissing, c.boothsGeoEmpty,
  c.divisions, c.cdsBcpTally, c.cdsShortTable, c.personsShortTable],
  [8234, 6720, 1513, 1, 150, 35289, 2, 751], "c0 universe pins");
eq(c.national, {
  persons: 18644579, langOther: 0.1594, fborn: 0.2318, uni: 0.1461,
  blue: 0.2951, age0_14: 0.2088, age65ov: 0.1265,
  cob: {
    uk: 0.0585, ind: 0.0054, chn: 0.0081, nzl: 0.0201, phl: 0.0059,
    vnm: 0.0087, zaf: 0.0045, ita: 0.0124, lka: 0.003,
  },
  u15: 0.2088, y12less: 0.5756, atsci: 0.0209, onepar: 0.1545,
  rel: { norel: 0.1716, cath: 0.2956, angl: 0.2292, unch: 0.0737,
    pres: 0.0377, orth: 0.0335, budd: 0.0211, isl: 0.0167, hind: 0.0057,
    jew: 0.005 },
  ten: { mort: 0.2783, rent: 0.2758, own: 0.4171, rentPub: 0.0472 },
  loinc: 0.2502, hiinc: 0.1033, incMed: 786,
}, "c0 national (2001 census anchors)");
eq(d.incomeCuts, {
  loQuantile: 0.25, loCutWeekly: 456.13, hiEdgeWeekly: 2000,
  hiNationalShare: 0.103255, dollarsYear: 2001,
  adultsWeights: "data/income-dist.json",
  medianBasis: "households (shares are per-adult)",
}, "c0 incomeCuts (2001 edition: $2,000+ top edge)");
{
  const divs = new Map(d.divisions.map((x) => [x.div, x]));
  eq(["lingiari", "sydney"].map((n) => divs.get(n === "lingiari"
    ? "Lingiari" : "Sydney").persons), [103524, 158113],
    "c0 division persons pins");
  const L = divs.get("Lingiari");
  eq([L.langOther, L.fborn, L.uni, L.blue], [0.3141, 0.1209, 0.1092,
    0.3511], "c0 Lingiari lanes");
  const S = divs.get("Sydney");
  eq([S.langOther, S.fborn, S.uni, S.blue], [0.2561, 0.4111, 0.3653,
    0.1094], "c0 Sydney lanes");
}
// booth order == the venue store's
{
  const v = JSON.parse(readFileSync("data/booth-seifa-2004.json",
    "utf8"));
  eq(d.booths.map((b) => `${b.div}|${b.boothId}`),
    v.booths.map((b) => `${b.div}|${b.boothId}`), "c0 booth order");
}
// shapes: income keys live on every full-table demo block (the
// short-table pair carries the Nones), shares inside [0,1], the
// not-stated doctrine intact (nulls where ABS published nothing)
{
  let incomeBlocks = 0, incomeShortNull = 0, badShare = 0, nulls = 0,
    shortNones = 0;
  for (const b of d.booths) {
    if (b.demo === null) {
      nulls++;
      continue;
    }
    const hasInc = b.demo.loinc != null || b.demo.incMed != null;
    if (hasInc) incomeBlocks++;
    else incomeShortNull++;
    for (const k of ["langOther", "fborn", "uni", "blue"]) {
      const x = b.demo[k];
      if (x != null && !(x >= 0 && x <= 1)) badShare++;
    }
    if (b.demo.langOther === null) {
      // the short-table CD pattern: everything null incl. income
      if (b.demo.loinc !== null || b.demo.hiinc !== null ||
        b.demo.incMed !== null) shortNones++;
    }
  }
  ok(incomeBlocks + incomeShortNull === c.boothsGeo &&
    incomeShortNull <= 4 && !badShare &&
    nulls === 1513 + 1 && shortNones === 0,
    `c0 blocks well-formed (${incomeBlocks} income blocks, ` +
    `${incomeShortNull} income-null, ${badShare} bad, ${nulls} null)`);
}

// 2. the alloc membership
eq([alloc.unit, alloc.unitCount, alloc.placed, alloc.split],
  ["CD_CODE_2001", 37209, 37115, 322], "alloc universe");
eq(alloc.divisions.length, 150, "alloc covers 150 divisions");
eq(alloc.offshoreClass.offshoreMigratory.units, 93, "offshore count");
eq(alloc.offshoreClass.offshoreMigratory.population, 8249,
  "offshore people (dropped by design)");
eq(alloc.offshoreClass.profileFreePseudo.units, 1, "pseudo count");
ok(alloc.unplacedUnscored.length === 94, "94 unplaced units total");
eq(Object.values(alloc.alloc).length, 37115, "alloc map size");

// 3. c1 store
const c1c = c1.counts;
eq([c1.election, c1.censusEdition], [2004, 2006], "c1 header");
eq([c1c.booths, c1c.boothsPip, c1c.boothsPipMiss, c1c.boothsPipEmpty,
  c1c.divisions, c1c.cdsBcp, c1c.cdsAlloc],
  [8234, 6825, 1386, 23, 150, 38713, 38704], "c1 universe pins");
eq(c1c.national, {
  persons: 19813809, langOther: 0.1681, fborn: 0.2388, uni: 0.1765,
  blue: 0.3204, age0_14: 0.1985, age65ov: 0.1333,
  u15: 0.1985, y12less: 0.5313, atsci: 0.0243, onepar: 0.1577,
  rel: { norel: 0.21, cath: 0.2909, angl: 0.2109, unch: 0.0644,
    pres: 0.0338, orth: 0.0328, budd: 0.0238, isl: 0.0193, hind: 0.0084,
    jew: 0.005 },
  ten: { mort: 0.3512, rent: 0.2898, own: 0.3504, rentPub: 0.0439 },
  loinc: 0.25, hiinc: 0.0645, incMed: 1027,
}, "c1 national (2006 census anchors)");
eq(c1.incomeCuts, {
  loQuantile: 0.25, loCutWeekly: 603.75, hiEdgeWeekly: 3000,
  hiNationalShare: 0.065439, dollarsYear: 2006,
  adultsWeights: "data/income-dist.json",
  medianBasis: "households (shares are per-adult)",
}, "c1 incomeCuts (2006 edition: $3,000+ top edge)");
{
  const divs = new Map(c1.divisions.map((x) => [x.div, x]));
  const L = divs.get("Lingiari");
  eq([L.persons, L.langOther, L.fborn, L.uni, L.blue],
    [101436, 0.3687, 0.1015, 0.1085, 0.3867], "c1 Lingiari");
  const S = divs.get("Sydney");
  eq([S.persons, S.langOther, S.fborn, S.uni, S.blue],
    [180635, 0.2845, 0.4375, 0.4383, 0.1298], "c1 Sydney");
}
eq(c1.booths.map((b) => `${b.div}|${b.boothId}`),
  d.booths.map((b) => `${b.div}|${b.boothId}`), "c1 booth order == c0");
ok(!("demoInterp" in c1) && !("incomeCutsI" in c1),
  "c1 carries no interp keys of its own");

// 4. the 2004 interp contract
{
  const sf = JSON.parse(readFileSync("data/booth-seifa-2004.json",
    "utf8"));
  const f = 0.634373;
  eq([d.demoInterp.f, d.demoInterp.c0, d.demoInterp.c1,
    d.demoInterp.nearestSide, d.demoInterp.blend],
    [f, 2001, 2006, 2006, "shares"], "demoInterp record");
  eq(d.demoInterp.censusNights, { 2001: "2001-08-07", 2006: "2006-08-08" },
    "demoInterp census nights");
  eq(d.demoInterp.f, sf._pcti.f, "demoInterp.f == seifa _pcti.f");
  eq(d.incomeCutsI, {
    loQuantile: 0.25, loCutWeekly: 603.75, hiEdgeWeekly: 3000,
    hiNationalShare: 0.065439, dollarsYear: 2006,
    adultsWeights: "data/income-dist.json",
    medianBasis: "households (shares are per-adult); hiinc pinned to " +
      "the nearest census side (hi edges differ across the blend's " +
      "editions)",
    sides: {
      2001: { loCutWeekly: 456.13, dollarsYear: 2001,
        hiEdgeWeekly: 2000, hiNationalShare: 0.103255 },
      2006: { loCutWeekly: 603.75, dollarsYear: 2006,
        hiEdgeWeekly: 3000, hiNationalShare: 0.065439 },
    },
  }, "2004 incomeCutsI = the nearest (2006) edge + both sides");
  const LN = (a, b) => Math.round(((1 - f) * a + f * b) * 1e4) / 1e4;
  for (const k of ["langOther", "fborn", "uni", "blue", "age0_14",
    "age65ov", "y12less", "atsci", "u15", "onepar", "loinc"]) {
    eq(d.counts.demoI.national[k],
      LN(c.national[k], c1c.national[k]), `demoI national ${k}`);
  }
  // the income arm's mixed-edge doctrine: hi and median pin nearest
  eq(d.counts.demoI.national.hiinc, c1c.national.hiinc,
    "demoI national hiinc == nearest side's (2006) hi");
  eq(d.counts.demoI.national.incMed, c1c.national.incMed,
    "demoI national incMed == nearest side's (2006) median");
  for (const [lane, keys] of [["rel", d.relKeys], ["ten", d.tenKeys]]) {
    for (const k of keys) {
      eq(d.counts.demoI.national[lane][k],
        LN(c.national[lane][k], c1c.national[lane][k]),
        `demoI national ${lane}.${k}`);
    }
  }
  const LI = new Map(d.divisions.map((x) => [x.div, x]))
    .get("Lingiari");
  const Lf = new Map(c1.divisions.map((x) => [x.div, x]))
    .get("Lingiari");
  for (const k of ["langOther", "fborn", "uni", "blue"]) {
    eq(LI.demoI[k], LN(LI[k], Lf[k]), `Lingiari demoI ${k}`);
  }
  eq(c.demoI.rows, d.booths.filter((b) => b.demoI !== null).length,
    "counts.demoI.rows");
  const nc1b = new Map(c1.booths.map((x) => [`${x.div}|${x.boothId}`, x]));
  let bothNullC = 0, blendC = 0, keyok = true;
  const KEYS = new Set(["persons", "cov", "langOther", "fborn", "uni",
    "blue", "age", "loinc", "hiinc", "incMed",
    "y12less", "atsci", "u15", "onepar", "rel", "ten"]);
  for (const b of d.booths) {
    const fb = nc1b.get(`${b.div}|${b.boothId}`);
    if (b.demoI === null) {
      bothNullC++;
      if (b.demo !== null && fb.demo !== null) keyok = false;
      continue;
    }
    blendC++;
    if (!Object.keys(b.demoI).every((k) => KEYS.has(k))) keyok = false;
    for (const k of ["langOther", "fborn", "uni", "blue", "y12less",
      "atsci", "onepar", "loinc"]) {
      const a = b.demo && b.demo[k], x = fb.demo && fb.demo[k];
      if (a != null && x != null) {
        if (b.demoI[k] !== LN(a, x)) keyok = false;
      } else if (b.demoI[k] !== null) keyok = false;
    }
    // hi + median are nearest-side pinned (edges differ across the
    // blend's editions): nearest is the 2006 side
    for (const k of ["hiinc", "incMed"]) {
      const x = fb.demo && fb.demo[k];
      if (x != null ? b.demoI[k] !== x : b.demoI[k] !== null) {
        keyok = false;
      }
    }
  }
  ok(keyok, "2004 booth demoI keys + per-lane blend/null rule");
  eq([blendC, bothNullC], [6718, 1516],
    `2004 demoI profile: ${blendC} blended, ${bothNullC} null`);
}

// ── 6. the birthplace menu on the c0 side (B 06's country rows, uk-led;
// the demoI blend NEVER carries cob — cob reads the measured store only)
eq(d.cobKeys, ["uk", "ind", "chn", "nzl", "phl", "vnm", "zaf", "ita", "lka"],
  "c0 cob menu order (whole-UK leading like eng leads the 2021-era menu)");
eq(c.national.cob, {
  uk: 0.0585, ind: 0.0054, chn: 0.0081, nzl: 0.0201, phl: 0.0059,
  vnm: 0.0087, zaf: 0.0045, ita: 0.0124, lka: 0.003,
}, "c0 national birthplace pool (the extractor's printed shares — letter-for-letter the frame store's)");
{
  const dd = new Map(d.divisions.map((x) => [x.div, x]));
  const M = dd.get("Moore");
  eq([M.cob.uk, M.cob.ind, M.cob.chn, M.cob.vnm, M.cob.ita],
    [0.2004, 0.0056, 0.0019, 0.0019, 0.0061],
    "Moore tops the menu (the app's uk park cap sits just above the max)");
  const L = dd.get("Lingiari");
  eq([L.cob.uk, L.cob.chn, L.cob.ind, L.cob.vnm, L.cob.ita],
    [0.0378, 0.0005, 0.0013, 0.0016, 0.0023],
    "Lingiari's c0 anchors (the 2003ed era read)");
  let missing = 0, bad = 0, interpCob = 0;
  for (const x of d.divisions) {
    if (x.demoI && "cob" in x.demoI) interpCob++;
    for (const k of d.cobKeys) {
      const v = x.cob && x.cob[k];
      if (!(k in (x.cob || {}))) missing++;
      if (v != null && !(v >= 0 && v <= 1)) bad++;
    }
  }
  for (const b of d.booths) {
    if (b.demoI && "cob" in b.demoI) interpCob++;
    if (b.demo === null) continue;
    if (!b.demo.cob) { missing++; continue; }
    for (const k of d.cobKeys) {
      if (!(k in b.demo.cob)) missing++;
      const v = b.demo.cob[k];
      if (v != null && !(v >= 0 && v <= 1)) bad++;
    }
  }
  ok(missing === 0, `every c0 demo row carries all nine cob keys (${missing} missing)`);
  ok(!bad, `c0 cob shares inside [0,1] (${bad} bad)`);
  ok(interpCob === 0, `no demoI row ever carries cob (${interpCob} leaked)`);
}

if (failures) {
  console.error(`\n${failures} FAILURES`);
  process.exit(1);
}
console.log("OK: data/booth-demo-2004.json + data/booth-demo-2004-c1.json + 2004 interp contract pinned");
