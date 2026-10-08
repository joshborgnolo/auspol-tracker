#!/usr/bin/env node
/* test-2025-seat-flows.mjs — layer-1 invariant for data/aec-2025-seat-flows.json.

   The W2 contract (seat-model-plan §Architecture.4): replaying the recorded
   2025 distribution of preferences from the count-0 primaries must
   reproduce the W3 baseline exactly — group primaries per seat, certified
   TCP pair + votes, and 150/150 elected members (GES-style: if the file
   can't replay the real count, downstream re-runs hang off nothing).

   Also pins the derived group->group matrix's national anchors: these are
   DIRECT transfers at the group's exclusion, not final-destination shares.
   Green ballots land on Labor only 71% directly because teal independents
   absorb them in non-classic seats; One Nation ballots reach the Coalition
   61% directly. Both sit BELOW the AEC's final-destination flow figures —
   do not "fix" them to match.

   Run from the repo root: node .build/analysis/seat-model/test-2025-seat-flows.mjs */
import { readFileSync } from "node:fs";

const FLOWS = JSON.parse(readFileSync("data/aec-2025-seat-flows.json", "utf8"));
const BASE = JSON.parse(readFileSync("data/seats-2025-baseline.json", "utf8"));
let failures = 0;
const check = (label, ok, detail = "") => {
  if (!ok) { failures++; console.error(`FAIL ${label}${detail ? " — " + detail : ""}`); }
};

const GROUPS = ["alp", "lp", "lnp", "np", "clp", "on", "grn", "oth"];
const baseBy = new Map(BASE.seats.map((s) => [s.name, s]));

check("150 seats", FLOWS.seats.length === 150, `got ${FLOWS.seats.length}`);
check("seat names unique", new Set(FLOWS.seats.map((s) => s.name)).size === 150);
check("every flows seat is a baseline seat", FLOWS.seats.every((s) => baseBy.has(s.name)));
check("every baseline seat is a flows seat", BASE.seats.every((s) => FLOWS.seats.find((f) => f.name === s.name)));

let exclusions = 0, winners = 0, memberSeats = 0;
for (const s of FLOWS.seats) {
  const at = `${s.name} (${s.aecId})`;
  const b = baseBy.get(s.name);
  if (!b) continue;

  check(`aecId/state match baseline (${at})`, s.aecId === b.aecId && s.state === b.state);
  check(`classic matches baseline (${at})`, s.classic === b.tcp.classic);

  // Candidates: known group keys, and the flows count is N - 2 (AEC counts
  // stop at the TCP pair).
  const badKeys = s.candidates.filter((c) => !GROUPS.includes(c.group) && !c.group.startsWith("member:"));
  check(`only known candidate groups (${at})`, badKeys.length === 0, badKeys.map((c) => c.group).join(","));
  check(`exclusions = candidates - 2 (${at})`, s.flows.length === s.candidates.length - 2,
    `${s.flows.length} flows, ${s.candidates.length} candidates`);
  check(`counts are 1..N-2 in order (${at})`,
    s.flows.every((f, i) => f.count === i + 1), JSON.stringify(s.flows.map((f) => f.count)));
  exclusions += s.flows.length;

  // Count-0 group replay == baseline primaries (raw counts, per key).
  const primarySum = {};
  for (const c of s.candidates) primarySum[c.group] = (primarySum[c.group] ?? 0) + c.votes;
  for (const k of Object.keys(b.primaries))
    check(`group primary ${k} matches baseline (${at})`, (primarySum[k] ?? 0) === b.primaries[k],
      `flows ${primarySum[k] ?? 0} vs baseline ${b.primaries[k]}`);

  // Full elimination replay from count-0 piles.
  const piles = s.candidates.map((c) => c.votes);
  const standing = s.candidates.map(() => true);
  check(`first-preference piles non-negative (${at})`, piles.every((v) => v >= 0 && Number.isFinite(v)));
  for (const f of s.flows) {
    check(`excluded candidate still standing (${at} count ${f.count})`, standing[f.excluded]);
    standing[f.excluded] = false;
    check(`pile matches replay (${at} count ${f.count})`, piles[f.excluded] === f.pile,
      `replay ${piles[f.excluded]} vs recorded ${f.pile}`);
    const receivers = Object.keys(f.to).map(Number);
    check(`no self-transfer (${at} count ${f.count})`, !receivers.includes(f.excluded));
    check(`receivers all standing (${at} count ${f.count})`, receivers.every((i) => standing[i]),
      receivers.filter((i) => !standing[i]).map((i) => s.candidates[i].name).join(","));
    const got = Object.values(f.to).reduce((a, b) => a + b, 0);
    check(`conservation (${at} count ${f.count})`, got === f.pile, `${got} vs ${f.pile}`);
    for (const [i, v] of Object.entries(f.to)) piles[Number(i)] += v;
    piles[f.excluded] = 0;
  }
  const left = piles.map((v, i) => ({ v, ...s.candidates[i] })).filter((_, i) => standing[i]);
  check(`two candidates remain (${at})`, left.length === 2, `${left.length}`);

  const ourVotes = left.map((x) => x.v).sort((a, c) => c - a);
  const aecVotes = b.tcp.pair.map((p) => p.votes).sort((a, c) => c - a);
  check(`TCP votes match baseline exactly (${at})`,
    left.length === 2 && ourVotes[0] === aecVotes[0] && ourVotes[1] === aecVotes[1],
    `${ourVotes} vs ${aecVotes}`);
  check(`TCP groups match baseline (${at})`,
    JSON.stringify(left.map((x) => x.group).sort()) === JSON.stringify(b.tcp.pair.map((p) => p.group).sort()),
    `${left.map((x) => x.group)} vs ${b.tcp.pair.map((p) => p.group)}`);
  const winner = left.reduce((a, c) => (c.v > a.v ? c : a), left[0] ?? { v: -1 });
  check(`winner matches baseline member (${at})`, winner.group === b.member.group,
    `replay ${winner.group} vs ${b.member.group}`);
  if (winner.group === b.member.group) winners++;

  // The derived group->group matrix is exactly what the flows imply.
  const groups = {};
  s.flows.forEach((f, fi) => {
    const from = s.candidates[f.excluded].group;
    for (const [i, v] of Object.entries(f.to)) {
      const to = s.candidates[Number(i)].group;
      (groups[from] ??= {})[to] = (groups[from][to] ?? 0) + v;
    }
  });
  check(`group matrix matches flows (${at})`, JSON.stringify(groups) === JSON.stringify(s.groups),
    `recomputed keys ${JSON.stringify(groups).slice(0, 120)}`);

  // Member:<surname> keys line up with the baseline's crossbench seats.
  const flowMembers = s.candidates.filter((c) => c.group.startsWith("member:")).map((c) => c.group);
  const baseMembers = Object.keys(b.primaries).filter((k) => k.startsWith("member:"));
  check(`member keys match baseline (${at})`,
    JSON.stringify(flowMembers.sort()) === JSON.stringify(baseMembers.sort()),
    `${flowMembers} vs ${baseMembers}`);
  if (baseMembers.length) memberSeats++;
}
check("GES replay: all 150 winners reproduced", winners === 150, `${winners}/150`);
check("national exclusions = sum(seats N-2) = 826", exclusions === 826, `got ${exclusions}`);
check("named-member seats = 2025 crossbench (12)", memberSeats === 12, `${memberSeats}`);

// National direct-transfer anchors off the group matrix (see header).
const agg = {};
for (const s of FLOWS.seats) for (const [from, to] of Object.entries(s.groups)) {
  for (const [g, v] of Object.entries(to)) (agg[from] ??= {})[g] = (agg[from][g] ?? 0) + v;
}
const shareTo = (from, targets) => {
  const row = agg[from] ?? {};
  const tot = Object.values(row).reduce((a, b) => a + b, 0);
  return targets.reduce((a, g) => a + (row[g] ?? 0), 0) / tot;
};
const onCoal = shareTo("on", ["lp", "lnp", "np", "clp"]);
check("ON -> Coalition direct share in [0.60, 0.63] (measured 0.615)",
  onCoal >= 0.60 && onCoal <= 0.63, onCoal.toFixed(3));
const grnAlp = shareTo("grn", ["alp"]);
check("GRN -> ALP direct share in [0.69, 0.74] (measured 0.714)", grnAlp >= 0.69 && grnAlp <= 0.74, grnAlp.toFixed(3));

if (failures) { console.error(`${failures} failures`); process.exit(1); }
console.log(`2025 seat flows OK: ${FLOWS.seats.length} seats, ${exclusions} exclusions replayed, ${winners}/150 winners, ${memberSeats} named-member seats`);
