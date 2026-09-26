// Refresh data/allpolls.json, the figures the All polls boards read.
// Usage (from the repo root): node design/redesign-2026-09/gen/extract_allpolls_data.mjs
// Reads the build's own assets: the data asset (window.AUSPOL) and the shared
// helpers that compute poll disagreement (window.AP.discord), so the boards
// quote the numbers the live All polls tab computes.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..');
const ASSETS = path.join(REPO, '.build', 'newtracker', 'assets');
const find = (test) => {
  const f = fs.readdirSync(ASSETS).filter((n) => n.endsWith('.js'))
    .find((n) => test(fs.readFileSync(path.join(ASSETS, n), 'utf8')));
  if (!f) throw new Error('asset not found');
  return fs.readFileSync(path.join(ASSETS, f), 'utf8');
};

const window = {};
globalThis.window = window;
new Function('window', find((s) => s.includes('Generated from data/polls.json by .build/newtracker/gen-data.mjs')))(window);
const React = { useState: () => [], useRef: () => ({}), useMemo: (f) => f(), useCallback: (f) => f, useEffect: () => {}, useId: () => 'x' };
const document = { addEventListener() {}, removeEventListener() {}, documentElement: {} };
// one extra measure beside the site's own: the Coalition and One Nation primaries
// summed, to test whether the pollsters disagree on the right's split or its size
let ap = find((s) => s.includes('const DISCORD_MEASURES'));
ap = ap.replace('{ id: "p_grn",', '{ id: "p_right", facet: "primary", label: "L/NP + ON", color: "x", '
  + 'val: (p) => (p.p.lnp != null && p.p.onp != null ? p.p.lnp + p.p.onp : null), share: (p) => p.p.lnp + p.p.onp },\n    { id: "p_grn",');
new Function('window', 'React', 'document', ap)(window, React, document);

const A = window.AUSPOL;
const discord = {};
for (const f of ['primary', 'twopp', 'leadership'])
  for (const m of window.AP.discordFacet(f))
    discord[m.id] = { facet: f, label: m.label, pts: window.AP.discord(m.id).filter((d) => d.sigma != null)
      .map((d) => ({ ym: d.ym, sigma: +d.sigma.toFixed(3), floor: +d.floor.toFixed(3), R: +d.R.toFixed(3) })) };

const keep = ['pollster', 'client', 'field', 'ym', 'day', 'released', 'published', 'sample', 'sampleEff', 'alp', 'lnp', 'alpN',
  'alpImp', 'alpOnImp', 'p', 'tppAlt', 'tppAlt2', 'tpp3', 'ppmSets', 'appr', 'dir', 'chg', 'eff', 'url', 'releaseUrl', 'methodUrl', 'seats', 'undecided'];
const polls = A.individualPolls.map((p) => Object.fromEntries(keep.filter((k) => p[k] !== undefined).map((k) => [k, p[k]])));

const out = {
  polls, discord,
  synthOn: A.synthOn, synth2pp: A.synth2pp, aggPrimary: A.aggPrimary, alt2pp: A.alt2pp,
  houseEffects: A.houseEffects, houseLean: A.houseLean, flowDrift: A.flowDrift, flowDriftOn: A.flowDriftOn,
  latest: A.latest, leaderNow: A.leaderNow, directionNow: A.directionNow, direction: A.direction, leaderMonths: A.leaderMonths,
  deff: (A.latest && A.latest.method && A.latest.method.deff) || 1.6,
};
fs.writeFileSync(path.join(HERE, '..', 'data', 'allpolls.json'), JSON.stringify(out));
console.log('wrote data/allpolls.json:', polls.length, 'polls,', Object.keys(discord).length, 'disagreement measures');
