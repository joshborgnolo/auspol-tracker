/* test-booth-demo-2011.mjs — pin data/booth-demo-2007-c1.json and
   data/booth-demo-2010-c1.json (derive-booth-demo-2011.py: the
   2011-census c1 side of the 2007/2010 people-interp lanes — 2011 BCP
   of each booth's point-in-polygon 2011 SA1, whole-allocated CED-era
   division sums on seifa-src/sa1-2011-ced-{2006ed,2010set}.json).

   Invariants (universe + value pins measured 2026-10-28 on the first
   green emission):

   1. Universe: booth rows in the EXACT order of the committed
      booth-seifa-{year}.json venue stores (2007: 8235 rows, 516 pip
      misses + 65 empty SA1s; 2010: 8951, 598 + 86). 150 divisions.
   2. The cross-era identity oracle: both stores read ONE census
      universe, so their national rows equal the 2013 venue store's
      exactly (all lanes), and their incomeCuts pin its 2011 record
      bit-for-bit (loCutWeekly $738.0, hiNationalShare 0.044354).
   3. Division anchors: Lingiari identical across the two boundary
      sets (NT was never re-cut); Sydney differs (the 2010-era
      redistribution redrew it).
   4. Null longitude rule: booths whose lat/lon are absent/(0,0) or
      fall outside the polygons carry demo:null; every demo block
      carries cov 1.0, persons >= 1, shares in [0,1].
   5. The blend belongs to the MEASURED store only: c1 stores carry
      no demoI and no demoInterp keys.
   6. Provenance names the BCP zip, the 2011 SA1 shapes, the era
      allocation and the venue store.
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

const NAT13 = JSON.parse(readFileSync("data/booth-demo-2013.json",
  "utf8")).counts.national;
const CUT13 = JSON.parse(readFileSync("data/booth-demo-2013.json",
  "utf8")).incomeCuts;

const YEARS = {
  2007: { booths: 8235, miss: 516, empty: 65,
    lingiari: {
      persons: 109657, langOther: 0.4011, fborn: 0.1179,
      uni: 0.1317, blue: 0.3524, loinc: 0.1981, hiinc: 0.045,
      incMed: 1502,
    },
    sydney: {
      persons: 165285, langOther: 0.3196, fborn: 0.4673,
      uni: 0.4793, blue: 0.129, loinc: 0.2048, hiinc: 0.1183,
      incMed: 1731,
    },
    firstBooth: ["Banks", "East Hills", 489, 0.1812, 0.2363],
  },
  2010: { booths: 8951, miss: 598, empty: 86,
    lingiari: {
      persons: 109657, langOther: 0.4011, fborn: 0.1179,
      uni: 0.1317, blue: 0.3524, loinc: 0.1981, hiinc: 0.045,
      incMed: 1502,
    },
    sydney: {
      persons: 170999, langOther: 0.3277, fborn: 0.4688,
      uni: 0.4753, blue: 0.1315, loinc: 0.2036, hiinc: 0.1166,
      incMed: 1730,
    },
    firstBooth: ["Banks", "Riverwood East", 258, 0.5862, 0.4756],
  },
};

for (const [yearS, y] of Object.entries(YEARS)) {
  const year = +yearS;
  const d = JSON.parse(readFileSync(`data/booth-demo-${year}-c1.json`,
    "utf8"));
  eq([d.election, d.censusEdition, d.counts.divisions,
    d.counts.sa1Bcp, d.counts.sa1Alloc],
    [year, 2011, 150, 54805, 54772], `${year} store header pins`);
  const c = d.counts;
  eq([c.booths, c.boothsPipMiss, c.boothsPipEmpty],
    [y.booths, y.miss, y.empty], `${year} pip profile`);
  eq(c.boothsPip, y.booths - y.miss - y.empty, `${year} pip rows`);

  // 1. booth order == the venue store's
  const v = JSON.parse(readFileSync(`data/booth-seifa-${year}.json`,
    "utf8"));
  eq(d.booths.map((b) => `${b.div}|${b.boothId}`),
    v.booths.map((b) => `${b.div}|${b.boothId}`), `${year} booth order`);

  // 2. cross-era identity: one census universe
  eq(c.national, NAT13, `${year} national == 2013 oracle`);
  eq([d.incomeCuts.loCutWeekly, d.incomeCuts.hiNationalShare,
    d.incomeCuts.dollarsYear],
    [CUT13.loCutWeekly, CUT13.hiNationalShare, CUT13.dollarsYear],
    `${year} incomeCuts == 2013 store`);
  eq(d.incomeCuts.loCutWeekly, 738, `${year} cut $738 (2011 $)`);

  // 3. anchors
  const divs = new Map(d.divisions.map((x) => [x.div, x]));
  const L = divs.get("Lingiari");
  eq(["langOther", "fborn", "uni", "blue", "loinc", "hiinc", "incMed",
    "persons"].map((k) => L[k]),
    [y.lingiari.langOther, y.lingiari.fborn, y.lingiari.uni,
      y.lingiari.blue, y.lingiari.loinc, y.lingiari.hiinc,
      y.lingiari.incMed, y.lingiari.persons],
    `${year} Lingiari row`);
  const S = divs.get("Sydney");
  eq([S.persons, S.fborn, S.uni, S.hiinc],
    [y.sydney.persons, y.sydney.fborn, y.sydney.uni, y.sydney.hiinc],
    `${year} Sydney row`);

  // 4. shapes + null rule
  let badShare = 0, badCov = 0;
  for (const b of d.booths) {
    if (b.demo === null) continue;
    if (b.demo.cov !== 1 || !(b.demo.persons >= 1)) badCov++;
    for (const k of ["langOther", "fborn", "uni", "blue", "loinc",
      "hiinc"]) {
      const x = b.demo[k];
      if (x != null && !(x >= 0 && x <= 1)) badShare++;
    }
  }
  ok(!badCov && !badShare,
    `${year} demo blocks well-formed (${badCov} cov, ${badShare} share)`);
  const [bDiv, bName, bPers, bLang, bBlue] = y.firstBooth;
  const fb = d.booths.find((b) => b.demo && b.div === bDiv
    && b.booth === bName);
  eq(fb && [fb.demo.persons, fb.demo.langOther, fb.demo.blue],
    [bPers, bLang, bBlue], `${year} booth anchor ${bName}`);

  // 5. the blend lives in the measured store, never the c1 store
  ok(!("demoInterp" in d) && !("incomeCutsI" in d),
    `${year} c1 store carries no interp keys`);
  ok(d.booths.every((b) => !("demoI" in b)),
    `${year} c1 booths carry no demoI`);

  // 6. provenance
  const fl = d._provenance.files;
  ok(Object.keys(fl).some((k) => k.endsWith("bcp-sa1-2011.zip")),
    `${year} prov bcp`);
  ok(Object.keys(fl).some((k) => k.includes("sa1_2011")),
    `${year} prov shapes`);
  ok(Object.keys(fl).some((k) => k.includes("sa1-2011-ced")),
    `${year} prov alloc`);
  ok(Object.keys(fl).some((k) =>
    k.endsWith(`data/booth-seifa-${year}.json`)), `${year} prov venue`);
}

// 3b. Lingiari identical across the two era maps; Sydney must differ
{
  const L7 = JSON.parse(readFileSync("data/booth-demo-2007-c1.json",
    "utf8")).divisions.find((x) => x.div === "Lingiari");
  const L0 = JSON.parse(readFileSync("data/booth-demo-2010-c1.json",
    "utf8")).divisions.find((x) => x.div === "Lingiari");
  eq(L7, L0, "Lingiari c1 identical across eras (unchanged boundary)");
  const S7 = JSON.parse(readFileSync("data/booth-demo-2007-c1.json",
    "utf8")).divisions.find((x) => x.div === "Sydney");
  const S0 = JSON.parse(readFileSync("data/booth-demo-2010-c1.json",
    "utf8")).divisions.find((x) => x.div === "Sydney");
  ok(JSON.stringify(S7) !== JSON.stringify(S0),
    "Sydney c1 differs across eras (redistributed)");
}

if (failures) {
  console.error(`\n${failures} FAILURES`);
  process.exit(1);
}
console.log("OK: data/booth-demo-2007-c1.json + data/booth-demo-2010-c1.json pinned");
