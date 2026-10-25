function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const SETTLE_MS = 220;
const REDUCED_MOTION = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const urlWrite = (verb, to) => {
  try {
    history[verb](null, "", to);
  } catch {}
};
function freshness(iso) {
  const then = Date.parse(iso);
  const days = Math.max(0, Math.round((easternNow().day - then) / 86400000));
  let label;
  if (days === 0) label = "Today";else if (days === 1) label = "Yesterday";else if (days < 14) label = days + " days ago";else if (days < 56) label = Math.round(days / 7) + " weeks ago";else label = Math.round(days / 30) + " months ago";
  const state = days <= 7 ? "fresh" : days <= 21 ? "aging" : "stale";
  return {
    label,
    state,
    days
  };
}
const SHORT_MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function shortDate(iso) {
  const t = new Date(Date.parse(iso));
  return t.getUTCDate() + " " + SHORT_MON[t.getUTCMonth()];
}
function GlyphDial({
  className,
  svgRef,
  width,
  height
}) {
  const {
    D
  } = window.AP;
  const lp = D.latest.primary;
  const glyph = [{
    id: "alp",
    color: "var(--alp)",
    v: lp.alp
  }, {
    id: "lnp",
    color: "var(--lnp)",
    v: lp.lnp
  }, {
    id: "grn",
    color: "var(--grn)",
    v: lp.grn
  }, {
    id: "onp",
    color: "var(--onp)",
    v: lp.onp
  }].sort((a, b) => b.v - a.v);
  const gv = glyph.map(p => p.v);
  const gmin = Math.min(...gv),
    gmax = Math.max(...gv);
  const MIN_H = 5,
    MAX_H = 10.5;
  glyph.forEach(p => {
    p.h = gmax === gmin ? MAX_H : MIN_H + (p.v - gmin) / (gmax - gmin) * (MAX_H - MIN_H);
  });
  const glyphTitle = "Primary vote aggregate, " + glyph.map(p => `${D.PARTIES[p.id].short} ${p.v.toFixed(1)}`).join(", ");
  const challengers = [["L/NP", "var(--lnp)", "alp_lnp"], ["ON", "var(--onp)", "alp_on"]].map(([abbr, color, id]) => {
    const v = tppLatest(id, "imp");
    return v && v.b != null ? {
      abbr,
      color,
      lab: v.a,
      opp: v.b
    } : null;
  }).filter(Boolean);
  const topOpp = challengers.slice().sort((x, y) => y.opp - x.opp)[0] || {
    abbr: "L/NP",
    color: "var(--lnp)",
    lab: 50,
    opp: 50
  };
  const pMargin = +(topOpp.lab - topOpp.opp).toFixed(1);
  const labLeads = pMargin >= 0;
  const pendColor = labLeads ? "var(--alp)" : topOpp.color;
  const oppColor = topOpp.color;
  const pendDeg = Math.max(-1, Math.min(1, pMargin / 12)) * 34;
  const pendTitle = `Implied 2PP, ALP v ${topOpp.abbr}, ` + (labLeads ? "Labor" : topOpp.abbr) + ` +${Math.abs(pMargin).toFixed(1)}`;
  const [pendSettled, setPendSettled] = React.useState(REDUCED_MOTION);
  React.useEffect(() => {
    const t = setTimeout(() => setPendSettled(true), SETTLE_MS);
    return () => clearTimeout(t);
  }, [pendDeg]);
  const needleDeg = pendSettled ? -pendDeg : 0;
  const SETTLE_H = (MIN_H + MAX_H) / 2;
  const GC = {
    cx: 22,
    cy: 24.5,
    r: 12
  };
  const polar = (deg, r) => ({
    x: +(GC.cx + Math.sin(deg * Math.PI / 180) * r).toFixed(2),
    y: +(GC.cy - Math.cos(deg * Math.PI / 180) * r).toFixed(2)
  });
  const BAR_ANGLES = [-54, -18, 18, 54];
  const arcPath = (d1, d2) => {
    const a = polar(d1, GC.r),
      b = polar(d2, GC.r);
    return `M ${a.x} ${a.y} A ${GC.r} ${GC.r} 0 0 1 ${b.x} ${b.y}`;
  };
  return (React.createElement("svg", {
      className: className,
      ref: svgRef || null,
      viewBox: "0.58 0.07 38.39 26.73",
      width: width,
      height: height,
      "aria-hidden": "true"
    }, React.createElement("title", null, glyphTitle + ", " + pendTitle), React.createElement("path", {
      d: arcPath(-90, 0),
      className: "wm-arc",
      stroke: "var(--alp)"
    }), React.createElement("path", {
      d: arcPath(0, 90),
      className: "wm-arc",
      stroke: oppColor
    }), glyph.map((p, i) => {
      const a = BAR_ANGLES[i];
      const inner = polar(a, GC.r + 2);
      const outerMax = polar(a, GC.r + 2 + MAX_H);
      const shown = pendSettled ? p.h : SETTLE_H;
      return React.createElement("line", {
        key: p.id,
        className: "wm-bar",
        x1: inner.x,
        y1: inner.y,
        x2: outerMax.x,
        y2: outerMax.y,
        stroke: p.color,
        strokeWidth: "3.4",
        strokeLinecap: "butt",
        style: {
          strokeDasharray: shown.toFixed(2) + " " + MAX_H
        }
      });
    }), React.createElement("g", {
      transform: `translate(${GC.cx}, ${GC.cy})`
    }, React.createElement("g", {
      className: "wm-needle-g",
      style: {
        transform: `rotate(${needleDeg}deg)`
      }
    }, React.createElement("line", {
      x1: "0",
      y1: "0",
      x2: "0",
      y2: "-8.6",
      stroke: pendColor,
      strokeWidth: "1.7",
      strokeLinecap: "round"
    }), React.createElement("circle", {
      cx: "0",
      cy: "-8.6",
      r: "1.9",
      fill: pendColor
    }))), React.createElement("circle", {
      cx: GC.cx,
      cy: GC.cy,
      r: "1.7",
      className: "wm-pivot"
    }))
  );
}
window.GlyphDial = GlyphDial;
function Header({
  isDark,
  onToggleTheme,
  rd
}) {
  const {
    D
  } = window.AP;
  const fresh = freshness(D.latest.publishedISO);
  const segRef = useRef(null);
  const segDrag = useRef(false);
  const segHeld = useRef(false);
  const segDownX = useRef(0);
  const segFlipped = useRef(false);
  const halfAt = clientX => {
    const el = segRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const mid = r.left + r.width / 2,
      DEAD = 6;
    if (clientX > mid + DEAD) return true;
    if (clientX < mid - DEAD) return false;
    return null;
  };
  const onSegDown = e => {
    segDrag.current = true;
    segDownX.current = e.clientX;
    segFlipped.current = false;
  };
  const onSegMove = e => {
    if (!segDrag.current) return;
    if (!segHeld.current && Math.abs(e.clientX - segDownX.current) >= 4) {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
        segHeld.current = true;
      } catch (_) {}
    }
    const want = halfAt(e.clientX);
    if (want != null && want !== isDark) {
      onToggleTheme();
      segFlipped.current = true;
    }
  };
  const onSegUp = e => {
    segDrag.current = false;
    if (segHeld.current) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch (_) {}
    } else if (!segFlipped.current) {
      onToggleTheme();
    }
    segHeld.current = false;
    segFlipped.current = false;
  };
  const onSegCancel = e => {
    segDrag.current = false;
    if (segHeld.current) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch (_) {}
    }
    segHeld.current = false;
    segFlipped.current = false;
  };
  const wmName = useRef(null),
    wmTrack = useRef(null);
  React.useEffect(() => {
    const a = wmName.current,
      b = wmTrack.current;
    if (!a || !b) return;
    let dropped = false;
    const inkWidth = el => {
      const ls = parseFloat(getComputedStyle(el).letterSpacing);
      return el.getBoundingClientRect().width - (isNaN(ls) ? 0 : ls);
    };
    const align = () => {
      if (dropped || !a.isConnected) return;
      a.style.letterSpacing = "";
      b.style.letterSpacing = "";
      const wide = inkWidth(a) >= inkWidth(b) ? a : b;
      const narrow = wide === a ? b : a;
      const gaps = narrow.textContent.length - 1;
      if (gaps < 1) return;
      const base = parseFloat(getComputedStyle(narrow).letterSpacing);
      narrow.style.letterSpacing = ((isNaN(base) ? 0 : base) + (inkWidth(wide) - inkWidth(narrow)) / gaps).toFixed(3) + "px";
    };
    align();
    if (document.fonts) document.fonts.ready.then(align);
    return () => {
      dropped = true;
    };
  }, []);
  const [story, setStory] = useState(null);
  const glyphRef = useRef(null);
  const openerRef = useRef(null);
  const openStory = e => {
    openerRef.current = e && e.currentTarget || glyphRef.current;
    const el = glyphRef.current;
    setStory({
      rect: el ? el.getBoundingClientRect() : null
    });
  };
  const [staticView, setStaticView] = useState(false);
  useEffect(() => {
    window.AP.openStatic = () => setStaticView(true);
  }, []);
  useEffect(() => {
    if (window.location.hash === "#story") {
      openStory();
      urlWrite("replaceState", window.location.pathname + window.location.search);
    }
  }, []);
  useEffect(() => {
    document.body.classList.toggle("ss-view", staticView);
    const ss = document.querySelector(".static-summary");
    if (ss) ss.inert = !staticView;
    return () => {
      document.body.classList.remove("ss-view");
      if (ss) ss.inert = true;
    };
  }, [staticView]);
  const pastTerms = D.cycles.filter(c => !c.current).length;
  const pastFirst = pastTerms ? Math.min(...D.cycles.filter(c => !c.current).map(c => c.year)) : null;
  const J = window.JUR;
  const rdLatest = rd ? D.latest.newest || null : null;
  const rdLatestUrl = rdLatest ? rdLatest.releaseUrl || rdLatest.url : null;
  const rdLatestFact = rdLatest ? rdLatest.fieldPending ? React.createElement(React.Fragment, null, rdLatestUrl ? React.createElement("a", {
    className: "mh-latest",
    href: rdLatestUrl,
    target: "_blank",
    rel: "noopener noreferrer"
  }, rdLatest.pollster) : rdLatest.pollster, ", ", rdFieldTbc(rdLatest)) : rdLatestUrl ? React.createElement("a", {
    className: "mh-latest",
    href: rdLatestUrl,
    target: "_blank",
    rel: "noopener noreferrer"
  }, rdLatest.pollster + ", " + rdLatest.field) : rdLatest.pollster + ", " + rdLatest.field : D.latest.published;
  const rdLatestFactCompact = rdLatest ? rdLatestUrl ? React.createElement("a", {
    className: "mh-latest",
    href: rdLatestUrl,
    target: "_blank",
    rel: "noopener noreferrer"
  }, rdLatest.pollster + (rdLatest.fieldPending ? "" : ", " + rdLatest.field)) : rdLatest.pollster + (rdLatest.fieldPending ? "" : ", " + rdLatest.field) : D.latest.published;
  const rdDue = (() => {
    const m = /(\d{1,2}) (\w+) (\d{4})/.exec(D.latest.nextElectionDue || "");
    if (!m) return null;
    const t = Date.parse(m[1] + " " + m[2] + " " + m[3] + " UTC");
    if (isNaN(t)) return null;
    if (J && J.nextElection && J.nextElection.fixed) {
      const days = Math.round((t - easternNow().day) / 86400000);
      return days > 1 ? "in " + days + " days" : days === 1 ? "tomorrow" : days === 0 ? "today" : null;
    }
    const months = Math.round((t - easternNow().day) / (86400000 * 30.44));
    return months > 1 ? months + " months at most" : null;
  })();
  return React.createElement("header", {
    className: "site-head"
  }, React.createElement("div", {
    className: "brand"
  }, React.createElement("div", {
    className: "lockup"
  }, React.createElement("h1", {
    className: "wordmark stacked"
  }, React.createElement("span", {
    className: "wm-textcol"
  }, !J ? React.createElement("span", {
    className: "wm-name",
    ref: wmName
  }, "auspol") : React.createElement("span", {
    className: "wm-name",
    ref: wmName
  }, J.brand), React.createElement("span", {
    className: "sr-only"
  }, " "), React.createElement("span", {
    className: "wm-track",
    ref: wmTrack
  }, "tracker")), !J ? React.createElement("span", {
    className: "wm-sr"
  }, "\u2013 Australian federal polling") : React.createElement("span", {
    className: "wm-sr"
  }, "\u2013 ", J.electionWords, " polling")), React.createElement("button", {
    className: "wm-glyph",
    onClick: openStory,
    title: "Wind the dial back through the term",
    "aria-label": "Wind the dial back through the term",
    "aria-describedby": "wm-action"
  }, React.createElement(GlyphDial, {
    className: "wm-dial",
    svgRef: glyphRef,
    width: "57",
    height: "39.7"
  })), React.createElement("span", {
    id: "wm-action",
    hidden: true
  }, "Replays the term on the masthead dial")), !J ? React.createElement("p", {
    className: "tagline"
  }, "Aggregated opinion polling for the next Australian ", React.createElement("br", {
    className: "tagline-br"
  }), "federal election, and for all since ", pastFirst, ".") : React.createElement("p", {
    className: "tagline"
  }, "Aggregated opinion polling for the next ", J.electionWords.split(" ")[0], " ", React.createElement("br", {
    className: "tagline-br"
  }), J.electionWords.split(" ").slice(1).join(" "), " election", pastTerms ? ", and for all since " + pastFirst : "", "."), React.createElement("div", {
    className: "head-meta-compact",
    "aria-hidden": "true"
  }, React.createElement("span", {
    className: "fresh-dot fresh-toggle " + fresh.state,
    onClick: () => setStaticView(true)
  }), " ", "Updated ", D.latest.published, ", ", D.latest.pollsTracked, " polls")), rd && React.createElement("div", {
    className: "rd-head-compact"
  }, React.createElement("span", {
    className: "fresh-dot " + fresh.state
  }), React.createElement("span", null, React.createElement("b", null, "Latest poll"), " ", rdLatestFactCompact, ", ", fresh.label.toLowerCase(), ", ", D.latest.pollsTracked, " polls")), React.createElement("div", {
    className: "head-right"
  }, rd ? React.createElement("div", {
    className: "head-meta rd-head-meta"
  }, React.createElement("div", {
    className: "meta-item"
  }, React.createElement("span", {
    className: "meta-k"
  }, "Latest poll"), React.createElement("span", {
    className: "meta-v"
  }, React.createElement("button", {
    type: "button",
    className: "fresh-dot fresh-toggle " + fresh.state,
    onClick: () => setStaticView(true),
    tabIndex: -1,
    "aria-label": "Read this page as a plain, static article",
    title: "Read this page as a plain, static article"
  }), rdLatestFact), React.createElement("span", {
    className: "meta-s"
  }, "published ", fresh.label.toLowerCase())), React.createElement("div", {
    className: "meta-divide"
  }), React.createElement("div", {
    className: "meta-item"
  }, React.createElement("span", {
    className: "meta-k"
  }, "This term"), React.createElement("span", {
    className: "meta-v"
  }, D.latest.pollsTracked, " polls"), React.createElement("span", {
    className: "meta-s"
  }, D.latest.housesTracked, " pollsters")), React.createElement("div", {
    className: "meta-divide"
  }), React.createElement("div", {
    className: "meta-item"
  }, React.createElement("span", {
    className: "meta-k"
  }, "Next election"), React.createElement("span", {
    className: "meta-v"
  }, D.latest.nextElectionDue), rdDue && React.createElement("span", {
    className: "meta-s"
  }, rdDue))) : React.createElement("div", {
    className: "head-meta"
  }, React.createElement("div", {
    className: "meta-item meta-updated"
  }, React.createElement("span", {
    className: "meta-k"
  }, "Last poll"), React.createElement("span", {
    className: "meta-v"
  }, React.createElement("button", {
    type: "button",
    className: "fresh-dot fresh-toggle " + fresh.state,
    onClick: () => setStaticView(true),
    tabIndex: -1,
    "aria-label": "Read this page as a plain, static article",
    title: "Read this page as a plain, static article"
  }), D.latest.published, React.createElement("span", {
    className: "fresh-rel"
  }, ", ", fresh.label))), React.createElement("div", {
    className: "meta-divide"
  }), React.createElement("div", {
    className: "meta-item meta-election"
  }, React.createElement("span", {
    className: "meta-k"
  }, "Next election"), React.createElement("span", {
    className: "meta-v"
  }, D.latest.nextElectionDue)), React.createElement("div", {
    className: "meta-divide meta-divide-polls"
  }), React.createElement("div", {
    className: "meta-item meta-polls"
  }, React.createElement("span", {
    className: "meta-k"
  }, "Polls tracked"), React.createElement("span", {
    className: "meta-v"
  }, D.latest.pollsTracked, ", ", D.latest.housesTracked, " pollsters"))), React.createElement("div", {
    className: "theme-seg segmented",
    role: "group",
    "aria-label": "Colour theme",
    ref: segRef,
    onPointerDown: onSegDown,
    onPointerMove: onSegMove,
    onPointerUp: onSegUp,
    onPointerCancel: onSegCancel
  }, React.createElement("button", {
    className: "seg-btn theme-cell" + (!isDark ? " active" : ""),
    onClick: e => {
      if (e.detail === 0) onToggleTheme();
    },
    "aria-pressed": !isDark,
    "aria-label": "Light mode",
    title: "Light mode"
  }, React.createElement("svg", {
    viewBox: "0 0 24 24",
    width: "16",
    height: "16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true"
  }, React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "4.2"
  }), React.createElement("path", {
    d: "M12 2.2v2.4M12 19.4v2.4M2.2 12h2.4M19.4 12h2.4M4.9 4.9l1.7 1.7M17.4 17.4l1.7 1.7M19.1 4.9l-1.7 1.7M6.6 17.4l-1.7 1.7"
  }))), React.createElement("button", {
    className: "seg-btn theme-cell" + (isDark ? " active" : ""),
    onClick: e => {
      if (e.detail === 0) onToggleTheme();
    },
    "aria-pressed": isDark,
    "aria-label": "Dark mode",
    title: "Dark mode"
  }, React.createElement("svg", {
    viewBox: "0 0 24 24",
    width: "16",
    height: "16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true"
  }, React.createElement("path", {
    d: "M20.5 14.2A8.2 8.2 0 0 1 9.8 3.5a8.2 8.2 0 1 0 10.7 10.7Z"
  }))))), story && React.createElement(DialStory, {
    originRect: story.rect,
    onClose: () => {
      setStory(null);
      requestAnimationFrame(() => {
        const back = openerRef.current || glyphRef.current;
        back && back.focus && back.focus();
      });
    }
  }), staticView && ReactDOM.createPortal(React.createElement("button", {
    type: "button",
    className: "ss-back",
    onClick: () => setStaticView(false)
  }, "Back to the interactive tracker"), document.body));
}
const ROLL_DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
const ROLL_FRAME = 0.493;
const ROLL_ADV = {
  "1": 0.371
};
const SEP_GAP = 0.03;
function driftMargins(text, i) {
  const L = text[i - 1] || "";
  const slack = /[0-9]/.test(L) ? ROLL_FRAME - (ROLL_ADV[L] ?? ROLL_FRAME) : 0;
  return {
    marginLeft: SEP_GAP - slack + "em",
    marginRight: SEP_GAP + "em"
  };
}
window.RollNum = RollNum;
function RollNum({
  value,
  className,
  style,
  spinIn,
  drift
}) {
  const text = String(value);
  const [spun, setSpun] = React.useState(!spinIn || REDUCED_MOTION);
  React.useEffect(() => {
    if (spun) return;
    const t = setTimeout(() => setSpun(true), SETTLE_MS);
    return () => clearTimeout(t);
  }, []);
  const n = text.length;
  return React.createElement("span", {
    className: "roll" + (className ? " " + className : ""),
    style: style
  }, React.createElement("span", {
    className: "roll-anchor",
    "aria-hidden": "true"
  }, "0"), React.createElement("span", {
    className: "sr-only"
  }, text), text.split("").map((ch, i) => /[0-9]/.test(ch) ? React.createElement("span", {
    className: "roll-d",
    key: n - 1 - i,
    "aria-hidden": "true"
  }, React.createElement("span", {
    className: "roll-reel",
    style: {
      "--d": spun ? Number(ch) : 0
    }
  }, ROLL_DIGITS.map(d => React.createElement("span", {
    key: d
  }, d)))) : React.createElement("span", {
    className: "roll-sep",
    key: n - 1 - i,
    "aria-hidden": "true",
    style: drift ? driftMargins(text, i) : undefined
  }, ch)));
}
const MORPH_EASE = x => window.AP.morphEase(x);
function mixC(c1, c2, t) {
  if (t <= 0 || c1 === c2) return c1;
  if (t >= 1) return c2;
  return "color-mix(in oklch shorter hue, " + c1 + ", " + c2 + " " + (t * 100).toFixed(1) + "%)";
}
const MATCHUPS = (() => {
  const D = window.AUSPOL;
  return {
    alp_lnp: {
      a: {
        name: "Labor",
        color: "var(--alp)",
        abbr: "ALP"
      },
      b: {
        name: "Coalition",
        color: "var(--lnp)",
        abbr: "L/NP"
      },
      data: D.agg2pp.map(d => ({
        ym: d.ym,
        x: d.x,
        a: d.alp,
        b: d.lnp,
        ci95: d.ci95,
        k: d.k
      })),
      real: true,
      label: "ALP v L/NP",
      dots: ["var(--alp)", "var(--lnp)"],
      vsLabor: true,
      scatter: p => p.alpN == null ? null : [{
        y: p.alpN,
        color: "var(--alp)",
        label: "ALP 2PP"
      }, {
        y: +(100 - p.alpN).toFixed(1),
        color: "var(--lnp)",
        label: "L/NP 2PP"
      }]
    },
    alp_on: {
      a: {
        name: "Labor",
        color: "var(--alp)",
        abbr: "ALP"
      },
      b: {
        name: "One Nation",
        color: "var(--onp)",
        abbr: "ON"
      },
      data: D.alt2pp.alp_on,
      real: false,
      altKey: "alp_on",
      label: "ALP v ON",
      dots: ["var(--alp)", "var(--onp)"],
      vsLabor: true,
      scatter: p => !p.tppAlt ? null : [{
        y: p.tppAlt.alp,
        color: "var(--alp)",
        label: "ALP v ON"
      }, {
        y: p.tppAlt.onp,
        color: "var(--onp)",
        label: "ON v ALP"
      }]
    },
    lnp_on: {
      a: {
        name: "Coalition",
        color: "var(--lnp)",
        abbr: "L/NP"
      },
      b: {
        name: "One Nation",
        color: "var(--onp)",
        abbr: "ON"
      },
      data: D.alt2pp.lnp_on,
      real: false,
      altKey: "lnp_on",
      label: "L/NP v ON",
      dots: ["var(--lnp)", "var(--onp)"],
      vsLabor: false,
      scatter: p => !p.tppAlt2 ? null : [{
        y: p.tppAlt2.lnp,
        color: "var(--lnp)",
        label: "L/NP v ON"
      }, {
        y: p.tppAlt2.onp,
        color: "var(--onp)",
        label: "ON v L/NP"
      }]
    }
  };
})();
function tppLatest(id, basis) {
  const D = window.AUSPOL,
    M = MATCHUPS[id];
  if (!M) return null;
  if (M.real) {
    if (basis === "imp" && D.synthLatest && D.synthLatest.alp != null) return {
      a: D.synthLatest.alp,
      b: D.synthLatest.lnp,
      ci95: D.synthLatest.ci95
    };
    return {
      a: D.latest.alp2pp,
      b: D.latest.lnp2pp,
      ci95: D.latest.alp2ppCi95
    };
  }
  const imp = M.altKey === "alp_on" && D.latest.onImp && D.synthOn ? D.latest.onImp : null;
  if (imp) {
    if (basis === "resp" && D.altLatest && D.altLatest.alp_on) return {
      a: D.altLatest.alp_on.a,
      b: D.altLatest.alp_on.b,
      ci95: D.altLatest.alp_on.ci95
    };
    return {
      a: imp.a,
      b: imp.b,
      ci95: imp.ci95 != null ? imp.ci95 : imp.band,
      cs: imp.cs,
      cf: imp.band,
      flows: true
    };
  }
  const al = D.altLatest ? D.altLatest[M.altKey] : null;
  if (al) return {
    a: al.a,
    b: al.b,
    ci95: al.ci95
  };
  const last = M.data[M.data.length - 1];
  return last ? {
    a: last.a,
    b: last.b,
    ci95: null
  } : null;
}
window.AP.tppMatchups = MATCHUPS;
window.AP.tppLatest = tppLatest;
const HG_DOM = 8;
const HG_MAX = 340;
function HeroGauge({
  a,
  ci,
  color,
  aName,
  bName,
  sepRef
}) {
  const wrapRef = React.useRef(null);
  const [box, setBox] = React.useState(null);
  React.useLayoutEffect(() => {
    const el = wrapRef.current,
      sep = sepRef && sepRef.current;
    if (!el || !sep || !el.parentElement) return;
    const parent = el.parentElement;
    const align = () => {
      const pr = parent.getBoundingClientRect(),
        sr = sep.getBoundingClientRect();
      if (!pr.width || !sr.width) return;
      const cx = sr.left - pr.left + sr.width / 2;
      const w = Math.min(HG_MAX, 2 * Math.min(cx, pr.width - cx));
      setBox({
        w,
        ml: cx - w / 2
      });
      parent.style.setProperty("--hg-w", w + "px");
      parent.style.setProperty("--hg-ml", cx - w / 2 + "px");
    };
    align();
    const ro = new ResizeObserver(align);
    ro.observe(parent);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(align);
    return () => ro.disconnect();
  }, [aName, bName]);
  const [mercSettled, setMercSettled] = React.useState(REDUCED_MOTION);
  React.useEffect(() => {
    if (mercSettled) return;
    const t = setTimeout(() => setMercSettled(true), SETTLE_MS);
    return () => clearTimeout(t);
  }, []);
  const dev = a - 50;
  const cl = v => Math.max(-HG_DOM, Math.min(HG_DOM, v));
  const pos = v => 50 - cl(v) / HG_DOM * 50;
  const L = pos(dev + ci),
    R = pos(dev - ci);
  const overA = dev + ci > HG_DOM;
  const overB = dev - ci < -HG_DOM;
  const lo = (a - ci).toFixed(1),
    hi = (a + ci).toFixed(1);
  const say = `${aName} ${a.toFixed(1)} per cent two-party preferred, 95% interval ${lo} to ${hi}. ` + `A tie is 50. ${a - ci > 50 || a + ci < 50 ? "The interval does not include a tie." : "The interval includes a tie."}`;
  return (React.createElement("div", {
      className: "hero-gauge",
      role: "img",
      ref: wrapRef,
      title: say.replace(" per cent", "%"),
      style: box ? {
        width: box.w + "px",
        marginLeft: box.ml + "px",
        maxWidth: "none"
      } : undefined,
      "aria-label": say
    }, React.createElement("div", {
      className: "hg-track"
    }, [-6, -4, -2, 2, 4, 6].map(t => React.createElement("span", {
      key: t,
      className: "hg-grad",
      style: {
        left: pos(t) + "%"
      }
    })), React.createElement("span", {
      className: "hg-span",
      style: mercSettled ? {
        left: L + "%",
        width: R - L + "%",
        background: color
      } : {
        left: "50%",
        width: "0%",
        background: color
      }
    }), overA && React.createElement("span", {
      className: "hg-over hg-over-a"
    }), overB && React.createElement("span", {
      className: "hg-over hg-over-b"
    }), React.createElement("span", {
      className: "hg-tie"
    })))
  );
}
const HERO_VIEWS = {};
const HERO_PAIRS = {};
function heroPairs(key, fn) {
  const memo = HERO_PAIRS[key] || (HERO_PAIRS[key] = {
    fn,
    map: new WeakMap()
  });
  return p => {
    let v = memo.map.get(p);
    if (v === undefined) {
      v = memo.fn(p);
      memo.map.set(p, v);
    }
    return v;
  };
}
function Hero({
  rangeId,
  setRangeId,
  showScatter = true,
  matchup,
  setMatchup,
  basis,
  setBasis
}) {
  const sepRef = React.useRef(null);
  const {
    D,
    rangeDomain,
    filterPts,
    buildXTicks,
    series
  } = window.AP;
  const xDomain = rangeDomain(rangeId);
  const MIN_ALT_MONTHS = 6;
  const MAX_ALT_STALE = 0.26;
  const spineEnd = D.agg2pp[D.agg2pp.length - 1].x;
  const hasData = id => {
    const d = MATCHUPS[id].data;
    if (MATCHUPS[id].real) return d.length >= 2;
    return d.length >= MIN_ALT_MONTHS && spineEnd - d[d.length - 1].x <= MAX_ALT_STALE;
  };
  const oppVsLabor = id => {
    const last = MATCHUPS[id].data[MATCHUPS[id].data.length - 1];
    return last.b;
  };
  const rivalFirst = D.latest && D.latest.rivalLead || "alp_lnp";
  const vsLabor = Object.keys(MATCHUPS).filter(id => MATCHUPS[id].vsLabor && hasData(id)).sort((x, y) => x === rivalFirst ? -1 : y === rivalFirst ? 1 : oppVsLabor(y) - oppVsLabor(x));
  const orderedMatchups = [...vsLabor, ...Object.keys(MATCHUPS).filter(id => !MATCHUPS[id].vsLabor && hasData(id))];
  const rangeOptions = [{
    id: "3",
    label: "3mo"
  }, {
    id: "6",
    label: "6mo"
  }, {
    id: "12",
    label: "12mo"
  }, {
    id: "all",
    label: "All"
  }];
  const MORPH_MS = window.AP.MORPH_MS;
  const narrow = useNarrow();
  const [morph, setMorph] = useState(null);
  const morphRaf = useRef(0);
  const impOffered = D.synthLatest && D.synthLatest.alp != null && D.synth2pp && D.synth2pp.length > 1;
  const impBasis = impOffered && basis === "imp" && matchup === "alp_lnp";
  const impOnOffered = D.synthOn && D.synthOn.length > 1 && !!D.latest.onImp;
  const impOnBasis = impOnOffered && basis === "imp" && matchup === "alp_on";
  const [showSynth, setShowSynth] = useState(false);
  React.useEffect(() => () => {
    cancelAnimationFrame(morphRaf.current);
  }, []);
  const subRef = React.useRef(null);
  const subNoteRef = React.useRef(null);
  const subOverW = React.useRef(0);
  const [subTight, setSubTight] = useState(false);
  const subRecheck = () => {
    const row = subRef.current,
      note = subNoteRef.current;
    if (!row || !note) return;
    const chip = row.firstElementChild;
    if (chip && note.offsetTop > chip.offsetTop + chip.offsetHeight) {
      subOverW.current = row.clientWidth;
      setSubTight(true);
    } else if (row.clientWidth > subOverW.current) {
      setSubTight(false);
    }
  };
  React.useEffect(subRecheck);
  React.useEffect(() => {
    const row = subRef.current;
    if (!row) return;
    const ro = new ResizeObserver(subRecheck);
    ro.observe(row);
    let live = true;
    const fontsDone = () => {
      if (live) subRecheck();
    };
    if (document.fonts) {
      document.fonts.ready.then(fontsDone);
      document.fonts.addEventListener("loadingdone", fontsDone);
    }
    return () => {
      live = false;
      ro.disconnect();
      if (document.fonts) document.fonts.removeEventListener("loadingdone", fontsDone);
    };
  }, []);
  const liveMorph = useRef(null);
  const shownDomain = useRef(null);
  const putMorph = m => {
    liveMorph.current = m;
    setMorph(m);
  };
  const runMorph = (make, resume) => {
    const c = window.AP.morphClock(morphRaf, t => putMorph(make(t)), () => putMorph(null), resume);
    putMorph(make(c.t));
  };
  const chooseMatchup = id => {
    const from = matchup,
      cur = liveMorph.current;
    setMatchup(id);
    cancelAnimationFrame(morphRaf.current);
    if (id === from || window.AP.reduceMotion() || !MATCHUPS[from] || !MATCHUPS[id]) {
      putMorph(null);
      return;
    }
    const back = !!cur && !cur.fromBasis && cur.from === id && cur.to === from;
    const fromDomain = cur && !back ? shownDomain.current : null;
    runMorph(t => ({
      from,
      to: id,
      fromDomain,
      t
    }), back ? window.AP.morphRawOf(1 - cur.t) : 0);
  };
  const chooseBasis = () => {
    const bFrom = basis || "imp",
      bTo = bFrom === "imp" ? "resp" : "imp",
      cur = liveMorph.current;
    setBasis(bTo);
    cancelAnimationFrame(morphRaf.current);
    if (window.AP.reduceMotion()) {
      putMorph(null);
      return;
    }
    const back = !!cur && cur.fromBasis === bTo && cur.toBasis === bFrom && cur.from === matchup && cur.to === matchup;
    const fromDomain = cur && !back ? shownDomain.current : null;
    runMorph(t => ({
      from: matchup,
      to: matchup,
      fromBasis: bFrom,
      toBasis: bTo,
      fromDomain,
      t
    }), back ? window.AP.morphRawOf(1 - cur.t) : 0);
  };
  const cmpCopy = matchup === "alp_on" ? impOnBasis ? {
    term: "published head-to-head",
    termId: "weighted-aggregate",
    termTip: "What a weighted aggregate means",
    tip: "Also draw the pollsters’ own published Labor v One Nation figures, each house’s allocation as filed. The complement of the basis above."
  } : {
    term: "implied 2PP",
    termId: "preference-flows",
    termTip: "How preference flows turn primary votes into a two-candidate figure",
    tip: "Also draw what the same polls’ primary votes imply when run through the site’s fixed ALP–ON flow set – calibrated from preference counts, not anchored to an election result, because no count of this pairing exists. A diagnostic, not a correction."
  } : impBasis ? {
    term: "published 2PP",
    termId: "weighted-aggregate",
    termTip: "What a weighted aggregate means",
    tip: "Also draw the same polls’ own published two-party figures (respondent-allocated or equivalent), each house’s allocation as filed. The complement of the basis above."
  } : {
    term: "implied 2PP",
    termId: "implied-2pp",
    termTip: "What an implied two-party figure is",
    tip: "Also draw what the same polls’ primary votes imply when run through one fixed preference-flow table (the 2025 election’s actual flows), shaded to the 2022 table’s read of the One Nation conversion. A diagnostic, not a correction."
  };
  const compareToggle = () => React.createElement("label", {
    className: "pg-check" + (showSynth ? " on" : ""),
    title: cmpCopy.tip
  }, React.createElement("input", {
    type: "checkbox",
    checked: showSynth,
    onChange: e => setShowSynth(e.target.checked)
  }), React.createElement("span", null, "Compare ", React.createElement("button", {
    type: "button",
    className: "hi-term",
    title: cmpCopy.termTip,
    onClick: e => {
      e.preventDefault();
      window.AP.openTerm && window.AP.openTerm(cmpCopy.termId, "two-party preferred");
    }
  }, cmpCopy.term)));
  const m = MATCHUPS[matchup];
  const impDataFor = b => impOffered && (b === undefined ? basis : b) === "imp" ? HERO_VIEWS.imp || (HERO_VIEWS.imp = D.synth2pp.map(d => ({
    ym: d.ym,
    x: d.x,
    a: d.alp,
    b: d.lnp,
    ci95: d.ci95,
    k: d.k
  }))) : null;
  const impData = impDataFor();
  const impScatter = heroPairs("imp", p => p.alpImp == null ? null : [{
    y: p.alpImp,
    color: "var(--alp)",
    label: "ALP implied"
  }, {
    y: +(100 - p.alpImp).toFixed(1),
    color: "var(--lnp)",
    label: "L/NP implied"
  }]);
  const impOnDataFor = b => impOnOffered && (b === undefined ? basis : b) === "imp" ? HERO_VIEWS.impOn || (HERO_VIEWS.impOn = D.synthOn.map(d => ({
    ym: d.ym,
    x: d.x,
    a: d.a,
    b: d.b,
    ci95: d.ci95,
    cs: d.cs,
    cf: d.cf,
    k: d.k
  }))) : null;
  const impOnData = impOnDataFor();
  const impOnScatter = heroPairs("impOn", p => p.alpOnImp == null ? null : [{
    y: p.alpOnImp,
    color: "var(--alp)",
    label: "ALP implied"
  }, {
    y: +(100 - p.alpOnImp).toFixed(1),
    color: "var(--onp)",
    label: "ON implied"
  }]);
  const iDataOf = (id, b) => {
    const imp = id === "alp_lnp" && impDataFor(b) || id === "alp_on" && impOnDataFor(b);
    return imp || MATCHUPS[id].data;
  };
  const iScatOf = (id, b) => {
    const imp = id === "alp_lnp" && impDataFor(b) || id === "alp_on" && impOnDataFor(b);
    return imp ? id === "alp_on" ? impOnScatter : impScatter : heroPairs(id, MATCHUPS[id].scatter);
  };
  const ptsOf = (id, b) => filterPts(iDataOf(id, b), xDomain[0]);
  const pts = ptsOf(matchup);
  const rdOn = !!window.AP.rd;
  const blend = (() => {
    if (!morph || rdOn) return null;
    const A = ptsOf(morph.from, morph.fromBasis),
      B = ptsOf(morph.to, morph.toBasis);
    if (!A.length || !B.length) return null;
    const t = morph.t;
    const bl = window.AP.blendRows(A, B, t, ["a", "b", "ci95"]);
    if (!bl) return null;
    return {
      pts: bl.rows,
      clip: bl.clip,
      a: mixC(MATCHUPS[morph.from].a.color, MATCHUPS[morph.to].a.color, t),
      b: mixC(MATCHUPS[morph.from].b.color, MATCHUPS[morph.to].b.color, t)
    };
  })();
  const drawRows = blend ? blend.pts : pts;
  const drawPts = blend ? blend.pts.filter(d => !d.mid) : pts;
  const colA = blend ? blend.a : m.a.color;
  const colB = blend ? blend.b : m.b.color;
  const latestOf = id => tppLatest(id, basis);
  const otherContests = orderedMatchups.filter(id => id !== matchup).map(id => ({
    id,
    v: latestOf(id)
  })).filter(o => o.v && o.v.a != null);
  const altL = m.altKey && D.altLatest ? D.altLatest[m.altKey] : null;
  const onImpL = m.altKey === "alp_on" && D.latest.onImp && impOnBasis ? D.latest.onImp : null;
  const adjusted = m.real || !!onImpL || !!(D.adjusted && m.altKey && D.adjusted[m.altKey]);
  const latest = m.real ? impBasis && D.synthLatest ? {
    a: D.synthLatest.alp,
    b: D.synthLatest.lnp
  } : {
    a: D.latest.alp2pp,
    b: D.latest.lnp2pp
  } : onImpL || altL || m.data[m.data.length - 1];
  const cloudFor = (id, b) => !showScatter ? [] : D.individualPolls.filter(p => p.x >= xDomain[0] && p.x <= xDomain[1]).flatMap(p => {
    const pair = iScatOf(id, b)(p);
    return pair ? pair.map((s, side) => ({
      x: p.x,
      y: s.y,
      color: s.color,
      label: s.label,
      meta: p,
      side
    })) : [];
  });
  const settledCloud = React.useMemo(() => rdOn ? [] : cloudFor(matchup), [matchup, rangeId, showScatter, basis, rdOn]);
  const morphClouds = React.useMemo(() => {
    if (!morph || rdOn) return null;
    const key = d => d.meta.pollster + "|" + d.meta.released + "|" + d.side;
    const A = cloudFor(morph.from, morph.fromBasis),
      B = cloudFor(morph.to, morph.toBasis);
    const ia = new Map(A.map(d => [key(d), d])),
      ib = new Map(B.map(d => [key(d), d]));
    const travel = [],
      leaving = [],
      arriving = [];
    ia.forEach((d, k) => ib.has(k) ? travel.push([d, ib.get(k)]) : leaving.push(d));
    ib.forEach((d, k) => {
      if (!ia.has(k)) arriving.push(d);
    });
    return {
      travel,
      leaving,
      arriving
    };
  }, [morph ? morph.from : null, morph ? morph.to : null, morph ? morph.fromBasis : null, morph ? morph.toBasis : null, rangeId, showScatter, basis, rdOn]);
  const scatter = morphClouds ? morphClouds.arriving : settledCloud;
  const scatterOut = morphClouds ? morphClouds.leaving : [];
  const scatterMove = !morphClouds ? [] : morphClouds.travel.map(([a, b]) => ({
    x: a.x,
    y: a.y + (b.y - a.y) * morph.t,
    color: mixC(a.color, b.color, morph.t),
    label: b.label,
    meta: b.meta
  }));
  const scatterPolls = settledCloud.length / 2;
  const heroSeries = !adjusted ? [] : [{
    id: "a",
    label: m.a.name,
    color: colA,
    points: series(drawRows, "a"),
    width: 3.6,
    endLabel: m.a.abbr
  }, {
    id: "b",
    label: m.b.name,
    color: colB,
    points: series(drawRows, "b"),
    width: 3.6,
    endLabel: m.b.abbr
  }];
  const cmpSeries = m.altKey === "alp_on" ? impOnBasis ? MATCHUPS.alp_on.data : D.synthOn : impBasis ? D.agg2pp : D.synth2pp;
  const cmpLabel = m.altKey === "alp_on" ? impOnBasis ? "Respondent-allocated ALP" : "Implied ALP (estimated flows)" : impBasis ? "Respondent-allocated ALP" : "Implied ALP (fixed 2025 flows)";
  const synthOverlay = showSynth && (matchup === "alp_lnp" || m.altKey === "alp_on" && impOnOffered) && !morph && cmpSeries && cmpSeries.length > 1 ? [{
    id: "synth",
    label: cmpLabel,
    color: "var(--alp)",
    points: filterPts(cmpSeries.map(d => ({
      x: d.x,
      y: d.alp != null ? d.alp : d.a
    })), xDomain[0]),
    width: 2.2,
    dashed: true,
    opacity: 0.8
  }] : [];
  const sensAreas = synthOverlay.length && matchup === "alp_lnp" && D.flowSens && D.flowSens.length > 1 ? [{
    id: "sens",
    color: "var(--alp)",
    className: "sens-band",
    edge: false,
    smooth: true,
    points: filterPts(D.flowSens.map(d => ({
      x: d.x,
      y0: d.lo,
      y1: d.hi
    })), xDomain[0])
  }] : [];
  const heroSeriesAll = synthOverlay.length ? heroSeries.concat(synthOverlay) : heroSeries;
  const heroSpine = heroSeries.length ? series(drawPts, "a") : [];
  const bandPts = key => drawRows.filter(d => d.ci95 != null).map(d => ({
    x: d.x,
    y0: d[key] - d.ci95,
    y1: d[key] + d.ci95
  }));
  const heroAreas = !heroSeries.length ? [] : [{
    id: "ci-a",
    color: colA,
    className: "ci-band",
    edge: false,
    smooth: true,
    points: bandPts("a")
  }, {
    id: "ci-b",
    color: colB,
    className: "ci-band",
    edge: false,
    smooth: true,
    points: bandPts("b")
  }].filter(a => a.points.length >= 2);
  const eventsFor = (id, basis) => {
    const P = id === matchup && basis === undefined ? pts : ptsOf(id, basis);
    if (!P.length) return [];
    const x0 = P[0].x,
      x1 = P[P.length - 1].x;
    const own = {
      alp_lnp: "2026-02-12",
      alp_on: "2025-12-08"
    }[id];
    return (D.events || []).filter(e => (e.major || e.date === own) && e.x >= x0 && e.x <= x1);
  };
  const heroEvents = !heroSeries.length || !pts.length ? [] : morph ? eventsFor(morph.to, morph.toBasis) : eventsFor(matchup);
  const heroEventsFrom = morph && heroSeries.length && pts.length ? eventsFor(morph.from, morph.fromBasis) : null;
  const heroRefLines = [{
    y: 50,
    label: "tie",
    color: "var(--ink-faint)",
    align: "left"
  }];
  const domainOf = (id, b) => {
    const M = MATCHUPS[id],
      v = [];
    iDataOf(id, b).forEach(d => {
      v.push(d.a, d.b);
      if (d.ci95 != null) v.push(d.a - d.ci95, d.a + d.ci95, d.b - d.ci95, d.b + d.ci95);
    });
    D.individualPolls.forEach(p => {
      const pair = iScatOf(id, b)(p);
      if (pair) pair.forEach(s => v.push(s.y));
    });
    if (M.real && D.synth2pp) D.synth2pp.forEach(d => v.push(d.alp, 100 - d.alp));
    if (M.real && D.agg2pp) D.agg2pp.forEach(d => v.push(d.alp, 100 - d.alp));
    if (M.real && D.flowSens) D.flowSens.forEach(d => v.push(d.lo, d.hi, 100 - d.lo, 100 - d.hi));
    const lo = Math.min(...v),
      hi = Math.max(...v),
      padDot = 0.5;
    return [Math.floor((lo - padDot) / 5) * 5, Math.ceil((hi + padDot) / 5) * 5];
  };
  const yTarget = rdOn ? [0, 100] : domainOf(matchup);
  const yDomain = blend ? (() => {
    const f = morph.fromDomain || domainOf(morph.from, morph.fromBasis),
      t = morph.t;
    return [f[0] + (yTarget[0] - f[0]) * t, f[1] + (yTarget[1] - f[1]) * t];
  })() : yTarget;
  if (!rdOn) shownDomain.current = yDomain;
  const yTicks = [];
  for (let v = yTarget[0]; v <= yTarget[1]; v += 5) if (v > yTarget[0] && v < yTarget[1]) yTicks.push(v);
  const lead = +(latest.a - latest.b).toFixed(1);
  const leadName = lead >= 0 ? m.a.name : m.b.name;
  const leadAnchor = matchup === "alp_lnp" ? D.agg2pp.filter(d => d.election)[0] : null;
  const leadSwing = leadAnchor ? +(latest.a - leadAnchor.alp).toFixed(1) : null;
  const unc = m.real ? impBasis ? D.synthLatest.ci95 != null ? {
    ci95: D.synthLatest.ci95,
    n: D.synthLatest.n,
    changeSig: D.synthLatest.changeSig
  } : null : D.latest.alp2ppCi95 != null ? {
    ci95: D.latest.alp2ppCi95,
    n: D.latest.method.nPolls,
    changeSig: D.latest.changeSig
  } : null : onImpL ? {
    ci95: onImpL.ci95 != null ? onImpL.ci95 : onImpL.band,
    cs: onImpL.cs,
    cf: onImpL.band,
    n: onImpL.n,
    flows: true,
    changeSig: onImpL.changeSig
  } : altL && altL.ci95 != null ? {
    ci95: altL.ci95,
    n: altL.n,
    changeSig: altL.changeSig
  } : null;
  const monthDelta = m.real ? impBasis ? +(D.synthLatest.alp - (D.synthLatest.prev ?? D.latest.alp2ppPrev)).toFixed(1) : +(D.latest.alp2pp - D.latest.alp2ppPrev).toFixed(1) : onImpL && onImpL.aPrev != null ? +(onImpL.a - onImpL.aPrev).toFixed(1) : altL && altL.aPrev != null ? +(altL.a - altL.aPrev).toFixed(1) : +(latest.a - m.data[m.data.length - 2].a).toFixed(1);
  const hiRef = React.useRef(null);
  React.useLayoutEffect(() => {
    const el = hiRef.current;
    if (!el || !el.parentElement) return;
    const fit = () => {
      const setFs = v => {
        const s = v + "px";
        if (el.style.getPropertyValue("--hi-fs") !== s) el.style.setProperty("--hi-fs", s);
      };
      el.classList.add("hi-fitting");
      let fs = 12;
      setFs(fs);
      for (let i = 0; i < 6; i++) {
        const kids = el.children;
        const contentW = kids.length ? kids[kids.length - 1].getBoundingClientRect().right - kids[0].getBoundingClientRect().left : 0;
        if (contentW <= el.clientWidth - 0.5) break;
        const next = Math.max(8, Math.floor(fs * el.clientWidth / Math.max(contentW, 1) * 2) / 2);
        if (next >= fs) break;
        fs = next;
        setFs(fs);
      }
      el.classList.remove("hi-fitting");
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el.parentElement);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
    return () => ro.disconnect();
  });
  if (window.AP.rd) return React.createElement(RdHero, {
    rangeId: rangeId,
    setRangeId: setRangeId,
    matchup: matchup,
    basis: basis,
    morph: morph,
    chooseMatchup: chooseMatchup,
    chooseBasis: chooseBasis,
    orderedMatchups: orderedMatchups,
    latest: latest,
    unc: unc,
    monthDelta: monthDelta,
    leadSwing: leadSwing,
    impOffered: impOffered,
    impOnOffered: impOnOffered,
    impBasis: impBasis,
    impOnBasis: impOnBasis,
    adjusted: adjusted,
    iDataOf: iDataOf,
    iScatOf: iScatOf,
    showScatter: showScatter,
    showSynth: showSynth,
    setShowSynth: setShowSynth,
    otherContests: otherContests,
    xDomain: xDomain,
    domainRef: shownDomain
  });
  return React.createElement("section", {
    className: "card hero"
  }, React.createElement("div", {
    className: "hero-top"
  }, React.createElement("div", {
    className: "hero-headline"
  }, React.createElement("h2", {
    className: "card-title hero-title"
  }, "Two-party preferred"), (m.real && impOffered || m.altKey === "alp_on" && impOnOffered) && React.createElement("div", {
    className: "hero-basis"
  }, React.createElement("button", {
    type: "button",
    className: "hb-toggle",
    "aria-label": "Switch two-party preferred basis – currently using " + ((basis || "imp") === "imp" ? "implied preference flows" : "respondent-allocated preferences only"),
    onClick: chooseBasis
  }, "Using ", React.createElement("span", {
    className: "hb-what"
  }, (basis || "imp") === "imp" ? "implied preference flows" : "respondent-allocated preferences only"), (basis || "imp") === "imp" ? " (default)" : ""), React.createElement("a", {
    className: "hb-q",
    href: "/flows-explained/",
    "aria-label": "How the two bases work \u2013 read the full explainer",
    title: "How the two bases work \u2013 the full explainer"
  }, "?")), React.createElement("div", {
    className: "hero-readout"
  }, React.createElement("div", {
    className: "ro-party alp-side"
  }, React.createElement("span", {
    className: "ro-dot",
    style: {
      background: colA
    }
  }), React.createElement("span", {
    className: "ro-name"
  }, m.a.name), React.createElement(RollNum, {
    className: "ro-num",
    value: latest.a.toFixed(1),
    style: {
      color: inkOf(colA)
    },
    spinIn: true,
    drift: true
  })), React.createElement("span", {
    className: "ro-sep",
    "aria-hidden": "true",
    ref: sepRef
  }), React.createElement("div", {
    className: "ro-party lnp-side"
  }, React.createElement(RollNum, {
    className: "ro-num",
    value: latest.b.toFixed(1),
    style: {
      color: inkOf(colB)
    },
    spinIn: true,
    drift: true
  }), React.createElement("span", {
    className: "ro-name"
  }, m.b.name), React.createElement("span", {
    className: "ro-dot",
    style: {
      background: colB
    }
  }))), unc && React.createElement(HeroGauge, {
    a: latest.a,
    ci: unc.ci95,
    color: lead >= 0 ? colA : colB,
    aName: m.a.name,
    bName: m.b.name,
    sepRef: sepRef
  }), React.createElement("div", {
    className: "hero-lead"
  }, React.createElement("span", {
    className: "lead-tag"
  }, leadName, " leads by ", React.createElement(RollNum, {
    value: Math.abs(lead).toFixed(1),
    spinIn: true
  }), unc ? React.createElement(React.Fragment, null, " ", React.createElement("button", {
    type: "button",
    className: "hi-range hi-term",
    title: unc.flows ? "The polls' sampling margin and the flow table's own range, together" : "What a margin of error means",
    onClick: () => window.AP.openTerm && window.AP.openTerm(unc.flows ? "fp-flows" : "margin-of-error", "two-party preferred")
  }, "\xB1 ", (2 * unc.ci95).toFixed(1), " pts")) : " pts", leadSwing != null && React.createElement(React.Fragment, null, ", " + (leadSwing >= 0 ? "+" : "−"), React.createElement(RollNum, {
    value: Math.abs(leadSwing).toFixed(1),
    spinIn: true
  }), narrow ? " since 2025" : " since the 2025 election"))), React.createElement("div", {
    className: "hero-sub",
    ref: subRef
  }, React.createElement(Delta, {
    value: monthDelta,
    suffix: Math.abs(monthDelta) === 1 ? " pt" : " pts",
    small: true,
    roll: true,
    spinIn: true
  }), React.createElement("span", {
    className: "hero-sub-note",
    ref: subNoteRef
  }, "vs", " ", React.createElement("button", {
    type: "button",
    className: "hi-term",
    onClick: () => window.AP.openTerm && window.AP.openTerm("changes", "two-party preferred")
  }, m.real || onImpL && onImpL.aPrev != null || altL && altL.aPrev != null ? "1 month ago" : "previous reading"), unc && unc.changeSig === false && React.createElement("span", {
    className: "hero-caveat"
  }, " (within ", subTight ? "" : "the ", React.createElement("button", {
    type: "button",
    className: "hi-term",
    title: "What a margin of error means",
    onClick: () => window.AP.openTerm && window.AP.openTerm("margin-of-error", "two-party preferred")
  }, "margin"), ")"))), React.createElement("div", {
    className: "hero-interval",
    ref: hiRef
  }, React.createElement("button", {
    type: "button",
    className: "hi-method hi-term",
    title: "What " + (adjusted ? "a weighted aggregate" : "a monthly average") + " means",
    onClick: () => window.AP.openTerm && window.AP.openTerm(adjusted ? "weighted-aggregate" : "monthly-average", "two-party preferred")
  }, adjusted ? "Weighted aggregate" : "Monthly average"), unc && React.createElement("span", {
    className: "hi-count"
  }, "(", unc.n, " poll", unc.n === 1 ? "" : "s", " in the", " ", D.latest.method.windowDays, " days to ", shortDate(D.latest.updatedISO), ";", " ", React.createElement("button", {
    type: "button",
    className: "hi-note hi-term",
    title: unc.flows ? "The polls' sampling margin and the flow table's own range, together" : "What a margin of error means",
    onClick: () => window.AP.openTerm && window.AP.openTerm(unc.flows ? "fp-flows" : "margin-of-error", "two-party preferred")
  }, unc.flows ? "margin incl. flows" : "95% interval"), ")"), !adjusted && React.createElement("span", {
    className: "eyebrow-warn"
  }, "Limited data"))), React.createElement("div", {
    className: "hero-controls"
  }, React.createElement(TextToggle, {
    caps: true,
    value: rangeId,
    onChange: setRangeId,
    ariaLabel: "Time range",
    options: rangeOptions
  }), otherContests.length > 0 && React.createElement("div", {
    className: "hero-alt"
  }, React.createElement("span", {
    className: "ha-lab"
  }, "Switch 2PP"), otherContests.map(o => React.createElement("button", {
    key: o.id,
    type: "button",
    className: "ha-chip",
    onClick: () => chooseMatchup(o.id),
    title: "Show " + MATCHUPS[o.id].a.name + " v " + MATCHUPS[o.id].b.name
  }, React.createElement("span", {
    className: "ha-vs"
  }, MATCHUPS[o.id].a.name, " v ", MATCHUPS[o.id].b.name), React.createElement("span", {
    className: "ha-fig"
  }, React.createElement("span", {
    style: {
      color: inkOf(MATCHUPS[o.id].a.color)
    }
  }, o.v.a.toFixed(1)), React.createElement("span", {
    className: "ha-dash"
  }, "\u2013"), React.createElement("span", {
    style: {
      color: inkOf(MATCHUPS[o.id].b.color)
    }
  }, o.v.b.toFixed(1))), o.v.ci95 != null && React.createElement("span", {
    className: "ha-ci"
  }, "\xB1 ", o.v.ci95.toFixed(1))))), React.createElement("div", {
    className: "hero-chartbar"
  }, React.createElement(TextToggle, {
    caps: true,
    value: rangeId,
    onChange: setRangeId,
    ariaLabel: "Time range",
    options: rangeOptions
  })))), React.createElement(TrendChart, {
    key: "hero",
    height: narrow ? 700 : 420,
    xDomain: xDomain,
    yDomain: yDomain,
    yTicks: yTicks,
    unit: "%",
    axisFont: narrow ? 30 : 22,
    pad: narrow ? {
      l: 74,
      r: 16,
      t: 26,
      b: 54
    } : {
      l: 58,
      r: 22,
      t: 30,
      b: 42
    },
    xTicks: buildXTicks(xDomain[0], xDomain[1]),
    refLines: heroRefLines,
    events: heroEvents,
    eventsFrom: heroEventsFrom,
    eventMix: morph ? morph.t : 1,
    scatter: scatter,
    series: heroSeriesAll,
    spine: heroSpine,
    pollFacet: "twopp",
    scatterOut: scatterOut,
    scatterMove: scatterMove,
    areas: sensAreas.length ? heroAreas.concat(sensAreas) : heroAreas,
    fade: blend ? morph.t : 1,
    clipX: blend ? blend.clip : null,
    tooltipTitle: i => window.AP.monthLabelFull((drawPts[i] || drawPts[drawPts.length - 1]).ym),
    extraRows: i => {
      const d = drawPts[i];
      if (!d || d.ci95 == null || !d.ci95) return [];
      const parts = d.cf != null && d.cs != null ? " (polls ± " + d.cs.toFixed(1) + ", flows ± " + d.cf.toFixed(1) + ")" : "";
      return [{
        label: parts ? "Margin" : "95% interval",
        value: "± " + d.ci95.toFixed(1) + " pts" + parts + (d.k ? ", " + d.k + " poll" + (d.k === 1 ? "" : "s") : "")
      }];
    },
    fmt: v => v.toFixed(1)
  }), React.createElement("div", {
    className: "hero-foot"
  }, React.createElement("div", {
    className: "hero-legend"
  }, React.createElement("span", {
    className: "hl-item"
  }, React.createElement("span", {
    className: heroSeries.length ? "hl-line" : "hl-swatch-dot",
    style: {
      background: m.a.color
    }
  }), m.a.name), React.createElement("span", {
    className: "hl-item"
  }, React.createElement("span", {
    className: heroSeries.length ? "hl-line" : "hl-swatch-dot",
    style: {
      background: m.b.color
    }
  }), m.b.name), scatterPolls > 0 && heroSeries.length > 0 && React.createElement("span", {
    className: "hl-item hl-polls"
  }, React.createElement("span", {
    className: "hl-dot"
  }), "Individual poll"), heroAreas.length > 0 && React.createElement("span", {
    className: "hl-item"
  }, React.createElement("span", {
    className: "hl-band"
  }), impOnBasis ? "margin incl. flows" : "95% interval"), synthOverlay.length > 0 && React.createElement("span", {
    className: "hl-item"
  }, React.createElement("span", {
    className: "hl-dashed",
    style: {
      borderColor: "var(--alp)"
    }
  }), m.altKey === "alp_on" ? impOnBasis ? React.createElement(React.Fragment, null, "Published (respondent-allocated)", D.altLatest && D.altLatest.alp_on ? `, ${D.altLatest.alp_on.a.toFixed(1)}` : "") : React.createElement(React.Fragment, null, "Implied from primaries at fixed flows", D.latest.onImp ? `, ${D.latest.onImp.a.toFixed(1)}` : "") : impBasis ? React.createElement(React.Fragment, null, "Published (respondent-allocated)", D.latest && D.latest.alp2pp != null ? `, ${D.latest.alp2pp.toFixed(1)}` : "") : React.createElement(React.Fragment, null, "Implied from primaries at 2025 flows", D.synthLatest && D.synthLatest.alp != null ? `, ${D.synthLatest.alp.toFixed(1)}` : "")), sensAreas.length > 0 && React.createElement("span", {
    className: "hl-item",
    title: "Shade between the implied figure as read on the 2025 and 2022 counted flow tables (TPP cut) \u2013 if One Nation preferences flowed to Labor as they did in 2022, the implied figure would sit at the bracket's top edge. A sensitivity read, not an interval."
  }, React.createElement("span", {
    className: "hl-band hl-band-sens"
  }), "ON-flow sensitivity")), React.createElement(HowTo, {
    cls: "hero-caption",
    paras: [React.createElement(React.Fragment, null, m.real ? React.createElement(React.Fragment, null, impBasis ? "Each dot is one poll’s primaries re-allocated at fixed 2025 preference flows; the line is a " : "Each dot is one published poll; the line is a ", React.createElement("button", {
      type: "button",
      className: "hi-term",
      title: "Why the newest dots can sit past the line\u2019s end",
      onClick: () => window.AP.openTerm && window.AP.openTerm("dots-past-the-line", "two-party preferred")
    }, "smoothed average"), impBasis ? " of those implied figures." : " across all pollsters.") : impOnBasis ? "Each dot is one poll’s primaries re-allocated at the site’s fixed ALP–ON flow set; the line is a smoothed average of those implied figures." : `Each dot is one pollster’s published ${m.label} head-to-head` + (adjusted ? ", adjusted for each house’s lean on this matchup as the headline two-party is." : ", averaged monthly – too few houses ask it to weight or correct.") + (scatterPolls ? ` ${scatterPolls} poll${scatterPolls === 1 ? "" : "s"} so far.` : "")), m.real ? React.createElement(React.Fragment, null, "The shading is the interval around the line. Where the two bands overlap, the lead is inside its own margin of error \u2013 the polls cannot separate the parties that month.") : impOnBasis ? React.createElement(React.Fragment, null, "The shading is the margin around the line: the polls\u2019 sampling error and the flow table\u2019s own range, together. No election has counted this pairing, so the set is built from the ballots that exist, not anchored to a result.") : null]
  })), (matchup === "alp_lnp" && impOffered || m.altKey === "alp_on" && impOnOffered) && compareToggle());
}
function MethodNote({
  onInfo
}) {
  const J = window.JUR;
  const infoClick = e => {
    e.preventDefault();
    onInfo();
  };
  return React.createElement("footer", {
    className: "method"
  }, React.createElement("div", {
    className: "colophon"
  }, React.createElement("div", {
    className: "colo-about",
    "data-nosnippet": ""
  }, !J ? React.createElement("p", {
    className: "colo-lede"
  }, "auspol tracker is an unofficial aggregator of published federal opinion polling.") : React.createElement("p", {
    className: "colo-lede"
  }, J.brand, " tracker is an unofficial aggregator of published ", J.electionWords, " opinion polling."), React.createElement("p", {
    className: "disclaimer"
  }, "Best efforts are made to make the aggregate figures transparent, trustworthy, statistically sound, and informative, but they are, in the end, estimates only.")), React.createElement("div", {
    className: "colo-ways"
  }, React.createElement("p", {
    className: "fb-lede"
  }, onInfo && React.createElement(React.Fragment, null, "How the figures are built is in", " ", React.createElement("a", {
    href: "#info",
    className: "hi-term",
    onClick: infoClick
  }, "Info"), ".", " "), "Spot an error, a missing poll, or have any other feedback? Please", " ", React.createElement("a", {
    className: "fb-link",
    href: "/feedback/"
  }, "let me know"), "."), !J ? React.createElement("p", {
    className: "colo-arch"
  }, "Federal polling archives I\u2019ve located are stored", " ", React.createElement("a", {
    className: "colo-link",
    href: "/provenance/"
  }, "here", React.createElement("span", {
    className: "plink-mark",
    "aria-hidden": "true"
  }, "\u2197")), " ", "for safekeeping and convenience.") : React.createElement("p", {
    className: "colo-arch"
  }, "Federal polling is tracked on", " ", React.createElement("a", {
    className: "colo-link",
    href: "/"
  }, "auspol tracker"), "."), React.createElement("p", {
    className: "colo-arch"
  }, React.createElement("button", {
    type: "button",
    className: "hi-term colo-plain",
    onClick: () => window.AP.openStatic && window.AP.openStatic()
  }, "Read this page as plain text"), " ", "\u2013 every figure and the method, without charts."))));
}
let chromeSettled = false;
let flipsOpen = 0;
let viewPanelPokedAt = 0;
let viewPanelFocusIsPointer = false;
const TABS = [{
  id: "now",
  label: "Now"
}, {
  id: "cycles",
  label: "Past cycles"
}, {
  id: "allpolls",
  label: "All polls"
}, {
  id: "disagreement",
  label: "Poll disagreement",
  menu: true,
  tip: "How much the polls disagree with one another"
}, {
  id: "leans",
  label: "Pollster leans",
  menu: true,
  tip: "How each pollster leans against the others"
}, {
  id: "flows",
  label: "Respondent-allocated preference flows",
  menu: true,
  tip: "Where minor-party preferences are flowing now, against the last election"
}, {
  id: "flows-explained",
  label: "Preference flows explained",
  menu: true,
  tip: "How preferences decide the two-party figure"
}, {
  id: "map",
  label: "Election map",
  menu: true,
  ext: true,
  tip: "Every federal seat and polling place since 2004, on the map and in the chamber"
}, {
  id: "public-opinion",
  label: "Public opinion",
  menu: true,
  tip: "What Australians tell the pollsters beyond their vote, by topic"
}, {
  id: "changelog",
  label: "Changelog",
  menu: true,
  tip: "What has moved the aggregate, each finding and the confidence gauges, entry by entry"
}, {
  id: "info",
  label: "Info",
  pinHide: true,
  tip: "About this site – how it works, what it tracks, and the terms it uses"
}];
if (!window.AUSPOL.cycles.some(c => !c.current)) TABS.splice(TABS.findIndex(t => t.id === "cycles"), 1);
if (window.JUR) TABS.splice(TABS.findIndex(t => t.id === "flows-explained"), 1);
if (window.JUR) TABS.splice(TABS.findIndex(t => t.id === "public-opinion"), 1);
if (window.JUR) TABS.splice(TABS.findIndex(t => t.id === "changelog"), 1);
if (window.JUR) TABS.splice(TABS.findIndex(t => t.id === "map"), 1);
const TAB_IDS = TABS.filter(t => !t.ext).map(t => t.id);
const TAB_MENU = Object.fromEntries(TABS.filter(t => t.menu && !t.ext).map(t => [t.id, t]));
const TAB_BASE = window.JUR ? "/vic/" : "/";
const tabToPath = id => id === "now" ? TAB_BASE : TAB_BASE + id + "/";
const pathToTab = () => {
  const p = window.location.pathname;
  if (!p.startsWith(TAB_BASE)) return null;
  const seg = p.slice(TAB_BASE.length).replace(/\/+$/, "");
  if (seg === "") return "now";
  return TAB_IDS.includes(seg) ? seg : null;
};
const TAB_HASH = {
  snapshot: "now",
  now: "now",
  cycles: "cycles",
  allpolls: "allpolls",
  info: "info",
  disagreement: "disagreement",
  leans: "leans",
  flows: "flows",
  "beyond-the-vote": "public-opinion",
  "public-opinion": "public-opinion"
};
const readLocation = () => {
  const h = (window.location.hash || "").replace(/^#/, "");
  if (h && TAB_IDS.includes(TAB_HASH[h])) return TAB_HASH[h];
  const fromPath = pathToTab();
  if (fromPath) return fromPath;
  return TAB_IDS.includes(window.AP_INITIAL_TAB) ? window.AP_INITIAL_TAB : "now";
};
window.AP.tabToPath = tabToPath;
const PrimaryVoteMemo = React.memo(PrimaryVotePanel);
const NextPollsMemo = React.memo(NextPollsPanel);
const LeadershipMemo = React.memo(LeadershipSection);
const DirectionMemo = React.memo(DirectionPanel);
const DemographicsMemo = React.memo(DemographicsPanel);
const OnSourcesMemo = React.memo(OnSourcesPanel);
const IssuesMemo = React.memo(IssuesPanel);
const UndecidedMemo = React.memo(UndecidedPanel);
const MoodMemo = React.memo(MoodPanel);
function SnapshotView({
  rangeId: heroRange,
  setRangeId,
  showScatter,
  tppMatchup,
  setTppMatchup,
  tppBasis,
  setTppBasis
}) {
  const rangeId = window.AP.rd ? "all" : heroRange;
  const [tail, setTail] = useState(snapshotTailArmed);
  React.useEffect(() => {
    if (!snapshotTailArmed) {
      snapshotTailArmed = true;
      setTail(true);
    }
  }, []);
  return React.createElement(React.Fragment, null, React.createElement(Hero, {
    rangeId: heroRange,
    setRangeId: setRangeId,
    showScatter: showScatter,
    matchup: tppMatchup,
    setMatchup: setTppMatchup,
    basis: tppBasis,
    setBasis: setTppBasis
  }), tail && React.createElement(PrimaryVoteMemo, {
    rangeId: heroRange,
    setRangeId: setRangeId
  }), React.createElement(PollsterTable, {
    tppBasis: tppBasis,
    setTppBasis: setTppBasis,
    tppMatchup: tppMatchup,
    setTppMatchup: setTppMatchup
  }), React.createElement(NextPollsMemo, null), tail && React.createElement(React.Fragment, null, React.createElement(LeadershipMemo, {
    rangeId: rangeId
  }), React.createElement(DirectionMemo, {
    rangeId: rangeId
  }), React.createElement(DemographicsMemo, {
    rangeId: rangeId
  }), React.createElement(OnSourcesMemo, {
    rangeId: rangeId
  }), React.createElement(IssuesMemo, {
    rangeId: rangeId
  }), React.createElement(UndecidedMemo, {
    rangeId: rangeId
  }), React.createElement(MoodMemo, {
    rangeId: rangeId
  })));
}
let snapshotTailArmed = false;
class ViewBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      err: null
    };
  }
  static getDerivedStateFromError(err) {
    return {
      err
    };
  }
  componentDidCatch(err) {
    console.error("view render failed:", err);
  }
  componentDidUpdate(prev) {
    if (prev.active && !this.props.active && this.state.err) this.setState({
      err: null
    });
  }
  render() {
    if (this.state.err) {
      return React.createElement("div", {
        className: "view-error",
        role: "alert"
      }, React.createElement("p", null, "This view hit an error and could not display. The rest of the page is unaffected."), React.createElement("button", {
        type: "button",
        className: "view-error-retry",
        onClick: () => this.setState({
          err: null
        })
      }, "Try again"));
    }
    return this.props.children;
  }
}
class RootBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      err: null
    };
  }
  static getDerivedStateFromError(err) {
    return {
      err
    };
  }
  componentDidCatch(err) {
    console.error("app render failed:", err);
    document.body.classList.remove("js");
    if (window.apBootDone) window.apBootDone();
    const ss = document.querySelector(".static-summary");
    if (ss) {
      ss.removeAttribute("aria-hidden");
      ss.inert = false;
    }
  }
  render() {
    return this.state.err ? null : this.props.children;
  }
}
const KBD_ROWS = [{
  keys: ["←", "→"],
  what: "Turn the pages, the More menu’s included"
}, {
  keys: ["⌥", "D"],
  what: "Dark mode, on or off — ⌥ is Alt on a PC"
}, {
  keys: ["C"],
  what: "Copy the chart or poll breakdown under the pointer as an image"
}, {
  keys: ["←", "→"],
  what: "Walk a card's tabs or chips while the pointer is over it"
}, {
  keys: ["↑", "↓"],
  what: "In the preference-flows explainer, walk the elections menu while the pointer is on its card"
}, {
  keys: ["1–9"],
  what: "Pick a numbered party or term on a chips row"
}, {
  keys: ["1–9"],
  what: "Jump to the More menu's numbered page — the menu open, or the pointer or focus on the bar"
}, ...(window.JUR ? [] : [{
  keys: ["1–7"],
  what: "In the all-polls demographics view, pick the Split by group"
}]), {
  keys: ["Space"],
  what: window.JUR ? "Flip the matchup in the two-party views" : "Flip the matchup in the two-party views; walk the Primary vote panel's group menu; walk the Who votes for whom panel's party chips; cycle the One Nation voter-switching views; step the all-polls demographics split and the preference-flows region menu; step the Past-cycles summary's other menu; flip the Share side in the preference-flows explainer"
}, {
  keys: ["P"],
  what: "In the all-polls two-party table, published figures only"
}, {
  keys: ["?"],
  what: "This sheet"
}];
const TWEAKS_STORE_KEY = 'auspol.tweaks';
function __loadStoredTweaks(defaults) {
  try {
    const stored = JSON.parse(window.localStorage.getItem(TWEAKS_STORE_KEY) || 'null');
    if (!stored || typeof stored !== 'object') return defaults;
    const merged = {
      ...defaults
    };
    for (const k of Object.keys(defaults)) if (k in stored) merged[k] = stored[k];
    return merged;
  } catch {
    return defaults;
  }
}
function useTweaks(defaults) {
  const [values, setValues] = React.useState(() => __loadStoredTweaks(defaults));
  const setTweak = React.useCallback((keyOrEdits, val) => {
    const edits = typeof keyOrEdits === 'object' && keyOrEdits !== null ? keyOrEdits : {
      [keyOrEdits]: val
    };
    setValues(prev => {
      const next = {
        ...prev,
        ...edits
      };
      try {
        window.localStorage.setItem(TWEAKS_STORE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);
  return [values, setTweak];
}
function App() {
  React.useLayoutEffect(() => {
    document.body.classList.add("js");
    if (window.apBootDone) window.apBootDone();
  }, []);
  const TWEAK_DEFAULTS = {
    "layout": "editorial",
    "theme": "auto",
    "accent": "warm",
    "showScatter": true
  };
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [rangeId, setRangeId] = useState("all");
  const qDesign = (() => {
    try {
      const q = new URLSearchParams(window.location.search).get("design");
      return q === "old" || q === "new" ? q : null;
    } catch (_) {
      return null;
    }
  })();
  const rd = qDesign !== "old" || !!window.JUR;
  window.AP.rd = rd;
  React.useLayoutEffect(() => {
    document.body.classList.toggle("rd", rd);
  }, [rd]);
  const [tppMatchup, setTppMatchup] = useState(window.AUSPOL.latest && window.AUSPOL.latest.rivalLead || "alp_lnp");
  const [tppBasis, setTppBasis] = useState("imp");
  React.useEffect(() => {
    window.AP.tppBasis = tppBasis;
    return () => {
      if (window.AP.tppBasis === tppBasis) delete window.AP.tppBasis;
    };
  }, [tppBasis]);
  const [tab, setTab] = useState(readLocation);
  const [focusPoll, setFocusPoll] = useState(null);
  const [focusTerm, setFocusTerm] = useState(null);
  const [termPop, setTermPop] = useState(null);
  const [mounted, setMounted] = useState(() => [tab]);
  const [entered, setEntered] = useState(null);
  const tabRef = useRef(tab);
  tabRef.current = tab;
  React.useEffect(() => {
    const h = (window.location.hash || "").replace(/^#/, "");
    if (h && TAB_HASH[h]) {
      const t = TAB_IDS.includes(TAB_HASH[h]) ? TAB_HASH[h] : null;
      urlWrite("replaceState", (t ? tabToPath(t) : window.location.pathname) + window.location.search);
    }
    const onUrl = () => {
      const t = readLocation();
      if (t !== tabRef.current) setEntered(t);
      setTab(t);
    };
    window.addEventListener("popstate", onUrl);
    window.addEventListener("hashchange", onUrl);
    return () => {
      window.removeEventListener("popstate", onUrl);
      window.removeEventListener("hashchange", onUrl);
    };
  }, []);
  React.useEffect(() => {
    setMounted(m => m.indexOf(tab) === -1 ? m.concat([tab]) : m);
  }, [tab]);
  React.useEffect(() => {
    if (entered == null) return undefined;
    const tm = setTimeout(() => setEntered(null), 450);
    return () => clearTimeout(tm);
  }, [entered]);
  React.useEffect(() => {
    if (!window.location.pathname.startsWith(TAB_BASE)) return;
    if (window.location.pathname !== tabToPath(tab)) urlWrite("replaceState", tabToPath(tab) + window.location.search);
  }, [tab]);
  const navTab = (id, push) => {
    if (id !== tabRef.current) setEntered(id);
    setTab(id);
    if (push && window.location.pathname.startsWith(TAB_BASE) && pathToTab() !== id) urlWrite("pushState", tabToPath(id) + window.location.search);
  };
  const goTab = id => {
    navTab(id, true);
    window.scrollTo({
      top: 0,
      behavior: "auto"
    });
    setFocusPoll(null);
    setFocusTerm(null);
  };
  const swipeRef = useRef(null);
  swipeRef.current = {
    tab,
    goTab
  };
  React.useEffect(() => {
    const PHONE = window.matchMedia(MQ_PHONE);
    const MIN_DX = 60;
    const EDGE = 24;
    const NEAR_BELOW = 120;
    const MAX_MS = 800;
    let g = null;
    const claimsSideways = el => {
      for (let n = el; n && n.nodeType === 1 && n !== document.body; n = n.parentElement) {
        if (n.matches("input, textarea, select, [contenteditable], [role=slider]")) return true;
        const cs = getComputedStyle(n);
        const ta = cs.touchAction;
        if (ta && ta !== "auto" && ta !== "manipulation" && !/pan-x/.test(ta)) return true;
        if ((cs.overflowX === "auto" || cs.overflowX === "scroll") && n.scrollWidth > n.clientWidth + 1) return true;
      }
      return false;
    };
    const rowAt = y => {
      let best = null,
        bestD = Infinity;
      for (const el of document.querySelectorAll("[data-rd-swipe]")) {
        const r = el.getBoundingClientRect();
        if (!r.height) continue;
        const owner = el.closest(".rd-ld-panel") || el.closest("section");
        const reach = Math.max(r.bottom + NEAR_BELOW, owner ? owner.getBoundingClientRect().bottom : 0);
        if (y < r.top - 12 || y > reach) continue;
        const d = y < r.bottom ? 0 : y - r.bottom;
        if (d < bestD) {
          bestD = d;
          best = el;
        }
      }
      return best;
    };
    const onStart = e => {
      g = null;
      if (!PHONE.matches || e.touches.length !== 1) return;
      if (window.visualViewport && window.visualViewport.scale > 1.01) return;
      const t = e.touches[0];
      if (t.clientX < EDGE || t.clientX > window.innerWidth - EDGE) return;
      const self = e.target && e.target.closest ? e.target.closest("[data-rd-swipe-self]") : null;
      if (self && self.__rdSwipe) {
        g = {
          x: t.clientX,
          y: t.clientY,
          t: Date.now(),
          selfScroll: true,
          row: self
        };
        return;
      }
      const own = e.target && e.target.closest && e.target.closest(".chart") ? e.target.closest("[data-rd-swipe-exact]") : null;
      if (!own && claimsSideways(e.target)) return;
      g = {
        x: t.clientX,
        y: t.clientY,
        t: Date.now(),
        sy: window.scrollY,
        row: own || rowAt(t.clientY)
      };
    };
    const onMove = e => {
      if (g && e.touches.length > 1) g = null;
    };
    const onCancel = () => {
      g = null;
    };
    const onEnd = e => {
      const s = g;
      g = null;
      if (!s || !e.changedTouches.length) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - s.x,
        dy = t.clientY - s.y;
      if (Math.abs(dx) < MIN_DX || Math.abs(dy) > Math.abs(dx) * 0.5) return;
      if (s.selfScroll) s.sy = window.scrollY;
      if (Date.now() - s.t > MAX_MS || Math.abs(window.scrollY - s.sy) > 12) return;
      const sel = window.getSelection && window.getSelection();
      if (sel && !sel.isCollapsed) return;
      const dir = dx < 0 ? 1 : -1;
      if (s.row) {
        if (s.row.isConnected && s.row.__rdSwipe) s.row.__rdSwipe(dir);
        return;
      }
      const {
        tab: cur,
        goTab: go
      } = swipeRef.current;
      const ids = TAB_IDS;
      go(ids[(ids.indexOf(cur) + dir + ids.length) % ids.length]);
    };
    document.addEventListener("touchstart", onStart, {
      passive: true
    });
    document.addEventListener("touchmove", onMove, {
      passive: true
    });
    document.addEventListener("touchend", onEnd, {
      passive: true
    });
    document.addEventListener("touchcancel", onCancel, {
      passive: true
    });
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onCancel);
    };
  }, []);
  React.useEffect(() => {
    const onKey = e => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const a = document.activeElement;
      if (a && a !== document.body && a !== document.documentElement) return;
      if (document.querySelector(".rd-qpanel, .term-pop, .rd-keysheet, .tab-menu-pop")) return;
      const sel = window.getSelection && window.getSelection();
      if (sel && !sel.isCollapsed) return;
      const {
        tab: cur,
        goTab: go
      } = swipeRef.current;
      const ids = TAB_IDS;
      const next = ids[(ids.indexOf(cur) + (e.key === "ArrowRight" ? 1 : -1) + ids.length) % ids.length];
      if (next) {
        e.preventDefault();
        go(next);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  const npJumpRef = useRef(false);
  const npScrollNow = () => {
    const el = document.querySelector("section.next-polls, section.rd-polls");
    if (el) el.scrollIntoView({
      block: "start",
      behavior: "auto"
    });
  };
  const swScrollNow = () => {
    const el = document.getElementById("switching");
    if (el) el.scrollIntoView({
      block: "start",
      behavior: "auto"
    });
  };
  React.useEffect(() => {
    window.AP.openPoll = (key, facet, from, split) => {
      if (!key) return;
      setFocusPoll({
        key,
        facet: facet || null,
        split: split || null,
        back: {
          tab: readLocation(),
          y: window.scrollY,
          from: from || "the chart"
        }
      });
      navTab("allpolls", true);
    };
    const openTermPage = (id, from) => {
      if (!id) return;
      setTermPop(null);
      setFocusTerm({
        id,
        back: {
          tab: readLocation(),
          y: window.scrollY,
          from: from || "where you were"
        }
      });
      navTab("info", true);
    };
    window.AP.openTerm = (id, from) => {
      if (!id) return;
      if (readLocation() === "info") openTermPage(id, from);else setTermPop({
        id,
        from
      });
    };
    window.AP.openTermPage = openTermPage;
    window.AP.gotoNextPolls = () => {
      if (readLocation() === "now") {
        npScrollNow();
        return;
      }
      npJumpRef.current = true;
      navTab("now", true);
    };
    window.AP.gotoFinalPolls = () => {
      navTab("cycles", true);
      let tries = 0;
      const seek = () => {
        const el = document.getElementById("final-polls");
        if (el) {
          el.scrollIntoView({
            block: "start"
          });
          return;
        }
        if (++tries < 40) setTimeout(seek, 75);
      };
      setTimeout(seek, 0);
    };
    window.AP.gotoSwitching = () => {
      if (readLocation() === "now") {
        swScrollNow();
        return;
      }
      navTab("now", true);
      let tries = 0;
      const seek = () => {
        const el = document.getElementById("switching");
        if (el) {
          el.scrollIntoView({
            block: "start",
            behavior: "auto"
          });
          return;
        }
        if (++tries < 40) setTimeout(seek, 75);
      };
      setTimeout(seek, 0);
    };
    window.AP.gotoOpinion = storeKey => {
      if (readLocation() !== "public-opinion") navTab("public-opinion", true);
      let tries = 0;
      const seek = () => {
        if (window.AP.btvGo) {
          window.AP.btvGo("btv-p-" + storeKey);
          return;
        }
        if (++tries < 40) setTimeout(seek, 75);
      };
      setTimeout(seek, 0);
    };
    return () => {
      delete window.AP.openPoll;
      delete window.AP.openTerm;
      delete window.AP.openTermPage;
      delete window.AP.gotoNextPolls;
      delete window.AP.gotoFinalPolls;
      delete window.AP.gotoSwitching;
      delete window.AP.gotoOpinion;
    };
  }, []);
  const restoreY = useRef(null);
  const backFromPoll = () => {
    const b = focusPoll && focusPoll.back || {
      tab: "now",
      y: 0
    };
    setFocusPoll(null);
    restoreY.current = b.y;
    navTab(b.tab, true);
  };
  const backFromTerm = () => {
    const b = focusTerm && focusTerm.back || {
      tab: "now",
      y: 0
    };
    setFocusTerm(null);
    restoreY.current = b.y;
    navTab(b.tab, true);
  };
  React.useLayoutEffect(() => {
    if (npJumpRef.current) {
      npJumpRef.current = false;
      npScrollNow();
      return;
    }
    if (restoreY.current == null) return;
    const y = restoreY.current;
    restoreY.current = null;
    window.scrollTo({
      top: y,
      behavior: "auto"
    });
  }, [tab]);
  const prefersDark = () => window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const [sysDark, setSysDark] = useState(prefersDark());
  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const fn = e => setSysDark(e.matches);
    mq.addEventListener ? mq.addEventListener("change", fn) : mq.addListener(fn);
    return () => {
      mq.removeEventListener ? mq.removeEventListener("change", fn) : mq.removeListener(fn);
    };
  }, []);
  const isDark = t.theme === "dark" || t.theme === "auto" && sysDark;
  const want = {
    editorial: t.layout === "editorial",
    cool: t.accent === "cool",
    dark: isDark
  };
  const applyChrome = () => {
    for (const c in want) document.body.classList.toggle(c, want[c]);
  };
  const flipColours = () => {
    flipsOpen++;
    document.documentElement.classList.add("theme-flip");
    applyChrome();
  };
  const endFlip = () => {
    if (--flipsOpen <= 0) {
      flipsOpen = 0;
      document.documentElement.classList.remove("theme-flip");
    }
  };
  React.useLayoutEffect(() => {
    if (chromeSettled) return;
    chromeSettled = true;
    applyChrome();
  }, []);
  React.useEffect(() => {
    if (!Object.keys(want).some(c => document.body.classList.contains(c) !== want[c])) return;
    const still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!chromeSettled || still || document.visibilityState === "hidden" || typeof document.startViewTransition !== "function") {
      const first = !chromeSettled;
      chromeSettled = true;
      if (first) {
        applyChrome();
        return;
      }
      flipColours();
      requestAnimationFrame(() => requestAnimationFrame(endFlip));
      return;
    }
    const vt = document.startViewTransition(flipColours);
    if (vt) {
      if (vt.ready && vt.ready.catch) vt.ready.catch(() => {});
      if (vt.finished && vt.finished.then) vt.finished.then(endFlip, endFlip);else endFlip();
    }
  }, [t.layout, t.accent, isDark]);
  const cycleTheme = () => setTweak("theme", isDark ? "light" : "dark");
  const themeKeyRef = useRef(cycleTheme);
  themeKeyRef.current = cycleTheme;
  React.useEffect(() => {
    const onKey = e => {
      if (e.defaultPrevented || e.repeat || e.metaKey || e.ctrlKey || e.shiftKey || !e.altKey) return;
      if (e.code !== "KeyD" && e.key !== "d" && e.key !== "D" && e.key !== "∂") return;
      const a = document.activeElement;
      if (a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || a.tagName === "SELECT" || a.isContentEditable)) return;
      e.preventDefault();
      themeKeyRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  const [keySheet, setKeySheet] = useState(false);
  const keySheetEl = useRef(null);
  React.useEffect(() => {
    const onKey = e => {
      if (e.defaultPrevented || e.repeat || e.altKey || e.ctrlKey || e.metaKey) return;
      const a = document.activeElement;
      if (a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || a.tagName === "SELECT" || a.isContentEditable)) return;
      if (e.key === "?") {
        e.preventDefault();
        e.stopPropagation();
        setKeySheet(v => !v);
      } else if (keySheet && e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setKeySheet(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [keySheet]);
  React.useEffect(() => {
    if (!keySheet) return undefined;
    const back = document.activeElement;
    const el = keySheetEl.current;
    if (el) el.focus();
    return () => {
      if (back && back.focus && back.isConnected) back.focus();
    };
  }, [keySheet]);
  return React.createElement("div", {
    className: "page"
  }, React.createElement("a", {
    className: "skip-link",
    href: "#",
    onClick: e => {
      e.preventDefault();
      const m = document.getElementById("main-content");
      if (m) {
        m.focus({
          preventScroll: true
        });
        m.scrollIntoView({
          block: "start"
        });
      }
    }
  }, "Skip to content"), React.createElement(Header, {
    isDark: isDark,
    onToggleTheme: cycleTheme,
    rd: rd,
    key: "head-" + rd
  }), React.createElement(Tabs, {
    tabs: TABS,
    active: tab,
    onChange: goTab,
    tppMatchup: tppMatchup,
    tppBasis: tppBasis,
    key: "tabs-" + rd
  }), React.createElement("main", {
    className: "content",
    id: "main-content",
    tabIndex: -1
  }, mounted.map(id => React.createElement("div", _extends({
    className: entered === id ? "view-enter content" : "content",
    key: id,
    role: "tabpanel",
    id: "panel-" + id,
    hidden: id !== tab
  }, TAB_MENU[id] ? {
    "aria-label": TAB_MENU[id].label
  } : {
    "aria-labelledby": "tab-" + id
  }, {
    tabIndex: 0,
    onPointerDownCapture: () => {
      viewPanelPokedAt = Date.now();
    },
    onPointerUpCapture: e => {
      viewPanelPokedAt = Date.now();
      const el = e.currentTarget;
      setTimeout(() => {
        if (viewPanelFocusIsPointer && document.activeElement === el && window.getSelection().isCollapsed) el.blur();
      }, 0);
    },
    onFocus: e => {
      viewPanelFocusIsPointer = e.target === e.currentTarget && Date.now() - viewPanelPokedAt < 400;
    },
    onBlur: e => {
      if (e.target === e.currentTarget) viewPanelFocusIsPointer = false;
    }
  }), React.createElement(ViewBoundary, {
    active: id === tab
  }, id === "now" && React.createElement(SnapshotView, {
    rangeId: rangeId,
    setRangeId: setRangeId,
    showScatter: t.showScatter,
    tppMatchup: tppMatchup,
    setTppMatchup: setTppMatchup,
    tppBasis: tppBasis,
    setTppBasis: setTppBasis
  }), id === "cycles" && React.createElement(PastCyclesView, null), id === "allpolls" && React.createElement(AllPollsView, {
    focus: focusPoll,
    onBack: focusPoll ? backFromPoll : null,
    backLabel: focusPoll && focusPoll.back ? focusPoll.back.from : null,
    tppBasis: tppBasis,
    setTppBasis: setTppBasis
  }), termPop && id === tab && React.createElement(TermPop, {
    id: termPop.id,
    onClose: () => setTermPop(null),
    onMore: () => window.AP.openTermPage(termPop.id, termPop.from)
  }), TAB_MENU[id] && React.createElement(MenuPageView, {
    id: id,
    tppBasis: tppBasis
  }), id === "info" && React.createElement(InfoView, {
    focus: focusTerm ? focusTerm.id : null,
    onBack: focusTerm ? backFromTerm : null,
    backLabel: focusTerm && focusTerm.back ? focusTerm.back.from : null
  })))), React.createElement(MethodNote, {
    onInfo: tab === "info" ? null : () => goTab("info"),
    key: "foot-" + rd
  })), keySheet && React.createElement("div", {
    className: "rd-keysheet-scrim",
    onClick: () => setKeySheet(false)
  }, React.createElement("div", {
    className: "rd-keysheet",
    role: "dialog",
    "aria-modal": "true",
    "aria-label": "Keyboard shortcuts",
    tabIndex: -1,
    ref: keySheetEl,
    onClick: e => e.stopPropagation()
  }, React.createElement("div", {
    className: "rd-keysheet-head"
  }, React.createElement("h2", {
    className: "rd-keysheet-t"
  }, "Keyboard shortcuts"), React.createElement("button", {
    type: "button",
    className: "rd-keysheet-x",
    "aria-label": "Close",
    onClick: () => setKeySheet(false)
  }, "\xD7")), React.createElement("dl", {
    className: "rd-keysheet-rows"
  }, KBD_ROWS.map(r => React.createElement("div", {
    className: "rd-keysheet-row",
    key: r.what
  }, React.createElement("dt", null, r.keys.map(k => React.createElement("kbd", {
    className: "rd-keysheet-key",
    key: k
  }, k))), React.createElement("dd", null, r.what)))), React.createElement("p", {
    className: "rd-keysheet-foot"
  }, "Hover gives a card its keys; a live text selection and a blinking caret keep every key quiet."))));
}
const staticSummary = document.querySelector(".static-summary");
if (staticSummary) {
  const appRoot = document.getElementById("root");
  const syncHeights = () => {
    if (!appRoot || !appRoot.offsetHeight) return;
    const appH = appRoot.offsetHeight;
    const se = document.documentElement.style;
    se.setProperty("--app-h", appH + "px");
    se.setProperty("--ss-h", Math.min(staticSummary.scrollHeight, appH) + "px");
  };
  syncHeights();
  new ResizeObserver(syncHeights).observe(staticSummary);
  if (appRoot) new ResizeObserver(syncHeights).observe(appRoot);
  staticSummary.setAttribute("aria-hidden", "true");
  staticSummary.inert = true;
}
try {
  document.body.classList.toggle("rd", new URLSearchParams(window.location.search).get("design") !== "old" || !!window.JUR);
} catch (_) {
  document.body.classList.add("rd");
}
const appRoot = ReactDOM.createRoot(document.getElementById("root"));
ReactDOM.flushSync(() => appRoot.render(React.createElement(RootBoundary, null, React.createElement(App, null))));
if (window.AP_ONEOFF_SRC && window.AUSPOL && typeof window.AUSPOL.loadOneOffs === "function") {
  const prefetchOneOffs = () => {
    try {
      window.AUSPOL.loadOneOffs();
    } catch (_) {}
  };
  if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(prefetchOneOffs, {
    timeout: 3000
  });else window.setTimeout(prefetchOneOffs, 1500);
}