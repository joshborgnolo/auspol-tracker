/* auspol tracker – the redesign's two-party section (Sep 2026).

   Hero (73de0c58) owns the state and the machinery: which contest, which
   basis, the morph clock that both switches run on, and the accessors that
   read each contest on each basis. This draws the redesign's layout from
   them: the figures and a lead-scale gauge centred under the masthead, the
   verdict in words, the method line with its "?", and a chart of Labor's
   share against BOTH rivals, the chosen contest drawn heavy with its dots
   and interval, the other as a thin line for comparison. */

const RD_RANGES = [{ id: "3", label: "3 mo" }, { id: "6", label: "6 mo" },
                   { id: "12", label: "12 mo" }, { id: "all", label: "All" }];

/* The lead and its margin on the lead's own scale: points either side of a
   tie, Labor's lead drawn to the LEFT, as the figures above read. The span is
   the lead plus or minus its 95% margin (or the flows' range); a tie inside
   it is the verdict "too close to call", drawn. Plain boxes rather than svg
   geometry so the span and dot can travel on a CSS transition when the
   contest or basis changes, on the same curve the figures roll on. */
function RdLeadGauge({ lead, margin, aName, bName, aColor, bColor }) {
  const ref = React.useRef(null);
  const [w, setW] = React.useState(760);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !el.parentElement) return undefined;
    const fit = () => setW(Math.min(760, el.parentElement.getBoundingClientRect().width || 760));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el.parentElement);
    return () => ro.disconnect();
  }, []);
  /* mounts collapsed on the tie and settles out, like the old gauge's mercury */
  const [settled, setSettled] = React.useState(REDUCED_MOTION);
  React.useEffect(() => {
    if (settled) return undefined;
    const t = setTimeout(() => setSettled(true), SETTLE_MS);
    return () => clearTimeout(t);
  }, []);
  const cx = w / 2;
  const unit = Math.min(28, (cx - 49) / 10);            // px per point
  const dom = (cx - 8) / unit;
  const cl = (v) => Math.max(-dom, Math.min(dom, v));
  const X = (v) => cx - cl(v) * unit;                   // a Labor lead travels left
  const lo = margin != null ? lead - margin : lead, hi = margin != null ? lead + margin : lead;
  const col = lead >= 0 ? aColor : bColor;
  const L = settled ? X(hi) : cx, R = settled ? X(lo) : cx, P = settled ? X(lead) : cx;
  const sideX = Math.max(0, cx - 10 * unit - 56);
  const say = aName + (lead >= 0 ? " ahead by " : " behind by ") + Math.abs(lead).toFixed(1) + " points"
    + (margin != null ? ", give or take " + margin.toFixed(1) + (lo <= 0 && hi >= 0 ? ": a tie is inside that range." : ": a tie is outside that range.") : ".");
  return (
    <div className="rd-lg" ref={ref} style={{ width: w }} role="img" aria-label={say} title={say}>
      <span className="rd-lg-side" style={{ left: sideX, color: inkOf(aColor) }}>◀ {aName} ahead</span>
      <span className="rd-lg-side" style={{ right: sideX, color: inkOf(bColor) }}>{bName} ahead ▶</span>
      {[-10, -5, 5, 10].map((v) => <span key={v} className="rd-lg-grid" style={{ left: X(v) }}></span>)}
      <span className="rd-lg-tie" style={{ left: cx }}></span>
      {margin != null && (
        <>
          <span className="rd-lg-span" style={{ left: L, width: Math.max(0, R - L), background: col }}></span>
          <span className="rd-lg-cap" style={{ left: L, background: col }}></span>
          <span className="rd-lg-cap" style={{ left: R, background: col }}></span>
        </>
      )}
      <span className="rd-lg-dot" style={{ left: P, background: col }}></span>
      {[-10, -5, 5, 10].map((v) => (
        <span key={"t" + v} className="rd-lg-tick" style={{ left: X(v) }}>{Math.abs(v) === 10 && unit >= 20 ? "10 pts" : Math.abs(v)}</span>
      ))}
      <span className="rd-lg-tick rd-lg-tied" style={{ left: cx }}>Tied</span>
    </div>
  );
}

function RdHero(p) {
  const { rangeId, setRangeId, matchup, basis, morph, chooseMatchup, chooseBasis, orderedMatchups,
          latest, unc, monthDelta, leadSwing, impOffered, impOnOffered, impBasis, impOnBasis, adjusted,
          iDataOf, iScatOf, showScatter, showSynth, setShowSynth, otherContests, xDomain, domainRef } = p;
  const { D, filterPts, blendRows, mixC, blendDomain, monthLabelFull } = window.AP;
  const M = window.AP.tppMatchups;
  const m = M[matchup];
  const narrow = useNarrow("(max-width: 640px)");
  const b0 = basis || "imp";

  /* ---- the figures and the words under them ---------------------------- */
  const lead = +(latest.a - latest.b).toFixed(1);
  const margin = unc ? +(2 * unc.ci95).toFixed(1) : null;       // on the lead's scale
  const flows = !!(unc && unc.flows);
  const leader = lead > 0 ? m.a.name : lead < 0 ? m.b.name : null;
  const tooClose = margin != null && Math.abs(lead) <= margin;
  const marginTerm = flows
    ? <RdTerm id="fp-flows" from="two-party preferred" title="How far the flow table’s own range moves this pairing">flow range</RdTerm>
    : <RdTerm id="margin-of-error" from="two-party preferred" title="What a margin of error means">margin</RdTerm>;
  const leadWords = Math.abs(lead).toFixed(1) + "-point lead";
  const verdict = margin == null
    ? <><b>{leader ? leader + " ahead." : "Tied."}</b>{leader ? " " + (leader === m.a.name ? m.a.name : m.b.name) + " leads by " + Math.abs(lead).toFixed(1) + " points." : ""}</>
    : tooClose
      ? <><b>Too close to call.</b> {leader ? leader + "’s " + leadWords + " is inside the ±" + margin.toFixed(1) + " " : "The two are level, inside the ±" + margin.toFixed(1) + " "}{marginTerm}.</>
      : <><b>{leader} ahead.</b> Its {leadWords} is outside the ±{margin.toFixed(1)} {marginTerm}.</>;
  const sig = unc ? unc.changeSig : undefined;
  const moved = Math.abs(monthDelta) >= 0.05;
  const change = (
    <>
      {m.a.name} {moved ? <>{rdArrow(monthDelta)} <RollNum value={Math.abs(monthDelta).toFixed(1)} /> on a month ago</> : "unchanged on a month ago"}
      {moved && sig === false && <>, within the <RdTerm id="margin-of-error" from="two-party preferred">margin</RdTerm></>}
      {moved && sig === true && <>, a significant {monthDelta > 0 ? "rise" : "fall"}</>}
      {leadSwing != null && Math.abs(leadSwing) >= 0.05 && <>, {rdArrow(leadSwing)} {Math.abs(leadSwing).toFixed(1)} since the 2025 election</>}
    </>
  );
  const hasBases = (matchup === "alp_lnp" && impOffered) || (matchup === "alp_on" && impOnOffered);
  const onImp = hasBases && b0 === "imp";
  const basisWords = !hasBases ? (m.real ? "Pollsters’ published figures" : "Published head-to-heads")
    : onImp ? (narrow ? "Implied flows" : "Implied preference flows") : "Pollsters’ published figures";
  const provenance = (
    <>
      {basisWords}, <RdTerm id={adjusted ? "weighted-aggregate" : "monthly-average"} from="two-party preferred"
        title={"What " + (adjusted ? "a weighted aggregate" : "a monthly average") + " means"}>
        {adjusted ? "weighted aggregate" : "monthly average"}</RdTerm>
      {unc && <>{" "}of {unc.n} poll{unc.n === 1 ? "" : "s"} {narrow ? "to " : "in the " + D.latest.method.windowDays + " days to "}{rdDate(D.latest.updatedISO)}</>}
    </>
  );
  /* what the other basis would say, quoted in the "?" before anyone switches */
  const other = hasBases ? tppLatest(matchup, onImp ? "resp" : "imp") : null;
  const otherSays = other && other.a != null
    ? (other.a >= other.b ? m.a.name + " ahead " + other.a.toFixed(1) + "–" + other.b.toFixed(1)
                          : m.b.name + " ahead " + other.b.toFixed(1) + "–" + other.a.toFixed(1))
    : null;
  const howCounted = !hasBases
    ? "The pollsters’ own head-to-head figures, averaged. Too few pollsters ask this pairing for it to be weighted or corrected for each one’s lean."
    : !onImp
      ? "The pollsters’ own two-party figures, from where their respondents say their preferences would go, weighted towards the most recent and adjusted for each pollster’s lean. The ± is the 95% margin."
      : matchup === "alp_on"
        ? "Each poll’s primary votes, run through preference flows taken from counted ballots. No federal election has counted Labor against One Nation, so for that pairing the site builds the flows itself, and the ± is the doubt about them."
        : "Each poll’s primary votes, run through the preference flows counted at the 2025 election. The ± is the 95% margin: how far the polls in the window disagree, plus their sampling error.";
  const qPanel = (
    <RdQPop label="How this is counted, and the pollsters’ published figures">
      <h4>How this is counted</h4>
      <p>{howCounted}</p>
      {hasBases && (
        <>
          <div className="rd-qrow"><span>Show the pollsters’ published figures</span>
            <RdSwitch on={!onImp} onToggle={chooseBasis} label="Show the pollsters’ published figures" /></div>
          <p className="rd-qnote">{onImp
            ? "Their own head-to-heads, from where respondents say their preferences would go." + (otherSays ? " Against " + (m.b.name === "Coalition" ? "the Coalition" : m.b.name) + " they have " + otherSays + "." : "")
            : "The default reads every poll’s primary votes through fixed flows." + (otherSays ? " On those it has " + otherSays + "." : "")}</p>
        </>
      )}
      <a href="/preference-flows/">Read the full explainer →</a>
    </RdQPop>
  );

  /* ---- the chart: Labor's share against both rivals -------------------- */
  const laborIds = orderedMatchups.filter((id) => M[id].vsLabor);
  const otherOf = (id) => (M[id] && M[id].vsLabor ? laborIds.find((x) => x !== id) || null : null);
  /* A switch draws two scenes on every frame, and a scene's rows, its window
     and its dots only change with the range or the dots toggle - so each is
     worked out once per scene and kept. Only the blend is new per frame. */
  const memo = React.useRef({ key: null, m: new Map() });
  const memoKey = xDomain[0] + "|" + xDomain[1] + "|" + showScatter;
  if (memo.current.key !== memoKey) memo.current = { key: memoKey, m: new Map() };
  const kept = (k, f) => { const m = memo.current.m; if (!m.has(k)) m.set(k, f()); return m.get(k); };
  const ptsOf = (id, b) => kept("p" + id + b, () => filterPts(iDataOf(id, b), xDomain[0]));
  const scene = (id, b) => kept("s" + id + b, () => {
    const o = otherOf(id);
    return { id, o, main: ptsOf(id, b), other: o ? ptsOf(o, b) : null,
             mc: M[id].b.color, oc: o ? M[o].b.color : null };
  });
  const fromB = morph ? (morph.fromBasis || b0) : b0, toB = morph ? (morph.toBasis || b0) : b0;
  const S = scene(matchup, b0);
  const A = morph ? scene(morph.from, fromB) : null, B = morph ? scene(morph.to, toB) : null;
  const t = morph ? morph.t : 1;
  const mainBl = morph && A.main.length && B.main.length ? blendRows(A.main, B.main, t, ["a", "ci95"]) : null;
  const otherBl = morph && A.other && B.other && A.other.length && B.other.length ? blendRows(A.other, B.other, t, ["a"]) : null;
  const mainRows = mainBl ? mainBl.rows : S.main;
  const otherRows = morph ? (otherBl ? otherBl.rows : null) : S.other;
  const mainCol = morph ? mixC(A.mc, B.mc, t) : S.mc;
  const otherCol = morph ? (A.oc && B.oc ? mixC(A.oc, B.oc, t) : null) : S.oc;
  const vsName = (id) => "v " + M[id].b.name;
  const shown = morph ? morph.to : matchup;
  const labelMain = M[shown].vsLabor ? vsName(shown) : M[shown].a.name + " v " + M[shown].b.name;
  const labelOther = otherOf(shown) ? vsName(otherOf(shown)) : null;

  /* the compare overlay: the chosen contest on the basis the chart is NOT on */
  const cmpAvail = hasBases;
  const cmpData = !cmpAvail ? null : matchup === "alp_on"
    ? (onImp ? M.alp_on.data : D.synthOn)
    : (onImp ? D.agg2pp : D.synth2pp);
  const cmpOn = showSynth && cmpAvail && !morph && cmpData && cmpData.length > 1;
  const cmpName = onImp ? "As published" : "Implied";
  const cmpBox = matchup === "alp_on"
    ? (onImp ? "Compare published head-to-heads" : "Compare implied 2PP")
    : (onImp ? "Compare published 2PP" : "Compare implied 2PP");
  const sensOn = cmpOn && matchup === "alp_lnp" && D.flowSens && D.flowSens.length > 1;

  const series = [];
  if (otherRows && otherRows.length > 1)
    series.push({ id: "other", label: labelOther || "", color: otherCol, rdWidth: 2, endCap: false,
                  points: otherRows.filter((d) => d.a != null).map((d) => ({ x: d.x, y: d.a })),
                  clipX: otherBl ? otherBl.clip : null, endLabel: narrow ? null : labelOther });
  if (cmpOn)
    series.push({ id: "cmp", label: cmpName, color: mainCol, rdWidth: 2, dashed: true, endCap: false,
                  points: filterPts(cmpData.map((d) => ({ x: d.x, y: d.alp != null ? d.alp : d.a })), xDomain[0]),
                  endLabel: narrow ? null : cmpName });
  if (adjusted || morph)
    series.push({ id: "main", label: labelMain, color: mainCol, rdWidth: 3, endCap: false,
                  points: mainRows.map((d) => ({ x: d.x, y: d.a })),
                  clipX: mainBl ? mainBl.clip : null, endLabel: narrow ? null : labelMain });
  const areas = [];
  /* mid-switch the band is drawn from the blend's own edges (see blendRows) */
  const bandPts = mainBl
    ? mainRows.filter((d) => d.ci95Hi != null && d.ci95Lo != null).map((d) => ({ x: d.x, y0: d.ci95Lo, y1: d.ci95Hi }))
    : mainRows.filter((d) => d.ci95 != null && d.ci95 > 0).map((d) => ({ x: d.x, y0: d.a - d.ci95, y1: d.a + d.ci95 }));
  if (bandPts.length >= 2)
    areas.push({ id: "band", color: mainCol, className: "ci-band", edge: false, clipX: mainBl ? mainBl.clips.ci95 : null, points: bandPts });
  if (sensOn)
    areas.push({ id: "sens", color: "var(--lnp)", className: "rd-sens", edge: true,
                 points: filterPts(D.flowSens.map((d) => ({ x: d.x, y0: d.lo, y1: d.hi })), xDomain[0]) });

  /* the dots: each poll's reading of Labor's share in the chosen contest,
     coloured by the contest. A poll that published both contests is one
     fieldwork asked two ways, so its dot travels between them. */
  const cloudFor = (id, b) => (!showScatter ? [] : D.individualPolls
    .filter((q) => q.x >= xDomain[0] && q.x <= xDomain[1])
    .map((q) => {
      const pair = iScatOf(id, b)(q);
      return pair ? { x: q.x, y: pair[0].y, color: M[id].b.color, label: M[id].a.name + " v " + M[id].b.name, meta: q } : null;
    }).filter(Boolean));
  const settled = React.useMemo(() => cloudFor(matchup, b0), [matchup, b0, rangeId, showScatter]);
  const split = React.useMemo(() => {
    if (!morph) return null;
    const key = (d) => d.meta.pollster + "|" + d.meta.released;
    const ca = cloudFor(morph.from, fromB), cb = cloudFor(morph.to, toB);
    const ia = new Map(ca.map((d) => [key(d), d])), ib = new Map(cb.map((d) => [key(d), d]));
    const travel = [], leaving = [], arriving = [];
    ia.forEach((d, k) => (ib.has(k) ? travel.push([d, ib.get(k)]) : leaving.push(d)));
    ib.forEach((d, k) => { if (!ia.has(k)) arriving.push(d); });
    return { travel, leaving, arriving };
  }, [morph ? morph.from : null, morph ? morph.to : null, morph ? fromB : null, morph ? toB : null, rangeId, showScatter]);
  const scatter = split ? split.arriving : settled;
  const scatterOut = split ? split.leaving : [];
  const scatterMove = !split ? [] : split.travel.map(([a, b]) => ({
    x: a.x, y: a.y + (b.y - a.y) * t, color: mixC(a.color, b.color, t), label: b.label, meta: b.meta }));

  /* the 2025 result, a count rather than a poll: the Coalition contest's first point */
  const elec = D.agg2pp.find((d) => d.election);
  const ringOn = elec && (shown === "alp_lnp" || otherOf(shown) === "alp_lnp");
  const marks = ringOn ? [{ x: elec.x, y: elec.alp, label: narrow ? null : "2025 election: " + elec.alp.toFixed(1) }] : [];

  /* the window fits everything drawn, both contests, their dots and interval */
  const domainOf = (id, b) => kept("d" + id + b + ringOn, () => {
    const v = [50];
    const sc = scene(id, b);
    sc.main.forEach((d) => { v.push(d.a); if (d.ci95) v.push(d.a - d.ci95, d.a + d.ci95); });
    if (sc.other) sc.other.forEach((d) => v.push(d.a));
    if (showScatter) D.individualPolls.forEach((q) => {
      if (q.x < xDomain[0] || q.x > xDomain[1]) return;
      const pair = iScatOf(id, b)(q);
      if (pair) v.push(pair[0].y);
    });
    if (ringOn && elec.x >= xDomain[0]) v.push(elec.alp);
    /* a stray dot may sit a hair past a gridline without buying a whole
       empty band of window */
    return [Math.floor((Math.min(...v) + 0.3) / 5) * 5, Math.ceil((Math.max(...v) - 0.3) / 5) * 5];
  });
  const yTarget = domainOf(matchup, b0);
  /* a switch that took over from another starts from the window on screen */
  const yDomain = morph ? blendDomain(morph.fromDomain || domainOf(morph.from, fromB), yTarget, t) : yTarget;
  if (domainRef) domainRef.current = yDomain;
  const yTicks = rdYTicks(yTarget[0], yTarget[1], 5);

  /* events: the major ones, and the chosen contest's own change of hands,
     over the months that contest's lines run. Mid-switch the chart is handed
     both scenes' events and slides one set into the other (TrendChart's
     eventsFrom), so the markers change with the lines, not after them. */
  const evsOf = (sc) => {
    const rows = [sc.main, sc.other].filter((r) => r && r.length);
    if (!rows.length) return [];
    const x0 = Math.min(...rows.map((r) => r[0].x)), x1 = Math.max(...rows.map((r) => r[r.length - 1].x));
    const own = { alp_lnp: "2026-02-12", alp_on: "2025-12-08" }[sc.id];
    return (D.events || []).filter((e) => (e.major || e.date === own) && e.x >= x0 - 0.02 && e.x <= x1 + 0.02);
  };
  const evsAll = evsOf(morph ? B : S);
  const evsWas = morph ? evsOf(A) : null;
  const badges = narrow ? rdEventBadges(evsAll, xDomain[0], xDomain[1]) : null;
  const badgesWas = narrow && evsWas ? rdEventBadges(evsWas, xDomain[0], xDomain[1]) : null;
  const events = badges ? badges.events : evsAll;
  const eventsWas = evsWas ? (badgesWas ? badgesWas.events : evsWas) : null;

  const aName = m.a.name, rival = M[matchup].vsLabor ? "Rival" : m.b.name;
  const notes = [
    { x: "left", y: 50, dy: -7, text: "▲ " + aName + " ahead", size: narrow ? 11 : 12 },
    { x: "left", y: 50, dy: 16, text: "▼ " + rival + " ahead", size: narrow ? 11 : 12 },
  ];
  const chartTitle = M[matchup].vsLabor ? "Labor’s two-party-preferred vote, %" : "The Coalition’s two-party share against One Nation, %";
  const flowsBand = matchup === "alp_on" && onImp;
  /* The hover guide steps along the main line's months, and on the default
     contest (v One Nation, first asked months after polling day) that left
     the election ring with no month of its own: hovering it read out the ON
     line's first month. Where the ring is drawn and the main line starts
     after it, the election is the guide's first stop, as it is on the
     primary-vote chart, and says what it is. */
  const spineRows = (ringOn && elec.x >= xDomain[0] && mainRows.length && mainRows[0].x > elec.x + 1e-6
    ? [{ ...elec, a: elec.alp }] : []).concat(mainRows.filter((d) => !d.mid));
  const spine = spineRows.map((d) => ({ x: d.x, y: d.a, ym: d.ym }));

  /* ---- the finding over the chart --------------------------------------
     About the two Labor contests together, whichever one the chart is set
     to: how far each has moved since both were first asked, and whether they
     have converged. Written from the monthly figures on the chosen basis. */
  const story = kept("story" + b0, () => {
    const on = iDataOf("alp_on", b0).filter((d) => !d.election), co = iDataOf("alp_lnp", b0).filter((d) => !d.election);
    if (!on.length || !co.length || !M.alp_on || !laborIds.includes("alp_on")) return null;
    const coBy = {}; co.forEach((d) => { coBy[d.ym] = d; });
    const both = on.filter((d) => coBy[d.ym]);
    if (both.length < 3) return null;
    const f = both[0], l = both[both.length - 1];
    const on0 = f.a, on1 = l.a, co0 = coBy[f.ym].a, co1 = coBy[l.ym].a;
    const gap = on1 - co1;
    const head = Math.abs(gap) < 1 ? "One Nation now runs Labor as close as the Coalition does"
      : gap < 0 ? "One Nation now runs Labor closer than the Coalition does"
      : "The Coalition still runs Labor closer than One Nation does";
    const verb = (a, b) => (b < a ? "fallen" : "risen");
    const pc = (v) => Math.round(v) + "%";
    let dek = "Labor’s 2PP against One Nation has " + verb(on0, on1) + " from " + pc(on0) + " in " + rdMonthYear(f.ym)
      + " to " + pc(on1) + "; against the Coalition, " + (Math.round(co0) === Math.round(co1) ? "it has held near " + pc(co1) : "from " + pc(co0) + " to " + pc(co1)) + ".";
    /* the longest recent run the two have stayed close */
    let k = both.length - 1, worst = Math.abs(gap);
    while (k > 0) {
      const g = Math.abs(both[k - 1].a - coBy[both[k - 1].ym].a);
      if (Math.max(worst, g) > 1.5) break;
      worst = Math.max(worst, g); k--;
    }
    const runLen = both.length - k;
    const phrase = rdPointsPhrase(Math.max(worst, 0.01));
    if (runLen >= 3 && phrase && k > 0) {
      const [yy, mm] = both[k].ym.split("-").map(Number);
      const since = D.monthNameFull(mm) + (yy === Number(l.ym.slice(0, 4)) ? "" : " " + yy);
      dek += " Since " + since + " the two contests have run within " + phrase + " of each other.";
    }
    return { head, dek };
  });

  /* ---- the key ---------------------------------------------------------- */
  const keyItems = [
    showScatter && settled.length ? { kind: "dot", color: mainCol, label: "One poll, " + (hasBases ? (onImp ? "implied flows" : "as published") : "as published") } : null,
    (adjusted || morph) ? { kind: bandPts.length >= 2 ? "lineband" : "line", color: mainCol,
      label: (narrow ? "Monthly" : "Monthly average") + (bandPts.length >= 2 ? (flowsBand ? (narrow ? ", flow range" : " and flow range") : (narrow ? ", 95% interval" : " and its 95% interval")) : "") } : null,
    (!narrow && labelOther) ? { kind: "line", color: otherCol, label: labelOther + ", monthly average" } : null,
    cmpOn ? { kind: "dash", color: mainCol, label: cmpName + ", monthly average" } : null,
    sensOn ? { kind: "band", color: "var(--lnp)", label: "Range if One Nation preferences flowed as in 2022" } : null,
    ringOn ? { kind: "ring", label: narrow ? "2025 election" : "2025 election result" } : null,
  ];
  /* The copy's key, worded as a laptop words it whatever the screen: the
     image is laid out wide, and a phone's lines carry no names at their
     ends, so the key names both. The election ring is keyed only where the
     chart leaves it unlabelled. */
  const copyKey = [
    keyItems.find((k) => k && k.kind === "dot"),
    (adjusted || morph) ? { kind: "line", color: mainCol,
      label: labelMain + ", monthly average" + (bandPts.length >= 2 ? (flowsBand ? " and flow range" : " and its 95% interval") : "") } : null,
    labelOther ? { kind: "line", color: otherCol, label: labelOther + ", monthly average" } : null,
    cmpOn ? { kind: "dashed", color: mainCol, label: cmpName + ", monthly average" } : null,
    sensOn ? { kind: "shade", color: "var(--lnp)", label: "Range if One Nation preferences flowed as in 2022" } : null,
    ringOn && narrow ? { kind: "ring", color: "var(--ink)", label: "2025 election result" } : null,
  ].filter(Boolean);

  const tooltipTitle = (i) => { const d = spine[i] || spine[spine.length - 1]; return d && d.ym ? monthLabelFull(d.ym) : ""; };
  const extraRows = (i) => {
    const d = spineRows[i];
    // by date, not flag: the Coalition line's own first row is the result too
    if (d && ringOn && Math.abs(d.x - elec.x) < 1e-6) return [{ label: "", value: "The election result" }];
    if (!d || !d.ci95) return [];
    return [{ label: flowsBand ? "Flow range" : "95% interval", value: "± " + d.ci95.toFixed(1) + " pts" + (d.k ? ", " + d.k + " poll" + (d.k === 1 ? "" : "s") : "") }];
  };

  const meta = narrow
    ? "After preferences, updated " + rdDate(D.latest.updatedISO, true)
    : "After preferences, " + D.latest.pollsTracked + " polls from " + D.latest.housesTracked + " pollsters, updated " + rdDate(D.latest.updatedISO, true);

  return (
    <section className="rd-sec rd-first rd-tpp" id="two-party" aria-labelledby="rd-tpp-t">
      <div className="rd-eyebrow">
        <h2 className="rd-title" id="rd-tpp-t">Two-party preferred</h2>
        <span className="rd-meta">{meta}</span>
      </div>
      {/* The section's headline under its heading, as every other section
         has it, so the opening view reads down a left edge before the
         centred figures. A phone keeps the figures first: there the
         headline and its dek would push the verdict and scale off the first
         screen, and the figure is what the page is opened for. */}
      {story && !narrow && <RdHed head={story.head} dek={story.dek} />}
      <div className="rd-tpp-top">
        <div className="rd-tpp-read">
          <div className="rd-tpp-side rd-a">
            <span className="rd-tpp-name" style={{ color: inkOf(m.a.color) }}><span className="rd-tpp-dot" style={{ background: m.a.color }}></span>{m.a.name}</span>
            <RollNum className="rd-tpp-num" value={latest.a.toFixed(1)} style={{ color: inkOf(m.a.color) }} spinIn />
          </div>
          <span className="rd-tpp-rule" aria-hidden="true"></span>
          <div className="rd-tpp-side rd-b">
            <RollNum className="rd-tpp-num" value={latest.b.toFixed(1)} style={{ color: inkOf(m.b.color) }} spinIn />
            <span className="rd-tpp-name" style={{ color: inkOf(m.b.color) }}>{m.b.name}<span className="rd-tpp-dot" style={{ background: m.b.color }}></span></span>
          </div>
        </div>
        <RdLeadGauge lead={lead} margin={margin} aName={m.a.name} bName={m.b.name} aColor={m.a.color} bColor={m.b.color} />
        <p className="rd-tpp-verdict">{verdict}</p>
        <p className="rd-tpp-change">{change}</p>
        <p className="rd-tpp-prov">{provenance}{qPanel}
          {hasBases && !onImp && <>, <button type="button" className="rd-link" onClick={chooseBasis}>Back to implied flows</button></>}
        </p>
        {otherContests.length > 0 && (
          <div className="rd-tpp-switch">
            <span className="rd-tpp-switch-l">Switch 2PP</span>
            {otherContests.map((o) => (
              <button key={o.id} type="button" className="rd-chip" onClick={() => chooseMatchup(o.id)}
                      title={"Show " + M[o.id].a.name + " v " + M[o.id].b.name}>
                {M[o.id].a.name} v {M[o.id].b.name}
                <span className="rd-chip-fig">
                  <span style={{ color: inkOf(M[o.id].a.color) }}>{o.v.a.toFixed(1)}</span>
                  <span className="rd-chip-dash">–</span>
                  <span style={{ color: inkOf(M[o.id].b.color) }}>{o.v.b.toFixed(1)}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {story && narrow && <RdSub head={story.head} dek={story.dek} level={3} />}

      <div className="card rd-card rd-tpp-chart">
        <RdTabs value={rangeId} onChange={setRangeId} options={RD_RANGES} ariaLabel="Time range" className="rd-tabs-sm">
          {!narrow && cmpAvail && <RdCheck checked={showSynth} onChange={setShowSynth}>{cmpBox}</RdCheck>}
        </RdTabs>
        <div className="rd-chead"><span className="rd-chead-t">{chartTitle}</span></div>
        {narrow && (
          <RdKey className="rd-tpp-legend" items={[
            { kind: "line", color: mainCol, label: labelMain },
            labelOther ? { kind: "line", color: otherCol, label: labelOther } : null,
            cmpOn ? { kind: "dash", color: mainCol, label: cmpName } : null,
          ]} />
        )}
        <TrendChart
          key="rd-hero"
          heightPx={narrow ? 300 : 372}
          padPx={narrow ? { l: 30, r: 6, t: 34, b: 28 } : { l: 40, r: 16, t: 52, b: 30 }}
          xDomain={xDomain} yDomain={yDomain} yTicks={yTicks}
          yTickFmt={(v) => (v === yTarget[1] ? v + "%" : String(v))}
          xTicks={rdXTicks(xDomain[0], xDomain[1], narrow)} baseline
          refLines={[{ y: 50, color: "var(--ink-faint)" }]}
          notes={notes} marks={marks} events={events} eventsFrom={eventsWas} eventMix={t}
          series={series} spine={spine}
          scatter={scatter} scatterOut={scatterOut} scatterMove={scatterMove}
          areas={areas} fade={morph ? t : 1}
          pollFacet="twopp"
          tooltipTitle={tooltipTitle} extraRows={extraRows}
          fmt={(v) => v.toFixed(1)}
          copy={{ title: chartTitle.replace(/, %$/, ""),
                  sub: basisWords.replace(/^Implied flows$/, "Implied preference flows") + (unc ? ", weighted aggregate of " + unc.n + " polls to " + rdDate(D.latest.updatedISO) : ""),
                  legend: copyKey.map((k) => ({ label: k.label, color: k.color, kind: k.kind })) }}
        />
        {badges && <RdEventList list={badges.list} from={badgesWas ? badgesWas.list : null} mix={t} />}
        <RdKey className="rd-ckey" items={keyItems} />
        {narrow && cmpAvail && <RdCheck checked={showSynth} onChange={setShowSynth}>{cmpBox}</RdCheck>}
      </div>
      <RdFoot how={{ href: "/preference-flows/" }}>
        Figures pool the last {D.latest.method.windowDays} days of polls, weighted towards the most recent and adjusted for each pollster’s lean. Changes are on a month ago. The chart follows the matchup chosen above.
      </RdFoot>
    </section>
  );
}

Object.assign(window, { RdHero, RdLeadGauge });
