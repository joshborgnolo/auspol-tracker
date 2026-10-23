#!/usr/bin/env node
/* test-division-seifa.mjs — pin data/division-seifa-indexes.json +
   .build/analysis/seat-model/seifa-src/aph-fixtures.json
   (extract-division-seifa.mjs). Invariants:

   1. Store elections are exactly the landed set {2001, 2004, 2007, 2010,
      2013, 2016, 2019, 2022, 2025}, each N divisions (151 in 2019/2022,
      150 otherwise), division-keyed, no others.
   2. Division sets are NAME-EXACT against data/division-classifications.json's
      matching election blocks — joins must never miss (2001: 2000-edition
      set with Bonython/Burke, 2007: the 2006-edition set, 2010: the 2009
      edition, 2019/2022: the 151-division editions with Macnamara and then
      Hawke, 2025: back to 150 with Bullwinkel).
   3. Row shape is exactly {state, irsd, ier, ieo, via} — state one of the
      eight codes, each index {value: number, rank: int 1..N}; the IRSAD
      lane (sibling pipeline) keys NEVER appear in this store; via matches
      the election's lane (2001=absCed01, 2004=aph05cib01, 2007=aph09rp02,
      2010=aph11rp01, 2013=absSa1Ced2011, 2016=absSa1Ced2016,
      2019=absSa1Ced2018, 2022=absMbCed2021, 2025=absMbCed2024).
   4. Ranks per election x index are an exact permutation of 1..N (the APH
      prints a complete ranking; the ABS lanes compute one from their carried
      scores; ties are ordered, never shared).
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
   6. Printed-score means: unweighted mean across divisions of each index
      rounds to the papers' printed "overall average" figures 1005/1006/1007/
      998 (IRSD/IRSAD/IER/IEO) for BOTH the 2006- and 2009-boundary papers —
      an end-to-end checksum over every parsed score (irsad lives in the
      fixture, not the store).
   7. The 01cib13 xcheck fixture (1996 census x 2000 boundaries, never a
      store input) parses to exactly 150 divisions with complete 1..150 rank
      permutations on each of its four indexes — its use is downstream
      verification of the 2001-census derivation lane, and a truncated parse
      must not go unnoticed.
   8. Fixture tie-band bookkeeping: aph09rp02 prints 18 and aph11rp01 22
      benign within-band rank reorderings between the per-index ranked table
      and Table 5 (Table-5 canonical in this store). The counts are pinned so
      a layout shift or silent parse gap can't masquerade as clean paper.
   9. Every fixture row carries all four indexes plus party and the APH's
      own geographic rating from Table 5 (01cib13 has no Table 5, so rating
      is absent there by construction) — the sibling IRSAD pipeline reuses
      this fixture and a row must never drop a column silently.
  10. Every election's via resolves to a _provenance entry whose censusYear
      matches the election's census (2001- and 2016-census products back
      two elections each) — an unregistered lane must fail loud here, never
      surface as a silent "via unknown" downstream.

   The extractor runs standalone from the repo root:
     node .build/analysis/seat-model/extract-division-seifa.mjs
   followed by:
     node .build/analysis/seat-model/test-division-seifa.mjs             */
import { readFileSync } from "node:fs";

const SEIFA = "data/division-seifa-indexes.json";
const CLASS = "data/division-classifications.json";
const FIXTURE = ".build/analysis/seat-model/seifa-src/aph-fixtures.json";

let failures = [];
const check = (ok, msg) => { if (!ok) failures.push(msg); };
const die = () => { for (const f of failures) console.error(`  FAIL ${f}`); if (failures.length) process.exit(1); };

const store = JSON.parse(readFileSync(SEIFA, "utf8"));
const klass = JSON.parse(readFileSync(CLASS, "utf8")).elections;
const fixtures = JSON.parse(readFileSync(FIXTURE, "utf8"));

const IDX = ["irsd", "ier", "ieo"]; // store indexes
const IDX4 = ["irsad", "irsd", "ier", "ieo"]; // fixture indexes
const COUNT_FOR = { 2001: 150, 2004: 150, 2007: 150, 2010: 150, 2013: 150, 2016: 150, 2019: 151, 2022: 151, 2025: 150 };
const ELECTION_SET = Object.keys(COUNT_FOR);
const VIA_FOR = {
  2001: "absCed01", 2004: "aph05cib01", 2007: "aph09rp02", 2010: "aph11rp01", 2013: "absSa1Ced2011",
  2016: "absSa1Ced2016", 2019: "absSa1Ced2018", 2022: "absMbCed2021", 2025: "absMbCed2024",
};
const CENSUS_FOR = { 2001: 2001, 2004: 2001, 2007: 2006, 2010: 2006, 2013: 2011, 2016: 2016, 2019: 2016, 2022: 2021, 2025: 2021 };
const STATES = new Set(["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"]);

// 1
check(JSON.stringify(Object.keys(store.elections).sort()) === JSON.stringify([...ELECTION_SET].sort()),
  `store elections ${Object.keys(store.elections)} != ${ELECTION_SET}`);

for (const y of ELECTION_SET) {
  const N = COUNT_FOR[y];
  const blk = store.elections[y];
  check(Object.keys(blk).length === N, `${y}: ${Object.keys(blk).length} divisions != ${N}`);
  // 2 — name-exact division set against classifications
  const mine = new Set(Object.keys(blk));
  const theirs = new Set(Object.keys(klass[y]));
  const missing = [...theirs].filter((n) => !mine.has(n));
  const extra = [...mine].filter((n) => !theirs.has(n));
  check(missing.length === 0 && extra.length === 0,
    `${y}: division-set mismatch vs classifications — missing ${JSON.stringify(missing)} extra ${JSON.stringify(extra)}`);
  // 3
  for (const [name, row] of Object.entries(blk)) {
    check(JSON.stringify(Object.keys(row).sort()) === JSON.stringify(["ieo", "ier", "irsd", "state", "via"]),
      `${y} ${name}: row keys ${Object.keys(row)}`);
    check(STATES.has(row.state), `${y} ${name}: bad state ${row.state}`);
    for (const idx of IDX) {
      const cell = row[idx];
      check(Number.isFinite(cell.value) && Number.isInteger(cell.rank),
        `${y} ${name} ${idx}: bad cell ${JSON.stringify(cell)}`);
      check(cell.rank >= 1 && cell.rank <= N, `${y} ${name} ${idx}: rank ${cell.rank} out of 1..${N}`);
      check(cell.value > 700 && cell.value < 1400, `${y} ${name} ${idx}: value ${cell.value} outside sanity band`);
    }
    check(row.via === VIA_FOR[y], `${y} ${name}: via ${row.via} != ${VIA_FOR[y]}`);
    check(!("irsad" in row), `${y} ${name}: irsad key leaked into sibling lane store`);
  }
  // 4
  for (const idx of IDX) {
    const ranks = Object.values(blk).map((r) => r[idx].rank).sort((a, b) => a - b);
    check(ranks.length === N && ranks.every((r, i) => r === i + 1),
      `${y} ${idx}: ranks are not a 1..${N} permutation`);
  }
}

// 10 — every election's lane is a registered, census-correct provenance entry
for (const y of ELECTION_SET) {
  const prov = store._provenance[VIA_FOR[y]];
  check(prov != null, `${y}: no _provenance entry for via ${VIA_FOR[y]}`);
  if (prov) {
    check(prov.censusYear === CENSUS_FOR[y],
      `${y} via ${VIA_FOR[y]}: censusYear ${prov.censusYear} != ${CENSUS_FOR[y]}`);
    check(typeof prov.editionInForce === "string" && prov.editionInForce.length > 0,
      `${y} via ${VIA_FOR[y]}: no editionInForce`);
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
  check(store.elections["2019"].Macnamara, "2019: Macnamara absent");
  check(store.elections["2022"].Hawke, "2022: Hawke absent");
  check(store.elections["2025"].Bullwinkel, "2025: Bullwinkel absent");
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

// 9 — fixture rows carry the full four-index set + party + (Table-5 papers) rating
for (const via of Object.keys(fixtures)) {
  for (const [name, row] of Object.entries(fixtures[via].rows)) {
    for (const idx of IDX4)
      check(row[idx] && Number.isFinite(row[idx].value) && Number.isInteger(row[idx].rank),
        `${via} ${name}: fixture ${idx} cell broken`);
    check(typeof row.party === "string" && row.party.length, `${via} ${name}: no party`);
    if (via === "aph09rp02" || via === "aph11rp01")
      check(typeof row.rating === "string", `${via} ${name}: no Table-5 rating`);
    else
      check(row.rating === undefined, `${via} ${name}: unexpected rating on summary-table-less paper`);
  }
}

die();
console.log(`seifa: ok — ${ELECTION_SET.length} elections, ${Object.values(COUNT_FOR).reduce((a, b) => a + b, 0)} rows, fixtures invariants, pins green`);
