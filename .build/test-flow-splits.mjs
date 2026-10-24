/* test-flow-splits.mjs – pins the preference-flows data and its renderer in
   the All-polls Respondent-allocated preference flows section (the forced-choice answers moved
   2026-10-10 from the old /preference-flows/ satellite's #forced section –
   which itself retired 2026-10-15 to a redirect stub when the explainer
   joined the main build as /flows-explained/).
   The data: gen-data's D.flowForced (§7db) carries RedBridge/Accent's waves
   read straight off polls.json's tpp_split/tpp_split_on rows verbatim, the
   June-2026 Coalition est derivation rides exactly one cohort of one wave,
   DemosAU's MRP carriers (demos/demosOn/lnpOn) carry its printed figures
   (the One Nation contests by region), the 2025 election's counted flows
   are elec2025r: ALL FOUR carriers the AEC's counted flows in the 115
   classic seats (inner/outer/regional the seat classes, `all` the same
   115 seats whole — the constants typed from
   .build/aec-2025-region-tpp-flows.mjs's output over the vendored
   HouseTcpFlowByDivision file, user call 2026-10-13: "the 2025 election
   flows are based on seat classification, which she worked out already";
   the estimator's all-150-seat constants stay in flows.mjs and ride
   `all.nat` for the footnote only), and the counts where the Labor-v-One-
   Nation choice was measured directly (bys: Hunter 2025 — the AEC's
   HouseTcpFlowByDivision read over its one ALP-v-ON classic seat, added
   2026-10-20 when the explainer's election chart gained the pairing flip;
   SA2026 Bonham estimates, Secret Harbour — on the days of the elections;
   Farrer's pair dropped 2026-10-13, those counts measured independent
   contests, not One Nation voters' choices).
   The renderer was REBUILT 2026-10-13 (evening; the user: "an ill-conceived
   and disordered hodgepodge - especially on small screens"): the three
   charts and the flows tables gave way to design B - contest tabs over a
   ledger (one row per voter group: the assumed flow, RedBridge/Accent's and
   DemosAU's latest answers, a line of RedBridge's answers against the
   assumption, DemosAU's triangles apart from it), then the contest's drift
   chart. A named region drops every national mark (the user: "there should
   be no RedBridge/Accent polls" in a region's view) and rekeys the election
   column to the class's seat count.
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

/* the 2025 election rings: ALL FOUR carriers are the AEC's counted
   flows in the seats that finished Labor v Coalition, summed from its
   HouseTcpFlowByDivision file (the constants typed from
   .build/aec-2025-region-tpp-flows.mjs's output — rerun it to re-derive;
   the user, 2026-10-13: "the 2025 election flows are based on seat
   classification, which she worked out already") — `all` the same 115
   seats as the three region views partition, so the parts ballot-weight
   to the whole (2026-10-19 reader report). Until 2026-10-19 these were a
   replay of the distribution of preferences that blended origins in
   cascaded piles (GRN 80.45, ON 33.02); the closeness pins below keep it
   from coming back. The estimator's all-150-seat constants (flows.mjs's
   FLOW) ride `all.nat` for the footnote, never the cells */
assert.ok(FF.elec2025r && FF.elec2025r.all, "elec2025r carries the national rings carrier");
assert.deepEqual(Object.keys(FF.elec2025r).sort(), ["all", "inner", "outer", "regional"],
  "elec2025r carries the all-seats carrier plus the three seat-classification carriers");
assert.ok(!FF.elec2025, "the old single elec2025 carrier is gone — the rings ride elec2025r.all");
const COUNTED = { all: { grn: 87.46, onp: 25.86, oth: 48.33, cl: "115 of 150", of: "every seat that finished Labor v Coalition" },
                  inner: { grn: 90.29, onp: 25.99, oth: 51.57, cl: "25 of 43", of: "inner metro" },
                  outer: { grn: 86.95, onp: 27.65, oth: 48.88, cl: "40 of 45", of: "outer metro" },
                  regional: { grn: 85.76, onp: 24.76, oth: 47.19, cl: "50 of 62", of: "regional or rural" } };
assert.ok(Math.abs(FF.elec2025r.all.xm - (2025 * 12 + 4 + 2 / 31)) < 1e-3,
  `the carrier rides 3 May 2025 on the month-index scale (xm ${FF.elec2025r.all.xm})`);
assert.equal(JSON.stringify(FF.elec2025r.all.nat),
  JSON.stringify(Object.fromEntries(["grn", "onp", "oth"].map((k) => [k, Math.round(FLOW_PIN[k] * 1e4) / 100]))),
  "all.nat quotes the estimator's all-150-seat constants, to the hundredth");
assert.ok(Math.abs(FF.elec2025r.all.grn - FF.elec2025r.all.nat.grn) < 1.5 && Math.abs(FF.elec2025r.all.onp - FF.elec2025r.all.nat.onp) < 1.5,
  "the classic-seat GRN and ON flows sit within 1.5 points of the AEC's all-seat figures — the blended replay (80.45/33.02) missed by 7");
for (const [rk, want] of Object.entries(COUNTED)) {
  const r = FF.elec2025r[rk];
  assert.deepEqual(Object.fromEntries(["grn", "onp", "oth"].map((k) => [k, r[k]])),
    Object.fromEntries(["grn", "onp", "oth"].map((k) => [k, want[k]])),
    `the ${rk} carrier rides the script's own constants (${want.grn}/${want.onp}/${want.oth} — rerun .build/aec-2025-region-tpp-flows.mjs to re-derive)`);
  assert.ok(r.der === true && r.cov === want.cl && r.scopeTtl && r.scopeNote.includes(want.of) && r.scopeNote.includes(want.cl),
    `the ${rk} carrier is starred and names its seats + coverage`);
  assert.ok(Math.abs(r.xm - FF.elec2025r.all.xm) < 1e-9, `the ${rk} carrier rides the same election day`);
  if (rk !== "all") {
    const all = FF.elec2025r.all;
    assert.ok(Math.abs(r.grn - all.grn) > 0.5 || Math.abs(r.onp - all.onp) > 0.5 || Math.abs(r.oth - all.oth) > 0.5,
      `the ${rk} carrier visibly differs from the all-seats one — a rekey that shows`);
  }
}

/* the crosses (user 2026-10-13; Hunter 2025 joined them 2026-10-20 with
   the explainer chart's Labor-v-One-Nation pairing flip): the counts that
   measured the Labor-v-One-Nation choice directly — Hunter (the AEC's
   count of the full distribution in its one ALP-v-ON classic seat),
   SA 2026 (Bonham's estimates) and Secret Harbour's early-voting-centre
   count. Each on its election DAY, none joined to any line. Farrer's pair
   is GONE (2026-10-13): its counts measured a Liberal-v-Nationals contest
   and One-Nation-independent races, nothing to do with One Nation voters'
   preferences */
assert.ok(Array.isArray(FF.bys) && FF.bys.length === 3, "bys carries the three measured-contest crosses");
assert.deepEqual([...FF.bys.map((d) => d.key)].sort(), ["harbour", "hunter", "sa2026"],
  "the crosses are Hunter 2025, SA 2026 and Secret Harbour — no Farrer reading survives (its counts were an independent national contest's)");
const byKey = new Map((FF.bys || []).map((d) => [d.key, d]));
assert.deepEqual(Object.fromEntries(["coal", "grn", "oth"].map((k) => [k, byKey.get("hunter")[k]])), { coal: 17.06, grn: 87.39, oth: 40.25 },
  "Hunter 2025: the AEC's counted flows (Nationals 17.06 / Greens 87.39 / five minor parties 40.25 to Labor)");
assert.equal(byKey.get("hunter").date, "2025-05-03", "Hunter rides its election day");
assert.equal(byKey.get("hunter").lbl.coal, "Nationals", "Hunter's Coalition cohort names the partner — no Liberal stood");
/* SA 2026 is THIS SITE's estimate (user 2026-10-21 review: a cross with no
   range hid that it and Bonham's differ), with its tested 90% misses */
const SAC = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "state-flows-backtest.json"), "utf8")).contests["sa-2026-alp-onp"];
const sa = byKey.get("sa2026");
assert.deepEqual(Object.fromEntries(["coal", "grn", "oth"].map((k) => [k, sa[k]])),
  { coal: Math.round(SAC.model.lib * 10) / 10, grn: Math.round(SAC.model.grn * 10) / 10, oth: Math.round(SAC.model.oth * 10) / 10 },
  "SA 2026: the estimator's Liberal / Greens / all-others flows to Labor");
assert.equal(sa.kind, "est", "SA 2026 is an estimate");
assert.deepEqual({ ...sa.err }, { coal: SAC.err90.lib, grn: SAC.err90.grn, oth: SAC.err90.oth }, "SA 2026 carries the estimator's tested 90% misses");
assert.ok(["coal", "grn", "oth"].every((k) => sa.err[k] > 0 && sa.err[k] < 6), "each SA error is a real, bounded figure");
assert.ok(/Bonham 33\.9/.test(sa.alt.coal) && /Bonham 84\.8/.test(sa.alt.grn), "Bonham's figures ride beside the site's");
assert.equal(byKey.get("hunter").kind, "count", "Hunter is a count");

assert.equal(byKey.get("sa2026").date, "2026-03-21", "SA 2026 rides its election day");
assert.equal(byKey.get("sa2026").lbl.coal, "Liberal", "SA's Coalition cohort names the partner");
/* Secret Harbour (user 2026-10-22): the whole-seat estimate from the early
   voting centre's count sheets plus the rest of the seat's totals
   (.build/secret-harbour-flows.py), its bars the range over ways of
   dividing the rest's known total */
const SHF = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "secret-harbour-flows.json"), "utf8"));
const hb = byKey.get("harbour");
assert.deepEqual([hb.coal, hb.grn, hb.oth], ["lib", "grn", "oth"].map((g) => Math.round(SHF.estimate[g] * 10) / 10),
  "Secret Harbour: the whole-seat estimate");
assert.equal(hb.kind, "est", "Secret Harbour is an estimate now, not a partial count");
for (const [ck, g] of [["coal", "lib"], ["grn", "grn"], ["oth", "oth"]]) {
  assert.deepEqual([...hb.range[ck]], SHF.range[g], `Secret Harbour ${g}: its range`);
  assert.ok(hb.range[ck][0] <= hb[ck] && hb[ck] <= hb.range[ck][1], `Secret Harbour ${g}: the estimate sits in its range`);
}
assert.equal(SHF.early_polling_place.lib, 29.83, "the early voting centre's counted Liberal flow (Green's 70.2% to One Nation)");
{
  const art = fs.readFileSync(path.join(ROOT, ".build", "newtracker", "explained-article.html"), "utf8");
  const f = (x) => x.toFixed(1);
  const row = `(this site&rsquo;s estimate, whole seat)</td><td>${f(SHF.estimate.lib)} (${f(SHF.range.lib[0])}&ndash;${f(SHF.range.lib[1])})</td>`;
  assert.ok(art.includes(row), "the explainer's Secret Harbour row quotes the estimate and its range");
  assert.ok(art.includes(`whole seat&rsquo;s Liberal voters at ${f(100 - SHF.estimate.lib)}% to One Nation`), "the prose quotes it too");
}
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
/* the battery and the section's head and dek live in menu-lines.js since
   2026-10-18 (the More menu quotes the same finding); RdFlows reads them */
const ml = fs.readFileSync(path.join(ROOT, ".build", "newtracker", "assets", "menu-lines.js"), "utf8");
assert.ok(/function RdFlows\(\{ measure \}\)/.test(ap), "RdFlows takes the page's two-party contest");
assert.ok(app.includes("<RdFlows measure={measure} />"), "the All-polls view hands RdFlows the page's contest");
assert.ok(/function RdFlowSpark\(/.test(ap), "the ledger's per-group line component exists");
assert.ok(!/function RdForced\(/.test(ap) && !ap.includes("<RdForced "), "the old three forced-choice charts are gone");
assert.ok(ap.includes('const FL_TABS = [{ id: "co", label: "Labor v Coalition" }, { id: "on", label: "Labor v One Nation" }, { id: "ln", label: "Coalition v One Nation" }];'),
  "three contest tabs, Labor v Coalition first");
assert.ok(ap.includes('<RdTabs swipe value={q}') && ap.includes('className="rd-fl-tabs" options={tabs}')
  && ap.includes('const tabs = FF ? FL_TABS : FL_TABS.filter((t) => t.id !== "ln");'),
  "the tabs ride RdTabs (swipeable, the house-lean idiom); a jurisdiction with no forced-choice answers (/vic/) walks the two drift charts alone");
assert.ok(ap.includes("{FF && (\n          <div className=\"rd-fl-ledger\" ref={ledger}"),
  "the ledger draws only where the forced-choice answers exist");
assert.ok(ap.includes("if (ev.pointerType !== \"touch\") return;") && ap.includes("ev.target.closest(\".rd-fx-spark\")"),
  "a touch tap anywhere in the ledger but off a spark puts the open tip away (user report 2026-10-19)");
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
   Labor-v-Coalition figure, the counted contests - and rekeys the election
   column to the seat-classification count; DemosAU's printed regional
   cells ride the One Nation contests */
assert.ok(ap.includes("rb: ffReg ? [] : FF.vsCoal") && ap.includes("rb: ffReg ? [] : FF.vsOn"),
  "on a named region RedBridge/Accent's waves drop out of both contests (\"there should be no RedBridge/Accent polls\")");
assert.ok(ap.includes("dm: ffReg ? [] : (FF.demos || [])"), "DemosAU's national Labor-v-Coalition figure drops on a named region");
assert.ok(ap.includes("bys: ffReg ? [] : (FF.bys || [])"), "the measured-contest crosses drop on a named region (national counts)");
assert.ok(ap.includes("ref: E ? (ffReg && E[ffReg] ? E[ffReg] : E.all) : null"),
  "the election column rekeys to the class's seats, All voters the 115 seats whole");
assert.ok(ap.includes('refSub: (ffReg ? regName : "as counted") + "*"'),
  "every election view carries the star — all four cover only the seats that finished Labor v Coalition");
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
assert.ok(ap.includes('className={"rd-fx-tr " + cls}') && ap.includes('className={"rd-fx-x " + cls + (m.d.kind === "part" ? " rd-fx-xhol" : "")}'),
  "DemosAU's readings are triangles, the 2026 counts and estimates crosses (a count of part of the vote hollow)");
assert.ok(ap.includes('className={"rd-fx-x rd-fx-xerr " + cls}'), "an estimate's cross carries its 90% error as a whisker");
assert.ok(ap.includes('<path className="rd-fx-ref"') && ap.includes('<rect className="rd-fx-refb"'),
  "the assumption is a dotted line across the row, its band shaded where it carries one");

/* the battery stands on the All-voters series, never the menu's view, so
   the head and the ledger's "down from" never move with the menu */
assert.ok(ap.includes("const { head, dek, ff, movedOf } = window.AP.flowStory();"), "the page heads itself with the shared finding");
assert.ok(ml.includes('["ln", allMrp(FF.lnpOn), ["alp", "grn", "oth"]]'), "the battery reads DemosAU's All-voters series");
assert.ok(ml.includes("withinHouseSlope(s.map((w) => ({ h: cq + ck, t: (w.xm ?? mi(w.ym)) / 12, w: 1, y: w[ck] })))"),
  "one straight line per group, w=1, the year scale");
assert.ok(ml.includes("if (r.fit.p >= 0.05 / (tested.length - i)) break;"), "Holm's correction across the battery");
assert.ok(ap.includes("const mv = !ffReg ? movedOf(q, ck) : null;"), "the ledger's change note rides the battery's Yes, on All voters only");

/* the head's written rules: a drift clear of its margin leads; else a
   group the battery says moved; else still flowing as at the election */
assert.ok(ml.includes("const head = outC || outO") && ml.includes("voiceMove ? FF_COHORTS[voiceMove.ck].name + \" voters say they’d now send \"")
  && ml.includes("\"Preferences are still flowing much as they did at the election\""),
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

/* the explainer's pairing flip (user 2026-10-20): /flows-explained/'s
   election chart gained a "Two-party:" control beside "Direction:" —
   Labor v Coalition rides the flowHistory election histories with the
   jurisdiction chips; Labor v One Nation charts the measured flowForced.bys
   contests (no chips — "no extra views like state-by-state", ONE view, as
   the "one nation v labor" chart's crosses do on /flows/). The flip idiom:
   the button names the ACTIVE pairing, its title announces the destination.
   2026-10-21 (further user calls): the controls sit in ONE menu bar —
   label "Share:" (was Direction), its button the active side alone —
   and the Federal chip carries its own National+state/territory sub-row
   (fed.states, the AEC's counted per-state cuts). */
/* 2026-10-21 (user: "consistent with the design of other charts"): the
   figure is a site chart card - contest tabs (RdTabs) with the Share flip in
   their row, a .rd-chead title, ONE elections menu (a native select over
   federal national, federal by state and the state elections) in place of
   the chips, px-sized TrendChart frame, .rd-ckey, RdFoot, a copy prop - and
   tooltip titles short enough that a phone's readout sizes to its rows.
   2026-10-22 (user: "the following views: 'Federal, inner metro'…"): four
   more options to the federal optgroup ride fedcl:<class> - FH.fed.classes
   (FED_CLASSES in RdExplained, classKey beside stateKey through the chart
   and its remount key), the menu string "Federal, " + short.
   2026-10-22 (user: "House: Lower ⇄ / Upper ⇄"): a second flip (House:,
   beside Share:) cuts the same chart to the Senate's post-GVT ATL counts;
   the House-only views leave the menu under Upper.
   2026-10-22 (user: NSW's Legislative Council "at least"): the Upper menu
   gains a one-entry State-elections optgroup riding lc={lcView} - the NSW
   LC bank (FH.nsw.sen), the only state upper house with a published ballot
   record; test-nsw-lc-atl-flows pins the table and its emit gating. */
assert.ok(ap.includes("function ExplainedOnChart({ inv, menu })") && ap.includes("const ON_COHORTS = ["),
  "the explainer's single-view Labor-v-One-Nation chart exists over its own cohort set");
/* 2026-10-24 (user: Coalition v One Nation in the flows chart, Senate +
   NSW LC only): a THIRD contest tab lands. EX_PAIRS gains the "con"
   pair routing through the same onPairPick path every other pick takes
   (the circular pairStep walk included - it now rides onPairPick, never
   a bare setPair, so the con arm's Upper snap fires on arrow keys and
   swipes too); its two banks ship behind test-senate-atl-con-flows and
   test-nsw-lc-atl-con-flows */
assert.ok(ap.includes('const EX_PAIRS = [{ id: "co", label: "Labor v Coalition", short: "v Coalition" }, { id: "on", label: "Labor v One Nation", short: "v One Nation" }, { id: "con", label: "Coalition v One Nation", short: "Coalition v ON" }];')
    && ap.includes('onPairPick(EX_PAIRS[(i + dir + EX_PAIRS.length) % EX_PAIRS.length].id);'),
  "the con pair sits third in EX_PAIRS (label Coalition v One Nation, short Coalition v ON) and the circular pair walk routes through onPairPick - its Upper snap fires on the arrow/swipe walk too");
/* 2026-10-23 (user: "explain why there is no labor-versus-one-nation data
   for any of the upper house states" — decided: build NSW's computable
   one and carry the why in its caption): the render chain gained a FOURTH
   branch riding AHEAD of senOnView — a Council pick kept across the
   contest flip draws the Council's OWN One Nation cut (FH.nsw.senOn,
   FLOW_HISTORY_NSW_LC_ON; test-nsw-lc-atl-on-flows pins the table and the
   emit), the menu's state-elections optgroup and the LC bank gate are now
   pair-aware (LC_ON_BANK on the One Nation tab), and picking Labor v One
   Nation sheds the Council only while its ON cut is absent */
assert.ok(ap.includes('{twoMode ? <Explained2ppChart house={house} stateKey={stateKey} classKey={classKey} inv={twoInv} menu={headCtls} lc={lcView} />')
    && ap.includes(': primMode ? <ExplainedPrimaryChart house={house} stateKey={stateKey} classKey={classKey} statePrim={stePrim} lcKey={steLcKey} menu={headCtls} />')
    && ap.includes(': lcView && pair === "on" ? <ExplainedFlowChart jur="nsw" house="sen" stateKey={null} classKey={null} lc inv={inv} menu={headCtls} onSen />')
    && ap.includes(': lcView && pair === "con" ? <ExplainedFlowChart jur="nsw" house="sen" stateKey={null} classKey={null} lc inv={inv} menu={headCtls} onCon />')
    && ap.includes(': senOnView ? <ExplainedFlowChart jur="fed" house="sen" stateKey={stateKey && hasOnCells(stateKey) ? stateKey : null} classKey={null} lc={false} inv={inv} menu={headCtls} onSen />')
    && ap.includes(': senConView ? <ExplainedFlowChart jur="fed" house="sen" stateKey={stateKey && hasConCells(stateKey) ? stateKey : null} classKey={null} lc={false} inv={inv} menu={headCtls} onCon />')
    && ap.includes(': pair === "on" ? <ExplainedOnChart inv={inv} menu={headCtls} />')
    && ap.includes(": pair === \"con\" ? null /* no Lower Coalition-v-One-Nation count exists; the tab's pick snaps house to \"sen\" */")
    && ap.includes(': <ExplainedFlowChart jur={jur} house={house} stateKey={stateKey} classKey={house === "sen" ? null : classKey} lc={lcView} inv={inv} menu={headCtls} />}'),
  "nine-arm render: the 2PP and primary vote-share views lead (twoMode first - its House: flip rides the implied Senate bank); an ON-tab Council pick draws the Council's own ON cut, else the ON tab's Upper view draws the senOn bank, its Lower the crosses; the con contest adds its Council and fed-Senate arms then a null Lower (the Coalition contest the history chart; a class pick nulls while the Senate bank is drawn)");
assert.ok(ap.includes('{!figView && house === "sen" && lcBank && (')
    && ap.includes('<option value="nswlc">{lcBank.label}</option>')
    && ap.includes('const lcBank = pair === "on" ? LC_ON_BANK : pair === "con" ? LC_CON_BANK : LC_BANK;'),
  "the menu's state-elections optgroup rides the contest's Council bank (LC_ON_BANK on the One Nation tab, LC_CON_BANK on the con tab, LC_BANK on the Coalition)");
assert.ok(ap.includes("if (p === \"on\" && house === \"sen\" && ((lcView && !LC_ON_BANK) || (stateKey && !hasOnCells(stateKey)))) setView(\"fed\");"),
  "picking Labor v One Nation sheds only the picks its bank never carries - the Council pick survives while LC_ON_BANK ships");
assert.ok(ap.includes('if (p === "con") {')
    && ap.includes('if (house !== "sen") setHouse("sen");')
    && ap.includes('if (!(view === "fed" || (lcView && LC_CON_BANK) || (stateKey && hasConCells(stateKey)))) setView("fed");'),
  "the con tab is Upper-only: its pick snaps the House flip to Upper and sheds every view its banks never carry");
assert.ok(ap.includes('? [...(SEN_ON_BANK ? ["fed", ...senOnStateKeys.map((k) => "fed:" + k)] : []), ...(LC_ON_BANK ? ["nswlc"] : [])]'),
  "the ON tab's Upper menu walks federal-senOn then the Council, never the Coalition bank's entries");
assert.ok(ap.includes('? [...(SEN_CON_BANK ? ["fed", ...senConStateKeys.map((k) => "fed:" + k)] : []), ...(LC_CON_BANK ? ["nswlc"] : [])]'),
  "the con tab's Upper menu walks federal-senCon then the Council, never the Coalition bank's entries");
/* 2026-10-22 (user: "House: Lower ⇄ / Upper ⇄"): a second flip beside
   Share: - Upper cuts the chart to the four post-GVT Senate ATL counts
   (FLOW_HISTORY_SENATE, national + the eight states; test-senate-atl-flows
   pins the table and its emit gating). The federal menu section stays live
   (both banks carry the eight states, a fed:<key> pick re-reads from the
   Senate bank) while the House-only sections (classifications, state
   elections) snap away. 2026-10-22 (user: Labor v One Nation under
   Upper): the ON contest follows the flip, reading the Senate's own
   Labor-v-One-Nation bank (FH.fed.senOn, the same ballots' pa counters;
   test-senate-atl-on-flows pins the table) — nothing snaps the contest
   back, only the picks its bank can't carry drop to federal. */
assert.ok(ap.includes('const SEN_BANK = (FH.fed && FH.fed.sen) || null;')
    && ap.includes('const SEN_ON_BANK = (FH.fed && FH.fed.senOn) || null;')
    && ap.includes('const SEN_CON_BANK = (FH.fed && FH.fed.senCon) || null;')
    && ap.includes('const LC_CON_BANK = (FH.nsw && FH.nsw.senCon) || null;')
    && ap.includes('const [house, setHouse] = useState("rep");')
    && ap.includes('<span className="rd-pl-flip-t">{house === "sen" ? "Upper" : "Lower"}</span>')
    && ap.includes(': (house === "sen" ? "Switch to House of Representatives flows" : "Switch to Senate flows (above-the-line ballots)")'),
  "the House: flip rides the Share idiom - the button the active chamber, its title the destination, only where the build ships the bank");
assert.ok(!ap.includes('if (pair === "on") setPair("co");')
    && ap.includes('else if (classKey || !fedView || (pair === "on" && stateKey && !hasOnCells(stateKey)) || (pair === "con" && stateKey && !hasConCells(stateKey))) setView("fed");'),
  "flipping houses never snaps the contest back (the ON bank rides along) - only a pick the ON bank can't carry (a class view, a non-fed state pick, a no-ON-ticket state) drops to federal; the con pair gets the same guard (a state with no con count falls to national); Lower never snaps");
assert.ok(ap.includes('const senOnStateKeys = Object.keys(ON_SEN_STATES).filter(hasOnCells);')
    && ap.includes('const senConStateKeys = Object.keys(CON_SEN_STATES).filter(hasConCells);')
    && ap.includes('const senConView = senConMode && pair === "con" && !lcView;')
    && ap.includes('const onConPair = pair === "on" || pair === "con";')
    && ap.includes('{menuKeys.map((k) => <option key={k} value={"fed:" + k}>')
    && ap.includes('{!figView && house !== "sen" && KEYS.length > 1 && (')
    && ap.includes('const menuClassKeys = figView ? Object.keys(classBank) : house === "sen" ? [] : classKeys;'),
  "the elections menu re-reads the states from the operative bank under Upper (senOn's on the ON tab - never-on-ballot ACT out, the Coalition-only Council out) and sheds the House-only sections; the seat-class options come from the current mode's bank");
/* 2026-10-24 (user: show the ABS SEIFA data beside the AEC's class
   views; decisions: IRSAD fifths of thirty seats, all three measures):
   the menu's class slice splits at the grouping change - seat types stay
   in the federal optgroup and the five IRSAD fifths ride their own
   "Federal, by IRSAD fifth" optgroup (each fifth's short names the index,
   so the group label only adds the grouping word), both filtered off the
   same menuClassKeys the arrow walk steps */
assert.ok(ap.includes('const menuClassSeat = menuClassKeys.filter((k) => !classBank[k].seifa);')
    && ap.includes('const menuClassSeifa = menuClassKeys.filter((k) => classBank[k].seifa);')
    && ap.includes('{menuClassSeat.map((k) => <option key={"fedcl:" + k} value={"fedcl:" + k}>{"Federal, " + (classBank[k].short || classBank[k].label)}</option>)}')
    && ap.includes('{menuClassSeifa.length > 0 && (')
    && ap.includes('<optgroup label="Federal, by IRSAD fifth">')
    && ap.includes('{menuClassSeifa.map((k) => <option key={"fedcl:" + k} value={"fedcl:" + k}>'),
  "the class slice splits into the seat-types-in-federal list and the IRSAD-fifths optgroup, both filtered off the one menuClassKeys the arrow walk steps");
/* 2026-10-23 (user: "add federal demographic rating breakdowns to primary
   vote view - eg 'Federal, provincial'"): the primary view gains the same
   four seat-class cuts off its OWN bank (PH_HIST.fed.classes, counted by
   aec-primary-history.py; test-primary-history.mjs pins the figures) -
   classBank switches PH_CLASSES/FED_CLASSES by mode, classKey resolves
   over it, a class pick the mode's bank holds survives the View: flip,
   and only a stale pick (badClass) still snaps to "fed" */
assert.ok(ap.includes('const FED_CLASSES = (FH.fed && FH.fed.classes) || {};')
    && ap.includes('const PH_CLASSES = (PH_HIST && PH_HIST.fed && PH_HIST.fed.classes) || {};')
    && ap.includes('const classBank = primMode ? (house === "sen" ? {} : PH_CLASSES) : twoMode ? (house === "sen" ? {} : TP_CLASSES) : FED_CLASSES;')
    && ap.includes('const classKey = view.startsWith("fedcl:") && classBank[view.slice(6)] ? view.slice(6) : null;')
    && ap.includes('"fedcl:" + k'),
  "the fedcl:<class> view ids resolve over the current mode's class bank (PH_CLASSES in primary, TP_CLASSES in 2PP - both empty under Upper, whose banks hold no classes - FED_CLASSES in flows; classKey, the menu's fedcl options)");
assert.ok(ap.includes('...Object.keys(PH_CLASSES).map((k) => "fedcl:" + k), ...STE_KEYS.map((k) => "ste:" + k)')
    && ap.includes('...Object.keys(TP_CLASSES).map((k) => "fedcl:" + k)]')
    && ap.includes('if (primMode && (badClass || lcView || (!fedView && !steView))) setView("fed");')
    && ap.includes('if (!primMode && steView) setView("fed");')
    && ap.includes('if (twoMode && (badClass || (lcView && house !== "sen") || (!fedView && !lcView))) setView("fed");')
    && ap.includes('const badClass = view.startsWith("fedcl:") && !classKey;'),
  "each vote-share view lists its own bank's seat-class cuts (primary's beside the state assemblies, never under Upper, whose bank holds none), and each mode snaps the picks its bank doesn't hold back to federal - class, flow-side and primary-state picks alike (the 2PP view's council pick is legal, under Upper alone)");
assert.ok(ap.includes('function ExplainedPrimaryChart({ house, stateKey, classKey, statePrim, lcKey, menu })')
    && ap.includes('(classKey && house !== "sen" && ((PH.fed.classes || {})[classKey]))'),
  "ExplainedPrimaryChart draws a class cut when one is picked (the Senate bank holds no classes; lcKey names the Council view for its caption)");
/* 2026-10-23 (user: "what about primary votes for state elections, lower
   and upper houses"): the primary view gains its own State elections
   section off primaryHistory.stateElections (gen-data's build-time
   derivation from the state-flow CSV and the committed count banks; the
   figures and folds are pinned in test-primary-history.mjs). The six
   assemblies ride ste:<key> under Lower, the banked Legislative Councils
   ste:<key>lc under Upper - NSW's ATL count (the flows card's one upper
   house is the primary card's too), joined 2026-10-24 by the Vic, SA and
   WA full-formal banks (user: "why only nsw state upper house?", "yes") -
   and each banked-Council assembly pick twins across the House: flip the
   flows way */
assert.ok(ap.includes('const STATE_PRIM = (PH_HIST && PH_HIST.stateElections) || {};')
    && ap.includes('STE_KEYS.forEach((k) => { const s = STATE_PRIM[k] && STATE_PRIM[k].sen; if (s && s.lc) STE_LCS[k] = s; });')
    && ap.includes('const steKey = view.startsWith("ste:") && STATE_PRIM[view.slice(4)] ? view.slice(4) : null;')
    && ap.includes('const steLcKey = view.startsWith("ste:") && view.endsWith("lc") && STE_LCS[view.slice(4, -2)] ? view.slice(4, -2) : null;')
    && ap.includes('const stePrim = steLcView ? STE_LCS[steLcKey] : steKey ? STATE_PRIM[steKey] : null;'),
  "the primary state banks derive off primaryHistory.stateElections (ste:<state>, ste:<state>lc per banked Council, beside the flows-side nswlc)");
assert.ok(ap.includes('? STE_LC_KEYS.map((k) => "ste:" + k + "lc")')
    && ap.includes('...STE_KEYS.map((k) => "ste:" + k)])]'),
  "Lower's primary menu walks the six assemblies, Upper's the banked Councils");
assert.ok(ap.includes('if (steKey && STE_LCS[steKey]) setView("ste:" + steKey + "lc");')
    && ap.includes('else if (steKey) setView("fed");')
    && ap.includes('else if (steLcView) setView("ste:" + steLcKey);'),
  "the House: flip twins a banked Council's assembly pick with its Council view; every other state pick is House-only");
assert.ok(ap.includes('{STE_KEYS.map((k) => <option key={k} value={"ste:" + k}>{(STATE_PRIM[k].short || STATE_PRIM[k].label) + " state elections"}</option>)}')
    && ap.includes('{STE_LC_KEYS.map((k) => <option key={k} value={"ste:" + k + "lc"}>{STE_LCS[k].label}</option>)}'),
  "the State-elections optgroup rides the primary banks in both chambers (each Council's label from its bank)");
assert.ok(ap.includes('value={lcView && !senOnView ? "nswlc" : steLcView ? "ste:" + steLcKey + "lc" : steKey ? "ste:" + steKey : stateKey ? "fed:" + stateKey'),
  "the menu selects the primary state view ahead of the federal cuts");
assert.ok(ap.includes('const S = statePrim')
    && ap.includes('| (stateKey && (bank.states || {})[stateKey]) || bank'),
  "ExplainedPrimaryChart resolves a state-election bank ahead of every federal S");
assert.ok(ap.includes('? lcKey === "nsw"')
    && ap.includes('every formal above-the-line vote from " + S.srcLine')
    && ap.includes('One Nation ran no upper-house group in 2011 or 2015')
    && ap.includes('", every formal vote from " + S.srcLine + "."'),
  "NSW's Council caption keeps its ATL wording (below-the-line excluded, no-group years not zeroes); the full-formal banks name every formal vote");
assert.ok(ap.includes('<div className="card rd-card ex-fl-card" ref={cardMark} data-rd-swipe-exact="">') && ap.includes('<RdTabs value={pair} onChange={onPairPick} ariaLabel="Contest" className="ex-fl-tabs"'),
  "the figure is a chart card opening on contest tabs, as /flows/ does (the card ref + data-rd-swipe-exact wire its 2026-10-21 key/swipe claims)");
/* 2026-10-23 (user, quoting the shipped layout: "View: / Preference
   flows / ⇄, should sit on top of 'Labor v Coalition / Labor v One
   Nation'"): the flip rides its own row above the contest tabs on BOTH
   layouts - never a tabs child, and not the phone's head span, which
   only draws below the tabs. Desktop keeps House:/Share: as the tabs
   children; the phone keeps them in the head. (2026-10-24: in the
   vote-share views the tabs shed and the row drops to their slot - the
   next block pins that) */
assert.ok(ap.indexOf('className="ex-fl-viewrow"') > -1
    && ap.indexOf('className="ex-fl-viewrow"') < ap.indexOf('className="ex-fl-tabs"')
    && ap.includes('viewCtl ? <div className="ex-fl-viewrow">{viewCtl}</div> : null'),
  "the flows view keeps the View: switch on its own row above the contest tabs");
/* 2026-10-24 (user: "'Labor v Coalition / Labor v One Nation' menu bar
   should not be visible in 2pp or primary view … 'View: 2PP ⇄' should
   drift down towards that menu bar, taking the position it would
   otherwise occupy; same for 'View: Primary votes ⇄'"): a vote-share
   view renders NO contest tabs, and the View: switch drops to their row
   slot instead, the trailing House:/Share: flips riding its right on a
   laptop (a phone's pair stays in the chart head). pairStep's figView
   guard keeps <-/->'s scroll day job while no tabs exist to step. */
assert.ok(ap.includes('<div className="ex-fl-viewrow ex-fl-tabslot">{viewCtl}')
    && ap.includes('{narrow || (!houseCtl && !shareSlot) ? null : <span className="ex-fl-flips">{houseCtl}{shareSlot}</span>}')
    && ap.indexOf('ex-fl-tabslot') < ap.indexOf('className="ex-fl-tabs"')
    && ap.includes('<div className="ex-fl-viewrow ex-fl-vacate" aria-hidden="true">{viewCtl}</div>')
    && ap.includes('if (figView) return false;'),
  "a vote-share view sheds the contest tabs; View: drifts down to their row with the laptop's House:/Share: flips beside it, the vacated top row height-held by an invisible twin (pair walk guarded off)");
assert.ok(cssRd.includes('body.rd .ex-fl-tabslot { margin-top: 0; min-height: 44px; align-items: center; gap: 0 16px; flex-wrap: wrap; }')
    && cssRd.includes('body.rd .ex-fl-vacate { visibility: hidden; }'),
  "the drift lands pixel-exact: tabslot at the tabs' floor with no margin, the vacate row invisible but height-keeping");
assert.ok(cssRd.includes('body.rd .ex-fl-tabs > [role="group"] { flex-wrap: wrap; }')
    && cssRd.includes('body.rd .ex-fl-tabs { flex-wrap: wrap; }'),
  "three contest tabs fit a 320px phone (group wraps) and the 641-700 band (flips drop whole onto their own line) - the 2026-10-24 width-sweep overflows");
assert.ok(ap.includes('{narrow ? null : <>{houseCtl}{shareSlot}</>}')
    && ap.includes('<span className="ex-fl-flips">{houseCtl}{shareSlot}</span>')
    && !ap.includes('{viewCtl}{houseCtl}') && !ap.includes('{primMode ? viewCtl : share}'),
  "View: out of the tab row and the phone head - House: and the mode's Share: slot keep both spots alone");
assert.ok(cssRd.includes('body.rd .ex-fl-viewrow { display: flex; justify-content: flex-start;')
    && !cssRd.includes('.ex-view + .ex-view'),
  "the View row's own left-aligned rule ships in rd.css (user 2026-10-23: 'make View: Primary votes ⇄ left-aligned'; the sibling-spacing rule went with the 2026-10-24 merge to one button)");
/* 2026-10-23/24 (user: "work on the two-party preferred facet … add
   another like 'View: Preference flows ⇄', 'View: 2PP'", then "view 2pp
   should be part of the existing view preferences/primary vote toggle …
   when its all 1 toggle button"): the View: row is ONE cycling flip -
   its label the figure on the card, each press advancing to the next
   stop the build carries (flows → primary → 2pp → flows). That view
   swaps the flows history for the vote-share figures
   (window.AUSPOL.twoPPHistory; test-2pp-history.mjs pins the data and
   the handoff). figView displaces the flows-only controls in either
   vote-share view. 2026-10-24 (user: "add House: Lower ⇄ to 2pp view
   (adding upper house data)"): the 2PP view gains the House: flip too -
   Upper reads fed.sen, the IMPLIED Senate two-party off the committed
   ATL tallies (national + the eight states, 2016-2025, no classes;
   test-2pp-history.mjs pins the recompute) - and a build without it
   snaps an Upper pick back to Lower */
assert.ok(ap.includes('const TP_HIST = window.AUSPOL.twoPPHistory || null;')
    && ap.includes('const twoMode = figMode === "2pp"')
    && ap.includes('const figView = primMode || twoMode;'),
  "the 2PP view rides the flows/primary/2PP mode state (figView = either vote-share figure)");
assert.ok(ap.includes('const FIG_LABELS = { flows: "Preference flows", primary: "Primary votes", "2pp": "2PP" };')
    && ap.includes('const FIG_STOPS = ["flows", ...(phViewOk ? ["primary"] : []), ...(tpViewOk ? ["2pp"] : [])];')
    && ap.includes('const nextFig = FIG_STOPS[(FIG_STOPS.indexOf(figMode) + 1) % FIG_STOPS.length];')
    && ap.includes('const viewCtl = FIG_STOPS.length > 1 ? ('),
  "one cycling stop list: flows → primary → 2pp, each facet a stop only where its data shipped, no control with fewer than two");
assert.ok(ap.includes('const tpViewOk = !!(TP_HIST && TP_HIST.fed && TP_HIST.fed.states && TP_HIST.fed.classes);')
    && ap.includes('onClick={() => setFig(nextFig)}')
    && ap.includes('<span className="rd-pl-flip-t">{FIG_LABELS[figMode]}</span>')
    && ap.includes('title={FIG_TITLES[nextFig]}')
    && ap.includes('"2pp": "Switch to two-party preferred shares at every election"')
    && !ap.includes('setPrimaryFig') && !ap.includes('setTwoFig')
    && !ap.includes('aria-pressed={primMode}') && !ap.includes('aria-pressed={twoMode}'),
  "the ONE View: flip: label is the live figure, the press cycles to the next stop (no per-facet buttons left)");
assert.ok(ap.includes('function Explained2ppChart({ stateKey, classKey, inv, menu, house, lc })')
    && ap.includes('const TP = window.AUSPOL.twoPPHistory || null;')
    && ap.includes('const senAll = TP.fed.sen || null;')
    && ap.includes('const lcAll = TP.nswLc || null;')
    && ap.includes('const lcBank = (lc && house === "sen") ? lcAll : null;')
    && ap.includes('const senBank = (house === "sen" && !lcBank) ? senAll : null;')
    && ap.includes('? ((stateKey && (impBank.states || {})[stateKey]) || impBank)')
    && ap.includes('(classKey && ((TP.fed.classes || {})[classKey]))')
    && ap.includes('|| (stateKey && (TP.fed.states || {})[stateKey]) || TP.fed);'),
  "Explained2ppChart resolves class and state cuts off the twoPPHistory bank - one implied bank at a time under House: Upper (the NSW council pick pre-empts the Senate's; user 2026-10-24: 'add it')");
assert.ok(ap.includes('const TP_SEN = (TP_HIST && TP_HIST.fed && TP_HIST.fed.sen) || null;')
    && ap.includes('const houseCtl = (twoMode ? !!TP_SEN : SEN_BANK && (primMode || pair !== "con")) ? (')
    && ap.includes('if (twoMode && house === "sen" && !TP_SEN) setHouse("rep");')
    && ap.includes('"Switch to the implied Senate two-party'),
  "the House: control flips in the 2PP view too, only while the implied Senate bank shipped - a build without it snaps an Upper pick back to Lower; the con pair hides the flows side's House: control (it is Upper-only, so the flip it guards against never offers)");
assert.ok(ap.includes('const tpSenStateKeys = Object.keys((TP_SEN && TP_SEN.states) || {});')
    && ap.includes('? ["fed", ...tpSenStateKeys.map((k) => "fed:" + k), ...(TP_NSWLC ? ["nswlc"] : [])]')
    && ap.includes(': twoMode ? (house === "sen" ? (lcView ? [] : tpSenStateKeys) : Object.keys((TP_HIST.fed && TP_HIST.fed.states) || {}))')
    && ap.includes('if (twoMode) {')
    && ap.includes('if (classKey || lcView) setView("fed");'),
  "the 2PP Upper menu walks the implied bank's eight states plus the ONE council twin (no classes - the Senate has no divisions), and the House: flip drops a class or council pick to the national series");
/* 2026-10-24 (user: "what about state-level upper house 2pps" / "add
   it"): the 2PP Upper menu's State-elections section gains the ONE
   countable state council - window.AUSPOL.twoPPHistory.nswLc, the NSW
   Legislative Council's implied two-party off the committed NSWEC ballot
   files (test-2pp-history.mjs pins the recompute). lcView widens off the
   2PP file beside the flows bank so the council pick rides both figure
   lines; the snap keeps it legal under Upper alone, and the House: flip
   to Lower drops it to the national series */
assert.ok(ap.includes('const TP_NSWLC = (TP_HIST && TP_HIST.nswLc) || null;')
    && ap.includes('const lcView = view === "nswlc" && !!(LC_BANK || TP_NSWLC);')
    && ap.includes('if (twoMode && (badClass || (lcView && house !== "sen") || (!fedView && !lcView))) setView("fed");')
    && ap.includes('{twoMode && house === "sen" && TP_NSWLC && (')
    && ap.includes('<option value="nswlc">{TP_NSWLC.label}</option>')
    && ap.includes('lc={lcView}'),
  "the 2PP Upper menu gains the ONE state-council twin: nswlc rides lcView widened off the twoPP file, offered from its own State-elections section, legal under Upper alone");
assert.ok(ap.includes('IMPLIED, never an AEC count')
    && ap.includes('(impBank ? "Implied classic two-party preferred, " : "Classic two-party preferred, ")')
    && ap.includes('key={"ex-2pp-" + (house || "") + (lc ? "lc" : "") + (stateKey || "") + (classKey || "")}')
    && ap.includes('...(senAll ? [senAll, ...Object.keys(senAll.states || {}).map((k) => senAll.states[k])] : [])')
    && ap.includes('...(lcAll ? [lcAll] : [])')
    && ap.includes("it is the only state upper house this pair can be counted in"),
  "the implied Senate and council views caption and title themselves as the estimates they are, key their charts by chamber and council, and price their cells into the constant axis");
assert.ok(ap.includes('const hi = 100 - lo;')
    && ap.includes('if (!YT.includes(50))'),
  "the 2PP axis mirrors around the half and always ticks 50 (the pair sums to 100 by construction)");
/* 2026-10-24 (user: "add a 'Share: Labor’s ⇄' toggle to 2pp view like
   in preference flows view… it toggles which 2pp line is shown. also the
   2pp view y-axis range should remain constant at all times"): the 2PP
   chart draws ONE side's line at a time behind its own Share: twin -
   the flows' Share: stays a separate state - the Space key follows the
   visible control, and the axis prices the whole twoPP bank's furthest
   cell from the half ONCE, so neither an elections pick nor the flip
   ever moves it */
assert.ok(ap.includes('const [twoInv, setTwoInv] = useState(false);')
    && ap.includes('const share2pp = (')
    && ap.includes('aria-pressed={twoInv}')
    && ap.includes('{(twoInv ? "Coalition" : "Labor") + "’s"}')
    && ap.includes('const shareSlot = primMode ? null : twoMode ? share2pp : share;')
    && ap.includes('spaceShare.current = () => { if (twoMode) setTwoInv((v) => !v); else if (!figView) setInv((v) => !v); };'),
  "the 2PP Share: twin (button names the drawn side, Space follows it, primary keeps none)");
assert.ok(ap.includes('const active = inv ? TWO_PARTIES[1] : TWO_PARTIES[0];')
    && ap.includes('id: "share", label: active.name, color: active.color,')
    && ap.includes('{(impBank ? "Implied classic two-party preferred, " : "Classic two-party preferred, ") + active.name + "’s share, %"}')
    && ap.includes("the Share: flip's other side always sits at 100 minus the line on the chart"),
  "ONE side's line at a time (the constant series id glides the flip to the mirror); head and caption name the drawn side");
assert.ok(ap.includes('const lo = Math.max(0, Math.floor((50 - dev) / 5) * 5);')
    && ap.includes('dev = Math.max(dev, Math.abs(x - 50))')
    && ap.includes('[TP.fed, ...Object.keys(TP.fed.states || {}).map((k) => TP.fed.states[k]),'),
  "the constant axis: the whole bank's furthest cell from 50, mirrored - never recomputed from the drawn view");
/* 2026-10-24 (user: 'in 2pp view the tick for "50" (the number itself)
   should be bold and the 50 line a little darker than the other grid
   lines'): TrendChart's yTickEmph marks a tick emphatic, the body.rd
   .tick-emph pair in rd.css deepens its rule a rung and bolds its label,
   and the 2PP chart hands its halfway mark over. The pair belongs to
   rd.css, not template.html: rd.css's body.rd-prefixed .grid/.axis-label
   clamps tie-and-beat an un-prefixed template rule into a no-op (probe-
   verified computed styles 2026-10-24) */
const tc = fs.readFileSync(path.join(ROOT, ".build", "newtracker", "assets",
  fs.readdirSync(path.join(ROOT, ".build", "newtracker", "assets")).find((f) => /^08b413e7-.*\.js$/.test(f))), "utf8");
const rdc = fs.readFileSync(path.join(ROOT, ".build", "newtracker", "assets", "rd.css"), "utf8");
assert.ok(ap.includes("yTickEmph={50}"),
  "the 2PP chart hands the halfway mark over as its one emphatic tick");
assert.ok(tc.includes("yTickEmph = null,")
    && tc.includes("const emphSet = yTickEmph == null ? null : new Set([].concat(yTickEmph));")
    && tc.includes('className={"axis-label y" + emph}')
    && tc.includes('className={"grid" + emph}'),
  "TrendChart's yTickEmph lands the tick-emph class on an emphatic tick's rule and label");
assert.ok(rdc.includes("body.rd .grid.tick-emph { stroke: var(--line); stroke-width: 1.3; }")
    && rdc.includes("body.rd .axis-label.tick-emph { font-weight: 700; }"),
  "the tick-emph pair: the rule deepens a rung (--line-2 -> --line) and thickens a third (user 2026-10-24: 'emphasised 30% more'), the label goes bold");
assert.ok(rdc.indexOf("body.rd .grid.tick-emph") > rdc.indexOf("body.rd .grid {")
    && rdc.indexOf("body.rd .axis-label.tick-emph") > rdc.indexOf("body.rd .axis-label.y,"),
  "the tick-emph pair sits AFTER the body.rd clamps it must outrank at equal specificity");
/* 2026-10-23 (user: "y axis max should be 55, biggest recorded primary
   vote + however much to get to the nearest 5"): the primary view
   replaces the shared frame's 0-100 with its own axis, topped at the
   biggest share on the chart rounded up to the next 5 */
assert.ok(ap.includes('const yMax = Math.max(5, Math.ceil(series.reduce((m, s) => s.points.reduce((mm, p) => Math.max(mm, p.y), m), 0) / 5) * 5);')
    && ap.includes('yDomain={[0, yMax]}') && ap.includes('yTicks={YT}'),
  "the primary view's y axis tops at the biggest recorded share rounded up to the next 5 (55 nationally)");
assert.ok(ap.includes('<select className="rd-pv-sel ex-fl-sel" aria-label="Elections"') && ap.includes('const [view, setView] = useState("fed");')
    && ap.includes('<optgroup label="Federal elections">') && ap.includes('<optgroup label="State elections">'),
  "one elections menu: federal national, federal by state, then each state's own elections");
assert.ok(!/ex-chip|ex-flow-chips|ex-flow-flip/.test(ap) && !/ex-chip|ex-flow-/.test(fs.readFileSync(path.join(ROOT, ".build/newtracker/template.html"), "utf8")),
  "the pill chips and the old menu bar are gone, code and CSS");
/* the readout's notes indent to ONE shared column (user report 2026-10-23,
   the phone's NSW state view: "40% exhausted, 87.1% of the rest" started
   after its own row's label, so "One Nation" indented it deeper than
   "Greens" did): the tip renders as one grid table - rows display:contents,
   each cell pinned to its column, so a row without a note never displaces
   its figure from the aligned value column */
assert.ok(cssRd.includes("body.rd .ex-fl-card .tip:not(.tip-cols) { display: grid; grid-template-columns: 9px max-content 1fr auto;")
    && cssRd.includes("body.rd .ex-fl-card .tip:not(.tip-cols) .tip-row { display: contents; }"),
  "the explainer card's tips lay their rows out as one table (the label column no longer decides where a note starts)");
assert.ok(cssRd.includes("body.rd .ex-fl-card .tip:not(.tip-cols) .tip-note { grid-column: 3; }")
    && cssRd.includes("body.rd .ex-fl-card .tip:not(.tip-cols) .tip-val { grid-column: 4;"),
  "every note pinned to the shared third column, every figure to the aligned fourth");
assert.ok(cssRd.includes("body.rd .ex-fl-card .tip:not(.tip-cols) > .tip-title") && cssRd.includes("{ grid-column: 1 / -1; }")
    && cssRd.includes("body.rd .ex-fl-card .tip:not(.tip-cols) > .tip-hint"),
  "the readout's own lines (title, date, description, subtext, hint) span the table's full width");
assert.ok(ap.includes('<span className="rd-pl-ctl-l">Share:</span>') && !ap.includes('>Direction:</span>'),
  "the explainer's Share control names its active side (the Direction label gone)");
assert.ok(ap.includes("tooltipTitle={(i) => BYS[i].label}")
    && ap.includes('tooltipTitle={(i) => YEARS[i] + " · " + (S.short || S.label) + (basisMixed && S.hollowYears.includes(YEARS[i]) ? " · Labor-v-Coalition seats only" : "")}'),
  "short tooltip titles: a contest's source sentence no longer runs a phone readout to full width (b5398ce8's hollow-ring basis note is the one suffix, and only on mixed-basis views)");
assert.ok((ap.match(/\{\.\.\.exFrame\(narrow\)\}/g) || []).length === 4
    && (ap.match(/copy=\{\{ title: "Share of each group’s preferences reaching "/g) || []).length === 2
    && (ap.match(/copy=\{\{ title: "First-preference vote shares by party, " \+/g) || []).length === 1
    && (ap.match(/copy=\{\{ title: active\.name \+ "’s two-party-preferred share, "/g) || []).length === 1,
  "all four views share the px chart frame and carry a copy prop");
assert.ok(ap.includes("((window.AUSPOL.flowForced || {}).bys || []).slice().sort((a, b) => a.xm - b.xm)"),
  "the One Nation chart reads the same flowForced.bys crosses as the /flows/ chart, on their own days");
assert.ok(ap.includes('{"One reading per contest: " + cap') && ap.includes("so no line joins them: Hunter’s Coalition voters are Nationals"),
  "the One Nation chart's caption lists one reading per contest from the crosses' own sub lines, and says why no line joins them");
assert.ok(ap.includes("const marks = [];") && ap.includes("cross: true") && ap.includes("endCap: false,")
    && ap.includes("series={series} marks={marks} areas={areas} spine="),
  "the explainer's One Nation readings draw as the /flows/ ledger's crosses (marks channel), never dots, estimates with their bars");
/* no line joins contests (user 2026-10-21): every reading is its own
   one-point series, so the chart draws no trend across changed definitions */
assert.ok(ap.includes("points: [{ x: b.xm, y: T(v), ...(note ? { note } : null) }],"),
  "each contest reading is its own one-point series: no line between contests");
assert.ok(cssRd.includes(".rd-cross { fill: none; stroke-width: 2; stroke-linecap: round; }")
    && cssRd.includes(".chart-svg .rd-cross,"),
  "the cross mark keeps the ledger's stroke-only look and the chart's non-scaling stroke");
assert.ok(ap.includes('<span className="rd-fx-keyx" aria-hidden="true"></span>Contest counts and estimates</span>'),
  "the /flows/ key names counts AND estimates (SA 2026 is an estimate)");

// ---- the retired satellite is a redirect stub --------------------------------------------
/* preference-flows/index.html retired 2026-10-15 to a hash-preserving
   redirect: the explainer's content lives in the main build's
   /flows-explained/ tab page (build.mjs 5a + explained-article.html). */
const page = fs.readFileSync(path.join(ROOT, "preference-flows", "index.html"), "utf8");
for (const dead of ['id="forced"', '<a href="#forced"', "flow-splits.json", 'id="fsq-', ".fsq ", "--fs-alp",
                    'draw("fsq-', "<!--shell:", "sh-menu"])
  assert.ok(!page.includes(dead), `the stub keeps no trace of: ${dead}`);
assert.ok(page.includes('<meta http-equiv="refresh" content="0; url=/flows-explained/">'),
  "the stub's meta refresh points at /flows-explained/");
assert.ok(page.includes('location.replace("/flows-explained/" + location.hash)'),
  "the script redirect preserves the hash (the old page's section anchors survive as ids)");
assert.ok(page.includes('<link rel="canonical" href="https://auspoltracker.com/flows-explained/">'),
  "the stub cedes the canonical to the new page");
assert.ok(!fs.existsSync(path.join(ROOT, "assets", "flow-splits.json")),
  "the retired flow-splits.json asset is gone");
console.log("test-flow-splits: ok");
