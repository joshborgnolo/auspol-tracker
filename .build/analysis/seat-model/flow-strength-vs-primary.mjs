// flow-strength-vs-primary.mjs — does a donor party's primary strength in a
// seat predict the split of its preferences in that seat? One-off analysis of
// data/aec-2025-seat-flows.json (W2), 2026-10-13. Findings and methodology in
// flow-strength-findings.md. Read-only; run from the repo root:
//   node .build/analysis/seat-model/flow-strength-vs-primary.mjs
import { readFileSync } from 'node:fs';

const D = JSON.parse(readFileSync('data/aec-2025-seat-flows.json', 'utf8'));
const COAL = new Set(['lp', 'lnp', 'np', 'clp']);
const DONORS = ['grn', 'on', 'oth'];
const BINS = {
  grn: [0, 5, 8, 11, 14, 18, Infinity],
  on: [0, 3, 5, 7, 9, 12, Infinity],
  oth: [0, 8, 12, 16, 20, 25, Infinity],
};

// Per seat: primary votes per group, and each donor's attributed flow pile.
const recs = [];
for (const s of D.seats) {
  const prim = {};
  for (const c of s.candidates) prim[c.group] = (prim[c.group] || 0) + c.votes;
  const formal = Object.values(prim).reduce((a, b) => a + b, 0);
  for (const g of DONORS) {
    const fl = s.groups[g];
    if (!fl) {
      recs.push({ seat: s.name, donor: g, missing: true, share: (prim[g] || 0) / formal * 100 });
      continue;
    }
    const toAlp = fl.alp || 0;
    const toCoal = Object.entries(fl).filter(([k]) => COAL.has(k)).reduce((a, [, v]) => a + v, 0);
    const pile = Object.values(fl).reduce((a, b) => a + b, 0);
    if (toAlp + toCoal === 0) continue; // both majors gone before the donor left
    recs.push({
      seat: s.name, donor: g, missing: false,
      share: (prim[g] || 0) / formal * 100,
      y: toAlp / (toAlp + toCoal) * 100,
      pile, own: prim[g] || 0, toAlp, toCoal,
    });
  }
}

const wmean = (xs, ws) => xs.reduce((a, x, i) => a + x * ws[i], 0) / ws.reduce((a, b) => a + b, 0);
function pearson(xs, ys, ws) {
  const mx = wmean(xs, ws), my = wmean(ys, ws);
  let cov = 0, vx = 0, vy = 0;
  for (let i = 0; i < xs.length; i++) {
    const w = ws[i], dx = xs[i] - mx, dy = ys[i] - my;
    cov += w * dx * dy; vx += w * dx * dx; vy += w * dy * dy;
  }
  return cov / Math.sqrt(vx * vy);
}
const rank = (v) => {
  const order = [...v.keys()].sort((a, b) => v[a] - v[b]);
  const r = new Array(v.length);
  order.forEach((idx, pos) => { r[idx] = pos; });
  return r;
};
function wls(xs, ys, ws) {
  const mx = wmean(xs, ws), my = wmean(ys, ws);
  let num = 0, den = 0;
  for (let i = 0; i < xs.length; i++) { num += ws[i] * (xs[i] - mx) * (ys[i] - my); den += ws[i] * (xs[i] - mx) ** 2; }
  return num / den;
}

for (const g of DONORS) {
  const all = recs.filter((r) => r.donor === g);
  const miss = all.filter((r) => r.missing).sort((a, b) => b.share - a.share);
  const sub = all.filter((r) => !r.missing);
  const xs = sub.map((r) => r.share), ys = sub.map((r) => r.y), ws = sub.map(() => 1);
  const piles = sub.map((r) => r.pile);
  const pAlp = sub.reduce((a, r) => a + r.toAlp, 0), pCoal = sub.reduce((a, r) => a + r.toCoal, 0);
  console.log(`\n=== ${g} ===  flow observed in ${sub.length + miss.length > 0 ? sub.length : 0} of 150 seats; ALP share of pooled majors flow ${(pAlp / (pAlp + pCoal) * 100).toFixed(1)}%`);
  console.log(`  r unweighted ${pearson(xs, ys, ws).toFixed(3)}  pile-weighted ${pearson(xs, ys, piles).toFixed(3)}  spearman ${pearson(rank(xs), rank(ys), ws).toFixed(3)}`);
  console.log(`  slope unweighted ${wls(xs, ys, ws).toFixed(3)} pp/pp   pile-weighted ${wls(xs, ys, piles).toFixed(3)} pp/pp`);
  const bins = BINS[g];
  for (let i = 0; i + 1 < bins.length; i++) {
    const b = sub.filter((r) => r.share >= bins[i] && r.share < bins[i + 1]);
    if (!b.length) continue;
    const a = b.reduce((s2, r) => s2 + r.toAlp, 0), c = b.reduce((s2, r) => s2 + r.toCoal, 0);
    console.log(`    bin ${bins[i]}${bins[i + 1] === Infinity ? '+' : `-${bins[i + 1]}`}: n=${b.length}  wgt ALP ${(a / (a + c) * 100).toFixed(1)}%`);
  }
  if (miss.length) console.log(`    no flow row (${miss.length}): ${miss.map((m) => `${m.seat} ${m.share.toFixed(1)}%`).join(', ')}`);
  const ratios = sub.map((r) => r.own / r.pile).sort((a, b) => a - b);
  console.log(`    median own-share of pile ${ratios[Math.floor(ratios.length / 2)].toFixed(2)}`);
}
