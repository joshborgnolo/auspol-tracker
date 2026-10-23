/* test-primary-history.mjs – pins the /flows-explained/ "View: Primary votes"
   flip's data end-to-end: data/primary-history.json (built by
   .build/aec-primary-history.py from the committed AEC first-preference
   downloads in .build/aec-flow-src/fpv/), its fold-at-4% contract (user
   2026-10-23: "below 4% just displays others and above 4% displays as its own
   points"), and the gen-data handoff into the built data asset
   (window.AUSPOL.primaryHistory). CHECKS:
   1. the JSON's national ALP and Coalition cells recompute from the
      committed caches (vote sums by fixed party-code sets – this file's own
      arithmetic, not the generator's), and sit on the canonical published
      House figures the generator pins (incl. the 2010 Coalition 43.61
      correction – the aus-house-primary-history skill's 43.32 is a
      Wikipedia-propagated typo);
   2. the fold's NULL MAP is pinned per named minor (One Nation shows only
      2022–25 in the House view but 2016→ in the Senate; the United
      Australia/Palmer family only 2013 and 2022; Xenophon only SA 2016–19;
      Lambie only Tas Senate 2016→), every displayed minor cell is >= foldPt,
   and `oth` recombines as the residual of exactly the shown lines per year
   in every view (national, senate, all 16 state cuts);
   3. the built data asset hands the chart the same document.
   Runs after the build in npm test's chain (the data asset only reflects the
   current dataset post-build). */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FPV = path.join(ROOT, ".build", "aec-flow-src", "fpv");

const AEC_YEARS = [2004, 2007, 2010, 2013, 2016, 2019, 2022, 2025];
const STATES = ["nsw", "vic", "qld", "wa", "sa", "tas", "act", "nt"];
/* fixed code vocab (enumerated from the committed caches 2026-10-23;
   complementary to the generator's name sets – a drift in either trips) */
const CODES = {
  alp: new Set(["ALP", "ALPC"]), // ALPC = "Labor/Country Labor" (2004 senate)
  lnp: new Set(["LP", "NP", "CLP", "LNQ", "LNP", "LPNP"]), // LNQ 2010; LPNP joint tickets
  grn: new Set(["GRN", "GWA", "TGA"]),
  onp: new Set(["HAN", "ON", "ONP"]), // HAN is 2004's Pauline Hanson One Nation
  dem: new Set(["DEM"]),
  dlp: new Set(["DLP"]),
  uap: new Set(["PUP", "UAPP"]), // Palmer United 2013 / United Australia 2019+
  xnt: new Set(["XEN"]),
  jln: new Set(["JLN"]),
  ind: new Set(["IND"]),
};
const NAMED = ["grn", "onp", "dem", "dlp", "uap", "xnt", "jln", "ind"];

// ---- parse a cache sheet into vote sums by bucket, per state ---------------
const parseLine = (ln) =>
  ln.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((x) => x.replace(/^"|"$/g, "").trim());
const sheet = (file) => {
  const text = fs.readFileSync(path.join(FPV, file), "utf8").replace(/^﻿/, "");
  const lines = text.split(/\r?\n/);
  const hi = lines.findIndex((l) => /^(PartyAb|StateAb),/.test(l));
  assert.ok(hi >= 0, `${file}: header row found`);
  const head = parseLine(lines[hi]);
  return { head, rows: lines.slice(hi + 1).filter((l) => l.trim()).map(parseLine) };
};
/* returns {nat: {bucket: votes}, perState: {st: {bucket: votes}}} */
const bucketVotes = (file, abCol, votesCol, stateCol) => {
  const { head, rows } = sheet(file);
  const ia = head.indexOf(abCol), iv = head.indexOf(votesCol);
  const is = stateCol ? head.indexOf(stateCol) : -1;
  assert.ok(ia >= 0 && iv >= 0, `${file}: ${abCol}/${votesCol} columns`);
  const nat = {}, perState = {};
  rows.forEach((r) => {
    if (r.length <= iv || !r[ia]) return;
    let b = null;
    for (const [k, set] of Object.entries(CODES)) if (set.has(r[ia])) b = k;
    if (!b) b = null; // unmapped fringe – counted in the total only
    const v = +r[iv];
    assert.ok(Number.isFinite(v), `${file}: a vote figure (${r[iv]})`);
    if (b) nat[b] = (nat[b] || 0) + v;
    nat.__tot = (nat.__tot || 0) + v;
    if (is >= 0) {
      const st = r[is].toLowerCase();
      assert.ok(STATES.includes(st), `${file}: a state row (${st})`);
      const slot = (perState[st] ||= {});
      if (b) slot[b] = (slot[b] || 0) + v;
      slot.__tot = (slot.__tot || 0) + v;
    }
  });
  return { nat, perState };
};
const pct = (votes) => Object.fromEntries(
  Object.entries(votes).filter(([k]) => k !== "__tot")
    .map(([k, v]) => [k, (100 * v) / votes.__tot]));

// recompute national House majors (CANON pins + folds) and, per house, every
// bucket the test asserts on
const natHouse = {}, natSenate = {}, stHouse = {}, stSenate = {};
AEC_YEARS.forEach((y) => {
  const h = bucketVotes(`fpv-house-nat-${y}.csv`, "PartyAb", "TotalVotes", null);
  natHouse[y] = pct(h.nat);
  const s = bucketVotes(`fpv-senate-state-${y}.csv`, "GroupAb", "TotalVotes", "StateAb");
  natSenate[y] = pct(s.nat);
  stSenate[y] = Object.fromEntries(STATES.map((st) => [st, pct(s.perState[st] || { __tot: 1 })]));
  const hs = bucketVotes(`fpv-house-state-${y}.csv`, "PartyAb", "TotalVotes", "StateAb");
  stHouse[y] = Object.fromEntries(STATES.map((st) => [st, pct(hs.perState[st] || { __tot: 1 })]));
});

// ---- the data file ----------------------------------------------------------
const doc = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "primary-history.json"), "utf8"));
assert.equal(doc.foldPt, 4, "the fold threshold is 4");
const FED = doc.fed, SEN = doc.fed.sen;
assert.ok(FED && SEN, "fed and fed.sen views");
assert.deepEqual(Object.keys(FED.states), STATES, "the eight state house cuts");
assert.deepEqual(Object.keys(SEN.states), STATES, "the eight state senate cuts");
// the AEC-cache span is exactly the trailing eight elections (typed 1972–2001
// history, when it lands, prepends to the national views only)
assert.deepEqual(FED.years.slice(-AEC_YEARS.length), AEC_YEARS, "fed years end in the AEC span");
assert.deepEqual(SEN.years.slice(-AEC_YEARS.length), AEC_YEARS, "senate years end in the AEC span");
STATES.forEach((s) => {
  assert.deepEqual(FED.states[s].years, AEC_YEARS, `${s} house: per-state span starts 2004`);
  assert.deepEqual(SEN.states[s].years, AEC_YEARS, `${s} senate: per-state span starts 2004`);
});

// ---- canonical national ALP / Coalition pins --------------------------------
/* published AEC national House figures (the generator's CANON set; 2010
   Coalition 43.61 – the skill table's 43.32 is the Nats misprint) */
const CANON_HOUSE = {
  2004: [37.63, 46.71], 2007: [43.38, 42.09], 2010: [37.99, 43.61],
  2013: [33.38, 45.55], 2016: [34.73, 42.04], 2019: [33.34, 41.44],
  2022: [32.58, 35.70], 2025: [34.56, 31.82],
};
AEC_YEARS.forEach((y) => {
  const i = FED.years.indexOf(y);
  for (const [b, k] of [["alp", 0], ["lnp", 1]]) {
    // the JSON cell agrees with both the canonical figure and this file's
    // independent cache recompute
    assert.ok(Math.abs(FED[b][i] - CANON_HOUSE[y][k]) <= 0.03,
      `${y} ${b}: CANON pin (${FED[b][i]} v ${CANON_HOUSE[y][k]})`);
    assert.ok(Math.abs(FED[b][i] - natHouse[y][b]) <= 0.03,
      `${y} ${b}: cache recompute (${FED[b][i]} v ${natHouse[y][b].toFixed(2)})`);
  }
  assert.ok(Math.abs(natHouse[y].alp - CANON_HOUSE[y][0]) <= 0.03,
    `${y} alp: recompute on the canonical figure (${natHouse[y].alp.toFixed(2)})`);
  assert.ok(Math.abs(natHouse[y].lnp - CANON_HOUSE[y][1]) <= 0.03,
    `${y} lnp: recompute on the canonical figure (${natHouse[y].lnp.toFixed(2)})`);
});
// senate majors recompute from the per-state caches
AEC_YEARS.forEach((y) => {
  const i = SEN.years.indexOf(y);
  ["alp", "lnp"].forEach((b) => {
    assert.ok(Math.abs(SEN[b][i] - natSenate[y][b]) <= 0.03,
      `${y} senate ${b}: cache recompute (${SEN[b][i]} v ${natSenate[y][b].toFixed(2)})`);
  });
});

// ---- the fold's null map, pinned per named minor ---------------------------
const nulls = (arr, years) => years.filter((_, i) => arr[i] == null);
const cell = (view, key, year) => view[key][view.years.indexOf(year)];
// House: One Nation only 2022 on; UAP family only 2013 and 2022; IND only 2022 on
assert.deepEqual(nulls(FED.onp, FED.years), AEC_YEARS.filter((y) => y < 2022), "house ONP: 2022–25 only");
assert.deepEqual(nulls(FED.uap, FED.years), AEC_YEARS.filter((y) => ![2013, 2022].includes(y)), "house UAP: 2013 & 2022 only");
assert.deepEqual(nulls(FED.ind, FED.years), AEC_YEARS.filter((y) => y < 2022), "house IND: 2022–25 only");
assert.equal(cell(FED, "onp", 2022), 4.96); assert.equal(cell(FED, "onp", 2025), 6.4);
assert.equal(cell(FED, "uap", 2013), 5.49); assert.equal(cell(FED, "uap", 2022), 4.12);
assert.equal(cell(FED, "ind", 2022), 5.3); assert.equal(cell(FED, "ind", 2025), 7.36);
// Senate: One Nation from 2016, UAP 2013 alone, and NO ind/dem/dlp/xnt/jln lines
assert.deepEqual(nulls(SEN.onp, SEN.years), AEC_YEARS.filter((y) => y < 2016), "senate ONP: 2016 on");
assert.deepEqual(nulls(SEN.uap, SEN.years), AEC_YEARS.filter((y) => y !== 2013), "senate UAP: 2013 only");
assert.equal(cell(SEN, "onp", 2016), 4.28); assert.equal(cell(SEN, "uap", 2013), 4.91);
["ind", "dem", "dlp", "xnt", "jln"].forEach((k) => assert.equal(SEN[k], undefined, `no national senate ${k} line`));
// state cuts: Xenophon SA-only 2016–19; Lambie Tas-senate-only 2016 on;
// Democrats nowhere >= fold across the cache span (so no dem key anywhere yet)
assert.deepEqual(FED.states.sa.xnt, [null, null, null, null, 21.26, 4.38, null, null], "SA xnt: 2016–19 only");
assert.ok(STATES.filter((s) => s !== "sa").every((s) => FED.states[s].xnt === undefined), "xnt house cuts: SA only");
assert.deepEqual(SEN.states.tas.jln, [null, null, null, null, 8.3, 8.92, 8.64, 7.28], "Tas senate jln: 2016 on");
assert.ok(STATES.filter((s) => s !== "tas").every((s) => SEN.states[s].jln === undefined), "jln senate cuts: Tas only");
assert.deepEqual(SEN.states.qld.onp, [null, 4.37, null, null, 9.19, 10.27, 7.4, 7.13], "Qld senate onp cells");
// the Democrats cross the fold exactly once in the whole cache span
// (4.73% NT senate 2004) and DLP never does
assert.deepEqual(SEN.states.nt.dem, [4.73, null, null, null, null, null, null, null], "NT senate dem: 2004 alone");
const allViews = [FED, SEN, ...STATES.map((s) => FED.states[s]), ...STATES.map((s) => SEN.states[s])];
allViews.forEach((v) => {
  if (v.dem != null) assert.equal(v, SEN.states.nt, `${v.label}: the document's only dem line`);
  assert.equal(v.dlp, undefined, `${v.label}: no dlp line across the cache span`);
});
/* and the nulls are the fold's fault, not missing data: recompute each
   sub-fold share from the caches */
AEC_YEARS.forEach((y) => {
  const gate = (view, mine, key, label) => {
    const i = view.years.indexOf(y);
    const shown = view[key] == null ? [] : view[key];
    if (shown[i] == null) assert.ok((mine[key] || 0) < 4, `${y} ${label} ${key}: folded (${(mine[key] || 0).toFixed(2)} < 4)`);
    else assert.ok((mine[key] || 0) >= 3.99, `${y} ${label} ${key}: shown (${mine[key].toFixed(2)} >= fold)`);
  };
  ["onp", "uap", "xnt", "dem", "dlp", "ind", "jln"].forEach((k) => gate(FED, natHouse[y], k, "house"));
  ["onp", "uap", "xnt", "dem", "dlp", "jln"].forEach((k) => gate(SEN, natSenate[y], k, "senate"));
  gate(SEN.states.tas, stSenate[y].tas, "jln", "tas-senate");
  gate(FED.states.sa, stHouse[y].sa, "xnt", "sa-house");
  gate(SEN.states.nt, stSenate[y].nt, "dem", "nt-senate");
});

// ---- every view: fold contract + recombination ------------------------------
allViews.forEach((v) => {
  const n = v.years.length;
  assert.ok(v.label && v.elections, `${v.label}: label + elections copy`);
  ["alp", "lnp", "oth"].forEach((k) => {
    assert.ok(Array.isArray(v[k]) && v[k].length === n, `${v.label} ${k}: aligned`);
    v[k].forEach((x, i) => assert.ok(typeof x === "number",
      `${v.label} ${k} ${v.years[i]}: always drawn (${x})`));
  });
  NAMED.forEach((k) => {
    if (v[k] == null) return;
    assert.equal(v[k].length, n, `${v.label} ${k}: aligned`);
    v[k].forEach((x, i) => {
      if (x == null) return; // folded: a gap, never a zero
      assert.ok(x >= 4 - 0.005 && x <= 100, `${v.label} ${k} ${v.years[i]}: at or above the fold (${x})`);
      assert.ok(x !== 0, `${v.label} ${k} ${v.years[i]}: a folded share is null, never 0`);
    });
  });
  // oth is the residual of exactly the shown lines, per year
  v.years.forEach((y, i) => {
    const shown = ["alp", "lnp", ...NAMED].reduce((t, k) => t + (v[k] && v[k][i] != null ? v[k][i] : 0), 0);
    assert.ok(Math.abs(shown + v.oth[i] - 100) <= 0.06,
      `${v.label} ${y}: lines + oth recombine to 100 (${(shown + v.oth[i]).toFixed(2)})`);
  });
  // an all-folded gated family never ships a key at all
  NAMED.forEach((k) => {
    if (v[k] != null) assert.ok(v[k].some((x) => x != null), `${v.label} ${k}: shown somewhere`);
  });
});

// ---- gen-data wiring + the template tokens ----------------------------------
const gen = fs.readFileSync(path.join(ROOT, ".build", "newtracker", "gen-data.mjs"), "utf8");
assert.ok(/const primaryHistory = \$\{/.test(gen), "gen-data emits primaryHistory into the data asset");
assert.ok(/validatePrimaryHistory\(\)/.test(fs.readFileSync(
  path.join(ROOT, ".build", "newtracker", "validate.mjs"), "utf8")), "validate.mjs checks primaryHistory");
const tmpl = fs.readFileSync(path.join(ROOT, ".build", "newtracker", "template.html"), "utf8");
["dem", "uap", "xnt", "jln", "dlp"].forEach((k) => {
  const marks = tmpl.match(new RegExp(`--${k}:\\s`, "g")) || [];
  assert.ok(marks.length >= 2, `template.html: --${k} token in light AND dark themes`);
  const texts = tmpl.match(new RegExp(`--${k}-text:`, "g")) || [];
  assert.ok(texts.length >= 2, `template.html: --${k}-text alias in light AND dark themes`);
});

// ---- what the chart is handed ----------------------------------------------
const assetDir = path.join(ROOT, ".build", "newtracker", "assets");
const bundle = fs.readdirSync(assetDir).find((f) => /^9f09dca2-.*\.js$/.test(f));
assert.ok(bundle, "the data asset exists post-build");
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(assetDir, bundle), "utf8"), sandbox, { filename: bundle });
const PH = sandbox.window.AUSPOL.primaryHistory;
assert.ok(PH, "window.AUSPOL.primaryHistory reaches the chart");
assert.equal(PH.foldPt, doc.foldPt, "fold threshold intact");
const wanted = { ...doc };
delete wanted._comment;
// the vm realm's Array/Object prototypes differ – re-serialise before comparing
assert.deepEqual(JSON.parse(JSON.stringify(PH)), wanted, "the asset carries the data file verbatim");

console.log("test-primary-history: all assertions passed");
