const {
  useState: pubopUseState,
  useEffect: pubopUseEffect,
  useMemo: pubopUseMemo,
  useDeferredValue: pubopUseDeferred
} = React;
const PUBOP_MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pubopDay = iso => Number(iso.slice(8, 10)) + " " + PUBOP_MON[+iso.slice(5, 7) - 1] + " " + iso.slice(0, 4);
const pubopMonth = iso => PUBOP_MON[+iso.slice(5, 7) - 1] + " " + iso.slice(0, 4);
const pubopMonYY = iso => PUBOP_MON[+iso.slice(5, 7) - 1] + " " + iso.slice(2, 4);
const pubopSpan = f => {
  if (!f || !f.end) return "";
  if (!f.start || f.start === f.end) return pubopDay(f.end);
  if (f.start.slice(0, 7) === f.end.slice(0, 7)) return Number(f.start.slice(8)) + "–" + pubopDay(f.end);
  if (f.start.slice(0, 4) === f.end.slice(0, 4)) return Number(f.start.slice(8)) + " " + PUBOP_MON[+f.start.slice(5, 7) - 1] + " – " + pubopDay(f.end);
  return pubopDay(f.start) + " – " + pubopDay(f.end);
};
const pubopN = v => Math.abs(v - Math.round(v)) < 0.05 ? String(Math.round(v)) : (Math.round(v * 10) / 10).toFixed(1);
const pubopPct = v => pubopN(v) + "%";
const pubopSigned = v => (v > 0 ? "+" : v < 0 ? "−" : "") + pubopN(Math.abs(v));
const pubopHouse = (src, houses, full) => houses[src.house] ? houses[src.house][full ? "full" : "short"] : src.house;
const pubopCap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
const pubopWord = n => ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"][n] || String(n);
const pubopNo = i => String(i + 1).padStart(2, "0");
const pubopLow = s => !s || /^(?:Australia|Australian|Labor|Liberal|Coalition|One Nation|Greens|Trump|Albanese|Hanson|I\b)/.test(s) ? s : s.charAt(0).toLowerCase() + s.slice(1);
function PubOpBar({
  segs,
  tall
}) {
  const shown = segs.filter(s => s.v > 0);
  const rest = Math.max(0, 100 - shown.reduce((t, s) => t + s.v, 0));
  const firstB = shown.findIndex(s => s.side === "b");
  const at = firstB < 0 ? shown.length : firstB;
  const seq = rest >= 0.5 ? [...shown.slice(0, at), {
    side: "gap",
    v: rest
  }, ...shown.slice(at)] : shown;
  return React.createElement("span", {
    className: "pubop-bar" + (tall ? " pubop-bar-t" : ""),
    role: "img",
    "aria-label": shown.map(s => pubopPct(s.v) + " " + s.label).join(", ")
  }, seq.map((s, i) => s.side === "gap" ? React.createElement("i", {
    key: i,
    className: "pubop-gap",
    style: {
      width: s.v + "%"
    }
  }) : React.createElement("i", {
    key: i,
    className: "pubop-seg pubop-" + s.side + s.tone,
    style: {
      width: s.v + "%"
    },
    title: pubopPct(s.v) + " " + s.label
  })));
}
function PubOpSwatch({
  side,
  tone
}) {
  return React.createElement("i", {
    className: "pubop-sw pubop-" + side + tone,
    "aria-hidden": "true"
  });
}
function PubOpSplit({
  c
}) {
  const mids = c.segs.filter(s => s.side === "m" && s.v > 0);
  const rest = Math.round(100 - c.a - c.b - c.m - (c.x || 0));
  return React.createElement("div", {
    className: "pubop-split"
  }, React.createElement("div", {
    className: "pubop-ends"
  }, React.createElement("span", {
    className: "pubop-end"
  }, React.createElement(PubOpSwatch, {
    side: "a",
    tone: 2
  }), React.createElement("b", null, pubopPct(c.a)), " ", React.createElement("span", {
    className: "pubop-endl"
  }, c.names[0])), React.createElement("span", {
    className: "pubop-end pubop-end-b"
  }, React.createElement("b", null, pubopPct(c.b)), " ", React.createElement("span", {
    className: "pubop-endl"
  }, c.names[1]), React.createElement(PubOpSwatch, {
    side: "b",
    tone: 2
  }))), React.createElement(PubOpBar, {
    segs: c.segs,
    tall: true
  }), React.createElement("p", {
    className: "pubop-mids"
  }, mids.map((s, i) => React.createElement("span", {
    key: i
  }, pubopPct(s.v), " ", pubopLow(s.label))), c.x >= 1 ? React.createElement("span", null, pubopPct(c.x), " ", pubopLow(c.xLabel || "")) : null, rest >= 3 ? React.createElement("span", null, rest, "% not published") : null), c.sig === false ? React.createElement("p", {
    className: "pubop-level"
  }, "Level: the gap is inside the margin of error.") : null);
}
function PubOpStack({
  c,
  houses
}) {
  const [all, setAll] = pubopUseState(false);
  const rows = c.show && !all ? c.rows.slice(0, c.show) : c.rows;
  return React.createElement("div", {
    className: "pubop-stack"
  }, React.createElement("div", {
    className: "pubop-key"
  }, c.legend.map((l, i) => React.createElement("span", {
    key: i
  }, React.createElement(PubOpSwatch, {
    side: l.side,
    tone: l.tone
  }), l.label)), c.shades ? React.createElement("span", {
    className: "pubop-key-n"
  }, "Stronger answers in full colour, milder ones faded") : null), React.createElement("div", {
    className: "pubop-rows"
  }, rows.map((r, i) => React.createElement("div", {
    className: "pubop-row",
    key: i
  }, React.createElement("div", {
    className: "pubop-rl"
  }, c.mode === "battery" ? React.createElement("span", null, r.label) : React.createElement(React.Fragment, null, React.createElement("span", {
    className: c.mode === "waves" ? "" : "pubop-rh"
  }, r.label || (c.mode === "waves" ? pubopMonth(r.when || r.src.field.end) : pubopHouse(r.src, houses)), c.mode === "compare" && !r.label ? React.createElement("span", {
    className: "pubop-rd"
  }, " \xB7 ", pubopMonth(r.src.field.end)) : null), r.wording ? React.createElement("span", {
    className: "pubop-rw"
  }, r.wording) : null)), React.createElement("span", {
    className: "pubop-va"
  }, pubopN(r.a)), React.createElement(PubOpBar, {
    segs: r.segs
  }), React.createElement("span", {
    className: "pubop-vb"
  }, pubopN(r.b)), React.createElement("span", {
    className: "pubop-net",
    title: r.sig === false ? "The gap is inside the margin of error" : ""
  }, r.sig === false ? "level" : "")))), c.show && c.rows.length > c.show ? React.createElement("button", {
    type: "button",
    className: "pubop-all",
    onClick: () => setAll(!all)
  }, all ? "Show fewer" : "Show all " + c.rows.length) : null);
}
function PubOpRank({
  c
}) {
  const [all, setAll] = pubopUseState(false);
  const top = Math.max(...c.rows.map(r => r.v), 1);
  const rows = !all ? c.rows.slice(0, c.show) : c.rows;
  const tenths = c.rows.some(r => Math.abs(r.v - Math.round(r.v)) >= 0.05);
  return React.createElement("div", {
    className: "pubop-rank"
  }, rows.map((r, i) => React.createElement("div", {
    className: "pubop-rk",
    key: i
  }, React.createElement("span", {
    className: "pubop-rkl"
  }, r.label), React.createElement("span", {
    className: "pubop-rkb"
  }, React.createElement("i", {
    style: {
      width: r.v / Math.max(top, 50) * 100 + "%"
    }
  })), React.createElement("span", {
    className: "pubop-rkv"
  }, tenths ? r.v.toFixed(1) + "%" : pubopPct(r.v)))), c.rows.length > c.show ? React.createElement("button", {
    type: "button",
    className: "pubop-all",
    onClick: () => setAll(!all)
  }, all ? "Show fewer" : "Show all " + c.rows.length) : null, c.base ? React.createElement("p", {
    className: "pubop-base"
  }, c.base) : null);
}
function PubOpNets({
  c
}) {
  const span = Math.max(...c.rows.map(r => Math.abs(r.v)), 10) * 1.2;
  return React.createElement("div", {
    className: "pubop-nets"
  }, c.rows.map((r, i) => React.createElement("div", {
    className: "pubop-nt",
    key: i
  }, React.createElement("span", {
    className: "pubop-ntl"
  }, r.label), React.createElement("span", {
    className: "pubop-ntb"
  }, React.createElement("i", {
    className: r.v >= 0 ? "pubop-a2" : "pubop-b2",
    style: r.v >= 0 ? {
      left: "50%",
      width: r.v / span * 50 + "%"
    } : {
      right: "50%",
      width: -r.v / span * 50 + "%"
    }
  }), React.createElement("b", {
    style: r.v >= 0 ? {
      left: "calc(50% + " + r.v / span * 50 + "% + 6px)"
    } : {
      right: "calc(50% + " + -r.v / span * 50 + "% + 6px)"
    }
  }, pubopSigned(r.v))))), c.unit ? React.createElement("p", {
    className: "pubop-base"
  }, pubopCap(c.unit)) : null);
}
const pubopVal = (v, unit) => v == null ? "–" : unit === "net" ? pubopSigned(v) : unit === "score" ? pubopN(v) : pubopPct(v);
const pubopCols = cols => cols.length > 1 && cols.every(c => /^\d/.test(c) && c.slice(-4) === cols[0].slice(-4)) ? cols.map(c => c.slice(0, -5)) : cols;
const pubopSumUnit = label => /^net\b|\bnet\s|\bchange\b/i.test(label) ? "net" : "%";
const PUBOP_ENT = {
  rsquo: "’",
  lsquo: "‘",
  ldquo: "“",
  rdquo: "”",
  ndash: "–",
  mdash: "—",
  amp: "&",
  nbsp: " "
};
const pubopText = s => String(s || "").replace(/&(\w+);/g, (m, k) => PUBOP_ENT[k] || m);
function PubOpFigHead({
  f,
  solo
}) {
  const t = solo ? null : f.title;
  const line = [f.measure ? pubopCap(f.measure) : null, f.base].filter(Boolean).join(" · ");
  if (!t && !line) return null;
  return React.createElement("div", {
    className: "pubop-gh"
  }, t ? React.createElement("p", {
    className: "pubop-ght"
  }, t) : null, line ? React.createElement("p", {
    className: "pubop-ghb"
  }, line) : null);
}
function PubOpFigList({
  f
}) {
  const multi = f.cols.length > 1;
  const unit = f.unit === "score" ? "score" : "%";
  const scale = unit === "score" ? f.max : Math.max(50, ...f.rows.map(r => r.v[0] || 0));
  const w = v => Math.max(0, Math.min(100, (v || 0) / scale * 100)) + "%";
  return React.createElement("div", {
    className: "pubop-gl" + (multi ? " pubop-gl-m" : ""),
    role: "table",
    "aria-label": f.title || "Answers",
    style: {
      "--pubop-n": f.cols.length
    }
  }, multi ? React.createElement("div", {
    className: "pubop-gr pubop-gr-h",
    role: "row"
  }, React.createElement("span", {
    role: "columnheader",
    className: "pubop-gk"
  }, "Answer"), React.createElement("span", {
    "aria-hidden": "true"
  }), pubopCols(f.cols).map((c, i) => React.createElement("span", {
    key: i,
    role: "columnheader",
    className: "pubop-gv"
  }, c))) : null, f.rows.map((r, i) => React.createElement("div", {
    className: "pubop-gr",
    role: "row",
    key: i
  }, React.createElement("span", {
    role: "rowheader",
    className: "pubop-gk"
  }, r.label), React.createElement("span", {
    className: "pubop-gbar",
    "aria-hidden": "true"
  }, React.createElement("i", {
    style: {
      width: w(r.v[0])
    }
  })), r.v.map((v, k) => React.createElement("span", {
    key: k,
    role: "cell",
    className: "pubop-gv" + (k ? " pubop-gv-o" : "")
  }, pubopVal(v, unit))))), f.sums.map((r, i) => React.createElement("div", {
    className: "pubop-gr pubop-gr-s" + (i ? "" : " pubop-gr-s1"),
    role: "row",
    key: "s" + i
  }, React.createElement("span", {
    role: "rowheader",
    className: "pubop-gk"
  }, r.label), React.createElement("span", {
    "aria-hidden": "true"
  }), r.v.map((v, k) => React.createElement("span", {
    key: k,
    role: "cell",
    className: "pubop-gv" + (k ? " pubop-gv-o" : "")
  }, pubopVal(v, pubopSumUnit(r.label)))))));
}
function PubOpFigNets({
  f
}) {
  return React.createElement(PubOpNets, {
    c: {
      rows: f.rows.map(r => ({
        label: r.label,
        v: r.v[0]
      })),
      unit: null
    }
  });
}
function PubOpFigSplit({
  f
}) {
  const multi = f.cols.length > 1;
  const ex = f.extraHeads;
  const row = (key, label, w) => React.createElement("div", {
    className: "pubop-row" + (label == null ? " pubop-row-1" : ""),
    key: key,
    style: {
      "--pubop-x": ex.length
    }
  }, label != null ? React.createElement("div", {
    className: "pubop-rl"
  }, React.createElement("span", null, label)) : null, React.createElement("span", {
    className: "pubop-va"
  }, pubopN(w.a)), React.createElement(PubOpBar, {
    segs: w.segs
  }), React.createElement("span", {
    className: "pubop-vb"
  }, pubopN(w.b)), w.extra.map((v, k) => React.createElement("span", {
    className: "pubop-vx",
    key: k
  }, pubopVal(v, pubopSumUnit(ex[k])))));
  return React.createElement("div", {
    className: "pubop-stack pubop-gs" + (ex.length ? " pubop-gs-x" : "")
  }, React.createElement("div", {
    className: "pubop-key"
  }, f.legend.map((l, i) => React.createElement("span", {
    key: i
  }, React.createElement(PubOpSwatch, {
    side: l.side,
    tone: l.tone
  }), pubopCap(l.label)))), ex.length ? React.createElement("div", {
    className: "pubop-row pubop-row-h" + (f.one ? " pubop-row-1" : ""),
    style: {
      "--pubop-x": ex.length
    },
    "aria-hidden": "true"
  }, f.one ? null : React.createElement("span", {
    className: "pubop-rlx"
  }), React.createElement("span", null), React.createElement("span", null), React.createElement("span", null), ex.map((h, k) => React.createElement("span", {
    className: "pubop-vx",
    key: k
  }, h))) : null, React.createElement("div", {
    className: "pubop-rows"
  }, f.rows.map((r, i) => multi && r.waves.length > 1 ? React.createElement("div", {
    className: "pubop-sg",
    key: i
  }, React.createElement("p", {
    className: "pubop-sgl"
  }, r.label), r.waves.map((w, k) => row(k, w.when, w))) : row(i, f.one ? null : r.label + (multi ? " · " + r.waves[0].when : ""), r.waves[0]))));
}
function PubOpFigTable({
  f
}) {
  const multi = f.cols.length > 1;
  const heads = f.heads.concat(f.extraHeads);
  const n = f.heads.length;
  const cells = w => w.cells.concat(w.extra).map((v, k) => React.createElement("td", {
    key: k,
    className: k < n ? "" : "pubop-tc-x"
  }, v == null ? "–" : k >= n && pubopSumUnit(heads[k]) === "net" ? pubopSigned(v) : pubopN(v)));
  return React.createElement("div", {
    className: "pubop-twrap"
  }, React.createElement("table", {
    className: "pubop-table pubop-gt"
  }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", {
    className: "pubop-l"
  }), heads.map((h, i) => React.createElement("th", {
    key: i,
    scope: "col"
  }, h)))), React.createElement("tbody", null, f.rows.flatMap((r, i) => r.sect ? [React.createElement("tr", {
    className: "pubop-tsec",
    key: i
  }, React.createElement("th", {
    colSpan: heads.length + 1,
    scope: "colgroup",
    className: "pubop-l"
  }, r.label))] : multi && r.waves.length > 1 ? [React.createElement("tr", {
    className: "pubop-tgrp",
    key: i + "g"
  }, React.createElement("th", {
    colSpan: heads.length + 1,
    scope: "colgroup",
    className: "pubop-l"
  }, r.label)), ...r.waves.map((w, k) => React.createElement("tr", {
    key: i + "-" + k
  }, React.createElement("th", {
    scope: "row",
    className: "pubop-l pubop-twv"
  }, w.when), cells(w)))] : [React.createElement("tr", {
    key: i
  }, React.createElement("th", {
    scope: "row",
    className: "pubop-l"
  }, r.label, multi ? React.createElement("span", {
    className: "pubop-twd"
  }, " \xB7 ", r.waves[0].when) : null), cells(r.waves[0]))]))));
}
const PUBOP_LABOR = /\b(?:Rudd|Gillard|Shorten|Albanese)\b/,
  PUBOP_COAL = /\b(?:Turnbull|Abbott|Morrison|Dutton|Ley|Nelson|Taylor)\b/;
const pubopYear = (label, prev) => {
  const m = String(label).match(/(January|February|March|April|May|June|July|August|September|October|November|December)(?:\s+(\d{4}))?\s*$/);
  if (!m) return null;
  const mo = (PUBOP_MONF.indexOf(m[1]) + 0.5) / 12;
  if (m[2]) return +m[2] + mo;
  if (prev == null) return null;
  const y = Math.floor(prev);
  return y + mo > prev ? y + mo : y + 1 + mo;
};
const PUBOP_MONF = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
function pubopTraitSeries(f) {
  if (f.kind !== "table" || f.heads.length !== 2 || !f.rows.some(r => r.sect)) return null;
  let pair = null;
  const pts = [];
  for (const r of f.rows) {
    if (r.sect) {
      const [a, b] = r.label.split(" v ");
      const pa = PUBOP_LABOR.test(a) ? "alp" : PUBOP_COAL.test(a) ? "lnp" : null;
      const pb = PUBOP_LABOR.test(b) ? "alp" : PUBOP_COAL.test(b) ? "lnp" : null;
      if (!pa || !pb || pa === pb) return null;
      pair = {
        a: [pa, a.replace(/^(?:Mr|Ms|Mrs)\s+/, "")],
        b: [pb, b.replace(/^(?:Mr|Ms|Mrs)\s+/, "")]
      };
      continue;
    }
    const x = pubopYear(r.label, pts.length ? pts[pts.length - 1].x : null);
    if (x == null || !pair) return null;
    const c = r.waves[0].cells;
    pts.push({
      x,
      when: r.label,
      vals: {
        [pair.a[0]]: [c[0], pair.a[1]],
        [pair.b[0]]: [c[1], pair.b[1]]
      }
    });
  }
  return pts.length ? pts : null;
}
function PubOpTraitChart({
  title,
  pts,
  x0,
  x1
}) {
  const W = 260,
    H = 120,
    L = 26,
    R = 30,
    T = 8,
    B = 18;
  const X = x => L + (x - x0) / (x1 - x0) * (W - L - R);
  const Y = v => T + (1 - (v - 20) / 70) * (H - T - B);
  const line = k => {
    let d = "",
      pen = false;
    for (const p of pts) {
      const v = p.vals[k][0];
      if (v == null) {
        pen = false;
        continue;
      }
      d += (pen ? "L" : "M") + X(p.x).toFixed(1) + "," + Y(v).toFixed(1);
      pen = true;
    }
    return d;
  };
  const last = k => [...pts].reverse().find(p => p.vals[k][0] != null);
  return React.createElement("figure", {
    className: "pubop-tr"
  }, React.createElement("figcaption", {
    className: "pubop-trt"
  }, title), React.createElement("svg", {
    viewBox: "0 0 " + W + " " + H,
    role: "img",
    "aria-label": title + ": agreement with the trait, Labor and Coalition leaders, " + Math.floor(x0) + " to " + Math.floor(x1)
  }, [30, 50, 70, 90].map(v => React.createElement("g", {
    key: v
  }, React.createElement("line", {
    x1: L,
    x2: W - R,
    y1: Y(v),
    y2: Y(v),
    className: "pubop-trg"
  }), React.createElement("text", {
    x: L - 5,
    y: Y(v) + 3.5,
    className: "pubop-trax",
    textAnchor: "end"
  }, v))), [2010, 2015, 2020, 2025].filter(y => y >= x0 && y <= x1).map(y => React.createElement("text", {
    key: y,
    x: X(y),
    y: H - 4,
    className: "pubop-trax",
    textAnchor: "middle"
  }, y)), ["lnp", "alp"].map(k => React.createElement("path", {
    key: k,
    d: line(k),
    className: "pubop-trl pubop-trl-" + k
  })), ["lnp", "alp"].map(k => pts.map((p, i) => p.vals[k][0] == null ? null : React.createElement("circle", {
    key: k + i,
    cx: X(p.x),
    cy: Y(p.vals[k][0]),
    r: 2.2,
    className: "pubop-trd pubop-trl-" + k
  }, React.createElement("title", null, p.vals[k][1] + ", " + p.when + ": " + p.vals[k][0] + "%")))), ["alp", "lnp"].map(k => {
    const p = last(k);
    return p ? React.createElement("text", {
      key: "e" + k,
      x: X(p.x) + 5,
      y: Y(p.vals[k][0]) + 3.5,
      className: "pubop-trv"
    }, p.vals[k][0]) : null;
  })));
}
function PubOpTraits({
  figs
}) {
  const all = figs.map(f => ({
    f,
    pts: pubopTraitSeries(f)
  }));
  const xs = all.flatMap(a => a.pts.map(p => p.x));
  const x0 = Math.min(...xs) - 0.3,
    x1 = Math.max(...xs) + 0.3;
  const measure = figs[0].measure;
  return React.createElement("div", {
    className: "pubop-fig"
  }, React.createElement("div", {
    className: "pubop-gh"
  }, React.createElement("p", {
    className: "pubop-ghb"
  }, (measure ? pubopCap(measure) + ", %, " : "") + "for each trait"), React.createElement("p", {
    className: "pubop-fams"
  }, React.createElement("span", null, React.createElement("i", {
    className: "pubop-wsw pubop-trs-alp",
    "aria-hidden": "true"
  }), "Labor leader (Rudd, Gillard, Shorten, Albanese)"), React.createElement("span", null, React.createElement("i", {
    className: "pubop-wsw pubop-trs-lnp",
    "aria-hidden": "true"
  }), "Coalition leader (Turnbull, Abbott, Morrison, Dutton, Ley)"))), React.createElement("div", {
    className: "pubop-trs"
  }, all.map((a, i) => React.createElement(PubOpTraitChart, {
    key: i,
    title: a.f.title,
    pts: a.pts,
    x0: x0,
    x1: x1
  }))), React.createElement("details", {
    className: "pubop-cuts"
  }, React.createElement("summary", null, "The figures, poll by poll"), figs.map((f, i) => React.createElement("div", {
    className: "pubop-cut",
    key: i
  }, React.createElement("p", {
    className: "pubop-cutt"
  }, f.title), React.createElement(PubOpFigTable, {
    f: f
  })))));
}
function PubOpFig({
  f,
  solo
}) {
  const body = f.kind === "list" ? React.createElement(PubOpFigList, {
    f: f
  }) : f.kind === "nets" ? React.createElement(PubOpFigNets, {
    f: f
  }) : f.kind === "split" ? React.createElement(PubOpFigSplit, {
    f: f
  }) : React.createElement(PubOpFigTable, {
    f: f
  });
  return React.createElement("div", {
    className: "pubop-fig pubop-fig-" + f.kind
  }, React.createElement(PubOpFigHead, {
    f: f,
    solo: solo
  }), body);
}
const pubopCutsLabel = cuts => {
  const bs = [...new Set(cuts.flatMap(c => (c.banners || []).filter(Boolean)))];
  if (!bs.length || bs.length > 4) return "By group";
  const w = bs.map(pubopLow);
  return "By " + (w.length < 2 ? w[0] : w.slice(0, -1).join(", ") + " and " + w[w.length - 1]);
};
function PubOpCut({
  c
}) {
  const v = x => x == null ? "–" : pubopN(x);
  if (c.down) {
    const span = c.heads.length + 1;
    return React.createElement("div", {
      className: "pubop-cut"
    }, c.title ? React.createElement("p", {
      className: "pubop-cutt"
    }, c.title) : null, React.createElement("div", {
      className: "pubop-twrap"
    }, React.createElement("table", {
      className: "pubop-table"
    }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", {
      className: "pubop-l"
    }), c.heads.map((h, i) => React.createElement("th", {
      key: i,
      scope: "col"
    }, h)))), React.createElement("tbody", null, c.rows.flatMap((r, i) => {
      const b = c.banners && c.banners[i];
      const head = b && (!i || c.banners[i - 1] !== b) ? [React.createElement("tr", {
        className: "pubop-tsec",
        key: "b" + i
      }, React.createElement("th", {
        colSpan: span,
        scope: "colgroup",
        className: "pubop-l"
      }, b))] : [];
      return head.concat(React.createElement("tr", {
        key: i
      }, React.createElement("th", {
        scope: "row",
        className: "pubop-l"
      }, r[0]), r.slice(1).map((x, k) => React.createElement("td", {
        key: k
      }, v(x)))));
    })))));
  }
  const runs = [];
  (c.banners || c.heads.map(() => null)).forEach((b, k) => {
    const last = runs[runs.length - 1];
    if (last && last.b === b) last.n++;else runs.push({
      b,
      n: 1,
      k
    });
  });
  const banner = runs.some(r => r.b);
  return React.createElement("div", {
    className: "pubop-cut"
  }, c.title ? React.createElement("p", {
    className: "pubop-cutt"
  }, c.title) : null, React.createElement("div", {
    className: "pubop-twrap"
  }, React.createElement("table", {
    className: "pubop-table"
  }, React.createElement("thead", null, banner ? React.createElement("tr", {
    className: "pubop-tban"
  }, React.createElement("th", {
    className: "pubop-l"
  }), runs.map((r, i) => React.createElement("th", {
    key: i,
    colSpan: r.n,
    scope: "colgroup"
  }, r.b || ""))) : null, React.createElement("tr", null, React.createElement("th", {
    className: "pubop-l"
  }), c.heads.map((h, i) => React.createElement("th", {
    key: i,
    scope: "col",
    className: (runs.some(r => r.k === i && i) ? "pubop-tb0" : "") + (h.length <= 7 ? " pubop-nw" : "")
  }, h)))), React.createElement("tbody", null, c.rows.map((r, i) => React.createElement("tr", {
    key: i
  }, React.createElement("th", {
    scope: "row",
    className: "pubop-l"
  }, r[0]), r.slice(1).map((x, k) => React.createElement("td", {
    key: k,
    className: runs.some(q => q.k === k && k) ? "pubop-tb0" : ""
  }, v(x)))))))));
}
function PubOpCuts({
  cuts,
  when
}) {
  if (!cuts || !cuts.length) return null;
  return React.createElement("details", {
    className: "pubop-cuts"
  }, React.createElement("summary", null, pubopCutsLabel(cuts), when ? React.createElement("span", null, " \xB7 ", when) : null), cuts.map((c, i) => React.createElement(PubOpCut, {
    key: i,
    c: c
  })));
}
function PubOpSource({
  src,
  houses,
  question
}) {
  return React.createElement("div", {
    className: "pubop-src"
  }, React.createElement("span", {
    className: "pubop-src-l"
  }, React.createElement("b", null, pubopHouse(src, houses, true)), React.createElement("span", null, pubopSpan(src.field)), src.n ? React.createElement("span", null, src.n.toLocaleString("en-AU"), " people") : null, src.url ? React.createElement("a", {
    href: src.url,
    target: "_blank",
    rel: "noopener"
  }, "Source \u2197") : null), question ? React.createElement("details", {
    className: "pubop-wd"
  }, React.createElement("summary", null, "The question as asked"), React.createElement("p", null, question)) : null);
}
function PubOpSources({
  c,
  houses
}) {
  const seen = new Set();
  const links = (c.rows || []).filter(r => r.src && r.src.url && !seen.has(r.src.url) && seen.add(r.src.url));
  return React.createElement("div", {
    className: "pubop-src"
  }, React.createElement("span", {
    className: "pubop-src-l"
  }, c.mode === "waves" ? React.createElement("b", null, pubopHouse(c.src || c.rows[0].src, houses, true)) : null, links.length ? React.createElement("span", {
    className: "pubop-srcs"
  }, "Sources: ", links.map((r, i) => React.createElement("a", {
    key: i,
    href: r.src.url,
    target: "_blank",
    rel: "noopener"
  }, c.mode === "waves" ? pubopMonth(r.src.field.end) : pubopHouse(r.src, houses) + " " + pubopMonth(r.src.field.end), " \u2197"))) : null));
}
function PubOpWaves({
  q,
  houses
}) {
  const asked = [...new Set(q.srcs.map(s => s.question).filter(Boolean))];
  return React.createElement("div", {
    className: "pubop-src"
  }, React.createElement("b", {
    className: "pubop-srch"
  }, pubopHouse(q, houses, true)), React.createElement("ul", {
    className: "pubop-srcw"
  }, q.srcs.map((s, i) => React.createElement("li", {
    key: i
  }, React.createElement("span", null, pubopSpan(s.field)), s.n ? React.createElement("span", null, s.n.toLocaleString("en-AU"), " people") : null, s.url ? React.createElement("a", {
    href: s.url,
    target: "_blank",
    rel: "noopener"
  }, "Source \u2197") : null))), asked.length ? React.createElement("details", {
    className: "pubop-wd"
  }, React.createElement("summary", null, asked.length > 1 ? "The questions as asked" : "The question as asked"), asked.map((x, i) => React.createElement("p", {
    key: i
  }, x))) : null);
}
function PubOpItem({
  c,
  houses,
  topic
}) {
  const body = c.kind === "split" ? React.createElement(PubOpSplit, {
    c: c
  }) : c.kind === "stack" ? React.createElement(PubOpStack, {
    c: c,
    houses: houses
  }) : c.kind === "rank" ? React.createElement(PubOpRank, {
    c: c
  }) : c.kind === "nets" ? React.createElement(PubOpNets, {
    c: c
  }) : null;
  return React.createElement("article", {
    className: "pubop-item pubop-k-" + c.kind
  }, React.createElement("div", {
    className: "pubop-il"
  }, topic ? React.createElement("p", {
    className: "pubop-qt"
  }, topic) : null, React.createElement("h4", {
    className: "pubop-q"
  }, c.title), c.summary ? React.createElement("p", {
    className: "pubop-sum"
  }, c.summary) : null, c.note ? React.createElement("p", {
    className: "pubop-note"
  }, c.note) : null, c.src && c.src.field ? React.createElement(PubOpSource, {
    src: c.src,
    houses: houses,
    question: c.question
  }) : React.createElement(PubOpSources, {
    c: c,
    houses: houses
  })), React.createElement("div", {
    className: "pubop-ir"
  }, body, React.createElement(PubOpCuts, {
    cuts: c.cuts,
    when: null
  })));
}
function PubOpTracker({
  c,
  houses,
  topic
}) {
  const narrow = useNarrow(MQ_PHONE);
  const net = c.measure === "net";
  const pts = c.panels.flatMap(p => p.points.map(q => ({
    ...q,
    house: p.house,
    fam: p.fam
  })));
  const x0 = Math.min(...pts.map(q => q.x)) - 0.06;
  const x1 = Math.max(...pts.map(q => q.x)) + 0.06;
  const [lo, hi] = c.yDomain;
  const step = c.yStep || (hi - lo > 50 ? 25 : 10);
  const ticks = [];
  for (let y = Math.floor(x0); y <= Math.ceil(x1); y++) {
    for (const m of [0, 6]) {
      const x = y + m / 12;
      if (x >= x0 && x <= x1) ticks.push({
        x,
        label: PUBOP_MON[m] + " " + String(y).slice(2)
      });
    }
  }
  const fmt = v => net ? pubopSigned(v) : pubopPct(v);
  const yt = [];
  for (let v = lo + step; v <= hi + 1e-9; v += step) yt.push(v);
  const ink = f => "var(--pubop-w" + f + ")";
  const fams = c.families.map((label, i) => ({
    label,
    i
  })).filter(f => c.panels.some(p => p.fam === f.i));
  const spine = [...new Set(pts.map(q => q.x))].sort((p, q) => p - q).map(x => ({
    x,
    y: pts.find(q => q.x === x).v
  }));
  const at = i => spine[i] ? pts.filter(q => q.x === spine[i].x) : [];
  const latest = c.panels.map(p => ({
    p,
    q: p.points[p.points.length - 1]
  })).sort((a, b) => b.q.x - a.q.x);
  const rows = pts.slice().sort((p, q) => q.x - p.x);
  return React.createElement("div", {
    className: "pubop-tracker"
  }, topic ? React.createElement("p", {
    className: "pubop-qt"
  }, topic) : null, React.createElement("p", {
    className: "pubop-tlab"
  }, c.title), React.createElement("p", {
    className: "pubop-tdek"
  }, c.dek), React.createElement("p", {
    className: "pubop-fams"
  }, fams.map(f => React.createElement("span", {
    key: f.i
  }, React.createElement("i", {
    className: "pubop-wsw pubop-w" + f.i,
    "aria-hidden": "true"
  }), f.label))), React.createElement("div", {
    className: "pubop-tbody"
  }, React.createElement("div", {
    className: "pubop-tchart"
  }, React.createElement("div", {
    className: "card rd-card pubop-chart"
  }, React.createElement(TrendChart, {
    key: "pubop-" + c.id,
    heightPx: narrow ? 250 : 320,
    padPx: {
      l: 34,
      r: 8,
      t: 20,
      b: 22
    },
    xDomain: [x0, x1],
    yDomain: [lo, hi],
    yTicks: yt,
    yTickFmt: () => "",
    xTicks: ticks,
    baseline: true,
    notes: yt.map(v => ({
      x: "left",
      y: v,
      dy: -3,
      text: net ? v === 0 ? "Even" : pubopSigned(v) : v + (v === hi ? "%" : ""),
      size: 10.5,
      cls: "pubop-ylab"
    })),
    refLines: c.ref != null ? [{
      y: c.ref,
      label: "",
      color: "var(--ink-faint)"
    }] : [],
    series: c.panels.map(p => ({
      id: p.house,
      label: pubopHouse(p, houses),
      color: ink(p.fam),
      rdWidth: 2,
      smooth: false,
      endLabel: pubopHouse(p, houses),
      points: p.points.map(q => ({
        x: q.x,
        y: q.v
      }))
    })),
    spine: spine,
    pollFacet: m => m.facet || null,
    scatter: pts.map(q => ({
      x: q.x,
      y: q.v,
      color: ink(q.fam),
      label: net ? "Net" : pubopCap(c.names[0]),
      meta: q.rk ? {
        pollster: q.rk.split("|")[0],
        released: q.rk.split("|")[1],
        facet: q.fk,
        dateLabel: pubopSpan(q.field),
        sample: q.n
      } : {
        pollster: pubopHouse(q, houses, true),
        dateLabel: pubopSpan(q.field),
        sample: q.n
      }
    })),
    tooltipTitle: i => {
      const qs = at(i);
      return qs.length === 1 ? pubopSpan(qs[0].field) : qs.length ? pubopDay(qs[0].field.end) : "";
    },
    extraRows: i => {
      const qs = at(i);
      return qs.flatMap(q => {
        const pre = qs.length > 1 ? pubopHouse(q, houses) + ": " : "";
        return net ? [{
          label: pre + pubopCap(c.names[0]),
          value: pubopPct(q.a)
        }, {
          label: pre + pubopCap(c.names[1]),
          value: pubopPct(q.b)
        }] : [{
          label: pre + pubopCap(c.names[1]),
          value: pubopPct(q.b)
        }];
      });
    },
    fmt: fmt,
    copy: {
      title: c.title,
      sub: c.head + "." + (c.note ? " " + c.note : ""),
      span: pubopMonYY(c.first) + " – " + pubopMonYY(c.last),
      caption: "Each dot is one poll; a line joins one pollster’s own readings, coloured by how it asked.",
      legend: fams.map(f => ({
        label: f.label,
        color: ink(f.i),
        kind: "line"
      })).concat(c.ref != null ? [{
        label: c.refLabel,
        color: "var(--ink-faint)",
        kind: "dashed"
      }] : [])
    }
  }), React.createElement("p", {
    className: "rd-ckey pubop-tkey"
  }, React.createElement("span", null, React.createElement("i", {
    className: "pubop-dot",
    "aria-hidden": "true"
  }), "One poll"), React.createElement("span", null, React.createElement("i", {
    className: "pubop-ln",
    "aria-hidden": "true"
  }), "One pollster\u2019s readings, joined"), c.ref != null ? React.createElement("span", null, React.createElement("i", {
    className: "pubop-rl0",
    "aria-hidden": "true"
  }), c.refLabel) : null)), c.note ? React.createElement("p", {
    className: "pubop-note"
  }, c.note) : null), React.createElement("aside", {
    className: "pubop-latest",
    "aria-label": "Latest from each pollster"
  }, React.createElement("p", {
    className: "pubop-lh"
  }, "Latest from each pollster"), React.createElement("ul", {
    className: "pubop-ll"
  }, latest.map(({
    p,
    q
  }) => React.createElement("li", {
    key: p.house
  }, React.createElement("span", {
    className: "pubop-lp"
  }, React.createElement("span", {
    className: "pubop-lnm"
  }, React.createElement("i", {
    className: "pubop-ldot pubop-w" + p.fam,
    "aria-hidden": "true"
  }), pubopHouse(p, houses), React.createElement("span", {
    className: "pubop-ld"
  }, pubopDay(q.field.end))), React.createElement("span", {
    className: "pubop-lq"
  }, p.label)), React.createElement("b", {
    className: "pubop-lv"
  }, fmt(q.v))))))), React.createElement("details", {
    className: "pubop-ledger"
  }, React.createElement("summary", null, "All ", rows.length, " readings"), React.createElement("div", {
    className: "pubop-twrap"
  }, React.createElement("table", {
    className: "pubop-table"
  }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", {
    className: "pubop-l"
  }, "Pollster"), React.createElement("th", {
    className: "pubop-l"
  }, "Fieldwork"), React.createElement("th", null, "Sample"), React.createElement("th", null, c.cols[0]), React.createElement("th", null, c.cols[1]), React.createElement("th", null, c.cols[2]), net ? React.createElement("th", null, "Net") : null, React.createElement("th", null))), React.createElement("tbody", null, rows.map((q, i) => React.createElement("tr", {
    key: i
  }, React.createElement("td", {
    className: "pubop-l"
  }, pubopHouse(q, houses)), React.createElement("td", {
    className: "pubop-l"
  }, pubopSpan(q.field)), React.createElement("td", null, q.n ? q.n.toLocaleString("en-AU") : "–"), React.createElement("td", null, pubopN(q.a)), React.createElement("td", null, pubopN(q.m)), React.createElement("td", null, pubopN(q.b)), net ? React.createElement("td", null, React.createElement("b", null, pubopSigned(q.v))) : null, React.createElement("td", null, q.url ? React.createElement("a", {
    href: q.url,
    target: "_blank",
    rel: "noopener"
  }, "Source \u2197") : null))))))));
}
const pubopHasWave = (q, wv) => !!wv && (q.srcs || []).some(s => s && s.wave === wv);
const pubopOpenOnce = el => {
  if (el && !el.open) el.open = true;
};
function PubOpMore({
  label,
  qs,
  houses,
  meta,
  wv
}) {
  const hit = !!wv && qs.some(q => pubopHasWave(q, wv));
  return React.createElement("details", {
    className: "pubop-more",
    ref: hit ? pubopOpenOnce : null
  }, React.createElement("summary", null, label, React.createElement("span", null, " \xB7 ", qs.length)), React.createElement("ul", {
    className: "pubop-ml"
  }, qs.map(q => {
    const wh = pubopHasWave(q, wv);
    return React.createElement("li", {
      key: q.id + q.house,
      className: wh ? "pubop-wvh" : null
    }, React.createElement("details", {
      className: "pubop-mi",
      ref: wh ? pubopOpenOnce : null
    }, React.createElement("summary", null, React.createElement("span", {
      className: "pubop-mq"
    }, q.title), React.createElement("span", {
      className: "pubop-mm"
    }, wh ? React.createElement("em", {
      className: "pubop-wvh-t"
    }, "this poll") : null, meta(q))), React.createElement("div", {
      className: "pubop-mb"
    }, React.createElement("div", {
      className: "pubop-il"
    }, React.createElement(PubOpWaves, {
      q: q,
      houses: houses
    })), React.createElement("div", {
      className: "pubop-ir"
    }, q.figs.length > 1 && q.figs.every(f => pubopTraitSeries(f)) ? React.createElement(PubOpTraits, {
      figs: q.figs
    }) : q.figs.map((f, i) => React.createElement(PubOpFig, {
      key: i,
      f: f,
      solo: q.figs.length === 1
    })), q.prose.map((p, i) => React.createElement("div", {
      className: "pubop-fig",
      key: "p" + i
    }, q.prose.length > 1 || q.figs.length ? React.createElement("p", {
      className: "pubop-ght"
    }, p.when) : null, React.createElement("blockquote", {
      className: "pubop-prose"
    }, pubopText(p.text.join(" "))))), React.createElement(PubOpCuts, {
      cuts: q.cuts,
      when: q.srcs.length > 1 ? q.cutsWhen : null
    })))));
  })));
}
const pubopCount = (trackers, items, more) => [trackers ? trackers === 1 ? "One chart" : pubopCap(pubopWord(trackers)) + " charts" : null, items ? items + (items === 1 ? " question" : " questions") : null, more ? more + " more" : null].filter(Boolean).join(" · ");
function PubOpTopic({
  t,
  n,
  houses
}) {
  const g = pubopSplitKinds(pubopDated([t]));
  const count = pubopCount(g.trackers.length, g.items.length, g.more.length);
  return React.createElement("section", {
    className: "pubop-topic",
    id: "pubop-" + t.id,
    "aria-labelledby": "pubop-h-" + t.id
  }, React.createElement("div", {
    className: "pubop-tk"
  }, React.createElement("h3", {
    className: "pubop-tt",
    id: "pubop-h-" + t.id
  }, React.createElement("span", {
    className: "pubop-tn"
  }, n), t.title), React.createElement("span", {
    className: "pubop-tc"
  }, count)), t.finding ? React.createElement("p", {
    className: "pubop-hl"
  }, t.finding.text) : null, React.createElement("p", {
    className: "pubop-tdk"
  }, t.dek), g.trackers.map(e => React.createElement(PubOpTracker, {
    key: e.b.id,
    c: e.b,
    houses: houses
  })), React.createElement(PubOpEntries, {
    entries: g.items,
    houses: houses
  }), g.more.length ? React.createElement(PubOpMore, {
    label: "More questions on " + (t.about || t.title),
    qs: g.more.map(e => e.q),
    houses: houses,
    meta: q => pubopHouse(q, houses) + " · " + pubopMonth(q.last) + (q.srcs.length > 1 ? " · " + q.srcs.length + " readings" : "")
  }) : null);
}
const pubopLast = b => b.kind === "tracker" ? b.last : b.src && b.src.field ? b.src.field.end : (b.rows || []).reduce((d, r) => r.src && r.src.field && r.src.field.end > d ? r.src.field.end : d, "");
const pubopHousesOf = b => b.kind === "tracker" ? [...new Set(b.panels.map(p => p.house))] : b.src && b.src.house ? [b.src.house] : [...new Set((b.rows || []).map(r => r.src && r.src.house).filter(Boolean))];
function pubopDated(topics) {
  const all = [];
  topics.forEach(t => {
    t.blocks.forEach(b => all.push({
      t,
      b,
      date: pubopLast(b)
    }));
    t.more.forEach(q => all.push({
      t,
      q,
      date: q.last
    }));
  });
  return all.sort((p, q) => p.date < q.date ? 1 : p.date > q.date ? -1 : 0);
}
const PUBOP_LATEST = 6;
function pubopSplitKinds(all, chronological = false) {
  const questions = all.filter(e => e.q || e.b.kind !== "tracker");
  const cutoff = questions[Math.min(PUBOP_LATEST, questions.length) - 1]?.date || "";
  const entries = all.filter(e => e.b || chronological || e.date >= cutoff);
  return {
    entries,
    trackers: entries.filter(e => e.b && e.b.kind === "tracker"),
    items: entries.filter(e => e.q || e.b.kind !== "tracker"),
    more: all.filter(e => e.q && !chronological && e.date < cutoff)
  };
}
function PubOpEntries({
  entries,
  houses,
  topics,
  wv
}) {
  if (!entries.length) return null;
  return React.createElement("div", {
    className: "pubop-items"
  }, entries.map((e, i) => {
    const topic = topics ? e.t.short : null;
    return e.q ? React.createElement(PubOpQuestion, {
      key: e.q.id + "|" + e.q.house,
      m: e.q,
      houses: houses,
      topic: topic,
      wv: wv
    }) : e.b.kind === "tracker" ? React.createElement(PubOpTracker, {
      key: e.b.id,
      c: e.b,
      houses: houses,
      topic: topic
    }) : React.createElement(PubOpItem, {
      key: (e.b.id || "") + i,
      c: e.b,
      houses: houses,
      topic: topic
    });
  }));
}
function pubopByMonth(topics) {
  const months = [];
  for (const e of pubopDated(topics)) {
    const ym = e.date.slice(0, 7);
    if (!months.length || months[months.length - 1].ym !== ym) months.push({
      ym,
      all: []
    });
    months[months.length - 1].all.push(e);
  }
  return months.map(m => {
    const title = PUBOP_MONF[+m.ym.slice(5, 7) - 1] + " " + m.ym.slice(0, 4);
    return {
      id: "m-" + m.ym,
      title,
      ...pubopSplitKinds(m.all, true)
    };
  });
}
function pubopByPollster(topics, houses) {
  const own = new Map(),
    also = new Map(),
    several = [];
  for (const e of pubopDated(topics)) {
    const hs = e.q ? [e.q.house] : pubopHousesOf(e.b);
    if (hs.length === 1) {
      if (!own.has(hs[0])) own.set(hs[0], []);
      own.get(hs[0]).push(e);
    } else {
      several.push(e);
      hs.forEach(h => also.set(h, (also.get(h) || 0) + 1));
    }
  }
  const name = h => pubopHouse({
    house: h
  }, houses);
  const ids = [...new Set([...own.keys(), ...also.keys()])].sort((p, q) => (own.get(q) || []).length - (own.get(p) || []).length || (also.get(q) || 0) - (also.get(p) || 0) || name(p).localeCompare(name(q)));
  const groups = ids.map(h => {
    const n = also.get(h) || 0,
      mine = own.get(h) || [];
    const cmp = pubopWord(n) + (n === 1 ? " comparison" : " comparisons") + " with other pollsters";
    return {
      id: "p-" + h,
      title: pubopHouse({
        house: h
      }, houses, true),
      moreLabel: "More questions from " + name(h),
      lead: n ? React.createElement("p", {
        className: "pubop-tdk"
      }, mine.length ? "Also in " : "Only in ", React.createElement("a", {
        href: "#pubop-p-several"
      }, cmp), ".") : null,
      ...pubopSplitKinds(mine)
    };
  });
  if (several.length) groups.push({
    id: "p-several",
    title: "Several pollsters",
    moreLabel: "",
    lead: React.createElement("p", {
      className: "pubop-tdk"
    }, "Charts and questions that set two or more pollsters side by side."),
    ...pubopSplitKinds(several)
  });
  return groups;
}
function PubOpGroup({
  g,
  houses,
  byHouse,
  wv
}) {
  const topicOf = new Map(g.more.map(e => [e.q, e.t]));
  const count = pubopCount(g.trackers.length, g.items.length, g.more.length);
  return React.createElement("section", {
    className: "pubop-topic pubop-mon",
    id: "pubop-" + g.id,
    "aria-labelledby": "pubop-h-" + g.id
  }, React.createElement("div", {
    className: "pubop-tk"
  }, React.createElement("h3", {
    className: "pubop-tt",
    id: "pubop-h-" + g.id
  }, g.title), count ? React.createElement("span", {
    className: "pubop-tc"
  }, count) : null), g.lead || null, React.createElement(PubOpEntries, {
    entries: g.entries,
    houses: houses,
    topics: true,
    wv: byHouse ? wv : null
  }), g.more.length ? React.createElement(PubOpMore, {
    label: g.moreLabel,
    qs: g.more.map(e => e.q),
    houses: houses,
    wv: wv,
    meta: q => topicOf.get(q).short + (byHouse ? "" : " · " + pubopHouse(q, houses)) + " · " + pubopDay(q.last) + (q.srcs.length > 1 ? " · " + q.srcs.length + " readings" : "")
  }) : null);
}
const PUBOP_SORTS = [{
  id: "issue",
  label: "By issue"
}, {
  id: "pollster",
  label: "By pollster"
}, {
  id: "recent",
  label: "By recency"
}];
function PubOpSort({
  sort,
  onSort
}) {
  const sortSwipeLive = React.useRef(null);
  sortSwipeLive.current = dir => {
    const i = PUBOP_SORTS.findIndex(o => o.id === sort);
    if (i < 0) return false;
    onSort(PUBOP_SORTS[(i + dir + PUBOP_SORTS.length) % PUBOP_SORTS.length].id);
    return true;
  };
  const sortSwipe = React.useCallback(el => {
    if (el) el.__rdSwipe = dir => sortSwipeLive.current(dir);
  }, []);
  const sortHover = React.useRef(false);
  React.useEffect(() => {
    const sec = document.getElementById("public-opinion");
    if (!sec) return undefined;
    const enter = () => {
      sortHover.current = true;
    };
    const leave = () => {
      sortHover.current = false;
    };
    sortHover.current = sec.matches(":hover");
    sec.addEventListener("pointerenter", enter);
    sec.addEventListener("pointerleave", leave);
    const key = e => {
      if (!sortHover.current || e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const a = document.activeElement;
      if (a && a.tagName !== "BODY" && a.tagName !== "HTML") return;
      const sel = window.getSelection && window.getSelection();
      if (sel && !sel.isCollapsed) return;
      if (!sortSwipeLive.current(e.key === "ArrowRight" ? 1 : -1)) return;
      e.preventDefault();
    };
    document.addEventListener("keydown", key, true);
    return () => {
      sec.removeEventListener("pointerenter", enter);
      sec.removeEventListener("pointerleave", leave);
      document.removeEventListener("keydown", key, true);
    };
  }, []);
  return React.createElement("div", {
    className: "pubop-sort"
  }, React.createElement("span", {
    className: "pubop-sort-l",
    id: "pubop-sort-l"
  }, "Sort"), React.createElement("div", {
    className: "pubop-sort-g",
    role: "group",
    "aria-labelledby": "pubop-sort-l",
    ref: sortSwipe,
    "data-rd-swipe": "",
    onKeyDown: rdTabsKey(PUBOP_SORTS, onSort),
    onClick: rdTabFocus
  }, PUBOP_SORTS.map(o => React.createElement("button", {
    key: o.id,
    type: "button",
    className: "pubop-sort-b",
    "aria-pressed": sort === o.id,
    onClick: () => onSort(o.id)
  }, React.createElement("span", {
    className: "pubop-sort-w",
    "data-t": o.label
  }, o.label)))));
}
const pubopPushW = (parts, s) => {
  if (s) parts.push(String(s));
};
const pubopSegsW = (segs, parts) => (segs || []).forEach(s => pubopPushW(parts, s.label));
const pubopRowsW = (rows, parts) => (rows || []).forEach(r => {
  pubopPushW(parts, r.label);
  pubopPushW(parts, r.wording);
  pubopSegsW(r.segs, parts);
  (r.waves || []).forEach(w => pubopSegsW(w.segs, parts));
});
const pubopCutsW = (cuts, parts) => (cuts || []).forEach(c => {
  pubopPushW(parts, c.title);
  (c.heads || []).forEach(h => parts.push(String(h)));
  (c.banners || []).forEach(b => pubopPushW(parts, b));
  (c.rows || []).forEach(r => r.length && pubopPushW(parts, r[0]));
});
const pubopFigsW = (figs, parts) => (figs || []).forEach(f => {
  [f.title, f.measure, f.base].forEach(s => pubopPushW(parts, s));
  (f.heads || []).concat(f.extraHeads || []).forEach(h => parts.push(String(h)));
  (f.legend || []).forEach(l => pubopPushW(parts, l.label));
  pubopRowsW(f.rows, parts);
  (f.sums || []).forEach(r => pubopPushW(parts, r.label));
});
const pubopBlockW = b => {
  const parts = [];
  [b.title, b.summary, b.note, b.question, b.xLabel, b.base].forEach(s => pubopPushW(parts, s));
  (b.names || []).forEach(s => pubopPushW(parts, s));
  (b.legend || []).forEach(l => pubopPushW(parts, l.label));
  pubopSegsW(b.segs, parts);
  pubopRowsW(b.rows, parts);
  pubopCutsW(b.cuts, parts);
  if (b.kind === "tracker") {
    [b.dek, b.head, b.refLabel].forEach(s => pubopPushW(parts, s));
    (b.families || []).forEach(s => parts.push(String(s)));
    (b.cols || []).forEach(s => parts.push(String(s)));
    (b.panels || []).forEach(p => pubopPushW(parts, p.label));
  }
  return parts.join(" ").toLowerCase();
};
const pubopMoreW = m => {
  const parts = [String(m.title || "")];
  (m.srcs || []).forEach(s => pubopPushW(parts, s.question));
  pubopFigsW(m.figs, parts);
  (m.prose || []).forEach(p => parts.push(pubopText((p.text || []).join(" "))));
  pubopCutsW(m.cuts, parts);
  return parts.join(" ").toLowerCase();
};
const pubopHayMirror = words => words + " " + words.replace(/–/g, "-");
function PubOpSearch({
  q,
  onQ
}) {
  return React.createElement("label", {
    className: "pubop-search"
  }, React.createElement("svg", {
    viewBox: "0 0 24 24",
    width: "15",
    height: "15",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    "aria-hidden": "true"
  }, React.createElement("circle", {
    cx: "11",
    cy: "11",
    r: "7"
  }), React.createElement("path", {
    d: "M21 21l-4.3-4.3"
  })), React.createElement("input", {
    type: "search",
    value: q,
    onChange: e => onQ(e.target.value),
    autoCorrect: "off",
    spellCheck: false,
    placeholder: "Search a question or its answers",
    "aria-label": "Search the questions"
  }), q ? React.createElement("button", {
    type: "button",
    className: "pubop-x",
    onClick: () => onQ(""),
    "aria-label": "Clear search"
  }, "\xD7") : null);
}
function PubOpQuestion({
  m,
  houses,
  topic,
  wv
}) {
  const hit = pubopHasWave(m, wv);
  return React.createElement("article", {
    className: "pubop-item pubop-auto" + (hit ? " pubop-wvh" : "")
  }, React.createElement("div", {
    className: "pubop-il"
  }, topic ? React.createElement("p", {
    className: "pubop-qt"
  }, topic) : null, hit ? React.createElement("em", {
    className: "pubop-wvh-t"
  }, "this poll") : null, React.createElement("h4", {
    className: "pubop-q"
  }, m.title), React.createElement(PubOpWaves, {
    q: m,
    houses: houses
  })), React.createElement("div", {
    className: "pubop-ir"
  }, m.figs.length > 1 && m.figs.every(f => pubopTraitSeries(f)) ? React.createElement(PubOpTraits, {
    figs: m.figs
  }) : m.figs.map((f, i) => React.createElement(PubOpFig, {
    key: i,
    f: f,
    solo: m.figs.length === 1
  })), m.prose.map((p, i) => React.createElement("div", {
    className: "pubop-fig",
    key: "p" + i
  }, m.prose.length > 1 || m.figs.length ? React.createElement("p", {
    className: "pubop-ght"
  }, p.when) : null, React.createElement("blockquote", {
    className: "pubop-prose"
  }, pubopText(p.text.join(" "))))), React.createElement(PubOpCuts, {
    cuts: m.cuts,
    when: m.srcs.length > 1 ? m.cutsWhen : null
  })));
}
const PUBOP_R_FIRST = 3,
  PUBOP_R_STEP = 3;
function PubOpResults({
  q,
  hits,
  houses
}) {
  const nCharts = hits.reduce((n, g) => n + g.blocks.filter(b => b.kind === "tracker").length, 0);
  const nItems = hits.reduce((n, g) => n + g.blocks.filter(b => b.kind !== "tracker").length, 0);
  const nMore = hits.reduce((n, g) => n + g.more.length, 0);
  const total = nCharts + nItems + nMore;
  const [fill, setFill] = pubopUseState({
    q,
    n: PUBOP_R_FIRST
  });
  const filled = fill.q === q ? fill.n : PUBOP_R_FIRST;
  pubopUseEffect(() => {
    if (filled >= hits.length) return undefined;
    let t = 0;
    const raf = requestAnimationFrame(() => {
      t = setTimeout(() => setFill(f => ({
        q,
        n: (f.q === q ? f.n : PUBOP_R_FIRST) + PUBOP_R_STEP
      })), 0);
    });
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, [q, filled, hits.length]);
  if (!total) {
    return React.createElement("p", {
      className: "pubop-none"
    }, "Nothing matches \u201C", q, "\u201D \u2014 try the words of a question as asked, or of its answers.");
  }
  return React.createElement("div", {
    className: "pubop-res"
  }, React.createElement("p", {
    className: "pubop-scope pubop-rcount"
  }, React.createElement("b", null, total), " ", total === 1 ? "match" : "matches", " for \u201C", q, "\u201D"), hits.slice(0, filled).map(g => {
    const trackers = g.blocks.filter(b => b.kind === "tracker");
    const items = g.blocks.filter(b => b.kind !== "tracker");
    return React.createElement("section", {
      className: "pubop-topic pubop-mon",
      key: g.t.id
    }, React.createElement("div", {
      className: "pubop-tk"
    }, React.createElement("h3", {
      className: "pubop-tt"
    }, g.t.title), React.createElement("span", {
      className: "pubop-tc"
    }, pubopCount(trackers.length, items.length, g.more.length))), trackers.map(c => React.createElement(PubOpTracker, {
      key: c.id,
      c: c,
      houses: houses
    })), items.length ? React.createElement("div", {
      className: "pubop-items"
    }, items.map((c, i) => React.createElement(PubOpItem, {
      key: (c.id || "") + i,
      c: c,
      houses: houses
    }))) : null, g.more.length ? React.createElement("div", {
      className: "pubop-items"
    }, g.more.map(m => React.createElement(PubOpQuestion, {
      key: m.id + "|" + m.house,
      m: m,
      houses: houses
    }))) : null);
  }));
}
function PubOpFindings({
  topics,
  onGo
}) {
  return React.createElement("section", {
    className: "pubop-finds",
    "aria-labelledby": "pubop-finds-h"
  }, React.createElement("h3", {
    className: "pubop-fh",
    id: "pubop-finds-h"
  }, "The findings"), React.createElement("ol", {
    className: "pubop-fl",
    role: "list"
  }, topics.map((t, i) => t.finding ? React.createElement("li", {
    key: t.id
  }, React.createElement("a", {
    className: "pubop-f",
    href: "#pubop-" + t.id,
    onClick: () => onGo(t.id)
  }, React.createElement("span", {
    className: "pubop-fn",
    "aria-hidden": "true"
  }, pubopNo(i)), React.createElement("span", {
    className: "pubop-fb"
  }, React.createElement("span", {
    className: "pubop-fk"
  }, t.short), React.createElement("span", {
    className: "pubop-ft"
  }, t.finding.text), React.createElement("span", {
    className: "pubop-fm"
  }, t.finding.meta)))) : null)));
}
const PUBOP_FIRST = 2,
  PUBOP_STEP = 2;
function PublicOpinionBody() {
  const {
    D
  } = window.AP;
  const [src, setSrc] = pubopUseState(null);
  const [failed, setFailed] = pubopUseState(false);
  const [tries, setTries] = pubopUseState(0);
  const [sort, setSort] = pubopUseState("issue");
  const [jump, setJump] = pubopUseState(null);
  const [q, setQ] = pubopUseState("");
  pubopUseEffect(() => {
    let live = true;
    D.loadOneOffs().then(j => {
      if (!live) return;
      if (j && Array.isArray(j.topics)) {
        setSrc(j);
        setFailed(false);
      } else setFailed(true);
    });
    return () => {
      live = false;
    };
  }, [tries]);
  pubopUseEffect(() => {
    if (!src) return;
    const h = jump ? jump.id : (window.location.hash || "").replace(/^#/, "");
    if (!/^pubop-/.test(h)) return;
    let raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(() => {
        const el = document.getElementById(h);
        if (!el) return;
        const pad = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
        window.scrollTo({
          top: Math.max(0, el.getBoundingClientRect().top + window.scrollY - pad),
          behavior: "instant"
        });
      });
    });
    return () => cancelAnimationFrame(raf);
  }, [src, jump]);
  const onGo = id => {
    if (sort === "issue" && shown >= list.length) return;
    setSort("issue");
    setJump({
      id: "pubop-" + id
    });
  };
  pubopUseEffect(() => {
    window.AP.pubopGo = (h, wave) => {
      setSort("pollster");
      setJump({
        id: h,
        wave: wave || null
      });
    };
    return () => {
      delete window.AP.pubopGo;
    };
  }, []);
  const topics = pubopUseMemo(() => src ? src.topics.filter(t => t.blocks.length || t.more.length) : [], [src]);
  const groups = pubopUseMemo(() => sort === "recent" ? pubopByMonth(topics) : sort === "pollster" ? pubopByPollster(topics, src && src.houses || {}) : null, [topics, sort, src]);
  const dq = pubopUseDeferred(q);
  const ql = dq.trim().toLowerCase();
  const inv = pubopUseMemo(() => topics.map(t => {
    const tw = ((t.title || "") + " " + (t.short || "") + " " + (t.about || "")).toLowerCase() + " ";
    return {
      t,
      blocks: t.blocks.map(b => ({
        b,
        hay: pubopHayMirror(tw + pubopBlockW(b))
      })),
      more: t.more.map(m => ({
        m,
        hay: pubopHayMirror(tw + pubopMoreW(m))
      }))
    };
  }), [topics]);
  const hits = pubopUseMemo(() => {
    if (!ql) return null;
    const toks = ql.split(/\s+/);
    return inv.map(g => ({
      t: g.t,
      blocks: g.blocks.filter(x => toks.every(k => x.hay.includes(k))).map(x => x.b),
      more: g.more.filter(x => toks.every(k => x.hay.includes(k))).map(x => x.m)
    })).filter(g => g.blocks.length || g.more.length);
  }, [inv, ql]);
  const list = groups || topics;
  const [fill, setFill] = pubopUseState({
    sort,
    n: PUBOP_FIRST
  });
  const filled = fill.sort === sort ? fill.n : PUBOP_FIRST;
  const shown = jump || /^#pubop-/.test(window.location.hash || "") ? Infinity : filled;
  pubopUseEffect(() => {
    if (!src || shown >= list.length) return undefined;
    let t = 0;
    const raf = requestAnimationFrame(() => {
      t = setTimeout(() => setFill(f => ({
        sort,
        n: (f.sort === sort ? f.n : PUBOP_FIRST) + PUBOP_STEP
      })), 0);
    });
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, [src, sort, shown, list.length]);
  if (failed) {
    return React.createElement("div", {
      className: "pubop"
    }, React.createElement("p", {
      className: "pubop-note"
    }, "The questions could not be loaded.", " ", React.createElement("button", {
      type: "button",
      className: "pubop-retry",
      onClick: () => setTries(n => n + 1)
    }, "Try again")));
  }
  if (!src) return React.createElement("div", {
    className: "pubop"
  }, React.createElement("p", {
    className: "pubop-note"
  }, "Loading the questions\u2026"));
  if (!topics.length) return React.createElement("div", {
    className: "pubop"
  }, React.createElement("p", {
    className: "pubop-note"
  }, "No questions are on file yet."));
  const houses = src.houses || {};
  return React.createElement("div", {
    className: "pubop"
  }, !ql && React.createElement(PubOpFindings, {
    topics: topics,
    onGo: onGo
  }), React.createElement("div", {
    className: "pubop-tools"
  }, React.createElement(PubOpSearch, {
    q: q,
    onQ: setQ
  }), !ql && React.createElement(PubOpSort, {
    sort: sort,
    onSort: setSort
  })), !ql && React.createElement("p", {
    className: "pubop-scope"
  }, src.counts.questions, " questions from ", pubopWord(Object.keys(houses).length), " pollsters", " ", "since ", pubopMonth(src.first), ". The newest questions appear automatically by issue and pollster; by recency shows every question, newest first.", " ", "Every figure names its pollster, its dates and its sample, and links to its source."), ql ? React.createElement(PubOpResults, {
    q: dq.trim(),
    hits: hits,
    houses: houses
  }) : groups ? groups.slice(0, shown).map(g => React.createElement(PubOpGroup, {
    key: g.id,
    g: g,
    houses: houses,
    byHouse: sort === "pollster",
    wv: jump && jump.wave
  })) : topics.slice(0, shown).map((t, i) => React.createElement(PubOpTopic, {
    key: t.id,
    t: t,
    n: pubopNo(i),
    houses: houses
  })), React.createElement("div", {
    className: "pubop-how"
  }, React.createElement("p", null, React.createElement("b", null, "How the findings are called."), " Each topic opens with what its first chart or question found. A side is said to lead only where the gap clears the poll\u2019s 95% margin of error, and to be a majority only where its share clears half by its own margin; inside the margin, the answer is \u201Clevel\u201D and the voters \u201Cdivided\u201D."), React.createElement("p", null, React.createElement("b", null, "How to read the answers."), " Each bar is one poll\u2019s answers on a scale of 0 to 100, as the pollster printed them, with the agreeing side on the left and the disagreeing side on the right; stronger answers are in full colour, milder ones faded. In the charts, each line joins one pollster\u2019s own readings and is coloured by how that pollster asked. Pollsters word their questions differently, so compare a pollster with itself before comparing it with another."), React.createElement("p", null, React.createElement("b", null, "What is left out."), " Questions about sport, holidays and personal habits, state politics, surveys run before this term, and questions the main page already tracks, such as whether the country is heading in the right direction.")));
}
function RdPublicOpinion() {
  return React.createElement("section", {
    className: "rd-sec rd-pubop",
    id: "public-opinion",
    "aria-labelledby": "rd-pubop-t"
  }, React.createElement("div", {
    className: "rd-eyebrow"
  }, React.createElement("h2", {
    className: "rd-title",
    id: "rd-pubop-t"
  }, "Public opinion"), React.createElement("span", {
    className: "rd-meta"
  }, "What else Australians tell the pollsters")), React.createElement(RdHed, {
    head: window.AP.PAGE_HEAD["public-opinion"],
    dek: "Voting intention is only part of what the pollsters ask. This page gathers the rest of this term’s questions worth knowing, in " + rdNumWord(window.AUSPOL.publicOpinionTopics) + " topics from Donald Trump and immigration to the budget, the Iran war and the Bondi attack. Each opens with what the polls found; where several pollsters asked the same thing, their answers sit side by side."
  }), React.createElement(PublicOpinionBody, null));
}
const RdPublicOpinionM = React.memo(RdPublicOpinion);
const PublicOpinionBodyM = React.memo(PublicOpinionBody);
Object.assign(window, {
  RdPublicOpinion: RdPublicOpinionM,
  PublicOpinionBody: PublicOpinionBodyM
});