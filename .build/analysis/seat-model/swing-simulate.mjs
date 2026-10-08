#!/usr/bin/env node
/* swing-simulate.mjs — W5 of .build/analysis/seat-model-plan.md, layers 3–5.

   Layer 3 — seat translation. Every seat's 2025 certified group primaries
   (W2 flows file) are moved by
       swing_{seat,party} = Δnat_p(draw) + statedev_{s,p}(draw)
                          + Σ_dims Σ_cells β_{cell,p}(draw)·(X_{seat,cell} − X̄_cell)
                          + residual_{seat,p}(draw)
   with Δ/state-dev/β and their SEs from the W4 vote layer, X from the W1b
   census frame mapped to 2025 boundaries, and residuals as a two-factor
   draw (state component SIG_STATE + seat component SIG_SEAT — declared
   structural constants, not fitted: two elections of seat swings is not
   enough to estimate them and the plan's holdout gate is where they get
   tested). The swing hits each group as PROP_MIX proportional-of-national
   + (1−PROP_MIX) additive (poliwave's mix — zero floor, surge headroom),
   groups mapped to the 5-key swing space (Coalition parties → lnp, named
   members → oth); the seat's vector is floored at 0 and renormalised to
   100. Incumbency is a slot set to INCUMBENCY_PP = 0 — there is one
   election of data here and nothing to estimate it from; the constant
   exists so a later workstream changes one line, not the equation.

   Layer 4 — preferences. Full per-seat elimination every draw (theswingison
   rule: never assume the final pair). Each exclusion uses the seat's own
   2025 certified group→group flow matrix (W2 `groups`, counts), Dirichlet
   drawn per draw with the certified counts as concentrations (no drift —
   a drift parameter needs an election-to-election calibration we do not
   have; named in HARD LIMITS). Groups contesting in 2028 but absent from a
   seat in 2025 (ONE NATION in the three ACT seats, per the W6 candidate
   set's run-everywhere assumption) have no seat flow row: the national
   aggregate row for their group substitutes, and 2025 receiver rows in
   those seats never name them — both facts documented in _about.

   Layer 5 — Monte Carlo. DRAWS independent elections: national level per
   party ~ N(Δnat, σ_poll²) with σ_poll measured from the per-poll primary
   dispersion in polls.json over the vote layer's own 60-day window
   (systematic + spread, honestly small-sample); the rest per layer 3.
   National seats histogram, majority probabilities, per-seat win
   probabilities, final-pair tallies, classic-final 2PP (output of the
   elimination, per the plan — coverage-counted because an ALP v ON final
   has no Coalition 2PP).

   AUSPOL_SIM_NULL=1: null mode — zero swing, zero residuals, flows at their
   certified rows exactly. Must reproduce all 150 2025 winners (the GES
   invariant from W3, exercised through the elimination engine); the test
   runs this. AUSPOL_SIM_OUT=<path>: override the output path (null mode
   writes to a temp file, never over data/seat-model-2028-nowcast.json).

   Output: data/seat-model-2028-nowcast.json + appended per-date record in
   data/seat-model-2028-history.jsonl. Test: test-swing-simulate.mjs.
   Stage-1: no site files, no workflow wiring. */

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, appendFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/* draw count: 20k for the committed nowcast; the null-replay invariant is
   draw-deterministic, so the test runs it small via AUSPOL_SIM_DRAWS */
const DRAWS = +(process.env.AUSPOL_SIM_DRAWS || 20000);
const SEED = 20261008;
const PROP_MIX = 0.5;
const INCUMBENCY_PP = 0;      // slot — see header
const SIG_SEAT = 2.0, SIG_STATE = 1.5;
const FLOW_DRIFT = 0;         // no calibration exists yet — see header
const WINDOW_DAYS = 60;       // matches vote-layer RECENT_DAYS
const NULL_MODE = process.env.AUSPOL_SIM_NULL === "1";
/* null mode's replay can never be allowed to overwrite the committed nowcast */
const OUT_PATH = process.env.AUSPOL_SIM_OUT ||
  (NULL_MODE ? join(tmpdir(), "auspol-sim-null.json") : "data/seat-model-2028-nowcast.json");
const HISTORY_PATH = "data/seat-model-2028-history.jsonl";
const P5 = ["alp", "lnp", "on", "grn", "oth"];
const COAL = ["lp", "lnp", "np", "clp"];
const swingKeyOf = (g) => g === "alp" ? "alp" : COAL.includes(g) ? "lnp" : g === "on" ? "on" : g === "grn" ? "grn" : "oth";
const r2 = (x) => Math.round(x * 100) / 100;
const r4 = (x) => Math.round(x * 10000) / 10000;
const day = 86400000;
const sha16 = (f) => createHash("sha256").update(readFileSync(f)).digest("hex").slice(0, 16);

/* seeded PRNG (mulberry32) + Box–Muller + gamma (Marsaglia–Tsang) */
let _u = SEED >>> 0;
const u01 = () => { _u = (_u + 0x6D2B79F5) >>> 0; let t = _u; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= (t + Math.imul(t ^ (t >>> 7), t | 61)) >>> 0; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const nnorm = () => { const u = Math.max(u01(), 1e-12); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * u01()); };
function gamma(shape) {
  if (shape < 1) return gamma(shape + 1) * Math.pow(u01(), 1 / shape);
  const d = shape - 1 / 3, c = 1 / Math.sqrt(9 * d);
  for (;;) {
    const x = nnorm(), v = Math.pow(1 + c * x, 3);
    if (v <= 0) continue;
    if (Math.log(u01()) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}
const dirichlet = (counts) => {
  const gs = counts.map((c) => c > 0 ? gamma(c * (1 - FLOW_DRIFT) + FLOW_DRIFT) : 0);
  const s = gs.reduce((a, b) => a + b, 0) || 1;
  return gs.map((g) => g / s);
};

const VOTE = JSON.parse(readFileSync("data/seat-vote-layer.json", "utf8"));
const FLOWS = JSON.parse(readFileSync("data/aec-2025-seat-flows.json", "utf8"));
const CAND = JSON.parse(readFileSync("data/seat-candidate-set-2028.json", "utf8"));
const CENSUS = JSON.parse(readFileSync("data/census-2021-divisions-2025.json", "utf8"));
const POLLS = JSON.parse(readFileSync("data/polls.json", "utf8"));

const flowsBy = new Map(FLOWS.seats.map((s) => [s.name, s]));
const candBy = new Map(CAND.seats.map((s) => [s.name, s]));
const censusBy = new Map(CENSUS.divisions.map((d) => [d.name, d]));

/* per-seat 2028 groups from the W6 contest declaration */
const seatGroups = (cs) => {
  const g = [];
  if (cs.contest.alp) g.push("alp");
  for (const c of cs.contest.coalition) g.push(c);
  if (cs.contest.on) g.push("on");
  if (cs.contest.grn) g.push("grn");
  for (const i of cs.contest.ind) if (i.kind === "held") g.push(i.key);
  if (cs.contest.othCount2025 > 0) g.push("oth");
  return g;
};

/* group-level 2025 primaries per seat (0-100 shares of formal) +
   candidate-level certified votes (the elimination runs per CANDIDATE, like
   the real count and the W2 extractor's own replay — group-collapse
   mis-orders exclusions wherever two "oth" independents matter) */
const seatBase = {}, seatCandVotes = {};
for (const s of FLOWS.seats) {
  const total = s.candidates.reduce((a, c) => a + c.votes, 0);
  const by = {};
  for (const c of s.candidates) by[c.group] = (by[c.group] || 0) + c.votes;
  seatBase[s.name] = Object.fromEntries(Object.entries(by).map(([g, v]) => [g, 100 * v / total]));
  seatCandVotes[s.name] = s.candidates.map((c) => ({ id: String(c.id), group: c.group, votes: c.votes }));
}

/* candidate-level certified exclusion rows: excludedId → { receiverId: votes } */
const seatFlows = {};
for (const s of FLOWS.seats) {
  const ids = s.candidates.map((c) => String(c.id));
  seatFlows[s.name] = new Map(s.flows.map((f) => [ids[f.excluded],
    Object.fromEntries(Object.entries(f.to).map(([k, v]) => [ids[+k], v]))]));
}

/* national aggregate exclusion row per group (fallback for new groups) */
const natFlows = {};
for (const s of FLOWS.seats) for (const [g, row] of Object.entries(s.groups)) {
  natFlows[g] ??= {};
  for (const [h, v] of Object.entries(row)) natFlows[g][h] = (natFlows[g][h] || 0) + v;
}

/* census X per seat in the vote layer's cells */
const W = VOTE.beta.populationWeights;
const seatX = {};
for (const d of CENSUS.divisions) {
  const a = d.ageCounts;
  const a1834 = 0.4 * a["15_19"] + a["20_24"] + a["25_34"];
  const a3554 = a["35_44"] + a["45_54"];
  const a55 = a["55_64"] + a["65_74"] + a["75_84"] + a["85ov"];
  const tot = a1834 + a3554 + a55;
  seatX[d.name] = {
    age: { "18–34": a1834 / tot, "35–54": a3554 / tot, "55+": a55 / tot },
    gender: { Men: d.gender.m / (d.gender.m + d.gender.f), Women: d.gender.f / (d.gender.m + d.gender.f) },
  };
}

/* national level σ per party from per-poll dispersion in the window */
const latestPoll = POLLS.polls.reduce((m, r) => r.date > m ? r.date : m, "");
const winFrom = new Date(new Date(latestPoll).getTime() - WINDOW_DAYS * day).toISOString().slice(0, 10);
const recent = POLLS.polls.filter((r) => r.date >= winFrom);
const stdv = (xs) => { const m = xs.reduce((a, b) => a + b, 0) / xs.length; return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length); };
const sigmaNat = {
  alp: stdv(recent.map((r) => r.alp).filter((v) => v != null)),
  lnp: stdv(recent.map((r) => r.lnp).filter((v) => v != null)),
  on: stdv(recent.map((r) => r.onp).filter((v) => v != null)),
  grn: stdv(recent.map((r) => r.grn).filter((v) => v != null)),
  oth: stdv(recent.filter((r) => r.oth != null || r.ind != null).map((r) => (r.oth || 0) + (r.ind || 0))),
};

const natBase2025 = VOTE.national.result2025;
const seats = CAND.seats.map((cs) => {
  const certified = seatCandVotes[cs.name];           // 2025 certified field
  const want2028 = new Set(seatGroups(cs));           // W6 contest declaration
  // null mode replays the 2025 field exactly; sim mode runs the 2028 field
  // (identical today except ONE NATION added in the three ACT seats).
  const ids = NULL_MODE
    ? certified.map((c) => ({ id: c.id, group: c.group }))
    : [
      ...certified.filter((c) => want2028.has(c.group)),
      ...(want2028.has("on") && !certified.some((c) => c.group === "on") ? [{ id: "syn-on", group: "on" }] : []),
      ...cs.contest.ind.filter((i) => i.kind !== "held").map((i, k) => ({ id: "syn-ind-" + k, group: "ind-declared" })),
    ];
  return {
    name: cs.name, state: cs.state,
    candidates: ids,
    baseGroups: seatBase[cs.name],                    // group → certified share
    candVotes: Object.fromEntries(certified.map((c) => [c.id, c.votes])),
    groupsPresent2025: new Set(certified.map((c) => c.group)),
    flows: seatFlows[cs.name],                        // excludedId → {receiverId: votes}
    x: seatX[cs.name],
    // null mode replays the certified field exactly, swing-loop included
    groups: NULL_MODE ? [...new Set(certified.map((c) => c.group))] : [...want2028],
  };
});

/* ---- one simulated election -------------------------------------------- */
function simulate() {
  const nat = Object.fromEntries(P5.map((p) => [p, NULL_MODE ? VOTE.national.delta[p] : VOTE.national.delta[p] + nnorm() * sigmaNat[p]]));
  const sdev = {};
  for (const st of Object.keys(VOTE.states.dev)) sdev[st] = Object.fromEntries(P5.map((p) => {
    const d = VOTE.states.dev[st]?.[p];
    return [p, NULL_MODE || !d ? d ? d.dev : 0 : d.dev + nnorm() * d.se];
  }));
  const beta = {};
  for (const [dim, cells] of Object.entries(VOTE.beta.dims)) {
    beta[dim] = {};
    for (const [cell, m] of Object.entries(cells)) beta[dim][cell] = Object.fromEntries(P5.map((p) => [p, NULL_MODE ? 0 : m[p].beta + nnorm() * m[p].se]));
  }
  const stateShock = {};
  for (const st of Object.keys(VOTE.states.weights)) stateShock[st] = NULL_MODE ? Object.fromEntries(P5.map((p) => [p, 0])) : Object.fromEntries(P5.map((p) => [p, nnorm() * SIG_STATE]));
  if (NULL_MODE) for (const p of P5) nat[p] = 0, sdev && Object.keys(sdev).forEach((st) => sdev[st][p] = 0);

  const winners = {}, finals = {}, tcpAlp = [];
  for (const seat of seats) {
    /* layer 3 perturbation */
    const pert = {};
    for (const g of seat.groups) {
      const P = swingKeyOf(g);
      let sw = nat[P] + (sdev[seat.state][P] || 0);
      for (const dim of ["age", "gender"]) for (const cell of Object.keys(VOTE.beta.populationWeights[dim]))
        sw += beta[dim][cell][P] * (seat.x[dim][cell] - VOTE.beta.populationWeights[dim][cell]);
      sw += INCUMBENCY_PP * 0 + stateShock[seat.state][P] + (NULL_MODE ? 0 : nnorm() * SIG_SEAT);
      const baseG = seat.baseGroups[g] || 0;
      const inSeat = seat.groups.filter((h) => swingKeyOf(h) === P);
      const baseP = inSeat.reduce((s, h) => s + (seat.baseGroups[h] || 0), 0);
      const shareOfP = baseP > 0 ? baseG / baseP : (inSeat[0] === g ? 1 : 0);
      const v = baseG * (1 + PROP_MIX * sw / Math.max(natBase2025[P], 0.5)) + (1 - PROP_MIX) * sw * shareOfP;
      pert[g] = Math.max(0, v);
    }
    const sumP = Object.values(pert).reduce((a, b) => a + b, 0) || 1;
    const gVotes = Object.fromEntries(Object.entries(pert).map(([g, v]) => [g, 100 * v / sumP]));

    /* spread each group's perturbed share over its candidates by certified
       within-group vote shares (a synthetic candidate is its group's only
       candidate, so it takes the lot) */
    const votes = {};
    for (const c of seat.candidates) {
      const mates = seat.candidates.filter((d) => d.group === c.group);
      const certSum = mates.reduce((s, d) => s + (seat.candVotes[d.id] || 0), 0);
      const share = mates.length === 1 ? 1 : (certSum > 0 ? (seat.candVotes[c.id] || 0) / certSum : 1 / mates.length);
      votes[c.id] = (gVotes[c.group] || 0) * share;
    }

    /* layer 4 elimination, per candidate: lowest goes, pile re-dealt by that
       candidate's certified count row (renormalised over whoever is standing) */
    const standing = Object.fromEntries(Object.entries(votes));
    const groupOf = Object.fromEntries(seat.candidates.map((c) => [c.id, c.group]));
    while (Object.keys(standing).length > 2) {
      const excl = Object.entries(standing).sort((a, b) => a[1] - b[1] || (u01() - 0.5))[0][0];
      const pile = standing[excl];
      delete standing[excl];
      const keys = Object.keys(standing);
      let counts = keys.map((k) => seat.flows.get(excl)?.[k] || 0);
      if (counts.reduce((a, b) => a + b, 0) === 0) {
        // no usable certified row (synthetic candidate, or every receiver
        // already out): national group row, split within group by votes
        const grow = natFlows[groupOf[excl]] || {};
        counts = keys.map((k) => {
          const others = keys.filter((d) => groupOf[d] === groupOf[k]);
          const gsum = others.reduce((s, d) => s + standing[d], 0) || 1;
          return (grow[groupOf[k]] || 0) * standing[k] / gsum;
        });
      }
      if (counts.reduce((a, b) => a + b, 0) === 0) counts = keys.map(() => 1);
      const shares = NULL_MODE ? counts.map((c) => c) : dirichlet(counts);
      const ss = shares.reduce((a, b) => a + b, 0) || 1;
      keys.forEach((k, i) => { standing[k] += pile * shares[i] / ss; });
    }
    const finIds = Object.keys(standing);
    const fin = finIds.map((id) => groupOf[id]).sort();
    const winner = finIds.slice().sort((a, b) => standing[b] - standing[a])[0];
    const wg = groupOf[winner];
    winners[seat.name] = wg;
    const gSum = finIds.reduce((s, id) => s + standing[id], 0);
    finals[seat.name] = { pair: fin, shares: Object.fromEntries(finIds.map((id) => [groupOf[id], r2(100 * standing[id] / gSum)])) };
    if (fin.includes("alp") && fin.some((g) => COAL.includes(g))) {
      const gTally = {};
      for (const id of finIds) gTally[groupOf[id]] = (gTally[groupOf[id]] || 0) + standing[id];
      const coal = COAL.reduce((s, g) => s + (gTally[g] || 0), 0);
      tcpAlp.push(100 * (gTally.alp || 0) / ((gTally.alp || 0) + coal));
    }
  }
  return { winners, finals, tcpAlp };
}

/* ---- DRAWS elections ----------------------------------------------------- */
const t0 = Date.now();
const seatWin = {}, seatFinal = {}, seatVote = {};
for (const s of seats) { seatWin[s.name] = {}; seatVote[s.name] = Object.fromEntries(s.groups.map((g) => [g, 0])); seatFinal[s.name] = {}; }
const groupSeats = Object.fromEntries([...P5, "member"].map((g) => [g, 0]));
let majority = { alp: 0, coalition: 0, none: 0 };
const tcpSamples = [];
const groupCode = (g) => g === "alp" ? "alp" : COAL.includes(g) ? "lnp" : g === "on" ? "on" : g === "grn" ? "grn" : g.startsWith("member:") ? "member" : "oth";

for (let d = 0; d < DRAWS; d++) {
  const sim = simulate();
  const tally = Object.fromEntries([...P5, "member"].map((g) => [g, 0]));
  for (const s of seats) {
    const w = sim.winners[s.name];
    seatWin[s.name][w] = (seatWin[s.name][w] || 0) + 1;
    const pk = sim.finals[s.name].pair.join("|");
    seatFinal[s.name][pk] = (seatFinal[s.name][pk] || 0) + 1;
    tally[groupCode(w)]++;
  }
  for (const g of Object.keys(tally)) groupSeats[g] += tally[g];
  if (tally.alp >= 76) majority.alp++; if (tally.lnp >= 76) majority.coalition++;
  if (tally.alp < 76 && tally.lnp < 76) majority.none++;
  tcpSamples.push(sim.tcpAlp.length ? sim.tcpAlp.reduce((a, b) => a + b, 0) / sim.tcpAlp.length : null);
}

const pct = (xs, q) => { const s = xs.slice().sort((a, b) => a - b); return s[Math.floor(q * (s.length - 1))]; };
const tcpVals = tcpSamples.filter((v) => v != null);
const expected = Object.fromEntries(Object.entries(groupSeats).map(([g, t]) => [g, r2(t / DRAWS)]));
const out = {
  _about: "W5 of .build/analysis/seat-model-plan.md — swing + simulation engine (layers 3–5). 20,000 simulated elections off the W4 vote layer (Δnat, state deviations, age/gender β), the W2 certified 2025 per-seat flow matrices (Dirichlet-drawn at count scale, drift 0), the W6 2028 candidate set and the W1b census demographics on 2025 boundaries. HARD LIMITS: structural constants (PROP_MIX 0.5, seat residual 2.0 + state 1.5 pp, incumbency 0) are declared, not fitted — the holdout gate (plan §Validation.3) is where they earn their keep; One Nation in Bean/Canberra/Fenner runs on a national flow row and never receives transfers modelled from 2025 ACT rows (none name ON); flows are 2025-anchored; marginals only. Seat residuals are model, not measurement. Intervals are floor, not ceiling.",
  _provenance: {
    generated: new Date().toISOString().slice(0, 10),
    inputs: Object.fromEntries(["data/seat-vote-layer.json", "data/aec-2025-seat-flows.json", "data/seat-candidate-set-2028.json", "data/census-2021-divisions-2025.json", "data/polls.json"].map((f) => [f, sha16(f)])),
  },
  meta: { draws: DRAWS, seed: SEED, propMix: PROP_MIX, incumbencyPP: INCUMBENCY_PP, sigSeat: SIG_SEAT, sigState: SIG_STATE, flowDrift: FLOW_DRIFT, windowDays: WINDOW_DAYS, sigmaNat: Object.fromEntries(Object.entries(sigmaNat).map(([k, v]) => [k, r2(v)])), windowFrom: winFrom, latestPoll, runtimeMs: Date.now() - t0 },
  national: {
    expectedSeats: expected,
    majority: { alp: r4(majority.alp / DRAWS), coalition: r4(majority.coalition / DRAWS), noMajority: r4(majority.none / DRAWS) },
    twoPartyClassic: { meanAlp: r2(tcpVals.reduce((a, b) => a + b, 0) / tcpVals.length), p10: r2(pct(tcpVals, 0.1)), p90: r2(pct(tcpVals, 0.9)), coverage: r2(100 * (tcpSamples.filter((v, i) => v != null).length ? tcpVals.length / 1 : 0) / DRAWS), note: "mean over classic-final seats within each draw; coverage = mean share of DRAWS where ≥1 classic final exists" },
  },
  seats: seats.map((s) => ({
    name: s.name, state: s.state,
    win: Object.fromEntries(Object.entries(seatWin[s.name]).map(([g, n]) => [g, r4(n / DRAWS)]).sort((a, b) => b[1] - a[1])),
    finalPairs: Object.fromEntries(Object.entries(seatFinal[s.name]).map(([k, n]) => [k, r4(n / DRAWS)]).sort((a, b) => b[1] - a[1])),
  })),
};
writeFileSync(OUT_PATH, JSON.stringify(out, null, 1) + "\n");
if (!NULL_MODE) {
  // prediction-history pattern: one record per window-end date — a same-day
  // re-run appends nothing, a new polling day appends one line.
  const rec = {
    date: VOTE.diagnostics.recentWindow.to,
    expectedSeats: expected,
    majority: out.national.majority,
    seats: outSeatsWinners(),
  };
  const existing = existsSync(HISTORY_PATH) ? readFileSync(HISTORY_PATH, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [];
  if (!existing.some((r) => r.date === rec.date)) appendFileSync(HISTORY_PATH, JSON.stringify(rec) + "\n");
}
function outSeatsWinners() {
  const o = {};
  for (const [name, w] of Object.entries(seatWin)) {
    const top = Object.entries(w).sort((a, b) => b[1] - a[1])[0];
    o[name] = [top[0], r4(top[1] / DRAWS)];
  }
  return o;
}

console.log(`W5 swing+simulation — ${DRAWS.toLocaleString()} draws, window ${winFrom}→${latestPoll}\n`);
console.log("expected seats (5-key space): " + Object.entries(expected).map(([g, v]) => `${g} ${v}`).join("  "));
console.log(`majority: ALP ${(100 * majority.alp / DRAWS).toFixed(1)}% · Coalition ${(100 * majority.coalition / DRAWS).toFixed(1)}% · none ${(100 * majority.none / DRAWS).toFixed(1)}%`);
console.log(`classic 2PP (coverage-limited): ALP ${out.national.twoPartyClassic.meanAlp}% [${out.national.twoPartyClassic.p10}–${out.national.twoPartyClassic.p90}]`);
const onWins = Object.entries(seatWin).filter(([, w]) => w.on).sort((a, b) => b[1].on - a[1].on).slice(0, 12);
if (onWins.length) console.log("\nON seat prospects: " + onWins.map(([n, w]) => `${n} ${(100 * w.on / DRAWS).toFixed(0)}%`).join(" · "));
if (NULL_MODE) {
  const base2 = JSON.parse(readFileSync("data/seats-2025-baseline.json", "utf8"));
  const miss = base2.seats.filter((b) => {
    const g = b.member.group === "member" ? `member:${b.member.name.toLowerCase().split(" ").pop()}` : b.member.group;
    return Object.entries(seatWin[b.name]).sort((a, c) => c[1] - a[1])[0][0] !== g;
  }).map((b) => b.name);
  console.log(`\nNULL MODE — 2025 winners reproduced: ${150 - miss.length}/150${miss.length ? " — misses: " + miss.join(", ") : ""}`);
} else {
  console.log(`\nwrote ${OUT_PATH}${existsSync(HISTORY_PATH) ? ", history appended" : ""} (${Date.now() - t0}ms)`);
}
