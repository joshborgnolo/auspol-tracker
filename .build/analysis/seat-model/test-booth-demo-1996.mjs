/* test-booth-demo-1996.mjs — pin the '90s people-interp arc's 1996-census
   half: the 1996 census's collection districts whole-allocated on every
   era division set it flanks, the c1 stores built on this census for the
   1993↔1996 and 1998↔2001 blends, and 1998's measured store.

   Artifacts under test (all committed):
     .build/analysis/seat-model/seifa-src/cd-1996-ced-{1993,1996,1998}set.json
     data/booth-demo-1993-c1.json   (1996-census far side of the 1993 lane)
     data/booth-demo-1996-c1.json   (1996-census far side of the 1996 lane)
     data/booth-demo-1998.json      (1996-census measured side of the 1998 lane)

   Invariants measured 2026-10-30 on the first green emissions:
   1. the three alloc files: universe 34,500 units per asgc1996.gpkg's
      own profile (34,405 polygons + 95 null-spatial offshore scaffold
      rows), placed 34,396 into every era set, eighth-named ABS balance
      classes (the seven Off-Shore Areas & Migratory per-state classes
      and the census scaffold's 'Incl. in Northern Territory 701' CD
      fold-in for Christmas and Cocos — 9 units, 2,561 people,
      division-less by ABS's own filing), two ABS-official CED
      assignments adopted on each lane (1092101 -> Sydney, 2200510 ->
      Gippsland-era: the frame's ABS-filed CDs outside the era
      polygons), and nine profile-free registry pseudos cover every
      still-unplaced CD.
   2. the three 1996-census stores in their frames: booths in the
      published location store's exact order, venue coverage profiles
      per frame (nearest-rescue inside the arc's 1,500 m cap, counts
      carrying each frame's measured numbers); the census-anchor
      national profile pins (persons 17,878,649 after the offshore
      class drop — its 17,881,210 tally wraps the 2,561 external-
      territory people ABS file-keeps division-less).
   3. the measured 1998 lane's interp contract: day-share 0.431308 of
      the 1996->2001 intercensal span, nearest the 1996 census side,
      census nights 1996-08-06 / 2001-08-07, demoI national rows the
      exact f-blend of the two census sides' nationals, and the same
      six-lane-only block doctrine the arc keeps everywhere the '90s
      census era reaches.
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

// the location store's place keys in FILE order: an ordinary
// Object.keys() in JS puts digit-string keys in ascending numeric
// order — not the file's insertion order. Walk braces with a
// string-aware scan so the pin follows the committed record exactly.
const LOCS_TEXT = readFileSync("data/booth-locations-history.json", "utf8");
function yearPlacesKeys(year) {
  const at = LOCS_TEXT.indexOf(`"${year}":`);
  if (at < 0) throw new Error(`election ${year} not in the store`);
  const atp = LOCS_TEXT.indexOf('"places":{', at);
  if (atp < 0) throw new Error(`no places object at ${year}`);
  let depth = 0, inStr = false, esc = false;
  const keys = [];
  for (let i = atp; i < LOCS_TEXT.length; i++) {
    const c = LOCS_TEXT[i];
    if (esc) { esc = false; continue; }
    if (inStr) {
      if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === "{") {
      depth++;
      continue;
    }
    if (c === "}") {
      depth--;
      if (depth === 0) break;
      continue;
    }
    if (c === '"' && depth === 1) {
      const m = /^"([^"]*)":/.exec(LOCS_TEXT.slice(i));
      if (m) keys.push(m[1]);
    }
  }
  return keys;
}

const SRC = ".build/analysis/seat-model/seifa-src";

// 1. the alloc memberships
const ERAS = [["1993set", "cd-1996-ced-1993set.json", 147, 2053, 69],
  ["1996set", "cd-1996-ced-1996set.json", 148, 1611, 69],
  ["1998set", "cd-1996-ced-1998set.json", 148, 1522, 70]];
const allocs = ERAS.map(([label, file, nDivs, split, fb]) => {
  const a = JSON.parse(readFileSync(`${SRC}/${file}`, "utf8"));
  eq([a.unit, a.unitCount, a.placed, a.split, a.fallback],
    ["CD_CODE_1996", 34500, 34396, split, fb],
    `cd-1996-ced-${label} universe`);
  a._nDivs = nDivs;
  return a;
});
for (let i = 0; i < ERAS.length; i++) {
  const [label] = ERAS[i];
  const a = allocs[i];
  eq(a.divisions.length, a._nDivs, `${label}: era's division count`);
  eq(a.absAssigned, ["1092101", "2200510"],
    `${label}: ABS-filed assignments adopted on the outside-polygon rows (Lord Howe, its coast counterpart)`);
  eq(a.unplacedUnscored.length, 9,
    `${label}: nine still-unplaced, all profile-free registry pseudos`);
  eq(a.nullSpatial.length, 95, `${label}: the 95 null-spatial scaffold rows`);
  eq(Object.keys(a.offshoreClass).length, 8,
    `${label}: ABS balance classes named offshoreClass (the seven state Off-Shore Areas & Migratory classes plus the 'Incl. in Northern Territory 701' external-territory fold-in)`);
  eq(a.offshoreClass[
    "Migratory/Off-shore scaffold: Incl. in Northern Territory 701"].population, 2561,
    `${label}: external-territory fold-in people division-less by ABS's own filing`);
  eq(Object.values(a.offshoreClass)
    .reduce((s, r) => s + r.population, 0), 2561,
    `${label}: total offshore population`);
}

// 2. the 1996-census stores in their frames
const nat96 = {
  persons: 17878649, langOther: 0.1556, fborn: 0.2342, uni: 0.1159,
  blue: 0.3439, age0_14: 0.2146, age65ov: 0.1202, u15: 0.2146,
};
const STORES = [
  ["data/booth-demo-1993-c1.json", 1993, 147, 8431, 6383, 2109, 1891, 157],
  ["data/booth-demo-1996-c1.json", 1996, 148, 8463, 6597, 2180, 1706, 160],
  ["data/booth-demo-1998.json", 1998, 148, 8311, 6700, 2208, 1450, 161],
];
for (const [file, year, nDivs, nBooths, geo, near, miss, empty] of STORES) {
  const d = JSON.parse(readFileSync(file, "utf8"));
  const c = d.counts;
  eq([d.election, d.censusEdition], [year, 1996], `${file} header`);
  eq([c.booths, c.boothsGeo, c.boothsGeoNearest, c.boothsGeoMissing,
    c.boothsGeoEmpty, c.divisions, c.cdsTally, c.offshorePop],
    [nBooths, geo, near, miss, empty, nDivs, 34327, 2561],
    `${year} / 1996-side universe pins`);
  eq(c.national, nat96, `${year} / 1996-side national anchors`);
  eq(c.geoNearestCapM, 1500, `${year} nearest-rescue cap`);
  if (file === "data/booth-demo-1998.json") {
    eq([d.demoInterp.f, d.demoInterp.c0, d.demoInterp.c1,
      d.demoInterp.nearestSide],
      [0.431308, 1996, 2001, 1996], "1998 demoInterp record");
    eq(d.demoInterp.censusNights,
      { 1996: "1996-08-06", 2001: "2001-08-07" },
      "1998 demoInterp census nights");
    eq(d.counts.demoI.rows,
      d.booths.filter((b) => b.demoI !== null).length,
      "1998 counts.demoI.rows");
  } else {
    ok(!("demoInterp" in d), `${file} carries no interp of its own`);
  }
  // booth order follows the published location store, file-order of
  // the place records (JS Object.keys() separates digit-keys out)
  eq(d.booths.map((b) => String(b.boothId)), yearPlacesKeys(year),
    `${year} booth order`);
  // six-lane-only block doctrine
  let crossKeys = 0, badShare = 0;
  for (const b of d.booths) {
    if (!b.demo) continue;
    for (const k of ["loinc", "hiinc", "incMed", "cob", "rel", "ten",
      "y12less", "atsci", "onepar"]) crossKeys += (k in b.demo);
    for (const k of ["langOther", "fborn", "uni", "blue", "u15"]) {
      const x = b.demo[k];
      if (x != null && !(x >= 0 && x <= 1)) badShare++;
    }
  }
  eq(crossKeys, 0, `${year}-store blocks carry no cross-era keys`);
  eq(badShare, 0, `${year}-store shares inside [0,1]`);
}
// named-division pins
{
  const d1 = JSON.parse(readFileSync("data/booth-demo-1993-c1.json", "utf8"));
  const by = new Map(d1.divisions.map((x) => [x.div, x]));
  const CT = by.get("Canberra"), SY = by.get("Sydney");
  eq([CT.persons, SY.persons], [147575, 158371], "1996-census Canberra/Sydney persons");
  eq([CT.langOther, CT.fborn, CT.uni, CT.blue],
    [0.1295, 0.2241, 0.2248, 0.2004], "1996-census Canberra lanes");
  eq([SY.langOther, SY.fborn, SY.uni, SY.blue],
    [0.224, 0.4276, 0.2578, 0.1555], "1996-census Sydney lanes");
}

// 3. the 1998 measured-side blend invariants
{
  const d = JSON.parse(readFileSync("data/booth-demo-1998.json", "utf8"));
  const c1 = JSON.parse(readFileSync("data/booth-demo-1998-c1.json", "utf8"));
  const f = 0.431308;
  const LN = (a, b) => Math.round(((1 - f) * a + f * b) * 1e4) / 1e4;
  for (const k of ["langOther", "fborn", "uni", "blue", "age0_14",
    "age65ov", "u15"]) {
    eq(d.counts.demoI.national[k],
      LN(d.counts.national[k], c1.counts.national[k]),
      `1998 demoI national ${k}`);
  }
  eq(c1.counts.national.persons, 18644579,
    "the 1998-c1 store reads the 2001 census's resident anchor");
  // both-sides rule: blocks null when either side's demo is null
  const c1b = new Map(c1.booths.map((x) => [`${x.div}|${x.boothId}`, x]));
  let blend = 0, bothNull = 0, keyok = true;
  for (const b of d.booths) {
    const fb = c1b.get(`${b.div}|${b.boothId}`);
    if (b.demoI === null) {
      bothNull++;
      if (b.demo !== null && fb.demo !== null) keyok = false;
      continue;
    }
    blend++;
    for (const k of ["langOther", "fborn", "uni", "blue", "u15"]) {
      const a = b.demo && b.demo[k], x = fb.demo && fb.demo[k];
      if (a != null && x != null) {
        if (b.demoI[k] !== LN(a, x)) keyok = false;
      } else if (b.demoI[k] !== null) keyok = false;
    }
  }
  ok(keyok, "1998 booth demoI blend/null rule per lane");
  eq(c1.censusEdition, 2001, "1998-c1 census edition");
}

if (failures) {
  console.error(`\n${failures} FAILURES`);
  process.exit(1);
}
console.log("OK: 1996-census side of the '90s people-interp arc pinned (alloc lanes + c1 stores + the 1998 measured-side contract)");
