/* auspol tracker – shared helpers */

/* React hook aliases – assigned to window HERE (this plain script loads before
   every component script) so no JSX file depends on another's load order for
   bare useState / useRef / etc. */
["useState", "useRef", "useMemo", "useCallback", "useEffect", "useId"]
  .forEach((h) => { window[h] = React[h]; });

/* Charts are SVGs with a fixed viewBox, so their rendered height is a function
   of the column they sit in: the 1000x420 box the hero draws at comes out about
   150px tall inside a 358px phone column, which is not enough room for a
   twenty-point band carrying 150 dots - the trend flattens into a smear. A
   media query cannot fix that, because the aspect ratio lives in the viewBox
   rather than in CSS, so the breakpoint has to reach the component and ask for
   a TALLER box instead of a scaled-down wide one. */
window.useNarrow = function useNarrow(query) {
  const q = query || "(max-width: 620px)";
  const [narrow, setNarrow] = React.useState(() =>
    typeof window !== "undefined" && window.matchMedia ? window.matchMedia(q).matches : false);
  React.useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mq = window.matchMedia(q);
    const on = (e) => setNarrow(e.matches);
    setNarrow(mq.matches);
    if (mq.addEventListener) { mq.addEventListener("change", on); return () => mq.removeEventListener("change", on); }
    mq.addListener(on); return () => mq.removeListener(on);
  }, [q]);
  return narrow;
};

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
window.useDismissOutside = function useDismissOutside(ref, open, onDismiss, ignoreSel) {
  const cb = React.useRef(onDismiss);
  cb.current = onDismiss;
  React.useEffect(() => {
    if (!open) return;
    const outside = (e) => {
      const el = ref && ref.current;
      if (el && e.target instanceof Node && el.contains(e.target)) return;
      if (ignoreSel && e.target instanceof Element && e.target.closest(ignoreSel)) return;
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
    // design effect – weighted online panels aren't simple random samples.
    // emitted by gen-data (HL_DEFF) in latest.method so the two engines can't
    // drift apart; the literal is only the pre-migration fallback
    DEFF: (D.latest && D.latest.method && D.latest.method.deff) || 1.6,
    ENGAGED: 0.90,   // assumed approve+disapprove share when a poll publishes only the net
    MIN_NEFF: 4, MIN_HOUSES: 3, MIN_STRAT: 3,
  };
  const OPP_SPLICE = "2026-02-13";   // Taylor replaces Ley – a different person, not a moved number
  const dayOf = (iso) => +new Date(iso) / 864e5;
  const metricOf = (p, id) => (p.appr && p.appr.metricBy && p.appr.metricBy[id]) || "approval";

  /* Each Labor contest on BOTH bases. The published figure spreads what
     each house prints – its own allocation, the habit herding lives in –
     and so covers only the waves that publish a pair; the implied figure
     (solid, the page's default basis) spreads every full-primary wave read
     through one shared flow table, so it is the houses disagreeing about
     the PRIMARIES, in 2PP units. A house can sit on the field on one and
     off it on the other. */
  const DISCORD_MEASURES = [
    { id: "tpp_alp_imp",   facet: "twopp", label: "ALP v L/NP (implied)",      color: "var(--alp)",
      val: (p) => p.alpImp, share: (p) => p.alpImp },
    { id: "tpp_alp",       facet: "twopp", label: "ALP v L/NP (as published)", color: "var(--alp)", dashed: true,
      val: (p) => p.alpN, share: (p) => p.alpN },
    { id: "tpp_alpon_imp", facet: "twopp", label: "ALP v ON (implied)",        color: "var(--onp)",
      val: (p) => p.alpOnImp, share: (p) => p.alpOnImp },
    { id: "tpp_alpon",     facet: "twopp", label: "ALP v ON (as published)",   color: "var(--onp)", dashed: true,
      val: (p) => (p.tppAlt ? p.tppAlt.alp : null), share: (p) => p.tppAlt.alp },
    { id: "p_alp",     facet: "primary",    label: "ALP",        color: "var(--alp)",
      val: (p) => p.p.alp, share: (p) => p.p.alp },
    { id: "p_lnp",     facet: "primary",    label: "L/NP",       color: "var(--lnp)",
      val: (p) => p.p.lnp, share: (p) => p.p.lnp },
    { id: "p_onp",     facet: "primary",    label: "ON",         color: "var(--onp)",
      val: (p) => p.p.onp, share: (p) => p.p.onp },
    { id: "p_grn",     facet: "primary",    label: "GRN",        color: "var(--grn)",
      val: (p) => p.p.grn, share: (p) => p.p.grn },
    { id: "net_alb",   facet: "leadership", label: "Albanese",   color: "var(--alp)", net: true,
      val: (p) => p.appr.albNet, stratum: (p) => metricOf(p, "alb") },
    // the opposition slot is an OFFICE: Ley's and Taylor's readings are never
    // pooled into one residual, or the February handover reads as a 12pp row
    { id: "net_opp",   facet: "leadership", label: "Opp. leader", color: "var(--lnp)", net: true,
      val: (p) => p.appr.taylorNet,
      stratum: (p) => metricOf(p, "taylor") + "|" + (p.released < OPP_SPLICE ? "ley" : "taylor") },
    { id: "net_han",   facet: "leadership", label: "Hanson",     color: "var(--onp)", net: true,
      val: (p) => p.appr.hansonNet, stratum: (p) => metricOf(p, "hanson") },
    /* The redesign's own three, under a facet no panel of the old design
       lists. The Coalition and One Nation primaries summed, to test whether
       the pollsters disagree on how the right's vote splits or on its size;
       and the two implied contests with the sampling floor of an implied
       figure: each respondent carries their party's flow to Labor, so the
       variance is that of the flows over the primaries, which p(1 − p)
       overstates by about a quarter. The flows are gen-data's (the 2025 count
       against the Coalition, the first-principles set against One Nation). */
    { id: "rd_right",   facet: "rd", label: "L/NP + ON", color: "var(--ink-2)",
      val: (p) => (p.p.lnp != null && p.p.onp != null ? p.p.lnp + p.p.onp : null), share: (p) => p.p.lnp + p.p.onp },
    { id: "rd_on_imp",  facet: "rd", label: "ALP v ON (implied)", color: "var(--onp)",
      val: (p) => p.alpOnImp, share: (p) => p.alpOnImp,
      flows: { alp: 1, lnp: 0.315, grn: 0.89, onp: 0, oth: 0.53 } },
    { id: "rd_lnp_imp", facet: "rd", label: "ALP v L/NP (implied)", color: "var(--lnp)",
      val: (p) => p.alpImp, share: (p) => p.alpImp,
      flows: { alp: 1, lnp: 0, grn: 0.8819, onp: 0.255, oth: 0.5455 } },
  ];
  /* the variance of a respondent's flow to Labor over a poll's primaries */
  const flowVar = (p, F) => {
    const q = p.p || {};
    if (["alp", "lnp", "grn", "onp"].some((k) => q[k] == null)) return null;
    let tot = 0, e1 = 0, e2 = 0;
    for (const k in F) tot += q[k] || 0;
    if (!tot) return null;
    for (const k in F) { const s = (q[k] || 0) / tot; e1 += s * F[k]; e2 += s * F[k] * F[k]; }
    return Math.max(0, e2 - e1 * e1);
  };

  function discordPoints(m) {
    const pts = [];
    D.individualPolls.forEach((p) => {
      const y = m.val(p);
      if (y == null) return;
      const n = p.sample || 1000;
      // a net is a DIFFERENCE of two proportions, so its sampling variance is
      // (approve + disapprove − net²)/n – wider than a single share's
      const fv = m.flows ? flowVar(p, m.flows) : null;
      const sv = m.net
        ? (DISC.DEFF * (DISC.ENGAGED - (y / 100) * (y / 100)) / n) * 1e4
        : fv != null ? (DISC.DEFF * fv / n) * 1e4
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

     The direction-only catalogues join the key set (SEC Newgate's waves and
     Essential's three national-mood-only waves of 2025) now that they are
     rows of their own on the archive table's direction facet - a dot with a
     row to land on gets the "open this poll" trip; a key outside the set
     still reads null, so a chart can ask before it offers one. */
  const ROW_KEYS = new Set([...D.individualPolls, ...(D.directionOnlyPolls || [])]
    .map((p) => p.pollster + "|" + p.released));
  const pollRowKey = (m) => {
    if (!m || !m.pollster || !m.released) return null;
    const k = m.pollster + "|" + m.released;
    return ROW_KEYS.has(k) ? k : null;
  };

  /* ONE motion curve and ONE duration for every transition that moves data
     rather than chrome: the matchup morph in the hero, the digit reels (which
     animate it in CSS - template.html's --morph-ease is this same curve), and
     the chart's own travelling x window. They were on separate curves once and
     it showed: a figure whose colour crawled on one ease while its digits
     crawled on another read as sticking.

     An ease-out that is moving from the first frame: 12% of the way after one
     frame, a quarter after two, half by 70ms, and it settles without a tail.
     The curve it replaced accelerated first - 2% after one frame, 5% after
     two - so every switch sat still for the first 50ms after a press and
     read as lag. The top speed is the same (13% of the distance per frame). */
  const MORPH_MS = 320;
  const MORPH_BEZ = [0.3, 0.7, 0.3, 1];
  const MORPH_CSS = "cubic-bezier(" + MORPH_BEZ.join(", ") + ")";
  const morphEase = (() => {
    const [p1x, p1y, p2x, p2y] = MORPH_BEZ;
    const A = (a, b) => 1 - 3 * b + 3 * a, B = (a, b) => 3 * b - 6 * a, C = (a) => 3 * a;
    const f = (t, a, b) => ((A(a, b) * t + B(a, b)) * t + C(a)) * t;
    const df = (t, a, b) => 3 * A(a, b) * t * t + 2 * B(a, b) * t + C(a);
    return (x) => {
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

  /* The clock every data switch runs on.

     The press's own render already carries the first frame of motion: by the
     time it reaches the screen a frame has passed, so the clock starts one
     frame back and the first thing the reader sees is the chart moving, not
     a repeat of the picture they pressed. It used to open on t = 0 - an
     unchanged frame - and then ease in, which was 50ms of nothing.

     Each later frame is rendered INSIDE its animation frame (flushSync), so
     the frame the browser paints is the one just computed. Left to React's
     scheduler, the update rendered in a task after that paint - a frame late,
     and split across two tasks that a phone could not fit into one frame.
     Progress never runs backwards, whatever the timestamps do.

     `frame(t)` sets the state for eased progress t, `land()` the settled
     view; `from` (0..1) resumes part-way, for a switch reversed mid-flight.
     Returns the t to render with now. */
  const FRAME_MS = 1000 / 60;
  function morphClock(raf, frame, land, from) {
    cancelAnimationFrame(raf.current);
    const start = Math.min(1, (from || 0) + FRAME_MS / MORPH_MS);
    const t0 = performance.now() - start * MORPH_MS;
    let last = start;
    const flush = window.ReactDOM && window.ReactDOM.flushSync ? window.ReactDOM.flushSync : (fn) => fn();
    const step = (now) => {
      const raw = Math.max(last, Math.min(1, (now - t0) / MORPH_MS));
      last = raw;
      if (raw >= 1) { raf.current = 0; flush(land); return; }
      flush(() => frame(morphEase(raw)));
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return { t: morphEase(start), raw: start };
  }
  /* Where a running switch is, as raw time (0..1) rather than eased progress,
     so a reversal can pick the clock up at the matching point. */
  const morphRawOf = (t) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    let lo = 0, hi = 1;
    for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2; if (morphEase(mid) < t) lo = mid; else hi = mid; }
    return (lo + hi) / 2;
  };

  /* ---- one switch, three things in motion --------------------------------
     A control that changes the QUESTION a chart is asking is the same gesture
     wherever it appears: the hero's matchup chips, preferred PM's two-way /
     three-way, approval's approval / favourability. In each the chart keeps
     its identity and changes its subject, so the lines should reshape, the
     dots cross over and the x window travel — the second view reading as the
     first one rearranged, and switching back rearranging it home. Written once
     here, because a switch that animates in one panel and cuts in the next
     reads as two different kinds of control.

     A switch pressed again mid-flight: straight back to where it came from
     reverses from the point it had reached, since a blend of A into B at t is
     B into A at 1 - t, so nothing jumps. On to a third view, the new switch
     starts from whichever of the two views the chart was nearer.

     Honours prefers-reduced-motion by landing on the new view immediately. */
  function useMorph(value, apply, canMorph) {
    const [morph, setMorph] = React.useState(null);      // { from, to, t }
    const raf = React.useRef(0);
    const land = React.useRef(0);
    const live = React.useRef(null);                      // the morph on screen
    React.useEffect(() => () => { cancelAnimationFrame(raf.current); clearTimeout(land.current); }, []);
    const put = (m) => { live.current = m; setMorph(m); };
    const choose = (next) => {
      const cur = live.current;
      let from = value, resume = 0;
      if (cur && next === cur.from) { from = cur.to; resume = morphRawOf(1 - cur.t); }
      else if (cur && cur.t < 0.5 && next !== cur.to) from = cur.from;
      apply(next);
      cancelAnimationFrame(raf.current);
      clearTimeout(land.current);
      if (next === from || reduceMotion() || (canMorph && !canMorph(from, next))) { put(null); return; }
      const c = morphClock(raf, (t) => put({ from, to: next, t }), () => put(null), resume);
      put({ from, to: next, t: c.t });
      /* A backstop, because frames are not guaranteed: a browser stops serving
         them to a hidden tab, and a morph whose driver stopped would leave the
         chart holding a half-interpolated shape that is not either answer.
         Whatever happens to the frames, the view lands on the truth. */
      land.current = setTimeout(() => { cancelAnimationFrame(raf.current); put(null); },
                                (1 - c.raw) * MORPH_MS + 200);
    };
    return [morph, choose];
  }

  /* The same switch for a chart that doesn't own the control: the value it
     draws (the page's contest, the table's basis) arrives as a prop, and when
     it changes the chart morphs from the old value's picture to the new one.
     The change is seen DURING the render that carries it, so that render is
     already the switch's first frame - a chart that waited for an effect
     would paint the new picture once, whole, before starting to move to it.
     Returns { from, to, t } while a switch runs, else null; pressed back
     mid-flight it reverses from where it was, as useMorph does. */
  function useValueMorph(value) {
    const st = React.useRef({ value, morph: null });
    const raf = React.useRef(0);
    const land = React.useRef(0);
    const [, force] = React.useReducer((x) => x + 1, 0);
    const s = st.current;
    if (value !== s.value) {
      const cur = s.morph;
      let from = s.value, resume = 0;
      if (cur && value === cur.from) { from = cur.to; resume = morphRawOf(1 - cur.t); }
      else if (cur && cur.t < 0.5 && value !== cur.to) from = cur.from;
      s.value = value;
      const start = Math.min(1, resume + FRAME_MS / MORPH_MS);
      s.morph = reduceMotion() || from === value ? null : { from, to: value, t: morphEase(start), resume, pending: true };
    }
    React.useLayoutEffect(() => {
      const m = st.current.morph;
      if (!m || !m.pending) return;
      m.pending = false;
      clearTimeout(land.current);
      morphClock(raf, (t) => { if (st.current.morph === m) { m.t = t; force(); } },
                 () => { if (st.current.morph === m) { st.current.morph = null; force(); } }, m.resume);
      land.current = setTimeout(() => {
        cancelAnimationFrame(raf.current);
        if (st.current.morph === m) { st.current.morph = null; force(); }
      }, (1 - m.resume) * MORPH_MS + 200);
    });
    React.useEffect(() => () => { cancelAnimationFrame(raf.current); clearTimeout(land.current); }, []);
    const m = st.current.morph;
    return m ? { from: m.from, to: m.to, t: m.t } : null;
  }

  /* A clock for a chart that morphs from whatever it last DREW to what its
     props now say, whenever `key` (what the reader chose) changes: the
     component keeps its own snapshot of the picture on screen, so a second
     press mid-flight simply starts again from there. Returns { t, n } while
     running (n counts the switches, so the component can tell a new one
     began), else null. */
  /* `ref`, if given, is the element the clock animates: one that is off the
     screen when its key changes lands at once, since nobody would see the
     morph and a page of charts morphing unseen costs the frames of the one
     that is seen. Whether it is on screen is kept by an IntersectionObserver
     rather than measured at the press: measuring then forced a layout of the
     whole page inside the click (7ms on a desktop, four times that on a
     slow phone). */
  function useKeyClock(key, ref) {
    const st = React.useRef({ key, n: 0, run: null });
    const raf = React.useRef(0), land = React.useRef(0);
    const seen = React.useRef(true);
    const [, force] = React.useReducer((x) => x + 1, 0);
    const s = st.current;
    if (key !== s.key) {
      s.key = key;
      s.n++;
      s.run = reduceMotion() || !seen.current ? null : { t: morphEase(FRAME_MS / MORPH_MS), n: s.n, pending: true };
    }
    React.useEffect(() => {
      const el = ref && ref.current;
      if (!el || !window.IntersectionObserver) return undefined;
      const io = new IntersectionObserver((es) => { es.forEach((e) => { seen.current = e.isIntersecting; }); });
      io.observe(el);
      return () => io.disconnect();
    }, [ref]);
    React.useLayoutEffect(() => {
      const r = st.current.run;
      if (!r || !r.pending) return;
      r.pending = false;
      clearTimeout(land.current);
      morphClock(raf, (t) => { if (st.current.run === r) { r.t = t; force(); } },
                 () => { if (st.current.run === r) { st.current.run = null; force(); } });
      land.current = setTimeout(() => { cancelAnimationFrame(raf.current); if (st.current.run === r) { st.current.run = null; force(); } }, MORPH_MS + 200);
    });
    React.useEffect(() => () => { cancelAnimationFrame(raf.current); clearTimeout(land.current); }, []);
    return s.run ? { t: s.run.t, n: s.run.n } : null;
  }

  /* One chart's picture - its lines, bands, dots and window - blended from
     one it drew to one it is about to draw. Lines and bands are matched by
     id and reshape (blendRows); a line or band with no counterpart fades;
     dots cross over (crossClouds, by `dotKey`). Points are {x, y}. */
  /* A point's month as a key that sorts as its number does: the rows are
     lined up by sorting their keys as text, and a bare decimal sorts 10
     before 2 - which zig-zagged every line and band back and forth across
     the chart. Each points array is turned into rows once and kept, so the
     alignment (itself kept per pair of row arrays) is worked out once per
     switch rather than on every frame. */
  const sceneYm = (x) => String(Math.round((x + 1e4) * 1e4)).padStart(12, "0");
  const sceneRows = new WeakMap();
  const rowsOfPts = (pts, area) => {
    let r = sceneRows.get(pts);
    if (!r) {
      r = area ? pts.filter((p) => p.y0 != null && p.y1 != null).map((p) => ({ ym: sceneYm(p.x), x: p.x, y0: p.y0, y1: p.y1 }))
        : pts.filter((p) => p.y != null).map((p) => ({ ...p, ym: sceneYm(p.x) }));
      sceneRows.set(pts, r);
    }
    return r;
  };
  function blendScene(A, B, t, dotKey) {
    const rows = (pts) => rowsOfPts(pts, false);
    const byId = (arr) => new Map((arr || []).map((s) => [s.id, s]));
    const lerp = (a, b) => a + (b - a) * t;
    const sa = byId(A.series), sb = byId(B.series);
    const series = [];
    (B.series || []).forEach((s) => {
      const a = sa.get(s.id);
      if (!a) { series.push({ ...s, opacity: (s.opacity != null ? s.opacity : 1) * t, endLabelOpacity: (s.endLabelOpacity != null ? s.endLabelOpacity : 1) * t }); return; }
      const bl = a.points.length && s.points.length ? blendRows(rows(a.points), rows(s.points), t, ["y"]) : null;
      const oa = a.opacity != null ? a.opacity : 1, ob = s.opacity != null ? s.opacity : 1;
      series.push({ ...s, points: bl ? bl.rows.map((r) => ({ x: r.x, y: r.y })) : s.points, clipX: bl ? bl.clip : s.clipX,
                    opacity: lerp(oa, ob), endCap: s.endCap });
    });
    (A.series || []).forEach((a) => {
      if (sb.has(a.id)) return;
      series.push({ ...a, opacity: (a.opacity != null ? a.opacity : 1) * (1 - t), endLabelOpacity: (a.endLabelOpacity != null ? a.endLabelOpacity : 1) * (1 - t) });
    });
    const aa = byId(A.areas), ab = byId(B.areas);
    const areas = [];
    (B.areas || []).forEach((z) => {
      const a = aa.get(z.id);
      if (!a) { areas.push({ ...z, fade: t }); return; }
      const toRows = (pts) => rowsOfPts(pts, true);
      const bl = a.points.length && z.points.length ? blendRows(toRows(a.points), toRows(z.points), t, ["y0", "y1"]) : null;
      areas.push({ ...z, points: bl ? bl.rows.filter((r) => r.y0 != null && r.y1 != null).map((r) => ({ x: r.x, y0: r.y0, y1: r.y1 })) : z.points, clipX: bl ? bl.clip : z.clipX });
    });
    (A.areas || []).forEach((a) => { if (!ab.has(a.id)) areas.push({ ...a, fade: 1 - t }); });
    const cross = crossClouds(A.scatter || [], B.scatter || [], t, dotKey);
    return { series, areas, scatter: cross.scatter, scatterOut: cross.scatterOut, scatterMove: cross.scatterMove,
             domain: blendDomain(A.domain, B.domain, t) };
  }

  /* Two versions of one set of rows on ONE grid of months, so the paths carry
     the same shape of command and can be interpolated point for point. A month
     only one side runs in holds that side's nearest end value, and the clip
     window travels with the morph — so a line retreats to the months its new
     question was actually asked in rather than being drawn across months
     nobody polled. Rows are {ym, x, ...}; `keys` are the numeric fields to
     interpolate, and a key null on either side stays null - except an
     interval ("ci", "ci95", "ci_alp"...), which one side lacking is read as
     no width there, so a band grows out of its line or thins back into it.
     Held to "both sides or nothing", a band covering months the other view
     had no interval for appeared or vanished whole on the frame the switch
     landed. */
  const softKey = (k) => /^ci/.test(k);

  /* A reading one side doesn't have, inside its span, is read off the curve
     that side is DRAWN with - the redesign's monotone cubic, the old design's
     spline - not off a straight chord between its neighbours. The blend adds
     that month to the line's points; read off a chord, the extra point bent
     the line away from the shape it lands on, and the gap months snapped by
     several pixels on the switch's last frame. On the drawn curve the extra
     point sits where the line already runs. */
  const monoTangents = (xs, ys) => {
    const n = xs.length, h = [], s = [], m = new Array(n).fill(0);
    for (let i = 0; i < n - 1; i++) { h[i] = xs[i + 1] - xs[i]; s[i] = h[i] ? (ys[i + 1] - ys[i]) / h[i] : 0; }
    const sign = (v) => (v > 0) - (v < 0);
    for (let i = 1; i < n - 1; i++) {
      const q = (s[i - 1] * h[i] + s[i] * h[i - 1]) / (h[i - 1] + h[i] || 1);
      m[i] = (sign(s[i - 1]) + sign(s[i])) * Math.min(Math.abs(s[i - 1]), Math.abs(s[i]), 0.5 * Math.abs(q)) || 0;
    }
    if (n > 2) { m[0] = (3 * s[0] - m[1]) / 2; m[n - 1] = (3 * s[n - 2] - m[n - 2]) / 2; }
    return m;
  };
  /* the curve through one key's non-null readings, as a function of x (or
     through any readings `pick` returns a value for) */
  const curveOf = (arr, k, pick) => {
    const xs = [], ys = [];
    arr.forEach((d) => { const v = pick ? pick(d) : d[k]; if (v != null) { xs.push(d.x); ys.push(v); } });
    const n = xs.length, mono = !!(window.AP && window.AP.rd);
    const m = mono && n > 2 ? monoTangents(xs, ys) : null;
    return (x) => {
      if (!n || x < xs[0] || x > xs[n - 1]) return null;
      let i = 0;
      while (i < n - 2 && xs[i + 1] < x) i++;
      if (n === 1) return ys[0];
      const h = xs[i + 1] - xs[i];
      if (!h) return ys[i];
      const u = (x - xs[i]) / h, u2 = u * u, u3 = u2 * u;
      if (n === 2) return ys[0] + (ys[1] - ys[0]) * u;
      if (m) return (2 * u3 - 3 * u2 + 1) * ys[i] + (u3 - 2 * u2 + u) * h * m[i]
        + (-2 * u3 + 3 * u2) * ys[i + 1] + (u3 - u2) * h * m[i + 1];
      /* The old design's Catmull-Rom spline (charts' smoothPath) is a Bezier
         in x as well as y, and x runs evenly along it only where the months
         either side are evenly spaced - not at a line's two ends, nor across
         a month a question skipped. So the point on the curve AT x is found
         first (x rises along the segment, so halving the interval finds it),
         and y read there: taking u as the fraction of the way across put the
         in-between readings off the drawn line, and a leader's lines and
         bands shifted a few pixels as the switch landed. */
      const y0 = ys[i - 1] != null ? ys[i - 1] : ys[i], y3 = ys[i + 2] != null ? ys[i + 2] : ys[i + 1];
      const x0 = xs[i - 1] != null ? xs[i - 1] : xs[i], x3 = xs[i + 2] != null ? xs[i + 2] : xs[i + 1];
      const c1 = ys[i] + (ys[i + 1] - y0) / 6, c2 = ys[i + 1] - (y3 - ys[i]) / 6;
      const k1 = xs[i] + (xs[i + 1] - x0) / 6, k2 = xs[i + 1] - (x3 - xs[i]) / 6;
      const bez = (a, b, c, d, w) => { const q = 1 - w; return q * q * q * a + 3 * q * q * w * b + 3 * q * w * w * c + w * w * w * d; };
      let lo = 0, hi = 1, w = u;
      for (let it = 0; it < 30; it++) {
        if (bez(xs[i], k1, k2, xs[i + 1], w) < x) lo = w; else hi = w;
        w = (lo + hi) / 2;
      }
      return bez(ys[i], c1, c2, ys[i + 1], w);
    };
  };

  /* The months of two views lined up, each side's reading at each - worked
     out once per pair of views and kept, since a switch asks for the same
     pair on every frame and only the mix changes.

     Between the months the blend carries SUBSTEPS readings more, each taken
     off the curve its side is drawn with. A blended line drawn through the
     months alone was a different curve from either view's: a month one view
     skipped, or the flat run a view holds before it starts, changed the
     curve's bend at its neighbours, so the first and last frames of a switch
     were not the charts it went from and to, and the line snapped as it
     landed. Drawn through its own curve, densely, each end of the blend IS
     that view's line. The in-between readings carry `mid`, so a spine or a
     readout can skip them. */
  const SUBSTEPS = 4;
  const alignMemo = new WeakMap();
  function alignRows(A, B, keys) {
    const kk = keys.join(",") + (window.AP && window.AP.rd ? "|m" : "|c");
    let byB = alignMemo.get(A);
    if (!byB) { byB = new WeakMap(); alignMemo.set(A, byB); }
    const hit = byB.get(B);
    if (hit && hit.kk === kk) return hit;
    const index = (arr) => { const o = {}; arr.forEach((d) => (o[d.ym] = d)); return o; };
    const ia = index(A), ib = index(B);
    /* An interval is drawn as a band whose two EDGES are curves of their own,
       through each month's value plus and minus its width - not the line's
       curve plus the width's curve, which bend differently. So each interval
       also gets its edges read off those edge curves (`<key>Lo`, `<key>Hi`),
       collapsing onto the line where that side has no width; a band drawn
       from them is, at each end of a switch, the band that view draws. */
    const soft = keys.filter(softKey);
    const centreOf = (k) => (/^ci_/.test(k) ? k.slice(3) : keys.find((c) => !softKey(c)));
    const curves = (arr) => {
      const c = {};
      keys.forEach((k) => { c[k] = curveOf(arr, k); });
      soft.forEach((k) => {
        const cen = centreOf(k);
        if (!cen) return;
        const w = (d) => (d[k] != null && d[k] > 0 && d[cen] != null ? d[k] : null);
        c[k + "Hi"] = curveOf(arr, null, (d) => (w(d) == null ? null : d[cen] + d[k]));
        c[k + "Lo"] = curveOf(arr, null, (d) => (w(d) == null ? null : d[cen] - d[k]));
        c[k + "C"] = cen;
      });
      return c;
    };
    const ca = curves(A), cb = curves(B);
    /* What one side reads where it has no reading. OUTSIDE its span it holds
       its nearest end - those stretches are clipped away, and the clip is what
       makes the line grow and retreat. INSIDE, it is read off its own curve:
       leadership series are gap-aware, so a month one question skipped is
       common, and holding the last value there put a spike in the middle of a
       line that was supposed to be bending into shape. */
    const readAt = (idx, arr, cv, ym, x) => {
      const row = ym && idx[ym];
      const held = !row && (x <= arr[0].x ? arr[0] : x >= arr[arr.length - 1].x ? arr[arr.length - 1] : null);
      const o = row || held ? { ...(row || held) } : { x };
      if (!row && !held) keys.forEach((k) => { o[k] = cv[k](x); });
      soft.forEach((k) => {
        const cen = cv[k + "C"];
        if (!cen) return;
        const at = held ? held.x : x;
        const hi = cv[k + "Hi"](at), lo = cv[k + "Lo"](at);
        // no width there: the band closes onto its line
        o[k + "Hi"] = hi != null ? hi : o[cen];
        o[k + "Lo"] = lo != null ? lo : o[cen];
      });
      return o;
    };
    const months = [...new Set(A.concat(B).map((d) => d.ym))].sort()
      .map((ym) => ({ ym, x: (ia[ym] || ib[ym]).x }));
    const pairs = [];
    months.forEach((m, i) => {
      pairs.push({ ym: m.ym, x: m.x, da: readAt(ia, A, ca, m.ym, m.x), db: readAt(ib, B, cb, m.ym, m.x) });
      const n = months[i + 1];
      if (!n) return;
      for (let j = 1; j < SUBSTEPS; j++) {
        const x = m.x + ((n.x - m.x) * j) / SUBSTEPS;
        pairs.push({ x, mid: true, da: readAt(ia, A, ca, null, x), db: readAt(ib, B, cb, null, x) });
      }
    });
    /* An interval's own reach, which can be shorter than its line's (a month
       with no width - an election result - carries no band), so a band
       travels in its own window rather than its line's. */
    const reach = (arr, k) => {
      const on = arr.filter((d) => d[k] != null && d[k] > 0);
      return on.length ? [on[0].x, on[on.length - 1].x] : null;
    };
    const reaches = {};
    keys.filter(softKey).forEach((k) => { reaches[k] = [reach(A, k), reach(B, k)]; });
    const out = { kk, pairs, reaches, a0: A[0].x, a1: A[A.length - 1].x, b0: B[0].x, b1: B[B.length - 1].x };
    byB.set(B, out);
    return out;
  }
  function blendRows(A, B, t, keys) {
    if (!A.length || !B.length) return null;
    const lerp = (p, q) => p + (q - p) * t;
    const al = alignRows(A, B, keys);
    const clip = [lerp(al.a0, al.b0), lerp(al.a1, al.b1)];
    const clips = {};
    Object.keys(al.reaches).forEach((k) => {
      const [ra, rb] = al.reaches[k];
      clips[k] = ra && rb ? [lerp(ra[0], rb[0]), lerp(ra[1], rb[1])] : clip;
    });
    return {
      rows: al.pairs.map(({ ym, x, mid, da, db }) => {
        const o = mid ? { x, mid } : { ym, x };
        keys.forEach((k) => {
          o[k] = (da[k] == null || db[k] == null)
            ? (softKey(k) && (da[k] != null || db[k] != null) ? lerp(da[k] || 0, db[k] || 0) : null)
            : lerp(da[k], db[k]);
          if (softKey(k)) ["Hi", "Lo"].forEach((e) => {
            const p = da[k + e], q = db[k + e];
            if (p != null && q != null) o[k + e] = lerp(p, q);
          });
        });
        return o;
      }),
      /* The window this ONE line is allowed to draw in, travelling from its own
         span to its own. Per line, not per chart: Hanson is rated on
         favourability months before anyone asked about approving of her, and a
         single chart-wide window cannot express three different retreats — the
         lines whose span it did not describe simply appeared at full length.
         `clips` holds each interval's window the same way. */
      clip, clips,
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
  const crossMemo = new WeakMap();
  function crossClouds(A, B, t, keyOf) {
    /* kept per pair of clouds: a switch asks for the same pair every frame
       (each call site keys its own clouds one way, so the pair decides it) */
    let byB = crossMemo.get(A), hit = byB && byB.get(B);
    if (!hit) {
      const claim = (arr) => {
        const m = new Map();
        arr.forEach((d) => { const k = keyOf(d); if (!m.has(k)) m.set(k, d); });
        return m;
      };
      const ia = claim(A), ib = claim(B);
      const travel = [], leaving = [], arriving = [];
      ia.forEach((d, k) => (ib.has(k) ? travel.push([d, ib.get(k)]) : leaving.push(d)));
      ib.forEach((d, k) => { if (!ia.has(k)) arriving.push(d); });
      hit = { travel, leaving, arriving };
      if (!byB) { byB = new WeakMap(); crossMemo.set(A, byB); }
      byB.set(B, hit);
    }
    const { travel, leaving, arriving } = hit;
    return {
      scatter: arriving, scatterOut: leaving,
      scatterMove: travel.map(([a, b]) => ({
        x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t,
        color: mixC(a.color, b.color, t), label: b.label, meta: b.meta, shape: b.shape,
        op: a.op != null || b.op != null ? (a.op != null ? a.op : 1) + ((b.op != null ? b.op : 1) - (a.op != null ? a.op : 1)) * t : undefined,
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
           pollRowKey, morphEase, MORPH_MS, MORPH_CSS, morphClock, morphRawOf, reduceMotion, useMorph, useValueMorph,
           useKeyClock, blendScene,
           blendRows, crossClouds, mixC, blendDomain,
           discord, discordFacet, discordRead, DISCORD_MEASURES, DISC };
})();
