#!/usr/bin/env node
/* build-candidate-set.mjs — W6 of .build/analysis/seat-model-plan.md.
   Merge the HAND overlay (.build/analysis/seat-model/candidate-overlay-2028.json)
   over the derived 2025 contest set to produce data/seat-candidate-set-2028.json:
   per seat, the incumbent (and whether they recontest) and the 2028 contest
   set the simulation layer draws around — groups as 2028 assumptions, each
   with its 2025 fact alongside so the model can price assumption risk.

   Derived base (never hand-copied): from data/aec-2025-seat-flows.json
   candidates and data/seats-2025-baseline.json members. Overlay entries are
   validated hard against that base — a stale retirement or typo'd seat name
   fails the build, loudly, rather than drifting into the simulation.

   Run from the repo root:
     node .build/analysis/seat-model/build-candidate-set.mjs
   Then: node .build/analysis/seat-model/test-candidate-set.mjs   */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

const FLOWS = "data/aec-2025-seat-flows.json";
const BASE = "data/seats-2025-baseline.json";
const OVERLAY = ".build/analysis/seat-model/candidate-overlay-2028.json";
const OUT = "data/seat-candidate-set-2028.json";

const flows = JSON.parse(readFileSync(FLOWS, "utf8"));
const base = JSON.parse(readFileSync(BASE, "utf8"));
const overlay = JSON.parse(readFileSync(OVERLAY, "utf8"));

const A = overlay.assumptions;
const COAL = ["lp", "lnp", "np", "clp"];

const flowsBy = new Map(flows.seats.map((s) => [s.name, s]));
const sha = (f) => createHash("sha256").update(readFileSync(f)).digest("hex").slice(0, 16);

// --- Validate overlay entries against the baseline before merging. ---------
const seatNames = new Set(base.seats.map((s) => s.name));
const baseBy = new Map(base.seats.map((s) => [s.name, s]));
for (const list of ["retirements", "byElections"])
  for (const e of overlay[list] ?? []) {
    if (!seatNames.has(e.seat)) throw new Error(`overlay ${list}: unknown seat "${e.seat}"`);
  }
for (const e of overlay.retirements ?? []) {
  const member = baseBy.get(e.seat).member.name;
  if (e.member && e.member.toLowerCase() !== member.toLowerCase())
    throw new Error(`overlay retirements: ${e.seat} member ${member} != overlay ${e.member}`);
}
for (const c of overlay.independents?.challenges ?? []) {
  if (!seatNames.has(c.seat)) throw new Error(`overlay independents: unknown seat "${c.seat}"`);
  if (!c.name || !c.name.trim()) throw new Error(`overlay independents: challenge in ${c.seat} has no name`);
}

const retired = new Map((overlay.retirements ?? []).map((e) => [e.seat, e]));
const byElection = new Map((overlay.byElections ?? []).map((e) => [e.seat, e]));
const challenges = new Map(); // seat -> challenge entries
for (const c of overlay.independents?.challenges ?? [])
  challenges.set(c.seat, [...(challenges.get(c.seat) ?? []), c]);

const seats = [];
for (const b of base.seats) {
  const f = flowsBy.get(b.name);
  if (!f) throw new Error(`${b.name}: in baseline but not in the seat-flows file`);
  const groups = new Set(f.candidates.map((c) => c.group));

  // 2025 coalition party mix, in canonical order; preserved by default.
  const coal2025 = COAL.filter((g) => groups.has(g));
  if (!coal2025.length) throw new Error(`${b.name}: no coalition candidate in 2025 count 0`);

  const memberKey = Object.keys(b.primaries).find((k) => k.startsWith("member:"));
  const ret = retired.get(b.name);
  const ind = [];
  if (memberKey && A.indHeldRecontest !== false && !ret)
    ind.push({ key: memberKey, label: b.member.name, kind: "held" });
  for (const c of challenges.get(b.name) ?? [])
    ind.push({ key: `ind:${c.seat.toLowerCase().replace(/[^a-z]+/g, "-")}`, label: c.name, kind: c.likelihood === "likely" ? "likely" : "declared", note: c.note });
  const othCount = f.candidates.filter((c) => c.group === "oth").length;

  seats.push({
    name: b.name, state: b.state,
    incumbent: {
      group: b.member.group, name: b.member.name,
      recontests: ret ? false : A.incumbentRecontests !== false,
      ...(ret && { retirementNote: `${ret.date}${ret.note ? ` — ${ret.note}` : ""}` }),
      ...(byElection.has(b.name) && { byElection: byElection.get(b.name).note ?? "see overlay" }),
    },
    contest: {
      alp: true,
      coalition: coal2025,
      on: A.on === "everywhere" ? true : groups.has("on"),
      grn: A.grn === "everywhere" ? true : groups.has("grn"),
      ind,
      othCount2025: othCount,
    },
    basis2025: {
      coalition: coal2025,
      on: groups.has("on"),
      grn: groups.has("grn"),
      indHeld: memberKey ?? null,
    },
  });
}
if (seats.length !== 150) throw new Error(`expected 150 seats, got ${seats.length}`);

const onAdded = seats.filter((s) => s.contest.on && !s.basis2025.on).map((s) => s.name);
const out = {
  _about: "W6 of .build/analysis/seat-model-plan.md — the 2028 candidate set the simulation layer draws around. Per seat: incumbent (+recontests), the 2028 contest set (groups booleans, coalition party mix, named independent entrants), and basis2025 — the measured 2025 contest set from the DoP — so every 2028 assumption sits next to its fact. contest.on true-but-basis2025.on false marks the ON-everywhere extension (2025: ON skipped only the three ACT seats). Produced by build-candidate-set.mjs from the HAND overlay candidate-overlay-2028.json; test-candidate-set.mjs pins the merge against the W2/W3 data.",
  _provenance: {
    flows: { file: FLOWS, sha256: sha(FLOWS) },
    baseline: { file: BASE, sha256: sha(BASE) },
    overlay: { file: OVERLAY, sha256: sha(OVERLAY) },
    builtAt: new Date().toISOString().slice(0, 10),
  },
  assumptions: { ...A, onEverywhereAdds: onAdded },
  seats,
};
writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n");
const indHeld = seats.filter((s) => s.contest.ind.some((i) => i.kind === "held")).length;
const retiring = seats.filter((s) => !s.incumbent.recontests).length;
console.log(`wrote ${OUT}: ${seats.length} seats — ${indHeld} IND holders recontesting, ${retiring} retirements, ON added in: ${onAdded.join(", ") || "none"}`);
