/* test-flow-splits.mjs – pins the preference-flows data and its renderer in
   the All-polls Preference flows section (the forced-choice answers moved
   2026-10-10 from the /preference-flows/ satellite's #forced section).
   The data: gen-data's D.flowForced (§7db) carries RedBridge/Accent's waves
   read straight off polls.json's tpp_split/tpp_split_on rows verbatim, the
   June-2026 Coalition est derivation rides exactly one cohort of one wave,
   DemosAU's MRP carriers (demos/demosOn/lnpOn) carry its printed figures
   (the One Nation contests by region), the 2025 election's counted flows
   are elec2025r: the NATIONAL carrier typed from flows.mjs's FLOW
   constants, the AEC's TPP flow cut (elec2025r.all), plus the three
   seat-classification region carriers (inner/outer/regional — this site's
   replay of the classic seats' counts, the constants typed from
   .build/aec-2025-region-tpp-flows.mjs's output, user call 2026-10-13: "the
   2025 election flows are based on seat classification, which she worked
   out already"), and the 2026 state and by-election counts (bys: SA2026
   Bonham estimates, Secret Harbour — on the days of the elections; Farrer's
   pair dropped 2026-10-13, those counts measured independent contests, not
   One Nation voters' choices).
   The renderer was REBUILT 2026-10-13 (evening; the user: "an ill-conceived
   and disordered hodgepodge - especially on small screens"): the three
   charts and the flows tables gave way to design B - contest tabs over a
   ledger (one row per voter group: the assumed flow, RedBridge/Accent's and
   DemosAU's latest answers, a line of RedBridge's answers against the
   assumption, DemosAU's triangles apart from it), then the contest's drift
   chart. A named region drops every national mark (the user: "there should
   be no RedBridge/Accent polls" in a region's view) and rekeys the election
   column to the class's seat replay.
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

/* the 2025 election rings: the national carrier typed from flows.mjs's
   FLOW constants — the AEC's TPP flow product (every ballot redistributed
   ALP v Coalition), the cut the estimate's implied 2PP reads — plus the
   three seat-classification carriers the region menu rekeys to: this
   site's replay of each class's classic seats (the constants typed from
   .build/aec-2025-region-tpp-flows.mjs's output — rerun it to re-derive;
   the user, 2026-10-13: "the 2025 election flows are based on seat
   classification, which she worked out already"). Each region carrier is
   flagged der and names its class coverage so tips and notes can never
   sell it as the AEC's own count */
assert.ok(FF.elec2025r && FF.elec2025r.all, "elec2025r carries the national rings carrier");
assert.deepEqual(Object.keys(FF.elec2025r).sort(), ["all", "inner", "outer", "regional"],
  "elec2025r carries the national carrier plus the three seat-classification replays");
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
assert.ok(!FF.elec2025r.all.der && !FF.elec2025r.all.scopeTtl && !FF.elec2025r.all.scopeNote,
  "the national carrier stands as the AEC's own count — no replay flags");
const REPLAY = { inner: { grn: 86.41, onp: 33.8, oth: 55.68, cl: "25 of 43", of: "inner metro" },
                 outer: { grn: 79.32, onp: 35.34, oth: 52.46, cl: "40 of 45", of: "outer metro" },
                 regional: { grn: 76.9, onp: 31.46, oth: 49.01, cl: "50 of 62", of: "regional or rural" } };
for (const [rk, want] of Object.entries(REPLAY)) {
  const r = FF.elec2025r[rk];
  assert.deepEqual(Object.fromEntries(["grn", "onp", "oth"].map((k) => [k, r[k]])),
    Object.fromEntries(["grn", "onp", "oth"].map((k) => [k, want[k]])),
    `the ${rk} replay rides the script's own constants (${want.grn}/${want.onp}/${want.oth} — rerun .build/aec-2025-region-tpp-flows.mjs to re-derive)`);
  assert.ok(r.der === true && r.scopeTtl && r.scopeNote.includes(want.of) && r.scopeNote.includes(want.cl),
    `the ${rk} replay is flagged derived and names its class + classic-seat coverage`);
  assert.ok(Math.abs(r.xm - FF.elec2025r.all.xm) < 1e-9, `the ${rk} replay rides the same election day`);
  const all = FF.elec2025r.all;
  assert.ok(Math.abs(r.grn - all.grn) > 0.5 || Math.abs(r.onp - all.onp) > 0.5 || Math.abs(r.oth - all.oth) > 0.5,
    `the ${rk} replay visibly differs from the national count — a rekey that shows`);
}

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

/* the MRP carriers: DemosAU's regional tables for the two One Nation
   contests (the ledger's region menu rekeys them) */
assert.ok(Array.isArray(FF.demosOn) && FF.demosOn.length >= 2, "demosOn carries the MRP's Labor-v-One-Nation regional carriers");
assert.ok(Array.isArray(FF.lnpOn) && FF.lnpOn.length >= 2, "lnpOn carries the MRP's Coalition-v-One-Nation carriers");

// ---- the renderer: design B of 2026-10-13 (contest tabs, a ledger per contest, the drift chart) ----
/* The section was rebuilt 2026-10-13 (the user: "an ill-conceived and
   disordered hodgepodge - especially on small screens"; design B of that
   day's mockups, their pick): contest tabs walk Labor v Coalition, Labor v
   One Nation and Coalition v One Nation; each tab's ledger lists the
   contest's voter groups - the assumed flow, RedBridge/Accent's and
   DemosAU's latest answers, a line of RedBridge's monthly answers against
   the assumption - then the contest's drift chart. DemosAU's triangles
   stand APART from RedBridge's line (the user's call the same day,
   reversing the morning's joined line) */
const ap = fs.readFileSync(path.join(ROOT, ".build", "newtracker", "assets", "rd-allpolls.jsx"), "utf8");
const cssRd = fs.readFileSync(path.join(ROOT, ".build", "newtracker", "assets", "rd.css"), "utf8");
const app = fs.readFileSync(path.join(ROOT, ".build", "newtracker", "assets", "d1a1d215-370c-4ebc-878b-7eeea9ad8102.js"), "utf8");
assert.ok(/function RdFlows\(\{ measure \}\)/.test(ap), "RdFlows takes the page's two-party contest");
assert.ok(app.includes("<RdFlows measure={measure} />"), "the All-polls view hands RdFlows the page's contest");
assert.ok(/function RdFlowSpark\(/.test(ap), "the ledger's per-group line component exists");
assert.ok(!/function RdForced\(/.test(ap) && !ap.includes("<RdForced "), "the old three forced-choice charts are gone");
assert.ok(ap.includes('const FL_TABS = [{ id: "co", label: "Labor v Coalition" }, { id: "on", label: "Labor v One Nation" }, { id: "ln", label: "Coalition v One Nation" }];'),
  "three contest tabs, Labor v Coalition first");
assert.ok(ap.includes('<RdTabs swipe value={q}') && ap.includes('className="rd-fl-tabs" options={tabs}')
  && ap.includes('const tabs = FF ? FL_TABS : FL_TABS.filter((t) => t.id !== "ln");'),
  "the tabs ride RdTabs (swipeable, the house-lean idiom); a jurisdiction with no forced-choice answers (/vic/) walks the two drift charts alone");
assert.ok(ap.includes("{FF && (\n          <div className=\"rd-fl-ledger\" ref={ledger}>"),
  "the ledger draws only where the forced-choice answers exist");
assert.ok(ap.includes("const tabOf = (m) => (m === \"onp\" ? \"on\" : \"co\");") && ap.includes("setQ(tabOf(measure));"),
  "the tab opens on the page's contest and follows its two-party flip");
assert.ok(ap.includes("D.flowForced"), "the ledger reads the data asset, not a fetch");
assert.ok(ap.includes("D.flowTables"), "the One Nation contest's assumption reads the emitted flowTables (flows.mjs, the one home)");
assert.ok(ap.includes("FT.onp.lnp * 100") && ap.includes("FT.onBand.lnp * 100"),
  "the Labor-v-One-Nation ledger sets the site's built table and its band beside the polls");

/* each menu on the part it steers: the region menu in the ledger's head,
   the highlight menu in the drift chart's head */
{
  const iL = ap.indexOf('className="rd-fl-lhead"'), iReg = ap.indexOf('aria-label="Region"');
  const iD = ap.indexOf('className="rd-fl-dhead"'), iPick = ap.indexOf('aria-label="Highlight a pollster"');
  assert.ok(iL > 0 && iReg > iL && iD > iReg && iPick > iD,
    "the region menu sits in the ledger's head, the highlight menu in the drift chart's head");
}
assert.ok(ap.includes('const FF_REGIONS = [["", "All voters"], ["inner", "Inner metro"], ["outer", "Outer metro"], ["regional", "Regional"]];'),
  "the region menu is All voters + the MRP's three named regions");

/* the region contract (user 2026-10-13): a named region drops every
   national mark - RedBridge/Accent's waves, DemosAU's one national
   Labor-v-Coalition figure, the 2026 counts - and rekeys the election
   column to the seat-classification replay; DemosAU's printed regional
   cells ride the One Nation contests */
assert.ok(ap.includes("rb: ffReg ? [] : FF.vsCoal") && ap.includes("rb: ffReg ? [] : FF.vsOn"),
  "on a named region RedBridge/Accent's waves drop out of both contests (\"there should be no RedBridge/Accent polls\")");
assert.ok(ap.includes("dm: ffReg ? [] : (FF.demos || [])"), "DemosAU's national Labor-v-Coalition figure drops on a named region");
assert.ok(ap.includes("bys: ffReg ? [] : (FF.bys || [])"), "the 2026 counts drop on a named region (national counts)");
assert.ok(ap.includes("ref: E ? (ffReg && E[ffReg] ? E[ffReg] : E.all) : null"),
  "the election column rekeys to the class's seat replay, All voters the national count");
assert.ok(ap.includes("dm: rekeyMrp(FF.demosOn)") && ap.includes("dm: rekeyMrp(FF.lnpOn)"),
  "the One Nation contests' DemosAU cells ride the region menu");
assert.ok(ap.includes("const rekeyMrp = (ws)") && ap.includes("...w, ...w.all, wt: true"),
  "rekeyMrp lifts the region's cells; All voters is the enrolment-and-vote weighting (wt stamped)");

/* the line: RedBridge's waves alone draw it; DemosAU's triangles stand
   apart, joined by a thin line only where DemosAU is the one house */
assert.ok(ap.includes('const rb = marks.filter((m) => m.kind === "wave");') && ap.includes("const pts = rb.map((m) => [X(m.xm), Y(m.v)]);"),
  "the group's line runs through RedBridge's waves alone");
assert.ok(ap.includes('{pts.length > 1 && <path className={"rd-fx-line " + cls} d={monotoneXY(pts)}></path>}'),
  "the line path is the waves' own curve");
assert.ok(ap.includes("{!rb.length && dm.length > 1 && <path className={\"rd-fx-mline \" + cls}"),
  "DemosAU's marks join only where no RedBridge line exists (the Coalition v One Nation contest, a named region)");
assert.ok(ap.includes('className={"rd-fx-tr " + cls}') && ap.includes('className={"rd-fx-x " + cls}'),
  "DemosAU's readings are triangles, the 2026 counts crosses");
assert.ok(ap.includes('<path className="rd-fx-ref"') && ap.includes('<rect className="rd-fx-refb"'),
  "the assumption is a dotted line across the row, its band shaded where it carries one");

/* the battery stands on the All-voters series, never the menu's view, so
   the head and the ledger's "down from" never move with the menu */
assert.ok(ap.includes('["ln", allMrp(FF.lnpOn), ["alp", "grn", "oth"]]'), "the battery reads DemosAU's All-voters series");
assert.ok(ap.includes("withinHouseSlope(s.map((w) => ({ h: cq + ck, t: (w.xm ?? mi(w.ym)) / 12, w: 1, y: w[ck] })))"),
  "one straight line per group, w=1, the year scale");
assert.ok(ap.includes("if (r.fit.p >= 0.05 / (tested.length - i)) break;"), "Holm's correction across the battery");
assert.ok(ap.includes("const mv = !ffReg ? movedOf(q, ck) : null;"), "the ledger's change note rides the battery's Yes, on All voters only");

/* the head's written rules: a drift clear of its margin leads; else a
   group the battery says moved; else still flowing as at the election */
assert.ok(ap.includes("const head = outC || outO") && ap.includes("voiceMove ? FF_COHORTS[voiceMove.ck].name + \" voters say they’d now send \"")
  && ap.includes("\"Preferences are still flowing much as they did at the election\""),
  "the head's three branches are written in code");

/* tooltips: never wider than their chart, sentences wrap (the bug the
   user reported 2026-10-13 - the DemosAU tips ran 371-410px on a 390px
   phone and widened the page) */
assert.equal((ap.match(/maxWidth: W - 16/g) || []).length, 4,
  "every preference-flows tip carries maxWidth W - 16: the drift chart's three kinds and the ledger's");
assert.ok(cssRd.includes("body.rd .rd-fx-tip { width: max-content; white-space: normal; z-index: 30; }"),
  "the ledger's tip sizes to its content and wraps its sentences");
assert.ok(cssRd.includes("body.rd .rd-fl-tip :is(.tip-sub, .tip-hint) { white-space: normal; }"),
  "the drift chart's tip sentences wrap");
assert.ok(/@media \(max-width: 620px\) \{\s*body\.rd \.rd-fl-tabs > div\[role="group"\] \{[^}]*overflow-x: auto/.test(cssRd),
  "a phone's contest tabs scroll under a fade, as the house-lean tabs do");

/* the old furniture is gone, code and CSS */
assert.ok(!/rd-ff-|rd-ft-|"rd-ft"/.test(ap), "no forced-chart or flows-table classes remain in the renderer");
assert.ok(!/rd-ff-|rd-ft-/.test(cssRd), "no forced-chart or flows-table rules remain in rd.css");
assert.ok(ap.includes('summary="Trend-significance table"') && ap.indexOf('summary="Trend-significance table"', ap.indexOf("function RdFlows(")) > ap.indexOf('className={"rd-fl-dblock"'),
  "the trend-significance battery still closes the section, under the drift chart");
assert.ok(ap.includes('className="rd-fl-tabs"') && ap.indexOf('className="rd-fl-lhead"') > ap.indexOf("className=\"rd-fl-tabs\"")
  && ap.indexOf('className={"rd-fl-dblock"') > ap.indexOf('className="rd-fl-lhead"'),
  "reading order: tabs, then the ledger, then the drift chart");

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
