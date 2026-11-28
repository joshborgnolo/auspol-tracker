// data/life-satisfaction.json — every published mean is separately sourced
import fs from "node:fs";
import assert from "node:assert/strict";
import { lifeStaleness } from "./check-life-satisfaction.mjs";
const d = JSON.parse(fs.readFileSync(new URL("../data/life-satisfaction.json", import.meta.url), "utf8"));
const S = d.series;
assert.ok(Array.isArray(S) && S.length >= 4, "ANUpoll, HILDA, GSS and Scanlon series");
for (const id of ["anupoll", "hilda", "abs-gss", "scanlon"]) assert.ok(S.some((s) => s.id === id), id + " series");
const ids = new Set();
for (const s of S) {
  assert.ok(s.id && !ids.has(s.id), "unique id " + s.id); ids.add(s.id);
  for (const key of ["house", "question", "answers", "method", "source"]) assert.ok(s[key], s.id + " has " + key);
  assert.match(s.source, /^https:\/\//, s.id + " source URL");
  assert.equal(s.scaleMax, 10, s.id + " is a mean on the 0–10 scale");
  assert.ok(["line", "dot"].includes(s.role), s.id + " role");
  assert.ok(s.readings.length, s.id + " has readings");
  let last = "";
  const dates = new Set();
  const panelIds = new Set((s.panels || []).map((p) => p.id));
  for (const r of s.readings) {
    assert.match(r.date, /^\d{4}(?:-(?:0[1-9]|1[0-2]))?(?:-(?:0[1-9]|[12]\d|3[01]))?$/, s.id + " date " + r.date);
    assert.ok(r.date >= last, s.id + " readings ordered at " + r.date); last = r.date;
    assert.ok(!dates.has(r.date), s.id + " dates unique at " + r.date); dates.add(r.date);
    assert.ok(typeof r.v === "number" && r.v >= 0 && r.v <= s.scaleMax, s.id + " score " + r.date);
    if (r.n != null) assert.ok(Number.isInteger(r.n) && r.n >= 100 && r.n < 100000, s.id + " sample " + r.date);
    if (s.panels) assert.ok(panelIds.has(r.panel), s.id + " declares panel " + r.panel);
    assert.match(r.source, /^https:\/\//, s.id + " reading source " + r.date);
    // the proof: a table row must pair this year with this figure; prose must
    // name the year and carry the figure to every decimal on file. A bare
    // "figure appears somewhere" let a quote holding two years' figures pass.
    const row = r.quote.match(/^(\d{4}) \| (\d+(?:\.\d+)?)$/);
    if (row) assert.deepEqual([row[1], +row[2]], [r.date.slice(0, 4), r.v], s.id + " table row proves " + r.date);
    else {
      assert.ok(r.quote && r.quote.includes(r.date.slice(0, 4)), s.id + " verbatim proof names " + r.date);
      const figures = (r.quote.match(/\d+\.\d+/g) || []).map(Number);
      assert.ok(figures.includes(r.v), s.id + " " + r.date + " quote contains " + r.v + ": " + r.quote);
    }
  }
}
for (const s of S.filter((s) => s.role === "line")) assert.ok(s.readings.length >= 4, s.id + " has enough points for a line");
const H = S.find((s) => s.id === "hilda").readings.map((r) => +r.date);
H.forEach((y, i) => assert.equal(y, H[0] + i, "HILDA has no missing year before " + y));
assert.ok(S.find((s) => s.id === "anupoll").panels.length >= 2, "ANUpoll's panel break is declared");
assert.ok(!S.some((s) => s.id.startsWith("demosau")), "DemosAU's 0–100 index stays out of the 0–10 series");
const jsx = fs.readFileSync(new URL("./newtracker/assets/rd-panels.jsx", import.meta.url), "utf8");
assert.match(jsx, /id: "life", label: "Life satisfaction"/);
assert.match(jsx, /function RdLifeSatisfaction\(\)/);
assert.match(jsx, /Not in the line: it is scored out of 100/, "DemosAU never joins the 0–10 line");
assert.match(jsx, /s\.paraphrase \? s\.question/, "a paraphrase is never rendered in quotation marks");
const info = fs.readFileSync(new URL("./newtracker/assets/d1a1d215-370c-4ebc-878b-7eeea9ad8102.js", import.meta.url), "utf8");
assert.match(info, /id: "life-satisfaction", term: "Life satisfaction"/);
const demos = JSON.parse(fs.readFileSync(new URL("../data/demosau-one-offs.json", import.meta.url), "utf8")).one_offs.find((e) => e.id === "life-satisfaction");
const all = demos.data.tables.find((t) => t.name === "All Respondents");
assert.ok(Math.abs(all.rows.reduce((sum, r) => sum + +r[1], 0) - 100) < 0.001, "DemosAU distribution sums to 100");
assert.equal(demos.data.tables.find((t) => t.name === "Index scores").rows.find((r) => r[0] === "Life Satisfaction Score")[1], "61.5");
const asset = fs.readFileSync(new URL("./newtracker/assets/9f09dca2-bd46-49a8-8ae1-51847608cf92.js", import.meta.url), "utf8");
const at = asset.indexOf("  const lifeSat = ");
const built = JSON.parse(asset.slice(at + "  const lifeSat = ".length, asset.indexOf("\n", at) - 1));
const M = built.model;
assert.ok(M, "the build carries the model");
assert.deepEqual([...M.inModel].sort(), ["abs-gss", "anupoll"], "HILDA and one-reading surveys stay out of the line");
assert.equal(M.readings, S.filter((s) => M.inModel.includes(s.id)).reduce((a, s) => a + s.readings.length, 0),
  "the built model read every reading on file (rebuild after filing one)");
for (const m of M.months) assert.ok(m.lo <= m.v && m.v <= m.hi && m.v > 4 && m.v < 10, "model month " + m.ym);
const lastAnu = S.find((s) => s.id === "anupoll").readings.at(-1);
assert.equal(M.now.ym, lastAnu.date.slice(0, 7) > M.now.ym ? lastAnu.date.slice(0, 7) : M.now.ym, "the line reaches ANUpoll's latest wave");
assert.ok(Math.abs(M.now.v - lastAnu.v) < 0.3, "today's estimate sits near ANUpoll's latest print");
// the freshness watchdog: quiet when just checked, loud as the sources age
assert.deepEqual(lifeStaleness(d, d.checked), [], "fresh on the day it was checked");
const late = lifeStaleness(d, "2028-08-01").join("\n");
for (const want of [/ANUpoll/, /HILDA/, /last checked/]) assert.match(late, want, "stale in 2028: " + want);
console.log("life-satisfaction: ok (" + S.length + " series, " + S.reduce((n, s) => n + s.readings.length, 0) + " quoted means + DemosAU 61.5/100 snapshot)");
