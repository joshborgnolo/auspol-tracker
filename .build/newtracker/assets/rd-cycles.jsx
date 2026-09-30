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

/* ---- one chart, in the redesign's frame --------------------------------- */
function RdCycleChart({ M, chg, built, bandAreas, bandRows, scatter, events: evIn, badged, domain, ticks, cur, hidden, narrow, half,
                        hanCtl, showHan, setHan, showOnp, setOnp, showComb, setComb, tipCycle, banded, bandN, isOpp, terms, outcomeShown }) {
  const { D } = window.AP;
  /* the sitting term's change of contest, said as the headline says it */
  const events = evIn.map((e) => (/^Now v /.test(e.short || "")
    ? { ...e, short: e.short.replace(/^Now /, "") + " from " + D.monthNameFull(Number(e.date.slice(5, 7))) } : e));
  const nowM = cur && !hidden.has(cur.year) ? cur.span : null;
  const curVal = nowM != null ? (chg ? cur.end[M.key] - cycBase(cur, M.key) : cur.end[M.key]) : null;
  const peer = nowM != null ? bandRows.find((r) => r.m === nowM) : null;
  const subj = M.key === "net" || M.key === "ppmm" ? sitting(cur ? cur.pm : "")
    : M.key === "oppnet" ? sitting(cur ? cur.oppLead : "")
    : cur ? (isOpp ? D.PARTIES[cur.opp].name : D.PARTIES[cur.gov].name) : "";
  const subjColor = cur ? (isOpp ? D.PARTIES[cur.opp].color : cur.color) : "var(--ink)";
  const fmt = (v) => (M.unit === "%" && !chg ? v.toFixed(1) : rdSgn(v, false));
  /* the series, in the redesign's weights and words */
  const series = built.map((s) => {
    if (s.id === "cyc-band-mean") return { ...s, label: "Past-term average", dash: "4 3", rdWidth: 1.5, endLabel: "Average", endLabelOpacity: 1 };
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
    notes.push({ k: "gap", x: nowM, y: curVal, dx: 10, dy: dys[1], text: Math.abs(d).toFixed(1) + (d >= 0 ? " above" : " below") + " average", size: 12.5 });
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
  if (!chg && M.key === "tpp") {
    notes.push({ x: "left", y: 50, dy: -6, text: "▲ Government ahead", size: 11.5 });
    notes.push({ x: "left", y: 50, dy: 15, text: "▼ Opposition ahead", size: 11.5 });
  }
  const marks = [];
  if (peer && curVal != null) marks.push({ k: "mean", x: nowM, y: peer.mean, r: 3.5, color: "var(--ink-2)" });
  /* The election-result ring sits where the term's line starts. Change mode
     draws no ring - the "Result" rule says it - but keeps one, unseen, at
     zero, so on the switch the ring travels with the line's start as it
     fades rather than parting from it. */
  if (cur && !hidden.has(cur.year) && (M.key === "tpp" || M.key === "primary" || M.key === "oppr") && cur.base[M.key] != null)
    marks.push({ k: "base", x: 0, y: chg ? 0 : cur.base[M.key], r: 5, ...(chg ? { opacity: 0 } : {}) });
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
  /* a pair of half-width charts shares one numbered list, made by the tab;
     a lone chart on a phone numbers its own */
  const badges = badged ? { events, list: null } : narrow ? rdEventBadges("cy", events.filter((e) => e.date), -2, 38) : null;
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
        {M.onp && <RdCheck checked={showComb} onChange={setComb}>Combine L/NP and ON</RdCheck>}
        {M.onp && <RdCheck checked={showOnp} onChange={setOnp}>One Nation this term</RdCheck>}
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
        events={badges ? badges.events : events} notes={notesNow} marks={marksNow} brackets={bracketsNow}
        tooltipTitle={(i) => cycMonthLabel(CYC_SPINE[i].x) + (tipCycle ? " – " + cycMonthOf(tipCycle.eDate, CYC_SPINE[i].x) : "")}
        extraRows={(i) => {
          const r = bandRows.find((b) => b.m === CYC_SPINE[i].x);
          return r && banded ? [{ label: "Middle half", value: fmt(r.q1) + "–" + fmt(r.q3) }, { label: "Middle 80%", value: fmt(r.p10) + "–" + fmt(r.p90) }] : [];
        }}
        fmt={(v) => fmt(v)} pollFacet={M.key === "tpp" ? "twopp" : M.key === "primary" || M.key === "oppr" ? "primary" : "leadership"}
        copy={{ title: copyTitle, sub: banded ? "Against the middle half and middle 80% of " + bandN + " past terms"
          + (outcomeShown === "returned" ? " whose government was re-elected" : outcomeShown === "ousted" ? " whose government was ousted" : "") : "", terms }}
      />
      {badges && badges.list && <RdEventList list={badges.list} />}
    </div>
  );
}

/* the past terms at one month for one measure: the same pooled set the band
   draws, with who each value belongs to */
function rdCycPeers(M, cycles, hidden, chg, m) {
  const hasData = (c) => (c.raw[M.key] || []).some((v) => v != null);
  const vals = [];
  cycles.filter((c) => !c.current && !hidden.has(c.year) && hasData(c)).forEach((c) => {
    const p = toMonthly(c.raw.months, c.raw[M.key], c.span)[m];
    if (!p || p.y == null) return;
    vals.push({ v: chg ? +(p.y - cycBase(c, M.key)).toFixed(2) : p.y, who: cycHolderAt(c, M, m), yr: c.year, c });
  });
  if (!vals.length) return null;
  vals.sort((a, b) => a.v - b.v);
  const nums = vals.map((p) => p.v);
  return { vals, n: nums.length, mean: nums.reduce((s, v) => s + v, 0) / nums.length,
           q1: pctOf(nums, 0.25), q3: pctOf(nums, 0.75), p10: pctOf(nums, 0.1), p90: pctOf(nums, 0.9) };
}
function rdCycRank(peers, v, fmt) {
  const above = peers.vals.filter((p) => p.v > v).length, below = peers.vals.filter((p) => p.v < v).length;
  const n = peers.n + 1;
  const hiR = above + 1, loR = below + 1;
  const top = peers.vals[peers.vals.length - 1], low = peers.vals[0];
  if (hiR === 1) return { main: "Highest of " + n, sub: "Previous high: " + top.who + ", " + fmt(top.v), strong: true };
  if (loR === 1) return { main: "Lowest of " + n, sub: "Previous low: " + low.who + ", " + fmt(low.v), strong: true };
  if (above === below) return { main: "Middle of " + n };
  if (hiR < loR) return { main: rdOrd(hiR) + " highest of " + n, sub: hiR === 2 ? "Only " + top.who + " (" + top.yr + ") was higher" : null };
  return { main: rdOrd(loR) + " lowest of " + n, sub: loR === 2 ? "Only " + low.who + " (" + low.yr + ") was lower" : null };
}

/* ---- the tab --------------------------------------------------------------- */
function RdPastCycles(p) {
  const { cycles, mode, setMode, hidden, lifted, hi, setHi, toggle, lift, unlift, chipClick, showAll, hideAll,
          showOutcome, outcomeShown, shapes, showHan, setShowHan, showOnp, setShowOnp, showComb, setShowComb, exportSource, srcFailed, retrySource } = p;
  const { D } = window.AP;
  const narrow = useNarrow("(max-width: 640px)");
  const [board, setBoard] = useState(false);
  const [tip, setTip] = useState(null);
  const boardRef = React.useRef(null);
  window.useDismissOutside(boardRef, board, () => setBoard(false));
  /* Walking the compare sets or the measure rewrites the head and dek
     above this row; scrolled past them under the sticky tabs, each step
     then drags the row and charts up or down mid-walk. rdPinScroll (in
     rd.jsx, shared with the other tab rows) holds the row's spot on
     screen through the head/dek glide instead. Deeper in the summary the
     row itself is off the screen: anchor the reader's own strip, key or
     foot instead or nothing holds the spot at all - Chrome's native
     scroll anchoring papers over that gap there, but Safari has no
     overflow-anchor and every compare swipe shoved the reader down the
     page by the dek's height swing */
  const pinView = () => {
    const sec = document.getElementById("cyc-summary");
    const strip = sec && [...sec.querySelectorAll(".rd-cs-row")].find((el) => {
      const r = el.getBoundingClientRect();
      return r.bottom >= 0 && r.top <= window.innerHeight;
    });
    rdPinScroll([boardRef.current, strip,
                 sec && sec.querySelector(".rd-cs-key"), sec && sec.querySelector(".rd-foot")]);
  };
  const chg = mode === "chg";
  const cur = cycles.find((c) => c.current);
  const m = cur ? cur.span : 0;
  const Mby = {};
  CYC_METRICS.forEach((M) => { Mby[M.key] = M; });
  const curOf = (key) => (chg ? cur.end[key] - cycBase(cur, key) : cur.end[key]);
  const peersOf = (key) => rdCycPeers(Mby[key], cycles, hidden, chg, m);
  const fmtOf = (key) => (v) => (Mby[key].unit === "%" && !chg ? v.toFixed(1) : rdSgn(v, false));
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
     so it is put straight back (toggle's update runs after showOutcome's). */
  const setCompare = (id) => {
    pinView();
    if (id === "all") { showAll(); return; }
    showOutcome(id);
    if (cur) toggle(cur.year);
  };
  const setModePin = (id) => { pinView(); setMode(id); };

  /* ---- the rows -------------------------------------------------------------- */
  const ROWS = [
    { key: "tpp", name: "Two-party preferred", sub: govName + ", against " + rivalWord.replace(/^the /, "the "), group: "votes", color: cur.color },
    { key: "primary", name: "Government’s primary vote", sub: govName, group: "votes", color: cur.color },
    { key: "oppr", name: "Opposition’s primary vote", sub: rdCap(oppIn), group: "votes", color: D.PARTIES[cur.opp].color },
    { key: "ppmm", name: "Preferred PM, lead", sub: pm + " over " + oppL, group: "leaders", color: cur.color },
    { key: "net", name: "Prime minister’s net approval", sub: pm, group: "leaders", color: cur.color },
    { key: "oppnet", name: "Opposition leader’s net approval", sub: oppL, group: "leaders", color: D.PARTIES[cur.opp].color },
  ].map((r) => {
    const peers = peersOf(r.key);
    const v = cur.end[r.key] != null ? curOf(r.key) : null;
    return { ...r, peers, v, fmt: fmtOf(r.key), rank: peers && v != null ? rdCycRank(peers, v, fmtOf(r.key)) : null };
  });
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
  const R = {};
  ROWS.forEach((r) => { R[r.key] = r; });
  /* With "Change since election" on, every rank is a rank of the change, so
     the lowest is the biggest fall (or the smallest rise). The words say so:
     they used to call it a record low, and the head could claim a party was
     at its lowest level on the strength of how far it had fallen. */
  const pts1 = (v) => Math.abs(v).toFixed(1);
  const upDown = (v) => (v < 0 ? "down " : "up ") + pts1(v);
  /* The findings rank this term against the past terms in the comparison,
     so a superlative says which ones: with Re-elected picked, "the lowest of
     any prime minister" left out Whitlam, who was lower. `tail` closes the
     sentence that makes the claim; "since 1972" belongs to the full set. */
  const tail = compare === "all" ? "" : compare === "returned" ? ", among terms whose government was re-elected"
    : compare === "ousted" ? ", among terms whose government was ousted" : ", among the terms on the board";
  const since = compare === "all" ? " since " + cycles[0].year : "";
  const pageStory = (() => {
    const g = R.primary, o = R.oppr, t = R.tpp;
    const gLow = g.rank && /^Lowest/.test(g.rank.main), oLow = o.rank && /^Lowest/.test(o.rank.main);
    const moved = (r) => (r.v < 0 ? "fallen further" : "risen less");
    const found = chg
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
    const head = found ? found + tail : "Every term since " + cycles[0].year + ", lined up on its election day";
    let dek = monthsWord + " after the " + cur.year + " election, ";
    const bits = [];
    const extreme = (r) => (r.v < 0 ? "the biggest fall" : "the smallest rise");
    if (chg) {
      if (gLow) bits.push(govName + "’s primary vote is " + upDown(g.v) + " points, " + extreme(g) + " for any government at that point" + since);
      if (oLow) bits.push((gLow ? "and " + oppIn + "’s is " : oppIn + "’s primary vote is ") + upDown(o.v) + " points, " + extreme(o) + " for any opposition");
    } else {
      if (gLow) bits.push(govName + "’s primary vote is the lowest of any government at the same point" + since);
      if (oLow) bits.push((gLow ? "and " + oppIn + "’s" : oppIn + "’s primary vote is") + " the lowest of any opposition");
    }
    /* a rank counts this term among its peers, so "of 21" is 21 governments,
       twenty of them past */
    const rankWords = (r) => (/^Middle/.test(r.rank.main) ? "in the " : "the ") + r.rank.main.toLowerCase().replace(/ of (\d+)$/, " of $1 governments");
    dek += bits.length ? bits.join(", ") + tail + "."
      : g.v == null || !g.rank ? govName + "’s primary vote has no reading to set against past governments yet."
      : chg ? govName + "’s primary vote is " + upDown(g.v) + " points since the election; past governments were "
          + (g.peers.mean < 0 ? "down " : "up ") + pts1(g.peers.mean) + " on average by now" + tail + "."
      : govName + "’s primary vote is " + rankWords(g) + " at this point" + tail + ".";
    if (t.peers && t.v != null && !chg) {
      const past = tail ? "those governments" : "past governments";
      const where = t.v >= t.peers.q1 && t.v <= t.peers.q3 ? "sits in the middle half of " + past
        : t.v > t.peers.q3 ? "is above three in four of " + past : "is below three in four of " + past;
      dek += " After preferences, " + (bits.length ? "though, " : "") + govName + "’s " + t.v.toFixed(1) + "% " + where + ".";
    }
    return { head, dek };
  })();
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
        : /^2nd lowest/.test(rk.main) ? pm + "’s net approval has " + less + " than any prime minister’s at this point but " + low.who + "’s"
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
      : /^2nd lowest/.test(rk.main) ? pm + "’s net approval is the second lowest of any prime minister at this point, after " + low.who + "’s"
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
  const SEC = { tpp: "cyc-tpp", primary: "cyc-primary", oppr: "cyc-primary", ppmm: "cyc-leaders", net: "cyc-leaders", oppnet: "cyc-leaders" };
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
            return (
              <div key={r.key} className="rd-cs-row" role="row">
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
                    <i key={q.yr} className={"rd-cs-dot" + (tip && tip.key === r.key && tip.i === qi ? " on" : "")
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
                <button type="button" className="rd-cs-go" aria-label={"Go to the " + r.name.toLowerCase() + " chart"} onClick={() => goTo(SEC[r.key])}>↓</button>
              </div>
            );
          })}
        </React.Fragment>
      ))}
      <RdKey className="rd-ckey rd-cs-key" items={[{ kind: "dot", color: "var(--ink-3)", label: "A past term at the same point" }]}>
        <span className="rd-key-item"><span className="rd-cs-keyband" aria-hidden="true"><i></i></span>Middle half, and middle 80%, of past terms</span>
        <span className="rd-key-item"><span className="rd-cs-keymean" aria-hidden="true"></span>Their average</span>
        <span className="rd-key-item"><RdSwatch kind="dot-solid" color={cur.color} />The {cur.year} term</span>
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
        <span className="rd-grow"></span>
        <button type="button" className="rd-chip" aria-expanded={board} onClick={() => setBoard((b) => !b)}>＋ {narrow ? "Draw a term" : "Draw a past term"}</button>
      </div>
      {liftedList.length > 0 && (
        <div className="rd-cc-drawn">
          <span className="rd-cc-l">Drawn over the band</span>
          {liftedList.map((c) => (
            <span key={c.year} className="rd-cc-pill" style={{ borderColor: c.color }}>
              <span className="rd-cc-rule" style={{ background: c.color }}></span>{c.year} {pmNames(c)}
              <button type="button" aria-label={"Return " + c.year + " to the band"} onClick={() => unlift(c.year)}>×</button>
            </span>
          ))}
        </div>
      )}
      {board && (
        <div className="rd-cc-board" role="dialog" aria-label="Past terms">
          <div className="rd-cc-bhead">
            <b>Past terms</b><span>{cycles.length - hidden.size - 1} on the board, {liftedList.length} drawn as their own line</span>
            <span className="rd-grow"></span>
            <button type="button" className="rd-link" onClick={() => { cycles.forEach((c) => { if (!c.current && !lifted.has(c.year) && !hidden.has(c.year)) toggle(c.year); }); }}>Only the drawn terms</button>
            <button type="button" className="rd-link" onClick={() => liftedList.forEach((c) => unlift(c.year))}>Clear lines</button>
            <button type="button" className="rd-iconbtn" aria-label="Close" onClick={() => setBoard(false)}>×</button>
          </div>
          <div className="rd-cc-grid">
            {cycles.map((c, i) => {
              const off = hidden.has(c.year), drawn = lifted.has(c.year) && !off;
              const oc = outcomeOf(i);
              return (
                <span key={c.year} className={"rd-cc-term" + (off ? " off" : "") + (drawn ? " drawn" : "") + (c.current ? " current" : "")}
                      onMouseEnter={() => setHi(c.year)} onMouseLeave={() => setHi(null)}>
                  <button type="button" className="rd-cc-main" aria-pressed={drawn || c.current} disabled={c.current}
                          onClick={() => chipClick(c.year)} title={off ? "Put " + c.year + " back on the board" : drawn ? "Return " + c.year + " to the band" : "Draw " + c.year + " as its own line"}>
                    <span className="rd-cc-rule" style={{ background: c.color, opacity: drawn || c.current ? 1 : 0.4 }}></span>
                    <b>{c.year}</b><span>{pmNames(c)}</span>
                  </button>
                  {c.current ? <span className="rd-cc-now">This term</span> : <span className="rd-cc-oc">{oc === "returned" ? "Re-elected" : "Ousted"}</span>}
                  {!c.current && <button type="button" className="rd-cc-x" aria-label={(off ? "Put " : "Take ") + c.year + (off ? " back on the board" : " off the board")} onClick={() => toggle(c.year)}>{off ? "+" : "×"}</button>}
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
  const chart = (key, half, pair) => {
    const M = Mby[key];
    const evs = pair ? PAIRS[pair].events.filter((e) => !e.metrics || e.metrics.includes(key)) : null;
    return <CycleChart key={key} metric={M} cycles={cycles} mode={mode} hidden={hidden} hi={hi} setHi={setHi} lifted={lifted} unlift={unlift}
                       chipClick={chipClick} toggle={toggle} showAll={showAll} hideAll={hideAll} showOutcome={showOutcome}
                       showHan={showHan} setHan={setShowHan} showOnp={showOnp} setOnp={setShowOnp}
                       showComb={showComb} setComb={setShowComb} shapes={shapes}
                       outcomeShown={outcomeShown} rdHalf={half} rdEvents={evs} />;
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
      {(sec === "tpp" || sec === "primary") && <span className="rd-key-item"><RdSwatch kind="ring" />{cur.year} election result</span>}
    </RdKey>
  );
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
          {!narrow && <nav className="rd-eyebrow-tools rd-cyc-nav" aria-label="On this page">{navs.map(([id, lab]) => <button key={id} type="button" onClick={() => goTo(id)}>{lab}</button>)}</nav>}
        </div>
        <RdHed head={pageStory.head} dek={pageStory.dek} level={2} />
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
      <RdSec id="cyc-tpp" title="Two-party preferred" meta="Implied from each poll’s primary votes, on the flows counted at the election that opened its term">
        {tppStory && <RdHed head={tppStory.head} dek={tppStory.dek} />}
        <div className="rd-cyc-one">{chart("tpp", false)}</div>
        {bandKey("tpp")}
        <RdFoot how={{ term: "last-election-flows", from: "Past cycles" }}>
          Every line is the implied two-party figure: each poll’s primary votes read through the preferences counted at the election that opened its term, the only table anyone could have used at the time. The {cur.year} term follows the rival {govName} is doing worst against, as the headline does.
        </RdFoot>
      </RdSec>
      <RdSec id="cyc-primary" title="Primary vote" meta="First preferences for the governing party and the main opposition party">
        {primStory && <RdHed head={primStory.head} dek={primStory.dek} />}
        <div className="rd-cyc-two">{chart("primary", true, "primary")}{chart("oppr", true, "primary")}</div>
        <RdEventList list={PAIRS.primary.list} inline />
        {bandKey("primary")}
        <RdFoot how={{ term: "what-am-i-looking-at", from: "Past cycles" }}>
          Past terms are the governing party and the main opposition party of the day. A month with no poll is filled in from the months either side, and a drawn term shows that stretch dashed.
        </RdFoot>
      </RdSec>
      <RdSec id="cyc-leaders" title="Leadership" meta="Net approval since 1972 and preferred PM since 1984, for whoever held the office">
        {leadStory && <RdHed head={leadStory.head} dek={leadStory.dek} />}
        <div className="rd-cyc-one">{chart("net", false)}</div>
        <div className="rd-cyc-two rd-cyc-subs">
          <div><RdSub head="Preferred prime minister" dek="The prime minister’s lead over the opposition leader on the question of who would make the better PM. Asked since 1984." />{chart("ppmm", true, "leaders")}</div>
          <div><RdSub head="Opposition leader’s net approval" dek="Approve minus disapprove, for whoever led the opposition at the time. Rated since 1972." />{chart("oppnet", true, "leaders")}</div>
        </div>
        <RdEventList list={PAIRS.leaders.list} inline />
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
