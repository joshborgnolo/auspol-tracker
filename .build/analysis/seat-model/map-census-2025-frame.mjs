#!/usr/bin/env node
/* map-census-2025-frame.mjs — W1b of .build/analysis/seat-model-plan.md.
   Map the W1 census frame (data/census-2021-divisions.json, 151 divisions on
   the 2022-election boundaries) onto the 150 divisions of the 2025 election,
   using the ABS geographic correspondence CSVs (data.gov.au "ASGS Geographic
   Correspondences (2021) Edition 3", updated 2026-05-11):
     CG_CED_2021_CED_2024.csv  (2022 boundaries -> 15 Sept 2024 NSW+VIC+WA gazettals)
     CG_CED_2024_CED_2025.csv  (2024 -> 2025 structure; QLD/SA/TAS/NT/ACT identity)
   Composed per 2021 CED as  w(s->t) = sum_j r24(s->j) * r25(j->t).

   The correspondence ratios are ABS population concordance (mesh-block
   population shares). Every census count cell of a source division is
   distributed to its targets by the SAME weight — the areal-weighting
   assumption (uniform composition within each 2021 CED). Honest for the 46
   unchanged divisions (single Good ratio-1 leg, QLD/SA/TAS/NT/ACT and most of
   NSW/VIC/WA); approximate where a seat was redrawn. ABS's own
   INDIV_TO_REGION_QLTY_INDICATOR (Good/Acceptable/Poor) rides each leg and is
   summarised in _meta per target state.

   Medians cannot survive mapping: they are carried verbatim only on EXACT
   (unredistributed) divisions; mapped divisions get mediansEst, a
   population-weighted mean of source medians — an estimate, flagged.

   Pseudo CEDs (codes 94x/97x/OT/ZZZZ: Migratory/No-usual-address/Outside
   Australia) are in the correspondence files but not in the census frame;
   they are skipped (and assert-skipped in _meta).

   Run from the repo root:
     node .build/analysis/seat-model/map-census-2025-frame.mjs
   Then: node .build/analysis/seat-model/test-census-2025-frame.mjs          */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

const FRAME_IN = "data/census-2021-divisions.json";
const CORR_DIR = ".build/analysis/seat-model/src/correspondences";
const FILES = {
  c21x24: "CG_CED_2021_CED_2024.csv",
  c24x25: "CG_CED_2024_CED_2025.csv",
};
const OUT = "data/census-2021-divisions-2025.json";

const sha16 = (p) => createHash("sha256").update(readFileSync(p)).digest("hex").slice(0, 16);

/* ABS correspondence CSVs are plain, but keep the splitter quote-safe so the
   test can verbatim-join names that contain apostrophes. */
const splitRow = (line) => {
  const out = [];
  let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else inQ = false; }
      else cur += ch;
    } else if (ch === '"' && cur === "") inQ = true;
    else if (ch === ",") { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out;
};
const readCorr = (f, fromKey, toKey) => {
  const lines = readFileSync(`${CORR_DIR}/${f}`, "utf8").trim().split(/\r?\n/);
  const head = splitRow(lines[0]);
  return lines.slice(1).map((l) => {
    const cells = splitRow(l);
    const o = Object.fromEntries(cells.map((c, i) => [head[i], c]));
    return {
      from: `CED${o[fromKey]}`, fromName: o[`${fromKey.replace("CODE", "NAME")}`],
      to: `CED${o[toKey]}`, toName: o[`${toKey.replace("CODE", "NAME")}`],
      ratio: Number(o.RATIO_FROM_TO), quality: o.INDIV_TO_REGION_QLTY_INDICATOR,
    };
  });
};

const legs2124 = readCorr(FILES.c21x24, "CED_CODE_2021", "CED_CODE_2024");
const legs2425 = readCorr(FILES.c24x25, "CED_CODE_2024", "CED_CODE_2025");
const by24 = new Map();
for (const l of legs2124) {
  if (!by24.has(l.from)) by24.set(l.from, []);
  by24.get(l.from).push(l);
}
const fwd2425 = new Map();
for (const l of legs2425) {
  if (!fwd2425.has(l.from)) fwd2425.set(l.from, []);
  fwd2425.get(l.from).push(l);
}
const name25 = new Map(legs2425.map((l) => [l.to, l.toName]));

// Compose 2021 -> 2025 weights per frame source.
const frame = JSON.parse(readFileSync(FRAME_IN, "utf8"));
const frameCodes = new Set(frame.divisions.map((d) => d.code));
const weights = {}; // CED2021 -> Map(CED2025 -> w)
const qualityLegs = { Good: 0, Acceptable: 0, Poor: 0 };
const skipped = [];
for (const [src, legs] of [...by24.entries()].sort()) {
  if (!frameCodes.has(src)) { skipped.push(src); continue; }
  const acc = new Map();
  for (const l of legs) {
    const next = fwd2425.get(l.to);
    if (!next) throw new Error(`no 2025 legs for ${l.to} (from ${src})`);
    for (const n of next) acc.set(n.to, (acc.get(n.to) ?? 0) + l.ratio * n.ratio);
  }
  const sum = [...acc.values()].reduce((a, b) => a + b, 0);
  if (Math.abs(1 - sum) > 1e-6) throw new Error(`${src}: composed weights sum to ${sum}, not 1`);
  weights[src] = acc;
}
for (const l of legs2124) if (frameCodes.has(l.from)) qualityLegs[l.quality]++;

// Distribute the count cells. Every numeric cell except medians is a count.
const NUM_GROUPS = new Set(["persons", "gender", "ageCounts", "persons15Plus", "englishOnlyHome",
  "incomeWeeklyPersons15", "tenureDwellings", "education15Plus"]);
const addLeaves = (acc, obj, w) => {
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "number") acc[k] = (acc[k] ?? 0) + v * w;
    else { if (!acc[k]) acc[k] = {}; addLeaves(acc[k], v, w); }
  }
};
const addCounts = (acc, obj, w) => {
  for (const k of NUM_GROUPS) if (obj[k] !== undefined) {
    if (typeof obj[k] === "number") acc[k] = (acc[k] ?? 0) + obj[k] * w;
    else { if (!acc[k]) acc[k] = {}; addLeaves(acc[k], obj[k], w); }
  }
};
const roundCounts = (obj, dp = 100) => Object.fromEntries(Object.entries(obj).map(([k, v]) =>
  [k, typeof v === "number" ? Math.round(v * dp) / dp : roundCounts(v, dp)]));
const roundMedians = (obj, dp = 10) => roundCounts(obj, dp);

const STATE_OF = { 1: "NSW", 2: "VIC", 3: "QLD", 4: "SA", 5: "WA", 6: "TAS", 7: "NT", 8: "ACT" };
const bySrc = new Map(frame.divisions.map((d) => [d.code, d]));

const targets = new Map(); // CED2025 -> assembled row
for (const [src, acc] of Object.entries(weights)) {
  const s = bySrc.get(src);
  for (const [t, w] of acc) {
    if (!targets.has(t)) targets.set(t, { mapParts: [] });
    targets.get(t).mapParts.push({ src, srcName: s.name, w });
  }
}

const divisions = [];
for (const [code, t] of targets) {
  t.mapParts.sort((a, b) => b.w - a.w);
  const exact = t.mapParts.length === 1 && Math.abs(1 - t.mapParts[0].w) < 1e-9;
  const counts = {};
  const medAcc = {};
  for (const { src, w } of t.mapParts) {
    const s = bySrc.get(src);
    addCounts(counts, s, w);
    for (const [mk, mv] of Object.entries(s.medians))
      medAcc[mk] = (medAcc[mk] ?? 0) + mv * w;
  }
  const div = {
    code, name: name25.get(code), state: STATE_OF[code.replace("CED", "")[0]],
    ...roundCounts(counts),
    mapping: exact ? "exact" : "mapped",
    // Ratios stay at full precision: genuine 1e-7-scale legs exist and ABS's
    // own 7dp rounding leaves per-source conservation slack of ~1e-7.
    mapFrom: t.mapParts.map(({ src, srcName, w }) => ({ code: src, name: srcName, ratio: w })),
  };
  if (exact) {
    const s = bySrc.get(t.mapParts[0].src);
    div.medians = s.medians;
  } else {
    div.mediansEst = roundMedians(medAcc);
  }
  divisions.push(div);
}
const ORDER = { NSW: 1, VIC: 2, QLD: 3, SA: 4, WA: 5, TAS: 6, NT: 7, ACT: 8 };
divisions.sort((a, b) => ORDER[a.state] - ORDER[b.state] || a.name.localeCompare(b.name));

if (divisions.length !== 150) throw new Error(`expected 150 mapped divisions, got ${divisions.length}`);
if (skipped.length !== 19) throw new Error(`expected 19 pseudo CEDs skipped, got ${skipped.length}: ${skipped}`);

const out = {
  _about: "2021 Census demographic frame remapped to the 150 divisions of the 2025 election (W1b of .build/analysis/seat-model-plan.md). Count cells of each 2022-boundary division (data/census-2021-divisions.json) are distributed to 2025-boundary targets with ABS correspondence population weights (CG_CED_2021_CED_2024 composed with CG_CED_2024_CED_2025). Areal-weighting approximation: every cell of a source division carries the SAME weight vector, so redistributed seats assume uniform within-division composition. QLD/SA/TAS/NT/ACT divisions are exact carries (boundary de-facto unchanged, single ratio-1 leg). Medians survive only on exact divisions; mapped divisions carry mediansEst (population-weighted mean of source medians — estimate, not a median). ABS low-quality legs (Acceptable/Poor) are concentrated in the redistributed states; see _meta.",
  _meta: {
    mappingQualityLegs: qualityLegs,
    skippedPseudoCEDs: skipped.length,
    byState: Object.fromEntries(["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"].map((s) => [s,
      { divisions: divisions.filter((d) => d.state === s).length, mapped: divisions.filter((d) => d.state === s && d.mapping === "mapped").length }])),
  },
  _provenance: {
    sourceFrame: { file: FRAME_IN, sha256: sha16(FRAME_IN) },
    correspondences: Object.fromEntries(Object.values(FILES).map((f) => [f, sha16(`${CORR_DIR}/${f}`)])),
    url: "https://data.gov.au/data/dataset/asgs-edition-3-2021-correspondences (ABS ASGS Edition 3 correspondence files; CED 2025 structure per https://www.abs.gov.au/statistics/standards/australian-statistical-geography-standard-asgs-edition-3/jul2021-jun2026/non-abs-structures/commonwealth-electoral-divisions)",
    mappedAt: new Date().toISOString().slice(0, 10),
  },
  divisions,
};
writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n");
const mappedN = divisions.filter((d) => d.mapping === "mapped").length;
console.log(`wrote ${OUT}: ${divisions.length} divisions, ${mappedN} mapped / ${divisions.length - mappedN} exact; quality legs ${JSON.stringify(qualityLegs)}; skipped ${skipped.length} pseudo CEDs`);
