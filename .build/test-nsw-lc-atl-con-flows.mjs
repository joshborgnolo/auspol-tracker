/* test-nsw-lc-atl-con-flows.mjs – pins the explainer's NSW LEGISLATIVE
   COUNCIL Coalition-v-ONE-NATION flow series (FLOW_HISTORY_NSW_LC_CON in
   .build/newtracker/flows.mjs, the Coalition v One Nation tab's one state
   upper house under House: Upper; shipped 2026-10-24, the same Council
   ballots cut the third way — the Coalition is a contest side here, so
   the Labor cohort replaces it in the trio). The derivation, pinned —
   from .build/nswec-lc-flow-src/counts.json's pc blocks (each analysers'
   THIRD tally of the SAME guard-verified ballot set: per family,
   COAL_first / COAL_only / PHON_first / PHON_only / neither; a ballot
   naming only one of the pair files its way):
     share = 100 · (COAL_first + COAL_only) / (the four rank cells)
       — of the cohort family's ATL papers naming the Coalition or One
         Nation, the share ranking the Coalition AHEAD
     named neither = 100 · neither / (the five cells)
   The cohorts are alp / grn / oth (the pair's own families are
   definitional and never drawn — but their shapes are pinned so a family
   mis-mapping can't slide one contest side's ballots into a cohort). The
   null map is the contest's, not the arithmetic's: One Nation ran no LC
   group in 2011 or 2015 (Pauline Hanson's 2011 ticket was her own unnamed
   independent group J, family OTHER), and although the cohorts' one-sided
   papers exist those years, a year with no PHON ticket carries null
   across all three cohorts — a pair nobody could rank is a gap, never a
   number. oneOnly repeats FLOW_HISTORY_NSW_LC's whole-population series —
   the caption quotes it on every tab. The pc blocks' own integrity is
   pinned: each family's five cells exhaust its ATL count (the official-
   figure reconciliation of the run stands behind all three cuts), One
   Nation's PHON bricks are all-zero in 2011/2015, the oneOnly cells
   deep-equal the co cut's (the same SATL ballots measured once), and the
   pc totals deep-equal the pa totals family by family (the third and
   second tallies partition the same ballot set). A table-cell edit
   without a counts edit fails, and a pc-counts edit without a table edit
   fails. Runs after the build in npm test's chain (the data-asset
   assertions only hold post-build) and also pins the emit sitting after
   gen-data's JUR return AND after the JURIS jurisdiction loop that
   rebuilds h.nsw, so the Vic bundle never carries the series and the
   emit can't be clobbered by the loop. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const YEARS = [2011, 2015, 2019, 2023];
const COHORTS = ["alp", "grn", "oth"];
const COHORT_OF = { alp: "ALP", grn: "GRN", oth: "OTHER" };
const PC = ["COAL_first", "COAL_only", "PHON_first", "PHON_only", "neither"];
const PA = ["ALP_first", "ALP_only", "PHON_first", "PHON_only", "neither"];
const FAMILIES = ["ALP", "COAL", "GRN", "PHON", "OTHER"];
const r1 = (n, d) => (d ? Math.round(1000 * n / d) / 10 : null);
const ofPc = (p, atl) => {
  if (!p || !atl) return { share: null, nei: null };
  const rank = p.COAL_first + p.COAL_only + p.PHON_first + p.PHON_only;
  return { share: r1(p.COAL_first + p.COAL_only, rank), nei: r1(p.neither, rank + p.neither) };
};

// ---- the committed pc blocks sit on the guard-verified ballot set ----------
const counts = JSON.parse(fs.readFileSync(path.join(ROOT, ".build", "nswec-lc-flow-src", "counts.json"), "utf8"));
assert.deepEqual(Object.keys(counts.events), YEARS.map(String), "the four NSWEC-covered elections, in order");
const fresh = Object.fromEntries(COHORTS.map((c) => [c, []]));
const freshNei = Object.fromEntries(COHORTS.map((c) => [c, []]));
const freshOneOnly = [];
YEARS.forEach((y) => {
  const ev = counts.events[y];
  assert.ok(ev.pc, `${y}: the pc blocks are committed`);
  FAMILIES.forEach((f) => {
    assert.deepEqual(Object.keys(ev.pc[f]).sort(), [...PC].sort(), `${y} ${f}: the five pc cells`);
    assert.strictEqual(PC.reduce((t, k) => t + ev.pc[f][k], 0), ev.atlByFamily[f],
      `${y} ${f}: the five pc cells exhaust the family's ATL ballots`);
    /* the third and second tallies partition the SAME ballot set */
    assert.strictEqual(PC.reduce((t, k) => t + ev.pc[f][k], 0), PA.reduce((t, k) => t + ev.pa[f][k], 0),
      `${y} ${f}: the pc and pa tallies cover the same ATL ballots`);
  });
  /* the pair's own families by definition: a Coalition paper never ranks
     One Nation ahead of its own family (a PHON paper never ranks the
     Coalition ahead of its own) — pin the shape so a mis-mapped family
     can't slide one side's ballots into a cohort's column */
  assert.ok(ev.pc.COAL.COAL_only > 0 && ev.pc.COAL.PHON_first === 0 && ev.pc.COAL.PHON_only === 0 && ev.pc.COAL.neither === 0,
    `${y} COAL: every paper ranks the Coalition, none names One Nation`);
  if (ev.atlByFamily.PHON > 0) {
    assert.ok(ev.pc.PHON.PHON_only > 0 && ev.pc.PHON.COAL_first === 0 && ev.pc.PHON.COAL_only === 0 && ev.pc.PHON.neither === 0,
      `${y} PHON: every paper ranks One Nation, none names the Coalition`);
  }
  /* the same one-box SATL ballots tallied once stand behind all three
     cuts: oneOnly is the co cut's own per-family record, re-read here */
  FAMILIES.forEach((f) => {
    assert.ok(Number.isInteger(ev.oneOnly[f]) && ev.oneOnly[f] <= ev.atlByFamily[f],
      `${y} ${f}: the family's single-'1' ballots fit inside its ATL count`);
  });
  COHORTS.forEach((c) => {
    /* a year One Nation fielded no group is a contest GAP, never a number:
       the cohorts' one-sided papers (COAL-only and friends) exist, but
       with no PHON ticket in the count "the share ranking the Coalition
       ahead of One Nation" names a pair nobody could rank */
    const got = ev.atlByFamily.PHON > 0
      ? ofPc(ev.pc[COHORT_OF[c]], ev.atlByFamily[COHORT_OF[c]])
      : { share: null, nei: null };
    fresh[c].push(got.share);
    freshNei[c].push(got.nei);
  });
  freshOneOnly.push(r1(ev.atlOneOnly, ev.atl));
});

/* One Nation ran no LC group in 2011 or 2015: every cohort's pair cells
   sit all-zero those years (a pair nobody could rank is a gap, never a
   zero) and derive to null; from 2019 all three cohorts count */
["2011", "2015"].forEach((y) => {
  assert.strictEqual(counts.events[y].atlByFamily.PHON, 0, `${y}: One Nation fielded no LC group`);
  COHORTS.forEach((c) => {
    const p = counts.events[y].pc[COHORT_OF[c]];
    assert.ok(p.PHON_first + p.PHON_only === 0, `${y} ${c}: no One Nation cell filled a ballot`);
  });
});
COHORTS.forEach((c) => {
  assert.strictEqual(fresh[c][0], null, `2011 ${c}: contest gap derives to null`);
  assert.strictEqual(fresh[c][1], null, `2015 ${c}: contest gap derives to null`);
  assert.ok(fresh[c][2] != null && fresh[c][3] != null, `${c}: the contest counted from 2019`);
});

// ---- the display table in flows.mjs recomputes exactly ---------------------
const flowsSrc = fs.readFileSync(path.join(ROOT, ".build", "newtracker", "flows.mjs"), "utf8");
const grab = (name) => {
  const m = flowsSrc.match(new RegExp("export const " + name + " = (?:Object\\.freeze\\()?(\\{[\\s\\S]*?\\})\\)?;"));
  assert.ok(m, `${name} literal found in flows.mjs`);
  return vm.runInNewContext("(" + m[1] + ")");
};
const CON = grab("FLOW_HISTORY_NSW_LC_CON");
assert.deepEqual([...CON.years], YEARS, "the four elections the NSWEC ballot files cover");
const LC = grab("FLOW_HISTORY_NSW_LC");
const expectCell = (got, want, where) => {
  assert.strictEqual(got, want, `${where}: table cell ${got} vs counts ${want}`);
  if (want != null) assert.ok(want >= 0 && want <= 100, `${where}: a share (${want})`);
};
YEARS.forEach((y, yi) => {
  COHORTS.forEach((c) => {
    expectCell(CON[c][yi], fresh[c][yi], `${y} ${c}`);
    expectCell(CON[c + "Nei"][yi], freshNei[c][yi], `${y} ${c} nei`);
  });
  expectCell(CON.oneOnly[yi], freshOneOnly[yi], `${y} one-only`);
  assert.strictEqual(CON.oneOnly[yi], LC.oneOnly[yi], `${y}: oneOnly matches the co cut's series`);
});

// ---- what the chart is handed (post-build) ---------------------------------
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(
  path.join(ROOT, ".build", "newtracker", "assets", "9f09dca2-bd46-49a8-8ae1-51847608cf92.js"), "utf8"),
sandbox, { filename: "9f09dca2.js" });
const FH = sandbox.window.AUSPOL.flowHistory;
assert.ok(FH.nsw, "the NSW Assembly bank still emits");
assert.ok(FH.nsw.senCon, "flowHistory.nsw.senCon in the built data asset");
assert.ok(FH.nsw.sen, "the co cut still emits beside it");
assert.ok(FH.nsw.senOn, "the on cut still emits beside it");
assert.strictEqual(FH.nsw.senCon.label, "NSW Legislative Council", "the LC CON bank names itself");
assert.strictEqual(FH.nsw.senCon.short, "NSW LC", "the LC CON bank's short reaches the asset");
assert.ok(FH.nsw.senCon.lc && FH.nsw.senCon.senateCon, "the Upper-view CON flags ride the bank");
assert.deepEqual([...FH.nsw.senCon.years], YEARS, "nsw.senCon years");
YEARS.forEach((_, yi) => {
  COHORTS.forEach((c) => {
    assert.strictEqual(FH.nsw.senCon[c][yi], CON[c][yi], `nsw.senCon ${c} reaches the asset`);
    assert.strictEqual(FH.nsw.senCon[c + "Nei"][yi], CON[c + "Nei"][yi], `nsw.senCon ${c} nei reaches the asset`);
  });
  assert.strictEqual(FH.nsw.senCon.oneOnly[yi], CON.oneOnly[yi], "nsw.senCon oneOnly reaches the asset");
});
assert.ok(FH.fed.senCon, "the Senate CON bank emits beside it");
assert.ok(!Object.keys(FH).includes("nswlc"), "the LC banks nest under nsw, never a chip key");
["vic", "qld", "wa", "sa", "tas", "act", "nt"].forEach((k) => {
  assert.ok(!FH[k] || !FH[k].senCon, `${k}: no other state carries an upper-house CON bank`);
});

/* the series is federal-page-only: its attach must sit AFTER gen-data's
   `if (JUR) return h;` in the flowHistory block, so the Vic bundle (JUR=vic)
   never carries it, AND after the JURIS jurisdiction loop that rebuilds
   h.nsw from the estimate CSV, or the attach is clobbered — all three cuts
   share one attach line so they always ride together (the explainer's
   lcView gates on the co bank; its ON and CON siblings must exist whenever
   nswlc stays selected across a contest flip). */
const genSrc = fs.readFileSync(path.join(ROOT, ".build", "newtracker", "gen-data.mjs"), "utf8");
const jurAt = genSrc.indexOf("if (JUR) return h;");
const jurisAt = genSrc.indexOf("Object.entries(JURIS)");
const nswSenConAt = genSrc.indexOf("h.nsw.senCon = NSW_SEN_CON;");
const nswSenAt = genSrc.indexOf("h.nsw.sen = NSW_SEN;");
assert.ok(jurAt > 0, "the flowHistory JUR return is present");
assert.ok(jurisAt > jurAt, "the JURIS loop follows the JUR return");
assert.ok(nswSenConAt > jurAt, "h.nsw.senCon attaches after the JUR return (Vic bundle stays LC-free)");
assert.ok(nswSenConAt > jurisAt, "h.nsw.senCon attaches after the JURIS loop (the h.nsw rebuild can't clobber it)");
assert.ok(nswSenAt > 0 && nswSenAt > nswSenConAt / 2, "the co attach is present too");
assert.ok(genSrc.match(/\{ h\.nsw\.sen = NSW_SEN; h\.nsw\.senOn = NSW_SEN_ON; h\.nsw\.senCon = NSW_SEN_CON; \}/),
  "the three cuts attach in the one slot (no bank ever ships alone)");

console.log("test-nsw-lc-atl-con-flows: all assertions passed");
