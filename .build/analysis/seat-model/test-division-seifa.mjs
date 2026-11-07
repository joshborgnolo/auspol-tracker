#!/usr/bin/env node
/* test-division-seifa.mjs — pin data/division-seifa-indexes.json +
   .build/analysis/seat-model/seifa-src/aph-fixtures.json
   (extract-division-seifa.mjs). Invariants:

   1. Store elections are exactly the landed set {1993, 1996, 1998, 2001,
      2004, 2007, 2010, 2013, 2016, 2019, 2022, 2025} plus the irsad-only
      forward block 2028, each N divisions (147 in 1993, 148 in 1996/1998,
      151 in 2019/2022, 150 otherwise), division-keyed, no others.
   2. Division sets are NAME-EXACT against data/division-classifications.json's
      matching election blocks — joins must never miss (1993: the
      1991-2-edition set, certified against the map's own served frame —
      the classifications file predates a 1993 block; 1996: the
      1993-4-edition set, Namadgi in / Corinella out; 1998: the
      1997-in-force set, Blair in / Namadgi out; 2001: 2000-edition
      set with Bonython/Burke, 2007: the 2006-edition set, 2010: the 2009
      edition, 2019/2022: the 151-division editions with Macnamara and then
      Hawke, 2025: back to 150 with Bullwinkel; 2028's 150 are the
      2025-edition set with Bullwinkel retained and every 2025 name kept
      except the redistributed pairs — checked against the classifications
      block 2028 where present, else the cells file's own set NAMED here).
   3. Row shape per election block: the 2001-2025 blocks carry exactly
      {state, irsd, ier, ieo, irsad, via} — state one of the eight codes;
      irsd/ier/ieo {value: number, rank: int 1..N}; irsad
      {value: number, rank: int 1..N, rankDis: int 1..N} with
      rankDis = N+1-rank (rank runs 1 = MOST ADVANTAGED, the natural IRSAD
      read, unlike the other three where 1 = most disadvantaged); via
      matches the election's lane (2001=absCed01, 2004=aph05cib01,
      2007=aph09rp02, 2010=aph11rp01, 2013=absSa1Ced2011,
      2016=absSa1Ced2016, 2019=absSa1Ced2018, 2022=absMbCed2021,
      2025=absMbCed2024). The 2028 forward block carries {state, irsad, via}
      only — the other three indexes have no 2025-boundary product. The
      1993/1996/1998 blocks mirror that asymmetry the other way: {state,
      irsd, ier, ieo, via} only — their era predates IRSAD (a 2001-census
      invention) and the five-index-era Advantage composite is no
      substitute (kept fixture-only under the key `adv`; the 1993/1996
      blocks derive era-cube x era-set per derive-division-seifa-stats90s.py,
      1998's paper prints its own scores).
   4. Ranks per election x index are an exact permutation of 1..N (the APH
      prints a complete ranking; the ABS lanes compute one from their carried
      scores; ties are ordered, never shared). For irsad BOTH rank keys are
      permutations, and rankDis is the exact complement.
   5. Known cells, spread across elections, indexes, states and rankings —
      APH cells read straight off the printed tables, ABS cells recomputed
      against the ABS cubes: 2007 Lingiari is last on Disadv (831/rank 1)
      and IER (856/rank 1) but 36th on IEO — the small-area education split
      the papers highlight; 2007 Bradfield tops Disadv at 1119 (rank 150);
      2007 Melbourne is the paper's anomaly of IER-rank-13 vs IEO-rank-140;
      Prospect exists 2007 only; 2010 Lingiari repeats last at 830.6/1; 2010
      North Sydney tops IEO at 1187.7/150. ABS lanes: 2001 Bonython/Bradfield
      bound the printed cube (888.213/2, 1139.179/150); 2013 Lingiari last
      (831.204/1) and North Sydney first on IEO (1178.042/150); 2019's new
      Macnamara ranks 135/151 on Disadv (1074.079); 2022's new Hawke 51st
      (982.037); 2025's Bullwinkel enters at 97 (1022.497) with Lingiari
      identical to its 2022 self on unchanged NT boundaries (834.708/2).
      IRSAD cells pinned against the sibling pipeline's committed display
      rows: 2001 North Sydney most advantaged (1204/rank 1) and Bonython
      most disadvantaged (882/150, rankDis 1); 2007 Bradfield leads again
      at 1182; 2019 Macnamara is high-IRSAD despite its low-IRSD pockets
      (1107/rank 14, rankDis 138); 2025 Bullwinkel enters just under the
      median (997.8/70, rankDis 81) and forward-block Lingiari sits
      second-most-disadvantaged (886.9/rank 149, rankDis 2).
   6. Printed-score means: unweighted mean across divisions of each index
      rounds to the papers' printed "overall average" figures 1005/1006/
      1007/998 (IRSD/IRSAD/IER/IEO) for BOTH the 2006- and 2009-boundary
      papers — an end-to-end checksum over every parsed score (fixture
      lane, the same figure the store's spliced cells derive from).
   7. The 01cib13 xcheck fixture (1996 census x 2000 boundaries, never a
      store input) parses to exactly 150 divisions with complete 1..150 rank
      permutations on each of its four indexes — its use is downstream
      verification of the 2001-census derivation lane, and a truncated parse
      must not go unnoticed.
   8. Fixture tie-band bookkeeping: aph09rp02 prints 18 and aph11rp01 22
      benign within-band rank reorderings between the per-index ranked table
      and Table 5 (Table-5 canonical in this store). The counts are pinned so
      a layout shift or silent parse gap can't masquerade as clean paper.
   9. Every fixture row carries all four of its paper's indexes (98cib04
      substitutes its era's Advantage composite for IRSAD under the key
      `adv`) plus party and the APH's own geographic rating from Table 5
      (01cib13/05cib01/98cib04 have no Table 5, so rating is absent there
      by construction) — a row must never drop a column silently.
  10. Every election's via resolves to a _provenance entry whose censusYear
      matches the election's census (1996 backs 1998; 2001- and 2016-census
      products back two elections each) — an unregistered lane must fail loud here, never
      surface as a silent "via unknown" downstream. For shared elections the
      irsad lane is registered per census+derivation (irsad-published-2001
      backs the 2001 rows, irsad-published-2001-e2003 the 2004 rows, …) and
      its provenance censusYear likewise matches.
  11. The combined store stays byte-faithful to the sibling display store:
      for every election and division, the merged irsad cell's value+rank
      equals the matching row in .build/analysis/seifa-index/irsad-by-division.json
      (the single-file merge is a splice, never a re-derivation — drift
      between the two stores would quietly fork the site's IRSAD record).
      1998 is exempt: IRSAD is a 2001-census invention, so its block
      carries none to compare.
  12. The 1998 block's exact-match oracle: every 1998 division whose state
      sat unchanged between the two papers' boundary sets (VIC, QLD —
      its 1997 amendment is already in both — and the two surviving ACT
      seats, 66 divisions in all) carries byte-identical irsd/ier/ieo
      VALUES in 98cib04 and the aph01cib13 xcheck fixture (same 1996
      census, same boundaries, different papers). Values only — ranks move
      between an N=148 and an N=150 ranking universe.
  13. The percentile layer (2026-10-24 pcti directive): EVERY index cell of
      every election carries pct = rankDis/N rounded to 6dp, and the six
      census-bracketed elections (2004/2007/2010 on the CD-polygon era
      lanes plus 2013/2016/2019 on the SA1 concordance lanes) additionally
      carry pcti on all four indexes, no other election any. f recomputes
      from census-night daycounts; the measured side (2016's is pct1 —
      the census sat five weeks AFTER election day) matches rankDis/N on
      the nose; pcti re-derives bit-exact from the lattice's r6 cells at
      f and sits in (0,1]; store cells match .build/analysis/seat-model/
      seifa-src/div-interp.json cell-for-cell. Booth lanes cover the full
      2004–2019 span (test-booth-seifa-hist.mjs).
  14. Literal pcti anchors: eleven cells (Lingiari 2004 irsd both-sides-
      terminal, Melbourne 2004's IER flip, Solomon 2007, Moncrieff 2010,
      Dawson's mining-boom fade 2013, Solomon 2019's IER slide, Lingiari
      2019 terminal on both census sides, Macnamara 2019 stable) pinned
      to the lattice's green runs — a lattice swap re-derives a self-
      consistent but wrong pct set, so these moves are deliberate
      re-pinning only.
  15. Rank-delta bands: interpolation must move the median division only a
      little, while real movement (growth suburbs, mining seats) may be
      large. The SA1-concordance lanes (2013/2019) hold median |pcti −
      measured side| < 0.03, max < 0.25; 2016's census sat five weeks out
      (< 0.002 / < 0.015); the CD-era lanes (2004/2007/2010) run wider
      (< 0.08 / < 0.50) — whole-unit CD/SA1-to-era-polygon allocation is
      coarser than concordance weighting and their f leans away from the
      measured side, so their honest deltas are bigger; the bands still
      catch silent formula drift.

   The extractor runs standalone from the repo root:
     node .build/analysis/seat-model/extract-division-seifa.mjs
   followed by:
     node .build/analysis/seat-model/test-division-seifa.mjs             */
import { readFileSync } from "node:fs";

const SEIFA = "data/division-seifa-indexes.json";
const CLASS = "data/division-classifications.json";
const FIXTURE = ".build/analysis/seat-model/seifa-src/aph-fixtures.json";
const SIBLING = ".build/analysis/seifa-index/irsad-by-division.json";

let failures = [];
const check = (ok, msg) => { if (!ok) failures.push(msg); };
const die = () => { for (const f of failures) console.error(`  FAIL ${f}`); if (failures.length) process.exit(1); };

const store = JSON.parse(readFileSync(SEIFA, "utf8"));
const klass = JSON.parse(readFileSync(CLASS, "utf8")).elections;
const fixtures = JSON.parse(readFileSync(FIXTURE, "utf8"));
const sibling = JSON.parse(readFileSync(SIBLING, "utf8"));

const IDX = ["irsd", "ier", "ieo"]; // store indexes
const IDX4 = ["irsad", "irsd", "ier", "ieo"]; // fixture indexes (98cib04 substitutes adv for irsad)
const COUNT_FOR = { 1993: 147, 1996: 148, 1998: 148, 2001: 150, 2004: 150, 2007: 150, 2010: 150, 2013: 150, 2016: 150, 2019: 151, 2022: 151, 2025: 150, 2028: 150 };
const ELECTION_SET = Object.keys(COUNT_FOR);
const SHARED_SET = ELECTION_SET.filter((y) => y !== "2028");
// the three-index-era elections (no IRSAD before the 2001 census — the
// store's measured blocks carry irsd/ier/ieo only there)
const THREE_IDX = new Set(["1993", "1996", "1998"]);
const VIA_FOR = {
  1993: "eraCd1991Ced1993set", 1996: "eraCd1996Ced1996set",
  1998: "aph98cib04",
  2001: "absCed01", 2004: "aph05cib01", 2007: "aph09rp02", 2010: "aph11rp01", 2013: "absSa1Ced2011",
  2016: "absSa1Ced2016", 2019: "absSa1Ced2018", 2022: "absMbCed2021", 2025: "absMbCed2024",
  2028: "irsad-weighted-2021-e2025",
};
const CENSUS_FOR = { 1993: 1991, 1996: 1996, 1998: 1996, 2001: 2001, 2004: 2001, 2007: 2006, 2010: 2006, 2013: 2011, 2016: 2016, 2019: 2016, 2022: 2021, 2025: 2021, 2028: 2021 };
const IRSAD_PROV_FOR = {
  2001: "irsad-published-2001", 2004: "irsad-published-2001-e2003",
  2007: "irsad-published-2006", 2010: "irsad-published-2006-e2009",
  2013: "irsad-weighted-2011", 2016: "irsad-weighted-2016",
  2019: "irsad-weighted-2016-e2018", 2022: "irsad-weighted-2021",
  2025: "irsad-weighted-2021-e2024", 2028: "irsad-weighted-2021-e2025",
};
const NAMES_2025_EDITION = ["Adelaide","Aston","Ballarat","Banks","Barker","Barton","Bass","Bean",
"Bendigo","Bennelong","Berowra","Blair","Blaxland","Bonner","Boothby","Bowman","Braddon","Bradfield",
"Brand","Brisbane","Bruce","Bullwinkel","Burt","Calare","Calwell","Canberra","Canning","Capricornia",
"Casey","Chifley","Chisholm","Clark","Cook","Cooper","Corangamite","Corio","Cowan","Cowper","Cunningham",
"Curtin","Dawson","Deakin","Dickson","Dobell","Dunkley","Durack","Eden-Monaro","Fadden","Fairfax","Farrer",
"Fenner","Fisher","Flinders","Flynn","Forde","Forrest","Fowler","Franklin","Fraser","Fremantle","Gellibrand",
"Gilmore","Gippsland","Goldstein","Gorton","Grayndler","Greenway","Grey","Griffith","Groom","Hasluck",
"Hawke","Herbert","Hindmarsh","Hinkler","Holt","Hotham","Hughes","Hume","Hunter","Indi","Isaacs","Jagajaga",
"Kennedy","Kingsford Smith","Kingston","Kooyong","La Trobe","Lalor","Leichhardt","Lilley","Lindsay",
"Lingiari","Longman","Lyne","Lyons","Macarthur","Mackellar","Macnamara","Macquarie","Makin","Mallee",
"Maranoa","Maribyrnong","Mayo","McEwen","McMahon","McPherson","Melbourne","Menzies","Mitchell","Monash",
"Moncrieff","Moore","Moreton","New England","Newcastle","Nicholls","O'Connor","Oxley","Page","Parkes",
"Parramatta","Paterson","Pearce","Perth","Petrie","Rankin","Reid","Richmond","Riverina","Robertson","Ryan",
"Scullin","Shortland","Solomon","Spence","Sturt","Swan","Sydney","Tangney","Wannon","Warringah","Watson",
"Wentworth","Werriwa","Whitlam","Wide Bay","Wills","Wright"];
const STATES = new Set(["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"]);

// 1
check(JSON.stringify(Object.keys(store.elections).sort()) === JSON.stringify([...ELECTION_SET].sort()),
  `store elections ${Object.keys(store.elections)} != ${ELECTION_SET}`);

for (const y of ELECTION_SET) {
  const N = COUNT_FOR[y];
  const blk = store.elections[y];
  check(Object.keys(blk).length === N, `${y}: ${Object.keys(blk).length} divisions != ${N}`);
  // 2 — name-exact division set against classifications (2028 pins against
  // its 2025-edition reference names; a classifications 2028 block landing
  // later must agree). The classifications file predates a 1993 block: the
  // 1993 lane pins against the map's own served frame's name set instead.
  const mine = new Set(Object.keys(blk));
  const theirs = y === "2028" && !klass[y] ? new Set(NAMES_2025_EDITION)
    : y === "1993" ? new Set(JSON.parse(readFileSync("map/data/res-1993.json", "utf8")).divs.map((x) => x.n))
    : new Set(Object.keys(klass[y] || {}));
  const missing = [...theirs].filter((n) => !mine.has(n));
  const extra = [...mine].filter((n) => !theirs.has(n));
  check(missing.length === 0 && extra.length === 0,
    `${y}: division-set mismatch — missing ${JSON.stringify(missing)} extra ${JSON.stringify(extra)}`);
  // 3
  for (const [name, row] of Object.entries(blk)) {
    const wantKeys = y === "2028" ? ["irsad", "state", "via"]
      : THREE_IDX.has(y) ? ["ieo", "ier", "irsd", "state", "via"]
      : ["ieo", "ier", "irsad", "irsd", "state", "via"];
    check(JSON.stringify(Object.keys(row).sort()) === JSON.stringify(wantKeys),
      `${y} ${name}: row keys ${Object.keys(row)}`);
    check(STATES.has(row.state), `${y} ${name}: bad state ${row.state}`);
    if (y !== "2028") {
      for (const idx of IDX) {
        const cell = row[idx];
        check(Number.isFinite(cell.value) && Number.isInteger(cell.rank),
          `${y} ${name} ${idx}: bad cell ${JSON.stringify(cell)}`);
        check(cell.rank >= 1 && cell.rank <= N, `${y} ${name} ${idx}: rank ${cell.rank} out of 1..${N}`);
        check(cell.value > 700 && cell.value < 1400, `${y} ${name} ${idx}: value ${cell.value} outside sanity band`);
      }
    }
    if (!THREE_IDX.has(y)) {
      const cell = row.irsad;
      check(cell && Number.isFinite(cell.value) && Number.isInteger(cell.rank) && Number.isInteger(cell.rankDis),
        `${y} ${name} irsad: bad cell ${JSON.stringify(cell)}`);
      check(cell.rank >= 1 && cell.rank <= N && cell.rankDis >= 1 && cell.rankDis <= N,
        `${y} ${name} irsad: ranks ${cell.rank}/${cell.rankDis} out of 1..${N}`);
      check(cell.rankDis === N + 1 - cell.rank,
        `${y} ${name} irsad: rankDis ${cell.rankDis} != ${N + 1} - rank ${cell.rank}`);
      check(cell.value > 700 && cell.value < 1400, `${y} ${name} irsad: value ${cell.value} outside sanity band`);
    }
    check(row.via === VIA_FOR[y], `${y} ${name}: via ${row.via} != ${VIA_FOR[y]}`);
  }
  // 4
  for (const idx of y === "2028" ? [] : IDX) {
    const ranks = Object.values(blk).map((r) => r[idx].rank).sort((a, b) => a - b);
    check(ranks.length === N && ranks.every((r, i) => r === i + 1),
      `${y} ${idx}: ranks are not a 1..${N} permutation`);
  }
  if (!THREE_IDX.has(y)) for (const key of ["rank", "rankDis"]) {
    const ranks = Object.values(blk).map((r) => r.irsad[key]).sort((a, b) => a - b);
    check(ranks.length === N && ranks.every((r, i) => r === i + 1),
      `${y} irsad.${key}: ranks are not a 1..${N} permutation`);
  }
}

// 10 — every lane is a registered, census-correct provenance entry (both
// the three-index lanes and the spliced IRSAD lanes)
for (const y of ELECTION_SET) {
  for (const via of new Set([VIA_FOR[y], IRSAD_PROV_FOR[y]].filter(Boolean))) {
    const prov = store._provenance[via];
    check(prov != null, `${y}: no _provenance entry for via ${via}`);
    if (prov) {
      check(prov.censusYear === CENSUS_FOR[y],
        `${y} via ${via}: censusYear ${prov.censusYear} != ${CENSUS_FOR[y]}`);
      check(typeof prov.editionInForce === "string" && prov.editionInForce.length > 0,
        `${y} via ${via}: no editionInForce`);
    }
  }
}

// 11 — merged irsad cells byte-faithful to the sibling display store
// (the three-index-era elections carry no irsad — IRSAD is a 2001-census
// invention; 2028's forward block is irsad-only)
for (const y of ELECTION_SET.filter((y) => !THREE_IDX.has(y))) {
  const srows = new Map(sibling.elections[y].rows.map((r) => [r.division, r]));
  const RENAME = { "Kingston-Smith": "Kingsford Smith", "McEwan": "McEwen" };
  const canon = (n) => {
    const t = n.trim().replace(/[’‘]/g, "'");
    return (RENAME[t] ?? t).replace(/\bMc([a-z])/g, (m, c) => "Mc" + c.toUpperCase());
  };
  for (const [name, row] of Object.entries(store.elections[y])) {
    const srow = [...sibling.elections[y].rows].find((r) => canon(r.division) === name);
    if (!srow) { failures.push(`${y} ${name}: no sibling row`); continue; }
    check(row.irsad.value === srow.irsad && row.irsad.rank === srow.rank,
      `${y} ${name} irsad: merged ${row.irsad.value}/rank ${row.irsad.rank} != sibling ${srow.irsad}/rank ${srow.rank}`);
  }
}

// 5 — pinned cells, verbatim from the printed tables
const PIN = [];
const pin = (y, name, idx, value, rank) => {
  const cell = store.elections[y]?.[name]?.[idx];
  if (!cell) { failures.push(`${y} ${name}: absent`); return; }
  check(cell.value === value && cell.rank === rank,
    `${y} ${name} ${idx}: got ${cell.value}/rank ${cell.rank}, want ${value}/rank ${rank}`);
};
const pinDis = (y, name, value, rank, rankDis) => {
  const cell = store.elections[y]?.[name]?.irsad;
  if (!cell) { failures.push(`${y} ${name}: irsad absent`); return; }
  check(cell.value === value && cell.rank === rank && cell.rankDis === rankDis,
    `${y} ${name} irsad: got ${cell.value}/rank ${cell.rank}/rankDis ${cell.rankDis}, want ${value}/${rank}/${rankDis}`);
};
pin("2007", "Lingiari", "irsd", 831, 1);
pin("2007", "Lingiari", "ier", 856, 1);
pin("2007", "Lingiari", "ieo", 941, 36);
pin("2007", "Bradfield", "irsd", 1119, 150);
pin("2007", "Bradfield", "ieo", 1178, 148);
pin("2007", "Melbourne", "ier", 956, 13);
pin("2007", "Melbourne", "ieo", 1141, 140);
pin("2007", "Prospect", "irsd", 967, 29);
pin("2007", "Kalgoorlie", "irsd", 954, 17);
pin("2007", "Lowe", "irsd", 1047, 121);
pin("2010", "Lingiari", "irsd", 830.6, 1);
pin("2010", "Lingiari", "ier", 856.1, 1);
pin("2010", "North Sydney", "ieo", 1187.7, 150);
pin("2010", "McMahon", "irsd", 967.1, 29);
// 2004 (05cib01, 2001 census on 2003-edition boundaries)
pin("2004", "Lingiari", "irsd", 901.2, 2);
pin("2004", "Lingiari", "ier", 999.2, 82);
pin("2004", "Lingiari", "ieo", 976.1, 68);
pin("2004", "Bradfield", "irsd", 1139.2, 150);
pin("2004", "Bradfield", "ier", 1218.4, 149);
pin("2004", "Bradfield", "ieo", 1189.4, 149);
pin("2004", "Bonner", "irsd", 1025.7, 110);
pin("2004", "Gorton", "ieo", 928.6, 19);
// 1998 (aph98cib04, 1996 census on the 1997-in-force boundaries) —
// terminals on all three indexes, plus the era's own boundary markers:
// Blair (created by the 1997 Qld amendment), the still-hyphenated
// Kingsford-Smith, and the single-member Northern Territory division
// (its last election before the 2000-edition split).
pin("1998", "Fowler", "irsd", 877.7, 1);
pin("1998", "Bradfield", "irsd", 1169.7, 148);
pin("1998", "Grey", "ier", 925.1, 1);
pin("1998", "Bradfield", "ier", 1240.4, 148);
pin("1998", "Bonython", "ieo", 868.1, 1);
pin("1998", "Bradfield", "ieo", 1196.9, 148);
pin("1998", "Blair", "irsd", 959.6, 26);
pin("1998", "Kingsford-Smith", "irsd", 1007.9, 94);
pin("1998", "Northern Territory", "ier", 947.5, 14);
// ABS lanes
pin("2001", "Bonython", "irsd", 888.213, 2);
pin("2001", "Bradfield", "irsd", 1139.179, 150);
pin("2001", "Lingiari", "irsd", 902.74, 3);
pin("2001", "Sydney", "ieo", 1163.943, 143);
pin("2013", "Lingiari", "irsd", 831.204, 1);
pin("2013", "North Sydney", "ieo", 1178.042, 150);
pin("2013", "Bradfield", "irsd", 1103.371, 150);
pin("2016", "Lingiari", "irsd", 836.477, 1);
pin("2016", "Grayndler", "ieo", 1133.535, 140);
pin("2016", "Mallee", "irsd", 948.598, 22);
pin("2019", "Macnamara", "irsd", 1074.079, 135);
pin("2019", "Lingiari", "irsd", 847.744, 1);
pin("2019", "Mallee", "ier", 955.061, 19);
pin("2022", "Hawke", "irsd", 982.037, 51);
pin("2022", "Lingiari", "irsd", 834.708, 2);
pin("2025", "Bullwinkel", "irsd", 1022.497, 97);
pin("2025", "Lingiari", "irsd", 834.708, 2);
pin("2025", "Bradfield", "ier", 1085.551, 145);
// IRSAD pins (sibling pipeline's committed display rows, RR5/APH-printed or
// ABS-derived per lane)
pinDis("2001", "North Sydney", 1204, 1, 150);
pinDis("2001", "Bonython", 882, 150, 1);
pinDis("2007", "Bradfield", 1182, 1, 150);
pinDis("2019", "Macnamara", 1107, 14, 138);
pinDis("2025", "Bullwinkel", 997.8, 70, 81);
pinDis("2028", "Lingiari", 886.9, 149, 2);
PIN.forEach(() => {});
{
  const b2010 = store.elections["2010"];
  for (const n of ["Durack", "McMahon", "Wright"]) check(b2010[n], `2010: ${n} absent`);
  for (const n of ["Kalgoorlie", "Lowe", "Prospect"]) check(!b2010[n], `2010: ${n} should be absent`);
  const b2007 = store.elections["2007"];
  for (const n of ["Kalgoorlie", "Lowe", "Prospect"]) check(b2007[n], `2007: ${n} absent`);
  const b2001 = store.elections["2001"];
  for (const n of ["Bonython", "Burke"]) check(b2001[n], `2001: ${n} absent`);
  for (const n of ["Bonner", "Gorton"]) check(!b2001[n], `2001: ${n} should be absent`);
  const b2004 = store.elections["2004"];
  for (const n of ["Bonner", "Gorton"]) check(b2004[n], `2004: ${n} absent`);
  for (const n of ["Bonython", "Burke"]) check(!b2004[n], `2004: ${n} should be absent`);
  const b1998 = store.elections["1998"];
  for (const n of ["Blair", "Kingsford-Smith", "Northern Territory"]) check(b1998[n], `1998: ${n} absent`);
  for (const n of ["Namadgi", "Kingsford Smith", "Lingiari", "Solomon", "Hasluck"])
    check(!b1998[n], `1998: ${n} should be absent`);
  check(store.elections["2019"].Macnamara, "2019: Macnamara absent");
  check(store.elections["2022"].Hawke, "2022: Hawke absent");
  check(store.elections["2025"].Bullwinkel, "2025: Bullwinkel absent");
  const b2028 = store.elections["2028"];
  check(b2028.Bullwinkel && !b2028["North Sydney"] && b2028.Higgins === undefined && b2028.Lingiari,
    "2028: 2025-edition name set wrong");
}

// 6 — the papers' printed overall averages (population-weighted means) are
// reproduced to within the rounding slack implied by the printed score
// granularity (±0.7 comfortably covers ±0.5 quantization on 09rp02's one-
// integer cells plus residual population-weighting drift on divisions).
const MEANS = { irsd: 1005, irsad: 1006, ier: 1007, ieo: 998 };
for (const via of ["aph09rp02", "aph11rp01"]) {
  const rows = Object.values(fixtures[via].rows);
  for (const [idx, want] of Object.entries(MEANS)) {
    const mean = rows.reduce((s, r) => s + r[idx].value, 0) / rows.length;
    check(Math.abs(mean - want) < 0.7, `${via} ${idx}: mean ${mean.toFixed(2)} not ~${want}`);
  }
}

// 7 — the xcheck fixture (01cib13) is complete
{
  const rows = fixtures.aph01cib13.rows;
  check(Object.keys(rows).length === 150, `01cib13: ${Object.keys(rows).length} divisions != 150`);
  for (const idx of IDX4) {
    const ranks = Object.values(rows).map((r) => r[idx].rank).sort((a, b) => a - b);
    check(ranks.length === 150 && ranks.every((r, i) => r >= 1 && r <= 150),
      `01cib13 ${idx}: ranks outside 1..150`);
  }
}

// 8 — pinned tie-band conflict counts
check(fixtures.aph09rp02.tieRankConflicts.length === 18,
  `aph09rp02: ${fixtures.aph09rp02.tieRankConflicts.length} tie-band conflicts != 18`);
check(fixtures.aph11rp01.tieRankConflicts.length === 22,
  `aph11rp01: ${fixtures.aph11rp01.tieRankConflicts.length} tie-band conflicts != 22`);
check(fixtures.aph05cib01.tieRankConflicts.length === 0,
  `aph05cib01: ${fixtures.aph05cib01.tieRankConflicts.length} tie-band conflicts != 0 (no Table 5 to differ from)`);
check(fixtures.aph98cib04.tieRankConflicts.length === 0,
  `aph98cib04: ${fixtures.aph98cib04.tieRankConflicts.length} tie-band conflicts != 0 (no Table 5 to differ from)`);

// 9 — fixture rows carry the paper's full index set + party + (Table-5 papers) rating
for (const via of Object.keys(fixtures)) {
  const FIDX = via === "aph98cib04" ? ["adv", "irsd", "ier", "ieo"] : IDX4;
  for (const [name, row] of Object.entries(fixtures[via].rows)) {
    for (const idx of FIDX)
      check(row[idx] && Number.isFinite(row[idx].value) && Number.isInteger(row[idx].rank),
        `${via} ${name}: fixture ${idx} cell broken`);
    check(typeof row.party === "string" && row.party.length, `${via} ${name}: no party`);
    if (via === "aph09rp02" || via === "aph11rp01")
      check(typeof row.rating === "string", `${via} ${name}: no Table-5 rating`);
    else
      check(row.rating === undefined, `${via} ${name}: unexpected rating on summary-table-less paper`);
  }
}

// 12 — the 1998 exact-match oracle: same 1996 census, same boundaries as
// the aph01cib13 fixture on every division whose state sat unchanged
// between the two papers' boundary sets (VIC, QLD and the two surviving
// ACT seats, 66 divisions) → irsd/ier/ieo VALUES byte-identical across
// the two independently parsed papers.
{
  const xrows = fixtures.aph01cib13.rows;
  let compared = 0;
  for (const [name, row] of Object.entries(store.elections["1998"])) {
    if (!["VIC", "QLD", "ACT"].includes(row.state)) continue;
    const xr = xrows[name];
    if (!xr) { failures.push(`1998 ${name}: absent from aph01cib13 fixture`); continue; }
    compared++;
    for (const idx of IDX)
      check(row[idx].value === xr[idx].value,
        `1998 ${name} ${idx}: 98cib04 ${row[idx].value} != 01cib13 ${xr[idx].value}`);
  }
  check(compared === 66, `98cib04∩01cib13 compared ${compared} divisions, want 66`);
}

// 13 — the percentile layer (2026-10-24 pcti directive). EVERY index cell in
// every election carries pct = rankDis/N rounded to 6dp (rankDis is the
// store convention, 1/N most disadvantaged). The shipped interp lanes —
// the 1993/1996/1998 era-CD-cube lanes (div-interp-90s.json) and the six
// GCP-era lanes (2004/2007/2010 CD-era plus 2013/2016/2019 SA1-era, both
// div-interp.json) — additionally carry pcti; NO other election carries
// pcti, and wherever a lattice file's measured side is, pct side ==
// rankDis/N on the nose.
// pcti itself is recomputed here from the LATTICE file's own cells and
// f — a splice defect in the extractor (wrong division, wrong side, wrong
// election) surfaces as a pcti mismatch; a wholesale lattice drift surfaces
// as a literal-pin break in invariant 14.
const INTERP_SRC = ".build/analysis/seat-model/seifa-src/div-interp.json";
const INTERP_SRC_90S = ".build/analysis/seat-model/seifa-src/div-interp-90s.json";
const interp = JSON.parse(readFileSync(INTERP_SRC, "utf8"));
const interp90 = JSON.parse(readFileSync(INTERP_SRC_90S, "utf8"));
const INTERP_YEARS_90S = ["1993", "1996", "1998"];
const INTERP_YEARS = [...INTERP_YEARS_90S, "2004", "2007", "2010", "2013", "2016", "2019"];
const INTERP_GCP = ["2004", "2007", "2010", "2013", "2016", "2019"];
const MEASURED = { 1993: "pct0", 1996: "pct1", 1998: "pct0", 2004: "pct0", 2007: "pct0", 2010: "pct0", 2013: "pct0", 2016: "pct1", 2019: "pct0" };
const CENSUS_DATE = { 1991: Date.UTC(1991, 7, 6), 1996: Date.UTC(1996, 7, 6), 2001: Date.UTC(2001, 7, 7), 2006: Date.UTC(2006, 7, 8), 2011: Date.UTC(2011, 7, 9), 2016: Date.UTC(2016, 7, 9), 2021: Date.UTC(2021, 7, 10) };
const ELEC_DATE = { 1993: Date.UTC(1993, 2, 13), 1996: Date.UTC(1996, 2, 2), 1998: Date.UTC(1998, 9, 3), 2004: Date.UTC(2004, 9, 9), 2007: Date.UTC(2007, 10, 24), 2010: Date.UTC(2010, 7, 21), 2013: Date.UTC(2013, 8, 7), 2016: Date.UTC(2016, 6, 2), 2019: Date.UTC(2019, 4, 18) };
const LATTICE = Object.fromEntries(INTERP_YEARS.map((y) => [y, {
  elections: (INTERP_YEARS_90S.includes(y) ? interp90 : interp).elections[y],
  factors: (INTERP_YEARS_90S.includes(y) ? interp90 : interp).factors[y],
}]));
check(JSON.stringify(Object.keys(interp.elections).sort()) === JSON.stringify(INTERP_GCP.sort()),
  `div-interp elections ${Object.keys(interp.elections)} != the GCP-era set (a lane must land here, never silently)`);
check(JSON.stringify(Object.keys(interp90.elections).sort()) === JSON.stringify(INTERP_YEARS_90S.sort()),
  `div-interp-90s elections ${Object.keys(interp90.elections)} != the era-90s set (a lane must land here, never silently)`);
check(JSON.stringify(Object.keys(interp90.factors).sort()) === JSON.stringify(INTERP_YEARS_90S.sort()),
  "div-interp-90s factors cover exactly the era-90s set");
{
  const DAY = 86400000;
  const F_WANT = {};
  for (const y of INTERP_YEARS) {
    const fc = LATTICE[y].factors;
    const num = (ELEC_DATE[y] - CENSUS_DATE[fc.c0]) / DAY;
    const den = (CENSUS_DATE[fc.c1] - CENSUS_DATE[fc.c0]) / DAY;
    F_WANT[y] = Math.round((num / den) * 1e6) / 1e6;
    check(fc.f === F_WANT[y], `${y}: f ${fc.f} != recomputed ${F_WANT[y]} (${num}/${den} days)`);
  }
  for (const y of INTERP_YEARS) {
    const YIDX = THREE_IDX.has(y) ? IDX : IDX4;
    const meKey = MEASURED[y];
    const f = LATTICE[y].factors.f;
    for (const [name, row] of Object.entries(store.elections[y])) {
      const irow = LATTICE[y].elections[name];
      check(irow != null, `${y} ${name}: absent from the interp lattice`);
      if (!irow) continue;
      for (const idx of YIDX) {
        const cell = row[idx], icell = irow[idx];
        check(cell.pct === icell[meKey],
          `${y} ${name} ${idx}: interp ${meKey} ${icell[meKey]} != store pct ${cell.pct}`);
        const recomputed = Math.round(((1 - f) * icell.pct0 + f * icell.pct1) * 1e6) / 1e6;
        check(icell.pcti === recomputed,
          `${y} ${name} ${idx}: file pcti ${icell.pcti} != recompute ${recomputed}`);
        check(cell.pcti === icell.pcti, `${y} ${name} ${idx}: store pcti ${cell.pcti} != lattice ${icell.pcti}`);
        check(cell.pcti > 0 && cell.pcti <= 1, `${y} ${name} ${idx}: pcti ${cell.pcti} outside (0,1]`);
      }
    }
  }
}
for (const y of ELECTION_SET) {
  const N = COUNT_FOR[y];
  for (const [name, row] of Object.entries(store.elections[y])) {
    for (const idx of IDX4.filter((k) => row[k])) {
      const cell = row[idx];
      const rankDis = idx === "irsad" ? cell.rankDis : cell.rank;
      const wantPct = Math.round((rankDis / N) * 1e6) / 1e6;
      check(cell.pct === wantPct, `${y} ${name} ${idx}: pct ${cell.pct} != rankDis/N ${wantPct}`);
      check(cell.pct > 0 && cell.pct <= 1, `${y} ${name} ${idx}: pct ${cell.pct} outside (0,1]`);
      if (!INTERP_YEARS.includes(y))
        check(cell.pcti === undefined, `${y} ${name} ${idx}: pcti outside the shipped lanes`);
    }
  }
}

// 14 — literal pcti anchors, transcribed from the lattice's green runs
// (2013/2016/2019 cells from the first run 2026-10-24; the CD-era cells
// added 2026-10-25 with the era lanes): the movement-shaped cells
// (Lingiari 2004 falling to 1/150 by the 2006 census lattice, Melbourne
// 2004's IER slide out of the top decile, Solomon 2007, Moncrieff 2010,
// Dawson's mining-boom fade 2013, Solomon 2019), a both-ranks-terminal
// cell (Lingiari 2019, most disadvantaged on both census sides, pcti
// exactly pct), and a stable cell (Macnamara 2019: both sides rank
// 135/151). These catch lattice drift the formula checks above are blind
// to (a lattice swap re-derives a self-consistent but wrong pct set —
// these literals must not move without a deliberate re-pinning).
const PCTI_PIN = [
  ["1993", "Corinella", "ieo", 0.29932, 0.14966, 0.251399],
  ["1993", "O'Connor", "irsd", 0.319728, 0.387755, 0.34151],
  ["1996", "Namadgi", "irsd", 0.966216, 0.912162, 0.916807],
  ["1996", "Adelaide", "ieo", 0.797297, 0.837838, 0.834354],
  ["1998", "Blair", "irsd", 0.175676, 0.243243, 0.204818],
  ["1998", "Bradfield", "ier", 1, 1, 1],
  ["2004", "Lingiari", "irsd", 0.013333, 0.006667, 0.009104],
  ["2004", "Melbourne", "ier", 0.833333, 0.113333, 0.376584],
  ["2007", "Solomon", "irsd", 0.526667, 0.726667, 0.578446],
  ["2010", "Moncrieff", "ier", 0.666667, 0.246667, 0.327816],
  ["2013", "Dawson", "irsd", 0.626667, 0.4, 0.532378],
  ["2013", "Dawson", "ier", 0.746667, 0.4, 0.60246],
  ["2016", "Gellibrand", "irsad", 0.38, 0.586667, 0.582369],
  ["2016", "McMahon", "ieo", 0.246667, 0.12, 0.122635],
  ["2019", "Solomon", "ier", 0.602649, 0.311258, 0.441243],
  ["2019", "Lingiari", "irsd", 0.006623, 0.006623, 0.006623],
  ["2019", "Macnamara", "irsd", 0.89404, 0.89404, 0.89404],
];
for (const [y, name, idx, pct0, pct1, pcti] of PCTI_PIN) {
  const icell = LATTICE[y].elections[name]?.[idx];
  const scell = store.elections[y]?.[name]?.[idx];
  if (!icell || !scell) { failures.push(`${y} ${name} ${idx}: pcti anchor absent`); continue; }
  check(icell.pct0 === pct0 && icell.pct1 === pct1 && icell.pcti === pcti,
    `${y} ${name} ${idx}: lattice ${JSON.stringify(icell)} moved off the pinned ${pct0}/${pct1}/${pcti}`);
  check(scell.pcti === pcti, `${y} ${name} ${idx}: store pcti ${scell.pcti} != pinned ${pcti}`);
}

// 15 — rank-delta band: interpolation must move the median division only a
// little (the census sides drift years apart, never contests), while real
// movement (growth suburbs, mining seats) may be large. Bands chosen from
// the green runs' medians ×3 head-room; the 2016 census sat five weeks
// after the election, so that lane's whole move is bounded tiny. The
// CD-era lanes (2004/2007/2010) run wider bands than the SA1-concordance
// lanes: whole-unit CD/SA1-to-era-polygon allocation is coarser than
// concordance weighting, and 2004 (f=0.634) / 2010 (f=0.807) lean away
// from their measured side, so honest deltas reach ~0.072 median and
// ~0.457 max (2004:ier Melbourne); 2007 (f=0.259) stays close to its
// measured side. First-era-run medians/maxes sit under these bands.
{
  const isEraLane = (y) => THREE_IDX.has(y) || y === "2004" || y === "2007" || y === "2010";
  const deltasPer = (y, idx, side) => Object.entries(LATTICE[y].elections)
    .map(([, c]) => Math.abs(c[idx].pcti - c[idx][side]));
  for (const y of INTERP_YEARS) {
    const side = MEASURED[y];
    for (const idx of (THREE_IDX.has(y) ? IDX : IDX4)) {
      const ds = deltasPer(y, idx, side).sort((a, b) => a - b);
      const median = ds[Math.floor(ds.length / 2)], max = ds[ds.length - 1];
      const medBand = y === "2016" ? 0.002 : isEraLane(y) ? 0.08 : 0.03;
      const maxBand = y === "2016" ? 0.015 : isEraLane(y) ? 0.5 : 0.25;
      check(median < medBand, `${y} ${idx}: median |pcti-${side}| ${median.toFixed(4)} outside ${medBand}`);
      check(max < maxBand, `${y} ${idx}: max |pcti-${side}| ${max.toFixed(4)} outside ${maxBand}`);
    }
  }
}

die();
console.log(`seifa: ok — ${ELECTION_SET.length} elections, ${Object.values(COUNT_FOR).reduce((a, b) => a + b, 0)} rows, fixtures invariants, pins green`);
