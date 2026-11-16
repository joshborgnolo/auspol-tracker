#!/usr/bin/env node
/* calibrate-state-swing.mjs: the seat-level terms of the logit swing at STATE elections, for the Victorian
   model (vic-inputs.mjs). The federal model's terms (swing-fit.mjs) are fitted on federal members; state
   members' personal votes may differ, so they are measured here on state results.

   Elections used: pairs fought on the SAME boundaries, so a district's base is its own previous count and
   nothing is notional - Victoria 2014 -> 2018, Queensland 2017 -> 2020 and 2020 -> 2024, NSW 2015 -> 2019
   (map/data/res-<id>.json). For each pair and party (Labor, Coalition, Greens, One Nation) a district's
   share is predicted from its previous share by one logit shift solved so the statewide total comes out
   exactly (oracle totals: no polling error here), plus
     rec   the party won the district last time and that member stands again for it
     ret   the party won the district last time and that member is not its candidate now
   against the districts the party did not hold. Members are matched by name between the two counts;
   by-elections between them are not read (a by-election winner counts as a new candidate), which blurs
   both terms a little towards zero.
   Fitted by iteratively reweighted least squares with Huber weights (k = 1.5 robust SDs), as swing-fit.mjs
   fits the federal terms; standard errors from a bootstrap over districts.

   Also measured: the spread of districts around the swing after the terms (the Victorian model's district
   noise), per party and election, and the same spread on the plain swing.

   And one thing no state store can show: how far a party's voters follow its how-to-vote card. The one
   clean reversal on record is federal - the Liberal card put the Greens ahead of Labor in 2010 and Labor
   ahead of the Greens in 2013; in the two divisions whose count ended Labor v Greens both times (Melbourne
   and Batman, map/data/res-2010/2013.json) the share of Coalition voters' preferences reaching Labor is
   read off each count. `card.follow` = the 2013 share minus the 2010 share: the share of the party's voters
   who went where the card pointed (the rest kept their own order). The Victorian model uses it only in the
   districts where a 2026 card departs from the federal pattern its preference tables are built on.

   Writes data/seat-model-state-swing.json. */
import { readFileSync, writeFileSync } from "node:fs";

const J = (f) => JSON.parse(readFileSync(f, "utf8"));
const logit = (p) => Math.log(p / (1 - p)), ilogit = (x) => 1 / (1 + Math.exp(-x));
const sum = (a) => a.reduce((s, x) => s + x, 0), mean = (a) => sum(a) / a.length;
const norm = (s) => String(s || "").toUpperCase().replace(/[^A-Z ]/g, "").trim();
export const personKey = (name) => { const nm = norm(name).split(/\s+/); return nm[nm.length - 1] + "|" + (nm[0] || "")[0]; };
export const PAIRS = [
  { id: "vic18", prev: "vic14", label: "Victoria 2018" },
  { id: "qld20", prev: "qld17", label: "Queensland 2020" },
  { id: "qld24", prev: "qld20", label: "Queensland 2024" },
  { id: "nsw19", prev: "nsw15", label: "NSW 2019" },
];
const GROUPS = ["alp", "lnp", "grn", "onp"], INC = ["alp", "lnp"];

export function pairRows(pair) {
  const E = J(`map/data/res-${pair.id}.json`), P = J(`map/data/res-${pair.prev}.json`);
  const rows = [];
  for (const dv of E.divs) {
    const dp = P.divs.find((d) => d.n === dv.n); if (!dp) continue;
    const tot = sum(dv.c.map((c) => c[4])), totP = sum(dp.c.map((c) => c[4]));
    const wP = dp.c.find((c) => c[6] === 1); if (!wP) continue;
    const key = personKey(wP[0]);
    const again = dv.c.find((c) => personKey(c[0]) === key);          // the member, on this ballot
    for (const b of GROUPS) {
      const share = sum(dv.c.filter((c) => c[3] === b).map((c) => c[4])) / tot;
      const base = sum(dp.c.filter((c) => c[3] === b).map((c) => c[4])) / totP;
      if (!(share >= 0.01 && base >= 0.01)) continue;
      const held = wP[3] === b;
      rows.push({ E: pair.id, b, div: dv.n, w: tot, x: logit(base), y: logit(share), base, share,
        rec: held && again && again[3] === b ? 1 : 0, ret: held && !(again && again[3] === b) ? 1 : 0,
        defect: held && again && again[3] !== b ? 1 : 0 });
    }
  }
  return rows;
}
function shift(xs, ws, target) {
  let c = logit(Math.min(0.999, Math.max(0.001, target))) - xs.reduce((a, x, i) => a + ws[i] * x, 0) / sum(ws);
  for (let it = 0; it < 100; it++) { let f = 0, d = 0, W = 0; for (let i = 0; i < xs.length; i++) { const p = ilogit(xs[i] + c); f += ws[i] * p; d += ws[i] * p * (1 - p); W += ws[i]; } const g = f / W - target; if (Math.abs(g) < 1e-10) break; c -= Math.max(-1, Math.min(1, g / (d / W))); }
  return c;
}
/* residuals given offsets: one shift per election and party */
function residualize(rs, off) {
  const by = {}; for (const r of rs) (by[r.E + "|" + r.b] = by[r.E + "|" + r.b] || []).push(r);
  for (const g of Object.values(by)) {
    const target = sum(g.map((r) => r.w * r.share)) / sum(g.map((r) => r.w));
    const xs = g.map((r) => r.x + off(r)), c = shift(xs, g.map((r) => r.w), target);
    g.forEach((r, i) => { r.shift = c; r.e = r.y - xs[i] - c; });
  }
}
function solve(A, b) { const n = b.length, M = A.map((r, i) => [...r, b[i]]); for (let i = 0; i < n; i++) { let p = i; for (let r = i + 1; r < n; r++) if (Math.abs(M[r][i]) > Math.abs(M[p][i])) p = r; [M[i], M[p]] = [M[p], M[i]]; if (Math.abs(M[i][i]) < 1e-12) continue; for (let r = 0; r < n; r++) if (r !== i) { const f = M[r][i] / M[i][i]; for (let k = i; k <= n; k++) M[r][k] -= f * M[i][k]; } } return M.map((r, i) => (Math.abs(r[i]) < 1e-12 ? 0 : r[n] / r[i])); }
export function fit(rs, feats, k = 1.5) {
  let beta = feats.map(() => 0), wts = rs.map(() => 1);
  for (let it = 0; it < 40; it++) {
    residualize(rs, (r) => feats.reduce((a, f, j) => a + beta[j] * f(r), 0));
    const n = feats.length; if (!n) break;
    const A = Array.from({ length: n }, () => new Array(n).fill(0)), v = new Array(n).fill(0);
    rs.forEach((r, i) => { const t = r.y - r.x - r.shift, z = feats.map((f) => f(r)); for (let a = 0; a < n; a++) { v[a] += wts[i] * z[a] * t; for (let b = 0; b < n; b++) A[a][b] += wts[i] * z[a] * z[b]; } });
    const nb = solve(A, v), moved = Math.max(...nb.map((x, j) => Math.abs(x - beta[j]))); beta = nb;
    const e = rs.map((r) => r.y - r.x - r.shift - feats.reduce((a, f, j) => a + beta[j] * f(r), 0)), s = 1.4826 * [...e.map(Math.abs)].sort((a, b) => a - b)[Math.floor(e.length / 2)] || 1;
    wts = e.map((x) => (Math.abs(x) <= k * s ? 1 : k * s / Math.abs(x)));
    if (moved < 1e-7 && it > 3) break;
  }
  residualize(rs, (r) => feats.reduce((a, f, j) => a + beta[j] * f(r), 0));
  return beta;
}
const rms = (xs) => Math.sqrt(mean(xs.map((x) => x * x)));
const robustSd = (xs) => 1.4826 * [...xs.map(Math.abs)].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const r3 = (x) => Math.round(x * 1000) / 1000;

if (process.argv[1] && process.argv[1].endsWith("calibrate-state-swing.mjs")) {
  const all = PAIRS.flatMap(pairRows);
  const FEATS = [(r) => r.rec, (r) => r.ret];
  const out = { _about: "calibrate-state-swing.mjs: sitting-member terms and district noise of the logit swing at state elections fought on unchanged boundaries (Victoria 2018, Queensland 2020 and 2024, NSW 2019), statewide totals given. rec = the party's member stands again; ret = the party held the district and its member does not stand; both against districts the party did not hold, logit scale. se from a bootstrap over districts. pooled = both major parties fitted together (their own terms do not differ significantly: partyDifference), which is what the Victorian model uses. sigma = the districts' spread around the swing after the terms (rms and a robust SD), plain = the same on the swing alone.",
    pairs: PAIRS.map((p) => ({ ...p, districts: new Set(all.filter((r) => r.E === p.id).map((r) => r.div)).size })), terms: {}, byElection: {}, sigma: {}, plain: {} };
  // seeded bootstrap
  let seed = 20261128; const rnd = () => { seed = (seed + 0x6D2B79F5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= (t + Math.imul(t ^ (t >>> 7), t | 61)) >>> 0; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  for (const b of GROUPS) {
    const rs = all.filter((r) => r.b === b).map((r) => ({ ...r }));
    const plain = rs.map((r) => ({ ...r })); residualize(plain, () => 0);
    out.plain[b] = { n: rs.length, rms: r3(rms(plain.map((r) => r.e))), robust: r3(robustSd(plain.map((r) => r.e))), byElection: Object.fromEntries(PAIRS.map((p) => [p.id, r3(rms(plain.filter((r) => r.E === p.id).map((r) => r.e)))]).filter(([, v]) => !Number.isNaN(v))) };
    if (!INC.includes(b)) { out.sigma[b] = out.plain[b]; continue; }
    const beta = fit(rs, FEATS);
    const keys = [...new Set(rs.map((r) => r.E + "|" + r.div))], boots = [];
    for (let i = 0; i < 400; i++) { const pick = new Map(); for (let k = 0; k < keys.length; k++) { const q = keys[Math.floor(rnd() * keys.length)]; pick.set(q, (pick.get(q) || 0) + 1); } const bs = []; for (const r of rs) { const m = pick.get(r.E + "|" + r.div) || 0; for (let j = 0; j < m; j++) bs.push({ ...r }); } boots.push(fit(bs, FEATS)); }
    const se = FEATS.map((_, j) => { const xs = boots.map((x) => x[j]), m = mean(xs); return Math.sqrt(mean(xs.map((x) => (x - m) ** 2))); });
    out.terms[b] = { rec: r3(beta[0]), recSe: r3(se[0]), ret: r3(beta[1]), retSe: r3(se[1]), gap: r3(beta[0] - beta[1]), gapSe: r3((() => { const xs = boots.map((x) => x[0] - x[1]), m = mean(xs); return Math.sqrt(mean(xs.map((x) => (x - m) ** 2))); })()),
      n: { rec: sum(rs.map((r) => r.rec)), ret: sum(rs.map((r) => r.ret)), other: rs.filter((r) => !r.rec && !r.ret).length } };
    out.byElection[b] = Object.fromEntries(PAIRS.map((p) => { const sub = rs.filter((r) => r.E === p.id).map((r) => ({ ...r })); const bb = fit(sub, FEATS); return [p.id, { rec: r3(bb[0]), ret: r3(bb[1]), n: { rec: sum(sub.map((r) => r.rec)), ret: sum(sub.map((r) => r.ret)) } }]; }));
    out.sigma[b] = { n: rs.length, rms: r3(rms(rs.map((r) => r.e))), robust: r3(robustSd(rs.map((r) => r.e))), byElection: Object.fromEntries(PAIRS.map((p) => [p.id, r3(rms(rs.filter((r) => r.E === p.id).map((r) => r.e)))])) };
    console.log(`${b}: member stands again ${beta[0] >= 0 ? "+" : ""}${beta[0].toFixed(3)} (se ${se[0].toFixed(3)}, n ${out.terms[b].n.rec}); member gone ${beta[1] >= 0 ? "+" : ""}${beta[1].toFixed(3)} (se ${se[1].toFixed(3)}, n ${out.terms[b].n.ret}); gap ${out.terms[b].gap} (se ${out.terms[b].gapSe})`);
    console.log(`   by election: ${Object.entries(out.byElection[b]).map(([k, v]) => `${k} rec ${v.rec} (${v.n.rec}) ret ${v.ret} (${v.n.ret})`).join(" | ")}`);
    console.log(`   district spread: plain rms ${out.plain[b].rms} (robust ${out.plain[b].robust}), with terms rms ${out.sigma[b].rms} (robust ${out.sigma[b].robust}); by election ${JSON.stringify(out.sigma[b].byElection)}`);
  }
  for (const b of ["grn", "onp"]) console.log(`${b}: plain district spread rms ${out.plain[b].rms} (robust ${out.plain[b].robust}), n ${out.plain[b].n}; by election ${JSON.stringify(out.plain[b].byElection)}`);
  /* the two major parties together: their own terms do not differ significantly (the bootstrap of the
     difference below), so the Victorian model uses one pair for both - and for the Greens, whose sitting
     members are too few to fit, as the federal model has them borrow */
  {
    const rs = all.filter((r) => INC.includes(r.b)).map((r) => ({ ...r }));
    const beta = fit(rs, FEATS);
    const keys = [...new Set(rs.map((r) => r.E + "|" + r.div))], boots = [], diffs = [];
    for (let i = 0; i < 400; i++) {
      const pick = new Map(); for (let k = 0; k < keys.length; k++) { const q = keys[Math.floor(rnd() * keys.length)]; pick.set(q, (pick.get(q) || 0) + 1); }
      const bs = []; for (const r of rs) { const m = pick.get(r.E + "|" + r.div) || 0; for (let j = 0; j < m; j++) bs.push({ ...r }); }
      boots.push(fit(bs, FEATS));
      const a = fit(bs.filter((r) => r.b === "alp").map((r) => ({ ...r })), FEATS), l = fit(bs.filter((r) => r.b === "lnp").map((r) => ({ ...r })), FEATS);
      diffs.push([a[0] - l[0], a[1] - l[1]]);
    }
    const sd = (xs) => { const m = mean(xs); return Math.sqrt(mean(xs.map((x) => (x - m) ** 2))); };
    out.pooled = { rec: r3(beta[0]), recSe: r3(sd(boots.map((x) => x[0]))), ret: r3(beta[1]), retSe: r3(sd(boots.map((x) => x[1]))),
      n: { rec: sum(rs.map((r) => r.rec)), ret: sum(rs.map((r) => r.ret)), other: rs.filter((r) => !r.rec && !r.ret).length },
      sigma: { rms: r3(rms(rs.map((r) => r.e))), robust: r3(robustSd(rs.map((r) => r.e))), alp: r3(rms(rs.filter((r) => r.b === "alp").map((r) => r.e))), lnp: r3(rms(rs.filter((r) => r.b === "lnp").map((r) => r.e))) },
      partyDifference: { rec: r3(out.terms.alp.rec - out.terms.lnp.rec), recSe: r3(sd(diffs.map((x) => x[0]))), ret: r3(out.terms.alp.ret - out.terms.lnp.ret), retSe: r3(sd(diffs.map((x) => x[1]))) } };
    const z = (d, se) => Math.abs(d / se).toFixed(1);
    console.log(`both major parties: member stands again ${beta[0] >= 0 ? "+" : ""}${beta[0].toFixed(3)} (se ${out.pooled.recSe}, n ${out.pooled.n.rec}); member gone ${beta[1].toFixed(3)} (se ${out.pooled.retSe}, n ${out.pooled.n.ret}); district spread alp ${out.pooled.sigma.alp} lnp ${out.pooled.sigma.lnp}`);
    console.log(`   Labor minus Coalition: stands again ${out.pooled.partyDifference.rec} (se ${out.pooled.partyDifference.recSe}, z ${z(out.pooled.partyDifference.rec, out.pooled.partyDifference.recSe)}); gone ${out.pooled.partyDifference.ret} (se ${out.pooled.partyDifference.retSe}, z ${z(out.pooled.partyDifference.ret, out.pooled.partyDifference.retSe)})`);
  }
  // the Liberal card's reversal, 2010 -> 2013
  const flow = (y, name) => { const dv = J(`map/data/res-${y}.json`).divs.find((d) => d.n === name); const fin = dv.tcp.map((t) => dv.c[t[0]][3]); if (fin.slice().sort().join("|") !== "alp|grn") throw new Error(`${name} ${y}: not a Labor v Greens count`); const ai = fin.indexOf("alp"); let a = 0, n = 0; for (const f of dv.fl) if (dv.c[f[0]][3] === "lnp") { a += f[1 + ai]; n += f[1] + f[2]; } return { a, n }; };
  const cardRows = ["Melbourne", "Batman"].map((name) => { const x = flow(2010, name), y = flow(2013, name); return { division: name, toLabor2010: r3(x.a / x.n), votes2010: x.n, toLabor2013: r3(y.a / y.n), votes2013: y.n }; });
  const pool = (k, v) => sum(cardRows.map((r) => r[k] * r[v])) / sum(cardRows.map((r) => r[v]));
  const against = pool("toLabor2010", "votes2010"), withCard = pool("toLabor2013", "votes2013");
  out.card = { _about: "Coalition voters' preferences reaching Labor in Labor v Greens counts: 2010, the Liberal card put the Greens ahead of Labor; 2013, Labor ahead of the Greens. follow = the difference: the share of the party's voters who went where the card pointed.", rows: cardRows, against: r3(against), with: r3(withCard), follow: r3(withCard - against) };
  console.log(`card: Coalition voters to Labor ${(100 * against).toFixed(1)}% with the card against (2010), ${(100 * withCard).toFixed(1)}% with it (2013): ${(100 * out.card.follow).toFixed(1)}% followed`);
  writeFileSync("data/seat-model-state-swing.json", JSON.stringify(out, null, 1) + "\n");
  console.log("wrote data/seat-model-state-swing.json");
}
