/* test-aec-booth.mjs – pins the booth-grain stores (data/booth-primary.json,
   data/booth-tpp.json, data/booth-flows.json) that .build/aec-booth.py
   generates from the committed AEC per-polling-place sources
   (.build/aec-flow-src/booth/{fpv,tpp-pp,tcf}/ plus ../hcands-*.txt,
   ../htpp-*.txt and the oracle/ vote-type family), with division classes
   joined from data/division-classifications.json. CHECKS:
   1. Shape: year/bucket/stream/cut manifests, n>0, med between p25 and
      p75, shares in range.
   2. Full re-derivation by this probe's OWN parsers of the raw sources
      (never the generator's arithmetic or constants): FPV 2004–2025 sums
      ≡ the fpvvt oracle family per candidate; FPV 1993–2001 ≡ the
      hcands rosters modulo the 64 pinned 1993 strays; TPP 2016–2025 ≡
      tppvt ordinary per division; TPP 2004–2013 ≡ tcpcvt ordinary per
      classic pair (classic detection = the row SET is exactly one Labor
      + one Coalition code — Coalition-internal pairs like 2010
      O'Connor read non-classic, exactly as the generator's doctrine);
      flows ≡ the committed tcpflow oracles per classic division per
      bucket. Distributions rebuilt off these per-booth records (this
      probe's own median/quartile interpolation) must equal every cell
      of every cut in the three stores to the written precision.
   3. Era pins: the 1993 median-booth cell, the 1996 HTPP cell, and the
      modern 2007/2013/2025 cells — the numbers the README quotes.
*/
import assert from "node:assert/strict";
import fs from "node:fs";
import zlib from "node:zlib";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, ".build", "aec-flow-src");
const BOOTH = path.join(SRC, "booth");

const MOD = [2004 , 2007, 2010, 2013, 2016, 2019, 2022, 2025];
const STATS = [1993, 1996, 1998, 2001];
const HTT = [1996, 1998, 2001];
const TPP_YEARS = [...HTT, ...MOD];
const FLOW_YEARS = MOD;
const STATES = ["nsw", "vic", "qld", "wa", "sa", "tas", "act", "nt"];
const CLASSES = ["inner", "outer", "provincial", "rural"];
const STREAMS = ["ord", "pp", "abs", "post", "prov"];
const CLS_KEY = { "inner metropolitan": "inner", "outer metropolitan": "outer",
  "provincial": "provincial", "rural": "rural" };
const HTT_EXCLUDED = { 1998: new Set(["Newcastle"]) };

// this probe's own party taxonomy (derived from the committed source
// files' spellings, never imported from the generator)
const LABOR = new Set(["ALP", "CLR"]);
const COAL = new Set(["LP", "NP", "CLP", "LNP", "LNQ", "NAT", "LIB"]);
const GREENS = new Set(["GRN", "GWA", "GVIC", "AGV", "TG"]);
const ONP = new Set(["HAN", "ON"]);
const bucket = (code) => LABOR.has(code) ? "alp"
  : COAL.has(code) ? "lnp" : GREENS.has(code) ? "grn"
  : ONP.has(code) ? "onp" : "oth";
const flowBucket = (code) => (LABOR.has(code) || COAL.has(code)) ? null
  : GREENS.has(code) ? "grn" : ONP.has(code) ? "onp" : "oth";

// ---- file readers -----------------------------------------------------------
const readRows = (p, delim = ",") => {
  const raw = p.endsWith(".gz")
    ? zlib.gunzipSync(fs.readFileSync(p)).toString("utf8")
    : fs.readFileSync(p, "utf8");
  const text = raw.replace(/^﻿/, "");
  // RFC-4180-ish split adequate to these AEC products (quoted cells carry
  // commas only in names, which this probe never splits on — verified on
  // the headers: the counted columns are all comma-free)
  return text.split(/\r?\n/).map((l) => parseLine(l, delim));
};
const parseLine = (line, delim) => {
  const out = [];
  let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else q = false;
      } else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === delim) { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out;
};
const headerMap = (rows, firstCell, name) => {
  const i = rows.findIndex((r) => r.length && strip(r[0]) === firstCell);
  assert.ok(i >= 0, `${name}: a ${firstCell}-led header row`);
  const h = {};
  rows[i].forEach((c, j) => { h[strip(c)] = j; });
  return [i, h];
};
const strip = (s) => s.trim().replace(/^"|"$/g, "").trim();
const num = (s) => {
  const v = Number(strip(s));
  assert.ok(Number.isFinite(v), `a numeric cell (${JSON.stringify(s)})`);
  return v;
};

// stream classification, the generator's keyword taxonomy restated from
// the stores' own _comment doctrine (never called from the generator)
const streamOf = (pp) => {
  const n = pp.trim().toUpperCase();
  if (n === "ABSENT") return "abs";
  if (n === "POSTAL") return "post";
  if (n === "PROVISIONAL") return "prov";
  if (n.includes("PPVC") || n.startsWith("PRE POLL") || n.startsWith("PREPOLL"))
    return "pp";
  return "ord";
};

// quantile: linear interpolation, the convention the store cells round
const qtl = (xs, f) => {
  if (!xs.length) return null;
  const pos = (xs.length - 1) * f;
  const lo = Math.floor(pos), hi = Math.min(lo + 1, xs.length - 1);
  return xs[lo] * (1 - (pos - lo)) + xs[hi] * (pos - lo);
};
// The generator is Python; its round() is banker's rounding (half to even).
// Math.round is half-up, which diverges exactly on binary-representable
// .xx5 boundaries (observed: rural 2004 lnp p75 65.625). Replicate it.
const pyRound2 = (x) => {
  const y = x * 100;
  const f = Math.floor(y), d = y - f;
  if (Math.abs(d - 0.5) < 1e-9) return ((f % 2 === 0 ? f : f + 1) / 100);
  return Math.round(y) / 100;
};
const dist = (shares) => {
  const s = [...shares].sort((a, b) => a - b);
  if (!s.length) return undefined;
  return { n: s.length, med: pyRound2(qtl(s, 0.5)),
    p25: pyRound2(qtl(s, 0.25)), p75: pyRound2(qtl(s, 0.75)) };
};

const CLASSES_ALL = JSON.parse(fs.readFileSync(
  path.join(ROOT, "data", "division-classifications.json"), "utf8")).elections;

// ---- per-lane recompute -----------------------------------------------------
// Each lane returns a flat list of booth records the distribution builder
// then cuts: {div, st, stream, bucket|alp, share} — this probe's own sums.

const cutRows = (records, keyOf) => {
  // cut -> year -> series-key -> [shares]
  const cuts = { nat: {} };
  for (const c of [...STATES, ...CLASSES, ...STREAMS]) cuts[c] = {};
  for (const rec of records) {
    const homes = ["nat", rec.st, rec.stream];
    const blk = CLASSES_ALL[String(rec.year)];
    if (blk) {
      const d = blk[rec.div];
      assert.ok(d, `${rec.year} ${rec.div}: classified`);
      homes.push(CLS_KEY[d.classification.toLowerCase()]);
    }
    const key = keyOf(rec);
    for (const home of homes)
      (((cuts[home][String(rec.year)] ||= {})[key] ||= []).push(rec.share));
  }
  return cuts;
};

const FPV_EXC = Object.create(null);   // 1993's 64 count-line-vs-roster strays, pinned
FPV_EXC["Bass|ALP"] = 1; FPV_EXC["Bass|LP"] = 1; FPV_EXC["Bass|TG"] = 2;
FPV_EXC["Bendigo|"] = 1; FPV_EXC["Bendigo|ALP"] = 17; FPV_EXC["Bendigo|DEM"] = 1;
FPV_EXC["Bendigo|IND"] = 1; FPV_EXC["Bendigo|LP"] = 2; FPV_EXC["Bruce|DEM"] = 7;
FPV_EXC["Bruce|NLP"] = -7; FPV_EXC["Canberra|ALP"] = -1; FPV_EXC["Canberra|ASG"] = 1;
FPV_EXC["Canberra|DEM"] = 2; FPV_EXC["Canberra|GDA"] = -1; FPV_EXC["Cook|ALP"] = -1;
FPV_EXC["Cook|CTA"] = 3; FPV_EXC["Cook|NLP"] = -1; FPV_EXC["Corangamite|CTA"] = 1;
FPV_EXC["Corangamite|DEM"] = 2; FPV_EXC["Corangamite|LP"] = -1; FPV_EXC["Cowper|ALP"] = 1;
FPV_EXC["Cowper|NP"] = -1; FPV_EXC["Fraser|IND"] = 2; FPV_EXC["Gilmore|DEM"] = 1;
FPV_EXC["Gilmore|GRN"] = -1; FPV_EXC["Kingston|ALP"] = 2; FPV_EXC["Kingston|DEM"] = 1;
FPV_EXC["Kingston|LP"] = 1; FPV_EXC["Macquarie|ALP"] = -1; FPV_EXC["Macquarie|DEM"] = -1;
FPV_EXC["Macquarie|LP"] = -2; FPV_EXC["Macquarie|NLP"] = -3; FPV_EXC["McMillan|IND"] = 1;
FPV_EXC["Moncrieff|ALP"] = -3; FPV_EXC["Murray|ALP"] = -2; FPV_EXC["Murray|DEM"] = -1;
FPV_EXC["Murray|IND"] = -1; FPV_EXC["Murray|NP"] = -2; FPV_EXC["Newcastle|"] = -2;
FPV_EXC["Newcastle|ALP"] = -5; FPV_EXC["Newcastle|GRN"] = -3; FPV_EXC["Newcastle|IND"] = 2;
FPV_EXC["Newcastle|LP"] = -9; FPV_EXC["Page|IND"] = 2; FPV_EXC["Page|NLP"] = -1;
FPV_EXC["Riverina|IND"] = 1; FPV_EXC["Riverina|NP"] = -1; FPV_EXC["Robertson|ALP"] = -1;
FPV_EXC["Robertson|DEM"] = -1; FPV_EXC["Robertson|LP"] = 2; FPV_EXC["Sydney|"] = 3;
FPV_EXC["Sydney|DEM"] = 2; FPV_EXC["Throsby|"] = 3; FPV_EXC["Throsby|AFI"] = 1;
FPV_EXC["Throsby|GRN"] = 4; FPV_EXC["Throsby|RCL"] = -1; FPV_EXC["Wakefield|ALP"] = 1;
FPV_EXC["Wakefield|DEM"] = -1; FPV_EXC["Wakefield|IND"] = 2; FPV_EXC["Wakefield|LP"] = -1;
FPV_EXC["Wakefield|NLP"] = -2; FPV_EXC["Wannon|DEM"] = 3; FPV_EXC["Wannon|IND"] = 5;
FPV_EXC["Wannon|NLP"] = 5;

const fpvRecords = [];
const fpvSums = {};              // `${y}|${div}|${party}` -> votes (modern, per code)
for (const y of MOD) {
  // oracle: the vote-type family's ordinary column per (division, party code)
  const oRows = readRows(path.join(BOOTH, "oracle", `fpvvt-${y}.csv.gz`));
  const [ohi, oh] = headerMap(oRows, "StateAb", `fpvvt-${y}`);
  const oracle = {};
  for (const r of oRows.slice(ohi + 1)) {
    if (!strip(r[oh.DivisionNm] || "") || !(oh.OrdinaryVotes in r)) continue;
    const pa = strip(r[oh.PartyAb] || "");
    if (pa === "" || pa === "Informal") continue;
    const key = `${strip(r[oh.DivisionNm])}|${pa}`;
    oracle[key] = (oracle[key] || 0) + num(r[oh.OrdinaryVotes]);
  }
  for (const st of STATES) {
    const rows = readRows(path.join(BOOTH, "fpv", `${y}-${st.toUpperCase()}.csv.gz`));
    const [phi, h] = headerMap(rows, "StateAb", `fpv-${y}-${st}`);
    const perBooth = {};
    for (const r of rows.slice(phi + 1)) {
      if (!(h.DivisionNm in r) || !strip(r[h.DivisionNm] || "")) continue;
      const pa = strip(r[h.PartyAb] || "");
      if (pa === "") continue;              // Informal rows ride a blank party
      const div = strip(r[h.DivisionNm]);
      const pp = strip(r[h.PollingPlace]);
      assert.equal(strip(r[h.StateAb]).toLowerCase(), st, `${y} ${div}: lane in its own state file`);
      const key = `${div}${pp}`;
      const bk = (perBooth[key] ||= { div, st, stream: streamOf(pp), bk: {} });
      const b = bucket(pa);
      bk.bk[b] = (bk.bk[b] || 0) + num(r[h.OrdinaryVotes]);
      const skey = `${y}|${div}|${pa}`;
      fpvSums[skey] = (fpvSums[skey] || 0) + num(r[h.OrdinaryVotes]);
    }
    for (const b of Object.values(perBooth)) {
      const total = Object.values(b.bk).reduce((a, v) => a + v, 0);
      if (!total) continue;
      for (const [k, v] of Object.entries(b.bk))
        fpvRecords.push({ year: y, div: b.div, st: b.st, stream: b.stream,
          bucket: k, share: (100 * v) / total });
    }
  }
  // recompose: this probe's per-PP sums ≡ the vote-type oracle, exactly
  for (const [k, v] of Object.entries(fpvSums)) {
    const [ky, div] = k.split("|");
    if (Number(ky) !== y) continue;
    assert.equal(oracle[`${div}|${k.split("|")[2]}`], v,
      `${y} FPV recompose: per-PP ${k} = ${v} v oracle ${oracle[`${div}|${k.split("|")[2]}`]}`);
  }
  for (const k of Object.keys(oracle))
    assert.ok(`${y}|${k}` in fpvSums, `${y} FPV recompose: oracle-only ${k}`);
}
for (const y of STATS) {
  const rows = readRows(path.join(BOOTH, "fpv", `${y}.csv.gz`), ";");
  const [hi, h] = headerMap(rows, "State", `fpv-${y}`);
  // the roster maps (division, ballot position) -> party
  const hRows = readRows(path.join(SRC, `hcands-${y}.txt`), ";");
  const [hhi, hh] = headerMap(hRows, "State", `hcands-${y}`);
  const rosterOf = {};
  const rosterTotal = {};
  for (const r of hRows.slice(hhi + 1)) {
    if (!(hh.Vote in r) || !strip(r[hh.Division] || "")) continue;
    const div = strip(r[hh.Division]);
    rosterOf[`${div}|${strip(r[hh["Ballot Position"]])}`] = strip(r[hh.Party]);
    const pk = `${div}|${strip(r[hh.Party])}`;
    rosterTotal[pk] = (rosterTotal[pk] || 0) + num(r[hh.Vote]);
  }
  const perBooth = {};
  const sums = {};
  for (const r of rows.slice(hi + 1)) {
    if (!(h.Vote in r) || !strip(r[h.Division] || "")) continue;
    const div = strip(r[h.Division]);
    const pp = strip(r[h["Polling Place"]]);
    const st = strip(r[h.State]).toLowerCase();
    assert.ok(STATES.includes(st), `${y} ${div}: a state (${st})`);
    const party = rosterOf[`${div}|${strip(r[h["Ballot Position"]])}`];
    assert.ok(party !== undefined, `${y} ${div} bp ${strip(r[h["Ballot Position"]])}: roster covers`);
    const v = num(r[h.Vote]);
    const key = `${div}${pp}`;
    const bk = (perBooth[key] ||= { div, st, stream: streamOf(pp), bk: {} });
    const b = bucket(party);
    bk.bk[b] = (bk.bk[b] || 0) + v;
    const pk = `${div}|${party}`;
    sums[pk] = (sums[pk] || 0) + v;
  }
  for (const [k, want] of Object.entries(rosterTotal)) {
    const have = (sums[k] || 0) - (y === 1993 ? (FPV_EXC[k] || 0) : 0);
    assert.equal(have, want, `${y} ${k}: count-1 sum ${sums[k] || 0} v roster ${want}`);
  }
  for (const k of Object.keys(sums))
    assert.ok(k in rosterTotal, `${y}: lane party on the roster (${k})`);
  for (const b of Object.values(perBooth)) {
    const total = Object.values(b.bk).reduce((a, v) => a + v, 0);
    if (!total) continue;
    for (const [k, v] of Object.entries(b.bk))
      fpvRecords.push({ year: y, div: b.div, st: b.st, stream: b.stream,
        bucket: k, share: (100 * v) / total });
  }
}

const tppRecords = [];
for (const y of MOD) {
  const rows = readRows(path.join(BOOTH, "tpp-pp", `${y}.csv.gz`));
  const [thi, h] = headerMap(rows, "StateAb", `tpp-pp-${y}`);
  const ia = h["Australian Labor Party Votes"];
  const ic = h["Liberal/National Coalition Votes"];
  assert.ok(ia >= 0 && ic >= 0, `${y}: both vote columns by name (order flips between events)`);
  const sums = {};
  for (const r of rows.slice(thi + 1)) {
    if (!(h.DivisionNm in r) || !strip(r[h.DivisionNm] || "")) continue;
    const a = num(r[ia]), c = num(r[ic]);
    assert.equal(a + c, num(r[h.TotalVotes]), `${y} ${strip(r[h.DivisionNm])}: ALP+Coalition is the total`);
    const div = strip(r[h.DivisionNm]);
    const st = strip(r[h.StateAb]).toLowerCase();
    (sums[div] ||= [0, 0])[0] += a; sums[div][1] += c;
    if (a + c)
      tppRecords.push({ year: y, div, st, stream: streamOf(strip(r[h.PollingPlace])),
        share: (100 * a) / (a + c) });
  }
  if (y >= 2016) {
    const oRows = readRows(path.join(BOOTH, "oracle", `tppvt-${y}.csv.gz`));
    const [tohi, oh] = headerMap(oRows, "DivisionNm", `tppvt-${y}`);
    const oracle = {};
    for (const r of oRows.slice(tohi + 1)) {
      if (!(oh.DivisionNm in r) || !strip(r[oh.DivisionNm] || "")) continue;
      oracle[strip(r[oh.DivisionNm])] = [
        num(r[oh["Australian Labor Party OrdinaryVotes"]]),
        num(r[oh["Liberal/National Coalition OrdinaryVotes"]])];
    }
    assert.deepEqual(Object.keys(sums).sort(), Object.keys(oracle).sort(),
      `${y}: tppvt division set is the per-PP lane's`);
    for (const [div, [a, c]] of Object.entries(sums))
      assert.deepEqual([a, c], oracle[div], `${y} ${div}: TPP ≡ tppvt ordinary`);
  } else {
    const oRows = readRows(path.join(BOOTH, "oracle", `tcpcvt-${y}.csv.gz`));
    const [tohi, oh] = headerMap(oRows, "StateAb", `tcpcvt-${y}`);
    const oracle = {}, parties = {};
    for (const r of oRows.slice(tohi + 1)) {
      if (!(oh.DivisionNm in r) || !strip(r[oh.DivisionNm] || "")) continue;
      const div = strip(r[oh.DivisionNm]);
      const pa = strip(r[oh.PartyAb] || "");
      if (pa === "") continue;             // the informal row
      (parties[div] ||= new Set()).add(pa);
      const side = LABOR.has(pa) ? 0 : COAL.has(pa) ? 1 : -1;
      if (side < 0) continue;
      (oracle[div] ||= [0, 0])[side] += num(r[oh.OrdinaryVotes]);
    }
    for (const [div, [a, c]] of Object.entries(sums)) {
      const p = parties[div] || new Set();
      const isClassic = [...p].filter((x) => LABOR.has(x)).length === 1
        && [...p].filter((x) => COAL.has(x)).length === 1
        && [...p].every((x) => LABOR.has(x) || COAL.has(x));
      if (!isClassic) continue;            // Coalition-internal / IND / GRN finals: no oracle
      assert.deepEqual([a, c], oracle[div], `${y} ${div}: TPP ≡ tcpcvt ordinary`);
    }
  }
}
for (const y of HTT) {
  const rows = readRows(path.join(SRC, `htpp-${y}.txt`), ";");
  const [hhi, h] = headerMap(rows, "Division", `htpp-${y}`);
  const blk = CLASSES_ALL[String(y)];
  const excl = HTT_EXCLUDED[y] || new Set();
  const seen = new Set();
  for (const r of rows.slice(hhi + 1)) {
    if (!(h["Coalition TPP Vote"] in r) || !strip(r[h.Division] || "")) continue;
    const a = num(r[h["ALP TPP Vote"]] || 0), c = num(r[h["Coalition TPP Vote"]] || 0);
    const div = strip(r[h.Division]);
    seen.add(div);
    if (!a && !c) {
      assert.equal(Number(strip(r[h["ALP TPP Pc"]] || "0")), 0,
        `${y} ${div}: an empty team prints a zero share`);
      continue;
    }
    assert.ok(Math.abs((100 * a) / (a + c) - Number(strip(r[h["ALP TPP Pc"]]))) < 0.02,
      `${y} ${div}: the printed pc reads back off its counts`);
    tppRecords.push({ year: y, div, st: blk[div].state.trim().toLowerCase(),
      stream: streamOf(strip(r[h["Polling Place"]])), share: (100 * a) / (a + c) });
  }
  assert.deepEqual([...seen].sort(),
    Object.keys(blk).filter((d) => !excl.has(d)).sort(),
    `${y}: the HTPP join covers the block less its own omission`);
}

const flowRecords = [];                   // one record per (booth, bucket)
const classicDivs = {};
for (const y of FLOW_YEARS) {
  const perBooth = {};                    // key -> [toLabor, toCoal]
  const divTo = {};
  for (const st of STATES) {
    const rows = readRows(path.join(BOOTH, "tcf", `${y}-${st.toUpperCase()}.csv.gz`));
    const [tchi, h] = headerMap(rows, "StateAb", `tcf-${y}-${st}`);
    for (const r of rows.slice(tchi + 1)) {
      if (!(h.DivisionNm in r) || !strip(r[h.DivisionNm] || "")) continue;
      const div = strip(r[h.DivisionNm]);
      const id = strip(r[h.FromCandidateId] || "");
      if (id === "0") continue;           // First Preferences pseudo rows
      let frm = strip(r[h.FromCandidatePartyAb] || "");
      let fb;
      if (frm === "") {
        assert.equal(strip(r[h.FromCandidatePartyNm] || ""), "Non Affiliated",
          `${y} ${div}: a blank from-party is only ever Non Affiliated`);
        fb = "oth";
      } else fb = flowBucket(frm);
      const to = strip(r[h.ToCandidatePartyAb] || "");
      (divTo[div] ||= new Set()).add(to);
      if (fb === null) continue;          // a majors-to-majors transfer
      const side = LABOR.has(to) ? 0 : COAL.has(to) ? 1 : -1;
      if (side < 0) continue;             // non-classic final pair
      const pp = strip(r[h.PPNm]);
      const key = `${st}|${div}|${pp}|${fb}`;
      (perBooth[key] ||= { div, st, stream: streamOf(pp), fb, pair: [0, 0] }).pair[side]
        += num(r[h.TransferCount]);
    }
  }
  const classic = new Set(Object.entries(divTo)
    .filter(([, dest]) => [...dest].some((x) => LABOR.has(x))
      && [...dest].every((x) => LABOR.has(x) || COAL.has(x)))
    .map(([d]) => d));
  classicDivs[y] = classic.size;
  // recompose against the committed division-level flows
  const oSrc = y === 2025
    ? path.join(ROOT, "data", "aec-2025-tcp-flow-by-division.csv")
    : path.join(SRC, `tcpflow-${y}.csv.gz`);
  const oRows = readRows(oSrc);
  const [tohi, oh] = headerMap(oRows, "StateAb", `tcpflow-${y}`);
  const oracle = {};
  for (const r of oRows.slice(tohi + 1)) {
    if (!(oh.DivisionNm in r) || !strip(r[oh.DivisionNm] || "")) continue;
    const fb = flowBucket(strip(r[oh.FromCandidatePartyAb] || ""));
    if (fb === null || strip(r[oh.FromCandidateID] || "") === "0") continue;
    const to = strip(r[oh.ToCandidatePartyAb] || "");
    const side = LABOR.has(to) ? 0 : COAL.has(to) ? 1 : -1;
    if (side < 0) continue;
    const key = `${strip(r[oh.DivisionNm])}|${fb}|${side}`;
    oracle[key] = (oracle[key] || 0) + num(r[oh.TransferCount]);
  }
  const have = {};
  for (const b of Object.values(perBooth)) {
    if (!classic.has(b.div)) continue;
    for (const side of [0, 1]) {
      const key = `${b.div}|${b.fb}|${side}`;
      have[key] = (have[key] || 0) + b.pair[side];
    }
  }
  for (const [k, v] of Object.entries(oracle)) {
    if (!classic.has(k.split("|")[0])) continue;
    assert.equal(have[k] || 0, v, `${y} flows ${k}: per-PP ${have[k] || 0} v oracle ${v}`);
  }
  for (const [k, v] of Object.entries(have))
    assert.equal(oracle[k] ?? 0, v, `${y} flows ${k}: per-PP surplus v oracle ${oracle[k] ?? 0}`);
  for (const b of Object.values(perBooth)) {
    if (!classic.has(b.div)) continue;
    const [a, c] = b.pair;
    if (a + c)
      flowRecords.push({ year: y, div: b.div, st: b.st, stream: b.stream,
        bucket: b.fb, share: (100 * a) / (a + c) });
  }
}

// ---- the stores -------------------------------------------------------------
const prim = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "booth-primary.json"), "utf8"));
const tpp = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "booth-tpp.json"), "utf8"));
const flows = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "booth-flows.json"), "utf8"));

assert.deepEqual(prim.years, [...STATS, ...MOD].map(String), "primary span 1993–2025");
assert.deepEqual(prim.buckets, [["alp", "Labor"], ["lnp", "Coalition"], ["grn", "Greens"],
  ["onp", "One Nation"], ["oth", "Others"]], "the five primary buckets, in menu order");
assert.deepEqual(tpp.years, TPP_YEARS.map(String), "tpp span 1996–2025");
assert.deepEqual(flows.years, FLOW_YEARS.map(String), "flows span 2004–2025");
assert.deepEqual(flows.buckets, ["grn", "onp", "oth"], "the three transfer buckets");
assert.deepEqual(flows.classicDivisions, Object.fromEntries(
  FLOW_YEARS.map((y) => [String(y), classicDivs[y]])),
  "classic-division counts ≡ this probe's own classic detection");
for (const doc of [prim, tpp, flows])
  assert.deepEqual(doc.streams.map((s) => s[0]), STREAMS, "the five stream lanes in order");

const expectCuts = ["nat", ...STATES, ...CLASSES, ...STREAMS];
const checkCells = (doc, cutsRecomputed, keyOfCell, yearOfRecord) => {
  assert.deepEqual(Object.keys(doc.cuts).sort(), [...expectCuts].sort(),
    "cut set: nat + states + classes + streams");
  for (const cut of expectCuts) {
    const cells = doc.cuts[cut];
    const want = {};
    for (const [y, series] of Object.entries(cutsRecomputed[cut] || {})) {
      const row = {};
      for (const [k, shares] of Object.entries(series)) {
        const d = dist(shares);
        if (d) row[k] = d;
      }
      if (Object.keys(row).length) want[y] = row;
    }
    const sorted = (o) => Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]]));
    for (const y of Object.keys(want).sort())
      assert.deepEqual(sorted(cells[y] || {}), sorted(want[y]),
        `${cut} ${y}: distribution ≡ this probe's recompute`);
    for (const [y, row] of Object.entries(cells))
      for (const [k, d] of Object.entries(row)) {
        assert.ok(d.n > 0 && d.p25 <= d.med && d.med <= d.p75,
          `${cut} ${y} ${k}: the quartile contract (n=${d.n})`);
        assert.ok(d.med >= 0 && d.med <= 100, `${cut} ${y} ${k}: a share in range`);
      }
  }
};

checkCells(prim, cutRows(fpvRecords, (r) => r.bucket));
checkCells(tpp, cutRows(tppRecords, () => "alp"));
checkCells(flows, cutRows(flowRecords, (r) => r.bucket));

// ---- era pins (the printed medians) -----------------------------------------
const cell = (doc, cut, y, k) => doc.cuts[cut][y][k];
assert.deepEqual(cell(prim, "nat", "1993", "alp"),
  { n: 8995, med: 40.46, p25: 27.89, p75: 52.38 }, "1993's median booth (the stats era's floor)");
assert.deepEqual(cell(tpp, "nat", "1996", "alp"),
  { n: 9032, med: 41.68, p25: 30.06, p75: 53.56 }, "the HTPP era's first two-party cell");
assert.deepEqual(cell(flows, "nat", "2004", "grn"),
  { n: 8195, med: 80, p25: 72, p75: 86.54 }, "Greens to Labor, 2004");
assert.deepEqual(cell(flows, "nat", "2004", "onp"),
  { n: 4345, med: 43.75, p25: 33.33, p75: 53.33 }, "One Nation to Labor, 2004");
assert.deepEqual(cell(flows, "nat", "2004", "oth"),
  { n: 8249, med: 43.75, p25: 34.88, p75: 52.94 }, "Others to Labor, 2004");
// the modern-era cells this probe recomputed off the downloads 2026-10-24
for (const [y, med] of [[2007, 40.04], [2013, 30.77], [2025, 34.33]])
  assert.equal(cell(prim, "nat", String(y), "alp").med, med,
    `${y} median-booth ALP primary (the README's ladder)`);

console.log("test-aec-booth: all assertions passed");
