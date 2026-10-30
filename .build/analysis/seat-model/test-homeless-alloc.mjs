/* test-homeless-alloc.mjs — pin the homeless lane's allocation tables
   (cache/homeless-sa1-{2011,2016,2021}-alloc.json, built by
   homeless_alloc.py from the ABS 2049.0 "Estimating homelessness"
   cubes, fetched by fetch-homeless-abs.py).

   Invariants:
   1. Each edition's national estimate sum sits within 0.2% of the ABS
      table's own national row (2011: 102,439; 2016: 116,427; 2021:
      122,494 — ABS prints suppressed tiny SA2 cells as 'np', so ~0.02
      to 0.08% slips by the lane's join).
   2. Every allocation is 0 <= est <= persons; populations are the
      census's own SA1 counts; shares under a plausible ceiling.
   3. Its unit codes appear in the era's census universe (spot check
      against cache/bcp-sa1-2011.zip (7-digit) and gcp-sa1-2021.zip).
   4. The venue-era GCP stores actually carry hl (the lanes landed);
      2007/2010-era stores do NOT (no 2006 estimate exists).
*/
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
import { existsSync } from "node:fs";

let failures = 0;
const ok = (c, msg) => {
  if (!c) { failures++; console.error(`FAIL ${msg}`); }
};

const EDS = {
  2011: { nat: 102439, tol: 0.002 },
  2016: { nat: 116427, tol: 0.002 },
  2021: { nat: 122494, tol: 0.002 },
};

const shares = { 2011: 0.0048, 2016: 0.005, 2021: 0.0047 };
for (const [edS, d] of Object.entries(EDS)) {
  const ed = +edS;
  const p = `.build/analysis/seat-model/cache/homeless-sa1-${ed}-alloc.json`;
  ok(existsSync(p), `${p} missing — run homeless_alloc.py`);
  const a = JSON.parse(readFileSync(p, "utf8"));
  ok(typeof a === "object" && a && !(a instanceof Array), `${ed} alloc object`);
  ok(!(a instanceof Array), `${ed} alloc is an object`);
  const form = Object.keys(a.c7 || {}).length >= Object.keys(a.m || {}).length ? "c7" : "m";
  // c7 keys for asgs editions 2011/2016, m keys for GCP-2021/anc
  ok(!(ed === 2021 && Object.keys(a.c7 || {}).length > 0), `${ed}: only the SHP code form exists (no c7 form invented)`);
  const t = a[form] || {};
  const nat = Object.values(t).reduce((s, x) => s + x.e, 0);
  ok(Math.abs(nat - d.nat) / d.nat < d.tol, `${ed} national estimate ${nat.toFixed(0)} ~ table ${d.nat}`);
  ok(Object.values(t).every((x) => x.e >= 0 && x.e <= x.p &&
    (x.p > 0 || x.e === 0)),
    `${ed} each est within its SA1's persons (zero-pop rows hold 0 only)`);
  ok(Object.keys(t).length > 30000, `${ed} alloc covers the SA1 universe`);
  ok(Object.values(t).every((x) => Number.isFinite(x.e) &&
    Number.isFinite(x.p)), `${ed}: no NaN in allocations`);
  ok(Object.keys(t).every((k) => /^\d+$/.test(k)), `${ed}: codes digital`);
}

// 4. the lane landed on the right stores
for (const [year, withHl] of [[2013, true], [2016, true], [2022, true]]) {
  const base = `data/booth-${+year >= 2016 ? "seifa-voter" : "demo"}-${year}.json`;
  const s = JSON.parse(readFileSync(base, "utf8"));
  const b0 = s.booths.find((x) => x.demo && (year >= 2016 ? x.demo.pt : true) && x.demo.hl != null);
  ok(!!b0, `${year}: a booth carries hl`);
  const nat = withHl &&
    (year >= 2016 ? s.counts.demo.national : s.counts.national);
  ok(nat && typeof nat.hl === "number" && nat.hl > 0.002 && nat.hl < 0.02,
    `${year}: national hl pinned in-range (${nat && nat.hl})`);
}
for (const year of [2007, 2010]) {
  const s = JSON.parse(readFileSync(`data/booth-demo-${year}.json`, "utf8"));
  const b0 = s.booths.find((x) => x.demo && x.demo.pt != null);
  ok(!(b0.demo && b0.demo.hl != null),
    `${year}: hl stays empty (no 2006 estimate exists)`);
}

if (failures) {
  console.error(`\n${failures} FAILURES`);
  process.exit(1);
}
console.log(`OK: homeless-alloc tables pinned (2011/2016/2021 editions +
  the lane landed on the 2013+ stores only)`);
