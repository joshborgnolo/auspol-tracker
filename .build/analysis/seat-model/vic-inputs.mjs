/* vic-inputs.mjs: the Victorian election model's inputs (node; vic-simulate.mjs runs them, the /model/
   page's worker gets them as model/data/inputs-vic.json).

   The same model as the federal 2028 runs, on Victoria's own base:
     - the vote: the /vic/ page's polling average (its Kalman trend on data/vic-polls.json, read from
       gen-data's `primaryNow:` line on the Victorian dataset, .build/vic/to-main-schema.mjs);
     - the seats: the 88 Assembly districts on their 2022 counts (map/data/res-vic22.json; the boundaries
       stand for 2026), every 2022 candidate's party standing again, and One Nation in every district
       (it stood in five in 2022): where it did not stand, its base is its federal 2025 vote at the
       federal polling places nearest the district's own (state-tables.mjs `foot`);
     - preferences: the 2025 federal Senate ballots at the nearest federal polling place to each state
       polling place, House-calibrated (state-tables.mjs - the reading backtest-states.mjs scored 84 of
       88 winners on Victoria 2022), with the Greens' and minor parties' levels set so the 2022 replay gives
       the flows the VEC's 2022 counts show (86% and 49.1% to Labor over the Coalition) and One Nation's to its
       2025 federal count in Victoria (25%); no federal vote-switching mix (Victoria's own counts come first);
     - errors: the federal model's, at the final month (the election is four weeks out): polling error,
       seat noise with its fall term, seat types, education, preference shocks.
   Not here: an age/gender term (no Victorian baseline wave), by-elections and defections since 2022
   (the base is the 2022 count; who holds each seat now is shown beside it). */
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stateDistrictTables } from "./state-tables.mjs";
import { settings, flowClassOf } from "./seat-inputs.mjs";
import { modelSettings } from "./model-sim.mjs";
import { FLOW_CLASSES } from "./seat-engine.mjs";
import { subOfName, SUB_CLASS, FAM_OF_GROUP, tiltPair, pairShare } from "./senate-flows.mjs";
import { VIC_FLOWS } from "../../vic/to-main-schema.mjs";

const J = (f) => JSON.parse(readFileSync(f, "utf8"));
export const VIC = { seats: 88, majority: 45, election: "2026-11-28", electionLabel: "Saturday 28 November 2026", base: 2022, senate: 2025 };
const IOTA = { ALP: 0.73, COAL: 0.73, GRN: 0.49, ON: 0.28, "OTH-R": 0.23, "OTH-M": 0.23, "OTH-L": 0.23, _: 0.23 };

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

const GROUP_OF = (c) => { const b = c[3]; return b === "alp" ? "alp" : b === "lnp" ? ({ LIB: "lp", LP: "lp", NAT: "np", NP: "np" }[c[1]] || "lp") : b === "grn" ? "grn" : b === "onp" ? "on" : b === "ind" ? "member:" + c[0] : "oth"; };
/* Victorian right-wing minor parties the shared name rules (senate-flows.mjs, kept in step with the Senate
   extractor) do not know, and would leave in the centre class whose voters lean Labor: the Freedom Party
   (1.8% in 2022, an anti-lockdown party), the Angry Victorians, Health Australia */
const VIC_RIGHT = /freedom party|angry victorians|health australia/i;
const KEY_OF = (g, c) => (g === "alp" ? "ALP" : ["lp", "np"].includes(g) ? "COAL" : g === "grn" ? "GRN" : g === "on" ? "ON" : g.startsWith("member") ? "OTH-M" : VIC_RIGHT.test(c[2]) ? "OTH-R" : (() => { const s = subOfName(c[2]); return s.startsWith("OTH:") ? "OTH-" + (SUB_CLASS[s.slice(4)] || "M") : "OTH-M"; })());
const P5I = (g) => (g === "alp" ? 0 : ["lp", "np"].includes(g) ? 1 : g === "on" ? 2 : g === "grn" ? 3 : 4);
const HELD_OF = { ALP: "alp", GRN: "grn", IND: "member" };

export function prepVic({ vote }) {
  const FCAL = J("data/seat-model-flow-calibration.json"), CAL = J("data/seat-model-calibration.json"), DRIFT = J("data/seat-model-backtest-states.json").drift;
  const ST = settings(FCAL);
  const { SEN, sd, tables, distCls, foot } = stateDistrictTables({ sen: VIC.senate, st: "VIC", res: "res-vic22", ST });
  const plan = J("map/data/la-seating-plan-vic-2026-08-11.json").divisions;
  // the statewide 2022 result, in the model's five
  const t5 = { alp: 0, lnp: 0, on: 0, grn: 0, oth: 0 }; let T = 0;
  for (const dv of sd.divs) for (const c of dv.c) { const k = ["alp", "lnp", "on", "grn", "oth"][P5I(GROUP_OF(c))]; t5[k] += c[4]; T += c[4]; }
  const result2022 = Object.fromEntries(Object.entries(t5).map(([k, v]) => [k, Math.round(1e4 * v / T) / 100]));
  // education: each district's degree share, standardised across the 88
  const uni = sd.divs.map((dv) => dv.demo?.uni ?? null), ok = uni.filter((x) => x != null);
  const mu = ok.reduce((a, b) => a + b, 0) / ok.length, sdv = Math.sqrt(ok.reduce((a, b) => a + (b - mu) ** 2, 0) / ok.length);
  const seats = sd.divs.map((dv, i) => {
    const tot = dv.c.reduce((a, c) => a + c[4], 0);
    const cands = dv.c.map((c) => {
      const g = GROUP_OF(c), key = KEY_OF(g, c), cls = flowClassOf(key);
      return { label: c[0], group: g, party: c[1], partyName: c[2], base: c[4] / tot, p5: P5I(g), fam: FAM_OF_GROUP[g] ?? -1, isInd: g.startsWith("member"), key, cls, clsIdx: FLOW_CLASSES.indexOf(cls) };
    });
    if (!cands.some((c) => c.group === "on")) {
      const f = foot[i], base = f.w ? Math.max(0.003, (f.onp || 0) / f.w) : 0.01;
      cands.push({ label: "One Nation candidate", group: "on", party: "ON", partyName: "Pauline Hanson's One Nation", base, p5: 2, fam: 3, isInd: false, key: "ON", cls: "ON", clsIdx: FLOW_CLASSES.indexOf("ON"), added: true });
    }
    const w22 = dv.c.find((c) => c[6] === 1), now = plan[dv.n];
    const heldGroup = now ? (now.p === "L/N" ? (["lp", "np"].includes(GROUP_OF(w22)) ? GROUP_OF(w22) : "lp") : HELD_OF[now.p] || "oth") : GROUP_OF(w22);
    const tcp2022 = dv.tcp ? dv.tcp.map((t) => ({ name: dv.c[t[0]][0], party: dv.c[t[0]][2], bucket: dv.c[t[0]][3], votes: t[1] })) : null;
    return { name: dv.n, st: "VIC", cls: distCls[i], w: tot, z: uni[i] != null && sdv ? (uni[i] - mu) / sdv : 0, iota: IOTA, sib: 0.72, demoPP: null, cands,
      held: { group: heldGroup.startsWith("member") ? "member:" + now.m : heldGroup, member: now?.m || w22[0], party: now?.p || w22[1] },
      won2022: { group: GROUP_OF(w22), name: w22[0], party: w22[2] }, tcp2022 };
  });
  /* Victoria's own chamber offset. The federal offsets (House v Senate) come from federal counts; in
     Victoria's 2022 count the Greens' and minor parties' preferences reached Labor 86% and 49.1% of the
     time in Labor-v-Coalition contests (measured from the VEC's district counts, .build/vic/to-main-schema.mjs
     VIC_FLOWS). The 2022 Senate ballots, read the same way and counted on the 2022 primaries, give more to
     Labor; one logit shift per group (the Greens; all minor parties and independents together) closes the
     gap exactly, and is applied to the 2025 tables the 2026 run uses. One Nation stood in too few districts
     in 2022 to be measured: it keeps the federal treatment. */
  const t22 = stateDistrictTables({ sen: 2022, st: "VIC", res: "res-vic22", ST });
  const OTH = ["OTH-R", "OTH-M", "OTH-L"];
  const flow22 = (classes, d) => {
    let a = 0, w = 0;
    sd.divs.forEach((dv, i) => dv.c.forEach((c) => {
      const cls = flowClassOf(KEY_OF(GROUP_OF(c), c)); if (!classes.includes(cls)) return;
      a += c[4] * pairShare(t22.SEN, tiltPair(t22.SEN, t22.tables[i][cls], 0, 1, d), 0, 1); w += c[4];
    }));
    return a / w;
  };
  const solve = (classes, target) => { let lo = -4, hi = 4; for (let it = 0; it < 50; it++) { const mid = (lo + hi) / 2; if (flow22(classes, mid) < target) lo = mid; else hi = mid; } return (lo + hi) / 2; };
  const calib = {
    grn: { target: VIC_FLOWS.grn, senate: flow22(["GRN"], 0), shift: solve(["GRN"], VIC_FLOWS.grn), source: "Victoria's 2022 count (VEC)" },
    oth: { target: VIC_FLOWS.oth, senate: flow22(OTH, 0), shift: solve(OTH, VIC_FLOWS.oth), source: "Victoria's 2022 count (VEC)" },
  };
  for (const T of tables) {
    T.GRN = tiltPair(SEN, T.GRN, 0, 1, calib.grn.shift);
    for (const k of OTH) T[k] = tiltPair(SEN, T[k], 0, 1, calib.oth.shift);
  }
  /* One Nation, too few in 2022 to measure there, is set to its own last Victorian count: the 2025 federal
     House count in Victoria's divisions. Its level across the districts is weighted by where its vote is
     (its federal footprint, or its 2022 vote where it stood) */
  const onW = sd.divs.map((dv, i) => { const f = foot[i]; const own = dv.c.find((c) => c[3] === "onp"); const tot = dv.c.reduce((a, c) => a + c[4], 0); return tot * (own ? own[4] / tot : f.w ? (f.onp || 0) / f.w : 0.01); });
  const onLevel = (d) => { let a = 0, w = 0; tables.forEach((T, i) => { a += onW[i] * pairShare(SEN, tiltPair(SEN, T.ON, 0, 1, d), 0, 1); w += onW[i]; }); return a / w; };
  const on25 = vicOnFlow2025();
  { let lo = -4, hi = 4; for (let it = 0; it < 50; it++) { const mid = (lo + hi) / 2; if (onLevel(mid) < on25.share) lo = mid; else hi = mid; }
    calib.on = { target: Math.round(on25.share * 1e4) / 1e4, senate: onLevel(0), shift: (lo + hi) / 2, source: `the 2025 federal count in Victoria (${on25.votes.toLocaleString("en-AU")} One Nation votes)` }; }
  for (const T of tables) T.ON = tiltPair(SEN, T.ON, 0, 1, calib.on.shift);
  // the district tables, per donor class, as plain arrays (the page's worker reads them as inputs.pre)
  // rounded to 1e-6 here, in the official run itself, so the page's copy reproduces it exactly
  const pre = Object.fromEntries(sd.divs.map((dv, i) => [dv.n, Object.fromEntries(Object.entries(tables[i]).map(([k, v]) => [k, Array.from(v, (x) => Math.round(x * 1e6) / 1e6)]))]));
  /* No vote-switching mix: the federal tables say where today's FEDERAL voters came from (One Nation's
     largely from the Coalition), which Victoria's movements do not match (Labor has lost most since 2022),
     and the mix assumes switchers keep their old order - doubtful for voters leaving a state government.
     Each group keeps its own voters' orders at Victoria's measured levels (above). In SA 2026 the mix
     changed no winner (backtest-states). */
  const comp = null;
  const pseudo = { national: { result2025: result2022, nowcast: vote.nowcast }, states: { weights: {}, dev: {} } };
  const S = { ...modelSettings({ VOTE: pseudo, CAL, FCAL, DRIFT, mode: "nowcast", plainNoise: true }), majority: VIC.majority }; // no seat terms here: the plain swing's noise
  return { SEN, ST, comp, pre, seats, result2022, S, calib };
}
