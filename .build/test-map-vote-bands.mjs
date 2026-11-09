// Vote-type bands use counted 2PP totals for the same electorate pool as
// their formal shares, including figures-menu filters and mobile votes.
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const read = (p) => fs.readFileSync(new URL(p, new URL("../", import.meta.url)), "utf8");
const states = { NSW: "New South Wales", VIC: "Victoria", QLD: "Queensland", WA: "Western Australia", SA: "South Australia", TAS: "Tasmania", ACT: "Australian Capital Territory", NT: "Northern Territory" };
const short = { NSW: "NSW", VIC: "Vic", QLD: "Qld", WA: "WA", SA: "SA", TAS: "Tas", ACT: "ACT", NT: "NT" };
// the app gates a state scope pick on STATE_YEARS (statScopeOk, app-1-base.js)
const STATE_YEARS = new Set(Object.keys({ sa22: 1, sa26: 1, nsw15: 1, nsw19: 1, nsw23: 1, nswnow: 1, vic14: 1, vic18: 1, vic22: 1, qld17: 1, qld20: 1, qld24: 1, qldnow: 1, wa17: 1, wa21: 1, wa25: 1, wanow: 1 }));
const STATES = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"];
const CLS = ["Inner Metropolitan", "Outer Metropolitan", "Provincial", "Rural"];
const CLS_SHORT = { "Inner Metropolitan": "Inner metro", "Outer Metropolitan": "Outer metro", Provincial: "Provincial", Rural: "Rural" };
const CLS_LOWER = { "Inner Metropolitan": "inner-metropolitan", "Outer Metropolitan": "outer-metropolitan", Provincial: "provincial", Rural: "rural" };
let current = { year: 2025, res: JSON.parse(read("map/data/core-2025.json")) };
// the page's two filters (the strip's State and Seat type rows) are S.f.st and S.f.cls
const S = { lens: "winner", f: { st: null, cls: null } };
// statScopeOk/statBreakdownRows read m.areas[st].{formal,idx}; the app derives them in deriveAreas
// (the app's model carries its seats as m.divs too: the filters check a type exists there)
current.divs = current.res.divs;
current.areas = Object.fromEntries(Object.entries(current.res.agg).map(([st, a]) => [st, { formal: a.formal, idx: current.res.divs.flatMap((d, i) => (st === "AUS" || d.st === st ? [i] : [])) }]));
const ctx = vm.createContext({
  S, STATE_TITLE: states, STATE_SHORT: short, STATE_YEARS, STATES, CLS, CLS_SHORT, CLS_LOWER, FAMS: ["alp", "lnp", "grn", "onp", "ind", "oth"], M: () => current,
  esc: (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])),
  f1: (v) => v == null ? "–" : v.toFixed(1), int: (v) => v.toLocaleString("en-AU"),
  sgn: (v) => v == null ? "–" : (v > .049 ? "+" : v < -.049 ? "−" : "") + Math.abs(v).toFixed(1),
  coalW: () => "the Coalition",
});
vm.runInContext(read(".build/map/app/app-4-story.js"), ctx);
const api = vm.runInContext("({ vtBands, vtBandsFor, vtScope, vtBlock, statScopeOf })", ctx);
const close = (a, b, note) => assert.ok(Math.abs(a - b) < 1e-9, `${note}: ${a} vs ${b}`);

// Independent count oracle: no rounded vote-type percentages or equal
// weighting of seats. Each band's counts and the area's totals are pooled,
// under the frame's own eras (postal votes change bands with the election).
function checkPool(divs, label, eraBands) {
  const result = api.vtBands(divs);
  const total = divs.reduce((n, d) => n + d.c.reduce((s, c) => s + c[4], 0), 0);
  const two = divs.reduce((p, d) => [p[0] + d.tpp[0], p[1] + d.tpp[1]], [0, 0]);
  assert.equal(result.tot, total, `${label}: formal votes conserved`);
  close(result.base, 100 * two[0] / (two[0] + two[1]), `${label}: official area 2PP`);
  close(result.bands.reduce((n, b) => n + b.share, 0), 100, `${label}: shares sum to 100`);
  assert.equal(result.bands.reduce((n, b) => n + b.v, 0), total, `${label}: every vote is in one band`);
  assert.equal(result.bands.length, eraBands.length, `${label}: the era's own set of bands`);
  let weightedSkew = 0;
  result.bands.forEach((b, i) => {
    const p = divs.reduce((p, d) => eraBands[i][2].reduce((p, k) => [p[0] + (d.vt2[k]?.[0] || 0), p[1] + (d.vt2[k]?.[1] || 0)], p), [0, 0]);
    const n = p[0] + p[1];
    if (n) close(b.skew, 100 * p[0] / n - result.base, `${label}: ${b.k} skew from pooled counts`);
    else assert.equal(b.skew, null, `${label}: an empty pile has no skew`);
    weightedSkew += n * (b.skew || 0) / (two[0] + two[1]);
  });
  close(weightedSkew, 0, `${label}: weighted skews balance`);
  // Independently build successive electorate pools in counting order.
  const stages = [];
  let stageKeys = [];
  for (const [, , pileKeys] of eraBands.slice().reverse()) {
    stageKeys = stageKeys.concat(pileKeys);
    const p = divs.reduce((p, d) => stageKeys.reduce((p, k) => [p[0] + (d.vt2[k]?.[0] || 0), p[1] + (d.vt2[k]?.[1] || 0)], p), [0, 0]);
    stages.push(p[0] + p[1] ? 100 * p[0] / (p[0] + p[1]) : null);
  }
  result.bands.slice().reverse().forEach((b, i) => {
    if (stages[i] != null) close(b.cumulative, stages[i], `${label}: cumulative ${b.k} 2PP`);
    else assert.equal(b.cumulative, null);
    if (i > 0 && b.n > 0 && stages[i - 1] != null) close(b.effect, stages[i] - stages[i - 1], `${label}: ${b.k} changes the preceding count`);
    else assert.equal(b.effect, null, `${label}: no invented starting or empty-pile effect`);
  });
  close(result.bands[0].cumulative, result.base, `${label}: final cumulative result reaches area 2PP`);
  return result;
}

const bands25 = api.vtBandsFor(2025);
const national = checkPool(current.res.divs, "nationwide", bands25);
assert.deepEqual(Array.from(national.bands, (b) => b.share.toFixed(1)), ["6.8", "52.2", "41.0"]);
assert.deepEqual(Array.from(national.bands, (b) => b.skew.toFixed(1)), ["3.0", "-2.6", "2.7"]);
assert.deepEqual(Array.from(national.bands, (b) => b.effect == null ? null : b.effect.toFixed(1)), ["0.2", "-3.0", null]);
assert.deepEqual(Array.from(national.bands, (b) => b.cumulative.toFixed(1)), ["55.2", "55.0", "58.0"]);
// a State filter is the map's state selection: the head pools that state (its area)
for (const st of Object.keys(states)) {
  S.f.st = st; S.f.cls = null;
  const scope = api.vtScope(current, st);
  assert.ok(scope.divs.every((d) => d.st === st));
  assert.equal(scope.geography, short[st]);
  assert.ok(api.vtBlock(scope.divs, true, scope.geography).includes(`Skew on ${short[st]} 2PP`));
  checkPool(scope.divs, st, bands25);
}
// a Seat type filter scopes the pool in every lens, nationwide or inside a state
S.f.st = null;
for (const lens of ["winner", "tpp", "cls"]) {
  S.lens = lens;
  for (const cls of new Set(current.res.divs.map((d) => d.cls))) {
    S.f.cls = cls;
    const scope = api.vtScope(current, "AUS");
    assert.ok(scope.divs.every((d) => d.cls === cls));
    assert.equal(scope.geography, `${CLS_LOWER[cls]} seats`);
    checkPool(scope.divs, `${lens} ${cls}`, bands25);
  }
}
S.lens = "winner";
for (const d of current.res.divs) checkPool([d], d.n, bands25);

// the two filters compound: a seat type inside a state pools their intersection
S.f.st = "NSW"; S.f.cls = "Rural";
let scope = api.vtScope(current, "NSW");
assert.equal(scope.geography, "rural seats in NSW");
assert.equal(scope.divs.length, current.res.divs.filter((d) => d.st === "NSW" && d.cls === "Rural" && d.vt).length);
checkPool(scope.divs, "NSW rural", bands25);
// with neither on, every lens reads the whole frame
S.f.st = null; S.f.cls = null;
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

// the earlier eras where the piles split every seat's final two: postal votes
// leave the election-night band and the labels quote the AEC's per-election
// count statements (2016/2019 postal first counted Tuesday, 2022 Sunday)
assert.ok(JSON.stringify(api.vtBandsFor("now")) === JSON.stringify(bands25), "now rides 2025's era");
const ERA_CFG = {
  2022: [["late", "Early, by declaration & absent and other", ["pre", "abs", "prov"], "Over following days"], ["post", "Postal", ["post"], "From Sunday"], ["early", "Early centres", ["ppvc"], "On the night, the biggest late"], ["day", "On the day", ["day", "mob"], "On the night"]],
  2019: [["late", "Early, by declaration & absent and other", ["pre", "abs", "prov"], "Over following days"], ["post", "Postal", ["post"], "From Tuesday"], ["early", "Early centres", ["ppvc"], "On the night"], ["day", "On the day", ["day", "mob"], "On the night"]],
  2016: [["late", "Early, by declaration & absent and other", ["pre", "abs", "prov"], "Over following days"], ["post", "Postal", ["post"], "From Tuesday"], ["early", "Early centres", ["ppvc"], "On the night, the rest Monday"], ["day", "On the day", ["day", "mob"], "On the night"]],
};
for (const y of [2022, 2019, 2016]) {
  const res = JSON.parse(read(`map/data/core-${y}.json`));
  current = { year: y, res };
  current.divs = res.divs;
  const eraBands = api.vtBandsFor(y);
  assert.ok(JSON.stringify(eraBands) === JSON.stringify(ERA_CFG[y]), `${y}: the band config quotes the AEC's per-election statements`);
  checkPool(res.divs, `${y} nationwide`, eraBands);
  const html = api.vtBlock(res.divs, true, "nationwide");
  assert.equal((html.match(/role="listitem"/g) || []).length, 4, `${y}: postal gets its own band`);
  for (const t of eraBands.map((b) => b[3])) assert.ok(html.includes(`<small class="vt-time">${t}</small>`), `${y}: band label “${t}”`);
  assert.ok(!html.includes("<table") && !html.includes('class="stack"'), `${y}: the chart replaces the old graphic`);
  const seat = api.vtBlock([res.divs[0]]);
  assert.ok(seat.includes("vt-band-post") && !seat.includes("<table"), `${y}: a seat draws the chart`);
}
// Historical frames keep their existing breakdown and unavailable-data copy.
current = { year: 1993 };
const old = api.vtBlock([{ n: "Historic", vt: { ord: 100 } }]);
assert.ok(old.includes("<table") && old.includes("The 1993 count"));
assert.ok(!old.includes("vt-bands"));
for (const y of [2013, 2010]) {
  current = { year: y };
  const html = api.vtBlock([{ n: "Old", vt: { ord: 100, post: 10 }, vt2: { day: [60, 40], post: [10, 0] } }]);
  assert.ok(html.includes("<table") && !html.includes("vt-bands"), `${y}: classic-seat coverage keeps the table, not the chart`);
}

console.log("PASS: map vote bands — nationwide, 8 states, 4 seat types, 150 seats, weighted skews and cumulative effects, scope changes, missing data, and the 2016/2019/2022 eras");
