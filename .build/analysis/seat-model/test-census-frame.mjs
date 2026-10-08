#!/usr/bin/env node
/* test-census-frame.mjs — invariants for data/census-2021-divisions.json (W1).
   Run from the repo root: node .build/analysis/seat-model/test-census-frame.mjs */
import { readFileSync } from "node:fs";

const F = JSON.parse(readFileSync("data/census-2021-divisions.json", "utf8"));
const divs = F.divisions;
let failures = 0;
const check = (label, ok, detail = "") => {
  if (!ok) { failures++; console.error(`FAIL ${label}${detail ? " — " + detail : ""}`); }
};

check("division count is 151", divs.length === 151, `got ${divs.length}`);
check("codes unique", new Set(divs.map((d) => d.code)).size === divs.length);
check("names unique", new Set(divs.map((d) => d.name)).size === divs.length);

const EXPECT_STATES = { NSW: 47, VIC: 39, QLD: 30, SA: 10, WA: 15, TAS: 5, NT: 2, ACT: 3 };
const states = {};
for (const d of divs) states[d.state] = (states[d.state] || 0) + 1;
check("state seat counts match the 2022 election",
  JSON.stringify(states) === JSON.stringify(EXPECT_STATES),
  JSON.stringify(states));

// ABS randomises census cells — component sums carry residuals against
// ABS-published totals (observed: ≤8 for gender, ≤15 tenure, ≤26 for the
// 17-cell income histogram). Tolerance 30 is far below any column misread.
const TOL = 30;
const close = (a, b) => Math.abs(a - b) <= TOL;

let national = 0;
for (const d of divs) {
  const at = `${d.code} ${d.name}`;
  national += d.persons;
  const ageSum = Object.values(d.ageCounts).reduce((a, b) => a + b, 0);
  check(`age counts sum to persons (${at})`, close(ageSum, d.persons), `${ageSum} vs ${d.persons}`);
  check(`gender sums to persons (${at})`, close(d.gender.m + d.gender.f, d.persons),
    `${d.gender.m}+${d.gender.f} vs ${d.persons}`);
  const t = d.tenureDwellings;
  check(`tenure components sum to total (${at})`,
    close(t.ownOutright + t.mortgage + t.rented + t.otherTenure + t.notStated, t.total),
    `${t.ownOutright + t.mortgage + t.rented + t.otherTenure + t.notStated} vs ${t.total}`);
  const inc = d.incomeWeeklyPersons15;
  const bandSum = Object.values(inc.bands).reduce((a, b) => a + b, 0);
  check(`income bands + not-stated sum to total (${at})`, close(bandSum + inc.notStated, inc.total),
    `${bandSum}+${inc.notStated} vs ${inc.total}`);
  const e = d.education15Plus;
  check(`education counts within persons 15+ (${at})`,
    e.postgrad + e.gradDipCert + e.bachelor + e.advDiploma + e.cert34 + e.cert12 + e.nfd <= d.persons15Plus);
  check(`persons 15+ <= persons (${at})`, d.persons15Plus <= d.persons);
  check(`income band histogram is the full 15 bands (${at})`, Object.keys(inc.bands).length === 15,
    Object.keys(inc.bands).join("|"));
  const neg = [];
  for (const [grp, obj] of [["age", d.ageCounts], ["gender", d.gender], ["tenure", t], ["education", e], ["income", inc.bands]])
    for (const [k, v] of Object.entries(obj))
      if (!(v >= 0 && Number.isFinite(v))) neg.push(`${grp}.${k}=${v}`);
  check(`no negative counts (${at})`, neg.length === 0, neg.join(", "));
}
check("national persons in plausible census band", national > 22_000_000 && national < 27_000_000, `${national}`);

/* Name cross-check against the repo's own 2022-election record (the atlas
   source CSV): all 151 census divisions by normalised name. Atlas 2022 rows
   style the five post-2016 redistribution renames "Name (fmr Old)"; strip. */
const atlas = readFileSync("atlas/data/all_elections_2PP_by_division.csv", "utf8").trim().split(/\r?\n/).slice(1)
  .filter((l) => l.split(",")[6] === "2022");
const norm = (s) => s.toLowerCase().replace(/[^a-z]/g, "");
const atlasSet = new Set(atlas.map((l) => norm(l.split(",")[0].replace(/\s*\(fmr [^)]*\)/, ""))));
const missing = divs.filter((d) => !atlasSet.has(norm(d.name)));
check("every census division name appears in atlas 2022 rows", missing.length === 0,
  missing.map((d) => d.name).join(", ") || "");
check("atlas 2022 row count is 151", atlas.length === 151, `got ${atlas.length}`);

if (failures) { console.error(`${failures} failures`); process.exit(1); }
console.log(`census frame OK: ${divs.length} divisions, ${national.toLocaleString()} persons`);
