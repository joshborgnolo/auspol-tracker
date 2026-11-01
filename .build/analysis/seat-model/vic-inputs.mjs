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
       88 winners on Victoria 2022), then today's voters mixed from their 2025 parties by the federal
       vote-switching tables, as the federal model does;
     - errors: the federal model's, at the final month (the election is four weeks out): polling error,
       seat noise with its fall term, seat types, education, preference shocks.
   Not here: an age/gender term (no Victorian baseline wave), by-elections and defections since 2022
   (the base is the 2022 count; who holds each seat now is shown beside it). */
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stateDistrictTables } from "./state-tables.mjs";
import { settings, switching, flowClassOf } from "./seat-inputs.mjs";
import { modelSettings } from "./model-sim.mjs";
import { FLOW_CLASSES } from "./seat-engine.mjs";
import { subOfName, SUB_CLASS, FAM_OF_GROUP } from "./senate-flows.mjs";

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

const GROUP_OF = (c) => { const b = c[3]; return b === "alp" ? "alp" : b === "lnp" ? ({ LIB: "lp", LP: "lp", NAT: "np", NP: "np" }[c[1]] || "lp") : b === "grn" ? "grn" : b === "onp" ? "on" : b === "ind" ? "member:" + c[0] : "oth"; };
const KEY_OF = (g, c) => (g === "alp" ? "ALP" : ["lp", "np"].includes(g) ? "COAL" : g === "grn" ? "GRN" : g === "on" ? "ON" : g.startsWith("member") ? "OTH-M" : (() => { const s = subOfName(c[2]); return s.startsWith("OTH:") ? "OTH-" + (SUB_CLASS[s.slice(4)] || "M") : "OTH-M"; })());
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
  // the district tables, per donor class, as plain arrays (the page's worker reads them as inputs.pre)
  // rounded to 1e-6 here, in the official run itself, so the page's copy reproduces it exactly
  const pre = Object.fromEntries(sd.divs.map((dv, i) => [dv.n, Object.fromEntries(Object.entries(tables[i]).map(([k, v]) => [k, Array.from(v, (x) => Math.round(x * 1e6) / 1e6)]))]));
  const comp = switching(J("data/vote-switching.json"));
  const pseudo = { national: { result2025: result2022, nowcast: vote.nowcast }, states: { weights: {}, dev: {} } };
  const S = { ...modelSettings({ VOTE: pseudo, CAL, FCAL, DRIFT, mode: "nowcast" }), majority: VIC.majority };
  return { SEN, ST, comp, pre, seats, result2022, S };
}
