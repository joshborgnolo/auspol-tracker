/* auspol tracker – "wind the dial back": the masthead mark, replayed across the term.

   The mark is not decoration. Its graduation bars are the primary-vote
   aggregate, its needle is two-party preferred, and the right half of its arc
   is coloured for whichever party is Labor's strongest challenger. Clicking it
   winds the instrument back to the May 2025 election and lets the term run.

   Everything here is the same monthly aggregate the charts draw. Two liberties,
   both deliberate:

   - BAR ORDER re-ranks live: each month's tallest bar holds the leftmost
     slot, and the slot assignment is interpolated between months, so a party
     overtaking another arrives as two bars visibly trading places. One
     Nation's climb past the Greens and then the Coalition is the point of
     the replay, and a swap of position carries it better than height alone.
   - BAR HEIGHT is on an absolute 0-40% scale, not normalised per month. The
     resting glyph normalises because it only ever shows one month; here that
     would flatten the very growth being replayed.

   The arc wavers between blue and orange over the closing months. That is not
   a glitch – the challenger genuinely changes hands from month to month once
   One Nation and the Coalition converge. */

const WM_GC = { cx: 22, cy: 24.5, r: 12 };
const WM_SLOT_DEG = [-54, -18, 18, 54];
const WM_MAX_PCT = 40;          // absolute domain for bar heights
const WM_BAR_MAX = 13;          // units of bar at 40%
const WM_SWING_PTS = 12;        // margin that deflects the needle fully
const WM_SWING_DEG = 34;
const WM_NEEDLE_R = 8.6;        // needle length
const WM_ENV_R = 10.75;         // swept-range arc: clear of the needle, inside the dial
const WM_LABEL_R = 29;          // labels sit on one ring, like numerals on a bezel
const WM_LABEL_SEP = 21;        // min degrees between labels before they push apart
/* Slot 0 always holds the month's TALLEST bar, and at 54 degrees off vertical
   that bar reaches far enough out that a reading centred on the ring sits on
   top of it — the value line hangs below the ring point, i.e. straight into
   the oncoming bar. Lift the outer readings clear. Applied by slot ANGLE, not
   by party, so it stays symmetric as the bars re-rank, and eased by the square
   of the angle so a label crossing slots doesn't jump. */
const WM_OUTER_LIFT = 3.4;
const WM_BAR_SEP = 11;          // min degrees between bars, so a swap passes rather than merges

/* Push items apart along the dial until none are closer than `sep`. Used for
   both bars and their labels; at rest the four slots are 36 degrees apart so
   it engages only while two are trading places. */
function separate(items, sep) {
  const a = items.map((o) => ({ ...o })).sort((x, y) => x.a - y.a);
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

const wmPolar = (deg, r) => ({
  x: WM_GC.cx + Math.sin((deg * Math.PI) / 180) * r,
  y: WM_GC.cy - Math.cos((deg * Math.PI) / 180) * r,
});
const wmArc = (d1, d2, r) => {
  const a = wmPolar(d1, r), b = wmPolar(d2, r);
  return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${r} ${r} 0 0 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
};
const PARTY_ABBR = { alp: "ALP", lnp: "L/NP", grn: "GRN", onp: "ON" };
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
  const IDS = ["alp", "lnp", "grn", "onp"];
  return D.agg2pp.map((m) => {
    const on = onBy.get(m.ym);
    const cands = [{ id: "lnp", abbr: "Coalition", color: "var(--lnp)", lab: m.alp, opp: m.lnp }];
    if (on) cands.push({ id: "onp", abbr: "One Nation", color: "var(--onp)", lab: on.a, opp: on.b });
    const top = cands.slice().sort((x, y) => y.opp - x.opp)[0];
    const prim = primBy.get(m.ym) || null;
    const vals = {};
    IDS.forEach((id) => { vals[id] = prim ? (prim[id] ?? null) : null; });
    // this month's standing decides which slot each bar occupies
    const slots = {};
    IDS.slice().sort((a, b) => (vals[b] ?? -1) - (vals[a] ?? -1))
       .forEach((id, k) => { slots[id] = k; });
    return {
      ym: m.ym, election: !!m.election,
      lab: top.lab, opp: top.opp, margin: +(top.lab - top.opp).toFixed(1),
      oppId: top.id, oppName: top.abbr, oppColor: top.color,
      vals, slots,
    };
  });
}

/* The dial itself, drawn at an arbitrary FLOAT position in the story so the
   same function serves the replay, the scrub and the resting state. */
function DialFigure({ story, f, envelope, trail }) {
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

  /* Bars interpolate BOTH height and slot. The slot lerp is what makes an
     overtake legible: for the month it happens, the two bars swing past each
     other on the arc and settle swapped. */
  const bars = ["alp", "lnp", "grn", "onp"].map((id) => {
    const vA = A.vals[id], vB = B.vals[id];
    if (vA == null && vB == null) return null;
    return {
      id,
      v: lerp(vA == null ? vB : vA, vB == null ? vA : vB, t),
      deg: lerp(WM_SLOT_DEG[A.slots[id]], WM_SLOT_DEG[B.slots[id]], t),
    };
  }).filter(Boolean);

  /* Two bars mid-overtake land on the same angle and the front one simply
     hides the back one – the swap's whole point vanishes at the moment it
     happens. Holding them a few degrees apart lets them slide visibly past
     each other. Only the transition angle is eased here; both heights stay
     exactly what the month reported. */
  const barRing = separate(bars.map((b) => ({ ...b, a: b.deg })), WM_BAR_SEP);
  const labelRing = separate(barRing, WM_LABEL_SEP);

  return (
    <g className="dl-fig">
      {/* envelope of everywhere the needle has been */}
      {/* Everywhere the needle has been, drawn as a band at the tip radius
          rather than a wedge from the pivot: it reads as an arc the needle has
          swept, which is what it is, and survives being faint. End ticks mark
          the extremes of the term. */}
      {/* Everywhere the needle has been. This used to sit at radius 8.6 – the
          needle's exact length – so the arc hid under the needle and its end
          ticks read as a stray grey hook crossing the sweep. It now occupies
          its own band between the needle tip and the dial face, where it reads
          as a range rather than debris. */}
      {envelope && envelope.max > envelope.min + 2 && (
        <g className="dl-envelope">
          <path d={wmArc(envelope.min, envelope.max, WM_ENV_R)} />
          {[envelope.min, envelope.max].map((d, k) => (
            <line key={k} x1={wmPolar(d, WM_ENV_R - 0.85).x} y1={wmPolar(d, WM_ENV_R - 0.85).y}
                  x2={wmPolar(d, WM_ENV_R + 0.85).x} y2={wmPolar(d, WM_ENV_R + 0.85).y} />
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

      {/* graduation bars – primary vote, absolute scale */}
      {barRing.map((b) => {
        const h = Math.max(0.6, (b.v / WM_MAX_PCT) * WM_BAR_MAX);
        const inner = wmPolar(b.a, WM_GC.r + 2);
        const outer = wmPolar(b.a, WM_GC.r + 2 + h);
        return (
          <line key={b.id} className="dl-bar" x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y}
                stroke={`var(--${b.id})`} />
        );
      })}

      {/* Readings on a single ring, like numerals on a bezel. Previously each
          label hung a fixed gap beyond its own bar tip, so their radii ranged
          over seven units – they scattered, and horizontal text beside a steep
          bar landed on top of it. A common ring keeps them level and clear,
          and naming the party matters now that the bars reorder. */}
      {labelRing.map((b) => {
        const p = wmPolar(b.a, WM_LABEL_R);
        p.y -= WM_OUTER_LIFT * Math.pow(Math.min(1, Math.abs(b.a) / 54), 2);
        return (
          <g key={b.id} className="dl-read">
            <text className="dl-read-party" x={p.x} y={p.y - 1.9} textAnchor="middle"
                  fill={`var(--${b.id})`}>{PARTY_ABBR[b.id]}</text>
            <text className="dl-read-val" x={p.x} y={p.y + 1.9} textAnchor="middle">{b.v.toFixed(1)}</text>
          </g>
        );
      })}

      {/* needle trail – recent positions, fading behind the needle */}
      {trail && trail.map((tr, k) => (
        <line key={"t" + k} className="dl-trail" x1={WM_GC.cx} y1={WM_GC.cy}
              x2={wmPolar(tr, 8.6).x} y2={wmPolar(tr, 8.6).y}
              style={{ opacity: ((k + 1) / trail.length) * 0.22 }} />
      ))}

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
   The timeline, as a line graph rather than a rule.

   It used to be a flat 2px line with event ticks on it: a scrub bar that
   happened to sit under a chart, carrying no reading of its own. The playhead
   travelled left to right and told you only where in the term you were.

   It now traces Labor's two-party-preferred against WHICHEVER CHALLENGER LED
   that month - story[i].lab, the same figure the caption and the needle use -
   so the term reads as a shape while it plays, and the dial has a second,
   slower account of itself running underneath.

   Two things it can show that the dial cannot:

   - The line is coloured by the CHALLENGER, run by run. The file's own opening
     note says the arc "wavers between blue and orange over the closing months"
     because the challenger genuinely changes hands once One Nation and the
     Coalition converge. On the dial that is a flicker you have to be told is
     real; here the trace itself goes orange and back, in place, against the
     months either side of it.
   - The 50 line. The needle only ever says who leads; the graph says how close
     to level it has come, which over this term is the whole movement.

   The path ahead of the playhead is drawn faint and the trace fills in behind
   it, so the shape is foreshadowed rather than sprung - and once the replay
   ends the whole term is simply there to scrub.

   preserveAspectRatio="none" lets month position map straight to track width
   with no letterboxing; non-scaling-stroke keeps the strokes honest under that
   distortion. The playhead and the event ticks stay HTML - a circle in a
   stretched viewBox would render as an ellipse. */
function DialTrack({ story, f, evs, playing }) {
  const n = story.length;
  const VB = 100;
  const { lo, hi } = useMemo(() => {
    const vals = story.map((s) => s.lab);
    // 50 is always in frame: "how near level" is the reading, and a domain that
    // floated with the data would silently rescale that away
    return { lo: Math.min(50, ...vals) - 1.4, hi: Math.max(50, ...vals) + 0.8 };
  }, [story]);
  const sx = (i) => (n < 2 ? 0 : (i / (n - 1)) * VB);
  const sy = (v) => ((hi - v) / (hi - lo)) * VB;

  const fi = Math.max(0, Math.min(n - 1, Math.floor(f)));
  const ft = Math.max(0, Math.min(1, f - fi));
  /* The SAME easing the needle uses, applied to x AND y. Easing only y would
     lift the playhead off its own line; easing both keeps it on the segment
     and keeps the dot and the needle telling one story about a month. */
  const et = smooth(ft);
  const headI = fi + et * (fi < n - 1 ? 1 : 0);
  const headV = lerp(story[fi].lab, story[Math.min(n - 1, fi + 1)].lab, et);

  const pt = (i, v) => `${sx(i).toFixed(2)},${sy(v).toFixed(2)}`;
  const ghost = story.map((s, i) => pt(i, s.lab)).join(" ");

  /* Traced points up to the playhead, then split into runs of one challenger.
     A run starts from the previous month's point so the line stays continuous
     across a handover: the segment INTO a month takes that month's colour. */
  const traced = [];
  for (let i = 0; i <= fi; i++) traced.push({ i, v: story[i].lab, id: story[i].oppId });
  if (fi < n - 1 && ft > 0) traced.push({ i: headI, v: headV, id: story[fi + 1].oppId });
  const runs = [];
  traced.forEach((p, k) => {
    const last = runs[runs.length - 1];
    if (!last || last.id !== p.id) runs.push({ id: p.id, pts: k ? [traced[k - 1], p] : [p] });
    else last.pts.push(p);
  });

  const y50 = sy(50);
  const headPct = { left: (headI / Math.max(1, n - 1)) * 100, top: (sy(headV) / VB) * 100 };

  return (
    <React.Fragment>
      <svg className="dl-spark" viewBox={`0 0 ${VB} ${VB}`} preserveAspectRatio="none" aria-hidden="true">
        {/* the majority line */}
        <line className="dl-spark-50" x1="0" x2={VB} y1={y50} y2={y50} vectorEffect="non-scaling-stroke" />
        {/* the term ahead, faint */}
        <polyline className="dl-spark-ghost" points={ghost} vectorEffect="non-scaling-stroke" />
        {/* the term so far, in the colour of who was challenging */}
        {runs.map((r, k) => (
          <polyline key={k} className="dl-spark-run" stroke={`var(--${r.id})`} vectorEffect="non-scaling-stroke"
                    points={r.pts.map((p) => pt(p.i, p.v)).join(" ")} />
        ))}
      </svg>
      {evs.map((e) => (
        <span key={e.i} className={"dl-tick" + (Math.abs(e.i - f) < 0.5 ? " on" : "")}
              style={{ left: `${(e.i / Math.max(1, n - 1)) * 100}%` }} title={e.label} />
      ))}
      <span className="dl-head-rule" style={{ left: `${headPct.left}%` }} />
      <span className={"dl-head" + (playing ? " playing" : "")}
            style={{ left: `${headPct.left}%`, top: `${headPct.top}%`,
                     background: `var(--${story[fi].oppId})` }} />
    </React.Fragment>
  );
}

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
     there while it flies out of the masthead – otherwise the replay runs behind
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
    const per = Math.max(285, Math.min(645, 7500 / Math.max(1, n - 1)));
    /* Accumulate elapsed time from clamped frame deltas rather than reading the
       wall clock. requestAnimationFrame stops in a hidden tab, so a wall-clock
       timeline would bank all that stalled time and snap the needle to the end
       the moment you came back. Clamping each delta means a background spell
       simply pauses the replay and it resumes where it stopped. */
    let last = performance.now(), elapsed = 0;
    let raf;
    const step = (now) => {
      /* Clamped at BOTH ends. The upper clamp is the background-tab guard
         above; the lower one is because a rAF timestamp is the start of the
         frame, which can predate the performance.now() taken when this effect
         ran a moment into that same frame. That made the first delta negative,
         elapsed negative, and Math.floor(v) equal to -1 - and story[-1].margin
         threw, killing the replay on its opening frame before it moved. It
         depended on where in the frame the effect landed, so it struck
         intermittently and left the dial sitting at the election. */
      elapsed += Math.max(0, Math.min(100, now - last));
      last = now;
      const v = Math.max(0, Math.min(n - 1, elapsed / per));
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

  /* Event text lives in a reserved HTML line above the dial, not inside the
     SVG: the old rim label sat at a fixed angle the needle swept straight
     through, at 2.7 SVG units – neither anchored to anything nor readable.
     The line's height is fixed so its appearance never shifts layout; a short
     plateau then fade keeps it readable while the playhead crosses the month. */
  const near = evs.find((e) => Math.abs(e.i - f) < 0.7);
  const evOp = near ? Math.min(1, (0.7 - Math.abs(near.i - f)) / 0.35) : 0;

  const replay = () => {
    trailRef.current = [];
    envRef.current = { min: 999, max: -999 };
    setF(0);
    setPlaying(true);
  };

  return (
    <div className="dl-backdrop" role="dialog" aria-modal="true" aria-label="The auspol tracker dial, replayed across the term"
         onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dl-shell" ref={shellRef}>
        <button className="dl-close" onClick={onClose} ref={closeRef} aria-label="Close">×</button>

        <figure className="dl-figure">
          <div className="dl-event" aria-live="polite">
            {near && (
              <span style={{ opacity: evOp }}>
                <i className="dl-event-dot" aria-hidden="true"></i>{near.short}
              </span>
            )}
          </div>
          <svg viewBox="-9 -11 62 48" className="dl-svg" role="img"
               aria-label={`Dial for ${monthLabel}: Labor ${cur.lab.toFixed(1)} versus ${cur.oppName} ${cur.opp.toFixed(1)} two-party preferred`}>
            <DialFigure story={story} f={f} envelope={envRef.current} trail={trailRef.current} />
          </svg>

          <figcaption className="dl-cap">
            <div className="dl-month">{monthLabel}{cur.election && <span className="dl-tag">Election</span>}</div>
            <div className="dl-contest">
              <span style={{ color: "var(--alp-text)" }}>Labor {cur.lab.toFixed(1)}</span>
              <span className="dl-v">v</span>
              <span style={{ color: inkOf(cur.oppColor) }}>{cur.oppName} {cur.opp.toFixed(1)}</span>
            </div>
            <div className="dl-note">
              two-party preferred · Needle leans to whoever leads
            </div>
          </figcaption>
        </figure>

        {/* timeline: Labor's 2PP against that month's challenger, traced as it
            plays and scrubbable once it has run. aria-valuetext carries the
            reading, because the graph is now the point of the control and a
            bare month index would describe none of it. */}
        <div className={"dl-track" + (playing ? " playing" : "")} ref={scrubRef}
             onPointerDown={onScrubDown}
             role={playing ? undefined : "slider"}
             aria-valuemin={0} aria-valuemax={n - 1} aria-valuenow={i}
             aria-valuetext={`${monthLabel}: Labor ${cur.lab.toFixed(1)} against ${cur.oppName} ${cur.opp.toFixed(1)}`}
             aria-label="Month" tabIndex={playing ? -1 : 0}>
          <DialTrack story={story} f={f} evs={evs} playing={playing} />
        </div>

        <div className="dl-foot">
          <span className="dl-legend">
            Bars are the primary vote, reordering as parties overtake one another. The right of
            the arc — and the line below — take the colour of Labor’s strongest challenger that
            month; the line is Labor’s two-party preferred against them, measured from 50.
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
