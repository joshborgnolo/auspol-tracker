/* auspol — "wind the dial back": the masthead mark, replayed across the term.

   The mark is not decoration. Its graduation bars are the primary-vote
   aggregate, its needle is two-party preferred, and the right half of its arc
   is coloured for whichever party is Labor's strongest challenger. Clicking it
   winds the instrument back to the May 2025 election and lets the term run.

   Everything here is the same monthly aggregate the charts draw. Two liberties,
   both deliberate:

   - BAR ORDER is pinned to election-day standing rather than sorted
     tallest-first as the resting glyph does. One Nation climbing past the
     Coalition is the movement worth seeing, and re-sorting every month would
     hide it behind shuffling bars.
   - BAR HEIGHT is on an absolute 0-40% scale, not normalised per month. The
     resting glyph normalises because it only ever shows one month; here that
     would flatten the very growth being replayed.

   The arc wavers between blue and orange over the closing months. That is not
   a glitch — the challenger genuinely changes hands from month to month once
   One Nation and the Coalition converge. */

const WM_GC = { cx: 22, cy: 24.5, r: 12 };
const WM_SLOT_DEG = [-54, -18, 18, 54];
const WM_MAX_PCT = 40;          // absolute domain for bar heights
const WM_BAR_MAX = 13;          // units of bar at 40%
const WM_SWING_PTS = 12;        // margin that deflects the needle fully
const WM_SWING_DEG = 34;

const wmPolar = (deg, r) => ({
  x: WM_GC.cx + Math.sin((deg * Math.PI) / 180) * r,
  y: WM_GC.cy - Math.cos((deg * Math.PI) / 180) * r,
});
const wmArc = (d1, d2, r) => {
  const a = wmPolar(d1, r), b = wmPolar(d2, r);
  return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${r} ${r} 0 0 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
};
const wmDeg = (margin) =>
  -Math.max(-1, Math.min(1, margin / WM_SWING_PTS)) * WM_SWING_DEG;   // negative = Labor side
const lerp = (a, b, t) => a + (b - a) * t;
// eased inside each month, so the needle settles from reading to reading like
// an instrument rather than gliding uniformly through them
const smooth = (t) => t * t * t * (t * (t * 6 - 15) + 10);

/* One frame of the story per month on the 2PP spine. */
function buildDialStory(D) {
  const primBy = new Map(D.aggPrimary.map((p) => [p.ym, p]));
  const onBy = new Map((D.alt2pp.alp_on || []).map((p) => [p.ym, p]));
  const first = D.aggPrimary[0];
  const order = ["alp", "lnp", "grn", "onp"]
    .sort((a, b) => (first[b] || 0) - (first[a] || 0));      // election-day standing
  return D.agg2pp.map((m) => {
    const on = onBy.get(m.ym);
    const cands = [{ id: "lnp", abbr: "Coalition", color: "var(--lnp)", lab: m.alp, opp: m.lnp }];
    if (on) cands.push({ id: "onp", abbr: "One Nation", color: "var(--onp)", lab: on.a, opp: on.b });
    const top = cands.slice().sort((x, y) => y.opp - x.opp)[0];
    const prim = primBy.get(m.ym) || null;
    return {
      ym: m.ym, election: !!m.election,
      lab: top.lab, opp: top.opp, margin: +(top.lab - top.opp).toFixed(1),
      oppId: top.id, oppName: top.abbr, oppColor: top.color,
      bars: order.map((id) => ({ id, v: prim ? prim[id] : null })),
    };
  });
}

/* The dial itself, drawn at an arbitrary FLOAT position in the story so the
   same function serves the replay, the scrub and the resting state. */
function DialFigure({ story, f, envelope, trail, flash }) {
  const D = window.AP.D;
  const i0 = Math.max(0, Math.min(story.length - 1, Math.floor(f)));
  const i1 = Math.min(story.length - 1, i0 + 1);
  const t = smooth(Math.max(0, Math.min(1, f - i0)));
  const A = story[i0], B = story[i1];

  const margin = lerp(A.margin, B.margin, t);
  const deg = wmDeg(margin);
  const labLeads = margin >= 0;
  // crossfade the challenger colour rather than switching it, so the closing
  // months read as a contest wavering instead of a light flickering
  const oppMix = A.oppId === B.oppId ? 0 : t;
  const needleColor = labLeads ? "var(--alp)" : (oppMix > 0.5 ? B.oppColor : A.oppColor);

  const bars = A.bars.map((bar, k) => ({
    id: bar.id,
    v: bar.v == null ? null : lerp(bar.v, B.bars[k].v == null ? bar.v : B.bars[k].v, t),
    deg: WM_SLOT_DEG[k],
  }));

  return (
    <g className="dl-fig">
      {/* envelope of everywhere the needle has been */}
      {/* Everywhere the needle has been, drawn as a band at the tip radius
          rather than a wedge from the pivot: it reads as an arc the needle has
          swept, which is what it is, and survives being faint. End ticks mark
          the extremes of the term. */}
      {envelope && envelope.max > envelope.min + 0.4 && (
        <g className="dl-envelope">
          <path d={wmArc(envelope.min, envelope.max, 8.6)} />
          {[envelope.min, envelope.max].map((d, k) => (
            <line key={k} x1={wmPolar(d, 7.6).x} y1={wmPolar(d, 7.6).y}
                  x2={wmPolar(d, 9.6).x} y2={wmPolar(d, 9.6).y} />
          ))}
        </g>
      )}

      {/* the two-tone swing arc */}
      <path className="dl-arc" d={wmArc(-90, 0, WM_GC.r)} stroke="var(--alp)" />
      <path className="dl-arc" d={wmArc(0, 90, WM_GC.r)} stroke={A.oppColor}
            style={{ opacity: 1 - oppMix }} />
      {oppMix > 0 && (
        <path className="dl-arc" d={wmArc(0, 90, WM_GC.r)} stroke={B.oppColor}
              style={{ opacity: oppMix }} />
      )}

      {/* graduation bars — primary vote, absolute scale, fixed slots */}
      {bars.map((b) => {
        if (b.v == null) return null;
        const h = Math.max(0.6, (b.v / WM_MAX_PCT) * WM_BAR_MAX);
        const inner = wmPolar(b.deg, WM_GC.r + 2);
        const outer = wmPolar(b.deg, WM_GC.r + 2 + h);
        return (
          <g key={b.id}>
            <line className="dl-bar" x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y}
                  stroke={`var(--${b.id})`} />
            <text className="dl-bar-val" x={wmPolar(b.deg, WM_GC.r + 4.4 + h).x}
                  y={wmPolar(b.deg, WM_GC.r + 4.4 + h).y}
                  textAnchor="middle" dominantBaseline="middle">{b.v.toFixed(1)}</text>
          </g>
        );
      })}

      {/* needle trail — recent positions, fading behind the needle */}
      {trail && trail.map((tr, k) => (
        <line key={"t" + k} className="dl-trail" x1={WM_GC.cx} y1={WM_GC.cy}
              x2={wmPolar(tr, 8.6).x} y2={wmPolar(tr, 8.6).y}
              style={{ opacity: ((k + 1) / trail.length) * 0.22 }} />
      ))}

      {/* a key event, flashed on the rim as the playhead passes its month */}
      {flash && (
        <g className="dl-flash" style={{ opacity: flash.op }}>
          <line x1={wmPolar(flash.deg, WM_GC.r - 3).x} y1={wmPolar(flash.deg, WM_GC.r - 3).y}
                x2={wmPolar(flash.deg, WM_GC.r + 1).x} y2={wmPolar(flash.deg, WM_GC.r + 1).y} />
          <text x={wmPolar(flash.deg, WM_GC.r - 5.4).x} y={wmPolar(flash.deg, WM_GC.r - 5.4).y}
                textAnchor="middle" dominantBaseline="middle">{flash.short}</text>
        </g>
      )}

      {/* the needle */}
      <g transform={`translate(${WM_GC.cx}, ${WM_GC.cy}) rotate(${deg.toFixed(2)})`}>
        <line className="dl-needle" x1="0" y1="0" x2="0" y2="-8.6" stroke={needleColor} />
        <circle className="dl-needle-tip" cx="0" cy="-8.6" r="1.9" fill={needleColor} />
      </g>
      <circle className="dl-pivot" cx={WM_GC.cx} cy={WM_GC.cy} r="1.7" />
    </g>
  );
}

Object.assign(window, { buildDialStory, DialFigure, WM_GC, wmPolar, wmDeg, WM_SWING_DEG });

/* ====================================================================
   The overlay. Opens by flying out of the masthead (FLIP), replays the
   term, then hands the timeline over to be scrubbed.
   ==================================================================== */
function DialStory({ originRect, onClose }) {
  const D = window.AP.D;
  const story = useMemo(() => buildDialStory(D), []);
  const n = story.length;
  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // events pinned to their month on the spine, for the rim flash and the ticks
  const evs = useMemo(() => (D.events || []).filter((e) => e.major).map((e) => {
    const ym = e.date.slice(0, 7);
    const i = story.findIndex((s) => s.ym === ym);
    return i < 0 ? null : { i, short: e.short, label: e.label };
  }).filter(Boolean), [story]);

  const [f, setF] = useState(reduce ? n - 1 : 0);
  /* Starts NOT playing. The dial opens wound back to the election and holds
     there while it flies out of the masthead — otherwise the replay runs behind
     the fly-in and the whole thing is over before it has arrived. */
  const [playing, setPlaying] = useState(false);
  const [lifted, setLifted] = useState(false);
  const trailRef = useRef([]);
  const envRef = useRef(reduce
    ? story.reduce((a, s) => ({ min: Math.min(a.min, wmDeg(s.margin)), max: Math.max(a.max, wmDeg(s.margin)) }),
                   { min: 999, max: -999 })
    : { min: 999, max: -999 });
  const [, forceTick] = useState(0);
  const shellRef = useRef(null);
  const closeRef = useRef(null);
  const scrubRef = useRef(null);

  // ---- lift out of the masthead ----
  React.useLayoutEffect(() => {
    const el = shellRef.current;
    if (!el || !originRect) { setLifted(true); return; }
    const r = el.getBoundingClientRect();
    const sc = Math.max(0.06, originRect.width / r.width);
    el.style.transform =
      `translate(${originRect.left + originRect.width / 2 - (r.left + r.width / 2)}px, ` +
      `${originRect.top + originRect.height / 2 - (r.top + r.height / 2)}px) scale(${sc})`;
    el.style.opacity = "0.2";
    requestAnimationFrame(() => requestAnimationFrame(() => {
      el.style.transition = "transform .62s cubic-bezier(.22,.9,.24,1), opacity .34s ease";
      el.style.transform = "none";
      el.style.opacity = "1";
      setLifted(true);
    }));
  }, []);

  // land, register that it is wound back, then run
  useEffect(() => {
    if (reduce) return;
    const t = setTimeout(() => setPlaying(true), 900);
    return () => clearTimeout(t);
  }, []);

  // ---- the replay ----
  useEffect(() => {
    if (!playing) return;
    const per = Math.max(190, Math.min(430, 5000 / Math.max(1, n - 1)));
    /* Accumulate elapsed time from clamped frame deltas rather than reading the
       wall clock. requestAnimationFrame stops in a hidden tab, so a wall-clock
       timeline would bank all that stalled time and snap the needle to the end
       the moment you came back. Clamping each delta means a background spell
       simply pauses the replay and it resumes where it stopped. */
    let last = performance.now(), elapsed = 0;
    let raf;
    const step = (now) => {
      elapsed += Math.min(100, now - last);
      last = now;
      const v = Math.min(n - 1, elapsed / per);
      setF(v);
      const d = wmDeg(lerp(story[Math.floor(v)].margin,
                           story[Math.min(n - 1, Math.floor(v) + 1)].margin,
                           smooth(v - Math.floor(v))));
      const tr = trailRef.current;
      tr.push(d);
      if (tr.length > 34) tr.shift();
      const e = envRef.current;
      if (d < e.min) e.min = d;
      if (d > e.max) e.max = d;
      if (v >= n - 1) { setPlaying(false); forceTick((x) => x + 1); return; }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing, n]);

  // ---- keyboard + focus ----
  useEffect(() => {
    const onKey = (ev) => {
      if (ev.key === "Escape") { ev.preventDefault(); onClose(); }
      if (!playing && (ev.key === "ArrowLeft" || ev.key === "ArrowRight")) {
        ev.preventDefault();
        setF((v) => Math.max(0, Math.min(n - 1, Math.round(v) + (ev.key === "ArrowRight" ? 1 : -1))));
      }
    };
    document.addEventListener("keydown", onKey);
    const prev = document.activeElement;
    const body = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current && closeRef.current.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = body;
      prev && prev.focus && prev.focus();
    };
  }, [playing, n]);

  // ---- scrub ----
  const scrubTo = (clientX) => {
    const el = scrubRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const p = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    setF(p * (n - 1));
    trailRef.current = [];
  };
  const onScrubDown = (e) => {
    if (playing) return;
    e.preventDefault();
    scrubTo(e.clientX);
    const move = (ev) => scrubTo(ev.clientX);
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const i = Math.max(0, Math.min(n - 1, Math.round(f)));
  const cur = story[i];
  const [yy, mm] = cur.ym.split("-").map(Number);
  const monthLabel = D.monthNameFull(mm) + " " + yy;

  // rim flash for an event in the month being shown
  const near = evs.find((e) => Math.abs(e.i - f) < 0.55);
  const flash = near
    ? { deg: -WM_SWING_DEG - 12, short: near.short, op: 1 - Math.abs(near.i - f) / 0.55 }
    : null;

  const replay = () => {
    trailRef.current = [];
    envRef.current = { min: 999, max: -999 };
    setF(0);
    setPlaying(true);
  };

  return (
    <div className="dl-backdrop" role="dialog" aria-modal="true" aria-label="The auspol dial, replayed across the term"
         onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dl-shell" ref={shellRef}>
        <button className="dl-close" onClick={onClose} ref={closeRef} aria-label="Close">×</button>

        <figure className="dl-figure">
          <svg viewBox="-9 -11 62 48" className="dl-svg" role="img"
               aria-label={`Dial for ${monthLabel}: Labor ${cur.lab.toFixed(1)} versus ${cur.oppName} ${cur.opp.toFixed(1)} two-party preferred`}>
            <DialFigure story={story} f={f} envelope={envRef.current} trail={trailRef.current} flash={flash} />
          </svg>

          <figcaption className="dl-cap">
            <div className="dl-month">{monthLabel}{cur.election && <span className="dl-tag">election</span>}</div>
            <div className="dl-contest">
              <span style={{ color: "var(--alp)" }}>Labor {cur.lab.toFixed(1)}</span>
              <span className="dl-v">v</span>
              <span style={{ color: cur.oppColor }}>{cur.oppName} {cur.opp.toFixed(1)}</span>
            </div>
            <div className="dl-note">
              two-party preferred · needle leans to whoever leads
            </div>
          </figcaption>
        </figure>

        {/* timeline: progress while playing, scrubbable once it has run */}
        <div className={"dl-track" + (playing ? " playing" : "")} ref={scrubRef}
             onPointerDown={onScrubDown}
             role={playing ? undefined : "slider"}
             aria-valuemin={0} aria-valuemax={n - 1} aria-valuenow={i}
             aria-label="Month" tabIndex={playing ? -1 : 0}>
          <div className="dl-track-line" />
          {evs.map((e) => (
            <span key={e.i} className="dl-tick" style={{ left: `${(e.i / (n - 1)) * 100}%` }} title={e.label} />
          ))}
          <div className="dl-head" style={{ left: `${(f / (n - 1)) * 100}%` }} />
        </div>

        <div className="dl-foot">
          <span className="dl-legend">
            Bars are the primary vote, tallest to shortest at the election. The right of the arc
            takes the colour of Labor’s strongest challenger that month.
          </span>
          <button className="dl-replay" onClick={replay} disabled={playing}>
            {playing ? "Playing…" : "Replay"}
          </button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { DialStory });
