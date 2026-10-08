#!/usr/bin/env node
/* extract-2025-seat-flows.mjs — W2 of .build/analysis/seat-model-plan.md.
   Build data/aec-2025-seat-flows.json: the full 2025 distribution of
   preferences per seat — the ordered list of exclusions, each carrying the
   excluded candidate's pile and the exact votes received by every
   still-standing candidate. Layer 4's Dirichlet draws and the layer-5
   elimination re-runs hang off these per-exclusion flow vectors; the
   per-seat group->group transition totals ("groups") are the derived means
   the national constant aggregation consumes.

   Source: AEC event-31496 FinalResults, HouseDopByDivisionDownload-31496.csv
   (vendored verbatim 2026-10-08 in atlas/data/aec-2025/ beside the W3
   inputs). Seat names, contest type and member:<surname> group keys come
   from the W3-certified data/seats-2025-baseline.json — this file speaks
   the baseline's group contract, nothing else.

   Observed structure of the 2025 DoP file (verified at extraction):
   count 0 standings sum to formal per seat; every count transfers the whole
   excluded pile to still-standing candidates (no exhausted votes appear in
   ANY of the 976 counts — conservative, matches the TCP download); each
   count excludes exactly one candidate.

   GES-style reconciliation + the ON->coalition anchor are pinned by
   test-2025-seat-flows.mjs. Run from the repo root:
     node .build/analysis/seat-model/extract-2025-seat-flows.mjs
   Then: node .build/analysis/seat-model/test-2025-seat-flows.mjs   */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

const SRC = "atlas/data/aec-2025";
const DOP_FILE = "HouseDopByDivisionDownload-31496.csv";
const BASELINE = "data/seats-2025-baseline.json";
const OUT = "data/aec-2025-seat-flows.json";

/* The downloads are RFC-4180 CSV: party names like
   "Shooters, Fishers and Farmers Party" embed commas. A naive split(",")
   shifts that row's later columns by one and silently misreads its votes —
   the 2025 DoP file exercises exactly this (8 SFF candidates). */
function splitRow(line) {
  const out = [];
  let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else inQ = false; }
      else cur += ch;
    } else if (ch === '"' && cur === "") inQ = true;
    else if (ch === ",") { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}
const num = (v) => Number(v) || 0;

const COALITION = { LP: "lp", LNP: "lnp", NP: "np", CLP: "clp" };
const GROUP_OF = { ALP: "alp", GRN: "grn", ON: "on", ...COALITION };
/* The DoP downloads use VIC's state-registered Greens code GVIC; the
   FirstPrefs/TCP downloads (and every other state in the DoP) say GRN.
   Resolve before bucketing or VIC Greens land silently in oth. */
const PARTY_ALIAS = { GVIC: "GRN" };

const baseline = JSON.parse(readFileSync(BASELINE, "utf8"));
const memberBySeat = new Map(); // seat name -> {key, name} for elected crossbenchers
const memberNameBySeat = new Map(); // seat name -> baseline member.name (all 150)
const classicBySeat = new Map();
for (const s of baseline.seats) {
  classicBySeat.set(s.name, s.tcp.classic);
  memberNameBySeat.set(s.name, s.member.name);
  const mk = Object.keys(s.primaries).find((k) => k.startsWith("member:"));
  if (mk) memberBySeat.set(s.name, { key: mk, name: s.member.name });
}

const lines = readFileSync(`${SRC}/${DOP_FILE}`, "utf8").trim().split(/\r?\n/);
const head = splitRow(lines[1]);
const rows = lines.slice(2).map((l) => Object.fromEntries(splitRow(l).map((c, i) => [head[i], c])));

const byDiv = new Map(); // DivisionID -> rows
for (const r of rows) {
  if (!byDiv.has(r.DivisionID)) byDiv.set(r.DivisionID, []);
  byDiv.get(r.DivisionID).push(r);
}

const seats = [];
for (const [id, divRows] of [...byDiv.entries()].sort((a, b) => a[1][0].DivisionNm.localeCompare(b[1][0].DivisionNm))) {
  const division = divRows[0].DivisionNm, state = divRows[0].StateAb;

  // Candidate roster from count 0. The DoP flags the elected candidate
  // (Elected=Y) — use that to identify the member, never the surname:
  // Fowler 2025 has TWO candidates surnamed Le (Elected Dai LE, IND, and
  // Tu LE, ALP).
  const roster = new Map(); // CandidateID -> idx
  const candidates = [];
  for (const r of divRows.filter((x) => x.CountNumber === "0" && x.CalculationType === "Preference Count")) {
    if (roster.has(r.CandidateID)) throw new Error(`${division}: duplicate candidate ${r.CandidateID}`);
    roster.set(r.CandidateID, candidates.length);
    candidates.push({
      id: r.CandidateID,
      name: `${r.GivenNm} ${r.Surname[0]}${r.Surname.slice(1).toLowerCase()}`,
      party: r.PartyAb,
      elected: r.Elected === "Y",
      votes: num(r.CalculationValue),
    });
  }
  if (candidates.length < 2) throw new Error(`${division}: ${candidates.length} candidates in count 0`);
  const el = candidates.filter((c) => c.elected);
  if (el.length !== 1) throw new Error(`${division}: ${el.length} Elected=Y count-0 rows`);
  if (el[0].name.toLowerCase() !== memberNameBySeat.get(division)?.toLowerCase())
    throw new Error(`${division}: DoP elected ${el[0].name} != baseline member ${memberNameBySeat.get(division)}`);
  const mem = memberBySeat.get(division);
  if (mem && GROUP_OF[PARTY_ALIAS[el[0].party] ?? el[0].party])
    throw new Error(`${division}: baseline lists ${mem.key} but the elected DoP candidate is ${el[0].party}`);
  for (const c of candidates)
    c.group = mem && c.id === el[0].id ? mem.key : (GROUP_OF[PARTY_ALIAS[c.party] ?? c.party] ?? "oth");

  // Transfers per count: one negative row (the excluded pile), the rest received.
  const counts = [...new Set(divRows.map((r) => r.CountNumber))].map(Number).sort((a, b) => a - b);
  const flows = [];
  for (const k of counts.slice(1)) {
    const trf = divRows.filter((r) => num(r.CountNumber) === k && r.CalculationType === "Transfer Count");
    const out_ = trf.filter((r) => num(r.CalculationValue) < 0);
    if (out_.length !== 1) throw new Error(`${division} count ${k}: ${out_.length} exclusion rows (expected 1)`);
    const excl = roster.get(out_[0].CandidateID);
    if (excl === undefined) throw new Error(`${division} count ${k}: excluded candidate ${out_[0].CandidateID} not in count 0`);
    const pile = -num(out_[0].CalculationValue);
    const to = {};
    for (const r of trf) {
      if (r.CandidateID === out_[0].CandidateID) continue;
      const v = num(r.CalculationValue);
      if (!v) continue;
      const idx = roster.get(r.CandidateID);
      if (idx === undefined) throw new Error(`${division} count ${k}: receiver ${r.CandidateID} not in count 0`);
      to[idx] = v;
    }
    const got = Object.values(to).reduce((a, b) => a + b, 0);
    if (got !== pile) throw new Error(`${division} count ${k}: pile ${pile} but transfers sum ${got}`);
    flows.push({ count: k, excluded: excl, group: candidates[excl].group, pile, to });
  }
  // AEC counts stop at the TCP pair: exclusions = N - 2.
  if (flows.length !== candidates.length - 2)
    throw new Error(`${division}: ${flows.length} exclusions for ${candidates.length} candidates`);

  // Derived seat-level group->group transition totals (raw counts).
  const groups = {};
  for (const f of flows) {
    const from = f.group;
    if (!groups[from]) groups[from] = {};
    for (const [idx, v] of Object.entries(f.to)) {
      const g = candidates[Number(idx)].group;
      groups[from][g] = (groups[from][g] ?? 0) + v;
    }
  }

  if (!classicBySeat.has(division)) throw new Error(`DoP division ${division} not in the W3 baseline`);
  seats.push({
    name: division, state, aecId: id,
    classic: classicBySeat.get(division),
    candidates,
    flows: flows.map(({ count, excluded, pile, to }) => ({ count, excluded, pile, to })),
    groups,
  });
}

if (seats.length !== 150) throw new Error(`expected 150 seats, got ${seats.length}`);

const out = {
  _about: "W2 of .build/analysis/seat-model-plan.md — full 2025 distribution of preferences per seat. Per seat: candidate roster with W3 baseline group keys (alp/lp/lnp/np/clp/on/grn/oth, member:<surname> for elected crossbenchers), the ordered exclusion list (flows: excluded candidate index, pile, and exact votes received by each still-standing candidate index), and the derived group->group transition totals (groups) the flow-matrix aggregation averages. Raw COUNTS; shares are model-layer business. The 2025 DoP file contains NO exhausted votes in any count — conservation pinned at extraction and by test-2025-seat-flows.mjs (replay reproduces the W3 baseline primaries and certified TCP pair + votes in all 150 seats).",
  _provenance: {
    source: "https://results.aec.gov.au/31496/Website/Downloads/",
    dir: SRC,
    files: {
      [DOP_FILE]: createHash("sha256").update(readFileSync(`${SRC}/${DOP_FILE}`)).digest("hex").slice(0, 16),
    },
    baseline: { file: BASELINE, sha256: createHash("sha256").update(readFileSync(BASELINE)).digest("hex").slice(0, 16) },
    extractedAt: new Date().toISOString().slice(0, 10),
  },
  seats,
};
const ORDER = { NSW: 1, VIC: 2, QLD: 3, SA: 4, WA: 5, TAS: 6, NT: 7, ACT: 8 };
out.seats.sort((a, b) => ORDER[a.state] - ORDER[b.state] || a.name.localeCompare(b.name));
writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n");
console.log(`wrote ${OUT}: ${seats.length} seats, ${seats.reduce((a, s) => a + s.flows.length, 0)} exclusions`);
