#!/usr/bin/env node
/* aec-2025-region-tpp-flows.mjs — derive gen-data §7db's elec2025r carriers
   (all/inner/outer/regional, ALP-v-Coalition TPP basis) from the per-seat
   2025 distribution of preferences.

   Why: the forced-choice section's 2025 count views ride ONE cut so the
   parts weigh up to the whole — the replay. The AEC's own TPP flow product
   (HouseTppFlowByStateByParty, all ballots redistributed to ALP v
   Coalition) is published by party NATIONALLY (HouseTppFlowByParty) and by
   STATE, never per division or division class, and House ballot-level
   preferences are never published — so no official per-class cut exists to
   display beside it, and the official constants (flows.mjs: grn 88.19,
   onp 25.50, oth 54.55) stay the estimator's, shown nowhere in the
   section. All four carriers are derived here from
   data/aec-2025-seat-flows.json (the vendored DoP), replayed per seat with
   origin-tagged piles: every count's excluded pile is split to receivers
   in proportion to the recorded transfers. In a CLASSIC seat the count
   ends ALP v Coalition, so each source party's ballots end exactly on a
   major pile. Source ballots in the 35 NON-classic seats can end on
   crossbencher/GRN terminal piles — those seats are EXCLUDED from the
   buckets (the AEC's notional TPP counts in them exist only as seat
   outcomes, not flows). `all` is the same 115 classic seats whole, so the
   three regions ballot-weight to it exactly — the 2026-10-19 reader
   report's parts-versus-whole complaint: the regions had been shown
   against a national carrier read off the TPP product, which no weighting
   of classic-seat-only parts can average to. The proportional-hop rule is
   exact for the dominant hop (grn/on/oth piles excluded while the majors
   stand) and approximate only for the small minor→minor hops that precede
   it. Coverage of each bucket is printed with the results.

   The printed official-constants delta beside the all-row is the
   approximation check: replay vs notional, full-coverage comparison.

   Run from the repo root:  node .build/aec-2025-region-tpp-flows.mjs   */
import { readFileSync } from "node:fs";

const seats = JSON.parse(readFileSync("data/aec-2025-seat-flows.json", "utf8")).seats;
const divisions = JSON.parse(readFileSync("data/aec-2025-division-class.json", "utf8")).divisions;
const classOf = new Map(divisions.map((d) => [d.name, d.class]));

const MAJORS = new Set(["alp", "lp", "np", "lnp", "clp"]);
const CLASS_BUCKET = { inner: "inner", outer: "outer", provincial: "regional", rural: "regional" };
const SOURCES = ["grn", "on", "oth"]; // oth = IND + all other minors (the official lump's "IND+OTH")

function replay(seat) {
  const piles = new Map(); // candidate idx -> Map(origin -> votes)
  seat.candidates.forEach((c, i) => piles.set(i, new Map([[c.group, c.votes]])));
  for (const f of seat.flows) {
    const pile = piles.get(f.excluded);
    if (!pile) throw new Error(`${seat.name}: excluded ${f.excluded} has no pile`);
    const tot = [...pile.values()].reduce((a, b) => a + b, 0);
    if (Math.abs(tot - f.pile) > 1) throw new Error(`${seat.name} count ${f.count}: pile drift ${tot} vs ${f.pile}`);
    const got = Object.values(f.to).reduce((a, b) => a + b, 0);
    if (got !== f.pile) throw new Error(`${seat.name} count ${f.count}: transfers ${got} != pile ${f.pile}`);
    for (const [idx, v] of Object.entries(f.to)) {
      const recv = piles.get(Number(idx));
      if (!recv) throw new Error(`${seat.name} count ${f.count}: receiver ${idx} not standing`);
      for (const [o, n] of pile) recv.set(o, (recv.get(o) ?? 0) + (n * v) / tot);
    }
    piles.delete(f.excluded);
  }
  if (piles.size !== 2) throw new Error(`${seat.name}: ${piles.size} left standing`);
  return [...piles.entries()].map(([idx, origins]) => ({ group: seat.candidates[idx].group, origins }));
}

const lumped = (g) => (MAJORS.has(g) || g === "grn" || g === "on" ? g : "oth");
const buckets = { all: {}, inner: {}, outer: {}, regional: {} };
const coverage = { inner: [0, 0], outer: [0, 0], regional: [0, 0] };
let classic = 0;

for (const seat of seats) {
  const bucket = CLASS_BUCKET[classOf.get(seat.name)];
  if (!bucket) throw new Error(`${seat.name}: no division class`);
  coverage[bucket][1]++;
  if (!seat.classic) continue;
  classic++;
  coverage[bucket][0]++;
  const terminal = replay(seat);
  if (!terminal.every((t) => MAJORS.has(t.group)))
    throw new Error(`${seat.name}: classic seat ends on ${terminal.map((t) => t.group)}`);
  if (!terminal.some((t) => t.group === "alp"))
    throw new Error(`${seat.name}: classic seat without an ALP terminal`);
  for (const src of SOURCES) {
    let alp = 0, maj = 0;
    for (const t of terminal)
      for (const [o, n] of t.origins) {
        const l = lumped(o);
        if (l !== src) continue;
        maj += n;
        if (t.group === "alp") alp += n;
      }
    for (const key of ["all", bucket]) {
      const b = (buckets[key][src] ??= { alp: 0, maj: 0 });
      b.alp += alp;
      b.maj += maj;
    }
  }
}

const official = { grn: 88.19, onp: 25.5, oth: 54.55 };
console.log(`classic seats: ${classic}/150 — non-classic excluded (terminal crossbencher/GRN piles have no published majors split)`);
for (const key of ["all", "inner", "outer", "regional"]) {
  console.log(`\n${key}:`);
  for (const src of SOURCES) {
    const b = buckets[key][src];
    const share = (100 * b.alp) / b.maj;
    const off = official[src];
    const cmp = key === "all" ? `  (official TPP ${off}; delta ${(share - off).toFixed(2)})` : "";
    console.log(`  ${src} ${share.toFixed(2)}% to ALP  (${Math.round(b.maj).toLocaleString("en-AU")} ballots)${cmp}`);
  }
}
console.log("\ncoverage (classic seats / total seats per region):");
for (const [k, [c, t]] of Object.entries(coverage)) console.log(`  ${k}: ${c}/${t}`);
