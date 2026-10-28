// USAGE: node .build/extract-division-results.mjs   (run from repo root)
// Emits data/division-results.json — per-division AEC election summaries for
// the statistics-CD-era years 1993/1996/1998 (enrolment, turnout, informal,
// and the AEC's certified division-level Labor-v-Coalition TPP + swings),
// parsed from the committed verbatim DIVS.TXT pulls in .build/aec-flow-src/.
// 1993 IS included: its booth-grain HTPP product is informal-only, but the
// division-level DIVS.TXT TPP pair is real — the finest 1993 TPP grain that
// exists. Swing cells the AEC prints empty (no prior comparator) stay null,
// never 0. See .build/aec-flow-src/README-haul-1983-2007.md.

import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

const YEARS = [1993, 1996, 1998];
const SRC = (y) => `.build/aec-flow-src/divs-${y}.txt`;
const OUT = "data/division-results.json";

const STATES = new Set(["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"]);
const HEADER = [
  "State", "Division", "Enrolment", "Formal Vote", "Informal Vote",
  "Total Vote", "Formal Pc", "Formal Swing", "Informal Pc", "Informal Swing",
  "Turnout", "Turnout Swing", "ALP TPP Vote", "Coalition TPP Vote",
  "TPP Exhausted", "ALP TPP Pc", "ALP Swing",
];
// Derived from the committed files (names not guessed): pre-redistribution
// 1993 (no Namadgi, single-seat NT), Namadgi in 1996, Blair in 1998.
const CHAMBER = { 1993: 147, 1996: 148, 1998: 148 };

// 1998 Newcastle: the AEC's own product counts NO Labor-v-Coalition TPP —
// Newcastle's final pair ran Labor v independent (Allan Morris) — and
// prints the five TPP cells as literal zeros (its ALP Swing cell is the
// mechanical 0.00-minus-1996 subtraction, equally meaningless). Stored
// null, never reconstructed — the same omission the family encodes as
// HTT_EXCLUDED = {1998: {"Newcastle"}} on the HTPPBYPP lane.
const NO_TPP = { 1998: new Set(["Newcastle"]) };

const PC_TOL = 0.02; // 2dp printed-percent rounding gate — same as the HTPP lane

const intCell = (s, year, div, col) => {
  if (!/^\d+$/.test(s)) throw new Error(`${year} ${div}: ${col} not an int: ${JSON.stringify(s)}`);
  return parseInt(s, 10);
};
const pcCell = (s, year, div, col, { nullable = false } = {}) => {
  if (s === "" && nullable) return null;
  // the AEC prints most cells 2dp but drops the fraction on whole numbers ("97")
  if (!/^-?\d+(\.\d+)?$/.test(s)) throw new Error(`${year} ${div}: ${col} not a pct: ${JSON.stringify(s)}`);
  return parseFloat(s);
};

export function parseDivs(path, year) {
  const raw = readFileSync(path, "utf8");
  const lines = raw.split(/\r?\n/);
  const header = lines.shift();
  if (header !== HEADER.join(";"))
    throw new Error(`${year}: DIVS header drifted — got ${JSON.stringify(header)}`);
  const out = {};
  for (const line of lines) {
    if (!line.trim()) continue; // the 1993 file ends with a blank line
    const c = line.split(";");
    if (c.length !== 17) throw new Error(`${year}: ${c.length} columns — ${line.slice(0, 60)}`);
    const [state, div] = c;
    if (!STATES.has(state)) throw new Error(`${year}: unknown state ${state}`);
    if (!div) throw new Error(`${year}: empty division name`);
    if (out[div]) throw new Error(`${year}: duplicate division ${div}`);
    const enrolment = intCell(c[2], year, div, "Enrolment");
    const formalVote = intCell(c[3], year, div, "Formal Vote");
    const informalVote = intCell(c[4], year, div, "Informal Vote");
    const totalVote = intCell(c[5], year, div, "Total Vote");
    const formalPc = pcCell(c[6], year, div, "Formal Pc");
    const formalSwing = pcCell(c[7], year, div, "Formal Swing", { nullable: true });
    const informalPc = pcCell(c[8], year, div, "Informal Pc");
    const informalSwing = pcCell(c[9], year, div, "Informal Swing", { nullable: true });
    const turnout = pcCell(c[10], year, div, "Turnout");
    const turnoutSwing = pcCell(c[11], year, div, "Turnout Swing", { nullable: true });
    const alpTppVote = intCell(c[12], year, div, "ALP TPP Vote");
    const coalitionTppVote = intCell(c[13], year, div, "Coalition TPP Vote");
    const tppExhausted = intCell(c[14], year, div, "TPP Exhausted");
    const alpTppPc = pcCell(c[15], year, div, "ALP TPP Pc");
    const alpSwing = pcCell(c[16], year, div, "ALP Swing", { nullable: true });
    // recompose gates — a torn row or drifted column mapping fails here
    if (formalVote + informalVote !== totalVote)
      throw new Error(`${year} ${div}: formal ${formalVote} + informal ${informalVote} != total ${totalVote}`);
    if (Math.abs((100 * formalVote) / totalVote - formalPc) > PC_TOL)
      throw new Error(`${year} ${div}: formal pc drift ${formalPc} vs ${(100 * formalVote) / totalVote}`);
    if ((100 * totalVote) / enrolment - turnout > PC_TOL || turnout - (100 * totalVote) / enrolment > PC_TOL)
      throw new Error(`${year} ${div}: turnout drift ${turnout}`);
    const noTpp = NO_TPP[year]?.has(div) ?? false;
    if (noTpp) {
      if (alpTppVote !== 0 || coalitionTppVote !== 0 || tppExhausted !== 0 || alpTppPc !== 0)
        throw new Error(`${year} ${div}: a TPP-excluded row must print 0 TPP cells`);
    } else {
      if (alpTppVote + coalitionTppVote + tppExhausted !== formalVote)
        throw new Error(`${year} ${div}: tpp ${alpTppVote}+${coalitionTppVote}+${tppExhausted} != formal ${formalVote}`);
      if (Math.abs((100 * alpTppVote) / (alpTppVote + coalitionTppVote) - alpTppPc) > PC_TOL)
        throw new Error(`${year} ${div}: tpp pc drift ${alpTppPc} vs ${(100 * alpTppVote) / (alpTppVote + coalitionTppVote)}`);
    }
    out[div] = noTpp
      ? {
          state, enrolment, formalVote, informalVote, totalVote,
          formalPc, formalSwing, informalPc, informalSwing, turnout, turnoutSwing,
          alpTppVote: null, coalitionTppVote: null, tppExhausted: null,
          alpTppPc: null, alpSwing: null,
        }
      : {
          state, enrolment, formalVote, informalVote, totalVote,
          formalPc, formalSwing, informalPc, informalSwing, turnout, turnoutSwing,
          alpTppVote, coalitionTppVote, tppExhausted, alpTppPc, alpSwing,
        };
  }
  const n = Object.keys(out).length;
  if (n !== CHAMBER[year])
    throw new Error(`${year}: parsed ${n} divisions, chamber is ${CHAMBER[year]}`);
  return out;
}

export function build() {
  const elections = {};
  const inputs = {};
  for (const y of YEARS) {
    const path = SRC(y);
    const sha = createHash("sha256").update(readFileSync(path)).digest("hex");
    inputs[path] = `sha256:${sha.slice(0, 16)}`;
    elections[String(y)] = parseDivs(path, y);
  }
  return {
    _about:
      "AEC-certified division summaries for the 1993, 1996 and 1998 federal elections — per division: enrolment, formal/informal/total vote + printed percentages and their swings, turnout and the AEC's own division-level Labor-v-Coalition two-party-preferred pair (votes, ALP share, swing, exhausted ballots). The 1993 block is REAL at this grain: the booth-level HTPPBYPP product for 1993 is informal-votes-only, but DIVS.TXT's division-level TPP pair is the certified count and the finest 1993 TPP grain published. Swing cells the AEC printed empty (a division with no prior-election comparator, e.g. Namadgi 1996) are null, not 0. 1998 Newcastle's five TPP cells are null — the AEC counted no Labor-v-Coalition pair there (final pair Labor v independent), matching the family's HTPP exclusion; never reconstructed. This is a summary layer — first-preference tables live in the family's houses (hcands/booth fpv), full cascades in dop-<year>.csv.gz.",
    _provenance: {
      generator: ".build/extract-division-results.mjs",
      inputs,
      source:
        "data/import/tables{93,96,98}/DIVS.TXT members of aec-1993-1996-1998-election-statistics.zip (AEC statistics CD-ROM pack, sha256 ee3b46be593dfd2b6e8f29ca1acf78a1ae4a86f0dfd0aba71f33248bdbb025e8 — see README-haul-1983-2007.md; verbatim commits in .build/aec-flow-src/)",
      schemaDoc: "data/import/import.pdf inside the pack",
    },
    elections,
  };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const doc = build();
  writeFileSync(OUT, JSON.stringify(doc, null, 2) + "\n");
  const sizes = Object.fromEntries(
    Object.entries(doc.elections).map(([y, e]) => [y, Object.keys(e).length]),
  );
  console.log(`wrote ${OUT}`, sizes);
}
