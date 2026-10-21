/* test-senate-atl-flows.mjs – pins the explainer's UPPER-HOUSE flow series
   (FLOW_HISTORY_SENATE in .build/newtracker/flows.mjs, the explainer chart's
   House: Upper view; user 2026-10-22: "House: Lower ⇄ / Upper ⇄"): four
   Senate elections since group voting tickets were abolished (2016/2019/
   2022/2025), national plus all eight states and territories. The AEC
   publishes no Senate flow table, so the committed
   .build/aec-flow-src/senate-atl/counts.json holds the ATL ballot counts the
   table was computed from (share = toALP of the ATL ballots naming a major;
   "named neither major" = neither of the family's ATL papers), and this test
   re-derives EVERY cell from it: a table-cell edit without a counts edit
   fails, a counts edit without a table edit fails, and the eight states must
   re-combine to the committed national counts exactly. The One Nation null
   map is pinned (no Senate tickets in the ACT in any of the four; none in
   the NT until 2025 — zero-ballot families are null, never zero). Runs after
   the build in npm test's chain (the data-asset assertions only hold
   post-build) and also pins the emit sitting after gen-data's JUR return, so
   the Vic bundle never carries the series. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const YEARS = [2016, 2019, 2022, 2025];
const STATES = ["nsw", "vic", "qld", "wa", "sa", "tas", "act", "nt"];
const BUCKETS = ["grn", "onp", "oth"];
const FAMILY = { grn: "GRN", onp: "PHON", oth: "OTHER" };
const r1 = (n, d) => (d ? Math.round(1000 * n / d) / 10 : null);
const ofCounts = (c) => {
  if (!c) return { share: null, nei: null };
  return { share: r1(c.toALP, c.toALP + c.toCOAL), nei: r1(c.neither, c.toALP + c.toCOAL + c.neither) };
};

// ---- recompute every cell from the committed ATL counts --------------------
const counts = JSON.parse(fs.readFileSync(path.join(ROOT, ".build", "aec-flow-src", "senate-atl", "counts.json"), "utf8"));
assert.deepEqual(Object.keys(counts.events), YEARS.map(String), "the four post-GVT Senate elections, in order");
const fresh = { national: null, states: Object.fromEntries(STATES.map((s) => [s, {}])) };
YEARS.forEach((y) => {
  const ev = counts.events[y];
  assert.ok(ev.counts && ev.states, `${y}: national counts and the eight states`);
  assert.deepEqual(Object.keys(ev.states).sort(), STATES.map((s) => s.toUpperCase()).sort(), `${y}: all eight states and territories`);
  /* the majors' own families are definitional (an ALP first-preference ATL
     ballot's first major is Labor) — pin the shape so a mis-mapped family
     can't slide a major's ballots into a minor's column */
  ["ALP", "COAL"].forEach((fam) => {
    const nat = ev.counts[fam];
    assert.ok(nat, `${y} ${fam}: family counted`);
    assert.ok(nat.toALP + nat.toCOAL > 0 && nat.neither === 0, `${y} ${fam}: every ballot names its own major`);
    STATES.forEach((s) => {
      const st = ev.states[s.toUpperCase()][fam];
      assert.ok(st && st.neither === 0, `${y} ${s} ${fam}: state family shape`);
    });
  });
  if (!fresh.national) fresh.national = Object.fromEntries(BUCKETS.map((b) => [b, []]));
  BUCKETS.forEach((b) => {
    const nat = ofCounts(ev.counts[FAMILY[b]]);
    fresh.national[b].push(nat);
    STATES.forEach((s) => {
      (fresh.states[s][b] ||= []).push(ofCounts(ev.states[s.toUpperCase()][FAMILY[b]]));
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
const SEN = grab("FLOW_HISTORY_SENATE");
assert.deepEqual([...SEN.years], YEARS, "the four post-GVT Senate elections");
const expectCell = (got, want, where) => {
  assert.strictEqual(got, want, `${where}: table cell ${got} vs counts ${want}`);
  if (want != null) assert.ok(want >= 0 && want <= 100, `${where}: a share (${want})`);
};
YEARS.forEach((y, yi) => {
  BUCKETS.forEach((b) => {
    expectCell(SEN[b][yi], fresh.national[b][yi].share, `national ${y} ${b}`);
    expectCell(SEN[b + "Nei"][yi], fresh.national[b][yi].nei, `national ${y} ${b} nei`);
    STATES.forEach((s) => {
      const st = SEN.states[s];
      assert.ok(st && st.label && st.short, `${s}: a full label and a short`);
      expectCell(st[b][yi], fresh.states[s][b][yi].share, `${s} ${y} ${b}`);
      expectCell(st[b + "Nei"][yi], fresh.states[s][b][yi].nei, `${s} ${y} ${b} nei`);
    });
  });
});

// ---- the eight states re-combine to the committed national counts ----------
YEARS.forEach((y) => {
  const ev = counts.events[y];
  ["ALP", "COAL", ...BUCKETS.map((b) => FAMILY[b])].forEach((fam) => {
    ["toALP", "toCOAL", "neither"].forEach((k) => {
      const sum = STATES.reduce((t, s) => t + ev.states[s.toUpperCase()][fam][k], 0);
      assert.strictEqual(sum, ev.counts[fam][k], `${y} ${fam} ${k}: states re-combine to the national count`);
    });
  });
});

// ---- the One Nation null map (zero-ballot families, never zeros) -----------
const onpNulls = (s) => YEARS.filter((_, i) => SEN.states[s].onp[i] == null);
assert.deepEqual(onpNulls("act"), [...YEARS], "ACT One Nation: no Senate tickets in any of the four");
assert.deepEqual(onpNulls("nt"), [2016, 2019, 2022], "NT One Nation: 2025 alone");
STATES.forEach((s) => {
  assert.deepEqual(onpNulls(s), s === "act" ? [...YEARS] : s === "nt" ? [2016, 2019, 2022] : [], `${s}: no other One Nation gaps`);
  ["grn", "oth"].forEach((b) => assert.ok(SEN.states[s][b].every((v) => v != null), `${s} ${b}: counted every election`));
  assert.ok(SEN.states[s].onp.every((v) => v == null || v > 0), `${s}: a zero-ballot family is null, never zero`);
});

// ---- what the chart is handed (post-build) ---------------------------------
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(
  path.join(ROOT, ".build", "newtracker", "assets", "9f09dca2-bd46-49a8-8ae1-51847608cf92.js"), "utf8"),
sandbox, { filename: "9f09dca2.js" });
const FH = sandbox.window.AUSPOL.flowHistory;
assert.ok(FH.fed.sen, "flowHistory.fed.sen in the built data asset");
assert.deepEqual([...FH.fed.sen.years], YEARS, "fed.sen years");
YEARS.forEach((_, yi) => {
  BUCKETS.forEach((b) => {
    assert.equal(FH.fed.sen[b][yi], SEN[b][yi], `sen national ${b} reaches the asset`);
    assert.equal(FH.fed.sen[b + "Nei"][yi], SEN[b + "Nei"][yi], `sen national ${b} nei reaches the asset`);
  });
});
assert.ok(FH.fed.sen.states, "flowHistory.fed.sen.states in the built data asset");
assert.deepEqual(Object.keys(FH.fed.sen.states), STATES, "sen.states carries the eight");
STATES.forEach((s) => {
  const got = FH.fed.sen.states[s];
  assert.ok(got.label && got.short, `${s}: a label and short reach the asset`);
  assert.deepEqual([...got.years], YEARS, `${s}: years`);
  BUCKETS.forEach((b) => {
    assert.deepEqual([...got[b]], [...SEN.states[s][b]], `${s} ${b} reaches the asset`);
    assert.deepEqual([...got[b + "Nei"]], [...SEN.states[s][b + "Nei"]], `${s} ${b} nei reaches the asset`);
  });
});
assert.ok(!Object.keys(FH).includes("sen"), "sen nests under fed, never a chip key of its own");

/* the series is federal-only: its emit must sit AFTER gen-data's
   `if (JUR) return h;` in the flowHistory block, so the Vic bundle (JUR=vic)
   never carries it — pinned positionally here, pinned built by the vic-output
   grep in the ship checks */
const genSrc = fs.readFileSync(path.join(ROOT, ".build", "newtracker", "gen-data.mjs"), "utf8");
const jurAt = genSrc.indexOf("if (JUR) return h;");
const senAt = genSrc.indexOf("h.fed.sen");
assert.ok(jurAt > 0, "the flowHistory JUR return is present");
assert.ok(senAt > jurAt, "h.fed.sen emits after the JUR return (Vic bundle stays Senate-free)");

console.log("test-senate-atl-flows: all assertions passed");
