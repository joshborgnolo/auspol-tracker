/* test-booth-demo-1991.mjs — pin the '90s people-interp arc's 1991-census
   half: the whole-era memberships of the 1991 census's collection
   districts against the Handbook-era division sets, the measured
   election stores built on that census, and the interp contracts of
   the frames braced on the 1991 side (1993, 1996).

   Artifacts under test (all committed):
     .build/analysis/seat-model/seifa-src/cd-1991-ced-{1993,1996}set.json
     data/booth-demo-1993.json         (c0 of the 1993 interp lane)
     data/booth-demo-1996.json         (c0 of the 1996 interp lane)

   Invariants measured 2026-10-30 on the first green emissions:
   1. the two alloc files: universe 31,410 units per the 1991 gpkg's
      own profile (31,315 polygons + 95 null-spatial registry
      pseudos), placed 31,315 all era sets, three ABS-official
      assignments adopted on each (1092101 -> Sydney — Lord Howe, its
      handbook frame stops at the coastline; 2042010 -> Gippsland, the
      Bass Strait Islands CD whose SLA group is otherwise rescuable-
      free; 3020401 -> Kennedy, the Torres Strait Unincorp. Islands
      row), 14 Off-Shore Areas and Migratory units (the census's own
      1991 single offshore class, 3 persons total), and the remaining
      72 registry pseudos carrying zero residents per the AURIN tally.
   2. the measured stores: booths in the published location store's
      exact order (the era's own composite boothId scheme), venue
      coverage profiles per store (k5/K6's PIP + era-linework nearest
      rescue inside 1,500 m — derive-booth-demo-90s.py header and
      its counts carry each frame's measured numbers), division sets
      exact per election (147 / 148), the census-anchor national
      profile pins (persons 16,841,569 after the offshore class's
      drop — the extract's published envelope 16,841,572 matches
      within its printed pseudo row's three offshore people).
   3. the interp contract on the measured side: demoInterp record
      (1993: day-share 0.320197 of the 1991->1996 intercensal span,
      nearest the 1991 side; 1996: 0.914067, nearest 1996), census
      nights 1991-08-06 / 1996-08-06, per-lane null rules, demoI
      national rows exactly the f-blend of the two census sides'
      nationals, and — the '90s arc's own gospel — not one income / cob
      / religion / tenure / year-12 / Indigenous / one-parent key
      anywhere on this side's blocks (those lanes ride the 2001+
      arcs' own census editions only).
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

const LOCS_TEXT = readFileSync("data/booth-locations-history.json", "utf8");

const SRC = ".build/analysis/seat-model/seifa-src";

// 1. the alloc memberships
const a93 = JSON.parse(readFileSync(`${SRC}/cd-1991-ced-1993set.json`, "utf8"));
const a96 = JSON.parse(readFileSync(`${SRC}/cd-1991-ced-1996set.json`, "utf8"));
for (const [a, era, nDivs, split] of [[a93, "1993set", 147, 2012], [a96, "1996set", 148, 1651]]) {
  eq([a.unit, a.unitCount, a.placed, a.split, a.fallback],
    ["CD_CODE_1991", 31410, 31315, split, 15], `cd-1991-ced-${era} universe`);
  eq(a.divisions.length, nDivs, `cd-1991-ced-${era} covers the era's ${nDivs} divisions`);
  eq(a.absAssigned, ["1092101", "2042010", "3020401"],
    `cd-1991-ced-${era} adopts ABS-filed official assignments (Lord Howe, Bass Strait, Unincorp. Islands)`);
  eq(a.unplacedUnscored.length, 0, `cd-1991-ced-${era} leaves nothing unscored outside classes`);
  eq(a.nullSpatial.length, 95, `cd-1991-ced-${era} carries the 95 null-spatial registry pseudos untouched`);
  eq([a.offshoreClass["Off-Shore Areas and Migratory"].units,
    a.offshoreClass["Off-Shore Areas and Migratory"].population], [14, 3],
    `cd-1991-ced-${era} the 1991 single offshore class`);
  eq(Object.keys(a.alloc).length, 31315, `cd-1991-ced-${era} alloc map size`);
}
// no 1991 alloc lane ever uses the asgc1991 gpkg's own CED attribute
// (the '90s eras' certified names gate it — the frame votes
// handbook-era, never ABS-sprung): the two era sets differ in the
// 1996 redistribution's own re-cutting (Corinella retired; Longman
// and Namadgi draw in — 149 certified names across the two arcs)
{
  const t93 = new Set(a93.divisions), t96 = new Set(a96.divisions);
  const gone = a93.divisions.filter((n) => !t96.has(n));
  const came = a96.divisions.filter((n) => !t93.has(n));
  eq(gone, ["Corinella"], "1993-era divisions retired by 1996");
  eq(came, ["Longman", "Namadgi"], "divisions arriving at the 1996 redistribution");
}

// 2. the measured stores
const d93 = JSON.parse(readFileSync("data/booth-demo-1993.json", "utf8"));
const d96 = JSON.parse(readFileSync("data/booth-demo-1996.json", "utf8"));
const nat91 = {
  persons: 16841569, langOther: 0.1538, fborn: 0.2278, uni: 0.0861,
  blue: 0.3531, age0_14: 0.2235, age65ov: 0.1132, u15: 0.2235,
};
for (const [d, year, nDivs, nBooths, geo, near, miss, empty] of [
  [d93, 1993, 147, 8431, 6399, 2012, 1891, 141],
  [d96, 1996, 148, 8463, 6615, 2082, 1706, 142],
]) {
  const c = d.counts;
  eq([d.election, d.censusEdition], [year, 1991], `${year} c0 header`);
  eq([c.booths, c.boothsGeo, c.boothsGeoNearest, c.boothsGeoMissing,
    c.boothsGeoEmpty, c.divisions, c.cdsTally, c.offshorePop],
    [nBooths, geo, near, miss, empty, nDivs, 31401, 3],
    `${year} c0 universe pins (geo ${geo} pip + ${near} nearest-rescue)`);
  eq(c.national, nat91, `${year} national (1991-census anchors)`);
  eq(c.geoNearestCapM, 1500, `${year} nearest-rescue cap`);
  ok(c.geoNearestDistP50 > 100 && c.geoNearestDistP50 < 300,
    `${year} rescue-distance profile landline (${c.geoNearestDistP50}m p50)`);
  // the interp record on the measured side
  if (year === 1993) {
    eq([d.demoInterp.f, d.demoInterp.c0, d.demoInterp.c1,
      d.demoInterp.nearestSide, d.demoInterp.blend],
      [0.320197, 1991, 1996, 1991, "shares"], "1993 demoInterp record");
  } else {
    eq([d.demoInterp.f, d.demoInterp.c0, d.demoInterp.c1,
      d.demoInterp.nearestSide, d.demoInterp.blend],
      [0.914067, 1991, 1996, 1996, "shares"], "1996 demoInterp record");
  }
  eq(d.demoInterp.censusNights, { 1991: "1991-08-06", 1996: "1996-08-06" },
    `${year} demoInterp census nights`);
  // booth order == the published location store's per-election
  // register **in file order** (Object.keys() puts digit-keys in
  // numeric order in JS — the file's own sequence is what follows)
  eq(d.booths.map((b) => String(b.boothId)), yearPlacesKeys(year),
    `${year} booth order follows the location store`);
  // '90s-side blocks hold only the six GCP-era lanes — no income, cob,
  // rel, ten, y12less, atsci, onepar surfaces anywhere
  let shellKeys = 0, shellBad = 0, nulls = 0, shellDud = 0;
  for (const b of d.booths) {
    if (b.demo === null) {
      nulls++;
      continue;
    }
    for (const k of ["loinc", "hiinc", "incMed", "cob", "rel", "ten",
      "y12less", "atsci", "onepar"]) shellKeys += (k in b.demo);
    for (const k of ["langOther", "fborn", "uni", "blue", "u15"]) {
      const x = b.demo[k];
      if (x == null) shellDud++;
      else if (!(x >= 0 && x <= 1)) shellBad++;
    }
  }
  ok(shellKeys === 0 && !shellBad,
    `${year} blocks hold only the six lanes (${shellKeys} cross-era keys leaked, ${shellBad} shares out of range)`);
  // the null-demo profile: miss+empty rows plus the venue-adjacent
  // census-era registry rows themselves population-free (i.e. a zero-
  // resident CD assignment, 12 such rows per frame — see
  // derive-booth-demo-90s.py's share() doctrine)
  eq(nulls, miss + empty + 12, `${year} null-demo profile`);
  // divisions: exact-membership via the alloc's name space
  eq(d.divisions.map((x) => x.div).sort(),
    (year === 1993 ? a93 : a96).divisions.slice().sort(),
    `${year} division names == the alloc's era set`);
}
// division-persons / lane pins measured at the era memos
{
  const by = new Map(d93.divisions.map((x) => [x.div, x]));
  const CT = by.get("Canberra"), SY = by.get("Sydney");
  eq([CT.persons, SY.persons], [135995, 142086], "1993 Canberra/Sydney persons");
  eq([CT.langOther, CT.fborn, CT.uni, CT.blue],
    [0.1369, 0.2311, 0.1863, 0.2131], "1993 Canberra lane pins");
  eq([SY.langOther, SY.fborn, SY.uni, SY.blue],
    [0.2304, 0.3884, 0.2154, 0.2146], "1993 Sydney lane pins");
}
// 3. the demoI blend arithmetic, head-line invariants (both years)
for (const [d, year, f, c1fn] of [
  [d93, 1993, 0.320197, "data/booth-demo-1993-c1.json"],
  [d96, 1996, 0.914067, "data/booth-demo-1996-c1.json"],
]) {
  const c0nat = d.counts.national;
  const c1 = JSON.parse(readFileSync(c1fn, "utf8"));
  const c1nat = c1.counts.national;
  const LN = (a, b) => Math.round(((1 - f) * a + f * b) * 1e4) / 1e4;
  for (const k of ["langOther", "fborn", "uni", "blue", "age0_14",
    "age65ov", "u15"]) {
    eq(d.counts.demoI.national[k], LN(c0nat[k], c1nat[k]),
      `${year} demoI national ${k}`);
  }
  eq(d.counts.demoI.rows,
    d.booths.filter((b) => b.demoI !== null).length,
    `${year} counts.demoI.rows`);
  // both-sides rule on booth blocks: demoI null iff either side null
  const c1b = new Map(c1.booths.map((x) => [`${x.div}|${x.boothId}`, x]));
  let blend = 0, bothNull = 0, keyok = true;
  const ALLOWED = new Set(["persons", "cov", "age", "langOther",
    "fborn", "uni", "blue", "u15", "loinc", "hiinc", "y12less", "atsci",
    "onepar", "rel", "ten", "incMed"]);
  for (const b of d.booths) {
    const fb = c1b.get(`${b.div}|${b.boothId}`);
    if (b.demoI === null) {
      bothNull++;
      if (b.demo !== null && (fb.demo !== null)) keyok = false;
      continue;
    }
    blend++;
    if (!Object.keys(b.demoI).every((k) => ALLOWED.has(k))) keyok = false;
    for (const k of ["langOther", "fborn", "uni", "blue", "u15"]) {
      const a = b.demo && b.demo[k], x = fb.demo && fb.demo[k];
      if (a != null && x != null) {
        if (b.demoI[k] !== LN(a, x)) keyok = false;
      } else if (b.demoI[k] !== null) keyok = false;
    }
  }
  ok(keyok, `${year} booth demoI keys + per-lane blend/null rule`);
  eq(c1.censusEdition, 1996, `${year}-c1 census edition`);
}

if (failures) {
  console.error(`\n${failures} FAILURES`);
  process.exit(1);
}
console.log("OK: 1991-census side of the '90s people-interp arc pinned (alloc lanes + measured stores + interp contracts)");
