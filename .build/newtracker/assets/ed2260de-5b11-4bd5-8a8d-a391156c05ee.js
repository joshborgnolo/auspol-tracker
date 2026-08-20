/* auspol tracker — shared helpers */

/* React hook aliases — assigned to window HERE (this plain script loads before
   every component script) so no JSX file depends on another's load order for
   bare useState / useRef / etc. */
["useState", "useRef", "useMemo", "useCallback", "useEffect", "useId"]
  .forEach((h) => { window[h] = React[h]; });

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
      const label = mo === 1 || (m === months[0])
        ? `${D.monthName(mo)} '${String(y).slice(2)}`
        : D.monthName(mo);
      return { x: m.x, label };
    });
  }

  function series(points, key) { return points.map((d) => ({ x: d.x, y: d[key] })); }

  function monthLabelFull(ym) {
    const [y, m] = ym.split("-").map(Number);
    return `${D.monthName(m)} ${y}`;
  }

  /* ---- Poll discord — "how much do the polls disagree?" ----------------
     Raw spread between polls is not the interesting quantity: even
     perfectly-agreeing houses scatter, because each one is a sample.  So
     every measure reports three numbers at each point in time:

       sigma   weighted SD of poll residuals about a LOCAL LINEAR trend
               through the window (pp).  Linear rather than a flat mean —
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
    DEFF: 1.6,       // design effect — weighted online panels aren't simple random samples
    ENGAGED: 0.90,   // assumed approve+disapprove share when a poll publishes only the net
    MIN_NEFF: 4, MIN_HOUSES: 3, MIN_STRAT: 3,
  };
  const OPP_SPLICE = "2026-02-13";   // Taylor replaces Ley — a different person, not a moved number
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
      // (approve + disapprove − net²)/n — wider than a single share's
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
      // a window that thin can't tell disagreement from luck — leave a gap
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

  // the ratio's plain-English read — band edges live here, once
  function discordRead(R) {
    if (R == null) return { id: "na", label: "not enough polls", verb: "—" };
    if (R < 0.8) return { id: "herded", label: "herded", verb: "tighter than chance allows" };
    if (R < 1.2) return { id: "chance", label: "chance-consistent", verb: "as close as sampling allows" };
    if (R < 1.6) return { id: "mild", label: "mild divergence", verb: "a little further apart than chance" };
    return { id: "wide", label: "real disagreement", verb: "far beyond sampling error" };
  }

  return { D, rangeDomain, filterPts, buildXTicks, series, monthLabelFull, latestX,
           discord, discordFacet, discordRead, DISCORD_MEASURES, DISC };
})();
