#!/usr/bin/env node
/* extract-2025-baseline.mjs — W3 of .build/analysis/seat-model-plan.md.
   Build data/seats-2025-baseline.json: the certified 2025 result per seat —
   candidate-grouped first preferences, TCP pair + votes, TPP, contest type,
   elected member. Every simulation layer hangs off this file.

   Source: AEC event-31496 FinalResults downloads, vendored verbatim under
   atlas/data/aec-2025/ (same inputs as the atlas page's 2025 append).
   First preferences: HouseFirstPrefsByCandidateByVoteTypeDownload (fetched
   2026-10-08); the other four are the atlas's existing copies.

   Grouping (no party-specific hacks): ALP, GRN, ON and the four Coalition
   party codes each keep their own key; any ELECTED member outside those
   groups keeps their own named key (2025: the ten IND crossbenchers plus
   Kennedy's KAP member — the rule absorbs both); everything else is OTH.
   Raw COUNTS, not shares — bases are model-layer business.

   GES invariant (the plan's layer-1 contract) is pinned by
   test-2025-baseline.mjs: the baseline must reproduce the 150/150 elected
   members exactly, or the model does not run.

   Run from the repo root:
     node .build/analysis/seat-model/extract-2025-baseline.mjs
   Then: node .build/analysis/seat-model/test-2025-baseline.mjs   */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

const SRC = "atlas/data/aec-2025";
const FILES = {
  firstPrefs: "HouseFirstPrefsByCandidateByVoteTypeDownload-31496.csv",
  tcp: "HouseTcpByCandidateByVoteTypeDownload-31496.csv",
  tpp: "HouseTppByDivisionDownload-31496.csv",
  nonClassic: "HouseNonClassicDivisionsDownload-31496.csv",
  members: "HouseMembersElectedDownload-31496.csv",
};
const OUT = "data/seats-2025-baseline.json";

const read = (f) => {
  const lines = readFileSync(`${SRC}/${f}`, "utf8").trim().split(/\r?\n/);
  const head = splitRow(lines[1]); // line 0 is the banner, line 1 the header
  return lines.slice(2).map((l) => Object.fromEntries(splitRow(l).map((c, i) => [head[i], c])));
};
/* The downloads are RFC-4180 CSV: party names like
   "Shooters, Fishers and Farmers Party" embed commas. A naive split(",")
   shifts that row's later columns by one and silently misreads its votes. */
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

const prefs = read(FILES.firstPrefs);
const tcp = read(FILES.tcp);
const tpp = read(FILES.tpp);
const nonClassic = new Set(read(FILES.nonClassic).map((r) => r.DivisionId));
const members = read(FILES.members);
const memberById = new Map(members.map((r) => [r.DivisionID, r]));

// Real Informal pseudo-rows (PartyNm "Informal"), not parties.
const candidatesByDiv = new Map();
for (const r of prefs) {
  if (r.PartyNm === "Informal") continue;
  if (!candidatesByDiv.has(r.DivisionID)) candidatesByDiv.set(r.DivisionID, []);
  candidatesByDiv.get(r.DivisionID).push(r);
}

// Named group key for an elected crossbencher outside the named parties.
const holderKey = (r) => `member:${r.Surname.toLowerCase()}`;

const seats = [];
for (const [id, cands] of candidatesByDiv) {
  const m = memberById.get(id);
  if (!m) throw new Error(`no member row for division ${id}`);
  const division = cands[0].DivisionNm, state = cands[0].StateAb;

  const holder = cands.find((c) => c.CandidateID === m.CandidateID);
  const holderNamed = holder && !GROUP_OF[holder.PartyAb];
  const groups = { alp: 0, lp: 0, lnp: 0, np: 0, clp: 0, on: 0, grn: 0, oth: 0 };
  let named = null;
  for (const c of cands) {
    if (holderNamed && c.CandidateID === holder.CandidateID) {
      named = { key: holderKey(c), votes: num(c.TotalVotes) };
      continue;
    }
    groups[GROUP_OF[c.PartyAb] ?? "oth"] += num(c.TotalVotes);
  }
  const formal = Object.values(groups).reduce((a, b) => a + b, 0) + (named?.votes ?? 0);
  if (!formal) throw new Error(`zero formal votes for ${division}`);

  const primaries = named ? { ...groups, [named.key]: named.votes } : groups;
  const informal = num(prefs.find((r) => r.DivisionID === id && r.PartyNm === "Informal")?.TotalVotes);

  const tcpRows = tcp.filter((r) => r.DivisionID === id).filter((r) => r.PartyNm !== "Informal");
  if (tcpRows.length !== 2) throw new Error(`expected 2 TCP rows for ${division}, got ${tcpRows.length}`);
  const tcpLabel = (r) => {
    const c = cands.find((k) => k.CandidateID === r.CandidateID);
    if (holderNamed && c && c.CandidateID === holder.CandidateID) return holderKey(c);
    return GROUP_OF[r.PartyAb] ?? "oth";
  };
  const pair = tcpRows.map((r) => ({ group: tcpLabel(r), votes: num(r.TotalVotes) }));
  const t = tpp.find((r) => r.DivisionID === id);
  if (!t) throw new Error(`no TPP row for ${division}`);

  seats.push({
    name: division, state, aecId: id,
    primaries, formal, informal,
    tcp: { pair, classic: !nonClassic.has(id) },
    tpp: { alp: num(t["Australian Labor Party Votes"]), coalition: num(t["Liberal/National Coalition Votes"]) },
    member: { party: m.PartyAb, group: holderNamed ? holderKey(holder) : (GROUP_OF[m.PartyAb] ?? holderKey(holder)), name: `${m.GivenNm} ${m.Surname[0]}${m.Surname.slice(1).toLowerCase()}` },
  });
}

const ORDER = { NSW: 1, VIC: 2, QLD: 3, SA: 4, WA: 5, TAS: 6, NT: 7, ACT: 8 };
seats.sort((a, b) => ORDER[a.state] - ORDER[b.state] || a.name.localeCompare(b.name));

const out = {
  _about: "W3 of .build/analysis/seat-model-plan.md — certified 2025 House result per seat: candidate-grouped first preferences (alp/lp/lnp/np/clp/on/grn/oth plus a member:<surname> key for any elected crossbencher outside those groups), TCP final pair + votes, TPP (ALP v Coalition), elected member, informal and formal totals. Raw COUNTS; shares are model-layer business. GES invariant pinned by test-2025-baseline.mjs (reproduces 150/150 members; regenerate with .build/analysis/seat-model/extract-2025-baseline.mjs). By-elections/redistributions after 2025 land as a W6 overlay, never here.",
  _provenance: {
    source: "https://results.aec.gov.au/31496/Website/Downloads/",
    dir: SRC,
    files: Object.fromEntries(Object.values(FILES).map((f) => [f, createHash("sha256").update(readFileSync(`${SRC}/${f}`)).digest("hex").slice(0, 16)])),
    extractedAt: new Date().toISOString().slice(0, 10),
  },
  seats,
};
writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n");
console.log(`wrote ${OUT}: ${seats.length} seats (${seats.filter((s) => Object.keys(s.primaries).some((k) => k.startsWith("member:"))).length} named-member seats)`);
