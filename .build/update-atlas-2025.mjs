#!/usr/bin/env node
/* update-atlas-2025.mjs — append the 2025 federal election results (event
   31496, FinalResults) to the Electoral Atlas source CSVs.

   Inputs (verbatim provenance copies saved by hand under atlas/data/aec-2025/,
   downloaded from https://results.aec.gov.au/31496/Website/Downloads/):
     HouseTppByDivisionDownload-31496.csv            TPP (ALP vs Coalition) by division
     HouseTppByStateDownload-31496.csv               TPP by state
     HouseTcpByCandidateByVoteTypeDownload-31496.csv final TCP pair votes by division
     HouseNonClassicDivisionsDownload-31496.csv      official non-classic seat list
     HouseMembersElectedDownload-31496.csv           elected member per division

   Outputs (appended in-place, idempotent):
     atlas/data/all_elections_2PP_by_division.csv    +150 rows, Year=2025
     atlas/data/all_elections_2PP_by_state.csv       +8 rows,  Year=2025
     atlas/data/nonclassic_2CP_divisions.csv         +1 row per 2025 nc seat

   Convention notes (replicating the existing files' AEC quirks):
   - div/state CSVs: `Swing` column is COALITION-direction, `New_swing` is
     LABOR-direction. The Tally Room's `Swing` column is labor-direction and
     measured against post-redistribution notional margins — same convention
     as the historical files' `New_swing` (verified: Hawke 2022 = 2.59 on a
     new seat can only be notional).
   - `Party` on the division rows is the TPP-count winner (ALP/LP/LNP/NP),
     matching the historical file (Warringah 2022 = LP despite IND member).
   - nc CSV: `Margin` = minorPct-50 when Coalition is the major,
     majorPct-50 when Labor is the major (Clark 2019: IND 72.12 vs ALP 27.88
     → -22.12). `New_swing` = ΔMargin vs the 2022 nc row when and only when
     the exact minor+major pairing repeats, else NaN.
   - nc `Party` = elected member code, mapped XEN→CA, NP→NAT (file vocab).

   Run: node .build/update-atlas-2025.mjs   (from repo root)
*/
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const SRC = path.join(ROOT, "atlas", "data", "aec-2025");
const DATA = path.join(ROOT, "atlas", "data");
const YEAR = "2025";

/* banner line (title) + header line, then rows */
function csvRows(file, drop = 1) {
  const lines = fs.readFileSync(path.join(SRC, file), "utf8").trim().split(/\r?\n/);
  const head = lines[drop].split(",");
  return lines.slice(drop + 1).map((line) => {
    const o = {};
    line.split(",").forEach((c, i) => (o[head[i]] = c));
    return o;
  });
}
function readCsv(file) {
  const lines = fs.readFileSync(file, "utf8").trim().split(/\r?\n/);
  const head = lines.shift().split(",");
  return { head, rows: lines.map((l) => l.split(",")) };
}
const toRow = (head, obj) => head.map((h) => obj[h]).join(",");
/* up-to-2dp, no trailing zeros, never "-0" */
const fmt = (v) => {
  const r = Math.round(v * 100) / 100;
  return String(r === 0 ? 0 : r);
};
const num = (v) => Number(v);

/* --- TPP by division -------------------------------------------------- */
const tpp = csvRows("HouseTppByDivisionDownload-31496.csv", 1);
if (tpp.length !== 150) throw new Error(`expected 150 divisions, got ${tpp.length}`);

const divFile = path.join(DATA, "all_elections_2PP_by_division.csv");
const divCsv = readCsv(divFile);
if (divCsv.rows.some((r) => r[6] === YEAR)) throw new Error("division CSV already has 2025 rows — aborting");

const divRows = tpp
  .map((r) => {
    const al = num(r["Australian Labor Party Percentage"]);
    const co = num(r["Liberal/National Coalition Percentage"]);
    const sw = num(r.Swing); // labor-direction (AEC Tally Room convention)
    return {
      Division: r.DivisionNm,
      State: r.StateAb,
      Party: r.PartyAb,
      Coalition_2PP_percent: fmt(co),
      Labor_2PP_percent: fmt(al),
      Swing: fmt(-sw),
      Year: YEAR,
      Labor_2PP_minus_Coalition_2PP: fmt(al - co),
      New_swing: fmt(sw),
    };
  })
  .sort((a, b) => a.Division.localeCompare(b.Division));

/* --- TPP by state ------------------------------------------------------ */
const tppState = csvRows("HouseTppByStateDownload-31496.csv", 1);
if (tppState.length !== 8) throw new Error(`expected 8 states, got ${tppState.length}`);
const stateFile = path.join(DATA, "all_elections_2PP_by_state.csv");
const stateCsv = readCsv(stateFile);
if (stateCsv.rows.some((r) => r[3] === YEAR)) throw new Error("state CSV already has 2025 rows — aborting");

const stateRows = tppState.map((r) => {
  const al = num(r["Australian Labor Party Percentage"]);
  const co = num(r["Liberal/National Coalition Percentage"]);
  const sw = num(r.Swing);
  return {
    State: r.StateAb,
    Coalition_2PP_percent: fmt(co),
    Labor_2PP_percent: fmt(al),
    Swing: fmt(-sw),
    Year: YEAR,
    Labor_2PP_minus_Coalition_2PP: fmt(al - co),
    New_swing: fmt(sw),
  };
});

/* --- non-classic 2CP --------------------------------------------------- */
const COALITION = new Set(["LP", "NP", "LNP", "CLP"]);
const MINOR_LABEL = {
  GRN: "Greens",
  IND: "Independent",
  KAP: "Katter's Australian",
  XEN: "Centre Alliance (fmr Nick Xenophon Team)",
  ONP: "Pauline Hanson's One Nation",
  ON: "Pauline Hanson's One Nation",
};
const NC_PARTY_CODE = { XEN: "CA", NP: "NAT" };

const ncList = csvRows("HouseNonClassicDivisionsDownload-31496.csv", 1);
const ncNames = new Set(ncList.map((r) => r.DivisionNm.trim()));

const tcp = csvRows("HouseTcpByCandidateByVoteTypeDownload-31496.csv", 1);
const byDiv = new Map();
for (const r of tcp) {
  const k = r.DivisionNm.trim();
  if (!byDiv.has(k)) byDiv.set(k, []);
  byDiv.get(k).push(r);
}

const members = csvRows("HouseMembersElectedDownload-31496.csv", 1);
const memberParty = new Map(members.map((m) => [m.DivisionNm.trim(), m.PartyAb.trim()]));

const ncFile = path.join(DATA, "nonclassic_2CP_divisions.csv");
const ncCsv = readCsv(ncFile);
if (ncCsv.rows.some((r) => r[1] === YEAR)) throw new Error("nc CSV already has 2025 rows — aborting");

/* existing nc rows keyed by SHORT division name for the repeat-pairing swing rule */
const shortOf = (s) => s.replace(/\s*\(fmr\s+.+?\)\s*$/i, "").trim();
const ncPrev = new Map();
for (const r of ncCsv.rows) {
  if (r[1] === "2022") ncPrev.set(shortOf(r[0]), r); // cols: Division,Year,State,Party,Mine,Major,mPct,MPct,Margin,New_swing
}

const ncRows = [];
for (const name of [...ncNames].sort()) {
  const cands = byDiv.get(name);
  if (!cands || cands.length !== 2) throw new Error(`nc division ${name}: expected 2 TCP candidates, got ${cands?.length}`);
  const [a, b] = cands;
  const minorRow = COALITION.has(a.PartyAb) || a.PartyAb === "ALP" ? b : a;
  const majorRow = minorRow === a ? b : a;
  const minorAb = minorRow.PartyAb.trim();
  const label = MINOR_LABEL[minorAb];
  if (!label) throw new Error(`nc division ${name}: unmapped minor party ${minorAb} — add to MINOR_LABEL and PARTY_COLORS`);
  const majorLabel = majorRow.PartyAb === "ALP" ? "Labor" : "Coalition";
  if (majorRow.PartyAb !== "ALP" && !COALITION.has(majorRow.PartyAb.trim()))
    throw new Error(`nc division ${name}: unexpected major ${majorRow.PartyAb}`);
  const total = num(a.TotalVotes) + num(b.TotalVotes);
  const minorPct = Math.round((num(minorRow.TotalVotes) / total) * 100 * 100) / 100;
  const majorPct = Math.round((100 - minorPct) * 100) / 100;
  const margin = Math.round(((majorLabel === "Coalition" ? minorPct : majorPct) - 50) * 100) / 100;

  let member = memberParty.get(name);
  if (!member) throw new Error(`no elected member for ${name}`);
  member = NC_PARTY_CODE[member] || member;

  let sw = "NaN";
  const prev = ncPrev.get(shortOf(name));
  if (prev && prev[4] === label && prev[5] === majorLabel) {
    sw = fmt(margin - num(prev[8]));
  }

  ncRows.push({
    Division: name,
    Year: YEAR,
    State: a.StateAb,
    Party: member,
    Minor_2CP_party: label,
    Major_2CP_party: majorLabel,
    Minor_2CP_percent: fmt(minorPct),
    Major_2CP_percent: fmt(majorPct),
    Margin: fmt(margin),
    New_swing: sw,
  });
}

/* --- append ------------------------------------------------------------ */
for (const [file, csv, objs] of [
  [divFile, divCsv, divRows],
  [stateFile, stateCsv, stateRows],
  [ncFile, ncCsv, ncRows],
]) {
  const lines = objs.map((o) => toRow(csv.head, o));
  const existing = fs.readFileSync(file, "utf8");
  fs.appendFileSync(file, (existing.endsWith("\n") ? "" : "\n") + lines.join("\n") + "\n");
  console.log(`${path.relative(ROOT, file)}: +${lines.length} rows`);
}

console.log("\nnon-classic 2025 rows (eyeball these):");
for (const r of ncRows)
  console.log(`  ${r.Division.padEnd(14)} ${r.Party.padEnd(4)} ${r.Minor_2CP_party} vs ${r.Major_2CP_party}  ${r.Minor_2CP_percent}/${r.Major_2CP_percent}  M=${r.Margin}  sw=${r.New_swing}`);

const qldLNP = divRows.filter((r) => r.Party === "LNP").length;
console.log(`\nsanity: ${divRows.length} divisions, ${stateRows.length} states, ${ncRows.length} nc rows; QLD LNP TPP-wins=${qldLNP}`);
