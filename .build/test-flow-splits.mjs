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
assert.ok(ap.includes('{senOnView ? <ExplainedFlowChart jur="fed" house="sen" stateKey={stateKey && hasOnCells(stateKey) ? stateKey : null} classKey={null} lc={false} inv={inv} menu={headCtls} onSen />')
    && ap.includes(': pair === "on" ? <ExplainedOnChart inv={inv} menu={headCtls} />')
    && ap.includes(': <ExplainedFlowChart jur={jur} house={house} stateKey={stateKey} classKey={house === "sen" ? null : classKey} lc={lcView} inv={inv} menu={headCtls} />}'),
  "three-way render: the ON tab's Upper view draws the senOn bank, its Lower the crosses, the Coalition contest the history chart (a class pick nulls while the Senate bank is drawn)");
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
    && ap.includes('const [house, setHouse] = useState("rep");')
    && ap.includes('{house === "sen" ? "Upper" : "Lower"}')
    && ap.includes('title={house === "sen" ? "Switch to House of Representatives flows"'),
  "the House: flip rides the Share idiom - the button the active chamber, its title the destination, only where the build ships the bank");
assert.ok(!ap.includes('if (pair === "on") setPair("co");')
    && ap.includes('else if (classKey || !fedView || (pair === "on" && stateKey && !hasOnCells(stateKey))) setView("fed");'),
  "flipping houses never snaps the contest back (the ON bank rides along) - only a pick the ON bank can't carry (a class view, a non-fed state pick, a no-ON-ticket state) drops to federal; Lower never snaps");
assert.ok(ap.includes('const senOnStateKeys = Object.keys(ON_SEN_STATES).filter(hasOnCells);')
    && ap.includes('{menuKeys.map((k) => <option key={k} value={"fed:" + k}>')
    && ap.includes('house === "sen" && !senOnView && LC_BANK && (')
    && ap.includes('{house !== "sen" && classKeys.map(') && ap.includes('{house !== "sen" && KEYS.length > 1 && ('),
  "the elections menu re-reads the states from the operative bank under Upper (senOn's on the ON tab - never-on-ballot ACT out, the Coalition-only Council out) and sheds the House-only sections");
assert.ok(ap.includes('const FED_CLASSES = (FH.fed && FH.fed.classes) || {};')
    && ap.includes('const classKey = view.startsWith("fedcl:") && FED_CLASSES[view.slice(6)] ? view.slice(6) : null;')
    && ap.includes('"fedcl:" + k'),
  "the fedcl:<class> view ids resolve FH.fed.classes beside fed.states (FED_CLASSES, classKey, the menu's fedcl options)");
assert.ok(ap.includes('<div className="card rd-card ex-fl-card" ref={cardMark} data-rd-swipe-exact="">') && ap.includes('<RdTabs value={pair} onChange={onPairPick} ariaLabel="Contest" className="ex-fl-tabs"'),
  "the figure is a chart card opening on contest tabs, as /flows/ does (the card ref + data-rd-swipe-exact wire its 2026-10-21 key/swipe claims)");
assert.ok(ap.includes("if (p === \"on\" && house === \"sen\" && (lcView || (stateKey && !hasOnCells(stateKey)))) setView(\"fed\");"),
  "picking Labor v One Nation sheds the picks its bank never carries (the LC count, a state One Nation ran no Senate tickets in)");
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
assert.ok((ap.match(/\{\.\.\.exFrame\(narrow\)\}/g) || []).length === 2 && (ap.match(/copy=\{\{ title: "Share of each group’s preferences reaching "/g) || []).length === 2,
  "both views share the px chart frame and carry a copy prop");
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
