#!/usr/bin/env node
/* aec-2025-region-tpp-flows.mjs — derive gen-data §7db's elec2025r carriers
   (all/inner/outer/regional, ALP-v-Coalition basis) from the AEC's own
   per-seat flows.

   Source: data/aec-2025-tcp-flow-by-division.csv, vendored unchanged from
   results.aec.gov.au/31496/Website/Downloads/HouseTcpFlowByDivisionDownload-31496.csv.
   For every candidate who did not make the final two it gives where that
   candidate's OWN first-preference ballots finished, split between the
   final pair. In a CLASSIC seat (final pair Labor v Coalition) that IS the
   two-party-preferred flow, counted, ballot by ballot — no replay needed.

   Scope: the 115 classic seats. The AEC publishes TPP flows by party
   nationally and by state only (HouseTppFlowByParty / ByStateByParty), not
   per division, and in the 35 non-classic seats the TCP file's final pair
   isn't Labor v Coalition, so those seats can't be split by seat class.
   `all` is the same 115 seats, so the three regions ballot-weight to it
   exactly. The AEC's all-150-seat figures (flows.mjs FLOW: grn 88.19,
   on 25.50, oth 54.55) stay the estimator's constants; the comparison row
   printed below shows what leaving out the non-classic seats does (small
   for GRN and ON; Others drop ~6 points without the teal/independent seats).

   History: until 2026-10-19 this script replayed the vendored distribution
   of preferences (data/aec-2025-seat-flows.json) with origin-tagged piles,
   splitting each excluded pile in its overall proportions. That blends
   origins — GRN piles carry earlier minors' ballots, ON piles likewise — and
   put GRN 7 points low and ON 7 points high (80.45/33.02/51.04 against this
   file's 87.46/25.86/48.33 over the same ballots). Do not go back to it.

   Checks (each throws): every from-row total equals the candidate's
   first-preference votes in the vendored DoP roster; every classic seat's
   ALP finish equals the DoP's final ALP pile to within 1 vote; the
   classic-seat set equals the DoP's `classic` flag.

   Run from the repo root:  node .build/aec-2025-region-tpp-flows.mjs   */
import { readFileSync } from "node:fs";

const seats = JSON.parse(readFileSync("data/aec-2025-seat-flows.json", "utf8")).seats;
const divisions = JSON.parse(readFileSync("data/aec-2025-division-class.json", "utf8")).divisions;
const classOf = new Map(divisions.map((d) => [d.name, d.class]));

const MAJORS = new Set(["ALP", "LP", "NP", "LNP", "CLP"]);
const CLASS_BUCKET = { inner: "inner", outer: "outer", provincial: "regional", rural: "regional" };
const SOURCES = ["grn", "on", "oth"]; // oth = IND + all other minors (the official lump's "IND+OTH")
const lumped = (ab) => (ab === "GRN" || ab === "GVIC" ? "grn" : ab === "ON" ? "on" : "oth");

/* the AEC quotes fields holding commas ("Shooters, Fishers and Farmers Party") */
function splitCsv(line) {
  const out = [];
  let cur = "", q = false;
  for (const ch of line) {
    if (ch === '"') { q = !q; continue; }
    if (ch === "," && !q) { out.push(cur); cur = ""; } else cur += ch;
  }
  out.push(cur.replace(/\r$/, ""));
  return out;
}
const rows = readFileSync("data/aec-2025-tcp-flow-by-division.csv", "utf8").split("\n").slice(2)
  .filter((l) => l.trim()).map(splitCsv)
  .map((c) => ({ div: c[2], fromId: c[3], from: c[4], to: c[10], n: Number(c[15]) }));

/* per division: the final pair, each from-candidate's total, ALP's finish */
const byDiv = new Map();
for (const r of rows) {
  const d = byDiv.get(r.div) ?? byDiv.set(r.div, { finals: new Set(), from: new Map(), alp: 0 }).get(r.div);
  d.finals.add(r.to);
  if (r.to === "ALP") d.alp += r.n;
  if (r.fromId !== "0") d.from.set(r.fromId, (d.from.get(r.fromId) ?? 0) + r.n);
}
if (byDiv.size !== 150) throw new Error(`expected 150 divisions, got ${byDiv.size}`);
const isClassic = (d) => d.finals.has("ALP") && [...d.finals].every((p) => MAJORS.has(p));

let checked = 0;
const seatOf = new Map(seats.map((s) => [s.name, s]));
for (const [div, d] of byDiv) {
  const seat = seatOf.get(div);
  if (!seat) throw new Error(`${div}: not in the vendored DoP`);
  if (isClassic(d) !== !!seat.classic) throw new Error(`${div}: classic flag disagrees with the DoP`);
  for (const [id, n] of d.from) {
    const c = seat.candidates.find((k) => k.id === id);
    if (!c) throw new Error(`${div}: from-candidate ${id} not in the DoP roster`);
    if (c.votes !== n) throw new Error(`${div} ${c.name}: from-row total ${n} != first preferences ${c.votes}`);
    checked++;
  }
  if (isClassic(d)) {
    const ai = seat.candidates.findIndex((k) => k.party === "ALP");
    const final = seat.candidates[ai].votes + seat.flows.reduce((a, f) => a + (f.to[ai] ?? 0), 0);
    if (Math.abs(final - d.alp) > 1) throw new Error(`${div}: ALP finish ${d.alp} != DoP final pile ${final}`);
  }
}
console.log(`checked: ${checked} from-candidates' totals = their first preferences; classic seats' ALP finish = DoP final pile`);

const buckets = { all: {}, inner: {}, outer: {}, regional: {} };
const coverage = { inner: [0, 0], outer: [0, 0], regional: [0, 0] };
let classic = 0;
for (const [div, d] of byDiv) {
  const bucket = CLASS_BUCKET[classOf.get(div)];
  if (!bucket) throw new Error(`${div}: no division class`);
  coverage[bucket][1]++;
  if (!isClassic(d)) continue;
  classic++;
  coverage[bucket][0]++;
  for (const r of rows) {
    if (r.div !== div || r.fromId === "0" || MAJORS.has(r.from)) continue;
    for (const key of ["all", bucket]) {
      const b = (buckets[key][lumped(r.from)] ??= { alp: 0, maj: 0 });
      b.maj += r.n;
      if (r.to === "ALP") b.alp += r.n;
    }
  }
}

const official = { grn: 88.19, on: 25.5, oth: 54.55 };
console.log(`classic seats: ${classic}/150 — the AEC's counted flows; non-classic seats have no Labor-v-Coalition finish`);
for (const key of ["all", "inner", "outer", "regional"]) {
  console.log(`\n${key}:`);
  for (const src of SOURCES) {
    const b = buckets[key][src];
    const share = (100 * b.alp) / b.maj;
    const cmp = key === "all" ? `  (AEC all-150-seat TPP ${official[src]}; delta ${(share - official[src]).toFixed(2)})` : "";
    console.log(`  ${src} ${share.toFixed(2)}% to ALP  (${b.maj.toLocaleString("en-AU")} ballots)${cmp}`);
  }
}
console.log("\ncoverage (classic seats / total seats per region):");
for (const [k, [c, t]] of Object.entries(coverage)) console.log(`  ${k}: ${c}/${t}`);
