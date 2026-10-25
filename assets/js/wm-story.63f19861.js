const GP = {
  R: 120,
  SEAT: 140,
  BAR_W: 34,
  BAR_LEN: 150,
  MAX_PCT: 40,
  SLOTS: [-54, -18, 18, 54],
  SWING_PTS: 12,
  SWING_DEG: 34,
  BAR_SEP: 12,
  LABEL_SEP: 27,
  KICK: 60,
  STOP: 44,
  VB: [-250, -286, 500, 304]
};
const GP_MAST = {
  minH: 50,
  maxH: 105,
  needle: 86,
  needleW: 17,
  bead: 19,
  pivot: 17,
  arcW: 14,
  arcOp: 0.5,
  vb: [0.58, 0.07, 38.39, 26.73],
  cx: 22,
  cy: 24.5
};
const GP_LOOK = {
  needle: 100,
  needleW: 7,
  bead: 11,
  pivot: 12,
  arcW: 11,
  barW: 26
};
const GP_IDS = ["alp", "lnp", "grn", "onp"];
const GR_BOX = {
  x: -470,
  y: -520,
  w: 940,
  h: 660
};
const GP_ABBR = {
  alp: "ALP",
  lnp: "L/NP",
  grn: "GRN",
  onp: "ON"
};
const GP_NAME = {
  alp: "Labor",
  lnp: "Coalition",
  grn: "Greens",
  onp: "One Nation"
};
const GP_SUBJ = {
  alp: "Labor",
  lnp: "The Coalition",
  grn: "The Greens",
  onp: "One Nation"
};
const GP_OBJ = {
  alp: "Labor",
  lnp: "the Coalition",
  grn: "the Greens",
  onp: "One Nation"
};
const GP_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const GP_MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const GP_T = {
  INTRO: 1200,
  REWIND: 1450,
  HOLD: 1000,
  PLAY: 9000,
  OUT: 740
};
const gpClamp = (v, a, b) => v < a ? a : v > b ? b : v;
const gpLerp = (a, b, t) => a + (b - a) * t;
const gpSmooth = t => t * t * (3 - 2 * t);
const gpInvSmooth = e => 0.5 - Math.sin(Math.asin(1 - 2 * gpClamp(e, 0, 1)) / 3);
const gpEaseIO3 = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const gpEaseIO4 = t => t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;
const gpEaseOut3 = t => 1 - Math.pow(1 - t, 3);
function gpBounce(t) {
  const n = 7.5625,
    d = 2.75;
  if (t < 1 / d) return n * t * t;
  if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
  if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
  return n * (t -= 2.625 / d) * t + 0.984375;
}
const gpPolar = (deg, r) => {
  const a = deg * Math.PI / 180;
  return [Math.sin(a) * r, -Math.cos(a) * r];
};
const gpArc = (d1, d2, r) => {
  const [ax, ay] = gpPolar(d1, r),
    [bx, by] = gpPolar(d2, r);
  return `M${ax.toFixed(2)} ${ay.toFixed(2)}A${r} ${r} 0 0 1 ${bx.toFixed(2)} ${by.toFixed(2)}`;
};
const gpDeg = margin => -gpClamp(margin / GP.SWING_PTS, -1, 1) * GP.SWING_DEG;
const gpBarLen = v => Math.max(6, Math.min(1, (v || 0) / GP.MAX_PCT) * GP.BAR_LEN);
function gpSpring(s, target, k, c, dt) {
  let left = dt;
  while (left > 1e-6) {
    const h = Math.min(left, 1 / 240);
    s.v += (-k * (s.x - target) - c * s.v) * h;
    s.x += s.v * h;
    left -= h;
  }
}
const gpRest = (s, target, eps) => Math.abs(s.v) < eps && Math.abs(s.x - target) < eps;
const gpBez = (x0, y0, x1, y1, x2, y2, x3, y3, e) => {
  const q = 1 - e,
    a = q * q * q,
    b = 3 * q * q * e,
    c = 3 * q * e * e,
    d = e * e * e;
  return [a * x0 + b * x1 + c * x2 + d * x3, a * y0 + b * y1 + c * y2 + d * y3];
};
const gpKnock = dev => -GP.KICK * dev;
function gpShotPlan(sx, sy, s, w, g, rnd) {
  const c = {
    s,
    w,
    sx,
    sy,
    dur: 470 + rnd() * 170 - 140 * w,
    r: 0.7 + rnd() * 0.28,
    wide: 0.9 + rnd() * 0.7,
    low: 0.12 + rnd() * 0.5,
    hook: 0.7 + rnd() * 0.6
  };
  const wx = g.px + s * g.L * c.wide,
    wy = g.py + g.L * c.low;
  const dx = wx - sx,
    dy = wy - sy,
    la = Math.hypot(dx, dy) || 1;
  const tx = dx / la,
    ty = dy / la - 1.2,
    tn = Math.hypot(tx, ty);
  c.tx = tx / tn;
  c.ty = ty / tn;
  const lb = Math.hypot(g.px + g.ux * g.L * c.r - wx, g.py + g.uy * g.L * c.r - wy) + g.L * c.hook;
  c.ax = sx + dx * 0.15;
  c.ay = sy + dy * 0.55 - la * 0.1;
  c.h1 = la * 0.32;
  c.h2 = lb * 0.32;
  c.split = la / (la + lb);
  return c;
}
function gpShotAt(c, v, g) {
  const wx = g.px + c.s * g.L * c.wide,
    wy = g.py + g.L * c.low;
  if (v < c.split) {
    return gpBez(c.sx, c.sy, c.ax, c.ay, wx - c.tx * c.h1, wy - c.ty * c.h1, wx, wy, v / c.split);
  }
  const ix = g.px + g.ux * g.L * c.r,
    iy = g.py + g.uy * g.L * c.r,
    D = g.L * c.hook;
  return gpBez(wx, wy, wx + c.tx * c.h2, wy + c.ty * c.h2, ix + c.s * g.nx * D, iy + c.s * g.ny * D, ix, iy, (v - c.split) / (1 - c.split));
}
const gpShotEase = u => 0.5 * (1 - (1 - u) * (1 - u)) + 0.5 * u * u * u * u;
function gpReconcile(A, d) {
  const n = A.length,
    phi = new Array(n).fill(0);
  const flows = ph => A.map((r, i) => r.map((a, j) => i === j ? 0 : a * Math.exp(ph[j] - ph[i])));
  const F = ph => {
    let s = 0;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (i !== j) s += A[i][j] * Math.exp(ph[j] - ph[i]);
    return s - d.reduce((t, v, p) => t + v * ph[p], 0);
  };
  for (let it = 0; it < 60; it++) {
    const G = flows(phi),
      g = d.map((v, p) => G.reduce((t, r, i) => t + r[p] - G[p][i], 0) - v);
    if (Math.max(...g.map(Math.abs)) < 1e-9) break;
    const m = n - 1,
      H = [];
    for (let p = 0; p < m; p++) {
      H.push([]);
      for (let q = 0; q < m; q++) H[p].push(p === q ? G.reduce((t, r, i) => t + (i === p ? 0 : r[p] + G[p][i]), 0) : -(G[p][q] + G[q][p]));
      H[p].push(-g[p]);
    }
    for (let c = 0; c < m; c++) {
      let pv = c;
      for (let r = c + 1; r < m; r++) if (Math.abs(H[r][c]) > Math.abs(H[pv][c])) pv = r;
      [H[c], H[pv]] = [H[pv], H[c]];
      for (let r = 0; r < m; r++) if (r !== c) {
        const f = H[r][c] / H[c][c];
        for (let k = c; k <= m; k++) H[r][k] -= f * H[c][k];
      }
    }
    const step = H.map((r, i) => r[m] / r[i]).concat(0);
    const f0 = F(phi),
      slope = g.reduce((s, v, p) => s + v * step[p], 0);
    let t = 1;
    while (F(phi.map((v, p) => v + t * step[p])) > f0 + 1e-4 * t * slope && t > 1e-9) t /= 2;
    for (let p = 0; p < n; p++) phi[p] += t * step[p];
  }
  return flows(phi);
}
function gpYearX(iso) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return y + (Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 864e5 / 365;
}
function gpDayOf(iso) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return d + " " + GP_MONTHS[m - 1] + " " + y;
}
function gpMonotone(X, Y) {
  const xs = [],
    ys = [];
  X.forEach((x, i) => {
    if (Y[i] != null && isFinite(Y[i])) {
      xs.push(x);
      ys.push(+Y[i]);
    }
  });
  const n = xs.length;
  if (!n) return () => null;
  if (n === 1) return x => x < xs[0] - 1e-9 ? null : ys[0];
  const d = [],
    m = new Array(n);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / d[i],
      b = m[i + 1] / d[i],
      s = a * a + b * b;
    if (s > 9) {
      const k = 3 / Math.sqrt(s);
      m[i] = k * a * d[i];
      m[i + 1] = k * b * d[i];
    }
  }
  return x => {
    if (x < xs[0] - 1e-9) return null;
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let lo = 0,
      hi = n - 1;
    while (hi - lo > 1) {
      const mid = lo + hi >> 1;
      if (xs[mid] <= x) lo = mid;else hi = mid;
    }
    const h = xs[hi] - xs[lo],
      t = (x - xs[lo]) / h,
      t2 = t * t,
      t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[lo] + (t3 - 2 * t2 + t) * h * m[lo] + (-2 * t3 + 3 * t2) * ys[hi] + (t3 - t2) * h * m[hi];
  };
}
function gpSeparate(items, sep) {
  const a = items.map(o => ({
    ...o
  })).sort((x, y) => x.a - y.a);
  for (let pass = 0; pass < 3; pass++) {
    for (let k = 0; k < a.length - 1; k++) {
      const gap = a[k + 1].a - a[k].a;
      if (gap < sep) {
        const push = (sep - gap) / 2;
        a[k].a -= push;
        a[k + 1].a += push;
      }
    }
  }
  return a;
}
function buildDialStory(D) {
  const implied = !!(D.synth2pp && D.synth2pp.length > 1);
  const spine = implied ? D.synth2pp : D.agg2pp;
  const onSrc = (implied ? D.synthOn : D.alt2pp && D.alt2pp.alp_on) || [];
  const onBy = new Map(onSrc.map(p => [p.ym, p]));
  const primBy = new Map((D.aggPrimary || []).map(p => [p.ym, p]));
  const frames = spine.map(m => {
    const on = onBy.get(m.ym),
      pr = primBy.get(m.ym) || {};
    const vals = {};
    GP_IDS.forEach(id => {
      vals[id] = pr[id] == null ? null : +pr[id];
    });
    return {
      ym: m.ym,
      x: m.x,
      election: !!m.election,
      labL: m.alp,
      oppL: m.lnp,
      labO: on ? on.a : null,
      oppO: on ? on.b : null,
      vals
    };
  });
  const n = frames.length;
  const last = frames[n - 1];
  const tl = window.AP && window.AP.tppLatest;
  const L = tl ? tl("alp_lnp", "imp") : null,
    O = tl ? tl("alp_on", "imp") : null;
  if (L && L.b != null) {
    last.labL = L.a;
    last.oppL = L.b;
    last.live = true;
  }
  if (O && O.b != null) {
    last.labO = O.a;
    last.oppO = O.b;
    last.live = true;
  }
  const lp = D.latest && D.latest.primary;
  if (last.live && lp) GP_IDS.forEach(id => {
    if (lp[id] != null) last.vals[id] = +lp[id];
  });
  if (window.JUR) GP_IDS.forEach(id => {
    const first = frames.findIndex((f, i) => i > 0 && f.vals[id] != null);
    if (first > 1 && frames[first].x - frames[0].x > 0.5) for (let i = 1; i < first; i++) {
      frames[i].vals[id] = 0;
      (frames[i].na || (frames[i].na = {}))[id] = true;
    }
  });
  GP_IDS.forEach(id => {
    let prev = null;
    frames.forEach(f => {
      if (f.vals[id] == null) f.vals[id] = prev;else prev = f.vals[id];
    });
    let next = null;
    for (let i = n - 1; i >= 0; i--) {
      if (frames[i].vals[id] == null) frames[i].vals[id] = next;else next = frames[i].vals[id];
    }
  });
  const allPolls = (D.individualPolls || []).filter(p => p.x != null);
  if (last.live) {
    const upd = D.latest && D.latest.updatedISO ? gpYearX(D.latest.updatedISO) : last.x;
    last.x = Math.max(last.x, upd, ...allPolls.map(p => p.x));
  }
  const X = frames.map(f => f.x),
    x0 = X[0],
    x1 = X[n - 1];
  const mk = k => gpMonotone(X, frames.map(f => f[k]));
  const I = {
    labL: mk("labL"),
    oppL: mk("oppL"),
    labO: mk("labO"),
    oppO: mk("oppO")
  };
  const V = {};
  GP_IDS.forEach(id => {
    V[id] = gpMonotone(X, frames.map(f => f.vals[id]));
  });
  const contest = x => {
    const oL = I.oppL(x),
      oO = I.oppO(x);
    return oO != null && oO > oL ? {
      id: "onp",
      lab: I.labO(x),
      opp: oO
    } : {
      id: "lnp",
      lab: I.labL(x),
      opp: oL
    };
  };
  const fOf = x => {
    if (x <= x0) return 0;
    if (x >= x1) return n - 1;
    let lo = 0,
      hi = n - 1;
    while (hi - lo > 1) {
      const mid = lo + hi >> 1;
      if (X[mid] <= x) lo = mid;else hi = mid;
    }
    return lo + (x - X[lo]) / (X[hi] - X[lo]);
  };
  const xOfF = f => {
    const c = gpClamp(f, 0, n - 1),
      k = Math.min(n - 2, Math.floor(c));
    return X[k] + (X[k + 1] - X[k]) * (c - k);
  };
  const EA = 0.22,
    EB = 0.56;
  const at = x => {
    const fi = fOf(x),
      k = Math.max(0, Math.min(n - 2, Math.floor(fi)));
    const e = gpSmooth(gpClamp((fi - k - EA) / EB, 0, 1));
    const A = frames[k],
      B = frames[Math.min(n - 1, k + 1)];
    const L = (a, b) => a == null || b == null ? null : a + (b - a) * e;
    const vals = {};
    GP_IDS.forEach(id => {
      vals[id] = L(A.vals[id], B.vals[id]);
    });
    const oL = L(A.oppL, B.oppL),
      oO = L(A.oppO, B.oppO),
      on = oO != null && oO > oL;
    const lab = on ? L(A.labO, B.labO) : L(A.labL, B.labL),
      opp = on ? oO : oL;
    const order = GP_IDS.slice().sort((a, b) => vals[b] - vals[a]);
    return {
      lab,
      opp,
      oppId: on ? "onp" : "lnp",
      margin: lab - opp,
      deg: gpDeg(lab - opp),
      vals,
      order,
      fe: k + e,
      na: (e < 0.5 ? A.na : B.na) || null
    };
  };
  const SWK = GP_IDS.concat("oth");
  const SW = !window.JUR && D.switchFlows && D.switchFlows.flows ? D.switchFlows : null;
  let flowAt = null;
  if (SW && SWK.every(k => SW.flows[k])) {
    const vec = f => SWK.map(k => k === "oth" ? 100 - GP_IDS.reduce((t, id) => t + f.vals[id], 0) : f.vals[k]);
    const base = vec(frames[0]);
    const P = SWK.map(i => SWK.map(j => i === j ? 0 : +SW.flows[i][j] || 0));
    const gained = d => d.reduce((t, v) => t + Math.max(0, v), 0);
    const scale = gained(SWK.map((_, p) => P.reduce((t, r, i) => t + r[p] - P[p][i], 0)));
    frames.forEach(f => {
      const d = vec(f).map((v, i) => v - base[i]),
        a = gained(d) / scale;
      f.flow = a > 1e-9 ? gpReconcile(P.map((r, i) => r.map((v, j) => i === j ? 0 : a * v + 1e-4)), d) : SWK.map(() => SWK.map(() => 0));
    });
    flowAt = x => {
      const fi = fOf(x),
        k = Math.max(0, Math.min(n - 2, Math.floor(fi)));
      const e = gpSmooth(gpClamp((fi - k - EA) / EB, 0, 1));
      const A = frames[k].flow,
        B = frames[Math.min(n - 1, k + 1)].flow;
      return A.map((r, i) => r.map((v, j) => v + (B[i][j] - v) * e));
    };
  }
  const perMonth = {};
  allPolls.forEach(p => {
    perMonth[p.ym] = (perMonth[p.ym] || 0) + 1;
  });
  const cur = (D.cycles || []).find(c => c.current);
  const electionDay = cur && cur.eDate ? gpDayOf(cur.eDate) : "";
  frames.forEach((f, i) => {
    const c = at(f.x);
    f.lab = c.lab;
    f.opp = c.opp;
    f.oppId = c.oppId;
    const [y, m] = f.ym.split("-").map(Number);
    f.label = f.live && i === n - 1 ? "Now" : GP_MONTHS[m - 1];
    f.year = f.live && i === n - 1 ? "" : String(y);
    const k = perMonth[f.ym] || 0;
    f.sub = f.live && i === n - 1 ? "Latest estimate, to " + (D.latest.updated || "") : f.election ? "Election day, " + electionDay : k === 1 ? "1 poll this month" : k + " polls this month";
  });
  const heldLab = (x, id) => {
    const fi = fOf(x),
      k = Math.max(0, Math.min(n - 2, Math.floor(fi)));
    const e = gpSmooth(gpClamp((fi - k - EA) / EB, 0, 1));
    const A = frames[k],
      B = frames[Math.min(n - 1, k + 1)];
    const a = id === "onp" ? A.labO : A.labL,
      b = id === "onp" ? B.labO : B.labL;
    return a == null || b == null ? at(x).lab : a + (b - a) * e;
  };
  const polls = allPolls.map(p => {
    if (p.x < x0 || p.x > x1 + 1e-6) return null;
    const c = contest(p.x);
    const v = implied ? c.id === "onp" ? p.alpOnImp : p.alpImp : c.id === "onp" ? p.tppAlt ? p.tppAlt.alp : null : p.alpN;
    if (v == null) return null;
    const x = Math.min(p.x, x1);
    return {
      x,
      v: +v,
      opp: c.id,
      house: p.pollster,
      dev: +v - heldLab(x, c.id)
    };
  }).filter(Boolean);
  const ys = polls.map(p => p.v).concat(frames.map(f => f.lab), [50]);
  const lo = Math.floor(Math.min(...ys) - 0.5),
    hi = Math.ceil(Math.max(...ys) + 0.5);
  const samples = [];
  for (let i = 0, SN = 520; i <= SN; i++) {
    const x = x0 + (x1 - x0) * i / SN,
      c = contest(x);
    samples.push({
      x,
      v: c.lab,
      id: c.id
    });
  }
  const beats = [];
  const start = at(x0).order;
  const crossed = {};
  let lead = 0;
  for (let k = 0; k < n - 1; k++) {
    const A = frames[k],
      B = frames[k + 1];
    const xAt = e => X[k] + (EA + EB * gpInvSmooth(e)) * (X[k + 1] - X[k]);
    for (let p = 0; p < 4; p++) for (let q = p + 1; q < 4; q++) {
      const P = GP_IDS[p],
        Q = GP_IDS[q];
      const da = A.vals[P] - A.vals[Q],
        db = B.vals[P] - B.vals[Q];
      if (da > 0 === db > 0) continue;
      const win = db > 0 ? P : Q,
        lose = win === P ? Q : P,
        key = P + Q;
      const c = crossed[key] = (crossed[key] || 0) + 1;
      const wasAhead = start.indexOf(win) < start.indexOf(lose);
      beats.push({
        x: xAt(da / (da - db)),
        kind: "pass",
        a: win,
        b: lose,
        back: wasAhead,
        again: !wasAhead && c > 1,
        level: Math.abs(db) < 1
      });
    }
    if (A.oppO != null && B.oppO != null) {
      const ha = A.oppO - A.oppL,
        hb = B.oppO - B.oppL;
      if (ha > 0 !== hb > 0) {
        const to = hb > 0 ? "onp" : "lnp",
          gap = Math.abs(hb),
          x = xAt(ha / (ha - hb));
        if (to === "onp" && lead === 0) {
          beats.push({
            x,
            kind: "lead",
            a: to,
            first: true,
            level: gap < 1
          });
          lead = gap < 1 ? 2 : 1;
        } else if (gap < 1 && lead === 1) {
          beats.push({
            x,
            kind: "lead",
            a: to,
            level: true
          });
          lead = 2;
        } else if (gap >= 1) beats.push({
          x,
          kind: "lead",
          a: to,
          again: true
        });
      }
    }
  }
  beats.push({
    x: x0,
    kind: "start"
  }, {
    x: x1,
    kind: "end"
  });
  beats.sort((a, b) => a.x - b.x);
  const f0 = frames[0];
  beats.forEach((b, i) => {
    b.id = i;
    Object.assign(b, gpBeatCopy(b, f0, frames[n - 1], electionDay));
  });
  const events = (D.events || []).filter(e => e.major && e.x >= x0 && e.x <= x1).map(e => ({
    x: e.x,
    label: e.label,
    date: gpDayOf(e.date)
  }));
  const tally = allPolls.map(p => Math.min(p.x, x1)).filter(x => x >= x0).sort((a, b) => a - b);
  return {
    frames,
    n,
    X,
    x0,
    x1,
    polls,
    events,
    beats,
    samples,
    lo,
    hi,
    at,
    contest,
    fOf,
    xOfF,
    EA,
    EB,
    implied,
    VB: GP.VB,
    tally,
    total: tally.length,
    flowAt,
    swKeys: SWK
  };
}
function gpBeatCopy(b, f0, fN, electionDay) {
  if (b.kind === "pass") {
    const verb = b.back ? b.level ? " edges back ahead of " : " moves back ahead of " : b.level ? " draws level with " : " passes ";
    const title = [{
      t: GP_SUBJ[b.a],
      p: b.a
    }, {
      t: verb
    }, {
      t: GP_OBJ[b.b],
      p: b.b
    }, {
      t: b.again ? " again" : ""
    }];
    return {
      title,
      sub: "First preferences",
      story: true
    };
  }
  if (b.kind === "lead") {
    const other = b.a === "onp" ? "lnp" : "onp";
    const title = b.first ? [{
      t: "One Nation",
      p: "onp"
    }, {
      t: " now runs "
    }, {
      t: "Labor",
      p: "alp"
    }, {
      t: b.level ? " about as close as " : " closer than "
    }, {
      t: "the Coalition",
      p: "lnp"
    }, {
      t: " does"
    }] : b.level ? [{
      t: GP_SUBJ[b.a],
      p: b.a
    }, {
      t: " draws level with "
    }, {
      t: GP_OBJ[other],
      p: other
    }] : [{
      t: GP_SUBJ[b.a],
      p: b.a
    }, {
      t: " runs "
    }, {
      t: "Labor",
      p: "alp"
    }, {
      t: " closer again"
    }];
    return {
      title,
      sub: b.level && !b.first ? "Two-party preferred, each against Labor" : "Two-party preferred",
      story: true
    };
  }
  if (b.kind === "start") {
    return {
      title: [{
        t: "Election day"
      }],
      sub: electionDay
    };
  }
  const m0 = f0.lab - f0.opp,
    m1 = fN.lab - fN.opp;
  const title = m1 > 0 ? [{
    t: "Labor’s",
    p: "alp"
  }, {
    t: " lead: " + m0.toFixed(1) + " points at the election, " + m1.toFixed(1) + " now"
  }] : m1 < 0 ? [{
    t: "Labor",
    p: "alp"
  }, {
    t: " led by " + m0.toFixed(1) + " points at the election and trails by " + (-m1).toFixed(1) + " now"
  }] : [{
    t: "Labor",
    p: "alp"
  }, {
    t: " led by " + m0.toFixed(1) + " points at the election and is level now"
  }];
  return {
    title,
    sub: "Over its closest challenger, two-party preferred"
  };
}
function gpPalette(host) {
  const probe = document.createElement("i");
  probe.style.display = "none";
  host.appendChild(probe);
  const c = document.createElement("canvas");
  c.width = c.height = 1;
  const g = c.getContext("2d", {
    willReadFrequently: true
  });
  const P = {};
  ["alp", "lnp", "grn", "onp", "oth", "ink", "ink-2", "ink-3", "ink-faint", "line", "surface", "bg"].forEach(k => {
    probe.style.color = "var(--" + k + ")";
    g.clearRect(0, 0, 1, 1);
    g.fillStyle = "#000";
    g.fillStyle = getComputedStyle(probe).color;
    g.fillRect(0, 0, 1, 1);
    const d = g.getImageData(0, 0, 1, 1).data;
    P[k] = [d[0], d[1], d[2]];
  });
  host.removeChild(probe);
  return P;
}
const gpRgba = (c, a) => "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + (a == null ? 1 : +a.toFixed(3)) + ")";
function gpEngine(M, N, cb, opt) {
  const reduce = !!opt.reduce;
  const F = M.frames,
    n = M.n,
    X = M.X,
    x0 = M.x0,
    x1 = M.x1,
    span = x1 - x0;
  const T0 = performance.now();
  const glyph = document.querySelector("button.wm-glyph .wm-dial");
  const fly = !reduce && !!opt.origin && !!glyph;
  let raf = 0,
    last = T0,
    dead = false,
    finished = false;
  const G = {
    k: 1,
    fxk: 1,
    pivX: 0,
    pivY: 0,
    left: 0,
    top: 0,
    lb: {},
    tips: {},
    tl: null,
    dpr: 1,
    pal: null,
    tint: 0.2,
    narrow: false,
    mast: null,
    fxDirty: false,
    lineH: 40,
    cache: new WeakMap()
  };
  const tg0 = M.at(x1);
  const S = {
    x: x1,
    prevX: x1,
    mode: reduce || !fly ? "pause" : "intro",
    modeT: T0,
    fl: {
      x: fly ? 0 : 1,
      v: 0
    },
    shape: fly ? 0 : 1,
    needle: {
      x: tg0.deg,
      v: 0
    },
    bead: {
      x: 0,
      v: 0
    },
    bars: {},
    order: tg0.order.slice(),
    nd: tg0.deg,
    flex: {
      x: 0,
      v: 0
    },
    shX: {
      x: 0,
      v: 0
    },
    shY: {
      x: 0,
      v: 0
    },
    arcBase: tg0.oppId,
    flood: null,
    shocks: [],
    comets: [],
    sparks: [],
    debris: [],
    rings: [],
    trail: [],
    grains: [],
    mass: null,
    fLast: M.flowAt ? M.flowAt(x1) : null,
    pend: M.swKeys.map(() => M.swKeys.map(() => 0)),
    dots: M.polls.map(() => ({
      s: 2,
      t: 1,
      c: false,
      hit: true
    })),
    idx: -1,
    fe: n - 1,
    blur: 0,
    beat: null,
    beatQ: [],
    beatT: -1e9,
    ev: -2,
    drag: null,
    glide: null,
    coast: null,
    shimmer: -1,
    out: null,
    revealed: !fly,
    count: -1,
    reelDirect: false,
    wheelAcc: 0,
    lastFx: 0,
    stepT: 0
  };
  tg0.order.forEach((id, slot) => {
    S.bars[id] = {
      a: {
        x: GP.SLOTS[slot],
        v: 0
      },
      l: {
        x: gpBarLen(tg0.vals[id]),
        v: 0
      }
    };
  });
  const css = (el, prop, val) => {
    let c = G.cache.get(el);
    if (!c) {
      c = {};
      G.cache.set(el, c);
    }
    if (c[prop] === val) return;
    c[prop] = val;
    el.style[prop] = val;
  };
  const att = (el, name, val) => {
    let c = G.cache.get(el);
    if (!c) {
      c = {};
      G.cache.set(el, c);
    }
    const k = "@" + name;
    if (c[k] === val) return;
    c[k] = val;
    el.setAttribute(name, val);
  };
  const xPx = x => G.tl.pl + (x - x0) / span * G.tl.pw;
  const yPx = v => G.tl.pt + (M.hi - v) / (M.hi - M.lo) * G.tl.ph;
  const pxX = px => x0 + (px - G.tl.pl) / G.tl.pw * span;
  function mastFrom(r) {
    const k = r.width / GP_MAST.vb[2];
    return {
      x: r.left + (GP_MAST.cx - GP_MAST.vb[0]) * k,
      y: r.top + (GP_MAST.cy - GP_MAST.vb[1]) * k,
      k
    };
  }
  function measure() {
    const r = N.dbox.getBoundingClientRect();
    G.left = r.left;
    G.top = r.top;
    G.k = r.width / M.VB[2];
    G.fxk = gpClamp(G.k, 0.6, 1.12);
    G.pivX = -M.VB[0] * G.k;
    G.pivY = -M.VB[1] * G.k;
    N.flier.style.transformOrigin = G.pivX.toFixed(2) + "px " + G.pivY.toFixed(2) + "px";
    GP_IDS.forEach(id => {
      const el = N.bl[id];
      G.lb[id] = {
        w: el.offsetWidth,
        h: el.offsetHeight
      };
    });
    G.narrow = window.innerWidth < 700;
    G.lineH = N.reel.firstChild ? N.reel.firstChild.getBoundingClientRect().height || 40 : 40;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    G.dpr = dpr;
    const tr = N.time.getBoundingClientRect();
    const tl = {
      left: tr.left,
      top: tr.top,
      w: tr.width,
      h: tr.height
    };
    tl.pl = G.narrow ? 24 : 30;
    tl.pr = G.narrow ? 4 : 8;
    tl.pt = 24;
    tl.pb = G.narrow ? 20 : 24;
    tl.pw = Math.max(10, tl.w - tl.pl - tl.pr);
    tl.ph = Math.max(10, tl.h - tl.pt - tl.pb);
    G.tl = tl;
    N.tl.width = Math.max(1, Math.round(tl.w * dpr));
    N.tl.height = Math.max(1, Math.round(tl.h * dpr));
    G.tlx = N.tl.getContext("2d");
    G.fw = window.innerWidth;
    G.fh = window.innerHeight;
    N.fx.width = Math.round(G.fw * dpr);
    N.fx.height = Math.round(G.fh * dpr);
    G.fxx = N.fx.getContext("2d");
    if (N.gr) {
      const gw = GR_BOX.w * G.k,
        gh = GR_BOX.h * G.k;
      G.gr = {
        ox: -GR_BOX.x * G.k,
        oy: -GR_BOX.y * G.k,
        w: gw,
        h: gh,
        dirty: true
      };
      Object.assign(N.gr.style, {
        left: (G.pivX - G.gr.ox).toFixed(1) + "px",
        top: (G.pivY - G.gr.oy).toFixed(1) + "px",
        width: gw.toFixed(1) + "px",
        height: gh.toFixed(1) + "px"
      });
      N.gr.width = Math.max(1, Math.round(gw * dpr));
      N.gr.height = Math.max(1, Math.round(gh * dpr));
      G.grx = N.gr.getContext("2d");
    }
    G.trace = M.samples.map(s => ({
      px: xPx(s.x),
      py: yPx(s.v),
      id: s.id,
      x: s.x
    }));
    G.dotsPx = M.polls.map(p => ({
      px: xPx(p.x),
      py: yPx(p.v)
    }));
    if (glyph) G.mast = mastFrom(opt.origin && !G.mast ? opt.origin : glyph.getBoundingClientRect());
    S.ev = -2;
    buildStatic();
  }
  function readTheme() {
    G.pal = gpPalette(N.root);
    G.tint = parseFloat(getComputedStyle(N.root).getPropertyValue("--gp-tint")) || 0.2;
  }
  function buildStatic() {
    const tl = G.tl,
      dpr = G.dpr,
      P = G.pal;
    const c = G.stat || (G.stat = document.createElement("canvas"));
    c.width = N.tl.width;
    c.height = N.tl.height;
    const g = c.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, tl.w, tl.h);
    const font = (w, px) => w + " " + px + 'px "IBM Plex Sans", system-ui, sans-serif';
    g.font = font(500, G.narrow ? 9.5 : 10.5);
    g.textBaseline = "middle";
    g.textAlign = "right";
    for (let v = Math.ceil(M.lo / 5) * 5; v <= M.hi; v += 5) {
      const y = Math.round(yPx(v)) + 0.5;
      g.lineWidth = 1;
      if (v === 50) {
        g.strokeStyle = gpRgba(P["ink-3"], 0.6);
        g.setLineDash([3, 4]);
      } else {
        g.strokeStyle = gpRgba(P.line, 1);
        g.setLineDash([]);
      }
      g.beginPath();
      g.moveTo(tl.pl, y);
      g.lineTo(tl.pl + tl.pw, y);
      g.stroke();
      g.fillStyle = gpRgba(P["ink-3"], 1);
      g.fillText(String(v), tl.pl - 7, y);
    }
    g.setLineDash([]);
    const ticks = [];
    let [yy, mm] = F[0].ym.split("-").map(Number);
    for (;;) {
      mm++;
      if (mm > 12) {
        mm = 1;
        yy++;
      }
      const x = gpYearX(yy + "-" + String(mm).padStart(2, "0") + "-01");
      if (x > x1) break;
      ticks.push({
        x,
        y: yy,
        m: mm - 1
      });
    }
    const gap = tl.pw / Math.max(1, ticks.length);
    const every = gap < 26 ? 3 : gap < 40 ? 2 : 1;
    g.textAlign = "center";
    g.textBaseline = "alphabetic";
    ticks.forEach(tk => {
      const x = Math.round(xPx(tk.x)) + 0.5,
        yb = tl.pt + tl.ph;
      g.strokeStyle = gpRgba(P["ink-faint"], 0.8);
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(x, yb + 1);
      g.lineTo(x, yb + (tk.m === 0 ? 7 : 4));
      g.stroke();
      if (tk.m % every !== 0) return;
      g.font = font(tk.m === 0 ? 600 : 500, G.narrow ? 9.5 : 10.5);
      g.fillStyle = gpRgba(tk.m === 0 ? P["ink-2"] : P["ink-3"], 1);
      g.fillText(tk.m === 0 ? String(tk.y) : GP_MON[tk.m], x, yb + (G.narrow ? 15 : 17));
    });
    M.events.forEach(e => {
      const x = Math.round(xPx(e.x)) + 0.5;
      g.strokeStyle = gpRgba(P["ink-faint"], 0.75);
      g.lineWidth = 1;
      g.setLineDash([2, 3]);
      g.beginPath();
      g.moveTo(x, tl.pt - 7);
      g.lineTo(x, tl.pt + tl.ph);
      g.stroke();
      g.setLineDash([]);
      g.fillStyle = gpRgba(P["ink-3"], 1);
      g.beginPath();
      g.arc(x, tl.pt - 9, 2.3, 0, 6.2832);
      g.fill();
    });
    g.strokeStyle = gpRgba(P["ink-faint"], 0.5);
    g.lineWidth = 1.4;
    g.lineJoin = "round";
    g.beginPath();
    G.trace.forEach((s, i) => i ? g.lineTo(s.px, s.py) : g.moveTo(s.px, s.py));
    g.stroke();
  }
  function setMode(m, t) {
    S.mode = m;
    S.modeT = t;
    N.root.classList.toggle("gp-rw", m === "rewind");
    const running = m === "play" || m === "rewind" || m === "hold" || m === "intro";
    N.root.classList.toggle("gp-run", running);
    cb.onPlaying(running);
  }
  const fiNow = () => M.fOf(S.x);
  function glideTo(x, t) {
    S.coast = null;
    if (reduce) {
      S.x = gpClamp(x, x0, x1);
      S.glide = null;
      S.reelDirect = false;
      setMode("pause", t);
      announce();
      return;
    }
    S.glide = {
      x: S.x,
      v: S.glide && S.mode === "glide" ? S.glide.v : 0,
      to: gpClamp(x, x0, x1)
    };
    setMode("glide", t);
  }
  function nearestX(x) {
    return X[Math.round(M.fOf(x))];
  }
  function rewind(t) {
    S.rw = {
      from: S.x,
      dur: GP_T.REWIND * gpClamp((S.x - x0) / span, 0.3, 1)
    };
    S.beatQ = [];
    showBeat(null, t);
    setMode("rewind", t);
  }
  function physics(tg, dt, t) {
    const live = S.mode !== "intro" && !S.out;
    if (reduce) {
      S.needle.x = tg.deg;
      S.needle.v = 0;
      tg.order.forEach((id, slot) => {
        const b = S.bars[id];
        b.a.x = GP.SLOTS[slot];
        b.l.x = gpBarLen(tg.vals[id]);
        b.a.v = b.l.v = 0;
      });
    } else {
      gpSpring(S.needle, tg.deg, 200, 13, dt);
      if (Math.abs(S.needle.x) > GP.STOP) {
        S.needle.x = Math.sign(S.needle.x) * GP.STOP;
        if (S.needle.v * S.needle.x > 0) S.needle.v *= -0.45;
      }
      tg.order.forEach((id, slot) => {
        const b = S.bars[id];
        gpSpring(b.a, GP.SLOTS[slot], 150, 17.5, dt);
        gpSpring(b.l, gpBarLen(S.mass ? S.mass[id] : tg.vals[id]), 240, 17, dt);
      });
      gpSpring(S.bead, 0, 320, 17, dt);
      gpSpring(S.flex, 0, 1800, 20, dt);
      gpSpring(S.shX, 0, 650, 21, dt);
      gpSpring(S.shY, 0, 650, 21, dt);
    }
    const ord = tg.order.join();
    if (ord !== S.order.join()) {
      if (live && !reduce && S.mode !== "rewind") {
        for (let i = 0; i < 4; i++) if (tg.order[i] !== S.order[i]) {
          overtakeFx(tg.order[i], t);
          break;
        }
      }
      S.order = tg.order.slice();
    }
    if (S.flood) {
      S.flood.dir = tg.oppId === S.flood.to ? 1 : -1;
      S.flood.u += S.flood.dir * dt / (reduce ? 0.001 : 0.6);
      if (S.flood.u >= 1) {
        S.arcBase = S.flood.to;
        S.flood = null;
      } else if (S.flood.u <= 0) S.flood = null;
    } else if (tg.oppId !== S.arcBase) {
      S.flood = {
        to: tg.oppId,
        u: 0,
        dir: 1
      };
      const named = M.beats.some(b => b.kind === "lead" && Math.abs(b.x - S.x) < 0.06);
      if (live && named && !reduce && S.mode !== "rewind") {
        shock(tg.oppId, t, 0.9);
        const [ax, ay] = gpPolar(45, GP.R);
        burst(G.left + G.pivX + ax * G.k, G.top + G.pivY + ay * G.k, tg.oppId, 16, 260);
        thump(1);
      }
    }
  }
  function overtakeFx(id, t) {
    if (t - (S.lastOver || 0) < 220) return;
    S.lastOver = t;
    const b = G.tips[id];
    if (!b) return;
    const [tx, ty] = gpPolar(b.a, b.r);
    burst(G.left + G.pivX + tx * G.k, G.top + G.pivY + ty * G.k, id, 18, 300);
    shock(id, t, 0.6);
    thump(0.7);
  }
  function thump(k) {
    S.shY.v += 150 * k;
    S.shX.v += (Math.random() - 0.5) * 120 * k;
  }
  function shock(color, t, k) {
    S.shocks.push({
      t0: t,
      color,
      k: k || 1
    });
    if (S.shocks.length > N.shk.length) S.shocks.shift();
  }
  function burst(x, y, color, count, speed) {
    if (S.sparks.length > 320) return;
    const k = G.fxk;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2,
        sp = speed * k * (0.35 + Math.random() * 0.9);
      S.sparks.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - speed * k * 0.25,
        age: 0,
        max: 0.5 + Math.random() * 0.55,
        col: color,
        w: (1.1 + Math.random() * 1.5) * Math.max(0.75, k)
      });
    }
  }
  function spray(x, y, dx, dy, color, count, speed) {
    if (S.sparks.length > 420) return;
    const base = Math.atan2(dy, dx),
      k = G.fxk;
    for (let i = 0; i < count; i++) {
      const a = base + (Math.random() - 0.5) * 2.3,
        sp = speed * k * (0.4 + Math.random() * 0.85);
      S.sparks.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        age: 0,
        max: 0.24 + Math.random() * 0.4,
        col: color,
        w: (1.1 + Math.random() * 1.5) * Math.max(0.75, k)
      });
    }
  }
  function updDots(dt, t) {
    const fwd = S.x >= S.prevX;
    const feed = !reduce && (S.mode === "play" || (S.mode === "drag" || S.mode === "coast") && fwd);
    for (let i = 0; i < M.polls.length; i++) {
      const d = S.dots[i],
        want = S.x >= M.polls[i].x - 1e-9;
      if (want && (d.s === 0 || d.s === 3)) {
        d.s = 1;
        d.t = reduce ? 1 : 0;
        d.c = feed;
        d.hit = false;
      } else if (!want && (d.s === 1 || d.s === 2)) {
        d.s = reduce ? 0 : 3;
        d.t = 0;
      }
      if (d.s === 1) {
        d.t = Math.min(1, d.t + dt / 0.5);
        if (!d.hit && d.t >= 0.36) {
          d.hit = true;
          if (d.c) comet(i, t);
        }
        if (d.t >= 1) d.s = 2;
      } else if (d.s === 3) {
        d.t += dt / 0.26;
        if (d.t >= 1) {
          d.s = 0;
          d.t = 0;
        }
      }
    }
    let count = 0;
    while (count < M.tally.length && M.tally[count] <= S.x + 1e-9) count++;
    if (count !== S.count) {
      S.count = count;
      N.count.textContent = count >= M.total ? M.total + " polls" : count + " of " + M.total + " polls";
    }
  }
  function comet(i, t) {
    if (S.comets.length > 64 || !G.dotsPx) return;
    const q = G.dotsPx[i],
      p = M.polls[i];
    const sx = G.tl.left + q.px,
      sy = G.tl.top + q.py,
      w = gpClamp(Math.abs(p.dev) / 3, 0, 1);
    const c = gpShotPlan(sx, sy, p.dev >= 0 ? 1 : -1, w, needleGeom(), Math.random);
    c.t0 = t;
    c.dev = p.dev;
    c.col = p.v >= 50 ? "alp" : p.opp;
    S.comets.push(c);
    S.rings.push({
      x: sx,
      y: sy,
      t0: t,
      col: c.col,
      k: 0.35 + 0.4 * w,
      dur: 320
    });
  }
  const needleLen = () => gpLerp(GP_MAST.needle, GP_LOOK.needle, S.shape);
  function needleGeom() {
    const a = S.nd * Math.PI / 180;
    return {
      px: G.left + G.pivX + S.shX.x,
      py: G.top + G.pivY + S.shY.x,
      L: needleLen() * G.k,
      ux: Math.sin(a),
      uy: -Math.cos(a),
      nx: Math.cos(a),
      ny: Math.sin(a)
    };
  }
  function beadPage() {
    const g = needleGeom();
    return {
      x: g.px + g.ux * g.L,
      y: g.py + g.uy * g.L
    };
  }
  function updFx(dt, t) {
    let g = null;
    for (let i = S.comets.length - 1; i >= 0; i--) {
      const c = S.comets[i];
      if (t - c.t0 < c.dur) continue;
      g = g || needleGeom();
      const [hx, hy] = gpShotAt(c, 1, g),
        fx = -c.s * g.nx,
        fy = -c.s * g.ny;
      S.needle.v += gpKnock(c.dev);
      S.flex.v += c.s * (50 + 170 * c.w);
      S.bead.v += 2 + 5 * c.w;
      if (c.w > 0.4) {
        const k = (40 + 160 * (c.w - 0.4) / 0.6) * G.fxk;
        S.shX.v += fx * k;
        S.shY.v += fy * k;
      }
      spray(hx, hy, fx, fy, c.col, 4 + Math.round(12 * c.w), 260 + 380 * c.w);
      S.rings.push({
        x: hx,
        y: hy,
        t0: t,
        col: c.col,
        k: 0.6 + 0.9 * c.w,
        dur: 300
      }, {
        x: hx,
        y: hy,
        t0: t,
        col: c.col,
        k: c.w,
        dur: 150,
        fill: true
      });
      const bounce = (60 + 110 * Math.random()) * G.fxk;
      S.debris.push({
        x: hx,
        y: hy,
        vx: -fx * bounce,
        vy: -fy * bounce - (90 + 150 * Math.random()) * G.fxk,
        age: 0,
        max: 0.55 + 0.35 * Math.random(),
        col: c.col,
        r: (2 + 1.4 * c.w) * G.fxk
      });
      S.comets.splice(i, 1);
    }
    for (let i = S.debris.length - 1; i >= 0; i--) {
      const d = S.debris[i];
      d.age += dt;
      if (d.age >= d.max) {
        S.debris.splice(i, 1);
        continue;
      }
      d.vx *= Math.exp(-1.2 * dt);
      d.vy += 1500 * G.fxk * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
    }
    const drag = Math.exp(-3.2 * dt);
    for (let i = S.sparks.length - 1; i >= 0; i--) {
      const s = S.sparks[i];
      s.age += dt;
      if (s.age >= s.max) {
        S.sparks.splice(i, 1);
        continue;
      }
      s.vx *= drag;
      s.vy = s.vy * drag + 340 * G.fxk * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
    }
    for (let i = S.rings.length - 1; i >= 0; i--) if (t - S.rings[i].t0 > S.rings[i].dur) S.rings.splice(i, 1);
    for (let i = S.shocks.length - 1; i >= 0; i--) if (t - S.shocks[i].t0 > 1000) S.shocks.splice(i, 1);
  }
  const grainMass = () => {
    const r = 2.4 * Math.max(0.78, G.fxk) / G.k;
    return Math.PI * r * r / (GP_LOOK.barW * GP.BAR_LEN / GP.MAX_PCT);
  };
  function grain(from, to, m, t) {
    if (S.grains.length > 480) return;
    S.grains.push({
      from,
      to,
      m,
      t0: t,
      dur: 560 + Math.random() * 200,
      o1: Math.random() - 0.5,
      o2: Math.random() - 0.5,
      h: 0.9 + Math.random() * 0.2,
      side: Math.random() < 0.5 ? -1 : 1,
      jit: Math.random()
    });
  }
  function updGrains(tg, dt, t) {
    S.mass = null;
    if (!M.flowAt) return;
    const E = M.flowAt(S.x),
      K = M.swKeys,
      nk = K.length;
    for (let i = 0; i < nk; i++) for (let j = 0; j < nk; j++) if (i !== j) S.pend[i][j] += E[i][j] - S.fLast[i][j];
    S.fLast = E;
    if (reduce || S.out || S.shape < 1) {
      S.pend.forEach(r => r.fill(0));
      S.grains = [];
      return;
    }
    const q = grainMass(),
      still = S.x === S.prevX;
    for (let i = 0; i < nk; i++) for (let j = 0; j < nk; j++) {
      if (i === j) continue;
      let p = S.pend[i][j];
      const big = Math.max(q, Math.abs(p) / 4);
      while (p >= big - 1e-12 || still && p > 1e-9) {
        const m = Math.min(p, big);
        grain(i, j, m, t);
        p -= m;
      }
      while (p <= -big + 1e-12 || still && p < -1e-9) {
        const m = Math.min(-p, big);
        grain(j, i, m, t);
        p += m;
      }
      S.pend[i][j] = p;
    }
    for (let k = S.grains.length - 1; k >= 0; k--) {
      const g = S.grains[k];
      if (t - g.t0 < g.dur) continue;
      S.grains.splice(k, 1);
      const b = S.bars[K[g.to]];
      if (b) b.l.v += 30 * Math.sqrt(g.m / q);
    }
    const mass = {};
    GP_IDS.forEach((id, p) => {
      let v = tg.vals[id];
      for (let j = 0; j < nk; j++) v += S.pend[p][j] - S.pend[j][p];
      mass[id] = v;
    });
    for (const g of S.grains) if (g.to < GP_IDS.length) mass[K[g.to]] -= g.m;
    S.mass = mass;
  }
  function showBeat(b, t) {
    if (S.beat === b) return;
    S.beat = b;
    if (b) S.beatT = t;
    cb.onBeat(b);
  }
  function updBeats(t) {
    if (S.mode === "play") {
      M.beats.forEach(b => {
        if (b.story && b.x > S.prevX && b.x <= S.x) S.beatQ.push(b);
      });
      if (S.beatQ.length && t - S.beatT > 1150) {
        while (S.beatQ.length > 1 && S.beatQ[0].x < S.x - 0.1) S.beatQ.shift();
        showBeat(S.beatQ.shift(), t);
      } else if (!S.beatQ.length && S.beat && S.beat.kind !== "end" && t - S.beatT > 2800) showBeat(null, t);
    } else if (S.mode === "drag" || S.mode === "coast" || S.mode === "glide" || S.mode === "pause" && S.userMoved) {
      let pick = null;
      M.beats.forEach(b => {
        if (b.x <= S.x + 1e-6 && S.x - b.x < 0.085) pick = b;
      });
      showBeat(pick, t);
    }
  }
  function speedAt(x, t) {
    let slow = 0;
    for (const b of M.beats) {
      if (!b.story) continue;
      const z = (x - b.x) / 0.02;
      if (z > -3 && z < 3) slow = Math.max(slow, Math.exp(-z * z));
    }
    let f = 1 - 0.5 * slow;
    const fresh = gpClamp((t - S.beatT) / 1300, 0, 1);
    if (S.beat && S.beat.story) f *= 0.45 + 0.55 * gpSmooth(fresh);
    if (S.beatQ.length) f *= 0.3;
    return span / (GP_T.PLAY / 1000) * f;
  }
  function advance(dt, t) {
    S.prevX = S.x;
    switch (S.mode) {
      case "intro":
        if (t - T0 > GP_T.INTRO) rewind(t);
        break;
      case "rewind":
        {
          const u = Math.min(1, (t - S.modeT) / S.rw.dur);
          S.x = S.rw.from + (x0 - S.rw.from) * gpEaseIO4(u);
          if (u >= 1) {
            S.x = x0;
            setMode("hold", t);
            showBeat(M.beats.find(b => b.kind === "start"), t);
            shock("alp", t, 1);
          }
          break;
        }
      case "hold":
        if (t - S.modeT > GP_T.HOLD) setMode("play", t);
        break;
      case "play":
        if (reduce) {
          if (t - S.stepT > 1100) {
            S.stepT = t;
            const i = Math.round(fiNow()) + 1;
            S.x = X[Math.min(n - 1, i)];
          }
        } else S.x = Math.min(x1, S.x + speedAt(S.x, t) * dt);
        if (S.x >= x1 - 1e-9) {
          S.x = x1;
          land(t);
        }
        break;
      case "coast":
        S.x += S.coast.v * dt;
        S.coast.v *= Math.exp(-3.4 * dt);
        if (S.x <= x0 || S.x >= x1) {
          S.x = gpClamp(S.x, x0, x1);
          S.coast.v = 0;
        }
        if (Math.abs(S.coast.v) < span * 0.05) glideTo(nearestX(S.x), t);
        break;
      case "glide":
        gpSpring(S.glide, S.glide.to, 95, 19, dt);
        S.x = gpClamp(S.glide.x, x0, x1);
        if (gpRest(S.glide, S.glide.to, span * 1e-4)) {
          S.x = S.glide.to;
          S.reelDirect = false;
          setMode("pause", t);
          announce();
        }
        break;
      case "outro":
        {
          const e = t - S.out.t0;
          gpSpring(S.glide, x1, 170, 26, dt);
          S.x = gpClamp(S.glide.x, x0, x1);
          S.shape = S.out.sh0 * (1 - gpEaseIO3(gpClamp((e - 150) / 380, 0, 1)));
          S.fl.x = S.out.fl0 * (1 - gpEaseIO3(gpClamp((e - 120) / 560, 0, 1)));
          if (e > GP_T.OUT) finish();
          break;
        }
      default:
        break;
    }
  }
  function land(t) {
    setMode("pause", t);
    S.ended = true;
    N.root.classList.add("gp-end");
    const tg = M.at(x1);
    S.beatQ = [];
    showBeat(M.beats.find(b => b.kind === "end"), t);
    if (!reduce) {
      shock(tg.margin >= 0 ? "alp" : tg.oppId, t, 1.3);
      const bp = beadPage();
      burst(bp.x, bp.y, tg.margin >= 0 ? "alp" : tg.oppId, 30, 380);
      thump(1.4);
      S.shimmer = t;
    }
    announce();
  }
  function flight(t, dt) {
    if (S.out) return;
    if (S.fl.x !== 1 || S.fl.v !== 0) {
      gpSpring(S.fl, 1, 72, 12.5, dt);
      if (gpRest(S.fl, 1, 2e-4)) {
        S.fl.x = 1;
        S.fl.v = 0;
      }
    }
    if (S.shape < 1) S.shape = gpEaseIO3(gpClamp((t - T0 - 240) / 640, 0, 1));
    if (!S.revealed && t - T0 > 380) {
      S.revealed = true;
      N.root.classList.add("gp-in");
    }
  }
  function flierTransform() {
    const p = S.fl.x;
    if (!G.mast || p === 1) {
      const x = S.shX.x,
        y = S.shY.x;
      return Math.abs(x) < 0.05 && Math.abs(y) < 0.05 ? "none" : "translate(" + x.toFixed(2) + "px," + y.toFixed(2) + "px)";
    }
    const sx = G.left + G.pivX,
      sy = G.top + G.pivY;
    const dx = G.mast.x - sx,
      dy = G.mast.y - sy;
    const s0 = G.mast.k / 10 / G.k,
      q = 1 - p;
    const cx = dx * 0.92,
      cy = dy * 0.1;
    const tx = q * q * dx + 2 * q * p * cx,
      ty = q * q * dy + 2 * q * p * cy;
    return "translate(" + tx.toFixed(2) + "px," + ty.toFixed(2) + "px) scale(" + (s0 + (1 - s0) * p).toFixed(5) + ")";
  }
  function mastLens(vals) {
    const vs = GP_IDS.map(id => vals[id]),
      lo = Math.min(...vs),
      hi = Math.max(...vs),
      out = {};
    GP_IDS.forEach(id => {
      out[id] = hi === lo ? GP_MAST.maxH : GP_MAST.minH + (vals[id] - lo) / (hi - lo) * (GP_MAST.maxH - GP_MAST.minH);
    });
    return out;
  }
  function paintDial(tg, t) {
    const s = S.shape,
      lead = tg.margin >= 0 ? "alp" : tg.oppId;
    css(N.flier, "transform", flierTransform());
    css(N.arc, "opacity", gpLerp(GP_MAST.arcOp, G.tint, s).toFixed(3));
    css(N.arc, "strokeWidth", gpLerp(GP_MAST.arcW, GP_LOOK.arcW, s).toFixed(2));
    css(N.arcB, "stroke", "var(--" + S.arcBase + ")");
    if (S.flood) {
      css(N.arcF, "stroke", "var(--" + S.flood.to + ")");
      css(N.arcF, "strokeDasharray", (gpEaseIO3(gpClamp(S.flood.u, 0, 1)) * 100).toFixed(2) + " 100");
      css(N.arcF, "opacity", "1");
    } else css(N.arcF, "opacity", "0");
    const sIn = gpClamp((s - 0.35) / 0.65, 0, 1);
    css(N.scale, "opacity", sIn.toFixed(3));
    const nd = S.nd;
    const merc = Math.abs(nd) > 0.4 ? gpArc(Math.min(0, nd), Math.max(0, nd), GP.R) : "M0 0";
    att(N.merc, "d", merc);
    css(N.merc, "stroke", "var(--" + lead + ")");
    css(N.merc, "strokeWidth", gpLerp(GP_MAST.arcW, GP_LOOK.arcW, s).toFixed(2));
    css(N.merc, "opacity", sIn.toFixed(3));
    const ghostOn = S.mode !== "intro" && !S.out && S.x > x0 + span * 0.01 ? 1 : 0;
    att(N.ghost, "transform", "rotate(" + M.at(x0).deg.toFixed(2) + ")");
    css(N.ghost, "opacity", (ghostOn * sIn * 0.75).toFixed(3));
    const ml = s < 1 ? mastLens(tg.vals) : null;
    const slotOf = {};
    tg.order.forEach((id, k) => {
      slotOf[id] = GP.SLOTS[k];
    });
    const ring = gpSeparate(GP_IDS.map(id => ({
      id,
      a: gpLerp(slotOf[id], S.bars[id].a.x, s)
    })), GP.BAR_SEP * s);
    ring.forEach(b => {
      const len = s < 1 ? gpLerp(ml[b.id], S.bars[b.id].l.x, s) : S.bars[b.id].l.x;
      const [ix, iy] = gpPolar(b.a, GP.SEAT),
        [ox, oy] = gpPolar(b.a, GP.SEAT + len);
      const el = N.bar[b.id];
      css(el, "strokeWidth", gpLerp(GP.BAR_W, GP_LOOK.barW, s).toFixed(2));
      att(el, "x1", ix.toFixed(2));
      att(el, "y1", iy.toFixed(2));
      att(el, "x2", ox.toFixed(2));
      att(el, "y2", oy.toFixed(2));
      G.tips[b.id] = {
        a: b.a,
        r: GP.SEAT + len
      };
    });
    const lop = gpClamp((s - 0.6) / 0.4, 0, 1);
    gpSeparate(ring.map(b => ({
      id: b.id,
      a: b.a
    })), GP.LABEL_SEP).forEach(b => {
      const tip = G.tips[b.id],
        box = G.lb[b.id],
        el = N.bl[b.id];
      const rad = b.a * Math.PI / 180,
        sx = Math.sin(rad),
        cy = -Math.cos(rad);
      const R = tip.r * G.k + 6 + Math.abs(sx) * box.w * 0.5 + Math.abs(cy) * box.h * 0.5;
      css(el, "transform", "translate(" + (G.pivX + sx * R - box.w / 2).toFixed(1) + "px," + (G.pivY + cy * R - box.h / 2).toFixed(1) + "px)");
      css(el, "opacity", lop.toFixed(3));
      const txt = tg.na && tg.na[b.id] ? "—" : tg.vals[b.id].toFixed(1);
      if (el.__v !== txt) {
        el.__v = txt;
        el.lastChild.textContent = txt;
      }
    });
    const L = needleLen(),
      bow = 2 * S.flex.x * s;
    att(N.needle, "transform", "rotate(" + nd.toFixed(3) + ")");
    att(N.nl, "d", "M0 0Q" + bow.toFixed(2) + " " + (-L / 2).toFixed(2) + " 0 " + (-L).toFixed(2));
    css(N.nl, "strokeWidth", gpLerp(GP_MAST.needleW, GP_LOOK.needleW, s).toFixed(2));
    css(N.nl, "stroke", "var(--" + lead + ")");
    att(N.bead, "cy", (-L).toFixed(2));
    att(N.bead, "r", (gpLerp(GP_MAST.bead, GP_LOOK.bead, s) * (1 + 0.45 * gpClamp(S.bead.x, -0.4, 1.6))).toFixed(2));
    css(N.bead, "fill", "var(--" + lead + ")");
    att(N.pivot, "r", gpLerp(GP_MAST.pivot, GP_LOOK.pivot, s).toFixed(2));
    S.trail.push({
      t,
      a: nd
    });
    while (S.trail.length > 2 && t - S.trail[0].t > 110) S.trail.shift();
    let amin = nd,
      amax = nd;
    S.trail.forEach(p => {
      if (p.a < amin) amin = p.a;
      if (p.a > amax) amax = p.a;
    });
    if (amax - amin > 1 && s > 0.5) {
      const [ax, ay] = gpPolar(amin, L),
        [bx, by] = gpPolar(amax, L);
      att(N.wake, "d", "M0 0L" + ax.toFixed(1) + " " + ay.toFixed(1) + "A" + L + " " + L + " 0 0 1 " + bx.toFixed(1) + " " + by.toFixed(1) + "Z");
      css(N.wake, "fill", "var(--" + lead + ")");
      css(N.wake, "opacity", Math.min(0.24, (amax - amin) / 30).toFixed(3));
    } else css(N.wake, "opacity", "0");
    N.shk.forEach((el, i) => {
      const sh = S.shocks[i];
      if (!sh) {
        css(el, "opacity", "0");
        return;
      }
      const u = gpClamp((t - sh.t0) / 1000, 0, 1),
        r = GP.R * (1.05 + 1.25 * gpEaseOut3(u) * sh.k);
      att(el, "d", "M" + (-r).toFixed(1) + " 0A" + r.toFixed(1) + " " + r.toFixed(1) + " 0 0 1 " + r.toFixed(1) + " 0");
      css(el, "stroke", "var(--" + sh.color + ")");
      css(el, "strokeWidth", (7 * Math.pow(1 - u, 1.5) + 0.6).toFixed(2));
      css(el, "opacity", (0.55 * Math.pow(1 - u, 1.7)).toFixed(3));
    });
  }
  function odo(el, v) {
    const u = Math.round(v * 10 * 1e4) / 1e4;
    const p0 = (u % 10 + 10) % 10;
    const p1 = Math.floor(u / 10) % 10 + Math.max(0, p0 - 9);
    const p2 = Math.floor(u / 100) % 10 + Math.max(0, u % 100 - 99);
    const r = el.__r || (el.__r = el.querySelectorAll(".gp-od > span"));
    css(r[0], "transform", "translateY(" + (-p2).toFixed(4) + "em)");
    css(r[1], "transform", "translateY(" + (-p1).toFixed(4) + "em)");
    css(r[2], "transform", "translateY(" + (-p0).toFixed(4) + "em)");
  }
  function paintRead(tg, t, dt) {
    const fe = S.reelDirect ? fiNow() : tg.fe;
    css(N.reel, "transform", "translateY(" + (-fe * 1.15).toFixed(4) + "em)");
    const vel = dt > 0 ? Math.abs(fe - S.fe) / dt : 0;
    S.fe = fe;
    const bl = reduce ? 0 : Math.round(gpClamp((vel - 6) / 7, 0, 2.5) * 4) / 4;
    if (bl !== S.blur) {
      S.blur = bl;
      css(N.reel, "filter", bl ? "blur(" + bl + "px)" : "none");
    }
    const idx = Math.round(fe);
    if (idx !== S.idx) {
      S.idx = idx;
      N.wsub.textContent = F[idx].sub;
      cb.onIndex(idx);
    }
    odo(N.numA, tg.lab);
    odo(N.numB, tg.opp);
    if (N.sideB.dataset.opp !== tg.oppId) N.sideB.dataset.opp = tg.oppId;
    let ev = -1;
    M.events.forEach((e, i) => {
      if (e.x <= S.x + 1e-6 && S.x - e.x < 0.1) ev = i;
    });
    if (ev !== S.ev) {
      S.ev = ev;
      if (ev >= 0) {
        const e = M.events[ev];
        N.evText.textContent = e.label;
        const w = N.ev.offsetWidth,
          px = xPx(e.x);
        const left = gpClamp(px - 9, 0, Math.max(0, G.tl.w - w));
        css(N.ev, "transform", "translateX(" + left.toFixed(1) + "px)");
        N.ev.style.setProperty("--pin", (px - left).toFixed(1) + "px");
      }
      N.ev.classList.toggle("on", ev >= 0);
    }
  }
  function paintTimeline(tg, t) {
    const g = G.tlx,
      P = G.pal,
      tl = G.tl,
      dpr = G.dpr;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, N.tl.width, N.tl.height);
    g.drawImage(G.stat, 0, 0);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const xp = xPx(S.x),
      yp = yPx(tg.lab),
      y50 = yPx(50);
    const r0 = G.narrow ? 2.1 : 2.6;
    for (let i = 0; i < M.polls.length; i++) {
      const d = S.dots[i];
      if (d.s === 0) continue;
      const p = M.polls[i],
        q = G.dotsPx[i];
      let y = q.py,
        a = 0.8,
        r = r0;
      if (d.s === 1) {
        y -= (1 - gpBounce(d.t)) * 34;
        a *= Math.min(1, d.t * 5);
        if (d.c && d.t > 0.36 && d.t < 0.62) {
          const k = 1 - (d.t - 0.36) / 0.26;
          r *= 1 + 1.2 * k;
          a = Math.min(1, a + 0.2 * k);
        }
      } else if (d.s === 3) {
        y -= gpEaseOut3(d.t) * 18;
        a *= 1 - d.t;
      }
      if (S.shimmer > 0) {
        const ph = (t - S.shimmer) / 1100 - q.px / tl.w * 0.7;
        if (ph > 0 && ph < 0.3) {
          const w = Math.sin(ph / 0.3 * Math.PI);
          r *= 1 + w;
          a = Math.min(1, a + w * 0.2);
        }
      }
      g.fillStyle = gpRgba(p.v >= 50 ? P.alp : P[p.opp], a);
      g.beginPath();
      g.arc(q.px, y, r, 0, 6.2832);
      g.fill();
    }
    const tr = G.trace;
    let j = 0;
    while (j < tr.length && tr[j].x <= S.x) j++;
    if (j > 0) {
      g.save();
      g.beginPath();
      g.rect(0, 0, tl.w, y50);
      g.clip();
      g.beginPath();
      g.moveTo(tr[0].px, y50);
      for (let i = 0; i < j; i++) g.lineTo(tr[i].px, tr[i].py);
      g.lineTo(xp, yp);
      g.lineTo(xp, y50);
      g.closePath();
      g.fillStyle = gpRgba(P.alp, 0.085);
      g.fill();
      g.restore();
      g.lineWidth = G.narrow ? 2.2 : 2.6;
      g.lineJoin = "round";
      g.lineCap = "round";
      let i = 0;
      while (i < j) {
        const id = tr[i].id;
        g.strokeStyle = gpRgba(P[id], 1);
        g.beginPath();
        g.moveTo(tr[Math.max(0, i - 1)].px, tr[Math.max(0, i - 1)].py);
        while (i < j && tr[i].id === id) {
          g.lineTo(tr[i].px, tr[i].py);
          i++;
        }
        if (i >= j) g.lineTo(xp, yp);
        g.stroke();
      }
    }
    const hx = Math.round(xp) + 0.5;
    g.strokeStyle = gpRgba(P.ink, 0.24);
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(hx, tl.pt - 6);
    g.lineTo(hx, tl.pt + tl.ph);
    g.stroke();
    if (S.mode === "play" && !reduce) {
      const u = (t - T0) % 1100 / 1100;
      g.strokeStyle = gpRgba(P[tg.oppId], 0.45 * (1 - u));
      g.lineWidth = 1.5;
      g.beginPath();
      g.arc(xp, yp, 5 + u * 9, 0, 6.2832);
      g.stroke();
    }
    g.fillStyle = gpRgba(P[tg.oppId], 1);
    g.strokeStyle = gpRgba(P.bg, 1);
    g.lineWidth = 2;
    g.beginPath();
    g.arc(xp, yp, G.narrow ? 4.5 : 5.2, 0, 6.2832);
    g.fill();
    g.stroke();
  }
  function paintGrains(t) {
    if (!G.grx) return;
    const g = G.grx,
      gr = G.gr,
      P = G.pal,
      K = M.swKeys;
    if (!S.grains.length) {
      if (gr.dirty) {
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.clearRect(0, 0, N.gr.width, N.gr.height);
        gr.dirty = false;
      }
      return;
    }
    gr.dirty = true;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, N.gr.width, N.gr.height);
    const k = G.k * G.dpr;
    g.setTransform(k, 0, 0, k, gr.ox * G.dpr, gr.oy * G.dpr);
    g.lineCap = "round";
    const area = GP_LOOK.barW * GP.BAR_LEN / GP.MAX_PCT;
    const end = (id, o, gn) => {
      if (id < GP_IDS.length && G.tips[K[id]]) {
        const tip = G.tips[K[id]],
          [x, y] = gpPolar(tip.a, tip.r),
          [ax, ay] = gpPolar(tip.a + 90, o * GP_LOOK.barW * 0.84);
        return [x + ax, y + ay, tip.a];
      }
      const a = gn.side * (100 + 12 * gn.jit),
        [x, y] = gpPolar(a, GP.SEAT + GP.BAR_LEN * 0.9);
      return [x, y, a];
    };
    const at = (gn, v) => {
      const [x0, y0, a0] = end(gn.from, gn.o1, gn),
        [x3, y3, a3] = end(gn.to, gn.o2, gn);
      const h = (36 + 0.32 * Math.hypot(x3 - x0, y3 - y0)) * gn.h;
      const [u0x, u0y] = gpPolar(a0, h),
        [u3x, u3y] = gpPolar(a3, h);
      return gpBez(x0, y0, x0 + u0x, y0 + u0y, x3 + u3x, y3 + u3y, x3, y3, v);
    };
    for (const gn of S.grains) {
      const u = gpClamp((t - gn.t0) / gn.dur, 0, 1),
        v = 0.5 - 0.5 * Math.cos(Math.PI * u);
      const r = Math.sqrt(gn.m * area / Math.PI),
        oth = K.length - 1;
      const fade = gn.from === oth ? Math.min(1, u / 0.25) : gn.to === oth ? Math.min(1, (1 - u) / 0.3) : 1;
      const [x, y] = at(gn, v),
        [bx, by] = at(gn, Math.max(0, v - 0.014));
      g.strokeStyle = g.fillStyle = gpRgba(P[K[gn.from]], 0.95 * fade);
      g.lineWidth = r * 1.6;
      g.beginPath();
      g.moveTo(bx, by);
      g.lineTo(x, y);
      g.stroke();
      g.beginPath();
      g.arc(x, y, r, 0, 6.2832);
      g.fill();
    }
  }
  function paintFx(t) {
    const g = G.fxx,
      P = G.pal;
    if (!S.comets.length && !S.sparks.length && !S.debris.length && !S.rings.length) {
      if (G.fxDirty) {
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.clearRect(0, 0, N.fx.width, N.fx.height);
        G.fxDirty = false;
      }
      return;
    }
    G.fxDirty = true;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, N.fx.width, N.fx.height);
    g.setTransform(G.dpr, 0, 0, G.dpr, 0, 0);
    g.lineCap = "round";
    S.rings.forEach(r => {
      const u = gpClamp((t - r.t0) / r.dur, 0, 1),
        q = 1 - u;
      if (r.fill) {
        g.fillStyle = gpRgba(P[r.col], 0.5 * q * q);
        g.beginPath();
        g.arc(r.x, r.y, (4 + 8 * r.k) * (0.6 + 0.4 * u) * G.fxk, 0, 6.2832);
        g.fill();
        return;
      }
      g.strokeStyle = gpRgba(P[r.col], 0.7 * q * q);
      g.lineWidth = 0.6 + 2.2 * q;
      g.beginPath();
      g.arc(r.x, r.y, (2 + (8 + 16 * r.k) * gpEaseOut3(u)) * G.fxk, 0, 6.2832);
      g.stroke();
    });
    const ng = needleGeom();
    S.comets.forEach(c => {
      const v = gpShotEase(gpClamp((t - c.t0) / c.dur, 0, 1)),
        col = P[c.col],
        R = (2.5 + 2.1 * c.w) * G.fxk;
      const [hx, hy] = gpShotAt(c, v, ng);
      let px = hx,
        py = hy;
      g.lineCap = "butt";
      for (let k = 1; k <= 12; k++) {
        const vv = v - k * 0.022;
        if (vv < 0) break;
        const [qx, qy] = gpShotAt(c, vv, ng);
        g.strokeStyle = gpRgba(col, 0.9 * (1 - k / 13));
        g.lineWidth = R * 1.7 * (1 - k / 13.5);
        g.beginPath();
        g.moveTo(px, py);
        g.lineTo(qx, qy);
        g.stroke();
        px = qx;
        py = qy;
      }
      g.lineCap = "round";
      g.fillStyle = gpRgba(col, 0.22);
      g.beginPath();
      g.arc(hx, hy, R * 2.6, 0, 6.2832);
      g.fill();
      g.fillStyle = gpRgba(col, 1);
      g.beginPath();
      g.arc(hx, hy, R, 0, 6.2832);
      g.fill();
    });
    S.debris.forEach(d => {
      const a = Math.pow(1 - d.age / d.max, 1.1);
      g.strokeStyle = gpRgba(P[d.col], 0.45 * a);
      g.lineWidth = d.r * 1.3;
      g.beginPath();
      g.moveTo(d.x - d.vx * 0.035, d.y - d.vy * 0.035);
      g.lineTo(d.x, d.y);
      g.stroke();
      g.fillStyle = gpRgba(P[d.col], 0.9 * a);
      g.beginPath();
      g.arc(d.x, d.y, d.r * (0.6 + 0.4 * a), 0, 6.2832);
      g.fill();
    });
    S.sparks.forEach(s => {
      const a = Math.pow(1 - s.age / s.max, 1.2);
      g.strokeStyle = gpRgba(P[s.col], a);
      g.lineWidth = s.w;
      g.beginPath();
      g.moveTo(s.x, s.y);
      g.lineTo(s.x - s.vx * 0.028, s.y - s.vy * 0.028);
      g.stroke();
    });
  }
  function busy(t) {
    if (S.mode !== "pause") return true;
    if (S.comets.length || S.sparks.length || S.debris.length || S.rings.length || S.shocks.length || S.flood || G.fxDirty) return true;
    if (S.grains.length || S.pend.some(r => r.some(v => Math.abs(v) > 1e-9))) return true;
    if (S.shimmer > 0 && t - S.shimmer < 2000) return true;
    if (S.fl.x !== 1 || S.shape < 1) return true;
    if (!gpRest(S.needle, M.at(S.x).deg, 0.02) || !gpRest(S.bead, 0, 0.002)) return true;
    if (!gpRest(S.flex, 0, 0.02) || !gpRest(S.shX, 0, 0.02) || !gpRest(S.shY, 0, 0.02)) return true;
    for (const id of GP_IDS) {
      const b = S.bars[id];
      if (Math.abs(b.a.v) > 0.02 || Math.abs(b.l.v) > 0.02) return true;
    }
    if (S.dots.some(d => d.s === 1 || d.s === 3)) return true;
    if (S.trail.length > 1 && t - S.trail[0].t < 120) return true;
    if (S.blur) return true;
    return false;
  }
  function frame(t) {
    raf = 0;
    if (dead) return;
    const dt = gpClamp((t - last) / 1000, 0, 1 / 20);
    last = t;
    advance(dt, t);
    if (dead || finished) return;
    flight(t, dt);
    const tg = M.at(S.x);
    updGrains(tg, dt, t);
    physics(tg, dt, t);
    S.nd = gpLerp(tg.deg, S.needle.x, S.shape);
    updDots(dt, t);
    updFx(dt, t);
    updBeats(t);
    paintDial(tg, t);
    paintGrains(t);
    paintRead(tg, t, dt);
    paintTimeline(tg, t);
    paintFx(t);
    if (busy(t)) raf = requestAnimationFrame(frame);else S.trail = [];
  }
  function wake() {
    if (!raf && !dead) {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
  }
  function announce() {
    const f = F[Math.round(M.fOf(S.x))],
      tg = M.at(S.x);
    cb.onAnnounce((f.label === "Now" ? "Now" : f.label + " " + f.year) + ": Labor " + tg.lab.toFixed(1) + ", " + GP_NAME[tg.oppId] + " " + tg.opp.toFixed(1) + ", two-party preferred.");
  }
  function takeOver(t) {
    S.userMoved = true;
    S.beatQ = [];
    if (S.mode === "intro") {
      S.fl.x = Math.max(S.fl.x, 0.999);
    }
  }
  function onDown(e, kind) {
    if (S.out || e.button != null && e.button !== 0) return;
    e.preventDefault();
    const t = performance.now();
    takeOver(t);
    const el = kind === "tl" ? N.time : N.when;
    try {
      el.setPointerCapture(e.pointerId);
    } catch (_) {}
    S.drag = {
      id: e.pointerId,
      kind,
      el,
      y0: e.clientY,
      f0: fiNow(),
      samples: []
    };
    S.reelDirect = kind === "reel";
    setMode("drag", t);
    onMove(e);
    wake();
  }
  function onMove(e) {
    const d = S.drag;
    if (!d || e.pointerId !== d.id) return;
    if (e.cancelable) e.preventDefault();
    let x;
    if (d.kind === "tl") x = pxX(e.clientX - G.tl.left);else x = M.xOfF(d.f0 - (e.clientY - d.y0) / G.lineH);
    S.x = gpClamp(x, x0, x1);
    const t = performance.now();
    d.samples.push({
      t,
      x: S.x
    });
    while (d.samples.length > 2 && t - d.samples[0].t > 90) d.samples.shift();
    wake();
  }
  function onUp(e) {
    const d = S.drag;
    if (!d || e.pointerId !== d.id) return;
    try {
      d.el.releasePointerCapture(e.pointerId);
    } catch (_) {}
    S.drag = null;
    const t = performance.now(),
      sm = d.samples;
    let v = 0;
    if (sm.length > 1 && t - sm[sm.length - 1].t < 60) {
      const a = sm[0],
        b = sm[sm.length - 1];
      v = b.t > a.t ? (b.x - a.x) / (b.t - a.t) * 1000 : 0;
    }
    if (!reduce && Math.abs(v) > span * 0.35) {
      S.coast = {
        v
      };
      setMode("coast", t);
    } else glideTo(nearestX(S.x), t);
    wake();
  }
  function onWheel(e) {
    if (S.out) return;
    e.preventDefault();
    const d = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
    S.wheelAcc += e.deltaMode === 1 ? d * 30 : d;
    if (Math.abs(S.wheelAcc) >= 44) {
      step(Math.sign(S.wheelAcc));
      S.wheelAcc = 0;
    }
  }
  function step(dir) {
    if (S.out) return;
    const t = performance.now();
    takeOver(t);
    const from = S.mode === "glide" ? Math.round(M.fOf(S.glide.to)) : Math.round(fiNow());
    glideTo(X[gpClamp(from + dir, 0, n - 1)], t);
    wake();
  }
  const tlDown = e => onDown(e, "tl"),
    reelDown = e => onDown(e, "reel");
  N.time.addEventListener("pointerdown", tlDown);
  N.when.addEventListener("pointerdown", reelDown);
  window.addEventListener("pointermove", onMove, {
    passive: false
  });
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);
  N.when.addEventListener("wheel", onWheel, {
    passive: false
  });
  N.time.addEventListener("wheel", onWheel, {
    passive: false
  });
  const onResize = () => {
    measure();
    wake();
  };
  window.addEventListener("resize", onResize);
  N.root.addEventListener("scroll", onResize, {
    passive: true
  });
  const mo = new MutationObserver(() => {
    readTheme();
    buildStatic();
    wake();
  });
  mo.observe(document.body, {
    attributes: true,
    attributeFilter: ["class"]
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => {
    if (!dead) {
      measure();
      wake();
    }
  });
  function finish() {
    if (finished) return;
    finished = true;
    if (glyph) {
      glyph.style.opacity = "";
      if (fly && glyph.animate) {
        glyph.animate([{
          transform: "scale(1)"
        }, {
          transform: "scale(1.14)"
        }, {
          transform: "scale(0.97)"
        }, {
          transform: "scale(1)"
        }], {
          duration: 460,
          easing: "ease-out"
        });
      }
    }
    cb.onDone();
  }
  readTheme();
  measure();
  if (fly) glyph.style.opacity = "0";
  if (!fly) N.root.classList.add("gp-in");
  setMode(S.mode, T0);
  if (reduce || !fly) {
    S.ended = true;
    N.root.classList.add("gp-end");
    S.beat = M.beats.find(b => b.kind === "end");
    cb.onBeat(S.beat);
  }
  frame(performance.now());
  return {
    toggle() {
      const t = performance.now();
      if (S.out) return;
      if (S.mode === "play" || S.mode === "rewind" || S.mode === "hold" || S.mode === "intro") {
        if (S.mode === "intro") S.fl.x = Math.max(S.fl.x, 0.999);
        S.userMoved = true;
        setMode("pause", t);
        announce();
      } else if (S.x >= x1 - 1e-6) this.replay();else {
        S.glide = null;
        S.coast = null;
        S.userMoved = false;
        S.reelDirect = false;
        setMode("play", t);
      }
      wake();
    },
    replay() {
      if (S.out) return;
      const t = performance.now();
      S.userMoved = false;
      S.reelDirect = false;
      S.ended = false;
      N.root.classList.remove("gp-end");
      if (reduce) {
        S.x = x0;
        S.stepT = t;
        setMode("play", t);
        showBeat(M.beats.find(b => b.kind === "start"), t);
      } else rewind(t);
      wake();
    },
    step,
    home() {
      takeOver();
      glideTo(x0, performance.now());
      wake();
    },
    end() {
      takeOver();
      glideTo(x1, performance.now());
      wake();
    },
    close() {
      if (S.out || finished) return;
      const t = performance.now();
      N.root.dataset.phase = "leaving";
      cb.onPlaying(false);
      if (!fly) {
        S.out = {
          t0: t
        };
        setTimeout(finish, reduce ? 0 : 200);
        return;
      }
      if (glyph) G.mast = mastFrom(glyph.getBoundingClientRect());
      S.out = {
        t0: t,
        fl0: S.fl.x,
        sh0: S.shape
      };
      S.glide = {
        x: S.x,
        v: 0,
        to: x1
      };
      S.comets = [];
      S.grains = [];
      S.mode = "outro";
      wake();
    },
    destroy() {
      dead = true;
      if (raf) cancelAnimationFrame(raf);
      N.time.removeEventListener("pointerdown", tlDown);
      N.when.removeEventListener("pointerdown", reelDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      N.when.removeEventListener("wheel", onWheel);
      N.time.removeEventListener("wheel", onWheel);
      window.removeEventListener("resize", onResize);
      N.root.removeEventListener("scroll", onResize);
      mo.disconnect();
      if (glyph) glyph.style.opacity = "";
    }
  };
}
function GpOdo({
  cls
}) {
  const reel = k => React.createElement("span", {
    className: "gp-od",
    key: k
  }, React.createElement("span", null, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((d, i) => React.createElement("i", {
    key: i
  }, d))));
  return React.createElement("span", {
    className: "gp-num " + cls,
    "aria-hidden": "true"
  }, reel(0), reel(1), React.createElement("span", {
    className: "gp-pt"
  }, "."), reel(2));
}
function GpBeat({
  beat,
  out,
  late
}) {
  const [held] = useState(late);
  let i = 0;
  const parts = [];
  beat.title.forEach((tok, k) => {
    if (!tok.t) return;
    if (tok.p) {
      parts.push(React.createElement("span", {
        key: k,
        className: "gp-w gp-pw",
        style: {
          "--i": i++,
          color: "var(--" + tok.p + "-text)"
        }
      }, tok.t));
      return;
    }
    tok.t.split(/(\s+)/).forEach((w, j) => {
      if (!w) return;
      if (/^\s+$/.test(w)) {
        parts.push(" ");
        return;
      }
      parts.push(React.createElement("span", {
        key: k + "." + j,
        className: "gp-w",
        style: {
          "--i": i++
        }
      }, w));
    });
  });
  return React.createElement("div", {
    className: "gp-beat-in" + (out ? " out" : held ? " late" : "")
  }, React.createElement("div", {
    className: "gp-beat-t"
  }, parts), beat.sub && React.createElement("div", {
    className: "gp-beat-s",
    style: {
      "--i": i
    }
  }, beat.sub));
}
function DialStory({
  originRect,
  onClose
}) {
  const D = window.AP.D;
  const M = useMemo(() => buildDialStory(D), []);
  const reduce = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const N = useRef({
    bl: {},
    bar: {},
    shk: []
  }).current;
  const reg = k => el => {
    N[k] = el;
  };
  const engRef = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const [playing, setPlaying] = useState(false);
  const [idx, setIdx] = useState(M.n - 1);
  const [beat, setBeat] = useState(null);
  const [prevBeat, setPrevBeat] = useState(null);
  const [said, setSaid] = useState("");
  const beatRef = useRef(null);
  React.useLayoutEffect(() => {
    const eng = gpEngine(M, N, {
      onPlaying: setPlaying,
      onIndex: setIdx,
      onBeat: b => {
        const was = beatRef.current;
        beatRef.current = b;
        setPrevBeat(was && was !== b ? was : null);
        setBeat(b);
        if (b) setSaid(b.title.map(x => x.t).join("") + (b.sub ? ". " + b.sub + "." : "."));
      },
      onAnnounce: setSaid,
      onDone: () => closeRef.current()
    }, {
      reduce,
      origin: originRect
    });
    engRef.current = eng;
    return () => eng.destroy();
  }, []);
  useEffect(() => {
    if (!prevBeat) return undefined;
    const tm = setTimeout(() => setPrevBeat(null), 300);
    return () => clearTimeout(tm);
  }, [prevBeat]);
  useEffect(() => {
    const eng = () => engRef.current;
    const onKey = ev => {
      if (ev.defaultPrevented || ev.metaKey || ev.ctrlKey || ev.altKey) return;
      const onButton = ev.target instanceof Element && ev.target.closest("button");
      if (ev.key === "Escape") {
        ev.preventDefault();
        eng().close();
        return;
      }
      if (ev.key === "Tab") {
        const f = [...N.root.querySelectorAll("button, [tabindex='0']")].filter(el => !el.disabled && el.offsetParent !== null);
        if (!f.length) return;
        const i = f.indexOf(document.activeElement);
        const nx = ev.shiftKey ? i <= 0 ? f.length - 1 : i - 1 : i === f.length - 1 ? 0 : i + 1;
        ev.preventDefault();
        f[nx].focus();
        return;
      }
      if ((ev.key === " " || ev.key === "Enter") && onButton) return;
      if (ev.key === " " || ev.key === "k" || ev.key === "K") {
        ev.preventDefault();
        eng().toggle();
      } else if (ev.key === "ArrowLeft" || ev.key === "ArrowDown") {
        ev.preventDefault();
        eng().step(-1);
      } else if (ev.key === "ArrowRight" || ev.key === "ArrowUp") {
        ev.preventDefault();
        eng().step(1);
      } else if (ev.key === "Home") {
        ev.preventDefault();
        eng().home();
      } else if (ev.key === "End") {
        ev.preventDefault();
        eng().end();
      } else if (ev.key === "r" || ev.key === "R") {
        ev.preventDefault();
        eng().replay();
      }
    };
    document.addEventListener("keydown", onKey);
    const body = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    N.playBtn && N.playBtn.focus({
      preventScroll: true
    });
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = body;
    };
  }, []);
  const cur = M.frames[idx] || M.frames[M.n - 1];
  const valueText = (cur.label === "Now" ? "Now" : cur.label + " " + cur.year) + ": Labor " + cur.lab.toFixed(1) + ", " + GP_NAME[cur.oppId] + " " + cur.opp.toFixed(1) + ", two-party preferred";
  const [vx, vy, vw, vh] = M.VB;
  return React.createElement("div", {
    className: "dl-backdrop gp",
    ref: reg("root"),
    role: "dialog",
    "aria-modal": "true",
    "aria-labelledby": "gp-title"
  }, React.createElement("div", {
    className: "gp-paper",
    "aria-hidden": "true"
  }), React.createElement("h2", {
    id: "gp-title",
    className: "sr-only"
  }, "The term so far, replayed on the masthead dial"), React.createElement("div", {
    className: "gp-top"
  }, React.createElement("div", {
    className: "gp-eyebrow"
  }, React.createElement("span", {
    className: "gp-eyebrow-t"
  }, "The term so far"), React.createElement("span", {
    className: "gp-rwmark",
    "aria-hidden": "true"
  }, React.createElement("svg", {
    viewBox: "0 0 16 10",
    width: "16",
    height: "10"
  }, React.createElement("path", {
    d: "M8 0v10L0 5zM16 0v10L8 5z",
    fill: "currentColor"
  })), "Winding back"), React.createElement("span", {
    className: "gp-count",
    ref: reg("count")
  })), React.createElement("button", {
    type: "button",
    className: "gp-x",
    ref: reg("closeBtn"),
    onClick: () => engRef.current.close(),
    "aria-label": "Close the replay",
    title: "Close (Esc)"
  }, React.createElement("svg", {
    viewBox: "0 0 20 20",
    width: "18",
    height: "18",
    "aria-hidden": "true"
  }, React.createElement("path", {
    d: "M4.5 4.5l11 11M15.5 4.5l-11 11",
    stroke: "currentColor",
    strokeWidth: "1.9",
    strokeLinecap: "round"
  })))), React.createElement("div", {
    className: "gp-stage"
  }, React.createElement("div", {
    className: "gp-when",
    ref: reg("when"),
    "aria-hidden": "true",
    title: "Drag or scroll to move through the months"
  }, React.createElement("div", {
    className: "gp-wline"
  }, React.createElement("span", {
    className: "gp-reelbox"
  }, React.createElement("span", {
    className: "gp-reel",
    ref: reg("reel")
  }, M.frames.map((f, i) => React.createElement("span", {
    key: i
  }, f.label, f.year && React.createElement("em", null, " ", f.year)))))), React.createElement("div", {
    className: "gp-wsub",
    ref: reg("wsub")
  })), React.createElement("div", {
    className: "gp-row"
  }, React.createElement("div", {
    className: "gp-side gp-side-a"
  }, React.createElement("span", {
    className: "gp-name"
  }, React.createElement("i", null), "Labor"), React.createElement("span", {
    ref: reg("numA")
  }, React.createElement(GpOdo, {
    cls: "gp-num-a"
  }))), React.createElement("div", {
    className: "gp-dial"
  }, React.createElement("div", {
    className: "gp-dbox",
    ref: reg("dbox"),
    style: {
      aspectRatio: vw + " / " + vh
    }
  }, React.createElement("div", {
    className: "gp-flier",
    ref: reg("flier")
  }, React.createElement("svg", {
    className: "gp-svg",
    viewBox: vx + " " + vy + " " + vw + " " + vh,
    "aria-hidden": "true"
  }, React.createElement("g", {
    className: "gp-shocks"
  }, [0, 1, 2, 3].map(i => React.createElement("path", {
    key: i,
    className: "gp-shock",
    ref: el => {
      N.shk[i] = el;
    }
  }))), React.createElement("g", {
    className: "gp-arc",
    ref: reg("arc")
  }, React.createElement("path", {
    className: "gp-arc-a",
    d: gpArc(-90, 0, GP.R)
  }), React.createElement("path", {
    className: "gp-arc-b",
    d: gpArc(0, 90, GP.R),
    ref: reg("arcB")
  }), React.createElement("path", {
    className: "gp-arc-f",
    d: gpArc(0, 90, GP.R),
    pathLength: "100",
    ref: reg("arcF")
  })), React.createElement("g", {
    className: "gp-scale",
    ref: reg("scale")
  }, Array.from({
    length: 13
  }, (_, k) => -12 + k * 2).map(pts => {
    const d = gpDeg(pts),
      lv = pts === 0,
      mj = pts % 6 === 0;
    const [ax, ay] = gpPolar(d, GP.R - 8 - (lv ? 26 : mj ? 17 : 9)),
      [bx, by] = gpPolar(d, GP.R - 8);
    return React.createElement("line", {
      key: pts,
      className: "gp-tick" + (lv ? " lv" : mj ? " mj" : ""),
      x1: ax,
      y1: ay,
      x2: bx,
      y2: by
    });
  })), React.createElement("path", {
    className: "gp-merc",
    ref: reg("merc")
  }), React.createElement("line", {
    className: "gp-ghost",
    x1: "0",
    y1: "0",
    x2: "0",
    y2: -GP_LOOK.needle,
    ref: reg("ghost")
  }), GP_IDS.map(id => React.createElement("line", {
    key: id,
    className: "gp-bar",
    stroke: "var(--" + id + ")",
    ref: el => {
      N.bar[id] = el;
    }
  })), React.createElement("path", {
    className: "gp-wake",
    ref: reg("wake")
  }), React.createElement("g", {
    ref: reg("needle")
  }, React.createElement("path", {
    className: "gp-needle",
    ref: reg("nl")
  }), React.createElement("circle", {
    className: "gp-bead",
    cx: "0",
    ref: reg("bead")
  })), React.createElement("circle", {
    className: "gp-pivot",
    cx: "0",
    cy: "0",
    ref: reg("pivot")
  })), M.flowAt && !reduce && React.createElement("canvas", {
    className: "gp-gr",
    ref: reg("gr"),
    "aria-hidden": "true"
  }), GP_IDS.map(id => React.createElement("div", {
    key: id,
    className: "gp-bl",
    ref: el => {
      N.bl[id] = el;
    },
    "aria-hidden": "true"
  }, React.createElement("b", {
    style: {
      color: "var(--" + id + "-text)"
    }
  }, GP_ABBR[id]), React.createElement("span", null, "00.0")))))), React.createElement("div", {
    className: "gp-side gp-side-b",
    ref: reg("sideB")
  }, React.createElement("span", {
    className: "gp-name gp-oppname"
  }, React.createElement("span", {
    className: "gp-opp-reel"
  }, React.createElement("span", {
    "data-id": "lnp"
  }, "Coalition", React.createElement("i", null)), React.createElement("span", {
    "data-id": "onp"
  }, "One Nation", React.createElement("i", null)))), React.createElement("span", {
    ref: reg("numB")
  }, React.createElement(GpOdo, {
    cls: "gp-num-b"
  })))), React.createElement("div", {
    className: "gp-beat",
    "aria-hidden": "true"
  }, prevBeat && React.createElement(GpBeat, {
    key: "o" + prevBeat.id,
    beat: prevBeat,
    out: true
  }), beat && React.createElement(GpBeat, {
    key: "b" + beat.id,
    beat: beat,
    late: !!prevBeat
  }))), React.createElement("div", {
    className: "gp-time",
    ref: reg("time"),
    role: "slider",
    tabIndex: 0,
    "aria-label": "Month",
    "aria-valuemin": 0,
    "aria-valuemax": M.n - 1,
    "aria-valuenow": idx,
    "aria-valuetext": valueText
  }, React.createElement("canvas", {
    className: "gp-tl",
    ref: reg("tl"),
    "aria-hidden": "true"
  }), React.createElement("div", {
    className: "gp-ev",
    ref: reg("ev"),
    "aria-hidden": "true"
  }, React.createElement("span", {
    ref: reg("evText")
  }))), React.createElement("div", {
    className: "gp-ctl"
  }, React.createElement("button", {
    type: "button",
    className: "gp-play" + (playing ? " on" : ""),
    ref: reg("playBtn"),
    onClick: () => engRef.current.toggle(),
    "aria-label": playing ? "Pause" : "Play",
    title: playing ? "Pause (Space)" : "Play (Space)"
  }, React.createElement("svg", {
    viewBox: "0 0 20 20",
    width: "18",
    height: "18",
    "aria-hidden": "true"
  }, React.createElement("path", {
    className: "gp-ic-play",
    d: "M6.5 4.2v11.6L16 10z",
    fill: "currentColor"
  }), React.createElement("path", {
    className: "gp-ic-pause",
    d: "M5.5 4.5h3v11h-3zM11.5 4.5h3v11h-3z",
    fill: "currentColor"
  }))), React.createElement("button", {
    type: "button",
    className: "gp-btn gp-replay",
    onClick: () => engRef.current.replay(),
    title: "Replay from the election (R)"
  }, React.createElement("svg", {
    viewBox: "0 0 20 20",
    width: "15",
    height: "15",
    "aria-hidden": "true"
  }, React.createElement("path", {
    d: "M4.6 8.2A5.8 5.8 0 1 1 4.4 12",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.8",
    strokeLinecap: "round"
  }), React.createElement("path", {
    d: "M3.6 3.9v4.8h4.8",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.8",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  })), "Replay"), React.createElement("ul", {
    className: "gp-key",
    "aria-label": "Key"
  }, React.createElement("li", null, React.createElement("svg", {
    viewBox: "0 0 16 12",
    width: "16",
    height: "12",
    "aria-hidden": "true"
  }, React.createElement("path", {
    d: "M2 11V4M6 11V1M10 11V5M14 11V7",
    strokeWidth: "2.6",
    style: {
      stroke: "var(--ink-3)"
    }
  })), "First preferences"), M.flowAt && !reduce && React.createElement("li", null, React.createElement("svg", {
    viewBox: "0 0 16 12",
    width: "16",
    height: "12",
    "aria-hidden": "true"
  }, React.createElement("path", {
    d: "M2 11V6M14 11V3",
    strokeWidth: "2.6",
    style: {
      stroke: "var(--ink-3)"
    }
  }), [[5, 3.9], [8, 2.6], [11, 2.1]].map(([cx, cy]) => React.createElement("circle", {
    key: cx,
    cx: cx,
    cy: cy,
    r: "1.05",
    style: {
      fill: "var(--ink-3)"
    }
  }))), "Voters switching"), React.createElement("li", null, React.createElement("svg", {
    viewBox: "0 0 16 12",
    width: "16",
    height: "12",
    "aria-hidden": "true"
  }, React.createElement("path", {
    d: "M8 11L5 2.6",
    strokeWidth: "1.7",
    strokeLinecap: "round",
    style: {
      stroke: "var(--ink-3)"
    }
  }), React.createElement("circle", {
    cx: "5",
    cy: "2.6",
    r: "1.7",
    style: {
      fill: "var(--ink-3)"
    }
  })), "Two-party preferred"), React.createElement("li", null, React.createElement("svg", {
    viewBox: "0 0 16 12",
    width: "16",
    height: "12",
    "aria-hidden": "true"
  }, React.createElement("path", {
    d: "M8 11L11 2.6",
    strokeWidth: "1.4",
    strokeDasharray: "1.2 2",
    strokeLinecap: "round",
    style: {
      stroke: "var(--ink-3)"
    }
  })), "Election day"), React.createElement("li", null, React.createElement("svg", {
    viewBox: "0 0 16 12",
    width: "16",
    height: "12",
    "aria-hidden": "true"
  }, React.createElement("circle", {
    cx: "8",
    cy: "6",
    r: "2.6",
    style: {
      fill: "var(--ink-3)"
    }
  })), "One poll")), React.createElement("span", {
    className: "gp-hint",
    "aria-hidden": "true"
  }, "Space \xB7 \u2190 \u2192 \xB7 Esc")), React.createElement("canvas", {
    className: "gp-fx",
    ref: reg("fx"),
    "aria-hidden": "true"
  }), React.createElement("div", {
    className: "sr-only",
    "aria-live": "polite"
  }, said));
}
Object.assign(window, {
  DialStory,
  buildDialStory,
  gpShotPlan,
  gpShotAt,
  gpKnock
});