#!/usr/bin/env node
/* test-booth-demo-90s.mjs — pin data/booth-demo-{1993,1996,1998}{,-c1}.json
   (derive-booth-demo-90s.py's six-store contract, the '90s census-people
   arc extended by the map-people-fill arc with the follow-on cob/rel/
   ten/atsci/onepar cohorts). Invariants per store:

   * store-top lane menus follow the census print's own era set —
     1991-census sides ride the seven-key birthplace menu without
     India/Sri Lanka (its print never names them), 1996/2001-era sides
     the era's nine; relKeys leads No-religion over ten options, tenKeys
     the four housing-tenure options;
   * cohort shapes at booth/division/national: cob/rel/ten dicts if and
     only if the demo core is non-null, null-era holes end to end (hind
     is null at every level on the 1991-census side, rentPub null on the
     1996-census dwelling-table side); y12less stays a null key
     (the year-of-schooling question has no era edition until 2006);
   * shares bounded and cohort-consistent within one store: each level
     slot's figure车子 in [0, 1] when present, divisions' every lane
     sums the era aggregations (national shares at counts.national);
   * the demoI interpolant crouches on the null-rule: rentPub belongs
     nowhere to any '90s frame's filmography before the measured-side
     doctrine (null at every census side before 2001's own);
   * literal anchors of the green-run recorded 2026-10-31 (the AUBIN-
     bcp-1866 epoch products and their AURIN reads);
*/

import { readFileSync } from "node:fs";

const R = (p) => JSON.parse(readFileSync(p, "utf8"));

let failures = [];
const check = (ok, msg) => { if (!ok) failures.push(msg); };

const COB91 = ["uk", "chn", "nzl", "phl", "vnm", "zaf", "ita"];
const COB96 = ["uk", "ind", "chn", "nzl", "phl", "vnm", "zaf", "ita", "lka"];
const REL_KEYS = ["norel", "cath", "angl", "unch", "pres", "orth",
                  "budd", "isl", "hind", "jew"];
const TEN_KEYS = ["mort", "rent", "own", "rentPub"];

const STORES = [
  { f: "booth-demo-1993.json", census: 1991, booths: 8431, divs: 147,
    cobKeys: COB91, nat: { norel: 0.1437, uk: 0.0678, rentPub: 0.0563,
                           atsci: 0.0163, onepar: 0.1285 } },
  { f: "booth-demo-1993-c1.json", census: 1996, booths: 8431, divs: 147,
    cobKeys: COB96, nat: { norel: 0.182 } },
  { f: "booth-demo-1996.json", census: 1991, booths: 8463, divs: 148,
    cobKeys: COB91, nat: { norel: 0.1437 } },
  { f: "booth-demo-1996-c1.json", census: 1996, booths: 8463, divs: 148,
    cobKeys: COB96, nat: { norel: 0.182 } },
  { f: "booth-demo-1998.json", census: 1996, booths: 8311, divs: 148,
    cobKeys: COB96, nat: { norel: 0.182 } },
  { f: "booth-demo-1998-c1.json", census: 2001, booths: 8311, divs: 148,
    cobKeys: COB96, nat: { norel: 0.1716, rentPub: 0.0472 } },
];

const bIn = (v) => v == null || (typeof v === "number" && v >= 0 && v <= 1);

for (const spec of STORES) {
  const d = R(`data/${spec.f}`);
  const tag = spec.f.replace("booth-demo-", "").replace(".json", "");
  check(d.election && [1993, 1996, 1998].includes(d.election),
        `${tag}: election ${d.election}`);
  check(d.censusEdition === spec.census, `${tag}: census ${d.censusEdition}`);
  check(JSON.stringify(d.cobKeys) === JSON.stringify(spec.cobKeys),
        `${tag}: cobKeys menu ${JSON.stringify(d.cobKeys)}`);
  check(JSON.stringify(d.relKeys) === JSON.stringify(REL_KEYS),
        `${tag}: relKeys follows the cross-era set`);
  check(JSON.stringify(d.tenKeys) === JSON.stringify(TEN_KEYS),
        `${tag}: tenKeys follows the cross-era set`);
  check(d.booths.length === spec.booths, `${tag}: booth registry ${d.booths.length} != ${spec.booths}`);
  check(d.divisions.length === spec.divs, `${tag}: divisions ${d.divisions.length} != ${spec.divs}`);

  const national = d.counts.national;
  check(national && national.cob && national.rel && national.ten,
        `${tag}: national cohort dicts at counts.national`);
  check(national.y12less === undefined, `${tag}: no year-of-schooling lane on the '90s frame`);
  const nd = (k) => national[k];
  if (spec.nat.norel != null) {
    check(Math.abs(national.rel.norel - spec.nat.norel) < 0.0005,
          `${tag}: national norel ${national.rel.norel} != ${spec.nat.norel}`);
  }
  if (spec.nat.uk != null && national.cob && national.cob.uk != null) {
    check(Math.abs(national.cob.uk - spec.nat.uk) < 0.0005,
          `${tag}: national uk ${national.cob.uk} != ${spec.nat.uk}`);
  }
  if (spec.nat.atsci != null && national.atsci != null) {
    check(Math.abs(national.atsci - spec.nat.atsci) < 0.0005,
          `${tag}: national atsci ${national.atsci} != ${spec.nat.atsci}`);
  }
  if (spec.nat.onepar != null && national.onepar != null) {
    check(Math.abs(national.onepar - spec.nat.onepar) < 0.0005,
          `${tag}: national onepar ${national.onepar} != ${spec.nat.onepar}`);
  }
  if (spec.nat.rentPub != null && national.ten && national.ten.rentPub != null) {
    check(Math.abs(national.ten.rentPub - spec.nat.rentPub) < 0.0005,
          `${tag}: national rentPub ${national.ten.rentPub} != ${spec.nat.rentPub}`);
  }
  check(national.rel.hind != null || spec.census === 1991,
        `${tag}: only the 1991-census sides keep hind null (got ${national.rel.hind})`);
  if (spec.census === 1991) check(national.rel.hind == null, `${tag}: hind null on the '91 print`);
  if (spec.census === 1996) check(national.ten.rentPub == null, `${tag}: rentPub null on the '96 print (the BCP has no landlord arm)`);
  if (spec.census === 2001) check(national.ten.rentPub != null && national.ten.rentPub > 0,
        `${tag}: 2001's landlord table prints rentPub`);

  // per-row shape audit: every cohort dict rides with a non-null demo core
  let withDemo = 0, withCob = 0, withRel = 0, withTen = 0;
  for (const b of d.booths) {
    if (b.demo == null) {
      check(b.demoI == null || typeof b.demoI !== "object", `${tag}: no interp block without a demo core`);
      continue;
    }
    withDemo++;
    const dm = b.demo;
    if (spec.census === 1991) check(dm.rel && dm.rel.hind == null, `${tag} booth: hind null in the '91-era dicts`);
    if (spec.census === 1996) check(dm.ten && dm.ten.rentPub == null, `${tag} booth: rentPub null in the '96-era dicts`);
    const co = dm.cob;
    if (co && typeof co === "object") {
      withCob++;
      check(Object.keys(co).sort().every((k) => (spec.cobKeys).includes(k)),
            `${tag} booth: cob dict keys ride the census menu`);
      Object.values(co).forEach((v) => check(bIn(v), `${tag} booth: cob slot bounded ${v}`));
    }
    const rl = dm.rel;
    if (rl && typeof rl === "object") {
      withRel++;
      Object.entries(rl).forEach(([k, v]) => {
        check(REL_KEYS.includes(k), `${tag} booth: rel slot ${k} in menu`);
        check(bIn(v), `${tag} booth: rel slot bounded ${k}=${v}`);
      });
    }
    const tn = dm.ten;
    if (tn && typeof tn === "object") {
      withTen++;
      Object.entries(tn).forEach(([k, v]) => {
        check(TEN_KEYS.includes(k), `${tag} booth: ten slot ${k} in menu`);
        check(bIn(v) || v === 0, `${tag} booth: ten slot bounded`);
      });
    }
    check(dm.atsci == null || (dm.atsci >= 0 && dm.atsci <= 1),
          `${tag} booth: atsci bounded`);
    check(dm.onepar == null || (dm.onepar >= 0 && dm.onepar <= 1),
          `${tag} booth: onepar bounded`);
  }
  const cover = withDemo / spec.booths;
  check(cover > 0.7, `${tag}: demo coverage ${(cover * 100).toFixed(1)}% below 70%`);
  check(Math.abs(withCob - withDemo) < 0.05 * spec.booths,
        `${tag}: cohort coverage ${withCob} near demo core ${withDemo}`);

  // divisional shapes
  for (const dv of d.divisions) {
    if (spec.census === 1991) check(dv.rel && dv.rel.hind == null, `${tag} div ${dv.div}: hind null on the '91 print`);
    if (spec.census === 1996) check(dv.ten && dv.ten.rentPub == null, `${tag} div ${dv.div}: rentPub null on the '96 print`);
    check(dv.atsci != null && dv.atsci >= 0 && dv.atsci <= 1, `${tag} div ${dv.div}: atsci bounded ${dv.atsci}`);
    check(dv.onepar != null && dv.onepar >= 0 && dv.onepar <= 1, `${tag} div ${dv.div}: onepar bounded ${dv.onepar}`);
  }

  // the demoI-era null rule on interp cohorts
  const dv0 = d.divisions.find((x) => x.demoI);
  if (dv0) {
    check(dv0.demoI.cob === undefined, `${tag}: demoI carries no cob (the lineage doctrine)`);
    check(dv0.demoI.ten && dv0.demoI.ten.rentPub == null,
          `${tag}: demoI's rentPub null on any '90s frame (the far side can't rescue the print hole)`);
    if (spec.census === 1991)
      check(dv0.demoI.rel && dv0.demoI.rel.hind == null,
            `${tag}: demoI's hind null through the '91 shows`);
  }
}

if (failures.length) {
  for (const f of failures.slice(0, 30)) console.error("  FAIL", f);
  console.error(`${failures.length} failures`);
  process.exit(1);
}
console.log(`booth-demo-90s: ok — ${STORES.length} stores on the extended '90s census-people arc, menus + shapes + era holes green`);
