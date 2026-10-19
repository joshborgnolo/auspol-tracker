/* ====================================================================
   pv-agg.js - the Primary tab's "All pollsters" recompute.

   The primary-vote panel's pollster menu answers "what do the primary
   figures say if ONLY these houses' polls exist?" by re-running §2's
   estimator in the browser over the selected subset. Lives in the PLAIN
   layer (after ed2260de sets window.AP, before any component) so there is
   ONE implementation in the client: the panel calls it from rd-panels.jsx,
   the parity test (test-pv-recompute.mjs) evals this same file in a vm
   context against the data bundle. It is a MIRROR of gen-data.mjs's
   weightedWithSe / nowcastPts / monthWithSe / houseEffectsFor and §2's
   aggPrimary + primaryNowAt - the constants it runs on all arrive in
   D.aggSpec (gen-data's comment beside aggSpec is the drift rule), so a
   server constant change tracks automatically and the parity test is the
   net that catches a logic divergence.

   Semantics of the subset, by construction (identical by calling the same
   functions on the filtered rows):
   - house effects are re-measured on the SUBSET, so a consensus window
     that drops below houseEffectsFor's 3-neighbour floor contributes no
     lean - the subset is a different estimator, not the published one
     minus houses;
   - the five-party debias rescale (adj vs plain totals, > 0.5) re-fires
     on the subset's own totals;
   - refNow is the newest fieldwork-end across the WHOLE emitted set,
     matching server's LATEST_ISO (never recomputed over the subset);
   - rows the server excludes carry noAgg on the emitted row (NO_AGG,
     per-row noAgg and reusesWaves all baked in server-side) - the client
     never re-derives eligibility itself.

   Row mapping from an emitted individualPolls row to the estimator's
   input: ym -> row.ym, mid -> row.mid (the exact midMs; a row with no
   fieldwork window carries none and its mid is its released day - NEVER
   the truncated fmid date: odd-length windows land on half-days and the
   lean-neighbour windows read the half-day), n -> sampleEff*deff where
   published else min(sample, cap) with the server's 1200 fallback,
   x -> row.p[k] (p.oth is ALREADY ind+oth combined).

   Wrapped in an IIFE so nothing lands in the shared top-level lexical
   scope (the plain-layer hazard np-project.js's banner calls out).
   ==================================================================== */
(() => {
  "use strict";
  const PK = ["alp", "lnp", "grn", "onp", "oth"];
  const DAY = 86400000;
  const LN2 = Math.log(2);
  const r1 = (v) => Math.round(v * 10) / 10;
  const ddays = (a, b) => (a - b) / DAY;
  const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const isoMs = (iso) => Date.parse(iso + "T00:00:00Z");

  /* gen-data: weightedWithSe - one construction for the nowcast and the
     monthly points alike (its comment is the contract; pts are
     { w, x, n }). */
  function weightedWithSe(pts, spec) {
    let sw = 0, sw2 = 0, swx = 0;
    for (const p of pts) { sw += p.w; sw2 += p.w * p.w; swx += p.w * p.x; }
    if (!sw) return null;
    const m = swx / sw;
    const nEff = (sw * sw) / sw2;
    const wVar = pts.reduce((t, p) => t + p.w * (p.x - m) ** 2, 0) / sw;
    const seSpread = nEff > 1 ? Math.sqrt(wVar / (nEff - 1)) : Infinity;
    const pqOf = (p) => (p.pq != null ? p.pq : (m / 100) * (1 - m / 100) * 1e4);
    const seFloor = Math.sqrt(pts.reduce((t, p) => t + p.w * p.w * spec.deff * pqOf(p) / p.n, 0)) / sw;
    const se = Math.max(Number.isFinite(seSpread) ? seSpread : 0, seFloor);
    return { v: m, n: pts.length, se, nEff };
  }

  /* gen-data: houseEffectsFor - lean against OTHER houses' consensus within
     ±heWindow days, >= 3 neighbours, pooled with the heHalf half-life and
     shrunk by shrinkK; read at the time a figure is taken. Only `at` is
     needed here (no emitted snapshots in the recompute). */
  function houseEffectsFor(rows, spec) {
    const devs = [];
    for (const a of rows) {
      let sw = 0, swx = 0, k = 0;
      for (const b of rows) {
        if (b === a || Math.abs(ddays(b.mid, a.mid)) > spec.heWindow) continue;
        if (b.firm === a.firm) continue;
        sw += b.n; swx += b.n * b.x; k++;
      }
      if (k < 3) continue;
      devs.push({ firm: a.firm, mid: a.mid, dev: a.x - swx / sw });
    }
    const byFirm = Object.create(null);
    for (const d of devs) (byFirm[d.firm] || (byFirm[d.firm] = [])).push(d);
    const at = (firm, t) => {
      let sw = 0, swx = 0;
      for (const d of byFirm[firm] || []) {
        if (d.mid > t) continue;
        const w = Number.isFinite(t) ? Math.exp(-LN2 * ddays(t, d.mid) / spec.heHalf) : 1;
        sw += w; swx += w * d.dev;
      }
      if (!sw) return 0;
      return (sw / (sw + spec.shrinkK)) * (swx / sw);
    };
    return { at, estimable: devs.length > 0 };
  }
  const heV = (he, firm, t) => (he && typeof he.at === "function" ? he.at(firm, t) : 0);

  /* gen-data: nowcastPts at the headline window - recency decay (half-life
     = spec.half day half-life of e-folding) times the half-cosine taper
     from spec.taper days to the spec.window edge, a house's m window waves
     counting for sqrt(m). */
  function nowcastPts(rows, he, ref, spec) {
    const taperW = (d) => (d <= spec.taper ? 1 : 0.5 * (1 + Math.cos(Math.PI * (d - spec.taper) / (spec.window - spec.taper))));
    const pts = [];
    const waves = new Map();
    for (let i = 0; i < rows.length; i++) {
      const a = rows[i];
      const d = ddays(ref, a.mid);
      if (d < 0 || d > spec.window) continue;
      waves.set(a.firm, (waves.get(a.firm) || 0) + 1);
      const w = (a.w0 != null ? a.w0 : a.n) * Math.exp(-LN2 * d / spec.half) * taperW(d);
      pts.push({ ri: i, w, x: a.x - heV(he, a.firm, ref), n: a.n, firm: a.firm });
    }
    for (const p of pts) p.w /= Math.sqrt(waves.get(p.firm));
    return pts;
  }

  /* gen-data: monthWithSe - one calendar month, sample-weighted only,
     same sqrt(m) deflation and the lean read at the month's midpoint. */
  function monthWithSe(rows, he, ym, spec) {
    const rs = rows.filter((r) => r.ym === ym);
    const waves = new Map();
    for (const r of rs) waves.set(r.firm, (waves.get(r.firm) || 0) + 1);
    return weightedWithSe(rs.map((r) => ({
      w: r.n / Math.sqrt(waves.get(r.firm)),
      x: r.x - heV(he, r.firm, isoMs(ym + "-15")),
      n: r.n,
    })), spec);
  }

  /* The emitted rows as the estimator sees them, house-filtered. houses is
     an array of canonical house names, or null for every house. Returns
     { rows, refNow } where rows[i] = { ym, mid, n, firm, x:{alp..oth} }
     and refNow mirrors server's LATEST_ISO over the UNFILTERED set. */
  function rowsFor(houses) {
    const D = window.AP.D, spec = D.aggSpec;
    const all = D.individualPolls || [];
    const keep = houses ? new Set(houses) : null;
    let refNow = 0;
    for (const q of all) { const t = isoMs(q.released); if (t > refNow) refNow = t; }
    const rows = [];
    for (const q of all) {
      if (q.noAgg) continue;
      if (keep && !keep.has(q.pollster)) continue;
      if (!q.p) continue;
      const mid = q.mid != null ? q.mid : isoMs(q.released);
      rows.push({
        ym: q.ym, mid, firm: q.pollster,
        n: q.sampleEff != null ? q.sampleEff * spec.deff : Math.min(q.sample || 1200, spec.sampleCap),
        x: q.p,
      });
    }
    return { rows, refNow };
  }

  /* window.AP.pvAgg(houses) -> {
       months:  aggPrimary-shaped rows [{ ym, x, alp..oth, ci:{...} }] -
                no election row (the panel splices D.aggPrimary[0] itself);
       now:     primaryNowAt's headline { alp..oth, n } or null when any
                party has nothing inside the window;
       monthsOk: months that have any emitted poll in the house set (the
                node-existence rule keys off all rows, noAgg included);
     } */
  window.AP = window.AP || {};
  window.AP.pvAgg = (houses) => {
    const D = window.AP.D, spec = D.aggSpec;
    const { rows, refNow } = rowsFor(houses);
    const rowsK = {};
    for (const k of PK) {
      rowsK[k] = [];
      for (const r of rows) if (r.x[k] != null) rowsK[k].push({ ym: r.ym, mid: r.mid, x: r.x[k], n: r.n, firm: r.firm });
    }
    const he = {};
    for (const k of PK) he[k] = houseEffectsFor(rowsK[k], spec);

    /* primaryNowAt: the window per party, debiased on the subset's own
       leans, renormalised only when the debiased total drifts past 0.5
       from the plain total. */
    const now = (() => {
      const adj = {};
      let plainTotal = 0, adjTotal = 0, n = 0;
      for (const k of PK) {
        const win = rowsK[k].filter((r) => { const d = ddays(refNow, r.mid); return d >= 0 && d <= spec.window; });
        if (!win.length) return null;
        const est = weightedWithSe(nowcastPts(rowsK[k], he[k], refNow, spec), spec);
        adj[k] = est.v;
        plainTotal += mean(win.map((r) => r.x));
        adjTotal += est.v;
        n = Math.max(n, est.n);
      }
      const rescaled = Math.abs(adjTotal - plainTotal) > 0.5;
      const out = {};
      for (const k of PK) out[k] = r1(rescaled ? adj[k] * (plainTotal / adjTotal) : adj[k]);
      out.n = n;
      return out;
    })();

    /* aggPrimary: one node per month the house SET saw any poll at all
       (server keys existence off its full POLLS the same way); per party
       the month-with-SE estimate or null (null, never 0 - a party the set
       didn't measure that month draws a gap, not a floor). */
    const have = new Set();
    for (const q of D.individualPolls || []) {
      if (houses && !new Set(houses).has(q.pollster)) continue;
      have.add(q.ym);
    }
    const months = [];
    for (const ym of D.MONTHS) {
      if (!have.has(ym)) continue;
      const o = { ym, x: D.mx(ym), ci: {} };
      let plainTotal = 0;
      for (const k of PK) {
        const rs = rowsK[k].filter((r) => r.ym === ym);
        if (!rs.length) { o[k] = null; continue; }
        const est = monthWithSe(rowsK[k], he[k], ym, spec);
        o[k] = est.v;
        o.ci[k] = r1(1.96 * est.se);
        plainTotal += mean(rs.map((r) => r.x));
      }
      const adjTotal = PK.reduce((s, k) => s + (o[k] == null ? 0 : o[k]), 0);
      if (adjTotal > 0 && Math.abs(adjTotal - plainTotal) > 0.5)
        for (const k of PK) if (o[k] != null) o[k] *= plainTotal / adjTotal;
      for (const k of PK) if (o[k] != null) o[k] = r1(o[k]);
      months.push(o);
    }
    return { months, now, refNow };
  };
})();
