// One-off: assimilate Newspoll archive CSV leadership data into tracker
// cycleApproval. Inserts missing waves (netsat + ppm where available) and
// backfills pmPpm/oppPpm on existing Newspoll rows. Dry-run by default;
// pass --apply to write data/polls.json (validates with a no-op write first
// so formatting drift is caught by git diff).
import { readFileSync, writeFileSync } from 'node:fs';

const APPLY = process.argv.includes('--apply');
const DAY = 86400000;
const WAVE_LO = '2007-11-25'; // tracker coverage starts with the 2007 term
const WAVE_HI = '2022-05-21'; // CSV archive scope ends at the 2022 election
const inWindow = (d) => d >= WAVE_LO && d <= WAVE_HI;

const polls = JSON.parse(readFileSync('data/polls.json', 'utf8'));
const csvRows = (file) => {
  const [head, ...lines] = readFileSync(file, 'utf8').trim().split('\n');
  return { cols: head.split(','), rows: lines.map((l) => l.split(',')) };
};
const netsat = csvRows('data/newspoll-leader-net-satisfaction.csv');
const betterpm = csvRows('data/newspoll-better-pm.csv');

// Leader tenure tables (inclusive bounds). Used to map the per-leader CSV
// column to pmNet/oppNet (or pmPpm/oppPpm) for any given wave date.
const PM = [
  ['kevin_rudd', '2007-11-25', '2010-06-23'],
  ['julia_gillard', '2010-06-24', '2013-06-26'],
  ['kevin_rudd', '2013-06-27', '2013-09-06'],
  ['tony_abbott', '2013-09-18', '2015-09-14'],
  ['malcolm_turnbull', '2015-09-15', '2018-08-23'],
  ['scott_morrison', '2018-08-24', '2022-05-22'],
];
const OL = [
  ['brendan_nelson', '2007-11-25', '2008-09-15'],
  ['malcolm_turnbull', '2008-09-16', '2009-11-30'],
  ['tony_abbott', '2009-12-01', '2013-09-06'],
  ['bill_shorten', '2013-10-13', '2019-05-29'],
  ['anthony_albanese', '2019-05-30', '2022-05-21'],
];
const role = (table, date) => table.find(([, a, b]) => date >= a && date <= b)?.[0] ?? null;

// cycleApproval buckets hold waves from the term that follows the keyed election
const cycleFor = (d) => (d < '2010-08-21' ? '2007'
  : d < '2013-09-07' ? '2010'
  : d < '2016-07-02' ? '2013'
  : d < '2019-05-18' ? '2016'
  : d < '2022-05-21' ? '2019'
  : '2022');

const cell = (row, cols, leader) => {
  const i = cols.indexOf(leader);
  const v = i >= 0 ? row[i] : '';
  return v === '' ? null : Number(v);
};
const num = (v, context) => {
  if (v === null || Number.isNaN(v)) throw new Error(`non-numeric cell for ${context}`);
  return v;
};

const nearDays = (a, b) => Math.abs(new Date(a) - new Date(b)) / DAY;
const npApproval = Object.values(polls.cycleApproval).flat().filter((r) => r.firm === 'Newspoll');

const ppmWaves = betterpm.rows
  .map((c) => ({ date: c[0], cells: c }))
  .filter((w) => inWindow(w.date) && w.cells.slice(1).some((x) => x !== ''));
const nearestPpmWave = (date) => {
  let best = null;
  for (const w of ppmWaves) {
    const d = nearDays(w.date, date);
    if (d <= 4 && (!best || d < best.d)) best = { ...w, d };
  }
  return best;
};
// Refuse to cross a leadership transition between tracker date and CSV date
const sameEra = (a, b) => role(PM, a) === role(PM, b) && role(OL, a) === role(OL, b);
const ppmValues = (waveDate, cells) => {
  const pm = role(PM, waveDate); const ol = role(OL, waveDate);
  if (!pm || !ol) return null;
  return { pmPpm: cell(cells, betterpm.cols, pm), oppPpm: cell(cells, betterpm.cols, ol) };
};

const anomalies = [];
const inserted = [];
let ppmBackfilled = 0;
const ppmSkips = [];

// Pass 1: insert missing netsat waves (with ppm cells if a ppm wave exists)
for (const c of netsat.rows) {
  const d = c[0];
  if (!inWindow(d) || !c.slice(1).some((x) => x !== '')) continue;
  const pm = role(PM, d); const ol = role(OL, d);
  if (!pm || !ol) { anomalies.push(`${d}: outside leader-tenure tables (pm=${pm}, ol=${ol})`); continue; }
  const pmNet = cell(c, netsat.cols, pm); const oppNet = cell(c, netsat.cols, ol);
  if (pmNet === null && oppNet === null) { anomalies.push(`${d}: no cells for ${pm}/${ol}`); continue; }
  // unexpected extra leadership cells would signal a wrong era mapping
  const extras = netsat.cols.slice(1).map((n, i) => [n, c[i + 1]]).filter(([n, v]) => v !== '' && n !== pm && n !== ol);
  if (extras.length) anomalies.push(`${d}: extra non-empty columns ${JSON.stringify(extras)}`);
  if (npApproval.some((r) => nearDays(r.date, d) <= 4)) continue; // already tracked
  const row = {
    date: d, firm: 'Newspoll',
    pmNet: num(pmNet, `${d} pmNet`), oppNet: num(oppNet, `${d} oppNet`),
  };
  const w = nearestPpmWave(d);
  if (w && sameEra(d, w.date)) {
    const v = ppmValues(w.date, w.cells);
    if (v && v.pmPpm !== null) row.pmPpm = v.pmPpm;
    if (v && v.oppPpm !== null) row.oppPpm = v.oppPpm;
  }
  inserted.push(row);
}

// Pass 2: backfill pmPpm/oppPpm on existing Newspoll rows that lack them
for (const row of npApproval) {
  if (row.pmPpm != null || row.oppPpm != null) continue;
  const w = nearestPpmWave(row.date);
  if (!w) continue;
  if (!sameEra(row.date, w.date)) { ppmSkips.push(`${row.date} (csv wave ${w.date} crosses a leadership transition)`); continue; }
  const v = ppmValues(w.date, w.cells);
  if (v && v.pmPpm !== null && v.oppPpm !== null) {
    row.pmPpm = v.pmPpm; row.oppPpm = v.oppPpm;
    ppmBackfilled++;
  }
}

// Merge inserted rows and keep each cycle sorted by date, stable on ties
for (const row of inserted) polls.cycleApproval[cycleFor(row.date)].push(row);
for (const [cycle, rows] of Object.entries(polls.cycleApproval)) {
  polls.cycleApproval[cycle] = rows
    .map((r, i) => [r, i])
    .sort((x, y) => (x[0].date < y[0].date ? -1 : x[0].date > y[0].date ? 1 : x[1] - y[1]))
    .map(([r]) => r);
}

const byCycle = {};
for (const r of inserted) byCycle[cycleFor(r.date)] = (byCycle[cycleFor(r.date)] ?? 0) + 1;
console.log(`mode: ${APPLY ? 'APPLY' : 'dry-run'}`);
console.log(`waves inserted: ${inserted.length}`, byCycle);
console.log(`inserted with ppm cells: ${inserted.filter((r) => r.pmPpm != null).length}`);
console.log(`existing rows ppm-backfilled: ${ppmBackfilled}`);
console.log(`anomalies: ${anomalies.length}`); anomalies.forEach((a) => console.log('  !', a));
console.log(`ppm skips (transition window): ${ppmSkips.length}`); ppmSkips.forEach((s) => console.log('  -', s));
console.log('sample inserted:', JSON.stringify(inserted[0] ?? null), '…', JSON.stringify(inserted.at(-1) ?? null));

if (APPLY && anomalies.length === 0) {
  const out = JSON.stringify(polls, null, 2) + '\n';
  writeFileSync('data/polls.json', out);
  console.log(`wrote data/polls.json (${(out.length / 1e6).toFixed(2)} MB)`);
} else if (APPLY) {
  console.error('ABORTED: resolve anomalies before applying');
  process.exit(1);
}
