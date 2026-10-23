/* test-2pp-history.mjs – pins the /flows-explained/ "View: 2PP" flip's data
   end-to-end: data/2pp-history.json (built by .build/aec-2pp-history.py from
   the committed AEC Two Party Preferred By Division downloads in
   .build/aec-flow-src/tppdiv-*.csv plus data/polls.json's canonical election
   records), its two-line contract, and the gen-data handoff into the built
   data asset (window.AUSPOL.twoPPHistory). CHECKS:
   1. National cells are the site's canonical election records VERBATIM
      (data/polls.json's tpp_alp/tpp_lnp, 1972–2025), never a recomputed
      shadow of them; the downloads' per-division counts independently
      recompose each download year's cell to within 0.06.
   2. State and class cells recompute from the committed downloads (this
      file's own arithmetic: per-division ALP/Coalition vote sums by state,
      or by the division-classifications.json blocks grouped per election),
      span exactly 2004–2025 (the downloads' floor and ceiling), and every
      emitted pair sums to 100 (the file emits Labor's cell; the Coalition
      cell is by construction 100 minus it).
   3. The story pins hold: the canonical records' extremes, and the urban-
      ladder readings behind "Federal, inner metro" & "Federal, rural".
   4. gen-data emits twoPPHistory into the data asset, validate.mjs gates
      the file's shape, and the built page carries the flip wiring. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, ".build", "aec-flow-src");

const AEC_YEARS = [2004, 2007, 2010, 2013, 2016, 2019, 2022, 2025];
const HIST_YEARS = [1972, 1974, 1975, 1977, 1980, 1983, 1984, 1987, 1990, 1993, 1996, 1998, 2001];
const NAT_YEARS = [...HIST_YEARS, ...AEC_YEARS];
const STATES = ["nsw", "vic", "qld", "wa", "sa", "tas", "act", "nt"];
const CLASSES = ["inner", "outer", "provincial", "rural"];
const CLS_KEY = { "inner metropolitan": "inner", "outer metropolitan": "outer",
  "provincial": "provincial", "rural": "rural" };

/* independent recompute: per-division two-party votes from the downloads -
   the generator's files reread by this probe's OWN parser and summed */
const tppdiv = (y) => {
  const text = fs.readFileSync(path.join(SRC, `tppdiv-${y}.csv`), "utf8").replace(/^﻿/, "");
  const lines = text.split(/\r?\n/);
  const hi = lines.findIndex((l) => /^DivisionNm,/.test(l));
  assert.ok(hi >= 0, `${y}: header row found`);
  const head = lines[hi].split(",");
  const ia = head.indexOf("Australian Labor Party Votes");
  const il = head.indexOf("Liberal/National Coalition Votes");
  const id = head.indexOf("DivisionNm");
  const is = head.indexOf("StateAb");
  assert.ok(ia >= 0 && il >= 0 && id >= 0 && is >= 0, `${y}: the four counted columns`);
  const rows = lines.slice(hi + 1).filter((l) => l.trim()).map((l) => l.split(","));
  const nat = [0, 0], perState = {}, perDiv = {};
  rows.forEach((r) => {
    if (r.length <= il || !r[id].trim()) return;
    const a = +r[ia], l = +r[il];
    assert.ok(Number.isFinite(a) && Number.isFinite(l), `${y}: numeric votes in ${r[id]}`);
    const st = r[is].trim().toLowerCase();
    nat[0] += a; nat[1] += l;
    (perState[st] ||= [0, 0])[0] += a; perState[st][1] += l;
    perDiv[r[id].trim()] = [a, l];
  });
  return { nat, perState, perDiv };
};
const share = (pair) => (100 * pair[0]) / (pair[0] + pair[1]);

const DIVCLS = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "division-classifications.json"), "utf8")).elections;
const rec = {};   // year -> {nat, perState, perClass}
AEC_YEARS.forEach((y) => {
  const { nat, perState, perDiv } = tppdiv(y);
  const blk = DIVCLS[String(y)];
  assert.ok(blk, `${y}: a classifications block`);
  const perClass = {};
  for (const [div, pair] of Object.entries(perDiv)) {
    const d = blk[div];
    assert.ok(d, `${y}: ${div} classified`);
    const ck = CLS_KEY[d.classification.toLowerCase()];
    assert.ok(ck, `${y}: ${div} classification maps (${d.classification})`);
    (perClass[ck] ||= [0, 0])[0] += pair[0]; perClass[ck][1] += pair[1];
  }
  rec[y] = { nat: share(nat), perState: Object.fromEntries(STATES.map((s) => [s, share(perState[s])])),
    perClass: Object.fromEntries(CLASSES.map((c) => [c, share(perClass[c])])) };
});

// ---- the data file ----------------------------------------------------------
const doc = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "2pp-history.json"), "utf8"));
const FED = doc.fed;
assert.ok(FED, "the fed view");
assert.equal(FED.sen, undefined, "no Senate view - no 2PP is ever counted there");
assert.deepEqual(Object.keys(FED.states), STATES, "the eight state cuts");
assert.deepEqual(Object.keys(FED.classes), CLASSES, "the four class cuts, in menu order");
assert.deepEqual(FED.years, NAT_YEARS, "national span: 1972–2025");
STATES.forEach((s) => assert.deepEqual(FED.states[s].years, AEC_YEARS, `${s}: the downloads' span`));
CLASSES.forEach((c) => assert.deepEqual(FED.classes[c].years, AEC_YEARS, `${c}: the downloads' span`));
const cell = (v, k, y) => v[k][v.years.indexOf(y)];

/* every view: the two-line contract - numeric cells, aligned to years, and
   the pair summing to the count */
const allViews = [FED, ...STATES.map((s) => FED.states[s]), ...CLASSES.map((c) => FED.classes[c])];
allViews.forEach((v) => {
  assert.ok(v.label && v.elections, `${v.label}: label + elections copy`);
  v.years.forEach((y, i) => {
    for (const k of ["alp", "lnp"]) {
      assert.equal(typeof v[k][i], "number", `${v.label} ${k} ${y}: drawn`);
      assert.ok(v[k][i] > 0 && v[k][i] < 100, `${v.label} ${k} ${y}: in range (${v[k][i]})`);
    }
    assert.ok(Math.abs(v.alp[i] + v.lnp[i] - 100) <= 0.02,
      `${v.label} ${y}: the pair sums to 100 (${v.alp[i]} + ${v.lnp[i]})`);
  });
});

/* national cells are the canonical records verbatim, and the downloads
   recompose them (the same assertion the generator carries, plus each
   state's and class's own recompute against the JSON cell) */
const ELECTIONS = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "polls.json"), "utf8")).elections;
NAT_YEARS.forEach((y) => {
  const recd = ELECTIONS["e" + y];
  assert.ok(recd, `${y}: a canonical record`);
  assert.equal(cell(FED, "alp", y), recd.tpp_alp, `${y} alp: canonical verbatim`);
  assert.equal(cell(FED, "lnp", y), recd.tpp_lnp, `${y} lnp: canonical verbatim`);
});
AEC_YEARS.forEach((y) => {
  assert.ok(Math.abs(rec[y].nat - cell(FED, "alp", y)) < 0.06,
    `${y} national: download recompose ${rec[y].nat.toFixed(2)} v canonical ${cell(FED, "alp", y)}`);
  STATES.forEach((s) => assert.ok(Math.abs(rec[y].perState[s] - cell(FED.states[s], "alp", y)) < 0.005,
    `${y} ${s}: ${rec[y].perState[s].toFixed(2)} v cell ${cell(FED.states[s], "alp", y)}`));
  CLASSES.forEach((c) => assert.ok(Math.abs(rec[y].perClass[c] - cell(FED.classes[c], "alp", y)) < 0.005,
    `${y} ${c}: ${rec[y].perClass[c].toFixed(2)} v cell ${cell(FED.classes[c], "alp", y)}`));
});

/* the story pins (recomputed from the downloads 2026-10-23): the canonical
   series' extremes, the states' range, and the urban ladder */
assert.equal(cell(FED, "alp", 1975), 44.3, "the canonical series' trough (1975 flows on)");
assert.equal(cell(FED, "alp", 2025), 55.2, "the canonical series' peak");
assert.equal(cell(FED, "alp", 2019), 48.47, "the records' mixed precision carries through verbatim");
assert.equal(cell(FED.states.act, "alp", 2025), 72.49);
assert.equal(cell(FED.states.tas, "alp", 2010), 60.62);
assert.equal(cell(FED.states.qld, "alp", 2013), 43.02);
assert.equal(cell(FED.classes.inner, "alp", 2004), 53.01);
assert.equal(cell(FED.classes.inner, "alp", 2025), 63.31);
assert.equal(cell(FED.classes.rural, "alp", 2004), 39.77);
assert.equal(cell(FED.classes.rural, "alp", 2013), 39.16);
AEC_YEARS.forEach((y) => {
  assert.ok(cell(FED.classes.inner, "alp", y) > cell(FED.classes.rural, "alp", y),
    `${y}: inner metro runs ahead of rural for Labor`);
  assert.ok(cell(FED.classes.rural, "alp", y) < cell(FED, "alp", y),
    `${y}: rural runs behind the national line`);
});

// ---- gen-data + validate wiring --------------------------------------------
const gen = fs.readFileSync(path.join(ROOT, ".build", "newtracker", "gen-data.mjs"), "utf8");
assert.ok(/const twoPPHistory = \$\{/.test(gen), "gen-data emits twoPPHistory into the data asset");
assert.ok(/primaryHistory, twoPPHistory/.test(gen), "twoPPHistory joins the consumer export list");
assert.ok(/validate2ppHistory\(\)/.test(fs.readFileSync(
  path.join(ROOT, ".build", "newtracker", "validate.mjs"), "utf8")), "validate.mjs checks twoPPHistory");

// ---- what the chart is handed ----------------------------------------------
const assetDir = path.join(ROOT, ".build", "newtracker", "assets");
const bundle = fs.readdirSync(assetDir).find((f) => /^9f09dca2-.*\.js$/.test(f));
assert.ok(bundle, "the data asset exists post-build");
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(assetDir, bundle), "utf8"), sandbox, { filename: bundle });
const TP = sandbox.window.AUSPOL.twoPPHistory;
assert.ok(TP, "window.AUSPOL.twoPPHistory reaches the chart");
const wanted = { ...doc };
delete wanted._comment;
// the vm realm's Array/Object prototypes differ – re-serialise before comparing
assert.deepEqual(JSON.parse(JSON.stringify(TP)), wanted, "the asset carries the data file verbatim");

// ---- the View flip's renderer wiring shipped in the built page ------------
const page = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
assert.ok(page.includes("Explained2ppChart") && page.includes("twoPPHistory"),
  "the 2PP-history view wiring is built into the page");
assert.ok(page.includes("2PP") && page.includes("Switch to two-party preferred shares at every election"),
  "the View: 2PP flip label and title are built into the page");

console.log("test-2pp-history: all assertions passed");
