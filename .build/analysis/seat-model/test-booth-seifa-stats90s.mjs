#!/usr/bin/env node
/* test-booth-seifa-stats90s.mjs — pin data/booth-seifa-{1993,1996,1998,2001}.json
   (derive-booth-seifa-stats90s.py: the SEIFA lane on the statistics-era
   federal frames). Contract per store:

   1993/1996/1998 — NEW files over the history-location venue registry
   (booth ids asserted to equal the frame's own composite universe);
   1993 -> measured SEIFA-91 | interp c1 1996 (f 0.320197, nearest c0),
   1996 -> measured SEIFA-96 | interp c0 1991 (f 0.914067, nearest c1),
   1998 -> measured SEIFA-96 | interp c1 2001 (f 0.431308, nearest c0).
   2001 — READ-MODIFY-WRITE into the committed venue store: its own
   received coords, measured SEIFA-2001 only (the measured-only
   doctrine; no _pcti, seifaPct or seifaInterp anywhere), four indexes
   (IRSAD was invented at the 2001 census).

   Invariants per store: header facts (election/seifaEdition/geography/
   indexes); universe + exact counts histogram of the green-family runs
   (2026-10-31); unique boothId; censusGeo a 7-digit era code exactly on
   scored/suppressed rows; every landed seifa cell carries a full dec
   map of integers 1..10; interp rows recompute pcti bit-exact from
   stored pct0/pct1 at the day's f and pct == measured side's interpcm;
   _pcti header facts vs day-recompute; literal cells measured on the
   first green runs.
*/

import { readFileSync } from "node:fs";

// run from the repo root (like every other seat-model test)
const R = (p) => JSON.parse(readFileSync(p, "utf8"));

let failures = [];
const check = (ok, msg) => { if (!ok) failures.push(msg); };

const IDX3 = ["irsd", "ier", "ieo"];
// measured on the AURIN seifa_cd cube reads 2026-10-31 (the exact
// closed envelope of each cube's own scores)
const CUBE_ENV = {
  1991: { irsd: [386.3, 1231.5], ier: [601.7, 1390.4], ieo: [605.1, 1391.3] },
  1996: { irsd: [356.5, 1249.3], ier: [567.2, 1377.4], ieo: [577.9, 1341.2] },
  2001: { irsd: [231.8, 1213.3], ier: [701.2, 1371.9], ieo: [565.0, 1306.0], irsad: [597.3, 1312.5] },
};
const CENSUS_NIGHT = { 1991: "1991-08-06", 1996: "1996-08-06", 2001: "2001-08-07" };

const YEARS = {
  1993: {
    edition: 1991, geography: "CD (ASGC 1991)", indexes: IDX3,
    rows: 8431, divs: 147, registry: "frame",
    counts: { interp: 6230, scored: 6352, noCoords: 1891, geoNearest: 2012, seifaSuppressed: 47, interpFarSuppressed: 68, pointOutside: 141, interpFarOutside: 54, booths: 8431 },
    pcti: { f: 0.320197, measured: "pct0", c0: 1991, c1: 1996, date: "1993-03-13", booths: 6230 },
    spots: [
      ["Banks", "Beverly Hills North", { seifa: { irsd: 995.1, ier: 1008.3, ieo: 997.3 }, dec: { irsd: 5, ier: 6, ieo: 6 }, geo: "1350307", interp: { irsd: { pct0: 0.425591, pct1: 0.590488, pcti: 0.478391 } } }],
      ["Ryan", "Indooroopilly East", { seifa: { irsd: 1222.3, ier: 1265.5, ieo: 1303.1 }, dec: { irsd: 10, ier: 10, ieo: 10 }, geo: "3231907" }],
      ["Banks", "Riverwood North", { seifa: { irsd: 408.6, ier: 649.9, ieo: 817.1 }, dec: { irsd: 1, ier: 1, ieo: 1 }, geo: "1350115" }],
      ["Berowra", "Mount Kuring-Gai", { suppressed: true }],
      ["Northern Territory", "Alice Springs", { dec: { irsd: 3, ier: 4, ieo: 8 } }],
    ],
  },
  1996: {
    edition: 1996, geography: "CD (ASGC 1996)", indexes: IDX3,
    rows: 8463, divs: 148, registry: "frame",
    counts: { geoNearest: 2180, interp: 6441, scored: 6553, noCoords: 1706, seifaSuppressed: 90, pointOutside: 114, interpFarSuppressed: 27, interpFarOutside: 85, otTerritory: 2, booths: 8463 },
    pcti: { f: 0.914067, measured: "pct1", c0: 1991, c1: 1996, date: "1996-03-02", booths: 6441 },
    spots: [
      ["Banks", "Beverly Hills North", { seifa: { irsd: 1031.1, ier: 1058.4, ieo: 1021.5 }, dec: { irsd: 6, ier: 8, ieo: 7 }, geo: "1350308", interp: { irsd: { pct0: 0.425591, pct1: 0.590488, pcti: 0.576318 } } }],
      ["McPherson", "Robina", { seifa: { irsd: 1223.4, ier: 1015.9, ieo: 1186 }, dec: { irsd: 10, ier: 6, ieo: 10 }, geo: "3170401" }],
      ["Swan", "Bentley South", { seifa: { irsd: 531.7, ier: 698.1, ieo: 802.2 }, dec: { irsd: 1, ier: 1, ieo: 1 }, geo: "5080803" }],
      ["Berowra", "Mount Kuring-Gai", { suppressed: true }],
      ["Northern Territory", "Alice Springs", { dec: { irsd: 4, ier: 2, ieo: 9 } }],
    ],
  },
  1998: {
    edition: 1996, geography: "CD (ASGC 1996)", indexes: IDX3,
    rows: 8311, divs: 148, registry: "frame",
    counts: { interp: 6479, scored: 6656, noCoords: 1450, geoNearest: 2208, seifaSuppressed: 91, otTerritory: 2, interpFarSuppressed: 117, pointOutside: 114, interpFarOutside: 60, booths: 8311 },
    pcti: { f: 0.431308, measured: "pct0", c0: 1996, c1: 2001, date: "1998-10-03", booths: 6479 },
    spots: [
      ["Banks", "Beverly Hills North", { seifa: { irsd: 1031.1, ier: 1058.4, ieo: 1021.5 }, dec: { irsd: 6, ier: 8, ieo: 7 }, geo: "1350308", interp: { irsd: { pct0: 0.590488, pct1: 0.553327, pcti: 0.57446 } } }],
      ["McPherson", "Robina", { seifa: { irsd: 1223.4 }, dec: { irsd: 10 }, geo: "3170401" }],
      ["Swan", "Bentley South", { seifa: { irsd: 531.7 }, dec: { irsd: 1 }, geo: "5080803" }],
      ["Berowra", "Mount Kuring-Gai", { suppressed: true }],
      ["Northern Territory", "Alice Springs", { dec: { irsd: 4, ier: 2, ieo: 9 } }],
    ],
  },
  2001: {
    edition: 2001, geography: "CD (ASGC 2001)", indexes: ["irsd", "ier", "ieo", "irsad"],
    rows: 7701, lambda: "read-modify-write", registry: "store",
    counts: { scored: 6877, geoNearest: 2319, noCoords: 505, seifaSuppressed: 204, otTerritory: 4, pointOutside: 115, booths: 7701 },
    pcti: null, // measured-only doctrine
    spots: [
      ["Banks", "Beverly Hills North", { seifa: { irsd: 1024.8, ier: 1077.7, ieo: 1020.1, irsad: 1036.9 }, dec: { irsd: 6, ier: 8, ieo: 7, irsad: 7 } }],
    ],
  },
};
const STATE_ORDER = ["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"];
const R6 = (x) => Math.round(x * 1e6) / 1e6;

for (const [ys, spec] of Object.entries(YEARS)) {
  const y = Number(ys);
  const s = R(`data/booth-seifa-${y}.json`);
  check(s.election === y, `${y}: election ${s.election}`);
  check(s.seifaEdition === spec.edition, `${y}: seifaEdition ${s.seifaEdition}`);
  check(s.geography === spec.geography, `${y}: geography ${s.geography}`);
  check(JSON.stringify(s.indexes) === JSON.stringify(spec.indexes), `${y}: indexes ${s.indexes}`);
  check(s.booths.length === spec.rows, `${y}: registry rows ${s.booths.length} != ${spec.rows}`);
  const counts = s.counts || s.seifaCounts;
  for (const [k, v] of Object.entries(spec.counts)) {
    check(counts[k] === v, `${y}: counts.${k} ${counts[k]} != pin ${v}`);
  }
  if (spec.registry === "frame") {
    const r = R(`map/data/res-${y}.json`);
    const frameIds = new Set(r.booths.id);
    const storeIds = new Set(s.booths.map((b) => b.boothId));
    check(frameIds.size === storeIds.size && [...frameIds].every((id) => storeIds.has(id)),
      `${y}: store registry != frame booth universe`);
    let prev = -1e9;
    for (const b of s.booths) {
      const key = STATE_ORDER.indexOf(b.state) * 1e12 + b.boothId;
      check(key >= prev, `${y}: registry not in state/divId order at ${b.boothId}`);
      prev = key;
    }
  }
  const seen = new Set();
  let scored = 0, suppressed = 0, outside = 0, noC = 0;
  for (const b of s.booths) {
    check(!seen.has(b.boothId), `${y}: duplicate boothId ${b.boothId}`);
    seen.add(b.boothId);
    if (b.censusGeo != null) check(/^\d{7}$/.test(b.censusGeo), `${y}: censusGeo ${b.censusGeo} not a 7-digit code`);
    if (b.seifa == null) {
      noC += b.note === "noCoords" ? 1 : 0;
      suppressed += b.note === "seifaSuppressed" ? 1 : 0;
      outside += b.note === "pointOutside" ? 1 : 0;
      check(b.seifaPct === undefined && b.seifaInterp === undefined, `${y} ${b.boothId}: null lane carries interp shards`);
      check(b.censusGeo != null || b.note === "noCoords" || b.note === "badCoords" || b.note === "pointOutside", `${y} ${b.boothId}: null seifa without a note discipline`);
      continue;
    }
    scored++;
    check(b.censusGeo != null, `${y} ${b.boothId}: scored row has no censusGeo`);
    const idxs = spec.indexes;
    for (const ix of idxs) {
      check(typeof b.seifa[ix] === "number", `${y} ${b.boothId} ${ix}: score not a number`);
      const [lo, hi] = CUBE_ENV[spec.edition][ix];
      check(b.seifa[ix] >= lo && b.seifa[ix] <= hi, `${y} ${b.boothId} ${ix}=${b.seifa[ix]} outside ${spec.edition} envelope`);
      const d = b.seifa.dec[ix];
      check(Number.isInteger(d) && d >= 1 && d <= 10, `${y} ${b.boothId} ${ix}: dec ${d}`);
    }
    if (s._pcti) {
      const pct = b.seifaPct || {};
      for (const ix of spec.indexes) {
        if (pct[ix] != null) {
          check(pct[ix] > 0 && pct[ix] <= 1, `${y} ${b.boothId} ${ix}: pct outside (0,1]`);
          const iv = b.seifaInterp && b.seifaInterp[ix];
          if (iv) {
            check(iv.pcti === R6((1 - s._pcti.f) * iv.pct0 + s._pcti.f * iv.pct1),
              `${y} ${b.boothId} ${ix}: pcti not recomputed from stored sides at f`);
            check(iv[s._pcti.measured] === pct[ix],
              `${y} ${b.boothId} ${ix}: measured side ${s._pcti.measured} != pct ${pct[ix]}`);
          }
        }
      }
    } else {
      check(b.seifaPct === undefined && b.seifaInterp === undefined,
        `${y} ${b.boothId}: interp shard on a measured-only row`);
    }
  }
  check(scored === spec.counts.scored, `${y}: travelled scored ${scored} != counts pin ${spec.counts.scored}`);
  check(noC === (spec.counts.noCoords || 0), `${y}: noCoords rows ${noC} != pin`);
  check(suppressed === (spec.counts.seifaSuppressed || 0), `${y}: seifaSuppressed rows ${suppressed} != pin`);
  check(outside === (spec.counts.pointOutside || 0), `${y}: pointOutside rows ${outside} != pin`);
  if (spec.pcti) {
    check(s._pcti && s._pcti.f === spec.pcti.f && s._pcti.measured === spec.pcti.measured &&
          s._pcti.c0 === spec.pcti.c0 && s._pcti.c1 === spec.pcti.c1 && s._pcti.date === spec.pcti.date,
      `${y}: _pcti header facts ${JSON.stringify(s._pcti)}`);
    check(s._pcti.booths === spec.pcti.booths, `${y}: _pcti.booths ${s._pcti.booths} != pin`);
    check(s._pcti.censusNights[String(spec.pcti.c0)] === CENSUS_NIGHT[spec.pcti.c0] &&
          s._pcti.censusNights[String(spec.pcti.c1)] === CENSUS_NIGHT[spec.pcti.c1],
      `${y}: censusNights drift`);
    // f recompute from the recorded nights
    const d0 = new Date(CENSUS_NIGHT[spec.pcti.c0] + "T00:00:00Z");
    const d1 = new Date(CENSUS_NIGHT[spec.pcti.c1] + "T00:00:00Z");
    const de = new Date(spec.pcti.date + "T00:00:00Z");
    const f = R6((de - d0) / (d1 - d0));
    check(f === spec.pcti.f, `${y}: f ${f} != _pcti's ${spec.pcti.f}`);
  } else {
    check(!s._pcti, `${y}: measured-only store carries a _pcti block`);
  }
  // literal spot cells
  for (const [div, booth, want] of spec.spots || []) {
    const row = s.booths.find((b) => b.div === div && b.booth === booth);
    check(row != null, `${y}: no row ${div}|${booth}`);
    if (!row) continue;
    if (want.suppressed) {
      check(row.seifa === null && row.note === "seifaSuppressed",
        `${y} ${div}|${booth}: expected seifaSuppressed, got ${row.note} ${JSON.stringify(row.seifa)}`);
      continue;
    }
    for (const [ix, v] of Object.entries(want.seifa || {}))
      check(row.seifa[ix] === v, `${y} ${div}|${booth} ${ix}: ${row.seifa[ix]} != ${v}`);
    for (const [ix, v] of Object.entries(want.dec || {}))
      check(row.seifa.dec[ix] === v, `${y} ${div}|${booth} dec.${ix}: ${row.seifa.dec[ix]} != ${v}`);
    if (want.geo) check(row.censusGeo === want.geo, `${y} ${div}|${booth}: censusGeo ${row.censusGeo} != ${want.geo}`);
    if (want.interp) for (const [ix, cell] of Object.entries(want.interp))
      for (const [k2, v2] of Object.entries(cell))
        check(row.seifaInterp[ix][k2] === v2, `${y} ${div}|${booth} interp.${ix}.${k2}: ${row.seifaInterp[ix][k2]} != ${v2}`);
  }
  // header provenance seams
  if (spec.registry === "store") {
    check(s._provenance && s._provenance.seifa && s._provenance.seifa.files,
      `${y}: RMW provenance must carry the seifa.* lanes file hashes`);
  } else {
    check(s._provenance && s._provenance.files && s._provenance.files["data/booth-locations-history.json"],
      `${y}: store provenance must cite the history-location store`);
  }
}

if (failures.length) {
  for (const f of failures) console.error("  FAIL", f);
  console.error(`${failures.length} failures`);
  process.exit(1);
}
console.log(`booth-seifa-stats90s: ok — ${Object.keys(YEARS).length} stores (${Object.values(YEARS).reduce((a, s) => a + s.rows, 0)} booth rows), lanes + lit cells green`);
