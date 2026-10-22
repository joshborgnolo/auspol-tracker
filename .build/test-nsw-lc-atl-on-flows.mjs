/* test-nsw-lc-atl-on-flows.mjs – pins the explainer's NSW LEGISLATIVE
   COUNCIL Labor-v-ONE-NATION flow series (FLOW_HISTORY_NSW_LC_ON in
   .build/newtracker/flows.mjs, the One Nation tab's one state upper house
   under House: Upper; shipped 2026-10-23 on the user's "explain why there
   is no labor-versus-one-nation data for any of the upper house states"
   request — NSW's is the only state upper house whose flows can be counted
   at all, so the cut was built and the chart caption carries the why:
   Victoria's Council voted by party tickets until 2022 (abolished for
   2026), Western Australia's tickets ended at the 2021 reform and its
   first ticket-free count printed no per-ballot record, and South
   Australia's and Tasmania's commissions publish none).
   The derivation, pinned — from .build/nswec-lc-flow-src/counts.json's pa
   blocks (each analysers' second tally of the SAME guard-verified ballot
   set: per family, ALP_first / ALP_only / PHON_first / PHON_only /
   neither; a ballot naming only one of the pair files its way):
     share = 100 · (ALP_first + ALP_only) / (the four rank cells)
       — of the cohort family's ATL papers naming Labor or One Nation, the
         share ranking Labor AHEAD
     named neither = 100 · neither / (the five cells)
   The cohorts are coal / grn / oth (the pair's own families are
   definitional and never drawn — but their shapes are pinned so a family
   mis-mapping can't slide one contest side's ballots into a cohort). The
   null map is the contest's, not the arithmetic's: One Nation ran no LC
   group in 2011 or 2015 (Pauline Hanson's 2011 ticket was her own unnamed
   independent group J, family OTHER), and although the cohorts' one-sided
   ALP-only papers exist those years, a year with no PHON ticket carries
   null across all three cohorts — a pair nobody could rank is a gap,
   never a number. oneOnly repeats FLOW_HISTORY_NSW_LC's whole-population series —
   the caption quotes it on this tab too. The pa blocks' own integrity is
   pinned: each family's five cells exhaust its ATL count (the official-
   figure reconciliation of the run stands behind both cuts), One Nation's
   PHON bricks are all-zero in 2011/2015, and the oneOnly cells deep-equal
   the co cut's (the same SATL ballots measured once). A table-cell edit
   without a counts edit fails, and a pa-counts edit without a table edit
   fails. Runs after the build in npm test's chain (the data-asset
   assertions only hold post-build) and also pins the emit sitting after
   gen-data's JUR return AND after the JURIS jurisdiction loop that
   rebuilds h.nsw, so the Vic bundle never carries the series and the emit
   can't be clobbered by the loop. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const YEARS = [2011, 2015, 2019, 2023];
const COHORTS = ["coal", "grn", "oth"];
const COHORT_OF = { coal: "COAL", grn: "GRN", oth: "OTHER" };
const PA = ["ALP_first", "ALP_only", "PHON_first", "PHON_only", "neither"];
const FAMILIES = ["ALP", "COAL", "GRN", "PHON", "OTHER"];
const r1 = (n, d) => (d ? Math.round(1000 * n / d) / 10 : null);
const ofPa = (p, atl) => {
  if (!p || !atl) return { share: null, nei: null };
  const rank = p.ALP_first + p.ALP_only + p.PHON_first + p.PHON_only;
  return { share: r1(p.ALP_first + p.ALP_only, rank), nei: r1(p.neither, rank + p.neither) };
};

// ---- the committed pa blocks sit on the guard-verified ballot set ----------
const counts = JSON.parse(fs.readFileSync(path.join(ROOT, ".build", "nswec-lc-flow-src", "counts.json"), "utf8"));
assert.deepEqual(Object.keys(counts.events), YEARS.map(String), "the four NSWEC-covered elections, in order");
const fresh = Object.fromEntries(COHORTS.map((c) => [c, []]));
const freshNei = Object.fromEntries(COHORTS.map((c) => [c, []]));
const freshOneOnly = [];
YEARS.forEach((y) => {
  const ev = counts.events[y];
  assert.ok(ev.pa, `${y}: the pa blocks are committed`);
  FAMILIES.forEach((f) => {
    assert.deepEqual(Object.keys(ev.pa[f]).sort(), [...PA].sort(), `${y} ${f}: the five pa cells`);
    assert.strictEqual(PA.reduce((t, k) => t + ev.pa[f][k], 0), ev.atlByFamily[f],
      `${y} ${f}: the five pa cells exhaust the family's ATL ballots`);
  });
  /* the pair's own families by definition: an ALP paper never ranks One
     Nation (a PHON paper never ranks Labor) ahead of its own family — pin
     the shape so a mis-mapped family can't slide one side's ballots into
     a cohort's column */
  assert.ok(ev.pa.ALP.ALP_only > 0 && ev.pa.ALP.PHON_first === 0 && ev.pa.ALP.PHON_only === 0 && ev.pa.ALP.neither === 0,
    `${y} ALP: every paper ranks Labor, none names One Nation`);
  if (ev.atlByFamily.PHON > 0) {
    assert.ok(ev.pa.PHON.PHON_only > 0 && ev.pa.PHON.ALP_first === 0 && ev.pa.PHON.ALP_only === 0 && ev.pa.PHON.neither === 0,
      `${y} PHON: every paper ranks One Nation, none names Labor`);
  }
  /* the same one-box SATL ballots tallied once stand behind both cuts:
     oneOnly is the co cut's own per-family record, re-read here */
  FAMILIES.forEach((f) => {
    assert.ok(Number.isInteger(ev.oneOnly[f]) && ev.oneOnly[f] <= ev.atlByFamily[f],
      `${y} ${f}: the family's single-'1' ballots fit inside its ATL count`);
  });
  COHORTS.forEach((c) => {
    /* a year One Nation fielded no group is a contest GAP, never a number:
       the cohorts' one-sided papers (ALP-only and friends) exist, but with
       no PHON ticket in the count "the share ranking Labor ahead of One
       Nation" names a pair nobody could rank */
    const got = ev.atlByFamily.PHON > 0
      ? ofPa(ev.pa[COHORT_OF[c]], ev.atlByFamily[COHORT_OF[c]])
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
    const p = counts.events[y].pa[COHORT_OF[c]];
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
const ON = grab("FLOW_HISTORY_NSW_LC_ON");
assert.deepEqual([...ON.years], YEARS, "the four elections the NSWEC ballot files cover");
const LC = grab("FLOW_HISTORY_NSW_LC");
const expectCell = (got, want, where) => {
  assert.strictEqual(got, want, `${where}: table cell ${got} vs counts ${want}`);
  if (want != null) assert.ok(want >= 0 && want <= 100, `${where}: a share (${want})`);
};
YEARS.forEach((y, yi) => {
  COHORTS.forEach((c) => {
    expectCell(ON[c][yi], fresh[c][yi], `${y} ${c}`);
    expectCell(ON[c + "Nei"][yi], freshNei[c][yi], `${y} ${c} nei`);
  });
  expectCell(ON.oneOnly[yi], freshOneOnly[yi], `${y} one-only`);
  assert.strictEqual(ON.oneOnly[yi], LC.oneOnly[yi], `${y}: oneOnly matches the co cut's series`);
});

// ---- what the chart is handed (post-build) ---------------------------------
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(
  path.join(ROOT, ".build", "newtracker", "assets", "9f09dca2-bd46-49a8-8ae1-51847608cf92.js"), "utf8"),
sandbox, { filename: "9f09dca2.js" });
const FH = sandbox.window.AUSPOL.flowHistory;
assert.ok(FH.nsw, "the NSW Assembly bank still emits");
assert.ok(FH.nsw.senOn, "flowHistory.nsw.senOn in the built data asset");
assert.ok(FH.nsw.sen, "the co cut still emits beside it");
assert.strictEqual(FH.nsw.senOn.label, "NSW Legislative Council", "the LC ON bank names itself");
assert.strictEqual(FH.nsw.senOn.short, "NSW LC", "the LC ON bank's short reaches the asset");
assert.ok(FH.nsw.senOn.lc && FH.nsw.senOn.senateOn, "the Upper-view ON flags ride the bank");
assert.deepEqual([...FH.nsw.senOn.years], YEARS, "nsw.senOn years");
YEARS.forEach((_, yi) => {
  COHORTS.forEach((c) => {
    assert.strictEqual(FH.nsw.senOn[c][yi], ON[c][yi], `nsw.senOn ${c} reaches the asset`);
    assert.strictEqual(FH.nsw.senOn[c + "Nei"][yi], ON[c + "Nei"][yi], `nsw.senOn ${c} nei reaches the asset`);
  });
  assert.strictEqual(FH.nsw.senOn.oneOnly[yi], ON.oneOnly[yi], "nsw.senOn oneOnly reaches the asset");
});
assert.ok(FH.fed.senOn, "the Senate ON bank still emits beside it");
assert.ok(!Object.keys(FH).includes("nswlc"), "the LC banks nest under nsw, never a chip key");
["vic", "qld", "wa", "sa", "tas", "act", "nt"].forEach((k) => {
  assert.ok(!FH[k] || !FH[k].senOn, `${k}: no other state carries an upper-house ON bank`);
});

/* the series is federal-page-only: its attach must sit AFTER gen-data's
   `if (JUR) return h;` in the flowHistory block, so the Vic bundle (JUR=vic)
   never carries it, AND after the JURIS jurisdiction loop that rebuilds
   h.nsw from the estimate CSV, or the attach is clobbered — the two emits
   share one attach line so they always ride together (the explainer's
   lcView gates on the co bank; its ON sibling must exist whenever nswlc
   stays selected across a contest flip). */
const genSrc = fs.readFileSync(path.join(ROOT, ".build", "newtracker", "gen-data.mjs"), "utf8");
const jurAt = genSrc.indexOf("if (JUR) return h;");
const jurisAt = genSrc.indexOf("Object.entries(JURIS)");
const nswSenOnAt = genSrc.indexOf("h.nsw.senOn = NSW_SEN_ON;");
const nswSenAt = genSrc.indexOf("h.nsw.sen = NSW_SEN;");
assert.ok(jurAt > 0, "the flowHistory JUR return is present");
assert.ok(jurisAt > jurAt, "the JURIS loop follows the JUR return");
assert.ok(nswSenOnAt > jurAt, "h.nsw.senOn attaches after the JUR return (Vic bundle stays LC-free)");
assert.ok(nswSenOnAt > jurisAt, "h.nsw.senOn attaches after the JURIS loop (the h.nsw rebuild can't clobber it)");
assert.ok(nswSenAt > 0 && nswSenAt > nswSenOnAt / 2, "the co attach is present too");
assert.ok(genSrc.match(/\{ h\.nsw\.sen = NSW_SEN; h\.nsw\.senOn = NSW_SEN_ON; \}/),
  "the two cuts attach in the one slot (neither bank ever ships alone)");

console.log("test-nsw-lc-atl-on-flows: all assertions passed");
