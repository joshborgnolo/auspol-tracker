// Vote-type bands use counted 2PP totals for the same electorate pool as
// their formal shares, including figures-menu filters and mobile votes.
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const read = (p) => fs.readFileSync(new URL(p, new URL("../", import.meta.url)), "utf8");
const states = { NSW: "New South Wales", VIC: "Victoria", QLD: "Queensland", WA: "Western Australia", SA: "South Australia", TAS: "Tasmania", ACT: "Australian Capital Territory", NT: "Northern Territory" };
const short = { NSW: "NSW", VIC: "Vic", QLD: "Qld", WA: "WA", SA: "SA", TAS: "Tas", ACT: "ACT", NT: "NT" };
let current = { year: 2025, res: JSON.parse(read("map/data/core-2025.json")) };
const S = { lens: "winner" };
const ctx = vm.createContext({
  S, STATE_TITLE: states, STATE_SHORT: short, M: () => current,
  esc: (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])),
  f1: (v) => v == null ? "–" : v.toFixed(1), int: (v) => v.toLocaleString("en-AU"),
  sgn: (v) => v == null ? "–" : (v > .049 ? "+" : v < -.049 ? "−" : "") + Math.abs(v).toFixed(1),
  coalW: () => "the Coalition",
});
vm.runInContext(read(".build/map/app/app-4-story.js"), ctx);
const api = vm.runInContext("({ vtBands, vtScope, vtBlock, statScopeOf })", ctx);
const close = (a, b, note) => assert.ok(Math.abs(a - b) < 1e-9, `${note}: ${a} vs ${b}`);

// Independent count oracle: no rounded vote-type percentages or equal
// weighting of seats. Each band's counts and the area's totals are pooled.
const keys = [["pre", "abs", "prov"], ["ppvc", "post"], ["day", "mob"]];
function checkPool(divs, label) {
  const result = api.vtBands(divs);
  const total = divs.reduce((n, d) => n + d.c.reduce((s, c) => s + c[4], 0), 0);
  const two = divs.reduce((p, d) => [p[0] + d.tpp[0], p[1] + d.tpp[1]], [0, 0]);
  assert.equal(result.tot, total, `${label}: formal votes conserved`);
  close(result.base, 100 * two[0] / (two[0] + two[1]), `${label}: official area 2PP`);
  close(result.bands.reduce((n, b) => n + b.share, 0), 100, `${label}: shares sum to 100`);
  assert.equal(result.bands.reduce((n, b) => n + b.v, 0), total, `${label}: every vote is in one band`);
  let weightedSkew = 0;
  result.bands.forEach((b, i) => {
    const p = divs.reduce((p, d) => keys[i].reduce((p, k) => [p[0] + (d.vt2[k]?.[0] || 0), p[1] + (d.vt2[k]?.[1] || 0)], p), [0, 0]);
    const n = p[0] + p[1];
    if (n) close(b.skew, 100 * p[0] / n - result.base, `${label}: ${b.k} skew from pooled counts`);
    else assert.equal(b.skew, null, `${label}: an empty pile has no skew`);
    weightedSkew += n * (b.skew || 0) / (two[0] + two[1]);
  });
  close(weightedSkew, 0, `${label}: weighted skews balance`);
  // Independently build successive electorate pools in counting order.
  const order = ["day", "mob", "ppvc", "post", "pre", "abs", "prov"];
  const stages = [2, 4, 7].map((end) => {
    const p = divs.reduce((p, d) => order.slice(0, end).reduce((p, k) => [p[0] + (d.vt2[k]?.[0] || 0), p[1] + (d.vt2[k]?.[1] || 0)], p), [0, 0]);
    return p[0] + p[1] ? 100 * p[0] / (p[0] + p[1]) : null;
  });
  result.bands.slice().reverse().forEach((b, i) => {
    if (stages[i] != null) close(b.cumulative, stages[i], `${label}: cumulative ${b.k} 2PP`);
    else assert.equal(b.cumulative, null);
    if (i > 0 && b.n > 0 && stages[i - 1] != null) close(b.effect, stages[i] - stages[i - 1], `${label}: ${b.k} changes the preceding count`);
    else assert.equal(b.effect, null, `${label}: no invented starting or empty-pile effect`);
  });
  close(result.bands[0].cumulative, result.base, `${label}: final cumulative result reaches area 2PP`);
  return result;
}

const national = checkPool(current.res.divs, "nationwide");
assert.deepEqual(Array.from(national.bands, (b) => b.share.toFixed(1)), ["6.8", "52.2", "41.0"]);
assert.deepEqual(Array.from(national.bands, (b) => b.skew.toFixed(1)), ["3.0", "-2.6", "2.7"]);
assert.deepEqual(Array.from(national.bands, (b) => b.effect == null ? null : b.effect.toFixed(1)), ["0.2", "-3.0", null]);
assert.deepEqual(Array.from(national.bands, (b) => b.cumulative.toFixed(1)), ["55.2", "55.0", "58.0"]);
for (const st of Object.keys(states)) {
  Object.assign(api.statScopeOf(current), { k: "st", st });
  const scope = api.vtScope(current, "AUS");
  assert.ok(scope.divs.every((d) => d.st === st));
  assert.equal(scope.geography, short[st]);
  assert.ok(api.vtBlock(scope.divs, true, scope.geography).includes(`Skew on ${short[st]} 2PP`));
  checkPool(scope.divs, st);
}
for (const cls of new Set(current.res.divs.map((d) => d.cls))) {
  Object.assign(api.statScopeOf(current), { k: "cls", cls });
  const scope = api.vtScope(current, "AUS");
  assert.ok(scope.divs.every((d) => d.cls === cls));
  assert.equal(scope.geography, `${cls.toLowerCase()} seats`);
  checkPool(scope.divs, cls);
}
for (const d of current.res.divs) checkPool([d], d.n);

// Navigating to a map state overrides a lingering figures-menu filter.
Object.assign(api.statScopeOf(current), { k: "cls", cls: "Rural" });
let scope = api.vtScope(current, "NSW");
assert.equal(scope.geography, "NSW");
assert.equal(scope.divs.length, current.res.divs.filter((d) => d.st === "NSW").length);
// Other lenses show the actual map area rather than the Winner head's scope.
S.lens = "tpp";
scope = api.vtScope(current, "AUS");
assert.equal(scope.divs.length, 150);
assert.equal(scope.geography, "nationwide");
S.lens = "winner";

const html = api.vtBlock(current.res.divs, true, "nationwide");
assert.equal((html.match(/role="listitem"/g) || []).length, 3);
assert.ok(html.includes("National 2PP skew"));
assert.match(html, /data-vt-mode="skew" aria-pressed="true"/);
assert.match(html, /data-vt-mode="effect" aria-pressed="false"/);
assert.match(html, /vt-skew vt-alp">\+3\.0/);
assert.match(html, /vt-skew vt-lnp">−2\.6/);
assert.match(html, /vt-skew vt-alp">\+2\.7/);
assert.ok(!html.includes("<table") && !html.includes('class="stack"'), "the chart replaces the old graphic");
for (const band of html.matchAll(/<div class="vt-band [\s\S]*?<\/div>/g)) {
  assert.ok(!/formal|Labor [−+]\d|[0-9],[0-9]{3}/.test(band[0]), "bands have shares and signed skews, without raw counts or party prefixes");
}
assert.ok(api.vtBlock([current.res.divs[0]]).includes("Skew on Bean 2PP"));

// A tiny pile still has an exact count; missing or empty data is not zero.
const tiny = [{ n: "Tiny", vt: { ord: 2, pre: 1 }, vt2: { day: [0, 2], pre: [1, 0] } }];
assert.equal(api.vtBands(tiny).bands[0].lab, 100);
assert.equal(api.vtBands(tiny).bands[1].skew, null);
assert.ok(api.vtBlock(tiny).includes('vt-skew ">–'));
assert.equal(api.vtBlock([{ n: "Empty", vt: {}, vt2: {} }]), "");
const missing = api.vtBands([{ n: "Missing", vt: { ord: 2 } }]);
assert.ok(missing.bands.every((b) => b.skew === null));
assert.ok(missing.bands.every((b) => b.effect === null && b.cumulative === null));
const gaps = api.vtBands(tiny);
assert.equal(gaps.bands[1].effect, null, "empty middle group has no measurement");
close(gaps.bands[0].effect, 100 / 3, "final group follows the preceding nonempty count");
const noDay = api.vtBands([{ vt: { ord: 2, ppvc: 2, pre: 2 }, vt2: { ppvc: [1, 1], pre: [2, 0] } }]);
assert.equal(noDay.bands[1].effect, null, "first nonempty group has no prior count");
assert.equal(noDay.bands[0].effect, 25);
const unequal = api.vtBands([{ vt: { ord: 1000, ppvc: 900, pre: 100 }, vt2: { day: [60, 40], ppvc: [10, 90], pre: [90, 10] } }]);
assert.equal(unequal.bands[1].effect, -25, "effect weights actual two-party counts, not formal vote shares");
close(unequal.bands[0].effect, 100 * 160 / 300 - 35, "the final addition is pooled at full precision");

vm.runInContext('vtMode = "effect"', ctx);
const effectHtml = api.vtBlock(current.res.divs, true, "nationwide");
assert.match(effectHtml, /data-vt-mode="effect" aria-pressed="true"/);
assert.ok(effectHtml.includes("Change in cumulative 2PP"));
assert.match(effectHtml, /vt-skew vt-alp">\+0\.2/);
assert.match(effectHtml, /vt-skew vt-lnp">−3\.0/);
assert.match(effectHtml, /vt-skew ">—/);
assert.ok(effectHtml.includes("Opening count; no preceding group"));
assert.ok(effectHtml.includes("bottom to top") && effectHtml.includes("not actual election-night reporting"));
const nsw = api.vtScope(current, "NSW");
assert.ok(api.vtBlock(nsw.divs, true, nsw.geography).includes("Change in cumulative 2PP"), "mode persists across geography changes");
vm.runInContext('vtMode = "skew"', ctx);
assert.ok(api.vtBlock(nsw.divs, true, nsw.geography).includes("Skew on NSW 2PP"));
// Historical frames keep their existing breakdown and unavailable-data copy.
current = { year: 1993 };
const old = api.vtBlock([{ n: "Historic", vt: { ord: 100 } }]);
assert.ok(old.includes("<table") && old.includes("The 1993 count"));
assert.ok(!old.includes("vt-bands"));

console.log("PASS: map vote bands — nationwide, 8 states, 4 seat types, 150 seats, weighted skews and cumulative effects, scope changes and missing data");
