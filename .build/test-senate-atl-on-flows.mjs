/* test-senate-atl-on-flows.mjs – pins the explainer's Labor-v-One-Nation
   UPPER-HOUSE flow series (FLOW_HISTORY_SENATE_ON in
   .build/newtracker/flows.mjs, the explainer's One Nation tab under House:
   Upper; user 2026-10-22: the same Senate ballots cut the other way). Four
   Senate elections since group voting tickets went (2016/2019/2022/2025),
   national plus the states One Nation filed a Senate ticket in. The figures
   come from the `pa`/`paStates` blocks of the committed
   .build/aec-flow-src/senate-atl/counts.json (folded in by
   merge_pa_counts.py from analyse_atl_flows.py's second tally), and this
   test re-derives EVERY cell from them — a table edit without a counts edit
   fails, a counts edit without a table edit fails. The estimand, pinned:
   a cohort family's cell is `100 · (ALP_first + ALP_only) / (ALP_first +
   ALP_only + PHON_first + PHON_only)` — of its ATL papers naming either
   party, the share ranking Labor ahead (a paper naming only ONE of the
   pair still counts its way); the nei arrays carry `100 · neither / (the
   five cells)` — "named neither", never "exhausted". The null map is
   the contest's, not the cohort's: a state-year One Nation filed no Senate
   ticket in nulls ALL THREE cohorts (the ACT in all four; the NT until
   2025) — a pair nobody could rank is a gap, never a zero. Runs after the
   build in npm test's chain (the data-asset assertions only hold post-build)
   and also pins the emit sitting after gen-data's JUR return, so the Vic
   bundle never carries the series. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const YEARS = [2016, 2019, 2022, 2025];
const STATES = ["nsw", "vic", "qld", "wa", "sa", "tas", "act", "nt"];
const BUCKETS = ["coal", "grn", "oth"];
const FAMILY = { coal: "COAL", grn: "GRN", oth: "OTHER" };
const PA = ["ALP_first", "ALP_only", "PHON_first", "PHON_only", "neither"];
const ALL_FAMILIES = ["ALP", "COAL", "GRN", "PHON", "OTHER"];
const r1 = (n, d) => (d ? Math.round(1000 * n / d) / 10 : null);
const paSum = (p) => PA.reduce((t, k) => t + p[k], 0);
const ofPa = (p) => {
  if (!p || paSum(p) === 0) return { share: null, nei: null };
  return { share: r1(p.ALP_first + p.ALP_only, p.ALP_first + p.ALP_only + p.PHON_first + p.PHON_only),
           nei: r1(p.neither, paSum(p)) };
};

// ---- recompute every cell from the committed pa counts ---------------------
const counts = JSON.parse(fs.readFileSync(path.join(ROOT, ".build", "aec-flow-src", "senate-atl", "counts.json"), "utf8"));
assert.deepEqual(Object.keys(counts.events), YEARS.map(String), "the four post-GVT Senate elections, in order");
const fresh = { national: null, states: Object.fromEntries(STATES.map((s) => [s, {}])) };
YEARS.forEach((y) => {
  const ev = counts.events[y];
  assert.ok(ev.pa && ev.paStates, `${y}: the national pa block and every state's`);
  assert.deepEqual(Object.keys(ev.paStates).sort(), STATES.map((s) => s.toUpperCase()).sort(), `${y}: all eight states and territories`);
  ALL_FAMILIES.forEach((fam) => {
    assert.deepEqual(Object.keys(ev.pa[fam]).sort(), [...PA].sort(), `${y} ${fam}: the five national cells`);
    STATES.forEach((s) => {
      const st = ev.paStates[s.toUpperCase()][fam];
      assert.ok(st, `${y} ${s} ${fam}: a state pa block`);
      assert.deepEqual(Object.keys(st).sort(), [...PA].sort(), `${y} ${s} ${fam}: the five cells`);
      PA.forEach((k) => {
        const sum = STATES.reduce((t, ss) => t + ev.paStates[ss.toUpperCase()][fam][k], 0);
        assert.strictEqual(sum, ev.pa[fam][k], `${y} ${fam} ${k}: states re-combine to the national count`);
      });
    });
  });
  if (!fresh.national) fresh.national = Object.fromEntries(BUCKETS.map((b) => [b, []]));
  BUCKETS.forEach((b) => {
    fresh.national[b].push(ofPa(ev.pa[FAMILY[b]]));
    STATES.forEach((s) => {
      const st = ev.paStates[s.toUpperCase()];
      /* a state-year with no One Nation ticket nulls the whole row's
         cohorts — the contest itself never stood there */
      (fresh.states[s][b] ||= []).push(paSum(st.PHON) === 0 ? { share: null, nei: null } : ofPa(st[FAMILY[b]]));
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
const ON = grab("FLOW_HISTORY_SENATE_ON");
assert.deepEqual([...ON.years], YEARS, "the four post-GVT Senate elections");
const expectCell = (got, want, where) => {
  assert.strictEqual(got, want, `${where}: table cell ${got} vs counts ${want}`);
  if (want != null) assert.ok(want >= 0 && want <= 100, `${where}: a share (${want})`);
};
YEARS.forEach((y, yi) => {
  BUCKETS.forEach((b) => {
    expectCell(ON[b][yi], fresh.national[b][yi].share, `national ${y} ${b}`);
    expectCell(ON[b + "Nei"][yi], fresh.national[b][yi].nei, `national ${y} ${b} nei`);
    STATES.forEach((s) => {
      const st = ON.states[s];
      assert.ok(st && st.label && st.short, `${s}: a full label and a short`);
      expectCell(st[b][yi], fresh.states[s][b][yi].share, `${s} ${y} ${b}`);
      expectCell(st[b + "Nei"][yi], fresh.states[s][b][yi].nei, `${s} ${y} ${b} nei`);
    });
  });
});

/* the Coalition pair's national cells must answer to the independently
   verified figures (the skill's numbers, already asserted by the analyser
   against its own ORACLE_ON): the Coalition cohort's Labor-ahead share and
   its "named neither" share, 2016 → 2025 */
const COAL_ORACLE = { 2016: [61.2, 61.1], 2019: [47.6, 53.5], 2022: [42.5, 38.4], 2025: [25.3, 13.0] };
YEARS.forEach((y, yi) => {
  const [wantShare, wantNei] = COAL_ORACLE[y];
  assert.ok(Math.abs(ON.coal[yi] - wantShare) <= 0.06, `${y} national coal ${ON.coal[yi]} ≈ verified ${wantShare}`);
  assert.ok(Math.abs(ON.coalNei[yi] - wantNei) <= 0.16, `${y} national coal nei ${ON.coalNei[yi]} ≈ verified ${wantNei}`);
});

// ---- the null map (a state-year with no One Nation ticket) -----------------
const nulls = (s, b) => YEARS.filter((_, i) => ON.states[s][b][i] == null);
STATES.forEach((s) => {
  const want = s === "act" ? [...YEARS] : s === "nt" ? [2016, 2019, 2022] : [];
  BUCKETS.forEach((b) => assert.deepEqual(nulls(s, b), want, `${s} ${b}: the One Nation null map`));
  BUCKETS.forEach((b) => assert.ok(ON.states[s][b].every((v) => v == null || v > 0), `${s} ${b}: a pair nobody could rank is null, never zero`));
});
BUCKETS.forEach((b) => assert.ok(ON[b].every((v) => v != null), `national ${b}: counted every election`));

// ---- what the chart is handed (post-build) ---------------------------------
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(
  path.join(ROOT, ".build", "newtracker", "assets", "9f09dca2-bd46-49a8-8ae1-51847608cf92.js"), "utf8"),
sandbox, { filename: "9f09dca2.js" });
const FH = sandbox.window.AUSPOL.flowHistory;
assert.ok(FH.fed.senOn, "flowHistory.fed.senOn in the built data asset");
assert.ok(FH.fed.senOn.senateOn, "the senOn marker reaches the asset");
assert.deepEqual([...FH.fed.senOn.years], YEARS, "fed.senOn years");
YEARS.forEach((_, yi) => {
  BUCKETS.forEach((b) => {
    assert.equal(FH.fed.senOn[b][yi], ON[b][yi], `senOn national ${b} reaches the asset`);
    assert.equal(FH.fed.senOn[b + "Nei"][yi], ON[b + "Nei"][yi], `senOn national ${b} nei reaches the asset`);
  });
});
assert.ok(FH.fed.senOn.states, "flowHistory.fed.senOn.states in the built data asset");
assert.deepEqual(Object.keys(FH.fed.senOn.states), STATES, "senOn.states carries the eight (the menu drops the all-null ACT, the bank needs it)");
STATES.forEach((s) => {
  const got = FH.fed.senOn.states[s];
  assert.ok(got.label && got.short, `${s}: a label and short reach the asset`);
  assert.ok(got.senStateOn, `${s}: the senStateOn marker reaches the asset`);
  assert.deepEqual([...got.years], YEARS, `${s}: years`);
  BUCKETS.forEach((b) => {
    assert.deepEqual([...got[b]], [...ON.states[s][b]], `${s} ${b} reaches the asset`);
    assert.deepEqual([...got[b + "Nei"]], [...ON.states[s][b + "Nei"]], `${s} ${b} nei reaches the asset`);
  });
});

/* the series is federal-only: its emit must sit AFTER gen-data's
   `if (JUR) return h;` in the flowHistory block, so the Vic bundle (JUR=vic)
   never carries it — pinned positionally here, pinned built by the vic-output
   grep in the ship checks */
const genSrc = fs.readFileSync(path.join(ROOT, ".build", "newtracker", "gen-data.mjs"), "utf8");
const jurAt = genSrc.indexOf("if (JUR) return h;");
const senOnAt = genSrc.indexOf("h.fed.senOn");
assert.ok(jurAt > 0, "the flowHistory JUR return is present");
assert.ok(senOnAt > jurAt, "h.fed.senOn emits after the JUR return (Vic bundle stays Senate-free)");

console.log("test-senate-atl-on-flows: all assertions passed");
