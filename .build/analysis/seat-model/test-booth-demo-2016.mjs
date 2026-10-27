/* test-booth-demo-2016.mjs — pin data/booth-demo-2013-c1.json
   (derive-booth-demo-2016.py: the 2016-census c1 side of the 2013
   people-interp lane — 2016 GCP counts of each booth's
   point-in-polygon 2016 SA1, CG-plurality division membership onto
   the measured store's own CED_2011 map).

   Invariants (universe + value pins measured 2026-10-28 on the first
   green emission; the script's guards re-derive them):

   1. Universe: 9146 booth rows in the venue store's exact order; 579
      pip misses + 92 empty SA1s; 150 divisions; sa1Gcp 57,523 (the
      full Ed2 universe); sa1Alloc 57,249 placed (the 33 no-spatial
      pseudo SA1s division-less by design, 274 pseudo-sourced SA1s
      following them).
   2. National row: exact pins — persons 23,310,689 against the GCP's
      own AUST total 23,401,461 after the division-less classes drop;
      incMed 1447 beside ABS's published 2016 national median weekly
      household income $1,438 (the script's ±$14 guard).
   3. incomeCuts: loCutWeekly $895.80 in 2016 dollars (2011 was $738,
      2021 ~$1,079), top-band adults share 0.09093, hiEdge 4000.
   4. Division anchors: Lingiari and Sydney rows printed. The
      division NAME set must equal the measured 2013 store's.
   5. Booth order == the measured store's; demo blocks well-formed
      (cov 1.0, persons >= 1, shares in [0,1]); null longitude rule.
   6. The c1 store carries no interp keys of its own; provenance
      names the GCP zip, 2016 shapes, CG xlsx, CED csv, venue store.
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

const d = JSON.parse(readFileSync("data/booth-demo-2013-c1.json",
  "utf8"));
const meas = JSON.parse(readFileSync("data/booth-demo-2013.json",
  "utf8"));

eq([d.election, d.censusEdition], [2013, 2016], "store header");
const c = d.counts;
eq([c.booths, c.boothsPipMiss, c.boothsPipEmpty, c.divisions,
  c.sa1Gcp, c.sa1Alloc], [9146, 579, 92, 150, 57523, 57249],
  "universe pins");
eq(c.national, {
  persons: 23310689, langOther: 0.2222, fborn: 0.2827, uni: 0.2426,
  blue: 0.2913, age0_14: 0.1867, age65ov: 0.1571, loinc: 0.2523,
  hiinc: 0.0911, incMed: 1447,
}, "national row (2016 census)");
eq([d.incomeCuts.loCutWeekly, d.incomeCuts.hiNationalShare,
  d.incomeCuts.dollarsYear, d.incomeCuts.hiEdgeWeekly],
  [895.8, 0.09093, 2016, 4000], "incomeCuts (2016 dollars)");

eq(d.booths.map((b) => `${b.div}|${b.boothId}`),
  meas.booths.map((b) => `${b.div}|${b.boothId}`), "booth order");

const divs = new Map(d.divisions.map((x) => [x.div, x]));
eq(new Set(d.divisions.map((x) => x.div)),
  new Set(meas.divisions.map((x) => x.div)),
  "division set == measured store's");
{
  const L = divs.get("Lingiari");
  eq([L.persons, L.langOther, L.fborn, L.uni, L.blue, L.loinc,
    L.hiinc, L.incMed],
    [113464, 0.4291, 0.1368, 0.1436, 0.3291, 0.2055, 0.0978, 1738],
    "Lingiari row (2016 census)");
  const S = divs.get("Sydney");
  eq([S.persons, S.langOther, S.fborn, S.uni, S.blue, S.loinc,
    S.hiinc, S.incMed],
    [207562, 0.3968, 0.5268, 0.5108, 0.1334, 0.2039, 0.2015, 2015],
    "Sydney row (2016 census)");
}

let badShare = 0, badCov = 0, nullDemo = 0;
for (const b of d.booths) {
  if (b.demo === null) {
    nullDemo++;
    continue;
  }
  if (b.demo.cov !== 1 || !(b.demo.persons >= 1)) badCov++;
  for (const k of ["langOther", "fborn", "uni", "blue", "loinc",
    "hiinc"]) {
    const x = b.demo[k];
    if (x != null && !(x >= 0 && x <= 1)) badShare++;
  }
}
eq(nullDemo, c.boothsPipMiss + c.boothsPipEmpty,
  "demo-null rows == pip misses + empties");
ok(!badCov && !badShare,
  `demo blocks well-formed (${badCov} cov, ${badShare} share)`);

ok(!("demoInterp" in d) && !("incomeCutsI" in d),
  "c1 store carries no interp keys");
const fl = d._provenance.files;
ok(Object.keys(fl).some((k) => k.endsWith("gcp-sa1-2016.zip")),
  "prov gcp");
ok(Object.keys(fl).some((k) => k.includes("sa1_2016")), "prov shapes");
ok(Object.keys(fl).some((k) => k.includes("CG_SA1_2011_SA1_2016")),
  "prov cg");
ok(Object.keys(fl).some((k) => k.includes("ced_2011")), "prov ced");
ok(Object.keys(fl).some((k) => k.endsWith("data/booth-seifa-2013.json")),
  "prov venue");

if (failures) {
  console.error(`\n${failures} FAILURES`);
  process.exit(1);
}
console.log("OK: data/booth-demo-2013-c1.json pinned");
