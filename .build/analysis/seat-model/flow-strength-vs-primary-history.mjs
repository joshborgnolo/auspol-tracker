// flow-strength-vs-primary-history.mjs — does the 2025 donor-strength finding
// (flow-strength-findings.md) replicate on 2022, 2019 and 2016? Same method,
// same AEC DoP-by-division product, earlier events (20499/24310/27966).
// Reads the vendored DoP CSVs from the gitignored seat-model cache:
//   cd .build/analysis/seat-model/cache && for EV in 27966 24310 20499; do
//     curl -sSfLO "https://results.aec.gov.au/$EV/Website/Downloads/HouseDopByDivisionDownload-$EV.csv"
//   done
// Read-only; run from the repo root:
//   node .build/analysis/seat-model/flow-strength-vs-primary-history.mjs
//
// Deliberate differences from the 2025 analysis (flow-strength-vs-primary.mjs):
// there is no historical W3 baseline, so elected crossbenchers are NOT split
// into member:<surname> groups — they stay 'oth'. They are never excluded
// (every one reached the final count), so donor rows are unaffected; only
// 'oth' primary shares are diluted by their votes. Named in findings.
import { readFileSync } from 'node:fs';

const EVENTS = [
  { year: 2016, event: '20499' },
  { year: 2019, event: '24310' },
  { year: 2022, event: '27966' },
];
const DIR = '.build/analysis/seat-model/cache';
const COAL = new Set(['lp', 'lnp', 'np', 'clp']);
const DONORS = ['grn', 'on', 'oth'];
const BINS = {
  grn: [0, 5, 8, 11, 14, 18, Infinity],
  on: [0, 3, 5, 7, 9, 12, Infinity],
  oth: [0, 8, 12, 16, 20, 25, Infinity],
};
const GROUP_OF = { ALP: 'alp', GRN: 'grn', ON: 'on', LP: 'lp', NP: 'np', LNP: 'lnp', CLP: 'clp' };
const PARTY_ALIAS = { GVIC: 'GRN' }; // AEC's own VIC Greens code, present in 2019/2022/2025 DoP files

function splitRow(line) {
  const out = []; let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else inQ = false; }
      else cur += ch;
    } else if (ch === '"' && cur === '') inQ = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}
const num = (v) => Number(v) || 0;

function parseEvent(file) {
  const lines = readFileSync(file, 'utf8').trim().split(/\r?\n/);
  const head = splitRow(lines[1]);
  const rows = lines.slice(2).map((l) => Object.fromEntries(splitRow(l).map((c, i) => [head[i], c])));
  const byDiv = new Map();
  for (const r of rows) {
    if (!byDiv.has(r.DivisionID)) byDiv.set(r.DivisionID, []);
    byDiv.get(r.DivisionID).push(r);
  }
  const seats = [];
  for (const [, divRows] of byDiv) {
    const division = divRows[0].DivisionNm;
    const roster = new Map();
    const candidates = [];
    for (const r of divRows.filter((x) => x.CountNumber === '0' && x.CalculationType === 'Preference Count')) {
      roster.set(r.CandidateID, candidates.length);
      const code = PARTY_ALIAS[r.PartyAb] ?? r.PartyAb;
      candidates.push({ group: GROUP_OF[code] ?? 'oth', votes: num(r.CalculationValue) });
    }
    const counts = [...new Set(divRows.map((r) => r.CountNumber))].map(Number).sort((a, b) => a - b);
    const groups = {};
    let exclusions = 0;
    for (const k of counts.slice(1)) {
      const trf = divRows.filter((r) => num(r.CountNumber) === k && r.CalculationType === 'Transfer Count');
      const out_ = trf.filter((r) => num(r.CalculationValue) < 0);
      if (out_.length !== 1) throw new Error(`${division} count ${k}: ${out_.length} exclusion rows`);
      const excl = roster.get(out_[0].CandidateID);
      const pile = -num(out_[0].CalculationValue);
      let got = 0;
      for (const r of trf) {
        if (r.CandidateID === out_[0].CandidateID) continue;
        const v = num(r.CalculationValue);
        if (!v) continue;
        got += v;
        const g = candidates[roster.get(r.CandidateID)].group;
        const from = candidates[excl].group;
        (groups[from] ??= {})[g] = (groups[from][g] ?? 0) + v;
      }
      if (got !== pile) throw new Error(`${division} count ${k}: pile ${pile} but transfers sum ${got} — exhaustion would break parity with the 2025 method`);
      exclusions++;
    }
    if (exclusions !== candidates.length - 2) throw new Error(`${division}: ${exclusions} exclusions for ${candidates.length} candidates`);
    seats.push({ name: division, candidates, groups });
  }
  return seats;
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
  let num2 = 0, den = 0;
  for (let i = 0; i < xs.length; i++) { num2 += ws[i] * (xs[i] - mx) * (ys[i] - my); den += ws[i] * (xs[i] - mx) ** 2; }
  return num2 / den;
}

for (const { year, event } of EVENTS) {
  const seats = parseEvent(`${DIR}/HouseDopByDivisionDownload-${event}.csv`);
  console.log(`\n############ ${year} (event ${event}, ${seats.length} divisions) ############`);
  const recs = [];
  for (const s of seats) {
    const prim = {};
    for (const c of s.candidates) prim[c.group] = (prim[c.group] || 0) + c.votes;
    const formal = Object.values(prim).reduce((a, b) => a + b, 0);
    for (const g of DONORS) {
      const share = (prim[g] || 0) / formal * 100;
      const fl = s.groups[g];
      if (!fl) {
        if (share > 0.05) recs.push({ donor: g, missing: true, seat: s.name, share });
        continue;
      }
      const toAlp = fl.alp || 0;
      const toCoal = [...COAL].reduce((a, k) => a + (fl[k] || 0), 0);
      const pile = Object.values(fl).reduce((a, b) => a + b, 0);
      if (toAlp + toCoal === 0) continue;
      recs.push({ donor: g, missing: false, seat: s.name, share, y: toAlp / (toAlp + toCoal) * 100, pile, own: prim[g] || 0, toAlp, toCoal });
    }
  }
  for (const g of DONORS) {
    const all = recs.filter((r) => r.donor === g);
    const miss = all.filter((r) => r.missing).sort((a, b) => b.share - a.share);
    const sub = all.filter((r) => !r.missing);
    const nRun = seats.filter((s) => s.candidates.some((c) => c.group === g)).length;
    const xs = sub.map((r) => r.share), ys = sub.map((r) => r.y), ones = sub.map(() => 1);
    const piles = sub.map((r) => r.pile);
    const pAlp = sub.reduce((a, r) => a + r.toAlp, 0), pCoal = sub.reduce((a, r) => a + r.toCoal, 0);
    console.log(`\n=== ${g} ===  ${nRun}/${seats.length} seats contested; flow rows ${sub.length}; pooled ALP share of majors flow ${(pAlp / (pAlp + pCoal) * 100).toFixed(1)}%`);
    if (sub.length >= 8) {
      console.log(`  r unweighted ${pearson(xs, ys, ones).toFixed(3)}  pile-weighted ${pearson(xs, ys, piles).toFixed(3)}  spearman ${pearson(rank(xs), rank(ys), ones).toFixed(3)}`);
      console.log(`  slope unweighted ${wls(xs, ys, ones).toFixed(3)} pp/pp   pile-weighted ${wls(xs, ys, piles).toFixed(3)} pp/pp`);
      const bins = BINS[g];
      for (let i = 0; i + 1 < bins.length; i++) {
        const b = sub.filter((r) => r.share >= bins[i] && r.share < bins[i + 1]);
        if (!b.length) continue;
        const a = b.reduce((s2, r) => s2 + r.toAlp, 0), c = b.reduce((s2, r) => s2 + r.toCoal, 0);
        console.log(`    bin ${bins[i]}${bins[i + 1] === Infinity ? '+' : `-${bins[i + 1]}`}: n=${b.length}  wgt ALP ${(a / (a + c) * 100).toFixed(1)}%`);
      }
      const ratios = sub.map((r) => r.own / r.pile).sort((a, b) => a - b);
      console.log(`    median own-share of pile ${ratios[Math.floor(ratios.length / 2)].toFixed(2)}`);
    } else {
      console.log(`  (too few flow rows for correlation — ${nRun} contested; rows shown raw)`);
      for (const r of sub.sort((a, b) => a.share - b.share)) console.log(`    ${r.seat}: share ${r.share.toFixed(1)}%  ALP ${r.y.toFixed(1)}%  pile ${r.pile}`);
    }
    if (miss.length) console.log(`    contested but never excluded (no flow row): ${miss.map((m) => `${m.seat} ${m.share.toFixed(1)}%`).join(', ')}`);
  }
}
