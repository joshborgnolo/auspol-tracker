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
   2. State and class cells recompute from the committed AEC counts (this
      file's own arithmetic: the tppdiv downloads 2004–2025, extended to
      1996 by the statistics packs' HTPP-by-place tables htpp-1996/1998/
      2001.txt - per-division ALP/Coalition vote sums by state, or by the
      division-classifications.json blocks grouped per election), span
      exactly 1996–2025 (the AEC's floor and ceiling: 1993's table counts
      informal votes only), and every emitted pair sums to 100 (the file
      emits Labor's cell; the Coalition cell is by construction 100 minus
      it). 1998 counts 147 divisions: Newcastle's final pair ran Labor v
      independent, so the AEC's own table omits it.
   3. The IRSAD fifths ride the SAME classes bank after the four classes
      (q1..q5, seifa: true): the same per-division counts regrouped by
      data/division-seifa-indexes.json's rankDis (1 = most disadvantaged;
      thirty seats a fifth, q5 taking the 151-seat years' spare), on the
      index series' own 2001–2025 span (2001 via the HTPP table). This
      probe recomputes the membership from the seifa store's OWN cells and
      re-sums the downloads' counts, never seifa_quintiles.py's answer.
   4. The story pins hold: the canonical records' extremes, the urban-
      ladder readings behind "Federal, inner metro" & "Federal, rural",
      and the fifths' 2025 ladder (most-disadvantaged 47.96 to most-
      advantaged 59.08).
   5. fed.sen is the IMPLIED Senate two-party (user 2026-10-24: "add House:
      Lower ⇄ to 2pp view (adding upper house data)") - an estimate, never
      a count: the AEC tallies no two-party figure for the Senate. This
      probe's own sums over the committed ATL tallies (.build/aec-flow-src/
      senate-atl/counts.json, five family rows {ALP,COAL,GRN,PHON,OTHER},
      national and the eight states) - 100·toALP/(toALP+toCOAL) - reproduce
      every cell to <0.005; the view carries implied: true, spans exactly
      the four post-GVT events 2016–2025 and no classes (the Senate has no
      divisions), and the constant y axis prices its cells too so the
      House: flip never moves the band.
      5b. nswLc is its ONE state-council twin (user 2026-10-24: "what about
      state-level upper house 2pps" / "add it") - the only state upper
      house whose ballot record can be counted: the committed NSWEC
      family tallies (.build/nswec-lc-flow-src/counts.json, the same
      five family rows) recompose its four cells (2011–2023) by the same
      estimand, and the view is a top-level bank - it carries neither
      states nor classes.
   6. gen-data emits twoPPHistory into the data asset, validate.mjs gates
      the file's shape, and the built page carries the flip wiring. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, ".build", "aec-flow-src");

const HTT_YEARS = [1996, 1998, 2001];   // the statistics packs' HTPP tables
const DL_YEARS = [2004, 2007, 2010, 2013, 2016, 2019, 2022, 2025];
const AEC_YEARS = [...HTT_YEARS, ...DL_YEARS];
/* 1998's table omits Newcastle - its final pair ran Labor v independent
   (Morris), so the AEC's own product counts no Labor-v-Coalition for it */
const HTT_EXCLUDED = { 1998: ["Newcastle"] };
const HIST_YEARS = [1972, 1974, 1975, 1977, 1980, 1983, 1984, 1987, 1990, 1993, 1996, 1998, 2001];
const NAT_YEARS = [...HIST_YEARS, ...DL_YEARS];
const STATES = ["nsw", "vic", "qld", "wa", "sa", "tas", "act", "nt"];
/* the explainer menu shows the flow-history short forms ("Federal, NT") -
   never the full name spelt out (2026-10-24, user: "the view dropdown menu
   is inconsistent (eg northen territory vs NT)") */
const STATE_SHORT = { nsw: "NSW", vic: "Vic", qld: "Qld", wa: "WA", sa: "SA", tas: "Tas", act: "ACT", nt: "NT" };
const CLASSES = ["inner", "outer", "provincial", "rural"];
const CLS_KEY = { "inner metropolitan": "inner", "outer metropolitan": "outer",
  "provincial": "provincial", "rural": "rural" };
/* the IRSAD fifths file as five more entries in the SAME classes bank,
   after the four classes (2026-10-24, the user-approved ABS-SEIFA
   addition): q1 the most-disadvantaged fifth, q5 the most-advantaged,
   thirty seats a fifth (q5 taking the 151-seat years' spare). Span: the
   index series' own 2001–2025 – the seifa store's floor, never the AEC
   counts' 1996 */
const QUINTS = ["q1", "q2", "q3", "q4", "q5"];
const QUINT_SHORT = {
  q1: "most-disadvantaged IRSAD fifth",
  q2: "second-most-disadvantaged IRSAD fifth",
  q3: "middle IRSAD fifth",
  q4: "second-most-advantaged IRSAD fifth",
  q5: "most-advantaged IRSAD fifth",
};
const SEIFA_YEARS = [2001, 2004, 2007, 2010, 2013, 2016, 2019, 2022, 2025];
const SEIFA = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "division-seifa-indexes.json"), "utf8")).elections;
/* the probe's OWN quintile membership: rankDis (1 = most disadvantaged)
   ceil-divided thirty seats a fifth, the 151-seat chambers' spare landing
   in q5 – mirroring seifa_quintiles.quintile_of, independently */
const quintOf = (rankDis) => "q" + Math.min(Math.floor((rankDis - 1) / 30) + 1, 5);
/* the implied Senate two-party: the four post-GVT events (group tickets
   kept no per-ballot record before 2016), and the family rows this
   probe's own recompute sums - the same five the generator allowlists */
const SEN_YEARS = [2016, 2019, 2022, 2025];
const SEN_FAMS = ["ALP", "COAL", "GRN", "PHON", "OTHER"];

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
/* the statistics packs' HTPP tables, this probe's own parser: semicolon
   CSV summed to per-division Labor-v-Coalition pairs (no state column in
   the file - the classifications block supplies state and class alike) */
const htpp = (y) => {
  const text = fs.readFileSync(path.join(SRC, `htpp-${y}.txt`), "utf8").replace(/^﻿/, "");
  const lines = text.split(/\r?\n/);
  const hi = lines.findIndex((l) => /^Division;/.test(l));
  assert.ok(hi >= 0, `${y}: HTPP header row found`);
  const head = lines[hi].split(";");
  const ia = head.indexOf("ALP TPP Vote");
  const ic = head.indexOf("Coalition TPP Vote");
  const id = head.indexOf("Division");
  const ipc = head.indexOf("ALP TPP Pc");
  assert.ok(ia >= 0 && ic >= 0 && id >= 0 && ipc >= 0, `${y}: the counted + pc columns`);
  const perDiv = {};
  lines.slice(hi + 1).forEach((l) => {
    const r = l.split(";");
    if (r.length <= ic || !r[id].trim()) return;
    const a = +r[ia], c = +r[ic];
    assert.ok(Number.isFinite(a) && Number.isFinite(c), `${y}: numeric votes in ${r[id]}`);
    if (a + c) {
      assert.ok(Math.abs((100 * a) / (a + c) - parseFloat(r[ipc])) < 0.02,
        `${y} ${r[id]} (${r[1].trim()}): the row's own share cell ${r[ipc]} reads back off (${a}, ${c})`);
    } else {
      // a mobile team that recorded nobody prints 0 + 0 with a 0.00 share
      assert.equal(parseFloat(r[ipc] || 0), 0, `${y} ${r[id]}: empty team prints a nonzero share`);
    }
    (perDiv[r[id].trim()] ||= [0, 0])[0] += a;
    perDiv[r[id].trim()][1] += c;
  });
  return perDiv;
};
const share = (pair) => (100 * pair[0]) / (pair[0] + pair[1]);

const DIVCLS = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "division-classifications.json"), "utf8")).elections;
const rec = {};   // year -> {nat, perState, perClass}
AEC_YEARS.forEach((y) => {
  const blk = DIVCLS[String(y)];
  assert.ok(blk, `${y}: a classifications block`);
  let nat, perState, perDiv;
  if (DL_YEARS.includes(y)) {
    ({ nat, perState, perDiv } = tppdiv(y));
  } else {
    perDiv = htpp(y);
    nat = [0, 0]; perState = {};
    for (const [div, pair] of Object.entries(perDiv)) {
      const d = blk[div];
      assert.ok(d, `${y}: ${div} classified`);
      const st = d.state.trim().toLowerCase();
      assert.ok(STATES.includes(st), `${y}: ${div} maps to a state (${d.state})`);
      nat[0] += pair[0]; nat[1] += pair[1];
      (perState[st] ||= [0, 0])[0] += pair[0]; perState[st][1] += pair[1];
    }
    assert.deepEqual(Object.keys(perDiv).sort(),
      Object.keys(blk).filter((d) => !(HTT_EXCLUDED[y] || []).includes(d)).sort(),
      `${y}: HTPP join covers the block less its own omission`);
  }
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
  if (SEIFA_YEARS.includes(y)) {
    /* the fifth regrouping of the very same per-division counts, by this
       probe's own membership read of the seifa store */
    const mem = SEIFA[String(y)];
    assert.ok(mem, `${y}: an IRSAD elections block`);
    assert.deepEqual(Object.keys(perDiv).filter((d) => !(HTT_EXCLUDED[y] || []).includes(d)).sort(),
      Object.keys(mem).sort(), `${y}: the IRSAD block names the counted divisions`);
    const qs = Object.fromEntries(QUINTS.map((q) => [q, [0, 0]]));
    for (const [div, pair] of Object.entries(perDiv)) {
      const cell2 = mem[div];
      assert.ok(cell2 && cell2.irsad, `${y}: ${div} carries an IRSAD cell`);
      const q = quintOf(cell2.irsad.rankDis);
      assert.ok(QUINTS.includes(q), `${y}: ${div} quintile ${q} in range`);
      qs[q][0] += pair[0]; qs[q][1] += pair[1];
    }
    // the fifths partition the same ballots the national sum counts
    assert.deepEqual(
      [qs.q1[0] + qs.q2[0] + qs.q3[0] + qs.q4[0] + qs.q5[0], qs.q1[1] + qs.q2[1] + qs.q3[1] + qs.q4[1] + qs.q5[1]],
      [nat[0], nat[1]], `${y}: the fifths recompose the national two-party count`);
    rec[y].perQuint = Object.fromEntries(QUINTS.map((q) => [q, share(qs[q])]));
  }
});

// ---- the data file ----------------------------------------------------------
const doc = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "2pp-history.json"), "utf8"));
const FED = doc.fed;
assert.ok(FED, "the fed view");
const SEN = FED.sen;
assert.ok(SEN, "fed.sen rides the House: control's Upper (the implied Senate two-party)");
assert.equal(SEN.implied, true, "an estimate is marked, never mistaken for a count");
assert.equal(SEN.classes, undefined, "no division-class cuts exist for the Senate");
assert.deepEqual(SEN.years, SEN_YEARS, "the implied span: the four post-GVT events");
assert.deepEqual(Object.keys(SEN.states).sort(), [...STATES].sort(), "the eight implied state cuts");
STATES.forEach((s) => {
  assert.equal(SEN.states[s].short, STATE_SHORT[s], `sen ${s}: the menu short label`);
  assert.deepEqual(SEN.states[s].years, SEN_YEARS, `sen ${s}: the same four events`);
});
/* nswLc is the implied NSW Legislative Council two-party twin (user
   2026-10-24: "what about state-level upper house 2pps" / "add it") - the
   ONLY state upper house with a countable ballot record (Victoria's
   council ran party tickets to 2022; Western Australia's first ticket-
   free count prints no per-ballot record; South Australia's and
   Tasmania's commissions publish none): the committed NSWEC ballot-level
   family tallies (.build/nswec-lc-flow-src/counts.json, the same five
   family rows the Senate probe sums) recompose its four cells below */
const LC_YEARS = [2011, 2015, 2019, 2023];
const LC = doc.nswLc;
assert.ok(LC, "nswLc: the ONE state-council twin rides the file");
assert.equal(LC.implied, true, "an estimate is marked, never mistaken for a count");
assert.equal(LC.classes, undefined, "a state council has no federal division classes");
assert.equal(LC.states, undefined, "a state election has no state cuts");
assert.deepEqual(LC.years, LC_YEARS, "the council span: the NSWEC ballot record's four events, 2011-2023");
assert.equal(LC.short, "NSW LC", "the menu short label");
assert.deepEqual(Object.keys(FED.states), STATES, "the eight state cuts");
assert.deepEqual(Object.keys(FED.classes), [...CLASSES, ...QUINTS], "the four class cuts then the IRSAD fifths, in menu order");
assert.deepEqual(FED.years, NAT_YEARS, "national span: 1972–2025");
STATES.forEach((s) => assert.deepEqual(FED.states[s].years, AEC_YEARS, `${s}: the downloads' span`));
STATES.forEach((s) => assert.equal(FED.states[s].short, STATE_SHORT[s], `${s}: the menu short label`));
CLASSES.forEach((c) => assert.deepEqual(FED.classes[c].years, AEC_YEARS, `${c}: the downloads' span`));
CLASSES.forEach((c) => assert.equal(FED.classes[c].seifa, undefined, `${c}: a seat-type cut carries no seifa flag`));
QUINTS.forEach((q) => assert.deepEqual(FED.classes[q].years, SEIFA_YEARS, `${q}: the index series' own span`));
QUINTS.forEach((q) => assert.equal(FED.classes[q].seifa, true, `${q}: the seifa flag the captions fork on`));
QUINTS.forEach((q) => assert.equal(FED.classes[q].short, QUINT_SHORT[q], `${q}: the menu short`));
const cell = (v, k, y) => v[k][v.years.indexOf(y)];

/* every view: the two-line contract - numeric cells, aligned to years, and
   the pair summing to the count (the implied Senate bank's pair too: the
   estimand keeps the count's shape) */
const allViews = [FED, ...STATES.map((s) => FED.states[s]), ...CLASSES.map((c) => FED.classes[c]),
  ...QUINTS.map((q) => FED.classes[q]),
  SEN, ...STATES.map((s) => SEN.states[s]), LC];
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
  if (rec[y].perQuint)
    QUINTS.forEach((q) => assert.ok(Math.abs(rec[y].perQuint[q] - cell(FED.classes[q], "alp", y)) < 0.005,
      `${y} ${q}: IRSAD-fifth recompute ${rec[y].perQuint[q].toFixed(2)} v cell ${cell(FED.classes[q], "alp", y)}`));
});

/* the implied Senate cells recompute from the committed ATL tallies - this
   probe's OWN sums, never the generator's faith: 100·ΣtoALP ÷ (ΣtoALP +
   ΣtoCOAL) over the five family rows, national and each state, each event */
const ATL = JSON.parse(fs.readFileSync(path.join(SRC, "senate-atl", "counts.json"), "utf8")).events;
assert.deepEqual(Object.keys(ATL).map(Number).sort(), SEN_YEARS, "the ATL tallies' event set");
const implied = (block) => {
  let a = 0, c = 0;
  SEN_FAMS.forEach((f) => {
    const r = block[f];
    assert.ok(r, `an ATL family row for ${f}`);
    a += r.toALP; c += r.toCOAL;
  });
  return (100 * a) / (a + c);
};
SEN_YEARS.forEach((y, i) => {
  const ev = ATL[String(y)];
  const nat = implied(ev.counts);
  assert.ok(Math.abs(nat - SEN.alp[i]) < 0.005,
    `sen ${y} national: ATL recompute ${nat.toFixed(2)} v cell ${SEN.alp[i]}`);
  STATES.forEach((s) => {
    const blk = ev.states[s.toUpperCase()];
    assert.ok(blk, `sen ${y} ${s}: an ATL state block`);
    const v = implied(blk);
    assert.ok(Math.abs(v - SEN.states[s].alp[i]) < 0.005,
      `sen ${y} ${s}: ATL recompute ${v.toFixed(2)} v cell ${SEN.states[s].alp[i]}`);
  });
});

/* the implied council cells recompute from the committed NSWEC tallies -
   this probe's OWN sums again, the same estimand as the Senate's: the
   tallies are counted in the flow bank's source dir (the Senate's senate-
   atl twin), keyed by year with the same five family rows */
const LC_ATL = JSON.parse(fs.readFileSync(path.join(ROOT, ".build", "nswec-lc-flow-src", "counts.json"), "utf8")).events;
assert.deepEqual(Object.keys(LC_ATL).map(Number).sort(), LC_YEARS, "the council tallies' event set");
LC_YEARS.forEach((y, i) => {
  const ev = LC_ATL[String(y)];
  assert.ok(ev && ev.counts, `lc ${y}: a tallies block`);
  const v = implied(ev.counts);
  assert.ok(Math.abs(v - LC.alp[i]) < 0.005,
    `lc ${y}: NSWEC recompute ${v.toFixed(2)} v cell ${LC.alp[i]}`);
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
assert.equal(cell(FED.classes.inner, "alp", 1996), 50.49, "the HTPP era's inner-metro cell");
assert.equal(cell(FED.classes.rural, "alp", 1996), 38.63, "the HTPP era's rural cell");
assert.equal(cell(FED.states.nsw, "alp", 1996), 47.44, "the HTPP era's biggest-state cell");
assert.equal(cell(FED.states.act, "alp", 1996), 55.46, "the HTPP era's capital cell");
AEC_YEARS.forEach((y) => {
  assert.ok(cell(FED.classes.inner, "alp", y) > cell(FED.classes.rural, "alp", y),
    `${y}: inner metro runs ahead of rural for Labor`);
  assert.ok(cell(FED.classes.rural, "alp", y) < cell(FED, "alp", y),
    `${y}: rural runs behind the national line`);
});
/* the fifths' ladder: the 2025 spread runs 47.96 (most-disadvantaged) to
   59.08 (most-advantaged); the ladder has steepened since 2001, when the
   two ends sat 48.12 v 46.93 - and every year's fifths pin exactly */
assert.equal(cell(FED.classes.q1, "alp", 2001), 48.12, "2001's most-disadvantaged fifth (HTPP era)");
assert.equal(cell(FED.classes.q5, "alp", 2001), 46.93, "2001's most-advantaged fifth (HTPP era)");
assert.equal(cell(FED.classes.q1, "alp", 2025), 47.96, "2025's most-disadvantaged fifth");
assert.equal(cell(FED.classes.q2, "alp", 2025), 52.11, "2025's second-most-disadvantaged fifth");
assert.equal(cell(FED.classes.q3, "alp", 2025), 57.14, "2025's middle fifth");
assert.equal(cell(FED.classes.q4, "alp", 2025), 59.2, "2025's second-most-advantaged fifth");
assert.equal(cell(FED.classes.q5, "alp", 2025), 59.08, "2025's most-advantaged fifth");
/* the implied Senate pins (recomputed from the tallies 2026-10-24): Labor's
   implied line crosses the Coalition's between 2019 and 2022, and the
   ACT's 2025 cell is the whole bank's furthest from the half */
assert.equal(cell(SEN, "alp", 2016), 49.24);
assert.equal(cell(SEN, "alp", 2019), 46.8);
assert.equal(cell(SEN, "alp", 2022), 52.38);
assert.equal(cell(SEN, "alp", 2025), 55.99);
assert.equal(cell(SEN.states.act, "alp", 2016), 57.05);
assert.equal(cell(SEN.states.act, "alp", 2025), 70.61);
assert.equal(cell(SEN.states.tas, "alp", 2025), 62.83);
/* the implied council pins (recomputed from the NSWEC tallies
   2026-10-24): Labor's council line runs behind its federal NSW line at
   first, then crosses ahead of it between 2019 and 2023 - the same four
   cells the generator hard-pins against its own recompute */
assert.equal(cell(LC, "alp", 2011), 34.11, "the Coalition landslide, counted off its papers");
assert.equal(cell(LC, "alp", 2015), 43.57);
assert.equal(cell(LC, "alp", 2019), 48.32);
assert.equal(cell(LC, "alp", 2023), 57.44);
assert.ok(cell(LC, "alp", 2019) < 50 && cell(LC, "alp", 2023) > 50,
  "the council pair changes hands between 2019 and 2023");

// ---- the constant y axis (user 2026-10-24) ----------------------------------
/* "the 2pp view y-axis range should remain constant at all times":
   Explained2ppChart prices the WHOLE bank's furthest cell from the half,
   mirrored - never the drawn view's - so neither an elections pick, the
   Share: flip nor the House: flip moves the axis (the implied Senate
   bank's cells price it too; its furthest, ACT 2025's 20.61, sits inside
   the House bank's 22.49). Recompute the band as the renderer
   does and pin what the 2026-10-24 file prices it at */
const DEV = Math.max(...allViews.flatMap((v) => v.alp.map((x) => Math.abs(x - 50))));
const LO = Math.max(0, Math.floor((50 - DEV) / 5) * 5);
assert.equal(DEV, cell(FED.states.act, "alp", 2025) - 50, "2025's ACT reading prices the band");
assert.equal(LO, 25, `the band's floor (${(50 - DEV).toFixed(2)} floored to the next 5)`);
assert.equal(100 - LO, 75, "mirrored at the half");

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
