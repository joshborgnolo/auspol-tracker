#!/usr/bin/env node
/* test-candidate-set.mjs — W6 invariant: data/seat-candidate-set-2028.json
   must stay faithful to the measured 2025 base (W2/W3 files) and to the
   hand overlay's declared changes — nothing else may differ.

   Run from the repo root: node .build/analysis/seat-model/test-candidate-set.mjs */
import { readFileSync } from "node:fs";

const SET = JSON.parse(readFileSync("data/seat-candidate-set-2028.json", "utf8"));
const BASE = JSON.parse(readFileSync("data/seats-2025-baseline.json", "utf8"));
const FLOWS = JSON.parse(readFileSync("data/aec-2025-seat-flows.json", "utf8"));
const OVERLAY = JSON.parse(readFileSync(".build/analysis/seat-model/candidate-overlay-2028.json", "utf8"));

let failures = 0;
const check = (label, ok, detail = "") => {
  if (!ok) { failures++; console.error(`FAIL ${label}${detail ? " — " + detail : ""}`); }
};

const baseBy = new Map(BASE.seats.map((s) => [s.name, s]));
const flowsBy = new Map(FLOWS.seats.map((s) => [s.name, s]));

check("150 seats", SET.seats.length === 150, `got ${SET.seats.length}`);
check("seat names unique", new Set(SET.seats.map((s) => s.name)).size === 150);
check("every candidate-set seat is a baseline seat", SET.seats.every((s) => baseBy.has(s.name)));
check("every baseline seat is in the candidate set", BASE.seats.every((s) => SET.seats.find((x) => x.name === s.name)));

const RETIRED = new Set((OVERLAY.retirements ?? []).map((e) => e.seat));
const CHALLENGES = new Map();
for (const c of OVERLAY.independents?.challenges ?? [])
  CHALLENGES.set(c.seat, [...(CHALLENGES.get(c.seat) ?? []), c.name]);

let indHeld = 0, onMod = 0;
const COAL = ["lp", "lnp", "np", "clp"];
for (const s of SET.seats) {
  const at = s.name;
  const b = baseBy.get(s.name), f = flowsBy.get(s.name);
  if (!b || !f) continue;

  // Incumbent is the baseline member; recontests flips only via the overlay.
  check(`incumbent matches baseline member (${at})`, s.incumbent.name === b.member.name,
    `${s.incumbent.name} vs ${b.member.name}`);
  check(`incumbent group matches baseline (${at})`, s.incumbent.group === b.member.group);
  check(`recontests matches overlay retirements (${at})`, s.incumbent.recontests === !RETIRED.has(s.name));

  // Contest set: 2028 values default to 2025 facts under the assumptions.
  const groups2025 = new Set(f.candidates.map((c) => c.group));
  const coal2025 = COAL.filter((g) => groups2025.has(g));
  check(`coalition mix matches 2025 DoP (${at})`,
    JSON.stringify(s.contest.coalition) === JSON.stringify(coal2025),
    `${s.contest.coalition} vs ${coal2025}`);
  check(`basis2025.on matches 2025 DoP (${at})`, s.basis2025.on === groups2025.has("on"));
  check(`basis2025.grn matches 2025 DoP (${at})`, s.basis2025.grn === groups2025.has("grn"));
  if (OVERLAY.assumptions.on === "everywhere") check(`on contests 2028 (${at})`, s.contest.on === true);
  else check(`on 2028 matches 2025 (${at})`, s.contest.on === groups2025.has("on"));
  if (OVERLAY.assumptions.grn === "everywhere") check(`grn contests 2028 (${at})`, s.contest.grn === true);
  if (s.contest.on !== (groups2025.has("on"))) onMod++;
  check(`ALP contests (${at})`, s.contest.alp === true);
  check(`othCount matches 2025 DoP (${at})`,
    s.contest.othCount2025 === f.candidates.filter((c) => c.group === "oth").length);

  // Independents: a held IND appears iff the baseline seat has a member: key
  // (and is not marked retired); declared challenges mirror the overlay.
  const memberKey = Object.keys(b.primaries).find((k) => k.startsWith("member:"));
  const heldInd = s.contest.ind.find((i) => i.kind === "held");
  check(`held IND iff baseline member: key (${at})`,
    (heldInd?.key ?? null) === (memberKey && !RETIRED.has(s.name) ? memberKey : null),
    `set ${heldInd?.key ?? "none"} vs baseline ${memberKey ?? "none"}`);
  if (heldInd) indHeld++;
  check(`declared challenges match overlay (${at})`,
    JSON.stringify(s.contest.ind.filter((i) => i.kind !== "held").map((i) => i.label).sort())
      === JSON.stringify((CHALLENGES.get(s.name) ?? []).slice().sort()),
    JSON.stringify(s.contest.ind.filter((i) => i.kind !== "held").map((i) => i.label)));
}

check("held INDs = the 2025 crossbench (12) minus retirements",
  indHeld === 12 - [...RETIRED].filter((r) => Object.keys(baseBy.get(r)?.primaries ?? {}).some((k) => k.startsWith("member:"))).length,
  `${indHeld}`);

// The 2025 DoP facts the assumptions are anchored to — pinned, not implied.
check("ON contested 147 seats in 2025 (absent: the three ACT seats)",
  FLOWS.seats.filter((s) => s.candidates.some((c) => c.group === "on")).length === 147);
for (const act of ["Bean", "Canberra", "Fenner"]) {
  check(`ON absent in ${act} 2025 (assumption extension flagged)`,
    SET.seats.find((s) => s.name === act)?.basis2025.on === false);
}
check("GRN and ALP contested all 150 in 2025",
  FLOWS.seats.every((s) => s.candidates.some((c) => c.group === "grn") && s.candidates.some((c) => c.group === "alp")));
const THREE_CORNERED = ["Barker", "Bendigo", "Bullwinkel", "Durack", "Forrest", "Grey", "O'Connor"];
const twoCoal = SET.seats.filter((s) => s.contest.coalition.length > 1).map((s) => s.name).sort();
check("seven LP+NP three-cornered contests preserved",
  JSON.stringify(twoCoal) === JSON.stringify([...THREE_CORNERED].sort()), JSON.stringify(twoCoal));

if (failures) { console.error(`${failures} failures`); process.exit(1); }
console.log(`candidate set OK: ${SET.seats.length} seats, ${indHeld} IND holders recontesting, ${RETIRED.size} retirements, ON assumption adds ${onMod} seats`);
