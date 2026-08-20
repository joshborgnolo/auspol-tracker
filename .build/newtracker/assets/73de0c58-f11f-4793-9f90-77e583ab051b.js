/* auspol — header, hero, page assembly */

// relative freshness for the "last updated" stamp
function freshness(iso) {
  const then = new Date(iso + "T00:00:00");
  const now = new Date();
  const days = Math.max(0, Math.round((now - then) / 86400000));
  let label;
  if (days === 0) label = "today";
  else if (days === 1) label = "yesterday";
  else if (days < 14) label = days + " days ago";
  else if (days < 56) label = Math.round(days / 7) + " weeks ago";
  else label = Math.round(days / 30) + " months ago";
  const state = days <= 7 ? "fresh" : days <= 21 ? "aging" : "stale";
  return { label, state };
}

function Header({ isDark, onToggleTheme }) {
  const { D } = window.AP;
  const fresh = freshness(D.latest.updatedISO);

  // wordmark glyph = live primary-vote aggregate: one bar per party,
  // sorted tallest-first, height scaled to each party's latest share
  const lp = D.aggPrimary[D.aggPrimary.length - 1];
  const glyph = [
    { id: "alp", color: "var(--alp)", v: lp.alp },
    { id: "lnp", color: "var(--lnp)", v: lp.lnp },
    { id: "grn", color: "var(--grn)", v: lp.grn },
    { id: "onp", color: "var(--onp)", v: lp.onp },
  ].sort((a, b) => b.v - a.v);
  const gv = glyph.map((p) => p.v);
  const gmin = Math.min(...gv), gmax = Math.max(...gv);
  const MIN_H = 5, MAX_H = 10.5;
  glyph.forEach((p) => {
    p.h = gmax === gmin ? MAX_H : MIN_H + ((p.v - gmin) / (gmax - gmin)) * (MAX_H - MIN_H);
  });
  const glyphTitle = "Primary vote aggregate · " +
    glyph.map((p) => `${D.PARTIES[p.id].short} ${p.v.toFixed(1)}`).join(", ");

  // pendulum = the head-to-head against Labor's STRONGEST challenger — the same
  // pick the hero makes: whichever opponent polls the highest 2PP against Labor.
  // The needle swings toward whoever leads THAT contest (Labor left, challenger right).
  const g2 = D.agg2pp[D.agg2pp.length - 1];
  const gon = D.alt2pp.alp_on[D.alt2pp.alp_on.length - 1];
  const challengers = [
    { abbr: "L/NP", color: "var(--lnp)", lab: g2.alp, opp: g2.lnp },
  ];
  if (gon) challengers.push({ abbr: "ON", color: "var(--onp)", lab: gon.a, opp: gon.b });
  const topOpp = challengers.slice().sort((x, y) => y.opp - x.opp)[0];
  const pMargin = +(topOpp.lab - topOpp.opp).toFixed(1);        // + → Labor leads
  const labLeads = pMargin >= 0;
  const pendColor = labLeads ? "var(--alp)" : topOpp.color;
  const oppColor = topOpp.color;
  // ±12 pts → full ±34° deflection. Labor (positive margin) swings LEFT,
  // the challenger swings RIGHT — matching the hero's Labor-left / opp-right order.
  const pendDeg = Math.max(-1, Math.min(1, pMargin / 12)) * 34;
  const pendTitle = `2PP swing · ALP v ${topOpp.abbr} · ` +
    (labLeads ? "Labor" : topOpp.abbr) + ` +${Math.abs(pMargin).toFixed(1)}`;

  // settle the needle in from vertical on load (skip the swing for reduced motion)
  const reduceMotion = typeof window !== "undefined" && window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [pendSettled, setPendSettled] = React.useState(reduceMotion);
  React.useEffect(() => {
    const t = setTimeout(() => setPendSettled(true), 220);
    return () => clearTimeout(t);
  }, [pendDeg]);
  // Needle points UP from the pivot, so the sign flips vs the old hanging
  // pendulum: NEGATIVE rotation swings the tip left (Labor side).
  const needleDeg = pendSettled ? -pendDeg : 0;

  // ---- integrated glyph geometry: one dial — party columns are radial
  // graduations on the arc, the 2PP needle swings from the same pivot ----
  const GC = { cx: 22, cy: 24.5, r: 12 };
  const polar = (deg, r) => ({
    x: +(GC.cx + Math.sin(deg * Math.PI / 180) * r).toFixed(2),
    y: +(GC.cy - Math.cos(deg * Math.PI / 180) * r).toFixed(2),
  });
  const BAR_ANGLES = [-54, -18, 18, 54];          // tallest-first, left → right
  const arcPath = (d1, d2) => {
    const a = polar(d1, GC.r), b = polar(d2, GC.r);
    return `M ${a.x} ${a.y} A ${GC.r} ${GC.r} 0 0 1 ${b.x} ${b.y}`;
  };

  return (
    <header className="site-head">
      <div className="brand">
        <h1 className="wordmark stacked">
          <span className="wm-textcol">
            <span className="wm-name"><span className="wm-aus">aus</span><span className="wm-poll">pol</span></span>
            <span className="wm-track">tracker</span>
          </span>
          <span className="wm-glyph" aria-hidden="true">
            <svg className="wm-dial" viewBox="0 0 44 28" width="40" height="25.5">
              <title>{glyphTitle + " · " + pendTitle}</title>
              {/* half-circle two-tone swing arc: Labor left, strongest challenger right */}
              <path d={arcPath(-90, 0)} className="wm-arc" stroke="var(--alp)"></path>
              <path d={arcPath(0, 90)} className="wm-arc" stroke={oppColor}></path>
              {/* party columns as radial graduations, heights = primary vote */}
              {glyph.map((p, i) => {
                const a = BAR_ANGLES[i];
                const inner = polar(a, GC.r + 2);
                const outer = polar(a, GC.r + 2 + p.h);
                return (
                  <line key={p.id} x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y}
                        stroke={p.color} strokeWidth="3.4" strokeLinecap="butt"></line>
                );
              })}
              {/* 2PP needle — swings toward the leader of the top contest.
                  Wrapped in a translate so rotation happens about local (0,0). */}
              <g transform={`translate(${GC.cx}, ${GC.cy})`}>
                <g className="wm-needle-g" style={{ transform: `rotate(${needleDeg}deg)` }}>
                  <line x1="0" y1="0" x2="0" y2="-8.6"
                        stroke={pendColor} strokeWidth="1.7" strokeLinecap="round"></line>
                  <circle cx="0" cy="-8.6" r="1.9" fill={pendColor}></circle>
                </g>
              </g>
              <circle cx={GC.cx} cy={GC.cy} r="1.7" className="wm-pivot"></circle>
            </svg>
          </span>
          <span className="wm-sr">— Australian federal polling tracker</span>
        </h1>
        <p className="tagline">Aggregated opinion polling for the 2028 Australian federal election</p>
        <div className="head-meta-compact" aria-hidden="true">
          <span className={"fresh-dot " + fresh.state}></span>
          Updated {D.latest.updated} · {D.latest.pollsTracked} polls
        </div>
      </div>
      <div className="head-right">
        <div className="head-meta">
          <div className="meta-item meta-updated">
            <span className="meta-k">Last updated</span>
            <span className="meta-v">
              <span className={"fresh-dot " + fresh.state} aria-hidden="true"></span>
              {D.latest.updated}
              <span className="fresh-rel">· {fresh.label}</span>
            </span>
          </div>
          <div className="meta-divide"></div>
          <div className="meta-item meta-election">
            <span className="meta-k">Next election</span>
            <span className="meta-v">{D.latest.nextElectionDue}</span>
          </div>
          <div className="meta-divide meta-divide-polls"></div>
          <div className="meta-item meta-polls">
            <span className="meta-k">Polls tracked</span>
            <span className="meta-v">{D.latest.pollsTracked} · {D.latest.housesTracked} pollsters</span>
          </div>
        </div>
        <div className="theme-seg segmented" role="group" aria-label="Colour theme">
          <button className={"seg-btn theme-cell" + (!isDark ? " active" : "")}
                  onClick={() => { if (isDark) onToggleTheme(); }}
                  aria-pressed={!isDark} aria-label="Light mode" title="Light mode">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
                 strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="4.2"></circle>
              <path d="M12 2.2v2.4M12 19.4v2.4M2.2 12h2.4M19.4 12h2.4M4.9 4.9l1.7 1.7M17.4 17.4l1.7 1.7M19.1 4.9l-1.7 1.7M6.6 17.4l-1.7 1.7"></path>
            </svg>
          </button>
          <button className={"seg-btn theme-cell" + (isDark ? " active" : "")}
                  onClick={() => { if (!isDark) onToggleTheme(); }}
                  aria-pressed={isDark} aria-label="Dark mode" title="Dark mode">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
                 strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20.5 14.2A8.2 8.2 0 0 1 9.8 3.5a8.2 8.2 0 1 0 10.7 10.7Z"></path>
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}

function Hero({ rangeId, setRangeId, showScatter = true }) {
  const { D, rangeDomain, filterPts, buildXTicks, series } = window.AP;
  const xDomain = rangeDomain(rangeId);

  // matchup config — each is a mirrored head-to-head 2PP.
  //   `real`    = the headline measure, which carries the weighted nowcast
  //   `scatter` = per-poll accessor. EVERY matchup here is built from figures
  //               pollsters actually published (the ALP v ON and L/NP v ON
  //               head-to-heads come from altTppRaw and their aggregate line is
  //               a mean of them), so all three plot their own readings — the
  //               only difference is how many houses ask the question.
  const MATCHUPS = {
    alp_lnp: {
      a: { name: "Labor", color: "var(--alp)" }, b: { name: "Coalition", color: "var(--lnp)" },
      data: D.agg2pp.map((d) => ({ ym: d.ym, x: d.x, a: d.alp, b: d.lnp })), real: true,
      label: "ALP v L/NP", dots: ["var(--alp)", "var(--lnp)"], vsLabor: true,
      // pairs that don't sum to 100 (undecided-inclusive) plot at alpN
      scatter: (p) => (p.alpN == null ? null : [
        { y: p.alpN, color: "var(--alp)", label: "ALP 2PP" },
        { y: +(100 - p.alpN).toFixed(1), color: "var(--lnp)", label: "L/NP 2PP" },
      ]),
    },
    alp_on: {
      a: { name: "Labor", color: "var(--alp)" }, b: { name: "One Nation", color: "var(--onp)" },
      data: D.alt2pp.alp_on, real: false, altKey: "alp_on",
      label: "ALP v ON", dots: ["var(--alp)", "var(--onp)"], vsLabor: true,
      scatter: (p) => (!p.tppAlt ? null : [
        { y: p.tppAlt.alp, color: "var(--alp)", label: "ALP v ON" },
        { y: p.tppAlt.onp, color: "var(--onp)", label: "ON v ALP" },
      ]),
    },
    lnp_on: {
      a: { name: "Coalition", color: "var(--lnp)" }, b: { name: "One Nation", color: "var(--onp)" },
      data: D.alt2pp.lnp_on, real: false, altKey: "lnp_on",
      label: "L/NP v ON", dots: ["var(--lnp)", "var(--onp)"], vsLabor: false,
      scatter: (p) => (!p.tppAlt2 ? null : [
        { y: p.tppAlt2.lnp, color: "var(--lnp)", label: "L/NP v ON" },
        { y: p.tppAlt2.onp, color: "var(--onp)", label: "ON v L/NP" },
      ]),
    },
  };

  // The REAL published measure (ALP v L/NP) always leads and is the default;
  // the modelled head-to-heads follow, strongest challenger first. Matchups
  // whose source series is too thin to draw (< 2 points) are dropped.
  const hasData = (id) => MATCHUPS[id].data.length >= 2;
  const oppVsLabor = (id) => {
    const last = MATCHUPS[id].data[MATCHUPS[id].data.length - 1];
    return last.b; // opponent's share in the Labor head-to-head
  };
  const orderedMatchups = [
    "alp_lnp",
    ...Object.keys(MATCHUPS).filter((id) => id !== "alp_lnp" && MATCHUPS[id].vsLabor && hasData(id))
       .sort((x, y) => oppVsLabor(y) - oppVsLabor(x)),
    ...Object.keys(MATCHUPS).filter((id) => !MATCHUPS[id].vsLabor && hasData(id)),
  ];
  const matchupOptions = orderedMatchups.map((id) => ({
    id, label: MATCHUPS[id].label, dots: MATCHUPS[id].dots,
  }));

  const [matchup, setMatchup] = useState(orderedMatchups[0]);
  const m = MATCHUPS[matchup];
  const pts = filterPts(m.data, xDomain[0]);
  // Headline readout: for the REAL ALP v L/NP measure this is the trailing
  // recency- + sample-weighted, house-effect-adjusted nowcast (D.latest) —
  // the same figure docked in the sticky tab bar — NOT the last monthly-mean
  // dot, so the two never disagree. The smoothed chart line stays the monthly
  // trend; a small gap between the line's end and this number is expected (a
  // nowcast leads the monthly mean). Modelled matchups have no separate
  // headline, so they read their last plotted point.
  // An alternative matchup gets a nowcast too WHERE the series supports one
  // (D.altLatest is null for a matchup too thin to weight). Otherwise it reads
  // its last monthly point, as before.
  const altL = (m.altKey && D.altLatest) ? D.altLatest[m.altKey] : null;
  const adjusted = m.real || !!(D.adjusted && m.altKey && D.adjusted[m.altKey]);
  const latest = m.real
    ? { a: D.latest.alp2pp, b: D.latest.lnp2pp }
    : altL || m.data[m.data.length - 1];

  // mirrored pairs, so each trend line sits inside its own cloud of readings.
  // Driven by the active matchup's own accessor — a poll that didn't publish
  // THIS head-to-head is simply skipped, which is why the ON matchups show
  // fewer dots rather than none.
  const scatter = !showScatter ? [] : D.individualPolls
    .filter((p) => p.x >= xDomain[0] && p.x <= xDomain[1])
    .flatMap((p) => {
      const pair = m.scatter(p);
      return pair ? pair.map((s) => ({ x: p.x, y: s.y, color: s.color, label: s.label, meta: p })) : [];
    });
  // how many polls are actually behind the cloud — stated in the caption, since
  // "9 houses ask this" is the honest caveat on a thinner matchup
  const scatterPolls = scatter.length / 2;

  // A trend line through four monthly means built on five polls from two houses
  // is a shape the data can't support — it reads as a trajectory when it's
  // really noise. Where the series is too thin to weight, plot the readings
  // only and let the reader see the scatter for what it is.
  const heroSeries = !adjusted ? [] : [
    { id: "a", label: m.a.name, color: m.a.color, points: series(pts, "a"), width: 3.6 },
    { id: "b", label: m.b.name, color: m.b.color, points: series(pts, "b"), width: 3.6 },
  ];
  // with no line there is nothing for a month-guide tooltip to report, so the
  // guide is switched off and the dots carry their own hovers
  const heroSpine = heroSeries.length ? series(pts, "a") : [];

  // Major events, clipped to the span this matchup actually plots. The headline
  // 2PP runs the whole archive so it keeps all of them; ALP v ON only begins
  // when pollsters started asking it, and a marker standing over a stretch with
  // no line would imply a reading that was never taken. A matchup with no trend
  // line at all gets none.
  const heroEvents = (!heroSeries.length || !pts.length) ? [] : (() => {
    const x0 = pts[0].x, x1 = pts[pts.length - 1].x;
    return (D.events || []).filter((e) => e.major && e.x >= x0 && e.x <= x1);
  })();

  // The majority line is labelled at the LEFT edge: the right edge is where both
  // trend lines terminate and their end-cap dots sit, so a label there landed in
  // the busiest part of the chart. The left edge is empty in every matchup.
  const heroRefLines = [{ y: 50, label: "50% — majority line", color: "var(--ink-faint)", align: "left" }];

  // y-window auto-fits the matchup spread — min/max taken across BOTH series
  // so the domain stays correct even if the challenger ever takes the lead
  const heroVals = m.data.flatMap((d) => [d.a, d.b]);
  const lo = Math.min(...heroVals), hi = Math.max(...heroVals);
  const pad6 = 6;
  const yDomain = [Math.floor((lo - pad6) / 5) * 5, Math.ceil((hi + pad6) / 5) * 5];
  const yTicks = [];
  for (let v = yDomain[0]; v <= yDomain[1]; v += 5) if (v > yDomain[0] && v < yDomain[1]) yTicks.push(v);
  const lead = +(latest.a - latest.b).toFixed(1);
  const leadName = lead >= 0 ? m.a.name : m.b.name;
  /* Uncertainty for whichever matchup is showing. Every nowcast on this hero
     is a weighted mean of a handful of polls, so none of them is exact — a
     matchup that switched from an interval to a bare number would read as the
     precise one. Null only where the series is too thin to nowcast at all,
     in which case the readout is a plain monthly point and says so. */
  const unc = m.real
    ? (D.latest.alp2ppCi95 != null
        ? { ci95: D.latest.alp2ppCi95, n: D.latest.method.nPolls, changeSig: D.latest.changeSig }
        : null)
    : (altL && altL.ci95 != null
        ? { ci95: altL.ci95, n: altL.n, changeSig: altL.changeSig }
        : null);
  const monthDelta = m.real ? +(D.latest.alp2pp - D.latest.alp2ppPrev).toFixed(1)
    : (altL && altL.aPrev != null) ? +(altL.a - altL.aPrev).toFixed(1)
    : +(latest.a - m.data[m.data.length - 2].a).toFixed(1);

  return (
    <section className="card hero">
      <div className="hero-top">
        <div className="hero-headline">
        {/* Labels the METHOD behind the number above, on one dimension. A
            matchup earns "weighted aggregate" when its own house effects are
            estimable (ALP v L/NP and ALP v ON both are); one that only two
            houses ask can't be debiased or nowcast, so it says so. */}
        <h2 className="hero-eyebrow">
          Two-party preferred · {adjusted ? "weighted aggregate" : "monthly average"}
          {!adjusted && <span className="eyebrow-warn"> • limited data</span>}
        </h2>
          <div className="hero-readout" key={"ro-" + matchup}>
            <div className="ro-party alp-side">
              <span className="ro-dot" style={{ background: m.a.color }}></span>
              <span className="ro-name">{m.a.name}</span>
              <span className="ro-num" style={{ color: m.a.color }}>{latest.a.toFixed(1)}</span>
            </div>
            <span className="ro-sep" aria-hidden="true"></span>
            <div className="ro-party lnp-side">
              <span className="ro-num" style={{ color: m.b.color }}>{latest.b.toFixed(1)}</span>
              <span className="ro-name">{m.b.name}</span>
              <span className="ro-dot" style={{ background: m.b.color }}></span>
            </div>
          </div>
          {/* An aggregate of five polls is not known to a tenth of a point, so
              the interval sits with the number rather than in a footnote. It
              covers how far the polls in the window disagree plus their
              sampling error; it cannot cover bias shared across the industry,
              which no aggregate can measure about itself. */}
          {unc && (
            <div className="hero-interval">
              <span className="hi-range">± {unc.ci95.toFixed(1)} pts</span>
              <span className="hi-note">
                95% interval · {unc.n} poll{unc.n === 1 ? "" : "s"} in {D.latest.method.windowDays} days
              </span>
            </div>
          )}
          <div className="hero-sub" key={"sub-" + matchup}>
            <span className="lead-tag">{leadName} leads by {Math.abs(lead).toFixed(1)} pts</span>
            <Delta value={monthDelta} suffix=" pt" small />
            <span className="hero-sub-note">
              {(m.real || (altL && altL.aPrev != null)) ? "vs. one month ago" : "vs. previous reading"}
              {/* A month-on-month move smaller than its own interval is not a
                  finding. Say so next to the arrow, not three scrolls down. */}
              {unc && unc.changeSig === false && (
                <span className="hero-caveat"> · within the margin</span>
              )}
            </span>
          </div>
        </div>
        <div className="hero-controls">
          <TextToggle value={matchup} onChange={setMatchup} ariaLabel="Matchup"
            options={matchupOptions} />
          <TextToggle caps value={rangeId} onChange={setRangeId} ariaLabel="Time range"
            options={[{ id: "3", label: "3M" }, { id: "12", label: "12M" }, { id: "all", label: "All" }]} />
        </div>
      </div>

      <TrendChart
        key={"hero-" + matchup + "-" + rangeId}
        height={420} xDomain={xDomain} yDomain={yDomain} yTicks={yTicks} unit="%"
        axisFont={22}
        pad={{ l: 58, r: 22, t: 30, b: 42 }}
        xTicks={buildXTicks(xDomain[0], xDomain[1])}
        refLines={heroRefLines}
        events={heroEvents}
        scatter={scatter} series={heroSeries} spine={heroSpine}
        tooltipTitle={(i) => window.AP.monthLabelFull(pts[i].ym)}
        fmt={(v) => v.toFixed(1)}
      />
      <div className="hero-foot">
        <div className="hero-legend">
          {/* swatch matches what is actually drawn — a line where there is a
              trend, a dot where the series is only its readings */}
          <span className="hl-item">
            <span className={heroSeries.length ? "hl-line" : "hl-swatch-dot"} style={{ background: m.a.color }}></span>{m.a.name}
          </span>
          <span className="hl-item">
            <span className={heroSeries.length ? "hl-line" : "hl-swatch-dot"} style={{ background: m.b.color }}></span>{m.b.name}
          </span>
          {scatterPolls > 0 && heroSeries.length > 0 && <span className="hl-item"><span className="hl-dot"></span>Individual poll</span>}
        </div>
        <p className="hero-caption">
          {m.real
            ? "Each dot is one published poll; the line is a smoothed average across all pollsters."
            : `Each dot is one pollster’s published ${m.label} head-to-head` +
              (adjusted
                ? ", adjusted for each house's lean on this matchup like the headline 2PP."
                : ", averaged monthly — too few houses ask it to weight or debias.") +
              (scatterPolls ? ` ${scatterPolls} poll${scatterPolls === 1 ? "" : "s"} so far.` : "")}
        </p>
      </div>
    </section>
  );
}

function MethodNote() {
  const { D } = window.AP;
  // pollster list straight from the archive, busiest first
  const counts = {};
  D.individualPolls.forEach((p) => { counts[p.pollster] = (counts[p.pollster] || 0) + 1; });
  const sources = Object.keys(counts).sort((a, b) => counts[b] - counts[a]).join(", ");
  return (
    <footer className="method">
      <div className="method-grid">
        <div>
          <h3 className="method-h">About this tracker</h3>
          <p>auspol pools every published national voting-intention poll since the May 2025 federal
             election. The two-party and primary-vote aggregates are weighted means: recent and
             larger-sample polls count for more, and each pollster’s figure is adjusted for its own
             house lean against the cross-house consensus. House leans are measured separately for
             every measure — a firm that leans one way on the classic 2PP is not assumed to lean the
             same way on a primary share or an ALP-v-One Nation head-to-head — and a matchup too few
             houses ask is left as a plain monthly average rather than adjusted on guesswork.
             Pollsters that publish no 2PP contribute to the primary-vote and leadership series only.</p>
          <p>The headline carries a 95% interval, built from how far the polls in the window disagree
             with each other and from their own sampling error, whichever is larger. It currently runs
             to about ±{(D.latest.alp2ppCi95 ?? 0).toFixed(1)} points on a
             {" "}{D.latest.method.windowDays}-day window holding {D.latest.method.nPolls} polls
             (effective sample of {D.latest.alp2ppNEff} after weighting). What it cannot cover is error
             shared across the whole industry — if every house is leaning the same way, no aggregate of
             them can detect it. Treat a month-on-month move smaller than that interval as noise; the
             page labels one when it happens.</p>
        </div>
        <div>
          <h3 className="method-h">Reading the charts</h3>
          <p>Each dot is one published poll; lines are monthly aggregates. The spread of dots around the
             line is a useful reminder of sampling uncertainty. Leadership questions are polled
             irregularly and framed differently between pollsters, so those lines connect published readings
             — a “—” anywhere in the tables means the pollster didn’t ask that question.</p>
        </div>
        <div>
          <h3 className="method-h">Sources</h3>
          <p>{sources}. Field dates and sample sizes are listed per poll in the archive.</p>
        </div>
      </div>
      <div className="disclaimer">
        Unofficial aggregate of published national polling. Aggregate figures are estimates, not
        measurements — treat decimal places gently.
      </div>
    </footer>
  );
}

// Sticky score anchor — RETIRED: the 2PP readout now docks into the sticky
// tab bar (TabScore in views.jsx) so it travels across every tab. ScoreBar
// removed rather than left dead — see git/file history if it's ever wanted.

const TABS = [
  { id: "snapshot", label: "Snapshot" },
  { id: "cycles", label: "Past cycles" },
  { id: "allpolls", label: "All polls" },
];
const TAB_IDS = TABS.map((t) => t.id);

function SnapshotView({ rangeId, setRangeId, showScatter }) {
  return (
    <>
      <Hero rangeId={rangeId} setRangeId={setRangeId} showScatter={showScatter} />
      <PrimaryVotePanel rangeId={rangeId} />
      <LeadershipSection rangeId={rangeId} />
      <DirectionPanel rangeId={rangeId} />
      <PollsterTable />
      <NextPollsPanel />
    </>
  );
}

function App() {
  const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
    "layout": "editorial",
    "theme": "auto",
    "accent": "warm",
    "showScatter": true
  }/*EDITMODE-END*/;
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [rangeId, setRangeId] = useState("all");

  // active tab, persisted in the URL hash so a refresh / share keeps the view
  const readHash = () => {
    const h = (window.location.hash || "").replace(/^#/, "");
    return TAB_IDS.includes(h) ? h : "snapshot";
  };
  const [tab, setTab] = useState(readHash);
  React.useEffect(() => {
    const fn = () => setTab(readHash());
    window.addEventListener("hashchange", fn);
    return () => window.removeEventListener("hashchange", fn);
  }, []);
  const goTab = (id) => {
    setTab(id);
    if (id !== readHash()) window.location.hash = id;
    window.scrollTo({ top: 0, behavior: "auto" });
  };

  // resolve 'auto' against the OS preference, and keep it live
  const prefersDark = () => window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const [sysDark, setSysDark] = useState(prefersDark());
  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const fn = (e) => setSysDark(e.matches);
    mq.addEventListener ? mq.addEventListener("change", fn) : mq.addListener(fn);
    return () => { mq.removeEventListener ? mq.removeEventListener("change", fn) : mq.removeListener(fn); };
  }, []);
  const isDark = t.theme === "dark" || (t.theme === "auto" && sysDark);

  // theme / layout / accent classes — each flip runs through a brief
  // whole-page colour crossfade (see body.theme-xfade in styles.css)
  const xfadeTimer = useRef(null);
  const withXfade = (apply) => {
    document.body.classList.add("theme-xfade");
    apply();
    clearTimeout(xfadeTimer.current);
    xfadeTimer.current = setTimeout(() => document.body.classList.remove("theme-xfade"), 450);
  };
  const mounted = useRef(false);
  React.useEffect(() => {
    if (!mounted.current) { document.body.classList.toggle("editorial", t.layout === "editorial"); return; }
    withXfade(() => document.body.classList.toggle("editorial", t.layout === "editorial"));
  }, [t.layout]);
  React.useEffect(() => {
    if (!mounted.current) { document.body.classList.toggle("cool", t.accent === "cool"); return; }
    withXfade(() => document.body.classList.toggle("cool", t.accent === "cool"));
  }, [t.accent]);
  React.useEffect(() => {
    if (!mounted.current) { document.body.classList.toggle("dark", isDark); return; }
    withXfade(() => document.body.classList.toggle("dark", isDark));
  }, [isDark]);
  React.useEffect(() => { mounted.current = true; }, []);
  React.useEffect(() => () => clearTimeout(xfadeTimer.current), []);

  const cycleTheme = () => setTweak("theme", isDark ? "light" : "dark");

  return (
    <div className="page">
      <Header isDark={isDark} onToggleTheme={cycleTheme} />
      <Tabs tabs={TABS} active={tab} onChange={goTab} />
      <main className="content">
        <div className="view-enter content" key={tab}>
          {tab === "snapshot" && (
            <SnapshotView rangeId={rangeId} setRangeId={setRangeId} showScatter={t.showScatter} />
          )}
          {tab === "cycles" && <PastCyclesView />}
          {tab === "allpolls" && <AllPollsView />}
        </div>
        <MethodNote />
      </main>

      <TweaksPanel>
        <TweakSection label="Appearance" />
        <TweakRadio label="Theme" value={t.theme}
          options={["auto", "light", "dark"]}
          onChange={(v) => setTweak("theme", v)} />
        <p className="tweak-note">
          {t.theme === "auto" ? "Follows your device setting." : t.theme === "dark" ? "Newsprint at night." : "Warm paper."}
        </p>
        <TweakSection label="Layout" />
        <TweakRadio label="Style" value={t.layout}
          options={["editorial", "panelled"]}
          onChange={(v) => setTweak("layout", v)} />
        <p className="tweak-note">
          {t.layout === "editorial"
            ? "Broadsheet — hairline rules, no card chrome."
            : "Dashboard — each view in its own bordered card."}
        </p>
        <TweakSection label="Paper" />
        <TweakRadio label="Tone" value={t.accent}
          options={["warm", "cool"]}
          onChange={(v) => setTweak("accent", v)} />
        <TweakSection label="Hero chart" />
        <TweakToggle label="Show individual polls" value={t.showScatter}
          onChange={(v) => setTweak("showScatter", v)} />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
