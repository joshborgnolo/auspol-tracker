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
      demoI national exactly the c0/c1 share blend at f, incomeCuts
      absent (income floor is 2013) and no incomeCutsI, and the
      booth-level both-sides rule: demoI null iff either side's demo
      is null, inside a live block each lane is the exact blend.
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
}, "c0 national (2001 census anchors)");
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
// shapes: every demo block no income keys, shares inside [0,1],
// the not-stated doctrine intact (nulls where ABS published nothing)
{
  let incomeKey = 0, badShare = 0, nulls = 0;
  for (const b of d.booths) {
    if (b.demo === null) {
      nulls++;
      continue;
    }
    for (const k of ["loinc", "hiinc", "incMed"]) incomeKey += (k in b.demo);
    for (const k of ["langOther", "fborn", "uni", "blue"]) {
      const x = b.demo[k];
      if (x != null && !(x >= 0 && x <= 1)) badShare++;
    }
  }
  ok(incomeKey === 0 && !badShare && nulls === 1513 + 1,
    `c0 blocks well-formed (${incomeKey} income keys, ${badShare} bad, ${nulls} null)`);
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
}, "c1 national (2006 census anchors)");
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
  ok(!("incomeCutsI" in d) && !("incomeCuts" in d),
    "2004 keeps the income floor (no income cuts either side)");
  const LN = (a, b) => Math.round(((1 - f) * a + f * b) * 1e4) / 1e4;
  for (const k of ["langOther", "fborn", "uni", "blue", "age0_14",
    "age65ov"]) {
    eq(d.counts.demoI.national[k],
      LN(c.national[k], c1c.national[k]), `demoI national ${k}`);
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
    "blue", "age", "loinc", "hiinc", "incMed"]);
  for (const b of d.booths) {
    const fb = nc1b.get(`${b.div}|${b.boothId}`);
    if (b.demoI === null) {
      bothNullC++;
      if (b.demo !== null && fb.demo !== null) keyok = false;
      continue;
    }
    blendC++;
    if (!Object.keys(b.demoI).every((k) => KEYS.has(k))) keyok = false;
    for (const k of ["langOther", "fborn", "uni", "blue"]) {
      const a = b.demo && b.demo[k], x = fb.demo && fb.demo[k];
      if (a != null && x != null) {
        if (b.demoI[k] !== LN(a, x)) keyok = false;
      } else if (b.demoI[k] !== null) keyok = false;
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
