import assert from 'node:assert/strict';
import fs from 'node:fs';
import { cohesionModel } from './dawn/cohesion-model.mjs';

const page = fs.readFileSync(new URL('../dawn/mood/index.html', import.meta.url), 'utf8');
assert.ok(page.indexOf('id="cohesion"') > page.indexOf('id="life"'));
const { cohesion } = JSON.parse(page.match(/<script[^>]*id="dawn-data"[^>]*>(.*?)<\/script>/s)[1]);
const { sec, trend, scanlon, domains } = cohesion;
assert.equal(trend.length, sec.length);
assert.ok(scanlon.every(r => r.length === domains.length + 1));
const polls = JSON.parse(fs.readFileSync(new URL('../data/polls.json', import.meta.url))).direction;
const waves = sec.map(([d,g,b]) => {
  const p = polls.find(r => r.pollster === 'SEC Newgate' && r.date.startsWith(d));
  return [d,g,b,p?.sampleEff || (p?.sample || 1500)/1.6];
});
assert.deepEqual(cohesionModel(waves), trend);
for (const r of trend) {
  for (const q of [r.good, r.poor]) assert.ok(0 < q.lo && q.lo <= q.v && q.v <= q.hi && q.hi < 100);
  assert.ok(r.good.v + r.poor.v < 100);
}
const prefix = cohesionModel(waves.slice(0, 4));
assert.deepEqual(prefix[3].forecast, trend[3].forecast, 'future waves cannot affect a forecast');
const mae = previous => trend.slice(1).reduce((sum,r,i) => {
  const f = previous ? [trend[i].g, trend[i].b] : r.forecast;
  return sum + Math.abs(f[0]-r.g) + Math.abs(f[1]-r.b);
}, 0)/(2*(trend.length-1));
console.log('Forecast MAE (points): model', mae(false).toFixed(2), 'previous wave', mae(true).toFixed(2));
for (const speed of [.04,.09,.18,.36]) {
  const rows = cohesionModel(waves,[speed]);
  console.log('Monthly logit SD', speed, 'latest two good shares', rows.slice(-2).map(r=>r.good.v));
}
