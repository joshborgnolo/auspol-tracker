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
    const evidenceN = {},
      evidenceFrom = {},
      evidenceLast = {};
    for (const d of devs) {
      evidenceN[d.firm] = (evidenceN[d.firm] || 0) + 1;
      if (evidenceFrom[d.firm] == null || d.mid < evidenceFrom[d.firm]) evidenceFrom[d.firm] = d.mid;
      if (evidenceLast[d.firm] == null || d.mid > evidenceLast[d.firm]) evidenceLast[d.firm] = d.mid;
    }
    return {
      at,
      evidenceN,
      evidenceFrom,
      evidenceLast,
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
        firm: a.firm,
        ...(a.pq != null ? {
          pq: a.pq
        } : {})
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
      n: r.n,
      ...(r.pq != null ? {
        pq: r.pq
      } : {})
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
    const nowAt = ref => {
      const adj = {};
      let plainTotal = 0,
        adjTotal = 0,
        n = 0;
      for (const k of PK) {
        const win = rowsK[k].filter(r => {
          const d = ddays(ref, r.mid);
          return d >= 0 && d <= spec.window;
        });
        if (!win.length) return null;
        const est = weightedWithSe(nowcastPts(rowsK[k], he[k], ref, spec), spec);
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
    };
    const now = nowAt(refNow);
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
      refNow,
      nowAt
    };
  };
  window.AP.flowAgg = T => {
    const D = window.AP.D,
      spec = D.aggSpec;
    if (!spec || !D.individualPolls || D.latest.method && D.latest.method.kind === "kalman") return null;
    const r2 = v => Math.round(v * 100) / 100;
    const C = T.lnp,
      O = T.onp,
      B = T.onBand,
      cnr = T.cnr || 0;
    const n0 = v => v == null ? 0 : v;
    const impC = p => p.alp + C.grn * n0(p.grn) + C.onp * n0(p.onp) + C.oth * n0(p.oth) + cnr;
    const impO = p => p.alp + p.lnp * O.lnp + p.grn * O.grn + n0(p.oth) * O.oth;
    const onpOptional = !!(window.JUR && window.JUR.onpOptional);
    let refNow = 0;
    for (const q of D.individualPolls) {
      const t = isoMs(q.released);
      if (t > refNow) refNow = t;
    }
    const rowsC = [],
      rowsO = [];
    for (const q of D.individualPolls) {
      const p = q.p;
      if (q.noAgg || q.impOut || !p || p.alp == null || p.lnp == null || p.grn == null) continue;
      if (p.onp == null && !(onpOptional && p.oth != null)) continue;
      const base = {
        q,
        ym: q.ym,
        mid: q.mid != null ? q.mid : isoMs(q.released),
        firm: q.pollster,
        p,
        n: q.sampleEff != null ? q.sampleEff * spec.deff : Math.min(q.sample || 1200, spec.sampleCap)
      };
      const c = {
        ...base,
        x: impC(p)
      };
      rowsC.push(c);
      if (p.onp != null) {
        const o = {
          ...base,
          x: impO(p),
          bn: p.lnp * B.lnp + p.grn * B.grn + n0(p.oth) * B.oth
        };
        c.on = o;
        rowsO.push(o);
      }
    }
    const memberC = new Set(rowsC.map(r => r.q)),
      memberO = new Set(rowsO.map(r => r.q));
    const nowcast = (rows, he, ref) => {
      const r = weightedWithSe(nowcastPts(rows, he, ref, spec), spec);
      return r && {
        v: r1(r.v),
        n: r.n,
        se: r2(r.se),
        nEff: r1(r.nEff),
        ci95: r1(1.96 * r.se)
      };
    };
    const E = D.aggPrimary && D.aggPrimary[0] && D.aggPrimary[0].election ? D.aggPrimary[0] : null;
    const monthsOf = (rows, he, elecV) => {
      const out = [];
      for (const ym of D.MONTHS) {
        const r = monthWithSe(rows, he, ym, spec);
        if (r) out.push({
          ym,
          x: D.mx(ym),
          alp: r1(r.v),
          lnp: r1(100 - r.v),
          ci95: r1(1.96 * r.se),
          k: r.n
        });
      }
      if (E && elecV != null) out.unshift({
        ym: E.ym,
        x: E.x,
        alp: r1(elecV),
        lnp: r1(100 - elecV),
        ci95: 0,
        k: 0,
        election: true
      });
      return out;
    };
    const heC = houseEffectsFor(rowsC, spec);
    const synth2pp = monthsOf(rowsC, heC, E ? impC(E) : null);
    const sNow = nowcast(rowsC, heC, refNow),
      s1 = nowcast(rowsC, heC, refNow - 30 * DAY);
    const synthLatest = sNow && {
      alp: sNow.v,
      n: sNow.n,
      se: sNow.se,
      nEff: sNow.nEff,
      ci95: sNow.ci95,
      ...(s1 && sNow.se != null && s1.se != null ? (() => {
        const seChg = Math.sqrt(sNow.se ** 2 + s1.se ** 2);
        return {
          changeSe: r1(seChg),
          changeCi95: r1(1.96 * seChg),
          changeSig: Math.abs(sNow.v - s1.v) > 1.96 * seChg
        };
      })() : {}),
      lnp: r1(100 - sNow.v),
      prev: s1 ? s1.v : null
    };
    let flowSens = null;
    if (T.onp22 != null) {
      const d22 = T.onp22 - C.onp;
      const rows22 = rowsC.map(r => ({
        ...r,
        x: r.x + d22 * n0(r.p.onp)
      }));
      const alt = monthsOf(rows22, houseEffectsFor(rows22, spec), E ? impC(E) + d22 * n0(E.onp) : null);
      flowSens = synth2pp.map(m => {
        const a = alt.find(q => q.ym === m.ym);
        return a ? {
          ym: m.ym,
          x: m.x,
          lo: Math.min(m.alp, a.alp),
          hi: Math.max(m.alp, a.alp)
        } : null;
      }).filter(Boolean);
    }
    const heO = houseEffectsFor(rowsO, spec);
    const synthOn = [];
    for (const ym of D.MONTHS) {
      const r = monthWithSe(rowsO, heO, ym, spec);
      if (!r) continue;
      let bnSum = 0,
        nSum = 0;
      for (const q of rowsO) if (q.ym === ym) {
        bnSum += q.n * q.bn;
        nSum += q.n;
      }
      const cs = 1.96 * r.se,
        cf = bnSum / nSum;
      synthOn.push({
        ym,
        x: D.mx(ym),
        a: r1(r.v),
        b: r1(100 - r.v),
        ci95: r1(Math.hypot(cs, cf)),
        cs: r1(cs),
        cf: r1(cf),
        k: r.n
      });
    }
    const P = D.latest.primary;
    let onImp = D.latest.onImp;
    if (P && onImp) {
      const fp = q => q.alp + q.lnp * O.lnp + q.grn * O.grn + q.oth * O.oth;
      const a = fp(P),
        band = P.lnp * B.lnp + P.grn * B.grn + P.oth * B.oth;
      const nw = nowcast(rowsO, heO, refNow),
        pv = nowcast(rowsO, heO, refNow - 30 * DAY);
      const prevP = window.AP.pvAgg ? window.AP.pvAgg(null).nowAt(refNow - 30 * DAY) : null;
      const cs = nw ? nw.ci95 : null;
      onImp = {
        a: r1(a),
        b: r1(100 - a),
        band: r1(band),
        ...(cs != null ? {
          cs: r1(cs),
          ci95: r1(Math.hypot(cs, band))
        } : {
          ci95: r1(band)
        }),
        n: onImp.n,
        aPrev: prevP ? r1(fp(prevP)) : null,
        ...(nw && pv && nw.se != null && pv.se != null ? (() => {
          const seChg = Math.sqrt(nw.se ** 2 + pv.se ** 2);
          return {
            changeSe: r1(seChg),
            changeCi95: r1(1.96 * seChg),
            changeSig: Math.abs(nw.v - pv.v) > 1.96 * seChg
          };
        })() : {})
      };
    }
    const dGap = {
      alp: 0,
      lnp: -100 * O.lnp,
      grn: 100 * (C.grn - O.grn),
      onp: 100 * C.onp,
      oth: 100 * (C.oth - O.oth)
    };
    const gapRows = [];
    for (const r of rowsC) {
      if (!r.on) continue;
      const p = r.p,
        t = n0(p.alp) + n0(p.lnp) + n0(p.grn) + n0(p.onp) + n0(p.oth);
      if (!t) continue;
      let m1 = 0,
        m2 = 0;
      for (const k of Object.keys(dGap)) {
        const s = n0(p[k]) / t;
        m1 += s * dGap[k];
        m2 += s * dGap[k] ** 2;
      }
      gapRows.push({
        ...r,
        x: r.x - r.on.x,
        pq: Math.max(m2 - m1 * m1, 1)
      });
    }
    const gapHE = houseEffectsFor(gapRows, spec);
    const cfBy = Object.fromEntries(synthOn.map(d => [d.ym, d.cf]));
    const rivalWalk = synth2pp.map(d => {
      const g = d.election ? null : monthWithSe(gapRows, gapHE, d.ym, spec);
      const gapM = g ? Math.hypot(1.96 * g.se, cfBy[d.ym] || 0) : 0;
      if (g && g.v > gapM) return {
        ym: d.ym,
        who: "alp_on",
        why: "2pp"
      };
      return {
        ym: d.ym,
        who: "alp_lnp",
        why: g && g.v < -gapM ? "2pp" : "default"
      };
    });
    const DAY_ = DAY,
      isoOf = d => new Date(d * DAY_).toISOString().slice(0, 10);
    const taperW = d => d <= spec.taper ? 1 : 0.5 * (1 + Math.cos(Math.PI * (d - spec.taper) / (spec.window - spec.taper)));
    const kW = d => Math.exp(-LN2 * d / spec.half) * taperW(d);
    const aroundPts = (rows, he, ref, skip) => {
      const pts = [],
        waves = new Map();
      for (const a of rows) {
        if (skip && a === skip) continue;
        const d = Math.abs(ddays(ref, a.mid));
        if (d > spec.window) continue;
        waves.set(a.firm, (waves.get(a.firm) || 0) + 1);
        pts.push({
          w: a.n * kW(d),
          x: a.x - heV(he, a.firm, ref),
          n: a.n,
          firm: a.firm
        });
      }
      for (const p of pts) p.w /= Math.sqrt(waves.get(p.firm));
      return pts;
    };
    const T1 = Math.round(refNow / DAY_);
    const yardSeries = (rows, he) => {
      const at = new Map();
      if (!rows.length) return {
        at,
        line: [],
        outside: () => null
      };
      const g = [];
      for (let d = Math.floor(Math.min(...rows.map(r => r.mid)) / DAY_); d < T1; d += 4) g.push(d);
      g.push(T1);
      const est = (t, skip) => {
        const e = weightedWithSe(aroundPts(rows, he, t, skip), spec);
        return e ? e.v : null;
      };
      const patch = (valAt, mid) => {
        const idx = g.map((d, i) => Math.abs(d * DAY_ - mid) <= spec.window * DAY_ ? i : -1).filter(i => i >= 0);
        return idx.length ? {
          i: idx[0],
          v: idx.map(i => {
            const v = valAt(g[i]);
            return v == null ? null : r1(v);
          })
        } : null;
      };
      for (const r of rows) {
        const e = weightedWithSe(aroundPts(rows, he, r.mid, r), spec);
        if (e) at.set(r.q, {
          v: r2(e.v),
          he: r2(heV(he, r.firm, r.mid)),
          n: e.n,
          p: patch(d => est(Math.min(d * DAY_, refNow), r), r.mid)
        });
      }
      const line = g.map(d => {
        const v = est(Math.min(d * DAY_, refNow), null);
        return [isoOf(d), v == null ? null : r1(v)];
      });
      for (const y of at.values()) {
        const pp = y.p;
        let t = null;
        if (pp) {
          const same = j => pp.v[j] === line[pp.i + j][1];
          let a = 0,
            b = pp.v.length - 1;
          while (a <= b && same(a)) a++;
          while (b >= a && same(b)) b--;
          t = a > b ? null : {
            i: pp.i + a,
            v: pp.v.slice(a, b + 1)
          };
        }
        if (t) y.p = t;else delete y.p;
      }
      const outside = (mid, firm) => {
        const e = weightedWithSe(aroundPts(rows, he, mid, null), spec);
        const hv = he && he.evidenceN && he.evidenceN[firm] != null ? r2(heV(he, firm, mid)) : null;
        return e ? {
          v: r2(e.v),
          he: hv,
          n: e.n
        } : null;
      };
      return {
        at,
        line,
        outside
      };
    };
    const yardImp = yardSeries(rowsC, heC),
      yardOn = yardSeries(rowsO, heO);
    const effOf = (rows, he) => {
      const cur = nowcast(rows, he, refNow),
        out = new Map();
      if (!cur) return out;
      for (const r of rows) {
        const rest = rows.filter(q => q !== r);
        const lo = nowcast(rest, he, refNow);
        if (!lo) continue;
        const dd = ddays(refNow, r.mid);
        const e = {
          lo: lo.v,
          hi: cur.v,
          w: dd >= 0 && dd <= spec.window ? 1 : 0
        };
        if (!e.w) {
          const t0 = isoMs(r.q.released),
            hi = nowcast(rows, he, t0),
            l2 = nowcast(rest, he, t0);
          if (hi && l2) e.t = {
            lo: l2.v,
            hi: hi.v
          };
        }
        out.set(r.q, e);
      }
      return out;
    };
    const effImp = effOf(rowsC, heC),
      effOn = effOf(rowsO, heO);
    const twin = new Map(D.individualPolls.map(q => [q.released + "|" + q.pollster, q]));
    const pollYard = q0 => {
      const q = memberC.has(q0) || memberO.has(q0) ? q0 : twin.get(q0.released + "|" + q0.pollster) || q0;
      const y = {},
        f = {};
      const im = yardImp.at.has(q) ? yardImp.at.get(q) : !memberC.has(q) && q.alpImp != null ? yardImp.outside(q.mid != null ? q.mid : isoMs(q.released), q.pollster) : null;
      const on = yardOn.at.has(q) ? yardOn.at.get(q) : !memberO.has(q) && q.alpOnImp != null ? yardOn.outside(q.mid != null ? q.mid : isoMs(q.released), q.pollster) : null;
      if (im) y.imp = im;
      if (on) y.onimp = on;
      if (effImp.has(q)) f.imp = effImp.get(q);
      if (effOn.has(q)) f.onimp = effOn.get(q);
      return {
        yd: y,
        eff: f
      };
    };
    const ordered = (keep, obj) => {
      const out = {};
      for (const k of Object.keys(keep || {})) if (k in obj) out[k] = obj[k];
      for (const k of Object.keys(obj)) if (!(k in out)) out[k] = obj[k];
      return out;
    };
    const leanOf = (he, keep) => {
      const out = {};
      for (const [firm, n] of Object.entries(he.evidenceN)) {
        if (n < 3 || ddays(refNow, he.evidenceLast[firm]) >= spec.leanStaleDays) continue;
        out[firm] = D.MONTHS.filter(ym => isoMs(ym + "-15") >= he.evidenceFrom[firm]).map(ym => ({
          ym,
          v: r1(he.at(firm, isoMs(ym + "-15")))
        }));
      }
      return ordered(keep, out);
    };
    const snapOf = (he, keep) => ordered(keep, Object.fromEntries(Object.keys(he.evidenceN).map(f => [f, {
      v: r1(he.at(f, Infinity)),
      n: he.evidenceN[f]
    }])));
    const HL = D.houseLean || {},
      HE = D.houseEffects || {};
    const houseLean = spec.leanStaleDays != null ? {
      imp: leanOf(heC, HL.imp),
      onimp: leanOf(heO, HL.onimp)
    } : null;
    const houseEffects = {
      synth: snapOf(heC, HE.synth),
      synthOn: snapOf(heO, HE.synthOn)
    };
    const pollImp = q => {
      const p = q.p;
      if (!p || q.alpImp == null) return null;
      const s = PK.reduce((t, k) => t + n0(p[k]), 0);
      const f = Math.abs(s - 100) <= 2 ? 1 : 100 / s;
      const sc = {};
      for (const k of PK) if (p[k] != null) sc[k] = p[k] * f;
      return {
        alpImp: r1(impC(sc)),
        ...(q.alpOnImp != null && sc.onp != null ? {
          alpOnImp: r1(impO(sc))
        } : {})
      };
    };
    return {
      synth2pp,
      synthLatest,
      flowSens,
      synthOn,
      onImp,
      rivalWalk,
      rivalLead: rivalWalk.length ? rivalWalk[rivalWalk.length - 1].who : "alp_lnp",
      pollImp,
      pollYard,
      yardLine: {
        imp: yardImp.line,
        onimp: yardOn.line
      },
      houseLean,
      houseEffects
    };
  };
  let kept = null;
  const sameCells = (a, b) => ["grn", "onp", "oth", "lnp"].every(k => a[k] === b[k]);
  window.AP.flowsUser = null;
  window.AP.flowsSite = () => kept ? kept.flowTables : window.AP.D.flowTables;
  window.AP.flowsEditable = () => !!(window.AP.D.aggSpec && window.AP.D.individualPolls && !(window.AP.D.latest.method && window.AP.D.latest.method.kind === "kalman") && window.AP.D.flowTables && window.AP.D.flowTables.lnp && window.AP.D.flowTables.onp);
  window.AP.setFlows = cells => {
    const D = window.AP.D;
    if (!window.AP.flowsEditable()) return false;
    const rowsOf = () => [...(D.individualPolls || []), ...(D.pollsterTable || [])];
    if (!kept) kept = {
      flowTables: D.flowTables,
      synth2pp: D.synth2pp,
      synthLatest: D.synthLatest,
      flowSens: D.flowSens,
      synthOn: D.synthOn,
      onImp: D.latest.onImp,
      rivalWalk: D.rivalWalk,
      rivalLead: D.latest.rivalLead,
      polls: new Map(rowsOf().map(q => [q, {
        alpImp: q.alpImp,
        alpOnImp: q.alpOnImp,
        yd: q.yd,
        eff: q.eff
      }])),
      yardLine: D.yardLine,
      houseLean: D.houseLean,
      houseEffects: D.houseEffects
    };
    const site = kept.flowTables;
    const T = cells && {
      ...site,
      lnp: {
        ...site.lnp,
        ...(cells.lnp || {})
      },
      onp: {
        ...site.onp,
        ...(cells.onp || {})
      }
    };
    const custom = !!T && !(sameCells(T.lnp, site.lnp) && sameCells(T.onp, site.onp));
    const prevLead = D.latest.rivalLead;
    if (!custom) {
      Object.assign(D, {
        flowTables: kept.flowTables,
        synth2pp: kept.synth2pp,
        synthLatest: kept.synthLatest,
        flowSens: kept.flowSens,
        synthOn: kept.synthOn,
        rivalWalk: kept.rivalWalk
      });
      D.latest.onImp = kept.onImp;
      D.latest.rivalLead = kept.rivalLead;
      for (const [q, v] of kept.polls) {
        for (const f of ["alpImp", "alpOnImp", "yd", "eff"]) {
          if (v[f] === undefined) delete q[f];else q[f] = v[f];
        }
      }
      D.yardLine = kept.yardLine;
      D.houseLean = kept.houseLean;
      D.houseEffects = kept.houseEffects;
      window.AP.flowsUser = null;
    } else {
      const o = window.AP.flowAgg(T);
      if (!o) return false;
      Object.assign(D, {
        flowTables: T,
        synth2pp: o.synth2pp,
        synthLatest: o.synthLatest,
        flowSens: o.flowSens,
        synthOn: o.synthOn,
        rivalWalk: o.rivalWalk
      });
      D.latest.onImp = o.onImp;
      D.latest.rivalLead = o.rivalLead;
      const swap = (orig, fresh) => {
        if (!orig) return orig;
        const out = {
          ...orig
        };
        for (const k of ["imp", "onimp"]) if (orig[k] && fresh[k]) out[k] = fresh[k];
        return out;
      };
      for (const [q, v] of kept.polls) {
        const r = o.pollImp(q);
        if (r) {
          q.alpImp = r.alpImp;
          if (r.alpOnImp != null) q.alpOnImp = r.alpOnImp;
        }
        const y = o.pollYard(q);
        if (v.yd) q.yd = swap(v.yd, y.yd);
        if (v.eff) q.eff = swap(v.eff, y.eff);
      }
      D.yardLine = {
        ...kept.yardLine,
        ...o.yardLine
      };
      if (o.houseLean) D.houseLean = {
        ...kept.houseLean,
        ...o.houseLean
      };
      D.houseEffects = {
        ...kept.houseEffects,
        ...o.houseEffects
      };
      window.AP.flowsUser = {
        lnp: T.lnp,
        onp: T.onp
      };
    }
    if (typeof window.dispatchEvent === "function") window.dispatchEvent(new CustomEvent("ap:flows", {
      detail: {
        custom,
        prevLead,
        lead: D.latest.rivalLead
      }
    }));
    return true;
  };
})();