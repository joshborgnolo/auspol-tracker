#!/usr/bin/env node
/* test-division-classifications.mjs — pin data/division-classifications.json
   (extract-division-classifications.mjs). Invariants:
   1. Seat counts per election are chamber truth: 150 (2001, 2004, 2007,
      2010, 2013, 2016), 151 (2019, 2022), 150 (2025).
   2. Every division carries exactly one of the four AEC classes, a known
      state, and a present party/status pair — with one exception: the
      2001 and 2004 blocks are single-epoch (their profile pages carry no
      prior/after pair), so their previous is exactly null.
   3. The 2025 file's division set is exactly the W2 seat-flows file's set
      (same 150 names, exact spelling — joins by name must never miss).
   4. Known cells that pin the AEC's rating boundary, chosen so each class
      and a taste of each state is covered. 2025: Clark (TAS) is Inner
      Metropolitan; Braddon (TAS) Rural; Franklin (TAS) Outer Metropolitan;
      Sydney (NSW) Inner Metropolitan; Maranoa (QLD) Rural; La Trobe (VIC)
      Provincial; Lyons (TAS) Rural. Pre-2016 spot pins use era names (pre-
      2016-17 renames), all verified against the live VTR pages: 2007 —
      Lyons Rural, Throsby Provincial, McEwen Rural, Aston Outer, Adelaide
      Inner; 2010 — Wentworth Inner, Durack Rural, Lyons Rural; 2013 —
      Denison Inner, Throsby Provincial, Lyons Rural, Aston Outer. 2001
      pins exercise the v2 on-page layer: Gwydir Rural, Burke Rural,
      Cowper Rural, Griffith Outer Metropolitan (v2 agrees here with
      RR5's att2 FROM column), Pearce Rural (v2's page beats att2's
      Outer Metropolitan — one of the four pinned page-vs-paper
      divergences), Macarthur/Canning Outer Metropolitan (the two era
      tokens normalised in), and the three RR5 gap fills Bradfield/
      Maribyrnong Inner Metropolitan, Wide Bay Rural. 2004 pins exercise
      the live-page layer: Bonner/Gorton Outer Metropolitan (the two
      2003-04 redistribution creations), Hunter/Gwydir/Wide Bay Rural,
      Macarthur Rural, Maribyrnong/Pearce Outer Metropolitan, Solomon
      Inner Metropolitan.
   5. Cross-year drift is tiny and directionally sane: 2016->2019 reclasses
      are exactly Cowper (Rural->Provincial — Port Macquarie port growth)
      and Griffith (Outer->Inner Metropolitan — Brisbane infill).
   6. The 2001 block carries the 2001-era division set: Gwydir present
      (abolished ahead of 2007); Gorton/Bonner/Flynn/Wright absent (all
      created post-2001).
   7. The 2001 class distribution is locked (Inner Metro 44 / Outer Metro
      45 / Provincial 16 / Rural 45) and the deltas['2001'] v2-vs-RR5-att3
      list is exactly the 20 enumerated divergences, era tokens preserved
      (Macarthur 'Outer Urban', Canning 'Outer Metropolitan/Provincial');
      the RR5 gap-fill rows never appear in it.
   8. The reclassifications across the two new boundaries are exactly the
      harvested sets: 2001->2004 is the seven rows Brand/Cunningham/
      Throsby (Outer Metropolitan or Inner Metropolitan -> Provincial),
      Fisher (Provincial -> Rural), Macarthur (Outer Metropolitan ->
      Rural), Maribyrnong (Inner Metropolitan -> Outer Metropolitan),
      Pearce (Rural -> Outer Metropolitan); 2004->2007 is Hinkler/Longman
      (Rural -> Provincial), Macarthur (Rural -> Outer Metropolitan —
      flipping back within three years) and Macquarie (Outer
      Metropolitan -> Provincial).
   9. The 2004 set pivots on the 2003-04 redistributions: Bonner/Gorton
      present, Bonython/Burke absent; and the 2004 class distribution is
      locked (Inner Metro 42 / Outer Metro 45 / Provincial 18 / Rural 45).
   Run from the repo root:
     node .build/analysis/seat-model/test-division-classifications.mjs */
import { readFileSync } from "node:fs";

let fails = 0;
const ok = (cond, msg) => { console.log((cond ? "  ok  " : "FAIL  ") + msg); if (!cond) fails++; };

const D = JSON.parse(readFileSync("data/division-classifications.json", "utf8"));
const flows = JSON.parse(readFileSync("data/aec-2025-seat-flows.json", "utf8"));

const CLASSES = ["Inner Metropolitan", "Outer Metropolitan", "Provincial", "Rural"];
const STATES = ["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"];
const EXPECT = { 2001: 150, 2004: 150, 2007: 150, 2010: 150, 2013: 150, 2016: 150, 2019: 151, 2022: 151, 2025: 150 };

console.log("1. chamber seat counts");
for (const [year, n] of Object.entries(EXPECT)) {
  const divs = D.elections[year];
  ok(divs && Object.keys(divs).length === n, `${year}: ${divs ? Object.keys(divs).length : "MISSING"} (expect ${n})`);
}

console.log("2. class/state vocabulary, fields present");
for (const [year, divs] of Object.entries(D.elections)) {
  let bad = 0;
  for (const [name, d] of Object.entries(divs)) {
    if (!STATES.includes(d.state) || !CLASSES.includes(d.classification)) bad++;
    // 2001 and 2004 are single-epoch (their profile pages carry no
    // prior/after pair): previous === null
    const singleEpoch = year === "2001" || year === "2004";
    if (singleEpoch ? d.previous !== null : !d.previous || typeof d.previous?.party !== "string" || !d.previous.party || !d.previous.status) bad++;
    const c = d.current;
    if (!c || typeof c.party !== "string" || !c.party || !c.status) bad++;
  }
  ok(bad === 0, `${year}: ${bad} bad cells`);
}

console.log("3. 2025 division set == W2 seat-flows set");
const cls25 = Object.keys(D.elections["2025"]).sort();
const flow25 = flows.seats.map((s) => s.name).sort();
ok(JSON.stringify(cls25) === JSON.stringify(flow25),
  cls25.length === flow25.length
    ? `name mismatch: only cls=${cls25.filter((n) => !flow25.includes(n))} only flows=${flow25.filter((n) => !cls25.includes(n))}`
    : `${cls25.length} vs ${flow25.length} divisions`);

console.log("4. boundary-pinning cells");
const pins = [
  ["2025", "Clark", "Inner Metropolitan"],
  ["2025", "Braddon", "Rural"],
  ["2025", "Franklin", "Outer Metropolitan"],
  ["2025", "Sydney", "Inner Metropolitan"],
  ["2025", "Maranoa", "Rural"],
  ["2025", "La Trobe", "Provincial"],
  ["2025", "Lyons", "Rural"],
  ["2007", "Lyons", "Rural"],
  ["2007", "Throsby", "Provincial"],
  ["2007", "McEwen", "Rural"],
  ["2007", "Aston", "Outer Metropolitan"],
  ["2007", "Adelaide", "Inner Metropolitan"],
  ["2010", "Wentworth", "Inner Metropolitan"],
  ["2010", "Durack", "Rural"],
  ["2010", "Lyons", "Rural"],
  ["2013", "Denison", "Inner Metropolitan"],
  ["2013", "Throsby", "Provincial"],
  ["2013", "Lyons", "Rural"],
  ["2013", "Aston", "Outer Metropolitan"],
  ["2001", "Gwydir", "Rural"],
  ["2001", "Burke", "Rural"],
  ["2001", "Cowper", "Rural"],
  ["2001", "Griffith", "Outer Metropolitan"],
  ["2001", "Pearce", "Rural"],
  ["2001", "Macarthur", "Outer Metropolitan"],
  ["2001", "Canning", "Outer Metropolitan"],
  ["2001", "Bradfield", "Inner Metropolitan"],
  ["2001", "Maribyrnong", "Inner Metropolitan"],
  ["2001", "Wide Bay", "Rural"],
  ["2004", "Bonner", "Outer Metropolitan"],
  ["2004", "Gorton", "Outer Metropolitan"],
  ["2004", "Hunter", "Rural"],
  ["2004", "Gwydir", "Rural"],
  ["2004", "Macarthur", "Rural"],
  ["2004", "Maribyrnong", "Outer Metropolitan"],
  ["2004", "Pearce", "Outer Metropolitan"],
  ["2004", "Solomon", "Inner Metropolitan"],
  ["2004", "Wide Bay", "Rural"],
];
for (const [year, seat, want] of pins) {
  const got = D.elections[year]?.[seat]?.classification;
  ok(got === want, `${year} ${seat}: ${got ?? "MISSING"} (expect ${want})`);
}

console.log("5. reclassifications 2016->2019 (redistribution-era drift)");
const y16 = D.elections["2016"], y19 = D.elections["2019"];
const drift = Object.keys(y19).filter((n) => y16[n] && y16[n].classification !== y19[n].classification)
  .map((n) => `${n}: ${y16[n].classification} -> ${y19[n].classification}`);
ok(
  JSON.stringify(drift.sort()) ===
    JSON.stringify(["Cowper: Rural -> Provincial", "Griffith: Outer Metropolitan -> Inner Metropolitan"]),
  `${drift.length} reclassed: ${drift.join("; ")}`
);

console.log("6. 2001-era division set");
const y01 = D.elections["2001"];
ok("Gwydir" in y01, "Gwydir present (abolished ahead of 2007)");
for (const ghost of ["Gorton", "Bonner", "Flynn", "Wright"])
  ok(!(ghost in y01), `${ghost} absent (created post-2001)`);

console.log("7. 2001 distribution + v2-vs-RR5 delta");
const dist = {};
for (const d of Object.values(y01)) dist[d.classification] = (dist[d.classification] || 0) + 1;
const distWant = { "Inner Metropolitan": 44, "Outer Metropolitan": 45, Provincial: 16, Rural: 45 };
ok(JSON.stringify(Object.fromEntries(Object.entries(dist).sort())) === JSON.stringify(Object.fromEntries(Object.entries(distWant).sort())),
  `distribution ${JSON.stringify(dist)} (expect ${JSON.stringify(distWant)})`);
const delta = D.deltas?.["2001"]?.v2vsRR5att3 ?? [];
ok(delta.length === 20, `delta rows ${delta.length} (expect 20)`);
const byDiv = Object.fromEntries(delta.map((r) => [r.division, r]));
const deltaPins = [
  ["Burke", "Rural", "Outer Metropolitan"],
  ["Throsby", "Inner Metropolitan", "Provincial"],
  ["Macarthur", "Outer Urban", "Outer Metropolitan"],
  ["Canning", "Outer Metropolitan/Provincial", "Outer Metropolitan"],
];
for (const [div, page, rr5] of deltaPins) {
  const r = byDiv[div];
  ok(r && r.pageRating === page && r.rr5att3Proposed === rr5,
    `delta ${div}: ${r ? `${r.pageRating} vs ${r.rr5att3Proposed}` : "MISSING"} (expect ${page} vs ${rr5})`);
}
for (const patched of ["Bradfield", "Maribyrnong", "Wide Bay"])
  ok(!(patched in byDiv), `delta excludes gap-fill row ${patched}`);

console.log("8. reclassifications 2001->2004 and 2004->2007 (harvested sets)");
const y04 = D.elections["2004"];
const drift0104 = Object.keys(y04).filter((n) => y01[n] && y01[n].classification !== y04[n].classification)
  .map((n) => `${n}: ${y01[n].classification} -> ${y04[n].classification}`).sort();
ok(
  JSON.stringify(drift0104) === JSON.stringify([
    "Brand: Outer Metropolitan -> Provincial",
    "Cunningham: Outer Metropolitan -> Provincial",
    "Fisher: Provincial -> Rural",
    "Macarthur: Outer Metropolitan -> Rural",
    "Maribyrnong: Inner Metropolitan -> Outer Metropolitan",
    "Pearce: Rural -> Outer Metropolitan",
    "Throsby: Inner Metropolitan -> Provincial",
  ]),
  `2001->2004: ${drift0104.length} reclassed: ${drift0104.join("; ")}`
);
const y07b = D.elections["2007"];
const drift0407 = Object.keys(y07b).filter((n) => y04[n] && y04[n].classification !== y07b[n].classification)
  .map((n) => `${n}: ${y04[n].classification} -> ${y07b[n].classification}`).sort();
ok(
  JSON.stringify(drift0407) === JSON.stringify([
    "Hinkler: Rural -> Provincial",
    "Longman: Rural -> Provincial",
    "Macarthur: Rural -> Outer Metropolitan",
    "Macquarie: Outer Metropolitan -> Provincial",
  ]),
  `2004->2007: ${drift0407.length} reclassed: ${drift0407.join("; ")}`
);

console.log("9. 2004 division set + distribution");
ok("Bonner" in y04 && "Gorton" in y04, "Bonner/Gorton present (created 2003-04)");
ok(!("Bonython" in y04) && !("Burke" in y04), "Bonython/Burke absent (abolished 2003-04)");
const dist04 = {};
for (const d of Object.values(y04)) dist04[d.classification] = (dist04[d.classification] || 0) + 1;
const dist04Want = { "Inner Metropolitan": 42, "Outer Metropolitan": 45, Provincial: 18, Rural: 45 };
ok(JSON.stringify(Object.fromEntries(Object.entries(dist04).sort())) === JSON.stringify(Object.fromEntries(Object.entries(dist04Want).sort())),
  `distribution ${JSON.stringify(dist04)} (expect ${JSON.stringify(dist04Want)})`);

console.log(fails ? `\n${fails} FAIL` : "\nALL CHECKS PASSED");
process.exit(fails ? 1 : 0);
