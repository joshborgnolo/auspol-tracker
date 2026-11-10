#!/usr/bin/env node
// Cross-verify two OCR passes of the 2019 Jan-Mar Newspoll quarterly.
// Column template learnt from the (complete, decimal-printed) Election-2016# LABOR row
// in each pass; Jan-Mar 2019 row tokens assigned to nearest column centre.
// Row-sum check ALP+COAL+GRN+ONP+OTH ~= 100 per column validates the mapping.
import { readFileSync } from 'fs';

const passes = {
  a450: JSON.parse(readFileSync(process.argv[2], 'utf8')), // 450dpi scale1 accurate
  s2:   JSON.parse(readFileSync(process.argv[3], 'utf8')), // 300dpi scale2 accurate
};

const COLS = ['Total','NSW','Vic','Qld','SA','WA','Male','Female','18-34','35-49','50+','FiveCap','NonCap'];
// primary-vote table occupies left block: x < 0.47 of page
const XMAX = 0.47;
// y-band helper: rows within table region
function rowsOf(lines, xmin=0, xmax=XMAX, yLo=0.10, yHi=0.48) {
  const rows = [];
  for (const l of lines) {
    const x = l.x + l.w/2, y = l.y + l.h/2;
    if (x < xmin || x > xmax || y < yLo || y > yHi) continue;
    let row = rows.find(r => Math.abs(r.y - y) < 0.006);
    if (!row) { row = { y, cells: [] }; rows.push(row); }
    row.cells.push({ x, text: l.text });
  }
  rows.sort((a,b)=>a.y-b.y);
  rows.forEach(r => r.cells.sort((a,b)=>a.x-b.x));
  return rows;
}
function findRow(rows, re, labelMustBeLeft=true) {
  for (const r of rows) {
    const leftText = r.cells.filter(c=>c.x<0.09).map(c=>c.text).join(' ');
    if (re.test(leftText)) return r;
  }
  return null;
}
function cleanNum(t) { const s = t.replace(/^[|l•.\s]+/, ''); return /^\d{1,3}(\.\d)?$/.test(s) ? s : null; }
function learnTemplate(row) {
  // Election 2016# LABOR row: 13 numeric cells in column order
  const nums = row.cells.map(c=>({x:c.x, n:cleanNum(c.text)})).filter(c=>c.n!==null);
  if (nums.length < 13) throw new Error(`template row incomplete: ${nums.length} cells`);
  return nums.slice(0,13).map(c=>c.x);
}
function assign(row, tmpl) {
  const out = {};
  for (const c of row.cells) {
    if (c.x < 0.085) continue; // label text
    const n = cleanNum(c.text);
    if (n === null || n.includes('.')) continue; // 2019 rows print whole numbers only
    let best=-1,bd=1e9;
    tmpl.forEach((tx,i)=>{const d=Math.abs(tx-c.x); if(d<bd){bd=d;best=i;}});
    if (bd > 0.02) { (out._stray ??= []).push(c.text); continue; }
    const col = COLS[best];
    if (out[col]) (out._dupe ??= []).push(c.text+'->'+col);
    else out[col] = +n;
  }
  return out;
}

for (const [name, lines] of Object.entries(passes)) {
  const rows = rowsOf(lines);
  const lab16 = findRow(rows, /Election\s*2016/i) || findRow(rows, /Ele[cç]tion\s*201/i);
  if (!lab16) { console.log(`${name}: template row not found`); console.log(rows.map(r=>r.cells.map(c=>c.text).join(' ')).join('\n')); process.exit(1); }
  // ensure it's the LABOR election row (the FIRST Election 2016# row)
  const tmpl = learnTemplate(lab16);
  console.log(`\n=== pass ${name}: template x =`, tmpl.map(x=>x.toFixed(3)).join(' '));
  // find the Jan-Mar 2019 rows (they appear 5 times: under LABOR, COALITION, GREENS, ONE NATION, OTHERS)
  const jm = rows.filter(r => r.cells.some(c=>/Jan.?Mar\s*2019/i.test(c.text) && c.x < 0.12));
  console.log(`found ${jm.length} Jan-Mar2019 rows`);
  const parts = ['LABOR/COAL?','x','x','x','x'];
  const names = ['ROW1(alp)','ROW2(coal)','ROW3(grn)','ROW4(onp)','ROW5(oth)'];
  jm.forEach((r,i)=>{
    const a = assign(r, tmpl);
    console.log(` ${names[i]||'ROW'+i} y=${r.y.toFixed(3)}: ${COLS.map(c=>(a[c]??'.').toString().padStart(3)).join(' ')}${a._stray?' STRAY:'+a._stray.join(','):''}${a._dupe?' DUPE:'+a._dupe.join(','):''}`);
  });
  if (name === 's2') global._s2 = {rows, tmpl};
}
