/* auspol tracker – header, hero, page assembly */

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

  /* The mark is the whole tracker at 44x28 units, so clicking it opens the
     thing it abbreviates rather than anything decorative – see wm-story.jsx.
     The origin rect is handed over so the overlay can fly out of the masthead
     instead of appearing on top of it. */
  const [story, setStory] = useState(null);
  const glyphRef = useRef(null);
  const openStory = () => {
    const el = glyphRef.current;
    setStory({ rect: el ? el.getBoundingClientRect() : null });
  };

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

  // pendulum = the head-to-head against Labor's STRONGEST challenger – the same
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
  // the challenger swings RIGHT – matching the hero's Labor-left / opp-right order.
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
  /* The graduations settle with the needle rather than arriving already
     correct: all four start at one neutral length, then some grow and some
     shrink into their real share. Half the instrument animating while the
     other half sat finished read as unfinished. */
  const SETTLE_H = (MIN_H + MAX_H) / 2;

  // ---- integrated glyph geometry: one dial – party columns are radial
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
          <button className="wm-glyph" ref={glyphRef} onClick={openStory}
                  title="Wind the dial back through the term"
                  aria-label="Wind the dial back: replay the term on the masthead dial">
            <svg className="wm-dial" viewBox="0 0 44 28" width="54" height="34.4" aria-hidden="true">
              <title>{glyphTitle + " · " + pendTitle}</title>
              {/* half-circle two-tone swing arc: Labor left, strongest challenger right */}
              <path d={arcPath(-90, 0)} className="wm-arc" stroke="var(--alp)"></path>
              <path d={arcPath(0, 90)} className="wm-arc" stroke={oppColor}></path>
              {/* Party columns as radial graduations, heights = primary vote.
                  Each line is drawn at FULL length and revealed by its dash,
                  because stroke-dasharray transitions everywhere while the SVG
                  geometry attributes (x2/y2) do not. */}
              {glyph.map((p, i) => {
                const a = BAR_ANGLES[i];
                const inner = polar(a, GC.r + 2);
                const outerMax = polar(a, GC.r + 2 + MAX_H);
                const shown = pendSettled ? p.h : SETTLE_H;
                return (
                  <line key={p.id} className="wm-bar"
                        x1={inner.x} y1={inner.y} x2={outerMax.x} y2={outerMax.y}
                        stroke={p.color} strokeWidth="3.4" strokeLinecap="butt"
                        style={{ strokeDasharray: shown.toFixed(2) + " " + MAX_H }}></line>
                );
              })}
              {/* 2PP needle – swings toward the leader of the top contest.
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
          </button>
          <span className="wm-sr">– Australian federal polling</span>
        </h1>
        <p className="tagline">Aggregated opinion polling for the next Australian federal election</p>
        <div className="head-meta-compact" aria-hidden="true">
          <span className={"fresh-dot " + fresh.state}></span>
          Updated {D.latest.updated} · {D.latest.pollsTracked} polls
        </div>
      </div>
      <div className="head-right">
        <div className="head-meta">
          <div className="meta-item meta-updated">
            <span className="meta-k">Last poll</span>
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
      {story && <DialStory originRect={story.rect}
        onClose={() => { setStory(null); requestAnimationFrame(() => glyphRef.current && glyphRef.current.focus()); }} />}
    </header>
  );
}

/* A headline figure that ROLLS to its new value instead of being replaced by
   it. Every digit is a reel: 1 to 3 slides through 2, 4 to 8 through 5, 6 and
   7, which is what makes a matchup switch read as one number moving rather
   than another number arriving.

   The value in the DOM is the FINAL one from the first frame - the reel is
   decoration over a number that is already correct, never a delay in front of
   one - so a screen reader, a copy-paste and the accessibility tree all get
   53.8 the instant it is true, while the eye watches it arrive.

   The baseline is the fiddly part: a box with overflow:hidden takes its bottom
   edge as its baseline, which would drop the 17px party name by a fifth of a
   62px em. The zero-width anchor is a real, invisible line of text at the head
   of the row, so the whole figure keeps an ordinary text baseline and the
   clipped digit boxes align to its top edge. */
const ROLL_DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
window.RollNum = RollNum;      // the hero's Delta reads it off the window (see Delta)
function RollNum({ value, className, style }) {
  const text = String(value);
  return (
    <span className={"roll" + (className ? " " + className : "")} style={style}>
      <span className="roll-anchor" aria-hidden="true">0</span>
      <span className="sr-only">{text}</span>
      {text.split("").map((ch, i) => (
        /[0-9]/.test(ch) ? (
          <span className="roll-d" key={i} aria-hidden="true">
            <span className="roll-reel" style={{ "--d": Number(ch) }}>
              {ROLL_DIGITS.map((d) => <span key={d}>{d}</span>)}
            </span>
          </span>
        ) : (
          <span className="roll-sep" key={i} aria-hidden="true">{ch}</span>
        )
      ))}
    </span>
  );
}

/* Blend two party colours the long way round the wheel. `shorter hue` from
   L/NP blue (250deg) to One Nation orange (58deg) is 172deg the OTHER way, so
   the rival travels blue - indigo - magenta - red - orange rather than sliding
   through grey, which is what an oklab mix of the two would do. Left as a CSS
   function rather than computed here so it keeps resolving against whichever
   palette the theme is currently using. */
/* The one motion curve every moving-data transition shares – defined in
   AP (helpers.js) so the chart's travelling window samples the same one, and
   mirrored as a cubic-bezier on .roll-reel so the digits do too. */
const MORPH_EASE = (x) => window.AP.morphEase(x);

function mixC(c1, c2, t) {
  if (t <= 0 || c1 === c2) return c1;
  if (t >= 1) return c2;
  return "color-mix(in oklch shorter hue, " + c1 + ", " + c2 + " " + (t * 100).toFixed(1) + "%)";
}

function Hero({ rangeId, setRangeId, showScatter = true }) {
  const { D, rangeDomain, filterPts, buildXTicks, series } = window.AP;
  const xDomain = rangeDomain(rangeId);

  // matchup config – each is a mirrored head-to-head 2PP.
  //   `real`    = the headline measure, which carries the weighted nowcast
  //   `scatter` = per-poll accessor. EVERY matchup here is built from figures
  //               pollsters actually published (the ALP v ON and L/NP v ON
  //               head-to-heads come from altTppRaw and their aggregate line is
  //               a mean of them), so all three plot their own readings – the
  //               only difference is how many houses ask the question.
  const MATCHUPS = {
    alp_lnp: {
      a: { name: "Labor", color: "var(--alp)" }, b: { name: "Coalition", color: "var(--lnp)" },
      data: D.agg2pp.map((d) => ({ ym: d.ym, x: d.x, a: d.alp, b: d.lnp, ci95: d.ci95, k: d.k })), real: true,
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

  /* The REAL published measure (ALP v L/NP) always leads and is the default;
     the modelled head-to-heads follow, strongest challenger first.

     A modelled matchup has to earn its place: enough months to show a trend
     rather than a few scattered points, and a recent enough last reading to be
     describing the present. Two points cleared the old bar, which let L/NP v ON
     offer a tab built on four months ending in May – a stale line with no
     nowcast behind the headline. Both tests read off the data, so the matchup
     reappears by itself once the houses start asking it again. */
  const MIN_ALT_MONTHS = 6;
  const MAX_ALT_STALE = 0.26;                      // ~3 months, in decimal years
  const spineEnd = D.agg2pp[D.agg2pp.length - 1].x;
  const hasData = (id) => {
    const d = MATCHUPS[id].data;
    if (MATCHUPS[id].real) return d.length >= 2;
    return d.length >= MIN_ALT_MONTHS && spineEnd - d[d.length - 1].x <= MAX_ALT_STALE;
  };
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
  /* Switching matchup is a MORPH, not a swap. The same two lines reshape into
     the other pair, the rival's colour travels round the hue circle, the
     headline digits roll, and the two dot clouds cross over - so the second
     matchup reads as the first one rearranged, and switching back rearranges
     it home. 320ms with an ease-out: far enough to follow, short enough that
     nobody is kept waiting for a number they can already read, since the value
     itself is correct from the first frame and only its digits are in motion. */
  const MORPH_MS = window.AP.MORPH_MS;
  const [morph, setMorph] = useState(null);        // { from, to, t }
  const morphRaf = useRef(0);
  React.useEffect(() => () => cancelAnimationFrame(morphRaf.current), []);
  const chooseMatchup = (id) => {
    const from = matchup;
    setMatchup(id);
    const still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (id === from || still || !MATCHUPS[from] || !MATCHUPS[id]) { setMorph(null); return; }
    cancelAnimationFrame(morphRaf.current);
    const t0 = performance.now();
    setMorph({ from, to: id, t: 0 });
    const step = (now) => {
      const raw = Math.min(1, (now - t0) / MORPH_MS);
      if (raw >= 1) { setMorph(null); return; }          // land on the real thing
      setMorph({ from, to: id, t: MORPH_EASE(raw) });
      morphRaf.current = requestAnimationFrame(step);
    };
    morphRaf.current = requestAnimationFrame(step);
  };

  const m = MATCHUPS[matchup];
  const ptsOf = (id) => filterPts(MATCHUPS[id].data, xDomain[0]);
  const pts = ptsOf(matchup);
  /* Both matchups on ONE grid of months, each holding its own end value across
     the months the other one runs for - so the two paths carry the same shape
     of command and can be interpolated point for point. The stretch a matchup
     was never asked in is never SEEN: the clip window travels with the morph,
     so the line retreats to where the question was actually put, and grows
     back out when you switch away. */
  const blend = (() => {
    if (!morph) return null;
    const A = ptsOf(morph.from), B = ptsOf(morph.to);
    if (!A.length || !B.length) return null;
    const t = morph.t, lerp = (p, q) => p + (q - p) * t;
    const index = (arr) => { const o = {}; arr.forEach((d) => (o[d.ym] = d)); return o; };
    const ia = index(A), ib = index(B);
    const hold = (idx, arr, ym) => idx[ym] || (ym < arr[0].ym ? arr[0] : arr[arr.length - 1]);
    const yms = [...new Set(A.concat(B).map((d) => d.ym))].sort();
    return {
      pts: yms.map((ym) => {
        const da = hold(ia, A, ym), db = hold(ib, B, ym);
        return { ym, x: (ia[ym] || ib[ym]).x, a: lerp(da.a, db.a), b: lerp(da.b, db.b),
                 // a ribbon that vanished mid-morph would read as the switch
                 // having made the estimate certain for 320ms
                 ci95: (da.ci95 == null || db.ci95 == null) ? null : lerp(da.ci95, db.ci95) };
      }),
      clip: [lerp(A[0].x, B[0].x), lerp(A[A.length - 1].x, B[B.length - 1].x)],
      a: mixC(MATCHUPS[morph.from].a.color, MATCHUPS[morph.to].a.color, t),
      b: mixC(MATCHUPS[morph.from].b.color, MATCHUPS[morph.to].b.color, t),
    };
  })();
  const drawPts = blend ? blend.pts : pts;
  const colA = blend ? blend.a : m.a.color;
  const colB = blend ? blend.b : m.b.color;
  // Headline readout: for the REAL ALP v L/NP measure this is the trailing
  // recency- + sample-weighted, house-effect-adjusted nowcast (D.latest) –
  // the same figure docked in the sticky tab bar – NOT the last monthly-mean
  // dot, so the two never disagree. The smoothed chart line stays the monthly
  // trend; a small gap between the line's end and this number is expected (a
  // nowcast leads the monthly mean). Modelled matchups have no separate
  // headline, so they read their last plotted point.
  // An alternative matchup gets a nowcast too WHERE the series supports one
  // (D.altLatest is null for a matchup too thin to weight). Otherwise it reads
  // its last monthly point, as before.
  /* The current figure for ANY matchup, headline or not – one accessor, so a
     chip below can never disagree with the readout above when it is that
     matchup's turn to be the headline. */
  const latestOf = (id) => {
    const M = MATCHUPS[id];
    if (M.real) return { a: D.latest.alp2pp, b: D.latest.lnp2pp, ci95: D.latest.alp2ppCi95 };
    const al = D.altLatest ? D.altLatest[M.altKey] : null;
    if (al) return { a: al.a, b: al.b, ci95: al.ci95 };
    const last = M.data[M.data.length - 1];
    return last ? { a: last.a, b: last.b, ci95: null } : null;
  };
  /* Every contest that isn't the one on the chart, in the same order the tabs
     use, and only where there is a current figure to print – a chip with no
     number would be the bare tab it is replacing. */
  const otherContests = orderedMatchups
    .filter((id) => id !== matchup)
    .map((id) => ({ id, v: latestOf(id) }))
    .filter((o) => o.v && o.v.a != null);
  const altL = (m.altKey && D.altLatest) ? D.altLatest[m.altKey] : null;
  const adjusted = m.real || !!(D.adjusted && m.altKey && D.adjusted[m.altKey]);
  const latest = m.real
    ? { a: D.latest.alp2pp, b: D.latest.lnp2pp }
    : altL || m.data[m.data.length - 1];

  // mirrored pairs, so each trend line sits inside its own cloud of readings.
  // Driven by the active matchup's own accessor – a poll that didn't publish
  // THIS head-to-head is simply skipped, which is why the ON matchups show
  // fewer dots rather than none.
  const cloudFor = (id) => (!showScatter ? [] : D.individualPolls
    .filter((p) => p.x >= xDomain[0] && p.x <= xDomain[1])
    .flatMap((p) => {
      const pair = MATCHUPS[id].scatter(p);
      // `side` 0 is the Labor-side reading and 1 the rival's – with the poll's
      // own identity, that is how a dot recognises itself in the other matchup
      return pair ? pair.map((s, side) => ({ x: p.x, y: s.y, color: s.color, label: s.label, meta: p, side })) : [];
    }));
  // memoised on what actually changes them: a morph frame must not rebuild
  // 240 dots sixty times a second (see the chart's own memo on the same arrays)
  const settledCloud = React.useMemo(() => cloudFor(matchup), [matchup, rangeId, showScatter]);

  /* The cloud morphs the way the lines do. A poll that published BOTH matchups
     is one reading of the same fieldwork asked two ways – Newspoll's 51.4
     against the Coalition and 53.8 against One Nation are the same poll – so
     its dot travels between them and its colour goes round the hue circle with
     the line above it. A poll that only ever answered one of the questions has
     nowhere to travel to, so it fades: 74 of the 119 two-party polls never had
     the One Nation matchup put to them, and inventing a position for them
     would be drawing data nobody collected.

     Split three ways so only the travelling group is rebuilt per frame. */
  const morphClouds = React.useMemo(() => {
    if (!morph) return null;
    const key = (d) => d.meta.pollster + "|" + d.meta.released + "|" + d.side;
    const A = cloudFor(morph.from), B = cloudFor(morph.to);
    const ia = new Map(A.map((d) => [key(d), d])), ib = new Map(B.map((d) => [key(d), d]));
    const travel = [], leaving = [], arriving = [];
    ia.forEach((d, k) => (ib.has(k) ? travel.push([d, ib.get(k)]) : leaving.push(d)));
    ib.forEach((d, k) => { if (!ia.has(k)) arriving.push(d); });
    return { travel, leaving, arriving };
  }, [morph ? morph.from : null, morph ? morph.to : null, rangeId, showScatter]);

  const scatter = morphClouds ? morphClouds.arriving : settledCloud;
  const scatterOut = morphClouds ? morphClouds.leaving : [];
  const scatterMove = !morphClouds ? [] : morphClouds.travel.map(([a, b]) => ({
    // same poll, same fieldwork, so only the reading and its colour move
    x: a.x, y: a.y + (b.y - a.y) * morph.t,
    color: mixC(a.color, b.color, morph.t), label: b.label, meta: b.meta,
  }));
  // how many polls are actually behind the cloud – stated in the caption, since
  // "9 houses ask this" is the honest caveat on a thinner matchup
  const scatterPolls = settledCloud.length / 2;

  // A trend line through four monthly means built on five polls from two houses
  // is a shape the data can't support – it reads as a trajectory when it's
  // really noise. Where the series is too thin to weight, plot the readings
  // only and let the reader see the scatter for what it is.
  const heroSeries = !adjusted ? [] : [
    { id: "a", label: m.a.name, color: colA, points: series(drawPts, "a"), width: 3.6 },
    { id: "b", label: m.b.name, color: colB, points: series(drawPts, "b"), width: 3.6 },
  ];
  // with no line there is nothing for a month-guide tooltip to report, so the
  // guide is switched off and the dots carry their own hovers
  const heroSpine = heroSeries.length ? series(drawPts, "a") : [];

  /* The interval, drawn. The headline above says +/- 1.8 points and refuses to
     call a month-on-month move real unless it clears that; the chart used to
     answer with a 3.6px line placed to a tenth of a point, which is the more
     persuasive object and was making the weaker claim look like the settled
     one. Both series get a ribbon: they are exact complements, so the two are
     mirror images, and where they OVERLAP the interval covers 50 - the months
     in which the lead cannot be told apart from a tie. That overlap is the
     single most useful thing on this chart and it is not otherwise drawn.
     No ribbon where there is no line, for the same reason there is no line. */
  const bandPts = (key) => drawPts
    .filter((d) => d.ci95 != null)
    .map((d) => ({ x: d.x, y0: d[key] - d.ci95, y1: d[key] + d.ci95 }));
  const heroAreas = !heroSeries.length ? [] : [
    { id: "ci-a", color: colA, className: "ci-band", edge: false, smooth: true, points: bandPts("a") },
    { id: "ci-b", color: colB, className: "ci-band", edge: false, smooth: true, points: bandPts("b") },
  ].filter((a) => a.points.length >= 2);

  // Major events, clipped to the span this matchup actually plots. The headline
  // 2PP runs the whole archive so it keeps all of them; ALP v ON only begins
  // when pollsters started asking it, and a marker standing over a stretch with
  // no line would imply a reading that was never taken. A matchup with no trend
  // line at all gets none.
  const heroEvents = (!heroSeries.length || !pts.length) ? [] : (() => {
    const x0 = pts[0].x, x1 = pts[pts.length - 1].x;
    return (D.events || []).filter((e) => e.major && e.x >= x0 && e.x <= x1);
  })();

  /* One word, and not "50% – majority line". The axis already prints 50% 18px
     to the left, so the number was said twice in adjacent space; and 50 is a
     tie in the national two-party vote, NOT the point at which a party wins a
     majority of seats - Labor took 51.0% of the 2PP in 1998 and lost. This
     tracker keeps vote share and seats apart everywhere else (it carries its
     own seat projection), so the label shouldn't quietly read one off the
     other. "tie" is also what the past-cycles 2PP chart calls the same line,
     and what the approval charts mean by "even".

     Labelled at the LEFT edge: the right edge is where both trend lines
     terminate and their end-cap dots sit, so a label there landed in the
     busiest part of the chart. The left edge is empty in every matchup. */
  const heroRefLines = [{ y: 50, label: "tie", color: "var(--ink-faint)", align: "left" }];

  // y-window auto-fits the matchup spread – min/max taken across BOTH series
  // so the domain stays correct even if the challenger ever takes the lead
  const domainOf = (id) => {
    const v = MATCHUPS[id].data.flatMap((d) => [d.a, d.b]);
    const lo = Math.min(...v), hi = Math.max(...v), pad6 = 6;
    return [Math.floor((lo - pad6) / 5) * 5, Math.ceil((hi + pad6) / 5) * 5];
  };
  const yTarget = domainOf(matchup);
  // ticks come from the TARGET window so their number holds still while the
  // window itself slides; today both matchups share 35–65 and nothing moves
  const yDomain = blend
    ? (() => { const f = domainOf(morph.from), t = morph.t;
               return [f[0] + (yTarget[0] - f[0]) * t, f[1] + (yTarget[1] - f[1]) * t]; })()
    : yTarget;
  const yTicks = [];
  for (let v = yTarget[0]; v <= yTarget[1]; v += 5) if (v > yTarget[0] && v < yTarget[1]) yTicks.push(v);
  const lead = +(latest.a - latest.b).toFixed(1);
  const leadName = lead >= 0 ? m.a.name : m.b.name;
  /* Uncertainty for whichever matchup is showing. Every nowcast on this hero
     is a weighted mean of a handful of polls, so none of them is exact – a
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
        <h2 className="card-title hero-title">Two-party preferred</h2>
          {/* NOT keyed on the matchup any more: a remount would replace these
              figures, and the whole point is that they travel. The old
              readout-in fade lives on where it still belongs, on the lead line
              below, whose words genuinely are replaced. */}
          <div className="hero-readout">
            <div className="ro-party alp-side">
              <span className="ro-dot" style={{ background: colA }}></span>
              <span className="ro-name">{m.a.name}</span>
              <RollNum className="ro-num" value={latest.a.toFixed(1)} style={{ color: inkOf(colA) }} />
            </div>
            <span className="ro-sep" aria-hidden="true"></span>
            <div className="ro-party lnp-side">
              <RollNum className="ro-num" value={latest.b.toFixed(1)} style={{ color: inkOf(colB) }} />
              <span className="ro-name">{m.b.name}</span>
              <span className="ro-dot" style={{ background: colB }}></span>
            </div>
          </div>
          {/* An aggregate of five polls is not known to a tenth of a point, so
              the interval sits with the number rather than in a footnote. It
              covers how far the polls in the window disagree plus their
              sampling error; it cannot cover bias shared across the industry,
              which no aggregate can measure about itself. */}
          {/* How the figure was built, then how well it is known. An aggregate
              of five polls is not known to a tenth of a point, so the interval
              sits with the number rather than in a footnote. It covers how far
              the polls in the window disagree plus their sampling error; it
              cannot cover bias shared across the industry, which no aggregate
              can measure about itself. */}
          <div className="hero-interval">
            <span className="hi-method">{adjusted ? "Weighted aggregate" : "Monthly average"}</span>
            {!adjusted && <span className="eyebrow-warn">limited data</span>}
            {unc && <span className="hi-range">± {unc.ci95.toFixed(1)} pts</span>}
            {unc && (
              <span className="hi-note">
                95% interval · {unc.n} poll{unc.n === 1 ? "" : "s"} in {D.latest.method.windowDays} days
              </span>
            )}
          </div>
          {/* Not keyed on the matchup either, for the same reason the readout
              above isn't: the margin is a figure that travels between the two
              questions - 2.8 points against the Coalition, 7.6 against One
              Nation - so it rolls rather than being replaced. The words around
              it swap outright, as the party names above them do. */}
          <div className="hero-sub">
            <span className="lead-tag">
              {leadName} leads by <RollNum value={Math.abs(lead).toFixed(1)} /> pts
            </span>
            <Delta value={monthDelta} suffix=" pt" small roll />
            <span className="hero-sub-note">
              {(m.real || (altL && altL.aPrev != null)) ? "vs. one month ago" : "vs. previous reading"}
              {/* A month-on-month move smaller than its own interval is not a
                  finding. Say so next to the arrow, not three scrolls down. */}
              {unc && unc.changeSig === false && (
                <span className="hero-caveat"> · within the margin</span>
              )}
            </span>
          </div>
        {/* The OTHER contests, carrying their figures rather than just their
            names. One Nation sits level with Labor on the primary vote, so in
            a good many seats the final two are not Labor and the Coalition and
            "the 2PP" is doing less work than a single headline implies. These
            were previously a bare tab you had to press to find out what was
            behind it; the number is the reason to press it. */}
        {otherContests.length > 0 && (
          <div className="hero-alt">
            <span className="ha-lab">Switch 2PP</span>
            {otherContests.map((o) => (
              <button key={o.id} type="button" className="ha-chip" onClick={() => chooseMatchup(o.id)}
                      title={"Show " + MATCHUPS[o.id].a.name + " v " + MATCHUPS[o.id].b.name}>
                <span className="ha-vs">{MATCHUPS[o.id].a.name} v {MATCHUPS[o.id].b.name}</span>
                <span className="ha-fig">
                  <span style={{ color: inkOf(MATCHUPS[o.id].a.color) }}>{o.v.a.toFixed(1)}</span>
                  <span className="ha-dash">–</span>
                  <span style={{ color: inkOf(MATCHUPS[o.id].b.color) }}>{o.v.b.toFixed(1)}</span>
                </span>
                {o.v.ci95 != null && <span className="ha-ci">± {o.v.ci95.toFixed(1)}</span>}
              </button>
            ))}
          </div>
        )}
        </div>
        <div className="hero-controls">
          <TextToggle value={matchup} onChange={chooseMatchup} ariaLabel="Matchup"
            options={matchupOptions} />
          <TextToggle caps value={rangeId} onChange={setRangeId} ariaLabel="Time range"
            /* rangeDomain takes any month count, and buildXTicks already labels
               every month once the span is under a year, so six months arrives
               with its own tick per month rather than every second one */
            options={[{ id: "3", label: "3M" }, { id: "6", label: "6M" },
                      { id: "12", label: "12M" }, { id: "all", label: "All" }]} />
        </div>
      </div>

      {/* The key carries NEITHER the matchup nor the range: remounting would
          throw away the very thing being animated - the morph in one case, the
          travelling window in the other - along with both memoised dot clouds.
          A stale hover index is already clamped inside. */}
      <TrendChart
        key="hero"
        height={420} xDomain={xDomain} yDomain={yDomain} yTicks={yTicks} unit="%"
        axisFont={22}
        pad={{ l: 58, r: 22, t: 30, b: 42 }}
        xTicks={buildXTicks(xDomain[0], xDomain[1])}
        refLines={heroRefLines}
        events={heroEvents}
        scatter={scatter} series={heroSeries} spine={heroSpine} pollFacet="twopp"
        scatterOut={scatterOut} scatterMove={scatterMove}
        areas={heroAreas}
        fade={blend ? morph.t : 1} clipX={blend ? blend.clip : null}
        tooltipTitle={(i) => window.AP.monthLabelFull((drawPts[i] || drawPts[drawPts.length - 1]).ym)}
        /* A month's figures and how well that month is known, in the same
           tooltip – the election anchor is a count, so it reports no interval
           rather than an interval of zero, which would read as a claim. */
        extraRows={(i) => {
          const d = drawPts[i];
          if (!d || d.ci95 == null || !d.ci95) return [];
          return [{ label: "95% interval", value: "± " + d.ci95.toFixed(1) + " pts"
                    + (d.k ? " · " + d.k + " poll" + (d.k === 1 ? "" : "s") : "") }];
        }}
        fmt={(v) => v.toFixed(1)}
      />
      <div className="hero-foot">
        <div className="hero-legend">
          {/* swatch matches what is actually drawn – a line where there is a
              trend, a dot where the series is only its readings */}
          <span className="hl-item">
            <span className={heroSeries.length ? "hl-line" : "hl-swatch-dot"} style={{ background: m.a.color }}></span>{m.a.name}
          </span>
          <span className="hl-item">
            <span className={heroSeries.length ? "hl-line" : "hl-swatch-dot"} style={{ background: m.b.color }}></span>{m.b.name}
          </span>
          {scatterPolls > 0 && heroSeries.length > 0 && <span className="hl-item"><span className="hl-dot"></span>Individual poll</span>}
          {heroAreas.length > 0 && (
            <span className="hl-item"><span className="hl-band"></span>95% interval</span>
          )}
        </div>
        <p className="hero-caption">
          {m.real
            ? "Each dot is one published poll; the line is a smoothed average across all pollsters, "
              + "shaded with the interval around it. Where the two shaded bands overlap, the lead is "
              + "inside its own margin of error \u2013 the polls cannot separate the two parties that month."
            : `Each dot is one pollster’s published ${m.label} head-to-head` +
              (adjusted
                ? ", adjusted for each house's lean on this matchup like the headline 2PP."
                : ", averaged monthly – too few houses ask it to weight or debias.") +
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
          <h2 className="method-h">About this tracker</h2>
          <p>auspol tracker pools every published national voting-intention poll since the May 2025 federal
             election. The two-party and primary-vote aggregates are weighted means: recent and
             larger-sample polls count for more, and each pollster’s figure is adjusted for its own
             house lean against the cross-house consensus. House leans are measured separately for
             every measure – a firm that leans one way on the classic 2PP is not assumed to lean the
             same way on a primary share or an ALP-v-One Nation head-to-head – and a matchup too few
             houses ask is left as a plain monthly average rather than adjusted on guesswork.
             Pollsters that publish no 2PP contribute to the primary-vote and leadership series only.</p>
          <p>The headline carries a 95% interval, taken as the greater of the spread among polls in
             the window and their sampling error: currently about
             {" "}±{(D.latest.alp2ppCi95 ?? 0).toFixed(1)} points, on {D.latest.method.nPolls} polls
             across {D.latest.method.windowDays} days (effective sample {D.latest.alp2ppNEff} after
             weighting). It does not cover error common to the whole industry: an aggregate cannot
             detect a lean its constituent polls share. Month-on-month movement smaller than the
             interval is marked as such.</p>
          {/* The industry-wide error the paragraph above says an aggregate
              cannot see about itself IS measurable after the fact, and the
              page now measures it. Saying so here, where the caveat is made,
              is the difference between a disclaimer and an answer. */}
          {D.accuracy && (
            <p>That last caveat is not idle: across the {D.accuracy.cycles.length} elections from
               {" "}{D.accuracy.cycles[0].year} to {D.accuracy.cycles[D.accuracy.cycles.length - 1].year},
               the final polls have missed the two-party result by
               {" "}{D.accuracy.meanAbs} points on average, and at {D.accuracy.worstCycle.year} by
               {" "}{Math.abs(D.accuracy.worstCycle.err)} with every house on the same side of it.
               Past cycles carries the full record, house by house.</p>
          )}
        </div>
        <div>
          <h2 className="method-h">Reading the charts</h2>
          <p>Each dot is one published poll; lines are monthly aggregates, shaded with the 95%
             interval around them – where the two shaded bands meet, that month's lead is inside
             its own margin of error. Leadership questions are polled
             irregularly and framed differently between pollsters, so those lines connect published readings
             – a “—” anywhere in the tables means the pollster didn’t ask that question.</p>
          {/* The single most-requested number this page does not carry. Better
              to say why once, plainly, than to keep declining to say it. */}
          <p><strong>Why there is no seat projection here.</strong> Turning a national two-party
             figure into a seat count assumes a uniform swing, and with One Nation near
             {" "}{Math.round(D.aggPrimary[D.aggPrimary.length - 1].onp)}% of the primary vote the
             assumption fails in exactly the seats that would decide the election: a large minor
             party wins seats where its vote is concentrated and none where it is not, and no
             national number knows the difference. Seat figures appear on this page only where a
             pollster modelled them seat by seat and published the result, which is what the MRP
             tag in the archive marks.</p>
        </div>
        <div>
          <h2 className="method-h">Sources</h2>
          <p>{sources}. Field dates and sample sizes are listed per poll in the archive.</p>
        </div>
      </div>
      <div className="disclaimer">
        Unofficial aggregate of published national polling. Aggregate figures are estimates, not
        measurements – treat decimal places gently.
      </div>
    </footer>
  );
}

// Sticky score anchor – RETIRED: the 2PP readout now docks into the sticky
// tab bar (TabScore in views.jsx) so it travels across every tab. ScoreBar
// removed rather than left dead – see git/file history if it's ever wanted.

// set once the body first carries its theme classes – see the effect below
let chromeSettled = false;

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
      {/* directly under direction: both are questions about the electorate's
          mood rather than its party choice, and both come from the houses that
          bother to publish more than a headline */}
      <UndecidedPanel rangeId={rangeId} />
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
  const [focusPoll, setFocusPoll] = useState(null);   // the poll a chart dot sent us to
  React.useEffect(() => {
    const fn = () => setTab(readHash());
    window.addEventListener("hashchange", fn);
    return () => window.removeEventListener("hashchange", fn);
  }, []);
  const goTab = (id) => {
    setTab(id);
    if (id !== readHash()) window.location.hash = id;
    window.scrollTo({ top: 0, behavior: "auto" });
    // walking off with the tabs ends the trip: coming back to the archive later
    // should not still be holding a row open with a way back to a chart the
    // reader has long since left
    setFocusPoll(null);
  };

  /* Clicking a dot on any chart crosses to that poll in the archive, opened.
     The charts are six components deep in two different views, so the entry
     point is registered on window.AP - the namespace this app already uses to
     share things across its scripts - rather than threaded through as a prop
     nine panels would have to forward. `back` is where the reader was standing
     when they clicked, so the return trip puts them back on the same pixel
     rather than at the top of a tab. */
  React.useEffect(() => {
    window.AP.openPoll = (key, facet) => {
      if (!key) return;
      setFocusPoll({ key, facet: facet || null, back: { tab: readHash(), y: window.scrollY } });
      setTab("allpolls");
      if (readHash() !== "allpolls") window.location.hash = "allpolls";
    };
    return () => { delete window.AP.openPoll; };
  }, []);
  /* The return trip puts the reader back on the pixel they left from. The
     scroll is handed to a layout effect rather than to requestAnimationFrame:
     the view has to be in the DOM before the document is tall enough to take
     the scroll, and rAF does not run at all in a tab nobody is looking at - so
     a frame-scheduled restore silently does nothing, which is precisely the
     kind of "works on my machine" this file has been bitten by before. */
  const restoreY = useRef(null);
  const backFromPoll = () => {
    const b = (focusPoll && focusPoll.back) || { tab: "snapshot", y: 0 };
    setFocusPoll(null);
    restoreY.current = b.y;
    setTab(b.tab);
    if (readHash() !== b.tab) window.location.hash = b.tab;
  };
  React.useLayoutEffect(() => {
    if (restoreY.current == null) return;
    const y = restoreY.current;
    restoreY.current = null;
    window.scrollTo({ top: y, behavior: "auto" });
  }, [tab]);

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

  /* Theme, layout and accent are three switches on ONE appearance, so they
     are applied together, in one place. Three separate effects meant three DOM
     writes, and a change that moved two of them at once (theme carries its own
     accent) ran two crossfades over each other.

     The crossfade itself is now the browser's. It used to be a CSS rule –
     `body.theme-xfade *` with a transition on background-color, color,
     border-color, fill, stroke, box-shadow and opacity – which is a transition
     on EVERY element: 3,300 of them on the archive tab, seven paint properties
     each, none of them anything the compositor can do on its own. Every frame
     of the 380ms repainted the whole page, and the flip visibly stepped
     instead of fading. A view transition takes one picture of the page before
     and one after and crossfades the two textures on the GPU, so the cost no
     longer scales with how much is on screen. Where the API is missing, or the
     reader asked for less motion, the theme simply flips – a clean cut reads
     as intent, a janky fade reads as a bug. */
  const want = { editorial: t.layout === "editorial", cool: t.accent === "cool", dark: isDark };
  const applyChrome = () => {
    for (const c in want) document.body.classList.toggle(c, want[c]);
  };
  React.useEffect(() => {
    // nothing to change – a re-render that re-runs this effect must not animate
    if (!Object.keys(want).some((c) => document.body.classList.contains(c) !== want[c])) return;
    const still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    /* The FIRST application is the page dressing itself and must not fade in
       from the default palette. The flag lives at module scope on purpose: as
       a component ref it was reset by a remount during start-up, which quietly
       spent the "no animation" pass on the reader's first theme flip instead
       of on the load. */
    if (!chromeSettled || still || document.visibilityState === "hidden"
        || typeof document.startViewTransition !== "function") {
      chromeSettled = true;
      applyChrome();
      return;
    }
    /* A skipped transition – a backgrounded tab, or a second flip landing on
       top of this one – rejects `ready`, and a rejection nobody reads is
       reported to the console as an uncaught error. The class change has
       already been applied by then either way, so there is nothing to recover
       from and nothing to report: swallow both promises deliberately. */
    const vt = document.startViewTransition(applyChrome);
    if (vt) {
      if (vt.ready && vt.ready.catch) vt.ready.catch(() => {});
      if (vt.finished && vt.finished.catch) vt.finished.catch(() => {});
    }
  }, [t.layout, t.accent, isDark]);

  const cycleTheme = () => setTweak("theme", isDark ? "light" : "dark");

  return (
    <div className="page">
      <Header isDark={isDark} onToggleTheme={cycleTheme} />
      <Tabs tabs={TABS} active={tab} onChange={goTab} />
      <main className="content">
        {/* The panel the tab strip points at. There was no role="tabpanel" on
            the page at all, so aria-controls had no target and a screen reader
            that moved to the "tab panel" landed nowhere. tabIndex=0 makes the
            panel itself focusable, which is what the pattern asks for when the
            panel's first child isn't. */}
        <div className="view-enter content" key={tab}
             role="tabpanel" id={"panel-" + tab} aria-labelledby={"tab-" + tab}
             tabIndex={0}>
          {tab === "snapshot" && (
            <SnapshotView rangeId={rangeId} setRangeId={setRangeId} showScatter={t.showScatter} />
          )}
          {tab === "cycles" && <PastCyclesView />}
          {tab === "allpolls" && <AllPollsView focus={focusPoll} onBack={focusPoll ? backFromPoll : null} />}
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
            ? "Broadsheet – hairline rules, no card chrome."
            : "Dashboard – each view in its own bordered card."}
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
