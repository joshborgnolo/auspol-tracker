#!/usr/bin/env node
/* test-booth-demo-2006.mjs — pin data/booth-demo-2007.json and
   data/booth-demo-2010.json
   (derive-booth-demo-2006.py: the census-people venue-proxy stores for
   the 2007 and 2010 elections — 2006 Census BCP counts of each booth's
   geo collection district per booth, and the exact census sums per
   division over the whole-unit CD allocations of
   seifa-src/cd-2006-ced-{2006ed,2010set}.json; siblings of
   booth-demo-2013.json on the 2006 census).

   Invariants (universe + value pins measured 2026-10-26 on the first
   green emission):

   1. Universe: booth rows in the EXACT order of each venue store
      (data/booth-seifa-2007.json / -2010.json); 150 divisions,
      alphabetically within the eight-state order; the null-demo
      counts pin (no-venue booms + uninhabited venue CDs).
   2. Keys + shape: (divId, boothId) unique; a non-null demo block
      carries persons >= 1, cov 1.0, every share in [0,1], and an age
      dict over the 11 B01 bands summing ~1.
   3. National row: exact pins, identical across the two years — the
      pools are census counts on the same 2006-CD universe; only the
      division membership differs. Persons is the allocated-CD
      universe (the nine migratory/offshore pseudo rows of the BCP
      join no division).
   4. Division anchors: Sydney/Fowler/Lingiari figures each year; the
      Bennelong (and Lingiari/Wentworth) rows are byte-identical
      between the eras — those divisions were untouched by the
      redistributions between the elections, so both eras pool the
      same CD membership. Fowler changes exactly because its boundary
      moved. Division extrema pins per lane.
   5. Reconciliation: sum over divisions of persons == the national
      persons exactly (integer count, not share arithmetic).
   6. Provenance: _provenance.files names the census06bcp.zip anchor,
      the era allocation store, and the year's venue store.
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

// exact national pins (the 2006-CD allocated universe, identical both
// years — the era difference is membership only)
const NATIONAL = {
  persons: 19813809,
  langOther: 0.1681,
  fborn: 0.2388,
  uni: 0.1765,
  blue: 0.3204,
  age0_14: 0.1985,
  age65ov: 0.1333,
};

// per-year pins measured on the first green emission
const YEARS = {
  2007: {
    booths: 8235, geoMissing: 516, geoEmpty: 25,
    laneNull: { langOther: 1, fborn: 1, uni: 0, blue: 4, age: 0 },
    sydney: { persons: 151970, langOther: 0.2894, fborn: 0.4363,
      uni: 0.4376, blue: 0.1299 },
    fowler: { persons: 135571, langOther: 0.6011, fborn: 0.4568,
      uni: 0.0836, blue: 0.4495 },
    maxLang: ["Watson", 0.6771], minLang: ["Lyons", 0.0161],
    maxFb: ["Reid", 0.546], minFb: ["Parkes", 0.0563],
    maxUni: ["North Sydney", 0.4556], minUni: ["Wakefield", 0.0578],
    maxBlue: ["Flynn", 0.473], minBlue: ["North Sydney", 0.1016],
    oldest: ["Gilmore", 0.2144], youngest: ["Lingiari", 0.0432],
  },
  2010: {
    booths: 8951, geoMissing: 599, geoEmpty: 42,
    laneNull: { langOther: 3, fborn: 49, uni: 0, blue: 55, age: 0 },
    sydney: { persons: 156713, langOther: 0.2994, fborn: 0.439,
      uni: 0.4328, blue: 0.1335 },
    fowler: { persons: 142967, langOther: 0.6909, fborn: 0.53,
      uni: 0.0808, blue: 0.4853 },
    maxLang: ["Watson", 0.6919], minLang: ["Lyons", 0.0151],
    maxFb: ["Fowler", 0.53], minFb: ["Parkes", 0.0533],
    maxUni: ["North Sydney", 0.4456], minUni: ["Wakefield", 0.0578],
    maxBlue: ["Fowler", 0.4853], minBlue: ["North Sydney", 0.1085],
    oldest: ["Lyne", 0.2117], youngest: ["Lingiari", 0.0432],
  },
};

const LINGIARI = {
  div: "Lingiari", state: "NT", persons: 101436, cov: 1,
  langOther: 0.3687, fborn: 0.1015, uni: 0.1085, blue: 0.3867,
};

const a65 = (x) => x.age["65_74"] + x.age["75_84"] + x.age["85ov"];

for (const year of [2007, 2010]) {
  const P = YEARS[year];
  const d = JSON.parse(
    readFileSync(`data/booth-demo-${year}.json`, "utf8"));
  const venue = JSON.parse(
    readFileSync(`data/booth-seifa-${year}.json`, "utf8"));

  // 1. universe + order
  eq(d.election, year, `${year} election`);
  eq(d.censusEdition, 2006, `${year} censusEdition`);
  eq(d.counts.booths, P.booths, `${year} counts.booths`);
  eq(d.counts.booths, venue.booths.length, `${year} booth count vs venue`);
  eq(d.booths.map((b) => b.boothId), venue.booths.map((b) => b.boothId),
    `${year} booth order == venue store order`);
  eq(d.counts.divisions, 150, `${year} counts.divisions`);
  eq(d.counts.boothsGeoMissing, P.geoMissing, `${year} geoMissing`);
  eq(d.counts.boothsGeoEmpty, P.geoEmpty, `${year} geoEmpty`);
  eq(d.counts.boothsGeo, P.booths - P.geoMissing - P.geoEmpty,
    `${year} counts.boothsGeo`);
  eq(d.counts.cdBcp, 38713, `${year} counts.cdBcp`);
  eq(d.counts.cdAlloc, 38704, `${year} counts.cdAlloc`);

  // 2. keys + shape
  {
    const keys = new Set();
    let nulls = 0;
    const laneNull = { langOther: 0, fborn: 0, uni: 0, blue: 0, age: 0 };
    for (const b of d.booths) {
      const k = b.divId + "|" + b.boothId;
      ok(!keys.has(k), `${year} dup booth key ${k}`);
      keys.add(k);
      if (b.demo === null) { nulls++; continue; }
      const dm = b.demo;
      ok(dm.persons >= 1 && dm.cov === 1.0,
        `${year} demo pers/cov ${k}`);
      for (const f of ["langOther", "fborn", "uni", "blue"]) {
        ok(dm[f] === null || (dm[f] >= 0 && dm[f] <= 1),
          `${year} share range ${f} ${k}`);
        if (dm[f] === null) laneNull[f]++;
      }
      if (dm.age === null) laneNull.age++;
      if (dm.age) {
        eq(Object.keys(dm.age), BANDS, `${year} age bands ${k}`);
        const s = BANDS.reduce((t, x) => t + dm.age[x], 0);
        ok(Math.abs(s - 1) < 0.01, `${year} age sums ~1 ${k}: ${s}`);
      }
    }
    eq(nulls, P.geoMissing + P.geoEmpty,
      `${year} null demo == geo missing + geo empty`);
    eq(laneNull, P.laneNull, `${year} lane nulls (tiny-CD perturbation)`);
  }

  // 3. national pins
  eq(d.counts.national, NATIONAL, `${year} counts.national`);

  // 4. division anchors + extrema
  {
    const divs = new Map(d.divisions.map((x) => [x.div, x]));
    const f = ["persons", "langOther", "fborn", "uni", "blue"];
    eq(f.map((k) => divs.get("Sydney")[k]),
      f.map((k) => P.sydney[k]), `${year} Sydney figures`);
    eq(f.map((k) => divs.get("Fowler")[k]),
      f.map((k) => P.fowler[k]), `${year} Fowler figures`);
    const L = divs.get("Lingiari");
    eq(f.map((k) => L[k]), f.map((k) => LINGIARI[k]),
      `${year} Lingiari figures`);
    eq([L.state, L.cov], ["NT", 1], `${year} Lingiari state/cov`);
    console.log(`${year} Lingiari:`, JSON.stringify(L));
    const sr = (g) => [...d.divisions].sort((a, b) => g(b) - g(a));
    const lang = sr((x) => x.langOther);
    eq([lang[0].div, lang[0].langOther], P.maxLang,
      `${year} max language-other`);
    eq([lang.at(-1).div, lang.at(-1).langOther], P.minLang,
      `${year} min language-other`);
    const fb = sr((x) => x.fborn);
    eq([fb[0].div, fb[0].fborn], P.maxFb, `${year} max overseas-born`);
    eq([fb.at(-1).div, fb.at(-1).fborn], P.minFb,
      `${year} min overseas-born`);
    const uni = sr((x) => x.uni);
    eq([uni[0].div, uni[0].uni], P.maxUni, `${year} max university`);
    eq([uni.at(-1).div, uni.at(-1).uni], P.minUni,
      `${year} min university`);
    const blue = sr((x) => x.blue);
    eq([blue[0].div, blue[0].blue], P.maxBlue,
      `${year} max blue-collar`);
    eq([blue.at(-1).div, blue.at(-1).blue], P.minBlue,
      `${year} min blue-collar`);
    const age = sr((x) => a65(x));
    eq([age[0].div, +a65(age[0]).toFixed(4)], P.oldest,
      `${year} oldest`);
    eq([age.at(-1).div, +a65(age.at(-1)).toFixed(4)], P.youngest,
      `${year} youngest`);
    // sort-order: state order then div, non-decreasing
    const STATES = ["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"];
    const ORD = STATES.indexOf.bind(STATES);
    for (let i = 1; i < d.divisions.length; i++) {
      const [p, q] = [d.divisions[i - 1], d.divisions[i]];
      ok(ORD(p.state) < ORD(q.state) ||
         (p.state === q.state && p.div <= q.div),
        `${year} division sort ${p.div},${q.div}`);
    }
  }

  // 5. persons reconciliation (exact integer count)
  eq(d.divisions.reduce((t, x) => t + x.persons, 0),
    d.counts.national.persons, `${year} division persons pool == national`);

  // 6. provenance
  {
    const fl = d._provenance.files;
    ok(Object.keys(fl).some((k) => k.endsWith("census06bcp.zip")),
      `${year} prov bcp`);
    const alloc = year === 2007 ? "cd-2006-ced-2006ed.json"
                                : "cd-2006-ced-2010set.json";
    ok(Object.keys(fl).some((k) => k.endsWith(alloc)),
      `${year} prov alloc ${alloc}`);
    ok(Object.keys(fl).some((k) =>
      k.endsWith(`data/booth-seifa-${year}.json`)), `${year} prov venue`);
  }
}

// boundary-unchanged divisions carry identical division rows in both
// eras; Fowler (redistributed) must differ
{
  const d7 = new Map(JSON.parse(readFileSync("data/booth-demo-2007.json",
    "utf8")).divisions.map((x) => [x.div, x]));
  const d0 = new Map(JSON.parse(readFileSync("data/booth-demo-2010.json",
    "utf8")).divisions.map((x) => [x.div, x]));
  for (const n of ["Bennelong", "Lingiari", "Wentworth"]) {
    eq(JSON.stringify(d0.get(n)), JSON.stringify(d7.get(n)),
      `${n} row identical across eras (unchanged boundary)`);
  }
  ok(JSON.stringify(d0.get("Fowler")) !== JSON.stringify(d7.get("Fowler")),
    "Fowler row differs across eras (redistributed)");
}

if (failures) {
  console.error(`\n${failures} FAILURES`);
  process.exit(1);
}
console.log("OK: data/booth-demo-2007.json + data/booth-demo-2010.json pinned");
