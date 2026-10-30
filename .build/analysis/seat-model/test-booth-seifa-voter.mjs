#!/usr/bin/env node
/* test-booth-seifa-voter.mjs — pin data/booth-seifa-voter-{2016,2019,2022,2025}.json
   (derive-booth-seifa-voter.py: voter-footprint vote-weighted SEIFA per
   booth from the AEC "Votes by SA1" roll mark-off products — the
   footprint complement of the venue-proxy booth-seifa stores, which it
   shares its booth universe with and sorts identically).

   Invariants per election (universe pins measured 2026-10-24 on the
   first green emission):

   1. Universe: booth-row count == the venue-proxy store's booth count,
      per-state histogram, division count (150; 151 in 2019/2022),
      boothsScored / boothsNoVotesFile / cohortRows / votesSentinel /
      votesTotal / per-index coverage exactly.
   2. Keys + shape: (div, boothId) unique; the only note vocabulary is
      noVotesRows; scored rows carry votes >= 1, sa1s >= 1, cov in
      [0,1] and scores inside the measured footprint envelopes; the
      noVotesRows rows carry votes:null, seifa:null.
   3. Sort order: the eight-state order then div then boothId,
      non-decreasing across the whole array (venue-store order).
   4. reconciliation oracle: counts.reconcileFpv vs the committed
      .build/aec-flow-src/booth/fpv/<year>-<ST>.csv.gz ordinary totals
      (median/p95/maxAbs + the maxAbs booth), all at the AEC
      rounding-disclaimer scale (median ~0.1%).
   5. Sentinel SA1 ids: ids all match the migratory families
      (…9999; 2016 also the OT sentinel 9999901, 328 votes) and
      votesSentinel is a 3-4-figure share of 14-16 million.
   6. Spot cells across states/kinds: the recon-maxAbs booths
      (Norfolk Island 2016; the big-city PPVCs 2019/2022/2025), the
      venue-proxy distortion exemplars (Collingwood 2016; Ascot Vale
      (Melbourne) 2019; Eastlakes SYDNEY PPVC 2022; Acacia Ridge South
      (Oxley) + Eastlakes SYDNEY PPVC + EAV Adelaide PPVC 2025), one
      noVotesRows row per year, and two 2025 declaration cohorts
      (Wentworth Postal / Lingiari Absent).
   7. Cohorts: exactly 4 per division (Postal/Pre-Poll/Absent/
      Provisional), cohort vocab, state-of-division, sorted.
   8. Provenance: _provenance.files keys name the votes input, the
      venue store (and the 2022 crosswalk only in 2022).
   9. Demo block (the 2026-10-24 add-on: 2021-census GCP G01 aged/lang,
      G09 foreign-born and G49B university
      folded by the same per-SA1 vote weights — Ed3 basis on every
      lane; age shares renormalised over the 11 bands because G01
      excludes age-not-stated, same ex-not-stated basis as langOther's
      eng+oth denominator): counts.demo exact per year (its rows span
      booth + cohort rows); every votes>=1 booth row and every cohort
      carries demo; noVotesRows/zeroVotes rows carry demo:null; age
      shares span the 11 bands and sum ~1 (persons>0); the one
      zero-persons row (2019 O'Connor Other Mobile Team 2, a mobile
      team whose SA1 string maps onto unpopulated SA1s) carries null
      lang/age; the max-language exemplar per year.
   9b. Income lanes (the 2026-10-26 add-on: GCP G32/G33 households by
      weekly income band at SA1, family/non-family split re-weighted to
      ADULTS at the data/income-dist.json factors): loinc = adult share
      below the national 25th-percentile cut the store-level incomeCuts
      record carries ($1,078.87/wk, identical on all four lanes — one
      2021-census basis), hiinc = adult share in the $4,000+ band;
      incMed (divisions only) is the band-interpolated median on the
      HOUSEHOLD basis (ABS's published-median basis — the adults
      histogram would read ~+$300). counts.demo.national carries
      loinc/hiinc/incMed exact per year; division anchors pinned
      (Hinkler is the lo-income/median floor, the hi-income ceiling is
      Wentworth except 2025's Bradfield on the new boundaries).
   10. Divisions block (the division-level add-on: every unit's
      per-SA1 demo tallies re-pooled by division — one language/age
      reading per division, shares from its own pooled sum, never an
      average of the rounded row shares): one row per division,
      state-order sorted; division votes + votesSentinel reconcile to
      votesTotal exactly; person-weighting the division rows
      reproduces counts.demo.national for the all-persons-share lanes
      (langOther, age0_14, age65ov; tolerance 0.0005 — 4dp share
      rounding) — NOT for fborn/uni/blue, whose per-lane stated/aged/
      employed denominators are a varying share of persons, so a
      persons-weighting lands ~0.1/~0.35/~0.6pt off the exact
      national pool (gaps measured across all four years when the
      blue lane was added 2026-10-26); per-row cov >= 0.999; anchors
      per year: Fowler max language share and Lyne min; Lyne oldest
      and Lingiari youngest; the Lingiari row printed in full.
*/

import { readFileSync } from "node:fs";

const IDX = ["irsd", "irsad", "ier", "ieo"];
const STATE_ORDER = ["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"];
const COHORTS = new Set(["Absent", "Postal", "Pre-Poll", "Provisional"]);

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

const YEARS = {
  2016: {
    rows: 8328, divs: 150,
    hist: { NSW: 2747, VIC: 1909, QLD: 1614, SA: 728, WA: 835, TAS: 310, NT: 82, ACT: 103 },
    scored: 8195, noVotes: 132, noVotesFirst: ["Adelaide|30170", "Adelaide|65965"],
    cohorts: 600, sentinel: 404, votesTotal: 14278637,
    coverage: { irsd: 0.9979, irsad: 0.9979, ier: 0.9981, ieo: 0.9981 },
    recon: { matched: 8196, missing: 0, medianAbsPct: 0.12, p95AbsPct: 0.83,
             maxAbs: 236, maxAbsBooth: "Canberra|65739|sa1file vs fpv diff -236" },
    delta: {
      /* scored on the 2016 census since 2026-10-25 (the venue store's
         census too), so the gap to the venue proxy narrowed: irsd median
         29.4 -> 26.0 against the old 2011-cube scores */
      irsd: { compared: 7454, medianAbs: 26, p95Abs: 123.7, moved100: 628 },
      irsad: { compared: 7454, medianAbs: 25.7, p95Abs: 107.2, moved100: 453 },
      ier: { compared: 7454, medianAbs: 34.3, p95Abs: 160, moved100: 1024 },
      ieo: { compared: 7477, medianAbs: 23.8, p95Abs: 95.8, moved100: 334 },
    },
    mins: { irsd: 433, irsad: 585.1, ier: 510.6, ieo: 681 },
    maxs: { irsd: 1143.7, irsad: 1192.8, ier: 1209.4, ieo: 1209.6 },
    sentinelIds: "9999901",
    zeroVotes: ["Brand|65161"],
    demo: { rows: 8795, coverage: 1.0, national: { langOther: 0.218, fborn: 0.278, uni: 0.2823, blue: 0.2825, age0_14: 0.1805, age65ov: 0.1823, loinc: 0.2537, hiinc: 0.1651, cob: { eng: 0.0402, ind: 0.0225, chn: 0.0202, nzl: 0.0209, phl: 0.0105, vnm: 0.0103, zaf: 0.0076, ita: 0.0066, lka: 0.0047, sct: 0.0046 }, incMed: 1758, u15: 0.1805, y12less: 0.3982, atsci: 0.0316, onepar: 0.1575, rel: { norel: 0.4165, cath: 0.219, angl: 0.1106, unch: 0.0298, pres: 0.0178, orth: 0.0258, budd: 0.0244, isl: 0.031, hind: 0.0237, jew: 0.0042 }, ten: { mort: 0.355, rent: 0.2935, own: 0.3324, rentPub: 0.0287 } } },
    demoMaxLang: ["Lingiari", "Home Island", 0.9804],
    demoDivs: { langMax: ["Fowler", 0.7328], langMin: ["Lyne", 0.0296],
                oldMax: ["Lyne", 0.3082], oldMin: ["Lingiari", 0.0777],
                fbMax: ["Fowler", 0.5786], fbMin: ["Parkes", 0.0742],
                uniMax: ["North Sydney", 0.5873], uniMin: ["Wakefield", 0.1088],
                blueMax: ["Flynn", 0.4486], blueMin: ["North Sydney", 0.0881],
                lingiari: { votes: 46505, persons: 24323385, lang: 0.5239,
                            fborn: 0.1211, uni: 0.1501 } },
    demoInc: { loMax: ["Hinkler", 0.4221], loMin: ["Warringah", 0.1215],
               hiMax: ["Wentworth", 0.4476], hiMin: ["Lyons", 0.0514],
               medMin: ["Hinkler", 1133], medMax: ["Wentworth", 2943] },
    incLingiari: { lo: 0.2671, hi: 0.1389, med: 1825 },
    demoCob: { engTop: ["Moore", 0.1535], indTop: ["Greenway", 0.1503],
               chnTop: ["Chisholm", 0.1314], fowlerVnm: 0.1794 },
    demoEmpties: [],
    spots: [
      ["Canberra", "Norfolk Island", { votes: 59, sa1s: 7, seifa: [1081.7, 1101.5, 1131.4, 1107.9], cov: [0.9685, 0.9685, 0.9685, 0.9685] }],
      ["Melbourne", "Collingwood", { votes: 1668, seifa: [887.8, null, null, null] }],
    ],
    cohortSpot: null,
    xwalk: false,
  },
  2019: {
    rows: 8875, divs: 151,
    hist: { NSW: 2930, VIC: 2036, QLD: 1697, SA: 771, WA: 900, TAS: 322, NT: 76, ACT: 143 },
    scored: 8738, noVotes: 136, noVotesFirst: ["Adelaide|30170", "Banks|30094"],
    cohorts: 604, sentinel: 40, votesTotal: 15101567,
    coverage: { irsd: 0.9975, irsad: 0.9975, ier: 0.9976, ieo: 0.9977 },
    recon: { matched: 8739, missing: 0, medianAbsPct: 0.11, p95AbsPct: 0.73,
             maxAbs: 53, maxAbsBooth: "Brisbane|32606|sa1file vs fpv diff -53" },
    delta: {
      irsd: { compared: 7922, medianAbs: 26.4, p95Abs: 127.9, moved100: 697 },
      irsad: { compared: 7922, medianAbs: 26.1, p95Abs: 109.6, moved100: 509 },
      ier: { compared: 7922, medianAbs: 35.2, p95Abs: 165.5, moved100: 1127 },
      ieo: { compared: 7957, medianAbs: 24.2, p95Abs: 97.3, moved100: 368 },
    },
    mins: { irsd: 443.6, irsad: 592.1, ier: 506.8, ieo: 739.1 },
    maxs: { irsd: 1144.4, irsad: 1193.9, ier: 1212.2, ieo: 1209.7 },
    sentinelIds: null,
    zeroVotes: [],
    demo: { rows: 9343, coverage: 1.0, national: { langOther: 0.2205, fborn: 0.2804, uni: 0.284, blue: 0.2818, age0_14: 0.1825, age65ov: 0.1789, loinc: 0.2502, hiinc: 0.1649, cob: { eng: 0.0402, ind: 0.0238, chn: 0.02, nzl: 0.0212, phl: 0.0109, vnm: 0.0101, zaf: 0.0077, ita: 0.0065, lka: 0.0048, sct: 0.0046 }, incMed: 1775, u15: 0.1825, y12less: 0.3949, atsci: 0.0309, onepar: 0.1564, rel: { norel: 0.4162, cath: 0.2189, angl: 0.1094, unch: 0.0293, pres: 0.0176, orth: 0.0257, budd: 0.0244, isl: 0.0316, hind: 0.0249, jew: 0.0041 }, ten: { mort: 0.3592, rent: 0.2955, own: 0.3263, rentPub: 0.0278 } } },
    demoMaxLang: ["Lingiari", "Remote Mobile Team 5", 0.9425],
    demoDivs: { langMax: ["Fowler", 0.7327], langMin: ["Lyne", 0.0297],
                oldMax: ["Lyne", 0.3099], oldMin: ["Lingiari", 0.0758],
                fbMax: ["Fowler", 0.5786], fbMin: ["Parkes", 0.0752],
                uniMax: ["North Sydney", 0.5884], uniMin: ["Spence", 0.103],
                blueMax: ["Flynn", 0.4478], blueMin: ["North Sydney", 0.088],
                lingiari: { votes: 51053, persons: 26655725, lang: 0.489,
                            fborn: 0.1357, uni: 0.1596 } },
    demoInc: { loMax: ["Hinkler", 0.417], loMin: ["Canberra", 0.1168],
               hiMax: ["Wentworth", 0.4483], hiMin: ["Spence", 0.0435],
               medMin: ["Hinkler", 1147], medMax: ["Wentworth", 2944] },
    incLingiari: { lo: 0.247, hi: 0.1441, med: 1910 },
    demoCob: { engTop: ["Moore", 0.1551], indTop: ["Lalor", 0.1585],
               chnTop: ["Chisholm", 0.142], fowlerVnm: 0.1777 },
    demoEmpties: ["O'Connor|65160"],
    spots: [
      ["Brisbane", "Brisbane City BRISBANE PPVC", { votes: 8690, sa1s: 358, seifa: [1068.3, 1099.7, 963.1, 1134.3], cov: [0.9995, 0.9995, 0.9995, 0.9995] }],
      ["Melbourne", "Ascot Vale (Melbourne)", { votes: 22, seifa: [858.3, null, null, null] }],
    ],
    cohortSpot: null,
    xwalk: false,
  },
  2022: {
    rows: 8479, divs: 151,
    hist: { NSW: 2882, VIC: 1939, QLD: 1559, SA: 716, WA: 857, TAS: 309, NT: 80, ACT: 137 },
    scored: 8448, noVotes: 30, noVotesFirst: ["Bennelong|108392", "Bradfield|97898"],
    cohorts: 604, sentinel: 28, votesTotal: 15469725,
    coverage: { irsd: 0.9981, irsad: 0.9981, ier: 0.9982, ieo: 0.9983 },
    recon: { matched: 8449, missing: 0, medianAbsPct: 0.11, p95AbsPct: 0.77,
             maxAbs: 58, maxAbsBooth: "Melbourne|64641|sa1file vs fpv diff -58" },
    delta: {
      irsd: { compared: 8145, medianAbs: 26.7, p95Abs: 130, moved100: 759 },
      irsad: { compared: 8145, medianAbs: 26.3, p95Abs: 134, moved100: 705 },
      ier: { compared: 8145, medianAbs: 36.4, p95Abs: 154.6, moved100: 1145 },
      ieo: { compared: 8169, medianAbs: 24, p95Abs: 126.1, moved100: 594 },
    },
    mins: { irsd: 435.6, irsad: 672.9, ier: 472.6, ieo: 723 },
    maxs: { irsd: 1135.4, irsad: 1196.2, ier: 1181.6, ieo: 1207.8 },
    sentinelIds: null,
    zeroVotes: ["Tangney|65478"],
    demo: { rows: 9052, coverage: 1.0, national: { langOther: 0.2229, fborn: 0.2834, uni: 0.2861, blue: 0.2814, age0_14: 0.1835, age65ov: 0.1761, loinc: 0.2474, hiinc: 0.1643, cob: { eng: 0.0403, ind: 0.0251, chn: 0.0204, nzl: 0.0214, phl: 0.0113, vnm: 0.0099, zaf: 0.0079, ita: 0.0064, lka: 0.0049, sct: 0.0046 }, incMed: 1788, u15: 0.1835, y12less: 0.3916, atsci: 0.0303, onepar: 0.1551, rel: { norel: 0.4166, cath: 0.2182, angl: 0.1084, unch: 0.029, pres: 0.0176, orth: 0.0252, budd: 0.0244, isl: 0.0319, hind: 0.026, jew: 0.0039 }, ten: { mort: 0.3622, rent: 0.2976, own: 0.3215, rentPub: 0.0266 } } },
    demoMaxLang: ["Lingiari", "Home Island PPVC", 0.9695],
    demoDivs: { langMax: ["Fowler", 0.7335], langMin: ["Lyne", 0.0297],
                oldMax: ["Lyne", 0.3082], oldMin: ["Lingiari", 0.077],
                fbMax: ["Fowler", 0.5797], fbMin: ["Parkes", 0.0754],
                uniMax: ["Melbourne", 0.5954], uniMin: ["Spence", 0.1062],
                blueMax: ["Flynn", 0.4471], blueMin: ["North Sydney", 0.0883],
                lingiari: { votes: 49428, persons: 25871026, lang: 0.4686,
                            fborn: 0.1441, uni: 0.1645 } },
    demoInc: { loMax: ["Hinkler", 0.4141], loMin: ["Canberra", 0.117],
               hiMax: ["Wentworth", 0.4462], hiMin: ["Spence", 0.0446],
               medMin: ["Hinkler", 1156], medMax: ["Wentworth", 2926] },
    incLingiari: { lo: 0.2363, hi: 0.1486, med: 1956 },
    demoCob: { engTop: ["Pearce", 0.1537], indTop: ["Greenway", 0.1622],
               chnTop: ["Bennelong", 0.1413], fowlerVnm: 0.1757 },
    demoEmpties: [],
    spots: [
      ["Melbourne", "Northcote MELBOURNE PPVC", { votes: 838, sa1s: 305, seifa: [1066, 1121.2, 951.6, 1167.1], cov: [0.9988, 0.9988, 0.9988, 0.9988] }],
      ["Sydney", "Eastlakes SYDNEY PPVC", { votes: 2405, seifa: [1044.2, null, null, null] }],
    ],
    cohortSpot: null,
    xwalk: true,
  },
  2025: {
    rows: 8940, divs: 150,
    hist: { NSW: 3028, VIC: 2072, QLD: 1626, SA: 750, WA: 899, TAS: 329, NT: 89, ACT: 147 },
    scored: 8913, noVotes: 26, noVotesFirst: ["Bean|109493", "Brand|58768"],
    cohorts: 600, sentinel: 38, votesTotal: 16420785,
    coverage: { irsd: 0.9976, irsad: 0.9976, ier: 0.9978, ieo: 0.9978 },
    recon: { matched: 8914, missing: 0, medianAbsPct: 0.09, p95AbsPct: 0.88,
             maxAbs: 68, maxAbsBooth: "Curtin|94024|sa1file vs fpv diff -68" },
    delta: {
      irsd: { compared: 8050, medianAbs: 27, p95Abs: 131.2, moved100: 752 },
      irsad: { compared: 8050, medianAbs: 26.3, p95Abs: 119.2, moved100: 615 },
      ier: { compared: 8053, medianAbs: 35.8, p95Abs: 155.7, moved100: 1117 },
      ieo: { compared: 8067, medianAbs: 23.9, p95Abs: 109.9, moved100: 498 },
    },
    mins: { irsd: 413.9, irsad: 635, ier: 452.4, ieo: 748 },
    maxs: { irsd: 1135.1, irsad: 1196.1, ier: 1183.6, ieo: 1202.8 },
    sentinelIds: null,
    zeroVotes: ["Page|123920"],
    demo: { rows: 9513, coverage: 1.0, national: { langOther: 0.2277, fborn: 0.2869, uni: 0.2871, blue: 0.2822, age0_14: 0.1855, age65ov: 0.1728, loinc: 0.2443, hiinc: 0.1625, cob: { eng: 0.04, ind: 0.0274, chn: 0.0204, nzl: 0.0218, phl: 0.0119, vnm: 0.0098, zaf: 0.0079, ita: 0.0063, lka: 0.0051, sct: 0.0046 }, incMed: 1801, u15: 0.1855, y12less: 0.3892, atsci: 0.0301, onepar: 0.1539, rel: { norel: 0.4149, cath: 0.2176, angl: 0.1071, unch: 0.0286, pres: 0.0174, orth: 0.0249, budd: 0.0245, isl: 0.0328, hind: 0.028, jew: 0.0038 }, ten: { mort: 0.3689, rent: 0.2974, own: 0.3151, rentPub: 0.0259 } } },
    demoMaxLang: ["Lingiari", "Remote Mobile Team 5", 0.942],
    demoDivs: { langMax: ["Fowler", 0.7295], langMin: ["Lyne", 0.0295],
                oldMax: ["Lyne", 0.309], oldMin: ["Lingiari", 0.079],
                fbMax: ["Fowler", 0.5796], fbMin: ["Parkes", 0.0755],
                uniMax: ["Melbourne", 0.5901], uniMin: ["Spence", 0.1095],
                blueMax: ["Flynn", 0.4467], blueMin: ["Wentworth", 0.0918],
                lingiari: { votes: 47812, persons: 25598620, lang: 0.4985,
                            fborn: 0.1243, uni: 0.1514 } },
    demoInc: { loMax: ["Hinkler", 0.4127], loMin: ["Greenway", 0.1113],
               hiMax: ["Bradfield", 0.4369], hiMin: ["Spence", 0.0449],
               medMin: ["Hinkler", 1161], medMax: ["Bradfield", 2964] },
    incLingiari: { lo: 0.2653, hi: 0.1414, med: 1834 },
    demoCob: { engTop: ["Pearce", 0.1817], indTop: ["Lalor", 0.1772],
               chnTop: ["Menzies", 0.1293], fowlerVnm: 0.1671 },
    demoEmpties: [],
    spots: [
      ["Curtin", "Perth CURTIN PPVC", { votes: 2509, sa1s: 340, seifa: [1084.3, 1118.2, 1049.4, 1142.6], cov: [0.9936, 0.9936, 0.9936, 0.9936] }],
      ["Oxley", "Acacia Ridge South (Oxley)", { votes: 283, seifa: [1023.8, 1025.2, 1062.3, 1017.5], cov: [1, 1, 1, 1] }],
      ["Sydney", "Eastlakes SYDNEY PPVC", { votes: 2878, seifa: [1053.4, 1122.7, 956.7, 1133.3], cov: [0.9997, 0.9997, 0.9997, 0.9997] }],
      ["Adelaide", "EAV Adelaide PPVC", { votes: 30, seifa: [989.9, 1013, 915.7, 1066], cov: [1, 1, 1, 1] }],
    ],
    cohortSpot: [
      ["Wentworth", "Postal", { votes: 13111, sa1s: 430, seifa: [1098.4, 1167.2, 1016.7, 1181.2], cov: [0.9989, 0.9989, 0.9989, 0.9989] }],
      ["Lingiari", "Absent", { votes: 1191, sa1s: 225, seifa: [769.1, 856.3, 776.9, 921.6], cov: [0.8883, 0.8883, 0.8883, 0.8892] }],
    ],
    xwalk: false,
  },
};

for (const [ys, w] of Object.entries(YEARS)) {
  const y = Number(ys);
  const d = JSON.parse(readFileSync(`data/booth-seifa-voter-${y}.json`, "utf8"));
  const tag = (m) => `${y}: ${m}`;

  // header
  eq(d.election, y, tag("election"));
  eq(Array.isArray(d.booths), true, tag("booths array"));
  eq(d.indexes, IDX, tag("indexes"));
  ok(d._about.includes("Votes by SA1"), tag("_about names product"));
  ok(d._provenance.extractedAt, tag("extractedAt present"));
  const files = Object.keys(d._provenance.files);
  ok(files.some((f) => f.startsWith(".build/analysis/seat-model/cache/votes-sa1/")), tag("votes input in files"));
  ok(files.includes(`data/booth-seifa-${y}.json`), tag("venue store in files"));
  eq(files.some((f) => f.endsWith("CG_SA1_2016_SA1_2021.csv")), w.xwalk,
     tag(`crosswalk in files == ${w.xwalk}`));

  // universe
  eq(d.booths.length, w.rows, tag("booth rows"));
  const hist = {};
  const divs = new Set();
  for (const b of d.booths) {
    hist[b.state] = (hist[b.state] || 0) + 1;
    divs.add(b.div);
  }
  eq(hist, w.hist, tag("state histogram"));
  eq(divs.size, w.divs, tag("division count"));
  eq(d.counts.booths, w.rows, tag("counts.booths"));
  eq(d.counts.boothsScored, w.scored, tag("counts.boothsScored"));
  eq(d.counts.boothsNoVotesFile, w.noVotes, tag("boothsNoVotesFile"));
  eq(d.counts.boothsNoVotesFileIds.length, w.noVotes, tag("noVotes ids length"));
  eq(d.counts.boothsNoVotesFileIds.slice(0, 2), w.noVotesFirst, tag("noVotes ids head"));
  eq(d.counts.cohortRows, w.cohorts, tag("cohortRows"));
  eq(d.cohorts.length, w.cohorts, tag("cohorts array"));
  eq(d.counts.votesSentinel, w.sentinel, tag("votesSentinel"));
  eq(d.counts.votesTotal, w.votesTotal, tag("votesTotal"));
  eq(d.counts.coverage, w.coverage, tag("coverage"));
  eq(d.counts.reconcileFpv, w.recon, tag("reconcileFpv"));
  for (const i of IDX) eq(d.counts.venueDelta[i], w.delta[i], tag(`venueDelta ${i}`));
  ok(!("votesDroppedXwalk" in d.counts) || d.counts.votesDroppedXwalk >= 0,
     tag("xwalk dropped sane"));

  // sentinels
  for (const id of d.counts.sentinelIds) {
    ok(id.endsWith("9999") || id.startsWith("99999"), tag(`sentinel shape ${id}`));
  }
  eq(d.counts.sentinelIds.includes("9999901"), w.sentinelIds === "9999901",
     tag("OT sentinel presence"));
  ok(d.counts.votesSentinel < 1000, tag("sentinel votes tiny"));

  // keys / shape / notes
  const seen = new Set();
  let prev = null;
  let noteCount = 0;
  const zeroVoteNames = [];
  const mins = { irsd: Infinity, irsad: Infinity, ier: Infinity, ieo: Infinity };
  const maxs = { irsd: -Infinity, irsad: -Infinity, ier: -Infinity, ieo: -Infinity };
  for (const b of d.booths) {
    const k = `${b.div}|${b.boothId}`;
    ok(!seen.has(k), tag(`dup ${k}`));
    seen.add(k);
    const sk = [STATE_ORDER.indexOf(b.state), b.div, b.boothId];
    if (prev) {
      ok(sk[0] > prev[0] || (sk[0] === prev[0] && (sk[1] > prev[1] ||
         (sk[1] === prev[1] && sk[2] >= prev[2]))), tag(`sort ${k}`));
    }
    prev = sk;
    if (b.note !== undefined) {
      eq(b.note, "noVotesRows", tag(`note vocab ${k}`));
      noteCount++;
      eq(b.votes, null, tag(`noVotes votes null ${k}`));
      eq(b.seifa, null, tag(`noVotes seifa null ${k}`));
      eq("sa1s" in b, false, tag(`noVotes no sa1s ${k}`));
      continue;
    }
    if (b.votes === 0) {
      // venue listed with zero-vote votes-file rows (pinned row per year)
      zeroVoteNames.push(k);
      eq(b.seifa, null, tag(`zeroVotes seifa null ${k}`));
      for (const i of IDX) eq(b.cov[i], 0, tag(`zeroVotes cov 0 ${k}`));
      continue;
    }
    ok(b.votes >= 1, tag(`votes >= 1 ${k}`));
    ok(b.sa1s >= 1, tag(`sa1s >= 1 ${k}`));
    for (const i of IDX) {
      ok(b.cov[i] >= 0 && b.cov[i] <= 1, tag(`cov range ${k} ${i}`));
      const s = b.seifa ? b.seifa[i] : null;
      if (s == null) continue;
      ok(s >= 400 && s <= 1250, tag(`footprint band ${k} ${i}=${s}`));
      mins[i] = Math.min(mins[i], s);
      maxs[i] = Math.max(maxs[i], s);
    }
  }
  eq(noteCount, w.noVotes, tag("noVotesRows note count"));
  eq(zeroVoteNames.sort(), w.zeroVotes, tag("zeroVotes ids"));
  for (const i of IDX) {
    eq(Number(mins[i].toFixed(1)), w.mins[i], tag(`min ${i}`));
    eq(Number(maxs[i].toFixed(1)), w.maxs[i], tag(`max ${i}`));
  }

  // cohorts: exactly the 4 named cohorts per division, sorted
  const perDiv = {};
  let cprev = null;
  for (const c of d.cohorts) {
    ok(COHORTS.has(c.cohort), tag(`cohort vocab ${c.cohort}`));
    perDiv[c.div] = (perDiv[c.div] || 0) + 1;
    eq(STATE_ORDER.includes(c.state), true, tag(`cohort state ${c.div}`));
    const ck = [STATE_ORDER.indexOf(c.state), c.div, c.cohort];
    if (cprev) {
      ok(ck[0] > cprev[0] || (ck[0] === cprev[0] && (ck[1] > cprev[1] ||
         (ck[1] === cprev[1] && ck[2] >= cprev[2]))), tag(`cohort sort ${c.div} ${c.cohort}`));
    }
    cprev = ck;
  }
  for (const dv of divs) eq(perDiv[dv], 4, tag(`cohorts == 4 in ${dv}`));

  const byKey = new Map();
  for (const b of d.booths) byKey.set(`${b.div}|${b.booth}`, b);

  // demo block: 2021-census GCP G01 folded by the same vote weights
  eq(d.counts.demo, w.demo, tag("counts.demo"));
  const COB_KEYS = ["eng", "ind", "chn", "nzl", "phl", "vnm", "zaf",
                    "ita", "lka", "sct"];
  eq(d.cobKeys, COB_KEYS, tag("cobKeys"));
  ok(d.demoBasis && d.demoBasis.includes("2021 Census GCP G01"), tag("demoBasis"));
  ok(d._about.includes("GCP G01"), tag("_about names GCP G01"));
  eq(d.incomeCuts, {
    loQuantile: 0.25, loCutWeekly: 1078.87, hiEdgeWeekly: 4000,
    hiNationalShare: 0.156571, dollarsYear: 2021,
    adultsWeights: "data/income-dist.json",
    medianBasis: "households (shares are per-adult)",
  }, tag("incomeCuts"));
  const BANDS = ["0_4", "5_14", "15_19", "20_24", "25_34", "35_44", "45_54",
                 "55_64", "65_74", "75_84", "85ov"];
  let demoRowCount = 0;
  const demoEmpties = [];
  for (const b of d.booths) {
    const k = `${b.div}|${b.boothId}`;
    if (b.note === "noVotesRows" || b.votes === 0) {
      eq(b.demo, null, tag(`demo null on noVotes/zeroVotes ${k}`));
      continue;
    }
    const dm = b.demo;
    ok(dm, tag(`demo present ${k}`));
    if (!dm) continue;
    demoRowCount++;
    ok(dm.persons >= 0, tag(`demo persons >= 0 ${k}`));
    ok(dm.cov >= 0 && dm.cov <= 1, tag(`demo cov range ${k}`));
    if (dm.persons === 0) {
      // zero mapped persons (2019 O'Connor mobile team): null shares
      eq(dm.langOther, null, tag(`demo empty lang null ${k}`));
      eq(dm.fborn, null, tag(`demo empty fborn null ${k}`));
      eq(dm.uni, null, tag(`demo empty uni null ${k}`));
      eq(dm.blue, null, tag(`demo empty blue null ${k}`));
      eq(dm.age, null, tag(`demo empty age null ${k}`));
      eq(dm.loinc, null, tag(`demo empty loinc null ${k}`));
      eq(dm.hiinc, null, tag(`demo empty hiinc null ${k}`));
      demoEmpties.push(k);
      continue;
    }
    ok(dm.langOther >= 0 && dm.langOther <= 1, tag(`demo lang range ${k}`));
    ok(dm.fborn >= 0 && dm.fborn <= 1, tag(`demo fborn range ${k}`));
    ok(dm.uni >= 0 && dm.uni <= 1, tag(`demo uni range ${k}`));
    ok(dm.blue >= 0 && dm.blue <= 1, tag(`demo blue range ${k}`));
    eq(Object.keys(dm.age), BANDS, tag(`demo age bands ${k}`));
    const sum = BANDS.reduce((s, x) => s + dm.age[x], 0);
    ok(Math.abs(sum - 1) < 0.005, tag(`demo age sum ${k} ${sum}`));
    // income: adult shares; envelopes pinned looser than the measured
    // extrema (lo 0.769 Special Hospital Team 2022; hi 0.645-0.65
    // Longueville every year)
    ok(dm.loinc != null && dm.loinc >= 0 && dm.loinc <= 0.8,
       tag(`demo loinc range ${k} ${dm.loinc}`));
    ok(dm.hiinc != null && dm.hiinc >= 0 && dm.hiinc <= 0.7,
       tag(`demo hiinc range ${k} ${dm.hiinc}`));
    eq(dm.cob && Object.keys(dm.cob), COB_KEYS,
       tag(`demo cob keys ${k}`));
    for (const ck of COB_KEYS) {
      ok(dm.cob[ck] === null || (dm.cob[ck] >= 0 && dm.cob[ck] <= 1),
         tag(`demo cob range ${ck} ${k}`));
    }
  }
  eq(demoEmpties, w.demoEmpties, tag("demo zero-persons rows"));
  let coDemoRows = 0;
  for (const c of d.cohorts) {
    ok(c.demo, tag(`cohort demo ${c.div} ${c.cohort}`));
    if (!c.demo) continue;
    coDemoRows++;
    ok(c.demo.persons >= 0, tag(`cohort demo persons ${c.div} ${c.cohort}`));
    if (c.demo.persons > 0) {
      eq(Object.keys(c.demo.age), BANDS, tag(`cohort demo bands ${c.div} ${c.cohort}`));
      const s = BANDS.reduce((a, x) => a + c.demo.age[x], 0);
      ok(Math.abs(s - 1) < 0.005, tag(`cohort demo age sum ${c.div} ${c.cohort}`));
      ok(c.demo.loinc != null, tag(`cohort demo loinc ${c.div} ${c.cohort}`));
      ok(c.demo.hiinc != null, tag(`cohort demo hiinc ${c.div} ${c.cohort}`));
      eq(c.demo.cob && Object.keys(c.demo.cob), COB_KEYS,
        tag(`cohort cob keys ${c.div} ${c.cohort}`));
      for (const ck of COB_KEYS) {
        ok(c.demo.cob[ck] === null ||
           (c.demo.cob[ck] >= 0 && c.demo.cob[ck] <= 1),
          tag(`cohort cob range ${ck} ${c.div}`));
      }
    }
  }
  // counts.demo.rows spans BOTH the booth rows and the cohort rows
  eq(demoRowCount + coDemoRows, w.demo.rows, tag("demo rows == booths + cohorts"));
  eq(coDemoRows, w.cohorts, tag("every cohort row carries demo"));
  {
    const [div, booth, want] = w.demoMaxLang;
    const b = byKey.get(`${div}|${booth}`);
    ok(b && b.demo, tag(`demo max-lang row ${div}|${booth}`));
    if (b && b.demo) eq(b.demo.langOther, want, tag(`demo max-lang ${booth}`));
  }

  // divisions block: the per-SA1 tallies re-pooled by division
  eq(d.divisions.length, w.divs, tag("divisions count"));
  ok(d._about.includes("divisions array"), tag("_about documents divisions"));
  {
    const a65 = (r) => r.age["65_74"] + r.age["75_84"] + r.age["85ov"];
    const a014 = (r) => r.age["0_4"] + r.age["5_14"];
    let dvotes = 0;
    let dprev = null;
    let ppers = 0;
    let plang = 0;
    let p0 = 0;
    let p65 = 0;
    let plo = 0;
    let phi = 0;
    const langSorted = [];
    const oldSorted = [];
    const loSorted = [];
    const hiSorted = [];
    const medSorted = [];
    for (const r of d.divisions) {
      eq(STATE_ORDER.includes(r.state), true, tag(`division state ${r.div}`));
      ok(r.votes >= 1, tag(`division votes ${r.div}`));
      ok(r.persons > 0, tag(`division persons ${r.div}`));
      ok(r.cov >= 0.999, tag(`division cov ${r.div} ${r.cov}`));
      ok(r.langOther >= 0 && r.langOther <= 1,
         tag(`division lang range ${r.div}`));
      ok(r.fborn >= 0 && r.fborn <= 1, tag(`division fborn range ${r.div}`));
      ok(r.uni >= 0 && r.uni <= 1, tag(`division uni range ${r.div}`));
      ok(r.blue >= 0 && r.blue <= 1, tag(`division blue range ${r.div}`));
      eq(Object.keys(r.age), BANDS, tag(`division age bands ${r.div}`));
      const s = BANDS.reduce((a, x) => a + r.age[x], 0);
      ok(Math.abs(s - 1) < 0.005, tag(`division age sum ${r.div} ${s}`));
      ok(r.loinc != null && r.loinc >= 0 && r.loinc <= 0.6,
         tag(`division loinc range ${r.div} ${r.loinc}`));
      ok(r.hiinc != null && r.hiinc >= 0 && r.hiinc <= 0.6,
         tag(`division hiinc range ${r.div} ${r.hiinc}`));
      ok(typeof r.incMed === "number" && r.incMed >= 1000 &&
         r.incMed <= 3200, tag(`division incMed range ${r.div} ${r.incMed}`));
      eq(Object.keys(r.cob), COB_KEYS, tag(`division cob keys ${r.div}`));
      for (const ck of COB_KEYS) {
        ok(r.cob[ck] != null && r.cob[ck] >= 0 && r.cob[ck] <= 0.6,
           tag(`division cob range ${ck} ${r.div}`));
      }
      const k = [STATE_ORDER.indexOf(r.state), r.div];
      if (dprev) {
        ok(k[0] > dprev[0] || (k[0] === dprev[0] && k[1] > dprev[1]),
           tag(`division sort ${r.div}`));
      }
      dprev = k;
      dvotes += r.votes;
      ppers += r.persons;
      plang += r.persons * r.langOther;
      p0 += r.persons * a014(r);
      p65 += r.persons * a65(r);
      plo += r.persons * r.loinc;
      phi += r.persons * r.hiinc;
      langSorted.push([r.langOther, r.div]);
      oldSorted.push([Number(a65(r).toFixed(4)), r.div]);
      loSorted.push([r.loinc, r.div]);
      hiSorted.push([r.hiinc, r.div]);
      medSorted.push([r.incMed, r.div]);
    }
    eq(dvotes + d.counts.votesSentinel + (d.counts.votesDroppedXwalk || 0),
       w.votesTotal, tag("division votes + sentinel == votesTotal"));
    ok(Math.abs(plang / ppers - w.demo.national.langOther) < 0.0005,
       tag("divisions recompose national langOther"));
    ok(Math.abs(p0 / ppers - w.demo.national.age0_14) < 0.0005,
       tag("divisions recompose national age0_14"));
    ok(Math.abs(p65 / ppers - w.demo.national.age65ov) < 0.0005,
       tag("divisions recompose national age65ov"));
    // income recompositions are genuinely person-weighted here while the
    // lanes are adult-weighted (income-dist factors vary by division) —
    // measured gaps: lo <= 0.0007, hi <= 0.0023 across the four years
    ok(Math.abs(plo / ppers - w.demo.national.loinc) < 0.001,
       tag("divisions recompose national loinc (person-weighted)"));
    ok(Math.abs(phi / ppers - w.demo.national.hiinc) < 0.003,
       tag("divisions recompose national hiinc (person-weighted)"));
    langSorted.sort((a, b) => b[0] - a[0]);
    oldSorted.sort((a, b) => b[0] - a[0]);
    eq([langSorted[0][1], langSorted[0][0]], w.demoDivs.langMax,
       tag("division lang max"));
    eq([langSorted[langSorted.length - 1][1],
        langSorted[langSorted.length - 1][0]], w.demoDivs.langMin,
       tag("division lang min"));
    eq([oldSorted[0][1], oldSorted[0][0]], w.demoDivs.oldMax,
       tag("division age65 max"));
    eq([oldSorted[oldSorted.length - 1][1],
        oldSorted[oldSorted.length - 1][0]], w.demoDivs.oldMin,
       tag("division age65 min"));
    const byFb = d.divisions.map((r) => [r.fborn, r.div])
      .sort((a, b) => b[0] - a[0]);
    const byUni = d.divisions.map((r) => [r.uni, r.div])
      .sort((a, b) => b[0] - a[0]);
    eq([byFb[0][1], byFb[0][0]], w.demoDivs.fbMax,
       tag("division fborn max"));
    eq([byFb[byFb.length - 1][1], byFb[byFb.length - 1][0]],
       w.demoDivs.fbMin, tag("division fborn min"));
    eq([byUni[0][1], byUni[0][0]], w.demoDivs.uniMax,
       tag("division uni max"));
    eq([byUni[byUni.length - 1][1], byUni[byUni.length - 1][0]],
       w.demoDivs.uniMin, tag("division uni min"));
    // blue-collar (GCP G60B: trades + drivers + labourers of the
    // eight stated ANZSCO occupation major groups): Flynn max every
    // year; North Sydney min 2016-2022, Wentworth 2025
    const byBlue = d.divisions.map((r) => [r.blue, r.div])
      .sort((a, b) => b[0] - a[0]);
    eq([byBlue[0][1], byBlue[0][0]], w.demoDivs.blueMax,
       tag("division blue max"));
    eq([byBlue[byBlue.length - 1][1], byBlue[byBlue.length - 1][0]],
       w.demoDivs.blueMin, tag("division blue min"));
    // income anchors: the two-share envelope faces plus the
    // household-basis median extremes
    loSorted.sort((a, b) => b[0] - a[0]);
    hiSorted.sort((a, b) => b[0] - a[0]);
    medSorted.sort((a, b) => b[0] - a[0]);
    eq([loSorted[0][1], loSorted[0][0]], w.demoInc.loMax,
       tag("division loinc max"));
    eq([loSorted[loSorted.length - 1][1],
        loSorted[loSorted.length - 1][0]], w.demoInc.loMin,
       tag("division loinc min"));
    eq([hiSorted[0][1], hiSorted[0][0]], w.demoInc.hiMax,
       tag("division hiinc max"));
    eq([hiSorted[hiSorted.length - 1][1],
        hiSorted[hiSorted.length - 1][0]], w.demoInc.hiMin,
       tag("division hiinc min"));
    eq([medSorted[0][1], medSorted[0][0]], w.demoInc.medMax,
       tag("division incMed max"));
    eq([medSorted[medSorted.length - 1][1],
        medSorted[medSorted.length - 1][0]], w.demoInc.medMin,
       tag("division incMed min"));
    const lg = d.divisions.find((r) => r.div === "Lingiari");
    ok(lg, tag("Lingiari row"));
    if (lg) {
      eq(lg.votes, w.demoDivs.lingiari.votes, tag("Lingiari votes"));
      eq(lg.persons, w.demoDivs.lingiari.persons, tag("Lingiari persons"));
      eq(lg.langOther, w.demoDivs.lingiari.lang, tag("Lingiari lang"));
      eq(lg.fborn, w.demoDivs.lingiari.fborn, tag("Lingiari fborn"));
      eq(lg.uni, w.demoDivs.lingiari.uni, tag("Lingiari uni"));
      eq(Number(a65(lg).toFixed(4)), w.demoDivs.oldMin[1],
         tag("Lingiari age65"));
      eq(lg.loinc, w.incLingiari.lo, tag("Lingiari loinc"));
      eq(lg.hiinc, w.incLingiari.hi, tag("Lingiari hiinc"));
      eq(lg.incMed, w.incLingiari.med, tag("Lingiari incMed"));
    }
    // birthplace-country landmarks: country maxima across the seats
    // (Fowler's Vietnam-born the signature cluster behind Cabramatta)
    const top = (ck) => {
      const t = [...d.divisions].sort((a, b) => b.cob[ck] - a.cob[ck])[0];
      return [t.div, t.cob[ck]];
    };
    eq(top("eng"), w.demoCob.engTop, tag("division eng max"));
    eq(top("ind"), w.demoCob.indTop, tag("division ind max"));
    eq(top("chn"), w.demoCob.chnTop, tag("division chn max"));
    eq(d.divisions.find((r) => r.div === "Fowler").cob.vnm,
       w.demoCob.fowlerVnm, tag("Fowler Vietnam-born"));
  }

  // spot cells
  for (const [div, booth, want] of w.spots) {
    const b = byKey.get(`${div}|${booth}`);
    ok(b, tag(`spot row ${div}|${booth}`));
    if (!b) continue;
    if (want.votes != null) eq(b.votes, want.votes, tag(`spot votes ${booth}`));
    if (want.sa1s != null) eq(b.sa1s, want.sa1s, tag(`spot sa1s ${booth}`));
    if (want.seifa) {
      want.seifa.forEach((v, j) => {
        if (v != null) eq(b.seifa[IDX[j]], v, tag(`spot ${booth} ${IDX[j]}`));
      });
    }
    if (want.cov) {
      want.cov.forEach((v, j) => eq(b.cov[IDX[j]], v, tag(`spot cov ${booth} ${IDX[j]}`)));
    }
  }
  if (w.cohortSpot) {
    for (const [div, coh, want] of w.cohortSpot) {
      const c = d.cohorts.find((r) => r.div === div && r.cohort === coh);
      ok(c, tag(`cohort row ${div} ${coh}`));
      if (!c) continue;
      eq(c.votes, want.votes, tag(`cohort votes ${div}`));
      eq(c.sa1s, want.sa1s, tag(`cohort sa1s ${div}`));
      want.seifa.forEach((v, j) => eq(c.seifa[IDX[j]], v, tag(`cohort ${div} ${IDX[j]}`)));
      want.cov.forEach((v, j) => eq(c.cov[IDX[j]], v, tag(`cohort cov ${div} ${IDX[j]}`)));
    }
  }
}

if (failures) {
  console.error(`${failures} failure(s)`);
  process.exit(1);
}
console.log("test-booth-seifa-voter ok");
