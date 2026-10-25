(() => {
  "use strict";

  const PK = ["alp", "lnp", "grn", "onp", "oth"];
  const DAY = 86400000;
  const LN2 = Math.log(2);
  const r1 = v => Math.round(v * 10) / 10;
  const ddays = (a, b) => (a - b) / DAY;
  const mean = xs => xs.reduce((a, b) => a + b, 0) / xs.length;
  const isoMs = iso => Date.parse(iso + "T00:00:00Z");
  function weightedWithSe(pts, spec) {
    let sw = 0,
      sw2 = 0,
      swx = 0;
    for (const p of pts) {
      sw += p.w;
      sw2 += p.w * p.w;
      swx += p.w * p.x;
    }
    if (!sw) return null;
    const m = swx / sw;
    const nEff = sw * sw / sw2;
    const wVar = pts.reduce((t, p) => t + p.w * (p.x - m) ** 2, 0) / sw;
    const seSpread = nEff > 1 ? Math.sqrt(wVar / (nEff - 1)) : Infinity;
    const pqOf = p => p.pq != null ? p.pq : m / 100 * (1 - m / 100) * 1e4;
    const seFloor = Math.sqrt(pts.reduce((t, p) => t + p.w * p.w * spec.deff * pqOf(p) / p.n, 0)) / sw;
    const se = Math.max(Number.isFinite(seSpread) ? seSpread : 0, seFloor);
    return {
      v: m,
      n: pts.length,
      se,
      nEff
    };
  }
  function houseEffectsFor(rows, spec) {
    const devs = [];
    for (const a of rows) {
      let sw = 0,
        swx = 0,
        k = 0;
      for (const b of rows) {
        if (b === a || Math.abs(ddays(b.mid, a.mid)) > spec.heWindow) continue;
        if (b.firm === a.firm) continue;
        sw += b.n;
        swx += b.n * b.x;
        k++;
      }
      if (k < 3) continue;
      devs.push({
        firm: a.firm,
        mid: a.mid,
        dev: a.x - swx / sw
      });
    }
    const byFirm = Object.create(null);
    for (const d of devs) (byFirm[d.firm] || (byFirm[d.firm] = [])).push(d);
    const at = (firm, t) => {
      let sw = 0,
        swx = 0;
      for (const d of byFirm[firm] || []) {
        if (d.mid > t) continue;
        const w = Number.isFinite(t) ? Math.exp(-LN2 * ddays(t, d.mid) / spec.heHalf) : 1;
        sw += w;
        swx += w * d.dev;
      }
      if (!sw) return 0;
      return sw / (sw + spec.shrinkK) * (swx / sw);
    };
    return {
      at,
      estimable: devs.length > 0
    };
  }
  const heV = (he, firm, t) => he && typeof he.at === "function" ? he.at(firm, t) : 0;
  function nowcastPts(rows, he, ref, spec) {
    const taperW = d => d <= spec.taper ? 1 : 0.5 * (1 + Math.cos(Math.PI * (d - spec.taper) / (spec.window - spec.taper)));
    const pts = [];
    const waves = new Map();
    for (let i = 0; i < rows.length; i++) {
      const a = rows[i];
      const d = ddays(ref, a.mid);
      if (d < 0 || d > spec.window) continue;
      waves.set(a.firm, (waves.get(a.firm) || 0) + 1);
      const w = (a.w0 != null ? a.w0 : a.n) * Math.exp(-LN2 * d / spec.half) * taperW(d);
      pts.push({
        ri: i,
        w,
        x: a.x - heV(he, a.firm, ref),
        n: a.n,
        firm: a.firm
      });
    }
    for (const p of pts) p.w /= Math.sqrt(waves.get(p.firm));
    return pts;
  }
  function monthWithSe(rows, he, ym, spec) {
    const rs = rows.filter(r => r.ym === ym);
    const waves = new Map();
    for (const r of rs) waves.set(r.firm, (waves.get(r.firm) || 0) + 1);
    return weightedWithSe(rs.map(r => ({
      w: r.n / Math.sqrt(waves.get(r.firm)),
      x: r.x - heV(he, r.firm, isoMs(ym + "-15")),
      n: r.n
    })), spec);
  }
  function rowsFor(houses) {
    const D = window.AP.D,
      spec = D.aggSpec;
    const all = D.individualPolls || [];
    const keep = houses ? new Set(houses) : null;
    let refNow = 0;
    for (const q of all) {
      const t = isoMs(q.released);
      if (t > refNow) refNow = t;
    }
    const rows = [];
    for (const q of all) {
      if (q.noAgg) continue;
      if (keep && !keep.has(q.pollster)) continue;
      if (!q.p) continue;
      const mid = q.mid != null ? q.mid : isoMs(q.released);
      rows.push({
        ym: q.ym,
        mid,
        firm: q.pollster,
        n: q.sampleEff != null ? q.sampleEff * spec.deff : Math.min(q.sample || 1200, spec.sampleCap),
        x: q.p
      });
    }
    return {
      rows,
      refNow
    };
  }
  window.AP = window.AP || {};
  window.AP.pvAgg = houses => {
    const D = window.AP.D,
      spec = D.aggSpec;
    const {
      rows,
      refNow
    } = rowsFor(houses);
    const rowsK = {};
    for (const k of PK) {
      rowsK[k] = [];
      for (const r of rows) if (r.x[k] != null) rowsK[k].push({
        ym: r.ym,
        mid: r.mid,
        x: r.x[k],
        n: r.n,
        firm: r.firm
      });
    }
    const he = {};
    for (const k of PK) he[k] = houseEffectsFor(rowsK[k], spec);
    const now = (() => {
      const adj = {};
      let plainTotal = 0,
        adjTotal = 0,
        n = 0;
      for (const k of PK) {
        const win = rowsK[k].filter(r => {
          const d = ddays(refNow, r.mid);
          return d >= 0 && d <= spec.window;
        });
        if (!win.length) return null;
        const est = weightedWithSe(nowcastPts(rowsK[k], he[k], refNow, spec), spec);
        adj[k] = est.v;
        plainTotal += mean(win.map(r => r.x));
        adjTotal += est.v;
        n = Math.max(n, est.n);
      }
      const rescaled = Math.abs(adjTotal - plainTotal) > 0.5;
      const out = {};
      for (const k of PK) out[k] = r1(rescaled ? adj[k] * (plainTotal / adjTotal) : adj[k]);
      out.n = n;
      return out;
    })();
    const have = new Set();
    for (const q of D.individualPolls || []) {
      if (houses && !new Set(houses).has(q.pollster)) continue;
      have.add(q.ym);
    }
    const months = [];
    for (const ym of D.MONTHS) {
      if (!have.has(ym)) continue;
      const o = {
        ym,
        x: D.mx(ym),
        ci: {}
      };
      let plainTotal = 0;
      for (const k of PK) {
        const rs = rowsK[k].filter(r => r.ym === ym);
        if (!rs.length) {
          o[k] = null;
          continue;
        }
        const est = monthWithSe(rowsK[k], he[k], ym, spec);
        o[k] = est.v;
        o.ci[k] = r1(1.96 * est.se);
        plainTotal += mean(rs.map(r => r.x));
      }
      const adjTotal = PK.reduce((s, k) => s + (o[k] == null ? 0 : o[k]), 0);
      if (adjTotal > 0 && Math.abs(adjTotal - plainTotal) > 0.5) for (const k of PK) if (o[k] != null) o[k] *= plainTotal / adjTotal;
      for (const k of PK) if (o[k] != null) o[k] = r1(o[k]);
      months.push(o);
    }
    return {
      months,
      now,
      refNow
    };
  };
})();