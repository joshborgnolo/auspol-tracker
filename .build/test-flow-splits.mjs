/* test-flow-splits.mjs – pins the RedBridge/Accent "forced to choose" pair.
   Moved 2026-10-10 from the /preference-flows/ satellite's #forced section
   (fetch-drawn bars off assets/flow-splits.json) into the main page's
   All-polls Preference flows section as two RdForced line charts fed by
   gen-data's D.flowForced (§7db); REGROUPED the same day from one chart per
   voter cohort ({coal, on}) to one chart per QUESTION ({vsOn, vsCoal}, each
   wave carrying every cohort's Labor share on the one date). This test pins
   the CURRENT contract: the data asset carries the waves read straight off
   polls.json's tpp_split/tpp_split_on rows, verbatim per cohort cell, the
   June-2026 Coalition est derivation rides exactly one cohort of one wave
   (estCohort "coal"), the renderer mounts both charts with their cohort
   rosters, and the satellite no longer carries the retired machinery. Runs
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
assert.ok(Array.isArray(FF.vsOn) && Array.isArray(FF.vsCoal) && FF.vsOn.length >= 6 && FF.vsCoal.length >= 6,
  "both question series carry the run of waves");

/* every cohort cell is RedBridge's own polls.json row, verbatim: vsOn maps
   tpp_split_on's lnp→coal/grn/oth, vsCoal maps tpp_split's grn/onp/oth */
const polls = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "polls.json"), "utf8"));
const src = polls.polls.filter((r) => r.pollster === "RedBridge/Accent");
const byDate = new Map(src.map((r) => [r.date, r]));
const has = (r, f, ck) => r[f] && r[f][ck] != null;
assert.equal(FF.vsOn.length, src.filter((r) => ["lnp", "grn", "oth"].some((ck) => has(r, "tpp_split_on", ck))).length,
  "vsOn waves = the rows with any tpp_split_on cohort");
assert.equal(FF.vsCoal.length, src.filter((r) => ["grn", "onp", "oth"].some((ck) => has(r, "tpp_split", ck))).length,
  "vsCoal waves = the rows with any tpp_split cohort");
const COHORTS = [[FF.vsOn, "coal", (r) => has(r, "tpp_split_on", "lnp"), (r) => r.tpp_split_on.lnp],
                 [FF.vsOn, "grn", (r) => has(r, "tpp_split_on", "grn"), (r) => r.tpp_split_on.grn],
                 [FF.vsOn, "oth", (r) => has(r, "tpp_split_on", "oth"), (r) => r.tpp_split_on.oth],
                 [FF.vsCoal, "grn", (r) => has(r, "tpp_split", "grn"), (r) => r.tpp_split.grn],
                 [FF.vsCoal, "onp", (r) => has(r, "tpp_split", "onp"), (r) => r.tpp_split.onp],
                 [FF.vsCoal, "oth", (r) => has(r, "tpp_split", "oth"), (r) => r.tpp_split.oth]];
for (const [series, ck, test, pull] of COHORTS) {
  assert.equal(series.filter((w) => w[ck] != null).length, src.filter(test).length,
    `${ck}: dot count = the row count for its cohort`);
  for (const w of series.filter((w) => w[ck] != null)) {
    const row = byDate.get(w.date);
    assert.ok(row, `${w.date}: ${ck} wave resolves to a polls.json row`);
    assert.equal(w[ck], pull(row), `${w.date}: ${ck} is the row's published split figure`);
    const ym = (row.dateStart || row.date).slice(0, 7);
    assert.equal(w.ym, ym, `${w.date}: ym is the FIELDWORK month (dateStart || date)`);
    assert.ok(w[ck] >= 0 && w[ck] <= 100, `${w.date}: ${ck} share in range`);
  }
}
/* the June-2026 Coalition split is the ONE hand-derived cell (CLP/LNP/Nat 34
   + Liberal 37 combined → 36; schema documents the derivation). estCohort
   rides exactly it, on the vsOn series alone — every other cell is printed */
const estMarks = [...FF.vsOn, ...FF.vsCoal].flatMap((w) => (w.estCohort ? [{ date: w.date, cohort: w.estCohort }] : []));
assert.deepEqual(estMarks, [{ date: "2026-06-26", cohort: "coal" }],
  "exactly one cohort of one wave carries the est derivation, and it is June's Coalition split");
const jun = byDate.get("2026-06-26");
assert.equal(jun.tpp_split_on.lnp, 36, "June's derived Coalition split is 36/64 on the row");

// ---- the renderer wiring --------------------------------------------------------------
const ap = fs.readFileSync(path.join(ROOT, ".build", "newtracker", "assets", "rd-allpolls.jsx"), "utf8");
assert.ok(/function RdForced\(/.test(ap), "the RdForced component exists");
assert.ok(ap.includes("FF_COHORTS"), "the cohort lexicon (names + class tokens) exists");
assert.equal(ap.match(/<RdForced /g).length, 2, "RdForced is mounted exactly twice");
assert.ok(ap.includes('cohorts={["grn", "coal", "oth"]}') && ap.includes('cohorts={["grn", "onp", "oth"]}'),
  "the two charts ask their cohort rosters: grn/coal/oth on Labor v One Nation, grn/onp/oth on Labor v the Coalition");
assert.ok(ap.includes("waves={FF.vsOn}") && ap.includes("waves={FF.vsCoal}"), "both question series are charted");
assert.ok(ap.includes('rival="One Nation"') && ap.includes('rival="the Coalition"'),
  "the two contests read as Labor-v-One-Nation and Labor-v-the-Coalition");
assert.ok(ap.includes("D.flowForced"), "the charts read the data asset, not a fetch");
assert.ok(ap.includes('className="rd-ff'), "the figure carries its styling hook");

/* the card titles tell the story from the LATEST wave (user's call 2026-10-10):
   every cohort's latest Labor share named in one line ("NN% of Greens
   voters, NN% of Coalition voters and NN% of Other voters prefer Labor over
   One Nation"), gaining a "— <Cohort> voters up/down from NN% in <its first
   wave's month>" tail ONLY when that cohort's own straight-line drift
   battery (w=1, Holm across the six) says Yes — a title never claims a move
   the pressed set of the trend-significance table won't stand behind */
assert.ok(ap.includes("% of ") && ap.includes(" prefer Labor over "),
  "each title lists every cohort's latest share, prefer-Labor phrased");
assert.ok(ap.includes('"up"') && ap.includes('"down"') && ap.includes('"% in "') && ap.includes("rdMonthYear("),
  "the title tail reads up/down from the cohort's first-wave share, month named dynamically");
assert.ok(ap.includes("moved.length !== 1"), "the tail names a cohort only when EXACTLY ONE moved");
assert.ok(ap.includes('key: "pressed"'), "the pressed-choice rows join the trend-significance table as their own set");
assert.ok(ap.includes('"First → last"'), "the table's first→last column head fits both gaps and shares");
const css = fs.readFileSync(path.join(ROOT, ".build", "newtracker", "assets", "rd.css"), "utf8");
assert.ok(css.includes(".rd-ff-two .rd-fl-ct { min-height: 56px; }"),
  "the forced pair's headroom floor keeps the two svgs row-aligned");
for (const cls of ["grn", "lnp", "onp", "oth"])
  assert.ok(css.includes(`.rd-ff-line.${cls}`) && css.includes(`.rd-ff-dot.${cls}`),
    `the cohort's line and dot rules are its party hue (.${cls})`);

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
