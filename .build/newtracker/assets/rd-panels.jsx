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


/* the dotted stroke of a lead-in segment bridging an election mark to the
   first month a chart actually polled - interpolation, drawn as the month's
   interpolation is (the cycle charts dash a month nothing was polled in);
   dots rather than the all-voters dashes so the two reference lines read as
   different kinds of thing */
const RD_ELECTION_LEAD = "0.5 4";
/* Where the polls' election-time triangles hold the election column (the
   group views of Primary vote and Who votes for whom), the AES diamonds
   stand this far right of it, in years: the survey was taken after polling
   day, and the two marks would otherwise sit on one another. About 17px on
   a desktop primary chart, 9px on a Who-votes card, 11px on a phone. */
const RD_AES_NUDGE = (narrow) => (narrow ? 0.05 : 0.03);
/* The election mark's tip line (D.demoVote, gen-data DEMO_VOTE): which of
   the two election-time readings the estimate rests on, each quoted on the
   result's scale, and the estimate's 95% margin. `c` is the party's cell:
   [estimate, margin, the polls' figure | null, the AES's | null]. */
const RD_VOTE_LABEL = "Estimated vote at the 2025 election";
/* how the polls' election-day figure for a group is read: federally the
   group model's estimate for polling day (gen-data §7gm), from the houses'
   tables before and after it; otherwise the six weeks of tables before */
const RD_PEL_MODEL = !!(window.AUSPOL.demoElection && window.AUSPOL.demoElection.model);
const RD_PEL_WHEN = RD_PEL_MODEL ? "for polling day, from the tables before and after it" : "over the six weeks before polling day";
const rdVoteSub = (grp, c) => {
  const polls = grp.polls ? grp.polls.n + " poll" + (grp.polls.n === 1 ? "" : "s") + " from " + rdList(grp.polls.houses.map(demoHouse)) : "";
  const aes = grp.aesN != null ? grp.aesN.toLocaleString() + " respondents in this group" : "";
  return c[2] != null && c[3] != null
    ? (RD_PEL_MODEL ? "Polls, read for polling day " : "Polls in the six weeks before polling day ") + c[2].toFixed(1) + " (" + polls + "); Australian Election Study " + c[3].toFixed(1) + " (" + aes + "); weighted together, ±" + c[1].toFixed(1)
    : c[2] != null
      ? (RD_PEL_MODEL ? "From the polls, read for polling day: " : "From the polls in the six weeks before polling day: ") + polls + ", ±" + c[1].toFixed(1)
      : "From the Australian Election Study 2025, a post-election survey: " + aes + ", ±" + c[1].toFixed(1);
};

/* ======================================================================
   Primary vote
   ====================================================================== */
function RdPrimary({ rangeId, setRangeId }) {
  const { D, rangeDomain, filterPts, series, monthLabelFull } = window.AP;
  const narrow = useNarrow(MQ_PHONE);
  /* the vote charts' shared window (rd-hero.jsx); a window behind this term
     draws the past terms (gen-data §8v) - the history scene below */
  const vw = useRdVw();
  const vwTerms = React.useMemo(() => confTermsOf(D), [D]);
  const { VH, lo: vwLo, hi: vwHi } = rdVwReach(D);
  const [hidden, setHidden] = useState({});
  /* The group dropdown: any Who-votes-for-whom group, drawn from the §7g
     payload the Who-votes panel itself pools (never re-derived here).
     grpId === "" is the all-voters view; /vic/ has no demographics payload,
     so the control never appears there. The income tab's two standardised
     bands ride the same menu, spliced on last exactly as the Who-votes
     panel joins them (never into the shared payload itself). */
  const T = D.demographics && D.demoIncome ? { ...D.demographics, tabs: [...D.demographics.tabs, D.demoIncome] } : D.demographics;
  const [grpId, setGrpId] = useState("");
  const sel = (() => {
    if (!grpId || !T || !T.tabs) return null;
    for (const t of T.tabs) for (const s of t.sets) {
      const g = s.groups.find((x) => x.label === grpId);
      /* t.id is the group's demographics split (age/gender/education/
         place/home) - the dot-open hands it to All polls so the opened
         poll's Demographics detail already shows the clicked view's cut */
      if (g) return { label: grpId, g, who: RD_DEMO_SHORT[grpId] || grpId, tabId: t.id, setId: s.id };
    }
    return null;
  })();
  const G = sel && sel.g;
  /* The all-pollsters menu: the all-voters figures, re-run in the browser
     as if only the ticked houses' polls existed (user ask 2026-10-19).
     Federal-only (/vic/'s lines are a Kalman trend, not this estimator);
     the menu hides in group mode, where the figures are §7g's pooled
     reads and a pollster subset can't recompose them - the ticked set
     stays, it just goes inert until the all-voters view returns. Empty
     Set = every pollster. pvAgg mirrors gen-data §2 over the emitted
     individualPolls, with the constants from D.aggSpec. */
  const pvMenuOK = !window.JUR && !!(D.aggSpec && D.pvHouses && window.AP.pvAgg);
  const [hvSel, setHvSel] = useState(() => new Set());
  const hvKey = [...hvSel].sort().join("|");
  const pvx = React.useMemo(
    () => (pvMenuOK && hvSel.size && !G ? window.AP.pvAgg([...hvSel]) : null),
    [hvKey, !!G]
  );
  /* the subset's meta-line figures: poll count and newest fieldwork of the
     ticked houses (the server's all-houses figures otherwise). The count
     and the date read the SAME rows the recompute does (pv-agg's rowsFor:
     the noAgg and figure-less rows it skips can't move "N polls, latest
     fieldwork ..." past what the lines were drawn from) */
  const pvxMeta = React.useMemo(() => {
    if (!pvx) return null;
    const rows = D.individualPolls.filter((q) => hvSel.has(q.pollster) && !q.noAgg && q.p);
    return { n: rows.length, latest: rows.reduce((m, q) => (q.released > m ? q.released : m), "") };
  }, [hvKey, !!G]);
  /* nothing in the three-week window under the subset: the headline quotes
     nothing, the monthly chart still draws (story override below) */
  const pvxDry = !!(pvx && !pvx.now);
  /* The window bar stands in for the range tabs on the all-voters view with
     every pollster: a group's figures and a pollster subset exist for this
     term only, so those views keep the tabs. /vic/ keeps them too - it has
     no past terms. */
  const vwOn = !window.JUR && !G && !pvx;
  const histOn = !!(vwOn && vw.hist && VH);
  const vwWin = rdVwWin(rangeId, histOn ? vw.hist : null, vwTerms);
  const xDomain = histOn ? [vwWin.a, vwWin.b] : rangeDomain(rangeId);
  const vwAtNow = !histOn || xDomain[1] >= vwHi - 1 / 24;
  const curTermA = (vwTerms.find((t) => t.current) || { a: -Infinity }).a;
  const curIn = !histOn || xDomain[1] > curTermA + 1e-6;   // the window reaches this term
  const vhSpan = xDomain[1] - xDomain[0];
  /* the past terms' polls, as published, are the Past cycles tab's lazily
     fetched file: asked for the first time a history window opens */
  const [srcTick, setSrcTick] = useState(0);
  React.useEffect(() => {
    if (!histOn || Object.keys(D.cycleSource || {}).length) return undefined;
    let live = true;
    D.loadCycleSource().then(() => { if (live) setSrcTick((n) => n + 1); });
    return () => { live = false; };
  }, [histOn]);
  const aggPrim = pvx ? [D.aggPrimary[0]].concat(pvx.months) : D.aggPrimary;
  const lastM = aggPrim[aggPrim.length - 1];
  const allBase = aggPrim.find((d) => d.election) || null;
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
  /* Where the count was never cut, "since the election" reads off the
     polls at the election (D.demoElection, user call 2026-11-03): each
     party's figure among the group over the six weeks before polling day,
     from the same houses' own tables, pooled as the lines are - the open
     triangle the chart draws, the 2025 result plus that pooled gap. Both
     ends are then the same instruments. The Australian Election Study
     2025 (D.demoAes) read several groups differently from the polls by
     more than both margins, so measured from it part of the "change" was
     the two instruments; its diamonds stay on the chart as its own
     reading. Where no house cut the group before the election (the
     generations) the AES is still the baseline (user ruling 2026-11-02).
     Either way every such group shares the election as its baseline
     rather than whichever month the polls first cut it, and unlike a count
     the baseline carries sampling error (elWasCi: the polls' pooled
     margin, or the AES cell's), which the faller test adds to the current
     figure's. */
  const pelGrp = G && !base && D.demoElection && D.demoElection.sets && sel.setId && D.demoElection.sets[sel.setId]
    ? D.demoElection.sets[sel.setId].groups[sel.label] || null : null;
  const aesGrp = G && !base && !pelGrp && D.demoAes && D.demoAes.sets && sel.setId && D.demoAes.sets[sel.setId]
    ? D.demoAes.sets[sel.setId].groups[sel.label] || null : null;
  const elWas = pelGrp ? Object.fromEntries(T.order.filter((kk) => pelGrp[kk]).map((kk) => [kk, pelGrp[kk][0]]))
    : aesGrp ? Object.fromEntries(T.order.filter((kk) => aesGrp[kk]).map((kk) => [kk, aesGrp[kk][1]])) : null;
  const elWasCi = pelGrp ? Object.fromEntries(T.order.filter((kk) => pelGrp[kk]).map((kk) => [kk, pelGrp[kk][1] || 0]))
    : aesGrp ? Object.fromEntries(T.order.filter((kk) => aesGrp[kk]).map((kk) => [kk, aesGrp[kk][2] || 0])) : null;
  /* the baseline named above: the group line's first monthly row, keyed by
     party as the election rows are - a party unpolled that month keeps no
     change row, as it had no election row before; an election-time figure
     (the polls', else the AES's) takes its place wherever one exists */
  const gWas = G && !base && !pelGrp && !aesGrp && G.monthly && G.monthly.length > 1
    ? (() => { const o = { ym: G.monthly[0][0] }; T.order.forEach((kk, i) => { o[kk] = G.monthly[0][1 + i]; }); return o; })()
    : null;
  /* a poll row's grp.v slots are gen-data's alp/lnp/grn/onp/oth order, NOT
     §7g's DEMO_KEYS (alp/lnp/onp/grn/oth): map by key, never by a shared
     index across the two */
  const GRPV_KEYS = ["alp", "lnp", "grn", "onp", "oth"];
  /* WC: the baseline's own margin per party - zero for a count, the polls'
     pooled margin or the AES cell's for an election-time figure */
  const mkParts = (V, C, W, WC) => ["alp", "lnp", "grn", "onp", "oth"].map((id) => ({
    id, color: D.PARTIES[id].color, name: (id === "oth" ? "Others & independents" : D.PARTIES[id].name),
    v: V[id], was: W ? W[id] : null, ci: C[id] || 0, wasCi: WC ? WC[id] || 0 : 0,
  })).sort((a, b) => b.v - a.v);
  /* the level test, walking the ranking the way the share card's ladder
     and the og:alt sentence already do (make-card.js, build.mjs
     cardAltOf): a party joins the group above it while the gap to that
     group's first party stays inside the two figures' margins combined; a
     wider gap starts a fresh group, so a tie BELOW the leaders is its own
     group. levelCount is the top group's size - the all-voters contrast
     behind a group's dek asks only that. */
  /* federal all-voters figures come from the model, which gives the chance
     each party is ahead of each other directly (latest.primaryModel.pAhead):
     there a party joins the group above while that chance is under 97.5%
     (a two-sided 95% test); a group view or a pollster subset keeps the
     margins test */
  const pAheadAll = !pvx && D.latest && D.latest.primaryModel ? D.latest.primaryModel.pAhead : null;
  const levelRuns = (ps) => {
    const rs = [];
    const pa = pAheadAll && ps === partsAll ? pAheadAll : null;
    ps.forEach((p) => {
      const r = rs[rs.length - 1];
      const pk = r ? r[0].id + ">" + p.id : null;
      const tied = r && (pa && pa[pk] != null ? pa[pk] < 0.975 : r[0].v - p.v < Math.sqrt(r[0].ci * r[0].ci + p.ci * p.ci));
      if (tied) r.push(p);
      else rs.push([p]);
    });
    return rs;
  };
  const levelCount = (ps) => levelRuns(ps)[0].length;
  /* when the subset holds nothing in the window (pvxDry), nowPrim is null
     and every part-derived surface (the stat blocks, the run bands, the
     level/late runs) collapses to emptiness rather than quoting the
     server's all-houses figures as if they were the subset's - the story
     and the monthly chart carry the state instead */
  const nowPrim = pvx ? pvx.now : D.latest.primary;
  const partsAll = nowPrim ? mkParts(nowPrim, lastM.ci || {}, allBase) : null;
  const kAll = partsAll ? levelCount(partsAll) : 0;
  const parts = G ? mkParts(G.v, G.ci, base || elWas, base ? null : elWasCi) : partsAll;
  /* a dry subset (pvxDry: no poll in the three-week window) has no `parts`
     to quote, but its monthly lines still draw - the CHART's party list
     then comes from the newest subset month that carries figures (the
     ranking, line colours and end labels), while the stat blocks and the
     level runs stay collapsed */
  const partsDry = pvxDry
    ? (() => {
        const lastWithFig = aggPrim.slice().reverse().find((d) => !d.election && GRPV_KEYS.some((k) => d[k] != null));
        return lastWithFig ? mkParts(lastWithFig, lastM.ci || {}, allBase) : null;
      })()
    : null;
  const partsChart = parts || partsDry;
  /* party hides are all-voters state: a hide made there never strands a
     party invisible on a chart whose stat buttons are gone (pvxDry has
     none), so the dry chart draws every party */
  const hideC = parts ? hidden : {};
  const top = parts ? parts[0] : null;
  const SHORT = { alp: "Labor", lnp: "Coalition", grn: "Greens", onp: "One Nation", oth: "Others" };
  /* a phone's line ends carry the parties' letters, as the canvas drew them:
     the full names don't fit beside a 350px plot */
  const ABBR = { alp: "ALP", lnp: "L/NP", grn: "GRN", onp: "ON", oth: "OTH" };
  const firstPolled = (G || !parts) ? {} : Object.fromEntries(parts.map((p) => [p.id, aggPrim.find((d) => !d.election && d[p.id] != null)]));
  const lateParties = !G && base && parts ? parts.map((p) => p.id).filter((id) => firstPolled[id] && firstPolled[id].x - base.x > 0.5) : [];
  /* runs[0]: the parties the leader cannot be told apart from, the gap to
     each inside the two figures' 95% margins combined; every further run
     of two or more is a tie below the leaders of its own */
  const runs = parts ? levelRuns(parts) : [];
  const k = runs.length ? runs[0].length : 0;
  const level = runs.length ? runs[0] : [];
  /* runs → the drawn bits: the big screen's bracket columns, and the
     phone's ordered blocks, where single parties between tied groups run
     together in one rest block so their hairlines never break */
  const levelBands = [], pvBlocks = [];
  {
    let col = 1;
    runs.forEach((r) => {
      if (r.length >= 2) {
        levelBands.push({ col, run: r });
        pvBlocks.push({ tied: r });
      } else {
        const last = pvBlocks[pvBlocks.length - 1];
        if (last && !last.tied) last.rest.push(r[0]);
        else pvBlocks.push({ rest: [r[0]] });
      }
      col += r.length;
    });
  }

  const story = (() => {
    /* a pollster subset with nothing in the window: the headline says so
       instead of quoting the all-houses figures, and the stat blocks below
       render empty while the chart keeps its monthly lines */
    if (pvxDry) return {
      head: "No polls from the selected pollsters in the last three weeks",
      dek: "The headline figures need at least one poll in the window; the chart still shows each month's average from the ticked pollsters.",
    };
    const list = (arr) => arr.length === 2 ? arr.join(" and ") : arr.slice(0, -1).join(", ") + " and " + arr[arr.length - 1];
    const pc = (v) => v.toFixed(1) + "%";
    /* "Labor, on 28.4%, and One Nation, on 26.0%" - the leader sentence's
       party-and-figure list, its shape wherever a tie needs naming; `mid`
       when the list follows "Among <group>, " inside the sentence, so its
       first party takes the running form ("the Coalition", not "The") */
    const pcSeg = (ps, mid) => ps.map((p, i) => (i === 0 && !mid ? rdPartyStart(p.id) : rdPartyIn(p.id)) + ", on " + pc(p.v)).reduce((s, c, i, a) =>
      s + (i === 0 ? c : i === a.length - 1 ? ", and " + c : ", " + c), "");
    let head, dek;
    if (k >= 2) {
      head = rdCap(list(level.map((p) => rdPartyIn(p.id)))) + " are level" + (G ? " among " + sel.who : "");
      dek = (G ? "Among " + sel.who + ", " : "") + pcSeg(level, !!G);
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
    /* a tie below the leaders names itself too - the same run walk the
       stat blocks draw their bands from */
    runs.slice(1).filter((r) => r.length >= 2).forEach((r) => {
      dek += " " + pcSeg(r) + ", are too close to separate.";
    });
    /* the biggest faller outside the leading group, if the fall is big (15%
       of its election vote or more) AND clears the margins - the current
       figure's, and the baseline's own: none for a count, the polls' pooled
       margin or the AES cell's for an election-time figure (wasCi),
       combined in quadrature */
    const fallers = parts.slice(k).filter((p) => p.was && p.v < p.was && (p.was - p.v) / p.was >= 0.15
        && p.was - p.v > Math.sqrt((p.ci || 0) ** 2 + (p.wasCi || 0) ** 2))
      .sort((a, b) => (b.was - b.v) / b.was - (a.was - a.v) / a.was);
    if (fallers.length) {
      const f = fallers[0];
      dek += " " + rdPartyStart(f.id) + ", on " + pc(f.v) + ", " + (rdPlural(f.id) ? "have" : "has") + " lost "
        + rdShareWords((f.was - f.v) / f.was) + " of " + (rdPlural(f.id) ? "their" : "its")
        + (pelGrp ? " vote at the election, by the polls’ own reading then." : aesGrp ? " vote at the election, by the Australian Election Study’s reading." : " election-night vote.");
      /* a generation's AES baseline compares across instruments: the polls'
         figure is the generation cuts of one or two houses alone (user call
         2026-11-02) - the margins measure sampling, not that */
      if (aesGrp && sel.setId === "generation" && G.houses && G.houses.length)
        dek += " The polls’ figures for " + sel.who + " come only from the generation cuts of " + rdList(G.houses.map(demoHouse)) + ", so that comparison is across instruments.";
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
  const pts = filterPts(G && gMonths ? gMonths : aggPrim, xDomain[0]);
  const visible = (partsChart || []).filter((p) => !hideC[p.id]);
  /* a monthly series drops the months that never carried the party's
     figure - the chart engine has no null-run guard (/vic/ has sparse ON
     months; federally every month carries the five, so this is a no-op) -
     and a party first reported apart long after the election starts its
     line at that month, not with a lead-in from the election's ring */
  const live = (id) => {
    const L = pts.filter((d) => d[id] != null);
    return lateParties.includes(id) && L.length > 1 && L[0].election ? L.slice(1) : L;
  };
  const chartSeries = (partsChart || []).slice().reverse().map((p) => ({
    id: p.id, label: p.name, color: p.color, points: series(live(p.id), p.id),
    rdWidth: p.id === "oth" ? 2 : 2.5, dashed: p.id === "oth", dash: p.id === "oth" ? "6 4" : undefined,
    opacity: hideC[p.id] ? 0 : 1, endLabel: narrow ? ABBR[p.id] : SHORT[p.id], rdCap: 4,
  }));
  /* a party toggled off keeps its band, its dots and its election ring on
     the chart at nothing, so they fade out with its line (and back in),
     rather than vanishing the frame the line starts to fade */
  const areas = (partsChart || []).map((p) => ({
    id: "ci-" + p.id, color: p.color, className: "ci-band", edge: false, hidden: !!hideC[p.id],
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
  /* the trio view's open rings: readings of Tasmania, the ACT or the NT
     alone - Roy Morgan's Tas cut, DemosAU (MRP)'s three rows, and whole-
     territory polls (EMRS) - drawn beside the trio's own dots for
     comparison and NEVER pooled into its line, months or figures. The
     wave's printed territory share rides the ring as `gv`; the tip says
     whose reading it is */
  const soloDotsOf = (q) => (G && sel.label === "ACT/NT/Tas" && q.solo ? q.solo.flatMap((e) => parts.map((p) => {
    const sv = e[p.id];
    if (sv == null) return null;
    /* a whole-territory poll (EMRS) asks no all-voters counterpart, so its
       ring sits at the raw printed share; a cut inside a national wave
       lifts off that wave's own all-voters figure, as a trio dot does */
    let y;
    if (e.whole) y = sv;
    else {
      const M = aggByYm && aggByYm.get(q.ym);
      if (!M || !q.p || q.p[p.id] == null) return null;
      y = M[p.id] + (sv - q.p[p.id]);
    }
    return { x: q.x, y: +y.toFixed(2), gv: sv, color: p.color, label: p.name, meta: q, party: p.id, hollow: true,
             sub: [RD_SOLO_NAME[e.terr] + " only - not pooled" + (q.sample ? ", n = " : ""), q.sample ? window.AUSPOL.sampleEl(q) : null] };
  }).filter(Boolean)) : []);
  const inDom = (x) => x >= xDomain[0] && x <= xDomain[1];
  const scatter = React.useMemo(() => D.individualPolls
    // a pooled release's parts (demoGrpAt) can sit inside the range its end doesn't
    .filter((q) => inDom(q.x) || (G && q.grp && q.grp.sp))
    .flatMap((q) => {
      if (!G) {
        /* the lines and headline count no no-aggregate wave (a months-long
           pooled release, a combined reissue, an MRP, a Tasmania-only
           reading), so none draws a dot beside a line it never fed - the
           row stays in the All-polls archive with its noAgg note, as the
           two-party hero's cloud has skipped them all along */
        if (q.noAgg) return [];
        /* a ticked pollster subset hides the unticked houses' dots too -
           a wave from a house that doesn't count mustn't hang off the
           recomputed lines as if it fed them */
        if (pvx && !hvSel.has(q.pollster)) return [];
        return (partsChart || []).filter((p) => q.p && q.p[p.id] != null)
          .map((p) => ({ x: q.x, y: q.p[p.id], color: p.color, label: p.name, meta: q, party: p.id }));
      }
      const gv = q.grp && q.grp.v && q.grp.v[gi], tt = q.grp && q.grp.t;
      if (!gv || !tt) return inDom(q.x) ? soloDotsOf(q) : [];
      /* each place the group's figures count (demoGrpAt): the wave itself,
         or each poll a pooled release pooled, lifted off that poll's month */
      return demoGrpAt(q).filter((s) => inDom(s.x)).flatMap((s) => {
        const M = aggByYm && aggByYm.get(s.ym);
        if (!M) return [];
        return parts.map((p) => {
          const i = GRPV_KEYS.indexOf(p.id);
          // a party the wave never printed (an Others fold) draws no dot
          if (gv[i] == null || tt[i] == null) return null;
          // the group's estimated subsample (gen-data's wave n × the group's
          // share of voters) overrides the tip's whole-wave n, as the rug does
          return { x: s.x, y: M[p.id] + (gv[i] - tt[i]), gv: gv[i], color: p.color, label: p.name, meta: demoPartMeta(q, s), party: p.id,
                   sub: demoReadSub(q, sel.label, demoPartSub(q, s, q.grp.n && q.grp.n[gi])) };
        }).filter(Boolean);
      }).concat(inDom(q.x) ? soloDotsOf(q) : []);
    }), [T, G, xDomain[0], xDomain[1], hvKey]);
  /* The Australian Election Study 2025 (D.demoAes), the same contract the
     Who-votes charts carry: where the AEC never counts the cut (gender,
     age, generations, education, housing, work status - those groups can
     never have a counted `base` or ring) each party's vote among the group
     at the May 2025 election, from the AES respondent file, sits as a
     hollow diamond, placed as a poll dot is (the 2025 result plus the
     group's gap from the AES's own all-respondents figure, so the survey's
     own lean drops out of where it lands), the tip quoting the AES's share
     and the group's respondents, with the ring's dotted lead-in to the
     line's first month. Every party (One Nation is coded apart in the
     file). Never pooled, never in the monthly lines; a window that doesn't
     reach the election skips it. */
  /* ONE mark per party at the election (D.demoVote, user call 2026-11-10):
     the group's vote estimated from the polls before the election and the
     AES together, a hollow diamond on the result's scale; its tip quotes
     both readings. It is the best estimate of how the group voted, NOT the
     base "since the election" is measured from (pelGrp, else aesGrp: the
     same instruments at both ends). Each mark takes the dotted lead-in to
     its line's first month all the same (owner call 2026-11-11): the eye
     needs the join, and the stat rows say what the change is measured
     from. */
  const evGrp = G && !base && D.demoVote && D.demoVote.sets && D.demoVote.sets[sel.setId] ? D.demoVote.sets[sel.setId].groups[sel.label] || null : null;
  const evOf = (kk) => (evGrp && evGrp[kk]) || null;
  const evOn = !!(evGrp && parts && parts.some((p) => evOf(p.id)) && D.demoVote.x >= xDomain[0] - 1e-6);
  const evPts = evOn ? parts.filter((p) => evOf(p.id))
    .map((p) => ({ x: D.demoVote.x, y: evOf(p.id)[0], color: p.color, label: p.name, party: p.id,
                   shape: "diamond", hollow: true, size: 1.6,
                   meta: { pollster: RD_VOTE_LABEL },
                   sub: rdVoteSub(evGrp, evOf(p.id)) })) : [];
  const evLeads = evOn ? parts.filter((p) => evOf(p.id)).map((p) => {
    const pLive = series(live(p.id), p.id);
    return pLive.length && pLive[0].x > D.demoVote.x
      ? { id: "ev-ld-" + p.id, label: p.name, color: p.color, dash: RD_ELECTION_LEAD, rdWidth: 2.5,
          endCap: false, opacity: hidden[p.id] ? 0 : 1,
          /* every mark joins its line (owner call 2026-11-11), whichever
             sources stand behind it */
          points: [{ x: D.demoVote.x, y: evOf(p.id)[0] }, pLive[0]] }
      : null;
  }).filter(Boolean) : [];
  const shownScatter = React.useMemo(() => scatter.concat(evPts).map((d) => (hideC[d.party] ? { ...d, op: 0 } : d)), [scatter, evPts, hideC]);
  const marks = base && partsChart ? partsChart.map((p) => ({ x: base.x, y: base[p.id], color: p.color, r: 4.5, hidden: !!hideC[p.id] })) : [];
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
  /* the counted stop the rings mark lives nowhere in a group's month rows,
     so the spine carries it itself (the all-voters view gets it free from
     aggPrimary's election row; group rows start months later). Without the
     stop every ring hover snaps to the FIRST month polled and tips that
     month's figures against the ring the cursor is on - reported 2026-10-13
     ("can't hover over the election rings", the Provincial view). The
     lead-in series already hold the count at the stop's x under the line's
     own label, so the hover reads the count itself, swatch drawn as the
     ring, as the by-state/location panels do. The gate skips a stop that
     left the window, or already IS the first monthly row's x */
  const gElecStop = G && base && base.x >= xDomain[0] - 1e-6 && (!pts.length || pts[0].x > base.x + 1e-6)
    ? { x: base.x, y: base.alp } : null;
  /* the triangles' (else the diamonds') spine stop, as gElecStop is the
     rings': without it a hover at the election month snaps past them to
     the first month polled. A counted base excludes the election-time
     figures by construction, so the stops never coexist; with triangles
     drawn the stop reads them, through their lead-ins */
  const evStop = evOn ? { x: D.demoVote.x, y: evOf("alp") ? evOf("alp")[0] : evPts[0].y } : null;
  const elecStop = gElecStop || evStop;
  /* the numbered events: the same set the 2PP hero marks, over this chart's
     window */
  /* a history window lying wholly inside this term keeps this term's
     events; one reaching behind it marks the elections in it instead (a
     term window has its two as the axis's ends), as rules past six, and
     the phone keeps no numbered list for them */
  const curOnly = histOn && xDomain[0] >= curTermA - 1e-6;
  const evs = !histOn || curOnly ? rdChartEvents(D.events, xDomain[0], xDomain[1]) : rdVwElections(vwWin, vwTerms);
  const elecRules = histOn && !curOnly && evs.length > 6;
  const badges = narrow && (!histOn || curOnly) ? rdEventBadges("p1", evs, xDomain[0], xDomain[1]) : null;
  /* the phone list under the chart opens an event's panel by tapping its
     number; a tap on another number hands the panel over, and an event that
     leaves the window is put away by the chart's own reconciliation */
  const [evtOpen, setEvtOpen] = useState(null);
  const pickEv = (e) => { setEvtOpen((cur) => (cur && cur.e === e ? cur : { e })); rdEventReveal("evt-a-" + e.badgeKey); };
  const eDate = (D.cycles.find((c) => c.current) || {}).eDate;
  /* the polls the meta line counts: "national" here, "Victorian" on /vic/ */
  const pollsWord = window.JUR ? window.JUR.adj : "national";
  /* /vic/'s lines are a smoothed trend through every poll (gen-data §1a) */
  /* federal: the lines are the primary model's (gen-data §2m) – its estimate at
     each month's middle, the band its 95% interval */
  const PMD = !window.JUR && !!(D.latest && D.latest.primaryModel);
  const KAL = !!(D.latest.method && D.latest.method.kind === "kalman");
  const meta = G
    ? (T.model ? "Modelled from every poll this term; " + rdList(G.houses.map(demoHouse)) + " in the last " + T.window : "Pooled from the last " + T.window + " of " + rdList(G.houses.map(demoHouse)) + " polls")
    : pvx
      ? pvxMeta.n + " " + pollsWord + " polls from the selected pollsters, latest fieldwork " + rdDate(pvxMeta.latest, !narrow)
      : narrow
        ? D.latest.pollsTracked + " " + pollsWord + " polls, latest fieldwork " + rdDate(D.latest.updatedISO)
        : D.latest.pollsTracked + " " + pollsWord + " polls since the " + (eDate ? rdDate(eDate, true) + " " : "") + "election, latest fieldwork " + rdDate(D.latest.updatedISO, true);
  const toggle = (id) => setHidden((h) => {
    const next = { ...h, [id]: !h[id] };
    return (parts || []).every((p) => next[p.id]) ? {} : next;   // never an empty chart
  });
  /* a group's monthly run can peak over the all-voters chart's fixed 40
     (rural One Nation reaches it): the axis then lifts to the next ten,
     y-domain and ticks together. A straight all-voters view keeps the
     fixed [0,40] frame; a pollster subset's window is its own months', so
     its frame lifts to the next five over the subset's peak instead */
  const yTop = G ? Math.max(40, Math.ceil(Math.max(...gMonths.flatMap((m) =>
    GRPV_KEYS.map((kk) => m[kk] + m.ci[kk])).concat(evPts.map((d) => d.y))) * 1.0001 / 10) * 10)
    : pvx ? Math.max(40, Math.ceil(Math.max(...pvx.months.flatMap((m) =>
      GRPV_KEYS.map((kk) => (m[kk] || 0) + ((m.ci && m.ci[kk]) || 0)))) * 1.0001 / 5) * 5)
    : 40;
  const yTickSet = [0, 10, 20, 30, 40, 50, 60, 70].filter((t) => t <= yTop);

  /* ---- the history scene: a window reaching behind this term -------------
     Every past term's lines from gen-data §8v, drawn through the counts at
     both ends with the band shut on each (rdVhLines), this term's own lines
     wherever the window reaches it, and the polls as published wherever the
     window is short enough for a dot to read (4.6 years, as National
     direction draws them) - the past terms' from the Past cycles file. A
     past term's Others is what its closing count calls others, so before
     1993 it holds the Greens and from 2001 to 2016 One Nation. */
  const vhLong = histOn && vhSpan > RD_VH_LONG;
  const vhStyle = (k) => ({ label: k === "oth" ? "Others & independents" : D.PARTIES[k].name, color: D.PARTIES[k].color,
    width: vhLong ? (k === "oth" ? 1.4 : 1.6) : k === "oth" ? 2 : 2.5, dashed: k === "oth", dash: k === "oth" ? "6 4" : undefined, opacity: hideC[k] ? 0 : 1 });
  const vhL = histOn ? rdVhLines(VH, ["alp", "lnp", "grn", "onp", "oth"], xDomain[0], xDomain[1], vhStyle, { long: vhLong }) : null;
  const vhDotsOn = histOn && vhSpan <= 4.6;
  const vhHideKey = Object.keys(hideC).filter((k) => hideC[k]).sort().join("|");
  const vhScatter = React.useMemo(() => {
    if (!vhDotsOn) return [];
    const src = D.cycleSource || {};
    const out = [];
    for (const t of VH.terms) {
      if (t.b < xDomain[0] || t.a > xDomain[1]) continue;
      const rows = (src[t.year] && src[t.year].polls) || [];
      const drawn = t.lanes.filter((k) => k !== "oth" && k !== "tpp");
      for (const r of rows) {
        /* the lines count neither exit polls nor a modelled wave (gen-data
           ACC_EXCLUDED), so neither draws a dot beside them */
        if (r.firm === "Election" || /exit/i.test(r.firm || "") || r.firm === "YouGov MRP") continue;
        const x = confIsoX(r.date);
        if (x <= t.a || x > t.b || x < xDomain[0] || x > xDomain[1]) continue;
        // a base that kept undecided voters is put on a decided basis, as the lines are
        const kk = r.und != null ? 100 / (100 - r.und) : 1;
        const v = {};
        for (const k of drawn) v[k] = r[k] != null ? r[k] * kk : null;
        v.oth = drawn.every((k) => v[k] != null) ? 100 - drawn.reduce((a, k) => a + v[k], 0) : null;
        const meta = { pollster: r.firm, dateLabel: r.dateApprox ? rdVhMonth(x) : rdDate(r.date, true), pre: true };
        for (const k of drawn.concat(["oth"])) {
          if (v[k] == null) continue;
          out.push({ x, y: +v[k].toFixed(2), color: D.PARTIES[k].color, label: k === "oth" ? "Others & independents" : D.PARTIES[k].name,
                     meta, party: k, op: hideC[k] ? 0 : undefined,
                     sub: r.und != null ? "On a decided basis: the " + r.und + "% undecided left out" : undefined });
        }
      }
    }
    return out;
  }, [vhDotsOn, xDomain[0], xDomain[1], srcTick, vhHideKey]);
  const yTopH = !histOn ? yTop : Math.max(40, Math.ceil(Math.max(0,
    ...vhL.series.filter((sr) => sr.opacity !== 0).flatMap((sr) => sr.points.filter((q) => q.x >= xDomain[0] - 0.1 && q.x <= xDomain[1] + 0.1).map((q) => q.y + (q.ci || 0))),
    ...(curIn ? chartSeries.filter((sr) => sr.opacity !== 0).flatMap((sr) => sr.points.map((q) => q.y)) : []),
    ...vhScatter.filter((d) => d.op !== 0).map((d) => d.y)) * 1.0001 / 10) * 10);
  const yd = useConfChase([0, yTopH], !!(vw.drag && histOn));
  /* the strip's one line: Labor and the Coalition together, every past
     month drawn through the counts and this term's months as the polls */
  const vhStripLines = React.useMemo(() => {
    if (!VH || !vwOn) return [];
    const out = [];
    for (const t of VH.terms) {
      const lnp = new Map((t.series.lnp || []).map((m) => [m[0], m[1]]));
      if (t.open.alp != null && t.open.lnp != null) out.push({ x: t.a, y: t.open.alp + t.open.lnp });
      for (const m of t.series.alp || []) if (lnp.has(m[0])) out.push({ x: m[0], y: m[1] + lnp.get(m[0]) });
    }
    for (const d of D.aggPrimary) if (d.alp != null && d.lnp != null) out.push({ x: d.x, y: d.alp + d.lnp });
    out.sort((p, q) => p.x - q.x);
    return [{ color: "var(--ink-2)", points: out }];
  }, [VH, vwOn]);
  const H = (() => {
    if (!histOn) return null;
    const L = vhL;
    /* this term's ring IS the last term's closing count: drawn once */
    const vhMarks = curIn && base ? L.marks.filter((m) => Math.abs(m.x - base.x) > 1e-6) : L.marks;
    const lone = L.lone.map((q) => ({ x: q.x, y: q.y, color: q.color, label: q.label, party: q.party, op: hideC[q.party] ? 0 : undefined,
      meta: { pollster: "Monthly average", dateLabel: rdVhMonth(q.x), pre: true }, sub: "Drawn through the election results; the " + q.note }));
    const curStops = curIn ? pts.filter((d) => d.x >= xDomain[0] - 1e-6).map((d) => ({ x: d.x, y: d.alp, ym: d.ym, cur: true, elec: !!d.election })) : [];
    const spine = [...new Map(L.stops.map((q) => [q.x.toFixed(4), q]).concat(curStops.map((q) => [q.x.toFixed(4), q]))).values()]
      .filter((q) => q.x >= xDomain[0] - 1e-6 && q.x <= xDomain[1] + 1e-6).sort((p, q) => p.x - q.x);
    const curYear = (vwTerms.find((t) => t.current) || {}).year;
    const bridges = L.series.some((sr) => sr.dash === RD_VH_BRIDGE);
    const unmeasured = VH.terms.filter((t) => t.miss.alp == null && t.b > xDomain[0] && t.a < xDomain[1]);
    return {
      series: (curIn ? chartSeries.map((sr) => ({ ...sr, ...(vwAtNow ? {} : { endLabel: null }), ...(vhLong ? { rdWidth: sr.id === "oth" ? 1.4 : 1.6 } : {}) })) : []).concat(L.series),
      areas: (curIn && !vhLong ? areas : []).concat(L.areas),
      marks: (curIn ? marks : []).concat(vhMarks),
      scatter: (curIn && vhDotsOn ? shownScatter : []).concat(vhScatter, lone),
      spine,
      title: (i) => {
        const q = spine[i];
        if (!q) return "";
        if (q.count || q.elec) return "The " + (q.count || curYear) + " election";
        return q.cur ? monthLabelFull(q.ym) : rdVhMonth(q.x);
      },
      extra: (i) => {
        const q = spine[i];
        if (!q) return [];
        if (q.count || q.elec) return [{ label: "", value: "The election result" }];
        if (!q.cur) return [{ label: "", value: "Drawn through the election results" }];
        const d = pts.find((r) => r.x === q.x);
        return d && d.ci ? [{ label: "95% intervals", value: visible.map((p) => "±" + (d.ci[p.id] != null ? d.ci[p.id].toFixed(1) : "–")).join(" ") }] : [];
      },
      bridges, unmeasured,
      ticks: rdVwTicks(vwWin, vwTerms),
    };
  })();

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
        /* an election-time figure's margin rides in the title - the polls'
           pooled figure then, or (generations) the AES's, which names
           itself: a survey's election figure, not the count */
        const w = p.was != null ? { v: p.was, since: aesGrp ? "the election (AES)" : "the election" } : (gWas && gWas[p.id] != null ? { v: gWas[p.id], since: rdMonthYear(gWas.ym) } : null);
        const wTitle = p.was == null ? undefined
          : pelGrp ? "Measured from the polls’ figure for this group " + RD_PEL_WHEN + ", ±" + (p.wasCi || 0).toFixed(1) + " points"
          : aesGrp ? "Measured from the Australian Election Study 2025’s figure for this group, ±" + (p.wasCi || 0).toFixed(1) + " points" : undefined;
        return w && (
          <span className="rd-pv-chg" title={wTitle}>{rdArrow(p.v - w.v)} {Math.abs(p.v - w.v).toFixed(1)} since {w.since}</span>
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
    if (vwOn && VH) {
      const w = rdVwStep(vwWin.kind === "term-carry" ? { kind: "term", year: vwWin.year } : vwWin, dir, vwTerms, vwLo, vwHi);
      if (!w) return false;
      if (cardEl.current) rdPinScroll(cardEl.current);
      const st = rdVwSettle(w, vwTerms, vwHi);
      if (st.rangeId && st.rangeId !== rangeId) setRangeId(st.rangeId);
      rdVwPut(st.hist, false);
      return true;
    }
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

  /* a closed <select> still sizes itself to its WIDEST option, so "Lower
     earners (bottom 50%)"'s 180px of text framed the three-letter "Men"
     the day income's bands joined the menu. Hold the control to the label
     it actually shows instead: measure that label in the control's own
     font, add back its paddings and a 14px slack (the text-to-frame gap,
     calibrated against the max-content width before this fix - 249px for
     the 234px padding-plus-widest-label sum). Runs before paint on every
     selection and again once the webfont lands - a fallback-font measure
     would otherwise freeze the early render's width. */
  const grpSelRef = React.useRef(null);
  const pvSelRef = React.useRef(null);
  React.useLayoutEffect(() => {
    [grpSelRef, pvSelRef].forEach((r0) => {
      const el = r0.current;
      if (!el) return;
      const fit = () => {
        const cs = getComputedStyle(el);
        const cv = document.createElement("canvas").getContext("2d");
        cv.font = cs.fontWeight + " " + cs.fontSize + " " + cs.fontFamily;
        el.style.width = Math.ceil(cv.measureText(el.options[el.selectedIndex].textContent).width
          + parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) + 14) + "px";
      };
      fit();
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
    });
  }, [grpId, hvKey]);

  /* the menu's longest options buy its width, so the two income bands
     print their short names in the MENU text alone (user call 2026-10-19),
     values untouched: the head's "Among lower earners (bottom 50%)", the
     Who-votes tab, the lift note and the All-polls hand-off all keep the
     full labelled names */
  const MENUSHORT = { "Lower earners (bottom 50%)": "Lower earners", "Higher earners (top 15%)": "Higher earners" };

  return (
    <RdSec id="primary-vote" title="Primary vote" meta={meta}>
      <div className="rd-pv-head">
        <RdHed head={story.head} dek={story.dek} />
        {T && (
          <select ref={grpSelRef} className="rd-pv-sel" aria-label="The primary vote among" value={grpId}
                  onChange={(e) => setGrpId(e.target.value)}>
            <option value="">All voters</option>
            {T.tabs.map((t) => t.sets.map((s) => (
              <optgroup key={s.id} label={s.label || "By " + t.label.toLowerCase()}>
                {s.groups.map((g) => <option key={g.label} value={g.label}>{MENUSHORT[g.label] || g.label}</option>)}
              </optgroup>
            )))}
          </select>
        )}
        {pvMenuOK && !G && (
          /* the ALL POLLSTERS menu (its figures live beside `hvSel` above):
             the All-polls filter bar's tick-menu pattern - the select holds
             no value, a pick ticks or unticks the house ("__clear" wipes the
             set) and the label snaps back, to "N pollsters" while a subset
             counts. Hidden in group mode: a group's figures are §7g's pooled
             reads and a house subset can't recompose them, so no recomputed
             view would sit behind whatever the menu said */
          <select ref={pvSelRef} className="rd-pv-sel" aria-label="The primary vote counted from only some pollsters" value=""
                  onChange={(e) => { const v = e.target.value; if (v === "__clear") setHvSel(new Set()); else if (v) setHvSel((s) => { const n = new Set(s); if (n.has(v)) n.delete(v); else n.add(v); return n; }); }}>
            <option value="" disabled>{hvSel.size ? hvSel.size + (hvSel.size === 1 ? " pollster" : " pollsters") : "All pollsters"}</option>
            {D.pvHouses.map((h) => <option key={h} value={h}>{(hvSel.has(h) ? "✓ " : "") + h}</option>)}
            {hvSel.size > 0 && <hr />}
            {hvSel.size > 0 && <option value="__clear">✕ Clear</option>}
          </select>
        )}
      </div>
      {narrow ? (
        <div className="rd-pv-list">
          {pvBlocks.map((b, i) => b.tied ? (
            <div key={"tg" + i} className="rd-pv-group">
              <div className="rd-pv-grouph">Within the margin of uncertainty</div>
              {b.tied.map(stat)}
            </div>
          ) : (
            <div key={"rt" + i} className="rd-pv-rest">{b.rest.map(stat)}</div>
          ))}
        </div>
      ) : (
        <div className="rd-pv-stats">
          {levelBands.map((b) => (
            <div key={"lv" + b.run[0].id} className="rd-pv-bracket" style={{ gridColumn: b.col + " / span " + b.run.length }}>
              <span></span>Within the margin of uncertainty<span></span>
            </div>
          ))}
          {(parts || []).map(stat)}
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
        {vwOn ? (
          /* the two vote charts' one window (rd-hero.jsx): ‹ › and the
             chips, the same bar National mood and Economic sentiment carry;
             the pin holds this card on screen while the shared window
             reshapes the two-party card above it */
          <RdVoteWinBar rangeId={rangeId} setRangeId={setRangeId} hist={histOn ? vw.hist : null} terms={vwTerms}
                        lo={vwLo} hi={vwHi} ready={!!VH} pin={() => { if (cardEl.current) rdPinScroll(cardEl.current); }} />
        ) : (
          <RdTabs value={rangeId} onChange={setRangeId} options={RD_RANGES} ariaLabel="Time range" className="rd-tabs-sm" swipeSelf pin />
        )}
        <TrendChart
          key="rd-pv"
          heightPx={narrow ? 320 : 440}
          /* a past term's window closes on its election, the axis's last
             label at the right edge: room for the word */
          padPx={narrow ? { l: 34, r: H && vwWin.kind === "term" ? 26 : 6, t: 34, b: 28 } : { l: 40, r: H && vwWin.kind === "term" ? 28 : 16, t: 44, b: 30 }}
          xDomain={xDomain} yDomain={H ? yd : [0, yTop]} yTicks={H ? confTicksIn(yd, 10).filter((t) => t > 0) : yTickSet}
          yTickFmt={(v) => (v === 0 ? "" : v + "%")} baseline driven={!!(H && vw.drag)}
          /* the axis landmark is the election itself even where a group's
             count was never cut (no ring, no sub-lines there): the window
             opens on election night, so without it the first tick reads
             "May 2025" against the all-voters chart's "Election" */
          xTicks={H ? H.ticks : rdElectionTicks(xDomain[0], xDomain[1], narrow, base ? base.x : allBase ? allBase.x : null)}
          series={H ? H.series : chartSeries.concat(leads).concat(evLeads)}
          spine={H ? H.spine : (elecStop ? [elecStop] : []).concat(series(live("alp"), "alp"))}
          areas={H ? H.areas : areas}
          /* a group view's dots open the poll on All polls' Demographics
             facet, its split the view's own (Gen Z → Age, Renting → Home);
             the all-voters chart keeps the Primary facet */
          scatter={H ? H.scatter : shownScatter}
          /* a past term's poll lives in Past cycles, not All polls: its dot
             reads out but opens nothing */
          pollFacet={H ? ((m) => (m && m.pre ? null : "primary")) : G ? "demographics" : "primary"}
          pollSplit={G ? sel.tabId : undefined}
          marks={H ? H.marks : marks} ringAtX={H ? null : base ? base.x : null}
          events={elecRules ? [] : badges ? badges.events : evs}
          vlines={elecRules ? evs.map((e) => ({ x: e.x, cls: "rd-conf-evrule" })) : []}
          evt={evtOpen} onEvt={setEvtOpen}
          /* elecStop shifts title/row lookups one place: stop 0 is the
             count itself (the rings' "2025-05" title + ring row), the
             polls' triangles or the AES diamonds' stop, the months sit
             one index back */
          tooltipTitle={H ? H.title : (i) => (elecStop && i === 0 ? monthLabelFull("2025-05") : pts[elecStop ? i - 1 : i] ? monthLabelFull(pts[elecStop ? i - 1 : i].ym) : "")}
          extraRows={H ? H.extra : (i) => {
            if (elecStop && i === 0) return gElecStop
              ? [{ label: "", value: "The election result" }]
              : [{ label: "", value: evGrp.src === "both" ? "Estimated from the polls before the election and the Australian Election Study 2025"
                  : evGrp.src === "polls" ? "The polls " + RD_PEL_WHEN
                  : "Australian Election Study 2025, " + evGrp.aesN.toLocaleString() + " respondents" }];
            const d = pts[elecStop ? i - 1 : i];
            if (!d || !d.ci || d.election) return d && d.election ? [{ label: "", value: "The election result" }] : [];
            return [{ label: "95% intervals", value: visible.map((p) => "±" + (d.ci[p.id] != null ? d.ci[p.id].toFixed(1) : "–")).join(" ") }];
          }}
          /* a group view's dot is drawn at a lifted y (the trend plus this
             wave's group-vs-all-voters gap) but tips the figure the wave
             printed - the engine's own display-transform precedent (the
             mood panel's NAB line, drawn +100, tips the net balance); an
             AES diamond tips the AES's own share the same way */
          fmt={(v, pt) => (G && pt && pt.gv != null ? pt.gv : v).toFixed(1)}
          /* read away from the page, the copy names its measure and its
             base as well as the finding: "Primary vote" over "Labor and One
             Nation are level" said neither whose votes nor how many polls */
          copy={H ? {
            title: "First-preference vote for each party", span: confWinYears(vwWin, vwTerms, vwHi),
            sub: "Past terms drawn through the election results at both ends" + (curIn ? "; this term is the polls alone" : "")
              + ". Monthly averages of the polls, adjusted for each pollster’s lean.",
            caption: (vhDotsOn ? "Each dot is one poll as published; lines" : "Lines") + " are monthly averages moved toward each past term’s closing result by part of the polls’ miss there, shaded bands their 95% intervals"
              + " with the doubt about when the miss arose." + (PMD ? " This term’s lines are the model’s." : "") + (H.bridges ? " Dotted stretches are months no one polled." : ""),
            legend: visible.map((p) => ({ label: p.name, color: p.color, kind: p.id === "oth" ? "dashed" : "line" }))
              .concat([{ label: "Election result", color: "var(--ink)", kind: "ring" }]),
          } : { title: "First-preference vote for each party" + (G ? ", " + sel.who : pvx ? ", selected pollsters" : ""), sub: story.head + (G ? (PMD ? ". The model’s estimate for " + sel.who + " at each month’s middle, latest fieldwork " : ". Monthly averages of the readings every poll reported for " + sel.who + ", latest fieldwork ") + rdDate(D.latest.updatedISO, true) + "." : pvx ? (PMD ? ". The model re-run on " : ". Monthly averages of ") + pvxMeta.n + " " + pollsWord + " polls from the selected pollsters, latest fieldwork " + rdDate(pvxMeta.latest, true) + "." : (KAL ? ". Smoothed trends through " : PMD ? ". The model’s estimates from " : ". Monthly averages of ") + D.latest.pollsTracked + " " + pollsWord
                    + " polls since the " + (eDate ? rdDate(eDate, true) + " " : "") + "election, latest fieldwork " + rdDate(D.latest.updatedISO, true) + "."),
                  caption: KAL ? "Each dot is one poll; lines are smoothed trends, shaded bands their 95% intervals."
                    : G ? "Each dot is one poll’s reading of " + sel.who + " less its own all-voters figure, drawn onto the trend; lines are " + (PMD ? "the model’s estimates at each month’s middle" : "monthly averages") + ", shaded bands their 95% intervals."
                      + (evOn ? " The diamonds at the election are estimates of how " + sel.who + " voted, from "
                        + (evGrp.src === "both" ? "the polls before polling day and the Australian Election Study 2025 together." : evGrp.src === "polls" ? "the polls " + RD_PEL_WHEN + "." : "the Australian Election Study 2025.") : "")
                      /* the income bands' own caveat, from the payload's one
                         copy of it (the Who-votes dek's note is the same) */
                      + (sel.tabId === "income" ? " " + rdCap(D.demoIncome.sets[0].note) + "." : "")
                      + (sel.label === "ACT/NT/Tas" ? " Open rings are single-territory readings - Tasmania, the ACT or the NT alone, their own poll or crosstab - shown for comparison, never pooled into the lines." : "")
                    : "Each dot is one poll; lines are " + (PMD ? "the model’s estimates at each month’s middle" + (pvx ? ", re-run on the selected pollsters" : "") : "monthly averages" + (pvx ? " of the selected pollsters" : "")) + ", shaded bands their 95% intervals.",
                  legend: visible.map((p) => ({ label: p.name, color: p.color, kind: p.id === "oth" ? "dashed" : "line" }))
                    .concat(evOn ? [{ label: RD_VOTE_LABEL, color: "var(--ink-3)", kind: "diamond" }] : []) }}
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
        {/* the whole record in miniature under the chart, the window on it
            (Economic sentiment's strip): one line, Labor and the Coalition's
            first preferences together, with the governments beneath */}
        {vwOn && VH && (
          <RdConfStrip lines={vhStripLines} lo={vwLo} hi={vwHi} win={vwWin} terms={vwTerms}
                       onWin={rdVwOnStrip(rangeId, setRangeId, vwTerms, vwHi, () => { if (cardEl.current) rdPinScroll(cardEl.current); })}
                       narrow={narrow} label="Labor and the Coalition’s first preferences together" />
        )}
        {/* what the past terms' lines are, beside them */}
        {H && (
          <p className="rd-note">Past terms are drawn through the election results at both ends. By polling day the polls typically miss Labor’s result by about {VH.rms.alp.toFixed(1)} points and the Coalition’s by {VH.rms.lnp.toFixed(1)}, so every month of a past term is moved by part of its closing election’s miss: two-fifths of it from the first month, rising evenly to all of it on polling day. {vhLong ? "Over a dozen years or more the bands are left off; a shorter window shows them, with the doubt about when the miss arose. " : "The shaded band includes the doubt about when the miss arose. "}{vhDotsOn ? "The dots are the polls as published. " : ""}{curIn ? "This term is the polls alone: no election has measured it yet. " : ""}{H.unmeasured.length ? "No dated poll fell in the final three weeks before the " + rdList(H.unmeasured.map((t) => String(t.src))) + " elections, so " + (H.unmeasured.length === 1 ? "that term is" : "those terms are") + " the polls alone." : ""}</p>
        )}
        {/* the lift mapping, where the dots are read - the glossary's "The
            group views" paragraph is the deep version; a dot's tooltip
            tips the printed figure and the Demographics facet lists them */}
        {G && (
          <p className="rd-note">Each dot is one poll’s reading of {sel.who} less that poll’s own all-voters figure, drawn onto the trend; it is never the cut the poll printed, which sits beside every other poll’s in All polls’ Demographics view.{sel.tabId === "income" ? " " + rdCap(D.demoIncome.sets[0].note) + "." : ""}</p>
        )}
        <RdKey className="rd-ckey" items={H ? [
          vhDotsOn ? { kind: "dot", color: "var(--ink-3)", label: "One poll, as published" } : null,
          vhLong ? { kind: "line", color: "var(--ink-3)", label: "Monthly average" }
            : { kind: "lineband", color: "var(--ink-3)", label: narrow ? "Monthly average, 95% interval" : "Monthly average and its 95% interval" },
          { kind: "ring", label: "Election result" },
          H.bridges ? { kind: "dots", color: "var(--ink-3)", label: "No polls" } : null,
        ] : [
          { kind: "dot", color: "var(--ink-3)", label: "One poll" },
          { kind: "lineband", color: "var(--ink-3)", label: KAL ? (narrow ? "Trend, 95% interval" : "Trend and its 95% interval") : PMD && !G ? (narrow ? "Model, 95% interval" : "Model estimate and its 95% interval") : narrow ? "Monthly average, 95% interval" : "Monthly average and its 95% interval" },
          base ? { kind: "ring", label: rdElecYear + " election result" } : null,
          evOn ? { kind: "diamond", color: "var(--ink-3)", label: RD_VOTE_LABEL } : null,
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
    // a skipped section's bar is fitted by the observer on approach (cvSkipped)
    if (!cvSkipped(el)) fit();
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
  /* the houses that ask a leader question, for the copy's credits:
     /vic/'s are read off its polls; the federal rosters come from the
     bundle (apprBy below) */
  const jHouses = (test) => {
    const n = new Map();
    D.individualPolls.forEach((q) => { if (test(q)) n.set(q.pollster, (n.get(q.pollster) || 0) + 1); });
    const l = [...n.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).map(([k]) => k);
    return l.length > 4 ? l.slice(0, 3).join(", ") + " and others" : rdList(l);
  };
  const jApprBy = (fav) => jHouses((q) => q.appr && ["alb", "taylor", "hanson"].some((k) => q.appr[k + "Net"] != null && ((q.appr.metricBy || {})[k] === "fav") === fav));
  /* the federal rosters are derived in gen-data from the approval series
     (D.favHouses / D.apprHouses: a house is credited only where it asked
     the question within six months of the series' own newest reading, and
     a stopped house rides last as "Name (inactive)"), so the copies can't
     fall behind a house that started or stopped asking */
  const capped = (l) => (l && l.length ? (l.length > 5 ? l.slice(0, 3).join(", ") + " and others" : rdList(l)) : "");
  const apprBy = (fav) => (J ? jApprBy(fav) : capped(fav ? D.favHouses : D.apprHouses));
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

  /* ---- the headline: preferred PM against net approval ------------------
     A lead is said only where it clears its own margin (2026-10-11: a 41-39
     split had read "still leads"): the pooled lead from gen-data where it
     has one (leaderLead - each poll's own lead, the difference of two shares
     of one sample), else the two shares' margins widened for moving against
     each other, as two shares of one sample do. Inside the margin the two
     are "level", as the 2PP and primary heads say. */
  const leadTest = (L, ka, kb) => {
    if (L) return Math.abs(L.v) > L.ci95;
    const A = N[ka], B = N[kb];
    if (!A || !B) return false;
    if (A.se == null || B.se == null) return Math.abs(A.v - B.v) >= 4;
    const pa = A.v / 100, pb = B.v / 100, rho = Math.sqrt((pa * pb) / ((1 - pa) * (1 - pb)));
    return Math.abs(A.v - B.v) > 1.96 * Math.sqrt(A.se ** 2 + B.se ** 2 + 2 * rho * A.se * B.se);
  };
  const LL = D.leaderLead || {};
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
    const K3 = { [pm.id]: "alb_pref3", [opp.id]: "taylor_pref3", [han.id]: "hanson_pref3" };
    const sig = two ? leadTest(null, "alb_pref", "taylor_pref") : leadTest(null, K3[t3[0][0].id], K3[t3[1][0].id]);
    const second = two ? (top === pm ? opp : pm) : t3[1][0];
    const head = sig ? top.short + " leads as preferred " + J.office.alb : top.short + " and " + second.short + " are level as preferred " + J.office.alb;
    let dek = two
      ? "Head to head, " + top.short + (sig ? " leads " + second.short + " " : " and " + second.short + " are level, ") + r1(Math.max(a, o)) + "–" + r1(Math.min(a, o)) + "."
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
    const oppSig = leadTest(LL.taylor, "alb_pref", "taylor_pref");
    const leads = a > o, lead = a - o;
    /* the approval move since the first month, said when it is large (ten
       points or more) AND clears the two readings' margins */
    const fall = first.alb_net - net;
    const fallSig = Math.abs(fall) >= 10 && Math.abs(fall) > Math.hypot(N.alb_net ? N.alb_net.ci95 || 0 : 0, first.alb_netCi || 0);
    const round5 = (v) => Math.round(v / 5) * 5;
    const moved = (fall > 0 ? "fallen " : "risen ") + round5(Math.abs(fall)) + " points";
    /* "but his" only after his own lead; level or behind, the approval is
       named as Albanese's, never a "his" that could read as Taylor's */
    const head = !oppSig ? pm.short + " and " + opp.short + " are level as preferred PM" + (fallSig ? ", and " + pm.short + "’s net approval has " + moved : "")
      : leads ? pm.short + " still leads as preferred PM" + (fallSig ? ", but his net approval has " + moved : "")
      : opp.short + " leads as preferred PM" + (fallSig ? ", and " + pm.short + "’s net approval has " + moved : "");
    const leyRows = LM.filter((r) => r.alb_pref != null && r.ley_pref != null);
    const leyLead = leyRows.length ? leyRows.reduce((s, r) => s + r.alb_pref - r.ley_pref, 0) / leyRows.length : null;
    const hanLead = aH != null && h != null ? aH - h : null;
    const hanSig = hanLead != null && leadTest(LL.hanson, "alb_prefH", "hanson_prefH");
    /* "held steady since it was first measured": the running lead within its
       own margin of the contest's first monthly reading */
    const hanRows = LM.filter((r) => r.alb_prefH != null && r.hanson_prefH != null);
    const hanSteady = hanLead != null && hanRows.length > 0
      && Math.abs(hanLead - (hanRows[0].alb_prefH - hanRows[0].hanson_prefH)) <= (LL.hanson ? LL.hanson.ci95 : 4);
    /* "narrowed": the Ley-era average lead (many months, a small margin) down
       by more than the current lead's own margin */
    const narrowed = leyLead != null && leads && leyLead - lead > (LL.taylor ? LL.taylor.ci95 : 4);
    let dek = narrowed
      ? (oppSig ? "His" : pm.short + "’s") + " lead over the opposition leader has narrowed from " + signed0(leyLead) + " under Ley to " + signed0(lead) + " under " + opp.short + (oppSig ? "." : ", inside the margin of error.")
      : !oppSig ? "He and " + opp.short + " are level head to head, " + r1(a) + "–" + r1(o) + "."
      : (leads ? "He leads " : "He trails ") + opp.short + " " + r1(Math.max(a, o)) + "–" + r1(Math.min(a, o)) + " head to head.";
    if (hanLead != null && !hanSig) dek += " Head to head with " + han.short + ", the two are level.";
    else if (hanLead != null && hanLead > 0)
      dek += " Over " + han.short + (oppSig && hanLead > lead ? " his lead is greater (" + signed0(hanLead) + ")" + (hanSteady ? ", and has held steady since it was first measured." : ".")
        : " he leads by " + r1(hanLead) + " points" + (hanSteady ? ", a lead that has held steady since it was first measured." : "."));
    else if (hanLead != null) dek += " " + han.short + " leads him by " + r1(-hanLead) + " points head to head.";
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
     the spread the key tells readers to expect, shown rather than asserted.
     House-level skip as cloudFor's (the 3PP aggregates are NO_AGG_HOUSES
     level too): Roy Morgan's SMS waves print three-way shares nationally,
     but none of its readings enters a line here */
  const threeDots = kept("threeDots", () => D.individualPolls.filter((q) => !q.noAggHouse && q.x >= xDomain[0] && q.x <= xDomain[1])
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
    /* the lines read appraisals at NO_AGG_HOUSES level (gen-data's apprAgg),
       so the dots draw at exactly its altitude: a combined wave's ratings
       count (q.noAgg but not noAggHouse) and stay; a whole excluded series
       (Roy Morgan's SMS waves) draws nothing */
    return D.individualPolls.filter((q) => q.appr && !q.noAggHouse && q.x >= xDomain[0] && q.x <= xDomain[1])
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
            legend: [], caption: keyDots + " Polls by " + apprBy(true) + "." }
        : { title: "Net approval of " + leaderNames, sub: "Approve minus disapprove of the job each leader is doing, month by month",
            legend: [], caption: keyDots + " Polls by " + apprBy(false) + "." },
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
    <RdSec id="leadership" cls="rd-lead" title="Leadership" meta={J ? "Preferred " + J.office.alb + " and net approval, " + jHouses((q) => !!(q.ppm || q.ppmSets || (q.appr && (q.appr.albNet != null || q.appr.taylorNet != null)))) : "Preferred PM and net approval, " + capped(D.apprHouses)}>
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
            : metric === "fav" ? "Favourable minus unfavourable views of each leader as a person. " + apprBy(true) + "."
            : "Approve minus disapprove of the job each leader is doing. " + apprBy(false) + ".",
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
/* The National mood section (2026-11-02, was "National direction"): the
   direction question and trust in the federal government, two views of one
   mood behind a tab row, as The issues section holds its two. Direction is
   the data-rich view and opens first; Trust rests on far fewer readings and
   says so. Without trust data the section is the direction view alone. */
function RdDirection({ rangeId }) {
  const { D } = window.AP;
  const narrow = useNarrow(MQ_PHONE);
  const [view, setView] = React.useState("direction");
  if (!D.direction.length) return null;
  const hasTrust = !!(D.trustGov && D.trustGov.series && D.trustGov.series.length);
  const v = hasTrust ? view : "direction";
  const asked = rdList(D.directionHouses || []);
  const question = "‘Is the country heading in the right direction, or on the wrong track?’";
  const tQuestion = "Trust and confidence in the federal government";
  const tHouses = hasTrust ? rdList(D.trustGov.series.filter((s) => s.role !== "line" && !/-avg$/.test(s.id)).map((s) => s.house)) : "";
  const meta = v === "direction"
    ? (narrow ? question : question + (asked ? ", " + asked : ""))
    : (narrow ? tQuestion : tQuestion + ", ANUpoll with " + tHouses);
  return (
    <RdSec id="direction" cls="rd-dir" title="National mood" meta={meta}>
      {hasTrust && (
        <RdTabs swipe value={v} onChange={setView} ariaLabel="View" className="rd-is-tabs rd-mood-tabs"
                options={[{ id: "direction", label: "Direction" }, { id: "trust", label: "Trust in government" }]} />
      )}
      <RdCrossfade k={v}>
        {v === "direction" ? <RdDirectionView rangeId={rangeId} /> : <RdTrust />}
      </RdCrossfade>
    </RdSec>
  );
}

/* ---- Trust in the federal government (the mood section's second view) ----
   Built from gen-data §5t (data/trust-government.json). Every survey asks
   its own question, so nothing is pooled and no house lean is estimated:
   too few readings per house to set one against another. ANUpoll draws the
   line – the only survey asked quarterly – broken where it moved panels in
   2024; each other survey rides as its own dots at its own level. The long
   view gives each long series its own line, and puts the OECD average only
   beside the OECD's own Australian figure, never behind ANUpoll's line
   (its 0–10 scale sits higher: Australia is ABOVE the average on the
   OECD's question while ANUpoll's line sits below the average's level).
   Every head and dek is written from the data by the rules beside it. */
const TRUST_COLOR = {
  anupoll: "var(--mood-pos)", essential: "var(--macro-cpi)", mckinnon: "var(--ink-2)",
  scanlon: "var(--confidence-main)", aes: "var(--confidence-alt)", "oecd-au": "var(--macro-gdppc)", "oecd-avg": "var(--macro-gdppc)",
  "essential-parliament": "var(--ink-3)", edelman: "var(--trust-edelman)", "edelman-avg": "var(--trust-edelman)",
};
/* federal polling days the trend view ticks, as the vote charts tick theirs */
const TRUST_ELECTIONS = [{ date: "2022-05-21", label: "May 2022" }, { date: "2025-05-03", label: "May 2025" }];
const trustDx = (iso) => { const [y, m, d] = iso.split("-").map(Number); return y + (m - 1 + (d - 1) / 30.5) / 12; };
const trustMonth = (ym) => { const [y, m] = ym.split("-").map(Number); return window.AP.D.monthNameFull(m) + " " + y; };
/* Trust in government with the model (gen-data §5t, trust-model.mjs): one
   line from every survey, printed on ANUpoll's terms, its 95% band; every
   survey's readings as printed on the Since-2020 view, moved onto ANUpoll's
   terms by each survey's lean on the long view. Without a model the views
   fall back to RdTrustSeparate (each survey on its own question). */
function RdTrust() {
  const { D } = window.AP;
  if (!D.trustGov.model) return <RdTrustSeparate />;
  return <RdTrustModel />;
}
function RdTrustModel() {
  const { D } = window.AP;
  const narrow = useNarrow(MQ_PHONE);
  const M = D.trustGov.model, now = M.now;
  const S = Object.fromEntries(D.trustGov.series.map((s) => [s.id, s]));
  const pts = (n) => Math.abs(n).toFixed(1);
  const color = TRUST_COLOR.anupoll;
  const credit = (s, r) => ({ pollster: s.house, dateLabel: r.field || trustMonth(r.date) + (r.approxDate ? " (approx.)" : ""), sample: r.n || null });

  /* ---- the window: the direction panel's machinery (term / 10 yrs / 25 yrs /
     All, ‹ ›, the strip with the governments beneath), over every reading on
     file since 1969; the line is drawn from where its band is under 20 points */
  const nowX = D.domain.x1;
  const TERMS = React.useMemo(() => confTermsOf(D), [D]);
  const curTerm = TERMS.find((t) => t.current) || TERMS[TERMS.length - 1];
  const [winS, setWinS] = React.useState(() => confTermWin(curTerm, nowX));
  const [dragging, setDragging] = React.useState(false);
  const onWin = React.useCallback((w, phase) => { setWinS(w); setDragging(phase === "drag"); }, []);
  const adjDotsAll = Object.entries(M.adj).flatMap(([sid, rs]) => rs.map((r, i) => {
    const s = S[sid], orig = s && s.readings[i];
    return { x: r.x, y: r.v, color: TRUST_COLOR[sid] || "var(--ink-3)", label: (s ? s.house : sid) + ", on ANUpoll’s terms",
      sub: orig ? "Printed: " + orig.v + "% (" + s.measure.split(" (")[0].toLowerCase() + ")" : undefined,
      meta: s && orig ? credit(s, orig) : { pollster: sid }, hollow: !!(orig && (orig.panel === "lia" || orig.mode === "tel")), size: 1.1 };
  }));
  const ext = { lo: Math.min(...adjDotsAll.map((d) => d.x)) - 0.3, hi: nowX };
  const vTerms = confViewTerms(TERMS, ext.lo, ext.hi);
  const win = winS.kind === "term-carry" ? { kind: "custom", a: Math.max(ext.lo, winS.a), b: winS.b } : confClampWin(winS, vTerms, ext.lo, ext.hi, nowX);
  const winShown = winS.kind === "term-carry" ? { ...win, kind: "term-carry", year: winS.year } : win;
  const isTerm = win.kind === "term";
  const winTerm = isTerm ? vTerms.find((t) => t.year === win.year) : null;
  const isCur = !!(winTerm && winTerm.current);
  const xDomain = [win.a, win.b], xTicks = confWinTicks(win, vTerms, nowX);
  const inW = (x) => x >= xDomain[0] - 0.05 && x <= xDomain[1] + 0.05;
  const lineAll = M.months.filter((m) => m.ym >= M.firstOn);
  const lineW = lineAll.filter((m) => inW(m.x));
  const dots = adjDotsAll.filter((d) => inW(d.x));
  const oecd = (M.oecdAvgAdj || []).filter((r) => inW(r.x));
  const edel = (M.edelmanAvgAdj || []).filter((r) => inW(r.x));
  const series = [
    { id: "trust-model", label: "Confidence, every survey on ANUpoll’s terms", color, points: lineW.map((m) => ({ x: m.x, y: m.v })), rdWidth: 2.5, endCap: false, smooth: false,
      endLabel: narrow || !isCur ? null : "Confidence" },
    ...(oecd.length >= 2 ? [{ id: "oecd-avg-adj", label: "OECD average, on ANUpoll’s terms", color: TRUST_COLOR["oecd-avg"], points: oecd.map((r) => ({ x: r.x, y: r.v })), rdWidth: 1.5, dash: "4 4", endCap: false, smooth: false, interpHover: true }] : []),
    ...(edel.length >= 2 ? [{ id: "edelman-avg-adj", label: "Edelman global average, on ANUpoll’s terms", color: TRUST_COLOR["edelman-avg"], points: edel.map((r) => ({ x: r.x, y: r.v })), rdWidth: 1.5, dash: "4 4", endCap: false, smooth: false, interpHover: true }] : []),
  ];
  const areas = lineW.length >= 2 ? [{ id: "trust-ci", color, className: "ci-band", edge: false, smooth: false, points: lineW.map((m) => ({ x: m.x, y0: m.lo, y1: m.hi })) }] : [];
  const vals = dots.map((d) => d.y).concat(areas.flatMap((a) => a.points.flatMap((p) => [p.y0, p.y1])), oecd.map((r) => r.v), edel.map((r) => r.v));
  const lo = Math.floor(Math.min(...(vals.length ? vals : [20])) / 10) * 10, hi = Math.ceil(Math.max(...(vals.length ? vals : [60])) / 10) * 10;
  const yd = useConfChase([lo, hi], dragging);
  const elecEvs = !isCur ? confElectionEvents(win, vTerms) : [];
  const elecRules = elecEvs.length > 6;
  const evs = !isCur ? (elecRules ? [] : elecEvs) : [];
  const stripLines = [{ color: "var(--ink-2)", points: lineAll.map((m) => ({ x: m.x, y: m.v })) }];

  /* ---- words: every claim off the model's own posteriors -----------------
     head: today's share; "the lowest since <month>" only when today sits
     below every month between in 95% of draws (gen-data extreme()). dek: the
     change on a year ago, then since just after the latest election, each a
     move only when its 95% interval excludes zero; then another survey's own
     printed significant change when it agrees in direction. */
  const firstOnName = trustMonth(M.firstOn);
  const rank = (x) => !x ? "" : x.record ? ", the lowest since the line begins in " + firstOnName : ", the lowest since " + trustMonth(x.since);
  const head = plainShare(now.v) + " Australians have confidence in the federal government" + rank(now.low2020);
  const Y = now.year, E = now.election;
  const sYear = Y.sig ? (Y.chg < 0 ? "Down " : "Up ") + pts(Y.chg) + " points on a year ago" : "Not significantly changed on a year ago";
  const elecLabel = E ? trustMonth(E.date.slice(0, 7)) : "";
  const sElec = E && E.sig && E.ym !== Y.from
    ? (Y.sig && Math.sign(Y.chg) === Math.sign(E.chg) ? ", and " : ", but ") + (E.chg < 0 ? "down " : "up ") + pts(E.chg) + " points since just after the " + elecLabel + " election"
    : "";
  /* the latest significant change any survey prints, cited only when it
     runs the same way as the model's – never a pick of the agreeing ones */
  const others = D.trustGov.series.filter((s) => s.role !== "line" && !/-avg$/.test(s.id));
  const sigOther = others.map((s) => { const rs = s.readings, a = rs[rs.length - 1], b = rs[rs.length - 2]; return a && b && a.sigChange ? { s, a, b } : null; })
    .filter(Boolean).sort((p, q) => q.a.x - p.a.x)[0];
  const ref = Y.sig ? Y.chg : E && E.sig ? E.chg : 0;
  const sameWay = sigOther && ref && Math.sign(sigOther.a.v - sigOther.b.v) === Math.sign(ref);
  const dek = sYear + sElec + "." + (sameWay ? " " + sigOther.s.house + "’s own " + trustMonth(sigOther.a.date) + " survey reports a significant " + (sigOther.a.v < sigOther.b.v ? "fall" : "rise") + " too, " + pts(sigOther.a.v - sigOther.b.v) + " points in a year." : "");
  const chance = (d) => Math.round(100 * (d.chg < 0 ? d.pUp : 1 - d.pUp));
  const otherNames = rdList(Object.keys(M.adj).filter((sid) => S[sid] && sid !== "anupoll").map((sid) => S[sid].house));
  const brk = M.breaks || {};
  const spine = lineW.map((m) => ({ x: m.x, y: m.v }));
  return (
    <>
      <RdHed head={head} dek={dek} />
      <div className="rd-dir-figs">
        <div className="rd-dir-fig"><span className="rd-dir-v" style={{ color }}>{now.v.toFixed(1)}<span className="rd-dir-pct">%</span></span>
          <span className="rd-dir-k" style={{ color }}>Confidence in the federal government</span></div>
        <div className="rd-dir-fig rd-r rd-trust-meta"><span>{trustMonth(now.ym)}</span><span>95% interval {now.lo.toFixed(0)}–{now.hi.toFixed(0)}%</span></div>
      </div>
      <div className="rd-dir-bar" role="img" aria-label={`Confidence ${now.v}%, 95% interval ${now.lo} to ${now.hi}, ${trustMonth(now.ym)}`}>
        <span className="rd-dir-pos" style={{ flexBasis: now.lo + "%" }}></span>
        <span className="rd-trust-ci" style={{ flexBasis: (now.hi - now.lo) + "%" }}></span>
        <span className="rd-dir-uns rd-trust-rest" style={{ flexBasis: (100 - now.hi) + "%" }}></span>
      </div>
      <p className="rd-dir-net"><b>{rdArrow(Y.chg)} {pts(Y.chg)} on a year ago</b>{Y.sig ? "" : ", within the margin: a " + chance(Y) + "% chance it " + (Y.chg < 0 ? "rose" : "fell")}
        {E && E.ym !== Y.from ? <>; {rdArrow(E.chg)} {pts(E.chg)} since just after the {elecLabel} election{E.sig ? "" : ", within the margin"}</> : null}</p>
      <RdConfWinBar win={winShown} terms={vTerms} lo={ext.lo} hi={ext.hi} nowX={nowX} onWin={onWin} />
      <div className="card rd-card rd-dir-chart rd-trust-chart">
        <div className="rd-chead"><span className="rd-chead-t">{narrow
          ? "Confidence in the federal government, %"
          : "Confidence in the federal government, %, every survey on ANUpoll’s terms"}</span></div>
        {narrow && <RdKey items={[{ kind: "line", color, label: "Confidence" }]} className="rd-tpp-legend" />}
        <TrendChart key="rd-trust-m" heightPx={narrow ? 280 : 360}
          padPx={narrow ? { l: 34, r: 8, t: 30, b: 28 } : { l: 40, r: 16, t: 40, b: 30 }}
          xDomain={xDomain} yDomain={yd} yTicks={confTicksIn(yd, 10)} yTickFmt={(v) => (v === hi ? v + "%" : String(v))}
          xTicks={xTicks} baseline driven={dragging}
          series={series} spine={spine} areas={areas} scatter={dots}
          events={evs} vlines={elecRules ? elecEvs.map((e) => ({ x: e.x, cls: "rd-conf-evrule" })) : []}
          tooltipTitle={(i) => (lineW[i] ? trustMonth(lineW[i].ym) : "")}
          extraRows={(i) => { const m = lineW[i]; return m ? [{ label: "95% interval", value: m.lo.toFixed(1) + "–" + m.hi.toFixed(1) }] : []; }}
          fmt={(v) => v.toFixed(1)}
          copy={{ title: "Confidence in the federal government", span: confWinYears(win, vTerms, nowX),
                  sub: head + ". Every survey pooled, on ANUpoll’s terms: the share with a great deal or quite a lot of confidence in the Federal Government in Canberra.",
                  caption: "Line: a model of every survey, each moved by its own lean, shaded with its 95% interval; drawn from " + firstOnName + ", where that interval narrows under ±10 points. Dots: each survey’s readings on the same terms (" + otherNames + " and ANUpoll; open dots are ANUpoll’s earlier panel and Scanlon’s telephone years)." + (oecd.length >= 2 || edel.length >= 2 ? " Dashed: " + [oecd.length >= 2 ? "the OECD average" : null, edel.length >= 2 ? "Edelman’s global average" : null].filter(Boolean).join(" and ") + ", each moved onto the same terms by its own survey’s lean in Australia." : ""),
                  legend: [{ label: "Confidence, every survey on ANUpoll’s terms", color, kind: "line" }, { label: "Each survey’s readings, on the same terms", color: "var(--ink-3)", kind: "ring" }] }}
        />
        <RdConfStrip lines={stripLines} lo={ext.lo} hi={ext.hi} win={win} terms={vTerms} onWin={onWin}
                     narrow={narrow} label="Confidence in the federal government, every survey on ANUpoll’s terms" />
        <RdKey className="rd-ckey" items={[
          { kind: "lineband", color, label: "Every survey pooled, on ANUpoll’s terms, with its 95% interval, from " + firstOnName },
          ...Object.keys(M.adj).filter((sid) => S[sid] && dots.some((d) => d.meta && d.meta.pollster === S[sid].house))
            .map((sid) => ({ kind: "dot", color: TRUST_COLOR[sid] || "var(--ink-3)", label: S[sid].house + (sid === "anupoll" ? " (open: its earlier panel)" : sid === "scanlon" ? " (open: its telephone years)" : "") })),
          oecd.length >= 2 ? { kind: "dash", color: TRUST_COLOR["oecd-avg"], label: "OECD average, moved onto the same terms by the OECD survey’s lean in Australia" } : null,
          edel.length >= 2 ? { kind: "dash", color: TRUST_COLOR["edelman-avg"], label: "Edelman’s global average, moved onto the same terms by Edelman’s lean in Australia" } : null,
          elecRules ? { kind: "line", color: "var(--ink-3)", label: "A faint rule is a federal election; the strip beneath carries the governments" } : null,
        ].filter(Boolean)} />
      </div>
      <HowTo paras={[
        <>Every survey asks its own question – ANUpoll how much confidence people have in the Federal Government in Canberra, Scanlon whether it can be trusted to do the right thing, the AES whether people in government can be trusted, the OECD and McKinnon for a score out of 10, Edelman how far people trust “government in general” to do what is right on a nine-point scale, Essential about trust in the national government and in the federal parliament – so each has a lean of its own, measured against the others. The line is a model of all of them at once, printed on ANUpoll’s terms: the share with a great deal or quite a lot of confidence, as ANUpoll’s current panel asks it. Each dot is one survey’s reading moved onto those terms by its lean; point at one for the figure as printed.</>,
        <>The model treats trust as moving a little each month, with room for a sudden shift at each federal election and change of prime minister and at the start of the pandemic in March 2020, when confidence jumped. A survey that changed how it polls counts as a new survey: ANUpoll’s opt-in panel since 2024 reads about {pts(brk.anupoll || 0)} points below its earlier panel at the same level of trust, and Scanlon’s telephone years read about {pts(brk.scanlon || 0)} points {brk.scanlon < 0 ? "below" : "above"} its online panel. No survey responds more or less sharply than ANUpoll’s once its lean is taken out.</>,
        <>The shading is the line’s 95% interval: a 95% chance trust lies inside, under the model’s assumptions. A change is called significant only when its own 95% interval excludes zero. Before {firstOnName} the interval is wider than ±10 points, so the line starts there and earlier readings show only as dots. The two global averages are moved onto the same terms the way the Ipsos world figure is on the direction chart: each by its own survey’s lean in Australia. Each covers whichever countries took part – the OECD’s 22 in 2021 and 38 in 2025, Edelman’s 26 to 28 a year – so part of their movement is who was counted. They also count different worlds: the OECD’s are its members, while Edelman’s include China, Saudi Arabia, the UAE and India, where its readings have run from 75 to 90% in recent years – which helps explain why Edelman’s average usually sits above Australia’s line and the OECD’s below it.</>,
        <>The bar over the chart sets the window, as on the direction chart: it opens on this term; ‹ and › step a term at a time, Term, 10 yrs, 25 yrs and All widen it, and the strip underneath is the line in miniature with the governments beneath it – drag the window, drag its edges to resize, or tap a spot to jump.</>,
      ]} />
      <RdFoot how={{ term: "trust-government", from: "National mood" }}>Trust readings come a few times a year, not monthly: ANUpoll’s waves are quarterly, Scanlon’s and Edelman’s yearly, the OECD’s every two years, the AES’s after each election.</RdFoot>
    </>
  );
}

function RdTrustSeparate() {
  const { D } = window.AP;
  const narrow = useNarrow(MQ_PHONE);
  const [tab, setTab] = React.useState("recent");
  const S = Object.fromEntries(D.trustGov.series.map((s) => [s.id, s]));
  const line = D.trustGov.series.find((s) => s.role === "line");
  const R = line.readings;
  const now = R[R.length - 1], prev = R[R.length - 2];
  /* a change between two waves is said when it clears both waves' margins
     combined (independent samples: the 95% half-widths add in quadrature) */
  const clears = (a, b) => a.ci != null && b.ci != null && Math.abs(a.v - b.v) > Math.hypot(a.ci, b.ci);
  const pts = (n) => Math.abs(n).toFixed(1);

  /* ---- the trend view's words -------------------------------------------
     head: the share as a reader says it; then, if the latest wave is the
     series' lowest (or highest) reading, that; else the last earlier wave as
     low (or high) – said only when at least three waves sit between them
     and every one of those clears the latest's margin, so the claim is not
     one noisy wave deep. Black Summer names January 2020, the wave the
     report itself names. */
  const named = { "2020-01": "Black Summer" };
  const rankWord = (() => {
    const lower = R.slice(0, -1).filter((r) => r.v <= now.v);
    const higher = R.slice(0, -1).filter((r) => r.v >= now.v);
    if (!lower.length) return ", the lowest ANUpoll has recorded";
    if (!higher.length) return ", the highest ANUpoll has recorded";
    const since = (set, worse) => {
      const last = set[set.length - 1], i = R.indexOf(last);
      const between = R.slice(i + 1, -1);
      /* the wave just before may sit within the latest's margin – the dek
         says so – but every wave before that must clear it */
      if (between.length < 3 || !between.slice(0, -1).every((r) => clears(r, now) && (worse ? r.v > now.v : r.v < now.v))) return null;
      return ", the " + (worse ? "lowest" : "highest") + " since " + (named[last.date] ? named[last.date] + " (" + trustMonth(last.date) + ")" : trustMonth(last.date));
    };
    return since(lower, true) || since(higher, false) || "";
  })();
  const head = plainShare(now.v) + " Australians have confidence in the federal government" + rankWord;
  /* dek: the move on the wave before (gated by clears); then the move on
     the first wave after the latest election, when that is not the wave
     before and the move clears its margin; then any other survey's latest
     printed change that its own report marks significant (`sigChange`) */
  const lastElec = TRUST_ELECTIONS[TRUST_ELECTIONS.length - 1];
  const afterElec = R.find((r) => r.x > trustDx(lastElec.date));
  const prevSig = clears(now, prev);
  const sPrev = prevSig
    ? (now.v < prev.v ? "Down " : "Up ") + pts(now.v - prev.v) + " points since " + trustMonth(prev.date)
    : "Little changed since " + trustMonth(prev.date) + ", within the margin";
  const elecSig = !!(afterElec && afterElec !== prev && afterElec !== now && clears(now, afterElec));
  const sElec = !elecSig ? ""
    : (prevSig && Math.sign(now.v - prev.v) === Math.sign(now.v - afterElec.v) ? ", and " : ", but ")
      + (now.v < afterElec.v ? "down " : "up ") + pts(now.v - afterElec.v) + " points since just after the " + lastElec.label + " election (" + afterElec.v.toFixed(1) + "%)";
  const others = D.trustGov.series.filter((s) => s.role === "dot");
  const sigOther = others.map((s) => {
    const rs = s.readings, a = rs[rs.length - 1], b = rs[rs.length - 2];
    return a && b && a.sigChange ? { s, a, b } : null;
  }).filter(Boolean).sort((p, q) => q.a.x - p.a.x)[0];
  const sOther = sigOther
    ? " " + sigOther.s.house + "’s " + trustMonth(sigOther.a.date) + " survey, worded differently, also has trust "
      + (sigOther.a.v < sigOther.b.v ? "down" : "up") + ", " + pts(sigOther.a.v - sigOther.b.v) + " points in a year."
    : "";
  /* "also" needs a move of ANUpoll's own to agree with: the since-election
     one when said, else the wave-on-wave one when it cleared */
  const ref = elecSig ? now.v - afterElec.v : prevSig ? now.v - prev.v : 0;
  const sameWay = sigOther && ref && Math.sign(sigOther.a.v - sigOther.b.v) === Math.sign(ref);
  const dek = sPrev + sElec + "." + (sameWay ? sOther : "");

  /* ---- the trend chart ---------------------------------------------------- */
  const x0 = 2019.92, x1 = Math.max(now.x, ...others.flatMap((s) => s.readings.map((r) => r.x))) + 0.2;
  const lineRuns = (line.panels || [{ id: undefined }]).map((p) => R.filter((r) => r.panel === p.id)).filter((rs) => rs.length);
  const tSeries = lineRuns.map((rs, i) => ({
    id: "anu-" + i, label: line.house, color: TRUST_COLOR[line.id], points: rs.map((r) => ({ x: r.x, y: r.v })),
    rdWidth: 2.5, endCap: false, smooth: false,
    endLabel: !narrow && i === lineRuns.length - 1 ? line.house : null,
  }));
  const tAreas = lineRuns.map((rs, i) => ({
    id: "anu-ci-" + i, color: TRUST_COLOR[line.id], className: "ci-band", edge: false, smooth: false,
    points: rs.map((r) => ({ x: r.x, y0: r.v - r.ci, y1: r.v + r.ci })),
  })).filter((a) => a.points.length >= 2);
  const credit = (s, r) => ({ pollster: s.house, dateLabel: r.field || trustMonth(r.date) + (r.approxDate ? " (approx.)" : ""), sample: r.n || null });
  /* the long series' readings since 2020 join the trend view as dots too:
     each is a survey of the same question family, at its own level */
  const dotSeries = D.trustGov.series.filter((s) => s.role !== "line" && !/-avg$/.test(s.id));
  const tDots = [
    ...R.map((r) => ({ x: r.x, y: r.v, color: TRUST_COLOR[line.id], label: "Confidence", meta: credit(line, r), op: 1.6 })),
    ...dotSeries.flatMap((s) => s.readings.filter((r) => r.x >= x0 && r.x <= x1).map((r) => ({
      x: r.x, y: r.v, color: TRUST_COLOR[s.id], label: "Trust", meta: credit(s, r), hollow: true, size: 1.25,
    }))),
  ];
  const tVals = tDots.map((d) => d.y).concat(tAreas.flatMap((a) => a.points.flatMap((p) => [p.y0, p.y1])));
  const tLo = Math.floor(Math.min(...tVals) / 10) * 10, tHi = Math.ceil(Math.max(...tVals) / 10) * 10;
  const tTicks = (() => {
    const elec = TRUST_ELECTIONS.map((e) => ({ x: trustDx(e.date), label: narrow ? "E" : "Election", strong: true, short: "E" }));
    const years = [];
    for (let y = Math.ceil(x0); y <= x1; y++) {
      if (elec.some((e) => Math.abs(e.x - y) < (narrow ? 0.55 : 0.4))) continue;
      if (narrow && y % 2) continue;
      years.push({ x: y, label: String(y) });
    }
    return [...years, ...elec].sort((a, b) => a.x - b.x);
  })();
  const otherNames = rdList(dotSeries.filter((s) => s.readings.some((r) => r.x >= x0)).map((s) => s.house));
  const breakYear = lineRuns.length > 1 ? lineRuns[1][0].date.slice(0, 4) : null;

  /* ---- the long view's words ---------------------------------------------
     head (AES, the longest series): its latest share; "the lowest on
     record" when it is the minimum, else "up from <year>'s record low" when
     the low is one of the last three elections and the latest stands five
     or more points above it (the AES's ~2,000-a-wave samples put a 95%
     margin of about three points on a difference). */
  const aes = S.aes, sc = S.scanlon, oa = S["oecd-au"], ov = S["oecd-avg"];
  const aesNow = aes && aes.readings[aes.readings.length - 1];
  const aesMin = aes && aes.readings.reduce((m, r) => (r.v < m.v ? r : m));
  const aesRecent = aes && aes.readings.slice(-4, -1).includes(aesMin);
  const longHead = !aes ? "" : plainShare(aesNow.v) + " say people in government can be trusted"
    + (aesNow === aesMin ? ", the lowest on record"
      : aesRecent && aesNow.v - aesMin.v >= 5 ? ", up from " + aesMin.date.slice(0, 4) + "’s record low" : "");
  /* dek: Scanlon's latest (its online panel) against that panel's own high
     and against the telephone years' 2010–18 band, said as "above" /
     "within" / "below" the band only when the latest clears its edge by
     two points or more (Scanlon's rounded whole numbers); then the OECD's
     latest round, Australia against the average, and whether Australia sat
     above it in every round */
  const scDek = (() => {
    if (!sc) return "";
    const on = sc.readings.filter((r) => r.mode === "lia"), tel = sc.readings.filter((r) => r.mode === "tel" && +r.date.slice(0, 4) >= 2010);
    const last = on[on.length - 1], hi = on.reduce((m, r) => (r.v > m.v ? r : m));
    const bLo = Math.min(...tel.map((r) => r.v)), bHi = Math.max(...tel.map((r) => r.v));
    const rel = last.v >= bHi + 2 ? "above" : last.v <= bLo - 2 ? "below" : "within";
    return "Scanlon’s yearly survey has " + last.v + "% trusting Canberra to do the right thing"
      + (hi !== last ? ", short of its " + (+hi.date.slice(0, 4) >= 2020 && +hi.date.slice(0, 4) <= 2021 ? "pandemic high" : hi.date.slice(0, 4) + " high") + " (" + hi.v + "%)" : "")
      + (rel === "within" ? " and back in" : (hi !== last ? " but " : " ") + rel) + " the " + bLo + "–" + bHi + "% band of 2010–18. ";
  })();
  const oDek = (() => {
    if (!oa || !ov) return "";
    const pairs = oa.readings.map((r) => [r, ov.readings.find((q) => q.date === r.date)]).filter(([, q]) => q);
    if (!pairs.length) return "";
    const [a, b] = pairs[pairs.length - 1];
    const allAbove = pairs.every(([r, q]) => r.v > q.v), allBelow = pairs.every(([r, q]) => r.v < q.v);
    return "On the OECD’s own scale Australia sits " + (a.v > b.v ? "above" : "below") + " the OECD average"
      + (allAbove || allBelow ? " in every round" : " in its latest round") + ", " + a.v + "% to " + b.v + "% in " + a.date.slice(0, 4) + ".";
  })();
  const longDek = scDek + oDek;

  /* ---- the long chart ------------------------------------------------------ */
  const longIds = ["aes", "scanlon", "oecd-au", "oecd-avg"].filter((id) => S[id]);
  /* a series' run splits where readings sit more than four years apart
     (the AES's 1969, 1979 and 1993): the gap is drawn dashed, a join no
     survey measured, sharing the run's label so the tooltip keeps one row */
  const GAP_YRS = 4;
  const lSeries = longIds.flatMap((id) => {
    const s = S[id];
    const modeRuns = s.modes ? s.modes.map((m) => s.readings.filter((r) => r.mode === m.id)) : [s.readings];
    const runs = modeRuns.flatMap((rs) => rs.reduce((acc, r) => {
      const cur = acc[acc.length - 1];
      if (cur && r.x - cur[cur.length - 1].x <= GAP_YRS) cur.push(r); else acc.push([r]);
      return acc;
    }, []));
    const gaps = modeRuns.flatMap((rs) => rs.slice(1).map((r, i) => [rs[i], r]).filter(([p, q]) => q.x - p.x > GAP_YRS))
      .map(([p, q], i) => ({ id: id + "-gap-" + i, label: s.house, color: TRUST_COLOR[id], points: [{ x: p.x, y: p.v }, { x: q.x, y: q.v }],
        rdWidth: 1.25, dash: "3 4", endCap: false, smooth: false, opacity: 0.8 }));
    return gaps.concat(runs.filter((rs) => rs.length).map((rs, i) => ({
      id: id + "-" + i, label: s.house, color: TRUST_COLOR[id], points: rs.map((r) => ({ x: r.x, y: r.v })),
      rdWidth: id === "oecd-avg" ? 1.5 : 2.25, dash: id === "oecd-avg" ? "4 4" : undefined, endCap: false, smooth: false,
      endLabel: !narrow && i === runs.length - 1 ? (id === "oecd-au" ? "OECD survey, Australia" : id === "oecd-avg" ? "OECD average" : id === "aes" ? "AES" : "Scanlon") : null,
    })));
  });
  const lDots = longIds.flatMap((id) => S[id].readings.map((r) => ({
    x: r.x, y: r.v, color: TRUST_COLOR[id], label: S[id].measure.split(" (")[0], meta: credit(S[id], r),
    hollow: id === "oecd-avg" || (S[id].modes && r.mode === "tel"),
  })));
  const lx0 = 1968, lx1 = Math.max(...lDots.map((d) => d.x)) + 1.2;
  const lVals = lDots.map((d) => d.y);
  const lLo = Math.floor(Math.min(...lVals) / 10) * 10, lHi = Math.ceil(Math.max(...lVals) / 10) * 10;
  const lTicks = [];
  for (let y = 1970; y <= lx1; y += narrow ? 20 : 10) lTicks.push({ x: y, label: String(y) });

  const tabs = (
    <RdTabs value={tab} onChange={setTab} ariaLabel="Trust view" className="rd-tabs-sm rd-trust-tabs"
            options={[{ id: "recent", label: "Since 2020" }, { id: "long", label: "The long view" }]} />
  );
  return (
    <>
      <RdHed head={tab === "recent" ? head : longHead} dek={tab === "recent" ? dek : longDek} />
      {tabs}
      <RdCrossfade k={tab}>
        {tab === "recent" ? (
          <div className="card rd-card rd-dir-chart rd-trust-chart">
            <div className="rd-chead"><span className="rd-chead-t">{narrow
              ? "Confidence in the federal government, %"
              : "Great deal or quite a lot of confidence in the federal government, %, ANUpoll"}</span></div>
            {narrow && <RdKey items={[{ kind: "line", color: TRUST_COLOR.anupoll, label: "ANUpoll" }]} className="rd-tpp-legend" />}
            <TrendChart key="rd-trust" heightPx={narrow ? 280 : 360}
              padPx={narrow ? { l: 34, r: 8, t: 30, b: 28 } : { l: 40, r: 16, t: 40, b: 30 }}
              xDomain={[x0, x1]} yDomain={[tLo, tHi]} yTicks={rdYTicks(tLo, tHi, 10)} yTickFmt={(v) => (v === tHi ? v + "%" : String(v))}
              xTicks={tTicks} baseline series={tSeries} spine={R.map((r) => ({ x: r.x, y: r.v }))} areas={tAreas} scatter={tDots}
              tooltipTitle={(i) => (R[i] ? "ANUpoll, " + trustMonth(R[i].date) : "")}
              extraRows={(i) => { const r = R[i]; return r ? [{ label: "95% interval", value: "±" + r.ci.toFixed(1) }, ...(r.panel && line.panels ? [{ label: "Panel", value: line.panels.find((p) => p.id === r.panel).label }] : [])] : []; }}
              fmt={(v) => v.toFixed(1)}
              copy={{ title: "Confidence in the federal government", sub: head + ". ANUpoll, % with a great deal or quite a lot of confidence in the Federal Government in Canberra.",
                      caption: "Line: ANUpoll, shaded with its 95% interval" + (breakYear ? ", broken in " + breakYear + " where it moved panels" : "") + ". Open dots: other surveys, each worded its own way (" + otherNames + ").",
                      legend: [{ label: "ANUpoll", color: TRUST_COLOR.anupoll, kind: "line" }, { label: "Other surveys", color: "var(--ink-3)", kind: "ring" }] }}
            />
            <RdKey className="rd-ckey" items={[
              { kind: "lineband", color: TRUST_COLOR.anupoll, label: "ANUpoll, each wave with its 95% interval" + (breakYear ? "; the line breaks in " + breakYear + ", where it moved panels" : "") },
              ...dotSeries.filter((s) => s.readings.some((r) => r.x >= x0)).map((s) => ({ kind: "dot-open", color: TRUST_COLOR[s.id], label: s.house })),
            ]} />
          </div>
        ) : (
          <div className="card rd-card rd-dir-chart rd-trust-chart">
            <div className="rd-chead"><span className="rd-chead-t">{narrow
              ? "Trust in government, %, by survey"
              : "Trust in the federal government, %, each survey on its own question"}</span></div>
            {narrow && <RdKey items={longIds.map((id) => ({ kind: id === "oecd-avg" ? "dash" : "line", color: TRUST_COLOR[id], label: id === "oecd-au" ? "OECD, Australia" : id === "oecd-avg" ? "OECD average" : id === "aes" ? "AES" : "Scanlon" }))} className="rd-tpp-legend" />}
            <TrendChart key="rd-trust-long" heightPx={narrow ? 280 : 360}
              padPx={narrow ? { l: 34, r: 8, t: 30, b: 28 } : { l: 40, r: 16, t: 40, b: 30 }}
              xDomain={[lx0, lx1]} yDomain={[lLo, lHi]} yTicks={rdYTicks(lLo, lHi, 10)} yTickFmt={(v) => (v === lHi ? v + "%" : String(v))}
              xTicks={lTicks} baseline series={lSeries} scatter={lDots}
              /* no hover guide: the lines are read at different dates, so
                 a guide at one survey's date would read the others between
                 their readings; each dot tips its own reading */
              spine={[]}
              fmt={(v) => (v % 1 ? v.toFixed(1) : String(v))}
              copy={{ title: "Trust in the federal government over the long run", sub: longHead + ". Each survey on its own question; none are pooled.",
                      caption: "AES: people in government can usually or sometimes be trusted (after each election). Scanlon: Canberra can be trusted to do the right thing almost always or most of the time (open dots: its telephone years). OECD: 6+ out of 10, Australia and the OECD average (dashed).",
                      legend: longIds.map((id) => ({ label: S[id].house, color: TRUST_COLOR[id], kind: id === "oecd-avg" ? "dashed" : "line" })) }}
            />
            <RdKey className="rd-ckey" items={[
              aes && { kind: "line", color: TRUST_COLOR.aes, label: "AES: people in government can be trusted, after each election (dotted across the years it wasn’t asked)" },
              sc && { kind: "line", color: TRUST_COLOR.scanlon, label: "Scanlon: Canberra can be trusted to do the right thing; open dots are its telephone years, to 2018" },
              oa && { kind: "line", color: TRUST_COLOR["oecd-au"], label: "OECD Trust Survey, Australia" },
              ov && { kind: "dash", color: TRUST_COLOR["oecd-avg"], label: "OECD average, on the same question" },
            ]} />
          </div>
        )}
      </RdCrossfade>
      {tab === "recent" ? (
        <HowTo paras={[
          <>ANUpoll asks how much confidence people have in the Federal Government in Canberra; the line is the share with a great deal or quite a lot, each wave shaded with its 95% interval. The reports print only their own wave’s figure, so earlier waves are read off their charts (good to about ±0.3).</>,
          <>{breakYear ? <>The line breaks in {breakYear}: ANUpoll moved from ANU’s Life in Australia panel, recruited at random, to an opt-in online panel, so the levels either side are not strictly comparable. </> : null}The open dots are other surveys, each asking its own question – “trust” rather than “confidence”, a 0–10 scale or four answers – so their levels sit apart from ANUpoll’s and from each other’s. Read each survey’s dots against its own earlier ones; they are never averaged in.</>,
        ]} />
      ) : (
        <HowTo paras={[
          <>Each line is one survey on its own question, so compare a line with itself over time rather than one line’s level with another’s. The AES asks after every election whether people in government can be trusted to do the right thing; Scanlon asks each year how often the government in Canberra can be trusted to; the OECD asks for a 0–10 score, counting 6 or more.</>,
          <>The OECD average covers whichever countries took part in that round (22 in 2021, 38 in 2025), so part of its movement is who was counted. It sits beside the OECD’s own Australian figure only: on other surveys’ questions Australia’s levels run lower, which says nothing about where it ranks.</>,
        ]} />
      )}
      <RdFoot how={{ term: "trust-government", from: "National mood" }}>{tab === "recent"
        ? "Trust readings come a few times a year, not monthly: ANUpoll’s waves are quarterly, the rest yearly or less."
        : "The AES dates each reading to the month after polling day; Scanlon fields mid-year."}</RdFoot>
    </>
  );
}

/* How each pollster asks the direction question, and what the model does
   with its answers (gen-data §5m). Checked 2026-11-22 against the sources
   linked: Roy Morgan's live table and releases, Essential's report data,
   SEC Newgate's, Spectre's and Ipsos's reports, RedBridge's questionnaire,
   the Lowy Institute Poll's notes and McKinnon's report. `role`:
     level – one of the pollsters asking the standard question, whose leans
             average zero: together they set the line's level;
     lean  – shifted by a lean of its own and never setting the level.
   `unsure` says whether the pollster's undecided share feeds the line's. */
const DIRECTION_HOUSE_NOTES = {
  "Roy Morgan": {
    question: "Generally speaking, do you feel that things in Australia are heading in the right direction or would you say things are seriously heading in the wrong direction?",
    answers: "Right direction and wrong direction, with a third column printed as “Can’t say / no answer”.",
    method: "Face-to-face to March 2020, then multi-mode to May 2022; its table records no method since August 2022. Each of the three runs has its own lean, the earlier two placed on today’s scale through the pollsters that polled across each change.",
    role: "level", unsure: true,
    url: "https://www.roymorgan.com/morgan-poll/government-confidence-rating",
  },
  Essential: {
    question: "In general, would you say that Australia is heading in the right direction or on the wrong track?",
    answers: "Right direction, wrong track and unsure, each printed. The February–May 2022 reports asked “or is it off on the wrong track?”.",
    role: "level", unsure: true,
    url: "https://essentialreport.com.au/wp-content/uploads/2026/10/Essential-Report-Disclosure-Statement-Full-Questionnaire-.pdf",
  },
  "SEC Newgate": {
    question: "Overall, do you think Australia, (state/territory), and your local area are heading in the right direction or the wrong direction? (The Australia item is used.)",
    answers: "Right direction and wrong direction only, summing to 100. Its reports print a “Don’t know” column for other questions but none for this one, so it is treated as a forced choice.",
    role: "level", unsure: false,
    url: "https://www.secnewgate.com.au/wp-content/uploads/2026/09/SEC-Newgate-Mood-of-the-Nation-September-2026-Report.pdf",
  },
  "RedBridge/Accent": {
    question: "Would you say that things in Australia are… generally headed in the right direction; generally headed in the wrong direction; not sure.",
    answers: "Right direction, wrong direction and not sure, offered as answers (single select; the first two in random order).",
    role: "level", unsure: true,
    url: "https://6b72024e-077a-44e2-88f5-dc1a0ed81099.usrfiles.com/ugd/b86980_ab6caba0abb44d15a1268fde42f282d5.pdf",
  },
  "Spectre Strategy": {
    question: "In your view, is Australia heading in the right direction, or the wrong direction at this time?",
    answers: "Right direction, wrong direction and unsure, each printed. The 2025 wording is unverified.",
    role: "level", unsure: true,
    url: "https://www.spectrestrategy.com/s/Political-Update-November-26-Spectre-Strategy.pdf",
  },
  Freshwater: {
    question: "Generally speaking, do you think that Australia is currently heading in the right direction, or the wrong direction?",
    answers: "Right direction and wrong direction; the rest (about 13%) is read as unsure. The third answer’s label is not on file, and the 2023–24 wording is unverified.",
    role: "level", unsure: true,
    url: "https://freshwaterstrategy.com/wp-content/uploads/Data-Tables-News-Australia-Freshwater-Strategy-Aus-Polling-150526.xlsx",
  },
  Ipsos: {
    question: "Generally speaking, would you say things in this country are heading in the right direction, or are they off on the wrong track?",
    answers: "Right direction and wrong track, summing to 100: Ipsos notes that its totals can leave out “don’t know” or not-stated answers, so no undecided share is printed.",
    method: "Ipsos Online Panel, about 1,000 Australians aged 16–74 a month (16–64 from March to July 2019).",
    role: "level", unsure: false,
    url: "https://resources.ipsos.com/rs/297-CXJ-795/images/What-Worries-the-World-October-26.pdf?version=0",
  },
  "Lowy Institute": {
    question: "Overall, are you satisfied or dissatisfied with the way things are going in Australia today?",
    answers: "Satisfied and dissatisfied. “Don’t know” or “no view” was recorded only when volunteered, never offered, which leaves 5% in each wave.",
    method: "Telephone in 2017; 600 online and 600 telephone responses, weighted and blended, in 2018.",
    role: "lean", unsure: false,
    url: "https://www.lowyinstitute.org/publications/2018-lowy-institute-poll",
  },
  McKinnon: {
    question: "All things considered, how satisfied are you with the way Australia is heading?",
    answers: "Satisfied and dissatisfied (each aggregating two strengths), a neutral middle answer (“neither satisfied nor dissatisfied”, about 15%) and a separate “don’t know” (about 1%).",
    method: "Online, about 4,300–4,400 Australians aged 18 and over a year.",
    role: "lean", unsure: false,
    url: "https://apo.org.au/sites/default/files/resource-files/2025-11/apo-nid332763_1.pdf",
  },
};
/* what the model does with a pollster's answers, in words */
const directionRoleText = (n) => n.role === "level"
  ? "Sets the line’s level with the other pollsters asking this question, each counting once" + (n.unsure ? ", and feeds its unsure share." : "; its ratio of right to wrong only, as it prints no unsure share.")
  : "Asks about satisfaction, so it is read through a lean of its own, wide enough that a couple of readings teach the model about the question, not about Australia. It never sets the level or the unsure share.";

function RdDirectionView({ rangeId }) {
  const { D, rangeDomain, filterPts, series, monthLabelFull } = window.AP;
  const narrow = useNarrow(MQ_PHONE);
  const [grpId, setGrpId] = React.useState("");
  const grpSelRef = React.useRef(null);
  // the primary-vote menu's fit trick: the option labels set the width
  React.useLayoutEffect(() => {
    const el = grpSelRef.current;
    if (!el) return;
    const fit = () => {
      const cs = getComputedStyle(el);
      const cv = document.createElement("canvas").getContext("2d");
      cv.font = cs.fontWeight + " " + cs.fontSize + " " + cs.fontFamily;
      el.style.width = Math.ceil(cv.measureText(el.options[el.selectedIndex].textContent).width
        + parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) + 14) + "px";
    };
    fit();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
  }, [grpId]);
  if (!D.direction.length) return null;
  /* ---- the history window (the confidence panel's machinery) ------------
     gen-data §5dh ships every house's own monthly record (Roy Morgan's GCR,
     SEC Newgate from March 2022, Essential from June 2022 and RedBridge's
     reprinted image trend) as D.dirHistory. With it on the page the
     all-voters chart takes the same window the confidence charts use —
     term / 10 yrs / 25 yrs / All, stepping ‹ ›, and the miniature strip
     with the governments beneath — and a window
     reaching behind the pooled model's May 2025 start draws the houses'
     own published runs beside it. A group cut stays on the old range:
     those series only exist for the current term. */
  const HIST = D.dirHistory && D.dirHistory.houses ? D.dirHistory : null;
  const nowX = D.domain.x1;
  const TERMS = React.useMemo(() => confTermsOf(D), [D]);
  const curTerm = TERMS.find((t) => t.current) || TERMS[TERMS.length - 1];
  const [winS, setWinS] = React.useState(() => confTermWin(curTerm, nowX));
  const [dragging, setDragging] = React.useState(false);
  const onWin = React.useCallback((w, phase) => { setWinS(w); setDragging(phase === "drag"); }, []);
  /* gen-data §5dp: from March 2022, with SEC Newgate joining first,
     Essential in June and RedBridge in its printed 2024–25 months.
     That run pools like the current term; Roy Morgan's older solo
     months flow into it at the join. */
  const PRE = D.directionPre && D.directionPre.series && D.directionPre.series.length ? D.directionPre : null;
  const poolStart = PRE ? PRE.series[0].x : D.direction[0].x;
  /* Federally (gen-data §5m, PRE.model) every pollster's readings are inputs
     to the one modelled line – Ipsos, Lowy and McKinnon included – so there
     are no separate house lanes or dashed overlays: the window reaches back
     to the model's first month and each reading shows as a dot. Without the
     model (a page whose history carries only houses' own runs) the lanes
     below draw as before. */
  const MODEL = !!(PRE && PRE.model);
  const lowyLane = !MODEL && D.directionLowy?.waves?.length ? [{
    house: "Lowy Institute",
    // Annual fieldwork intervals stay exact rather than becoming month buckets.
    pts: D.directionLowy.waves.map((w) => ({
      ym: w.end.slice(0, 7), x: w.x, right: w.satisfied, wrong: w.dissatisfied,
      samples: [w.sample], field: w.field, modeChange: w.modeChange, url: w.url,
      wording: { question: w.question, rightLabel: "Satisfied", wrongLabel: "Dissatisfied" },
    })),
  }] : [];
  const ipsosLane = !MODEL && D.directionWorld?.waves?.length ? [{
    house: "Ipsos",
    // Australia's published split is separate from the global average and country bands.
    pts: D.directionWorld.waves.map((w) => ({
      ym: w.ym, x: w.x, right: w.auRight, wrong: w.auWrong,
      samples: w.auN == null ? [] : [w.auN], sampleApprox: w.auSampleApprox,
      field: w.fieldwork, url: w.url,
      wording: { question: DIRECTION_HOUSE_NOTES.Ipsos.question, rightLabel: "Right direction", wrongLabel: "Wrong track" },
    })),
  }] : [];
  const histLanesAll = MODEL ? [] : (HIST ? Object.keys(HIST.houses).map((house) => ({ house, pts: HIST.houses[house] })) : [])
    .concat(lowyLane, ipsosLane).sort((a, b) => a.pts[0].x - b.pts[0].x);
  const ownWording = (l) => HIST?.wordings?.[l.house] || l.pts[0]?.wording;
  /* Live houses join before the pooled model opens; separately supplied
     house series stay their own lanes, never pooled-model inputs. */
  const histLanes = histLanesAll.filter((l) => l.pts[0].x < poolStart || ownWording(l));
  const modelLo = MODEL ? Math.min(...(PRE.solo.length ? [PRE.solo[0].x] : []), PRE.series[0].x) : null;
  const histLo = histLanes.length ? Math.min(...histLanes.map((l) => l.pts[0].x)) : poolStart;
  const ext = { lo: MODEL ? modelLo : histLanes.length ? histLo : poolStart, hi: nowX };
  const vTerms = confViewTerms(TERMS, ext.lo, ext.hi);
  const histOn = !!((MODEL || histLanes.length) && !grpId);
  const win = histOn
    ? (winS.kind === "term-carry" ? { kind: "custom", a: Math.max(ext.lo, winS.a), b: winS.b }
      : confClampWin(winS, vTerms, ext.lo, ext.hi, nowX))
    : null;
  const winShown = histOn && winS.kind === "term-carry" ? { ...win, kind: "term-carry", year: winS.year } : win;
  const isTerm = histOn && win.kind === "term";
  const winTerm = isTerm ? vTerms.find((t) => t.year === win.year) : null;
  const isCur = !!(winTerm && winTerm.current);
  const housesOn = histOn && histLanes.some((l) => l.pts.some((p) =>
    p.x >= win.a && p.x <= win.b && p.x < poolStart));
  const dotsOn = win ? win.b - win.a <= 4.6 : true;
  const xDomain = histOn ? [win.a, win.b] : rangeDomain(rangeId);
  const xTicks = histOn ? confWinTicks(win, vTerms, nowX) : null;
  /* Roy Morgan alone before March 2022 (gen-data §5dp's solo months): the
     same monthly construction, so the same line and band. Its record has
     long silences, so the months split into runs at any gap over a quarter
     – a line never bridges years nobody polled. The run that meets the
     pooled stretch joins it as one line; a month standing alone draws as a
     single mark. */
  const SOLO_GAP = 0.26;
  const soloRuns = [];
  if (histOn && PRE && PRE.solo) for (const r of PRE.solo) {
    const run = soloRuns[soloRuns.length - 1];
    if (run && r.x - run[run.length - 1].x < SOLO_GAP) run.push(r); else soloRuns.push([r]);
  }
  const soloJoin = soloRuns.length && PRE.series[0].x - soloRuns[soloRuns.length - 1].slice(-1)[0].x < SOLO_GAP
    ? soloRuns.pop() : [];
  const pts = filterPts(histOn && PRE ? soloJoin.concat(PRE.series, D.direction) : D.direction, xDomain[0]);
  const now = D.directionNow || D.direction[D.direction.length - 1];
  const M = D.direction;
  const wrongLeads = now.wrong >= now.right;
  const big = wrongLeads ? now.wrong : now.right, small = wrongLeads ? now.right : now.wrong;
  const most = wrongLeads ? now.wrong >= Math.max(...M.map((d) => d.wrong)) - 0.05 : now.right >= Math.max(...M.map((d) => d.right)) - 0.05;
  const head = plainShare(big) + " say Australia is " + (wrongLeads ? "on the wrong track" : "heading in the right direction")
    + (most ? ", the most this term" : "");
  const first = M[0];
  /* the move since the first month is said when it is five points or more
     AND clears its margin: under the model (directionNow.sinceTerm) the 95%
     band of the change itself; otherwise both readings' margins, a net's at
     most its two shares' added (one sample's shares move against each other) */
  const ST = now.sinceTerm || null;
  const sinceFirst = ST ? ST.chg : now.net - first.net;
  const netCi = (r) => (r.rightCi || 0) + (r.wrongCi || 0);
  const sinceSaid = Math.abs(sinceFirst) >= 5 && (ST ? ST.sig : Math.abs(sinceFirst) > Math.hypot(netCi(now), netCi(first)));
  const netVerb = (n, up) => n >= 10 ? (up ? "soared" : "plummeted") : n >= 6 ? (up ? "lifted" : "soured") : (up ? "lifted slightly" : "soured slightly");
  const netWord = (d) => (d > 0 ? "improved" : "worsened");
  const upDown = (d) => (d > 0 ? "up " : "down ");
  const dek = (small < 30 ? "Only " : "") + Math.round(small) + "% say we’re " + (wrongLeads ? "heading in the right direction" : "on the wrong track") + ". "
    + (now.chg == null ? ""
      : now.changeSig ? "Net mood has " + netVerb(Math.round(Math.abs(now.chg)), now.chg > 0) + ", " + upDown(now.chg) + Math.round(Math.abs(now.chg)) + " points in a month"
      : "Net mood has not changed significantly in a month")
    + (sinceSaid ? (now.chg == null
      ? "Net mood has " + netWord(sinceFirst) + ", " + upDown(sinceFirst) + rdRoughPts(sinceFirst) + " points since May 2025."
      : now.changeSig
        ? (Math.sign(sinceFirst) === Math.sign(now.chg) ? " and " : " but " + upDown(sinceFirst)) + rdRoughPts(sinceFirst) + " points since May 2025."
        : ", though it is " + upDown(sinceFirst) + rdRoughPts(sinceFirst) + " points since May 2025.") : ".");
  const signedP = (v) => (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(1);

  const prePolls = histOn && PRE ? PRE.polls.map((d) => ({ ...d, pre: true })) : [];
  const visiblePolls = prePolls.concat(D.directionPolls || []).filter((d) => d.x >= xDomain[0] && d.x <= xDomain[1]);
  /* a satisfaction question's dots say so; Ipsos prints no exact sample */
  const dotWords = (d) => (DIRECTION_HOUSE_NOTES[d.pollster]?.role === "lean" ? ["Satisfied", "Dissatisfied"] : ["Right direction", "Wrong track"]);
  const dotSub = (d) => (d.sampleApprox && d.sample ? "Australian sample approximately " + d.sample.toLocaleString("en-AU") + " (Ipsos publishes no exact achieved n)" : undefined);
  const dots = visiblePolls.filter((d) => dotsOn).flatMap((d) => [
    { x: d.x, y: d.right, color: "var(--mood-pos)", label: dotWords(d)[0], sub: dotSub(d), meta: d },
    { x: d.x, y: d.wrong, color: "var(--mood-neg)", label: dotWords(d)[1], sub: dotSub(d), meta: d },
  ]);
  const band = (k, ck) => pts.filter((d) => d[ck] != null).map((d) => ({ x: d.x, y0: d[k] - d[ck], y1: d[k] + d[ck] }));
  const areas = [
    { id: "ci-right", color: "var(--mood-pos)", className: "ci-band", edge: false, points: band("right", "rightCi") },
    { id: "ci-wrong", color: "var(--mood-neg)", className: "ci-band", edge: false, points: band("wrong", "wrongCi") },
  ].filter((a) => a.points.length >= 2);
  const inW = (p) => p.x >= xDomain[0] && p.x <= xDomain[1];
  const nearW = (r) => r.some((p) => p.x >= xDomain[0] - 0.3 && p.x <= xDomain[1] + 0.3);
  const soloShown = soloRuns.filter(nearW);
  const soloOn = histOn && PRE && PRE.solo && PRE.solo.length && xDomain[0] < PRE.series[0].x;
  const soloSeries = soloShown.filter((r) => r.length >= 2).flatMap((r) => ["wrong", "right"].map((k) => ({
    id: "solo-" + k + "-" + r[0].ym, label: k === "right" ? "Right direction" : "Wrong track",
    color: k === "right" ? "var(--mood-pos)" : "var(--mood-neg)", points: series(r, k), rdWidth: 2.5, endCap: false, endLabel: null,
  })));
  soloShown.filter((r) => r.length >= 2).forEach((r) => ["right", "wrong"].forEach((k) => areas.push({
    id: "solo-ci-" + k + "-" + r[0].ym, color: k === "right" ? "var(--mood-pos)" : "var(--mood-neg)", className: "ci-band", edge: false,
    points: r.map((d) => ({ x: d.x, y0: d[k] - d[k + "Ci"], y1: d[k] + d[k + "Ci"] })) })));
  soloShown.filter((r) => r.length === 1).forEach(([d]) => ["right", "wrong"].forEach((k) => dots.push({
    x: d.x, y: d[k], color: k === "right" ? "var(--mood-pos)" : "var(--mood-neg)", label: k === "right" ? "Right direction" : "Wrong track",
    meta: { pollster: "Roy Morgan", dateLabel: monthLabelFull(d.ym) + " average", pre: true } })));
  const soloPts = soloShown.flat();
  const histSeries = !housesOn || PRE && PRE.solo && PRE.solo.length ? [] : histLanes.flatMap((l) => {
    const pts = { right: [], wrong: [] };
    for (const p of l.pts) if (inW(p) && p.x < poolStart) for (const k of ["right", "wrong"]) pts[k].push({ x: p.x, y: p[k], ym: p.ym });
    /* Roy Morgan solid, every other house dotted — right/wrong keep the
       mood colours everywhere, the dash carries WHICH house printed it */
    const dash = l.house === "Roy Morgan" ? null : "0.1 3.6";
    return ["right", "wrong"].filter((k) => pts[k].length >= 2).map((k) => ({
      id: "hist-" + k + "-" + l.house, color: k === "right" ? "var(--mood-pos)" : "var(--mood-neg)",
      label: l.house + ", " + (k === "right" ? "right direction" : "wrong track"),
      points: pts[k], rdWidth: 1.5, opacity: dash ? 0.85 : 0.75, dash: dash || undefined,
      smooth: false, endCap: false, endAtWin: true, interpHover: true,
    }));
  });
  const wordedSeries = histLanes.filter((l) => ownWording(l)).flatMap((l) => {
    const q = ownWording(l);
    return [["right", q.rightLabel], ["wrong", q.wrongLabel]].map(([k, wording]) => {
      const points = [];
      for (const p of l.pts) if (inW(p) && p[k] != null) {
        points.push({ x: p.x, y: p[k], ym: p.ym });
        dots.push({ x: p.x, y: p[k], color: k === "right" ? "var(--mood-pos)" : "var(--mood-neg)",
          label: l.house + ", " + wording,
          sub: p.sampleApprox ? "Australian sample approximately " + p.samples[0].toLocaleString("en-AU") + " (Ipsos publishes no exact achieved n)" : undefined,
          meta: { pollster: l.house, dateLabel: p.field || monthLabelFull(p.ym), pre: true,
            sample: p.samples?.length === 1 ? p.samples[0] : null, sampleApprox: p.sampleApprox || false,
            modeChange: p.modeChange || false, url: p.url || null } });
      }
      return { id: "worded-" + k + "-" + l.house, label: l.house + ", " + wording,
        color: k === "right" ? "var(--mood-pos)" : "var(--mood-neg)", points, rdWidth: 1.5, opacity: 0.85, dash: "0.1 3.6" };
    }).filter((s) => s.points.length >= 2);
  });
  /* Ipsos' Global Average on Australian pollsters' terms (gen-data §5m):
     each wave's world ratio moved by Ipsos's lean that day, split with
     Australia's unsure share – a dashed reference, never in the line */
  const worldPts = !grpId && D.directionWorldAdj ? D.directionWorldAdj.filter((w) => w.x >= xDomain[0] - 0.05 && w.x <= xDomain[1] + 0.05) : [];
  const worldOn = worldPts.length >= 2;
  const worldSeries = worldOn ? [["wrong", "wrong track"], ["right", "right direction"]].map(([k, lab]) => ({
    id: "world-" + k, label: "Ipsos’ Global Average, " + lab + ", on Australian pollsters’ terms",
    color: k === "right" ? "var(--mood-pos)" : "var(--mood-neg)", points: worldPts.map((w) => ({ x: w.x, y: w[k] })),
    rdWidth: 1.5, opacity: 0.8, dash: "5 4", endCap: false, endLabel: null, smooth: false, interpHover: true,
  })) : [];
  const vals = pts.flatMap((p) => [p.right, p.wrong]).concat(dots.map((d) => d.y))
    .concat(worldPts.flatMap((w) => [w.right, w.wrong]))
    .concat(areas.flatMap((a) => a.points.flatMap((d) => [d.y0, d.y1])))
    .concat(wordedSeries.flatMap((s) => s.points.map((p) => p.y)))
    .concat(histSeries.flatMap((s) => s.points.map((p) => p.y)))
    .concat(soloPts.filter(inW).flatMap((p) => [p.right - p.rightCi, p.right + p.rightCi, p.wrong - p.wrongCi, p.wrong + p.wrongCi]));
  const lo = Math.floor((Math.min(...vals) + 0.6) / 10) * 10, hi = Math.ceil((Math.max(...vals) - 0.6) / 10) * 10;
  const yd = useConfChase([lo, hi], dragging);
  /* the gap drawn where it now stands, against the month before Bondi */
  const bondi = (D.events || []).find((e) => e.date === "2025-12-14");
  const last = pts[pts.length - 1];
  const base = bondi ? M.find((d) => d.ym === bondi.date.slice(0, 7)) : null;
  const gapNow = last ? Math.abs(last.wrong - last.right) : null;
  /* the gap is named where it is drawn, on a phone too, as the canvas did:
     three short lines beside the bracket rather than a note under the chart */
  const brackets = !last || (histOn && !isCur) ? [] : !narrow ? [{ x: last.x, y0: last.wrong, y1: last.right, lines: [
    gapNow.toFixed(1) + " points apart in " + D.monthNameFull(Number(last.ym.slice(5))),
    base ? "up from " + Math.abs(base.wrong - base.right).toFixed(1) + " in " + D.monthNameFull(Number(base.ym.slice(5))) + ", before Bondi" : null,
  ].filter(Boolean) }] : [{ x: last.x, y0: last.wrong, y1: last.right, dx: 4, lines: [
    gapNow.toFixed(1) + " points apart", "in " + D.monthNameFull(Number(last.ym.slice(5))) + (base ? ";" : ""),
    base ? Math.abs(base.wrong - base.right).toFixed(1) + " before Bondi" : null,
  ].filter(Boolean) }];
  const elecEvs = histOn && !isCur ? confElectionEvents(win, vTerms) : [];
  const elecRules = elecEvs.length > 6;
  const evs = histOn && !isCur ? (elecRules ? [] : elecEvs) : bondi ? [bondi] : [];
  const badges = narrow && (!histOn || isCur) ? rdEventBadges("dir", evs, xDomain[0], xDomain[1]) : null;
  /* the strip under the chart: the net (right minus wrong) of the chart's
     own line over its whole run – Roy Morgan's months alone before March
     2022, the pooled months after – one line, broken where the main line
     breaks, with the governments from D.cycles beneath it */
  const stripRuns = histOn && PRE ? soloRuns.concat([soloJoin.concat(PRE.series, D.direction)]) : [D.direction];
  const stripLines = stripRuns.filter((r) => r.length >= 2).map((r) => ({
    color: "var(--ink-2)",
    points: r.map((p) => ({ x: p.x, y: p.right - p.wrong })),
  }));
  /* the hover guide lands on whichever house's month it is (the pooled
     months are the same mid-month grid), so past windows still read a
     month name rather than a bare axis position */
  const chartMonths = histSeries.length || soloPts.length
    ? [...new Map(histSeries.flatMap((s) => s.points).concat(soloPts, pts).map((p) => ({ x: p.x, ym: p.ym }))
      .map((p) => [p.x, p])).values()].sort((a, b) => a.x - b.x)
    : pts;
  const monthAt = (x) => pts.find((p) => p.x === x) || soloPts.find((p) => p.x === x);
  /* House counts and cadence live in Info's National direction entry; the
     foot distinguishes these separate observations from the pooled line. */
  const monthNow = last ? D.monthNameFull(Number(last.ym.slice(5))) : "";
  const wordingNote = !MODEL && !grpId && histLanes.some((l) => ownWording(l) && l.pts.some(inW))
    ? "Dashed house-specific overlays show their own published readings and do not enter the pooled estimate. Ipsos Australia is separate from its Global Average." : null;
  const foot = MODEL
    ? "The dots sit where each pollster printed them: Ipsos and SEC Newgate force a choice and Lowy and McKinnon ask about satisfaction, so theirs sit apart from the line, which is set for the average pollster asking this question."
    : [last ? "The headline figures pool the latest polls, so they can differ a little from " + monthNow + "’s monthly average." : null, wordingNote]
      .filter(Boolean).join(" ");
  const asked = rdList(D.directionHouses || []);
  const question = "‘Is the country heading in the right direction, or on the wrong track?’";

  /* ---- group mode (the select) ------------------------------------------
     Every cut is built like the headline above: each release's group
     figure is differenced against the all-voters figure ITS OWN poll
     printed (the wave's house lean cancels in the difference, so no
     group-grain house effects are needed), the gaps pool month by month,
     weighted by sample, and the pooled gap rides the lean-adjusted
     all-voters average (the thin dashed lines), its approximate 95%
     margin shaded. Dots are the houses' own readings, anchored the same
     way – where more than one house prints the same group (the gender
     pair now comes from all three of Essential, Roy Morgan and
     RedBridge/Accent), the pool merges them, every house but the most-
     printed rides as open rings and the readout says plainly that the
     houses disagree on how big the gap is. SEC Newgate's state readings
     are not offered: each
     state rates its own direction, not the nation's. The all-voters
     branch is the original code path, unchanged. */
  const G = grpId ? (D.directionGroups?.[grpId] || null) : null;
  const gHouses = G ? G.houses || [] : [];
  const gSrc = gHouses.join(" and ") || "the pollsters";
  const questionHouses = new Set(G ? gHouses : visiblePolls.map((p) => p.pollster).filter(Boolean));
  if (!G) for (const l of histLanes) if (ownWording(l) && l.pts.some(inW)) questionHouses.add(l.house);
  // These are federal wordings; a Victorian poll can share the pollster's name.
  const NOTE_ORDER = Object.keys(DIRECTION_HOUSE_NOTES);
  const questionNotes = [...questionHouses].sort((a, b) => (NOTE_ORDER.indexOf(a) + 1 || 99) - (NOTE_ORDER.indexOf(b) + 1 || 99)).map((house) => ({ house,
    ...(DIRECTION_HOUSE_NOTES[house] || { question: "The exact wording has not been checked against a primary report.", unverified: true }),
  }));
  const gName = !G ? "" : G.dim === "age" ? "Aged " + grpId : grpId;
  const gSeries = G ? G.series.filter((d) => d.x >= xDomain[0] && d.x <= xDomain[1]) : [];
  /* two months make a line; the shading is the pooled gap's margin */
  const gHasRight = gSeries.filter((d) => d.right != null).length >= 2;
  const gPts = gSeries.map((d) => ({ ...d, right: gHasRight ? d.right : null, gapR: gHasRight ? d.gapR : null, rightCi: gHasRight ? d.rightCi : null }));
  /* each dot is one house's own reading for a wave, the wave's gap sat on
     that month's headline; where several houses print the group, every
     house but the most-printed rides as open rings */
  const gRaw = G ? (G.raw || []).filter((d) => d.x >= xDomain[0] && d.x <= xDomain[1]) : [];
  const gCounts = gRaw.reduce((m, d) => (m[d.pollster] = (m[d.pollster] || 0) + 1, m), {});
  const gRings = (() => {
    if (gHouses.length < 2) return new Set();
    const modal = gHouses.reduce((a, b) => ((gCounts[a] || 0) >= (gCounts[b] || 0) ? a : b));
    return new Set(gHouses.filter((h) => h !== modal));
  })();
  const gRingNames = [...gRings];
  const gRingPoss = gRingNames.length ? rdList(gRingNames.map((h) => h + "’s")) : null;
  const gDots = gRaw.flatMap((d) => {
    const meta = d.released ? d : { pollster: d.pollster, dateLabel: monthLabelFull(d.ym) };
    const ring = gRings.has(d.pollster) ? { hollow: true } : {};
    return [
      d.right != null ? { x: d.x, y: d.right, color: "var(--mood-pos)", label: "Right direction", meta, ...ring } : null,
      d.wrong != null ? { x: d.x, y: d.wrong, color: "var(--mood-neg)", label: "Wrong track", meta, ...ring } : null,
    ].filter(Boolean);
  });
  const gLine = (k) => gPts.filter((d) => d[k] != null).map((d) => ({ x: d.x, y: d[k] }));
  const gBand = (k, ck) => gPts.filter((d) => d[k] != null && d[ck] != null).map((d) => ({ x: d.x, y0: d[k] - d[ck], y1: d[k] + d[ck] }));
  const gAreas = [
    gHasRight ? { id: "g-ci-right", color: "var(--mood-pos)", className: "ci-band", edge: false, points: gBand("right", "rightCi") } : null,
    { id: "g-ci-wrong", color: "var(--mood-neg)", className: "ci-band", edge: false, points: gBand("wrong", "wrongCi") },
  ].filter((a) => a && a.points.length >= 2);
  /* the dashed reference is the headline itself */
  const gRef = { right: series(pts, "right"), wrong: series(pts, "wrong") };
  /* a cut first printed well inside the window opens the axis at the start
     of its first month – the window would otherwise leave the pool a
     sliver at the right edge of a term-long frame; the frame still runs
     to today, so the months since the last wave stay in view */
  const gXDomain = gPts.length ? [Math.max(xDomain[0], D.mx(gPts[0].ym) - 0.045), xDomain[1]] : xDomain;
  const gSized = !!(G && G.sized);
  /* the all-voters axis, widened only when a group runs off it – one scale
     for every group, so switching compares at a glance and a small group's
     wobble is never zoomed to fill the frame */
  const gVals = gPts.flatMap((p) => [p.right, p.wrong])
    .concat(gDots.map((d) => d.y))
    .concat(gAreas.flatMap((a) => a.points.flatMap((d) => [d.y0, d.y1]))).filter((v) => v != null);
  const gLo = gVals.length ? Math.min(lo, Math.floor((Math.min(...gVals) + 0.6) / 10) * 10) : lo;
  const gHi = gVals.length ? Math.max(hi, Math.min(100, Math.ceil((Math.max(...gVals) - 0.6) / 10) * 10)) : hi;
  /* the readout: the latest pooled month quoted against the headline –
     each measure's gap to all voters, with its margin – and, where
     several houses print the group, plainly that they disagree on the
     gap's size (each house's own gaps averaged over the window) */
  const gLast = gPts.length ? [...gPts].reverse().find((d) => d.wrong != null) : null;
  const gRead = !gLast ? null : (() => {
    const side = (g) => (g > 0 ? " over " : " under ");
    const absW = Math.abs(gLast.gapW).toFixed(1);
    let s = gName + ", " + monthLabelFull(gLast.ym) + ": wrong track " + absW + " points" + side(gLast.gapW) + "all voters"
      + (gLast.wrongCi != null ? " (±" + gLast.wrongCi.toFixed(1) + ")" : "");
    if (gLast.gapR != null) s += "; right direction " + Math.abs(gLast.gapR).toFixed(1) + " points" + side(gLast.gapR) + "all voters"
      + (gLast.rightCi != null ? " (±" + gLast.rightCi.toFixed(1) + ")" : "");
    s += ".";
    if (gHouses.length >= 2) {
      const gapKey = gRaw.some((d) => d.gapR != null) ? "gapR" : "gapW";
      const mean = (h) => {
        const vs = gRaw.filter((d) => d.pollster === h && d[gapKey] != null).map((d) => d[gapKey]);
        return vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : null;
      };
      const ms = gHouses.map((h) => [h, mean(h)]);
      if (ms.every(([, m]) => m != null)) s += " The pollsters disagree on how big the "
        + (gapKey === "gapR" ? "right-direction" : "wrong-track") + " gap is: "
        + rdList(ms.map(([h, m], i) => h + "’s " + (i === 0 ? "readings average " : "") + signedP(Math.round(m * 10) / 10) + " points")) + ".";
    }
    return s;
  })();
  /* the select's groups ride the emitters' dim tags, so a new house or
     cut joins its own optgroup without this list moving; the gender and
     vote cuts are printed by more than one house and bear no house name,
     while a single-house dim carries its house's tag */
  const gBy = (dim) => !D.directionGroups ? []
    : Object.keys(D.directionGroups).filter((k) => D.directionGroups[k].dim === dim).map((k) => [k, k]);
  const gGroups = [
    { label: "By gender", opts: gBy("gender") },
    { label: "By age (Essential)", opts: gBy("age") },
    { label: "By generation (RedBridge)", opts: gBy("generation") },
    { label: "By vote", opts: gBy("vote") },
    { label: "By vote firmness (RedBridge)", opts: gBy("softness") },
    { label: "By location (RedBridge)", opts: gBy("location") },
    { label: "By education (RedBridge)", opts: gBy("education") },
    { label: "By home ownership (RedBridge)", opts: gBy("ownership") },
  ].filter((g) => g.opts.length);
  const gNote = D.directionStateNote
    ? "Roy Morgan’s latest release (" + D.monthNameFull(Number(D.directionStateNote.date.slice(5, 7))) + ") prints " + D.directionStateNote.highest.state
      + " as the state most convinced the country is on the wrong track (" + D.directionStateNote.highest.w + "%), "
      + D.directionStateNote.lowest.state + " the least (" + D.directionStateNote.lowest.w + "%). Its full state table is paywalled."
    : null;

  return (
    <>
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
        {now.chg != null && <>, {rdArrow(now.chg)} {Math.abs(now.chg).toFixed(1)} on a month ago{now.changeSig === false
          ? (now.pUp != null ? ", within the margin: a " + Math.round(100 * (now.chg < 0 ? now.pUp : 1 - now.pUp)) + "% chance it " + (now.chg < 0 ? "rose" : "fell") : ", within the margin") : ""}</>}</p>
      {histOn && <RdConfWinBar win={winShown} terms={vTerms} lo={ext.lo} hi={ext.hi} nowX={nowX} onWin={onWin} />}
      <div className="card rd-card rd-dir-chart">
        <div className="rd-chead"><span className="rd-chead-t">{narrow || G
          ? "Right direction and wrong track, %"
          : "Right direction and wrong track, % of voters, month by month"}</span>
          {gGroups.length > 0 && (
            <select ref={grpSelRef} className="rd-pv-sel" aria-label="The national direction among only some voters" value={grpId}
                    onChange={(e) => setGrpId(e.target.value)}>
              <option value="">All voters</option>
              {gGroups.map((grp) => (
                <optgroup key={grp.label} label={grp.label}>
                  {grp.opts.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                </optgroup>
              ))}
            </select>
          )}
        </div>
        {narrow && !G && <RdKey items={[{ kind: "line", color: "var(--mood-neg)", label: "Wrong track" }, { kind: "line", color: "var(--mood-pos)", label: "Right direction" }]} className="rd-tpp-legend" />}
        {G && gRead && <p className="rd-dir-grp">{gRead}</p>}
        {G ? (
          <TrendChart key={"rd-dir-g-" + grpId} heightPx={narrow ? 280 : 360}
            /* a group run up to 100 needs the room "100%" takes */
            padPx={narrow ? { l: gHi >= 100 ? 42 : 34, r: 8, t: 30, b: 28 } : { l: gHi >= 100 ? 48 : 40, r: 16, t: 40, b: 30 }}
            xDomain={gXDomain} yDomain={[gLo, gHi]} yTicks={rdYTicks(gLo, gHi, 10)} yTickFmt={(v) => (v === gHi ? v + "%" : String(v))}
            xTicks={rdElectionTicks(gXDomain[0], gXDomain[1], narrow, 2025 + 122 / 365)} baseline
            series={[
              ...(gRef.wrong.length ? [{ id: "ref-wrong", label: "All voters, wrong track", color: "var(--mood-neg)", points: gRef.wrong, rdWidth: 1.25, dash: "4 4", opacity: 0.7, endCap: false }] : []),
              ...(gHasRight && gRef.right.length ? [{ id: "ref-right", label: "All voters, right direction", color: "var(--mood-pos)", points: gRef.right, rdWidth: 1.25, dash: "4 4", opacity: 0.7, endCap: false }] : []),
              { id: "wrong", label: gName + ", wrong track", color: "var(--mood-neg)", points: gLine("wrong"), rdWidth: 2.5, endCap: false, endLabel: narrow ? null : "Wrong track" },
              ...(gHasRight ? [{ id: "right", label: gName + ", right direction", color: "var(--mood-pos)", points: gLine("right"), rdWidth: 2.5, endCap: false, endLabel: narrow ? null : "Right direction" }] : []),
            ]}
            spine={gLine("wrong")} areas={gAreas} scatter={gDots.length ? gDots : undefined} pollFacet="direction"
            tooltipTitle={(i) => { const s = gPts.filter((d) => d.wrong != null); return s[i] ? monthLabelFull(s[i].ym) : ""; }}
            extraRows={(i) => {
              const d = gPts.filter((p) => p.wrong != null)[i];
              if (!d) return [];
              const gapRow = (label, g, ci) => ({
                label, value: signedP(g) + (ci != null ? " ±" + ci.toFixed(1) : ""),
              });
              return [
                gapRow("Wrong-track gap to all voters", d.gapW, d.wrongCi),
                ...(d.gapR != null ? [gapRow("Right-direction gap", d.gapR, d.rightCi)] : []),
              ];
            }}
            fmt={(v) => v.toFixed(1)}
            copy={{ title: gName + ": is the country heading in the right direction?",
                    sub: (gRead || "") + " Built like the headline: each poll’s group figure less the all-voters figure its own poll printed, the gaps pooled month by month on the lean-adjusted average.",
                    caption: "Each dot is one house’s reading for " + gName + ", anchored the same way" + (gRingPoss ? " (" + gRingPoss + " are the open rings)" : "") + "; dashed lines are all voters, the lean-adjusted average" + (gSized ? ", shading the gap’s approximate 95% margin." : "."),
                    legend: [{ label: gName + ", right direction", color: "var(--mood-pos)", kind: "line" }, { label: gName + ", wrong track", color: "var(--mood-neg)", kind: "line" }, { label: "All voters, lean-adjusted average", color: "var(--ink-3)", kind: "dashed" }] }}
          />
        ) : (
          <TrendChart key="rd-dir" heightPx={narrow ? 280 : 360}
            padPx={narrow ? { l: 34, r: 8, t: 30, b: 28 } : { l: 40, r: 16, t: 40, b: 30 }}
            xDomain={xDomain} yDomain={histOn ? yd : [lo, hi]}
            yTicks={histOn ? confTicksIn(yd, 10) : rdYTicks(lo, hi, 10)} yTickFmt={(v) => (v === hi ? v + "%" : String(v))}
            /* the axis opens on the election tick, as the 2PP, primary and
               mood charts do - 2025 + 122/365 is 3 May 2025 on gen-data's dx
               counting (rdXTicks's month grid would open at July, May falling
               between its quarter steps); a history window rides the
               confidence panel's term/year ruler instead */
            xTicks={xTicks || rdElectionTicks(xDomain[0], xDomain[1], narrow, 2025 + 122 / 365)} baseline
            driven={dragging}
            series={[
              ...histSeries, ...wordedSeries, ...soloSeries, ...worldSeries,
              { id: "wrong", label: "Wrong track", color: "var(--mood-neg)", points: series(pts, "wrong"), rdWidth: 2.5, endCap: false, endLabel: narrow || (histOn && !isCur) ? null : "Wrong track" },
              { id: "right", label: "Right direction", color: "var(--mood-pos)", points: series(pts, "right"), rdWidth: 2.5, endCap: false, endLabel: narrow || (histOn && !isCur) ? null : "Right direction" },
            ]}
            spine={histSeries.length || soloPts.length ? chartMonths : series(pts, "right")} areas={areas} scatter={dots} pollFacet={(m) => (m && (m.pre || m.noRow) ? null : "direction")}
            events={badges ? badges.events : evs} brackets={brackets}
            vlines={elecRules ? elecEvs.map((e) => ({ x: e.x, cls: "rd-conf-evrule" })) : []}
            tooltipTitle={(i) => (chartMonths[i] ? monthLabelFull(chartMonths[i].ym) : "")}
            extraRows={(i) => { const d = monthAt((chartMonths[i] || {}).x); return d && d.rightCi != null ? [{ label: "95% intervals", value: "±" + d.rightCi.toFixed(1) + ", ±" + d.wrongCi.toFixed(1) }] : []; }}
            fmt={(v) => v.toFixed(1)}
            copy={{ title: "Is Australia heading in the right direction?", span: histOn ? confWinYears(win, vTerms, nowX) : null,
                    sub: head + (MODEL
                      ? ". A model of every poll asking whether the country is heading in the right direction, adjusted for each pollster’s lean."
                      : ". Monthly averages, adjusted for each pollster’s lean, of every poll asking whether the country is heading in the right direction or on the wrong track."),
                    caption: (MODEL
                      ? "Each dot is one poll as printed; the lines are the model’s estimate for the average pollster, month by month, shaded bands their 95% intervals." + (worldOn ? " Dashed: Ipsos’ Global Average on the same terms." : "")
                      : "Each dot is one poll; lines are monthly averages, shaded bands their 95% intervals.") + (asked ? " Polls by " + asked + "." : "")
                      + (!MODEL && histOn && PRE && win.a < D.direction[0].x ? " Each house contributes wherever it printed a reading: SEC Newgate from March 2022, Essential from February 2022, Freshwater from May 2023 and RedBridge/Accent from February 2024. McKinnon’s differently worded series stays separate." : "")
                      + (MODEL && soloOn ? " Before September 2016 only Roy Morgan polled, so the level there carries the uncertainty of how its readings compared with other pollsters’ then." : "")
                      + (!MODEL && soloOn ? " Before March 2022 only Roy Morgan is on record, so its monthly averages carry no lean adjustment. The line breaks where no wave was printed for more than a quarter, and a month standing alone is a single mark." : ""),
                    legend: [{ label: "Right direction", color: "var(--mood-pos)", kind: "line" }, { label: "Wrong track", color: "var(--mood-neg)", kind: "line" }] }}
          />
        )}
        {histOn && <RdConfStrip lines={stripLines} lo={ext.lo} hi={ext.hi} win={win} terms={vTerms} onWin={onWin}
                                narrow={narrow} label="National direction, right less wrong track" />}
        {badges && !G && <RdEventList list={badges.list} />}
        {G ? (
          <RdKey className="rd-ckey" items={[
            { kind: "dot", color: "var(--ink-3)", label: "One reading" + (gRingPoss ? " (" + gRingPoss + " ride as open rings)" : "") + (gHasRight ? "" : " (" + gSrc + " print only the wrong-track share for this group)") },
            gSized ? { kind: "lineband", color: "var(--ink-3)", label: gName + ": the all-voters average plus the pooled gap, with its 95% margin" } : { kind: "line", color: "var(--ink-3)", label: gName + ": the all-voters average plus the pooled gap (no margin: the group’s size isn’t printed)" },
            { kind: "dash", color: "var(--ink-3)", label: "All voters, lean-adjusted average" },
          ]} />
        ) : (
          <RdKey className="rd-ckey" items={[
            dotsOn ? { kind: "dot", color: "var(--ink-3)", label: "One poll" } : null,
            MODEL ? { kind: "lineband", color: "var(--ink-3)", label: "The model’s estimate for the average pollster, and its 95% interval" }
              : { kind: "lineband", color: "var(--ink-3)", label: "Monthly average, adjusted for each pollster’s lean, and its 95% interval" },
            worldOn ? { kind: "dash", color: "var(--ink-3)", label: "Ipsos’ Global Average, moved onto the same terms by Ipsos’s lean in Australia" } : null,
            !MODEL && soloOn ? { kind: "line", color: "var(--ink-3)", label: "Before March 2022: Roy Morgan alone, unadjusted; breaks where it printed nothing for over a quarter" } : null,
            (histOn && !isTerm) ? { kind: "line", color: "var(--ink-3)", label: "A faint rule is a federal election; the strip beneath carries the governments" } : null,
          ]} />
        )}
      </div>
      {!G && gNote && <p className="rd-dir-extremes">{gNote}</p>}
      {G ? (
        <HowTo paras={[
          <>The line rides the lean-adjusted all-voters average through {gName}’s own gap: in each poll, {gName}’s figure less the all-voters figure its own poll printed – differencing drops that poll’s house lean – the gaps pooled month by month, weighted by sample. Each dot is one house’s reading for {gName}, anchored the same way{gRingPoss ? "; " + gRingPoss + " ride as open rings" : ""}.</>,
          <>The shading is the gap’s approximate 95% margin. {gHouses.length >= 2 ? "No house prints" : gSrc + " doesn’t print"} how many respondents this group is, so the base is the poll’s effective sample times the group’s share of adults{G.dim === "vote" ? " (of that poll’s voting intention, for a party’s voters)" : ""}.{G.dim === "vote" && G.houses.includes("Roy Morgan") ? " Roy Morgan folds its other-party voters into the Independent figure, so neither of those two groups can be sized from its prints." : ""}{gHasRight ? "" : " Where a release names only one share, the other cannot be pieced back from the national figures."}</>,
          gHouses.length >= 2
            ? (gHouses.length === 2
                ? <>Essential prints these splits most fortnights; Roy Morgan only some weeks, so a month’s pool leans on whichever asked, and some months rest on one of them.</>
                : <>Essential prints these splits most fortnights, Roy Morgan only some weeks and RedBridge/Accent’s data-table statements have carried them for three waves so far – a month’s pool leans on whichever asked, and some months rest on one of them.</>)
            : gHouses[0] === "Roy Morgan"
              ? <>Roy Morgan prints these splits only some weeks, so the series has months with nothing to pool.</>
              : gHouses[0] === "RedBridge/Accent"
                ? <>RedBridge/Accent’s data-table statements have printed these breakdowns for three waves so far, so the series has a point wherever a statement carried them.</>
                : <>Essential prints these breakdowns beside the national-mood trend in its fortnightly report, so the series has a point wherever Essential asked the question.</>,
        ]} />
      ) : (
        MODEL ? (
        <HowTo paras={[
          <>Each dot is one published reading, where its pollster printed it. The lines are a model’s estimate of what the average pollster asking this question would find, day by day, read off month by month; the shading is its 95% interval. There is a 95% chance the figure lies inside it, given the polls and the model’s assumptions.</>,
          <>The model treats the country’s mood as something that moves a little each day, faster or slower as the polls themselves show, and each pollster as seeing it through a lean of its own plus sampling error. It works out the mood and every lean together from all the polls at once, so a pollster that asks often doesn’t outvote the rest, an older poll counts for less the more opinion has moved since, and months with few polls simply carry wider shading.</>,
          <>Pollsters are compared on the ratio of right direction to wrong track, which doesn’t depend on whether “unsure” was offered: Ipsos and SEC Newgate force a choice, so their right and wrong both run higher, and Lowy and McKinnon ask about satisfaction instead. Each is read through its own lean, measured against the others, which can drift slowly. The level is set by the pollsters asking this question, each counting once; the unsure share by those that print one. The notes below say how each asks.</>,
          <>The change on a month ago compares today with the model’s estimate of a month ago using every poll since, and is called significant only when its 95% interval excludes zero. No pollster’s lean can be measured against the truth, only against the others, so an error every pollster shares stays invisible.</>,
          ...(histOn ? [
            <>The bar over the chart sets the window, as on the confidence charts. It opens on this term; ‹ and › step a term at a time, Term, 10 yrs, 25 yrs and All widen it, and the strip underneath is the whole line in miniature, as its net (right direction less wrong track), with the governments in power beneath it — drag the window, drag its edges to resize, or tap a spot to jump. Longer windows mark each federal election with a faint rule. Dots show only in a term-length window.</>,
            <>Roy Morgan has asked since 2007, Ipsos since September 2016, and the others since 2022 or later, so before September 2016 the line rests on Roy Morgan alone. Its readings can be placed against the others only from later years, and Roy Morgan changed how it polls in 2020 and again in 2022, so the shading there includes how far its lean could have been: the level is uncertain by several points, the month-to-month movement less so.</>,
            <>The dashed lines are Ipsos’ Global Average on the same terms: each wave’s ratio of right to wrong moved by Ipsos’s lean in Australia that month, then split with Australia’s unsure share. That keeps exactly the gap Ipsos itself measures between Australia and the world, and assumes, as any such comparison must, that its Australian and world samples lean alike.</>,
          ] : []),
        ]} />
        ) : (
        <HowTo paras={[
          <>Each dot is one published reading; the lines are monthly averages, shaded with their 95% intervals.</>,
          <>The lines are adjusted for each pollster’s lean. Only {(D.directionHouses || []).length} pollsters ask this question, so some months rest on a single poll: the dots show which, and the shading shows what that costs in confidence.</>,
          ...(histOn ? [
            <>The bar over the chart sets the window, as on the confidence charts. It opens on this term; ‹ and › step a term at a time, Term, 10 yrs, 25 yrs and All widen it, and the strip underneath is the whole line in miniature, as its net (right direction less wrong track), with the governments in power beneath it — drag the window, drag its edges to resize, or tap a spot to jump. Longer windows mark each federal election with a faint rule. Dots show only in a term-length window.</>,
            <>From March 2022 to April 2025, each house contributes wherever it printed: SEC Newgate from March 2022, Essential from February 2022, Freshwater from May 2023 and RedBridge/Accent from February 2024. McKinnon’s differently worded series stays separate. The pooled stretch is built like this term’s line: sample-weighted monthly means, 95% intervals, and house leans measured against the other houses present. Where only two houses ask, an unidentified level means their gap is split evenly, half to each. House-reprinted months are placed mid-month and say just the month, not fieldwork days.</>,
            <>Before March 2022 only Roy Morgan is on record, so there is nothing to pool and no lean to adjust for. The line there is built the same way from its waves alone: monthly averages weighted by sample size, with 95% intervals. It comes from the consolidated Government Confidence Rating tables and the original release tables back to mid-2007. The line breaks wherever Roy Morgan printed nothing for more than a quarter, and a month standing alone shows as a single mark. Publication hiatuses remain where the primary record prints no wave; nothing is interpolated.</>,
          ] : []),
        ]} />
        )
      )}
      {questionNotes.length ? <details className="view-how hint-how rd-dirq">
        <summary>How each pollster asks</summary>
        <div className="rd-dirq-grid">
          {questionNotes.map((q) => (
            <section className="rd-dirq-house" key={q.house}>
              <h5 className="rd-dirq-name">{q.house}{q.url ? <> <a className="rd-link" href={q.url} target="_blank" rel="noopener noreferrer">source<span className="plink-mark">↗</span></a></> : null}</h5>
              <p className="rd-dirq-q">{q.unverified ? q.question : "“" + q.question + "”"}</p>
              {q.answers && <p className="rd-dirq-l"><span className="rd-dirq-k">Answers</span>{q.answers}</p>}
              {q.method && <p className="rd-dirq-l"><span className="rd-dirq-k">Method</span>{q.method}</p>}
              {q.role && MODEL && <p className="rd-dirq-l"><span className="rd-dirq-k">In the line</span>{directionRoleText(q)}</p>}
            </section>
          ))}
        </div>
      </details> : null}
      <RdFoot how={{ term: "direction", from: "National mood" }}>
        {foot}

      </RdFoot>
    </>
  );
}
/* The trend line over a set of small multiples. Each series that moved (its
   within-pollster slope clears the Holm-gated test) is named with its
   direction and, where the rounded figures agree with that direction, its
   first monthly average against the current reading. The rest are said to
   show "no clear change" - never "held", which a failed test can't claim.
   items: [{ first, later, b, from, to }] in display order; `first` names the
   series in full, `later` once the cohort is named. */
function rdTrendLine(items, sinceM, none, rest) {
  if (!items.length) return none + " since " + sinceM + ".";
  const said = items.map((it, i) => {
    const up = it.b > 0, f = Math.round(it.from), t = Math.round(it.to);
    const fig = it.from != null && it.to != null && (up ? t > f : t < f) ? " from " + f + "% to " + t + "%" : "";
    return (i ? it.later : it.first) + " has " + (up ? "risen" : "fallen") + fig;
  });
  return "Since " + sinceM + ", " + (said.length === 2 ? said.join(", and ") : rdList(said)) + "." + (rest ? " " + rest : "");
}
/* how many polls a month's average rests on, as words */
function rdPollsPerMonth(lo, hi) {
  return "Each month’s average rests on " + (lo === hi ? rdNumWord(lo) : rdNumWord(lo) + " to " + rdNumWord(hi))
    + (hi === 1 ? " poll" : " polls") + ", so a move that stays inside the shading can’t be told from noise.";
}

/* ======================================================================
   Who votes for whom
   ====================================================================== */
const RD_DEMO_SHORT = {
  "18–34": "18–34s", "35–54": "35–54s", "55+": "over-55s", "Gen Z": "Gen Z", Millennials: "Millennials",
  "Gen X": "Gen X", Boomers: "Boomers", Men: "men", Women: "women",
  "Year 12 or less": "voters with Year 12 or less", "TAFE or trade": "TAFE- or trade-qualified voters", University: "university graduates",
  NSW: "NSW voters", Vic: "Victorians", Qld: "Queenslanders", SA: "South Australians", WA: "West Australians",
  "ACT/NT/Tas": "Tasmanians, Canberrans and Territorians", "Non-NSW/Vic/Qld": "voters in the non-eastern-mainland states",
  "Inner metro": "inner-suburban voters", "Outer metro": "outer-suburban voters", Provincial: "provincial voters", Rural: "rural voters",
  "Own outright": "outright owners", Mortgage: "mortgage holders", Renting: "renters",
  "English only": "English-only speakers", "Other language": "voters who speak another language at home",
  "Full time": "full-time workers", "Part time": "part-time workers", Retired: "retirees",
  // the income tab's two standard bands
  "Lower earners (bottom 50%)": "lower earners (bottom 50%)", "Higher earners (top 15%)": "higher earners (top 15%)",
};
/* ---- the headline: who each party's voters are ----------------------------
   One line per party, constant across the grouping tabs, written from the
   pooled figures by fixed rules so it turns over with the pool. (It replaced
   the hand-curated RD_DEMO_HOME lines on 2026-10-11, when four of the five
   still named a trait the pool no longer supported.)
   1. Only a group clear of all voters by more than its own 95% margin - the
      dot plot's filled dot - can be named.
   2. Each trait (age, gender, education, area, state, home, income,
      language, work) makes at most one "more likely" and one "less likely"
      claim.
   3. On an ordered trait (age, education, area, home, income) the two ends
      leaning opposite ways are ONE tilt - older, less educated, more
      regional - named once, from the over-represented end. A gap that stops
      short of the far end (the Coalition's outer suburbs beside its inner-metro
      lead) is a fact of its own and keeps its own clause. Unordered traits
      (states, work) name each direction: Queensland above and Victoria
      below are two facts.
   4. Neighbours leaning the same way share a name: provincial and rural are
      "regional", Year 12 or less and TAFE "without a degree", 18–34 and
      35–54 "under 55". A pole spanning all but one group, with no such
      name, is said from the one group left instead.
   5. Age has two rulers. The bands lead; a generation inside a band (Gen Z
      in 18–34, Boomers in 55+) stands in for it only when its gap beats the
      band's by more than the band's own margin - the band's lean is then
      concentrated in that generation. A band and a generation inside it
      leaning opposite ways means the rulers disagree, and age is left out.
   6. Places nest: the non-eastern-mainland bucket speaks for SA, WA and
      ACT/NT/Tas while none of them leans the other way.
   7. Retirement that only repeats the age claim (retired with older, not
      retired with younger) is left out.
   8. Claims rank by how far they move the make-up of the party's voters
      from the electorate's: the group's share of adults x (its figure ÷
      all voters' − 1). The five heaviest stay, at most four "more likely"
      and three "less likely", printed in the traits' fixed order. */
const RD_DEMO_SUBJ = { onp: "One Nation voters", alp: "Labor voters", lnp: "Coalition voters", grn: "Greens voters", oth: "Voters for others & independents" };
/* a group's words, or merged neighbours': [after "more likely to be",
   after "less likely to"] */
const RD_DEMO_PH = {
  "18–34": ["18–34", "be 18–34"], "35–54": ["35–54", "be 35–54"], "55+": ["55+", "be 55+"],
  "18–34|35–54": ["under 55", "be under 55"], "35–54|55+": ["35 or older", "be 35 or older"],
  "Gen Z": ["Gen Z", "be Gen Z"], Millennials: ["Millennials", "be Millennials"], "Gen X": ["Gen X", "be Gen X"], Boomers: ["Boomers", "be Boomers"],
  "Gen Z|Millennials": ["Gen Z or Millennials", "be Gen Z or Millennials"], "Millennials|Gen X": ["Millennials or Gen X", "be Millennials or Gen X"],
  "Gen X|Boomers": ["Gen X or Boomers", "be Gen X or Boomers"],
  Men: ["men", "be men"], Women: ["women", "be women"],
  "Year 12 or less": ["educated to Year 12 or less", "be educated to Year 12 or less"],
  "TAFE or trade": ["TAFE- or trade-qualified", "be TAFE- or trade-qualified"],
  University: ["university-educated", "be university-educated"],
  "Year 12 or less|TAFE or trade": ["without a degree", "be without a degree"],
  "TAFE or trade|University": ["qualified beyond school", "have a post-school qualification"],
  "Inner metro": ["inner-metro", "live in an inner metro"], "Outer metro": ["outer-metro", "live in an outer metro"],
  Provincial: ["provincial", "live in provincial areas"], Rural: ["rural", "be rural"],
  "Inner metro|Outer metro": ["metropolitan", "live in a metro area"], "Provincial|Rural": ["regional", "be regional"],
  "Outer metro|Provincial": ["outer-metro or provincial", "live in an outer metro or a provincial area"],
  "Own outright": ["outright homeowners", "own their home outright"], Mortgage: ["mortgage holders", "have a mortgage"], Renting: ["renting", "rent"],
  "Own outright|Mortgage": ["homeowners", "own their home"], "Mortgage|Renting": ["paying off a mortgage or renting", "pay off a mortgage or rent"],
  "Full time": ["working full time", "work full time"], "Part time": ["working part time", "work part time"], Retired: ["retired", "be retired"],
  "Lower earners (bottom 50%)": ["on lower incomes", "be on lower incomes"], "Higher earners (top 15%)": ["on higher incomes", "be on higher incomes"],
};
/* the states after "live in", and as "more likely to be ..." */
const RD_DEMO_PLACE = { NSW: "NSW", Vic: "Victoria", Qld: "Queensland", SA: "South Australia", WA: "Western Australia",
  "ACT/NT/Tas": "Tasmania, the ACT and the NT", "Non-NSW/Vic/Qld": "the non-eastern-mainland states" };
const RD_DEMO_PLACE_BE = { NSW: "from NSW", Vic: "Victorian", Qld: "Queenslanders", SA: "South Australian", WA: "West Australian",
  "ACT/NT/Tas": "from Tasmania, the ACT or the NT", "Non-NSW/Vic/Qld": "from the non-eastern-mainland states" };
/* the ordered traits' groups in order; the states in map order */
const RD_DEMO_SCALE = { age: ["18–34", "35–54", "55+"], generation: ["Gen Z", "Millennials", "Gen X", "Boomers"],
  education: ["Year 12 or less", "TAFE or trade", "University"], location: ["Inner metro", "Outer metro", "Provincial", "Rural"],
  housing: ["Own outright", "Mortgage", "Renting"], income: ["Lower earners (bottom 50%)", "Higher earners (top 15%)"] };
const RD_DEMO_MAP = ["NSW", "Vic", "Qld", "SA", "WA", "ACT/NT/Tas", "Non-NSW/Vic/Qld"];
/* a generation wholly inside an age band */
const RD_DEMO_IN_BAND = { "Gen Z": "18–34", Boomers: "55+" };
const RD_DEMO_TRAITS = ["age", "gender", "education", "area", "state", "home", "income", "language", "work"];
const rdSerial = (xs, conj) => (xs.length < 2 ? xs[0] || "" : xs.length === 2 ? xs[0] + " " + conj + " " + xs[1]
  : xs.slice(0, -1).join(", ") + ", " + conj + " " + xs[xs.length - 1]);
/* every group against all voters, by label: its gap, whether its dot is
   filled, and its weight - how far it moves the party's voter make-up */
function rdDemoStand(T, party) {
  const A = T.all[party], G = {};
  for (const tab of T.tabs) for (const st of tab.sets) for (const g of st.groups) {
    const v = g.v[party], ci = g.ci[party] || 0;
    if (v == null) continue;
    const d = v - A;
    G[g.label] = { g, v, ci, d, dir: Math.sign(d), sig: Math.abs(d) > ci, w: (g.share || 0) * Math.abs(d) / A };
  }
  return G;
}
function rdDemoHead(T, party) {
  const G = rdDemoStand(T, party);
  const sigOf = (labels, dir) => labels.map((l) => G[l]).filter((s) => s && s.sig && s.dir === dir);
  const claims = [];
  /* a merged pole weighs what its groups weigh together (regional voters
     are provincial plus rural); a clause naming two separate places weighs
     its heavier one */
  const add = (trait, dir, key, ss, places) => claims.push({ trait, dir, key, places,
    w: places ? Math.max(...ss.map((s) => s.w)) : ss.reduce((a, s) => a + s.w, 0), labels: ss.map((s) => s.g.label) });
  /* an ordered set's pole: neighbours merge under one name (rule 4); a pole
     with no name falls back to its heaviest group */
  const poleOf = (set, ss) => {
    if (!ss.length) return null;
    const ord = RD_DEMO_SCALE[set];
    const ix = ss.map((s) => ord.indexOf(s.g.label)).sort((a, b) => a - b);
    const key = ix.map((i) => ord[i]).join("|");
    if (ss.length === 1 || (ix.every((x, i) => !i || x === ix[i - 1] + 1) && RD_DEMO_PH[key])) return { key, ss, ix };
    const best = ss.slice().sort((a, b) => b.w - a.w)[0];
    return { key: best.g.label, ss: [best], ix: [ord.indexOf(best.g.label)] };
  };
  /* rule 3: the two ends leaning opposite ways, each pole holding its end */
  const tilt = (n, P, N) => !!(P && N) && ((Math.max(...P.ix) < Math.min(...N.ix) && P.ix.includes(0) && N.ix.includes(n - 1))
    || (Math.min(...P.ix) > Math.max(...N.ix) && P.ix.includes(n - 1) && N.ix.includes(0)));
  const scale = (trait, set) => {
    const ord = RD_DEMO_SCALE[set];
    const up = sigOf(ord, 1), down = sigOf(ord, -1);
    const upKey = ord.filter((l) => up.some((s) => s.g.label === l)).join("|");
    const flip = up.length > 1 && up.length >= ord.length - 1 && !RD_DEMO_PH[upKey] && down.length === 1;
    const P = flip ? null : poleOf(set, up), N = poleOf(set, down);
    if (P) add(trait, 1, P.key, P.ss);
    if (N && (!P || !tilt(ord.length, P, N))) add(trait, -1, N.key, N.ss);
  };
  /* rule 5: age's two rulers. Returns the lean the work claims are read
     against: +1 older, −1 younger, 0 none said */
  const ageLean = (() => {
    if (Object.entries(RD_DEMO_IN_BAND).some(([gen, band]) => G[gen] && G[band] && G[gen].sig && G[band].sig && G[gen].dir !== G[band].dir)) return 0;
    const pick = (dir) => {
      let pole = poleOf("age", sigOf(RD_DEMO_SCALE.age, dir));
      if (pole && pole.ss.length === 1) {
        const band = pole.ss[0];
        const gen = Object.keys(RD_DEMO_IN_BAND).find((k) => RD_DEMO_IN_BAND[k] === band.g.label);
        const s = gen && G[gen];
        if (s && s.sig && s.dir === dir && Math.abs(s.d) - Math.abs(band.d) > band.ci) pole = { key: gen, ss: [s] };
      }
      return pole || poleOf("generation", sigOf(RD_DEMO_SCALE.generation, dir));
    };
    const end = (p) => (p.ss.some((s) => s.g.label === "18–34" || s.g.label === "Gen Z") ? -1
      : p.ss.some((s) => s.g.label === "55+" || s.g.label === "Boomers") ? 1 : 0);
    const P = pick(1), N = pick(-1);
    if (P) add("age", 1, P.key, P.ss);
    if (N && !(P && end(P) && end(N) === -end(P))) add("age", -1, N.key, N.ss);
    return P ? end(P) : N ? -end(N) : 0;
  })();
  /* gender: a pair, said from whichever side is over-represented */
  const sexes = [G.Men, G.Women].filter((s) => s && s.sig);
  if (sexes.length) {
    const s = sexes.slice().sort((a, b) => b.w - a.w)[0];
    const label = s.dir > 0 ? s.g.label : s.g.label === "Men" ? "Women" : "Men";
    claims.push({ trait: "gender", dir: 1, key: label, w: s.w, labels: [label] });
  }
  scale("education", "education");
  scale("area", "location");
  /* rule 6: the states, the bucket speaking for members that lean its way */
  const BUCKET = "Non-NSW/Vic/Qld", inBucket = (l) => DEMO_WITHIN[l] === BUCKET;
  for (const dir of [1, -1]) {
    let ps = sigOf(RD_DEMO_MAP.filter((l) => l !== BUCKET), dir);
    const b = G[BUCKET];
    if (b && b.sig && b.dir === dir && !sigOf(RD_DEMO_MAP.filter(inBucket), -dir).length)
      ps = ps.filter((s) => !inBucket(s.g.label)).concat([b]);
    ps = ps.sort((x, y) => y.w - x.w).slice(0, 2).sort((x, y) => RD_DEMO_MAP.indexOf(x.g.label) - RD_DEMO_MAP.indexOf(y.g.label));
    if (ps.length) add("state", dir, ps.map((s) => s.g.label).join("|"), ps, ps.map((s) => s.g.label));
  }
  scale("home", "housing");
  /* income: the two standard bands read off every house's own brackets
     (gen-data §7g-income); a lower-up/higher-down tilt is one claim from
     the over-represented end, like any other two-group ordered trait */
  scale("income", "income");
  /* language: a pair, said of the minority language either way */
  const lo = G["Other language"], le = G["English only"];
  const ldir = lo && lo.sig ? lo.dir : le && le.sig ? -le.dir : 0;
  if (ldir) claims.push({ trait: "language", dir: ldir, key: "Other language", w: Math.max(lo ? lo.w : 0, le ? le.w : 0), labels: ["Other language"] });
  /* work, less retirement that only repeats the age claim (rule 7) */
  for (const dir of [1, -1]) {
    const ss = sigOf(["Full time", "Part time", "Retired"], dir).filter((s) => !(s.g.label === "Retired" && ageLean === dir));
    if (ss.length) { const s = ss.sort((a, b) => b.w - a.w)[0]; add("work", dir, s.g.label, [s]); }
  }
  /* rule 8: the heaviest five, then the traits' own order */
  const kept = [];
  for (const c of claims.slice().sort((a, b) => b.w - a.w)) {
    if (kept.length >= 5) break;
    if (kept.filter((k) => k.dir === c.dir).length >= (c.dir > 0 ? 4 : 3)) continue;
    kept.push(c);
  }
  const order = (a, b) => RD_DEMO_TRAITS.indexOf(a.trait) - RD_DEMO_TRAITS.indexOf(b.trait);
  const pos = kept.filter((c) => c.dir > 0).sort(order), neg = kept.filter((c) => c.dir < 0).sort(order);
  const beOf = (c) => (c.trait === "state" ? (c.places.length === 1 ? RD_DEMO_PLACE_BE[c.places[0]] : "from " + rdSerial(c.places.map((p) => RD_DEMO_PLACE[p]), "or"))
    : c.trait === "language" ? null : RD_DEMO_PH[c.key][0]);
  const toOf = (c) => (c.trait === "state" ? "live in " + rdSerial(c.places.map((p) => RD_DEMO_PLACE[p]), "or")
    : c.trait === "language" ? "speak a language other than English at home" : RD_DEMO_PH[c.key][1]);
  /* "more likely to be A, B and C, and to speak ...": the be-list keeps its
     Oxford comma unless a verb follows it */
  const be = pos.filter((c) => beOf(c) != null).map(beOf), verbs = pos.filter((c) => beOf(c) == null).map(toOf);
  const more = !be.length ? rdSerial(verbs, "and")
    : "be " + (verbs.length ? (be.length < 2 ? be[0] : be.slice(0, -1).join(", ") + " and " + be[be.length - 1]) + ", and to " + rdSerial(verbs, "and") : rdSerial(be, "and"));
  /* a place pair carries its own "or", so the list repeats "to" to keep
     its items apart */
  const outs = neg.map(toOf);
  const less = outs.some((t) => / or /.test(t)) ? outs.map((t, i) => (!i ? "" : i === outs.length - 1 ? "or to " : "to ") + t).join(", ") : rdSerial(outs, "or");
  const subj = RD_DEMO_SUBJ[party];
  const head = !kept.length ? subj + " look much like the electorate as a whole"
    : subj + " are " + [pos.length ? "more likely to " + more : "", neg.length ? "less likely to " + less : ""].filter(Boolean).join("; ");
  return { head, claims, kept };
}

/* ---- the dek: what each split of the tab shows ----------------------------
   Per set, the strongest statement the panel's tests support, so the dek
   can never contradict the dots above it:
   - demoFinding's pair tests (Holm-corrected): a steady rise or fall across
     an ordered set (every step passing), one group apart from the rest, or
     the widest gap that passes;
   - failing those, the groups whose dot is filled - clear of all voters by
     more than their margin - each with its figure beside all voters';
   - only when neither finds anything, "much the same".
   The first set leads with its finding and a figures sentence; later sets
   fold their figures in and stay quiet when they have nothing to say. On
   the Age tab a band and a generation inside it leaning opposite ways (two
   rulers, mostly asked by different pollsters) is said outright. */
/* two shares as fractions a reader says aloud, or null when snapping each to
   its nearest fraction would misstate the gap between them by more than half
   of it (or a point): 28.1 v 25.6 reads "about three in ten" v "one in
   four", a five-point gap for a 2.5-point one */
function rdFracPair(va, vb) {
  const sa = rdFracSnap(va), sb = rdFracSnap(vb);
  const off = Math.abs((sa.a / sa.b - sb.a / sb.b) * 100 - (va - vb));
  return off > Math.max(1, Math.abs(va - vb) / 2) ? null : [rdFraction(va), rdFraction(vb)];
}
const RD_DEMO_TREND = { age: "with age", generation: "with each older generation", location: "with distance from the city" };
function rdDemoDek(T, tab, party) {
  const all = T.all[party];
  const pName = DEMO_VOTE_FOR[party];
  const pVote = party === "oth" ? "the vote for others & independents" : pName + (/s$/.test(pName) ? "’" : "’s") + " vote";
  const pIt = rdPlural(party) ? "them" : "it";
  const short = (g) => RD_DEMO_SHORT[g.label] || DEMO_WHO[g.label] || g.label;
  const who = (g) => DEMO_WHO[g.label] || g.label;
  const v = (g) => g.v[party];
  const pct = (x) => x.toFixed(1) + "%";
  const filled = (g) => v(g) != null && Math.abs(v(g) - all) > (g.ci[party] || 0);
  const out = [];
  let lastTrend = 0, allSaid = false;
  tab.sets.forEach((st, si) => {
    const f = demoFinding(st, party);
    if (!f) return;
    const words = DEMO_SET_WORDS[st.id] || {};
    // the party is named in the first sentence, "it" or "them" after
    const pRef = si ? pIt : pName;
    // "one in three X back P, against one in six Y" - or as percentages
    const contrast = (a, b) => {
      const fr = rdFracPair(v(a), v(b));
      return fr ? rdCap(fr[0]) + " " + short(a) + " back " + pName + ", against " + fr[1] + " " + short(b) + "."
        : pct(v(a)) + " of " + short(a) + " back " + pName + ", against " + pct(v(b)) + " of " + short(b) + ".";
    };
    const both = (a, b, link) => {
      const fr = rdFracPair(v(a), v(b));
      return fr ? fr[0] + " " + short(a) + link + fr[1] + " " + short(b) : pct(v(a)) + " of " + short(a) + link + pct(v(b)) + " of " + short(b);
    };
    const figs = (a, b) => rdFracPair(v(a), v(b)) || [pct(v(a)), pct(v(b))];
    const one = (g) => (rdFracPair(v(g), all) ? rdFraction(v(g)) : pct(v(g)));
    const kind = f.kind;
    if (kind === "trend") {
      const phrase = (f.dir > 0 ? "climbs " : "falls ") + (RD_DEMO_TREND[st.id] || words.step);
      if (!si) {
        const [hi, lo] = v(f.last) >= v(f.first) ? [f.last, f.first] : [f.first, f.last];
        out.push(rdCap(pVote) + " " + phrase + ".", contrast(hi, lo));
      } else out.push(rdCap(pVote) + (lastTrend === f.dir ? " also " : " ") + phrase + ", from " + both(f.first, f.last, " to ") + ".");
      lastTrend = f.dir;
      return;
    }
    lastTrend = 0;
    if (kind === "top" || kind === "bot") {
      const lead = rdCap(who(f.g)) + " are " + (kind === "top" ? "more" : "less") + " likely than " + words.others + " to vote for " + pRef;
      if (!si) out.push(lead + ".", kind === "top" ? contrast(f.g, f.other) : contrast(f.other, f.g));
      else out.push(lead + ", at " + one(f.g) + ".");
      return;
    }
    if (kind === "pair") {
      const lead = rdCap(who(f.a)) + " are more likely than " + who(f.b) + " to vote for " + pRef;
      if (!si) out.push(lead + ".", contrast(f.a, f.b));
      else out.push(lead + ", at " + figs(f.a, f.b).join(" against ") + ".");
      return;
    }
    /* no pair differs: the filled dots, the bucket speaking for members
       that lean its way */
    let marked = st.groups.filter(filled);
    marked = marked.filter((g) => !marked.some((b) => DEMO_WITHIN[g.label] === b.label && Math.sign(v(b) - all) === Math.sign(v(g) - all)));
    if (marked.length) {
      const up = marked.filter((g) => v(g) > all), down = marked.filter((g) => v(g) < all);
      const list = (gs) => rdSerial(gs.map((g) => short(g) + " (" + pct(v(g)) + ")"), "and");
      const overall = "voters overall" + (allSaid ? "" : " (" + pct(all) + ")");
      allSaid = true;
      out.push(rdCap(up.length ? list(up) + " are more likely" : list(down) + " are less likely") + " than " + overall + " to vote for " + pRef
        + (up.length && down.length ? ", and " + list(down) + " less likely" : "") + ".");
      return;
    }
    if (!si) {
      const pair2 = words.all === "men and women" || words.all === "owners and renters";
      out.push(rdCap(pVote) + " is much the same across " + (words.all || "these groups") + ".",
        rdCap(rdFraction(all)) + (pair2 ? " " + words.all + " alike" : " of every " + (words.one || "group")) + " back " + pName + ".");
    }
  });
  /* the income tab's caveat, whichever way the finding landed */
  if (tab.id === "income") {
    const nt = tab.sets[0] && tab.sets[0].note;
    if (nt) out.push(rdCap(nt) + ".");
  }
  /* the Age tab's two rulers pulling apart */
  if (tab.id === "age") {
    const gs = tab.sets.flatMap((s) => s.groups);
    for (const [gen, band] of Object.entries(RD_DEMO_IN_BAND)) {
      const g = gs.find((x) => x.label === gen), b = gs.find((x) => x.label === band);
      if (!g || !b || !filled(g) || !filled(b) || Math.sign(v(g) - all) === Math.sign(v(b) - all)) continue;
      const [up, dn] = v(b) > all ? [b, g] : [g, b];
      const apart = !(g.houses || []).some((h) => (b.houses || []).includes(h));
      out.push("The two splits disagree here: " + short(up) + " sit above all voters but " + short(dn) + " below" + (apart ? ", and different pollsters ask each" : "") + ".");
    }
  }
  /* the Age tab's estimated figures (gen-data §7g-age): whose groups were
     read off their own age bands rather than printed, whatever the finding */
  const est = tab.id === "age" && (tab.sets.find((s) => s.est) || {}).est;
  if (est && est.houses.length && est.groups.length) {
    const and = (a) => (a.length < 3 ? a.join(" and ") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1]);
    out.push(and(est.houses.map((h) => demoHouse(h) + "’s"))
      + " figures for " + and(est.groups) + " are estimated from " + (est.houses.length === 1 ? "its" : "their") + " own age bands.");
  }
  return out.join(" ");
}
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
/* the earner rows' parenthetical, RdGenBorn's twin in behaviour and dress
   (user dictate, 2026-10-16): the electorate share rides the label inline
   and lights on a mouse hover or a tap. The band's outer edge priced in
   each pooled basis' dollars (household first) can't swap in place as the
   birth years do - two clauses measure ~270px against the 200px label
   column, so swapped in they re-wrapped the whole bracket onto two more
   lines and moved the button out from under the pointer. Instead the share
   stays put and the cut-offs open beneath the label, one basis a line in
   the bands pill's own "$129k" form, each line inside the label column at
   every width (the word "income" drops at ≤560px). pct selects by index:
   gen-data maps the open-ended higher band (hi===1) to 0, the lower one
   to 1 */
const RD_INCOME_REST = ["top 15%", "bottom 50%"];
const RD_INCOME_OP = ["≥", "≤"];
function RdIncomeCut({ pct, cuts }) {
  const [hover, setHover] = useState(false);
  const [tapped, setTapped] = useState(false);
  const asCuts = hover || tapped;
  return (
    <>
      <button type="button" className={"rd-wv-born cuts" + (asCuts ? " on" : "")}
              aria-pressed={asCuts}
              aria-label={"the " + RD_INCOME_REST[pct] + " of the electorate, shows the income cut-offs"}
              onPointerEnter={(e) => { if (e.pointerType === "mouse") setHover(true); }}
              onPointerLeave={(e) => { if (e.pointerType === "mouse") setHover(false); }}
              onClick={() => setTapped((v) => !v)}>
        ({RD_INCOME_REST[pct]})
      </button>
      {asCuts ? (
        <span className="rd-wv-cuts">
          {cuts.map((c) => (
            <span className="rd-wv-cin" key={c.basis}>{c.basis}<span className="rd-wv-iw"> income</span> {RD_INCOME_OP[pct]} {"$" + c.ots + "k"}</span>
          ))}
        </span>
      ) : null}
    </>
  );
}
/* rug dots pick the chart engine's way: the corridor, not the dots, decides
   which dot a pointer meant. Each 6px dot wears an 18x16px ::before hit
   strip and the lane dodge separates only the discs, so dots 6-12px apart
   on one lane had overlapping strips - and DOM order (gen-data sorts oldest
   first) put the newer dot's strip over its older neighbour's disc outright:
   a click on YouGov's dot once opened the newer Resolve poll. The container
   instead picks the nearest dot centre analytically from the data (the
   container rect the only layout read), so overlaps can never shadow. */
const RUG_PICK_MOUSE = 11, RUG_PICK_TOUCH = 22;
function nearestRugIdx(rugEl, xs, lanes, clientX, clientY, rPx) {
  const box = rugEl.getBoundingClientRect();
  if (!box.width || !box.height) return null;
  let best = null, bestD = rPx;
  for (let i = 0; i < xs.length; i++) {
    if (xs[i] == null) continue;
    const dx = clientX - (box.left + (xs[i] / 100) * box.width);
    const dy = clientY - (box.bottom - 3 - (lanes[i] || 0) * 6);
    const d = Math.hypot(dx, dy);
    if (d <= bestD) { best = i; bestD = d; }
  }
  return best;
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
      g.px[party].map((x, i) => ({ i, p: x == null ? null : xp(x) })).filter((e) => e.p != null).sort((a, c) => a.p - c.p).forEach(({ i, p }) => {
        let l;
        if (p - last[0] >= gap) l = 0;
        else if (p - last[1] >= gap) l = 1;
        else l = last[0] <= last[1] ? 0 : 1;
        last[l] = p;
        next[i] = l;
      });
      setUps((prev) => (prev && prev.length === next.length && next.every((v, k) => v === prev[k]) ? prev : next));
      const ringPx = b.offsetWidth / 2 + 2.75;
      const nextRing = g.px[party].map((x) => x != null && Math.abs(xp(x) - allXp) * (w / 100) <= ringPx);
      setRings((prev) => (prev && prev.length === nextRing.length && nextRing.every((v, k) => v === prev[k]) ? prev : nextRing));
    };
    // a skipped section's rug is packed by the observer on approach (cvSkipped)
    if (!cvSkipped(el)) compute();
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
  /* hoisted per-dot facts, so the corridor's handlers and the dots' own
     rendering read the same row key and doc for an index */
  const xs = g.px[party];
  const keys = xs.map((x, i) => {
    const d = x == null ? null : g.pd[i] || null;
    return d && d.r && window.AP && window.AP.pollRowKey ? window.AP.pollRowKey({ pollster: d.f, released: d.r }) : null;
  });
  const openIdx = (i) => {
    const rk = keys[i];
    if (!rk || !(window.AP && window.AP.openPoll)) return;
    setTip(null);
    /* the poll's own vote by group, on the split of the tab the dot
       sits under (user call 2026-10-04: dots open the poll in the
       All-polls demographics facet) */
    window.AP.openPoll(rk, "demographics", "who votes for whom", split);
  };
  // the pick coordinates are the laid-out positions: the display percents
  const posX = xs.map((x) => (x == null ? null : xp(x)));
  const pickAt = (ev, rPx) => (rugBox.current ? nearestRugIdx(rugBox.current, posX, ups || [], ev.clientX, ev.clientY, rPx) : null);
  const [cur, setCur] = useState(null);   // the pointer's current pick: drives the corridor cursor
  return (
    <span ref={rugBox} className={"rd-wv-rug" + (tip ? " lit" : "")}
         style={{ cursor: cur != null && keys[cur] ? "pointer" : undefined }}
         onPointerMove={(ev) => {
           if (ev.pointerType !== "mouse") return;
           const i = pickAt(ev, RUG_PICK_MOUSE);
           setCur(i);
           setTip((tp) => {
             if (i == null) return tp && tp.src === "mouse" ? null : tp;
             if (tp && tp.i === i) return tp;
             return { i, src: "mouse" };
           });
         }}
         onPointerLeave={() => { setCur(null); setTip((tp) => (tp && tp.src === "mouse" ? null : tp)); }}
         onPointerDown={(ev) => { ptr.current = ev.pointerType; }}
         onClick={(ev) => {
           const pt = ev.detail === 0 ? "key" : ptr.current;
           ptr.current = null;
           if (pt === "key") return;
           const i = pickAt(ev, pt === "touch" ? RUG_PICK_TOUCH : RUG_PICK_MOUSE);
           if (i == null) return;
           ev.stopPropagation();
           if (pt === "mouse") { openIdx(i); return; }
           if (tip && tip.i === i && tip.src === "touch") setTip(null); else setTip({ i, src: "touch" });
         }}>
      {xs.map((x, i) => {
        if (x == null) return null;   // the wave printed no such party (an Others fold isn't a dot at zero)
        const d = g.pd[i] || null;
        if (!d) return <b key={i} className={rings && rings[i] ? "ring" : ""} style={{ "--x": xp(x), "--pcolor": pColor, "--v": ups ? ups[i] : 0 }}><i aria-hidden="true"></i></b>;
        const rk = keys[i];
        const open = () => openIdx(i);
        const lab = d.f + ", " + d.l + " · " + x.toFixed(1) + "% · n≈" + d.n;
        const on = tip && tip.i === i;
        return (
          <b key={i} className={[(rk ? "on" : ""), (on ? "hi" : ""), (rings && rings[i] ? "ring" : "")].filter(Boolean).join(" ") || undefined} style={{ "--x": xp(x), "--pcolor": pColor, "--v": ups ? ups[i] : 0 }}
             role={rk ? "button" : "img"} tabIndex={rk ? 0 : undefined}
             aria-label={lab + (rk ? ", press Enter to open this poll" : "")}
             onFocus={(ev) => { if (ev.target.matches(":focus-visible")) show(i, "focus"); }}
             onBlur={() => hide(i, "focus")}
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
   board's ring, the corridor's own nearest-centre picking (the ::before hit
   strips once let a newer dot shadow its older neighbour's clicks), click
   to open, a touch tap's readout dismissing on the next
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
    // a skipped section's rug is packed by the observer on approach (cvSkipped)
    if (!cvSkipped(el)) compute();
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
  /* hoisted per-dot facts, so the corridor's handlers and the dots' own
     rendering read the same row key for an index */
  const xs = items.map((it) => dxp(it.y));
  const keys = items.map((it) => {
    const q = it.q;
    return window.AP && window.AP.pollRowKey ? window.AP.pollRowKey({ pollster: q.pollster, released: q.released }) : null;
  });
  const openIdx = (i) => {
    const rk = keys[i];
    if (!rk || !(window.AP && window.AP.openPoll)) return;
    setTip(null);
    window.AP.openPoll(rk, "leadership", "leadership");
  };
  const pickAt = (ev, rPx) => (rugBox.current ? nearestRugIdx(rugBox.current, xs, ups || [], ev.clientX, ev.clientY, rPx) : null);
  const [cur, setCur] = useState(null);   // the pointer's current pick: drives the corridor cursor
  return (
    <span ref={rugBox} className={"rd-dp-rug" + (tip ? " lit" : "")}
         style={{ cursor: cur != null && keys[cur] ? "pointer" : undefined }}
         onPointerMove={(ev) => {
           if (ev.pointerType !== "mouse") return;
           const i = pickAt(ev, RUG_PICK_MOUSE);
           setCur(i);
           setTip((tp) => {
             if (i == null) return tp && tp.src === "mouse" ? null : tp;
             if (tp && tp.i === i) return tp;
             return { i, src: "mouse" };
           });
         }}
         onPointerLeave={() => { setCur(null); setTip((tp) => (tp && tp.src === "mouse" ? null : tp)); }}
         onPointerDown={(ev) => { ptr.current = ev.pointerType; }}
         onClick={(ev) => {
           const pt = ev.detail === 0 ? "key" : ptr.current;
           ptr.current = null;
           if (pt === "key") return;
           const i = pickAt(ev, pt === "touch" ? RUG_PICK_TOUCH : RUG_PICK_MOUSE);
           if (i == null) return;
           ev.stopPropagation();
           if (pt === "mouse") { openIdx(i); return; }
           if (tip && tip.i === i && tip.src === "touch") setTip(null); else setTip({ i, src: "touch" });
         }}>
      {items.map((it, i) => {
        const q = it.q;
        const key = q.pollster + "|" + q.released + (it.fav ? "|f" : "");
        const rk = keys[i];
        const open = () => openIdx(i);
        const lab = q.pollster + ", " + (q.fieldPending ? "TBC" : q.field) + " · " + fmt(it.y) + (q.sample != null ? " · n≈" + window.AUSPOL.sampleTxt(q) : "");
        const on = tip && tip.i === i;
        return (
          <b key={key} className={[(it.fav ? "open" : ""), (rk ? "on" : ""), (on ? "hi" : "")].filter(Boolean).join(" ") || undefined}
             style={{ "--x": xs[i], "--pcolor": color, "--v": ups ? ups[i] : 0 }}
             role={rk ? "button" : "img"} tabIndex={rk ? 0 : undefined}
             aria-label={lab + (rk ? ", press Enter to open this poll" : "")}
             onFocus={(ev) => { if (ev.target.matches(":focus-visible")) show(i, "focus"); }}
             onBlur={() => hide(i, "focus")}
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
              {q.sample != null && <div className="tip-sub">{"n ≈ "}{window.AUSPOL.sampleEl(q)}</div>}
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
const RD_TREND_STATE = { NSW: "NSW", Vic: "Victoria", Qld: "Queensland", SA: "South Australia", WA: "Western Australia", "ACT/NT/Tas": "Tasmania, the ACT and the NT", "Non-NSW/Vic/Qld": "the non-eastern-mainland states" };
const RD_TREND_STATE_ORDER = ["NSW", "Vic", "Qld", "SA", "WA", "ACT/NT/Tas", "Non-NSW/Vic/Qld"];
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
  /* "Year 12 or less" in the trend copy: user dictate 2026-11-02 */
  University: "university graduates", "TAFE or trade": "TAFE-qualified voters", "Year 12 or less": "high school-educated voters (or less)",
  "Own outright": "outright homeowners", Mortgage: "mortgage holders", Renting: "renters",
  "Full time": "full-time workers", "Part time": "part-time workers", Retired: "retirees",
  "Lower earners (bottom 50%)": "lower earners", "Higher earners (top 15%)": "higher earners",
};
/* ---- the composition trend: which groups have moved out of proportion ----
   Titled and deked from D.demoTrend (gen-data's two-stage test, §7gb), on
   the user's dictated shapes (2026-09-29): proportionality, so "away from /
   towards" means beyond what the party's own national trend hands a group
   merely for its starting level. Sets rank by their strongest move's
   |t(log-ratio)|; the dek carries the top two. Figures quoted are the
   signed moves relative to the all-voters shift, a move on seven or fewer
   monthly points hedges "appears to", and (user dictate 2026-09-29: "it
   must be significantly significant to make it") a thin move never CARRIES
   a claim — it trails a solid one, only once every solid move's set is in
   the dek, and a party whose moves are all thin renders the unchanged pair.
   Verbs read against the party's own national line: a group moving
   "towards" a falling party is holding up better, not gaining. */
function rdDemoShift(dt, T, party) {
  if (!dt || !dt.windowYm) return null;
  const moves = dt.moves || [];
  const solid = moves.filter((m) => !m.thin), thin = moves.filter((m) => m.thin);
  const nameT = RD_TREND_NAME[party], nameD = RD_TREND_NAME_DEK[party];
  const isAre = party === "oth" ? "are" : "is";
  const poss = (s) => s + (/s$/.test(s) ? "’" : "’s");
  /* the vote noun phrase, mid-sentence, keeps its article lower-case ("The
     composition of the Coalition's vote"); others & independents can't
     carry a possessive (user dictates 2026-09-30, 2026-10-07) */
  const voteOf = party === "oth" ? "the vote for others & independents" : poss(nameD) + " vote";
  const allOf = party === "oth" ? "all voters for others & independents" : "all " + (RD_TREND_BARE[party] || nameD) + " voters";
  const serial = (ls) => rdSerial(ls, "and");
  const since = "Since " + rdMonthYear(dt.windowYm) + ", ";
  const pct = (v) => (Math.round(v * 10) / 10).toFixed(1).replace(/\.0$/, "");
  /* The election test's sentence (gen-data §7gb `elec`, user rulings
     2026-11-02 and 2026-11-03): groups whose gap from all voters has moved
     since the election, measured from the polls' own figures at the
     election (the generations: the Australian Election Study 2025's) with
     both margins combined and the ratio agreeing. Its own closing sentence,
     worded "since the election", never merged into the slope test's
     claims; the two strongest passes (|change| / margin), a group the dek
     already names left out (one group, one figure); men and women passing
     together are one finding, the gender gap. `named` is filled as the
     slope claims are chosen below. */
  const named = new Set();
  const elecSentence = () => {
    /* r.claim: significant AND not contradicted by Resolve's same-house
       estimate where one exists (age, gender) - gen-data §7gb */
    const pass = (dt.elec || []).filter((r) => (r.claim ?? r.sig) && !named.has(r.group))
      .sort((a, b) => Math.abs(b.d) / b.ci - Math.abs(a.d) / a.ci);
    if (!pass.length) return null;
    const sgnE = (v) => (v > 0 ? "+" : v < 0 ? "−" : "") + pct(Math.abs(v));
    const men = pass.find((r) => r.group === "Men"), women = pass.find((r) => r.group === "Women");
    const claims = [];
    if (men && women) {
      /* the test says the gap MOVED; "reversed" also says where it now
         sits, so it needs the men-v-women gap now to clear its own margin
         the other way - a flip inside that margin has only "closed" */
      const was = men.then - women.then, now = men.now - women.now;
      const flip = Math.sign(was) !== Math.sign(now);
      const nowSig = Math.abs(now) > Math.sqrt((men.ciNow || 0) ** 2 + (women.ciNow || 0) ** 2);
      const how = flip ? (nowSig ? "reversed" : "closed") : Math.abs(now) < Math.abs(was) ? "narrowed" : "widened";
      claims.push({ k: Math.max(Math.abs(men.d) / men.ci, Math.abs(women.d) / women.ci), b: men.base,
        s: "its gender gap has " + how + " (men " + sgnE(men.d) + ", women " + sgnE(women.d) + " points relative to all voters)" });
    }
    for (const r of pass) {
      if (men && women && (r === men || r === women)) continue;
      claims.push({ k: Math.abs(r.d) / r.ci, g: r.group, b: r.base,
        s: "it has " + (r.d > 0 ? "gained" : "lost") + " ground among " + (RD_TREND_GROUP[r.group] || r.group) + " (" + sgnE(r.d) + " points relative to all voters)" });
    }
    claims.sort((a, b) => b.k - a.k);
    const chosen = claims.slice(0, 2);
    /* a Gen Z claim compares across instruments: the polls' Gen Z figures
       are the generation cuts of one or two houses alone, and those read
       young voters differently from the age-band houses (user call
       2026-11-02, after Essential's April 2025 18–34s matched the AES's
       18–34s while the generation cuts ran well below both on the
       Coalition) - the margins measure sampling, not that, so the sentence
       says so */
    const genSet = (T.tabs || []).flatMap((t) => t.sets).find((s) => s.id === "generation");
    const genNote = chosen.some((c) => c.g === "Gen Z") && genSet
      ? ". The Gen Z comparison is across instruments: the polls’ Gen Z figures come only from the generation cuts of " + rdList(genSet.houses.map(demoHouse))
      : "";
    /* the sentence names its baseline: the polls' own figures at the
       election, or - for a generation, which no house cut then - the AES */
    const bases = new Set(chosen.map((c) => c.b));
    const lead = bases.has("aes") && bases.has("polls") ? "Measured from the election (the polls then; for generations, the Australian Election Study 2025), "
      : bases.has("aes") ? "Measured from the election (Australian Election Study 2025), "
      : "Measured from the polls at the election, ";
    return lead + serial(chosen.map((c) => c.s)) + genNote;
  };
  if (!solid.length) {
    const skew = RD_TREND_SKEW[party];
    const es = elecSentence();
    /* the polls' months show nothing, but the election test does: the head
       can't call the composition unchanged, and the skew line (a claim of
       no change) gives way */
    if (es) return {
      head: "The composition of " + voteOf + " has shifted since the election",
      dek: since + "no group has moved significantly towards or away from " + nameD + " relative to all voters. " + es + ".",
    };
    return {
      head: "The composition of " + voteOf + " is unchanged",
      dek: since + "no group has moved significantly towards or away from " + nameD + " relative to all voters" + (skew ? ". " + skew : "."),
    };
  }
  /* a move's points relative to the all-voters shift over the same window:
     (g1−g0) − (a1−a0) — also a group claim's change in gap vs all voters */
  const sgnPts = (v) => (v > 0 ? "+" : v < 0 ? "−" : "") + pct(Math.abs(v));
  const relPts = (m) => sgnPts((m.g1 - m.g0) - (m.a1 - m.a0));
  const bestOf = (ms) => ms.slice().sort((a, b) => Math.abs(b.tLR) - Math.abs(a.tLR))[0];
  // the party's national line over the move's window: +1 rising, −1 falling, 0 flat
  const natDir = (m) => (m.a1 - m.a0 > 1 ? 1 : m.a1 - m.a0 < -1 ? -1 : 0);
  const headVerb = (toward, m) => {
    const n = natDir(m);
    if (n < 0) return toward ? "holding up better in " : "losing voters faster in ";
    if (n > 0) return toward ? "gaining faster in " : "gaining more slowly in ";
    return toward ? "gaining ground in " : "losing ground in ";
  };
  /* the states nest - SA, WA and ACT/NT/Tas inside the non-eastern-mainland
     bucket - so a side with no move of its own is the other side's
     complement among the six base groups, named only when it has a name:
     the eastern mainland, the bucket, or one or two states. A side with its
     own move quotes its own figure (user dictate 2026-09-30); a
     complement-named side stays bare. */
  const BASE = ["NSW", "Vic", "Qld", "SA", "WA", "ACT/NT/Tas"], BUCKET = "Non-NSW/Vic/Qld";
  const members = (l) => (l === BUCKET ? BASE.filter((b) => DEMO_WITHIN[b] === BUCKET) : [l]);
  const placeName = (ls) => {
    const s = BASE.filter((l) => ls.includes(l));
    if (s.length === 3 && RD_TREND_EASTERN.every((l) => s.includes(l))) return "the eastern-mainland states";
    if (s.length && s.every((l) => DEMO_WITHIN[l] === BUCKET) && s.length === members(BUCKET).length) return RD_TREND_STATE[BUCKET];
    return s.length && s.length <= 2 ? serial(s.map((l) => RD_TREND_STATE[l])) : null;
  };
  const stateDek = (ms, hedged, opens) => {
    const towardMs = ms.filter((m) => m.dir > 0), awayMs = ms.filter((m) => m.dir < 0);
    const tw = towardMs.flatMap((m) => members(m.group)), aw = awayMs.flatMap((m) => members(m.group));
    const clash = tw.some((l) => aw.includes(l));
    const rest = (ls) => BASE.filter((l) => !ls.includes(l));
    const own = (gs) => placeName(gs.flatMap((m) => members(m.group)))
      || serial(RD_TREND_STATE_ORDER.filter((l) => gs.some((m) => m.group === l)).map((l) => RD_TREND_STATE[l] || l));
    const awayName = awayMs.length ? own(awayMs) : clash ? null : placeName(rest(tw));
    const towardName = towardMs.length ? own(towardMs) : clash ? null : placeName(rest(aw));
    let first = true;
    const fig = (gs) => {
      if (!gs.length) return "";
      const f = " (" + relPts(bestOf(gs)) + " points" + (first ? " relative to " + allOf : "") + ")";
      first = false;
      return f;
    };
    const halves = [];
    if (awayName) halves.push("away from " + awayName + fig(awayMs));
    if (towardName) halves.push("towards " + towardName + fig(towardMs));
    return {
      head: nameT + " " + isAre + " " + headVerb(!awayName, bestOf(ms)) + (awayName || towardName),
      /* only the dek's opening sentence names its subject; a later one is "it" */
      dek: (opens ? "the composition of " + voteOf + " " + (hedged ? "appears to have" : "has")
        : "it " + (hedged ? "also appears to have" : "has also")) + " shifted " + halves.join(", and "),
    };
  };
  const locDek = (m) => {
    const loc = RD_TREND_LOC[m.group] || { adj: m.group.toLowerCase(), ref: m.group };
    if (m.thin) return [poss(nameD) + " voter base appears to have become " + (m.dir > 0 ? "more " : "less ") + loc.adj];
    /* the quoted figure is the RELATIVE move, not the fitted from–to
       levels, and the direction word moves into the national clause (user
       dictate 2026-09-30: "... has increased by +3.7 points relative to the
       overall decrease, rising even as the national vote has remained
       flat"); the group's own word follows its own level, and the national
       clause the national line's */
    const n = natDir(m), gch = m.g1 - m.g0;
    const own = Math.abs(gch) < 0.5 ? "holding steady" : gch > 0 ? "rising" : "falling";
    const natSpan = (n < 0 ? "fallen" : "risen") + " from " + pct(m.a0) + "% to " + pct(m.a1) + "%";
    const clause = n === 0 ? own + " even as the national vote has remained flat"
      : own === "holding steady" || Math.sign(gch) !== n ? own + " while the national vote has " + natSpan
      : own + (m.dir * n > 0 ? " faster" : " more slowly") + " than the national vote, which has " + natSpan;
    const support = party === "oth" ? "Support for others & independents" : (RD_TREND_BARE[party] || nameT) + " support";
    const rel = (m.g1 - m.g0) - (m.a1 - m.a0);
    return [
      poss(nameD) + " voter base has become " + (m.dir > 0 ? "more " : "less ") + loc.adj,
      support + " in " + loc.ref + " has " + (rel >= 0 ? "increased" : "decreased") + " by " + sgnPts(rel) + " points relative to "
        + (n < 0 ? "the overall decrease" : n > 0 ? "the overall increase" : "all voters") + ", " + clause,
    ];
  };
  /* non-state, non-location moves merge into ONE "It has also shifted …"
     sentence, each group quoting its own figure (user dictate 2026-09-30);
     a sole GENDER move names a relative position instead ("Its relative
     position among men has shrunk" — no "also", since a gender move often
     sits after an opposite-direction location move, per the same dictate).
     The sentence hedges only when every move it carries is thin. Opening
     the dek, it names its subject rather than "it". */
  const groupSentence = (gms, opens) => {
    const fig = (m) => (RD_TREND_GROUP[m.group] || m.group) + " (" + relPts(m) + " points)";
    const hedged = gms.every((m) => m.thin);
    if (gms.length === 1 && gms[0].set === "gender") {
      const m = gms[0], gap0 = m.g0 - m.a0, gap1 = m.g1 - m.a1;
      const motion = Math.abs(gap1) > Math.abs(gap0) ? "grown" : "shrunk";
      return (opens ? poss(nameD) + " relative position" : "Its relative position") + " among " + (RD_TREND_GROUP[m.group] || m.group)
        + (hedged ? " appears to have " : " has ") + motion + " (" + relPts(m) + " points)";
    }
    const away = gms.filter((m) => m.dir < 0).map(fig);
    const toward = gms.filter((m) => m.dir > 0).map(fig);
    const halves = [];
    if (away.length) halves.push("away from " + serial(away));
    if (toward.length) halves.push("towards " + serial(toward));
    return (opens ? "the composition of " + voteOf + (hedged ? " appears to have shifted " : " has shifted ")
      : "It " + (hedged ? "also appears to have shifted " : "has also shifted ")) + halves.join(", and ");
  };
  const bySet = new Map();
  for (const m of solid) {
    const k = m.tab + "|" + m.set;
    if (!bySet.has(k)) bySet.set(k, []);
    bySet.get(k).push(m);
  }
  const allSets = [...bySet.values()]
    .map((ms) => ({ ms, top: Math.max(...ms.map((m) => Math.abs(m.tLR))) }))
    .sort((a, b) => b.top - a.top);
  const setsRanked = allSets.slice(0, 2);
  let head = null;
  const parts = [];
  const groupMoves = [];
  for (const { ms } of setsRanked) {
    const m0 = ms[0];
    if (m0.set === "state") {
      const b = stateDek(ms, false, !parts.length);
      if (!head) head = b.head;
      parts.push(b.dek);
    } else if (m0.set === "location") {
      const m = bestOf(ms), loc = RD_TREND_LOC[m.group] || { ref: m.group };
      if (!head) head = nameT + " " + isAre + " " + headVerb(m.dir > 0, m) + loc.ref;
      parts.push(...locDek(m));
    } else {
      if (!head) head = "The composition of " + voteOf + " is shifting";
      groupMoves.push(bestOf(ms));
    }
  }
  /* thin moves trail the solid claim (the thin locDek and the hedged
     stateDek render "appears to"; a group sentence of only thin moves
     hedges too); a set already carried by a solid move stays out, and none
     trails while a solid set was left out for room - a hedged move never
     takes the place of a firmer one. Thin sentences collect apart and join
     LAST — a hedged sentence never opens the dek */
  const carried = new Set(setsRanked.map(({ ms }) => ms[0].tab + "|" + ms[0].set));
  const thinSets = new Map();
  if (allSets.length <= setsRanked.length) for (const m of thin) {
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
      if (m0.set === "state") thinParts.push(stateDek(ms, true, false).dek);
      else if (m0.set === "location") thinParts.push(...locDek(bestOf(ms)));
      else thinGroupMoves.push(bestOf(ms));
    });
  if (groupMoves.length) parts.push(groupSentence(groupMoves, !parts.length));
  /* thin group moves close the dek in their own sentence (all-thin, so
     groupSentence hedges it) — never mixed unhedged into the solid one */
  if (thinGroupMoves.length) thinParts.push(groupSentence(thinGroupMoves, false));
  // the groups the slope claims name (a set's state/location claims cover groups the AES never cuts)
  groupMoves.concat(thinGroupMoves).forEach((m) => named.add(m.group));
  const es = elecSentence();
  const ordered = parts.concat(thinParts, es ? [es] : []);
  /* sentences after the first start a sentence of their own, so a
     lower-case name ("others & independents") still opens capitalised */
  return { head, dek: since + ordered.map((s, i) => (i === 0 ? s : rdCap(s))).join(". ") + "." };
}
/* the state panels' titles, as the board wrote them */
const RD_STATE_NAME = { Vic: "Victoria", Qld: "Queensland" };
/* a solo single-territory reading's territory, in words (gen-data §5c) */
const RD_SOLO_NAME = { Tas: "Tasmania", ACT: "the ACT", NT: "the NT" };
/* groups in order as one party colour's ramp, pale to dark (dark mode runs
   the other way, so the last group keeps the most contrast in both) */
const rdRamp = (party, n, i) => (n < 2 ? "var(--" + party + ")" : "var(--ramp-" + party + "-" + (1 + Math.round((i * 3) / (n - 1))) + ")");

function RdDemographics({ rangeId = "all" }) {
  const { D, rangeDomain, filterPts, monthLabelFull } = window.AP;
  const narrow = useNarrow(MQ_PHONE);
  const Tdemo = D.demographics;
  /* the income tab rides beside demographics, never inside it (repo rule 5):
     spliced on here, one home, id last so it lands after Home. The party
     headline reads it on equal terms with every other tab (user call
     2026-10-16: income belongs in the dynamic prose once the feature
     shipped); an income claim still has to clear the same filled-dot gate
     and outrank four heavier claims to be named */
  const T = Tdemo && D.demoIncome ? { ...Tdemo, tabs: [...Tdemo.tabs, D.demoIncome] } : Tdemo;
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
  /* Space walks the party chips while the panel is on screen - the
     viewport claim, not the pointer (the primary panel's group menu, the
     latest card's flip and the house-lean flip are the same claim on
     their own sections): the chips' left-to-right order the digits 1..5
     number, One Nation round again after Others. In the boundary band
     where this panel and the voter-switching one are both part-visible,
     the section with the bigger share of the viewport owns the key
     (rdSpaceDominant - the claims' shared owner rule). With no
     demographics payload (/vic/) the panel never mounts and Space keeps
     its scroll day job. */
  const spaceParty = React.useRef(null);
  spaceParty.current = T && T.tabs && T.tabs.length ? () => {
    const i = DEMO_PARTIES.findIndex((x) => x.id === party);
    pickParty(DEMO_PARTIES[(i + 1) % DEMO_PARTIES.length].id);
  } : null;
  React.useEffect(() => {
    const sec = document.getElementById("who-votes");
    if (!sec) return undefined;
    window.rdSpaceClaimOn("who-votes");
    const inView = { current: false };
    const io = new IntersectionObserver(
      (es) => es.forEach((en) => { inView.current = en.isIntersecting; }));
    io.observe(sec);
    const key = (e) => {
      if (!inView.current || e.key !== " ") return;
      if (!window.rdSpaceDominant("who-votes")) return;
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      const a = document.activeElement;
      /* the panel's own SELECTED controls own Space too: picking a party
         chip or a group-menu tab leaves DOM focus on it (rdTabFocus),
         where native Space would dead-fire a re-pick of the pick already
         made. Space there walks the party chips exactly as with the page
         focused; on a chip it also hands DOM focus along with the pick,
         so consecutive Spaces keep walking (rdTabsKey's arrow walks do the
         same). The menu tab keeps focus and its own pick - Space never
         touches the grouping. An UNPRESSED chip or tab keeps the key's
         day job, as in the all-polls facet menu. */
      const pressed = a && a.tagName === "BUTTON" && a.getAttribute("aria-pressed") === "true";
      const onChip = pressed && a.matches('#who-votes .rd-chips .rd-chip');
      const onMenu = !onChip && pressed && a.matches('#who-votes .rd-wv-tabs .rd-tab');
      if (!onChip && !onMenu && a && a.tagName !== "BODY" && a.tagName !== "HTML") return;
      const sel = window.getSelection && window.getSelection();
      if (sel && !sel.isCollapsed) return;
      if (!spaceParty.current) return;
      e.preventDefault();
      if (!e.repeat) {
        spaceParty.current();
        if (onChip) {
          const btns = [...a.parentElement.querySelectorAll("button.rd-chip")];
          const next = btns[(btns.indexOf(a) + 1) % btns.length];
          if (next) next.focus({ preventScroll: true });
        }
      }
    };
    document.addEventListener("keydown", key, true);
    return () => { window.rdSpaceClaimOff("who-votes"); io.disconnect(); document.removeEventListener("keydown", key, true); };
  }, []);
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

  /* ---- the finding: the party's headline (rdDemoHead, constant across the
     grouping tabs, income tab included) over the tab's dek (rdDemoDek) ------ */
  const story = { head: rdDemoHead(T, party).head, dek: rdDemoDek(T, tab, party) };

  /* ---- the composition trend: which groups have moved out of proportion
     (rdDemoShift, from gen-data §7gb's demoTrend, income bands included) --- */
  const shift = rdDemoShift(D.demoTrend && D.demoTrend[party], Tdemo, party);

  /* the full significance battery behind the dek: every tested group, pass
     or fail, in the tabs' own order — the Trend-significance table dropdown
     under the trend legend. A signed figure the site's way: true minus, the
     plus only where the sign is the claim (s = always sign) */
  // signed from the ROUNDED figure, so −0.04 prints 0.0, never "−0.0"
  const sgn1 = (v, s) => { const r = Math.round(v * 10) / 10; return (r < 0 ? "−" : s && r > 0 ? "+" : "") + Math.abs(r).toFixed(1); };
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
  /* the election test's rows (gen-data §7gb `elec`), by set in the tabs'
     order - the second table under the same dropdown */
  const elecSets = (() => {
    const dt = D.demoTrend && D.demoTrend[party];
    const seen = new Map();
    for (const r of (dt && dt.elec) || []) {
      const k = r.tab + "|" + r.set;
      if (!seen.has(k)) seen.set(k, { key: k, label: r.setLabel, rows: [] });
      seen.get(k).rows.push(r);
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
        <span role="columnheader">
          <b>{st.label || "By " + tab.label.toLowerCase()}</b> <span>{rdList((st.houses || []).map(demoHouse))}</span>
        </span>
        <span className="rd-wv-allcap" aria-hidden="true">{idx === 0 && <span style={{ "--x": xp(all) }}>All voters <RollNum value={all.toFixed(1)} />%</span>}</span>
        <span className="rd-wv-vs" role="columnheader">{idx === 0 ? "vs all voters" : ""}</span>
      </div>
      {st.groups.map((g, gi) => {
        const v = g.v[party], ci = g.ci[party] || 0, d = v - all, sig = Math.abs(d) > ci;
        /* the pooled-figures note sits on the text cells, not the row: the
           rug dots now bring their own chart-style tip, and a row-wide
           title would pop the OS tooltip over it */
        const rowTitle = (T.model ? g.n + " poll" + (g.n === 1 ? "" : "s") + " in the last " + T.window + ", " + rdList((g.houses || []).map(demoHouse)) + ", ± is the 95% interval of the model’s figure" : "Pooled from " + g.n + " poll" + (g.n === 1 ? "" : "s") + ", " + rdList((g.houses || []).map(demoHouse)) + ", ± is the 95% margin") + ", small dots: each poll’s own reading";
        return (
          <div key={"r" + gi} className="rd-wv-row" role="row">
            <span role="cell" className="rd-wv-lab" title={rowTitle}>{g.bare || g.label}<RdGenBorn label={g.label} />{g.cuts && g.cuts.length ? <RdIncomeCut pct={g.pct} cuts={g.cuts} /> : null}</span>
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
      // each place the wave's figures count (demoGrpAt: a pooled release at each poll it pooled)
      const dots = D.individualPolls.filter((q) => q.grp && q.grp.t).flatMap((q) => demoGrpAt(q).filter((s) => s.x >= x0 && s.x <= x1).flatMap((s) => drawn.map((l) => {
        const v = q.grp.v[D.demoGroups.indexOf(l.g.label)];
        const sum = v ? v.reduce((a, b) => a + (b || 0), 0) : 0;
        const base = allAt.get(s.ym);
        // v[gpi] null: the wave printed no such party - an Others fold isn't a zero
        return v && v[gpi] != null && sum > 0 && q.grp.t[gpi] > 0 && base != null
          ? { x: s.x, y: +(base + (100 * v[gpi] / sum - q.grp.t[gpi])).toFixed(1), color: l.color, label: l.g.label, meta: demoPartMeta(q, s),
              ...(s.part != null ? { part: s.part } : {}),
              ...((sub) => (sub ? { sub } : {}))(demoReadSub(q, l.g.label, s.part != null ? demoPartSub(q, s) : undefined)) } : null;
      }).filter(Boolean)));
      /* the trio panel's open rings: single-territory readings (Roy Morgan's
         Tas cut, DemosAU (MRP)'s three rows, EMRS's whole-territory polls),
         for comparison only - never pooled into the lines or the dot cloud */
      const solo = st.id === "state"
        ? D.individualPolls.filter((q) => q.solo && q.x >= x0 && q.x <= x1).flatMap((q) => q.solo.flatMap((e) => {
            const sv = e[pty];
            if (sv == null) return [];
            const sum = DEMO_GRP_PARTY.reduce((t2, k) => t2 + (e[k] || 0), 0);
            if (!sum) return [];
            const v = (100 * sv) / sum;
            /* a whole-territory poll (EMRS) asks no all-voters counterpart,
               so its ring sits at the raw share; a cut inside a national
               wave lifts off that wave's own print, exactly as a dot does */
            const tip = { x: q.x, gv: sv, label: RD_SOLO_NAME[e.terr] + " only", meta: q, hollow: true,
                          sub: ["not pooled" + (q.sample ? ", n = " : ""), q.sample ? window.AUSPOL.sampleEl(q) : null] };
            if (e.whole) return [{ ...tip, y: +v.toFixed(1) }];
            const base = allAt.get(q.ym);
            const t = q.grp && q.grp.t ? q.grp.t[gpi] : null;
            if (base == null || t == null) return [];
            return [{ ...tip, y: +(base + (v - t)).toFixed(1) }];
          }))
        : [];
      return { st, drawn, allPts, dots, solo, x0, x1, span: x1 - x0 };
    }).filter(Boolean);
  };
  const yMaxOf = (cs) => Math.max(10, Math.ceil(Math.max(...cs.flatMap((c) => c.drawn.flatMap((l) => l.pts.map((p) => p.y + (p.ci || 0))).concat(c.dots.map((d) => d.y)).concat((c.solo || []).map((d) => d.y)))) / 10) * 10);
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
    const cross = A ? window.AP.crossClouds(A.dots, c.dots, t, (d) => d.meta.pollster + "|" + d.meta.released + "|" + d.label + (d.part != null ? "|" + d.part : "")) : null;
    const xDom = A ? window.AP.blendDomain([A.x0, A.x1], [c.x0, c.x1], t) : [c.x0, c.x1];
    const yDom = A ? window.AP.blendDomain([0, fromYMax], [0, yMax], t) : [0, yMax];
    const head = (
      <div className="rd-chead"><span className="rd-chead-t">{c.st.label || "By " + tab.label.toLowerCase()}<span className="rd-chead-meta">since {rdMonthYear(c.drawn.reduce((m, l) => (l.pts[0].ym < m ? l.pts[0].ym : m), "9999"))}</span></span></div>
    );
    if (panelled(c)) {
      const mine = (arr, label) => (arr || []).filter((d) => d.label === label).map((d) => ({ ...d, color: pColorNow }));
      /* open rings on the trio's own panel only - the label filter in
         mine() must never sweep them up as a group's dot */
      const mineTrioSolo = (c.solo || []).map((d) => ({ ...d, color: pColorNow }));
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
                    scatter={mine(cross ? cross.scatter : c.dots, g.label).concat(g.label === "ACT/NT/Tas" ? mineTrioSolo : [])} scatterOut={mine(cross ? cross.scatterOut : [], g.label)}
                    scatterMove={mine(cross ? cross.scatterMove : [], g.label)}
                    fade={A ? t : 1} pollFacet="demographics" pollSplit={tab.id}
                    tooltipTitle={(i) => (seY != null && i === 0 ? monthLabelFull("2025-05") : c.allPts[seY != null ? i - 1 : i] ? monthLabelFull(c.allPts[seY != null ? i - 1 : i].ym) : "")}
                    extraRows={seY != null ? ((i) => (i === 0 ? [{ label: "", value: "The election result" }] : ciUnshifted(i - 1))) : ciUnshifted}
                    /* as the primary chart's: an open ring is drawn at the
                       all-voters-lifted y but tips its printed share */
                    fmt={(v, pt) => (pt && pt.gv != null ? pt.gv : v).toFixed(1)}
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
    /* The election-time marks, drawn as the location rings are - each
       group's figure at the May 2025 election, never pooled into the lines,
       the window widening to hold them and nothing drawn mid-party-switch:
       - the polls at the election (gen-data DEMO_ELECTION, 2026-11-03): an
         open triangle per group in its line's colour, the group's figure
         over the six weeks before polling day, pooled from the houses' own
         tables as the lines are and placed on the result's scale - the
         figure "since the election" is measured from, so it takes the
         rings' dotted lead-in to the line's first month;
       - the Australian Election Study 2025 (DEMO_AES, from its respondent
         file; user ruling 2026-11-02): a hollow diamond per group, placed
         as a poll dot is (the result plus the group's gap from the AES's
         own all-respondents figure), the tip quoting the AES's share and
         the respondents behind it. Beside a triangle it stands alone,
         nudged right of the column (RD_AES_NUDGE: the survey came after
         polling day), and it takes the lead-in itself, in the column, only
         where no house cut the group before the election (the
         generations).
       The all-voters line is led back to the result. */
    /* (2026-11-10) the two readings are now ONE mark: gen-data DEMO_VOTE's
       estimate of each group's vote, a hollow diamond whose tip quotes
       both. Every mark takes the dotted lead-in to its line's first month,
       and all voters' ring at the election is the counted result (owner
       call 2026-11-11). */
    const ev = D.demoVote && D.demoVote.sets && D.demoVote.sets[c.st.id];
    const evG = (g) => (ev && ev.groups[g.label]) || null;
    const evOf = (g) => (evG(g) && evG(g)[party]) || null;
    const elX = D.demoVote ? D.demoVote.x : null;
    const elOn = !!ev && !pm && !leOn && c.allPts.length && elX < c.allPts[0].x && rowsOf.some((r) => evOf(r.l.g))
      && (xDom[0] <= elX + 1e-6 || rangeId === "all");
    const elPts = elOn ? rowsOf.filter((r) => evOf(r.l.g)).map((r) => ({ x: elX, y: evOf(r.l.g)[0], color: colorOf(r), shape: "diamond", hollow: true, size: 1.6,
      label: r.l.g.label, meta: { pollster: RD_VOTE_LABEL }, sub: rdVoteSub(evG(r.l.g), evOf(r.l.g)) })) : [];
    const elN = elOn ? D.demoVote.elec[party] : null;
    const elSrc = elOn ? [...new Set(rowsOf.filter((r) => evOf(r.l.g)).map((r) => evG(r.l.g).src))] : [];
    const elLeads = elOn ? rowsOf.filter((r) => r.rows.length && evOf(r.l.g))
      .map((r) => {
        const p0 = { x: elX, y: evOf(r.l.g)[0] };
        return { id: "ev-" + r.l.g.label, label: r.l.g.label, color: colorOf(r), dash: RD_ELECTION_LEAD, rdWidth: 2.2,
                 endCap: false, clipX: r.clip, points: [p0, { x: r.rows[0].x, y: r.rows[0].y }] };
      })
      .concat(allSeries.points.length
        ? [{ id: "ae-all-" + c.st.id, label: "All voters", color: "var(--ink)", dash: RD_ELECTION_LEAD, dashed: true, rdWidth: 1.5,
             endCap: false, points: [{ x: elX, y: elN }, allSeries.points[0]] }]
        : []) : [];
    const xDomA = elOn && elX < xDomL[0] ? [elX - 0.05, xDomL[1]] : xDomL;
    const yDomA = elPts.length ? [yDom[0], Math.max(yDom[1], Math.ceil(Math.max(...elPts.map((p) => p.y)) / 10) * 10)] : yDom;
    /* the lead row the guide tip reads at the election x: rings, triangles
       or diamonds */
    const lead0 = leOn || elOn;
    const ciLead = (i) => (i === 0
      ? [{ label: "", value: leOn ? "The election result"
        : elSrc.includes("both") ? "Groups: estimated from the polls before the election and the Australian Election Study 2025; all voters: the result"
        : elSrc[0] === "polls" ? "Groups: the polls " + RD_PEL_WHEN + "; all voters: the result"
        : "Groups: Australian Election Study 2025; all voters: the result" }]
      : ciLoc(i - 1));
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
        xDomain={xDomA} yDomain={yDomA} yTicks={rdYTicks(0, yDomA[1], 10)} yTickFmt={(v) => (v === 0 ? "0" : v + "%")}
        xTicks={leOn ? rdElectionTicks(xDomL[0], c.x1, narrow || c.span < 0.8, le.x)
          : elOn ? rdElectionTicks(xDomA[0], c.x1, narrow || c.span < 0.8, elX)
          : rdXTicks(c.x0, c.x1, narrow || c.span < 0.8)} baseline driven={!!A}
        series={[allSeries, ...rowsOf.map((r) => lineOf(r, colorOf(r)))].concat(leLeads, elLeads)}
        areas={rowsOf.map((r) => bandOf(r, colorOf(r))).filter((a) => a.points.length >= 2)}
        spine={(leN != null ? [{ x: le.x, y: leN }] : elN != null ? [{ x: elX, y: elN }] : []).concat(c.allPts.map((d) => ({ x: d.x, y: d.y })))}
        /* all voters' ring at the election is the counted result, on every
           chart that reaches it (owner call 2026-11-11) */
        marks={(leOn ? rowsOf.filter((r) => leY(r.l.g) != null).map((r) => ({ x: le.x, y: leY(r.l.g), color: colorOf(r) })) : [])
          .concat(leOn && leN != null ? [{ x: le.x, y: leN, color: "var(--ink)" }] : elOn && elN != null ? [{ x: elX, y: elN, color: "var(--ink)" }] : [])}
        ringAtX={leOn ? le.x : null}
        scatter={elPts.length ? (cross ? cross.scatter : c.dots).concat(elPts) : (cross ? cross.scatter : c.dots)} scatterOut={cross ? cross.scatterOut : []} scatterMove={cross ? cross.scatterMove : []}
        fade={A ? t : 1} pollFacet="demographics" pollSplit={tab.id}
        tooltipTitle={(i) => (lead0 && i === 0 ? monthLabelFull("2025-05") : c.allPts[lead0 ? i - 1 : i] ? monthLabelFull(c.allPts[lead0 ? i - 1 : i].ym) : "")}
        extraRows={lead0 ? ciLead : ciLoc}
        fmt={(v, pt) => (pt && pt.gv != null ? pt.gv : v).toFixed(1)}
        /* keyed in full: a phone names no line at its end, and "All voters"
           loses its name wherever the groups crowd it */
        copy={{ title: rdCap(pVote) + " " + (c.st.label || "By " + tab.label).toLowerCase(), sub: "Share of each group who would vote for " + pName + ", month by month, against all voters",
                legend: c.drawn.map((l) => ({ label: l.g.label, color: l.color, kind: "line" }))
                  .concat([{ label: "95% interval", color: pColor, kind: "band" }, { label: "All voters", color: "var(--ink)", kind: "dashed" }])
                  .concat(elPts.length ? [{ label: RD_VOTE_LABEL, color: pColor, kind: "diamond" }] : []) }}
      />
    </div>
    );
  };

  return (
    <RdSec id="who-votes" cls="rd-wv" title="Who votes for whom" meta={T.model ? "Modelled from every poll this term; " + rdList(T.houses.map(demoHouse)) + " in the last " + T.window : "Pooled from the last " + T.window + " of " + rdList(T.houses.map(demoHouse)) + " polls"}>
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
          { kind: "dot", color: pColor, label: T.model ? "One poll in the last " + T.window : "One poll pooled" },
        ]}><span className="rd-key-item rd-wv-keytxt">Right-hand column: difference from all voters, in points</span></RdKey>
        {/* the house's own end brackets each tilt was read from, spelled
           out by house since no two houses' brackets agree (the dek says
           why up front; it also names the basis, so a house's own basis
           shows only when the pill mixes two) - just below the dot-plot's legend: inside the
           sethead it grew the caption row and pushed the all-voters cap
           onto the vertical line */}
        {tab.sets.some((st) => st.bands) ? (
          <div className="rd-wv-bands">
            {tab.sets.flatMap((st) => (st.bands ? st.houses.filter((h) => st.bands[h]).map((h) => ({ h, b: st.bands[h] })) : [])).map((x, _, all) => (
              <span className="rd-wv-band" key={x.h}><span className="rd-wv-band-h"><em>{demoHouse(x.h)}</em>{x.b.basis && new Set(all.map((y) => y.b.basis)).size > 1 ? " (" + x.b.basis + " income)" : null}{": "}</span><span className="rd-wv-band-r">{x.b.low.join(", ")} <i>·</i> {x.b.high.join(", ")}</span></span>
            ))}
          </div>
        ) : null}
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
        { kind: "lineband", color: "var(--ink-3)", label: T.model ? (narrow ? "Model, 95% interval" : "Model estimate and its 95% interval") : narrow ? "Monthly average, 95% interval" : "Monthly average and its 95% interval" },
        { kind: "dash", color: "var(--ink)", label: "All voters" },
        { kind: "ring", label: rdElecYear + " election result" },
      ].concat(D.demoVote && tab.sets.some((st) => D.demoVote.sets[st.id] && Object.values(D.demoVote.sets[st.id].groups).some((g) => g[party] != null))
        ? [{ kind: "diamond", color: "var(--ink-3)", label: RD_VOTE_LABEL }] : [])} />
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
          <p className="rd-note rd-tsig-note">Support figures are fitted monthly trends over each set’s window, not single polls. A group’s change vs all voters is its fitted change less {party === "oth" ? "minor parties’ and independents’" : pName + "’s"} national fitted change, in points; a move counts as significant only when both trend tests — on the group’s gap to all voters and on its ratio — clear a t statistic of 1.96, in the same direction. † Seven or fewer monthly readings: the trend summary above hedges these (“appears to”).</p>
          {elecSets.length > 0 && (
            <>
              <div className="rd-tsig-wrap">
                <table className="rd-tsig-table">
                  <caption className="rd-tsig-cap">{elecSets.some((s) => s.rows.some((r) => r.base === "aes"))
                    ? "Since the election, against the polls then (for generations, the Australian Election Study 2025)"
                    : "Since the election, against the polls then"}</caption>
                  <thead>
                    <tr>
                      <th scope="col"><span className="sr-only">Group</span></th>
                      <th scope="col">Gap to all voters, election → now, pts</th>
                      <th scope="col">Change, pts</th>
                      <th scope="col">95% margin, pts</th>
                      <th scope="col">Rate vs all voters, election → now</th>
                      <th scope="col">Election figure from</th>
                      <th scope="col">Resolve’s own change, pts</th>
                      <th scope="col">Significant</th>
                    </tr>
                  </thead>
                  {elecSets.map((s) => (
                    <tbody key={s.key}>
                      <tr className="rd-tsig-set"><th colSpan={8}>{s.label}</th></tr>
                      {s.rows.map((r) => (
                        <tr key={r.group}>
                          <th scope="row">{r.group}</th>
                          <td>{sgn1(r.then, true)} → {sgn1(r.now, true)}</td>
                          <td>{sgn1(r.d, true)}</td>
                          <td>±{r.ci.toFixed(1)}</td>
                          <td>{r.rThen == null ? "–" : r.rThen.toFixed(2) + " → " + r.rNow.toFixed(2)}</td>
                          <td>{r.base === "aes" ? "AES, " + r.n.toLocaleString() + " respondents" : r.n + " poll" + (r.n === 1 ? "" : "s")}</td>
                          <td>{r.check ? sgn1(r.check.beta, true) + " ±" + r.check.ci.toFixed(1) + (r.check.conflict ? ", disagrees" : "") : "–"}</td>
                          {/* significant but contradicted by the same-house
                              check: withheld from the copy, not highlighted */}
                          <td className={r.sig && !(r.check && r.check.conflict) ? "rd-tsig-yes" : ""}>{!r.sig ? "No" : r.check && r.check.conflict ? "Withheld" : "Yes"}</td>
                        </tr>
                      ))}
                    </tbody>
                  ))}
                </table>
              </div>
              <p className="rd-note rd-tsig-note">{RD_PEL_MODEL ? "The election gap is the group’s on polling day in the model, read from the houses’ own published tables before and after it, as the current figure is, so both ends are the same instruments." : "The election gap is the group’s in the polls over the six weeks before polling day: the houses’ own published tables then, pooled as the current figure is, so both ends are the same instruments."} The generations are the exception, because no pollster cut them before the election: their election gap is the Australian Election Study 2025’s (its share less all respondents’, from the survey’s respondent file). The gap now is the group’s current pooled figure less {party === "oth" ? "minor parties’ and independents’" : pName + "’s"} current primary. The margin combines both figures’ sampling error. A change counts only when it clears that margin and the group’s rate relative to all voters has moved the same way beyond its own margin, so a party growing everywhere doesn’t read as a shift. This compares two endpoints and is never a point in the trend fit above. The AES records the vote people cast, not an intention, and at the election it read several groups differently from the polls by more than both margins. That is why the polls’ own figure is the baseline wherever one exists; the AES’s diamonds stay on the charts. For age and gender, Resolve’s own polls give a second reading of the same change: its recent polls against its election-day poll, so its house lean cancels. Where that reading disagrees beyond both margins, the change is withheld from the summary above.{(() => {
                const gs = elecSets.find((s) => s.key.endsWith("|generation"));
                const st = gs && Tdemo.tabs.flatMap((t) => t.sets).find((s) => s.id === "generation");
                return st ? " The generations’ comparison is across instruments: the polls’ Gen Z, Millennial, Gen X and Boomer figures come only from the generation cuts of " + rdList(st.houses.map(demoHouse)) + ", set against the AES, and the margins can’t account for that." : "";
              })()}</p>
            </>
          )}
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
    /* the observer passes the box it measured (no read in its callback); a
       skipped section's drawing is sized by it on approach (cvSkipped) */
    const fit = (entries) => {
      const box = entries && entries[0] && entries[0].borderBoxSize && entries[0].borderBoxSize[0];
      setW((box ? box.inlineSize : el.getBoundingClientRect().width) || fallback || 800);
    };
    if (!cvSkipped(el)) fit();
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
  /* the panel's four views: where One Nation's new voters are coming from
     (the default, and the one the probes gate on), and the reverse read of
     the same waves - where each 2025 cohort's voters are going (Coalition,
     Labor, Greens) */
  const [view, setView] = useState("onp");
  const GO_NEXT = { onp: "lnp", lnp: "alp", alp: "grn", grn: "onp" };
  /* Space walks the same onp -> lnp -> alp -> grn cycle the title button
     taps through, claimed while the section is on screen (the viewport-claim
     convention); /vic/ carries no vote-switching payload, so the ref is
     null there and Space keeps its scroll day job. In the boundary band
     where the who-votes panel above is part-visible too, the section
     with the bigger share of the viewport owns the key (rdSpaceDominant
     - the claims' shared owner rule); before the rule the who-votes
     claim, registered first, vetoed every press here. */
  const spaceCyc = React.useRef(null);
  spaceCyc.current = S && S.series.length && S.series.every((sr) => sr.rate)
    ? () => setView((v) => GO_NEXT[v !== "onp" && !(S.going || []).some((g) => g.id === v) ? "onp" : v])
    : null;
  React.useEffect(() => {
    const sec = document.getElementById("switching");
    if (!sec) return undefined;
    window.rdSpaceClaimOn("switching");
    const inView = { current: false };
    const io = new IntersectionObserver((es) => {
      es.forEach((en) => { inView.current = en.isIntersecting; });
    });
    io.observe(sec);
    const key = (e) => {
      if (!inView.current || e.key !== " ") return;
      if (!window.rdSpaceDominant("switching")) return;
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      const a = document.activeElement;
      if (a && a.tagName !== "BODY" && a.tagName !== "HTML") return;
      const sel = window.getSelection && window.getSelection();
      if (sel && !sel.isCollapsed) return;
      if (!spaceCyc.current) return;
      e.preventDefault();
      if (!e.repeat) spaceCyc.current();
    };
    document.addEventListener("keydown", key, true);
    return () => { window.rdSpaceClaimOff("switching"); io.disconnect(); document.removeEventListener("keydown", key, true); };
  }, []);
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
  /* where One Nation's new voters came from: the top source, and the second
     while it is a sizeable part too (a fifth or more, rounded) */
  const PARTY = { lnp: "the Coalition", alp: "Labor", grn: "the Greens", oth: "another party" };
  const bySrc = cols.slice().sort((a, b) => b.gain - a.gain);
  const src2 = bySrc[1] && bySrc[1].gain >= 15 ? bySrc[1] : null;
  const gainOf = top ? "Of One Nation’s new voters, " + rdFraction(top.gain) + " voted for " + PARTY[top.id] + " in 2025"
    + (src2 ? " and " + rdFraction(src2.gain) + " for " + PARTY[src2.id] : "") + "." : "";
  /* the ratio is said only while the two rates clear each other's margins,
     and as a ratio only from 1.25 up, to the nearest half (timesWords): a
     ratio of two pooled rates is rarely known finer than that */
  const ratio = hiC && loC ? hiC.rate / loC.rate : null;
  const ratesApart = hiC && loC && hiC.rate - loC.rate > Math.hypot(hiC.rateCi || 0, loC.rateCi || 0);
  const dek = (!hiC || !loC) ? null
    : (!ratesApart ? "Coalition and Labor voters have moved to One Nation at much the same rate. "
      : ratio < 1.25 ? nm(hiC) + " voters have moved to One Nation faster than " + nm(loC) + " voters. "
      : nm(hiC) + " voters have flocked to One Nation at " + timesWords(ratio) + " the rate of " + nm(loC) + " voters. ")
    + gainOf;

  /* ---- the rates, month by month -------------------------------------------- */
  const [rangeLo, rangeHi] = rangeDomain(rangeId);
  const firstX = Math.min(...cols.map((c) => c.sr.rate.monthly[0].x));
  /* the window opens about a month before the first average, as the canvas
     drew it, so the first reading clears the "25%" and "50%" set on the plot */
  const x0 = Math.max(rangeLo, firstX - 0.075), x1 = rangeHi;
  const pollRate = (id) => (S.waves || []).map((w) => {
    const v = w.toOn ? w.toOn[id] : null;
    return v == null ? null : { x: D.mx(w.date.slice(0, 7)) + ((+w.date.slice(8, 10) - 15) / 365), y: v, h: w.pollster, w: w.sample || 1000, meta: { pollster: w.pollster, released: w.date, dateLabel: w.dateLabel || "", sample: w.sample } };
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
  const VOTERS = { lnp: "Coalition voters", alp: "Labor voters", grn: "Greens voters", oth: "minor-party and independent voters" };
  const subHead = rdTrendLine(cols.filter((c) => sig.some((f) => f.c === c)).map((c) => ({
    first: "the share of 2025 " + VOTERS[c.id] + " backing One Nation", later: "the share of " + VOTERS[c.id],
    b: sig.find((f) => f.c === c).fit.b, from: c.sr.rate.monthly[0].v, to: c.rate })),
    sinceM, "No party’s rate has clearly changed",
    sig.length < cols.length ? "Among " + rdList(cols.filter((c) => !sig.some((f) => f.c === c)).map((c) => c.id === "oth" ? "minor-party" : VOTERS[c.id].replace(/ voters$/, ""))) + " voters, there’s no clear change." : "");
  const ks = cols.flatMap((c) => c.sr.rate.monthly.map((m) => m.k)).filter((k) => k != null);
  const kLo = Math.min(...ks), kHi = Math.max(...ks);
  const subDek = "Each chart tracks the share of one party’s 2025 voters now backing One Nation. Each dot is one poll; each line is a monthly average, with its 95% interval shaded. "
    + rdPollsPerMonth(kLo, kHi);
  const monthsIn = D.MONTHS.filter((ym) => D.mx(ym) >= x0 && D.mx(ym) <= x1 + 0.01);
  const smTicks = monthsIn.length ? [monthsIn[0], monthsIn[Math.floor((monthsIn.length - 1) / 2)], monthsIn[monthsIn.length - 1]]
    .filter((v, i, a) => a.indexOf(v) === i).map((ym) => ({ x: D.mx(ym), label: D.monthName(Number(ym.slice(5))) })) : [];
  /* the scale clears the polls and the tops of the monthly bands */
  const smTop = Math.max(50, Math.ceil(Math.max(...cols.flatMap((c) => pollRate(c.id).map((d) => d.y)
    .concat(c.sr.rate.monthly.map((m) => m.v + (m.ci95 || 0))))) / 25) * 25);

  /* ---- where each cohort's 2025 voters are going (the cycle views) -------------
     The same waves read cohort-row-first: kept, gone to One Nation, gone to
     the other major, gone to the Greens, gone to the others - a full row
     summing to the cohort, so no 2025-weight re-scaling is needed. */
  const goRow = view !== "onp" ? (S.going || []).find((g) => g.id === view) : null;
  const V = goRow ? view : "onp";
  const GO_COHORT_W = { lnp: "2025 Coalition voters", alp: "2025 Labor voters", grn: "2025 Greens voters" };
  const GO_OWN = { lnp: "the Coalition", alp: "Labor", grn: "the Greens" };
  const GO_HALF = { lnp: "Coalition", alp: "Labor", grn: "Greens" };
  const cyc = () => setView(GO_NEXT[V]);
  const GO_HINT = { onp: "Tap: where 2025 Coalition voters are going",
                    lnp: "Tap: where 2025 Labor voters are going",
                    alp: "Tap: where 2025 Greens voters are going",
                    grn: "Tap: where One Nation's voters are coming from" };
  const cycTitle = (() => {
    const btn = (w) => <button type="button" className="rd-sw-cycle" title={GO_HINT[V]} aria-label={GO_HINT[V]} onClick={cyc}>{w}</button>;
    if (V === "lnp") return <>Where {btn("the Coalition")}’s voters are going</>;
    if (V === "alp") return <>Where {btn("Labor")}’s voters are going</>;
    if (V === "grn") return <>Where {btn("the Greens")}’ voters are going</>;
    return <>Where {btn("One Nation")}’s voters are coming from</>;
  })();
  /* a destination's words in the copy, by id: its display name, the noun in
     a sentence, and the "the move to One Nation" form the trend line names */
  const goWords = (id) => {
    const M = {
      kept: { nm: V === "lnp" ? "The Coalition" : V === "alp" ? "Labor" : "The Greens",
              noun: GO_OWN[V], sd: "the share staying with " + GO_OWN[V],
              color: "var(--" + V + ")", tint: "var(--tint-" + V + ")", fill: "var(--on-fill-" + V + ")" },
      onp: { nm: "One Nation", noun: "One Nation", sd: "the move to One Nation",
             color: "var(--onp)", tint: "var(--tint-onp)", fill: "var(--on-fill-onp)" },
      alp: { nm: "Labor", noun: "Labor", sd: "the move to Labor",
             color: "var(--alp)", tint: "var(--tint-alp)", fill: "var(--on-fill-alp)" },
      lnp: { nm: "The Coalition", noun: "the Coalition", sd: "the move to the Coalition",
             color: "var(--lnp)", tint: "var(--tint-lnp)", fill: "var(--on-fill-lnp)" },
      grn: { nm: "The Greens", noun: "the Greens", sd: "the move to the Greens",
             color: "var(--grn)", tint: "var(--tint-grn)", fill: "var(--on-fill-grn)" },
      oth: { nm: "Others & independents", noun: "others & independents",
             sd: "the move to others & independents",
             color: "var(--oth)", tint: "var(--tint-oth)", fill: "var(--on-fill-oth)" },
    };
    return M[id];
  };
  /* a share below the plain-fraction ladder's reach ("about one in twenty")
     reads far enough out to say directly; the ladder's wording inside it */
  const goShareWords = (p) => (rdFracSnap(p).err < 0.025 || p >= 15 ? rdFraction(p) : "about one in " + Math.max(2, Math.round(100 / p)));
  const goRows = goRow ? goRow.dests.filter((d) => d.now && d.now.v > 0)
    .map((d) => ({ id: d.id, ...goWords(d.id), now: d.now, monthly: d.monthly, polls: d.polls })) : [];
  const goKept = goRows.find((r) => r.id === "kept");
  /* "more than half" / "almost half" claim a side of 50 the poll can't
     always back: inside the 95% range of 50 it reads "about half" */
  const goHalfSafe = (w, n) => (/half of$/.test(w) && Math.abs(n.v - 50) <= (n.ci95 || 0) ? "About half of" : rdCap(w));
  const goHead = goKept && V !== "onp"
    ? goHalfSafe(plainShare(goKept.now.v), goKept.now) + " 2025 " + GO_HALF[V] + " voters are sticking with " + GO_OWN[V]
    : null;
  const goRest = goRows.filter((r) => r.id !== "kept").sort((a, b) => b.now.v - a.now.v);
  const gd1 = goRest[0], gd2 = goRest[1];
  /* the dek answers "where did the leavers go?": the top destination in the
     headline's own words (plainShare from a fifth up, where its ladder is
     exact enough; the finer ladder below), with its share of the leavers
     while it is most of them; then the next destinations of 5% or more as
     figures - a "similar" pair while they sit inside each other's margins */
  const goApart = (a, b) => a.now.v - b.now.v > Math.hypot(a.now.ci95 || 0, b.now.ci95 || 0);
  const goBig = (v) => (v >= 20 ? plainShare(v) : rdCap(rdFraction(v)));
  const goVerb = (w) => (/\bone in\b/i.test(w) ? " has" : /of$/.test(w) ? " them have" : " have");
  const goPc = (r) => Math.round(r.now.v) + "%";
  const goLeft = goKept ? 100 - goKept.now.v : null;
  const goDek = (() => {
    if (!gd1) return null;
    const named = goRest.filter((r) => r.now.v >= 5);
    if (gd2 && named.includes(gd2) && !goApart(gd1, gd2))
      return "Similar shares have moved to " + gd1.noun + " (" + goPc(gd1) + ") and " + gd2.noun + " (" + goPc(gd2) + ")."
        + (named[2] ? " Another " + goPc(named[2]) + " have gone to " + named[2].noun + "." : "");
    const w1 = goBig(gd1.now.v), most = goLeft && gd1.now.v / goLeft >= 0.6;
    const s1 = w1 + goVerb(w1) + " moved to " + gd1.noun + (most ? ", " + rdFraction(100 * gd1.now.v / goLeft) + " of those who have left" : "") + ".";
    const next = named.slice(1, 3);
    if (!next.length) return s1 + (goRest.length > 1 ? " The rest are scattered." : "");
    const only = next[0].now.v < gd1.now.v / 4 ? "Only " : "Another ";
    const s2 = next.length === 2 && !goApart(next[0], next[1])
      ? "Smaller, similar shares have gone to " + next[0].noun + " (" + goPc(next[0]) + ") and " + next[1].noun + " (" + goPc(next[1]) + ")."
      : only + goPc(next[0]) + " have gone to " + next[0].noun + (next[1] ? " and " + goPc(next[1]) + " to " + next[1].noun : "") + ".";
    return s1 + " " + s2;
  })();
  const goDots = (r) => r.polls.map((p) => ({
    x: p.x, y: p.v, h: p.pollster, w: (p.sample || 1000) * (goRow ? goRow.weight / 100 : 0.3),
    meta: { pollster: p.pollster, released: p.released, dateLabel: p.dateLabel || "", sample: p.sample } }));
  const goDotsClipped = (r) => goDots(r).filter((d) => d.x >= x0 && d.x <= x1 + 0.02);
  const goFits = goRows.map((r) => ({
    r, fit: withinHouseSlope(r.polls.map((p) => ({ h: p.pollster, t: p.x, w: (p.sample || 1000) * (goRow ? goRow.weight / 100 : 0.3), y: p.v }))) })).filter((f) => f.fit);
  const goSig = [];
  for (const [i, f] of [...goFits].sort((a, b) => a.fit.p - b.fit.p).entries()) {
    if (f.fit.p >= 0.05 / (goFits.length - i)) break;
    goSig.push(f);
  }
  const goSinceM = goRows.length && goRows[0].monthly.length ? D.monthNameFull(Number(goRows[0].monthly[0].ym.slice(5))) : "";
  /* the shares that moved, tested within each pollster, the rest said to
     hold - the same construction as the gain rates' own head */
  const goWhere = (r) => r.id === "kept" ? "staying with " + GO_OWN[V] : "moving to " + r.noun;
  const goSigOf = (r) => goSig.find((f) => f.r === r);
  const goSubHead = rdTrendLine(goRows.filter(goSigOf).map((r) => ({
    first: "the share of " + GO_COHORT_W[V] + " " + goWhere(r), later: "the share " + goWhere(r),
    b: goSigOf(r).fit.b, from: r.monthly.length ? r.monthly[0].v : null, to: r.now.v })),
    goSinceM, "No share has clearly changed",
    goSig.length && goSig.length < goRows.length ? "No other share has clearly changed." : "");
  const goKs = goRows.flatMap((r) => r.monthly.map((m) => m.k)).filter((k) => k != null);
  const gkLo = goKs.length ? Math.min(...goKs) : 0, gkHi = goKs.length ? Math.max(...goKs) : 0;
  /* the scales differ because the kept share is so much bigger - said only
     while it is at least twice the largest destination */
  const goScale = goKept && gd1 && goKept.now.v >= 2 * gd1.now.v
    ? "Each chart has its own scale, because far more stay with " + GO_OWN[V] + " than go anywhere else."
    : "Each chart has its own scale.";
  const goSubDek = "Each dot is one poll; each line is a monthly average, with its 95% interval shaded. "
    + (gkLo ? rdPollsPerMonth(gkLo, gkHi) + " " : "") + goScale;
  /* the destinations drawn the came-from view's way: on a laptop the five
     are full-height columns sized by their share of the cohort, wearing the
     mosaic's garment (name/size lines above, the figure and its 95% rows
     beneath, the kept column's figure bigger like One Nation's kept one);
     on a phone they are the mosaic's variable-height rows */
  const gof = (v) => v.toFixed(1);
  const GO_GAP = 4, GO_H = 240;
  const goNmOpts = (r) => r.id === "kept" ? [r.nm + ", kept", r.nm]
    : r.id === "onp" ? ["One Nation", "ON"]
    : r.id === "grn" ? ["The Greens", "Greens", ""]
    : r.id === "oth" ? ["Others & independents", "Others", ""]
    : r.id === "lnp" ? ["The Coalition", "Coalition", ""]
    : r.id === "alp" ? ["Labor", ""]
    : [r.nm];
  const goGeo = (() => {
    const tot = goRows.reduce((s, r) => s + r.now.v, 0) || 100;
    const usable = W - GO_GAP * (goRows.length - 1);
    let x = 0;
    return goRows.map((r, i) => { const cw = (r.now.v / tot) * usable, g = { r, i, x, cw }; x += cw + GO_GAP; return g; });
  })();
  /* the same neighbour-clearing label ladder the came-from mosaic runs:
     every column takes the longest wording that clears its neighbour */
  const goLabOpts = goGeo.map((g, i) => {
    const v = g.r.now.v, pc = gof(v) + "%";
    return {
      nm: goNmOpts(g.r),
      sz: i === 0 ? [pc + " of " + GO_COHORT_W[V], goShareWords(v), ""] : [goShareWords(v), ""],
      /* the figure row never blanks: like the mosaic's own pts row, every
         column keeps its number (a tiny column's text sits in its lane and
         leans on its neighbours', as the came-from mosaic's do) */
      pts: [pc],
      sh: [Math.round(v) + "% ±" + gof(g.r.now.ci95), Math.round(v) + "%", ""],
    };
  });
  const goLab = {};
  /* the mosaic's own ladder runs its labels 10px clear of the next column,
     over the nm and sz rows */
  [["nm", 15, 600], ["sz", 12, 400]].forEach(([key, size, wt]) => {
    const k = goGeo.map(() => 0);
    const ext = (i) => {
      const w = textWidth(goLabOpts[i][key][k[i]], size, wt);
      const last = i === goGeo.length - 1;
      const x = last ? goGeo[i].x + goGeo[i].cw : goGeo[i].x;
      return last ? [x - w, x] : [x, x + w];
    };
    for (let i = 0; i < goGeo.length - 1; i++) {
      for (let guard = 0; guard < 6 && ext(i)[1] + 10 > ext(i + 1)[0]; guard++) {
        if (k[i] < goLabOpts[i][key].length - 1) k[i]++;
        else if (k[i + 1] < goLabOpts[i + 1][key].length - 1) k[i + 1]++;
        else break;
      }
    }
    goLab[key] = k.map((j, i) => goLabOpts[i][key][j]);
  });
  /* the figure rows (the column's share, then its rounded share and 95%
     interval) can face destination columns far narrower than the mosaic's
     ever are - a 2% column against a wide "1.7%" figure - so instead of
     shortening toward nothing they dodge into tiers the way the chart
     engine's cluster-centred end labels do: a figure that can't clear its
     predecessor's right edge by 2px drops one tier; the interval row rides
     its own figure's tier */
  const goFigs = goGeo.map((g) => gof(g.r.now.v) + "%");
  const goPtsTier = (() => {
    const rights = [];
    return goGeo.map((g, i) => {
      const w = textWidth(goFigs[i], 15, 600);
      const x = i === goGeo.length - 1 ? g.x + g.cw : g.x;
      const L = i === goGeo.length - 1 ? x - w : x, R = i === goGeo.length - 1 ? x : x + w;
      let t = 0;
      while (rights[t] != null && rights[t] + 2 > L) t++;
      rights[t] = R;
      return t;
    });
  })();
  const goTierMax = goPtsTier.reduce((m, t) => Math.max(m, t), 0);
  const goShTier = Array.from({ length: goTierMax + 1 }, (_, tier) => {
    const which = goGeo.map((g, i) => goPtsTier[i] === tier ? i : -1).filter((i) => i >= 0);
    const k = goGeo.map(() => 0);
    const ext = (i, sh) => {
      const w = textWidth(goLabOpts[i].sh[sh], 12, 400);
      const last = i === goGeo.length - 1;
      const x = last ? goGeo[i].x + goGeo[i].cw : goGeo[i].x;
      return last ? [x - w, x] : [x, x + w];
    };
    for (let a = 0; a < which.length - 1; a++) {
      const i = which[a], j = which[a + 1];
      for (let guard = 0; guard < 6 && ext(i, k[i])[1] + 2 > ext(j, k[j])[0]; guard++) {
        if (k[i] < goLabOpts[i].sh.length - 1) k[i]++;
        else if (k[j] < goLabOpts[j].sh.length - 1) k[j]++;
        else break;
      }
    }
    return k;
  });
  goLab.sh = goGeo.map((g, i) => goLabOpts[i].sh[goShTier[goPtsTier[i]][i]]);
  const goSvgH = GO_H + 110 + goTierMax * 46;
  const goMosaic = (
    <svg className="rd-go" width={W} height={goSvgH} viewBox={`0 0 ${W} ${goSvgH}`} role="img"
         aria-label={"Where " + GO_COHORT_W[V] + " landed, each destination a column sized by its share of the cohort: "
           + goRows.map((r) => r.nm + " " + gof(r.now.v) + "%").join(", ") + "."}>
      {goGeo.map((g, i) => {
        const r = g.r, last = i === goGeo.length - 1;
        const tx = last ? g.x + g.cw : g.x, anchor = last ? "end" : "start";
        const fig = goFigs[i];
        /* the kept figure is the big one, like One Nation's kept column, and
           like that column it stays on its bar only while it fits; a column
           too narrow for its figure leaves the figure to the dodge row off
           the baseline, as the mosaic's tiny columns do */
        const fz = r.id === "kept" ? 22 : 15;
        const fit = g.cw >= textWidth(fig, fz, 600) + 20;
        const tierY = 48 + GO_H + 28 + goPtsTier[i] * 46;
        return (
          <g key={r.id}>
            <text className="rd-go-nm" x={tx} y={16} textAnchor={anchor} style={{ fill: inkOf(r.color) }}>{goLab.nm[i]}</text>
            <text className="rd-go-sz" x={tx} y={35} textAnchor={anchor}>{goLab.sz[i]}</text>
            <rect className="rd-go-colfill" x={g.x} y={48} width={g.cw} height={GO_H} style={{ fill: r.color }} />
            {fit && (r.id === "kept" ? (
              <>
                <text className="rd-go-big" x={g.x + 10} y={48 + 32} textAnchor="start" style={{ fill: r.fill }}>{fig}</text>
                <text className="rd-go-sz" x={g.x + 10} y={48 + 50} textAnchor="start" style={{ fill: r.fill }}>kept</text>
              </>
            ) : (
              <text className="rd-go-rates" x={g.x + 10} y={48 + 26} textAnchor="start" style={{ fill: r.fill }}>{fig}</text>
            ))}
            <text className="rd-go-pts" x={tx} y={tierY} textAnchor={anchor}>{goFigs[i]}</text>
            <text className="rd-go-sh" x={tx} y={tierY + 19} textAnchor={anchor}>{goLab.sh[i]}</text>
          </g>
        );
      })}
      <line x1="0" x2={W} y1={48 + GO_H} y2={48 + GO_H} className="rd-go-base" />
    </svg>
  );
  /* the phone mirror of the mosaic's own phone rows: variable-height bars,
     the kept row spelling out what its two parts are as the mosaic's first
     bar does, the party named as the canvas named it */
  /* the tint caption must sit wholly on the tint: right-pinned it slid back
     onto the kept fill in its own hue once the fill neared 80% (Greens 78.5
     kept 21.5 - the residue held 60px of tint against an 80px label on a
     320px phone). One form, "Went elsewhere": on the tint while the residue
     holds it, on its own line under the bar once it no longer does (user
     call 2026-10-20 - a wrap beats shortening the wording). */
  const ELSE_CAPTION = "Went elsewhere";
  const elseFitsInline = (v) => textWidth(ELSE_CAPTION, 11, 400) <= W * (100 - v) / 100 - 16;
  const goRowsPhone = (
    <div className="rd-go-rows">
      {goRows.map((r, i) => (
        <div key={r.id} className="rd-go-row">
          <div className="rd-go-rtop"><b style={{ color: inkOf(r.color) }}>{r.nm}{r.id === "kept" ? ", kept" : ""}</b><b>{i <= 1 ? gof(r.now.v) + "% of " + GO_HALF[V] + " voters" : gof(r.now.v) + "%"}</b></div>
          <div className="rd-go-rsub"><span>{goShareWords(r.now.v)}</span><span>{Math.round(r.now.v)}% ±{gof(r.now.ci95)}</span></div>
          <div className="rd-go-rbar" style={{ height: Math.max(16, r.now.v * 2.6), background: r.tint }}>
            <span style={{ width: r.now.v + "%", background: r.color }}></span>
            {r.id === "kept" ? (
              /* the kept figure sits after the bar while it fits there, as
                 the mosaic's kept column does; a kept share whose bar nearly
                 fills the row takes the mosaic's own dodge - inside the
                 fill, in the on-colour ink */
              W * r.now.v / 100 + 8 + textWidth(gof(r.now.v) + "%", 22, 600) + 4 <= W ? (
              <em className="rd-go-first" style={{ left: "calc(" + r.now.v + "% + 8px)", color: inkOf(r.color) }}>
                <span className="rd-go-big">{gof(r.now.v)}%</span><span className="rd-go-nb">kept</span></em>
              ) : (
              <em className="rd-go-first" style={{ right: "calc(" + (100 - r.now.v) + "% + 8px)", color: r.fill }}>
                <span className="rd-go-big">{gof(r.now.v)}%</span><span className="rd-go-nb">kept</span></em>
              )
            ) : <em style={{ left: "calc(" + r.now.v + "% + 8px)", color: inkOf(r.color) }}>{gof(r.now.v)}%</em>}
            {r.id === "kept" && elseFitsInline(r.now.v) && <i className="rd-go-else" style={{ color: inkOf(r.color) }}>{ELSE_CAPTION}</i>}
          </div>
          {r.id === "kept" && !elseFitsInline(r.now.v) && <div className="rd-go-elsebelow" style={{ color: inkOf(r.color) }}>{ELSE_CAPTION}</div>}
        </div>
      ))}
    </div>
  );
  const goSec = V === "onp" ? null : (
    <>
      {goHead && <RdHed head={goHead} dek={goDek} />}
      <div className="card rd-card rd-go-wrap" ref={boxRef}>
        {narrow ? goRowsPhone : goMosaic}
        <p className="rd-note rd-go-note">Shares of all {GO_COHORT_W[V]}; the five destinations sum to the cohort.</p>
        <div className="rd-key rd-go-key">
          {goRows.map((r) => (
            <span key={r.id} className="rd-key-item"><RdSwatch kind="square" color={r.color} />{r.nm}{r.id === "kept" ? ", kept" : ""}</span>
          ))}
          {!narrow && <span className="rd-key-item rd-go-howread">Column width: share of {GO_COHORT_W[V]}, the five columns summing to the cohort</span>}
        </div>
        {narrow && <p className="rd-note">Bar height: that destination’s share of {GO_COHORT_W[V]}. Fill: its exact share, written beside the fill.</p>}
      </div>
      <RdSub head={goSubHead} dek={goSubDek} />
      <div className="rd-sm-grid">
        {goRows.map((r) => {
          const pts = filterPts(r.monthly, x0).map((m) => ({ x: m.x, y: m.v, ym: m.ym, ci: m.ci95 }));
          const band = pts.filter((p) => p.ci != null).map((p) => ({ x: p.x, y0: Math.max(0, p.y - p.ci), y1: p.y + p.ci }));
          const dots = goDotsClipped(r).map((d) => ({ x: d.x, y: d.y, color: r.color, label: r.noun, meta: d.meta }));
          const top = Math.max(10, Math.ceil(Math.max(...r.polls.map((p) => p.v)
            .concat(r.monthly.map((m) => m.v + (m.ci95 || 0)))) / 25) * 25);
          const step = top >= 50 ? 25 : top >= 25 ? 10 : 5;
          return (
            <div key={r.id} className="card rd-card rd-sm">
              <div className="rd-sm-top"><span style={{ color: inkOf(r.color) }}>{r.nm}</span><b>{r.now.v.toFixed(1)}%</b></div>
              <TrendChart key={"rd-go-" + r.id} heightPx={narrow ? 120 : 150} padPx={{ l: 4, r: 4, t: 18, b: 24 }}
                xDomain={[x0, x1]} yDomain={[0, top]} yTicks={rdYTicks(0, top, step)}
                yTickFmt={() => ""} xTicks={smTicks} baseline
                series={[{ id: r.id, label: r.noun, color: r.color, rdWidth: narrow ? 2 : 2.5, endCap: false, points: pts }]}
                spine={pts}
                scatter={dots}
                pollFacet="demographics"
                areas={band.length >= 2 ? [{ id: "ci-go-" + r.id, color: r.color, className: "ci-band", edge: false, points: band }] : []}
                notes={rdYTicks(step, top, step).map((v) => ({ x: "left", y: v, dy: -4, text: v + "%", size: 11, cls: "rd-sm-ylab" }))}
                tooltipTitle={(i) => (pts[i] ? window.AP.monthLabelFull(pts[i].ym) : "")}
                extraRows={(i) => (pts[i] && pts[i].ci != null ? [{ label: "95% interval", value: "±" + pts[i].ci.toFixed(1) }] : [])}
                fmt={(v) => v.toFixed(1)}
                copy={{ title: GO_COHORT_W[V] + " now backing " + r.noun,
                        sub: "Share of those who voted " + (V === "lnp" ? "for the Coalition" : "Labor") + " at the 2025 election who now say they would vote " + r.noun + ", month by month",
                        legend: [{ label: "Monthly average", color: r.color, kind: "line" }, { label: "95% interval", color: r.color, kind: "band" }] }}
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
        heads={[GO_HALF[V] + " voters’ destination", "Monthly line, first → last, %", "Slope, pts/yr", "t", "Significant"]}
        sets={[{ key: "main", rows: goRows.map((r) => {
          const ms = r.monthly, fe = goFits.find((x) => x.r === r), f = fe && fe.fit, sg = !!fe && goSig.includes(fe);
          return { key: r.id, name: r.nm + (r.id === "kept" ? ", kept" : ""), sig: sg,
            cells: [rdTsSgn(ms[0].v) + " → " + rdTsSgn(ms[ms.length - 1].v), f ? rdTsSgn(f.b, true) : "–", f ? rdTsSgn(f.t) : "–", sg ? "Yes" : "No"] };
        }) }]}
        note={"Shares are pooled across pollsters; a destination’s trend test fits one shared slope to every pollster’s own monthly changes (a level per pollster, each poll weighted by its sample and the cohort’s share of it), Holm’s correction applied across the five destinations, so Yes means the slope clears 95% — the test behind the “since " + goSinceM + "” line above."}
      />
      <RdFoot how={{ term: "vote-switching", from: { lnp: "Where the Coalition’s voters are going", alp: "Where Labor’s voters are going", grn: "Where the Greens’ voters are going" }[V] }}>
        2025 vote is as respondents recall it, but Redbridge notes that vote recall often contains a great deal of error, as many voters struggle to remember, and are uncertain, how they voted at the last election. Where a house prints an undecided cell for a cohort the row is re-scaled to its decided shares.
      </RdFoot>
    </>
  );

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
    /* the first two columns' points rows name what they count (the full
       wording first, the ON short form second); every later column is
       bare. Both columns say "One Nation's" gain, never a bare "the
       gain" (user, 2026-10-10: the Labor column's "of the gain" didn't
       say whose). The phone rows say the short wording */
    pts: c.kept ? ["≈ " + fmt1(keptPts)] : i <= 1
      ? ["≈ " + fmt1(c.pts) + " points of One Nation’s gain", "≈ " + fmt1(c.pts) + " points of ON’s gain", "≈ " + fmt1(c.pts) + " points", "≈ " + fmt1(c.pts)]
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
          <div className="rd-mo-rtop"><b style={{ color: c.ink }}>{c.kept ? "One Nation" : c.id === "oth" ? "Others & independents" : NAME[c.id]}</b><b>{c.kept ? "≈ " + fmt1(keptPts) + " pts" : i <= 1 ? "≈ " + fmt1(c.pts) + " points of ON’s gain" : "≈ " + fmt1(c.pts) + " pts"}</b></div>
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

  /* a double-click/tap anywhere in the section walks the same cycle the
     title's party-word button and Space do (dblCycle is RdSec's) */
  return (
    <RdSec id="switching" cls="rd-sw" title={cycTitle} dblCycle={cyc}
           meta={"How 2025 voters say they’d vote now, " + rdList(S.houses || []) + ", last " + (S.now ? S.now.window : "six weeks")}>
      {V === "onp" ? (
        <>
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
                pollFacet="demographics"
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
      <RdFoot how={{ term: "vote-switching", from: "Where One Nation’s voters are coming from" }}>
        2025 vote is as respondents recall it, but Redbridge notes that vote recall often contains a great deal of error, as many voters struggle to remember, and are uncertain, how they voted at the last election. {narrow ? "Bar heights" : "Column widths"} use the AEC 2025 first-preference result.
      </RdFoot>
        </>
      ) : goSec}
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
  /* the trust view's sub-views: the rows-and-chart snapshot, and the change
     tiles (who was trusted, a snapshot month against now) */
  const [snap, setSnap] = useState("snap");
  /* the change view sits parked (user's call 2026-10-10): November 2025 and
     now read too alike to make the comparison worth showing. Flip to false
     to bring the Change tab, the tiles and their phone side-by-side layout
     back; the code and the gen-data snap stay live underneath. */
  const ISC_CHG_PARKED = true;
  const [selId, setSelId] = useState(null);
  /* picking another issue asks the same three parties a different question,
     so the chart reshapes into it (useMorph) rather than being swapped out.
     Called before the early return below: a hook can't sit after one. */
  const selNow = selId || (I && I.list && I.list[0] ? I.list[0].id : null);
  const [issMorph, setSel] = window.AP.useMorph(selNow, (v) => setSelId(v), (a, b) => a !== b);
  /* What matters: the issues as trends over the term - the pooled all-voters
     line, or RedBridge's waves joined up by the chosen group set. The selected
     issue is the trust view's one (`selNow`), so the two views follow one pick. */
  const [matView, setMatView] = useState("all");
  /* "All voters" takes the short form "All" on a narrow phone: the menu's
     seven entries are measured against the card at every phone rung, and the
     long word is what tips the sum over at 320 (the label only, the entry
     keeps the full name in its aria text) */
  const matNarrow = useNarrow("(max-width: 560px)");
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
      /* the panel's own SELECTED view tab owns ↑/↓ too: a click leaves the
         focus on it (rdTabFocus), where a vertical arrow would only jiggle
         the page, so the hover claim walks the trust rows with the tab's
         pick and focus staying put (who-votes' chips/menu admission's
         shape). ←/→ stay the tab row's own (rdTabsKey walks them natively),
         and every other focused element keeps the keys */
      const onViewTab = (e.key === "ArrowDown" || e.key === "ArrowUp")
        && a && a.tagName === "BUTTON" && a.getAttribute("aria-pressed") === "true"
        && a.matches('#issues .rd-is-tabs .rd-tab');
      if (!onViewTab && a && a.tagName !== "BODY" && a.tagName !== "HTML") return;
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
        const list = ["all"].concat(G.tabs.map((x) => x.id));
        const i = list.indexOf(matViewEff);
        if (i < 0 || list.length < 2) return;
        e.preventDefault();
        pickMat(list[(i + (e.key === "ArrowRight" ? 1 : -1) + list.length) % list.length]);
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
  }, [view, matView, I]);
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
    const byRow = new Map([...D.individualPolls, ...(D.issuesOnlyPolls || [])].map((q) => [q.pollster + "|" + q.released, q]));
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

  /* ---- the change view: who was trusted, the snapshot month against now ---
     Two month grids of tiles, one per issue, run off the row verdict's own
     ahead/behind test – the snapshot month pooled on that month's waves
     (gen-data's snap), now the rows' own reading, so a tile can never
     colour against what the Snapshot rows print just a crossfade away. */
  const iscNowYm = list.reduce((a, x) => {
    const ms = x.monthly || [];
    return ms.length && (!a || ms[ms.length - 1][0] > a) ? ms[ms.length - 1][0] : a;
  }, null);
  const iscMonth = (ym) => D.monthNameFull(+ym.slice(5)) + " " + ym.slice(0, 4);
  const iscMonths = I.snapYm ? [
    { ym: I.snapYm, snap: true, label: iscMonth(I.snapYm) },
    ...(iscNowYm && iscNowYm !== I.snapYm ? [{ ym: iscNowYm, snap: false, label: iscMonth(iscNowYm) }] : []),
  ] : [];
  const iscTile = (x, mo) => {
    const m = (x.monthly || []).find((mm) => mm[0] === mo.ym);
    const sv = mo.snap ? x.snap : x.own;
    if (!m || !sv) return (
      <div key={x.id} className="rd-isc-tile na" aria-label={x.label + ": not polled in " + mo.label}>
        <span className="rd-isc-issue">{x.label}</span>
        <b className="rd-isc-v">Not polled</b>
      </div>
    );
    const v = Object.fromEntries(P.map((q, i) => [q, m[1 + i]]));
    const aria = x.label + ", " + mo.label + ": " + P.map((q) => pName(q) + " " + Math.round(v[q])).join(", ") + ". ";
    if (sv.leadSig) {
      const gap = Math.round(v[sv.lead] - v[sv.runner]);
      return (
        <div key={x.id} className="rd-isc-tile" style={{ background: pColor(sv.lead) }}
             aria-label={aria + ISS_PARTY_CAP[sv.lead] + " ahead by about " + gap + " points."}>
          <span className="rd-isc-issue">{x.label}</span>
          <b className="rd-isc-v">{ISS_PARTY_CAP[sv.lead]} +{gap}</b>
        </div>
      );
    }
    if (sv.pairSig) {
      return (
        <div key={x.id} className="rd-isc-tile"
             style={{ background: "linear-gradient(135deg, " + pColor(sv.lead) + " 0 50%, " + pColor(sv.runner) + " 50% 100%)" }}
             aria-label={aria + pName(sv.lead) + " and " + pName(sv.runner) + " are level at the front, " + pName(sv.third) + " clearly behind."}>
          <span className="rd-isc-issue">{x.label}</span>
          <b className="rd-isc-v">Level</b>
          <small className="rd-isc-sub">{ISS_PARTY_CAP[sv.lead]} · {ISS_PARTY_CAP[sv.runner]}</small>
        </div>
      );
    }
    return (
      <div key={x.id} className="rd-isc-tile none" aria-label={aria + "No party has a clear lead."}>
        <span className="rd-isc-issue">{x.label}</span>
        <b className="rd-isc-v">No clear lead</b>
      </div>
    );
  };

  /* ---- what matters -------------------------------------------------------
     The issues as trends: the pooled all-voters line, or RedBridge's waves
     joined up group by group (its waves alone carry the splits, so a group
     pick leaves the pooled houses behind). */
  const G = I.groups;
  const matTabsAll = (G && G.tabs && G.tabs.length ? [{ id: "all" }].concat(G.tabs.map((x) => ({ id: x.id, label: x.label }))) : [{ id: "all" }])
    .map((t) => (t.id === "all" ? { id: "all", label: matNarrow ? "All" : "All voters" } : t));
  const matViewEff = matTabsAll.some((t) => t.id === matView) ? matView : "all";
  const gtab = matViewEff !== "all" && G && G.tabs ? (G.tabs.find((x) => x.id === matViewEff) || null) : null;
  const allOf = (k) => (G && G.all && G.all[k]) || null;
  /* the issue the trend chart follows: the trust view's selection, falling
     back to the group house's first split issue when the pick isn't one of
     its six */
  const matIssue = !gtab ? selNow : (gtab.issues.includes(selNow) ? selNow : gtab.issues[0]);
  const matX = list.find((x) => x.id === matIssue) || null;
  /* one shared slope per issue across both pollsters' own waves (a level per
     house, the trust chart's test again); a mover is named only once it
     survives Holm's correction across the issues */
  const salFitOf = (x) => (x && x.salDots && x.salDots.length >= 4
    ? withinHouseSlope(x.salDots.map((d) => ({ h: d[1], t: d[0], w: d[4], y: d[3] }))) : null);
  const salTrends = list.map((x) => ({ k: x.id, fit: salFitOf(x) })).filter((f) => f.fit);
  const salMovers = [];
  for (const [i, f] of [...salTrends].sort((a, b) => a.fit.p - b.fit.p).entries()) {
    if (f.fit.p >= 0.05 / (salTrends.length - i)) break;
    salMovers.push(f);
  }
  const matSince = (x) => {
    const s = (x && x.salDots && x.salDots[0]) ? x.salDots[0][2] : null;
    return s ? D.monthNameFull(+s.slice(5, 7)) + " " + s.slice(0, 4) : "";
  };
  const mattersHead = (() => {
    const ph = ISS_PHRASE[top.id] || top.label.toLowerCase();
    const moved = salMovers.filter((f) => f.k !== top.id);
    const up = moved.filter((f) => f.fit.b > 0)[0], dn = moved.filter((f) => f.fit.b < 0)[0];
    const cl = [(up && (ISS_PHRASE[up.k] || up.k) + " is climbing"), (dn && (ISS_PHRASE[dn.k] || dn.k) + " is fading")].filter(Boolean);
    return rdCap(ph) + " tops what matters to voters" + (cl.length ? ", as " + cl.join(" and ") : "") + ".";
  })();
  const mattersDek = (() => {
    const sents = [];
    const three = list.filter((x) => x.imp && x.imp.v != null).slice(0, 3);
    if (three.length) sents.push("In voters’ top three now: " + three.map((x) => (ISS_PHRASE[x.id] || x.label.toLowerCase()) + " (" + Math.round(x.imp.v) + "%)").join(", ") + ".");
    for (const x of list.filter((x) => x.imp && x.imp.changeSig && x.imp.chg != null && Math.abs(x.imp.chg) >= 0.1).slice(0, 2)) {
      sents.push(rdCap(ISS_PHRASE[x.id] || x.label.toLowerCase()) + " is " + (x.imp.chg > 0 ? "up " : "down ") + Math.abs(x.imp.chg).toFixed(1) + (Math.abs(x.imp.chg) > 1.05 ? " points" : " point") + " on a month ago.");
    }
    return sents.join(" ");
  })();
  const gVerdicts = gtab ? gtab.issues.map((k) => issGroupVerdict(gtab, k)).filter(Boolean).sort((a, b) => b.gap - a.gap).slice(0, 3) : [];
  const whomHead = (() => {
    if (!gtab) return null;
    const firstOf = (cells) => gtab.issues.slice().sort((a, b) => ((cells[b] || {}).v || 0) - ((cells[a] || {}).v || 0));
    const allRank = firstOf(Object.fromEntries(gtab.issues.map((k) => [k, allOf(k) || {}])));
    const ranks = gtab.groups.map((g) => firstOf(gtab.cells[g] || {}));
    const X = allRank[0];
    const sameFirst = ranks.every((r) => r[0] === X);
    /* a group puts another issue first only when that issue clears the
       all-voters top issue by more than the two figures' margins combined;
       a top two inside each other's margins is a tie, not a reordering */
    const behind = gtab.groups.some((g) => {
      const cells = gtab.cells[g] || {}, cx = cells[X];
      return !!cx && gtab.issues.some((k) => k !== X && cells[k] && cells[k].v - cx.v > Math.hypot(cells[k].ci, cx.ci));
    });
    const first = (ISS_PHRASE[X] || X);
    /* user trim, 2026-09-28: the "What comes second divides them." tail was
       cut; the first sentence stays generated */
    if (sameFirst) return rdCap(first) + " comes first for everyone.";
    if (!behind) return rdCap(first) + " comes first, or level first, for everyone.";
    return rdCap(first) + " comes first for most voters, but not all.";
  })();
  const groupShort = (g) => g.replace(/^Nationals, LNP and CLP$/, "Nationals, LNP, CLP");
  /* has each group's share MOVED since the election? One straight line per
     row through the house's own monthly waves (all-voters first as the
     anchor), each wave weighted by its effective sample, t-tested; Holm's
     correction within each issue, as the trust and decidedness tables do */
  const whomTsig = !gtab || !gtab.tr ? null : gtab.issues.map((k) => {
    const rows = [["all", "All voters", (gtab.tr.all || {})[k]]]
      .concat(gtab.groups.map((g) => [g, groupShort(g), gtab.tr.g[g] && gtab.tr.g[g][k] ? gtab.tr.g[g][k] : null]))
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
      dir: r.fit ? Math.sign(r.fit.b) : 0,
      cells: [rdTsSgn(r.first) + " → " + rdTsSgn(r.last),
        r.fit ? rdTsSgn(r.fit.b, true) : "–", r.fit ? rdTsSgn(r.fit.t) : "–",
        r.fit ? (sigIds.includes(r.id) ? "Yes" : "No") : "–"] })) };
  });
  /* the all-voters twin: one row per pollster on its own monthly waves */
  const salTsig = (() => {
    if (gtab || !matX || !matX.salDots || !matX.salDots.length) return null;
    const rows = [...new Set(matX.salDots.map((d) => d[1]))].map((h) => {
      const s = matX.salDots.filter((d) => d[1] === h);
      return { key: h, name: h, first: s[0][3], last: s[s.length - 1][3],
        fit: withinHouseSlope(s.map((d) => ({ h, t: d[0], w: d[4], y: d[3] }))) };
    });
    const tested = rows.filter((r) => r.fit);
    const sigIds = [];
    for (const [i, r] of [...tested].sort((a, b) => a.fit.p - b.fit.p).entries()) {
      if (r.fit.p >= 0.05 / (tested.length - i)) break;
      sigIds.push(r.key);
    }
    return [{ key: "main", rows: rows.map((r) => ({ key: r.key, name: r.name, sig: sigIds.includes(r.key), dir: r.fit ? Math.sign(r.fit.b) : 0,
      cells: [rdTsSgn(r.first) + " → " + rdTsSgn(r.last),
        r.fit ? rdTsSgn(r.fit.b, true) : "–", r.fit ? rdTsSgn(r.fit.t) : "–",
        r.fit ? (sigIds.includes(r.key) ? "Yes" : "No") : "–"] })) }];
  })();
  /* group-line colours: the vote set takes the party colours (a paler blue
     for the Nationals-side half of the Coalition), Undecided a grey; every
     other set is assigned off one categorical oklch ladder, held off the
     party hues as the house-lean palette is */
  const MAT_LADDER = [90, 128, 165, 185, 205, 225, 268, 290, 312];
  const matColor = (g) => {
    if (gtab && gtab.id === "vote") {
      if (g === "Undecided") return "var(--ink-3)";
      if (g === "Nationals, LNP and CLP") return "oklch(0.72 0.075 255)";
      /* the combined-era row prints beside its split halves in early waves */
      if (g === "Coalition") return "oklch(0.58 0.10 252)";
      return pColor({ Labor: "alp", Liberal: "lnp", "One Nation": "onp", Greens: "grn", Others: "oth" }[g] || "oth");
    }
    return "oklch(0.63 0.145 " + MAT_LADDER[gtab.groups.indexOf(g) % MAT_LADDER.length] + ")";
  };
  /* one issue's chart: the pooled monthly line and the published dots for
     all voters, or the group house's own waves joined line by line */
  const matChartFor = (x) => {
    if (!x) return null;
    if (!gtab) {
      const mPts = (x.salMonthly || []).map((m) => ({ ym: m[0], x: D.mx(m[0]), v: m[1], ci: m[2] }));
      if (!mPts.length) return null;
      const xDomain = [Math.max(rangeLo, mPts[0].x - 0.06), rangeHi];
      const pts = filterPts(mPts, xDomain[0]);
      if (!pts.length) return null;
      const byRow = new Map([...D.individualPolls, ...(D.issuesOnlyPolls || [])].map((q) => [q.pollster + "|" + q.released, q]));
      const dots = (x.salDots || []).filter((d) => d[0] >= xDomain[0] && d[0] <= xDomain[1]).map((d) => {
        const meta = byRow.get(d[1] + "|" + d[2]) || { pollster: d[1], released: d[2], sample: d[4] };
        return { x: d[0], pollster: d[1], date: d[2], y: d[3], meta };
      });
      const scatter = dots.map((d) => ({ x: d.x, y: d.y, color: "var(--ink-3)", label: d.pollster, meta: d.meta }));
      const areas = pts.length >= 2 ? [{ id: "ci-v", color: "var(--ink)", className: "ci-band", edge: false,
        points: pts.map((d) => ({ x: d.x, y0: d.v - d.ci, y1: d.v + d.ci })) }] : [];
      const vals = pts.flatMap((d) => [d.v - d.ci, d.v + d.ci]).concat(dots.map((d) => d.y));
      const d0 = Math.max(0, Math.floor((Math.min(...vals) + 0.6) / 10) * 10), d1 = Math.ceil((Math.max(...vals) - 0.6) / 10) * 10;
      return { xDomain, pts, scatter, areas, keys: ["v", "ci"], domain: [d0, d1], group: false };
    }
    if (!gtab.tr || !gtab.issues.includes(x.id)) return null;
    const allW = (gtab.tr.all || {})[x.id] || [];
    if (!allW.length) return null;
    const pts = allW.map((w) => {
      const row = { x: w[0], all: w[1], _d: w[3] || null };
      for (const g of gtab.groups) {
        const s = gtab.tr.g[g] && gtab.tr.g[g][x.id];
        const p = s && s.find((q) => q[0] === w[0]);
        if (p) row[g] = p[1];
      }
      return row;
    }).sort((a, b) => a.x - b.x);
    const xDomain = [Math.max(rangeLo, pts[0].x - 0.06), rangeHi];
    const rows = pts.filter((d) => d.x >= xDomain[0] && d.x <= xDomain[1]);
    const keys = gtab.groups.concat(["all"]);
    const vals = rows.flatMap((d) => keys.map((kk) => d[kk]).filter((v) => v != null));
    if (!vals.length) return null;
    const d0 = Math.max(0, Math.floor((Math.min(...vals) + 0.6) / 10) * 10), d1 = Math.ceil((Math.max(...vals) - 0.6) / 10) * 10;
    return { xDomain, pts: rows, keys, domain: [d0, d1], group: true };
  };
  const matCh = matChartFor(matX);
  /* mid-switch, everything travels the trust chart's way: the months blended
     on one grid, the dots crossing over, the window and the band riding */
  const matDraw = (() => {
    if (!matCh) return null;
    const base = { xDomain: matCh.xDomain, domain: matCh.domain, pts: matCh.pts,
      areas: matCh.areas || [], scatter: matCh.scatter || [], scatterOut: [], scatterMove: [], fade: 1, clip: null };
    const m = issMorph;
    const A = m && m.from && m.from !== matIssue ? list.find((x) => x.id === m.from) : null;
    const a = A && matChartFor(A);
    if (!a || a.group !== matCh.group) return base;
    const t = m.t;
    const bl = window.AP.blendRows(a.pts, matCh.pts, t, matCh.keys);
    if (!bl) return base;
    const draw = { xDomain: window.AP.blendDomain(a.xDomain, matCh.xDomain, t), domain: window.AP.blendDomain(a.domain, matCh.domain, t),
      pts: bl.rows, clip: bl.clip, fade: t };
    if (!matCh.group) {
      draw.areas = bl.rows.length >= 2 ? [{ id: "ci-v", color: "var(--ink)", className: "ci-band", edge: false, clipX: bl.clip,
        points: bl.rows.filter((d) => d.v != null && d.ci != null).map((d) => ({ x: d.x, y0: d.v - d.ci, y1: d.v + d.ci })) }] : [];
      const cross = window.AP.crossClouds(a.scatter || [], base.scatter, t, (d) => d.meta.pollster + "|" + d.meta.released + "|" + d.label);
      draw.scatter = cross.scatter; draw.scatterOut = cross.scatterOut; draw.scatterMove = cross.scatterMove;
    } else {
      draw.areas = []; draw.scatter = []; draw.scatterOut = []; draw.scatterMove = [];
    }
    return draw;
  })();
  const matSeries = matDraw ? (!gtab
    ? [{ id: "v", label: "All voters", color: "var(--ink)", rdWidth: 2.2, endCap: false, clipX: matDraw.clip,
        points: matDraw.pts.filter((d) => d.v != null).map((d) => ({ x: d.x, y: d.v })) }]
    : (() => {
        /* the end-of-line label belongs on a line that lives at the chart's
           last wave: a combined-era row the house no longer splits
           ("Coalition" beside its two halves) ends mid-term, and with
           eight-plus labels to place the engine drops the whole stack as
           unplacable (…or none, its rule). Lines are identified regardless
           by the colour legend below the chart */
        const endXOf = (g) => {
          let x = -Infinity;
          for (const d of matDraw.pts) if (d[g] != null && d.x > x) x = d.x;
          return x;
        };
        const lastWave = Math.max(...matCh.keys.map(endXOf));
        return matCh.keys.map((g) => {
          const s = { id: g, label: g === "all" ? "All voters" : groupShort(g),
            color: g === "all" ? "var(--ink-3)" : matColor(g),
            rdWidth: g === "all" ? 2.8 : 2, endCap: false, clipX: matDraw.clip,
            points: matDraw.pts.filter((d) => d[g] != null).map((d) => ({ x: d.x, y: d[g] })) };
          if (s.points.length && endXOf(g) >= lastWave - 0.02) s.endLabel = g === "all" ? "All voters" : groupShort(g);
          return s;
        });
      })()) : null;
  const matTsigSet = gtab && whomTsig ? whomTsig.find((s) => s.key === matIssue) || null : null;
  /* the h4 above the chart names what has moved on the drawn issue */
  const matTrendHead = (() => {
    if (!matX) return null;
    if (!gtab) {
      const fit = salFitOf(matX), since = matSince(matX);
      if (!since) return null;
      if (fit && fit.p < 0.05) return (ISS_SHORT[matIssue] || matX.label) + " has " + (fit.b > 0 ? "climbed" : "fallen") + " significantly since " + since;
      return "No significant shift since " + since;
    }
    const set = matTsigSet;
    if (!set) return null;
    const up = set.rows.filter((r) => r.sig && r.dir > 0).map((r) => r.name);
    const dn = set.rows.filter((r) => r.sig && r.dir < 0).map((r) => r.name);
    if (!up.length && !dn.length) return "No group has shifted significantly on it";
    const nm = (g) => (g === "All voters" ? "all voters" : g);
    return [up.length ? "Up among " + rdList(up.map(nm)) : null,
            dn.length ? "Down among " + rdList(dn.map(nm)) : null].filter(Boolean).join("; ");
  })();
  const matSetWords = { vote: "vote intention", generation: "age", gender: "gender", education: "education", location: "where they live", housing: "home ownership" };
  const matTitle = (matX ? (I.labels[matIssue] || matX.label) : "") + " in voters’ top three" + (gtab ? " by " + (matSetWords[gtab.id] || "group") : "") + ", %";
  const matSource = (gtab ? (G && G.house) || "RedBridge" : "RedBridge and Ipsos") + ", monthly" + (matSince(matX) ? " since " + matSince(matX) : "");
  /* Switching the grouping or the issue rewrites the head and dek above the
     control row; scrolled past them, the row and everything under it would
     ride the story block's height glide. rdPinScroll holds the spot: the
     voters menu first (.rd-iw-tabs at every width), then the Issue chips,
     then the desktop menu row itself */
  const pinWhom = () => {
    const sec = document.getElementById("issues");
    rdPinScroll(sec && [sec.querySelector(".rd-iw-tabs"), sec.querySelector(".rd-iw-chips"), sec.querySelector(".rd-iw-ctl")]);
  };
  const pickMat = (id) => { pinWhom(); setMatView(id); };
  const pickWhom = (k) => { pinWhom(); setSel(k); };

  const tabs = (
    <RdTabs swipe value={view} onChange={setView} ariaLabel="View" className="rd-is-tabs"
            options={[{ id: "trust", label: "Who’s trusted" }, { id: "whom", label: "What matters" }]} />
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
          {!ISC_CHG_PARKED && (
          <RdTabs swipe value={snap} onChange={setSnap} ariaLabel="Who’s trusted view" className="rd-tabs-sm rd-isc-tabs"
                  options={[{ id: "snap", label: "Snapshot" }, { id: "chg", label: "Change" }]} />
          )}
          <RdCrossfade k={ISC_CHG_PARKED ? "snap" : snap}>
          {ISC_CHG_PARKED || snap !== "chg" || !iscMonths.length ? (
          <>
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
            <div className="rd-isc">
              {iscMonths.map((mo) => (
                <div className="rd-isc-m" key={mo.ym}>
                  <p className="rd-isc-mlab"><b>{mo.label}</b></p>
                  <div className="rd-isc-grid">{list.map((x) => iscTile(x, mo))}</div>
                </div>
              ))}
            </div>
            <RdFoot how={{ term: "issues", from: "The issues" }}>
              One square per issue, pooled as the Snapshot’s figures are. A square takes the colour of the party ahead on it by more than the figures’ own 95% margin; two colours share a square the polls can’t split, the left-behind party clearly third; grey means nothing separates the three.
            </RdFoot>
          </>
          )}
          </RdCrossfade>
        </>
      ) : (
        <>
          <RdHed head={gtab ? whomHead : mattersHead} dek={gtab ? (gVerdicts.length ? gVerdicts.map((v) => v.text).join(" ") : "No two groups differ significantly on any of these issues.") : mattersDek} />
          <div className="card rd-card rd-iw" ref={iwCard}>
            <div className="rd-iw-ctl">
              <span className="rd-iw-by">Voters</span>
              <RdTabs swipe value={matViewEff} onChange={pickMat} options={matTabsAll} ariaLabel="Voters" className="rd-tabs-sm rd-iw-tabs" />
            </div>
            {/* every tracked issue for all voters; the group house's six when
                a group set is on */}
            <div className="rd-iw-chips" role="group" aria-label="Issue">
              {(gtab ? gtab.issues : list.map((x) => x.id)).map((k) => <button key={k} type="button" className="rd-iw-chip" aria-pressed={matIssue === k} onClick={() => pickWhom(k)}><RdTabW t={ISS_SHORT[k] || I.labels[k] || k} /></button>)}
            </div>
            <p className="rd-iw-src"><b>{matTitle}</b><br />{matSource}</p>
            {matDraw ? (
              <>
                {matTrendHead && <h4 className="rd-is-chead">{matTrendHead}</h4>}
                <TrendChart key={gtab ? "rd-im-g" : "rd-im"} heightPx={narrow ? 240 : 260} padPx={{ l: 36, r: 10, t: 12, b: 28 }}
                  xDomain={matDraw.xDomain} yDomain={matDraw.domain} yTicks={rdYTicks(matDraw.domain[0], matDraw.domain[1], 10)}
                  yTickFmt={(v) => (v === matDraw.domain[1] ? v + "%" : String(v))} xTicks={rdXTicks(matDraw.xDomain[0], matDraw.xDomain[1], true)} baseline
                  series={matSeries}
                  areas={matDraw.areas} spine={series(matDraw.pts, gtab ? "all" : "v")}
                  scatter={matDraw.scatter} scatterOut={matDraw.scatterOut} scatterMove={matDraw.scatterMove}
                  fade={matDraw.fade} driven={!!issMorph} pollFacet={!gtab ? "issues" : undefined}
                  tooltipTitle={!gtab ? (i) => (matCh.pts[i] ? monthLabelFull(matCh.pts[i].ym) : "") : (i) => { const d = matCh.pts[i] && matCh.pts[i]._d; return d ? rdDate(d, true) : ""; }}
                  fmt={(v) => Math.round(v) + ""}
                  copy={gtab ? {
                    title: "What matters: " + (ISS_SHORT[matIssue] || matIssue) + ", by " + (matSetWords[gtab.id] || "group"),
                    sub: "Share putting " + (ISS_PHRASE[matIssue] || matIssue) + " in their top three issues, " + (G ? G.house : "RedBridge") + "’s monthly polls",
                    caption: "Each line is one group of voters across " + (G ? G.house : "RedBridge") + "’s monthly polls; the grey line is all voters in the same polls." } : {
                    title: "What matters to voters: " + (ISS_SHORT[matIssue] || matIssue),
                    sub: "Share putting " + (ISS_PHRASE[matIssue] || matIssue) + " in their top three issues, month by month",
                    caption: "Each dot is one poll; the line is the monthly average of the two pollsters’ adjusted figures, the band its 95% interval." }} />
              </>
            ) : <p className="rd-note">No poll has published these figures for {ISS_SHORT[matIssue] || matIssue}.</p>}
            {!gtab && <RdKey className="rd-ckey" items={[{ kind: "dot", color: "var(--ink-3)", label: "One poll" }, { kind: "lineband", color: "var(--ink)", label: "Monthly average and 95% interval" }]} />}
            {/* group mode names every line's colour here: the end-of-line
                labels can only sit on lines that reach the chart's edge, and
                past a stack of them the engine draws none - so this row is
                the identity key the view can always offer */}
            {gtab && <RdKey className="rd-ckey" items={gtab.groups.concat(["all"]).map((g) => ({ color: g === "all" ? "var(--ink-3)" : matColor(g),
              label: g === "all" ? "All voters" : groupShort(g) }))} />}
            <HowTo label="How to read these figures" paras={gtab ? [
              <>Only {G ? G.house : "RedBridge"} publishes what matters by group, and only for {gtab ? rdNumWord(gtab.issues.length) : "these"} issues. Each line joins its monthly polls; the grey line is all voters in the same polls, so the gaps between a group and the grey line are the ones to read. The further right a line ends, the more that group cares than voters generally.</>,
            ] : [
              <>RedBridge and Ipsos both ask every month, in different words – a ranked top three of fourteen against any three of nineteen – and their figures sit a steady distance apart. Each poll is moved half that distance toward the other before the two are pooled.</>,
              <>The dots are the polls as published; the line is the monthly average of the adjusted polls, the band its 95% interval.</>,
            ]} />
            {!gtab && salTsig && <RdTsig summary="Trend-significance table"
              heads={["Pollster", "Share, first → last, %", "Slope, pts/yr", "t", "Significant"]}
              sets={salTsig}
              note={"Each pollster’s share naming " + (ISS_PHRASE[matIssue] || matIssue) + " as a top-three issue is fitted with one straight line across its monthly waves, weighted by sample, Holm’s correction across the two pollsters – Yes means the drift clears 95%. First and last are the published waves, unsmoothed."} />}
            {gtab && matTsigSet && <RdTsig summary="Trend-significance table"
              heads={["Group", "Share, first → last, %", "Slope, pts/yr", "t", "Significant"]}
              sets={[matTsigSet]}
              note={"Each row fits one straight line to " + (G ? G.house : "RedBridge") + "’s own monthly waves since the May 2025 election, each wave weighted by its share of the sample, t-tested, Holm’s correction applied across the set’s rows – Yes means the group’s share has drifted over the term. First and last are the endpoint waves’ published figures, unsmoothed."} />}
          </div>
          <RdFoot how={{ term: "issues", from: "The issues" }}>
            {gtab ? <>Only {G ? G.house : "RedBridge"} publishes what matters by group, and only for these {rdNumWord(gtab.issues.length)} issues, so a group view leaves the other pollster behind and its all-voters line can sit off the pooled one in All voters.</>
            : <>RedBridge and Ipsos both ask every month, in different words; after each poll is moved half the steady gap between the two, the line is their monthly average and the band its interval. Pooling is over the last {I.window} for the figures in Who’s trusted; the trend here is the whole term so far.</>}
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
  const first = byId.first, tpp = byId.tpp, leaner = byId.leaner, soft = byId.soft;
  const softResolve = U.softResolve;
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
    const moves = [["undecided", first], ["soft", soft]].map(([nm, s]) => ({ nm, s, f: slopeOf(s) })).filter((m) => m.f);
    const movedSig = moves.filter((m) => m.f.p < 0.05 / moves.length);
    /* the dek is the movement verdict alone (user trim, 2026-09-28): the
       house range and latest-figure sentences it used to append were cut */
    const dek = !movedSig.length ? (moves.length > 1 ? "Neither share has" : "The share has") + " moved significantly since the 2025 election."
      : movedSig.map((m) => "The " + m.nm + " share has " + (m.f.b > 0 ? "risen" : "fallen") + " significantly since the 2025 election.").join(" ");
    return { head, dek };
  })();

  /* ---- all voters: of every 100 ---------------------------------------------- */
  const u = nowOf(first), sf = nowOf(softResolve);
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
    const COL = (s) => (s.id === "soft" || s.id === "leaner" ? "var(--ink-2)" : s.id === "tpp" ? "var(--ink-3)" : "var(--ink)");
    const outlier = key === "und" && first.latest && first.latest.v < lo + 2.5 ? first.polls.find((d) => d.released === first.latest.released && d.pollster === first.latest.firm) : null;
    return (
      <div className="card rd-card rd-un-panel" key={key}>
        <div className="rd-un-ptitle"><b>{title}</b><span>{meta}</span></div>
        {list.map((s) => (
          <div key={s.id} className="rd-un-read">
            <RdSwatch kind={s.dashed ? "dash" : "line"} color={COL(s)} />
            <div>
              <div className="rd-un-rtop"><b>{s.id === "soft" ? "Might still change" : s.label}</b><span className="rd-un-rv">{nowOf(s).toFixed(1)}%</span>{s.now && <span className="rd-un-rci">±{s.now.ci95.toFixed(1)}</span>}</div>
              <p>{s.id === "first" ? "Can’t say who they’d vote for. " : s.id === "leaner" ? "Still undecided after the leaner. Some houses keep them in the published figures; others set them aside. " : s.id === "tpp" ? "Won’t pick between Labor and the Coalition. " : "Named a party but say they could change their mind. "}{rdList(s.houses)}.</p>
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
    const bits = [first, tpp, leaner, soft].filter(Boolean).map((s) => {
      const c = s.now ? s.now.chg : null;
      const nm = s.id === "first" ? "first preference" : s.id === "leaner" ? "after leaner" : s.id === "tpp" ? "after preferences" : "soft";
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
    const allNow = softResolve ? nowOf(softResolve) : null;
    const rows = B.map((b, i) => ({ id: b.id, label: b.label, color: grey(i), now: A.now[b.id].v, base: A.base[b.id].v, ci: A.now[b.id].ci95, sig: apart(A.now[b.id], A.base[b.id]) }));
    const vals = rows.flatMap((r) => [r.now, r.base]).concat(allNow != null ? [allNow] : []);
    const lo = Math.max(0, Math.floor((Math.min(...vals) - 3) / 10) * 10), hi = Math.ceil((Math.max(...vals) + 3) / 10) * 10;
    const young = A.now["18-34"], old = A.now["55+"];
    const gapSig = apart(young, old);
    const anyChg = rows.filter((r) => r.sig);
    const note = "Resolve doesn’t publish how many people it asked in each age group, so each group is weighted by its share of adults (2021 Census). "
      + (gapSig ? "The gap between 18–34s and over-55s is significant; " : "The gap between 18–34s and over-55s is not significant; ")
      + (anyChg.length ? rdList(anyChg.map((r) => r.label + "s")) + "’ change is significant." : "no group’s change is.");
    /* "the least firm" only for a group apart from BOTH others; failing
       that, the clear pair if there is one */
    const AGE_WHO = { "18-34": "young voters", "35-54": "middle-aged voters", "55+": "older voters" };
    const byLoose = rows.slice().sort((a, b) => b.now - a.now);
    const least = byLoose[0], firmest = byLoose[byLoose.length - 1];
    const leastApart = byLoose.slice(1).every((r) => apart(A.now[least.id], A.now[r.id]));
    const sub = leastApart ? rdCap(AGE_WHO[least.id]) + " are the least firm"
      : apart(A.now[least.id], A.now[firmest.id]) ? rdCap(AGE_WHO[least.id]) + " are less firm than " + AGE_WHO[firmest.id]
      : "No age group is clearly less firm than the others";
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
                <span style={{ flexBasis: soft100 + "%" }}><b>Soft</b> <span className="rd-un-long">might still change</span></span>
                <span style={{ flexBasis: und100 + "%" }} className="rd-un-und"><b>Undecided</b></span>
              </div>
            )}
            <div className="rd-un-bar" role="img" aria-label={`Of every 100 voters, about ${firm100} are firm, ${soft100} soft and ${und100} undecided`}>
              <span className="rd-un-f" style={{ flexBasis: firm100 + "%" }}>{narrow ? "" : firm100}</span>
              <span className="rd-un-s" style={{ flexBasis: soft100 + "%" }}>{narrow ? "" : soft100}</span>
              <span className="rd-un-u" style={{ flexBasis: und100 + "%" }}>{narrow ? "" : und100}</span>
            </div>
            {narrow && (
              <div className="rd-un-key" aria-hidden="true">
                {[["f", firm100, "Firm:", "named a party and don’t expect to change"],
                  ["s", soft100, "Soft:", "named a party but might change"],
                  ["u", und100, "Undecided:", "can’t say who they’d vote for"]].map(([k, n, b, t]) => (
                  <div key={k}><span className={"rd-un-sw rd-un-" + k}></span><b className="rd-un-kn">{n}</b><span><b>{b}</b> {t}</span></div>
                ))}
              </div>
            )}
            <p className="rd-note">Approximate: combines {rdList(first.houses)}’s undecided share ({u.toFixed(1)}%) with {rdList(softResolve.houses)}’s firmness question ({Math.round(sf)}% of those who named a party). Pollsters ask these questions differently.</p>
          </div>
          <RdSub head={(() => { const m = [slopeOf(first), slopeOf(soft)].filter(Boolean); return m.every((f) => f.p >= 0.05 / m.length) ? "Steady since the election" : "Moving since the election"; })()}
                 dek="Each dot is one poll, open rings for after preferences; lines are monthly averages. Undecided voters are counted out of all voters and firmness out of those who named a party, so the two panels have different scales." />
          <div className="rd-un-panels">
            {panel([first, tpp, leaner].filter(Boolean), 0, 10, 5, "und", "Undecided", "% of all voters")}
            {soft && panel([soft], 0, Math.ceil((soft.hi + 1) / 10) * 10, 10, "soft", "Soft", "% of voters who named a party")}
          </div>
          <RdTsig summary="Trend-significance table"
            heads={["Series", "Monthly line, first → last, %", "Slope, pts/yr", "t", "Significant"]}
            sets={[{ key: "main", rows: unSig.map((x) => ({
              key: x.s.id, name: x.s.id === "tpp" ? "After preferences" : x.s.id === "soft" ? "Soft" : "Undecided", sig: x.sig,
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
                         title="Soft share, by age" source="Resolve, mid-2025 → now" dp={0} />
            <RdKey className="rd-ckey" items={[{ kind: "dot-open", color: "var(--ink-3)", label: "Mid-2025 (" + A.base.from + " to " + A.base.to + ")" },
                                                { kind: "dot-solid", color: "var(--ink-3)", label: "Now (" + A.now.from + " to " + A.now.to + ")" }]}>
              <span className="rd-key-item" style={{ color: "var(--ink-3)" }}>Change in bold: significant</span>
            </RdKey>
            <p className="rd-note">{ageView.note}</p>
            {/* same battery as the by-party card's: each band's start-to-now
                move and its z on the pooled margins; there's no all-voters
                Resolve not-firm reading over the span, so no anchor column */}
            <RdTsig summary="Significance table"
              heads={["Age group", "Soft, mid-2025 → now, %", "Change, pts", "z", "Significant"]}
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
                         points: softResolve ? filterPts(softResolve.monthly, xDomain[0]).map((m) => ({ x: m.x, y: m.v })) : [], endLabel: narrow ? null : "All voters" },
                       ...ageView.B.map((b, i) => ({ id: b.id, label: b.label, color: ageView.grey(i), rdWidth: 2.2, rdCap: 3.5,
                         points: ageView.lines.map((w) => ({ x: w.x, y: w[b.id] })), endLabel: narrow ? null : b.label }))]}
              spine={ageView.lines.map((w) => ({ x: w.x, y: w["18-34"] }))}
              scatter={ageView.waves.flatMap((w) => ageView.B.map((b, i) => ({ x: w.x, y: w.soft[b.id], color: ageView.grey(i), label: b.label, meta: w })))} pollFacet="twopp"
              tooltipTitle={(i) => (ageView.lines[i] ? ageView.lines[i].dateLabel : "")} fmt={(v) => v.toFixed(0)}
              /* a phone names none of these greys on the chart, so the copy
                 keys them, and carries the sub-head's words about the pooling */
              copy={{ title: "Soft voters, by age", sub: "Share of each age group who named a party but aren’t firm",
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
   Five published gauges of business and consumer confidence in TWO views
   on one card, switched by the tabs above it — Consumers (the weekly
   ANZ–Roy Morgan index with Westpac–MI's monthly sentiment and DemosAU's
   national index joining it) opens first, and Businesses (Roy Morgan's
   monthly index with the NAB survey joining it) — each drawn as published
   from the 2025 election on. Each
   dot is the published reading; each line is a recency-weighted smooth
   of those readings
   (half-life 14 days on the weekly index, 60 days on the monthly ones),
   so release-to-release noise reads as trend while every quoted figure
   stays the raw print. ANZ–Roy Morgan's and Westpac–MI's indices are
   100-neutral; NAB prints a NET BALANCE (0 = neutral), its line drawn
   +100; DemosAU's is 50-neutral, its line drawn doubled — all so the
   shared neutral line holds, and the read rows and tooltips print each
   house's own figures off each point's `raw`. Colour splits each view's
   lanes — plum for the Roy Morgan gauge, deep gold for the second house's,
   teal for DemosAU (a dash marked the second gauge until 2026-10-08;
   colour took the job over). NAB's conditions reading rides the read
   row, not a sixth
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
  demosauConsumer: "DemosAU Consumer Sentiment Index (50-neutral)",
  business: "Roy Morgan Business Confidence",
  nabBusiness: "NAB Monthly Business Survey (net balance)",
};
const confYmIdx = (ym) => +ym.slice(0, 4) * 12 + (+ym.slice(5, 7) - 1);
const confYmOf = (i) => Math.floor(i / 12) + "-" + String((i % 12) + 1).padStart(2, "0");
const RD_CONF_VIEWS = [{ id: "consumer", label: "Consumers" }, { id: "business", label: "Businesses" }];
/* the third tab exists only when gen-data §5m's payload is on the page */
const MACRO_VIEW = { id: "macro", label: "Inflation & growth" };

/* ======== Economic sentiment's time window ===============================
   One window rides all three views (Consumers, Businesses, Inflation &
   growth), so a reader who steps back to the 2007 term on one tab and
   switches to another is still looking at the 2007 term. A window is one
   of four shapes:
     term   – one parliamentary term, election to election (the sitting
              term runs on to three years, the ruler its past terms are
              lined up on). ‹ › step a term at a time, and the axis reads
              Election, 1 yr, 2 yrs… in every term, so a step slides the
              lines under a ruler that holds still.
     span   – the last N years (10 or 25), paged back N years a press.
     all    – the view's whole published run.
     custom – whatever the strip under the chart was dragged to.
   Each view clamps the shared window into its own run (the business
   gauges only reach back to 1997) without writing the clamp back, so a
   longer view finds the window where the reader left it. The strip under
   every chart (RdConfStrip) is the window selector: the view's whole
   history in miniature with the governments beneath it. Drag the window
   to pan (a term window snaps to the term it is dropped on), drag an
   edge to resize, drag across open strip to draw a new window, or tap
   it to jump there. The lines glide between windows on the charts' own
   travel (TrendChart's travelling x window); while a drag runs the charts
   are `driven` and each y axis chases its new range (useConfChase). */
/* CONF_MON3, confIsoX, confXMonth, confIsoMonth and confTermsOf live in
   rd-hero.jsx (2026-11-22): the vote charts' shared window there reads the
   same terms on the first screen, before this module lands. */
/* a term's window: election to the next election; the sitting term to
   three years (or as long as it has run) plus the stock 0.6-month air */
function confTermWin(t, nowX) {
  return { kind: "term", year: t.year, a: t.a,
           b: t.b != null ? t.b : t.a + (Math.max(36, Math.ceil((nowX - t.a) * 12)) + 0.6) / 12 };
}
/* the terms a view can show: half a year or more of its run inside them */
const confViewTerms = (terms, lo, hi) =>
  terms.filter((t) => Math.min(t.b != null ? t.b : hi, hi) - Math.max(t.a, lo) >= 0.5);
const CONF_ANCHOR = 1 / 24;   // a window ending within half a month of now is "the last N years"
function confClampWin(w, terms, lo, hi, nowX) {
  if (!terms.length) return { kind: "all", a: lo, b: hi };
  if (w.kind === "term") {
    let t = terms.find((x) => x.year === w.year);
    if (!t) t = w.a <= terms[0].a ? terms[0] : w.a >= terms[terms.length - 1].a ? terms[terms.length - 1]
      : terms.reduce((m, x) => (Math.abs(x.a - w.a) < Math.abs(m.a - w.a) ? x : m), terms[0]);
    return confTermWin(t, nowX);
  }
  if (w.kind === "all") return { kind: "all", a: lo, b: hi };
  const wid = Math.min(w.b - w.a, hi - lo);
  const a = Math.max(lo, Math.min(w.a, hi - wid));
  return { ...w, a, b: a + wid };
}
/* ‹ › : a term steps a term, a span pages its own width, all stays put */
function confStepWin(w, dir, terms, lo, hi, nowX) {
  if (w.kind === "term") {
    const i = terms.findIndex((t) => t.year === w.year), j = i + dir;
    return i < 0 || j < 0 || j >= terms.length ? null : confTermWin(terms[j], nowX);
  }
  if (w.kind === "all") return null;
  const wid = w.b - w.a;
  const a = Math.max(lo, Math.min(hi - wid, w.a + dir * wid));
  return Math.abs(a - w.a) < 1e-6 ? null : { ...w, a, b: a + wid };
}
/* the span chips zoom about the window's centre, held inside the run; a
   window that reaches now stays anchored there, so "10 yrs" from the
   sitting term is the last ten years */
function confZoomWin(w, id, terms, lo, hi, nowX) {
  if (id === "all") return { kind: "all", a: lo, b: hi };
  const cur = terms[terms.length - 1];
  const atNow = w.kind === "term" ? !!(cur && cur.year === w.year && cur.current) : w.b >= hi - CONF_ANCHOR;
  if (id === "term") {
    if (w.kind === "term") return w;
    const c = Math.min((w.a + w.b) / 2, hi);
    const t = atNow ? cur : terms.find((x) => c >= x.a && c < (x.b != null ? x.b : Infinity)) || cur;
    return confTermWin(t, nowX);
  }
  const wid = Math.min(+id, hi - lo);
  let a = atNow ? hi - wid : (w.a + Math.min(w.b, hi)) / 2 - wid / 2;
  a = Math.max(lo, Math.min(hi - wid, a));
  return { kind: "span", years: +id, a, b: a + wid };
}
/* confPms (the prime ministers over a stretch) lives in rd-hero.jsx too */
/* what the window bar says the window is */
function confWinWords(w, terms, hi) {
  if (w.kind === "term" || w.kind === "term-carry") {
    const t = terms.find((x) => x.year === w.year);
    if (!t) return { head: "", sub: "" };
    return t.current
      ? { head: "This term", sub: t.pm + " · since " + confIsoMonth(t.eDate) }
      : { head: "The " + t.year + " term", sub: t.pm + " · " + confTermDates(t.eDate, t.nDate) };
  }
  const pl = confPms(terms, w.a, w.b);
  const pms = pl.length > 3 ? pl[0] + " to " + pl[pl.length - 1] : pl.join(" → ");
  if (w.kind === "all") return { head: "Every year on record", sub: confXMonth(w.a) + " – now" };
  if (w.kind === "span" && w.b >= hi - CONF_ANCHOR) return { head: "The last " + w.years + " years", sub: confXMonth(w.a) + " – now" };
  return { head: confXMonth(w.a) + " – " + (w.b >= hi - CONF_ANCHOR ? "now" : confXMonth(w.b)), sub: pms };
}
/* the window's own words for a copied image's subtitle */
function confWinSpan(w, terms, hi) {
  const ws = confWinWords(w, terms, hi);
  return w.kind === "term" ? ws.head + " (" + ws.sub.replace(/^.*? · /, "") + ")" : ws.head + (w.kind === "custom" ? "" : " (" + ws.sub + ")");
}
/* the years a copied image's title names (copy-chart's `span`: the ticks
   of a term read Election…Now, and a span's ticks stop short of its ends):
   2022–25, 2001–present, the second year short within a century */
function confWinYears(w, terms, hi) {
  const ab = (a, b) => (typeof b === "number" && String(a).slice(0, 2) === String(b).slice(0, 2) ? a + "–" + String(b).slice(2) : a + "–" + b);
  const yr = (x) => Math.floor(x + 1e-9);
  if (w.kind === "term" || w.kind === "term-carry") {
    const t = terms.find((x) => x.year === w.year);
    if (t) return t.current ? ab(yr(t.a), "present") : ab(yr(t.a), yr(t.b));
  }
  return ab(yr(w.a), w.b >= hi - CONF_ANCHOR ? "present" : yr(w.b));
}
/* the x axis: a term window reads off its election (Election, 1 yr, 2 yrs,
   and Now in the sitting term, Election again where a past one ended); a
   longer window counts calendar years and marks each election with a
   faint rule (confElectionRules) */
function confWinTicks(w, terms, nowX) {
  if (w.kind === "term") {
    const t = terms.find((x) => x.year === w.year);
    const out = [{ x: w.a, label: "Election", strong: true, short: "E" }];
    for (let k = 1; k <= 3; k++) {
      const x = w.a + k;
      if (t && t.current ? x <= w.b + 1e-6 : x < w.b - 0.3) out.push({ x, label: k === 1 ? "1 yr" : k + " yrs" });
    }
    /* Now marks where the sitting term stands; on a window that ends at
       now (the Inflation & growth view's) it names the right edge */
    if (t && t.current && (nowX < w.b - 1.4 / 12 || Math.abs(w.b - nowX) < 0.1)) out.push({ x: Math.min(nowX, w.b), label: "Now" });
    if (t && !t.current && t.b != null) out.push({ x: t.b, label: "Election", strong: true, short: "E" });
    return out.sort((p, q) => p.x - q.x);
  }
  const span = w.b - w.a;
  const step = span <= 6 ? 1 : span <= 14 ? 2 : span <= 32 ? 5 : 10;
  const out = [];
  for (let y = Math.ceil(w.a / step - 1e-9) * step; y <= w.b + 1e-9; y += step) out.push({ x: y, label: String(y) });
  return out;
}
/* a longer window's elections, as the charts' events: each a rule with its
   name in the row over the plot (where the sitting term hangs its own
   events) and who formed government in its readout. "Won by" is the
   side that formed government, the Past cycles convention. */
function confElectionEvents(w, terms) {
  if (w.kind === "term") return [];
  return terms.filter((t) => t.a > w.a + 0.04 && t.a < w.b - 0.04).map((t) => ({
    date: t.eDate, x: t.a, short: t.year + " election", label: t.year + " federal election",
    desc: "Won by " + (t.gov === "alp" ? "Labor" : "the Coalition") + ", led by " + t.pm.split("→")[0].trim() + ".",
    major: true, elec: true,
  }));
}
/* a y window on whole steps, about six ticks tall at most */
function confNiceY(vals, minSpan) {
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (!isFinite(lo) || !isFinite(hi)) { lo = 0; hi = 1; }
  if (hi - lo < (minSpan || 2)) { const c = (hi + lo) / 2; lo = c - (minSpan || 2) / 2; hi = c + (minSpan || 2) / 2; }
  const pad = (hi - lo) * 0.06;
  const step = [0.5, 1, 2, 5, 10, 20, 50].find((s) => (hi - lo + 2 * pad) / s <= 6) || 100;
  return { lo: Math.floor((lo - pad) / step) * step, hi: Math.ceil((hi + pad) / step) * step, step };
}
/* the ticks inside a (possibly mid-chase) y window, on the target's step */
function confTicksIn(d, step) {
  const out = [];
  for (let v = Math.ceil(d[0] / step - 1e-9) * step; v <= d[1] + 1e-9; v += step) out.push(+v.toFixed(6));
  return out;
}
/* While the strip is dragged the charts draw exactly the window handed to
   them (TrendChart `driven`), so their y windows can't ride the charts'
   own travel: each chases its target on a short exponential instead
   (time constant 70ms), and lands on it exactly. Off a drag it is the
   target itself, and a step or a chip glides on the chart's own clock. */
function useConfChase(target, on) {
  const [, force] = React.useReducer((n) => n + 1, 0);
  const cur = React.useRef(target);
  const tgt = React.useRef(target);
  const raf = React.useRef(0);
  tgt.current = target;
  React.useEffect(() => {
    if (!on) { cancelAnimationFrame(raf.current); raf.current = 0; return undefined; }
    let last = performance.now();
    const step = (t) => {
      const dt = Math.min(48, Math.max(0, t - last));
      last = t;
      const c = cur.current, g = tgt.current;
      if (c[0] !== g[0] || c[1] !== g[1]) {
        const k = 1 - Math.exp(-dt / 70);
        const n = [c[0] + (g[0] - c[0]) * k, c[1] + (g[1] - c[1]) * k];
        cur.current = Math.abs(n[0] - g[0]) + Math.abs(n[1] - g[1]) < 1e-3 * (Math.abs(g[1] - g[0]) || 1) ? g : n;
        force();
      }
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => { cancelAnimationFrame(raf.current); raf.current = 0; };
  }, [on]);
  if (!on) { cur.current = target; return target; }
  return cur.current;
}

/* ---- the window bar: ‹ › and the window's name, the span chips ----------
   The arrows sit together at the left, so they never move under a reader
   pressing one repeatedly while the name beside them changes length. */
const CONF_SPANS = [{ id: "term", label: "Term" }, { id: "10", label: "10 yrs" }, { id: "25", label: "25 yrs" }, { id: "all", label: "All" }];
function RdConfWinBar({ win: shown, terms, lo, hi, nowX, onWin, children }) {
  /* a term being carried along the strip names the term under it; the
     arrows and chips act on the term it will land on */
  const win = shown.kind === "term-carry" ? confClampWin({ kind: "term", year: shown.year }, terms, lo, hi, nowX) : shown;
  const words = confWinWords(shown, terms, hi);
  const prev = confStepWin(win, -1, terms, lo, hi, nowX);
  const next = confStepWin(win, 1, terms, lo, hi, nowX);
  const unit = win.kind === "term" ? "term" : win.kind === "all" ? "" : (win.b - win.a >= 1.5 ? Math.round(win.b - win.a) + " years" : "stretch");
  const active = win.kind === "term" ? "term" : win.kind === "all" ? "all" : win.kind === "span" ? String(win.years) : null;
  const avail = CONF_SPANS.filter((s) => s.id === "term" || s.id === "all" || +s.id < hi - lo - 0.5);
  const chev = (d) => (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d={d} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
  );
  return (
    <div className="rd-cwin" role="group" aria-label="Time window">
      <div className="rd-cwin-nav">
        <button type="button" className="rd-chip rd-cwin-step" disabled={!prev} onClick={() => prev && onWin(prev, "step")}
                aria-label={win.kind === "term" ? "Previous term" : "Earlier " + unit} title={win.kind === "term" ? "Previous term" : "Earlier " + unit}>{chev("M10 3.5L5.5 8L10 12.5")}</button>
        <button type="button" className="rd-chip rd-cwin-step" disabled={!next} onClick={() => next && onWin(next, "step")}
                aria-label={win.kind === "term" ? "Next term" : "Later " + unit} title={win.kind === "term" ? "Next term" : "Later " + unit}>{chev("M6 3.5L10.5 8L6 12.5")}</button>
        <div className="rd-cwin-name" aria-live="polite"><b>{words.head}</b>{words.sub ? <span>{words.sub}</span> : null}</div>
      </div>
      <div className="rd-cwin-tools">
        {children}
        <div className="rd-cwin-spans" role="group" aria-label="Window length">
          {avail.map((s) => (
            <button key={s.id} type="button" className="rd-chip rd-cwin-span" aria-pressed={active === s.id}
                    onClick={() => onWin(confZoomWin(win, s.id, terms, lo, hi, nowX), "step")}>
              <RdTabW t={s.label} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---- the strip: the view's whole run in miniature, the window on it -----
   Grey line(s) of the view's headline series across every year on file,
   inked where the window is; under them the governments as party-tinted
   blocks, named where the name fits; decades along the foot. Pointer
   gestures (mouse and touch alike, touch-action pan-y so a vertical drag
   still scrolls the page and the page's own sideways swipe stays off it):
     on the window      drag to pan; a term window snaps on release to the
                        term under its centre (and reads that term's name
                        while it is carried)
     on an edge         drag to resize (a year at the least)
     on open strip      drag to draw a new window; a tap jumps there (a
                        term window to the term tapped, a span re-centres) */
function RdConfStrip({ lines, lo, hi, win, terms, onWin, narrow, label }) {
  const box = React.useRef(null);
  const svgRef = React.useRef(null);
  const W = useRdWidth(box, 1000);
  const [hov, setHov] = React.useState(null);
  const drag = React.useRef(null);
  const raf = React.useRef(0);
  const pend = React.useRef(null);
  React.useEffect(() => () => cancelAnimationFrame(raf.current), []);
  const SPARK_T = 3, SPARK_H = narrow ? 24 : 28;
  const BAND_Y = SPARK_T + SPARK_H + 4, BAND_H = narrow ? 13 : 14;
  const H = BAND_Y + BAND_H + (narrow ? 16 : 17);
  const IN = 1;
  const sx = (x) => IN + ((x - lo) / (hi - lo || 1)) * (W - 2 * IN);
  const xOf = (px) => lo + ((px - IN) / (W - 2 * IN || 1)) * (hi - lo);
  const all = lines.flatMap((l) => l.points);
  const yLo = all.length ? Math.min(...all.map((p) => p.y)) : 0, yHi = all.length ? Math.max(...all.map((p) => p.y)) : 1;
  const sy = (y) => SPARK_T + SPARK_H - ((y - yLo) / (yHi - yLo || 1)) * SPARK_H;
  const path = (pts) => pts.filter((p) => p.x >= lo - 0.5).map((p, i) => (i ? "L" : "M") + sx(p.x).toFixed(1) + " " + sy(p.y).toFixed(1)).join("");
  /* the window as drawn: a term window running on past now (the sitting
     term's three-year ruler) is drawn and carried as far as now */
  const wa = Math.max(lo, win.a), wb = Math.min(hi, win.b);
  const xa = sx(wa), xb = sx(wb);
  /* governments: consecutive terms of one side merge into a block */
  const blocks = [];
  terms.forEach((t) => {
    const a = Math.max(t.a, lo), b = Math.min(t.b != null ? t.b : hi, hi);
    if (b <= a) return;
    const pms = t.pm.split("→").map((s) => s.trim()).filter(Boolean);
    const last = blocks[blocks.length - 1];
    if (last && last.gov === t.gov && Math.abs(last.b - a) < 0.02) {
      last.b = b;
      pms.forEach((p) => { if (last.pms[last.pms.length - 1] !== p) last.pms.push(p); });
    } else blocks.push({ gov: t.gov, a, b, pms: pms.slice() });
  });
  /* a block's name: its prime ministers where they fit (first and last
     past three), else the side, else nothing */
  const blockName = (bk) => {
    const w = sx(bk.b) - sx(bk.a) - 8;
    const fits = (s) => textWidth(s, 10.5, 500) <= w;
    const pm = bk.pms, ends = pm.length > 2 && pm[0] !== pm[pm.length - 1] ? pm[0] + "–" + pm[pm.length - 1] : null;
    const cands = [pm.length <= 3 ? pm.join("–") : null, ends, bk.gov === "alp" ? "Labor" : "Coalition"].filter(Boolean);
    return cands.find(fits) || "";
  };
  /* decades along the foot, as many as clear each other */
  const step = (hi - lo) / Math.max(1, W / (narrow ? 64 : 72)) > 10 ? 20 : (hi - lo) > 24 ? 10 : 5;
  const years = [];
  for (let y = Math.ceil(lo / step) * step; y <= hi; y += step) years.push(y);
  /* ---- gestures ---- */
  const MIN_W = 1;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const pxAt = (e, rect) => (e.clientX - rect.left) * (W / (rect.width || W));
  const modeAt = (px, touch) => {
    const HANDLE = touch ? 16 : 8;
    if (xb - xa < 2 * HANDLE + 8 && px > xa && px < xb) return "move";
    const dl = Math.abs(px - xa), dr = Math.abs(px - xb);
    if (dl <= HANDLE && dl <= dr) return "l";
    if (dr <= HANDLE) return "r";
    if (px > xa && px < xb) return "move";
    return "new";
  };
  const send = (w, phase) => {
    if (phase === "drag") {
      pend.current = w;
      if (!raf.current) raf.current = requestAnimationFrame(() => { raf.current = 0; const p = pend.current; pend.current = null; if (p) onWin(p, "drag"); });
      return;
    }
    cancelAnimationFrame(raf.current); raf.current = 0; pend.current = null;
    onWin(w, phase);
  };
  const termAt = (x) => terms.find((t) => x >= t.a && x < (t.b != null ? t.b : Infinity))
    || (x < terms[0].a ? terms[0] : terms[terms.length - 1]);
  const onDown = (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const px = pxAt(e, rect);
    const touch = e.pointerType !== "mouse";
    /* a carried window keeps its true width, even the sitting term's,
       whose ruler runs on past now (it can only travel back from there) */
    drag.current = { mode: modeAt(px, touch), px0: px, cx0: e.clientX, cy0: e.clientY, x0: xOf(px), a0: wa, b0: wb,
                     ta: win.a, tb: win.b, moved: false, touch, decided: !touch, rect, kind: win.kind, id: e.pointerId };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}
    if (!touch) e.preventDefault();
  };
  const onMove = (e) => {
    const d = drag.current;
    if (!d) {
      if (e.pointerType === "mouse" && svgRef.current) {
        const m = modeAt(pxAt(e, svgRef.current.getBoundingClientRect()), false);
        if (m !== hov) setHov(m);
      }
      return;
    }
    if (!d.decided) {
      const dx = Math.abs(e.clientX - d.cx0), dy = Math.abs(e.clientY - d.cy0);
      if (dy > dx && dy > 8) { drag.current = null; return; }   // the page is scrolling
      if (dx < 6) return;
      d.decided = true;
    }
    const px = pxAt(e, d.rect);
    if (!d.moved && Math.abs(px - d.px0) < 3) return;
    d.moved = true;
    const x = xOf(px), dv = x - d.x0;
    let a, b;
    if (d.mode === "move") { const w = d.tb - d.ta; a = clamp(d.ta + dv, lo, Math.max(d.ta, hi - w)); b = a + w; }
    else if (d.mode === "l") { a = clamp(x, lo, d.b0 - MIN_W); b = d.b0; }
    else if (d.mode === "r") { b = clamp(x, d.a0 + MIN_W, hi); a = d.a0; }
    else {
      a = clamp(Math.min(d.x0, x), lo, hi); b = clamp(Math.max(d.x0, x), lo, hi);
      if (b - a < MIN_W) { if (x < d.x0) a = Math.max(lo, b - MIN_W); else b = Math.min(hi, a + MIN_W); }
    }
    const carryTerm = d.mode === "move" && d.kind === "term";
    send(carryTerm ? { kind: "term-carry", year: termAt((a + b) / 2).year, a, b } : { kind: "custom", a, b }, "drag");
  };
  const onUp = (e) => {
    const d = drag.current;
    drag.current = null;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (_) {}
    if (!d) return;
    const px = pxAt(e, d.rect), x = clamp(xOf(px), lo, hi);
    if (!d.moved) {
      /* a tap: inside the window it does nothing; on open strip it jumps */
      if (d.mode !== "new") return;
      if (win.kind === "term") { send({ kind: "term", year: termAt(x).year, a: 0, b: 0 }, "jump"); return; }
      const w = wb - wa, a = clamp(x - w / 2, lo, hi - w);
      send({ ...win, kind: win.kind === "all" ? "custom" : win.kind, a, b: a + w }, "jump");
      return;
    }
    if (d.mode === "move" && d.kind === "term") {
      const p = pend.current || win;
      send({ kind: "term", year: termAt((p.a + Math.min(p.b, hi)) / 2).year, a: 0, b: 0 }, "end");
      return;
    }
    send(pend.current || { ...win, kind: "custom" }, "end");
  };
  const onCancel = () => {
    const d = drag.current;
    drag.current = null;
    if (d && d.moved) send(pend.current || win, "end");
  };
  const cursor = drag.current ? (drag.current.mode === "move" ? "grabbing" : drag.current.mode === "new" ? "col-resize" : "ew-resize")
    : hov === "move" ? "grab" : hov === "l" || hov === "r" ? "ew-resize" : "pointer";
  const clipId = "cstrip" + React.useId().replace(/[^a-zA-Z0-9_-]/g, "");
  return (
    <div className="rd-cstrip" ref={box}>
      <svg ref={svgRef} width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="rd-cstrip-svg" style={{ cursor }}
           role="img" aria-label={label + ": the whole record, " + Math.floor(lo) + " to now, with the window marked; drag the window to move it, its edges to resize it"}
           onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onCancel}
           onPointerLeave={() => { if (!drag.current) setHov(null); }}>
        <defs>
          <clipPath id={clipId}><rect x={xa} y={0} width={Math.max(0, xb - xa)} height={H} /></clipPath>
        </defs>
        {years.map((y) => <line key={"g" + y} x1={sx(y)} x2={sx(y)} y1={SPARK_T} y2={BAND_Y + BAND_H} className="rd-cstrip-grid" />)}
        {lines.map((l, i) => <path key={"l" + i} d={path(l.points)} className="rd-cstrip-line" />)}
        <g clipPath={`url(#${clipId})`}>
          {lines.map((l, i) => <path key={"w" + i} d={path(l.points)} className="rd-cstrip-line on" style={l.color ? { stroke: l.color } : null} />)}
        </g>
        {blocks.map((bk, i) => {
          const x0 = sx(bk.a), x1 = sx(bk.b), nm = blockName(bk);
          return (
            <g key={"b" + i} className={"rd-cstrip-gov " + bk.gov}>
              <rect x={x0 + (i ? 0.5 : 0)} y={BAND_Y} width={Math.max(0, x1 - x0 - (i ? 1 : 0))} height={BAND_H} />
              {nm && <text x={(x0 + x1) / 2} y={BAND_Y + BAND_H / 2 + 0.5} dominantBaseline="middle" textAnchor="middle">{nm}</text>}
            </g>
          );
        })}
        {years.map((y) => (
          <text key={"y" + y} x={sx(y)} y={H - 3} textAnchor={sx(y) < 16 ? "start" : sx(y) > W - 16 ? "end" : "middle"} className="rd-cstrip-yr">{y}</text>
        ))}
        {/* the world outside the window recedes under the card's own ground */}
        <rect x={0} y={0} width={Math.max(0, xa)} height={BAND_Y + BAND_H} className="rd-cstrip-veil" />
        <rect x={xb} y={0} width={Math.max(0, W - xb)} height={BAND_Y + BAND_H} className="rd-cstrip-veil" />
        <rect x={xa} y={0.75} width={Math.max(2, xb - xa)} height={BAND_Y + BAND_H - 1.5} rx={3} className="rd-cstrip-win" />
        {xb - xa > 14 && <>
          <rect x={xa - 3} y={(BAND_Y + BAND_H) / 2 - 8} width={6} height={16} rx={3} className="rd-cstrip-grip" />
          <rect x={xb - 3} y={(BAND_Y + BAND_H) / 2 - 8} width={6} height={16} rx={3} className="rd-cstrip-grip" />
        </>}
      </svg>
    </div>
  );
}

/* ======== the "Inflation & growth" view of Economic sentiment =========
   D.macro (gen-data §5m ← .build/macro.mjs ← the ABS and OECD data APIs),
   set out as five small charts that share the window, each asking one
   question with Australia in colour and the OECD in grey:
     Inflation                 – ABS headline CPI, annual change (the
                                 quarterly index-derived series before the
                                 monthly CPI era, spliced where the printed
                                 monthly measure begins), the OECD-wide
                                 average and the member countries' median;
                                 the RBA's 2–3% band shaded from August
                                 1996, when the target was adopted (the
                                 same start the deviation lane keeps)
     Inflation against target  – Australia's CPI minus the band's 2.5%
                                 midpoint beside the median OECD member's
                                 distance off its own central bank's target
     Growth per person         – real GDP per person and real net national
                                 disposable income per person (annual
                                 change) and real household disposable income
                                 per person, beside the OECD's real GDP per
                                 person (its household dashboard index, 2008→)
     Unemployment              – the ABS's monthly seasonally adjusted rate,
                                 a level rather than an annual change
     Income inequality         – the Gini coefficient of equivalised
                                 disposable household income: HILDA's
                                 annual series and the ABS income survey's
                                 (to 2019-20), two lines never joined; no
                                 OECD line (the OECD prints no OECD-wide
                                 Gini)
   Nine lanes on one plot had them knotted together; four small plots of
   one to three lines each read at a glance, and their shared x window
   lines a month up down each column. Australian prints are dots in a
   term-length window (each one a published figure); longer windows draw
   the joined lines alone. No smoothing, no adjustment, nothing estimated
   — published prints, index-derived annual changes and the computed
   deviation figures, joined as-is. */
const MACRO_RBA_FROM = 1996 + 7 / 12;   // Aug 1996, the Statement on the Conduct of Monetary Policy
let MACRO_CACHE = null;
function macroData(D) {
  const M = D.macro;
  if (!M || !M.cpi || !M.cpiMonthly || !M.gdppc) return null;
  if (MACRO_CACHE && MACRO_CACHE.M === M) return MACRO_CACHE;
  const qName = (iso) => ({ "03": "March", "06": "June", "09": "September", "12": "December" })[iso.slice(5, 7)] + " quarter " + iso.slice(0, 4);
  const moName = (iso) => window.AP.monthLabelFull(iso.slice(0, 7));
  const mk = (rows, quarterly) => rows.map((r) => ({ x: confIsoX(r.date), y: r.v, ym: r.date.slice(0, 7), dateIso: r.date,
    when: quarterly === "a" ? r.date.slice(0, 4) : (typeof quarterly === "function" ? quarterly(r) : quarterly) ? qName(r.date) : moName(r.date) }));
  /* the CPI lane's deep splice: quarterly index-derived rows up to the
     printed monthly series' first row, then the printed monthly rows */
  const mo = M.cpiMonthly.rows;
  const cut = mo.length ? confIsoX(mo[0].date) : Infinity;
  const cpiRows = M.cpi.rows.filter((r) => confIsoX(r.date) < cut).concat(mo);
  const lane = (k, rows, o) => (rows && rows.length ? { k, ...o, latest: rows[rows.length - 1], pts: mk(rows, o.q) } : null);
  /* the per-person levels: the ABS prints dollars a quarter; drawn at the
     annual rate (x4, the usual reading of a seasonally adjusted quarter)
     in thousands, so the y ruler keeps the percent charts' tick steps */
  const lvl = (k, rows, o) => lane(k, rows && rows.map((r) => ({ date: r.date, v: r.v * 4 / 1000 })), o);
  /* the Gini lanes ride ×100 so the y engine's tick steps (0.5, 1, 2…)
     land on hundredths of the coefficient; each is named by its calendar
     scheme — the Australian surveys in financial years ("2022–23"), the
     OECD median in calendar years */
  const fyName = (iso) => (+iso.slice(0, 4) - 1) + "–" + iso.slice(2, 4);
  const gini = (k, rows, o) => {
    const l = lane(k, rows && rows.map((r) => ({ date: r.date, v: r.v * 100 })), o);
    if (l) l.pts.forEach((q) => { q.when = o.cal ? q.dateIso.slice(0, 4) : fyName(q.dateIso); });
    return l;
  };
  const L = {
    cpi: lane("cpi", cpiRows, { name: "Australia", color: "var(--macro-cpi)", au: true, q: (r) => confIsoX(r.date) < cut }),
    oecdCpi: M.oecdCpi && lane("oecdCpi", M.oecdCpi.rows, { name: "OECD average", color: "var(--ink-3)", q: false }),
    oecdCpiMed: M.oecdCpiMed && lane("oecdCpiMed", M.oecdCpiMed.rows, { name: "Median OECD country", color: "var(--ink-3)", dash: "1.5 3.2", q: false }),
    ausGap: M.ausGap && lane("ausGap", M.ausGap.rows, { name: "Australia", color: "var(--macro-cpi)", au: true, q: (r) => confIsoX(r.date) < cut }),
    oecdCpiGap: M.oecdCpiGap && lane("oecdCpiGap", M.oecdCpiGap.rows, { name: "Median OECD country", color: "var(--ink-3)", dash: "1.5 3.2", q: false }),
    gdppc: lane("gdppc", M.gdppc.rows, { name: "GDP per person", color: "var(--macro-gdppc)", au: true, q: true }),
    rnndi: M.rnndi && lane("rnndi", M.rnndi.rows, { name: "National income per person", color: "var(--macro-rnndi)", au: true, q: true }),
    hhdi: M.hhdi && lane("hhdi", M.hhdi.rows, { name: "Household income per person", color: "var(--macro-hhdi)", au: true, q: true }),
    oecdGdppc: M.oecdGdppc && lane("oecdGdppc", M.oecdGdppc.rows, { name: "OECD GDP per person", color: "var(--ink-3)", q: true }),
    gdppcLevel: M.gdppcLevel && lvl("gdppcLevel", M.gdppcLevel.rows, { name: "GDP per person", color: "var(--macro-gdppc)", au: true, q: true }),
    rnndiLevel: M.rnndiLevel && lvl("rnndiLevel", M.rnndiLevel.rows, { name: "National income per person", color: "var(--macro-rnndi)", au: true, q: true }),
    hhdiLevel: M.hhdiLevel && lvl("hhdiLevel", M.hhdiLevel.rows, { name: "Household income per person", color: "var(--macro-hhdi)", au: true, q: true }),
    unemp: M.unemp && lane("unemp", M.unemp.rows, { name: "Australia", color: "var(--macro-unemp)", au: true, q: false }),
    giniHilda: M.giniHilda && gini("giniHilda", M.giniHilda.rows, { name: "HILDA survey", src: "HILDA survey", color: "var(--macro-gini)", au: true, q: false }),
    giniSih: M.giniSih && gini("giniSih", M.giniSih.rows, { name: "ABS income survey", src: "ABS Survey of Income and Housing", color: "var(--macro-gini)", dash: "4 3", au: true, q: false }),
    prod: M.prod && lane("prod", M.prod.rows, { name: "GDP per hour worked", color: "var(--macro-prod)", au: true, q: true }),
    prodLevel: M.prodLevel && lane("prodLevel", M.prodLevel.rows, { name: "GDP per hour worked", color: "var(--macro-prod)", au: true, q: true }),
    aweReal: M.aweReal && lane("aweReal", M.aweReal.rows, { name: "Full-time adult weekly earnings", color: "var(--macro-awe)", au: true, q: false }),
    oecdGdpMed: M.oecdGdpMed && lane("oecdGdpMed", M.oecdGdpMed.rows, { name: "OECD median GDP per person", color: "var(--ink-3)", dash: "1.5 3.2", q: true }),
    oecdProdMed: M.oecdProdMed && lane("oecdProdMed", M.oecdProdMed.rows, { name: "OECD median per worker", color: "var(--ink-3)", dash: "1.5 3.2", q: true }),
    oecdWageMed: M.oecdWageMed && lane("oecdWageMed", M.oecdWageMed.rows, { name: "OECD median wage", color: "var(--ink-3)", dash: "1.5 3.2", q: "a" }),
    oecdUnempMed: M.oecdUnempMed && lane("oecdUnempMed", M.oecdUnempMed.rows, { name: "OECD median", color: "var(--ink-3)", dash: "1.5 3.2", q: false }),
    oecdGiniMed: M.oecdGiniMed && gini("oecdGiniMed", M.oecdGiniMed.rows, { name: "OECD median country", src: "OECD income distribution file", color: "var(--ink-3)", dash: "1.5 3.2", cal: true }),
  };
  const P = [
    { id: "infl", title: "Inflation", sub: "Consumer prices, % change on a year earlier",
      copyTitle: "Inflation in Australia and across the OECD", lanes: [L.cpi, L.oecdCpi, L.oecdCpiMed], rba: true, zero: true },
    { id: "gap", title: "Inflation against target", sub: "Points above (+) or below (−) the central bank’s target",
      copyTitle: "Inflation against target: Australia and the median OECD country", lanes: [L.ausGap, L.oecdCpiGap], zero: "On target" },
    { id: "grow", title: "Growth per person", sub: "Real, % change on a year earlier",
      copyTitle: "Real growth per person in Australia, and the OECD’s", lanes: [L.gdppc, L.rnndi, L.hhdi, L.oecdGdppc, L.oecdGdpMed], zero: true,
      /* the three Australian series as dollars rather than their annual
         change (the panel's Increase / Actual switch); the OECD's
         per-person figure is an index, not dollars, so it sits this out */
      level: L.gdppcLevel ? { sub: "Real dollars a year, in thousands, seasonally adjusted", money: true, zero: false,
        copyTitle: "Real output and income per person in Australia", lanes: [L.gdppcLevel, L.rnndiLevel, L.hhdiLevel].filter(Boolean) } : null },
    { id: "prod", title: "Productivity", sub: "GDP per hour worked, % change on a year earlier",
      copyTitle: "Productivity in Australia and across the OECD", lanes: [L.prod, L.oecdProdMed], zero: true,
      /* the ABS's own index numbers behind the rate — a flat line makes
         the flat decade visible in a way the rate's wiggle never does
         (user call 2026-11-16, "shouldn't productivity get its own
         chart… hard to see it has barely increased since 2016") */
      level: L.prodLevel ? { sub: "GDP per hour worked, index numbers (a quarterly reading, not yet a rate)", copyTitle: "GDP per hour worked in Australia", lanes: [L.prodLevel], idx: true, zero: false } : null },
    { id: "earn", title: "Earnings", sub: "Real earnings, % change on a year earlier",
      copyTitle: "Earnings growth in Australia and across the OECD", lanes: [L.aweReal, L.oecdWageMed], zero: true },
    { id: "unemp", title: "Unemployment", sub: "% of the labour force, seasonally adjusted",
      copyTitle: "Unemployment in Australia and across the OECD", lanes: [L.unemp, L.oecdUnempMed], zero: false },
    /* income inequality: two surveys' Gini coefficients, kept as two lines
       (the ABS's own runs about 0.02 above HILDA's, so splicing them would
       invent a jump), beside the OECD member countries' own median; the
       surveys are annual and two-yearly, years behind the other
       panels, so every survey year is a dot and a window holding none
       says where the latest stands */
    { id: "gini", title: "Income inequality", sub: "Gini coefficient of household income after tax, adjusted for household size",
      copyTitle: "Income inequality: Gini coefficients in Australia and across the OECD", lanes: [L.giniHilda, L.giniSih, L.oecdGiniMed], zero: false, gini: true },
  ].map((p) => ({ ...p, lanes: p.lanes.filter(Boolean) })).filter((p) => p.lanes.length);
  const lo = L.cpi.pts[0].x;
  MACRO_CACHE = { M, L, P, lo, cut };
  return MACRO_CACHE;
}
/* the strip's line for the macro view: headline inflation, every year on file */
const macroStripLines = (D) => { const md = macroData(D); return md ? [{ points: md.L.cpi.pts }] : []; };

/* one small chart: header (name, measure, the lanes' latest prints as a
   coloured key) over its plot. evMode says what it does with the
   window's events: "badge" numbers them over the plot (the sitting
   term's, on the first row - a half-width chart has no room for their
   names, which the list under the row carries), "rule" keeps the bare
   rules, lined up under the numbered ones down each column (and a longer
   window's elections, on every chart). A first-row chart keeps the badge
   row's height in every window (`top`), so a step never shifts the grid.
   `ctl` hands one chart the list's open event; the others keep their own. */
function RdMacroPanel({ p: p0, win, dragging, narrow, union, evs, evMode, top, ctl, evtOpen, setEvtOpen, xTicks, span, years, nowX }) {
  /* Increase / Actual: a panel carrying a `level` twin swaps its lanes,
     measure line and copy for the twin's, keeping its title and place */
  const [actual, setActual] = useState(false);
  const p = actual && p0.level ? { ...p0, ...p0.level } : p0;
  const money = !!p.money;
  const ndx = !!p.idx;
  const inW = (q) => q.x >= win.a && q.x <= win.b;
  const gin = !!p.gini;
  const dotsOn = win.b - win.a <= 4.6 || gin;
  const vals = [];
  p.lanes.forEach((l) => l.pts.forEach((q) => { if (inW(q)) vals.push(q.y); }));
  /* a Gini window holding no survey year (the surveys run years behind)
     keeps the scale of the latest years on file and says so on the plot */
  const giniEmpty = gin && !vals.length;
  if (giniEmpty) p.lanes.forEach((l) => l.pts.slice(-4).forEach((q) => vals.push(q.y)));
  if (p.rba && win.b > MACRO_RBA_FROM) vals.push(2, 3);
  if (p.zero) vals.push(0);
  const ny = confNiceY(vals.length ? vals : [0, 1], gin ? 4 : 2);
  const yd = useConfChase([ny.lo, ny.hi], dragging);
  const PCT = (v) => (v < 0 ? "−" : "") + Math.abs(v).toFixed(1);
  /* money lanes ride in thousands of dollars a year */
  const USD = (v) => "$" + Math.round(v * 1000).toLocaleString("en-AU");
  /* Gini lanes ride ×100; printed back at the ABS's three decimals */
  const GINI = (v) => (v / 100).toFixed(3);
  const series = p.lanes.map((l) => ({
    id: p.id + "-" + l.k, label: l.name, color: l.color, rdWidth: l.au ? 2.1 : 1.5, dash: l.dash,
    /* a survey line holds no figure between its survey years, so the
       Gini lanes answer the hover only at a survey year */
    smooth: false, endCap: false, interpHover: !gin, points: l.pts,
  }));
  /* every Australian print is a dot in a term-length window, gathered
     over the window being left as well as the one arriving so a step's
     glide carries its dots in and out with the lines */
  const scatter = dotsOn ? p.lanes.filter((l) => l.au).flatMap((l) => l.pts
    .filter((q) => q.x >= union[0] && q.x <= union[1])
    .map((q) => ({ x: q.x, y: q.y, color: l.color, label: l.name, meta: { pollster: l.src || "ABS", dateLabel: q.when } }))) : [];
  /* the hover spine: the first lane's prints; the Gini panel's two
     surveys start years apart, so it takes every survey year of both */
  const spineAll = gin
    ? [...new Map(p.lanes.flatMap((l) => l.pts).sort((a, b) => a.x - b.x).map((q) => [q.x, q])).values()]
    : p.lanes[0].pts;
  const spine = spineAll.filter((q) => q.x >= win.a - 0.3 && q.x <= win.b + 0.3);
  const areas = p.rba ? [{ id: "rba-" + p.id, className: "rba-band", color: "var(--macro-cpi)", opacity: 0.08, edge: false, smooth: false,
    points: [{ x: MACRO_RBA_FROM, y0: 2, y1: 3 }, { x: nowX + 4, y0: 2, y1: 3 }] }] : [];
  const refLines = p.zero && yd[0] < 0 && yd[1] > 0
    ? [{ y: 0, label: typeof p.zero === "string" ? p.zero : undefined, align: "left", color: "var(--ink-3)" }] : [];
  /* the band's own name, inside it at its left end, where the band is
     tall enough to hold a line of type */
  const lastGini = gin ? p.lanes.map((l) => l.pts[l.pts.length - 1]).sort((a, b) => b.x - a.x)[0] : null;
  const notes = p.rba && win.b > MACRO_RBA_FROM + 0.4 && ny.hi - ny.lo <= 12
    ? [{ x: Math.max(win.a, MACRO_RBA_FROM), dx: 6, y: 2.5, baseline: "middle", text: "RBA target", anchor: "start", color: "var(--ink-3)", weight: 500, size: 11.5 }]
    : giniEmpty && lastGini
      ? [{ x: (win.a + win.b) / 2, y: (ny.lo + ny.hi) / 2, baseline: "middle", anchor: "middle", color: "var(--ink-3)", weight: 500, size: 12.5,
          text: "No survey year in this window: the latest is " + lastGini.when }]
      : [];
  const named = evMode === "badge";
  const hPx = (narrow ? 196 : 212) + (top ? 22 : 0);
  const pad = { l: narrow ? 32 : 34, r: 14, t: top ? 34 : narrow ? 12 : 14, b: 28 };
  const latestTxtOf = (q) => (l) => (q.money ? USD(l.latest.v) : q.idx ? PCT(l.latest.v) : q.gini ? GINI(l.latest.v) + " (" + l.pts[l.pts.length - 1].when + ")" : PCT(l.latest.v) + "%");
  const latestTxt = latestTxtOf(p);
  const subKey = (q) => (
    <>
      <p className="rd-mp-s">{q.sub}</p>
      <ul className="rd-mp-key">
        {q.lanes.map((l) => (
          <li key={l.k} className={l.au ? "au" : ""}>
            <RdSwatch kind={l.dash ? "dash" : "line"} color={l.color} />
            <span className="rd-mp-kn" style={l.au ? { color: "color-mix(in oklch, " + l.color + " 62%, var(--ink))" } : null}>{l.name}</span>
            <span className="rd-mp-kv">{latestTxtOf(q)(l)}</span>
          </li>
        ))}
      </ul>
    </>
  );
  const auLatest = p.lanes.find((l) => l.au);
  const L0 = (q, k) => { const l = q.lanes.find((x) => x.k === k); return l ? latestTxtOf(q)(l) : null; };
  const when = auLatest ? auLatest.pts[auLatest.pts.length - 1].when : "";
  return (
    <div className={"rd-mp rd-mp-" + p.id}>
      <div className="rd-mp-h">
        {p0.level
          ? <div className="rd-mp-tr">
              <h4 className="rd-mp-t">{p.title}</h4>
              <span className="rd-chips rd-mp-mode" role="group" aria-label={p.title + ": show"}>
                <button type="button" className="rd-chip" aria-pressed={!actual} onClick={() => setActual(false)}>Increase</button>
                <button type="button" className="rd-chip" aria-pressed={actual} onClick={() => setActual(true)}>Actual</button>
              </span>
            </div>
          : <h4 className="rd-mp-t">{p.title}</h4>}
        {p0.level
          /* both modes' measure line and key laid over each other, the
             idle one hidden, so the switch never changes the header's
             height (three keys wrap where two don't) */
          ? <div className="rd-mp-twin">
              {[p0, { ...p0, ...p0.level }].map((q, i) => (
                <div key={i} className={(i === 1) === actual ? "on" : "off"} aria-hidden={(i === 1) !== actual}>{subKey(q)}</div>
              ))}
            </div>
          : subKey(p)}
      </div>
      <TrendChart heightPx={hPx} padPx={pad}
        xDomain={[win.a, win.b]} yDomain={yd} yTicks={confTicksIn(yd, ny.step)}
        yTickFmt={money ? (v) => String(v) : gin ? (v) => (v / 100).toFixed(Number.isInteger(+v.toFixed(6)) ? 2 : 3) : (v) => (v < 0 ? "−" : "") + Math.abs(v)}
        xTicks={xTicks} baseline driven={dragging}
        refLines={refLines} areas={areas} notes={notes} series={series} spine={spine}
        events={named ? evs : []}
        evt={named && ctl ? evtOpen : undefined} onEvt={named && ctl ? setEvtOpen : undefined}
        vlines={evMode === "rule" ? evs.map((e) => ({ x: e.x, cls: "rd-conf-evrule" })) : []}
        scatter={scatter}
        tooltipTitle={(i) => (spine[i] ? spine[i].when : "")}
        fmt={money ? USD : gin ? GINI : ndx ? (v) => PCT(v) : (v) => PCT(v) + (p.id === "gap" ? " pts" : "%")}
        copy={{
          title: p.copyTitle, span: years,
          sub: p.sub + ". " + span + ". " + (gin ? "Latest: HILDA " + (L0(p, "giniHilda") || "—") + "; ABS " + (L0(p, "giniSih") || "—") + "; OECD median " + (L0(p, "oecdGiniMed") || "—") : "Latest Australian print: " + (auLatest ? latestTxt(auLatest) + ", " + when : "")) + ".",
          caption: gin ? "The Gini coefficient of equivalised disposable household income — 0 if every household had the same income, 1 if one household had it all — as the ABS prints it. HILDA: the HILDA survey, every year from 2002–03 (the Melbourne Institute’s analysis for the ABS’s Measuring What Matters). ABS income survey: the Survey of Income and Housing, the official measure, run about every second year to 2019–20, with no next release scheduled; its income standards changed in 2007–08. The two surveys differ in level, so they are never joined. The dashed line is the median of the OECD member countries’ own Gini of disposable household income, computed here from the OECD’s income-distribution file — the OECD publishes no OECD-wide Gini." : "Official ABS and OECD series, as published and joined print to print — nothing smoothed, adjusted or estimated." + (p.rba ? " The shaded band is the Reserve Bank’s 2–3% inflation target, adopted in August 1996." : "") + (p.id === "grow" ? (money ? " Chain-volume dollars at the ABS’s reference-year prices, each quarter’s seasonally adjusted figure at its annual rate (four times the quarter)." : " The OECD’s own line is real GDP per person across the OECD, from its household dashboard index, which begins in 2007; the other dashed lines are medians computed here — the median member’s GDP-per-person growth, its GDP growth divided out by its population growth from the OECD’s growth and population files — never OECD-published aggregates.") + (p.lanes.some((l) => l.k === "hhdi" || l.k === "hhdiLevel") ? " Household income is the ABS’s household disposable income over its household consumption price deflator and population, worked out here (the ABS prints no real per-person figure)." : "") : "") + (p.id === "prod" ? (ndx ? " The ABS’s printed GDP-per-hour-worked index numbers, untouched — the Increase switch shows the same series as a rate of change." : " Australia’s line derives the ABS’s seasonally adjusted GDP-per-hour-worked index as an annual rate; the dashed line is the median of the OECD member countries’ printed output-per-WORKER growth, computed here — per worker for comparability, while the Australian line is per hour worked, and the OECD’s own file carries no per-hour median.") : "") + (p.id === "earn" ? " Australia’s line is the ABS’s full-time adult ordinary-time weekly earnings deflated by its own consumer price index — the ABS publishes no real print, so that is computed here — and the dashed line is the median of the OECD countries’ real average-wage year changes, a different measure and cadence (annual gross wages per employee at constant 2023 purchasing-power prices, computed here too)." : "") + (p.id === "unemp" ? " The dashed line is the median of the OECD member countries’ harmonised monthly rates, computed here from the OECD’s unemployment file." : ""),
          legend: p.lanes.map((l) => ({ label: l.name + " (latest " + latestTxt(l) + ")", color: l.color, kind: l.dash ? "dashed" : "line" })),
        }} />
    </div>
  );
}

function RdMacro({ win, dragging, terms, nowX, hi, strip }) {
  const { D } = window.AP;
  const narrow = useNarrow(MQ_PHONE);
  const md = macroData(D);
  const [evtOpen, setEvtOpen] = useState(null);
  const prevWin = React.useRef(win);
  React.useEffect(() => { prevWin.current = win; });
  if (!md) return null;
  const union = [Math.min(prevWin.current.a, win.a) - 0.1, Math.max(prevWin.current.b, win.b) + 0.1];
  const cur = terms.find((t) => t.current);
  const isCur = win.kind === "term" && cur && win.year === cur.year;
  /* the events: over the sitting term, the hero's set less the
     party-politics changes of hand (RdConfidence's own list) - the
     economy's events stay - numbered on the first row's charts (a phone's
     first chart), their names listed under that row, the other charts
     keeping the bare rules lined up under the numbers; a longer window's
     elections are bare rules on every chart (the strip under the grid
     names the governments between them) */
  const MACRO_ECONDS_OFF = ["2025-05-28", "2025-12-08", "2026-01-22", "2026-02-12"];
  const evs = isCur ? rdChartEvents(D.events, win.a, nowX).filter((e) => !MACRO_ECONDS_OFF.includes(e.date)) : confElectionEvents(win, terms);
  const badges = isCur && evs.length ? rdEventBadges("macro", evs, win.a, win.b) : null;
  const topN = narrow ? 1 : 2;
  const pickEv = (e) => { setEvtOpen((c) => (c && c.e === e ? c : { e })); rdEventReveal("evt-a-" + e.badgeKey); };
  const xTicks = confWinTicks(win, terms, nowX);
  const span = confWinSpan(win, terms, hi);
  const years = confWinYears(win, terms, hi);
  const exportCsv = () => {
    const rr = [["kind", "series", "date", "value"]];
    const SHEET = { cpi: "Headline inflation", cpiMonthly: "Headline inflation (monthly CPI)", ausGap: "Australia over its target", gdppc: "Real GDP per capita", rnndi: "Real net national disposable income per capita", hhdi: "Real household disposable income per capita (computed)", unemp: "Unemployment rate", oecdCpi: "OECD average inflation", oecdCpiMed: "OECD median inflation", oecdCpiGap: "Median deviation from inflation target", oecdGdppc: "OECD real GDP per capita", gdppcLevel: "Real GDP per capita (dollars a quarter)", rnndiLevel: "Real net national disposable income per capita (dollars a quarter)", hhdiLevel: "Real household disposable income per capita (dollars a quarter, 2023–24 prices, computed)", giniHilda: "Gini coefficient, equivalised disposable household income (HILDA survey)", giniSih: "Gini coefficient, equivalised disposable household income (ABS Survey of Income and Housing)", prod: "GDP per hour worked (annual change)", aweReal: "Real full-time adult ordinary-time weekly earnings (annual change, computed)", oecdGdpMed: "OECD median GDP per person (annual change, computed)", oecdUnempMed: "OECD median unemployment rate (computed)", oecdProdMed: "OECD median GDP per person employed (annual change, computed)", oecdWageMed: "OECD median real average wage (annual change, computed)", oecdGiniMed: "OECD median Gini coefficient, disposable household income (computed)" };
    for (const k of Object.keys(SHEET)) {
      const ln = D.macro[k];
      if (!ln) continue;
      for (const r of ln.rows) rr.push(["series", SHEET[k], r.date, r.v]);
    }
    confDownloadCsv(`auspol-tracker-macro-${D.latest.updatedISO}.csv`, rr);
  };
  return (
    <div className="card rd-card rd-confidence-chart rd-macro-card">
      <div className="rd-mp-grid">
        {md.P.map((p, i) => {
          const top = i < topN;
          const evMode = top && badges ? "badge" : "rule";
          return (
            <React.Fragment key={p.id}>
              <RdMacroPanel p={p} win={win} dragging={dragging} narrow={narrow} union={union}
                            evs={evMode === "badge" ? badges.events : evs} evMode={evMode} top={top} ctl={i === 0}
                            evtOpen={evtOpen} setEvtOpen={setEvtOpen} xTicks={xTicks}
                            span={span} years={years} nowX={nowX} />
              {i === topN - 1 && badges && badges.list.length > 0 && (
                <div className="rd-mp-evrow">
                  {badges.list.length === 1
                    ? <RdEventList list={badges.list} onPick={pickEv} openKey={evtOpen && evtOpen.e ? evtOpen.e.badgeKey : null} />
                    : <details className="rd-evdrop rd-mp-evdrop">
                        <summary>The marked events</summary>
                        <RdEventList list={badges.list} onPick={pickEv} openKey={evtOpen && evtOpen.e ? evtOpen.e.badgeKey : null} />
                      </details>}
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
      {strip}
      <RdKey className="rd-ckey" items={[
        { kind: "line", color: "var(--ink-3)", label: "Joined official prints, nothing smoothed" },
        win.b - win.a <= 4.6 ? { kind: "dot", color: "var(--ink-3)", label: "One Australian print" } : null,
      ]}>
        <span className="rd-key-item"><span className="rd-cs-keyband rba" aria-hidden="true"><i></i></span>The RBA’s 2–3% inflation target (from Aug 1996)</span>
        {win.kind !== "term" && evs.length > 0 && <span className="rd-key-item"><span className="rd-cs-keyelec" aria-hidden="true"></span>A federal election</span>}
      </RdKey>
      <div className="rd-foot">
        <span className="rd-foot-text">Official ABS and OECD series, refreshed daily from their data APIs — a record, not an estimate.</span>
        <span className="rd-grow"></span>
        <button type="button" className="rd-how rd-confidence-csv" onClick={exportCsv}><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v12M12 15l-4-4M12 15l4-4M4 19h16"></path></svg> Source data, CSV</button>
      </div>
    </div>
  );
}

/* The macro view's head/dek from the payload (data-driven; null guard
   matches RdMacro's, so the tab never shows its copy without its data) */
function macroStory(D) {
  const M = D.macro;
  if (!M || !M.cpiMonthly || !M.gdppc) return null;
  const { monthLabelFull } = window.AP;
  const c = (M.cpiMonthly.rows || []).at(-1), g = (M.gdppc.rows || []).at(-1);
  if (!c || !g) return null;
  const oc = M.oecdCpi && M.oecdCpi.rows.length ? M.oecdCpi.rows.at(-1) : null;
  const om = M.oecdCpiMed && M.oecdCpiMed.rows.length ? M.oecdCpiMed.rows.at(-1) : null;
  const gp = M.oecdCpiGap && M.oecdCpiGap.rows.length ? M.oecdCpiGap.rows.at(-1) : null;
  const ag = M.ausGap && M.ausGap.rows.length ? M.ausGap.rows.at(-1) : null;
  const og = M.oecdGdppc && M.oecdGdppc.rows.length ? M.oecdGdppc.rows.at(-1) : null;
  const un = M.unemp && M.unemp.rows.length ? M.unemp.rows.at(-1) : null;
  const gh = M.giniHilda && M.giniHilda.rows.length ? M.giniHilda.rows.at(-1) : null;
  const pr = M.prod && M.prod.rows.length ? M.prod.rows.at(-1) : null;
  const aw = M.aweReal && M.aweReal.rows.length ? M.aweReal.rows.at(-1) : null;
  const gm = M.oecdGdpMed && M.oecdGdpMed.rows.length ? M.oecdGdpMed.rows.at(-1) : null;
  const um = M.oecdUnempMed && M.oecdUnempMed.rows.length ? M.oecdUnempMed.rows.at(-1) : null;
  const pm = M.oecdProdMed && M.oecdProdMed.rows.length ? M.oecdProdMed.rows.at(-1) : null;
  const wm = M.oecdWageMed && M.oecdWageMed.rows.length ? M.oecdWageMed.rows.at(-1) : null;
  const gi = M.oecdGiniMed && M.oecdGiniMed.rows.length ? M.oecdGiniMed.rows.at(-1) : null;
  const f = (v) => (Number.isInteger(Math.abs(v)) ? String(Math.abs(v)) : Math.abs(v).toFixed(1));
  const qName = (iso) => ({ "03": "March", "06": "June", "09": "September", "12": "December" })[iso.slice(5, 7)] + " quarter";
  const head = "Inflation runs at " + f(c.v) + "% a year; real GDP per person " + (g.v >= 0 ? "grows " : "shrinks ") + f(g.v) + "% a year.";
  const med = [];
  if (gm) med.push("GDP per person " + f(gm.v) + "% a year in the " + qName(gm.date));
  if (um) med.push("unemployment at " + f(um.v) + "%");
  if (pm) med.push("output per worker " + f(pm.v) + "% a year");
  if (wm) med.push("real wages " + f(wm.v) + "% a year for " + wm.date.slice(0, 4));
  if (gi) med.push("a Gini coefficient of " + gi.v.toFixed(3) + " for " + gi.date.slice(0, 4));
  const dek = "Headline inflation reads " + f(c.v) + "% for " + monthLabelFull(c.date.slice(0, 7))
    + " (the ABS's monthly CPI, annual change"
    + (ag ? (ag.v >= 0 ? ", " + f(ag.v) + " points above the RBA band's midpoint" : ", " + f(ag.v) + " points below the RBA band's midpoint") : "")
    + "); real GDP per person moved " + f(g.v) + "% apiece in the " + qName(g.date)
    + " on the year before, seasonally adjusted, chain-volume."
    + (pr ? " GDP per hour worked moved " + f(pr.v) + "% apiece in the " + qName(pr.date) + "." : "")
    + (aw ? " Real full-time adult weekly earnings " + (aw.v >= 0 ? "grew " : "fell ") + f(aw.v) + "% in the year to " + monthLabelFull(aw.date.slice(0, 7)) + ", the ABS's nominal print deflated by its own CPI." : "")
    + (oc ? " OECD-wide, inflation stands at " + f(oc.v) + "%" : "")
    + (om ? " (the median OECD country's at " + f(om.v) + "%" : "")
    + (gp ? (gp.v >= 0 ? ", running " + f(gp.v) + " points above its bank's target)" : ", running " + f(gp.v) + " points below its bank's target)") : "")
    + (og ? " and OECD-wide real GDP per person " + (og.v >= 0 ? "growing " : "shrinking ") + f(og.v) + "% a year" : "")
    + (oc || om || og ? "." : "")
    + (un ? " Unemployment stands at " + f(un.v) + "% for " + monthLabelFull(un.date.slice(0, 7)) + ", as printed." : "")
    + (gh ? " Income inequality, by the Gini coefficient, was " + gh.v.toFixed(3) + " in " + (+gh.date.slice(0, 4) - 1) + "–" + gh.date.slice(2, 4) + ", the latest HILDA survey year." : "")
    + (med.length ? " The medians of the OECD countries beside those figures: " + med.join("; ") + "." : "");
  return { head, dek };
}

/* ------------------------------------------------ Release calendar ----
   The confidence gauges' own calendar fold under this panel (user call
   2026-10-09: split out of the Latest-polls fold, which keeps polls and
   the Newgate/Ipsos monitors). The same machinery lists it as lists the
   polls calendar: gen-data mints each series' releases as a
   tracked:"confidence" cadence row, np-project's walk projects it, and
   this fold keeps ONLY those rows while the polls fold keeps everything
   but them. Month heads, date cells and the "Due, not yet recorded"
   lead-in are the polls fold's shapes, reused via the same rd-cal
   classes. */
const RD_CONF_CAL_DAYS = 62;
function RdConfCal() {
  const D = window.AUSPOL;
  const proj = window.AP && window.AP.nextPolls
    ? window.AP.nextPolls(null, { horizonDays: RD_CONF_CAL_DAYS, includeTracked: true })
    : { rows: [], t0: 0 };
  const { t0 } = proj;
  const rows = proj.rows.filter((r) => r.tracked === "confidence");
  if (!rows.length || !t0) return null;
  const DAY = 86400000;
  const WDs = (ms) => WD[new Date(ms).getUTCDay()].slice(0, 3);
  const dm = (ms) => { const d = new Date(ms); return d.getUTCDate() + " " + D.monthName(d.getUTCMonth() + 1); };
  const wdm = (ms) => WDs(ms) + " " + dm(ms);
  const when = (n) => (n === -1 ? "yesterday" : n < 0 ? -n + " days overdue" : n === 0 ? "today" : n === 1 ? "tomorrow" : "in " + n + " days");
  const irregular = (r) => r && r.cadence > 60;
  const over = [], items = [];
  const days = new Map();   /* a release date -> the series landing on it */
  rows.forEach((r) => {
    if (r.overdue) { over.push(r); return; }
    const me = { name: r.pollster, site: r.site, freq: r.cadence <= 10 ? "weekly" : "monthly" };
    if (r.loose && !irregular(r)) {
      items.push({ key: "w" + r.pollster, at: r.release - r.spread * DAY, close: r.release + r.spread * DAY, win: true, spread: r.spread, who: [me] });
    } else if (irregular(r)) {
      items.push({ key: "i" + r.pollster + "-" + (r.ahead || 0), at: r.release, irr: true, spread: r.spread, who: [me] });
    } else {
      const iso = new Date(r.release).toISOString().slice(0, 10);
      let e = days.get(iso);
      if (!e) { e = { key: "d" + iso, at: r.release, who: [] }; days.set(iso, e); items.push(e); }
      e.who.push(me);
    }
  });
  over.sort((a, b) => a.release - b.release);
  items.sort((a, b) => a.at - b.at);
  items.forEach((it) => {
    if (it.win) it.q = it.at <= t0 ? "open now" : "window";
    else if (it.irr) it.q = "give or take " + Math.round(it.spread) + " days";
    else if (it.at === t0) it.q = "today";
    else if (it.at === t0 + DAY) it.q = "tomorrow";
  });
  const months = [];
  items.forEach((it) => {
    const ym = new Date(it.at).toISOString().slice(0, 7);
    const g = months[months.length - 1];
    if (!g || g.ym !== ym) months.push({ ym, items: [it] });
    else g.items.push(it);
  });
  const spanTxt = (a, b) => {
    const A = new Date(a), B = new Date(b);
    return A.getUTCMonth() === B.getUTCMonth() ? A.getUTCDate() + "–" + dm(b) : dm(a) + "–" + dm(b);
  };
  const dateTxt = (it) => it.win ? spanTxt(it.at, it.close)
    : it.irr ? "About " + dm(it.at)
    : WDs(it.at) + " " + new Date(it.at).getUTCDate();
  const overTxt = (r) => r.loose && !irregular(r) ? spanTxt(r.release - r.spread * DAY, r.release + r.spread * DAY)
    : irregular(r) ? "About " + dm(r.release)
    : wdm(r.release);
  /* rd-cal-wi + rd-cal-wsep let the phone rung stack a merged day's
     series one per line (rd.css): the inline ", "-joined flow broke
     inside a long series name, stranding its first word one line up */
  const who = (w, i) => (
    <span key={String(i)} className="rd-cal-wi">{i > 0 ? <span className="rd-cal-wsep" aria-hidden="true">, </span> : null}{w.site
      ? <a href={w.site} target="_blank" rel="noopener noreferrer" title={"Where " + w.name + "’s next release lands first"}>{w.name}<span className="plink-mark" aria-hidden="true">↗</span></a>
      : w.name}<span className="rd-cal-track">{w.freq}</span></span>);
  return (
    <details className="rd-evdrop rd-cal rd-conf-cal">
      <summary>Release calendar</summary>
      <div className="rd-cal-body">
        {over.length > 0 && (
          <div className="rd-cal-sec rd-cal-sec-over">
            <h4 className="rd-cal-m">Due, not yet recorded</h4>
            <ul className="rd-cal-list">
              {over.map((r) => (
                <li key={r.pollster}>
                  <span className="rd-cal-d">{overTxt(r)}</span>
                  <span className="rd-cal-w">{who({ name: r.pollster, site: r.site, freq: r.cadence <= 10 ? "weekly" : "monthly" }, 0)}</span>
                  {r.missed && <span className="rd-cal-q">{when(r.closesIn)}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
        {months.map((g) => (
          <div className="rd-cal-sec" key={g.ym}>
            <h4 className="rd-cal-m">{rdMonthYear(g.ym)}</h4>
            <ul className="rd-cal-list">
              {g.items.map((it) => (
                <li key={it.key}>
                  <span className="rd-cal-d">{dateTxt(it)}</span>
                  <span className="rd-cal-w">{it.who.map((w, i) => who(w, i))}</span>
                  {it.q && <span className="rd-cal-q">{it.q}</span>}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="rd-note">The next editions of the four gauges charted above — ANZ–Roy Morgan’s and Westpac–MI’s consumer series, Roy Morgan’s and NAB’s business series — projected from each series’ own release rhythm, exactly as the Latest-polls calendar projects a pollster. A date is the earliest a release could land, never a promise; a series that misses its slot stays listed in the due lead-in until the release is recorded.</p>
    </details>
  );
}
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
    { k: "demosauConsumer", view: "consumer", s: M.demosauConsumer, name: "Consumers", dekName: "Consumers on DemosAU’s index", by: "DemosAU", hl: 60,
      period: "month", color: "var(--confidence-third)", dash: null, shift: 0, scale: 2, vfmt: (v) => v.toFixed(1),
      short: "DemosAU’s national consumer-sentiment index — 50 is neutral on DemosAU’s scale, so its lane is drawn doubled to sit on the 100-neutral line with the others. Prints and read rows keep the true figure." },
    { k: "business", view: "business", s: M.business, name: "Businesses", dekName: "Businesses", by: "Roy Morgan", hl: 60,
      period: "month", color: "var(--confidence-main)", dash: null, shift: 0, vfmt: (v) => v.toFixed(1),
      short: "Business confidence — how firms rate trading conditions and the year ahead. Monthly." },
    { k: "nabBusiness", view: "business", s: M.nabBusiness, name: "Businesses", dekName: "Businesses on NAB’s survey", by: "NAB", hl: 60,
      period: "month", color: "var(--confidence-alt)", dash: null, shift: 100, vfmt: NICE,
      short: "x" },
  ].filter((l) => l.s && l.s.polls.length);
  if (!lanes.length) return null;
  for (const l of lanes) l.lat = l.s.latest;
  /* the chart's display transforms: shift is additive (NAB's net balances
     ride +100), scale multiplicative (DemosAU's 50-neutral index is drawn
     doubled). Both commute through the linear kernel, so applying them to
     plotted points is identical to transforming the raw series first —
     and points carry `raw` so every tooltip and read row still prints the
     figure the house published. */
  const plotOf = (l, v) => (l.scale ? v * l.scale : v) + l.shift;
  /* the tabs over the chart open on the consumer lanes; each view draws
     only its own lanes, dots and domain */
  const [view, setView] = useState("consumer");
  /* the Inflation & growth tab joins the row when gen-data §5m's payload
     is on the page (absent for a BUILD_JUR build, and every confidence
     measure below guards it: viewLanes is empty on that view) */
  const views = D.macro ? RD_CONF_VIEWS.concat(MACRO_VIEW) : RD_CONF_VIEWS;
  const isMacro = view === "macro";
  /* hovering the panel hands the arrow keys to the Consumers/Businesses
     row (the claim never survives the pointer leaving the card), pinned
     through the crossfade exactly as the row's own pin does */
  useHoverClaim("confidence", true, null, (e) => {
    const ids = views.map((v) => v.id);
    const i = ids.indexOf(view);
    if (i < 0 || ids.length < 2) return false;
    const nxt = ids[(i + (e.key === "ArrowRight" ? 1 : -1) + ids.length) % ids.length];
    rdPinScroll(document.getElementById("confidence") && document.getElementById("confidence").querySelector(".rd-confidence-tabs"));
    setView(nxt);
    return true;
  }, [view]);
  const viewLanes = lanes.filter((l) => l.view === view);
  /* ---- the window (see the block over RdConfWinBar) ----------------------
     One window for the three views, held here so a tab switch keeps it.
     Every lane draws on the calendar: its live releases (the dots, and the
     recency-weighted smooth of them - run over the house's WHOLE release
     file, so a line never changes shape as the window pans) and, where the
     live file hasn't started, the house's own monthly history (gen-data
     §5l's D.confDeep) joining it into the past. A term window adds the
     band of the other terms behind it; the sitting term's is gen-data's
     §5k band of every past term. */
  const nowX = D.domain.x1;
  const TERMS = React.useMemo(() => confTermsOf(D), [D]);
  const curTerm = TERMS.find((t) => t.current) || TERMS[TERMS.length - 1];
  const [winS, setWinS] = useState(() => confTermWin(curTerm, nowX));
  const [dragging, setDragging] = useState(false);
  const onWin = React.useCallback((w, phase) => { setWinS(w); setDragging(phase === "drag"); }, []);
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
  /* each lane's three forms on the calendar, built once: the raw releases,
     their smooth, and the monthly history before the live file opens. The
     smooth runs over the history AND the releases (the history months on
     the same basis, gen-data §5l), so the first releases are read with the
     months before them rather than as an edge with nothing behind it - a
     one-sided kernel had Westpac–MI's line open five points under its own
     first print - and the history line runs on into the smooth's first
     point, so the two meet where the release file takes over. */
  const laneData = React.useMemo(() => new Map(lanes.map((l) => {
    const rawTag = (v) => ((l.shift || l.scale) ? { raw: v } : {});
    const raw = l.s.polls.map((p) => ({ x: p.x, y: plotOf(l, p.v), ym: p.ym, released: p.released, dateLabel: p.dateLabel || "", ...rawTag(p.v) }));
    /* where the release file takes over: the start of its STEADY run, not
       its first row. ANZ–Roy Morgan's file holds one December 2016 release
       and then nothing until mid-2019; taking over at the first row dropped
       the history's 2017–19 months and bridged the silence with one
       straight segment. Any gap over a quarter before the run settles
       hands those months back to the monthly history (the stray releases
       stay as dots); with no history to fall back on, every release
       counts. */
    const rows = D.confDeep && D.confDeep[l.k];
    const P = l.s.polls;
    let s0 = 0;
    if (rows && rows.length > 1) for (let i = 1; i < P.length; i++) if (P[i].x - P[i - 1].x > 0.25) s0 = i;
    const live = P.slice(s0);
    const live0 = live[0].x;
    const hist = rows && rows.length > 1
      ? rows.map((r) => ({ ym: r.ym, x: +r.ym.slice(0, 4) + (+r.ym.slice(5, 7) - 1) / 12, v: r.v })).filter((p) => p.x < live0)
      : [];
    const n0 = hist.length > 1 ? hist.length : 0;
    /* one smooth over the whole run: the history months are drawn through
       the same kernel as the releases, so the line means the same thing
       either side of where the release file takes over (raw tags keep the
       printed month, as the releases keep their prints) */
    const all = smooth((n0 ? hist : []).concat(live), l.hl);
    const se = all.slice(n0)
      .map((p, i) => ({ x: p.x, y: plotOf(l, p.y), ym: live[i].ym, ...rawTag(live[i].v) }));
    const deep = n0 ? all.slice(0, n0).map((p, i) => ({ ym: hist[i].ym, x: p.x, y: plotOf(l, p.y), ...rawTag(hist[i].v) })) : [];
    /* the joint: the history's line ends on the smooth's first point (a
       drawing point only - it carries no month, so the readout and the
       spine never land on it) */
    if (deep.length && se.length) deep.push({ x: se[0].x, y: se[0].y, joint: true, ...(se[0].raw != null ? { raw: se[0].raw } : {}) });
    return [l.k, { raw, se, deep, live0 }];
  })), [M]);
  /* the view's run: from its oldest monthly row (or first release) to now */
  const extOf = (v) => {
    if (v === "macro") { const md = macroData(D); return { lo: md ? md.lo : nowX - 1, hi: nowX }; }
    const ls = lanes.filter((l) => l.view === v);
    return { lo: Math.min(...ls.map((l) => { const d = laneData.get(l.k); return d.deep.length ? d.deep[0].x : d.live0; })), hi: nowX };
  };
  const ext = extOf(view);
  const vTerms = confViewTerms(TERMS, ext.lo, ext.hi);
  /* a term carried along the strip draws exactly where the strip holds it
     (its true width, even running on past now); anything else is clamped
     into this view's run */
  const win = winS.kind === "term-carry" ? { kind: "custom", a: Math.max(ext.lo, winS.a), b: winS.b }
    : confClampWin(winS, vTerms, ext.lo, ext.hi, nowX);
  /* a term window carried along the strip reads as the term under its
     centre (it snaps there on release) */
  const winShown = winS.kind === "term-carry" ? { ...win, kind: "term-carry", year: winS.year } : win;
  const isTerm = win.kind === "term";
  const winTerm = isTerm ? vTerms.find((t) => t.year === win.year) : null;
  const isCur = !!(winTerm && winTerm.current);
  const dotsOn = win.b - win.a <= 4.6;
  const prevWin = React.useRef(win);
  React.useEffect(() => { prevWin.current = win; });
  const union = [Math.min(prevWin.current.a, win.a) - 0.1, Math.max(prevWin.current.b, win.b) + 0.1];
  const inW = (p) => p.x >= win.a && p.x <= win.b;
  const neut = (l) => (100 - l.shift) / (l.scale || 1);   // the published-scale reading that sits on the 100 line
  const water = (l, v) => v < neut(l) ? "Pessimists lead" : "Optimists lead";
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
  /* the dek reads the sitting term, whatever window is open: its high/low
     reads are windowed on this term's election */
  const x0 = curTerm.a;
  const rows = new Map(lanes.map((l) => [l.k, l.s.polls.filter((p) => p.x >= x0)]));
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
  const dek = lanes.map(sent).join(" ");
  /* the macro tab swaps head and dek for the payload's own story */
  const mStory = isMacro ? macroStory(D) : null;
  /* the numbered events: the hero's set over the sitting term, less the
     party-politics changes of hand (both Coalition splits, Joyce to One
     Nation, Taylor's leadership) - the economy's events stay: the Hormuz
     blockade, the 2026 budget and the RBA's September hike all moved one
     or more of these gauges. Only the sitting term's window carries them;
     a longer window hangs its elections there instead. */
  const CONF_OFF = ["2025-05-28", "2025-12-08", "2026-01-22", "2026-02-12"];
  /* a window holding more than six elections keeps them as bare rules:
     names over every one of them ran end to end across the top */
  const elecEvs = isCur ? [] : confElectionEvents(win, vTerms);
  const elecRules = elecEvs.length > 6;
  const evs = isCur ? rdChartEvents(D.events, win.a, nowX).filter((e) => !CONF_OFF.includes(e.date)) : elecRules ? [] : elecEvs;
  const badges = isCur && narrow ? rdEventBadges("confidence", evs, win.a, win.b) : null;
  /* the phone list under the chart opens an event's panel by tapping its
     number; a tap on another number hands the panel over, and an event that
     leaves the window is put away by the chart's own reconciliation */
  const [evtOpen, setEvtOpen] = useState(null);
  const pickEv = (e) => { setEvtOpen((cur) => (cur && cur.e === e ? cur : { e })); rdEventReveal("evt-a-" + e.badgeKey); };
  /* ---- past terms: the band, its average, and the drawn lines --------
     A straight lift of the past-cycles ribbon (its comment stands at the
     top of the file's History section): the middle half fills heavy, the
     middle 80% fills light, stretches built from fewer than three-quarters
     of the terms go fainter by class, and each term can be drawn as its
     own line. Only the view's MAIN gauge carries a band – §5k ships
     consumer history for the consumer view, business for the business one
     (NAB 1997- but a deviation series - never banded). A term window lines
     the band up on ITS election: the sitting term's is §5k's band of every
     past term; a past term's is the same pooling over the OTHER terms
     (confBand below, gen-data's rule: three terms standing at a month).
     Westpac–MI's 1974- file never bands either, but its terms ship so a
     drawn consumer term carries Westpac–MI's same year as a dotted gold
     twin. */
  const HIST = D.confHistory || null;
  const histLane = view === "consumer" ? "consumer" : "business";
  const hset = HIST && HIST[histLane] && Array.isArray(HIST[histLane].terms) && HIST[histLane].terms.length ? HIST[histLane] : null;
  const histTerms = hset ? hset.terms : [];
  const bandPool = !isTerm || !hset ? [] : isCur ? histTerms : histTerms.filter((t) => t.year !== win.year);
  const bandRows = !isTerm || !hset ? null
    : isCur ? (hset.band && hset.band.length ? hset.band : null)
    : confBand(bandPool);
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
  /* the band rides the window's election: month m sits at a + m/12 */
  const mX = (m) => win.a + m / 12;
  let bandAreas = null;
  if (bandRows) {
    const floor = Math.max(3, Math.ceil(bandPool.length * 0.75));
    const segs = [];
    bandRows.forEach((r, i) => {
      const thin = r.n < floor;
      const last = segs[segs.length - 1];
      if (!last || last.thin !== thin) segs.push({ thin, pts: i ? [bandRows[i - 1], r] : [r] });
      else last.pts.push(r);
    });
    /* the weight lives in rd.css (.conf-band), not the inline fallbacks
       below, so the fills carry a heavier tint in dark; a thinned stretch
       asks by CLASS, exactly as the cycles band does */
    bandAreas = segs.filter((s) => s.pts.length > 1).flatMap((s, i) => [
      { id: "conf-band-lo" + i, className: "conf-band lo" + (s.thin ? " thin" : ""),
        color: "var(--ink-3)", opacity: 0.07, edge: false,
        points: s.pts.map((r) => ({ x: mX(r.m), y0: r.p10, y1: r.p90 })) },
      { id: "conf-band-hi" + i, className: "conf-band hi" + (s.thin ? " thin" : ""),
        color: "var(--ink-3)", opacity: 0.13, edge: false,
        points: s.pts.map((r) => ({ x: mX(r.m), y0: r.q1, y1: r.q3 })) },
    ]);
  }
  const meanSeries = bandRows ? {
    id: "conf-band-mean", label: isCur ? "Mean of past terms" : "Mean of the other terms", color: "var(--ink-2)",
    rdWidth: 1.9, opacity: 0.85, dash: "2 3.4", smooth: false, endCap: false,
    interpHover: true, points: bandRows.map((r) => ({ x: mX(r.m), y: r.mean })),
  } : null;
  /* a lifted term renders exactly as the current lines do - its monthly
     term file through the same kernel smooth (TERM_HL, the monthly
     gauges' half-life: term rows are monthly reads, never the weekly
     index's 14-day one), then the engine's monotone path - and DOTTED,
     every lifted line regardless of view or gauge, in its house's
     colour (--confidence-main for the view's main gauge, --confidence-alt
     for the Westpac–MI twin), lined up on the open term's election. The
     twin never asks for the end label - the year names the pair once. */
  const TERM_HL = 60;
  const termSpan = (win.b - win.a) * 12;
  const drawable = histTerms.filter((t) => !(isTerm && t.year === win.year));
  const drawnSeries = !isTerm ? [] : drawable.filter((t) => lifted.has(t.year)).flatMap((t) => {
    const pts = (term) => {
      const raw = [];
      term.v.forEach((v, m) => { if (v != null) raw.push({ x: m / 12, v }); });
      return smooth(raw, TERM_HL).map((p) => ({ x: win.a + p.x, y: p.y })).filter((p) => (p.x - win.a) * 12 <= termSpan + 0.01);
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
  /* ---- the drawing -------------------------------------------------------
     Each lane: its monthly history (the house's own file, through the
     same smooth) where the live file hasn't begun, then the smoothed releases. The two
     share a lane's name, so the readout carries one row per house; the end
     name rides whichever form reaches the window's right edge. Dots - one
     per release - draw in a term-length window only, gathered over the
     window being left as well as the one arriving, so a step's glide
     carries them in and out with the lines. */
  const chartSeries = [];
  viewLanes.forEach((l) => {
    const d = laneData.get(l.k);
    const histEnd = win.b < d.live0;
    if (d.deep.length) chartSeries.push({ id: "deep-" + l.k, label: l.by, color: l.color, rdWidth: 1.6, opacity: 0.8,
      smooth: false, endCap: false, endAtWin: true, interpHover: true, endLabel: !narrow && histEnd ? l.by : null, points: d.deep });
    chartSeries.push({ id: l.k, label: l.by, color: l.color, rdWidth: l.dash ? 1.6 : 2.2, dash: l.dash || undefined,
      /* the monthly lane's prints land on the weekly lane's spine by luck
         alone - ride the line between its own prints instead */
      interpHover: true, endCap: false, endAtWin: true, endLabel: narrow || histEnd ? null : l.by, points: d.se });
  });
  if (meanSeries) chartSeries.push(meanSeries);
  chartSeries.push(...drawnSeries);
  const chartDots = dotsOn ? viewLanes.flatMap((l) => laneData.get(l.k).raw
    .filter((q) => q.x >= union[0] && q.x <= union[1])
    .map((q) => ({ x: q.x, y: q.y, color: l.color, label: l.by, ...(q.raw != null ? { raw: q.raw } : {}), meta: { pollster: l.by, released: q.released, dateLabel: q.dateLabel } }))) : [];
  /* the y window: what the window shows, plus the neutral line, on tens */
  const vals = [100];
  viewLanes.forEach((l) => {
    const d = laneData.get(l.k);
    d.se.forEach((p) => { if (inW(p)) vals.push(p.y); });
    d.deep.forEach((p) => { if (inW(p)) vals.push(p.y); });
    if (dotsOn) d.raw.forEach((p) => { if (inW(p)) vals.push(p.y); });
  });
  if (bandRows) bandRows.forEach((r) => { if (mX(r.m) <= win.b) vals.push(r.p10, r.p90, r.mean); });
  drawnSeries.forEach((s) => s.points.forEach((p) => vals.push(p.y)));
  /* tens, or twenties on a window as tall as NAB's 2020 collapse */
  const yStep = Math.max(...vals) - Math.min(...vals) > 76 ? 20 : 10;
  const lo = Math.floor((Math.min(...vals) - 2) / yStep) * yStep, hi = Math.ceil((Math.max(...vals) + 2) / yStep) * yStep;
  const yd = useConfChase([lo, hi], dragging && !isMacro);
  /* the hover spine pairs the monthly history's months with the main
     lane's release dates, so the guide lands a monthly reading where the
     live file hasn't started, and every release where it has */
  const spine = isMacro ? [] : [...new Map(viewLanes.flatMap((l) => laneData.get(l.k).deep.filter((p) => !p.joint))
    .concat(viewLanes[0] ? laneData.get(viewLanes[0].k).raw : [])
    .filter((p) => p.x >= win.a - 0.1 && p.x <= win.b + 0.1)
    .map((p) => [p.x, p])).values()].sort((a, b) => a.x - b.x);
  const histInWin = viewLanes.some((l) => laneData.get(l.k).deep.some(inW));
  const copyLegend = viewLanes.map((l) => ({ label: l.by + " (latest " + l.vfmt(l.lat.v) + ")", color: l.color, kind: l.dash ? "dashed" : "line" }));
  const fmt = (v, p) => (p && p.raw != null ? NICE(p.raw) : v.toFixed(1));
  const span = confWinSpan(win, vTerms, ext.hi);
  /* the per-view copy: ptitles, the key's dash note and the copy card all
     speak only for the view's own pair */
  const vc = view === "consumer" ? {
    title: "Consumer confidence",
    note: "100 = neutral; DemosAU’s 50-neutral index is drawn doubled",
    altKey: "Westpac–MI’s monthly read; DemosAU’s national index, drawn doubled",
    copyTitle: "Consumer confidence (three gauges)",
    copySub: head + " Three published consumer gauges on one 100-neutral scale: the weekly ANZ–Roy Morgan consumer confidence index, Westpac–MI’s monthly consumer sentiment, and DemosAU’s national consumer-sentiment index, drawn doubled.",
    copyCaption: "Each dot is one release, as the house printed it; each line is a recency-weighted smooth of those readings (half-life 14 days on the weekly ANZ–Roy Morgan index, 60 days on the monthly series). Before the live release files begin, the lines run on through the houses’ own monthly history files, smoothed the same way — ANZ–Roy Morgan from 1973, Westpac–MI from 1974. DemosAU prints to a 50-neutral scale, so its lane is drawn doubled to share the neutral line while read rows, tooltips and this caption carry each house’s own figures. In a term the band pools the ANZ–Roy Morgan index over the other terms, each smoothed like the lines and lined up on its own election month — the middle half and the middle 80% of them, their average the dashed line; a drawn term is its monthly series, smoothed at the monthly gauges’ 60-day half-life and dotted in its house’s colour. No combining, no adjustment.",
  } : {
    title: "Business confidence",
    note: "100 = neutral on the index; NAB’s net balance drawn 100 points up",
    altKey: "NAB’s net-balance read, drawn 100 points up",
    copyTitle: "Business confidence (two gauges)",
    copySub: head + " Two published business gauges on one 100-neutral scale: Roy Morgan’s monthly business confidence index and NAB’s Monthly Business Survey.",
    copyCaption: "Each dot is one release, as the house printed it; each line is a recency-weighted smooth of those readings (60-day half-life on both monthly series). Before the live release files begin, the lines run on through the houses’ own monthly history, smoothed the same way — Roy Morgan’s index from 2010, NAB’s printed net balance from March 1997 (two public calendar republications of NAB’s figure, merged at wire-verified seams; the pre-2009 head is sole-witness). NAB prints a net balance (0 = neutral), so its gold line is drawn 100 points up to share the neutral line; its read row and tooltips carry NAB’s own figures. In a term the band pools the Roy Morgan index over the other terms, each smoothed like the lines and lined up on its own election month — the middle half and the middle 80%, their average the dashed line. No combining, no adjustment.",
  };
  const xTicks = confWinTicks(win, vTerms, nowX);
  /* the strip's lines: each lane's whole run, history then releases */
  const stripLines = isMacro ? macroStripLines(D).map((l) => ({ ...l, color: "var(--macro-cpi)" }))
    : viewLanes.filter((l) => l.k !== "demosauConsumer").map((l) => {
      const d = laneData.get(l.k);
      return { points: d.deep.concat(d.raw), color: l.color };
    });
  const strip = (
    <RdConfStrip lines={stripLines} lo={ext.lo} hi={ext.hi} win={win} terms={vTerms} onWin={onWin} narrow={narrow}
                 label={isMacro ? "Headline inflation" : vc.title} />
  );
  /* the draw-a-term menu: any term window can lift other terms over its
     band, lined up on its own election */
  const drawMenu = !isMacro && hset && isTerm ? (
    /* the past-terms menu is the page's own control over a native
       select, styled with the primary-vote subpopulation menu's rules —
       picking a year toggles its line and the select snaps back to its
       label: the drawn set lives on the key row under the chart */
    <select className="rd-confidence-sel" aria-label={isCur ? "Draw a past term" : "Draw another term"} value=""
            onChange={(e) => {
              const v = e.target.value;
              if (v === "clear") setLiftedBy((s) => ({ ...s, [histLane]: new Set() }));
              else if (v) lift(+v);
            }}>
      <option value="" disabled>{isCur ? "Draw a past term" : "Draw another term"}</option>
      {drawable.map((t) => (
        <option key={t.year} value={t.year}>{lifted.has(t.year) ? ("✓ " + t.year) : t.year}</option>
      ))}
      {lifted.size > 0 && <hr />}
      {lifted.size > 0 && <option value="clear">✕ Clear lines</option>}
    </select>
  ) : null;
  const drawnShown = [...lifted].filter((y) => isTerm && drawable.some((t) => t.year === y)).sort((a, b) => a - b);
  return (
    <RdSec id="confidence" cls="rd-confidence" title="Economic sentiment" meta={isMacro ? "ABS and OECD series" : "Confidence indices, 100 = neutral" + (narrow ? "" : ", five published series")}>
      <RdHed head={isMacro && mStory ? mStory.head : head} dek={isMacro && mStory ? mStory.dek : dek} />
      {/* the views are pages of their own, so the row walks them by arrow
          keys (focused, or hovering the panel) and a phone swipe;
          rdPinScroll holds the row's spot through the crossfade (pin) */}
      <RdTabs swipe pin value={view} onChange={setView} options={views} ariaLabel="View of the economy" className="rd-confidence-tabs" />
      {/* the window bar holds still across the views: one window, three
          tabs (outside the crossfade, so a tab switch never redraws it) */}
      <RdConfWinBar win={winShown} terms={vTerms} lo={ext.lo} hi={ext.hi} nowX={nowX} onWin={onWin}>
        {drawMenu}
      </RdConfWinBar>
      <RdCrossfade k={view}>
      {!isMacro && <>
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
        <TrendChart key={"rd-confidence-" + view} heightPx={narrow ? 260 : 340}
          /* the top pad buys the event names (a phone's numbered badges)
             their row above the plot, as the primary card's does - held in
             every window, so a step never moves the plot */
          padPx={narrow ? { l: 34, r: 8, t: 34, b: 28 } : { l: 40, r: 16, t: 44, b: 30 }}
          xDomain={[win.a, win.b]} yDomain={yd} yTicks={confTicksIn(yd, yStep)} yTickFmt={(v) => String(v)}
          xTicks={xTicks} baseline driven={dragging}
          refLines={[{ y: 100, label: "100 = neutral", align: "left", color: "var(--ink-3)" }]}
          areas={bandAreas || undefined}
          series={chartSeries}
          spine={spine}
          events={badges ? badges.events : evs}
          evt={evtOpen} onEvt={setEvtOpen}
          vlines={elecRules ? elecEvs.map((e) => ({ x: e.x, cls: "rd-conf-evrule" })) : []}
          scatter={chartDots}
          /* each release is a row on the archive's confidence facet, so a
             dot under a mouse offers the same open trip every poll chart
             does (the engine's ROW_KEYS knows the confidence rows). The
             facet's tab shows at every width since 2026-10-08 (a phone's
             row scrolls to it), so the trip is offered everywhere */
          pollFacet="confidence"
          tooltipTitle={(i) => { const p = spine[i]; return p ? monthLabelFull(p.ym) : ""; }}
          fmt={fmt}
          copy={{ title: vc.copyTitle, span: confWinYears(win, vTerms, ext.hi), sub: vc.copySub + " " + span + ".", caption: vc.copyCaption, legend: copyLegend }} />
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
        {strip}
        <RdKey className="rd-ckey" items={[
          dotsOn ? { kind: "dot", color: "var(--ink-3)", label: "One release, as printed" } : null,
          { kind: "line", color: "var(--ink-3)", label: "Smoothed trend of the releases" },
          { kind: "line", color: "var(--confidence-alt)", label: vc.altKey },
        ]}>
          {bandRows && <>
            <span className="rd-key-item"><span className="rd-cs-keyband" aria-hidden="true"><i></i></span>{isCur ? "Middle half and middle 80% of past terms" : "Middle half and middle 80% of the other terms"}</span>
            <span className="rd-key-item"><RdSwatch kind="dash" color="var(--ink-2)" />Their average</span>
            <span className="rd-key-item"><span className="rd-cs-keythin" aria-hidden="true"></span>Paler: fewer terms ran this long</span>
          </>}
          {histInWin && <span className="rd-key-item"><span className="rd-cs-keyhist" aria-hidden="true"></span>Thinner: the house’s monthly history, smoothed the same way</span>}
          {!isTerm && <span className="rd-key-item"><span className="rd-cs-keyelec" aria-hidden="true"></span>A federal election</span>}
          {drawnShown.length > 0 && (
            <span className="rd-cc-drawn">
              {drawnShown.map((y) => (
                <span key={y} className="rd-cc-pill" style={{ borderColor: "var(--confidence-main)" }}>
                  <span className="rd-cc-rule" style={{ background: "var(--confidence-main)" }}></span>The {y} term
                  <button type="button" aria-label={"Return " + y + " to the band"} onClick={() => lift(y)}>×</button>
                </span>
              ))}
            </span>
          )}
        </RdKey>
      </div>
      </>}
      {/* the Inflation & growth view has no band to run on into the
          sitting term's future, so its "This term" ends at now and its
          small charts are filled edge to edge */}
      {isMacro && <RdMacro win={isCur ? { ...win, b: Math.min(win.b, nowX + 0.6 / 12) } : win} dragging={dragging} terms={vTerms} nowX={nowX} hi={ext.hi} strip={strip} />}
      </RdCrossfade>
      <HowTo paras={[
        <>Five published gauges of economic confidence, split into two views — the consumer lanes and the business pair, switched by the tabs over the chart — and set out as each house prints them: the weekly ANZ–Roy Morgan consumer index and monthly business index, Westpac–MI’s monthly consumer sentiment and DemosAU’s national consumer-sentiment index, and NAB’s Monthly Business Survey. Each dot is one release, as printed; each line is the same readings smoothed with a recency-weighted kernel (half-life 14 days on the weekly index, 60 days on the monthly ones), so release-to-release noise reads as trend — the quoted figures stay the raw prints. There is no combining across houses and no adjustment for lean — a record, not an estimate.</>,
        <>The bar over the chart sets the window, and the window holds as you switch tabs. It opens on this term; ‹ and › step back and forward a term at a time, and Term, 10 yrs, 25 yrs and All widen it (‹ › then page back and forward by that length). The strip under each chart is the whole record in miniature with the governments beneath it: drag the window along it, drag its edges to resize it, drag across the strip to draw a new one, or tap a spot to jump there. A term reads off its election — Election, 1 yr, 2 yrs — so every term shares one ruler; a longer window counts calendar years and marks each federal election with a faint rule. Dots show in a window of about a term; longer windows draw the lines alone.</>,
        <>Behind a term the band pools the view’s main gauge over the other terms, each smoothed like the lines (60-day half-life) and lined up on its own election month: the middle half in the heavier fill, the middle 80% in the lighter, their average the dashed line, paler where fewer terms ran that long. This term’s band is every past term; a past term’s is every term but itself. Consumer history runs to 1974, business to 2013. “Draw a past term” lifts any single term out of the band as its own smoothed, dotted line in the house’s own colour — and on the consumer view Westpac–MI’s reading of the same term draws beside it, dotted gold where its 1974 series reaches — and “Source data, CSV” in the footer downloads every release and past-term reading. Before each house’s live release file begins, its line runs on through the house’s own monthly history, smoothed the same way and drawn a little thinner — ANZ–Roy Morgan’s consumer index to 1973, Westpac–MI’s consumer sentiment to 1974, Roy Morgan’s business index to 2010, NAB’s printed net balance to March 1997. Westpac–MI months before 2010 come from the OECD’s republication of the index, which rounds them to the nearest whole index point; from 2010 the RBA’s table carries Westpac–MI’s own decimals.</>,
        <>ANZ–Roy Morgan’s and Westpac–MI’s are indices where 100 is neutral; DemosAU’s national index is 50-neutral and draws doubled to share the line. NAB instead reports a net balance — the share of optimistic firms minus pessimistic ones — where 0 is neutral, so the NAB line is drawn 100 points up to share the neutral line on the business view; the figure beside it and in its tooltips is NAB’s own printed number, and the row also carries the survey’s conditions reading.</>,
        <>The Inflation &amp; growth tab sets the ABS’s and OECD’s official figures out as seven small charts that share the window, Australia in colour and the OECD in grey. Inflation: Australia’s headline inflation (the ABS’s monthly all-items CPI as an annual change; before the monthly CPI era, the quarterly series derived from the ABS’s own published index numbers, spliced where the printed monthly measure begins) beside the OECD-wide average and the median member country, with the Reserve Bank’s 2–3% target shaded from August 1996, when it was adopted. Inflation against target: Australia’s figure minus the band’s 2.5% midpoint, beside the median member’s distance from its own central bank’s target (band targets read at their midpoints; a country joins the median only once both its print and a formal target exist that month, so the line grows as inflation targeting spread after New Zealand’s 1990 band). Growth per person: real GDP per person, real net national disposable income per person and real household disposable income per person (annual change in chain-volume levels, seasonally adjusted), beside real GDP per person across the OECD (the OECD’s household dashboard index, so the grey line begins in 2008) and the median member’s own GDP-per-person growth computed here from the OECD’s growth and population files. National income is the whole country’s: it counts what exports buy and income paid abroad, and includes companies’ and governments’ income. Household income is what households have after tax and interest — the ABS’s household gross disposable income over its household consumption price deflator and its population, worked out here because the ABS prints no real per-person figure (it matches the OECD’s own calculation for Australia to within 0.2 points). Its Actual switch shows the three Australian series as dollars instead (each seasonally adjusted quarter at its annual rate, in 2023–24 prices). Productivity: GDP per hour worked — the ABS’s seasonally adjusted index as an annual rate, beside the OECD members’ median output-per-worker growth (computed here from their own file, which carries no per-hour median, so the two lines measure differently and the page names a basis openly). Its Increase/Actual switch swaps the yearly rate for the index itself — the form in which the decade since roughly 2016, nearly flat beside the two before it, reads as a level rather than a wiggle. Earnings: the real change in full-time adult ordinary-time weekly earnings — the ABS’s nominal print deflated here by its own consumer price index, since the ABS publishes no real figure — beside the median of the OECD countries’ real average-wage year changes, a different measure and cadence (annual gross wages per employee at constant 2023 purchasing-power prices). Unemployment: the ABS’s monthly seasonally adjusted rate, a level rather than an annual change, beside the OECD members’ median harmonised rate, computed here. Income inequality: the Gini coefficient of household income after tax, adjusted for household size (0 would be everyone on the same income, 1 one household holding it all), from two surveys kept as separate lines because their levels differ — the HILDA survey every year from 2002–03, and the ABS’s own Survey of Income and Housing, the official measure, about every second year from 1994–95 to 2019–20 (the ABS has scheduled no next release) — beside the OECD member countries’ median coefficient, computed here; the OECD publishes no OECD-wide Gini. Both surveys run years behind the other charts, so a recent window can hold no survey year at all; the chart then names the latest. Nothing is smoothed, adjusted, combined or estimated — official prints, joined as-is, refreshed daily from the ABS and OECD data APIs (the deviation lines, the OECD medians and Australia’s real-earnings deflation are computed here: Australia’s from the ABS’s own figures, the OECD medians from the member countries’ OECD-published prints and, since 2026, from the OECD’s monthly inflation release table — one decimal, three on the Gini lines).</>,
        <>Reading economic sentiment beside the polls is context, not a predictor of the vote. The consumer and business gauges needn’t move together, and two houses asking differently worded questions needn’t agree week to week.</>,
      ]} />
      {/* placement is deliberate: under the how-to, not beside the chart
          (user call 2026-10-09 evening) */}
      <RdConfCal />
      <div className="rd-foot">
        <span className="rd-foot-text">The consumer and business confidence indices are displayed here just for extra context in today’s low-confidence environment.</span>
        <span className="rd-grow"></span>
        <button type="button" className="rd-how rd-confidence-csv" onClick={exportCsv}><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v12M12 15l-4-4M12 15l4-4M4 19h16"></path></svg> Source data, CSV</button>
        <RdHow term="confidence" from="Economic sentiment" />
      </div>
    </RdSec>
  );
}

/* the band of a set of terms, gen-data §5k's rule: at each month 0..36,
   the middle half, middle 80% and mean of the terms standing there, once
   three or more do (and three terms at the least overall) */
/* a past term's month grid through the panel's kernel at TERM_HL (60
   days), as gen-data's confTermSmooth does for the sitting term's band –
   the band pools terms built like the lines drawn over it */
function confTermSmooth(v) {
  const decay = Math.LN2 / (60 / 365.25);
  const pts = v.map((y, m) => (y == null ? null : { m, y })).filter(Boolean);
  const out = v.map(() => null);
  for (const p of pts) {
    let ws = 0, wt = 0;
    for (const q of pts) {
      const w = Math.exp(-decay * Math.abs(q.m - p.m) / 12);
      if (w < 0.02) continue;
      ws += w; wt += w * q.y;
    }
    out[p.m] = wt / ws;
  }
  return out;
}
function confBand(terms) {
  if (!terms || terms.length < 3) return null;
  const sm = terms.map((t) => confTermSmooth(t.v));
  const out = [];
  for (let m = 0; m <= 36; m++) {
    const nums = sm.map((v) => v[m]).filter((v) => v != null).sort((a, b) => a - b);
    if (nums.length < 3) continue;
    const pct = (p) => { const i = (nums.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i); return nums[lo] + (nums[hi] - nums[lo]) * (i - lo); };
    out.push({ m, n: nums.length,
      mean: +(nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2),
      q1: +pct(0.25).toFixed(2), q3: +pct(0.75).toFixed(2),
      p10: +pct(0.1).toFixed(2), p90: +pct(0.9).toFixed(2) });
  }
  return out.length ? out : null;
}

Object.assign(window, { RdPrimary, rdShareWords, rdPartyIn, rdPartyStart, rdElectionTicks, RdLeadership, RdHeadBar, RdDirection, rdList, rdRoughPts, RdDemographics, RdSwitching, useRdWidth, RdIssues, RdUndecided, RdConfidence, RdShiftPlot, rdOneIn, RdTsig, rdTsSgn });
