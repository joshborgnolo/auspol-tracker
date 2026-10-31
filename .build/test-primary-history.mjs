/* test-primary-history.mjs – pins the /flows-explained/ "View: Primary votes"
   flip's data end-to-end: data/primary-history.json (built by
   .build/aec-primary-history.py from the committed AEC first-preference
   downloads in .build/aec-flow-src/fpv/ plus its typed 1972–2001 HISTORY
   block), its fold-at-4% contract (user 2026-10-23: "below 4% just displays
   others and above 4% displays as its own points"), and the gen-data
   handoff into the built data asset (window.AUSPOL.primaryHistory). CHECKS:
   1. the JSON's national ALP and Coalition cells recompute from the
      committed caches (vote sums by fixed party-code sets – this file's own
      arithmetic, not the generator's), and sit on the canonical published
      House figures the generator pins (incl. the 2010 Coalition 43.61
      correction – the aus-house-primary-history skill's 43.32 is a
      Wikipedia-propagated typo); the typed era's majors sit on the
      generator's HISTORY_CANON pins (five AEC-record corrections over the
      skill's table: 1977 L/NP 48.11, 1983 L/NP 43.61, 1987 ALP 45.90,
      1996 ALP 38.75, 1998 L/NP 39.51);
   2. the fold's NULL MAP is pinned per named minor across both eras (the
      DLP crosses only in 1972; the Democrats' era is 1977–2001 nationally –
      1993's 3.75 folds – plus a lone NT-senate 2004 cell; One Nation runs
      1998–2001 then returns 2016 Senate/2022 House; Greens first shown
      2001; the United Australia/Palmer family only 2013 and 2022; Xenophon
      only SA 2016–19; Lambie only Tas Senate 2016→), every displayed minor
      cell is >= foldPt,
   and `oth` recombines as the residual of exactly the shown lines per year
   in every view (national, senate, all 16 state cuts);
   3. the built data asset hands the chart the same document;
   4. the AEC division-classification cuts (fed.classes, 2026-10-23 – the
      House's share regrouped by the AEC's own per-election division
      classes; the Senate holds none) sit on the pinned span, copy and
      per-cell figures recomputed from the committed sources, and ride the
      same fold/recombination contract; beside them the ten SEIFA fifths
      (IRSAD's q1..q5 + IEO's e1..e5, 2026-10-24 – each seat filed to a
      fifth of the chamber by its rank on that index at THAT election, the
      ABS's socio-economic index of advantage and disadvantage or its
      index of education and occupation, the most-advantaged seat
      ranked first, thirty seats a fifth and the 151-seat chambers' spare
      to the most-disadvantaged) run the index series' own 2001–2025 span,
      ride their own foldPt 2 and seifa flag with a per-record ix tag,
      their membership probed here from data/division-seifa-indexes.json
      (thirty a fifth, the read rank a permutation, named anchors on both
      indexes) and their cells pinned, ladder-checked and fold-checked
      like the classes';
   5. gen-data's build-time stateElections derivation (2026-10-23, user:
      "what about primary votes for state elections, lower and upper
      houses"): the six assemblies' figures recompute independently from
      data/state-flows.csv (lnp = lib + nat, the fold applying to grn/onp
      alone), the NSW Legislative Council's from the committed NSWEC count
      bank, all on the same fold/recombination contract as the file's.
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
// the typed pre-AEC era (the generator's HISTORY block; no 1972 national
// Senate election, so the senate span starts 1974)
const HIST_YEARS = [1972, 1974, 1975, 1977, 1980, 1983, 1984, 1987, 1990, 1993, 1996, 1998, 2001];
const HIST_SEN_YEARS = HIST_YEARS.filter((y) => y !== 1972);
const STATES = ["nsw", "vic", "qld", "wa", "sa", "tas", "act", "nt"];
/* the explainer menu shows the flow-history short forms ("Federal, NT") -
   never the full name spelt out (2026-10-24, user: "the view dropdown menu
   is inconsistent (eg northen territory vs NT)") */
const STATE_SHORT = { nsw: "NSW", vic: "Vic", qld: "Qld", wa: "WA", sa: "SA", tas: "Tas", act: "ACT", nt: "NT" };
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
// the typed 1972–2001 history prepends the national views exactly; the
// per-state cuts stay the AEC-cache span (no per-state cut before 2004)
assert.deepEqual(FED.years, [...HIST_YEARS, ...AEC_YEARS], "fed years: history prepended to the AEC span");
assert.deepEqual(SEN.years, [...HIST_SEN_YEARS, ...AEC_YEARS], "senate years: history (no 1972) prepended");
STATES.forEach((s) => {
  assert.deepEqual(FED.states[s].years, AEC_YEARS, `${s} house: per-state span starts 2004`);
  assert.deepEqual(SEN.states[s].years, AEC_YEARS, `${s} senate: per-state span starts 2004`);
  assert.equal(FED.states[s].short, STATE_SHORT[s], `${s} house: the menu short label`);
  assert.equal(SEN.states[s].short, STATE_SHORT[s], `${s} senate: the menu short label`);
});

// ---- the AEC division-classification cuts (House only) ---------------------
/* 2026-10-23 (user: "add federal demographic rating breakdowns to primary
   vote view - eg 'Federal, provincial'"): fed.classes regroups each House
   election's divisions by the AEC's own classification of that election
   (data/division-classifications.json; 1996/98/01 divisions counted off the
   legacy hcands files, 2004 on off the dop caches). Divisions never exist
   for the Senate, so fed.sen carries no classes. Menu order, copy and
   per-cell pins below (the figures recompute from the committed sources –
   the generator also asserts the classes' summed ballots recompose the
   national ALP and Coalition shares within 0.05 every year). */
const CLASSES = ["inner", "outer", "provincial", "rural"];
const CLASS_YEARS = [1996, 1998, 2001, ...AEC_YEARS];
/* 2026-10-24 (user: show the ABS SEIFA data beside the AEC's division
   classes in the explainer menu views; decisions: fifths of thirty seats,
   IRSAD first, flows + 2PP + primary — and the IEO index's same five, "do
   what you did for irsad to ieo", the same day): IRSAD's q1..q5 and IEO's
   e1..e5 regroup the same House figures by where each seat's rank on that
   index put it at THAT election – a seat whose standing moved between
   elections moved fifths with it. QUINT_COPY mirrors the shared copy of
   seifa_quintiles.py's INDEX_META meta tuples (label, short, desc) — the
   index rides each record's ix tag; SEIFA_YEARS is the index series' own
   span (the store's 2028 block scores the coming boundaries – never a
   counted history – and neither index has a block before 2001) */
const QUINTS = ["q1", "q2", "q3", "q4", "q5"];
const EOCTAS = ["e1", "e2", "e3", "e4", "e5"];
const RESOS = ["r1", "r2", "r3", "r4", "r5"];
const FIFTHS = [...QUINTS, ...EOCTAS, ...RESOS];
const LANE = { irsad: "q", ieo: "e", ier: "r" };   // index -> its keys' leading letter
const IDX_OF = (id) => Object.keys(LANE).find((ix) => LANE[ix] === id[0]);
const IX_NAME = { irsad: "IRSAD", ieo: "IEO", ier: "IER" };
const SEIFA_YEARS = [2001, ...AEC_YEARS];

/* each index's own span (2026-10-25): IEO and IER open at 1998 (the
   store's APH CIB 4/1998-99 block prints no IRSAD) */
const IX_YEARS = { irsad: SEIFA_YEARS, ieo: [1998, ...SEIFA_YEARS], ier: [1998, ...SEIFA_YEARS] };
const ALL_SEIFA_YEARS = [1998, ...SEIFA_YEARS];
const QUINT_COPY = {
  1: ["Most-advantaged fifth", "Top fifth", "most-advantaged fifth"],
  2: ["Second-most-advantaged fifth", "2nd fifth", "second-most-advantaged fifth"],
  3: ["Middle fifth", "Middle fifth", "middle fifth"],
  4: ["Second-most-disadvantaged fifth", "4th fifth", "second-most-disadvantaged fifth"],
  5: ["Most-disadvantaged fifth", "Bottom fifth", "most-disadvantaged fifth"],
};
assert.ok(FED.classes && !SEN.classes, "fed.classes exists; the Senate holds no classes");
assert.deepEqual(Object.keys(FED.classes), [...CLASSES, ...FIFTHS],
  "the four class cuts, then the IRSAD, IEO and IER fifths, in menu order");
CLASSES.forEach((ck) => assert.equal(FED.classes[ck].seifa, undefined, `${ck}: a class cut carries no seifa flag`));
// the two per-cell readers shared by every pin section below
const nulls = (arr, years) => years.filter((_, i) => arr[i] == null);
const cell = (view, key, year) => view[key][view.years.indexOf(year)];
const CLASS_COPY = {
  inner: ["Inner metropolitan", "inner metro"],
  outer: ["Outer metropolitan", "outer metro"],
  provincial: ["Provincial", "provincial"],
  rural: ["Rural", "rural"],
};
CLASSES.forEach((ck) => {
  const v = FED.classes[ck];
  assert.deepEqual(v.years, CLASS_YEARS, `${ck}: the eleven-classifications span`);
  assert.equal(v.label, CLASS_COPY[ck][0], `${ck} label`);
  assert.equal(v.short, CLASS_COPY[ck][1], `${ck} short`);
  assert.equal(v.elections, `federal elections in ${CLASS_COPY[ck][1]} seats`, `${ck} elections copy`);
});
// the figure pins (each recomputed from the sources during the 2026-10-23
// build: the state of play every class view tells its own way)
assert.equal(cell(FED.classes.provincial, "alp", 2025), 35.19);
assert.equal(cell(FED.classes.provincial, "lnp", 2025), 32.59);
assert.equal(cell(FED.classes.rural, "lnp", 1996), 55.57);
assert.equal(cell(FED.classes.rural, "alp", 1996), 32.19);
assert.equal(cell(FED.classes.inner, "grn", 2025), 16.5);
assert.equal(cell(FED.classes.inner, "ind", 2025), 9.14);
assert.equal(cell(FED.classes.inner, "onp", 1998), 4.83);
assert.equal(cell(FED.classes.inner, "dem", 1996), 6.59);
assert.equal(cell(FED.classes.rural, "onp", 1998), 12.56);
// One Nation's 1998 share rises down the urbanisation ladder
assert.ok(FED.classes.inner.onp[1] < FED.classes.outer.onp[1]
  && FED.classes.outer.onp[1] < FED.classes.provincial.onp[1]
  && FED.classes.provincial.onp[1] < FED.classes.rural.onp[1],
  "1998 ONP: inner < outer < provincial < rural");

// ---- the SEIFA fifths (IRSAD q1..q5, IEO e1..e5, IER r1..r5) ----------
/* shape and copy first (the ix tag names each lane's index), then the
   membership probe (this file's own reading of the seifa store, never
   the writers') and the per-cell pins */
/* the elections whose IRSAD fifths cut on the census-interpolated
   percentile (the store's `_pcti.factors`), and the basis phrase the
   IRSAD lanes' elections copy carries — mirrors
   seifa_quintiles.elections_suffix() on the store's current window. A
   new pcti factor year goes red here: a copy change wanting a human,
   never a silent re-pin */
const SEIFA_DOC = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "division-seifa-indexes.json"), "utf8"));
const INTERP_YEARS = new Set(Object.keys(SEIFA_DOC._pcti.factors).map(Number));
const ELECTIONS_SUFFIX = (ix) => `of seats by ${ix.toUpperCase()}`;
FIFTHS.forEach((q) => {
  const ix = IDX_OF(q);
  const v = FED.classes[q];
  assert.deepEqual(v.years, IX_YEARS[ix], `${q}: the index series' own span`);
  assert.equal(v.seifa, true, `${q}: the seifa flag the renderers gate on`);
  assert.equal(v.ix, ix, `${q}: the index tag`);
  assert.equal(v.foldPt, 2, `${q}: a fifth carries its own 2% fold (thirtieths, not sixteenths)`);
  assert.equal(v.label, QUINT_COPY[q[1]][0], `${q} label`);
  assert.equal(v.short, QUINT_COPY[q[1]][1], `${q} short (the bare positional menu face)`);
  /* every index rides one basis, so the scope line names just the index */
  const wantEls = `federal elections in the ${QUINT_COPY[q[1]][2]} ${ELECTIONS_SUFFIX(ix)}`;
  assert.equal(v.elections, wantEls, `${q} elections copy names the index`);
});
/* each index's advantage-order rank (IRSAD's `rank`, stored
   advantaged-first; the IEO and IER cells' plain ranks print in the
   1 = most-disadvantaged order, reflected n+1−rank) ranks each division
   1..N most-advantaged-first across THAT election's chamber;
   ceil(rank/30) is the fifth, so every fifth is thirty seats and the
   151-seat 2019/2022 chambers' spare lands in the most-disadvantaged
   fifth (user call 2026-10-24). IRSAD alone upgrades to the census-
   INTERPOLATED percentile at the factor years the store ships
   (2013/2016/2019 — user call 2026-10-24: the interpolated basis is the
   default), ranked most-first on the same cut */
const SEIFA = SEIFA_DOC.elections;
const rankAdvOf = (ix, cell, n) => (ix === "irsad" ? cell.irsad.rank : n + 1 - cell[ix].rank);
const fifthOf = (ix, ra) => `${LANE[ix]}${Math.min(Math.floor((ra - 1) / 30) + 1, 5)}`;
// a division's advantage-rank at an interpolation year (pcti, most-first)
const pctiRank = (y, nm) => {
  const blk = SEIFA[String(y)];
  return Object.keys(blk).sort((a, b) => blk[b].irsad.pcti - blk[a].irsad.pcti).indexOf(nm) + 1;
};
ALL_SEIFA_YEARS.forEach((y) => {
  const blk = SEIFA[String(y)];
  assert.ok(blk, `${y}: a seifa block`);
  const names = Object.keys(blk), n = names.length;
  assert.ok(n === 148 || n === 150 || n === 151, `${y}: ${n} divisions (a 148, 150 or 151 seat chamber)`);
  for (const ix of Object.keys(LANE)) {
    if (!IX_YEARS[ix].includes(y)) continue;   // IRSAD has no 1998 block
    const ids = FIFTHS.filter((q) => IDX_OF(q) === ix);
    const sizes = Object.fromEntries(ids.map((q) => [q, 0]));
    /* each division's advantage-ordered rank on THIS year's basis: IRSAD
       at a pcti factor year ranks the interpolated percentile descending
       (highest = advantage-rank 1; distinct, no tie rule); every other
       cell reads the recorded rank */
    let raOf;
    if (INTERP_YEARS.has(y)) {
      const pcts = [];
      names.forEach((nm) => {
        const p = blk[nm][ix].pcti;
        assert.ok(typeof p === "number" && p > 0 && p <= 1, `${y} ${nm}: an interpolated percentile in (0, 1]`);
        pcts.push(p);
      });
      assert.equal(new Set(pcts).size, n, `${y}: the interpolated percentiles are all distinct`);
      raOf = new Map([...names].sort((a, b) => blk[b][ix].pcti - blk[a][ix].pcti).map((nm, i) => [nm, i + 1]));
      /* the interpolation's footprint: twelve seats move fifths at 2013,
         ten at 2019 (the 151-seat spare-seat rung shifts the advantaged-
         first cut points), none at 2016 (its census sat five weeks after
         election day, so pcti ≈ rank); the CD-era lanes cut coarser —
         whole-unit polygon allocation, and 2004/2010's f leans far from
         the measured census (2004 21/14/66 by index, 2007 8/2/12,
         2010 30/8/39) */
      const moved = names.filter((nm) => fifthOf(ix, raOf.get(nm)) !== fifthOf(ix, rankAdvOf(ix, blk[nm], n))).length;
      assert.equal(moved, { irsad: { 2004: 21, 2007: 8, 2010: 30, 2013: 12, 2016: 0, 2019: 10 }, ieo: { 1998: 14, 2004: 14, 2007: 2, 2010: 8, 2013: 8, 2016: 0, 2019: 14 }, ier: { 1998: 36, 2004: 66, 2007: 12, 2010: 39, 2013: 18, 2016: 0, 2019: 18 } }[ix][y], `${y} ${ix}: pcti v rank movement`);
    } else {
      names.forEach((nm) => {
        assert.ok(blk[nm][ix].pcti === undefined, `${y} ${nm}: no pcti outside the factor years`);
      });
      raOf = new Map(names.map((nm) => [nm, rankAdvOf(ix, blk[nm], n)]));
    }
    const ranks = [];
    names.forEach((nm) => {
      const c = blk[nm];
      assert.ok(c[ix] && c[ix].rank != null, `${y} ${nm}: a ${ix} cell`);
      const ra = raOf.get(nm);
      assert.ok(Number.isInteger(ra) && ra >= 1 && ra <= n, `${y} ${nm}: ${ix} rank in 1..${n}`);
      ranks.push(ra);
      sizes[fifthOf(ix, ra)] += 1;
    });
    assert.deepEqual([...ranks].sort((a, b) => a - b), Array.from({ length: n }, (_, i) => i + 1),
      `${y}: ${ix} ranks are a permutation of 1..${n}`);
    const want = {}; ids.forEach((q, i) => { want[q] = i === 4 ? n - 120 : 30; });
    assert.deepEqual(sizes, want, `${y}: thirty seats a ${ix} fifth, the disadvantaged end the 151-seat balance`);
  }
});
// named anchors (the store's own pins against the wrong-index /
// wrong-direction misreads: the read rank's 1 is the MOST advantaged
// seat on either index's read)
assert.equal(fifthOf("irsad", SEIFA["2001"]["Bonython"].irsad.rank), "q5", "2001 Bonython: the most-disadvantaged IRSAD fifth");
assert.equal(fifthOf("irsad", SEIFA["2001"]["North Sydney"].irsad.rank), "q1", "2001 North Sydney: the most-advantaged IRSAD fifth");
assert.equal(fifthOf("irsad", SEIFA["2025"]["Lingiari"].irsad.rank), "q5", "2025 Lingiari: the most-disadvantaged IRSAD fifth");
assert.equal(fifthOf("irsad", SEIFA["2025"]["Banks"].irsad.rank), "q2", "2025 Banks: the second-most-advantaged IRSAD fifth");
assert.equal(fifthOf("ieo", rankAdvOf("ieo", SEIFA["2001"]["Bonython"], 150)), "e5", "2001 Bonython: the most-disadvantaged IEO fifth");
assert.equal(fifthOf("ieo", rankAdvOf("ieo", SEIFA["2001"]["North Sydney"], 150)), "e1", "2001 North Sydney: the most-advantaged IEO fifth");
// the IER lane's own anchors (the pins seifa_quintiles.py gates the
// generator on): Wide Bay, not Bonython, is 2001's most-disadvantaged
// IER seat; the 2025 Barker/Swan pair is the boundary pin
assert.equal(fifthOf("ier", rankAdvOf("ier", SEIFA["2001"]["Wide Bay"], 150)), "r5", "2001 Wide Bay: the most-disadvantaged IER fifth");
assert.equal(fifthOf("ier", rankAdvOf("ier", SEIFA["2001"]["North Sydney"], 150)), "r1", "2001 North Sydney: the most-advantaged IER fifth");
assert.equal(fifthOf("ier", rankAdvOf("ier", SEIFA["2025"]["Lingiari"], 150)), "r5", "2025 Lingiari: the most-disadvantaged IER fifth (as IRSAD's, unlike IEO's fourth)");
assert.equal(fifthOf("ier", rankAdvOf("ier", SEIFA["2025"]["Banks"], 150)), "r2", "2025 Banks: the second-most-advantaged IER fifth");
assert.equal(fifthOf("ier", rankAdvOf("ier", SEIFA["2025"]["Barker"], 150)), "r5", "2025 Barker: adv-rank 121 opens the most-disadvantaged IER fifth");
assert.equal(fifthOf("ier", rankAdvOf("ier", SEIFA["2025"]["Swan"], 150)), "r4", "2025 Swan: adv-rank 120 closes the second-most-disadvantaged IER fifth");
assert.equal(fifthOf("ier", rankAdvOf("ier", SEIFA["2025"]["Mitchell"], 150)), "r1", "2025 Mitchell: the most-advantaged IER fifth");
// the pcti lane's own anchors (the interpolation years' ends of the
// ladder, cut on the percentile itself): Lingiari closes the
// most-disadvantaged fifth at all three, Spence's 151st rank is the
// 2019 spare, and Bradfield/Wentworth head the most-advantaged
assert.equal(fifthOf("irsad", pctiRank(2013, "Lingiari")), "q5", "2013 Lingiari: the most-disadvantaged IRSAD fifth (interpolated)");
assert.equal(fifthOf("irsad", pctiRank(2013, "Bradfield")), "q1", "2013 Bradfield: the most-advantaged IRSAD fifth (interpolated)");
assert.equal(fifthOf("irsad", pctiRank(2016, "Lingiari")), "q5", "2016 Lingiari: the most-disadvantaged IRSAD fifth (interpolated)");
assert.equal(fifthOf("irsad", pctiRank(2016, "Wentworth")), "q1", "2016 Wentworth: the most-advantaged IRSAD fifth (interpolated)");
assert.equal(fifthOf("irsad", pctiRank(2019, "Spence")), "q5", "2019 Spence: the most-disadvantaged IRSAD fifth (the 151-seat spare, interpolated)");
assert.equal(fifthOf("irsad", pctiRank(2019, "Wentworth")), "q1", "2019 Wentworth: the most-advantaged IRSAD fifth (interpolated)");
// per-cell pins (recomputed from the committed sources at build; the
// writer's own join and recomposition asserts gate the lane every run)
assert.equal(cell(FED.classes.q5, "alp", 2025), 29.47);
assert.equal(cell(FED.classes.q2, "alp", 2025), 38.99);
assert.equal(cell(FED.classes.q1, "alp", 2025), 33.88);
assert.equal(cell(FED.classes.q5, "lnp", 2001), 41.2);
assert.equal(cell(FED.classes.q1, "lnp", 2001), 46.85);
assert.equal(cell(FED.classes.q5, "grn", 2001), 3.38);
assert.equal(cell(FED.classes.q1, "grn", 2025), 15.84);
assert.equal(cell(FED.classes.q5, "onp", 2025), 9.18);
assert.equal(cell(FED.classes.q1, "ind", 2025), 11.63);
assert.equal(cell(FED.classes.q1, "dem", 2001), 6.81);
// 2025 told across the fifths: Labor rises to the second-most-advantaged
// fifth then falls down the ladder to the most-disadvantaged (the
// most-advantaged fifth is the teal seats'); the Greens fall with
// disadvantage and One Nation rises with it
assert.ok(FED.classes.q1.alp[8] < FED.classes.q2.alp[8] && FED.classes.q2.alp[8] > FED.classes.q3.alp[8]
  && FED.classes.q3.alp[8] > FED.classes.q4.alp[8] && FED.classes.q4.alp[8] > FED.classes.q5.alp[8],
  "2025 ALP: rises to q2 then falls down the ladder");
assert.ok(FED.classes.q1.grn[8] > FED.classes.q2.grn[8] && FED.classes.q2.grn[8] > FED.classes.q3.grn[8]
  && FED.classes.q3.grn[8] > FED.classes.q4.grn[8] && FED.classes.q4.grn[8] > FED.classes.q5.grn[8],
  "2025 GRN: falls with disadvantage, most-advantaged to most-disadvantaged");
assert.ok(FED.classes.q1.onp[8] < FED.classes.q2.onp[8] && FED.classes.q2.onp[8] < FED.classes.q3.onp[8]
  && FED.classes.q3.onp[8] < FED.classes.q4.onp[8] && FED.classes.q4.onp[8] < FED.classes.q5.onp[8],
  "2025 ONP: rises with disadvantage");
/* the tenth-fold at work: q1's One Nation 2022 (2.10) and 2025 (2.69),
   q2's One Nation 2001 (2.98) and q4's Democrats 2001 (3.87) all display
   at 2% where the rest of the page's 4% default would null them */
assert.equal(FED.classes.q1.onp[7], 2.1, "q1 ONP 2022: under 4%, shown at the fifths' fold");
assert.equal(FED.classes.q1.onp[8], 2.69, "q1 ONP 2025: under 4%, shown");
assert.equal(FED.classes.q2.onp[0], 2.98, "q2 ONP 2001: under 4%, shown");
assert.equal(FED.classes.q4.dem[0], 3.87, "q4 dem 2001: under 4%, shown");

// ---- the IEO fifths' own per-cell pins (recomputed from the committed
//      sources at the same build) --------------------------------------
assert.equal(cell(FED.classes.e5, "alp", 2025), 28.62);
assert.equal(cell(FED.classes.e1, "alp", 2025), 34.45);
assert.equal(cell(FED.classes.e5, "alp", 2001), 40.21);
assert.equal(cell(FED.classes.e5, "lnp", 2001), 39.25);
assert.equal(cell(FED.classes.e1, "lnp", 2001), 46.64);
assert.equal(cell(FED.classes.e5, "grn", 2001), 3.09);
assert.equal(cell(FED.classes.e1, "grn", 2025), 16.83);
assert.equal(cell(FED.classes.e5, "onp", 2025), 10.44);
assert.equal(cell(FED.classes.e1, "ind", 2025), 11.46);
assert.equal(cell(FED.classes.e1, "dem", 2001), 7.79);
// 2025 told across the IEO fifths: Labor rises to e2 then falls down the
// ladder, the Greens fall with disadvantage and One Nation rises with it —
// the same story as IRSAD's, by the education-and-occupation read
assert.ok(cell(FED.classes.e1, "alp", 2025) < cell(FED.classes.e2, "alp", 2025) && cell(FED.classes.e2, "alp", 2025) > cell(FED.classes.e3, "alp", 2025)
  && cell(FED.classes.e3, "alp", 2025) > cell(FED.classes.e4, "alp", 2025) && cell(FED.classes.e4, "alp", 2025) > cell(FED.classes.e5, "alp", 2025),
  "2025 ALP (IEO): rises to e2 then falls down the ladder");
assert.ok(cell(FED.classes.e1, "grn", 2025) > cell(FED.classes.e2, "grn", 2025) && cell(FED.classes.e2, "grn", 2025) > cell(FED.classes.e3, "grn", 2025)
  && cell(FED.classes.e3, "grn", 2025) > cell(FED.classes.e4, "grn", 2025) && cell(FED.classes.e4, "grn", 2025) > cell(FED.classes.e5, "grn", 2025),
  "2025 GRN (IEO): falls with disadvantage, most-advantaged to most-disadvantaged");
assert.ok(cell(FED.classes.e1, "onp", 2025) < cell(FED.classes.e2, "onp", 2025) && cell(FED.classes.e2, "onp", 2025) < cell(FED.classes.e3, "onp", 2025)
  && cell(FED.classes.e3, "onp", 2025) < cell(FED.classes.e4, "onp", 2025) && cell(FED.classes.e4, "onp", 2025) < cell(FED.classes.e5, "onp", 2025),
  "2025 ONP (IEO): rises with disadvantage");
// the tenth-fold at work on the IEO side too: e1's One Nation 2022 (2.0)
// and 2025 (2.72) display at 2% where the page default would null them
assert.equal(cell(FED.classes.e1, "onp", 2022), 2, "e1 ONP 2022: under 4%, shown at the fifths' fold");
assert.equal(cell(FED.classes.e1, "onp", 2025), 2.72, "e1 ONP 2025: under 4%, shown");

// ---- the IER fifths' own per-cell pins (recomputed from the committed
//      sources at the same build) --------------------------------------
assert.equal(cell(FED.classes.r1, "alp", 2025), 31.3);
assert.equal(cell(FED.classes.r5, "alp", 2025), 32.53);
assert.equal(cell(FED.classes.r1, "alp", 2001), 34.01);
assert.equal(cell(FED.classes.r1, "lnp", 2001), 46.84);
assert.equal(cell(FED.classes.r5, "lnp", 2001), 45.7);
assert.equal(cell(FED.classes.r5, "grn", 2001), 4.08);
assert.equal(cell(FED.classes.r1, "grn", 2025), 11.37);
assert.equal(cell(FED.classes.r5, "onp", 2025), 7.21);
assert.equal(cell(FED.classes.r1, "ind", 2025), 10.59);
assert.equal(cell(FED.classes.r1, "dem", 2001), 6.85);
// 2025 told across the IER fifths: economic resources draw no clean Labor
// ladder (Labor peaks in the second-most-disadvantaged fifth at 37.75 and
// its most-advantaged cell is the lowest, 31.3) — but the Coalition's and
// One Nation's ladders are as strict as the other two indexes'
assert.ok(cell(FED.classes.r1, "lnp", 2025) > cell(FED.classes.r5, "lnp", 2025) && cell(FED.classes.r5, "lnp", 2025) > cell(FED.classes.r4, "lnp", 2025)
  && cell(FED.classes.r1, "lnp", 2025) - cell(FED.classes.r4, "lnp", 2025) > 6,
  "2025 L/NP (IER): strongest in the most-advantaged fifth");
assert.ok(cell(FED.classes.r1, "onp", 2025) < cell(FED.classes.r2, "onp", 2025) && cell(FED.classes.r2, "onp", 2025) < cell(FED.classes.r3, "onp", 2025)
  && cell(FED.classes.r3, "onp", 2025) < cell(FED.classes.r4, "onp", 2025) && cell(FED.classes.r4, "onp", 2025) < cell(FED.classes.r5, "onp", 2025),
  "2025 ONP (IER): rises with disadvantage");
assert.ok(Math.min(cell(FED.classes.r4, "grn", 2025), cell(FED.classes.r5, "grn", 2025)) > Math.max(cell(FED.classes.r1, "grn", 2025), cell(FED.classes.r2, "grn", 2025), cell(FED.classes.r3, "grn", 2025)),
  "2025 GRN (IER): strongest in the two most-disadvantaged fifths");
// the tenth-fold at work on the IER side too: r1's One Nation 2022 (3.74)
// displays at 2% where the page default would null it (the 151-seat year's
// spare reallocates the disadvantaged fifth — the dis-first store's r5 cell
// is NOT this pin's mirror)
assert.equal(cell(FED.classes.r1, "onp", 2022), 3.74, "r1 ONP 2022: under 4%, shown at the fifths' fold");


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

// ---- typed 1972–2001 era: pinned majors ------------------------------------
/* the generator's HISTORY_CANON: the aus-house-primary-history skill table
   with five AEC-record corrections, votes-verified 2026-10-23 */
const CANON_HOUSE_HISTORY = {
  1972: [49.59, 41.48], 1974: [49.3, 45.73], 1975: [42.84, 53.05],
  1977: [39.65, 48.11], 1980: [45.15, 46.4], 1983: [49.48, 43.61],
  1984: [47.55, 45.01], 1987: [45.9, 45.9], 1990: [39.44, 43.46],
  1993: [44.92, 44.27], 1996: [38.75, 47.25], 1998: [40.1, 39.51],
  2001: [37.84, 43.01],
};
HIST_YEARS.forEach((y) => {
  const i = FED.years.indexOf(y);
  assert.ok(Math.abs(FED.alp[i] - CANON_HOUSE_HISTORY[y][0]) <= 0.005,
    `${y} fed alp: history pin (${FED.alp[i]} v ${CANON_HOUSE_HISTORY[y][0]})`);
  assert.ok(Math.abs(FED.lnp[i] - CANON_HOUSE_HISTORY[y][1]) <= 0.005,
    `${y} fed lnp: history pin (${FED.lnp[i]} v ${CANON_HOUSE_HISTORY[y][1]})`);
});

// ---- the fold's null map, pinned per named minor ---------------------------
// House: One Nation's two runs (1998–2001, then 2022 on); UAP family only
// 2013 and 2022; IND only 2022 on (its typed-era shares all sit sub-fold)
assert.deepEqual(nulls(FED.onp, FED.years),
  [...HIST_YEARS.filter((y) => y < 1998), ...AEC_YEARS.filter((y) => y < 2022)], "house ONP: 1998–2001 + 2022 on");
assert.deepEqual(nulls(FED.uap, FED.years),
  [...HIST_YEARS, ...AEC_YEARS.filter((y) => ![2013, 2022].includes(y))], "house UAP: 2013 & 2022 only");
assert.deepEqual(nulls(FED.ind, FED.years),
  [...HIST_YEARS, ...AEC_YEARS.filter((y) => y < 2022)], "house IND: 2022–25 only");
assert.equal(cell(FED, "onp", 1998), 8.43); assert.equal(cell(FED, "onp", 2001), 4.34);
assert.equal(cell(FED, "onp", 2022), 4.96); assert.equal(cell(FED, "onp", 2025), 6.4);
assert.equal(cell(FED, "uap", 2013), 5.49); assert.equal(cell(FED, "uap", 2022), 4.12);
assert.equal(cell(FED, "ind", 2022), 5.3); assert.equal(cell(FED, "ind", 2025), 7.36);
// Senate: One Nation 1998/2001 then 2016 on, UAP 2013 alone, and NO
// ind/dlp/xnt/jln lines (the typed era's Democrats do surface - below)
assert.deepEqual(nulls(SEN.onp, SEN.years),
  [...HIST_SEN_YEARS.filter((y) => y < 1998), ...AEC_YEARS.filter((y) => y < 2016)], "senate ONP: 1998, 2001, 2016 on");
assert.deepEqual(nulls(SEN.uap, SEN.years),
  [...HIST_SEN_YEARS, ...AEC_YEARS.filter((y) => y !== 2013)], "senate UAP: 2013 only");
assert.equal(cell(SEN, "onp", 1998), 8.99); assert.equal(cell(SEN, "onp", 2001), 5.54);
assert.equal(cell(SEN, "onp", 2016), 4.28); assert.equal(cell(SEN, "uap", 2013), 4.91);
["ind", "dlp", "xnt", "jln"].forEach((k) => assert.equal(SEN[k], undefined, `no national senate ${k} line`));
// state cuts: Xenophon SA-only 2016–19; Lambie Tas-senate-only 2016 on;
// Democrats nowhere >= fold across the cache span but for one NT-senate cell
assert.deepEqual(FED.states.sa.xnt, [null, null, null, null, 21.26, 4.38, null, null], "SA xnt: 2016–19 only");
assert.ok(STATES.filter((s) => s !== "sa").every((s) => FED.states[s].xnt === undefined), "xnt house cuts: SA only");
assert.deepEqual(SEN.states.tas.jln, [null, null, null, null, 8.3, 8.92, 8.64, 7.28], "Tas senate jln: 2016 on");
assert.ok(STATES.filter((s) => s !== "tas").every((s) => SEN.states[s].jln === undefined), "jln senate cuts: Tas only");
assert.deepEqual(SEN.states.qld.onp, [null, 4.37, null, null, 9.19, 10.27, 7.4, 7.13], "Qld senate onp cells");
// the Democrats cross the fold exactly once in the whole cache span
// (4.73% NT senate 2004) and DLP never does
assert.deepEqual(SEN.states.nt.dem, [4.73, null, null, null, null, null, null, null], "NT senate dem: 2004 alone");
// over the whole document the Democrats live in twelve views (the typed
// era's two national views + NT senate 2004 + the nine class-and-fifth
// cuts' 2001-era cells) and the DLP in one
const allViews = [FED, SEN, ...STATES.map((s) => FED.states[s]), ...STATES.map((s) => SEN.states[s]),
  ...Object.values(FED.classes)];
allViews.forEach((v) => {
  if (v.dem != null) assert.ok(v === FED || v === SEN || v === SEN.states.nt
    || Object.values(FED.classes).includes(v),
    `${v.label}: dem lines are the typed-era national views + NT senate 2004 + the class and fifth cuts' typed-era cells`);
  if (v.dlp != null) assert.equal(v, FED, `${v.label}: dlp is the national house's 1972 row alone`);
});

// ---- the typed era's minor lines: each family's era boundary -----------------
// the DLP's only national fold crossing (5.25% in 1972); the Democrats run
// 1977–2001 (1993's 3.75 folds); the Greens first clear the fold in 2001;
// oth is always the residual of exactly the shown lines (folded families in)
assert.equal(cell(FED, "dlp", 1972), 5.25);
assert.deepEqual(nulls(FED.dlp, FED.years), FED.years.filter((y) => y !== 1972), "house dlp: 1972 alone");
assert.deepEqual(nulls(FED.dem, FED.years), [1972, 1974, 1975, 1993, ...AEC_YEARS], "house dem: 1977–2001, 1993 folded");
assert.equal(cell(FED, "dem", 1990), 11.26);
assert.deepEqual(nulls(FED.grn, FED.years), HIST_YEARS.filter((y) => y !== 2001), "house grn: first shown 2001");
assert.equal(cell(FED, "grn", 2001), 4.96);
assert.deepEqual(nulls(SEN.dem, SEN.years), [1974, 1975, ...AEC_YEARS], "senate dem: 1977–2001");
assert.equal(cell(SEN, "dem", 1977), 11.13); assert.equal(cell(SEN, "dem", 1990), 12.63);
assert.deepEqual(nulls(SEN.grn, SEN.years), HIST_SEN_YEARS.filter((y) => y !== 2001), "senate grn: first shown 2001");
assert.equal(cell(SEN, "grn", 2001), 4.94);
assert.equal(cell(FED, "oth", 1972), 3.68); // 2.72 table residual + ind 0.96 folded
assert.equal(cell(SEN, "oth", 1987), 6.67); // 4.16 table residual + dlp/grn/ind folded
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
  // a record may carry its own fold (the SEIFA fifths ride foldPt 2 – a
  // thirtieth of the chamber would null buckets at the page's 4% default)
  const foldHere = typeof v.foldPt === "number" ? v.foldPt : doc.foldPt;
  if (v.foldPt != null) assert.ok(v.seifa === true && v.foldPt < doc.foldPt,
    `${v.label}: a bespoke fold belongs only to a SEIFA fifth, below the page fold`);
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
      assert.ok(x >= foldHere - 0.005 && x <= 100, `${v.label} ${k} ${v.years[i]}: at or above the view's fold (${x})`);
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
assert.ok(/if \(primaryHistory && !JUR\)/.test(gen) && /primaryHistory\.stateElections = ste/.test(gen),
  "stateElections is gen-data's build-time derivation, federal-only like the flow history's (the Vic build's JUR path skips it)");
assert.ok(/validatePrimaryHistory\(\)/.test(fs.readFileSync(
  path.join(ROOT, ".build", "newtracker", "validate.mjs"), "utf8")), "validate.mjs checks primaryHistory");
const tmpl = fs.readFileSync(path.join(ROOT, ".build", "newtracker", "template.html"), "utf8");
["dem", "uap", "xnt", "jln", "dlp", "ind"].forEach((k) => {
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
const { stateElections: PH_STE_RAW, ...assetRest } = PH;
const wanted = { ...doc };
delete wanted._comment;
// the vm realm's Array/Object prototypes differ – re-serialise before comparing
assert.deepEqual(JSON.parse(JSON.stringify(assetRest)), wanted,
  "the asset carries the data file verbatim (the state elections ride beside it)");
const PH_STE = PH_STE_RAW && JSON.parse(JSON.stringify(PH_STE_RAW));

// ---- stateElections: the six assemblies + the banked Legislative Councils ----
/* 2026-10-23 (user: "what about primary votes for state elections, lower and
   upper houses"): gen-data derives these banks at BUILD time; the data file
   knows nothing of them. The assemblies' cells recompute independently from
   the state-flow CSV here (the parser's committed prim_share figures; lnp =
   lib + nat – Queensland's pre-merger years carry both rows, the merged
   years zero nat), the fold is the file's own 4% applied to grn/onp alone,
   and the Council's family shares recompute from the NSWEC's committed
   ballot-level count bank (above-the-line papers, as the flows side's). */
assert.ok(PH_STE && typeof PH_STE === "object", "the asset carries the state-election primary banks");
assert.deepEqual(Object.keys(PH_STE), ["vic", "wa", "sa", "qld", "nt", "nsw"],
  "the six assemblies, in the flow bank's menu order");
const STE_YEARS = {
  nsw: [2015, 2019, 2023],
  vic: [2006, 2010, 2014, 2018, 2022],
  wa: [2001, 2005, 2008, 2013, 2017, 2021, 2025],
  sa: [2022, 2026],
  qld: [2004, 2006, 2009, 2012, 2015, 2017, 2020, 2024],
  nt: [2016, 2020, 2024],
};
const stCsv = {};
fs.readFileSync(path.join(ROOT, "data", "state-flows.csv"), "utf8")
  .split(/\r?\n/).slice(1).forEach((ln) => {
    if (!ln.trim()) return;
    const c = ln.split(",");
    ((stCsv[c[0]] ||= {})[+c[1]] ||= {})[c[2]] = +c[4];
  });
const r2p = (v) => Math.round(v * 100) / 100;
Object.keys(STE_YEARS).forEach((jk) => {
  const v = PH_STE[jk];
  assert.deepEqual(v.years, STE_YEARS[jk], `${jk}: the covered election years`);
  assert.ok(v.label && v.short && v.elections && v.srcLine, `${jk}: label/short/elections/srcLine copy`);
  STE_YEARS[jk].forEach((y, i) => {
    const row = stCsv[jk][y];
    const g = row.grn || 0, o = row.onp || 0;
    assert.equal(v.alp[i], r2p(row.alp || 0), `${jk} ${y} alp`);
    assert.equal(v.lnp[i], r2p((row.lib || 0) + (row.nat || 0)), `${jk} ${y} lnp = lib + nat`);
    assert.equal(v.grn[i], g >= 4 ? r2p(g) : null, `${jk} ${y} grn ${g >= 4 ? "shown" : "folds"}`);
    assert.equal(v.onp[i], o >= 4 ? r2p(o) : null, `${jk} ${y} onp ${o >= 4 ? "shown" : "folds"}`);
    assert.equal(v.oth[i], r2p((row.oth || 0) + (g >= 4 ? 0 : g) + (o >= 4 ? 0 : o)), `${jk} ${y} oth = others + folds`);
    ["alp", "lnp", "oth"].forEach((k) => assert.ok(typeof v[k][i] === "number", `${jk} ${y} ${k}: always drawn`));
    const shown = v.alp[i] + v.lnp[i] + (v.grn[i] ?? 0) + (v.onp[i] ?? 0) + v.oth[i];
    assert.ok(Math.abs(shown - 100) <= 0.06, `${jk} ${y}: lines + oth recombine (${shown.toFixed(2)})`);
  });
  // only the views' own keys – the national minor families never leak in
  const surplus = Object.keys(v).filter((k) =>
    !["label", "short", "elections", "srcLine", "years", "alp", "lnp", "grn", "onp", "oth", "sen"].includes(k));
  assert.deepEqual(surplus, [], `${jk}: no keys beside the bank's own`);
});
/* canonical typed pins (a source shift still has to out-argue these – the
   recompute above and gen-data read the same files) */
const cellSt = (jk, key, year) => PH_STE[jk][key][PH_STE[jk].years.indexOf(year)];
assert.equal(cellSt("qld", "lnp", 2004), 35.3, "qld 2004 lnp: the pre-merger Liberal + Nationals sum");
assert.equal(cellSt("qld", "lnp", 2009), 41.6, "qld 2009 lnp: the merged LNP rides lib alone");
assert.equal(cellSt("nt", "lnp", 2024), 48.89, "nt 2024 lnp: the CLP whole");
assert.equal(cellSt("wa", "onp", 2021), null, "wa 2021 onp folds (1.26%)");
assert.equal(cellSt("wa", "onp", 2025), 4, "wa 2025 onp stands (4.0036%)");
assert.equal(cellSt("wa", "oth", 2021), 7.86, "wa 2021 oth absorbs the fold");
assert.equal(cellSt("nt", "grn", 2016), null, "nt 2016 grn folds (2.87%)");
assert.equal(cellSt("nt", "oth", 2016), 26, "nt 2016 oth absorbs the fold");
assert.equal(cellSt("nsw", "lnp", 2015), 45.63, "nsw 2015 lnp: Liberal + Nationals");
assert.equal(cellSt("sa", "onp", 2026), 22.88, "sa 2026 onp: the big debut");
assert.equal(cellSt("vic", "alp", 2006), 43.06, "vic 2006 alp: Bracks's last");

// the NSW Legislative Council: banked beside the Assembly's exactly as the
// flow side banks FH.nsw.sen; the same committed NSWEC counts, ATL papers
const LC = PH_STE.nsw.sen;
assert.ok(LC, "the NSW Legislative Council view banks beside the Assembly's");
assert.deepEqual({ label: LC.label, short: LC.short, elections: LC.elections, lc: LC.lc },
  { label: "NSW Legislative Council", short: "NSW LC", elections: "NSW Legislative Council elections", lc: true },
  "the Council view's copy and marker");
assert.ok(!PH_STE.nsw.senOn, "no One Nation pair cut on the primary side");
assert.deepEqual(LC.years, [2011, 2015, 2019, 2023], "the Council's four ballot-record elections");
const lcCounts = JSON.parse(fs.readFileSync(path.join(ROOT, ".build", "nswec-lc-flow-src", "counts.json"), "utf8"));
const fam = (y, k) => ((lcCounts.events[y].atlByFamily || {})[k] || 0) / lcCounts.events[y].atl * 100;
LC.years.forEach((y, i) => {
  assert.equal(LC.alp[i], r2p(fam(y, "ALP")), `LC ${y} ALP share of the ATL papers`);
  assert.equal(LC.lnp[i], r2p(fam(y, "COAL")), `LC ${y} Coalition share of the ATL papers`);
  assert.equal(LC.grn[i], r2p(fam(y, "GRN")), `LC ${y} Greens share (never sub-fold)`);
  const p = fam(y, "PHON");
  assert.equal(LC.onp[i], p >= 4 ? r2p(p) : null, `LC ${y} One Nation ${p >= 4 ? "shown" : "no Council group"}`);
  const shown = LC.alp[i] + LC.lnp[i] + LC.grn[i] + (LC.onp[i] ?? 0) + LC.oth[i];
  assert.ok(Math.abs(shown - 100) <= 0.06, `LC ${y}: ATL families + oth recombine (${shown.toFixed(2)})`);
});
assert.deepEqual(LC.onp, [null, null, r2p(fam(2019, "PHON")), r2p(fam(2023, "PHON"))],
  "One Nation ran no Council group in 2011 or 2015: nulls, never zeros");
// its typed pins (the count bank is committed, but these stand against it)
assert.equal(cellSt("nsw", "alp", 2019), 33.31, "assembly nsw 2019 alp (the Council's twin guards the file)");
assert.equal(LC.lnp[0], 48.28, "LC 2011 Coalition: the O'Farrell landslide's ATL papers");
assert.equal(LC.oth[2], 18.48, "LC 2019 Others share of ATL");

// the Vic, SA and WA Legislative Councils (2026-10-24, user: "why only nsw
// state upper house?" → "yes"): full-formal banks, parsed per commission
// into .build/state-lc-primaries/<jur>.json – byFamily shares of EVERY
// formal first preference, no ATL qualifier. The shares recompute here
// from the committed banks exactly as the assemblies recompute from the
// flow CSV; the fold is the same 4%, grn/onp alone.
const LC_FULL = {
  vic: { short: "Vic LC", label: "Victorian Legislative Council", srcLine: "the Victorian Electoral Commission’s official results" },
  sa: { short: "SA LC", label: "South Australian Legislative Council", srcLine: "the Electoral Commission SA’s official results" },
  wa: { short: "WA LC", label: "Western Australian Legislative Council", srcLine: "the Western Australian Electoral Commission’s official results" },
};
for (const [jk, meta] of Object.entries(LC_FULL)) {
  const S = PH_STE[jk].sen;
  assert.ok(S, `${jk}: the Legislative Council view banks beside the Assembly's`);
  assert.equal(S.short, meta.short, `${jk} LC: short name`);
  assert.equal(S.label, meta.label, `${jk} LC: label`);
  assert.equal(S.elections, meta.label + " elections", `${jk} LC: elections wording`);
  assert.equal(S.srcLine, meta.srcLine, `${jk} LC: the commission's credit`);
  assert.equal(S.lc, true, `${jk} LC: the lc marker`);
  assert.ok(!PH_STE[jk].senOn, `${jk}: no One Nation pair cut on the primary side`);
  const bank = JSON.parse(fs.readFileSync(path.join(ROOT, ".build", "state-lc-primaries", jk + ".json"), "utf8"));
  const years = Object.keys(bank.events).map(Number).sort((a, b) => a - b);
  assert.deepEqual(S.years, years, `${jk} LC: the banked election years`);
  const sfam = (y, k) => ((bank.events[y].byFamily || {})[k] || 0) / bank.events[y].formal * 100;
  S.years.forEach((y, i) => {
    assert.equal(S.alp[i], r2p(sfam(y, "ALP")), `${jk} LC ${y} ALP share of the formal vote`);
    assert.equal(S.lnp[i], r2p(sfam(y, "COAL")), `${jk} LC ${y} Coalition share of the formal vote`);
    const g = sfam(y, "GRN"), p = sfam(y, "ONP");
    assert.equal(S.grn[i], g >= 4 ? r2p(g) : null, `${jk} LC ${y} Greens ${g >= 4 ? "shown" : "fold"}`);
    assert.equal(S.onp[i], p >= 4 ? r2p(p) : null, `${jk} LC ${y} One Nation ${p >= 4 ? "shown" : "folds or no ballot line"}`);
    const shown = S.alp[i] + S.lnp[i] + (S.grn[i] ?? 0) + (S.onp[i] ?? 0) + S.oth[i];
    assert.ok(Math.abs(shown - 100) <= 0.06, `${jk} LC ${y}: families + oth recombine (${shown.toFixed(2)})`);
    for (const k of ["alp", "lnp", "grn", "onp", "oth"]) {
      const v = S[k][i];
      assert.ok(v === null || Math.abs(v) >= 0.01 || v === 0, `${jk} LC ${y} ${k}: no phantom near-zero`);
    }
  });
}
// their typed pins (the banks are committed; these stand against a silent
// re-parse or a family-map slip)
const cellLc = (jk, key, year) => PH_STE[jk].sen[key][PH_STE[jk].sen.years.indexOf(year)];
assert.equal(cellLc("vic", "alp", 2006), 41.45, "vic LC 2006 alp: Bracks's last");
assert.equal(cellLc("vic", "oth", 2018), 22.09, "vic LC 2018 oth: the minor-party ballot");
assert.equal(cellLc("vic", "onp", 2022), null, "vic LC 2022 onp folds (2.04%)");
assert.equal(cellLc("sa", "onp", 2022), 4.23, "sa LC 2022 onp stands (just over the fold)");
assert.equal(cellLc("sa", "onp", 2026), 24.43, "sa LC 2026 onp: the surge");
assert.equal(cellLc("sa", "lnp", 2026), 18.17, "sa LC 2026 lnp: the collapse");
assert.equal(cellLc("wa", "onp", 2001), 10.68, "wa LC 2001 onp: One Nation's debut");
assert.equal(cellLc("wa", "onp", 2005), null, "wa LC 2005 onp: One Nation (WA)'s split books OTHER, never PHON's line");
assert.equal(cellLc("wa", "onp", 2025), null, "wa LC 2025 onp folds (3.82%)");
assert.equal(cellLc("wa", "alp", 2021), 60.34, "wa LC 2021 alp: the McGowan landslide");
assert.equal(cellLc("wa", "lnp", 2013), 52.51, "wa LC 2013 lnp: Liberal + Nationals");

// ---- the View flip's renderer wiring shipped in the served chunks ---------
/* build.mjs externalises the app as hashed chunks under assets/js (inlined
   before 059c2621); the wiring is asserted on the chunks the page actually
   loads – the uuid-named rd-allpolls renderer carries both the flip label
   and the component wiring */
const jsChunksDir = path.join(ROOT, "assets", "js");
const jsChunks = fs.readdirSync(jsChunksDir)
  .filter((f) => f.endsWith(".js"))
  .map((f) => fs.readFileSync(path.join(jsChunksDir, f), "utf8"));
assert.ok(jsChunks.some((s) => s.includes("Primary votes") && s.includes("ExplainedPrimaryChart") && s.includes("primaryHistory")),
  "the primary-history view wiring (flip label, ExplainedPrimaryChart) is built into a served js chunk");

console.log("test-primary-history: all assertions passed");
