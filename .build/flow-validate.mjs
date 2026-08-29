#!/usr/bin/env -S node --input-type=module
// Validate AEC-derived flow constants against published 2PP series.
// Reads polls.json, computes implied 2PP by applying each constant set to
// the primary-vote columns, then measures per-house mean residual.
//
// Constant sets (both derived by .build/aec-flows.py from the AEC TCP
// flow-by-party download):
//   AEC 2022 (Event 27966): grn 0.8371  onp→ALP 0.3533  ind 0.5832
//                           oth-no-IND 0.4079  ind+oth lumped 0.4430
//   AEC 2025 (Event 31496): grn 0.8683  onp→ALP 0.2710  ind 0.6356
//                           oth-no-IND 0.4155  ind+oth lumped 0.4849
// 2025's PHON preferences hardened noticeably against Labor (27.1% ALP share,
// down from 35.3%) while Greens (86.8%) and independents (63.6%) moved
// further Labor's way.
//
// Question: which set minimises |mean implied-vs-published| over the houses
// that publish 2PP for the CURRENT term?

import fs from "node:fs";

const D = JSON.parse(fs.readFileSync(new URL("../data/polls.json", import.meta.url), "utf8"));

const SETS = {
  "placeholder {0.82/0.35/0.50}": { grn: 0.82,   onp: 0.35,   ind: 0.50,   oth: 0.50   },
  "AEC-2022 split":               { grn: 0.8371, onp: 0.3533, ind: 0.5832, oth: 0.4079 },
  "AEC-2022 lumped":              { grn: 0.8371, onp: 0.3533, ind: 0.4430, oth: 0.4430 },
  "AEC-2025 split":               { grn: 0.8683, onp: 0.2710, ind: 0.6356, oth: 0.4155 },
  "AEC-2025 lumped":              { grn: 0.8683, onp: 0.2710, ind: 0.4849, oth: 0.4849 },
};

const n0 = (v) => (v == null ? 0 : v);

function implied(p, c) {
  if (p.alp == null) return null;
  return p.alp
    + c.grn * n0(p.grn)
    + c.onp * n0(p.onp)
    + c.ind * n0(p.ind)
    + c.oth * n0(p.oth);
}

const rows = D.polls.filter((p) => !p.isElection && p.tpp_alp != null && p.alp != null);
console.log(`n = ${rows.length} polls with both primary-ALP and published 2PP\n`);

function eval_set(label, c) {
  const byHouse = new Map();
  for (const p of rows) {
    const im = implied(p, c);
    if (im == null) continue;
    if (!byHouse.has(p.pollster)) byHouse.set(p.pollster, []);
    byHouse.get(p.pollster).push(p.tpp_alp - im);
  }
  const errs = [];
  for (const [h, ds] of byHouse) {
    if (ds.length < 5) continue;
    const m = ds.reduce((a, b) => a + b, 0) / ds.length;
    const mad = ds.reduce((a, b) => a + Math.abs(b), 0) / ds.length;
    errs.push({ h, n: ds.length, mean: m, mad });
  }
  errs.sort((a, b) => Math.abs(b.mean) - Math.abs(a.mean));
  const overall = errs.length
    ? errs.reduce((a, e) => a + Math.abs(e.mean), 0) / errs.length
    : 0;
  console.log(`── ${label} ──`);
  for (const e of errs)
    console.log(`  ${e.h.padEnd(20)} n=${String(e.n).padStart(3)}  mean ${e.mean >= 0 ? "+" : ""}${e.mean.toFixed(2)}   mad ${e.mad.toFixed(2)}`);
  console.log(`  mean |house bias| = ${overall.toFixed(3)}\n`);
  return overall;
}

for (const [label, c] of Object.entries(SETS)) eval_set(label, c);
