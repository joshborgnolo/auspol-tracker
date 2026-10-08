#!/usr/bin/env node
/* test-2025-baseline.mjs — layer-1 invariant for data/seats-2025-baseline.json.

   The GES contract (seat-model-plan §Architecture.1): the baseline must
   reproduce the real 150/150 2025 result — elected members exact, TCP pair
   exact, TPP within rounding of the AEC file — or the model does not run.

   Run from the repo root: node .build/analysis/seat-model/test-2025-baseline.mjs */
import { readFileSync } from "node:fs";

const BASE = JSON.parse(readFileSync("data/seats-2025-baseline.json", "utf8"));
const seats = BASE.seats;
let failures = 0;
const check = (label, ok, detail = "") => {
  if (!ok) { failures++; console.error(`FAIL ${label}${detail ? " — " + detail : ""}`); }
};

const read = (f) => {
  const lines = readFileSync(`${BASE._provenance.dir}/${f}`, "utf8").trim().split(/\r?\n/);
  const head = splitRow(lines[1]);
  return lines.slice(2).map((l) => Object.fromEntries(splitRow(l).map((c, i) => [head[i], c])));
};
/* The downloads are RFC-4180 CSV ("Shooters, Fishers and Farmers Party"
   embeds commas); a naive split(",") silently misreads those rows. */
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

check("150 seats", seats.length === 150, `got ${seats.length}`);
check("names unique", new Set(seats.map((s) => s.name)).size === 150);
check("aecIds unique", new Set(seats.map((s) => s.aecId)).size === 150);

const EXPECT_STATES = { NSW: 46, VIC: 38, QLD: 30, SA: 10, WA: 16, TAS: 5, NT: 2, ACT: 3 };
const states = {};
for (const s of seats) states[s.state] = (states[s.state] || 0) + 1;
check("state seat counts match the 2025 parliament",
  JSON.stringify(states) === JSON.stringify(EXPECT_STATES), JSON.stringify(states));

const F = BASE._provenance.files;
const members = new Map(read("HouseMembersElectedDownload-31496.csv").map((r) => [r.DivisionID, r]));
const tcpRows = read("HouseTcpByCandidateByVoteTypeDownload-31496.csv");
const tcpByDiv = new Map();
for (const r of tcpRows) {
  if (r.PartyNm === "Informal") continue;
  (tcpByDiv.get(r.DivisionID) ?? tcpByDiv.set(r.DivisionID, []).get(r.DivisionID)).push(r);
}
const tppRows = read("HouseTppByDivisionDownload-31496.csv");
// AEC TPP file rounds percentages to 2dp; vote totals must reconcile exactly.
const tppByDiv = new Map(tppRows.map((r) => [r.DivisionID, r]));
const nonClassic = new Set(read("HouseNonClassicDivisionsDownload-31496.csv").map((r) => r.DivisionId));

let winners = 0, namedSeats = 0;
for (const s of seats) {
  const at = `${s.name} (${s.aecId})`;
  // 1. Every group key is a known party bucket or a member:<surname> key,
  //    primary votes are non-negative, and they sum to the formal total.
  const keys = Object.keys(s.primaries);
  const badKeys = keys.filter((k) => !["alp", "lp", "lnp", "np", "clp", "on", "grn", "oth"].includes(k) && !k.startsWith("member:"));
  check(`only known group keys (${at})`, badKeys.length === 0, badKeys.join(","));
  const primSum = Object.values(s.primaries).reduce((a, b) => a + b, 0);
  check(`primaries sum to formal (${at})`, primSum === s.formal, `${primSum} vs ${s.formal}`);
  check(`primaries non-negative (${at})`, Object.values(s.primaries).every((v) => v >= 0 && Number.isFinite(v)));
  check(`formal + informal >= 0 and informal present (${at})`,
    s.informal >= 0 && Number.isInteger(s.informal));

  // 2. A winner came from the TCP pair and equals the AEC member row.
  const mem = members.get(s.aecId);
  check(`member row exists (${at})`, !!mem);
  if (mem) {
    const tcpWin = s.tcp.pair.reduce((a, b) => (b.votes > a.votes ? b : a));
    const winnerGroup = tcpWin.group;
    const memGroup = mem.PartyAb === s.member.party ? s.member.group : null;
    check(`baseline winner equals AEC member row (${at})`, memGroup === winnerGroup,
      `baseline ${winnerGroup} vs member ${s.member.group}`);
    if (memGroup === winnerGroup) winners++;
    check(`member group matches a primaries key (${at})`, keys.includes(s.member.group), s.member.group);
  }

  // 3. TCP pair + votes reconcile exactly with the AEC TCP download.
  const aecTcp = tcpByDiv.get(s.aecId) ?? [];
  check(`TCP pair has two candidates (${at})`, s.tcp.pair.length === 2 && aecTcp.length === 2,
    `baseline ${s.tcp.pair.length} aec ${aecTcp.length}`);
  const aecVotes = aecTcp.map((r) => Number(r.TotalVotes)).sort((a, b) => b - a);
  const ourVotes = s.tcp.pair.map((p) => p.votes).sort((a, b) => b - a);
  check(`TCP votes match AEC exactly (${at})`,
    aecVotes.length === 2 && ourVotes[0] === aecVotes[0] && ourVotes[1] === aecVotes[1],
    `${ourVotes} vs ${aecVotes}`);
  // TCP vote total + excluded candidates' primaries can't be verified once
  // eliminated, but TCP total must not exceed formal.
  const tcpSum = s.tcp.pair.reduce((a, b) => a + b.votes, 0);
  check(`TCP total <= formal (${at})`, tcpSum <= s.formal, `${tcpSum} vs ${s.formal}`);

  // 4. TPP reconciles exactly with the AEC TPP download.
  const t = tppByDiv.get(s.aecId);
  check(`TPP row exists (${at})`, !!t);
  if (t) {
    check(`TPP ALP votes exact (${at})`, s.tpp.alp === Number(t["Australian Labor Party Votes"]),
      `${s.tpp.alp} vs ${t["Australian Labor Party Votes"]}`);
    check(`TPP Coalition votes exact (${at})`, s.tpp.coalition === Number(t["Liberal/National Coalition Votes"]),
      `${s.tpp.coalition} vs ${t["Liberal/National Coalition Votes"]}`);
    check(`TPP sums to formal (${at})`, s.tpp.alp + s.tpp.coalition === s.formal,
      `${s.tpp.alp + s.tpp.coalition} vs ${s.formal}`);
  }

  // 5. Contest type: classic iff AEC does not list the division as non-classic.
  check(`classic flag matches AEC non-classic list (${at})`, s.tcp.classic === !nonClassic.has(s.aecId));

  if (keys.some((k) => k.startsWith("member:"))) namedSeats++;
}
check("GES invariant: all 150 winners reproduced", winners === 150, `${winners}/150`);
check("named-member seats = 2025 crossbench (12)", namedSeats === 12, `${namedSeats}`);

// Cross-check against the atlas source CSV the site appends 2025 rows to.
const atlas = readFileSync("atlas/data/all_elections_2PP_by_division.csv", "utf8").trim().split(/\r?\n/).slice(1)
  .filter((l) => l.split(",")[6] === "2025");
check("atlas has 150 rows for 2025", atlas.length === 150, `got ${atlas.length}`);
const norm = (s) => s.toLowerCase().replace(/[^a-z]/g, "");
const atlasNames = new Set(atlas.map((l) => norm(l.split(",")[0])));
check("every baseline seat name appears in atlas 2025 rows",
  seats.every((s) => atlasNames.has(norm(s.name))),
  seats.filter((s) => !atlasNames.has(norm(s.name))).map((s) => s.name).join(", "));
for (const row of atlas) {
  const f = row.split(",");
  const seat = seats.find((s) => norm(s.name) === norm(f[0]));
  if (seat) {
    const atlasAlp2pp = Number(f[4]);
    const ours = 100 * seat.tpp.alp / (seat.tpp.alp + seat.tpp.coalition);
    check(`atlas ALP 2PP within 0.06 of baseline (2025 ${seat.name})`,
      Math.abs(atlasAlp2pp - ours) <= 0.06, `atlas ${atlasAlp2pp} ours ${ours.toFixed(3)}`);
  }
}

if (failures) { console.error(`${failures} failures`); process.exit(1); }
console.log(`2025 baseline OK: ${seats.length} seats, ${winners}/150 winners, ${namedSeats} named-member seats`);
