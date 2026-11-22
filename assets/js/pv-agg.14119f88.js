(() => {
  "use strict";

  const DEFF = 1.6;
  const WIDE_SD = 0.5;
  const PARTIES = ["alp", "lnp", "grn", "onp", "oth"];
  function helmert(K) {
    const B = Array.from({
      length: K
    }, () => new Float64Array(Math.max(0, K - 1)));
    for (let k = 1; k < K; k++) {
      const s = 1 / Math.sqrt(k * (k + 1));
      for (let j = 0; j < k; j++) B[j][k - 1] = s;
      B[k][k - 1] = -k * s;
    }
    return B;
  }
  function cholIn(A, n, L) {
    let ld = 0;
    for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) {
      let s = A[i * n + j];
      for (let k = 0; k < j; k++) s -= L[i * n + k] * L[j * n + k];
      if (i === j) {
        const v = Math.sqrt(Math.max(s, 1e-14));
        L[i * n + i] = v;
        ld += 2 * Math.log(v);
      } else L[i * n + j] = s / L[j * n + j];
    }
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) L[i * n + j] = 0;
    return ld;
  }
  function cholSolveVec(L, n, b) {
    for (let i = 0; i < n; i++) {
      let s = b[i];
      for (let k = 0; k < i; k++) s -= L[i * n + k] * b[k];
      b[i] = s / L[i * n + i];
    }
    for (let i = n - 1; i >= 0; i--) {
      let s = b[i];
      for (let k = i + 1; k < n; k++) s -= L[k * n + i] * b[k];
      b[i] = s / L[i * n + i];
    }
  }
  function categoriesOf(y, parties = PARTIES) {
    const P = parties.length,
      ref = P - 1;
    const cats = [],
      vals = [];
    const refMembers = [ref];
    for (let k = 0; k < P - 1; k++) {
      const v = y[parties[k]];
      if (v == null) refMembers.push(k);else if (v > 0) {
        cats.push([k]);
        vals.push(v);
      } else return null;
    }
    let vr = y[parties[ref]];
    if (vr == null || !(vr > 0)) return null;
    cats.push(refMembers);
    vals.push(vr);
    if (cats.length < 2) return null;
    return {
      cats,
      vals,
      full: cats.length === P
    };
  }
  function stepOf(vals) {
    if (vals.every(v => Math.abs(v - Math.round(v)) < 1e-6)) return 1;
    if (vals.every(v => Math.abs(v * 2 - Math.round(v * 2)) < 1e-6)) return 0.5;
    return 0.1;
  }
  function zeroBasis(w) {
    const K = w.length,
      nrm = Math.hypot(...w),
      u = w.map(x => x / nrm),
      vs = [];
    for (let j = 0; j < K && vs.length < K - 1; j++) {
      const v = Float64Array.from({
        length: K
      }, (_, i) => (i === j ? 1 : 0) - u[j] * u[i]);
      for (const q of vs) {
        let d = 0;
        for (let i = 0; i < K; i++) d += v[i] * q[i];
        for (let i = 0; i < K; i++) v[i] -= d * q[i];
      }
      const n2 = Math.hypot(...v);
      if (n2 < 1e-8) continue;
      vs.push(v.map(x => x / n2));
    }
    return Array.from({
      length: K
    }, (_, h) => Float64Array.from(vs, q => q[h]));
  }
  function makeLayout(houses, coreSet, P, trend = false, zeroW = null) {
    const D = P - 1;
    const core = houses.filter(h => coreSet.has(h)),
      other = houses.filter(h => !coreSet.has(h));
    const K = core.length,
      Q = other.length,
      nbLean = 1 + Math.max(0, K - 1) + Q,
      nb = nbLean + (trend ? 1 : 0),
      N = nb * D;
    const B = zeroW ? zeroBasis(core.map(h => zeroW.get(h) || 1)) : helmert(K);
    const coef = new Map();
    core.forEach((h, j) => {
      const c = new Float64Array(nb);
      c[0] = 1;
      for (let k = 0; k < K - 1; k++) c[1 + k] = B[j][k];
      coef.set(h, c);
    });
    other.forEach((h, q) => {
      const c = new Float64Array(nb);
      c[0] = 1;
      c[K + q] = 1;
      coef.set(h, c);
    });
    const nz = new Map([...coef].map(([h, c]) => [h, [...c.keys()].filter(b => c[b] !== 0)]));
    return {
      houses,
      core,
      other,
      K,
      Q,
      nb,
      nbLean,
      N,
      D,
      P,
      coef,
      nz,
      trend,
      vOff: trend ? nbLean * D : -1
    };
  }
  function predictStep(x, Pm, L, th, dt, jmp) {
    const {
      N,
      D,
      P,
      nbLean
    } = L;
    if (dt <= 0 && !jmp) return;
    const w2 = th._w2 || (th._w2 = Array.from(th.w, v => v * v)),
      wr2 = w2[P - 1],
      d2 = th.d * th.d,
      J2 = th.J * th.J;
    if (L.trend && dt > 0) {
      const vo = L.vOff,
        phi = Math.exp(-dt / th.tau);
      if (x) {
        for (let k = 0; k < D; k++) x[k] += dt * x[vo + k];
        for (let k = 0; k < D; k++) x[vo + k] *= phi;
      }
      if (Pm) {
        for (let k = 0; k < D; k++) {
          const rk = k * N,
            rv = (vo + k) * N;
          for (let j = 0; j < N; j++) Pm[rk + j] += dt * Pm[rv + j];
        }
        for (let k = 0; k < D; k++) {
          const rv = (vo + k) * N;
          for (let j = 0; j < N; j++) Pm[rv + j] *= phi;
        }
        for (let i = 0; i < N; i++) {
          const ri = i * N;
          for (let k = 0; k < D; k++) Pm[ri + k] += dt * Pm[ri + vo + k];
          for (let k = 0; k < D; k++) Pm[ri + vo + k] *= phi;
        }
        const nu2 = th.nu * th.nu;
        for (let i = 0; i < D; i++) for (let j = 0; j < D; j++) {
          const q = nu2 * ((i === j ? w2[i] : 0) + wr2);
          Pm[i * N + j] += q * dt * dt * dt / 3;
          Pm[i * N + vo + j] += q * dt * dt / 2;
          Pm[(vo + i) * N + j] += q * dt * dt / 2;
          Pm[(vo + i) * N + vo + j] += q * dt;
        }
      }
    }
    if (!Pm) return;
    for (let i = 0; i < D; i++) for (let j = 0; j < D; j++) Pm[i * N + j] += dt * ((i === j ? w2[i] : 0) + wr2) + jmp * J2 * ((i === j ? 1 : 0) + 1);
    if (d2 > 0 && dt > 0) for (let b = 1; b < nbLean; b++) {
      const o = b * D;
      for (let i = 0; i < D; i++) for (let j = 0; j < D; j++) Pm[(o + i) * N + o + j] += dt * d2 * ((i === j ? 1 : 0) + 1);
    }
  }
  const LOG2PI = Math.log(2 * Math.PI);
  function runFilter(obs, L, events, th, opts) {
    const {
      N,
      D,
      P,
      nb
    } = L;
    const x = new Float64Array(N),
      Pm = new Float64Array(N * N);
    x.set(opts.anchor.mean, 0);
    for (let i = 0; i < D; i++) for (let j = 0; j < D; j++) Pm[i * N + j] = opts.anchor.cov[i * D + j];
    for (let b = 1; b < L.nbLean; b++) {
      const s2 = (b < L.K ? th.s : WIDE_SD) ** 2,
        o = b * D;
      for (let i = 0; i < D; i++) for (let j = 0; j < D; j++) Pm[(o + i) * N + o + j] = s2 * ((i === j ? 1 : 0) + 1);
    }
    if (L.trend) {
      const vo = L.vOff,
        w2 = Array.from(th.w, v => v * v);
      for (let i = 0; i < D; i++) for (let j = 0; j < D; j++) Pm[(vo + i) * N + vo + j] = th.nu * th.nu * ((i === j ? w2[i] : 0) + w2[P - 1]) * th.tau / 2;
    }
    const w2 = Array.from(th.w, v => v * v),
      wr2 = w2[P - 1],
      d2 = th.d * th.d,
      J2 = th.J * th.J;
    const store = !!opts.store,
      NN = N * N;
    const xsF = store ? new Float64Array(events.length * N) : null,
      PsF = store ? new Float64Array(events.length * NN) : null;
    const qinfo = store ? new Float64Array(events.length * 2) : null;
    const upd = store ? [] : null;
    const U = new Float64Array(N * D),
      PH = new Float64Array(N * 4),
      S = new Float64Array(16),
      Ls = new Float64Array(16),
      Kg = new Float64Array(N * 4);
    const mu = new Float64Array(D),
      pr = new Float64Array(P),
      Jm = new Float64Array(4 * D),
      V = new Float64Array(D * D);
    let ll = 0,
      prev = null,
      oi = 0,
      nObs = 0;
    for (let ev = 0; ev < events.length; ev++) {
      const t = events[ev];
      let dt = 0,
        jmp = 0;
      if (prev != null) {
        dt = t - prev;
        for (const jd of opts.jumps) if (jd > prev && jd <= t) jmp = 1;
        predictStep(x, Pm, L, th, dt, jmp);
      }
      while (oi < obs.length && obs[oi].day === t) {
        const o = obs[oi++],
          c = L.coef.get(o.house),
          nzb = L.nz.get(o.house);
        for (let k = 0; k < D; k++) {
          let s = 0;
          for (const b of nzb) s += c[b] * x[b * D + k];
          mu[k] = s;
        }
        let mx = 0;
        for (let k = 0; k < D; k++) mx = Math.max(mx, mu[k]);
        let z = Math.exp(-mx);
        pr[P - 1] = z;
        for (let k = 0; k < D; k++) {
          pr[k] = Math.exp(mu[k] - mx);
          z += pr[k];
        }
        for (let k = 0; k < P; k++) pr[k] /= z;
        const cats = o.cats,
          C = cats.length,
          m = C - 1,
          refc = cats[C - 1];
        const Pc = cats.map(cc => cc.reduce((a, k) => a + pr[k], 0)),
          Pref = Pc[C - 1];
        Jm.fill(0);
        for (let ci = 0; ci < m; ci++) for (const k of cats[ci]) Jm[ci * D + k] += pr[k] / Pc[ci];
        for (const k of refc) if (k < D) for (let ci = 0; ci < m; ci++) Jm[ci * D + k] -= pr[k] / Pref;
        const v = new Float64Array(m),
          zlin = new Float64Array(m);
        for (let ci = 0; ci < m; ci++) {
          const g = Math.log(Pc[ci] / Pref),
            yo = Math.log(o.vals[ci] / o.vals[C - 1]);
          v[ci] = yo - g;
          let jm = 0;
          for (let k = 0; k < D; k++) jm += Jm[ci * D + k] * mu[k];
          zlin[ci] = yo - g + jm;
        }
        const kap = opts.kappa?.get(o.house) ?? 1,
          rr = o.step * o.step / 12 / 1e4,
          nz2 = th.noise ? (th.noise / 100) ** 2 : 0;
        for (let a = 0; a < m; a++) for (let b2 = 0; b2 < m; b2++) S[a * m + b2] = kap * ((a === b2 ? 1 / Pc[a] : 0) + 1 / Pref) / o.n + (opts.rounding === false ? 0 : rr * ((a === b2 ? 1 / (Pc[a] * Pc[a]) : 0) + 1 / (Pref * Pref))) + nz2 * ((a === b2 ? 1 / (Pc[a] * Pc[a]) : 0) + 1 / (Pref * Pref));
        if (opts.lone && opts.lone.has(o.house)) {
          const w2l = WIDE_SD * WIDE_SD;
          for (let a = 0; a < m; a++) for (let b2 = 0; b2 < m; b2++) {
            let s1 = 0,
              sa = 0,
              sb = 0;
            for (let k = 0; k < D; k++) {
              s1 += Jm[a * D + k] * Jm[b2 * D + k];
              sa += Jm[a * D + k];
              sb += Jm[b2 * D + k];
            }
            S[a * m + b2] += w2l * (s1 + sa * sb);
          }
        }
        const Rsave = store ? S.slice(0, m * m) : null;
        U.fill(0);
        for (let r = 0; r < N; r++) {
          const row = r * N;
          for (const b of nzb) {
            const cb = c[b],
              o2 = b * D;
            for (let k = 0; k < D; k++) U[r * D + k] += cb * Pm[row + o2 + k];
          }
        }
        V.fill(0);
        for (const b of nzb) {
          const cb = c[b],
            o2 = b * D;
          for (let k = 0; k < D; k++) for (let l = 0; l < D; l++) V[k * D + l] += cb * U[(o2 + k) * D + l];
        }
        for (let r = 0; r < N; r++) for (let a = 0; a < m; a++) {
          let s = 0;
          for (let k = 0; k < D; k++) s += U[r * D + k] * Jm[a * D + k];
          PH[r * m + a] = s;
        }
        for (let a = 0; a < m; a++) for (let b2 = 0; b2 < m; b2++) {
          let s = 0;
          for (let k = 0; k < D; k++) {
            const jk = Jm[a * D + k];
            if (!jk) continue;
            for (let l = 0; l < D; l++) s += jk * V[k * D + l] * Jm[b2 * D + l];
          }
          S[a * m + b2] += s;
        }
        const ld = cholIn(S, m, Ls);
        const sv = Float64Array.from(v);
        cholSolveVec(Ls, m, sv);
        let q = 0;
        for (let a = 0; a < m; a++) q += v[a] * sv[a];
        ll += -0.5 * (m * LOG2PI + ld + q);
        nObs += m;
        const tmp = new Float64Array(m);
        for (let r = 0; r < N; r++) {
          for (let a = 0; a < m; a++) tmp[a] = PH[r * m + a];
          cholSolveVec(Ls, m, tmp);
          for (let a = 0; a < m; a++) Kg[r * m + a] = tmp[a];
        }
        for (let r = 0; r < N; r++) {
          let s = 0;
          for (let a = 0; a < m; a++) s += Kg[r * m + a] * v[a];
          x[r] += s;
        }
        for (let r = 0; r < N; r++) {
          const row = r * N;
          for (let a = 0; a < m; a++) {
            const kr = Kg[r * m + a];
            if (!kr) continue;
            for (let cc = 0; cc < N; cc++) Pm[row + cc] -= kr * PH[cc * m + a];
          }
        }
        if (store) {
          const H = new Float64Array(m * N);
          for (let a = 0; a < m; a++) for (const b of nzb) for (let k = 0; k < D; k++) H[a * N + b * D + k] += c[b] * Jm[a * D + k];
          upd.push({
            k: ev,
            idx: o.idx,
            H,
            R: Rsave,
            zlin,
            m
          });
        }
      }
      if (store) {
        xsF.set(x, ev * N);
        PsF.set(Pm, ev * NN);
        qinfo[ev * 2] = dt;
        qinfo[ev * 2 + 1] = jmp;
      }
      prev = t;
    }
    return {
      ll,
      nObs,
      xsF,
      PsF,
      qinfo,
      upd,
      N,
      D,
      x: Float64Array.from(x),
      P: Float64Array.from(Pm)
    };
  }
  function smooth(f, L, th) {
    const {
        N
      } = L,
      NN = N * N,
      E = f.qinfo.length / 2;
    const xs = new Float64Array(E * N),
      Ps = new Float64Array(E * NN),
      G = new Float64Array(E * NN);
    xs.set(f.xsF.subarray((E - 1) * N, E * N), (E - 1) * N);
    Ps.set(f.PsF.subarray((E - 1) * NN, E * NN), (E - 1) * NN);
    const Pp = new Float64Array(NN),
      Lc = new Float64Array(NN),
      col = new Float64Array(N),
      Gk = new Float64Array(NN),
      dP = new Float64Array(NN),
      T = new Float64Array(NN),
      FP = new Float64Array(NN),
      Fx = new Float64Array(N);
    for (let k = E - 2; k >= 0; k--) {
      const Pf = f.PsF.subarray(k * NN, (k + 1) * NN),
        dt = f.qinfo[(k + 1) * 2],
        jmp = f.qinfo[(k + 1) * 2 + 1];
      Pp.set(Pf);
      predictStep(null, Pp, L, th, dt, jmp);
      FP.set(Pf);
      if (L.trend && dt > 0) {
        const vo = L.vOff,
          D = L.D,
          phi = Math.exp(-dt / th.tau);
        for (let q = 0; q < D; q++) {
          const rk = q * N,
            rv = (vo + q) * N;
          for (let j = 0; j < N; j++) FP[rk + j] += dt * Pf[rv + j];
        }
        for (let q = 0; q < D; q++) {
          const rv = (vo + q) * N;
          for (let j = 0; j < N; j++) FP[rv + j] *= phi;
        }
      }
      cholIn(Pp, N, Lc);
      for (let c = 0; c < N; c++) {
        for (let r = 0; r < N; r++) col[r] = FP[r * N + c];
        cholSolveVec(Lc, N, col);
        for (let r = 0; r < N; r++) Gk[c * N + r] = col[r];
      }
      G.set(Gk, k * NN);
      const xf = f.xsF.subarray(k * N, (k + 1) * N),
        xn = xs.subarray((k + 1) * N, (k + 2) * N),
        xo = xs.subarray(k * N, (k + 1) * N);
      Fx.set(xf);
      predictStep(Fx, null, L, th, dt, 0);
      for (let i = 0; i < N; i++) {
        let s = 0;
        const gi = i * N;
        for (let j = 0; j < N; j++) s += Gk[gi + j] * (xn[j] - Fx[j]);
        xo[i] = xf[i] + s;
      }
      const Pn = Ps.subarray((k + 1) * NN, (k + 2) * NN);
      for (let i = 0; i < NN; i++) dP[i] = Pn[i] - Pp[i];
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
        let s = 0;
        for (let l = 0; l < N; l++) s += Gk[i * N + l] * dP[l * N + j];
        T[i * N + j] = s;
      }
      const Po = Ps.subarray(k * NN, (k + 1) * NN);
      for (let i = 0; i < N; i++) for (let j = 0; j <= i; j++) {
        let s = 0;
        for (let l = 0; l < N; l++) s += T[i * N + l] * Gk[j * N + l];
        const v = Pf[i * N + j] + s;
        Po[i * N + j] = v;
        Po[j * N + i] = v;
      }
    }
    return {
      xs,
      Ps,
      G,
      E,
      N
    };
  }
  const softmaxAlr = eta => {
    const D = eta.length;
    let mx = 0;
    for (let k = 0; k < D; k++) mx = Math.max(mx, eta[k]);
    const p = new Float64Array(D + 1);
    let z = Math.exp(-mx);
    p[D] = z;
    for (let k = 0; k < D; k++) {
      p[k] = Math.exp(eta[k] - mx);
      z += p[k];
    }
    for (let k = 0; k <= D; k++) p[k] /= z;
    return p;
  };
  const alrOf = shares => {
    const D = shares.length - 1;
    return Float64Array.from({
      length: D
    }, (_, k) => Math.log(shares[k] / shares[D]));
  };
  function prepare(readings, {
    t0,
    t1,
    minCore = 4,
    parties = PARTIES,
    coreOverride = null,
    trend = false,
    zero = "equal"
  }) {
    const obs = readings.filter(r => r.day > t0 && r.day <= t1).map((r, i) => ({
      ...r,
      idx: r.idx ?? i
    }));
    const cnt = {};
    for (const r of obs) cnt[r.house] = (cnt[r.house] || 0) + 1;
    const isCore = h => coreOverride ? coreOverride.has(h) : cnt[h] >= minCore && !/\(MRP\)$/.test(h);
    const lone = new Set(Object.keys(cnt).filter(h => cnt[h] === 1 && !isCore(h)));
    const houses = [...new Set(obs.map(r => r.house))].filter(h => !lone.has(h));
    const zeroW = zero === "equal" ? null : new Map(houses.map(h => [h, zero === "sqrt" ? Math.sqrt(cnt[h]) : cnt[h]]));
    const L = makeLayout(houses, new Set(houses.filter(isCore)), parties.length, trend, zeroW);
    for (const h of lone) {
      const c = new Float64Array(L.nb);
      c[0] = 1;
      L.coef.set(h, c);
      L.nz.set(h, [0]);
    }
    L.lone = lone;
    return {
      obs,
      L,
      cnt
    };
  }
  window.AP = window.AP || {};
  window.AP.pmEngine = {
    prepare,
    runFilter,
    smooth,
    softmaxAlr,
    alrOf,
    makeLayout,
    PARTIES,
    DEFF
  };
})();
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
      if (!(q.pp || q.p)) continue;
      const mid = q.mid != null ? q.mid : isoMs(q.released);
      rows.push({
        ym: q.ym,
        mid,
        firm: q.pollster,
        n: q.sampleEff != null ? q.sampleEff * spec.deff : Math.min(q.sample || 1200, spec.sampleCap),
        x: q.pp || q.p
      });
    }
    return {
      rows,
      refNow
    };
  }
  window.AP = window.AP || {};
  const pmAgg = (houses, opts) => {
    const D = window.AP.D,
      M = D.primModel,
      E = window.AP.pmEngine,
      DAY0 = 86400000;
    const {
      refNow
    } = rowsFor(houses);
    const sel = houses ? new Set(houses) : null;
    if (!(D.individualPolls || []).some(q => (!sel || sel.has(q.pollster)) && !q.noAgg && q.p)) return {
      months: [],
      now: null,
      refNow,
      nowAt: () => null
    };
    const everyHouse = !sel || D.pvHouses.every(h => sel.has(h));
    if (everyHouse && !(opts && opts.engine)) {
      const now = D.latest.primary ? {
        ...D.latest.primary,
        n: M.obs.filter(o => M.t1 - o[1] >= 0 && M.t1 - o[1] <= M.window).length
      } : null;
      return {
        months: D.aggPrimary.slice(1).map(m => ({
          ...m,
          ci: {
            ...m.ci
          }
        })),
        now,
        refNow,
        nowAt: ref => {
          const d = Math.floor(ref / DAY0);
          return d === M.t1 ? now : d === M.t1 - 30 ? {
            ...M.prev
          } : null;
        }
      };
    }
    const readings = M.obs.filter(o => !sel || sel.has(o[0])).map((o, idx) => ({
      house: o[0],
      day: o[1],
      n: o[2],
      step: o[3],
      cats: o[4],
      vals: o[5],
      idx
    }));
    if (!readings.length) return {
      months: [],
      now: null,
      refNow,
      nowAt: () => null
    };
    const prep = E.prepare(readings, {
      t0: M.t0,
      t1: M.t1,
      minCore: M.minCore,
      trend: true
    });
    const jumps = new Set(M.jumps.filter(d => d > M.t0 && d <= M.t1));
    const events = [...new Set([M.t0, ...prep.obs.map(o => o.day), ...M.months.map(m => m[1]), M.t1, M.t1 - 30, ...jumps])].filter(d => d >= M.t0 && d <= M.t1).sort((a, b) => a - b);
    const th = {
      ...M.th,
      w: Float64Array.from(M.th.w)
    };
    const kappa = new Map(Object.entries(M.kappa));
    const anchor = {
      mean: Float64Array.from(M.anchor.mean),
      cov: Float64Array.from(M.anchor.cov)
    };
    const f = E.runFilter(prep.obs, prep.L, events, th, {
      anchor,
      jumps,
      kappa,
      lone: prep.L.lone,
      store: true
    });
    const sm = E.smooth(f, prep.L, th);
    const N = prep.L.N,
      Dd = prep.L.D,
      ev = new Map(events.map((d, i) => [d, i]));
    const sharesAt = day => {
      const k = ev.get(day);
      if (k == null) return null;
      const eta = sm.xs.subarray(k * N, k * N + Dd),
        p = E.softmaxAlr(eta),
        o = {
          ci: {}
        };
      PK.forEach((key, a) => {
        let v = 0;
        for (let i = 0; i < Dd; i++) for (let j = 0; j < Dd; j++) {
          const ji = p[a] * ((a === i ? 1 : 0) - p[i]),
            jj = p[a] * ((a === j ? 1 : 0) - p[j]);
          v += ji * sm.Ps[k * N * N + i * N + j] * jj;
        }
        o[key] = r1(100 * p[a]);
        o.ci[key] = r1(196 * Math.sqrt(v));
      });
      return o;
    };
    const live = day => readings.filter(r => day - r.day >= 0 && day - r.day <= M.window).length;
    const have = new Set();
    for (const q of D.individualPolls || []) if (!sel || sel.has(q.pollster)) have.add(q.ym);
    const months = M.months.filter(([ym]) => have.has(ym)).map(([ym, day]) => {
      const o = sharesAt(day);
      return {
        ym,
        x: D.mx(ym),
        ...o
      };
    });
    const nowS = live(M.t1) ? sharesAt(M.t1) : null;
    const now = nowS ? {
      ...Object.fromEntries(PK.map(k => [k, nowS[k]])),
      n: live(M.t1)
    } : null;
    const nowAt = ref => {
      const d = Math.floor(ref / DAY0);
      if (d === M.t1) return now;
      if (d === M.t1 - 30 && live(d)) {
        const o = sharesAt(d);
        return Object.fromEntries(PK.map(k => [k, o[k]]));
      }
      return null;
    };
    return {
      months,
      now,
      refNow,
      nowAt
    };
  };
  window.AP.pvAgg = (houses, opts) => {
    if (window.AP.D.primModel && window.AP.pmEngine) return pmAgg(houses, opts);
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
      const p = q.pp || q.p;
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
      const p = q.pp || q.p;
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