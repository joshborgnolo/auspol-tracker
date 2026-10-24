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
   9. Demo block (the 2026-10-24 add-on: 2021-census GCP G01 aged/lang
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
    coverage: { irsd: 0.9968, irsad: 0.9968, ier: 0.9969, ieo: 0.997 },
    recon: { matched: 8196, missing: 0, medianAbsPct: 0.12, p95AbsPct: 0.83,
             maxAbs: 236, maxAbsBooth: "Canberra|65739|sa1file vs fpv diff -236" },
    delta: {
      irsd: { compared: 7454, medianAbs: 29.4, p95Abs: 130, moved100: 725 },
      irsad: { compared: 7454, medianAbs: 31.7, p95Abs: 118.4, moved100: 621 },
      ier: { compared: 7454, medianAbs: 38, p95Abs: 166.6, moved100: 1120 },
      ieo: { compared: 7477, medianAbs: 26.8, p95Abs: 99.3, moved100: 367 },
    },
    mins: { irsd: 437.4, irsad: 554.7, ier: 483, ieo: 691.1 },
    maxs: { irsd: 1143.9, irsad: 1178, ier: 1229.1, ieo: 1216 },
    sentinelIds: "9999901",
    zeroVotes: ["Brand|65161"],
    demo: { rows: 8795, coverage: 1.0, national: { langOther: 0.218, age0_14: 0.1805, age65ov: 0.1823 } },
    demoMaxLang: ["Lingiari", "Home Island", 0.9804],
    demoEmpties: [],
    spots: [
      ["Canberra", "Norfolk Island", { votes: 59, sa1s: 7, seifa: [1052.9, 1069.2, 1060, 1072.4], cov: [1, 1, 1, 1] }],
      ["Melbourne", "Collingwood", { votes: 1668, seifa: [883, null, null, null] }],
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
    demo: { rows: 9343, coverage: 1.0, national: { langOther: 0.2205, age0_14: 0.1825, age65ov: 0.1789 } },
    demoMaxLang: ["Lingiari", "Remote Mobile Team 5", 0.9425],
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
    demo: { rows: 9052, coverage: 1.0, national: { langOther: 0.2229, age0_14: 0.1835, age65ov: 0.1761 } },
    demoMaxLang: ["Lingiari", "Home Island PPVC", 0.9695],
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
    demo: { rows: 9513, coverage: 1.0, national: { langOther: 0.2277, age0_14: 0.1855, age65ov: 0.1728 } },
    demoMaxLang: ["Lingiari", "Remote Mobile Team 5", 0.942],
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
  ok(d.demoBasis && d.demoBasis.includes("2021 Census GCP G01"), tag("demoBasis"));
  ok(d._about.includes("GCP G01"), tag("_about names GCP G01"));
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
      eq(dm.age, null, tag(`demo empty age null ${k}`));
      demoEmpties.push(k);
      continue;
    }
    ok(dm.langOther >= 0 && dm.langOther <= 1, tag(`demo lang range ${k}`));
    eq(Object.keys(dm.age), BANDS, tag(`demo age bands ${k}`));
    const sum = BANDS.reduce((s, x) => s + dm.age[x], 0);
    ok(Math.abs(sum - 1) < 0.005, tag(`demo age sum ${k} ${sum}`));
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
