function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function PrimaryVotePanel({
  rangeId,
  setRangeId
}) {
  if (window.AP.rd) return React.createElement(RdPrimary, {
    rangeId: rangeId,
    setRangeId: setRangeId
  });
  const {
    D,
    rangeDomain,
    filterPts,
    buildXTicks,
    series
  } = window.AP;
  const [xDomain] = [rangeDomain(rangeId)];
  const [hidden, setHidden] = useState({});
  const narrow = useNarrow();
  const latest = D.latest.primary;
  const base = D.aggPrimary.find(d => d.election) || null;
  const parts = [{
    id: "alp",
    ...D.PARTIES.alp
  }, {
    id: "lnp",
    ...D.PARTIES.lnp
  }, {
    id: "grn",
    ...D.PARTIES.grn
  }, {
    id: "onp",
    ...D.PARTIES.onp
  }, {
    id: "oth",
    ...D.PARTIES.oth
  }].sort((a, b) => latest[b.id] - latest[a.id]);
  const pts = filterPts(D.aggPrimary, xDomain[0]);
  const pvLead = (() => {
    const a = parts[0],
      b = parts[1];
    const lnp = parts.find(p => p.id === "lnp");
    if (!a || !b || !lnp) return null;
    const gap = latest[a.id] - latest[b.id];
    let s = gap < 2 ? a.name + " (" + latest[a.id].toFixed(1) + "%) and " + b.name + " (" + latest[b.id].toFixed(1) + "%) are within " + (gap < 1 ? "a point" : "two points") + " of each other on first preferences" : a.name + " leads first-preference support on " + latest[a.id].toFixed(1) + "%, " + gap.toFixed(1) + " points clear of " + b.name;
    const lnpBehind = latest[b.id] - latest.lnp;
    if (lnp.id !== a.id && lnp.id !== b.id && lnpBehind > 2) s += ", while the " + lnp.name + " has been left behind on " + latest.lnp.toFixed(1) + "%";
    return s + ".";
  })();
  const pvHead = parts[1] && (latest[parts[0].id] - latest[parts[1].id] < 2 ? parts[0].name + " and " + parts[1].name + " neck and neck" : parts[0].name + " leads the primary vote");
  const chartSeries = parts.map(p => ({
    id: p.id,
    label: p.name,
    color: p.color,
    points: series(pts, p.id),
    width: p.id === "oth" ? 2 : 3,
    dashed: p.id === "oth",
    opacity: hidden[p.id] ? 0 : 1,
    endLabel: p.short
  }));
  const primaryScatter = D.individualPolls.filter(p => p.x >= xDomain[0] && p.x <= xDomain[1]).flatMap(p => parts.filter(party => !hidden[party.id] && p.p && p.p[party.id] != null).map(party => ({
    x: p.x,
    y: p.p[party.id],
    color: party.color,
    label: party.name,
    meta: p
  })));
  const visible = parts.filter(p => !hidden[p.id]);
  const solo = visible.length === 1 ? visible[0] : null;
  const soloBand = !solo ? [] : pts.filter(d => d.ci && d.ci[solo.id] != null && d[solo.id] != null).map(d => ({
    x: d.x,
    y0: d[solo.id] - d.ci[solo.id],
    y1: d[solo.id] + d.ci[solo.id]
  }));
  const primaryAreas = soloBand.length >= 2 ? [{
    id: "ci-" + solo.id,
    color: solo.color,
    className: "ci-band",
    edge: false,
    smooth: true,
    points: soloBand
  }] : [];
  return React.createElement("section", {
    className: "card"
  }, React.createElement("div", {
    className: "card-head"
  }, React.createElement("div", null, React.createElement("h2", {
    className: "card-title"
  }, "Primary vote")), React.createElement("div", {
    className: "legend"
  }, parts.map(p => {
    const was = base && base[p.id] != null ? base[p.id] : null;
    return React.createElement("button", {
      key: p.id,
      type: "button",
      className: "legend-chip" + (hidden[p.id] ? " off" : "") + (p.id === "oth" ? " residual" : ""),
      "aria-pressed": !hidden[p.id],
      title: was == null ? p.name + " – " + latest[p.id].toFixed(1) + "% now" : p.name + " – " + latest[p.id].toFixed(1) + "% now, " + was.toFixed(1) + "% at the 2025 election",
      onClick: () => setHidden(h => ({
        ...h,
        [p.id]: !h[p.id]
      }))
    }, React.createElement("span", {
      className: "legend-swatch",
      style: {
        background: p.color
      }
    }), React.createElement("span", {
      className: "legend-name"
    }, p.name), React.createElement("span", {
      className: "legend-val"
    }, latest[p.id].toFixed(1), "%"), was != null && React.createElement(Delta, {
      value: latest[p.id] - was,
      small: true
    }));
  }))), React.createElement(Story, {
    head: pvLead && pvHead,
    dek: pvLead
  }), React.createElement(TrendChart, {
    key: "pv",
    height: narrow ? 460 : 340,
    xDomain: xDomain,
    yDomain: [0, 40],
    yTicks: [10, 20, 30, 40],
    unit: "%",
    axisFont: narrow ? 28 : 20,
    pad: {
      l: 58,
      r: 20,
      t: 18,
      b: 42
    },
    xTicks: buildXTicks(xDomain[0], xDomain[1]),
    series: chartSeries,
    spine: series(pts, "alp"),
    areas: primaryAreas,
    scatter: primaryScatter,
    pollFacet: "primary",
    events: majorEvents(),
    tooltipTitle: i => window.AP.monthLabelFull(pts[i].ym),
    fmt: v => v.toFixed(1)
  }), React.createElement(HowTo, {
    paras: [React.createElement(React.Fragment, null, "Each dot is one published poll\u2019s first-preference figure; the lines are monthly averages. Each chip\u2019s \u25B2 \u25BC is its", " ", React.createElement("a", {
      className: "hi-term",
      href: "#info",
      onClick: e => {
        e.preventDefault();
        window.AP.openTerm && window.AP.openTerm("changes", "Primary vote");
      }
    }, "change since the 2025 election"), ". Use the chips to isolate one party."), React.createElement(React.Fragment, null, "The lines are weighted by sample and adjusted for each house\u2019s lean."), React.createElement(React.Fragment, null, "The 2025 election is where every line here begins. A party on its own draws with the 95% interval around its line", solo ? ", shaded here" : "", ".")]
  }));
}
const eventOn = iso => (window.AP.D.events || []).find(e => e.date === iso) || null;
const majorEvents = () => (window.AP.D.events || []).filter(e => e.major);
const OPP_HANDOVER = (() => {
  const e = eventOn("2026-02-12");
  return e ? {
    ...e,
    short: "Ley → Taylor"
  } : null;
})();
const PZ_ICON = {
  expand: "M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3",
  minimise: "M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3",
  swap: "M4 9h13l-3-3M20 15H7l3 3"
};
function PzBtn({
  icon,
  label,
  onClick
}) {
  return React.createElement("button", {
    type: "button",
    className: "pz-btn pz-" + icon,
    onClick: onClick,
    title: label,
    "aria-label": label
  }, React.createElement("svg", {
    viewBox: "0 0 24 24",
    width: "15",
    height: "15",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true"
  }, React.createElement("path", {
    d: PZ_ICON[icon]
  })));
}
function PanelZoom({
  expanded,
  onExpand,
  onSwap,
  onClose,
  label,
  otherLabel
}) {
  if (!expanded) return React.createElement(PzBtn, {
    icon: "expand",
    label: "Expand " + label,
    onClick: onExpand
  });
  return React.createElement("div", {
    className: "pz-group"
  }, otherLabel && React.createElement(PzBtn, {
    icon: "swap",
    label: "Show " + otherLabel + " instead",
    onClick: onSwap
  }), React.createElement(PzBtn, {
    icon: "minimise",
    label: "Show both panels",
    onClick: onClose
  }));
}
function LeadershipSection({
  rangeId
}) {
  if (window.AP.rd) return React.createElement(RdLeadership, {
    rangeId: rangeId
  });
  const {
    D
  } = window.AP;
  const [view, setView] = useState("pair");
  const leaders = D.LEADERS;
  let ldHead = null;
  const ldLead = (() => {
    const byId = {};
    leaders.forEach(L => {
      byId[L.id] = L;
    });
    const pm = byId.alb,
      op = byId.taylor,
      hn = byId.hanson;
    if (!pm || !op || !hn) return null;
    const pmP = leaderReading(D.leaderMonths, "alb_pref");
    const opP = leaderReading(D.leaderMonths, "taylor_pref");
    const nets = [pm, op, hn].map(L => ({
      L,
      r: leaderReading(D.leaderMonths, L.id + "_net")
    }));
    if (!pmP || !opP || nets.some(n => !n.r)) return null;
    const r0 = Math.round;
    const ahead = pmP.v - opP.v >= 0;
    const ppmPart = (ahead ? pm.short : op.short) + " leads " + (ahead ? op.short : pm.short) + " " + r0(Math.max(pmP.v, opP.v)) + "–" + r0(Math.min(pmP.v, opP.v)) + " as preferred prime minister";
    const neg = nets.filter(n => n.r.v < 0);
    const pref = (ahead ? pm.short : op.short) + " preferred as PM";
    ldHead = neg.length === nets.length ? pref + ", but all three leaders net-negative" : !neg.length ? pref + ", and all three leaders net-positive" : pref;
    if (neg.length === nets.length) {
      const worst = neg.reduce((a, b) => a.r.v < b.r.v ? a : b);
      return ppmPart + ", yet all three leaders are rated net-negative – " + (worst.L.id === "alb" ? "the PM" : worst.L.short) + " most deeply, on " + r0(worst.r.v) + ".";
    }
    if (!neg.length) return ppmPart + ", and all three carry net-positive ratings.";
    return ppmPart + ", and on approval only " + nets.filter(n => n.r.v >= 0).map(n => n.L.short).join(" and ") + " rate" + (nets.length - neg.length === 1 ? "s" : "") + " net-positive.";
  })();
  return React.createElement("section", {
    className: "leadership"
  }, React.createElement("div", {
    className: "leadership-head"
  }, React.createElement("h2", {
    className: "section-h"
  }, "Leadership")), React.createElement(Story, {
    head: ldLead && ldHead,
    dek: ldLead
  }), React.createElement(HowTo, {
    label: "How to read these charts",
    cls: "leadership-note",
    paras: [React.createElement(React.Fragment, null, "The Coalition line splices leaders \u2013 ", React.createElement("strong", null, "Ley"), " to February 2026, ", React.createElement("strong", null, "Taylor"), " since."), React.createElement(React.Fragment, null, "The approval and favourability points are monthly aggregates, weighted and house-adjusted the way the vote series are; the preferred-PM lines join published readings as they came, unadjusted."), React.createElement(React.Fragment, null, "Preferred PM is put to voters as two separate two-way contests \u2013 against the opposition leader, and against Hanson head to head \u2013 so both are drawn, as published. In the two-way houses leave anywhere from nothing (Newspoll) to half the sample uncommitted, and the three-way 16\u201350%, so a level isn\u2019t comparable across houses \u2013 but the gap between the two lines, and the trend in each, are.")]
  }), React.createElement("div", {
    className: "two-col lead-grid lg-" + view
  }, view === "both" ? React.createElement(ApprovalPanel, {
    key: "appr-net",
    rangeId: rangeId,
    leaders: leaders,
    metric: "net",
    lockMetric: true,
    chrome: React.createElement(PanelZoom, {
      expanded: true,
      label: "approval",
      onClose: () => setView("pair")
    })
  }) : React.createElement(PreferredPMPanel, _extends({
    key: "ppm",
    rangeId: rangeId,
    leaders: leaders
  }, view === "ppmboth" ? {
    fmt: "2",
    lockFmt: true
  } : {
    onBoth: () => setView("ppmboth")
  }, {
    chrome: view === "ppmboth" ? React.createElement(PanelZoom, {
      expanded: true,
      label: "two-way",
      onClose: () => setView("pair")
    }) : React.createElement(PanelZoom, {
      expanded: view === "ppm",
      label: "preferred prime minister",
      otherLabel: "net rating",
      onExpand: () => setView("ppm"),
      onSwap: () => setView("appr"),
      onClose: () => setView("pair")
    })
  })), view === "ppmboth" ? React.createElement(PreferredPMPanel, {
    key: "ppm-3",
    rangeId: rangeId,
    leaders: leaders,
    fmt: "3",
    lockFmt: true,
    chrome: React.createElement(PanelZoom, {
      expanded: true,
      label: "three-way",
      onClose: () => setView("pair")
    })
  }) : React.createElement(ApprovalPanel, _extends({
    key: "appr",
    rangeId: rangeId,
    leaders: leaders
  }, view === "both" ? {
    metric: "fav",
    lockMetric: true
  } : {}, {
    onBoth: () => setView("both"),
    chrome: view === "both" ? React.createElement(PanelZoom, {
      expanded: true,
      label: "favourability",
      onClose: () => setView("pair")
    }) : React.createElement(PanelZoom, {
      expanded: view === "appr",
      label: "net rating",
      otherLabel: "preferred prime minister",
      onExpand: () => setView("appr"),
      onSwap: () => setView("ppm"),
      onClose: () => setView("pair")
    })
  }))));
}
const PM_PARTY = "ALP",
  OPP_PARTY = "L/NP",
  ONP_PARTY = "ON";
function leaderOrder(D) {
  const on = D.altLatest && D.altLatest.alp_on;
  const rival = !!on && on.a != null && D.latest.alp2pp != null && D.latest.alp2pp - on.a > Math.hypot(D.latest.alp2ppCi95 || 0, on.ci95 || 0);
  return [PM_PARTY, ...(rival ? [ONP_PARTY, OPP_PARTY] : [OPP_PARTY, ONP_PARTY])];
}
function byLeaderOrder(order) {
  const rank = party => {
    const i = order.indexOf(party);
    return i < 0 ? order.length : i;
  };
  return (a, b) => rank(a) - rank(b);
}
const PPM_PAIRS = [{
  id: "at",
  suf: "_pref",
  ids: ["alb", "taylor"],
  lab: "Albanese v the opposition leader"
}, {
  id: "ah",
  suf: "_prefH",
  ids: ["alb", "hanson"],
  lab: "Albanese v Hanson, head to head",
  dashed: true
}];
function PreferredPMPanel({
  rangeId,
  leaders: allLeaders,
  chrome,
  fmt: fmtProp,
  lockFmt,
  onBoth
}) {
  const {
    D,
    rangeDomain,
    filterPts,
    buildXTicks
  } = window.AP;
  const narrow = useNarrow();
  const [ownFmt, setOwnFmt] = useState("2");
  const fmt = fmtProp || ownFmt;
  const BOTH_KEEPS = "2";
  const [rawMorph, chooseFmt] = window.AP.useMorph(fmt, v => {
    if (v === "both") {
      setOwnFmt(BOTH_KEEPS);
      onBoth && onBoth();
    } else setOwnFmt(v);
  }, (from, to) => (to === "both" ? BOTH_KEEPS : to) !== from);
  const morph = rawMorph && rawMorph.to === "both" ? {
    ...rawMorph,
    to: BOTH_KEEPS
  } : rawMorph;
  const setFmt = chooseFmt;
  const three = fmt === "3";
  const byId = {};
  allLeaders.forEach(L => {
    byId[L.id] = L;
  });
  const xDomain = rangeDomain(rangeId);
  const pts = filterPts(D.leaderMonths, xDomain[0]);
  const latestYm = D.leaderMonths[D.leaderMonths.length - 1].ym;
  const rowsFor = f => f === "3" ? allLeaders.map(L => ({
    pair: null,
    L,
    suf: "_pref3",
    label: L.short,
    mk: L.id
  })) : PPM_PAIRS.flatMap(pr => pr.ids.map(id => ({
    pair: pr,
    L: byId[id],
    suf: pr.suf,
    dashed: !!pr.dashed,
    label: id === "alb" && pr.id === "ah" ? "Albanese v Hanson" : byId[id].short,
    mk: id === "alb" && pr.id === "ah" ? "alb-h2h" : id
  })));
  const rows = rowsFor(fmt);
  rows.forEach(r => {
    r.read = leaderReading(D.leaderMonths, r.L.id + r.suf);
  });
  const ordered = three ? [...rows].sort((a, b) => byLeaderOrder(leaderOrder(D))(a.L.party, b.L.party)) : rows;
  const cloudFor = f => D.individualPolls.filter(p => p.x >= xDomain[0] && p.x <= xDomain[1]).flatMap(p => (f === "3" ? [["3", allLeaders]] : PPM_PAIRS.map(pr => [pr.id, pr.ids.map(id => byId[id]), pr])).flatMap(([m, ls, pr]) => {
    const c = ppmMatch(p, m);
    if (!c) return [];
    return ls.map(L => {
      const fromLey = L.id === "taylor" && c.taylor == null;
      const raw = L.id === "taylor" ? fromLey ? c.ley : c.taylor : c[L.id];
      if (raw == null) return null;
      const lab = pr && pr.id === "ah" && L.id === "alb" ? "Albanese v Hanson" : fromLey ? "Ley" : L.short;
      return {
        x: p.x,
        y: raw,
        color: L.color,
        label: lab,
        meta: p,
        leader: L.id
      };
    }).filter(Boolean);
  }));
  const ppmScatter = cloudFor(fmt);
  const cross = morph ? window.AP.crossClouds(cloudFor(morph.from), cloudFor(morph.to), morph.t, d => d.meta.pollster + "|" + d.meta.released + "|" + d.leader) : null;
  const erasOf = r => r.L.id === "taylor" ? ["ley", "taylor"] : [null];
  const lineFor = (r, era) => {
    const k = (era || r.L.id) + r.suf;
    return pts.filter(d => d[k] != null).map(d => ({
      ym: d.ym,
      x: d.x,
      v: d[k],
      ci: d[k + "Ci"] != null ? d[k + "Ci"] : null
    }));
  };
  const fromRows = morph ? rowsFor(morph.from) : null;
  const toRows = morph ? rowsFor(morph.to) : null;
  const byMk = list => {
    const m = {};
    (list || []).forEach(r => m[r.mk] = r);
    return m;
  };
  const fromBy = byMk(fromRows),
    toBy = byMk(toRows);
  const runKeys = list => (list || []).flatMap(r => erasOf(r).map(era => r.mk + "|" + (era || "")));
  const drawRows = !morph ? rows.flatMap(r => erasOf(r).map(era => ({
    r,
    era,
    pts: lineFor(r, era),
    opacity: 1
  }))).filter(d => d.pts.length) : [...new Set([...runKeys(fromRows), ...runKeys(toRows)])].map(k => {
    const [mk, eraS] = k.split("|"),
      era = eraS || null;
    const a = fromBy[mk],
      b = toBy[mk];
    if (a && b) {
      const bl = window.AP.blendRows(lineFor(a, era), lineFor(b, era), morph.t, ["v", "ci"]);
      const r = morph.t < 0.5 ? a : b;
      return {
        r,
        era,
        pts: bl ? bl.rows : lineFor(r, era),
        opacity: 1,
        clip: bl ? bl.clip : null
      };
    }
    const only = a || b;
    return {
      r: only,
      era,
      pts: lineFor(only, era),
      wipe: a ? morph.t : 1 - morph.t
    };
  }).filter(d => d.pts.length);
  const ciAreas = drawRows.map(d => ({
    id: "ci-" + (d.era ? d.r.mk + "-" + d.era : d.r.mk),
    color: d.r.L.color,
    className: "ci-band",
    edge: false,
    smooth: true,
    wipeOf: d.wipe != null ? d.era ? d.r.mk + "-" + d.era : d.r.mk : undefined,
    clipX: d.clip,
    points: d.pts.filter(p => p.ci != null).map(p => ({
      x: p.x,
      y0: p.v - p.ci,
      y1: p.v + p.ci
    }))
  })).filter(a => a.points.length >= 2);
  const valsFor = f => rowsFor(f).flatMap(r => D.leaderMonths.flatMap(m => [r.L.id + r.suf, r.L.id === "taylor" ? "ley" + r.suf : null].filter(Boolean).flatMap(k => m[k] == null ? [] : m[k + "Ci"] != null ? [m[k] - m[k + "Ci"], m[k] + m[k + "Ci"]] : [m[k]]))).concat(cloudFor(f).map(d => d.y));
  const fitFor = f => {
    const v = valsFor(f);
    return fitDomain(v.length ? v : [30, 50], 10);
  };
  const target = fitFor(fmt);
  const ticks = target.ticks;
  const domain = morph ? window.AP.blendDomain(fitFor(morph.from).domain, fitFor(morph.to).domain, morph.t) : target.domain;
  const Roll = window.RollNum;
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
    const nodes = [...root.querySelectorAll("[data-mk]")].filter(n => !n.closest(".ppm-ghost"));
    if (changed) {
      clearTimeout(landRef.current);
      root.querySelectorAll(".ppm-ghost").forEach(g => g.remove());
      nodes.forEach(n => {
        n.style.transition = "none";
        n.style.transform = "";
        n.style.opacity = "";
      });
    }
    const rootR = root.getBoundingClientRect();
    const digitsIn = (n, sel) => [...n.querySelectorAll(sel + " .roll-reel")].map(r => r.style.getPropertyValue("--d"));
    const now = {};
    nodes.forEach(n => {
      const r = n.getBoundingClientRect();
      now[n.dataset.mk] = {
        x: r.left - rootR.left,
        y: r.top - rootR.top,
        html: n.outerHTML,
        num: digitsIn(n, ".leader-num"),
        delta: digitsIn(n, ".delta")
      };
    });
    const prev = homeRef.current;
    homeRef.current = now;
    if (!changed || !prev) return;
    const still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (still) return;
    const MS = window.AP && window.AP.MORPH_MS || 320;
    const EASE = window.AP.MORPH_CSS;
    const release = [];
    const seed = (n, sel, was) => {
      if (!was || !was.length) return;
      const cur = [...n.querySelectorAll(sel + " .roll-reel")];
      const offset = cur.length - was.length;
      cur.forEach((reel, i) => {
        const from = was[i - offset],
          to = reel.style.getPropertyValue("--d");
        if (from == null || from === "" || from === to) return;
        reel.style.transition = "none";
        reel.style.setProperty("--d", from);
        release.push(() => {
          reel.style.transition = "";
          reel.style.setProperty("--d", to);
        });
      });
    };
    nodes.forEach(n => {
      const a = prev[n.dataset.mk],
        b = now[n.dataset.mk];
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
      const dx = a.x - b.x,
        dy = a.y - b.y;
      if (!dx && !dy) return;
      n.style.transition = "none";
      n.style.transform = "translate(" + dx + "px, " + dy + "px)";
      release.push(() => {
        n.style.transition = "transform " + MS + "ms " + EASE + ", opacity " + MS + "ms " + EASE;
        n.style.transform = "";
        n.style.opacity = "";
      });
    });
    void root.offsetWidth;
    release.forEach(f => f());
    Object.keys(prev).forEach(mk => {
      if (now[mk]) return;
      const ghost = document.createElement("div");
      ghost.className = "ppm-ghost";
      ghost.innerHTML = prev[mk].html;
      ghost.style.left = prev[mk].x + "px";
      ghost.style.top = prev[mk].y + "px";
      root.appendChild(ghost);
      void ghost.offsetWidth;
      ghost.style.opacity = "0";
      setTimeout(() => ghost.remove(), MS + 60);
    });
    landRef.current = setTimeout(() => {
      root.querySelectorAll(".ppm-ghost").forEach(g => g.remove());
      nodes.forEach(n => {
        n.style.transition = "";
        n.style.transform = "";
        n.style.opacity = "";
        n.querySelectorAll(".roll-reel").forEach(r => {
          r.style.transition = "";
        });
      });
    }, MS + 80);
  }, [fmt]);
  const tiles = list => list.map(r => {
    const rd = r.read;
    const tag = rd && staleTag(rd.ym, latestYm);
    return React.createElement("div", {
      className: "leader",
      key: r.mk,
      "data-mk": r.mk
    }, React.createElement("div", {
      className: "leader-dot",
      style: {
        background: r.L.color
      }
    }), React.createElement("div", {
      className: "leader-vals"
    }, React.createElement("div", {
      className: "leader-name"
    }, r.L.short, tag && React.createElement("span", {
      className: "stale-tag",
      title: "Latest published reading, " + tag
    }, " ", tag)), React.createElement("div", {
      className: "leader-num"
    }, rd ? Roll ? React.createElement(Roll, {
      value: rd.v.toFixed(1)
    }) : rd.v.toFixed(1) : "—", rd && React.createElement("span", {
      className: "pct"
    }, "%"))), rd && rd.prev != null && React.createElement(Delta, {
      value: rd.v - rd.prev,
      suffix: "",
      small: true,
      roll: true,
      title: readoutDeltaTitle(rd)
    }));
  });
  const leadOf = pr => {
    const gap = (a, b) => {
      const d = +Math.abs(a - b).toFixed(1);
      const who = byId[a > b ? pr.ids[0] : pr.ids[1]];
      return {
        m: d.toFixed(1),
        name: who.short,
        color: inkOf(who.color),
        level: d === 0
      };
    };
    const [ra, rb] = pr.ids.map(id => leaderReading(D.leaderMonths, id + pr.suf));
    if (ra && rb && ra.now && rb.now) return gap(ra.v, rb.v);
    for (let i = D.leaderMonths.length - 1; i >= 0; i--) {
      const m = D.leaderMonths[i],
        a = m[pr.ids[0] + pr.suf],
        b = m[pr.ids[1] + pr.suf];
      if (a == null || b == null) continue;
      return gap(a, b);
    }
    return null;
  };
  return React.createElement("section", {
    className: "card"
  }, React.createElement("div", {
    className: "card-head"
  }, React.createElement("div", null, React.createElement("h3", {
    className: "card-title"
  }, "Preferred prime minister"), React.createElement("p", {
    className: "card-sub"
  }, three ? "“Who would make the better PM?”, asked as a three-way including Hanson" : "“Who would make the better PM?”, asked head to head – in both of the contests pollsters run")), React.createElement("div", {
    className: "card-head-tools"
  }, !lockFmt && React.createElement(TextToggle, {
    caps: true,
    value: fmt,
    onChange: setFmt,
    ariaLabel: "Preferred-PM question",
    options: [{
      id: "2",
      label: "Two-way"
    }, {
      id: "3",
      label: "Three-way"
    }, ...(onBoth ? [{
      id: "both",
      label: "Both"
    }] : [])]
  }), chrome)), React.createElement("div", {
    className: "ppm-readout",
    ref: readoutRef
  }, three ? React.createElement("div", {
    className: "leader-readout"
  }, tiles(ordered)) : React.createElement("div", {
    className: "ppm-pairs"
  }, PPM_PAIRS.map(pr => {
    const lead = leadOf(pr);
    return React.createElement("div", {
      className: "ppm-pair" + (pr.dashed ? " dashed" : ""),
      key: pr.id
    }, React.createElement("span", {
      className: "ppm-rule",
      "aria-hidden": "true"
    }), React.createElement("span", {
      className: "sr-only"
    }, pr.lab), React.createElement("div", {
      className: "leader-readout"
    }, tiles(rows.filter(r => r.pair === pr))), lead && React.createElement("span", {
      className: "ppm-lead",
      style: lead.level ? null : {
        color: lead.color
      }
    }, lead.level ? "level" : React.createElement(React.Fragment, null, React.createElement("span", {
      className: "sr-only"
    }, lead.name, " leads by "), "+", lead.m)));
  }))), React.createElement(TrendChart, {
    key: "ppm",
    height: narrow ? 460 : 340,
    xDomain: xDomain,
    yDomain: domain,
    yTicks: ticks,
    unit: "%",
    axisFont: narrow ? 28 : 20,
    pad: {
      l: 58,
      r: 22,
      t: 22,
      b: 42
    },
    xTicks: buildXTicks(xDomain[0], xDomain[1]),
    events: [OPP_HANDOVER].filter(Boolean),
    areas: ciAreas,
    series: drawRows.map(d => ({
      id: d.era ? d.r.mk + "-" + d.era : d.r.mk,
      label: d.era === "ley" ? "Ley" : d.r.label,
      color: d.r.L.color,
      dashed: d.r.dashed,
      endCap: d.era === "ley" ? false : undefined,
      endLabel: d.era === "ley" || d.r.dashed && drawRows.some(o => o !== d && !o.r.dashed && o.r.L.short === d.r.L.short) ? undefined : d.r.L.short || d.r.L.name || d.r.label,
      clipX: d.clip,
      opacity: d.opacity,
      wipe: d.wipe,
      points: d.pts.map(p => ({
        x: p.x,
        y: p.v
      }))
    })),
    spine: pts.map(d => ({
      x: d.x
    })),
    scatter: cross ? cross.scatter : ppmScatter,
    pollFacet: "leadership",
    scatterOut: cross ? cross.scatterOut : [],
    scatterMove: cross ? cross.scatterMove : [],
    fade: morph ? morph.t : 1,
    tooltipTitle: i => window.AP.monthLabelFull(pts[i].ym),
    fmt: v => v.toFixed(1)
  }));
}
function ApprovalPanel({
  rangeId,
  leaders,
  chrome,
  metric: metricProp,
  lockMetric,
  onBoth
}) {
  const {
    D,
    rangeDomain,
    filterPts,
    buildXTicks
  } = window.AP;
  const narrow = useNarrow();
  const [own, setOwn] = useState("net");
  const metric = metricProp != null ? metricProp : own;
  const BOTH_KEEPS = "fav";
  const [rawMorph, chooseMetric] = window.AP.useMorph(metric, v => {
    if (v === "both") {
      setOwn(BOTH_KEEPS);
      onBoth && onBoth();
    } else setOwn(v);
  }, (from, to) => (to === "both" ? BOTH_KEEPS : to) !== from);
  const morph = rawMorph && rawMorph.to === "both" ? {
    ...rawMorph,
    to: BOTH_KEEPS
  } : rawMorph;
  const setMetric = chooseMetric;
  const suf = "_" + metric;
  const xDomain = rangeDomain(rangeId);
  const pts = filterPts(D.leaderMonths, xDomain[0]);
  const latestYm = D.leaderMonths[D.leaderMonths.length - 1].ym;
  const reads = {};
  leaders.forEach(L => {
    reads[L.id] = leaderReading(D.leaderMonths, L.id + suf);
  });
  const ordered = [...leaders].sort((a, b) => byLeaderOrder(leaderOrder(D))(a.party, b.party));
  const Roll = window.RollNum;
  const cloudFor = mt => {
    const wantFav = mt === "fav";
    return D.individualPolls.filter(p => p.appr && p.x >= xDomain[0] && p.x <= xDomain[1]).flatMap(p => leaders.flatMap(L => {
      const a = p.appr,
        out = [];
      const isFav = (a.metricBy || {})[L.id] === "fav";
      if (a[L.id + "Net"] != null && isFav === wantFav) out.push(a[L.id + "Net"]);
      const alt = a.alt && a.alt[L.id];
      if (alt && alt.net != null && alt.metric === "fav" === wantFav) out.push(alt.net);
      const lab = L.id === "taylor" ? a.oppName || L.short : L.short;
      return out.map(y => ({
        x: p.x,
        y,
        color: L.color,
        label: lab,
        meta: p,
        leader: L.id
      }));
    }));
  };
  const apprScatter = cloudFor(metric);
  const cloudKey = d => d.meta.pollster + "|" + d.meta.released + "|" + d.leader;
  const cross = morph ? window.AP.crossClouds(cloudFor(morph.from), cloudFor(morph.to), morph.t, cloudKey) : null;
  const erasOf = L => L.id === "taylor" ? ["ley", "taylor"] : [null];
  const lineFor = (L, mt, era) => {
    const k = (era || L.id) + "_" + mt;
    return pts.filter(d => d[k] != null).map(d => ({
      ym: d.ym,
      x: d.x,
      v: d[k],
      ci: d[k + "Ci"] != null ? d[k + "Ci"] : null
    }));
  };
  const drawRuns = L => erasOf(L).map(era => {
    if (!morph) return {
      era,
      rows: lineFor(L, metric, era),
      clip: null
    };
    const b = window.AP.blendRows(lineFor(L, morph.from, era), lineFor(L, morph.to, era), morph.t, ["v", "ci"]);
    return b ? {
      era,
      rows: b.rows,
      clip: b.clip
    } : {
      era,
      rows: lineFor(L, metric, era),
      clip: null
    };
  }).filter(d => d.rows.length);
  const drawn = {};
  leaders.forEach(L => {
    drawn[L.id] = drawRuns(L);
  });
  const apprAreas = leaders.flatMap(L => drawn[L.id].map(d => ({
    id: "ci-" + L.id + (d.era ? "-" + d.era : ""),
    color: L.color,
    className: "ci-band",
    edge: false,
    smooth: true,
    clipX: d.clip,
    points: d.rows.filter(r => r.ci != null).map(r => ({
      x: r.x,
      y0: r.v - r.ci,
      y1: r.v + r.ci
    }))
  }))).filter(a => a.points.length >= 2);
  const valsFor = mt => leaders.flatMap(L => D.leaderMonths.flatMap(r => [r[L.id + "_" + mt], L.id === "taylor" ? r["ley_" + mt] : null]).filter(v => v != null)).concat(cloudFor(mt).map(d => d.y)).concat(leaders.flatMap(L => erasOf(L).flatMap(era => lineFor(L, mt, era)).filter(d => d.ci != null).flatMap(d => [d.v - d.ci, d.v + d.ci])));
  const fitFor = mt => {
    const v = valsFor(mt);
    return fitDomain(v.length ? v : [-20, 20], 10, 0);
  };
  const target = fitFor(metric);
  const ticks = target.ticks;
  const domain = morph ? window.AP.blendDomain(fitFor(morph.from).domain, fitFor(morph.to).domain, morph.t) : target.domain;
  const NET_MAX = Math.max(Math.abs(target.domain[0]), Math.abs(target.domain[1]));
  return React.createElement("section", {
    className: "card"
  }, React.createElement("div", {
    className: "card-head"
  }, React.createElement("div", null, React.createElement("h3", {
    className: "card-title"
  }, metric === "net" ? "Leader net approval" : "Leader net favourability"), React.createElement("p", {
    className: "card-sub"
  }, metric === "net" ? React.createElement(React.Fragment, null, React.createElement("button", {
    type: "button",
    className: "hi-term",
    title: "What the approval question asks",
    onClick: () => window.AP.openTerm && window.AP.openTerm("approval", "Leader net approval")
  }, "Approve minus disapprove"), React.createElement(Houses, {
    after: " \u2013 a verdict on the job they\u2019re doing"
  }, houseList(D.apprHouses))) : React.createElement(React.Fragment, null, React.createElement("button", {
    type: "button",
    className: "hi-term",
    title: "What the favourability question asks",
    onClick: () => window.AP.openTerm && window.AP.openTerm("favourability", "Leader net favourability")
  }, "Positive minus negative"), React.createElement(Houses, {
    after: " \u2013 the person, not the job"
  }, houseList(D.favHouses, 5), " ask favourability, not approval")))), React.createElement("div", {
    className: "card-head-tools"
  }, !lockMetric && React.createElement(TextToggle, {
    caps: true,
    value: metric,
    onChange: setMetric,
    ariaLabel: "Net metric",
    options: [{
      id: "net",
      label: "Approval"
    }, {
      id: "fav",
      label: "Favourability"
    }, ...(onBoth ? [{
      id: "both",
      label: "Both"
    }] : [])]
  }), chrome)), React.createElement("div", {
    className: "approval-readout"
  }, ordered.map(L => {
    const r = reads[L.id];
    const net = r ? r.v : null;
    const tag = r && staleTag(r.ym, latestYm);
    const w = net == null ? 0 : Math.min(Math.abs(net), NET_MAX) / NET_MAX * 50;
    return React.createElement("div", {
      className: "appr",
      key: L.id
    }, React.createElement("div", {
      className: "appr-top"
    }, React.createElement("span", {
      className: "leader-dot",
      style: {
        background: L.color
      }
    }), React.createElement("span", {
      className: "leader-name"
    }, L.short, tag && React.createElement("span", {
      className: "stale-tag",
      title: "Latest published reading, " + tag
    }, " ", tag)), net == null ? React.createElement("span", {
      className: "net dash"
    }, "\u2014") : React.createElement("span", {
      className: "net " + (net >= 0 ? "pos" : "neg")
    }, Roll ? React.createElement(Roll, {
      value: (net > 0 ? "+" : "") + net.toFixed(1)
    }) : React.createElement(React.Fragment, null, net > 0 ? "+" : "", net.toFixed(1))), r && r.prev != null && React.createElement(Delta, {
      value: r.v - r.prev,
      suffix: "",
      small: true,
      roll: true,
      title: readoutDeltaTitle(r)
    })), React.createElement("div", {
      className: "appr-netbar",
      "aria-hidden": "true"
    }, React.createElement("span", {
      className: "anb-mid"
    }), React.createElement("span", {
      className: "anb-fill anb-pos",
      style: {
        width: (net != null && net > 0 ? w : 0) + "%"
      }
    }), React.createElement("span", {
      className: "anb-fill anb-neg",
      style: {
        width: (net != null && net < 0 ? w : 0) + "%"
      }
    })));
  })), React.createElement(TrendChart, {
    key: "appr-" + leaders.map(L => L.id).join("."),
    height: narrow ? 460 : 340,
    xDomain: xDomain,
    yDomain: domain,
    yTicks: ticks,
    unit: "",
    axisFont: narrow ? 28 : 20,
    pad: {
      l: 58,
      r: 22,
      t: 22,
      b: 42
    },
    xTicks: buildXTicks(xDomain[0], xDomain[1]),
    refLines: [{
      y: 0,
      label: "even",
      color: "var(--ink-faint)"
    }],
    events: leaders.some(L => L.id === "taylor") ? [OPP_HANDOVER].filter(Boolean) : [],
    series: ordered.flatMap(L => drawn[L.id].map(d => ({
      id: d.era ? L.id + "-" + d.era : L.id,
      label: (d.era === "ley" ? "Ley" : L.short) + " net",
      color: L.color,
      endCap: d.era === "ley" ? false : undefined,
      endLabel: d.era === "ley" ? undefined : L.short,
      clipX: d.clip,
      points: d.rows.map(r => ({
        x: r.x,
        y: r.v
      }))
    }))),
    spine: pts.map(d => ({
      x: d.x
    })),
    areas: apprAreas,
    scatter: cross ? cross.scatter : apprScatter,
    pollFacet: "leadership",
    scatterOut: cross ? cross.scatterOut : [],
    scatterMove: cross ? cross.scatterMove : [],
    fade: morph ? morph.t : 1,
    tooltipTitle: i => window.AP.monthLabelFull(pts[i].ym),
    fmt: v => (v > 0 ? "+" : "") + v.toFixed(1)
  }));
}
const dirFmt = v => v % 1 ? v.toFixed(1) : v.toFixed(0);
const endsSentence = t => /[.?!][’”'"]?$/.test(t);
function Houses({
  after,
  children
}) {
  return React.createElement(React.Fragment, null, after, after == null ? "" : endsSentence(after) ? " " : ". ", React.createElement("em", {
    className: "card-houses"
  }, children, "."));
}
function houseList(names, max = 4) {
  if (!names || !names.length) return "";
  if (names.length > max) return names.slice(0, max).join(", ") + ", and others";
  if (names.length === 1) return names[0];
  return names.slice(0, -1).join(", ") + (names.length > 2 ? ", and " : " and ") + names[names.length - 1];
}
const PLAIN_FRACTIONS = [[1, 5], [1, 4], [1, 3], [2, 5], [1, 2], [3, 5], [2, 3], [7, 10], [3, 4], [4, 5], [9, 10]];
const NUM_WORDS = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
function plainShare(v) {
  const [a, b] = PLAIN_FRACTIONS.reduce((best, f) => Math.abs(v - 100 * f[0] / f[1]) < Math.abs(v - 100 * best[0] / best[1]) ? f : best);
  const d = v - 100 * a / b;
  const lead = Math.abs(d) < 0.5 ? "About" : d < 0 ? "Almost" : "More than";
  return lead + " " + (a === 1 && b === 2 ? "half of" : NUM_WORDS[a] + " in " + NUM_WORDS[b]);
}
function timesWords(r) {
  const h = Math.round(r * 2) / 2;
  if (h >= 11) return "about " + Math.round(r) + " times";
  if (h === 2) return "about twice";
  return "about " + NUM_WORDS[Math.floor(h)] + (h % 1 ? " and a half" : "") + " times";
}
function DirectionPanel({
  rangeId
}) {
  if (window.AP.rd) return React.createElement(RdDirection, {
    rangeId: rangeId
  });
  const {
    D,
    rangeDomain,
    filterPts,
    buildXTicks,
    series
  } = window.AP;
  const narrow = useNarrow();
  const asked = houseList(D.directionHousesAll || D.directionHouses);
  const question = "‘Is the country heading in the right direction, or on the wrong track?’";
  if (!D.direction.length) {
    return React.createElement("section", {
      className: "card"
    }, React.createElement("div", {
      className: "card-head"
    }, React.createElement("div", null, React.createElement("h2", {
      className: "card-title"
    }, "National direction"), React.createElement("p", {
      className: "card-sub"
    }, question))), React.createElement("p", {
      className: "pd-absent"
    }, "No national direction series yet \u2013 none of the tracked pollsters currently publish a right-direction / wrong-track question. It will appear here when one does."));
  }
  const xDomain = rangeDomain(rangeId);
  const pts = filterPts(D.direction, xDomain[0]);
  const now = D.directionNow;
  const latest = now || D.direction[D.direction.length - 1];
  const prev = D.direction[D.direction.length - 2];
  const netDelta = now ? now.chg ?? null : prev ? latest.net - prev.net : null;
  const dirScatter = (D.directionPolls || []).filter(d => d.x >= xDomain[0] && d.x <= xDomain[1]).flatMap(d => [{
    x: d.x,
    y: d.right,
    color: "var(--mood-pos)",
    label: "Right direction",
    meta: d
  }, {
    x: d.x,
    y: d.wrong,
    color: "var(--mood-neg)",
    label: "Wrong track",
    meta: d
  }]);
  const dirBand = (k, ck) => pts.filter(d => d[ck] != null).map(d => ({
    x: d.x,
    y0: d[k] - d[ck],
    y1: d[k] + d[ck]
  }));
  const dirAreas = [{
    id: "ci-right",
    color: "var(--mood-pos)",
    ck: "rightCi",
    k: "right"
  }, {
    id: "ci-wrong",
    color: "var(--mood-neg)",
    ck: "wrongCi",
    k: "wrong"
  }].map(a => ({
    id: a.id,
    color: a.color,
    className: "ci-band",
    edge: false,
    smooth: true,
    points: dirBand(a.k, a.ck)
  })).filter(a => a.points.length >= 2);
  const vals = pts.flatMap(p => [p.right, p.wrong]).concat(dirScatter.map(d => d.y)).concat(dirAreas.flatMap(a => a.points.flatMap(d => [d.y0, d.y1])));
  const lo = Math.floor((Math.min(...vals) - 3) / 5) * 5;
  const hi = Math.ceil((Math.max(...vals) + 3) / 5) * 5;
  const yTicks = [];
  for (let v = lo + 5; v < hi; v += 5) yTicks.push(v);
  const wrongLeads = latest.wrong >= latest.right;
  const side = wrongLeads ? "Wrong track" : "Right direction";
  const moved = netDelta == null || now && now.changeSig === false || Math.abs(netDelta) < 0.5 ? 0 : wrongLeads ? -netDelta : netDelta;
  const head = Math.abs(latest.net) < 2 ? "The country is split on its direction" : moved > 0 ? side + " has widened its lead" : moved < 0 ? side + "’s lead has narrowed" : side + " holds its lead";
  const big = wrongLeads ? latest.wrong : latest.right;
  const dek = plainShare(big) + " Australians (" + big + "%) now say the country is heading in the " + (wrongLeads ? "wrong" : "right") + " direction.";
  const signed = v => (v > 0 ? "+" : v < 0 ? "\u2212" : "") + Math.abs(v);
  return React.createElement("section", {
    className: "card"
  }, React.createElement("div", {
    className: "card-head"
  }, React.createElement("div", null, React.createElement("h2", {
    className: "card-title"
  }, "National direction"), React.createElement("p", {
    className: "card-sub"
  }, asked ? React.createElement(Houses, {
    after: question
  }, asked) : question))), React.createElement(Story, {
    head: head,
    dek: dek
  }), React.createElement("div", {
    className: "dir-figs"
  }, React.createElement("div", {
    className: "dir-fig"
  }, React.createElement("span", {
    className: "dir-v",
    style: {
      color: "var(--mood-pos)"
    }
  }, latest.right, React.createElement("span", {
    className: "pct"
  }, "%")), React.createElement("span", {
    className: "dir-k",
    style: {
      color: "var(--mood-pos)"
    }
  }, "Right direction")), React.createElement("div", {
    className: "dir-fig ta-r"
  }, React.createElement("span", {
    className: "dir-v",
    style: {
      color: "var(--mood-neg)"
    }
  }, latest.wrong, React.createElement("span", {
    className: "pct"
  }, "%")), React.createElement("span", {
    className: "dir-k",
    style: {
      color: "var(--mood-neg)"
    }
  }, "Wrong track"))), React.createElement("div", {
    className: "dir-bar",
    title: `Right direction ${latest.right}%, Unsure ${latest.unsure}%, Wrong track ${latest.wrong}%`
  }, React.createElement("span", {
    className: "dir-pos",
    style: {
      width: latest.right + "%"
    }
  }), React.createElement("span", {
    className: "dir-uns",
    style: {
      width: latest.unsure + "%"
    }
  }), React.createElement("span", {
    className: "dir-neg",
    style: {
      width: latest.wrong + "%"
    }
  })), React.createElement("div", {
    className: "dir-net"
  }, React.createElement("span", {
    className: "dir-net-label"
  }, "Net"), React.createElement("span", {
    className: "dir-net-val " + (latest.net >= 0 ? "pos" : "neg")
  }, signed(latest.net), React.createElement("span", {
    className: "dir-net-u"
  }, "pp")), netDelta != null && React.createElement(React.Fragment, null, React.createElement("span", {
    className: "dir-net-sep",
    "aria-hidden": "true"
  }), React.createElement(Delta, {
    value: netDelta,
    suffix: " pp",
    small: true,
    title: now ? nowDeltaTitle(now) : "Change on the previous month"
  }))), React.createElement(TrendChart, {
    key: "dir",
    height: narrow ? 460 : 340,
    xDomain: xDomain,
    yDomain: [lo, hi],
    yTicks: yTicks,
    unit: "%",
    axisFont: narrow ? 28 : 20,
    pad: {
      l: 58,
      r: 22,
      t: 16,
      b: 42
    },
    xTicks: buildXTicks(xDomain[0], xDomain[1]),
    series: [{
      id: "right",
      label: "Right direction",
      color: "var(--mood-pos)",
      points: series(pts, "right"),
      endLabel: "Right"
    }, {
      id: "wrong",
      label: "Wrong track",
      color: "var(--mood-neg)",
      points: series(pts, "wrong"),
      endLabel: "Wrong"
    }],
    spine: series(pts, "right"),
    areas: dirAreas,
    scatter: dirScatter,
    pollFacet: "direction",
    events: [eventOn("2025-12-14")].filter(Boolean),
    tooltipTitle: i => window.AP.monthLabelFull(pts[i].ym),
    fmt: dirFmt
  }), React.createElement(HowTo, {
    paras: [React.createElement(React.Fragment, null, "Each dot is one published reading; the lines are monthly averages, shaded with their 95% intervals."), React.createElement(React.Fragment, null, "The lines are adjusted for house effects. Only ", asked ? D.directionHouses.length : 0, " houses ask this question, so some months rest on a single poll \u2013 the dots show which, and the shading shows what that costs in confidence.")]
  }));
}
function MoodPanel({
  rangeId
}) {
  if (window.AP.rd) return React.createElement(RdConfidence, {
    rangeId: rangeId
  });
  const {
    D,
    buildXTicks,
    series
  } = window.AP;
  const narrow = useNarrow();
  const M = D.mood;
  if (!M || !M.consumer || !M.business || !M.consumer.polls.length || !M.business.polls.length) return null;
  const C = M.consumer,
    B = M.business;
  const x0 = Math.min(C.polls[0].x, B.polls[0].x) - 0.04;
  const x1 = D.domain.x1;
  const vals = C.polls.concat(B.polls).map(p => p.v).concat([100]);
  const lo = Math.floor((Math.min(...vals) - 2) / 10) * 10,
    hi = Math.ceil((Math.max(...vals) + 2) / 10) * 10;
  const yTicks = [];
  for (let v = lo; v <= hi + 1e-9; v += 10) yTicks.push(v);
  const drawn = {
    c: C.polls.filter(p => p.x >= x0),
    b: B.polls.filter(p => p.x >= x0)
  };
  const scatter = drawn.c.map(q => ({
    x: q.x,
    y: q.v,
    color: "var(--ink)",
    label: "Consumers",
    meta: {
      pollster: "ANZ\u2013Roy Morgan"
    }
  })).concat(drawn.b.map(q => ({
    x: q.x,
    y: q.v,
    color: "var(--ink-2)",
    label: "Businesses",
    meta: {
      pollster: "Roy Morgan"
    }
  })));
  return React.createElement("section", {
    className: "card"
  }, React.createElement("div", {
    className: "card-head"
  }, React.createElement("div", null, React.createElement("h2", {
    className: "card-title"
  }, "Economic sentiment"), React.createElement("p", {
    className: "card-sub"
  }, "Consumer and business confidence, 100 = neutral ", "\u2013", " Roy Morgan", "\u2019", "s own series"))), React.createElement(TrendChart, {
    key: "mood",
    height: narrow ? 460 : 340,
    xDomain: [x0, x1],
    yDomain: [lo, hi],
    yTicks: yTicks,
    axisFont: narrow ? 28 : 20,
    pad: {
      l: 58,
      r: 22,
      t: 16,
      b: 42
    },
    xTicks: buildXTicks(x0, x1),
    refLines: [{
      y: 100,
      label: "100 = neutral",
      align: "left",
      color: "var(--ink-3)"
    }],
    series: [{
      id: "consumer",
      label: "Consumers",
      color: "var(--ink)",
      points: series(drawn.c, "v"),
      endLabel: "Consumers"
    }, {
      id: "business",
      label: "Businesses",
      color: "var(--ink-2)",
      points: series(drawn.b, "v"),
      endLabel: "Businesses"
    }],
    spine: series(drawn.c, "v"),
    scatter: scatter,
    tooltipTitle: i => window.AP.monthLabelFull(drawn.c[i].ym),
    fmt: v => v.toFixed(1)
  }), React.createElement(HowTo, {
    paras: [React.createElement(React.Fragment, null, "Roy Morgan", "\u2019", "s own index series, set out as published ", "\u2013", " the weekly ANZ", "\u2013", "Roy Morgan consumer index and the monthly business index, back to 2019. No averaging, no adjustment for lean, no election anchor is applied."), React.createElement(React.Fragment, null, "On each index 100 is neutral ", "\u2013", " above it optimists outnumber pessimists. Reading economic sentiment beside the polls is context, not a predictor of the vote.")]
  }));
}
function UndecidedPanel({
  rangeId
}) {
  if (window.AP.rd) return React.createElement(RdUndecided, {
    rangeId: rangeId
  });
  const {
    D,
    rangeDomain,
    filterPts,
    buildXTicks,
    series
  } = window.AP;
  const narrow = useNarrow();
  const [view, setView] = useState("all");
  const U = D.undecided;
  if (!U || !U.series.length) return null;
  const F = D.firmness,
    A = U.softAge;
  const views = UND_VIEWS.filter(v => v.id === "all" || v.id === "party" && F || v.id === "age" && A);
  const ctl = views.length > 1 && React.createElement("div", {
    className: "ons-ctl"
  }, React.createElement(Segmented, {
    options: views,
    value: view,
    onChange: setView,
    size: "sm",
    ariaLabel: "Undecided among"
  }));
  const extra = view === "party" && F ? {
    sub: React.createElement(Houses, {
      after: "Share of each party\u2019s voters certain of their vote"
    }, houseList(F.houses.map(demoHouse))),
    body: React.createElement(FirmnessView, {
      F: F,
      rangeId: rangeId
    })
  } : view === "age" && A ? {
    sub: React.createElement(Houses, {
      after: "Share of each age group not firm in its vote"
    }, houseList(A.houses)),
    body: React.createElement(AgeFirmView, {
      A: A,
      rangeId: rangeId
    })
  } : null;
  if (extra) return React.createElement("section", {
    className: "card"
  }, React.createElement("div", {
    className: "card-head"
  }, React.createElement("div", null, React.createElement("h2", {
    className: "card-title"
  }, "Undecided"), React.createElement("p", {
    className: "card-sub"
  }, extra.sub))), ctl, extra.body);
  const xDomain = rangeDomain(rangeId);
  const COL = "var(--ink-2)";
  const drawn = U.series.map(sr => {
    const pts = filterPts(sr.monthly, xDomain[0]);
    const dots = sr.polls.filter(d => d.x >= xDomain[0] && d.x <= xDomain[1]).map(d => ({
      x: d.x,
      y: d.v,
      color: COL,
      label: sr.label,
      meta: d
    }));
    return {
      sr,
      pts,
      dots
    };
  }).filter(d => d.pts.length >= 2);
  if (!drawn.length) return null;
  const vals = drawn.flatMap(d => d.pts.map(p => p.v).concat(d.dots.map(p => p.y)));
  const rawLo = Math.max(0, Math.min(...vals) - 1.5);
  const rawHi = Math.max(...vals) + 1.5;
  const step = [1, 2, 5, 10, 20].find(s => (rawHi - rawLo) / s <= 6) ?? 20;
  const lo = Math.max(0, Math.floor(rawLo / step) * step);
  const hi = Math.ceil(rawHi / step) * step;
  const yTicks = [];
  for (let v = lo + step; v < hi; v += step) yTicks.push(v);
  const spine = drawn[0].pts;
  let termHead = null;
  const termLead = (() => {
    const sr = U.series.find(s => s.id === "first") || U.series[0];
    if (!sr || sr.monthly.length < 2) return null;
    if (!sr.monthly.some(m => m.ym > "2025-05")) return null;
    const base = sr.monthly.filter(m => m.ym <= "2025-05").pop() || sr.monthly[0];
    const nowV = sr.now ? sr.now.v : sr.latest.v;
    const d = nowV - base.v;
    termHead = Math.abs(d) < 1 ? "Undecided share steady since the election" : d > 0 ? "More voters undecided than at the election" : "Fewer voters undecided than at the election";
    if (Math.abs(d) < 1) return "The share of undecided and uncommitted has remained fairly constant since the 2025 election.";
    return "The share of undecided and uncommitted voters has " + (d > 0 ? "risen" : "fallen") + " since the 2025 election, from " + base.v.toFixed(1) + "% in " + window.AP.monthLabelFull(base.ym) + " to " + nowV.toFixed(1) + "% now.";
  })();
  return React.createElement("section", {
    className: "card"
  }, React.createElement("div", {
    className: "card-head"
  }, React.createElement("div", null, React.createElement("h2", {
    className: "card-title"
  }, "Undecided"), React.createElement("p", {
    className: "card-sub"
  }, React.createElement(Houses, {
    after: "Electors who won\u2019t name a choice, or won\u2019t call theirs firm"
  }, houseList(U.houses))))), ctl, React.createElement(Story, {
    head: termLead && termHead,
    dek: termLead
  }), React.createElement("div", {
    className: "und-reads"
  }, U.series.map(sr => React.createElement("div", {
    className: "und-read",
    key: sr.id
  }, React.createElement("span", {
    className: "und-swatch" + (sr.dashed ? " dashed" : sr.dash ? " dotted" : ""),
    "aria-hidden": "true"
  }), React.createElement("div", {
    className: "und-read-body"
  }, React.createElement("div", {
    className: "und-read-top"
  }, React.createElement("span", {
    className: "und-read-lab"
  }, sr.label), React.createElement("span", {
    className: "und-read-v"
  }, (sr.now ? sr.now.v : sr.latest.v).toFixed(1), React.createElement("span", {
    className: "pct"
  }, "%")), sr.now ? sr.now.chg != null && React.createElement(Delta, {
    value: sr.now.chg,
    goodUp: false,
    small: true,
    title: "vs a month ago" + (sr.now.changeSig === false ? " – within the margin" : "")
  }) : React.createElement("span", {
    className: "und-read-stale"
  }, "last reading, ", sr.latest.field)), React.createElement("p", {
    className: "und-read-note"
  }, React.createElement(Houses, {
    after: sr.note[0].toUpperCase() + sr.note.slice(1)
  }, houseList(sr.houses))))))), React.createElement(TrendChart, {
    key: "und",
    height: narrow ? 460 : 340,
    xDomain: xDomain,
    yDomain: [lo, hi],
    yTicks: yTicks,
    unit: "%",
    axisFont: narrow ? 28 : 20,
    pad: {
      l: narrow ? 84 : 58,
      r: 22,
      t: 16,
      b: 42
    },
    xTicks: buildXTicks(xDomain[0], xDomain[1]),
    series: drawn.map(d => ({
      id: d.sr.id,
      label: d.sr.label,
      color: COL,
      dashed: d.sr.dashed,
      dash: d.sr.dash,
      points: series(d.pts, "v")
    })),
    spine: series(spine, "v"),
    scatter: drawn.flatMap(d => d.dots),
    pollFacet: "twopp",
    tooltipTitle: i => window.AP.monthLabelFull(spine[i].ym),
    fmt: v => v.toFixed(1)
  }), React.createElement(HowTo, {
    paras: [React.createElement(React.Fragment, null, "Each dot is one published reading; the lines are monthly averages, and the figure beside each question pools the last six weeks of polls."), React.createElement(React.Fragment, null, "Newer and larger polls count for more in the figure beside each question."), React.createElement(React.Fragment, null, "The questions are never averaged together \u2013 one counts people who can\u2019t name a party, the other people who won\u2019t pick a side once preferences are applied. Only the first is left out of the shares elsewhere on this page, so a rising line means the share is being read off a smaller pool of decided voters, not that support has moved.")]
  }));
}
const UND_VIEWS = [{
  id: "all",
  label: "All voters"
}, {
  id: "party",
  label: "By party"
}, {
  id: "age",
  label: "By age"
}];
const FIRM_ORDER = ["onp", "alp", "lnp", "grn", "oth"];
const firmWho = k => k === "oth" ? "voters for others & independents" : window.AP.D.PARTIES[k].name + " voters";
const firmApart = (a, b) => Math.abs(a.v - b.v) > Math.hypot(a.ci95, b.ci95);
const firmSaid = (cls, t, sig) => React.createElement("p", {
  className: cls
}, sig ? React.createElement("mark", null, t) : t);
function FirmnessView({
  F,
  rangeId
}) {
  const {
    D,
    rangeDomain,
    buildXTicks
  } = window.AP;
  const narrow = useNarrow();
  const xDomain = rangeDomain(rangeId);
  const parties = FIRM_ORDER.filter(k => F.now[k]).sort((a, b) => F.now[b].v - F.now[a].v);
  const cap = s => s[0].toUpperCase() + s.slice(1);
  const lead = (() => {
    const [top, next] = parties;
    const t = F.now[top];
    if (parties.slice(1).every(k => firmApart(t, F.now[k]) && t.v > F.now[k].v)) return [`${cap(firmWho(top))} are significantly more likely than any other party’s voters to be certain of their vote: ${Math.round(t.v)}%, against ${Math.round(F.now[next].v)}% of ${firmWho(next)}.`, true, `${cap(firmWho(top))} the most certain of their vote`];
    return [`${cap(firmWho(top))} are the most likely to be certain of their vote, at ${Math.round(t.v)}%, but not by more than the margin over ${firmWho(next)}.`, false, "No party’s voters clearly the most certain"];
  })();
  const shift = (() => {
    const moved = parties.map(k => ({
      k,
      d: F.now[k].v - F.base[k].v
    })).filter(({
      k
    }) => firmApart(F.now[k], F.base[k])).sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
    if (!moved.length) return ["No party’s share of voters certain of their vote has changed significantly since the months after the 2025 election.", false];
    const {
      k,
      d
    } = moved[0];
    return [`Since the months after the 2025 election, the share of ${firmWho(k)} certain of their vote has ${d < 0 ? "fallen" : "risen"} significantly, from ${Math.round(F.base[k].v)}% to ${Math.round(F.now[k].v)}%.`, true];
  })();
  const rolled = F.waves.map((w, i) => {
    const ws = F.waves.slice(Math.max(0, i - F.pool + 1), i + 1);
    const r = {
      x: w.x
    };
    for (const k of parties) {
      const n = ws.reduce((a, v) => a + v.n[k], 0);
      r[k] = ws.reduce((a, v) => a + v.n[k] * v.solid[k], 0) / n;
    }
    return r;
  });
  const inX = w => w.x >= xDomain[0] && w.x <= xDomain[1];
  const waves = F.waves.filter(inX),
    lines = rolled.filter(inX);
  if (waves.length < 2) return React.createElement(Story, {
    head: lead[2],
    dek: lead[0]
  });
  const vals = waves.flatMap(w => parties.map(k => w.solid[k]));
  const lo = Math.max(0, Math.floor((Math.min(...vals) - 3) / 10) * 10);
  const hi = Math.min(100, Math.ceil((Math.max(...vals) + 3) / 10) * 10);
  const yTicks = [];
  for (let v = lo + 10; v < hi; v += 10) yTicks.push(v);
  const pts = k => lines.map(w => ({
    x: w.x,
    y: w[k]
  }));
  const dots = waves.flatMap(w => parties.map(k => ({
    x: w.x,
    y: w.solid[k],
    color: D.PARTIES[k].color,
    label: D.PARTIES[k].name,
    meta: w
  })));
  return React.createElement(React.Fragment, null, React.createElement(Story, {
    head: lead[2],
    dek: lead[0]
  }), React.createElement("div", {
    className: "und-reads"
  }, [...parties, "all"].map(k => {
    const r = F.now[k];
    return React.createElement("div", {
      className: "und-read",
      key: k
    }, React.createElement("span", {
      className: "und-swatch",
      style: {
        background: k === "all" ? "var(--ink-3)" : D.PARTIES[k].color
      },
      "aria-hidden": "true"
    }), React.createElement("div", {
      className: "und-read-body"
    }, React.createElement("div", {
      className: "und-read-top"
    }, React.createElement("span", {
      className: "und-read-lab"
    }, k === "all" ? "All voters" : D.PARTIES[k].name), React.createElement("span", {
      className: "und-read-v"
    }, r.v.toFixed(1), React.createElement("span", {
      className: "pct"
    }, "%")), React.createElement("span", {
      className: "read-ci",
      title: "95% margin"
    }, "\xB1 ", r.ci95.toFixed(1)))));
  })), React.createElement(TrendChart, {
    key: "firm",
    height: narrow ? 460 : 340,
    xDomain: xDomain,
    yDomain: [lo, hi],
    yTicks: yTicks,
    unit: "%",
    axisFont: narrow ? 28 : 20,
    pad: {
      l: narrow ? 84 : 58,
      r: 22,
      t: 16,
      b: 42
    },
    xTicks: buildXTicks(xDomain[0], xDomain[1]),
    series: parties.map(k => ({
      id: k,
      label: D.PARTIES[k].name,
      color: D.PARTIES[k].color,
      width: k === "oth" ? 2 : 3,
      dashed: k === "oth",
      points: pts(k),
      endLabel: D.PARTIES[k].short
    })),
    spine: pts(parties[0]),
    scatter: dots,
    pollFacet: "twopp",
    tooltipTitle: i => waves[i] && waves[i].dateLabel,
    fmt: v => v.toFixed(0),
    copy: {
      sub: `Share of each party’s voters certain of their vote, wave by wave, ${houseList(F.houses.map(demoHouse))}`,
      legend: parties.map(k => ({
        label: `${D.PARTIES[k].name}  ${F.now[k].v.toFixed(1)}%`,
        color: D.PARTIES[k].color,
        kind: "line"
      }))
    }
  }), firmSaid("demo-verdict", shift[0], shift[1]), React.createElement(HowTo, {
    paras: [React.createElement(React.Fragment, null, "Each dot is one RedBridge wave; the lines and the figures above pool three waves at a time, the figures its latest three (", F.now.from, " to ", F.now.to, ")."), React.createElement(React.Fragment, null, "Certain voters are RedBridge\u2019s \u201Csolid\u201D voters: they named a party when first asked and are certain they will vote that way. The rest are soft \u2013 they may change their vote \u2013 or very soft: they named a party only when pressed, or say they will probably change."), React.createElement(React.Fragment, null, "Each wave counts in proportion to how many of a party\u2019s voters it asked, so the figure for a small party rests on a few hundred people and carries a wider margin. Two figures differ significantly when the gap between them is larger than their two margins combined."), React.createElement(React.Fragment, null, "This is a different question from Resolve\u2019s \u201Chow firm are you\u201D in the All voters view, which is why the shares there are lower.")]
  }));
}
const AGE_BANDS = [{
  id: "18-34",
  label: "18–34",
  who: "voters aged 18–34"
}, {
  id: "35-54",
  label: "35–54",
  who: "those aged 35–54"
}, {
  id: "55+",
  label: "55+",
  who: "those 55 and over"
}];
function AgeFirmView({
  A,
  rangeId
}) {
  const {
    rangeDomain,
    buildXTicks
  } = window.AP;
  const narrow = useNarrow();
  const xDomain = rangeDomain(rangeId);
  const col = i => ["var(--accent)", "color-mix(in oklch, var(--accent) 45%, var(--ink-3))", "var(--ink-2)"][i];
  const pct = b => Math.round(A.now[b.id].v) + "%";
  const cap = s => s[0].toUpperCase() + s.slice(1);
  const lead = (() => {
    const [y, m, o] = AGE_BANDS,
      N = A.now;
    if (N[y.id].v > N[m.id].v && N[m.id].v > N[o.id].v && firmApart(N[y.id], N[m.id]) && firmApart(N[m.id], N[o.id])) return [`Firmness rises significantly with age: ${pct(y)} of voters aged 18–34 aren’t firm in their vote, against ${pct(m)} of those aged 35–54 and ${pct(o)} of those 55 and over.`, true, "Voters are firmer the older they are"];
    const [f, ...rest] = [...AGE_BANDS].sort((a, b) => N[a.id].v - N[b.id].v);
    if (rest.every(b => firmApart(N[f.id], N[b.id]))) return [`${cap(f.who)} are significantly the firmest: ${pct(f)} aren’t firm in their vote, against ${pct(rest[0])} of ${rest[0].who} and ${pct(rest[1])} of ${rest[1].who}.`, true, `Voters aged ${f.label} the firmest`];
    return ["Resolve finds no significant difference in how firm voters are between age groups.", false, "No age group clearly firmer than the others"];
  })();
  const shift = (() => {
    const moved = AGE_BANDS.map(b => ({
      b,
      d: A.now[b.id].v - A.base[b.id].v
    })).filter(({
      b
    }) => firmApart(A.now[b.id], A.base[b.id])).sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
    if (!moved.length) return ["No age group’s share not firm in its vote has changed significantly since the months after the 2025 election.", false];
    const {
      b,
      d
    } = moved[0];
    return [`Since the months after the 2025 election, the share of ${b.who} not firm in their vote has ${d > 0 ? "risen" : "fallen"} significantly, from ${Math.round(A.base[b.id].v)}% to ${Math.round(A.now[b.id].v)}%.`, true];
  })();
  const rolled = A.waves.map((w, i) => {
    const ws = A.waves.slice(Math.max(0, i - A.pool + 1), i + 1);
    const r = {
      x: w.x
    };
    for (const b of AGE_BANDS) {
      const n = ws.reduce((a, v) => a + v.n[b.id], 0);
      r[b.id] = ws.reduce((a, v) => a + v.n[b.id] * v.soft[b.id], 0) / n;
    }
    return r;
  });
  const inX = w => w.x >= xDomain[0] && w.x <= xDomain[1];
  const waves = A.waves.filter(inX),
    lines = rolled.filter(inX);
  if (waves.length < 2) return React.createElement(Story, {
    head: lead[2],
    dek: lead[0]
  });
  const vals = waves.flatMap(w => AGE_BANDS.map(b => w.soft[b.id]));
  const lo = Math.max(0, Math.floor((Math.min(...vals) - 3) / 10) * 10);
  const hi = Math.min(100, Math.ceil((Math.max(...vals) + 3) / 10) * 10);
  const yTicks = [];
  for (let v = lo + 10; v < hi; v += 10) yTicks.push(v);
  const pts = b => lines.map(w => ({
    x: w.x,
    y: w[b.id]
  }));
  const dots = waves.flatMap(w => AGE_BANDS.map((b, i) => ({
    x: w.x,
    y: w.soft[b.id],
    color: col(i),
    label: b.label,
    meta: w
  })));
  return React.createElement(React.Fragment, null, React.createElement(Story, {
    head: lead[2],
    dek: lead[0]
  }), React.createElement("div", {
    className: "und-reads"
  }, AGE_BANDS.map((b, i) => React.createElement("div", {
    className: "und-read",
    key: b.id
  }, React.createElement("span", {
    className: "und-swatch",
    style: {
      background: col(i)
    },
    "aria-hidden": "true"
  }), React.createElement("div", {
    className: "und-read-body"
  }, React.createElement("div", {
    className: "und-read-top"
  }, React.createElement("span", {
    className: "und-read-lab"
  }, b.label), React.createElement("span", {
    className: "und-read-v"
  }, A.now[b.id].v.toFixed(1), React.createElement("span", {
    className: "pct"
  }, "%")), React.createElement("span", {
    className: "read-ci",
    title: "95% margin"
  }, "\xB1 ", A.now[b.id].ci95.toFixed(1))))))), React.createElement(TrendChart, {
    key: "soft-age",
    height: narrow ? 460 : 340,
    xDomain: xDomain,
    yDomain: [lo, hi],
    yTicks: yTicks,
    unit: "%",
    axisFont: narrow ? 28 : 20,
    pad: {
      l: narrow ? 84 : 58,
      r: 22,
      t: 16,
      b: 42
    },
    xTicks: buildXTicks(xDomain[0], xDomain[1]),
    series: AGE_BANDS.map((b, i) => ({
      id: b.id,
      label: b.label,
      color: col(i),
      points: pts(b),
      endLabel: b.label
    })),
    spine: pts(AGE_BANDS[0]),
    scatter: dots,
    pollFacet: "twopp",
    tooltipTitle: i => waves[i] && waves[i].dateLabel,
    fmt: v => v.toFixed(0),
    copy: {
      sub: `Share of each age group not firm in its vote, wave by wave, ${houseList(A.houses)}`,
      legend: AGE_BANDS.map((b, i) => ({
        label: `${b.label}  ${A.now[b.id].v.toFixed(1)}%`,
        color: col(i),
        kind: "line"
      }))
    }
  }), firmSaid("demo-verdict", shift[0], shift[1]), React.createElement(HowTo, {
    paras: [React.createElement(React.Fragment, null, "Each dot is one Resolve wave; the lines and the figures above pool three waves at a time, the figures its latest three (", A.now.from, " to ", A.now.to, ")."), React.createElement(React.Fragment, null, "Not firm is Resolve\u2019s \u201Csoft\u201D answer to \u201CHow firm are you with your vote?\u201D: voters who named a party but say they might change. It is the All voters view\u2019s \u201CNot firm\u201D line, split by age."), React.createElement(React.Fragment, null, "Resolve doesn\u2019t publish how many people in each age group it asked, so each group is counted in proportion to its share of adults (2021 Census), the mix Resolve\u2019s sample is weighted to. Two figures differ significantly when the gap between them is larger than their two margins combined.")]
  }));
}
const ONS_VIEWS = [{
  id: "gain",
  label: "Of One Nation’s gain"
}, {
  id: "rate",
  label: "Of each party’s voters"
}];
function OnSourcesPanel({
  rangeId
}) {
  if (window.AP.rd) return React.createElement(RdSwitching, {
    rangeId: rangeId
  });
  const {
    D,
    rangeDomain,
    filterPts,
    buildXTicks,
    series
  } = window.AP;
  const narrow = useNarrow();
  const [view, setView] = useState("gain");
  const S = D.onSources;
  if (!S || !S.series.length) return null;
  const [rangeLo, rangeHi] = rangeDomain(rangeId);
  const rated = view === "rate" && S.series.every(sr => sr.rate);
  const src = sr => rated ? sr.rate : sr;
  const firstX = Math.min(...S.series.map(sr => (src(sr).monthly[0] || {
    x: Infinity
  }).x));
  const xDomain = [Math.max(rangeLo, firstX - 0.06), rangeHi];
  const drawn = S.series.map(sr => {
    const pts = filterPts(src(sr).monthly, xDomain[0]);
    const dots = src(sr).polls.filter(d => d.x >= xDomain[0] && d.x <= xDomain[1]).map(d => ({
      x: d.x,
      y: d.v,
      color: sr.color,
      label: sr.label,
      meta: d
    }));
    return {
      sr,
      pts,
      dots
    };
  }).filter(d => d.pts.length >= 1);
  if (!drawn.length) return null;
  const vals = drawn.flatMap(d => d.pts.map(p => p.v + (p.ci95 || 0)).concat(d.dots.map(p => p.y)));
  const hi = Math.ceil((Math.max(...vals) + 3) / 10) * 10;
  const areas = drawn.map(d => ({
    id: "ci-" + d.sr.id,
    color: d.sr.color,
    className: "ci-band",
    edge: false,
    smooth: true,
    points: d.pts.filter(p => p.ci95 != null).map(p => ({
      x: p.x,
      y0: Math.max(0, p.v - p.ci95),
      y1: p.v + p.ci95
    }))
  })).filter(a => a.points.length >= 2);
  const yTicks = [];
  for (let v = 10; v < hi; v += 10) yTicks.push(v);
  const spine = drawn.reduce((a, d) => d.pts.length > a.length ? d.pts : a, []);
  const monthOf = ym => D.monthNameFull(+ym.slice(5)) + " " + ym.slice(0, 4);
  const reads = S.series.map(sr => {
    const now = src(sr).now;
    if (now) return {
      sr,
      v: now.v,
      now,
      chg: now.chg ?? null
    };
    const m = src(sr).monthly,
      last = m[m.length - 1],
      prev = m[m.length - 2];
    return {
      sr,
      v: last.v,
      ym: last.ym,
      chg: prev ? +(last.v - prev.v).toFixed(1) : null
    };
  });
  const [a, b] = reads;
  const onsLead = (() => {
    const when = a.now ? "" : "In " + monthOf(a.ym);
    const lead = s => when ? `${when}, ${s}` : s[0].toUpperCase() + s.slice(1);
    if (!(a.v > 0 && b.v > 0)) return lead(`${a.v.toFixed(1)}% against ${b.v.toFixed(1)}%.`);
    const lnpMore = a.v >= b.v,
      x = lnpMore ? a.v / b.v : b.v / a.v;
    if (rated) {
      const [more, less] = lnpMore ? ["people who voted for the Coalition in 2025", "Labor voters"] : ["people who voted Labor in 2025", "Coalition voters"];
      return x < 1.25 ? lead(`people who voted for the Coalition or Labor in 2025 ${a.now ? "are" : "were"} about as likely as each other to now back One Nation.`) : lead(`${more} ${a.now ? "are" : "were"} ${timesWords(x)} as likely as ${less} to now back One Nation.`);
    }
    const [more, less] = lnpMore ? ["the Coalition", "Labor"] : ["Labor", "the Coalition"];
    const has = a.now ? "has" : "had";
    return x < 1.25 ? lead(`the Coalition and Labor ${a.now ? "have" : "had"} lost about as many voters to One Nation as each other since the 2025 election.`) : lead(`${more} ${has} lost ${timesWords(x)} as many voters to One Nation as ${less} ${has} since the 2025 election.`);
  })();
  const onsHead = (() => {
    if (!(a.v > 0 && b.v > 0)) return null;
    const lnpMore = a.v >= b.v,
      even = (lnpMore ? a.v / b.v : b.v / a.v) < 1.25;
    if (rated) return even ? "Coalition and Labor voters switching at similar rates" : (lnpMore ? "Coalition" : "Labor") + " voters likelier to have switched to One Nation";
    return even ? "Coalition and Labor losing voters to One Nation alike" : (lnpMore ? "The Coalition" : "Labor") + (a.now ? " is" : " was") + " losing more voters to One Nation";
  })();
  return React.createElement("section", {
    className: "card"
  }, React.createElement("div", {
    className: "card-head"
  }, React.createElement("div", null, React.createElement("h2", {
    className: "card-title"
  }, "Where One Nation\u2019s new voters came from"), React.createElement("p", {
    className: "card-sub"
  }, rated ? "Share of each party’s 2025 voters now backing One Nation" : "Share of One Nation’s gain since the 2025 election, by how those voters voted in 2025", ". ", React.createElement("em", {
    className: "card-houses"
  }, houseList(S.houses), ".")))), S.series.every(sr => sr.rate) && React.createElement("div", {
    className: "ons-ctl"
  }, React.createElement(Segmented, {
    options: ONS_VIEWS,
    value: view,
    onChange: setView,
    size: "sm",
    ariaLabel: "Figures as a share"
  })), React.createElement(Story, {
    head: onsHead,
    dek: onsLead
  }), React.createElement("div", {
    className: "und-reads"
  }, reads.map(({
    sr,
    v,
    chg,
    now
  }) => React.createElement("div", {
    className: "und-read",
    key: sr.id
  }, React.createElement("span", {
    className: "und-swatch",
    style: {
      background: sr.color
    },
    "aria-hidden": "true"
  }), React.createElement("div", {
    className: "und-read-body"
  }, React.createElement("div", {
    className: "und-read-top"
  }, React.createElement("span", {
    className: "und-read-lab"
  }, sr.label), React.createElement("span", {
    className: "und-read-v"
  }, v.toFixed(1), React.createElement("span", {
    className: "pct"
  }, "%")), now && now.ci95 != null && React.createElement("span", {
    className: "read-ci",
    title: "95% margin"
  }, "\xB1 ", now.ci95.toFixed(1)), chg != null && React.createElement(Delta, {
    value: chg,
    neutral: true,
    small: true,
    title: now ? nowDeltaTitle(now) : "Change on the previous month"
  })), React.createElement("p", {
    className: "und-read-note"
  }, sr.note))))), React.createElement(TrendChart, {
    key: "ons",
    height: narrow ? 460 : 340,
    xDomain: xDomain,
    yDomain: [0, hi],
    yTicks: yTicks,
    unit: "%",
    axisFont: narrow ? 28 : 20,
    pad: {
      l: narrow ? 84 : 58,
      r: 22,
      t: 16,
      b: 42
    },
    xTicks: buildXTicks(xDomain[0], xDomain[1]),
    series: drawn.map(d => ({
      id: d.sr.id,
      label: d.sr.label,
      color: d.sr.color,
      points: series(d.pts, "v"),
      endLabel: d.sr.short || d.sr.label.replace(/ voters$/, "")
    })),
    spine: series(spine, "v"),
    areas: areas,
    scatter: drawn.flatMap(d => d.dots),
    pollFacet: "twopp",
    tooltipTitle: i => window.AP.monthLabelFull(spine[i].ym),
    extraRows: i => {
      const ym = spine[i] && spine[i].ym;
      const cs = drawn.map(d => {
        const p = d.pts.find(q => q.ym === ym);
        return p && p.ci95 != null ? (d.sr.short || d.sr.label.replace(/ voters$/, "")) + " ±" + p.ci95.toFixed(1) : null;
      }).filter(Boolean);
      return cs.length ? [{
        label: "95% intervals",
        value: cs.join(", ")
      }] : [];
    },
    fmt: v => v.toFixed(1),
    copy: {
      legend: reads.filter(r => drawn.some(d => d.sr.id === r.sr.id)).map(({
        sr,
        v
      }) => ({
        label: `${sr.label}  ${v.toFixed(1)}%`,
        color: sr.color,
        kind: "line"
      })).concat([{
        label: "Shading: 95% interval",
        color: "var(--ink-3)",
        kind: "shade"
      }])
    }
  }), React.createElement(HowTo, {
    paras: [React.createElement(React.Fragment, null, "Each dot is one poll\u2019s ", rated ? "figure" : "split", " and the lines are monthly averages, shaded by their 95% interval; the figures above pool the last ", S.now ? S.now.window : "six weeks", " of polls.", " ", React.createElement("button", {
      type: "button",
      className: "hi-term",
      onClick: () => window.AP.openTerm && window.AP.openTerm("vote-switching", "Where One Nation’s new voters came from")
    }, "How it\u2019s worked out")), React.createElement(React.Fragment, null, "Newer polls count for more in the figures above."), React.createElement(React.Fragment, null, "The two views come from the same tables. \u201COf each party\u2019s voters\u201D is the share of each party\u2019s 2025 voters now backing One Nation. Weighted by that party\u2019s share of the 2025 vote, it becomes the party\u2019s part of One Nation\u2019s gain, so 38% of Coalition voters counts for far more than 38% of a small party\u2019s."), React.createElement(React.Fragment, null, "Voters who can\u2019t recall a 2025 vote are left out, and so are One Nation\u2019s own 2025 voters, who are what it kept rather than gained.")]
  }));
}
const DEMO_PARTIES = [{
  id: "onp",
  label: "One Nation",
  short: "ON"
}, {
  id: "alp",
  label: "Labor",
  short: "ALP"
}, {
  id: "lnp",
  label: "Coalition",
  short: "L/NP"
}, {
  id: "grn",
  label: "Greens",
  short: "GRN"
}, {
  id: "oth",
  label: "Others",
  short: "OTH"
}];
const demoHouse = h => h === "RedBridge/Accent" ? "RedBridge" : h.replace(/ \(pooled\)$/, "");
const DEMO_GRP_PARTY = ["alp", "lnp", "grn", "onp", "oth"];
const demoGrpAt = q => q.grp && q.grp.sp ? q.grp.sp.map((s, i) => ({
  ...s,
  part: i,
  of: q.grp.sp.length
})) : [{
  x: q.x,
  ym: q.ym,
  k: 1
}];
const demoPartMeta = (q, s) => s.part == null ? q : {
  ...q,
  dateLabel: s.l
};
const demoPartSub = (q, s, n) => s.part == null ? n ? "n ≈ " + n.toLocaleString() : undefined : (n ? "n ≈ " + Math.round(n * s.k).toLocaleString() + " · " : "") + "one of " + s.of + " polls in the " + q.field + " tables";
const demoRamp = (color, n, i) => n < 2 ? color : `color-mix(in oklch, ${color} ${Math.round(100 - i * 60 / (n - 1))}%, var(--ink))`;
const DEMO_WHO = {
  "18–34": "voters aged 18–34",
  "35–54": "voters aged 35–54",
  "55+": "voters aged 55 and over",
  "Gen Z": "Gen Z voters",
  Millennials: "Millennials",
  "Gen X": "Gen X voters",
  Boomers: "Boomers",
  Men: "men",
  Women: "women",
  "Year 12 or less": "voters with Year 12 or less",
  "TAFE or trade": "TAFE- or trade-qualified voters",
  University: "university graduates",
  NSW: "voters in NSW",
  Vic: "voters in Victoria",
  Qld: "voters in Queensland",
  SA: "voters in South Australia",
  WA: "voters in Western Australia",
  "ACT/NT/Tas": "voters in Tasmania, the ACT and the NT",
  "Non-NSW/Vic/Qld": "voters in SA, WA, Tasmania, and the territories",
  "Inner metro": "voters in the inner suburbs",
  "Outer metro": "voters in the outer suburbs",
  Provincial: "voters in provincial towns and cities",
  Rural: "rural voters",
  "Own outright": "voters who own their home outright",
  Mortgage: "voters with a mortgage",
  Renting: "renters",
  "English only": "voters who speak only English at home",
  "Other language": "voters who speak another language at home",
  "Full time": "full-time workers",
  "Part time": "part-time workers",
  Retired: "retirees",
  "Lower earners (bottom 50%)": "lower earners",
  "Higher earners (top 15%)": "higher earners"
};
const DEMO_SET_WORDS = {
  age: {
    all: "age groups",
    others: "any other age group",
    step: "with each older age group",
    one: "age group"
  },
  generation: {
    all: "generations",
    others: "any other generation",
    step: "with each older generation",
    one: "generation"
  },
  gender: {
    all: "men and women",
    others: null,
    step: null
  },
  education: {
    all: "levels of education",
    others: "voters with other levels of education",
    step: null,
    one: "education group"
  },
  state: {
    all: "the states",
    others: "voters in other states",
    step: null,
    one: "state"
  },
  location: {
    all: "the city and the country",
    others: "voters in other areas",
    step: "with each step further from the city",
    one: "area"
  },
  housing: {
    all: "owners and renters",
    others: "other voters",
    step: null,
    one: "group"
  },
  language: {
    all: "voters who speak only English at home and those who don’t",
    others: null,
    step: null
  },
  working: {
    all: "work-status groups",
    others: "voters of other work statuses",
    step: null,
    one: "work-status group"
  },
  income: {
    all: "earner bands",
    others: "higher earners",
    step: null,
    one: "earner band"
  }
};
const DEMO_VOTE_FOR = {
  alp: "Labor",
  lnp: "the Coalition",
  grn: "the Greens",
  onp: "One Nation",
  oth: "others & independents"
};
function zTail(z) {
  const x = Math.abs(z) / Math.SQRT2,
    t = 1 / (1 + 0.3275911 * x);
  return t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429)))) * Math.exp(-x * x);
}
const DEMO_WITHIN = {
  SA: "Non-NSW/Vic/Qld",
  WA: "Non-NSW/Vic/Qld",
  "ACT/NT/Tas": "Non-NSW/Vic/Qld"
};
const demoNested = (a, b) => DEMO_WITHIN[a.label] === b.label || DEMO_WITHIN[b.label] === a.label;
function demoFinding(st, party) {
  const gs = st.groups.filter(g => g.v[party] != null && g.ci[party] != null);
  if (gs.length < 2) return null;
  const words = DEMO_SET_WORDS[st.id] || {
    step: null
  };
  const gaps = gs.flatMap((a, i) => gs.slice(i + 1).filter(b => !demoNested(a, b)).map(b => {
    const m = Math.hypot(a.ci[party], b.ci[party]);
    return {
      a,
      b,
      p: m > 0 ? zTail(1.96 * (a.v[party] - b.v[party]) / m) : 1
    };
  }));
  const sig = new Set();
  for (const [i, g] of [...gaps].sort((x, y) => x.p - y.p).entries()) {
    if (g.p >= 0.05 / (gaps.length - i)) break;
    sig.add(g);
  }
  const cmp = (a, b) => sig.has(gaps.find(g => g.a === a && g.b === b || g.a === b && g.b === a)) ? Math.sign(a.v[party] - b.v[party]) : 0;
  const pairs = gs.flatMap((a, i) => gs.slice(i + 1).map(b => [a, b, cmp(a, b)])).filter(p => p[2]);
  if (!pairs.length) return {
    kind: "none"
  };
  if (gs.length === 2) {
    const [a, b] = gs[0].v[party] > gs[1].v[party] ? gs : [gs[1], gs[0]];
    return {
      kind: "pair",
      a,
      b
    };
  }
  if (words.step && gs.length === st.groups.length) {
    const steps = gs.slice(1).map((g, i) => cmp(g, gs[i]));
    if (steps[0] !== 0 && steps.every(s => s === steps[0])) return {
      kind: "trend",
      dir: steps[0],
      first: gs[0],
      last: gs[gs.length - 1]
    };
  }
  const byV = [...gs].sort((a, b) => b.v[party] - a.v[party]);
  const top = byV[0],
    bot = byV[byV.length - 1];
  const rivals = x => byV.filter(g => g !== x && !demoNested(x, g));
  const topApart = rivals(top).every(g => cmp(top, g) > 0),
    botApart = rivals(bot).every(g => cmp(bot, g) < 0);
  const topGap = top.v[party] - rivals(top)[0].v[party],
    botGap = rivals(bot).slice(-1)[0].v[party] - bot.v[party];
  if (topApart && (!botApart || topGap >= botGap)) return {
    kind: "top",
    g: top,
    other: rivals(top).slice(-1)[0]
  };
  if (botApart) return {
    kind: "bot",
    g: bot,
    other: rivals(bot)[0]
  };
  const [a, b] = pairs.map(([x, y, s]) => s > 0 ? [x, y] : [y, x]).sort((p, q) => q[0].v[party] - q[1].v[party] - (p[0].v[party] - p[1].v[party]))[0];
  return {
    kind: "pair",
    a,
    b
  };
}
function demoVerdict(st, party) {
  const f = demoFinding(st, party);
  if (!f) return null;
  const words = DEMO_SET_WORDS[st.id] || {
    all: "these groups",
    others: "any other group",
    step: null
  };
  const who = g => DEMO_WHO[g.label] || g.label;
  const Who = g => {
    const s = who(g);
    return s[0].toUpperCase() + s.slice(1);
  };
  const vote = "to vote for " + DEMO_VOTE_FOR[party];
  if (f.kind === "none") return `There is no significant difference between ${words.all}.`;
  if (f.kind === "trend") return `Support for ${DEMO_VOTE_FOR[party]} ${f.dir > 0 ? "rises" : "falls"} significantly ${words.step}.`;
  if (f.kind === "top") return `${Who(f.g)} are significantly more likely than ${words.others} ${vote}.`;
  if (f.kind === "bot") return `${Who(f.g)} are significantly less likely than ${words.others} ${vote}.`;
  return `${Who(f.a)} are significantly more likely than ${who(f.b)} ${vote}.`;
}
const demoSaid = t => t && React.createElement("p", {
  className: "demo-verdict"
}, /significant/.test(t) && !/\bno\b|n’t/.test(t) ? React.createElement("mark", null, t) : t);
function demoTrendVerdict(D, st, party, inX) {
  const gpi = DEMO_GRP_PARTY.indexOf(party);
  const words = DEMO_SET_WORDS[st.id] || {};
  const who = g => DEMO_WHO[g.label] || g.label;
  const P = DEMO_VOTE_FOR[party];
  const polls = D.individualPolls.filter(p => p.grp && p.grp.t && p.grp.t[gpi] > 0 && inX(p.x));
  const gapOf = (p, g) => {
    const v = p.grp.v[D.demoGroups.indexOf(g.label)];
    const sum = v ? v.reduce((a, b) => a + b, 0) : 0;
    return sum > 0 ? 100 * (100 * v[gpi] / sum / p.grp.t[gpi] - 1) : null;
  };
  const tOf = p => {
    const at = demoGrpAt(p);
    return at.reduce((a, s) => a + s.x, 0) / at.length;
  };
  const points = y => polls.map(p => ({
    h: p.pollster,
    t: tOf(p),
    w: p.sample || 1000,
    y: y(p)
  })).filter(d => d.y != null && isFinite(d.y));
  const asked = polls.find(p => st.groups.some(g => gapOf(p, g) != null));
  if (!asked) return null;
  const when = D.monthNameFull(+asked.ym.slice(5)) + " " + asked.ym.slice(0, 4);
  if (st.groups.length === 2) {
    const [a, b] = st.groups;
    const fit = withinHouseSlope(points(p => {
      const ga = gapOf(p, a),
        gb = gapOf(p, b);
      return ga == null || gb == null ? null : ga - gb;
    }));
    if (!fit) return `There aren’t enough polls since ${when} to tell whether the gap between ${who(a)} and ${who(b)} has changed.`;
    if (fit.p >= 0.05) return `The gap between ${who(a)} and ${who(b)} hasn’t changed significantly since ${when}.`;
    const [towards, from] = fit.b > 0 ? [a, b] : [b, a];
    return `Since ${when}, ${who(towards)} have moved significantly towards ${P} relative to ${who(from)}.`;
  }
  const one = words.one || "group";
  const fits = st.groups.map(g => ({
    g,
    fit: withinHouseSlope(points(p => gapOf(p, g)))
  })).filter(f => f.fit);
  if (!fits.length) return `There aren’t enough polls since ${when} to tell whether any ${one} has moved relative to all voters.`;
  const sig = [];
  for (const [i, f] of [...fits].sort((x, y) => x.fit.p - y.fit.p).entries()) {
    if (f.fit.p >= 0.05 / (fits.length - i)) break;
    sig.push(f);
  }
  if (!sig.length) return `Since ${when}, no ${one} has moved significantly towards or away from ${P} relative to all voters.`;
  const names = fs => houseList(fs.map(f => who(f.g)), Infinity);
  const towards = sig.filter(f => f.fit.b > 0),
    away = sig.filter(f => f.fit.b < 0);
  const [first, then] = away.length >= towards.length ? [[away, "away from"], [towards, "towards"]] : [[towards, "towards"], [away, "away from"]];
  return `Since ${when}, ${names(first[0])} have moved significantly ${first[1]} ${P} relative to all voters` + (then[0].length ? `, and ${names(then[0])} ${then[1]} it.` : ".");
}
function DemographicsPanel({
  rangeId = "all"
}) {
  if (window.AP.rd) return React.createElement(RdDemographics, {
    rangeId: rangeId
  });
  const {
    D,
    rangeDomain,
    filterPts,
    buildXTicks,
    series
  } = window.AP;
  const narrow = useNarrow();
  const T = D.demographics;
  const [tabId, setTab] = useState("age");
  const [party, setParty] = useState("onp");
  if (!T || !T.tabs || !T.tabs.length) return null;
  const tab = T.tabs.find(t => t.id === tabId) || T.tabs[0];
  const color = D.PARTIES[party].color;
  const name = D.PARTIES[party].name;
  const all = T.all[party];
  const vals = tab.sets.flatMap(st => st.groups.map(g => g.v[party])).concat([all]);
  const top = Math.max(10, Math.ceil((Math.max(...vals) + 2) / 10) * 10);
  const row = (label, v, ci, isAll, title, swatch) => React.createElement("div", {
    className: "demo-row" + (isAll ? " all" : ""),
    key: label,
    title: title
  }, React.createElement("span", {
    className: "demo-lab"
  }, swatch && React.createElement("span", {
    className: "demo-sw" + (isAll ? " dash" : ""),
    style: isAll ? null : {
      background: swatch
    },
    "aria-hidden": "true"
  }), label), React.createElement("span", {
    className: "demo-track",
    "aria-hidden": "true"
  }, React.createElement("span", {
    className: "demo-fill",
    style: {
      width: 100 * v / top + "%",
      background: isAll ? "var(--ink-3)" : color
    }
  })), React.createElement("span", {
    className: "demo-v"
  }, v.toFixed(1), React.createElement("span", {
    className: "pct"
  }, "%")), React.createElement("span", {
    className: "demo-ci"
  }, ci != null ? "± " + ci.toFixed(1) : ""));
  const rel = (g, a) => 100 * (g / a - 1);
  const ki = T.order.indexOf(party),
    gpi = DEMO_GRP_PARTY.indexOf(party);
  const [rangeLo, rangeHi] = rangeDomain(rangeId);
  const build = (st, firstXShared) => {
    const n = st.groups.length;
    const allAt = new Map(T.allMonthly.map(m => [m[0], m[1 + ki]]));
    const lines = st.groups.map((g, i) => ({
      g,
      color: demoRamp(color, n, i),
      pts: (g.monthly || []).filter(m => allAt.has(m[0])).filter(m => allAt.get(m[0]) > 0).map(m => ({
        ym: m[0],
        x: D.mx(m[0]),
        v: +rel(m[1 + ki], allAt.get(m[0])).toFixed(1),
        ci: m[1 + T.order.length + ki] != null ? 100 * m[1 + T.order.length + ki] / allAt.get(m[0]) : null
      }))
    })).filter(l => l.pts.length);
    if (!lines.length) return null;
    const firstX = firstXShared != null ? firstXShared : Math.min(...lines.map(l => l.pts[0].x));
    const xDomain = [Math.max(rangeLo, firstX - 0.06), rangeHi];
    const inX = x => x >= xDomain[0] && x <= xDomain[1];
    const allPts = filterPts(T.allMonthly.map(m => ({
      ym: m[0],
      x: D.mx(m[0]),
      v: 0
    })).filter(d => d.x >= firstX), xDomain[0]);
    const drawn = lines.map(l => ({
      ...l,
      pts: filterPts(l.pts, xDomain[0])
    }));
    const dots = D.individualPolls.filter(p => p.grp && p.grp.t).flatMap(p => demoGrpAt(p).filter(s => inX(s.x)).flatMap(s => drawn.map(l => {
      const v = p.grp.v[D.demoGroups.indexOf(l.g.label)];
      const sum = v ? v.reduce((a, b) => a + b, 0) : 0;
      return sum > 0 && p.grp.t[gpi] > 0 ? {
        x: s.x,
        y: +rel(100 * v[gpi] / sum, p.grp.t[gpi]).toFixed(1),
        color: l.color,
        label: l.g.label,
        meta: demoPartMeta(p, s),
        ...(s.part != null ? {
          sub: demoPartSub(p, s)
        } : {})
      } : null;
    }).filter(Boolean)));
    const areas = drawn.map(l => ({
      id: "ci-" + l.g.label,
      color: l.color,
      className: "ci-band",
      edge: false,
      smooth: true,
      points: l.pts.filter(d => d.ci != null).map(d => ({
        x: d.x,
        y0: Math.max(-100, d.v - d.ci),
        y1: d.v + d.ci
      }))
    })).filter(a => a.points.length >= 2);
    const vals = drawn.flatMap(l => l.pts.map(d => d.v)).concat(allPts.map(d => d.v), dots.map(d => d.y), areas.flatMap(a => a.points.flatMap(d => [d.y0, d.y1])));
    return {
      st,
      n,
      lines,
      firstX,
      xDomain,
      allPts,
      drawn,
      dots,
      areas,
      vals
    };
  };
  const builtFirst = tab.sets.map(st => build(st, null)).filter(Boolean);
  const sharedFirstX = builtFirst.length ? Math.min(...builtFirst.map(b => b.firstX)) : null;
  const built = new Map(tab.sets.map(st => [st.id, build(st, sharedFirstX)]));
  const sharedVals = [...built.values()].filter(Boolean).flatMap(b => b.vals);
  const sharedAxis = (() => {
    if (!sharedVals.length) return null;
    const lo = Math.min(0, ...sharedVals),
      hi = Math.max(0, ...sharedVals);
    const step = [10, 20, 25, 50, 100].find(st => (hi - lo) / st <= 6) || 200;
    const d0 = Math.max(-100, Math.floor((lo - step * 0.1) / step) * step);
    const d1 = Math.ceil((hi + step * 0.1) / step) * step;
    const ticks = [];
    for (let v = d0; v <= d1 + 1e-9; v += step) ticks.push(v);
    return {
      domain: [d0, d1],
      ticks
    };
  })();
  const chartFor = st0 => {
    const b = built.get(st0.id);
    if (!b || !sharedAxis) return null;
    const {
      st,
      n,
      xDomain,
      allPts,
      drawn,
      dots,
      areas
    } = b;
    const {
      domain,
      ticks
    } = sharedAxis;
    const signed = v => (Math.round(v) > 0 ? "+" : Math.round(v) < 0 ? "\u2212" : "") + Math.abs(Math.round(v));
    const by = st.label ? st.label.replace(/^By /, "") : tab.label.toLowerCase();
    return React.createElement("div", {
      className: "demo-chart"
    }, React.createElement("p", {
      className: "demo-chart-lab"
    }, tab.sets.length > 1 && React.createElement("span", {
      className: "demo-chart-set"
    }, st.label), "How much higher or lower than among all voters (%), month by month"), React.createElement(TrendChart, {
      key: "demo-" + st.id,
      height: narrow ? 560 : 500,
      xDomain: xDomain,
      yDomain: domain,
      yTicks: ticks,
      unit: "%",
      yTickFmt: t => t > 0 ? "+" + t + "%" : t < 0 ? "\u2212" + -t + "%" : "0",
      pad: {
        l: narrow ? 92 : 76,
        r: 60,
        t: 16,
        b: narrow ? 66 : 56
      },
      xTicks: buildXTicks(xDomain[0], xDomain[1]),
      series: [{
        id: "all",
        label: "All voters",
        color: "var(--ink-3)",
        dashed: true,
        points: series(allPts, "v")
      }, ...drawn.map(l => ({
        id: l.g.label,
        label: l.g.label,
        color: l.color,
        points: series(l.pts, "v"),
        endLabel: l.g.label
      }))],
      areas: areas,
      spine: series(allPts, "v"),
      scatter: dots,
      pollFacet: "primary",
      tooltipTitle: i => window.AP.monthLabelFull(allPts[i].ym),
      fmt: signed,
      ariaLabel: `${name} by ${by}: how much higher or lower each group's vote is than all voters', in percent, month by month`,
      copy: {
        sub: `How much higher or lower ${name}’s vote is in each group than among all voters, by ${by}, the latest figures pool the last ${T.window} of polls`,
        legend: [{
          label: `All voters  ${all.toFixed(1)}%`,
          color: "var(--ink-3)",
          kind: "dashed"
        }, ...st.groups.map((g, i) => ({
          label: `${g.label}  ${signed(rel(g.v[party], all))}%`,
          color: demoRamp(color, n, i),
          kind: "line"
        })), ...(areas.length ? [{
          label: "95% interval (shaded)",
          color: "var(--ink-faint)",
          kind: "shade"
        }] : [])]
      }
    }), (() => {
      const t = demoTrendVerdict(D, st, party, x => x >= xDomain[0] && x <= xDomain[1]);
      return demoSaid(t);
    })());
  };
  return React.createElement("section", {
    className: "card"
  }, React.createElement("div", {
    className: "card-head"
  }, React.createElement("div", null, React.createElement("h2", {
    className: "card-title"
  }, "Who votes for whom"), React.createElement("p", {
    className: "card-sub"
  }, React.createElement(Houses, {
    after: `${name}’s share of each group’s first-preference vote, pooled from the last ${T.window} of polls`
  }, houseList(T.houses.map(demoHouse)))))), React.createElement("div", {
    className: "demo-ctl"
  }, React.createElement(Segmented, {
    options: T.tabs.map(t => ({
      id: t.id,
      label: t.label
    })),
    value: tab.id,
    onChange: setTab,
    size: "sm",
    ariaLabel: "Group voters by"
  }), React.createElement(Segmented, {
    options: DEMO_PARTIES,
    value: party,
    onChange: setParty,
    size: "sm",
    ariaLabel: "Party"
  })), React.createElement("div", {
    className: "demo-body"
  }, React.createElement("div", {
    className: "demo-grid" + (tab.sets.length === 1 ? " solo" : "")
  }, tab.sets.map(st => React.createElement("div", {
    className: "demo-bars",
    key: st.id
  }, tab.sets.length > 1 && React.createElement("div", {
    className: "demo-house-head"
  }, React.createElement("span", {
    className: "demo-house-name"
  }, st.label), React.createElement("span", {
    className: "demo-house-when"
  }, houseList(st.houses.map(demoHouse)))), row("All voters", all, null, true, "The site’s current figure for all voters – the headline’s own estimate", "dash"), st.groups.map((g, i) => row(g.label, g.v[party], g.ci[party], false, `Pooled from ${g.n} poll${g.n === 1 ? "" : "s"}, ${houseList(g.houses.map(demoHouse))}, ± ${g.ci[party].toFixed(1)} is the 95% margin`, demoRamp(color, st.groups.length, i))), demoSaid(demoVerdict(st, party)))), tab.sets.map(st => React.createElement(React.Fragment, {
    key: st.id + "-chart"
  }, chartFor(st) || (tab.sets.length > 1 ? React.createElement("div", {
    className: "demo-chart"
  }) : null))), React.createElement("div", {
    className: "demo-notes"
  }, React.createElement("details", {
    className: "view-how hint-how"
  }, React.createElement("summary", null, "How to read these charts"), React.createElement("p", {
    className: "table-hint"
  }, "The figures pool the last ", T.window, " of polls. Each chart shows how much higher or lower the party\u2019s vote is in each group than among all voters, month by month.", " ", React.createElement("button", {
    type: "button",
    className: "hi-term",
    onClick: () => window.AP.openTerm && window.AP.openTerm("vote-by-group", "Who votes for whom")
  }, "Where the figures come from")), React.createElement("p", {
    className: "table-hint"
  }, "A bar is that group\u2019s share of the first-preference vote: 17.1% beside 18\u201334 means 17.1% of people aged 18\u201334 name the party as their first preference \u2013 the same as the all-voters bar, read among that group alone. Each poll says how far a group sits from its own overall figure. Those gaps are pooled, newer and larger polls counting for more as in every figure here, and added to the site\u2019s current figure for all voters. \xB1 is the 95% margin."), React.createElement("p", {
    className: "table-hint"
  }, "The sentence under the bars says whether the groups really differ. Two groups differ significantly when the gap between them is larger than its own 95% margin, which combines both groups\u2019 \xB1 figures. With three or four groups there are several gaps to test at once, so each has to clear a higher bar."), React.createElement("p", {
    className: "table-hint"
  }, "The sentence under each chart says whether any group has moved towards or away from the party, relative to all voters, over the period shown. It compares each pollster only with itself, so a pollster joining or leaving can\u2019t pass for a change. The same higher bar applies when three or four groups are tested at once."), React.createElement("p", {
    className: "table-hint"
  }, "The charts are built the way the site\u2019s other monthly lines are: each poll is a dot and each line\u2019s 95% interval is shaded. Where two groups\u2019 shading overlaps, the polls can\u2019t tell them apart that month. \u221238% means the party\u2019s vote in that group is 38% lower than among all voters, not 38 points. Measured this way a party\u2019s growth doesn\u2019t read as a widening divide, so a flat line means the group moved with everyone else."), React.createElement("p", {
    className: "table-hint"
  }, "Groups pool only where pollsters cut them the same way", tab.id === "age" ? ": YouGov’s 35–49 and 50+ bands aren’t 35–54 and 55+, so it joins only at 18–34" : tab.id === "place" ? ": YouGov’s SA, WA, and ACT/NT/Tas are combined into the non-eastern mainland at their shares of the 2025 vote, and DemosAU’s Regional/Rural holds provincial and rural voters together, so it joins only at the two suburban groups" : tab.id === "home" ? ": RedBridge’s Renting and other is wider than renters, so it joins only at the two owner groups" : "", "."), tab.id === "age" && React.createElement("p", {
    className: "table-hint"
  }, "Neither pollster publishes the birth years behind its generations; the usual ones, and what is uncertain about them, are under", " ", React.createElement("a", {
    className: "hi-term",
    href: "#info",
    onClick: e => {
      e.preventDefault();
      window.AP.openTerm && window.AP.openTerm("generations", "Who votes for whom");
    }
  }, "Generations"), "."))))));
}
const ISS_PARTY = {
  alp: "Labor",
  lnp: "the Coalition",
  onp: "One Nation"
};
const ISS_PARTY_CAP = {
  alp: "Labor",
  lnp: "Coalition",
  onp: "One Nation"
};
const ISS_SHORT = {
  col: "Cost of living",
  housing: "Housing",
  health: "Health",
  economy: "Economy",
  immigration: "Immigration",
  climate: "Climate",
  crime: "Crime",
  security: "Security"
};
const ISS_PHRASE = {
  col: "the cost of living",
  housing: "housing",
  health: "health",
  economy: "economic management",
  immigration: "immigration",
  climate: "climate change",
  crime: "crime",
  security: "national security"
};
const ISS_WHO = {
  Labor: "Labor voters",
  Coalition: "Coalition voters",
  Liberal: "Liberal voters",
  "Nationals, LNP and CLP": "Nationals, LNP and CLP voters",
  "One Nation": "One Nation voters",
  Greens: "Greens voters",
  Others: "voters for others & independents",
  Undecided: "undecided voters",
  "Below Year 12": "voters who left school before Year 12",
  "Year 12": "voters who finished Year 12",
  "Renting and other": "renters and others"
};
const ISS_SET_WORDS = {
  vote: {
    all: "voters of different parties",
    others: "any other group of voters"
  },
  generation: DEMO_SET_WORDS.generation,
  gender: DEMO_SET_WORDS.gender,
  location: DEMO_SET_WORDS.location,
  housing: {
    all: "owners and renters",
    others: "other voters"
  },
  education: DEMO_SET_WORDS.education
};
const issWho = g => ISS_WHO[g] || DEMO_WHO[g] || g;
const issCap = s => s[0].toUpperCase() + s.slice(1);
function issGroupVerdict(tab, k) {
  const gs = tab.groups.map(g => ({
    g,
    c: tab.cells[g] && tab.cells[g][k]
  })).filter(x => x.c && x.c.ci != null);
  if (gs.length < 2) return null;
  const gaps = gs.flatMap((a, i) => gs.slice(i + 1).map(b => {
    const m = Math.hypot(a.c.ci, b.c.ci);
    return {
      a,
      b,
      p: m > 0 ? zTail(1.96 * (a.c.v - b.c.v) / m) : 1
    };
  }));
  const sig = new Set();
  for (const [i, g] of [...gaps].sort((x, y) => x.p - y.p).entries()) {
    if (g.p >= 0.05 / (gaps.length - i)) break;
    sig.add(g);
  }
  if (!sig.size) return null;
  const words = ISS_SET_WORDS[tab.id] || {
    all: "these groups",
    others: "any other group"
  };
  const cmp = (a, b) => {
    const g = gaps.find(x => x.a === a && x.b === b || x.a === b && x.b === a);
    return sig.has(g) ? Math.sign(a.c.v - b.c.v) : 0;
  };
  const what = `to put ${ISS_PHRASE[k] || k} in their top three`;
  const pct = x => Math.round(x.c.v) + "%";
  const byV = [...gs].sort((a, b) => b.c.v - a.c.v);
  const top = byV[0],
    bot = byV[byV.length - 1];
  if (gs.length === 2) return {
    gap: top.c.v - bot.c.v,
    text: `${issCap(issWho(top.g))} are significantly more likely than ${issWho(bot.g)} ${what} (${pct(top)} against ${pct(bot)}).`
  };
  const topApart = byV.slice(1).every(x => cmp(top, x) > 0),
    botApart = byV.slice(0, -1).every(x => cmp(bot, x) < 0);
  const topGap = top.c.v - byV[1].c.v,
    botGap = byV[byV.length - 2].c.v - bot.c.v;
  if (topApart && (!botApart || topGap >= botGap)) return {
    gap: topGap,
    text: `${issCap(issWho(top.g))} are significantly more likely than ${words.others} ${what} (${pct(top)}).`
  };
  if (botApart) return {
    gap: botGap,
    text: `${issCap(issWho(bot.g))} are significantly less likely than ${words.others} ${what} (${pct(bot)}).`
  };
  const [a, b] = gaps.filter(g => sig.has(g)).map(g => g.a.c.v > g.b.c.v ? [g.a, g.b] : [g.b, g.a]).sort((p, q) => q[0].c.v - q[1].c.v - (p[0].c.v - p[1].c.v))[0];
  return {
    gap: a.c.v - b.c.v,
    text: `${issCap(issWho(a.g))} are significantly more likely than ${issWho(b.g)} ${what} (${pct(a)} against ${pct(b)}).`
  };
}
function issTrendVerdict(D, it, dots) {
  if (!dots.length) return null;
  const per = {};
  for (const d of dots) per[d.pollster] = (per[d.pollster] || 0) + 1;
  const ym = (dots.find(d => per[d.pollster] >= 2) || dots[0]).date.slice(0, 7);
  const when = D.monthNameFull(+ym.slice(5)) + " " + ym.slice(0, 4);
  const what = ISS_PHRASE[it.id] || it.label.toLowerCase();
  const fits = D.issues.parties.map(q => ({
    q,
    fit: withinHouseSlope(dots.map(d => ({
      h: d.pollster,
      t: d.x,
      w: d.n,
      y: d.s[q]
    })))
  })).filter(f => f.fit);
  if (!fits.length) return `There aren’t enough polls since ${when} to tell whether any party has gained ground on ${what}.`;
  const sig = [];
  for (const [i, f] of [...fits].sort((a, b) => a.fit.p - b.fit.p).entries()) {
    if (f.fit.p >= 0.05 / (fits.length - i)) break;
    sig.push(f);
  }
  if (!sig.length) return `No party’s share on ${what} has changed significantly since ${when}.`;
  const up = sig.filter(f => f.fit.b > 0).map(f => ISS_PARTY[f.q]);
  const down = sig.filter(f => f.fit.b < 0).map(f => ISS_PARTY[f.q]);
  const has = xs => xs.length > 1 ? "have" : "has";
  return `Since ${when}, ` + [up.length ? `${houseList(up, Infinity)} ${has(up)} gained ground significantly on ${what}` : null, down.length ? `${houseList(down, Infinity)} ${has(down)} lost ground significantly` : null].filter(Boolean).join(", and ") + ".";
}
function IssuesPanel({
  rangeId = "all"
}) {
  if (window.AP.rd) return React.createElement(RdIssues, {
    rangeId: rangeId
  });
  const {
    D,
    rangeDomain,
    filterPts,
    buildXTicks,
    series
  } = window.AP;
  const narrow = useNarrow();
  const beside = useNarrow("(min-width: 1136px)");
  const I = D.issues;
  const [view, setView] = useState("trust");
  const [selId, setSel] = useState(null);
  const [gsetId, setGset] = useState("vote");
  if (!I || !I.list || !I.list.length) return null;
  const P = I.parties;
  const list = I.list;
  const it = list.find(x => x.id === selId) || list[0];
  const top = list[0];
  const pName = q => D.PARTIES[q].name;
  const pColor = q => D.PARTIES[q].color;
  const openInfo = () => window.AP.openTerm && window.AP.openTerm("issues", "The issues");
  const rowVerdict = x => !x.own ? null : x.own.leadSig ? {
    text: `${ISS_PARTY_CAP[x.own.lead]} ahead`,
    colors: [pColor(x.own.lead)],
    title: `${issCap(ISS_PARTY[x.own.lead])} leads ${ISS_PARTY[x.own.runner]} by ${x.own.gap.toFixed(1)} points (95% margin ± ${x.own.gapCi.toFixed(1)})`
  } : x.own.pairSig ? {
    text: `${ISS_PARTY_CAP[x.own.third]} behind`,
    colors: [pColor(x.own.lead), pColor(x.own.runner)],
    title: `${issCap(ISS_PARTY[x.own.lead])} and ${ISS_PARTY[x.own.runner]} are ${x.own.gap.toFixed(1)} points apart, inside the 95% margin of ± ${x.own.gapCi.toFixed(1)}; ${ISS_PARTY[x.own.runner]} leads ${ISS_PARTY[x.own.third]} by ${x.own.gap2.toFixed(1)} (± ${x.own.gap2Ci.toFixed(1)})`
  } : {
    text: "No clear lead",
    colors: null,
    title: `${issCap(ISS_PARTY[x.own.lead])} and ${ISS_PARTY[x.own.runner]} are ${x.own.gap.toFixed(1)} points apart, inside the 95% margin of ± ${x.own.gapCi.toFixed(1)}`
  };
  const pick = id => setSel(id);
  const onRowKey = (e, id) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      pick(id);
    }
  };
  const issueRow = x => {
    const v = rowVerdict(x),
      sel = x.id === it.id;
    return React.createElement("div", {
      key: x.id,
      className: "iss-row" + (sel ? " sel" : ""),
      role: "button",
      tabIndex: 0,
      "aria-pressed": sel,
      onClick: () => pick(x.id),
      onKeyDown: e => onRowKey(e, x.id),
      "aria-label": `${x.label}: ${x.imp ? Math.round(x.imp.v) + "% put it in their top three" : "not asked"}; ` + (x.own ? P.map(q => `${pName(q)} ${Math.round(x.own.v[q])}`).join(", ") + "; " + v.text : "no three-way figures")
    }, React.createElement("span", {
      className: "iss-lab"
    }, x.label), React.createElement("span", {
      className: "iss-imp",
      title: x.imp ? `${Math.round(x.imp.v)}% put it in their top three (± ${x.imp.ci.toFixed(1)})` + (x.imp.gap && x.imp.by.length > 1 ? `. Latest polls: ${x.imp.by.map(b => `${b.house} ${Math.round(b.v)}%`).join(", ")}` : "") + (x.imp.r1 != null ? `. ${Math.round(x.imp.r1)}% put it first at RedBridge` : "") : ""
    }, React.createElement("span", {
      className: "iss-mini",
      "aria-hidden": "true"
    }, "In top three"), x.imp ? React.createElement(React.Fragment, null, React.createElement("span", {
      className: "demo-track iss-imp-track",
      "aria-hidden": "true"
    }, React.createElement("span", {
      className: "demo-fill",
      style: {
        width: x.imp.v + "%",
        background: "var(--ink-3)"
      }
    })), React.createElement("span", {
      className: "iss-imp-v"
    }, Math.round(x.imp.v), React.createElement("span", {
      className: "pct"
    }, "%"))) : React.createElement("span", {
      className: "iss-na"
    }, "not asked")), React.createElement("span", {
      className: "iss-own"
    }, React.createElement("span", {
      className: "iss-mini",
      "aria-hidden": "true"
    }, "Best on it"), x.own ? React.createElement(React.Fragment, null, React.createElement("span", {
      className: "sbar iss-sbar",
      "aria-hidden": "true"
    }, P.map(q => React.createElement("span", {
      key: q,
      className: "sbar-seg",
      style: {
        width: x.own.v[q] + "%",
        background: pColor(q)
      }
    }))), React.createElement("span", {
      className: "iss-nums",
      "aria-hidden": "true"
    }, P.map(q => React.createElement("span", {
      key: q,
      className: "skey"
    }, React.createElement("span", {
      className: "skey-dot",
      style: {
        background: pColor(q)
      }
    }), React.createElement("span", {
      className: "skey-val"
    }, Math.round(x.own.v[q])))))) : React.createElement("span", {
      className: "iss-na"
    }, "not asked with all three parties")), React.createElement("span", {
      className: "iss-verdict" + (v && v.colors ? " lead" : ""),
      title: v ? v.title : ""
    }, v && v.colors && v.colors.map(c => React.createElement("span", {
      key: c,
      className: "skey-dot",
      style: {
        background: c
      },
      "aria-hidden": "true"
    })), v ? v.text : ""));
  };
  const [rangeLo, rangeHi] = rangeDomain(rangeId);
  const monthPts = (it.monthly || []).map(m => ({
    ym: m[0],
    x: D.mx(m[0]),
    ...Object.fromEntries(P.map((q, i) => [q, m[1 + i]])),
    ...Object.fromEntries(P.map((q, i) => ["ci_" + q, m[1 + P.length + i]]))
  }));
  const chart = (() => {
    if (monthPts.length < 1) return null;
    const xDomain = [Math.max(rangeLo, monthPts[0].x - 0.06), rangeHi];
    const inX = x => x >= xDomain[0] && x <= xDomain[1];
    const pts = filterPts(monthPts, xDomain[0]);
    const byRow = new Map(D.individualPolls.map(p => [p.pollster + "|" + p.released, p]));
    const dots = (it.dots || []).filter(d => inX(d[0])).map(d => {
      const meta = byRow.get(d[1] + "|" + d[2]) || {
        pollster: demoHouse(d[1]),
        released: d[2]
      };
      return {
        x: d[0],
        pollster: d[1],
        date: d[2],
        n: meta.sample || 1000,
        meta,
        s: Object.fromEntries(P.map((q, i) => [q, d[3 + i]]))
      };
    });
    const scatter = dots.flatMap(d => P.map(q => ({
      x: d.x,
      y: d.s[q],
      color: pColor(q),
      label: pName(q),
      meta: d.meta
    })));
    const areas = P.map(q => ({
      id: "ci-" + q,
      color: pColor(q),
      className: "ci-band",
      edge: false,
      smooth: true,
      points: pts.filter(d => d["ci_" + q] != null).map(d => ({
        x: d.x,
        y0: d[q] - d["ci_" + q],
        y1: d[q] + d["ci_" + q]
      }))
    })).filter(a => a.points.length >= 2);
    const vals = pts.flatMap(d => P.map(q => d[q])).concat(scatter.map(d => d.y), areas.flatMap(a => a.points.flatMap(d => [d.y0, d.y1])));
    if (!vals.length) return null;
    const lo = Math.min(...vals),
      hi = Math.max(...vals),
      step = 10;
    const d0 = Math.max(0, Math.floor((lo - step * 0.1) / step) * step),
      d1 = Math.ceil((hi + step * 0.1) / step) * step;
    const ticks = [];
    for (let v = d0; v <= d1 + 1e-9; v += step) ticks.push(v);
    return {
      xDomain,
      pts,
      dots,
      scatter,
      areas,
      domain: [d0, d1],
      ticks
    };
  })();
  const wide = list.filter(x => x.imp && x.imp.gap && x.imp.by.length === 2).map(x => {
    const [hi, lo] = [...x.imp.by].sort((a, b) => b.v - a.v);
    return {
      x,
      hi,
      lo,
      d: hi.v - lo.v
    };
  }).sort((a, b) => b.d - a.d).find(w => w.d >= 5);
  const G = I.groups;
  const gtab = G && (G.tabs.find(t => t.id === gsetId) || G.tabs[0]);
  const allOf = k => G && G.all && G.all[k] || null;
  const gVerdicts = gtab ? gtab.issues.map(k => issGroupVerdict(gtab, k)).filter(Boolean).sort((a, b) => b.gap - a.gap).slice(0, 3) : [];
  const phrase = top.imp && top.own && ISS_PHRASE[top.id];
  const bare = phrase && phrase.replace(/^the /, "");
  const issHead = phrase && bare[0].toUpperCase() + bare.slice(1) + " tops voters’ concerns" + (top.own.leadSig ? ", " + ISS_PARTY[top.own.lead] + " most trusted on it" : "");
  const issDek = phrase && plainShare(top.imp.v) + " voters put " + phrase + " among their three most important issues" + (top.own.leadSig ? `, and more of them trust ${ISS_PARTY[top.own.lead]} with it than either of the others.` : top.own && top.own.pairSig ? `, and ${ISS_PARTY[top.own.third]} is less trusted with it than either ${ISS_PARTY[top.own.lead]} or ${ISS_PARTY[top.own.runner]}.` : ", and no party is clearly more trusted with it than the others.");
  return React.createElement("section", {
    className: "card"
  }, React.createElement("div", {
    className: "card-head"
  }, React.createElement("div", null, React.createElement("h2", {
    className: "card-title"
  }, "The issues"), React.createElement("p", {
    className: "card-sub"
  }, view === "trust" ? React.createElement(Houses, {
    after: `What voters say matters most, and which party they think is best on it, pooled from the last ${I.window} of polls`
  }, houseList(I.houses)) : G ? React.createElement(Houses, {
    after: "Each group\u2019s share putting an issue in its top three"
  }, G.house, ", its polls in the last ", G.window) : React.createElement(React.Fragment, null, "Each group\u2019s share putting an issue in its top three \u2013 no poll in the window")))), React.createElement("div", {
    className: "demo-ctl"
  }, React.createElement(Segmented, {
    options: [{
      id: "trust",
      label: "Who’s trusted"
    }, {
      id: "whom",
      label: "What matters to whom"
    }],
    value: view,
    onChange: setView,
    size: "sm",
    ariaLabel: "View"
  }), view === "whom" && G && React.createElement(Segmented, {
    options: G.tabs.map(t => ({
      id: t.id,
      label: t.label
    })),
    value: gtab.id,
    onChange: setGset,
    size: "sm",
    ariaLabel: "Group voters by"
  })), view === "trust" && React.createElement(Story, {
    head: issHead,
    dek: issDek
  }), view === "trust" ? React.createElement("div", {
    className: "iss-body"
  }, React.createElement("div", {
    className: "iss-grid"
  }, React.createElement("div", {
    className: "iss-rows"
  }, React.createElement("div", {
    className: "iss-head",
    "aria-hidden": "true"
  }, React.createElement("span", {
    className: "iss-lab"
  }), React.createElement("span", {
    className: "iss-imp"
  }, "In voters\u2019 top three"), React.createElement("span", {
    className: "iss-own"
  }, "Best on it", React.createElement("span", {
    className: "iss-legend"
  }, P.map(q => React.createElement("span", {
    key: q,
    className: "skey"
  }, React.createElement("span", {
    className: "skey-dot",
    style: {
      background: pColor(q)
    }
  }), React.createElement("span", {
    className: "skey-lab"
  }, ISS_PARTY_CAP[q]))))), React.createElement("span", {
    className: "iss-verdict"
  })), React.createElement("p", {
    className: "iss-legend iss-legend-solo",
    "aria-hidden": "true"
  }, "Best on it:", " ", P.map(q => React.createElement("span", {
    key: q,
    className: "skey"
  }, React.createElement("span", {
    className: "skey-dot",
    style: {
      background: pColor(q)
    }
  }), React.createElement("span", {
    className: "skey-lab"
  }, ISS_PARTY_CAP[q])))), list.map(issueRow), wide && React.createElement("p", {
    className: "table-hint iss-grn"
  }, wide.hi.house, " and ", wide.lo.house, " word the question differently and disagree most on ", ISS_PHRASE[wide.x.id], ": ", Math.round(wide.hi.v), "% in ", wide.hi.house, "\u2019s latest poll,", " ", Math.round(wide.lo.v), "% in ", wide.lo.house, "\u2019s. The grey bars sit midway between the two pollsters\u2019 usual figures."), list.filter(x => x.grnTop).map(x => React.createElement("p", {
    key: "grn-" + x.id,
    className: "table-hint iss-grn"
  }, "RedBridge also offers the Greens, who come first on ", ISS_PHRASE[x.id], " (", x.grnTop.grn, "%)."))), chart && React.createElement("div", {
    className: "iss-chart demo-chart"
  }, React.createElement("p", {
    className: "demo-chart-lab"
  }, React.createElement("span", {
    className: "demo-chart-set"
  }, it.label), "Who voters think is best, month by month (%, of those naming Labor, the Coalition or One Nation)"), React.createElement(TrendChart, {
    key: "iss-" + it.id,
    height: narrow ? 560 : beside ? 460 : 360,
    xDomain: chart.xDomain,
    yDomain: chart.domain,
    yTicks: chart.ticks,
    unit: "%",
    pad: {
      l: narrow ? 70 : 56,
      r: 60,
      t: 16,
      b: narrow ? 66 : 56
    },
    xTicks: buildXTicks(chart.xDomain[0], chart.xDomain[1]),
    series: P.map(q => ({
      id: q,
      label: pName(q),
      color: pColor(q),
      points: series(chart.pts, q),
      endLabel: ISS_PARTY_CAP[q]
    })),
    areas: chart.areas,
    spine: series(chart.pts, P[0]),
    scatter: chart.scatter,
    pollFacet: "primary",
    tooltipTitle: i => window.AP.monthLabelFull(chart.pts[i].ym),
    fmt: v => Math.round(v) + "",
    ariaLabel: `${it.label}: the share of voters naming Labor, the Coalition or One Nation who think each is best on it, month by month`,
    copy: {
      sub: `${it.label}: who voters think is best, of those naming Labor, the Coalition or One Nation, pooled from ${houseList(it.own && it.own.houses || I.houses)}`,
      legend: [...P.map(q => ({
        label: `${pName(q)}  ${it.own ? Math.round(it.own.v[q]) + "%" : ""}`,
        color: pColor(q),
        kind: "line"
      })), ...(chart.areas.length ? [{
        label: "95% interval (shaded)",
        color: "var(--ink-faint)",
        kind: "shade"
      }] : [])]
    }
  }), demoSaid(issTrendVerdict(D, it, chart.dots))), React.createElement("div", {
    className: "demo-notes iss-notes"
  }, React.createElement("details", {
    className: "view-how hint-how"
  }, React.createElement("summary", null, "How to read these figures"), React.createElement("p", {
    className: "table-hint"
  }, "The figures pool the last ", I.window, " of polls. Pick an issue to follow it in the chart.", " ", React.createElement("button", {
    type: "button",
    className: "hi-term",
    onClick: openInfo
  }, "Where the figures come from")), React.createElement("p", {
    className: "table-hint"
  }, "The grey bar is how many voters put the issue among their three most important. RedBridge and Ipsos both ask every month, in different words: RedBridge asks which issues matter most to your vote, Ipsos which matter most for Australia. Their figures sit a steady distance apart, so each poll is moved half that distance toward the other pollster before the two are pooled."), React.createElement("p", {
    className: "table-hint"
  }, "The coloured bar splits the voters who named Labor, the Coalition or One Nation as best on the issue. Pollsters also offer other answers \u2013 the Greens, someone else, all about equal, don\u2019t know \u2013 and each offers a different set, so only these three can be pooled. Resolve, RedBridge, Ipsos, YouGov and DemosAU count wherever they ask the issue, each less its house lean, as in the headline figures."), React.createElement("p", {
    className: "table-hint"
  }, "\u201CAhead\u201D means the leading party\u2019s margin over the next is larger than that margin\u2019s own 95% range. \u201CBehind\u201D names the party clearly in third; its dots mark the two ahead of it, which the polls can\u2019t separate. \u201CNo clear lead\u201D means the polls can\u2019t separate them. In the chart each dot is one poll and each line\u2019s 95% interval is shaded."))))) : React.createElement("div", {
    className: "iss-body"
  }, gtab ? React.createElement("div", {
    className: "iss-grid whom"
  }, React.createElement("div", {
    className: "iss-table-wrap"
  }, React.createElement("table", {
    className: "iss-table"
  }, React.createElement("caption", {
    className: "sr-only"
  }, "Share of each group putting each issue in its top three, %"), React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", {
    scope: "col"
  }, React.createElement("span", {
    className: "sr-only"
  }, "Group")), gtab.issues.map(k => React.createElement("th", {
    scope: "col",
    key: k
  }, React.createElement("span", null, ISS_SHORT[k] || I.labels[k]))))), React.createElement("tbody", null, React.createElement("tr", {
    className: "all"
  }, React.createElement("th", {
    scope: "row"
  }, "All voters"), gtab.issues.map(k => {
    const x = allOf(k);
    return React.createElement("td", {
      key: k
    }, x ? React.createElement(IssCell, {
      v: x.v,
      ci: x.ci,
      all: true
    }) : "–");
  })), gtab.groups.map(g => React.createElement("tr", {
    key: g
  }, React.createElement("th", {
    scope: "row"
  }, g), gtab.issues.map(k => {
    const c = gtab.cells[g] && gtab.cells[g][k];
    return React.createElement("td", {
      key: k
    }, c ? React.createElement(IssCell, {
      v: c.v,
      ci: c.ci
    }) : "–");
  })))))), React.createElement("div", {
    className: "iss-said"
  }, gVerdicts.length ? gVerdicts.map((v, i) => React.createElement(React.Fragment, {
    key: i
  }, demoSaid(v.text))) : demoSaid(`No two ${gtab.id === "vote" ? "groups of voters" : "groups"} differ significantly on any of these issues.`)), React.createElement("div", {
    className: "demo-notes iss-notes"
  }, React.createElement("details", {
    className: "view-how hint-how"
  }, React.createElement("summary", null, "How to read these figures"), React.createElement("p", {
    className: "table-hint"
  }, "Each figure is the share of that group putting the issue among its three most important. Only RedBridge publishes these by group, so they rest on its polls in the last ", G.window, ". The all-voters row is RedBridge\u2019s own too, so it can differ from the grey bars under Who\u2019s trusted, which pool RedBridge with Ipsos.", " ", React.createElement("button", {
    type: "button",
    className: "hi-term",
    onClick: openInfo
  }, "Where the figures come from")), React.createElement("p", {
    className: "table-hint"
  }, "The sentences name the clearest differences. Two groups differ significantly when the gap between them is larger than its own 95% margin, which combines both groups\u2019 margins; with several groups the bar rises for each extra gap tested, as on the vote-by-group panel. A group\u2019s margin is usually 5 to 7 points, since a group is a slice of one poll. Hover or tap a figure for its margin.")))) : React.createElement("p", {
    className: "table-hint"
  }, "No poll in the last ", I.window, " published these figures by group.")));
}
function IssCell({
  v,
  ci,
  all
}) {
  return React.createElement("span", {
    className: "iss-cell" + (all ? " all" : ""),
    title: ci != null ? `± ${ci.toFixed(1)} is the 95% margin` : ""
  }, React.createElement("span", {
    className: "iss-cell-v"
  }, Math.round(v)), React.createElement("span", {
    className: "iss-cell-bar",
    "aria-hidden": "true"
  }, React.createElement("span", {
    style: {
      width: Math.max(0, Math.min(100, v)) + "%"
    }
  })));
}
const PARTY_C = {
  alp: "var(--alp)",
  lnp: "var(--lnp)",
  grn: "var(--grn)",
  onp: "var(--onp)",
  oth: "var(--oth)",
  unc: "var(--line-2)"
};
function tppContests(r) {
  const alp = r.alp2pp != null ? r.alp2pp : r.alp;
  const lnp = r.lnp2pp != null ? r.lnp2pp : r.lnp;
  const out = [];
  const dAlp = segDelta(r.chg, "alp2pp");
  const dLnp = dAlp ? {
    v: +(-dAlp.v).toFixed(1),
    refDate: dAlp.refDate
  } : null;
  const mirror = d => d ? {
    v: +(-d.v).toFixed(1),
    refDate: d.refDate
  } : null;
  const dAltAlp = segDelta(r.chg, "altAlpOn");
  const dAlt2Lnp = segDelta(r.chg, "altLnpOn");
  if (alp != null) out.push({
    kind: "2pp",
    lab: "2PP, ALP v L/NP",
    flag: null,
    segs: [{
      label: "ALP",
      value: alp,
      color: PARTY_C.alp,
      delta: dAlp
    }, {
      label: "L/NP",
      value: lnp,
      color: PARTY_C.lnp,
      delta: dLnp
    }]
  });
  if (r.tppAlt) out.push({
    kind: "alt",
    lab: "2PP, ALP v ON",
    flag: "+ALP v ON",
    segs: [{
      label: "ALP",
      value: r.tppAlt.alp,
      color: PARTY_C.alp,
      delta: dAltAlp
    }, {
      label: "ON",
      value: r.tppAlt.onp,
      color: PARTY_C.onp,
      delta: mirror(dAltAlp)
    }]
  });
  if (r.tppKind === "3cp" && r.tpp3) out.sort((a, b) => a.segs[0].value - b.segs[0].value);
  if (r.tppAlt2) out.push({
    kind: "alt2",
    lab: "2PP, L/NP v ON",
    flag: "+L/NP v ON",
    segs: [{
      label: "L/NP",
      value: r.tppAlt2.lnp,
      color: PARTY_C.lnp,
      delta: dAlt2Lnp
    }, {
      label: "ON",
      value: r.tppAlt2.onp,
      color: PARTY_C.onp,
      delta: mirror(dAlt2Lnp)
    }]
  });
  if (r.tppKind === "3cp" && r.tpp3) {
    out.push({
      kind: "3cp",
      lab: "3-cornered, ALP v L/NP v ON",
      flag: "3-cornered",
      segs: [{
        label: "ALP",
        value: r.tpp3.alp,
        color: PARTY_C.alp
      }, {
        label: "L/NP",
        value: r.tpp3.lnp,
        color: PARTY_C.lnp
      }, {
        label: "ON",
        value: r.tpp3.onp,
        color: PARTY_C.onp
      }]
    });
  }
  return out;
}
function tppFlag(r) {
  const f = tppContests(r).map(c => c.flag).filter(Boolean);
  return f.length ? f.join(", ") : null;
}
function tppHeading(cs) {
  return "After preferences (as published)";
}
function tppLines(cs, r) {
  const out = [];
  const dFlows = segDelta(r.chg, "flows");
  const dUnd = r.undecidedBasis === "tpp" && r.undecided != null ? segDelta(r.chg, "und") : null;
  for (const c of cs) {
    let note = null;
    if (c.kind === "2pp" && r.undecidedBasis === "tpp" && r.undecided != null) {
      note = React.createElement(React.Fragment, null, note && React.createElement(React.Fragment, null, note, ", "), "undecided ", React.createElement("b", null, r.undecided, "%"), " inside the pair", React.createElement(ChgParen, {
        d: dUnd
      }));
    }
    out.push({
      c,
      note
    });
    if (c.kind === "2pp" && r.tppFlows != null) out.push({
      alt: true,
      note: React.createElement(React.Fragment, null, "under 2025-election", " ", React.createElement("button", {
        type: "button",
        className: "hi-term",
        onClick: () => window.AP.openTerm && window.AP.openTerm("preference-flows", "poll breakdown")
      }, "preference flows")),
      c: {
        kind: "flows",
        lab: "2PP, ALP v L/NP",
        flag: null,
        segs: [{
          label: "ALP",
          value: r.tppFlows,
          color: PARTY_C.alp,
          delta: dFlows
        }, {
          label: "L/NP",
          value: Math.round((100 - r.tppFlows) * 10) / 10,
          color: PARTY_C.lnp,
          delta: dFlows ? {
            v: +(-dFlows.v).toFixed(1),
            refDate: dFlows.refDate
          } : null
        }]
      }
    });
    if (c.kind === "2pp" && r.splitCoal != null) {
      const dCoal = segDelta(r.chg, "splitCoal");
      out.push({
        alt: true,
        note: React.createElement(React.Fragment, null, "Coalition voters, if forced to choose: Labor v One Nation", r.splitCoalEst ? " — combines the report’s printed CLP/LNP/Nat and Liberal rows (no combined row was printed)" : ""),
        c: {
          kind: "split",
          lab: "forced, Coalition voters, ALP v ON",
          flag: null,
          segs: [{
            label: "ALP",
            value: r.splitCoal,
            color: PARTY_C.alp,
            delta: dCoal
          }, {
            label: "ON",
            value: Math.round((100 - r.splitCoal) * 10) / 10,
            color: PARTY_C.onp,
            delta: dCoal ? {
              v: +(-dCoal.v).toFixed(1),
              refDate: dCoal.refDate
            } : null
          }]
        }
      });
    }
    if (c.kind === "2pp" && r.splitOnp != null) {
      const dOnp = segDelta(r.chg, "splitOnp");
      out.push({
        alt: true,
        note: React.createElement(React.Fragment, null, "One Nation voters, if forced to choose: Labor v the Coalition"),
        c: {
          kind: "split",
          lab: "forced, One Nation voters, ALP v L/NP",
          flag: null,
          segs: [{
            label: "ALP",
            value: r.splitOnp,
            color: PARTY_C.alp,
            delta: dOnp
          }, {
            label: "L/NP",
            value: Math.round((100 - r.splitOnp) * 10) / 10,
            color: PARTY_C.lnp,
            delta: dOnp ? {
              v: +(-dOnp.v).toFixed(1),
              refDate: dOnp.refDate
            } : null
          }]
        }
      });
    }
    if (c.kind === "2pp" && r.splitGrn != null) {
      const dGrn = segDelta(r.chg, "splitGrn");
      out.push({
        alt: true,
        note: React.createElement(React.Fragment, null, "Greens voters, if forced to choose: Labor v the Coalition"),
        c: {
          kind: "split",
          lab: "forced, Greens voters, ALP v L/NP",
          flag: null,
          segs: [{
            label: "ALP",
            value: r.splitGrn,
            color: PARTY_C.alp,
            delta: dGrn
          }, {
            label: "L/NP",
            value: Math.round((100 - r.splitGrn) * 10) / 10,
            color: PARTY_C.lnp,
            delta: dGrn ? {
              v: +(-dGrn.v).toFixed(1),
              refDate: dGrn.refDate
            } : null
          }]
        }
      });
    }
    if (c.kind === "2pp" && r.splitGrnOn != null) {
      const dGrnOn = segDelta(r.chg, "splitGrnOn");
      out.push({
        alt: true,
        note: React.createElement(React.Fragment, null, "Greens voters, if forced to choose: Labor v One Nation"),
        c: {
          kind: "split",
          lab: "forced, Greens voters, ALP v ON",
          flag: null,
          segs: [{
            label: "ALP",
            value: r.splitGrnOn,
            color: PARTY_C.alp,
            delta: dGrnOn
          }, {
            label: "ON",
            value: Math.round((100 - r.splitGrnOn) * 10) / 10,
            color: PARTY_C.onp,
            delta: dGrnOn ? {
              v: +(-dGrnOn.v).toFixed(1),
              refDate: dGrnOn.refDate
            } : null
          }]
        }
      });
    }
    if (c.kind === "2pp" && r.splitOth != null) {
      const dOth = segDelta(r.chg, "splitOth");
      out.push({
        alt: true,
        note: React.createElement(React.Fragment, null, "Other voters, if forced to choose: Labor v the Coalition"),
        c: {
          kind: "split",
          lab: "forced, Other voters, ALP v L/NP",
          flag: null,
          segs: [{
            label: "ALP",
            value: r.splitOth,
            color: PARTY_C.alp,
            delta: dOth
          }, {
            label: "L/NP",
            value: Math.round((100 - r.splitOth) * 10) / 10,
            color: PARTY_C.lnp,
            delta: dOth ? {
              v: +(-dOth.v).toFixed(1),
              refDate: dOth.refDate
            } : null
          }]
        }
      });
    }
    if (c.kind === "2pp" && r.splitOthOn != null) {
      const dOthOn = segDelta(r.chg, "splitOthOn");
      out.push({
        alt: true,
        note: React.createElement(React.Fragment, null, "Other voters, if forced to choose: Labor v One Nation"),
        c: {
          kind: "split",
          lab: "forced, Other voters, ALP v ON",
          flag: null,
          segs: [{
            label: "ALP",
            value: r.splitOthOn,
            color: PARTY_C.alp,
            delta: dOthOn
          }, {
            label: "ON",
            value: Math.round((100 - r.splitOthOn) * 10) / 10,
            color: PARTY_C.onp,
            delta: dOthOn ? {
              v: +(-dOthOn.v).toFixed(1),
              refDate: dOthOn.refDate
            } : null
          }]
        }
      });
    }
  }
  return out.map(x => ({
    ...x,
    count: out.length
  }));
}
function impliedLines(r) {
  const out = [];
  const dImp = segDelta(r.chg, "imp") || segDelta(r.chg, "flows");
  const dOnImp = segDelta(r.chg, "impOn");
  if (r.alpImp != null) out.push({
    c: {
      kind: "flows",
      lab: "2PP, ALP v L/NP",
      flag: null,
      segs: [{
        label: "ALP",
        value: r.alpImp,
        color: PARTY_C.alp,
        delta: dImp
      }, {
        label: "L/NP",
        value: Math.round((100 - r.alpImp) * 10) / 10,
        color: PARTY_C.lnp,
        delta: dImp ? {
          v: +(-dImp.v).toFixed(1),
          refDate: dImp.refDate
        } : null
      }]
    },
    note: React.createElement(React.Fragment, null, "under 2025-election", " ", React.createElement("button", {
      type: "button",
      className: "hi-term",
      onClick: () => window.AP.openTerm && window.AP.openTerm("preference-flows", "poll breakdown")
    }, "preference flows"))
  });
  if (r.alpOnImp != null) out.push({
    c: {
      kind: "flows",
      lab: "2PP, ALP v ON",
      flag: null,
      segs: [{
        label: "ALP",
        value: r.alpOnImp,
        color: PARTY_C.alp,
        delta: dOnImp
      }, {
        label: "ON",
        value: Math.round((100 - r.alpOnImp) * 10) / 10,
        color: PARTY_C.onp,
        delta: dOnImp ? {
          v: +(-dOnImp.v).toFixed(1),
          refDate: dOnImp.refDate
        } : null
      }]
    },
    note: React.createElement(React.Fragment, null, "under the", " ", React.createElement("button", {
      type: "button",
      className: "hi-term",
      onClick: () => window.AP.openTerm && window.AP.openTerm("fp-flows", "poll breakdown")
    }, "Labor v One Nation flows"))
  });
  return out.map(x => ({
    ...x,
    count: out.length
  }));
}
function primarySegs(r) {
  return [{
    label: "ALP",
    value: r.p.alp,
    color: PARTY_C.alp,
    delta: segDelta(r.chg, "pAlp")
  }, {
    label: "L/NP",
    value: r.p.lnp,
    color: PARTY_C.lnp,
    delta: segDelta(r.chg, "pLnp")
  }, {
    label: "GRN",
    value: r.p.grn,
    color: PARTY_C.grn,
    delta: segDelta(r.chg, "pGrn")
  }, {
    label: "ON",
    value: r.p.onp,
    color: PARTY_C.onp,
    delta: segDelta(r.chg, "pOnp")
  }, {
    label: "OTH",
    value: r.p.oth,
    color: PARTY_C.oth,
    muted: true,
    delta: segDelta(r.chg, "pOth")
  }].filter(s => s.value != null);
}
const LEADER_META = {
  alb: {
    label: "Albanese",
    color: PARTY_C.alp
  },
  taylor: {
    label: "Taylor",
    color: PARTY_C.lnp
  },
  ley: {
    label: "Ley",
    color: PARTY_C.lnp
  },
  hanson: {
    label: "Hanson",
    color: PARTY_C.onp
  },
  bandt: {
    label: "Bandt",
    color: PARTY_C.grn
  }
};
const PPM_ORDER = ["alb", "ley", "taylor", "bandt", "hanson"];
const PPM_CHG_KEY = {
  alb: "ppmAlb",
  ley: "ppmOpp",
  taylor: "ppmOpp",
  hanson: "ppmHan"
};
function ppmContestSegs(c, chg) {
  const segs = PPM_ORDER.filter(id => c[id] != null).map(id => ({
    label: LEADER_META[id].label,
    value: c[id],
    color: LEADER_META[id].color,
    delta: PPM_CHG_KEY[id] ? segDelta(chg, PPM_CHG_KEY[id]) : null
  }));
  if (c.unc != null) segs.push({
    label: "Undecided",
    value: c.unc,
    resid: true
  });
  return segs;
}
function ppmContests(r) {
  if (Array.isArray(r.ppmSets)) return r.ppmSets;
  if (r.ppm) return [r.ppm];
  return [];
}
function ppmMatch(r, mode) {
  const named = c => c.taylor != null || c.ley != null;
  return ppmContests(r).find(c => mode === "3" ? c.hanson != null && named(c) : mode === "ah" ? c.hanson != null && !named(c) : c.hanson == null) || null;
}
function ppmLabel(c) {
  if (c.label) return c.label;
  return PPM_ORDER.filter(id => c[id] != null).map(id => LEADER_META[id].label).join(" v ");
}
function ppmKind(c) {
  return PPM_ORDER.filter(id => c[id] != null).length >= 3 ? "three-way" : "two-way";
}
function ppmFlag(cs) {
  if (cs.length > 1) return cs.length + " matchups";
  if (cs.length === 1 && ppmKind(cs[0]) === "three-way") return "3-way";
  return null;
}
function dirSegs(r) {
  const unsure = 100 - r.dir.right - r.dir.wrong;
  return [{
    label: "Right direction",
    value: r.dir.right,
    color: "var(--mood-pos)"
  }, {
    label: "Unsure",
    value: unsure,
    resid: true
  }, {
    label: "Wrong track",
    value: r.dir.wrong,
    color: "var(--mood-neg)"
  }];
}
function PollsterName({
  name,
  url
}) {
  if (!url) return React.createElement("span", {
    className: "pollster-name"
  }, name);
  let host = "";
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch (e) {}
  return React.createElement("a", {
    className: "pollster-name pollster-link",
    href: url,
    target: "_blank",
    rel: "noopener noreferrer",
    onClick: e => e.stopPropagation(),
    title: host ? `Read the published poll, ${host}` : "Read the published poll"
  }, name, React.createElement("span", {
    className: "plink-mark",
    "aria-hidden": "true"
  }, "\u2197"));
}
function MethodLink({
  url
}) {
  if (!url) return null;
  let host = "";
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch (e) {}
  return React.createElement("a", {
    className: "pollster-method",
    href: url,
    target: "_blank",
    rel: "noopener noreferrer",
    onClick: e => e.stopPropagation(),
    title: host ? `Read the wave's APC methodology statement, ${host}` : "Read the wave's APC methodology statement"
  }, "APC methodology", React.createElement("span", {
    className: "plink-mark",
    "aria-hidden": "true"
  }, "\u2197"));
}
function ShareBar({
  segs,
  compact,
  flag
}) {
  const total = segs.reduce((s, x) => s + x.value, 0) || 100;
  return React.createElement("div", {
    className: "share" + (compact ? " share-compact" : "")
  }, React.createElement("div", {
    className: "sbar",
    role: "img",
    "aria-label": segs.map(s => `${s.label} ${s.value}`).join(", ")
  }, segs.map((s, i) => React.createElement("span", {
    key: i,
    className: "sbar-seg" + (s.resid ? " sbar-resid" : ""),
    style: {
      width: s.value / total * 100 + "%",
      background: s.resid ? undefined : s.color
    }
  }))), React.createElement("div", {
    className: "share-keys"
  }, segs.map((s, i) => React.createElement("span", {
    key: i,
    className: "skey" + (s.muted || s.resid ? " muted" : "")
  }, React.createElement("span", {
    className: "skey-dot" + (s.resid ? " resid" : ""),
    style: s.resid ? undefined : {
      background: s.color
    }
  }), React.createElement("span", {
    className: "skey-lab"
  }, s.label), React.createElement("span", {
    className: "skey-val"
  }, s.value), !compact && s.delta && React.createElement(ChgTag, {
    v: s.delta.v,
    refDate: s.delta.refDate
  }))), flag && React.createElement("span", {
    className: "facet-flag"
  }, flag)));
}
function NetVal({
  v
}) {
  return React.createElement("span", {
    className: "netv " + (v >= 0 ? "pos" : "neg")
  }, v > 0 ? "+" : "", String(v).replace("-", "\u2212"));
}
const SEAT_META = {
  alp: {
    name: "ALP",
    color: "var(--alp)"
  },
  lnp: {
    name: "L/NP",
    color: "var(--lnp)"
  },
  onp: {
    name: "ON",
    color: "var(--onp)"
  },
  grn: {
    name: "GRN",
    color: "var(--grn)"
  },
  ind: {
    name: "IND",
    color: "var(--oth)"
  },
  ca: {
    name: "CA",
    color: "var(--oth)"
  },
  kap: {
    name: "KAP",
    color: "var(--oth)"
  },
  oth: {
    name: "OTH",
    color: "var(--oth)"
  }
};
function SeatProjection({
  seats
}) {
  if (!seats || !seats.p) return null;
  const total = seats.total || 150;
  const majority = seats.majority || Math.floor(total / 2) + 1;
  const rangeOnly = Object.keys(seats.p).every(id => !seats.p[id] || seats.p[id].est == null);
  const mid = r => r.est != null ? r.est : (r.lo + r.hi) / 2;
  const rows = Object.keys(seats.p).filter(id => seats.p[id] && (seats.p[id].est != null || seats.p[id].lo != null && seats.p[id].hi != null)).map(id => {
    const m = SEAT_META[id] || {
      name: id.toUpperCase(),
      color: "var(--oth)"
    };
    return {
      id,
      ...seats.p[id],
      name: m.name,
      color: m.color
    };
  }).sort((a, b) => mid(b) - mid(a));
  if (!rows.length) return null;
  if (rangeOnly) {
    const best = rows[0];
    const reach = rows.filter(r => r.hi >= majority);
    return React.createElement("div", {
      className: "seatproj"
    }, React.createElement("div", {
      className: "seat-rows"
    }, rows.map(r => React.createElement("div", {
      className: "seat-row",
      key: r.id
    }, React.createElement("span", {
      className: "skey-dot",
      style: {
        background: r.color
      }
    }), React.createElement("span", {
      className: "seat-name"
    }, r.name), React.createElement("span", {
      className: "seat-est range"
    }, r.lo, "\u2013", r.hi), r.note && React.createElement("span", {
      className: "seat-note"
    }, r.note)))), React.createElement("div", {
      className: "seat-majline"
    }, React.createElement("span", {
      className: "seat-majlab"
    }, majority, " for majority"), !reach.length && React.createElement("span", {
      className: "seat-hung"
    }, "no party reaches it \u2013 ", best.name, " tops out ", majority - best.hi, " short")), React.createElement("p", {
      className: "seat-basis"
    }, "Published as a range, with no central estimate", seats.method ? ", " + seats.method : ""));
  }
  const sum = rows.reduce((s, r) => s + r.est, 0);
  const lead = rows[0];
  return React.createElement("div", {
    className: "seatproj"
  }, React.createElement("div", {
    className: "seat-rows"
  }, rows.map(r => React.createElement("div", {
    className: "seat-row",
    key: r.id
  }, React.createElement("span", {
    className: "skey-dot",
    style: {
      background: r.color
    }
  }), React.createElement("span", {
    className: "seat-name"
  }, r.name), React.createElement("span", {
    className: "seat-est"
  }, r.est), r.lo != null && r.hi != null && React.createElement("span", {
    className: "seat-range"
  }, r.lo, "\u2013", r.hi), r.chg != null && React.createElement("span", {
    className: "seat-chg " + (r.chg > 0 ? "up" : r.chg < 0 ? "down" : "flat")
  }, r.chg === 0 ? "–" : (r.chg > 0 ? "▲" : "▼") + Math.abs(r.chg))))), React.createElement("div", {
    className: "seat-majline"
  }, React.createElement("span", {
    className: "seat-majlab"
  }, majority, " for majority"), lead.est < majority && React.createElement("span", {
    className: "seat-hung"
  }, "no party at a majority \u2013 ", lead.name, " short by ", majority - lead.est)), React.createElement("p", {
    className: "seat-basis"
  }, "Modelled seat estimate with range, ", sum, " of ", total, " seats allocated", seats.basis ? `, Change vs the ${seats.basis}, not this pollster’s previous poll` : ""));
}
function FavMark({
  metric
}) {
  if (metric !== "fav") return null;
  return React.createElement("span", {
    className: "fav-mark",
    title: "Net favourability / likeability (positive minus negative) \u2013 a different question from approval, not directly comparable"
  }, "fav");
}
function apprHeading(appr) {
  const mb = appr.metricBy || {};
  const ms = ["alb", "taylor", "hanson"].filter(id => appr[id + "Net"] != null).map(id => mb[id] || "approval");
  if (!ms.length) return "Leader ratings";
  if (ms.every(m => m === "fav")) return "Leader favourability";
  if (ms.every(m => m === "approval")) return "Leader approval";
  return "Leader ratings";
}
function ChgTag({
  v,
  refDate
}) {
  if (v == null) return null;
  const {
    D
  } = window.AP;
  const flat = Math.abs(v) < 0.05;
  const lab = refDate ? (() => {
    const [, m, d] = refDate.split("-").map(Number);
    return d + " " + D.monthName(m);
  })() : null;
  return React.createElement("span", {
    className: "chg" + (flat ? " flat" : v > 0 ? " up" : " down"),
    title: "vs this pollster’s previous poll" + (lab ? " (" + lab + ")" : "")
  }, flat ? "–" : (v > 0 ? "▲" : "▼") + Math.abs(v));
}
function segDelta(chg, key) {
  if (!chg || chg.d[key] == null) return null;
  return {
    v: chg.d[key],
    refDate: chg.r[key]
  };
}
function DirCell({
  r
}) {
  if (!r.dir) return React.createElement("span", {
    className: "dash",
    title: "Not asked by this pollster"
  }, "\u2014");
  const net = r.dir.right - r.dir.wrong;
  return React.createElement(NetVal, {
    v: net
  });
}
function SortTh({
  label,
  short,
  sortKey,
  k,
  sort,
  onSort,
  className
}) {
  const key = sortKey != null ? sortKey : k;
  const active = sort.key === key;
  return React.createElement("th", {
    scope: "col",
    className: (className || "") + " sortable" + (active ? " sorted" : ""),
    onClick: () => onSort(key),
    tabIndex: 0,
    title: short ? label : undefined,
    onKeyDown: e => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onSort(key);
      }
    },
    "aria-sort": active ? sort.dir < 0 ? "descending" : "ascending" : "none"
  }, React.createElement("span", {
    className: "th-in"
  }, short ? React.createElement(React.Fragment, null, React.createElement("span", {
    className: "lbl-l"
  }, label), React.createElement("span", {
    className: "lbl-s"
  }, short)) : label, React.createElement("span", {
    className: "caret",
    "aria-hidden": "true"
  }, active ? sort.dir < 0 ? "▾" : "▴" : "⇅")));
}
function ChgParen({
  d
}) {
  if (!d) return null;
  return React.createElement("span", {
    className: "pd-s-chg"
  }, " (", React.createElement(ChgTag, {
    v: d.v,
    refDate: d.refDate
  }), ")");
}
function PdSec({
  label,
  absent,
  lead,
  mid,
  children
}) {
  const kids = React.Children.toArray(children).filter(Boolean);
  return React.createElement("section", {
    className: "pd-sec" + (lead ? " pd-sec-lead" : "") + (mid ? " pd-sec-mid" : "")
  }, React.createElement("div", {
    className: "pd-k"
  }, label), kids.length ? kids : React.createElement("p", {
    className: "pd-absent"
  }, absent || "Not published"));
}
function TppLine({
  c,
  prefixed,
  note,
  hero,
  alt
}) {
  const segs = c.segs.filter(x => x.value != null);
  const mat = c.lab.replace(/^2PP, /, "").replace(/^3-cornered, /, "");
  return React.createElement(React.Fragment, null, React.createElement("p", {
    className: "pd-s" + (hero ? " pd-s-hero" : "")
  }, prefixed && React.createElement("span", {
    className: "pd-mat"
  }, mat, ": "), alt && React.createElement("span", {
    className: "pd-vs"
  }, "or "), segs.map((x, i) => React.createElement(React.Fragment, {
    key: i
  }, i > 0 && (segs.length === 2 ? React.createElement("span", {
    className: "pd-vs"
  }, " vs ") : ", "), React.createElement("span", {
    className: "pd-grp"
  }, React.createElement("b", null, x.value, "%"), " ", React.createElement("span", {
    className: "pd-lab"
  }, x.label), React.createElement(ChgParen, {
    d: x.delta
  }))))), note && React.createElement("p", {
    className: "pd-s pd-s-basis" + (alt ? " pd-s-basis-alt" : "")
  }, note));
}
function EffLines({
  eff
}) {
  if (!eff || !eff.lnp && !eff.imp && !eff.onp && !eff.onimp) return null;
  const signed = e => {
    const d = Math.round((e.hi - e.lo) * 10) / 10;
    return (d < 0 ? "−" : "+") + Math.abs(d).toFixed(1);
  };
  const prim = eff.imp || eff.lnp || null;
  const shareOut = prim && [eff.imp, eff.lnp, eff.onimp, eff.onp].filter(Boolean).every(e => !e.w);
  const asThen = e => ({
    ...e,
    lo: e.t.lo,
    hi: e.t.hi,
    w: 1
  });
  const winSpan = m => `the aggregate\u2019s ${m ? "month" : "21-day window"}`;
  const clause = (e, who) => React.createElement(React.Fragment, null, signed(e), " for ALP vs ", who, !e.w && React.createElement("span", {
    className: "pd-s-note"
  }, " (outside ", winSpan(e.m), ")"));
  const groups = then => {
    const pick = e => e && (!then || e.t) ? then ? asThen(e) : e : null;
    const def = [[pick(eff.imp) || pick(eff.lnp), "L/NP"], [pick(eff.onimp) || pick(eff.onp), "ON"]].filter(([e]) => e);
    const resp = [[eff.imp && eff.lnp ? pick(eff.lnp) : null, "L/NP"], [eff.onimp && eff.onp ? pick(eff.onp) : null, "ON"]].filter(([e]) => e);
    return {
      def,
      resp
    };
  };
  const list = grp => grp.map(([e, who], i) => React.createElement(React.Fragment, {
    key: who
  }, i > 0 && React.createElement(React.Fragment, null, "; "), clause(e, who)));
  const byBasis = then => {
    const g = groups(then);
    return React.createElement(React.Fragment, null, list(g.def), g.resp.length > 0 && React.createElement(React.Fragment, null, ". ", React.createElement("span", {
      className: "pd-s-note"
    }, "Respondent-allocated: "), list(g.resp)));
  };
  return React.createElement("span", {
    className: "pd-meta-i"
  }, React.createElement("button", {
    type: "button",
    className: "pd-meta-k hi-term",
    onClick: () => window.AP.openTerm && window.AP.openTerm("aggregate-effect", "poll breakdown")
  }, "2PP aggregate effect"), React.createElement("span", {
    className: "pd-meta-v"
  }, shareOut ? prim.t ? React.createElement(React.Fragment, null, byBasis(true), React.createElement("span", {
    className: "pd-s-note"
  }, ", when inside ", winSpan(prim.m))) : React.createElement("span", {
    className: "pd-s-note"
  }, "None. Outside ", winSpan(prim.m)) : React.createElement(React.Fragment, null, byBasis(false))));
}
function ApprLine({
  id,
  appr,
  chg
}) {
  const s = appr[id],
    net = appr[id + "Net"];
  if (s == null && net == null) return null;
  const mt = appr.metricBy && appr.metricBy[id] || "approval";
  const label = id === "taylor" && appr.oppName ? appr.oppName : LEADER_META[id].label;
  const leg = mt === "fav" ? ["positive", "neutral", "negative"] : ["approve", "don’t know", "disapprove"];
  const dk = s ? Math.max(0, 100 - s.app - s.dis) : 0;
  const d = chg && chg.d[id + "Net"] != null ? {
    v: chg.d[id + "Net"],
    refDate: chg.r[id + "Net"]
  } : null;
  const alt = appr.alt && appr.alt[id];
  return React.createElement("p", {
    className: "pd-s"
  }, label, ":", s ? " " : React.createElement("span", {
    className: "pd-s-note"
  }, " no ", leg[0], " / ", leg[2], " split published,"), s && React.createElement(React.Fragment, null, React.createElement("span", {
    className: "pd-grp"
  }, React.createElement("b", null, s.app, "%"), " ", React.createElement("span", {
    className: "pd-lab"
  }, leg[0])), ",", " ", React.createElement("span", {
    className: "pd-grp"
  }, React.createElement("b", null, s.dis, "%"), " ", React.createElement("span", {
    className: "pd-lab"
  }, leg[2])), dk > 0 && React.createElement(React.Fragment, null, ", ", React.createElement("span", {
    className: "pd-grp"
  }, React.createElement("b", null, dk, "%"), " ", React.createElement("span", {
    className: "pd-lab"
  }, leg[1])))), net != null && React.createElement(React.Fragment, null, s ? ", " : " ", React.createElement("span", {
    className: "pd-grp"
  }, React.createElement("span", {
    className: "pd-lab"
  }, "net"), " ", React.createElement(NetVal, {
    v: net
  }), React.createElement(FavMark, {
    metric: mt
  }), React.createElement(ChgParen, {
    d: d
  }))), alt && React.createElement("span", {
    className: "pd-s-note",
    title: "This pollster asked both questions of this leader in the same wave \u2013 favourability (positive minus negative) is not directly comparable with approval"
  }, ", also ", alt.metric === "fav" ? "favourability" : "approval", " ", React.createElement(NetVal, {
    v: alt.net
  })));
}
function sampleValue(x) {
  return React.createElement(React.Fragment, null, x.sample != null ? "n = " + x.sample.toLocaleString() : x.sampleEff == null ? "—" : null, x.sampleEff != null && React.createElement("span", {
    title: "Effective sample as published by the pollster (APC methodology statement)"
  }, x.sample != null && ", ", "n", React.createElement("sub", null, "eff"), " = ", x.sampleEff.toLocaleString()));
}
function releaseMetaRows(r) {
  const relRows = [];
  if (r.provisional) relRows.push(React.createElement("span", {
    className: "pd-meta-i",
    key: "prov"
  }, React.createElement("span", {
    className: "pd-meta-k"
  }, "Source"), React.createElement("span", {
    className: "pd-meta-v"
  }, React.createElement("a", {
    className: "pd-release",
    href: r.provisionalUrl || r.url,
    target: "_blank",
    rel: "noopener noreferrer"
  }, r.provisional, React.createElement("span", {
    className: "plink-mark",
    "aria-hidden": "true"
  }, "\u2197")), React.createElement("span", {
    className: "pd-s-note"
  }, r.provisionalScope === "leaders" ? " (provisional – the leader ratings are mirrored from its poll-data table until the pollster’s own release is captured; the voting figures are the house’s own)" : " (provisional – figures mirrored from its poll-data table until the pollster’s own release is captured)"))));
  if (r.releaseUrl) relRows.push(React.createElement("span", {
    className: "pd-meta-i",
    key: "rel"
  }, React.createElement("span", {
    className: "pd-meta-k"
  }, "Pollster\u2019s release"), React.createElement("span", {
    className: "pd-meta-v"
  }, React.createElement("a", {
    className: "pd-release",
    href: r.releaseUrl,
    target: "_blank",
    rel: "noopener noreferrer"
  }, "Here", React.createElement("span", {
    className: "plink-mark",
    "aria-hidden": "true"
  }, "\u2197")), r.releaseHub ? React.createElement(React.Fragment, null, React.createElement("span", {
    className: "pd-s-note"
  }, " (wave-specific page), and "), React.createElement("a", {
    className: "pd-release",
    href: r.releaseHub,
    target: "_blank",
    rel: "noopener noreferrer"
  }, "here", React.createElement("span", {
    className: "plink-mark",
    "aria-hidden": "true"
  }, "\u2197")), React.createElement("span", {
    className: "pd-s-note"
  }, " (general rolling collection)")) : (r.releaseUrl === r.methodUrl && React.createElement("span", {
    className: "pd-s-note"
  }, " (includes the wave’s APC methodology statement)")))));
  if (r.methodUrl && r.methodUrl !== r.releaseUrl) relRows.push(React.createElement("span", {
    className: "pd-meta-i",
    key: "apc"
  }, React.createElement("button", {
    type: "button",
    className: "pd-meta-k hi-term",
    title: "Australian Polling Council methodology statement",
    onClick: () => window.AP.openTerm && window.AP.openTerm("apc-statement", "poll breakdown")
  }, "APC statement"), React.createElement("span", {
    className: "pd-meta-v"
  }, React.createElement("a", {
    className: "pd-release",
    href: r.methodUrl,
    target: "_blank",
    rel: "noopener noreferrer"
  }, "Here", React.createElement("span", {
    className: "plink-mark",
    "aria-hidden": "true"
  }, "\u2197")))));
  return relRows;
}
function PollLedger({
  r,
  dirSegments
}) {
  const tcs = tppContests(r);
  const ppms = ppmContests(r);
  const appr = r.appr || {};
  const noAppr = appr.albNet == null && appr.taylorNet == null && appr.hansonNet == null;
  const tppRefs = tppLines(tcs, r);
  const absLabels = [{
    label: tppHeading(tcs),
    absent: tppRefs.length === 0
  }, {
    label: "Preferred PM",
    absent: ppms.length === 0
  }, {
    label: apprHeading(appr),
    absent: noAppr
  }].map((s, i, all) => {
    if (!s.absent) return null;
    if (i > 0 && all[i - 1].absent) return "swallowed";
    let label = s.label;
    for (let j = i + 1; j < all.length && all[j].absent; j++) label += ", " + all[j].label;
    return label;
  });
  return React.createElement("div", {
    className: "pd-simple"
  }, React.createElement(PdSec, {
    label: "First preferences"
  }, React.createElement("p", {
    className: "pd-s"
  }, primarySegs(r).sort((a, b) => b.value - a.value).map((x, i) => React.createElement(React.Fragment, {
    key: i
  }, i > 0 && ", ", React.createElement("span", {
    className: "pd-grp" + (x.muted ? " pd-s-note" : "")
  }, React.createElement("span", {
    className: "pd-lab"
  }, x.label), " ", React.createElement("b", null, x.value, "%"), React.createElement(ChgParen, {
    d: x.delta
  }))))), r.undecided != null && r.undecidedBasis !== "tpp" && (d => React.createElement("p", {
    className: "pd-s pd-s-basis"
  }, React.createElement("b", null, r.undecided, "%"), " undecided,", " ", r.undecidedBasis === "soft" ? "not firm" : "set aside", React.createElement(ChgParen, {
    d: d
  })))(segDelta(r.chg, "und"))), (r.alpImp != null || r.alpOnImp != null) && React.createElement(PdSec, {
    label: React.createElement("button", {
      type: "button",
      className: "hi-term",
      onClick: () => window.AP.openTerm && window.AP.openTerm("implied-2pp", "poll breakdown")
    }, "After preferences (implied)"),
    lead: true
  }, impliedLines(r).map((x, i) => React.createElement(TppLine, {
    key: "i" + i,
    c: x.c,
    prefixed: x.count > 1,
    note: x.note,
    hero: true
  }))), absLabels[0] !== "swallowed" && React.createElement(PdSec, {
    label: absLabels[0] ?? tppHeading(tcs)
  }, tppRefs.map((x, i) => React.createElement(TppLine, {
    key: "t" + i,
    c: x.c,
    prefixed: x.count > 1 && !x.alt,
    note: x.note,
    alt: x.alt
  }))), absLabels[1] !== "swallowed" && React.createElement(PdSec, {
    label: absLabels[1] ?? "Preferred PM"
  }, ppms.map((c, i) => {
    const segs = ppmContestSegs(c, i === 0 ? r.chg : null);
    const cand = segs.filter(x => !x.resid);
    const unc = segs.find(x => x.resid);
    return (React.createElement("p", {
        className: "pd-s",
        key: "p" + i
      }, cand.map((x, j) => React.createElement(React.Fragment, {
        key: j
      }, j > 0 && React.createElement("span", {
        className: "pd-vs"
      }, " vs "), React.createElement("span", {
        className: "pd-grp"
      }, React.createElement("b", null, x.value, "%"), " ", React.createElement("span", {
        className: "pd-lab"
      }, x.label), React.createElement(ChgParen, {
        d: x.delta
      })))), unc && React.createElement(React.Fragment, null, ", ", React.createElement("span", {
        className: "pd-grp pd-s-note"
      }, React.createElement("b", null, unc.value, "%"), " ", React.createElement("span", {
        className: "pd-lab"
      }, "undecided"))))
    );
  })), absLabels[2] !== "swallowed" && React.createElement(PdSec, {
    label: absLabels[2] ?? apprHeading(appr)
  }, !noAppr && ["alb", "taylor", "hanson"].map(id => React.createElement(ApprLine, {
    key: id,
    id: id,
    appr: appr,
    chg: r.chg
  }))), dirSegments && React.createElement(PdSec, {
    label: "National direction",
    mid: true
  }, React.createElement("p", {
    className: "pd-s"
  }, React.createElement("span", {
    className: "pd-grp"
  }, React.createElement("b", null, dirSegments[0].value, "%"), " ", React.createElement("span", {
    className: "pd-lab"
  }, "right direction"), React.createElement(ChgParen, {
    d: dirSegments[0].delta
  })), React.createElement("span", {
    className: "pd-vs"
  }, " vs "), React.createElement("span", {
    className: "pd-grp"
  }, React.createElement("b", null, dirSegments[2].value, "%"), " ", React.createElement("span", {
    className: "pd-lab"
  }, "wrong track"), React.createElement(ChgParen, {
    d: dirSegments[2].delta
  }))), dirSegments[1].value != null && React.createElement("p", {
    className: "pd-s pd-s-basis"
  }, "(", dirSegments[1].value, "% unsure)"), r.dir.bg && r.dir.bg.map((row, i) => React.createElement("p", {
    key: i,
    className: "pd-s pd-s-basis pd-s-dircut"
  }, React.createElement("em", null, row.head), " ", row.cuts.map((c, j) => React.createElement(React.Fragment, {
    key: j
  }, j > 0 ? " · " : null, c.label, " ", row.form === "wrong" ? React.createElement(React.Fragment, null, React.createElement("b", null, c.wrong), c.right != null && React.createElement("span", {
    className: "chg"
  }, "\xA0(right ", c.right, ")")) : React.createElement("b", null, c.right, "\u2013", c.wrong)))))), r.seats && React.createElement(PdSec, {
    label: "Seat projection"
  }, React.createElement(SeatProjection, {
    seats: r.seats
  })));
}
function PollDetail({
  r
}) {
  return React.createElement("div", {
    className: "poll-detail"
  }, React.createElement("div", {
    className: "pd-meta"
  }, React.createElement("span", {
    className: "pd-meta-items"
  }, React.createElement("span", {
    className: "pd-meta-i"
  }, React.createElement("span", {
    className: "pd-meta-k"
  }, "Fieldwork"), React.createElement("span", {
    className: "pd-meta-v"
  }, r.fieldPending ? rdFieldTbc(r) : r.field)), React.createElement("span", {
    className: "pd-meta-i"
  }, React.createElement("span", {
    className: "pd-meta-k"
  }, "Published"), React.createElement("span", {
    className: "pd-meta-v"
  }, pubStamp(r.published, {
    year: true
  }) || React.createElement("span", {
    className: "pd-est",
    title: "Publication date not recorded for this poll \u2013 showing the last day of fieldwork"
  }, r.releasedLabel))), r.mode && React.createElement("span", {
    className: "pd-meta-i"
  }, React.createElement("span", {
    className: "pd-meta-k"
  }, "Method"), React.createElement("span", {
    className: "pd-meta-v"
  }, r.mode)), React.createElement("span", {
    className: "pd-meta-i"
  }, React.createElement("span", {
    className: "pd-meta-k"
  }, "Sample"), React.createElement("span", {
    className: "pd-meta-v"
  }, sampleValue(r))), releaseMetaRows(r), r.eff && React.createElement(EffLines, {
    eff: r.eff
  }))), React.createElement(PollLedger, {
    r: r,
    dirSegments: r.dir ? dirSegs(r) : null
  }));
}
const WD = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const NP_MAX_ROWS = 14;
function clockParts(mins) {
  const h = Math.floor(mins / 60),
    mi = mins % 60;
  const ap = h < 12 ? "am" : "pm";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return {
    num: mi ? `${h12}:${String(mi).padStart(2, "0")}` : `${h12}`,
    ap
  };
}
function clockLabel(mins) {
  const c = clockParts(mins);
  return `${c.num} ${c.ap}`;
}
let easternTz;
const easternTzFmt = () => {
  if (easternTz === undefined) {
    try {
      easternTz = new Intl.DateTimeFormat("en-AU", {
        timeZone: "Australia/Sydney",
        timeZoneName: "short"
      });
    } catch (e) {
      easternTz = null;
    }
  }
  return easternTz;
};
function easternAbbr(ms) {
  const EASTERN_TZ = easternTzFmt();
  if (!EASTERN_TZ || ms == null || !isFinite(ms)) return "AEST";
  try {
    const z = EASTERN_TZ.formatToParts(new Date(ms + 2 * 3600000)).find(x => x.type === "timeZoneName");
    return z && /^AE[SD]T$/.test(z.value) ? z.value : "AEST";
  } catch (e) {
    return "AEST";
  }
}
const zoned = (label, ms) => label ? `${label} ${easternAbbr(ms)}` : label;
function pubStamp(published, opts) {
  if (!published) return null;
  const iso = published.slice(0, 10);
  const d = new Date(iso + "T00:00:00Z");
  const mon = window.AP.D.monthName(d.getUTCMonth() + 1);
  const date = `${d.getUTCDate()} ${mon}` + (opts && opts.year ? " " + String(d.getUTCFullYear()).slice(2) : "");
  const cl = /T(\d{2}):(\d{2})/.exec(published);
  return cl ? `${date}, ${zoned(clockLabel(+cl[1] * 60 + +cl[2]), Date.parse(iso))}` : date;
}
const RELEASE_TIGHT_MINS = 120;
function spreadLabel(r) {
  if (r.releaseDow == null) return ` ± ${r.spread} day${r.spread === 1 ? "" : "s"}`;
  const weeks = Math.floor((r.spread + 3) / 7);
  return weeks === 0 ? "" : ` ± ${weeks} week${weeks === 1 ? "" : "s"}`;
}
function releaseLabel(from, to, mid, vals) {
  if (from == null || to == null) return null;
  if (from === to) return clockLabel(from);
  if (vals && vals.length >= 2) {
    const ps = vals.map(clockParts);
    return ps.every(p => p.ap === ps[0].ap) ? `${ps.slice(0, -1).map(p => p.num).join(", ")} or ${ps[ps.length - 1].num} ${ps[0].ap}` : vals.slice(0, -1).map(clockLabel).join(", ") + ` or ${clockLabel(vals[vals.length - 1])}`;
  }
  if (to - from > RELEASE_TIGHT_MINS) return clockLabel(Math.round(mid != null ? mid : (from + to) / 2));
  const a = clockParts(from),
    b = clockParts(to);
  return a.ap === b.ap ? `${a.num}–${b.num} ${b.ap}` : `${clockLabel(from)}–${clockLabel(to)}`;
}
function cadenceLabel(d) {
  if (d >= 6.5 && d <= 7.5) return "weekly";
  if (d >= 13 && d <= 15) return "fortnightly";
  if (d >= 20 && d <= 22) return "every 3 weeks";
  if (d >= 27 && d <= 32) return "monthly";
  if (d >= 40 && d <= 48) return "every 6 weeks";
  return `every ${Math.round(d)} days`;
}
let npOpenRow = null;
function NextPollsPanel() {
  if (window.AP.rd) return null;
  const {
    D
  } = window.AP;
  const [open, setOpenState] = useState(npOpenRow);
  const setOpen = v => {
    npOpenRow = v;
    setOpenState(v);
  };
  const {
    rows: projRows,
    nowMs
  } = npProject();
  if (!projRows.length) return null;
  const rows = projRows.slice(0, NP_MAX_ROWS);
  const fmt = ms => {
    const d = new Date(ms);
    return `${WD[d.getUTCDay()].slice(0, 3)} ${d.getUTCDate()} ${D.monthName(d.getUTCMonth() + 1)}`;
  };
  const when = n => n === -1 ? "yesterday" : n < 0 ? `${-n} days overdue` : n === 0 ? "today" : n === 1 ? "tomorrow" : `in ${n} days`;
  const ago = n => n === 0 ? "earlier today" : n === 1 ? "yesterday" : `${n} days ago`;
  const inHours = r => {
    if (r.inDays !== 0 || r.releaseMins == null) return null;
    const ms = r.release + r.releaseMins * 60000 - nowMs;
    if (ms <= 0 || Math.round(ms / 3600000) >= 12) return null;
    const mins = Math.max(1, Math.round(ms / 60000));
    if (mins < 60) return `in ${mins} min${mins === 1 ? "" : "s"}`;
    const h = Math.round(mins / 60);
    return `in ${h} hour${h === 1 ? "" : "s"}`;
  };
  const pmLabel = r => {
    if (r.rolled) return "";
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
  const dayAlt = r => {
    if (r.rolled) return null;
    const se = r.slotEarly != null ? r.slotEarly : r.spreadEarly;
    const sl = r.slotLate != null ? r.slotLate : r.spreadLate;
    if (r.releaseDow != null && se != null) {
      const widen = Math.sqrt(r.ahead + 1);
      const earlyW = Math.floor((se * widen + 3) / 7);
      const lateW = Math.floor((sl * widen + 3) / 7);
      if (earlyW === 0 && lateW >= 1) return ` (or ${r.inDays + lateW * 7}${r.inDays < 2 && r.inDays >= 0 ? " days" : ""})`;
      if (lateW === 0 && earlyW >= 1 && r.inDays - earlyW * 7 >= 1) return ` (or ${r.inDays - earlyW * 7})`;
    }
    return null;
  };
  const fmtDay = iso => {
    const d = new Date(iso + "T00:00:00Z");
    return `${d.getUTCDate()} ${D.monthName(d.getUTCMonth() + 1)} ${d.getUTCFullYear()}`;
  };
  const fmtDow = iso => `${WD[new Date(iso + "T00:00:00Z").getUTCDay()].slice(0, 3)} ${fmtDay(iso)}`;
  return React.createElement("section", {
    className: "card next-polls"
  }, React.createElement("div", {
    className: "np-head"
  }, React.createElement("h2", {
    className: "card-title"
  }, "Next expected polls"), React.createElement("p", {
    className: "card-sub"
  }, React.createElement("button", {
    type: "button",
    className: "hi-term",
    title: "How these forecasts are made",
    onClick: () => window.AP.openTerm && window.AP.openTerm("next-polls", "Next expected polls")
  }, "Projected from each house\u2019s recent publication intervals"), ", ", "Open a row for the releases behind it")), React.createElement("ol", {
    className: "np-list"
  }, rows.map(r => {
    const key = r.pollster + "-" + r.release;
    const isOpen = open === key;
    const hour = releaseLabel(r.releaseFrom, r.releaseTo, r.releaseMid, r.releaseVals);
    const recent = r.recent || [];
    const winOpen = !r.loose && r.overdue && !r.missed;
    const edge = r.release + r.winHalf * DAY_MS;
    return React.createElement("li", {
      className: "np-item" + (isOpen ? " open" : ""),
      key: key
    }, React.createElement("div", {
      className: "np-row" + (r.loose ? " np-loose" : "") + (isOpen ? " open" : ""),
      onClick: () => setOpen(isOpen ? null : key)
    }, React.createElement("span", {
      className: "np-firm"
    }, React.createElement("button", {
      className: "exp-btn" + (isOpen ? " open" : ""),
      "aria-expanded": isOpen,
      "aria-label": isOpen ? "Hide the releases this is projected from" : `The releases ${r.pollster} is projected from`
    }, "\u25B8"), r.site ? React.createElement("a", {
      className: "np-link",
      href: r.site,
      target: "_blank",
      rel: "noopener noreferrer",
      onClick: e => e.stopPropagation(),
      title: `Where ${r.pollster} publishes`
    }, r.pollster, React.createElement("span", {
      className: "plink-mark",
      "aria-hidden": "true"
    }, "\u2197")) : r.pollster), React.createElement("span", {
      className: "np-date"
    }, r.loose ? React.createElement(React.Fragment, null, fmt(r.release - r.spread * DAY_MS), "\u2013", fmt(r.release + r.spread * DAY_MS)) : React.createElement(React.Fragment, null, fmt(winOpen ? edge : r.release), hour && React.createElement("span", {
      className: "np-time"
    }, ", ", zoned(hour, winOpen ? edge : r.release)), React.createElement("span", {
      className: "np-pm"
    }, winOpen ? edge !== r.release ? ` (or ${fmt(r.release)})` : "" : pmLabel(r)))), React.createElement("span", {
      className: "np-when" + (r.missed ? " np-missed" : "")
    }, r.loose ? r.missed ? when(r.closesIn) : r.opensIn <= 0 ? "open now" : "opens " + when(r.opensIn) : r.overdue && !r.missed ? React.createElement(React.Fragment, null, when(r.closesIn), React.createElement("span", {
      className: "np-when-or"
    }, ` (or ${ago(-r.inDays)})`)) : React.createElement(React.Fragment, null, inHours(r) || when(r.inDays), dayAlt(r) && React.createElement("span", {
      className: "np-when-or"
    }, dayAlt(r)))), React.createElement("span", {
      className: "np-cadence"
    }, cadenceLabel(r.cadence), r.ahead === 0 && React.createElement(React.Fragment, null, ", ", r.waves, " waves"))), isOpen && React.createElement("div", {
      className: "np-detail"
    }, React.createElement("div", {
      className: "npd-h"
    }, "Last ", recent.length, " releases", r.site && React.createElement("a", {
      className: "npd-site",
      href: r.site,
      target: "_blank",
      rel: "noopener noreferrer",
      onClick: e => e.stopPropagation()
    }, (() => {
      try {
        return new URL(r.site).hostname.replace(/^www\./, "");
      } catch (e) {
        return "the house";
      }
    })(), React.createElement("span", {
      className: "plink-mark",
      "aria-hidden": "true"
    }, "\u2197"))), React.createElement("div", {
      className: "npd-row npd-cols",
      "aria-hidden": "true"
    }, React.createElement("span", null, "Field to"), React.createElement("span", null, "Published"), React.createElement("span", null, "Interval")), React.createElement("ol", {
      className: "npd-list"
    }, [...recent].reverse().map(x => React.createElement("li", {
      className: "npd-row",
      key: x.field
    }, (() => {
      const key = window.AP.pollRowKey && window.AP.pollRowKey({
        pollster: r.pollster,
        released: x.field
      });
      if (!key || !window.AP.openPoll) return React.createElement("span", {
        className: "npd-field"
      }, fmtDay(x.field));
      return React.createElement("button", {
        className: "npd-field npd-field-link",
        onClick: e => {
          e.stopPropagation();
          window.AP.openPoll(key, "twopp", "next expected polls");
        },
        title: "Open this poll in All polls"
      }, fmtDay(x.field), React.createElement("span", {
        className: "plink-mark",
        "aria-hidden": "true"
      }, "\u2192"));
    })(), x.pub ? (() => {
      const stamp = React.createElement(React.Fragment, null, fmtDow(x.pub), x.mins != null && React.createElement(React.Fragment, null, ", ", zoned(clockLabel(x.mins), Date.parse(x.pub))));
      return x.url ? React.createElement("a", {
        className: "npd-pub npd-pub-link",
        href: x.url,
        target: "_blank",
        rel: "noopener noreferrer",
        onClick: e => e.stopPropagation(),
        title: "Read this release"
      }, stamp, React.createElement("span", {
        className: "plink-mark",
        "aria-hidden": "true"
      }, "\u2197")) : React.createElement("span", {
        className: "npd-pub"
      }, stamp);
    })() : React.createElement("span", {
      className: "npd-pub none",
      title: "No publication date recorded for this wave"
    }, "\u2014"), React.createElement("span", {
      className: "npd-gap",
      title: x.since ? `Since the previous ${r.basis === "published" ? "publication" : "fieldwork end"}, ${fmtDay(x.since)}` : undefined
    }, x.gap != null ? `${x.gap} days` : "")))), React.createElement("p", {
      className: "npd-foot"
    }, "Median ", r.cadence, " days between", " ", r.basis === "published" ? "publications" : "fieldwork ends", " across the last ", r.gapsUsed, " intervals", r.monthEnd ? "" : r.spreadEarly != null && r.spreadEarly !== r.spreadLate ? `, –${r.spreadEarly}/+${r.spreadLate} days` : r.spread ? `, ± ${r.spread} day${r.spread === 1 ? "" : "s"}` : "", ".", r.basis !== "published" && React.createElement(React.Fragment, null, " ", "Plus", " ", r.lagMeasured ? `a ${r.lag}-day publication lag measured off ${r.lagMeasured} releases` : "the field’s one-day publication lag", "."), r.releaseDow != null && !r.monthEnd && ` Nudged onto ${WD[r.releaseDow]}${hour ? `, when it files at ${zoned(hour, r.release)}` : ""}.`, r.monthEnd && ` Projected onto the ${WD[r.releaseDow]} nearest the month’s last day${hour ? `, when it files at ${zoned(hour, r.release)}` : ""} – the day it has published on in ${r.monthEndKept} of its last ${r.monthEndN} releases.`, r.releaseDow == null && hour && ` It files at ${zoned(hour, r.release)}.`, (r.declared || []).length > 0 && ` The ${houseList(r.declared, Infinity)} ${r.declared.length > 1 ? "are" : "is"} stated from ${r.pollster}’s own schedule rather than measured.`, r.summer && ` That puts the next one in the summer break. No federal poll has been published between 23 December and 8 January, and last summer the pollsters came back anywhere from 9 January to 1 February, so that range is the window.`)));
  })));
}
const LEAD_LABEL = {
  lnp: "ALP v L/NP",
  onp: "ALP v ON",
  lnponp: "L/NP v ON"
};
function PollsterTable({
  tppBasis,
  setTppBasis,
  tppMatchup,
  setTppMatchup
}) {
  if (window.AP.rd) return React.createElement(RdPolls, {
    tppBasis: tppBasis,
    setTppBasis: setTppBasis,
    tppMatchup: tppMatchup,
    setTppMatchup: setTppMatchup
  });
  const {
    D
  } = window.AP;
  const {
    ArchTpp,
    ArchLead,
    ArchApprCell,
    archLeadInfo
  } = window;
  const measure = window.AP.measureOfMatchup(tppMatchup);
  const flipMatchup = () => setTppMatchup && setTppMatchup(tppMatchup === "alp_on" ? "alp_lnp" : "alp_on");
  const [facet, setFacet] = useState("twopp");
  const [sort, setSort] = useState({
    key: "pubSort",
    dir: -1
  });
  const [open, setOpen] = useState(null);
  const onSort = key => setSort(s => s.key === key ? {
    key,
    dir: -s.dir
  } : {
    key,
    dir: -1
  });
  const getVal = (r, key) => {
    switch (key) {
      case "pollster":
        return r.pollster;
      case "released":
        return r.released;
      case "pubSort":
        return r.pubSort;
      case "sample":
        return r.sample ?? -Infinity;
      case "alp":
        {
          const li = archLeadInfo(r, measure, tppBasis);
          return li ? li.m : -Infinity;
        }
      case "p.alp":
        return r.p.alp ?? -Infinity;
      case "p.lnp":
        return r.p.lnp ?? -Infinity;
      case "p.grn":
        return r.p.grn ?? -Infinity;
      case "p.onp":
        return r.p.onp ?? -Infinity;
      case "ppm.alb":
        {
          const c = ppmContests(r)[0];
          return c && c.alb != null ? c.alb : -Infinity;
        }
      case "appr.albNet":
        return r.appr.albNet != null ? r.appr.albNet : -Infinity;
      case "appr.taylorNet":
        return r.appr.taylorNet != null ? r.appr.taylorNet : -Infinity;
      case "appr.hansonNet":
        return r.appr.hansonNet != null ? r.appr.hansonNet : -Infinity;
      default:
        return 0;
    }
  };
  const rows = [...D.pollsterTable].sort((a, b) => {
    const va = getVal(a, sort.key),
      vb = getVal(b, sort.key);
    if (va < vb) return -sort.dir;
    if (va > vb) return sort.dir;
    return 0;
  });
  const newest = [...D.pollsterTable].sort((a, b) => b.pubSort.localeCompare(a.pubSort));
  const fmtWin = iso => {
    const [, m, d] = iso.slice(0, 10).split("-").map(Number);
    return `${d} ${D.monthNameFull(m)}`;
  };
  const windowLabel = `${fmtWin(newest[newest.length - 1].pubSort)}\u2013${fmtWin(newest[0].pubSort)}`;
  const FACETS = [{
    id: "twopp",
    label: "2PP"
  }, {
    id: "primary",
    label: "Primary"
  }, {
    id: "leadership",
    label: "Leadership"
  }];
  const pOrder = D.latest && D.latest.primaryOrder || ["alp", "lnp", "grn", "onp", "oth"];
  const PCOLS = {
    alp: {
      label: "ALP",
      k: "p.alp",
      style: {
        color: "var(--alp-text)",
        fontWeight: 600
      }
    },
    lnp: {
      label: "L/NP",
      k: "p.lnp",
      style: {
        color: "var(--lnp-text)",
        fontWeight: 600
      }
    },
    grn: {
      label: "GRN",
      k: "p.grn",
      cls: " hide-sm",
      style: {
        color: "var(--grn-text)"
      }
    },
    onp: {
      label: "ON",
      k: "p.onp",
      style: {
        color: "var(--onp-text)"
      }
    },
    oth: {
      label: "OTH",
      cls: " muted hide-md"
    }
  };
  return React.createElement("section", {
    className: "card"
  }, React.createElement("div", {
    className: "card-head"
  }, React.createElement("div", null, React.createElement("h2", {
    className: "card-title"
  }, "Latest polls"), React.createElement("p", {
    className: "card-sub"
  }, "The most recent poll from each active pollster, ", windowLabel, ", ", rows.length, " pollsters")), React.createElement(TextToggle, {
    value: facet,
    onChange: setFacet,
    options: FACETS,
    ariaLabel: "Poll table view",
    caps: true
  })), React.createElement("div", {
    className: "table-wrap ap-wrap"
  }, React.createElement("table", {
    className: "poll-table archive"
  }, React.createElement("caption", {
    className: "sr-only"
  }, "Latest poll from each active pollster, ", (FACETS.find(f => f.id === facet) || {}).label, " ", "columns \u2013 ", rows.length, " pollsters"), React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", {
    scope: "col",
    className: "exp-col",
    "aria-hidden": "true"
  }), React.createElement(SortTh, {
    label: "Pollster",
    sortKey: "pollster",
    sort: sort,
    onSort: onSort,
    className: "ta-l"
  }), React.createElement(SortTh, {
    label: "Published",
    short: "Pub",
    sortKey: "pubSort",
    sort: sort,
    onSort: onSort,
    className: "ta-l"
  }), React.createElement(SortTh, {
    label: "Fieldwork",
    short: "Field",
    sortKey: "released",
    sort: sort,
    onSort: onSort,
    className: "ta-l"
  }), React.createElement(SortTh, {
    label: "Sample",
    sortKey: "sample",
    sort: sort,
    onSort: onSort,
    className: "hide-md"
  }), facet === "twopp" && React.createElement(React.Fragment, null, React.createElement("th", {
    scope: "col",
    className: "ta-l apub-col hide-md"
  }, React.createElement("button", {
    type: "button",
    className: "th-basis",
    onClick: () => setTppBasis(tppBasis === "imp" ? "resp" : "imp"),
    title: tppBasis === "resp" ? "Each poll's headline figures exactly as the pollster released them – click to switch to implied 2PP at the 2025 election's preference flows" : "Each poll's primaries read at the 2025 election's preference flows – one fixed table, so the column compares house to house; the wave's own published 2PP sits in its breakdown. Click to switch to the published figures"
  }, tppBasis === "resp" ? "As published" : React.createElement(React.Fragment, null, "Implied 2PP", " ", React.createElement("span", {
    className: "th-basis-def"
  }, "(default)")), React.createElement("span", {
    className: "th-basis-swap",
    "aria-hidden": "true"
  }, "\u21C4"))), (active => React.createElement("th", {
    scope: "col",
    className: "num sortable" + (active ? " sorted" : ""),
    onClick: () => onSort("alp"),
    tabIndex: 0,
    onKeyDown: e => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onSort("alp");
      }
    },
    "aria-sort": active ? sort.dir < 0 ? "descending" : "ascending" : "none"
  }, React.createElement("span", {
    className: "th-in"
  }, React.createElement("span", {
    className: "lbl-l"
  }, "Lead,"), React.createElement("span", {
    className: "lbl-s"
  }, "Lead"), React.createElement("button", {
    type: "button",
    className: "th-basis lbl-l",
    onClick: e => {
      e.stopPropagation();
      flipMatchup();
    },
    onKeyDown: e => e.stopPropagation(),
    title: measure === "onp" ? "Labor's lead over One Nation on each poll – click to switch the page to ALP v L/NP" : "Labor's lead over the Coalition on each poll – click to switch the page to ALP v One Nation"
  }, LEAD_LABEL[measure], React.createElement("span", {
    className: "th-basis-swap",
    "aria-hidden": "true"
  }, "\u21C4")), React.createElement("span", {
    className: "caret",
    "aria-hidden": "true"
  }, active ? sort.dir < 0 ? "▾" : "▴" : "⇅"))))(sort.key === "alp")), facet === "primary" && pOrder.map(id => {
    const c = PCOLS[id];
    return c.k ? React.createElement(SortTh, {
      key: id,
      label: c.label,
      sortKey: c.k,
      sort: sort,
      onSort: onSort,
      className: c.cls ? c.cls.trim() : undefined
    }) : React.createElement("th", {
      key: id,
      scope: "col",
      className: (c.cls || " hide-md").trim()
    }, c.label);
  }), facet === "leadership" && React.createElement(React.Fragment, null, React.createElement(SortTh, {
    label: "Preferred PM",
    sortKey: "ppm.alb",
    sort: sort,
    onSort: onSort,
    className: "ta-l two-pp-col hide-md"
  }), React.createElement(SortTh, {
    label: "Alb net",
    short: "Alb",
    sortKey: "appr.albNet",
    sort: sort,
    onSort: onSort
  }), React.createElement(SortTh, {
    label: "Opp. ldr net",
    short: "Opp",
    sortKey: "appr.taylorNet",
    sort: sort,
    onSort: onSort
  }), React.createElement(SortTh, {
    label: "Hanson net",
    short: "Han",
    sortKey: "appr.hansonNet",
    sort: sort,
    onSort: onSort,
    className: "hide-sm"
  })))), React.createElement("tbody", null, rows.map(r => {
    const isOpen = open === r.pollster;
    return React.createElement(React.Fragment, {
      key: r.pollster
    }, React.createElement("tr", {
      className: "poll-row" + (isOpen ? " open" : ""),
      onClick: () => setOpen(isOpen ? null : r.pollster)
    }, React.createElement("td", {
      className: "exp-col"
    }, React.createElement("button", {
      className: "exp-btn" + (isOpen ? " open" : ""),
      "aria-label": isOpen ? "Collapse" : "Expand full breakdown",
      "aria-expanded": isOpen
    }, "\u25B8")), React.createElement("td", {
      className: "ta-l pollster-cell"
    }, React.createElement(PollsterName, {
      name: r.pollster,
      url: r.url
    }), React.createElement("span", {
      className: "pollster-mode"
    }, r.client), r.provisional && React.createElement("span", {
      className: "pollster-mode provisional-tag",
      title: "Provisional: " + (r.provisionalScope === "leaders" ? "leader ratings" : "figures") + " mirrored from " + r.provisional + " until the pollster’s own release is captured"
    }, "provisional")), React.createElement("td", {
      className: "ta-l"
    }, React.createElement("span", {
      className: "released-pill" + (r.publishedLabel ? "" : " est"),
      title: r.publishedLabel ? undefined : "Publication date not recorded for this poll – showing the last day of fieldwork"
    }, r.publishedLabel || r.releasedLabel)), React.createElement("td", {
      className: "ta-l muted"
    }, r.fieldPending ? rdFieldTbc(r) : r.field), React.createElement("td", {
      className: "num muted hide-md"
    }, r.sample != null ? r.sample.toLocaleString() : "—"), facet === "twopp" && React.createElement(React.Fragment, null, React.createElement("td", {
      className: "ta-l apub-col hide-md"
    }, React.createElement(ArchTpp, {
      p: r,
      basis: tppBasis,
      measure: measure
    })), React.createElement("td", {
      className: "num"
    }, React.createElement(ArchLead, {
      p: r,
      measure: measure,
      primaryFallback: true,
      basis: tppBasis
    }))), facet === "primary" && pOrder.map(id => React.createElement("td", {
      key: id,
      className: "num" + (PCOLS[id].cls || ""),
      style: PCOLS[id].style
    }, r.p[id] != null ? r.p[id].toFixed(1) : "—")), facet === "leadership" && React.createElement(React.Fragment, null, React.createElement("td", {
      className: "two-pp-col share-col hide-md"
    }, ppmContests(r).length === 0 ? React.createElement("span", {
      className: "dash",
      title: "No preferred-PM question this wave"
    }, "\u2014") : React.createElement(ShareBar, {
      segs: ppmContestSegs(ppmContests(r)[0]),
      compact: true,
      flag: ppmFlag(ppmContests(r))
    })), React.createElement("td", {
      className: "num"
    }, React.createElement(ArchApprCell, {
      s: r.appr.alb,
      net: r.appr.albNet,
      metric: r.appr.metricBy && r.appr.metricBy.alb
    })), React.createElement("td", {
      className: "num"
    }, React.createElement(ArchApprCell, {
      s: r.appr.taylor,
      net: r.appr.taylorNet,
      metric: r.appr.metricBy && r.appr.metricBy.taylor
    })), React.createElement("td", {
      className: "num hide-sm"
    }, React.createElement(ArchApprCell, {
      s: r.appr.hanson,
      net: r.appr.hansonNet,
      metric: r.appr.metricBy && r.appr.metricBy.hanson
    })))), isOpen && React.createElement("tr", {
      className: "detail-row"
    }, React.createElement("td", {
      colSpan: facet === "primary" ? 10 : facet === "leadership" ? 9 : 7
    }, React.createElement(PollDetail, {
      r: r
    }))));
  })))), (() => {
    const act = typeof CANT_HOVER !== "undefined" && CANT_HOVER ? "Tap" : "Click";
    return React.createElement(React.Fragment, null, React.createElement("p", {
      className: "table-hint"
    }, "Tap any poll to see its full breakdown, ", act, " a column heading to sort."), React.createElement(HowTo, {
      label: "How to read this table",
      paras: [React.createElement(React.Fragment, null, "\u201C\u2014\u201D means the pollster didn\u2019t ask that question."), React.createElement(React.Fragment, null, tppBasis === "resp" ? "“As published” lists each poll’s headline figures exactly as the pollster released them, and the lead bar draws the published margin out from a tie line at its centre." : "“Implied 2PP” reads the poll’s primaries at the 2025 election’s preference flows, and the lead bar draws that margin out from a tie line at its centre.", React.createElement("span", {
        className: "hint-wide"
      }, tppBasis === "resp" ? ` ${act} the “As published” heading to switch back to implied.` : ` ${act} the “Implied 2PP” heading to switch to the pollsters’ own published figures.`), React.createElement("span", {
        className: "hint-narrow"
      }, tppBasis === "resp" ? " The switch above the headline figure flips back to implied." : " The switch above the headline figure flips to the pollsters’ own published figures.")), React.createElement(React.Fragment, null, React.createElement("strong", null, "Published"), " is the day the poll was released, taken from the source each row links to. Each house\u2019s systematic lean \u2013 its house effect \u2013 sits beside poll lean in the All polls archive.")]
    }));
  })());
}
Object.assign(window, {
  Segmented,
  TextToggle,
  Delta,
  HowTo,
  SortTh,
  fitDomain,
  PrimaryVotePanel,
  PreferredPMPanel,
  ApprovalPanel,
  DirectionPanel,
  UndecidedPanel,
  MoodPanel,
  OnSourcesPanel,
  DemographicsPanel,
  PollsterTable,
  NextPollsPanel,
  ShareBar,
  NetVal,
  FavMark,
  ChgTag,
  apprHeading,
  SeatProjection,
  tppContests,
  tppFlag,
  tppHeading,
  primarySegs,
  dirSegs,
  ppmContests,
  ppmMatch,
  ppmContestSegs,
  ppmLabel,
  ppmKind,
  ppmFlag,
  LEADER_META,
  PPM_ORDER,
  PARTY_C,
  PollLedger,
  PdSec,
  TppLine,
  ApprLine,
  ChgParen,
  releaseMetaRows,
  EffLines,
  sampleValue,
  pubStamp
});