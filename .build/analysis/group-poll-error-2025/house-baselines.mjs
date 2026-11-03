#!/usr/bin/env node
/* house-baselines.mjs: the seat model's state deviations, with each house's own election-time state cells as
   the baseline.

   vote-layer.mjs (§5) reads each state's deviation from each house's current state cells. Resolve's is a
   difference-in-differences against its own 3 May 2025 wave, so its state leans cancel. Every other house is
   read as a level gap: current cell − (certified 2025 state share + national movement), centred on the house's
   own population-weighted mean. A house whose state cells leaned at the election carries that lean into today's
   deviation as if it were movement.

   bludgertrack-2022-25.json has the houses' state cells in the final five weeks before the election. For a house
   with them (YouGov's weekly cells, Newspoll's pooled quarter), its election-time deviation is the same formula
   at the election (cell − certified state share, centred the same way, national movement zero by definition).
   Subtracting it from today's deviation makes the house a difference-in-differences like Resolve. Houses without
   pre-election state cells (DemosAU's MRP, Roy Morgan) keep their level gaps.

   Reads data/seat-vote-layer.json (diagnostics.stateDetail: each house's centred current deviation and its
   standard error, as the daily run printed them) and re-runs the layer's stage-B pooling (DerSimonian–Laird per
   state and party, then shrinkage across states with σ ≥ 1 point) on the corrected deviations. Nothing is
   written to the model; this reports what would change.

   Run from the repo root:
     node .build/analysis/group-poll-error-2025/house-baselines.mjs > .build/analysis/group-poll-error-2025/out/house-baselines.txt */
import { pathToFileURL } from "node:url";
import { J, FINAL_FROM, PRE_FROM, PRE_TO, ELECTION, releases, actual, fmt } from "./lib.mjs";
import { analyse } from "./group-error.mjs";

const P5 = ["alp", "lnp", "on", "grn", "oth"];
const BT_KEY = { alp: "alp", lnp: "lnp", on: "onp", grn: "grn", oth: "oth" };
const STATES = ["NSW", "VIC", "QLD", "SA", "WA"];
const LABEL = { NSW: "NSW", VIC: "Vic", QLD: "Qld", SA: "SA", WA: "WA" };
const VL_HOUSE = { YouGov: "YouGov", Newspoll: "Newspoll (pooled)" };
const TAU2_FLOOR = 1; // vote-layer.mjs

function poolDL(obs) { // vote-layer.mjs's
  const wi = obs.map((o) => 1 / o.v), W = wi.reduce((a, b) => a + b, 0);
  const y = obs.reduce((s, o) => s + o.y / o.v, 0) / W;
  if (obs.length < 2) return { y, v: 1 / W, tau2: 0 };
  const q = obs.reduce((s, o) => s + (o.y - y) ** 2 / o.v, 0), df = obs.length - 1;
  const c = W - wi.reduce((a, b) => a + b * b, 0) / W;
  const tau2 = Math.max(0, (q - df) / c);
  const wr = obs.map((o) => 1 / (o.v + tau2)), Wr = wr.reduce((a, b) => a + b, 0);
  return { y: obs.reduce((s, o) => s + o.y / (o.v + tau2), 0) / Wr, v: 1 / Wr, tau2 };
}

/* a house's election-time centred state deviations in a window, per state and party */
export function electionDevs(house, from, to, deff) {
  const A = actual();
  const rs = releases().list.filter((R) => R.house === house && R.end >= from && R.end <= to && !R.flags.length && STATES.every((s) => R.cells[s]));
  if (!rs.length) return null;
  const wSum = STATES.reduce((s, st) => s + A[st].formal, 0);
  const out = { releases: rs.map((R) => `${R.start}..${R.end}`) };
  for (const p of P5) {
    const k = BT_KEY[p];
    if (rs.some((R) => STATES.some((s) => R.cells[s].s[k] == null))) { out[p] = null; continue; }
    out[p] = {};
    for (const st of STATES) {
      // per release: level error in st, centred on the release's certified-weighted mean level error
      const per = rs.map((R) => {
        const lvl = (s) => R.cells[s].s[k] - A[s][k];
        const centre = STATES.reduce((a, s) => a + (A[s].formal / wSum) * lvl(s), 0);
        const y = R.cells[st].s[k] / 100, n = R.cells[st].n;
        return { d: lvl(st) - centre, v: deff * 1e4 * (y * (1 - y)) / n + 1 / 12, n };
      });
      const N = per.reduce((s, x) => s + x.n, 0);
      out[p][st] = { d: per.reduce((s, x) => s + x.n * x.d, 0) / N, v: per.reduce((s, x) => s + (x.n / N) ** 2 * x.v, 0) };
    }
  }
  return out;
}

export function rebase() {
  const V = J("data/seat-vote-layer.json"), deff = analyse().deff;
  const detail = V.diagnostics.stateDetail;
  const base = Object.fromEntries(Object.keys(VL_HOUSE).map((h) => [h, { fin: electionDevs(h, FINAL_FROM, ELECTION, deff[h].deff), pre: electionDevs(h, PRE_FROM, PRE_TO, deff[h].deff) }]));
  const parse = (s) => { const m = s.match(/^(.+):(.+) (-?[\d.]+)±([\d.]+)$/); return m ? { house: m[1], label: m[2], y: +m[3], v: (+m[4]) ** 2 } : null; };
  const rows = {}, pts = { now: {}, rebased: {} };
  for (const st of STATES) {
    rows[st] = {};
    for (const p of P5) {
      const obs = (detail[st]?.[p]?.obs || []).map(parse).filter(Boolean);
      const reb = obs.map((o) => {
        const h = Object.keys(VL_HOUSE).find((x) => VL_HOUSE[x] === o.house);
        const b = h && o.label === LABEL[st] ? base[h].fin?.[p]?.[st] : null;
        return b ? { ...o, y: o.y - b.d, v: o.v + b.v, base: b.d } : { ...o };
      });
      const a = poolDL(obs), b = poolDL(reb);
      rows[st][p] = { obs, reb, now: a, rebased: b };
      (pts.now[p] = pts.now[p] || []).push({ st, y: a.y, v: a.v });
      (pts.rebased[p] = pts.rebased[p] || []).push({ st, y: b.y, v: b.v });
    }
  }
  // shrink across states per party, as the layer does (its own five-state subset here: Tas/NT/ACT are composites)
  const shrunk = { now: {}, rebased: {} };
  for (const which of ["now", "rebased"]) for (const p of P5) {
    const m = poolDL(pts[which][p].map((x) => ({ y: x.y, v: x.v })));
    const tau2 = Math.max(m.tau2, TAU2_FLOOR);
    for (const x of pts[which][p]) { const k = tau2 / (tau2 + x.v); ((shrunk[which][x.st] = shrunk[which][x.st] || {})[p] = { dev: x.y * k, raw: x.y, se: Math.sqrt(x.v * k) }); }
  }
  return { base, rows, shrunk, model: Object.fromEntries(STATES.map((st) => [st, V.states.dev[st]])), window: V.diagnostics.recentWindow };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const R = rebase(), L = (s = "") => console.log(s);
  L("Each house's state cells at the election: centred deviation from the certified count (points), final five weeks and the");
  L("nine months before. This is what vote-layer.mjs reads as movement when it compares the house's cells today with the count.");
  for (const [h, b] of Object.entries(R.base)) {
    L(`  ${h}  final: ${b.fin?.releases.join(", ") || "none"}`);
    for (const p of P5) {
      if (!b.fin?.[p]) continue;
      L(`    ${p.padEnd(4)} ` + STATES.map((st) => `${st} ${fmt(b.fin[p][st].d)}±${Math.sqrt(b.fin[p][st].v).toFixed(1)} (pre ${b.pre?.[p] ? fmt(b.pre[p][st].d) : " – "})`).join("  "));
    }
  }
  L();
  L(`State deviations now (window ${R.window.from} – ${R.window.to}), five mainland states: the layer's per-house readings, pooled`);
  L("as the layer pools them, before and after taking YouGov's and Newspoll's election-time deviations off theirs.");
  L("Raw = pooled across houses; shrunk = after the layer's shrinkage across states (here over these five states only).");
  for (const st of ["NSW", "VIC", "QLD", "SA", "WA"]) {
    L(`  ${st}`);
    for (const p of P5) {
      const r = R.rows[st][p];
      if (!r.obs.length) continue;
      const hs = r.reb.filter((o) => o.base != null).map((o) => `${o.house} ${fmt(o.y + o.base)}→${fmt(o.y)}`).join("  ");
      L(`    ${p.padEnd(4)} raw ${fmt(r.now.y)} → ${fmt(r.rebased.y)}   shrunk ${fmt(R.shrunk.now[st][p].dev)} → ${fmt(R.shrunk.rebased[st][p].dev)}   (model file: ${fmt(R.model[st]?.[p]?.dev)})   ${hs}`);
    }
  }
}
