/* test-map-chart.mjs – pins /map/'s Chart drawing (app-2c-chart.js): the seats as dots.

   - the statistics are the chart's own functions, run here in a bare vm context: least
     squares, Student's t, the seeded permutation test (shuffling Labor's two-party shares
     among the seats, which tests the slope and Pearson's r alike), and the slope within the
     AEC's seat types. On the 2025 seats they must give what was worked out by hand when the
     chart was designed (2026-11-08): median age −7.3 points of Labor 2PP per 5 years (r
     −0.51), half of it seat type (−3.8 within types), inner metro −12.0, outer metro −5.3,
     provincial and rural not significant; university share rising only in rural seats.
   - the copy is statistically precise (user call, 2026-11-08): "no significant correlation",
     never "no clear line"; a slope is a difference between seats ("averages … lower"), not a
     fall; the dek names r; a seat type's slope is read type by type, because the pooled
     within-type slope can hide types pulling opposite ways (university share did).
   - census copy sets each measure over the people the builders divide by (censusWho): one-
     parent families over families, tenure over dwellings, degrees over people aged 15+.
   - How votes were cast: the 2025 seats Labor won on the day and lost, and the postal gap.
   - the wiring a screenshot can't see: the map beneath keeps its seats, the key's hold drops
     the polling-places face under a chart (the white space a reader found, 2026-11-08), the
     map's furniture and street credit hide, the URL carries the chart's switches both ways.
   Run: node .build/test-map-chart.mjs
   The browser's side is in .matilda/probe/map-chart.mjs <baseUrl>. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const R = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const chart = R(".build/map/app/app-2c-chart.js"), base = R(".build/map/app/app-1-base.js");
const draw = R(".build/map/app/app-2b-draw.js"), ui = R(".build/map/app/app-6-ui.js"), story = R(".build/map/app/app-4-story.js");
const css = R(".build/map/app/page.css"), page = R("map/index.html");
const cut = (src, a, b) => { const i = src.indexOf(a), j = src.indexOf(b, i + a.length); assert.ok(i >= 0 && j > i, `found ${a}`); return src.slice(i, j); };

/* ----- the statistics, alone ----- */
const statSrc = [
  cut(chart, "const CH_NICE", "\nconst CH_NUM"),
  cut(chart, "const CH_R = ", "\nconst CH_VS"),
  cut(chart, "const chMedian", "\nconst chShare"),
  cut(chart, "function chOls(", "\n/* ----- the national figure"),
].join("\n");
const S = vm.runInNewContext(`${statSrc}\n({ chOls, chSlope, chT95, chRng, chPerm, chWithin, chStep, chQ, chMedian, CH_R, CH_ALPHA })`, {});

// Student's t against the tables
for (const [df, t] of [[5, 2.5706], [10, 2.2281], [30, 2.0423], [148, 1.9762]]) assert.ok(Math.abs(S.chT95(df) - t) < 0.001, `t(0.975, ${df}) = ${t}, got ${S.chT95(df).toFixed(4)}`);
// quantiles interpolate (type 7) and the median is the middle
assert.equal(S.chQ([1, 2, 3, 4], 0.25), 1.75);
assert.equal(S.chMedian([5, 1, 3]), 3);
assert.equal(S.chMedian([4, 1, 3, 2]), 2.5);
// least squares on a made-up line: exact slope, r = 1, no residual
{ const f = S.chOls([1, 2, 3, 4], [3, 5, 7, 9]); assert.equal(f.b, 2); assert.equal(f.a, 1); assert.ok(Math.abs(f.r - 1) < 1e-12 && f.s2 < 1e-12); }
// the shuffle is seeded: one reading, every visit; and an unrelated pair isn't significant
{
  const rnd = S.chRng(7), xs = Array.from({ length: 150 }, () => rnd()), ys = Array.from({ length: 150 }, () => rnd());
  const p1 = S.chPerm(xs, ys), p2 = S.chPerm(xs, ys);
  assert.equal(p1, p2, "a seeded shuffle gives one p");
  assert.ok(p1 > 0.05, `noise isn't significant (p ${p1})`);
  assert.ok(S.chPerm(xs, xs.map((x) => 3 * x + 0.01 * ys[0])) < 0.001, "a perfect line is");
}

/* ----- on the 2025 seats ----- */
const core = JSON.parse(R("map/data/core-2025.json"));
const seats = core.divs.map((d) => ({
  n: d.n, cls: d.cls, age: d.demo.ageMed, uni: 100 * d.demo.uni, y: (100 * d.tpp[0]) / (d.tpp[0] + d.tpp[1]),
  win: d.c.find((c) => c[6] === 1)[3], two: new Set(d.tcp.map(([k]) => d.c[k][3])), vt2: d.vt2,
}));
assert.equal(seats.length, 150);
const ys = seats.map((s) => s.y), ages = seats.map((s) => s.age), cls = seats.map((s) => s.cls);
{
  const f = S.chOls(ages, ys), p = S.chPerm(ages, ys);
  assert.equal((5 * f.b).toFixed(1), "-7.3", "median age: −7.3 points of Labor 2PP per 5 years");
  assert.equal(f.r.toFixed(2), "-0.51", "r −0.51");
  assert.ok(p < 0.001, "significant at the shuffle's finest step");
  assert.equal(S.chStep(ages), 5, "the step is 5 years");
  const w = S.chWithin(ages, ys, cls);
  assert.equal((5 * w.b).toFixed(1), "-3.8", "holding seat type fixed halves it: −3.8");
  assert.ok(w.p < S.CH_ALPHA, "and it stays significant within types");
  const type = (c) => { const q = seats.filter((s) => s.cls === c); const qx = q.map((s) => s.age), qy = q.map((s) => s.y); return { b: 5 * S.chOls(qx, qy).b, p: S.chPerm(qx, qy) }; };
  const inner = type("Inner Metropolitan"), outer = type("Outer Metropolitan"), prov = type("Provincial"), rural = type("Rural");
  assert.equal(inner.b.toFixed(1), "-12.0"); assert.ok(inner.p < S.CH_ALPHA, "inner metro significant");
  assert.equal(outer.b.toFixed(1), "-5.3"); assert.ok(outer.p < S.CH_ALPHA, "outer metro significant");
  assert.ok(prov.p >= S.CH_ALPHA && rural.p >= S.CH_ALPHA, "provincial and rural: no significant correlation");
}
{
  // university share: significant overall, but the pooled within-type slope hides opposite pulls,
  // which is why the dek reads every type on its own
  const xs = seats.map((s) => s.uni), f = S.chOls(xs, ys);
  assert.ok(S.chPerm(xs, ys) < S.CH_ALPHA && f.b > 0);
  assert.ok(S.chWithin(xs, ys, cls).p >= S.CH_ALPHA, "no significant pooled within-type slope");
  const q = seats.filter((s) => s.cls === "Rural"), qx = q.map((s) => s.uni), qy = q.map((s) => s.y);
  assert.ok(S.chPerm(qx, qy) < S.CH_ALPHA && S.chOls(qx, qy).b > 0, "yet rural seats rise significantly");
}
{
  // how votes were cast, Labor v Coalition final twos only
  const share = (p) => (100 * p[0]) / (p[0] + p[1]);
  const classic = seats.filter((s) => s.two.has("alp") && s.two.has("lnp") && s.vt2);
  const day = (s) => share([s.vt2.day[0] + (s.vt2.mob ? s.vt2.mob[0] : 0), s.vt2.day[1] + (s.vt2.mob ? s.vt2.mob[1] : 0)]);
  const lost = classic.filter((s) => day(s) > 50 && s.y < 50).map((s) => s.n).sort();
  assert.deepEqual(lost, ["Berowra", "Bowman", "Casey", "Fairfax", "La Trobe", "Longman"], "the six seats Labor won on the day and lost");
  const gaps = classic.filter((s) => s.vt2.post && s.vt2.post[0] + s.vt2.post[1] >= 100).map((s) => share(s.vt2.post) - day(s));
  assert.equal(gaps.length, 115);
  assert.equal(gaps.filter((g) => g < 0).length, 112, "postal votes less Labor than the day's in 112 of 115");
  assert.equal(S.chMedian(gaps).toFixed(1), "-5.6", "by a median 5.6 points");
}

/* ----- the copy ----- */
assert.ok(chart.includes("No significant correlation between ${X.noun} and Labor’s two-party share"), "a null result names the correlation");
assert.ok(!/clear line|too weak to tell/.test(chart), "no loose 'line' wording");
assert.ok(chart.includes("averages ${f1(Math.abs(eff))} points ${eff < 0 ? \"lower\" : \"higher\"}"), "a slope is a difference between seats");
assert.ok(chart.includes("Correlation across the ${inn.length} seats: ${chR2(f.r)}"), "the dek names r");
assert.ok(chart.includes("const types = [part(sigT"), "seat types are read one by one");
assert.ok(page.includes("Chart sets the map aside") && page.includes("permutation test") && page.includes("Pearson’s correlation"), "the page's notes give the method");

/* ----- whose share: censusWho ----- */
{
  const consts = ["DM_VERB", "RELISMS", "TENESMS", "ANCISMS", "COB_VERB", "AGE_VERB", "DM_POP", "DM_PRED"].map((k) => { const m = base.match(new RegExp(`^const ${k} = .*$`, "m")); assert.ok(m, k); return m[0]; }).join("\n");
  const fn = cut(base, "function censusWho(", "\n// ") ;
  const ctx = { S: { index: "lang", eduMode: "uni", ten: "mort", rel: "cath", anc: "irish", cob: null, ageMode: "a65", incMode: "lo" }, LENS_TEN: "ten", LENS_INC: "inc", LENS_EDU: "edu", LENS_AGE: "age", LENS_REL: "rel", LENS_ANC: "anc", INC_VERB: { lo: () => "live in households earning under $X" }, incLoFrag: () => "under $X", incHiQFrag: () => "over $Y", incEpoch: () => "" };
  const dmV = cut(base, "const dmVerb = ", "\n");
  const who = vm.runInNewContext(`${consts}\n${dmV}\n${fn.replace(/\n$/, "")}\n(k) => censusWho(null, k).phrase`, ctx);
  const set = (o) => Object.assign(ctx.S, o);
  set({ index: "onepar" }); assert.equal(who("onepar"), "families that are one-parent families");
  set({ index: "lang" }); assert.equal(who("lang"), "residents who speak a language other than English at home");
  set({ index: "blue" }); assert.match(who("blue"), /^employed people who work in a trade/);
  set({ index: "pt" }); assert.equal(who("pt"), "employed people who travelled to work by public transport");
  set({ index: "bigfam" }); assert.equal(who("bigfam"), "women aged 15+ who have had more than two children");
  set({ index: "edu", eduMode: "uni" }); assert.equal(who("edu"), "people aged 15+ who hold a university qualification");
  set({ index: "edu", eduMode: "y12less" }); assert.equal(who("edu"), "people aged 15+ who left schooling before Year 12");
  set({ index: "ten", ten: "mort" }); assert.equal(who("ten"), "dwellings that are owned with a mortgage");
  set({ index: "age", ageMode: "a65" }); assert.equal(who("age"), "residents who are aged 65 or over");
  set({ index: "inc", incMode: "lo" }); assert.equal(who("inc"), "adults who live in households earning under $X");
  // and the story and the key use it, never "residents" over a share of families
  assert.ok(!story.includes(`isInc() ? "of the adults" : "of residents"`) && story.includes("censusWho(m, k).pop"), "the story names the base");
  assert.ok(ui.includes("Share of ${censusWho(m).phrase}") && ui.includes("Share of dwellings that"), "the key names the base");
}

/* ----- the wiring ----- */
assert.ok(/const DRAWS = \[.*\["chart", "Chart"\]\]/.test(draw), "Chart is a drawing");
assert.ok(draw.includes(`S.draw === "chart" ? "seats"`), "the map beneath a chart keeps its seats");
assert.ok(draw.includes(`why: k === "chart" && !chartFits(m) ? "Chart plots a figure`), "the button (and the phone's Draw menu) says why a lens has no chart");
assert.ok(ui.includes(`!(S.draw === "chart" && chartFits(my)) ? [false, true] : [false]`), "a chart's key holds only the seats' face");
assert.ok(/chartSync\(m\);[^\n]*\n\s*\/\/ the key shows/.test(ui), "the chart's class is set before the key is measured");
assert.ok(/function frame\(ts\) \{\n\s*raf = 0;\n\s*chartTick\(\);/.test(ui), "every frame ticks the chart");
assert.ok(ui.includes(`p.set("cs", "type")`) && ui.includes(`p.get("cs") === "type"`) && ui.includes(`p.set("cv", CH.vs)`) && ui.includes(`CH_VS[cv]`), "the URL carries the chart's switches both ways");
assert.ok(story.includes("!chartOn(m) && !(S.lens"), "the rail's Across-the-seats histogram steps aside under a chart");
for (const sel of ["#credit", ".lg-ramp", ".lg-ticks", ".lg-ends", "#cities", "#hint"]) assert.ok(new RegExp(`\\.ch-on [^{]*${sel.replace(".", "\\.")}`).test(css), `${sel} hides under a chart`);
assert.ok(css.includes(".fs .mp-chart"), "full screen seats the chart inside its plates");
for (const f of [".build/map/assemble.mjs", ".build/test-map-page.mjs"]) assert.ok(R(f).includes(`"app-2b-draw.js", "app-2c-chart.js"`), `${f} folds the chart in`);

console.log("test-map-chart: ok – statistics, 2025 readings, precise copy, census bases, wiring");
