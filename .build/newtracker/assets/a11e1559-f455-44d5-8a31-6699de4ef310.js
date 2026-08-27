/* auspol tracker – lower panels: primary vote, leaders, pollster table */

// ---- small shared UI ------------------------------------------------

/* Keyboard behaviour for a role="radiogroup" of role="radio" buttons.

   The markup already claimed the radio pattern; this supplies the half of it a
   screen-reader user is entitled to expect. A radio group is ONE tab stop
   (roving tabindex) and the arrows move within it, selecting as they go —
   otherwise Tab walks every option and the arrows, which is what the
   announcement tells you to press, do nothing at all. */
function useRadioGroup(options, value, onChange) {
  const refs = useRef({});
  const ids = options.map((o) => o.id);
  const onKeyDown = (e) => {
    const i = ids.indexOf(value);
    let next = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = ids[(i + 1) % ids.length];
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = ids[(i - 1 + ids.length) % ids.length];
    else if (e.key === "Home") next = ids[0];
    else if (e.key === "End") next = ids[ids.length - 1];
    if (next == null) return;
    e.preventDefault();
    onChange(next);
    const el = refs.current[next];
    if (el) el.focus();
  };
  return {
    onKeyDown,
    // the checked option holds the tab stop; an empty selection falls back to
    // the first, so the group is always reachable
    tabIndexFor: (id) => (id === value || (ids.indexOf(value) < 0 && id === ids[0]) ? 0 : -1),
    refFor: (id) => (el) => { refs.current[id] = el; },
  };
}

function Segmented({ options, value, onChange, size, ariaLabel }) {
  const rg = useRadioGroup(options, value, onChange);
  return (
    <div className={"segmented" + (size === "sm" ? " segmented-sm" : "")}
         role="radiogroup" aria-label={ariaLabel} onKeyDown={rg.onKeyDown}>
      {options.map((o) => (
        <button key={o.id} role="radio" aria-checked={value === o.id}
                tabIndex={rg.tabIndexFor(o.id)} ref={rg.refFor(o.id)}
                className={"seg-btn" + (value === o.id ? " active" : "")}
                onClick={() => onChange(o.id)}>{o.label}</button>
      ))}
    </div>
  );
}

// quiet, editorial control – reads as type, not a widget
// Render a matchup label ("ALP v L/NP") as shared party tokens + a quiet
// "v" connective, so party abbreviations share one vocabulary with the
// sticky scoreboard. Non-matchup labels (3M, Leadership…) pass through plain.
function toggleLabel(label) {
  if (typeof label === "string" && / v /.test(label)) {
    const [a, b] = label.split(" v ");
    return (
      <>
        <span className="party-tok">{a}</span>
        <span className="tt-vs">v</span>
        <span className="party-tok">{b}</span>
      </>
    );
  }
  return label;
}

function TextToggle({ options, value, onChange, caps, ariaLabel }) {
  const rg = useRadioGroup(options, value, onChange);
  return (
    <div className={"text-toggle" + (caps ? " tt-caps" : "")} role="radiogroup"
         aria-label={ariaLabel} onKeyDown={rg.onKeyDown}>
      {options.map((o, i) => (
        <React.Fragment key={o.id}>
          {i > 0 && <span className="tt-div" aria-hidden="true"></span>}
          <button role="radio" aria-checked={value === o.id}
                  tabIndex={rg.tabIndexFor(o.id)} ref={rg.refFor(o.id)}
                  className={"tt-opt" + (value === o.id ? " active" : "")}
                  onClick={() => onChange(o.id)}>
            {o.dots && o.dots.length === 2 ? (
              <>
                <span className="tt-dot tt-dot-l" aria-hidden="true" style={{ background: o.dots[0] }}></span>
                {toggleLabel(o.label)}
                <span className="tt-dot tt-dot-r" aria-hidden="true" style={{ background: o.dots[1] }}></span>
              </>
            ) : (
              <>
                {o.dots && (
                  <span className="tt-dots" aria-hidden="true">
                    {o.dots.map((c, k) => (
                      <span key={k} className="tt-dot" style={{ background: c }}></span>
                    ))}
                  </span>
                )}
                {toggleLabel(o.label)}
              </>
            )}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
}

// ---- ragged-series helpers (real data: not every leader is polled every
// month, so series are built from non-null readings only) -------------
function seriesNN(pts, key) {
  return pts.map((d) => ({ x: d.x, y: d[key] })).filter((p) => p.y != null);
}
// the same, keeping the month – blendRows matches two versions of a line by ym
function seriesYm(pts, key) {
  return pts.map((d) => ({ ym: d.ym, x: d.x, y: d[key] })).filter((p) => p.y != null);
}
// last two published readings for a key → { v, ym, prev, prevYm } (or null).
// prevYm is carried so a delta can name the month it measures from – these are
// PUBLISHED readings, so the gap is often more than one month.
function lastReadings(rows, key) {
  const nn = rows.filter((r) => r[key] != null);
  if (!nn.length) return null;
  const last = nn[nn.length - 1], prev = nn[nn.length - 2];
  return { v: last[key], ym: last.ym, prev: prev ? prev[key] : null, prevYm: prev ? prev.ym : null };
}
// what a snapshot-panel delta is measured against, spelled out – these compare
// monthly AGGREGATE readings, unlike the archive's ChgTag which compares a
// single pollster with its own previous poll
function readoutDeltaTitle(r) {
  if (!r || r.prevYm == null) return undefined;
  return "Change since " + window.AP.monthLabelFull(r.prevYm)
       + " – this leader's previous published monthly reading across all pollsters,"
       + " not one pollster's own last poll";
}
// short month tag ("May") for a reading older than the latest row
function staleTag(ym, latestYm) {
  if (!ym || ym === latestYm) return null;
  return window.AP.D.monthName(Number(ym.slice(5, 7)));
}
// y-domain fitted to the data, snapped outward to `step`, edge ticks trimmed
function fitDomain(vals, step, include) {
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (include != null) { lo = Math.min(lo, include); hi = Math.max(hi, include); }
  const d0 = Math.floor((lo - step * 0.4) / step) * step;
  const d1 = Math.ceil((hi + step * 0.4) / step) * step;
  const ticks = [];
  for (let v = d0 + step; v < d1 - 1e-9; v += step) ticks.push(v);
  return { domain: [d0, d1], ticks };
}

/* `roll` is opt-in, and the test is whether the delta sits in a readout that
   MOVES. The hero was the only one for a while: three other figures travel
   between matchups there, so a chip that simply changed under them would be
   the one still thing in a moving readout. That is now equally true of the
   leader readouts - the preferred-PM tiles travel between the two questions,
   the approval nets roll under their own toggle - so those ask for it too. The
   direction and undecided panels still do not: nothing there is going
   anywhere, and a reel would be motion for its own sake.

   RollNum is defined by the header script, which loads after this one -
   resolved at render, and guarded so a reordering degrades to a plain figure
   rather than a blank panel. */
function Delta({ value, suffix = "", goodUp = true, small, title, roll }) {
  if (value == null) return null;
  const up = value > 0, flat = Math.abs(value) < 0.05;
  const cls = flat ? "flat" : (up === goodUp ? "up" : "down");
  const arrow = flat ? "→" : up ? "▲" : "▼";
  const figure = `${up ? "+" : ""}${value.toFixed(1)}`;
  const Roll = window.RollNum;
  return (
    <span className={"delta " + cls + (small ? " delta-sm" : "")} title={title}>
      <span className="delta-arrow">{arrow}</span>
      {flat ? "no change"
        : roll && Roll ? <><Roll value={figure} />{suffix}</>
        : figure + suffix}
    </span>
  );
}

// ---- Primary vote ---------------------------------------------------
function PrimaryVotePanel({ rangeId }) {
  const { D, rangeDomain, filterPts, buildXTicks, series } = window.AP;
  const [xDomain] = [rangeDomain(rangeId)];
  const [hidden, setHidden] = useState({});
  const latest = D.aggPrimary[D.aggPrimary.length - 1];
  // labels & series ordered by descending latest primary-vote share
  const parts = [
    { id: "alp", ...D.PARTIES.alp },
    { id: "lnp", ...D.PARTIES.lnp },
    { id: "grn", ...D.PARTIES.grn },
    { id: "onp", ...D.PARTIES.onp },
    { id: "oth", ...D.PARTIES.oth },
  ].sort((a, b) => latest[b.id] - latest[a.id]);
  const pts = filterPts(D.aggPrimary, xDomain[0]);
  // every party stays mounted; hiding a chip fades its line via opacity so
  // legend toggles feel continuous instead of popping
  const chartSeries = parts.map((p) => ({
    id: p.id, label: p.name, color: p.color, points: series(pts, p.id),
    width: p.id === "oth" ? 2 : 3,
    dashed: p.id === "oth",
    opacity: hidden[p.id] ? 0 : 1,
  }));

  // The published readings behind each line. This chart needs them MORE than
  // the 2PP one does – the houses diverge further on primary shares than on
  // two-party (One Nation's spread runs beyond sampling error), so smooth
  // lines alone overstate how settled the picture is. Five clouds at once
  // would be a mess, so a dot is drawn only while its party is un-hidden:
  // the legend chips already toggle the lines, and now they isolate a cloud.
  const primaryScatter = D.individualPolls
    .filter((p) => p.x >= xDomain[0] && p.x <= xDomain[1])
    .flatMap((p) => parts
      .filter((party) => !hidden[party.id] && p.p && p.p[party.id] != null)
      .map((party) => ({ x: p.x, y: p.p[party.id], color: party.color,
                         label: party.name, meta: p })));

  /* Five mirrored bands over a chart already carrying six hundred dots is a
     smear, not a reading – so the interval belongs to the party the reader has
     ASKED for. Turn the other chips off and the survivor gets its band, which
     is the same isolate gesture the caption already teaches for the dots. */
  const visible = parts.filter((p) => !hidden[p.id]);
  const solo = visible.length === 1 ? visible[0] : null;
  const soloBand = !solo ? [] : pts
    .filter((d) => d.ci && d.ci[solo.id] != null && d[solo.id] != null)
    .map((d) => ({ x: d.x, y0: d[solo.id] - d.ci[solo.id], y1: d[solo.id] + d.ci[solo.id] }));
  const primaryAreas = soloBand.length >= 2
    ? [{ id: "ci-" + solo.id, color: solo.color, className: "ci-band", edge: false,
         smooth: true, points: soloBand }]
    : [];

  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2 className="card-title">Primary vote</h2>
          <p className="card-sub">First-preference support, poll aggregate</p>
        </div>
        <div className="legend">
          {parts.map((p) => (
            <button key={p.id}
                    className={"legend-chip" + (hidden[p.id] ? " off" : "") + (p.id === "oth" ? " residual" : "")}
                    onClick={() => setHidden((h) => ({ ...h, [p.id]: !h[p.id] }))}>
              <span className="legend-swatch" style={{ background: p.color }}></span>
              <span className="legend-name">{p.name}</span>
              <span className="legend-val">{latest[p.id].toFixed(1)}%</span>
            </button>
          ))}
        </div>
      </div>
      <TrendChart
        key="pv"
        height={340} xDomain={xDomain} yDomain={[0, 40]}
        yTicks={[10, 20, 30, 40]} unit="%" axisFont={20}
        pad={{ l: 58, r: 20, t: 18, b: 42 }}
        xTicks={buildXTicks(xDomain[0], xDomain[1])}
        series={chartSeries} spine={series(pts, "alp")}
        areas={primaryAreas}
        scatter={primaryScatter} pollFacet="primary"
        /* The same majors the hero carries. They arguably matter more here:
           the One Nation surge is this chart's whole story, and Joyce joining
           One Nation and Farrer are two of its causes. */
        events={majorEvents()}
        tooltipTitle={(i) => window.AP.monthLabelFull(pts[i].ym)}
        fmt={(v) => v.toFixed(1)}
      />
      <p className="table-hint">
        Each dot is one published poll’s first-preference figure; the lines are
        sample-weighted, house-effect-adjusted monthly averages. Use the party
        chips above to isolate one party’s readings – on its own, a party’s line
        is drawn with the 95% interval around it{solo ? ", shaded here" : ""}.
      </p>
    </section>
  );
}

// opposition-leader handover: Angus Taylor replaced Sussan Ley on 12 Feb 2026.
// The opp-leader line splices the two, so both leadership charts mark the point
// (x = decimal year, same convention as the data's event markers).
/* Pull one event out of the dataset by date rather than restating its
   coordinates here, so a chart marker can't drift from the event rail. */
const eventOn = (iso) => (window.AP.D.events || []).find((e) => e.date === iso) || null;
const majorEvents = () => (window.AP.D.events || []).filter((e) => e.major);

/* The opposition-leader handover is ALREADY in the dataset, dated 2026-02-12,
   so take it from there rather than restating it. Referenced by date and not
   by title: a title is copy and can be reworded in data/polls.json, and a
   comment quoting one is just the same duplication this removes, one level
   down. It used to be hand-rolled here with its own wording and
   no `date` at all, which is why its click panel came out differently from
   every other event's: with nothing to put in the tooltip's date row, the date
   had been folded into `desc` and rendered as body copy, while Bondi and the
   rest show it in the date row above the description. Same shape now, so the
   same panel, and the two can no longer drift apart.

   `short` is the one thing overridden. It is the label drawn against the line,
   and on these two charts the point is the SPLICE of Ley's series into
   Taylor's, which "Ley → Taylor" names and the dataset's Liberal-leadership
   framing does not. */
const OPP_HANDOVER = (() => {
  const e = eventOn("2026-02-12");
  return e ? { ...e, short: "Ley → Taylor" } : null;
})();

/* Expand / switch / minimise for the leadership pair. Rendered inside each
   card head, and only while the panels actually share a row – below the
   two-column breakpoint they're already full width, so the control would
   promise something it can't do. */
const PZ_ICON = {
  expand: "M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3",
  minimise: "M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3",
  swap: "M4 9h13l-3-3M20 15H7l3 3",
};
function PzBtn({ icon, label, onClick }) {
  return (
    <button type="button" className={"pz-btn pz-" + icon} onClick={onClick} title={label} aria-label={label}>
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"
           strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={PZ_ICON[icon]} />
      </svg>
    </button>
  );
}
function PanelZoom({ expanded, onExpand, onSwap, onClose, label, otherLabel }) {
  if (!expanded) return <PzBtn icon="expand" label={"Expand " + label} onClick={onExpand} />;
  return (
    <div className="pz-group">
      {otherLabel && <PzBtn icon="swap" label={"Show " + otherLabel + " instead"} onClick={onSwap} />}
      <PzBtn icon="minimise" label="Show both panels" onClick={onClose} />
    </div>
  );
}

function LeadershipSection({ rangeId }) {
  const { D } = window.AP;
  /* pair  – preferred PM | net rating (default)
     ppm   – preferred PM full width
     appr  – net rating full width
     both  – approval | favourability, the two net measures side by side
     ppmboth – preferred PM two-way | three-way, the two questions side by side */
  const [view, setView] = useState("pair");
  /* Both panels show every leader. A "leaders in view" chip row used to sit
     here and gate them: it was a control for a problem the panels don't have –
     three lines is not clutter, and the one thing it was really being asked to
     express, WHICH preferred-PM contest is on screen, is a property of the
     question rather than of who you feel like looking at. The panel states
     that itself now. */
  const leaders = D.LEADERS;
  return (
    <section className="leadership">
      <div className="leadership-head">
        <h2 className="section-h">Leadership</h2>
      </div>
      <p className="leadership-note">
        The Coalition line splices leaders – <strong>Ley</strong> led to February 2026, <strong>Taylor</strong> since.
        Leadership questions run irregularly, so lines connect published readings.
        Preferred PM is put to voters as two separate two-way contests – against the opposition
        leader, and against Hanson head to head – so both are drawn, the head-to-head dashed.
      </p>
      {/* Both children stay mounted while a column collapses to 0fr, so the
          grid can animate rather than the panel popping out of existence.
          `both` swaps the left child for a second net-rating panel.

          The left child keeps ONE key across that swap, deliberately. It used
          to be re-keyed when the view split, which threw away the very things
          that animate the change: the refs holding where its tiles were and
          which question they were showing, so it rebuilt itself instead of
          moving. Choosing "both" leaves that panel on the two-way question -
          exactly the move it makes for "Two-way" - so it should look exactly
          like it, and it cannot while React is tearing it down. The panel that
          is genuinely new is the one arriving beside it. */}
      <div className={"two-col lead-grid lg-" + view}>
        {view === "both" ? (
          <ApprovalPanel key="appr-net" rangeId={rangeId} leaders={leaders}
            metric="net" lockMetric
            chrome={<PanelZoom expanded label="approval" onClose={() => setView("pair")} />} />
        ) : (
          <PreferredPMPanel key="ppm"
            rangeId={rangeId} leaders={leaders}
            {...(view === "ppmboth" ? { fmt: "2", lockFmt: true } : { onBoth: () => setView("ppmboth") })}
            chrome={view === "ppmboth"
              ? <PanelZoom expanded label="two-way" onClose={() => setView("pair")} />
              : <PanelZoom expanded={view === "ppm"} label="preferred prime minister"
                  otherLabel="net rating"
                  onExpand={() => setView("ppm")} onSwap={() => setView("appr")}
                  onClose={() => setView("pair")} />} />
        )}
        {view === "ppmboth" ? (
          <PreferredPMPanel key="ppm-3" rangeId={rangeId} leaders={leaders}
            fmt="3" lockFmt
            chrome={<PanelZoom expanded label="three-way" onClose={() => setView("pair")} />} />
        ) : (
          <ApprovalPanel key="appr"
            rangeId={rangeId} leaders={leaders}
            {...(view === "both" ? { metric: "fav", lockMetric: true } : {})}
            onBoth={() => setView("both")}
            chrome={view === "both"
              ? <PanelZoom expanded label="favourability" onClose={() => setView("pair")} />
              : <PanelZoom expanded={view === "appr"} label="net rating"
                  otherLabel="preferred prime minister"
                  onExpand={() => setView("appr")} onSwap={() => setView("ppm")}
                  onClose={() => setView("pair")} />} />
        )}
      </div>
    </section>
  );
}

// ---- Preferred PM ---------------------------------------------------
/* ---- one order, both readouts -------------------------------------------
   Prime minister, opposition leader, One Nation. The approval and preferred-PM
   readouts are the same three people, so a reader who has learned the row in
   one should not have to relearn it in the other - and inside a panel the
   order has to survive its own toggle, or switching question reshuffles the
   row as well as changing the figures and a reader tracking one leader has to
   find them again.

   Party, not name: a leadership change inside a party (Ley to Taylor, which
   this file has already been through) needs no edit here. The two party tokens
   DO swap if government changes, which is the one thing that would.

   The exception is One Nation ahead of the opposition when it would run Labor
   CLOSER than the Coalition does. Second place is a claim about who the
   contest is with, and if the 2PP says that is Hanson then leading with the
   opposition leader has the page arguing with its own headline. Tested the way
   the hero tests a month-on-month move, and for the same reason - two
   aggregates a point apart are not a fact about the electorate - so it fires
   only when the gap clears both intervals added in quadrature. */
const PM_PARTY = "ALP", OPP_PARTY = "L/NP", ONP_PARTY = "ON";
function leaderOrder(D) {
  const on = D.altLatest && D.altLatest.alp_on;
  const rival = !!on && on.a != null && D.latest.alp2pp != null
    && (D.latest.alp2pp - on.a) > Math.hypot(D.latest.alp2ppCi95 || 0, on.ci95 || 0);
  return [PM_PARTY, ...(rival ? [ONP_PARTY, OPP_PARTY] : [OPP_PARTY, ONP_PARTY])];
}
/* an unlisted party sorts last rather than first, which is what indexOf's -1
   would have done */
function byLeaderOrder(order) {
  const rank = (party) => { const i = order.indexOf(party); return i < 0 ? order.length : i; };
  return (a, b) => rank(a) - rank(b);
}

/* The two-way question is not ONE contest. Pollsters put two of them to
   voters – Albanese against the opposition leader (the whole cycle, 54 polls)
   and Albanese against Hanson head to head (11 polls, Apr 2026 on) – and
   Albanese runs ~7pp higher in the second. They cannot be averaged and they
   cannot be alternated behind a control either, because the interesting thing
   IS the pair: he leads Taylor by 4 and Hanson by 13.

   So each contest is drawn as a CHANNEL: its two lines, with the gap between
   them tinted in the opponent's colour. The gap is the lead, which is the one
   quantity the two contests can honestly be compared on – a house that leaves
   35% uncommitted depresses both of its shares, and that cancels in a margin.
   Four lines would tangle; two channels don't, because the eye reads the band
   rather than the strands. Albanese appears in both, so the head-to-head pair
   is dashed: colour says who, dash says which contest. */
const PPM_PAIRS = [
  { id: "at", suf: "_pref",  ids: ["alb", "taylor"], lab: "Albanese v the opposition leader" },
  { id: "ah", suf: "_prefH", ids: ["alb", "hanson"], lab: "Albanese v Hanson, head to head", dashed: true },
];

function PreferredPMPanel({ rangeId, leaders: allLeaders, chrome, fmt: fmtProp, lockFmt, onBoth }) {
  const { D, rangeDomain, filterPts, buildXTicks } = window.AP;
  /* Only the published figure is plotted. A "share of decided" basis used to
     sit here, on the reasoning that dividing by the people who named someone
     makes houses comparable. Measured against the archive it does the
     opposite: holding question format constant, normalising RAISES the
     between-house spread (4.41 -> 6.98pp) and the within-house spread over
     time (2.83 -> 5.62pp), because it divides by a small and moving
     denominator — uncommitted runs 16% at Newspoll against 37% at RedBridge,
     and has drifted from 35% to 14% across the cycle. It was correcting the
     smaller distortion and adding a larger one.

     Question format is the split that earns a toggle: the two-way contests run
     the whole cycle, three-way is recent and partial (15 polls, 7 months), and
     blending them put a false trough in the line — June 2026 reads 37.3
     blended against 42.5 among two-way polls alone, a trough that is question
     design rather than opinion. */
  const [ownFmt, setOwnFmt] = useState("2");
  const fmt = fmtProp || ownFmt;
  /* "Both" is a layout, not a third question — it hands the section a request
     to show the two formats side by side rather than averaging them, and it is
     the one destination that doesn't morph, because the panel itself splits.
     The other switch is the same gesture as the hero's: the same people, asked
     a differently shaped question, so the lines reshape and the clouds cross
     over rather than the chart being replaced. */
  /* Choosing "both" is not a third question, and it used to be refused a morph
     on the grounds that the panel splits. But the SPLIT is the other panel
     arriving; this one simply moves to the two-way question, which is the move
     it already animates for "Two-way". So it morphs, and it also records the
     two-way as its own choice - which keeps the return trip continuous, since
     minimising leaves the reader looking at the question they were just shown
     rather than snapping back to the one they left. */
  const BOTH_KEEPS = "2";           // the half this panel becomes; three-way is the new one
  const [rawMorph, chooseFmt] = window.AP.useMorph(
    fmt,
    (v) => { if (v === "both") { setOwnFmt(BOTH_KEEPS); onBoth && onBoth(); } else setOwnFmt(v); },
    // already on the question "both" lands this panel on: nothing to animate
    (from, to) => (to === "both" ? BOTH_KEEPS : to) !== from);
  /* Downstream, "both" is not a question anyone can draw: rowsFor, cloudFor
     and fitFor all key off this value. Normalised at the boundary so none of
     them has to know the word exists. */
  const morph = rawMorph && rawMorph.to === "both" ? { ...rawMorph, to: BOTH_KEEPS } : rawMorph;
  const setFmt = chooseFmt;
  const three = fmt === "3";
  const byId = {};
  allLeaders.forEach((L) => { byId[L.id] = L; });
  const xDomain = rangeDomain(rangeId);
  const pts = filterPts(D.leaderMonths, xDomain[0]);
  const latestYm = D.leaderMonths[D.leaderMonths.length - 1].ym;

  /* One row per line, in draw and read order. The three-way is a single
     contest of three names; the two-way is two contests of two. */
  /* One row per line, for either question, so a morph can build both sides.
     `mk` is what a line is matched BY across the switch: a leader keeps his
     line through the change of question. The head-to-head Albanese has no
     counterpart in a three-way that already contains him once, so it is the
     one line with nowhere to go, and it fades instead of travelling. */
  const rowsFor = (f) => f === "3"
    ? allLeaders.map((L) => ({ pair: null, L, suf: "_pref3", label: L.short, mk: L.id }))
    : PPM_PAIRS.flatMap((pr) => pr.ids.map((id) => ({
        pair: pr, L: byId[id], suf: pr.suf, dashed: !!pr.dashed,
        // the tooltip lists every line at once, so the two Albaneses have to
        // name their own contest there
        label: id === "alb" && pr.id === "ah" ? "Albanese v Hanson" : byId[id].short,
        mk: id === "alb" && pr.id === "ah" ? "alb-h2h" : id,
      })));
  const rows = rowsFor(fmt);
  rows.forEach((r) => { r.read = lastReadings(D.leaderMonths, r.L.id + r.suf); });
  /* Same fixed order as the approval readout - see leaderOrder. It used to
     descend by preference after the PM, which put Hanson second here while she
     sat third over there on identical people, and moved her between the two
     PPM questions as well. The two-way keeps its own order: those rows are
     contests, and a contest reads left to right. */
  const ordered = three
    ? [...rows].sort((a, b) => byLeaderOrder(leaderOrder(D))(a.L.party, b.L.party))
    : rows;

  // the published readings behind the lines, each dot from the contest it
  // belongs to – a poll that asked two of them publishes both
  const cloudFor = (f) => D.individualPolls
    .filter((p) => p.x >= xDomain[0] && p.x <= xDomain[1])
    .flatMap((p) => (f === "3" ? [["3", allLeaders]] : PPM_PAIRS.map((pr) => [pr.id, pr.ids.map((id) => byId[id]), pr]))
      .flatMap(([m, ls, pr]) => {
        const c = ppmMatch(p, m);
        if (!c) return [];
        return ls.map((L) => {
          // the opposition slot is an office: Ley's readings belong to the same
          // line as Taylor's, exactly as the trend splices them
          const raw = L.id === "taylor" ? (c.taylor != null ? c.taylor : c.ley) : c[L.id];
          if (raw == null) return null;
          const lab = pr && pr.id === "ah" && L.id === "alb" ? "Albanese v Hanson" : L.short;
          return { x: p.x, y: raw, color: L.color, label: lab, meta: p, leader: L.id };
        }).filter(Boolean);
      }));
  const ppmScatter = cloudFor(fmt);
  /* A poll that put BOTH questions to the same sample is one reading answering
     two of them, so its dot travels; a poll asked only one has nowhere to go
     and fades. Keyed on poll + leader — the first dot to claim a leader keeps
     him, which is what sends the two-way pair's Albanese to the three-way
     rather than the head-to-head's. */
  const cross = morph
    ? window.AP.crossClouds(cloudFor(morph.from), cloudFor(morph.to), morph.t,
        (d) => d.meta.pollster + "|" + d.meta.released + "|" + d.leader)
    : null;

  /* The tinted lead bands belong to the two-way question only, so on the way
     to a three-way they fade rather than vanish under the lines that are still
     moving (and fade back in on the way home). */
  const areaFade = !morph ? 1 : (morph.to === "3" ? 1 - morph.t : morph.t);
  const areas = (three && !morph) || areaFade <= 0.01 ? [] : PPM_PAIRS.map((pr) => {
    const [a, b] = pr.ids;
    const points = pts.map((d) => {
      const hi = d[a + pr.suf], lo = d[b + pr.suf];
      return hi == null || lo == null ? null : { x: d.x, y0: Math.min(hi, lo), y1: Math.max(hi, lo) };
    }).filter(Boolean);
    /* Tinted in the OPPONENT's colour, at an opacity low enough that it
       reads as a gap rather than as an area chart of his share – which is the
       one way this band could be misread, since the tint sits under his line. */
    return points.length > 1
      ? { id: pr.id, points, color: byId[b].color, opacity: 0.085 * areaFade, edge: false }
      : null;
  }).filter(Boolean);

  /* Each line, on its own months, for either question – and put on one grid
     and interpolated while the switch is running. */
  const lineFor = (r) => pts.filter((d) => d[r.L.id + r.suf] != null)
    .map((d) => ({ ym: d.ym, x: d.x, v: d[r.L.id + r.suf] }));
  const fromRows = morph ? rowsFor(morph.from) : null;
  const toRows = morph ? rowsFor(morph.to) : null;
  const byMk = (list) => { const m = {}; (list || []).forEach((r) => (m[r.mk] = r)); return m; };
  const fromBy = byMk(fromRows), toBy = byMk(toRows);
  /* Every line either side of the switch, once. A line present on both sides
     travels; one present on only one side holds its own shape and fades. */
  const drawRows = !morph ? rows.map((r) => ({ r, pts: lineFor(r), opacity: 1 })) :
    [...new Set([...fromRows, ...toRows].map((r) => r.mk))].map((mk) => {
      const a = fromBy[mk], b = toBy[mk];
      if (a && b) {
        const bl = window.AP.blendRows(lineFor(a), lineFor(b), morph.t, ["v"]);
        // dash says WHICH contest, so it changes with the line's allegiance
        const r = morph.t < 0.5 ? a : b;
        return { r, pts: bl ? bl.rows : lineFor(r), opacity: 1, clip: bl ? bl.clip : null };
      }
      /* A line with nowhere to travel to is ERASED rather than dimmed: rubbed
         out from the left as the switch runs, and drawn back in the same way
         when the switch is reversed. Fading the whole line at once read as it
         blinking out of existence — the head-to-head Albanese is the one this
         happens to, and a dashed line vanishing wholesale looks like a
         rendering fault rather than a departure. */
      const only = a || b;
      return { r: only, pts: lineFor(only), wipe: a ? morph.t : 1 - morph.t };
    }).filter((d) => d.pts.length);


  // y-window fitted to the readings in view, scatter included – and taken
  // across both questions while morphing, so the axis holds still under lines
  // that are still moving
  const valsFor = (f) => rowsFor(f)
    .flatMap((r) => D.leaderMonths.map((m) => m[r.L.id + r.suf]).filter((v) => v != null))
    .concat(cloudFor(f).map((d) => d.y));
  const fitFor = (f) => { const v = valsFor(f); return fitDomain(v.length ? v : [30, 50], 10); };
  const target = fitFor(fmt);
  const ticks = target.ticks;
  const domain = morph
    ? window.AP.blendDomain(fitFor(morph.from).domain, fitFor(morph.to).domain, morph.t)
    : target.domain;

  const Roll = window.RollNum;
  /* `data-mk` is the same identity the LINES are matched by across the switch,
     put on the tile so the readout can be matched the same way. It is why the
     Albanese of the two-way's first contest is the Albanese of the three-way,
     and why the head-to-head one is not anybody. */
  /* ---- the readout travels between the two questions ---------------------
     Same idea the lines and the dot clouds already use, applied to the tiles:
     a leader present in both questions keeps his tile and MOVES to where the
     other question puts him, rather than the row being torn down and a new one
     built in its place. The two layouts are not the same shape - two-way is
     two contests of two on their own rows, three-way is one row of three - so
     nothing can be matched by DOM position. It is matched by `data-mk`, the
     same key the lines are matched by, which is what makes the tile and the
     line agree about who travelled where.

     FLIP, because React has already replaced the DOM by the time this runs:
     read where each tile ended up, put it back where it was with a transform,
     then release it on the next frame and let the transition carry it. The
     transform is decoration over a tile that is already in its final place, so
     nothing downstream - hit testing, screen readers, copy - sees the journey.

     Only on a change of question. Between switches the morph re-renders this
     panel about twenty times as the chart interpolates, and re-measuring on
     each of those would both cost a forced layout per tile and read positions
     that are mid-transform. Transforms are cleared before measuring so a fast
     double-toggle measures the truth rather than a tile in flight. */
  const readoutRef = useRef(null);
  const homeRef = useRef(null);
  const lastFmtRef = useRef(fmt);
  const landRef = useRef(0);
  React.useEffect(() => () => clearTimeout(landRef.current), []);
  React.useLayoutEffect(() => {
    const root = readoutRef.current;
    if (!root) return;
    const changed = lastFmtRef.current !== fmt;
    lastFmtRef.current = fmt;
    /* Ghosts carry a copy of the tile they are a picture of, `data-mk` and all,
       so a leftover one would be measured as if it were the real thing. */
    const nodes = [...root.querySelectorAll("[data-mk]")].filter((n) => !n.closest(".ppm-ghost"));
    if (changed) {
      clearTimeout(landRef.current);
      root.querySelectorAll(".ppm-ghost").forEach((g) => g.remove());
      nodes.forEach((n) => { n.style.transition = "none"; n.style.transform = ""; n.style.opacity = ""; });
    }
    const rootR = root.getBoundingClientRect();
    /* The digits are recorded with the position. A reel rolls because its --d
       CHANGES on an element that was already there, and across this switch
       nothing was: the two layouts are different shapes, so React builds the
       tiles afresh and every reel mounts already holding its answer. The
       figures were snapping to 38 while the tile they sit in floated across
       the card. Carrying the old digits over gives each reel something to roll
       FROM, on the same curve and the same 320ms as the float. */
    const digitsIn = (n, sel) => [...n.querySelectorAll(sel + " .roll-reel")]
      .map((r) => r.style.getPropertyValue("--d"));
    const now = {};
    nodes.forEach((n) => {
      const r = n.getBoundingClientRect();
      now[n.dataset.mk] = { x: r.left - rootR.left, y: r.top - rootR.top, html: n.outerHTML,
                            num: digitsIn(n, ".leader-num"), delta: digitsIn(n, ".delta") };
    });
    const prev = homeRef.current;
    homeRef.current = now;
    if (!changed || !prev) return;
    const still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (still) return;
    const MS = (window.AP && window.AP.MORPH_MS) || 320;
    const EASE = "cubic-bezier(.4, .1, .25, 1)";
    /* Every start state is set, then committed ONCE, then every end state -
       rather than a reflow per element. The usual FLIP waits a frame before
       releasing, and a frame is exactly what a hidden tab never gets: the
       tiles then sat holding their inverse transform indefinitely. Reading
       offsetWidth commits the start state instead, so the transitions have
       something to run FROM without anyone having to be shown a frame first.
       One read for the whole readout, because a tile and its digits have to
       start together or they arrive apart. */
    const release = [];
    /* Digits are paired from the RIGHT, the way an odometer lines up: units
       under units. It matters where a figure changes width - 8 becoming 44
       should roll the 8 into the 4 it is now beside, not into the tens column
       it has never occupied - and a reel with no counterpart keeps its answer
       and stays put rather than rolling from nowhere. */
    const seed = (n, sel, was) => {
      if (!was || !was.length) return;
      const cur = [...n.querySelectorAll(sel + " .roll-reel")];
      const offset = cur.length - was.length;
      cur.forEach((reel, i) => {
        const from = was[i - offset], to = reel.style.getPropertyValue("--d");
        if (from == null || from === "" || from === to) return;
        reel.style.transition = "none";
        reel.style.setProperty("--d", from);
        // "" hands it back to .roll-reel's own transition, which is already
        // the shared curve at the shared duration
        release.push(() => { reel.style.transition = ""; reel.style.setProperty("--d", to); });
      });
    };
    nodes.forEach((n) => {
      const a = prev[n.dataset.mk], b = now[n.dataset.mk];
      /* Nobody to travel from - the head-to-head Albanese, back again when the
         two-way is chosen. He arrives rather than slides, because there is no
         honest place to slide him from, and his digits have nothing to roll
         from either. */
      if (!a) {
        n.style.transition = "none";
        n.style.opacity = "0";
        release.push(() => {
          n.style.transition = "opacity " + MS + "ms " + EASE;
          n.style.opacity = "";
        });
        return;
      }
      seed(n, ".leader-num", a.num);
      seed(n, ".delta", a.delta);
      const dx = a.x - b.x, dy = a.y - b.y;
      if (!dx && !dy) return;
      n.style.transition = "none";
      n.style.transform = "translate(" + dx + "px, " + dy + "px)";
      release.push(() => {
        n.style.transition = "transform " + MS + "ms " + EASE + ", opacity " + MS + "ms " + EASE;
        n.style.transform = "";
        n.style.opacity = "";
      });
    });
    void root.offsetWidth;              // commit every start state together
    release.forEach((f) => f());
    /* A tile with nowhere to go is the second Albanese, and the three-way
       already contains him once. React has removed it, so what fades is a
       still copy left at the spot it occupied - the same departure the chart
       gives his line, which is wiped rather than blinked out. */
    Object.keys(prev).forEach((mk) => {
      if (now[mk]) return;
      const ghost = document.createElement("div");
      ghost.className = "ppm-ghost";
      ghost.innerHTML = prev[mk].html;
      ghost.style.left = prev[mk].x + "px";
      ghost.style.top = prev[mk].y + "px";
      root.appendChild(ghost);
      void ghost.offsetWidth;                              // same reason as flip()
      ghost.style.opacity = "0";
      setTimeout(() => ghost.remove(), MS + 60);
    });
    /* Frames are not guaranteed - a hidden tab is served none - and a tile left
       holding its inverse transform is stranded somewhere it never belonged,
       which is a worse failure than the chart's half-interpolated shape that
       useMorph keeps its own backstop for. Whatever happens to the frames, the
       readout lands where the layout put it. */
    landRef.current = setTimeout(() => {
      root.querySelectorAll(".ppm-ghost").forEach((g) => g.remove());
      nodes.forEach((n) => {
        n.style.transition = ""; n.style.transform = ""; n.style.opacity = "";
        // --d is already the answer by now; only the inline transition is ours
        n.querySelectorAll(".roll-reel").forEach((r) => { r.style.transition = ""; });
      });
    }, MS + 80);
  }, [fmt]);

  const tiles = (list) => list.map((r) => {
    const rd = r.read;
    const tag = rd && staleTag(rd.ym, latestYm);
    return (
      <div className="leader" key={r.mk} data-mk={r.mk}>
        <div className="leader-dot" style={{ background: r.L.color }}></div>
        {/* named so the narrow-screen grid can place it – see .leader-vals */}
        <div className="leader-vals">
          <div className="leader-name">{r.L.short}{tag && <span className="stale-tag" title={"Latest published reading · " + tag}> {tag}</span>}</div>
          <div className="leader-num">
            {rd ? (Roll ? <Roll value={String(rd.v)} /> : rd.v) : "—"}
            {rd && <span className="pct">%</span>}
          </div>
        </div>
        {rd && rd.prev != null && <Delta value={rd.v - rd.prev} suffix="" small roll title={readoutDeltaTitle(rd)} />}
      </div>
    );
  });

  /* The lead, taken from the last month BOTH names were asked in that contest
     – which is not always the latest month, since the head-to-head is asked by
     fewer houses. Stating it is the point of showing two contests at once. */
  const leadOf = (pr) => {
    for (let i = D.leaderMonths.length - 1; i >= 0; i--) {
      const m = D.leaderMonths[i], a = m[pr.ids[0] + pr.suf], b = m[pr.ids[1] + pr.suf];
      if (a == null || b == null) continue;
      const d = Math.round(Math.abs(a - b));
      const who = byId[a > b ? pr.ids[0] : pr.ids[1]];
      return { m: d, name: who.short, color: inkOf(who.color), level: d === 0 };
    }
    return null;
  };

  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h3 className="card-title">Preferred prime minister</h3>
          <p className="card-sub">
            {three ? "“Who would make the better PM?” asked as a three-way, including Hanson"
                   : "“Who would make the better PM?” asked as a two-way – both of the contests pollsters run"}
            {three
              ? " · as published – houses leave 16–50% uncommitted, so shares aren’t directly comparable"
              : " · as published – uncommitted runs from none, in Newspoll’s head-to-head, to half the sample, so shares aren’t directly comparable"}
          </p>
        </div>
        <div className="card-head-tools">
          {!lockFmt && (
            <TextToggle caps value={fmt} onChange={setFmt} ariaLabel="Preferred-PM question"
              options={[{ id: "2", label: "Two-way" }, { id: "3", label: "Three-way" },
                        ...(onBoth ? [{ id: "both", label: "Both" }] : [])]} />
          )}
          {chrome}
        </div>
      </div>
      <div className="ppm-readout" ref={readoutRef}>
      {three ? (
        <div className="leader-readout">{tiles(ordered)}</div>
      ) : (
        /* One line per contest, and every name printed ONCE. Grouping is still
           the point - four tiles in a row would read as one four-cornered race
           when two of them are the same man - but the group used to be titled
           "Albanese v the opposition leader" above tiles labelled Albanese and
           Taylor, so the caption and the tiles were both naming the players
           and Albanese appeared four times in six lines. The tiles do the
           naming, because that is where the numbers are; the row does the
           grouping. What is left of the caption is the rule that ties the pair
           to its lines on the chart, and the margin, which is the one thing
           two contests side by side are FOR - 4 points against the opposition
           leader, 13 against Hanson - and the one thing neither tile states.
           It takes the leader's own ink, so it needs no name to say whose. */
        <div className="ppm-pairs">
          {PPM_PAIRS.map((pr) => {
            const lead = leadOf(pr);
            return (
              <div className={"ppm-pair" + (pr.dashed ? " dashed" : "")} key={pr.id}>
                <span className="ppm-rule" aria-hidden="true"></span>
                {/* the contest still has a name for a screen reader, which
                    cannot see that these two tiles are one matchup */}
                <span className="sr-only">{pr.lab}</span>
                <div className="leader-readout">{tiles(rows.filter((r) => r.pair === pr))}</div>
                {lead && (
                  <span className="ppm-lead" style={lead.level ? null : { color: lead.color }}>
                    {lead.level ? "level" : <><span className="sr-only">{lead.name} leads by </span>+{lead.m}</>}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
      </div>
      <TrendChart
        /* NOT keyed on the question: a remount would throw away the morph
           itself, along with both memoised dot clouds. */
        key="ppm"
        height={250} xDomain={xDomain} yDomain={domain}
        yTicks={ticks} unit="%" axisFont={20}
        pad={{ l: 58, r: 22, t: 22, b: 42 }}
        xTicks={buildXTicks(xDomain[0], xDomain[1])}
        events={[OPP_HANDOVER].filter(Boolean)}
        areas={areas}
        series={drawRows.map((d) => ({
          id: d.r.mk, label: d.r.label, color: d.r.L.color, dashed: d.r.dashed,
          /* The three-way is seven months against the two-way's fourteen, so
             every line here retreats by a different amount – each needs its own
             window or the shorter ones arrive at full length and snap. */
          clipX: d.clip, opacity: d.opacity, wipe: d.wipe,
          points: d.pts.map((p) => ({ x: p.x, y: p.v })),
        }))}
        spine={pts.map((d) => ({ x: d.x }))}
        scatter={cross ? cross.scatter : ppmScatter} pollFacet="leadership"
        scatterOut={cross ? cross.scatterOut : []}
        scatterMove={cross ? cross.scatterMove : []}
        fade={morph ? morph.t : 1}
        tooltipTitle={(i) => window.AP.monthLabelFull(pts[i].ym)}
        fmt={(v) => v.toFixed(0)}
      />
    </section>
  );
}

// ---- Leader approval ------------------------------------------------
function ApprovalPanel({ rangeId, leaders, chrome, metric: metricProp, lockMetric, onBoth }) {
  const { D, rangeDomain, filterPts, buildXTicks } = window.AP;
  // approval (approve − disapprove) and favourability (positive − negative)
  // are DIFFERENT questions from different pollsters – a toggle, never a blend
  const [own, setOwn] = useState("net");
  // controlled when the section pins this panel to one measure (the side-by-side
  // "both" view), self-managed otherwise
  const metric = metricProp != null ? metricProp : own;
  /* Approval and favourability are different questions of the same three
     people, so switching between them is a rearrangement, not a replacement:
     the lines reshape and the clouds cross over. "Both" splits the panel in
     two, and the half THIS one becomes is the favourability panel on the
     right - approval is the new panel arriving on its left. So choosing it is
     the same move as choosing Favourability outright, and it animates like
     one.

     Which half survives is the whole thing, and getting it backwards is
     visible: landing this panel on approval made it morph towards a metric it
     was not going to show and snap back when the morph ended, which is the
     bars contracting and then suddenly elongating. From favourability there is
     now nothing to do at all - the destination IS the current metric, so the
     morph is refused rather than run empty, and the reader sees the second
     panel appear beside an unchanged one. */
  const BOTH_KEEPS = "fav";
  const [rawMorph, chooseMetric] = window.AP.useMorph(
    metric,
    (v) => { if (v === "both") { setOwn(BOTH_KEEPS); onBoth && onBoth(); } else setOwn(v); },
    (from, to) => (to === "both" ? BOTH_KEEPS : to) !== from);
  // "_both" is not a suffix any series has – normalised before anything reads it
  const morph = rawMorph && rawMorph.to === "both" ? { ...rawMorph, to: BOTH_KEEPS } : rawMorph;
  const setMetric = chooseMetric;
  const suf = "_" + metric;                       // _net | _fav
  const xDomain = rangeDomain(rangeId);
  const pts = filterPts(D.leaderMonths, xDomain[0]);
  const latestYm = D.leaderMonths[D.leaderMonths.length - 1].ym;
  const reads = {};
  leaders.forEach((L) => { reads[L.id] = lastReadings(D.leaderMonths, L.id + suf); });
  const ordered = [...leaders].sort((a, b) => byLeaderOrder(leaderOrder(D))(a.party, b.party));
  const Roll = window.RollNum;
  // Published readings behind the lines, for the ACTIVE metric only. A net is a
  // difference of two proportions, so it carries more sampling noise than a
  // single share – the monthly line hides more here than on any other chart.
  // The metric filter is not optional: approval and favourability are different
  // questions, and blending their clouds would undo the same separation the
  // aggregate takes care to keep.
  const cloudFor = (mt) => {
    const wantFav = mt === "fav";
    return D.individualPolls
      .filter((p) => p.appr && p.x >= xDomain[0] && p.x <= xDomain[1])
      .flatMap((p) => leaders.flatMap((L) => {
        const a = p.appr, out = [];
        const isFav = ((a.metricBy || {})[L.id] === "fav");
        if (a[L.id + "Net"] != null && isFav === wantFav) out.push(a[L.id + "Net"]);
        // a house can publish BOTH measures for one leader in a wave; the second
        // lives in `alt` and belongs on the other tab
        const alt = a.alt && a.alt[L.id];
        if (alt && alt.net != null && (alt.metric === "fav") === wantFav) out.push(alt.net);
        return out.map((y) => ({ x: p.x, y, color: L.color, label: L.short, meta: p, leader: L.id }));
      }));
  };
  const apprScatter = cloudFor(metric);
  /* A house that rated a leader on BOTH measures in one wave is the same
     fieldwork answering two questions, so that dot travels; everyone else
     fades. Keyed on poll + leader, which is the pair both clouds carry. */
  const cloudKey = (d) => d.meta.pollster + "|" + d.meta.released + "|" + d.leader;
  const cross = morph
    ? window.AP.crossClouds(cloudFor(morph.from), cloudFor(morph.to), morph.t, cloudKey)
    : null;

  /* A net is a difference of two proportions from one sample, so its interval
     is close to twice a share's – which is exactly the panel's own warning
     above ("the monthly line hides more here than on any other chart"), drawn
     rather than written. The leaders' bands overlap where the leaders do,
     which is the reading: three lines within a few points of each other are
     not three distinguishable positions. */
  /* One leader's line and its interval for a given metric, month by month.
     During a morph the two metrics' versions are put on a single grid of
     months and interpolated, so a leader's line reshapes into its other
     answer instead of being swapped for it. */
  const lineFor = (L, mt) => {
    const k = L.id + "_" + mt;
    return pts.filter((d) => d[k] != null)
      .map((d) => ({ ym: d.ym, x: d.x, v: d[k], ci: d[k + "Ci"] != null ? d[k + "Ci"] : null }));
  };
  const drawLine = (L) => {
    const now = lineFor(L, metric);
    if (!morph) return { rows: now, clip: null };
    const b = window.AP.blendRows(lineFor(L, morph.from), lineFor(L, morph.to), morph.t, ["v", "ci"]);
    return b ? { rows: b.rows, clip: b.clip } : { rows: now, clip: null };
  };
  const drawn = {};
  leaders.forEach((L) => { drawn[L.id] = drawLine(L); });

  const apprAreas = leaders
    .map((L) => ({ id: "ci-" + L.id, color: L.color, className: "ci-band", edge: false, smooth: true,
                   // the interval travels with the line it belongs to
                   clipX: drawn[L.id].clip,
                   points: drawn[L.id].rows.filter((d) => d.ci != null)
                     .map((d) => ({ x: d.x, y0: d.v - d.ci, y1: d.v + d.ci })) }))
    .filter((a) => a.points.length >= 2);

  /* The y window travels too. Taken across BOTH metrics while morphing, so
     the axis isn't re-fitted under a line that is still moving. */
  const valsFor = (mt) => leaders
    .flatMap((L) => D.leaderMonths.map((r) => r[L.id + "_" + mt]).filter((v) => v != null))
    .concat(cloudFor(mt).map((d) => d.y))
    .concat(leaders.flatMap((L) => lineFor(L, mt).filter((d) => d.ci != null)
      .flatMap((d) => [d.v - d.ci, d.v + d.ci])));
  const fitFor = (mt) => { const v = valsFor(mt); return fitDomain(v.length ? v : [-20, 20], 10, 0); };
  const target = fitFor(metric);
  const ticks = target.ticks;
  const domain = morph
    ? window.AP.blendDomain(fitFor(morph.from).domain, fitFor(morph.to).domain, morph.t)
    : target.domain;
  /* The bar's scale comes from the DESTINATION domain, not the blended one the
     chart is drawing to. Both ends of a bar were moving at different speeds:
     the value it measures changes the instant the metric does, while `domain`
     eases across over the morph - so the bar snapped to a new length against
     the old scale and then eased to a different one, which is the bounce.

     Held still, the two changes become one: the length changes once, and CSS
     carries it there on the curve everything else moves on. The chart keeps
     the blended domain, because there the axis genuinely is travelling. */
  const NET_MAX = Math.max(Math.abs(target.domain[0]), Math.abs(target.domain[1]));
  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h3 className="card-title">{metric === "net" ? "Leader net approval" : "Leader net favourability"}</h3>
          <p className="card-sub">
            {metric === "net"
              ? "Approve minus disapprove – a verdict on the job they are doing · Newspoll, YouGov, Resolve, Essential and others"
              : "Positive minus negative – a verdict on them as a person, not the job · RedBridge/Accent, DemosAU and Freshwater ask favourability, not approval"}
          </p>
        </div>
        <div className="card-head-tools">
          {/* "Both" is a layout, not a third metric – it splits the panel in
              two rather than blending the measures, which is the one thing
              this toggle exists to prevent. Hidden when the section has
              already pinned this panel to a single measure. */}
          {!lockMetric && (
            <TextToggle caps value={metric} onChange={setMetric} ariaLabel="Net metric"
              options={[{ id: "net", label: "Approval" }, { id: "fav", label: "Favourability" },
                        ...(onBoth ? [{ id: "both", label: "Both" }] : [])]} />
          )}
          {chrome}
        </div>
      </div>
      <div className="approval-readout">
        {ordered.map((L) => {
          const r = reads[L.id];
          const net = r ? r.v : null;
          const tag = r && staleTag(r.ym, latestYm);
          const w = net == null ? 0 : Math.min(Math.abs(net), NET_MAX) / NET_MAX * 50;
          return (
            <div className="appr" key={L.id}>
              <div className="appr-top">
                <span className="leader-dot" style={{ background: L.color }}></span>
                <span className="leader-name">{L.short}{tag && <span className="stale-tag" title={"Latest published reading · " + tag}> {tag}</span>}</span>
                {/* Rolls to its new value, the way the hero's 2PP pair does.
                    Earned here for the hero's own reason: Approval and
                    Favourability are the same three people asked a different
                    question, so the toggle moves every figure at once and a
                    number that simply swapped would be the one still thing in
                    a moving readout. The sign rides along as a separator - the
                    digits reel, the + or − does not.
                    Guarded like Delta's: RollNum comes from the header script,
                    which loads after this one, so a reordering degrades to a
                    plain figure rather than a blank panel. */}
                {net == null
                  ? <span className="net dash">—</span>
                  : <span className={"net " + (net >= 0 ? "pos" : "neg")}>
                      {Roll ? <Roll value={(net > 0 ? "+" : "") + net} />
                            : <>{net > 0 ? "+" : ""}{net}</>}
                    </span>}
                {/* same movement indicator the preferred-PM readout carries –
                    a net that moved is as much news as a share that moved */}
                {r && r.prev != null && <Delta value={r.v - r.prev} suffix="" small roll title={readoutDeltaTitle(r)} />}
              </div>
              {/* diverging net bar – the source publishes nets only, no
                  approve/disapprove split to stack */}
              <div className="appr-netbar" aria-hidden="true">
                <span className="anb-mid"></span>
                {/* One bar per side, both always present, each owning only its
                    own width. It used to be a single bar that swapped which
                    edge it hung from and what colour it was - and the swap is
                    instant while the width is still travelling, so a reading
                    landing on zero from below flipped a part-width bar to the
                    positive side and turned it green on the way out. Hanson
                    does exactly that: -6 on favourability, 0 on approval, and
                    a green bar appeared for the length of the contraction.

                    Apart, each side simply grows from the midline or falls
                    back to it, and a reading that genuinely crosses zero is
                    one bar emptying as the other fills - which is what
                    crossing the midline looks like. */}
                <span className="anb-fill anb-pos"
                      style={{ width: (net != null && net > 0 ? w : 0) + "%" }}></span>
                <span className="anb-fill anb-neg"
                      style={{ width: (net != null && net < 0 ? w : 0) + "%" }}></span>
              </div>
            </div>
          );
        })}
      </div>
      <TrendChart
        /* NOT keyed on the metric: a remount would replace the very thing
           being animated, along with both memoised dot clouds. */
        key={"appr-" + leaders.map((L) => L.id).join(".")}
        height={250} xDomain={xDomain} yDomain={domain}
        yTicks={ticks} unit="" axisFont={20}
        pad={{ l: 58, r: 22, t: 22, b: 42 }}
        xTicks={buildXTicks(xDomain[0], xDomain[1])}
        refLines={[{ y: 0, label: "even", color: "var(--ink-faint)" }]}
        events={leaders.some((L) => L.id === "taylor") ? [OPP_HANDOVER].filter(Boolean) : []}
        series={ordered.map((L) => (
          { id: L.id, label: L.short + " net", color: L.color,
            /* Hanson has nine months of favourability against five of
               approval, so her line has to shorten while the other two barely
               move. Each carries its own window for that reason. */
            clipX: drawn[L.id].clip,
            points: drawn[L.id].rows.map((d) => ({ x: d.x, y: d.v })) }
        ))}
        spine={pts.map((d) => ({ x: d.x }))}
        areas={apprAreas}
        scatter={cross ? cross.scatter : apprScatter} pollFacet="leadership"
        scatterOut={cross ? cross.scatterOut : []}
        scatterMove={cross ? cross.scatterMove : []}
        fade={morph ? morph.t : 1}
        tooltipTitle={(i) => window.AP.monthLabelFull(pts[i].ym)}
        fmt={(v) => (v > 0 ? "+" : "") + v.toFixed(0)}
      />
    </section>
  );
}

// "Roy Morgan, Essential and Freshwater" – a plain English list, capped so a
// long roster degrades to "and others" rather than swallowing the subtitle.
// Roy Morgan reports this question in half-points, and the chart's formatter
// also writes the tooltip – rounding an individual poll's 61.5 to 62 would
// misstate it. Axis ticks land on whole numbers, so they stay clean.
const dirFmt = (v) => (v % 1 ? v.toFixed(1) : v.toFixed(0));

function houseList(names, max = 4) {
  if (!names || !names.length) return "";
  if (names.length > max) return names.slice(0, max).join(", ") + " and others";
  if (names.length === 1) return names[0];
  return names.slice(0, -1).join(", ") + " and " + names[names.length - 1];
}

// ---- National direction (right track / wrong track) -----------------
function DirectionPanel({ rangeId }) {
  const { D, rangeDomain, filterPts, buildXTicks, series } = window.AP;
  const asked = houseList(D.directionHouses);
  const question = "“Is the country heading in the right direction, or on the wrong track?”";
  // no right-track / wrong-track series in the dataset yet – keep the panel
  // as an honest empty state so the question has a home when it's polled
  if (!D.direction.length) {
    return (
      <section className="card">
        <div className="card-head">
          <div>
            <h2 className="card-title">National direction</h2>
            <p className="card-sub">{question}</p>
          </div>
        </div>
        <p className="pd-absent">No national direction series yet – none of the tracked pollsters currently
           publish a right-direction / wrong-track question. It will appear here when one does.</p>
      </section>
    );
  }
  const xDomain = rangeDomain(rangeId);
  const pts = filterPts(D.direction, xDomain[0]);
  const latest = D.direction[D.direction.length - 1];
  const prev = D.direction[D.direction.length - 2];
  const netDelta = prev ? latest.net - prev.net : null;

  // y-window fitted to the data – a fixed one clipped the real range the
  // moment wrong-track climbed past 60
  // the published readings behind the two lines – this series leans on three
  // houses and some months carry a single poll, so the spread is the point
  const dirScatter = (D.directionPolls || [])
    .filter((d) => d.x >= xDomain[0] && d.x <= xDomain[1])
    .flatMap((d) => [
      { x: d.x, y: d.right, color: "var(--mood-pos)", label: "Right direction", meta: d },
      { x: d.x, y: d.wrong, color: "var(--mood-neg)", label: "Wrong track", meta: d },
    ]);

  /* The widest bands on the site, and correctly so: three houses ask this
     question and some months rest on one of them. The caption has always said
     that; now the chart shows it. */
  const dirBand = (k, ck) => pts
    .filter((d) => d[ck] != null)
    .map((d) => ({ x: d.x, y0: d[k] - d[ck], y1: d[k] + d[ck] }));
  const dirAreas = [
    { id: "ci-right", color: "var(--mood-pos)", ck: "rightCi", k: "right" },
    { id: "ci-wrong", color: "var(--mood-neg)", ck: "wrongCi", k: "wrong" },
  ].map((a) => ({ id: a.id, color: a.color, className: "ci-band", edge: false,
                  smooth: true, points: dirBand(a.k, a.ck) }))
   .filter((a) => a.points.length >= 2);

  // domain has to cover the raw readings too, not just the smoothed means
  const vals = pts.flatMap((p) => [p.right, p.wrong])
    .concat(dirScatter.map((d) => d.y))
    .concat(dirAreas.flatMap((a) => a.points.flatMap((d) => [d.y0, d.y1])));
  const lo = Math.floor((Math.min(...vals) - 3) / 5) * 5;
  const hi = Math.ceil((Math.max(...vals) + 3) / 5) * 5;
  const yTicks = [];
  for (let v = lo + 5; v < hi; v += 5) yTicks.push(v);

  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2 className="card-title">National direction</h2>
          <p className="card-sub">{question}{asked ? " · " + asked : ""}</p>
        </div>
        <div className="dir-net">
          <span className="dir-net-label">Net</span>
          <span className={"dir-net-val " + (latest.net >= 0 ? "pos" : "neg")}>
            {latest.net > 0 ? "+" : ""}{latest.net}
          </span>
          {netDelta != null && <Delta value={netDelta} suffix="" small />}
        </div>
      </div>

      <div className="dir-readout">
        <div className="dir-side">
          <span className="dir-k" style={{ color: "var(--mood-pos)" }}>Right direction</span>
          <span className="dir-v">{latest.right}<span className="pct">%</span></span>
        </div>
        <div className="dir-bar">
          <span className="dir-pos" style={{ width: latest.right + "%" }}></span>
          <span className="dir-uns" style={{ width: latest.unsure + "%" }}></span>
          <span className="dir-neg" style={{ width: latest.wrong + "%" }}></span>
        </div>
        <div className="dir-side ta-r">
          <span className="dir-k" style={{ color: "var(--mood-neg)" }}>Wrong track</span>
          <span className="dir-v">{latest.wrong}<span className="pct">%</span></span>
        </div>
      </div>

      <TrendChart
        key="dir"
        height={250} xDomain={xDomain} yDomain={[lo, hi]}
        yTicks={yTicks} unit="%" axisFont={20}
        pad={{ l: 58, r: 22, t: 16, b: 42 }}
        xTicks={buildXTicks(xDomain[0], xDomain[1])}
        series={[
          { id: "right", label: "Right direction", color: "var(--mood-pos)", points: series(pts, "right") },
          { id: "wrong", label: "Wrong track", color: "var(--mood-neg)", points: series(pts, "wrong") },
        ]}
        spine={series(pts, "right")}
        areas={dirAreas}
        scatter={dirScatter} pollFacet="direction"
        /* Bondi alone, not the full major set. Direction is a mood measure and
           this is the one event in the cycle that plausibly moved it on its own;
           hanging the Coalition splits and the Budget off it too would imply a
           reading of each that the data doesn't support. A single marker also
           renders at any chart width, unlike a busy set. */
        events={[eventOn("2025-12-14")].filter(Boolean)}
        tooltipTitle={(i) => window.AP.monthLabelFull(pts[i].ym)}
        fmt={dirFmt}
      />
      <p className="table-hint">
        Each dot is one published reading; the lines are house-effect-adjusted
        monthly averages, shaded with their 95% intervals. Only {asked ? D.directionHouses.length : 0} houses ask
        this question, so some months rest on a single poll – the dots show which,
        and the shading shows what that costs in confidence.
      </p>
    </section>
  );
}

/* One line in a poll's breakdown: the share this wave could not place, and
   how it moved on the same house's last wave. Stated next to the primaries
   because it is the denominator they were taken out of. */
function UndecidedLine({ v, chg, basis }) {
  const d = segDelta(chg, "und");
  return (
    <div className="pd-block">
      <div className="pd-k">Undecided</div>
      <div className="pd-und">
        <span className="pd-und-v">{v}<span className="pct">%</span></span>
        {/* the same change tag the primary shares carry, so it reads as one
            more figure from this wave rather than a separate claim */}
        <ChgTag v={d ? d.v : null} refDate={d ? d.refDate : null} />
        {/* where the figure SITS is the whole difference between the two
            questions, and it decides how the shares above should be read */}
        <span className="pd-und-note">
          {basis === "tpp"
            ? "won’t pick a side – inside the two-party pair above, which is why it sums to under 100"
            : "can’t say – excluded from the shares above"}
        </span>
      </div>
    </div>
  );
}

// ---- Undecided ("can't say who they would vote for") -----------------
/* The people the primaries have already set aside. Roy Morgan publishes this
   figure beside its shares - which is WHY a Roy Morgan wave sums to 100 - and
   the tracker used to drop it on the way in, so nothing on the page said how
   much of the electorate was not yet in the numbers above it.

   One publisher, so this is a plain sample-weighted monthly mean of what that
   house printed, not an aggregate: there is no second house to estimate a
   lean against, and the panel names the house rather than implying a market
   consensus. Waves that published no figure are absent, not zero - January's
   three weeks came in one combined release whose single figure cannot be
   attributed to a wave, so they are not attributed to one. */
function UndecidedPanel({ rangeId }) {
  const { D, rangeDomain, filterPts, buildXTicks, series } = window.AP;
  const U = D.undecided;
  if (!U || !U.series.length) return null;
  const xDomain = rangeDomain(rangeId);
  /* Not a party colour: --ink-2 is the one neutral legible in both themes,
     which is what a line meaning "none of the above" wants. The two questions
     are told apart by the dash, the same way the preferred-PM panel tells its
     two contests apart — never by being averaged into one line. */
  const COL = "var(--ink-2)";
  const drawn = U.series.map((sr) => {
    const pts = filterPts(sr.monthly, xDomain[0]);
    const dots = sr.polls.filter((d) => d.x >= xDomain[0] && d.x <= xDomain[1])
      .map((d) => ({ x: d.x, y: d.v, color: COL, label: sr.label, meta: d }));
    return { sr, pts, dots };
  }).filter((d) => d.pts.length >= 2);
  if (!drawn.length) return null;

  const vals = drawn.flatMap((d) => d.pts.map((p) => p.v).concat(d.dots.map((p) => p.y)));
  const lo = Math.max(0, Math.floor((Math.min(...vals) - 1.5) / 2) * 2);
  const hi = Math.ceil((Math.max(...vals) + 1.5) / 2) * 2;
  const yTicks = [];
  for (let v = lo + 2; v < hi; v += 2) yTicks.push(v);
  const spine = drawn[0].pts;

  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2 className="card-title">Undecided</h2>
          <p className="card-sub">
            Electors who won’t name a choice · {houseList(U.houses)}
          </p>
        </div>
      </div>
      {/* One tile per question, because they ARE different questions and the
          panel would otherwise imply a single measure with two sources. */}
      <div className="und-reads">
        {U.series.map((sr) => (
          <div className="und-read" key={sr.id}>
            <span className={"und-swatch" + (sr.dashed ? " dashed" : "")} aria-hidden="true"></span>
            <div className="und-read-body">
              <div className="und-read-top">
                <span className="und-read-lab">{sr.label}</span>
                <span className="und-read-v">{sr.latest.v}<span className="pct">%</span></span>
                {/* rising undecided is not good news for anyone – neither arrow
                    is coloured as a gain */}
                {sr.latest.chg != null && <Delta value={sr.latest.chg} goodUp={false} small />}
              </div>
              <p className="und-read-note">{sr.note} · {houseList(sr.houses)}</p>
            </div>
          </div>
        ))}
      </div>
      <TrendChart
        key="und"
        height={210} xDomain={xDomain} yDomain={[lo, hi]}
        yTicks={yTicks} unit="%" axisFont={20}
        pad={{ l: 58, r: 22, t: 16, b: 42 }}
        xTicks={buildXTicks(xDomain[0], xDomain[1])}
        series={drawn.map((d) => ({ id: d.sr.id, label: d.sr.label, color: COL,
                                    dashed: d.sr.dashed, points: series(d.pts, "v") }))}
        spine={series(spine, "v")}
        scatter={drawn.flatMap((d) => d.dots)} pollFacet="twopp"
        tooltipTitle={(i) => window.AP.monthLabelFull(spine[i].ym)}
        fmt={(v) => v.toFixed(1)}
      />
      <p className="table-hint">
        Each dot is one published reading; the lines are their monthly averages.
        The two are never averaged together: one counts people who can’t name a
        party, the other people who won’t pick a side once preferences are
        applied, and only the first is excluded from the shares elsewhere on
        this page. A rising line means those figures are being read off a
        smaller pool of decided voters – not that support moved.
      </p>
    </section>
  );
}

// ---- Latest polls – faceted, ragged-tolerant ledger ----------------
const PARTY_C = {
  alp: "var(--alp)", lnp: "var(--lnp)", grn: "var(--grn)",
  onp: "var(--onp)", oth: "var(--oth)", unc: "var(--line-2)",
};

// segment builders – each returns a list the ShareBar can render at ANY arity
// A poll may publish SEVERAL headline voting-intention figures – a
// conventional 2PP, a three-cornered preferred (ALP / L‑NP / ON), an
// ALP v ON head-to-head – or a combination. Normalise them into a list of
// contests, exactly the way ppmContests does for preferred PM:
//   [{ kind, lab, flag, segs: [{label, value, color}] }]
// contests[0] is the row's headline bar; the rest surface as facet-flags in
// the compact row and as full bars in the expanded detail.
function tppContests(r) {
  const alp = r.alp2pp != null ? r.alp2pp : r.alp;   // canonical ALP v L/NP
  const lnp = r.lnp2pp != null ? r.lnp2pp : r.lnp;   // (latest vs archive row shape)
  const out = [];
  // ALP v L/NP delta vs the pollster's last poll; L/NP moves the opposite way
  const dAlp = segDelta(r.chg, "alp2pp");
  const dLnp = dAlp ? { v: +(-dAlp.v).toFixed(1), refDate: dAlp.refDate } : null;
  if (r.tppKind === "3cp" && r.tpp3) {
    out.push({ kind: "3cp", lab: "3-cornered · ALP / L‑NP / ON", flag: "3-cornered", segs: [
      { label: "ALP", value: r.tpp3.alp, color: PARTY_C.alp },
      { label: "L/NP", value: r.tpp3.lnp, color: PARTY_C.lnp },
      { label: "ON", value: r.tpp3.onp, color: PARTY_C.onp },
    ] });
    if (alp != null) out.push({ kind: "2pp", lab: "2PP · ALP v L/NP · derived", derived: true, flag: null, segs: [
      { label: "ALP", value: alp, color: PARTY_C.alp, delta: dAlp },
      { label: "L/NP", value: lnp, color: PARTY_C.lnp, delta: dLnp },
    ] });
  } else if (alp != null) {
    out.push({ kind: "2pp", lab: "2PP · ALP v L/NP", flag: null, segs: [
      { label: "ALP", value: alp, color: PARTY_C.alp, delta: dAlp },
      { label: "L/NP", value: lnp, color: PARTY_C.lnp, delta: dLnp },
    ] });
  }
  // each One Nation head-to-head carries its OWN change vs the pollster's last
  // publication of that same matchup; ON moves opposite its opponent
  const mirror = (d) => (d ? { v: +(-d.v).toFixed(1), refDate: d.refDate } : null);
  const dAltAlp = segDelta(r.chg, "altAlpOn");
  const dAlt2Lnp = segDelta(r.chg, "altLnpOn");
  if (r.tppAlt) out.push({ kind: "alt", lab: "2PP · ALP v ON", flag: "+ALP v ON", segs: [
    { label: "ALP", value: r.tppAlt.alp, color: PARTY_C.alp, delta: dAltAlp },
    { label: "ON", value: r.tppAlt.onp, color: PARTY_C.onp, delta: mirror(dAltAlp) },
  ] });
  if (r.tppAlt2) out.push({ kind: "alt2", lab: "2PP · L/NP v ON", flag: "+L/NP v ON", segs: [
    { label: "L/NP", value: r.tppAlt2.lnp, color: PARTY_C.lnp, delta: dAlt2Lnp },
    { label: "ON", value: r.tppAlt2.onp, color: PARTY_C.onp, delta: mirror(dAlt2Lnp) },
  ] });
  return out;
}
// flag text for the compact voting-intention cell ("3-cornered · +ALP v ON")
function tppFlag(r) {
  const f = tppContests(r).map((c) => c.flag).filter(Boolean);
  return f.length ? f.join(" · ") : null;
}
// heading for the detail block – names the single measure, counts several
function tppHeading(cs) {
  if (cs.length > 1) return "After preferences · " + cs.length + " measures";
  if (cs.length === 1 && cs[0].kind === "3cp") return "Three-cornered preferred";
  return "Two-party preferred";
}
function primarySegs(r) {
  return [
    { label: "ALP", value: r.p.alp, color: PARTY_C.alp, delta: segDelta(r.chg, "pAlp") },
    { label: "L/NP", value: r.p.lnp, color: PARTY_C.lnp, delta: segDelta(r.chg, "pLnp") },
    { label: "GRN", value: r.p.grn, color: PARTY_C.grn, delta: segDelta(r.chg, "pGrn") },
    { label: "ON", value: r.p.onp, color: PARTY_C.onp, delta: segDelta(r.chg, "pOnp") },
    { label: "OTH", value: r.p.oth, color: PARTY_C.oth, muted: true },
  ].filter((s) => s.value != null);   // a pollster may not publish every party
}
// leader identity → label + colour (shared by table PM bars & net columns)
const LEADER_META = {
  alb:    { label: "Albanese", color: PARTY_C.alp },
  taylor: { label: "Taylor",   color: PARTY_C.lnp },
  ley:    { label: "Ley",      color: PARTY_C.lnp },
  hanson: { label: "Hanson",   color: PARTY_C.onp },
  bandt:  { label: "Bandt",    color: PARTY_C.grn },
};
const PPM_ORDER = ["alb", "ley", "taylor", "bandt", "hanson"];

// segments for ONE preferred-PM contest object, e.g. {alb, taylor, unc}.
// `chg` is passed only for a poll's MAIN contest – extra matchups are a
// different question, so a change vs last poll wouldn't be like-for-like.
const PPM_CHG_KEY = { alb: "ppmAlb", ley: "ppmOpp", taylor: "ppmOpp", hanson: "ppmHan" };
function ppmContestSegs(c, chg) {
  const segs = PPM_ORDER.filter((id) => c[id] != null)
    .map((id) => ({ label: LEADER_META[id].label, value: c[id], color: LEADER_META[id].color,
                    delta: PPM_CHG_KEY[id] ? segDelta(chg, PPM_CHG_KEY[id]) : null }));
  if (c.unc != null) segs.push({ label: "Undecided", value: c.unc, color: PARTY_C.unc, muted: true });
  return segs;
}
// a poll may test ONE preferred-PM question (r.ppm) or SEVERAL pairwise
// matchups (r.ppmSets: [{alb, taylor, unc}, {alb, hanson, unc}]). Normalise.
function ppmContests(r) {
  if (Array.isArray(r.ppmSets)) return r.ppmSets;
  if (r.ppm) return [r.ppm];
  return [];
}

/* The one contest in a poll that answers a given matchup – "at" Albanese v the
   opposition leader, "ah" Albanese v Hanson head to head, "3" the three-way.
   A poll that asked two of them publishes both, and plotting them as one cloud
   would put two different questions on the same axis. */
function ppmMatch(r, mode) {
  const named = (c) => c.taylor != null || c.ley != null;
  return ppmContests(r).find((c) => (mode === "3" ? c.hanson != null && named(c)
                                   : mode === "ah" ? c.hanson != null && !named(c)
                                                   : c.hanson == null)) || null;
}
function ppmLabel(c) {
  if (c.label) return c.label;
  return PPM_ORDER.filter((id) => c[id] != null).map((id) => LEADER_META[id].label).join(" v ");
}
function ppmKind(c) {
  return PPM_ORDER.filter((id) => c[id] != null).length >= 3 ? "three-way" : "two-way";
}
// flag text for the compact table cell
function ppmFlag(cs) {
  if (cs.length > 1) return cs.length + " matchups";
  if (cs.length === 1 && ppmKind(cs[0]) === "three-way") return "3-way";
  return null;
}
function dirSegs(r) {
  const unsure = 100 - r.dir.right - r.dir.wrong;
  return [
    { label: "Right direction", value: r.dir.right, color: "var(--mood-pos)" },
    { label: "Unsure", value: unsure, color: PARTY_C.unc, muted: true },
    { label: "Wrong track", value: r.dir.wrong, color: "var(--mood-neg)" },
  ];
}

/* The pollster's name in a poll table (Latest polls AND the All-polls
   archive). Where the row knows which published release it came from, the
   name IS the link to it – an archive like this is meant to be checked
   against its sources, and the firm's name is the thing you'd reach for.
   Rows are click-to-expand, so the anchor swallows the click rather than
   toggling the row open on its way out. Falls back to plain text for the
   handful of polls with no citation. */
function PollsterName({ name, url }) {
  if (!url) return <span className="pollster-name">{name}</span>;
  let host = "";
  try { host = new URL(url).hostname.replace(/^www\./, ""); } catch (e) { /* keep the link, drop the hint */ }
  return (
    <a className="pollster-name pollster-link" href={url}
       target="_blank" rel="noopener noreferrer"
       onClick={(e) => e.stopPropagation()}
       title={host ? `Read the published poll · ${host}` : "Read the published poll"}>
      {name}<span className="plink-mark" aria-hidden="true">↗</span>
    </a>
  );
}

// arity-agnostic stacked share bar – renders however many segments it is given.
// `flag` renders inline at the end of the key row (never a second line, so
// flagged rows keep the same height as plain ones).
function ShareBar({ segs, compact, flag }) {
  const total = segs.reduce((s, x) => s + x.value, 0) || 100;
  return (
    <div className={"share" + (compact ? " share-compact" : "")}>
      <div className="sbar" role="img"
           aria-label={segs.map((s) => `${s.label} ${s.value}`).join(", ")}>
        {segs.map((s, i) => (
          <span key={i} className="sbar-seg"
                style={{ width: (s.value / total * 100) + "%", background: s.color }}></span>
        ))}
      </div>
      <div className="share-keys">
        {segs.map((s, i) => (
          <span key={i} className={"skey" + (s.muted ? " muted" : "")}>
            <span className="skey-dot" style={{ background: s.color }}></span>
            <span className="skey-lab">{s.label}</span>
            <span className="skey-val">{s.value}</span>
            {/* change vs the pollster's last poll – detail only; the compact
                table cells stay clean */}
            {!compact && s.delta && <ChgTag v={s.delta.v} refDate={s.delta.refDate} />}
          </span>
        ))}
        {flag && <span className="facet-flag">{flag}</span>}
      </div>
    </div>
  );
}

function NetVal({ v }) {
  return <span className={"netv " + (v >= 0 ? "pos" : "neg")}>{v > 0 ? "+" : ""}{v}</span>;
}

// Seat projection – MRP polls only. A seat count is a different animal from a
// vote share: it is a count out of the chamber, and the number that decides
// government is the majority line, not the leader. So the bar is drawn to
// scale in SEATS with the majority marked, and each party carries the
// modelled range, which is what an MRP is actually claiming.
// Seat projections name the crossbench more finely than voting intention does
// (a released MRP separates Centre Alliance, Katter's and independents, which
// the vote-share model folds into one "others"). So seats carry their own
// label/colour map rather than borrowing PARTIES, and unknown keys degrade to
// the neutral crossbench grey instead of throwing.
const SEAT_META = {
  alp: { name: "ALP",  color: "var(--alp)" },
  lnp: { name: "L/NP", color: "var(--lnp)" },
  onp: { name: "ON",   color: "var(--onp)" },
  grn: { name: "GRN",  color: "var(--grn)" },
  ind: { name: "IND",  color: "var(--oth)" },
  ca:  { name: "CA",   color: "var(--oth)" },
  kap: { name: "KAP",  color: "var(--oth)" },
  oth: { name: "OTH",  color: "var(--oth)" },
};
function SeatProjection({ seats }) {
  if (!seats || !seats.p) return null;
  const total = seats.total || 150;
  const majority = seats.majority || Math.floor(total / 2) + 1;
  /* Some projections are published as a RANGE and nothing else – DemosAU's
     Monte Carlo gives each party a bottom and a top and no central figure.
     There is no honest point estimate to derive from that (a midpoint would be
     one this pollster declined to state), so the chamber bar is skipped and
     the ranges are shown as ranges. The ranges also overlap and sum past the
     chamber, which is exactly why they cannot be stacked. */
  const rangeOnly = Object.keys(seats.p).every((id) => !seats.p[id] || seats.p[id].est == null);
  // largest first – an MRP's story is who leads the chamber, not ballot order
  const mid = (r) => (r.est != null ? r.est : ((r.lo + r.hi) / 2));
  const rows = Object.keys(seats.p)
    .filter((id) => seats.p[id] && (seats.p[id].est != null || (seats.p[id].lo != null && seats.p[id].hi != null)))
    .map((id) => { const m = SEAT_META[id] || { name: id.toUpperCase(), color: "var(--oth)" };
                   return { id, ...seats.p[id], name: m.name, color: m.color }; })
    .sort((a, b) => mid(b) - mid(a));
  if (!rows.length) return null;
  if (rangeOnly) {
    // can anyone govern in their own right at the TOP of their range?
    const best = rows[0];
    const reach = rows.filter((r) => r.hi >= majority);
    return (
      <div className="seatproj">
        <div className="seat-rows">
          {rows.map((r) => (
            <div className="seat-row" key={r.id}>
              <span className="skey-dot" style={{ background: r.color }}></span>
              <span className="seat-name">{r.name}</span>
              <span className="seat-est range">{r.lo}–{r.hi}</span>
              {r.note && <span className="seat-note">{r.note}</span>}
            </div>
          ))}
        </div>
        <div className="seatbar-note">
          <span className="seat-majlab">{majority} for majority</span>
          {!reach.length && (
            <span className="seat-hung">
              no party reaches it – {best.name} tops out {majority - best.hi} short
            </span>
          )}
        </div>
        <p className="seat-basis">
          Published as a range, with no central estimate
          {seats.method ? " · " + seats.method : ""}
        </p>
      </div>
    );
  }
  const sum = rows.reduce((s, r) => s + r.est, 0);
  const lead = rows[0];
  return (
    <div className="seatproj">
      <div className="seatbar" role="img"
           aria-label={rows.map((r) => `${r.name} ${r.est} seats`).join(", ") + `, majority ${majority} of ${total}`}>
        {rows.map((r) => (
          <span key={r.id} className="seatbar-seg" title={`${r.name} ${r.est} seats (${r.lo}–${r.hi})`}
                style={{ width: (r.est / total * 100) + "%", background: r.color }}></span>
        ))}
        <span className="seatbar-maj" style={{ left: (majority / total * 100) + "%" }}
              title={`${majority} seats needed for a majority`}></span>
      </div>
      <div className="seatbar-note">
        <span className="seat-majlab">{majority} for majority</span>
        {lead.est < majority && (
          <span className="seat-hung">no party at a majority – {lead.name} short by {majority - lead.est}</span>
        )}
      </div>
      <div className="seat-rows">
        {rows.map((r) => (
          <div className="seat-row" key={r.id}>
            <span className="skey-dot" style={{ background: r.color }}></span>
            <span className="seat-name">{r.name}</span>
            <span className="seat-est">{r.est}</span>
            {r.lo != null && r.hi != null && <span className="seat-range">{r.lo}–{r.hi}</span>}
            {r.chg != null && (
              <span className={"seat-chg " + (r.chg > 0 ? "up" : r.chg < 0 ? "down" : "flat")}>
                {r.chg === 0 ? "–" : (r.chg > 0 ? "▲" : "▼") + Math.abs(r.chg)}
              </span>
            )}
          </div>
        ))}
      </div>
      <p className="seat-basis">
        Modelled seat estimate with range · {sum} of {total} seats allocated
        {seats.basis ? ` · change vs the ${seats.basis}, not this pollster’s previous poll` : ""}
      </p>
    </div>
  );
}

// tiny tag beside a net that ISN'T plain approval, so it's never mistaken for
// approve−disapprove: "fav" = favourability (positive − negative), "perf" =
// Resolve's good/poor performance rating (good − poor).
function FavMark({ metric }) {
  if (metric !== "fav") return null;
  return <span className="fav-mark" title="Net favourability / likeability (positive minus negative) – a different question from approval, not directly comparable">fav</span>;
}

// block heading for a poll's leader ratings. A poll can mix metrics per leader
// (Resolve: approval for the majors, likeability for Hanson) – name the measure
// when they agree, fall back to the neutral "Leader ratings" when they don't.
function apprHeading(appr) {
  const mb = appr.metricBy || {};
  const ms = ["alb", "taylor", "hanson"]
    .filter((id) => appr[id + "Net"] != null)
    .map((id) => mb[id] || "approval");
  if (!ms.length) return "Leader ratings";
  if (ms.every((m) => m === "fav")) return "Leader favourability";
  if (ms.every((m) => m === "approval")) return "Leader approval";
  return "Leader ratings";
}

// change indicator vs the SAME pollster's previous poll that reported this
// measure. Direction only (▲ up / ▼ down / – no change) in neutral ink – no
// green/red, because "up" isn't inherently good in a party-neutral tracker.
// ref = ISO date of the poll compared against (surfaced in the tooltip).
function ChgTag({ v, refDate }) {
  if (v == null) return null;
  const { D } = window.AP;
  const flat = Math.abs(v) < 0.05;
  const lab = refDate ? (() => { const [, m, d] = refDate.split("-").map(Number); return d + " " + D.monthName(m); })() : null;
  return (
    <span className={"chg" + (flat ? " flat" : v > 0 ? " up" : " down")}
          title={"vs this pollster’s previous poll" + (lab ? " (" + lab + ")" : "")}>
      {flat ? "–" : (v > 0 ? "▲" : "▼") + Math.abs(v)}
    </span>
  );
}
// a seg's optional delta = { v, refDate }; null when there's no prior reading
function segDelta(chg, key) {
  if (!chg || chg.d[key] == null) return null;
  return { v: chg.d[key], refDate: chg.r[key] };
}

// leader approval – approve / don't-know / disapprove split per leader,
// mirroring the snapshot panel's bars, with the net at right. Ragged-
// tolerant: a leader the pollster didn't poll shows a dash, and a net-only
// reading (no published split) shows just the net.
function ApprBlock({ appr, chg }) {
  // nothing published at all → say so once instead of three dashed rows
  if (appr.albNet == null && appr.taylorNet == null && appr.hansonNet == null) {
    return <div className="pd-absent">No leader approval or favourability published with this poll</div>;
  }
  return (
    <div className="pd-apprs">
      {["alb", "taylor", "hanson"].map((id) => {
        const s = appr[id], net = appr[id + "Net"];
        const dk = s ? Math.max(0, 100 - s.app - s.dis) : 0;
        // metric is PER LEADER – one poll can ask approval of the majors and
        // favourability (likeability) of a minor-party leader
        const mt = (appr.metricBy && appr.metricBy[id]) || "approval";
        const segNames = mt === "fav" ? ["Positive", "Neutral", "Negative"]
          : ["Approve", "Don't know / never heard of", "Disapprove"];
        // short lowercase forms for the legend under the bar – the full phrase
        // (“Don't know / never heard of”) stays in the tooltip, but the legend
        // has to fit beside its figures at 11.5px
        const segLeg = mt === "fav" ? ["positive", "neutral", "negative"]
          : ["approve", "don’t know", "disapprove"];
        // the opposition slot is an office – label it by who held it (Ley →
        // Taylor, spliced Feb 2026) when the poll records that
        const label = id === "taylor" && appr.oppName ? appr.oppName : LEADER_META[id].label;
        // some waves publish BOTH measures for the same leader (Resolve rates
        // the majors on performance and likeability). They answer different
        // questions, so the second one sits beside the first – never averaged
        // into it, never shown as a correction of it.
        const alt = appr.alt && appr.alt[id];
        return (
          <div className="pd-appr" key={id}>
            <div className="pd-appr-top">
              <span className="skey-dot" style={{ background: LEADER_META[id].color }}></span>
              <span className="pd-appr-name">{label}</span>
              <span className="pd-appr-net">
                {net == null
                  ? <span className="dash" title="Not asked by this pollster">—</span>
                  : <><NetVal v={net} /><FavMark metric={mt} /><ChgTag v={(chg && chg.d[id + "Net"] != null) ? chg.d[id + "Net"] : null} refDate={chg && chg.r[id + "Net"]} /></>}
              </span>
            </div>
            {s && (
              <React.Fragment>
                <div className="appr-bar pd-appr-bar"
                     title={`${segNames[0]} ${s.app} · ${segNames[1]} ${dk} · ${segNames[2]} ${s.dis}`}>
                  <span className="appr-app" style={{ width: s.app + "%" }}></span>
                  <span className="appr-dk" style={{ width: dk + "%" }}></span>
                  <span className="appr-dis" style={{ width: s.dis + "%" }}></span>
                </div>
                {/* The middle segment of three tints was unguessable, so the
                    split is now stated: a line of labelled figures under the
                    bar instead of bare numbers crammed inside 10px segments. */}
                <div className="pd-appr-key">
                  <b>{s.app}</b> {segLeg[0]} · <b>{dk}</b> {segLeg[1]} · <b>{s.dis}</b> {segLeg[2]}
                </div>
              </React.Fragment>
            )}
            {alt && (
              <div className="pd-appr-alt"
                   title="This pollster asked both questions of this leader in the same wave – favourability (positive minus negative) is not directly comparable with approval">
                <span className="pd-appr-alt-k">
                  also {alt.metric === "fav" ? "favourability" : "approval"}
                </span>
                <NetVal v={alt.net} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Direction net – dashed when the poll didn't ask the question.
// Lives in the expanded detail only: it isn't part of any facet's question,
// so it earns no permanent column in the compact table.
function DirCell({ r }) {
  if (!r.dir) return <span className="dash" title="Not asked by this pollster">—</span>;
  const net = r.dir.right - r.dir.wrong;
  return <NetVal v={net} />;
}

// sortable column header – shared by the latest-polls AND archive tables.
// `sortKey` (or its archive alias `k`) names the column; an optional `short`
// label swaps in at narrow widths (.lbl-l / .lbl-s), full label as tooltip.
// The header stays a columnheader. It previously carried role="button", which
// overrode the implicit role – that both invalidated aria-sort and cost
// screen-reader users the column association on every sortable column.
// Keyboard activation is handled by tabIndex + onKeyDown instead.
function SortTh({ label, short, sortKey, k, sort, onSort, className }) {
  const key = sortKey != null ? sortKey : k;
  const active = sort.key === key;
  return (
    <th scope="col" className={(className || "") + " sortable" + (active ? " sorted" : "")}
        onClick={() => onSort(key)}
        tabIndex={0}
        title={short ? label : undefined}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSort(key); } }}
        aria-sort={active ? (sort.dir < 0 ? "descending" : "ascending") : "none"}>
      <span className="th-in">
        {short
          ? <React.Fragment><span className="lbl-l">{label}</span><span className="lbl-s">{short}</span></React.Fragment>
          : label}
        <span className="caret" aria-hidden="true">{active ? (sort.dir < 0 ? "▾" : "▴") : "⇅"}</span>
      </span>
    </th>
  );
}

// full per-poll breakdown – shows EVERYTHING the poll measured, ragged set and all
function PollDetail({ r }) {
  return (
    <div className="poll-detail">
      <div className="pd-meta">
        {/* the row's pollster cell already prints the client under the name,
            at every width – meta-dup keeps the meta line from saying it
            twice */}
        <span className="pd-meta-i meta-dup"><span className="pd-meta-k">Commissioned by</span> {r.client}</span>
        {r.mode && <span className="pd-meta-i"><span className="pd-meta-k">Method</span> {r.mode}</span>}
        <span className="pd-meta-i meta-md"><span className="pd-meta-k">Sample</span> {r.sample ? "n = " + r.sample.toLocaleString() : "—"}</span>
        <span className="pd-meta-i meta-dup"><span className="pd-meta-k">Field</span> {r.field}</span>
      </div>
      <div className="pd-grid">
        <div className="pd-block pd-head">
          <div className="pd-k">{tppHeading(tppContests(r))}</div>
          {tppContests(r).length === 0
            ? <div className="pd-absent">No two-party figure published with this poll</div>
            : <div className="pd-contests">
                {tppContests(r).map((c, i) => (
                  <div className={"pd-contest" + (i > 0 ? " pd-contest-minor" : "")} key={i}>
                    {tppContests(r).length > 1 && <div className="pd-contest-lab">{c.lab}</div>}
                    <ShareBar segs={c.segs} />
                  </div>
                ))}
              </div>}
        </div>
        <div className="pd-block">
          <div className="pd-k">First preferences</div>
          <ShareBar segs={primarySegs(r)} />
        </div>
        <div className="pd-block">
          <div className="pd-k">Preferred PM{ppmContests(r).length > 1 ? " · " + ppmContests(r).length + " matchups" : ppmContests(r).length === 1 && ppmKind(ppmContests(r)[0]) === "three-way" ? " · three-way" : ""}</div>
          {ppmContests(r).length === 0
            ? <div className="pd-absent">No preferred-PM question this wave</div>
            : <div className="pd-contests">
                {ppmContests(r).map((c, i) => (
                  <div className="pd-contest" key={i}>
                    {ppmContests(r).length > 1 && <div className="pd-contest-lab">{ppmLabel(c)}</div>}
                    <ShareBar segs={ppmContestSegs(c, i === 0 ? r.chg : null)} />
                  </div>
                ))}
              </div>}
        </div>
        <div className="pd-block">
          <div className="pd-k">{apprHeading(r.appr)}</div>
          <ApprBlock appr={r.appr} chg={r.chg} />
        </div>
        {/* only when the poll actually asked it – Roy Morgan asks every week,
            Essential most waves, and nobody else, so a permanent "not asked"
            row would be noise on most pollsters */}
        {r.dir && (
          <div className="pd-block pd-wide">
            <div className="pd-k">National direction</div>
            <ShareBar segs={dirSegs(r)} />
          </div>
        )}
        {r.undecided != null && <UndecidedLine v={r.undecided} chg={r.chg} basis={r.undecidedBasis} />}
        {/* a modelled chamber is not a per-poll measure, so it takes the full
            width – and it belongs HERE as well as in the archive: a projection
            published this week is exactly what someone reading the latest
            polls came for */}
        {r.seats && (
          <div className="pd-block pd-wide">
            <div className="pd-k">Seat projection</div>
            <SeatProjection seats={r.seats} />
          </div>
        )}
      </div>
    </div>
  );
}

/* ====================================================================
   NEXT EXPECTED POLLS
   Sits under Latest polls and answers the obvious next question: when does
   the next one land? Each house's own recent rhythm drives it – see
   pollCadence in gen-data for how cadence and publication lag are measured.

   Dates are computed here rather than at build time so the panel stays right
   as the page ages: a slot whose moment has passed without that release being
   added is left exactly where it is and marked overdue, rather than rolled
   forward onto a date nobody has published – the row isn't removed until the
   data for it is.
   ==================================================================== */
const DAY_MS = 86400000;
const WD = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const NP_HORIZON_DAYS = 28;   // one month of schedule
const NP_MAX_ROWS = 10;       // a busy fortnight shouldn't run off the page
/* A house nobody has timed keeps its whole day: with no hour recorded there is
   no moment to say has passed, so the row stays "today" until today is over
   rather than being rolled off the list by an hour we invented for it. */
const NP_UNTIMED_MINS = 24 * 60;
/* "Now", in the frame this schedule is written in.

   Every date on this page is an Australian calendar date and every release
   hour is an eastern one, so "today" has to be Sydney's today - not the
   reader's. A reader in London at 11pm on the 25th is looking at a schedule
   that is already on the 26th, and was being told a poll due in four hours
   was "tomorrow". The day comes back as UTC midnight, which is the frame
   Date.parse("YYYY-MM-DD") produces and the frame everything here compares
   in, and the clock as minutes past it. */
function easternNow() {
  const d = new Date();
  try {
    const p = {};
    for (const x of new Intl.DateTimeFormat("en-AU", {
      timeZone: "Australia/Sydney", year: "numeric", month: "2-digit",
      day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(d)) p[x.type] = x.value;
    // some engines still render midnight as hour 24 rather than 0
    return { day: Date.UTC(+p.year, +p.month - 1, +p.day), mins: (+p.hour % 24) * 60 + +p.minute };
  } catch (e) {
    return { day: Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()),
             mins: d.getHours() * 60 + d.getMinutes() };
  }
}

/* The hour a house files: "5 am", "5:30 am", and a span as "5-6 am" rather
   than "5 am-6 am" when both ends share a meridiem. Colon, not the full stop
   this used to print - a time is written 4:30 here. House local time, which
   is eastern - not converted to the reader's zone, because when a publisher
   files is a fact about the publisher. The span is the observed one, so it
   stays honest about a house that is not quite punctual instead of averaging
   its way to a minute nobody has seen. */
function clockParts(mins) {
  const h = Math.floor(mins / 60), mi = mins % 60;
  const ap = h < 12 ? "am" : "pm";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return { num: mi ? `${h12}:${String(mi).padStart(2, "0")}` : `${h12}`, ap };
}
function clockLabel(mins) {
  const c = clockParts(mins);
  return `${c.num} ${c.ap}`;
}
/* AEST or AEDT, for the DATE in question. Every hour on this panel is the
   publisher's own clock, and half the year that clock is an hour ahead of the
   other half - so "8 pm" alone names two different moments depending on when
   you read it. Resolved through Intl rather than by hardcoding the first
   Sundays of October and April, so it keeps being right if the rule moves. */
const EASTERN_TZ = (() => {
  try {
    return new Intl.DateTimeFormat("en-AU",
      { timeZone: "Australia/Sydney", timeZoneName: "short" });
  } catch (e) { return null; }
})();
function easternAbbr(ms) {
  if (!EASTERN_TZ || ms == null || !isFinite(ms)) return "AEST";
  try {
    // dates here are UTC midnight; +2h lands at midday in Sydney on the same
    // calendar day, which is the day whose offset is wanted
    const z = EASTERN_TZ.formatToParts(new Date(ms + 2 * 3600000))
      .find((x) => x.type === "timeZoneName");
    return z && /^AE[SD]T$/.test(z.value) ? z.value : "AEST";
  } catch (e) { return "AEST"; }
}
// an hour with the clock it is read on, which is the only form of it that
// names a moment rather than a habit
const zoned = (label, ms) => (label ? `${label} ${easternAbbr(ms)}` : label);
/* "24 Aug, 8:51 am AEST" - one publication stamp, printed the same way
   wherever one appears, so the archive and the projections panel cannot drift
   into two house styles for the same fact. The hour rides along only where a
   release recorded one; the DATE is never invented, so this returns null when
   there is no publication date and each caller says so in its own words rather
   than being handed a fieldwork end wearing the wrong label. */
function pubStamp(published, opts) {
  if (!published) return null;
  const iso = published.slice(0, 10);
  const d = new Date(iso + "T00:00:00Z");
  const mon = window.AP.D.monthName(d.getUTCMonth() + 1);
  const date = `${d.getUTCDate()} ${mon}`
    + (opts && opts.year ? " " + String(d.getUTCFullYear()).slice(2) : "");
  const cl = /T(\d{2}):(\d{2})/.exec(published);
  return cl ? `${date}, ${zoned(clockLabel(+cl[1] * 60 + +cl[2]), Date.parse(iso))}` : date;
}
/* A span is only worth printing while it IS the habit. YouGov has filed at 5am
   five times and 6am once, so "5-6 am" describes it. Essential has filed at 1am
   four times and 4:36am once, and "1-4:36 am" would let a single late morning
   speak for a house that is otherwise punctual to the minute - so past an hour
   and a half the usual time is stated instead, and the outlier is left to the
   ± on the day. */
const RELEASE_TIGHT_MINS = 90;
/* What the ± is allowed to say once a date has been pinned to a weekday.
   The spread is measured off the gaps between fieldwork-end dates, and quoting
   it in days after the snap describes a date that cannot happen: YouGov's
   interval varies by about a day, but its release cannot slip to a Tuesday or
   a Thursday - the nearest release it could actually be is the Wednesday
   seven days away, and a day of drift does not reach it. So the answer moves
   in whole weeks, and the count is how many other Wednesdays the spread
   actually reaches (+3 because the snap itself may have moved up to 3 days).

   YouGov comes out at none: 14,14,14,14,14,14,13,14 between waves, so it is
   that Wednesday. Essential comes out at one: 14,46,31,28,35,27,36,28 is a
   real spread, so it is a Wednesday but possibly the next. Which is the whole
   difference between the two houses, and the ± in days was hiding it behind
   two numbers that looked like the same kind of claim. */
function spreadLabel(r) {
  if (r.releaseDow == null) return ` ± ${r.spread} day${r.spread === 1 ? "" : "s"}`;
  const weeks = Math.floor((r.spread + 3) / 7);
  return weeks === 0 ? "" : ` ± ${weeks} week${weeks === 1 ? "" : "s"}`;
}
/* The window a row counts with must be the one its ± claims, and for a
   weekday house that is whole weeks, not days. Essential's gaps scatter
   ±4 days, but no Sunday or Friday filing can come of that – the only
   dates the wave can land on are this Wednesday or the ones either side,
   i.e. ±1 week. Measuring in raw days puts the window's far edge on a day
   the house cannot publish: Essential's row was counting down to a Sunday
   when the wave is really open until the Wednesday after. Houses with no
   weekday habit (and loose houses, whose raw span IS the claim) keep the
   day spread. Same +3 as the label: the snap itself can move 3 days. */
function spreadDays(c, sp) {
  return c.releaseDow != null && !c.loose ? 7 * Math.floor((sp + 3) / 7) : sp;
}
function releaseLabel(from, to, mid) {
  if (from == null || to == null) return null;
  if (from === to) return clockLabel(from);
  if (to - from > RELEASE_TIGHT_MINS) return clockLabel(Math.round(mid != null ? mid : (from + to) / 2));
  /* "5–6 am", not "5 am–6 am": one meridiem serves a span inside it, and the
     dash is the tight unspaced one every other range on the page uses. */
  const a = clockParts(from), b = clockParts(to);
  return a.ap === b.ap ? `${a.num}–${b.num} ${b.ap}`
                       : `${clockLabel(from)}–${clockLabel(to)}`;
}

// name the rhythm in the words people actually use for it
function cadenceLabel(d) {
  if (d >= 6.5 && d <= 7.5) return "weekly";
  if (d >= 13 && d <= 15) return "fortnightly";
  if (d >= 20 && d <= 22) return "every 3 weeks";
  if (d >= 27 && d <= 32) return "monthly";
  if (d >= 40 && d <= 48) return "every 6 weeks";
  return `every ${Math.round(d)} days`;
}

// survives the panel being unmounted by a tab change – see the note in the
// component on why an open row has to outlive the trip to the archive
let npOpenRow = null;
function NextPollsPanel() {
  const { D } = window.AP;
  const cad = D.pollCadence || [];
  /* Which row is showing its working. A date arrived at by a median of
     intervals is a claim, and the releases it was taken over are the evidence
     for it - kept folded away because the panel's job is the answer, one
     click from the reason.

     Held outside the component as well as in it. Opening a release in the
     archive leaves this tab, which unmounts the panel, and the return trip
     lands on the same pixel in front of a row that had closed itself while the
     reader was away - the one thing they were looking at. */
  const [open, setOpenState] = useState(npOpenRow);
  const setOpen = (v) => { npOpenRow = v; setOpenState(v); };
  if (!cad.length) return null;

  /* Every date in here comes from Date.parse("YYYY-MM-DD"), which is UTC
     midnight, so "today" has to be the same thing or the comparison measures
     the reader's timezone as well as the gap - see easternNow.

     And the projection is floored to its own calendar day, because that is
     what the row prints. Essential's cadence is a median of 29.5 days, so its
     release landed at noon; against a midnight "today" that rounded to one day
     out, and the row said "tomorrow" underneath a date that was today. A
     half-day is not a fact about when a poll lands - it is a fact about
     medians of an odd number of days.

     The CLOCK matters too, and used not to be looked at at all. Essential is
     expected at 1am on a Wednesday; read at 3pm on that Wednesday the panel
     still said "today", naming a moment fourteen hours gone as the next thing
     to happen. So a projection is a moment, not a date, and it is spent once
     that moment passes. */
  const eNow = easternNow();
  const t0 = eNow.day;
  const nowMs = t0 + eNow.mins * 60000;
  const dayFloor = (ms) => {
    const d = new Date(ms);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  };

  /* A four-week horizon rather than a fixed count: it answers "what lands this
     month" and sizes itself to how busy the field actually is. A weekly house
     appears four times, a monthly one once – which is the honest shape of the
     schedule, not a repetition bug. */
  const rows = [];
  const horizon = t0 + NP_HORIZON_DAYS * DAY_MS;
  cad.forEach((c) => {
    /* A house that keeps a weekday is projected onto it. Interval alone put
       Essential on a Thursday and YouGov on a Tuesday, when between them they
       have published on a Wednesday thirteen times out of fourteen dated
       releases - the interval is a median over waves whose fieldwork has
       shifted by a day or two, and it carries that drift into the answer.
       Nudged to the NEAREST matching weekday, never more than three days, so
       this corrects a rounding error rather than overriding the cadence: a
       house whose interval says three weeks does not get moved a fortnight to
       land on a Wednesday. Uses the same getDay() the row is printed with, so
       the date shown always falls on the weekday claimed for it. */
    const snap = (ms) => {
      if (c.releaseDow == null) return ms;
      let d = c.releaseDow - new Date(ms).getUTCDay();
      if (d > 3) d -= 7;
      if (d < -3) d += 7;
      return ms + d * DAY_MS;
    };
    // the moment a projected release is expected, which is the date plus the
    // hour the house keeps – the thing that is compared against now
    const due = (rel) => rel + (c.releaseMins == null ? NP_UNTIMED_MINS : c.releaseMins) * 60000;
    const relOf = (f) => dayFloor(snap(f + c.lag * DAY_MS));

    /* The next slot after the last recorded release – never rolled forward on
       a guess. A slot whose moment has passed without that release being
       added is overdue, not wrong: the wave may already be out and simply not
       entered yet, or it may be running late, and this page cannot tell
       which. Either way the honest row is the one the data on record actually
       supports, left where it is and marked overdue – it leaves the list only
       once a new release moves `c.last` past it, at which point this slot is
       what got confirmed and the row after it is the fresh guess. */
    let field = Date.parse(c.last) + c.cadence * DAY_MS;
    let release = relOf(field);
    /* A loose house earns its place when its WINDOW opens inside the horizon,
       not when its centre falls inside it: DemosAU's next centre is 30 days
       out and its window opens in 13, so testing the centre would hide a house
       that may well file next week. */
    const reaches = (rel, sp) => (c.loose ? rel - sp * DAY_MS : rel) <= horizon;
    for (let i = 0; reaches(release, Math.max(1, Math.round(c.spread * Math.sqrt(i + 1)))) && i < 12; i++) {
      const overdue = due(release) <= nowMs;
      /* Each further wave is one more interval of drift, so the window widens
         as sqrt(waves) – the second Essential is a looser bet than the first.
         A house on a fixed weekly schedule barely moves; an erratic one
         visibly fans out, which is the point. */
      const sp = Math.max(1, Math.round(c.spread * Math.sqrt(i + 1)));
      /* The window is measured in the units the ± states it in – whole
         weeks for a weekday house (Essential's ±4 days is a ±1 week claim),
         raw days for everyone else. See spreadDays. */
      const winHalf = spreadDays(c, sp);
      rows.push({
        ...c, field, release, overdue, ahead: i,
        spread: sp, winHalf,
        inDays: Math.round((release - t0) / DAY_MS),
        opensIn: Math.round((release - winHalf * DAY_MS - t0) / DAY_MS),
        /* Overdue is not missed while the ± window is still open: the row
           counts on toward the far edge of it, and is only red once that too
           has passed. */
        closesIn: Math.round((release + winHalf * DAY_MS - t0) / DAY_MS),
        missed: overdue && release + winHalf * DAY_MS < t0,
      });
      // an overdue slot isn't a base to project the next one from – that
      // would stack a guess on a slot nothing has confirmed yet
      if (overdue || c.loose) break;   // loose: one window per house, same reason
      field += c.cadence * DAY_MS;
      release = dayFloor(snap(field + c.lag * DAY_MS));
    }
  });
  /* Ordered by when each entry's wave is assumed to land – for a dated row
     that is the date, for a window the day it opens. An overdue row whose
     window is still open sorts at the FAR edge, not the date just missed:
     the assumption is that its poll has not been published, and while the
     window stays open the soonest it can land is that edge – so Essential
     sits under "in 3 days" and "in 5 days", at its own "in 6 days", instead
     of claiming the top of the list with yesterday's slot. A missed row
     (edge also past) drops to the foot: there is no date left to give it. */
  const first = (r) => (r.loose ? r.release - r.spread * DAY_MS
    : r.missed ? Infinity
    : r.overdue ? r.release + (r.winHalf != null ? r.winHalf : r.spread) * DAY_MS
    : r.release);
  rows.sort((a, b) => first(a) - first(b));
  rows.length = Math.min(rows.length, NP_MAX_ROWS);

  const overdue = rows.some((r) => r.overdue);
  // which houses are running on a schedule that was stated rather than measured
  const stated = [...new Set(rows.filter((r) => (r.declared || []).length).map((r) => r.pollster))];
  /* Which houses are projected from their PUBLICATION dates and which fall back
     to fieldwork ends. Named rather than described in the abstract: a reader
     comparing two rows should be able to tell which of them rests on the
     steadier measure. */
  const shownHouses = [...new Set(rows.map((r) => r.pollster))];
  const basisOf = (b) => shownHouses.filter((h) => (cad.find((c) => c.pollster === h) || {}).basis === b);
  const byPub = basisOf("published"), byField = basisOf("fieldwork");
  const listOf = (a) => (a.length === 1 ? a[0]
    : a.slice(0, -1).join(", ") + " and " + a[a.length - 1]);
  // UTC accessors, matching the frame the dates were parsed and compared in –
  // local ones would name the day before for any reader west of Greenwich
  const fmt = (ms) => {
    const d = new Date(ms);
    return `${WD[d.getUTCDay()].slice(0, 3)} ${d.getUTCDate()} ${D.monthName(d.getUTCMonth() + 1)}`;
  };
  /* n goes negative for an overdue row now that one can sit past its own
     moment instead of rolling forward – "in -1 days" named nothing a reader
     would recognise, so a past slot counts the days the other way. -1 is
     "yesterday": "1 day overdue" says how late, when the column everywhere
     else answers when. */
  const when = (n) => (n === -1 ? "yesterday"
    : n < 0 ? `${-n} days overdue`
    : n === 0 ? "today" : n === 1 ? "tomorrow" : `in ${n} days`);
  /* The fallback after "or" on an overdue row whose window is still open –
     how far back the date itself fell, phrased so 0 and 1 read as English
     too: "in 6 days (or yesterday)". */
  const ago = (n) => (n === 0 ? "earlier today"
    : n === 1 ? "yesterday" : `${n} days ago`);
  /* A one-sided schedule names its real alternative instead of mirroring it.
     A symmetric ± pretends the wave can arrive a week EARLY, and in the
     current record no weekday house ever has - every miss is a week late.
     So where the measured early side is zero and the late side reaches
     another release day, the row names that day: "Sun 30 Aug (or Sun 6
     Sep)". A date, not "+ 1 week", because the alternative IS one specific
     Sunday, and "+ 1 week" reads like an arrival time rather than a
     tolerance. Both sides are possible in principle - an early-only record
     names the earlier day the same way. */
  const pmLabel = (r) => {
    if (r.releaseDow != null && r.spreadEarly != null) {
      const widen = Math.sqrt(r.ahead + 1);
      const earlyW = Math.floor((r.spreadEarly * widen + 3) / 7);
      const lateW = Math.floor((r.spreadLate * widen + 3) / 7);
      if (earlyW === 0 && lateW >= 1) return ` (or ${fmt(r.release + lateW * 7 * DAY_MS)})`;
      if (lateW === 0 && earlyW >= 1) return ` (or ${fmt(r.release - earlyW * 7 * DAY_MS)})`;
    }
    return spreadLabel(r);
  };
  /* The releases list spans months and sometimes a new year, so unlike the
     projection column it carries one. The weekday rides on the PUBLICATION
     date only: a weekday is a fact about when a house files, and putting one
     on a fieldwork end as well would give two dates on a line equal billing
     when only one of them has a habit. */
  const fmtDay = (iso) => {
    const d = new Date(iso + "T00:00:00Z");
    return `${d.getUTCDate()} ${D.monthName(d.getUTCMonth() + 1)} ${d.getUTCFullYear()}`;
  };
  const fmtDow = (iso) => `${WD[new Date(iso + "T00:00:00Z").getUTCDay()].slice(0, 3)} ${fmtDay(iso)}`;

  return (
    <section className="card next-polls">
      <div className="np-head">
        <h2 className="card-title">Next expected polls</h2>
        <p className="card-sub">
          Projected from each house’s recent publication intervals · open a row for the releases behind it
        </p>
      </div>

      <ol className="np-list">
        {rows.map((r) => {
          const key = r.pollster + "-" + r.release;
          const isOpen = open === key;
          const hour = releaseLabel(r.releaseFrom, r.releaseTo, r.releaseMid);
          const recent = r.recent || [];
          return (
          <li className={"np-item" + (isOpen ? " open" : "")} key={key}>
            <div className={"np-row" + (r.loose ? " np-loose" : "") + (isOpen ? " open" : "")}
                 onClick={() => setOpen(isOpen ? null : key)}>
            <span className="np-firm">
              {/* the same disclosure control the archive table uses, so the
                  two lists open the same way */}
              <button className={"exp-btn" + (isOpen ? " open" : "")} aria-expanded={isOpen}
                      aria-label={isOpen ? "Hide the releases this is projected from"
                                         : `The releases ${r.pollster} is projected from`}>▸</button>
              {r.site
                ? <a className="np-link" href={r.site} target="_blank" rel="noopener noreferrer"
                     onClick={(e) => e.stopPropagation()}
                     title={`Where ${r.pollster} publishes`}>
                    {r.pollster}<span className="plink-mark" aria-hidden="true">↗</span>
                  </a>
                : r.pollster}
            </span>
            <span className="np-date">
              {r.loose
                /* The ± IS the forecast here, so state it as the span it is
                   rather than as a day with a disclaimer bolted on. */
                ? <>{fmt(r.release - r.spread * DAY_MS)}–{fmt(r.release + r.spread * DAY_MS)}</>
                : <>{fmt(r.release)}
                    {/* the hour qualifies the DAY, so it sits with it rather
                        than in the cadence column with the rhythm - and it
                        carries the clock it is read on, since AEST and AEDT
                        are an hour apart and "8 pm" alone names both */}
                    {hour && <span className="np-time">, {zoned(hour, r.release)}</span>}
                    <span className="np-pm">{pmLabel(r)}</span></>}
            </span>
            {/* the column answers "when", so a window answers it too – with the
                day it opens, which is the first date the wave is possible. An
                overdue row whose window is still OPEN answers with its far edge
                plus when the slot itself fell – the red is reserved for a wave
                that can no longer land inside its own span */}
            <span className={"np-when" + (r.missed ? " np-missed" : "")}>
              {r.loose
                ? (r.opensIn <= 0 ? "open now" : "opens " + when(r.opensIn))
                : r.overdue && !r.missed
                  ? `${when(r.closesIn)} (or ${ago(-r.inDays)})`
                  : when(r.inDays)}
            </span>
            <span className="np-cadence">
              {cadenceLabel(r.cadence)}
              {/* the wave count is the evidence for the estimate – worth stating
                  once per house, not four times for a weekly one */}
              {r.ahead === 0 && <> · {r.waves} waves</>}
            </span>
            </div>

            {/* ---- the working ----------------------------------------------
                Newest first, because "when did they last publish" is the
                question a reader opens this to answer. The interval on each
                line is the gap to the release BELOW it, which is the quantity
                the median is taken over. */}
            {isOpen && (
              <div className="np-detail">
                <div className="npd-h">
                  Last {recent.length} releases
                  {r.site && <a className="npd-site" href={r.site} target="_blank" rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}>
                    {(() => { try { return new URL(r.site).hostname.replace(/^www\./, ""); }
                              catch (e) { return "the house"; } })()}
                    <span className="plink-mark" aria-hidden="true">↗</span>
                  </a>}
                </div>
                {/* Two dates, so they are labelled. A single column could stand
                    unheaded; a fieldwork end beside a publication date cannot,
                    and the interval is measured between the first of them. */}
                <div className="npd-row npd-cols" aria-hidden="true">
                  <span>Field to</span><span>Published</span><span>Interval</span>
                </div>
                <ol className="npd-list">
                  {[...recent].reverse().map((x) => (
                    <li className="npd-row" key={x.field}>
                      {/* Two destinations, one per date, which is what each
                          date IS: the fieldwork end is this site's record of
                          the wave and opens its archive row; the publication
                          date is the publisher's, and leaves. */}
                      {(() => {
                        const key = window.AP.pollRowKey
                          && window.AP.pollRowKey({ pollster: r.pollster, released: x.field });
                        if (!key || !window.AP.openPoll)
                          return <span className="npd-field">{fmtDay(x.field)}</span>;
                        return (
                          <button className="npd-field npd-field-link"
                                  onClick={(e) => { e.stopPropagation();
                                    window.AP.openPoll(key, "twopp", "next expected polls"); }}
                                  title="Open this poll in All polls">
                            {fmtDay(x.field)}<span className="plink-mark" aria-hidden="true">→</span>
                          </button>
                        );
                      })()}
                      {/* The publication date and hour where the release
                          recorded them. Where it did not, the cell says so
                          rather than letting the fieldwork end stand in for a
                          date nobody published on — the two are days apart. */}
                      {x.pub
                        ? (() => {
                            const stamp = <>
                              {fmtDow(x.pub)}
                              {x.mins != null && <>, {zoned(clockLabel(x.mins), Date.parse(x.pub))}</>}
                            </>;
                            /* the date IS the release, so it is the way to it -
                               a reader checking a projection against its evidence
                               wants the thing that was published, not a second
                               link somewhere else on the line */
                            return x.url
                              ? <a className="npd-pub npd-pub-link" href={x.url}
                                   target="_blank" rel="noopener noreferrer"
                                   onClick={(e) => e.stopPropagation()}
                                   title="Read this release">
                                  {stamp}<span className="plink-mark" aria-hidden="true">↗</span>
                                </a>
                              : <span className="npd-pub">{stamp}</span>;
                          })()
                        : <span className="npd-pub none" title="No publication date recorded for this wave">—</span>}
                      {/* the bottom line's interval is measured from a release
                          one row further back than the list prints, so every
                          line says what it was measured from */}
                      <span className="npd-gap"
                            title={x.since
                              ? `Since the previous ${r.basis === "published" ? "publication" : "fieldwork end"}, ${fmtDay(x.since)}`
                              : undefined}>
                        {x.gap != null ? `${x.gap} days` : ""}
                      </span>
                    </li>
                  ))}
                </ol>
                <p className="npd-foot">
                  {/* what the projection is ACTUALLY taken over, which is more
                      intervals than are listed here - the list is the recent
                      shape of the schedule, not the whole sample */}
                  Median {r.cadence} days between{" "}
                  {r.basis === "published" ? "publications" : "fieldwork ends"} across the
                  last {r.gapsUsed} intervals
                  {r.spreadEarly != null && r.spreadEarly !== r.spreadLate
                    ? `, –${r.spreadEarly}/+${r.spreadLate} days`
                    : r.spread ? `, ± ${r.spread} day${r.spread === 1 ? "" : "s"}` : ""}.
                  {/* a publication-based projection steps from one publication
                      to the next, so the lag is already inside the interval and
                      there is nothing left to add */}
                  {r.basis !== "published" && <>{" "}Plus{" "}
                    {r.lagMeasured
                      ? `a ${r.lag}-day publication lag measured off ${r.lagMeasured} releases`
                      : "the field’s one-day publication lag"}.</>}
                  {/* The weekday and the hour are two separate corrections and
                      only some houses have either. Run together they made a
                      house with no weekday - DemosAU - read as though its
                      publication lag happened at 6:52 in the morning. */}
                  {r.releaseDow != null &&
                    ` Nudged onto ${WD[r.releaseDow]}${hour ? `, when it files at ${zoned(hour, r.release)}` : ""}.`}
                  {r.releaseDow == null && hour && ` It files at ${zoned(hour, r.release)}.`}
                  {(r.declared || []).length > 0 &&
                    ` The ${r.declared.join(" and ")} ${r.declared.length > 1 ? "are" : "is"} stated from ${r.pollster}’s own schedule rather than measured.`}
                </p>
              </div>
            )}
          </li>
          );
        })}
      </ol>

      <p className="np-foot">
        Each date is the house’s median interval between its last eight releases, nudged onto
        the weekday it keeps. What the interval is measured BETWEEN depends on what the house
        has recorded. Where its recent releases carry publication dates in an unbroken run, it
        is the gaps between those — which is the thing being forecast, and much the steadier
        measure: Newspoll’s last eight fieldwork gaps run from 18 days to 31, while it has
        published exactly three weeks apart six times in eight, all the wobble being in when
        its fieldwork happened to close.
        {byPub.length > 0 && ` ${listOf(byPub)} ${byPub.length > 1 ? "are" : "is"} projected that way.`}
        {byField.length > 0 && ` ${listOf(byField)}, which ${byField.length > 1 ? "have" : "has"} too few recorded publication dates to measure one, ${byField.length > 1 ? "fall" : "falls"} back to the gaps between fieldwork ends plus a publication lag — measured from the dates recorded against each poll, or read from a release URL that carries one, and otherwise a day, which is the field’s.`}
        {" "}The ± is half
        the range of those intervals with the longest and shortest set aside, widening for waves
        further out — in whole weeks for a house pinned to a weekday, since that is the only step
        its date can take, and dropped where the interval never reaches the day either side.
        {" "}Where a house
        has been timed often enough the hour it files is shown too — the span its releases have
        covered where that is tight, and otherwise the hour it usually keeps, so one late morning
        doesn’t speak for a house that is normally punctual. Every hour here is the publisher’s
        own clock and is labelled with it, AEDT through the summer and AEST the rest of the year,
        because the two are an hour apart and “8 pm” alone names both. Weekday and
        hour are read off recent releases rather than the whole record, because a schedule is a
        current fact about a house and its first year is often a different house. A house whose
        interval is too variable to name a day gets the window its own record supports instead
        of being left out — DemosAU polls about monthly, but anywhere in a five-week span.
        {stated.length > 0 && ` ${stated.join(" and ")} ${stated.length > 1 ? "run" : "runs"} on a schedule stated by hand rather than measured, because the recorded releases don’t measure the one the house plainly keeps.`}
        {" "}A projection is a moment, not a guess: once the hour passes without that release, the
        date stays exactly where it is and says so, rather than rolling forward onto a date nobody
        has published.
        {overdue && " A row past its moment is taken to be a poll not yet published: it counts on to the far edge of its own window, and sorts there too, while the wave can still land inside it, and only reads as missed, in red at the foot of the list, once that edge has passed too. It leaves this list only once that release is added, not on a date guessed in its place."}
        {" "}Opening a row lists that house’s five most recent releases with the interval between
        each, and names the house’s own release page, so the estimate can be checked against the
        thing it was taken from rather than taken on trust.
        {" "}Houses that have stopped publishing are omitted. “Today” is Sydney’s. These are
        estimates, not announced dates.
      </p>
    </section>
  );
}

function PollsterTable() {
  const { D } = window.AP;
  // ledger look shared with the All-polls archive – its cell renderers are
  // defined in the archive script and arrive on window once both assets load
  const { ArchPublished, ArchLead, ArchApprCell, archLeadInfo } = window;
  const [facet, setFacet] = useState("twopp");
  const [sort, setSort] = useState({ key: "pubSort", dir: -1 });
  const [open, setOpen] = useState(null);

  const onSort = (key) =>
    setSort((s) => (s.key === key ? { key, dir: -s.dir } : { key, dir: -1 }));

  const getVal = (r, key) => {
    switch (key) {
      case "pollster": return r.pollster;
      case "released": return r.released;
      // publication date where the source gave one, fieldwork end where it
      // didn't – the same value the column displays, so the order matches it
      case "pubSort": return r.pubSort;
      case "sample": return r.sample ?? -Infinity;
      case "alp": {
        const li = archLeadInfo(r, "lnp");
        return li ? li.m : -Infinity;
      }
      case "p.alp": return r.p.alp ?? -Infinity;
      case "p.lnp": return r.p.lnp ?? -Infinity;
      case "p.grn": return r.p.grn ?? -Infinity;
      case "p.onp": return r.p.onp ?? -Infinity;
      case "ppm.alb": { const c = ppmContests(r)[0]; return c && c.alb != null ? c.alb : -Infinity; }
      case "appr.albNet": return r.appr.albNet != null ? r.appr.albNet : -Infinity;
      case "appr.taylorNet": return r.appr.taylorNet != null ? r.appr.taylorNet : -Infinity;
      case "appr.hansonNet": return r.appr.hansonNet != null ? r.appr.hansonNet : -Infinity;
      default: return 0;
    }
  };
  const rows = [...D.pollsterTable].sort((a, b) => {
    const va = getVal(a, sort.key), vb = getVal(b, sort.key);
    if (va < vb) return -sort.dir;
    if (va > vb) return sort.dir;
    return 0;
  });

  const newest = [...D.pollsterTable].sort((a, b) => b.released.localeCompare(a.released));
  const fmtWin = (iso) => {
    const [, m, d] = iso.split("-").map(Number);
    return `${d} ${D.monthNameFull(m)}`;
  };
  const windowLabel = `${fmtWin(newest[newest.length - 1].released)}\u2013${fmtWin(newest[0].released)}`;

  const FACETS = [
    { id: "twopp", label: "2PP" },
    { id: "primary", label: "Primary" },
    { id: "leadership", label: "Leadership" },
  ];

  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2 className="card-title">Latest polls</h2>
          <p className="card-sub">
            The most recent poll from each active pollster · {windowLabel} · {rows.length} pollsters
          </p>
        </div>
        <TextToggle value={facet} onChange={setFacet} options={FACETS}
          ariaLabel="Poll table view" caps />
      </div>

      {/* ap-wrap keeps the wrapper's overflow visible so the archive-style
          thead can pin to the viewport – overflow-x on table-wrap would
          silently turn it into the sticky containing block */}
      <div className="table-wrap ap-wrap">
        <table className="poll-table archive">
          <caption className="sr-only">
            Latest poll from each active pollster, {(FACETS.find((f) => f.id === facet) || {}).label}
            {" "}columns – {rows.length} pollsters
          </caption>
          <thead>
            <tr>
              <th scope="col" className="exp-col" aria-hidden="true"></th>
              <SortTh label="Pollster" sortKey="pollster" sort={sort} onSort={onSort} className="ta-l" />
              <SortTh label="Published" sortKey="pubSort" sort={sort} onSort={onSort} className="ta-l" />
              <SortTh label="Fieldwork" short="Field" sortKey="released" sort={sort} onSort={onSort} className="ta-l" />
              <SortTh label="Sample" sortKey="sample" sort={sort} onSort={onSort} className="hide-md" />

              {facet === "twopp" && (<>
                <th scope="col" className="ta-l apub-col hide-md"
                    title="What the pollster published – a conventional 2PP, a 3-cornered preferred, or extra matchups">As published</th>
                <SortTh label="Lead · ALP v L/NP" short="Lead" sortKey="alp" sort={sort} onSort={onSort} />
              </>)}
              {facet === "primary" && (<>
                <SortTh label="ALP" sortKey="p.alp" sort={sort} onSort={onSort} />
                <SortTh label="L/NP" sortKey="p.lnp" sort={sort} onSort={onSort} />
                <SortTh label="GRN" sortKey="p.grn" sort={sort} onSort={onSort} />
                <SortTh label="ON" sortKey="p.onp" sort={sort} onSort={onSort} />
                <th scope="col" className="hide-md">OTH</th>
              </>)}
              {facet === "leadership" && (<>
                <SortTh label="Preferred PM" sortKey="ppm.alb" sort={sort} onSort={onSort} className="ta-l two-pp-col hide-md" />
                <SortTh label="Alb net" short="Alb" sortKey="appr.albNet" sort={sort} onSort={onSort} />
                {/* the office, not the name – the column outlives any one
                    opposition leader (matches the archive) */}
                <SortTh label="Opp. ldr net" short="Opp" sortKey="appr.taylorNet" sort={sort} onSort={onSort} />
                <SortTh label="Hanson net" short="Han" sortKey="appr.hansonNet" sort={sort} onSort={onSort} />
              </>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const isOpen = open === r.pollster;
              return (
                <React.Fragment key={r.pollster}>
                  <tr className={"poll-row" + (isOpen ? " open" : "")}
                      onClick={() => setOpen(isOpen ? null : r.pollster)}>
                    <td className="exp-col">
                      <button className={"exp-btn" + (isOpen ? " open" : "")}
                              aria-label={isOpen ? "Collapse" : "Expand full breakdown"}
                              aria-expanded={isOpen}>▸</button>
                    </td>
                    <td className="ta-l pollster-cell">
                      <PollsterName name={r.pollster} url={r.url} />
                      <span className="pollster-mode">{r.client}</span>
                    </td>
                    {/* The date the poll was PUBLISHED where the source says so.
                        Where it doesn't, this falls back to the last day of
                        fieldwork and marks itself as a fallback rather than
                        quietly presenting one date as the other. */}
                    <td className="ta-l">
                      <span className={"released-pill" + (r.publishedLabel ? "" : " est")}
                            title={r.publishedLabel
                              ? undefined
                              : "Publication date not recorded for this poll – showing the last day of fieldwork"}>
                        {r.publishedLabel || r.releasedLabel}
                      </span>
                    </td>
                    <td className="ta-l muted">{r.field}</td>
                    <td className="num muted hide-md">{r.sample != null ? r.sample.toLocaleString() : "—"}</td>

                    {facet === "twopp" && (<>
                      <td className="ta-l apub-col hide-md"><ArchPublished p={r} /></td>
                      <td className="num"><ArchLead p={r} measure="lnp" /></td>
                    </>)}
                    {facet === "primary" && (<>
                      <td className="num" style={{ color: "var(--alp-text)", fontWeight: 600 }}>{r.p.alp != null ? r.p.alp.toFixed(1) : "—"}</td>
                      <td className="num" style={{ color: "var(--lnp-text)", fontWeight: 600 }}>{r.p.lnp != null ? r.p.lnp.toFixed(1) : "—"}</td>
                      <td className="num" style={{ color: "var(--grn-text)" }}>{r.p.grn != null ? r.p.grn.toFixed(1) : "—"}</td>
                      <td className="num" style={{ color: "var(--onp-text)" }}>{r.p.onp != null ? r.p.onp.toFixed(1) : "—"}</td>
                      <td className="num muted hide-md">{r.p.oth != null ? r.p.oth.toFixed(1) : "—"}</td>
                    </>)}
                    {facet === "leadership" && (<>
                      <td className="two-pp-col share-col hide-md">
                        {ppmContests(r).length === 0
                          ? <span className="dash" title="No preferred-PM question this wave">—</span>
                          : <ShareBar segs={ppmContestSegs(ppmContests(r)[0])} compact flag={ppmFlag(ppmContests(r))} />}
                      </td>
                      <td className="num"><ArchApprCell s={r.appr.alb} net={r.appr.albNet} metric={r.appr.metricBy && r.appr.metricBy.alb} /></td>
                      <td className="num"><ArchApprCell s={r.appr.taylor} net={r.appr.taylorNet} metric={r.appr.metricBy && r.appr.metricBy.taylor} /></td>
                      <td className="num"><ArchApprCell s={r.appr.hanson} net={r.appr.hansonNet} metric={r.appr.metricBy && r.appr.metricBy.hanson} /></td>
                    </>)}
                  </tr>
                  {isOpen && (
                    <tr className="detail-row">
                      {/* 5 base cols + facet cols */}
                      <td colSpan={facet === "primary" ? 10 : facet === "leadership" ? 9 : 7}><PollDetail r={r} /></td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="table-hint">
        Tap any poll to see its full breakdown · click a column heading to sort · “—” means the pollster didn’t ask that question.
        {" "}<strong>Published</strong> is the date the poll was released, taken from the source each row links
        to – not the last day of its fieldwork, which is the next column. A dashed date is a fallback: that
        poll’s publication date isn’t recorded, so the column shows its fieldwork end instead.
        {" "}Each house’s systematic lean (its house effect) now sits beside poll lean in the All polls archive.
      </p>
    </section>
  );
}

Object.assign(window, { UndecidedLine, Segmented, TextToggle, Delta, SortTh, fitDomain, PrimaryVotePanel, PreferredPMPanel, ApprovalPanel, DirectionPanel, UndecidedPanel, PollsterTable, NextPollsPanel,
  // shared facet/render helpers reused by the All-polls archive table
  ShareBar, NetVal, FavMark, ChgTag, ApprBlock, apprHeading, SeatProjection, tppContests, tppFlag, tppHeading, primarySegs, dirSegs, ppmContests, ppmMatch, ppmContestSegs, ppmLabel, ppmKind, ppmFlag, LEADER_META, PPM_ORDER, PARTY_C,
  // the archive prints publication stamps too, and there is only one way to
  // write one
  pubStamp });
