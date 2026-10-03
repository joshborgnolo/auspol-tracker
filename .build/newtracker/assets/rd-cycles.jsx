/* auspol tracker – the redesign's Past cycles tab (Sep 2026).

   PastCyclesView keeps every piece of its state - the board, the drawn
   terms, level or change, the URL - and CycleChart keeps the pooling and
   the lines; this lays the tab out as a reading page: one comparison chosen
   once at the top, a summary of all six measures sixteen months in, then a
   section per question, each with its finding as a headline. */

const RD_CYC_TITLE = {
  tpp: "The government’s two-party share, %, by months since its election",
  primary: "Government’s primary vote, %",
  oppr: "Opposition’s primary vote, %",
  net: "Prime minister’s net approval: approve minus disapprove, points",
  ppmm: "PM’s lead, points",
  oppnet: "Net approval, points",
};
const RD_CYC_TITLE_CHG = {
  tpp: "The government’s two-party share, change since its election, points",
  primary: "Government’s primary vote, change since the election",
  oppr: "Opposition’s primary vote, change since the election",
  net: "Prime minister’s net approval, change since the first reading",
  ppmm: "PM’s lead, change since the first reading",
  oppnet: "Opposition leader’s net approval, change since the first reading",
};
/* the value a key stood for until it last changed, kept while a switch plays
   out (`ms`) so the old version can be drawn going out beside the new */
function rdUseOutgoing(k, value, ms = (window.AP && window.AP.MORPH_MS || 320) + 40) {
  const cur = React.useRef({ k, value }), out = React.useRef(null), timer = React.useRef(0);
  const [, force] = React.useReducer((x) => x + 1, 0);
  if (cur.current.k !== k) {
    const still = window.AP && window.AP.reduceMotion && window.AP.reduceMotion();
    out.current = still ? null : { k: cur.current.k, value: cur.current.value, id: (out.current ? out.current.id : 0) + 1 };
  }
  cur.current = { k, value };
  React.useEffect(() => {
    const o = out.current;
    if (!o || o.timed) return;
    o.timed = true;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { if (out.current === o) { out.current = null; force(); } }, ms);
  });
  React.useEffect(() => () => clearTimeout(timer.current), []);
  return out.current;
}
const rdOrd = (n) => n + (n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th");
const rdSgn = (v, unit) => (unit ? "" : v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(1);

/* The dotted stroke of a term's lead-in run from its election-day anchor to
   its first poll, and of the lead-out run from a past term's last poll to
   the ring of the election that closed it - interpolation out of (or up to)
   a counted result, not a month nobody polled. Same stroke the by-state
   panels use to bridge an election mark to the first polled month
   (RD_ELECTION_LEAD), so the two reference-line kinds read the same way
   wherever they appear. */
const RD_CYC_LEAD = "0.5 4";

/* ---- one chart, in the redesign's frame --------------------------------- */
function RdCycleChart({ M, chg, built, bandAreas, bandRows, scatter, events: evIn, badged, domain, ticks, cur, hidden, liftedN, narrow, half,
                        hanCtl, showHan, setHan, showOnp, setOnp, showComb, setComb, tipCycle, banded, bandN, isOpp, terms, outcomeShown, rings,
                        evtOut, onEvtOut }) {
  const { D } = window.AP;
  /* the sitting term's change of contest, said as the headline says it */
  const events = evIn.map((e) => (/^Now v /.test(e.short || "")
    ? { ...e, short: e.short.replace(/^Now /, "") + " from " + D.monthNameFull(Number(e.date.slice(5, 7))) } : e));
  const nowM = cur && !hidden.has(cur.year) ? cur.span : null;
  const curVal = nowM != null ? (chg ? cur.end[M.key] - cycBase(cur, M.key) : cur.end[M.key]) : null;
  /* anything but the default picture (only the sitting term over the band)
     drops the "ahead" pair and the above/below-average reading - the words
     read as a verdict on the contest, which a mixed view is not */
  const nonDefault = (liftedN || 0) > 0 || (cur ? hidden.has(cur.year) : false);
  const peer = nowM != null ? bandRows.find((r) => r.m === nowM) : null;
  const subj = M.key === "net" || M.key === "ppmm" ? sitting(cur ? cur.pm : "")
    : M.key === "oppnet" ? sitting(cur ? cur.oppLead : "")
    : cur ? (isOpp ? D.PARTIES[cur.opp].name : D.PARTIES[cur.gov].name) : "";
  const subjColor = cur ? (isOpp ? D.PARTIES[cur.opp].color : cur.color) : "var(--ink)";
  const fmt = (v) => (M.unit === "%" && !chg ? v.toFixed(1) : rdSgn(v, false));
  /* the series, in the redesign's weights and words */
  const series = built.map((s) => {
    if (s.id === "cyc-band-mean") return { ...s, label: "Past-term average", dash: "4 3", rdWidth: 1.5, endLabel: "Average", endLabelOpacity: 1 };
    /* the election-to-first-poll lead-in: dotted, never solid, and ahead of
       the current-term branch so this term's own lead dots too. The stroke
       is what changes - the run still rides its line's colour, weight and
       opacity, fades in and out with it, and keeps the line's tooltip. */
    if (s.lead) return { ...s, dash: RD_CYC_LEAD };
    /* the lead's mirror at the other end of a past term: the dotted run
       from the term's final poll to the closing election's ring. Same
       stroke, same rule - the colour, weight and opacity stay the line's. */
    if (s.tail) return { ...s, dash: RD_CYC_LEAD };
    if (s.current) return { ...s, rdWidth: 3, rdCap: 4, endLabel: null };
    /* The "this term" overlays (One Nation's primary vote, the combined
       L/NP+One Nation sum, Hanson's rating) are the old design's thin
       dotted and dashed lines. At the redesign's weights they drew as
       specks, and a half-width chart drops end labels, so ticking the box
       seemed to do nothing - on the chart where One Nation now polls above
       the opposition the overlays land. Here each is a plain 2px line in
       its own colour, curved like every other line, and named at its end
       by a note (overlayNotes, below). */
    if (s.id === "cyc-onp" || s.id === "cyc-comb" || s.id === "cyc-han")
      return { ...s, smooth: undefined, dash: null, dashed: false, rdWidth: 2, endLabel: null,
               opacity: s.opacity != null && s.opacity < 0.5 ? s.opacity : 1 };
    if (s.endLabel && s.label) return { ...s, rdWidth: s.width >= 3 ? 2.2 : 1.4, endLabel: half ? null : s.label.replace(", ", " ") };
    return s;
  });
  /* The window fits what this chart draws - the band, the lines, the dots -
     rather than every term that ever held the measure, so the band is not
     a thin stripe across a mostly empty plot. It re-fits when a line is
     drawn over the band, which is the moment a wider window is needed. */
  const refY0 = chg ? 0 : M.refAbs;
  const fit = (() => {
    const vals = [];
    (banded ? bandRows : []).forEach((r) => vals.push(r.p10, r.p90));
    series.forEach((s) => s.points.forEach((q) => { if (q.y != null) vals.push(q.y); }));
    scatter.forEach((q) => vals.push(q.y));
    if (refY0 != null) vals.push(refY0);
    if (!vals.length) return { domain, ticks };
    const mn = Math.min(...vals), mx = Math.max(...vals);
    let step = M.step, lo, hi;
    for (;;) {
      lo = Math.floor((mn + step * 0.05) / step) * step;
      hi = Math.ceil((mx - step * 0.05) / step) * step;
      if (hi - lo >= step && (hi - lo) / step <= 6) break;
      if ((hi - lo) / step > 6) step *= 2; else break;
    }
    return { domain: [lo, hi], ticks: rdYTicks(lo, hi, step) };
  })();
  domain = fit.domain; ticks = fit.ticks;
  const d = peer && curVal != null ? curVal - peer.mean : null;
  const notes = [];
  if (peer && curVal != null) {
    /* the words sit on whichever side of the point has room */
    const frac = (curVal - domain[0]) / (domain[1] - domain[0]);
    /* straddling the point, unless it sits at an edge of the window */
    const dys = frac < 0.22 ? [-24, -8] : frac > 0.82 ? [16, 32] : [-6, 10];
    notes.push({ k: "cur", x: nowM, y: curVal, dx: 10, dy: dys[0], text: subj + " " + fmt(curVal), color: inkOf(subjColor), weight: 600, size: 12.5 });
    if (!nonDefault) notes.push({ k: "gap", x: nowM, y: curVal, dx: 10, dy: dys[1], text: Math.abs(d).toFixed(1) + (d >= 0 ? " above" : " below") + " average", size: 12.5 });
  }
  /* an overlay's name and figure at its end, on whichever side keeps it
     15px clear of the sitting term's two lines of words */
  const plotH = (narrow ? 260 : half ? 290 : 330) - 80;
  const pxOf = (v) => ((v - domain[0]) / (domain[1] - domain[0])) * plotH;
  series.filter((s) => (s.id === "cyc-onp" || s.id === "cyc-comb" || s.id === "cyc-han") && s.points.length && !(s.opacity < 0.5)).forEach((s) => {
    const last = s.points[s.points.length - 1];
    const taken = peer && curVal != null ? notes.slice(0, 2).map((n) => pxOf(last.y) - pxOf(curVal) + n.dy) : [];
    // candidate baselines, nearest the line's end first; y grows downward in dy
    const dy = [4, -8, 16, -20, 28, -32, 40].find((c) => taken.every((t) => Math.abs(c - t) >= 15)) ?? 4;
    notes.push({ k: s.id, x: last.x, y: last.y, dx: 10, dy,
                 text: (s.id === "cyc-comb" ? "L/NP + ON " : s.id === "cyc-onp" ? "One Nation " : "Hanson ") + fmt(last.y),
                 color: inkOf(s.color), weight: 600, size: 12.5 });
  });
  if (!chg && M.key === "tpp" && !nonDefault) {
    notes.push({ x: "left", y: 50, dy: -6, text: "▲ Government ahead", size: 11.5 });
    notes.push({ x: "left", y: 50, dy: 15, text: "▼ Opposition ahead", size: 11.5 });
  }
  const marks = [];
  if (peer && curVal != null) marks.push({ k: "mean", x: nowM, y: peer.mean, r: 3.5, color: "var(--ink-2)" });
  /* The election-result rings sit where each drawn term's line starts and,
     its result counted, ends - in the line's own colour, the hero's rule
     brought to this card. Change mode draws no ring (the "Result" rule
     says it) but keeps them all unseen at their change-basis positions,
     so on the switch each fades where it is rather than popping away.
     rt.close carries a value per vote CARD (tpp, primary, oppr). */
  if (rings) rings.forEach((rt) => {
    const op = (chg ? 0 : 1) * rt.opacity;
    if (rt.base != null) marks.push({ k: "base-" + rt.yr, x: 0, y: chg ? 0 : rt.base, r: 5, color: rt.color, opacity: op });
    const cv = rt.close && rt.close[M.key];
    if (cv != null) marks.push({ k: "close-" + rt.yr, x: rt.close.x, y: chg ? cv - rt.base : cv, r: 5, color: rt.color, opacity: op });
  });
  const brackets = peer && curVal != null && Math.abs(d) >= 0.3 ? [{ x: nowM, y0: curVal, y1: peer.mean, dx: 5, lines: [] }] : [];
  const refY = chg ? 0 : M.refAbs;
  const refLines = refY != null ? [{ y: refY, color: "var(--ink-faint)" }] : [];
  const zeroWord = chg ? (M.key === "tpp" || M.key === "primary" || M.key === "oppr" ? "Result" : "First") : M.key === "ppmm" ? "Tied" : "Even";
  const top = domain[1];
  const yTickFmt = (v) => (refY != null && Math.abs(v - refY) < 1e-9 && (chg || M.refAbs === 0) ? zeroWord
    : M.unit === "%" && !chg ? (v === ticks[ticks.length - 1] ? v + "%" : String(v))
    : (v > 0 ? "+" + v : v < 0 ? "−" + Math.abs(v) : "0"));
  const yr = narrow || half ? ["1 yr", "2 yrs", "3 yrs"] : ["1 year", "2 years", "3 years"];
  const xTicks = [{ x: 0, label: "Election", strong: true }, { x: 12, label: yr[0] }, { x: 24, label: yr[1] }, { x: 36, label: yr[2] }]
    .filter((t) => nowM == null || Math.abs(t.x - nowM) > 2.5)
    .concat(nowM != null ? [{ x: nowM, label: "Now", strong: true }] : []).sort((a, b) => a.x - b.x);
  /* a pair of half-width charts shares one numbered list, made by the tab
     and holding its open event (evtOut/onEvtOut); a lone chart on a phone
     numbers its own list and keeps the open event itself, as the hero does */
  const badges = badged ? { events, list: null } : narrow ? rdEventBadges("cy", events.filter((e) => e.date), -2, 38) : null;
  const [evtHeld, setEvtHeld] = useState(null);
  const ctlOut = typeof onEvtOut === "function";
  const evt = ctlOut ? evtOut : evtHeld, setEvt = ctlOut ? onEvtOut : setEvtHeld;
  const pickEv = (e) => { setEvt((cur) => (cur && cur.e === e ? cur : { e })); rdEventReveal("evt-a-" + e.badgeKey); };
  const tickSet = ticks.slice();
  if (!tickSet.includes(domain[0])) tickSet.unshift(domain[0]);
  if (!tickSet.includes(domain[1])) tickSet.push(domain[1]);
  const title = (chg ? RD_CYC_TITLE_CHG : RD_CYC_TITLE)[M.key];
  /* Level or change, and which past terms are on: the reader's choices. A
     change of either morphs the chart from the picture on screen to the new
     one - each term's line slides to its new level, the band reshapes, a
     term switched on or off fades - rather than the chart being rebuilt.
     (It was keyed by level-or-change, so that switch remounted it: the chart
     blanked and faded back in.) Hover and lifting stay instant. */
  const viewKey = (chg ? "c" : "a") + "|" + [...hidden].sort().join(",") + "|" + (showOnp ? 1 : 0) + (showComb ? 1 : 0) + (showHan ? 1 : 0);
  const cardRef = React.useRef(null);
  const clk = window.AP.useKeyClock(viewKey, cardRef);
  const shownScene = React.useRef(null), fromScene = React.useRef(null);
  const now = { series, areas: bandAreas || [], scatter, domain, ticks: tickSet, fmt: yTickFmt, refLines, notes, brackets, marks };
  if (clk && (!fromScene.current || fromScene.current.n !== clk.n)) fromScene.current = { n: clk.n, scene: shownScene.current };
  if (!clk) fromScene.current = null;
  const was = clk && fromScene.current && fromScene.current.scene;
  const drawn = was ? window.AP.blendScene(was, now, clk.t,
    (d) => (d.meta ? (d.meta.pollster || "") + "|" + (d.meta.released || d.meta.date || "") : "") + "|" + d.label + "|" + d.x) : null;
  /* The words at a line's end, the average's marker and the bracket between
     them ride with the lines: each is matched to its counterpart in the view
     being left and drawn at the blend of the two places, so "Labor 51.1"
     gives way to "Labor −4.1" where the line's end actually is mid-switch,
     rather than the new words waiting where the line has yet to arrive. What
     has no counterpart fades where it is. */
  const glide = (a, b, t) => ({ ...b, y: a.y + (b.y - a.y) * t, dy: (a.dy || 0) + ((b.dy || 0) - (a.dy || 0)) * t });
  let notesNow = notes, notesWas = was ? was.notes : null, marksNow = marks, bracketsNow = brackets, bracketsWas = was ? was.brackets : null;
  if (was) {
    const t = clk.t;
    const wk = new Map(was.notes.filter((n) => n.k).map((n) => [n.k, n])), nk = new Map(notes.filter((n) => n.k).map((n) => [n.k, n]));
    notesNow = notes.map((n) => (n.k && wk.has(n.k) ? glide(wk.get(n.k), n, t) : n));
    notesWas = was.notes.map((n) => (n.k && nk.has(n.k) ? { ...glide(n, nk.get(n.k), t), text: n.text, color: n.color, weight: n.weight } : n));
    const mk = new Map((was.marks || []).filter((q) => q.k).map((q) => [q.k, q])), mn = new Set(marks.map((q) => q.k));
    const opOf = (q) => (q.opacity != null ? q.opacity : 1);
    marksNow = marks.map((q) => (q.k && mk.has(q.k) ? { ...q, y: mk.get(q.k).y + (q.y - mk.get(q.k).y) * t, opacity: opOf(mk.get(q.k)) + (opOf(q) - opOf(mk.get(q.k))) * t }
      : { ...q, opacity: opOf(q) * t }))
      .concat((was.marks || []).filter((q) => !mn.has(q.k)).map((q) => ({ ...q, opacity: opOf(q) * (1 - t) })));
    const b0 = was.brackets && was.brackets[0], b1 = brackets[0];
    if (b0 && b1) {
      bracketsNow = [{ ...b1, y0: b0.y0 + (b1.y0 - b0.y0) * t, y1: b0.y1 + (b1.y1 - b0.y1) * t }];
      bracketsWas = bracketsNow;
    }
  }
  shownScene.current = drawn ? { ...now, series: drawn.series, areas: drawn.areas, scatter: drawn.scatter.concat(drawn.scatterMove), domain: drawn.domain,
                                 notes: notesNow, marks: marksNow, brackets: bracketsNow } : now;
  /* a copy is read away from the section heads, so it says whose measure
     it is where the chart's own head leaves that to the section */
  const copyTitle = M.key === "ppmm" ? "The PM’s lead as preferred prime minister, " + (chg ? "change since the first reading" : "points")
    : M.key === "oppnet" && !chg ? "Opposition leader’s net approval, points" : title;
  return (
    <div className="card rd-card rd-cyc-chart" ref={cardRef}>
      <div className="rd-chead">
        <span className="rd-chead-t">{title}</span>
        {M.onp && <span className="rd-cyc-ctls">
          <RdCheck checked={showComb} onChange={setComb}>Combine L/NP and ON</RdCheck>
          <RdCheck checked={showOnp} onChange={setOnp}>One Nation this term</RdCheck>
        </span>}
        {hanCtl && <RdCheck checked={showHan} onChange={setHan}>Pauline Hanson this term</RdCheck>}
      </div>
      <TrendChart key={"rd-cyc-" + M.key}
        heightPx={narrow ? 260 : half ? 290 : 330}
        padPx={narrow ? { l: 34, r: 8, t: badges ? 34 : 40, b: 28 } : { l: 40, r: half ? 12 : 16, t: badges ? 36 : 56, b: 30 }}
        xDomain={CYC_XDOMAIN} yDomain={drawn ? drawn.domain : domain} yTicks={tickSet} yTickFmt={yTickFmt}
        xTicks={xTicks} baseline refLines={refLines} vlines={nowM != null ? [{ x: nowM }] : []}
        series={drawn ? drawn.series : series} spine={CYC_SPINE} scatter={drawn ? drawn.scatter : scatter}
        scatterOut={drawn ? drawn.scatterOut : []} scatterMove={drawn ? drawn.scatterMove : []} fade={drawn ? clk.t : 1}
        areas={drawn ? drawn.areas : (bandAreas || undefined)}
        morphFrom={was ? { yTicks: was.ticks, yTickFmt: was.fmt, refLines: was.refLines, notes: notesWas, brackets: bracketsWas } : null} morphT={clk ? clk.t : 1}
        events={badges ? badges.events : events} evt={(badged || badges) ? evt : null} onEvt={(badged || badges) ? setEvt : null}
        notes={notesNow} marks={marksNow} brackets={bracketsNow}
        tooltipTitle={(i) => cycMonthLabel(CYC_SPINE[i].x) + (tipCycle ? " – " + cycMonthOf(tipCycle.eDate, CYC_SPINE[i].x) : "")}
        extraRows={(i) => {
          const r = bandRows.find((b) => b.m === CYC_SPINE[i].x);
          return r && banded ? [{ label: "Middle half", value: fmt(r.q1) + "–" + fmt(r.q3) }, { label: "Middle 80%", value: fmt(r.p10) + "–" + fmt(r.p90) }] : [];
        }}
        fmt={(v) => fmt(v)} pollFacet={M.key === "tpp" ? "twopp" : M.key === "primary" || M.key === "oppr" ? "primary" : "leadership"}
        copy={{ title: copyTitle, sub: banded ? "Against the middle half and middle 80% of " + bandN + " past terms"
          + (outcomeShown === "returned" ? " whose government was re-elected" : outcomeShown === "ousted" ? " whose government was ousted" : "") : "", terms }}
      />
      {badges && badges.list && <RdEventList list={badges.list} onPick={pickEv} openKey={evt && evt.e ? evt.e.badgeKey : null} />}
    </div>
  );
}

/* The combined L/NP + One Nation primary is a summary-table-only measure,
   derived row by row rather than shipped as a series: the opposition
   overlay's own rules - a month joins only where BOTH parties were
   measured, and the change anchor is the two results summed (the
   overlaySeries block in the tabbed-views layer). Only terms with the
   Coalition in opposition carry it (user call 2026-10-04: "It should only
   take coalition opposition years") - in a Labor-opposition term the sum
   was Labor's vote plus One Nation's, no measure of the right's. Before One
   Nation stood its 0 is a fact, so 1972-93's Coalition oppositions stand on
   their own vote. Terms whose polls never split One Nation out (2004-13)
   have a null-padded raw.onp; it was polling about 1% then, so 2007 and
   2010 count it as nothing too and keep their place (user call 2026-10-04)
   rather than dropping out of the strip. A term that did split it out still
   joins only the months both parties were measured. */
const rdOnpUnsplit = (c) => !(c.raw.onp || []).some((v) => v != null);
const combSeries = (c) => {
  const nil = rdOnpUnsplit(c);
  return c.raw.months.map((_, i) => {
    const on = nil ? 0 : (c.raw.onp || [])[i];
    return c.opp === "lnp" && c.raw.oppr[i] != null && on != null ? +(c.raw.oppr[i] + on).toFixed(2) : null;
  });
};
const seriesOf = (c, key) => (key === "comb" ? combSeries(c) : (c.raw[key] || []));
const cycBaseOf = (c, key) => (key === "comb" ? cycBase(c, "oppr") + cycBase(c, "onp") : cycBase(c, key));
/* the past terms at one month for one measure: the same pooled set the band
   draws, with who each value belongs to */
function rdCycPeers(M, cycles, hidden, chg, m) {
  const hasData = (c) => seriesOf(c, M.key).some((v) => v != null);
  const vals = [];
  cycles.filter((c) => !c.current && !hidden.has(c.year) && hasData(c)).forEach((c) => {
    const p = toMonthly(c.raw.months, seriesOf(c, M.key), c.span)[m];
    if (!p || p.y == null) return;
    vals.push({ v: chg ? +(p.y - cycBaseOf(c, M.key)).toFixed(2) : p.y, who: cycHolderAt(c, M, m), yr: c.year, c });
  });
  if (!vals.length) return null;
  vals.sort((a, b) => a.v - b.v);
  const nums = vals.map((p) => p.v);
  return { vals, n: nums.length, mean: nums.reduce((s, v) => s + v, 0) / nums.length,
           q1: pctOf(nums, 0.25), q3: pctOf(nums, 0.75), p10: pctOf(nums, 0.1), p90: pctOf(nums, 0.9) };
}
/* A holder's name recurs across terms (Hawke carried three, Howard
   four): when this month's pooled set carries the name more than once,
   qualify it with the term's year or two different terms pass for one
   person - the counts rule the boundary-company sentence in the
   tabbed-views layer already runs. */
const rdCycHolderTag = (peers, p) =>
  peers.vals.some((q) => q !== p && q.who === p.who) ? p.who + " (" + p.yr + ")" : p.who;
function rdCycRank(peers, v, fmt) {
  const above = peers.vals.filter((p) => p.v > v).length, below = peers.vals.filter((p) => p.v < v).length;
  const n = peers.n + 1;
  const hiR = above + 1, loR = below + 1;
  const top = peers.vals[peers.vals.length - 1], low = peers.vals[0];
  if (hiR === 1) return { main: "Highest of " + n, sub: "Previous high: " + rdCycHolderTag(peers, top) + ", " + fmt(top.v), strong: true };
  if (loR === 1) return { main: "Lowest of " + n, sub: "Previous low: " + rdCycHolderTag(peers, low) + ", " + fmt(low.v), strong: true };
  if (above === below) return { main: "Middle of " + n };
  if (hiR < loR) return { main: rdOrd(hiR) + " highest of " + n, sub: hiR === 2 ? "Only " + rdCycHolderTag(peers, top) + " was higher" : null };
  return { main: rdOrd(loR) + " lowest of " + n, sub: loR === 2 ? "Only " + rdCycHolderTag(peers, low) + " was lower" : null };
}

/* ---- a summary row opened: every term at this month, then the records ---- */
/* one ranked term's height: the rows stand at k * RD_CSL_ROW, so a re-rank
   (Level to Change, another set of terms) glides them to their new places */
const RD_CSL_ROW = 26, RD_CSL_ROW_PHONE = 30;
/* the calendar month a term's month m fell in, short ("Sep 2026"): the
   month the bucket sits in, named from the election month as cycMonthOf
   names it */
const rdCycWhen = (c, m) => {
  const [y, mo] = c.eDate.split("-").map(Number);
  const t = (mo - 1) + Math.max(0, m);
  return window.AP.D.monthName((t % 12) + 1) + " " + (y + Math.floor(t / 12));
};
/* Whether a poll was taken in a term's month i, rather than the month being
   read from the months either side (raw.obs). The combined row needs both
   parties polled - except that before One Nation existed its 0 is a fact,
   not a gap. Hanson's ratings carry no flags: every one is a reading. */
function rdCycPolled(c, key, i) {
  const o = c.raw.obs || {};
  if (key === "comb") return !!(o.oppr || [])[i] && (rdOnpUnsplit(c) || (c.raw.onp[i] != null && (!!(o.onp || [])[i] || c.raw.onp[i] === 0)));
  if (!o[key]) return seriesOf(c, key)[i] != null;
  return !!o[key][i];
}
/* The records: the lowest and highest a measure went at ANY point in a
   term, not just at this month. One long slump is one record, not five.
   The vote measures follow parties, so each term counts once; the leaders'
   measures rate people, so each leader counts once per term (Hawke and
   Keating both keep their 1990-term lows). Only months with a poll count:
   not the election result each term starts from, and not a month read
   between two polls, which can never be an extreme anyway.
   spec: M names each entry's holder (cycHolderAt), key is the series past
   terms are read from, curKey the sitting term's own (Hanson's row ranks
   her against opposition leaders but reads her ratings), whoOf overrides
   the holder, and people says a leader, not a term, counts once. */
function rdCycRecords(cycles, hidden, chg, spec) {
  const { M, key, curKey, whoOf, people, positive } = spec;
  const all = [];
  cycles.forEach((c) => {
    if (!c.current && hidden.has(c.year)) return;
    const k = c.current ? curKey : key;
    const vals = seriesOf(c, k);
    if (!vals.some((v) => v != null)) return;
    const base = cycBaseOf(c, k);
    const by = new Map();
    c.raw.months.forEach((mo, i) => {
      if (mo <= 0 || vals[i] == null || !rdCycPolled(c, k, i)) return;
      /* a party's own series before it stood (One Nation's 0s) has nothing to record */
      if (positive && !(vals[i] > 0)) return;
      const who = (whoOf && whoOf(c)) || cycHolderAt(c, M, mo);
      const v = chg ? +(vals[i] - base).toFixed(2) : vals[i];
      const g = people ? who : "";
      let e = by.get(g);
      if (!e) by.set(g, (e = { lo: null, hi: null }));
      const at = { v, m: mo, who, yr: c.year, c, cur: !!c.current };
      if (!e.lo || v < e.lo.v) e.lo = at;
      if (!e.hi || v > e.hi.v) e.hi = at;
    });
    by.forEach((e) => all.push(e));
  });
  if (!all.length) return null;
  return { lows: all.map((e) => e.lo).sort((a, b) => a.v - b.v || a.yr - b.yr),
           highs: all.map((e) => e.hi).sort((a, b) => b.v - a.v || a.yr - b.yr) };
}
/* Who led one side of a term into the election that closed it: the last
   holder of that side's office - except where the offices swapped hands
   mid-term. In 1975 Fraser became caretaker prime minister, so the Labor
   government of the 1974 term went to the polls under Whitlam, by then
   opposition leader, and the Coalition under Fraser. */
const rdCycEndLeader = (c, opp) => {
  const own = sitting(String(opp ? c.oppLead : c.pm));
  const other = String(opp ? c.pm : c.oppLead).split(/\s*\u2192\s*/);
  return other.slice(0, -1).includes(own) ? sitting(String(opp ? c.pm : c.oppLead)) : own;
};
/* the ranked list stands its terms in their opening places, then lets go
   once: the rows run down from the row above into their ranks. Terms the
   set adds later just appear, and a re-rank glides (rd.css) */
function RdCsUnroll({ className, style, children }) {
  const [fresh, setFresh] = useState(true);
  React.useEffect(() => { const t = setTimeout(() => setFresh(false), 900); return () => clearTimeout(t); }, []);
  return <div className={className + (fresh ? " unroll" : "")} style={style}>{children}</div>;
}

/* ---- the tab --------------------------------------------------------------- */
function RdPastCycles(p) {
  const { cycles, mode, setMode, hidden, lifted, hi, setHi, toggle, lift, unlift, chipClick, showAll, hideAll,
          showOutcome, outcomeShown, shapes, showHan, setShowHan, showOnp, setShowOnp, showComb, setShowComb, exportSource, srcFailed, retrySource } = p;
  const { D } = window.AP;
  const narrow = useNarrow("(max-width: 640px)");
  const [board, setBoard] = useState({ open: false, sheet: null });
  const [tip, setTip] = useState(null);
  /* the summary row opened to its ranked terms and records (one at a time),
     and the term a pointer is on in that list, lit on the strip above */
  const [openRow, setOpenRow] = useState(null);
  const [lit, setLit] = useState(null);
  /* the walk floor: the finding's slot stands at the tallest of every
     measure state the walk can reach (the finding no longer answers to
     the Compare-with pick), so a hop rewrites the words inside a box that
     never moves - nothing above the pinned row reflows and no scroll
     correction is ever issued (the All-polls hed-on-every-facet bargain,
     2026-10-01). The walkable states render invisibly in .rd-cyc-storyvar
     and the slot re-floors if any of them re-wraps (a resize, a font
     arriving); the live block joins the max so any live re-count counts
     too */
  const storySlotRef = React.useRef(null), storyVarRef = React.useRef(null);
  const [storyFloor, setStoryFloor] = useState(0);
  React.useLayoutEffect(() => {
    const measure = () => {
      let h = 0;
      const live = storySlotRef.current && storySlotRef.current.querySelector(".rd-glide-in");
      if (live) h = live.scrollHeight;
      const box = storyVarRef.current;
      if (box) for (const c of box.children) h = Math.max(h, c.scrollHeight);
      setStoryFloor((f) => (Math.abs(f - h) > 1 ? h : f));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(measure);
    const live = storySlotRef.current && storySlotRef.current.querySelector(".rd-glide-in");
    const box = storyVarRef.current;
    if (live) ro.observe(live);
    if (box) [...box.children].forEach((c) => ro.observe(c));
    return () => ro.disconnect();
  });
  /* The Draw-a-term band floats absolutely, out of flow - left alone a
     tall stack of drawn pills grows up over the previous section's foot
     instead of lengthening the page. Keep #cyc-tpp's headroom at least as
     tall as the band, its 12px of air above the rule and an 8px spare
     under whatever ends the section above: the fit clears its inline
     work, reads the CSS floor (56/60px media-block default) back as the
     base, and re-applies only when the measured band needs more. The
     observer catches the pill rows wrapping and unwrapping; the resize
     listener catches the 640px floor swap. */
  const chipmoveRef = React.useRef(null);
  React.useLayoutEffect(() => {
    const fit = () => {
      const band = chipmoveRef.current;
      const sec = band && band.closest(".rd-sec");
      const prev = sec && sec.previousElementSibling;
      if (!sec || !prev) return;
      sec.style.removeProperty("--cyc-chip-pad");
      sec.style.removeProperty("padding-top");
      const base = parseFloat(getComputedStyle(sec).paddingTop) || 0;
      const prevBtm = prev.getBoundingClientRect().bottom - (parseFloat(getComputedStyle(prev).paddingBottom) || 0);
      const gap = sec.getBoundingClientRect().top - prevBtm;
      const need = Math.ceil(band.offsetHeight) + 19 - gap; /* 12 above the rule + 1 anchor + 8 spared, less the gap ahead of the section */
      if (need > base + 0.5) {
        sec.style.setProperty("--cyc-chip-pad", need + "px");
        sec.style.paddingTop = need + "px";
      }
    };
    fit();
    window.addEventListener("resize", fit);
    if (typeof ResizeObserver === "undefined" || !chipmoveRef.current) return () => window.removeEventListener("resize", fit);
    const ro = new ResizeObserver(fit);
    ro.observe(chipmoveRef.current);
    return () => { window.removeEventListener("resize", fit); ro.disconnect(); };
  }, []);
  const boardRef = React.useRef(null);
  const boardPane = board.sheet ? " body" : board.sheet === false ? " sheet" : "";
  /* the board opens under its Summary-section controls row; the chip that
     toggles it floats on the Two-party section's divider, so "working"
     means the board is where the reader can see it. On a wide enough
     window (where the sheet isn't already a fixed bottom sheet) an open
     whose home isn't in view parks the sheet against the top of the
     viewport instead - it follows the reader, the way the phone's fixed
     sheet always did (the chip was moved off the controls row in 7964e12
     and the board stayed anchored to .rd-cc, so a laptop reader in the
     Two-party section clicked the chip and the sheet appeared hundreds of
     pixels up the page, out of view) */
  React.useLayoutEffect(() => {
    if (board.open && board.sheet == null && window.matchMedia("(min-width: 901px)").matches && boardRef.current) {
      const s = boardRef.current.querySelector(".rd-cc-board");
      if (s) {
        const r = s.getBoundingClientRect();
        if (r.bottom < 0 || r.top > window.innerHeight) setBoard((b) => (b.open && b.sheet == null ? { open: true, sheet: true } : b));
      }
    }
  });
  /* the board's toggle is rendered on the Two-party section's divider, far
     outside boardRef, so its pointerdown is told apart from a real outside
     tap or the hook would dismiss and the click would re-open - a toggle
     that can only open, never close */
  window.useDismissOutside(boardRef, board.open, () => setBoard(false), ".rd-cyc-chipmove");
  /* Walking the measure rewrites the finding above this row (the
     Compare-with walk leaves it standing), and its height swings state
     to state. The walk floor (the
     storyFloor machinery below) holds the finding's slot at the tallest
     walkable state, so the rewrite moves nothing above the row and the
     pin has nothing to correct - the All-polls hed-on-every-facet
     bargain, taken a step further because this finding cannot keep one
     line count across states. (The floor came in after the ed293ff
     fine-pointer opt-in tried to let rdPinScroll's corrections carry
     the live glide on a laptop: every hop re-wrote the finding above
     the row and the pin chased each glide frame with an integer
     scrollTo, which Safari.app's quantised scroller commits ~2css off
     and drops under 3css - the user-visible bounce and drift of the
     laptop walk. Same lesson the All-polls table learned in scroll
     space's thirteenth round: when the correction channel loses data,
     delete the reflow that needs correcting.) Deeper in the summary
     the row itself is off the screen: anchor the reader's own strip,
     key or foot instead or nothing holds the spot at all - Chrome's
     native scroll anchoring papers over that gap there, but Safari has
     no overflow-anchor and every compare swipe shoved the reader down
     the page by the finding's height swing. Like the All-polls table,
     this walk opts into the pin on fine pointers too (the second arg):
     a laptop's compare/measure click or arrow-key step holds the board
     and summary exactly as a phone swipe's does - with the floor, the
     pin measures zero drift and issues zero corrections */
  const pinView = () => {
    const sec = document.getElementById("cyc-summary");
    const strip = sec && [...sec.querySelectorAll(".rd-cs-row")].find((el) => {
      const r = el.getBoundingClientRect();
      return r.bottom >= 0 && r.top <= window.innerHeight;
    });
    rdPinScroll([boardRef.current, strip,
                 sec && sec.querySelector(".rd-cs-key"), sec && sec.querySelector(".rd-foot")], true);
  };
  const chg = mode === "chg";
  const cur = cycles.find((c) => c.current);
  const m = cur ? cur.span : 0;
  const Mby = {};
  CYC_METRICS.forEach((M) => { Mby[M.key] = M; });
  /* the summary's two extra vote rows are not CYC_METRICS measures: One
     Nation's own primary (shipped as each term's raw.onp) and the L/NP + ON
     sum (derived - combSeries above). One Nation's row reads its now-figure
     off ON's own series but is ranked against past OPPOSITION primaries,
     not past ON primaries: this term it is the non-government protest vote
     (polling above the Coalition), so its company is Beazley's 40 and the
     other opposition shares, not ON's own <10% history - the Hanson's-row
     pattern below, which ranks her against past opposition leaders. The
     peer key is "oppr" while the row key stays "onp" so the now-figure and
     its change anchor still come from ON's own series (curOf). leader:"opp"
     names each era's opposition leader, as the opposition row's does. */
  Mby.onp = { key: "oppr", leader: "opp", unit: "%" };
  Mby.comb = { key: "comb", leader: "opp", unit: "%" };
  /* Hanson's row is the sitting term's own reading, but its strip, average
     and rank are the opposition leader's measure: no past term rated her
     (raw.han null-pads every cycle before this one), so the peer key is
     "oppnet" while the row key stays "han" so the now-figure still comes
     from her series (curOf). leader:"opp" names past opposition leaders. */
  Mby.han = { key: "oppnet", leader: "opp", unit: "" };
  /* a half-measured month never becomes a half-total: the combined now
     figure renders a dash when either party's is missing */
  const endOfKey = (c, key) => (key === "comb"
    ? (c.opp === "lnp" && c.end.oppr != null && c.end.onp != null ? +(c.end.oppr + c.end.onp).toFixed(1) : null)
    : c.end[key]);
  const curOfS = (key, c2) => { const v = endOfKey(cur, key); return v == null ? null : (c2 ? v - cycBaseOf(cur, key) : v); };
  const peersOfS = (key, hid, c2) => rdCycPeers(Mby[key], cycles, hid, c2, m);
  const fmtOfS = (key, c2) => (v) => (Mby[key].unit === "%" && !c2 ? v.toFixed(1) : rdSgn(v, false));
  const curOf = (key) => curOfS(key, chg);
  const peersOf = (key) => peersOfS(key, hidden, chg);
  const fmtOf = (key) => fmtOfS(key, chg);
  const govName = D.PARTIES[cur.gov].name, oppName = D.PARTIES[cur.opp].name;
  const govIn = cur.gov === "lnp" ? "the Coalition" : govName, oppIn = cur.opp === "lnp" ? "the Coalition" : oppName;
  const pm = sitting(cur.pm), oppL = sitting(cur.oppLead);
  const tppEraNow = cur.raw.tppEras ? cur.raw.tppEras[cur.raw.tppEras.length - 1] : null;
  const rivalWord = tppEraNow && tppEraNow.rival === "alp_on" ? "One Nation" : oppName === "Coalition" ? "the Coalition" : oppName;
  const monthsWord = rdCap(rdNumWord(m)) + " months";

  /* the outcome sets, counted off the board's own rule */
  const outcomeOf = (i) => { const nx = cycles[i + 1]; return nx ? (nx.gov === cycles[i].gov ? "returned" : "ousted") : null; };
  const nPast = cycles.filter((c) => !c.current).length;
  const nRet = cycles.filter((c, i) => outcomeOf(i) === "returned").length, nOus = cycles.filter((c, i) => outcomeOf(i) === "ousted").length;
  const compare = hidden.size === 0 ? "all" : outcomeShown || null;
  /* "Compare with" picks the PAST terms this one is set against, so the
     sitting term stays on the charts whichever set is picked. The board's
     showOutcome takes "only" to mean only and hides it too - every chart lost
     its Labor line while the table and headlines beside it still quoted it -
     so it is put straight back (toggle's update runs after showOutcome's) -
     UNLESS the reader hid it themselves since (the sitting-term pill's cross
     is a first-class toggle now): a set swap does not undo someone's
     choice, so only a term showOutcome hid is re-shown. */
  const setCompare = (id) => {
    pinView();
    if (id === "all") { showAll(); return; }
    const curHidden = cur && hidden.has(cur.year);
    showOutcome(id);
    if (cur && !curHidden) toggle(cur.year);
  };
  const setModePin = (id) => { pinView(); setMode(id); };

  /* ---- the rows -------------------------------------------------------------- */
  const ROW_DEFS = [
    { key: "tpp", name: "Two-party preferred", sub: govName + ", against " + rivalWord.replace(/^the /, "the "), group: "votes", color: cur.color },
    { key: "primary", name: "Government’s primary vote", sub: govName, group: "votes", color: cur.color },
    { key: "oppr", name: "Opposition’s primary vote", sub: rdCap(oppIn), group: "votes", color: D.PARTIES[cur.opp].color },
    { key: "onp", name: "One Nation’s primary vote", sub: "Pauline Hanson’s party", group: "votes", color: D.PARTIES.onp.color },
    /* the non-government right's combined first preference: the opposition's
       own plus One Nation's. ink-2 like the combined overlay line - no one
       party owns a sum of two */
    { key: "comb", name: "L/NP + ON combined primary vote", sub: "The Coalition and One Nation, together", group: "votes", color: "var(--ink-2)" },
    { key: "ppmm", name: "Preferred PM, lead", sub: pm + " over " + oppL, group: "leaders", color: cur.color },
    { key: "net", name: "Prime minister’s net approval", sub: pm, group: "leaders", color: cur.color },
    { key: "oppnet", name: "Opposition leader’s net approval", sub: oppL, group: "leaders", color: D.PARTIES[cur.opp].color },
    { key: "han", name: "Hanson’s net approval", sub: "Pauline Hanson", group: "leaders", color: D.PARTIES.onp.color },
  ];
  const rowsForHidden = (hid, c2) => ROW_DEFS.map((r) => {
    const peers = peersOfS(r.key, hid, c2);
    const v = curOfS(r.key, c2);
    const fmt = fmtOfS(r.key, c2);
    return { ...r, peers, v, fmt, rank: peers && v != null ? rdCycRank(peers, v, fmt) : null };
  });
  const ROWS = rowsForHidden(hidden, chg);
  const scaleOf = (group) => {
    const rs = ROWS.filter((r) => r.group === group && r.peers);
    const vals = rs.flatMap((r) => r.peers.vals.map((q) => q.v).concat(r.v != null ? [r.v] : []));
    const step = group === "votes" && !chg ? 10 : 20;
    return { lo: Math.floor(Math.min(...vals) / step) * step, hi: Math.ceil(Math.max(...vals) / step) * step, step };
  };
  const SC = { votes: scaleOf("votes"), leaders: scaleOf("leaders") };
  const X = (sc, v) => ((v - sc.lo) / (sc.hi - sc.lo)) * 100;
  const tickLab = (group, v) => (group === "votes" && !chg ? (v === SC.votes.hi ? v + "%" : String(v))
    : v === 0 ? (chg ? "0" : "Even") : v > 0 ? "+" + v : "−" + Math.abs(v));
  /* Each group's scale, and the one it replaced while a switch plays: the
     marks on the strips glide to their new places (rd.css), and the scale's
     words and rules hand over - the old ones fade as the new ones come in -
     rather than the whole scale cutting from percentages to points. */
  const scaleNow = {};
  ["votes", "leaders"].forEach((g) => {
    const sc = SC[g];
    scaleNow[g] = { key: (chg ? "c" : "a") + sc.lo + "|" + sc.hi + "|" + sc.step,
                    ticks: rdYTicks(sc.lo, sc.hi, sc.step).map((v) => ({ v, left: X(sc, v), lab: tickLab(g, v) })) };
  });
  const scaleWas = rdUseOutgoing(scaleNow.votes.key + "/" + scaleNow.leaders.key, scaleNow);
  const scaleOut = (g) => (scaleWas && scaleWas.value[g].key !== scaleNow[g].key ? scaleWas : null);
  /* the past terms on each strip, where they sat: a term the new set drops
     fades where it was, and one it adds fades in, while the rest glide */
  const dotsNow = {};
  ROWS.forEach((r) => { dotsNow[r.key] = r.peers ? r.peers.vals.map((q) => ({ yr: q.yr, left: X(SC[r.group], q.v) })) : []; });
  const dotsWas = rdUseOutgoing((chg ? "c" : "a") + "|" + [...hidden].sort().join(","), dotsNow);

  /* ---- the findings ---------------------------------------------------------------- */
  const rowIdx = (rows) => { const o = {}; rows.forEach((r) => { o[r.key] = r; }); return o; };
  const R = rowIdx(ROWS);
  /* With "Change since election" on, every rank is a rank of the change, so
     the lowest is the biggest fall (or the smallest rise). The words say so:
     they used to call it a record low, and the head could claim a party was
     at its lowest level on the strength of how far it had fallen. */
  const pts1 = (v) => Math.abs(v).toFixed(1);
  const upDown = (v) => (v < 0 ? "down " : "up ") + pts1(v);
  /* The per-measure findings rank this term against the past terms in the
     comparison, so a superlative says which ones: with Re-elected picked,
     "the lowest of any prime minister" left out Whitlam, who was lower.
     `tail` closes the sentence that makes the claim. */
  const tail = compare === "all" ? "" : compare === "returned" ? ", among terms whose government was re-elected"
    : compare === "ousted" ? ", among terms whose government was ousted" : ", among the terms on the board";
  /* THE section finding holds the same copy at every Compare-with pick: it
     ranks this term against every past term (the pick still rescopes the
     table below and the charts beside it; the finding stands above them as
     the page's read of the moment, so it doesn't move). The measure walk
     still rewrites it, so it is worked out per measure state: the section's
     walk floor (below) renders both invisibly and holds the slot at the
     taller, so a hop reflows nothing above the pinned compare row and the
     pin issues no scroll correction at all - the same bargain the All-polls
     table struck by rendering its hed on every facet (2026-10-01), because
     Safari.app's quantised scroller cannot be trusted with a per-hop
     correction stream. */
  const storyFor = (c2) => {
    const FA = rowIdx(rowsForHidden(new Set(), c2));
    const g = FA.primary, o = FA.oppr, t = FA.tpp;
    const snc = " since " + cycles[0].year;
    const gLow = g.rank && /^Lowest/.test(g.rank.main), oLow = o.rank && /^Lowest/.test(o.rank.main);
    /* the right-of-government vote pooled: an opposition-primary record low
       is only half the picture while One Nation polls this high, so the
       finding also weighs the opposition's own vote combined with One
       Nation's against past terms on the same footing */
    const cb = !c2 && FA.comb.rank && FA.comb.v != null ? FA.comb : null;
    const cbHi = cb ? /^(\d+)(?:st|nd|rd|th) highest/.exec(cb.rank.main) : null;
    const cbOrdW = cbHi ? { 2: "second", 3: "third" }[+cbHi[1]] : null;
    const combined = cb ? /^Highest/.test(cb.rank.main) ? "the highest"
      : cbOrdW ? cbOrdW + " highest"
      : cb.v >= cb.peers.q3 ? "among the highest" : cb.v > cb.peers.q1 ? "in the middle half" : "among the lowest" : null;
    const moved = (r) => (r.v < 0 ? "fallen further" : "risen less");
    const found = c2
      ? (gLow && oLow ? (g.v < 0 && o.v < 0 ? "Both major parties have lost more of their vote than any before them at this point in a term"
          : "Both major parties have done worse since the election than any before them at this point in a term")
        : gLow ? govName + "’s primary vote has " + moved(g) + " than any government’s at this point in a term"
        : oLow ? rdCap(oppIn) + "’s primary vote has " + moved(o) + " than any opposition’s at this point in a term"
        : t.peers && t.v != null ? govName + "’s two-party vote has done " + (t.v >= t.peers.mean ? "better" : "worse") + " than the average government’s since its election"
        : null)
      : gLow && oLow ? "Both major parties are at record lows for this point in a term"
      : gLow ? govName + "’s primary vote is the lowest of any government at this point in a term"
      : oLow ? rdCap(oppIn) + "’s primary vote is the lowest of any opposition at this point in a term"
      : t.peers && t.v != null ? govName + " sits " + (t.v >= t.peers.mean ? "above" : "below") + " the average government at this point in a term" : null;
    const head = found || "Every term since " + cycles[0].year + ", lined up on its election day";
    let dek = monthsWord + " after the " + cur.year + " election, ";
    const bits = [];
    const extreme = (r) => (r.v < 0 ? "the biggest fall" : "the smallest rise");
    if (c2) {
      if (gLow) bits.push(govName + "’s primary vote is " + upDown(g.v) + " points, " + extreme(g) + " for any government at that point" + snc);
      if (oLow) bits.push((gLow ? "and " + oppIn + "’s is " : oppIn + "’s primary vote is ") + upDown(o.v) + " points, " + extreme(o) + " for any opposition");
    } else {
      if (gLow) bits.push(govName + "’s primary vote is the lowest of any government at the same point" + snc);
      /* the opposition's record low is its own sentence when the combined
         standing can ride its tail clause */
      if (oLow && !combined) bits.push((gLow ? "and " + oppIn + "’s" : oppIn + "’s primary vote is") + " the lowest of any opposition");
    }
    /* a rank counts this term among its peers, so "of 21" is 21 governments,
       twenty of them past */
    const rankWords = (r) => (/^Middle/.test(r.rank.main) ? "in the " : "the ") + r.rank.main.toLowerCase().replace(/ of (\d+)$/, " of $1 governments");
    dek += bits.length ? bits.join(", ") + "."
      : g.v == null || !g.rank ? govName + "’s primary vote has no reading to set against past governments yet."
      : c2 ? govName + "’s primary vote is " + upDown(g.v) + " points since the election; past governments were "
          + (g.peers.mean < 0 ? "down " : "up ") + pts1(g.peers.mean) + " on average by now."
      : govName + "’s primary vote is " + rankWords(g) + " at this point.";
    if (t.peers && t.v != null && !c2) {
      const where = t.v >= t.peers.q1 && t.v <= t.peers.q3 ? "sits in the middle half of past governments"
        : t.v > t.peers.q3 ? "is above three in four of past governments" : "is below three in four of past governments";
      dek += " After preferences, " + (bits.length ? "though, " : "") + govName + "’s " + t.v.toFixed(1) + "% " + where + ".";
    }
    if (!c2 && oLow && combined) dek += " And while " + oppIn + "’s primary vote is also the lowest of any opposition, it’s " + combined + " when combined with One Nation’s.";
    return { head, dek };
  };
  const pageStory = storyFor(chg);
  /* both measure states the walk can land this section in */
  const storyVariants = [false, true].map((c2) => ({ key: c2 ? "chg" : "abs", story: storyFor(c2) }));
  /* the 2PP against the governments that were re-elected and ousted */
  const outcomePeers = (which) => {
    const keep = new Set(cycles.filter((c, i) => outcomeOf(i) === which).map((c) => c.year));
    const hid = new Set(cycles.filter((c) => !keep.has(c.year) && !c.current).map((c) => c.year));
    return rdCycPeers(Mby.tpp, cycles, hid, chg, m);
  };
  const tppStory = (() => {
    const t = R.tpp;
    if (!t.peers || t.v == null) return null;
    const ret = outcomePeers("returned"), ous = outcomePeers("ousted");
    const dAvg = t.v - t.peers.mean;
    let head;
    if (ret && ous) {
      const nearRet = Math.abs(t.v - ret.mean) <= Math.abs(t.v - ous.mean);
      head = "After preferences, " + govName + " is on a par with governments that went on to be " + (nearRet ? "re-elected" : "ousted");
    } else head = "After preferences, " + govName + " is " + (dAvg >= 0 ? "above" : "below") + " the average government at this point" + tail;
    if (chg && !(ret && ous)) head = "After preferences, " + govName + " has done " + (dAvg >= 0 ? "better" : "worse") + " than the average government since its election" + tail;
    const vs = rivalWord === "One Nation" ? " against One Nation" : "";
    /* in change mode the figure is a move from the election result, said as one */
    let dek = chg
      ? (vs ? "Against One Nation it is " : "It is ") + upDown(t.v) + " points on its election result, " + pts1(dAvg) + " " + (dAvg >= 0 ? "better" : "worse") + " than the average government " + m + " months in" + tail + "."
      : "Its " + fmtOf("tpp")(t.v) + "%" + vs + " is " + pts1(dAvg) + " points " + (dAvg >= 0 ? "above" : "below") + " the average government " + m + " months in" + tail + ".";
    if (ret && ous) dek += chg
      ? " By this stage governments later re-elected were " + (ret.mean < 0 ? "down " : "up ") + pts1(ret.mean) + " points on average, and the " + rdNumWord(ous.n) + " ousted " + (ous.mean < 0 ? "down " : "up ") + pts1(ous.mean) + "."
      : " Governments later re-elected averaged " + fmtOf("tpp")(ret.mean) + "% at this point; the " + rdNumWord(ous.n) + " ousted averaged " + fmtOf("tpp")(ous.mean) + "%.";
    return { head, dek };
  })();
  /* the primaries: how far each party has moved since its own election */
  const primStory = (() => {
    const mv = (key) => rdCycPeers(Mby[key], cycles, hidden, true, m);
    const gC = mv("primary"), oC = mv("oppr");
    if (!gC || !oC) return null;
    const gNow = cur.end.primary - cycBase(cur, "primary"), oNow = cur.end.oppr - cycBase(cur, "oppr");
    const oWorst = oC.vals.every((q) => q.v > oNow);
    const gWorse = gC.vals.filter((q) => q.v < gNow);
    const head = oWorst ? "No opposition has lost as much of its vote this early as " + oppIn + " has" + tail
      : gC.vals.every((q) => q.v > gNow) ? "No government has lost as much of its vote this early as " + govName + " has" + tail
      : rdCap(oppIn) + " has " + (oNow < 0 ? "lost" : "gained") + " " + Math.abs(oNow).toFixed(1) + " points since the election";
    let dek = rdCap(oppIn) + " is " + (oNow < 0 ? "down " : "up ") + Math.abs(oNow).toFixed(1) + " points since the election, to " + cur.end.oppr.toFixed(1) + "%; by this stage the average opposition had "
      + (oC.mean >= 0 ? "gained " : "lost ") + Math.abs(oC.mean).toFixed(1) + tail + ". " + govName + " is " + (gNow < 0 ? "down " : "up ") + Math.abs(gNow).toFixed(1) + ", to " + cur.end.primary.toFixed(1) + "%.";
    if (gWorse.length === 1) dek += (tail ? " Of those, only " : " Only ") + gWorse[0].who + "’s government, in " + gWorse[0].yr + ", had lost more by now.";
    else if (gWorse.length > 1 && gWorse.length <= 4) dek += (tail ? " Of those, " + rdNumWord(gWorse.length) : " " + rdCap(rdNumWord(gWorse.length))) + " governments had lost more by now.";
    return { head, dek };
  })();
  const leadStory = (() => {
    const n = R.net;
    if (!n.peers || n.v == null) return null;
    const rk = n.rank;
    const low = n.peers.vals[0];
    const dN = n.v - n.peers.mean;
    const pp = R.ppmm, on = R.oppnet;
    if (chg) {
      const less = n.v < 0 ? "fallen further" : "risen less";
      const head = (/^Lowest/.test(rk.main) ? pm + "’s net approval has " + less + " than any prime minister’s at this point"
        : /^2nd lowest/.test(rk.main) ? pm + "’s net approval has " + less + " than any prime minister’s at this point but " + rdCycHolderTag(n.peers, low) + "’s"
        : /^Highest/.test(rk.main) ? pm + "’s net approval has " + (n.v >= 0 ? "risen more" : "fallen less") + " than any prime minister’s at this point"
        : pm + "’s net approval has done " + (dN >= 0 ? "better" : "worse") + " than the average prime minister’s since the term’s first reading") + tail;
      /* the leaders' measures count from the term's first reading, not the election */
      let dek = "It is " + upDown(n.v) + " points on the term’s first reading, " + pts1(dN) + " " + (dN >= 0 ? "better" : "worse") + " than the average prime minister " + m + " months in" + tail + ".";
      if (pp.peers && pp.v != null) {
        const dP = pp.v - pp.peers.mean;
        dek += " His lead as preferred PM is " + upDown(pp.v) + ", " + (Math.abs(dP) <= 3 ? "close to the average" : pts1(dP) + " " + (dP > 0 ? "better" : "worse") + " than the average");
        if (on.peers && on.v != null) {
          const dO = on.v - on.peers.mean;
          dek += ", and " + oppL + " is " + upDown(on.v) + (Math.abs(dO) <= 4 ? ", about as opposition leaders usually are by now." : ", " + (dO > 0 ? "better" : "worse") + " than opposition leaders usually do.");
        } else dek += ".";
      }
      return { head, dek };
    }
    const head = (/^Lowest/.test(rk.main) ? pm + "’s net approval is the lowest of any prime minister at this point"
      : /^2nd lowest/.test(rk.main) ? pm + "’s net approval is the second lowest of any prime minister at this point, after " + rdCycHolderTag(n.peers, low) + "’s"
      : /^Highest/.test(rk.main) ? pm + "’s net approval is the highest of any prime minister at this point"
      : pm + "’s net approval is " + (n.v >= n.peers.mean ? "above" : "below") + " the average prime minister’s at this point") + tail;
    let dek = "At " + fmtOf("net")(n.v) + " he is " + Math.abs(dN).toFixed(1) + " points " + (dN >= 0 ? "above" : "below") + " the average prime minister " + m + " months in" + tail + ".";
    if (pp.peers && pp.v != null) {
      const dP = pp.v - pp.peers.mean;
      dek += " He " + (pp.v >= 0 ? "still leads" : "trails") + " as preferred PM by " + Math.abs(pp.v).toFixed(1) + " points, " + (Math.abs(dP) <= 3 ? "close to the average" : Math.abs(dP).toFixed(1) + " " + (dP > 0 ? "above" : "below") + " the average");
      if (on.peers && on.v != null) {
        const dO = on.v - on.peers.mean;
        dek += ", and " + oppL + ", at " + fmtOf("oppnet")(on.v) + ", " + (Math.abs(dO) <= 4 ? "rates about as opposition leaders usually do." : "rates " + (dO > 0 ? "better" : "worse") + " than opposition leaders usually do.");
      } else dek += ".";
    }
    return { head, dek };
  })();

  /* ---- the summary table --------------------------------------------------------- */
  const goTo = (id) => { const el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); };
  /* One Nation and the combined row belong to the primary section: its
     opposition chart draws these very series when its boxes are ticked */
  const SEC = { tpp: "cyc-tpp", primary: "cyc-primary", oppr: "cyc-primary", onp: "cyc-primary", comb: "cyc-primary", ppmm: "cyc-leaders", net: "cyc-leaders", oppnet: "cyc-leaders", han: "cyc-leaders" };

  /* ---- a row opened ---------------------------------------------------------------- */
  /* A row opens to every term on its strip, by name and ranked at this
     month, with how each one's next election went; then the records, the
     lowest and highest the measure went at any point in a term. One row is
     open at a time, and opening another holds the clicked row where it
     stands while the one above it closes, as the latest-polls rows do. */
  const toggleRow = (key, el) => {
    if (el) rdPinScroll(el, true);
    setLit(null);
    setOpenRow((o) => (o === key ? null : key));
  };
  /* Enter or space opens and closes; up and down step row to row, and an
     open row's list travels with the focus. Left and right on a focused row
     walk the table's compare view, exactly as hovering the section does:
     the focus guards in the page-level and hover claims stand aside for a
     focused row, so without this branch the keys died on the row. */
  const rowNav = (e, r) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleRow(r.key, e.currentTarget); return; }
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.defaultPrevented) return;
      if (cmpSwipeLive.current(e.key === "ArrowRight" ? 1 : -1)) e.preventDefault();
      return;
    }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const rows = [...e.currentTarget.closest(".rd-cs").querySelectorAll(".rd-cs-row")];
    const nx = rows[rows.indexOf(e.currentTarget) + (e.key === "ArrowDown" ? 1 : -1)];
    if (!nx) return;
    if (openRow === r.key) toggleRow(nx.dataset.key, nx);
    nx.focus();
  };
  /* the measures an election counts: where each past term finished is its
     result, the ring that closes its line on the charts below */
  const CSL_EL = { tpp: true, primary: true, oppr: true };
  const ladderOf = (r) => {
    const M = Mby[r.key], P = r.peers, g = r.group, sc = SC[g];
    if (!P && r.v == null) return null;
    const opp = M.leader === "opp";
    const partyOf = (c) => D.PARTIES[opp ? c.opp : c.gov].color;
    /* the next election from the measure's side: a government re-elected or
       ousted, an opposition that won or lost */
    const ocOf = (c) => {
      const oc = outcomeOf(cycles.indexOf(c));
      return !oc ? null : opp ? (oc === "ousted" ? "Won" : "Lost") : (oc === "returned" ? "Re-elected" : "Ousted");
    };
    /* the party won or lost; when someone else led it by then, say who -
       "Downer, Won" would credit Downer with Howard's 1996 win */
    const ocCell = (c, who) => {
      const w = ocOf(c);
      if (!w) return null;
      const by = rdCycEndLeader(c, opp);
      return by && by !== who ? <>{w}<span className="rd-csl-under"> under {by}</span></> : w;
    };
    const hasEl = !!CSL_EL[M.key];
    const elOf = (c) => (hasEl && c.endRes && c.endRes[M.key] != null ? (chg ? c.endRes[M.key] - cycBaseOf(c, M.key) : c.endRes[M.key]) : null);
    const polledAt = (c) => { const i = c.raw.months.indexOf(m); return i >= 0 && rdCycPolled(c, M.key, i); };
    const curWho = r.key === "onp" ? "One Nation" : r.key === "han" ? "Hanson" : r.key === "comb" ? "L/NP + ON" : cycHolderAt(cur, M, m);
    /* a tie with a past term goes the way the rank cell counts: "8th
       highest" puts this term above an equal past one, "3rd lowest" below */
    const curFirst = !!(r.rank && /highest/i.test(r.rank.main));
    const rowH = narrow ? RD_CSL_ROW_PHONE : RD_CSL_ROW;
    const list = (P ? P.vals.map((q) => ({ ...q, el: elOf(q.c), polled: polledAt(q.c) })) : [])
      .concat(r.v != null ? [{ v: r.v, who: curWho, yr: cur.year, c: cur, cur: true }] : [])
      .sort((a, b) => b.v - a.v || (a.cur ? (curFirst ? -1 : 1) : b.cur ? (curFirst ? 1 : -1) : a.yr - b.yr));
    const tipYr = tip && tip.key === r.key && P && P.vals[tip.i] ? P.vals[tip.i].yr : null;
    /* the count, not the set's name: the Compare-with pills just above
       already name it, and "Terms whose government was re-elected" ran
       into the scale */
    const setWords = (compare === "all" ? "All " : "") + list.length + " terms";
    /* the records: One Nation's row ranks it against past oppositions (it
       has never been one), but its records are its own - and only highs,
       since its lows are the years it barely registered. Hanson's row
       ranks her against opposition leaders, so her ratings join theirs. */
    const onpOwn = r.key === "onp";
    const spec = onpOwn ? { M, key: "onp", curKey: "onp", whoOf: () => "One Nation", people: false, positive: true }
      : { M, key: M.key, curKey: r.key, people: g === "leaders",
          whoOf: r.key === "han" || r.key === "comb" ? (c) => (c.current ? curWho : null) : null };
    const recs = rdCycRecords(cycles, hidden, chg, spec);
    const recTitle = (lo) => (chg
      ? (lo ? "Furthest below " : "Furthest above ") + (g === "leaders" ? "the term’s first reading" : onpOwn ? "its election result" : "the election result")
      : (onpOwn ? "One Nation’s own highs" : lo ? "Lowest" : "Highest") + " at any point in a term") + tail;
    const recRow = (e, i) => (
      <div key={e.yr + "|" + e.who} className={"rd-csr-row" + (e.cur ? " cur" : "")}>
        <span className="rd-csl-k">{i + 1}</span>
        <span className="rd-csl-name"><i className="rd-csl-pty" style={{ background: e.cur ? r.color : onpOwn ? D.PARTIES.onp.color : partyOf(e.c) }}></i><b>{e.who}</b><span className="rd-csl-yr">{e.yr}</span></span>
        <span className="rd-csr-v" style={e.cur ? { color: inkOf(r.color) } : null}>{r.fmt(e.v)}</span>
        <span className="rd-csr-when">{e.cur && e.m === m ? "Now" : rdCycWhen(e.c, e.m)}<span className="rd-csr-mo">, {e.m} {e.m === 1 ? "month" : "months"} in</span></span>
        <span className="rd-csr-oc">{e.cur ? "This term" : onpOwn ? "" : ocCell(e.c, e.who)}</span>
      </div>
    );
    /* the sitting term always shows: past the first five, after a gap, at
       its own place - each of its leaders' entries, on a leader's row
       (Ley's low this term as well as Taylor's) */
    const recList = (rows, lo) => {
      const pins = rows.map((e, i) => (e.cur && i >= 5 ? i : -1)).filter((i) => i >= 0);
      return (
        <div className="rd-csr-list">
          <div className="rd-csr-h">{recTitle(lo)}</div>
          {rows.slice(0, 5).map(recRow)}
          {pins.length > 0 && <div className="rd-csr-gap" aria-hidden="true"></div>}
          {pins.map((i) => recRow(rows[i], i))}
        </div>
      );
    };
    const firstOnp = onpOwn && recs ? recs.highs.reduce((a, e) => {
      const i = e.c.raw.months.findIndex((mo, j) => mo > 0 && e.c.raw.onp[j] > 0 && rdCycPolled(e.c, "onp", j));
      return i >= 0 && (!a || e.c.year < a.c.year) ? { c: e.c, m: e.c.raw.months[i] } : a;
    }, null) : null;
    /* whom a borrowed row is ranked against, said above the list it explains */
    const peerNote = onpOwn ? "One Nation has never been the opposition, so it is ranked against past oppositions’ primary votes."
      : r.key === "han" ? "No past term rated Hanson, so she is ranked against past opposition leaders’ net approval, and her ratings join their records."
      : r.key === "comb" ? (() => {
        const nil = cycles.filter((c) => !c.current && c.opp === "lnp" && rdOnpUnsplit(c)).map((c) => c.year);
        return "Only terms with the Coalition in opposition count. Before One Nation existed the Coalition’s vote stands alone"
          + (nil.length ? ", as it does in " + nil.join(" and ") + ", when polls didn’t report One Nation separately (it was polling about 1%)" : "") + ".";
      })()
      : null;
    const notes = [
      onpOwn ? "One Nation’s records are its own" + (firstOnp ? ", from its first poll in " + rdCycWhen(firstOnp.c, firstOnp.m) : "") + "." : null,
      g === "leaders" ? "In the records a leader counts once per term, at their lowest or highest month. Only months with a poll count."
        : "In the records a term counts once, at its lowest or highest month, so one long slump can’t fill the list. Only months with a poll count, not the election results.",
      hasEl && list.some((e) => e.el != null) ? <><i className="rd-csl-ring key" aria-hidden="true"></i>Where each past term finished: its result at the next election.</> : null,
      list.some((e) => e.polled === false) ? "≈ No poll that month: read from the months either side." : null,
    ].filter(Boolean);
    return (
      <div className="rd-csl" id={"rd-csl-" + r.key} role="region" aria-label={r.name + ": every term ranked, and the records"}>
        {peerNote && <p className="rd-csl-pn">{peerNote}</p>}
        <div className="rd-csl-head">
          <span className="rd-csl-h"><b>{setWords}, {m} months in</b><span className="rd-csl-hs"><span className="rd-csl-sep"> · </span>highest first</span></span>
          <span className="rd-csl-scale" aria-hidden="true">{scaleNow[g].ticks.map((q, i, a) => (
            <span key={q.v} className={(i % 2 ? "odd" : "") + (i === a.length - 1 ? " last" : "")} style={{ left: q.left + "%" }}>{q.lab}</span>
          ))}</span>
          <span className="rd-csl-nxh">{hasEl && <i className="rd-csl-ring key" aria-hidden="true"></i>}Next election</span>
          <button type="button" className="rd-link rd-csl-go" onClick={() => goTo(SEC[r.key])}>See every term on the chart ↓</button>
        </div>
        <RdCsUnroll className="rd-csl-list" style={{ height: list.length * rowH + "px" }}>
          <div className="rd-csl-bg" aria-hidden="true">
            <span className="rd-csl-bgt">
              {scaleNow[g].ticks.map((q) => <i key={q.v} className="rd-csl-gl" style={{ left: q.left + "%" }}></i>)}
              {P && P.n >= 3 && <i className="rd-csl-b80" style={{ left: X(sc, P.p10) + "%", width: X(sc, P.p90) - X(sc, P.p10) + "%" }}></i>}
              {P && P.n >= 3 && <i className="rd-csl-b50" style={{ left: X(sc, P.q1) + "%", width: X(sc, P.q3) - X(sc, P.q1) + "%" }}></i>}
              {P && <i className="rd-csl-mean" style={{ left: X(sc, P.mean) + "%" }}></i>}
            </span>
          </div>
          {list.map((e, k) => (
            <div key={e.yr} className={"rd-csl-row" + (e.cur ? " cur" : "") + (!e.cur && ((lit && lit.key === r.key && lit.yr === e.yr) || tipYr === e.yr) ? " on" : "")}
                 style={{ transform: "translateY(" + k * rowH + "px)", "--k": k }}
                 onMouseEnter={e.cur ? undefined : () => setLit({ key: r.key, yr: e.yr })} onMouseLeave={e.cur ? undefined : () => setLit(null)}>
              <span className="rd-csl-name"><span className="rd-csl-k">{k + 1}</span><i className="rd-csl-pty" style={{ background: e.cur ? r.color : partyOf(e.c) }}></i><b>{e.who}</b><span className="rd-csl-yr">{e.yr}</span></span>
              <span className="rd-csl-v" style={e.cur ? { color: inkOf(r.color) } : null}>{e.polled === false && <span className="rd-csl-ip">≈</span>}{r.fmt(e.v)}</span>
              <span className="rd-csl-trk">
                {e.el != null && (() => {
                  const a = X(sc, e.v), b = Math.min(100, Math.max(0, X(sc, e.el)));
                  return <><i className="rd-csl-run" style={{ left: Math.min(a, b) + "%", width: Math.abs(b - a) + "%" }}></i><i className="rd-csl-ring" style={{ left: b + "%" }}></i></>;
                })()}
                <i className={"rd-csl-dot" + (e.cur ? " cur" : "")} style={{ left: X(sc, e.v) + "%", background: e.cur ? r.color : undefined }}></i>
              </span>
              <span className="rd-csl-el">{e.el != null ? r.fmt(e.el) : ""}</span>
              <span className="rd-csl-oc">{e.cur ? "This term" : ocCell(e.c, e.who)}</span>
            </div>
          ))}
        </RdCsUnroll>
        {recs && (
          <div className={"rd-csr" + (onpOwn ? " one" : "")}>
            {!onpOwn && recList(recs.lows, true)}
            {recList(recs.highs, false)}
          </div>
        )}
        <div className="rd-csl-foot">
          <span className="rd-csl-notes">{notes.map((t, i) => <span key={i}>{t}</span>)}</span>
        </div>
      </div>
    );
  };

  const summary = (
    <div className="rd-cs" role="table" aria-label={"Every measure " + m + " months in, against past terms at the same point"}>
      <div className="rd-cs-head" role="row">
        <span role="columnheader">Measure</span><span role="columnheader" className="rd-cs-now">{chg ? "Change" : "Now"}</span>
        <span role="columnheader">Past terms, {m} months in</span><span role="columnheader">Against average</span><span role="columnheader">Rank</span><span></span>
      </div>
      {["votes", "leaders"].map((g) => (
        <React.Fragment key={g}>
          <div className="rd-cs-group" role="row">
            <span><b>{g === "votes" ? "Votes" : "Leaders"}</b> {g === "votes" ? (chg ? "points since the election" : "% of voters") : "net points"}</span>
            <span></span>
            <span className="rd-cs-scale">
              {scaleOut(g) && scaleOut(g).value[g].ticks.map((q) => <span key={"o" + scaleOut(g).id + "-" + q.v} className="out" aria-hidden="true" style={{ left: q.left + "%" }}>{q.lab}</span>)}
              {scaleNow[g].ticks.map((q) => <span key={scaleNow[g].key + "-" + q.v} className={scaleOut(g) ? "in" : undefined} style={{ left: q.left + "%" }}>{q.lab}</span>)}
            </span>
            <span></span><span></span><span></span>
          </div>
          {ROWS.filter((r) => r.group === g).map((r) => {
            const sc = SC[g], P = r.peers;
            const dd = P && r.v != null ? r.v - P.mean : null;
            const isOpen = openRow === r.key;
            return (
              <div key={r.key} className={"rd-cs-item" + (isOpen ? " open" : "")}>
              <div className="rd-cs-row" role="row" data-key={r.key} tabIndex={0} aria-expanded={isOpen} aria-controls={isOpen ? "rd-csl-" + r.key : undefined}
                   onClick={(ev) => toggleRow(r.key, ev.currentTarget)} onKeyDown={(ev) => rowNav(ev, r)}>
                <span role="cell" className="rd-cs-name"><b>{r.name}</b><span>{r.sub}</span></span>
                <span role="cell" className="rd-cs-now" style={{ color: inkOf(r.color) }}>{r.v != null ? r.fmt(r.v) : "—"}{r.v != null && Mby[r.key].unit === "%" && !chg ? <small>%</small> : null}</span>
                <span className="rd-cs-strip" aria-hidden="true">
                  {scaleOut(g) && scaleOut(g).value[g].ticks.map((q) => <i key={"o" + scaleOut(g).id + "-" + q.v} className="rd-cs-gl out" style={{ left: q.left + "%" }}></i>)}
                  {scaleNow[g].ticks.map((q) => <i key={scaleNow[g].key + "-" + q.v} className={"rd-cs-gl" + (scaleOut(g) ? " in" : "")} style={{ left: q.left + "%" }}></i>)}
                  {P && P.n >= 3 && <i className="rd-cs-b80" style={{ left: X(sc, P.p10) + "%", width: X(sc, P.p90) - X(sc, P.p10) + "%" }}></i>}
                  {P && P.n >= 3 && <i className="rd-cs-b50" style={{ left: X(sc, P.q1) + "%", width: X(sc, P.q3) - X(sc, P.q1) + "%" }}></i>}
                  {dotsWas && dotsWas.value[r.key].filter((q) => !dotsNow[r.key].some((d) => d.yr === q.yr)).map((q) => (
                    <i key={"o" + dotsWas.id + "-" + q.yr} className="rd-cs-dot out" aria-hidden="true" style={{ left: q.left + "%" }}></i>
                  ))}
                  {P && P.vals.map((q, qi) => (
                    <i key={q.yr} className={"rd-cs-dot" + ((tip && tip.key === r.key && tip.i === qi) || (lit && lit.key === r.key && lit.yr === q.yr) ? " on" : "")
                         + (dotsWas && !dotsWas.value[r.key].some((d) => d.yr === q.yr) ? " in" : "")} style={{ left: X(sc, q.v) + "%" }}
                       onMouseEnter={() => setTip({ key: r.key, i: qi })} onMouseLeave={() => setTip(null)}></i>
                  ))}
                  {P && <i className="rd-cs-mean" style={{ left: X(sc, P.mean) + "%" }}></i>}
                  {r.v != null && <i className="rd-cs-cur" style={{ left: X(sc, r.v) + "%", background: r.color }}></i>}
                  {tip && tip.key === r.key && P && P.vals[tip.i] && (() => {
                    const q = P.vals[tip.i];
                    const idx = cycles.findIndex((c) => c.year === q.yr);
                    const oc = outcomeOf(idx);
                    return (
                      <span className="tip rd-cs-tip" style={{ left: Math.min(80, Math.max(20, X(sc, q.v))) + "%" }}>
                        <span className="tip-title">{q.who}, {q.yr} term</span>
                        <span className="tip-row"><span className="tip-label">At {m} months</span><span className="tip-val">{r.fmt(q.v)}</span></span>
                        {oc && <span className="tip-row"><span className="tip-label">Next election</span><span className="tip-val">{oc === "returned" ? "Re-elected" : "Ousted"}</span></span>}
                      </span>
                    );
                  })()}
                </span>
                <span role="cell" className="rd-cs-avg">{dd != null ? <><b>{rdArrow(dd)} {Math.abs(dd).toFixed(1)} {dd >= 0 ? "above" : "below"}</b><span>average {r.fmt(P.mean)}</span></> : "—"}</span>
                <span role="cell" className={"rd-cs-rank" + (r.rank && r.rank.strong ? " strong" : "")}>{r.rank ? <><b>{r.rank.main}</b>{r.rank.sub && <span>{r.rank.sub}</span>}</> : "—"}</span>
                <span className="rd-cs-c-exp">
                  <button type="button" className={"rd-cs-exp" + (isOpen ? " open" : "")} aria-expanded={isOpen}
                          aria-label={(isOpen ? "Close" : "Open") + " every term’s " + r.name.replace(/^[A-Z]/, (x) => x.toLowerCase()) + ", ranked"}
                          onClick={(ev) => { ev.stopPropagation(); toggleRow(r.key, ev.currentTarget.closest(".rd-cs-row")); }}><svg viewBox="0 0 10 10" width="9" height="9" aria-hidden="true"><path d="M3 1.5L7.5 5 3 8.5z"></path></svg></button>
                </span>
              </div>
              {isOpen && ladderOf(r)}
              </div>
            );
          })}
        </React.Fragment>
      ))}
      <RdKey className="rd-ckey rd-cs-key" items={[{ kind: "dot", color: "var(--ink-3)", label: "A past term at the same point" }]}>
        <span className="rd-key-item"><span className="rd-cs-keyband" aria-hidden="true"><i></i></span>Middle half, and middle 80%, of past terms</span>
        <span className="rd-key-item"><span className="rd-cs-keymean" aria-hidden="true"></span>Their average</span>
        <span className="rd-key-item"><RdSwatch kind="dot-solid" color={cur.color} />The {cur.year} term</span>
        <span className="rd-key-item rd-cs-hint">{narrow ? "Tap a measure to rank every term" : "Open a measure to rank every term and see its records"}</span>
      </RdKey>
    </div>
  );

  /* ---- the comparison controls ------------------------------------------------------- */
  const liftedList = cycles.filter((c) => lifted.has(c.year) && !hidden.has(c.year));
  const pmNames = (c) => (c.raw.netEras && c.raw.netEras.length > 1 ? c.raw.netEras.map((e) => e.name).join("–") : c.lead);
  const CMP_ROWS = [["all", "All past terms", nPast], ["returned", "Re-elected", nRet], ["ousted", "Ousted", nOus]];
  const MODE_ROWS = ["abs", "chg"];
  /* the Compare-with choice is a view of its own, so it takes the phone
     swipe hand-rolled the way RdTabs' `swipe` prop does it (data-rd-swipe +
     __rdSwipe on the row; the app's touch effect finds and steps it,
     wrapping as the arrow-key walk does) */
  const cmpSwipeLive = React.useRef(null);
  cmpSwipeLive.current = (dir) => {
    const i = CMP_ROWS.findIndex(([id]) => id === compare);
    if (i < 0) return false;
    setCompare(CMP_ROWS[(i + dir + CMP_ROWS.length) % CMP_ROWS.length][0]);
    return true;
  };
  const cmpSwipe = React.useCallback((el) => { if (el) el.__rdSwipe = (dir) => cmpSwipeLive.current(dir); }, []);
  /* The Compare-with swipe's reach is the whole summary section, so the
     hover claim is: pointers anywhere over the section hand <-/-> to the
     comparison, except over the Measure row itself, whose claim is deeper
     and wins. Both step through the .current steppers (fresh closures
     every render, so the effect registers once), and both keep the row's
     own walk - focused tabs and the page-level key walk are untouched. */
  const modeSwipeLive = React.useRef(null);
  modeSwipeLive.current = (dir) => {
    const i = MODE_ROWS.indexOf(mode);
    if (i < 0) return false;
    setModePin(MODE_ROWS[(i + dir + MODE_ROWS.length) % MODE_ROWS.length]);
    return true;
  };
  const sumHover = React.useRef(false), measHover = React.useRef(false), measEl = React.useRef(null), measWalk = React.useRef(0);
  React.useEffect(() => {
    const sec = document.getElementById("cyc-summary"), meas = measEl.current;
    if (!sec) return undefined;
    const on = (el, ref) => {
      const enter = () => { ref.current = true; }, leave = () => { ref.current = false; };
      ref.current = el.matches(":hover");
      el.addEventListener("pointerenter", enter);
      el.addEventListener("pointerleave", leave);
      return [el, enter, leave];
    };
    const pairs = meas ? [on(sec, sumHover), on(meas, measHover)] : [on(sec, sumHover)];
    /* each mode step rewrites the head/dek ABOVE the rows, and near the top
       of the page the row slides out from under a parked pointer (the pin
       scroll can't hold it - the page can't scroll past the ceiling). A
       pointerleave from that slide would ladder the walk onto the Compare
       claim mid-gesture, so while the section is still hovered the walk's
       own step keeps measure claimed for a beat instead. */
    const key = (e) => {
      if ((!sumHover.current && !measHover.current) || (e.key !== "ArrowRight" && e.key !== "ArrowLeft")) return;
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const a = document.activeElement;
      if (a && a.tagName !== "BODY" && a.tagName !== "HTML") return;
      const sel = window.getSelection && window.getSelection();
      if (sel && !sel.isCollapsed) return;
      const dir = e.key === "ArrowRight" ? 1 : -1, mo = measEl.current;
      if ((measHover.current || (sumHover.current && Date.now() - measWalk.current < 800)) && mo && mo.isConnected && mo.getClientRects().length) {
        if (modeSwipeLive.current(dir)) { measWalk.current = Date.now(); e.preventDefault(); }
        return;
      }
      if (cmpSwipeLive.current(dir)) e.preventDefault();
    };
    document.addEventListener("keydown", key, true);
    return () => {
      pairs.forEach(([el, enter, leave]) => { el.removeEventListener("pointerenter", enter); el.removeEventListener("pointerleave", leave); });
      document.removeEventListener("keydown", key, true);
    };
  }, []);
  const controls = (
    <div className="rd-cc" ref={boardRef}>
      <div className="rd-cc-row">
        <span className="rd-cc-l">Compare with</span>
        <div className="rd-tabs rd-cc-tabs" role="group" aria-label="Compare with"
             ref={cmpSwipe} data-rd-swipe=""
             onKeyDown={rdTabsKey(CMP_ROWS.map(([id]) => ({ id })), setCompare)} onClick={rdTabFocus}>
          {CMP_ROWS.map(([id, lab, n]) => (
            <button key={id} type="button" className="rd-tab" aria-pressed={compare === id} onClick={() => setCompare(id)}>{narrow && id === "all" ? "All" : lab}<span className="rd-cc-n">{n}</span></button>
          ))}
        </div>
        <span className="rd-cc-sep" aria-hidden="true"></span>
        <div className="rd-tabs rd-cc-tabs" role="group" aria-label="Measure" ref={measEl}
             onKeyDown={rdTabsKey(MODE_ROWS.map((id) => ({ id })), setModePin)} onClick={rdTabFocus}>
          <button type="button" className="rd-tab" aria-pressed={!chg} onClick={() => setModePin("abs")}>Level</button>
          <button type="button" className="rd-tab" aria-pressed={chg} onClick={() => setModePin("chg")}>{narrow ? "Change" : "Change since election"}</button>
        </div>
      </div>
      {board.open && (
        <div className={"rd-cc-board" + boardPane} role="dialog" aria-label="Past terms">
          <div className="rd-cc-bhead">
            <b>Past terms</b><span>{cycles.length - hidden.size - (hidden.has(cur.year) ? 0 : 1)} on the board, {liftedList.length} drawn as their own line</span>
            <span className="rd-grow"></span>
            <button type="button" className="rd-link" onClick={() => { cycles.forEach((c) => { if (!c.current && !lifted.has(c.year) && !hidden.has(c.year)) toggle(c.year); }); }}>Only the drawn terms</button>
            <button type="button" className="rd-link" onClick={() => liftedList.forEach((c) => unlift(c.year))}>Clear lines</button>
            <button type="button" className="rd-iconbtn" aria-label="Close" onClick={() => setBoard({ open: false, sheet: null })}>×</button>
          </div>
          <div className="rd-cc-grid">
            {cycles.map((c, i) => {
              const off = hidden.has(c.year), drawn = lifted.has(c.year) && !off;
              const oc = outcomeOf(i);
              return (
                <span key={c.year} className={"rd-cc-term" + (off ? " off" : "") + (drawn ? " drawn" : "") + (c.current ? " current" : "")}
                      onMouseEnter={() => setHi(c.year)} onMouseLeave={() => setHi(null)}>
                  <button type="button" className="rd-cc-main" aria-pressed={drawn || (c.current && !off)} disabled={c.current}
                          onClick={() => chipClick(c.year)} title={off ? "Put " + c.year + " back on the board" : drawn ? "Return " + c.year + " to the band" : "Draw " + c.year + " as its own line"}>
                    <span className="rd-cc-rule" style={{ background: c.color, opacity: drawn || c.current ? 1 : 0.4 }}></span>
                    <b>{c.year}</b><span>{pmNames(c)}</span>
                  </button>
                  {c.current ? <span className="rd-cc-now">This term</span> : <span className="rd-cc-oc">{oc === "returned" ? "Re-elected" : "Ousted"}</span>}
                  <button type="button" className="rd-cc-x" aria-label={(off ? "Put " : "Take ") + c.year + (off ? " back on the board" : " off the board")} onClick={() => toggle(c.year)}>{off ? "+" : "×"}</button>
                </span>
              );
            })}
          </div>
          <p className="rd-note">Click a term to draw its own line over the band, and again to put it back. The × takes it off the board altogether: out of the band, the average and the download. With three terms or fewer on the board, the band gives way to the polls under each line.</p>
        </div>
      )}
    </div>
  );

  /* the sitting term's events, numbered once for each pair of half-width
     charts so the list under the pair serves both */
  const pairOf = (keys) => rdEventBadges("cy" + cur.year, (CYC_EVENTS[cur.year] || [])
    .filter((e) => !e.metrics || e.metrics.some((k) => keys.includes(k)))
    .map((e) => ({ ...e, x: cycEventMonth(e.date, cur.eDate) })), -2, 38);
  const PAIRS = { primary: pairOf(["primary", "oppr"]), leaders: pairOf(["ppmm", "oppnet"]) };
  /* Each pair of half charts shares the one numbered list, so the open
     event lives here: a pick opens it in the pair's first chart whose
     measures carry the event (the rest of the routing is the chart's own
     controlled-evt contract), and only one chart of a pair holds it at a
     time. A metric-less event draws in both, so its pick goes to the
     left-hand chart and its scroll anchor exists only there. */
  const [evt, setEvt] = useState({ primary: null, oppr: null, ppmm: null, oppnet: null });
  const onEvtOf = (key) => (v) => setEvt((s) => (s[key] === v ? s : { ...s, [key]: v }));
  const pickPair = (pair, keys) => (e) => {
    const k = keys.find((c) => !e.metrics || e.metrics.includes(c));
    if (k) setEvt((s) => {
      if (s[k] && s[k].e === e) return s;
      const nx = { ...s };
      keys.forEach((c) => { nx[c] = null; });
      nx[k] = { e };
      return nx;
    });
    if (k) rdEventReveal("evt-a-" + e.badgeKey);
  };
  const pickEvOf = { primary: pickPair("primary", ["primary", "oppr"]), leaders: pickPair("leaders", ["ppmm", "oppnet"]) };
  const openKeyOf = (keys) => {
    for (const k of keys) { if (evt[k] && evt[k].e) return evt[k].e.badgeKey; }
    return null;
  };
  const chart = (key, half, pair) => {
    const M = Mby[key];
    const evs = pair ? PAIRS[pair].events.filter((e) => !e.metrics || e.metrics.includes(key)) : null;
    return <CycleChart key={key} metric={M} cycles={cycles} mode={mode} hidden={hidden} hi={hi} setHi={setHi} lifted={lifted} unlift={unlift}
                       chipClick={chipClick} toggle={toggle} showAll={showAll} hideAll={hideAll} showOutcome={showOutcome}
                       showHan={showHan} setHan={setShowHan} showOnp={showOnp} setOnp={setShowOnp}
                       showComb={showComb} setComb={setShowComb} shapes={shapes}
                       outcomeShown={outcomeShown} rdHalf={half} rdEvents={evs}
                       evtOut={pair ? evt[key] : null} onEvtOut={pair ? onEvtOf(key) : null} />;
  };
  /* The key names the sitting term's own lines and its election ring as well
     as the band, as the canvas did: the lines were keyed only by the words at
     their ends, and the ring not at all. */
  const twoLines = (a, b) => (
    <svg width="30" height="14" viewBox="0 0 30 14" aria-hidden="true">
      <path d="M1 7H13" style={{ stroke: a, strokeWidth: 3, strokeLinecap: "round" }} />
      <path d="M17 7H29" style={{ stroke: b, strokeWidth: 3, strokeLinecap: "round" }} />
    </svg>
  );
  const bandKey = (sec) => (
    <RdKey className="rd-ckey" items={[]}>
      <span className="rd-key-item"><span className="rd-cs-keyband" aria-hidden="true"><i></i></span>Middle half and middle 80% of past terms</span>
      <span className="rd-key-item"><RdSwatch kind="dash" color="var(--ink-2)" />Their average</span>
      <span className="rd-key-item"><span className="rd-cs-keythin" aria-hidden="true"></span>Paler: fewer terms ran this long</span>
      {sec === "tpp" && <span className="rd-key-item"><RdSwatch kind="line" color={cur.color} />The {cur.year} term, monthly</span>}
      {sec === "primary" && <span className="rd-key-item">{twoLines(D.PARTIES[cur.gov].color, D.PARTIES[cur.opp].color)}The {cur.year} term: {govName}, {oppIn}</span>}
      {sec === "leaders" && <span className="rd-key-item">{twoLines(D.PARTIES[cur.gov].color, D.PARTIES[cur.opp].color)}The {cur.year} term: {pm}, the opposition leader</span>}
      {(sec === "tpp" || sec === "primary") && <span className="rd-key-item"><RdSwatch kind="ring" />Each term’s election results</span>}
    </RdKey>
  );
  /* the list reads as one sentence, "and" before the last and no commas */
  const navs = [["cyc-tpp", "Two-party preferred"], ["cyc-primary", "Primary vote"], ["cyc-leaders", "Leadership"], ["final-polls", "How the final polls did"]];
  /* the final polls' record answers to none of the controls above it, so it
     is made once and handed back unchanged: React skips an element it has
     already drawn, and a Level/Change press stops redrawing the whole panel */
  const accuracy = React.useMemo(() => <AccuracyPanel />, []);
  return (
    <div className="view view-cycles rd-cycles">
      <section className="rd-sec rd-first" id="cyc-summary" aria-labelledby="rd-cyc-t">
        <div className="rd-eyebrow">
          <h2 className="rd-title" id="rd-cyc-t">Past cycles</h2>
          <span className="rd-meta">Every term since {cycles[0].year}, lined up on its own election day</span>
          {!narrow && <nav className="rd-eyebrow-tools rd-cyc-nav" aria-label="On this page">{navs.map(([id, lab], i) => <button key={id} type="button" onClick={() => goTo(id)}>{(i === navs.length - 1 ? "and " : "") + lab}</button>)}</nav>}
        </div>
        <div ref={storySlotRef} style={storyFloor ? { minHeight: storyFloor + "px" } : null}>
          <RdHed head={pageStory.head} dek={pageStory.dek} level={2} />
        </div>
        <div className="rd-cyc-storyvar" ref={storyVarRef} aria-hidden="true">
          {storyVariants.map((v) => (
            <div key={v.key}><h2 className="rd-hed">{v.story.head}</h2><p className="rd-dek">{v.story.dek}</p></div>
          ))}
        </div>
        {srcFailed && <p className="rd-note">The individual polls behind the past terms didn’t load; the monthly lines are unaffected. <button type="button" className="rd-link" onClick={retrySource}>Try again</button></p>}
        {controls}
        {summary}
        <div className="rd-foot">
          <span className="rd-foot-text">Each term is lined up on its own election day, so month {m} is the same distance into every one of them. Past terms are averaged month by month the way this term is; where a term changed leader, its line follows whoever held the office.</span>
          <span className="rd-grow"></span>
          <button type="button" className="rd-how rd-cyc-csv" onClick={exportSource}><DownloadIcon /> Source polls, CSV</button>
          <RdHow term="what-am-i-looking-at" from="Past cycles" />
        </div>
      </section>
      <RdSec id="cyc-tpp" title="Two-party preferred" meta="Implied from each poll’s primary votes, on the flows counted at the election that opened its term"
             tools={<span className="rd-cyc-chipmove" ref={chipmoveRef}>
               <button type="button" className="rd-chip" aria-expanded={board.open} onClick={() => setBoard((b) => (b.open ? { open: false, sheet: null } : { open: true, sheet: null }))}>＋ {narrow ? "Draw a term" : "Draw a past term"}</button>
               {liftedList.length > 0 && (
                 <span className="rd-cc-drawn">
                   <span className="rd-cc-l">Drawn over the band</span>
                   {liftedList.map((c) => (
                     <span key={c.year} className="rd-cc-pill" style={{ borderColor: c.color }}>
                       <span className="rd-cc-rule" style={{ background: c.color }}></span>{c.year} {pmNames(c)}
                       <button type="button" aria-label={"Return " + c.year + " to the band"} onClick={() => unlift(c.year)}>×</button>
                     </span>
                   ))}
                   {/* the sitting term draws over the band too (it was never IN the
                       band to lift out of) - it says so as an unliftable pill; only
                       not at all on the board when the reader has hidden its term.
                       Its cross takes the term off the board like any other's
                       (it comes back from the board's own eye) */}
                   {!hidden.has(cur.year) && (
                     <span className="rd-cc-pill rd-cc-cur" style={{ borderColor: cur.color }}>
                       <span className="rd-cc-rule" style={{ background: cur.color }}></span>{cur.year} {pmNames(cur)}
                       <button type="button" aria-label={"Take the " + cur.year + " term off the board"} onClick={() => toggle(cur.year)}>×</button>
                     </span>
                   )}
                 </span>
               )}
             </span>}>
        {tppStory && <RdHed head={tppStory.head} dek={tppStory.dek} />}
        <div className="rd-cyc-one">{chart("tpp", false)}</div>
        {bandKey("tpp")}
        <RdFoot how={{ term: "last-election-flows", from: "Past cycles" }}>
          Every line is the implied two-party figure: each poll’s primary votes read through the preferences counted at the election that opened its term, the only table anyone could have used at the time. The {cur.year} term follows the rival {govName} is doing worst against, as the headline does. Each line’s dotted start runs from the election’s counted result to the term’s first poll, and a past line’s dotted end runs from its final poll to the closing election’s count.
        </RdFoot>
      </RdSec>
      <RdSec id="cyc-primary" title="Primary vote" meta="First preferences for the governing party and the main opposition party">
        {primStory && <RdHed head={primStory.head} dek={primStory.dek} />}
        <div className="rd-cyc-two">{chart("primary", true, "primary")}{chart("oppr", true, "primary")}</div>
        <RdEventList list={PAIRS.primary.list} inline onPick={pickEvOf.primary} openKey={openKeyOf(["primary", "oppr"])} />
        {bandKey("primary")}
        <RdFoot how={{ term: "what-am-i-looking-at", from: "Past cycles" }}>
          Past terms are the governing party and the main opposition party of the day. A month with no poll is filled in from the months either side, and a drawn term shows that stretch dashed. The dotted start of each line runs from the election’s counted result to the term’s first poll; the dotted end of a past line runs from its final poll to the closing election’s count.
        </RdFoot>
      </RdSec>
      <RdSec id="cyc-leaders" title="Leadership" meta="Net approval since 1972 and preferred PM since 1984, for whoever held the office">
        {leadStory && <RdHed head={leadStory.head} dek={leadStory.dek} />}
        <div className="rd-cyc-one">{chart("net", false)}</div>
        <div className="rd-cyc-two rd-cyc-subs">
          <div><RdSub head="Preferred prime minister" dek="The prime minister’s lead over the opposition leader on the question of who would make the better PM. Asked since 1984." />{chart("ppmm", true, "leaders")}</div>
          <div><RdSub head="Opposition leader’s net approval" dek="Approve minus disapprove, for whoever led the opposition at the time. Rated since 1972." />{chart("oppnet", true, "leaders")}</div>
        </div>
        <RdEventList list={PAIRS.leaders.list} inline onPick={pickEvOf.leaders} openKey={openKeyOf(["ppmm", "oppnet"])} />
        {bandKey("leaders")}
        <RdFoot how={{ term: "approval", from: "Past cycles" }}>
          Where a term changed leader its line follows whoever held the office. The earliest terms’ ratings are the Morgan Gallup Poll’s; later terms pool every pollster that asked, each corrected for its lean. Favourability ratings are left out.
        </RdFoot>
      </RdSec>
      {accuracy}
    </div>
  );
}

Object.assign(window, { RdCycleChart, RdPastCycles, rdCycPeers, rdCycRank });
