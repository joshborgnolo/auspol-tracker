#!/usr/bin/env node
/* test-booth-seifa-2025.mjs — pin data/booth-seifa-2025.json
   (derive-booth-seifa-2025.py). Invariants:

   1. Universe: 8,940 booth records, election 2025, seifaEdition 2021,
      SA1 geography. Per-state histogram and the exact note/flag
      vocabulary match the measured run with the two user-supplied
      coordinate overrides in place (2026-10-24): scored 8,087 /
      seifaSuppressed 269 / mapped_sa1 8,356 / noCoords 584 /
      coordOverride 2 / otTerritory 4 / badCoords zero, pointOutside
      zero, stateFlagBooths empty. (The overrides replace the AEC's
      (0,0) coordinates on Henty and Carlingford North.)
   2. Keys + shape: (divId, boothId) unique; 150 divisions; every record
      carries the base fields; type in the five-name taxonomy; sa1 an
      11-digit code or null; sa1 null exactly on the noted rows;
      seifa null exactly when sa1 is null OR note is seifaSuppressed;
      present seifa scores inside the measured cube envelope
      [143.4, 1372.0] and deciles in 1..10 (ABS allows a cube row to
      suppress individual indexes, so a field may be null — the
      Wetherill Park PPVC partial row below pins that).
   3. Sort order: NSW,VIC,QLD,SA,WA,TAS,NT,ACT then div then boothId —
      the whole array is non-decreasing in that key.
   4. Spot cells across states and booth kinds (all verified against the
      cube/geometry on the first green run): Toorak and Mosman in the
      top metro band; Hobart SA1 60105102717; the Waverley WENTWORTH
      PPVC; the two coordOverride rows (Henty, Carlingford North —
      user-supplied coordinates replacing the AEC's (0,0));
      a remote-mobile noCoords row; Barton Kogarah East as the
      seifaSuppressed exemplar (SA1 carries no scores in the cube);
      the four Other-Territories SA1 hits (Norfolk Island x2 on Bean,
      Jervis Bay + Other Mobile Team 1 on Fenner); the numeric
      extremes — Fenner Throsby SA1 80104112206 holds the cube maxima
      irsad 1273.0 / ier 1315.1 (ANU campus SA1), Maribyrnong
      Ascot Vale SA1 20603111321 the floor irsd 266.6 (Ascot Vale
      public-housing estate).
   5. Provenance: _provenance.files lists all three pipeline inputs,
      and the committed vendored AEC CSV re-hashes to its recorded
      sha256-16 (the two git-ignored caches are re-fetchable per the
      extractor's docstring manifest, so they are pinned by hash
      string only, not re-computed here). _provenance.userOverrides
      records the two coordinate corrections.
*/

import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const STORE = "data/booth-seifa-2025.json";
const AEC = "atlas/data/aec-2025/GeneralPollingPlacesDownload-31496.csv";

const STATE_ORDER = ["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"];
const STATE_HIST = { ACT: 147, NSW: 3028, NT: 89, QLD: 1626, SA: 750, TAS: 329, VIC: 2072, WA: 899 };
const TYPE_NAMES = new Set(["Polling place", "Special hospital", "Remote mobile", "Mobile team", "PPVC"]);
const NOTES = new Set(["noCoords", "badCoords", "pointOutside", "seifaSuppressed"]);
const IDX = ["irsd", "irsad", "ier", "ieo"];
const COUNTS = { scored: 8087, seifaSuppressed: 269, otTerritory: 4, noCoords: 584, coordOverride: 2, mapped_sa1: 8356 };

let failures = [];
const check = (ok, msg) => { if (!ok) failures.push(msg); };
const die = () => { for (const f of failures) console.error(`  FAIL ${f}`); if (failures.length) process.exit(1); };

const d = JSON.parse(readFileSync(STORE, "utf8"));
const B = d.booths;

// -- 1. universe + header facts
check(d.election === 2025, `election ${d.election} != 2025`);
check(d.seifaEdition === 2021, `seifaEdition ${d.seifaEdition} != 2021`);
check(B.length === 8940, `booth rows ${B.length} != 8940`);
check(Array.isArray(d.indexes) && d.indexes.join() === "irsd,irsad,ier,ieo", `indexes ${d.indexes}`);
for (const [k, v] of Object.entries(COUNTS))
  check(d.counts[k] === v, `counts.${k} ${d.counts[k]} != ${v}`);
check(d.counts.pointOutside === undefined, `pointOutside leaked into counts ${d.counts.pointOutside}`);
check(Array.isArray(d.stateFlagBooths) && d.stateFlagBooths.length === 0,
  `stateFlagBooths not empty: ${JSON.stringify(d.stateFlagBooths).slice(0, 80)}`);

const hist = {};
for (const b of B) hist[b.state] = (hist[b.state] || 0) + 1;
check(JSON.stringify(hist, Object.keys(hist).sort()) === JSON.stringify(STATE_HIST, Object.keys(STATE_HIST).sort()),
  `state histogram ${JSON.stringify(hist)} != pin`);

const noteCount = {};
for (const b of B) if (b.note) noteCount[b.note] = (noteCount[b.note] || 0) + 1;
check(noteCount.noCoords === 584, `noCoords ${noteCount.noCoords} != 584`);
check(noteCount.badCoords === undefined, "badCoords present (both (0,0) rows now overridden)");
check(noteCount.seifaSuppressed === 269, `seifaSuppressed ${noteCount.seifaSuppressed} != 269`);
check(noteCount.pointOutside === undefined, "pointOutside present in store");

// -- 2. keys + shape
const keys = new Set();
const divs = new Set();
let sa1Null = 0, seifaNull = 0, partial = 0;
for (const b of B) {
  const k = `${b.divId}|${b.boothId}`;
  check(!keys.has(k), `dup (divId,boothId) ${k}`);
  keys.add(k);
  divs.add(b.div);
  for (const f of ["div", "divId", "state", "boothId", "booth", "type", "venue", "suburb", "premisesState", "postcode"])
    check(b[f] !== undefined, `${k}: missing base field ${f}`);
  check(TYPE_NAMES.has(b.type), `${k}: odd type ${b.type}`);
  if (b.note !== undefined) check(NOTES.has(b.note), `${k}: odd note ${b.note}`);
  check(typeof b.divId === "number" && typeof b.boothId === "number", `${k}: id fields not numeric`);
  check(Object.prototype.hasOwnProperty.call(b, "sa1"), `${k}: no sa1 key`);
  check(Object.prototype.hasOwnProperty.call(b, "seifa"), `${k}: no seifa key`);
  if (b.sa1 === null) sa1Null++;
  else check(/^\d{11}$/.test(b.sa1), `${k}: malformed sa1 ${b.sa1}`);
  if (b.lat !== undefined && b.note !== "badCoords") {
    check(b.lat > -55 && b.lat < -9 && b.lon > 95 && b.lon < 169.5, `${k}: coords out of band`);
  }
  if (b.seifa === null) {
    seifaNull++;
    check(b.sa1 === null || b.note === "seifaSuppressed",
      `${k}: seifa null without null sa1 or seifaSuppressed note`);
  } else {
    check(b.sa1 !== null, `${k}: seifa present but sa1 null`);
    let anyNull = false;
    for (const i of IDX) {
      const s = b.seifa[i], dc = b.seifa.dec[i];
      if (s === null) { anyNull = true; check(dc === null, `${k}: ${i} score null but decile ${dc}`); }
      else {
        check(typeof s === "number" && s > 143.4 && s < 1372.0, `${k}: ${i} ${s} outside cube envelope`);
        check(Number.isInteger(dc) && dc >= 1 && dc <= 10, `${k}: ${i} decile ${dc} not 1..10`);
      }
    }
    if (anyNull) partial++;
  }
}
check(divs.size === 150, `division count ${divs.size} != 150`);
check(sa1Null === 584, `sa1-null rows ${sa1Null} != 584 (${sa1Null} == noCoords only)`);
check(seifaNull === 853, `seifa-null rows ${seifaNull} != 853 (584 noCoords + 269 suppressed)`);
check(partial === 17, `partially-suppressed cube rows ${partial} != 17`);

// -- 3. sort order
const ord = new Map(STATE_ORDER.map((s, i) => [s, i]));
for (let i = 1; i < B.length; i++) {
  const a = B[i - 1], b = B[i];
  const ka = [ord.get(a.state), a.div, a.boothId], kb = [ord.get(b.state), b.div, b.boothId];
  const le = ka[0] < kb[0] || (ka[0] === kb[0] && (ka[1] < kb[1] || (ka[1] === kb[1] && ka[2] <= kb[2])));
  check(le, `sort order broken at row ${i}: ${a.state}/${a.div}/${a.boothId} then ${b.state}/${b.div}/${b.boothId}`);
}

// -- 4. spot cells
const byKey = new Map(B.map((b) => [`${b.div}|${b.booth}`, b]));
const cell = (div, booth, want) => {
  const b = byKey.get(`${div}|${booth}`);
  if (!b) { failures.push(`spot: ${div} ${booth} not found`); return null; }
  for (const [k, v] of Object.entries(want)) {
    if (k === "sa1") check(b.sa1 === v, `${div} ${booth}: sa1 ${b.sa1} != ${v}`);
    else if (k === "note") check(b.note === v, `${div} ${booth}: note ${b.note} != ${v}`);
    else if (k === "type") check(b.type === v, `${div} ${booth}: type ${b.type} != ${v}`);
    else {
      const s = b.seifa && b.seifa[k];
      check(s === v, `${div} ${booth}: seifa.${k} ${s} != ${v}`);
    }
  }
  return b;
};
cell("Kooyong", "Toorak", { sa1: "20606113804", type: "Polling place", irsd: 1076.9, irsad: 1153.2, ier: 1111.4, ieo: 1194.9 });
cell("Warringah", "Mosman", { sa1: "12104168912", irsd: 1114.5, ier: 1044.4 });
cell("Clark", "Hobart", { sa1: "60105102717", irsd: 936.2, irsad: 986.6 });
cell("Wentworth", "Waverley WENTWORTH PPVC", { sa1: "11801134124", type: "PPVC", irsad: 1132.0 });
cell("Fenner", "Throsby", { sa1: "80104112206", irsad: 1273.0, ier: 1315.1 });
cell("Maribyrnong", "Ascot Vale", { sa1: "20603111321", irsd: 266.6, irsad: 496.7 });
cell("Farrer", "Remote Mobile Team 1", { note: "noCoords", type: "Remote mobile", sa1: null });
{
  // coordOverride rows — user-supplied coordinates replace the AEC's (0,0),
  // 2026-10-24; pinned from the measured run
  const h = cell("Farrer", "Henty", { sa1: "10901117528", type: "Polling place", irsd: 891.0, irsad: 878.0 });
  if (h) check(h.seifa.dec.irsd === 2 && h.seifa.dec.ier === 3, `Henty deciles ${JSON.stringify(h.seifa.dec)}`);
  const c = cell("Parramatta", "Carlingford North", { sa1: "12502171236", type: "Polling place", irsd: 1095.1, irsad: 1116.9 });
  if (c) check(c.seifa.dec.irsd === 9 && c.seifa.dec.ieo === 9, `Carlingford North deciles ${JSON.stringify(c.seifa.dec)}`);
  for (const [dv, nm, la, lo] of [["Farrer", "Henty", -35.517122, 147.031154], ["Parramatta", "Carlingford North", -33.770147, 151.037565]]) {
    const b = byKey.get(`${dv}|${nm}`);
    check(b.lat === la && b.lon === lo, `${nm} override coords ${b.lat},${b.lon} != ${la},${lo}`);
    check(b.note === undefined, `${nm} carries note ${b.note}`);
  }
}
cell("Barton", "Kogarah East", { note: "seifaSuppressed", sa1: "11904137812" });
{
  const b = cell("Blaxland", "Wetherill Park BLAXLAND PPVC", { sa1: "12702152101", type: "PPVC" });
  if (b) {
    check(b.seifa.ieo === 929.3 && b.seifa.dec.ieo === 3, `Wetherill Park PPVC partial ieo ${b.seifa.ieo}/${b.seifa.dec.ieo}`);
    check(b.seifa.irsd === null && b.seifa.irsad === null && b.seifa.ier === null,
      `Wetherill Park PPVC partial: expected irsd/irsad/ier null, got ${JSON.stringify(b.seifa)}`);
  }
}
{
  const ot = B.filter((b) => b.sa1 && b.sa1[0] === "9").map((b) => `${b.div}|${b.booth}`).sort();
  const want = ["Bean|Norfolk Island", "Bean|Norfolk Island PPVC", "Fenner|Jervis Bay", "Fenner|Other Mobile Team 1"];
  check(JSON.stringify(ot) === JSON.stringify(want), `OT booths ${JSON.stringify(ot)}`);
}
{
  // the decile-1 / decile-10 envelope actually landed on booths
  const decs = B.filter((b) => b.seifa && b.seifa.dec.irsd !== null).map((b) => b.seifa.dec.irsd);
  check(Math.min(...decs) === 1 && Math.max(...decs) === 10, `irsd decile span ${Math.min(...decs)}..${Math.max(...decs)}`);
}

// -- 5. provenance
{
  const files = d._provenance && d._provenance.files;
  check(files && Object.keys(files).length === 3, `provenance files keys ${files && Object.keys(files)}`);
  check(files && files[AEC], "provenance lacks the AEC vendored CSV entry");
  if (files && files[AEC]) {
    const h = createHash("sha256").update(readFileSync(AEC)).digest("hex").slice(0, 16);
    check(h === files[AEC], `AEC CSV hash ${h} != provenance ${files[AEC]}`);
  }
  const uo = d._provenance && d._provenance.userOverrides;
  check(Array.isArray(uo) && uo.length === 2, `userOverrides ${JSON.stringify(uo)}`);
  if (Array.isArray(uo) && uo.length === 2) {
    check(uo.some((u) => u.div === "Farrer" && u.booth === "Henty" && u.lat === -35.517122 && u.lon === 147.031154),
      "userOverrides lacks the Henty entry");
    check(uo.some((u) => u.div === "Parramatta" && u.booth === "Carlingford North" && u.lat === -33.770147 && u.lon === 151.037565),
      "userOverrides lacks the Carlingford North entry");
  }
}

die();
console.log(`booth-seifa: ok — 8,940 booths, 150 divisions, 8,087 scored, 269 suppressed, 584 uncoordinated, 2 coordOverride, 4 OT, 17 partial; spot cells + hash green`);
