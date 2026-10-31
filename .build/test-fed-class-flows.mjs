/* test-fed-class-flows.mjs – pins the explainer's federal per-class flow
   series (user 2026-10-22: add "Federal, inner metro/outer metro/
   provincial/rural" views to the preference-flow history chart "to the
   extent aec seat classification data is available", extended the same day
   to 2001 — "there's 2001 seat classification data too" — to 2004 — "there's
   2004 data in repo now" — and, once the 1996/1998 classification blocks
   landed, to 1996; the five IRSAD fifths q1..q5 joined the classes bank
   2026-10-24 — user: display the ABS SEIFA data beside the AEC's division
   classifications in the explainer menu views, decisions: quintile bands
   of thirty seats, IRSAD only, all three measures — and the IEO index's
   own fifths e1..e5 followed the same day (user: "do what you did for
   irsad to ieo"):
   data/fed-class-flows.json, computed by .build/fed-class-flows.py from
   the committed AEC "two-candidate-preferred flow of preferences by
   division" tables (.build/aec-flow-src/tcp-{1996,1998,2001}.json.gz —
   the statistics packs' per-division "Two Candidate Preferred Preference
   Flow Result" tables (1996/98 V3_1<state>.TXT, 2001 v3_10 per division),
   derived by aec-tcp-history.py —
   .build/aec-flow-src/tcpflow-{2004…2022}.csv.gz (2004's hauled from the
   same downloads product line as 2007–2022:
   results.aec.gov.au/12246/results/Downloads/HouseTcpFlowByDivisionDownload-12246.csv)
   and data/aec-2025-tcp-flow-by-division.csv), grouped by the AEC's own
   per-election division classifications (data/division-classifications.json;
   every era canonical-on-page: 1996/1998 transcribed from the AEC's
   whole-chamber "Divisional Classifications" pages of those elections,
   2001/2004 from the per-division profile pages — 2001's via Wayback
   captures with three RR5 gap fills, 2004's from the live profiles),
   four classes × eleven elections (1996–2025; 1996 is the flow table's
   own floor, and the classification store reaches it too). The pins: the
   data file re-parses exactly from the caches (the Coalition spelling set
   includes 2010's LNQ LNP; Labor's banner set includes CLR, Country
   Labor's 2001 rural-NSW banner — nine classic seats' finals name it), the
   classic-seat counts match the per-year guard (1996: 142 of 148 —
   non-classic Calare, Curtin, Kalgoorlie, Moore and Wills on their
   independent-affected finals and Murray on its LP-v-NP Coalition-internal
   final; 1998: 144 of 148 — Blair on Hanson's own HAN-v-LP final, Calare,
   Mayo DEM-v-LP, Newcastle GRN-v-ALP; 2004: 146 of 150 …), One Nation's
   nulls are 1996 in every class (the party first stood federally in
   1998 — its HAN code's 1998 ballots live behind that column) and inner
   metro 2016 (the only counted-party class-year its ballots never reached
   a classic seat's final two), the 1996/1998/2001 columns recombine
   ballot-exact to flow-lef.json's own national classic votes — the
   totals the chart's national line draws (FLOW_HISTORY's 67.1/50.9/·,
   73.3/46.3/55.2 and 74.8/44.1/57.0; aec-flow-history.py's classic
   table recomputes the bucket flows from the same tcp packs with CLR
   in Labor's set, so the legacy classic-<year>.json extracts' own
   flow rows — 1996/1998 a couple of thousand Others ballots off,
   2001 the 136-seat cut that dropped the nine CLR-finalist seats —
   never feed the chart), the
   2004 column reconciles with the state-level TPP-flow table tpp-2004.csv
   (per-state classic sums are exact for the five jurisdictions with no
   non-classic final; NSW/QLD/SA are residual by their IND-final seats),
   the thin 2013 inner-metro One Nation base is the 1,508 ballots the
   chart's caption derives (its thinnest-base note reads the record), the 2025 column reconciles with the elec2025r
   region carriers gen-data types from the same source table (cross-checked
   there against the vendored DoP), and the built data asset hands the
   chart the classes under flowHistory.fed.classes with no error bars.
   2026-10-23 (user-approved "don't accept 'can't be done'" plan): the
   views switch basis in place at 2004 — the classic-seat figures stay as
   the pre-2004 hollow rings, while from 2004 the count covers every seat
   (the store's TOP-LEVEL allSeats block beside classes, recovered from
   the per-division TPP table plus the state flow tables' non-classic
   leftovers; mixed-class state cells are first-preference estimates,
   flagged in allSeats.est). A fourth lumped "All minor parties" line
   runs the full 1996–2025 span off the store's merged allSeats.lump
   (classic basis pre-2004), summing the three buckets so three-cornered
   Coalition drift never touches it. The asset pins here assert the
   merged per-bucket series, hollowYears = 1996–2001, the lumped line
   (allSeats.lump verbatim), the boolean est flags, and ballots's four
   cohorts (grn/onp/oth/lump — vote pairs behind every figure).
   2026-10-24 (user IRSAD-fifths ask, above; the IEO fifths followed the
   same day): the store's seifa block beside classes mirrors both lanes
   for BOTH indexes on the index series' own span, 2001–2025 (the seifa
   store's 2028 cells score unelected boundaries — never a cut year;
   pre-2001 holds no IRSAD or IEO block). Each index's membership is
   probed from data/division-seifa-indexes.json here (thirty seats a
   fifth by advantage-ordered rank — IRSAD's `rank` is already
   advantaged-first; the IEO cells' plain rank keeps the
   1 = most-disadvantaged print order, so it reflects n+1−rank — the
   151-seat chambers' spare to the most-disadvantaged fifth; name
   anchors Bonython/
   North Sydney 2001 on both, Lingiari/Banks 2025 on IRSAD plus IEO's
   own corner cases the same year), both lanes recompute from the same AEC caches
   keyed by each fifth (the leftover engine's census alone switches
   grouping), and the built-asset pins assert the merged bank (classes
   then q1..q5 then e1..e5), hollowYears = [2001], the seifa flag and
   per-record ix tag, and the per-fifth elections copy gen-data composes
   from each desc and index name.
   Runs after the build in npm test's chain (the data asset only reflects
   the current dataset post-build). */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const YEARS = [1996, 1998, 2001, 2004, 2007, 2010, 2013, 2016, 2019, 2022, 2025];
const CLASS_IDS = ["inner", "outer", "provincial", "rural"];
const CLASS_SHORTS = { inner: "inner metro", outer: "outer metro", provincial: "provincial", rural: "rural" };
const CLASS_LABELS = { inner: "Inner metropolitan", outer: "Outer metropolitan", provincial: "Provincial", rural: "Rural" };
const NAME_TO_ID = { "Inner Metropolitan": "inner", "Outer Metropolitan": "outer", Provincial: "provincial", Rural: "rural" };
const BUCKETS = ["grn", "onp", "oth"];
/* the Labor banners of the TCP tables, 1996–2025: CLR is Country Labor,
   Labor's banner in rural NSW seats of the era — nine 2001 classic
   seats' finals name it, and leaving it out drops every one of them */
const LABOR = new Set(["ALP", "CLR"]);
/* the Coalition spelling space of the TCP files, 1996–2025: 2010 alone
   writes Queensland's LNP as LNQ */
const COAL = new Set(["LP", "NP", "CLP", "LNP", "LNQ", "NAT", "LIB"]);
const GREENS = new Set(["GRN", "GWA", "GVIC", "AGV", "TG"]);
const ONP = new Set(["HAN", "ON"]);
const bucketOf = (code) => (GREENS.has(code) ? "grn" : ONP.has(code) ? "onp" : "oth");

// ---- recompute from the committed AEC cache + the classification store ------
/* 1996–2001's source is the statistics-pack JSON, {div: {"pair": [a, b],
   "from": [[party, to-a, to-b], …]}}: a from-row's transfers resolve in
   pair order. It unfolds here into the same row shape as the 2004+ CSVs —
   including the Coalition cross-transfer rows the accumulation then
   excludes, exactly as the CSVs carry them (their own majors-cross rows
   ride the same filter) */
const tcpRowsStatsPack = (y) => {
  const j = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(ROOT, ".build", "aec-flow-src", `tcp-${y}.json.gz`))));
  const rows = [];
  Object.entries(j).forEach(([div, d]) => d.from.forEach(([frm, n1, n2]) => {
    rows.push({ div, frm, to: d.pair[0], n: n1 });
    rows.push({ div, frm, to: d.pair[1], n: n2 });
  }));
  return rows;
};
const tcpRows = (y) => {
  if (y <= 2001) return tcpRowsStatsPack(y);
  const file = y === 2025
    ? path.join(ROOT, "data", "aec-2025-tcp-flow-by-division.csv")
    : path.join(ROOT, ".build", "aec-flow-src", `tcpflow-${y}.csv.gz`);
  assert.ok(fs.existsSync(file), `tcp-flow cache for ${y} is committed`);
  const raw = file.endsWith(".gz") ? zlib.gunzipSync(fs.readFileSync(file)) : fs.readFileSync(file);
  const lines = raw.toString("utf8").replace(/^\uFEFF/, "").split(/\r?\n/);
  /* the AEC quotes fields holding commas ("Shooters, Fishers and Farmers
     Party") — split on commas outside quotes (same recipe as the state
     flow test) */
  const parse = (ln) => ln.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((x) => x.replace(/^"|"$/g, ""));
  const head = parse(lines[1]);
  const col = (name) => { const i = head.indexOf(name); assert.ok(i >= 0, `${y}: ${name} column in the TCP table`); return i; };
  const [DIV, FID, FRM, TO, N] = ["DivisionNm", "FromCandidateID", "FromCandidatePartyAb", "ToCandidatePartyAb", "TransferCount"].map(col);
  return lines.slice(2).filter((ln) => ln.trim()).map((ln) => {
    const c = parse(ln);
    return { div: c[DIV], fid: c[FID], frm: (c[FRM] || "").trim(), to: (c[TO] || "").trim(), n: +c[N] };
  });
};
const classesOf = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "division-classifications.json"), "utf8")).elections;
const isClassic = (rows) => {
  const dest = new Set(rows.map((r) => r.to));
  return [...dest].some((p) => LABOR.has(p)) && [...dest].every((p) => LABOR.has(p) || COAL.has(p));
};
const recompute = () => {
  const out = {};
  CLASS_IDS.forEach((k) => { out[k] = { grn: [], onp: [], oth: [], votes: { grn: [], onp: [], oth: [] } }; });
  const classic = [], divs = [], classClassic2025 = {};
  YEARS.forEach((y, yi) => {
    const nameToId = {};
    Object.entries(classesOf[String(y)]).forEach(([name, r]) => { nameToId[name] = NAME_TO_ID[r.classification]; });
    const byDiv = new Map();
    tcpRows(y).forEach((r) => { (byDiv.get(r.div) ?? byDiv.set(r.div, []).get(r.div)).push(r); });
    const acc = {};
    let nClass = 0;
    for (const [name, rows] of byDiv) {
      if (!isClassic(rows)) continue;  // a crossbencher reached the final two
      const cid = nameToId[name];
      assert.ok(cid, `${y}: division ${name} matches a four-class row`);
      nClass++;
      if (y === 2025) classClassic2025[cid] = (classClassic2025[cid] || 0) + 1;
      for (const r of rows) {
        /* the First Preferences pseudo-row names the final two; majors
           transferring to majors is not a "flow" (Labor banners included —
           a 2001 CLR cross-transfer in a Coalition-final seat would hide
           here; none exists, and the filter stands ready) */
        if (r.fid === "0" || LABOR.has(r.frm) || COAL.has(r.frm)) continue;
        const b = bucketOf(r.frm);
        const t = (acc[cid] ||= {})[b] ||= [0, 0];
        t[LABOR.has(r.to) ? 0 : 1] += r.n;
      }
    }
    CLASS_IDS.forEach((k) => BUCKETS.forEach((b) => {
      const [a, l] = ((acc[k] || {})[b]) || [0, 0];
      out[k][b][yi] = a + l ? Math.round(1000 * a / (a + l)) / 10 : null;
      out[k].votes[b][yi] = a + l ? [a, l] : null;
    }));
    classic.push(nClass); divs.push(byDiv.size);
  });
  return { out, classic, divs, classClassic2025 };
};
const { out: fresh, classic, divs, classClassic2025 } = recompute();

// ---- the data file matches the recompute ------------------------------------
const data = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "fed-class-flows.json"), "utf8"));
assert.deepEqual(data.years, YEARS, "the eleven per-division-table elections, in order");
assert.deepEqual(Object.keys(data.classes), CLASS_IDS, "inner, outer, provincial, rural — in the chart's order");
assert.deepEqual(classic, data.classicSeats, "classic-seat counts per year");
assert.deepEqual(divs, data.divisions, "total divisions per year");
CLASS_IDS.forEach((k) => {
  const c = data.classes[k];
  assert.equal(c.label, CLASS_LABELS[k], `${k}: full label`);
  assert.equal(c.short, CLASS_SHORTS[k], `${k}: the menu's "Federal, …" face`);
  BUCKETS.forEach((b) => {
    assert.deepEqual(c[b], fresh[k][b], `${k} ${b}: data file matches the AEC caches`);
    assert.deepEqual(c.votes[b], fresh[k].votes[b], `${k} ${b}: ballots match the AEC caches`);
    c[b].forEach((v) => { if (v != null) assert.ok(v >= 0 && v <= 100, `${k} ${b}: a share (${v})`); });
  });
});
assert.deepEqual(classic, [142, 144, 145, 146, 147, 142, 139, 133, 136, 124, 115], "classic seats fall as crossbench finals rise");
/* 1996's six non-classic finals: Calare (Andren), Curtin (Rocher) and
   Moore (Stoffels) on their independent incumbents' pairs, Kalgoorlie and
   Murray on Coalition-internal LP-v-NP finals, Wills on its independent
   Phil Cleary defence */
assert.equal(classic[0], 142, "1996 classic count — 148 less Calare, Curtin, Kalgoorlie, Moore, Murray, Wills");
/* 1998's four: Blair (Pauline Hanson's own HAN-v-LP final), Calare (Andren),
   Mayo (DEM-v-LP), Newcastle (GRN-v-ALP) */
assert.equal(classic[1], 144, "1998 classic count — 148 less Blair, Calare, Mayo, Newcastle");
assert.equal(classic[2], 145, "2001's CLR-aware classic count — nine CLR-finalist seats over the legacy 136");
/* 2004's four non-classic finals: Calare (Andren), New England (Windsor) and
   Kennedy (Katter) on their independent incumbents' coalitions-side pairs,
   Mayo on independent Brian Deegan's run against Alexander Downer */
assert.equal(classic[3], 146, "2004 classic count — 150 less Calare, New England, Kennedy, Mayo");
assert.deepEqual(divs, [148, 148, 150, 150, 150, 150, 150, 150, 151, 151, 150], "total divisions (148 in 1996/1998, 151 in 2019 and 2022)");
/* the 2025 per-class classic counts are the elec2025r region carriers'
   own denominators (gen-data types "25 of 43", "40 of 45", "50 of 62") */
assert.equal(classClassic2025.inner, 25, "inner-metro classic seats 2025 (gen-data's 25 of 43)");
assert.equal(classClassic2025.outer, 40, "outer-metro classic seats 2025 (gen-data's 40 of 45)");
assert.equal(classClassic2025.provincial + classClassic2025.rural, 50, "regional or rural classic seats 2025 (gen-data's 50 of 62)");

// ---- the One Nation null map ------------------------------------------------
/* 1996 goes first: the party stood federally for the first time in 1998, so
   that column has no One Nation ballots anywhere — null in all four classes.
   The only counted-party null after that is inner metro 2016 */
[0, 1, 2, 3].forEach((ci) => assert.equal(data.classes[CLASS_IDS[ci]].onp[0], null,
  `${CLASS_IDS[ci]} One Nation: the party's own absence ahead of its first federal campaign, 1996`));
assert.equal(data.classes.inner.onp[7], null, "inner-metro One Nation: no classic-seat ballots, 2016");
CLASS_IDS.forEach((k) => BUCKETS.forEach((b) => data.classes[k][b].forEach((v, yi) => {
  if (!(b === "onp" && (yi === 0 || (k === "inner" && yi === 7)))) assert.ok(v != null, `${k} ${b} ${YEARS[yi]} has a counted base`);
})));
/* every share shown is the share of whatever ballots exist (user 2026-10-22:
   number the points for whatever data exists for each) — the caption carries
   the small-base caveat, computed from the record's own thinnest base */
const thin = data.classes.inner.votes.onp[6];
assert.equal(thin[0] + thin[1], 1508, "the 1,508-ballot inner-metro 2013 One Nation classic base");
/* the One Nation caveats are composed from the record shown (2026-10-25:
   the static sentence named the wrong end of the SEIFA ladder) */
{
  const jsxSrc = fs.readFileSync(path.join(ROOT, ".build", "newtracker", "assets", "rd-allpolls.jsx"), "utf8");
  assert.ok(jsxSrc.includes("const onpGapYears = S.fedClass ? YEARS.filter((y, i) => y >= 1998 && (S.onp || [])[i] == null) : [];")
      && jsxSrc.includes("+ onpGapNote + thinNote")
      && !jsxSrc.includes("stood in hardly any of the most-disadvantaged seats"),
    "the class captions read One Nation's gaps and thinnest base off the record");
}

// ---- the 1996–2001 columns recombine to flow-lef.json's own national votes --
/* the four classes' counted ballots must sum to exactly the national classic
   totals the chart's national line draws: FLOW_HISTORY ships FLOW_LEF's own
   cells, and flow-lef.json's votes for these three elections are the same
   tcp packs' CLR-aware recompute (aec-flow-history.py classic_table — it
   takes only primaries/TPP/seats from the legacy classic-<year>.json
   extract, never that file's flow rows: 1996/1998's sit a couple of
   thousand Others ballots off these, and classic-2001.json's are the
   136-seat cut that dropped the nine CLR-finalist divisions
   (aec-tcp-history.py's header has that story)). Ballot-exact, no ±: at
   these three elections the classes sit exactly on the chart's points. */
{
  const LEF = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "flow-lef.json"), "utf8"));
  [1996, 1998, 2001].forEach((y) => {
    const yi = YEARS.indexOf(y);
    BUCKETS.forEach((b) => {
      let a = 0, l = 0;
      CLASS_IDS.forEach((k) => { (data.classes[k].votes[b][yi] || []).forEach((n, i) => { if (i) l += n; else a += n; }); });
      const target = LEF[String(y)].votes[b];
      if (target == null) {
        assert.equal(a + l, 0, `${y} ${b}: no counted base anywhere (matches flow-lef's null)`);
      } else {
        assert.deepEqual([a, l], target, `${y} ${b}: classes recombine ballot-exact to flow-lef's national classic votes`);
      }
    });
  });
}

// ---- the 2004 column reconciles with the state-level TPP-flow table ---------
/* tcpflow-2004.csv.gz is the same downloads-product family as 2007–2022, so
   it answers instead of the DoP-derived fallback the summary sketched — but
   the event also ships tpp-2004.csv ("… Two Party Preferred Flow of
   Preferences By State By Party"), the per-state oracle. Summing the
   per-division file's classic-seat ballots per state per bucket must equal
   the oracle's sums wherever NO division ran a non-classic final: both
   products count the same holder-at-exclusion ballots off the same count.
   In 2004 that holds for ACT, NT, TAS, VIC and WA — and exactly so (to the
   ballot). NSW (Calare, New England), QLD (Kennedy) and SA (Mayo) are
   residual by their IND-final seats and pinned here by name instead. */
{
  const NONCLASSIC2004 = { NSW: ["Calare", "New England"], QLD: ["Kennedy"], SA: ["Mayo"] };
  const CLEAN2004 = ["ACT", "NT", "TAS", "VIC", "WA"];
  const rows = tcpRows(2004);
  const finals = {};
  rows.filter((r) => r.fid === "0").forEach((r) => (finals[r.div] ||= new Set()).add(r.to));
  const ncl = new Set(Object.entries(finals).filter(([, d]) => !([...d].some((p) => LABOR.has(p)) && [...d].every((p) => LABOR.has(p) || COAL.has(p)))).map(([dv]) => dv));
  assert.deepEqual(Object.values(NONCLASSIC2004).flat().sort(), [...ncl].sort(), "the 2004 non-classic divisions are the four IND finals");
  assert.equal(ncl.size, 4, "exactly four non-classic finals in 2004");
  /* the per-division file carries a StateAb column, so the state of every
     division is in-file; the name map is only for the pinned note */
  const raw = zlib.gunzipSync(fs.readFileSync(path.join(ROOT, ".build", "aec-flow-src", "tcpflow-2004.csv.gz"))).toString("utf8");
  const parse4 = (ln) => ln.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((x) => x.replace(/^"|"$/g, ""));
  const lines4 = raw.split(/\r?\n/);
  const head4 = parse4(lines4[1]);
  const [S, D, FID4, FRM4, TO4, N4] = ["StateAb", "DivisionNm", "FromCandidateID", "FromCandidatePartyAb", "ToCandidatePartyAb", "TransferCount"].map((n) => head4.indexOf(n));
  const mine = {};
  lines4.slice(2).filter((ln) => ln.trim()).forEach((ln) => {
    const c = parse4(ln);
    if (c[FID4] === "0" || ncl.has(c[D])) return;
    const frm = c[FRM4].trim(), to = c[TO4].trim();
    if (LABOR.has(frm) || COAL.has(frm)) return;
    const st = (mine[c[S]] ||= {});
    const t = (st[bucketOf(frm)] ||= [0, 0]);
    t[LABOR.has(to) ? 0 : 1] += +c[N4];
  });
  const orc = {};
  fs.readFileSync(path.join(ROOT, ".build", "aec-flow-src", "tpp-2004.csv"), "utf8").split(/\r?\n/).slice(2).filter((ln) => ln.trim()).forEach((ln) => {
    const c = parse4(ln);
    if (!c[1] || LABOR.has(c[1]) || COAL.has(c[1])) return;  // the totals row and the majors' own rides
    const t = ((orc[c[0]] ||= {})[bucketOf(c[1])] ||= [0, 0]);
    t[0] += +c[5]; t[1] += +c[3];
  });
  CLEAN2004.forEach((s) => BUCKETS.forEach((b) => {
    assert.deepEqual(mine[s][b], orc[s][b], `2004 ${s} ${b}: classic per-division sums == the state TPP-flow table`);
  }));
  Object.entries(NONCLASSIC2004).forEach(([s, seats]) => BUCKETS.forEach((b) => {
    const [a, l] = mine[s][b] ?? [0, 0], [oa, ol] = orc[s][b];
    assert.ok(oa - a > 0 || ol - l > 0, `2004 ${s} ${b}: the oracle exceeds the classic cut by (${oa - a}, ${ol - l}) — ${seats.join(", ")}'s ballots`);
  }));
}

// ---- the 2025 column reconciles with gen-data's elec2025r carriers ----------
/* gen-data types the region carriers from .build/aec-2025-region-tpp-flows.mjs
   over the SAME source csv (there cross-checked seat-by-seat against the
   vendored distribution of preferences); the class series must round to them */
const genSrc = fs.readFileSync(path.join(ROOT, ".build", "newtracker", "gen-data.mjs"), "utf8");
const counted = (label, cov) => {
  const re = new RegExp('counted\\("' + label + '"[\\s\\S]*?"' + cov + '", ([\\d.]+), ([\\d.]+), ([\\d.]+)\\)');
  const m = genSrc.match(re);
  assert.ok(m, `gen-data's ${label} elec2025r carrier`);
  return { grn: +m[1], onp: +m[2], oth: +m[3] };
};
const last = YEARS.length - 1;
const recomb = (keys, b) => {
  let a = 0, l = 0;
  keys.forEach((k) => { const v = data.classes[k].votes[b][last]; if (v) { a += v[0]; l += v[1]; } });
  return 100 * a / (a + l);
};
const ref = { inner: counted("Inner metro seats", "25 of 43"), outer: counted("Outer metro seats", "40 of 45"),
  regional: counted("Regional or rural seats", "50 of 62"), all: counted("Labor-v-Coalition seats", "115 of 150") };
BUCKETS.forEach((b) => {
  assert.ok(Math.abs(data.classes.inner[b][last] - ref.inner[b]) < 0.051, `inner ${b} 2025 matches elec2025r`);
  assert.ok(Math.abs(data.classes.outer[b][last] - ref.outer[b]) < 0.051, `outer ${b} 2025 matches elec2025r`);
  assert.ok(Math.abs(recomb(["provincial", "rural"], b) - ref.regional[b]) < 0.051, `regional ${b} 2025 matches elec2025r`);
  assert.ok(Math.abs(recomb(CLASS_IDS, b) - ref.all[b]) < 0.051, `all-classic ${b} 2025 matches elec2025r`);
});

// ---- the all-seats 2004+ blocks: an independent recompute -------------------
/* data/fed-class-flows.json's allSeats block adds the whole-chamber cut:
   per class, every seat's non-major ballots (the lump) and each bucket's
   share over all seats. This recomputes the whole derivation from the
   caches: classic TCP flows by division, the state's TPP-by-party table
   minus those classic seats = the non-classic leftover, taken exactly
   where the state's non-classic seats share one class and allocated over
   bucket first preferences (flagged est) where they span classes. The
   lump is the buckets summed — a TPP-minus-first-preferences lump would
   carry three-cornered Coalition→ALP ballots, which are not minor-party
   votes (the consistency-guard exemplar is pinned below: NSW 2004's
   1,570 such ballots inside Calare + New England). */
const csvSplit = (ln) => ln.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((x) => x.replace(/^"|"$/g, ""));
const pyr = (x) => { const f = Math.floor(x), d = x - f; return d > 0.5 ? f + 1 : d < 0.5 ? f : (f % 2 ? f + 1 : f); };
const pyr1 = (x) => pyr(x * 10) / 10;
const CLASS_OF_LABEL = { "Inner Metropolitan": "inner", "Outer Metropolitan": "outer", Provincial: "provincial", Rural: "rural" };
const tcpFlowByDiv = (y) => {
  /* {flow: Map(div -> {b:[toALP,toCOAL]}), cross: Map(div -> Coalition→ALP n)} –
     classic divisions only, from the per-division TCP flow table */
  const byDiv = new Map();
  tcpRows(y).forEach((r) => { const m = byDiv.get(r.div) ?? byDiv.set(r.div, []).get(r.div); m.push(r); });
  const flow = new Map(), cross = new Map();
  for (const [name, rows] of byDiv) {
    const dest = new Set(rows.map((r) => r.to));
    if (![...dest].some((p) => LABOR.has(p)) || ![...dest].every((p) => LABOR.has(p) || COAL.has(p))) continue;
    const b = { grn: [0, 0], onp: [0, 0], oth: [0, 0] };
    let drift = 0;
    for (const r of rows) {
      if (r.fid === "0") continue;              // the First Preferences pseudo-row names the final two
      if (LABOR.has(r.frm)) { assert.ok(!COAL.has(r.to), `${y}: Labor ballots to Coalition in classic ${name}`); continue; }
      if (COAL.has(r.frm)) { if (LABOR.has(r.to)) drift += r.n; continue; }  // three-cornered drift / same-pile shuffles
      b[bucketOf(r.frm)][LABOR.has(r.to) ? 0 : 1] += r.n;
    }
    flow.set(name, b);
    if (drift) cross.set(name, drift);
  }
  return { flow, cross };
};
const dopFirstPrefs = (y) => {
  /* Map(div -> {alp, coal, grn, onp, oth}) from the distribution-of-preferences
     download's CountNumber-0 Preference Count rows (never the Percent pair) */
  const raw = zlib.gunzipSync(fs.readFileSync(path.join(ROOT, ".build", "aec-flow-src", `dop-${y}.csv.gz`))).toString("utf8");
  const lines = raw.split(/\r?\n/);
  const head = csvSplit(lines[1]);
  const [D, CN, CT, PA, CV] = ["DivisionNm", "CountNumber", "CalculationType", "PartyAb", "CalculationValue"].map((n) => head.indexOf(n));
  const per = new Map();
  lines.slice(2).filter((ln) => ln.trim()).forEach((ln) => {
    const c = csvSplit(ln);
    const t = c[CT].toLowerCase();
    if (c[CN].trim() !== "0" || !t.includes("preference") || !t.includes("count")) return;
    const p = c[PA].trim();
    const key = LABOR.has(p) ? "alp" : COAL.has(p) ? "coal" : bucketOf(p);
    const rec = per.get(c[D].trim()) ?? per.set(c[D].trim(), { alp: 0, coal: 0, grn: 0, onp: 0, oth: 0, coalC: [] }).get(c[D].trim());
    rec[key] += +c[CV];
    if (key === "coal") rec.coalC.push(+c[CV]);
  });
  /* coal2: Coalition first preferences outside the leading Coalition
     candidate – nonzero only in three-cornered seats */
  per.forEach((rec) => { rec.coal2 = rec.coalC.length ? rec.coalC.reduce((s, v) => s + v, 0) - Math.max(...rec.coalC) : 0; });
  return per;
};
/* fed-class-flows.py's fit_mixed_state, line for line: a mixed state's
   non-classic leftover split to division x bucket by proportional fitting
   to each seat's bucket first preferences, each seat's minor ballots to
   Labor (TPP Labor less Labor first preferences, drift off) and each
   bucket's state leftover. Returns {cells: Map("div|bk" -> [a, l]),
   driftEst: Set(div)} */
const IPF_ITERS = 400;
const fitMixedState = (y, st, divs, fpd, tpp, left, ncDrift) => {
  const tri = divs.filter((d) => (fpd.get(d).coal2 || 0) > 0);
  const driftD = Object.fromEntries(divs.map((d) => [d, 0]));
  let driftEst = new Set();
  if (Math.abs(ncDrift) > 0.5) {
    assert.ok(tri.length, `${y}: ${st} non-classic drift ${ncDrift} with no three-cornered seat`);
    const w = tri.reduce((s, d) => s + fpd.get(d).coal2, 0);
    tri.forEach((d) => { driftD[d] = ncDrift * fpd.get(d).coal2 / w; });
    if (tri.length > 1) driftEst = new Set(tri);
  }
  const row = {};
  divs.forEach((d) => {
    const tot = BUCKETS.reduce((s, bk) => s + fpd.get(d)[bk], 0);
    const a = Math.min(Math.max(tpp.get(d)[1] - fpd.get(d).alp - driftD[d], 0), tot);
    row[d] = [a, tot - a];
  });
  const x = new Map();
  BUCKETS.forEach((bk) => {
    const [la, ll] = left[bk];
    const r = la + ll > 0 ? la / (la + ll) : 0;
    divs.forEach((d) => x.set(d + "|" + bk, [fpd.get(d)[bk] * r, fpd.get(d)[bk] * (1 - r)]));
  });
  for (let it = 0; it < IPF_ITERS; it++) {
    divs.forEach((d) => [0, 1].forEach((i) => {
      const s = BUCKETS.reduce((z, bk) => z + x.get(d + "|" + bk)[i], 0);
      if (s > 0) { const f = row[d][i] / s; BUCKETS.forEach((bk) => { x.get(d + "|" + bk)[i] *= f; }); }
    }));
    BUCKETS.forEach((bk) => [0, 1].forEach((i) => {
      const s = divs.reduce((z, d) => z + x.get(d + "|" + bk)[i], 0);
      if (s > 0) { const f = left[bk][i] / s; divs.forEach((d) => { x.get(d + "|" + bk)[i] *= f; }); }
    }));
    divs.forEach((d) => BUCKETS.forEach((bk) => {
      const c = x.get(d + "|" + bk), s = c[0] + c[1];
      if (s > 0) { const f = fpd.get(d)[bk] / s; c[0] *= f; c[1] *= f; }
    }));
  }
  const worst = Math.max(...divs.map((d) => Math.abs(BUCKETS.reduce((z, bk) => z + x.get(d + "|" + bk)[0], 0) - row[d][0])),
    ...BUCKETS.map((bk) => Math.abs(divs.reduce((z, d) => z + x.get(d + "|" + bk)[0], 0) - left[bk][0])));
  assert.ok(worst <= 2, `${y}: ${st} count-anchored fit missed a margin by ${worst.toFixed(1)} ballots`);
  return { cells: x, driftEst };
};
/* a mixed state's fitted cells summed into its groups; the lump flags
   where a spread drift crossed groups */
const assignMixed = (y, st, bygrp, fpd, tpp, left, ncDrift, acc, est, lumpEst) => {
  const divs = Object.values(bygrp).flat().sort();
  const { cells, driftEst } = fitMixedState(y, st, divs, fpd, tpp, left, ncDrift);
  Object.entries(bygrp).forEach(([k, ds]) => ds.forEach((d) => BUCKETS.forEach((bk) => {
    const [a, l] = cells.get(d + "|" + bk);
    if (a + l <= 0) return;
    acc[k][bk][0] += a; acc[k][bk][1] += l; est[k].add(bk);
  })));
  const hit = Object.keys(bygrp).filter((k) => bygrp[k].some((d) => driftEst.has(d)));
  if (hit.length > 1) hit.forEach((k) => lumpEst.add(k));
};
const tppdivTotals = (y) => {
  /* Map(name -> [toCOAL, toALP]) over every division of the chamber */
  const lines = fs.readFileSync(path.join(ROOT, ".build", "aec-flow-src", `tppdiv-${y}.csv`), "utf8").split(/\r?\n/);
  const head = csvSplit(lines[1]);
  const ci = head.findIndex((h) => /coalition votes/i.test(h));
  const ai = head.findIndex((h) => /labor party votes/i.test(h));
  assert.ok(ci > 0 && ai > 0, `${y}: tppdiv vote columns found by name`);
  const out = new Map();
  lines.slice(2).filter((ln) => ln.trim()).forEach((ln) => {
    const c = csvSplit(ln);
    const name = c[0].trim();
    if (!name || name === "Total") return;
    out.set(name, [+c[ci], +c[ai]]);
  });
  return out;
};
const stateFlowTable = (y) => {
  /* {per: {st: {b:[toALP,toCOAL]}}, drift: {st: Coalition→ALP}} from the
     TPP flow by state by party. A Labor-source row is a layout surprise
     (Labor is a finalist in every seat's TPP cut, so it never transfers). */
  const ext = fs.existsSync(path.join(ROOT, ".build", "aec-flow-src", `tpp-${y}.csv`)) ? "csv" : "txt";
  const lines = fs.readFileSync(path.join(ROOT, ".build", "aec-flow-src", `tpp-${y}.${ext}`), "utf8").split(/\r?\n/);
  const head = lines[1].split(ext === "csv" ? "," : "\t");
  const alpFirst = /labor/i.test(head[3]);
  const per = {}, drift = {};
  const splitl = (ln) => (ext === "csv" ? csvSplit(ln) : ln.split("\t"));
  lines.slice(2).filter((ln) => ln.trim()).forEach((ln) => {
    const c = splitl(ln);
    if (c.length < 7) return;
    const code = c[1].trim();
    if (!code) return;                          // each state's First Preferences aggregate row
    const [toA, toC] = alpFirst ? [+c[3], +c[5]] : [+c[5], +c[3]];
    const st = c[0].trim();
    if (LABOR.has(code)) throw new Error(`${y}: Labor-source row in the state flow table (${st} ${code})`);
    if (COAL.has(code)) { drift[st] = (drift[st] || 0) + toA; return; }
    const b = (per[st] ??= { grn: [0, 0], onp: [0, 0], oth: [0, 0] })[bucketOf(code)];
    b[0] += toA; b[1] += toC;
  });
  return { per, drift };
};
const expectedAll = {};
CLASS_IDS.forEach((k) => { expectedAll[k] = { grn: [], onp: [], oth: [], lump: [], lumpVotes: [], lumpEst: [], votes: { grn: [], onp: [], oth: [] }, est: { grn: [], onp: [], oth: [] } }; });
const mixedRoster = {};                        // {year: {state: [class ids]}} over multi-class state cells
const census = [];                             // every (year,state) cell with its classes, for the exact-side pin
YEARS.forEach((y, yi) => {
  if (y < 2004) {
    CLASS_IDS.forEach((k) => {
      let a = 0, l = 0;
      BUCKETS.forEach((b) => { expectedAll[k][b][yi] = null; expectedAll[k].votes[b][yi] = null; expectedAll[k].est[b][yi] = false; const v = fresh[k].votes[b][yi]; if (v) { a += v[0]; l += v[1]; } });
      expectedAll[k].lump[yi] = a + l ? pyr1(100 * a / (a + l)) : null;
      expectedAll[k].lumpVotes[yi] = a + l ? [pyr(a), pyr(l)] : null;
      expectedAll[k].lumpEst[yi] = false;
    });
    return;
  }
  const { flow, cross } = tcpFlowByDiv(y);
  const fpd = dopFirstPrefs(y);
  const tpp = tppdivTotals(y);
  const { per: sf, drift } = stateFlowTable(y);
  const clas = classesOf[String(y)];
  const leftover = {};
  Object.entries(sf).forEach(([st, m]) => { leftover[st] = { grn: [...(m.grn || [0, 0])], onp: [...(m.onp || [0, 0])], oth: [...(m.oth || [0, 0])] }; });
  const classicSum = {};                       // class id -> {b: [a,c]}
  flow.forEach((b, name) => {
    const rec = clas[name];
    assert.ok(rec, `${y}: classic division ${name} matches a classification row`);
    const k = CLASS_OF_LABEL[rec.classification];
    assert.ok(k, `${y}: ${name} class ${rec.classification}`);
    BUCKETS.forEach((bk) => {
      leftover[rec.state][bk][0] -= b[bk][0];
      leftover[rec.state][bk][1] -= b[bk][1];
      const t = (classicSum[k] ??= { grn: [0, 0], onp: [0, 0], oth: [0, 0] })[bk];
      t[0] += b[bk][0]; t[1] += b[bk][1];
    });
  });
  Object.entries(leftover).forEach(([st, m]) => BUCKETS.forEach((bk) => {
    assert.ok(Math.min(...m[bk]) >= -0.75, `${y}: ${st} ${bk} non-classic leftover negative: ${m[bk]}`);
  }));
  // non-classic census + the three-cornered drift consistency identity
  const nc = {};                               // st -> classId -> [divisions]
  const crossByState = {};
  flow.forEach((_, name) => { const st = clas[name].state; crossByState[st] = (crossByState[st] || 0) + (cross.get(name) || 0); });
  tpp.forEach((_, name) => {
    if (flow.has(name)) return;
    const rec = clas[name];
    assert.ok(rec, `${y}: non-classic division ${name} matches a classification row`);
    const k = CLASS_OF_LABEL[rec.classification];
    ((nc[rec.state] ??= {})[k] ??= []).push(name);
  });
  Object.entries(nc).forEach(([st, bycls]) => {
    const ks = Object.keys(bycls).sort();
    census.push([y, st, ks]);
    if (ks.length > 1) (mixedRoster[y] ??= {})[st] = ks;
    const ncDrift = (drift[st] || 0) - (crossByState[st] || 0);
    const lv = [0, 1].map((i) => BUCKETS.reduce((s, bk) => s + leftover[st][bk][i], 0));
    const divs = ks.flatMap((k) => bycls[k]);
    const mn = [0, 1].map((i) => divs.reduce((s, d) => {
      const t = tpp.get(d), p = fpd.get(d);
      assert.ok(t && p, `${y}: ${d} has tppdiv and first-preference rows`);
      return s + (i ? t[0] - p.coal : t[1] - p.alp);
    }, 0));
    assert.ok(Math.abs(lv[0] + ncDrift - mn[0]) <= 1, `${y}: ${st} leftover ${lv[0].toFixed(0)} + drift ${ncDrift} != per-division minors ${mn[0].toFixed(0)} (ALP side)`);
    assert.ok(Math.abs(lv[1] - ncDrift - mn[1]) <= 1, `${y}: ${st} leftover ${lv[1].toFixed(0)} - drift ${ncDrift} != per-division minors ${mn[1].toFixed(0)} (Coalition side)`);
  });
  // assign: exact for single-class states, the count-anchored fit otherwise
  const acc = {}, est = {}, lumpEst = new Set();
  CLASS_IDS.forEach((k) => { acc[k] = { grn: [0, 0], onp: [0, 0], oth: [0, 0] }; est[k] = new Set(); });
  Object.entries(nc).forEach(([st, bycls]) => {
    const ks = Object.keys(bycls);
    if (ks.length === 1) {
      BUCKETS.forEach((bk) => { acc[ks[0]][bk][0] += leftover[st][bk][0]; acc[ks[0]][bk][1] += leftover[st][bk][1]; });
    } else {
      assignMixed(y, st, bycls, fpd, tpp, leftover[st], (drift[st] || 0) - (crossByState[st] || 0), acc, est, lumpEst);
    }
  });
  CLASS_IDS.forEach((k) => {
    let la = 0, ll = 0;
    BUCKETS.forEach((b) => {
      const a = (classicSum[k]?.[b][0] || 0) + acc[k][b][0], l = (classicSum[k]?.[b][1] || 0) + acc[k][b][1];
      expectedAll[k][b][yi] = a + l ? pyr1(100 * a / (a + l)) : null;
      expectedAll[k].votes[b][yi] = a + l ? [pyr(a), pyr(l)] : null;
      expectedAll[k].est[b][yi] = est[k].has(b);
      la += a; ll += l;
    });
    expectedAll[k].lump[yi] = pyr1(100 * la / (la + ll));
    expectedAll[k].lumpVotes[yi] = [pyr(la), pyr(ll)];
    expectedAll[k].lumpEst[yi] = lumpEst.has(k);
  });
});
assert.deepEqual(data.allSeats ? Object.keys(data.allSeats) : [], CLASS_IDS, "allSeats carries the four classes in chart order");
CLASS_IDS.forEach((k) => {
  BUCKETS.forEach((b) => {
    assert.deepEqual(data.allSeats[k][b], expectedAll[k][b], `allSeats ${k} ${b}: shares recomputed from the AEC caches`);
    assert.deepEqual(data.allSeats[k].votes[b], expectedAll[k].votes[b], `allSeats ${k} ${b}: ballots recomputed from the AEC caches`);
    assert.deepEqual(data.allSeats[k].est[b], expectedAll[k].est[b], `allSeats ${k} ${b}: the est roster`);
  });
  assert.deepEqual(data.allSeats[k].lump, expectedAll[k].lump, `allSeats ${k} lump: every non-major ballot`);
  assert.deepEqual(data.allSeats[k].lumpVotes, expectedAll[k].lumpVotes, `allSeats ${k} lump ballots`);
  assert.deepEqual(data.allSeats[k].lumpEst, expectedAll[k].lumpEst, `allSeats ${k} lump: counted unless a drift spread crossed classes`);
});

// ---- the SEIFA fifths (IRSAD q1..q5, IEO e1..e5): the seifa classes/allSeats lanes
/* 2026-10-24 (user: show the ABS SEIFA data beside the AEC's division
   classifications in the flows-explained menu; decisions: fifths of thirty
   seats, IRSAD first, flows + 2PP + primary — these two lanes are the
   flows side; "do what you did for irsad to ieo" followed the same day,
   the IEO index's e1..e5 riding the same lanes). The store's seifa block
   mirrors the class lanes with each index's quintile membership of
   data/division-seifa-indexes.json standing in for the classification
   store: the advantage-ordered rank (IRSAD's `rank`, stored
   advantaged-first; the IEO and IER cells' plain ranks keep the
   1 = most-disadvantaged print order, reflected n+1−rank) ranks the
   chamber most-advantaged-first, and ceil(rank/30) is the fifth (the
   151-seat chambers' spare seat lands in the most-disadvantaged fifth).
   IRSAD alone upgrades to the census-INTERPOLATED percentile where the
   seifa store ships its `_pcti` factors (2013/2016/2019 today — user
   call 2026-10-24: the interpolated basis is the default), ranked
   most-first on the same thirty-a-fifth cut.
   The lanes run the index series' own
   span 2001–2025 — the block's 2028 forward cells score unelected
   boundaries, and the hollow column is 2001 alone (from 2004 the count
   covers every seat, exactly as the class lanes). */
const QIDXES = { irsad: "q", ieo: "e", ier: "r" };   // index -> its keys' leading letter
const QUINT_IDS = ["q1", "q2", "q3", "q4", "q5"];
const EOCTA_IDS = ["e1", "e2", "e3", "e4", "e5"];
const RESOURCE_IDS = ["r1", "r2", "r3", "r4", "r5"];
const SEIFA_IDS = [...QUINT_IDS, ...EOCTA_IDS, ...RESOURCE_IDS];
const SEIFA_YEARS = YEARS.filter((y) => y >= 2001);
/* each index's own span (2026-10-25): the store's 1998 block (APH CIB
   4/1998-99, 1996 census, 148 divisions) prints IEO and IER but no IRSAD,
   so those two lanes open at 1998 */
const IX_YEARS = { irsad: SEIFA_YEARS, ieo: [1998, ...SEIFA_YEARS], ier: [1998, ...SEIFA_YEARS] };
const ALL_SEIFA_YEARS = [1998, ...SEIFA_YEARS];
const YEARS_OF = (q) => IX_YEARS[IDX_OF(q)];
/* id -> [label, short, desc]: the copy is shared between the indexes —
   mirrors seifa_quintiles.py's INDEX_META meta tuples; the index itself
   rides each record's ix tag and composes into the elections copy */
const QUINT_META = {
  1: ["Most-advantaged fifth", "Top fifth", "most-advantaged fifth"],
  2: ["Second-most-advantaged fifth", "2nd fifth", "second-most-advantaged fifth"],
  3: ["Middle fifth", "Middle fifth", "middle fifth"],
  4: ["Second-most-disadvantaged fifth", "4th fifth", "second-most-disadvantaged fifth"],
  5: ["Most-disadvantaged fifth", "Bottom fifth", "most-disadvantaged fifth"],
};
const IDX_OF = (id) => Object.keys(QIDXES).find((ix) => QIDXES[ix] === id[0]);
const IX_NAME = { irsad: "IRSAD", ieo: "IEO", ier: "IER" };
/* a cell's advantage-ordered rank: IRSAD stores its `rank` advantaged-
   first (the rankDis twin is the misread the anchors pin against); the
   IEO and IER cells print the 1-most-disadvantaged convention, so
   reflect it (n+1−rank) */
const rankAdvOf = (ix, cell, n) => (ix === "irsad" ? cell.irsad.rank : n + 1 - cell[ix].rank);
const fifthOf = (ra, ix) => `${QIDXES[ix]}${Math.min(Math.floor((ra - 1) / 30) + 1, 5)}`;
const SEIFA_DOC = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "division-seifa-indexes.json"), "utf8"));
const seifaIdx = SEIFA_DOC.elections;
/* the elections whose IRSAD fifths cut on the census-interpolated
   percentile (the store's `_pcti.factors`; mirrors
   seifa_quintiles.interp_years()), and the basis phrase the IRSAD lanes'
   scope lines carry — mirrors seifa_quintiles.elections_suffix() on the
   store's current window. A new pcti factor year goes red here: that is
   a copy change wanting a human, never a silent re-pin */
const INTERP_YEARS = new Set(Object.keys(SEIFA_DOC._pcti.factors).map(Number));
const ELECTIONS_SUFFIX = (ix) => `of seats by ${IX_NAME[ix]}`;
/* each index's membership, probed from the seifa store: every fifth is
   thirty seats (the 151-seat 2019/2022 chambers' spare joins the most-
   disadvantaged fifth), the ranks are a permutation of 1..N, and the named
   anchors stay on rung */
const quintCell = {};        // ix -> year -> division name -> {id, state}
for (const ix of Object.keys(QIDXES)) {
  const ids = SEIFA_IDS.filter((k) => IDX_OF(k) === ix);
  quintCell[ix] = {};
  IX_YEARS[ix].forEach((y) => {
    const blk = seifaIdx[String(y)];
    assert.ok(blk, `${y}: a ${IX_NAME[ix]} block`);
    const ents = Object.entries(blk), n = ents.length;
    assert.ok(n === 148 || n === 150 || n === 151, `${y}: ${n} divisions (a 148, 150 or 151 seat chamber)`);
    const sizes = Object.fromEntries(ids.map((q) => [q, 0]));
    const ranks = [];
    quintCell[ix][y] = {};
    /* each division's advantage-ordered rank on THIS election's basis:
       every index at a pcti factor year ranks the census-interpolated
       percentile descending (IEO and IER since 2026-10-25) (highest percentile = advantage-rank 1;
       the percentiles are distinct, so the cut has no tie rule); every
       other cell reads the recorded rank */
    const raOf = new Map();
    if (INTERP_YEARS.has(y)) {
      const pcts = [];
      ents.forEach(([nm, cell]) => {
        const p = cell[ix].pcti;
        assert.ok(typeof p === "number" && p > 0 && p <= 1, `${y} ${nm}: an interpolated percentile in (0, 1]`);
        pcts.push(p);
      });
      assert.equal(new Set(pcts).size, n, `${y}: the interpolated percentiles are all distinct`);
      [...ents].sort((a, b) => b[1][ix].pcti - a[1][ix].pcti)
        .forEach(([nm], i) => raOf.set(nm, i + 1));
      /* the interpolation's footprint against the recorded-rank cut:
         twelve seats move fifths at 2013, ten at 2019 (the 151-seat
         chamber's spare-seat rung shifts the advantaged-first cut
         points), none at 2016 — its census sat five weeks after
         election day, so pcti ≈ rank; the CD-era lanes cut coarser —
         whole-unit polygon allocation, f far from the measured census
         (2004 21/14/66, 2007 8/2/12, 2010 30/8/39 by index; the era-90s
         arrival 2026-10-31 puts 1998's ieo/ier on the interpolated
         basis too — the doctrine's "interpolated wherever a factor
         exists", 14/36 fifths moved) */
      const moved = ents.filter(([nm, cell]) => fifthOf(raOf.get(nm), ix) !== fifthOf(rankAdvOf(ix, cell, n), ix)).length;
      assert.equal(moved, { irsad: { 2004: 21, 2007: 8, 2010: 30, 2013: 12, 2016: 0, 2019: 10 }, ieo: { 1998: 14, 2004: 14, 2007: 2, 2010: 8, 2013: 8, 2016: 0, 2019: 14 }, ier: { 1998: 36, 2004: 66, 2007: 12, 2010: 39, 2013: 18, 2016: 0, 2019: 18 } }[ix][y], `${y} ${ix}: pcti v rank movement`);
    } else {
      ents.forEach(([nm, cell]) => {
        assert.ok(cell[ix].pcti === undefined, `${y} ${nm}: no pcti outside the factor years`);
        raOf.set(nm, rankAdvOf(ix, cell, n));
      });
    }
    ents.forEach(([nm, cell]) => {
      assert.ok(cell[ix] && cell[ix].rank != null, `${y} ${nm}: a ${IX_NAME[ix]} cell`);
      const ra = raOf.get(nm);
      assert.ok(Number.isInteger(ra) && ra >= 1 && ra <= n, `${y} ${nm}: ${IX_NAME[ix]} rank in 1..${n}`);
      ranks.push(ra);
      const q = fifthOf(ra, ix);
      sizes[q] += 1;
      quintCell[ix][y][nm] = { id: q, state: cell.state };
    });
    assert.deepEqual([...ranks].sort((a, b) => a - b), Array.from({ length: n }, (_, i) => i + 1),
      `${y}: ${IX_NAME[ix]} ranks are a permutation of 1..${n}`);
    const want = {}; ids.forEach((q, i) => { want[q] = i === 4 ? n - 120 : 30; });
    assert.deepEqual(sizes, want, `${y}: thirty seats a ${IX_NAME[ix]} fifth, the disadvantaged end the 151-seat balance`);
  });
  const m1 = `${QIDXES[ix]}1`, m5 = `${QIDXES[ix]}5`, m2 = `${QIDXES[ix]}2`;
  assert.equal(quintCell[ix]["2001"]["Bonython"].id, m5, `2001 Bonython: the most-disadvantaged ${IX_NAME[ix]} fifth`);
  assert.equal(quintCell[ix]["2001"]["North Sydney"].id, m1, `2001 North Sydney: the most-advantaged ${IX_NAME[ix]} fifth`);
  if (ix === "ieo") {
    assert.equal(quintCell[ix]["2025"]["Lingiari"].id, `${QIDXES[ix]}4`, "2025 Lingiari: the second-most-disadvantaged IEO fifth");
  } else {
    assert.equal(quintCell[ix]["2025"]["Lingiari"].id, m5, `2025 Lingiari: the most-disadvantaged ${IX_NAME[ix]} fifth`);
  }
  assert.equal(quintCell[ix]["2025"]["Banks"].id, m2, `2025 Banks: the second-most-advantaged ${IX_NAME[ix]} fifth`);
}
/* the IER lane's own anchors (the same pins seifa_quintiles.py's INDEX_META
   gates the generator's membership on): Wide Bay, not Bonython, is 2001's
   most-disadvantaged IER seat — the anchors differ per index precisely so
   a cross-index rank read fails loudly; the 2025 Barker/Swan pair is the
   boundary pin, dis-ranks 30/31 reflecting to the last two advantage
   ranks (121/120) of the fourth fifth, so Barker closes the
   most-disadvantaged fifth from above while Swan keeps the fourth — the
   reflected read does NOT mirror the cut points seat-for-seat */
assert.equal(quintCell.ier["2001"]["Wide Bay"].id, "r5", "2001 Wide Bay: IER's most-disadvantaged division (not Bonython, as IRSAD's)");
assert.equal(quintCell.ier["2025"]["Barker"].id, "r5", "2025 Barker: the reflected rank-30 closes the most-disadvantaged IER fifth from above");
assert.equal(quintCell.ier["2025"]["Swan"].id, "r4", "2025 Swan: the reflected rank-31 keeps the fourth IER fifth");
assert.equal(quintCell.ier["2025"]["Mitchell"].id, "r1", "2025 Mitchell: IER's most-advantaged division");
/* the pcti lane's own anchors (the interpolation years' ends of the
   ladder, cut on the percentile itself): Lingiari closes the
   most-disadvantaged IRSAD fifth at all three, Spence's 151st rank is
   the 2019 spare, and Bradfield/Wentworth head the most-advantaged */
assert.equal(quintCell.irsad["2013"]["Lingiari"].id, "q5", "2013 Lingiari: the most-disadvantaged IRSAD fifth (interpolated)");
assert.equal(quintCell.irsad["2013"]["Bradfield"].id, "q1", "2013 Bradfield: the most-advantaged IRSAD fifth (interpolated)");
assert.equal(quintCell.irsad["2016"]["Lingiari"].id, "q5", "2016 Lingiari: the most-disadvantaged IRSAD fifth (interpolated)");
assert.equal(quintCell.irsad["2016"]["Wentworth"].id, "q1", "2016 Wentworth: the most-advantaged IRSAD fifth (interpolated)");
assert.equal(quintCell.irsad["2019"]["Spence"].id, "q5", "2019 Spence: the most-disadvantaged IRSAD fifth (the 151-seat spare, interpolated)");
assert.equal(quintCell.irsad["2019"]["Wentworth"].id, "q1", "2019 Wentworth: the most-advantaged IRSAD fifth (interpolated)");

// the classic-basis lane recompute, keyed by each index's fifths (same
// engines and filters as the class block's — only the grouping map changes)
const freshQ = {};
SEIFA_IDS.forEach((q) => { freshQ[q] = { grn: [], onp: [], oth: [], votes: { grn: [], onp: [], oth: [] } }; });
ALL_SEIFA_YEARS.forEach((y) => {
  const byDiv = new Map();
  tcpRows(y).forEach((r) => { (byDiv.get(r.div) ?? byDiv.set(r.div, []).get(r.div)).push(r); });
  for (const ix of Object.keys(QIDXES)) {
    const qi = IX_YEARS[ix].indexOf(y);
    if (qi < 0) continue;              // IRSAD has no 1998 block
    const acc = {};
    for (const [name, rows] of byDiv) {
      if (!isClassic(rows)) continue;
      const cell = quintCell[ix][y][name];
      assert.ok(cell, `${y}: classic division ${name} matches a ${IX_NAME[ix]} row`);
      for (const r of rows) {
        if (r.fid === "0" || LABOR.has(r.frm) || COAL.has(r.frm)) continue;
        const t = ((acc[cell.id] ||= {})[bucketOf(r.frm)] ||= [0, 0]);
        t[LABOR.has(r.to) ? 0 : 1] += r.n;
      }
    }
    SEIFA_IDS.filter((k) => IDX_OF(k) === ix).forEach((q) => BUCKETS.forEach((b) => {
      const [a, l] = ((acc[q] || {})[b]) || [0, 0];
      freshQ[q][b][qi] = a + l ? Math.round(1000 * a / (a + l)) / 10 : null;
      freshQ[q].votes[b][qi] = a + l ? [a, l] : null;
    }));
  }
});
// the all-seats lane recompute: the class block's leftover engine with its
// non-classic census keyed by each index's fifths; the lump runs the
// classic basis at the hollow 2001 column, mirroring the class lanes'
// merged run
const freshQAll = {};
SEIFA_IDS.forEach((q) => { freshQAll[q] = { grn: [], onp: [], oth: [], lump: [], lumpVotes: [], lumpEst: [], votes: { grn: [], onp: [], oth: [] }, est: { grn: [], onp: [], oth: [] } }; });
ALL_SEIFA_YEARS.forEach((y) => {
  if (y < 2004) {
    SEIFA_IDS.forEach((q) => {
      const qi = YEARS_OF(q).indexOf(y);
      if (qi < 0) return;
      let a = 0, l = 0;
      BUCKETS.forEach((b) => { freshQAll[q][b][qi] = null; freshQAll[q].votes[b][qi] = null; freshQAll[q].est[b][qi] = false; const v = freshQ[q].votes[b][qi]; if (v) { a += v[0]; l += v[1]; } });
      freshQAll[q].lump[qi] = a + l ? pyr1(100 * a / (a + l)) : null;
      freshQAll[q].lumpVotes[qi] = a + l ? [pyr(a), pyr(l)] : null;
      freshQAll[q].lumpEst[qi] = false;
    });
    return;
  }
  const { flow, cross } = tcpFlowByDiv(y);
  const fpd = dopFirstPrefs(y);
  const tpp = tppdivTotals(y);
  const { per: sf, drift } = stateFlowTable(y);
  const crossByState = {};
  flow.forEach((_, name) => { const st = classesOf[String(y)][name].state; crossByState[st] = (crossByState[st] || 0) + (cross.get(name) || 0); });
  const leftover = {};
  Object.entries(sf).forEach(([st, m]) => { leftover[st] = { grn: [...(m.grn || [0, 0])], onp: [...(m.onp || [0, 0])], oth: [...(m.oth || [0, 0])] }; });
  /* the classic seats come out of the state tables ONCE, ahead of the
     per-index lanes: the leftover is grouping-independent, so subtracting
     inside a lane would subtract again for the next */
  flow.forEach((b, name) => {
    const rec = classesOf[String(y)][name];
    assert.ok(rec, `${y}: classic division ${name} matches a classification row`);
    BUCKETS.forEach((bk) => {
      leftover[rec.state][bk][0] -= b[bk][0];
      leftover[rec.state][bk][1] -= b[bk][1];
    });
  });
  Object.entries(leftover).forEach(([st, m]) => BUCKETS.forEach((bk) => {
    assert.ok(Math.min(...m[bk]) >= -0.75, `${y}: ${st} ${bk} non-classic leftover negative: ${m[bk]}`);
  }));
  for (const ix of Object.keys(QIDXES)) {
    const qi = IX_YEARS[ix].indexOf(y);
    const ids = SEIFA_IDS.filter((k) => IDX_OF(k) === ix);
    const classicQ = {};
    flow.forEach((b, name) => {
      const cell = quintCell[ix][y][name];
      assert.ok(cell, `${y}: classic division ${name} matches a ${IX_NAME[ix]} row`);
      BUCKETS.forEach((bk) => {
        const t = (classicQ[cell.id] ??= { grn: [0, 0], onp: [0, 0], oth: [0, 0] })[bk];
        t[0] += b[bk][0]; t[1] += b[bk][1];
      });
    });
    const ncQ = {};
    tpp.forEach((_, name) => {
      if (flow.has(name)) return;
      const cell = quintCell[ix][y][name];
      assert.ok(cell, `${y}: non-classic division ${name} matches a ${IX_NAME[ix]} row`);
      ((ncQ[cell.state] ??= {})[cell.id] ??= []).push(name);
    });
    const accQ = {}, estQ = {}, lumpEstQ = new Set();
    ids.forEach((q) => { accQ[q] = { grn: [0, 0], onp: [0, 0], oth: [0, 0] }; estQ[q] = new Set(); });
    Object.entries(ncQ).forEach(([st, byq]) => {
      const ks = Object.keys(byq);
      if (ks.length === 1) {
        BUCKETS.forEach((bk) => { accQ[ks[0]][bk][0] += leftover[st][bk][0]; accQ[ks[0]][bk][1] += leftover[st][bk][1]; });
      } else {
        assignMixed(y, st, byq, fpd, tpp, leftover[st], (drift[st] || 0) - (crossByState[st] || 0), accQ, estQ, lumpEstQ);
      }
    });
    ids.forEach((q) => {
      let la = 0, ll = 0;
      BUCKETS.forEach((b) => {
        const a = (classicQ[q]?.[b][0] || 0) + accQ[q][b][0], l = (classicQ[q]?.[b][1] || 0) + accQ[q][b][1];
        freshQAll[q][b][qi] = a + l ? pyr1(100 * a / (a + l)) : null;
        freshQAll[q].votes[b][qi] = a + l ? [pyr(a), pyr(l)] : null;
        freshQAll[q].est[b][qi] = estQ[q].has(b);
        la += a; ll += l;
      });
      freshQAll[q].lump[qi] = pyr1(100 * la / (la + ll));
      freshQAll[q].lumpVotes[qi] = [pyr(la), pyr(ll)];
      freshQAll[q].lumpEst[qi] = lumpEstQ.has(q);
    });
  }
});
// the store's seifa lanes match both recomputes, each index's fifths
assert.ok(data.seifa && data.seifa.classes && data.seifa.allSeats, "the store carries the SEIFA-fifths lanes");
assert.deepEqual(data.seifa.years, ALL_SEIFA_YEARS, "the indexes' union span (1998–2025; the 2028 cells score unelected boundaries)");
assert.deepEqual(Object.keys(data.seifa.classes), SEIFA_IDS, "IRSAD's q1..q5, then IEO's e1..e5, then IER's r1..r5, most-advantaged first");
assert.deepEqual(Object.keys(data.seifa.allSeats), SEIFA_IDS, "the all-seats lane covers the same fifteen");
SEIFA_IDS.forEach((q) => {
  const ix = IDX_OF(q);
  const [label, short, desc] = QUINT_META[q[1]];
  const c = data.seifa.classes[q];
  assert.equal(c.label, label, `${q}: label`);
  assert.equal(c.short, short, `${q}: the menu face (the bare positional)`);
  assert.equal(c.desc, desc, `${q}: the descriptor the elections copy composes`);
  assert.equal(c.ix, ix, `${q}: the index tag the elections copy names`);
  assert.deepEqual(Object.keys(c).sort(), ["desc", "grn", "ix", "label", "onp", "oth", "short", "votes", "years"].sort(),
    `${q} classes: the lane's own keys, plus the ix tag and its years`);
  assert.deepEqual(c.years, YEARS_OF(q), `${q}: the index's own span (IEO/IER from 1998)`);
  const A = data.seifa.allSeats[q];
  BUCKETS.forEach((b) => {
    assert.deepEqual(c[b], freshQ[q][b], `seifa ${q} ${b}: classic basis matches the AEC caches`);
    assert.deepEqual(c.votes[b], freshQ[q].votes[b], `seifa ${q} ${b}: classic ballots match the caches`);
    assert.deepEqual(A[b], freshQAll[q][b], `seifa allSeats ${q} ${b}: all-seats shares match the caches`);
    assert.deepEqual(A.votes[b], freshQAll[q].votes[b], `seifa allSeats ${q} ${b}: all-seats ballots match`);
    assert.deepEqual(A.est[b], freshQAll[q].est[b], `seifa allSeats ${q} ${b}: the est roster`);
  });
  assert.deepEqual(A.lump, freshQAll[q].lump, `seifa allSeats ${q}: every non-major ballot (classic basis at 2001)`);
  assert.deepEqual(A.lumpVotes, freshQAll[q].lumpVotes, `seifa allSeats ${q}: lump ballots`);
  assert.deepEqual(A.lumpEst, freshQAll[q].lumpEst, `seifa allSeats ${q}: lump counted unless a drift spread crossed fifths`);
});

/* A state-year's non-classic seats spanning classes forces the count-
   anchored fit (and the est flag); the roster is pinned so a redistribution
   or a new crossbench era changes it by conscious edit, never silently. */
assert.deepEqual(mixedRoster, {
  2010: { NSW: ["inner", "rural"] },
  2013: { VIC: ["inner", "rural"] },
  2016: { NSW: ["inner", "rural"], SA: ["inner", "rural"], VIC: ["inner", "rural"] },
  2019: { NSW: ["inner", "provincial", "rural"], VIC: ["inner", "rural"] },
  2022: { NSW: ["inner", "outer", "provincial", "rural"], QLD: ["inner", "outer", "provincial", "rural"], VIC: ["inner", "rural"] },
  2025: { NSW: ["inner", "outer", "provincial", "rural"], QLD: ["inner", "outer", "provincial", "rural"], TAS: ["inner", "outer"], VIC: ["inner", "outer", "rural"] },
}, "the 14 mixed state-year cells (2010 NSW through 2025 VIC)");
assert.equal(census.filter(([, , ks]) => ks.length === 1).length, 26, "26 single-class state-year cells land exactly");

// ---- consistency-guard exemplar: the NSW 2004 three-cornered drift ---------
/* Calare and New England 2004 were fought by BOTH Coalition parties; the
   1,570 Coalition-to-ALP ballots inside them (the state table's LP 672 +
   NP 898) are not minor-party flows – the lump excludes them and the
   consistency guard puts the drift back when cross-checking the products. */
{
  const { flow, cross } = tcpFlowByDiv(2004);
  const fpd = dopFirstPrefs(2004);
  const tpp = tppdivTotals(2004);
  const { per: sf, drift } = stateFlowTable(2004);
  const lv2004 = [0, 1].map((i) => BUCKETS.reduce((s, bk) => s + sf.NSW[bk][i], 0) -
    [...flow].filter(([nm]) => classesOf["2004"][nm].state === "NSW")
      .reduce((s, [, b]) => s + BUCKETS.reduce((z, bk) => z + b[bk][i], 0), 0));
  assert.deepEqual(lv2004.map(Math.round), [47369, 47309], "NSW 2004 non-classic bucket leftovers");
  const mn2004 = [0, 1].map((i) => ["Calare", "New England"].reduce((s, d) => s + (i ? tpp.get(d)[0] - fpd.get(d).coal : tpp.get(d)[1] - fpd.get(d).alp), 0));
  assert.deepEqual(mn2004.map(Math.round), [48939, 45739], "Calare + New England TPP-minus-first-preferences");
  assert.equal(Math.round(drift.NSW), 1570, "NSW 2004 Coalition-to-ALP drift (LP 672 + NP 898)");
  assert.equal(Math.round(drift.NSW - ["Calare", "New England"].reduce((s, d) => s + (cross.get(d) || 0), 0)), 1570, "none of NSW 2004's drift sits in a classic seat");
}

// ---- the Grayndler 2022 tppdiv oracle ---------------------------------------
assert.deepEqual(tppdivTotals(2022).get("Grayndler").map(Math.round), [20002, 74571], "Grayndler 2022: ALP 74,571 v Coalition 20,002 in the TPP-by-division table");

// ---- the view reaches the elections menu ------------------------------------
const jsx = fs.readFileSync(path.join(ROOT, ".build", "newtracker", "assets", "rd-allpolls.jsx"), "utf8");
assert.ok(/"fedcl:" \+ k/.test(jsx), "the elections menu emits the fedcl:<class> options");
assert.deepEqual(Object.values(CLASS_SHORTS).sort(), ["inner metro", "outer metro", "provincial", "rural"].sort(),
  'the four "Federal, …" class faces');

// ---- what the chart is handed ------------------------------------------------
const asset = fs.readdirSync(path.join(ROOT, ".build", "newtracker", "assets")).filter((f) => /^9f09dca2-.*\.js$/.test(f));
assert.equal(asset.length, 1, "exactly one built data asset");
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, ".build", "newtracker", "assets", asset[0]), "utf8"), sandbox, { filename: asset[0] });
const FH = sandbox.window.AUSPOL.flowHistory;
assert.ok(FH.fed.classes, "flowHistory.fed.classes in the built data asset");
assert.deepEqual(Object.keys(FH.fed.classes), [...CLASS_IDS, ...SEIFA_IDS],
  "fed.classes carries the four class cuts, then the fifteen SEIFA fifths (IRSAD, then IEO, then IER)");
CLASS_IDS.forEach((k) => {
  const got = FH.fed.classes[k];
  assert.equal(got.fedClass, true, `${k}: marked a federal class view`);
  assert.equal(got.seifa, undefined, `${k}: a class cut carries no seifa flag`);
  assert.deepEqual([...got.years], YEARS, `${k}: years`);
  /* classic seats only until 2004 (hollow rings); all-seats from 2004 */
  assert.deepEqual([...got.hollowYears], [...YEARS.slice(0, 3)], `${k}: classic-seats rings stop at 2001`);
  /* per-party shares merge classic ≤2001 with all-seats ≥2004 */
  const allSeats = data.allSeats[k];
  BUCKETS.forEach((b) => {
    const merged = YEARS.map((y, yi) => (yi < 3 ? data.classes[k][b][yi] : allSeats[b][yi]));
    assert.deepEqual([...got[b]], merged, `${k} ${b} merges classic ≤2001 with all-seats ≥2004`);
    assert.equal(typeof got["est" + b[0].toUpperCase() + b.slice(1)][0], "boolean", `${k} est${b} reaches the asset as booleans`);
  });
  /* the fourth lumped line is the full 1996–2025 run; the store's
     allSeats.lump already carries the classic-basis lump pre-2004 and
     the all-seats lump from 2004, so the emitted series passes through */
  assert.deepEqual([...got.lump], [...allSeats.lump], `${k} lump is the store's merged 11-year run`);
  assert.deepEqual([...got.estLump], [...allSeats.lumpEst], `${k} estLump is the store's lumpEst (a count unless a drift spread crossed classes)`);
  assert.deepEqual(Object.keys(got.ballots).sort(), ["grn", "lump", "onp", "oth"].sort(), `${k}: ballots carries the four cohorts`);
  assert.deepEqual(Object.keys(got).sort(), ["ballots", "elections", "estGrn", "estLump", "estOnp", "estOth", "fedClass", "grn", "hollowYears", "label", "lump", "onp", "oth", "short", "years"].sort(),
    `${k}: shares and estimate flags, no Err arrays`);
  assert.equal(got.elections, `federal elections in ${CLASS_SHORTS[k]} seats`, `${k}: the chart head's scope line`);
});
/* the SEIFA fifths ride the same emit machinery on the index series' own
   span: hollow 2001 ring only (the series' floor — from 2004 the count
   covers every seat), plus the seifa flag and ix tag the three charts
   fork their captions on */
SEIFA_IDS.forEach((q) => {
  const ix = IDX_OF(q);
  const got = FH.fed.classes[q];
  assert.equal(got.fedClass, true, `${q}: marked a federal class view`);
  assert.equal(got.seifa, true, `${q}: the seifa flag the captions fork on`);
  assert.equal(got.ix, ix, `${q}: the index tag the captions and menu split on`);
  assert.deepEqual([...got.years], YEARS_OF(q), `${q}: the index series' span`);
  assert.deepEqual([...got.hollowYears], YEARS_OF(q).filter((y) => y < 2004), `${q}: the pre-2004 rings are hollow`);
  assert.equal(got.short, QUINT_META[q[1]][1], `${q}: the menu face`);
  /* every index rides one basis, so the scope line names just the
     index (the interpolation window lives in How it's built) */
  const wantEls = `federal elections in the ${QUINT_META[q[1]][2]} ${ELECTIONS_SUFFIX(ix)}`;
  assert.equal(got.elections, wantEls,
    `${q}: the chart head's scope line names the grouping and index`);
  const allSeats = data.seifa.allSeats[q];
  BUCKETS.forEach((b) => {
    const merged = YEARS_OF(q).map((y, yi) => (y < 2004 ? data.seifa.classes[q][b][yi] : allSeats[b][yi]));
    assert.deepEqual([...got[b]], merged, `${q} ${b} merges classic pre-2004 with all-seats 2004+`);
    assert.equal(typeof got["est" + b[0].toUpperCase() + b.slice(1)][0], "boolean", `${q} est${b} reaches the asset as booleans`);
  });
  assert.deepEqual([...got.lump], [...allSeats.lump], `${q} lump is the store's merged run`);
  assert.deepEqual([...got.estLump], [...allSeats.lumpEst], `${q} estLump is the store's lumpEst`);
  assert.deepEqual(Object.keys(got.ballots).sort(), ["grn", "lump", "onp", "oth"].sort(), `${q}: ballots carries the four cohorts`);
  assert.deepEqual(Object.keys(got).sort(),
    ["ballots", "elections", "estGrn", "estLump", "estOnp", "estOth", "fedClass", "grn", "hollowYears", "ix", "label", "lump", "onp", "oth", "seifa", "short", "years"].sort(),
    `${q}: the class-cut record plus the seifa flag and ix tag`);
});
/* the IEO fifths' own Green-flow runs (1998 on), merged classic pre-2004 + all-seats
   2004+ exactly as the renderer draws them (the count-anchored fit's
   values since 2026-10-25; e5's 2004/2007/2010 re-pinned the same day
   when the pcti basis reached the CD-era lanes and re-cut those
   elections' fifths; the 1998 positions re-pinned 2026-10-31 when the
   era-90s pcti lanes put 1998's IEO/IER on the interpolated basis —
   14/5th-boundary seats moved, shifting the 1998 Green shares 73.6→74.2
   and 68.6→67.0 on the e1/e5 rungs) */
assert.deepEqual([...FH.fed.classes.e1.grn], [74.2, 79.6, 84.2, 83.4, 82.1, 85.4, 84.1, 85.4, 89, 91.2], "e1 Green flow (IEO most-advantaged fifth)");
assert.deepEqual([...FH.fed.classes.e5.grn], [67, 64.7, 75, 73.5, 75.3, 77.1, 76.9, 76.7, 80.3, 82.3], "e5 Green flow (IEO most-disadvantaged fifth)");
/* the IER fifths' own Green-flow runs (economic resources beside the
   education-and-occupation ladder), merged classic 2001 + all-seats 2004+
   — the 2019/2022 values are the regenerated store's own, NOT a naive
   swap of the shipped day's pair: a reflected fifth boundary moves one
   151st seat, so the mirror trap bites at indices 6/7 here too; the
   1998 positions re-pinned 2026-10-31 with the era-90s pcti arrival
   (70.8→70.9 and 77.8→76.1 on the r1/r5 1998 reads) */
assert.deepEqual([...FH.fed.classes.r1.grn], [70.9, 79.1, 82.1, 79.5, 79.2, 83.1, 81.2, 81.9, 85.7, 88.8], "r1 Green flow (IER most-advantaged fifth)");
assert.deepEqual([...FH.fed.classes.r5.grn], [76.1, 73, 77.8, 80.2, 80, 83.8, 83.3, 83, 86.6, 87.6], "r5 Green flow (IER most-disadvantaged fifth)");
assert.ok(!Object.keys(FH).includes("classes"), "classes nests under fed, never a chip key of its own");

console.log("test-fed-class-flows: all assertions passed");
