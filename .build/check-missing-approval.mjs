// One-off: waves present in Newspoll netsat/better-pm CSVs (restricted to the
// tracker's coverage window, 2007 election onward) whose approval cells are
// missing in tracker cycleApproval, and whether primaries exist. Pre-window
// archive waves (1985–2007) are in the CSVs but intentionally never tracked,
// so they're not reported. Clean run = 0 missing in both sections.
import { readFileSync } from 'node:fs';

const WAVE_LO = '2007-11-23'; // tracker coverage starts with the 2007 term

const polls = JSON.parse(readFileSync('data/polls.json', 'utf8'));
const DAY = 86400000;
const near = (a, b, tol) => Math.abs(new Date(a) - new Date(b)) <= tol * DAY;
const flat = (obj) => Object.values(obj).flat();

const csvRows = (file) => {
  const [head, ...lines] = readFileSync(file, 'utf8').trim().split('\n');
  return { cols: head.split(','), rows: lines.map(l => l.split(',')) };
};

const netsat = csvRows('data/newspoll-leader-net-satisfaction.csv');
const betterpm = csvRows('data/newspoll-better-pm.csv');

const npApproval = flat(polls.cycleApproval).filter(p => p.firm === 'Newspoll');
const npPolls = flat(polls.cyclePolls).filter(p => p.firm === 'Newspoll');

const missing = [];
for (const cells of netsat.rows) {
  const date = cells[0];
  if (!cells.slice(1).some(c => c !== '')) continue;
  if (date < WAVE_LO) continue; // archive-only: before tracker coverage
  if (date > '2022-05-21') continue; // outside tracked cycles (2025 cycle ongoing)
  const hit = npApproval.find(t => near(t.date, date, 4));
  const prim = npPolls.some(t => near(t.date, date, 4));
  if (!hit) {
    missing.push({ date, kind: 'no cycleApproval wave at all', primaries: prim ? 'yes' : 'NO' });
  } else if (hit.pmNet == null && hit.oppNet == null) {
    missing.push({ date, kind: 'wave present, netsat cells null', primaries: prim ? 'yes' : 'NO' });
  }
}

console.log('Newspoll cycleApproval rows:', npApproval.length, '| csv netsat waves:', netsat.rows.length);
console.log('csv waves lacking tracker approval cells:', missing.length);
for (const m of missing) console.log(' ', m.date, '|', m.kind, '| primaries in cyclePolls:', m.primaries);

// Also: tracker Newspoll approval waves with null ppm cells where better-pm CSV has values
const ppmMissing = [];
for (const cells of betterpm.rows) {
  const date = cells[0];
  if (!cells.slice(1).some(c => c !== '')) continue;
  if (date < WAVE_LO) continue;
  if (date > '2022-05-21') continue;
  const hit = npApproval.find(t => near(t.date, date, 4));
  if (hit && hit.pmPpm == null && hit.oppPpm == null) {
    ppmMissing.push(date);
  }
}
console.log('waves where tracker lacks PPM but csv has it:', ppmMissing.length, ppmMissing.join(' '));
