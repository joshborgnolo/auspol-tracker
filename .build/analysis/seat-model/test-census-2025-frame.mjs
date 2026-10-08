#!/usr/bin/env node
/* test-census-2025-frame.mjs — invariants for data/census-2021-divisions-2025.json (W1b).

   Mirrors test-census-frame.mjs (W1). Tolerances: W1's ABS-randomisation
   residuals (flat 30) plus this file's round-to-2dp (< 17 cells x 0.005),
   so internal component sums sit within TOL 35; national totals are exactly
   conserved by the weight geometry, so drift is pure rounding (~150 x 0.01).

   Run from the repo root: node .build/analysis/seat-model/test-census-2025-frame.mjs */
import { readFileSync } from "node:fs";

const F = JSON.parse(readFileSync("data/census-2021-divisions-2025.json", "utf8"));
const W1 = JSON.parse(readFileSync("data/census-2021-divisions.json", "utf8"));
const BASE = JSON.parse(readFileSync("data/seats-2025-baseline.json", "utf8"));
const divs = F.divisions;
let failures = 0;
const check = (label, ok, detail = "") => {
  if (!ok) { failures++; console.error(`FAIL ${label}${detail ? " — " + detail : ""}`); }
};

check("division count is 150", divs.length === 150, `got ${divs.length}`);
check("codes unique", new Set(divs.map((d) => d.code)).size === divs.length);
check("names unique", new Set(divs.map((d) => d.name)).size === divs.length);

const EXPECT_STATES = { NSW: 46, VIC: 38, QLD: 30, SA: 10, WA: 16, TAS: 5, NT: 2, ACT: 3 };
const states = {};
for (const d of divs) states[d.state] = (states[d.state] || 0) + 1;
check("state seat counts match the 2025 parliament",
  JSON.stringify(states) === JSON.stringify(EXPECT_STATES), JSON.stringify(states));
const STATE_DIGIT = { 1: "NSW", 2: "VIC", 3: "QLD", 4: "SA", 5: "WA", 6: "TAS", 7: "NT", 8: "ACT" };
check("every code's state digit matches its state",
  divs.every((d) => STATE_DIGIT[d.code.slice(3)[0]] === d.state));

// ABS randomisation residuals (W1 observed <=30) + this file's 2dp rounding.
const TOL = 35;
const close = (a, b) => Math.abs(a - b) <= TOL;

let persons = 0;
const national = { genderM: 0, tenureTotal: 0, incomeTotal: 0, persons15: 0, englishOnly: 0 };
const w1ByCode = new Map(W1.divisions.map((d) => [d.code, d]));
const weightOut = new Map(); // CED2021 -> total weight emitted
for (const d of divs) {
  const at = `${d.code} ${d.name}`;
  persons += d.persons;
  national.genderM += d.gender.m;
  national.tenureTotal += d.tenureDwellings.total;
  national.incomeTotal += d.incomeWeeklyPersons15.total;
  national.persons15 += d.persons15Plus;
  national.englishOnly += d.englishOnlyHome;
  const ageSum = Object.values(d.ageCounts).reduce((a, b) => a + b, 0);
  check(`age counts close to persons (${at})`, close(ageSum, d.persons), `${ageSum} vs ${d.persons}`);
  check(`gender close to persons (${at})`, close(d.gender.m + d.gender.f, d.persons),
    `${d.gender.m}+${d.gender.f} vs ${d.persons}`);
  const t = d.tenureDwellings;
  check(`tenure components close to total (${at})`,
    close(t.ownOutright + t.mortgage + t.rented + t.otherTenure + t.notStated, t.total),
    `${t.ownOutright + t.mortgage + t.rented + t.otherTenure + t.notStated} vs ${t.total}`);
  const inc = d.incomeWeeklyPersons15;
  const bandSum = Object.values(inc.bands).reduce((a, b) => a + b, 0);
  check(`income bands + not-stated close to total (${at})`, close(bandSum + inc.notStated, inc.total),
    `${bandSum}+${inc.notStated} vs ${inc.total}`);
  const e = d.education15Plus;
  check(`education counts within persons 15+ (${at})`,
    e.postgrad + e.gradDipCert + e.bachelor + e.advDiploma + e.cert34 + e.cert12 + e.nfd <= d.persons15Plus + TOL);
  check(`persons 15+ <= persons (${at})`, d.persons15Plus <= d.persons + 0.1);
  check(`income band histogram is the full 15 bands (${at})`, Object.keys(inc.bands).length === 15);
  const neg = [];
  for (const [grp, obj] of [["age", d.ageCounts], ["gender", d.gender], ["tenure", t], ["education", e], ["income", inc.bands]])
    for (const [k, v] of Object.entries(obj))
      if (!(v >= 0 && Number.isFinite(v))) neg.push(`${grp}.${k}=${v}`);
  check(`no negative counts (${at})`, neg.length === 0, neg.join(", "));
  check(`mapping flag valid (${at})`, d.mapping === "exact" || d.mapping === "mapped");

  for (const leg of d.mapFrom) {
    check(`mapFrom ratio positive (${at})`, leg.ratio > 0 && Number.isFinite(leg.ratio), `${leg.code}:${leg.ratio}`);
    weightOut.set(leg.code, (weightOut.get(leg.code) ?? 0) + leg.ratio);
    const src = w1ByCode.get(leg.code);
    check(`mapFrom source exists in W1 frame + name matches (${at}:${leg.code})`,
      !!src && src.name === leg.name, src ? `${src.name} vs ${leg.name}` : "missing");
  }

  if (d.mapping === "exact") {
    check(`exact divisions carry one ratio-1 leg (${at})`, d.mapFrom.length === 1 && d.mapFrom[0].ratio === 1,
      JSON.stringify(d.mapFrom));
    check(`exact divisions carry verbatim medians (${at})`,
      !!d.medians && d.mediansEst === undefined, "");
    const src = w1ByCode.get(d.mapFrom[0].code);
    if (src) {
      check(`exact division counts are integer (${at})`,
        [d.persons, d.persons15Plus, d.englishOnlyHome, d.gender.m, d.gender.f,
          ...Object.values(d.ageCounts), ...Object.values(d.tenureDwellings),
          ...Object.values(d.incomeWeeklyPersons15.bands), d.incomeWeeklyPersons15.notStated,
          ...Object.values(d.education15Plus)].every(Number.isInteger));
      check(`exact division persons equals W1 source (${at})`, d.persons === src.persons,
        `${d.persons} vs ${src.persons}`);
    }
  } else {
    check(`mapped divisions carry mediansEst, not medians (${at})`,
      !!d.mediansEst && d.medians === undefined, "");
    if (d.mediansEst) {
      check(`median-est age plausible (${at})`, d.mediansEst.age >= 25 && d.mediansEst.age <= 55, `${d.mediansEst.age}`);
      check(`median-est personal income plausible (${at})`,
        d.mediansEst.personalIncWeekly >= 100 && d.mediansEst.personalIncWeekly <= 2000,
        `${d.mediansEst.personalIncWeekly}`);
    }
  }
}

// Weight geometry: every 2021 source division is fully distributed.
check("every W1 division distributes exactly 100% of itself",
  [...weightOut.values()].every((w) => Math.abs(1 - w) <= 1e-6),
  [...weightOut.entries()].filter(([, w]) => Math.abs(1 - w) > 1e-6).map(([c, w]) => `${c}=${w}`).join(","));
check("all 151 W1 divisions distributed, 19 pseudo CEDs skipped",
  weightOut.size === 151 && F._meta.skippedPseudoCEDs === 19,
  `${weightOut.size} sources, ${F._meta.skippedPseudoCEDs} skipped`);

// National conservation: weights sum to 1 per source, so only 2dp rounding
// (<= 150 x 0.01) can drift totals away from W1.
const w1Persons = W1.divisions.reduce((a, d) => a + d.persons, 0);
const w1GenderM = W1.divisions.reduce((a, d) => a + d.gender.m, 0);
const w1Tenure = W1.divisions.reduce((a, d) => a + d.tenureDwellings.total, 0);
const w1Income = W1.divisions.reduce((a, d) => a + d.incomeWeeklyPersons15.total, 0);
const w1P15 = W1.divisions.reduce((a, d) => a + d.persons15Plus, 0);
const w1Eng = W1.divisions.reduce((a, d) => a + d.englishOnlyHome, 0);
for (const [label, got, want] of [
  ["persons", persons, w1Persons], ["gender.m", national.genderM, w1GenderM],
  ["tenure.total", national.tenureTotal, w1Tenure], ["income.total", national.incomeTotal, w1Income],
  ["persons15Plus", national.persons15, w1P15], ["englishOnlyHome", national.englishOnly, w1Eng],
]) check(`national ${label} conserved (rounding only)`, Math.abs(got - want) <= 2, `${got} vs ${want}`);

// The mapped 2025 divisions name-check exactly against the W3 baseline's 150 seats.
const norm = (s) => s.toLowerCase().replace(/[^a-z]/g, "");
const baseNames = new Set(BASE.seats.map((s) => norm(s.name)));
const frameNames = new Set(divs.map((d) => norm(d.name)));
check("every mapped division name appears in the 2025 baseline",
  [...frameNames].every((n) => baseNames.has(n)),
  [...frameNames].filter((n) => !baseNames.has(n)).join(","));
check("every 2025 baseline seat name appears in the mapped frame",
  [...baseNames].every((n) => frameNames.has(n)),
  [...baseNames].filter((n) => !frameNames.has(n)).join(","));

// Empirical pins: the 2025-election redistributions were NSW, VIC, WA (+ a NT
// tweak). The other four jurisdictions must be exact carries.
const EXPECT_MAPPED = { NSW: 41, VIC: 34, QLD: 0, SA: 0, WA: 16, TAS: 0, NT: 2, ACT: 0 };
const mappedCounts = {};
for (const d of divs) if (d.mapping === "mapped") mappedCounts[d.state] = (mappedCounts[d.state] || 0) + 1;
check("mapped-division counts match the 2024-25 redistributions",
  ["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"].every((s) => (mappedCounts[s] || 0) === EXPECT_MAPPED[s]),
  JSON.stringify(mappedCounts));

if (failures) { console.error(`${failures} failures`); process.exit(1); }
console.log(`census 2025 frame OK: ${divs.length} divisions, ${persons.toLocaleString()} persons, ${divs.filter((d) => d.mapping === "mapped").length} mapped`);
