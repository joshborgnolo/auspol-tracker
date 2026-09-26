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

function TextToggle({ options, value, onChange, caps, ariaLabel, className }) {
  const rg = useRadioGroup(options, value, onChange);
  return (
    <div className={"text-toggle" + (caps ? " tt-caps" : "") + (className ? " " + className : "")} role="radiogroup"
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
/* A leader readout's figure: the current reading gen-data builds the way it
   builds the headline (leaderNow – recency-weighted, house-adjusted where the
   measure allows) wherever its window holds a poll; else the latest monthly
   reading, with its month tag. */
function leaderReading(rows, key) {
  const N = window.AP.D.leaderNow && window.AP.D.leaderNow[key];
  if (N) return { v: N.v, ym: null, prev: N.prev, prevYm: null, now: N };
  return lastReadings(rows, key);
}
// the change on a current reading, spelled out as the hero's is
function nowDeltaTitle(now) {
  if (!now || now.chg == null) return undefined;
  return "Change on a month ago – the same estimate, built the same way, 30 days earlier"
       + (now.changeSig === false ? " (within the margin)" : "");
}
// what a snapshot-panel delta is measured against, spelled out – these compare
// monthly AGGREGATE readings, unlike the archive's ChgTag which compares a
// single pollster with its own previous poll
function readoutDeltaTitle(r) {
  if (r && r.now) return nowDeltaTitle(r.now);
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
/* The one fold for a chart's reading notes: the gist stays in view above it,
   and the method, caveats and edge cases wait behind "How to read this chart"
   (as Past cycles' intro and the vote-by-group notes do). Children are the
   folded paragraphs; `cls` is the note class they're set in. */
function HowTo({ label = "How to read this chart", cls = "table-hint", paras }) {
  return (
    <details className="view-how hint-how">
      <summary>{label}</summary>
      {paras.filter(Boolean).map((p, i) => <p key={i} className={cls}>{p}</p>)}
    </details>
  );
}

/* A panel's story, under its heading and a hairline: a serif headline that
   says what the figures are doing, and one plain sentence that says it with
   the number. Both are composed from the live readings by the panel that
   renders them, so they turn over with the data; either may be absent, and
   a panel with nothing to say shows no rule either. */
function Story({ head, dek }) {
  if (!head && !dek) return null;
  return (
    <div className="story">
      {head && <h3 className="story-head">{head}</h3>}
      {dek && <p className="story-dek">{dek}</p>}
    </div>
  );
}

function Delta({ value, suffix = "", goodUp = true, neutral, small, title, roll, spinIn }) {
  if (value == null) return null;
  const up = value > 0, flat = Math.abs(value) < 0.05;
  // neutral: a move that is news but neither good nor bad (where One Nation's
  // voters came from) keeps its arrow and figure in the flat grey
  const cls = flat || neutral ? "flat" : (up === goodUp ? "up" : "down");
  const arrow = flat ? "→" : up ? "▲" : "▼";
  const figure = `${up ? "+" : ""}${value.toFixed(1)}`;
  const Roll = window.RollNum;
  return (
    <span className={"delta " + cls + (small ? " delta-sm" : "")} title={flat && roll ? "No change" + (title ? " · " + title : "") : title}>
      <span className="delta-arrow">{arrow}</span>
      {/* in a readout row a flat move prints as a figure like its
          neighbours: "no change" was twice their width and, on a phone, broke
          the preferred-PM row onto two lines while the row beneath held one */}
      {flat ? (roll ? "0.0" : "no change")
        : roll && Roll ? <><Roll value={figure} spinIn={spinIn} />{suffix}</>
        : figure + suffix}
    </span>
  );
}

// ---- Primary vote ---------------------------------------------------
function PrimaryVotePanel({ rangeId }) {
  const { D, rangeDomain, filterPts, buildXTicks, series } = window.AP;
  const [xDomain] = [rangeDomain(rangeId)];
  const [hidden, setHidden] = useState({});
  const narrow = useNarrow();
  const latest = D.latest.primary;
  /* The 2025 result, which is where every line on this chart starts: the month
     spine opens at the election and gen-data flags that row `election: true`,
     so the AEC primaries are already here and no figure has to be restated.
     A chip reading "Labor 27.5%" was a level with nothing to be a level
     AGAINST - and on this chart the level is the least of it, because the
     story since May 2025 is One Nation going 6.4 to 27.0 and the Coalition
     31.8 to 21.5. The swing is the number that says so. */
  const base = D.aggPrimary.find((d) => d.election) || null;
  // labels & series ordered by descending latest primary-vote share
  // (the quoted 21-day nowcast, so chip order matches the figures shown)
  const parts = [
    { id: "alp", ...D.PARTIES.alp },
    { id: "lnp", ...D.PARTIES.lnp },
    { id: "grn", ...D.PARTIES.grn },
    { id: "onp", ...D.PARTIES.onp },
    { id: "oth", ...D.PARTIES.oth },
  ].sort((a, b) => latest[b.id] - latest[a.id]);
  const pts = filterPts(D.aggPrimary, xDomain[0]);
  /* The one-sentence lead, as on the direction and undecided panels: the top
     of the primary vote says what kind of contest this is, and the
     Coalition's distance from it is the other half of the story since May
     2025. Composed from the live aggregate so the sentence turns over with
     the numbers. */
  const pvLead = (() => {
    const a = parts[0], b = parts[1];
    const lnp = parts.find((p) => p.id === "lnp");
    if (!a || !b || !lnp) return null;
    const gap = latest[a.id] - latest[b.id];
    let s = gap < 2
      ? a.name + " (" + latest[a.id].toFixed(1) + "%) and " + b.name + " (" + latest[b.id].toFixed(1)
        + "%) are within " + (gap < 1 ? "a point" : "two points") + " of each other on first preferences"
      : a.name + " leads first-preference support on " + latest[a.id].toFixed(1) + "%, "
        + gap.toFixed(1) + " points clear of " + b.name;
    const lnpBehind = latest[b.id] - latest.lnp;
    if (lnp.id !== a.id && lnp.id !== b.id && lnpBehind > 2)
      s += ", while the " + lnp.name + " has been left behind on " + latest.lnp.toFixed(1) + "%";
    return s + ".";
  })();
  const pvHead = parts[1] && (latest[parts[0].id] - latest[parts[1].id] < 2
    ? parts[0].name + " and " + parts[1].name + " neck and neck"
    : parts[0].name + " leads the primary vote");
  // every party stays mounted; hiding a chip fades its line via opacity so
  // legend toggles feel continuous instead of popping
  const chartSeries = parts.map((p) => ({
    id: p.id, label: p.name, color: p.color, points: series(pts, p.id),
    width: p.id === "oth" ? 2 : 3,
    dashed: p.id === "oth",
    opacity: hidden[p.id] ? 0 : 1,
    /* named at the line's end: Labor, One Nation and the Coalition finish
       within a few points of each other, and red/orange alone does not
       separate them for a colour-blind reader */
    endLabel: p.short,
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
        </div>
        <div className="legend">
          {parts.map((p) => {
            const was = base && base[p.id] != null ? base[p.id] : null;
            return (
              <button key={p.id} type="button"
                      className={"legend-chip" + (hidden[p.id] ? " off" : "") + (p.id === "oth" ? " residual" : "")}
                      aria-pressed={!hidden[p.id]}
                      /* The election figure itself is one hover away rather than
                         a third number in the chip: five chips already fill the
                         card head, and "27.5% now, 34.6% then" is the sentence
                         the arrow is a shorthand for. */
                      title={was == null ? p.name + " – " + latest[p.id].toFixed(1) + "% now"
                             : p.name + " – " + latest[p.id].toFixed(1) + "% now, "
                               + was.toFixed(1) + "% at the 2025 election"}
                      onClick={() => setHidden((h) => ({ ...h, [p.id]: !h[p.id] }))}>
                <span className="legend-swatch" style={{ background: p.color }}></span>
                <span className="legend-name">{p.name}</span>
                <span className="legend-val">{latest[p.id].toFixed(1)}%</span>
                {/* Movement is non-partisan here, as everywhere else on the page:
                    the arrow and the sign carry the direction, not a party
                    colour, so a falling Labor share is not drawn in Labor red. */}
                {was != null && <Delta value={latest[p.id] - was} small />}
              </button>
            );
          })}
        </div>
      </div>
      <Story head={pvLead && pvHead} dek={pvLead} />
      <TrendChart
        key="pv"
        height={narrow ? 460 : 340} xDomain={xDomain} yDomain={[0, 40]}
        yTicks={[10, 20, 30, 40]} unit="%" axisFont={narrow ? 28 : 20}
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
      <HowTo paras={[
        <>Each dot is one published poll’s first-preference figure; the lines are
        monthly averages. Each chip’s ▲ ▼ is its{" "}
        <button type="button" className="hi-term"
                onClick={() => window.AP.openTerm && window.AP.openTerm("changes", "Primary vote")}>change
          since the 2025 election</button>. Use the chips to isolate one party.</>,
        <>The lines are weighted by sample and adjusted for each house’s lean.</>,
        <>The 2025 election is where every line here begins. A party on its own draws with the
        95% interval around its line{solo ? ", shaded here" : ""}.</>,
      ]} />
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
  /* The section's one-sentence lead, in the same voice as the direction and
     undecided panels: the two-way preferred-PM gap against the net ratings,
     composed from the live readings so the sentence turns over with the
     numbers. Returns null rather than guess if a reading is missing. */
  let ldHead = null;
  const ldLead = (() => {
    const byId = {};
    leaders.forEach((L) => { byId[L.id] = L; });
    const pm = byId.alb, op = byId.taylor, hn = byId.hanson;
    if (!pm || !op || !hn) return null;
    const pmP = leaderReading(D.leaderMonths, "alb_pref");
    const opP = leaderReading(D.leaderMonths, "taylor_pref");
    const nets = [pm, op, hn].map((L) => ({ L, r: leaderReading(D.leaderMonths, L.id + "_net") }));
    if (!pmP || !opP || nets.some((n) => !n.r)) return null;
    const r0 = Math.round;
    const ahead = pmP.v - opP.v >= 0;
    const ppmPart = (ahead ? pm.short : op.short) + " leads " + (ahead ? op.short : pm.short)
      + " " + r0(Math.max(pmP.v, opP.v)) + "–" + r0(Math.min(pmP.v, opP.v))
      + " as preferred prime minister";
    const neg = nets.filter((n) => n.r.v < 0);
    const pref = (ahead ? pm.short : op.short) + " preferred as PM";
    ldHead = neg.length === nets.length ? pref + ", but all three leaders net-negative"
      : !neg.length ? pref + ", and all three leaders net-positive" : pref;
    if (neg.length === nets.length) {
      const worst = neg.reduce((a, b) => (a.r.v < b.r.v ? a : b));
      return ppmPart + ", yet all three leaders are rated net-negative – "
        + (worst.L.id === "alb" ? "the PM" : worst.L.short) + " most deeply, on " + r0(worst.r.v) + ".";
    }
    if (!neg.length) return ppmPart + ", and all three carry net-positive ratings.";
    return ppmPart + ", and on approval only "
      + nets.filter((n) => n.r.v >= 0).map((n) => n.L.short).join(" and ")
      + " rate" + (nets.length - neg.length === 1 ? "s" : "") + " net-positive.";
  })();
  return (
    <section className="leadership">
      <div className="leadership-head">
        <h2 className="section-h">Leadership</h2>
      </div>
      <Story head={ldLead && ldHead} dek={ldLead} />
      <HowTo label="How to read these charts" cls="leadership-note" paras={[
        <>The Coalition line splices leaders – <strong>Ley</strong> to February 2026, <strong>Taylor</strong> since.</>,
        <>The approval and favourability points are monthly aggregates, weighted and house-adjusted
        the way the vote series are; the preferred-PM lines join published readings as they came,
        unadjusted.</>,
        <>Preferred PM is put to voters as two separate two-way contests – against the opposition
        leader, and against Hanson head to head – so both are drawn, as published. In the two-way
        houses leave anywhere from nothing (Newspoll) to half the sample uncommitted, and the
        three-way 16–50%, so a level isn’t comparable across houses – but the gap between the two
        lines, and the trend in each, are.</>,
      ]} />
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
  const narrow = useNarrow();
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
  rows.forEach((r) => { r.read = leaderReading(D.leaderMonths, r.L.id + r.suf); });
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
          // the opposition slot is an office: Ley's polls and Taylor's belong
          // to the same colour, which the trend draws as each leader's run.
          // Which key held the reading is which person the dot names.
          const fromLey = L.id === "taylor" && c.taylor == null;
          const raw = L.id === "taylor" ? (fromLey ? c.ley : c.taylor) : c[L.id];
          if (raw == null) return null;
          const lab = pr && pr.id === "ah" && L.id === "alb" ? "Albanese v Hanson" : (fromLey ? "Ley" : L.short);
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
      // the band spans the office, not the person: Ley's months count too
      const hi = d[a + pr.suf], lo = d[b + pr.suf] != null ? d[b + pr.suf] : (b === "taylor" ? d["ley" + pr.suf] : null);
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
     and interpolated while the switch is running. The opposition office is
     one colour but two people: Ley's readings live in ley_* and Taylor's in
     taylor_*, so the office draws as two runs spliced at the February 2026
     handover (its readings straddle the month, which is why both runs have a
     point there). `era` is null for every line that is one person
     throughout. */
  const erasOf = (r) => (r.L.id === "taylor" ? ["ley", "taylor"] : [null]);
  const lineFor = (r, era) => {
    const k = (era || r.L.id) + r.suf;
    return pts.filter((d) => d[k] != null).map((d) => ({ ym: d.ym, x: d.x, v: d[k] }));
  };
  const fromRows = morph ? rowsFor(morph.from) : null;
  const toRows = morph ? rowsFor(morph.to) : null;
  const byMk = (list) => { const m = {}; (list || []).forEach((r) => (m[r.mk] = r)); return m; };
  const fromBy = byMk(fromRows), toBy = byMk(toRows);
  // a run is one line's piece of one era – matched across the switch by
  // mk|era so Ley's piece never blends into Taylor's ("|" appears in no mk)
  const runKeys = (list) => (list || []).flatMap((r) => erasOf(r).map((era) => r.mk + "|" + (era || "")));
  /* Every line either side of the switch, once. A line present on both sides
     travels; one present on only one side holds its own shape and fades. */
  const drawRows = !morph
    ? rows.flatMap((r) => erasOf(r).map((era) => ({ r, era, pts: lineFor(r, era), opacity: 1 }))).filter((d) => d.pts.length)
    : [...new Set([...runKeys(fromRows), ...runKeys(toRows)])].map((k) => {
        const [mk, eraS] = k.split("|"), era = eraS || null;
        const a = fromBy[mk], b = toBy[mk];
        if (a && b) {
          const bl = window.AP.blendRows(lineFor(a, era), lineFor(b, era), morph.t, ["v"]);
          // dash says WHICH contest, so it changes with the line's allegiance
          const r = morph.t < 0.5 ? a : b;
          return { r, era, pts: bl ? bl.rows : lineFor(r, era), opacity: 1, clip: bl ? bl.clip : null };
        }
        /* A line with nowhere to travel to is ERASED rather than dimmed: rubbed
           out from the left as the switch runs, and drawn back in the same way
           when the switch is reversed. Fading the whole line at once read as it
           blinking out of existence — the head-to-head Albanese is the one this
           happens to, and a dashed line vanishing wholesale looks like a
           rendering fault rather than a departure. */
        const only = a || b;
        return { r: only, era, pts: lineFor(only, era), wipe: a ? morph.t : 1 - morph.t };
      }).filter((d) => d.pts.length);


  // y-window fitted to the readings in view, scatter included – and taken
  // across both questions while morphing, so the axis holds still under lines
  // that are still moving
  const valsFor = (f) => rowsFor(f)
    .flatMap((r) => D.leaderMonths.flatMap((m) =>
      [m[r.L.id + r.suf], r.L.id === "taylor" ? m["ley" + r.suf] : null]).filter((v) => v != null))
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
            {rd ? (Roll ? <Roll value={rd.v.toFixed(1)} /> : rd.v.toFixed(1)) : "—"}
            {rd && <span className="pct">%</span>}
          </div>
        </div>
        {rd && rd.prev != null && <Delta value={rd.v - rd.prev} suffix="" small roll title={readoutDeltaTitle(rd)} />}
      </div>
    );
  });

  /* The lead: the gap between the two tiles' current readings where both
     have one, else the last month BOTH names were asked in that contest –
     which is not always the latest month, since the head-to-head is asked by
     fewer houses. Stating it is the point of showing two contests at once. */
  const leadOf = (pr) => {
    const gap = (a, b) => {
      const d = +Math.abs(a - b).toFixed(1);
      const who = byId[a > b ? pr.ids[0] : pr.ids[1]];
      return { m: d.toFixed(1), name: who.short, color: inkOf(who.color), level: d === 0 };
    };
    // the two tiles' own figures where both are current readings, so the
    // lead is the gap the reader can see
    const [ra, rb] = pr.ids.map((id) => leaderReading(D.leaderMonths, id + pr.suf));
    if (ra && rb && ra.now && rb.now) return gap(ra.v, rb.v);
    for (let i = D.leaderMonths.length - 1; i >= 0; i--) {
      const m = D.leaderMonths[i], a = m[pr.ids[0] + pr.suf], b = m[pr.ids[1] + pr.suf];
      if (a == null || b == null) continue;
      return gap(a, b);
    }
    return null;
  };

  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h3 className="card-title">Preferred prime minister</h3>
          <p className="card-sub">
            {three ? "“Who would make the better PM?”, asked as a three-way including Hanson"
                   : "“Who would make the better PM?”, asked head to head – in both of the contests pollsters run"}
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
        height={narrow ? 460 : 340} xDomain={xDomain} yDomain={domain}
        yTicks={ticks} unit="%" axisFont={narrow ? 28 : 20}
        pad={{ l: 58, r: 22, t: 22, b: 42 }}
        xTicks={buildXTicks(xDomain[0], xDomain[1])}
        events={[OPP_HANDOVER].filter(Boolean)}
        areas={areas}
        series={drawRows.map((d) => ({
          /* An era's run is its own series: Ley's ends at the handover (no
             end-cap – nothing continues from it) and answers to her name in
             the tooltip, so the month both runs carry (Feb 2026) lists both
             readings rather than one office row hiding the other leader's. */
          id: d.era ? d.r.mk + "-" + d.era : d.r.mk,
          label: d.era === "ley" ? "Ley" : d.r.label, color: d.r.L.color, dashed: d.r.dashed,
          endCap: d.era === "ley" ? false : undefined,
          /* named at the end, once per leader: the dashed Albanese (his
             head-to-head with Hanson) would only repeat the solid one's name */
          endLabel: d.era === "ley" || (d.r.dashed && drawRows.some((o) => o !== d && !o.r.dashed && o.r.L.short === d.r.L.short))
            ? undefined : (d.r.L.short || d.r.L.name || d.r.label),
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
        fmt={(v) => v.toFixed(1)}
      />
    </section>
  );
}

// ---- Leader approval ------------------------------------------------
function ApprovalPanel({ rangeId, leaders, chrome, metric: metricProp, lockMetric, onBoth }) {
  const { D, rangeDomain, filterPts, buildXTicks } = window.AP;
  const narrow = useNarrow();
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
  leaders.forEach((L) => { reads[L.id] = leaderReading(D.leaderMonths, L.id + suf); });
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
        // the opposition slot names its holder: Ley's dots say Ley
        const lab = L.id === "taylor" ? (a.oppName || L.short) : L.short;
        return out.map((y) => ({ x: p.x, y, color: L.color, label: lab, meta: p, leader: L.id }));
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
  /* As on the preferred-PM chart, the opposition office is two people's
     runs: Ley's readings are ley_* and Taylor's are taylor_*, spliced at the
     February 2026 handover. `era` is null for everyone else. */
  const erasOf = (L) => (L.id === "taylor" ? ["ley", "taylor"] : [null]);
  const lineFor = (L, mt, era) => {
    const k = (era || L.id) + "_" + mt;
    return pts.filter((d) => d[k] != null)
      .map((d) => ({ ym: d.ym, x: d.x, v: d[k], ci: d[k + "Ci"] != null ? d[k + "Ci"] : null }));
  };
  const drawRuns = (L) => erasOf(L).map((era) => {
    if (!morph) return { era, rows: lineFor(L, metric, era), clip: null };
    const b = window.AP.blendRows(lineFor(L, morph.from, era), lineFor(L, morph.to, era), morph.t, ["v", "ci"]);
    return b ? { era, rows: b.rows, clip: b.clip } : { era, rows: lineFor(L, metric, era), clip: null };
  }).filter((d) => d.rows.length);
  const drawn = {};
  leaders.forEach((L) => { drawn[L.id] = drawRuns(L); });

  const apprAreas = leaders
    .flatMap((L) => drawn[L.id].map((d) => ({ id: "ci-" + L.id + (d.era ? "-" + d.era : ""),
                   color: L.color, className: "ci-band", edge: false, smooth: true,
                   // the interval travels with the line it belongs to
                   clipX: d.clip,
                   points: d.rows.filter((r) => r.ci != null)
                     .map((r) => ({ x: r.x, y0: r.v - r.ci, y1: r.v + r.ci })) })))
    .filter((a) => a.points.length >= 2);

  /* The y window travels too. Taken across BOTH metrics while morphing, so
     the axis isn't re-fitted under a line that is still moving. */
  const valsFor = (mt) => leaders
    .flatMap((L) => D.leaderMonths.flatMap((r) =>
      [r[L.id + "_" + mt], L.id === "taylor" ? r["ley_" + mt] : null]).filter((v) => v != null))
    .concat(cloudFor(mt).map((d) => d.y))
    .concat(leaders.flatMap((L) => erasOf(L).flatMap((era) => lineFor(L, mt, era)).filter((d) => d.ci != null)
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
              ? (<><button type="button" className="hi-term"
                     title="What the approval question asks"
                     onClick={() => window.AP.openTerm &&
                       window.AP.openTerm("approval", "Leader net approval")}>Approve minus disapprove</button>
                   <Houses after=" – a verdict on the job they’re doing">Newspoll, YouGov, Resolve, Essential, and others</Houses></>)
              : (<><button type="button" className="hi-term"
                     title="What the favourability question asks"
                     onClick={() => window.AP.openTerm &&
                       window.AP.openTerm("favourability", "Leader net favourability")}>Positive minus negative</button>
                   <Houses after=" – the person, not the job">{houseList(D.favHouses)} ask favourability, not approval</Houses></>)}
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
                      {Roll ? <Roll value={(net > 0 ? "+" : "") + net.toFixed(1)} />
                            : <>{net > 0 ? "+" : ""}{net.toFixed(1)}</>}
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
        height={narrow ? 460 : 340} xDomain={xDomain} yDomain={domain}
        yTicks={ticks} unit="" axisFont={narrow ? 28 : 20}
        pad={{ l: 58, r: 22, t: 22, b: 42 }}
        xTicks={buildXTicks(xDomain[0], xDomain[1])}
        refLines={[{ y: 0, label: "even", color: "var(--ink-faint)" }]}
        events={leaders.some((L) => L.id === "taylor") ? [OPP_HANDOVER].filter(Boolean) : []}
        series={ordered.flatMap((L) => drawn[L.id].map((d) => (
          { /* Ley's run ends at the handover (no end-cap) and answers to her
               name, so the month both runs carry (Feb 2026) lists both. */
            id: d.era ? L.id + "-" + d.era : L.id,
            label: (d.era === "ley" ? "Ley" : L.short) + " net", color: L.color,
            endCap: d.era === "ley" ? false : undefined,
            endLabel: d.era === "ley" ? undefined : L.short,
            /* Hanson has nine months of favourability against five of
               approval, so her line has to shorten while the other two barely
               move. Each carries its own window for that reason. */
            clipX: d.clip,
            points: d.rows.map((r) => ({ x: r.x, y: r.v })) }
        )))}
        spine={pts.map((d) => ({ x: d.x }))}
        areas={apprAreas}
        scatter={cross ? cross.scatter : apprScatter} pollFacet="leadership"
        scatterOut={cross ? cross.scatterOut : []}
        scatterMove={cross ? cross.scatterMove : []}
        fade={morph ? morph.t : 1}
        tooltipTitle={(i) => window.AP.monthLabelFull(pts[i].ym)}
        fmt={(v) => (v > 0 ? "+" : "") + v.toFixed(1)}
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

/* A subtitle's pollster list, set as a sentence of its own in italics after
   the description it credits: the description takes a full stop, unless it
   already ends one (a quoted question), and so does the list. */
const endsSentence = (t) => /[.?!][’”'"]?$/.test(t);
function Houses({ after, children }) {
  return <>{after}{after == null ? "" : endsSentence(after) ? " " : ". "}<em className="card-houses">{children}.</em></>;
}

function houseList(names, max = 4) {
  if (!names || !names.length) return "";
  if (names.length > max) return names.slice(0, max).join(", ") + ", and others";
  if (names.length === 1) return names[0];
  return names.slice(0, -1).join(", ") + (names.length > 2 ? ", and " : " and ") + names[names.length - 1];
}

/* A share as the nearest plain fraction a reader would say aloud: 62.5 →
   "More than three in five", 58.9 → "Almost three in five", 66.4 → "Almost
   two in three". Within half a point of the fraction it's "About". */
const PLAIN_FRACTIONS = [[1, 5], [1, 4], [1, 3], [2, 5], [1, 2], [3, 5], [2, 3], [7, 10], [3, 4], [4, 5], [9, 10]];
const NUM_WORDS = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
function plainShare(v) {
  const [a, b] = PLAIN_FRACTIONS.reduce((best, f) =>
    (Math.abs(v - 100 * f[0] / f[1]) < Math.abs(v - 100 * best[0] / best[1]) ? f : best));
  const d = v - 100 * a / b;
  const lead = Math.abs(d) < 0.5 ? "About" : d < 0 ? "Almost" : "More than";
  return lead + " " + (a === 1 && b === 2 ? "half of" : NUM_WORDS[a] + " in " + NUM_WORDS[b]);
}
/* A ratio as a reader would say it, to the nearest half: 2.52 → "about two
   and a half times", 2.1 → "about twice". No finer: a ratio of two pooled
   figures is rarely known closer than that (the Coalition-to-Labor ratio
   under the One Nation panel carried a 95% range of about 2.1 to 3.1 when
   it read 2.5). */
function timesWords(r) {
  const h = Math.round(r * 2) / 2;
  if (h >= 11) return "about " + Math.round(r) + " times";
  if (h === 2) return "about twice";
  return "about " + NUM_WORDS[Math.floor(h)] + (h % 1 ? " and a half" : "") + " times";
}

// ---- National direction (right track / wrong track) -----------------
function DirectionPanel({ rangeId }) {
  const { D, rangeDomain, filterPts, buildXTicks, series } = window.AP;
  const narrow = useNarrow();
  const asked = houseList(D.directionHousesAll || D.directionHouses);
  const question = "‘Is the country heading in the right direction, or on the wrong track?’";
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
  /* The readout is the current reading (gen-data directionNow – built as the
     headline is); the chart keeps its monthly means. */
  const now = D.directionNow;
  const latest = now || D.direction[D.direction.length - 1];
  const prev = D.direction[D.direction.length - 2];
  const netDelta = now ? (now.chg ?? null) : prev ? latest.net - prev.net : null;

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

  /* The story: which answer leads, and whether its lead moved on a month
     ago. "Widened" or "narrowed" only when the change clears its own margin
     (changeSig); inside it the lead "holds", whatever the arrow shows. Within
     two points either way there is no lead to speak of. */
  const wrongLeads = latest.wrong >= latest.right;
  const side = wrongLeads ? "Wrong track" : "Right direction";
  const moved = netDelta == null || (now && now.changeSig === false) || Math.abs(netDelta) < 0.5 ? 0
    : wrongLeads ? -netDelta : netDelta;
  const head = Math.abs(latest.net) < 2 ? "The country is split on its direction"
    : moved > 0 ? side + " has widened its lead"
    : moved < 0 ? side + "’s lead has narrowed"
    : side + " holds its lead";
  const big = wrongLeads ? latest.wrong : latest.right;
  const dek = plainShare(big) + " Australians (" + big + "%) now say the country is heading in the "
    + (wrongLeads ? "wrong" : "right") + " direction.";
  const signed = (v) => (v > 0 ? "+" : v < 0 ? "\u2212" : "") + Math.abs(v);

  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2 className="card-title">National direction</h2>
          <p className="card-sub">{asked ? <Houses after={question}>{asked}</Houses> : question}</p>
        </div>
      </div>
      <Story head={head} dek={dek} />

      {/* the two answers as figures over the bar that splits them; the gap in
          the bar is the unsure, left unlabelled as the figures leave it */}
      <div className="dir-figs">
        <div className="dir-fig">
          <span className="dir-v" style={{ color: "var(--mood-pos)" }}>{latest.right}<span className="pct">%</span></span>
          <span className="dir-k" style={{ color: "var(--mood-pos)" }}>Right direction</span>
        </div>
        <div className="dir-fig ta-r">
          <span className="dir-v" style={{ color: "var(--mood-neg)" }}>{latest.wrong}<span className="pct">%</span></span>
          <span className="dir-k" style={{ color: "var(--mood-neg)" }}>Wrong track</span>
        </div>
      </div>
      <div className="dir-bar" title={`Right direction ${latest.right}% · Unsure ${latest.unsure}% · Wrong track ${latest.wrong}%`}>
        <span className="dir-pos" style={{ width: latest.right + "%" }}></span>
        <span className="dir-uns" style={{ width: latest.unsure + "%" }}></span>
        <span className="dir-neg" style={{ width: latest.wrong + "%" }}></span>
      </div>
      <div className="dir-net">
        <span className="dir-net-label">Net</span>
        <span className={"dir-net-val " + (latest.net >= 0 ? "pos" : "neg")}>
          {signed(latest.net)}<span className="dir-net-u">pp</span>
        </span>
        {netDelta != null && <>
          <span className="dir-net-sep" aria-hidden="true"></span>
          <Delta value={netDelta} suffix=" pp" small title={now ? nowDeltaTitle(now) : "Change on the previous month"} />
        </>}
      </div>

      <TrendChart
        key="dir"
        height={narrow ? 460 : 340} xDomain={xDomain} yDomain={[lo, hi]}
        yTicks={yTicks} unit="%" axisFont={narrow ? 28 : 20}
        pad={{ l: 58, r: 22, t: 16, b: 42 }}
        xTicks={buildXTicks(xDomain[0], xDomain[1])}
        series={[
          { id: "right", label: "Right direction", color: "var(--mood-pos)", points: series(pts, "right"), endLabel: "Right" },
          { id: "wrong", label: "Wrong track", color: "var(--mood-neg)", points: series(pts, "wrong"), endLabel: "Wrong" },
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
      <HowTo paras={[
        <>Each dot is one published reading; the lines are monthly averages, shaded with their
        95% intervals.</>,
        <>The lines are adjusted for house effects. Only {asked ? D.directionHouses.length : 0} houses
        ask this question, so some months rest on a single poll – the dots show which, and the
        shading shows what that costs in confidence.</>,
      ]} />
    </section>
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
  const narrow = useNarrow();
  const [view, setView] = useState("all");
  const U = D.undecided;
  if (!U || !U.series.length) return null;
  const F = D.firmness, A = U.softAge;
  const views = UND_VIEWS.filter((v) => v.id === "all" || (v.id === "party" && F) || (v.id === "age" && A));
  const ctl = views.length > 1 && (
    <div className="ons-ctl">
      <Segmented options={views} value={view} onChange={setView} size="sm" ariaLabel="Undecided among" />
    </div>
  );
  const extra = view === "party" && F ? {
    sub: <Houses after="Share of each party’s voters certain of their vote">{houseList(F.houses.map(demoHouse))}</Houses>,
    body: <FirmnessView F={F} rangeId={rangeId} />,
  } : view === "age" && A ? {
    sub: <Houses after="Share of each age group not firm in its vote">{houseList(A.houses)}</Houses>,
    body: <AgeFirmView A={A} rangeId={rangeId} />,
  } : null;
  if (extra) return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2 className="card-title">Undecided</h2>
          <p className="card-sub">{extra.sub}</p>
        </div>
      </div>
      {ctl}
      {extra.body}
    </section>
  );
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

  /* The step has to follow the span, not sit at a fixed 2 points. These two
     questions live far apart - the "can't say" share around 5%, the soft share
     of the decided around 27% - so a 2-point step ruled fourteen lines across
     a range whose middle third holds no data at all, and the gridlines ended up
     louder than the two lines they were there to serve. Pick the coarsest nice
     step that still leaves enough rows to read a level off, so a narrow span
     keeps fine gridlines and a wide one stops striping the empty middle. */
  const vals = drawn.flatMap((d) => d.pts.map((p) => p.v).concat(d.dots.map((p) => p.y)));
  const rawLo = Math.max(0, Math.min(...vals) - 1.5);
  const rawHi = Math.max(...vals) + 1.5;
  const step = [1, 2, 5, 10, 20].find((s) => (rawHi - rawLo) / s <= 6) ?? 20;
  const lo = Math.max(0, Math.floor(rawLo / step) * step);
  const hi = Math.ceil(rawHi / step) * step;
  const yTicks = [];
  for (let v = lo + step; v < hi; v += step) yTicks.push(v);
  const spine = drawn[0].pts;

  /* one plain sentence above the readings, as on the direction and One Nation
     panels: the live figure of the headline question against the monthly mean
     nearest the 2025 election (the last at or before the election month, or
     the first term reading if the series only started after it). Inside a
     point either way it reads "fairly constant"; beyond it the sentence says
     which way, and by how much. */
  let termHead = null;
  const termLead = (() => {
    const sr = U.series.find((s) => s.id === "first") || U.series[0];
    if (!sr || sr.monthly.length < 2) return null;
    if (!sr.monthly.some((m) => m.ym > "2025-05")) return null;
    const base = sr.monthly.filter((m) => m.ym <= "2025-05").pop() || sr.monthly[0];
    const nowV = sr.now ? sr.now.v : sr.latest.v;
    const d = nowV - base.v;
    termHead = Math.abs(d) < 1 ? "Undecided share steady since the election"
      : d > 0 ? "More voters undecided than at the election"
      : "Fewer voters undecided than at the election";
    if (Math.abs(d) < 1)
      return "The share of undecided and uncommitted has remained fairly constant since the 2025 election.";
    return "The share of undecided and uncommitted voters has " + (d > 0 ? "risen" : "fallen")
      + " since the 2025 election, from " + base.v.toFixed(1) + "% in "
      + window.AP.monthLabelFull(base.ym) + " to " + nowV.toFixed(1) + "% now.";
  })();

  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2 className="card-title">Undecided</h2>
          <p className="card-sub">
            <Houses after="Electors who won’t name a choice, or won’t call theirs firm">{houseList(U.houses)}</Houses>
          </p>
        </div>
      </div>
      {ctl}
      <Story head={termLead && termHead} dek={termLead} />
      {/* One tile per question, because they ARE different questions and the
          panel would otherwise imply a single measure with two sources. */}
      <div className="und-reads">
        {U.series.map((sr) => (
          <div className="und-read" key={sr.id}>
            <span className={"und-swatch" + (sr.dashed ? " dashed" : sr.dash ? " dotted" : "")} aria-hidden="true"></span>
            <div className="und-read-body">
              <div className="und-read-top">
                <span className="und-read-lab">{sr.label}</span>
                {/* the six-week average, as every sparse figure here is
                    built; a question no house has asked for six weeks falls
                    back to its last reading and says so */}
                <span className="und-read-v">{(sr.now ? sr.now.v : sr.latest.v).toFixed(1)}<span className="pct">%</span></span>
                {/* rising undecided is not good news for anyone – neither arrow
                    is coloured as a gain */}
                {sr.now
                  ? sr.now.chg != null && <Delta value={sr.now.chg} goodUp={false} small
                      title={"vs a month ago" + (sr.now.changeSig === false ? " – within the margin" : "")} />
                  : <span className="und-read-stale">last reading, {sr.latest.field}</span>}
              </div>
              <p className="und-read-note"><Houses after={sr.note[0].toUpperCase() + sr.note.slice(1)}>{houseList(sr.houses)}</Houses></p>
            </div>
          </div>
        ))}
      </div>
      <TrendChart
        key="und"
        height={narrow ? 460 : 340} xDomain={xDomain} yDomain={[lo, hi]}
        yTicks={yTicks} unit="%" axisFont={narrow ? 28 : 20}
        // two-digit shares ("20%") at the phone's 28px axis need the room
        pad={{ l: narrow ? 84 : 58, r: 22, t: 16, b: 42 }}
        xTicks={buildXTicks(xDomain[0], xDomain[1])}
        series={drawn.map((d) => ({ id: d.sr.id, label: d.sr.label, color: COL,
                                    dashed: d.sr.dashed, dash: d.sr.dash, points: series(d.pts, "v") }))}
        spine={series(spine, "v")}
        scatter={drawn.flatMap((d) => d.dots)} pollFacet="twopp"
        tooltipTitle={(i) => window.AP.monthLabelFull(spine[i].ym)}
        fmt={(v) => v.toFixed(1)}
      />
      <HowTo paras={[
        <>Each dot is one published reading; the lines are monthly averages, and
        the figure beside each question pools the last six weeks of polls.</>,
        <>Newer and larger polls count for more in the figure beside each question.</>,
        <>The questions are never averaged together – one counts people who can’t name
        a party, the other people who won’t pick a side once preferences are
        applied. Only the first is left out of the shares elsewhere on this
        page, so a rising line means the share is being read off a smaller
        pool of decided voters, not that support has moved.</>,
      ]} />
    </section>
  );
}

/* The Undecided panel's second view: how firm each party's vote is, from
   RedBridge's vote-softness table (gen-data §5c2). "Certain" is RedBridge's
   "solid": named a party at the first ask and certain they will vote that
   way. The readings pool the house's last three waves, the lines every run of
   three; the dots are its waves. Two sentences, each carrying the leads' highlighter only when it
   reports a significant difference: which party's voters are the most
   certain, and (under the chart) which party's share has moved most since
   the term's first waves. A gap is significant when it exceeds the combined
   95% margin, √(a² + b²) of the two ± figures. */
const UND_VIEWS = [{ id: "all", label: "All voters" }, { id: "party", label: "By party" }, { id: "age", label: "By age" }];
const FIRM_ORDER = ["onp", "alp", "lnp", "grn", "oth"];
const firmWho = (k) => (k === "oth" ? "voters for independents and minor parties" : window.AP.D.PARTIES[k].name + " voters");
const firmApart = (a, b) => Math.abs(a.v - b.v) > Math.hypot(a.ci95, b.ci95);
const firmSaid = (cls, t, sig) => <p className={cls}>{sig ? <mark>{t}</mark> : t}</p>;
function FirmnessView({ F, rangeId }) {
  const { D, rangeDomain, buildXTicks } = window.AP;
  const narrow = useNarrow();
  const xDomain = rangeDomain(rangeId);
  const parties = FIRM_ORDER.filter((k) => F.now[k]).sort((a, b) => F.now[b].v - F.now[a].v);
  const cap = (s) => s[0].toUpperCase() + s.slice(1);

  const lead = (() => {
    const [top, next] = parties;
    const t = F.now[top];
    if (parties.slice(1).every((k) => firmApart(t, F.now[k]) && t.v > F.now[k].v))
      return [`${cap(firmWho(top))} are significantly more likely than any other party’s voters to be certain of their vote: ${Math.round(t.v)}%, against ${Math.round(F.now[next].v)}% of ${firmWho(next)}.`, true,
        `${cap(firmWho(top))} the most certain of their vote`];
    return [`${cap(firmWho(top))} are the most likely to be certain of their vote, at ${Math.round(t.v)}%, but not by more than the margin over ${firmWho(next)}.`, false,
      "No party’s voters clearly the most certain"];
  })();

  const shift = (() => {
    const moved = parties.map((k) => ({ k, d: F.now[k].v - F.base[k].v }))
      .filter(({ k }) => firmApart(F.now[k], F.base[k]))
      .sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
    if (!moved.length)
      return ["No party’s share of voters certain of their vote has changed significantly since the months after the 2025 election.", false];
    const { k, d } = moved[0];
    return [`Since the months after the 2025 election, the share of ${firmWho(k)} certain of their vote has ${d < 0 ? "fallen" : "risen"} significantly, from ${Math.round(F.base[k].v)}% to ${Math.round(F.now[k].v)}%.`, true];
  })();

  /* The lines pool each wave with the two before it, weighted as the
     figures above are, so a line moves on what three months say rather than
     on one wave's few hundred respondents; the dots are the waves. */
  const rolled = F.waves.map((w, i) => {
    const ws = F.waves.slice(Math.max(0, i - F.pool + 1), i + 1);
    const r = { x: w.x };
    for (const k of parties) {
      const n = ws.reduce((a, v) => a + v.n[k], 0);
      r[k] = ws.reduce((a, v) => a + v.n[k] * v.solid[k], 0) / n;
    }
    return r;
  });
  const inX = (w) => w.x >= xDomain[0] && w.x <= xDomain[1];
  const waves = F.waves.filter(inX), lines = rolled.filter(inX);
  if (waves.length < 2) return <Story head={lead[2]} dek={lead[0]} />;
  const vals = waves.flatMap((w) => parties.map((k) => w.solid[k]));
  const lo = Math.max(0, Math.floor((Math.min(...vals) - 3) / 10) * 10);
  const hi = Math.min(100, Math.ceil((Math.max(...vals) + 3) / 10) * 10);
  const yTicks = [];
  for (let v = lo + 10; v < hi; v += 10) yTicks.push(v);
  const pts = (k) => lines.map((w) => ({ x: w.x, y: w[k] }));
  const dots = waves.flatMap((w) => parties.map((k) => ({ x: w.x, y: w.solid[k], color: D.PARTIES[k].color,
                                                          label: D.PARTIES[k].name, meta: w })));

  return (
    <>
      {<Story head={lead[2]} dek={lead[0]} />}
      <div className="und-reads">
        {[...parties, "all"].map((k) => {
          const r = F.now[k];
          return (
            <div className="und-read" key={k}>
              <span className="und-swatch" style={{ background: k === "all" ? "var(--ink-3)" : D.PARTIES[k].color }} aria-hidden="true"></span>
              <div className="und-read-body">
                <div className="und-read-top">
                  <span className="und-read-lab">{k === "all" ? "All voters" : D.PARTIES[k].name}</span>
                  <span className="und-read-v">{r.v.toFixed(1)}<span className="pct">%</span></span>
                  <span className="read-ci" title="95% margin">± {r.ci95.toFixed(1)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <TrendChart
        key="firm"
        height={narrow ? 460 : 340} xDomain={xDomain} yDomain={[lo, hi]}
        yTicks={yTicks} unit="%" axisFont={narrow ? 28 : 20}
        pad={{ l: narrow ? 84 : 58, r: 22, t: 16, b: 42 }}
        xTicks={buildXTicks(xDomain[0], xDomain[1])}
        series={parties.map((k) => ({ id: k, label: D.PARTIES[k].name, color: D.PARTIES[k].color,
                                      width: k === "oth" ? 2 : 3, dashed: k === "oth",
                                      points: pts(k), endLabel: D.PARTIES[k].short }))}
        spine={pts(parties[0])}
        scatter={dots} pollFacet="twopp"
        tooltipTitle={(i) => waves[i] && waves[i].dateLabel}
        fmt={(v) => v.toFixed(0)}
        copy={{ sub: `Share of each party’s voters certain of their vote, wave by wave · ${houseList(F.houses.map(demoHouse))}`,
                legend: parties.map((k) => ({ label: `${D.PARTIES[k].name}  ${F.now[k].v.toFixed(1)}%`, color: D.PARTIES[k].color, kind: "line" })) }}
      />
      {firmSaid("demo-verdict", shift[0], shift[1])}
      <HowTo paras={[
        <>Each dot is one RedBridge wave; the lines and the figures above pool three waves at a
        time, the figures its latest three ({F.now.from} to {F.now.to}).</>,
        <>Certain voters are RedBridge’s “solid” voters: they named a party when first asked and are
        certain they will vote that way. The rest are soft – they may change their vote – or very
        soft: they named a party only when pressed, or say they will probably change.</>,
        <>Each wave counts in proportion to how many of a party’s voters it asked, so the figure
        for a small party rests on a few hundred people and carries a wider margin. Two figures
        differ significantly when the gap between them is larger than their two margins combined.</>,
        <>This is a different question from Resolve’s “how firm are you” in the All voters view,
        which is why the shares there are lower.</>,
      ]} />
    </>
  );
}

/* The Undecided panel's third view: how firm each age group's vote is, from
   Resolve's "how firm are you" by age band (gen-data: softAge). The share
   plotted is the not-firm one, the same measure as the All voters view's
   "Not firm" line. Same furniture and tests as the By party view: readings
   pooled over the last three waves, lines pooling every run of three, the
   waves as dots; a lead on how the bands stand now and a sentence under the
   chart on which band has moved since the term's first waves, each
   highlighted only when it reports a significant difference. Bands run
   from the accent to grey, youngest strongest, since they are ordered and
   no party's. */
const AGE_BANDS = [
  { id: "18-34", label: "18–34", who: "voters aged 18–34" },
  { id: "35-54", label: "35–54", who: "those aged 35–54" },
  { id: "55+", label: "55+", who: "those 55 and over" },
];
function AgeFirmView({ A, rangeId }) {
  const { rangeDomain, buildXTicks } = window.AP;
  const narrow = useNarrow();
  const xDomain = rangeDomain(rangeId);
  // accent, then accent half-faded to grey, then the page's grey ink: the
  // party-panel ramp towards --ink left 35–54 and 55+ too close to tell apart
  const col = (i) => ["var(--accent)", "color-mix(in oklch, var(--accent) 45%, var(--ink-3))", "var(--ink-2)"][i];
  const pct = (b) => Math.round(A.now[b.id].v) + "%";
  const cap = (s) => s[0].toUpperCase() + s.slice(1);

  const lead = (() => {
    const [y, m, o] = AGE_BANDS, N = A.now;
    if (N[y.id].v > N[m.id].v && N[m.id].v > N[o.id].v && firmApart(N[y.id], N[m.id]) && firmApart(N[m.id], N[o.id]))
      return [`Firmness rises significantly with age: ${pct(y)} of voters aged 18–34 aren’t firm in their vote, against ${pct(m)} of those aged 35–54 and ${pct(o)} of those 55 and over.`, true,
        "Voters are firmer the older they are"];
    const [f, ...rest] = [...AGE_BANDS].sort((a, b) => N[a.id].v - N[b.id].v);
    if (rest.every((b) => firmApart(N[f.id], N[b.id])))
      return [`${cap(f.who)} are significantly the firmest: ${pct(f)} aren’t firm in their vote, against ${pct(rest[0])} of ${rest[0].who} and ${pct(rest[1])} of ${rest[1].who}.`, true,
        `Voters aged ${f.label} the firmest`];
    return ["Resolve finds no significant difference in how firm voters are between age groups.", false,
      "No age group clearly firmer than the others"];
  })();

  const shift = (() => {
    const moved = AGE_BANDS.map((b) => ({ b, d: A.now[b.id].v - A.base[b.id].v }))
      .filter(({ b }) => firmApart(A.now[b.id], A.base[b.id]))
      .sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
    if (!moved.length)
      return ["No age group’s share not firm in its vote has changed significantly since the months after the 2025 election.", false];
    const { b, d } = moved[0];
    return [`Since the months after the 2025 election, the share of ${b.who} not firm in their vote has ${d > 0 ? "risen" : "fallen"} significantly, from ${Math.round(A.base[b.id].v)}% to ${Math.round(A.now[b.id].v)}%.`, true];
  })();

  // each wave pooled with the two before it, as the readings are
  const rolled = A.waves.map((w, i) => {
    const ws = A.waves.slice(Math.max(0, i - A.pool + 1), i + 1);
    const r = { x: w.x };
    for (const b of AGE_BANDS) {
      const n = ws.reduce((a, v) => a + v.n[b.id], 0);
      r[b.id] = ws.reduce((a, v) => a + v.n[b.id] * v.soft[b.id], 0) / n;
    }
    return r;
  });
  const inX = (w) => w.x >= xDomain[0] && w.x <= xDomain[1];
  const waves = A.waves.filter(inX), lines = rolled.filter(inX);
  if (waves.length < 2) return <Story head={lead[2]} dek={lead[0]} />;
  const vals = waves.flatMap((w) => AGE_BANDS.map((b) => w.soft[b.id]));
  const lo = Math.max(0, Math.floor((Math.min(...vals) - 3) / 10) * 10);
  const hi = Math.min(100, Math.ceil((Math.max(...vals) + 3) / 10) * 10);
  const yTicks = [];
  for (let v = lo + 10; v < hi; v += 10) yTicks.push(v);
  const pts = (b) => lines.map((w) => ({ x: w.x, y: w[b.id] }));
  const dots = waves.flatMap((w) => AGE_BANDS.map((b, i) => ({ x: w.x, y: w.soft[b.id], color: col(i),
                                                               label: b.label, meta: w })));

  return (
    <>
      {<Story head={lead[2]} dek={lead[0]} />}
      <div className="und-reads">
        {AGE_BANDS.map((b, i) => (
          <div className="und-read" key={b.id}>
            <span className="und-swatch" style={{ background: col(i) }} aria-hidden="true"></span>
            <div className="und-read-body">
              <div className="und-read-top">
                <span className="und-read-lab">{b.label}</span>
                <span className="und-read-v">{A.now[b.id].v.toFixed(1)}<span className="pct">%</span></span>
                <span className="read-ci" title="95% margin">± {A.now[b.id].ci95.toFixed(1)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      <TrendChart
        key="soft-age"
        height={narrow ? 460 : 340} xDomain={xDomain} yDomain={[lo, hi]}
        yTicks={yTicks} unit="%" axisFont={narrow ? 28 : 20}
        pad={{ l: narrow ? 84 : 58, r: 22, t: 16, b: 42 }}
        xTicks={buildXTicks(xDomain[0], xDomain[1])}
        series={AGE_BANDS.map((b, i) => ({ id: b.id, label: b.label, color: col(i), points: pts(b), endLabel: b.label }))}
        spine={pts(AGE_BANDS[0])}
        scatter={dots} pollFacet="twopp"
        tooltipTitle={(i) => waves[i] && waves[i].dateLabel}
        fmt={(v) => v.toFixed(0)}
        copy={{ sub: `Share of each age group not firm in its vote, wave by wave · ${houseList(A.houses)}`,
                legend: AGE_BANDS.map((b, i) => ({ label: `${b.label}  ${A.now[b.id].v.toFixed(1)}%`, color: col(i), kind: "line" })) }}
      />
      {firmSaid("demo-verdict", shift[0], shift[1])}
      <HowTo paras={[
        <>Each dot is one Resolve wave; the lines and the figures above pool three waves at a
        time, the figures its latest three ({A.now.from} to {A.now.to}).</>,
        <>Not firm is Resolve’s “soft” answer to “How firm are you with your vote?”: voters who
        named a party but say they might change. It is the All voters view’s “Not firm” line,
        split by age.</>,
        <>Resolve doesn’t publish how many people in each age group it asked, so each group is
        counted in proportion to its share of adults (2021 Census), the mix Resolve’s sample is
        weighted to. Two figures differ significantly when the gap between them is larger than
        their two margins combined.</>,
      ]} />
    </>
  );
}

// ---- Where One Nation’s new voters came from ---------------------------
/* One Nation's gain since the 2025 election, split by how the voters it
   gained voted in 2025 – from the vote-switching tables DemosAU and YouGov
   publish (gen-data §5b, data/vote-switching.json). Same furniture as the
   undecided panel: a reading per group, monthly lines, one dot per poll.
   A second view reads the same tables the other way: the share of each
   party's 2025 voters now backing One Nation (sr.rate), the rates the split
   is worked out from. The two can rank parties differently: a party with a
   big 2025 vote gives a large part of the gain while losing only a small
   share of its own voters. */
const ONS_VIEWS = [{ id: "gain", label: "Of One Nation’s gain" }, { id: "rate", label: "Of each party’s voters" }];
function OnSourcesPanel({ rangeId }) {
  const { D, rangeDomain, filterPts, buildXTicks, series } = window.AP;
  const narrow = useNarrow();
  const [view, setView] = useState("gain");
  const S = D.onSources;
  if (!S || !S.series.length) return null;
  /* The houses began publishing these tables in February 2026, so the chart
     starts at its first month rather than at the 2025 election the other
     panels open on – on the full range that would leave most of it empty. */
  const [rangeLo, rangeHi] = rangeDomain(rangeId);
  // the view's figures for a group: its part of the gain, or its own rate
  const rated = view === "rate" && S.series.every((sr) => sr.rate);
  const src = (sr) => (rated ? sr.rate : sr);
  const firstX = Math.min(...S.series.map((sr) => (src(sr).monthly[0] || { x: Infinity }).x));
  const xDomain = [Math.max(rangeLo, firstX - 0.06), rangeHi];
  const drawn = S.series.map((sr) => {
    const pts = filterPts(src(sr).monthly, xDomain[0]);
    const dots = src(sr).polls.filter((d) => d.x >= xDomain[0] && d.x <= xDomain[1])
      .map((d) => ({ x: d.x, y: d.v, color: sr.color, label: sr.label, meta: d }));
    return { sr, pts, dots };
  }).filter((d) => d.pts.length >= 1);
  if (!drawn.length) return null;
  const vals = drawn.flatMap((d) => d.pts.map((p) => p.v).concat(d.dots.map((p) => p.y)));
  const hi = Math.ceil((Math.max(...vals) + 3) / 10) * 10;
  const yTicks = [];
  for (let v = 10; v < hi; v += 10) yTicks.push(v);
  const spine = drawn.reduce((a, d) => (d.pts.length > a.length ? d.pts : a), []);
  /* The readings are the current reading (gen-data: each group's rate pooled
     over six weeks as the headline pools polls, then split), not the latest
     poll or calendar month – one wave's split rests on a few hundred
     respondents per group, and early in a month the month is one wave. The
     latest month stands in only if the window holds no poll. */
  const monthOf = (ym) => D.monthNameFull(+ym.slice(5)) + " " + ym.slice(0, 4);
  const reads = S.series.map((sr) => {
    const now = src(sr).now;
    if (now) return { sr, v: now.v, now, chg: now.chg ?? null };
    const m = src(sr).monthly, last = m[m.length - 1], prev = m[m.length - 2];
    return { sr, v: last.v, ym: last.ym, chg: prev ? +(last.v - prev.v).toFixed(1) : null };
  });
  const [a, b] = reads;
  /* The lead is the comparison the tables make plainest, the Coalition
     against Labor: how many times as many voters one has lost to One Nation
     as the other (the gain view), or how many times as likely its 2025
     voters are to have switched (the rates) - each view its own ratio, the
     Coalition's smaller 2025 vote making its rate ratio the larger. The
     figures themselves are the readings just below. */
  const onsLead = (() => {
    const when = a.now ? "" : "In " + monthOf(a.ym);
    const lead = (s) => (when ? `${when}, ${s}` : s[0].toUpperCase() + s.slice(1));
    if (!(a.v > 0 && b.v > 0)) return lead(`${a.v.toFixed(1)}% against ${b.v.toFixed(1)}%.`);
    const lnpMore = a.v >= b.v, x = lnpMore ? a.v / b.v : b.v / a.v;
    if (rated) {
      const [more, less] = lnpMore ? ["people who voted for the Coalition in 2025", "Labor voters"]
        : ["people who voted Labor in 2025", "Coalition voters"];
      return x < 1.25
        ? lead(`people who voted for the Coalition or Labor in 2025 ${a.now ? "are" : "were"} about as likely as each other to now back One Nation.`)
        : lead(`${more} ${a.now ? "are" : "were"} ${timesWords(x)} as likely as ${less} to now back One Nation.`);
    }
    const [more, less] = lnpMore ? ["the Coalition", "Labor"] : ["Labor", "the Coalition"];
    const has = a.now ? "has" : "had";
    return x < 1.25
      ? lead(`the Coalition and Labor ${a.now ? "have" : "had"} lost about as many voters to One Nation as each other since the 2025 election.`)
      : lead(`${more} ${has} lost ${timesWords(x)} as many voters to One Nation as ${less} ${has} since the 2025 election.`);
  })();
  // the same comparison as a headline: which of the two has bled more
  const onsHead = (() => {
    if (!(a.v > 0 && b.v > 0)) return null;
    const lnpMore = a.v >= b.v, even = (lnpMore ? a.v / b.v : b.v / a.v) < 1.25;
    if (rated) return even ? "Coalition and Labor voters switching at similar rates"
      : (lnpMore ? "Coalition" : "Labor") + " voters likelier to have switched to One Nation";
    return even ? "Coalition and Labor losing voters to One Nation alike"
      : (lnpMore ? "The Coalition" : "Labor") + (a.now ? " is" : " was") + " losing more voters to One Nation";
  })();
  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2 className="card-title">Where One Nation’s new voters came from</h2>
          <p className="card-sub">
            {rated ? "Share of each party’s 2025 voters now backing One Nation"
              : "Share of One Nation’s gain since the 2025 election, by how those voters voted in 2025"}. <em className="card-houses">{houseList(S.houses)}.</em>
          </p>
        </div>
      </div>
      {S.series.every((sr) => sr.rate) && (
        <div className="ons-ctl">
          <Segmented options={ONS_VIEWS} value={view} onChange={setView} size="sm" ariaLabel="Figures as a share" />
        </div>
      )}
      <Story head={onsHead} dek={onsLead} />
      <div className="und-reads">
        {reads.map(({ sr, v, chg, now }) => (
          <div className="und-read" key={sr.id}>
            <span className="und-swatch" style={{ background: sr.color }} aria-hidden="true"></span>
            <div className="und-read-body">
              <div className="und-read-top">
                <span className="und-read-lab">{sr.label}</span>
                <span className="und-read-v">{v.toFixed(1)}<span className="pct">%</span></span>
                {now && now.ci95 != null && <span className="read-ci" title="95% margin">± {now.ci95.toFixed(1)}</span>}
                {chg != null && <Delta value={chg} neutral small title={now ? nowDeltaTitle(now) : "Change on the previous month"} />}
              </div>
              <p className="und-read-note">{sr.note}</p>
            </div>
          </div>
        ))}
      </div>
      <TrendChart
        key="ons"
        height={narrow ? 460 : 340} xDomain={xDomain} yDomain={[0, hi]}
        yTicks={yTicks} unit="%" axisFont={narrow ? 28 : 20}
        // two-digit shares ("60%") at the phone's 28px axis need the room
        pad={{ l: narrow ? 84 : 58, r: 22, t: 16, b: 42 }}
        xTicks={buildXTicks(xDomain[0], xDomain[1])}
        series={drawn.map((d) => ({ id: d.sr.id, label: d.sr.label, color: d.sr.color, points: series(d.pts, "v"),
                                    endLabel: d.sr.short || d.sr.label.replace(/ voters$/, "") }))}
        spine={series(spine, "v")}
        scatter={drawn.flatMap((d) => d.dots)} pollFacet="twopp"
        tooltipTitle={(i) => window.AP.monthLabelFull(spine[i].ym)}
        fmt={(v) => v.toFixed(1)}
        // the readings above are this chart's key on the page; the image
        // carries them as its legend, with the figure each one shows
        copy={{ legend: reads.filter((r) => drawn.some((d) => d.sr.id === r.sr.id))
          .map(({ sr, v }) => ({ label: `${sr.label}  ${v.toFixed(1)}%`, color: sr.color, kind: "line" })) }}
      />
      <HowTo paras={[
        <>Each dot is one poll’s {rated ? "figure" : "split"} and the lines are monthly averages; the
        figures above pool the last {S.now ? S.now.window : "six weeks"} of polls.{" "}
        <button type="button" className="hi-term"
                onClick={() => window.AP.openTerm && window.AP.openTerm("vote-switching", "Where One Nation’s new voters came from")}>
          How it’s worked out</button></>,
        <>Newer polls count for more in the figures above.</>,
        <>The two views come from the same tables. “Of each party’s voters” is the share of each
        party’s 2025 voters now backing One Nation. Weighted by that party’s share of the 2025 vote,
        it becomes the party’s part of One Nation’s gain, so 38% of Coalition voters counts for far
        more than 38% of a small party’s.</>,
        <>Voters who can’t recall a 2025 vote are left out, and so are One Nation’s own 2025
        voters, who are what it kept rather than gained.</>,
      ]} />
    </section>
  );
}

// ---- Who votes for whom: the vote by group -----------------------------------
/* One figure per group and party (gen-data §7g): each poll's gap between a
   group and its own all-voters figure, pooled over six weeks the way the
   headline pools polls, added to the site's current primaries. Groups pool
   only where pollsters cut the population the same way, so Age shows its
   bands and, beside them, the generations two houses ask by; Place shows
   states beside location, Home housing beside language at home. One party at a
   time, One Nation first. Under each set's bars, a chart of how much higher
   or lower each group's vote is than all voters', in PERCENT, month by month
   (gen-data's monthly lines over that month's primaries) inside its 95%
   interval, each poll's own figure against its own all-voters figure a dot,
   all voters the dashed zero line; the bars' swatches are its legend. The
   bands are what make it readable: a group's month rests on a few hundred
   respondents, and in 2025 on one poll, so most wiggles sit inside their
   own margin – where bands overlap, those groups can't be told apart.
   Not the levels: every group's line is the month's primaries plus its gap,
   so they redrew the national trend once per group. Not the gap in points
   either: One Nation grew 3.5-fold over the chart, and a group giving it
   two-thirds of the national rate sits 3 points under at 8% and 9 under at
   27%, so points read growth as a deepening divide. The percent difference
   holds still unless the group really moves apart. */
const DEMO_PARTIES = [
  { id: "onp", label: "One Nation" }, { id: "alp", label: "Labor" },
  { id: "lnp", label: "Coalition" }, { id: "grn", label: "Greens" },
];
const demoHouse = (h) => (h === "RedBridge/Accent" ? "RedBridge" : h);
// a poll row's grp.v party order (gen-data DEMO_BY_POLL; the export's columns)
const DEMO_GRP_PARTY = ["alp", "lnp", "grn", "onp", "oth"];
/* A set's groups as a ramp of the party's colour, first group full strength
   shading towards the page's own ink – dark on the light theme, pale on the
   dark one, so the ends of the ramp part in both and neither is mistaken for
   the grey all-voters line. Ordered groups (ages, generations, levels of
   education) read in order, and every line still says which party. */
const demoRamp = (color, n, i) => (n < 2 ? color
  : `color-mix(in oklch, ${color} ${Math.round(100 - (i * 60) / (n - 1))}%, var(--ink))`);
/* One sentence under a set's bars saying whether its groups differ for the
   chosen party. Two groups differ significantly when their gap exceeds the
   gap's own 95% margin, √(±a² + ±b²): the groups are separate respondents,
   so their errors add in quadrature. Overlapping ± bars alone would miss
   gaps that are real. With three or four groups the sentence picks from
   three to six gaps, which unadjusted would find a difference that isn't
   there one time in five to eight, so Holm's correction raises the bar, as
   the chart's sentence does: the smallest p against .05/m, the next against
   .05/(m − 1), and so on. Ordered sets (ages, generations) whose every step
   is significant, one way, read as a trend; otherwise the sentence names
   the group that stands apart from all the others (the one further from its
   nearest neighbour, if both ends do), or failing that the widest
   significant gap. */
const DEMO_WHO = {
  "18–34": "voters aged 18–34", "35–54": "voters aged 35–54", "55+": "voters aged 55 and over",
  "Gen Z": "Gen Z voters", Millennials: "Millennials", "Gen X": "Gen X voters", Boomers: "Boomers",
  Men: "men", Women: "women",
  "Year 12 or less": "voters with Year 12 or less", "TAFE or trade": "voters with a TAFE or trade qualification",
  University: "university graduates",
  NSW: "voters in NSW", Vic: "voters in Victoria", Qld: "voters in Queensland",
  "Rest of Australia": "voters in SA, WA, Tasmania, and the territories",
  "Inner metro": "voters in the inner suburbs", "Outer metro": "voters in the outer suburbs",
  Provincial: "voters in provincial towns and cities", Rural: "rural voters",
  "Own outright": "voters who own their home outright", Mortgage: "voters with a mortgage", Renting: "renters",
  "English only": "voters who speak only English at home", "Other language": "voters who speak another language at home",
};
/* Per set: `all` names the groups together, `others` the rest of them beside
   one group, `step` the trend phrase for an ordered set (null where the
   groups have no order), and `one` a single group, for the chart's
   sentence. */
const DEMO_SET_WORDS = {
  age: { all: "age groups", others: "any other age group", step: "with each older age group", one: "age group" },
  generation: { all: "generations", others: "any other generation", step: "with each older generation", one: "generation" },
  gender: { all: "men and women", others: null, step: null },
  education: { all: "levels of education", others: "voters with other levels of education", step: null, one: "education group" },
  state: { all: "the states", others: "voters in other states", step: null, one: "state" },
  // inner suburbs, outer suburbs, provincial, rural: each further from a capital
  location: { all: "the city and the country", others: "voters in other areas", step: "with each step further from the city", one: "area" },
  housing: { all: "owners and renters", others: "other voters", step: null, one: "group" },
  language: { all: "voters who speak only English at home and those who don’t", others: null, step: null },
};
const DEMO_VOTE_FOR = { alp: "Labor", lnp: "the Coalition", grn: "the Greens", onp: "One Nation", oth: "a minor party or independent" };
// P(|Z| > z) for a standard normal (Abramowitz & Stegun 7.1.26, error under 1.5e-7)
function zTail(z) {
  const x = Math.abs(z) / Math.SQRT2, t = 1 / (1 + 0.3275911 * x);
  return t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429)))) * Math.exp(-x * x);
}
function demoVerdict(st, party) {
  const gs = st.groups.filter((g) => g.v[party] != null && g.ci[party] != null);
  if (gs.length < 2) return null;
  const words = DEMO_SET_WORDS[st.id] || { all: "these groups", others: "any other group", step: null };
  const who = (g) => DEMO_WHO[g.label] || g.label;
  const Who = (g) => { const s = who(g); return s[0].toUpperCase() + s.slice(1); };
  const vote = "to vote for " + DEMO_VOTE_FOR[party];
  // every gap against its own margin: z = gap / √(se_a² + se_b²), each ± being 1.96 se
  const gaps = gs.flatMap((a, i) => gs.slice(i + 1).map((b) => {
    const m = Math.hypot(a.ci[party], b.ci[party]);
    return { a, b, p: m > 0 ? zTail(1.96 * (a.v[party] - b.v[party]) / m) : 1 };
  }));
  const sig = new Set();
  for (const [i, g] of [...gaps].sort((x, y) => x.p - y.p).entries()) {
    if (g.p >= 0.05 / (gaps.length - i)) break;
    sig.add(g);
  }
  // +1 if a is significantly above b, −1 if below, 0 if the polls can't tell
  const cmp = (a, b) => (sig.has(gaps.find((g) => (g.a === a && g.b === b) || (g.a === b && g.b === a)))
    ? Math.sign(a.v[party] - b.v[party]) : 0);
  const pairs = gs.flatMap((a, i) => gs.slice(i + 1).map((b) => [a, b, cmp(a, b)])).filter((p) => p[2]);
  if (!pairs.length) return `There is no significant difference between ${words.all}.`;
  if (gs.length === 2) {
    const [a, b] = gs[0].v[party] > gs[1].v[party] ? gs : [gs[1], gs[0]];
    return `${Who(a)} are significantly more likely than ${who(b)} ${vote}.`;
  }
  if (words.step && gs.length === st.groups.length) {
    const steps = gs.slice(1).map((g, i) => cmp(g, gs[i]));
    if (steps[0] !== 0 && steps.every((s) => s === steps[0])) return `Support for ${DEMO_VOTE_FOR[party]} ${steps[0] > 0 ? "rises" : "falls"} significantly ${words.step}.`;
  }
  const byV = [...gs].sort((a, b) => b.v[party] - a.v[party]);
  const top = byV[0], bot = byV[byV.length - 1];
  const topApart = byV.slice(1).every((g) => cmp(top, g) > 0), botApart = byV.slice(0, -1).every((g) => cmp(bot, g) < 0);
  const topGap = top.v[party] - byV[1].v[party], botGap = byV[byV.length - 2].v[party] - bot.v[party];
  if (topApart && (!botApart || topGap >= botGap)) return `${Who(top)} are significantly more likely than ${words.others} ${vote}.`;
  if (botApart) return `${Who(bot)} are significantly less likely than ${words.others} ${vote}.`;
  const [a, b] = pairs.map(([x, y, s]) => (s > 0 ? [x, y] : [y, x]))
    .sort((p, q) => (q[0].v[party] - q[1].v[party]) - (p[0].v[party] - p[1].v[party]))[0];
  return `${Who(a)} are significantly more likely than ${who(b)} ${vote}.`;
}
/* A verdict that finds something carries the leads' highlighter; one that
   finds nothing ("no significant difference", "hasn’t changed significantly",
   "aren’t enough polls") stays plain, so the marks point at the findings. */
const demoSaid = (t) => t && <p className="demo-verdict">
  {/significant/.test(t) && !/\bno\b|n’t/.test(t) ? <mark>{t}</mark> : t}</p>;
/* The sentence under a set's chart: has any group moved towards or away
   from the party, relative to all voters, over the period on screen? The
   lines pool every pollster, and who asks changes over the term (Resolve
   alone until February 2026, then YouGov, RedBridge and DemosAU), so a line
   can move only because a pollster joined. The test compares each pollster
   with itself: a straight line through a group's gap to all voters (the
   chart's dots), a level for each pollster and one shared slope, each poll
   weighted by its sample, and the scatter about the line measured from the
   polls rather than assumed. The slope is significant when its t-test
   clears 95%. With three or four groups tested at once, Holm's correction
   keeps one of them from clearing it by chance. Two groups (men, women) are
   a single test: the gap between them. */
// P(|T| > t) for Student's t on whole degrees of freedom, exact (Abramowitz & Stegun 26.7.3–4)
function tTail(t, df) {
  const th = Math.atan(Math.abs(t) / Math.sqrt(df)), c2 = Math.cos(th) ** 2;
  let term = 1, sum = 1;
  if (df % 2) {
    for (let k = 1; k <= (df - 3) / 2; k++) sum += (term *= (2 * k) / (2 * k + 1) * c2);
    return 1 - (2 / Math.PI) * (th + (df > 1 ? Math.sin(th) * Math.cos(th) * sum : 0));
  }
  for (let k = 1; k <= (df - 2) / 2; k++) sum += (term *= (2 * k - 1) / (2 * k) * c2);
  return 1 - Math.sin(th) * sum;
}
// the slope (per year) through points { h: pollster, t, y, w }, each pollster its own level
function withinHouseSlope(pts) {
  const byHouse = new Map();
  for (const p of pts) (byHouse.get(p.h) || byHouse.set(p.h, []).get(p.h)).push(p);
  const dm = [];
  let houses = 0;
  for (const ps of byHouse.values()) {
    if (ps.length < 2) continue;                  // one poll says nothing about its house's trend
    houses++;
    const W = ps.reduce((a, p) => a + p.w, 0);
    const tb = ps.reduce((a, p) => a + p.w * p.t, 0) / W, yb = ps.reduce((a, p) => a + p.w * p.y, 0) / W;
    for (const p of ps) dm.push({ w: p.w, dt: p.t - tb, dy: p.y - yb });
  }
  const df = dm.length - houses - 1;
  const sxx = dm.reduce((a, p) => a + p.w * p.dt * p.dt, 0);
  if (df < 3 || !(sxx > 0)) return null;
  const b = dm.reduce((a, p) => a + p.w * p.dt * p.dy, 0) / sxx;
  const se = Math.sqrt(dm.reduce((a, p) => a + p.w * (p.dy - b * p.dt) ** 2, 0) / df / sxx);
  return { b, p: se > 0 ? tTail(b / se, df) : 1 };
}
function demoTrendVerdict(D, st, party, inX) {
  const gpi = DEMO_GRP_PARTY.indexOf(party);
  const words = DEMO_SET_WORDS[st.id] || {};
  const who = (g) => DEMO_WHO[g.label] || g.label;
  const P = DEMO_VOTE_FOR[party];
  const polls = D.individualPolls.filter((p) => p.grp && p.grp.t && p.grp.t[gpi] > 0 && inX(p.x));
  const gapOf = (p, g) => {                       // as the chart's dots draw it
    const v = p.grp.v[D.demoGroups.indexOf(g.label)];
    const sum = v ? v.reduce((a, b) => a + b, 0) : 0;
    return sum > 0 ? 100 * ((100 * v[gpi] / sum) / p.grp.t[gpi] - 1) : null;
  };
  const points = (y) => polls.map((p) => ({ h: p.pollster, t: p.x, w: p.sample || 1000, y: y(p) }))
    .filter((d) => d.y != null && isFinite(d.y));
  const asked = polls.find((p) => st.groups.some((g) => gapOf(p, g) != null));
  if (!asked) return null;
  const when = D.monthNameFull(+asked.ym.slice(5)) + " " + asked.ym.slice(0, 4);
  if (st.groups.length === 2) {
    const [a, b] = st.groups;
    const fit = withinHouseSlope(points((p) => {
      const ga = gapOf(p, a), gb = gapOf(p, b);
      return ga == null || gb == null ? null : ga - gb;
    }));
    if (!fit) return `There aren’t enough polls since ${when} to tell whether the gap between ${who(a)} and ${who(b)} has changed.`;
    // no party named, as the bars' "no significant difference between men and women":
    // with it, the language pair ran to thirty words
    if (fit.p >= 0.05) return `The gap between ${who(a)} and ${who(b)} hasn’t changed significantly since ${when}.`;
    const [towards, from] = fit.b > 0 ? [a, b] : [b, a];
    return `Since ${when}, ${who(towards)} have moved significantly towards ${P} relative to ${who(from)}.`;
  }
  const one = words.one || "group";
  const fits = st.groups.map((g) => ({ g, fit: withinHouseSlope(points((p) => gapOf(p, g))) })).filter((f) => f.fit);
  if (!fits.length) return `There aren’t enough polls since ${when} to tell whether any ${one} has moved relative to all voters.`;
  // Holm: the smallest p against .05/m, the next against .05/(m − 1), and so on, stopping at the first miss
  const sig = [];
  for (const [i, f] of [...fits].sort((x, y) => x.fit.p - y.fit.p).entries()) {
    if (f.fit.p >= 0.05 / (fits.length - i)) break;
    sig.push(f);
  }
  if (!sig.length) return `Since ${when}, no ${one} has moved significantly towards or away from ${P} relative to all voters.`;
  const names = (fs) => houseList(fs.map((f) => who(f.g)), Infinity);
  const towards = sig.filter((f) => f.fit.b > 0), away = sig.filter((f) => f.fit.b < 0);
  const [first, then] = away.length >= towards.length ? [[away, "away from"], [towards, "towards"]] : [[towards, "towards"], [away, "away from"]];
  return `Since ${when}, ${names(first[0])} have moved significantly ${first[1]} ${P} relative to all voters` +
    (then[0].length ? `, and ${names(then[0])} ${then[1]} it.` : ".");
}
function DemographicsPanel({ rangeId = "all" }) {
  const { D, rangeDomain, filterPts, buildXTicks, series } = window.AP;
  const narrow = useNarrow();
  const T = D.demographics;
  const [tabId, setTab] = useState("age");
  const [party, setParty] = useState("onp");
  if (!T || !T.tabs || !T.tabs.length) return null;
  const tab = T.tabs.find((t) => t.id === tabId) || T.tabs[0];
  const color = D.PARTIES[party].color;
  const name = D.PARTIES[party].name;
  const all = T.all[party];
  const vals = tab.sets.flatMap((st) => st.groups.map((g) => g.v[party])).concat([all]);
  const top = Math.max(10, Math.ceil((Math.max(...vals) + 2) / 10) * 10);
  const row = (label, v, ci, isAll, title, swatch) => (
    <div className={"demo-row" + (isAll ? " all" : "")} key={label} title={title}>
      <span className="demo-lab">
        {swatch && <span className={"demo-sw" + (isAll ? " dash" : "")} style={isAll ? null : { background: swatch }} aria-hidden="true"></span>}
        {label}
      </span>
      <span className="demo-track" aria-hidden="true">
        <span className="demo-fill" style={{ width: (100 * v / top) + "%", background: isAll ? "var(--ink-3)" : color }}></span>
      </span>
      <span className="demo-v">{v.toFixed(1)}<span className="pct">%</span></span>
      <span className="demo-ci">{ci != null ? "± " + ci.toFixed(1) : ""}</span>
    </div>
  );
  /* One set's chart: each group's monthly figure for the chosen party as a
     percent above or below that month's all-voters figure, its 95% interval
     (the month's margin in points, after the shares in each monthly row, over
     the same all-voters figure – that figure's own margin, a tenth the size,
     is left out), and each poll's group figure against its own all-voters
     figure (grp.t). */
  const rel = (g, a) => 100 * (g / a - 1);
  const ki = T.order.indexOf(party), gpi = DEMO_GRP_PARTY.indexOf(party);
  const [rangeLo, rangeHi] = rangeDomain(rangeId);
  const build = (st, firstXShared) => {
    const n = st.groups.length;
    const allAt = new Map(T.allMonthly.map((m) => [m[0], m[1 + ki]]));
    const lines = st.groups.map((g, i) => ({ g, color: demoRamp(color, n, i),
      pts: (g.monthly || []).filter((m) => allAt.has(m[0]))
        .filter((m) => allAt.get(m[0]) > 0)
        .map((m) => ({ ym: m[0], x: D.mx(m[0]), v: +rel(m[1 + ki], allAt.get(m[0])).toFixed(1),
                       ci: m[1 + T.order.length + ki] != null ? 100 * m[1 + T.order.length + ki] / allAt.get(m[0]) : null })) }))
      .filter((l) => l.pts.length);
    if (!lines.length) return null;
    // the houses asked from Feb 2026 (Resolve's age and gender from mid-2025),
    // so a set's chart opens at its first month, as the One Nation panel does
    const firstX = firstXShared != null ? firstXShared : Math.min(...lines.map((l) => l.pts[0].x));
    const xDomain = [Math.max(rangeLo, firstX - 0.06), rangeHi];
    const inX = (x) => x >= xDomain[0] && x <= xDomain[1];
    const allPts = filterPts(T.allMonthly.map((m) => ({ ym: m[0], x: D.mx(m[0]), v: 0 }))
      .filter((d) => d.x >= firstX), xDomain[0]);
    const drawn = lines.map((l) => ({ ...l, pts: filterPts(l.pts, xDomain[0]) }));
    const dots = D.individualPolls.filter((p) => p.grp && p.grp.t && inX(p.x)).flatMap((p) => drawn.map((l) => {
      const v = p.grp.v[D.demoGroups.indexOf(l.g.label)];
      const sum = v ? v.reduce((a, b) => a + b, 0) : 0;
      return sum > 0 && p.grp.t[gpi] > 0
        ? { x: p.x, y: +rel(100 * v[gpi] / sum, p.grp.t[gpi]).toFixed(1), color: l.color, label: l.g.label, meta: p } : null;
    }).filter(Boolean));
    // a share can't fall below zero, so neither can a band's floor fall below −100%
    const areas = drawn.map((l) => ({ id: "ci-" + l.g.label, color: l.color, className: "ci-band", edge: false,
      smooth: true, points: l.pts.filter((d) => d.ci != null)
        .map((d) => ({ x: d.x, y0: Math.max(-100, d.v - d.ci), y1: d.v + d.ci })) }))
      .filter((a) => a.points.length >= 2);
    // the domain covers the bands too, or the widest months would run off the plot
    const vals = drawn.flatMap((l) => l.pts.map((d) => d.v)).concat(allPts.map((d) => d.v), dots.map((d) => d.y),
      areas.flatMap((a) => a.points.flatMap((d) => [d.y0, d.y1])));
    return { st, n, lines, firstX, xDomain, allPts, drawn, dots, areas, vals };
  };
  /* The sets on a tab sit side by side (by age | by generation), so they
     share a time axis and a scale: two charts starting in different months
     with different gridlines invited a comparison neither could support. */
  const builtFirst = tab.sets.map((st) => build(st, null)).filter(Boolean);
  const sharedFirstX = builtFirst.length ? Math.min(...builtFirst.map((b) => b.firstX)) : null;
  const built = new Map(tab.sets.map((st) => [st.id, build(st, sharedFirstX)]));
  const sharedVals = [...built.values()].filter(Boolean).flatMap((b) => b.vals);
  /* the finest step that keeps to six gridlines, and never a floor under
     −100%: no group can sit more than 100% below all voters. The domain ends
     on the first gridline past the data (a tenth of a step clear), and both
     end gridlines are labelled: fitDomain's 40% pad plus unlabelled edges
     could leave nearly a whole empty step above and below the lines. */
  const sharedAxis = (() => {
    if (!sharedVals.length) return null;
    const lo = Math.min(0, ...sharedVals), hi = Math.max(0, ...sharedVals);
    const step = [10, 20, 25, 50, 100].find((st) => (hi - lo) / st <= 6) || 200;
    const d0 = Math.max(-100, Math.floor((lo - step * 0.1) / step) * step);
    const d1 = Math.ceil((hi + step * 0.1) / step) * step;
    const ticks = [];
    for (let v = d0; v <= d1 + 1e-9; v += step) ticks.push(v);
    return { domain: [d0, d1], ticks };
  })();
  const chartFor = (st0) => {
    const b = built.get(st0.id);
    if (!b || !sharedAxis) return null;
    const { st, n, xDomain, allPts, drawn, dots, areas } = b;
    const { domain, ticks } = sharedAxis;
    const signed = (v) => (Math.round(v) > 0 ? "+" : Math.round(v) < 0 ? "\u2212" : "") + Math.abs(Math.round(v));
    const by = st.label ? st.label.replace(/^By /, "") : tab.label.toLowerCase();
    return (
      <div className="demo-chart">
        {/* on a phone the charts stack apart from their bars, so with two sets
            each chart names its own, as the bars' header does */}
        <p className="demo-chart-lab">
          {tab.sets.length > 1 && <span className="demo-chart-set">{st.label}</span>}
          How much higher or lower than among all voters (%), month by month
        </p>
        <TrendChart
          key={"demo-" + st.id}
          height={narrow ? 560 : 500} xDomain={xDomain} yDomain={domain}
          yTicks={ticks} unit="%"
          yTickFmt={(t) => (t > 0 ? "+" + t + "%" : t < 0 ? "\u2212" + -t + "%" : "0")}
          // the right margin keeps the last month's label clear of the copy button
          pad={{ l: narrow ? 92 : 76, r: 60, t: 16, b: narrow ? 66 : 56 }}
          xTicks={buildXTicks(xDomain[0], xDomain[1])}
          series={[{ id: "all", label: "All voters", color: "var(--ink-3)", dashed: true, points: series(allPts, "v") },
                   ...drawn.map((l) => ({ id: l.g.label, label: l.g.label, color: l.color, points: series(l.pts, "v"),
                                          /* three shades of one party colour: the name at the line's end is what tells them apart */
                                          endLabel: l.g.label }))]}
          areas={areas}
          spine={series(allPts, "v")}
          scatter={dots} pollFacet="primary"
          tooltipTitle={(i) => window.AP.monthLabelFull(allPts[i].ym)}
          fmt={signed}
          ariaLabel={`${name} by ${by}: how much higher or lower each group's vote is than all voters', in percent, month by month`}
          copy={{
            sub: `How much higher or lower ${name}’s vote is in each group than among all voters, by ${by} · the latest figures pool the last ${T.window} of polls`,
            legend: [{ label: `All voters  ${all.toFixed(1)}%`, color: "var(--ink-3)", kind: "dashed" },
                     ...st.groups.map((g, i) => ({ label: `${g.label}  ${signed(rel(g.v[party], all))}%`,
                                                   color: demoRamp(color, n, i), kind: "line" })),
                     ...(areas.length ? [{ label: "95% interval (shaded)", color: "var(--ink-faint)", kind: "shade" }] : [])],
          }}
        />
        {(() => {
          const t = demoTrendVerdict(D, st, party, (x) => x >= xDomain[0] && x <= xDomain[1]);
          return demoSaid(t);
        })()}
      </div>
    );
  };

  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2 className="card-title">Who votes for whom</h2>
          <p className="card-sub">
            <Houses after={`${name}’s share of each group’s first-preference vote, pooled from the last ${T.window} of polls`}>{houseList(T.houses.map(demoHouse))}</Houses>
          </p>
        </div>
      </div>
      <div className="demo-ctl">
        <Segmented options={T.tabs.map((t) => ({ id: t.id, label: t.label }))} value={tab.id} onChange={setTab}
                   size="sm" ariaLabel="Group voters by" />
        <Segmented options={DEMO_PARTIES} value={party} onChange={setParty} size="sm" ariaLabel="Party" />
      </div>
      {/* A tab with one set (gender, education) has the width the age tab
          spends on its second set, so its chart takes that column, and the
          notes sit under the bars they explain rather than below the chart.
          The notes are one element on every tab, so an open "How to read"
          stays open across a tab switch. */}
      <div className="demo-body">
      <div className={"demo-grid" + (tab.sets.length === 1 ? " solo" : "")}>
        {/* Every set's bars, then every set's chart. Two columns put the bars
            side by side over the charts, level by construction; one column (a
            phone) reads bars, bars, chart, chart, since the bars say more - the
            charts mostly show no significant change. */}
        {tab.sets.map((st) => (
            <div className="demo-bars" key={st.id}>
            {tab.sets.length > 1 && (
              <div className="demo-house-head">
                <span className="demo-house-name">{st.label}</span>
                <span className="demo-house-when">{houseList(st.houses.map(demoHouse))}</span>
              </div>
            )}
            {row("All voters", all, null, true, "The site’s current figure for all voters – the headline’s own estimate", "dash")}
            {st.groups.map((g, i) => row(g.label, g.v[party], g.ci[party], false,
              `Pooled from ${g.n} poll${g.n === 1 ? "" : "s"} · ${houseList(g.houses.map(demoHouse))} · ± ${g.ci[party].toFixed(1)} is the 95% margin`,
              demoRamp(color, st.groups.length, i)))}
            {demoSaid(demoVerdict(st, party))}
            </div>
        ))}
        {/* an empty slot keeps a set with no chart from pulling the other set's chart under the wrong bars */}
        {tab.sets.map((st) => (
          <React.Fragment key={st.id + "-chart"}>
            {chartFor(st) || (tab.sets.length > 1 ? <div className="demo-chart" /> : null)}
          </React.Fragment>
        ))}
      {/* The gist stays in view; the reading instructions fold, as the
          Past cycles intro's do - all of it ran eight lines under the charts. */}
      <div className="demo-notes">
      <details className="view-how hint-how">
        <summary>How to read these charts</summary>
        <p className="table-hint">
          The figures pool the last {T.window} of polls. Each chart shows how much higher or lower
          the party’s vote is in each group than among all voters, month by month.{" "}
          <button type="button" className="hi-term"
                  onClick={() => window.AP.openTerm && window.AP.openTerm("vote-by-group", "Who votes for whom")}>
            Where the figures come from</button>
        </p>
        <p className="table-hint">
          A bar is that group’s share of the first-preference vote: 17.1% beside 18–34 means
          17.1% of people aged 18–34 name the party as their first preference – the same as the
          all-voters bar, read among that group alone. Each poll says how far a group sits from
          its own overall figure. Those gaps are pooled, newer and larger polls counting for more
          as in every figure here, and added to the site’s current figure for all voters. ± is
          the 95% margin.
        </p>
        <p className="table-hint">
          The sentence under the bars says whether the groups really differ. Two groups differ
          significantly when the gap between them is larger than its own 95% margin, which
          combines both groups’ ± figures. With three or four groups there are several gaps to
          test at once, so each has to clear a higher bar.
        </p>
        <p className="table-hint">
          The sentence under each chart says whether any group has moved towards or away from the
          party, relative to all voters, over the period shown. It compares each pollster only with
          itself, so a pollster joining or leaving can’t pass for a change. The same higher bar
          applies when three or four groups are tested at once.
        </p>
        <p className="table-hint">
          The charts are built the way the site’s other monthly lines are: each poll is a dot and
          each line’s 95% interval is shaded. Where two groups’ shading overlaps, the polls can’t
          tell them apart that month. −38% means the party’s vote in that group is 38% lower than
          among all voters, not 38 points. Measured this way a party’s growth doesn’t read as a
          widening divide, so a flat line means the group moved with everyone else.
        </p>
        <p className="table-hint">
          Groups pool only where pollsters cut them the same way
          {tab.id === "age" ? ": YouGov’s 35–49 and 50+ bands aren’t 35–54 and 55+, so it joins only at 18–34"
            : tab.id === "place" ? ": YouGov’s SA, WA, and ACT/NT/Tas are combined into the rest of Australia at their shares of the 2025 vote, and DemosAU’s Regional/Rural holds provincial and rural voters together, so it joins only at the two suburban groups"
            : tab.id === "home" ? ": RedBridge’s Renting and other is wider than renters, so it joins only at the two owner groups"
            : ""}.
        </p>
        {tab.id === "age" && (
          <p className="table-hint">
            Neither pollster publishes the birth years behind its generations; the usual ones, and
            what is uncertain about them, are under{" "}
            <button type="button" className="hi-term"
                    onClick={() => window.AP.openTerm && window.AP.openTerm("generations", "Who votes for whom")}>
              Generations</button>.
          </p>
        )}
      </details>
      </div>
      </div>
      </div>
    </section>
  );
}

// ---- The issues: what matters, and who voters trust with it ----------------
/* Two views of the one question. "Who's trusted": for each issue, how many
   voters put it in their top three (RedBridge and Ipsos, each moved halfway
   toward the other – they word the question differently and sit a steady
   distance apart; gen-data §7h) beside who they think is best on it: Labor,
   the Coalition and One Nation as shares of the voters who named one of
   those three, pooled across Resolve, RedBridge, Ipsos, YouGov and DemosAU
   (the five offer different options, and those three are the part every
   question shares). A row picks the issue the chart follows month by month. "What
   matters to whom": RedBridge's top three by group, under its own
   all-voters row. */
const ISS_PARTY = { alp: "Labor", lnp: "the Coalition", onp: "One Nation" };
const ISS_PARTY_CAP = { alp: "Labor", lnp: "Coalition", onp: "One Nation" };
// the group table's column heads: a word or two
const ISS_SHORT = { col: "Cost of living", housing: "Housing", health: "Health", economy: "Economy",
  immigration: "Immigration", climate: "Climate", crime: "Crime", security: "Security" };
// an issue inside a sentence
const ISS_PHRASE = { col: "the cost of living", housing: "housing", health: "health",
  economy: "economic management", immigration: "immigration", climate: "climate change",
  crime: "crime", security: "national security" };
const ISS_WHO = {
  Labor: "Labor voters", Coalition: "Coalition voters", Liberal: "Liberal voters",
  "Nationals, LNP and CLP": "Nationals, LNP and CLP voters", "One Nation": "One Nation voters",
  Greens: "Greens voters", Others: "voters for other parties and independents", Undecided: "undecided voters",
  "Below Year 12": "voters who left school before Year 12", "Year 12": "voters who finished Year 12",
  "Renting and other": "renters and others",
};
const ISS_SET_WORDS = {
  vote: { all: "voters of different parties", others: "any other group of voters" },
  generation: DEMO_SET_WORDS.generation, gender: DEMO_SET_WORDS.gender, location: DEMO_SET_WORDS.location,
  housing: { all: "owners and renters", others: "other voters" }, education: DEMO_SET_WORDS.education,
};
const issWho = (g) => ISS_WHO[g] || DEMO_WHO[g] || g;
const issCap = (s) => s[0].toUpperCase() + s.slice(1);
/* One sentence per issue on the group view, or null when no gap between two
   groups clears its margin: the same test as the vote-by-group bars (each
   gap against √(±a² + ±b²), Holm's correction across the set's gaps), the
   group that stands apart named if there is one, else the widest gap. */
function issGroupVerdict(tab, k) {
  const gs = tab.groups.map((g) => ({ g, c: tab.cells[g] && tab.cells[g][k] })).filter((x) => x.c && x.c.ci != null);
  if (gs.length < 2) return null;
  const gaps = gs.flatMap((a, i) => gs.slice(i + 1).map((b) => {
    const m = Math.hypot(a.c.ci, b.c.ci);
    return { a, b, p: m > 0 ? zTail(1.96 * (a.c.v - b.c.v) / m) : 1 };
  }));
  const sig = new Set();
  for (const [i, g] of [...gaps].sort((x, y) => x.p - y.p).entries()) {
    if (g.p >= 0.05 / (gaps.length - i)) break;
    sig.add(g);
  }
  if (!sig.size) return null;
  const words = ISS_SET_WORDS[tab.id] || { all: "these groups", others: "any other group" };
  const cmp = (a, b) => {
    const g = gaps.find((x) => (x.a === a && x.b === b) || (x.a === b && x.b === a));
    return sig.has(g) ? Math.sign(a.c.v - b.c.v) : 0;
  };
  const what = `to put ${ISS_PHRASE[k] || k} in their top three`;
  const pct = (x) => Math.round(x.c.v) + "%";
  const byV = [...gs].sort((a, b) => b.c.v - a.c.v);
  const top = byV[0], bot = byV[byV.length - 1];
  if (gs.length === 2) return { gap: top.c.v - bot.c.v,
    text: `${issCap(issWho(top.g))} are significantly more likely than ${issWho(bot.g)} ${what} (${pct(top)} against ${pct(bot)}).` };
  const topApart = byV.slice(1).every((x) => cmp(top, x) > 0), botApart = byV.slice(0, -1).every((x) => cmp(bot, x) < 0);
  const topGap = top.c.v - byV[1].c.v, botGap = byV[byV.length - 2].c.v - bot.c.v;
  if (topApart && (!botApart || topGap >= botGap)) return { gap: topGap,
    text: `${issCap(issWho(top.g))} are significantly more likely than ${words.others} ${what} (${pct(top)}).` };
  if (botApart) return { gap: botGap,
    text: `${issCap(issWho(bot.g))} are significantly less likely than ${words.others} ${what} (${pct(bot)}).` };
  const [a, b] = gaps.filter((g) => sig.has(g)).map((g) => (g.a.c.v > g.b.c.v ? [g.a, g.b] : [g.b, g.a]))
    .sort((p, q) => (q[0].c.v - q[1].c.v) - (p[0].c.v - p[1].c.v))[0];
  return { gap: a.c.v - b.c.v,
    text: `${issCap(issWho(a.g))} are significantly more likely than ${issWho(b.g)} ${what} (${pct(a)} against ${pct(b)}).` };
}
/* The sentence under the chart: has any party gained or lost ground on the
   issue over the period on screen? Each pollster is compared only with
   itself (withinHouseSlope: a level per pollster, one shared slope, larger
   polls counting for more), since Ipsos and Resolve joined the three-way
   question only in June and July 2026 and a line can move just because one
   arrived. Holm across the three parties. */
function issTrendVerdict(D, it, dots) {
  if (!dots.length) return null;
  // the test's own start: its first poll from a pollster with two or more (withinHouseSlope drops a lone poll)
  const per = {};
  for (const d of dots) per[d.pollster] = (per[d.pollster] || 0) + 1;
  const ym = (dots.find((d) => per[d.pollster] >= 2) || dots[0]).date.slice(0, 7);
  const when = D.monthNameFull(+ym.slice(5)) + " " + ym.slice(0, 4);
  const what = ISS_PHRASE[it.id] || it.label.toLowerCase();
  const fits = D.issues.parties.map((q) => ({ q, fit: withinHouseSlope(dots.map((d) =>
    ({ h: d.pollster, t: d.x, w: d.n, y: d.s[q] }))) })).filter((f) => f.fit);
  if (!fits.length) return `There aren’t enough polls since ${when} to tell whether any party has gained ground on ${what}.`;
  const sig = [];
  for (const [i, f] of [...fits].sort((a, b) => a.fit.p - b.fit.p).entries()) {
    if (f.fit.p >= 0.05 / (fits.length - i)) break;
    sig.push(f);
  }
  if (!sig.length) return `No party’s share on ${what} has changed significantly since ${when}.`;
  const up = sig.filter((f) => f.fit.b > 0).map((f) => ISS_PARTY[f.q]);
  const down = sig.filter((f) => f.fit.b < 0).map((f) => ISS_PARTY[f.q]);
  const has = (xs) => (xs.length > 1 ? "have" : "has");
  return `Since ${when}, ` + [
    up.length ? `${houseList(up, Infinity)} ${has(up)} gained ground significantly on ${what}` : null,
    down.length ? `${houseList(down, Infinity)} ${has(down)} lost ground significantly` : null,
  ].filter(Boolean).join(", and ") + ".";
}
function IssuesPanel({ rangeId = "all" }) {
  const { D, rangeDomain, filterPts, buildXTicks, series } = window.AP;
  const narrow = useNarrow();
  /* the chart's box: beside the rows it gets their height, full width it is
     a main panel's 360 (a phone asks for a taller box, as every chart here
     does). 1136px of viewport is the 1080px of panel the CSS splits at –
     the panel runs the viewport's width less 56px, capped at 1144. */
  const beside = useNarrow("(min-width: 1136px)");
  const I = D.issues;
  const [view, setView] = useState("trust");
  const [selId, setSel] = useState(null);
  const [gsetId, setGset] = useState("vote");
  if (!I || !I.list || !I.list.length) return null;
  const P = I.parties;
  const list = I.list;
  const it = list.find((x) => x.id === selId) || list[0];
  const top = list[0];
  const pName = (q) => D.PARTIES[q].name;
  const pColor = (q) => D.PARTIES[q].color;
  const openInfo = () => window.AP.openTerm && window.AP.openTerm("issues", "The issues");

  // ---- who's trusted: the rows
  /* one party clearly ahead; or one clearly behind the two the polls can't
     separate; or no lead at all */
  const rowVerdict = (x) => !x.own ? null : x.own.leadSig
    ? { text: `${ISS_PARTY_CAP[x.own.lead]} ahead`, colors: [pColor(x.own.lead)],
        title: `${issCap(ISS_PARTY[x.own.lead])} leads ${ISS_PARTY[x.own.runner]} by ${x.own.gap.toFixed(1)} points (95% margin ± ${x.own.gapCi.toFixed(1)})` }
    : x.own.pairSig
    // shorter than naming the two ahead; the dots still mark those two
    ? { text: `${ISS_PARTY_CAP[x.own.third]} behind`,
        colors: [pColor(x.own.lead), pColor(x.own.runner)],
        title: `${issCap(ISS_PARTY[x.own.lead])} and ${ISS_PARTY[x.own.runner]} are ${x.own.gap.toFixed(1)} points apart, inside the 95% margin of ± ${x.own.gapCi.toFixed(1)}; ${ISS_PARTY[x.own.runner]} leads ${ISS_PARTY[x.own.third]} by ${x.own.gap2.toFixed(1)} (± ${x.own.gap2Ci.toFixed(1)})` }
    : { text: "No clear lead", colors: null,
        title: `${issCap(ISS_PARTY[x.own.lead])} and ${ISS_PARTY[x.own.runner]} are ${x.own.gap.toFixed(1)} points apart, inside the 95% margin of ± ${x.own.gapCi.toFixed(1)}` };
  const pick = (id) => setSel(id);
  const onRowKey = (e, id) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(id); } };
  const issueRow = (x) => {
    const v = rowVerdict(x), sel = x.id === it.id;
    return (
      <div key={x.id} className={"iss-row" + (sel ? " sel" : "")} role="button" tabIndex={0} aria-pressed={sel}
           onClick={() => pick(x.id)} onKeyDown={(e) => onRowKey(e, x.id)}
           aria-label={`${x.label}: ${x.imp ? Math.round(x.imp.v) + "% put it in their top three" : "not asked"}; ` +
             (x.own ? P.map((q) => `${pName(q)} ${Math.round(x.own.v[q])}`).join(", ") + "; " + v.text : "no three-way figures")}>
        <span className="iss-lab">{x.label}</span>
        <span className="iss-imp" title={x.imp ? `${Math.round(x.imp.v)}% put it in their top three (± ${x.imp.ci.toFixed(1)})`
          + (x.imp.gap && x.imp.by.length > 1 ? `. Latest polls: ${x.imp.by.map((b) => `${b.house} ${Math.round(b.v)}%`).join(", ")}` : "")
          + (x.imp.r1 != null ? `. ${Math.round(x.imp.r1)}% put it first at RedBridge` : "") : ""}>
          {/* the column heads hide on a phone, so each cell names itself there */}
          <span className="iss-mini" aria-hidden="true">In top three</span>
          {x.imp ? <>
            <span className="demo-track iss-imp-track" aria-hidden="true"><span className="demo-fill" style={{ width: x.imp.v + "%", background: "var(--ink-3)" }}></span></span>
            <span className="iss-imp-v">{Math.round(x.imp.v)}<span className="pct">%</span></span>
          </> : <span className="iss-na">not asked</span>}
        </span>
        <span className="iss-own">
          <span className="iss-mini" aria-hidden="true">Best on it</span>
          {x.own ? <>
            <span className="sbar iss-sbar" aria-hidden="true">
              {P.map((q) => <span key={q} className="sbar-seg" style={{ width: x.own.v[q] + "%", background: pColor(q) }}></span>)}
            </span>
            <span className="iss-nums" aria-hidden="true">
              {P.map((q) => (
                <span key={q} className="skey"><span className="skey-dot" style={{ background: pColor(q) }}></span>
                  <span className="skey-val">{Math.round(x.own.v[q])}</span></span>
              ))}
            </span>
          </> : <span className="iss-na">not asked with all three parties</span>}
        </span>
        <span className={"iss-verdict" + (v && v.colors ? " lead" : "")} title={v ? v.title : ""}>
          {v && v.colors && v.colors.map((c) => <span key={c} className="skey-dot" style={{ background: c }} aria-hidden="true"></span>)}
          {v ? v.text : ""}
        </span>
      </div>
    );
  };

  // ---- who's trusted: the chart for the chosen issue
  const [rangeLo, rangeHi] = rangeDomain(rangeId);
  const monthPts = (it.monthly || []).map((m) => ({ ym: m[0], x: D.mx(m[0]),
    ...Object.fromEntries(P.map((q, i) => [q, m[1 + i]])),
    ...Object.fromEntries(P.map((q, i) => ["ci_" + q, m[1 + P.length + i]])) }));
  const chart = (() => {
    if (monthPts.length < 1) return null;
    // the question was first asked in December 2025, so the chart opens there, as the vote-by-group charts do
    const xDomain = [Math.max(rangeLo, monthPts[0].x - 0.06), rangeHi];
    const inX = (x) => x >= xDomain[0] && x <= xDomain[1];
    const pts = filterPts(monthPts, xDomain[0]);
    const byRow = new Map(D.individualPolls.map((p) => [p.pollster + "|" + p.released, p]));
    const dots = (it.dots || []).filter((d) => inX(d[0])).map((d) => {
      const meta = byRow.get(d[1] + "|" + d[2]) || { pollster: demoHouse(d[1]), released: d[2] };
      return { x: d[0], pollster: d[1], date: d[2], n: meta.sample || 1000, meta,
               s: Object.fromEntries(P.map((q, i) => [q, d[3 + i]])) };
    });
    const scatter = dots.flatMap((d) => P.map((q) => ({ x: d.x, y: d.s[q], color: pColor(q), label: pName(q), meta: d.meta })));
    const areas = P.map((q) => ({ id: "ci-" + q, color: pColor(q), className: "ci-band", edge: false, smooth: true,
      points: pts.filter((d) => d["ci_" + q] != null).map((d) => ({ x: d.x, y0: d[q] - d["ci_" + q], y1: d[q] + d["ci_" + q] })) }))
      .filter((a) => a.points.length >= 2);
    const vals = pts.flatMap((d) => P.map((q) => d[q])).concat(scatter.map((d) => d.y),
      areas.flatMap((a) => a.points.flatMap((d) => [d.y0, d.y1])));
    if (!vals.length) return null;
    /* the first gridline past the data at each end (a tenth of a step clear),
       both labelled, as the vote-by-group charts do: fitDomain's padding left
       most of an empty step above the lines */
    const lo = Math.min(...vals), hi = Math.max(...vals), step = 10;
    const d0 = Math.max(0, Math.floor((lo - step * 0.1) / step) * step), d1 = Math.ceil((hi + step * 0.1) / step) * step;
    const ticks = [];
    for (let v = d0; v <= d1 + 1e-9; v += step) ticks.push(v);
    return { xDomain, pts, dots, scatter, areas, domain: [d0, d1], ticks };
  })();

  /* the issue the two pollsters' latest polls put furthest apart, said under
     the rows (a hover title reaches few readers) once it's more than
     sampling could make: five points */
  const wide = list.filter((x) => x.imp && x.imp.gap && x.imp.by.length === 2)
    .map((x) => { const [hi, lo] = [...x.imp.by].sort((a, b) => b.v - a.v); return { x, hi, lo, d: hi.v - lo.v }; })
    .sort((a, b) => b.d - a.d).find((w) => w.d >= 5);

  // ---- what matters to whom
  const G = I.groups;
  const gtab = G && (G.tabs.find((t) => t.id === gsetId) || G.tabs[0]);
  // the all-voters row is the group house's own reading, which its groups average to
  const allOf = (k) => (G && G.all && G.all[k]) || null;
  const gVerdicts = gtab ? gtab.issues.map((k) => issGroupVerdict(gtab, k)).filter(Boolean)
    .sort((a, b) => b.gap - a.gap).slice(0, 3) : [];

  /* the story: the issue most voters rank in their top three, and whether
     any party is clearly trusted with it */
  const phrase = top.imp && top.own && ISS_PHRASE[top.id];
  const bare = phrase && phrase.replace(/^the /, "");
  const issHead = phrase && bare[0].toUpperCase() + bare.slice(1)
    + " tops voters’ concerns" + (top.own.leadSig ? ", " + ISS_PARTY[top.own.lead] + " most trusted on it" : "");
  const issDek = phrase && plainShare(top.imp.v) + " voters put " + phrase
    + " among their three most important issues"
    + (top.own.leadSig ? `, and more of them trust ${ISS_PARTY[top.own.lead]} with it than either of the others.`
      : top.own && top.own.pairSig ? `, and ${ISS_PARTY[top.own.third]} is less trusted with it than either ${ISS_PARTY[top.own.lead]} or ${ISS_PARTY[top.own.runner]}.`
      : ", and no party is clearly more trusted with it than the others.");

  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2 className="card-title">The issues</h2>
          <p className="card-sub">
            {view === "trust"
              ? <Houses after={`What voters say matters most, and which party they think is best on it, pooled from the last ${I.window} of polls`}>{houseList(I.houses)}</Houses>
              : G ? <Houses after="Each group’s share putting an issue in its top three">{G.house}, its polls in the last {G.window}</Houses>
                : <>Each group’s share putting an issue in its top three – no poll in the window</>}
          </p>
        </div>
      </div>
      <div className="demo-ctl">
        <Segmented options={[{ id: "trust", label: "Who’s trusted" }, { id: "whom", label: "What matters to whom" }]}
                   value={view} onChange={setView} size="sm" ariaLabel="View" />
        {view === "whom" && G && (
          <Segmented options={G.tabs.map((t) => ({ id: t.id, label: t.label }))} value={gtab.id} onChange={setGset}
                     size="sm" ariaLabel="Group voters by" />
        )}
      </div>
      {view === "trust" && <Story head={issHead} dek={issDek} />}
      {view === "trust" ? (
        <div className="iss-body">
          <div className="iss-grid">
            <div className="iss-rows">
              <div className="iss-head" aria-hidden="true">
                <span className="iss-lab"></span>
                <span className="iss-imp">In voters’ top three</span>
                <span className="iss-own">Best on it
                  <span className="iss-legend">{P.map((q) => (
                    <span key={q} className="skey"><span className="skey-dot" style={{ background: pColor(q) }}></span>
                      <span className="skey-lab">{ISS_PARTY_CAP[q]}</span></span>
                  ))}</span>
                </span>
                <span className="iss-verdict"></span>
              </div>
              {/* on a phone the header is gone, so the legend stands on its own above the rows */}
              <p className="iss-legend iss-legend-solo" aria-hidden="true">Best on it:{" "}
                {P.map((q) => (
                  <span key={q} className="skey"><span className="skey-dot" style={{ background: pColor(q) }}></span>
                    <span className="skey-lab">{ISS_PARTY_CAP[q]}</span></span>
                ))}
              </p>
              {list.map(issueRow)}
              {wide && (
                <p className="table-hint iss-grn">
                  {wide.hi.house} and {wide.lo.house} word the question differently and disagree most
                  on {ISS_PHRASE[wide.x.id]}: {Math.round(wide.hi.v)}% in {wide.hi.house}’s latest poll,
                  {" "}{Math.round(wide.lo.v)}% in {wide.lo.house}’s. The grey bars sit midway between the two
                  pollsters’ usual figures.
                </p>
              )}
              {list.filter((x) => x.grnTop).map((x) => (
                <p key={"grn-" + x.id} className="table-hint iss-grn">
                  RedBridge also offers the Greens, who come first on {ISS_PHRASE[x.id]} ({x.grnTop.grn}%).
                </p>
              ))}
            </div>
            {chart && (
              <div className="iss-chart demo-chart">
                <p className="demo-chart-lab">
                  <span className="demo-chart-set">{it.label}</span>
                  Who voters think is best, month by month (%, of those naming Labor, the Coalition or One Nation)
                </p>
                <TrendChart
                  key={"iss-" + it.id}
                  height={narrow ? 560 : beside ? 460 : 360} xDomain={chart.xDomain} yDomain={chart.domain}
                  yTicks={chart.ticks} unit="%"
                  pad={{ l: narrow ? 70 : 56, r: 60, t: 16, b: narrow ? 66 : 56 }}
                  xTicks={buildXTicks(chart.xDomain[0], chart.xDomain[1])}
                  series={P.map((q) => ({ id: q, label: pName(q), color: pColor(q), points: series(chart.pts, q), endLabel: ISS_PARTY_CAP[q] }))}
                  areas={chart.areas}
                  spine={series(chart.pts, P[0])}
                  scatter={chart.scatter} pollFacet="primary"
                  tooltipTitle={(i) => window.AP.monthLabelFull(chart.pts[i].ym)}
                  fmt={(v) => Math.round(v) + ""}
                  ariaLabel={`${it.label}: the share of voters naming Labor, the Coalition or One Nation who think each is best on it, month by month`}
                  copy={{
                    sub: `${it.label}: who voters think is best, of those naming Labor, the Coalition or One Nation · pooled from ${houseList((it.own && it.own.houses) || I.houses)}`,
                    legend: [...P.map((q) => ({ label: `${pName(q)}  ${it.own ? Math.round(it.own.v[q]) + "%" : ""}`, color: pColor(q), kind: "line" })),
                             ...(chart.areas.length ? [{ label: "95% interval (shaded)", color: "var(--ink-faint)", kind: "shade" }] : [])],
                  }}
                />
                {demoSaid(issTrendVerdict(D, it, chart.dots))}
              </div>
            )}
            <div className="demo-notes iss-notes">
              <details className="view-how hint-how">
                <summary>How to read these figures</summary>
                <p className="table-hint">
                  The figures pool the last {I.window} of polls. Pick an issue to follow it in the chart.{" "}
                  <button type="button" className="hi-term" onClick={openInfo}>Where the figures come from</button>
                </p>
                <p className="table-hint">
                  The grey bar is how many voters put the issue among their three most important. RedBridge
                  and Ipsos both ask every month, in different words: RedBridge asks which issues matter most
                  to your vote, Ipsos which matter most for Australia. Their figures sit a steady distance
                  apart, so each poll is moved half that distance toward the other pollster before the two
                  are pooled.
                </p>
                <p className="table-hint">
                  The coloured bar splits the voters who named Labor, the Coalition or One Nation as best on the
                  issue. Pollsters also offer other answers – the Greens, someone else, all about equal, don’t
                  know – and each offers a different set, so only these three can be pooled. Resolve, RedBridge,
                  Ipsos, YouGov and DemosAU count wherever they ask the issue, each less its usual lean, as in
                  the headline figures.
                </p>
                <p className="table-hint">
                  “Ahead” means the leading party’s margin over the next is larger than that margin’s own 95%
                  range. “Behind” names the party clearly in third; its dots mark the two ahead of it, which the
                  polls can’t separate. “No clear lead” means the polls can’t separate them. In the chart each dot
                  is one poll and each line’s 95% interval is shaded.
                </p>
              </details>
            </div>
          </div>
        </div>
      ) : (
        <div className="iss-body">
          {gtab ? (
            <div className="iss-grid whom">
              <div className="iss-table-wrap">
                <table className="iss-table">
                  <caption className="sr-only">Share of each group putting each issue in its top three, %</caption>
                  <thead>
                    <tr>
                      <th scope="col"><span className="sr-only">Group</span></th>
                      {gtab.issues.map((k) => <th scope="col" key={k}><span>{ISS_SHORT[k] || I.labels[k]}</span></th>)}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="all">
                      <th scope="row">All voters</th>
                      {gtab.issues.map((k) => {
                        const x = allOf(k);
                        return <td key={k}>{x ? <IssCell v={x.v} ci={x.ci} all /> : "–"}</td>;
                      })}
                    </tr>
                    {gtab.groups.map((g) => (
                      <tr key={g}>
                        <th scope="row">{g}</th>
                        {gtab.issues.map((k) => {
                          const c = gtab.cells[g] && gtab.cells[g][k];
                          return <td key={k}>{c ? <IssCell v={c.v} ci={c.ci} /> : "–"}</td>;
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="iss-said">
                {gVerdicts.length ? gVerdicts.map((v, i) => <React.Fragment key={i}>{demoSaid(v.text)}</React.Fragment>)
                  : demoSaid(`No two ${gtab.id === "vote" ? "groups of voters" : "groups"} differ significantly on any of these issues.`)}
              </div>
              <div className="demo-notes iss-notes">
                <details className="view-how hint-how">
                  <summary>How to read these figures</summary>
                  <p className="table-hint">
                    Each figure is the share of that group putting the issue among its three most important. Only
                    RedBridge publishes these by group, so they rest on its polls in the last {G.window}. The
                    all-voters row is RedBridge’s own too, so it can differ from the grey bars under Who’s
                    trusted, which pool RedBridge with Ipsos.{" "}
                    <button type="button" className="hi-term" onClick={openInfo}>Where the figures come from</button>
                  </p>
                  <p className="table-hint">
                    The sentences name the clearest differences. Two groups differ significantly when the gap
                    between them is larger than its own 95% margin, which combines both groups’ margins; with
                    several groups the bar rises for each extra gap tested, as on the vote-by-group panel. A
                    group’s margin is usually 5 to 7 points, since a group is a slice of one poll. Hover or tap a
                    figure for its margin.
                  </p>
                </details>
              </div>
            </div>
          ) : <p className="table-hint">No poll in the last {I.window} published these figures by group.</p>}
        </div>
      )}
    </section>
  );
}
function IssCell({ v, ci, all }) {
  return (
    <span className={"iss-cell" + (all ? " all" : "")} title={ci != null ? `± ${ci.toFixed(1)} is the 95% margin` : ""}>
      <span className="iss-cell-v">{Math.round(v)}</span>
      <span className="iss-cell-bar" aria-hidden="true"><span style={{ width: Math.max(0, Math.min(100, v)) + "%" }}></span></span>
    </span>
  );
}

// ---- Latest polls – faceted, ragged-tolerant ledger ----------------
const PARTY_C = {
  alp: "var(--alp)", lnp: "var(--lnp)", grn: "var(--grn)",
  onp: "var(--onp)", oth: "var(--oth)", unc: "var(--line-2)",
};

// segment builders – each returns a list the ShareBar can render at ANY arity
// A poll may publish SEVERAL headline voting-intention figures – a
// conventional 2PP, a three-cornered preferred (ALP v L‑NP v ON), an
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
  // each One Nation head-to-head carries its OWN change vs the pollster's last
  // publication of that same matchup; ON moves opposite its opponent
  const mirror = (d) => (d ? { v: +(-d.v).toFixed(1), refDate: d.refDate } : null);
  const dAltAlp = segDelta(r.chg, "altAlpOn");
  const dAlt2Lnp = segDelta(r.chg, "altLnpOn");
  if (alp != null) out.push({ kind: "2pp", lab: "2PP · ALP v L/NP", flag: null, segs: [
    { label: "ALP", value: alp, color: PARTY_C.alp, delta: dAlp },
    { label: "L/NP", value: lnp, color: PARTY_C.lnp, delta: dLnp },
  ] });
  if (r.tppAlt) out.push({ kind: "alt", lab: "2PP · ALP v ON", flag: "+ALP v ON", segs: [
    { label: "ALP", value: r.tppAlt.alp, color: PARTY_C.alp, delta: dAltAlp },
    { label: "ON", value: r.tppAlt.onp, color: PARTY_C.onp, delta: mirror(dAltAlp) },
  ] });
  /* A three-cornered poll asks each pairing directly, so its headline reads
     as "ALP vs its strongest challenger", like every other detail: order the
     ALP match-ups by how well the challenger does. */
  if (r.tppKind === "3cp" && r.tpp3) out.sort((a, b) => a.segs[0].value - b.segs[0].value);
  if (r.tppAlt2) out.push({ kind: "alt2", lab: "2PP · L/NP v ON", flag: "+L/NP v ON", segs: [
    { label: "L/NP", value: r.tppAlt2.lnp, color: PARTY_C.lnp, delta: dAlt2Lnp },
    { label: "ON", value: r.tppAlt2.onp, color: PARTY_C.onp, delta: mirror(dAlt2Lnp) },
  ] });
  if (r.tppKind === "3cp" && r.tpp3) {
    out.push({ kind: "3cp", lab: "3-cornered · ALP v L/NP v ON", flag: "3-cornered", segs: [
      { label: "ALP", value: r.tpp3.alp, color: PARTY_C.alp },
      { label: "L/NP", value: r.tpp3.lnp, color: PARTY_C.lnp },
      { label: "ON", value: r.tpp3.onp, color: PARTY_C.onp },
    ] });
  }
  return out;
}
// flag text for the compact voting-intention cell ("+ALP v ON · 3-cornered")
function tppFlag(r) {
  const f = tppContests(r).map((c) => c.flag).filter(Boolean);
  return f.length ? f.join(" · ") : null;
}
/* Heading for the published group. It names the CATEGORY, never the
   measure – "Two-party preferred / Not published" once announced the very
   figure it was about to say was missing, and a single pair's own labels
   already say which matchup it is – and it says "as published" because the
   implied section beneath it is the page's reading of the same wave: the
   qualifier is what tells the two apart at a glance. (Takes the contest
   list for the archive's call shape; the heading no longer varies on it.) */
function tppHeading(cs) {
  return "After preferences (as published)";
}
/* The after-preferences section's line list: ONLY what the house printed –
   the contests tppContests builds, plus the HOUSE figure where a release
   carries one (Roy Morgan's and RedBridge's own implied pair at the 2025
   flows), spliced straight after the published pair as its alternative
   ("or … under 2025-election preference flows"), where the release itself
   puts it. The page's COMPUTED re-reads of the same primaries are NOT in
   this list: they are a different system from a figure the pollster
   published, and one flat list left a respondent-allocated pair
   indistinguishable from a re-read – impliedLines builds them for a section
   of their own. The house figure carries its own change vs the pollster's
   last figure of that kind ("flows"), the other side moving opposite,
   exactly as the canonical pair uses "alp2pp". */
function tppLines(cs, r) {
  const out = [];
  const dFlows = segDelta(r.chg, "flows");
  /* Essential's undecided never left the published pair, so the pair's own
     line names the share and its move; the first-preferences tail reports
     only shares that were set aside before the shares were reported. */
  const dUnd = r.undecidedBasis === "tpp" && r.undecided != null ? segDelta(r.chg, "und") : null;
  for (const c of cs) {
    /* No "respondent-allocated" caption any more. The house-pair alternative
       reads as an alternative to the line above it ("or … under
       2025-election preference flows"), which says what the first pair is
       BY CONTRAST - naming it as well repeated the same distinction twice,
       once under each half, and cost a caption line to do it. */
    let note = null;
    if (c.kind === "2pp" && r.undecidedBasis === "tpp" && r.undecided != null) {
      note = (
        <React.Fragment>
          {note && <React.Fragment>{note}, </React.Fragment>}
          undecided <b>{r.undecided}%</b> inside the pair
          <ChgParen d={dUnd} />
        </React.Fragment>
      );
    }
    out.push({ c, note });
    if (c.kind === "2pp" && r.tppFlows != null) out.push({ alt: true, note: (
      <>under 2025-election{" "}
        <button type="button" className="hi-term"
                onClick={() => window.AP.openTerm &&
                  window.AP.openTerm("preference-flows", "poll breakdown")}>preference flows</button></>
    ), c: {
      kind: "flows", lab: "2PP · ALP v L/NP", flag: null,
      segs: [
        { label: "ALP", value: r.tppFlows, color: PARTY_C.alp, delta: dFlows },
        { label: "L/NP", value: Math.round((100 - r.tppFlows) * 10) / 10, color: PARTY_C.lnp,
                          delta: dFlows ? { v: +(-dFlows.v).toFixed(1), refDate: dFlows.refDate } : null },
      ],
    } });
  }
  return out.map((x) => ({ ...x, count: out.length }));
}
/* The implied section's line list: the page's own re-reads of this wave's
   primaries – at the fixed 2025 table (the page's default basis) first,
   then through the ALP-v-ON first-principles set – for every
   implied-eligible wave. The section's own eyebrow says "implied 2PP" and
   carries the glossary link, so each line's note names only its flow
   basis, in the same words as the house figure's note above. Each reading
   carries its OWN change vs the pollster's last figure of that kind ("imp"
   for the classic, "impOn" for the ON re-read – an "imp" delta falls back
   to "flows" when a wave has only the house figure), the other side
   moving opposite. */
function impliedLines(r) {
  const out = [];
  const dImp = segDelta(r.chg, "imp") || segDelta(r.chg, "flows");
  const dOnImp = segDelta(r.chg, "impOn");
  if (r.alpImp != null) out.push({
    c: {
      kind: "flows", lab: "2PP · ALP v L/NP", flag: null,
      segs: [
        { label: "ALP", value: r.alpImp, color: PARTY_C.alp, delta: dImp },
        { label: "L/NP", value: Math.round((100 - r.alpImp) * 10) / 10, color: PARTY_C.lnp,
                          delta: dImp ? { v: +(-dImp.v).toFixed(1), refDate: dImp.refDate } : null },
      ],
    },
    note: (
      <>under 2025-election{" "}
        <button type="button" className="hi-term"
                onClick={() => window.AP.openTerm &&
                  window.AP.openTerm("preference-flows", "poll breakdown")}>preference flows</button></>
    ),
  });
  if (r.alpOnImp != null) out.push({
    c: {
      kind: "flows", lab: "2PP · ALP v ON", flag: null,
      segs: [
        { label: "ALP", value: r.alpOnImp, color: PARTY_C.alp, delta: dOnImp },
        { label: "ON", value: Math.round((100 - r.alpOnImp) * 10) / 10, color: PARTY_C.onp,
                          delta: dOnImp ? { v: +(-dOnImp.v).toFixed(1), refDate: dOnImp.refDate } : null },
      ],
    },
    note: (
      <>under the{" "}
        <button type="button" className="hi-term"
                onClick={() => window.AP.openTerm &&
                  window.AP.openTerm("fp-flows", "poll breakdown")}>first-principles flow set</button></>
    ),
  });
  return out.map((x) => ({ ...x, count: out.length }));
}
function primarySegs(r) {
  return [
    { label: "ALP", value: r.p.alp, color: PARTY_C.alp, delta: segDelta(r.chg, "pAlp") },
    { label: "L/NP", value: r.p.lnp, color: PARTY_C.lnp, delta: segDelta(r.chg, "pLnp") },
    { label: "GRN", value: r.p.grn, color: PARTY_C.grn, delta: segDelta(r.chg, "pGrn") },
    { label: "ON", value: r.p.onp, color: PARTY_C.onp, delta: segDelta(r.chg, "pOnp") },
    { label: "OTH", value: r.p.oth, color: PARTY_C.oth, muted: true, delta: segDelta(r.chg, "pOth") },
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
  if (c.unc != null) segs.push({ label: "Undecided", value: c.unc, resid: true });
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
    { label: "Unsure", value: unsure, resid: true },
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

/* The sub-line under the pollster's name linking the wave's APC methodology
   statement (YouGov's statement PDF, Newspoll's Pyxis statement page) – the
   methodology sibling of the release link the name itself carries. Only
   YouGov and Newspoll rows ever have one (extract-sampleeff.mjs stamps it). */
function MethodLink({ url }) {
  if (!url) return null;
  let host = "";
  try { host = new URL(url).hostname.replace(/^www\./, ""); } catch (e) { /* keep the link, drop the hint */ }
  return (
    <a className="pollster-method" href={url}
       target="_blank" rel="noopener noreferrer"
       onClick={(e) => e.stopPropagation()}
       title={host ? `Read the wave's APC methodology statement · ${host}` : "Read the wave's APC methodology statement"}>
      APC methodology<span className="plink-mark" aria-hidden="true">↗</span>
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
          <span key={i} className={"sbar-seg" + (s.resid ? " sbar-resid" : "")}
                style={{ width: (s.value / total * 100) + "%",
                         background: s.resid ? undefined : s.color }}></span>
        ))}
      </div>
      <div className="share-keys">
        {segs.map((s, i) => (
          <span key={i} className={"skey" + (s.muted || s.resid ? " muted" : "")}>
            <span className={"skey-dot" + (s.resid ? " resid" : "")}
                  style={s.resid ? undefined : { background: s.color }}></span>
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
  /* a true minus (U+2212), not a hyphen: these sit in tabular figures, where
     a hyphen is both too short and too high to read as a sign */
  return <span className={"netv " + (v >= 0 ? "pos" : "neg")}>
    {v > 0 ? "+" : ""}{String(v).replace("-", "\u2212")}</span>;
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
     one this pollster declined to state), so the ranges are shown as ranges
     and nothing more. The ranges also overlap and sum past the chamber. */
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
        <div className="seat-majline">
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
      <div className="seat-majline">
        <span className="seat-majlab">{majority} for majority</span>
        {lead.est < majority && (
          <span className="seat-hung">no party at a majority – {lead.name} short by {majority - lead.est}</span>
        )}
      </div>
      <p className="seat-basis">
        Modelled seat estimate with range · {sum} of {total} seats allocated
        {seats.basis ? ` · Change vs the ${seats.basis}, not this pollster’s previous poll` : ""}
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

/* ====================================================================
   THE BREAKDOWN – plain headed text lines
   Everything a poll published, set as sentences under short headings: one
   line per measure, figures in reading order, and the move on this house's
   last wave kept in a small parenthesis. No gutter, no margin column – the
   line itself is the content.

   Shared by BOTH poll tables – Latest polls and the All-polls archive – which
   is why it takes a row object rather than reaching for either one's state.
   ==================================================================== */

/* The move on this house's last wave as a parenthetical tail – "(▲1.5)".
   Null when the figure has no prior reading to move off, so a measure with
   no history simply ends. */
function ChgParen({ d }) {
  if (!d) return null;
  return <span className="pd-s-chg"> (<ChgTag v={d.v} refDate={d.refDate} />)</span>;
}

/* One headed section of the breakdown. With nothing to show it collapses to
   the heading and "Not published" rather than vanishing, because a missing
   section would leave the reader guessing whether the poll even asked. The
   `lead` flag is the vote-share section's figure-size step: the result is
   the headline, so its numerals read 2px up on the rest of the breakdown. */
function PdSec({ label, absent, lead, mid, children }) {
  const kids = React.Children.toArray(children).filter(Boolean);
  return (
    <section className={"pd-sec" + (lead ? " pd-sec-lead" : "") + (mid ? " pd-sec-mid" : "")}>
      <div className="pd-k">{label}</div>
      {kids.length ? kids : <p className="pd-absent">{absent || "Not published"}</p>}
    </section>
  );
}

/* One preference contest as a single sentence line. Two figures read as a
   head-to-head ("53% ALP vs 47% L/NP"), three run on with dashes. When the
   section holds more than one contest each line names its matchup first, so
   the reader never has to match a line to its pairing by position. An
   optional trailing note names the allocation basis where a second pair
   appears. */
function TppLine({ c, prefixed, note, hero, alt }) {
  const segs = c.segs.filter((x) => x.value != null);
  const mat = c.lab.replace(/^2PP · /, "").replace(/^3-cornered · /, "");
  return (
    <React.Fragment>
      <p className={"pd-s" + (hero ? " pd-s-hero" : "")}>
        {/* the matchup name is prose, not a figure/label pair – it keeps
            normal word-spacing (.pd-mat) so "ALP v L/NP" does not open up
            with the pairs after it */}
        {prefixed && <span className="pd-mat">{mat}: </span>}
        {/* an alternative reading of the pair above, so it takes a connector
            instead of repeating that pair's name */}
        {alt && <span className="pd-vs">or </span>}
        {segs.map((x, i) => (
          <React.Fragment key={i}>
            {i > 0 && (segs.length === 2
              ? <span className="pd-vs"> vs </span>
              : " · ")}
            <span className="pd-grp">
              <b>{x.value}%</b> <span className="pd-lab">{x.label}</span><ChgParen d={x.delta} />
            </span>
          </React.Fragment>
        ))}
      </p>
      {/* the basis is a caption to the pair, not a tail on it: a parenthesis
          trailing a display-size head-to-head pushed the answer onto two
          lines to make room for its own footnote */}
      {/* an alternative's caption stands under its own figures, not under the
          "or" that introduced them - the indent is .pd-s-basis-alt's ::before */}
      {note && <p className={"pd-s pd-s-basis" + (alt ? " pd-s-basis-alt" : "")}>{note}</p>}
    </React.Fragment>
  );
}

/* The poll's own pull on the figures a reader watches, as one ordinary row
   of the provenance band: "2PP aggregate effect   +0.2 for ALP vs L/NP; −0.4 for
   ALP vs ON. Respondent-allocated: +0.1 for ALP vs L/NP" - the party named
   the way every figure in the panel names it, not as "Labor" beside a
   column of ALP/L/NP/GRN/ON. One clause per aggregate the wave feeds: the
   implied 2PP wherever the wave's primaries support it – a paired wave's
   primaries still move the implied estimate, the headline's default basis –
   the respondent-allocated pair it sits beside when the wave printed one,
   Labor's modelled-flow head-to-head against One Nation on those same
   primaries, and the published version of that head-to-head where the wave
   asked it.
   lo/hi are gen-data's leave-one-out run (the `eff` payload): lo is the
   aggregate WITHOUT the wave, hi the standing aggregate with it; a wave
   outside the current window can't move those figures at all, so the row
   just says so instead of printing null moves. */
function EffLines({ eff }) {
  if (!eff || (!eff.lnp && !eff.imp && !eff.onp && !eff.onimp)) return null;
  /* signed like Poll lean and House effect in the rows above (% dropped –
     the row's verbs carry that it is points). A nil pull prints "+0.0", not
     "±0.0": the figure is a measured move that happened to round to
     nothing, and the ± glyph read as a range or an uncertainty */
  const signed = (e) => {
    const d = Math.round((e.hi - e.lo) * 10) / 10;
    return (d < 0 ? "−" : "+") + Math.abs(d).toFixed(1);
  };
  /* an implied figure carries no marker: implied 2PP is the page's basis,
     the figure the table shows, so it is the default reading here as it is
     everywhere else in the panel. The wave's published figures group behind
     one "Respondent-allocated:" lead-in at the end of the line instead of
     each dragging its own "(respondent-allocated)" tag around the pairing
     it repeats; one joins that group only while an implied figure of the
     same pairing holds its slot in the default group - published alone on
     its pairing, a figure just IS that pairing's clause and wears no
     label */
  /* when every clause is out of window, the whole row is just the note –
     its in-window wording, without the brackets and without the +0.0s. A
     mixed row keeps the note parenthesised on the out-of-window clause */
  const prim = eff.imp || eff.lnp || null;
  const shareOut = prim && [eff.imp, eff.lnp, eff.onimp, eff.onp]
    .filter(Boolean).every((e) => !e.w);
  /* A wave that has fallen out of the window still DID something on the day
     it landed, and "None." threw that away. gen-data re-runs the same
     leave-one-out at the poll's own publication day and files it as `t`, so
     the row can say what the wave was worth then instead of only that it is
     worth nothing now. Reading it means swapping lo/hi for that pair and
     forcing w, or the clause would also append its own "(outside …)" - the
     sentence already ends with the condition. `t` is absent where the wave
     cannot be estimated on its own day, and then "None." still stands. */
  const asThen = (e) => ({ ...e, lo: e.t.lo, hi: e.t.hi, w: 1 });
  /* the window as a NOUN PHRASE, so the two places that name it cannot drift
     apart: the standalone row leads with "None." because there the note IS
     the value - the wave has no figure to give - while a mixed row keeps it
     parenthesised after the clause it qualifies, where a full stop would
     read as the end of the sentence it sits inside. */
  const winSpan = (m) => `the aggregate\u2019s ${m ? "month" : "21-day window"}`;
  const clause = (e, who) => (
    <React.Fragment>
      {signed(e)} for ALP vs {who}
      {!e.w && <span className="pd-s-note"> (outside {winSpan(e.m)})</span>}
    </React.Fragment>
  );
  /* the w/t fan-out held in ONE pass so the two tenses below can't serve
     different clause sets; `t` is per-clause because the implied and
     classic runs answer each wave's own-day pull independently */
  const groups = (then) => {
    const pick = (e) => (e && (!then || e.t) ? (then ? asThen(e) : e) : null);
    /* the default group states each pairing exactly once - its implied
       figure where the wave's primaries support one, else the published
       one; the respondent group is only the published figures whose implied
       counterpart already sits in the default group */
    const def = [
      [pick(eff.imp) || pick(eff.lnp), "L/NP"],
      [pick(eff.onimp) || pick(eff.onp), "ON"],
    ].filter(([e]) => e);
    const resp = [
      [eff.imp && eff.lnp ? pick(eff.lnp) : null, "L/NP"],
      [eff.onimp && eff.onp ? pick(eff.onp) : null, "ON"],
    ].filter(([e]) => e);
    return { def, resp };
  };
  const list = (grp) => grp.map(([e, who], i) => (
    <React.Fragment key={who}>
      {i > 0 && <React.Fragment>; </React.Fragment>}
      {clause(e, who)}
    </React.Fragment>
  ));
  /* the two bases as two sentences: a full stop closes the default group's
     list rather than a semicolon claiming the published moves are more
     clauses of the same kind; the shared lead-in then names them once, in
     the tag's note styling */
  const byBasis = (then) => {
    const g = groups(then);
    return (
      <React.Fragment>
        {list(g.def)}
        {g.resp.length > 0 && (
          <React.Fragment>. <span className="pd-s-note">Respondent-allocated: </span>{list(g.resp)}
          </React.Fragment>
        )}
      </React.Fragment>
    );
  };
  return (
    <span className="pd-meta-i">
      {/* one label whatever the row carries: it lists implied AND published
          clauses side by side, so naming a basis in the label would claim
          the wrong thing for half of them */}
      <button type="button" className="pd-meta-k hi-term"
              onClick={() => window.AP.openTerm && window.AP.openTerm("aggregate-effect", "poll breakdown")}>2PP aggregate effect</button>
      <span className="pd-meta-v">
        {shareOut ? (prim.t ? (
          <React.Fragment>
            {byBasis(true)}
            <span className="pd-s-note">, when inside {winSpan(prim.m)}</span>
          </React.Fragment>
        ) : (
          <span className="pd-s-note">None. Outside {winSpan(prim.m)}</span>
        )) : (
          <React.Fragment>
            {byBasis(false)}
          </React.Fragment>
        )}
      </span>
    </span>
  );
}

/* A leader's ratings as one sentence: approve, disapprove, don't know, with
   the net and its move tacked on the end. A wave with both measures says the
   second as "also …" – same sample, different question, never blended. */
function ApprLine({ id, appr, chg }) {
  const s = appr[id], net = appr[id + "Net"];
  if (s == null && net == null) return null;
  const mt = (appr.metricBy && appr.metricBy[id]) || "approval";
  // the opposition slot is an office – label it by who held it when the poll
  // records that (Ley → Taylor, spliced February 2026)
  const label = id === "taylor" && appr.oppName ? appr.oppName : LEADER_META[id].label;
  const leg = mt === "fav" ? ["positive", "neutral", "negative"]
                           : ["approve", "don’t know", "disapprove"];
  const dk = s ? Math.max(0, 100 - s.app - s.dis) : 0;
  const d = chg && chg.d[id + "Net"] != null ? { v: chg.d[id + "Net"], refDate: chg.r[id + "Net"] } : null;
  const alt = appr.alt && appr.alt[id];
  return (
    <p className="pd-s">
      {label}:{s ? " " : <span className="pd-s-note"> no {leg[0]} / {leg[2]} split published,</span>}
      {s && (
        <React.Fragment>
          <span className="pd-grp"><b>{s.app}%</b> <span className="pd-lab">{leg[0]}</span></span>,{" "}
          <span className="pd-grp"><b>{s.dis}%</b> <span className="pd-lab">{leg[2]}</span></span>
          {dk > 0 && <React.Fragment>, <span className="pd-grp">
            <b>{dk}%</b> <span className="pd-lab">{leg[1]}</span></span></React.Fragment>}
        </React.Fragment>
      )}
      {net != null && (
        <React.Fragment>
          {/* comma only after split figures - the no-split note already ends
              with its own */}
          {s ? ", " : " "}
          <span className="pd-grp">
            <span className="pd-lab">net</span> <NetVal v={net} /><FavMark metric={mt} /><ChgParen d={d} />
          </span>
        </React.Fragment>
      )}
      {alt && (
        <span className="pd-s-note"
              title="This pollster asked both questions of this leader in the same wave – favourability (positive minus negative) is not directly comparable with approval">
          {" "}· also {alt.metric === "fav" ? "favourability" : "approval"} <NetVal v={alt.net} />
        </span>
      )}
    </p>
  );
}

/* "n = 1,510, n_eff = 1,053" – the sample the pollster reported and, where it
   published one in its APC methodology statement, what that sample is worth
   after its own weighting. Shared by both tables so the two bands cannot
   drift. n_eff is set as a true subscript rather than borrowed from the
   Unicode subscript block, which has no "f". */
function sampleValue(x) {
  return (
    <React.Fragment>
      {x.sample != null ? "n = " + x.sample.toLocaleString()
                        : (x.sampleEff == null ? "—" : null)}
      {x.sampleEff != null && (
        <span title="Effective sample as published by the pollster (APC methodology statement)">
          {x.sample != null && ", "}n<sub>eff</sub> = {x.sampleEff.toLocaleString()}
        </span>
      )}
    </React.Fragment>
  );
}

/* The pollster's own pages, as rows for the provenance band. Built here, in
   the file both tables share, but rendered INSIDE each table's own
   .pd-meta-items so they land in the same grid as fieldwork and sample - a
   second grid of their own could not keep its label column the same width as
   the band's, and the values stopped lining up.

   Where the citation in the row (`url`) is something else: the
   RedBridge/Accent waves cite their AFR write-up but publish the report on
   accent-research.com, and the Capital Brief-commissioned DemosAU waves cite
   the Capital Brief piece but publish their report PDF on demosau.com.

   "Here" takes a capital because it OPENS a value, like every other value in
   the band ("The Guardian", "26-31 Aug", "None. Outside..."); lower case read
   as a sentence fragment against them. The second link in a release row sits
   mid-sentence after "and", so it stays lower case. */
function releaseMetaRows(r) {
  const relRows = [];
  /* A PROVISIONAL row: the house's own extractor had not landed this wave,
     so the fallback agent filed it from Poll Bludger's poll-data feed
     (gen-data's mergedPolls). Second-hand figures – no release clock, the
     Independents/Other remainder combined – and it is replaced, not kept,
     when the house's release is captured. Said first, before the links,
     because it changes how every other value in the band should be read. */
  if (r.provisional) relRows.push(
    <span className="pd-meta-i" key="prov">
      <span className="pd-meta-k">Source</span>
      <span className="pd-meta-v">
        <a className="pd-release" href={r.provisionalUrl || r.url} target="_blank" rel="noopener noreferrer">
          {r.provisional}<span className="plink-mark" aria-hidden="true">↗</span>
        </a>
        <span className="pd-s-note">{r.provisionalScope === "leaders"
          ? " (provisional – the leader ratings are mirrored from its poll-data table until the pollster’s own release is captured; the voting figures are the house’s own)"
          : " (provisional – figures mirrored from its poll-data table until the pollster’s own release is captured)"}</span>
      </span>
    </span>
  );
  if (r.releaseUrl) relRows.push(
    <span className="pd-meta-i" key="rel">
      <span className="pd-meta-k">Pollster’s release</span>
      <span className="pd-meta-v">
        {/* houses with a rolling collection page (pollsterRules.releaseHub –
            Essential's Federal Political Insights) ride both addresses on the
            one row: the wave's own release first, then the collection every
            dated release files under */}
        <a className="pd-release" href={r.releaseUrl} target="_blank" rel="noopener noreferrer">
          Here<span className="plink-mark" aria-hidden="true">↗</span>
        </a>
        {r.releaseHub ? (
          <React.Fragment>
            <span className="pd-s-note">{" (wave-specific page), and "}</span>
            <a className="pd-release" href={r.releaseHub} target="_blank" rel="noopener noreferrer">
              here<span className="plink-mark" aria-hidden="true">↗</span>
            </a>
            <span className="pd-s-note">{" (general rolling collection)"}</span>
          </React.Fragment>
        ) : (
          /* DemosAU's released report IS its APC statement – one link does
             both jobs, so the separate statement row below sits out and the
             note here names the second role */
          r.releaseUrl === r.methodUrl &&
            <span className="pd-s-note">{" (includes the wave’s APC methodology statement)"}</span>
        )}
      </span>
    </span>
  );
  /* the wave's APC methodology statement, beside the release pointer it
     accompanies. Absent when the release pointer above already links the same
     document (releaseUrl === methodUrl). */
  if (r.methodUrl && r.methodUrl !== r.releaseUrl) relRows.push(
    <span className="pd-meta-i" key="apc">
      <button type="button" className="pd-meta-k hi-term"
              title="Australian Polling Council methodology statement"
              onClick={() => window.AP.openTerm && window.AP.openTerm("apc-statement", "poll breakdown")}>APC statement</button>
      <span className="pd-meta-v">
        <a className="pd-release" href={r.methodUrl} target="_blank" rel="noopener noreferrer">
          Here<span className="plink-mark" aria-hidden="true">↗</span>
        </a>
      </span>
    </span>
  );
  return relRows;
}

// the whole breakdown – EVERYTHING the poll measured, ragged set and all.
// `dirSegments` is passed in because the two tables build it from different
// shapes of the same reading.
function PollLedger({ r, dirSegments }) {
  const tcs = tppContests(r);
  const ppms = ppmContests(r);
  const appr = r.appr || {};
  const noAppr = appr.albNet == null && appr.taylorNet == null && appr.hansonNet == null;
  const tppRefs = tppLines(tcs, r);
  /* Consecutive unpublished sections collapse into one under a joined
     heading ("Preferred PM, Leader ratings") carrying a single "Not
     published" – the same verdict repeated under two headings in a row
     reads as padding, not information. Entry meaning: null = published
     (the section renders its own heading), "swallowed" = the absence
     above already covers this one, otherwise the joined heading this
     section opens. */
  const absLabels = [
    { label: tppHeading(tcs), absent: tppRefs.length === 0 },
    { label: "Preferred PM", absent: ppms.length === 0 },
    { label: apprHeading(appr), absent: noAppr },
  ].map((s, i, all) => {
    if (!s.absent) return null;
    if (i > 0 && all[i - 1].absent) return "swallowed";
    let label = s.label;
    for (let j = i + 1; j < all.length && all[j].absent; j++) label += ", " + all[j].label;
    return label;
  });
  return (
    <div className="pd-simple">

      <PdSec label="First preferences">
        <p className="pd-s">
          {/* largest recorded share first – a fresh array each call, so the
              in-place sort cannot disturb ArchPublished's fixed party order */}
          {primarySegs(r).sort((a, b) => b.value - a.value).map((x, i) => (
            <React.Fragment key={i}>
              {i > 0 && ", "}
              <span className={"pd-grp" + (x.muted ? " pd-s-note" : "")}>
                <span className="pd-lab">{x.label}</span> <b>{x.value}%</b><ChgParen d={x.delta} />
              </span>
            </React.Fragment>
          ))}
        </p>
        {/* the share the primaries have already set aside is the BASIS of the
            shares above, not one more of them – so it captions the line rather
            than running on from it. A share still inside the two-party pair is
            named on the pair's own line instead (tppLines): it is not missing
            from these shares */}
        {r.undecided != null && r.undecidedBasis !== "tpp" &&
          ((d) => (
            <p className="pd-s pd-s-basis">
              <b>{r.undecided}%</b> undecided,{" "}
              {r.undecidedBasis === "soft" ? "not firm" : "set aside"}
              <ChgParen d={d} />
            </p>
          ))(segDelta(r.chg, "und"))}
      </PdSec>

      {/* The page's re-reads of this wave's primaries are a different SYSTEM
          from a figure the pollster published, so they take a section of
          their own – one flat list left a respondent-allocated pair
          indistinguishable from a computed one – and it comes FIRST:
          implied 2PP is the page's basis, the figure every row of the table
          shows, so it is the answer the panel was opened for whatever the
          house printed, and the display size lives here on both re-reads
          (one computation on two tables, not an answer with a supporting
          reading, so one at display size over the other at body size
          ranked them for no reason). The eyebrow mirrors the published
          section's – "(implied)" / "(as published)" – and is itself the
          implied-2PP glossary link, so the lines' notes name only their
          flow basis. */}
      {(r.alpImp != null || r.alpOnImp != null) && (
        <PdSec label={
          <button type="button" className="hi-term"
                  onClick={() => window.AP.openTerm && window.AP.openTerm("implied-2pp", "poll breakdown")}>After preferences (implied)</button>
        } lead>
          {impliedLines(r).map((x, i) => (
            <TppLine key={"i" + i} c={x.c} prefixed={x.count > 1} note={x.note} hero />
          ))}
        </PdSec>
      )}

      {absLabels[0] !== "swallowed" && (
      <PdSec label={absLabels[0] ?? tppHeading(tcs)}>
        {/* name the main pair's basis only when the flows second line joins
            it – a single pair needs no disambiguation. The flows line itself
            is the same question with 2025's flows applied to these
            primaries, so it takes the main pair's exact format and sits
            straight after it, ahead of the ON head-to-heads */}
        {/* body size throughout: the display size belongs to the implied
            section above, the page's own basis, so the house's figures read
            as the record of what was printed rather than the answer */}
        {/* this section holds what the HOUSE printed and nothing else: the
            page's own re-reads of the primaries are the implied section
            above, so a wave that printed no pair at all reads "Not
            published" here (PdSec's fallback) rather than a computed pair
            standing in for one. The house's implied second pair (only Roy
            Morgan and RedBridge print one) remains spliced after the
            canonical pair inside tppLines. */}
        {tppRefs.map((x, i) => (
          <TppLine key={"t" + i} c={x.c} prefixed={x.count > 1 && !x.alt} note={x.note} alt={x.alt} />
        ))}
      </PdSec>
      )}

      {absLabels[1] !== "swallowed" && (
      <PdSec label={absLabels[1] ?? "Preferred PM"}>
        {ppms.map((c, i) => {
          const segs = ppmContestSegs(c, i === 0 ? r.chg : null);
          const cand = segs.filter((x) => !x.resid);
          const unc = segs.find((x) => x.resid);
          return (
            /* The undecided share closes the SAME line as the contest it is
               left over from, not a caption under it: unlike the two-party
               pair's undecided (which sits inside the pair and changes how it
               reads) this one is simply the rest of the same hundred, and a
               line of its own gave it more weight than a residual earns.
               Muted the way a non-party share is in first preferences - the
               figure keeps the section's ink, the word steps back. */
            <p className="pd-s" key={"p" + i}>
              {cand.map((x, j) => (
                <React.Fragment key={j}>
                  {j > 0 && <span className="pd-vs"> vs </span>}
                  <span className="pd-grp">
                    <b>{x.value}%</b> <span className="pd-lab">{x.label}</span><ChgParen d={x.delta} />
                  </span>
                </React.Fragment>
              ))}
              {unc && (
                <React.Fragment>
                  {", "}
                  <span className="pd-grp pd-s-note">
                    <b>{unc.value}%</b> <span className="pd-lab">undecided</span>
                  </span>
                </React.Fragment>
              )}
            </p>
          );
        })}
      </PdSec>
      )}

      {absLabels[2] !== "swallowed" && (
      <PdSec label={absLabels[2] ?? apprHeading(appr)}>
        {!noAppr && ["alb", "taylor", "hanson"].map((id) => (
          <ApprLine key={id} id={id} appr={appr} chg={r.chg} />
        ))}
      </PdSec>
      )}

      {/* the same head-to-head shape as the vote share, so it takes the same
          treatment one scale down (`mid`) rather than body figures */}
      {dirSegments && (
        <PdSec label="National direction" mid>
          <p className="pd-s">
            <span className="pd-grp">
              <b>{dirSegments[0].value}%</b> <span className="pd-lab">right direction</span>
              <ChgParen d={dirSegments[0].delta} />
            </span>
            <span className="pd-vs"> vs </span>
            <span className="pd-grp">
              <b>{dirSegments[2].value}%</b> <span className="pd-lab">wrong track</span>
              <ChgParen d={dirSegments[2].delta} />
            </span>
          </p>
          {/* the residual is what is LEFT of the two figures above, so it
              captions them at caption size – unlike the two-party pair's
              undecided, which sits inside the pair and changes how it reads */}
          {dirSegments[1].value != null &&
            <p className="pd-s pd-s-basis">({dirSegments[1].value}% unsure)</p>}
        </PdSec>
      )}

      {r.seats && (
        <PdSec label="Seat projection">
          <SeatProjection seats={r.seats} />
        </PdSec>
      )}

    </div>
  );
}

// full per-poll breakdown – shows EVERYTHING the poll measured, ragged set and all
function PollDetail({ r }) {
  return (
    <div className="poll-detail">
      {/* the fact line of the expanded view: fieldwork, published, sample
          and effective sample show at every width – fieldwork and sample
          repeat their row columns so the open panel stands alone, and the
          published stamp falls back to the fieldwork end (saying that it is
          so) where the release never recorded one */}
      <div className="pd-meta">
        <span className="pd-meta-items">
          <span className="pd-meta-i"><span className="pd-meta-k">Fieldwork</span>
            <span className="pd-meta-v">{r.field}</span></span>
          <span className="pd-meta-i"><span className="pd-meta-k">Published</span>
            <span className="pd-meta-v">
              {pubStamp(r.published, { year: true })
                || <span className="pd-est"
                         title="Publication date not recorded for this poll – showing the last day of fieldwork">
                     {r.releasedLabel}
                   </span>}
            </span>
          </span>
          {r.mode && <span className="pd-meta-i"><span className="pd-meta-k">Method</span>
            <span className="pd-meta-v">{r.mode}</span></span>}
          {/* one row, because they are one fact about the same sample: the
              raw count and what it is worth after weighting. A row of its own
              made the effective sample look like a separate measurement. */}
          <span className="pd-meta-i"><span className="pd-meta-k">Sample</span>
            <span className="pd-meta-v">{sampleValue(r)}</span></span>
          {releaseMetaRows(r)}
          {/* the wave's pull on the standing aggregates closes the band –
              last rows of the same grid as the provenance above */}
          {r.eff && <EffLines eff={r.eff} />}
        </span>
      </div>
      <PollLedger r={r} dirSegments={r.dir ? dirSegs(r) : null} />
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
/* DAY_MS, the NP_* schedule constants, easternNow, spreadDays and the
   projection itself live in assets/np-project.js (the plain layer, ahead of
   this bundle) – the one implementation the page, the sim and the health
   checks all run. Top-level consts of an earlier classic script are visible
   here; re-declaring any of them is a parse error for this whole script. */
const WD = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
/* The most rows one horizon can produce with the current field: four weekly
   Roy Morgans, two fortnightly YouGovs, and one standing slot each for the
   six houses on a monthly-or-looser rhythm (every house holds its next slot
   whatever the horizon – see np-project.js) – twelve on an ordinary day,
   plus slack for the weeks a 21- or 28-day house's NEXT slot also lands
   inside the horizon. A cap BELOW that spends the field's last row rather
   than the busiest house's fourth – RedBridge's one monthly slot was being
   cut while Roy Morgan's fourth weekly one kept its place. If a house joins
   or leaves, this number moves with it. */
const NP_MAX_ROWS = 14;
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
/* A span is only worth printing while the recorded times really do run
   across it. YouGov has filed at 5am and 6am and never between, so a "5-6
   am" band claims filings that have not happened; gen-data ships the exact
   filing times (releaseVals) when the record boils down to two or three
   anchors each observed at least twice, and the honest join is "or". Only
   where the times genuinely scatter inside the gap (Roy Morgan's
   afternoons) are there no anchors and the span itself prints. Essential
   has filed at 1am nine times and 4:36am once, and "1-4:36 am" would let a
   single late morning speak for a house that is otherwise punctual to the
   minute - so past two hours the usual time is stated instead, and the
   outlier is left to the ± on the day. Two hours rather than ninety
   minutes because gen-data now trims one sample off each end of the span
   before it gets here, so what arrives is the habit's own width:
   Newspoll's 7pm-9pm evening, once the single 7:11am is trimmed, is a real
   two-hour span and should print as one. */
const RELEASE_TIGHT_MINS = 120;
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
function releaseLabel(from, to, mid, vals) {
  if (from == null || to == null) return null;
  if (from === to) return clockLabel(from);
  /* "5 or 6 am", not "5–6 am": when every filing on record lands on one of
     two exact times, a dash between them claims the ones in between, and
     none have happened. The anchors are gen-data's clusters of the same
     observed samples the span is measured over, so this wins over both the
     span and the median the moment gen-data vouches for them. */
  if (vals && vals.length >= 2) {
    const ps = vals.map(clockParts);
    return ps.every((p) => p.ap === ps[0].ap)
      ? `${ps.slice(0, -1).map((p) => p.num).join(", ")} or ${ps[ps.length - 1].num} ${ps[0].ap}`
      : vals.slice(0, -1).map(clockLabel).join(", ") + ` or ${clockLabel(vals[vals.length - 1])}`;
  }
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
  const { rows, nowMs } = npProject();
  if (!rows.length) return null;

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

  rows.length = Math.min(rows.length, NP_MAX_ROWS);

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
  /* "Today" is the vaguest answer the column gives, and it is only vague
     where the hour is unknown. A house with a measured (or declared) release
     hour IS a moment today, so inside twelve hours of it the row counts the
     wait itself – "in 5 hours", minutes in the last hour – the same moment
     the date column already names. An untimed house has no hour to count to
     and keeps "today"; twelve hours plus out, so does everyone else. Matches
     the ticker's rule (d1a1d215) phrase for phrase. */
  const inHours = (r) => {
    if (r.inDays !== 0 || r.releaseMins == null) return null;
    const ms = r.release + r.releaseMins * 60000 - nowMs;
    if (ms <= 0 || Math.round(ms / 3600000) >= 12) return null;
    const mins = Math.max(1, Math.round(ms / 60000));
    if (mins < 60) return `in ${mins} min${mins === 1 ? "" : "s"}`;
    const h = Math.round(mins / 60);
    return `in ${h} hour${h === 1 ? "" : "s"}`;
  };
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
    /* A skip-rolled slot sits where the ±'s late side already reaches - the
       forecast's own alternative. Naming " (or +1 week)" past it doubles the
       one late step the record contains, and stepping back an early week
       would land on a date confirmed never filed. So a rolled slot names
       itself and nothing else. */
    if (r.rolled) return "";
    /* The tails are read off the SLOT (slotEarly/slotLate, rebased by the
       projection onto where the slot sits in the house's gap record), not
       off the median interval: Essential's record scatters ±3.5 days around
       a 31.5-day median, but its slot lands on the record's 28-day edge, so
       its only real alternative is the 35-day Wednesday a week late - the
       symmetric "± 1 week" named an early Wednesday the house never files. */
    const se = r.slotEarly != null ? r.slotEarly : r.spreadEarly;
    const sl = r.slotLate != null ? r.slotLate : r.spreadLate;
    if (r.releaseDow != null && se != null) {
      const widen = Math.sqrt(r.ahead + 1);
      const earlyW = Math.floor((se * widen + 3) / 7);
      const lateW = Math.floor((sl * widen + 3) / 7);
      if (earlyW === 0 && lateW >= 1) return ` (or ${fmt(r.release + lateW * 7 * DAY_MS)})`;
      if (lateW === 0 && earlyW >= 1) return ` (or ${fmt(r.release - earlyW * 7 * DAY_MS)})`;
    }
    return spreadLabel(r);
  };
  /* The when-column's own statement of the same one-sidedness pmLabel puts
     after the date: "in 12 days (or 19)" names the later slot in days, so a
     reader who screens off the countdown still sees the alternative. The
     main label carries the unit only once it does - "in N days" and "N days
     overdue" already say it, so the tail elides; "today" and "tomorrow"
     don't, and their tail must spell it out ("today (or 7 days)"). */
  const dayAlt = (r) => {
    if (r.rolled) return null;   // the slot IS the late step - see pmLabel
    const se = r.slotEarly != null ? r.slotEarly : r.spreadEarly;
    const sl = r.slotLate != null ? r.slotLate : r.spreadLate;
    if (r.releaseDow != null && se != null) {
      const widen = Math.sqrt(r.ahead + 1);
      const earlyW = Math.floor((se * widen + 3) / 7);
      const lateW = Math.floor((sl * widen + 3) / 7);
      if (earlyW === 0 && lateW >= 1)
        return ` (or ${r.inDays + lateW * 7}${r.inDays < 2 && r.inDays >= 0 ? " days" : ""})`;
      if (lateW === 0 && earlyW >= 1 && r.inDays - earlyW * 7 >= 1)
        return ` (or ${r.inDays - earlyW * 7})`;
    }
    return null;
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
          <button type="button" className="hi-term"
                  title="How these forecasts are made"
                  onClick={() => window.AP.openTerm &&
                    window.AP.openTerm("next-polls", "Next expected polls")}>
            Projected from each house’s recent publication intervals
          </button>{" · "}Open a row for the releases behind it
        </p>
      </div>

      <ol className="np-list">
        {rows.map((r) => {
          const key = r.pollster + "-" + r.release;
          const isOpen = open === key;
          const hour = releaseLabel(r.releaseFrom, r.releaseTo, r.releaseMid, r.releaseVals);
          const recent = r.recent || [];
          /* The two columns of an overdue row whose window is still open must
             answer with the SAME day. The when column counts to the window's
             far edge ("in 5 days (or 2 days ago)") and the list sorts by it,
             so the date column leads with that edge too and names the passed
             slot after "or". Leading with the slot instead - "Wed 26 Aug (or
             Wed 2 Sep)  in 5 days (or 2 days ago)" - paired each date with
             the other's countdown, and read as if the poll were due on a day
             already gone. The slot itself is not rolled forward: it stays on
             the row, in the "or", and nothing projects from it (see above). */
          const winOpen = !r.loose && r.overdue && !r.missed;
          const edge = r.release + r.winHalf * DAY_MS;
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
                : <>{fmt(winOpen ? edge : r.release)}
                    {/* the hour qualifies the DAY, so it sits with it rather
                        than in the cadence column with the rhythm - and it
                        carries the clock it is read on, since AEST and AEDT
                        are an hour apart and "8 pm" alone names both */}
                    {hour && <span className="np-time">, {zoned(hour, winOpen ? edge : r.release)}</span>}
                    {/* A zero-half-width window's far edge IS the slot, so the
                        "or" would rename the day it qualifies - Roy Morgan's
                        unbroken weekly run read "Mon 7 Sep (or Mon 7 Sep)".
                        No alternative exists to name, so name none. */}
                    <span className="np-pm">{winOpen ? (edge !== r.release ? ` (or ${fmt(r.release)})` : "") : pmLabel(r)}</span></>}
            </span>
            {/* the column answers "when", so a window answers it too – with the
                day it opens, which is the first date the wave is possible. An
                overdue row whose window is still OPEN answers with its far edge
                plus when the slot itself fell – the red is reserved for a wave
                that can no longer land inside its own span */}
            <span className={"np-when" + (r.missed ? " np-missed" : "")}>
              {r.loose
                /* A window reads as open right up to its far edge; past it
                   the wave is late, counted from that edge - the day the
                   last of the room the span claimed ran out. */
                ? (r.missed ? when(r.closesIn)
                  : r.opensIn <= 0 ? "open now" : "opens " + when(r.opensIn))
                /* The "(or …)" alternative is its own span, not part of the
                   count's text run, so the ≤720px rung can drop it to a line
                   under the count (.np-when-or in template.html) while the
                   wide layout still sets it inline after it. */
                : r.overdue && !r.missed
                  ? <>{when(r.closesIn)}<span className="np-when-or">{` (or ${ago(-r.inDays)})`}</span></>
                  : <>{inHours(r) || when(r.inDays)}{dayAlt(r) && <span className="np-when-or">{dayAlt(r)}</span>}</>}
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
                  {/* a month-end house's ± belongs to the month-end rule, not
                      to the median, and is told with the rule below */}
                  {r.monthEnd ? ""
                    : r.spreadEarly != null && r.spreadEarly !== r.spreadLate
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
                  {r.releaseDow != null && !r.monthEnd &&
                    ` Nudged onto ${WD[r.releaseDow]}${hour ? `, when it files at ${zoned(hour, r.release)}` : ""}.`}
                  {/* the month-end rule steps month-end to month-end, so the
                      interval above is context, not the projection */}
                  {r.monthEnd &&
                    ` Projected onto the ${WD[r.releaseDow]} nearest the month’s last day${hour ? `, when it files at ${zoned(hour, r.release)}` : ""} – the day it has published on in ${r.monthEndKept} of its last ${r.monthEndN} releases.`}
                  {r.releaseDow == null && hour && ` It files at ${zoned(hour, r.release)}.`}
                  {(r.declared || []).length > 0 &&
                    ` The ${houseList(r.declared, Infinity)} ${r.declared.length > 1 ? "are" : "is"} stated from ${r.pollster}’s own schedule rather than measured.`}
                  {/* the slot this rhythm names falls in the summer break, so
                      the row is the resumption window instead (npInSummer) */}
                  {r.summer &&
                    ` That puts the next one in the summer break. No federal poll has been published between 23 December and 8 January, and last summer the pollsters came back anywhere from 9 January to 1 February, so that range is the window.`}
                </p>
              </div>
            )}
          </li>
          );
        })}
      </ol>
    </section>
  );
}

/* The hero's matchup ids and the tables' lead measures name the same
   contests; this is the one bridge between the two vocabularies, so the
   Latest table (here) and the archive (d1a1d215) can both follow the page's
   matchup – and both open on latest.rivalLead, the rival Labor is doing
   worst against. Unknown or missing → the classic pair. */
window.AP.measureOfMatchup = (id) => ({ alp_lnp: "lnp", alp_on: "onp", lnp_on: "lnponp" })[id] || "lnp";
const LEAD_LABEL = { lnp: "ALP v L/NP", onp: "ALP v ON", lnponp: "L/NP v ON" };

function PollsterTable({ tppBasis, setTppBasis, tppMatchup, setTppMatchup }) {
  const { D } = window.AP;
  // ledger look shared with the All-polls archive – its cell renderers are
  // defined in the archive script and arrive on window once both assets load
  const { ArchTpp, ArchLead, ArchApprCell, archLeadInfo } = window;
  /* the lead column follows the hero's matchup (the same App state the
     Switch-2PP pills drive), so the table shows the contest the page is
     showing – and the column head flips it, the way the 2PP head flips the
     basis. The table was ALP v L/NP whatever the hero said, which read as
     the Coalition being the contest even in months One Nation was. */
  const measure = window.AP.measureOfMatchup(tppMatchup);
  const flipMatchup = () => setTppMatchup && setTppMatchup(tppMatchup === "alp_on" ? "alp_lnp" : "alp_on");
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
        const li = archLeadInfo(r, measure, tppBasis);
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

  // range by when polls came OUT, matching the Published column - `released`
  // (fieldwork end) lags publication by a day for next-day houses (Roy Morgan)
  const newest = [...D.pollsterTable].sort((a, b) => b.pubSort.localeCompare(a.pubSort));
  const fmtWin = (iso) => {
    const [, m, d] = iso.slice(0, 10).split("-").map(Number);
    return `${d} ${D.monthNameFull(m)}`;
  };
  const windowLabel = `${fmtWin(newest[newest.length - 1].pubSort)}\u2013${fmtWin(newest[0].pubSort)}`;

  const FACETS = [
    { id: "twopp", label: "2PP" },
    { id: "primary", label: "Primary" },
    { id: "leadership", label: "Leadership" },
  ];

  /* Party columns rank by the aggregate (gen-data's latest.primaryOrder –
     highest leftmost, a party only overtaking once it leads by a full point,
     same deadband rule as the hero's rival ruling). Presentation travels
     with the column, so everything keys off party id. The archive renderer
     carries a copy of this def map – the two move together. */
  const pOrder = (D.latest && D.latest.primaryOrder) || ["alp", "lnp", "grn", "onp", "oth"];
  const PCOLS = {
    alp: { label: "ALP", k: "p.alp", style: { color: "var(--alp-text)", fontWeight: 600 } },
    lnp: { label: "L/NP", k: "p.lnp", style: { color: "var(--lnp-text)", fontWeight: 600 } },
    // GRN is the primary facet's .hide-sm tier: it goes at ≤430px, and the
    // row detail still carries the figure one tap away
    grn: { label: "GRN", k: "p.grn", cls: " hide-sm", style: { color: "var(--grn-text)" } },
    onp: { label: "ON", k: "p.onp", style: { color: "var(--onp-text)" } },
    oth: { label: "OTH", cls: " muted hide-md" },   // the residual stays non-sortable
  };

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
              {/* "Published" is the widest header in the base set - on
                  narrow screens the column is header-bound, ~30px wider
                  than any date it prints. "Pub" lets the data set the
                  width; the full word survives as the header's tooltip. */}
              <SortTh label="Published" short="Pub" sortKey="pubSort" sort={sort} onSort={onSort} className="ta-l" />
              <SortTh label="Fieldwork" short="Field" sortKey="released" sort={sort} onSort={onSort} className="ta-l" />
              <SortTh label="Sample" sortKey="sample" sort={sort} onSort={onSort} className="hide-md" />

              {facet === "twopp" && (<>
                {/* the 2PP column head is the basis switch – names the ACTIVE
                    basis like the hero's toggle, flips the whole page to the
                    other one (same App state the hero toggle drives) */}
                <th scope="col" className="ta-l apub-col hide-md">
                  <button type="button" className="th-basis" onClick={() => setTppBasis(tppBasis === "imp" ? "resp" : "imp")}
                          title={tppBasis === "resp"
                            ? "Each poll's headline figures exactly as the pollster released them – click to switch to implied 2PP at the 2025 election's preference flows"
                            : "Each poll's primaries read at the 2025 election's preference flows – one fixed table, so the column compares house to house; the wave's own published 2PP sits in its breakdown. Click to switch to the published figures"}>
                    {tppBasis === "resp" ? "As published" : <>Implied 2PP{" "}<span className="th-basis-def">(default)</span></>}
                    <span className="th-basis-swap" aria-hidden="true">⇄</span>
                  </button>
                </th>
                {/* the lead head sorts like any other, and its matchup name is
                    the MATCHUP switch: it names the contest the column (and
                    the hero) is on and flips the page to the other Labor
                    contest, the way the 2PP head flips the basis. The button
                    swallows its click so a flip doesn't also re-sort. */}
                {((active) => (
                  <th scope="col" className={"num sortable" + (active ? " sorted" : "")}
                      onClick={() => onSort("alp")} tabIndex={0}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSort("alp"); } }}
                      aria-sort={active ? (sort.dir < 0 ? "descending" : "ascending") : "none"}>
                    <span className="th-in">
                      <span className="lbl-l">Lead ·</span><span className="lbl-s">Lead</span>
                      <button type="button" className="th-basis lbl-l"
                              onClick={(e) => { e.stopPropagation(); flipMatchup(); }}
                              onKeyDown={(e) => e.stopPropagation()}
                              title={measure === "onp"
                                ? "Labor's lead over One Nation on each poll – click to switch the page to ALP v L/NP"
                                : "Labor's lead over the Coalition on each poll – click to switch the page to ALP v One Nation"}>
                        {LEAD_LABEL[measure]}
                        <span className="th-basis-swap" aria-hidden="true">⇄</span>
                      </button>
                      <span className="caret" aria-hidden="true">{active ? (sort.dir < 0 ? "▾" : "▴") : "⇅"}</span>
                    </span>
                  </th>
                ))(sort.key === "alp")}
              </>)}
              {facet === "primary" && pOrder.map((id) => {
                const c = PCOLS[id];
                return c.k
                  ? <SortTh key={id} label={c.label} sortKey={c.k} sort={sort} onSort={onSort} className={c.cls ? c.cls.trim() : undefined} />
                  : <th key={id} scope="col" className={(c.cls || " hide-md").trim()}>{c.label}</th>;
              })}
              {facet === "leadership" && (<>
                <SortTh label="Preferred PM" sortKey="ppm.alb" sort={sort} onSort={onSort} className="ta-l two-pp-col hide-md" />
                <SortTh label="Alb net" short="Alb" sortKey="appr.albNet" sort={sort} onSort={onSort} />
                {/* the office, not the name – the column outlives any one
                    opposition leader (matches the archive) */}
                <SortTh label="Opp. ldr net" short="Opp" sortKey="appr.taylorNet" sort={sort} onSort={onSort} />
                {/* leadership's shed at hide-sm width: Hanson net is dashes
                    for YouGov, Newspoll, Roy Morgan and Essential - the
                    fewest real figures of the three net columns - and the
                    row detail carries it one tap away like everything else
                    the tier drops */}
                <SortTh label="Hanson net" short="Han" sortKey="appr.hansonNet" sort={sort} onSort={onSort} className="hide-sm" />
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
                      {/* filed from Poll Bludger's feed while the house's own
                          release is still uncaptured – the expanded row says
                          what that means */}
                      {r.provisional && <span className="pollster-mode provisional-tag"
                                              title={"Provisional: " + (r.provisionalScope === "leaders" ? "leader ratings" : "figures") + " mirrored from " + r.provisional + " until the pollster’s own release is captured"}>provisional</span>}
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
                      <td className="ta-l apub-col hide-md"><ArchTpp p={r} basis={tppBasis} measure={measure} /></td>
                      {/* a poll with no after-prefs figure on the table's basis
                          still has something to say in this facet – the
                          fallback prints its ALP v L/NP primary margin,
                          flagged as primary */}
                      <td className="num"><ArchLead p={r} measure={measure} primaryFallback basis={tppBasis} /></td>
                    </>)}
                    {facet === "primary" && pOrder.map((id) => (
                      <td key={id} className={"num" + (PCOLS[id].cls || "")} style={PCOLS[id].style}>
                        {r.p[id] != null ? r.p[id].toFixed(1) : "—"}
                      </td>
                    ))}
                    {facet === "leadership" && (<>
                      <td className="two-pp-col share-col hide-md">
                        {ppmContests(r).length === 0
                          ? <span className="dash" title="No preferred-PM question this wave">—</span>
                          : <ShareBar segs={ppmContestSegs(ppmContests(r)[0])} compact flag={ppmFlag(ppmContests(r))} />}
                      </td>
                      <td className="num"><ArchApprCell s={r.appr.alb} net={r.appr.albNet} metric={r.appr.metricBy && r.appr.metricBy.alb} /></td>
                      <td className="num"><ArchApprCell s={r.appr.taylor} net={r.appr.taylorNet} metric={r.appr.metricBy && r.appr.metricBy.taylor} /></td>
                      <td className="num hide-sm"><ArchApprCell s={r.appr.hanson} net={r.appr.hansonNet} metric={r.appr.metricBy && r.appr.metricBy.hanson} /></td>
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
      {(() => { const act = typeof CANT_HOVER !== "undefined" && CANT_HOVER ? "Tap" : "Click";
        return (<>
          <p className="table-hint">
            Tap any poll to see its full breakdown · {act} a column heading to sort.
          </p>
          {/* The basis switch is the 2PP column's heading, and that column is
              .hide-md: below 1000px the sentence points at the hero's own
              toggle instead of a heading the reader can't see. */}
          <HowTo label="How to read this table" paras={[
            <>“—” means the pollster didn’t ask that question.</>,
            <>{tppBasis === "resp"
              ? "“As published” lists each poll’s headline figures exactly as the pollster released them, and the lead bar draws the published margin out from a tie line at its centre."
              : "“Implied 2PP” reads the poll’s primaries at the 2025 election’s preference flows, and the lead bar draws that margin out from a tie line at its centre."}
            <span className="hint-wide">{tppBasis === "resp"
              ? ` ${act} the “As published” heading to switch back to implied.`
              : ` ${act} the “Implied 2PP” heading to switch to the pollsters’ own published figures.`}</span>
            <span className="hint-narrow">{tppBasis === "resp"
              ? " The switch above the headline figure flips back to implied."
              : " The switch above the headline figure flips to the pollsters’ own published figures."}</span></>,
            <><strong>Published</strong> is the day the poll was released, taken from the source each
            row links to. Each house’s systematic lean – its house effect – sits beside poll lean in
            the All polls archive.</>,
          ]} />
        </>); })()}
    </section>
  );
}

Object.assign(window, { Segmented, TextToggle, Delta, HowTo, SortTh, fitDomain, PrimaryVotePanel, PreferredPMPanel, ApprovalPanel, DirectionPanel, UndecidedPanel, OnSourcesPanel, DemographicsPanel, PollsterTable, NextPollsPanel,
  // shared facet/render helpers reused by the All-polls archive table
  ShareBar, NetVal, FavMark, ChgTag, apprHeading, SeatProjection, tppContests, tppFlag, tppHeading, primarySegs, dirSegs, ppmContests, ppmMatch, ppmContestSegs, ppmLabel, ppmKind, ppmFlag, LEADER_META, PPM_ORDER, PARTY_C,
  PollLedger, PdSec, TppLine, ApprLine, ChgParen, releaseMetaRows, EffLines, sampleValue,
  // the archive prints publication stamps too, and there is only one way to
  // write one
  pubStamp });
