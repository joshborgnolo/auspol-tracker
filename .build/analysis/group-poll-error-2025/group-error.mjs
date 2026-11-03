#!/usr/bin/env node
/* group-error.mjs: how far the polls' group breakdowns sat from the 2025 election.

   The polls (bludgertrack-2022-25.json, the houses' own published crosstabs) are compared, group by group, with
   the best election-time measure available:
     state, region   the AEC count itself (actual(): first preferences by state and by the AEC's demographic
                     class of each division). This is the truth, so these rows also test the AES.
     gender, age, education, income, work, housing
                     the AES 2025 cut on the polls' own bands (aes-cuts.json), the only election-day measure.
                     Agreement or disagreement here is between two instruments; it is the poll error only if the
                     AES is right, which the state and region rows let us check.
   Every comparison is of a group's GAP from all voters in the same instrument (poll group − poll all voters v
   AES group − AES all voters, or v count group − count nation). A house's national miss is a separate quantity
   (calibrate-national.mjs's), and it cancels here.

   Windows: final = fieldwork ending 29 Mar – 2 May 2025 (35 days out, calibrate-national's "final month");
   pre = 1 Jul 2024 – 28 Mar 2025 (to see whether a house's gap moved in the campaign). A house's window gap is
   the sample-weighted mean of its releases' gaps.

   Sampling: each cell's gap carries the binomial variance of (1 − f)(group − rest), times the house's design
   effect, plus the rounding of the printed figures. The design effect is measured, not assumed: the squared
   standardised change in every cell's gap between a house's consecutive releases (≤ 45 days apart; Newspoll's
   pooled quarters ≤ 100) averages deff. Real change between releases inflates it, so it is an upper bound.
   The AES side carries aes-cuts.py's Kish-n margin.

   Garbled releases are dropped: a release whose gender or age cells' samples sum more than 10% away from its n
   (YouGov 14–19 Mar 2025's cells are shuffled), and a cell whose primaries imply a 2PP more than 4 points from
   the 2PP printed beside it (Newspoll's pooled renters, Mar–Apr 2025: ALP 29 with a 65 2PP).

   Run from the repo root:
     node .build/analysis/group-poll-error-2025/group-error.mjs > .build/analysis/group-poll-error-2025/out/group-error.txt
   Also writes out/group-error.json. */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { HERE, K, FINAL_FROM, PRE_FROM, PRE_TO, ELECTION, STATES, DIM, ORDER, releases, gapOf, actual, aes, pool, fmt } from "./lib.mjs";

const PARTIES = { alp: "Labor", lnp: "Coalition", grn: "Greens", onp: "One Nation", oth: "Others" };
const AES_DIMS = ["gender", "age", "education", "income", "work", "housing"];
const TRUTH_DIMS = ["state", "region"];
const MAIN_HOUSES = ["Newspoll", "YouGov", "RedBridge", "Resolve", "Essential", "DemosAU"];

export function analyse() {
  const { list } = releases();
  const usable = list.filter((R) => R.all && !R.flags.length);
  const A = actual(), AES = aes();

  /* ---- design effects from consecutive releases ---- */
  const deff = {};
  for (const house of MAIN_HOUSES) {
    // releases with crosstabs only (Newspoll's single national waves sit between its pooled quarters)
    const rs = usable.filter((R) => R.house === house && R.end >= "2023-07-01" && R.end <= ELECTION && Object.keys(R.cells).length);
    const span = house === "Newspoll" ? 100 : 45;
    let s = 0, m = 0, pairs = 0;
    for (let i = 1; i < rs.length; i++) {
      const a = rs[i - 1], b = rs[i];
      const days = (Date.parse(b.end) - Date.parse(a.end)) / 864e5;
      if (days <= 0 || days > span) continue;
      let used = false;
      for (const scope of Object.keys(b.cells)) {
        const ca = a.cells[scope], cb = b.cells[scope];
        if (!ca || !cb || ca.flags.length || cb.flags.length) continue;
        const ga = gapOf(a, ca), gb = gapOf(b, cb);
        for (const k of ["alp", "lnp", "grn", "onp"]) {
          if (!ga?.[k] || !gb?.[k]) continue;
          s += (gb[k].gap - ga[k].gap) ** 2 / (ga[k].v1 + gb[k].v1); m++; used = true;
        }
      }
      if (used) pairs++;
    }
    deff[house] = m ? { deff: Math.max(1, s / m), raw: s / m, cells: m, pairs } : { deff: 1.5, raw: null, cells: 0, pairs: 0, assumed: true };
  }
  const dOf = (h) => (deff[h] ? deff[h].deff : 1.5);

  /* ---- a house's window gap for one scope ---- */
  const windowGap = (house, scope, from, to) => {
    const rs = usable.filter((R) => R.house === house && R.end >= from && R.end <= to && R.cells[scope] && !R.cells[scope].flags.length);
    if (!rs.length) return null;
    const out = { releases: rs.map((R) => `${R.start}..${R.end}`), n: 0 };
    for (const k of K) {
      const obs = rs.map((R) => ({ g: gapOf(R, R.cells[scope], dOf(house)), n: R.cells[scope].n })).filter((o) => o.g?.[k]);
      if (!obs.length) { out[k] = null; continue; }
      const W = obs.reduce((s, o) => s + o.n, 0);
      out[k] = { gap: obs.reduce((s, o) => s + o.n * o.g[k].gap, 0) / W, v: obs.reduce((s, o) => s + (o.n / W) ** 2 * o.g[k].v, 0) };
    }
    out.n = rs.reduce((s, R) => s + R.cells[scope].n, 0);
    return out;
  };
  const windowAll = (house, from, to) => {
    const rs = usable.filter((R) => R.house === house && R.end >= from && R.end <= to && R.rows.NAT);
    if (!rs.length) return null;
    const W = rs.reduce((s, R) => s + R.all.n, 0);
    return Object.fromEntries(K.map((k) => [k, rs.every((R) => R.all.s[k] != null) ? rs.reduce((s, R) => s + R.all.n * R.all.s[k], 0) / W : null]));
  };

  /* ---- the reference gap for a scope ---- */
  const refOf = (scope) => {
    const dim = DIM[scope];
    if (dim === "state" || dim === "region") return Object.fromEntries(K.map((k) => [k, { gap: A[scope][k] - A.NAT[k], v: 0 }]));
    const c = AES.groups[scope];
    if (!c) return null;
    return Object.fromEntries(K.map((k) => [k, { gap: c.gap[k], v: c.gapSe[k] ** 2 }]));
  };

  /* ---- comparisons ---- */
  const rows = [];
  for (const scope of ORDER) {
    const dim = DIM[scope];
    if (!AES_DIMS.includes(dim) && !TRUTH_DIMS.includes(dim)) continue;
    const ref = refOf(scope);
    if (!ref) continue;
    const aesCell = AES.groups[scope] || null;
    const row = { scope, dim, ref, aes: aesCell ? Object.fromEntries(K.map((k) => [k, { gap: aesCell.gap[k], v: aesCell.gapSe[k] ** 2 }])) : null, houses: {}, pooled: {} };
    for (const house of MAIN_HOUSES) {
      const fin = windowGap(house, scope, FINAL_FROM, ELECTION), pre = windowGap(house, scope, PRE_FROM, PRE_TO);
      if (fin || pre) row.houses[house] = { fin, pre };
    }
    for (const k of K) {
      const obs = Object.values(row.houses).map((h) => (h.fin?.[k] ? { y: h.fin[k].gap, v: h.fin[k].v } : null));
      const p = pool(obs);
      if (!p) { row.pooled[k] = null; continue; }
      const e = p.y - ref[k].gap, se = Math.sqrt(p.v + ref[k].v);
      row.pooled[k] = { gap: p.y, v: p.v, err: e, se, z: e / se, q: p.q, df: p.df, houses: p.k };
      // for truth dims also test the AES against the count
      if (row.aes && TRUTH_DIMS.includes(dim)) row.pooled[k].aesErr = { err: row.aes[k].gap - ref[k].gap, se: Math.sqrt(row.aes[k].v), z: (row.aes[k].gap - ref[k].gap) / Math.sqrt(row.aes[k].v) };
    }
    rows.push(row);
  }
  const national = {};
  for (const house of MAIN_HOUSES) {
    const w = windowAll(house, FINAL_FROM, ELECTION);
    if (w) national[house] = Object.fromEntries(K.map((k) => [k, w[k] == null ? null : w[k] - A.NAT[k]]));
  }
  return { deff, rows, national, actual: A, aesAll: AES.all, dropped: list.filter((R) => R.flags.length).map((R) => `${R.house} ${R.start}..${R.end}: ${R.flags.join("; ")}`), droppedCells: list.flatMap((R) => Object.values(R.cells).filter((c) => c.flags.length).map((c) => `${R.house} ${R.start}..${R.end} ${c.scope}: ${c.flags.join("; ")}`)) };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const R = analyse();
  const L = (s = "") => console.log(s);
  L("Group poll error at the 2025 federal election: the polls' group gaps (group − all voters) against the count");
  L("(state, AEC region class) and the AES 2025 (everything else). Points. Final window = fieldwork ending");
  L(`${FINAL_FROM} – ${ELECTION}; pre = ${PRE_FROM} – ${PRE_TO}. err = poll gap − reference gap; z = err / combined SE.`);
  L();
  L("Design effects (mean squared standardised change between consecutive releases; real change inflates it):");
  for (const [h, d] of Object.entries(R.deff)) L(`  ${h.padEnd(10)} ${d.assumed ? "assumed 1.5 (too few consecutive releases)" : `deff ${d.deff.toFixed(2)} (raw ${d.raw.toFixed(2)}, ${d.cells} cell-party changes over ${d.pairs} release pairs)`}`);
  L();
  L("Dropped releases and cells:");
  for (const d of [...R.dropped, ...R.droppedCells]) L(`  ${d}`);
  L();
  L("Each house's final-window national miss (all voters − result), for scale – it cancels in every gap below:");
  for (const [h, v] of Object.entries(R.national)) L(`  ${h.padEnd(10)} ` + K.map((k) => `${k} ${fmt(v[k])}`).join("  "));
  L();
  const T = (title, dims, refName) => {
    L(title);
    for (const row of R.rows.filter((r) => dims.includes(r.dim))) {
      L(`  ${row.scope}`);
      for (const k of K) {
        const p = row.pooled[k];
        if (!p) continue;
        const hs = Object.entries(row.houses).filter(([, h]) => h.fin?.[k]).map(([n, h]) => `${n} ${fmt(h.fin[k].gap)}±${Math.sqrt(h.fin[k].v).toFixed(1)}`).join("  ");
        const aesBit = p.aesErr ? `  | AES ${fmt(row.aes[k].gap)} err ${fmt(p.aesErr.err)} z ${fmt(p.aesErr.z)}` : "";
        L(`    ${k.padEnd(4)} ${refName} ${fmt(row.ref[k].gap)}${row.ref[k].v ? "±" + Math.sqrt(row.ref[k].v).toFixed(1) : ""}  polls ${fmt(p.gap)}±${Math.sqrt(p.v).toFixed(1)}  err ${fmt(p.err)} z ${fmt(p.z)}  [houses Q ${p.q.toFixed(1)}/${p.df}]  ${hs}${aesBit}`);
      }
    }
    L();
  };
  T("1. Against the count: states", ["state"], "count");
  T("2. Against the count: AEC region class (RedBridge's split)", ["region"], "count");
  T("3. Against the AES: demographic groups", AES_DIMS, "AES");
  // summaries
  L("4. Summary: mean z² of the pooled errors (≈1 if polls and reference measure the same gaps), by dim and party");
  const dims = ["state", "region", ...AES_DIMS];
  L(`  ${"".padEnd(10)}` + K.map((k) => k.padStart(7)).join("") + "   AES v count");
  for (const d of dims) {
    const cells = R.rows.filter((r) => r.dim === d);
    const line = K.map((k) => { const z = cells.map((r) => r.pooled[k]?.z).filter((x) => x != null); return z.length ? (z.reduce((s, x) => s + x * x, 0) / z.length).toFixed(2).padStart(7) : "      –"; }).join("");
    const az = cells.flatMap((r) => K.map((k) => r.pooled[k]?.aesErr?.z)).filter((x) => x != null);
    L(`  ${d.padEnd(10)}${line}   ${az.length ? (az.reduce((s, x) => s + x * x, 0) / az.length).toFixed(2) + ` (${az.length})` : ""}`);
  }
  L();
  L("5. Did a house's gaps move between the pre-campaign months and the final window? mean z² of (final − pre), same house");
  for (const house of MAIN_HOUSES) {
    const z = [];
    for (const row of R.rows) { const h = row.houses[house]; if (!h?.fin || !h?.pre) continue; for (const k of K) if (h.fin[k] && h.pre[k]) z.push((h.fin[k].gap - h.pre[k].gap) / Math.sqrt(h.fin[k].v + h.pre[k].v)); }
    if (z.length) L(`  ${house.padEnd(10)} ${(z.reduce((s, x) => s + x * x, 0) / z.length).toFixed(2)} over ${z.length} cell-parties`);
  }
  fs.writeFileSync(path.join(HERE, "out", "group-error.json"), JSON.stringify(R, (k, v) => (typeof v === "number" ? +v.toFixed(4) : v), 1) + "\n");
}
