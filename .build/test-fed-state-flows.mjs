/* test-fed-state-flows.mjs – pins the explainer's federal per-state flow
   series (user 2026-10-21: "add toggle buttons for state/territory views in
   federal"): data/fed-state-flows.json, computed by .build/fed-state-flows.py
   from the committed AEC "two-party-preferred flow by state by party"
   downloads (.build/aec-flow-src/tpp-{2004…2025}), 8 states/territories × 8
   elections. The pins: the data file re-parses exactly from the cache
   (header-read Labor column — the order varies by year), its ballots
   re-combine to the national FLOW_LEF/FLOW constants the site already
   estimates with and to the FLOW_HISTORY display series within its hand-typed
   rounding, the One Nation null map matches the elections the party's state
   count never reached the AEC's tables, and the built data asset hands the
   chart the states under flowHistory.fed.states.
   Runs after the build in npm test's chain (the data asset only reflects the
   current dataset post-build). */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const YEARS = [2004, 2007, 2010, 2013, 2016, 2019, 2022, 2025];
const STATES = ["nsw", "vic", "qld", "wa", "sa", "tas", "act", "nt"];
const BUCKETS = ["grn", "onp", "oth"];
const MAJ = new Set(["ALP", "LP", "NP", "CLP", "LNP", "NAT", "LIB"]);
const GREENS = new Set(["GRN", "GWA", "AGV", "TG"]);
const ONP = new Set(["HAN", "ON"]);
const bucketOf = (code) => (GREENS.has(code) ? "grn" : ONP.has(code) ? "onp" : "oth");

// ---- recompute from the committed AEC cache --------------------------------
const recompute = () => {
  const out = {};
  STATES.forEach((s) => { out[s] = Object.fromEntries([...BUCKETS, "votes"].map((k) => [k, k === "votes" ? Object.fromEntries(BUCKETS.map((b) => [b, []])) : []])); });
  YEARS.forEach((y, yi) => {
    const dir = path.join(ROOT, ".build", "aec-flow-src");
    const file = ["txt", "csv"].map((ext) => path.join(dir, `tpp-${y}.${ext}`)).find((p) => fs.existsSync(p));
    assert.ok(file, `tpp cache for ${y} is committed`);
    const delim = file.endsWith(".csv") ? "," : "\t";
    const lines = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "").split(/\r?\n/);
    /* 2004's csv quotes a party name that carries a comma ("Ex-Service,
       Service & Veterans Party") — split on commas outside quotes */
    const parse = delim === ","
      ? (ln) => ln.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((x) => x.replace(/^"|"$/g, ""))
      : (ln) => ln.split(delim);
    const head = parse(lines[1]);
    const alpFirst = /labor/i.test(head[3]); // column order varies; read it
    const per = {};
    lines.slice(2).forEach((ln) => {
      const c = parse(ln);
      if (c.length < 7) return;
      const code = (c[1] || "").trim();
      if (!code || MAJ.has(code)) return;
      const [a, l] = alpFirst ? [+c[3], +c[5]] : [+c[5], +c[3]];
      const st = c[0].trim().toLowerCase();
      assert.ok(STATES.includes(st), `${y}: a state/territory row (${st})`);
      const b = bucketOf(code);
      ((per[st] ||= {})[b] ||= [0, 0])[0] += a;
      per[st][b][1] += l;
    });
    STATES.forEach((s) => {
      BUCKETS.forEach((b) => {
        const [a, l] = (per[s] || {})[b] || [0, 0];
        out[s][b][yi] = a + l ? Math.round(1000 * a / (a + l)) / 10 : null;
        out[s].votes[b][yi] = a + l ? [Math.round(a), Math.round(l)] : null;
      });
    });
  });
  return out;
};
const fresh = recompute();
const data = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "fed-state-flows.json"), "utf8"));
assert.deepEqual(data.years, YEARS, "the eight TPP-cut elections, in order");
assert.deepEqual(Object.keys(data.states), STATES, "all eight states and territories, AEC order");
STATES.forEach((s) => {
  const st = data.states[s];
  assert.ok(st.label && st.short, `${s}: a full label and a chip short`);
  BUCKETS.forEach((b) => {
    assert.deepEqual(st[b], fresh[s][b], `${s} ${b}: data file matches the AEC cache`);
    assert.deepEqual(st.votes[b], fresh[s].votes[b], `${s} ${b}: ballots match the AEC cache`);
    st[b].forEach((v) => { if (v != null) { assert.ok(v >= 0 && v <= 100, `${s} ${b}: a share (${v})`); } });
  });
});

// ---- states re-combine to the national series the site already uses --------
const recombined = YEARS.map((_, yi) => Object.fromEntries(BUCKETS.map((b) => {
  let a = 0, l = 0;
  STATES.forEach((s) => { const v = data.states[s].votes[b][yi]; if (v) { a += v[0]; l += v[1]; } });
  return [b, a + l ? 100 * a / (a + l) : null];
})));
const flowsSrc = fs.readFileSync(path.join(ROOT, ".build", "newtracker", "flows.mjs"), "utf8");
const grab = (name) => {
  const m = flowsSrc.match(new RegExp("export const " + name + " = (?:Object\\.freeze\\()?(\\{[\\s\\S]*?\\})\\)?;"));
  assert.ok(m, `${name} literal found in flows.mjs`);
  return vm.runInNewContext("(" + m[1] + ")");
};
const LEF = grab("FLOW_LEF"), HIST = grab("FLOW_HISTORY"), FLOW = grab("FLOW");
YEARS.forEach((y, yi) => {
  BUCKETS.forEach((b) => {
    const mine = recombined[yi][b];
    if (y < 2025) {
      assert.ok(LEF[y][b] != null, `FLOW_LEF carries ${y} ${b}`);
      assert.ok(Math.abs(mine - 100 * LEF[y][b]) < 0.11, `${y} ${b}: states re-combine to FLOW_LEF (${mine.toFixed(1)} v ${(100 * LEF[y][b]).toFixed(1)})`);
    } else {
      assert.ok(Math.abs(mine - 100 * FLOW[b]) < 0.11, `2025 ${b}: states re-combine to FLOW (${mine.toFixed(1)})`);
    }
    // the display table's hand-typed cells agree within their rounding (0.3
    // known at 2004 onp); a gap beyond that is a parser drift, not copy
    const hi = HIST.years.indexOf(y);
    if (HIST[b][hi] != null) assert.ok(Math.abs(mine - HIST[b][hi]) < 0.5, `${y} ${b}: within the display series' rounding (${mine.toFixed(1)} v ${HIST[b][hi]})`);
  });
});

// ---- the One Nation null map (elections its state count never published) ---
const onpNulls = (s) => YEARS.filter((_, i) => data.states[s].onp[i] == null);
assert.deepEqual(onpNulls("vic"), [2010, 2013, 2016], "Vic One Nation: absent 2010–2016");
assert.deepEqual(onpNulls("tas"), [2004, 2007, 2010, 2013, 2016], "Tas One Nation: absent to 2016");
assert.deepEqual(onpNulls("act"), [2004, 2007, 2010, 2013, 2016, 2019, 2025], "ACT One Nation: 2022 alone");
assert.deepEqual(onpNulls("nt"), [2004, 2007, 2013, 2016, 2019], "NT One Nation: scattered");
BUCKETS.forEach((b) => STATES.forEach((s) => {
  if (b === "grn") assert.ok(data.states[s][b].every((v) => v != null), `${s} greens: counted every election`);
}));

// ---- what the chart is handed ----------------------------------------------
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(
  path.join(ROOT, ".build", "newtracker", "assets", "9f09dca2-bd46-49a8-8ae1-51847608cf92.js"), "utf8"),
sandbox, { filename: "9f09dca2.js" });
const FH = sandbox.window.AUSPOL.flowHistory;
assert.ok(FH.fed.states, "flowHistory.fed.states in the built data asset");
assert.deepEqual(Object.keys(FH.fed.states), STATES, "fed.states carries the eight");
STATES.forEach((s) => {
  const got = FH.fed.states[s];
  assert.equal(got.fedState, true, `${s}: marked a federal state view`);
  assert.deepEqual([...got.years], YEARS, `${s}: years`);
  BUCKETS.forEach((b) => assert.deepEqual([...got[b]], data.states[s][b], `${s} ${b} reaches the asset`));
});
assert.ok(!Object.keys(FH).includes("states"), "states nests under fed, never a chip key of its own");

console.log("test-fed-state-flows: all assertions passed");
