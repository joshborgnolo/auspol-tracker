#!/usr/bin/env node
// Reconstruct table rows from ocr-image.swift JSON output.
import { readFileSync, writeFileSync } from 'fs';
const inPath = process.argv[2];
const outPath = process.argv[3];
const lines = JSON.parse(readFileSync(inPath, 'utf8'));
// group into rows: sort by y, cluster within 0.6*median height
const sorted = [...lines].sort((a, b) => a.y - b.y || a.x - b.x);
const hs = sorted.map(l => l.h).sort((a, b) => a - b);
const mh = hs[Math.floor(hs.length / 2)] || 0.01;
const rows = [];
for (const l of sorted) {
  const cy = l.y + l.h / 2;
  let row = rows.find(r => Math.abs(r.cy - cy) < mh * 0.8);
  if (!row) { row = { cy, cells: [] }; rows.push(row); }
  row.cells.push(l);
  row.cy = (row.cy * (row.cells.length - 1) + cy) / row.cells.length;
}
rows.sort((a, b) => a.cy - b.cy);
let out = '';
for (const r of rows) {
  r.cells.sort((a, b) => a.x - b.x);
  let s = '';
  let right = 0;
  for (const c of r.cells) {
    const gapSpaces = Math.max(1, Math.round((c.x - right) * 90));
    s += ' '.repeat(gapSpaces) + c.text;
    right = c.x + c.w;
  }
  out += s + '\n';
}
writeFileSync(outPath, out);
console.log(`rows=${rows.length} cells=${lines.length} -> ${outPath}`);
