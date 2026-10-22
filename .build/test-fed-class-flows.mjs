/* test-fed-class-flows.mjs – pins the explainer's federal per-class flow
   series (user 2026-10-22: add "Federal, inner metro/outer metro/
   provincial/rural" views to the preference-flow history chart "to the
   extent aec seat classification data is available", extended the same day
   to 2001 — "there's 2001 seat classification data too" — to 2004 — "there's
   2004 data in repo now" — and, once the 1996/1998 classification blocks
   landed, to 1996):
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
   chart's caption quotes, the 2025 column reconciles with the elec2025r
   region carriers gen-data types from the same source table (cross-checked
   there against the vendored DoP), and the built data asset hands the
   chart the classes under flowHistory.fed.classes with no error bars.
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
   the small-base caveat, and it quotes the thinnest of them */
const thin = data.classes.inner.votes.onp[6];
assert.equal(thin[0] + thin[1], 1508, "the caption's 1,508-ballot inner-metro 2013 One Nation base");

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
assert.deepEqual(Object.keys(FH.fed.classes), CLASS_IDS, "fed.classes carries the four");
CLASS_IDS.forEach((k) => {
  const got = FH.fed.classes[k];
  assert.equal(got.fedClass, true, `${k}: marked a federal class view`);
  assert.deepEqual([...got.years], YEARS, `${k}: years`);
  BUCKETS.forEach((b) => assert.deepEqual([...got[b]], data.classes[k][b], `${k} ${b} reaches the asset`));
  assert.deepEqual(Object.keys(got).sort(), ["elections", "fedClass", "grn", "label", "onp", "oth", "short", "years"].sort(),
    `${k}: shares only — counts carry no error bars, so no Err arrays`);
  assert.equal(got.elections, `federal elections in ${CLASS_SHORTS[k]} seats`, `${k}: the chart head's scope line`);
});
assert.ok(!Object.keys(FH).includes("classes"), "classes nests under fed, never a chip key of its own");

console.log("test-fed-class-flows: all assertions passed");
