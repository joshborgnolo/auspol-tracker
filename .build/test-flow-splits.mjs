/* test-flow-splits.mjs – pins the RedBridge/Accent "forced to choose" pair.
   Moved 2026-10-10 from the /preference-flows/ satellite's #forced section
   (fetch-drawn bars off assets/flow-splits.json) into the main page's All-polls
   Preference flows section as two RdForced line charts fed by gen-data's
   D.flowForced (§7db). This test pins the NEW contract: the data asset carries
   the waves read straight off polls.json's tpp_split/tpp_split_on rows, the
   June-2026 Coalition est flag rides exactly one wave, the renderer mounts both
   charts, and the satellite no longer carries the retired machinery. Runs
   after the build in npm test's chain (the data asset only reflects the
   current dataset post-build). */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// ---- the data-asset contract ----------------------------------------------------------
const assetSrc = fs.readFileSync(
  path.join(ROOT, ".build", "newtracker", "assets", "9f09dca2-bd46-49a8-8ae1-51847608cf92.js"), "utf8");
const sandbox = { window: {} };
vm.runInNewContext(assetSrc, sandbox, { filename: "9f09dca2.js" });
const FF = sandbox.window.AUSPOL && sandbox.window.AUSPOL.flowForced;
assert.ok(FF && typeof FF === "object", "flowForced is emitted on the data asset");
assert.equal(FF.house, "RedBridge/Accent", "the forced pair is credited to its one house");
assert.ok(Array.isArray(FF.coal) && Array.isArray(FF.on) && FF.coal.length >= 6 && FF.on.length >= 6,
  "both cohort series carry the run of waves");

/* every wave is ReaBridge's own polls.json row, verbatim: a is the published
   split figure, b its complement, the June Coalition wave alone estimated */
const polls = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "polls.json"), "utf8"));
const src = polls.polls.filter((r) => r.pollster === "RedBridge/Accent");
const byDate = new Map(src.map((r) => [r.date, r]));
const withSplitOn = src.filter((r) => r.tpp_split_on && r.tpp_split_on.lnp != null);
const withSplit = src.filter((r) => r.tpp_split && r.tpp_split.onp != null);
assert.equal(FF.coal.length, withSplitOn.length, "coal waves = the tpp_split_on.lnp rows");
assert.equal(FF.on.length, withSplit.length, "on waves = the tpp_split.onp rows");
for (const [series, pull] of [[FF.coal, (r) => r.tpp_split_on && r.tpp_split_on.lnp],
                              [FF.on, (r) => r.tpp_split && r.tpp_split.onp]]) {
  for (const w of series) {
    const row = byDate.get(w.date);
    assert.ok(row, `${w.date}: forced wave resolves to a polls.json row`);
    assert.equal(w.a, pull(row), `${w.date}: a is the row's published split figure`);
    assert.equal(w.b, 100 - w.a, `${w.date}: b is the strict complement`);
    const ym = (row.dateStart || row.date).slice(0, 7);
    assert.equal(w.ym, ym, `${w.date}: ym is the FIELDWORK month (dateStart || date)`);
    assert.ok(w.a >= 0 && w.a <= 100, `${w.date}: share in range`);
  }
}
/* the June-2026 Coalition split is the ONE hand-derived wave (CLP/LNP/Nat 34 +
   Liberal 37 combined → 36; schema documents the derivation). est rides
   exactly it, on the coal series alone — chart B's June (21) is printed */
const estMarks = [...FF.coal, ...FF.on].filter((w) => w.est);
assert.equal(estMarks.length, 1, "exactly one wave carries the est flag");
assert.equal(estMarks[0].date, "2026-06-26", "the est wave is the June 2026 wave");
assert.ok(FF.coal.some((w) => w.est), "est marks the Coaliton (coal) series, not the One Nation one");
const jun = byDate.get("2026-06-26");
assert.equal(jun.tpp_split_on.lnp, 36, "June's derived Coalition split is 36/64 on the row");

// ---- the renderer wiring --------------------------------------------------------------
const ap = fs.readFileSync(path.join(ROOT, ".build", "newtracker", "assets", "rd-allpolls.jsx"), "utf8");
assert.ok(/function RdForced\(/.test(ap), "the RdForced component exists");
assert.equal(ap.match(/<RdForced /g).length, 2, "RdForced is mounted exactly twice");
assert.ok(ap.includes("waves={FF.coal}") && ap.includes("waves={FF.on}"), "both series are charted");
assert.ok(ap.includes('rival="One Nation"') && ap.includes('rival="the Coalition"'),
  "the two contests read as Coalition-voters-v-One-Nation and One-Nation-voters-v-Coalition");
assert.ok(ap.includes("D.flowForced"), "the charts read the data asset, not a fetch");
assert.ok(ap.includes('className="rd-ff'), "the figure carries its styling hook");

/* the card titles tell the story from the LATEST wave (user's call 2026-10-10):
   "NN% of Coalition voters prefer Labor over One Nation" and "Just NN% of
   One Nation voters prefer Labor over the Coalition", each gaining a
   ", up/down from NN% in <first wave's month>" tail ONLY when the series'
   own straight-line drift battery (w=1, Holm across the pair) says Yes —
   the same Yes the pressed set of the trend-significance table shows */
assert.ok(ap.includes('"% of Coalition voters prefer Labor over One Nation"'),
  "the Coalition-voters title is the dynamic prefer-Labor line");
assert.ok(ap.includes('"% of One Nation voters prefer Labor over the Coalition"')
  && ap.includes('"Just " +'), "the One-Nation-voters title leads with Just and its latest share");
assert.ok(ap.includes('"up"') && ap.includes('"down"') && ap.includes('"% in "') && ap.includes("rdMonthYear(f.ym)"),
  "the title tail reads up/down from the first wave's share, month named dynamically");
assert.ok(ap.includes('key: "pressed"'), "the pressed-choice rows join the trend-significance table as their own set");
assert.ok(ap.includes('"First → last"'), "the table's first→last column head fits both gaps and shares");
const css = fs.readFileSync(path.join(ROOT, ".build", "newtracker", "assets", "rd.css"), "utf8");
assert.ok(css.includes(".rd-ff-two .rd-fl-ct { min-height: 56px; }"),
  "the forced pair's headroom floor keeps the two svgs row-aligned");

// ---- the satellite is stripped ---------------------------------------------------------
const page = fs.readFileSync(path.join(ROOT, "preference-flows", "index.html"), "utf8");
for (const dead of ['id="forced"', '<a href="#forced"', "flow-splits.json", 'id="fsq-', ".fsq ", "--fs-alp",
                    'draw("fsq-'])
  assert.ok(!page.includes(dead), `the satellite keeps no trace of: ${dead}`);
assert.ok(page.includes('respondent-allocated two-party answers by first preference &mdash; charted under Preference flows in the <a href="/#allpolls">'),
  "the source bullet redirects the splits reader to the main page's All polls tab");
assert.ok(!fs.existsSync(path.join(ROOT, "assets", "flow-splits.json")),
  "the retired flow-splits.json asset is gone");
console.log("test-flow-splits: ok");
