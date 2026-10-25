["useState", "useRef", "useMemo", "useCallback", "useEffect", "useId"].forEach(h => {
  window[h] = React[h];
});
window.MQ_PHONE = "(max-width: 640px)";
window.useNarrow = function useNarrow(query) {
  const q = query || "(max-width: 620px)";
  const [narrow, setNarrow] = React.useState(() => typeof window !== "undefined" && window.matchMedia ? window.matchMedia(q).matches : false);
  React.useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mq = window.matchMedia(q);
    const on = e => setNarrow(e.matches);
    setNarrow(mq.matches);
    if (mq.addEventListener) {
      mq.addEventListener("change", on);
      return () => mq.removeEventListener("change", on);
    }
    mq.addListener(on);
    return () => mq.removeListener(on);
  }, [q]);
  return narrow;
};
window.RD_REDUCED_MOTION = typeof window !== "undefined" && !!window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
window.SM = window.RD_REDUCED_MOTION ? "auto" : "smooth";
window.inkOf = function inkOf(c) {
  return typeof c === "string" ? c.replace(/var\(--(alp|lnp|grn|onp|dem|dlp|uap|xnt|jln|ind|oth)\)/g, "var(--$1-text)") : c;
};
window.useDismissOutside = function useDismissOutside(ref, open, onDismiss, ignoreSel) {
  const cb = React.useRef(onDismiss);
  cb.current = onDismiss;
  React.useEffect(() => {
    if (!open) return;
    const outside = e => {
      const el = ref && ref.current;
      if (el && e.target instanceof Node && el.contains(e.target)) return;
      if (ignoreSel && e.target instanceof Element && e.target.closest(ignoreSel)) return;
      cb.current();
    };
    document.addEventListener("pointerdown", outside, true);
    return () => document.removeEventListener("pointerdown", outside, true);
  }, [open]);
};
window.JUR = window.AUSPOL && window.AUSPOL.jur || null;
window.apWho = function apWho(src, id, fed) {
  const w = src && src.who;
  if (!w) return fed;
  const n = id === "alb" ? w.alb : id === "hanson" || id === "han" ? w.han : w.opp;
  return n || fed;
};
window.AP = function () {
  const D = window.AUSPOL;
  const latestX = D.mx(D.MONTHS[D.MONTHS.length - 1]);
  function rangeDomain(rangeId) {
    if (rangeId === "all") return [D.domain.x0, D.domain.x1];
    const months = Number(rangeId);
    return [latestX - months / 12 - 0.04, D.domain.x1];
  }
  function filterPts(points, x0) {
    const out = [];
    for (let i = 0; i < points.length; i++) {
      if (points[i].x >= x0) {
        if (out.length === 0 && i > 0) out.push(points[i - 1]);
        out.push(points[i]);
      }
    }
    return out.length ? out : points.slice(-2);
  }
  function buildXTicks(x0, x1) {
    const months = D.MONTHS.map(ym => ({
      ym,
      x: D.mx(ym)
    })).filter(m => m.x >= x0 - 0.02 && m.x <= x1);
    const span = x1 - x0;
    const step = span > 1.0 ? 2 : 1;
    return months.filter((_, i) => i % step === 0).map(m => {
      const [y, mo] = m.ym.split("-").map(Number);
      const label = mo === 1 || m === months[0] ? `${D.monthName(mo)} ’${String(y).slice(2)}` : D.monthName(mo);
      return {
        x: m.x,
        label
      };
    });
  }
  function series(points, key) {
    return points.map(d => ({
      x: d.x,
      y: d[key]
    }));
  }
  function monthLabelFull(ym) {
    const [y, m] = ym.split("-").map(Number);
    return `${D.monthName(m)} ${y}`;
  }
  const DISC = {
    BW: 45,
    DEFF: D.latest && D.latest.method && D.latest.method.deff || 1.6,
    ENGAGED: 0.90,
    MIN_NEFF: 4,
    MIN_HOUSES: 3,
    MIN_STRAT: 3
  };
  const OPP_SPLICE = "2026-02-13";
  const dayOf = iso => +new Date(iso) / 864e5;
  const metricOf = (p, id) => p.appr && p.appr.metricBy && p.appr.metricBy[id] || "approval";
  const DISCORD_MEASURES = [{
    id: "tpp_alp_imp",
    facet: "twopp",
    label: "ALP v L/NP (implied)",
    color: "var(--alp)",
    val: p => p.alpImp,
    share: p => p.alpImp
  }, {
    id: "tpp_alp",
    facet: "twopp",
    label: "ALP v L/NP (as published)",
    color: "var(--alp)",
    dashed: true,
    val: p => p.alpN,
    share: p => p.alpN
  }, {
    id: "tpp_alpon_imp",
    facet: "twopp",
    label: "ALP v ON (implied)",
    color: "var(--onp)",
    val: p => p.alpOnImp,
    share: p => p.alpOnImp
  }, {
    id: "tpp_alpon",
    facet: "twopp",
    label: "ALP v ON (as published)",
    color: "var(--onp)",
    dashed: true,
    val: p => p.tppAlt ? p.tppAlt.alp : null,
    share: p => p.tppAlt.alp
  }, {
    id: "p_alp",
    facet: "primary",
    label: "ALP",
    color: "var(--alp)",
    val: p => p.p.alp,
    share: p => p.p.alp
  }, {
    id: "p_lnp",
    facet: "primary",
    label: "L/NP",
    color: "var(--lnp)",
    val: p => p.p.lnp,
    share: p => p.p.lnp
  }, {
    id: "p_onp",
    facet: "primary",
    label: "ON",
    color: "var(--onp)",
    val: p => p.p.onp,
    share: p => p.p.onp
  }, {
    id: "p_grn",
    facet: "primary",
    label: "GRN",
    color: "var(--grn)",
    val: p => p.p.grn,
    share: p => p.p.grn
  }, {
    id: "net_alb",
    facet: "leadership",
    label: "Albanese",
    color: "var(--alp)",
    net: true,
    val: p => p.appr.albNet,
    stratum: p => metricOf(p, "alb")
  }, {
    id: "net_opp",
    facet: "leadership",
    label: "Opp. leader",
    color: "var(--lnp)",
    net: true,
    val: p => p.appr.taylorNet,
    stratum: p => metricOf(p, "taylor") + "|" + (p.released < OPP_SPLICE ? "ley" : "taylor")
  }, {
    id: "net_han",
    facet: "leadership",
    label: "Hanson",
    color: "var(--onp)",
    net: true,
    val: p => p.appr.hansonNet,
    stratum: p => metricOf(p, "hanson")
  }, {
    id: "rd_right",
    facet: "rd",
    label: "L/NP + ON",
    color: "var(--ink-2)",
    val: p => p.p.lnp != null && p.p.onp != null ? p.p.lnp + p.p.onp : null,
    share: p => p.p.lnp + p.p.onp
  }, {
    id: "rd_on_imp",
    facet: "rd",
    label: "ALP v ON (implied)",
    color: "var(--onp)",
    val: p => p.alpOnImp,
    share: p => p.alpOnImp,
    flows: D.flowTables.onp
  }, {
    id: "rd_lnp_imp",
    facet: "rd",
    label: "ALP v L/NP (implied)",
    color: "var(--lnp)",
    val: p => p.alpImp,
    share: p => p.alpImp,
    flows: D.flowTables.lnp
  }];
  const flowVar = (p, F) => {
    const q = p.p || {};
    if (["alp", "lnp", "grn", "onp"].some(k => q[k] == null)) return null;
    let tot = 0,
      e1 = 0,
      e2 = 0;
    for (const k in F) tot += q[k] || 0;
    if (!tot) return null;
    for (const k in F) {
      const s = (q[k] || 0) / tot;
      e1 += s * F[k];
      e2 += s * F[k] * F[k];
    }
    return Math.max(0, e2 - e1 * e1);
  };
  function discordPoints(m) {
    const pts = [];
    D.individualPolls.forEach(p => {
      const y = m.val(p);
      if (y == null) return;
      const n = p.sample || 1000;
      const fv = m.flows ? flowVar(p, m.flows) : null;
      const sv = m.net ? DISC.DEFF * (DISC.ENGAGED - y / 100 * (y / 100)) / n * 1e4 : fv != null ? DISC.DEFF * fv / n * 1e4 : DISC.DEFF * (m.share(p) / 100) * (1 - m.share(p) / 100) / n * 1e4;
      pts.push({
        t: dayOf(p.released),
        y,
        house: p.pollster,
        sv,
        k: m.stratum ? m.stratum(p) : "_"
      });
    });
    return D.MONTHS.map(ym => {
      const [Y, Mo] = ym.split("-").map(Number);
      const t = dayOf(Y + "-" + String(Mo).padStart(2, "0") + "-15");
      const x = D.mx(ym);
      const wOf = q => Math.exp(-0.5 * Math.pow((q.t - t) / DISC.BW, 2));
      const win = pts.filter(q => wOf(q) > 0.05);
      if (!win.length) return {
        ym,
        x,
        sigma: null
      };
      let Se = 0,
        Sfl = 0,
        Sw = 0,
        Sw2 = 0,
        dofUsed = 0;
      const houses = new Set();
      const strata = [];
      win.forEach(q => {
        if (strata.indexOf(q.k) < 0) strata.push(q.k);
      });
      strata.forEach(k => {
        const g = win.filter(q => q.k === k);
        if (g.length < DISC.MIN_STRAT) return;
        let sw = 0,
          sx = 0,
          sy = 0,
          sxx = 0,
          sxy = 0;
        g.forEach(q => {
          const w = wOf(q),
            xx = (q.t - t) / 30;
          sw += w;
          sx += w * xx;
          sy += w * q.y;
          sxx += w * xx * xx;
          sxy += w * xx * q.y;
        });
        const den = sw * sxx - sx * sx;
        const b = den ? (sw * sxy - sx * sy) / den : 0;
        const a = (sy - b * sx) / sw;
        g.forEach(q => {
          const w = wOf(q),
            e = q.y - (a + b * ((q.t - t) / 30));
          Se += w * e * e;
          Sfl += w * q.sv;
          Sw += w;
          Sw2 += w * w;
          houses.add(q.house);
        });
        dofUsed += 2;
      });
      if (!Sw) return {
        ym,
        x,
        sigma: null
      };
      const neff = Sw * Sw / Sw2;
      if (neff < DISC.MIN_NEFF || houses.size < DISC.MIN_HOUSES || neff - dofUsed < 1) return {
        ym,
        x,
        sigma: null
      };
      const sigma = Math.sqrt(Se / Sw * (neff / (neff - dofUsed)));
      const floor = Math.sqrt(Sfl / Sw);
      return {
        ym,
        x,
        sigma,
        floor,
        R: floor ? sigma / floor : null,
        excess: Math.sqrt(Math.max(0, sigma * sigma - floor * floor)),
        ci: 1 / Math.sqrt(2 * (neff - dofUsed)),
        neff,
        houses: houses.size,
        n: win.length
      };
    });
  }
  const _disc = {};
  function discord(id) {
    if (!_disc[id]) {
      const m = DISCORD_MEASURES.filter(d => d.id === id)[0];
      _disc[id] = m ? discordPoints(m) : [];
    }
    return _disc[id];
  }
  const discordFacet = facet => DISCORD_MEASURES.filter(m => m.facet === facet);
  function discordRead(R) {
    if (R == null) return {
      id: "na",
      label: "not enough polls",
      verb: "—"
    };
    if (R < 0.8) return {
      id: "herded",
      label: "herded",
      verb: "tighter than chance allows"
    };
    if (R < 1.2) return {
      id: "chance",
      label: "chance-consistent",
      verb: "as close as sampling allows"
    };
    if (R < 1.6) return {
      id: "mild",
      label: "mild divergence",
      verb: "a little further apart than chance"
    };
    return {
      id: "wide",
      label: "real disagreement",
      verb: "far beyond sampling error"
    };
  }
  const ROW_KEYS = new Set([...D.individualPolls, ...(D.directionOnlyPolls || []), ...(D.confidenceOnlyPolls || []), ...(D.issuesOnlyPolls || [])].map(p => p.pollster + "|" + p.released));
  const pollRowKey = m => {
    if (!m || !m.pollster || !m.released) return null;
    const k = m.pollster + "|" + m.released;
    return ROW_KEYS.has(k) ? k : null;
  };
  const MORPH_MS = 320;
  const MORPH_BEZ = [0.3, 0.7, 0.3, 1];
  const MORPH_CSS = "cubic-bezier(" + MORPH_BEZ.join(", ") + ")";
  const morphEase = (() => {
    const [p1x, p1y, p2x, p2y] = MORPH_BEZ;
    const A = (a, b) => 1 - 3 * b + 3 * a,
      B = (a, b) => 3 * b - 6 * a,
      C = a => 3 * a;
    const f = (t, a, b) => ((A(a, b) * t + B(a, b)) * t + C(a)) * t;
    const df = (t, a, b) => 3 * A(a, b) * t * t + 2 * B(a, b) * t + C(a);
    return x => {
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      let t = x;
      for (let i = 0; i < 8; i++) {
        const d = df(t, p1x, p2x);
        if (Math.abs(d) < 1e-6) break;
        t -= (f(t, p1x, p2x) - x) / d;
      }
      return f(t, p1y, p2y);
    };
  })();
  const reduceMotion = () => !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const FRAME_MS = 1000 / 60;
  function morphClock(raf, frame, land, from) {
    cancelAnimationFrame(raf.current);
    const start = Math.min(1, (from || 0) + FRAME_MS / MORPH_MS);
    const t0 = performance.now() - start * MORPH_MS;
    let last = start;
    const flush = window.ReactDOM && window.ReactDOM.flushSync ? window.ReactDOM.flushSync : fn => fn();
    const step = now => {
      const raw = Math.max(last, Math.min(1, (now - t0) / MORPH_MS));
      last = raw;
      if (raw >= 1) {
        raf.current = 0;
        flush(land);
        return;
      }
      flush(() => frame(morphEase(raw)));
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return {
      t: morphEase(start),
      raw: start
    };
  }
  const morphRawOf = t => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    let lo = 0,
      hi = 1;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (morphEase(mid) < t) lo = mid;else hi = mid;
    }
    return (lo + hi) / 2;
  };
  function useMorph(value, apply, canMorph) {
    const [morph, setMorph] = React.useState(null);
    const raf = React.useRef(0);
    const land = React.useRef(0);
    const live = React.useRef(null);
    React.useEffect(() => () => {
      cancelAnimationFrame(raf.current);
      clearTimeout(land.current);
    }, []);
    const put = m => {
      live.current = m;
      setMorph(m);
    };
    const choose = next => {
      const cur = live.current;
      let from = value,
        resume = 0;
      if (cur && next === cur.from) {
        from = cur.to;
        resume = morphRawOf(1 - cur.t);
      } else if (cur && cur.t < 0.5 && next !== cur.to) from = cur.from;
      apply(next);
      cancelAnimationFrame(raf.current);
      clearTimeout(land.current);
      if (next === from || reduceMotion() || canMorph && !canMorph(from, next)) {
        put(null);
        return;
      }
      const c = morphClock(raf, t => put({
        from,
        to: next,
        t
      }), () => put(null), resume);
      put({
        from,
        to: next,
        t: c.t
      });
      land.current = setTimeout(() => {
        cancelAnimationFrame(raf.current);
        put(null);
      }, (1 - c.raw) * MORPH_MS + 200);
    };
    return [morph, choose];
  }
  function useValueMorph(value) {
    const st = React.useRef({
      value,
      morph: null
    });
    const raf = React.useRef(0);
    const land = React.useRef(0);
    const [, force] = React.useReducer(x => x + 1, 0);
    const s = st.current;
    if (value !== s.value) {
      const cur = s.morph;
      let from = s.value,
        resume = 0;
      if (cur && value === cur.from) {
        from = cur.to;
        resume = morphRawOf(1 - cur.t);
      } else if (cur && cur.t < 0.5 && value !== cur.to) from = cur.from;
      s.value = value;
      const start = Math.min(1, resume + FRAME_MS / MORPH_MS);
      s.morph = reduceMotion() || from === value ? null : {
        from,
        to: value,
        t: morphEase(start),
        resume,
        pending: true
      };
    }
    React.useLayoutEffect(() => {
      const m = st.current.morph;
      if (!m || !m.pending) return;
      m.pending = false;
      clearTimeout(land.current);
      morphClock(raf, t => {
        if (st.current.morph === m) {
          m.t = t;
          force();
        }
      }, () => {
        if (st.current.morph === m) {
          st.current.morph = null;
          force();
        }
      }, m.resume);
      land.current = setTimeout(() => {
        cancelAnimationFrame(raf.current);
        if (st.current.morph === m) {
          st.current.morph = null;
          force();
        }
      }, (1 - m.resume) * MORPH_MS + 200);
    });
    React.useEffect(() => () => {
      cancelAnimationFrame(raf.current);
      clearTimeout(land.current);
    }, []);
    const m = st.current.morph;
    return m ? {
      from: m.from,
      to: m.to,
      t: m.t
    } : null;
  }
  function useKeyClock(key, ref) {
    const st = React.useRef({
      key,
      n: 0,
      run: null
    });
    const raf = React.useRef(0),
      land = React.useRef(0);
    const seen = React.useRef(true);
    const [, force] = React.useReducer(x => x + 1, 0);
    const s = st.current;
    if (key !== s.key) {
      s.key = key;
      s.n++;
      s.run = reduceMotion() || !seen.current ? null : {
        t: morphEase(FRAME_MS / MORPH_MS),
        n: s.n,
        pending: true
      };
    }
    React.useEffect(() => {
      const el = ref && ref.current;
      if (!el || !window.IntersectionObserver) return undefined;
      const io = new IntersectionObserver(es => {
        es.forEach(e => {
          seen.current = e.isIntersecting;
        });
      });
      io.observe(el);
      return () => io.disconnect();
    }, [ref]);
    React.useLayoutEffect(() => {
      const r = st.current.run;
      if (!r || !r.pending) return;
      r.pending = false;
      clearTimeout(land.current);
      morphClock(raf, t => {
        if (st.current.run === r) {
          r.t = t;
          force();
        }
      }, () => {
        if (st.current.run === r) {
          st.current.run = null;
          force();
        }
      });
      land.current = setTimeout(() => {
        cancelAnimationFrame(raf.current);
        if (st.current.run === r) {
          st.current.run = null;
          force();
        }
      }, MORPH_MS + 200);
    });
    React.useEffect(() => () => {
      cancelAnimationFrame(raf.current);
      clearTimeout(land.current);
    }, []);
    return s.run ? {
      t: s.run.t,
      n: s.run.n
    } : null;
  }
  const sceneYm = x => String(Math.round((x + 1e4) * 1e4)).padStart(12, "0");
  const sceneRows = new WeakMap();
  const rowsOfPts = (pts, area) => {
    let r = sceneRows.get(pts);
    if (!r) {
      r = area ? pts.filter(p => p.y0 != null && p.y1 != null).map(p => ({
        ym: sceneYm(p.x),
        x: p.x,
        y0: p.y0,
        y1: p.y1
      })) : pts.filter(p => p.y != null).map(p => ({
        ...p,
        ym: sceneYm(p.x)
      }));
      sceneRows.set(pts, r);
    }
    return r;
  };
  function blendScene(A, B, t, dotKey) {
    const rows = pts => rowsOfPts(pts, false);
    const byId = arr => new Map((arr || []).map(s => [s.id, s]));
    const lerp = (a, b) => a + (b - a) * t;
    const sa = byId(A.series),
      sb = byId(B.series);
    const series = [];
    (B.series || []).forEach(s => {
      const a = sa.get(s.id);
      if (!a) {
        series.push({
          ...s,
          opacity: (s.opacity != null ? s.opacity : 1) * t,
          endLabelOpacity: (s.endLabelOpacity != null ? s.endLabelOpacity : 1) * t
        });
        return;
      }
      const bl = a.points.length && s.points.length ? blendRows(rows(a.points), rows(s.points), t, ["y"]) : null;
      const oa = a.opacity != null ? a.opacity : 1,
        ob = s.opacity != null ? s.opacity : 1;
      series.push({
        ...s,
        points: bl ? bl.rows.map(r => ({
          x: r.x,
          y: r.y
        })) : s.points,
        clipX: bl ? bl.clip : s.clipX,
        opacity: lerp(oa, ob),
        endCap: s.endCap
      });
    });
    (A.series || []).forEach(a => {
      if (sb.has(a.id)) return;
      series.push({
        ...a,
        opacity: (a.opacity != null ? a.opacity : 1) * (1 - t),
        endLabelOpacity: (a.endLabelOpacity != null ? a.endLabelOpacity : 1) * (1 - t)
      });
    });
    const aa = byId(A.areas),
      ab = byId(B.areas);
    const areas = [];
    (B.areas || []).forEach(z => {
      const a = aa.get(z.id);
      if (!a) {
        areas.push({
          ...z,
          fade: t
        });
        return;
      }
      const toRows = pts => rowsOfPts(pts, true);
      const bl = a.points.length && z.points.length ? blendRows(toRows(a.points), toRows(z.points), t, ["y0", "y1"]) : null;
      areas.push({
        ...z,
        points: bl ? bl.rows.filter(r => r.y0 != null && r.y1 != null).map(r => ({
          x: r.x,
          y0: r.y0,
          y1: r.y1
        })) : z.points,
        clipX: bl ? bl.clip : z.clipX
      });
    });
    (A.areas || []).forEach(a => {
      if (!ab.has(a.id)) areas.push({
        ...a,
        fade: 1 - t
      });
    });
    const cross = crossClouds(A.scatter || [], B.scatter || [], t, dotKey);
    return {
      series,
      areas,
      scatter: cross.scatter,
      scatterOut: cross.scatterOut,
      scatterMove: cross.scatterMove,
      domain: blendDomain(A.domain, B.domain, t)
    };
  }
  const softKey = k => /^ci/.test(k);
  const monoTangents = (xs, ys) => {
    const n = xs.length,
      h = [],
      s = [],
      m = new Array(n).fill(0);
    for (let i = 0; i < n - 1; i++) {
      h[i] = xs[i + 1] - xs[i];
      s[i] = h[i] ? (ys[i + 1] - ys[i]) / h[i] : 0;
    }
    const sign = v => (v > 0) - (v < 0);
    for (let i = 1; i < n - 1; i++) {
      const q = (s[i - 1] * h[i] + s[i] * h[i - 1]) / (h[i - 1] + h[i] || 1);
      m[i] = (sign(s[i - 1]) + sign(s[i])) * Math.min(Math.abs(s[i - 1]), Math.abs(s[i]), 0.5 * Math.abs(q)) || 0;
    }
    if (n > 2) {
      m[0] = (3 * s[0] - m[1]) / 2;
      m[n - 1] = (3 * s[n - 2] - m[n - 2]) / 2;
    }
    return m;
  };
  const curveOf = (arr, k, pick) => {
    const xs = [],
      ys = [];
    arr.forEach(d => {
      const v = pick ? pick(d) : d[k];
      if (v != null) {
        xs.push(d.x);
        ys.push(v);
      }
    });
    const n = xs.length,
      mono = !!(window.AP && window.AP.rd);
    const m = mono && n > 2 ? monoTangents(xs, ys) : null;
    return x => {
      if (!n || x < xs[0] || x > xs[n - 1]) return null;
      let i = 0;
      while (i < n - 2 && xs[i + 1] < x) i++;
      if (n === 1) return ys[0];
      const h = xs[i + 1] - xs[i];
      if (!h) return ys[i];
      const u = (x - xs[i]) / h,
        u2 = u * u,
        u3 = u2 * u;
      if (n === 2) return ys[0] + (ys[1] - ys[0]) * u;
      if (m) return (2 * u3 - 3 * u2 + 1) * ys[i] + (u3 - 2 * u2 + u) * h * m[i] + (-2 * u3 + 3 * u2) * ys[i + 1] + (u3 - u2) * h * m[i + 1];
      const y0 = ys[i - 1] != null ? ys[i - 1] : ys[i],
        y3 = ys[i + 2] != null ? ys[i + 2] : ys[i + 1];
      const x0 = xs[i - 1] != null ? xs[i - 1] : xs[i],
        x3 = xs[i + 2] != null ? xs[i + 2] : xs[i + 1];
      const c1 = ys[i] + (ys[i + 1] - y0) / 6,
        c2 = ys[i + 1] - (y3 - ys[i]) / 6;
      const k1 = xs[i] + (xs[i + 1] - x0) / 6,
        k2 = xs[i + 1] - (x3 - xs[i]) / 6;
      const bez = (a, b, c, d, w) => {
        const q = 1 - w;
        return q * q * q * a + 3 * q * q * w * b + 3 * q * w * w * c + w * w * w * d;
      };
      let lo = 0,
        hi = 1,
        w = u;
      for (let it = 0; it < 30; it++) {
        if (bez(xs[i], k1, k2, xs[i + 1], w) < x) lo = w;else hi = w;
        w = (lo + hi) / 2;
      }
      return bez(ys[i], c1, c2, ys[i + 1], w);
    };
  };
  const SUBSTEPS = 4;
  const alignMemo = new WeakMap();
  function alignRows(A, B, keys) {
    const kk = keys.join(",") + (window.AP && window.AP.rd ? "|m" : "|c");
    let byB = alignMemo.get(A);
    if (!byB) {
      byB = new WeakMap();
      alignMemo.set(A, byB);
    }
    const hit = byB.get(B);
    if (hit && hit.kk === kk) return hit;
    const index = arr => {
      const o = {};
      arr.forEach(d => o[d.ym] = d);
      return o;
    };
    const ia = index(A),
      ib = index(B);
    const soft = keys.filter(softKey);
    const centreOf = k => /^ci_/.test(k) ? k.slice(3) : keys.find(c => !softKey(c));
    const curves = arr => {
      const c = {};
      keys.forEach(k => {
        c[k] = curveOf(arr, k);
      });
      soft.forEach(k => {
        const cen = centreOf(k);
        if (!cen) return;
        const w = d => d[k] != null && d[k] > 0 && d[cen] != null ? d[k] : null;
        c[k + "Hi"] = curveOf(arr, null, d => w(d) == null ? null : d[cen] + d[k]);
        c[k + "Lo"] = curveOf(arr, null, d => w(d) == null ? null : d[cen] - d[k]);
        c[k + "C"] = cen;
      });
      return c;
    };
    const ca = curves(A),
      cb = curves(B);
    const readAt = (idx, arr, cv, ym, x) => {
      const row = ym && idx[ym];
      const held = !row && (x <= arr[0].x ? arr[0] : x >= arr[arr.length - 1].x ? arr[arr.length - 1] : null);
      const o = row || held ? {
        ...(row || held)
      } : {
        x
      };
      if (!row && !held) keys.forEach(k => {
        o[k] = cv[k](x);
      });
      soft.forEach(k => {
        const cen = cv[k + "C"];
        if (!cen) return;
        const at = held ? held.x : x;
        const hi = cv[k + "Hi"](at),
          lo = cv[k + "Lo"](at);
        o[k + "Hi"] = hi != null ? hi : o[cen];
        o[k + "Lo"] = lo != null ? lo : o[cen];
      });
      return o;
    };
    const months = [...new Set(A.concat(B).map(d => d.ym))].sort().map(ym => ({
      ym,
      x: (ia[ym] || ib[ym]).x
    }));
    const pairs = [];
    months.forEach((m, i) => {
      pairs.push({
        ym: m.ym,
        x: m.x,
        da: readAt(ia, A, ca, m.ym, m.x),
        db: readAt(ib, B, cb, m.ym, m.x)
      });
      const n = months[i + 1];
      if (!n) return;
      for (let j = 1; j < SUBSTEPS; j++) {
        const x = m.x + (n.x - m.x) * j / SUBSTEPS;
        pairs.push({
          x,
          mid: true,
          da: readAt(ia, A, ca, null, x),
          db: readAt(ib, B, cb, null, x)
        });
      }
    });
    const reach = (arr, k) => {
      const on = arr.filter(d => d[k] != null && d[k] > 0);
      return on.length ? [on[0].x, on[on.length - 1].x] : null;
    };
    const reaches = {};
    keys.filter(softKey).forEach(k => {
      reaches[k] = [reach(A, k), reach(B, k)];
    });
    const out = {
      kk,
      pairs,
      reaches,
      a0: A[0].x,
      a1: A[A.length - 1].x,
      b0: B[0].x,
      b1: B[B.length - 1].x
    };
    byB.set(B, out);
    return out;
  }
  function blendRows(A, B, t, keys) {
    if (!A.length || !B.length) return null;
    const lerp = (p, q) => p + (q - p) * t;
    const al = alignRows(A, B, keys);
    const clip = [lerp(al.a0, al.b0), lerp(al.a1, al.b1)];
    const clips = {};
    Object.keys(al.reaches).forEach(k => {
      const [ra, rb] = al.reaches[k];
      clips[k] = ra && rb ? [lerp(ra[0], rb[0]), lerp(ra[1], rb[1])] : clip;
    });
    return {
      rows: al.pairs.map(({
        ym,
        x,
        mid,
        da,
        db
      }) => {
        const o = mid ? {
          x,
          mid
        } : {
          ym,
          x
        };
        keys.forEach(k => {
          o[k] = da[k] == null || db[k] == null ? softKey(k) && (da[k] != null || db[k] != null) ? lerp(da[k] || 0, db[k] || 0) : null : lerp(da[k], db[k]);
          if (softKey(k)) ["Hi", "Lo"].forEach(e => {
            const p = da[k + e],
              q = db[k + e];
            if (p != null && q != null) o[k + e] = lerp(p, q);
          });
        });
        return o;
      }),
      clip,
      clips
    };
  }
  const crossMemo = new WeakMap();
  function crossClouds(A, B, t, keyOf) {
    let byB = crossMemo.get(A),
      hit = byB && byB.get(B);
    if (!hit) {
      const claim = arr => {
        const m = new Map();
        arr.forEach(d => {
          const k = keyOf(d);
          if (!m.has(k)) m.set(k, d);
        });
        return m;
      };
      const ia = claim(A),
        ib = claim(B);
      const travel = [],
        leaving = [],
        arriving = [];
      ia.forEach((d, k) => ib.has(k) ? travel.push([d, ib.get(k)]) : leaving.push(d));
      ib.forEach((d, k) => {
        if (!ia.has(k)) arriving.push(d);
      });
      hit = {
        travel,
        leaving,
        arriving
      };
      if (!byB) {
        byB = new WeakMap();
        crossMemo.set(A, byB);
      }
      byB.set(B, hit);
    }
    const {
      travel,
      leaving,
      arriving
    } = hit;
    return {
      scatter: arriving,
      scatterOut: leaving,
      scatterMove: travel.map(([a, b]) => ({
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        color: mixC(a.color, b.color, t),
        label: b.label,
        meta: b.meta,
        shape: b.shape,
        op: a.op != null || b.op != null ? (a.op != null ? a.op : 1) + ((b.op != null ? b.op : 1) - (a.op != null ? a.op : 1)) * t : undefined
      }))
    };
  }
  function mixC(c1, c2, t) {
    if (t <= 0 || c1 === c2) return c1;
    if (t >= 1) return c2;
    return "color-mix(in oklch shorter hue, " + c1 + ", " + c2 + " " + (t * 100).toFixed(1) + "%)";
  }
  const blendDomain = (from, to, t) => [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t];
  return {
    D,
    rangeDomain,
    filterPts,
    buildXTicks,
    series,
    monthLabelFull,
    latestX,
    pollRowKey,
    morphEase,
    MORPH_MS,
    MORPH_CSS,
    morphClock,
    morphRawOf,
    reduceMotion,
    useMorph,
    useValueMorph,
    useKeyClock,
    blendScene,
    blendRows,
    crossClouds,
    mixC,
    blendDomain,
    discord,
    discordFacet,
    discordRead,
    DISCORD_MEASURES,
    DISC
  };
}();
const rdSigned = (v, dp = 1) => (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(dp);
function rdList(arr) {
  if (!arr.length) return "";
  if (arr.length === 1) return arr[0];
  return arr.slice(0, -1).join(", ") + " and " + arr[arr.length - 1];
}
const rdElecYear = (() => {
  const c = (window.AUSPOL.cycles || []).find(x => x.current);
  return c && c.eDate ? c.eDate.slice(0, 4) : "2025";
})();
function rdMonthYear(ym) {
  const [y, m] = ym.split("-").map(Number);
  return window.AUSPOL.monthNameFull(m) + " " + y;
}
function tTail(t, df) {
  const th = Math.atan(Math.abs(t) / Math.sqrt(df)),
    c2 = Math.cos(th) ** 2;
  let term = 1,
    sum = 1;
  if (df % 2) {
    for (let k = 1; k <= (df - 3) / 2; k++) sum += term *= 2 * k / (2 * k + 1) * c2;
    return 1 - 2 / Math.PI * (th + (df > 1 ? Math.sin(th) * Math.cos(th) * sum : 0));
  }
  for (let k = 1; k <= (df - 2) / 2; k++) sum += term *= (2 * k - 1) / (2 * k) * c2;
  return 1 - Math.sin(th) * sum;
}
function withinHouseSlope(pts) {
  const byHouse = new Map();
  for (const p of pts) (byHouse.get(p.h) || byHouse.set(p.h, []).get(p.h)).push(p);
  const dm = [];
  let houses = 0;
  for (const ps of byHouse.values()) {
    if (ps.length < 2) continue;
    houses++;
    const W = ps.reduce((a, p) => a + p.w, 0);
    const tb = ps.reduce((a, p) => a + p.w * p.t, 0) / W,
      yb = ps.reduce((a, p) => a + p.w * p.y, 0) / W;
    for (const p of ps) dm.push({
      w: p.w,
      dt: p.t - tb,
      dy: p.y - yb
    });
  }
  const df = dm.length - houses - 1;
  const sxx = dm.reduce((a, p) => a + p.w * p.dt * p.dt, 0);
  if (df < 3 || !(sxx > 0)) return null;
  const b = dm.reduce((a, p) => a + p.w * p.dt * p.dy, 0) / sxx;
  const se = Math.sqrt(dm.reduce((a, p) => a + p.w * (p.dy - b * p.dt) ** 2, 0) / df / sxx);
  return {
    b,
    t: se > 0 ? b / se : 0,
    p: se > 0 ? tTail(b / se, df) : 1
  };
}
window.AP.measureOfMatchup = id => ({
  alp_lnp: "lnp",
  alp_on: "onp",
  lnp_on: "lnponp"
})[id] || "lnp";