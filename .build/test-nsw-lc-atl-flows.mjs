/* test-nsw-lc-atl-flows.mjs – pins the explainer's NSW LEGISLATIVE COUNCIL
   flow series (FLOW_HISTORY_NSW_LC in .build/newtracker/flows.mjs, the
   explainer chart's Upper view's one state upper house; user 2026-10-22,
   extended back to 2011 on the user's 2026-10-23 request). The NSW
   Electoral Commission publishes no Legislative Council flow table (a state
   upper house has no 2PP), so the committed
   .build/nswec-lc-flow-src/counts.json holds the ATL ballot counts the
   table was computed from (share = toALP of the family's ATL ballots naming
   a major; "named neither major" = neither of the family's ATL papers; the
   "1 only" caption figures = atlOneOnly of atl), and this test re-derives
   EVERY cell from it: a table-cell edit without a counts edit fails, and a
   counts edit without a table edit fails. The analyst's reconciliation is
   pinned too: the formal totals equal the official figures (4,076,024 /
   4,316,498 / 4,451,146 / 4,616,858) and every group's pref-1 ATL count
   equals the official figure for its year (17/24/20/21 groups); 2011
   additionally re-pins every group's SATL and RATL ballot counts against
   the BP 3/2011 "Ticket Votes" table (committed in
   nswec-lc-flow-src/published/), the only year the official per-type
   split is a printed table rather than a csv. The One
   Nation nulls are pinned (no LC group in 2011 or 2015 — a zero-ballot
   family is null, never zero; Pauline Hanson's 2011 independent group J
   is OTHER, not One Nation). Runs after the build in npm test's chain (the
   data-asset assertions only hold post-build) and also pins the emit
   sitting after gen-data's JUR return AND after the JURIS jurisdiction
   loop that rebuilds h.nsw, so the Vic bundle never carries the series and
   the emit can't be clobbered by the loop. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const YEARS = [2011, 2015, 2019, 2023];
const GROUPS_PER_YEAR = { 2011: 17, 2015: 24, 2019: 20, 2023: 21 };
const OFFICIAL_FORMAL = { 2011: 4076024, 2015: 4316498, 2019: 4451146, 2023: 4616858 };
const BUCKETS = ["grn", "onp", "oth"];
const FAMILY = { grn: "GRN", onp: "PHON", oth: "OTHER" };
const FAMILIES = ["ALP", "COAL", "GRN", "PHON", "OTHER"];
const r1 = (n, d) => (d ? Math.round(1000 * n / d) / 10 : null);
const ofCounts = (c, atl) => {
  if (!c || !atl) return { share: null, nei: null };
  return { share: r1(c.toALP, c.toALP + c.toCOAL), nei: r1(c.neither, c.toALP + c.toCOAL + c.neither) };
};

// ---- the committed counts reconcile with the official figures -------------
const counts = JSON.parse(fs.readFileSync(path.join(ROOT, ".build", "nswec-lc-flow-src", "counts.json"), "utf8"));
assert.deepEqual(Object.keys(counts.events), YEARS.map(String), "the four NSWEC-covered elections, in order");
const fresh = Object.fromEntries(BUCKETS.map((b) => [b, []]));
const freshNei = Object.fromEntries(BUCKETS.map((b) => [b, []]));
const freshOneOnly = [];
YEARS.forEach((y) => {
  const ev = counts.events[y];
  assert.strictEqual(ev.formal, OFFICIAL_FORMAL[y], `${y}: the formal total is the official figure`);
  assert.strictEqual(ev.officialFormal, OFFICIAL_FORMAL[y], `${y}: officialFormal carries the same figure`);
  /* per-group pref-1 ATL counts re-pin exactly against the official table
     the analyser hard-fails on (the count's own guard, committed) */
  assert.deepEqual(Object.keys(ev.groupFirst), Object.keys(ev.officialGroupAtl), `${y}: same group letters both sides`);
  assert.strictEqual(Object.keys(ev.groupFirst).length, GROUPS_PER_YEAR[y], `${y}: ${GROUPS_PER_YEAR[y]} groups`);
  Object.keys(ev.groupFirst).forEach((g) => {
    assert.strictEqual(ev.groupFirst[g], ev.officialGroupAtl[g], `${y} group ${g}: pref-1 ATL count equals the official figure`);
  });
  if (y === 2011) {
    /* 2011-only: the counted per-group SATL/RATL ballot splits re-pin
       against BP 3/2011's printed "Ticket Votes" tables (committed) */
    assert.deepEqual(ev.groupSatl, ev.officialGroupSatl, "2011: per-group single-'1' counts equal the printed ticket table");
    assert.deepEqual(ev.groupRatl, ev.officialGroupRatl, "2011: per-group multi-ATL counts equal the printed ticket table");
    assert.ok(ev.atlOneOnly + Object.values(ev.groupRatl).reduce((t, n) => t + n, 0) === ev.atl,
      "2011: the SATL and RATL ballot totals exhaust the ATL total");
  }
  /* internal sums: the five families file every ATL ballot exactly once */
  const famSum = FAMILIES.reduce((t, f) => t + ev.atlByFamily[f], 0);
  assert.strictEqual(famSum, ev.atl, `${y}: the families partition the ATL total`);
  FAMILIES.forEach((f) => {
    const c = ev.counts[f];
    assert.strictEqual(c.toALP + c.toCOAL + c.neither, ev.atlByFamily[f], `${y} ${f}: outcomes exhaust the family's ATL ballots`);
    assert.ok(ev.oneOnly[f] <= ev.atlByFamily[f], `${y} ${f}: single-'1' ballots fit inside the family`);
  });
  assert.strictEqual(FAMILIES.reduce((t, f) => t + ev.oneOnly[f], 0), ev.atlOneOnly, `${y}: family single-'1' counts sum to atlOneOnly`);
  assert.ok(ev.atlOneOnly > 0 && ev.atlOneOnly < ev.atl, `${y}: atlOneOnly is a share of the ATL total`);
  /* the majors' own families are definitional (an ALP first-preference ATL
     ballot's first major is Labor) — pin the shape so a mis-mapped family
     can't slide a major's ballots into a minor's column */
  assert.ok(ev.counts.ALP.toALP > 0 && ev.counts.ALP.toCOAL === 0 && ev.counts.ALP.neither === 0, `${y} ALP: every ballot names Labor`);
  assert.ok(ev.counts.COAL.toCOAL > 0 && ev.counts.COAL.toALP === 0 && ev.counts.COAL.neither === 0, `${y} COAL: every ballot names the Coalition`);
  BUCKETS.forEach((b) => {
    const got = ofCounts(ev.counts[FAMILY[b]], ev.atlByFamily[FAMILY[b]]);
    fresh[b].push(got.share);
    freshNei[b].push(got.nei);
  });
  freshOneOnly.push(r1(ev.atlOneOnly, ev.atl));
});

/* One Nation ran no LC group in 2011 or 2015: its row is empty in both
   (null, never a zero — Pauline Hanson's 2011 ticket was her own unnamed
   independent group, family OTHER), and no other family-year is empty */
assert.strictEqual(counts.events["2011"].atlByFamily.PHON, 0, "2011: One Nation fielded no LC group");
assert.strictEqual(counts.events["2015"].atlByFamily.PHON, 0, "2015: One Nation fielded no LC group");
assert.strictEqual(fresh.onp[0], null, "2011 One Nation derives to null");
assert.strictEqual(fresh.onp[1], null, "2015 One Nation derives to null");
assert.ok(fresh.onp[2] != null && fresh.onp[3] != null, "One Nation counted from 2019");
["grn", "oth"].forEach((b) => assert.ok(fresh[b].every((v) => v != null), `${b}: counted every election`));

// ---- the display table in flows.mjs recomputes exactly ---------------------
const flowsSrc = fs.readFileSync(path.join(ROOT, ".build", "newtracker", "flows.mjs"), "utf8");
const grab = (name) => {
  const m = flowsSrc.match(new RegExp("export const " + name + " = (?:Object\\.freeze\\()?(\\{[\\s\\S]*?\\})\\)?;"));
  assert.ok(m, `${name} literal found in flows.mjs`);
  return vm.runInNewContext("(" + m[1] + ")");
};
const LC = grab("FLOW_HISTORY_NSW_LC");
assert.deepEqual([...LC.years], YEARS, "the four elections the NSWEC ballot files cover");
const expectCell = (got, want, where) => {
  assert.strictEqual(got, want, `${where}: table cell ${got} vs counts ${want}`);
  if (want != null) assert.ok(want >= 0 && want <= 100, `${where}: a share (${want})`);
};
YEARS.forEach((y, yi) => {
  BUCKETS.forEach((b) => {
    expectCell(LC[b][yi], fresh[b][yi], `${y} ${b}`);
    expectCell(LC[b + "Nei"][yi], freshNei[b][yi], `${y} ${b} nei`);
  });
  expectCell(LC.oneOnly[yi], freshOneOnly[yi], `${y} one-only`);
});

// ---- what the chart is handed (post-build) ---------------------------------
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(
  path.join(ROOT, ".build", "newtracker", "assets", "9f09dca2-bd46-49a8-8ae1-51847608cf92.js"), "utf8"),
sandbox, { filename: "9f09dca2.js" });
const FH = sandbox.window.AUSPOL.flowHistory;
assert.ok(FH.nsw, "the NSW Assembly bank still emits");
assert.ok(FH.nsw.sen, "flowHistory.nsw.sen in the built data asset");
assert.notStrictEqual(FH.nsw.label, "NSW Legislative Council", "nsw keeps its Assembly label (the LC rides beside, never replaces)");
assert.strictEqual(FH.nsw.sen.label, "NSW Legislative Council", "the LC bank names itself");
assert.strictEqual(FH.nsw.sen.short, "NSW LC", "the LC bank's short reaches the asset");
assert.ok(FH.nsw.sen.lc && FH.nsw.sen.senate, "the Upper-view flags ride the bank");
assert.deepEqual([...FH.nsw.sen.years], YEARS, "nsw.sen years");
YEARS.forEach((_, yi) => {
  BUCKETS.forEach((b) => {
    assert.strictEqual(FH.nsw.sen[b][yi], LC[b][yi], `nsw.sen ${b} reaches the asset`);
    assert.strictEqual(FH.nsw.sen[b + "Nei"][yi], LC[b + "Nei"][yi], `nsw.sen ${b} nei reaches the asset`);
  });
  assert.strictEqual(FH.nsw.sen.oneOnly[yi], LC.oneOnly[yi], "nsw.sen oneOnly reaches the asset");
});
assert.ok(FH.fed.sen, "the Senate bank still emits beside it");
assert.ok(!Object.keys(FH).includes("nswlc"), "the LC nests under nsw, never a chip key of its own");
["vic", "qld", "wa", "sa", "tas", "act", "nt"].forEach((k) => {
  assert.ok(!FH[k] || !FH[k].sen, `${k}: no other state carries an upper-house bank`);
});

/* the series is federal-page-only: its attach must sit AFTER gen-data's
   `if (JUR) return h;` in the flowHistory block, so the Vic bundle (JUR=vic)
   never carries it — pinned positionally here, pinned built by the vic-output
   diff in the ship checks. It must ALSO sit after the JURIS loop that
   rebuilds h.nsw from the estimate CSV, or the attach is clobbered. */
const genSrc = fs.readFileSync(path.join(ROOT, ".build", "newtracker", "gen-data.mjs"), "utf8");
const jurAt = genSrc.indexOf("if (JUR) return h;");
const jurisAt = genSrc.indexOf("Object.entries(JURIS)");
const nswSenAt = genSrc.indexOf("h.nsw.sen = NSW_SEN;");
assert.ok(jurAt > 0, "the flowHistory JUR return is present");
assert.ok(jurisAt > jurAt, "the JURIS loop follows the JUR return");
assert.ok(nswSenAt > jurAt, "h.nsw.sen attaches after the JUR return (Vic bundle stays LC-free)");
assert.ok(nswSenAt > jurisAt, "h.nsw.sen attaches after the JURIS loop (the h.nsw rebuild can't clobber it)");

console.log("test-nsw-lc-atl-flows: all assertions passed");
