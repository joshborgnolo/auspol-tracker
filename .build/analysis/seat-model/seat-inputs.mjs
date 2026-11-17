/* seat-inputs.mjs: node side of the seat build - reads the committed stores and prepares the 2028 seat
   skeleton that seat-build.mjs (pure, shared with the /model/ page) turns into countable seats.
   prepInputs() is also what swing-simulate.mjs writes out as the page's model/data/inputs.json. */
import { readFileSync } from "node:fs";
import { cohortTable, pairShare, cohortKeyFor, FAM_OF_GROUP } from "./senate-flows.mjs";
import { loadRankings } from "./senate-io.mjs";
import { FLOW_CLASSES, P5, OWN_SIDE } from "./seat-engine.mjs";
import { settings, calibratedTable, flowClassOf, P5_OF, buildSeatsFrom, seatGroups, LEVERS, leverLevels, solveLevel } from "./seat-build.mjs";
import { FP_ON, FLOW } from "../../newtracker/flows.mjs";
import { loadHistory, historyRows, stage1Residuals, personKey } from "./swing-fit.mjs";
import { IND_K, slotTables } from "./independents.mjs";
export { settings, calibratedTable, flowClassOf, P5_OF, buildSeatsFrom, LEVERS, leverLevels };

const J = (f) => JSON.parse(readFileSync(f, "utf8"));
const logit = (p) => Math.log(p / (1 - p));
const clamp = (p) => Math.min(0.995, Math.max(0.005, p));

export function prepInputs({ year = 2025, composition = true, replay = false, root = ".", targets = null } = {}) {
  const FLOWS = J(`${root}/data/aec-2025-seat-flows.json`);
  const CAND = J(`${root}/data/seat-candidate-set-2028.json`);
  const RES = J(`${root}/map/data/res-2025.json`);
  const FCAL = J(`${root}/data/seat-model-flow-calibration.json`);
  const SW = J(`${root}/data/vote-switching.json`);
  const VOTE = J(`${root}/data/seat-vote-layer.json`);
  const CENSUS = J(`${root}/data/census-2021-divisions-2025.json`);
  const SEN = loadRankings(year, root);
  const ST = settings(FCAL);
  const resBy = new Map(RES.divs.map((d) => [d.n, d]));
  const flowsBy = new Map(FLOWS.seats.map((s) => [s.name, s]));
  const censusBy = new Map(CENSUS.divisions.map((d) => [d.name, d]));

  /* One Nation's 2025-style base where it did not stand (the ACT): ridge on demographics, as E9 */
  const DK = ["uni", "y12less", "blue", "a65", "a2034", "lang", "atsci"];
  const xOf = (d) => [...DK.map((k) => d.demo?.[k] ?? 0), d.demo?.rel?.norel ?? 0, d.demo?.ten?.own ?? 0];
  const onShare = (d) => { const t = d.c.reduce((a, c) => a + c[4], 0); return d.c.filter((c) => c[3] === "onp").reduce((a, c) => a + c[4], 0) / t; };
  const fitRows = RES.divs.filter((d) => onShare(d) > 0.005);
  const onBase = ridgePredict(fitRows.map(xOf), fitRows.map((d) => logit(onShare(d))), 3);

  const hist = process.env.AUSPOL_SIM_NOHIST === "1" ? { bySeat: {}, mean: {} } : houseHistory(RES, SEN);

  /* seat terms of the logit swing (calibrate-swing.mjs, fitted on 1996-2025): the sitting member's personal
     vote (gained where the party's 2028 candidate is the seat's member, lost where its 2025 candidate was the
     sitting member and no longer is), defections, and the share of each seat's 2025 surprise carried forward.
     Offsets on the logit scale, per candidate (c.adj); none in the 2025 replay. */
  const TERMS = replay || process.env.AUSPOL_SIM_NOTERMS === "1" ? null : J(`${root}/data/seat-model-calibration.json`).swing?.terms || null;
  let s1 = null, INC25 = null;
  if (TERMS) { const H = loadHistory(root, [2022, 2025]); s1 = stage1Residuals(historyRows(H), [2025], TERMS); INC25 = H.INC[2025]; }
  /* Who sits now is the candidate set's `incumbent` (data/seat-candidate-set-2028.json: the 2025 member unless a
     by-election or a change of party since is on the record); a member counts as standing only where
     `recontests` is true - a member who has changed party and not said (null) gives the new party no
     sitting-member term and the old one no defection term, only the loss of its member.
     One Nation has no sitting-member record of its own (its one House member won Farrer at the 2026
     by-election): its sitting member takes the two major parties' average personal vote, as the Greens'
     do (swing-fit.mjs), and nothing else. */
  const TERMS_ON = TERMS?.alp && TERMS?.lnp ? { incE: (TERMS.alp.incE + TERMS.lnp.incE) / 2, incP: 0, defect: 0, rho: 0 } : null;
  const FAM_TERMS = (g) => (g === "alp" ? "alp" : ["lp", "np", "lnp", "clp"].includes(g) ? "lnp" : g === "grn" ? "grn" : g === "on" ? "on" : null);
  const RES_B = { alp: "alp", lnp: "lnp", grn: "grn", on: "onp" };
  const adjFor = (cs, D, group) => {
    const b = FAM_TERMS(group), t = !TERMS || !b ? null : b === "on" ? TERMS_ON : TERMS[b]; if (!t) return 0;
    const inc = INC25[D.n], rb = RES_B[b], I = cs.incumbent, ig = I?.group, stands = I?.recontests === true;
    const incP = D.c.some((c, i) => c[3] === rb && inc.sit[i] === 1) ? 1 : 0;          // 2025: its candidate was the sitting member
    const incE = stands && FAM_TERMS(ig) === b ? 1 : 0;                                // 2028: its candidate is
    let defect = 0;                                                                    // its 2025 sitting member stands here for someone else
    if (stands && I.name && FAM_TERMS(ig) !== b) D.c.forEach((c, i) => { if (c[3] === rb && inc.sit[i] === 1 && personKey(D.st, c[0]) === personKey(D.st, I.name)) defect = 1; });
    const prevE = b === "on" ? 0 : s1.get("2025|" + D.n + "|" + b) ?? 0;
    return t.incE * incE + t.incP * incP + t.defect * defect + t.rho * prevE;
  };
  /* independents drawn from the record (independents.mjs; none in the 2025 replay) */
  const IREC = replay || process.env.AUSPOL_SIM_NOIND === "1" ? null : J(`${root}/data/seat-model-independents.json`);
  const slots = [];
  const comp = composition ? switching(SW, J(`${root}/data/polls.json`)) : null;
  const VSON = vsOneNation(J(`${root}/map/data/data-now.json`));
  const { capNat, capBySeat, sibBySeat, capX, xSeat } = certifiedShares(FLOWS, VSON);
  ST.iotaX = { own: capX.own, cross: capX.cross, sib: capX.sib };   // the national table: every seat without a count of its own
  const PW = VOTE.beta.populationWeights;

  const seats = [];
  for (const cs of CAND.seats) {
    const F = flowsBy.get(cs.name), D = resBy.get(cs.name);
    const want = replay ? new Set(F.candidates.map((c) => c.group)) : new Set(seatGroups(cs));
    const total = F.candidates.reduce((a, c) => a + c.votes, 0);
    const pnameBy = new Map(D.c.map((c) => [c[0], c[2]]));
    const cands = F.candidates.filter((c) => want.has(c.group)).map((c) => ({
      label: c.name, group: c.group, party: c.party, partyName: pnameBy.get(c.name) || c.party, base: c.votes / total }));
    if (!replay && want.has("on") && !cands.some((c) => c.group === "on")) cands.push({ label: "One Nation (assumed)", group: "on", party: "ON", partyName: "Pauline Hanson's One Nation", base: 1 / (1 + Math.exp(-onBase(xOf(D)))) });
    if (!replay) for (const i of cs.contest.ind.filter((i) => i.kind !== "held")) cands.push({ label: i.label, group: "ind-declared", party: "IND", partyName: "Independent", base: 0.08 });
    /* a sitting independent moves by sitting independents' own record; a seat a party holds gets one
       independent challenge drawn from the record - standing in for 2025's strongest independent where that
       candidate polled `replace` or more, added to the field where none did */
    let chal = null;
    // the replay counts 2025 as it was fought: its strongest independents were independents, taking
    // preferences as one does (2025's field stands, so nothing is drawn)
    if (replay && !cands.some((c) => c.group.startsWith("member"))) {
      const top = cands.filter((c) => c.party === "IND" && c.group === "oth").sort((a, b) => b.base - a.base)[0];
      if (top && top.base >= IND_K.replace) top.challenger = true;
    }
    if (IREC) {
      const sitting = cands.filter((c) => c.group.startsWith("member"));
      for (const c of sitting) c.free = { drift: IREC.now.sitting.mean, sig: IREC.now.sitting.sig };
      if (!sitting.length) {
        const top = F.candidates.filter((c) => c.party === "IND" && c.group === "oth").sort((a, b) => b.votes - a.votes)[0];
        const tp = top ? top.votes / total : 0, stands = tp >= IND_K.replace;
        if (stands) { const at = cands.findIndex((c) => c.label === top.name && c.group === "oth"); if (at < 0) throw new Error(`${cs.name}: ${top.name} is not in the 2028 field to stand in for`); cands.splice(at, 1); }
        chal = { label: "Independent", group: "member:challenge", party: "IND", partyName: "Independent", base: stands ? tp : 1e-4, free: true, was: top && tp >= 0.005 ? { name: top.name, share: Math.round(tp * 1e4) / 1e4 } : null };
        cands.push(chal); slots.push({ name: cs.name, tp, c: chal });
      }
    }
    for (const c of cands) {
      const a = adjFor(cs, D, c.group); if (a) c.adj = Math.round(a * 1e4) / 1e4;
      c.p5 = P5_OF(c.group);
      c.fam = FAM_OF_GROUP[c.group] ?? -1;
      c.isInd = c.group.startsWith("member") || c.group === "ind-declared" || !!c.challenger;
      c.key = cohortKeyFor(c);
      c.cls = flowClassOf(c.key);
      c.clsIdx = FLOW_CLASSES.indexOf(c.cls);
    }
    // the vote layer's age/gender differential (points per party) for this seat's census mix
    const d = censusBy.get(cs.name);
    let demoPP = [0, 0, 0, 0, 0];
    if (d) {
      const a = d.ageCounts, a1834 = 0.4 * a["15_19"] + a["20_24"] + a["25_34"], a3554 = a["35_44"] + a["45_54"], a55 = a["55_64"] + a["65_74"] + a["75_84"] + a["85ov"], t = a1834 + a3554 + a55;
      const X = { age: { "18–34": a1834 / t, "35–54": a3554 / t, "55+": a55 / t }, gender: { Men: d.gender.m / (d.gender.m + d.gender.f), Women: d.gender.f / (d.gender.m + d.gender.f) } };
      demoPP = P5.map((p) => { let v = 0; for (const dim of ["age", "gender"]) for (const cell of Object.keys(PW[dim])) v += VOTE.beta.dims[dim][cell][p].beta * (X[dim][cell] - PW[dim][cell]); return v; });
    }
    // what an independent standing here takes of each transferring pile (certifiedShares): by who else is left
    // (iotaX), from the seat's own 2025 count where its member - or its strongest independent of 5% or more -
    // was there to receive it, else the national figure
    const cap = capBySeat[cs.name] || {}, capDef = capNat;
    const won = D.c.find((c) => c[6] === 1), I = cs.incumbent;
    const won2025 = { name: won ? won[0] : null, party: won ? won[2] : null, group: won ? groupOfRes(won) : null };
    seats.push({
      name: cs.name, st: cs.state, cls: D.cls, w: total, uni: D.demo?.uni ?? null, demoPP,
      cands, iota: Object.fromEntries(FLOW_CLASSES.map((k) => [k, cap[k] ?? capDef[k] ?? capDef._])), ...(xSeat(cs.name) ? { iotaX: xSeat(cs.name) } : {}),
      sib: sibBySeat[cs.name] != null ? 0.5 * sibBySeat[cs.name] + 0.5 * 0.72 : 0.72,
      // who holds the seat now: the 2025 winner unless a by-election or a change of party since is on the record
      held: !replay && I?.how ? { member: I.name, party: I.party, group: I.group, how: I.how, since: I.since, recontests: I.recontests } : { member: won2025.name, party: won2025.party, group: won2025.group, ...(!replay && I?.recontests === false ? { recontests: false } : {}) },
      ...(!replay && I?.how ? { won2025 } : {}),
    });
  }
  const us = seats.map((s) => s.uni).filter((v) => v != null), mu = us.reduce((a, b) => a + b, 0) / us.length, sd = Math.sqrt(us.reduce((a, b) => a + (b - mu) ** 2, 0) / us.length);
  for (const s of seats) s.z = s.uni == null ? 0 : (s.uni - mu) / sd;
  /* 2028 runs: the two flows that decide most seats sit at the site's own tables - Coalition voters, Labor v
     One Nation (flows.mjs FP_ON.lnp), and One Nation voters, Labor v Coalition (FLOW.onp, the 2025 count) */
  if (!replay) {
    // `targets` runs a what-if on other levels (the /model/ page's respondents comparison, export.mjs); the
    // official runs pass none
    ST.targets = targets || { "COAL|AO": FP_ON.lnp, "ON|AC": FLOW.onp };
    for (const [k, t] of Object.entries(ST.targets)) ST.delta[k] = solveLevel({ seats, SEN, ST, hist }, k, t);
  }
  // each challenge's table from the record's window (one shared table for the seats with no independent to speak of)
  let ind = null;
  if (IREC && slots.length) {
    const T = slotTables(IREC.transitions, IREC.now.window, slots);
    for (const x of slots) x.c.slot = T.idOf[x.name];
    ind = { years: T.years, tables: Object.fromEntries(Object.entries(T.tables).map(([k, t]) => [k, { lv: t.lv, cum: t.cum, central: t.central, mean: t.mean, n: t.n }])) };
  }
  return { seats, hist, comp, ST, SEN, ind, capX, vsOn: VSON };
}
const groupOfRes = (c) => (c[3] === "alp" ? "alp" : c[3] === "grn" ? "grn" : c[3] === "onp" ? "on" : c[3] === "lnp" ? ({ LP: "lp", NP: "np", LNP: "lnp", CLP: "clp" }[c[1]] || "lnp") : c[3] === "ind" ? "ind" : "oth");

/* What poll respondents say of the two levels the model sets to the site's tables: the polls publishing their
   respondents' own allocation (polls.json tpp_split: One Nation voters to Labor over the Coalition;
   tpp_split_on: Coalition voters to Labor over One Nation), fieldwork ending in the six weeks to the newest
   poll, weighted by sample - the window and weights the Victorian run reads its respondents with
   (vic-inputs.mjs vicRespondents). The official run keeps the counted levels (each has a federal count); the
   page prints what the respondents' levels would give. null where no wave in the window allocates. */
export function respondentLevels(POLLS, days = 42) {
  const polls = (POLLS.polls || []).filter((p) => p.date && !p.isElection);
  const newest = polls.map((p) => p.date).sort().pop(), from = new Date(Date.parse(newest) - days * 864e5).toISOString().slice(0, 10);
  const read = (field, key) => {
    const rows = polls.filter((p) => p.date >= from && p[field] && p[field][key] != null).map((p) => ({ firm: p.pollster, end: p.date, n: p.sample || 1000, v: p[field][key] / 100 }));
    if (!rows.length) return null;
    const W = rows.reduce((a, r) => a + r.n, 0);
    return { share: rows.reduce((a, r) => a + r.n * r.v, 0) / W, polls: rows.map((r) => ({ firm: r.firm, end: r.end, share: r.v })) };
  };
  const on = read("tpp_split", "onp"), coal = read("tpp_split_on", "lnp");
  return on && coal ? { from, to: newest, on, coal } : null;
}

/* back-compatible: prepare and build in one call (backtests, tests) */
export function buildSeats(opts = {}) {
  const inp = prepInputs(opts);
  return { seats: buildSeatsFrom(inp, opts), SEN: inp.SEN, ST: inp.ST, comp: inp.comp, inputs: inp };
}

export function houseHistory(RES, SEN) {
  const FAMB = { alp: 0, lnp: 1, grn: 2, onp: 3 };
  const GROUP = (c) => (c[3] === "alp" ? "alp" : c[3] === "grn" ? "grn" : c[3] === "onp" ? "on" : c[3] === "lnp" ? ({ LP: "lp", NP: "np", LNP: "lnp", CLP: "clp" }[c[1]] || "lnp") : c[3] === "ind" ? "member" : "oth");
  const bySeat = {}, acc = {};
  for (const dv of RES.divs) {
    if (!dv.tcp || dv.tcp.length !== 2 || !SEN.div[dv.n]) continue;
    const fins = dv.tcp.map((t) => FAMB[dv.c[t[0]][3]]);
    if (fins.some((f) => f == null) || fins[0] === fins[1]) continue;
    const [x, y] = fins[0] < fins[1] ? [fins[0], fins[1]] : [fins[1], fins[0]], xi = fins[0] === x ? 0 : 1;
    const pair = "ACGO"[x] + "ACGO"[y];
    for (const f of dv.fl || []) {
      const c = dv.c[f[0]], n = f[1] + f[2]; if (n < 100) continue;
      const key = cohortKeyFor({ group: GROUP(c), party: c[1], partyName: c[2] });
      const cls = flowClassOf(key);
      if (cls === "COAL" && (x === 1 || y === 1)) continue;
      const h = (xi === 0 ? f[1] : f[2]) / n;
      ((bySeat[dv.n] = bySeat[dv.n] || {})[key] = bySeat[dv.n][key] || {})[pair] = h;
      const s = pairShare(SEN, cohortTable(SEN, dv.n, key), x, y);
      const k = cls + "|" + pair; (acc[k] = acc[k] || [0, 0, 0]); acc[k][0] += n * logit(clamp(h)); acc[k][1] += n * logit(clamp(s)); acc[k][2] += n;
    }
  }
  const mean = Object.fromEntries(Object.entries(acc).map(([k, a]) => [k, { house: a[0] / a[2], senate: a[1] / a[2] }]));
  return { bySeat, mean };
}

/* today's vote for each big-four party by 2025 vote: share of party X's current voters who were
   g voters in 2025 = weights2025[g] x P(now X | g), pooled over waves fielded from 1 Aug 2026 */
/* Today's voters by their 2025 vote, from the vote-switching tables: built as the site reads the same
   tables (gen-data §5b, the "where they're going" readings), i.e. the six-week sparse window of every
   sparse figure (SPARSE_K: 42 days, 14-day half-life, cosine taper from day 28) anchored at the newest
   poll's fieldwork end; each wave weighted by its sample (polls.json sampleEff x design effect, else
   sample capped at 3000, as rowN) x the 2025 group's share, and a house with m waves in the window
   counting for sqrt(m); an MRP that reuses its house's own waves sits out, as it sits out of the
   aggregates. A group no wave in the window prints falls back to the waves nearest the window
   (widened 42 days at a time) rather than to nothing. Until 2 Nov 2026 this pooled every wave since
   1 Aug 2026 by sample alone. */
export const SWITCH_K = { window: 42, half: 14, taper: 28 };
const DAY = 86400000;
const sparseW = (d, k = SWITCH_K) => Math.exp(-Math.LN2 * d / k.half) * (d <= k.taper ? 1 : 0.5 * (1 + Math.cos(Math.PI * (d - k.taper) / (k.window - k.taper))));
export function switching(SW, POLLS, { ref = null } = {}) {
  const G = ["alp", "lnp", "grn", "onp", "ind", "oth"], X = ["alp", "lnp", "grn", "on"];
  const list = Array.isArray(POLLS) ? POLLS : POLLS?.polls || [];
  const byKey = new Map(list.map((p) => [p.date + "|" + p.pollster, p]));
  const refMs = new Date(ref || list.reduce((m, p) => (p.date > m ? p.date : m), "0000")).getTime();
  const reuses = (w) => {
    const house = /\(MRP\)$/.test(w.pollster || "") && w.dateStart ? w.pollster.replace(/ \(MRP\)$/, "") : null;
    return !!house && list.some((q) => q.pollster === house && (q.dateStart || q.date) >= w.dateStart && q.date <= w.date);
  };
  const waves = SW.waves.filter((w) => !reuses(w)).map((w) => {
    const p = byKey.get(w.date + "|" + w.pollster);
    const n = p?.sampleEff != null ? p.sampleEff * 1.6 : Math.min(p?.sample || w.sample || 1200, 3000);
    const mid = (new Date(w.dateStart || w.date).getTime() + new Date(w.date).getTime()) / 2;
    return { w, n, d: (refMs - mid) / DAY };
  }).filter((x) => x.d >= 0);
  const M = Object.fromEntries(G.map((g) => [g, Object.fromEntries([...X, "_other"].map((x) => [x, 0]))])), Wt = Object.fromEntries(G.map((g) => [g, 0]));
  const used = {};
  for (const g of G) {
    let k = SWITCH_K, inWin = [];
    for (let i = 0; i < 12 && !inWin.length; i++) {
      k = { window: SWITCH_K.window * (i + 1), half: SWITCH_K.half * (i + 1), taper: SWITCH_K.taper * (i + 1) };
      inWin = waves.filter((x) => x.d <= k.window && x.w.rows[g] && Object.keys(x.w.rows[g]).some((c) => !["dnr", "und"].includes(c) && x.w.rows[g][c]));
    }
    const m = new Map(); for (const x of inWin) m.set(x.w.pollster, (m.get(x.w.pollster) || 0) + 1);
    for (const x of inWin) {
      const row = x.w.rows[g];
      const keys = Object.keys(row).filter((c) => !["dnr", "und"].includes(c));
      const tot = keys.reduce((a, c) => a + (row[c] || 0), 0);
      const wt = x.n * (SW.weights2025[g] || 1) / 100 * sparseW(x.d, k) / Math.sqrt(m.get(x.w.pollster));
      for (const c of keys) { const t = c === "onp" ? "on" : X.includes(c) ? c : "_other"; M[g][t] += wt * (row[c] || 0) / tot; }
      Wt[g] += wt;
    }
    used[g] = { window: k.window, waves: inWin.map((x) => x.w.pollster + " " + x.w.date) };
  }
  const comp = {};
  for (const x of X) {
    const parts = Object.fromEntries(G.map((g) => [g, Wt[g] ? (SW.weights2025[g] || 0) * M[g][x] / Wt[g] : 0]));
    const t = Object.values(parts).reduce((a, b) => a + b, 0);
    comp[x] = Object.fromEntries(Object.entries(parts).map(([g, v]) => [g, v / t]));
  }
  Object.defineProperty(comp, "window", { value: { ref: new Date(refMs).toISOString().slice(0, 10), used }, enumerable: false });
  return comp;
}

/* What the 2025 count shows of preferences between candidates the Senate ballots cannot rank: a Coalition
   partner's (sib), and an independent's.

   An independent's take of a transferring pile depends on who else is left, so it is measured in two cases,
   per donor class (the excluded candidate's): `own` - a party of those voters' own side of politics is still
   standing (Labor and the Greens are one side, the Coalition and One Nation the other; a minor party's
   voters have a choice of sides while more than one of the big four stands); `cross` - only the other side
   is. In 2025 an independent took 45% of a Greens pile while Labor was still in the count and 74% of a Labor
   pile once only the Coalition was; 33% of a One Nation pile with the Coalition standing and 70% of a
   Coalition pile once only Labor was. `sib` is a Coalition candidate's pile with its partner standing.
   Measured over the seats where a member, or an independent who polled 5% or more, was there to receive
   (pooled: members and challengers took alike). Two cases 2025 never counted come from the one count that
   has (vsOn: an independent against One Nation in the final two - Farrer, May 2026): Coalition voters with
   One Nation still standing, and Greens voters with only the other side left. Where a class has no count
   of its own in a case it takes its side's.

   Returns the legacy one-share-per-class tables too (capNat, capBySeat: the members' seats, any case),
   which the backtests and Victoria's run read. */
export function certifiedShares(FLOWS, vsOn = null) {
  const COAL = new Set(["lp", "np", "lnp", "clp"]);
  const clsOfGroup = (g) => (g === "alp" ? "ALP" : COAL.has(g) ? "COAL" : g === "grn" ? "GRN" : g === "on" ? "ON" : "OTH");
  const famOf = (g) => (g === "alp" ? 0 : COAL.has(g) ? 1 : g === "grn" ? 2 : g === "on" ? 3 : -1);
  const nat = {}, capBySeat = {}, sibBySeat = {};
  const X = { own: {}, cross: {}, sib: [0, 0, 0] }, xBySeat = {};
  const put = (o, k, a, n) => { const v = (o[k] = o[k] || [0, 0, 0]); v[0] += a; v[1] += n; v[2]++; };
  for (const s of FLOWS.seats) {
    const G = s.candidates.map((c) => c.group), mem = G.findIndex((g) => g.startsWith("member"));
    // a seat with no member: its strongest independent, where one polled 5% or more (the challenge stands in for it)
    const total = s.candidates.reduce((a, c) => a + c.votes, 0);
    let top = -1; if (mem < 0) s.candidates.forEach((c, i) => { if (c.party === "IND" && c.group === "oth" && (top < 0 || c.votes > s.candidates[top].votes)) top = i; });
    if (top >= 0 && s.candidates[top].votes / total < IND_K.replace) top = -1;
    const ind = mem >= 0 ? mem : top;
    for (const f of s.flows) {
      const ex = G[f.excluded], tot = Object.values(f.to).reduce((a, b) => a + b, 0); if (!tot) continue;
      const partner = COAL.has(ex) ? Object.entries(f.to).filter(([k]) => COAL.has(G[+k]) && +k !== f.excluded).reduce((a, [, v]) => a + v, 0) : 0;
      if (partner > 0) sibBySeat[s.name] = partner / tot;
      if (mem >= 0 && f.excluded !== mem && f.to[mem] != null) {
        const c = clsOfGroup(ex), share = f.to[mem] / tot;
        (nat[c] = nat[c] || []).push(share);
        const k = c === "OTH" ? ["OTH-R", "OTH-M", "OTH-L"] : [c];
        for (const kk of k) ((capBySeat[s.name] = capBySeat[s.name] || {})[kk] = share);
      }
      if (ind >= 0 && f.excluded !== ind && f.to[ind] != null) {
        const c = clsOfGroup(ex);
        // the pile as the model's count splits it: between the independent and the big four still standing
        // (what went to other minor candidates and independents is set aside: the model's count sends them
        // nothing, and their own piles are measured when they go out)
        let S = 0, big = 0; for (const k of Object.keys(f.to)) { const fm = +k === ind ? -1 : famOf(G[+k]); if (fm >= 0 && f.to[k] > 0) { S |= 1 << fm; big += f.to[k]; } }
        const n = f.to[ind] + big; if (!(n > 0)) continue;
        if (partner > 0) { put(X, "sib", f.to[ind], n); continue; }
        const m = OWN_SIDE[c], ctx = (m ? (S & m) !== 0 : (S & (S - 1)) !== 0) ? "own" : "cross";
        put(X[ctx], c, f.to[ind], n);
        put(((xBySeat[s.name] = xBySeat[s.name] || { own: {}, cross: {} })[ctx]), c, f.to[ind], n);
      }
    }
  }
  const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const capNat = { ALP: avg(nat.ALP), COAL: avg(nat.COAL), GRN: avg(nat.GRN), ON: avg(nat.ON), "OTH-R": avg(nat.OTH), "OTH-M": avg(nat.OTH), "OTH-L": avg(nat.OTH), _: avg(nat.OTH) };
  // the two-case table: a class's own count (2025's piles, else the independent-v-One Nation count), else its side's
  const rate = (v) => (v && v[1] > 0 ? v[0] / v[1] : null), src = {};
  const pick = (ctx, k, ...alts) => { for (const [v, label] of [[rate(X[ctx][k === "OTH-R" || k === "OTH-M" || k === "OTH-L" ? "OTH" : k]), "2025"], ...alts]) if (v != null) { src[ctx + "." + k] = label; return v; } return null; };
  const von = (k) => (vsOn && vsOn[k] ? vsOn[k].share : null);
  const own = {}, cross = {};
  own.GRN = pick("own", "GRN"); own.ON = pick("own", "ON");
  own.ALP = pick("own", "ALP", [own.GRN, "the Greens' (2025)"]);
  own.COAL = pick("own", "COAL", [von("COAL"), "v One Nation"], [own.ON, "One Nation's (2025)"]);
  for (const k of ["OTH-R", "OTH-M", "OTH-L"]) own[k] = pick("own", k);
  cross.ALP = pick("cross", "ALP"); cross.COAL = pick("cross", "COAL");
  cross.GRN = pick("cross", "GRN", [von("GRN"), "v One Nation"], [cross.ALP, "Labor's (2025)"]);
  cross.ON = pick("cross", "ON", [cross.COAL, "the Coalition's (2025)"]);
  cross["OTH-R"] = cross.COAL; cross["OTH-L"] = cross.ALP; cross["OTH-M"] = (cross.ALP + cross.COAL) / 2;
  src["cross.OTH-R"] = "the Coalition's (2025)"; src["cross.OTH-L"] = "Labor's (2025)"; src["cross.OTH-M"] = "Labor's and the Coalition's (2025)";
  // rounded here, at the source, so the /model/ page's copy of the inputs counts exactly as the official run does
  const r4 = (v) => Math.round(v * 1e4) / 1e4;
  for (const o of [own, cross]) for (const k of Object.keys(o)) o[k] = r4(o[k]);
  const capX = { own, cross, sib: r4(rate(X.sib) ?? 0.1),
    piles: { own: Object.fromEntries(Object.entries(X.own).map(([k, v]) => [k, { piles: v[2], votes: v[1] }])), cross: Object.fromEntries(Object.entries(X.cross).map(([k, v]) => [k, { piles: v[2], votes: v[1] }])), sib: { piles: X.sib[2], votes: X.sib[1] } }, source: src };
  // a seat's own count where its independent was there to receive that class in that case (null: the seat
  // has no count of its own and takes the national table, which seat-build.mjs reads from ST.iotaX)
  const xSeat = (name) => {
    const o = xBySeat[name]; if (!o) return null;
    const out = { own: {}, cross: {}, sib: capX.sib };
    for (const ctx of ["own", "cross"]) for (const k of FLOW_CLASSES) { const v = rate(o[ctx][k.startsWith("OTH") ? "OTH" : k]); out[ctx][k] = v == null ? capX[ctx][k] : r4(v); }
    return out;
  };
  return { capNat, capBySeat, sibBySeat, capX, xSeat };
}
/* the counts of an independent against One Nation in the final two (the by-elections in the /map/ page's
   as-it-stands store): each excluded candidate's split, pooled by donor class - share to the independent */
export function vsOneNation(NOW) {
  const acc = {}, counts = [];
  for (const [name, by] of Object.entries(NOW?.byelections || {})) {
    const d = by.div; if (!d?.tcp || d.tcp.length !== 2 || !d.fl) continue;
    const b = d.tcp.map((t) => d.c[t[0]][3]), ii = b.indexOf("ind"); if (ii < 0 || !b.includes("onp")) continue;
    counts.push({ seat: name, date: by.date });
    for (const f of d.fl) {
      const c = d.c[f[0]], n = f[1] + f[2]; if (n < 50) continue;
      const g = c[3] === "alp" ? "alp" : c[3] === "lnp" ? "lp" : c[3] === "grn" ? "grn" : c[3] === "onp" ? "on" : c[3] === "ind" ? "member" : "oth";
      const k = flowClassOf(cohortKeyFor({ group: g, party: c[1], partyName: c[2] }));
      const v = (acc[k] = acc[k] || { to: 0, votes: 0 }); v.to += ii === 0 ? f[1] : f[2]; v.votes += n;
    }
  }
  if (!counts.length) return null;
  return { counts, ...Object.fromEntries(Object.entries(acc).map(([k, v]) => [k, { share: v.to / v.votes, votes: v.votes }])) };
}

function ridgePredict(X, y, lambda) {
  const n = X.length, p = X[0].length;
  const mx = Array.from({ length: p }, (_, j) => X.reduce((a, r) => a + r[j], 0) / n);
  const sx = Array.from({ length: p }, (_, j) => Math.sqrt(X.reduce((a, r) => a + (r[j] - mx[j]) ** 2, 0) / n) || 1);
  const my = y.reduce((a, b) => a + b, 0) / n;
  const Z = X.map((r) => r.map((v, j) => (v - mx[j]) / sx[j]));
  const A = Array.from({ length: p }, () => new Array(p).fill(0)), c = new Array(p).fill(0);
  for (let i = 0; i < n; i++) for (let j = 0; j < p; j++) { c[j] += Z[i][j] * (y[i] - my); for (let k = 0; k < p; k++) A[j][k] += Z[i][j] * Z[i][k]; }
  for (let j = 0; j < p; j++) A[j][j] += lambda;
  const M = A.map((r, i) => [...r, c[i]]);
  for (let i = 0; i < p; i++) { let piv = i; for (let r = i + 1; r < p; r++) if (Math.abs(M[r][i]) > Math.abs(M[piv][i])) piv = r; [M[i], M[piv]] = [M[piv], M[i]]; for (let r = 0; r < p; r++) if (r !== i) { const f = M[r][i] / M[i][i]; for (let k = i; k <= p; k++) M[r][k] -= f * M[i][k]; } }
  const b = M.map((r, i) => r[p] / r[i]);
  return (x) => my + x.reduce((a, v, j) => a + b[j] * (v - mx[j]) / sx[j], 0);
}
