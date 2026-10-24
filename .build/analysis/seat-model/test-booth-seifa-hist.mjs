#!/usr/bin/env node
/* test-booth-seifa-hist.mjs — pin data/booth-seifa-{2004..2022}.json
   (derive-booth-seifa-hist.py: seven elections; measured census pairing
   2004->2001c / 2007+2010->2006c / 2013->2011c / 2016->2016c /
   2019->2016c / 2022->2021c — 2016's census sat five weeks AFTER
   election day so it measures the pct1 side — plus, on 2004..2019, the
   percentile-INTERPOLATION lane: seifa.pct (the premises area's score
   rank-percentile inside the measured cube) and seifaInterp {pct0,pct1,
   pcti} per index, the second era's percentile joining the same coords
   against the other bracketing census-era geometry, mixed at f = the
   intercensal day-share (the division store's _pcti convention — f
   cross-read from division-seifa-indexes.json for 2013/2016/2019 must
   match to the last decimal). 2022 carries neither (no 2026 census
   yet). Invariants per election:

   1. Universe: booth-row count, per-state histogram, division count
      (150; 151 in 2019/2022 — the House genuinely expanded), the exact
      counts/notes histogram of the measured first-green runs
      (2026-10-24; interp tallies added 2026-10-25),
      election/seifaEdition/geography/indexes headers.
   2. Keys + shape: (divId, boothId) unique; geo an N-digit code or null
      (N = 7 in the CD/SA1-2011 eras, 11 in the SA1-2016/2021 eras);
      geo null exactly on the noted noCoords/badCoords/pointOutside
      rows; seifa null exactly when geo is null or note is
      seifaSuppressed; scores inside each census cube's measured
      envelope; deciles integers 1..10 with the full span observed;
      partially-suppressed cube rows are counted (CD-era cubes are
      complete, so partial is 0 there).
   3. Sort order: the eight-state order then div then boothId,
      non-decreasing across the whole array.
   4. Spot cells across states/eras, all verified against an INDEPENDENT
      re-read of the cube on 2026-10-24 (Mosman/Mungindi/Wreck Bay in
      the 2001 and 2006 CD cubes byte-compared; Mosman in the 2016 SA1
      cube; 2001 deciles produced by ABS's own 2001 quantile recipe —
      see the extractor's cube_cd2001 guards):
      Mosman all-decile-10 in 2004/2007/2010 CD eras; Wreck Bay at the
      floor deciles; the stateFlag exemplars (Jennings 2007, Mungindi
      2010, Larapinta 2013's SA1, Leigh Creek 2022); OT (state digit 9)
      rows per year; pointOutside repeats (Malua Bay 2010/2013/2016);
      the seifaSuppressed exemplar Kogarah East 2013.
   5. 2004 carry-forward: coordsFrom="2007" on exactly the 6,852
      coord-holding rows (6,717 name-keyed + 135 premises-keyed, pinned
      in _provenance.coordCarryForward) and on NO other year's rows.
   6. Provenance: _provenance.files lists every pipeline input for the
      era; the committed vendored AEC CSV(s) re-hash to their recorded
      sha256-16 (geometry/cube caches are re-fetchable per the
      extractor's docstring manifest, so they are pinned by key
      presence only, as in test-booth-seifa-2025.mjs).
   7. INTERP lane (2004..2019 only): _pcti header facts vs year's pin +
      day-share recompute of f from census-night rows; every scored
      booth carries seifa.pct (0,1] over its non-null indexes;
      seifaInterp exists iff not dropped, its pct0/pct1 recompute pcti at
      the stored f bit-exact (half-up 6dp), and pct[i] equals
      seifaInterp[i][measuredSide] — the measured side is the committed
      join read back; unscored/uninterpolated booths appear in the
      _pcti.dropped lists on both sides of the membership; pinned pct/
      interp literals on the spot booths (Mosman across all six lanes —
      its pct chain links adjacent census pairs — plus one distinctive
      booth per lane); the same (census, geo) => same pct invariant
      across years (2007==2010 measured 2006c, 2016==2019 measured
      2016c); 2022 asserts the ABSENCE of pct/seifaInterp/_pcti (the
      byte-identity firewall for the no-c1 era).
*/

import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const STORE = (y) => `data/booth-seifa-${y}.json`;
const AEC = (y, ev) => `atlas/data/aec-${y}/GeneralPollingPlacesDownload-${ev}.csv`;

const STATE_ORDER = ["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"];
const TYPE_NAMES = new Set(["Polling place", "Special hospital", "Remote mobile", "Mobile team", "PPVC"]);
const NOTES = new Set(["noCoords", "badCoords", "pointOutside", "seifaSuppressed"]);
const IDX = ["irsd", "irsad", "ier", "ieo"];

// measured 2026-10-24 on the first green emission of each store
const YEARS = {
  2004: {
    ev: 12246, edition: 2001, geoLabel: "CD (ASGC 2001, GDA94)", geoLen: 7,
    rows: 8234, divs: 150,
    hist: { NSW: 2801, VIC: 1843, QLD: 1500, SA: 716, WA: 879, TAS: 332, NT: 76, ACT: 87 },
    counts: { scored: 6663, noCoords: 1382, seifaSuppressed: 185, otTerritory: 3, pointOutside: 4, mapped_geo: 6848, interp: 6633, interpFarSuppressed: 30 },
    notes: { noCoords: 1382, seifaSuppressed: 185, pointOutside: 4 },
    pcti: { f: 0.634373, measured: "pct0", e0: 2001, e1: 2006, booths: 6633, farOutside: [], farSuppressed: 30 },
    geoNull: 1386, partial: 0, coordsFrom: 6852,
    stateFlags: ["Eden-Monaro|Letchworth", "Eden-Monaro|Queanbeyan High", "Eden-Monaro|Queanbeyan West", "New England|Jennings", "Franklin|Huonville"],
    ot: ["Lingiari|Christmas Island", "Fraser|Jervis Bay", "Fraser|Wreck Bay"],
    mins: { irsd: 377.8, irsad: 705.1, ier: 735.1, ieo: 723.1 },
    maxs: { irsd: 1207.6, irsad: 1300.1, ier: 1331.1, ieo: 1267.2 },
    spots: [
      ["Warringah", "Mosman", { geo: "1391502", coordsFrom: "2007", seifa: [1150, 1249.2, 1282.1, 1215.7], dec: [10, 10, 10, 10],
        pct: [0.980389, 0.99591, 0.996162, 0.98235],
        interp: [[0.980389, 0.994661, 0.989443], [0.99591, 0.994073, 0.994745], [0.996162, 0.97357, 0.98183], [0.98235, 0.977815, 0.979473]] }],
      ["New England", "Jennings", { geo: "1052511", seifa: [906, 850, 898.5, 837.1], dec: [2, 1, 2, 1] }],
      ["Eden-Monaro", "Queanbeyan High", { geo: "1170210", seifa: [1030.2, 1008.2, 1014.6, 987.3], dec: [6, 6, 7, 6] }],
      ["Fraser", "Wreck Bay", { geo: "9030101", seifa: [988.9, 988.9, 921.1, 1056.4], dec: [4, 5, 3, 8],
        pct: [0.391595, 0.494887, 0.23331, 0.723014],
        interp: [[0.391595, 0.006274, 0.147158], [0.494887, 0.007101, 0.185449], [0.23331, 0.01415, 0.094281], [0.723014, 0.014497, 0.27355]] }],
      ["Grey", "Willsden", { note: "pointOutside", coordsFrom: "2007" }],
      ["Banks", "Beverly Hills North", { note: "noCoords" }],
    ],
    carry: { nameKeyed: 6717, premisesKeyed: 135 },
    csvs: [["2007", 13745]],
  },
  2007: {
    ev: 13745, edition: 2006, geoLabel: "CD (ASGC 2006)", geoLen: 7,
    rows: 8235, divs: 150,
    hist: { NSW: 2800, VIC: 1864, QLD: 1491, SA: 725, WA: 856, TAS: 336, NT: 77, ACT: 86 },
    counts: { scored: 7631, noCoords: 512, seifaSuppressed: 88, otTerritory: 3, pointOutside: 4, mapped_geo: 7719, interp: 7511, interpFarOutside: 1, interpFarSuppressed: 119 },
    notes: { noCoords: 512, seifaSuppressed: 88, pointOutside: 4 },
    pcti: { f: 0.258894, measured: "pct0", e0: 2006, e1: 2011, booths: 7511, farOutside: ["Dawson|Hamilton Island"], farSuppressed: 119 },
    geoNull: 516, partial: 0, coordsFrom: 0,
    stateFlags: ["New England|Jennings", "Franklin|Huonville", "McMillan|Toora"],
    ot: ["Lingiari|Christmas Island", "Fraser|Jervis Bay", "Fraser|Wreck Bay"],
    mins: { irsd: 466.5, irsad: 640.6, ier: 522.9, ieo: 665.6 },
    maxs: { irsd: 1175.1, irsad: 1254.8, ier: 1257.3, ieo: 1275.9 },
    spots: [
      ["Warringah", "Mosman", { geo: "1391502", seifa: [1158.9, 1219.2, 1172.9, 1206.5], dec: [10, 10, 10, 10],
        pct: [0.994661, 0.994073, 0.97357, 0.977815],
        interp: [[0.994661, 0.958744, 0.985362], [0.994073, 0.958268, 0.984803], [0.97357, 0.746188, 0.914702], [0.977815, 0.983899, 0.97939]] }],
      ["New England", "Jennings", { geo: "1052511", seifa: [819.9, 808.2, 895, 821.9], dec: [1, 1, 2, 1] }],
      ["Fraser", "Wreck Bay", { geo: "9030103", seifa: [582.2, 720, 729.8, 810.4], dec: [1, 1, 1, 1] }],
      ["Parkes", "Mungindi", { geo: "1041408", seifa: [874.9, 883.6, 879.9, 915.5], dec: [1, 2, 2, 3],
        pct: [0.095042, 0.113303, 0.099901, 0.212377],
        interp: [[0.095042, 0.097387, 0.095649], [0.113303, 0.102465, 0.110497], [0.099901, 0.123208, 0.105935], [0.212377, 0.325264, 0.241603]] }],
      ["McMillan", "Toora", { geo: "2200605", seifa: [884.8, 850.1, 885.6, 879.3], dec: [2, 1, 2, 2] }],
      ["Banks", "Special Hospital Team 1", { note: "noCoords", type: "Special hospital" }],
    ],
  },
  2010: {
    ev: 15508, edition: 2006, geoLabel: "CD (ASGC 2006)", geoLen: 7,
    rows: 8951, divs: 150,
    hist: { NSW: 2990, VIC: 2022, QLD: 1718, SA: 775, WA: 902, TAS: 352, NT: 98, ACT: 94 },
    counts: { scored: 8171, noCoords: 592, seifaSuppressed: 181, otTerritory: 4, pointOutside: 7, mapped_geo: 8352, interp: 8012, interpFarSuppressed: 159 },
    notes: { noCoords: 592, seifaSuppressed: 181, pointOutside: 7 },
    pcti: { f: 0.806787, measured: "pct0", e0: 2006, e1: 2011, booths: 8012, farOutside: [], farSuppressed: 159 },
    geoNull: 599, partial: 0, coordsFrom: 0,
    stateFlags: ["New England|Jennings", "Parkes|Mungindi"],
    ot: ["Lingiari|Christmas Island", "Lingiari|Christmas Island PPVC", "Fraser|Jervis Bay", "Fraser|Wreck Bay"],
    pointOutside: ["Canberra|Norfolk Island PPVC", "Eden-Monaro|Malua Bay", "Lingiari|Cocos Islands PPVC", "Lingiari|Home Island", "Lingiari|West Island", "Grey|Willsden", "Stirling|North Beach"],
    mins: { irsd: 466.5, irsad: 640.6, ier: 522.9, ieo: 665.6 },
    maxs: { irsd: 1175.1, irsad: 1254.8, ier: 1257.3, ieo: 1275.9 },
    spots: [
      ["Warringah", "Mosman", { geo: "1391502", seifa: [1158.9, 1219.2, 1172.9, 1206.5], dec: [10, 10, 10, 10],
        pct: [0.994661, 0.994073, 0.97357, 0.977815],
        interp: [[0.994661, 0.958744, 0.965684], [0.994073, 0.958268, 0.965186], [0.97357, 0.746188, 0.790121], [0.977815, 0.983899, 0.982723]] }],
      ["Parkes", "Mungindi", { geo: "1041408", seifa: [874.9, 883.6, 879.9, 915.5], dec: [1, 2, 2, 3] }],
      ["Eden-Monaro", "Malua Bay", { note: "pointOutside" }],
      ["Canberra", "Norfolk Island PPVC", { note: "pointOutside", type: "PPVC" }],
    ],
  },
  2013: {
    ev: 17496, edition: 2011, geoLabel: "SA1 (ASGS 2011)", geoLen: 7,
    rows: 9146, divs: 150,
    hist: { NSW: 3022, VIC: 2102, QLD: 1799, SA: 759, WA: 906, TAS: 349, NT: 104, ACT: 105 },
    counts: { scored: 8320, seifaSuppressed: 245, pointOutside: 3, noCoords: 578, otTerritory: 7, mapped_geo: 8565, interp: 8266, interpFarSuppressed: 54 },
    notes: { noCoords: 578, seifaSuppressed: 245, pointOutside: 3 },
    pcti: { f: 0.415982, measured: "pct0", e0: 2011, e1: 2016, booths: 8266, farOutside: [], farSuppressed: 54 },
    geoNull: 581, partial: 13, coordsFrom: 0,
    stateFlags: ["New England|Jennings", "Parkes|Mungindi", "Lingiari|Larapinta"],
    ot: ["Lingiari|Home Island", "Lingiari|West Island", "Lingiari|Christmas Island", "Lingiari|Christmas Island PPVC", "Lingiari|Home Island PPVC", "Fraser|Jervis Bay", "Fraser|Wreck Bay"],
    mins: { irsd: 399.6, irsad: 503.4, ier: 474.7, ieo: 616.4 },
    maxs: { irsd: 1184.2, irsad: 1206.2, ier: 1232.8, ieo: 1243.3 },
    spots: [
      ["Warringah", "Mosman", { geo: "1141502", seifa: [1122.8, 1144.5, 1068.3, 1200.1], dec: [10, 10, 8, 10],
        pct: [0.958744, 0.958268, 0.746188, 0.983899],
        interp: [[0.958744, 0.954841, 0.95712], [0.958268, 0.979429, 0.967071], [0.746188, 0.813177, 0.774054], [0.983899, 0.980773, 0.982599]] }],
      ["Lingiari", "Larapinta", { geo: "7104807", seifa: [1019.2, 1024.4, 1015.4, 1007.5], dec: [5, 6, 6, 6] }],
      ["Fraser", "Wreck Bay", { geo: "9100302", seifa: [602.2, 682.7, 698.6, 829.3], dec: [1, 1, 1, 1] }],
      ["Barton", "Kogarah East", { geo: "1137812", note: "seifaSuppressed" }],
      ["Boothby", "Sturt", { geo: "4106110", seifa: [878.9, 900.1, 875.6, 983.7], dec: [2, 2, 1, 5] }],
      // AEC ships (0,0); premises coords user-supplied 2026-10-24
      ["Solomon", "BLV Solomon PPVC", { geo: "7100203", seifa: [1056.1, 1064.9, 944.5, 1065.9], dec: [7, 8, 3, 8],
        pct: [0.677616, 0.720223, 0.25769, 0.73257],
        interp: [[0.677616, 0.740623, 0.703826], [0.720223, 0.845715, 0.772425], [0.25769, 0.169058, 0.220821], [0.73257, 0.868078, 0.788939]] }],
    ],
  },
  2016: {
    ev: 20499, edition: 2016, geoLabel: "SA1 (ASGS 2016)", geoLen: 11,
    rows: 8328, divs: 150,
    hist: { NSW: 2747, VIC: 1909, QLD: 1614, SA: 728, WA: 835, TAS: 310, NT: 82, ACT: 103 },
    counts: { scored: 7534, seifaSuppressed: 206, otTerritory: 7, noCoords: 587, pointOutside: 1, mapped_geo: 7740, interp: 7506, interpFarOutside: 2, interpFarSuppressed: 26 },
    notes: { noCoords: 587, seifaSuppressed: 206, pointOutside: 1 },
    pcti: { f: 0.979201, measured: "pct1", e0: 2011, e1: 2016, booths: 7506, farOutside: ["Canberra|Norfolk Island", "Canberra|Norfolk Island PPVC"], farSuppressed: 26 },
    geoNull: 588, partial: 27, coordsFrom: 0,
    stateFlags: ["New England|Jennings", "Parkes|Mungindi"],
    ot: ["Lingiari|Home Island", "Lingiari|West Island", "Lingiari|Christmas Island", "Lingiari|Christmas Island PPVC", "Lingiari|Home Island PPVC", "Canberra|Norfolk Island", "Canberra|Norfolk Island PPVC"],
    mins: { irsd: 404, irsad: 539, ier: 484, ieo: 672 },
    maxs: { irsd: 1165, irsad: 1211, ier: 1281, ieo: 1241 },
    spots: [
      ["Warringah", "Mosman", { geo: "12104141502", seifa: [1123, 1171, 1088, 1189], dec: [10, 10, 9, 10],
        pct: [0.954841, 0.979429, 0.813177, 0.980773],
        interp: [[0.958744, 0.954841, 0.954922], [0.958268, 0.979429, 0.978989], [0.746188, 0.813177, 0.811784], [0.983899, 0.980773, 0.980838]] }],
      ["Lingiari", "Home Island", { geo: "90102100201", seifa: [769, 830, 941, 681], dec: [1, 1, 3, 1] }],
      ["Canberra", "Norfolk Island", { geo: "90104100403", seifa: [989, 952, 989, 974], dec: [4, 3, 5, 5] }],
      ["Parkes", "Mungindi", { geo: "11003119614", seifa: [853, 867, 870, 915], dec: [1, 1, 1, 3] }],
      ["Boothby", "Sturt", { geo: "40302106110", seifa: [924, 942, 885, 1024], dec: [2, 3, 2, 6],
        pct: [0.187559, 0.260994, 0.114492, 0.587963],
        interp: [[0.105889, 0.187559, 0.18586], [0.15209, 0.260994, 0.258729], [0.097905, 0.114492, 0.114147], [0.457868, 0.587963, 0.585257]] }],
    ],
  },
  2019: {
    ev: 24310, edition: 2016, geoLabel: "SA1 (ASGS 2016)", geoLen: 11,
    rows: 8875, divs: 151,
    hist: { NSW: 2930, VIC: 2036, QLD: 1697, SA: 771, WA: 900, TAS: 322, NT: 76, ACT: 143 },
    counts: { scored: 8045, seifaSuppressed: 258, otTerritory: 2, noCoords: 571, pointOutside: 1, mapped_geo: 8303, interp: 8017, interpFarSuppressed: 28 },
    notes: { noCoords: 571, seifaSuppressed: 258, pointOutside: 1 },
    pcti: { f: 0.553914, measured: "pct0", e0: 2016, e1: 2021, booths: 8017, farOutside: [], farSuppressed: 28 },
    geoNull: 572, partial: 43, coordsFrom: 0,
    stateFlags: ["Eden-Monaro|BLV Eden Monaro PPVC", "Richmond|Special Hospital Team 6", "Lingiari|Katherine PPVC"],
    ot: ["Bean|Norfolk Island", "Bean|Norfolk Island PPVC"],
    mins: { irsd: 404, irsad: 539, ier: 484, ieo: 672 },
    maxs: { irsd: 1165, irsad: 1212, ier: 1281, ieo: 1248 },
    spots: [
      ["Warringah", "Mosman", { geo: "12104141502", seifa: [1123, 1171, 1088, 1189], dec: [10, 10, 9, 10],
        pct: [0.954841, 0.979429, 0.813177, 0.980773],
        interp: [[0.954841, 0.944872, 0.949319], [0.979429, 0.965671, 0.971808], [0.813177, 0.64479, 0.719905], [0.980773, 0.976755, 0.978547]] }],
      ["Bean", "Norfolk Island", { geo: "90104100403", seifa: [989, 952, 989, 974], dec: [4, 3, 5, 5] }],
      ["Lingiari", "Katherine PPVC", { geo: "40503112106", type: "PPVC", seifa: [950, 930, 947, 921], dec: [3, 3, 3, 3] }],
      ["Eden-Monaro", "BLV Eden Monaro PPVC", { geo: "10102100919", type: "PPVC", seifa: [1033, 1016, 968, 1027], dec: [6, 6, 4, 6] }],
      ["Boothby", "Sturt", { geo: "40302106110", seifa: [924, 942, 885, 1024], dec: [2, 3, 2, 6],
        pct: [0.187559, 0.260994, 0.114492, 0.587963],
        interp: [[0.187559, 0.041177, 0.106476], [0.260994, 0.074038, 0.157436], [0.114492, 0.050723, 0.079169], [0.587963, 0.312254, 0.435244]] }],
    ],
  },
  2022: {
    ev: 27966, edition: 2021, geoLabel: "SA1 (ASGS Ed3 2021, GDA2020)", geoLen: 11,
    rows: 8479, divs: 151,
    hist: { NSW: 2882, VIC: 1939, QLD: 1559, SA: 716, WA: 857, TAS: 309, NT: 80, ACT: 137 },
    counts: { scored: 8198, seifaSuppressed: 217, otTerritory: 5, noCoords: 64, mapped_geo: 8415 },
    notes: { noCoords: 64, seifaSuppressed: 217 },
    pcti: null,
    geoNull: 64, partial: 25, coordsFrom: 0,
    stateFlags: ["Grey|Leigh Creek"],
    ot: ["Lingiari|Christmas Island PPVC", "Lingiari|West Island PPVC", "Lingiari|Home Island PPVC", "Bean|Norfolk Island", "Bean|Norfolk Island PPVC"],
    mins: { irsd: 266.6, irsad: 496.7, ier: 442.7, ieo: 657.7 },
    maxs: { irsd: 1165.1, irsad: 1230, ier: 1260.8, ieo: 1268.8 },
    spots: [
      ["Warringah", "Mosman", { geo: "12104168902", seifa: [1070.5, 1148.5, 950.4, 1141.6], dec: [8, 10, 3, 10] }],
      ["Bean", "Norfolk Island", { geo: "90104100403", seifa: [1009.9, 951.5, 964.1, 927.8], dec: [5, 3, 4, 3] }],
      ["Grey", "Leigh Creek", { geo: "10502109813", seifa: [1008.5, 1005.3, 1063.6, 1011.9], dec: [5, 5, 8, 6] }],
      ["Lingiari", "Home Island PPVC", { geo: "90102100201", type: "PPVC", seifa: [766, 842.2, 958.9, 833.8], dec: [1, 1, 4, 1] }],
      // AEC ships (0,0); premises coords user-supplied 2026-10-24
      ["Sydney", "Surry Hills", { geo: "11703133602", seifa: [1105.5, 1179.6, 957, 1207.1], dec: [10, 10, 4, 10] }],
      ["Sydney", "Darlinghurst South", { geo: "11703132919", seifa: [1083.2, 1174.7, 934.9, 1174.8], dec: [9, 10, 3, 10] }],
    ],
  },
};

let failures = [];
const check = (ok, msg) => { if (!ok) failures.push(msg); };
const die = () => { for (const f of failures) console.error(`  FAIL ${f}`); if (failures.length) process.exit(1); };
const canon = (o) => JSON.stringify(o, Object.keys(o).sort());

// the division store's committed interp factors — the booth lanes that
// share its census pairs (2013/2016/2019) must agree to the last decimal
const DIV_FACTORS = JSON.parse(readFileSync("data/division-seifa-indexes.json", "utf8"))._pcti.factors;

const pctByYear = {}; // keyed "geo|idx" -> pct (same-census pair assertion)

for (const [ys, E] of Object.entries(YEARS)) {
  const y = Number(ys);
  const d = JSON.parse(readFileSync(STORE(y), "utf8"));
  const B = d.booths;
  const at = (m) => `${y}: ${m}`;

  // -- 1. universe + header facts
  check(d.election === y, at(`election ${d.election} != ${y}`));
  check(d.seifaEdition === E.edition, at(`seifaEdition ${d.seifaEdition} != ${E.edition}`));
  check(d.geography === E.geoLabel, at(`geography ${JSON.stringify(d.geography)} != ${JSON.stringify(E.geoLabel)}`));
  check(d.indexes.join() === IDX.join(), at(`indexes ${d.indexes}`));
  check(B.length === E.rows, at(`booth rows ${B.length} != ${E.rows}`));
  check(new Set(B.map((b) => b.div)).size === E.divs, at(`division count != ${E.divs}`));
  check(canon(d.counts) === canon(E.counts),
    at(`counts ${canon(d.counts)} != pin ${canon(E.counts)}`));
  check(JSON.stringify(d.stateFlagBooths) === JSON.stringify(E.stateFlags),
    at(`stateFlagBooths ${JSON.stringify(d.stateFlagBooths)}`));
  const hist = {};
  for (const b of B) hist[b.state] = (hist[b.state] || 0) + 1;
  check(canon(hist) === canon(E.hist),
    at(`state histogram ${canon(hist)} != pin ${canon(E.hist)}`));
  const noteHist = {};
  for (const b of B) if (b.note) noteHist[b.note] = (noteHist[b.note] || 0) + 1;
  check(canon(noteHist) === canon(E.notes),
    at(`note histogram ${canon(noteHist)} != pin ${canon(E.notes)}`));

  // -- 2. keys + shape
  const keys = new Set();
  let geoNull = 0, seifaNull = 0, partial = 0, coordsFrom = 0;
  const mins = {}, maxs = {};
  const decSeen = new Set();
  for (const b of B) {
    const k = `${b.divId}|${b.boothId}`;
    check(!keys.has(k), at(`dup (divId,boothId) ${k}`));
    keys.add(k);
    for (const f of ["div", "divId", "state", "boothId", "booth", "type", "venue", "suburb", "premisesState", "postcode"])
      check(b[f] !== undefined, at(`${k}: missing base field ${f}`));
    check(TYPE_NAMES.has(b.type), at(`${k}: odd type ${b.type}`));
    if (b.note !== undefined) check(NOTES.has(b.note), at(`${k}: odd note ${b.note}`));
    check(Object.prototype.hasOwnProperty.call(b, "geo"), at(`${k}: no geo key`));
    check(Object.prototype.hasOwnProperty.call(b, "seifa"), at(`${k}: no seifa key`));
    if (E.coordsFrom === 0) check(b.coordsFrom === undefined, at(`${k}: coordsFrom leaked outside 2004`));
    else if (b.coordsFrom !== undefined) {
      coordsFrom++;
      check(b.coordsFrom === "2007", at(`${k}: coordsFrom ${b.coordsFrom} != 2007`));
      check(b.lat !== undefined, at(`${k}: coordsFrom row without coords`));
    }
    if (b.geo === null) geoNull++;
    else check(typeof b.geo === "string" && new RegExp(`^\\d{${E.geoLen}}$`).test(b.geo),
      at(`${k}: malformed geo ${b.geo} (want ${E.geoLen} digits)`));
    if (b.seifa === null) {
      seifaNull++;
      check(b.geo === null || b.note === "seifaSuppressed",
        at(`${k}: seifa null without null geo or seifaSuppressed note`));
    } else {
      check(b.geo !== null, at(`${k}: seifa present but geo null`));
      let anyNull = false;
      for (const i of IDX) {
        const s = b.seifa[i], dc = b.seifa.dec[i];
        if (s === null) { anyNull = true; check(dc === null, at(`${k}: ${i} score null but decile ${dc}`)); }
        else {
          check(typeof s === "number", at(`${k}: ${i} non-numeric`));
          check(Number.isInteger(dc) && dc >= 1 && dc <= 10, at(`${k}: ${i} decile ${dc} not 1..10`));
          if (mins[i] === undefined || s < mins[i]) mins[i] = s;
          if (maxs[i] === undefined || s > maxs[i]) maxs[i] = s;
          decSeen.add(dc);
        }
      }
      if (anyNull) partial++;
    }
  }
  check(geoNull === E.geoNull, at(`geo-null rows ${geoNull} != ${E.geoNull}`));
  check(seifaNull === geoNull + E.notes.seifaSuppressed,
    at(`seifa-null rows ${seifaNull} != geoNull+suppressed`));
  check(partial === E.partial, at(`partial cube rows ${partial} != ${E.partial}`));
  check(coordsFrom === E.coordsFrom, at(`coordsFrom rows ${coordsFrom} != ${E.coordsFrom}`));
  for (const i of IDX) {
    check(mins[i] === E.mins[i], at(`${i} min ${mins[i]} != ${E.mins[i]}`));
    check(maxs[i] === E.maxs[i], at(`${i} max ${maxs[i]} != ${E.maxs[i]}`));
  }
  check(decSeen.size === 10, at(`decile span ${[...decSeen].sort((a, b) => a - b)} != 1..10`));

  // -- 3. sort order
  const ord = new Map(STATE_ORDER.map((s, i) => [s, i]));
  for (let i = 1; i < B.length; i++) {
    const a = B[i - 1], b = B[i];
    const ka = [ord.get(a.state), a.div, a.boothId], kb = [ord.get(b.state), b.div, b.boothId];
    const le = ka[0] < kb[0] || (ka[0] === kb[0] && (ka[1] < kb[1] || (ka[1] === kb[1] && ka[2] <= kb[2])));
    check(le, at(`sort order broken at row ${i}: ${a.state}/${a.div}/${a.boothId} then ${b.state}/${b.div}/${b.boothId}`));
  }

  // -- 4. spot cells
  const byKey = new Map(B.map((b) => [`${b.div}|${b.booth}`, b]));
  for (const [div, booth, want] of E.spots) {
    const b = byKey.get(`${div}|${booth}`);
    if (!b) { failures.push(at(`spot: ${div} ${booth} not found`)); continue; }
    if (want.geo) check(b.geo === want.geo, at(`${div} ${booth}: geo ${b.geo} != ${want.geo}`));
    if (want.note) check(b.note === want.note, at(`${div} ${booth}: note ${b.note} != ${want.note}`));
    if (want.type) check(b.type === want.type, at(`${div} ${booth}: type ${b.type} != ${want.type}`));
    if (want.coordsFrom) check(b.coordsFrom === want.coordsFrom, at(`${div} ${booth}: coordsFrom ${b.coordsFrom}`));
    else if (y === 2004 && b.note !== "noCoords" && b.note !== "badCoords")
      check(b.coordsFrom === "2007", at(`${div} ${booth}: 2004 coord-holding row missing carry flag`));
    if (want.seifa) {
      check(b.seifa !== null, at(`${div} ${booth}: seifa null unexpectedly`));
      if (b.seifa) {
        for (const [j, i] of IDX.entries()) {
          check(b.seifa[i] === want.seifa[j], at(`${div} ${booth}: ${i} ${b.seifa[i]} != ${want.seifa[j]}`));
          check(b.seifa.dec[i] === want.dec[j], at(`${div} ${booth}: ${i} dec ${b.seifa.dec[i]} != ${want.dec[j]}`));
        }
      }
    }
  }
  {
    const ot = B.filter((b) => b.geo && b.geo[0] === "9").map((b) => `${b.div}|${b.booth}`).sort();
    check(JSON.stringify(ot) === JSON.stringify([...E.ot].sort()), at(`OT rows ${JSON.stringify(ot)}`));
  }
  if (E.pointOutside) {
    const po = B.filter((b) => b.note === "pointOutside").map((b) => `${b.div}|${b.booth}`).sort();
    check(JSON.stringify(po) === JSON.stringify([...E.pointOutside].sort()), at(`pointOutside rows ${JSON.stringify(po)}`));
  }

  // -- 5. 2004 carry-forward block
  if (E.carry) {
    const cf = d._provenance && d._provenance.coordCarryForward;
    check(cf && cf.from === 2007 && cf.nameKeyed === E.carry.nameKeyed && cf.premisesKeyed === E.carry.premisesKeyed,
      at(`coordCarryForward ${JSON.stringify(cf)} != pin`));
    const cfRows = B.filter((b) => b.coordsFrom === "2007").length;
    check(cfRows === E.carry.nameKeyed + E.carry.premisesKeyed,
      at(`coordsFrom rows ${cfRows} != ${E.carry.nameKeyed + E.carry.premisesKeyed}`));
  } else {
    check(d._provenance.coordCarryForward === undefined, at(`unexpected coordCarryForward block`));
  }

  // -- 6. provenance
  {
    const files = d._provenance && d._provenance.files;
    check(files && Object.keys(files).length >= 3, at(`provenance files ${files && Object.keys(files)}`));
    const ownCsv = AEC(y, E.ev);
    check(files && files[ownCsv], at(`provenance lacks ${ownCsv}`));
    if (files && files[ownCsv]) {
      const h = createHash("sha256").update(readFileSync(ownCsv)).digest("hex").slice(0, 16);
      check(h === files[ownCsv], at(`AEC CSV hash ${h} != provenance ${files[ownCsv]}`));
    }
    for (const [cy, cev] of E.csvs || []) {
      const rel = AEC(cy, cev);
      check(files && files[rel], at(`provenance lacks carry csv ${rel}`));
      if (files && files[rel]) {
        const h = createHash("sha256").update(readFileSync(rel)).digest("hex").slice(0, 16);
        check(h === files[rel], at(`carry CSV hash ${h} != provenance ${files[rel]}`));
      }
    }
  }

  // -- 7. interp lane (2004..2019 fleshed out; 2022 asserts absence)
  if (E.pcti === null) {
    check(!("_pcti" in d), at(`unexpected _pcti block`));
    for (const b of B) {
      check(b.seifaInterp === undefined, at(`${b.div}|${b.booth}: unexpected seifaInterp`));
      check(!(b.seifa && "pct" in b.seifa), at(`${b.div}|${b.booth}: unexpected seifa.pct`));
    }
  } else {
    const p7 = E.pcti, P = d._pcti;
    check(P && typeof P === "object", at(`_pcti block missing`));
    check(P.measured === p7.measured, at(`_pcti.measured ${P.measured} != ${p7.measured}`));
    check(P.c0 === p7.e0 && P.c1 === p7.e1, at(`_pcti censuses ${P.c0}/${P.c1} != ${p7.e0}/${p7.e1}`));
    check(P.f === p7.f, at(`_pcti.f ${P.f} != ${p7.f}`));
    check(P.booths === p7.booths, at(`_pcti.booths ${P.booths} != ${p7.booths}`));
    check(typeof P.method === "string" && P.method.includes("pcti = (1-f)*pct0 + f*pct1"),
      at(`_pcti.method drifted`));
    check(typeof P.pct0Label === "string" && typeof P.pct1Label === "string",
      at(`_pcti percentile labels missing`));
    check(P.geometries && Object.keys(P.geometries).length === 2, at(`_pcti.geometries shape`));
    {
      const DAY = 86400000, cn = P.censusNights || {};
      check(cn[String(p7.e0)] !== undefined && cn[String(p7.e1)] !== undefined,
        at(`censusNights ${Object.keys(cn)} != ${p7.e0}/${p7.e1}`));
      const t0 = Date.parse(cn[String(p7.e0)]), t1 = Date.parse(cn[String(p7.e1)]), te = Date.parse(P.date);
      check(Number.isFinite(t0) && Number.isFinite(t1) && Number.isFinite(te), at(`censusNights/date unparseable`));
      const fre = Math.round(((te - t0) / DAY) / ((t1 - t0) / DAY) * 1e6) / 1e6;
      check(fre === P.f, at(`f recompute ${fre} (${te - t0}/${t1 - t0} days) != stored ${P.f}`));
      if (DIV_FACTORS[y]) {
        const df = DIV_FACTORS[y];
        check(df.c0 === P.c0 && df.c1 === P.c1 && df.f === P.f && df.date === P.date,
          at(`_pcti diverges from division store ${JSON.stringify(df)}`));
      }
    }
    const drops = P.dropped || {};
    const out = drops.interpFarOutside || [], supp = drops.interpFarSuppressed || [];
    check(JSON.stringify([...out].sort()) === JSON.stringify([...p7.farOutside].sort()),
      at(`interpFarOutside ${JSON.stringify(out)}`));
    check(supp.length === p7.farSuppressed, at(`interpFarSuppressed ${supp.length} != ${p7.farSuppressed}`));
    const dropped = new Set([...out, ...supp]);
    let nInterp = 0, nPct = 0;
    for (const b of B) {
      const k = `${b.div}|${b.booth}`;
      if (b.seifa === null) {
        check(b.seifaInterp === undefined, at(`${k}: unscored row carries seifaInterp`));
        check(!dropped.has(k), at(`${k}: unscored row in _pcti.dropped`));
        continue;
      }
      nPct++;
      const pct = b.seifa.pct;
      check(pct && typeof pct === "object", at(`${k}: scored row lacks seifa.pct`));
      for (const i of IDX) {
        if (b.seifa[i] === null) check(!(pct && i in pct), at(`${k}: pct present for null ${i}`));
        else check(pct && typeof pct[i] === "number" && pct[i] > 0 && pct[i] <= 1,
          at(`${k}: pct.${i} ${pct && pct[i]} outside (0,1]`));
      }
      if (b.seifaInterp !== undefined) {
        nInterp++;
        check(!dropped.has(k), at(`${k}: interpolated but listed in _pcti.dropped`));
        for (const i of IDX) {
          const cell = b.seifaInterp[i];
          if (cell === undefined) continue; // far-side index-level suppression is legal
          check(b.seifa[i] !== null, at(`${k}: interp ${i} on null score`));
          check(typeof cell.pct0 === "number" && typeof cell.pct1 === "number" && typeof cell.pcti === "number",
            at(`${k}: interp ${i} cell malformed`));
          const re = Math.round(((1 - P.f) * cell.pct0 + P.f * cell.pct1) * 1e6) / 1e6;
          check(cell.pcti === re, at(`${k}: ${i} pcti ${cell.pcti} != recompute ${re}`));
          check(pct && pct[i] === cell[P.measured],
            at(`${k}: ${i} pct ${pct && pct[i]} != interp ${P.measured} ${cell[P.measured]}`));
        }
      } else {
        check(dropped.has(k), at(`${k}: scored row without seifaInterp is missing from _pcti.dropped`));
      }
    }
    check(nPct === d.counts.scored, at(`pct rows ${nPct} != scored ${d.counts.scored}`));
    check(nInterp === p7.booths && nInterp === d.counts.interp,
      at(`interp rows ${nInterp} != pin ${p7.booths} / counts ${d.counts.interp}`));
    for (const k of dropped) {
      const b = byKey.get(k);
      check(b !== undefined, at(`${k}: _pcti.dropped names no booth`));
      if (b) check(b.seifa !== null && b.seifaInterp === undefined,
        at(`${k}: dropped row should be scored and uninterpolated`));
    }
    pctByYear[y] = pctByYear[y] || {};
    for (const b of B) {
      if (b.seifa === null || b.geo === null || !b.seifa.pct) continue;
      for (const i of IDX) if (b.seifa.pct[i] !== undefined) pctByYear[y][`${b.geo}|${i}`] = b.seifa.pct[i];
    }
  }
}

// invariant 7 (cross-year): the same census cube ranks the same (geo, index)
// to the same pct regardless of which election's store carries it —
// 2007 and 2010 both measure 2006c; 2016 and 2019 both measure 2016c.
for (const [ya, yb] of [[2007, 2010], [2016, 2019]]) {
  const A = pctByYear[ya] || {}, Y2 = pctByYear[yb] || {};
  let overlap = 0;
  for (const k of Object.keys(A)) {
    if (!(k in Y2)) continue;
    overlap++;
    check(A[k] === Y2[k], `shared-census pct ${ya}!=${yb} on ${k}: ${A[k]} v ${Y2[k]}`);
  }
  check(overlap > 1000, `${ya}/${yb} shared-census pct overlap only ${overlap}`);
}

die();
const tot = Object.values(YEARS).reduce((t, E) => t + E.rows, 0);
console.log(`booth-seifa-hist: ok — 7 elections 2004..2022, ${tot} booths, spot cells + carry-forward + hashes + interp lane green`);
