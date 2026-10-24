/* test-senate-atl-con-flows.mjs – pins the explainer's Coalition-v-One-Nation
   UPPER-HOUSE flow series (FLOW_HISTORY_SENATE_CON in
   .build/newtracker/flows.mjs, the explainer's Coalition v One Nation tab
   under House: Upper; user 2026-10-24: the same Senate ballots cut the
   third way — the Coalition is a contest side here, so the Labor cohort
   replaces it). Four Senate elections since group voting tickets went
   (2016/2019/2022/2025), national plus the states One Nation filed a
   Senate ticket in. The figures come from the `pc`/`pcStates` blocks of
   the committed .build/aec-flow-src/senate-atl/counts.json (folded in by
   merge_pc_counts.py from analyse_atl_flows.py's third tally), and this
   test re-derives EVERY cell from them — a table edit without a counts
   edit fails, a counts edit without a table edit fails. The estimand,
   pinned: a cohort family's cell is `100 · (COAL_first + COAL_only) /
   (COAL_first + COAL_only + PHON_first + PHON_only)` — of its ATL papers
   naming either side, the share ranking the Coalition ahead (a paper
   naming only ONE of the pair still counts its way); the nei arrays carry
   `100 · neither / (the five cells)` — "named neither", never
   "exhausted". The null map is the contest's, not the cohort's: a
   state-year One Nation filed no Senate ticket in nulls ALL THREE cohorts
   (the ACT in all four; the NT until 2025) — the Coalition filed ATL
   ballots everywhere, so its side never zeroes — a pair nobody could rank
   is a gap, never a zero. Runs after the build in npm test's chain (the
   data-asset assertions only hold post-build) and also pins the emit
   sitting after gen-data's JUR return, so the Vic bundle never carries
   the series. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const YEARS = [2016, 2019, 2022, 2025];
const STATES = ["nsw", "vic", "qld", "wa", "sa", "tas", "act", "nt"];
const BUCKETS = ["alp", "grn", "oth"];
const FAMILY = { alp: "ALP", grn: "GRN", oth: "OTHER" };
const PC = ["COAL_first", "COAL_only", "PHON_first", "PHON_only", "neither"];
const PA = ["ALP_first", "ALP_only", "PHON_first", "PHON_only", "neither"];
const ALL_FAMILIES = ["ALP", "COAL", "GRN", "PHON", "OTHER"];
const r1 = (n, d) => (d ? Math.round(1000 * n / d) / 10 : null);
const pcSum = (p) => PC.reduce((t, k) => t + p[k], 0);
const paSum = (p) => PA.reduce((t, k) => t + p[k], 0);
const ofPc = (p) => {
  if (!p || pcSum(p) === 0) return { share: null, nei: null };
  return { share: r1(p.COAL_first + p.COAL_only, p.COAL_first + p.COAL_only + p.PHON_first + p.PHON_only),
           nei: r1(p.neither, pcSum(p)) };
};

// ---- recompute every cell from the committed pc counts ---------------------
const counts = JSON.parse(fs.readFileSync(path.join(ROOT, ".build", "aec-flow-src", "senate-atl", "counts.json"), "utf8"));
assert.deepEqual(Object.keys(counts.events), YEARS.map(String), "the four post-GVT Senate elections, in order");
const fresh = { national: null, states: Object.fromEntries(STATES.map((s) => [s, {}])) };
YEARS.forEach((y) => {
  const ev = counts.events[y];
  assert.ok(ev.pc && ev.pcStates, `${y}: the national pc block and every state's`);
  assert.deepEqual(Object.keys(ev.pcStates).sort(), STATES.map((s) => s.toUpperCase()).sort(), `${y}: all eight states and territories`);
  ALL_FAMILIES.forEach((fam) => {
    assert.deepEqual(Object.keys(ev.pc[fam]).sort(), [...PC].sort(), `${y} ${fam}: the five national cells`);
    STATES.forEach((s) => {
      const st = ev.pcStates[s.toUpperCase()][fam];
      assert.ok(st, `${y} ${s} ${fam}: a state pc block`);
      assert.deepEqual(Object.keys(st).sort(), [...PC].sort(), `${y} ${s} ${fam}: the five cells`);
      PC.forEach((k) => {
        const sum = STATES.reduce((t, ss) => t + ev.pcStates[ss.toUpperCase()][fam][k], 0);
        assert.strictEqual(sum, ev.pc[fam][k], `${y} ${fam} ${k}: states re-combine to the national count`);
      });
    });
    /* the third tally and the second tally partition the SAME ballot set:
       each family's five pc cells sum to the same total as its five pa
       cells, nationally and in every state (the analysers assert each
       against the family's ATL count — the committed file records the two
       tallies, so their agreement is the guard here) */
    assert.strictEqual(pcSum(ev.pc[fam]), paSum(ev.pa[fam]), `${y} ${fam}: pc and pa tally the same ballot set (national)`);
    STATES.forEach((s) => {
      assert.strictEqual(pcSum(ev.pcStates[s.toUpperCase()][fam]), paSum(ev.paStates[s.toUpperCase()][fam]),
        `${y} ${s} ${fam}: pc and pa tally the same ballot set`);
    });
  });
  if (!fresh.national) fresh.national = Object.fromEntries(BUCKETS.map((b) => [b, []]));
  BUCKETS.forEach((b) => {
    fresh.national[b].push(ofPc(ev.pc[FAMILY[b]]));
    STATES.forEach((s) => {
      const st = ev.pcStates[s.toUpperCase()];
      /* a state-year with no One Nation ticket nulls the whole row's
         cohorts — the contest itself never stood there */
      (fresh.states[s][b] ||= []).push(pcSum(st.PHON) === 0 ? { share: null, nei: null } : ofPc(st[FAMILY[b]]));
    });
  });
});

// ---- the display table in flows.mjs recomputes exactly ---------------------
const flowsSrc = fs.readFileSync(path.join(ROOT, ".build", "newtracker", "flows.mjs"), "utf8");
const grab = (name) => {
  const m = flowsSrc.match(new RegExp("export const " + name + " = (?:Object\\.freeze\\()?(\\{[\\s\\S]*?\\})\\)?;"));
  assert.ok(m, `${name} literal found in flows.mjs`);
  return vm.runInNewContext("(" + m[1] + ")");
};
const CON = grab("FLOW_HISTORY_SENATE_CON");
assert.deepEqual([...CON.years], YEARS, "the four post-GVT Senate elections");
const expectCell = (got, want, where) => {
  assert.strictEqual(got, want, `${where}: table cell ${got} vs counts ${want}`);
  if (want != null) assert.ok(want >= 0 && want <= 100, `${where}: a share (${want})`);
};
YEARS.forEach((y, yi) => {
  BUCKETS.forEach((b) => {
    expectCell(CON[b][yi], fresh.national[b][yi].share, `national ${y} ${b}`);
    expectCell(CON[b + "Nei"][yi], fresh.national[b][yi].nei, `national ${y} ${b} nei`);
    STATES.forEach((s) => {
      const st = CON.states[s];
      assert.ok(st && st.label && st.short, `${s}: a full label and a short`);
      expectCell(st[b][yi], fresh.states[s][b][yi].share, `${s} ${y} ${b}`);
      expectCell(st[b + "Nei"][yi], fresh.states[s][b][yi].nei, `${s} ${y} ${b} nei`);
    });
  });
});

/* the Labor cohort's national cells must answer to the independently
   verified figures (already asserted by the analyser against its own
   ORACLE_CON): the Labor cohort's Coalition-ahead share and its "named
   neither" share, 2016 → 2025 */
const ALP_ORACLE = { 2016: [62.7, 58.3], 2019: [73.0, 56.0], 2022: [70.0, 56.6], 2025: [73.3, 47.0] };
YEARS.forEach((y, yi) => {
  const [wantShare, wantNei] = ALP_ORACLE[y];
  assert.ok(Math.abs(CON.alp[yi] - wantShare) <= 0.06, `${y} national alp ${CON.alp[yi]} ≈ verified ${wantShare}`);
  assert.ok(Math.abs(CON.alpNei[yi] - wantNei) <= 0.16, `${y} national alp nei ${CON.alpNei[yi]} ≈ verified ${wantNei}`);
});

// ---- the null map (a state-year with no One Nation ticket) -----------------
const nulls = (s, b) => YEARS.filter((_, i) => CON.states[s][b][i] == null);
STATES.forEach((s) => {
  const want = s === "act" ? [...YEARS] : s === "nt" ? [2016, 2019, 2022] : [];
  BUCKETS.forEach((b) => assert.deepEqual(nulls(s, b), want, `${s} ${b}: the One Nation null map`));
  BUCKETS.forEach((b) => assert.ok(CON.states[s][b].every((v) => v == null || v > 0), `${s} ${b}: a pair nobody could rank is null, never zero`));
});
BUCKETS.forEach((b) => assert.ok(CON[b].every((v) => v != null), `national ${b}: counted every election`));

// ---- what the chart is handed (post-build) ---------------------------------
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(
  path.join(ROOT, ".build", "newtracker", "assets", "9f09dca2-bd46-49a8-8ae1-51847608cf92.js"), "utf8"),
sandbox, { filename: "9f09dca2.js" });
const FH = sandbox.window.AUSPOL.flowHistory;
assert.ok(FH.fed.senCon, "flowHistory.fed.senCon in the built data asset");
assert.ok(FH.fed.senCon.senateCon, "the senCon marker reaches the asset");
assert.deepEqual([...FH.fed.senCon.years], YEARS, "fed.senCon years");
YEARS.forEach((_, yi) => {
  BUCKETS.forEach((b) => {
    assert.equal(FH.fed.senCon[b][yi], CON[b][yi], `senCon national ${b} reaches the asset`);
    assert.equal(FH.fed.senCon[b + "Nei"][yi], CON[b + "Nei"][yi], `senCon national ${b} nei reaches the asset`);
  });
});
assert.ok(FH.fed.senCon.states, "flowHistory.fed.senCon.states in the built data asset");
assert.deepEqual(Object.keys(FH.fed.senCon.states), STATES, "senCon.states carries the eight (the menu drops the all-null ACT, the bank needs it)");
STATES.forEach((s) => {
  const got = FH.fed.senCon.states[s];
  assert.ok(got.label && got.short, `${s}: a label and short reach the asset`);
  assert.ok(got.senStateCon, `${s}: the senStateCon marker reaches the asset`);
  assert.deepEqual([...got.years], YEARS, `${s}: years`);
  BUCKETS.forEach((b) => {
    assert.deepEqual([...got[b]], [...CON.states[s][b]], `${s} ${b} reaches the asset`);
    assert.deepEqual([...got[b + "Nei"]], [...CON.states[s][b + "Nei"]], `${s} ${b} nei reaches the asset`);
  });
});

/* the series is federal-only: its emit must sit AFTER gen-data's
   `if (JUR) return h;` in the flowHistory block, so the Vic bundle (JUR=vic)
   never carries it — pinned positionally here, pinned built by the vic-output
   grep in the ship checks */
const genSrc = fs.readFileSync(path.join(ROOT, ".build", "newtracker", "gen-data.mjs"), "utf8");
const jurAt = genSrc.indexOf("if (JUR) return h;");
const senConAt = genSrc.indexOf("h.fed.senCon");
assert.ok(jurAt > 0, "the flowHistory JUR return is present");
assert.ok(senConAt > jurAt, "h.fed.senCon emits after the JUR return (Vic bundle stays Senate-free)");

console.log("test-senate-atl-con-flows: all assertions passed");
