/* test-fed-class-flows.mjs – pins the explainer's federal per-class flow
   series (user 2026-10-22: add "Federal, inner metro/outer metro/
   provincial/rural" views to the preference-flow history chart "to the
   extent aec seat classification data is available"): data/fed-class-flows.json,
   computed by .build/fed-class-flows.py from the committed AEC "TCP flow of
   preferences by division" downloads (.build/aec-flow-src/tcpflow-{2007…2022}.csv.gz
   and data/aec-2025-tcp-flow-by-division.csv), grouped by the AEC's own
   per-election division classifications (data/division-classifications.json),
   four classes × seven elections (2007–2025; no per-division product reaches
   further, so 2007 is the floor). The pins: the data file re-parses exactly
   from the caches (the Coalition spelling set includes 2010's LNQ LNP), the
   classic-seat counts match the per-year guard, One Nation's lone null is
   inner metro 2016 (the only class-year its ballots never reached a classic
   seat's final two), the thin 2013 inner-metro One Nation base is the 1,508
   ballots the chart's caption quotes, the 2025 column reconciles with the
   elec2025r region carriers gen-data types from the same source table
   (cross-checked there against the vendored DoP), and the built data asset
   hands the chart the classes under flowHistory.fed.classes with no error
   bars. Runs after the build in npm test's chain (the data asset only
   reflects the current dataset post-build). */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const YEARS = [2007, 2010, 2013, 2016, 2019, 2022, 2025];
const CLASS_IDS = ["inner", "outer", "provincial", "rural"];
const CLASS_SHORTS = { inner: "inner metro", outer: "outer metro", provincial: "provincial", rural: "rural" };
const CLASS_LABELS = { inner: "Inner metropolitan", outer: "Outer metropolitan", provincial: "Provincial", rural: "Rural" };
const NAME_TO_ID = { "Inner Metropolitan": "inner", "Outer Metropolitan": "outer", Provincial: "provincial", Rural: "rural" };
const BUCKETS = ["grn", "onp", "oth"];
/* the Coalition spelling space of the TCP files, 2007–2025: 2010 alone
   writes Queensland's LNP as LNQ */
const COAL = new Set(["LP", "NP", "CLP", "LNP", "LNQ", "NAT", "LIB"]);
const GREENS = new Set(["GRN", "GWA", "GVIC", "AGV", "TG"]);
const ONP = new Set(["HAN", "ON"]);
const bucketOf = (code) => (GREENS.has(code) ? "grn" : ONP.has(code) ? "onp" : "oth");

// ---- recompute from the committed AEC cache + the classification store ------
const tcpRows = (y) => {
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
  return dest.has("ALP") && [...dest].every((p) => p === "ALP" || COAL.has(p));
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
           transferring to majors is not a "flow" */
        if (r.fid === "0" || r.frm === "ALP" || COAL.has(r.frm)) continue;
        const b = bucketOf(r.frm);
        const t = (acc[cid] ||= {})[b] ||= [0, 0];
        t[r.to === "ALP" ? 0 : 1] += r.n;
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
assert.deepEqual(data.years, YEARS, "the seven per-division-table elections, in order");
assert.deepEqual(Object.keys(data.classes), CLASS_IDS, "inner, outer, provincial, rural — in the chart's order");
assert.deepEqual(classic, data.classicSeats, "classic-seat counts per year");
assert.deepEqual(divs, data.divisions, "total divisions per year (151 in 2019 and 2022)");
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
assert.deepEqual(classic, [147, 142, 139, 133, 136, 124, 115], "classic seats fall as crossbench finals rise");
/* the 2025 per-class classic counts are the elec2025r region carriers'
   own denominators (gen-data types "25 of 43", "40 of 45", "50 of 62") */
assert.equal(classClassic2025.inner, 25, "inner-metro classic seats 2025 (gen-data's 25 of 43)");
assert.equal(classClassic2025.outer, 40, "outer-metro classic seats 2025 (gen-data's 40 of 45)");
assert.equal(classClassic2025.provincial + classClassic2025.rural, 50, "regional or rural classic seats 2025 (gen-data's 50 of 62)");

// ---- the One Nation null map ------------------------------------------------
assert.equal(data.classes.inner.onp[3], null, "inner-metro One Nation: no classic-seat ballots, 2016");
CLASS_IDS.forEach((k) => BUCKETS.forEach((b) => data.classes[k][b].forEach((v, yi) => {
  if (!(k === "inner" && b === "onp" && yi === 3)) assert.ok(v != null, `${k} ${b} ${YEARS[yi]} has a counted base`);
})));
/* every share shown is the share of whatever ballots exist (user 2026-10-22:
   number the points for whatever data exists for each) — the caption carries
   the small-base caveat, and it quotes the thinnest of them */
const thin = data.classes.inner.votes.onp[2];
assert.equal(thin[0] + thin[1], 1508, "the caption's 1,508-ballot inner-metro 2013 One Nation base");

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
