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
      Sydney min; Lyne oldest, Lingiari youngest); the Lingiari row
      printed in full.
   5. Reconciliation: sum over divisions of persons == the national
      persons exactly (integer count, not share arithmetic).
   6. Provenance: _provenance.files names the BCP zip, the CED zip and
      the venue store.
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
  const laneNull = { langOther: 0, fborn: 0, uni: 0, blue: 0, age: 0 };
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
  }
  eq(nulls, d.counts.boothsGeoMissing + d.counts.boothsGeoEmpty,
    "null demo == geo missing + geo empty");
  // the age:1 is Casey Warburton PPVC: venue SA1 2128609 carries 3
  // perturbed persons but all-zero age cells (BCP perturbation on a
  // tiny SA1 — null, never a made-up structure)
  eq(laneNull, { langOther: 21, fborn: 9, uni: 25, blue: 53, age: 1 },
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
}, "counts.national");

// 4. division anchors
{
  const divs = new Map(d.divisions.map((x) => [x.div, x]));
  eq(divs.get("Sydney"), {
    div: "Sydney", state: "NSW", persons: 170700, cov: 1,
    langOther: 0.3277, fborn: 0.4686, uni: 0.4751, blue: 0.1316,
    age: divs.get("Sydney").age,
  }, "Sydney row");
  const M = divs.get("Melbourne");
  eq([M.persons, M.langOther, M.fborn, M.uni, M.blue],
    [177628, 0.3484, 0.4153, 0.477, 0.1314],
    "Melbourne figures");
  const F = divs.get("Fowler");
  eq([F.persons, F.langOther, F.fborn, F.uni, F.blue],
    [148973, 0.7084, 0.528, 0.098, 0.4582],
    "Fowler figures");
  eq(divs.get("Lingiari"), {
    div: "Lingiari", state: "NT", persons: 109461, cov: 1,
    langOther: 0.4016, fborn: 0.1179, uni: 0.1317, blue: 0.3522,
    age: divs.get("Lingiari").age,
  }, "Lingiari row (printed)");
  console.log("Lingiari:", JSON.stringify(divs.get("Lingiari")));
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

if (failures) {
  console.error(`\n${failures} FAILURES`);
  process.exit(1);
}
console.log("OK: data/booth-demo-2013.json pinned");
