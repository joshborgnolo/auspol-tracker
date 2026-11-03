#!/usr/bin/env node
/* reasons.mjs: why each changing-hands seat changes hands, for the /model/ seat cards.

   For every seat whose likeliest winner (the official run's) is not the party holding it, the central
   projection (model-sim projectOnce: no noise) is rebuilt with the model's inputs switched between their
   2025 values and today's, and the margin between the winner's candidate and the holder's - their
   tallies at the last count both stand in, in points of the formal vote - is split over the inputs by
   Shapley values (each input's average effect over every order the changes could be made in), so the
   inputs add up to the whole turn from the 2025 count to now. The inputs:

     alp lnp on grn oth   each party's national vote (2025 result -> the run's vote, after the
                          election-day fade in forecast mode); the rest rescaled to sum to one
     state                the state's poll deviation from the national swing
     demo                 the seat's age and gender mix (the vote layer's differentials)
     terms                seat terms: sitting member, defection, part of 2025's surprise going back
     comp                 today's voters' preferences (switchers carry part of their 2025 party's; off since no voters are mixed)

   Plus the central count's preferences: each origin's net transfer between the two, when they meet in
   the final count.

   Reads the page's own stores (model/data/inputs*.json, data/senate-rankings-2025.json, the official
   runs) and rebuilds the seats exactly as the page's worker does; checks that the all-inputs case
   reproduces projectOnce seat for seat. Writes model/data/reasons.json. Run after export.mjs and
   export-vic.mjs, before assemble.mjs. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { rankingsFrom } from "../analysis/seat-model/senate-flows.mjs";
import { buildSeatsFrom } from "../analysis/seat-model/seat-build.mjs";
import { projectOnce, bucketOf } from "../analysis/seat-model/model-sim.mjs";
import { spreadShares, count, rng, P5 } from "../analysis/seat-model/seat-engine.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
process.chdir(path.resolve(HERE, "..", ".."));
const J = (f) => JSON.parse(fs.readFileSync(f, "utf8"));
const SEN = rankingsFrom(J("data/senate-rankings-2025.json"));
const r2 = (x) => Math.round(x * 100) / 100;

/* the count, instrumented: seat-engine.count's logic with each round's tallies and the final holdings
   by origin kept. Checked against count() on every call, so it cannot drift from the engine. */
function countTrace(seat, shares) {
  const cands = seat.cands, n = cands.length;
  const hold = new Float64Array(n * n), standing = new Uint8Array(n).fill(1);
  for (let c = 0; c < n; c++) hold[c * n + c] = shares[c];
  let nStand = 0; for (let c = 0; c < n; c++) if (shares[c] > 0) nStand++; else standing[c] = 0;
  const tally = new Float64Array(n), rounds = [];
  const snap = () => { const t = new Float64Array(n); for (let c = 0; c < n; c++) if (standing[c]) for (let o = 0; o < n; o++) t[c] += hold[c * n + o]; return { t, st: Uint8Array.from(standing) }; };
  const addFam = (list, o, amount) => { if (list.length === 1) { hold[list[0] * n + o] += amount; return; } let tt = 0; for (const c of list) tt += tally[c] || 1e-9; for (const c of list) hold[c * n + o] += amount * (tally[c] || 1e-9) / tt; };
  rounds.push(snap());
  while (nStand > 2) {
    let x = -1, lo = Infinity;
    for (let c = 0; c < n; c++) if (standing[c]) { let t = 0; for (let o = 0; o < n; o++) t += hold[c * n + o]; tally[c] = t; if (t < lo) { lo = t; x = c; } }
    standing[x] = 0; nStand--;
    let S = 0; const famC = [[], [], [], []], inds = [];
    for (let c = 0; c < n; c++) if (standing[c]) { if (cands[c].fam >= 0) { S |= 1 << cands[c].fam; famC[cands[c].fam].push(c); } else if (cands[c].isInd) inds.push(c); }
    const xFam = cands[x].fam, sibStanding = xFam === 1 && famC[1].length > 0;
    for (let o = 0; o < n; o++) {
      let a = hold[x * n + o]; if (a <= 0) continue;
      hold[x * n + o] = 0;
      if (inds.length) {
        const io = seat.iota[cands[o].cls] ?? seat.iota._ ?? 0;
        if (io > 0) { const give = a * io; let tt = 0; for (const c of inds) tt += tally[c] || 1e-9; for (const c of inds) hold[c * n + o] += give * (tally[c] || 1e-9) / tt; a -= give; }
      }
      let Sx = S;
      if (sibStanding) { if (o === x) { const g = a * seat.sib; addFam(famC[1], o, g); a -= g; Sx = S & ~2; } else { addFam(famC[1], o, a); continue; } }
      if (a <= 0) continue;
      if (!Sx) { let tt = 0; const left = []; for (let c = 0; c < n; c++) if (standing[c]) { left.push(c); tt += tally[c] || 1e-9; } for (const c of left) hold[c * n + o] += a * (tally[c] || 1e-9) / tt; continue; }
      const rt = cands[o].route, useG = xFam >= 0 && !sibStanding && rt, r = [0, 0, 0, 0];
      let tot = 0;
      for (let y = 0; y < 4; y++) { if (!((Sx >> y) & 1)) continue; r[y] = rt ? (useG ? rt.G[(xFam * 16 + Sx) * 4 + y] : rt.F[Sx * 4 + y]) : 1; tot += r[y]; }
      if (tot <= 0) { tot = 0; for (let y = 0; y < 4; y++) { r[y] = (Sx >> y) & 1; tot += r[y]; } }
      for (let y = 0; y < 4; y++) if (r[y] > 0) addFam(famC[y], o, a * r[y] / tot);
    }
    rounds.push(snap());
  }
  const ref = count(seat, shares, null, null), fin = rounds[rounds.length - 1];
  for (const [c, v] of ref) if (Math.abs(fin.t[c] - v) > 1e-9) throw new Error(`countTrace drifted from count() in ${seat.name}`);
  return { rounds, hold, n, winner: ref[0][0], final: ref.map((x) => x[0]) };
}
/* winner's tally minus holder's at the last round both stood in */
const marginOf = (tr, w, h) => { for (let i = tr.rounds.length - 1; i >= 0; i--) { const R = tr.rounds[i]; if (R.st[w] && R.st[h]) return R.t[w] - R.t[h]; } return 0; };

function reasonsFor(inputs, S, run, label) {
  const raw = { seats: inputs.seats, hist: inputs.build.hist, comp: inputs.build.comp, ST: inputs.build.ST, SEN, pre: inputs.pre };
  const withComp = buildSeatsFrom(raw, { composition: true }), noComp = inputs.build.comp ? buildSeatsFrom(raw, { composition: false }) : withComp;
  const central = projectOnce(withComp, S);
  const now = central.targets, was = S.nat25;
  const FACT = ["alp", "lnp", "on", "grn", "oth", "state", "demo", "terms", ...(inputs.build.comp ? ["comp"] : [])];
  const NF = FACT.length, SHARE_F = 8; // the first eight move the shares; comp moves only the count
  const sharesCache = new Map();
  const sharesFor = (mask) => {
    const m = mask & 0xff; if (sharesCache.has(m)) return sharesCache.get(m);
    const t = P5.map((p, k) => ((m >> k) & 1 ? now[k] : was[k])), tt = t.reduce((a, b) => a + b, 0), targets = t.map((x) => x / tt);
    const toLogit = (pp, k) => pp / (100 * targets[k] * (1 - targets[k]));
    const st = {}; for (const [s, d] of Object.entries(S.states)) st[s] = P5.map((p, k) => toLogit(d.dev[k], k));
    const dev = (i, j) => { const s = withComp[i], c = s.cands[j], k = c.p5; return ((m >> 7) & 1 ? c.adj || 0 : 0) + ((m >> 5) & 1 ? st[s.st]?.[k] ?? 0 : 0) + ((m >> 6) & 1 ? toLogit(s.demoPP?.[k] ?? 0, k) : 0); };
    const sh = spreadShares(withComp, targets, dev, rng(1));
    sharesCache.set(m, sh); return sh;
  };
  const ALL = (1 << NF) - 1;
  // the all-inputs case is the central projection, seat for seat
  const shAll = sharesFor(ALL);
  withComp.forEach((s, i) => { const w = s.cands[count(s, shAll[i], null, null)[0][0]].group; if (w !== central.perSeat[i].w) throw new Error(`${label}: rebuilt central projection disagrees in ${s.name}`); });

  const runBy = new Map(run.seats.map((s) => [s.name, s]));
  const fact = (k) => { let f = 1; for (let i = 2; i <= k; i++) f *= i; return f; };
  const W = Array.from({ length: NF }, (_, s) => fact(s) * fact(NF - s - 1) / fact(NF));
  const out = {};
  withComp.forEach((s, i) => {
    const rs = runBy.get(s.name), held = holderOf(s);
    const byB = {}; for (const [g, p] of Object.entries(rs.win)) byB[bucketOf(g)] = (byB[bucketOf(g)] || 0) + p;
    const leadB = Object.entries(byB).sort((a, b) => b[1] - a[1])[0][0];
    if (leadB === held.bucket) return;
    const wg = Object.entries(rs.win).filter(([g]) => bucketOf(g) === leadB).sort((a, b) => b[1] - a[1])[0][0];
    const w = s.cands.findIndex((c) => c.group === wg), h = held.idx;
    if (w < 0 || h < 0 || w === h) return;
    const M = new Float64Array(1 << NF);
    for (let mask = 0; mask <= ALL; mask++) {
      const seat = (mask >> SHARE_F) & 1 ? withComp[i] : noComp[i];
      M[mask] = marginOf(countTrace(seat, sharesFor(mask)[i]), w, h);
    }
    const phi = FACT.map((f, k) => { let v = 0; for (let mask = 0; mask <= ALL; mask++) if (!((mask >> k) & 1)) { let b = 0; for (let x = mask; x; x &= x - 1) b++; v += W[b] * (M[mask | (1 << k)] - M[mask]); } return v; });
    // the central count: primaries and, where the two meet at the end, each origin's net transfer
    const tr = countTrace(withComp[i], shAll[i]), fin = tr.final, prim = shAll[i], base = s.cands.map((c) => c.base);
    const meet = fin.includes(w) && fin.includes(h);
    let prefs = null;
    if (meet) {
      const net = {};
      s.cands.forEach((c, o) => { if (o === w || o === h) return; const v = tr.hold[w * tr.n + o] - tr.hold[h * tr.n + o]; const k = bucketOf(c.group) === "member" ? c.group : bucketOf(c.group); net[k] = (net[k] || 0) + v; });
      prefs = Object.entries(net).map(([k, v]) => [k, r2(100 * v)]).filter(([, v]) => Math.abs(v) >= 0.05).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
    }
    const third = !meet ? fin.find((c) => c !== w && c !== h) : null;
    const grp = (k) => { const o = {}; s.cands.forEach((c, j) => { const g = bucketOf(c.group) === "member" ? c.group : bucketOf(c.group); o[g] = (o[g] || 0) + (k === "b" ? base[j] : prim[j]); }); return Object.fromEntries(Object.entries(o).map(([g, v]) => [g, r2(100 * v)])); };
    out[s.name] = {
      w: wg, h: s.cands[h].group,
      m25: r2(100 * M[0]), mNow: r2(100 * M[ALL]),
      phi: Object.fromEntries(FACT.map((f, k) => [f, r2(100 * phi[k])])),
      prim25: grp("b"), primNow: grp("n"),
      meet, prefs, other: third != null ? s.cands[third].group : null, centralW: s.cands[tr.winner].group,
    };
  });
  return { factors: FACT, nat25: was.map((x) => r2(100 * x)), now: now.map((x) => r2(100 * x)), seats: out };
}
/* the holder's candidate in the 2028 field: a sitting member standing as their own candidate (Sharkie,
   Katter: elected for one-member parties, so filed as "others" in the 2025 result) is the holder */
function holderOf(s) {
  const h = s.held || {};
  let idx = s.cands.findIndex((c) => String(c.group).startsWith("member") && h.member && c.label === h.member);
  if (idx < 0 && String(h.group).startsWith("member")) idx = s.cands.findIndex((c) => c.group === h.group);
  if (idx >= 0) return { idx, bucket: "member" };
  const b = bucketOf(h.group);
  idx = s.cands.findIndex((c) => c.group === h.group);
  if (idx < 0) idx = s.cands.findIndex((c) => bucketOf(c.group) === b);
  if (idx < 0 && s.won2022) idx = s.cands.findIndex((c) => c.label === s.won2022.name); // a Victorian defector: the 2022 count's candidate
  return { idx, bucket: b };
}

const fed = J("model/data/inputs.json"), vic = J("model/data/inputs-vic.json");
const out = {
  _about: "Why each changing-hands seat changes hands (.build/model/reasons.mjs): Shapley split of the central projection's winner-v-holder margin (points) over the inputs, from the 2025 (Victoria: 2022) count to now.",
  nowcast: reasonsFor(fed, fed.settings.nowcast, J("data/seat-model-2028-nowcast.json"), "nowcast"),
  forecast: reasonsFor(fed, { ...fed.settings.forecast, fade: fed.settings.forecast.fade }, J("data/seat-model-2028-forecast.json"), "forecast"),
  vic: reasonsFor(vic, { ...vic.settings.vic, fade: null }, J("data/seat-model-vic-2026.json"), "vic"),
};
fs.writeFileSync("model/data/reasons.json", JSON.stringify(out));
console.log(`model/data/reasons.json: ${Object.keys(out.nowcast.seats).length} nowcast, ${Object.keys(out.forecast.seats).length} forecast, ${Object.keys(out.vic.seats).length} Victorian seats`);
