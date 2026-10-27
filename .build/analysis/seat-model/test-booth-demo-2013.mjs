#!/usr/bin/env node
/* test-booth-demo-2013.mjs — pin data/booth-demo-2013.json
   (derive-booth-demo-2013.py: the census-people venue-proxy store for
   the 2013 election — 2011 Census BCP counts of each booth's geo SA1
   per booth, and the exact CED-2011 census sums per division; the
   sibling of the voter-footprint demo lanes of
   data/booth-seifa-voter-YYYY.json, which start at 2016).

   Invariants (universe + value pins measured 2026-10-26 on the first
   green emission):

   1. Universe: 9146 booth rows in the EXACT order of the venue store
      data/booth-seifa-2013.json; 150 divisions, alphabetically within
      the eight-state order; counts.boothsGeoMissing 581 (the no-venue
      booms — Special Hospital Teams etc. carry demo:null).
   2. Keys + shape: (divId, boothId) unique; a non-null demo block
      carries persons >= 1, cov 1.0, every share in [0,1], and an age
      dict over the 11 B01 bands summing ~1.
   3. National row: exact pins (the CED-2011 division pools; persons
      is census-usual-residents of the 150 divisions — the residual to
      the BCP table total is the migratory/no-usual-address pseudo
      entries, dropped).
   4. Division anchors: Sydney/Melbourne/Fowler/Lyne/Lingiari row
      figures; division extrema (Watson max language-other, Lyons min;
      Bruce max overseas-born, Parkes min; North Sydney max
      university, Wakefield min; Flynn max blue-collar (B45B: trades +
      drivers + labourers over the stated occupation groups), North
      Sydney min; Lyne oldest, Lingiari youngest; the income envelope
      faces Hinkler/Mitchell, North Sydney/Lyons, Bradfield/Hinkler);
      the Lingiari row printed in full.
   5. Reconciliation: sum over divisions of persons == the national
      persons exactly (integer count, not share arithmetic).
   6. Provenance: _provenance.files names the BCP zip, the CED zip and
      the venue store.
   7. Income lanes (B26/B28, the 2011 G32/G33 counterparts): loinc/
      hiinc are adult shares of the adults-weighted B28 household
      income mass (B26 family mix, national fallback), incMed the
      band-interpolated median weekly household income on the RAW
      household histogram (ABS's published-median basis); all three in
      2011 dollars/basis. The store-level incomeCuts record pins the
      national 25th-percentile cut ($738/wk linear-in-band) and the
      $4,000+ top band's national adult share (0.044354). National
      incMed 1235 sits one dollar off ABS's published 2011 median
      weekly household income ($1,234, ex-not-stated residual);
      national loinc 0.2517 lofts the 0.25 quantile cut by ~0.2pt
      because the 150-division pool drops the pseudo SA1s the cut was
      read over. Booth income nulls (81/81/83 of 8452 geo-carrying
      rows) are tiny-SA1 perturbation nulling; venue-proxy extreme
      SA1s legitimately read 1.0 (eight booths) and 0.6859 (Allambie)
      at the two lane faces, 100–3250 on the median.
*/

import { readFileSync } from "node:fs";

const BANDS = ["0_4", "5_14", "15_19", "20_24", "25_34", "35_44",
  "45_54", "55_64", "65_74", "75_84", "85ov"];
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

const d = JSON.parse(readFileSync("data/booth-demo-2013.json", "utf8"));
const venue = JSON.parse(readFileSync("data/booth-seifa-2013.json", "utf8"));

// 1. universe + order
eq(d.election, 2013, "election");
eq(d.censusEdition, 2011, "censusEdition");
eq(d.counts.booths, 9146, "counts.booths");
eq(d.counts.booths, venue.booths.length, "booth count vs venue store");
eq(d.booths.map((b) => b.boothId), venue.booths.map((b) => b.boothId),
  "booth order == venue store order");
eq(d.counts.divisions, 150, "counts.divisions");
eq(d.counts.boothsGeoMissing, 581, "counts.boothsGeoMissing");
eq(d.counts.boothsGeoEmpty, 113, "counts.boothsGeoEmpty");
eq(d.counts.boothsGeo, 9146 - 581 - 113, "counts.boothsGeo");
eq(d.counts.sa1Bcp, 54805, "counts.sa1Bcp");
eq(d.counts.sa1Ced, 54772, "counts.sa1Ced (150-division SA1s)");
eq(d.counts.cedPseudoSkipped, 33, "pseudo-entry SA1s dropped");

// 2. keys + shape
{
  const keys = new Set();
  let nulls = 0;
  const laneNull = { langOther: 0, fborn: 0, uni: 0, blue: 0, age: 0,
    loinc: 0, hiinc: 0, incMed: 0 };
  for (const b of d.booths) {
    const k = b.divId + "|" + b.boothId;
    ok(!keys.has(k), `dup booth key ${k}`);
    keys.add(k);
    if (b.demo === null) { nulls++; continue; }
    const dm = b.demo;
    ok(dm.persons >= 1 && dm.cov === 1.0, `demo pers/cov ${k}`);
    for (const f of ["langOther", "fborn", "uni", "blue"]) {
      ok(dm[f] === null || (dm[f] >= 0 && dm[f] <= 1), `share range ${f} ${k}`);
      if (dm[f] === null) laneNull[f]++;
    }
    if (dm.age === null) laneNull.age++;
    if (dm.age) {
      eq(Object.keys(dm.age), BANDS, `age bands ${k}`);
      const s = BANDS.reduce((t, x) => t + dm.age[x], 0);
      ok(Math.abs(s - 1) < 0.01, `age sums ~1 ${k}: ${s}`);
    }
    for (const f of ["loinc", "hiinc"]) {
      ok(dm[f] === null || (dm[f] >= 0 && dm[f] <= 1),
        `income share range ${f} ${k}`);
      if (dm[f] === null) laneNull[f]++;
    }
    ok(dm.incMed === null || (dm.incMed >= 100 && dm.incMed <= 4200),
      `incMed range ${k}`);
    if (dm.incMed === null) laneNull.incMed++;
  }
  eq(nulls, d.counts.boothsGeoMissing + d.counts.boothsGeoEmpty,
    "null demo == geo missing + geo empty");
  // the age:1 is Casey Warburton PPVC: venue SA1 2128609 carries 3
  // perturbed persons but all-zero age cells (BCP perturbation on a
  // tiny SA1 — null, never a made-up structure); the income nulls are
  // the same null-not-clamp route on B26/B28
  eq(laneNull, { langOther: 21, fborn: 9, uni: 25, blue: 53, age: 1,
    loinc: 81, hiinc: 81, incMed: 83 },
    "lane nulls (tiny-SA1 BCP perturbation)");
}

// 3. national pins
eq(d.counts.national, {
  persons: 21458718,
  langOther: 0.1917,
  fborn: 0.2606,
  uni: 0.2082,
  blue: 0.307,
  age0_14: 0.1929,
  age65ov: 0.1401,
  loinc: 0.2517,
  hiinc: 0.043,
  incMed: 1235,
}, "counts.national");

// 4. division anchors (measured blocks; the demoI interp block has its
// own contract in section 8)
const stripI = (o) => { const { demoI, ...rest } = o; return rest; };
let divs;
{
  divs = new Map(d.divisions.map((x) => [x.div, x]));
  const S = divs.get("Sydney");
  eq(stripI(S), {
    div: "Sydney", state: "NSW", persons: 170700, cov: 1,
    langOther: 0.3277, fborn: 0.4686, uni: 0.4751, blue: 0.1316,
    age: S.age,
    loinc: 0.2038, hiinc: 0.1164, incMed: 1730,
  }, "Sydney row");
  const M = divs.get("Melbourne");
  eq([M.persons, M.langOther, M.fborn, M.uni, M.blue,
    M.loinc, M.hiinc, M.incMed],
    [177628, 0.3484, 0.4153, 0.477, 0.1314, 0.2579, 0.0821, 1411],
    "Melbourne figures");
  const F = divs.get("Fowler");
  eq([F.persons, F.langOther, F.fborn, F.uni, F.blue,
    F.loinc, F.hiinc, F.incMed],
    [148973, 0.7084, 0.528, 0.098, 0.4582, 0.3204, 0.0225, 1040],
    "Fowler figures");
  const L = divs.get("Lingiari");
  eq(stripI(L), {
    div: "Lingiari", state: "NT", persons: 109461, cov: 1,
    langOther: 0.4016, fborn: 0.1179, uni: 0.1317, blue: 0.3522,
    age: L.age,
    loinc: 0.1977, hiinc: 0.0449, incMed: 1504,
  }, "Lingiari row (printed)");
  console.log("Lingiari:", JSON.stringify(L));
  const a65 = (x) => x.age["65_74"] + x.age["75_84"] + x.age["85ov"];
  const byLang = d.divisions.filter((x) => x.langOther !== null)
    .slice().sort((a, b) => b.langOther - a.langOther);
  eq([byLang[0].div, byLang[0].langOther], ["Watson", 0.7106], "max language-other");
  eq(byLang.at(-1).div, "Lyons", "min language-other");
  eq(byLang.at(-1).langOther, 0.0182, "min language-other share");
  const byFb = [...d.divisions].sort((a, b) => b.fborn - a.fborn);
  eq([byFb[0].div, byFb[0].fborn], ["Bruce", 0.5317], "max overseas-born");
  eq([byFb.at(-1).div, byFb.at(-1).fborn], ["Parkes", 0.0575], "min overseas-born");
  const byUni = [...d.divisions].sort((a, b) => b.uni - a.uni);
  eq([byUni[0].div, byUni[0].uni], ["North Sydney", 0.491], "max university");
  eq([byUni.at(-1).div, byUni.at(-1).uni], ["Wakefield", 0.0732], "min university");
  const byBlue = [...d.divisions].sort((a, b) => b.blue - a.blue);
  eq([byBlue[0].div, byBlue[0].blue], ["Flynn", 0.4812], "max blue-collar");
  eq([byBlue.at(-1).div, byBlue.at(-1).blue], ["North Sydney", 0.1014],
    "min blue-collar");
  const byAge = [...d.divisions].sort((a, b) => a65(b) - a65(a));
  eq([byAge[0].div, +a65(byAge[0]).toFixed(4)], ["Lyne", 0.2365], "oldest");
  eq([byAge.at(-1).div, +a65(byAge.at(-1)).toFixed(4)], ["Lingiari", 0.0511],
    "youngest");
  const byLo = [...d.divisions].sort((a, b) => b.loinc - a.loinc);
  eq([byLo[0].div, byLo[0].loinc], ["Hinkler", 0.4051], "max low-income");
  eq([byLo.at(-1).div, byLo.at(-1).loinc], ["Mitchell", 0.125],
    "min low-income");
  const byHi = [...d.divisions].sort((a, b) => b.hiinc - a.hiinc);
  eq([byHi[0].div, byHi[0].hiinc], ["North Sydney", 0.1551],
    "max top-band income");
  eq([byHi.at(-1).div, byHi.at(-1).hiinc], ["Lyons", 0.0067],
    "min top-band income");
  const byMed = [...d.divisions].sort((a, b) => b.incMed - a.incMed);
  eq([byMed[0].div, byMed[0].incMed], ["Bradfield", 2135],
    "max median income");
  eq([byMed.at(-1).div, byMed.at(-1).incMed], ["Hinkler", 800],
    "min median income");
  // sort-order: state order then div, non-decreasing
  const ORD = ["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"].indexOf
    .bind(["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"]);
  for (let i = 1; i < d.divisions.length; i++) {
    const [p, q] = [d.divisions[i - 1], d.divisions[i]];
    ok(ORD(p.state) < ORD(q.state) ||
       (p.state === q.state && p.div <= q.div), `division sort ${p.div},${q.div}`);
  }
}

// 5. persons reconciliation (exact integer count)
eq(d.divisions.reduce((t, x) => t + x.persons, 0),
  d.counts.national.persons, "division persons pool == national");

// 6. provenance
{
  const f = d._provenance.files;
  ok(Object.keys(f).some((k) => k.endsWith("bcp-sa1-2011.zip")), "prov bcp");
  ok(Object.keys(f).some((k) => k.endsWith("1270055003_ced_2011_aust_csv.zip")),
    "prov ced");
  ok(Object.keys(f).some((k) => k.endsWith("data/booth-seifa-2013.json")),
    "prov venue");
}

// 7. income meta record (2011 dollars; the res-YYYY.json builder reads
// this verbatim into the app layer)
eq(d.incomeCuts, {
  loQuantile: 0.25,
  loCutWeekly: 738,
  hiEdgeWeekly: 4000,
  hiNationalShare: 0.044354,
  dollarsYear: 2011,
  adultsWeights: "data/income-dist.json",
  medianBasis: "households (shares are per-adult)",
}, "incomeCuts record");

// 8. demoI interp contract (derive-booth-demo-interp.py): the blend
// rides the seifa store's own pcti factor to the last decimal; a lane
// is the two census sides' share blend when both are present, null in
// demoI otherwise (the display falls back per lane); incMed and the
// incomeCutsI dollars pin to the nearest census side (2011 at f
// 0.416); 2007/2010-style one-sided income lanes never appear under
// the blend's label
{
  const far = JSON.parse(readFileSync("data/booth-demo-2013-c1.json",
    "utf8"));
  const sf = JSON.parse(readFileSync("data/booth-seifa-2013.json",
    "utf8"));
  const f = 0.415982;
  eq([d.demoInterp.f, d.demoInterp.c0, d.demoInterp.c1,
    d.demoInterp.nearestSide, d.demoInterp.blend],
    [f, 2011, 2016, 2011, "shares"], "demoInterp record");
  eq(d.demoInterp.censusNights, { 2011: "2011-08-09", 2016: "2016-08-09" },
    "demoInterp census nights");
  eq(d.demoInterp.f, sf._pcti.f, "demoInterp.f == seifa _pcti.f");
  const LN = (a, b) => Math.round(((1 - f) * a + f * b) * 1e4) / 1e4;
  const NL = new Set(["langOther", "fborn", "uni", "blue", "age0_14",
    "age65ov", "loinc", "hiinc"]);
  for (const k of NL) {
    eq(d.counts.demoI.national[k],
      LN(d.counts.national[k], far.counts.national[k]),
      `demoI national ${k}`);
  }
  eq(d.counts.demoI.national.incMed, d.counts.national.incMed,
    "demoI national incMed is the nearest (2011) side's");
  eq(d.incomeCutsI.dollarsYear, 2011,
    "incomeCutsI dollars year is the nearest side's");
  eq([d.incomeCutsI.sides["2011"].loCutWeekly,
    d.incomeCutsI.sides["2016"].loCutWeekly],
    [d.incomeCuts.loCutWeekly, far.incomeCuts.loCutWeekly],
    "incomeCutsI sides carry both cuts");
  const farDiv = new Map(far.divisions.map((x) => [x.div, x]));
  const LNset = farDiv.get("Lingiari");
  const LI = divs.get("Lingiari");
  for (const k of ["langOther", "fborn", "uni", "blue", "loinc",
    "hiinc"]) {
    eq(LI.demoI[k], LN(LI[k], LNset[k]), `Lingiari demoI ${k}`);
  }
  eq(LI.demoI.incMed, 1504, "Lingiari demoI.incMed nearest side");
  let keyok = true;
  const KEYS = new Set(["persons", "cov", "langOther", "fborn", "uni",
    "blue", "age", "loinc", "hiinc", "incMed"]);
  let nullBoth = 0, blended = 0;
  const farB = new Map(far.booths.map((x) => [`${x.div}|${x.boothId}`, x]));
  for (const b of d.booths) {
    if (b.demoI === null) {
      if (b.demo !== null && farB.get(`${b.div}|${b.boothId}`).demo !== null) {
        failures++;
        console.error(`FAIL demoI null with both sides present ` +
          `${b.div}|${b.boothId}`);
        keyok = false;
      } else {
        nullBoth++;
      }
      continue;
    }
    if (!Object.keys(b.demoI).every((k) => KEYS.has(k))) keyok = false;
    blended++;
    for (const k of ["langOther", "fborn", "uni", "blue"]) {
      const a = b.demo && b.demo[k], fb = farB.get(`${b.div}|${b.boothId}`);
      const x = fb.demo && fb.demo[k];
      if (a != null && x != null) {
        if (b.demoI[k] !== LN(a, x)) {
          failures++;
          console.error(`FAIL booth ${b.div}|${b.boothId} demoI ${k}: ` +
            `${b.demoI[k]} vs blend ${LN(a, x)}`);
          keyok = false;
          break;
        }
      } else if (b.demoI[k] !== null) {
        failures++;
        console.error(`FAIL booth ${b.div}|${b.boothId} demoI ${k} not ` +
          `null on a one-sided lane`);
        keyok = false;
        break;
      }
    }
  }
  ok(keyok, "booth demoI keys + per-lane blend/null rule");
  ok(blended > 8000 && nullBoth > 400,
    `booth demoI profile: ${blended} blended, ${nullBoth} both-null`);
  eq(d.counts.demoI.rows,
    d.booths.filter((b) => b.demoI !== null).length + 0,
    "counts.demoI.rows");
}

if (failures) {
  console.error(`\n${failures} FAILURES`);
  process.exit(1);
}
console.log("OK: data/booth-demo-2013.json pinned");
