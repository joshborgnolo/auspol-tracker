#!/usr/bin/env node
/* build-stores.mjs – merge lanes/*.json into data/demographics-<year>-election.json stores.

   Lane JSONs (one per source house: essential, newspoll, resolve, morgan, ipsos, galaxy, reachtel, …)
   carry per-election final/pre-election-pool waves with verbatim printed figures — see manifest.json's
   laneSchema. This builder is the only thing that touches data/; lanes are human/agent-authored and
   audited, and every figure in a store is traceable: store → lane entry → src/<lane>/ file.

   Normalisation applied here (lanes stay verbatim):
     - undecided: if a wave printed an undecided share (wave.und), the figured cells are re-based to
       decided voters like the 2025 store ("shares are decided voters'"), [: und is kept on the wave
     - party keys are standardised to alp/lnp/grn/onp/oth; house-specific extra keys (nxt, uap, ind…)
       ride through untouched and are listed in the store's _about
     - gender cells are renamed Male/Female→Men/Women for comparability; every other dim label
       (age bands, states, regions, voted…) is kept exactly as printed
     - waves sorted by fieldwork end date

   Checks (log as notes, never silently drop — old houses printed whole numbers and rounding differs):
     - totals ≈100 within ±1.5 when all of alp/lnp/grn/oth printed
     - each dim's cells sum within ±1.5 of 100 when completable
     - duplicate house+date across lanes = hard error (lanes must partition houses)

   Usage: node .build/analysis/election-demographics/build-stores.mjs
   Writes data/demographics-<year>-election.json (one per election year present in the lanes). */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..", "..");
const LANES = path.join(HERE, "lanes");
const MAN = JSON.parse(fs.readFileSync(path.join(HERE, "manifest.json"), "utf8"));
const KEYS = ["alp", "lnp", "grn", "onp", "oth"];
const r1 = (x) => (x == null ? null : Math.round(x * 10) / 10);

const GENDER = { Male: "Men", Female: "Women" };
// source-text provenance keys that ride from lane wave to store wave verbatim
const PASSTHRU = ["publication", "pool", "adjacentQuarter"];

function normCell(cell, und) {
  if (cell == null || typeof cell !== "object") return cell ?? null;
  const coef = und > 0 ? 100 / (100 - und) : 1;
  const d = {};
  for (const [k, v] of Object.entries(cell)) {
    if (v == null || k.endsWith("2")) { d[k] = v; continue; }
    d[k] = r1(v * coef);
  }
  return d;
}

const lanes = [];
for (const f of fs.readdirSync(LANES).filter((f) => f.endsWith(".json")).sort()) {
  const lane = JSON.parse(fs.readFileSync(path.join(LANES, f), "utf8"));
  lane._file = "lanes/" + f;
  if (!lane.waves) { lane.waves = []; }
  lanes.push(lane);
}

const byYear = {};
for (const cycle of MAN.cycles) {
  byYear[cycle.year] = { election: cycle.election, waves: [], provenance: [], notes: [], gaps: [] };
}
const seen = new Set();
for (const lane of lanes) {
  for (const w of lane.waves) {
    const year = +w.election.slice(0, 4);
    if (!byYear[year]) throw new Error(`${lane._file}: wave election ${w.election} has no manifest cycle`);
    const key = `${lane.house}|${w.date}`;
    if (seen.has(key)) throw new Error(`duplicate wave across lanes: ${key}`);
    seen.add(key);
    const und = w.und || 0;
    const wave = {
      pollster: lane.house,
      date: w.date,
      ...Object.fromEntries(PASSTHRU.filter((k) => w[k] != null).map((k) => [k, w[k]])),
      ...(w.dateStart ? { dateStart: w.dateStart } : {}),
      ...(w.sample ? { sample: w.sample } : {}),
      ...(und ? { und } : {}),
      ...(w.tpp && w.tpp.alp != null ? { tpp: { alp: r1(w.tpp.alp) } } : {}),
      total: normCell(w.total, und),
      dims: {},
    };
    for (const [dim, cells] of Object.entries(w.dims || {})) {
      for (const [label0, cell] of Object.entries(cells)) {
        const label = dim === "gender" ? GENDER[label0] || label0 : label0;
        (wave.dims[dim] ||= {})[label] = normCell(cell, und);
      }
    }
    if (Object.keys(wave.dims).length === 0) delete wave.dims;
    byYear[year].waves.push(wave);
    // checks (notes, not drops)
    const t = wave.total;
    const haveAll = t && KEYS.every((k) => t[k] != null);
    if (haveAll) {
      const sum = KEYS.reduce((a, k) => a + t[k], 0);
      if (Math.abs(sum - 100) > 1.5) byYear[year].notes.push(`CHECK ${lane.house} ${w.date}: printed totals sum ${sum.toFixed(1)}`);
    }
    for (const [dim, cells] of Object.entries(wave.dims || {})) {
      for (const [label, c] of Object.entries(cells)) {
        const got = KEYS.filter((k) => c[k] != null);
        if (got.length < 4) continue;
        const sum = got.reduce((a, k) => a + c[k], 0);
        if (sum > 101.5) byYear[year].notes.push(`CHECK ${lane.house} ${w.date} ${dim}/${label}: cell sums ${sum.toFixed(1)}`);
      }
    }
  }
  for (const c of MAN.cycles) {
    if (!lane.waves.some((w) => w.election.startsWith(String(c.year)))) continue;
    const y = byYear[c.year];
    y.provenance.push({ file: lane._file, house: lane.house, sources: lane.sources || [] });
    y.notes.push(...(lane.notes || []).map((n) => `${lane.house}: ${n}`));
    y.gaps.push(...(lane.gaps || []).map((g) => `${lane.house}: ${g}`));
  }
}

const extras = new Set();
for (const y of Object.values(byYear)) {
  for (const w of y.waves) {
    const cells = w.total ? [w.total] : [];
    for (const dim of Object.values(w.dims || {})) for (const c of Object.values(dim)) if (c) cells.push(c);
    for (const cell of cells) for (const k of Object.keys(cell)) if (![...KEYS, "alp2", "lnp2"].includes(k)) extras.add(k);
  }
}

for (const [year, y] of Object.entries(byYear)) {
  if (!y.waves.length) { console.log(`${year}: no waves – no store written`); continue; }
  y.waves.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.pollster < b.pollster ? -1 : 1));
  const out = {
    _about: `Final and near-final pre-election demographic polling for the ${year} federal election, assembled from the lanes in .build/analysis/election-demographics (agent-scraped lane JSONs; every figure traceable to a verbatim source saved under src/). Shares are the houses' printed figures, re-based to decided voters where a printed undecided share existed (und kept on the wave). ${extras.size ? `Non-standard keys besides alp/lnp/grn/onp/oth: ${[...extras].join(", ")}. ` : ""}See provenance for per-house sources; gaps record what was probed and not found. Fieldwork dates/samples are null where the surviving copies don't carry them.`,
    election: y.election,
    waves: y.waves,
    provenance: y.provenance,
    notes: y.notes,
    gaps: y.gaps,
  };
  const dst = path.join(ROOT, "data", `demographics-${year}-election.json`);
  fs.writeFileSync(dst, JSON.stringify(out, null, 1) + "\n");
  console.log(`wrote ${path.relative(process.cwd(), dst)}: ${y.waves.length} waves (${[...new Set(y.waves.map((w) => w.pollster))].join(", ") || "none"})`);
}
