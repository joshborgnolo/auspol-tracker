/* test-informal-history.mjs – pins the /flows-explained/ "View: Informal votes"
   stop's data end-to-end (the fourth stop of the View: cycle – user
   2026-10-24: "View: Informal votes … informal voting data for each
   federal election as far back as possible, split also by state/territory,
   lower and upper house … also have it by aec seat classification … and
   IRSAD index quintile … and ieo quintile"). Every cell is informal
   ballots ÷ (formal + informal) ballots, per cent, built by
   .build/aec-informal-history.py out of the committed sources in
   .build/aec-informal-src/ (the APH election-handbook informality
   appendices and the AEC's informality summary page) plus the vote-type
   downloads (fpvvt year caches) and the statistics-era htpp/hcands
   tables the primary lanes already ride. CHECKS:
   1. the store's shape and spans: House national + the eight
      states/territories 1901–2025 (48 elections, the APH appendix to 2001,
      the fpvvt recompositions from 2004 – every later cell is the
      count-derived figure, never the summary page's occasional
      truncation), the territories' pre-representation cells nulls never
      zeros; the Senate national + states 1903–2022 (no 2025 Senate
      informal product exists, so the Senate lane floors a year short of
      the House's); the four AEC class lanes 1996–2025 and the ten SEIFA
      fifths (IRSAD q1..q5 + IEO e1..e5, ix-tagged exactly as the primary
      and 2PP lanes carry them) 2001–2025;
   2. the headline cells, re-derived by THIS file's own readers: the APH
      pages re-parsed independently (a regex table walker, not the
      builder's HTMLParser), the fpvvt downloads re-summed (Informal
      pseudo-rows vs candidate rows), the legacy tables re-joined
      (1998 Newcastle's 147-division base respected), the SEIFA
      memberships recomputed from data/division-seifa-indexes.json (rank
      1 = most-disadvantaged, thirty a fifth), and the AEC summary page
      re-read as the cross-check the builder treats it (the derivation
      governs the House lane; the page's Senate cells it EXACTLY files);
   3. the tenancy guard rails: every cell null or 0 < x ≤ 25, years
      ascending, no fold gate anywhere in the store (informal-fare cells
      are all displayed);
   4. gen-data's handoff and the built page: window.AUSPOL.informalHistory
      reaches the chart verbatim, validate.mjs runs the
      validateInformalHistory block, and the built page carries the View
      stop's label. Runs after the build in npm test's chain (the data
      asset only reflects the current dataset post-build). */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, ".build", "aec-informal-src");
const FLOWSRC = path.join(ROOT, ".build", "aec-flow-src");
const BOOTH = path.join(FLOWSRC, "booth", "oracle");

const STATES = ["nsw", "vic", "qld", "wa", "sa", "tas", "act", "nt"];
const STATE_SHORT = { nsw: "NSW", vic: "Vic", qld: "Qld", wa: "WA", sa: "SA", tas: "Tas", act: "ACT", nt: "NT" };
const STATE_FULL = {
  nsw: "New South Wales", vic: "Victoria", qld: "Queensland", wa: "Western Australia",
  sa: "South Australia", tas: "Tasmania", act: "Australian Capital Territory", nt: "Northern Territory",
};
const HOUSE_YEARS_N = 48; // 1901–2025
const SEN_YEARS_N = 45;   // 1903–2022
const CLASSES = ["inner", "outer", "provincial", "rural"];
const CLASS_META = {
  inner: ["Inner metropolitan", "inner metro"],
  outer: ["Outer metropolitan", "outer metro"],
  provincial: ["Provincial", "provincial"],
  rural: ["Rural", "rural"],
};
const CLASS_FROM_PRINT = { "inner metropolitan": "inner", "outer metropolitan": "outer",
  provincial: "provincial", rural: "rural" };
const QUINTS = ["q1", "q2", "q3", "q4", "q5"];
const EOCTAS = ["e1", "e2", "e3", "e4", "e5"];
const FIFTHS = [...QUINTS, ...EOCTAS];
const IDX_OF = (id) => (id[0] === "q" ? "irsad" : "ieo");
const QUINT_COPY = {
  1: ["Most-disadvantaged fifth", "Top fifth", "most-disadvantaged fifth"],
  2: ["Second-most-disadvantaged fifth", "2nd fifth", "second-most-disadvantaged fifth"],
  3: ["Middle fifth", "Middle fifth", "middle fifth"],
  4: ["Second-most-advantaged fifth", "4th fifth", "second-most-advantaged fifth"],
  5: ["Most-advantaged fifth", "Bottom fifth", "most-advantaged fifth"],
};

// ---- independent readers of the committed sources ---------------------------
/* the committed-page tables, re-walked by regex (never the builder's parser):
   rows of cell text out of each <table>, header words mapped to repo cuts */
const tableRows = (file, idx) => {
  const txt = fs.readFileSync(path.join(SRC, file), "utf8");
  const tables = txt.match(/<table[\s\S]*?<\/table>/gi);
  assert.ok(tables && tables.length > idx, `${file}: table ${idx} exists`);
  return [...tables[idx].matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((m) =>
    [...m[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) =>
      c[1].replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
        .replace(/\s+/g, " ").trim()));
};
const HDR_MAP = { nsw: "nsw", vic: "vic", "vic.": "vic", qld: "qld", wa: "wa", sa: "sa",
  tas: "tas", "tas.": "tas", nt: "nt", act: "act", aust: "nat", total: "nat" };
const pctTable = (file, idx = 0) => {
  const rows = tableRows(file, idx);
  const cols = rows[0].map((c) => HDR_MAP[c.toLowerCase()] ?? null);
  assert.ok(cols.filter(Boolean).length === 9, `${file}: header maps (${rows[0].join("|")})`);
  const out = {};
  rows.slice(1).forEach((r) => {
    const m = /^(\d{4})/.exec(r[0] || "");
    if (!m) return; // the page's 2014[2] WA-only re-election row is never a year
    out[+m[1]] = {};
    r.slice(1).forEach((raw, i) => {
      const cut = cols[i + 1];
      if (!cut) return;
      const t = (raw || "").trim();
      out[+m[1]][cut] = [". .", "n.a.", ""].includes(t) ? null : +t;
      assert.ok(out[+m[1]][cut] === null || Number.isFinite(out[+m[1]][cut]),
        `${file} ${m[1]} ${cut}: a figure ("${t}")`);
    });
  });
  return out;
};
const APH_HOUSE = pctTable("aph-informal-house.htm");
const APH_SENATE = pctTable("aph-informal-senate.htm");
const AEC_SEN = pctTable("aec-informality-summary.html", 0);
const AEC_HOUSE = pctTable("aec-informality-summary.html", 1);

/* the fpvvt vote-type downloads, re-summed: Informal pseudo-rows vs every
   other row, TotalVotes both sides */
const splitCsv = (ln) =>
  ln.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((x) => x.replace(/^"|"$/g, "").trim());
const fpvvt = (year) => {
  const text = zlib.gunzipSync(fs.readFileSync(path.join(BOOTH, `fpvvt-${year}.csv.gz`))).toString("utf8").replace(/^﻿/, "");
  const lines = text.split(/\r?\n/);
  const hi = lines.findIndex((l) => l.startsWith("StateAb,"));
  assert.ok(hi >= 0, `fpvvt-${year}: header row`);
  const head = splitCsv(lines[hi]);
  const is = head.indexOf("StateAb"), id = head.indexOf("DivisionNm"),
    ip = head.indexOf("PartyNm"), iv = head.indexOf("TotalVotes");
  assert.ok(is >= 0 && id >= 0 && ip >= 0 && iv >= 0, `fpvvt-${year}: the four columns`);
  const votes = {}, divState = {};
  lines.slice(hi + 1).forEach((l) => {
    if (!l.trim()) return;
    const r = splitCsv(l);
    if (r.length <= iv || !r[1]) return;
    const div = r[id];
    divState[div] = r[is].toLowerCase();
    const slot = (votes[div] ||= { f: 0, i: 0 });
    if (r[ip] === "Informal") slot.i += +r[iv]; else slot.f += +r[iv];
  });
  return { votes, divState };
};

/* the statistics-era lane: htpp's Informal Vote + hcands' formal Vote per
   division (1998 Newcastle stands outside the htpp product – 147 bases) */
const legacyVotes = (year) => {
  const votes = {};
  const htpp = fs.readFileSync(path.join(FLOWSRC, `htpp-${year}.txt`), "utf8").replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  const hh = htpp[0].split(";");
  const hdiv = hh.indexOf("Division"), hinf = hh.indexOf("Informal Vote");
  assert.ok(hdiv >= 0 && hinf >= 0, `htpp-${year}: Division/Informal Vote columns`);
  htpp.slice(1).forEach((ln) => {
    const c = ln.split(";");
    if (!c[hdiv] || !c[hdiv].trim()) return;
    const slot = (votes[c[hdiv].trim()] ||= { f: 0, i: 0 });
    slot.i += +((c[hinf] || "0").trim() || 0);
  });
  const hc = fs.readFileSync(path.join(FLOWSRC, `hcands-${year}.txt`), "utf8").replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  const ch = hc[0].split(";");
  const cdiv = ch.indexOf("Division"), cvote = ch.indexOf("Vote");
  assert.ok(cdiv >= 0 && cvote >= 0, `hcands-${year}: Division/Vote columns`);
  hc.slice(1).forEach((ln) => {
    const c = ln.split(";");
    if (c.length <= cvote || !c[cvote].trim()) return;
    const div = c[cdiv].trim();
    if (!(div in votes)) {
      assert.ok(year === 1998 && div === "Newcastle",
        `${year} ${div}: a formal vote with no htpp row (1998 Newcastle alone is exempt)`);
      return;
    }
    votes[div].f += +c[cvote];
  });
  return votes;
};
const r2 = (x) => Math.round(x * 100) / 100;
const share = ({ f, i }) => (100 * i) / (f + i);
const groupShares = (votes, cutOf) => {
  const agg = {};
  Object.entries(votes).forEach(([div, v]) => {
    const c = cutOf(div);
    const a = (agg[c] ||= { f: 0, i: 0 });
    a.f += v.f; a.i += v.i;
  });
  return Object.fromEntries(Object.entries(agg).map(([c, a]) => [c, r2(share(a))]));
};
/* SEIFA fifths, recomputed from the display store exactly as the primary
   test pins them: rank 1 = MOST-disadvantaged on the read index */
const SEIFA = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "division-seifa-indexes.json"), "utf8")).elections;
const CLSC = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "division-classifications.json"), "utf8")).elections;
const rankDis = (ix, cellX) => (ix === "irsad" ? cellX.irsad.rankDis : cellX[ix].rank);
const fifthOf = (ix, rd) => `${ix === "irsad" ? "q" : "e"}${Math.min(Math.floor((rd - 1) / 30) + 1, 5)}`;

// ---- the store --------------------------------------------------------------
const doc = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "informal-history.json"), "utf8"));
assert.ok(typeof doc._comment === "string" && doc._comment.includes("GENERATED"), "the generated header");
const FED = doc.fed, SEN = FED.sen, CLB = FED.classes;
assert.ok(FED && SEN && CLB, "fed, fed.sen and fed.classes views");

/* every view in the store, one invariant pass: label/elections copy,
   ascending integer years, an aligned inf array whose cells are null or
   0 < x ≤ 25 (the printable informal range – cap_range's contract), and
   NEVER a bogus 0 (an unrepresented territory draws the gap) */
const allViews = [FED, SEN, ...STATES.map((s) => FED.states[s]),
  ...STATES.map((s) => SEN.states[s]), ...Object.values(CLB)];
allViews.forEach((v) => {
  assert.ok(typeof v.label === "string" && v.label && typeof v.elections === "string" && v.elections,
    `${v.label}: label + elections copy`);
  assert.ok(Array.isArray(v.years) && v.years.length >= 5, `${v.label}: a years array`);
  v.years.forEach((y, i) => {
    assert.ok(Number.isInteger(y) && (i === 0 || y > v.years[i - 1]), `${v.label}: years ascend (${y})`);
  });
  assert.ok(Array.isArray(v.inf) && v.inf.length === v.years.length, `${v.label}: inf aligned`);
  v.inf.forEach((x, i) => {
    assert.ok(x === null || (typeof x === "number" && x > 0 && x <= 25),
      `${v.label} ${v.years[i]}: null or 0<x<=25 (${x})`);
  });
});

// ---- spans and the territories' pre-representation gaps ---------------------
assert.equal(FED.years.length, HOUSE_YEARS_N, "48 House elections");
assert.equal(FED.years[0], 1901); assert.equal(FED.years.at(-1), 2025);
assert.deepEqual(Object.keys(FED.states), STATES, "the eight federal state cuts");
STATES.forEach((s) => {
  const v = FED.states[s];
  assert.deepEqual(v.years, FED.years, `${s}: rides the federal year list`);
  assert.equal(v.label, STATE_FULL[s]); assert.equal(v.short, STATE_SHORT[s]);
  assert.equal(v.elections, `${STATE_FULL[s]} electorates at federal elections`, `${s}: elections copy`);
});
assert.equal(FED.states.act.inf[0], null, "ACT 1901: no seat, a gap");
assert.equal(FED.states.nt.inf[0], null, "NT 1901: no seat, a gap");
assert.equal(FED.states.act.short, "ACT"); assert.equal(FED.states.nt.short, "NT");
{ // the first drawn cells are the territories' first seats
  const firstNonNull = (v) => v.years.find((_, i) => v.inf[i] != null);
  assert.equal(firstNonNull(FED.states.act), 1949, "ACT enters 1949");
  assert.equal(firstNonNull(FED.states.nt), 1922, "NT enters 1922");
}
assert.equal(SEN.years.length, SEN_YEARS_N, "45 Senate elections");
assert.equal(SEN.years[0], 1903, "the Senate lane's 1903 floor (1901 is n.a. outside SA/WA/Tas)");
assert.equal(SEN.years.at(-1), 2022, "no 2025 Senate informal product exists");
assert.equal(SEN.label, "Federal Senate"); assert.equal(SEN.short, "Senate");
assert.equal(SEN.elections, "Australian Senate elections");
assert.deepEqual(Object.keys(SEN.states), STATES, "the eight Senate state cuts");
STATES.forEach((s) => {
  const v = SEN.states[s];
  assert.deepEqual(v.years, SEN.years, `sen ${s}: the Senate year list`);
  assert.equal(v.short, STATE_SHORT[s]);
});

// ---- the class and fifth lanes ----------------------------------------------
assert.deepEqual(Object.keys(CLB), [...CLASSES, ...FIFTHS],
  "four classes then the IRSAD and IEO fifths, in menu order");
CLASSES.forEach((k) => {
  const v = CLB[k];
  assert.deepEqual(v.years, [1996, 1998, 2001, 2004, 2007, 2010, 2013, 2016, 2019, 2022, 2025],
    `${k}: the eleven-classifications span`);
  assert.equal(v.label, CLASS_META[k][0]); assert.equal(v.short, CLASS_META[k][1]);
  assert.equal(v.elections, `federal elections in ${CLASS_META[k][1]} seats`, `${k}: elections copy`);
  assert.ok(!("seifa" in v), `${k}: a class cut carries no seifa flag`);
  assert.ok(!("ix" in v), `${k}: nor an index tag`);
});
FIFTHS.forEach((q) => {
  const [label, short, phrase] = QUINT_COPY[q[1]];
  const v = CLB[q];
  assert.deepEqual(v.years, [2001, 2004, 2007, 2010, 2013, 2016, 2019, 2022, 2025],
    `${q}: the index series' own span`);
  assert.equal(v.seifa, true, `${q}: the seifa flag`);
  assert.equal(v.ix, IDX_OF(q), `${q}: the index tag`);
  assert.equal(v.label, label, `${q}: label`);
  assert.equal(v.short, short, `${q}: short`);
  assert.equal(v.elections,
    `federal elections in the ${phrase} of seats by ${IDX_OF(q) === "irsad" ? "IRSAD" : "IEO"} rank`,
    `${q}: elections copy names the index`);
});

// ---- typed per-cell pins (each stands against the independent re-read below)
const cell = (v, y) => v.inf[v.years.indexOf(y)];
assert.equal(cell(FED, 1901), 1.6); assert.equal(cell(FED, 1996), 3.2);
assert.equal(cell(FED, 1998), 3.8); assert.equal(cell(FED, 2001), 4.8);
assert.equal(cell(FED, 2004), 5.18, "2004 opens the fpvvt lane");
assert.equal(cell(FED, 2013), 5.91, "the modern peak");
assert.equal(cell(FED, 2016), 5.05); assert.equal(cell(FED, 2019), 5.54);
assert.equal(cell(FED, 2022), 5.19); assert.equal(cell(FED, 2025), 5.6);
assert.equal(cell(FED.states.nsw, 1901), 1.9); assert.equal(cell(FED.states.vic, 1901), 0.8);
assert.equal(cell(FED.states.nsw, 1984), 6.2); assert.equal(cell(FED.states.vic, 1984), 8.2);
assert.equal(cell(FED.states.nsw, 2016), 6.17); assert.equal(cell(FED.states.nsw, 2025), 8.06);
assert.equal(cell(FED.states.act, 2025), 2.43, "the territorians' low-modern cell");
assert.equal(cell(SEN, 1903), 3.6); assert.equal(cell(SEN, 1975), 9.1);
assert.equal(cell(SEN, 1977), 9.0); assert.equal(cell(SEN, 1984), 4.3);
assert.equal(cell(SEN, 2013), 3.0); assert.equal(cell(SEN, 2016), 3.9);
assert.equal(cell(SEN, 2019), 3.8); assert.equal(cell(SEN, 2022), 3.4);
assert.equal(cell(SEN.states.nsw, 2022), 3.9);
assert.equal(cell(SEN.states.act, 2022), 1.7, "the territories' small-electorate cell");
assert.equal(cell(CLB.inner, 1996), 3.65); assert.equal(cell(CLB.outer, 1996), 3.44);
assert.equal(cell(CLB.provincial, 1996), 2.79); assert.equal(cell(CLB.rural, 1996), 2.73);
assert.equal(cell(CLB.inner, 2025), 4.47); assert.equal(cell(CLB.outer, 2025), 6.03);
assert.equal(cell(CLB.provincial, 2025), 5.66); assert.equal(cell(CLB.rural, 2025), 6.32);
assert.equal(cell(CLB.q1, 2001), 5.18); assert.equal(cell(CLB.q5, 2001), 4.0);
assert.equal(cell(CLB.q1, 2025), 7.61); assert.equal(cell(CLB.q2, 2025), 6.58);
assert.equal(cell(CLB.q3, 2025), 5.13); assert.equal(cell(CLB.q4, 2025), 4.86);
assert.equal(cell(CLB.q5, 2025), 3.93);
assert.equal(cell(CLB.e1, 2001), 5.53); assert.equal(cell(CLB.e1, 2025), 6.46);
assert.equal(cell(CLB.e2, 2025), 7.46); assert.equal(cell(CLB.e3, 2025), 5.45);
assert.equal(cell(CLB.e4, 2025), 4.85); assert.equal(cell(CLB.e5, 2025), 3.86);
/* the shape of the story: informality falls with advantage. The IRSAD
   ladder is strictly monotone in 2025; the most-advantaged fifth stays at
   or under the most-disadvantaged in every year on both indexes */
assert.ok(CLB.q1.inf.at(-1) > CLB.q2.inf.at(-1) && CLB.q2.inf.at(-1) > CLB.q3.inf.at(-1)
  && CLB.q3.inf.at(-1) > CLB.q4.inf.at(-1) && CLB.q4.inf.at(-1) > CLB.q5.inf.at(-1),
  "2025 IRSAD ladder: q1 > q2 > q3 > q4 > q5");
CLB.q1.years.forEach((y, i) => {
  assert.ok(CLB.q5.inf[i] <= CLB.q1.inf[i], `IRSAD ${y}: most-advantaged ≤ most-disadvantaged`);
  assert.ok(CLB.e5.inf[i] <= CLB.e1.inf[i],
    `IEO ${y}: e5 ≤ e1 (${CLB.e5.inf[i]} v ${CLB.e1.inf[i]})`);
});

// ---- independent re-reads of the committed sources --------------------------
/* the APH appendix governs its years VERBATIM (the builder's deeper lanes
   only take over from 2004 House / 1977 Senate) */
assert.equal(APH_HOUSE[1901].nat, 1.6); assert.equal(APH_HOUSE[1901].nsw, 1.9);
assert.equal(APH_HOUSE[1984].vic, 8.2); assert.equal(APH_HOUSE[2001].nat, 4.8);
assert.equal(APH_HOUSE[1901].act, null); assert.equal(APH_HOUSE[1901].nt, null);
assert.equal(APH_SENATE[1903].nat, 3.6); assert.equal(APH_SENATE[1975].nat, 9.1);
/* the Senate page's 1901 row prints SA/WA/Tas alone — why the lane floors
   at 1903 */
assert.ok(APH_SENATE[1901].sa != null && APH_SENATE[1901].wa != null && APH_SENATE[1901].tas != null
  && APH_SENATE[1901].nsw == null && APH_SENATE[1901].vic == null && APH_SENATE[1901].qld == null,
  "the Senate page's 1901 row: SA/WA/Tas alone");
assert.equal(APH_SENATE[1977].nat, AEC_SEN[1977].nat,
  "the chamber-identity guard: APH and the AEC page both file Senate 1977 at 9.0");
[1901, 1996, 1998, 2001].forEach((y) => {
  assert.equal(cell(FED, y), APH_HOUSE[y].nat, `House ${y}: the store IS the APH row`);
  STATES.forEach((s) => assert.equal(cell(FED.states[s], y), APH_HOUSE[y][s],
    `House ${y} ${s}: stored == APH (${APH_HOUSE[y][s]})`));
});
[1903, 1975].forEach((y) => {
  assert.equal(cell(SEN, y), APH_SENATE[y].nat, `Senate ${y}: the store IS the APH row`);
  STATES.forEach((s) => assert.equal(cell(SEN.states[s], y), APH_SENATE[y][s],
    `Senate ${y} ${s}: stored == APH (${APH_SENATE[y][s]})`));
});

/* the fpvvt lane: the store's 2004-onward House cells are the downloads'
   own Informal-vs-candidate sums (and the per-state cuts the same sums by
   StateAb) */
[2013, 2025].forEach((y) => {
  const { votes, divState } = fpvvt(y);
  const nat = groupShares(votes, () => "nat").nat;
  assert.equal(nat, cell(FED, y), `${y}: the national cell recomposes (${nat})`);
  const byState = groupShares(votes, (d) => divState[d]);
  STATES.forEach((s) => assert.equal(byState[s], cell(FED.states[s], y),
    `${y} ${s}: the state cell recomposes (${byState[s]})`));
});
{ // and the class cuts + fifths ride the same downloads through 2025's maps
  const { votes } = fpvvt(2025);
  const clsShares = groupShares(votes, (d) => CLASS_FROM_PRINT[CLSC["2025"][d].classification.toLowerCase()]);
  CLASSES.forEach((k) => assert.equal(clsShares[k], cell(CLB[k], 2025),
    `2025 ${k}: the class cell recomposes (${clsShares[k]})`));
  const blk = SEIFA["2025"];
  ["irsad", "ieo"].forEach((ix) => {
    const shares = groupShares(votes, (d) => fifthOf(ix, rankDis(ix, blk[d])));
    (ix === "irsad" ? QUINTS : EOCTAS).forEach((q) => assert.equal(shares[q], cell(CLB[q], 2025),
      `2025 ${q}: the fifth cell recomposes (${shares[q]})`));
  });
}

/* the legacy lane: the classes' 1996–2001 cells are htpp's informal sums
   over hcands' formal sums, grouped by that election's block */
[1996, 1998, 2001].forEach((y) => {
  const votes = legacyVotes(y);
  const n = Object.keys(votes).length;
  // 148 seats at 1996/1998 (1998's Newcastle absent from the htpp lane);
  // 150 at 2001 (Kalgoorlie's last election + the NT's second seat)
  assert.equal(n, y === 1998 ? 147 : y === 2001 ? 150 : 148,
    `${y}: the division base (${n})`);
  const clsShares = groupShares(votes, (d) => CLASS_FROM_PRINT[CLSC[String(y)][d].classification.toLowerCase()]);
  CLASSES.forEach((k) => assert.equal(clsShares[k], cell(CLB[k], y),
    `${y} ${k}: the class cell recomposes (${clsShares[k]})`));
});
{ // 2001's fifths ride the legacy lane (the index series' floor year)
  const votes = legacyVotes(2001);
  const blk = SEIFA["2001"];
  ["irsad", "ieo"].forEach((ix) => {
    const shares = groupShares(votes, (d) => fifthOf(ix, rankDis(ix, blk[d])));
    (ix === "irsad" ? QUINTS : EOCTAS).forEach((q) => assert.equal(shares[q], cell(CLB[q], 2001),
      `2001 ${q}: the fifth cell recomposes (${shares[q]})`));
  });
}

/* the AEC summary page is the Senate lane's own source from 1977 (its
   cells filed verbatim) and the House lane's cross-check alone (the page
   truncates where the counts round – within 0.1, never adopted) */
[2013, 2016, 2019, 2022].forEach((y) => {
  assert.ok(Math.abs(cell(SEN, y) - AEC_SEN[y].nat) <= 0.005,
    `Senate ${y}: the store IS the page's Total (${cell(SEN, y)} v ${AEC_SEN[y].nat})`);
  assert.ok(Math.abs(cell(FED, y) - AEC_HOUSE[y].nat) <= 0.1,
    `House ${y}: the derivation stands within the page's rounding (${cell(FED, y)} v ${AEC_HOUSE[y].nat})`);
});
assert.equal(cell(SEN.states.nsw, 2022), AEC_SEN[2022].nsw, "Senate NSW 2022: the page's 3.9");

// ---- gen-data wiring + the built page ---------------------------------------
const gen = fs.readFileSync(path.join(ROOT, ".build", "newtracker", "gen-data.mjs"), "utf8");
assert.ok(/const informalHistory = \(\(\) => \{/.test(gen), "gen-data's guarded read");
assert.ok(/const informalHistory = \$\{/.test(gen), "gen-data emits informalHistory into the data asset");
const val = fs.readFileSync(path.join(ROOT, ".build", "newtracker", "validate.mjs"), "utf8");
assert.ok(/validateInformalHistory\(\)/.test(val), "validate.mjs runs the invariant block");
const page = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
assert.ok(page.includes("Informal votes"), "the View: Informal votes stop is labelled in the built page");
assert.ok(page.includes("ExplainedInformalChart"), "the informal view's renderer is built into the page");

// ---- what the chart is handed ------------------------------------------------
const assetDir = path.join(ROOT, ".build", "newtracker", "assets");
const bundle = fs.readdirSync(assetDir).find((f) => /^9f09dca2-.*\.js$/.test(f));
assert.ok(bundle, "the data asset exists post-build");
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(assetDir, bundle), "utf8"), sandbox, { filename: bundle });
const IH = sandbox.window.AUSPOL.informalHistory;
assert.ok(IH, "window.AUSPOL.informalHistory reaches the chart");
const wanted = { ...doc };
delete wanted._comment;
// the vm realm's Array/Object prototypes differ – re-serialise before comparing
assert.deepEqual(JSON.parse(JSON.stringify(IH)), wanted,
  "the asset carries the data file verbatim");

console.log("test-informal-history: all assertions passed");
