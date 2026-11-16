/* vic-inputs.mjs: the Victorian election model's inputs (node; vic-simulate.mjs runs them, the /model/
   page's worker gets them as model/data/inputs-vic.json).

   The federal 2028 model's engine on Victoria's own base. What is Victoria's:
     - the vote: the /vic/ page's polling average (its Kalman trend on data/vic-polls.json, read from
       gen-data's `primaryNow:` line on the Victorian dataset, .build/vic/to-main-schema.mjs);
     - the candidates: the VEC's 2026 nominations in all 88 districts, each starting from its party's (or
       its own) 2022 vote there - vic-field.mjs says how a candidate with no 2022 Assembly vote starts;
     - sitting members: a member standing again, and a party whose 2022 winner is gone from its ticket,
       carry the terms fitted on state elections (calibrate-state-swing.mjs `pooled`);
     - errors fitted on state elections: the polls' final-month error (calibrate-state-polls.mjs, 19 state
       elections) and the districts' spread around the swing (calibrate-state-swing.mjs); One Nation's
       polling error keeps the federal floor (four state cases) and its district spread SA 2026's;
     - preferences: the 2025 federal Senate ballots at the nearest federal polling place to each state
       polling place, House-calibrated (state-tables.mjs), then set to Victoria's own evidence:
         * the Greens' and minor parties' Labor-v-Coalition levels to Victoria's 2022 count (86% and 49.1%
           to Labor on the 2022 replay; one logit shift each, carried into 2026's tables);
         * every choice involving One Nation, which Victoria has never counted: the federal reading (One
           Nation's own voters: its 2025 federal count in Victoria; the others: the Senate tables as
           calibrated) moved halfway, on the logit scale, to what Victorian respondents now say (the
           polls publishing their own allocation, data/vic-polls.json `tpp_split` / `tpp_split_on`, over
           the six weeks to the newest poll) - RESPONDENT_WEIGHT below says why half;
         * how-to-vote cards: the registered 2026 cards (data/vic-htv-2026.json) follow the pattern the
           federal tables are built on (Labor: Greens, Coalition, One Nation; Liberals and Nationals: One
           Nation, Labor, Greens; One Nation: Coalition, Labor, Greens) in all but a few districts; there
           the party's voters' choice moves by what the one card reversal on record was worth (`card`).
   Borrowed from the federal model: the engine, the shape of every group's preferences, the fall term and
   the noise multiplier, seat-type and education shocks, preference shocks. Not here: an age/gender term
   (no Victorian baseline wave), the Legislative Council. */
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stateDistrictTables } from "./state-tables.mjs";
import { settings, flowClassOf } from "./seat-inputs.mjs";
import { modelSettings } from "./model-sim.mjs";
import { tiltPair, pairShare } from "./senate-flows.mjs";
import { vicField, flowKeyOf } from "./vic-field.mjs";
import { VIC_FLOWS } from "../../vic/to-main-schema.mjs";

const J = (f) => JSON.parse(readFileSync(f, "utf8"));
const logit = (p) => Math.log(p / (1 - p)), ilogit = (x) => 1 / (1 + Math.exp(-x));
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const VIC = { seats: 88, majority: 45, election: "2026-11-28", electionLabel: "Saturday 28 November 2026", base: 2022, senate: 2025 };
const IOTA = { ALP: 0.73, COAL: 0.73, GRN: 0.49, ON: 0.28, "OTH-R": 0.23, "OTH-M": 0.23, "OTH-L": 0.23, _: 0.23 };
const OTH = ["OTH-R", "OTH-M", "OTH-L"];
/* How far a level with no Victorian count moves from the federal reading towards Victorian respondents'
   own allocation: halfway on the logit scale. Where a count and a reading taken soon after it both exist
   they agree (February 2026, RedBridge/Accent: One Nation's voters 25% to Labor in Victoria against 25.0%
   at the 2025 count there; nationally 23% against 25.5%), so the readings are not noise; but no count has
   yet tested a reading that has MOVED (Victoria's fell to 9-13% for One Nation's voters through 2026, when
   no count on record has gone below 25.5%), and the federal readings between two counts drifted about as
   far as the model's own count-to-count shock allows. Equal weight to each is the stated judgement; the
   count-only and respondents-only runs are printed beside the official one (export-vic.mjs `sens`). */
export const RESPONDENT_WEIGHT = 0.5;
const RESPONDENT_DAYS = 42;

/* the /vic/ polling average now, as the /vic/ page prints it */
export async function vicVote() {
  const { vicToMain } = await import("../../vic/to-main-schema.mjs");
  const raw = J("data/vic-polls.json"), data = vicToMain(raw);
  const tmp = mkdtempSync(join(tmpdir(), "auspol-vic-vote-"));
  try {
    writeFileSync(join(tmp, "polls.json"), JSON.stringify(data));
    const out = execFileSync(process.execPath, [".build/newtracker/gen-data.mjs"], { env: { ...process.env, GEN_DATA_POLLS: join(tmp, "polls.json"), GEN_DATA_OUT: tmp }, encoding: "utf8", maxBuffer: 1 << 28, stdio: ["ignore", "pipe", "ignore"] });
    const line = out.split("\n").find((l) => l.startsWith("primaryNow:"));
    const m = line && line.match(/alp ([\d.]+) lnp ([\d.]+) grn ([\d.]+) onp ([\d.]+) oth ([\d.]+)/);
    if (!m) throw new Error("no Victorian primaryNow line from gen-data");
    const polls = raw.polls.filter((p) => p.primary && p.primary.alp != null).sort((a, b) => (a.fwEnd || "").localeCompare(b.fwEnd || ""));
    const recent = polls.slice(-6).map((p) => `${p.firmRaw} ${p.fwEnd}`);
    return { nowcast: { alp: +m[1], lnp: +m[2], on: +m[4], grn: +m[3], oth: +m[5] }, pollsTo: polls[polls.length - 1].fwEnd, polls: polls.length, recent };
  } finally { rmSync(tmp, { recursive: true, force: true }); }
}

/* One Nation's preferences in Victoria's divisions at the 2025 federal count, in Labor-v-Coalition finals:
   the share of its transfers reaching Labor (the AEC's two-candidate-preferred flow file) */
export function vicOnFlow2025() {
  const COAL = new Set(["LP", "LNP", "NP", "CLP", "NAT"]), by = {};
  for (const l of readFileSync("data/aec-2025-tcp-flow-by-division.csv", "utf8").split("\n").slice(2)) {
    if (!l) continue;
    const c = []; let cur = "", q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === "," && !q) { c.push(cur); cur = ""; } else cur += ch; } c.push(cur);
    if (c[0] !== "VIC" || c[3] === "0") continue;
    (by[c[2]] = by[c[2]] || []).push({ from: c[4], to: c[10], n: +c[15] });
  }
  let a = 0, w = 0;
  for (const rows of Object.values(by)) {
    const to = new Set(rows.map((r) => r.to)); if (!to.has("ALP") || ![...to].some((t) => COAL.has(t))) continue;
    for (const r of rows) if (r.from === "ON") { w += r.n; if (r.to === "ALP") a += r.n; }
  }
  return { share: a / w, votes: w };
}

/* what Victorian respondents say of their own preferences: the polls publishing an allocation, fieldwork
   ending in the six weeks to the newest Victorian poll, weighted by sample. `split` = to Labor over the
   Coalition (Greens, One Nation, others); `splitOn` = to Labor over One Nation (Coalition, Greens, others) */
export function vicRespondents() {
  const polls = J("data/vic-polls.json").polls.filter((p) => p.fwEnd && p.primary && p.primary.alp != null);
  const newest = polls.map((p) => p.fwEnd).sort().pop(), from = new Date(Date.parse(newest) - RESPONDENT_DAYS * 864e5).toISOString().slice(0, 10);
  const read = (field, key) => {
    const rows = polls.filter((p) => p.fwEnd >= from && p[field] && p[field][key] != null).map((p) => ({ firm: p.firmRaw, end: p.fwEnd, n: p.sample || 1000, v: p[field][key] / 100 }));
    if (!rows.length) return null;
    const W = rows.reduce((a, r) => a + r.n, 0);
    return { share: rows.reduce((a, r) => a + r.n * r.v, 0) / W, polls: rows.map((r) => `${r.firm} ${r.end}: ${Math.round(100 * r.v)}%`) };
  };
  return { from, to: newest, on: read("tpp_split", "onp"), coalOn: read("tpp_split_on", "lnp"), grnOn: read("tpp_split_on", "grn"), othOn: read("tpp_split_on", "oth") };
}

const GROUP22 = (c) => { const b = c[3]; return b === "alp" ? "alp" : b === "lnp" ? ({ LIB: "lp", LP: "lp", NAT: "np", NP: "np" }[c[1]] || "lp") : b === "grn" ? "grn" : b === "onp" ? "on" : b === "ind" ? "member:" + c[0] : "oth"; };
const P5 = ["alp", "lnp", "on", "grn", "oth"], P5_OF22 = (c) => ({ alp: 0, lnp: 1, onp: 2, grn: 3 }[c[3]] ?? 4);

/* a party's card against the pattern the federal tables are built on. Each returns the pair moves for the
   party's own voters: [x, y, kind] with kind "flip" (the card now points the other way), "open" (the card
   numbers only its own candidate) - share to x over y, where the federal pattern's card points to x */
function cardMoves(D, card, own, order) {
  // order: the families the federal-pattern card ranks, best first (after the party itself)
  const fam = (name) => { const c = D.cands.find((k) => k.vec === name); return c ? c.fam : -1; };
  const pairs = []; for (let i = 0; i < order.length; i++) for (let j = i + 1; j < order.length; j++) pairs.push([order[i], order[j]]);
  if (card.open) return pairs.map(([x, y]) => [x, y, "open"]);
  const pos = {}; card.order.forEach((n, i) => { const f = fam(n); if (f >= 0 && f !== own && pos[f] == null) pos[f] = i; });
  return pairs.filter(([x, y]) => pos[x] != null && pos[y] != null && pos[y] < pos[x]).map(([x, y]) => [x, y, "flip"]);
}
const FAM_WORD = ["Labor", "the Coalition", "the Greens", "One Nation"];

/* respondentWeight: export-vic.mjs's two comparison runs (0 = the federal readings alone, 1 = the respondents alone) */
export function prepVic({ vote, respondentWeight = RESPONDENT_WEIGHT }) {
  const FCAL = J("data/seat-model-flow-calibration.json"), CAL = J("data/seat-model-calibration.json"), DRIFT = J("data/seat-model-backtest-states.json").drift;
  const SW = J("data/seat-model-state-swing.json"), SPOLL = J("data/seat-model-state-polls.json"), HTV = J("data/vic-htv-2026.json");
  const ST = settings(FCAL);
  const { SEN, sd, tables, distCls, foot } = stateDistrictTables({ sen: VIC.senate, st: "VIC", res: "res-vic22", ST });
  const T3 = { rec: SW.pooled.rec, ret: SW.pooled.ret }, terms = { alp: T3, lnp: T3, grn: T3 };
  const F = vicField({ sd, foot, terms });
  // the statewide 2022 result, in the model's five
  const t5 = [0, 0, 0, 0, 0]; let T = 0;
  for (const dv of sd.divs) for (const c of dv.c) { t5[P5_OF22(c)] += c[4]; T += c[4]; }
  const result2022 = Object.fromEntries(P5.map((k, i) => [k, Math.round(1e4 * t5[i] / T) / 100]));
  // education: each district's degree share, standardised across the 88
  const uni = sd.divs.map((dv) => dv.demo?.uni ?? null), ok = uni.filter((x) => x != null);
  const mu = ok.reduce((a, b) => a + b, 0) / ok.length, sdv = Math.sqrt(ok.reduce((a, b) => a + (b - mu) ** 2, 0) / ok.length);
  const NOM = J("data/vic-candidates-2026.json").districts;
  const seats = sd.divs.map((dv, i) => {
    const f = F.seats[i], tot = dv.c.reduce((a, c) => a + c[4], 0);
    return { name: dv.n, st: "VIC", cls: distCls[i], w: tot, z: uni[i] != null && sdv ? (uni[i] - mu) / sdv : 0, iota: IOTA, sib: 0.72, demoPP: null,
      cands: f.cands, held: f.held, won2022: f.won2022, member2022: f.member2022, tcp2022: f.tcp2022 };
  });

  /* ---- Victoria's own chamber offset: the Greens and the minor parties, Labor v the Coalition ----
     The federal offsets (House v Senate) come from federal counts; in Victoria's 2022 count the Greens' and
     minor parties' preferences reached Labor 86% and 49.1% of the time in Labor-v-Coalition contests
     (.build/vic/to-main-schema.mjs VIC_FLOWS). The 2022 Senate ballots, read the same way and counted on
     the 2022 primaries and candidates, give more to Labor; one logit shift per group closes the gap exactly
     and is applied to the 2025 tables the 2026 run uses. */
  const t22 = stateDistrictTables({ sen: 2022, st: "VIC", res: "res-vic22", ST });
  const flow22 = (classes, d) => {
    let a = 0, w = 0;
    sd.divs.forEach((dv, i) => dv.c.forEach((c) => {
      const cls = flowClassOf(flowKeyOf(GROUP22(c), c[2])); if (!classes.includes(cls)) return;
      a += c[4] * pairShare(t22.SEN, tiltPair(t22.SEN, t22.tables[i][cls], 0, 1, d), 0, 1); w += c[4];
    }));
    return a / w;
  };
  const bisect = (f, target) => { let lo = -4, hi = 4; for (let it = 0; it < 50; it++) { const mid = (lo + hi) / 2; if (f(mid) < target) lo = mid; else hi = mid; } return (lo + hi) / 2; };
  const calib = {
    grn: { target: VIC_FLOWS.grn, senate: flow22(["GRN"], 0), shift: bisect((d) => flow22(["GRN"], d), VIC_FLOWS.grn), source: "Victoria's 2022 count (VEC)" },
    oth: { target: VIC_FLOWS.oth, senate: flow22(OTH, 0), shift: bisect((d) => flow22(OTH, d), VIC_FLOWS.oth), source: "Victoria's 2022 count (VEC)" },
  };
  for (const Tb of tables) {
    Tb.GRN = tiltPair(SEN, Tb.GRN, 0, 1, calib.grn.shift);
    for (const k of OTH) Tb[k] = tiltPair(SEN, Tb[k], 0, 1, calib.oth.shift);
  }

  /* ---- every choice involving One Nation: the federal reading, moved halfway to Victorian respondents ----
     A group's statewide level = its 2026 candidates' share to x over y, weighted by where their vote starts. */
  const level = (classes, x, y, d) => { let a = 0, w = 0; seats.forEach((s, i) => { for (const c of s.cands) { if (!classes.includes(c.cls)) continue; const v = s.w * c.base; a += v * pairShare(SEN, tiltPair(SEN, tables[i][c.cls], x, y, d), x, y); w += v; } }); return a / w; };
  const R = vicRespondents(), on25 = vicOnFlow2025();
  const setCell = (id, classes, x, y, federal, federalSource, reading) => {
    const senate = level(classes, x, y, 0);
    const start = federal ?? senate;
    const target = reading ? ilogit((1 - respondentWeight) * logit(start) + respondentWeight * logit(clamp(reading.share, 0.02, 0.98))) : start;
    const shift = bisect((d) => level(classes, x, y, d), target);
    for (const Tb of tables) for (const k of classes) Tb[k] = tiltPair(SEN, Tb[k], x, y, shift);
    calib[id] = { senate, federal: start, federalSource, respondents: reading ? reading.share : null, respondentPolls: reading ? reading.polls : [], target, shift };
  };
  setCell("on", ["ON"], 0, 1, on25.share, `the 2025 federal count in Victoria (${on25.votes.toLocaleString("en-AU")} One Nation votes)`, R.on);
  setCell("coalOn", ["COAL"], 0, 3, null, "the 2025 Senate ballots, House-calibrated", R.coalOn);
  setCell("grnOn", ["GRN"], 0, 3, null, "the 2025 Senate ballots, House-calibrated", R.grnOn);
  setCell("othOn", OTH, 0, 3, null, "the 2025 Senate ballots, House-calibrated", R.othOn);
  calib.respondents = { from: R.from, to: R.to, weight: respondentWeight };

  /* ---- how-to-vote cards: the districts where a registered card departs from the federal pattern ----
     What a card is worth is the one reversal on record (card.with v card.against: Coalition voters' share to
     Labor over the Greens with the Liberal card for Labor, 2013, and against it, 2010), as a move on the
     logit scale, the scale every other preference move here is made on. A card that now points the other way
     moves its party's voters by the whole of it; an open card, which points nowhere, by half. */
  const cardWorth = logit(SW.card.with) - logit(SW.card.against), cards = {};
  const moveTo = (s, kind) => ilogit(logit(clamp(s, 0.005, 0.995)) - (kind === "open" ? cardWorth / 2 : cardWorth));
  seats.forEach((s, i) => {
    const H = HTV.districts[s.name]; if (!H) return;
    const D = { cands: s.cands.map((c, j) => ({ ...c, vec: NOM[s.name][c.ballot - 1].name })) };
    const notes = [];
    const apply = (cls, moves, who) => {
      if (!moves.length) return;
      // each moved pair's target is set from the table as it stood (the federal pattern's card points to x
      // over y), then the pairs are fitted together: tilting one pair moves the others, so the tilts are
      // repeated until every pair sits on its own target
      const t0 = tables[i][cls], targets = moves.map(([x, y, kind]) => [x, y, moveTo(pairShare(SEN, t0, x, y), kind)]);
      let t = t0;
      for (let it = 0; it < 40; it++) {
        let worst = 0;
        for (const [x, y, target] of targets) { const cur = pairShare(SEN, t, x, y), d = logit(target) - logit(clamp(cur, 1e-6, 1 - 1e-6)); worst = Math.max(worst, Math.abs(d)); t = tiltPair(SEN, t, x, y, d); }
        if (worst < 1e-7) break;
      }
      tables[i][cls] = t;
      notes.push({ party: who, kind: moves[0][2], pairs: moves.map(([x, y]) => [x, y]) });
    };
    if (H.alp) apply("ALP", cardMoves(D, H.alp, 0, [2, 1, 3]), "Labor");
    const cc = H.lib || H.nat; if (cc) apply("COAL", cardMoves(D, cc, 1, [3, 0, 2]), H.lib ? "Liberal" : "National");
    if (H.on) apply("ON", cardMoves(D, H.on, 3, [1, 0, 2]), "One Nation");
    const missing = s.cands.some((c) => c.group === "lp") && !H.lib ? ["Liberal"] : [];
    if (notes.length || missing.length) cards[s.name] = { notes, missing };
  });
  const cardText = (n) => (n.kind === "open" ? `The ${n.party} card numbers only its own candidate here, leaving the rest to the voter`
    : `The ${n.party} card here puts ${n.pairs.map(([x, y]) => `${FAM_WORD[y]} ahead of ${FAM_WORD[x]}`).join(" and ")}`);
  for (const [name, c] of Object.entries(cards)) c.text = [...c.notes.map(cardText), ...c.missing.map((p) => `No ${p} card was registered here`)];
  // the cards as read, tallied for the page
  const tally = { labor: { pattern: 0, open: 0, other: 0 }, coalition: { pattern: 0, open: 0, other: 0, none: 0 }, on: { pattern: 0, other: 0 } };
  seats.forEach((s) => {
    const H = HTV.districts[s.name], c = cards[s.name], kindOf = (p) => c?.notes.find((n) => n.party === p)?.kind;
    const a = kindOf("Labor"); tally.labor[a === "open" ? "open" : a ? "other" : "pattern"]++;
    const cc = H.lib || H.nat, k = kindOf("Liberal") || kindOf("National");
    if (!cc) tally.coalition.none++; else tally.coalition[k === "open" ? "open" : k ? "other" : "pattern"]++;
    tally.on[kindOf("One Nation") ? "other" : "pattern"]++;
  });

  // the district tables, per donor class, as plain arrays (the page's worker reads them as inputs.pre)
  // rounded to 1e-6 here, in the official run itself, so the page's copy reproduces it exactly
  const pre = Object.fromEntries(sd.divs.map((dv, i) => [dv.n, Object.fromEntries(Object.entries(tables[i]).map(([k, v]) => [k, Array.from(v, (x) => Math.round(x * 1e6) / 1e6)]))]));
  /* No vote-switching mix (as federally): each group keeps its own voters' orders at the levels above. */
  const comp = null;
  const pseudo = { national: { result2025: result2022, nowcast: vote.nowcast }, states: { weights: {}, dev: {} } };
  const S = { ...modelSettings({ VOTE: pseudo, CAL, FCAL, DRIFT, mode: "nowcast", plainNoise: true }), majority: VIC.majority };
  /* errors fitted on state elections. Polling error: the final month's polls v the result over 19 state
     elections (Labor, the Coalition, the Greens, the rest); One Nation polled 5%+ in only four of them, so
     it keeps the federal floor. District noise: the spread around the swing at state elections on unchanged
     boundaries, after the sitting-member terms (Labor, the Coalition), on the plain swing (the Greens);
     One Nation's is SA 2026's from the federal footprint, others' the federal setting. */
  const fedOn = S.sigNat[2];
  S.sigNat = [SPOLL.all.sigma.alp, SPOLL.all.sigma.lnp, fedOn, SPOLL.all.sigma.grn, SPOLL.all.sigma.oth];
  S.sig0 = [SW.pooled.sigma.alp, SW.pooled.sigma.lnp, S.sig0[2], SW.plain.grn.rms, S.sig0[4]];
  const errors = { polls: { elections: SPOLL.all.n.alp, sigma: SPOLL.all.sigma, bias: SPOLL.all.bias, federal: SPOLL.federal.sigma, onpLarge: SPOLL.onpLarge }, districts: { pairs: SW.pairs, alp: SW.pooled.sigma.alp, lnp: SW.pooled.sigma.lnp, grn: SW.plain.grn.rms }, terms: SW.pooled, card: SW.card };
  return { SEN, ST, comp, pre, seats, result2022, S, calib, cards, cardTally: tally, errors, field: { record: F.record, tallies: F.tallies, asAt: F.asAt, source: F.source } };
}
