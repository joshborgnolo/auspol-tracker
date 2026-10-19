/* Pins .build/newtracker/assets/pv-agg.js, the Primary tab's client-side
   pollster-subset recompute: with every house ticked its months and headline
   must reproduce the build's own D.aggPrimary and D.latest.primary (small
   tolerance - the client re-runs the estimator on the rounded emitted rows),
   a subset's months may only be months its houses polled in, and an empty
   poll set is the panel's dry state (no headline, no months), never a throw.
   Run after a build: node .build/test-pv-recompute.mjs */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const A = (f) => path.join(ROOT, ".build", "newtracker", "assets", f);
const KEYS = ["alp", "lnp", "grn", "onp", "oth"];
const fresh = (mutate) => {
  const win = {};
  const ctx = vm.createContext({ window: win, React: {}, console });
  win.window = win;
  vm.runInContext(fs.readFileSync(A("9f09dca2-bd46-49a8-8ae1-51847608cf92.js"), "utf8"), ctx);
  vm.runInContext(fs.readFileSync(A("ed2260de-5b11-4bd5-8a8d-a391156c05ee.js"), "utf8"), ctx);
  if (mutate) mutate(win.AP.D, win);
  vm.runInContext(fs.readFileSync(A("pv-agg.js"), "utf8"), ctx);
  return win.AP;
};

/* ---- the payload the panel gates the menu on */
{
  const AP = fresh();
  const { aggSpec, pvHouses } = AP.D;
  assert.ok(aggSpec && typeof aggSpec === "object", "aggSpec emitted");
  for (const k of ["window", "half", "taper", "deff", "sampleCap", "heWindow", "heHalf", "shrinkK"])
    assert.ok(Number.isFinite(aggSpec[k]), "aggSpec." + k + " is a number");
  assert.ok(Array.isArray(pvHouses) && pvHouses.length >= 5, "pvHouses names the aggregating houses");
  for (const h of pvHouses)
    assert.ok(AP.D.individualPolls.some((q) => q.pollster === h && !q.noAgg), h + " has aggregating rows");
  assert.equal(typeof AP.pvAgg, "function", "pv-agg.js installs window.AP.pvAgg");
}

/* ---- all houses ticked: the client recompute reproduces the build's own figures */
{
  const AP = fresh();
  const all = AP.pvAgg(AP.D.pvHouses);
  const serverMonths = AP.D.aggPrimary.slice(1); // [0] is the election row, which the client layer never carries
  assert.equal(all.months.length, serverMonths.length, "every month the server aggregates, the subset layer does");
  for (let i = 0; i < serverMonths.length; i++) {
    const a = all.months[i], b = serverMonths[i];
    assert.equal(a.ym, b.ym, "month " + i + " aligns");
    for (const k of KEYS) assert.ok(Math.abs(a[k] - b[k]) <= 0.2, `${a.ym} ${k}: ${a[k]} ≈ ${b[k]}`);
    for (const k of KEYS) assert.ok(Math.abs((a.ci[k] || 0) - (b.ci[k] || 0)) <= 0.35, `${a.ym} ${k} ci ≈`);
  }
  assert.ok(all.now, "a full-house headline exists");
  for (const k of KEYS) assert.ok(Math.abs(all.now[k] - AP.D.latest.primary[k]) <= 0.2, `now ${k}: ${all.now[k]} ≈ ${AP.D.latest.primary[k]}`);
  assert.ok(Math.abs(KEYS.reduce((s, k) => s + all.now[k], 0) - 100) <= 1.5, "rescale re-fires: the headline still sums to 100");
}

/* ---- a subset only aggregates its own houses' months */
{
  const AP = fresh();
  const counts = new Map();
  for (const q of AP.D.individualPolls) if (!q.noAgg) counts.set(q.pollster, (counts.get(q.pollster) || 0) + 1);
  const [busy] = [...counts.entries()].sort((x, y) => y[1] - x[1])[0];
  const sub = AP.pvAgg([busy]);
  const houseYms = new Set(AP.D.individualPolls.filter((q) => q.pollster === busy && !q.noAgg).map((q) => q.ym));
  assert.ok(sub.months.length > 0, "a frequent house yields months");
  for (const m of sub.months) {
    assert.ok(houseYms.has(m.ym), m.ym + " is a month " + busy + " actually polled in");
    for (const k of KEYS) assert.ok(Number.isFinite(m[k]) && m[k] >= 0 && m[k] <= 100, `${m.ym} ${k} is a sane figure`);
  }
  assert.ok(sub.months.length <= houseYms.size, "no invented months either");
  assert.equal(sub.refNow, AP.pvAgg(AP.D.pvHouses).refNow, "refNow tracks the whole emitted set, not the subset");
}

/* ---- the dry state: nothing in the set -> no headline, no months, no throw */
{
  const AP = fresh((D) => { D.individualPolls = []; });
  const out = AP.pvAgg(AP.D.pvHouses);
  assert.equal(out.now, null, "no polls, no headline (the panel renders headers without figures)");
  assert.equal(out.months.length, 0, "no polls, no months");
}

console.log("PASS: pv recompute – all-house parity with the build's estimator, subset month scoping, the dry state");
