/* auspol tracker – shared helpers */

/* React hook aliases – assigned to window HERE (this plain script loads before
   every component script) so no JSX file depends on another's load order for
   bare useState / useRef / etc. */
["useState", "useRef", "useMemo", "useCallback", "useEffect", "useId"]
  .forEach((h) => { window[h] = React[h]; });

/* Mark colour -> text colour. The party tokens are tuned for dots and lines;
   at 10px Greens sits at 3.5:1 and One Nation at 3.0:1 on paper, so the same
   value cannot also paint a numeral. Component data carries ONE colour per
   party (it feeds both a swatch and its label), so rather than fork every
   record, wrap it at the point it becomes text: style={{ color: inkOf(c) }}.
   Non-party colours and anything that isn't a var() pass straight through. */
window.inkOf = function inkOf(c) {
  return typeof c === "string"
    ? c.replace(/var\(--(alp|lnp|grn|onp|oth)\)/g, "var(--$1-text)")
    : c;
};

/* A readout opened by a FINGER has no equivalent of the pointer leaving it:
   there is no mouseleave, no blur, nothing. So a panel opened on a phone used
   to stay up until something else happened to open one, which is not what
   anybody means by tapping away from it. This puts it away on the next
   gesture that starts outside the element that owns it.

   pointerdown rather than click, and in the CAPTURE phase, so the panel goes
   as the next gesture BEGINS - before that gesture turns into a scroll, and
   before any handler inside the page can stop it propagating. */
window.useDismissOutside = function useDismissOutside(ref, open, onDismiss) {
  const cb = React.useRef(onDismiss);
  cb.current = onDismiss;
  React.useEffect(() => {
    if (!open) return;
    const outside = (e) => {
      const el = ref && ref.current;
      if (el && e.target instanceof Node && el.contains(e.target)) return;
      cb.current();
    };
    document.addEventListener("pointerdown", outside, true);
    return () => document.removeEventListener("pointerdown", outside, true);
  }, [open]);
};

window.AP = (function () {
  const D = window.AUSPOL;

  const latestX = D.mx(D.MONTHS[D.MONTHS.length - 1]);

  function rangeDomain(rangeId) {
    if (rangeId === "all") return [D.domain.x0, D.domain.x1];
    const months = Number(rangeId);
    return [latestX - months / 12 - 0.04, D.domain.x1];
  }

  function filterPts(points, x0) {
    // keep one point just before the window so the line enters from the edge
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
    // pick months within domain, label every 2nd (or every month if short window)
    const months = D.MONTHS.map((ym) => ({ ym, x: D.mx(ym) })).filter((m) => m.x >= x0 - 0.02 && m.x <= x1);
    const span = x1 - x0;
    const step = span > 1.0 ? 2 : 1;
    return months.filter((_, i) => i % step === 0).map((m) => {
      const [y, mo] = m.ym.split("-").map(Number);
      // an elided year takes a right single QUOTATION mark, not a typewriter
      // apostrophe - the mark stands in for the century it drops
      const label = mo === 1 || (m === months[0])
        ? `${D.monthName(mo)} ’${String(y).slice(2)}`
        : D.monthName(mo);
      return { x: m.x, label };
    });
  }

  function series(points, key) { return points.map((d) => ({ x: d.x, y: d[key] })); }

  function monthLabelFull(ym) {
    const [y, m] = ym.split("-").map(Number);
    return `${D.monthName(m)} ${y}`;
  }

  /* ---- Poll discord – "how much do the polls disagree?" ----------------
     Raw spread between polls is not the interesting quantity: even
     perfectly-agreeing houses scatter, because each one is a sample.  So
     every measure reports three numbers at each point in time:

       sigma   weighted SD of poll residuals about a LOCAL LINEAR trend
               through the window (pp).  Linear rather than a flat mean –
               otherwise genuine movement during the window is booked as
               "disagreement".
       floor   the spread sampling error ALONE would produce:
               sqrt( Sw·DEFF·p(1−p)/n ⁄ Sw ).  Every poll in the archive
               carries a sample size, so this is computable everywhere.
       R       sigma / floor.  Below 0.8 the polls are tighter than chance
               allows (herding); around 1 they agree as well as they can;
               above ~1.2 the houses genuinely diverge.

     Two deliberate choices:
     · Weights are RECENCY ONLY.  Weighting by sample size would suppress
       exactly the small, divergent polls whose spread is being measured.
     · Residuals are taken WITHIN STRATA and pooled, so the Ley → Taylor
       handover and the approval/favourability mix can't masquerade as
       pollsters disagreeing with each other. */
  const DISC = {
    BW: 45,          // Gaussian bandwidth, days
    DEFF: 1.6,       // design effect – weighted online panels aren't simple random samples
    ENGAGED: 0.90,   // assumed approve+disapprove share when a poll publishes only the net
    MIN_NEFF: 4, MIN_HOUSES: 3, MIN_STRAT: 3,
  };
  const OPP_SPLICE = "2026-02-13";   // Taylor replaces Ley – a different person, not a moved number
  const dayOf = (iso) => +new Date(iso) / 864e5;
  const metricOf = (p, id) => (p.appr && p.appr.metricBy && p.appr.metricBy[id]) || "approval";

  const DISCORD_MEASURES = [
    { id: "tpp_alp",   facet: "twopp",      label: "ALP v L/NP", color: "var(--alp)",
      val: (p) => p.alpN, share: (p) => p.alpN },
    { id: "tpp_alpon", facet: "twopp",      label: "ALP v ON",   color: "var(--onp)",
      val: (p) => (p.tppAlt ? p.tppAlt.alp : null), share: (p) => p.tppAlt.alp },
    { id: "p_alp",     facet: "primary",    label: "ALP",        color: "var(--alp)",
      val: (p) => p.p.alp, share: (p) => p.p.alp },
    { id: "p_lnp",     facet: "primary",    label: "L/NP",       color: "var(--lnp)",
      val: (p) => p.p.lnp, share: (p) => p.p.lnp },
    { id: "p_onp",     facet: "primary",    label: "ON",         color: "var(--onp)",
      val: (p) => p.p.onp, share: (p) => p.p.onp },
    { id: "net_alb",   facet: "leadership", label: "Albanese",   color: "var(--alp)", net: true,
      val: (p) => p.appr.albNet, stratum: (p) => metricOf(p, "alb") },
    // the opposition slot is an OFFICE: Ley's and Taylor's readings are never
    // pooled into one residual, or the February handover reads as a 12pp row
    { id: "net_opp",   facet: "leadership", label: "Opp. leader", color: "var(--lnp)", net: true,
      val: (p) => p.appr.taylorNet,
      stratum: (p) => metricOf(p, "taylor") + "|" + (p.released < OPP_SPLICE ? "ley" : "taylor") },
    { id: "net_han",   facet: "leadership", label: "Hanson",     color: "var(--onp)", net: true,
      val: (p) => p.appr.hansonNet, stratum: (p) => metricOf(p, "hanson") },
  ];

  function discordPoints(m) {
    const pts = [];
    D.individualPolls.forEach((p) => {
      const y = m.val(p);
      if (y == null) return;
      const n = p.sample || 1000;
      // a net is a DIFFERENCE of two proportions, so its sampling variance is
      // (approve + disapprove − net²)/n – wider than a single share's
      const sv = m.net
        ? (DISC.DEFF * (DISC.ENGAGED - (y / 100) * (y / 100)) / n) * 1e4
        : (DISC.DEFF * (m.share(p) / 100) * (1 - m.share(p) / 100) / n) * 1e4;
      pts.push({ t: dayOf(p.released), y, house: p.pollster, sv, k: m.stratum ? m.stratum(p) : "_" });
    });

    return D.MONTHS.map((ym) => {
      const [Y, Mo] = ym.split("-").map(Number);
      const t = dayOf(Y + "-" + String(Mo).padStart(2, "0") + "-15");
      const x = D.mx(ym);
      const wOf = (q) => Math.exp(-0.5 * Math.pow((q.t - t) / DISC.BW, 2));
      const win = pts.filter((q) => wOf(q) > 0.05);
      if (!win.length) return { ym, x, sigma: null };

      let Se = 0, Sfl = 0, Sw = 0, Sw2 = 0, dofUsed = 0;
      const houses = new Set();
      const strata = [];
      win.forEach((q) => { if (strata.indexOf(q.k) < 0) strata.push(q.k); });
      strata.forEach((k) => {
        const g = win.filter((q) => q.k === k);
        if (g.length < DISC.MIN_STRAT) return;      // too thin to fit a trend through
        let sw = 0, sx = 0, sy = 0, sxx = 0, sxy = 0;
        g.forEach((q) => {
          const w = wOf(q), xx = (q.t - t) / 30;
          sw += w; sx += w * xx; sy += w * q.y; sxx += w * xx * xx; sxy += w * xx * q.y;
        });
        const den = sw * sxx - sx * sx;
        const b = den ? (sw * sxy - sx * sy) / den : 0;
        const a = (sy - b * sx) / sw;
        g.forEach((q) => {
          const w = wOf(q), e = q.y - (a + b * ((q.t - t) / 30));
          Se += w * e * e; Sfl += w * q.sv; Sw += w; Sw2 += w * w; houses.add(q.house);
        });
        dofUsed += 2;                                // the stratum's own intercept + slope
      });

      if (!Sw) return { ym, x, sigma: null };
      const neff = (Sw * Sw) / Sw2;
      // a window that thin can't tell disagreement from luck – leave a gap
      if (neff < DISC.MIN_NEFF || houses.size < DISC.MIN_HOUSES || neff - dofUsed < 1) return { ym, x, sigma: null };
      const sigma = Math.sqrt((Se / Sw) * (neff / (neff - dofUsed)));
      const floor = Math.sqrt(Sfl / Sw);
      return {
        ym, x, sigma, floor, R: floor ? sigma / floor : null,
        excess: Math.sqrt(Math.max(0, sigma * sigma - floor * floor)),
        ci: 1 / Math.sqrt(2 * (neff - dofUsed)),     // ±1 SE on the ratio
        neff, houses: houses.size, n: win.length,
      };
    });
  }

  const _disc = {};
  function discord(id) {
    if (!_disc[id]) {
      const m = DISCORD_MEASURES.filter((d) => d.id === id)[0];
      _disc[id] = m ? discordPoints(m) : [];
    }
    return _disc[id];
  }
  const discordFacet = (facet) => DISCORD_MEASURES.filter((m) => m.facet === facet);

  // the ratio's plain-English read – band edges live here, once
  function discordRead(R) {
    if (R == null) return { id: "na", label: "not enough polls", verb: "—" };
    if (R < 0.8) return { id: "herded", label: "herded", verb: "tighter than chance allows" };
    if (R < 1.2) return { id: "chance", label: "chance-consistent", verb: "as close as sampling allows" };
    if (R < 1.6) return { id: "mild", label: "mild divergence", verb: "a little further apart than chance" };
    return { id: "wide", label: "real disagreement", verb: "far beyond sampling error" };
  }

  /* A poll's identity, shared by everything that plots one. House plus
     fieldwork-end date, because that is the pair EVERY source carries: the
     archive rows, the preferred-PM and approval clouds (which plot the poll
     object itself) and the direction readings, which are a different record
     shape with no `day` on them at all - keying on the day quietly matched
     nothing for a whole panel's worth of dots.

     Returns null when the archive has no such row: three Essential waves
     published a direction reading and no voting intention, so they are dots
     with nowhere to go, and a chart can ask before it offers the trip. */
  const ROW_KEYS = new Set(D.individualPolls.map((p) => p.pollster + "|" + p.released));
  const pollRowKey = (m) => {
    if (!m || !m.pollster || !m.released) return null;
    const k = m.pollster + "|" + m.released;
    return ROW_KEYS.has(k) ? k : null;
  };

  /* ONE motion curve and ONE duration for every transition that moves data
     rather than chrome: the matchup morph in the hero, the digit reels (which
     animate it in CSS - keep the cubic-bezier in template.html the same), and
     the chart's own travelling x window. They were on separate curves once and
     it showed: a figure whose colour crawled on one ease while its digits
     crawled on another read as sticking.

     Accelerates, holds a real middle, settles without a tail: 16% / 37% / 60%
     / 77% at a fifth, a third, two fifths and half the duration. */
  const MORPH_MS = 320;
  const morphEase = (() => {
    const [p1x, p1y, p2x, p2y] = [0.4, 0.1, 0.25, 1];
    const A = (a, b) => 1 - 3 * b + 3 * a, B = (a, b) => 3 * b - 6 * a, C = (a) => 3 * a;
    const f = (t, a, b) => ((A(a, b) * t + B(a, b)) * t + C(a)) * t;
    const df = (t, a, b) => 3 * A(a, b) * t * t + 2 * B(a, b) * t + C(a);
    return (x) => {
      let t = x;
      for (let i = 0; i < 8; i++) {
        const d = df(t, p1x, p2x);
        if (Math.abs(d) < 1e-6) break;
        t -= (f(t, p1x, p2x) - x) / d;
      }
      return f(t, p1y, p2y);
    };
  })();

  /* ---- one switch, three things in motion --------------------------------
     A control that changes the QUESTION a chart is asking is the same gesture
     wherever it appears: the hero's matchup chips, preferred PM's two-way /
     three-way, approval's approval / favourability. In each the chart keeps
     its identity and changes its subject, so the lines should reshape, the
     dots cross over and the x window travel — the second view reading as the
     first one rearranged, and switching back rearranging it home. Written once
     here, because a switch that animates in one panel and cuts in the next
     reads as two different kinds of control.

     Honours prefers-reduced-motion by landing on the new view immediately. */
  function useMorph(value, apply, canMorph) {
    const [morph, setMorph] = React.useState(null);      // { from, to, t }
    const raf = React.useRef(0);
    const land = React.useRef(0);
    React.useEffect(() => () => { cancelAnimationFrame(raf.current); clearTimeout(land.current); }, []);
    const choose = (next) => {
      const from = value;
      apply(next);
      const still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (next === from || still || (canMorph && !canMorph(from, next))) { setMorph(null); return; }
      cancelAnimationFrame(raf.current); clearTimeout(land.current);
      const t0 = performance.now();
      setMorph({ from, to: next, t: 0 });
      const step = (now) => {
        const raw = Math.min(1, (now - t0) / MORPH_MS);
        if (raw >= 1) { setMorph(null); return; }         // land on the real thing
        setMorph({ from, to: next, t: morphEase(raw) });
        raf.current = requestAnimationFrame(step);
      };
      raf.current = requestAnimationFrame(step);
      /* A backstop, because frames are not guaranteed: a browser stops serving
         them to a hidden tab, and a morph whose driver stopped would leave the
         chart holding a half-interpolated shape that is not either answer.
         Whatever happens to the frames, the view lands on the truth. */
      land.current = setTimeout(() => { cancelAnimationFrame(raf.current); setMorph(null); },
                                MORPH_MS + 200);
    };
    return [morph, choose];
  }

  /* Two versions of one set of rows on ONE grid of months, so the paths carry
     the same shape of command and can be interpolated point for point. A month
     only one side runs in holds that side's nearest end value, and the clip
     window travels with the morph — so a line retreats to the months its new
     question was actually asked in rather than being drawn across months
     nobody polled. Rows are {ym, x, ...}; `keys` are the numeric fields to
     interpolate, and a key null on either side stays null. */
  function blendRows(A, B, t, keys) {
    if (!A.length || !B.length) return null;
    const lerp = (p, q) => p + (q - p) * t;
    const index = (arr) => { const o = {}; arr.forEach((d) => (o[d.ym] = d)); return o; };
    const ia = index(A), ib = index(B);
    /* What one side reads at a month it doesn't have a reading for. OUTSIDE its
       span it holds its nearest end — those months are clipped away anyway, and
       the clip is what makes the line grow and retreat. INSIDE its span it is
       interpolated between the readings either side: leadership series are
       gap-aware, so a month one question skipped is common, and holding the
       series' final value there put a spike in the middle of a line that was
       supposed to be bending into shape. */
    const readAt = (idx, arr, ym, x) => {
      const hit = idx[ym];
      if (hit) return hit;
      if (x <= arr[0].x) return arr[0];
      if (x >= arr[arr.length - 1].x) return arr[arr.length - 1];
      let i = 0;
      while (i < arr.length - 2 && arr[i + 1].x < x) i++;
      const a = arr[i], b = arr[i + 1], f = (x - a.x) / (b.x - a.x);
      const o = { ym, x };
      keys.forEach((k) => { o[k] = (a[k] == null || b[k] == null) ? null : a[k] + (b[k] - a[k]) * f; });
      return o;
    };
    const yms = [...new Set(A.concat(B).map((d) => d.ym))].sort();
    return {
      rows: yms.map((ym) => {
        const x = (ia[ym] || ib[ym]).x;
        const da = readAt(ia, A, ym, x), db = readAt(ib, B, ym, x);
        const o = { ym, x };
        keys.forEach((k) => {
          o[k] = (da[k] == null || db[k] == null) ? null : lerp(da[k], db[k]);
        });
        return o;
      }),
      /* The window this ONE line is allowed to draw in, travelling from its own
         span to its own. Per line, not per chart: Hanson is rated on
         favourability months before anyone asked about approving of her, and a
         single chart-wide window cannot express three different retreats — the
         lines whose span it did not describe simply appeared at full length. */
      clip: [lerp(A[0].x, B[0].x), lerp(A[A.length - 1].x, B[B.length - 1].x)],
    };
  }

  /* The dot clouds cross over. A reading that exists in BOTH views is one poll
     answering two questions — the same fieldwork asked differently — so its dot
     travels between the two positions and its colour goes with it. A reading
     with nowhere to travel to fades: most polls only ever answered one of the
     questions, and inventing a position for them would be drawing data nobody
     collected. Split three ways so only the travelling group is rebuilt per
     frame. `keyOf` decides what counts as the same reading; the first dot to
     claim a key keeps it. */
  function crossClouds(A, B, t, keyOf) {
    const claim = (arr) => {
      const m = new Map();
      arr.forEach((d) => { const k = keyOf(d); if (!m.has(k)) m.set(k, d); });
      return m;
    };
    const ia = claim(A), ib = claim(B);
    const travel = [], leaving = [], arriving = [];
    ia.forEach((d, k) => (ib.has(k) ? travel.push([d, ib.get(k)]) : leaving.push(d)));
    ib.forEach((d, k) => { if (!ia.has(k)) arriving.push(d); });
    return {
      scatter: arriving, scatterOut: leaving,
      scatterMove: travel.map(([a, b]) => ({
        x: a.x, y: a.y + (b.y - a.y) * t,
        color: mixC(a.color, b.color, t), label: b.label, meta: b.meta,
      })),
    };
  }

  /* Colour travel, in CSS rather than here, so it keeps resolving against
     whichever palette the theme is currently using — and round the hue circle
     rather than through grey, which is what an oklab mix of two party colours
     would do. */
  function mixC(c1, c2, t) {
    if (t <= 0 || c1 === c2) return c1;
    if (t >= 1) return c2;
    return "color-mix(in oklch shorter hue, " + c1 + ", " + c2 + " " + (t * 100).toFixed(1) + "%)";
  }

  // a [lo, hi] window on its way to another one
  const blendDomain = (from, to, t) => [from[0] + (to[0] - from[0]) * t,
                                        from[1] + (to[1] - from[1]) * t];

  return { D, rangeDomain, filterPts, buildXTicks, series, monthLabelFull, latestX,
           pollRowKey, morphEase, MORPH_MS, useMorph, blendRows, crossClouds, mixC, blendDomain,
           discord, discordFacet, discordRead, DISCORD_MEASURES, DISC };
})();
