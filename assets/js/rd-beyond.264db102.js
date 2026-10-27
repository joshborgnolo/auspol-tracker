const {
  useState: btvUseState,
  useEffect: btvUseEffect,
  useMemo: btvUseMemo,
  useDeferredValue: btvUseDeferred
} = React;
const BTV_MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const btvDay = iso => Number(iso.slice(8, 10)) + " " + BTV_MON[+iso.slice(5, 7) - 1] + " " + iso.slice(0, 4);
const btvMonth = iso => BTV_MON[+iso.slice(5, 7) - 1] + " " + iso.slice(0, 4);
const btvMonYY = iso => BTV_MON[+iso.slice(5, 7) - 1] + " " + iso.slice(2, 4);
const btvSpan = f => {
  if (!f || !f.end) return "";
  if (!f.start || f.start === f.end) return btvDay(f.end);
  if (f.start.slice(0, 7) === f.end.slice(0, 7)) return Number(f.start.slice(8)) + "–" + btvDay(f.end);
  if (f.start.slice(0, 4) === f.end.slice(0, 4)) return Number(f.start.slice(8)) + " " + BTV_MON[+f.start.slice(5, 7) - 1] + " – " + btvDay(f.end);
  return btvDay(f.start) + " – " + btvDay(f.end);
};
const btvN = v => Math.abs(v - Math.round(v)) < 0.05 ? String(Math.round(v)) : (Math.round(v * 10) / 10).toFixed(1);
const btvPct = v => btvN(v) + "%";
const btvSigned = v => (v > 0 ? "+" : v < 0 ? "−" : "") + btvN(Math.abs(v));
const btvHouse = (src, houses, full) => houses[src.house] ? houses[src.house][full ? "full" : "short"] : src.house;
const btvCap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
const btvWord = n => ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"][n] || String(n);
const btvNo = i => String(i + 1).padStart(2, "0");
const btvLow = s => !s || /^(?:Australia|Australian|Labor|Liberal|Coalition|One Nation|Greens|Trump|Albanese|Hanson|I\b)/.test(s) ? s : s.charAt(0).toLowerCase() + s.slice(1);
function BtvBar({
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
    className: "btv-bar" + (tall ? " btv-bar-t" : ""),
    role: "img",
    "aria-label": shown.map(s => btvPct(s.v) + " " + s.label).join(", ")
  }, seq.map((s, i) => s.side === "gap" ? React.createElement("i", {
    key: i,
    className: "btv-gap",
    style: {
      width: s.v + "%"
    }
  }) : React.createElement("i", {
    key: i,
    className: "btv-seg btv-" + s.side + s.tone,
    style: {
      width: s.v + "%"
    },
    title: btvPct(s.v) + " " + s.label
  })));
}
function BtvSwatch({
  side,
  tone
}) {
  return React.createElement("i", {
    className: "btv-sw btv-" + side + tone,
    "aria-hidden": "true"
  });
}
function BtvSplit({
  c
}) {
  const mids = c.segs.filter(s => s.side === "m" && s.v > 0);
  const rest = Math.round(100 - c.a - c.b - c.m - (c.x || 0));
  return React.createElement("div", {
    className: "btv-split"
  }, React.createElement("div", {
    className: "btv-ends"
  }, React.createElement("span", {
    className: "btv-end"
  }, React.createElement(BtvSwatch, {
    side: "a",
    tone: 2
  }), React.createElement("b", null, btvPct(c.a)), " ", React.createElement("span", {
    className: "btv-endl"
  }, c.names[0])), React.createElement("span", {
    className: "btv-end btv-end-b"
  }, React.createElement("b", null, btvPct(c.b)), " ", React.createElement("span", {
    className: "btv-endl"
  }, c.names[1]), React.createElement(BtvSwatch, {
    side: "b",
    tone: 2
  }))), React.createElement(BtvBar, {
    segs: c.segs,
    tall: true
  }), React.createElement("p", {
    className: "btv-mids"
  }, mids.map((s, i) => React.createElement("span", {
    key: i
  }, btvPct(s.v), " ", btvLow(s.label))), c.x >= 1 ? React.createElement("span", null, btvPct(c.x), " ", btvLow(c.xLabel || "")) : null, rest >= 3 ? React.createElement("span", null, rest, "% not published") : null), c.sig === false ? React.createElement("p", {
    className: "btv-level"
  }, "Level: the gap is inside the margin of error.") : null);
}
function BtvStack({
  c,
  houses
}) {
  const [all, setAll] = btvUseState(false);
  const rows = c.show && !all ? c.rows.slice(0, c.show) : c.rows;
  return React.createElement("div", {
    className: "btv-stack"
  }, React.createElement("div", {
    className: "btv-key"
  }, c.legend.map((l, i) => React.createElement("span", {
    key: i
  }, React.createElement(BtvSwatch, {
    side: l.side,
    tone: l.tone
  }), l.label)), c.shades ? React.createElement("span", {
    className: "btv-key-n"
  }, "Stronger answers in full colour, milder ones faded") : null), React.createElement("div", {
    className: "btv-rows"
  }, rows.map((r, i) => React.createElement("div", {
    className: "btv-row",
    key: i
  }, React.createElement("div", {
    className: "btv-rl"
  }, c.mode === "battery" ? React.createElement("span", null, r.label) : React.createElement(React.Fragment, null, React.createElement("span", {
    className: c.mode === "waves" ? "" : "btv-rh"
  }, r.label || (c.mode === "waves" ? btvMonth(r.when || r.src.field.end) : btvHouse(r.src, houses)), c.mode === "compare" && !r.label ? React.createElement("span", {
    className: "btv-rd"
  }, " \xB7 ", btvMonth(r.src.field.end)) : null), r.wording ? React.createElement("span", {
    className: "btv-rw"
  }, r.wording) : null)), React.createElement("span", {
    className: "btv-va"
  }, btvN(r.a)), React.createElement(BtvBar, {
    segs: r.segs
  }), React.createElement("span", {
    className: "btv-vb"
  }, btvN(r.b)), React.createElement("span", {
    className: "btv-net",
    title: r.sig === false ? "The gap is inside the margin of error" : ""
  }, r.sig === false ? "level" : "")))), c.show && c.rows.length > c.show ? React.createElement("button", {
    type: "button",
    className: "btv-all",
    onClick: () => setAll(!all)
  }, all ? "Show fewer" : "Show all " + c.rows.length) : null);
}
function BtvRank({
  c
}) {
  const [all, setAll] = btvUseState(false);
  const top = Math.max(...c.rows.map(r => r.v), 1);
  const rows = !all ? c.rows.slice(0, c.show) : c.rows;
  const tenths = c.rows.some(r => Math.abs(r.v - Math.round(r.v)) >= 0.05);
  return React.createElement("div", {
    className: "btv-rank"
  }, rows.map((r, i) => React.createElement("div", {
    className: "btv-rk",
    key: i
  }, React.createElement("span", {
    className: "btv-rkl"
  }, r.label), React.createElement("span", {
    className: "btv-rkb"
  }, React.createElement("i", {
    style: {
      width: r.v / Math.max(top, 50) * 100 + "%"
    }
  })), React.createElement("span", {
    className: "btv-rkv"
  }, tenths ? r.v.toFixed(1) + "%" : btvPct(r.v)))), c.rows.length > c.show ? React.createElement("button", {
    type: "button",
    className: "btv-all",
    onClick: () => setAll(!all)
  }, all ? "Show fewer" : "Show all " + c.rows.length) : null, c.base ? React.createElement("p", {
    className: "btv-base"
  }, c.base) : null);
}
function BtvNets({
  c
}) {
  const span = Math.max(...c.rows.map(r => Math.abs(r.v)), 10) * 1.2;
  return React.createElement("div", {
    className: "btv-nets"
  }, c.rows.map((r, i) => React.createElement("div", {
    className: "btv-nt",
    key: i
  }, React.createElement("span", {
    className: "btv-ntl"
  }, r.label), React.createElement("span", {
    className: "btv-ntb"
  }, React.createElement("i", {
    className: r.v >= 0 ? "btv-a2" : "btv-b2",
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
  }, btvSigned(r.v))))), c.unit ? React.createElement("p", {
    className: "btv-base"
  }, btvCap(c.unit)) : null);
}
const btvVal = (v, unit) => v == null ? "–" : unit === "net" ? btvSigned(v) : unit === "score" ? btvN(v) : btvPct(v);
const btvCols = cols => cols.length > 1 && cols.every(c => /^\d/.test(c) && c.slice(-4) === cols[0].slice(-4)) ? cols.map(c => c.slice(0, -5)) : cols;
const btvSumUnit = label => /^net\b|\bnet\s|\bchange\b/i.test(label) ? "net" : "%";
const BTV_ENT = {
  rsquo: "’",
  lsquo: "‘",
  ldquo: "“",
  rdquo: "”",
  ndash: "–",
  mdash: "—",
  amp: "&",
  nbsp: " "
};
const btvText = s => String(s || "").replace(/&(\w+);/g, (m, k) => BTV_ENT[k] || m);
function BtvFigHead({
  f,
  solo
}) {
  const t = solo ? null : f.title;
  const line = [f.measure ? btvCap(f.measure) : null, f.base].filter(Boolean).join(" · ");
  if (!t && !line) return null;
  return React.createElement("div", {
    className: "btv-gh"
  }, t ? React.createElement("p", {
    className: "btv-ght"
  }, t) : null, line ? React.createElement("p", {
    className: "btv-ghb"
  }, line) : null);
}
function BtvFigList({
  f
}) {
  const multi = f.cols.length > 1;
  const unit = f.unit === "score" ? "score" : "%";
  const scale = unit === "score" ? f.max : Math.max(50, ...f.rows.map(r => r.v[0] || 0));
  const w = v => Math.max(0, Math.min(100, (v || 0) / scale * 100)) + "%";
  return React.createElement("div", {
    className: "btv-gl" + (multi ? " btv-gl-m" : ""),
    role: "table",
    "aria-label": f.title || "Answers",
    style: {
      "--btv-n": f.cols.length
    }
  }, multi ? React.createElement("div", {
    className: "btv-gr btv-gr-h",
    role: "row"
  }, React.createElement("span", {
    role: "columnheader",
    className: "btv-gk"
  }, "Answer"), React.createElement("span", {
    "aria-hidden": "true"
  }), btvCols(f.cols).map((c, i) => React.createElement("span", {
    key: i,
    role: "columnheader",
    className: "btv-gv"
  }, c))) : null, f.rows.map((r, i) => React.createElement("div", {
    className: "btv-gr",
    role: "row",
    key: i
  }, React.createElement("span", {
    role: "rowheader",
    className: "btv-gk"
  }, r.label), React.createElement("span", {
    className: "btv-gbar",
    "aria-hidden": "true"
  }, React.createElement("i", {
    style: {
      width: w(r.v[0])
    }
  })), r.v.map((v, k) => React.createElement("span", {
    key: k,
    role: "cell",
    className: "btv-gv" + (k ? " btv-gv-o" : "")
  }, btvVal(v, unit))))), f.sums.map((r, i) => React.createElement("div", {
    className: "btv-gr btv-gr-s" + (i ? "" : " btv-gr-s1"),
    role: "row",
    key: "s" + i
  }, React.createElement("span", {
    role: "rowheader",
    className: "btv-gk"
  }, r.label), React.createElement("span", {
    "aria-hidden": "true"
  }), r.v.map((v, k) => React.createElement("span", {
    key: k,
    role: "cell",
    className: "btv-gv" + (k ? " btv-gv-o" : "")
  }, btvVal(v, btvSumUnit(r.label)))))));
}
function BtvFigNets({
  f
}) {
  return React.createElement(BtvNets, {
    c: {
      rows: f.rows.map(r => ({
        label: r.label,
        v: r.v[0]
      })),
      unit: null
    }
  });
}
function BtvFigSplit({
  f
}) {
  const multi = f.cols.length > 1;
  const ex = f.extraHeads;
  const row = (key, label, w) => React.createElement("div", {
    className: "btv-row" + (label == null ? " btv-row-1" : ""),
    key: key,
    style: {
      "--btv-x": ex.length
    }
  }, label != null ? React.createElement("div", {
    className: "btv-rl"
  }, React.createElement("span", null, label)) : null, React.createElement("span", {
    className: "btv-va"
  }, btvN(w.a)), React.createElement(BtvBar, {
    segs: w.segs
  }), React.createElement("span", {
    className: "btv-vb"
  }, btvN(w.b)), w.extra.map((v, k) => React.createElement("span", {
    className: "btv-vx",
    key: k
  }, btvVal(v, btvSumUnit(ex[k])))));
  return React.createElement("div", {
    className: "btv-stack btv-gs" + (ex.length ? " btv-gs-x" : "")
  }, React.createElement("div", {
    className: "btv-key"
  }, f.legend.map((l, i) => React.createElement("span", {
    key: i
  }, React.createElement(BtvSwatch, {
    side: l.side,
    tone: l.tone
  }), btvCap(l.label)))), ex.length ? React.createElement("div", {
    className: "btv-row btv-row-h" + (f.one ? " btv-row-1" : ""),
    style: {
      "--btv-x": ex.length
    },
    "aria-hidden": "true"
  }, f.one ? null : React.createElement("span", {
    className: "btv-rlx"
  }), React.createElement("span", null), React.createElement("span", null), React.createElement("span", null), ex.map((h, k) => React.createElement("span", {
    className: "btv-vx",
    key: k
  }, h))) : null, React.createElement("div", {
    className: "btv-rows"
  }, f.rows.map((r, i) => multi && r.waves.length > 1 ? React.createElement("div", {
    className: "btv-sg",
    key: i
  }, React.createElement("p", {
    className: "btv-sgl"
  }, r.label), r.waves.map((w, k) => row(k, w.when, w))) : row(i, f.one ? null : r.label + (multi ? " · " + r.waves[0].when : ""), r.waves[0]))));
}
function BtvFigTable({
  f
}) {
  const multi = f.cols.length > 1;
  const heads = f.heads.concat(f.extraHeads);
  const n = f.heads.length;
  const cells = w => w.cells.concat(w.extra).map((v, k) => React.createElement("td", {
    key: k,
    className: k < n ? "" : "btv-tc-x"
  }, v == null ? "–" : k >= n && btvSumUnit(heads[k]) === "net" ? btvSigned(v) : btvN(v)));
  return React.createElement("div", {
    className: "btv-twrap"
  }, React.createElement("table", {
    className: "btv-table btv-gt"
  }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", {
    className: "btv-l"
  }), heads.map((h, i) => React.createElement("th", {
    key: i,
    scope: "col"
  }, h)))), React.createElement("tbody", null, f.rows.flatMap((r, i) => r.sect ? [React.createElement("tr", {
    className: "btv-tsec",
    key: i
  }, React.createElement("th", {
    colSpan: heads.length + 1,
    scope: "colgroup",
    className: "btv-l"
  }, r.label))] : multi && r.waves.length > 1 ? [React.createElement("tr", {
    className: "btv-tgrp",
    key: i + "g"
  }, React.createElement("th", {
    colSpan: heads.length + 1,
    scope: "colgroup",
    className: "btv-l"
  }, r.label)), ...r.waves.map((w, k) => React.createElement("tr", {
    key: i + "-" + k
  }, React.createElement("th", {
    scope: "row",
    className: "btv-l btv-twv"
  }, w.when), cells(w)))] : [React.createElement("tr", {
    key: i
  }, React.createElement("th", {
    scope: "row",
    className: "btv-l"
  }, r.label, multi ? React.createElement("span", {
    className: "btv-twd"
  }, " \xB7 ", r.waves[0].when) : null), cells(r.waves[0]))]))));
}
const BTV_LABOR = /\b(?:Rudd|Gillard|Shorten|Albanese)\b/,
  BTV_COAL = /\b(?:Turnbull|Abbott|Morrison|Dutton|Ley|Nelson|Taylor)\b/;
const btvYear = (label, prev) => {
  const m = String(label).match(/(January|February|March|April|May|June|July|August|September|October|November|December)(?:\s+(\d{4}))?\s*$/);
  if (!m) return null;
  const mo = (BTV_MONF.indexOf(m[1]) + 0.5) / 12;
  if (m[2]) return +m[2] + mo;
  if (prev == null) return null;
  const y = Math.floor(prev);
  return y + mo > prev ? y + mo : y + 1 + mo;
};
const BTV_MONF = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
function btvTraitSeries(f) {
  if (f.kind !== "table" || f.heads.length !== 2 || !f.rows.some(r => r.sect)) return null;
  let pair = null;
  const pts = [];
  for (const r of f.rows) {
    if (r.sect) {
      const [a, b] = r.label.split(" v ");
      const pa = BTV_LABOR.test(a) ? "alp" : BTV_COAL.test(a) ? "lnp" : null;
      const pb = BTV_LABOR.test(b) ? "alp" : BTV_COAL.test(b) ? "lnp" : null;
      if (!pa || !pb || pa === pb) return null;
      pair = {
        a: [pa, a.replace(/^(?:Mr|Ms|Mrs)\s+/, "")],
        b: [pb, b.replace(/^(?:Mr|Ms|Mrs)\s+/, "")]
      };
      continue;
    }
    const x = btvYear(r.label, pts.length ? pts[pts.length - 1].x : null);
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
function BtvTraitChart({
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
    className: "btv-tr"
  }, React.createElement("figcaption", {
    className: "btv-trt"
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
    className: "btv-trg"
  }), React.createElement("text", {
    x: L - 5,
    y: Y(v) + 3.5,
    className: "btv-trax",
    textAnchor: "end"
  }, v))), [2010, 2015, 2020, 2025].filter(y => y >= x0 && y <= x1).map(y => React.createElement("text", {
    key: y,
    x: X(y),
    y: H - 4,
    className: "btv-trax",
    textAnchor: "middle"
  }, y)), ["lnp", "alp"].map(k => React.createElement("path", {
    key: k,
    d: line(k),
    className: "btv-trl btv-trl-" + k
  })), ["lnp", "alp"].map(k => pts.map((p, i) => p.vals[k][0] == null ? null : React.createElement("circle", {
    key: k + i,
    cx: X(p.x),
    cy: Y(p.vals[k][0]),
    r: 2.2,
    className: "btv-trd btv-trl-" + k
  }, React.createElement("title", null, p.vals[k][1] + ", " + p.when + ": " + p.vals[k][0] + "%")))), ["alp", "lnp"].map(k => {
    const p = last(k);
    return p ? React.createElement("text", {
      key: "e" + k,
      x: X(p.x) + 5,
      y: Y(p.vals[k][0]) + 3.5,
      className: "btv-trv"
    }, p.vals[k][0]) : null;
  })));
}
function BtvTraits({
  figs
}) {
  const all = figs.map(f => ({
    f,
    pts: btvTraitSeries(f)
  }));
  const xs = all.flatMap(a => a.pts.map(p => p.x));
  const x0 = Math.min(...xs) - 0.3,
    x1 = Math.max(...xs) + 0.3;
  const measure = figs[0].measure;
  return React.createElement("div", {
    className: "btv-fig"
  }, React.createElement("div", {
    className: "btv-gh"
  }, React.createElement("p", {
    className: "btv-ghb"
  }, (measure ? btvCap(measure) + ", %, " : "") + "for each trait"), React.createElement("p", {
    className: "btv-fams"
  }, React.createElement("span", null, React.createElement("i", {
    className: "btv-wsw btv-trs-alp",
    "aria-hidden": "true"
  }), "Labor leader (Rudd, Gillard, Shorten, Albanese)"), React.createElement("span", null, React.createElement("i", {
    className: "btv-wsw btv-trs-lnp",
    "aria-hidden": "true"
  }), "Coalition leader (Turnbull, Abbott, Morrison, Dutton, Ley)"))), React.createElement("div", {
    className: "btv-trs"
  }, all.map((a, i) => React.createElement(BtvTraitChart, {
    key: i,
    title: a.f.title,
    pts: a.pts,
    x0: x0,
    x1: x1
  }))), React.createElement("details", {
    className: "btv-cuts"
  }, React.createElement("summary", null, "The figures, poll by poll"), figs.map((f, i) => React.createElement("div", {
    className: "btv-cut",
    key: i
  }, React.createElement("p", {
    className: "btv-cutt"
  }, f.title), React.createElement(BtvFigTable, {
    f: f
  })))));
}
function BtvFig({
  f,
  solo
}) {
  const body = f.kind === "list" ? React.createElement(BtvFigList, {
    f: f
  }) : f.kind === "nets" ? React.createElement(BtvFigNets, {
    f: f
  }) : f.kind === "split" ? React.createElement(BtvFigSplit, {
    f: f
  }) : React.createElement(BtvFigTable, {
    f: f
  });
  return React.createElement("div", {
    className: "btv-fig btv-fig-" + f.kind
  }, React.createElement(BtvFigHead, {
    f: f,
    solo: solo
  }), body);
}
const btvCutsLabel = cuts => {
  const bs = [...new Set(cuts.flatMap(c => (c.banners || []).filter(Boolean)))];
  if (!bs.length || bs.length > 4) return "By group";
  const w = bs.map(btvLow);
  return "By " + (w.length < 2 ? w[0] : w.slice(0, -1).join(", ") + " and " + w[w.length - 1]);
};
function BtvCut({
  c
}) {
  const v = x => x == null ? "–" : btvN(x);
  if (c.down) {
    const span = c.heads.length + 1;
    return React.createElement("div", {
      className: "btv-cut"
    }, c.title ? React.createElement("p", {
      className: "btv-cutt"
    }, c.title) : null, React.createElement("div", {
      className: "btv-twrap"
    }, React.createElement("table", {
      className: "btv-table"
    }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", {
      className: "btv-l"
    }), c.heads.map((h, i) => React.createElement("th", {
      key: i,
      scope: "col"
    }, h)))), React.createElement("tbody", null, c.rows.flatMap((r, i) => {
      const b = c.banners && c.banners[i];
      const head = b && (!i || c.banners[i - 1] !== b) ? [React.createElement("tr", {
        className: "btv-tsec",
        key: "b" + i
      }, React.createElement("th", {
        colSpan: span,
        scope: "colgroup",
        className: "btv-l"
      }, b))] : [];
      return head.concat(React.createElement("tr", {
        key: i
      }, React.createElement("th", {
        scope: "row",
        className: "btv-l"
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
    className: "btv-cut"
  }, c.title ? React.createElement("p", {
    className: "btv-cutt"
  }, c.title) : null, React.createElement("div", {
    className: "btv-twrap"
  }, React.createElement("table", {
    className: "btv-table"
  }, React.createElement("thead", null, banner ? React.createElement("tr", {
    className: "btv-tban"
  }, React.createElement("th", {
    className: "btv-l"
  }), runs.map((r, i) => React.createElement("th", {
    key: i,
    colSpan: r.n,
    scope: "colgroup"
  }, r.b || ""))) : null, React.createElement("tr", null, React.createElement("th", {
    className: "btv-l"
  }), c.heads.map((h, i) => React.createElement("th", {
    key: i,
    scope: "col",
    className: (runs.some(r => r.k === i && i) ? "btv-tb0" : "") + (h.length <= 7 ? " btv-nw" : "")
  }, h)))), React.createElement("tbody", null, c.rows.map((r, i) => React.createElement("tr", {
    key: i
  }, React.createElement("th", {
    scope: "row",
    className: "btv-l"
  }, r[0]), r.slice(1).map((x, k) => React.createElement("td", {
    key: k,
    className: runs.some(q => q.k === k && k) ? "btv-tb0" : ""
  }, v(x)))))))));
}
function BtvCuts({
  cuts,
  when
}) {
  if (!cuts || !cuts.length) return null;
  return React.createElement("details", {
    className: "btv-cuts"
  }, React.createElement("summary", null, btvCutsLabel(cuts), when ? React.createElement("span", null, " \xB7 ", when) : null), cuts.map((c, i) => React.createElement(BtvCut, {
    key: i,
    c: c
  })));
}
function BtvSource({
  src,
  houses,
  question
}) {
  return React.createElement("div", {
    className: "btv-src"
  }, React.createElement("span", {
    className: "btv-src-l"
  }, React.createElement("b", null, btvHouse(src, houses, true)), React.createElement("span", null, btvSpan(src.field)), src.n ? React.createElement("span", null, src.n.toLocaleString("en-AU"), " people") : null, src.url ? React.createElement("a", {
    href: src.url,
    target: "_blank",
    rel: "noopener"
  }, "Source \u2197") : null), question ? React.createElement("details", {
    className: "btv-wd"
  }, React.createElement("summary", null, "The question as asked"), React.createElement("p", null, question)) : null);
}
function BtvSources({
  c,
  houses
}) {
  const seen = new Set();
  const links = (c.rows || []).filter(r => r.src && r.src.url && !seen.has(r.src.url) && seen.add(r.src.url));
  return React.createElement("div", {
    className: "btv-src"
  }, React.createElement("span", {
    className: "btv-src-l"
  }, c.mode === "waves" ? React.createElement("b", null, btvHouse(c.src || c.rows[0].src, houses, true)) : null, links.length ? React.createElement("span", {
    className: "btv-srcs"
  }, "Sources: ", links.map((r, i) => React.createElement("a", {
    key: i,
    href: r.src.url,
    target: "_blank",
    rel: "noopener"
  }, c.mode === "waves" ? btvMonth(r.src.field.end) : btvHouse(r.src, houses) + " " + btvMonth(r.src.field.end), " \u2197"))) : null));
}
function BtvWaves({
  q,
  houses
}) {
  const asked = [...new Set(q.srcs.map(s => s.question).filter(Boolean))];
  return React.createElement("div", {
    className: "btv-src"
  }, React.createElement("b", {
    className: "btv-srch"
  }, btvHouse(q, houses, true)), React.createElement("ul", {
    className: "btv-srcw"
  }, q.srcs.map((s, i) => React.createElement("li", {
    key: i
  }, React.createElement("span", null, btvSpan(s.field)), s.n ? React.createElement("span", null, s.n.toLocaleString("en-AU"), " people") : null, s.url ? React.createElement("a", {
    href: s.url,
    target: "_blank",
    rel: "noopener"
  }, "Source \u2197") : null))), asked.length ? React.createElement("details", {
    className: "btv-wd"
  }, React.createElement("summary", null, asked.length > 1 ? "The questions as asked" : "The question as asked"), asked.map((x, i) => React.createElement("p", {
    key: i
  }, x))) : null);
}
function BtvItem({
  c,
  houses,
  topic
}) {
  const body = c.kind === "split" ? React.createElement(BtvSplit, {
    c: c
  }) : c.kind === "stack" ? React.createElement(BtvStack, {
    c: c,
    houses: houses
  }) : c.kind === "rank" ? React.createElement(BtvRank, {
    c: c
  }) : c.kind === "nets" ? React.createElement(BtvNets, {
    c: c
  }) : null;
  return React.createElement("article", {
    className: "btv-item btv-k-" + c.kind
  }, React.createElement("div", {
    className: "btv-il"
  }, topic ? React.createElement("p", {
    className: "btv-qt"
  }, topic) : null, React.createElement("h4", {
    className: "btv-q"
  }, c.title), c.summary ? React.createElement("p", {
    className: "btv-sum"
  }, c.summary) : null, c.note ? React.createElement("p", {
    className: "btv-note"
  }, c.note) : null, c.src && c.src.field ? React.createElement(BtvSource, {
    src: c.src,
    houses: houses,
    question: c.question
  }) : React.createElement(BtvSources, {
    c: c,
    houses: houses
  })), React.createElement("div", {
    className: "btv-ir"
  }, body, React.createElement(BtvCuts, {
    cuts: c.cuts,
    when: null
  })));
}
function BtvTracker({
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
        label: BTV_MON[m] + " " + String(y).slice(2)
      });
    }
  }
  const fmt = v => net ? btvSigned(v) : btvPct(v);
  const yt = [];
  for (let v = lo + step; v <= hi + 1e-9; v += step) yt.push(v);
  const ink = f => "var(--btv-w" + f + ")";
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
    className: "btv-tracker"
  }, topic ? React.createElement("p", {
    className: "btv-qt"
  }, topic) : null, React.createElement("p", {
    className: "btv-tlab"
  }, c.title), React.createElement("p", {
    className: "btv-tdek"
  }, c.dek), React.createElement("p", {
    className: "btv-fams"
  }, fams.map(f => React.createElement("span", {
    key: f.i
  }, React.createElement("i", {
    className: "btv-wsw btv-w" + f.i,
    "aria-hidden": "true"
  }), f.label))), React.createElement("div", {
    className: "btv-tbody"
  }, React.createElement("div", {
    className: "btv-tchart"
  }, React.createElement("div", {
    className: "card rd-card btv-chart"
  }, React.createElement(TrendChart, {
    key: "btv-" + c.id,
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
      text: net ? v === 0 ? "Even" : btvSigned(v) : v + (v === hi ? "%" : ""),
      size: 10.5,
      cls: "btv-ylab"
    })),
    refLines: c.ref != null ? [{
      y: c.ref,
      label: "",
      color: "var(--ink-faint)"
    }] : [],
    series: c.panels.map(p => ({
      id: p.house,
      label: btvHouse(p, houses),
      color: ink(p.fam),
      rdWidth: 2,
      smooth: false,
      endLabel: btvHouse(p, houses),
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
      label: net ? "Net" : btvCap(c.names[0]),
      meta: q.rk ? {
        pollster: q.rk.split("|")[0],
        released: q.rk.split("|")[1],
        facet: q.fk,
        dateLabel: btvSpan(q.field),
        sample: q.n
      } : {
        pollster: btvHouse(q, houses, true),
        dateLabel: btvSpan(q.field),
        sample: q.n
      }
    })),
    tooltipTitle: i => {
      const qs = at(i);
      return qs.length === 1 ? btvSpan(qs[0].field) : qs.length ? btvDay(qs[0].field.end) : "";
    },
    extraRows: i => {
      const qs = at(i);
      return qs.flatMap(q => {
        const pre = qs.length > 1 ? btvHouse(q, houses) + ": " : "";
        return net ? [{
          label: pre + btvCap(c.names[0]),
          value: btvPct(q.a)
        }, {
          label: pre + btvCap(c.names[1]),
          value: btvPct(q.b)
        }] : [{
          label: pre + btvCap(c.names[1]),
          value: btvPct(q.b)
        }];
      });
    },
    fmt: fmt,
    copy: {
      title: c.title,
      sub: c.head + "." + (c.note ? " " + c.note : ""),
      span: btvMonYY(c.first) + " – " + btvMonYY(c.last),
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
    className: "rd-ckey btv-tkey"
  }, React.createElement("span", null, React.createElement("i", {
    className: "btv-dot",
    "aria-hidden": "true"
  }), "One poll"), React.createElement("span", null, React.createElement("i", {
    className: "btv-ln",
    "aria-hidden": "true"
  }), "One pollster\u2019s readings, joined"), c.ref != null ? React.createElement("span", null, React.createElement("i", {
    className: "btv-rl0",
    "aria-hidden": "true"
  }), c.refLabel) : null)), c.note ? React.createElement("p", {
    className: "btv-note"
  }, c.note) : null), React.createElement("aside", {
    className: "btv-latest",
    "aria-label": "Latest from each pollster"
  }, React.createElement("p", {
    className: "btv-lh"
  }, "Latest from each pollster"), React.createElement("ul", {
    className: "btv-ll"
  }, latest.map(({
    p,
    q
  }) => React.createElement("li", {
    key: p.house
  }, React.createElement("span", {
    className: "btv-lp"
  }, React.createElement("span", {
    className: "btv-lnm"
  }, React.createElement("i", {
    className: "btv-ldot btv-w" + p.fam,
    "aria-hidden": "true"
  }), btvHouse(p, houses), React.createElement("span", {
    className: "btv-ld"
  }, btvDay(q.field.end))), React.createElement("span", {
    className: "btv-lq"
  }, p.label)), React.createElement("b", {
    className: "btv-lv"
  }, fmt(q.v))))))), React.createElement("details", {
    className: "btv-ledger"
  }, React.createElement("summary", null, "All ", rows.length, " readings"), React.createElement("div", {
    className: "btv-twrap"
  }, React.createElement("table", {
    className: "btv-table"
  }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", {
    className: "btv-l"
  }, "Pollster"), React.createElement("th", {
    className: "btv-l"
  }, "Fieldwork"), React.createElement("th", null, "Sample"), React.createElement("th", null, c.cols[0]), React.createElement("th", null, c.cols[1]), React.createElement("th", null, c.cols[2]), net ? React.createElement("th", null, "Net") : null, React.createElement("th", null))), React.createElement("tbody", null, rows.map((q, i) => React.createElement("tr", {
    key: i
  }, React.createElement("td", {
    className: "btv-l"
  }, btvHouse(q, houses)), React.createElement("td", {
    className: "btv-l"
  }, btvSpan(q.field)), React.createElement("td", null, q.n ? q.n.toLocaleString("en-AU") : "–"), React.createElement("td", null, btvN(q.a)), React.createElement("td", null, btvN(q.m)), React.createElement("td", null, btvN(q.b)), net ? React.createElement("td", null, React.createElement("b", null, btvSigned(q.v))) : null, React.createElement("td", null, q.url ? React.createElement("a", {
    href: q.url,
    target: "_blank",
    rel: "noopener"
  }, "Source \u2197") : null))))))));
}
function BtvMore({
  label,
  qs,
  houses,
  meta
}) {
  return React.createElement("details", {
    className: "btv-more"
  }, React.createElement("summary", null, label, React.createElement("span", null, " \xB7 ", qs.length)), React.createElement("ul", {
    className: "btv-ml"
  }, qs.map(q => React.createElement("li", {
    key: q.id + q.house
  }, React.createElement("details", {
    className: "btv-mi"
  }, React.createElement("summary", null, React.createElement("span", {
    className: "btv-mq"
  }, q.title), React.createElement("span", {
    className: "btv-mm"
  }, meta(q))), React.createElement("div", {
    className: "btv-mb"
  }, React.createElement("div", {
    className: "btv-il"
  }, React.createElement(BtvWaves, {
    q: q,
    houses: houses
  })), React.createElement("div", {
    className: "btv-ir"
  }, q.figs.length > 1 && q.figs.every(f => btvTraitSeries(f)) ? React.createElement(BtvTraits, {
    figs: q.figs
  }) : q.figs.map((f, i) => React.createElement(BtvFig, {
    key: i,
    f: f,
    solo: q.figs.length === 1
  })), q.prose.map((p, i) => React.createElement("div", {
    className: "btv-fig",
    key: "p" + i
  }, q.prose.length > 1 || q.figs.length ? React.createElement("p", {
    className: "btv-ght"
  }, p.when) : null, React.createElement("blockquote", {
    className: "btv-prose"
  }, btvText(p.text.join(" "))))), React.createElement(BtvCuts, {
    cuts: q.cuts,
    when: q.srcs.length > 1 ? q.cutsWhen : null
  }))))))));
}
const btvCount = (trackers, items, more) => [trackers ? trackers === 1 ? "One chart" : btvCap(btvWord(trackers)) + " charts" : null, items ? items + (items === 1 ? " question" : " questions") : null, more ? more + " more" : null].filter(Boolean).join(" · ");
function BtvTopic({
  t,
  n,
  houses
}) {
  const trackers = t.blocks.filter(b => b.kind === "tracker");
  const items = t.blocks.filter(b => b.kind !== "tracker");
  const count = btvCount(trackers.length, items.length, t.more.length);
  return React.createElement("section", {
    className: "btv-topic",
    id: "btv-" + t.id,
    "aria-labelledby": "btv-h-" + t.id
  }, React.createElement("div", {
    className: "btv-tk"
  }, React.createElement("h3", {
    className: "btv-tt",
    id: "btv-h-" + t.id
  }, React.createElement("span", {
    className: "btv-tn"
  }, n), t.title), React.createElement("span", {
    className: "btv-tc"
  }, count)), t.finding ? React.createElement("p", {
    className: "btv-hl"
  }, t.finding.text) : null, React.createElement("p", {
    className: "btv-tdk"
  }, t.dek), trackers.map(c => React.createElement(BtvTracker, {
    key: c.id,
    c: c,
    houses: houses
  })), items.length ? React.createElement("div", {
    className: "btv-items"
  }, items.map((c, i) => React.createElement(BtvItem, {
    key: (c.id || "") + i,
    c: c,
    houses: houses
  }))) : null, t.more.length ? React.createElement(BtvMore, {
    label: "More questions on " + (t.about || t.title),
    qs: t.more,
    houses: houses,
    meta: q => btvHouse(q, houses) + " · " + btvMonth(q.last) + (q.srcs.length > 1 ? " · " + q.srcs.length + " readings" : "")
  }) : null);
}
const btvLast = b => b.kind === "tracker" ? b.last : b.src && b.src.field ? b.src.field.end : (b.rows || []).reduce((d, r) => r.src && r.src.field && r.src.field.end > d ? r.src.field.end : d, "");
const btvHousesOf = b => b.kind === "tracker" ? [...new Set(b.panels.map(p => p.house))] : b.src && b.src.house ? [b.src.house] : [...new Set((b.rows || []).map(r => r.src && r.src.house).filter(Boolean))];
function btvDated(topics) {
  const all = [];
  topics.forEach(t => {
    t.blocks.forEach(b => all.push({
      t,
      b,
      date: btvLast(b)
    }));
    t.more.forEach(q => all.push({
      t,
      q,
      date: q.last
    }));
  });
  return all.sort((p, q) => p.date < q.date ? 1 : p.date > q.date ? -1 : 0);
}
const btvSplitKinds = all => ({
  trackers: all.filter(e => e.b && e.b.kind === "tracker"),
  items: all.filter(e => e.b && e.b.kind !== "tracker"),
  more: all.filter(e => e.q)
});
function btvByMonth(topics) {
  const months = [];
  for (const e of btvDated(topics)) {
    const ym = e.date.slice(0, 7);
    if (!months.length || months[months.length - 1].ym !== ym) months.push({
      ym,
      all: []
    });
    months[months.length - 1].all.push(e);
  }
  return months.map(m => {
    const title = BTV_MONF[+m.ym.slice(5, 7) - 1] + " " + m.ym.slice(0, 4);
    return {
      id: "m-" + m.ym,
      title,
      moreLabel: "More questions from " + title,
      ...btvSplitKinds(m.all)
    };
  });
}
function btvByPollster(topics, houses) {
  const own = new Map(),
    also = new Map(),
    several = [];
  for (const e of btvDated(topics)) {
    const hs = e.q ? [e.q.house] : btvHousesOf(e.b);
    if (hs.length === 1) {
      if (!own.has(hs[0])) own.set(hs[0], []);
      own.get(hs[0]).push(e);
    } else {
      several.push(e);
      hs.forEach(h => also.set(h, (also.get(h) || 0) + 1));
    }
  }
  const name = h => btvHouse({
    house: h
  }, houses);
  const ids = [...new Set([...own.keys(), ...also.keys()])].sort((p, q) => (own.get(q) || []).length - (own.get(p) || []).length || (also.get(q) || 0) - (also.get(p) || 0) || name(p).localeCompare(name(q)));
  const groups = ids.map(h => {
    const n = also.get(h) || 0,
      mine = own.get(h) || [];
    const cmp = btvWord(n) + (n === 1 ? " comparison" : " comparisons") + " with other pollsters";
    return {
      id: "p-" + h,
      title: btvHouse({
        house: h
      }, houses, true),
      moreLabel: "More questions from " + name(h),
      lead: n ? React.createElement("p", {
        className: "btv-tdk"
      }, mine.length ? "Also in " : "Only in ", React.createElement("a", {
        href: "#btv-p-several"
      }, cmp), ".") : null,
      ...btvSplitKinds(mine)
    };
  });
  if (several.length) groups.push({
    id: "p-several",
    title: "Several pollsters",
    moreLabel: "",
    lead: React.createElement("p", {
      className: "btv-tdk"
    }, "Charts and questions that set two or more pollsters side by side."),
    ...btvSplitKinds(several)
  });
  return groups;
}
function BtvGroup({
  g,
  houses,
  byHouse
}) {
  const topicOf = new Map(g.more.map(e => [e.q, e.t]));
  const count = btvCount(g.trackers.length, g.items.length, g.more.length);
  return React.createElement("section", {
    className: "btv-topic btv-mon",
    id: "btv-" + g.id,
    "aria-labelledby": "btv-h-" + g.id
  }, React.createElement("div", {
    className: "btv-tk"
  }, React.createElement("h3", {
    className: "btv-tt",
    id: "btv-h-" + g.id
  }, g.title), count ? React.createElement("span", {
    className: "btv-tc"
  }, count) : null), g.lead || null, g.trackers.map(e => React.createElement(BtvTracker, {
    key: e.b.id,
    c: e.b,
    houses: houses,
    topic: e.t.short
  })), g.items.length ? React.createElement("div", {
    className: "btv-items"
  }, g.items.map((e, i) => React.createElement(BtvItem, {
    key: (e.b.id || "") + i,
    c: e.b,
    houses: houses,
    topic: e.t.short
  }))) : null, g.more.length ? React.createElement(BtvMore, {
    label: g.moreLabel,
    qs: g.more.map(e => e.q),
    houses: houses,
    meta: q => topicOf.get(q).short + (byHouse ? "" : " · " + btvHouse(q, houses)) + " · " + btvDay(q.last) + (q.srcs.length > 1 ? " · " + q.srcs.length + " readings" : "")
  }) : null);
}
const BTV_SORTS = [{
  id: "issue",
  label: "By issue"
}, {
  id: "pollster",
  label: "By pollster"
}, {
  id: "recent",
  label: "By recency"
}];
function BtvSort({
  sort,
  onSort
}) {
  const sortSwipeLive = React.useRef(null);
  sortSwipeLive.current = dir => {
    const i = BTV_SORTS.findIndex(o => o.id === sort);
    if (i < 0) return false;
    onSort(BTV_SORTS[(i + dir + BTV_SORTS.length) % BTV_SORTS.length].id);
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
    className: "btv-sort"
  }, React.createElement("span", {
    className: "btv-sort-l",
    id: "btv-sort-l"
  }, "Sort"), React.createElement("div", {
    className: "btv-sort-g",
    role: "group",
    "aria-labelledby": "btv-sort-l",
    ref: sortSwipe,
    "data-rd-swipe": "",
    onKeyDown: rdTabsKey(BTV_SORTS, onSort),
    onClick: rdTabFocus
  }, BTV_SORTS.map(o => React.createElement("button", {
    key: o.id,
    type: "button",
    className: "btv-sort-b",
    "aria-pressed": sort === o.id,
    onClick: () => onSort(o.id)
  }, React.createElement("span", {
    className: "btv-sort-w",
    "data-t": o.label
  }, o.label)))));
}
const btvPushW = (parts, s) => {
  if (s) parts.push(String(s));
};
const btvSegsW = (segs, parts) => (segs || []).forEach(s => btvPushW(parts, s.label));
const btvRowsW = (rows, parts) => (rows || []).forEach(r => {
  btvPushW(parts, r.label);
  btvPushW(parts, r.wording);
  btvSegsW(r.segs, parts);
  (r.waves || []).forEach(w => btvSegsW(w.segs, parts));
});
const btvCutsW = (cuts, parts) => (cuts || []).forEach(c => {
  btvPushW(parts, c.title);
  (c.heads || []).forEach(h => parts.push(String(h)));
  (c.banners || []).forEach(b => btvPushW(parts, b));
  (c.rows || []).forEach(r => r.length && btvPushW(parts, r[0]));
});
const btvFigsW = (figs, parts) => (figs || []).forEach(f => {
  [f.title, f.measure, f.base].forEach(s => btvPushW(parts, s));
  (f.heads || []).concat(f.extraHeads || []).forEach(h => parts.push(String(h)));
  (f.legend || []).forEach(l => btvPushW(parts, l.label));
  btvRowsW(f.rows, parts);
  (f.sums || []).forEach(r => btvPushW(parts, r.label));
});
const btvBlockW = b => {
  const parts = [];
  [b.title, b.summary, b.note, b.question, b.xLabel, b.base].forEach(s => btvPushW(parts, s));
  (b.names || []).forEach(s => btvPushW(parts, s));
  (b.legend || []).forEach(l => btvPushW(parts, l.label));
  btvSegsW(b.segs, parts);
  btvRowsW(b.rows, parts);
  btvCutsW(b.cuts, parts);
  if (b.kind === "tracker") {
    [b.dek, b.head, b.refLabel].forEach(s => btvPushW(parts, s));
    (b.families || []).forEach(s => parts.push(String(s)));
    (b.cols || []).forEach(s => parts.push(String(s)));
    (b.panels || []).forEach(p => btvPushW(parts, p.label));
  }
  return parts.join(" ").toLowerCase();
};
const btvMoreW = m => {
  const parts = [String(m.title || "")];
  (m.srcs || []).forEach(s => btvPushW(parts, s.question));
  btvFigsW(m.figs, parts);
  (m.prose || []).forEach(p => parts.push(btvText((p.text || []).join(" "))));
  btvCutsW(m.cuts, parts);
  return parts.join(" ").toLowerCase();
};
const btvHayMirror = words => words + " " + words.replace(/–/g, "-");
function BtvSearch({
  q,
  onQ
}) {
  return React.createElement("label", {
    className: "btv-search"
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
    className: "btv-x",
    onClick: () => onQ(""),
    "aria-label": "Clear search"
  }, "\xD7") : null);
}
function BtvHitMore({
  m,
  houses
}) {
  return React.createElement("article", {
    className: "btv-item btv-hit"
  }, React.createElement("div", {
    className: "btv-il"
  }, React.createElement("h4", {
    className: "btv-q"
  }, m.title), React.createElement(BtvWaves, {
    q: m,
    houses: houses
  })), React.createElement("div", {
    className: "btv-ir"
  }, m.figs.length > 1 && m.figs.every(f => btvTraitSeries(f)) ? React.createElement(BtvTraits, {
    figs: m.figs
  }) : m.figs.map((f, i) => React.createElement(BtvFig, {
    key: i,
    f: f,
    solo: m.figs.length === 1
  })), m.prose.map((p, i) => React.createElement("div", {
    className: "btv-fig",
    key: "p" + i
  }, m.prose.length > 1 || m.figs.length ? React.createElement("p", {
    className: "btv-ght"
  }, p.when) : null, React.createElement("blockquote", {
    className: "btv-prose"
  }, btvText(p.text.join(" "))))), React.createElement(BtvCuts, {
    cuts: m.cuts,
    when: m.srcs.length > 1 ? m.cutsWhen : null
  })));
}
const BTV_R_FIRST = 3,
  BTV_R_STEP = 3;
function BtvResults({
  q,
  hits,
  houses
}) {
  const nCharts = hits.reduce((n, g) => n + g.blocks.filter(b => b.kind === "tracker").length, 0);
  const nItems = hits.reduce((n, g) => n + g.blocks.filter(b => b.kind !== "tracker").length, 0);
  const nMore = hits.reduce((n, g) => n + g.more.length, 0);
  const total = nCharts + nItems + nMore;
  const [fill, setFill] = btvUseState({
    q,
    n: BTV_R_FIRST
  });
  const filled = fill.q === q ? fill.n : BTV_R_FIRST;
  btvUseEffect(() => {
    if (filled >= hits.length) return undefined;
    let t = 0;
    const raf = requestAnimationFrame(() => {
      t = setTimeout(() => setFill(f => ({
        q,
        n: (f.q === q ? f.n : BTV_R_FIRST) + BTV_R_STEP
      })), 0);
    });
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, [q, filled, hits.length]);
  if (!total) {
    return React.createElement("p", {
      className: "btv-none"
    }, "Nothing matches \u201C", q, "\u201D \u2014 try the words of a question as asked, or of its answers.");
  }
  return React.createElement("div", {
    className: "btv-res"
  }, React.createElement("p", {
    className: "btv-scope btv-rcount"
  }, React.createElement("b", null, total), " ", total === 1 ? "match" : "matches", " for \u201C", q, "\u201D"), hits.slice(0, filled).map(g => {
    const trackers = g.blocks.filter(b => b.kind === "tracker");
    const items = g.blocks.filter(b => b.kind !== "tracker");
    return React.createElement("section", {
      className: "btv-topic btv-mon",
      key: g.t.id
    }, React.createElement("div", {
      className: "btv-tk"
    }, React.createElement("h3", {
      className: "btv-tt"
    }, g.t.title), React.createElement("span", {
      className: "btv-tc"
    }, btvCount(trackers.length, items.length, g.more.length))), trackers.map(c => React.createElement(BtvTracker, {
      key: c.id,
      c: c,
      houses: houses
    })), items.length ? React.createElement("div", {
      className: "btv-items"
    }, items.map((c, i) => React.createElement(BtvItem, {
      key: (c.id || "") + i,
      c: c,
      houses: houses
    }))) : null, g.more.length ? React.createElement("div", {
      className: "btv-items"
    }, g.more.map(m => React.createElement(BtvHitMore, {
      key: m.id + "|" + m.house,
      m: m,
      houses: houses
    }))) : null);
  }));
}
function BtvFindings({
  topics,
  onGo
}) {
  return React.createElement("section", {
    className: "btv-finds",
    "aria-labelledby": "btv-finds-h"
  }, React.createElement("h3", {
    className: "btv-fh",
    id: "btv-finds-h"
  }, "The findings"), React.createElement("ol", {
    className: "btv-fl",
    role: "list"
  }, topics.map((t, i) => t.finding ? React.createElement("li", {
    key: t.id
  }, React.createElement("a", {
    className: "btv-f",
    href: "#btv-" + t.id,
    onClick: () => onGo(t.id)
  }, React.createElement("span", {
    className: "btv-fn",
    "aria-hidden": "true"
  }, btvNo(i)), React.createElement("span", {
    className: "btv-fb"
  }, React.createElement("span", {
    className: "btv-fk"
  }, t.short), React.createElement("span", {
    className: "btv-ft"
  }, t.finding.text), React.createElement("span", {
    className: "btv-fm"
  }, t.finding.meta)))) : null)));
}
const BTV_FIRST = 2,
  BTV_STEP = 2;
function BtvBody() {
  const {
    D
  } = window.AP;
  const [src, setSrc] = btvUseState(null);
  const [failed, setFailed] = btvUseState(false);
  const [tries, setTries] = btvUseState(0);
  const [sort, setSort] = btvUseState("issue");
  const [jump, setJump] = btvUseState(null);
  const [q, setQ] = btvUseState("");
  btvUseEffect(() => {
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
  btvUseEffect(() => {
    if (!src) return;
    const h = jump ? jump.id : (window.location.hash || "").replace(/^#/, "");
    if (!/^btv-/.test(h)) return;
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
      id: "btv-" + id
    });
  };
  btvUseEffect(() => {
    window.AP.btvGo = h => {
      setSort("pollster");
      setJump({
        id: h
      });
    };
    return () => {
      delete window.AP.btvGo;
    };
  }, []);
  const topics = btvUseMemo(() => src ? src.topics.filter(t => t.blocks.length || t.more.length) : [], [src]);
  const groups = btvUseMemo(() => sort === "recent" ? btvByMonth(topics) : sort === "pollster" ? btvByPollster(topics, src && src.houses || {}) : null, [topics, sort, src]);
  const dq = btvUseDeferred(q);
  const ql = dq.trim().toLowerCase();
  const inv = btvUseMemo(() => topics.map(t => {
    const tw = ((t.title || "") + " " + (t.short || "") + " " + (t.about || "")).toLowerCase() + " ";
    return {
      t,
      blocks: t.blocks.map(b => ({
        b,
        hay: btvHayMirror(tw + btvBlockW(b))
      })),
      more: t.more.map(m => ({
        m,
        hay: btvHayMirror(tw + btvMoreW(m))
      }))
    };
  }), [topics]);
  const hits = btvUseMemo(() => {
    if (!ql) return null;
    const toks = ql.split(/\s+/);
    return inv.map(g => ({
      t: g.t,
      blocks: g.blocks.filter(x => toks.every(k => x.hay.includes(k))).map(x => x.b),
      more: g.more.filter(x => toks.every(k => x.hay.includes(k))).map(x => x.m)
    })).filter(g => g.blocks.length || g.more.length);
  }, [inv, ql]);
  const list = groups || topics;
  const [fill, setFill] = btvUseState({
    sort,
    n: BTV_FIRST
  });
  const filled = fill.sort === sort ? fill.n : BTV_FIRST;
  const shown = jump || /^#btv-/.test(window.location.hash || "") ? Infinity : filled;
  btvUseEffect(() => {
    if (!src || shown >= list.length) return undefined;
    let t = 0;
    const raf = requestAnimationFrame(() => {
      t = setTimeout(() => setFill(f => ({
        sort,
        n: (f.sort === sort ? f.n : BTV_FIRST) + BTV_STEP
      })), 0);
    });
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, [src, sort, shown, list.length]);
  if (failed) {
    return React.createElement("div", {
      className: "btv"
    }, React.createElement("p", {
      className: "btv-note"
    }, "The questions could not be loaded.", " ", React.createElement("button", {
      type: "button",
      className: "btv-retry",
      onClick: () => setTries(n => n + 1)
    }, "Try again")));
  }
  if (!src) return React.createElement("div", {
    className: "btv"
  }, React.createElement("p", {
    className: "btv-note"
  }, "Loading the questions\u2026"));
  if (!topics.length) return React.createElement("div", {
    className: "btv"
  }, React.createElement("p", {
    className: "btv-note"
  }, "No questions are on file yet."));
  const houses = src.houses || {};
  const more = topics.reduce((n, t) => n + t.more.length, 0);
  return React.createElement("div", {
    className: "btv"
  }, !ql && React.createElement(BtvFindings, {
    topics: topics,
    onGo: onGo
  }), React.createElement("div", {
    className: "btv-bar"
  }, React.createElement(BtvSearch, {
    q: q,
    onQ: setQ
  })), !ql && React.createElement(BtvSort, {
    sort: sort,
    onSort: setSort
  }), !ql && React.createElement("p", {
    className: "btv-scope"
  }, src.counts.featured, " questions in charts and answers, and ", more, " more in the topics\u2019 lists, from ", btvWord(Object.keys(houses).length), " pollsters", " ", "since ", btvMonth(src.first), ". Every figure names its pollster, its dates and its sample, and links to its source."), ql ? React.createElement(BtvResults, {
    q: dq.trim(),
    hits: hits,
    houses: houses
  }) : groups ? groups.slice(0, shown).map(g => React.createElement(BtvGroup, {
    key: g.id,
    g: g,
    houses: houses,
    byHouse: sort === "pollster"
  })) : topics.slice(0, shown).map((t, i) => React.createElement(BtvTopic, {
    key: t.id,
    t: t,
    n: btvNo(i),
    houses: houses
  })), React.createElement("div", {
    className: "btv-how"
  }, React.createElement("p", null, React.createElement("b", null, "How the findings are called."), " Each topic opens with what its first chart or question found. A side is said to lead only where the gap clears the poll\u2019s 95% margin of error, and to be a majority only where its share clears half by its own margin; inside the margin, the answer is \u201Clevel\u201D and the voters \u201Cdivided\u201D."), React.createElement("p", null, React.createElement("b", null, "How to read the answers."), " Each bar is one poll\u2019s answers on a scale of 0 to 100, as the pollster printed them, with the agreeing side on the left and the disagreeing side on the right; stronger answers are in full colour, milder ones faded. In the charts, each line joins one pollster\u2019s own readings and is coloured by how that pollster asked. Pollsters word their questions differently, so compare a pollster with itself before comparing it with another."), React.createElement("p", null, React.createElement("b", null, "What is left out."), " Questions about sport, holidays and personal habits, state politics, surveys run before this term, and questions the main page already tracks, such as whether the country is heading in the right direction.")));
}
function RdBeyond() {
  return React.createElement("section", {
    className: "rd-sec rd-btv",
    id: "public-opinion",
    "aria-labelledby": "rd-btv-t"
  }, React.createElement("div", {
    className: "rd-eyebrow"
  }, React.createElement("h2", {
    className: "rd-title",
    id: "rd-btv-t"
  }, "Public opinion"), React.createElement("span", {
    className: "rd-meta"
  }, "What else Australians tell the pollsters")), React.createElement(RdHed, {
    head: window.AP.PAGE_HEAD["public-opinion"],
    dek: "Voting intention is only part of what the pollsters ask. This page gathers the rest of this term’s questions worth knowing, in " + rdNumWord(window.AUSPOL.beyondTopics) + " topics from Donald Trump and immigration to the budget, the Iran war and the Bondi attack. Each opens with what the polls found; where several pollsters asked the same thing, their answers sit side by side."
  }), React.createElement(BtvBody, null));
}
const RdBeyondM = React.memo(RdBeyond);
const BtvBodyM = React.memo(BtvBody);
Object.assign(window, {
  RdBeyond: RdBeyondM,
  BtvBody: BtvBodyM
});