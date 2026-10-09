/* auspol tracker – the redesign's Snapshot sections (Sep 2026).

   Each existing panel returns one of these while window.AP.rd is set. They
   read the same dataset the panels do and keep the site's machinery - the
   chart engine's travelling window, tooltips and poll links, the copy
   buttons - and write each section's headline from the live figures by a
   rule, so the words turn over with the numbers. */

/* how much of a thing is gone, as a reader says it: "a third", "about half" */
function rdShareWords(p) {
  const c = [[1, 2, "half"], [1, 3, "a third"], [2, 3, "two-thirds"], [1, 4, "a quarter"], [3, 4, "three-quarters"],
             [1, 5, "a fifth"], [2, 5, "two-fifths"], [3, 5, "three-fifths"], [4, 5, "four-fifths"],
             [1, 6, "a sixth"], [1, 8, "an eighth"], [1, 10, "a tenth"]];
  let best = null;
  for (const [a, b, w] of c) {
    const err = Math.abs(p - a / b);
    if (!best || err < best.err) best = { w, err };
  }
  return (best.err < 0.012 ? "" : "about ") + best.w;
}
/* a party as a sentence names it, and at the start of one */
const RD_PARTY_IN = { alp: "Labor", lnp: "the Coalition", grn: "the Greens", onp: "One Nation", oth: "minor parties and independents" };
const rdPartyIn = (id) => RD_PARTY_IN[id] || id;
const rdPartyStart = (id) => rdCap(rdPartyIn(id));
const rdPlural = (id) => id === "grn" || id === "oth";

/* month ticks that open on the election itself. The tick carries a `short`
   the chart may fall back to when the word cannot sit between its neighbours -
   a small multiple's election tick never has room for "Election" */
function rdElectionTicks(x0, x1, narrow, elecX) {
  /* a window past two and a half years (/vic/'s four-year term) ticks each
     January, which carries its year: finer steps had the chart thin out
     alternate labels, and the Januaries went with them ("E, Jul, Jul") */
  const span = x1 - x0;
  const t = rdXTicks(x0, x1, narrow, { step: span > 2.5 ? 12 : span > 1.1 ? (narrow ? 4 : 2) : undefined });
  if (elecX == null || elecX < x0 - 0.01) return t;
  /* a tick crowding the election's own leaves it the room: on a long window
     (/vic/'s November election, then January) the axis's thinning otherwise
     drops every other label to fit the pair, Januaries and all */
  const rest = t.filter((k) => k.x - elecX > Math.max(0.1, span * 0.06));
  /* "Election" already dates the axis, so the next tick drops a repeat of its year */
  const ey = String(Math.floor(elecX));
  if (rest.length) {
    const lab = rest[0].label;
    const cut = lab.endsWith(" " + ey) ? ey.length + 1 : lab.endsWith(" ’" + ey.slice(2)) ? 4 : 0;
    if (cut) rest[0] = { ...rest[0], label: lab.slice(0, -cut) };
  }
  return [{ x: elecX, label: "Election", strong: true, short: "E" }, ...rest];
}

/* the dotted stroke of a lead-in segment bridging an election mark to the
   first month a chart actually polled - interpolation, drawn as the month's
   interpolation is (the cycle charts dash a month nothing was polled in);
   dots rather than the all-voters dashes so the two reference lines read as
   different kinds of thing */
const RD_ELECTION_LEAD = "0.5 4";

/* ======================================================================
   Primary vote
   ====================================================================== */
function RdPrimary({ rangeId, setRangeId }) {
  const { D, rangeDomain, filterPts, series, monthLabelFull } = window.AP;
  const xDomain = rangeDomain(rangeId);
  const narrow = useNarrow(MQ_PHONE);
  const [hidden, setHidden] = useState({});
  /* The group dropdown: any Who-votes-for-whom group, drawn from the §7g
     payload the Who-votes panel itself pools (never re-derived here).
     grpId === "" is the all-voters view; /vic/ has no demographics payload,
     so the control never appears there. */
  const T = D.demographics;
  const [grpId, setGrpId] = useState("");
  const sel = (() => {
    if (!grpId || !T || !T.tabs) return null;
    for (const t of T.tabs) for (const s of t.sets) {
      const g = s.groups.find((x) => x.label === grpId);
      /* t.id is the group's demographics split (age/gender/education/
         place/home) - the dot-open hands it to All polls so the opened
         poll's Demographics detail already shows the clicked view's cut */
      if (g) return { label: grpId, g, who: RD_DEMO_SHORT[grpId] || grpId, tabId: t.id };
    }
    return null;
  })();
  const G = sel && sel.g;
  const lastM = D.aggPrimary[D.aggPrimary.length - 1];
  const allBase = D.aggPrimary.find((d) => d.election) || null;
  /* a group's election base exists only where the count itself was cut -
     the AEC's state and division-class sums. The ring and the dek's faller
     clause drop for every other group, rather than reaching for a figure
     that was never counted; the stat rows' "since" instead casts back from
     the first month the group's monthly line runs, naming that month */
  const gElec = G
    ? [D.demoStateElection, D.demoLocElection].find((E) => E && E.groups && E.groups[sel.label])
    : null;
  const base = G
    ? (gElec ? { x: gElec.x, election: true, ...Object.fromEntries(T.order.map((kk, i) => [kk, gElec.groups[sel.label][i]])) } : null)
    : allBase;
  /* the baseline named above: the group line's first monthly row, keyed by
     party as the election rows are - a party unpolled that month keeps no
     change row, as it had no election row before */
  const gWas = G && !base && G.monthly && G.monthly.length > 1
    ? (() => { const o = { ym: G.monthly[0][0] }; T.order.forEach((kk, i) => { o[kk] = G.monthly[0][1 + i]; }); return o; })()
    : null;
  /* a poll row's grp.v slots are gen-data's alp/lnp/grn/onp/oth order, NOT
     §7g's DEMO_KEYS (alp/lnp/onp/grn/oth): map by key, never by a shared
     index across the two */
  const GRPV_KEYS = ["alp", "lnp", "grn", "onp", "oth"];
  const mkParts = (V, C, W) => ["alp", "lnp", "grn", "onp", "oth"].map((id) => ({
    id, color: D.PARTIES[id].color, name: (id === "oth" ? "Others & independents" : D.PARTIES[id].name),
    v: V[id], was: W ? W[id] : null, ci: C[id] || 0,
  })).sort((a, b) => b.v - a.v);
  /* the level test, factored so the all-voters contrast behind a group's
     dek runs the same check the drawn figures do */
  const levelCount = (ps) => {
    let kk = 1;
    const t = ps[0];
    while (kk < ps.length && t.v - ps[kk].v < Math.sqrt(t.ci * t.ci + ps[kk].ci * ps[kk].ci)) kk++;
    return kk;
  };
  const partsAll = mkParts(D.latest.primary, lastM.ci || {}, allBase);
  const kAll = levelCount(partsAll);
  const parts = G ? mkParts(G.v, G.ci, base) : partsAll;
  const top = parts[0];
  const SHORT = { alp: "Labor", lnp: "Coalition", grn: "Greens", onp: "One Nation", oth: "Others" };
  /* a phone's line ends carry the parties' letters, as the canvas drew them:
     the full names don't fit beside a 350px plot */
  const ABBR = { alp: "ALP", lnp: "L/NP", grn: "GRN", onp: "ON", oth: "OTH" };
  const firstPolled = G ? {} : Object.fromEntries(parts.map((p) => [p.id, D.aggPrimary.find((d) => !d.election && d[p.id] != null)]));
  const lateParties = !G && base ? parts.map((p) => p.id).filter((id) => firstPolled[id] && firstPolled[id].x - base.x > 0.5) : [];
  /* the parties the leader cannot be told apart from: the gap to each is
     inside the two figures' 95% margins combined */
  const k = levelCount(parts);
  const level = parts.slice(0, k);

  const story = (() => {
    const list = (arr) => arr.length === 2 ? arr.join(" and ") : arr.slice(0, -1).join(", ") + " and " + arr[arr.length - 1];
    const pc = (v) => v.toFixed(1) + "%";
    let head, dek;
    if (k >= 2) {
      head = rdCap(list(level.map((p) => rdPartyIn(p.id)))) + " are level" + (G ? " among " + sel.who : "");
      dek = (G ? "Among " + sel.who + ", " : "")
        + level.map((p, i) => (i === 0 ? rdPartyStart(p.id) : rdPartyIn(p.id)) + ", on " + pc(p.v)).reduce((s, c, i, a) =>
          s + (i === 0 ? c : i === a.length - 1 ? ", and " + c : ", " + c), "");
      /* a group's level call is pooled from few polls, so the dek quotes the
         gap it cannot read as a margin (the all-voters dek doesn't need to);
         shares level to the tenth are simply dead level, not "0.0 points" */
      const gapK = (top.v - level[k - 1].v).toFixed(1);
      if (G && gapK === "0.0") dek += ", are dead level";
      else {
        dek += ", are too close to separate";
        if (G) dek += ", " + gapK + " points " + (k === 2 ? "between them" : "across the " + ({ 3: "three", 4: "four", 5: "five" })[k]);
      }
      dek += ".";
    } else {
      head = rdPartyStart(top.id) + (G ? " leads among " + sel.who : " leads the primary vote");
      dek = (G ? "Among " + sel.who + ", " + rdPartyIn(top.id) : rdPartyStart(top.id))
        + " leads on " + pc(top.v) + ", " + (top.v - parts[1].v).toFixed(1) + " points clear of "
        + rdPartyIn(parts[1].id) + " on " + pc(parts[1].v) + ".";
    }
    /* the biggest faller outside the leading group, if the fall is big */
    const fallers = parts.slice(k).filter((p) => p.was && p.v < p.was && (p.was - p.v) / p.was >= 0.15)
      .sort((a, b) => (b.was - b.v) / b.was - (a.was - a.v) / a.was);
    if (fallers.length) {
      const f = fallers[0];
      dek += " " + rdPartyStart(f.id) + ", on " + pc(f.v) + ", " + (rdPlural(f.id) ? "have" : "has") + " lost "
        + rdShareWords((f.was - f.v) / f.was) + " of " + (rdPlural(f.id) ? "their" : "its") + " election-night vote.";
    }
    /* a party the polls only began reporting apart long after the election
       (/vic/'s One Nation, among others until February 2026) says where its
       line starts; federally all five run from the first month */
    for (const id of lateParties) {
      dek += " " + rdPartyStart(id) + "’s line starts in " + rdMonthYear(firstPolled[id].ym)
        + ": until then, the polls counted " + (rdPlural(id) ? "them" : "it") + " among others.";
    }
    /* a group's dek closes against the whole electorate, so the group's
       figures never read as a shift in the headline itself */
    if (G) {
      const lvlAll = partsAll.slice(0, kAll);
      dek += kAll >= 2
        ? " Among all voters, " + list(lvlAll.map((p) => rdPartyIn(p.id))) + " are level."
        : " Among all voters, " + rdPartyIn(partsAll[0].id) + " leads on " + pc(partsAll[0].v) + ".";
    }
    return { head, dek };
  })();

  /* a selected group's monthly line, shaped exactly as an aggPrimary month
     row ({x, ym, per-party value, ci:{…}}) so the series/areas/tooltip code
     below needs no group branches of its own. A month the group went
     unpolled is simply absent, as live() already tolerates */
  const gMonths = React.useMemo(() => {
    if (!G) return null;
    return G.monthly.map((m) => {
      const o = { ym: m[0], x: D.mx(m[0]), ci: {} };
      T.order.forEach((kk, i) => { o[kk] = m[1 + i]; o.ci[kk] = m[1 + T.order.length + i]; });
      return o;
    });
  }, [T, G]);
  const pts = filterPts(G && gMonths ? gMonths : D.aggPrimary, xDomain[0]);
  const visible = parts.filter((p) => !hidden[p.id]);
  /* a monthly series drops the months that never carried the party's
     figure - the chart engine has no null-run guard (/vic/ has sparse ON
     months; federally every month carries the five, so this is a no-op) -
     and a party first reported apart long after the election starts its
     line at that month, not with a lead-in from the election's ring */
  const live = (id) => {
    const L = pts.filter((d) => d[id] != null);
    return lateParties.includes(id) && L.length > 1 && L[0].election ? L.slice(1) : L;
  };
  const chartSeries = parts.slice().reverse().map((p) => ({
    id: p.id, label: p.name, color: p.color, points: series(live(p.id), p.id),
    rdWidth: p.id === "oth" ? 2 : 2.5, dashed: p.id === "oth", dash: p.id === "oth" ? "6 4" : undefined,
    opacity: hidden[p.id] ? 0 : 1, endLabel: narrow ? ABBR[p.id] : SHORT[p.id], rdCap: 4,
  }));
  /* a party toggled off keeps its band, its dots and its election ring on
     the chart at nothing, so they fade out with its line (and back in),
     rather than vanishing the frame the line starts to fade */
  const areas = parts.map((p) => ({
    id: "ci-" + p.id, color: p.color, className: "ci-band", edge: false, hidden: !!hidden[p.id],
    points: pts.filter((d) => d.ci && d.ci[p.id] != null && d[p.id] != null)
      .map((d) => ({ x: d.x, y0: d[p.id] - d.ci[p.id], y1: d[p.id] + d.ci[p.id] })),
  })).filter((a) => a.points.length >= 2);
  /* group mode's per-poll dots: each wave's own reading of the group, sat
     against its month's all-voters figure - exactly the point §7g's pooling
     averages (never the raw group share, so a wave from a house that leans
     toward the group still lands on the line the site draws). The wave's
     printed group figure rides on the dot as `gv`, so the tooltip can tip
     what was printed rather than the lifted y the dot is drawn at */
  const gi = G && D.demoGroups ? D.demoGroups.indexOf(sel.label) : -1;
  const aggByYm = React.useMemo(() => (!G ? null
    : new Map(D.aggPrimary.filter((d) => !d.election).map((d) => [d.ym, d]))), [G]);
  const scatter = React.useMemo(() => D.individualPolls
    .filter((q) => q.x >= xDomain[0] && q.x <= xDomain[1])
    .flatMap((q) => {
      if (!G) return parts.filter((p) => q.p && q.p[p.id] != null)
        .map((p) => ({ x: q.x, y: q.p[p.id], color: p.color, label: p.name, meta: q, party: p.id }));
      const gv = q.grp && q.grp.v && q.grp.v[gi], tt = q.grp && q.grp.t;
      if (!gv || !tt) return [];
      const M = aggByYm && aggByYm.get(q.ym);
      if (!M) return [];
      return parts.map((p) => {
        const i = GRPV_KEYS.indexOf(p.id);
        // the group's estimated subsample (gen-data's wave n × the group's
        // share of voters) overrides the tip's whole-wave n, as the rug does
        const subn = q.grp.n && q.grp.n[gi];
        return { x: q.x, y: M[p.id] + (gv[i] - tt[i]), gv: gv[i], color: p.color, label: p.name, meta: q, party: p.id,
                 sub: subn ? "n ≈ " + subn.toLocaleString() : undefined };
      });
    }), [T, G, xDomain[0], xDomain[1]]);
  const shownScatter = React.useMemo(() => scatter.map((d) => (hidden[d.party] ? { ...d, op: 0 } : d)), [scatter, hidden]);
  const marks = base ? parts.map((p) => ({ x: base.x, y: base[p.id], color: p.color, r: 4.5, hidden: !!hidden[p.id] })) : [];
  /* a group's lines open at the first month the houses polled the cut,
     sometimes nearly a year after the election, and the months between
     were never polled - so each ring joins its line with the who-votes
     panels' dotted lead-in, sharing the line's label and both endpoints */
  const leads = G && base
    ? parts.map((p) => {
        const pLive = series(live(p.id), p.id);
        return pLive.length && pLive[0].x > base.x
          ? { id: "ld-" + p.id, label: p.name, color: p.color, dash: RD_ELECTION_LEAD, rdWidth: p.id === "oth" ? 2 : 2.5,
              endCap: false, opacity: hidden[p.id] ? 0 : 1, points: [{ x: base.x, y: base[p.id] }, pLive[0]] }
          : null;
      }).filter(Boolean)
    : [];
  /* the numbered events: the same set the 2PP hero marks, over this chart's
     window */
  const evs = rdChartEvents(D.events, xDomain[0], xDomain[1]);
  const badges = narrow ? rdEventBadges("p1", evs, xDomain[0], xDomain[1]) : null;
  /* the phone list under the chart opens an event's panel by tapping its
     number; a tap on another number hands the panel over, and an event that
     leaves the window is put away by the chart's own reconciliation */
  const [evtOpen, setEvtOpen] = useState(null);
  const pickEv = (e) => { setEvtOpen((cur) => (cur && cur.e === e ? cur : { e })); rdEventReveal("evt-a-" + e.badgeKey); };
  const eDate = (D.cycles.find((c) => c.current) || {}).eDate;
  /* the polls the meta line counts: "national" here, "Victorian" on /vic/ */
  const pollsWord = window.JUR ? window.JUR.adj : "national";
  /* /vic/'s lines are a smoothed trend through every poll (gen-data §1a) */
  const KAL = !!(D.latest.method && D.latest.method.kind === "kalman");
  const meta = G
    ? "Pooled from the last " + T.window + " of " + rdList(G.houses.map(demoHouse)) + " polls"
    : narrow
      ? D.latest.pollsTracked + " " + pollsWord + " polls, latest fieldwork " + rdDate(D.latest.updatedISO)
      : D.latest.pollsTracked + " " + pollsWord + " polls since the " + (eDate ? rdDate(eDate, true) + " " : "") + "election, latest fieldwork " + rdDate(D.latest.updatedISO, true);
  const toggle = (id) => setHidden((h) => {
    const next = { ...h, [id]: !h[id] };
    return parts.every((p) => next[p.id]) ? {} : next;   // never an empty chart
  });
  /* a group's monthly run can peak over the all-voters chart's fixed 40
     (rural One Nation reaches it): the axis then lifts to the next ten,
     y-domain and ticks together. All voters keeps the fixed [0,40] frame */
  const yTop = !G ? 40 : Math.max(40, Math.ceil(Math.max(...gMonths.flatMap((m) =>
    GRPV_KEYS.map((kk) => m[kk] + m.ci[kk]))) * 1.0001 / 10) * 10);
  const yTickSet = [0, 10, 20, 30, 40, 50, 60, 70].filter((t) => t <= yTop);

  /* A phone lists the five as the canvas drew them: the parties the leader
     can't be told apart from grouped in a tinted box under "Within the margin
     of uncertainty", each row a dot and a name over the change, the figure
     right-aligned so the column reads straight down. A wider screen sets the
     five side by side under a coloured rule, the bracket over the group. */
  const stat = (p) => (
    <button key={p.id} type="button" className="rd-pv-stat" aria-pressed={!hidden[p.id]}
            style={narrow ? undefined : { borderTopColor: p.color }}
            title={(hidden[p.id] ? "Show " : "Hide ") + p.name + " on the chart"}
            onClick={() => toggle(p.id)}>
      <span className="rd-pv-name" style={{ color: inkOf(p.color) }}>
        {narrow && <span className="rd-pv-dot" style={{ background: p.color }}></span>}
        {p.id === "oth" && !narrow ? <><span className="rd-pv-long">{p.name}</span><span className="rd-pv-short">Others</span></> : p.name}
      </span>
      <span className="rd-pv-val">{p.v.toFixed(1)}<span className="rd-pv-pct">%</span></span>
      {(() => {
        const w = p.was != null ? { v: p.was, since: "the election" } : (gWas && gWas[p.id] != null ? { v: gWas[p.id], since: rdMonthYear(gWas.ym) } : null);
        return w && (
          <span className="rd-pv-chg">{rdArrow(p.v - w.v)} {Math.abs(p.v - w.v).toFixed(1)} since {w.since}</span>
        );
      })()}
    </button>
  );

  /* a phone swipe landing on the chart steps the same window the menu's
     swipe and its arrow walk do: the card claims touches inside its .chart
     by data-rd-swipe-exact (the hero card's claim shape) and `rangeLive`
     steps and wraps the one shared range state - left for the next window,
     All round to 3 mo, as the menu row does. rdPinScroll holds the card's
     place through the reflow the shared range kicks off above it (the
     two-party card's phone event list), as the menu's own pin does. The
     live/stepper split is the hero card's: the mark is set once, the
     stepper re-read every render so its range is never stale. */
  const rangeLive = React.useRef(null);
  const cardEl = React.useRef(null);
  rangeLive.current = (dir) => {
    const i = RD_RANGES.findIndex((o) => o.id === rangeId);
    if (i < 0) return false;
    if (cardEl.current) rdPinScroll(cardEl.current);
    setRangeId(RD_RANGES[(i + dir + RD_RANGES.length) % RD_RANGES.length].id);
    return true;
  };
  const chartMark = React.useCallback((el) => { cardEl.current = el; if (el) el.__rdSwipe = (dir) => rangeLive.current(dir); }, []);

  /* The same walk answers on a computer wherever the pointer sits over
     the card (the phone swipe's counterpart): bare presses on the page
     itself step the window while a focused control (the menu's own row)
     keeps its walk, and leaving the card hands the page turn back. */
  const hoverKeys = React.useRef(false);
  React.useEffect(() => {
    const sec = cardEl.current;
    if (!sec) return undefined;
    const enter = () => { hoverKeys.current = true; };
    const leave = () => { hoverKeys.current = false; };
    hoverKeys.current = sec.matches(":hover");
    sec.addEventListener("pointerenter", enter);
    sec.addEventListener("pointerleave", leave);
    const key = (e) => {
      if (!hoverKeys.current || (e.key !== "ArrowRight" && e.key !== "ArrowLeft")) return;
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const a = document.activeElement;
      if (a && a.tagName !== "BODY" && a.tagName !== "HTML") return;
      const sel = window.getSelection && window.getSelection();
      if (sel && !sel.isCollapsed) return;
      e.preventDefault();
      rangeLive.current(e.key === "ArrowRight" ? 1 : -1);
    };
    document.addEventListener("keydown", key, true);
    return () => {
      sec.removeEventListener("pointerenter", enter);
      sec.removeEventListener("pointerleave", leave);
      document.removeEventListener("keydown", key, true);
    };
  }, []);

  /* Space walks the group menu while the panel is on screen - the viewport
     claim, not the pointer (the latest card's matchup flip and the
     house-lean flip are the same claim on their own sections): All voters
     first, each menu option after, round to All voters again. With no
     demographics payload (/vic/) there is no menu and Space keeps its
     scroll day job. */
  const spaceGrp = React.useRef(null);
  spaceGrp.current = T && T.tabs ? () => {
    const opts = [""];
    T.tabs.forEach((t) => t.sets.forEach((s) => s.groups.forEach((g) => opts.push(g.label))));
    setGrpId(opts[(opts.indexOf(grpId) + 1) % opts.length]);
  } : null;
  React.useEffect(() => {
    const sec = document.getElementById("primary-vote");
    if (!sec) return undefined;
    const inView = { current: false };
    const io = new IntersectionObserver(
      (es) => es.forEach((en) => { inView.current = en.isIntersecting; }));
    io.observe(sec);
    const key = (e) => {
      if (!inView.current || e.key !== " ") return;
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      const a = document.activeElement;
      if (a && a.tagName !== "BODY" && a.tagName !== "HTML") return;
      const sel = window.getSelection && window.getSelection();
      if (sel && !sel.isCollapsed) return;
      if (!spaceGrp.current) return;
      e.preventDefault();
      if (!e.repeat) spaceGrp.current();
    };
    document.addEventListener("keydown", key, true);
    return () => { io.disconnect(); document.removeEventListener("keydown", key, true); };
  }, []);

  return (
    <RdSec id="primary-vote" title="Primary vote" meta={meta}>
      <div className="rd-pv-head">
        <RdHed head={story.head} dek={story.dek} />
        {T && (
          <select className="rd-pv-sel" aria-label="The primary vote among" value={grpId}
                  onChange={(e) => setGrpId(e.target.value)}>
            <option value="">All voters</option>
            {T.tabs.map((t) => t.sets.map((s) => (
              <optgroup key={s.id} label={s.label || "By " + t.label.toLowerCase()}>
                {s.groups.map((g) => <option key={g.label} value={g.label}>{g.label}</option>)}
              </optgroup>
            )))}
          </select>
        )}
      </div>
      {narrow ? (
        <div className="rd-pv-list">
          {k >= 2 && (
            <div className="rd-pv-group">
              <div className="rd-pv-grouph">Within the margin of uncertainty</div>
              {parts.slice(0, k).map(stat)}
            </div>
          )}
          <div className="rd-pv-rest">{parts.slice(k >= 2 ? k : 0).map(stat)}</div>
        </div>
      ) : (
        <div className="rd-pv-stats" style={{ "--rd-k": k }}>
          {k >= 2 && (
            <div className="rd-pv-bracket" style={{ gridColumn: "1 / span " + k }}>
              <span></span>Within the margin of uncertainty<span></span>
            </div>
          )}
          {parts.map(stat)}
        </div>
      )}
      <div className="card rd-card rd-pv-chart" ref={chartMark} data-rd-swipe-exact="">
        {/* the card claims phone swipes landing on its chart (vs the page
            turn a swipe anywhere else gets) and steps the window; the
            event list and key sit outside .chart so they keep the page
            turn. This menu carries the same window the two-party card
            carries over its chart: the one range state drives both charts,
            a click arms the arrow walk, a phone swipe on the row itself
            steps the windows, and pin holds the row's spot on screen - the
            shared state reshapes THIS card's twin above (the two-party
            phone event list), which would drag the menu out from under
            the reader otherwise */}
        <RdTabs value={rangeId} onChange={setRangeId} options={RD_RANGES} ariaLabel="Time range" className="rd-tabs-sm" swipeSelf pin />
        <TrendChart
          key="rd-pv"
          heightPx={narrow ? 320 : 440}
          padPx={narrow ? { l: 34, r: 6, t: 34, b: 28 } : { l: 40, r: 16, t: 44, b: 30 }}
          xDomain={xDomain} yDomain={[0, yTop]} yTicks={yTickSet}
          yTickFmt={(v) => (v === 0 ? "" : v + "%")} baseline
          /* the axis landmark is the election itself even where a group's
             count was never cut (no ring, no sub-lines there): the window
             opens on election night, so without it the first tick reads
             "May 2025" against the all-voters chart's "Election" */
          xTicks={rdElectionTicks(xDomain[0], xDomain[1], narrow, base ? base.x : allBase ? allBase.x : null)}
          series={leads.length ? chartSeries.concat(leads) : chartSeries} spine={series(live("alp"), "alp")} areas={areas}
          /* a group view's dots open the poll on All polls' Demographics
             facet, its split the view's own (Gen Z → Age, Renting → Home);
             the all-voters chart keeps the Primary facet */
          scatter={shownScatter} pollFacet={G ? "demographics" : "primary"}
          pollSplit={G ? sel.tabId : undefined}
          marks={marks} ringAtX={base ? base.x : null}
          events={badges ? badges.events : evs}
          evt={evtOpen} onEvt={setEvtOpen}
          tooltipTitle={(i) => (pts[i] ? monthLabelFull(pts[i].ym) : "")}
          extraRows={(i) => {
            const d = pts[i];
            if (!d || !d.ci || d.election) return d && d.election ? [{ label: "", value: "The election result" }] : [];
            return [{ label: "95% intervals", value: visible.map((p) => "±" + (d.ci[p.id] != null ? d.ci[p.id].toFixed(1) : "–")).join(" ") }];
          }}
          /* a group view's dot is drawn at a lifted y (the trend plus this
             wave's group-vs-all-voters gap) but tips the figure the wave
             printed - the engine's own display-transform precedent (the
             mood panel's NAB line, drawn +100, tips the net balance) */
          fmt={(v, pt) => (G && pt && pt.gv != null ? pt.gv : v).toFixed(1)}
          /* read away from the page, the copy names its measure and its
             base as well as the finding: "Primary vote" over "Labor and One
             Nation are level" said neither whose votes nor how many polls */
          copy={{ title: "First-preference vote for each party" + (G ? ", " + sel.who : ""), sub: story.head + (G ? ". Monthly averages of the readings every poll reported for " + sel.who + ", latest fieldwork " + rdDate(D.latest.updatedISO, true) + "." : (KAL ? ". Smoothed trends through " : ". Monthly averages of ") + D.latest.pollsTracked + " " + pollsWord
                    + " polls since the " + (eDate ? rdDate(eDate, true) + " " : "") + "election, latest fieldwork " + rdDate(D.latest.updatedISO, true) + "."),
                  caption: KAL ? "Each dot is one poll; lines are smoothed trends, shaded bands their 95% intervals."
                    : G ? "Each dot is one poll’s reading of " + sel.who + " less its own all-voters figure, drawn onto the trend; lines are monthly averages, shaded bands their 95% intervals."
                    : "Each dot is one poll; lines are monthly averages, shaded bands their 95% intervals.",
                  legend: visible.map((p) => ({ label: p.name, color: p.color, kind: p.id === "oth" ? "dashed" : "line" })) }}
        />
        {/* the 2PP card above already lists this window's events under its
            own chart, so two or more fold away behind a disclosure the
            reader opens when a mark puzzles them; two lists said the same
            thing. A lone marked event is no list at all - it just sits out
            as the single row, with no "The marked events" wrapping it */}
        {badges && badges.list.length === 1 && (
          <RdEventList list={badges.list} onPick={pickEv}
                       openKey={evtOpen && evtOpen.e ? evtOpen.e.badgeKey : null} />
        )}
        {badges && badges.list.length > 1 && (
          <details className="rd-evdrop">
            <summary>The marked events</summary>
            <RdEventList list={badges.list} onPick={pickEv}
                         openKey={evtOpen && evtOpen.e ? evtOpen.e.badgeKey : null} />
          </details>
        )}
        {/* the lift mapping, where the dots are read - the glossary's "The
            group views" paragraph is the deep version; a dot's tooltip
            tips the printed figure and the Demographics facet lists them */}
        {G && (
          <p className="rd-note">Each dot is one poll’s reading of {sel.who} less that poll’s own all-voters figure, drawn onto the trend; it is never the cut the poll printed, which sits beside every other poll’s in All polls’ Demographics view.</p>
        )}
        <RdKey className="rd-ckey" items={[
          { kind: "dot", color: "var(--ink-3)", label: "One poll" },
          { kind: "lineband", color: "var(--ink-3)", label: KAL ? (narrow ? "Trend, 95% interval" : "Trend and its 95% interval") : narrow ? "Monthly average, 95% interval" : "Monthly average and its 95% interval" },
          base ? { kind: "ring", label: rdElecYear + " election result" } : null,
        ]}>
          <span className="rd-grow"></span>
          <RdHow term="primary-vote" from="Primary vote" />
        </RdKey>
      </div>
    </RdSec>
  );
}

/* ======================================================================
   Leadership
   ====================================================================== */
const RD_LEAD_ORDER = ["alb", "taylor", "hanson"];

/* a head-to-head as one bar: each side's share from its end, the gap
   between them the voters who named neither */
function RdHeadBar({ label, right, rightColor, segs, cis }) {
  const total = segs.reduce((s, x) => s + x.v, 0);
  const neither = Math.max(0, 100 - total);
  /* "neither" is named only where it fits: a phone's tenth of the bar is
     narrower than the word, and the canvas left that one blank */
  const narrow = useNarrow(MQ_PHONE);
  /* a segment too narrow for its name and number keeps the number: on a
     phone the three-way bar's smallest share is ~70px, a few short of
     "Taylor 21.3", which ran into the edge. The name moves beneath the bar,
     beside its ± where there is one. Measured against the segment's target
     width, not its current one, so the flex-basis transition can't flicker it. */
  const barRef = React.useRef(null);
  const [tight, setTight] = useState("");
  const key = segs.map((s) => s.name + s.v).join("|");
  React.useLayoutEffect(() => {
    const el = barRef.current;
    if (!el) return;
    const fit = () => {
      const kids = [...el.children];
      const W = el.clientWidth - 2 * (kids.length - 1);
      const out = segs.filter((s, i) => {
        const c = kids[i], cs = getComputedStyle(c);
        const parts = [...c.children].map((k) => k.offsetWidth);
        const need = parts.reduce((a, b) => a + b, 0) + 6 * (parts.length - 1) + parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
        return need > W * s.v / 100;
      }).map((s) => s.name).join("|");
      setTight((prev) => (prev === out ? prev : out));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [key]);
  const isTight = (s) => tight.split("|").includes(s.name);
  return (
    <div className="rd-hb" data-hb={label}>
      <div className="rd-hb-top"><b>{label}</b><span style={{ color: rightColor ? inkOf(rightColor) : undefined }}>{right}</span></div>
      <div className="rd-hb-bar" ref={barRef}>
        {segs.map((s, i) => (
          <span key={s.name} className={"rd-hb-seg" + (i === segs.length - 1 && segs.length === 2 ? " end" : "") + (isTight(s) ? " tight" : "")}
                aria-label={s.name + " " + s.v.toFixed(1)} data-mk={s.mk}
                style={{ flexBasis: s.v + "%", background: s.color, color: "var(--on-fill-" + s.party + ")", order: s.order != null ? s.order : i * 2 }}>
            <span className="rd-hb-name">{s.name}</span><b><RollNum value={s.v.toFixed(1)} /></b>
          </span>
        ))}
        {neither > 0.5 && (
          <span className="rd-hb-seg rd-hb-neither" style={{ flexBasis: neither + "%", order: segs.length === 2 ? 1 : 99 }}>
            {neither >= (narrow ? 14 : 7) ? "neither" : ""}</span>
        )}
      </div>
      {cis && (
        <div className="rd-hb-cis">
          {/* ordered as the bar is, so a two-way's ± sits under its own
              leader either side of "neither" */}
          {segs.map((s, i) => <span key={s.name} className={i === segs.length - 1 && segs.length === 2 ? "end" : undefined}
            style={{ flexBasis: s.v + "%", order: s.order != null ? s.order : i * 2 }}>{isTight(s) ? s.name + " " : ""}{s.ci != null ? <>±<RollNum value={s.ci.toFixed(1)} /></> : null}</span>)}
          {neither > 0.5 && <span style={{ flexBasis: neither + "%", order: segs.length === 2 ? 1 : 99 }}></span>}
        </div>
      )}
    </div>
  );
}

function RdLeadership({ rangeId }) {
  const { D, rangeDomain, filterPts, monthLabelFull } = window.AP;
  const narrow = useNarrow(MQ_PHONE);
  const xDomain = rangeDomain(rangeId);
  /* the jurisdiction's baseline election rides the axis as in RdPrimary:
     data-driven, so /vic/ never sees the federal mark (its own gritting
     falls back to the plain month grid when the window opens past it) */
  const base = (D.aggPrimary || []).find((d) => d.election) || null;
  const N = D.leaderNow || {};
  const LM = D.leaderMonths;
  const L = {};
  D.LEADERS.forEach((x) => { L[x.id] = x; });
  const opp = L.taylor, han = L.hanson, pm = L.alb;
  /* /vic/ (window.JUR): an office there has passed through several hands
     inside one key - Andrews → Allan → Carroll all in alb_*, Pesutto →
     Battin in ley_* - so its lines split wherever gen-data's monthly holder
     (alb_who, ley_who, hanson_who) changes, and a poll's own holder is read
     off its date. Every J branch below is /vic/'s; the federal panel runs
     as it did. The words name people, never pronouns. */
  const J = window.JUR;
  const SLOT = { alb: "alb", taylor: "opp", ley: "opp", hanson: "han" };
  const holderAt = (slot, iso) => { let n = null; if (J && iso) for (const e of J.eras[slot]) if (iso >= e.from) n = e.name; return n; };
  const sinceOf = (slot) => (J ? J.eras[slot][J.eras[slot].length - 1].from : null);
  /* the houses that ask a leader question, for the copy's credits: the
     federal lists are written out, /vic/'s are read off its polls */
  const jHouses = (test) => {
    const n = new Map();
    D.individualPolls.forEach((q) => { if (test(q)) n.set(q.pollster, (n.get(q.pollster) || 0) + 1); });
    const l = [...n.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).map(([k]) => k);
    return l.length > 4 ? l.slice(0, 3).join(", ") + " and others" : rdList(l);
  };
  const jApprBy = (fav) => jHouses((q) => q.appr && ["alb", "taylor", "hanson"].some((k) => q.appr[k + "Net"] != null && ((q.appr.metricBy || {})[k] === "fav") === fav));
  const [ppmView, setPpmView] = useState(() => (
    /* /vic/'s polls moved to the three-way question with One Nation's
       arrival: with no current two-way reading, it opens on the three-way */
    J && !(N.alb_pref && N.taylor_pref) && N.alb_pref3 ? "three" : "two"));
  /* two-way <-> three-way is the same people asked a differently shaped
     question, so the chart reshapes rather than being replaced - the gesture
     useMorph gives every such switch. "Both" keeps the lead chart in this slot
     and adds the three-way below it, so reaching it from three-way is the
     morph to two-way. */
  const ppmSlot = (v) => (v === "three" ? "three" : "two");
  const [ppmMorph, choosePpm] = window.AP.useMorph(ppmView, (v) => setPpmView(v), (from, to) => ppmSlot(from) !== ppmSlot(to));
  const [expanded, setExpanded] = useState(null);
  /* /vic/ opens on whichever rating its pollsters currently ask: most ask
     favourability, and job approval can go six weeks unasked */
  const [own, setOwn] = useState(() => (J && !N.alb_net && !N.taylor_net && (N.alb_fav || N.taylor_fav) ? "fav" : "net"));
  const [rawMorph, chooseMetric] = window.AP.useMorph(own, (v) => setOwn(v), (from, to) => from !== "both" && to !== "both" && from !== to);
  const morph = rawMorph;
  const metric = own;
  const r1 = (v) => Math.round(v);
  const signed = (v) => (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(1);
  const signed0 = (v) => (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(Math.round(v));
  const get = (k) => (N[k] ? N[k].v : null);

  /* ---- the headline: preferred PM against net approval ------------------ */
  const story = J ? (() => {
    /* /vic/: who leads now (head to head where the current pairing has a
       reading, else from all three), then the same opposition leader's
       gap against the previous Premier, the last month that was polled */
    const a = get("alb_pref"), o = get("taylor_pref");
    const t3 = ["alb_pref3", "taylor_pref3", "hanson_pref3"].every((k) => get(k) != null)
      ? [[pm, get("alb_pref3")], [opp, get("taylor_pref3")], [han, get("hanson_pref3")]].sort((x, y) => y[1] - x[1]) : null;
    if ((a == null || o == null) && !t3) return null;
    const two = a != null && o != null;
    const top = two ? (a >= o ? pm : opp) : t3[0][0];
    const head = top.short + " leads as preferred " + J.office.alb;
    let dek = two
      ? "Head to head, " + top.short + " leads " + (top === pm ? opp : pm).short + " " + r1(Math.max(a, o)) + "–" + r1(Math.min(a, o)) + "."
      : "Asked to choose from all three, " + t3.map(([Ld, v], i) => (i === 0 ? "" : i === t3.length - 1 ? " and " : ", ") + Ld.short + " has " + r1(v) + "%").join("") + ".";
    const prev = LM.slice().reverse().find((r) => r.lead_taylor != null && r.alb_who && r.alb_who !== pm.short);
    if (prev) {
      const pl = prev.lead_taylor;
      dek += " Against " + prev.alb_who + ", in " + rdMonthYear(prev.ym) + ", " + (pl >= 0 ? prev.alb_who : opp.short)
        + " led by " + r1(Math.abs(pl)) + " point" + (r1(Math.abs(pl)) === 1 ? "" : "s") + " head to head.";
    }
    return { head, dek };
  })() : (() => {
    const a = get("alb_pref"), o = get("taylor_pref"), aH = get("alb_prefH"), h = get("hanson_prefH");
    const net = get("alb_net");
    const first = LM.find((r) => r.alb_net != null);
    if (a == null || o == null || net == null || !first) return null;
    const fall = first.alb_net - net;
    const leads = a > o;
    const round5 = (v) => Math.round(v / 5) * 5;
    const head = (leads ? pm.short + " still leads as preferred PM" : opp.short + " leads as preferred PM")
      + (Math.abs(fall) >= 10 ? ", but his net approval has " + (fall > 0 ? "fallen " : "risen ") + round5(Math.abs(fall)) + " points" : "");
    const leyRows = LM.filter((r) => r.alb_pref != null && r.ley_pref != null);
    const leyLead = leyRows.length ? leyRows.reduce((s, r) => s + r.alb_pref - r.ley_pref, 0) / leyRows.length : null;
    const hanLead = aH != null && h != null ? aH - h : null;
    /* "held steady since it was first measured": the running lead sits within
       a poll's noise of the contest's first monthly reading */
    const hanRows = LM.filter((r) => r.alb_prefH != null && r.hanson_prefH != null);
    const hanSteady = hanLead != null && hanRows.length > 0 && Math.abs(hanLead - (hanRows[0].alb_prefH - hanRows[0].hanson_prefH)) <= 4;
    let dek = leyLead != null && leads && leyLead - (a - o) >= 4
      ? "His lead over the opposition leader has narrowed from " + signed0(leyLead) + " under Ley to " + signed0(a - o) + " under " + opp.short + "."
      : ((leads ? "He leads " : "He trails ") + opp.short + " " + r1(Math.max(a, o)) + "–" + r1(Math.min(a, o)) + " head to head.");
    if (hanLead != null && hanLead > 0)
      dek += " Over " + han.short + (hanLead > a - o ? " his lead is greater (" : " he leads by ")
        + signed0(hanLead) + (hanLead > a - o ? ")" : " points")
        + (hanSteady ? ", and has held steady since it was first measured." : ".");
    return { head, dek };
  })();

  /* ---- preferred PM: the bars ------------------------------------------- */
  /* `mk` is who a segment IS across the switch, the way the chart's lines
     are matched: the two-way's first Albanese and its Taylor and Hanson are
     the three-way's ("3:" marks the three-way bar, so "Both", which shows the
     two side by side, never pairs a segment with one still on screen). The
     head-to-head Albanese has no three-way counterpart. */
  const seg = (Ld, k, order, mk) => ({ name: Ld.short, v: get(k), color: Ld.color, party: Ld.id === "alb" ? "alp" : Ld.id === "taylor" ? "lnp" : "onp", ci: N[k] ? N[k].ci95 : null, order, mk });
  const twoNow = get("alb_pref") != null && get("taylor_pref") != null
    ? { label: pm.short + " v " + opp.short, segs: [seg(pm, "alb_pref", 0, "alb"), seg(opp, "taylor_pref", 2, "taylor")] } : null;
  /* /vic/: no head-to-head inside the window (its pollsters moved to the
     three-way question) - the bar shows the latest month the sitting pair
     was asked head to head, labelled with that month, rather than leaving
     the slot empty */
  const twoLast = J && !twoNow ? (() => {
    const r = LM.slice().reverse().find((m) => m.alb_pref != null && m.taylor_pref != null && m.alb_who === pm.short);
    if (!r) return null;
    const one = (Ld, k, order, mk) => ({ name: Ld.short, v: r[k], color: Ld.color, party: Ld.id === "alb" ? "alp" : "lnp", ci: r[k + "Ci"] ?? null, order, mk });
    return { label: pm.short + " v " + opp.short + ", " + rdMonthYear(r.ym),
             segs: [one(pm, "alb_pref", 0, "alb"), one(opp, "taylor_pref", 2, "taylor")] };
  })() : null;
  const two = twoNow || twoLast;
  const twoH = get("alb_prefH") != null && get("hanson_prefH") != null
    ? { label: pm.short + " v " + han.short, segs: [seg(pm, "alb_prefH", 0, "alb-h2h"), seg(han, "hanson_prefH", 2, "hanson")] } : null;
  const three = ["alb_pref3", "taylor_pref3", "hanson_pref3"].every((k) => get(k) != null)
    ? [seg(pm, "alb_pref3", null, "3:alb"), seg(opp, "taylor_pref3", null, "3:taylor"), seg(han, "hanson_pref3", null, "3:hanson")].sort((x, y) => y.v - x.v) : null;
  const leadOf = (segs) => { const w = segs[0].v >= segs[1].v ? segs[0] : segs[1]; return { who: w, m: Math.abs(segs[0].v - segs[1].v) }; };
  const headBar = (h) => {
    const l = leadOf(h.segs);
    return <RdHeadBar key={h.label} label={h.label} right={<>{l.who.name} +<RollNum value={l.m.toFixed(1)} /></>} rightColor={l.who.color} segs={h.segs} cis />;
  };
  const threeBar = three && (
    <RdHeadBar key="three" label="All three" right={<>{three[0].name} +<RollNum value={(three[0].v - three[1].v).toFixed(1)} /> on {three[1].name}</>}
               rightColor={three[0].color} segs={three} cis />
  );
  /* ---- the bars travel between the questions ------------------------------
     As the old design's readout does: a leader in both questions keeps his
     segment, which slides and resizes to where the other question puts him,
     and its figure rolls from the old reading to the new. The layouts are
     different shapes (two bars of two, one bar of three), so React builds new
     elements and nothing can be matched by position: they are matched by
     `mk`. FLIP - where each segment was is read at the click, BEFORE React
     replaces anything, so a switch made mid-flight starts from where the
     segment is on screen; after the render each is put back there with a
     transform and flex-basis and released onto the shared 320ms curve.
     Anything with no counterpart (the head-to-head Albanese, "neither", a
     bar's heading and ± row) fades in. */
  const hbsRef = React.useRef(null);
  const hbSnap = React.useRef(null);
  const ppmPick = (v) => {
    const root = hbsRef.current;
    if (root && v !== ppmView) {
      const rr = root.getBoundingClientRect();
      const segsAt = {};
      root.querySelectorAll("[data-mk]").forEach((n) => {
        const r = n.getBoundingClientRect();
        segsAt[n.dataset.mk] = { x: r.left - rr.left, y: r.top - rr.top, w: r.width,
          d: [...n.querySelectorAll("b .roll-reel")].map((x) => x.style.getPropertyValue("--d")) };
      });
      hbSnap.current = { segs: segsAt, bars: new Set([...root.querySelectorAll("[data-hb]")].map((b) => b.dataset.hb)) };
    }
    choosePpm(v);
  };
  React.useLayoutEffect(() => {
    const prev = hbSnap.current, root = hbsRef.current;
    hbSnap.current = null;
    if (!prev || !root) return;
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const MS = window.AP.MORPH_MS || 320, EASE = window.AP.MORPH_CSS;
    const alias = (k) => (k.startsWith("3:") ? k.slice(2) : "3:" + k);
    const nodes = [...root.querySelectorAll("[data-mk]")];
    const here = new Set(nodes.map((n) => n.dataset.mk));
    const release = [];
    const fadeIn = (n) => {
      n.style.transition = "none"; n.style.opacity = "0";
      release.push(() => { n.style.transition = "opacity " + MS + "ms " + EASE; n.style.opacity = ""; });
    };
    // a figure rolls from the old reading: its reels start on the old digits,
    // paired from the right (units under units), as an odometer lines up
    const seed = (n, was) => {
      const cur = [...n.querySelectorAll("b .roll-reel")];
      const off = cur.length - was.length;
      cur.forEach((reel, i) => {
        const from = was[i - off], to = reel.style.getPropertyValue("--d");
        if (from == null || from === "" || from === to) return;
        reel.style.transition = "none"; reel.style.setProperty("--d", from);
        release.push(() => { reel.style.transition = ""; reel.style.setProperty("--d", to); });
      });
    };
    const moving = [];
    nodes.forEach((n) => {
      const k = n.dataset.mk;
      // its own self if it was there; else its counterpart in the other
      // question, provided that one has gone (under "Both" it hasn't)
      const a = prev.segs[k] || (!here.has(alias(k)) && prev.segs[alias(k)]) || null;
      if (!a) { fadeIn(n); return; }
      seed(n, a.d);
      moving.push({ n, a, basis: n.style.flexBasis });
      // start at the old width, so the flex row lays out the old shape first
      n.style.transition = "none";
      n.style.flexBasis = (a.w / n.parentElement.getBoundingClientRect().width) * 100 + "%";
    });
    [...root.querySelectorAll("[data-hb]")].forEach((b) => {
      if (prev.bars.has(b.dataset.hb)) return;
      b.querySelectorAll(".rd-hb-top, .rd-hb-cis, .rd-hb-neither").forEach(fadeIn);
    });
    const rr = root.getBoundingClientRect();
    moving.forEach((m) => {
      const r = m.n.getBoundingClientRect();
      m.n.style.transform = "translate(" + (m.a.x - (r.left - rr.left)) + "px, " + (m.a.y - (r.top - rr.top)) + "px)";
      release.push(() => {
        m.n.style.transition = "transform " + MS + "ms " + EASE + ", flex-basis " + MS + "ms " + EASE;
        m.n.style.transform = ""; m.n.style.flexBasis = m.basis;
      });
    });
    void root.offsetWidth;          // commit every start state at once, then release them together
    release.forEach((f) => f());
  }, [ppmView]);
  const secondIsHanson = three && three[1].name === han.short;
  const ppmNote = (() => {
    if (ppmView === "two") {
      if (!three) return null;
      const lastTwo = J && !twoNow && !two ? LM.slice().reverse().find((r) => r.alb_pref != null && r.taylor_pref != null) : null;
      return (lastTwo ? "The head-to-head question was last asked in " + rdMonthYear(lastTwo.ym) + ". " : "")
        + "Asked to choose from all three: " + three.map((s) => s.name + " " + r1(s.v) + "%").join(", ") + "."
        + (secondIsHanson ? " " + han.short + ", not " + opp.short + ", runs second." : "");
    }
    if (ppmView === "three") {
      const rows = LM.filter((r) => r.hanson_pref3 != null && (r.taylor_pref3 != null || r.ley_pref3 != null));
      if (!rows.length) return null;
      const gapOf = (r) => r.hanson_pref3 - (r.taylor_pref3 != null ? r.taylor_pref3 : r.ley_pref3);
      const ahead = rows.every((r) => gapOf(r) > 0);
      const peak = rows.reduce((m, r) => (gapOf(r) > gapOf(m) ? r : m), rows[0]);
      const last = rows[rows.length - 1];
      const behind = rows.every((r) => gapOf(r) < 0);
      let s = ahead ? han.short + " has run ahead of the Coalition leader in every month’s three-way average since " + D.monthNameFull(Number(rows[0].ym.slice(5)))
        : behind ? han.short + " has trailed the Coalition leader in every month’s three-way average since " + D.monthNameFull(Number(rows[0].ym.slice(5)))
        : han.short + " and the Coalition leader have swapped places in the three-way average";
      if (ahead && gapOf(peak) - gapOf(last) >= 3)
        s += ", though " + opp.short + " has cut the gap from " + r1(gapOf(peak)) + " points in " + D.monthNameFull(Number(peak.ym.slice(5))) + " to " + r1(gapOf(last));
      s += ".";
      const cis = three.map((x) => x.ci || 0);
      if (N.alb_pref3 && N.alb_pref3.ci95 > 1.6 * Math.max(...cis.filter((c, i) => three[i].name !== pm.short)))
        s += " " + pm.short + "’s wide range reflects how differently pollsters ask this question.";
      return s;
    }
    const beats = two && twoH && leadOf(two.segs).who.name === pm.short && leadOf(twoH.segs).who.name === pm.short;
    return (beats ? "Head to head, " + pm.short + " beats both." : "")
      + (secondIsHanson ? " In the three-way question " + han.short + ", not " + opp.short + ", runs second." : "");
  })();

  /* ---- preferred PM: the charts ----------------------------------------- */
  const pts = filterPts(LM, xDomain[0]);
  /* The charts' data only changes with the range and the screen, and a
     switch re-renders this panel on every frame, so each set of lines and
     dots is built once and kept - which also lets a switch's blend find the
     pair of views it lined up on the frame before. */
  const memo = React.useRef({ key: null, m: new Map() });
  const memoKey = xDomain[0] + "|" + xDomain[1] + "|" + narrow;
  if (memo.current.key !== memoKey) memo.current = { key: memoKey, m: new Map() };
  const kept = (k, f) => { const mm = memo.current.m; if (!mm.has(k)) mm.set(k, f()); return mm.get(k); };
  const handover = (D.events || []).find((e) => e.date === "2026-02-12");
  /* /vic/ flags its changes of Premier, named as the federal handover is
     ("Allan → Carroll"). Its opposition changes go unflagged: the chart
     engine names at most two events on a half-width chart, and the lines'
     own labels ("over Battin", "Wilson") already say who took over when */
  const evs = J
    ? ["alb"].flatMap((slot) => J.eras[slot].slice(1).map((e, i) => {
        const ev = (D.events || []).find((x) => x.date === e.from);
        return ev ? { ...ev, short: J.eras[slot][i].name + " → " + e.name } : null;
      })).filter(Boolean).sort((a, b) => a.x - b.x)
    : handover ? [{ ...handover, short: "Ley → Taylor" }] : [];
  /* each month's lead is its polls' own margins averaged (gen-data's
     lead_*), so its 95% band carries a margin's variance rather than two
     shares' bands stacked as if they were independent */
  const run = (k) => pts.filter((r) => r[k] != null).map((r) => ({ x: r.x, y: r[k], ym: r.ym, ci: r[k + "Ci"] }));
  /* J: a key's points cut into runs of one holder - or one pairing - each */
  const runsJ = (k, whoOf) => {
    const out = [];
    pts.forEach((r) => {
      if (r[k] == null) return;
      const w = whoOf(r), last = out[out.length - 1];
      const p = { x: r.x, y: r[k], ym: r.ym, ci: r[k + "Ci"] };
      if (last && last.who === w) last.points.push(p); else out.push({ who: w, points: [p] });
    });
    return out;
  };
  const lastOpp = J ? J.eras.opp[J.eras.opp.length - 1].name : null;
  /* J: the months a chart's hover reads are every month any of its lines
     has (one family's months alone would leave the earlier holders' unread) */
  /* J: holders' name notes that would print over each other (two lines
     ending in the same months) take turns above and below their points;
     `span` is how close in value counts as a clash, in the chart's units */
  const unclash = (notes, span) => {
    const placed = [];
    return notes.slice().sort((a, b) => a.x - b.x).map((n) => {
      const clash = (q) => Math.abs(q.x - n.x) < 0.5 && Math.abs(q.y - n.y) < span && Math.sign(q.dy) === Math.sign(n.dy);
      let out = n;
      if (placed.some(clash)) out = { ...n, dy: n.dy > 0 ? -9 : 18 };
      placed.push(out);
      return out;
    });
  };
  const spineOf = (series) => {
    const by = new Map();
    series.forEach((s) => s.points.forEach((p) => { if (p.ym && !by.has(p.ym)) by.set(p.ym, p); }));
    return [...by.values()].sort((a, b) => a.x - b.x);
  };
  /* mid-switch a line's points carry its band's own edges (ciLo/ciHi, see
     blendRows), which the band is drawn from */
  const bandsOf = (series) => series.map((s) => ({
    id: "ci-" + s.id, color: s.color, className: "ci-band", edge: false, clipX: s.ciClip || s.clipX,
    wipeOf: s.wipe != null ? s.id : undefined,
    points: s.points.some((p) => p.ciHi != null)
      ? s.points.filter((p) => p.ciHi != null && p.ciLo != null).map((p) => ({ x: p.x, y0: p.ciLo, y1: p.ciHi }))
      : s.points.filter((p) => p.ci != null).map((p) => ({ x: p.x, y0: p.y - p.ci, y1: p.y + p.ci })),
  })).filter((a) => a.points.length >= 2);
  const ciRows = (series, i, spine) => {
    const r = spine[i];
    if (!r) return [];
    const cs = series.map((s) => { const p = s.points.find((q) => q.ym === r.ym); return p && p.ci != null ? s.label + " ±" + p.ci.toFixed(1) : null; }).filter(Boolean);
    return cs.length ? [{ label: "95% intervals", value: cs.join(", ") }] : [];
  };
  const leadSeries = kept("leadSeries", () => J ? (() => {
    /* /vic/: one line per PAIRING, so a change of Premier breaks the line
       as a change of opposition leader does; each family's latest run is
       the one the three-way view's lines reshape into */
    const runs = [
      ...runsJ("lead_ley", (r) => (r.alb_who || "") + "|" + (r.ley_who || "")).map((x) => ({ ...x, fam: "ley" })),
      ...runsJ("lead_taylor", (r) => (r.alb_who || "") + "|" + lastOpp).map((x) => ({ ...x, fam: "taylor" })),
      ...runsJ("lead_hanson", (r) => (r.alb_who || "") + "|" + (r.hanson_who || "")).map((x) => ({ ...x, fam: "hanson" })),
    ];
    return runs.map((x, i) => {
      const fin = x.fam !== "ley" && !runs.slice(i + 1).some((y) => y.fam === x.fam);
      const rival = x.who.split("|")[1];
      return { id: fin ? x.fam : "lead:" + x.who, label: "over " + rival, color: x.fam === "hanson" ? han.color : opp.color,
               points: x.points, rdWidth: 2.5, ...(fin ? { endLabel: "over " + rival } : { endCap: false }) };
    });
  })() : [
    { id: "ley", label: "over Ley", color: opp.color, points: run("lead_ley"), rdWidth: 2.5, endCap: false },
    /* the lines are named at their ends on a phone too, as the canvas drew
       them: no key under the chart names them */
    { id: "taylor", label: "over " + opp.short, color: opp.color, points: run("lead_taylor"), rdWidth: 2.5, endLabel: "over " + opp.short },
    { id: "hanson", label: "over " + han.short, color: han.color, points: run("lead_hanson"), rdWidth: 2.5, endLabel: "over " + han.short },
  ].filter((s) => s.points.length));
  /* each poll's own lead in each head-to-head it asked: the opposition
     leader ("at") and Hanson ("ah"), never the three-way */
  const leadDots = kept("leadDots", () => D.individualPolls.filter((q) => q.x >= xDomain[0] && q.x <= xDomain[1])
    .flatMap((q) => ["at", "ah"].map((mode) => {
      const c = ppmMatch(q, mode);
      if (!c || c.alb == null) return null;
      const o = mode === "ah" ? "hanson" : c.taylor != null ? "taylor" : c.ley != null ? "ley" : null;
      if (!o || c[o] == null) return null;
      return { x: q.x, y: c.alb - c[o], color: o === "hanson" ? han.color : opp.color, who: o,
               label: J ? (holderAt("alb", q.released) || pm.short) + " over " + (holderAt(SLOT[o], q.released) || L[o === "ley" ? "taylor" : o].short)
                 : "Albanese over " + (o === "hanson" ? "Hanson" : o === "ley" ? "Ley" : opp.short), meta: q };
    })).filter(Boolean));
  const bandVals = (series) => series.flatMap((s) => s.points.flatMap((p) => (p.ci != null ? [p.y - p.ci, p.y + p.ci] : [p.y])));
  const leadVals = bandVals(leadSeries).concat(leadDots.map((d) => d.y));
  const leadFit = fitDomain(leadVals.length ? leadVals : [0, 20], 10, 0);
  const leyPeak = leadSeries.find((s) => s.id === "ley");
  /* J: each earlier opposition leader named once, over the peak of the
     lines against them (the latest one is named at its line's end) */
  const leadNotes = J ? (() => {
    const peaks = new Map();
    leadSeries.filter((s) => s.id.startsWith("lead:") && s.label !== "over " + lastOpp).forEach((s) => {
      const pk = s.points.reduce((m, p) => (p.y > m.y ? p : m), s.points[0]);
      const was = peaks.get(s.label);
      if (!was || pk.y > was.pk.y) peaks.set(s.label, { pk, color: s.color });
    });
    return unclash([...peaks.entries()].map(([text, { pk, color }]) => ({ x: pk.x, y: pk.y, dy: -9, text, anchor: "middle", color: inkOf(color), weight: 600 })),
      (leadFit.domain[1] - leadFit.domain[0]) * 0.12);
  })() : leyPeak && leyPeak.points.length ? (() => {
    const pk = leyPeak.points.reduce((m, p) => (p.y > m.y ? p : m), leyPeak.points[0]);
    return [{ x: pk.x, y: pk.y, dy: -9, text: "over Ley", anchor: "middle", color: inkOf(opp.color), weight: 600 }];
  })() : [];
  const threeSeries = kept("threeSeries", () => J ? (() => {
    /* J: one line per holder; the latest holder of each office is the line
       the two-way view's runs reshape into, earlier ones end in a cap */
    const fam = (k, id, Ld, whoOf) => {
      const rs = runsJ(k, whoOf);
      return rs.map((x, i) => {
        const fin = i === rs.length - 1 && (id !== "ley");
        return { id: fin ? id : "3:" + id + ":" + x.who, label: x.who || Ld.short, color: Ld.color, points: x.points, rdWidth: 2.5,
                 ...(fin ? { endLabel: x.who || Ld.short } : { endCap: true }) };
      });
    };
    return [
      ...fam("alb_pref3", "alb", pm, (r) => r.alb_who),
      ...fam("hanson_pref3", "hanson", han, (r) => r.hanson_who),
      ...fam("ley_pref3", "ley", opp, (r) => r.ley_who),
      ...fam("taylor_pref3", "taylor", opp, () => lastOpp),
    ];
  })() : (() => {
    return [
      { id: "alb", label: pm.short, color: pm.color, points: run("alb_pref3"), rdWidth: 2.5, endLabel: pm.short },
      { id: "hanson", label: han.short, color: han.color, points: run("hanson_pref3"), rdWidth: 2.5, endLabel: han.short },
      { id: "ley", label: "Ley", color: opp.color, points: run("ley_pref3"), rdWidth: 2.5, endCap: true },
      { id: "taylor", label: opp.short, color: opp.color, points: run("taylor_pref3"), rdWidth: 2.5, endLabel: opp.short },
    ].filter((s) => s.points.length);
  })());
  const firstThree = threeSeries.length ? Math.min(...threeSeries.map((s) => s.points[0].x)) : null;
  /* each poll's three-way shares, one dot per leader in his or her colour -
     the spread the key tells readers to expect, shown rather than asserted */
  const threeDots = kept("threeDots", () => D.individualPolls.filter((q) => q.x >= xDomain[0] && q.x <= xDomain[1])
    .flatMap((q) => {
      const c = ppmMatch(q, "3");
      if (!c) return [];
      const oppK = c.taylor != null ? "taylor" : c.ley != null ? "ley" : null;
      return (J ? [["alb", pm.color, holderAt("alb", q.released) || pm.short], [oppK, opp.color, holderAt("opp", q.released) || opp.short], ["hanson", han.color, holderAt("han", q.released) || han.short]]
        : [["alb", pm.color, pm.short], [oppK, opp.color, oppK === "ley" ? "Ley" : opp.short], ["hanson", han.color, han.short]])
        .filter(([k]) => k && c[k] != null)
        .map(([k, color, label]) => ({ x: q.x, y: c[k], color, label, meta: q, who: k }));
    }));
  const threeTop = Math.max(40, Math.ceil(Math.max(...bandVals(threeSeries), ...threeDots.map((d) => d.y), 0) / 10) * 10);
  const leyRun = threeSeries.find((s) => s.id === "ley");
  /* the note on the empty months before the question was first asked sits
     in them, wrapped to their width and in fewer words where a phone leaves
     too little room: pinned to the plot's left edge, a phone's narrow plot
     ran it across January and over Hanson's line */
  const threeFrom = (() => { const r = LM.find((m) => m.alb_pref3 != null); return r ? rdMonthYear(r.ym).replace(" ", "\u00a0") : ""; })();
  const threeNotes = [
    firstThree != null && firstThree - xDomain[0] > 0.2 ? { span: ["left", { data: Math.min(firstThree, ...threeDots.filter((d) => d.x >= xDomain[0]).map((d) => d.x)) }], y: threeTop * 0.62, text: ["Three-way questions began in " + threeFrom, "First asked in " + threeFrom], cls: "rd-note-it" } : null,
    ...(J ? unclash(threeSeries.filter((s) => s.id.startsWith("3:")).map((s) => ({ x: s.points[s.points.length - 1].x, y: s.points[s.points.length - 1].y, dy: 18, text: s.label, anchor: "middle", color: inkOf(s.color), weight: 600 })), threeTop * 0.12)
      : [leyRun && leyRun.points.length ? { x: leyRun.points[leyRun.points.length - 1].x, y: leyRun.points[leyRun.points.length - 1].y, dy: 18, text: "Ley", anchor: "middle", color: inkOf(opp.color), weight: 600 } : null]),
  ].filter(Boolean);
  /* a phone's title runs the chart's width, so the Ley → Taylor flag needs
     its own band above the plot or it prints over the title */
  const chartPad = narrow ? { l: 34, r: 6, t: 40, b: 28 } : { l: 40, r: 12, t: 30, b: 30 };
  const lchart = (key, title, props) => (
    <div className="card rd-card rd-ld-chart" key={key}>
      <div className="rd-chead"><span className="rd-chead-t">{title}</span></div>
      <TrendChart key={key} heightPx={narrow ? 250 : 270} padPx={chartPad} xDomain={xDomain}
                  xTicks={rdElectionTicks(xDomain[0], xDomain[1], narrow, base ? base.x : null)} baseline events={evs}
                  tooltipTitle={(i) => { const s = props.spine || []; return s[i] && s[i].ym ? monthLabelFull(s[i].ym) : ""; }}
                  fmt={(v) => v.toFixed(1)} {...props} />
    </div>
  );
  /* The two views as data, so the one chart can be either or on its way
     between them. Series ids are shared across the views - a line is matched
     by the rival whose colour it is: Albanese's lead over Taylor reshapes into
     Taylor's three-way share, and over Hanson into Hanson's. Albanese's own
     three-way line has no head-to-head counterpart, so it is drawn in (and
     rubbed out on the way back) rather than travelling. */
  /* The key under the chart, in pieces, so a copied chart's caption says
     what the page's key says. The copy is read away from the panel, so it
     also carries the panel's name as its title; its lines are named at
     their ends, so it wants no legend. */
  const keyDots = "Each dot is one poll; lines are monthly averages, shaded bands their 95% intervals.";
  const keyThree = "Shares of all respondents. Pollsters leave different shares undecided, so read the order and the gaps rather than the levels.";
  const keyLead = J ? "Lead is the " + J.office.alb + "’s share minus the " + J.office.opp + "’s" : "Lead is " + pm.short + "’s share minus his opponent’s";
  const ppmModel = (v) => v === "three" ? {
    title: "Share in the three-way question, month by month", series: threeSeries, dots: threeDots,
    domain: [0, threeTop], yTicks: rdYTicks(0, threeTop, 10), yTickFmt: (y) => (y === 0 ? "0" : y % 20 === 0 ? y + "%" : ""),
    refLines: [], notes: threeNotes, spine: J ? spineOf(threeSeries) : (threeSeries[0] || { points: [] }).points,
    copy: { title: (J ? "Preferred " + J.office.alb : "Preferred prime minister") + ": " + pm.short + ", " + opp.short + " or " + han.short,
            sub: "Each leader’s share when voters are asked to choose from all three, month by month",
            legend: [], caption: keyDots + " " + keyThree },
  } : {
    title: (J ? "The " + J.office.alb : pm.short) + "’s lead" + (ppmView === "both" ? " head to head" : "") + ", month by month", series: leadSeries, dots: leadDots,
    domain: leadFit.domain, yTicks: rdYTicks(leadFit.domain[0], leadFit.domain[1], 10).filter((y) => y >= 0 || y === leadFit.domain[0]),
    yTickFmt: (y) => (y === 0 ? "Tied" : y > 0 ? "+" + y : "−" + Math.abs(y)),
    refLines: [{ y: 0, color: "var(--ink-3)" }], notes: leadNotes,
    spine: J ? spineOf(leadSeries) : (leadSeries.find((s) => s.id === "taylor") || leadSeries[0] || { points: [] }).points,
    copy: { title: J ? "The " + J.office.alb + "’s lead as preferred " + J.office.alb : pm.short + "’s lead as preferred prime minister",
            sub: "Points ahead of each rival when voters are asked to choose between the two, month by month",
            legend: [], caption: keyDots + " " + keyLead + "." },
  };
  /* The engine widens the right margin to the longest end label showing, so
     priced per drawn set each view would get its own plot width and the
     switch would jolt it. Handing the union of both views' series to the
     engine's own measured reserve keeps one exact margin through the morph. */
  const ppmPadSeries = leadSeries.concat(threeSeries);
  const ppmChart = (key, v, m) => {
    const B = ppmModel(m ? ppmSlot(m.to) : v);
    let series = B.series, cross = null, dom = B.domain;
    if (m) {
      const A = ppmModel(ppmSlot(m.from)), t = m.t;
      const byId = (list) => { const o = {}; list.forEach((x) => (o[x.id] = x)); return o; };
      const a = byId(A.series), b = byId(B.series);
      series = [...new Set(A.series.concat(B.series).map((x) => x.id))].map((id) => {
        if (a[id] && b[id]) {
          const bl = window.AP.blendRows(a[id].points, b[id].points, t, ["y", "ci"]);
          const own = t < 0.5 ? a[id] : b[id];
          // the name fades out and the other view's fades in, crossing at halfway
          return { ...own, points: bl ? bl.rows : own.points, clipX: bl ? bl.clip : null, ciClip: bl ? bl.clips.ci : null, endLabelOpacity: Math.abs(1 - 2 * t) };
        }
        return { ...(a[id] || b[id]), wipe: a[id] ? t : 1 - t, endLabelOpacity: a[id] ? 1 - t : t };
      });
      cross = window.AP.crossClouds(A.dots, B.dots, t, (d) => d.meta.pollster + "|" + d.meta.released + "|" + d.who);
      dom = window.AP.blendDomain(A.domain, B.domain, t);
    }
    const A0 = m ? ppmModel(ppmSlot(m.from)) : null;
    return lchart(key, B.title, {
      padSeries: ppmPadSeries, yDomain: dom, yTicks: B.yTicks, yTickFmt: B.yTickFmt, refLines: B.refLines,
      series, areas: bandsOf(series), notes: B.notes,
      morphFrom: A0 ? { yTicks: A0.yTicks, yTickFmt: A0.yTickFmt, refLines: A0.refLines, notes: A0.notes } : null, morphT: m ? m.t : 1,
      scatter: cross ? cross.scatter : B.dots, scatterOut: cross ? cross.scatterOut : [], scatterMove: cross ? cross.scatterMove : [],
      fade: m ? m.t : 1, pollFacet: "leadership", spine: B.spine, copy: B.copy,
      extraRows: (i) => ciRows(B.series, i, B.spine),
    });
  };
  // one persistent slot, so the chart morphs in place rather than remounting
  /* each chart element is kept while nothing it draws changes, so a switch
     in one panel does not rebuild the other panel's chart on every frame */
  const mainPpmChart = React.useMemo(() => ppmChart("rd-ppm", ppmSlot(ppmView), ppmMorph), [ppmView, ppmMorph, memoKey]);
  const threeChart = React.useMemo(() => ppmChart("rd-three", "three", null), [memoKey]);

  /* ---- net approval and favourability ------------------------------------ */
  const leaders = RD_LEAD_ORDER.map((id) => L[id]).filter(Boolean);
  /* J: an era is a holder - its key family, and the month's holder field
     that picks its months out of a shared family */
  const erasOf = J
    ? (Ld) => {
        const slot = SLOT[Ld.id], list = J.eras[slot], last = list.length - 1;
        return list.map((e, i) => ({ who: e.name, final: i === last,
          key: slot === "opp" ? (i === last ? "taylor" : "ley") : Ld.id,
          whoKey: slot === "opp" ? (i === last ? null : "ley_who") : Ld.id === "alb" ? "alb_who" : "hanson_who" }));
      }
    : (Ld) => (Ld.id === "taylor" ? ["ley", "taylor"] : [null]);
  const lineFor = (Ld, mt, era) => {
    const k = (J ? era.key : era || Ld.id) + "_" + mt;
    return pts.filter((d) => d[k] != null && (!J || !era.whoKey || d[era.whoKey] === era.who))
      .map((d) => ({ ym: d.ym, x: d.x, v: d[k], ci: d[k + "Ci"] != null ? d[k + "Ci"] : null }));
  };
  const cloudFor = (mt) => {
    const wantFav = mt === "fav";
    return D.individualPolls.filter((q) => q.appr && q.x >= xDomain[0] && q.x <= xDomain[1])
      .flatMap((q) => leaders.flatMap((Ld) => {
        const a = q.appr, out = [];
        const isFav = ((a.metricBy || {})[Ld.id] === "fav");
        if (a[Ld.id + "Net"] != null && isFav === wantFav) out.push(a[Ld.id + "Net"]);
        const alt = a.alt && a.alt[Ld.id];
        if (alt && alt.net != null && (alt.metric === "fav") === wantFav) out.push(alt.net);
        const lab = J ? holderAt(SLOT[Ld.id], q.released) || Ld.short : Ld.id === "taylor" ? (a.oppName || Ld.short) : Ld.short;
        return out.map((y) => ({ x: q.x, y, color: Ld.color, label: lab, meta: q, leader: Ld.id }));
      }));
  };
  const netChart = (mt, key) => {
    const m = key === "main" || key === "a" ? morph : null;
    const runs = (Ld) => erasOf(Ld).map((era) => {
      if (!m) return { era, rows: lineFor(Ld, mt, era), clip: null };
      const b = window.AP.blendRows(lineFor(Ld, m.from, era), lineFor(Ld, m.to, era), m.t, ["v", "ci"]);
      return b ? { era, rows: b.rows, clip: b.clip, ciClip: b.clips.ci } : { era, rows: lineFor(Ld, mt, era), clip: null };
    }).filter((d) => d.rows.length);
    const drawn = leaders.map((Ld) => ({ Ld, runs: runs(Ld) }));
    const series = drawn.flatMap(({ Ld, runs: rs }) => rs.map((d) => (J ? {
      id: Ld.id + "-" + d.era.who, label: d.era.who, color: Ld.color,
      points: d.rows.map((r) => ({ x: r.x, y: r.v })), rdWidth: 2.5, clipX: d.clip,
      endCap: d.era.final, endLabel: d.era.final ? d.era.who : null,
    } : {
      id: Ld.id + (d.era ? "-" + d.era : ""), label: d.era === "ley" ? "Ley" : Ld.short, color: Ld.color,
      points: d.rows.map((r) => ({ x: r.x, y: r.v })), rdWidth: 2.5, clipX: d.clip,
      endCap: d.era !== "ley", endLabel: d.era === "ley" ? null : Ld.short,
    })));
    const areas = drawn.flatMap(({ Ld, runs: rs }) => rs.map((d) => ({
      id: "ci-" + Ld.id + (J ? "-" + d.era.who : d.era ? "-" + d.era : ""), color: Ld.color, className: "ci-band", edge: false, clipX: d.ciClip || d.clip,
      points: d.ciClip
        ? d.rows.filter((r) => r.ciHi != null && r.ciLo != null).map((r) => ({ x: r.x, y0: r.ciLo, y1: r.ciHi }))
        : d.rows.filter((r) => r.ci != null).map((r) => ({ x: r.x, y0: r.v - r.ci, y1: r.v + r.ci })) }))).filter((a) => a.points.length >= 2);
    const cross = m ? window.AP.crossClouds(cloudFor(m.from), cloudFor(m.to), m.t, (d) => d.meta.pollster + "|" + d.meta.released + "|" + d.leader) : null;
    const valsFor = (mm) => leaders.flatMap((Ld) => erasOf(Ld).flatMap((era) => lineFor(Ld, mm, era)).flatMap((d) => d.ci != null ? [d.v - d.ci, d.v + d.ci] : [d.v]))
      .concat(cloudFor(mm).map((d) => d.y));
    const fitFor = (mm) => { const v = valsFor(mm); return fitDomain(v.length ? v : [-20, 20], 20, 0); };
    const tgt = fitFor(mt);
    const dom = m ? window.AP.blendDomain(fitFor(m.from).domain, tgt.domain, m.t) : tgt.domain;
    const leyRun = drawn.find((d) => d.Ld.id === "taylor");
    const ley = leyRun && leyRun.runs.find((r) => r.era === "ley");
    /* an earlier holder's line ends in a cap, named under its last point */
    const notes = J
      ? unclash(drawn.flatMap(({ Ld, runs: rs }) => rs.filter((d) => !d.era.final).map((d) => {
          const r = d.rows[d.rows.length - 1];
          return { x: r.x, y: r.v, dy: 18, text: d.era.who, anchor: "middle", color: inkOf(Ld.color), weight: 600 };
        })), (dom[1] - dom[0]) * 0.12)
      : ley && ley.rows.length ? [{ x: ley.rows[ley.rows.length - 1].x, y: ley.rows[ley.rows.length - 1].v, dy: 18, text: "Ley", anchor: "middle", color: inkOf(opp.color), weight: 600 }] : [];
    const spine = J
      ? spineOf(drawn.flatMap((d) => d.runs.map((r) => ({ points: r.rows.filter((x) => !x.mid) }))))
      : (drawn[0] && drawn[0].runs[0] ? drawn[0].runs[0].rows.filter((r) => !r.mid) : []);
    const title = (mt === "fav" ? "Favourability" : "Net approval") + ", month by month";
    /* the copy names the leaders: "Leaders’ net approval" left a reader of
       the image to work out whose lines these were from the end labels */
    const leaderNames = rdList(drawn.map((d) => d.Ld.short));
    const was = m ? fitFor(m.from).domain : null;
    /* keyed by its SLOT, not its metric: keyed by metric, an approval <->
       favourability switch remounted the chart - which fades in from blank -
       under the very morph that was meant to carry it across */
    return lchart("rd-appr-" + (key === "b" ? "b" : "main"), title, {
      yDomain: dom, yTicks: rdYTicks(tgt.domain[0], tgt.domain[1], 20),
      morphFrom: was ? { yTicks: rdYTicks(was[0], was[1], 20), refLines: [{ y: 0, color: "var(--ink-faint)" }], notes: [] } : null, morphT: m ? m.t : 1,
      yTickFmt: (v) => (v === 0 ? "Even" : v > 0 ? "+" + v : "−" + Math.abs(v)),
      refLines: [{ y: 0, color: "var(--ink-faint)" }], series, areas, notes,
      scatter: cross ? cross.scatter : cloudFor(mt), scatterOut: cross ? cross.scatterOut : [], scatterMove: cross ? cross.scatterMove : [],
      fade: m ? m.t : 1, pollFacet: "leadership", spine,
      /* read away from the panel: its name, its measure, and the key */
      copy: mt === "fav"
        ? { title: "Net favourability of " + leaderNames, sub: "Favourable minus unfavourable views of each leader as a person, month by month",
            legend: [], caption: keyDots + (J ? " Polls by " + jApprBy(true) + "." : " Polls by RedBridge, DemosAU, Freshwater and Spectre Strategy.") }
        : { title: "Net approval of " + leaderNames, sub: "Approve minus disapprove of the job each leader is doing, month by month",
            legend: [], caption: keyDots + (J ? " Polls by " + jApprBy(false) + "." : " Polls by Newspoll, YouGov, Resolve, Essential and others.") },
      extraRows: (i) => { const r = spine[i]; if (!r) return []; const cs = leaders.map((Ld) => { const row = pts.find((p) => p.ym === r.ym); const k = (Ld.id === "taylor" && row && row.taylor_net == null && row.ley_net != null ? "ley" : Ld.id) + "_" + mt + "Ci"; return row && row[k] != null ? "±" + row[k].toFixed(1) : null; }).filter(Boolean); return cs.length ? [{ label: "95% intervals", value: cs.join(", ") }] : []; },
    });
  };

  const apprChart = React.useMemo(() => netChart(metric === "fav" ? "fav" : "net", metric === "both" ? "a" : "main"), [metric, morph, memoKey]);
  const apprFavChart = React.useMemo(() => netChart("fav", "b"), [memoKey]);

  /* the dot plot: now, its 95% interval, and the change */
  const dotRows = (mt) => leaders.map((Ld) => ({ Ld, n: N[Ld.id + "_" + mt] })).filter((r) => r.n);
  const dotDom = [-40, 20];
  const dxp = (v) => ((Math.max(dotDom[0], Math.min(dotDom[1], v)) - dotDom[0]) / (dotDom[1] - dotDom[0])) * 100;
  /* The rows' tracks carry the Who-votes whiskers' rug: the window's polls
     as small dots along the leader's track, the rug's mechanics in DpRug.
     Membership mirrors leaderNow's own pools - approval of the majors on
     gen-data's HEADLINE window (21d), favourability and Hanson's thinner
     measures on SPARSE (42d), both anchored at the data's latest - and the
     metric routing is the chart cloud's (a poll that published both
     measures lends its second reading to the other track). A Both row
     marks its favourability dots open. */
  const poolItems = (Ld, mt, both) => {
    const wantFav = mt === "fav";
    const ref = Date.parse(D.latest.updatedISO);
    const win = wantFav || Ld.id === "hanson" || J ? 42 : 21;
    const lab = Ld.short + (both ? (wantFav ? " favourability" : " approval") : "");
    return D.individualPolls.flatMap((q) => {
      const a = q.appr;
      if (!a) return [];
      if (J && q.released < sinceOf(SLOT[Ld.id])) return [];   // the holder's own polls, as leaderNow pools them
      const mid = q.fmid ? Date.parse(q.fmid) : Date.parse(q.released);
      const d = (ref - mid) / 86400000;
      if (d < 0 || d > win) return [];
      const out = [];
      const isFav = ((a.metricBy || {})[Ld.id] === "fav");
      const fav = both && wantFav;
      if (a[Ld.id + "Net"] != null && isFav === wantFav) out.push({ q, y: a[Ld.id + "Net"], fav, label: lab });
      const alt = a.alt && a.alt[Ld.id];
      if (alt && alt.net != null && (alt.metric === "fav") === wantFav) out.push({ q, y: alt.net, fav, label: lab });
      return out;
    });
  };
  const dotPlot = (mode) => {
    const rowsA = dotRows("net"), rowsF = dotRows("fav");
    const both = mode === "both";
    const list = both ? leaders.map((Ld) => ({ Ld, a: N[Ld.id + "_net"], f: N[Ld.id + "_fav"] })) : (mode === "fav" ? rowsF : rowsA).map((r) => ({ Ld: r.Ld, a: r.n }));
    if (J && !list.length) return null;   // the note under it says why (apprNote)
    return (
      <div className={"rd-dp" + (both ? " both" : "")} role="table" aria-label={both ? "Net approval and favourability now" : (mode === "fav" ? "Net favourability now" : "Net approval now") + ", with 95% intervals and change"}>
        <div className="rd-dp-head" role="row">
          <span></span>
          <span className="rd-dp-axis" aria-hidden="true"><span style={{ left: dxp(0) + "%" }}>Even</span></span>
          <span role="columnheader">{both ? "Approval" : "Now"}</span>
          <span role="columnheader">{both ? "Favour." : "Change"}</span>
        </div>
        {list.map(({ Ld, a, f }) => {
          /* the rug's dots are buttons now, so aria-hidden moves off the
             track onto its purely visual siblings, as the Who-votes rows */
          const items = both ? poolItems(Ld, "net", true).concat(poolItems(Ld, "fav", true)) : poolItems(Ld, mode, false);
          return (
          <div key={Ld.id} className="rd-dp-row" role="row">
            <span role="cell" className="rd-dp-name"><span className="rd-dp-sw" style={{ background: Ld.color }}></span>{Ld.short}</span>
            <span className="rd-dp-track">
              <span className="rd-dp-zero" aria-hidden="true" style={{ left: dxp(0) + "%" }}></span>
              {items.length > 0 && <DpRug items={items} color={Ld.color} dxp={dxp} fmt={signed} />}
              {!both && a && <span className="rd-dp-ci" aria-hidden="true" style={{ left: dxp(a.v - a.ci95) + "%", width: dxp(a.v + a.ci95) - dxp(a.v - a.ci95) + "%", background: Ld.color }}></span>}
              {both && a && f && <span className="rd-dp-link" aria-hidden="true" style={{ left: Math.min(dxp(a.v), dxp(f.v)) + "%", width: Math.abs(dxp(a.v) - dxp(f.v)) + "%", background: Ld.color }}></span>}
              {a && <span className="rd-dp-dot" aria-hidden="true" style={{ left: dxp(a.v) + "%", background: Ld.color }}></span>}
              {both && f && <span className="rd-dp-dot open" aria-hidden="true" style={{ left: dxp(f.v) + "%", borderColor: Ld.color }}></span>}
            </span>
            <span role="cell" className="rd-dp-now">{a ? <RollNum value={signed(a.v)} /> : "—"}</span>
            <span role="cell" className={"rd-dp-chg" + (!both && a && a.changeSig ? " sig" : "")}>
              {both ? (f ? <RollNum value={signed(f.v)} /> : "—")
                : a && a.chg != null ? <>{Math.abs(a.chg) < 0.05 ? "→" : rdArrow(a.chg)} <RollNum value={Math.abs(a.chg) < 0.05 ? "0.0" : Math.abs(a.chg).toFixed(1)} /></> : ""}</span>
          </div>
        );
        })}
        <div className="rd-dp-foot" aria-hidden="true">
          <span></span>
          <span className="rd-dp-axis">{[-40, -20, 0, 20].map((v) => <span key={v} style={{ left: dxp(v) + "%" }}>{v === 0 ? "0" : v > 0 ? "+" + v : "−" + Math.abs(v)}</span>)}</span>
          <span></span><span></span>
        </div>
      </div>
    );
  };
  const apprNote = (() => {
    if (metric === "both") {
      const d = leaders.map((Ld) => ({ Ld, a: get(Ld.id + "_net"), f: get(Ld.id + "_fav") })).filter((x) => x.a != null && x.f != null);
      const worseJob = d.filter((x) => x.a < x.f - 3), betterJob = d.filter((x) => x.a > x.f + 3);
      const bits = [];
      if (J) {
        const rate = (xs, how) => xs.map((x) => x.Ld.short).join(" and ") + (xs.length > 1 ? " rate " : " rates ") + how + " on the job than as " + (xs.length > 1 ? "people" : "a person");
        if (worseJob.length) bits.push(rate(worseJob, "worse"));
        if (betterJob.length) bits.push(rate(betterJob, "better"));
      } else {
      if (worseJob.length) bits.push("Voters rate " + worseJob.map((x) => x.Ld.short).join(" and ") + "’s job worse than they rate " + (worseJob.length > 1 ? "them" : "him"));
      if (betterJob.length) bits.push((bits.length ? "" : "Voters rate ") + betterJob.map((x) => x.Ld.short).join(" and ") + (bits.length ? " the reverse" : "’s job better than they rate " + (betterJob.length > 1 ? "them" : "her")));
      }
      return (bits.length ? bits.join(", and ") + ". " : "") + "Different pollsters ask each question, so part of each gap reflects who asked.";
    }
    const mt = metric;
    const rows = leaders.map((Ld) => ({ Ld, n: N[Ld.id + "_" + mt] })).filter((r) => r.n);
    if (J && !rows.length) {
      /* /vic/: a measure no pollster asked in the window, said plainly */
      const wantFav = mt === "fav";
      const asked = D.individualPolls.filter((q) => q.appr && ["alb", "taylor", "hanson"].some((k) => q.appr[k + "Net"] != null && ((q.appr.metricBy || {})[k] === "fav") === wantFav));
      const last = asked[asked.length - 1];
      return "No pollster has asked about " + (wantFav ? "favourability" : "job approval") + " in the last six weeks"
        + (last ? "; the latest reading is " + last.pollster + "’s, from " + rdDate(last.released, true) + "." : ".");
    }
    const sig = rows.filter((r) => r.n.changeSig);
    let s = "Bars are 95% intervals. ";
    s += !sig.length ? "None of the changes is significant." : sig.length === 1
      ? "Only " + sig[0].Ld.short + "’s " + (sig[0].n.chg < 0 ? "fall" : "rise") + " is statistically significant"
      : sig.map((r) => r.Ld.short).join(" and ") + "’s changes are statistically significant";
    const even = rows.filter((r) => Math.abs(r.n.v) <= r.n.ci95);
    if (sig.length) s += even.length ? ", and " + even.map((r) => r.Ld.short).join(" and ") + "’s range still includes even." : ".";
    else if (even.length) s += " " + even.map((r) => r.Ld.short).join(" and ") + "’s range includes even.";
    if (mt === "fav") {
      const cmp = leaders.map((Ld) => ({ Ld, a: get(Ld.id + "_net"), f: get(Ld.id + "_fav") })).filter((x) => x.a != null && x.f != null);
      const worse = cmp.filter((x) => x.f < x.a - 3).map((x) => x.Ld.short), better = cmp.filter((x) => x.f > x.a + 3).map((x) => x.Ld.short);
      if (worse.length || better.length)
        s += " " + [worse.length ? worse.join(" and ") + " rates worse here than on job approval" : null,
                    better.length ? (worse.length ? "" : "") + better.join(" and ") + " better" : null].filter(Boolean).join(" and ")
          + ", though different pollsters ask each question.";
    }
    return s;
  })();

  const panel = (id, head, dek, tabs, body) => (
    <div className={"rd-ld-panel" + (expanded && expanded !== id ? " rd-hidden" : "")}
         ref={id === "ppm" ? ppmEl : apprEl}>
      <RdSub head={head} dek={dek} />
      {tabs}
      {body}
    </div>
  );
  const expandBtn = (id, label) => (
    <button type="button" className="rd-iconbtn" onClick={() => setExpanded(expanded === id ? null : id)}
            aria-label={(expanded === id ? "Show both panels" : "Expand " + label)} title={expanded === id ? "Show both panels" : "Expand"}>
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d={expanded === id
        ? "M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3"
        : "M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"} /></svg>
    </button>
  );

  /* Walking Approval / Favourability / Both rewrites the panel's head and
     dek above the row; rdPinScroll (rd.jsx) holds the row's spot while the
     words land. */
  const pinLd = () => {
    const sec = document.getElementById("leadership");
    const p = sec && sec.querySelectorAll(".rd-ld-panel")[1];
    rdPinScroll(p && p.querySelector("[aria-label='Leader rating']"));
  };
  const pickMetric = (v) => { pinLd(); if (v === "both" || own === "both") setOwn(v); else chooseMetric(v); };

  /* Pointing at a panel makes ITS row the arrow-key target without moving
     DOM focus - the phone swipe's nearest-row claim for a computer, so
     over the preferred-PM panel <-> walks the questions, over the ratings
     panel the ratings. The pickers run as the row's own walk runs them
     (the bars morph, the row pins), a focused control still wins, and
     leaving the panel hands the page turn back. */
  const ppmEl = React.useRef(null), apprEl = React.useRef(null);
  const ldHover = React.useRef(null);
  React.useEffect(() => {
    const lists = { ppm: ["two", "three", "both"], appr: ["net", "fav", "both"] };
    const offs = [["ppm", ppmEl], ["appr", apprEl]].map(([id, ref]) => {
      const sec = ref.current;
      if (!sec) return undefined;
      const enter = () => { ldHover.current = id; };
      const leave = () => { if (ldHover.current === id) ldHover.current = null; };
      if (sec.matches(":hover")) ldHover.current = id;
      sec.addEventListener("pointerenter", enter);
      sec.addEventListener("pointerleave", leave);
      return () => {
        sec.removeEventListener("pointerenter", enter);
        sec.removeEventListener("pointerleave", leave);
      };
    });
    const key = (e) => {
      const id = ldHover.current;
      if (!id || (e.key !== "ArrowRight" && e.key !== "ArrowLeft")) return;
      const el = (id === "ppm" ? ppmEl : apprEl).current;
      const live = el && el.isConnected && el.getClientRects().length > 0;
      if (!live) { ldHover.current = null; return; }
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const a = document.activeElement;
      if (a && a.tagName !== "BODY" && a.tagName !== "HTML") return;
      const sel = window.getSelection && window.getSelection();
      if (sel && !sel.isCollapsed) return;
      const list = lists[id];
      const i = list.indexOf(id === "ppm" ? ppmView : metric);
      if (i < 0) return;
      e.preventDefault();
      (id === "ppm" ? ppmPick : pickMetric)(list[(i + (e.key === "ArrowRight" ? 1 : -1) + list.length) % list.length]);
    };
    document.addEventListener("keydown", key, true);
    return () => {
      offs.forEach((off) => off && off());
      document.removeEventListener("keydown", key, true);
    };
  }, [ppmView, metric]);

  return (
    <RdSec id="leadership" cls="rd-lead" title="Leadership" meta={J ? "Preferred " + J.office.alb + " and net approval, " + jHouses((q) => !!(q.ppm || q.ppmSets || (q.appr && (q.appr.albNet != null || q.appr.taylorNet != null)))) : "Preferred PM and net approval, Newspoll, YouGov, Resolve, Essential and others"}>
      {story && <RdHed head={story.head} dek={story.dek} />}
      {/* "free" frees the panels from the shared desktop row grid: a "Both"
          view gives its panel extra children (a second chart, the dot-plot
          key), so the two panels' rows no longer pair up - the other panel's
          keys and notes would get parked against this panel's tall chart
          rows, centre themselves in the stretched track and hang in space
          above or below their own charts. Not shared, each panel stacks. */}
      <div className={"rd-ld-grid" + (expanded ? " one" : ppmView === "both" || metric === "both" ? " free" : "")}>
        {panel("ppm", J ? "Preferred " + J.office.alb : "Preferred prime minister", J ? "“Who would make the better " + J.office.alb + "?” Asked head to head, and three-way where pollsters offer it." : "“Who would make the better PM?” Asked head to head, and three-way where pollsters offer it.",
          <RdTabs swipe value={ppmView} onChange={ppmPick} ariaLabel={J ? "Preferred " + J.office.alb + " question" : "Preferred prime minister question"}
                  options={[{ id: "two", label: "Two-way" }, { id: "three", label: "Three-way" }, { id: "both", label: "Both" }]}>
            {!narrow && expandBtn("ppm", J ? "preferred " + J.office.alb : "preferred prime minister")}
          </RdTabs>,
          <>
            {/* two bars or one, a note a line longer or shorter: each glides
                to its height (RdGlide), so the chart under it slides. One
                wrapper per row of the panel's subgrid, which lines the two
                panels' rows up; the chart cards stay unwrapped, since their
                spacing reads the key that follows them. */}
            <RdGlide watch={ppmView} className="rd-ld-bars-g">
              <div className="rd-hbs" ref={hbsRef}>
                {ppmView !== "three" && two && headBar(two)}
                {ppmView !== "three" && twoH && headBar(twoH)}
                {ppmView !== "two" && threeBar}
              </div>
            </RdGlide>
            {ppmNote && <RdGlide watch={ppmNote} className={"rd-ld-note-g" + (ppmView === "three" ? " rd-ld-noteup" : "")}><p className="rd-note rd-ld-note">{ppmNote}</p></RdGlide>}
            {mainPpmChart}
            {ppmView === "both" && threeChart}
            <RdKey className="rd-ckey" items={[]}>
              <span className="rd-ld-keytxt">{keyDots + " " + (ppmView === "three" ? keyThree
                : ppmView === "two" ? keyLead + ", which lets one chart carry both head-to-head contests."
                : keyLead + "; three-way figures are shares of all respondents.")}</span>
            </RdKey>
          </>)}
        {panel("appr", metric === "both" ? "Approval and favourability" : metric === "fav" ? "Net favourability" : "Net approval",
          metric === "both" ? "Net ratings of the job each leader is doing, and of each leader as a person."
            : metric === "fav" ? "Favourable minus unfavourable views of each leader as a person. " + (J ? jApprBy(true) + "." : "RedBridge, DemosAU, Freshwater and Spectre Strategy.")
            : "Approve minus disapprove of the job each leader is doing. " + (J ? jApprBy(false) + "." : "Newspoll, YouGov, Resolve, Essential and others."),
          <RdTabs swipe value={metric} onChange={pickMetric} ariaLabel="Leader rating"
                  options={[{ id: "net", label: "Approval" }, { id: "fav", label: "Favourability" }, { id: "both", label: "Both" }]}>
            {!narrow && expandBtn("appr", "leader ratings")}
          </RdTabs>,
          <>
            <RdGlide watch={metric} className="rd-ld-dp-g">{dotPlot(metric)}</RdGlide>
            {metric === "both" && <RdKey className="rd-dp-key" items={[{ kind: "dot-solid", color: "var(--ink-3)", label: "Approval: the job they’re doing" }, { kind: "dot-open", color: "var(--ink-3)", label: "Favourability: views of them as a person" }]} />}
            <RdGlide watch={apprNote} className="rd-ld-note-g"><p className="rd-note rd-ld-note">{apprNote}</p></RdGlide>
            {apprChart}
            {metric === "both" && apprFavChart}
            <RdKey className="rd-ckey" items={[
              { kind: "dot", color: "var(--ink-3)", label: "One poll" },
              { kind: "lineband", color: "var(--ink-3)", label: "Monthly average and its 95% interval" },
            ]} />
          </>)}
      </div>
      <RdFoot how={{ term: "leadership", from: "Leadership" }}>
        {J ? "Every figure pools the last six weeks of polls, counting only those since the leader took the job. Changes are on a month ago; ▼ in bold marks a significant change."
          : "Albanese’s and Taylor’s approval pool the last three weeks of polls; the other figures, the last six. Changes are on a month ago; ▼ in bold marks a significant change."}
      </RdFoot>
    </RdSec>
  );
}

/* ======================================================================
   National direction
   ====================================================================== */
/* a count of points as a reader rounds it: "more than 30", "about 10" */
function rdRoughPts(v) {
  const a = Math.abs(v);
  if (a < 12) return String(Math.round(a));
  const tens = Math.floor(a / 10) * 10;
  return a - tens >= 2 ? "more than " + tens : "about " + tens;
}
function RdDirection({ rangeId }) {
  const { D, rangeDomain, filterPts, series, monthLabelFull } = window.AP;
  const narrow = useNarrow(MQ_PHONE);
  if (!D.direction.length) return null;
  const xDomain = rangeDomain(rangeId);
  const pts = filterPts(D.direction, xDomain[0]);
  const now = D.directionNow || D.direction[D.direction.length - 1];
  const M = D.direction;
  const wrongLeads = now.wrong >= now.right;
  const big = wrongLeads ? now.wrong : now.right, small = wrongLeads ? now.right : now.wrong;
  const most = wrongLeads ? now.wrong >= Math.max(...M.map((d) => d.wrong)) - 0.05 : now.right >= Math.max(...M.map((d) => d.right)) - 0.05;
  const head = plainShare(big) + " say Australia is " + (wrongLeads ? "on the wrong track" : "heading in the right direction")
    + (most ? ", the most this term" : "");
  const first = M[0];
  const sinceFirst = now.net - first.net;
  const netVerb = (n, up) => n >= 10 ? (up ? "soared" : "plummeted") : n >= 6 ? (up ? "lifted" : "soured") : (up ? "lifted slightly" : "soured slightly");
  const netWord = (d) => (d > 0 ? "improved" : "worsened");
  const upDown = (d) => (d > 0 ? "up " : "down ");
  const dek = (small < 30 ? "Only " : "") + Math.round(small) + "% say we’re " + (wrongLeads ? "heading in the right direction" : "on the wrong track") + ". "
    + (now.chg == null ? ""
      : now.changeSig ? "Net mood has " + netVerb(Math.round(Math.abs(now.chg)), now.chg > 0) + ", " + upDown(now.chg) + Math.round(Math.abs(now.chg)) + " points in a month"
      : "Net mood has held steady for a month")
    + (Math.abs(sinceFirst) >= 5 ? (now.chg == null
      ? "Net mood has " + netWord(sinceFirst) + ", " + upDown(sinceFirst) + rdRoughPts(sinceFirst) + " points since May 2025."
      : now.changeSig
        ? (Math.sign(sinceFirst) === Math.sign(now.chg) ? " and " : " but " + upDown(sinceFirst)) + rdRoughPts(sinceFirst) + " points since May 2025."
        : ", though it is " + upDown(sinceFirst) + rdRoughPts(sinceFirst) + " points since May 2025.") : ".");
  const signedP = (v) => (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(1);

  const dots = (D.directionPolls || []).filter((d) => d.x >= xDomain[0] && d.x <= xDomain[1]).flatMap((d) => [
    { x: d.x, y: d.right, color: "var(--mood-pos)", label: "Right direction", meta: d },
    { x: d.x, y: d.wrong, color: "var(--mood-neg)", label: "Wrong track", meta: d },
  ]);
  const band = (k, ck) => pts.filter((d) => d[ck] != null).map((d) => ({ x: d.x, y0: d[k] - d[ck], y1: d[k] + d[ck] }));
  const areas = [
    { id: "ci-right", color: "var(--mood-pos)", className: "ci-band", edge: false, points: band("right", "rightCi") },
    { id: "ci-wrong", color: "var(--mood-neg)", className: "ci-band", edge: false, points: band("wrong", "wrongCi") },
  ].filter((a) => a.points.length >= 2);
  const vals = pts.flatMap((p) => [p.right, p.wrong]).concat(dots.map((d) => d.y)).concat(areas.flatMap((a) => a.points.flatMap((d) => [d.y0, d.y1])));
  const lo = Math.floor((Math.min(...vals) + 0.6) / 10) * 10, hi = Math.ceil((Math.max(...vals) - 0.6) / 10) * 10;
  /* the gap drawn where it now stands, against the month before Bondi */
  const bondi = (D.events || []).find((e) => e.date === "2025-12-14");
  const last = pts[pts.length - 1];
  const base = bondi ? M.find((d) => d.ym === bondi.date.slice(0, 7)) : null;
  const gapNow = last ? Math.abs(last.wrong - last.right) : null;
  /* the gap is named where it is drawn, on a phone too, as the canvas did:
     three short lines beside the bracket rather than a note under the chart */
  const brackets = !last ? [] : !narrow ? [{ x: last.x, y0: last.wrong, y1: last.right, lines: [
    gapNow.toFixed(1) + " points apart in " + D.monthNameFull(Number(last.ym.slice(5))),
    base ? "up from " + Math.abs(base.wrong - base.right).toFixed(1) + " in " + D.monthNameFull(Number(base.ym.slice(5))) + ", before Bondi" : null,
  ].filter(Boolean) }] : [{ x: last.x, y0: last.wrong, y1: last.right, dx: 4, lines: [
    gapNow.toFixed(1) + " points apart", "in " + D.monthNameFull(Number(last.ym.slice(5))) + (base ? ";" : ""),
    base ? Math.abs(base.wrong - base.right).toFixed(1) + " before Bondi" : null,
  ].filter(Boolean) }];
  const evs = bondi ? [bondi] : [];
  const badges = narrow ? rdEventBadges("dir", evs, xDomain[0], xDomain[1]) : null;
  /* who supplies the readings, and how many, lives in Info's National
     direction entry; the foot keeps only the note about the figures above */
  const monthNow = last ? D.monthNameFull(Number(last.ym.slice(5))) : "";
  const foot = last ? "The headline figures pool the latest polls, so they can differ a little from " + monthNow + "’s monthly average." : null;
  const asked = rdList(D.directionHouses || []);
  const question = "‘Is the country heading in the right direction, or on the wrong track?’";
  return (
    <RdSec id="direction" cls="rd-dir" title="National direction" meta={narrow ? question : question + (asked ? ", " + asked : "")}>
      <RdHed head={head} dek={dek} />
      <div className="rd-dir-figs">
        <div className="rd-dir-fig"><span className="rd-dir-v" style={{ color: "var(--mood-pos)" }}>{now.right.toFixed(1)}<span className="rd-dir-pct">%</span></span>
          <span className="rd-dir-k" style={{ color: "var(--mood-pos)" }}>Right direction</span></div>
        <div className="rd-dir-fig rd-r"><span className="rd-dir-v" style={{ color: "var(--mood-neg)" }}>{now.wrong.toFixed(1)}<span className="rd-dir-pct">%</span></span>
          <span className="rd-dir-k" style={{ color: "var(--mood-neg)" }}>Wrong track</span></div>
      </div>
      <div className="rd-dir-bar" role="img" aria-label={`Right direction ${now.right}%, unsure ${now.unsure}%, wrong track ${now.wrong}%`}>
        <span className="rd-dir-pos" style={{ flexBasis: now.right + "%" }}></span>
        <span className="rd-dir-uns" style={{ flexBasis: now.unsure + "%" }}><span>{now.unsure.toFixed(1)}% unsure</span></span>
        <span className="rd-dir-neg" style={{ flexBasis: now.wrong + "%" }}></span>
      </div>
      <p className="rd-dir-net"><b>Net {signedP(now.net)} points</b>
        {now.chg != null && <>, {rdArrow(now.chg)} {Math.abs(now.chg).toFixed(1)} on a month ago{now.changeSig === false ? ", within the margin" : ""}</>}</p>
      <div className="card rd-card rd-dir-chart">
        <div className="rd-chead"><span className="rd-chead-t">{narrow ? "Right direction and wrong track, %" : "Right direction and wrong track, % of voters, month by month"}</span></div>
        {narrow && <RdKey items={[{ kind: "line", color: "var(--mood-neg)", label: "Wrong track" }, { kind: "line", color: "var(--mood-pos)", label: "Right direction" }]} className="rd-tpp-legend" />}
        <TrendChart key="rd-dir" heightPx={narrow ? 280 : 360}
          padPx={narrow ? { l: 34, r: 8, t: 30, b: 28 } : { l: 40, r: 16, t: 40, b: 30 }}
          xDomain={xDomain} yDomain={[lo, hi]} yTicks={rdYTicks(lo, hi, 10)} yTickFmt={(v) => (v === hi ? v + "%" : String(v))}
          /* the axis opens on the election tick, as the 2PP, primary and
             mood charts do - 2025 + 122/365 is 3 May 2025 on gen-data's dx
             counting (rdXTicks's month grid would open at July, May falling
             between its quarter steps) */
          xTicks={rdElectionTicks(xDomain[0], xDomain[1], narrow, 2025 + 122 / 365)} baseline
          series={[
            { id: "wrong", label: "Wrong track", color: "var(--mood-neg)", points: series(pts, "wrong"), rdWidth: 2.5, endCap: false, endLabel: narrow ? null : "Wrong track" },
            { id: "right", label: "Right direction", color: "var(--mood-pos)", points: series(pts, "right"), rdWidth: 2.5, endCap: false, endLabel: narrow ? null : "Right direction" },
          ]}
          spine={series(pts, "right")} areas={areas} scatter={dots} pollFacet="direction"
          events={badges ? badges.events : evs} brackets={brackets}
          tooltipTitle={(i) => (pts[i] ? monthLabelFull(pts[i].ym) : "")}
          extraRows={(i) => { const d = pts[i]; return d && d.rightCi != null ? [{ label: "95% intervals", value: "±" + d.rightCi.toFixed(1) + ", ±" + d.wrongCi.toFixed(1) }] : []; }}
          fmt={(v) => v.toFixed(1)}
          copy={{ title: "Is Australia heading in the right direction?", sub: head + ". Monthly averages, adjusted for each pollster’s lean, of every poll asking whether the country is heading in the right direction or on the wrong track.",
                  caption: "Each dot is one poll; lines are monthly averages, shaded bands their 95% intervals." + (asked ? " Polls by " + asked + "." : ""), legend: [{ label: "Right direction", color: "var(--mood-pos)", kind: "line" }, { label: "Wrong track", color: "var(--mood-neg)", kind: "line" }] }}
        />
        {badges && <RdEventList list={badges.list} />}
        <RdKey className="rd-ckey" items={[
          { kind: "dot", color: "var(--ink-3)", label: "One poll" },
          { kind: "lineband", color: "var(--ink-3)", label: "Monthly average, adjusted for each pollster’s lean, and its 95% interval" },
        ]} />
      </div>
      <HowTo paras={[
        <>Each dot is one published reading; the lines are monthly averages, shaded with their 95% intervals.</>,
        <>The lines are adjusted for each pollster’s lean. Only {(D.directionHouses || []).length} pollsters ask this question, so some months rest on a single poll: the dots show which, and the shading shows what that costs in confidence.</>,
      ]} />
      <RdFoot how={{ term: "direction", from: "National direction" }}>{foot}</RdFoot>
    </RdSec>
  );
}
function rdList(arr) {
  if (!arr.length) return "";
  if (arr.length === 1) return arr[0];
  return arr.slice(0, -1).join(", ") + " and " + arr[arr.length - 1];
}

/* ======================================================================
   Who votes for whom
   ====================================================================== */
const RD_DEMO_SHORT = {
  "18–34": "18–34s", "35–54": "35–54s", "55+": "over-55s", "Gen Z": "Gen Z", Millennials: "Millennials",
  "Gen X": "Gen X", Boomers: "Boomers", Men: "men", Women: "women",
  "Year 12 or less": "voters with Year 12 or less", "TAFE or trade": "TAFE- or trade-qualified voters", University: "university graduates",
  NSW: "NSW voters", Vic: "Victorians", Qld: "Queenslanders", SA: "South Australians", WA: "West Australians", "Non-NSW/Vic/Qld": "voters in the non-eastern-mainland states",
  "Inner metro": "inner-suburban voters", "Outer metro": "outer-suburban voters", Provincial: "provincial voters", Rural: "rural voters",
  "Own outright": "outright owners", Mortgage: "mortgage holders", Renting: "renters",
  "English only": "English-only speakers", "Other language": "voters who speak another language at home",
};
/* one constant headline per switcher party, hand-curated against the pooled
   significances — every trait listed is a significant gap in the current
   pool, so refresh these by hand when the pool moves, as with RD_DEMO_SHORT */
const RD_DEMO_HOME = {
  onp: "One Nation voters are more likely to be 55+, TAFE- or trade-qualified, and rural; less likely to live in Victoria or speak a language other than English at home",
  alp: "Labor voters are more likely to be under 55, university-educated, and inner-metro; less likely to be rural or live in the eastern mainland states, especially Queensland",
  lnp: "Coalition voters are more likely to be 55+, university-educated, inner-metro, Victorian, and outright homeowners; less likely to live in an outer metro",
  grn: "Greens voters are more likely to be Gen Z, women, and renting; less likely to be rural or TAFE- or trade-qualified",
  oth: "Voters for others & independents are more likely to be Gen Z and renting; less likely to live in provincial areas",
};
/* the usual (Pew) birth years behind the polls' generation labels: neither
   pollster publishes its own, so the "By generation" dot-plot labels bracket
   each row as ages derived from these. The Info glossary's "Generations"
   entry (d1a1d215 asset) lists the same ranges - the two copies move together */
const RD_GEN_BORN = { "Gen Z": [1997, 2012], Millennials: [1981, 1996], "Gen X": [1965, 1980], Boomers: [1946, 1964] };
/* a label's bracket reads as today's ages; a hover on a mouse pointer or a
   tap shows the birth years instead. Ages are floored at voting age, since
   the panel reports voters (Gen Z's young end sits under 18 this decade;
   the floor lifts itself once 2012 comes of age) */
function RdGenBorn({ label }) {
  const born = RD_GEN_BORN[label];
  const [hover, setHover] = useState(false);
  const [tapped, setTapped] = useState(false);
  if (!born) return null;
  const y = new Date().getFullYear();
  const asYears = hover || tapped;
  return (
    <button type="button" className={"rd-wv-born" + (asYears ? " on" : "")}
            aria-pressed={asYears}
            aria-label={label + ", aged " + Math.max(18, y - born[1]) + " to " + (y - born[0]) + ", shows the birth years"}
            onPointerEnter={(e) => { if (e.pointerType === "mouse") setHover(true); }}
            onPointerLeave={(e) => { if (e.pointerType === "mouse") setHover(false); }}
            onClick={() => setTapped((v) => !v)}>
      ({asYears ? born[0] + "–" + born[1] : "aged " + Math.max(18, y - born[1]) + "–" + (y - born[0])})
    </button>
  );
}
/* a rug row's dots behave as a chart's do, in the chart's exact look. The
   tooltip IS the chart's dot readout: the shared .tip card under tip-dot's
   own transform (-50%, calc(-100% - 14px)) hung from the dot's centre, with
   the same content map - firm as the title, a swatch row of party colour +
   name + reading, a Field row, the sample as "n ≈ …" (the rug's is a group
   approximation, not the chart's whole-poll n), and the charts' own
   "… in All polls" hint. The hovered dot dresses in the Interaction board's
   ring: the disc (an <i> inside the fixed anchor, so the tip never grows
   with it) doubles over a 2px halo of the page ground, inside a 1.5px ring
   of its own party colour, and the row's other dots step back a fold. A
   mouse click or Enter then opens the poll; a tap only tips it - a tap is
   the only way to read a dot on a touch screen, so it can't also be the
   trip. One instance per row so its tip is the only one open on that row,
   and the tip rides inside its dot so a party switch glides the two
   together. */
function WvRug({ g, party, xp, pColor, pName, allXp, split }) {
  const [tip, setTip] = useState(null);
  const tipBox = React.useRef(null);
  const ptr = React.useRef(null);
  /* the rug's corridor doubled, and the dots ride its lower half; a dot
     whose disc would touch its left neighbour's steps up into the added
     half (its --v), recomputed per party switch and resize from the real
     track width - dots are sized in px but placed in cqw, so only the
     rendered strip says how far apart two readings actually sit. The same
     pass flags any dot the all-voters dash crosses (b.ring): it alone picks
     up the figure marks' 2px page-ground halo so the dash stops at it as
     it does the whisker ticks, while dots clear of the dash stay ringless
     and keep their cloud blend */
  const rugBox = React.useRef(null);
  const [ups, setUps] = useState(null);
  const [rings, setRings] = useState(null);
  React.useLayoutEffect(() => {
    const el = rugBox.current;
    if (!el) return;
    const compute = () => {
      const b = el.querySelector("b");
      const w = el.clientWidth;
      if (!b || !w) return;
      const gap = (b.offsetWidth / w) * 100;
      const last = [-Infinity, -Infinity];
      const next = new Array(g.px[party].length).fill(0);
      g.px[party].map((x, i) => ({ i, p: xp(x) })).sort((a, c) => a.p - c.p).forEach(({ i, p }) => {
        let l;
        if (p - last[0] >= gap) l = 0;
        else if (p - last[1] >= gap) l = 1;
        else l = last[0] <= last[1] ? 0 : 1;
        last[l] = p;
        next[i] = l;
      });
      setUps((prev) => (prev && prev.length === next.length && next.every((v, k) => v === prev[k]) ? prev : next));
      const ringPx = b.offsetWidth / 2 + 2.75;
      const nextRing = g.px[party].map((x) => Math.abs(xp(x) - allXp) * (w / 100) <= ringPx);
      setRings((prev) => (prev && prev.length === nextRing.length && nextRing.every((v, k) => v === prev[k]) ? prev : nextRing));
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [g, party, xp, allXp]);
  React.useLayoutEffect(() => {
    const el = tipBox.current;
    if (!el) return;
    el.style.marginLeft = "0px";
    const r = el.getBoundingClientRect();
    const off = Math.min(0, window.innerWidth - 8 - r.right) - Math.min(0, r.left - 8);
    if (off) el.style.marginLeft = off + "px";
  }, [tip]);
  const show = (i, src) => setTip({ i, src });
  const hide = (i, src) => setTip((tp) => (tp && tp.i === i && (!src || tp.src === src) ? null : tp));
  // a readout a finger raised stays up until the next tap lands outside its row
  window.useDismissOutside(rugBox, !!(tip && tip.src === "touch"), () => setTip(null));
  return (
    <span ref={rugBox} className={"rd-wv-rug" + (tip ? " lit" : "")}>
      {g.px[party].map((x, i) => {
        const d = g.pd[i] || null;
        if (!d) return <b key={i} className={rings && rings[i] ? "ring" : ""} style={{ "--x": xp(x), "--pcolor": pColor, "--v": ups ? ups[i] : 0 }}><i aria-hidden="true"></i></b>;
        const rk = d && d.r && window.AP && window.AP.pollRowKey ? window.AP.pollRowKey({ pollster: d.f, released: d.r }) : null;
        const open = () => {
          if (!rk || !(window.AP && window.AP.openPoll)) return;
          setTip(null);
          /* the poll's own vote by group, on the split of the tab the dot
             sits under (user call 2026-10-04: dots open the poll in the
             All-polls demographics facet) */
          window.AP.openPoll(rk, "demographics", "who votes for whom", split);
        };
        const lab = d.f + ", " + d.l + " · " + x.toFixed(1) + "% · n≈" + d.n;
        const on = tip && tip.i === i;
        return (
          <b key={i} className={[(rk ? "on" : ""), (on ? "hi" : ""), (rings && rings[i] ? "ring" : "")].filter(Boolean).join(" ") || undefined} style={{ "--x": xp(x), "--pcolor": pColor, "--v": ups ? ups[i] : 0 }}
             role={rk ? "button" : "img"} tabIndex={rk ? 0 : undefined}
             aria-label={lab + (rk ? ", press Enter to open this poll" : "")}
             onPointerDown={(ev) => { ptr.current = ev.pointerType; }}
             onPointerEnter={(ev) => { if (ev.pointerType === "mouse") show(i, "mouse"); }}
             onPointerLeave={(ev) => { if (ev.pointerType === "mouse") hide(i, "mouse"); }}
             onFocus={(ev) => { if (ev.target.matches(":focus-visible")) show(i, "focus"); }}
             onBlur={() => hide(i, "focus")}
             onClick={(ev) => {
               ev.stopPropagation();
               const pt = ev.detail === 0 ? "key" : ptr.current;
               ptr.current = null;
               if (pt === "mouse" || pt === "key") { open(); return; }
               if (tip && tip.i === i) setTip(null); else setTip({ i, src: "touch" });
             }}
             onKeyDown={(ev) => {
               if (ev.key !== "Enter" && ev.key !== " " && ev.key !== "Spacebar") return;
               ev.preventDefault();
               open();
             }}>
            <i aria-hidden="true"></i>
            {on && <span ref={tipBox} className="tip tip-dot rd-wv-rtip" aria-hidden="true">
              <span className="tip-title">{d.f}</span>
              <span className="tip-row"><span className="tip-swatch" style={{ background: pColor }}></span><span className="tip-label">{pName}</span><span className="tip-val">{x.toFixed(1) + "%"}</span></span>
              <span className="tip-row"><span className="tip-label">Field</span><span className="tip-val">{d.l}</span></span>
              <div className="tip-sub">{"n ≈ " + (+d.n).toLocaleString()}</div>
              {tip.src !== "touch" && <div className="tip-hint">{rk ? (tip.src === "focus" ? "Press Enter to open this poll in All polls" : "Click to open this poll in All polls") : "Released " + d.r}</div>}
            </span>}
          </b>
        );
      })}
    </span>
  );
}
/* The Who-votes rug carried across to the leader-rating rows: each poll the
   row's figure pools rides the track as a small dot at its own reading, with
   WvRug's every mechanic - the doubled corridor dodging into two lanes
   measured off the rendered strip, the chart's dot tip, the Interaction
   board's ring, click to open, a touch tap's readout dismissing on the next
   tap outside (9ccaf8b). Items arrive ready-built from the parent's pool
   walk: q the wave's individualPolls row, y its own reading, fav the
   Both-row favourability face (the open marker's), label the tip's swatch
   name. Fieldwork mid-day dates the membership - q.fmid, q.released where
   the wave was a single day; gen-data's midMs can fall at noon UTC on an
   odd-length span, a half-day reconstructible here only to the midnight, so
   a poll sat exactly on the window's edge can count or not by half a day. */
function DpRug({ items, color, dxp, fmt }) {
  const [tip, setTip] = useState(null);
  const tipBox = React.useRef(null);
  const ptr = React.useRef(null);
  const rugBox = React.useRef(null);
  const [ups, setUps] = useState(null);
  React.useLayoutEffect(() => {
    const el = rugBox.current;
    if (!el) return;
    const compute = () => {
      const b = el.querySelector("b");
      const w = el.clientWidth;
      if (!b || !w) return;
      const gap = (b.offsetWidth / w) * 100;
      const last = [-Infinity, -Infinity];
      const next = new Array(items.length).fill(0);
      items.map((d, i) => ({ i, p: dxp(d.y) })).sort((a, c) => a.p - c.p).forEach(({ i, p }) => {
        let l;
        if (p - last[0] >= gap) l = 0;
        else if (p - last[1] >= gap) l = 1;
        else l = last[0] <= last[1] ? 0 : 1;
        last[l] = p;
        next[i] = l;
      });
      setUps((prev) => (prev && prev.length === next.length && next.every((v, k) => v === prev[k]) ? prev : next));
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [items, dxp]);
  React.useLayoutEffect(() => {
    const el = tipBox.current;
    if (!el) return;
    el.style.marginLeft = "0px";
    const r = el.getBoundingClientRect();
    const off = Math.min(0, window.innerWidth - 8 - r.right) - Math.min(0, r.left - 8);
    if (off) el.style.marginLeft = off + "px";
  }, [tip]);
  const show = (i, src) => setTip({ i, src });
  const hide = (i, src) => setTip((tp) => (tp && tp.i === i && (!src || tp.src === src) ? null : tp));
  // a readout a finger raised stays up until the next tap lands outside its row
  window.useDismissOutside(rugBox, !!(tip && tip.src === "touch"), () => setTip(null));
  return (
    <span ref={rugBox} className={"rd-dp-rug" + (tip ? " lit" : "")}>
      {items.map((it, i) => {
        const q = it.q;
        const key = q.pollster + "|" + q.released + (it.fav ? "|f" : "");
        const rk = window.AP && window.AP.pollRowKey ? window.AP.pollRowKey({ pollster: q.pollster, released: q.released }) : null;
        const open = () => {
          if (!rk || !(window.AP && window.AP.openPoll)) return;
          setTip(null);
          window.AP.openPoll(rk, "leadership", "leadership");
        };
        const lab = q.pollster + ", " + (q.fieldPending ? "fieldwork TBC" : q.field) + " · " + fmt(it.y) + (q.sample != null ? " · n≈" + q.sample : "");
        const on = tip && tip.i === i;
        return (
          <b key={key} className={[(it.fav ? "open" : ""), (rk ? "on" : ""), (on ? "hi" : "")].filter(Boolean).join(" ") || undefined}
             style={{ "--x": dxp(it.y), "--pcolor": color, "--v": ups ? ups[i] : 0 }}
             role={rk ? "button" : "img"} tabIndex={rk ? 0 : undefined}
             aria-label={lab + (rk ? ", press Enter to open this poll" : "")}
             onPointerDown={(ev) => { ptr.current = ev.pointerType; }}
             onPointerEnter={(ev) => { if (ev.pointerType === "mouse") show(i, "mouse"); }}
             onPointerLeave={(ev) => { if (ev.pointerType === "mouse") hide(i, "mouse"); }}
             onFocus={(ev) => { if (ev.target.matches(":focus-visible")) show(i, "focus"); }}
             onBlur={() => hide(i, "focus")}
             onClick={(ev) => {
               ev.stopPropagation();
               const pt = ev.detail === 0 ? "key" : ptr.current;
               ptr.current = null;
               if (pt === "mouse" || pt === "key") { open(); return; }
               if (tip && tip.i === i) setTip(null); else setTip({ i, src: "touch" });
             }}
             onKeyDown={(ev) => {
               if (ev.key !== "Enter" && ev.key !== " " && ev.key !== "Spacebar") return;
               ev.preventDefault();
               open();
             }}>
            <i aria-hidden="true"></i>
            {on && <span ref={tipBox} className="tip tip-dot rd-dp-rtip" aria-hidden="true">
              <span className="tip-title">{q.pollster}</span>
              <span className="tip-row"><span className="tip-swatch" style={{ background: color }}></span><span className="tip-label">{it.label}</span><span className="tip-val">{fmt(it.y)}</span></span>
              <span className="tip-row"><span className="tip-label">Field</span><span className="tip-val">{q.fieldPending ? "TBC" : q.field}</span></span>
              {q.sample != null && <div className="tip-sub">{"n ≈ " + (+q.sample).toLocaleString()}</div>}
              {tip.src !== "touch" && <div className="tip-hint">{rk ? (tip.src === "focus" ? "Press Enter to open this poll in All polls" : "Click to open this poll in All polls") : "Released " + q.released}</div>}
            </span>}
          </b>
        );
      })}
    </span>
  );
}
/* the composition-trend block's wording slots (shapes are the user's, dictated
   2026-09-29 and re-dictated 2026-09-30; the SENTENCES are generated from
   D.demoTrend — gen-data §7gb — and re-word themselves as significances move,
   so only these phrase pieces are curated). Titles: "… is losing voters
   faster in …", "The composition of …'s vote is unchanged". Deks: "… shifted
   away from X (−x points …), and towards Y (+y points)", "… voter base has
   become more inner-metro" + "… has increased by +x points relative to the
   overall decrease, rising even as …", "It has also shifted away from /
   towards …" — a sole gender move as "Its relative position among men has
   shrunk" (no "also"). */
const RD_TREND_NAME = { onp: "One Nation", alp: "Labor", lnp: "The Coalition", grn: "the Greens", oth: "Others & independents" };
const RD_TREND_NAME_DEK = { onp: "One Nation", alp: "Labor", lnp: "the Coalition", grn: "the Greens", oth: "others & independents" };
const RD_TREND_BARE = { onp: "One Nation", alp: "Labor", lnp: "Coalition", grn: "Greens" };
const RD_TREND_SKEW = {
  onp: "Its older, regional skew is no stronger or weaker now than it was then.",
  grn: "Its younger, urban skew remains.",
};
const RD_TREND_STATE = { NSW: "NSW", Vic: "Victoria", Qld: "Queensland", SA: "South Australia", WA: "Western Australia", "Non-NSW/Vic/Qld": "the non-eastern-mainland states" };
const RD_TREND_STATE_ORDER = ["NSW", "Vic", "Qld", "SA", "WA", "Non-NSW/Vic/Qld"];
const RD_TREND_EASTERN = ["NSW", "Vic", "Qld"];
const RD_TREND_LOC = {
  "Inner metro": { adj: "inner-metro", ref: "the inner metros" },
  "Outer metro": { adj: "outer-metro", ref: "the outer metros" },
  Provincial: { adj: "provincial", ref: "provincial areas" },
  Rural: { adj: "rural", ref: "rural areas" },
};
const RD_TREND_GROUP = {
  "Other language": "voters who speak a language other than English at home", "English only": "English-only speakers",
  "18–34": "18–34s", "35–54": "35–54s", "55+": "over-55s",
  "Gen Z": "Gen Z", Millennials: "Millennials", "Gen X": "Gen X", Boomers: "Boomers",
  Men: "men", Women: "women",
  University: "university graduates", "TAFE or trade": "TAFE-qualified voters", "Year 12 or less": "voters with Year 12 or less",
  "Own outright": "outright homeowners", Mortgage: "mortgage holders", Renting: "renters",
};
/* the state panels' titles, as the board wrote them */
const RD_STATE_NAME = { Vic: "Victoria", Qld: "Queensland" };
/* groups in order as one party colour's ramp, pale to dark (dark mode runs
   the other way, so the last group keeps the most contrast in both) */
const rdRamp = (party, n, i) => (n < 2 ? "var(--" + party + ")" : "var(--ramp-" + party + "-" + (1 + Math.round((i * 3) / (n - 1))) + ")");

function RdDemographics({ rangeId = "all" }) {
  const { D, rangeDomain, filterPts, monthLabelFull } = window.AP;
  const narrow = useNarrow(MQ_PHONE);
  const T = D.demographics;
  const [tabId, setTab] = useState("age");
  const [party, setParty] = useState("onp");
  /* A party switch asks the same groups about another party, so it morphs:
     the dot plot's marks glide and their figures roll, and each group's line
     reshapes into its line for the new party (useMorph, as the issues and
     leadership charts do). A switch of GROUPING is different people, so
     nothing there is drawn as turning into anything: the dot plot's rows
     slide by place and the charts fade in. */
  const [partyMorph, chooseParty] = window.AP.useMorph(party, (v) => setParty(v), (a, b) => a !== b);
  /* Walking the group tabs or party chips rewrites the head and dek above
     them, and the whom-views' rows slide while the charts morph; once that
     text is scrolled up under the sticky tabs each step would drag the row
     and charts with it. rdPinScroll (rd.jsx) holds their spot through the
     glide instead. */
  const pinWv = () => {
    const sec = document.getElementById("who-votes");
    rdPinScroll(sec && sec.querySelector(".rd-wv-tabs"));
  };
  const pickTab = (id) => { pinWv(); setTab(id); };
  const pickParty = (v) => { pinWv(); chooseParty(v); };
  /* hovering the panel hands the arrow keys to the group row and the 1..5
     keys to the party chips (as their focused walks do) until the pointer
     leaves */
  const wvHover = React.useRef(false);
  React.useEffect(() => {
    const sec = document.getElementById("who-votes");
    if (!sec) return undefined;
    const enter = () => { wvHover.current = true; };
    const leave = () => { wvHover.current = false; };
    wvHover.current = sec.matches(":hover");
    sec.addEventListener("pointerenter", enter);
    sec.addEventListener("pointerleave", leave);
    const key = (e) => {
      if (!wvHover.current) return;
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const a = document.activeElement;
      if (a && a.tagName !== "BODY" && a.tagName !== "HTML") return;
      const sel = window.getSelection && window.getSelection();
      if (sel && !sel.isCollapsed) return;
      if (e.key >= "1" && e.key <= "9") {
        /* the chips' own rdDigitKey mapping, at the panel's reach: 1..5
           picks a party, 6..9 finds no chip and keeps its day job */
        const pp = DEMO_PARTIES[e.key.charCodeAt(0) - 48 - 1];
        if (!pp) return;
        e.preventDefault();
        pickParty(pp.id);
        return;
      }
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      const list = (T.tabs || []).map((x) => x.id);
      const i = list.indexOf(tabId);
      if (i < 0 || list.length < 2) return;
      e.preventDefault();
      pickTab(list[(i + (e.key === "ArrowRight" ? 1 : -1) + list.length) % list.length]);
    };
    document.addEventListener("keydown", key, true);
    return () => {
      sec.removeEventListener("pointerenter", enter);
      sec.removeEventListener("pointerleave", leave);
      document.removeEventListener("keydown", key, true);
    };
  }, [tabId]);
  /* each party's charts, built once per grouping and range: a switch
     re-renders every frame, and rebuilding both parties' lines and poll
     dots (a pass over every poll) on each one starved the dot plot's own
     motion of frames on a phone */
  const chartCache = React.useRef({});
  if (!T || !T.tabs || !T.tabs.length) return null;
  const tab = T.tabs.find((x) => x.id === tabId) || T.tabs[0];
  const P = D.PARTIES[party];
  /* the prose names them "others & independents" (user dictate): a lower-case
     description whose possessive takes a bare apostrophe. The Coalition and
     the Greens take their definite articles in prose (user dictate
     2026-09-30): "The Coalition's vote is much the same…", "The Greens' vote
     falls with age", "…back the Coalition" */
  const pName = party === "oth" ? "others & independents" : party === "lnp" ? "the Coalition" : party === "grn" ? "the Greens" : P.name;
  const pPoss = pName + (/s$/.test(pName) ? "’" : "’s"), pColor = P.color;
  /* the vote noun phrase: others & independents can't carry a possessive, so it
     reads "the vote for others & independents" (user dictate 2026-10-07 —
     takes the definite article like the composition-trend dek's voteOf at
     :1948, which made the same call for "…'s vote" in 2026-09-30) */
  const pVote = party === "oth" ? "the vote for others & independents" : pPoss + " vote";
  const all = T.all[party];
  const ki = T.order.indexOf(party), gpi = DEMO_GRP_PARTY.indexOf(party);
  const short = (g) => RD_DEMO_SHORT[g.label] || DEMO_WHO[g.label] || g.label;

  /* ---- the finding -------------------------------------------------------- */
  const st0 = tab.sets[0];
  const verdict = demoVerdict(st0, party) || "";
  const story = (() => {
    let finding;
    const m = /^Support for .* (rises|falls) significantly (.*)\.$/.exec(verdict);
    const noDiff = /no significant difference/.test(verdict);
    if (m && st0.id === "age") finding = pVote + " " + (m[1] === "rises" ? "climbs" : "falls") + " with age";
    else if (m && st0.id === "generation") finding = pVote + " " + (m[1] === "rises" ? "climbs" : "falls") + " with each older generation";
    else if (m && st0.id === "location") finding = pVote + " " + (m[1] === "rises" ? "climbs" : "falls") + " with distance from the city";
    else if (noDiff) finding = pVote + " is much the same across " + ((DEMO_SET_WORDS[st0.id] || {}).all || "these groups");
    else finding = verdict.replace(/ significantly/, "").replace(/\.$/, "");
    const gs = st0.groups.filter((g) => g.v[party] != null);
    const byV = gs.slice().sort((a, b) => b.v[party] - a.v[party]);
    const top = byV[0], bot = byV[byV.length - 1];
    /* when the polls can't split the groups, quote one fraction for the
       whole set: the rounded top/bottom contrast can draw a gap twice as
       wide as the real one (28.1 v 26.1 reads as three-in-ten v one-in-four) */
    const words = DEMO_SET_WORDS[st0.id] || {};
    const both = words.all === "men and women" || words.all === "owners and renters";
    let dek = noDiff
      ? rdCap(rdFraction(all)) + (both ? " " + words.all + " alike" : " of every " + (words.one || "group")) + " back " + pName + "."
      : top && bot && top !== bot
        ? rdCap(rdFraction(top.v[party])) + " " + short(top) + " back " + pName + ", against " + rdFraction(bot.v[party]) + " " + short(bot) + "."
        : "";
    const st1 = tab.sets[1];
    /* collect margin outliers from both the st0 (when noDiff: the headline's
       "much the same" was also computed on st0) and st1 sets, merge by
       snapped fraction ratio, and emit one sentence per ratio-group. */
    const outFor = (groups) => groups.filter((g) => g.v[party] != null)
      .map((g) => ({ g, d: g.v[party] - all, sig: Math.abs(g.v[party] - all) > (g.ci[party] || 0) }));
    const st1Out = st1 ? outFor(st1.groups).filter((o) => o.sig).sort((a, b) => Math.abs(b.d) - Math.abs(a.d)) : [];
    const st0Out = noDiff ? outFor(st0.groups).filter((o) => o.sig) : [];
    const snapRatio = (v) => {
      const cands = [[1,2],[1,3],[2,3],[1,4],[3,4],[1,5],[2,5],[3,5],[4,5],[1,6],[1,7],[1,8],[1,9],[1,10],[3,10],[7,10],[9,10],[1,12],[1,15],[1,20]];
      let best = null;
      for (const [a, b] of cands) {
        const err = Math.abs(v / 100 - a / b);
        if (!best || err < best.err) best = { a, b, err };
      }
      return best.a + "/" + best.b;
    };
    const seen = new Set();
    const outlierGroups = [];
    const pick = (o) => {
      const key = o.g.label;
      if (seen.has(key)) return;
      seen.add(key);
      outlierGroups.push(o);
    };
    /* st1 first (its outlier was already displayed; keeps the existing
       single-sentence form as default when st0 adds nothing new) */
    st1Out.forEach(pick);
    st0Out.forEach(pick);
    const byRatio = new Map();
    for (const o of outlierGroups) {
      const r = snapRatio(o.g.v[party]);
      if (!byRatio.has(r)) byRatio.set(r, []);
      byRatio.get(r).push(o);
    }
    /* join labels by shared snapped ratio; one sentence per distinct ratio */
    const ratioGroups = [...byRatio.values()].map((grp) => {
      /* representative fraction: the largest-|d| member of the group */
      const rep = grp.slice().sort((a, b) => Math.abs(b.d) - Math.abs(a.d))[0];
      const labels = grp.map((o) => short(o.g));
      const listed = labels.length === 1 ? labels[0] : labels.length === 2 ? labels.join(" and ") : labels.slice(0, -1).join(", ") + " and " + labels[labels.length - 1];
      return { grp, labels, listed, frac: rdFraction(rep.g.v[party]) };
    });
    let outlierSentence = "";
    if (ratioGroups.length === 1) {
      const g0 = ratioGroups[0];
      const plural = g0.labels.length > 1 || /s$/.test(g0.labels[0]);
      const verb = !plural || (/^Gen/.test(g0.grp[0].g.label) && g0.labels.length === 1) ? "is" : "are";
      outlierSentence = rdCap(g0.listed) + " " + verb + " the " + (g0.labels.length > 1 ? "outliers" : "outlier") + ", at " + g0.frac + ".";
    } else if (ratioGroups.length > 1) {
      /* several ratio groups: one shared "The outliers are …" sentence, the
         items semicolon-listed so the "at one in four" clauses don't drown in
         commas — never "X is the outlier. Y is the outlier." back to back */
      const items = ratioGroups.map((g) => g.listed + ", at " + g.frac);
      const anyAnd = ratioGroups.some((g) => g.labels.length > 1);
      const joined = items.length === 2 && !anyAnd
        ? items[0] + ", and " + items[1]
        : items.slice(0, -1).join("; ") + (items.length > 2 ? "; and " : "; ") + items[items.length - 1];
      outlierSentence = "The outliers are " + joined + ".";
    }
    if (outlierSentence) dek += " " + outlierSentence;
    /* the headline stays put as the grouping tab flips: the per-grouping
       finding leads the dek instead, the figures sentences after it */
    const home = RD_DEMO_HOME[party];
    if (home) dek = dek ? rdCap(finding) + ". " + dek : rdCap(finding) + ".";
    return { head: home || rdCap(finding), dek };
  })();

  /* ---- the composition trend: which groups have moved out of proportion ---
     Titled and deked from D.demoTrend (gen-data's two-stage test, §7gb), on
     the user's dictated shapes (2026-09-29): proportionality, so "away from /
     towards" means beyond what the party's own national trend hands a group
     merely for its starting level. Sets rank by their strongest move's
     |t(log-ratio)|; the dek carries the top two. Figures quoted are the
     signed moves relative to the all-voters shift, a move on seven or
     fewer monthly points hedges "appears to", and (user dictate 2026-09-29:
     "it must be significantly significant to make it") a thin move never
     CARRIES a claim — it trails a solid one, and a party whose moves are
     all thin renders the unchanged pair. */
  const shift = (() => {
    const dt = D.demoTrend && D.demoTrend[party];
    if (!dt || !dt.windowYm) return null;
    const moves = dt.moves || [];
    /* the significance gate: thin moves (seven or fewer monthly points, the
       t optimistic on shared samples) trail a solid claim as hedged
       sentences but never make one */
    const solid = moves.filter((m) => !m.thin);
    const thin = moves.filter((m) => m.thin);
    const nameT = RD_TREND_NAME[party] || P.name;
    const nameD = RD_TREND_NAME_DEK[party] || pName;
    const isAre = party === "oth" ? "are" : "is";
    const poss = (s) => s + (/s$/.test(s) ? "’" : "’s");
    /* the head's vote noun phrase: others & independents takes "the vote for
       others & independents" — the 2026-10-07 dictate (pVote above) applied
       to the trends' headline form as the 2026-09-30 one did the dek's */
    const voteHead = party === "oth" ? "the vote for others & independents" : poss(nameT) + " vote";
    const serial = (ls) => ls.length < 2 ? (ls[0] || "") : ls.length === 2 ? ls[0] + " and " + ls[1] : ls.slice(0, -1).join(", ") + ", and " + ls[ls.length - 1];
    const since = "Since " + rdMonthYear(dt.windowYm) + ", ";
    if (!solid.length) {
      const skew = RD_TREND_SKEW[party];
      return {
        head: "The composition of " + voteHead + " is unchanged",
        dek: since + "no group has moved significantly towards or away from " + nameD + " relative to all voters" + (skew ? ". " + skew : "."),
      };
    }
    const pct = (v) => (Math.round(v * 10) / 10).toFixed(1).replace(/\.0$/, "");
    /* a move's points relative to the all-voters shift over the same window:
       (g1−g0) − (a1−a0) — also a group claim's change in gap vs all voters */
    const sgnPts = (v) => (v > 0 ? "+" : v < 0 ? "−" : "") + pct(Math.abs(v));
    const relPts = (m) => sgnPts((m.g1 - m.g0) - (m.a1 - m.a0));
    const setGroupsOf = (m) => {
      const tb = T.tabs.find((t) => t.id === m.tab);
      const st = tb && tb.sets.find((s) => s.id === m.set);
      return st ? st.groups.map((g) => g.label) : [];
    };
    const bestOf = (ms) => ms.slice().sort((a, b) => Math.abs(b.tLR) - Math.abs(a.tLR))[0];
    /* the vote noun phrase: others & independents can't carry a possessive
       ("the vote for others & independents", user dictate 2026-09-30) */
    const voteOf = party === "oth" ? "the vote for others & independents" : poss(nameD) + " vote";
    const stateDek = (ms, hedged) => {
      /* a side with no significant move of its own names the other side's
         complement: "away from NSW, Victoria, and Queensland, and towards
         the non-eastern-mainland states" is that bucket's single move read
         the other way. A side with a move of its own QUOTES its own figure
         (user dictate 2026-09-30); a complement-named side stays bare. */
      const towardMs = ms.filter((m) => m.dir > 0), awayMs = ms.filter((m) => m.dir < 0);
      const toward = towardMs.map((m) => m.group);
      const away = awayMs.map((m) => m.group);
      const others = ms.length ? setGroupsOf(ms[0]) : [];
      if (!toward.length) toward.push(...others.filter((l) => !away.includes(l)));
      if (!away.length) away.push(...others.filter((l) => !toward.includes(l)));
      const order = (ls) => RD_TREND_STATE_ORDER.filter((l) => ls.includes(l));
      const eastern = (ls) => ls.length === RD_TREND_EASTERN.length && RD_TREND_EASTERN.every((l) => ls.includes(l));
      const named = (ls) => ls.map((l) => RD_TREND_STATE[l] || l);
      const a = order(away), t = order(toward);
      return {
        // the title's pole: the three eastern states together name as one
        pole: a.length ? (eastern(a) ? "the eastern-mainland states" : serial(named(a))) : (eastern(t) ? "the eastern-mainland states" : serial(named(t))),
        toward: !a.length,
        dek: "the composition of " + voteOf + " " + (hedged ? "appears to have" : "has") + " shifted away from " + serial(named(a)) + " (" + relPts(bestOf(awayMs.length ? awayMs : ms)) + " points relative to all " + nameD + " voters), and towards " + serial(named(t)) + (towardMs.length ? " (" + relPts(bestOf(towardMs)) + " points)" : ""),
      };
    };
    const locDek = (m) => {
      const loc = RD_TREND_LOC[m.group] || { adj: m.group.toLowerCase(), ref: m.group };
      if (m.thin) return [poss(nameD) + " voter base appears to have become " + (m.dir > 0 ? "more " : "less ") + loc.adj];
      const flat = Math.abs(m.a1 - m.a0) < 1;
      const national = (flat ? "even as the national vote has remained flat"
        : "while the national vote has " + (m.a1 < m.a0 ? "fallen" : "risen") + " from " + pct(m.a0) + "% to " + pct(m.a1) + "%");
      const support = party === "oth" ? "Support for others & independents" : (RD_TREND_BARE[party] || nameT) + " support";
      /* the quoted figure is the RELATIVE move, not the fitted from–to
         levels, and the direction word moves into the national clause
         (user dictate 2026-09-30): "... has increased by +3.7 points
         relative to the overall decrease, rising even as the national vote
         has remained flat" */
      const rel = (m.g1 - m.g0) - (m.a1 - m.a0);
      return [
        poss(nameD) + " voter base has become " + (m.dir > 0 ? "more " : "less ") + loc.adj,
        support + " in " + loc.ref + " has " + (rel >= 0 ? "increased" : "decreased") + " by " + sgnPts(rel) + " points relative to the overall decrease, " + (m.dir > 0 ? "rising " : "falling ") + national,
      ];
    };
    /* non-state, non-location moves merge into ONE "It has also shifted …"
       sentence, each group quoting its own figure (user dictate 2026-09-30);
       a sole GENDER move names a relative position instead ("Its relative
       position among men has shrunk" — no "also", since a gender move often
       sits after an opposite-direction location move, per the same dictate).
       The sentence hedges only when every move it carries is thin. */
    const groupSentence = (gms) => {
      const fig = (m) => (RD_TREND_GROUP[m.group] || m.group) + " (" + relPts(m) + " points)";
      const hedged = gms.every((m) => m.thin);
      if (gms.length === 1 && gms[0].set === "gender") {
        const m = gms[0], gap0 = m.g0 - m.a0, gap1 = m.g1 - m.a1;
        const motion = Math.abs(gap1) > Math.abs(gap0) ? "grown" : "shrunk";
        return "Its relative position among " + (RD_TREND_GROUP[m.group] || m.group) + (hedged ? " appears to have " : " has ") + motion + " (" + relPts(m) + " points)";
      }
      const away = gms.filter((m) => m.dir < 0).map(fig);
      const toward = gms.filter((m) => m.dir > 0).map(fig);
      const halves = [];
      if (away.length) halves.push("away from " + serial(away));
      if (toward.length) halves.push("towards " + serial(toward));
      return "It " + (hedged ? "also appears to have shifted " : "has also shifted ") + halves.join(", and ");
    };
    const bySet = new Map();
    for (const m of solid) {
      const k = m.tab + "|" + m.set;
      if (!bySet.has(k)) bySet.set(k, []);
      bySet.get(k).push(m);
    }
    const setsRanked = [...bySet.values()]
      .map((ms) => ({ ms, top: Math.max(...ms.map((m) => Math.abs(m.tLR))) }))
      .sort((a, b) => b.top - a.top)
      .slice(0, 2);
    let head = null;
    const parts = [];
    const groupMoves = [];
    for (const { ms } of setsRanked) {
      const m0 = ms[0];
      if (m0.set === "state") {
        const b = stateDek(ms);
        if (!head) head = nameT + " " + isAre + " " + (b.toward ? "gaining" : "losing") + " voters faster in " + b.pole;
        parts.push(b.dek);
      } else if (m0.set === "location") {
        const m = bestOf(ms), loc = RD_TREND_LOC[m.group] || { ref: m.group };
        if (!head) head = nameT + " " + isAre + " " + (m.dir > 0 ? "gaining in " : "losing voters faster in ") + loc.ref;
        parts.push(...locDek(m));
      } else {
        if (!head) head = "The composition of " + voteHead + " is shifting";
        groupMoves.push(bestOf(ms));
      }
    }
    /* thin moves trail the solid claim (the thin locDek and the hedged
       stateDek render "appears to"; a group sentence of only thin moves
       hedges too); a set already carried by a solid move stays out. Thin
       sentences collect apart and join LAST — a hedged sentence never
       opens the dek, so the first claim is always solid */
    const carried = new Set(setsRanked.map(({ ms }) => ms[0].tab + "|" + ms[0].set));
    const thinSets = new Map();
    for (const m of thin) {
      const k = m.tab + "|" + m.set;
      if (carried.has(k)) continue;
      if (!thinSets.has(k)) thinSets.set(k, []);
      thinSets.get(k).push(m);
    }
    const thinParts = [], thinGroupMoves = [];
    [...thinSets.values()]
      .map((ms) => ({ ms, top: Math.max(...ms.map((m) => Math.abs(m.tLR))) }))
      .sort((a, b) => b.top - a.top)
      .slice(0, 2)
      .forEach(({ ms }) => {
        const m0 = ms[0];
        if (m0.set === "state") thinParts.push(stateDek(ms, true).dek);
        else if (m0.set === "location") thinParts.push(...locDek(bestOf(ms)));
        else thinGroupMoves.push(bestOf(ms));
      });
    /* a dek the group sentence OPENS drops the "also" and stays lower-case
       ("Since …, it has shifted towards renters (+0.9 points)"); after a
       state/location sentence it trails as dictated */
    if (groupMoves.length) {
      const s = groupSentence(groupMoves);
      parts.push(parts.length ? s : s.replace(/^I(t|ts)/, (w) => w.toLowerCase()).replace(" also ", " "));
    }
    /* thin group moves close the dek in their own sentence (all-thin, so
       groupSentence hedges it) — never mixed unhedged into the solid one */
    if (thinGroupMoves.length) thinParts.push(groupSentence(thinGroupMoves));
    const ordered = parts.concat(thinParts);
    /* sentences after the first start a sentence of their own, so a
       lower-case name ("others & independents") still opens capitalised */
    return { head, dek: since + ordered.map((s, i) => (i === 0 ? s : rdCap(s))).join(". ") + "." };
  })();

  /* the full significance battery behind the dek: every tested group, pass
     or fail, in the tabs' own order — the Trend-significance table dropdown
     under the trend legend. A signed figure the site's way: true minus, the
     plus only where the sign is the claim (s = always sign) */
  const sgn1 = (v, s) => (v < 0 ? "−" : s && v > 0 ? "+" : "") + Math.abs(v).toFixed(1);
  const sigSets = (() => {
    const dt = D.demoTrend && D.demoTrend[party];
    const seen = new Map();
    for (const r of (dt && dt.rows) || []) {
      const k = r.tab + "|" + r.set;
      if (!seen.has(k)) seen.set(k, { key: k, label: r.setLabel, from: r.from, to: r.to, rows: [] });
      const s = seen.get(k);
      s.rows.push(r);
      if (r.from < s.from) s.from = r.from;
      if (r.to > s.to) s.to = r.to;
    }
    return [...seen.values()];
  })();

  /* ---- the dot plot, every set on one scale -------------------------------- */
  const vals = tab.sets.flatMap((st) => st.groups.flatMap((g) => [g.v[party] + (g.ci[party] || 0), g.v[party] - (g.ci[party] || 0)].concat((g.px && g.px[party]) || []))).concat([all]);
  const hi = Math.max(10, Math.ceil(Math.max(...vals) / 10) * 10);
  const xp = (v) => (Math.max(0, Math.min(hi, v)) / hi) * 100;
  const signedD = (v) => (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(1);
  const dotSet = (st, idx) => (
    <div className="rd-wv-set" key={"s" + idx} role="table" aria-label={(st.label || tab.label) + ": " + pPoss + " share of each group’s vote"}>
      <div className="rd-wv-sethead" role="row">
        <span role="columnheader"><b>{st.label || "By " + tab.label.toLowerCase()}</b> <span>{rdList((st.houses || []).map(demoHouse))}</span></span>
        <span className="rd-wv-allcap" aria-hidden="true">{idx === 0 && <span style={{ "--x": xp(all) }}>All voters <RollNum value={all.toFixed(1)} />%</span>}</span>
        <span className="rd-wv-vs" role="columnheader">{idx === 0 ? "vs all voters" : ""}</span>
      </div>
      {st.groups.map((g, gi) => {
        const v = g.v[party], ci = g.ci[party] || 0, d = v - all, sig = Math.abs(d) > ci;
        /* the pooled-figures note sits on the text cells, not the row: the
           rug dots now bring their own chart-style tip, and a row-wide
           title would pop the OS tooltip over it */
        const rowTitle = "Pooled from " + g.n + " poll" + (g.n === 1 ? "" : "s") + ", " + rdList((g.houses || []).map(demoHouse)) + ", ± is the 95% margin, small dots: each poll’s own reading";
        return (
          <div key={"r" + gi} className="rd-wv-row" role="row">
            <span role="cell" className="rd-wv-lab" title={rowTitle}>{g.label}<RdGenBorn label={g.label} /></span>
            <span className="rd-wv-track">
              {/* positions go to CSS as --x/--lo/--hi (percent of the track)
                  and are drawn with transforms, so a switch glides them on
                  the compositor however busy the page's own frames are */}
              <span className="rd-wv-all" style={{ "--x": xp(all) }} aria-hidden="true"></span>
              {/* the rug: each wave in the window as a small dot at its own
                  reading; px is wave-ordered for every party, so a party
                  switch glides the dots rather than reshuffling them. The
                  dots are row-keyed buttons - WvRug gives them the chart
                  dots' ring, tip and click-through. They can't live under
                  aria-hidden once they're buttons, so the purely visual
                  siblings carry it instead of the track */}
              {g.pd && g.px && g.px[party] && <WvRug g={g} party={party} xp={xp} pColor={pColor} pName={pName} allXp={xp(all)} split={tab.id} />}
              <span className="rd-wv-ci" style={{ "--lo": xp(v - ci), "--hi": xp(v + ci), color: pColor }} aria-hidden="true"><i className="lo"></i><i className="hi"></i><b></b></span>
              <span className={"rd-wv-dot" + (sig ? "" : " open")} style={{ "--x": xp(v), background: sig ? pColor : undefined, borderColor: pColor }} aria-hidden="true"></span>
            </span>
            <span role="cell" className="rd-wv-v" title={rowTitle}><b><RollNum value={v.toFixed(1)} />%</b> <span>±<RollNum value={ci.toFixed(1)} /></span></span>
            <span role="cell" className={"rd-wv-d" + (sig ? " sig" : "")} style={sig ? { color: inkOf(pColor) } : undefined} title={rowTitle}><RollNum value={signedD(d)} /></span>
          </div>
        );
      })}
    </div>
  );
  const axis = (
    <div className="rd-wv-axis" aria-hidden="true">
      <span></span>
      <span className="rd-wv-ticks">{rdYTicks(0, hi, 10).map((v) => <span key={v} style={{ "--x": xp(v) }}>{v}%</span>)}</span>
      <span></span><span></span>
    </div>
  );

  /* ---- the groups month by month, in points -------------------------------- */
  const [rangeLo, rangeHi] = rangeDomain(rangeId);
  const chartsFor = (pty) => {
    const ki = T.order.indexOf(pty), gpi = DEMO_GRP_PARTY.indexOf(pty);
    const allAt = new Map(T.allMonthly.map((m) => [m[0], m[1 + ki]]));
    const setLines = (st) => st.groups.map((g, i) => ({
      g, color: rdRamp(pty, st.groups.length, i),
      pts: (g.monthly || []).filter((m) => m[1 + ki] != null)
        .map((m) => ({ ym: m[0], x: D.mx(m[0]), y: m[1 + ki], ci: m[1 + T.order.length + ki] ?? null })),
    })).filter((l) => l.pts.length);
    return tab.sets.map((st) => {
      const lines = setLines(st);
      if (!lines.length) return null;
      const firstX = Math.min(...lines.map((l) => l.pts[0].x));
      const x0 = Math.max(rangeLo, firstX - 0.06), x1 = rangeHi;
      const drawn = lines.map((l) => ({ ...l, pts: filterPts(l.pts, x0) }));
      const allPts = filterPts(T.allMonthly.map((m) => ({ ym: m[0], x: D.mx(m[0]), y: m[1 + ki] })).filter((d) => d.x >= firstX - 0.01), x0);
      const dots = D.individualPolls.filter((q) => q.grp && q.grp.t && q.x >= x0 && q.x <= x1).flatMap((q) => drawn.map((l) => {
        const v = q.grp.v[D.demoGroups.indexOf(l.g.label)];
        const sum = v ? v.reduce((a, b) => a + b, 0) : 0;
        const base = allAt.get(q.ym);
        return sum > 0 && q.grp.t[gpi] > 0 && base != null
          ? { x: q.x, y: +(base + (100 * v[gpi] / sum - q.grp.t[gpi])).toFixed(1), color: l.color, label: l.g.label, meta: q } : null;
      }).filter(Boolean));
      return { st, drawn, allPts, dots, x0, x1, span: x1 - x0 };
    }).filter(Boolean);
  };
  const yMaxOf = (cs) => Math.max(10, Math.ceil(Math.max(...cs.flatMap((c) => c.drawn.flatMap((l) => l.pts.map((p) => p.y + (p.ci || 0))).concat(c.dots.map((d) => d.y)))) / 10) * 10);
  const chartsCached = (pty) => {
    const k = pty + "|" + tab.id + "|" + rangeLo + "|" + rangeHi;
    return chartCache.current[k] || (chartCache.current[k] = chartsFor(pty));
  };
  const charts = chartsCached(party);
  const yMax = yMaxOf(charts);
  /* mid-switch: the party left behind, its charts and scale, to blend from */
  const pm = partyMorph && partyMorph.from !== party ? partyMorph : null;
  const fromCharts = pm ? chartsCached(pm.from) : null;
  const fromYMax = fromCharts ? yMaxOf(fromCharts) : yMax;
  /* Place draws its states as the board drew them: a small panel each, the
     state's line inside its 95% interval against the dashed all-voters line.
     Four states on one plot, each banded, were one brown cloud. The panels
     then share the row evenly with the location chart. */
  const panelled = (c) => c.st.id === "state";
  const even = charts.some(panelled);
  /* On a laptop the Place tab's cards sit side by side, and the reader
     expects By location's x axis to land on the same line as the bottom
     row's in the 2x2 state grid beside it. That height is layout, not
     data, so the grid is measured and the location chart sized to it.
     A phone stacks the cards and keeps its fixed chart heights. */
  const wvGridRef = React.useRef(null);
  const [wvGridH, setWvGridH] = React.useState(0);
  React.useLayoutEffect(() => {
    const el = wvGridRef.current;
    if (!el) return undefined;
    const fit = () => setWvGridH(el.getBoundingClientRect().height);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [even, narrow, tabId]);
  const chartOf = (c) => {
    const A = fromCharts && fromCharts.find((x) => x.st.id === c.st.id);
    const t = pm ? pm.t : 1;
    const blend = (a, b) => (A && a && b && a.length && b.length ? window.AP.blendRows(a, b, t, ["y", "ci"]) : null);
    const allBl = A ? blend(A.allPts, c.allPts) : null;
    const allSeries = { id: "all", label: "All voters", color: "var(--ink)", dash: "4 3", dashed: true, rdWidth: 1.5, endCap: false, clipX: allBl ? allBl.clip : undefined,
                        points: (allBl ? allBl.rows : c.allPts).filter((d) => d.y != null).map((d) => ({ x: d.x, y: d.y })), endLabel: narrow ? null : "All voters" };
    /* each group's rows, blended mid-switch; its interval travels with it */
    const rowsOf = c.drawn.map((l) => {
      const la = A && A.drawn.find((x) => x.g.label === l.g.label);
      const bl = la ? blend(la.pts, l.pts) : null;
      return { l, la, clip: bl ? bl.clip : undefined, ciClip: bl ? bl.clips.ci : undefined, rows: (bl ? bl.rows : l.pts).filter((d) => d.y != null) };
    });
    /* A group's colour travels to the new party's round the hue circle on
       the switch's own clock (the lines no longer ease their stroke in CSS,
       which every re-mixed frame restarted and which snapped at the end). */
    const mixC = window.AP.mixC;
    const colorOf = (r) => (A && r.la ? mixC(r.la.color, r.l.color, t) : r.l.color);
    const pColorNow = pm ? mixC(D.PARTIES[pm.from].color, pColor, t) : pColor;
    const lineOf = (r, color, over) => ({ id: r.l.g.label, label: r.l.g.label, color, rdWidth: 2.2, endCap: false,
      clipX: r.clip, points: r.rows.map((d) => ({ x: d.x, y: d.y })), endLabel: r.l.g.label, ...over });
    /* a month rests on a few hundred of a group's respondents, so its band
       is what says whether two groups, or two months, can be told apart;
       mid-switch it is drawn from the blend's own edges (see blendRows) */
    const bandOf = (r, color) => ({ id: "ci-" + r.l.g.label, color, className: "ci-band", edge: false, clipX: r.ciClip || r.clip,
      points: r.rows.some((d) => d.ciHi != null)
        ? r.rows.filter((d) => d.ciHi != null && d.ciLo != null).map((d) => ({ x: d.x, y0: Math.max(0, d.ciLo), y1: d.ciHi }))
        : r.rows.filter((d) => d.ci != null).map((d) => ({ x: d.x, y0: Math.max(0, d.y - d.ci), y1: d.y + d.ci })) });
    const ciRows = (rs, label) => (i) => {
      const ym = c.allPts[i] && c.allPts[i].ym;
      const cs = rs.map((r) => { const d = r.l.pts.find((q) => q.ym === ym); return d && d.ci != null ? (rs.length > 1 ? r.l.g.label + " " : "") + "±" + d.ci.toFixed(1) : null; }).filter(Boolean);
      return cs.length ? [{ label: label, value: cs.join(", ") }] : [];
    };
    const cross = A ? window.AP.crossClouds(A.dots, c.dots, t, (d) => d.meta.pollster + "|" + d.meta.released + "|" + d.label) : null;
    const xDom = A ? window.AP.blendDomain([A.x0, A.x1], [c.x0, c.x1], t) : [c.x0, c.x1];
    const yDom = A ? window.AP.blendDomain([0, fromYMax], [0, yMax], t) : [0, yMax];
    const head = (
      <div className="rd-chead"><span className="rd-chead-t">{c.st.label || "By " + tab.label.toLowerCase()}<span className="rd-chead-meta">since {rdMonthYear(c.drawn.reduce((m, l) => (l.pts[0].ym < m ? l.pts[0].ym : m), "9999"))}</span></span></div>
    );
    if (panelled(c)) {
      const mine = (arr, label) => (arr || []).filter((d) => d.label === label).map((d) => ({ ...d, color: pColorNow }));
      /* each panel carries its state's 2025 election result as the site's
         usual ring, before the first monthly point; the spine picks the
         mark up so the May 2025 hover and its ring swatch exist (rd-ring,
         as the primary chart's election dot) */
      const se = D.demoStateElection;
      const seI = se && !pm ? T.order.indexOf(party) : -1;
      return (
        <div className="card rd-card rd-wv-chart" key={c.st.id} style={{ flex: "1 1 0" }}>
          {head}
          <div className="rd-wv-panels" ref={wvGridRef}>
            {rowsOf.map((r) => {
              const g = r.l.g, name = RD_STATE_NAME[g.label] || g.label;
              /* the ring leads the series by a month or two, so the edge
                 test lets it sit just left of the window the monthly run
                 starts (and the domain below is widened to hold it) */
              const seY = seI >= 0 && se.groups[g.label] && se.x >= xDom[0] - 0.25 - 1e-6 && se.x < c.allPts[0].x ? se.groups[g.label][seI] : null;
              const seN = seY != null && se.groups.Nat ? se.groups.Nat[seI] : null;
              const spine = seY != null ? [{ x: se.x, y: seY }].concat(c.allPts.map((d) => ({ x: d.x, y: d.y }))) : c.allPts.map((d) => ({ x: d.x, y: d.y }));
              const xDomP = seY != null && se.x < xDom[0] ? [se.x - 0.05, xDom[1]] : xDom;
              /* the guide tip reads a row off a series ONLY where the series
                 has a point at that exact x, so the run back to the election
                 is a dotted lead-in series of its own, sharing the line's
                 label (the tooltip collapses shared labels back to one row)
                 and carrying both endpoints: the election figure, and the
                 first polled share where the lead meets the real line. Dotted
                 rather than an unmarked straight segment because the month or
                 two between was never polled */
              const stPts = r.rows.map((d) => ({ x: d.x, y: d.y }));
              const stLead = seY != null && stPts.length
                ? { id: "ld-" + g.label, label: g.label, color: pColorNow, dash: RD_ELECTION_LEAD, rdWidth: 2.25,
                    endCap: false, clipX: r.clip, points: [{ x: se.x, y: seY }, stPts[0]] }
                : null;
              const allLead = seN != null && allSeries.points.length
                ? { id: "lead-all-" + g.label, label: "All voters", color: "var(--ink)", dash: RD_ELECTION_LEAD,
                    dashed: true, rdWidth: 1.25, endCap: false, points: [{ x: se.x, y: seN }, allSeries.points[0]] }
                : null;
              const ciUnshifted = ciRows([r], "95% interval");
              return (
                <div key={g.label} className="rd-sm rd-wv-panel">
                  <div className="rd-sm-top"><span>{name}</span><b>{g.v[party] != null ? g.v[party].toFixed(1) + "%" : ""}</b></div>
                  <TrendChart key={"rd-wv-" + c.st.id + "-" + g.label} heightPx={narrow ? 120 : 140}
                    padPx={{ l: 30, r: 6, t: 8, b: 24 }}
                    xDomain={xDomP} yDomain={yDom} yTicks={rdYTicks(0, yMax, 20)} yTickFmt={(v) => (v === 0 ? "0" : v + "%")}
                    xTicks={seY != null ? rdElectionTicks(xDomP[0], c.x1, true, se.x) : rdXTicks(c.x0, c.x1, true)} baseline driven={!!A}
                    series={[{ ...allSeries, rdWidth: 1.25, endLabel: null }, lineOf(r, pColorNow, { rdWidth: 2.25, endLabel: null })]
                      .concat(allLead ? [allLead] : [], stLead ? [stLead] : [])}
                    areas={[bandOf(r, pColorNow)].filter((a) => a.points.length >= 2)}
                    spine={spine}
                    marks={seY != null ? [{ x: se.x, y: seY, color: pColorNow }] : []}
                    ringAtX={seY != null ? se.x : null}
                    scatter={mine(cross ? cross.scatter : c.dots, g.label)} scatterOut={mine(cross ? cross.scatterOut : [], g.label)}
                    scatterMove={mine(cross ? cross.scatterMove : [], g.label)}
                    fade={A ? t : 1} pollFacet="demographics" pollSplit={tab.id}
                    tooltipTitle={(i) => (seY != null && i === 0 ? monthLabelFull("2025-05") : c.allPts[seY != null ? i - 1 : i] ? monthLabelFull(c.allPts[seY != null ? i - 1 : i].ym) : "")}
                    extraRows={seY != null ? ((i) => (i === 0 ? [{ label: "", value: "The election result" }] : ciUnshifted(i - 1))) : ciUnshifted}
                    fmt={(v) => v.toFixed(1)}
                    copy={{ title: rdCap(pVote) + ": " + name, sub: "Share of this group who would vote for " + pName + ", month by month, against all voters",
                            legend: [{ label: name, color: pColor, kind: "line" }, { label: "95% interval", color: pColor, kind: "band" }, { label: "All voters", color: "var(--ink)", kind: "dashed" }] }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      );
    }
    /* By location gets the state panels' rings too - one per classification
       line at its own 2025 election result, named "The election result" in
       the hover. The monthly run only starts Feb 2026 though, nearly a year
       after the election, so the domain widens to hold the rings (all-range,
       and any window whose left edge already reaches back that far) and each
       ring joins its line with the state panels' dotted lead-in: carrying the
       line's label and both endpoints so the guide tip's election rows read
       off it, and dotted because the nine months between were never polled -
       a lead-in is interpolation, not data. A short range keeps its own
       window, and nothing is marked mid-party-switch */
    const le = c.st.id === "location" && D.demoLocElection ? D.demoLocElection : null;
    const leI = le && !pm ? T.order.indexOf(party) : -1;
    const leOn = le != null && leI >= 0 && c.allPts.length && le.x < c.allPts[0].x
      && (xDom[0] <= le.x + 1e-6 || rangeId === "all");
    const leN = leOn ? le.groups.Nat[leI] : null;
    const leY = (g) => (leOn && le.groups[g.label] ? le.groups[g.label][leI] : null);
    const xDomL = leOn && le.x < xDom[0] ? [le.x - 0.05, xDom[1]] : xDom;
    const ciLoc = ciRows(rowsOf, "95% intervals");
    const leLeads = leOn ? rowsOf.filter((r) => leY(r.l.g) != null && r.rows.length)
      .map((r) => ({ id: "ld-" + r.l.g.label, label: r.l.g.label, color: colorOf(r), dash: RD_ELECTION_LEAD, rdWidth: 2.2,
                      endCap: false, clipX: r.clip, points: [{ x: le.x, y: leY(r.l.g) }, { x: r.rows[0].x, y: r.rows[0].y }] }))
      .concat(leN != null && allSeries.points.length
        ? [{ id: "lead-all-" + c.st.id, label: "All voters", color: "var(--ink)", dash: RD_ELECTION_LEAD, dashed: true, rdWidth: 1.5,
             endCap: false, points: [{ x: le.x, y: leN }, allSeries.points[0]] }]
        : []) : [];
    return (
    /* A lone card on the row must always fill it, but the data-driven
       grow keeps a SHORT series under 1, and CSS hands a row whose grow
       factors sum to less than 1 only that fraction of the free space -
       so the By-education card stopped short of the row's edge. The
       proportional rule applies only when two cards share the row. */
    <div className="card rd-card rd-wv-chart" key={c.st.id} style={even ? { flex: "1 1 0" } : { flexGrow: narrow || charts.length < 2 ? 1 : Math.max(0.35, c.span) }}>
      {head}
      {/* heightPx = grid + 8 + (30 − 24): the svg starts at the card's
          content top while the grid sits 8px lower (.rd-wv-panels
          margin-top), this plot's x axis sits 30px above the svg bottom,
          and the bottom-row panels' x axes sit 24px above the grid's
          bottom edge - so round(grid) + 14 lands every x axis on the one
          line. A change to any of the three constants moves the 14. */}
      <TrendChart key={"rd-wv-" + c.st.id + "-" + tab.id} heightPx={narrow ? 240 : (even && wvGridH ? Math.round(wvGridH) + 14 : 260)}
        padPx={narrow ? { l: 34, r: 8, t: 12, b: 28 } : { l: 40, r: 12, t: 12, b: 30 }}
        xDomain={xDomL} yDomain={yDom} yTicks={rdYTicks(0, yMax, 10)} yTickFmt={(v) => (v === 0 ? "0" : v + "%")}
        xTicks={leOn ? rdElectionTicks(xDomL[0], c.x1, narrow || c.span < 0.8, le.x) : rdXTicks(c.x0, c.x1, narrow || c.span < 0.8)} baseline driven={!!A}
        series={[allSeries, ...rowsOf.map((r) => lineOf(r, colorOf(r)))].concat(leLeads)}
        areas={rowsOf.map((r) => bandOf(r, colorOf(r))).filter((a) => a.points.length >= 2)}
        spine={(leN != null ? [{ x: le.x, y: leN }].concat(c.allPts.map((d) => ({ x: d.x, y: d.y }))) : c.allPts.map((d) => ({ x: d.x, y: d.y })))}
        marks={leOn ? rowsOf.filter((r) => leY(r.l.g) != null).map((r) => ({ x: le.x, y: leY(r.l.g), color: colorOf(r) })) : []}
        ringAtX={leOn ? le.x : null}
        scatter={cross ? cross.scatter : c.dots} scatterOut={cross ? cross.scatterOut : []} scatterMove={cross ? cross.scatterMove : []}
        fade={A ? t : 1} pollFacet="demographics" pollSplit={tab.id}
        tooltipTitle={(i) => (leOn && i === 0 ? monthLabelFull("2025-05") : c.allPts[leOn ? i - 1 : i] ? monthLabelFull(c.allPts[leOn ? i - 1 : i].ym) : "")}
        extraRows={leOn ? ((i) => (i === 0 ? [{ label: "", value: "The election result" }] : ciLoc(i - 1))) : ciLoc}
        fmt={(v) => v.toFixed(1)}
        /* keyed in full: a phone names no line at its end, and "All voters"
           loses its name wherever the groups crowd it */
        copy={{ title: rdCap(pVote) + " " + (c.st.label || "By " + tab.label).toLowerCase(), sub: "Share of each group who would vote for " + pName + ", month by month, against all voters",
                legend: c.drawn.map((l) => ({ label: l.g.label, color: l.color, kind: "line" }))
                  .concat([{ label: "95% interval", color: pColor, kind: "band" }, { label: "All voters", color: "var(--ink)", kind: "dashed" }]) }}
      />
    </div>
    );
  };

  return (
    <RdSec id="who-votes" cls="rd-wv" title="Who votes for whom" meta={"Pooled from the last " + T.window + " of " + rdList(T.houses.map(demoHouse)) + " polls"}>
      <RdHed head={story.head} dek={story.dek} />
      {/* the party picks itself by number key: 1 One Nation, 2 Labor,
          3 Coalition, 4 Greens, 5 Others - the chips' left-to-right order */}
      <RdTabs swipe value={tab.id} onChange={pickTab} options={T.tabs.map((x) => ({ id: x.id, label: x.label }))} ariaLabel="Group voters by" className="rd-wv-tabs"
              onDigits={rdDigitKey(DEMO_PARTIES, pickParty)}>
        {!narrow && (
          <span className="rd-chips" role="group" aria-label="Party" onClick={rdTabFocus}>
            {DEMO_PARTIES.map((pp) => (
              <button key={pp.id} type="button" className="rd-chip" aria-pressed={party === pp.id} onClick={() => pickParty(pp.id)}
                      style={party === pp.id ? { background: "var(--tint-" + pp.id + ")", borderColor: D.PARTIES[pp.id].color } : undefined}>
                <span className="rd-sw" style={{ background: D.PARTIES[pp.id].color }}></span><RdTabW t={pp.label} /></button>
            ))}
          </span>
        )}
      </RdTabs>
      {narrow && (
        /* phone chips abbreviate (ON ALP L/NP GRN OTH) so the five of them
           share one line; the full name stays on the accessible label */
        <div className="rd-chips rd-chips-row" role="group" aria-label="Party" onClick={rdTabFocus}
             onKeyDown={rdDigitKey(DEMO_PARTIES, pickParty)}>
          {DEMO_PARTIES.map((pp) => (
            <button key={pp.id} type="button" className="rd-chip" aria-pressed={party === pp.id} aria-label={pp.label}
                    onClick={() => pickParty(pp.id)}
                    style={party === pp.id ? { background: "var(--tint-" + pp.id + ")", borderColor: D.PARTIES[pp.id].color } : undefined}>
              <span className="rd-sw" style={{ background: D.PARTIES[pp.id].color }}></span><RdTabW t={pp.short} /></button>
          ))}
        </div>
      )}
      <div className="card rd-card rd-wv-dots">
        <div className="rd-wv-plot">
          {tab.sets.map((st, i) => dotSet(st, i))}
          {axis}
          {/* one all-voters line from its label to the axis, through every set,
              as the board draws it; a phone keeps it to each row's track */}
          <div className="rd-wv-allline" aria-hidden="true"><span><i style={{ "--x": xp(all) }}></i></span></div>
        </div>
        <RdKey className="rd-ckey rd-wv-key" items={[
          { kind: "dot-solid", color: pColor, label: "Clearly above or below all voters" },
          { kind: "dot-open", color: pColor, label: "Within the margin" },
          { kind: "whisker", color: pColor, label: "95% interval" },
          { kind: "dot", color: pColor, label: "One poll pooled" },
        ]}><span className="rd-key-item rd-wv-keytxt">Right-hand column: difference from all voters, in points</span></RdKey>
      </div>
      {/* the composition trend IS the change-over-time line here (it came
          down from under the headline and the per-tab gap pairs retired with
          it - user correction, 2026-09-29) */}
      {shift && <RdSub head={shift.head} dek={shift.dek} glide />}
      {/* keyed on the grouping: a switch of it brings the charts in fresh,
          faded rather than cut (a party switch keeps them and morphs) */}
      <div className="rd-wv-charts rd-wv-enter" key={"wv-" + tab.id}>{charts.map(chartOf)}</div>
      <RdKey className="rd-ckey rd-sm-key" items={[
        { kind: "dot", color: "var(--ink-3)", label: "One poll" },
        { kind: "lineband", color: "var(--ink-3)", label: narrow ? "Monthly average, 95% interval" : "Monthly average and its 95% interval" },
        { kind: "dash", color: "var(--ink)", label: "All voters" },
      ]} />
      {sigSets.length > 0 && (
        <details className="rd-evdrop rd-tsig">
          <summary>Trend-significance table</summary>
          <div className="rd-tsig-wrap">
            <table className="rd-tsig-table">
              <thead>
                <tr>
                  <th scope="col"><span className="sr-only">Group</span></th>
                  <th scope="col">Support, start → end, %</th>
                  <th scope="col">All voters, start → end, %</th>
                  <th scope="col">Change vs all voters, pts</th>
                  <th scope="col">t, gap</th>
                  <th scope="col">t, ratio</th>
                  <th scope="col">Significant</th>
                </tr>
              </thead>
              {sigSets.map((s) => (
                <tbody key={s.key}>
                  <tr className="rd-tsig-set"><th colSpan={7}>{s.label}<span className="rd-tsig-since">since {rdMonthYear(s.from)}</span></th></tr>
                  {s.rows.map((r) => (
                    <tr key={r.group}>
                      <th scope="row">{r.group}{r.thin ? " †" : ""}</th>
                      <td>{sgn1(r.g0)} → {sgn1(r.g1)}</td>
                      <td>{sgn1(r.a0)} → {sgn1(r.a1)}</td>
                      <td>{sgn1(r.rel, true)}</td>
                      <td>{r.tAbs == null ? "–" : sgn1(r.tAbs)}</td>
                      <td>{r.tLR == null ? "–" : sgn1(r.tLR)}</td>
                      <td className={r.sig ? "rd-tsig-yes" : ""}>{r.sig ? "Yes" : "No"}</td>
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
          </div>
          <p className="rd-note rd-tsig-note">Support figures are fitted monthly trends over each set’s window, not single polls. A group’s change vs all voters is its fitted change less {party === "oth" ? "minor parties’ and independents’" : pName + "’s"} national fitted change, in points; a move counts as significant only when both trend tests — on the group’s gap to all voters and on its ratio — clear a t statistic of 1.96. † Seven or fewer monthly readings: the trend summary above hedges these (“appears to”).</p>
        </details>
      )}
      <RdFoot how={{ term: "vote-by-group", from: "Who votes for whom" }}>
        {charts.length > 1 ? (even ? "Every panel shares one scale." : "Both panels share one scale, so each is only as wide as its data.") : null}
      </RdFoot>
    </RdSec>
  );
}

/* the fold-out significance battery, shared by every panel whose charts
   answer "did this move?": a details fold under the legend, the .rd-tsig
   chrome (green rows where the test passes, quiet ink where it doesn't),
   each table naming its own test in the note. rows: {name, cells, sig} */
const rdTsSgn = (v, s) => (v < 0 ? "−" : s && v > 0 ? "+" : "") + Math.abs(v).toFixed(1);
function RdTsig({ summary, heads, sets, note }) {
  return (
    <details className="rd-evdrop rd-tsig">
      <summary>{summary}</summary>
      <div className="rd-tsig-wrap">
        <table className="rd-tsig-table">
          <thead>
            <tr>
              <th scope="col"><span className="sr-only">{heads[0]}</span></th>
              {heads.slice(1).map((h) => <th key={h} scope="col">{h}</th>)}
            </tr>
          </thead>
          {sets.map((s) => (
            <tbody key={s.key}>
              {s.label ? <tr className="rd-tsig-set"><th colSpan={heads.length}>{s.label}{s.since ? <span className="rd-tsig-since">{s.since}</span> : null}</th></tr> : null}
              {s.rows.map((r, i) => (
                <tr key={r.key || i}>
                  <th scope="row">{r.name}</th>
                  {r.cells.map((c, j) => <td key={j} className={j === r.cells.length - 1 && r.sig ? "rd-tsig-yes" : ""}>{c}</td>)}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
      <p className="rd-note rd-tsig-note">{note}</p>
    </details>
  );
}

/* ======================================================================
   Where One Nation's voters came from
   ====================================================================== */
/* a container's width, kept current: for drawings laid out in pixels */
function useRdWidth(ref, fallback) {
  const [w, setW] = React.useState(fallback || 800);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const fit = () => setW(el.getBoundingClientRect().width || fallback || 800);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return w;
}

function RdSwitching({ rangeId }) {
  const { D, rangeDomain, filterPts } = window.AP;
  const narrow = useNarrow(MQ_PHONE);
  const S = D.onSources;
  const boxRef = React.useRef(null);
  const W = useRdWidth(boxRef, 1152);
  if (!S || !S.series.length || !S.series.every((sr) => sr.rate)) return null;
  const Wt = S.weights || {};
  const byId = {};
  S.series.forEach((sr) => { byId[sr.id] = sr; });
  const NAME = { lnp: "Coalition", alp: "Labor", oth: "Others", grn: "Greens" };
  const LONG = { lnp: "Coalition voters", alp: "Labor voters", oth: "Others & independents", grn: "Greens voters" };
  const VOTED = { lnp: "for the Coalition", alp: "Labor", oth: "for another party or an independent", grn: "Green" };
  const VOTERS25 = { lnp: "2025 Coalition voters", alp: "2025 Labor voters", oth: "2025 minor-party and independent voters", grn: "2025 Greens voters" };
  /* One Nation's own 2025 voters: the share still backing it, pooled over
     the same polls as the rates */
  const recent = (S.waves || []).slice(-(S.now && S.now.n ? S.now.n : 5));
  const keptPct = recent.length ? recent.reduce((s, w) => s + w.keptPct * (w.sample || 1), 0) / recent.reduce((s, w) => s + (w.sample || 1), 0) : null;
  const cols = ["lnp", "alp", "oth", "grn"].filter((id) => byId[id]).map((id) => {
    const sr = byId[id];
    const w = id === "oth" ? (Wt.oth || 0) + (Wt.ind || 0) : Wt[id];
    return { id, sr, w, rate: sr.rate.now.v, rateCi: sr.rate.now.ci95, gain: sr.now.v, gainCi: sr.now.ci95, pts: sr.now.pts,
             color: sr.color, tint: "var(--tint-" + id + ")", ink: inkOf(sr.color) };
  });
  const onpW = Wt.onp || 0;
  const keptPts = keptPct != null ? keptPct * onpW / 100 : null;
  const gained = cols.reduce((s, c) => s + (c.pts || 0), 0);
  const onNow = D.latest.primary.onp;

  /* ---- the finding ---------------------------------------------------------- */
  const top = cols.slice().sort((a, b) => b.gain - a.gain)[0];
  const lnp = cols.find((c) => c.id === "lnp"), alp = cols.find((c) => c.id === "alp");
  /* Title/dek swap (user's, 2026-09-30) with every figure LINKED to the
     pooled data: the head is the higher of the lnp/alp switch rates via
     plainShare; the dek keeps the flocked-ratio sentence, then carries the
     old head's gain-share sentence (party names per whichever of lnp/alp
     rates higher, ratio rounded to the nearest quarter). */
  const hiC = lnp && alp ? (lnp.rate >= alp.rate ? lnp : alp) : null;
  const loC = hiC ? (hiC === lnp ? alp : lnp) : null;
  const nm = (c) => (c.id === "lnp" ? "Coalition" : "Labor");
  const head = hiC ? rdCap(plainShare(hiC.rate)) + " 2025 " + nm(hiC) + " voters now back One Nation" : null;
  const gainOf = top ? rdCap(rdFraction(top.gain)) + " of One Nation’s new voters voted for " + (top.id === "lnp" ? "the Coalition" : top.id === "alp" ? "Labor" : top.id === "grn" ? "the Greens" : "another party") + " in 2025." : "";
  const dek = (!hiC || !loC) ? null
    : nm(hiC) + " voters have flocked to One Nation at about " + (Math.round(hiC.rate / loC.rate * 4) / 4) + " times the rate of " + nm(loC) + " voters. "
    + gainOf;

  /* ---- the rates, month by month -------------------------------------------- */
  const [rangeLo, rangeHi] = rangeDomain(rangeId);
  const firstX = Math.min(...cols.map((c) => c.sr.rate.monthly[0].x));
  /* the window opens about a month before the first average, as the canvas
     drew it, so the first reading clears the "25%" and "50%" set on the plot */
  const x0 = Math.max(rangeLo, firstX - 0.075), x1 = rangeHi;
  const pollRate = (id) => (S.waves || []).map((w) => {
    const v = w.toOn ? w.toOn[id] : null;
    return v == null ? null : { x: D.mx(w.date.slice(0, 7)) + ((+w.date.slice(8, 10) - 15) / 365), y: v, h: w.pollster, w: w.sample || 1000, meta: { pollster: w.pollster, released: w.date, dateLabel: w.dateStart ? "" : "", sample: w.sample } };
  }).filter(Boolean);
  const fits = cols.map((c) => ({ c, fit: withinHouseSlope(pollRate(c.id).map((d) => ({ h: d.h, t: d.x, w: d.w, y: d.y }))) })).filter((f) => f.fit);
  const sig = [];
  for (const [i, f] of [...fits].sort((a, b) => a.fit.p - b.fit.p).entries()) {
    if (f.fit.p >= 0.05 / (fits.length - i)) break;
    sig.push(f);
  }
  const firstYm = cols[0].sr.rate.monthly[0].ym;
  const sinceM = D.monthNameFull(Number(firstYm.slice(5)));
  /* the rates that moved, tested within each pollster, the rest said to hold */
  const subHead = !sig.length ? "The rates have held since " + sinceM
    : sig.length === cols.length ? "Every party’s rate has " + (sig.every((f) => f.fit.b > 0) ? "risen" : sig.every((f) => f.fit.b < 0) ? "fallen" : "moved") + " since " + sinceM
    : "The rates have held since " + sinceM + ", except for " + rdList(sig.map((f) => NAME[f.c.id])) + " voters, whose "
      + (sig.length > 1 ? "rates have" : "rate has") + " " + (sig.every((f) => f.fit.b < 0) ? "fallen" : sig.every((f) => f.fit.b > 0) ? "risen" : "moved");
  const ks = cols.flatMap((c) => c.sr.rate.monthly.map((m) => m.k)).filter((k) => k != null);
  const kLo = Math.min(...ks), kHi = Math.max(...ks);
  const subDek = "Share of each party’s 2025 voters now backing One Nation: each dot is one poll, and the lines are monthly averages, shaded by their 95% interval. "
    + "A month rests on " + (kLo === kHi ? rdNumWord(kLo) : rdNumWord(kLo) + " to " + rdNumWord(kHi)) + " polls, so a move that stays inside the band is noise.";
  const monthsIn = D.MONTHS.filter((ym) => D.mx(ym) >= x0 && D.mx(ym) <= x1 + 0.01);
  const smTicks = monthsIn.length ? [monthsIn[0], monthsIn[Math.floor((monthsIn.length - 1) / 2)], monthsIn[monthsIn.length - 1]]
    .filter((v, i, a) => a.indexOf(v) === i).map((ym) => ({ x: D.mx(ym), label: D.monthName(Number(ym.slice(5))) })) : [];
  /* the scale clears the polls and the tops of the monthly bands */
  const smTop = Math.max(50, Math.ceil(Math.max(...cols.flatMap((c) => pollRate(c.id).map((d) => d.y)
    .concat(c.sr.rate.monthly.map((m) => m.v + (m.ci95 || 0))))) / 25) * 25);

  /* ---- the mosaic ------------------------------------------------------------ */
  const GAP = 4, H = narrow ? 0 : 240;
  const all = cols.concat(onpW ? [{ id: "onp", w: onpW, rate: keptPct, kept: true, color: "var(--onp-deep)", tint: "var(--line-2)", ink: "var(--onp-text)" }] : []);
  const totW = all.reduce((s, c) => s + c.w, 0);
  const usable = W - GAP * (all.length - 1);
  let acc = 0;
  const geo = all.map((c) => { const x = acc, w = (c.w / totW) * usable; acc += w + GAP; return { ...c, x, cw: w }; });
  const fmt1 = (v) => v.toFixed(1);
  /* the column labels, each at the longest wording that clears its
     neighbour: a laptop's One Nation column is too narrow for its name */
  const labOpts = geo.map((c, i) => ({
    nm: c.kept ? ["One Nation", "ON"] : [NAME[c.id]],
    sz: [fmt1(c.w) + "%" + (c.id === "lnp" || c.id === "alp" ? " of 2025 voters" : c.id === "oth" ? ", incl. independents" : ""), fmt1(c.w) + "%"],
    /* the first two columns' points rows name what they count (full wording
       on big screens, the ON short form on small, "of the gain" second);
       every later column is bare. The phone rows say the same wordings */
    pts: c.kept ? ["≈ " + fmt1(keptPts)] : i === 0
      ? ["≈ " + fmt1(c.pts) + " points of One Nation’s gain", "≈ " + fmt1(c.pts) + " points of ON’s gain", "≈ " + fmt1(c.pts) + " points", "≈ " + fmt1(c.pts)]
      : i === 1
        ? ["≈ " + fmt1(c.pts) + " points of the gain", "≈ " + fmt1(c.pts) + " points", "≈ " + fmt1(c.pts)]
        : ["≈ " + fmt1(c.pts) + " points", "≈ " + fmt1(c.pts)],
    /* the share row is bare: its old "of the gain" tail duplicated what the
       pts row above already names (first-column-only from 2026-09-30, gone
       for good 2026-10-03, both layouts - user calls) */
    sh: c.kept ? ["kept"] : [Math.round(c.gain) + "% ±" + fmt1(c.gainCi),
                            Math.round(c.gain) + "%"],
  }));
  const lab = {};
  [["nm", 15, 600], ["sz", 12, 400], ["pts", 15, 600], ["sh", 12, 400]].forEach(([key, size, wt]) => {
    const k = geo.map(() => 0);
    const ext = (i) => {
      const w = textWidth(labOpts[i][key][k[i]], size, wt);
      const last = i === geo.length - 1;
      const x = last ? geo[i].x + geo[i].cw : geo[i].x;
      return last ? [x - w, x] : [x, x + w];
    };
    for (let i = 0; i < geo.length - 1; i++) {
      for (let guard = 0; guard < 6 && ext(i)[1] + 10 > ext(i + 1)[0]; guard++) {
        if (k[i] < labOpts[i][key].length - 1) k[i]++;
        else if (k[i + 1] < labOpts[i + 1][key].length - 1) k[i + 1]++;
        else break;
      }
    }
    lab[key] = k.map((j, i) => labOpts[i][key][j]);
  });
  const mosaic = !narrow ? (
    <svg className="rd-mo" width={W} height={H + 110} viewBox={`0 0 ${W} ${H + 110}`} role="img"
         aria-label={"Each 2025 party’s voters as a column sized by its 2025 vote, filled by the share now backing One Nation. "
           + cols.map((c) => NAME[c.id] + " " + fmt1(c.rate) + "%").join(", ") + (keptPct != null ? "; One Nation kept " + Math.round(keptPct) + "% of its own." : ".")}>
      {geo.map((c, i) => {
        const last = i === geo.length - 1;
        const tx = last ? c.x + c.cw : c.x, anchor = last ? "end" : "start";
        const fillH = (c.rate / 100) * H;
        return (
          <g key={c.id}>
            <text className="rd-mo-nm" x={tx} y={16} textAnchor={anchor} style={{ fill: c.ink }}>{lab.nm[i]}</text>
            <text className="rd-mo-sz" x={tx} y={35} textAnchor={anchor}>{lab.sz[i]}</text>
            <rect x={c.x} y={48} width={c.cw} height={H} style={{ fill: c.tint }} />
            <rect className="rd-mo-fill" x={c.x} y={48 + H - fillH} width={c.cw} height={fillH} style={{ fill: c.kept ? "var(--onp-deep)" : "var(--onp)" }} />
            {i === 0 && <text className="rd-mo-sz" x={c.x + 12} y={48 + 22} style={{ fill: c.ink }}>Stayed or went elsewhere</text>}
            {c.kept ? (() => {
              /* a tablet's One Nation column is barely wider than "94%": set
                 in from its edge, the figure ran off the drawing - centred there */
              const fit = c.cw >= textWidth(Math.round(c.rate) + "%", 15, 600) + 20;
              const kx = fit ? c.x + 10 : c.x + c.cw / 2, ka = fit ? "start" : "middle";
              return (
                <>
                  <text className="rd-mo-rates" x={kx} y={48 + H - fillH + 24} textAnchor={ka} style={{ fill: "var(--bg)" }}>{Math.round(c.rate)}%</text>
                  <text className="rd-mo-sz" x={kx} y={48 + H - fillH + 40} textAnchor={ka} style={{ fill: "var(--bg)" }}>kept</text>
                </>
              );
            })() : i === 0 ? (
              <>
                <text className="rd-mo-rate" x={c.x + 14} y={48 + H - fillH + 30}>{fmt1(c.rate)}%</text>
                <text className="rd-mo-sz rd-mo-onfill" x={c.x + 14} y={48 + H - fillH + 48}>now back One Nation</text>
              </>
            ) : (
              <text className="rd-mo-rates" x={c.x + 14} y={fillH >= 22 ? 48 + H - fillH + 20 : 48 + H - fillH - 8}
                    style={fillH >= 22 ? undefined : { fill: "var(--onp-text)" }}>{fmt1(c.rate)}%</text>
            )}
            <text className="rd-mo-pts" x={tx} y={48 + H + 28} textAnchor={anchor}>{lab.pts[i]}</text>
            <text className="rd-mo-sh" x={tx} y={48 + H + 47} textAnchor={anchor}>{lab.sh[i]}</text>
          </g>
        );
      })}
      <line x1="0" x2={W} y1={48 + H} y2={48 + H} className="rd-mo-base" />
    </svg>
  ) : (
    <div className="rd-mo-rows">
      {/* the parties named as the canvas named them, and the first bar
          spelling out what its two parts are, as the laptop's mosaic does.
          The first two rows' pts figures name what they count in the
          laptop's short wordings - the full "One Nation's gain" doesn't
          clear even a 390px row beside the party name (user, 2026-10-03);
          the ± row needed no tail once the pts row named the gain */}
      {all.map((c, i) => (
        <div key={c.id} className="rd-mo-row">
          <div className="rd-mo-rtop"><b style={{ color: c.ink }}>{c.kept ? "One Nation" : c.id === "oth" ? "Others & independents" : NAME[c.id]}</b><b>{c.kept ? "≈ " + fmt1(keptPts) + " pts" : i === 0 ? "≈ " + fmt1(c.pts) + " points of ON’s gain" : i === 1 ? "≈ " + fmt1(c.pts) + " points of the gain" : "≈ " + fmt1(c.pts) + " pts"}</b></div>
          <div className="rd-mo-rsub"><span>{fmt1(c.w)}% of 2025 voters</span><span>{c.kept ? Math.round(c.rate) + "% still back it" : Math.round(c.gain) + "% ±" + fmt1(c.gainCi)}</span></div>
          <div className="rd-mo-rbar" style={{ height: Math.max(16, c.w * 2.6), background: c.tint }}>
            <span style={{ width: c.rate + "%", background: c.kept ? "var(--onp-deep)" : "var(--onp)" }}></span>
            {!c.kept && i === 0 ? (
              <em className="rd-mo-first" style={{ left: "calc(" + c.rate + "% + 8px)" }}>
                <span className="rd-mo-big">{fmt1(c.rate)}%</span><span className="rd-mo-nb">now back One Nation</span></em>
            ) : !c.kept && <em style={{ left: "calc(" + c.rate + "% + 8px)" }}>{fmt1(c.rate)}%</em>}
            {!c.kept && i === 0 && <i className="rd-mo-else" style={{ color: c.ink }}>Stayed or went elsewhere</i>}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <RdSec id="switching" cls="rd-sw" title="Where One Nation’s voters came from"
           meta={"How 2025 voters say they’d vote now, " + rdList(S.houses || []) + ", last " + (S.now ? S.now.window : "six weeks")}>
      {head && <RdHed head={head} dek={dek} />}
      <div className="card rd-card rd-mo-wrap" ref={boxRef}>
        {mosaic}
        <p className="rd-note rd-mo-note">Points are shares of all voters. About {Math.round(gained)} gained from other parties{keptPts != null ? ", plus " + Math.round(keptPts) + " kept," : ""} add up to {Math.round(gained + (keptPts || 0))} of One Nation’s {onNow.toFixed(1)} points today.</p>
        <div className="rd-key rd-mo-key">
          <span className="rd-key-item"><RdSwatch kind="square" color="var(--onp)" />Switched to One Nation</span>
          <span className="rd-key-item"><RdSwatch kind="square" color="var(--onp-deep)" />Already One Nation in 2025</span>
          {!narrow && <span className="rd-key-item rd-mo-howread">Width: share of the 2025 vote, Height: share now backing One Nation, Area: voters gained</span>}
        </div>
        {narrow && <p className="rd-note">Bar height: that party’s share of the 2025 vote. Filled width: share now backing One Nation. Filled area: voters One Nation gained.</p>}
      </div>
      <RdSub head={subHead} dek={subDek} />
      <div className="rd-sm-grid">
        {cols.map((c) => {
          const pts = filterPts(c.sr.rate.monthly, x0).map((m) => ({ x: m.x, y: m.v, ym: m.ym, ci: m.ci95 }));
          /* each month inside its 95% interval: a month rests on two to four
             polls, and a party on its share of each, so the band is what
             tells a one-month jump from a move */
          const band = pts.filter((p) => p.ci != null).map((p) => ({ x: p.x, y0: Math.max(0, p.y - p.ci), y1: p.y + p.ci }));
          const dots = pollRate(c.id).filter((d) => d.x >= x0 && d.x <= x1 + 0.02).map((d) => ({ x: d.x, y: d.y, color: c.color, label: LONG[c.id], meta: d.meta }));
          return (
            <div key={c.id} className="card rd-card rd-sm">
              <div className="rd-sm-top"><span style={{ color: c.ink }}>{narrow ? NAME[c.id] : LONG[c.id]}</span><b>{fmt1(c.rate)}%</b></div>
              <TrendChart key={"rd-sm-" + c.id} heightPx={narrow ? 120 : 150} padPx={{ l: 4, r: 4, t: 18, b: 24 }}
                xDomain={[x0, x1]} yDomain={[0, smTop]} yTicks={rdYTicks(0, smTop, 25)}
                yTickFmt={() => ""} xTicks={smTicks} baseline
                series={[{ id: c.id, label: LONG[c.id], color: c.color, rdWidth: narrow ? 2 : 2.5, endCap: false, points: pts }]}
                spine={pts} scatter={dots}
                areas={band.length >= 2 ? [{ id: "ci-" + c.id, color: c.color, className: "ci-band", edge: false, points: band }] : []}
                notes={rdYTicks(25, smTop, 25).map((v) => ({ x: "left", y: v, dy: -4, text: v + "%", size: 11, cls: "rd-sm-ylab" }))}
                tooltipTitle={(i) => (pts[i] ? window.AP.monthLabelFull(pts[i].ym) : "")}
                extraRows={(i) => (pts[i] && pts[i].ci != null ? [{ label: "95% interval", value: "±" + pts[i].ci.toFixed(1) }] : [])}
                fmt={(v) => v.toFixed(1)}
                copy={{ title: VOTERS25[c.id] + " now backing One Nation",
                        sub: "Share of those who voted " + VOTED[c.id] + " at the 2025 election who now say they would vote One Nation, month by month",
                        legend: [{ label: "Monthly average", color: c.color, kind: "line" }, { label: "95% interval", color: c.color, kind: "band" }] }}
              />
            </div>
          );
        })}
      </div>
      <RdKey className="rd-ckey rd-sm-key" items={[
        { kind: "dot", color: "var(--ink-3)", label: "One poll" },
        { kind: "lineband", color: "var(--ink-3)", label: narrow ? "Monthly average, 95% interval" : "Monthly average and its 95% interval" },
      ]} />
      <RdTsig summary="Trend-significance table"
        heads={["Party’s 2025 voters", "Monthly line, first → last, %", "Slope, pts/yr", "t", "Significant"]}
        sets={[{ key: "main", rows: cols.map((c) => {
          const ms = c.sr.rate.monthly, fe = fits.find((x) => x.c === c), f = fe && fe.fit, sg = !!fe && sig.includes(fe);
          return { key: c.id, name: LONG[c.id], sig: sg,
            cells: [rdTsSgn(ms[0].v) + " → " + rdTsSgn(ms[ms.length - 1].v), f ? rdTsSgn(f.b, true) : "–", f ? rdTsSgn(f.t) : "–", sg ? "Yes" : "No"] };
        }) }]}
        note={"Rates are pooled across pollsters; a party’s trend test fits one shared slope to every pollster’s own monthly changes (a level per pollster, each poll weighted by its sample), Holm’s correction applied across the four parties, so Yes means the slope clears 95% — the test behind the “since " + sinceM + "” line above."}
      />
      <RdFoot how={{ term: "vote-switching", from: "Where One Nation’s voters came from" }}>
        2025 vote is as respondents recall it. {narrow ? "Bar heights" : "Column widths"} use the AEC 2025 first-preference result.
      </RdFoot>
    </RdSec>
  );
}

/* ======================================================================
   The issues
   ====================================================================== */
/* the slope test behind issTrendVerdict, kept as figures so a headline can
   be written from it */
function rdIssTrend(D, it, dots) {
  if (!dots.length) return null;
  const per = {};
  for (const d of dots) per[d.pollster] = (per[d.pollster] || 0) + 1;
  const ym = (dots.find((d) => per[d.pollster] >= 2) || dots[0]).date.slice(0, 7);
  const fits = D.issues.parties.map((q) => ({ q, fit: withinHouseSlope(dots.map((d) => ({ h: d.pollster, t: d.x, w: d.n, y: d.s[q] }))) })).filter((f) => f.fit);
  const sig = [];
  for (const [i, f] of [...fits].sort((a, b) => a.fit.p - b.fit.p).entries()) {
    if (f.fit.p >= 0.05 / (fits.length - i)) break;
    sig.push(f);
  }
  /* the Trend-significance table beneath the chart reads the same fits:
     every party's slope and t, and the Holm survivors as its Sig column */
  const byParty = D.issues.parties.map((q) => {
    const f = fits.find((x) => x.q === q);
    return { q, fit: f ? { b: f.fit.b, t: f.fit.t } : null, sig: sig.some((s) => s.q === q) };
  });
  return { ym, up: sig.filter((f) => f.fit.b > 0).map((f) => f.q), down: sig.filter((f) => f.fit.b < 0).map((f) => f.q), tested: fits.length, byParty };
}

function RdIssues({ rangeId = "all" }) {
  const { D, rangeDomain, filterPts, series, monthLabelFull } = window.AP;
  const narrow = useNarrow("(max-width: 760px)");
  const I = D.issues;
  const [view, setView] = useState("trust");
  const [selId, setSelId] = useState(null);
  /* picking another issue asks the same three parties a different question,
     so the chart reshapes into it (useMorph) rather than being swapped out.
     Called before the early return below: a hook can't sit after one. */
  const selNow = selId || (I && I.list && I.list[0] ? I.list[0].id : null);
  const [issMorph, setSel] = window.AP.useMorph(selNow, (v) => setSelId(v), (a, b) => a !== b);
  const [gsetId, setGset] = useState("vote");
  /* What matters to whom: a tablet or phone shows one issue at a time, as the
     canvas's phone board did, with the reader's pick kept across group sets.
     From 1000px down the six columns' bars would fall under 60px. */
  const [whomK, setWhomK] = useState(null);
  const whomList = useNarrow("(max-width: 1000px)");
  /* the dot strip's width on screen, so dots that would print over one
     another can be told apart (see dodge, below) */
  const stripRef = React.useRef(null);
  /* the issues rows' container, so an arrow key can hand focus to the row it
     just selected */
  const rowsRef = React.useRef(null);
  /* hovering the section hands ←/→ to the view row; hovering the whom card
     hands them to its group row instead (the deeper claim wins in the key
     handler); hovering the trust grid hands ↑/↓ to the issue rows' walk.
     All hooks sit above the early return below. */
  const isHover = React.useRef(false);
  const iwHover = React.useRef(false);
  const iwCard = React.useRef(null);
  const trHover = React.useRef(false);
  const trGrid = React.useRef(null);
  /* live hover stepper for the trust rows: assigned every render so the key
     handler's closure never goes stale, and returns false only when there's
     no walk to make (the key keeps its day job — scrolling the page — then);
     the walk is circular, like every other claimed row */
  const trStep = React.useRef(null);
  trStep.current = (dir) => {
    const list = I && I.list ? I.list : [];
    if (list.length < 2) return false;
    const cur = selNow && list.some((x) => x.id === selNow) ? selNow : list[0].id;
    const j = (list.findIndex((x) => x.id === cur) + dir + list.length) % list.length;
    setSel(list[j].id);
    return true;
  };
  React.useEffect(() => {
    const sec = document.getElementById("issues");
    if (!sec) return undefined;
    const on = (el, ref) => {
      const enter = () => { ref.current = true; };
      const leave = () => { ref.current = false; };
      ref.current = el.matches(":hover");
      el.addEventListener("pointerenter", enter);
      el.addEventListener("pointerleave", leave);
      return [el, enter, leave];
    };
    const pairs = [on(sec, isHover)];
    if (iwCard.current) pairs.push(on(iwCard.current, iwHover));
    else iwHover.current = false;
    if (trGrid.current) pairs.push(on(trGrid.current, trHover));
    else trHover.current = false;
    const key = (e) => {
      if ((!isHover.current && !iwHover.current && !trHover.current) || (e.key !== "ArrowRight" && e.key !== "ArrowLeft" && e.key !== "ArrowDown" && e.key !== "ArrowUp")) return;
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const a = document.activeElement;
      if (a && a.tagName !== "BODY" && a.tagName !== "HTML") return;
      const sel = window.getSelection && window.getSelection();
      if (sel && !sel.isCollapsed) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        /* the trust rows' focused walk goes vertical; their column and its
           chart share one grid, so the claim is the grid — the walk's effect
           (selection → chart morph) reads across both */
        if (!trHover.current || view !== "trust") return;
        const trg = trGrid.current;
        if (!trg || !trg.isConnected || !trg.getClientRects().length) return;
        if (!trStep.current || !trStep.current(e.key === "ArrowDown" ? 1 : -1)) return;
        e.preventDefault();
        return;
      }
      const G = I && I.groups;
      if (iwHover.current && view === "whom" && G && G.tabs) {
        const iw = iwCard.current;
        if (!iw || !iw.isConnected || !iw.getClientRects().length) return;
        const list = G.tabs.map((x) => x.id);
        const i = list.indexOf(gsetId);
        if (i < 0 || list.length < 2) return;
        e.preventDefault();
        pickGset(list[(i + (e.key === "ArrowRight" ? 1 : -1) + list.length) % list.length]);
      } else if (isHover.current) {
        const vs = ["trust", "whom"];
        const i = vs.indexOf(view);
        if (i < 0) return;
        e.preventDefault();
        setView(vs[(i + (e.key === "ArrowRight" ? 1 : -1) + vs.length) % vs.length]);
      }
    };
    document.addEventListener("keydown", key, true);
    return () => {
      pairs.forEach(([el, enter, leave]) => {
        el.removeEventListener("pointerenter", enter);
        el.removeEventListener("pointerleave", leave);
      });
      document.removeEventListener("keydown", key, true);
    };
  }, [view, gsetId, I]);
  const stripW = useRdWidth(stripRef, 150);
  if (!I || !I.list || !I.list.length) return null;
  const P = I.parties;
  const list = I.list;
  const it = list.find((x) => x.id === selId) || list[0];
  const top = list[0];
  const pName = (q) => D.PARTIES[q].name, pColor = (q) => D.PARTIES[q].color;
  const [rangeLo, rangeHi] = rangeDomain(rangeId);

  /* ---- one issue's chart and its trend ------------------------------------ */
  const chartFor = (x) => {
    const monthPts = (x.monthly || []).map((m) => ({ ym: m[0], x: D.mx(m[0]),
      ...Object.fromEntries(P.map((q, i) => [q, m[1 + i]])), ...Object.fromEntries(P.map((q, i) => ["ci_" + q, m[1 + P.length + i]])) }));
    if (!monthPts.length) return null;
    const xDomain = [Math.max(rangeLo, monthPts[0].x - 0.06), rangeHi];
    const pts = filterPts(monthPts, xDomain[0]);
    const byRow = new Map(D.individualPolls.map((q) => [q.pollster + "|" + q.released, q]));
    const dots = (x.dots || []).filter((d) => d[0] >= xDomain[0] && d[0] <= xDomain[1]).map((d) => {
      const meta = byRow.get(d[1] + "|" + d[2]) || { pollster: demoHouse(d[1]), released: d[2] };
      return { x: d[0], pollster: d[1], date: d[2], n: meta.sample || 1000, meta, s: Object.fromEntries(P.map((q, i) => [q, d[3 + i]])) };
    });
    const scatter = dots.flatMap((d) => P.map((q) => ({ x: d.x, y: d.s[q], color: pColor(q), label: pName(q), meta: d.meta })));
    const areas = P.map((q) => ({ id: "ci-" + q, color: pColor(q), className: "ci-band", edge: false,
      points: pts.filter((d) => d["ci_" + q] != null).map((d) => ({ x: d.x, y0: d[q] - d["ci_" + q], y1: d[q] + d["ci_" + q] })) })).filter((a) => a.points.length >= 2);
    const vals = pts.flatMap((d) => P.map((q) => d[q])).concat(scatter.map((d) => d.y), areas.flatMap((a) => a.points.flatMap((d) => [d.y0, d.y1])));
    const d0 = Math.max(0, Math.floor((Math.min(...vals) + 0.6) / 10) * 10), d1 = Math.ceil((Math.max(...vals) - 0.6) / 10) * 10;
    return { xDomain, pts, dots, scatter, areas, domain: [d0, d1], trend: rdIssTrend(D, x, dots) };
  };
  const ch = chartFor(it);
  /* mid-switch: both issues' months on one grid, interpolated, with the x
     window, the y range and the bands travelling too, and the dots of a poll
     that asked about both issues crossing over */
  const chDraw = (() => {
    if (!ch) return null;
    const draw = { xDomain: ch.xDomain, domain: ch.domain, pts: ch.pts, areas: ch.areas, scatter: ch.scatter, scatterOut: [], scatterMove: [], fade: 1, clip: null };
    const m = issMorph;
    const a = m && list.find((x) => x.id === m.from), A = a && chartFor(a);
    if (!m || !A) return draw;
    const t = m.t;
    const bl = window.AP.blendRows(A.pts, ch.pts, t, P.concat(P.map((q) => "ci_" + q)));
    if (!bl) return draw;
    const keyOf = (d) => d.meta.pollster + "|" + d.meta.released + "|" + d.label;
    const cross = window.AP.crossClouds(A.scatter, ch.scatter, t, keyOf);
    return {
      xDomain: window.AP.blendDomain(A.xDomain, ch.xDomain, t), domain: window.AP.blendDomain(A.domain, ch.domain, t),
      pts: bl.rows, clip: bl.clip,
      areas: P.map((q) => ({ id: "ci-" + q, color: pColor(q), className: "ci-band", edge: false, clipX: bl.clip,
        points: bl.rows.filter((d) => d["ci_" + q] != null && d[q] != null).map((d) => ({ x: d.x, y0: d[q] - d["ci_" + q], y1: d[q] + d["ci_" + q] })) })).filter((x) => x.points.length >= 2),
      scatter: cross.scatter, scatterOut: cross.scatterOut, scatterMove: cross.scatterMove, fade: t,
    };
  })();
  const chTop = it === top ? ch : chartFor(top);
  const since = (tr) => tr ? D.monthNameFull(+tr.ym.slice(5)) + (Number(tr.ym.slice(0, 4)) === new Date(Date.parse(D.latest.updatedISO)).getUTCFullYear() ? "" : " " + tr.ym.slice(0, 4)) : "";
  const trendHead = (x, c) => {
    const tr = c && c.trend;
    if (!tr) return null;
    if (!tr.up.length && !tr.down.length) return "No party has gained significant ground since " + since(tr);
    if (tr.up.length) return rdList(tr.up.map((q) => rdPartyStart(q))) + " " + (tr.up.length > 1 ? "have" : "has") + " gained significant ground since " + since(tr);
    return rdList(tr.down.map((q) => rdPartyStart(q))) + " " + (tr.down.length > 1 ? "have" : "has") + " lost significant ground since " + since(tr);
  };

  /* ---- the finding: the top concern, and who is trusted with it ------------- */
  const phrase = ISS_PHRASE[top.id] || top.label.toLowerCase();
  const own = top.own;
  const trTop = chTop && chTop.trend;
  const minor = trTop && trTop.up.length === 1 && trTop.up[0] === "onp" ? "onp" : null;
  const trustHead = !own ? rdCap(phrase.replace(/^the /, "")) + " tops voters’ concerns"
    : own.leadSig ? rdPartyStart(own.lead) + " is most trusted on " + phrase + ", voters’ top concern"
    : minor ? "One Nation has drawn level with the major parties on " + phrase
    : "No party is clearly trusted most on " + phrase + ", voters’ top concern";
  /* Dynamic dek with the user's 2026-09-28 curated sentence shapes (re-linked from frozen
     text 2026-10-05, user call "make it dynamic"). Every named lead is a live-significant
     pooled gap, so the sentences shed a clause rather than print a stale one. "By far"
     needs the top salience at 1.5x and 10 points clear of the runner-up; the Coalition's
     "age-old" economy lead is the lore claim (the longstanding perception edge), gated
     only on the live significant lead - not a this-term tenure check. */
  const trustDek = (() => {
    if (!top.imp) return null;
    const sents = [];
    const nextV = list.filter((x) => x.id !== top.id && x.imp && x.imp.v != null).reduce((a, x) => Math.max(a, x.imp.v), -1);
    const byFar = nextV >= 0 && top.imp.v >= 1.5 * nextV && top.imp.v - nextV >= 10;
    const trustClause = !own ? null
      : own.leadSig ? ", where " + rdPartyIn(own.lead) + " holds a clear lead"
      : ", but no party is more trusted on it than another";
    sents.push(rdCap(phrase) + " is " + (byFar ? "by far " : "") + "the issue most important to voters" + (trustClause || "") + ".");
    /* per-party lead lists (significant leads only, salience order), Oxford-comma list
       as in the curated text; the top issue is never re-named in a lead list */
    const phraseOf = (x) => (ISS_PHRASE[x.id] || x.label.toLowerCase()).replace(/^the /, "");
    const listOf = (xs) => (xs.length === 1 ? xs[0] : xs.length === 2 ? xs.join(" and ")
      : xs.slice(0, -1).join(", ") + ", and " + xs[xs.length - 1]);
    const salRank = (a, b) => (b.imp && b.imp.v != null ? b.imp.v : -1) - (a.imp && a.imp.v != null ? a.imp.v : -1);
    const econ = list.find((x) => x.id === "economy");
    const econLnp = !!(econ && econ.own && econ.own.leadSig && econ.own.lead === "lnp");
    const ledBy = {};
    for (const x of list) {
      if (!x.own || !x.own.leadSig || x.id === top.id) continue;
      if (econLnp && x.id === "economy") continue;
      (ledBy[x.own.lead] = ledBy[x.own.lead] || []).push(x);
    }
    const blocks = [];
    for (const q of ["alp", "onp", "lnp"]) {
      if (q === "lnp" && econLnp) continue;
      const xs = (ledBy[q] || []).sort(salRank);
      if (xs.length) blocks.push({ q, xs: xs.map(phraseOf) });
    }
    for (let i = 0; i < blocks.length; i += 2) {
      const chx = blocks.slice(i, i + 2);
      sents.push(chx.map((b, j) => (j === 0 ? rdPartyStart(b.q) : rdPartyIn(b.q)) + " leads on " + listOf(b.xs)).join(", while ") + ".");
    }
    if (econLnp) {
      const others = (ledBy.lnp || []).sort(salRank).map(phraseOf);
      sents.push("The Coalition retains its age-old lead on economic management" + (others.length ? ", and leads on " + listOf(others) : "") + ".");
    }
    return sents.join(" ");
  })();

  /* ---- who's trusted: the rows -------------------------------------------- */
  const dotLo = 20, dotHi = 50;
  const dx = (v) => ((Math.max(dotLo, Math.min(dotHi, v)) - dotLo) / (dotHi - dotLo)) * 100;
  /* Parties within a dot's width of each other on this strip - on a laptop
     the table shares its row with the chart, so a point is about five pixels
     - step apart vertically, centred on the row, rather than printing one
     dot over another (cost of living's 34, 32 and 34 showed as one). */
  const dodge = (own) => {
    const need = 12 / Math.max(1, stripW / (dotHi - dotLo));
    const s = P.map((q) => ({ q, v: own.v[q] })).sort((a, b) => a.v - b.v);
    const off = {};
    let run = [s[0]];
    const flush = () => run.forEach((d, i) => { off[d.q] = (i - (run.length - 1) / 2) * 9; });
    for (let i = 1; i < s.length; i++) {
      if (s[i].v - s[i - 1].v < need) run.push(s[i]);
      else { flush(); run = [s[i]]; }
    }
    flush();
    return off;
  };
  const verdictOf = (x) => !x.own ? null : x.own.leadSig
    ? { text: ISS_PARTY_CAP[x.own.lead] + " ahead", color: inkOf(pColor(x.own.lead)), strong: true }
    : x.own.pairSig ? { text: ISS_PARTY_CAP[x.own.third] + " behind", strong: true }
    : { text: "No clear lead" };
  /* keyboard walk over the issue rows: with a row focused, ArrowDown/ArrowUp
     step the selection a row at a time, focus following (a held key keeps
     walking), circular at the list's ends (down on the last row lands on
     the first, as the hover claim's walk does) */
  const rowKey = (e, x) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSel(x.id); return; }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const i = list.findIndex((y) => y.id === x.id);
    const j = (i + (e.key === "ArrowDown" ? 1 : -1) + list.length) % list.length;
    setSel(list[j].id);
    const rows = rowsRef.current ? rowsRef.current.querySelectorAll(".rd-is-row:not(.rd-is-tally)") : [];
    if (rows[j]) rows[j].focus();
  };
  const row = (x) => {
    const v = verdictOf(x), sel = x.id === it.id;
    const off = x.own ? dodge(x.own) : {};
    return (
      <div key={x.id} className={"rd-is-row" + (sel ? " sel" : "")} role="button" tabIndex={0} aria-pressed={sel}
           onClick={() => setSel(x.id)} onKeyDown={(e) => rowKey(e, x)}
           aria-label={x.label + ": " + (x.imp ? Math.round(x.imp.v) + "% put it in their top three" : "not asked") + "; " + (x.own ? pOrd.map((q) => pName(q) + " " + Math.round(x.own.v[q])).join(", ") + "; " + v.text : "no three-way figures")}>
        <span className="rd-is-lab">{x.label}</span>
        <span className="rd-is-imp">{x.imp ? <><span className="rd-is-bar"><span style={{ width: x.imp.v + "%" }}></span></span><b>{Math.round(x.imp.v)}%</b><span className="rd-is-impw"> rank it top three</span></> : <span className="rd-is-na">not asked</span>}</span>
        <span className="rd-is-dots" aria-hidden="true">
          {[20, 30, 40, 50].map((g) => <span key={g} className="rd-is-gl" style={{ left: dx(g) + "%" }}></span>)}
          {x.own && P.map((q) => <span key={q} className="rd-is-dot" style={{ left: dx(x.own.v[q]) + "%", top: "calc(50% + " + off[q] + "px)", background: pColor(q) }}></span>)}
        </span>
        <span className="rd-is-nums">{x.own ? pOrd.map((q) => <b key={q} style={{ color: inkOf(pColor(q)) }}>{Math.round(x.own.v[q])}</b>) : null}</span>
        <span className={"rd-is-verdict" + (v && v.strong ? " strong" : "")} style={v && v.color ? { color: v.color } : undefined}>
          {v ? v.text : ""}{x.grnTop && <small className="grn" style={{ color: inkOf(pColor("grn")) }}>Greens first (+{Math.round(x.grnTop.grn - x.grnTop.nextV)}) when offered</small>}</span>
      </div>
    );
  };
  const wide = list.filter((x) => x.imp && x.imp.gap && x.imp.by.length === 2)
    .map((x) => { const [hi, lo] = [...x.imp.by].sort((a, b) => b.v - a.v); return { x, hi, lo, d: hi.v - lo.v }; })
    .sort((a, b) => b.d - a.d).find((w) => w.d >= 5);
  /* the tally its reader is really after - one three-party split for the
     table: each issue's "best on it" shares weighted by how many voters put
     it in their top three (importance x perceived competence), summed to a
     split across the asked issues */
  const tally = (() => {
    const rows = list.filter((x) => x.own && x.imp);
    const wsum = rows.reduce((a, x) => a + x.imp.v, 0);
    if (!wsum) return null;
    return Object.fromEntries(P.map((q) => [q, rows.reduce((a, x) => a + x.imp.v * x.own.v[q], 0) / wsum]));
  })();
  /* every three-party listing on the trust side (head legend, each row's
     figures, the scoreboard chips) reads in scoreboard order, highest first;
     the data arrays stay keyed to P, this is presentation only */
  const pOrd = tally ? P.slice().sort((a, b) => tally[b] - tally[a]) : P;

  /* ---- what matters to whom ------------------------------------------------ */
  const G = I.groups;
  const gtab = G && (G.tabs.find((x) => x.id === gsetId) || G.tabs[0]);
  const allOf = (k) => (G && G.all && G.all[k]) || null;
  const gVerdicts = gtab ? gtab.issues.map((k) => issGroupVerdict(gtab, k)).filter(Boolean).sort((a, b) => b.gap - a.gap).slice(0, 3) : [];
  const whomHead = (() => {
    if (!gtab) return null;
    const firstOf = (cells) => gtab.issues.slice().sort((a, b) => ((cells[b] || {}).v || 0) - ((cells[a] || {}).v || 0));
    const allRank = firstOf(Object.fromEntries(gtab.issues.map((k) => [k, allOf(k) || {}])));
    const ranks = gtab.groups.map((g) => firstOf(gtab.cells[g] || {}));
    const sameFirst = ranks.every((r) => r[0] === allRank[0]);
    const first = (ISS_PHRASE[allRank[0]] || allRank[0]);
    /* user trim, 2026-09-28: the "What comes second divides them." tail was
       cut; the first sentence stays generated */
    if (sameFirst) return rdCap(first) + " comes first for everyone.";
    return rdCap(first) + " comes first for most voters, but not all.";
  })();
  const newestPoll = G && G.newest ? D.individualPolls.find((q) => /^RedBridge/.test(q.pollster) && q.released === G.newest) : null;
  const monFull = (lab) => lab.replace(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sept?|Oct|Nov|Dec)\b/g,
    (m) => D.monthNameFull(["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].indexOf(m.slice(0, 3)) + 1));
  const gSource = G ? G.house + ", " + (newestPoll ? monFull(newestPoll.dateLabel) + " " + G.newest.slice(0, 4) : rdDate(G.newest, true)) : "";
  const whomCell = (g, k) => {
    const c = g ? gtab.cells[g] && gtab.cells[g][k] : allOf(k);
    if (!c) return <span className="rd-iw-na">–</span>;
    const a = allOf(k);
    const diff = g && a ? c.v - a.v : 0;
    const sig = g && a && Math.abs(diff) > c.ci;
    return (
      <span className={"rd-iw-cell" + (g ? "" : " all") + (sig ? " sig" : "")} title={"± " + c.ci.toFixed(1) + " is the 95% margin"}>
        <span className="rd-iw-bar"><span style={{ width: c.v + "%" }}></span>{g && a && <i style={{ left: a.v + "%" }}></i>}</span>
        <b><RollNum value={String(Math.round(c.v))} />{sig ? <em>{diff > 0 ? "▲" : "▼"}</em> : null}</b>
      </span>
    );
  };
  const groupLong = (g) => rdCap(issWho(g)
    .replace(/^Nationals, LNP and CLP voters$/, "Nationals, LNP, CLP voters"));
  const groupShort = (g) => g.replace(/^Nationals, LNP and CLP$/, "Nationals, LNP, CLP");
  /* the issue the one-issue list opens on: the reader's pick, else the one
     that divides the groups most (the canvas opened on immigration) */
  const whomIssue = !gtab ? null : whomK && gtab.issues.includes(whomK) ? whomK
    : (gtab.issues.map((k) => ({ k, v: issGroupVerdict(gtab, k) })).filter((x) => x.v)
        .sort((a, b) => b.v.gap - a.v.gap)[0] || {}).k || gtab.issues[0];
  /* Rows are keyed by their PLACE, not their group, in both layouts: a
     switch of grouping (age -> gender) or of issue keeps each row's bar and
     figure, so the bar slides to its new share and the figure rolls to it -
     the leadership bars' motion - instead of the table being torn down. */
  const whomRow = (g, k, i) => {
    const c = g ? gtab.cells[g] && gtab.cells[g][k] : allOf(k);
    if (!c) return null;
    const a = allOf(k);
    const diff = g && a ? c.v - a.v : 0;
    const sig = g && a && Math.abs(diff) > c.ci;
    return (
      <div key={g ? "r" + i : "all"} className={"rd-iw-lrow" + (g ? "" : " all") + (sig ? " sig" : "")} role="row"
           title={"± " + c.ci.toFixed(1) + " is the 95% margin"}>
        <span role="rowheader">{g ? groupShort(g) : "All voters"}</span>
        <span className="rd-iw-lbar" aria-hidden="true"><span style={{ width: c.v + "%" }}></span>{g && a && <i style={{ left: a.v + "%" }}></i>}</span>
        <span role="cell" className="rd-iw-lv"><RollNum value={String(Math.round(c.v))} />{sig ? " " + (diff > 0 ? "▲" : "▼") : ""}</span>
      </div>
    );
  };

  /* has each group's share MOVED since the election - a different question
     from the card's ▲▼, which test today's gap to all voters? One straight
     line per row through the house's own monthly waves (all-voters first as
     the anchor: its line is the same house's, so the set averages to the
     printed table), each wave weighted by its effective sample, t-tested;
     Holm's correction within each issue, as the trust and decidedness
     tables do, so Yes means the share drifted across the term */
  const whomTsig = !gtab || !gtab.tr ? null : gtab.issues.map((k) => {
    const rows = [["all", "All voters", (gtab.tr.all || {})[k]]]
      .concat(gtab.groups.map((g) => [g, groupShort(g), gtab.tr.g[g] ? gtab.tr.g[g][k] : null]))
      .filter((x) => x[2] && x[2].length)
      .map(([id, name, s]) => ({ id, name, first: s[0][1], last: s[s.length - 1][1],
        fit: withinHouseSlope(s.map((p) => ({ h: id, t: p[0], w: p[2], y: p[1] }))) }));
    const tested = rows.filter((r) => r.fit);
    const sigIds = [];
    for (const [i, r] of [...tested].sort((a, b) => a.fit.p - b.fit.p).entries()) {
      if (r.fit.p >= 0.05 / (tested.length - i)) break;
      sigIds.push(r.id);
    }
    return { key: k, label: I.labels[k] || k, rows: rows.map((r) => ({ key: r.id, name: r.name, sig: sigIds.includes(r.id),
      cells: [rdTsSgn(r.first) + " → " + rdTsSgn(r.last),
        r.fit ? rdTsSgn(r.fit.b, true) : "–", r.fit ? rdTsSgn(r.fit.t) : "–",
        r.fit ? (sigIds.includes(r.id) ? "Yes" : "No") : "–"] })) };
  });
  /* Switching the grouping or the issue rewrites the head and dek above the
     grouping row; scrolled past them, the control row and everything under
     it would ride the story block's height glide. rdPinScroll holds the
     spot. Pin the grouping's own control first: .rd-iw-tabs is the one menu
     at every width since 1e2838f (pinning the .rd-iw-chips Issue row left
     the menu the user tapped gliding away); read top to bottom, so deep in
     the list with the menu scrolled off the Issue chips row itself takes
     the pin; the desktop label+menu row is the last resort */
  const pinWhom = () => {
    const sec = document.getElementById("issues");
    rdPinScroll(sec && [sec.querySelector(".rd-iw-tabs"), sec.querySelector(".rd-iw-chips"), sec.querySelector(".rd-iw-ctl")]);
  };
  const pickGset = (id) => { pinWhom(); setGset(id); };
  const pickWhom = (k) => { pinWhom(); setWhomK(k); };

  const tabs = (
    <RdTabs swipe value={view} onChange={setView} ariaLabel="View" className="rd-is-tabs"
            options={[{ id: "trust", label: "Who’s trusted" }, { id: "whom", label: "What matters to whom" }]} />
  );
  return (
    <RdSec id="issues" cls="rd-is" title="The issues"
           meta={"What voters say matters most, and who they think is best on it, " + rdList(I.houses) + ", last " + I.window}>
      {tabs}
      {/* the two views ask different things of different charts, so a
          switch crossfades them (RdCrossfade) rather than cutting */}
      <RdCrossfade k={view}>
      {view === "trust" ? (
        <>
          <RdHed head={trustHead} dek={trustDek} />
          <div className="rd-is-grid" ref={trGrid}>
            <div className="rd-is-left" ref={rowsRef}>
              {/* Each head sits over its own column: the strip's words over the
                  strip, the key over the three figures it colours (a phone stacks
                  the words and the key over the scale). */}
              <div className="rd-is-head" aria-hidden="true">
                <span></span>
                <span className="rd-is-imph">In voters’ top three</span>
                <span className="rd-is-dotsh">
                  <span className="rd-is-cap">Best on it, % of voters naming one of these three</span>
                  <span className="rd-is-leg">{pOrd.map((q) => <span key={q}><i style={{ background: pColor(q) }}></i>{ISS_PARTY_CAP[q]}</span>)}</span>
                </span>
              </div>
              {list.map(row)}
              {tally && (
                <div className="rd-is-row rd-is-tally"
                     aria-label={"Issue-importance-weighted trust score: " + pOrd.map((q) => pName(q) + " " + Math.round(tally[q])).join(", ")}>
                  <span className="rd-is-tallab">
                    <b>Issue-importance-weighted trust score</b>
                    <small>Each issue counts in proportion to how many voters rank it in their top three</small>
                  </span>
                  <span className="rd-is-tallynums">{pOrd.map((q) => (
                    <span key={q} className="rd-is-score" style={{ background: "color-mix(in oklab, " + pColor(q) + " 12%, transparent)" }}>
                      <b style={{ color: inkOf(pColor(q)) }}>{Math.round(tally[q])}</b>
                      <i style={{ color: inkOf(pColor(q)) }}>{ISS_PARTY_CAP[q]}</i>
                    </span>))}
                  </span>
                </div>
              )}
              <div className="rd-is-axis" aria-hidden="true">
                <span></span><span></span>
                <span className="rd-is-dots" ref={stripRef}>{[20, 30, 40, 50].map((g) => <span key={g} style={{ left: dx(g) + "%" }}>{g === 50 ? "50%" : g}</span>)}</span>
                <span></span><span></span>
              </div>
              {wide && <p className="rd-note">{wide.hi.house} and {wide.lo.house} word the importance question differently and disagree most on {ISS_PHRASE[wide.x.id]}: {Math.round(wide.hi.v)}% in {wide.hi.house}’s latest poll, {Math.round(wide.lo.v)}% in {wide.lo.house}’s. The grey bars sit midway between the two pollsters’ usual figures.</p>}
              {list.filter((x) => x.grnTop).map((x) => <p key={"g" + x.id} className="rd-note">{x.grnTop.house} also offers the Greens, who come first on {ISS_PHRASE[x.id]} ({x.grnTop.grn}% of all voters, {pName(x.grnTop.next)} next on {Math.round(x.grnTop.nextV)}%).</p>)}
            </div>
            {ch && (
              <div className="card rd-card rd-is-chart">
                <div className="rd-is-ctop"><span>{it.label}</span></div>
                {trendHead(it, ch) && <h4 className="rd-is-chead">{trendHead(it, ch)}</h4>}
                <p className="rd-is-csub">Who voters think is best, month by month, % of those naming Labor, the Coalition or One Nation</p>
                <TrendChart key="rd-is-chart" heightPx={narrow ? 240 : 260} padPx={{ l: 36, r: 10, t: 12, b: 28 }}
                  xDomain={chDraw.xDomain} yDomain={chDraw.domain} yTicks={rdYTicks(ch.domain[0], ch.domain[1], 10)}
                  yTickFmt={(v) => (v === ch.domain[1] ? v + "%" : String(v))} xTicks={rdXTicks(ch.xDomain[0], ch.xDomain[1], true)} baseline
                  series={P.map((q) => ({ id: q, label: pName(q), color: pColor(q), rdWidth: 2.2, endCap: false, clipX: chDraw.clip,
                    points: chDraw.pts.filter((d) => d[q] != null).map((d) => ({ x: d.x, y: d[q] })), endLabel: ISS_PARTY_CAP[q] }))}
                  areas={chDraw.areas} spine={series(ch.pts, P[0])} scatter={chDraw.scatter} scatterOut={chDraw.scatterOut}
                  scatterMove={chDraw.scatterMove} fade={chDraw.fade} driven={!!issMorph} pollFacet="issues"
                  tooltipTitle={(i) => (ch.pts[i] ? monthLabelFull(ch.pts[i].ym) : "")} fmt={(v) => Math.round(v) + ""}
                  copy={{ title: "Which party voters think is best on " + it.label.charAt(0).toLowerCase() + it.label.slice(1),
                          sub: "Share naming each party as best on the issue, of those naming Labor, the Coalition or One Nation, month by month",
                          caption: "Each dot is one poll; lines are monthly averages, shaded bands their 95% intervals." }} />
                <RdKey className="rd-ckey" items={[{ kind: "dot", color: "var(--ink-3)", label: "One poll" }, { kind: "lineband", color: "var(--ink-3)", label: "Monthly average and 95% interval" }]} />
                <HowTo label="How to read these figures" paras={[
                  <>The grey bar is how many voters put the issue among their three most important. RedBridge and Ipsos both ask every month, in different words, and their figures sit a steady distance apart, so each poll is moved half that distance toward the other before the two are pooled.</>,
                  <>The dots split the voters who named Labor, the Coalition or One Nation as best on the issue. Pollsters also offer other answers, and each offers a different set, so only these three can be pooled.</>,
                ]} />
                {ch.trend && ch.trend.byParty && (
                  <RdTsig summary="Trend-significance table"
                    heads={["Party", "Monthly line, first → last, %", "Slope, pts/yr", "t", "Significant"]}
                    sets={[{ key: "main", rows: ch.trend.byParty.map((r) => {
                      const ms = ch.pts.filter((d) => d[r.q] != null);
                      return { key: r.q, name: pName(r.q), sig: r.sig,
                        cells: [rdTsSgn(ms[0][r.q]) + " → " + rdTsSgn(ms[ms.length - 1][r.q]),
                          r.fit ? rdTsSgn(r.fit.b, true) : "–", r.fit ? rdTsSgn(r.fit.t) : "–", r.sig ? "Yes" : "No"] };
                    }) }]}
                    note={"Each party’s share is pooled across the pollsters who asked about " + (ISS_PHRASE[it.id] || it.label.toLowerCase()) + "; its trend test fits one shared slope to every pollster’s own monthly changes (a level per pollster, each poll weighted by its sample), Holm’s correction applied across the three parties, so Yes means the slope clears 95% — the test behind the head above."}
                  />
                )}
              </div>
            )}
          </div>
          <RdFoot how={{ term: "issues", from: "The issues" }}>
            Figures pool the last {I.window} of polls, newer and larger polls counting for more. “Ahead” means a lead larger than its own 95% margin; “behind” names a party clearly third. Pick an issue to follow it in the chart.
          </RdFoot>
        </>
      ) : (
        <>
          <RdHed head={whomHead} dek={gVerdicts.length ? gVerdicts.map((v) => v.text).join(" ") : "No two groups differ significantly on any of these issues."} />
          {gtab ? (
            <div className="card rd-card rd-iw" ref={iwCard}>
              {whomList ? (
                /* a tablet or phone: pick the groups and the issue, and read
                   every group's share of that one issue down a single scale.
                   The grouping picks from the same menu a laptop shows (the
                   chips gave way to it, 2026-09-30, user's) - as who votes
                   for whom's row does on a phone, swipe included */
                <>
                  <span className="rd-iw-k">Group voters by</span>
                  <RdTabs swipe value={gtab.id} onChange={pickGset} options={G.tabs.map((x) => ({ id: x.id, label: x.label }))}
                          ariaLabel="Group voters by" className="rd-tabs-sm rd-iw-tabs" />
                  <div className="rd-iw-chips" role="group" aria-label="Issue">
                    {gtab.issues.map((k) => <button key={k} type="button" className="rd-iw-chip" aria-pressed={whomIssue === k} onClick={() => pickWhom(k)}><RdTabW t={ISS_SHORT[k] || I.labels[k] || k} /></button>)}
                  </div>
                  <p className="rd-iw-ltitle"><b>{I.labels[whomIssue] || whomIssue} in their top three, %</b><br />{gSource}</p>
                  <div className="rd-iw-list" role="table" aria-label={"Share of each group putting " + (ISS_PHRASE[whomIssue] || whomIssue) + " in its top three"}>
                    {whomRow(null, whomIssue)}
                    {gtab.groups.map((g, i) => whomRow(g, whomIssue, i))}
                  </div>
                </>
              ) : (
                <>
                  <div className="rd-iw-ctl">
                    <span className="rd-iw-by">Group voters by</span>
                    <RdTabs value={gtab.id} onChange={pickGset} options={G.tabs.map((x) => ({ id: x.id, label: x.label }))} ariaLabel="Group voters by" className="rd-tabs-sm rd-iw-tabs" />
                  </div>
                  <p className="rd-iw-src"><b>Share of each group putting each issue in its top three, %</b>, {gSource}</p>
                  {/* a fixed layout, as the canvas's grid was: the label column
                      set, the six issues sharing the rest equally. Sized by
                      their words, short heads like "Housing" took columns
                      narrower than their bars, which pushed the figures
                      under the next column. */}
                  <div className="rd-iw-wrap">
                    <table className="rd-iw-table">
                      <colgroup><col className="rd-iw-labcol" />{gtab.issues.map((k) => <col key={k} />)}</colgroup>
                      <thead><tr><th scope="col"><span className="sr-only">Group</span></th>{gtab.issues.map((k) => <th scope="col" key={k}>{I.labels[k] || k}</th>)}</tr></thead>
                      <tbody>
                        <tr className="all"><th scope="row">All voters</th>{gtab.issues.map((k) => <td key={k}>{whomCell(null, k)}</td>)}</tr>
                        {gtab.groups.map((g, i) => <tr key={"r" + i}><th scope="row">{groupLong(g)}</th>{gtab.issues.map((k) => <td key={k}>{whomCell(g, k)}</td>)}</tr>)}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
              <div className="rd-key rd-iw-key">
                <span className="rd-key-item"><span className="rd-iw-keybar" aria-hidden="true"><i></i></span>Group’s share, with all voters marked</span>
                <span className="rd-key-item"><b aria-hidden="true">▲▼</b>Differs from all voters by more than the group’s own 95% margin</span>
              </div>
              {/* the trend battery: has each group's share MOVED since the
                  election? Computed as whomTsig among the whom helpers above,
                  so the per-issue gate borders sit beside the series it draws */}
              {whomTsig && <RdTsig summary="Trend-significance table"
                heads={["Group", "Share, first → last", "Slope, pts/yr", "t", "Significant"]}
                sets={whomTsig}
                note={"Each row fits one straight line to " + G.house + "’s own monthly waves since the May 2025 election, each wave weighted by its share of the sample, t-tested, Holm’s correction applied across each issue’s rows — Yes means the group’s share has drifted over the term, not that it sits off the electorate’s today. First and last are the endpoint waves’ published figures, unsmoothed. The card’s ▲▼ marks ask a different question: today’s gap to all voters against the group’s own 95% margin."}
              />}
            </div>
          ) : <p className="rd-note">No poll in the last {I.window} published these figures by group.</p>}
          <RdFoot how={{ term: "issues", from: "The issues" }}>
            Only {G ? G.house : "RedBridge"} publishes what matters by group, and only for these {gtab ? rdNumWord(gtab.issues.length) : ""} issues, so its all-voters row can differ from the pooled figures in Who’s trusted. A group’s margin depends on its share of the sample.
          </RdFoot>
        </>
      )}
      </RdCrossfade>
    </RdSec>
  );
}

/* ======================================================================
   Decidedness
   ====================================================================== */
/* round denominators only: "one in twenty" is something a reader carries
   away, "one in twenty-three" is not */
const RD_ONE_IN = [3, 4, 5, 10, 20, 50, 100];
const RD_BIG_WORDS = { 50: "fifty", 100: "a hundred" };
/* a small share as "one voter in twenty", the nearest in ratio terms */
function rdOneIn(v) {
  const n = RD_ONE_IN.reduce((b, k) => (Math.abs(Math.log(100 / k / v)) < Math.abs(Math.log(100 / b / v)) ? k : b), RD_ONE_IN[0]);
  return (Math.abs(100 / n - v) < 0.3 ? "one voter in " : "about one voter in ") + (RD_BIG_WORDS[n] || rdNumWord(n));
}
/* a share as "one in four" (no cardinality word), same ladder as rdOneIn;
   only "about"-qualified when the round ratio misses like rdShareWords guards */
function rdOneInShare(v) {
  const n = RD_ONE_IN.reduce((b, k) => (Math.abs(Math.log(100 / k / v)) < Math.abs(Math.log(100 / b / v)) ? k : b), RD_ONE_IN[0]);
  return (Math.abs(100 / n - v) < 1.2 ? "" : "about ") + "one in " + (RD_BIG_WORDS[n] || rdNumWord(n));
}
/* the mid-2025 ring and the now dot, per group, on one scale */
function RdShiftPlot({ rows, all, lo, hi, title, source, dp }) {
  const X = (v) => ((Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo)) * 100;
  const dpv = dp == null ? 1 : dp;
  const signedD = (v) => (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(1);
  return (
    <div className="rd-sp" role="table" aria-label={title}>
      <div className="rd-sp-head" role="row">
        <b role="columnheader">{title}</b>
        <span className="rd-sp-allcap" aria-hidden="true">{all != null && <span style={{ "--x": X(all) }}>All voters <RollNum value={all.toFixed(dpv)} />%</span>}</span>
        <span className="rd-sp-src" role="columnheader">{source}</span>
      </div>
      <div className="rd-sp-plot" role="none">
        {/* one all-voters line from its label to the axis, through every row,
            as Who votes for whom draws it; a phone keeps it to each row's track */}
        {all != null && <div className="rd-sp-allline" aria-hidden="true"><span><i style={{ "--x": X(all) }}></i></span></div>}
        {rows.map((r) => (
          <div key={r.id} className="rd-sp-row" role="row">
            <span role="cell" className="rd-sp-lab">{r.sw && <span className="rd-sp-sw" style={{ background: r.color }}></span>}{r.label}</span>
            <span className="rd-sp-track" aria-hidden="true">
              {all != null && <span className="rd-sp-all" style={{ "--x": X(all) }}></span>}
              <span className="rd-sp-link" style={{ left: Math.min(X(r.base), X(r.now)) + "%", width: Math.abs(X(r.now) - X(r.base)) + "%", "--lc": r.color }}></span>
              <span className="rd-sp-ring" style={{ left: X(r.base) + "%" }}></span>
              <span className="rd-sp-dot" style={{ left: X(r.now) + "%", background: r.color }}></span>
            </span>
            <span role="cell" className="rd-sp-v"><b>{r.now.toFixed(1)}%</b> <span>±{r.ci.toFixed(1)}</span></span>
            <span role="cell" className={"rd-sp-d" + (r.sig ? " sig" : "")}>{signedD(r.now - r.base)}</span>
          </div>
        ))}
      </div>
      <div className="rd-sp-axis" aria-hidden="true">
        <span></span>
        <span className="rd-sp-ticks">{rdYTicks(lo, hi, 10).map((v) => <span key={v} style={{ left: X(v) + "%" }}>{v}%</span>)}</span>
        <span></span><span></span>
      </div>
    </div>
  );
}

function RdUndecided({ rangeId }) {
  const { D, rangeDomain, filterPts, series, monthLabelFull } = window.AP;
  const narrow = useNarrow(MQ_PHONE);
  const [view, setView] = useState("all");
  const U = D.undecided;
  /* hovering the panel hands the arrow keys to the views row (the hooks sit
     above the early return, so the id list is computed from the data here,
     where `views` isn't in scope yet) */
  useHoverClaim("undecided", !!(U && U.series && U.series.length), null, (e) => {
    const ids = ["all"]
      .concat(D.firmness ? ["party"] : [])
      .concat(U.softAge ? ["age"] : []);
    const i = ids.indexOf(view);
    if (i < 0 || ids.length < 2) return false;
    const nxt = ids[(i + (e.key === "ArrowRight" ? 1 : -1) + ids.length) % ids.length];
    rdPinScroll(document.getElementById("undecided") && document.getElementById("undecided").querySelector(".rd-un-tabs"));
    setView(nxt);
    return true;
  }, [U, D, view]);
  if (!U || !U.series.length) return null;
  const F = D.firmness, A = U.softAge;
  const byId = {};
  U.series.forEach((s) => { byId[s.id] = s; });
  const first = byId.first, tpp = byId.tpp, soft = byId.soft;
  const nowOf = (s) => (s ? (s.now ? s.now.v : s.latest.v) : null);
  const xDomain = rangeDomain(rangeId);
  /* the axis opens on the election tick, as the 2PP, primary, mood and
     direction charts do - data-driven so /vic/ never sees the federal mark */
  const base = (D.aggPrimary || []).find((d) => d.election) || null;
  const slopeOf = (s) => (s ? withinHouseSlope(s.polls.map((d) => ({ h: d.pollster, t: d.x, w: d.sample || 1000, y: d.v }))) : null);

  /* ---- the finding ----------------------------------------------------------- */
  const story = (() => {
    const u = nowOf(first), sf = nowOf(soft);
    if (u == null) return null;
    /* the firmest party tail appears only while one party's solid share is
       significantly above the runner-up's (same apart-test the by-party
       view gates its swings on) */
    const firmestTail = !F || !F.now ? "" : (() => {
      /* the pool's own id list - F.now also carries from/to strings */
      const ord = ["onp", "alp", "lnp", "grn", "oth"].filter((k) => F.now[k]).sort((a, b) => F.now[b].v - F.now[a].v);
      if (ord.length < 2) return "";
      const top = F.now[ord[0]], nxt = F.now[ord[1]];
      if (!(Math.abs(top.v - nxt.v) > Math.hypot(top.ci95, nxt.ci95))) return "";
      const np = ord[0] === "oth" ? "the minor-party" : "the " + D.PARTIES[ord[0]].name;
      return ", and " + np + " vote is firmest";
    })();
    const head = rdCap(rdOneIn(u)) + " is undecided"
      + (sf != null ? ", " + rdOneInShare(sf) + " might change their mind" : "")
      + firmestTail + ".";
    const moves = [["undecided", first], ["not firm", soft]].map(([nm, s]) => ({ nm, s, f: slopeOf(s) })).filter((m) => m.f);
    const movedSig = moves.filter((m) => m.f.p < 0.05 / moves.length);
    /* the dek is the movement verdict alone (user trim, 2026-09-28): the
       house range and latest-figure sentences it used to append were cut */
    const dek = !movedSig.length ? (moves.length > 1 ? "Neither share has" : "The share has") + " moved significantly since the 2025 election."
      : movedSig.map((m) => "The " + m.nm + " share has " + (m.f.b > 0 ? "risen" : "fallen") + " significantly since the 2025 election.").join(" ");
    return { head, dek };
  })();

  /* ---- all voters: of every 100 ---------------------------------------------- */
  const u = nowOf(first), sf = nowOf(soft);
  const und100 = Math.round(u), soft100 = Math.round(sf * (100 - u) / 100), firm100 = 100 - und100 - soft100;
  const moved = moves100 => moves100;
  const panel = (list, lo, hi, step, key, title, meta) => {
    const drawn = list.map((s) => ({ s, pts: filterPts(s.monthly, xDomain[0]), dots: s.polls.filter((d) => d.x >= xDomain[0] && d.x <= xDomain[1]) }))
      .filter((d) => d.pts.length >= 2);
    if (!drawn.length) return null;
    /* the board's tones: first preference in ink, after preferences a
       lighter grey (dashed), not firm between. Their polls wear the same
       tones, and after preferences' as open rings - six Essential readings
       carry that line, so they stay on show, but told apart */
    const COL = (s) => (s.id === "soft" ? "var(--ink-2)" : s.id === "tpp" ? "var(--ink-3)" : "var(--ink)");
    const outlier = key === "und" && first.latest && first.latest.v < lo + 2.5 ? first.polls.find((d) => d.released === first.latest.released && d.pollster === first.latest.firm) : null;
    return (
      <div className="card rd-card rd-un-panel" key={key}>
        <div className="rd-un-ptitle"><b>{title}</b><span>{meta}</span></div>
        {list.map((s) => (
          <div key={s.id} className="rd-un-read">
            <RdSwatch kind={s.dashed ? "dash" : "line"} color={COL(s)} />
            <div>
              <div className="rd-un-rtop"><b>{s.id === "soft" ? "Might still change" : s.label}</b><span className="rd-un-rv">{nowOf(s).toFixed(1)}%</span>{s.now && <span className="rd-un-rci">±{s.now.ci95.toFixed(1)}</span>}</div>
              <p>{s.id === "first" ? "Can’t say who they’d vote for. " : s.id === "tpp" ? "Won’t pick between Labor and the Coalition. " : "Named a party but say they could change their mind. "}{rdList(s.houses)}.</p>
            </div>
          </div>
        ))}
        <TrendChart key={"rd-un-" + key} heightPx={narrow ? 200 : 230} padPx={{ l: 36, r: 10, t: 14, b: 28 }}
          xDomain={xDomain} yDomain={[lo, hi]} yTicks={rdYTicks(lo, hi, step)} yTickFmt={(v) => (v === 0 ? "0" : v + "%")}
          xTicks={rdElectionTicks(xDomain[0], xDomain[1], narrow, base ? base.x : null)} baseline
          series={drawn.map((d) => ({ id: d.s.id, label: d.s.label, color: COL(d.s), rdWidth: 2, dashed: d.s.dashed, rdCap: 3.5, points: series(d.pts, "v") }))}
          spine={series(drawn[0].pts, "v")}
          scatter={drawn.flatMap((d) => d.dots.map((q) => ({ x: q.x, y: q.v, color: COL(d.s), hollow: d.s.id === "tpp", label: d.s.label, meta: q })))} pollFacet="twopp"
          notes={outlier ? [{ x: outlier.x, y: outlier.v, dy: -8, text: (+outlier.v.toFixed(1)) + "%, " + outlier.pollster + ", " + outlier.dateLabel, anchor: "end", size: 11 }] : []}
          tooltipTitle={(i) => { const p = drawn[0].pts[i]; return p ? monthLabelFull(p.ym) : ""; }}
          fmt={(v) => v.toFixed(1)}
          /* the readouts over the chart say which line is which; the copy
             leaves them behind, so its key says it, with the figures */
          copy={{ title: key === "und" ? "Undecided voters" : "Voters who might still change their mind",
                  sub: key === "und" ? "Share of all voters who can’t say who they’d vote for, month by month"
                    : "Share of voters naming a party who say they could still change their mind, month by month", caption: drawn.some((d) => d.s.id === "tpp")
                    ? "Each dot is one poll, open rings for after preferences; lines are monthly averages."
                    : "Each dot is one poll; lines are monthly averages.",
                  legend: drawn.map((d) => ({ label: (d.s.id === "soft" ? "Might still change" : d.s.label) + " " + nowOf(d.s).toFixed(1) + "%",
                                              color: COL(d.s), kind: d.s.dashed ? "dashed" : "line" })) }} />
      </div>
    );
  };
  const changeFoot = (() => {
    const bits = [first, tpp, soft].filter(Boolean).map((s) => {
      const c = s.now ? s.now.chg : null;
      const nm = s.id === "first" ? "first preference" : s.id === "tpp" ? "after preferences" : "not firm";
      return { nm, c, sig: s.now && s.now.changeSig };
    });
    const anySig = bits.some((b) => b.sig);
    return (anySig ? "Changes on the previous period: " : "None of the " + rdNumWord(bits.length) + " has changed significantly on the previous period: ")
      + bits.map((b) => b.nm + " " + (b.c == null ? "n/a" : Math.abs(b.c) < 0.05 ? "unchanged" : (b.c > 0 ? "+" : "−") + Math.abs(b.c).toFixed(1))).join(", ") + ". ± is the 95% margin.";
  })();

  /* ---- by party ---------------------------------------------------------------- */
  const partyView = F && (() => {
    const ids = ["onp", "alp", "lnp", "grn", "oth"].filter((k) => F.now[k] && F.base[k]).sort((a, b) => F.now[b].v - F.now[a].v);
    const apart = (a, b) => Math.abs(a.v - b.v) > Math.hypot(a.ci95, b.ci95);
    const rows = ids.map((k) => ({ id: k, label: k === "oth" ? "Others" : D.PARTIES[k].name, color: D.PARTIES[k].color, sw: true,
      now: F.now[k].v, base: F.base[k].v, ci: F.now[k].ci95, sig: apart(F.now[k], F.base[k]) }));
    const vals = rows.flatMap((r) => [r.now, r.base]).concat([F.now.all.v]);
    const lo = Math.floor((Math.min(...vals) - 3) / 10) * 10, hi = Math.ceil((Math.max(...vals) + 3) / 10) * 10;
    const sigRows = rows.filter((r) => r.sig);
    const allSig = apart(F.now.all, F.base.all);
    const note = "RedBridge asks voters how firm their choice is, a different question from Resolve’s in All voters, so the two views don’t compare directly. "
      + (!sigRows.length ? "Among the parties, no change is significant." : sigRows.length === 1 ? "Among the parties, only the " + (sigRows[0].id === "lnp" ? "Coalition" : sigRows[0].label) + "’s " + (sigRows[0].now < sigRows[0].base ? "fall" : "rise") + " is significant."
        : "Among the parties, " + rdList(sigRows.map((r) => r.label)) + " have changed significantly.")
      + (allSig ? " The share of all voters calling their vote solid has also " + (F.now.all.v < F.base.all.v ? "fallen" : "risen") + " significantly, from " + F.base.all.v.toFixed(1) + "% to " + F.now.all.v.toFixed(1) + "%." : "");
    const biggest = sigRows.slice().sort((a, b) => Math.abs(b.now - b.base) - Math.abs(a.now - a.base))[0];
    /* One Nation gets the tail whenever its swing is significant and the
       lead clause hasn't already said it */
    const onpRow = rows.find((r) => r.id === "onp");
    const onpTail = onpRow && onpRow.sig && biggest && biggest.id !== "onp" ? ", while One Nation voters have " + (onpRow.now < onpRow.base ? "softened" : "hardened") : "";
    const sub = biggest ? (biggest.id === "oth" ? "Minor-party voters" : biggest.label + " voters") + " " + (biggest.now < biggest.base ? "have softened" : "have firmed") + " since July 2025" + onpTail
      : "No party’s voters have softened significantly since July 2025";
    const rolled = F.waves.map((w, i) => {
      const ws = F.waves.slice(Math.max(0, i - F.pool + 1), i + 1);
      const r = { x: w.x, dateLabel: w.dateLabel };
      for (const k of ids.concat(["all"])) { const n = ws.reduce((a, v) => a + v.n[k], 0); r[k] = ws.reduce((a, v) => a + v.n[k] * v.solid[k], 0) / n; }
      return r;
    });
    const inX = (w) => w.x >= xDomain[0] && w.x <= xDomain[1];
    const waves = F.waves.filter(inX), lines = rolled.filter(inX);
    const smVals = waves.flatMap((w) => ids.map((k) => w.solid[k]));
    const sLo = Math.floor((Math.min(...smVals) - 2) / 20) * 20, sHi = Math.ceil((Math.max(...smVals) + 2) / 20) * 20;
    const monthOf = (lab) => lab;
    return { rows, lo, hi, note, sub, ids, waves, lines, sLo, sHi };
  })();

  /* ---- by age ---------------------------------------------------------------------- */
  const ageView = A && (() => {
    const B = [{ id: "18-34", label: "18–34" }, { id: "35-54", label: "35–54" }, { id: "55+", label: "55+" }];
    const grey = (i) => ["color-mix(in oklab, var(--ink) 50%, var(--bg))", "color-mix(in oklab, var(--ink) 72%, var(--bg))", "var(--ink)"][i];
    const apart = (a, b) => Math.abs(a.v - b.v) > Math.hypot(a.ci95, b.ci95);
    const allNow = soft ? nowOf(soft) : null;
    const rows = B.map((b, i) => ({ id: b.id, label: b.label, color: grey(i), now: A.now[b.id].v, base: A.base[b.id].v, ci: A.now[b.id].ci95, sig: apart(A.now[b.id], A.base[b.id]) }));
    const vals = rows.flatMap((r) => [r.now, r.base]).concat(allNow != null ? [allNow] : []);
    const lo = Math.max(0, Math.floor((Math.min(...vals) - 3) / 10) * 10), hi = Math.ceil((Math.max(...vals) + 3) / 10) * 10;
    const young = A.now["18-34"], old = A.now["55+"];
    const gapSig = apart(young, old);
    const anyChg = rows.filter((r) => r.sig);
    const note = "Resolve doesn’t publish how many people it asked in each age group, so each group is weighted by its share of adults (2021 Census). "
      + (gapSig ? "The gap between 18–34s and over-55s is significant; " : "The gap between 18–34s and over-55s is not significant; ")
      + (anyChg.length ? rdList(anyChg.map((r) => r.label + "s")) + "’ change is significant." : "no group’s change is.");
    const least = rows.slice().sort((a, b) => b.now - a.now)[0];
    const sub = least.id === "18-34" && gapSig ? "Young voters are the least firm" : least.id === "55+" && gapSig ? "Older voters are the least firm" : "No age group is clearly less firm than the others";
    const rolled = A.waves.map((w, i) => {
      const ws = A.waves.slice(Math.max(0, i - A.pool + 1), i + 1);
      const r = { x: w.x, dateLabel: w.dateLabel };
      for (const b of B) { const n = ws.reduce((a, v) => a + v.n[b.id], 0); r[b.id] = ws.reduce((a, v) => a + v.n[b.id] * v.soft[b.id], 0) / n; }
      return r;
    });
    const inX = (w) => w.x >= xDomain[0] && w.x <= xDomain[1];
    return { B, grey, rows, lo, hi, note, sub, allNow, waves: A.waves.filter(inX), lines: rolled.filter(inX) };
  })();
  const monthsLabel = (from, to) => from + " → " + to;

  /* the all-voters trend battery behind the dek: one within-house slope per
     series (the dek only sentences undecided and firmness), Holm across
     whatever has a fit; the fold-out lists every series, fit or not */
  const unSig = (() => {
    const ss = [first, tpp, soft].filter(Boolean).map((s) => ({ s, pts: s.monthly ? filterPts(s.monthly, xDomain[0]) : [], fit: slopeOf(s) }));
    const ok = ss.filter((x) => x.fit), won = [];
    for (const [i, f] of [...ok].sort((a, b) => a.fit.p - b.fit.p).entries()) {
      if (f.fit.p >= 0.05 / (ok.length - i)) break;
      won.push(f.s.id);
    }
    return ss.map((x) => ({ ...x, sig: won.includes(x.s.id) }));
  })();

  const views = [{ id: "all", label: "All voters" }].concat(F ? [{ id: "party", label: "By party" }] : [], A ? [{ id: "age", label: "By age" }] : []);
  /* The views are pages of their own, so the row walks them by arrow keys
     and, on a phone, by a sideways swipe on or just under it (without
     swipe the gesture turns the page instead). Scrolled past the head and
     dek, a walk holds the row's spot through the view switch the same way
     the cycles and panels rows do (rdPinScroll). */
  const pinUn = () => {
    const sec = document.getElementById("undecided");
    rdPinScroll(sec && sec.querySelector(".rd-un-tabs"));
  };
  const pickView = (id) => { pinUn(); setView(id); };
  return (
    <RdSec id="undecided" cls="rd-un" title="Decidedness" meta={rdList(U.houses) + ", since the 2025 election"}>
      {story && <RdHed head={story.head} dek={story.dek} />}
      <RdTabs swipe value={view} onChange={pickView} options={views} ariaLabel="Decidedness among" className="rd-un-tabs" />
      {/* each view is its own measure from its own pollsters: a switch
          crossfades them (RdCrossfade) */}
      <RdCrossfade k={view}>
      {view === "all" && (
        <>
          <div className="card rd-card rd-un-100">
            <div className="rd-un-100h"><b>Of every 100 voters</b><span className="rd-un-100b" style={{ width: (soft100 + und100) + "%" }}>About {soft100 + und100} in 100 could still move</span></div>
            {/* a phone keys the bar underneath, as the canvas drew it: a
                four-point segment has no room for its number or its name */}
            {!narrow && (
              <div className="rd-un-100l">
                <span style={{ flexBasis: firm100 + "%" }}><b>Firm</b> named a party and don’t expect to change</span>
                <span style={{ flexBasis: soft100 + "%" }}><b>Not firm</b> <span className="rd-un-long">might still change</span></span>
                <span style={{ flexBasis: und100 + "%" }} className="rd-un-und"><b>Undecided</b></span>
              </div>
            )}
            <div className="rd-un-bar" role="img" aria-label={`Of every 100 voters, about ${firm100} are firm, ${soft100} not firm and ${und100} undecided`}>
              <span className="rd-un-f" style={{ flexBasis: firm100 + "%" }}>{narrow ? "" : firm100}</span>
              <span className="rd-un-s" style={{ flexBasis: soft100 + "%" }}>{narrow ? "" : soft100}</span>
              <span className="rd-un-u" style={{ flexBasis: und100 + "%" }}>{narrow ? "" : und100}</span>
            </div>
            {narrow && (
              <div className="rd-un-key" aria-hidden="true">
                {[["f", firm100, "Firm:", "named a party and don’t expect to change"],
                  ["s", soft100, "Not firm:", "named a party but might change"],
                  ["u", und100, "Undecided:", "can’t say who they’d vote for"]].map(([k, n, b, t]) => (
                  <div key={k}><span className={"rd-un-sw rd-un-" + k}></span><b className="rd-un-kn">{n}</b><span><b>{b}</b> {t}</span></div>
                ))}
              </div>
            )}
            <p className="rd-note">Approximate: combines {rdList(first.houses)}’s undecided share ({u.toFixed(1)}%) with {rdList(soft.houses)}’s firmness question ({Math.round(sf)}% of those who named a party). Pollsters ask these questions differently.</p>
          </div>
          <RdSub head={(() => { const m = [slopeOf(first), slopeOf(soft)].filter(Boolean); return m.every((f) => f.p >= 0.05 / m.length) ? "Steady since the election" : "Moving since the election"; })()}
                 dek="Each dot is one poll, open rings for after preferences; lines are monthly averages. Undecided voters are counted out of all voters and firmness out of those who named a party, so the two panels have different scales." />
          <div className="rd-un-panels">
            {panel([first, tpp].filter(Boolean), 0, 10, 5, "und", "Undecided", "% of all voters")}
            {soft && panel([soft], 0, 40, 10, "soft", "Not firm", "% of voters who named a party")}
          </div>
          <RdTsig summary="Trend-significance table"
            heads={["Series", "Monthly line, first → last, %", "Slope, pts/yr", "t", "Significant"]}
            sets={[{ key: "main", rows: unSig.map((x) => ({
              key: x.s.id, name: x.s.id === "tpp" ? "After preferences" : x.s.id === "soft" ? "Not firm" : "Undecided", sig: x.sig,
              cells: [x.pts.length >= 2 ? rdTsSgn(x.pts[0].v) + " → " + rdTsSgn(x.pts[x.pts.length - 1].v) : "–",
                x.fit ? rdTsSgn(x.fit.b, true) : "–", x.fit ? rdTsSgn(x.fit.t) : "–", x.sig ? "Yes" : "No"],
            })) }]}
            note={"One trend test per series: a shared slope through each pollster’s own polls (a level per pollster, each poll weighted by its sample), Holm’s correction across the series. Yes means the slope clears 95% since the 2025 election; the dek above reads the same tests. Undecided counts all voters, “Might still change” those who named a party, so the two panels’ figures sit on different scales."}
          />
          <RdFoot how={{ term: "undecided", from: "Decidedness" }}>{changeFoot}</RdFoot>
        </>
      )}
      {view === "party" && partyView && (
        <>
          <div className="card rd-card rd-un-sp">
            <RdShiftPlot rows={partyView.rows} all={F.now.all.v} lo={partyView.lo} hi={partyView.hi}
                         title="Share who call their vote solid" source={"RedBridge, mid-2025 → now"} />
            <RdKey className="rd-ckey" items={[{ kind: "dot-open", color: "var(--ink-3)", label: "Mid-2025 (" + F.base.from + " to " + F.base.to + ")" },
                                                { kind: "dot-solid", color: "var(--ink-3)", label: "Now (" + F.now.from + " to " + F.now.to + ")" }]}>
              <span className="rd-key-item" style={{ color: "var(--ink-3)" }}>Change in bold: significant</span>
            </RdKey>
            <p className="rd-note">{partyView.note}</p>
            {/* the battery behind the plot's bold deltas: each party's start-
                to-now move, its z on the pooled margins, and the same apart-
                test the bolding uses; the all-voters row is the anchor */}
            <RdTsig summary="Significance table"
              heads={["Party’s voters", "Solid, mid-2025 → now, %", "Change, pts", "All voters’ change, pts", "Change vs all voters, pts", "z", "Significant"]}
              sets={[{ key: "main", rows: partyView.ids.concat(["all"]).map((k) => {
                const b = F.base[k], n = F.now[k], chg = n.v - b.v, allChg = F.now.all.v - F.base.all.v;
                const z = chg / (Math.hypot(n.ci95, b.ci95) / 1.96), sg = Math.abs(n.v - b.v) > Math.hypot(n.ci95, b.ci95);
                return { key: k, name: k === "all" ? "All voters" : k === "oth" ? "Others" : D.PARTIES[k].name, sig: sg,
                  cells: [rdTsSgn(b.v) + " → " + rdTsSgn(n.v), rdTsSgn(chg, true), rdTsSgn(allChg, true),
                    k === "all" ? "–" : rdTsSgn(chg - allChg, true), rdTsSgn(z), sg ? "Yes" : "No"] };
              }) }]}
              note={"Shares are RedBridge’s solid-vote figures, pooled in the card’s “mid-2025” and “now” windows. z measures the change against the two windows’ pooled 95% margins; Yes is a bold change on the plot above — a move the margins can’t explain. “Change vs all voters” shows how far the party’s own move parts company with the electorate’s."}
            />
          </div>
          <RdSub head={partyView.sub} dek="Share of each party’s voters calling their vote solid, pooled three RedBridge waves at a time; dots are single waves. The dashed line is all voters." />
          <div className="rd-sm-grid rd-un-sm">
            {partyView.ids.map((k) => (
              <div key={k} className="card rd-card rd-sm">
                <div className="rd-sm-top"><span style={{ color: inkOf(D.PARTIES[k].color) }}>{k === "oth" ? "Others" : D.PARTIES[k].name}</span><b>{F.now[k].v.toFixed(1)}%</b></div>
                <TrendChart key={"rd-firm-" + k} heightPx={narrow ? 120 : 140} padPx={{ l: 30, r: 6, t: 10, b: 24 }}
                  xDomain={xDomain} yDomain={[partyView.sLo, partyView.sHi]} yTicks={rdYTicks(partyView.sLo, partyView.sHi, 20)}
                  yTickFmt={(v) => v + "%"} xTicks={rdElectionTicks(xDomain[0], xDomain[1], true, base ? base.x : null)} baseline
                  series={[{ id: "all", label: "All voters", color: "var(--ink)", dashed: true, dash: "4 3", rdWidth: 1.2, endCap: false, points: partyView.lines.map((w) => ({ x: w.x, y: w.all })) },
                           { id: k, label: D.PARTIES[k].name, color: D.PARTIES[k].color, rdWidth: 2.2, rdCap: 3.5, points: partyView.lines.map((w) => ({ x: w.x, y: w[k] })) }]}
                  spine={partyView.lines.map((w) => ({ x: w.x, y: w[k] }))}
                  scatter={partyView.waves.map((w) => ({ x: w.x, y: w.solid[k], color: D.PARTIES[k].color, label: D.PARTIES[k].name, meta: w }))} pollFacet="twopp"
                  tooltipTitle={(i) => (partyView.lines[i] ? partyView.lines[i].dateLabel : "")} fmt={(v) => v.toFixed(0)}
                  /* the dashed line is keyed only in the sub-head over the grid */
                  copy={{ title: (k === "oth" ? "Others" : D.PARTIES[k].name) + " voters calling their vote solid", sub: "Share of the party’s voters who say their vote is solid, pooled three RedBridge waves at a time, against all voters",
                          caption: "Dots are single waves.",
                          legend: [{ label: (k === "oth" ? "Others" : D.PARTIES[k].name) + " voters " + F.now[k].v.toFixed(1) + "%", color: D.PARTIES[k].color, kind: "line" },
                                   { label: "All voters " + F.now.all.v.toFixed(1) + "%", color: "var(--ink)", kind: "dashed" }] }} />
              </div>
            ))}
          </div>
          <RdFoot how={{ term: "undecided", from: "Decidedness" }}>Figures pool three waves at a time. Two figures differ significantly when the gap between them is larger than their two margins combined.</RdFoot>
        </>
      )}
      {view === "age" && ageView && (
        <>
          <div className="card rd-card rd-un-sp">
            <RdShiftPlot rows={ageView.rows} all={ageView.allNow} lo={ageView.lo} hi={ageView.hi}
                         title="Share not firm, by age" source="Resolve, mid-2025 → now" dp={0} />
            <RdKey className="rd-ckey" items={[{ kind: "dot-open", color: "var(--ink-3)", label: "Mid-2025 (" + A.base.from + " to " + A.base.to + ")" },
                                                { kind: "dot-solid", color: "var(--ink-3)", label: "Now (" + A.now.from + " to " + A.now.to + ")" }]}>
              <span className="rd-key-item" style={{ color: "var(--ink-3)" }}>Change in bold: significant</span>
            </RdKey>
            <p className="rd-note">{ageView.note}</p>
            {/* same battery as the by-party card's: each band's start-to-now
                move and its z on the pooled margins; there's no all-voters
                Resolve not-firm reading over the span, so no anchor column */}
            <RdTsig summary="Significance table"
              heads={["Age group", "Not firm, mid-2025 → now, %", "Change, pts", "z", "Significant"]}
              sets={[{ key: "main", rows: ageView.B.map((b) => {
                const bb = A.base[b.id], nn = A.now[b.id], chg = nn.v - bb.v;
                const z = chg / (Math.hypot(nn.ci95, bb.ci95) / 1.96), sg = Math.abs(nn.v - bb.v) > Math.hypot(nn.ci95, bb.ci95);
                return { key: b.id, name: b.label, sig: sg,
                  cells: [rdTsSgn(bb.v) + " → " + rdTsSgn(nn.v), rdTsSgn(chg, true), rdTsSgn(z), sg ? "Yes" : "No"] };
              }) }]}
              note={"Shares are Resolve’s not-firm figures, pooled in the card’s “mid-2025” and “now” windows, each group weighted by its share of adults (2021 Census). z measures the change against the two windows’ pooled 95% margins; Yes is a bold change on the plot above."}
            />
          </div>
          <RdSub head={ageView.sub} dek="Share of each age group who named a party but aren’t firm, pooled three Resolve waves at a time; dots are single waves. The dashed line is all voters." />
          <div className="card rd-card rd-un-age">
            <TrendChart key="rd-soft-age" heightPx={narrow ? 240 : 250} padPx={narrow ? { l: 34, r: 8, t: 14, b: 28 } : { l: 40, r: 12, t: 14, b: 30 }}
              xDomain={xDomain} yDomain={[0, 40]} yTicks={rdYTicks(0, 40, 10)} yTickFmt={(v) => (v === 0 ? "0" : v + "%")}
              xTicks={rdElectionTicks(xDomain[0], xDomain[1], narrow, base ? base.x : null)} baseline
              series={[{ id: "all", label: "All voters", color: "var(--ink)", dashed: true, dash: "4 3", rdWidth: 1.4, endCap: false,
                         points: soft ? filterPts(soft.monthly, xDomain[0]).map((m) => ({ x: m.x, y: m.v })) : [], endLabel: narrow ? null : "All voters" },
                       ...ageView.B.map((b, i) => ({ id: b.id, label: b.label, color: ageView.grey(i), rdWidth: 2.2, rdCap: 3.5,
                         points: ageView.lines.map((w) => ({ x: w.x, y: w[b.id] })), endLabel: narrow ? null : b.label }))]}
              spine={ageView.lines.map((w) => ({ x: w.x, y: w["18-34"] }))}
              scatter={ageView.waves.flatMap((w) => ageView.B.map((b, i) => ({ x: w.x, y: w.soft[b.id], color: ageView.grey(i), label: b.label, meta: w })))} pollFacet="twopp"
              tooltipTitle={(i) => (ageView.lines[i] ? ageView.lines[i].dateLabel : "")} fmt={(v) => v.toFixed(0)}
              /* a phone names none of these greys on the chart, so the copy
                 keys them, and carries the sub-head's words about the pooling */
              copy={{ title: "Voters not firm, by age", sub: "Share of each age group who named a party but aren’t firm",
                      caption: "Pooled three Resolve waves at a time; dots are single waves.",
                      legend: ageView.B.map((b, i) => ({ label: b.label, color: ageView.grey(i), kind: "line" }))
                        .concat([{ label: "All voters", color: "var(--ink)", kind: "dashed" }]) }} />
          </div>
          <RdFoot how={{ term: "undecided", from: "Decidedness" }}>Figures pool three waves at a time. Two figures differ significantly when the gap between them is larger than their two margins combined.</RdFoot>
        </>
      )}
      </RdCrossfade>
    </RdSec>
  );
}

/* ------------------------------------------------ Economic confidence --
   Four published gauges of business and consumer confidence in TWO views
   on one card, switched by the tabs above it — Consumers (the weekly
   ANZ–Roy Morgan index with Westpac–MI's monthly sentiment joining it)
   opens first, and Businesses (Roy Morgan's monthly index with the NAB
   survey joining it) — each drawn as published from the 2025 election
   on. Each
   dot is the published reading; each line is a recency-weighted smooth
   of those readings
   (half-life 14 days on the weekly index, 60 days on the monthly ones),
   so release-to-release noise reads as trend while every quoted figure
   stays the raw print. The first three are 100-neutral indices; NAB
   prints a NET BALANCE (0 = neutral) and its line is drawn +100 so the
   shared neutral line holds — the read rows and tooltips print NAB's own
   figures off each point's `raw`. Colour splits each view's pair — the
   Roy Morgan gauge plum, the other house's deep gold, both full lines
   (a dash marked the second gauge until 2026-10-08; colour took the
   job over). NAB's conditions reading rides the read row, not a fifth
   line. No aggregation, no house effects — context, not a predictor.
   The bottom axis counts MONTHS since the election, not calendar years,
   and the view's main gauge carries its own past terms behind the
   current one — gen-data §5k lines every term up on its own election
   month and pools them into a band (the middle half and middle 80% of
   past terms, their average the dashed line, exactly as the past-cycles
   charts pool past terms; "Draw a past term" lifts any one out as its
   own line). The footer's "Source data, CSV" downloads every release
   and every past-term reading.
   Data: data/confidence.json + data/confidence-history.json → gen-data
   §5j/§5k → D.confidence / D.confHistory.
*/
/* The CSV plumbing of the archive asset, again: each module is its own
   <script>, so the tabbed views' copies are private to it and a
   page-level const can't be declared twice. Names carry a conf- prefix
   for that reason. */
const confCsvCell = (v) => {
  if (v == null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
const confCsvText = (rows) => "﻿" + rows.map((r) => r.map(confCsvCell).join(",")).join("\r\n");
const confDownloadCsv = (filename, rows) => {
  const blob = new Blob([confCsvText(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
/* series display names for the download */
const CONF_SHEET = {
  consumer: "ANZ–Roy Morgan Consumer Confidence",
  westpacConsumer: "Westpac–MI Consumer Sentiment",
  business: "Roy Morgan Business Confidence",
  nabBusiness: "NAB Monthly Business Survey (net balance)",
};
const confYmIdx = (ym) => +ym.slice(0, 4) * 12 + (+ym.slice(5, 7) - 1);
const confYmOf = (i) => Math.floor(i / 12) + "-" + String((i % 12) + 1).padStart(2, "0");
const RD_CONF_VIEWS = [{ id: "consumer", label: "Consumers" }, { id: "business", label: "Businesses" }];
function RdConfidence({ rangeId }) {
  const { D, monthLabelFull } = window.AP;
  const narrow = useNarrow(MQ_PHONE);
  const M = D.confidence;
  if (!M || !M.consumer || !M.business || !M.consumer.polls.length || !M.business.polls.length) return null;
  const NICE = (v) => (v < 0 ? "−" : "") + (Number.isInteger(Math.abs(v)) ? String(Math.abs(v)) : Math.abs(v).toFixed(1));
  const lanes = [
    { k: "consumer", view: "consumer", s: M.consumer, name: "Consumers", dekName: "Consumers", by: "ANZ–Roy Morgan", hl: 14,
      period: "week", color: "var(--confidence-main)", dash: null, shift: 0, vfmt: (v) => v.toFixed(1),
      short: "Consumer confidence — who feels optimistic about their finances and the economy. Weekly." },
    { k: "westpacConsumer", view: "consumer", s: M.westpacConsumer, name: "Consumers", dekName: "Consumers on Westpac–MI’s read", by: "Westpac–MI", hl: 60,
      period: "month", color: "var(--confidence-alt)", dash: null, shift: 0, vfmt: (v) => v.toFixed(1),
      short: "The Westpac–Melbourne Institute’s monthly gauge of the same household confidence; 100 is neutral on this scale too." },
    { k: "business", view: "business", s: M.business, name: "Businesses", dekName: "Businesses", by: "Roy Morgan", hl: 60,
      period: "month", color: "var(--confidence-main)", dash: null, shift: 0, vfmt: (v) => v.toFixed(1),
      short: "Business confidence — how firms rate trading conditions and the year ahead. Monthly." },
    { k: "nabBusiness", view: "business", s: M.nabBusiness, name: "Businesses", dekName: "Businesses on NAB’s survey", by: "NAB", hl: 60,
      period: "month", color: "var(--confidence-alt)", dash: null, shift: 100, vfmt: NICE,
      short: "x" },
  ].filter((l) => l.s && l.s.polls.length);
  if (!lanes.length) return null;
  for (const l of lanes) l.lat = l.s.latest;
  /* the tabs over the chart open on the consumer pair; each view draws
     only its own lanes, dots and domain */
  const [view, setView] = useState("consumer");
  /* hovering the panel hands the arrow keys to the Consumers/Businesses
     row (the claim never survives the pointer leaving the card), pinned
     through the crossfade exactly as the row's own pin does */
  useHoverClaim("confidence", true, null, (e) => {
    const ids = RD_CONF_VIEWS.map((v) => v.id);
    const i = ids.indexOf(view);
    if (i < 0 || ids.length < 2) return false;
    const nxt = ids[(i + (e.key === "ArrowRight" ? 1 : -1) + ids.length) % ids.length];
    rdPinScroll(document.getElementById("confidence") && document.getElementById("confidence").querySelector(".rd-confidence-tabs"));
    setView(nxt);
    return true;
  }, [view]);
  const viewLanes = lanes.filter((l) => l.view === view);
  /* 'Show complete history' swaps the months-into-term ruler for the
     calendar: the window widens to each lane's full published run (gen-data
     §5l's D.confDeep payload), the live dots and smooth re-run over the
     lane's WHOLE release file instead of the elected-term window, and the
     deep monthly rows draw as a lighter line joining the tail into the
     past. NAB's deep net-balance series joins from Mar 1997 (§5l); only
     NAB's conditions DEVIATION stays on disk — another basis. */
  const [hist, setHist] = useState(false);
  const deepPoints = new Map((D.confDeep ? viewLanes.filter((l) => (D.confDeep[l.k] || []).length > 1) : []).map((l) => {
    const live0 = l.s.polls[0].x;
    return [l.k, D.confDeep[l.k]
      .map((r) => ({ ym: r.ym, x: +r.ym.slice(0, 4) + (+r.ym.slice(5, 7) - 1) / 12, y: r.v + l.shift }))
      .filter((p) => p.x < live0)];
  }));
  const deepDrawn = [...deepPoints.keys()].filter((k) => deepPoints.get(k).length > 1);
  const histOn = hist && deepDrawn.length > 0;
  // Symmetric half-life kernel over the raw readings (x units are years).
  // Evaluated at each reading's date; week-to-week sampling noise on the
  // weekly consumer index is ~2pts, so two weeks of half-life is enough
  // to clear it without rounding off real turns (COVID, budget shocks).
  const smooth = (polls, halfLifeDays) => {
    const decay = Math.LN2 / (halfLifeDays / 365.25);
    return polls.map((p) => {
      let wsum = 0, wtot = 0;
      for (const q of polls) {
        const w = Math.exp(-decay * Math.abs(q.x - p.x));
        if (w < 0.02) continue;
        wsum += w;
        wtot += w * q.v;
      }
      return { x: p.x, y: wtot / wsum };
    });
  };
  const neut = (l) => 100 - l.shift;   // the published-scale reading that sits on the 100 line
  const water = (l, v) => v < neut(l) ? "pessimists lead" : "optimists lead";
  const nab = lanes.find((l) => l.k === "nabBusiness");
  if (nab) nab.short = "Business confidence as a net balance — optimistic firms minus pessimistic ones, 0 = neutral on NAB’s own scale. The line is drawn 100 points up so the neutral line is shared; the figure here is NAB’s own. Conditions printed "
    + NICE(nab.lat.cond) + (nab.lat.condChg == null ? "" : ", " + (nab.lat.condChg < 0 ? "down " : "up ") + NICE(Math.abs(nab.lat.condChg))) + " on the month. " + water(nab, nab.lat.v) + ".";
  const side = (nm) => {
    const ls = lanes.filter((l) => l.name === nm);
    if (!ls.length) return null;
    return ls.every((l) => l.lat.v < neut(l)) ? "under" : ls.every((l) => l.lat.v >= neut(l)) ? "above" : "split";
  };
  const cSide = side("Consumers"), bSide = side("Businesses");
  const head = cSide === "under" && bSide === "under" ? "Confidence is underwater on both counts."
    : cSide === "above" && bSide === "above" ? "Confidence is above water on both counts."
    : cSide === "under" && bSide === "above" ? "Consumers are underwater; businesses aren’t."
    : cSide === "above" && bSide === "under" ? "Businesses are underwater; consumers aren’t."
    : "The gauges disagree on which side of the line confidence sits.";
  const trough = (polls) => {
    const lo = polls.reduce((m, p) => (p.v < m.v ? p : m), polls[0]);
    const hi = polls.reduce((m, p) => (p.v > m.v ? p : m), polls[0]);
    return { lo, hi };
  };
  const sent = (l) => {
    let t = l.dekName + " at " + l.vfmt(l.lat.v)
      + (l.lat.chg == null ? "" : Math.abs(l.lat.chg) < 0.05 ? ", holding steady"
        : ", " + (l.lat.chg < 0 ? "down " : "up ") + NICE(Math.abs(l.lat.chg)) + " on the " + l.period);
    const { lo, hi } = trough(rows.get(l.k));
    if (Math.abs(l.lat.v - lo.v) <= 2.5) t += ", not far off its low of " + l.vfmt(lo.v) + " in " + monthLabelFull(lo.ym);
    else if (Math.abs(l.lat.v - hi.v) <= 2.5) t += ", close to its high of " + l.vfmt(hi.v) + " in " + monthLabelFull(hi.ym);
    if (l.k === "nabBusiness" && l.lat.cond != null) t += " (conditions " + NICE(l.lat.cond) + ")";
    return t + ".";
  };
  /* The axis counts MONTHS since the 3 May 2025 election - 122 days
     fall before that date in 2025, so its year-fraction x is
     2025 + 122/365, the same counting gen-data's dx uses, and everything
     drawn is converted with toM. Pre-election history stays in the
     payload, off-screen (the past terms come from confHistory instead);
     the dek's high/low reads are windowed with x0. */
  const x0 = 2025 + 122 / 365;
  const x1 = D.domain.x1;
  const toM = (x) => (x - x0) * 12;
  const nowM = toM(x1);
  /* the band and any drawn past term run to month 36, so the window
     holds the whole ruler even while the sitting term is younger */
  const xMax = Math.max(36, Math.ceil(nowM)) + 0.6;
  /* the numbered events: the hero's set over this chart's window, less the
     party-politics changes of hand (both Coalition splits, Joyce to One
     Nation, Taylor's leadership) - the economy's events stay: the Hormuz
     blockade, the 2026 budget and the RBA's September hike all moved one
     or more of these gauges */
  const CONF_OFF = ["2025-05-28", "2025-12-08", "2026-01-22", "2026-02-12"];
  const evs = rdChartEvents(D.events, x0, x1).filter((e) => !CONF_OFF.includes(e.date))
    .map((e) => ({ ...e, x: toM(e.x) }));
  const badges = !histOn && narrow ? rdEventBadges("confidence", evs, 0, xMax) : null;
  /* the phone list under the chart opens an event's panel by tapping its
     number; a tap on another number hands the panel over, and an event that
     leaves the window is put away by the chart's own reconciliation */
  const [evtOpen, setEvtOpen] = useState(null);
  const pickEv = (e) => { setEvtOpen((cur) => (cur && cur.e === e ? cur : { e })); rdEventReveal("evt-a-" + e.badgeKey); };
  const rows = new Map(lanes.map((l) => [l.k, l.s.polls.filter((p) => p.x >= x0)]));
  const dek = lanes.map(sent).join(" ");
  /* The dots, spine and domain ride the raw prints; the series lines are
     the kernel smooth of the same readings. The NAB display shift is a
     constant, so smoothing then shifting equals shifting and smoothing —
     the smooth runs on the printed figures themselves. Only the view's
     own lanes price the domain, so the two views fit their own ranges. */
  const rawPoints = new Map(viewLanes.map((l) => [l.k, rows.get(l.k).map((p) => ({ x: toM(p.x), y: p.v + l.shift, ym: p.ym, released: p.released, ...(l.shift ? { raw: p.v } : {}) }))]));
  const sePoints = new Map(viewLanes.map((l) => [l.k, smooth(rows.get(l.k), l.hl).map((p, i) => ({ x: toM(p.x), y: p.y + l.shift, ym: rows.get(l.k)[i].ym, ...(l.shift ? { raw: rows.get(l.k)[i].v } : {}) }))]));
  /* The complete-history window draws on the calendar, in the release
     file's own year-fraction x (no toM re-base): the same dots and kernel
     over every release the house has printed, with the deep monthly rows
     as a lighter line underneath where they reach further back */
  const wideRaw = histOn ? new Map(viewLanes.map((l) => [l.k, l.s.polls.map((p) => ({ x: p.x, y: p.v + l.shift, ym: p.ym, released: p.released, ...(l.shift ? { raw: p.v } : {}) }))])) : null;
  const wideSe = histOn ? new Map(viewLanes.map((l) => [l.k, smooth(l.s.polls, l.hl).map((p, i) => ({ x: p.x, y: p.y + l.shift, ym: l.s.polls[i].ym, ...(l.shift ? { raw: l.s.polls[i].v } : {}) }))])) : null;
  const deepSeries = histOn ? deepDrawn.map((k) => {
    const l = viewLanes.find((v) => v.k === k);
    return { id: "deep-" + k, label: l.by + " (monthly history)", color: l.color,
      rdWidth: 1.3, opacity: 0.5, dash: l.dash || undefined, smooth: false, endCap: false,
      /* quarterly early readings on a monthly spine: hold the row and the
         marker on the line between its own prints, or the readout flickers
         on and off mid-sweep (interpHover, the engine's opt-in) */
      interpHover: true, points: deepPoints.get(k) };
  }) : [];
  const histX0 = histOn ? Math.floor(Math.min(...deepDrawn.map((k) => deepPoints.get(k)[0].x))) : 0;
  const histTicks = histOn ? (() => {
    const step = narrow ? 10 : 5, t = [];
    for (let y = Math.ceil(histX0 / step) * step; y < D.domain.x1 - 0.9; y += step) t.push({ x: y, label: String(y) });
    return t;
  })() : null;
  /* ---- past terms: the band, its average, and the drawn lines --------
     A straight lift of the past-cycles ribbon (its comment stands at the
     top of the file's History section): the middle half fills heavy, the
     middle 80% fills light, stretches built from fewer than three-quarters
     of the terms go fainter by class, and each term can be drawn as its
     own line. Only the view's MAIN gauge carries a past-terms panel –
     §5k ships consumer history for the consumer view, business for the
     business one (NAB 1997- but a deviation series - never banded).
     Westpac–MI's 1974- file never bands either, but its terms ship so a
     drawn consumer term carries Westpac–MI's same year as a dotted
     gold twin (and its calendar file stays §5l's history underlay). */
  const HIST = D.confHistory || null;
  const histLane = view === "consumer" ? "consumer" : "business";
  const hband = HIST && HIST[histLane] && HIST[histLane].band.length ? HIST[histLane] : null;
  const histTerms = hband ? hband.terms : [];
  /* the other house's past terms ride a drawn term as a DOTTED twin in
     their own lane colour (consumer view only: §5k ships westpacConsumer
     bandless; NAB's deep series is another measure, so the business view
     never has a twin to draw) */
  const altTerms = (() => {
    const h = view === "consumer" && HIST ? HIST.westpacConsumer : null;
    return h && Array.isArray(h.terms) && h.terms.length ? h.terms : null;
  })();
  /* which past terms are lifted out of the band, per view: a lift on the
     consumer view never reads as a phantom pill on the business one */
  const [liftedBy, setLiftedBy] = useState({ consumer: new Set(), business: new Set() });
  const lifted = liftedBy[histLane];
  const lift = (yr) => setLiftedBy((s) => {
    const n = new Set(s[histLane]);
    n.has(yr) ? n.delete(yr) : n.add(yr);
    return { ...s, [histLane]: n };
  });
  let bandAreas = null;
  if (hband) {
    const floor = Math.max(3, Math.ceil(histTerms.length * 0.75));
    const segs = [];
    hband.band.forEach((r, i) => {
      const thin = r.n < floor;
      const last = segs[segs.length - 1];
      if (!last || last.thin !== thin) segs.push({ thin, pts: i ? [hband.band[i - 1], r] : [r] });
      else last.pts.push(r);
    });
    /* the weight lives in rd.css (.conf-band), not the inline fallbacks
       below, so the fills carry a heavier tint in dark; a thinned stretch
       asks by CLASS, exactly as the cycles band does */
    bandAreas = segs.filter((s) => s.pts.length > 1).flatMap((s, i) => [
      { id: "conf-band-lo" + i, className: "conf-band lo" + (s.thin ? " thin" : ""),
        color: "var(--ink-3)", opacity: 0.07, edge: false,
        points: s.pts.map((r) => ({ x: r.m, y0: r.p10, y1: r.p90 })) },
      { id: "conf-band-hi" + i, className: "conf-band hi" + (s.thin ? " thin" : ""),
        color: "var(--ink-3)", opacity: 0.13, edge: false,
        points: s.pts.map((r) => ({ x: r.m, y0: r.q1, y1: r.q3 })) },
    ]);
  }
  const meanSeries = hband ? {
    id: "conf-band-mean", label: "Mean of past terms", color: "var(--ink-2)",
    rdWidth: 1.9, opacity: 0.85, dash: "2 3.4", smooth: false, endCap: false,
    interpHover: true, points: hband.band.map((r) => ({ x: r.m, y: r.mean })),
  } : null;
  /* a lifted term renders exactly as the current lines do - its monthly
     term file through the same kernel smooth (TERM_HL, the monthly
     gauges' half-life: term rows are monthly reads, never the weekly
     index's 14-day one), then the engine's monotone path - and DOTTED,
     every lifted line regardless of view or gauge, in its house's
     colour (--confidence-main for the view's main gauge, --confidence-alt
     for the Westpac–MI twin), so a drawn past term never reads as the
     live current term. The twin never asks for the end label - the
     year names the pair once. */
  const TERM_HL = 60;
  const drawnSeries = histTerms.filter((t) => lifted.has(t.year)).flatMap((t) => {
    const pts = (term) => {
      const raw = [];
      term.v.forEach((v, m) => { if (v != null) raw.push({ x: m / 12, v }); });
      return smooth(raw, TERM_HL).map((p) => ({ x: p.x * 12, y: p.y })).filter((p) => p.x <= xMax);
    };
    const twin = altTerms && altTerms.find((a) => a.year === t.year);
    return [{
      id: "conf-term-" + t.year, color: "var(--confidence-main)",
      label: "The " + t.year + " term" + (twin ? " · ANZ–Roy Morgan" : ""),
      rdWidth: 1.7, opacity: 0.9, endCap: false, dash: "0.1 3.6",
      endLabel: narrow ? null : String(t.year),
      interpHover: true,
      points: pts(t),
    }].concat(twin ? [{
      id: "conf-term-" + t.year + "-alt", color: "var(--confidence-alt)",
      label: "The " + t.year + " term · Westpac–MI",
      rdWidth: 1.7, opacity: 0.9, endCap: false, endLabel: null,
      interpHover: true, dash: "0.1 3.6",
      points: pts(twin),
    }] : []);
  });
  /* the footer download: every release behind the chart, every past-term
     reading behind the band - releases carry their release dates (and a
     link where there is one), history rows carry the term's opening
     election and the month it counts */
  const exportCsv = () => {
    const rr = [["kind", "series", "term_opened", "months_into_term", "month", "value", "url"]];
    for (const l of lanes) for (const p of l.s.polls) rr.push(["release", CONF_SHEET[l.k], "", "", p.ym, p.v, p.url || ""]);
    for (const k of ["consumer", "business", "westpacConsumer"]) {
      const h = HIST && HIST[k];
      if (!h) continue;
      for (const t of h.terms) {
        const e = confYmIdx(t.eYm);
        t.v.forEach((v, m) => { if (v != null) rr.push(["history", CONF_SHEET[k], t.year, m, confYmOf(e + m), v, ""]); });
      }
    }
    confDownloadCsv(`auspol-tracker-confidence-${D.latest.updatedISO}.csv`, rr);
  };
  const vals = viewLanes.flatMap((l) => rawPoints.get(l.k).map((p) => p.y)).concat([100]);
  if (hband) hband.band.forEach((r) => { if (r.m <= xMax) vals.push(r.p10, r.p90, r.mean); });
  drawnSeries.forEach((s) => s.points.forEach((p) => vals.push(p.y)));
  if (histOn) {
    viewLanes.forEach((l) => wideRaw.get(l.k).forEach((p) => vals.push(p.y)));
    deepDrawn.forEach((k) => deepPoints.get(k).forEach((p) => vals.push(p.y)));
  }
  const lo = Math.floor((Math.min(...vals) - 2) / 10) * 10, hi = Math.ceil((Math.max(...vals) + 2) / 10) * 10;
  /* the history window's hover spine pairs the pale lines' own months with
     the release dates, so the guide can land a monthly reading where the
     live file hasn't started yet (its spine would park on the first
     release, years to the right of anything old being pointed at) */
  const histSpine = histOn ? [...new Map(
    deepDrawn.flatMap((k) => deepPoints.get(k))
      .concat(wideRaw.get(viewLanes[0].k))
      .map((p) => [p.x, p])
  ).values()].sort((a, b) => a.x - b.x) : null;
  const spine = histOn ? histSpine : rawPoints.get(viewLanes[0].k);
  /* the chart's series and dots, shared by both windows: the live lines
     are the smoothed trend over the window's releases; in the history
     window the deep monthly lines go UNDER the live ones */
  const liveSeries = (ptsMap) => viewLanes.map((l) => ({ id: l.k, label: l.by, color: l.color, rdWidth: l.dash ? 1.6 : 2.2, dash: l.dash || undefined,
    /* the monthly lane's prints land on the weekly lane's spine by luck
       alone - ride the line between its own prints instead */
    interpHover: true,
    endCap: false, endLabel: narrow ? null : l.by, points: ptsMap.get(l.k) }));
  const chartSeries = histOn ? deepSeries.concat(liveSeries(wideSe))
                             : liveSeries(sePoints).concat(meanSeries ? [meanSeries] : [], drawnSeries);
  const chartRaw = histOn ? wideRaw : rawPoints;
  const copyLegend = viewLanes.map((l) => ({ label: l.by + " (latest " + l.vfmt(l.lat.v) + ")", color: l.color, kind: l.dash ? "dashed" : "line" }));
  const fmt = (v, p) => (p && p.raw != null ? NICE(p.raw) : v.toFixed(1));
  /* the per-view copy: ptitles, the key's dash note and the copy card all
     speak only for the view's own pair */
  const vc = view === "consumer" ? {
    title: "Consumer confidence",
    note: "100 = neutral on both gauges",
    altKey: "The Westpac–MI monthly read of the same household confidence",
    copyTitle: "Consumer confidence (two gauges)",
    copySub: head + " Two published consumer gauges on one 100-neutral scale: the weekly ANZ–Roy Morgan consumer confidence index and Westpac–MI’s monthly consumer sentiment.",
    copyCaption: "Each dot is one release, as the house printed it; each line is a recency-weighted smooth of those readings (half-life 14 days on the weekly ANZ–Roy Morgan index, 60 days on the monthly Westpac–MI series). The band pools the ANZ–Roy Morgan index’s past terms, each lined up on its own election month — the middle half and the middle 80% of them, their average the dashed line; the bottom axis counts months since this term’s election. A drawn past term is its monthly series, smoothed at the monthly gauges’ 60-day half-life and drawn dotted in its house’s colour — ANZ–Roy Morgan plum, Westpac–MI gold where its series reaches back that far. No combining, no adjustment.",
    copyHist: "Consumer confidence as far back as the series go, on one 100-neutral scale. The heavier lines are the smoothed trend of the live release file (each dot one release, as printed; half-life 14 days on the weekly ANZ–Roy Morgan index, 60 days on the monthly Westpac–MI series); the lighter lines underneath are the houses’ own monthly history files — ANZ–Roy Morgan consumer confidence from 1973, Westpac–MI consumer sentiment from 1974. No combining, no adjustment.",
  } : {
    title: "Business confidence",
    note: "100 = neutral on the index; NAB’s net balance drawn 100 points up",
    altKey: "NAB’s net-balance read, drawn 100 points up",
    copyTitle: "Business confidence (two gauges)",
    copySub: head + " Two published business gauges on one 100-neutral scale: Roy Morgan’s monthly business confidence index and NAB’s Monthly Business Survey.",
    copyCaption: "Each dot is one release, as the house printed it; each line is a recency-weighted smooth of those readings (60-day half-life on both monthly series). NAB prints a net balance (0 = neutral), so its gold line is drawn 100 points up to share the neutral line; its read row and tooltips carry NAB’s own figures. The band pools the Roy Morgan index’s past terms, each lined up on its own election month — the middle half and the middle 80% of them, their average the dashed line; the bottom axis counts months since this term’s election. A drawn past term is Roy Morgan’s line alone — smoothed like the live monthly gauge, dotted in its plum. No combining, no adjustment.",
    copyHist: "Business confidence as far back as the series go, on one 100-neutral scale (NAB drawn 100 points up, as the live view draws it). The heavier lines are the smoothed trend of the live release file (each dot one release, as printed; 60-day half-life on both series); the lighter lines underneath are the houses’ own monthly history — Roy Morgan’s index from 2010, NAB’s printed net balance from March 1997 (two public calendar republications of NAB’s figure, merged at wire-verified seams; the pre-2009 head is sole-witness — one mirror’s record, not two-source verified). No combining, no adjustment.",
  };
  /* Election / 1 yr / 2 yrs / 3 yrs, plus Now where the sitting term
     stands — the same ruler gen-data §5k aligns the past terms on */
  const xTicks = [{ x: 0, label: "Election" }, { x: 12, label: "1 yr" }, { x: 24, label: "2 yrs" }, { x: 36, label: "3 yrs" }];
  if (nowM < xMax - 1.4) xTicks.push({ x: +nowM.toFixed(1), label: "Now" });
  xTicks.sort((a, b) => a.x - b.x);
  return (
    <RdSec id="confidence" cls="rd-confidence" title="Economic sentiment" meta={"Confidence indices, 100 = neutral" + (narrow ? "" : ", four published series")}>
      <RdHed head={head} dek={dek} />
      {/* the views are pages of their own, so the row walks them by arrow
          keys (focused, or hovering the panel) and a phone swipe;
          rdPinScroll holds the row's spot through the crossfade (pin) */}
      <RdTabs swipe pin value={view} onChange={setView} options={RD_CONF_VIEWS} ariaLabel="Confidence of" className="rd-confidence-tabs" />
      <RdCrossfade k={view}>
      {(hband || deepDrawn.length > 0) && (
      <div className="rd-cc rd-confidence-cc">
        <div className="rd-confidence-draw">
          {deepDrawn.length > 0 && (
            <button type="button" className="rd-chip rd-confidence-hist" aria-pressed={histOn}
                    onClick={() => { setHist((h) => !h); setEvtOpen(null); }}>
              {histOn ? "Back to this term" : "＋ " + (narrow ? "Full history" : "Show complete history")}
            </button>
          )}
          {hband && !histOn && (
            /* the past-terms menu is the page's own control over a native
               select, styled with the primary-vote subpopulation menu's
               rules — picking a year toggles its line and the select snaps
               back to its label: the drawn set lives on the pills row */
            <select className="rd-confidence-sel" aria-label="Draw a past term" value=""
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "clear") setLiftedBy((s) => ({ ...s, [histLane]: new Set() }));
                      else if (v) lift(+v);
                    }}>
              <option value="" disabled>Draw a past term</option>
              {histTerms.map((t) => (
                <option key={t.year} value={t.year}>{lifted.has(t.year) ? ("✓ " + t.year) : t.year}</option>
              ))}
              {lifted.size > 0 && <hr />}
              {lifted.size > 0 && <option value="clear">✕ Clear lines</option>}
            </select>
          )}
          {!histOn && lifted.size > 0 && (
            <span className="rd-cc-drawn">
              <span className="rd-cc-l">Drawn over the band</span>
              {[...lifted].sort((a, b) => a - b).map((y) => (
                <span key={y} className="rd-cc-pill" style={{ borderColor: "var(--confidence-main)" }}>
                  <span className="rd-cc-rule" style={{ background: "var(--confidence-main)" }}></span>{y}
                  <button type="button" aria-label={"Return " + y + " to the band"} onClick={() => lift(y)}>×</button>
                </span>
              ))}
            </span>
          )}
        </div>
      </div>
      )}
      <div className="card rd-card rd-confidence-chart">
        <div className="rd-un-ptitle"><b>{vc.title}</b><span>{vc.note}</span></div>
        {viewLanes.map((l) => (
          <div key={l.k} className="rd-un-read">
            <RdSwatch kind={l.dash ? "dash" : "line"} color={l.color} />
            <div>
              <div className="rd-un-rtop"><b>{l.by}</b><span className="rd-un-rfig"><span className="rd-un-rv">{l.vfmt(l.lat.v)}</span>{l.lat.chg != null && Math.abs(l.lat.chg) >= 0.05 && <span className="rd-un-rci">{rdArrow(l.lat.chg)} {NICE(Math.abs(l.lat.chg))} on the {l.period}</span>}</span></div>
              <p>{l.short + (l.k === "nabBusiness" ? "" : " " + water(l, l.lat.v) + ".")}</p>
            </div>
          </div>
        ))}
        <TrendChart key={"rd-confidence-" + view + (histOn ? "-hist" : "")} heightPx={narrow ? 260 : 340}
          /* the top pad buys the numbered event badges their row above
             the plot, as the primary card's does */
          padPx={narrow ? { l: 34, r: 8, t: 34, b: 28 } : { l: 40, r: 16, t: 44, b: 30 }}
          xDomain={histOn ? [histX0, D.domain.x1] : [0, xMax]} yDomain={[lo, hi]} yTicks={rdYTicks(lo, hi, 10)} yTickFmt={(v) => String(v)}
          xTicks={histOn ? histTicks : xTicks} baseline
          refLines={[{ y: 100, label: "100 = neutral", align: "left", color: "var(--ink-3)" }]}
          areas={histOn ? undefined : (bandAreas || undefined)}
          series={chartSeries}
          spine={spine}
          events={histOn ? [] : (badges ? badges.events : evs)}
          evt={histOn ? null : evtOpen} onEvt={setEvtOpen}
          scatter={viewLanes.flatMap((l) => chartRaw.get(l.k).map((q) => ({ x: q.x, y: q.y, color: l.color, label: l.by, ...(q.raw != null ? { raw: q.raw } : {}), meta: { pollster: l.by, released: q.released } })))}
          /* each release is a row on the archive's confidence facet, so a
             dot under a mouse offers the same open trip every poll chart
             does (the engine's ROW_KEYS knows the confidence rows). The
             facet's tab shows at every width since 2026-10-08 (a phone's
             row scrolls to it), so the trip is offered everywhere */
          pollFacet="confidence"
          tooltipTitle={(i) => { const p = spine[i]; return p ? monthLabelFull(p.ym) : ""; }}
          fmt={fmt}
          copy={{ title: vc.copyTitle, sub: vc.copySub, caption: histOn ? vc.copyHist : vc.copyCaption, legend: copyLegend }} />
        {/* the hero's list above already names this window's events, so
            two or more fold away behind a disclosure the reader opens when
            a mark puzzles them; a lone marked event just sits out as the
            single row, with no "The marked events" wrapping it */}
        {badges && badges.list.length === 1 && (
          <RdEventList list={badges.list} onPick={pickEv}
                       openKey={evtOpen && evtOpen.e ? evtOpen.e.badgeKey : null} />
        )}
        {badges && badges.list.length > 1 && (
          <details className="rd-evdrop">
            <summary>The marked events</summary>
            <RdEventList list={badges.list} onPick={pickEv}
                         openKey={evtOpen && evtOpen.e ? evtOpen.e.badgeKey : null} />
          </details>
        )}
        <RdKey className="rd-ckey" items={[
          { kind: "dot", color: "var(--ink-3)", label: "One release, as printed" },
          { kind: "line", color: "var(--ink-3)", label: "Smoothed trend of the releases" },
          { kind: "line", color: "var(--confidence-alt)", label: vc.altKey },
        ]}>
          {hband && !histOn && <>
            <span className="rd-key-item"><span className="rd-cs-keyband" aria-hidden="true"><i></i></span>Middle half and middle 80% of past terms</span>
            <span className="rd-key-item"><RdSwatch kind="dash" color="var(--ink-2)" />Their average</span>
            <span className="rd-key-item"><span className="rd-cs-keythin" aria-hidden="true"></span>Paler: fewer terms ran this long</span>
          </>}
          {histOn && <>
            <span className="rd-key-item"><span className="rd-cs-keythin" aria-hidden="true"></span>Monthly history back to {histX0}, as the house published it</span>
          </>}
        </RdKey>
      </div>
      </RdCrossfade>
      <HowTo paras={[
        <>Four published gauges of economic confidence, split into two views — the consumer pair and the business pair, switched by the tabs over the chart — and set out as each house prints them from the 2025 election on: the weekly ANZ–Roy Morgan consumer index and monthly business index, Westpac–MI’s monthly consumer sentiment, and NAB’s Monthly Business Survey. Each dot is one release, as printed; each line is the same readings smoothed with a recency-weighted kernel (half-life 14 days on the weekly index, 60 days on the monthly ones), so release-to-release noise reads as trend — the quoted figures stay the raw prints. There is no combining across houses and no adjustment for lean — a record, not an estimate.</>,
        <>Behind the current term, the band pools that view’s main gauge over past terms — each term lined up on its own election month, so the bottom axis (months since this term’s election) is every term’s ruler: the middle half of past terms in the heavier fill, the middle 80% in the lighter, their average the dashed line, paler where fewer terms ran that long. Consumer history runs to 1974, business to 2013. “Draw a past term” lifts any single term out of the band as its own smoothed, dotted line in the house’s own colour — and on the consumer view Westpac–MI’s reading of the same term draws beside it, dotted gold where its 1974 series reaches — and “Source data, CSV” in the footer downloads every release and past-term reading. “Show complete history” instead draws whole years: each lane’s own published monthly series runs back as a pale line — ANZ–Roy Morgan’s consumer index to 1973, Westpac–MI’s consumer sentiment to 1974, Roy Morgan’s business index to 2010 — with the releases and their smoothing re-drawn over the file. Westpac–MI months before 2010 come from the OECD’s republication of the index, which rounds them to the nearest whole index point; from 2010 the RBA’s table carries Westpac–MI’s own decimals. NAB stays out of that underlay: its long series is a deviation from its own average, a different measure to its printed net balance, so the NAB lane only ever carries NAB’s own releases.</>,
        <>Three of the four are indices where 100 is neutral. NAB instead reports a net balance — the share of optimistic firms minus pessimistic ones — where 0 is neutral, so the NAB line is drawn 100 points up to share the neutral line on the business view; the figure beside it and in its tooltips is NAB’s own printed number, and the row also carries the survey’s conditions reading.</>,
        <>Reading economic sentiment beside the polls is context, not a predictor of the vote. The consumer and business gauges needn’t move together, and two houses asking differently worded questions needn’t agree week to week.</>,
      ]} />
      <div className="rd-foot">
        <span className="rd-foot-text">Four published gauges — ANZ–Roy Morgan, Westpac–MI, Roy Morgan and NAB — joined as released. Context, not a predictor.</span>
        <span className="rd-grow"></span>
        <button type="button" className="rd-how rd-confidence-csv" onClick={exportCsv}><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v12M12 15l-4-4M12 15l4-4M4 19h16"></path></svg> Source data, CSV</button>
        <RdHow term="confidence" from="Economic sentiment" />
      </div>
    </RdSec>
  );
}

Object.assign(window, { RdPrimary, rdShareWords, rdPartyIn, rdPartyStart, rdElectionTicks, RdLeadership, RdHeadBar, RdDirection, rdList, rdRoughPts, RdDemographics, RdSwitching, useRdWidth, RdIssues, RdUndecided, RdConfidence, RdShiftPlot, rdOneIn, RdTsig, rdTsSgn });
