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
const rdOrd = (n) => n + (n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th");
const rdSgn = (v, unit) => (unit ? "" : v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(1);

/* ---- one chart, in the redesign's frame --------------------------------- */
function RdCycleChart({ M, chg, built, bandAreas, bandRows, scatter, events: evIn, badged, domain, ticks, cur, hidden, narrow, half,
                        hanCtl, showHan, setHan, showOnp, setOnp, tipCycle, banded, bandN, isOpp }) {
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
    if (s.endLabel && s.label) return { ...s, rdWidth: s.width >= 3 ? 2.2 : 1.4, endLabel: half ? null : s.label.replace(" · ", " ") };
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
    notes.push({ x: nowM, y: curVal, dx: 10, dy: dys[0], text: subj + " " + fmt(curVal), color: inkOf(subjColor), weight: 600, size: 12.5 });
    notes.push({ x: nowM, y: curVal, dx: 10, dy: dys[1], text: Math.abs(d).toFixed(1) + (d >= 0 ? " above" : " below") + " average", size: 12.5 });
  }
  if (!chg && M.key === "tpp") {
    notes.push({ x: "left", y: 50, dy: -6, text: "▲ Government ahead", size: 11.5 });
    notes.push({ x: "left", y: 50, dy: 15, text: "▼ Opposition ahead", size: 11.5 });
  }
  const marks = [];
  if (peer && curVal != null) marks.push({ x: nowM, y: peer.mean, r: 3.5, color: "var(--ink-2)" });
  if (!chg && cur && !hidden.has(cur.year) && (M.key === "tpp" || M.key === "primary" || M.key === "oppr") && cur.base[M.key] != null)
    marks.push({ x: 0, y: cur.base[M.key], r: 5 });
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
  const badges = badged ? { events, list: null } : narrow ? rdEventBadges(events.filter((e) => e.date), -2, 38) : null;
  const tickSet = ticks.slice();
  if (!tickSet.includes(domain[0])) tickSet.unshift(domain[0]);
  if (!tickSet.includes(domain[1])) tickSet.push(domain[1]);
  const title = (chg ? RD_CYC_TITLE_CHG : RD_CYC_TITLE)[M.key];
  return (
    <div className="card rd-card rd-cyc-chart">
      <div className="rd-chead">
        <span className="rd-chead-t">{title}</span>
        {M.onp && <RdCheck checked={showOnp} onChange={setOnp}>One Nation this term</RdCheck>}
        {hanCtl && <RdCheck checked={showHan} onChange={setHan}>Pauline Hanson this term</RdCheck>}
      </div>
      <TrendChart key={"rd-cyc-" + M.key + "-" + (chg ? "c" : "a")}
        heightPx={narrow ? 260 : half ? 290 : 330}
        padPx={narrow ? { l: 34, r: 8, t: badges ? 34 : 40, b: 28 } : { l: 40, r: half ? 12 : 16, t: badges ? 36 : 56, b: 30 }}
        xDomain={CYC_XDOMAIN} yDomain={domain} yTicks={tickSet} yTickFmt={yTickFmt}
        xTicks={xTicks} baseline refLines={refLines} vlines={nowM != null ? [{ x: nowM }] : []}
        series={series} spine={CYC_SPINE} scatter={scatter} areas={bandAreas || undefined}
        events={badges ? badges.events : events} notes={notes} marks={marks} brackets={brackets}
        tooltipTitle={(i) => cycMonthLabel(CYC_SPINE[i].x) + (tipCycle ? " – " + cycMonthOf(tipCycle.eDate, CYC_SPINE[i].x) : "")}
        extraRows={(i) => {
          const r = bandRows.find((b) => b.m === CYC_SPINE[i].x);
          return r && banded ? [{ label: "Middle half", value: fmt(r.q1) + "–" + fmt(r.q3) }, { label: "Middle 80%", value: fmt(r.p10) + "–" + fmt(r.p90) }] : [];
        }}
        fmt={(v) => fmt(v)} pollFacet={M.key === "tpp" ? "twopp" : M.key === "primary" || M.key === "oppr" ? "primary" : "leadership"}
        copy={{ title: title, sub: banded ? "Against the middle half and middle 80% of " + bandN + " past terms" : "" }}
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
          showOutcome, outcomeShown, shapes, showHan, setShowHan, showOnp, setShowOnp, exportSource, srcFailed, retrySource } = p;
  const { D } = window.AP;
  const narrow = useNarrow("(max-width: 640px)");
  const [board, setBoard] = useState(false);
  const [tip, setTip] = useState(null);
  const boardRef = React.useRef(null);
  window.useDismissOutside(boardRef, board, () => setBoard(false));
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
  const setCompare = (id) => (id === "all" ? showAll() : showOutcome(id));

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

  /* ---- the findings ---------------------------------------------------------------- */
  const R = {};
  ROWS.forEach((r) => { R[r.key] = r; });
  const pageStory = (() => {
    const g = R.primary, o = R.oppr, t = R.tpp;
    const gLow = g.rank && /^Lowest/.test(g.rank.main), oLow = o.rank && /^Lowest/.test(o.rank.main);
    const head = gLow && oLow ? "Both major parties are at record lows for this point in a term"
      : gLow ? govName + "’s primary vote is the lowest of any government at this point in a term"
      : oLow ? rdCap(oppIn) + "’s primary vote is the lowest of any opposition at this point in a term"
      : t.peers ? govName + " sits " + (t.v >= t.peers.mean ? "above" : "below") + " the average government at this point in a term" : "Every term since 1972, lined up on its election day";
    let dek = monthsWord + " after the " + cur.year + " election, ";
    const bits = [];
    if (gLow) bits.push(govName + "’s primary vote is the lowest of any government at the same point since " + cycles[0].year);
    if (oLow) bits.push((gLow ? "and " + oppIn + "’s" : rdCap(oppIn) + "’s primary vote is") + " the lowest of any opposition");
    dek += bits.length ? bits.join(", ") + "." : govName + "’s primary vote is " + (g.rank ? g.rank.main.toLowerCase() : "") + " past governments at this point.";
    if (t.peers && t.v != null && !chg) {
      const where = t.v >= t.peers.q1 && t.v <= t.peers.q3 ? "sits in the middle half of past governments"
        : t.v > t.peers.q3 ? "is above three in four past governments" : "is below three in four past governments";
      dek += " After preferences, " + (bits.length ? "though, " : "") + govName + "’s " + t.v.toFixed(1) + "% " + where + ".";
    }
    return { head, dek };
  })();
  /* the 2PP against the governments that were re-elected and turned out */
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
      head = "After preferences, " + govName + " is on a par with governments that went on to be " + (nearRet ? "re-elected" : "turned out");
    } else head = "After preferences, " + govName + " is " + (dAvg >= 0 ? "above" : "below") + " the average government at this point";
    const vs = rivalWord === "One Nation" ? " against One Nation" : "";
    let dek = "Its " + fmtOf("tpp")(t.v) + (chg ? "" : "%") + vs + " is " + Math.abs(dAvg).toFixed(1) + " points " + (dAvg >= 0 ? "above" : "below") + " the average government " + m + " months in.";
    if (ret && ous) dek += " Governments later re-elected averaged " + fmtOf("tpp")(ret.mean) + (chg ? "" : "%") + " at this point; the " + rdNumWord(ous.n) + " turned out averaged " + fmtOf("tpp")(ous.mean) + (chg ? "" : "%") + ".";
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
    const head = oWorst ? "No opposition has lost as much of its vote this early as " + oppIn + " has"
      : gC.vals.every((q) => q.v > gNow) ? "No government has lost as much of its vote this early as " + govName + " has"
      : rdCap(oppIn) + " has " + (oNow < 0 ? "lost" : "gained") + " " + Math.abs(oNow).toFixed(1) + " points since the election";
    let dek = rdCap(oppIn) + " is " + (oNow < 0 ? "down " : "up ") + Math.abs(oNow).toFixed(1) + " points since the election, to " + cur.end.oppr.toFixed(1) + "%; by this stage the average opposition had "
      + (oC.mean >= 0 ? "gained " : "lost ") + Math.abs(oC.mean).toFixed(1) + ". " + govName + " is " + (gNow < 0 ? "down " : "up ") + Math.abs(gNow).toFixed(1) + ", to " + cur.end.primary.toFixed(1) + "%.";
    if (gWorse.length === 1) dek += " Only " + gWorse[0].who + "’s government, in " + gWorse[0].yr + ", had lost more by now.";
    else if (gWorse.length > 1 && gWorse.length <= 4) dek += " " + rdCap(rdNumWord(gWorse.length)) + " governments had lost more by now.";
    return { head, dek };
  })();
  const leadStory = (() => {
    const n = R.net;
    if (!n.peers || n.v == null) return null;
    const rk = n.rank;
    const low = n.peers.vals[0];
    const head = /^Lowest/.test(rk.main) ? pm + "’s net approval is the lowest of any prime minister at this point"
      : /^2nd lowest/.test(rk.main) ? pm + "’s net approval is the second lowest of any prime minister at this point, after " + low.who + "’s"
      : /^Highest/.test(rk.main) ? pm + "’s net approval is the highest of any prime minister at this point"
      : pm + "’s net approval is " + (n.v >= n.peers.mean ? "above" : "below") + " the average prime minister’s at this point";
    const dN = n.v - n.peers.mean;
    let dek = "At " + fmtOf("net")(n.v) + " he is " + Math.abs(dN).toFixed(1) + " points " + (dN >= 0 ? "above" : "below") + " the average prime minister " + m + " months in.";
    const pp = R.ppmm, on = R.oppnet;
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
            <span className="rd-cs-scale">{rdYTicks(SC[g].lo, SC[g].hi, SC[g].step).map((v) => <span key={v} style={{ left: X(SC[g], v) + "%" }}>{tickLab(g, v)}</span>)}</span>
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
                  {rdYTicks(sc.lo, sc.hi, sc.step).map((v) => <i key={v} className="rd-cs-gl" style={{ left: X(sc, v) + "%" }}></i>)}
                  {P && P.n >= 3 && <i className="rd-cs-b80" style={{ left: X(sc, P.p10) + "%", width: X(sc, P.p90) - X(sc, P.p10) + "%" }}></i>}
                  {P && P.n >= 3 && <i className="rd-cs-b50" style={{ left: X(sc, P.q1) + "%", width: X(sc, P.q3) - X(sc, P.q1) + "%" }}></i>}
                  {P && P.vals.map((q, qi) => (
                    <i key={q.yr} className={"rd-cs-dot" + (tip && tip.key === r.key && tip.i === qi ? " on" : "")} style={{ left: X(sc, q.v) + "%" }}
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
                        {oc && <span className="tip-row"><span className="tip-label">Next election</span><span className="tip-val">{oc === "returned" ? "Re-elected" : "Turned out"}</span></span>}
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
  const controls = (
    <div className="rd-cc" ref={boardRef}>
      <div className="rd-cc-row">
        <span className="rd-cc-l">Compare with</span>
        <div className="rd-tabs rd-cc-tabs" role="group" aria-label="Compare with">
          {[["all", "All past terms", nPast], ["returned", "Re-elected", nRet], ["ousted", "Turned out", nOus]].map(([id, lab, n]) => (
            <button key={id} type="button" className="rd-tab" aria-pressed={compare === id} onClick={() => setCompare(id)}>{narrow && id === "all" ? "All" : lab}<span className="rd-cc-n">{n}</span></button>
          ))}
        </div>
        <span className="rd-cc-sep" aria-hidden="true"></span>
        <div className="rd-tabs rd-cc-tabs" role="group" aria-label="Measure">
          <button type="button" className="rd-tab" aria-pressed={!chg} onClick={() => setMode("abs")}>Level</button>
          <button type="button" className="rd-tab" aria-pressed={chg} onClick={() => setMode("chg")}>{narrow ? "Change" : "Change since election"}</button>
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
            <b>Past terms</b><span>{cycles.length - hidden.size - 1} on the board · {liftedList.length} drawn as their own line</span>
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
                  {c.current ? <span className="rd-cc-now">This term</span> : <span className="rd-cc-oc">{oc === "returned" ? "Re-elected" : "Turned out"}</span>}
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
  const pairOf = (keys) => rdEventBadges((CYC_EVENTS[cur.year] || [])
    .filter((e) => !e.metrics || e.metrics.some((k) => keys.includes(k)))
    .map((e) => ({ ...e, x: cycEventMonth(e.date, cur.eDate) })), -2, 38);
  const PAIRS = { primary: pairOf(["primary", "oppr"]), leaders: pairOf(["ppmm", "oppnet"]) };
  const chart = (key, half, pair) => {
    const M = Mby[key];
    const evs = pair ? PAIRS[pair].events.filter((e) => !e.metrics || e.metrics.includes(key)) : null;
    return <CycleChart key={key} metric={M} cycles={cycles} mode={mode} hidden={hidden} hi={hi} setHi={setHi} lifted={lifted} unlift={unlift}
                       chipClick={chipClick} toggle={toggle} showAll={showAll} hideAll={hideAll} showOutcome={showOutcome}
                       showHan={showHan} setHan={setShowHan} showOnp={showOnp} setOnp={setShowOnp} shapes={shapes}
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
      <AccuracyPanel />
    </div>
  );
}

Object.assign(window, { RdCycleChart, RdPastCycles, rdCycPeers, rdCycRank });
