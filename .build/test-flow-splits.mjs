/* test-flow-splits.mjs – pins the forced-choice preference-flows trio in the
   All-polls Preference flows section (moved 2026-10-10 from the
   /preference-flows/ satellite's #forced section; regrouped that day to one
   chart per QUESTION; REWORKED 2026-10-13 to the four-mark-kinds contract).
   Current contract: gen-data's D.flowForced (§7db) carries RedBridge/Accent's
   waves read straight off polls.json's tpp_split/tpp_split_on rows verbatim,
   the June-2026 Coalition est derivation rides exactly one cohort of one wave,
   DemosAU's MRP carriers (demos/demosOn/lnpOn) ride the SAME lines as
   RedBridge's dots — different shape, the user's call: "the MRP readings
   behave like the RedBridge dots, just differently shaped" (triangles, not
   diamonds) — the 2025 election's rings are ONE national carrier typed
   from flows.mjs's FLOW constants, the AEC's TPP flow cut (elec2025r.all;
   no regional carriers exist — the AEC counts no per-division TPP flows),
   the 2026
   state and by-election counts ride the Labor-v-One-Nation chart as crosses
   (bys: SA2026 Bonham estimates, Secret Harbour — on the days of the
   elections, joined to NO line, national only, hidden on a named region;
   Farrer's pair dropped 2026-10-13 — those counts measured independent
   contests, not One Nation voters' choices), RedBridge's national dots
   drop out on a named region (Both charts' waves lists go empty — the
   Labor-v-Coalition chart was missed at first), and the third chart's
   title paints Coalition in coalition blue and One Nation in One Nation
   orange.
   Runs after the build in npm test's chain (the data asset only reflects the
   current dataset post-build). */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { FLOW as FLOW_PIN } from "./newtracker/flows.mjs";
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

/* the 2025 election rings: ONE national carrier, typed from flows.mjs's
   FLOW constants in gen-data — the AEC's TPP flow product (every ballot
   redistributed ALP v Coalition), the cut the estimate's implied 2PP reads
   (user 2026-10-13). The AEC counts no per-division TPP flows, so the
   inner/outer/regional carriers that first shipped (off the TCP file) are
   GONE and no regional election rings exist — see
   .build/aec-2025-region-tpp-flows.mjs for why a region cut can't be
   re-derived from published aggregates */
assert.ok(FF.elec2025r && FF.elec2025r.all, "elec2025r carries the national rings carrier");
assert.deepEqual(Object.keys(FF.elec2025r).sort(), ["all"],
  "elec2025r carries ONLY the national carrier — no regional election flows exist to ride");
assert.ok(!FF.elec2025, "the old single elec2025 carrier is gone — the rings ride elec2025r.all");
assert.deepEqual(
  Object.fromEntries(["grn", "onp", "oth"].map((k) => [k, FF.elec2025r.all[k]])),
  Object.fromEntries(["grn", "onp", "oth"].map((k) => [k, Math.round(FLOW_PIN[k] * 1e4) / 100])),
  "the national rings ride the estimate's own constants (the AEC's TPP flow cut), to the hundredth");
assert.deepEqual(
  Object.fromEntries(["grn", "onp", "oth"].map((k) => [k, FF.elec2025r.all[k]])), { grn: 88.19, onp: 25.5, oth: 54.55 },
  "those constants remain the AEC's counted 2025 flows (GRN 88.19, ON 25.50, IND+OTH 54.55)");
assert.ok(Math.abs(FF.elec2025r.all.xm - (2025 * 12 + 4 + 2 / 31)) < 1e-3,
  `the carrier rides 3 May 2025 on the month-index scale (xm ${FF.elec2025r.all.xm})`);

/* the crosses (user 2026-10-13): the 2026 counts that measured the Labor-v-
   One-Nation choice — SA 2026 (Bonham's estimates) and Secret Harbour's
   early-voting-centre count. Each on its election DAY, none joined to any
   line. Farrer's pair is GONE (the same day): its counts measured a
   Liberal-v-Nationals contest and One-Nation-independent races, nothing to
   do with One Nation voters' preferences */
assert.ok(Array.isArray(FF.bys) && FF.bys.length === 2, "bys carries the two 2026-count crosses");
assert.deepEqual([...FF.bys.map((d) => d.key)].sort(), ["harbour", "sa2026"],
  "the surviving crosses are SA 2026 and Secret Harbour — no Farrer reading survives (its counts were an independent national contest's)");
const byKey = new Map((FF.bys || []).map((d) => [d.key, d]));
assert.deepEqual(Object.fromEntries(["coal", "grn", "oth"].map((k) => [k, byKey.get("sa2026")[k]])), { coal: 33.9, grn: 84.8, oth: 55.9 },
  "SA 2026: Bonham's estimates (Liberal 33.9 / Greens 84.8 / Independent 55.9 to Labor)");
assert.equal(byKey.get("sa2026").date, "2026-03-21", "SA 2026 rides its election day");
assert.equal(byKey.get("sa2026").lbl.coal, "Liberal", "SA's Coalition cohort names the partner");
assert.deepEqual([byKey.get("harbour").coal, byKey.get("harbour").grn], [29.8, 90],
  "Secret Harbour: Antony Green's early-voting-centre count (Liberal 29.8 / Greens 90.0 to Labor)");
assert.equal(byKey.get("harbour").date, "2026-08-29", "Secret Harbour rides 29 Aug 2026");
for (const d of FF.bys) {
  const [y, mo, dy] = d.date.split("-").map(Number);
  const dim = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  assert.ok(Math.abs(d.xm - (y * 12 + mo - 1 + (dy - 1) / dim)) < 1e-3,
    `${d.key}: xm is its own election day on the month-index scale`);
  assert.ok(d.label && d.win && d.sub, `${d.key}: the mark names its count, day and provenance`);
}

/* the MRP readings JOIN the lines: their marks ride the same cohort series
   as RedBridge's waves (the renderer's line inputs), not a separate kind */
assert.ok(Array.isArray(FF.demosOn) && FF.demosOn.length >= 2, "demosOn carries the MRP's Labor-v-One-Nation regional carriers");
assert.ok(Array.isArray(FF.lnpOn) && FF.lnpOn.length >= 2, "lnpOn carries the MRP's Coalition-v-One-Nation carriers");

// ---- the renderer wiring --------------------------------------------------------------
const ap = fs.readFileSync(path.join(ROOT, ".build", "newtracker", "assets", "rd-allpolls.jsx"), "utf8");
assert.ok(/function RdForced\(/.test(ap), "the RdForced component exists");
assert.ok(ap.includes("FF_COHORTS"), "the cohort lexicon (names + class tokens) exists");
assert.equal(ap.match(/<RdForced /g).length, 3,
  "RdForced mounts three charts: the RedBridge pair plus the DemosAU MRP Coalition v One Nation third chart");
assert.ok(ap.includes('cohorts={["grn", "coal", "oth"]}') && ap.includes('cohorts={["grn", "onp", "oth"]}'),
  "the two charts ask their cohort rosters: grn/coal/oth on Labor v One Nation, grn/onp/oth on Labor v the Coalition");
assert.ok(ap.includes('rival="One Nation"') && ap.includes('rival="the Coalition"'),
  "the two contests read as Labor-v-One-Nation and Labor-v-the-Coalition");
assert.ok(ap.includes('anchor="the Coalition" rival="One Nation" houseWord="DemosAU (MRP)"'),
  "the third chart presses the Coalition against One Nation on the lnpOn series, DemosAU-housed");
assert.ok(ap.includes("D.flowForced"), "the charts read the data asset, not a fetch");

/* four mark kinds, one shape apiece: RedBridge's dots and DemosAU's MRP
   triangles BOTH join the lines (the user's 2026-10-13 call) — the line's
   series filter is wave-or-mrp — the election's rings and the 2026 counts'
   crosses sit outside every line */
assert.ok(ap.includes('const inLine = (g) => g.kind === "wave" || g.kind === "mrp";'),
  "waves AND MRP triangles join the cohort lines (the MRP affects the fit like a dot)");
assert.ok(ap.includes("!groups.length"), "a chart with no groups at all stays unmounted (never an empty svg)");
assert.ok(ap.includes('className={"rd-ff-tr " + cls}'), "the MRP mark is a triangle (.rd-ff-tr)");
assert.ok(ap.includes('className={"rd-ff-x " + cls}'), "the 2026-count mark is a cross (.rd-ff-x)");
assert.ok(ap.includes('className={"rd-ff-dot " + cls}') && ap.includes('"rd-ring rd-ff-ring "'),
  "waves stay dots, the election stays the primary chart's open ring");

/* triangles affect the lines: a cohort's series runs through every wave and
   MRP mark in date order; rings and crosses never bend it */
assert.ok(ap.includes('groups.filter((g) => inLine(g) && g.d[ck] != null).sort((a, b) => a.xm - b.xm)'),
  "each cohort's line runs through waves and MRP marks alike, in date order");
const lineCall = ap.match(/series\.map\(\(s\)\s*=>[\s\S]{0,160}?rd-ff-line /);
assert.ok(lineCall && !/filter/.test(lineCall[0]),
  "every built series draws its line (no 'lone triangles get no line' filter left over)");

/* the bys/x domain story: crosses sit on their own days, the rings on the
   election's day, all on the month-index scale; the shared domain spans the
   waves, the MRPs, the crosses and the rings */
assert.ok(ap.includes("...(bys || []).map((d) => d.xm)"), "a chart's own domain hears the crosses' days");
assert.ok(ap.includes("...(FF.bys || [])"), "the section's shared domain hears the crosses");

/* the region menu (user asks 2026-10-13): All voters + the MRP's three named
   regions. On a named region, RedBridge's national dots and the 2026 crosses
   vanish (a national wave can't speak to a region), the MRP carriers rekey
   to the printed cells, and the Labor-v-Coalition chart stands aside for a
   national-only empty cell — its waves, its triangles and the election's
   rings are ALL national-only (the AEC counts no per-region TPP flows for
   the rings to ride; user 2026-10-13: "Keep All-voters-only") */
assert.ok(ap.includes('const FF_REGIONS = [["", "All voters"], ["inner", "Inner metro"], ["outer", "Outer metro"], ["regional", "Regional"]];'),
  "the region menu is All voters + the MRP's three named regions");
assert.ok(ap.includes('aria-label="DemosAU MRP region"') && ap.includes('value={ffReg}') && ap.includes('setFfReg(e.target.value)'),
  "the select rides ffReg state beside the section hed, labelled for assistive tech");
assert.ok(ap.includes("waves={ffReg ? [] : FF.vsOn}"),
  "on a named region RedBridge's dots drop out of the v-One-Nation chart entirely");
assert.ok(ap.includes('{ffReg ? (') && ap.includes('className="rd-fl-emptycell"') && ap.includes("<RdForced q=\"co\""),
  "a named region swaps the Labor-v-Coalition chart for a national-only empty cell — nothing on it can rekey (user 2026-10-13)");
assert.ok(ap.includes("National-only — RedBridge/Accent’s waves, DemosAU’s MRP and the 2025 election all measured the country whole"),
  "the empty cell says why nothing rekeys");
assert.ok(ap.includes("bys={ffReg ? [] : (FF.bys || [])}"),
  "on a named region the 2026-count crosses drop out too (national counts)");
assert.ok(ap.includes('elec={FF.elec2025r ? FF.elec2025r.all : null}') && !ap.includes("elec2025r[ffReg") && !ap.includes("elec2025r.inner") && !ap.includes("elec2025r.outer") && !ap.includes("elec2025r.regional"),
  "the rings ride the national carrier directly — no region lookup remains (the AEC counts no per-region TPP flows)");
assert.ok(ap.includes("FF.elec2025r ? [FF.elec2025r.all.xm] : []"),
  "the shared domain hears the national ring carrier's day");
assert.ok(ap.includes("extra") === false || ap.includes("extras={demoRows}"),
  "the v-One-Nation chart's MRP extras ride the rekeyed demosOn rows");

/* the rekey: All voters reads the wave's `all` (our enrolment-and-vote
   weighting, marked wt); a named region reads the report's printed cells */
assert.ok(ap.includes("const rekeyMrp = (ws)") && ap.includes("...w, ...w.all, wt: true"),
  "rekeyMrp lifts the region's cells; All voters is the enrolment-and-vote weighting (wt stamped)");

// ---- the third chart's coloured title ------------------------------------------------
assert.ok(ap.includes('<span className="rd-fl-xb">Coalition</span> v <span className="rd-fl-xo">One Nation</span>'),
  "the third chart's name splits into two party-inked spans");
const cssRd = fs.readFileSync(path.join(ROOT, ".build", "newtracker", "assets", "rd.css"), "utf8");
assert.ok(/body\.rd \.rd-fl-xb \{ color: var\(--lnp-text\)/.test(cssRd),
  "Coalition in the title paints coalition blue (--lnp-text), not inherits the page ink");
assert.ok(/body\.rd \.rd-fl-xo \{ color: var\(--onp-text\)/.test(cssRd),
  "One Nation in the title paints One Nation orange (--onp-text)");

// ---- the new marks' CSS ----------------------------------------------------------------
assert.ok(/\.rd-ff-tr\.\w+/.test(cssRd) && cssRd.includes("stroke-linejoin"),
  "every cohort's triangle fills the chart ground and carries its party-inked stroke");
assert.ok(/\.rd-ff-x\.\w+/.test(cssRd) && cssRd.includes("stroke-linecap"),
  "every cohort's cross strokes its party ink, no fill");
assert.ok(cssRd.includes(".rd-ff-keydm") && cssRd.includes("clip-path: polygon(50% 0, 100% 100%, 0 100%)"),
  "the key's MRP token is a solid triangle matching the plot mark");
assert.ok(cssRd.includes(".rd-ff-keyx") && cssRd.includes(".rd-ff-keyx::before") && cssRd.includes("rotate(-45deg)"),
  "the key's 2026-count token is a cross");
assert.ok(cssRd.includes(".rd-ff-sw.mrp") && cssRd.includes(".rd-ff-sw.byelec"),
  "the tooltip swatches take the mark's shape: MRP triangles, 2026-count crosses");
assert.ok(cssRd.includes(".rd-ff-keyring"), "the key names the 2025 election's rings");
assert.ok(cssRd.includes(".rd-ff-keyln"), "the key's line token marks RedBridge/Accent's monthly run");
assert.ok(/body\.rd \.rd-fl-emptycell \{[^}]*align-self: center;/.test(cssRd),
  "the national-only empty cell is styled and centres in the chart's subgrid row");

// ---- the xnote and key in the renderer ------------------------------------------------
assert.ok(ap.includes("Triangles mark DemosAU’s MRP readings"), "the svg's spoken note names the triangles");
assert.ok(ap.includes("Crosses mark the 2026 state and by-election counts."), "the spoken note names the crosses where they're drawn");
assert.ok(ap.includes("(FF.bys || []).length > 0") || ap.includes('(FF.bys || []).length'), "the crosses' key item is gated on crosses existing");
assert.ok(ap.includes("FF.elec2025r &&"), "the rings' key item is gated on the region carriers existing");

// ---- the Flows table fold (user 2026-10-13) --------------------------------------------
assert.ok(ap.includes('summary="Flows table"'), "the Flows table fold mounts in the Preference-flows section");
assert.ok(ap.indexOf('summary="Flows table"') > 0 && ap.indexOf('summary="Flows table"') < ap.lastIndexOf('summary="Trend-significance table"'),
  "the Flows table sits directly above the section's trend-significance battery (the last RdTsig mount in the file)");
assert.ok(ap.includes('name: "2025 election, as counted"') && ap.includes('name: "The flows this site uses"'),
  "each contest's rows open with the election's counted flows, then the site's own tables");
assert.ok(ap.includes("D.flowTables"), "the site's row reads the emitted flowTables constants (flows.mjs, the one home)");
assert.ok(ap.includes('heads={["Flow", "All voters", "Inner metro", "Outer metro", "Regional"]}'),
  "the table's columns run the four electorate views");
assert.ok(ap.includes("Labor v Coalition — the share of each cohort choosing Labor") &&
          ap.includes("Labor v One Nation — the share of each cohort choosing Labor") &&
          ap.includes("Coalition v One Nation — the share of each cohort choosing the Coalition"),
  "one row set per contest, each naming where its shares land");

// ---- the renderer's earlier contract still stands --------------------------------------
assert.ok(ap.includes('q="co" waves={FF.vsCoal}'), "the v-Coalition chart rides RedBridge's own series (its national-only drop happens in the region ternary above)");
assert.ok(ap.includes("const demoRows = FF ? rekeyMrp(FF.demosOn) : [];"),
  "the v-One-Nation chart's MRP extras come from the rekeyed demosOn carriers");
assert.ok(ap.includes("moved.length !== 1"), "a title tail names a cohort only when EXACTLY ONE moved");
assert.ok(ap.includes('key: "pressed"'), "the pressed-choice rows join the trend-significance table as their own set");
assert.ok(cssRd.includes(".rd-ff-two .rd-fl-one { display: grid; grid-row: span 3; grid-template-rows: subgrid; }"),
  "the forced pair shares one subgrid (contest, title, chart) so the two svgs stay row-aligned however the titles wrap");

// ---- the satellite stays stripped -------------------------------------------------------
const page = fs.readFileSync(path.join(ROOT, "preference-flows", "index.html"), "utf8");
for (const dead of ['id="forced"', '<a href="#forced"', "flow-splits.json", 'id="fsq-', ".fsq ", "--fs-alp",
                    'draw("fsq-'])
  assert.ok(!page.includes(dead), `the satellite keeps no trace of: ${dead}`);
assert.ok(page.includes('respondent-allocated two-party answers by first preference &mdash; charted under Preference flows in the <a href="/#allpolls">'),
  "the source bullet redirects the splits reader to the main page's All polls tab");
assert.ok(!fs.existsSync(path.join(ROOT, "assets", "flow-splits.json")),
  "the retired flow-splits.json asset is gone");
console.log("test-flow-splits: ok");
