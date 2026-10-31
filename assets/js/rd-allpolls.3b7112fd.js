function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const rdApFlows = contest => window.AUSPOL.flowTables[contest === "onp" ? "onp" : "lnp"];
const rdApDeff = () => {
  const L = window.AUSPOL.latest;
  return L && L.method && L.method.deff || 1.6;
};
function rdPollMargin(p, contest, pub) {
  const n = p.sampleEff || (p.sample ? p.sample / rdApDeff() : 0);
  if (!n) return null;
  if (pub) {
    const a = contest === "onp" ? p.tppAlt ? p.tppAlt.alp : null : p.alpN;
    return a == null ? null : 196 * Math.sqrt(a / 100 * (1 - a / 100) / n);
  }
  const q = p.p || {};
  if (["alp", "lnp", "grn", "onp"].some(k => q[k] == null)) return null;
  const F = rdApFlows(contest);
  const ks = Object.keys(F);
  const tot = ks.reduce((s, k) => s + (q[k] || 0), 0);
  if (!tot) return null;
  let e1 = 0,
    e2 = 0;
  ks.forEach(k => {
    const s = (q[k] || 0) / tot;
    e1 += s * F[k];
    e2 += s * F[k] * F[k];
  });
  return 196 * Math.sqrt(Math.max(0, e2 - e1 * e1) / n);
}
function rdMarginBasis(p) {
  if (p.sampleEff != null) return "from its effective sample of " + p.sampleEff.toLocaleString();
  if (!p.sample) return null;
  const n = Math.round(p.sample / rdApDeff() / 10) * 10;
  return "assuming its " + p.sample.toLocaleString() + " respondents are worth about " + n.toLocaleString() + (rdEffTbc(p) ? ", until its effective sample is out" : ", as " + p.pollster + " published no effective sample for this poll");
}
const rdApNum = v => v == null ? "—" : String(+(+v).toFixed(1));
const rdApPrimFig = v => {
  if (v == null) return "—";
  const [i, f] = (+v).toFixed(1).split(".");
  if (f === "0") return i;
  if (f === "5") return React.createElement("span", {
    className: "rd-ap-halfwrap"
  }, i, React.createElement("b", {
    className: "rd-ap-frac rd-ap-half"
  }, "\xBD"));
  return React.createElement(React.Fragment, null, i, React.createElement("b", {
    className: "rd-ap-frac"
  }, "." + f));
};
function rdApChg(d, dec) {
  if (d == null) return null;
  if (Math.abs(d) < (dec ? 0.05 : 0.5)) return dec ? 0 .toFixed(dec) : "0";
  return (d > 0 ? "▲ " : "▼ ") + (dec ? Math.abs(d).toFixed(dec) : String(Math.abs(Math.round(d))));
}
const rdApTick = v => (v < 0 ? "−" : "") + Math.abs(v);
function rdApFig(p, onM, pub) {
  const imp = onM ? p.alpOnImp : p.alpImp;
  const pa = onM ? p.tppAlt ? p.tppAlt.alp : null : p.alp;
  const pb = onM ? p.tppAlt ? p.tppAlt.onp : null : p.lnp;
  const pubPair = pa != null && pb != null ? rdApNum(pa) + "–" + rdApNum(pb) : null;
  if (pub) {
    return {
      a: pa,
      b: pb,
      txtA: rdApNum(pa),
      txtB: rdApNum(pb),
      sub: imp != null ? "implied " + imp.toFixed(1) + "–" + (100 - imp).toFixed(1) : null,
      none: onM ? "no head-to-head published" : "no two-party figure published"
    };
  }
  const q = p.p || {};
  return {
    a: imp,
    b: imp != null ? 100 - imp : null,
    txtA: imp != null ? imp.toFixed(1) : "—",
    txtB: imp != null ? (100 - imp).toFixed(1) : "—",
    sub: pubPair ? "published " + pubPair : null,
    none: q.alp == null ? "no primaries published" : ["lnp", "grn", "onp"].every(k => q[k] != null) ? "primaries don’t add to 100" : "not every primary published"
  };
}
const rdApLeanDot = (v, onM) => v == null || Math.abs(v) < 0.05 ? "var(--ink-3)" : v > 0 ? "var(--alp)" : onM ? "var(--onp)" : "var(--lnp)";
const rdApLeanInk = (v, onM) => v == null || Math.abs(v) < 0.05 ? "var(--ink-3)" : v > 0 ? "var(--alp-text)" : onM ? "var(--onp-text)" : "var(--lnp-text)";
const rdApSigned = v => Math.abs(v) < 0.05 ? "0.0" : rdSigned(v, 1);
const rdApDays = iso => Date.parse(String(iso).slice(0, 10) + "T00:00:00Z");
const rdApWinMid = p => p.mid != null ? p.mid : rdApDays(p.released);
const RD_AP_WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function rdApOut(stamp) {
  if (!stamp) return null;
  const D = window.AUSPOL;
  const t = new Date(rdApDays(stamp));
  let s = RD_AP_WEEKDAY[t.getUTCDay()] + " " + t.getUTCDate() + " " + D.monthName(t.getUTCMonth() + 1);
  const h = /T(\d\d):/.exec(stamp);
  if (h) {
    const hr = Number(h[1]);
    s += ", " + (hr % 12 || 12) + (hr < 12 ? " am" : " pm");
  }
  return s;
}
function rdEffNote(p) {
  const missing = rdEffMissing(p);
  const note = missing ? "The pollster publishes an effective sample, but none for this poll" : "The pollster publishes an effective sample, but not yet for this poll";
  const word = missing ? "missing" : "TBC";
  const url = (window.AUSPOL.effTbcUrls || {})[String(p.pollster || "").replace(/\s*\(.*\)$/, "")];
  return React.createElement(React.Fragment, null, "eff. ", url ? React.createElement("a", {
    className: "rd-tbc",
    href: url,
    target: "_blank",
    rel: "noopener noreferrer",
    title: note,
    onClick: e => e.stopPropagation()
  }, word) : React.createElement("span", {
    title: note
  }, word));
}
const rdFieldTxt = q => q && q.fieldPending ? "TBC" : q && (q.field || q.dateLabel) || "";
function rdFieldTbc(p, tabIndex) {
  const note = "Fieldwork dates not yet published for this poll; it is placed by provisional dates until they are";
  return p.fieldUrl ? React.createElement("a", {
    className: "rd-tbc",
    href: p.fieldUrl,
    target: "_blank",
    rel: "noopener noreferrer",
    title: note,
    tabIndex: tabIndex,
    onClick: e => e.stopPropagation()
  }, "TBC") : React.createElement("span", {
    title: note
  }, "TBC");
}
const RD_AP_BARE_CLIENTS = {
  News24: 1,
  "Capital Brief": 1,
  "News.com.au": 1,
  "News Australia": 1,
  Amplify: 1
};
const rdApThe = name => /^the /i.test(name) || RD_AP_BARE_CLIENTS[name] ? name : "the " + name;
const RD_AP_COMMISSIONED = {
  "Blueprint Institute": 1,
  "Climate Council": 1,
  "Australia Inst.": 1,
  Amplify: 1
};
function rdPollHead(p) {
  const effTag = rdEffTbc(p) || rdEffMissing(p);
  const n = p.sample != null ? React.createElement(React.Fragment, null, "a sample of ", React.createElement("span", {
    className: "rd-nocaps"
  }, p.sample.toLocaleString(), p.sampleEff != null ? " (eff. " + p.sampleEff.toLocaleString() + ")" : effTag ? React.createElement(React.Fragment, null, " (", rdEffNote(p), ")") : "")) : "an unpublished sample";
  const out = rdApOut(p.published);
  const selfBy = p.conf || !(p.client && !/^self/i.test(p.client));
  const commissioned = !selfBy && RD_AP_COMMISSIONED[p.client];
  const by = (commissioned ? "commissioned by " : "published by ") + (selfBy ? p.pollster : rdApThe(p.client));
  const field = p.field || p.dateLabel;
  if (p.fieldPending) return React.createElement(React.Fragment, null, "Conducted on dates ", rdFieldTbc(p), " from ", n, ", " + by + (out ? " on " + out : ""));
  return React.createElement(React.Fragment, null, field ? "Conducted on " + field + " from " : "From ", n, ", " + by + (out ? " on " + out : ""));
}
const RD_AP_PRIM_META = {
  alp: {
    lab: "ALP",
    ink: "var(--alp-text)",
    dot: "var(--alp)"
  },
  lnp: {
    lab: "L/NP",
    ink: "var(--lnp-text)",
    dot: "var(--lnp)"
  },
  grn: {
    lab: "GRN",
    ink: "var(--grn-text)",
    dot: "var(--grn)"
  },
  onp: {
    lab: "ON",
    ink: "var(--onp-text)",
    dot: "var(--onp)"
  },
  ind: {
    lab: "IND",
    ink: "var(--ink-2)",
    dot: "var(--oth)"
  },
  oth: {
    lab: "OTH",
    ink: "var(--ink-2)",
    dot: "var(--oth)"
  }
};
const RD_AP_PRIM_FALLBACK = ["alp", "lnp", "grn", "onp", "oth"];
const rdApPrimList = ids => ids.filter(id => id in RD_AP_PRIM_META).map(id => ({
  id,
  ...RD_AP_PRIM_META[id]
}));
const RD_AP_TAGS = {
  "2pp": {
    label: "A two-party figure",
    note: "One head-to-head, usually Labor v Coalition"
  },
  "2x2pp": {
    label: "Two two-party figures",
    note: "Labor v Coalition and Labor v One Nation"
  },
  "3x2pp": {
    label: "All three head-to-heads",
    note: "Including Coalition v One Nation"
  },
  "3pp": {
    label: "A three-cornered figure",
    note: "Labor, Coalition and One Nation in one split"
  },
  ppm: {
    label: window.JUR ? "Better " + window.JUR.office.alb : "Better prime minister"
  },
  aprv: {
    label: "Leader approval"
  },
  fav: {
    label: "Leader favourability"
  },
  seats: {
    label: "A seat projection",
    note: "Modelled seat counts"
  },
  dir: {
    label: "Right direction or wrong track"
  },
  iss: {
    label: "Issues",
    note: "What voters say matters, and the party rated best on each"
  }
};
const rdApTagLab = id => RD_AP_TAGS[id] ? RD_AP_TAGS[id].label : id;
const RD_AP_M = 6;
const rdApX = v => (Math.max(-RD_AP_M, Math.min(RD_AP_M, v)) + RD_AP_M) / (2 * RD_AP_M) * 100;
function RdApStrip({
  lean,
  moe,
  he,
  onM,
  tip,
  phone,
  ink
}) {
  const grid = phone ? [-3, 3] : [-4, -2, 2, 4];
  const lo = lean != null && moe != null ? lean - moe : null;
  const hi = lean != null && moe != null ? lean + moe : null;
  return React.createElement("span", {
    className: "rd-ap-in"
  }, grid.map(v => React.createElement("i", {
    key: v,
    className: "rd-ap-gl",
    style: {
      left: rdApX(v) + "%"
    }
  })), React.createElement("i", {
    className: "rd-ap-avg",
    style: {
      left: "50%"
    }
  }), he != null && Math.abs(he) >= 0.05 && React.createElement("i", {
    className: "rd-ap-he",
    style: {
      left: rdApX(he) + "%"
    }
  }), lo != null && React.createElement("i", {
    className: "rd-ap-wh",
    style: {
      left: rdApX(lo) + "%",
      width: rdApX(hi) - rdApX(lo) + "%"
    }
  }), lo != null && React.createElement("i", {
    className: "rd-ap-clip l" + (lo < -RD_AP_M ? " on" : "")
  }), hi != null && React.createElement("i", {
    className: "rd-ap-clip r" + (hi > RD_AP_M ? " on" : "")
  }), lean != null && React.createElement("i", {
    className: "rd-ap-dot",
    style: {
      left: rdApX(lean) + "%",
      background: ink || rdApLeanDot(lean, onM)
    }
  }), tip);
}
function RdApScale({
  onM,
  phone
}) {
  const ticks = phone ? [[-6, "6"], [-3, "3"], [0, "Average"], [3, "3"], [6, "6 pts"]] : [[-6, "6 pts"], [-4, "4"], [-2, "2"], [0, "Average"], [2, "2"], [4, "4"], [6, "6 pts"]];
  return React.createElement("span", {
    className: "rd-ap-scale",
    "aria-hidden": "true"
  }, React.createElement("span", {
    className: "rd-ap-in"
  }, React.createElement("b", {
    className: "rd-ap-scl",
    style: {
      color: onM ? "var(--onp-text)" : "var(--lnp-text)"
    }
  }, "\u25C0 ", React.createElement("span", {
    className: "rd-ap-long"
  }, "Leans to "), onM ? "One Nation" : phone ? "Coalition" : React.createElement(React.Fragment, null, React.createElement("span", {
    className: "rd-ap-long"
  }, "the "), "Coalition")), React.createElement("b", {
    className: "rd-ap-scr",
    style: {
      color: "var(--alp-text)"
    }
  }, React.createElement("span", {
    className: "rd-ap-long"
  }, "Leans to "), "Labor \u25B6"), ticks.map(([v, lab]) => React.createElement("span", {
    key: v,
    className: "rd-ap-tk" + (v === 0 ? " mid" : "") + (phone && v === -6 ? " start" : "") + (phone && v === 6 ? " end" : ""),
    style: {
      left: rdApX(v) + "%"
    }
  }, lab))));
}
const rdApYdKey = (onM, pub) => pub ? onM ? "onp" : "lnp" : onM ? "onimp" : "imp";
const rdApYd = (p, onM, pub) => p.yd && p.yd[rdApYdKey(onM, pub)] || null;
const rdApInside = (gap, moe) => {
  if (gap == null || moe == null) return null;
  const g = Math.round(Math.abs(gap) * 10),
    m = Math.round(moe * 10);
  return 2 * g < m ? "well inside" : g <= m ? "inside" : "outside";
};
const rdApAgainst = pub => RD_AP_KAL ? "the trend through the other polls" : "the average of the other " + (pub ? "published figures" : "polls") + " fielded within three weeks of it";
const rdApTickStep = (lo, hi) => hi - lo > 24 ? hi - lo > 48 ? 10 : 8 : 4;
const rdApBreakable = name => String(name).replace(/\//g, "/\u200b");
const rdApHe = (p, onM, pub) => {
  const y = rdApYd(p, onM, pub);
  return y && y.he != null ? Math.round(y.he * 10) / 10 : null;
};
const rdApAdj = (p, onM, pub) => {
  const h = rdApHe(p, onM, pub);
  return p.lean == null ? null : h == null ? p.lean : Math.round((p.lean - h) * 10) / 10;
};
const rdApR1 = v => v == null ? null : Math.round(v * 10) / 10;
function rdApYdLine(line, y, xm, t0, t1) {
  const vs = (line || []).map(r => r[1]);
  if (y && y.p) y.p.v.forEach((v, j) => {
    vs[y.p.i + j] = v;
  });
  let rows = (line || []).map((r, i) => ({
    ym: r[0],
    x: rdApDays(r[0]),
    v: vs[i]
  })).filter(a => a.v != null && a.x >= t0 && a.x <= t1);
  if (y && xm >= t0 && xm <= t1) rows = rows.filter(a => a.x !== xm).concat([{
    ym: new Date(xm).toISOString().slice(0, 10),
    x: xm,
    v: y.v
  }]).sort((a, b) => a.x - b.x);
  return rows;
}
function RdApMini({
  p,
  onM,
  pub
}) {
  const D = window.AUSPOL;
  const box = React.useRef(null);
  const W = useRdWidth(box, 470);
  const H = 176;
  const iM = D.MONTHS.indexOf(p.ym);
  const ms = D.MONTHS.slice(Math.max(0, iM - 6), iM + 1);
  const t0 = rdApDays(ms[0] + "-01");
  const [ly, lm] = ms[ms.length - 1].split("-").map(Number);
  const t1 = Date.UTC(ly, lm, 1) - 864e5;
  const sceneOf = key => {
    const [o, pb] = key.split("|").map(v => v === "1");
    const valOf = q => pb ? o ? q.tppAlt ? q.tppAlt.alp : null : q.alpN : o ? q.alpOnImp : q.alpImp;
    const mine = D.individualPolls.filter(q => q.pollster === p.pollster && valOf(q) != null && rdApDays(q.fmid || q.released) >= t0 && rdApDays(q.fmid || q.released) <= t1);
    const avg = rdApYdLine((D.yardLine || {})[rdApYdKey(o, pb)], rdApYd(p, o, pb), rdApDays(p.fmid || p.released), t0, t1);
    const vals = mine.map(valOf).concat(avg.map(a => a.v));
    const own = valOf(p);
    if (!vals.length || own == null) return null;
    let lo = Math.floor(Math.min(...vals) / 2) * 2,
      hi = Math.ceil(Math.max(...vals) / 2) * 2;
    if (hi - lo < 6) {
      const c = (hi + lo) / 2;
      lo = Math.floor((c - 3) / 2) * 2;
      hi = lo + 6;
    }
    return {
      o,
      pb,
      valOf,
      mine,
      avg,
      own,
      lo,
      hi
    };
  };
  const key = (onM ? "1" : "0") + "|" + (pub ? "1" : "0");
  const m = window.AP.useValueMorph(key);
  const [tip, setTip] = useState(null);
  const tipBox = React.useRef(null);
  const ptr = React.useRef(null);
  React.useLayoutEffect(() => {
    const el = tipBox.current;
    if (!el) return;
    el.style.marginLeft = "0px";
    const r = el.getBoundingClientRect();
    const off = Math.min(0, window.innerWidth - 8 - r.right) - Math.min(0, r.left - 8);
    if (off) el.style.marginLeft = off + "px";
  }, [tip]);
  const S = sceneOf(key);
  const A = m ? sceneOf(m.from) : null;
  const t = m && A ? m.t : 1;
  if (!S) return React.createElement("div", {
    ref: box
  });
  const mix = (a, b) => A ? a + (b - a) * t : b;
  const lo = mix(A ? A.lo : 0, S.lo),
    hi = mix(A ? A.hi : 0, S.hi);
  const x0 = 30,
    x1 = W - 16,
    top = 10,
    bot = H - 26;
  const X = tt => x0 + (tt - t0) / (t1 - t0) * (x1 - x0);
  const Y = v => bot - (v - lo) / (hi - lo) * (bot - top);
  const ticks = [];
  for (let v = S.lo; v <= S.hi + 1e-9; v += 2) ticks.push(v);
  if (A) for (let v = A.lo; v <= A.hi + 1e-9; v += 2) if (!ticks.includes(v)) ticks.push(v);
  const tickOp = v => {
    const y = Y(v);
    return y < top - 0.5 ? Math.max(0, 1 - (top - y) / 14) : y > bot + 0.5 ? Math.max(0, 1 - (y - bot) / 14) : 1;
  };
  const own = mix(A ? A.own : 0, S.own);
  const cx = X(rdApDays(p.fmid || p.released)),
    cy = Y(own);
  const labLeft = cx > W * 0.45;
  const rival = onM ? "One Nation" : "Coalition";
  const outLabel = q => {
    const d = new Date(rdApDays(q.released));
    return d.getUTCDate() + " " + D.monthName(d.getUTCMonth() + 1);
  };
  const show = (id, src) => setTip({
    id,
    src
  });
  const hide = (id, src) => setTip(tp => tp && tp.id === id && (!src || tp.src === src) ? null : tp);
  const dotsOf = sc => {
    const seen = {};
    return sc.mine.filter(q => q.released !== p.released).map(q => {
      const raw = window.AP && window.AP.pollRowKey ? window.AP.pollRowKey({
        pollster: q.pollster,
        released: q.released
      }) : null;
      const dup = sc.mine.some(z => z !== q && z.pollster === q.pollster && z.released === q.released);
      const key2 = !raw || dup ? null : raw;
      const id = q.pollster + "|" + q.released + "#" + (seen[q.released] = (seen[q.released] || 0) + 1);
      return {
        q,
        key: key2,
        id,
        cx: X(rdApDays(q.fmid || q.released)),
        a: sc.valOf(q)
      };
    });
  };
  const now = dotsOf(S);
  const was = A ? new Map(dotsOf(A).map(d => [d.id, d])) : null;
  const dots = now.map(d => {
    const w = was && was.get(d.id);
    if (was) was.delete(d.id);
    return {
      ...d,
      cy: Y(w ? w.a + (d.a - w.a) * t : d.a),
      op: was && !w ? t : 1
    };
  });
  if (was) was.forEach(d => dots.push({
    ...d,
    key: null,
    cy: Y(d.a),
    op: 1 - t,
    leaving: true
  }));
  const avgBl = A && A.avg.length && S.avg.length ? window.AP.blendRows(A.avg, S.avg, t, ["v"]) : null;
  const avgPts = avgBl ? avgBl.rows : S.avg;
  const avgClip = avgBl ? avgBl.clip : null;
  const clipId = "apm" + React.useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const avgFirst = avgBl ? {
    x: avgClip[0],
    v: avgPts.find(r => r.x >= avgClip[0] - 1) ? avgPts.find(r => r.x >= avgClip[0] - 1).v : avgPts[0].v
  } : S.avg[0];
  const dotTip = tip && !m && (dots.find(d => d.id === tip.id && !d.leaving) || null);
  const ownTxt = sc => "This poll " + sc.own.toFixed(1);
  const ownLab = (txt, op) => React.createElement("text", {
    x: labLeft ? cx - 12 : cx + 12,
    y: cy - 12,
    className: "rd-apd-thislab",
    textAnchor: labLeft ? "end" : "start",
    style: op < 1 ? {
      opacity: op
    } : null
  }, txt);
  return React.createElement("div", {
    ref: box,
    className: "rd-apd-mini"
  }, React.createElement("svg", {
    width: W,
    height: H,
    viewBox: `0 0 ${W} ${H}`,
    role: "img",
    "aria-label": `${p.pollster}’s polls since ${rdMonthYear(ms[0])} against the ${RD_AP_AVG} of every poll; this poll ${S.own.toFixed(1)}.`
  }, avgClip && React.createElement("defs", null, React.createElement("clipPath", {
    id: clipId
  }, React.createElement("rect", {
    x: X(avgClip[0]) - 2,
    y: -20,
    width: Math.max(0, X(avgClip[1]) - X(avgClip[0]) + 4),
    height: H + 40
  }))), ticks.map(v => {
    const op = tickOp(v);
    return op <= 0 ? null : React.createElement("path", {
      key: v,
      d: `M${x0} ${Y(v)}H${x1}`,
      className: v === 50 ? "rd-apd-even" : "rd-apd-gl",
      style: op < 1 ? {
        opacity: op
      } : null
    });
  }), ticks.map(v => {
    const op = tickOp(v);
    return op <= 0 ? null : React.createElement("text", {
      key: "t" + v,
      x: x0 - 6,
      y: Y(v) + 4,
      className: "rd-apd-ax",
      textAnchor: "end",
      style: op < 1 ? {
        opacity: op
      } : null
    }, rdApTick(v));
  }), avgPts.length > 1 && React.createElement("path", {
    d: monotoneXY(avgPts.map(a => [X(a.x), Y(a.v)])),
    className: "rd-apd-avgline",
    clipPath: avgClip ? `url(#${clipId})` : undefined
  }), avgFirst && React.createElement("text", {
    x: X(avgFirst.x),
    y: Y(avgFirst.v) - 9,
    className: "rd-apd-lab"
  }, RD_AP_KAL ? "Trend" : "Average"), dots.map(d => {
    const {
      id,
      key: k
    } = d;
    const open = () => {
      if (k && window.AP.openPoll) {
        setTip(null);
        window.AP.openPoll(k, "twopp", "the poll you were reading");
      }
    };
    if (d.leaving) return React.createElement("g", {
      key: id + "|out",
      style: {
        opacity: d.op
      }
    }, React.createElement("circle", {
      cx: d.cx,
      cy: d.cy,
      r: "4",
      className: "rd-apd-dot"
    }));
    return React.createElement("g", {
      key: id,
      style: d.op < 1 ? {
        opacity: d.op
      } : null
    }, tip && tip.id === id && React.createElement("circle", {
      cx: d.cx,
      cy: d.cy,
      r: "7.5",
      className: "rd-apd-dothi"
    }), React.createElement("circle", {
      cx: d.cx,
      cy: d.cy,
      r: "4",
      className: "rd-apd-dot"
    }), React.createElement("circle", {
      cx: d.cx,
      cy: d.cy,
      r: "9",
      className: "rd-apd-hit" + (k ? " link" : ""),
      tabIndex: "0",
      role: k ? "button" : "img",
      "aria-label": (pub ? "Published" : "Implied") + " Labor two-party " + d.a.toFixed(1) + " against " + rival + ", " + p.pollster + "’s poll of " + outLabel(d.q) + (k ? "; press Enter to open it" : ""),
      onPointerDown: ev => {
        ptr.current = ev.pointerType;
      },
      onPointerEnter: ev => {
        if (ev.pointerType === "mouse") show(id, "mouse");
      },
      onPointerLeave: ev => {
        if (ev.pointerType === "mouse") hide(id, "mouse");
      },
      onFocus: ev => {
        if (ev.target.matches(":focus-visible")) show(id, "focus");
      },
      onBlur: () => hide(id, "focus"),
      onClick: ev => {
        ev.stopPropagation();
        const pt = ev.detail === 0 ? "key" : ptr.current;
        ptr.current = null;
        if (pt === "mouse" || pt === "key") {
          open();
          return;
        }
        if (tip && tip.id === id) setTip(null);else setTip({
          id,
          src: "touch"
        });
      },
      onKeyDown: ev => {
        if (ev.key !== "Enter" && ev.key !== " " && ev.key !== "Spacebar") return;
        ev.preventDefault();
        open();
      }
    }));
  }), React.createElement("circle", {
    cx: cx,
    cy: cy,
    r: "8",
    className: "rd-apd-ring"
  }), React.createElement("circle", {
    cx: cx,
    cy: cy,
    r: "4.5",
    className: "rd-apd-this"
  }), A && A.own !== S.own ? React.createElement(React.Fragment, null, ownLab(ownTxt(A), 1 - t), ownLab(ownTxt(S), t)) : ownLab(ownTxt(S), 1), React.createElement("path", {
    d: `M${x0} ${bot}H${x1}`,
    className: "rd-apd-base"
  }), ms.map((ym, i) => i % 2 === (ms.length - 1) % 2 ? React.createElement("text", {
    key: ym,
    x: X(rdApDays(ym + "-01")),
    y: bot + 18,
    className: "rd-apd-ax",
    textAnchor: "middle"
  }, D.monthName(Number(ym.slice(5)))) : null)), dotTip && (() => {
    const d = dotTip;
    return React.createElement("div", {
      ref: tipBox,
      className: "tip rd-apd-tip",
      style: {
        left: d.cx + "px"
      },
      "aria-hidden": "true"
    }, React.createElement("div", {
      className: "tip-title"
    }, d.q.fieldPending ? "TBC" : "Fieldwork " + (rdFieldTxt(d.q) || d.q.released)), React.createElement("div", {
      className: "tip-sub"
    }, "Labor ", d.a.toFixed(1), " \u2013 ", (100 - d.a).toFixed(1), " ", rival, pub ? ", as published" : ""), d.q.sample != null && React.createElement("div", {
      className: "tip-sub"
    }, "n = ", d.q.sample.toLocaleString(), d.q.sampleEff != null ? " (eff. " + d.q.sampleEff.toLocaleString() + ")" : ""), tip.src !== "touch" && (d.key ? React.createElement("div", {
      className: "tip-hint"
    }, tip.src === "focus" ? "Press Enter to open this poll" : "Click to open this poll") : React.createElement("div", {
      className: "tip-hint"
    }, "Released ", outLabel(d.q))));
  })());
}
function RdApDirMini({
  p
}) {
  const D = window.AUSPOL;
  const box = React.useRef(null);
  const W = useRdWidth(box, 470);
  const H = 176;
  const iM = D.MONTHS.indexOf(p.ym);
  const ms = D.MONTHS.slice(Math.max(0, iM - 6), iM + 1);
  const t0 = rdApDays(ms[0] + "-01");
  const [ly, lm] = ms[ms.length - 1].split("-").map(Number);
  const t1 = Date.UTC(ly, lm, 1) - 864e5;
  const netOf = q => q.right - q.wrong;
  const mine = (D.directionPolls || []).filter(q => q.pollster === p.pollster && q.right != null && q.wrong != null && rdApDays(q.fmid || q.released) >= t0 && rdApDays(q.fmid || q.released) <= t1);
  const avg = rdApYdLine((D.yardLine || {}).dir, p.dir ? p.dir.yd : null, rdApDays(p.fmid || p.released), t0, t1);
  const own = p.dir ? p.dir.net : null;
  if (!mine.length || own == null) return React.createElement("div", {
    ref: box
  });
  const vals = mine.map(netOf).concat(avg.map(a => a.v), [0]);
  let lo = Math.floor(Math.min(...vals) / 4) * 4,
    hi = Math.ceil(Math.max(...vals) / 4) * 4;
  if (hi - lo < 8) {
    const c = (lo + hi) / 2;
    lo = Math.floor((c - 4) / 4) * 4;
    hi = lo + 8;
  }
  const step = rdApTickStep(lo, hi);
  lo = Math.floor(lo / step) * step;
  hi = Math.ceil(hi / step) * step;
  const x0 = 30,
    x1 = W - 16,
    top = 10,
    bot = H - 26;
  const X = tt => x0 + (tt - t0) / (t1 - t0) * (x1 - x0);
  const Y = v => bot - (v - lo) / (hi - lo) * (bot - top);
  const ticks = [];
  for (let v = lo; v <= hi + 1e-9; v += step) ticks.push(v);
  const cx = X(rdApDays(p.fmid || p.released)),
    cy = Y(own);
  const labLeft = cx > W * 0.45;
  const [tip, setTip] = useState(null);
  const tipBox = React.useRef(null);
  const ptr = React.useRef(null);
  React.useLayoutEffect(() => {
    const el = tipBox.current;
    if (!el) return;
    el.style.marginLeft = "0px";
    const r = el.getBoundingClientRect();
    const off = Math.min(0, window.innerWidth - 8 - r.right) - Math.min(0, r.left - 8);
    if (off) el.style.marginLeft = off + "px";
  }, [tip]);
  const dots = mine.filter(q => q.released !== p.released).map(q => {
    const raw = window.AP && window.AP.pollRowKey ? window.AP.pollRowKey({
      pollster: q.pollster,
      released: q.released
    }) : null;
    const dup = mine.some(z => z !== q && z.released === q.released);
    return {
      q,
      key: !raw || dup ? null : raw,
      id: q.pollster + "|" + q.released,
      cx: X(rdApDays(q.fmid || q.released)),
      a: netOf(q)
    };
  });
  const show = (id, src) => setTip({
    id,
    src
  });
  const hide = (id, src) => setTip(tp => tp && tp.id === id && (!src || tp.src === src) ? null : tp);
  const dotTip = tip && dots.find(d => d.id === tip.id);
  return React.createElement("div", {
    ref: box,
    className: "rd-apd-mini"
  }, React.createElement("svg", {
    width: W,
    height: H,
    viewBox: `0 0 ${W} ${H}`,
    role: "img",
    "aria-label": `${p.pollster}’s national-direction readings since ${rdMonthYear(ms[0])} as a net, right direction minus wrong track, against the average of every reading; this reading ${rdApSigned(own)}.`
  }, ticks.map(v => React.createElement("path", {
    key: v,
    d: `M${x0} ${Y(v)}H${x1}`,
    className: v === 0 ? "rd-apd-even" : "rd-apd-gl"
  })), ticks.map(v => React.createElement("text", {
    key: "t" + v,
    x: x0 - 6,
    y: Y(v) + 4,
    className: "rd-apd-ax",
    textAnchor: "end"
  }, rdApTick(v))), avg.length > 1 && React.createElement("path", {
    d: monotoneXY(avg.map(a => [X(a.x), Y(a.v)])),
    className: "rd-apd-avgline"
  }), avg.length > 0 && React.createElement("text", {
    x: X(avg[0].x),
    y: Y(avg[0].v) - 9,
    className: "rd-apd-lab"
  }, "Average"), dots.map(d => {
    const open = () => {
      if (d.key && window.AP.openPoll) {
        setTip(null);
        window.AP.openPoll(d.key, "direction", "the reading you were looking at");
      }
    };
    return React.createElement("g", {
      key: d.id
    }, tip && tip.id === d.id && React.createElement("circle", {
      cx: d.cx,
      cy: Y(d.a),
      r: "7.5",
      className: "rd-apd-dothi"
    }), React.createElement("circle", {
      cx: d.cx,
      cy: Y(d.a),
      r: "4",
      className: "rd-apd-dot"
    }), React.createElement("circle", {
      cx: d.cx,
      cy: Y(d.a),
      r: "9",
      className: "rd-apd-hit" + (d.key ? " link" : ""),
      tabIndex: "0",
      role: d.key ? "button" : "img",
      "aria-label": `Net ${rdApSigned(d.a)}, ${p.pollster}’s reading of ${d.q.fieldPending ? "TBC" : d.q.dateLabel || d.q.released}` + (d.key ? "; press Enter to open it" : ""),
      onPointerDown: ev => {
        ptr.current = ev.pointerType;
      },
      onPointerEnter: ev => {
        if (ev.pointerType === "mouse") show(d.id, "mouse");
      },
      onPointerLeave: ev => {
        if (ev.pointerType === "mouse") hide(d.id, "mouse");
      },
      onFocus: ev => {
        if (ev.target.matches(":focus-visible")) show(d.id, "focus");
      },
      onBlur: () => hide(d.id, "focus"),
      onClick: ev => {
        ev.stopPropagation();
        const pt = ev.detail === 0 ? "key" : ptr.current;
        ptr.current = null;
        if (pt === "mouse" || pt === "key") {
          open();
          return;
        }
        if (tip && tip.id === d.id) setTip(null);else setTip({
          id: d.id,
          src: "touch"
        });
      },
      onKeyDown: ev => {
        if (ev.key !== "Enter" && ev.key !== " " && ev.key !== "Spacebar") return;
        ev.preventDefault();
        open();
      }
    }));
  }), React.createElement("circle", {
    cx: cx,
    cy: cy,
    r: "8",
    className: "rd-apd-ring"
  }), React.createElement("circle", {
    cx: cx,
    cy: cy,
    r: "4.5",
    className: "rd-apd-this"
  }), React.createElement("text", {
    x: labLeft ? cx - 12 : cx + 12,
    y: cy - 12,
    className: "rd-apd-thislab",
    textAnchor: labLeft ? "end" : "start"
  }, "This reading " + rdApSigned(own)), React.createElement("path", {
    d: `M${x0} ${bot}H${x1}`,
    className: "rd-apd-base"
  }), ms.map((ym, i) => i % 2 === (ms.length - 1) % 2 ? React.createElement("text", {
    key: ym,
    x: X(rdApDays(ym + "-01")),
    y: bot + 18,
    className: "rd-apd-ax",
    textAnchor: "middle"
  }, D.monthName(Number(ym.slice(5)))) : null)), dotTip && React.createElement("div", {
    ref: tipBox,
    className: "tip rd-apd-tip",
    style: {
      left: dotTip.cx + "px"
    },
    "aria-hidden": "true"
  }, React.createElement("div", {
    className: "tip-title"
  }, dotTip.q.fieldPending ? "TBC" : "Fieldwork " + (rdFieldTxt(dotTip.q) || dotTip.q.released)), React.createElement("div", {
    className: "tip-sub"
  }, "Right direction ", rdApNum(dotTip.q.right), ", wrong track ", rdApNum(dotTip.q.wrong), ": net ", rdApSigned(dotTip.a)), dotTip.q.sample != null && React.createElement("div", {
    className: "tip-sub"
  }, "n = ", dotTip.q.sample.toLocaleString()), tip.src !== "touch" && (dotTip.key ? React.createElement("div", {
    className: "tip-hint"
  }, tip.src === "focus" ? "Press Enter to open this reading" : "Click to open this reading") : null)));
}
function RdApConfMini({
  p
}) {
  const D = window.AUSPOL;
  const c = p.conf;
  const box = React.useRef(null);
  const W = useRdWidth(box, 470);
  const H = 176;
  const iM = D.MONTHS.indexOf(p.ym);
  const ms = D.MONTHS.slice(Math.max(0, iM - 6), iM + 1);
  const t0 = rdApDays(ms[0] + "-01");
  const [ly, lm] = ms[ms.length - 1].split("-").map(Number);
  const t1 = Date.UTC(ly, lm, 1) - 864e5;
  const ser = ((D.confidence || {})[c.k] || {}).polls || [];
  const mine = ser.filter(q => rdApDays(q.released) >= t0 && rdApDays(q.released) <= t1);
  if (!mine.length) return React.createElement("div", {
    ref: box
  });
  const fmt = v => (v < 0 ? "−" : "") + (Number.isInteger(Math.abs(v)) ? String(Math.abs(v)) : Math.abs(v).toFixed(1));
  const outLabel = q => {
    const d = new Date(rdApDays(q.released));
    return d.getUTCDate() + " " + D.monthName(d.getUTCMonth() + 1);
  };
  const neut = c.vs;
  const vals = mine.map(q => q.v).concat([neut]);
  let lo = Math.floor(Math.min(...vals) / 4) * 4,
    hi = Math.ceil(Math.max(...vals) / 4) * 4;
  if (hi - lo < 8) {
    const cMid = (lo + hi) / 2;
    lo = Math.floor((cMid - 4) / 4) * 4;
    hi = lo + 8;
  }
  const step = rdApTickStep(lo, hi);
  lo = Math.floor(lo / step) * step;
  hi = Math.ceil(hi / step) * step;
  const x0 = 30,
    x1 = W - 16,
    top = 10,
    bot = H - 26;
  const X = tt => x0 + (tt - t0) / (t1 - t0) * (x1 - x0);
  const Y = v => bot - (v - lo) / (hi - lo) * (bot - top);
  const ticks = [];
  for (let v = lo; v <= hi + 1e-9; v += step) ticks.push(v);
  const cx = X(rdApDays(p.released)),
    cy = Y(c.v);
  const labLeft = cx > W * 0.45;
  const [tip, setTip] = useState(null);
  const tipBox = React.useRef(null);
  const ptr = React.useRef(null);
  React.useLayoutEffect(() => {
    const el = tipBox.current;
    if (!el) return;
    el.style.marginLeft = "0px";
    const r = el.getBoundingClientRect();
    const off = Math.min(0, window.innerWidth - 8 - r.right) - Math.min(0, r.left - 8);
    if (off) el.style.marginLeft = off + "px";
  }, [tip]);
  const dots = mine.filter(q => q.released !== p.released).map(q => {
    const raw = window.AP && window.AP.pollRowKey ? window.AP.pollRowKey({
      pollster: p.pollster,
      released: q.released
    }) : null;
    const dup = mine.some(z => z !== q && z.released === q.released);
    return {
      q,
      key: !raw || dup ? null : raw,
      id: q.released,
      cx: X(rdApDays(q.released)),
      a: q.v
    };
  });
  const show = (id, src) => setTip({
    id,
    src
  });
  const hide = (id, src) => setTip(tp => tp && tp.id === id && (!src || tp.src === src) ? null : tp);
  const dotTip = tip && dots.find(d => d.id === tip.id);
  return React.createElement("div", {
    ref: box,
    className: "rd-apd-mini"
  }, React.createElement("svg", {
    width: W,
    height: H,
    viewBox: `0 0 ${W} ${H}`,
    role: "img",
    "aria-label": `${c.lab} releases since ${D.monthName(+ms[0].slice(5, 7)) + " " + ms[0].slice(0, 4)}, as published; this release ${fmt(c.v)}${neut === 0 ? ", a net balance, 0 neutral" : ", 100 neutral"}.`
  }, ticks.map(v => React.createElement("path", {
    key: v,
    d: `M${x0} ${Y(v)}H${x1}`,
    className: v === neut ? "rd-apd-even" : "rd-apd-gl"
  })), ticks.map(v => React.createElement("text", {
    key: "t" + v,
    x: x0 - 6,
    y: Y(v) + 4,
    className: "rd-apd-ax",
    textAnchor: "end"
  }, rdApTick(v))), dots.map(d => {
    const open = () => {
      if (d.key && window.AP.openPoll) {
        setTip(null);
        window.AP.openPoll(d.key, "confidence", "the release you were looking at");
      }
    };
    return React.createElement("g", {
      key: d.id
    }, tip && tip.id === d.id && React.createElement("circle", {
      cx: d.cx,
      cy: Y(d.a),
      r: "7.5",
      className: "rd-apd-dothi"
    }), React.createElement("circle", {
      cx: d.cx,
      cy: Y(d.a),
      r: "4",
      className: "rd-apd-dot"
    }), React.createElement("circle", {
      cx: d.cx,
      cy: Y(d.a),
      r: "9",
      className: "rd-apd-hit" + (d.key ? " link" : ""),
      tabIndex: "0",
      role: d.key ? "button" : "img",
      "aria-label": `${fmt(d.a)}, ${c.lab} released ${outLabel(d.q)}` + (d.key ? "; press Enter to open it" : ""),
      onPointerDown: ev => {
        ptr.current = ev.pointerType;
      },
      onPointerEnter: ev => {
        if (ev.pointerType === "mouse") show(d.id, "mouse");
      },
      onPointerLeave: ev => {
        if (ev.pointerType === "mouse") hide(d.id, "mouse");
      },
      onFocus: ev => {
        if (ev.target.matches(":focus-visible")) show(d.id, "focus");
      },
      onBlur: () => hide(d.id, "focus"),
      onClick: ev => {
        ev.stopPropagation();
        const pt = ev.detail === 0 ? "key" : ptr.current;
        ptr.current = null;
        if (pt === "mouse" || pt === "key") {
          open();
          return;
        }
        if (tip && tip.id === d.id) setTip(null);else setTip({
          id: d.id,
          src: "touch"
        });
      },
      onKeyDown: ev => {
        if (ev.key !== "Enter" && ev.key !== " " && ev.key !== "Spacebar") return;
        ev.preventDefault();
        open();
      }
    }));
  }), React.createElement("circle", {
    cx: cx,
    cy: cy,
    r: "8",
    className: "rd-apd-ring"
  }), React.createElement("circle", {
    cx: cx,
    cy: cy,
    r: "4.5",
    className: "rd-apd-this"
  }), React.createElement("text", {
    x: labLeft ? cx - 12 : cx + 12,
    y: cy - 12,
    className: "rd-apd-thislab",
    textAnchor: labLeft ? "end" : "start"
  }, "This release " + fmt(c.v)), React.createElement("path", {
    d: `M${x0} ${bot}H${x1}`,
    className: "rd-apd-base"
  }), ms.map((ym, i) => i % 2 === (ms.length - 1) % 2 ? React.createElement("text", {
    key: ym,
    x: X(rdApDays(ym + "-01")),
    y: bot + 18,
    className: "rd-apd-ax",
    textAnchor: "middle"
  }, D.monthName(Number(ym.slice(5)))) : null)), dotTip && React.createElement("div", {
    ref: tipBox,
    className: "tip rd-apd-tip",
    style: {
      left: dotTip.cx + "px"
    },
    "aria-hidden": "true"
  }, React.createElement("div", {
    className: "tip-title"
  }, "Released ", outLabel(dotTip.q)), React.createElement("div", {
    className: "tip-sub"
  }, c.lab, " ", fmt(dotTip.a), dotTip.q.chg != null ? ", " + (dotTip.q.chg < 0 ? "down " : "up ") + fmt(Math.abs(dotTip.q.chg)) + " on the previous release" : ""), tip.src !== "touch" && (dotTip.key ? React.createElement("div", {
    className: "tip-hint"
  }, tip.src === "focus" ? "Press Enter to open this release" : "Click to open this release") : null)));
}
const RD_AP_LD_RIVALS = [{
  riv: "opp",
  net: "taylorNet",
  met: "taylor",
  he: "opp",
  ln: "taylor",
  ink: "var(--lnp)",
  name: a => a.oppName || "Taylor"
}, {
  riv: "han",
  net: "hansonNet",
  met: "hanson",
  he: "han",
  ln: "hanson",
  ink: "var(--onp)",
  name: a => apWho(a, "hanson", "Hanson")
}];
const rdApPm = a => apWho(a, "alb", "Albanese");
const rdApPmOffice = () => window.JUR ? "the " + window.JUR.office.alb : "Albanese";
const rdApPmNow = () => window.JUR ? (window.AUSPOL.LEADERS.find(l => l.id === "alb") || {}).short : "Albanese";
function rdApLdPairs(a) {
  if (!a || a.albNet == null || !a.metricBy) return [];
  const out = [];
  for (const R of RD_AP_LD_RIVALS) {
    if (a[R.net] == null) continue;
    const met = a.metricBy[R.met];
    if (met !== a.metricBy.alb) continue;
    out.push({
      riv: R.riv,
      R,
      name: R.name(a),
      met,
      ink: R.ink,
      net: a[R.net],
      gap: a.albNet - a[R.net]
    });
  }
  return out;
}
function rdApLdAltPairs(a) {
  const alt = a && a.alt;
  if (!alt || !alt.alb || alt.alb.net == null) return [];
  return RD_AP_LD_RIVALS.filter(R => alt[R.met] && alt[R.met].net != null).map(R => ({
    riv: R.riv,
    R,
    name: R.name(a),
    met: "fav",
    ink: R.ink,
    net: alt[R.met].net,
    gap: alt.alb.net - alt[R.met].net
  }));
}
const rdApLdMetWord = met => met === "fav" ? "net favourability" : "net approval";
function rdApLdWord(waves) {
  const mets = new Set();
  waves.forEach(w => w.pairs.forEach(pr => mets.add(pr.met)));
  return mets.size === 1 ? rdApLdMetWord([...mets][0]) : "net leader ratings";
}
const rdApLdJoin = list => list.length > 2 ? list.slice(0, -1).join(", ") + " and " + list[list.length - 1] : list.join(" and ");
function rdApLdWindow(p) {
  const D = window.AUSPOL;
  const iM = D.MONTHS.indexOf(p.ym);
  const ms = D.MONTHS.slice(Math.max(0, iM - 6), iM + 1);
  const t0 = rdApDays(ms[0] + "-01");
  const [ly, lm] = ms[ms.length - 1].split("-").map(Number);
  const t1 = Date.UTC(ly, lm, 1) - 864e5;
  const waves = D.individualPolls.filter(q => q.pollster === p.pollster && rdApDays(q.fmid || q.released) >= t0 && rdApDays(q.fmid || q.released) <= t1).map(q => ({
    q,
    pairs: rdApLdPairs(q.appr)
  })).filter(w => w.pairs.length);
  return {
    ms,
    t0,
    t1,
    waves
  };
}
const rdApLdWay = (g, name, pm) => Math.abs(g) < 0.05 ? "level" : g > 0 ? (pm || "Albanese") + "’s way" : name + "’s way";
function RdApLdMini({
  p,
  met
}) {
  const D = window.AUSPOL;
  const box = React.useRef(null);
  const W = useRdWidth(box, 470);
  const H = 176;
  const [tip, setTip] = useState(null);
  const tipBox = React.useRef(null);
  const ptr = React.useRef(null);
  React.useLayoutEffect(() => {
    const el = tipBox.current;
    if (!el) return;
    el.style.marginLeft = "0px";
    const r = el.getBoundingClientRect();
    const off = Math.min(0, window.innerWidth - 8 - r.right) - Math.min(0, r.left - 8);
    if (off) el.style.marginLeft = off + "px";
  }, [tip]);
  const {
    ms,
    t0,
    t1,
    waves: full
  } = rdApLdWindow(p);
  const waves = met === "fav" ? full.map(w => ({
    q: w.q,
    pairs: rdApLdAltPairs(w.q.appr)
  })).filter(w => w.pairs.length) : full;
  const own = met === "fav" ? rdApLdAltPairs(p.appr) : rdApLdPairs(p.appr);
  if (!waves.length) return React.createElement("div", {
    ref: box
  });
  const combos = new Set();
  waves.forEach(w => w.pairs.forEach(pr => combos.add(pr.riv + "|" + pr.met)));
  const xm = rdApDays(p.fmid || p.released);
  const avg = [...combos].map(cm => {
    const [riv, met] = cm.split("|");
    const k = riv + "|" + (met === "fav" ? "fav" : "net");
    const L = (D.ldYardLine || {})[k] || [];
    const y = (p.ldYd || {})[k] || null;
    const vs = L.map(r => r[1]);
    if (y && y.p) y.p.v.forEach((v, j) => {
      vs[y.p.i + j] = v;
    });
    let pts = L.map((r, i) => ({
      x: rdApDays(r[0]),
      v: vs[i]
    })).filter(a => a.x >= t0 && a.x <= t1);
    if (y && xm >= t0 && xm <= t1) pts = pts.filter(a => a.x !== xm).concat([{
      x: xm,
      v: y.v
    }]).sort((a, b) => a.x - b.x);
    const brk = ((D.ldYardBreaks || {})[k] || []).map(rdApDays);
    const segs = [];
    let cur = [];
    for (const a of pts) {
      if (a.v == null || cur.length && brk.some(b => cur[cur.length - 1].x < b && a.x >= b)) {
        if (cur.length > 1) segs.push(cur);
        cur = [];
      }
      if (a.v != null) cur.push(a);
    }
    if (cur.length > 1) segs.push(cur);
    return {
      riv,
      met,
      ink: RD_AP_LD_RIVALS.find(r => r.riv === riv).ink,
      segs
    };
  }).filter(al => al.segs.length);
  const vals = waves.flatMap(w => w.pairs.map(pr => pr.gap)).concat(avg.flatMap(al => al.segs.flat().map(z => z.v)), [0]);
  let lo = Math.floor(Math.min(...vals) / 4) * 4,
    hi = Math.ceil(Math.max(...vals) / 4) * 4;
  if (hi - lo < 12) {
    const c = (lo + hi) / 2;
    lo = Math.floor((c - 6) / 4) * 4;
    hi = lo + 12;
  }
  const step = rdApTickStep(lo, hi);
  lo = Math.floor(lo / step) * step;
  hi = Math.ceil(hi / step) * step;
  const x0 = 30,
    x1 = W - 16,
    top = 10,
    bot = H - 26;
  const X = tt => x0 + (tt - t0) / (t1 - t0) * (x1 - x0);
  const Y = v => bot - (v - lo) / (hi - lo) * (bot - top);
  const ticks = [];
  for (let v = lo; v <= hi + 1e-9; v += step) ticks.push(v);
  const cx = X(rdApDays(p.fmid || p.released));
  const labLeft = cx > W * 0.45;
  const dots = waves.filter(w => w.q.released !== p.released).flatMap(w => w.pairs.map(pr => {
    const q = w.q;
    const raw = window.AP && window.AP.pollRowKey ? window.AP.pollRowKey({
      pollster: q.pollster,
      released: q.released
    }) : null;
    const dup = waves.some(z => z.q !== q && z.q.released === q.released);
    return {
      q,
      pr,
      key: !raw || dup ? null : raw,
      id: q.pollster + "|" + q.released + "|" + pr.riv,
      cx: X(rdApDays(q.fmid || q.released))
    };
  }));
  const show = (id, src) => setTip({
    id,
    src
  });
  const hide = (id, src) => setTip(tp => tp && tp.id === id && (!src || tp.src === src) ? null : tp);
  const dotTip = tip && dots.find(d => d.id === tip.id);
  const ownInkOf = pr => pr.ink;
  return React.createElement("div", {
    ref: box,
    className: "rd-apd-mini"
  }, React.createElement("svg", {
    width: W,
    height: H,
    viewBox: `0 0 ${W} ${H}`,
    role: "img",
    "aria-label": `${p.pollster}’s polls since ${rdMonthYear(ms[0])} on the ${rdApLdWord(waves)} gap, ${rdApPmOffice()} minus ${rdApLdJoin([...new Set(waves.flatMap(w => w.pairs.map(pr => pr.name)))])}, against the average of every poll; ${own.length ? "this poll " + own.map(pr => rdApLdWay(pr.gap, pr.name, rdApPm(p.appr))).join(" and ") : "this poll’s own readings are on the other question"}.`
  }, ticks.map(v => React.createElement("path", {
    key: v,
    d: `M${x0} ${Y(v)}H${x1}`,
    className: v === 0 ? "rd-apd-even" : "rd-apd-gl"
  })), ticks.map(v => React.createElement("text", {
    key: "t" + v,
    x: x0 - 6,
    y: Y(v) + 4,
    className: "rd-apd-ax",
    textAnchor: "end"
  }, rdApTick(v))), avg.flatMap(al => al.segs.map((sg, i) => React.createElement("path", {
    key: al.riv + "|" + al.met + "|" + i,
    d: monotoneXY(sg.map(z => [X(z.x), Y(z.v)])),
    className: "rd-apd-avgline",
    style: {
      stroke: `color-mix(in oklab, ${al.ink} 78%, transparent)`,
      strokeDasharray: al.met === "fav" ? "5 4" : undefined
    }
  }))), dots.map(d => {
    const {
      id,
      key: k,
      pr
    } = d;
    const open = () => {
      if (k && window.AP.openPoll) {
        setTip(null);
        window.AP.openPoll(k, "leadership", "the poll you were reading");
      }
    };
    return React.createElement("g", {
      key: id
    }, tip && tip.id === id && React.createElement("circle", {
      cx: d.cx,
      cy: Y(pr.gap),
      r: "7.5",
      className: "rd-apd-dothi"
    }), pr.met === "fav" ? React.createElement("circle", {
      cx: d.cx,
      cy: Y(pr.gap),
      r: "4",
      style: {
        fill: "var(--surface-2)",
        stroke: pr.ink,
        strokeWidth: 1.8
      }
    }) : React.createElement("circle", {
      cx: d.cx,
      cy: Y(pr.gap),
      r: "4",
      style: {
        fill: `color-mix(in oklab, ${pr.ink} 55%, transparent)`
      }
    }), React.createElement("circle", {
      cx: d.cx,
      cy: Y(pr.gap),
      r: "9",
      className: "rd-apd-hit" + (k ? " link" : ""),
      tabIndex: "0",
      role: k ? "button" : "img",
      "aria-label": rdApPm(d.q.appr) + "’s " + rdApLdMetWord(pr.met) + " minus " + pr.name + "’s, " + rdApLdWay(pr.gap, pr.name, rdApPm(d.q.appr)) + ", " + d.q.pollster + "’s poll of " + (d.q.fieldPending ? "TBC" : d.q.field || d.q.released) + (k ? "; press Enter to open it" : ""),
      onPointerDown: ev => {
        ptr.current = ev.pointerType;
      },
      onPointerEnter: ev => {
        if (ev.pointerType === "mouse") show(id, "mouse");
      },
      onPointerLeave: ev => {
        if (ev.pointerType === "mouse") hide(id, "mouse");
      },
      onFocus: ev => {
        if (ev.target.matches(":focus-visible")) show(id, "focus");
      },
      onBlur: () => hide(id, "focus"),
      onClick: ev => {
        ev.stopPropagation();
        const pt = ev.detail === 0 ? "key" : ptr.current;
        ptr.current = null;
        if (pt === "mouse" || pt === "key") {
          open();
          return;
        }
        if (tip && tip.id === id) setTip(null);else setTip({
          id,
          src: "touch"
        });
      },
      onKeyDown: ev => {
        if (ev.key !== "Enter" && ev.key !== " " && ev.key !== "Spacebar") return;
        ev.preventDefault();
        open();
      }
    }));
  }), own.map(pr => {
    const cy = Y(pr.gap);
    const above = own.length === 1 || pr === own.reduce((t, o) => o.gap > t.gap ? o : t, own[0]);
    return React.createElement("g", {
      key: pr.riv
    }, React.createElement("circle", {
      cx: cx,
      cy: cy,
      r: "8",
      className: "rd-apd-ring",
      style: {
        stroke: ownInkOf(pr)
      }
    }), React.createElement("circle", {
      cx: cx,
      cy: cy,
      r: "4.5",
      className: "rd-apd-this",
      style: pr.met === "fav" ? {
        fill: "var(--surface-2)",
        stroke: ownInkOf(pr),
        strokeWidth: 2
      } : {
        fill: ownInkOf(pr)
      }
    }), React.createElement("text", {
      x: labLeft ? cx - 12 : cx + 12,
      y: above ? cy - 12 : cy + 24,
      className: "rd-apd-thislab",
      textAnchor: labLeft ? "end" : "start"
    }, own.length > 1 ? "v " + pr.name + " " : "This poll ", rdApSigned(pr.gap)));
  }), React.createElement("path", {
    d: `M${x0} ${bot}H${x1}`,
    className: "rd-apd-base"
  }), ms.map((ym, i) => i % 2 === (ms.length - 1) % 2 ? React.createElement("text", {
    key: ym,
    x: X(rdApDays(ym + "-01")),
    y: bot + 18,
    className: "rd-apd-ax",
    textAnchor: "middle"
  }, D.monthName(Number(ym.slice(5)))) : null)), dotTip && React.createElement("div", {
    ref: tipBox,
    className: "tip rd-apd-tip",
    style: {
      left: dotTip.cx + "px"
    },
    "aria-hidden": "true"
  }, React.createElement("div", {
    className: "tip-title"
  }, dotTip.q.fieldPending ? "TBC" : "Fieldwork " + (rdFieldTxt(dotTip.q) || dotTip.q.released)), React.createElement("div", {
    className: "tip-sub"
  }, rdApPm(dotTip.q.appr), " ", rdApSigned(dotTip.q.appr.albNet), ", ", dotTip.pr.name, " ", rdApSigned(dotTip.pr.net), " \u2013 ", Math.abs(dotTip.pr.gap).toFixed(1), " points ", rdApLdWay(dotTip.pr.gap, dotTip.pr.name, rdApPm(dotTip.q.appr)), " (", rdApLdMetWord(dotTip.pr.met), ")"), dotTip.q.sample != null && React.createElement("div", {
    className: "tip-sub"
  }, "n = ", dotTip.q.sample.toLocaleString()), tip.src !== "touch" && (dotTip.key ? React.createElement("div", {
    className: "tip-hint"
  }, tip.src === "focus" ? "Press Enter to open this poll" : "Click to open this poll") : null)));
}
function RdApIssMini({
  p
}) {
  const D = window.AUSPOL;
  const box = React.useRef(null);
  const W = useRdWidth(box, 470);
  const H = 176;
  const iss = p.iss || {};
  const item = iss.top && D.issues && D.issues.list ? (Array.isArray(D.issues.list) ? D.issues.list.find(it => it.id === iss.top) : D.issues.list[iss.top]) || null : null;
  if (!item || !item.monthly || item.monthly.length < 2) return React.createElement("div", {
    ref: box
  });
  const iM = D.MONTHS.indexOf(p.ym);
  const ms = D.MONTHS.slice(Math.max(0, iM - 6), iM + 1);
  const t0 = rdApDays(ms[0] + "-01");
  const [ly, lm] = ms[ms.length - 1].split("-").map(Number);
  const t1 = Date.UTC(ly, lm, 1) - 864e5;
  const rows = item.monthly.filter(r => rdApDays(r[0] + "-15") >= t0 && rdApDays(r[0] + "-15") <= t1);
  if (rows.length < 2) return React.createElement("div", {
    ref: box
  });
  const wown = iss.own && iss.own[iss.top] ? iss.own[iss.top] : null;
  const nown = wown ? wown.alp + wown.lnp + wown.onp : 0;
  const own = wown && nown > 0 ? Object.fromEntries(["alp", "lnp", "onp"].map(q => [q, wown[q] * 100 / nown])) : null;
  const vals = rows.flatMap(r => [r[1], r[2], r[3]]).concat(own ? [own.alp, own.lnp, own.onp].filter(v => v != null) : []);
  let lo = Math.floor(Math.min(...vals) / 5) * 5,
    hi = Math.ceil(Math.max(...vals) / 5) * 5;
  if (hi - lo < 15) {
    const c = (lo + hi) / 2;
    lo = Math.max(0, Math.floor((c - 8) / 5) * 5);
    hi = lo + (lo === 0 ? 20 : 16);
  }
  const x0 = 30,
    x1 = W - 16,
    top = 10,
    bot = H - 26;
  const X = tt => x0 + (tt - t0) / (t1 - t0) * (x1 - x0);
  const Y = v => bot - (v - lo) / (hi - lo) * (bot - top);
  const ticks = [];
  for (let v = lo; v <= hi + 1e-9; v += hi - lo > 30 ? 10 : 5) ticks.push(v);
  const PARTIES = [[1, "alp", "var(--alp)"], [2, "lnp", "var(--lnp)"], [3, "onp", "var(--onp)"]];
  const cx = X(rdApDays(p.fmid || p.released || p.published || t1));
  const lab = D.issues.labels && D.issues.labels[iss.top] || iss.top;
  return React.createElement("div", {
    ref: box,
    className: "rd-apd-mini"
  }, React.createElement("svg", {
    width: W,
    height: H,
    viewBox: `0 0 ${W} ${H}`,
    role: "img",
    "aria-label": `The share of those naming one of the three parties rating each of Labor, the Coalition and One Nation best on ${lab}, month by month, and this wave’s own figures on the same basis.`
  }, ticks.map(v => React.createElement("path", {
    key: v,
    d: `M${x0} ${Y(v)}H${x1}`,
    className: v === 0 ? "rd-apd-even" : "rd-apd-gl"
  })), ticks.map(v => React.createElement("text", {
    key: "t" + v,
    x: x0 - 6,
    y: Y(v) + 4,
    className: "rd-apd-ax",
    textAnchor: "end"
  }, rdApTick(v))), PARTIES.map(([i,, ink]) => React.createElement("path", {
    key: i,
    d: monotoneXY(rows.map(r => [X(rdApDays(r[0] + "-15")), Y(r[i])])),
    className: "rd-apd-avgline",
    style: ink ? {
      stroke: `color-mix(in oklab, ${ink} 78%, transparent)`
    } : null
  })), own && PARTIES.map(([, k, ink]) => own[k] != null && React.createElement("g", {
    key: k
  }, React.createElement("circle", {
    cx: cx,
    cy: Y(own[k]),
    r: "7",
    className: "rd-apd-ring",
    style: ink ? {
      stroke: ink
    } : null
  }), React.createElement("circle", {
    cx: cx,
    cy: Y(own[k]),
    r: "3.5",
    className: "rd-apd-this",
    style: ink ? {
      fill: ink
    } : null
  }))), React.createElement("path", {
    d: `M${x0} ${bot}H${x1}`,
    className: "rd-apd-base"
  }), ms.map((ym, i) => i % 2 === (ms.length - 1) % 2 ? React.createElement("text", {
    key: ym,
    x: X(rdApDays(ym + "-01")),
    y: bot + 18,
    className: "rd-apd-ax",
    textAnchor: "middle"
  }, D.monthName(Number(ym.slice(5)))) : null)));
}
function RdApDetail({
  p,
  onM,
  pub,
  today,
  winN,
  facet,
  onBack,
  backLabel,
  demSplit,
  setDemSplit,
  onFacet
}) {
  const D = window.AUSPOL;
  const d = p.dir;
  const contest = onM ? "onp" : "lnp";
  const fig = rdApFig(p, onM, pub);
  const moe = rdPollMargin(p, contest, pub);
  const lean = p.lean;
  const yd = rdApYd(p, onM, pub);
  const ydHe = yd && yd.he != null ? rdApR1(yd.he) : null;
  const adj = lean != null && ydHe != null ? rdApR1(lean - ydHe) : null;
  const sideOf = v => v > 0 ? "Labor’s" : onM ? "One Nation’s" : "the Coalition’s";
  const HL = D.houseLean || {};
  const hlKey = pub ? onM ? "onpub" : "tpp" : onM ? "onimp" : "imp";
  const hs = (HL[hlKey] || {})[p.pollster];
  const hl = hs && hs.length ? hs[hs.length - 1].v : null;
  const effKey = pub ? onM ? "onp" : "lnp" : onM ? "onimp" : "imp";
  const eff = p.eff && p.eff[effKey];
  const move = e => rdApSigned(Math.round((e.hi - e.lo) * 10) / 10);
  const inside = rdApInside(ydHe != null ? adj : lean, moe);
  const yr = p.year != null ? p.year : Number(String(p.released).slice(0, 4));
  const report = "/feedback/?msg=" + encodeURIComponent(`${p.pollster}, ${p.fieldPending ? "TBC" : p.field} ${yr} – `);
  const from = D.MONTHS[Math.max(0, D.MONTHS.indexOf(p.ym) - 6)];
  const isDir = facet === "direction";
  const dirNow = isDir ? D.directionNow || null : null;
  const dEff = isDir && d ? d.eff || null : null;
  const dYd = isDir && d ? d.yd || null : null;
  const dirLean = d && dYd ? rdApR1(d.net - rdApR1(dYd.v)) : null;
  const dirHe = dYd ? rdApR1(dYd.he) : null;
  const dirAdj = dirLean != null && dirHe != null ? rdApR1(dirLean - dirHe) : null;
  const dirMoe = (() => {
    if (!d || !p.sample) return null;
    const pq = Math.max(0, 100 * (d.right + d.wrong) - d.net * d.net);
    return 1.96 * Math.sqrt(pq / (p.sample / rdApDeff()));
  })();
  const insideD = rdApInside(dirHe != null ? dirAdj : dirLean, dirMoe);
  const dirWay = v => v > 0 ? "right-direction" : "wrong-track";
  const dirHl = isDir && d ? ((D.directionHouseEffects || {}).net || {})[p.pollster] || null : null;
  const isIss = facet === "issues";
  const iss = isIss ? p.iss || null : null;
  const issPlus = iss && iss.plus ? iss.plus : null;
  const issPair = issPlus && issPlus.pair != null ? issPlus.pair : null;
  const issLeadMeta = issPlus && issPlus.lead ? window.ISS_PARTY_META[issPlus.lead] || null : null;
  const issPrompted = !!(iss && iss.sal && iss.sal.length);
  const isLd = facet === "leadership";
  const ldOwn = isLd ? rdApLdPairs(p.appr) : [];
  const ldWin = isLd && ldOwn.length ? rdApLdWindow(p) : null;
  const ldWord = ldWin && ldWin.waves.length ? rdApLdWord(ldWin.waves) : null;
  const ldNames = (() => {
    if (!ldWin || !ldWin.waves.length) return ldOwn.map(pr => pr.name);
    const byRiv = {};
    [...ldWin.waves].sort((a, b) => a.q.released.localeCompare(b.q.released)).forEach(w => w.pairs.forEach(pr => {
      const l = byRiv[pr.riv] || (byRiv[pr.riv] = []);
      if (!l.includes(pr.name)) l.push(pr.name);
    }));
    return RD_AP_LD_RIVALS.filter(R => byRiv[R.riv]).map(R => byRiv[R.riv].join(" then "));
  })();
  const ldAltWin = !!(ldWin && ldWin.waves.some(w => rdApLdAltPairs(w.q.appr).length));
  const ldBoth = !!(ldAltWin && ldWin.waves.every(w => w.pairs.every(pr => pr.met === "approval")));
  const [ldMet, setLdMet] = React.useState(null);
  React.useEffect(() => {
    setLdMet(null);
  }, [p.pollster, p.released]);
  const ldAct = ldBoth ? ldMet || "approval" : null;
  const ldHe = isLd ? D.houseEffects && D.houseEffects.appr || null : null;
  const ldLean = isLd && ldHe ? ldOwn.map(pr => {
    const hA = (ldHe.alb || {})[p.pollster],
      hR = (ldHe[pr.R.he] || {})[p.pollster];
    return hA && hR ? {
      name: pr.name,
      met: pr.met,
      v: hA.v - hR.v
    } : null;
  }) : [];
  const ldCmp = ldOwn.map(pr => {
    const y = (p.ldYd || {})[pr.riv + "|" + (pr.met === "fav" ? "fav" : "net")];
    if (!y) return null;
    const og = rdApR1(y.v),
      he = rdApR1(y.he),
      delta = rdApR1(pr.gap - og);
    return {
      ...pr,
      og,
      he,
      delta,
      adj: rdApR1(delta - he)
    };
  });
  const ldNow = isLd && D.leaderNow ? ldOwn.map(pr => {
    const suf = pr.met === "fav" ? "_fav" : "_net";
    const A = D.leaderNow["alb" + suf],
      R = D.leaderNow[pr.R.ln + suf];
    const nm = window.JUR ? (D.LEADERS.find(l => l.id === pr.R.ln) || {}).short || pr.name : pr.name;
    return A && R && A.v != null && R.v != null ? {
      name: nm,
      met: pr.met,
      gap: A.v - R.v,
      a: A.v,
      o: R.v
    } : null;
  }) : [];
  const isDem = facet === "demographics";
  const demTable = (() => {
    if (!isDem || !p.grp || !p.grp.d) return null;
    const K = ["alp", "lnp", "grn", "onp", "oth"];
    const cols = rdApPrimList(D.latest && D.latest.primaryOrder || RD_AP_PRIM_FALLBACK);
    const tot = p.grp.t || null;
    const pr = window.demPairOf(p, demSplit);
    const DN = {
      gender: "Gender",
      age: "Age",
      generation: "Generation",
      education: "Education",
      income: "Income",
      working: "Working status",
      state: "State",
      location: "Location",
      housing: "Housing",
      language: "Language at home",
      country: "Birth country",
      religion: "Religion",
      children: "Children at home",
      class: "Self-assessed class"
    };
    const cell = (v, k) => {
      const t = tot ? tot[K.indexOf(k)] : null;
      const d = v != null && t != null ? v - t : 0;
      return React.createElement("span", {
        role: "cell",
        className: "rd-apd-dv" + (d >= 5 ? " hi" : d <= -5 ? " lo" : "")
      }, v == null ? "—" : rdApNum(v));
    };
    const dims = Object.entries(p.grp.d);
    const per = Math.ceil(dims.reduce((a, [, r]) => a + r.length + 1, 0) / 3);
    const split = [[], [], []];
    let ci = 0,
      n = 0;
    for (const dm of dims) {
      if (n > 0 && n + dm[1].length + 1 > per + 1 && ci < 2) {
        ci++;
        n = 0;
      }
      split[ci].push(dm);
      n += dm[1].length + 1;
    }
    const head = React.createElement("div", {
      className: "rd-apd-demr rd-apd-demh",
      role: "row"
    }, React.createElement("span", null), cols.map(k => React.createElement("span", {
      key: k.id,
      role: "columnheader",
      style: {
        color: k.ink
      }
    }, k.lab)));
    const all = tot && React.createElement("div", {
      className: "rd-apd-demr rd-apd-demall",
      role: "row"
    }, React.createElement("span", {
      role: "rowheader"
    }, "All voters"), cols.map(k => {
      const tv = tot[K.indexOf(k.id)];
      return React.createElement("span", {
        key: k.id,
        role: "cell"
      }, tv == null ? "—" : rdApNum(tv));
    }));
    return React.createElement("div", {
      className: "rd-apd-demwrap"
    }, React.createElement("span", {
      className: "rd-apd-h"
    }, "The vote by group, ", p.grp.r === "measured from the charts" ? "measured off " + p.pollster + "’s charts" : "as " + p.pollster + " printed it"), React.createElement("div", {
      className: "rd-apd-demcols"
    }, split.filter(c => c.length).map((c, i) => React.createElement("div", {
      key: i,
      className: "rd-apd-dem",
      role: "table",
      "aria-label": "The vote by group" + (i ? ", continued" : "")
    }, head, all, c.map(([dim, rows]) => React.createElement(React.Fragment, {
      key: dim
    }, React.createElement("div", {
      className: "rd-apd-demsub",
      role: "row"
    }, React.createElement("span", {
      role: "rowheader"
    }, DN[dim] || dim)), rows.map(([lab, v]) => React.createElement("div", {
      key: lab,
      className: "rd-apd-demr" + (pr && (lab === pr.a || lab === pr.b) ? " on" : ""),
      role: "row"
    }, React.createElement("span", {
      role: "rowheader"
    }, lab), cols.map(k => React.createElement(React.Fragment, {
      key: k.id
    }, cell(v[K.indexOf(k.id)], k.id)))))))))), React.createElement("span", {
      className: "rd-apd-sub rd-apd-note"
    }, "Primary vote within each group, %. Shaded: five points or more above the poll\u2019s all-voters figure; faded: five or more below.", pr ? " Marked: " + pr.a + " and " + pr.b + ", the two groups the row compares." : ""));
  })();
  const demFacts = (() => {
    if (!isDem || !p.grp) return null;
    const G = D.demoGroups || [];
    const raw = Object.values(p.grp.d || {}).flatMap(rows => rows.map(r => r[0]));
    const ar = p.grp.ar || [];
    const pooled = (p.grp.v || []).map((v, i) => v && !ar.includes(G[i]) ? G[i] : null).filter(Boolean);
    const MERGED = ["Below Year 12", "Year 12", "School", "TAFE", "TAFE or college", "SA", "WA", "ACT/NT/Tas"];
    const ageRead = ar.length ? (p.grp.d.age || []).map(r => r[0]) : [];
    const alone = raw.filter(l => !pooled.includes(l) && !MERGED.includes(l) && !ageRead.includes(l));
    const T = D.demographics || {};
    const base = n => n === "RedBridge" ? "RedBridge/Accent" : n;
    const inWin = (T.polls || []).some(q => base(q.pollster) === p.pollster && q.dateLabel === p.field);
    const nCuts = Object.keys(p.grp.d || {}).length;
    return React.createElement(React.Fragment, null, React.createElement("span", {
      className: "rd-apd-k"
    }, "Printed"), React.createElement("span", null, raw.length, " groups across ", rdNumWord(nCuts), " breakdown", nCuts === 1 ? "" : "s", ", ", p.grp.r === "measured from the charts" ? "read off its charts to the nearest point" : "from its own table", "."), React.createElement("span", {
      className: "rd-apd-k"
    }, "In Who votes for whom"), p.grp.x === "reuse" ? React.createElement("span", null, "None of its groups joins the pooled figures: its fieldwork contains ", p.pollster.replace(/ \(MRP\)$/, ""), "\u2019s own regular polls, whose groups already count, and it is taken to reuse their respondents.") : React.createElement("span", null, pooled.length ? React.createElement(React.Fragment, null, pooled.length, " of its groups join") : "None of its groups joins", " the pooled figures", ar.length ? React.createElement(React.Fragment, null, pooled.length ? ", and" : ", but", " its age bands give estimates for ", rdApLdJoin(ar), ", the groups other pollsters print") : "", alone.length ? React.createElement(React.Fragment, null, "; ", rdApLdJoin(alone), " ", alone.length === 1 ? "stays" : "stay", " here alone, since no other pollster draws ", alone.length === 1 ? "that group" : "those groups", " the same way") : "", "."), T.window && React.createElement(React.Fragment, null, React.createElement("span", {
      className: "rd-apd-k"
    }, "In today\u2019s figures"), React.createElement("span", null, inWin ? React.createElement(React.Fragment, null, "One of the polls the panel\u2019s current figures draw on (the last ", T.window, ").") : React.createElement(React.Fragment, null, "Outside the ", T.window, " the panel\u2019s current figures draw on."))));
  })();
  const isConf = facet === "confidence";
  const conf = isConf ? p.conf || null : null;
  const confSer = conf && D.confidence && D.confidence[conf.k] ? D.confidence[conf.k] : null;
  const confFmt = v => (v < 0 ? "−" : "") + (Number.isInteger(Math.abs(v)) ? String(Math.abs(v)) : Math.abs(v).toFixed(1));
  const outLabel = q => {
    const d = new Date(rdApDays(q.released));
    return d.getUTCDate() + " " + D.monthName(d.getUTCMonth() + 1);
  };
  const confPeriod = !conf ? "month" : conf.k === "consumer" ? "week" : "month";
  const confEf = !conf ? null : conf.chg != null && Math.abs(conf.chg) >= 0.05 ? conf.chg : conf.chgCalc != null && Math.abs(conf.chgCalc) >= 0.05 ? conf.chgCalc : null;
  const CONF_BLURB = {
    consumer: "Consumer confidence – who feels optimistic about their finances and the economy, read weekly by ANZ–Roy Morgan.",
    westpacConsumer: "The Westpac–Melbourne Institute’s monthly gauge of household sentiment – the same territory as the weekly consumer index on a slower clock.",
    business: "Business confidence – how firms rate trading conditions and the year ahead, read monthly by Roy Morgan.",
    nabBusiness: "Business confidence as a net balance – optimistic firms minus pessimistic ones – from NAB’s monthly business survey."
  };
  let issTwo = false;
  const issTable = (() => {
    if (!isIss || !p.iss) return null;
    const iq = p.iss;
    const labels = D.issues && D.issues.labels || {};
    const ranked = (iq.sal && iq.sal.length ? iq.sal : iq.conc || []).map(([lab, v, r1], i) => ({
      id: window.ISS_ALIAS[lab] || null,
      lab,
      v,
      r1: r1 != null ? r1 : null,
      rank: i + 1
    }));
    const seen = new Set(ranked.map(r => r.id).filter(Boolean));
    const ownIds = Object.keys(iq.own || {}).concat(iq.bp && !(iq.own && iq.own.col) ? ["col"] : []);
    const pooled = (D.issues && D.issues.list || []).map(x => x.id);
    const order = pooled.filter(id => ownIds.includes(id)).concat(ownIds.filter(id => !pooled.includes(id)));
    const rows = ranked.concat(order.filter(id => !seen.has(id)).map(id => ({
      id,
      lab: labels[id] || id,
      v: null,
      r1: null,
      rank: null
    })));
    const hasR1 = rows.some(r => r.r1 != null);
    const ownOf = r => r.id ? window.issOwnOf(p, r.id) : null;
    const unsure = o => {
      const u = ["unsure", "none", "equal"].filter(k => o && o[k] != null);
      return u.length ? u.reduce((a, k) => a + +o[k], 0) : null;
    };
    const cols = rdApPrimList(D.latest && D.latest.primaryOrder || RD_AP_PRIM_FALLBACK).filter(k => k.id !== "oth" && rows.some(r => {
      const o = ownOf(r);
      return o && o[k.id] != null;
    }));
    const hasUnsure = rows.some(r => unsure(ownOf(r)) != null);
    const hasRank = ranked.length > 0;
    const nNum = (hasRank ? 1 : 0) + (hasR1 ? 1 : 0) + cols.length + (hasUnsure ? 1 : 0);
    const tracks = ["minmax(0, 1fr)"].concat(hasRank ? ["var(--isr-rk)"] : [], hasR1 ? ["var(--isr-p)"] : [], cols.map(() => "var(--isr-p)"), hasUnsure ? ["var(--isr-u)"] : []);
    const parts = rows.length > 9 && nNum <= 4 ? [rows.slice(0, Math.ceil(rows.length / 2)), rows.slice(Math.ceil(rows.length / 2))] : [rows];
    issTwo = parts.length === 2;
    const ordTxt = n => n + (n % 10 === 1 && n % 100 !== 11 ? "st" : n % 10 === 2 && n % 100 !== 12 ? "nd" : n % 10 === 3 && n % 100 !== 13 ? "rd" : "th");
    const rc = "rd-apd-demr rd-apd-isr" + (hasRank ? " rk" : "");
    const head = React.createElement("div", {
      className: rc + " rd-apd-demh",
      role: "row"
    }, React.createElement("span", null), hasRank && React.createElement("span", {
      role: "columnheader"
    }, "Ranked"), hasR1 && React.createElement("span", {
      role: "columnheader",
      title: "The share ranking it the issue that matters most"
    }, "First"), cols.map(k => React.createElement("span", {
      key: k.id,
      role: "columnheader",
      style: {
        color: k.ink
      }
    }, k.lab)), hasUnsure && React.createElement("span", {
      role: "columnheader"
    }, "Unsure"));
    return React.createElement("div", {
      className: "rd-apd-demwrap"
    }, React.createElement("span", {
      className: "rd-apd-h"
    }, "Issue by issue"), React.createElement("div", {
      className: "rd-apd-demcols " + (parts.length === 2 ? "two" : "one")
    }, parts.map((part, i) => React.createElement("div", {
      key: i,
      className: "rd-apd-dem isn" + nNum,
      role: "table",
      "aria-label": "Issue by issue" + (i ? ", continued" : ""),
      style: {
        "--isr-cols": tracks.join(" "),
        "--isr-n": nNum
      }
    }, head, part.map(r => {
      const o = ownOf(r);
      const L = o ? window.issLeadOf(o) : null;
      const u = unsure(o);
      return React.createElement("div", {
        key: r.lab,
        className: rc,
        role: "row"
      }, React.createElement("span", {
        role: "rowheader"
      }, r.lab), hasRank && React.createElement("span", {
        role: "cell",
        className: "rd-apd-dv"
      }, r.rank ? ordTxt(r.rank) + " · " + rdApNum(r.v) : "—"), hasR1 && React.createElement("span", {
        role: "cell",
        className: "rd-apd-dv"
      }, r.r1 != null ? rdApNum(r.r1) : "—"), cols.map(k => {
        const lead = L && !L.level && L.who === k.id;
        return React.createElement("span", {
          key: k.id,
          role: "cell",
          className: "rd-apd-dv" + (lead ? " lead" : ""),
          style: lead ? {
            "--lead": k.dot
          } : null
        }, o && o[k.id] != null ? rdApNum(o[k.id]) : "—");
      }), hasUnsure && React.createElement("span", {
        role: "cell",
        className: "rd-apd-dv"
      }, rdApNum(u)));
    })))), React.createElement("span", {
      className: "rd-apd-sub rd-apd-note"
    }, iq.sal && iq.sal.length ? "Ranked: the issue’s place among those voters said matter most, and the share naming it" + (hasR1 ? "; First: the share naming it the one that matters most. " : ". ") : iq.conc ? "Ranked: the issue’s place among concerns named without prompting, and the share mentioning it. " : "This poll didn’t ask which issues matter most. ", "The party columns are each party\u2019s share of all respondents, as printed.", iq.q ? React.createElement(React.Fragment, null, " The question\u2019s wording: \u201C", iq.q, "\u201D", /[.?…]$/.test(iq.q) ? "" : ".") : "", " The party in front is shaded."));
  })();
  const confLead = conf && React.createElement("section", {
    className: "rd-ldg-sec",
    "data-sec": "confidence"
  }, React.createElement("h4", {
    className: "rd-ldg-h"
  }, conf.lab), React.createElement("div", {
    className: "rd-ldg-conf"
  }, React.createElement("b", null, confFmt(conf.v)), confEf != null ? React.createElement("span", null, ", " + (confEf < 0 ? "down " : "up ") + confFmt(Math.abs(confEf)) + " on the " + confPeriod) : null), React.createElement("p", {
    className: "rd-ldg-foot1"
  }, conf.vs === 0 ? "Net balance, optimistic minus pessimistic – 0 neutral." : "Index reading – 100 neutral.", conf.cond != null ? " NAB prints business conditions beside it: " + confFmt(conf.cond) + (conf.condChg != null && Math.abs(conf.condChg) >= 0.05 ? ", " + (conf.condChg < 0 ? "down " : "up ") + confFmt(Math.abs(conf.condChg)) + " on the month" : "") + "." : ""));
  const rk = (lab, v, words, ink) => React.createElement("tr", {
    key: lab
  }, React.createElement("th", {
    scope: "row"
  }, lab), React.createElement("td", {
    className: "num"
  }, React.createElement("b", {
    style: ink ? {
      color: ink
    } : null
  }, v)), React.createElement("td", null, words));
  const r1s = v => v == null ? "—" : rdApSigned(v);
  const outside = p.noAgg ? React.createElement("p", {
    className: "rd-ldg-noagg"
  }, React.createElement("b", null, "Outside the aggregates."), " ", p.noAggWhy || "Because SMS polls have a strong selection bias, they do not count towards any aggregates.") : null;
  const solo = p.solo && window.soloNote ? React.createElement("div", {
    className: "rd-apd-facts"
  }, React.createElement("span", {
    className: "rd-apd-k"
  }, "Territory readings"), React.createElement("span", null, window.soloNote(p))) : null;
  const tppReckon = fig.a != null && React.createElement("table", {
    className: "rd-ldg-t rd-ldg-rk"
  }, React.createElement("tbody", null, rk("This poll", fig.a.toFixed(1), "Labor v " + (onM ? "One Nation" : "Coalition") + (pub ? ", published" : ", implied")), yd ? rk(RD_AP_KAL ? "The trend" : "Polls around it", yd.v.toFixed(1), RD_AP_KAL ? "the other polls’ trend" : (yd.n === 1 ? "one other poll" : rdNumWord(yd.n) + " others") + ", within three weeks") : rk("Polls around it", "—", "none fielded within three weeks, so nothing to set it against"), yd && lean != null && rk("Lean", r1s(lean), (Math.abs(lean) < 0.05 ? "level with them" : sideOf(lean) + " way") + (ydHe == null && inside ? ", " + inside + " its ±" + moe.toFixed(1) + " margin" : ""), rdApLeanInk(lean, onM)), rk("House lean", ydHe != null ? r1s(ydHe) : hl != null ? r1s(rdApR1(hl)) : "—", ydHe != null || hl != null ? "taken out before averaging" : "not measured yet: too few polls", rdApLeanInk(ydHe != null ? ydHe : hl, onM)), ydHe != null && lean != null && Math.abs(ydHe) >= 0.05 && rk("Less house lean", r1s(adj), inside ? inside[0].toUpperCase() + inside.slice(1) + " its ±" + moe.toFixed(1) + " margin" : Math.abs(adj) < 0.05 ? "level" : sideOf(adj) + " way", rdApLeanInk(adj, onM)), today && !p.noAgg && rk("In today’s " + today.a.toFixed(1), eff && eff.w ? move(eff) : eff && eff.t ? move(eff.t) : "—", eff && eff.w ? "how far it moves it, as one of " + rdNumWord(winN) : eff && eff.t ? "out of the window now; it moved it this far" : "out of the window: the last three weeks only")));
  const ldReckon = ldOwn.length > 0 && React.createElement("table", {
    className: "rd-ldg-t rd-ldg-rk rd-ldg-rk2"
  }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null), ldOwn.map(pr => React.createElement("th", {
    key: pr.riv,
    className: "num"
  }, "v ", pr.name)), React.createElement("th", null))), React.createElement("tbody", null, React.createElement("tr", null, React.createElement("th", {
    scope: "row"
  }, "This poll"), ldOwn.map(pr => React.createElement("td", {
    key: pr.riv,
    className: "num"
  }, React.createElement("b", null, r1s(rdApR1(pr.gap))))), React.createElement("td", null, rdApPm(p.appr), "\u2019s net minus each rival\u2019s")), ldCmp.some(Boolean) && React.createElement(React.Fragment, null, React.createElement("tr", null, React.createElement("th", {
    scope: "row"
  }, "Polls around it"), ldCmp.map((c, i) => React.createElement("td", {
    key: i,
    className: "num"
  }, React.createElement("b", null, c ? r1s(c.og) : "—"))), React.createElement("td", null, "the same gap elsewhere")), React.createElement("tr", null, React.createElement("th", {
    scope: "row"
  }, "Lean"), ldCmp.map((c, i) => React.createElement("td", {
    key: i,
    className: "num"
  }, React.createElement("b", null, c ? r1s(c.delta) : "—"))), React.createElement("td", null, "+ is ", rdApPm(p.appr), "\u2019s way")), React.createElement("tr", null, React.createElement("th", {
    scope: "row"
  }, "House lean"), ldCmp.map((c, i) => React.createElement("td", {
    key: i,
    className: "num"
  }, React.createElement("b", null, c ? r1s(c.he) : "—"))), React.createElement("td", null, "taken out before averaging")), React.createElement("tr", null, React.createElement("th", {
    scope: "row"
  }, "Less house lean"), ldCmp.map((c, i) => React.createElement("td", {
    key: i,
    className: "num"
  }, React.createElement("b", null, c ? r1s(c.adj) : "—"))), React.createElement("td", null))), !ldCmp.some(Boolean) && ldLean.filter(Boolean).length > 0 && React.createElement("tr", null, React.createElement("th", {
    scope: "row"
  }, "House lean"), ldOwn.map((pr, i) => {
    const l = ldLean[i];
    return React.createElement("td", {
      key: pr.riv,
      className: "num"
    }, React.createElement("b", null, l ? r1s(rdApR1(l.v)) : "—"));
  }), React.createElement("td", null, "its usual lean on the gap")), ldNow.filter(Boolean).length > 0 && React.createElement("tr", null, React.createElement("th", {
    scope: "row"
  }, "Now"), ldNow.map((n, i) => React.createElement("td", {
    key: i,
    className: "num"
  }, React.createElement("b", null, n ? r1s(rdApR1(n.gap)) : "—"))), React.createElement("td", null, "today\u2019s figures", ldOwn.some(pr => pr.met === "fav") ? ", each on its own question" : ""))));
  const dirReckon = d && React.createElement("table", {
    className: "rd-ldg-t rd-ldg-rk"
  }, React.createElement("tbody", null, rk("This reading", r1s(d.net), "right direction minus wrong track"), dYd ? rk("Readings around it", r1s(rdApR1(dYd.v)), (dYd.n === 1 ? "one other reading" : rdNumWord(dYd.n) + " others") + ", within three weeks") : rk("Readings around it", "—", "none taken within three weeks"), dirLean != null && rk("Lean", r1s(dirLean), (Math.abs(dirLean) < 0.05 ? "level with them" : "more " + dirWay(dirLean)) + (dirHe == null && insideD ? ", " + insideD + " its ±" + dirMoe.toFixed(1) + " margin" : ""), dirLean > 0 ? "var(--mood-pos)" : dirLean < 0 ? "var(--mood-neg)" : null), rk("House lean", dirHe != null ? r1s(dirHe) : dirHl ? r1s(rdApR1(dirHl.v)) : "—", dirHe != null || dirHl ? "taken out before averaging" : "not measured yet: too few readings"), dirHe != null && Math.abs(dirHe) >= 0.05 && dirAdj != null && rk("Less house lean", r1s(dirAdj), insideD ? insideD[0].toUpperCase() + insideD.slice(1) + " its ±" + dirMoe.toFixed(1) + " margin" : Math.abs(dirAdj) < 0.05 ? "level" : "more " + dirWay(dirAdj), dirAdj > 0 ? "var(--mood-pos)" : dirAdj < 0 ? "var(--mood-neg)" : null), dirNow && rk("In today’s " + rdApSigned(dirNow.net), dEff && dEff.w ? move(dEff) : dEff && dEff.t ? move(dEff.t) : "—", dEff && dEff.w ? "how far it moves it, as one of " + rdNumWord(dirNow.n) : dEff && dEff.t ? "out of the window now; it moved it this far" : "out of the window: the last three weeks only")));
  const since = D.monthNameFull(Number(from.slice(5)));
  let railBody;
  if (isConf) {
    railBody = conf && React.createElement(React.Fragment, null, confSer && React.createElement(React.Fragment, null, React.createElement("span", {
      className: "rd-apd-ct"
    }, p.pollster, "\u2019s ", conf.lab, " releases since ", since, ", as published \u2014 no average; the gauge is the publisher\u2019s own series"), React.createElement(RdApConfMini, {
      p: p
    })), React.createElement("div", {
      className: "rd-apd-facts"
    }, React.createElement("span", {
      className: "rd-apd-k"
    }, "The gauge"), React.createElement("span", null, CONF_BLURB[conf.k] || conf.lab + "."), React.createElement("span", {
      className: "rd-apd-k"
    }, "Neutral"), React.createElement("span", null, conf.vs === 0 ? React.createElement(React.Fragment, null, "Printed as a net balance \u2013 optimists minus pessimists \u2013 so the neutral print is 0. This table and the economic-sentiment panel both draw it 100 points up, so its 0 sits on the indices\u2019 neutral 100.") : React.createElement(React.Fragment, null, "An index print \u2013 100 is neutral; above it optimists outnumber pessimists", confPeriod === "week" ? ", read weekly" : "", ".")), React.createElement("span", {
      className: "rd-apd-k"
    }, "In today\u2019s panel"), React.createElement("span", null, confSer && confSer.latest && confSer.latest.released === p.released ? React.createElement(React.Fragment, null, "This is the latest ", conf.lab, " release, so the economic-sentiment panel reads the gauge at it.") : confSer && confSer.latest ? React.createElement(React.Fragment, null, "The panel\u2019s current read of this gauge is the ", outLabel(confSer.latest), " release at ", confFmt(confSer.latest.v), confSer.latest.url ? React.createElement(React.Fragment, null, ", ", React.createElement("a", {
      className: "rd-link rd-link-in",
      href: confSer.latest.url,
      onClick: e => e.stopPropagation()
    }, "its source", React.createElement("span", {
      className: "rd-apd-ext",
      "aria-hidden": "true"
    }, "\u2197"))) : "", ".") : React.createElement(React.Fragment, null, "The gauge\u2019s series carries no published releases to panel against."))));
  } else if (isDem) {
    railBody = demFacts && React.createElement("div", {
      className: "rd-apd-facts"
    }, demFacts);
  } else if (isIss) {
    railBody = iss && React.createElement(React.Fragment, null, D.issues && iss.own && iss.own[iss.top] && (() => {
      const cLab = D.issues.labels && D.issues.labels[iss.top] || iss.top;
      const cTit = cLab.charAt(0).toLowerCase() + cLab.slice(1);
      return React.createElement(React.Fragment, null, React.createElement("span", {
        className: "rd-apd-ct"
      }, "Who voters rate best on ", cTit, " since ", since, ", the monthly pooled line and this wave\u2019s own figures on the same basis \u2014 shares of those naming one of the three parties"), React.createElement(RdApIssMini, {
        p: p
      }));
    })(), React.createElement("div", {
      className: "rd-apd-facts"
    }, React.createElement("span", {
      className: "rd-apd-k"
    }, "Asked"), React.createElement("span", null, issPrompted ? React.createElement(React.Fragment, null, "Voters picked the three issues that matter most", iss.q ? React.createElement(React.Fragment, null, " \u2013 ", p.pollster, "\u2019s wording: \u201C", iss.q, "\u201D") : p.pollster === "Ipsos" ? " – Ipsos asks its standing list of 19 issues, best party on the month’s five leaders" : "", ". SEC Newgate\u2019s mentions count can\u2019t sit in the same series, so each house\u2019s wording is pooled against its pair first.") : iss.conc ? React.createElement(React.Fragment, null, "SEC Newgate asks what concerns Australians, unprompted \u2013 anyone can name anything, so the shares are any-mentions, not forced picks. That reading can\u2019t mix with the top-three series the issues panel pools, so it isn\u2019t counted toward it.") : React.createElement(React.Fragment, null, p.pollster, " asked only who\u2019d be best on each issue", iss.q ? React.createElement(React.Fragment, null, " \u2013 its wording: \u201C", iss.q, "\u201D \u2013") : ",", " not which issues matter most, so this wave feeds the pooled best-party line and there\u2019s no top-three list for it to join.")), issPair != null && React.createElement(React.Fragment, null, React.createElement("span", {
      className: "rd-apd-k"
    }, "Between the question forms"), React.createElement("span", null, "RedBridge\u2019s and Ipsos\u2019s wordings for what matters sit a measured ", React.createElement("b", null, Math.abs(issPair).toFixed(1)), " points apart on ", D.issues.labels && D.issues.labels[iss.top] || iss.top, "; this wave\u2019s reading was moved half that gap toward the other house\u2019s before it entered any average.")), issLeadMeta && React.createElement(React.Fragment, null, React.createElement("span", {
      className: "rd-apd-k"
    }, rdApBreakable(p.pollster), "\u2019s house lean"), React.createElement("span", null, issPlus.lean == null ? "None to speak of: its figures sit level with the other pollsters’" : React.createElement(React.Fragment, null, "About ", React.createElement("b", null, Math.abs(issPlus.lean).toFixed(1)), " ", issPlus.lean > 0 ? "richer" : "poorer", " for ", issLeadMeta[0], " on ", D.issues.labels && D.issues.labels[iss.top] || iss.top, ", taken out before the figures are pooled"))), issPlus && D.issues.window && React.createElement(React.Fragment, null, React.createElement("span", {
      className: "rd-apd-k"
    }, "In today\u2019s panel"), React.createElement("span", null, issPlus.w ? React.createElement(React.Fragment, null, "One of the waves the issues panel\u2019s current figures draw on (the last ", D.issues.window, ").") : React.createElement(React.Fragment, null, "Outside the ", D.issues.window, " the panel\u2019s current figures draw on.")))));
  } else if (isLd) {
    railBody = ldOwn.length ? React.createElement(React.Fragment, null, ldWin && ldWin.waves.length > 0 && React.createElement(React.Fragment, null, React.createElement("span", {
      className: "rd-apd-ct"
    }, p.pollster, "\u2019s polls since ", since, " against the average \u2013 ", ldBoth ? React.createElement("button", {
      type: "button",
      className: "rd-apd-met",
      "aria-label": "Showing " + rdApLdMetWord(ldAct) + ". Switch to " + rdApLdMetWord(ldAct === "fav" ? "approval" : "fav"),
      title: "Switch to " + rdApLdMetWord(ldAct === "fav" ? "approval" : "fav"),
      onClick: e => {
        e.stopPropagation();
        setLdMet(ldAct === "fav" ? "approval" : "fav");
      }
    }, rdApLdMetWord(ldAct)) : ldWord, ", ", rdApPmOffice(), " minus ", rdApLdJoin(ldNames)), React.createElement(RdApLdMini, {
      p: p,
      met: ldAct
    })), ldReckon) : React.createElement("div", {
      className: "rd-apd-facts"
    }, React.createElement("span", {
      className: "rd-apd-k"
    }, "Leader ratings"), React.createElement("span", null, p.pollster, " didn\u2019t ask ", rdApPm(p.appr), " and ", p.appr && p.appr.oppName ? p.appr.oppName : "the opposition leader", " on the same question in this poll, so there\u2019s no net-approval gap to set against the leadership figures."));
  } else if (isDir) {
    railBody = d ? React.createElement(React.Fragment, null, React.createElement("span", {
      className: "rd-apd-ct"
    }, p.pollster, "\u2019s readings since ", since, " against the average, net right direction minus wrong track"), React.createElement(RdApDirMini, {
      p: p
    }), dirReckon) : React.createElement("div", {
      className: "rd-apd-facts"
    }, React.createElement("span", {
      className: "rd-apd-k"
    }, "National direction"), React.createElement("span", null, p.pollster, " didn\u2019t ask the direction question in this poll, so there\u2019s no reading to set against the direction figures."));
  } else if (facet === "primary" && p.pyd) {
    railBody = React.createElement(React.Fragment, null, outside, React.createElement(RdApPrimRail, {
      p: p
    }), solo);
  } else {
    railBody = fig.a != null ? React.createElement(React.Fragment, null, React.createElement("span", {
      className: "rd-apd-ct"
    }, p.pollster, "\u2019s polls since ", since, " against the ", RD_AP_AVG, ", Labor v ", onM ? "One Nation" : "Coalition", pub ? " as published" : ""), React.createElement(RdApMini, {
      p: p,
      onM: onM,
      pub: pub
    }), outside, tppReckon, solo) : React.createElement(React.Fragment, null, outside, React.createElement("div", {
      className: "rd-apd-facts"
    }, p.solo && window.soloNote && React.createElement(React.Fragment, null, React.createElement("span", {
      className: "rd-apd-k"
    }, "Territory readings"), React.createElement("span", null, window.soloNote(p))), React.createElement("span", {
      className: "rd-apd-k"
    }, "Two-party"), React.createElement("span", null, fig.none[0].toUpperCase() + fig.none.slice(1), ", so this poll has no ", pub ? "published" : "implied", " figure to set against the other polls."), React.createElement("span", {
      className: "rd-apd-k"
    }, rdApBreakable(p.pollster), "\u2019s house lean"), React.createElement("span", null, hl == null ? "Not measured yet: too few polls on this contest" : Math.abs(hl) < 0.05 ? "None to speak of: it sits level with the other pollsters" : React.createElement(React.Fragment, null, React.createElement("b", null, Math.abs(hl).toFixed(1)), " to ", hl > 0 ? "Labor" : onM ? "One Nation" : "the Coalition", ", taken out before the polls are averaged"))));
  }
  const rail = React.createElement("div", {
    className: "rd-apd-r"
  }, React.createElement("span", {
    className: "rd-apd-h"
  }, isConf ? "How it reads" : "How it counts"), railBody);
  const lineGo = (id, el) => {
    if (RD_LG_PANEL[id]) {
      rdLgPanelGo(id, p);
      return;
    }
    const open = el && el.closest(".rd-ap-open");
    const row = open && open.previousElementSibling;
    if (row) rdPinScroll([row], true);
    if (id === "demographics" && setDemSplit && window.demPairOf && !window.demPairOf(p, demSplit)) {
      const fit = (window.DEM_SPLITS || []).find(x => window.demPairOf(p, x.id));
      if (fit) setDemSplit(fit.id);
    }
    if (onFacet) onFacet(id);
  };
  return React.createElement(RdLedger, {
    p: p,
    facet: facet,
    onM: onM,
    side: rail,
    lead: isDem ? demTable : isIss ? issTable : isConf ? confLead : null,
    wide: isDem || isIss && issTwo,
    onLine: onFacet ? lineGo : null,
    demSplit: demSplit,
    moe: rdLgMoe(p),
    sources: p.links && p.links.length > 0 ? rdPollLinks(p.links) : null,
    foot: React.createElement(React.Fragment, null, React.createElement("a", {
      className: "rd-link",
      href: report,
      onClick: e => e.stopPropagation()
    }, "Report an error"), onBack && React.createElement("button", {
      type: "button",
      className: "rd-link",
      onClick: e => {
        e.stopPropagation();
        onBack();
      }
    }, "Back to ", backLabel || "the chart"))
  });
}
const rdLgChg = (d, dec) => {
  if (d == null) return null;
  const r = Math.round(d * 10) / 10;
  return rdApChg(r, dec || (Number.isInteger(r) ? 0 : 1));
};
function RdLgChg({
  d,
  dec
}) {
  const s = rdLgChg(d, dec);
  return s ? React.createElement("span", {
    className: "rd-ldg-chg"
  }, s) : null;
}
const RD_LG_LEADER = {
  alb: "Albanese",
  taylor: "Taylor",
  ley: "Ley",
  hanson: "Hanson"
};
const RD_LG_INK = {
  alb: "var(--alp-text)",
  taylor: "var(--lnp-text)",
  ley: "var(--lnp-text)",
  hanson: "var(--onp-text)"
};
const rdLgWho = (p, k) => apWho(p, k, RD_LG_LEADER[k] || rdCap(k));
const rdLgPrims = () => rdApPrimList(window.AUSPOL.latest && window.AUSPOL.latest.primaryOrder || RD_AP_PRIM_FALLBACK);
const rdLgNet = v => v == null ? "—" : (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v);
const RD_LG_TAB = {
  primary: "Primary",
  twopp: "2PP",
  leadership: "Leadership",
  direction: "Direction",
  issues: "Issues",
  demographics: "Demographics"
};
const RD_LG_LATEST_TABS = {
  twopp: 1,
  primary: 1,
  leadership: 1
};
const RD_LG_PANEL = {
  switching: {
    tip: "where One Nation’s voters came from",
    where: "the Snapshot",
    onSnapshot: true
  },
  opinion: {
    tip: "what else this poll asked",
    where: "Public opinion"
  }
};
const rdLgPanelGo = (id, p) => {
  if (id === "switching") return window.AP.gotoSwitching && window.AP.gotoSwitching();
  if (id === "opinion") {
    const bo = window.AUSPOL.publicOpinionByRow && window.AUSPOL.publicOpinionByRow[p.pollster + "|" + p.released];
    if (bo && window.AP.gotoOpinion) window.AP.gotoOpinion(bo.h, bo.w && bo.w[0]);
  }
};
function rdLgChgNote(p, keys) {
  const r = p.chg && p.chg.r || {};
  const refs = [...new Set(keys.map(k => r[k]).filter(Boolean))];
  if (!refs.length) return null;
  if (refs.length > 1) return "▲▼ Changes are on each figure’s previous " + p.pollster + " poll.";
  const prev = window.AUSPOL.individualPolls.find(x => x.pollster === p.pollster && x.released === refs[0]);
  return prev ? "▲▼ Changes are on " + p.pollster + "’s " + prev.field + " poll." : null;
}
function rdLgMoe(p) {
  const ms = [p.alpOnImp != null ? rdPollMargin(p, "onp", false) : null, p.alpImp != null ? rdPollMargin(p, "lnp", false) : null].filter(m => m != null);
  const mp = [p.tppAlt ? rdPollMargin(p, "onp", true) : null, p.alp != null ? rdPollMargin(p, "lnp", true) : null].filter(m => m != null);
  const rng = a => {
    const lo = Math.min(...a),
      hi = Math.max(...a);
    return "±" + (lo.toFixed(1) === hi.toFixed(1) ? lo.toFixed(1) : lo.toFixed(1) + "–" + hi.toFixed(1));
  };
  const bits = [ms.length ? rng(ms) + " on the implied" : null, mp.length ? rng(mp) + " on the published" : null].filter(Boolean);
  return bits.length ? "Margin of error " + bits.join(", ") + (bits.length > 1 ? " figures" : " figure") + " at 95%, " + rdMarginBasis(p) + "." : null;
}
function RdLgTpp({
  p,
  onM,
  moe,
  note
}) {
  const c = p.chg && p.chg.d || {};
  const ta = p.tppAlt;
  const pair = (a, b, ink) => React.createElement("b", {
    className: "rd-ldg-pair"
  }, React.createElement("span", {
    style: {
      color: "var(--alp-text)"
    }
  }, a), React.createElement("span", {
    className: "rd-ldg-dash"
  }, "\u2013"), React.createElement("span", {
    style: {
      color: ink
    }
  }, b));
  const cell = (v, d, ink, dec, b) => v == null ? React.createElement("span", {
    className: "rd-ldg-none"
  }, "\u2014") : React.createElement(React.Fragment, null, pair(rdApNum(v), rdApNum(b != null ? b : 100 - v), ink), React.createElement(RdLgChg, {
    d: d,
    dec: dec
  }));
  const ON = {
    id: "onp",
    head: "v One Nation",
    ink: "var(--onp-text)"
  };
  const LN = {
    id: "lnp",
    head: "v Coalition",
    ink: "var(--lnp-text)"
  };
  const cols = onM ? [ON, LN] : [LN, ON];
  const pubLab = p.tppFlows != null ? "Published, respondent-allocated" : "As published";
  const rows = [["Implied, on " + rdElecYear + " flows", {
    onp: p.alpOnImp != null ? [p.alpOnImp, c.impOn, 1] : null,
    lnp: p.alpImp != null ? [p.alpImp, c.imp, 1] : null
  }], [pubLab, {
    onp: ta ? [ta.alp, c.altAlpOn, 0, ta.onp] : null,
    lnp: p.alp != null ? [p.alp, c.alp2pp, 0, p.lnp] : null
  }], ["Published, on " + rdElecYear + " flows", {
    onp: null,
    lnp: p.tppFlows != null ? [p.tppFlows, null, 0] : null
  }]].filter(([, v]) => v.onp || v.lnp);
  if (!rows.length && !p.tpp3 && !p.tppAlt2) return null;
  const tr = ([lab, v]) => React.createElement("tr", {
    key: lab
  }, React.createElement("th", {
    scope: "row"
  }, lab), cols.map(k => React.createElement("td", {
    key: k.id
  }, v[k.id] ? cell(v[k.id][0], v[k.id][1], k.ink, v[k.id][2], v[k.id][3]) : React.createElement("span", {
    className: "rd-ldg-none"
  }, "\u2014"))));
  const noPub = !ta && p.alp == null;
  return React.createElement(React.Fragment, null, React.createElement("table", {
    className: "rd-ldg-t rd-ldg-tpp"
  }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null), cols.map((k, i) => React.createElement("th", {
    key: k.id,
    className: i === 0 ? "on" : ""
  }, "Labor ", k.head)))), React.createElement("tbody", null, rows.map(r => tr(r)), p.tppAlt2 && React.createElement("tr", null, React.createElement("th", {
    scope: "row"
  }, "Coalition v One Nation"), React.createElement("td", {
    colSpan: 2
  }, React.createElement("b", {
    className: "rd-ldg-pair"
  }, React.createElement("span", {
    style: {
      color: "var(--lnp-text)"
    }
  }, rdApNum(p.tppAlt2.lnp)), React.createElement("span", {
    className: "rd-ldg-dash"
  }, "\u2013"), React.createElement("span", {
    style: {
      color: "var(--onp-text)"
    }
  }, rdApNum(p.tppAlt2.onp))), React.createElement("span", {
    className: "rd-ldg-tail"
  }, ", as published"))), p.tpp3 && React.createElement("tr", null, React.createElement("th", {
    scope: "row"
  }, "Three-cornered"), React.createElement("td", {
    colSpan: 2
  }, React.createElement("b", {
    className: "rd-ldg-tri"
  }, React.createElement("span", {
    style: {
      color: "var(--alp-text)"
    }
  }, "ALP ", rdApNum(p.tpp3.alp)), " ", React.createElement("span", {
    style: {
      color: "var(--lnp-text)"
    }
  }, "L/NP ", rdApNum(p.tpp3.lnp)), " ", React.createElement("span", {
    style: {
      color: "var(--onp-text)"
    }
  }, "ON ", rdApNum(p.tpp3.onp))), React.createElement("span", {
    className: "rd-ldg-tail"
  }, ", as published"))))), (noPub || moe || note) && React.createElement("p", {
    className: "rd-ldg-foot1"
  }, noPub ? p.pollster + " published no two-party figure; the implied ones are read off its primaries. " : "", moe || "", note ? " " + note : ""));
}
function rdLgDecided(p) {
  if (p.undecided != null) {
    const b = p.undecidedBasis || "first";
    return {
      h: p.undecided + "%",
      w: b === "soft" ? "not firm" : "undecided",
      d: p.chg && p.chg.d && p.chg.d.und || null,
      s: b === "soft" ? "named a party, but might yet change their mind" : b === "tpp" ? "unallocated inside the printed two-party pair" : "couldn’t name a party when first asked"
    };
  }
  const f = Array.isArray(p.firmAll) && p.firmAll.length === 3 ? p.firmAll : null;
  if (f) return {
    h: f[1] + f[2] + "%",
    w: "not firm",
    d: null,
    s: "solid " + f[0] + ", soft " + f[1] + ", very soft " + f[2] + " on its vote-softness table"
  };
  return null;
}
const RD_LG_CK = {
  alp: "pAlp",
  lnp: "pLnp",
  grn: "pGrn",
  onp: "pOnp",
  oth: "pOth"
};
function RdLgVote({
  p,
  note
}) {
  const q = p.p || {};
  const c = p.chg && p.chg.d || {};
  const prim = rdLgPrims().filter(k => q[k.id] != null);
  if (!prim.length) return null;
  const dec = rdLgDecided(p);
  return React.createElement(React.Fragment, null, React.createElement("div", {
    className: "rd-ldg-prim"
  }, prim.map(k => React.createElement("span", {
    key: k.id
  }, React.createElement("b", {
    style: {
      color: k.ink
    }
  }, k.lab), React.createElement("span", {
    className: "rd-ldg-big",
    style: {
      color: k.ink
    }
  }, rdApNum(q[k.id])), React.createElement("span", {
    className: "rd-ldg-chg"
  }, rdLgChg(c[RD_LG_CK[k.id]], 0) || " ")))), dec && React.createElement("p", {
    className: "rd-ldg-foot1"
  }, React.createElement("b", null, dec.h), " ", dec.w, React.createElement(RdLgChg, {
    d: dec.d,
    dec: 1
  }), " \u2013 ", dec.s, "."), note && React.createElement("p", {
    className: "rd-ldg-note"
  }, note));
}
function RdLgLeaders({
  p,
  note
}) {
  const a = p.appr || {};
  const mb = a.metricBy || {};
  const alt = a.alt || {};
  const c = p.chg && p.chg.d || {};
  const nameOf = id => id === "taylor" ? a.oppName || rdLgWho(p, id) : rdLgWho(a, id);
  const rows0 = [["alb", "albNet"], ["taylor", "taylorNet"], ["hanson", "hansonNet"]].filter(([, nk]) => a[nk] != null).map(([id, nk]) => ({
    id,
    ck: nk,
    net: a[nk],
    name: nameOf(id),
    L: a[id] || null,
    fav: mb[id] === "fav"
  }));
  const altRows = ["alb", "taylor", "hanson"].filter(id => alt[id] && alt[id].net != null).map(id => ({
    id,
    ck: id + "Fav",
    net: alt[id].net,
    name: nameOf(id),
    L: null,
    fav: true
  }));
  const split = altRows.length > 0;
  const groups = split ? [rows0.filter(r => !r.fav), [...rows0.filter(r => r.fav).map(r => ({
    ...r,
    ck: r.id + "Fav"
  })), ...altRows].sort((x, y) => ["alb", "taylor", "hanson"].indexOf(x.id) - ["alb", "taylor", "hanson"].indexOf(y.id))].filter(g => g.length) : [rows0];
  const rows = rows0;
  const sets = window.ppmContests ? window.ppmContests(p) : p.ppmSets || [];
  const who = ["alb", "taylor", "ley", "hanson"].filter(k => sets.some(s => s[k] != null));
  const named = s => ["alb", "taylor", "ley", "hanson"].filter(k => s[k] != null);
  const twos = sets.filter(s => named(s).length === 2).length;
  const setLab = s => {
    const n = named(s);
    if (n.length >= 3) return "Three-way";
    return twos > 1 ? rdLgWho(p, "alb") + " v " + rdLgWho(p, n.find(k => k !== "alb")) : "Head to head";
  };
  if (!rows.length && !sets.length) return null;
  const sum = s => who.reduce((t, k) => t + (s[k] || 0), 0);
  const table = (rows, gi) => {
    const nFav = rows.filter(r => r.fav).length;
    const allFav = rows.length > 0 && nFav === rows.length,
      mixed = nFav > 0 && nFav < rows.length;
    const hasUns = rows.some(r => r.L && r.L.unsure != null);
    return React.createElement("table", {
      key: gi,
      className: "rd-ldg-t rd-ldg-ldr"
    }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, allFav ? "Net favourability" : mixed ? "Net rating" : "Net approval"), React.createElement("th", {
      className: "num pt"
    }, allFav ? "Favourable" : mixed ? "For" : "Approve"), React.createElement("th", {
      className: "num pt"
    }, allFav ? "Unfavourable" : mixed ? "Against" : "Disapprove"), hasUns && React.createElement("th", {
      className: "num pt"
    }, "Unsure"), React.createElement("th", {
      className: "num"
    }, "Net"), React.createElement("th", {
      className: "num"
    }, "Change"))), React.createElement("tbody", null, rows.map(r => React.createElement("tr", {
      key: r.id
    }, React.createElement("th", {
      scope: "row"
    }, r.name, mixed && React.createElement("span", {
      className: "rd-ldg-tail"
    }, " ", r.fav ? "favourability" : "approval"), r.L && r.L.app != null && React.createElement("span", {
      className: "rd-ldg-parts"
    }, r.L.app, " ", r.fav ? "fav." : "approve", ", ", r.L.dis, " ", r.fav ? "unfav." : "disapprove", r.L.unsure != null ? ", " + r.L.unsure + " unsure" : "")), React.createElement("td", {
      className: "num pt"
    }, r.L && r.L.app != null ? r.L.app : "—"), React.createElement("td", {
      className: "num pt"
    }, r.L && r.L.dis != null ? r.L.dis : "—"), hasUns && React.createElement("td", {
      className: "num pt"
    }, r.L && r.L.unsure != null ? r.L.unsure : "—"), React.createElement("td", {
      className: "num"
    }, React.createElement("b", {
      style: {
        color: RD_LG_INK[r.id]
      }
    }, rdLgNet(r.net))), React.createElement("td", {
      className: "num"
    }, rdLgChg(c[r.ck], 0) ? React.createElement("span", {
      className: "rd-ldg-chg"
    }, rdLgChg(c[r.ck], 0)) : React.createElement("span", {
      className: "rd-ldg-none"
    }, "\u2014"))))));
  };
  return React.createElement(React.Fragment, null, groups.map((g, gi) => table(g, gi)), sets.length > 0 && React.createElement("table", {
    className: "rd-ldg-t rd-ldg-ppm"
  }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, window.JUR ? "Better " + window.JUR.office.alb : "Better prime minister"), who.map(k => React.createElement("th", {
    key: k,
    className: "num"
  }, rdLgWho(p, k))), React.createElement("th", {
    className: "num"
  }, "Undecided"))), React.createElement("tbody", null, sets.map((s, i) => React.createElement("tr", {
    key: i
  }, React.createElement("th", {
    scope: "row"
  }, setLab(s)), who.map(k => React.createElement("td", {
    key: k,
    className: "num"
  }, s[k] != null ? React.createElement("b", {
    style: {
      color: RD_LG_INK[k]
    }
  }, s[k]) : React.createElement("span", {
    className: "rd-ldg-none"
  }, "\u2014"))), React.createElement("td", {
    className: "num"
  }, s.unc ? s.unc : sum(s) >= 99.5 ? React.createElement("span", {
    className: "rd-ldg-none",
    title: "Printed without its undecided share"
  }, "\u2014") : "0"))))), note && rows.length > 0 && React.createElement("p", {
    className: "rd-ldg-note"
  }, note));
}
function RdLgDir({
  p
}) {
  const d = p.dir;
  if (!d) return null;
  const u = d.unsure != null ? d.unsure : Math.max(0, 100 - d.right - d.wrong);
  return React.createElement("div", {
    className: "rd-ldg-dir"
  }, React.createElement("div", {
    className: "rd-ldg-dirbar",
    "aria-hidden": "true"
  }, React.createElement("i", {
    style: {
      width: d.right + "%",
      background: "var(--mood-pos)"
    }
  }), React.createElement("i", {
    style: {
      width: u + "%",
      background: "var(--line)"
    }
  }), React.createElement("i", {
    style: {
      width: d.wrong + "%",
      background: "var(--mood-neg)"
    }
  })), React.createElement("div", {
    className: "rd-ldg-dirk"
  }, React.createElement("span", null, "Right direction ", React.createElement("b", {
    style: {
      color: "var(--mood-pos)"
    }
  }, rdApNum(d.right))), React.createElement("span", null, "Unsure ", React.createElement("b", null, rdApNum(u))), React.createElement("span", null, "Wrong track ", React.createElement("b", {
    style: {
      color: "var(--mood-neg)"
    }
  }, rdApNum(d.wrong))), React.createElement("span", {
    className: "rd-ldg-dirnet"
  }, "Net ", React.createElement("b", null, rdApSigned(d.right - d.wrong).replace(/\.0$/, "")))), d.bg && d.bg.length > 0 && React.createElement("div", {
    className: "rd-ldg-dircut"
  }, d.bg.map((row, ri) => React.createElement("p", {
    className: "rd-ldg-dircut-r",
    key: ri
  }, React.createElement("em", {
    className: "rd-ldg-dircut-h"
  }, row.head), row.cuts.map(c => React.createElement("span", {
    className: "rd-ldg-li",
    key: c.label,
    title: c.right != null ? c.label + ": " + rdApNum(c.right) + "% right direction, " + rdApNum(c.wrong) + "% wrong track" : c.label + ": " + rdApNum(c.wrong) + "% say wrong track"
  }, React.createElement("em", {
    style: {
      color: c.k && RD_AP_PRIM_META[c.k] ? RD_AP_PRIM_META[c.k].ink : null
    }
  }, c.label), " ", row.form === "wrong" ? React.createElement(React.Fragment, null, React.createElement("b", null, rdApNum(c.wrong)), c.right != null && React.createElement("i", {
    className: "rd-ldg-dircut-note"
  }, " (right ", rdApNum(c.right), ")")) : React.createElement("b", null, rdApNum(c.right), "\u2013", rdApNum(c.wrong))))))));
}
const RD_LG_PREFS_REGIONS = [["inner", "Inner metro"], ["outer", "Outer metro"], ["regional", "Regional"], ["all", "All regions"]];
const RD_LG_PREFS_ALL = "All regions is this site’s weighting of the three regions DemosAU prints: each region’s 2025 enrolment times the group’s vote there in this MRP";
const rdLgFlowCell = (k, v, suffix) => v != null && React.createElement("span", {
  key: k,
  className: "rd-ldg-li"
}, React.createElement("em", {
  style: {
    color: RD_AP_PRIM_META[k] ? RD_AP_PRIM_META[k].ink : null
  }
}, RD_AP_PRIM_META[k] ? RD_AP_PRIM_META[k].lab : k), " ", React.createElement("b", null, rdApNum(v)), suffix);
const rdLgFlowGrp = (title, cells) => cells && React.createElement("span", {
  className: "rd-ldg-grp rd-ldg-grpw rd-ldg-pgrp"
}, React.createElement("span", {
  className: "rd-ldg-li lbl rd-ldg-lisoft"
}, title), cells.map(([k, v, suffix]) => rdLgFlowCell(k, v, suffix)));
function RdLgPrefsLine({
  pf
}) {
  const regs = RD_LG_PREFS_REGIONS.filter(([k]) => k !== "all" || pf.all);
  const [ri, setRi] = React.useState(() => Math.max(0, regs.findIndex(([k]) => k === "all")));
  const rk = regs[ri % regs.length][0],
    rn = regs[ri % regs.length][1],
    next = regs[(ri + 1) % regs.length][1];
  const cell = rdLgFlowCell;
  const grp = rdLgFlowGrp;
  const at = t => rk === "all" ? pf.all && pf.all[t] || null : pf[t] ? pf[t][rk] : null;
  const a = at("alp_onp"),
    c = at("lnp_onp");
  return React.createElement("div", {
    className: "rd-ldg-line prefs"
  }, React.createElement("span", {
    className: "rd-ldg-lab"
  }, "Preferences", React.createElement("button", {
    type: "button",
    className: "rd-ldg-cyc",
    title: (rk === "all" ? RD_LG_PREFS_ALL + ". " : "") + "Region shown: " + rn + " — press for " + next,
    "aria-label": rn + (rk === "all" ? " (" + RD_LG_PREFS_ALL + ")" : "") + " – show " + next,
    onClick: ev => {
      ev.stopPropagation();
      setRi((ri + 1) % regs.length);
    }
  }, React.createElement("span", {
    className: "rd-ldg-cycw"
  }, regs.map(([k, n], i) => React.createElement("span", {
    key: k,
    "aria-hidden": "true",
    className: i === ri % regs.length ? "on" : ""
  }, n))), React.createElement("span", {
    className: "rd-ldg-cyca",
    "aria-hidden": "true"
  }, "\u21BB"))), React.createElement("span", {
    className: "rd-ldg-lbody"
  }, a && grp("to ALP v ON", [["lnp", a.lnp], ["grn", a.grn], ["oth", a.oth]]), c && grp("to L/NP v ON", [["alp", c.alp], ["grn", c.grn], ["oth", c.oth]]), pf.onp_alp_lnp != null && grp("to ALP v L/NP", [["onp", pf.onp_alp_lnp, React.createElement("span", {
    className: "rd-ldg-lisoft"
  }, ", nationwide")]])));
}
function RdLgFlowsLine({
  p
}) {
  const grp = rdLgFlowGrp;
  return React.createElement("div", {
    className: "rd-ldg-line flows"
  }, React.createElement("span", {
    className: "rd-ldg-lab"
  }, "Preferences"), React.createElement("span", {
    className: "rd-ldg-lbody"
  }, React.createElement("span", {
    className: "rd-ldg-li lbl rd-ldg-lisoft"
  }, "If forced to choose"), (p.splitCoal != null || p.splitGrnOn != null || p.splitOthOn != null) && grp("to ALP v ON", [["lnp", p.splitCoal], ["grn", p.splitGrnOn], ["oth", p.splitOthOn]]), (p.splitGrn != null || p.splitOnp != null || p.splitOth != null) && grp("to ALP v L/NP", [["grn", p.splitGrn], ["onp", p.splitOnp], ["oth", p.splitOth]]), p.splitCoalEst && React.createElement("span", {
    className: "rd-ldg-li rd-ldg-lisoft"
  }, "the Coalition split combines the report\u2019s printed CLP/LNP/Nat and Liberal rows (no combined row was printed)")));
}
function rdLgLines(p, {
  onM,
  demSplit
}) {
  const out = [];
  const q = p.p || {};
  const U = ({
    children,
    soft,
    lbl
  }) => React.createElement("span", {
    className: "rd-ldg-li" + (soft || lbl ? " rd-ldg-lisoft" : "") + (lbl ? " lbl" : "")
  }, children);
  const pty = (k, v) => React.createElement(React.Fragment, null, React.createElement("em", {
    style: {
      color: RD_AP_PRIM_META[k] ? RD_AP_PRIM_META[k].ink : null
    }
  }, RD_AP_PRIM_META[k] ? RD_AP_PRIM_META[k].lab : k), " ", React.createElement("b", null, v));
  const prim = rdLgPrims().filter(k => q[k.id] != null);
  if (prim.length) {
    const dec = rdLgDecided(p);
    out.push({
      id: "primary",
      lab: "Primary",
      body: React.createElement(React.Fragment, null, prim.map(k => React.createElement(U, {
        key: k.id
      }, pty(k.id, rdApNum(q[k.id])))), dec && React.createElement(U, {
        soft: true
      }, dec.h, " ", dec.w))
    });
  }
  const ta = p.tppAlt;
  const pairB = (a, b, id) => React.createElement("b", null, React.createElement("span", {
    style: {
      color: "var(--alp-text)"
    }
  }, rdApNum(a)), "\u2013", React.createElement("span", {
    style: {
      color: "var(--" + id + "-text)"
    }
  }, rdApNum(b)));
  const mus = [{
    id: "onp",
    n: "One Nation",
    imp: p.alpOnImp,
    pub: ta ? [ta.alp, ta.onp] : null
  }, {
    id: "lnp",
    n: "Coalition",
    imp: p.alpImp,
    pub: p.alp != null && p.lnp != null ? [p.alp, p.lnp] : null
  }].filter(m => m.imp != null || m.pub);
  if (!onM) mus.reverse();
  if (mus.length) {
    out.push({
      id: "twopp",
      lab: "2PP",
      body: React.createElement(React.Fragment, null, mus.map(m => React.createElement("span", {
        key: m.id,
        className: "rd-ldg-grp"
      }, React.createElement(U, null, "v ", m.n, " ", m.imp != null ? pairB(m.imp.toFixed(1), (100 - m.imp).toFixed(1), m.id) : pairB(m.pub[0], m.pub[1], m.id), m.imp == null ? React.createElement("span", {
        className: "rd-ldg-lisoft"
      }, " published") : m.pub ? "," : null), m.imp != null && m.pub && React.createElement(U, {
        soft: true
      }, "published ", pairB(m.pub[0], m.pub[1], m.id)))))
    });
  }
  if (p.pf) out.push({
    id: "prefs",
    self: RdLgPrefsLine,
    pf: p.pf
  });
  if (p.splitCoal != null || p.splitOnp != null || p.splitGrn != null || p.splitGrnOn != null || p.splitOth != null || p.splitOthOn != null) out.push({
    id: "flows",
    self: RdLgFlowsLine,
    p
  });
  const a = p.appr || {};
  let nets = [["alb", "albNet"], ["taylor", "taylorNet"], ["hanson", "hansonNet"]].filter(([, k]) => a[k] != null);
  const sets = window.ppmContests ? window.ppmContests(p) : [];
  if (nets.length || sets.length) {
    const mb = a.metricBy || {};
    const alt = a.alt || {};
    const altNets = ["alb", "taylor", "hanson"].some(id => alt[id] && alt[id].net != null) ? ["alb", "taylor", "hanson"].map(id => [id, mb[id] === "fav" ? a[id + "Net"] : alt[id] && alt[id].net]).filter(([, v]) => v != null) : [];
    if (altNets.length) nets = nets.filter(([id]) => mb[id] !== "fav");
    const allFav = nets.length > 0 && nets.every(([id]) => mb[id] === "fav");
    const contest = (s, i) => {
      const sk = ["alb", "taylor", "ley", "hanson"].filter(k => s[k] != null);
      return React.createElement(React.Fragment, {
        key: "s" + i
      }, i === 0 && React.createElement(U, {
        lbl: true
      }, "Better PM"), sk.length === 2 ? React.createElement(U, null, rdLgWho(p, sk[0]), " ", React.createElement("b", {
        style: {
          color: RD_LG_INK[sk[0]]
        }
      }, s[sk[0]]), "\u2013", React.createElement("b", {
        style: {
          color: RD_LG_INK[sk[1]]
        }
      }, s[sk[1]]), " ", rdLgWho(p, sk[1])) : React.createElement(U, null, sk.map((k, j) => React.createElement(React.Fragment, {
        key: k
      }, j > 0 ? ", " : "", rdLgWho(p, k), " ", React.createElement("b", {
        style: {
          color: RD_LG_INK[k]
        }
      }, s[k])))));
    };
    out.push({
      id: "leadership",
      lab: "Leadership",
      body: React.createElement(React.Fragment, null, nets.length > 0 && React.createElement(U, {
        lbl: true
      }, allFav ? "Net favourability" : "Net approval"), nets.map(([id, k]) => React.createElement(U, {
        key: id
      }, id === "taylor" ? a.oppName || "Taylor" : rdLgWho(a, id), " ", React.createElement("b", {
        style: {
          color: RD_LG_INK[id]
        }
      }, rdLgNet(a[k])))), altNets.length > 0 && React.createElement(U, {
        lbl: true
      }, "Net favourability"), altNets.map(([id, v]) => React.createElement(U, {
        key: "f" + id
      }, id === "taylor" ? a.oppName || "Taylor" : rdLgWho(a, id), " ", React.createElement("b", {
        style: {
          color: RD_LG_INK[id]
        }
      }, rdLgNet(v)))), sets.map(contest))
    });
  }
  if (p.dir) {
    const d = p.dir;
    out.push({
      id: "direction",
      lab: "Direction",
      body: React.createElement(React.Fragment, null, React.createElement(U, null, "right direction ", React.createElement("b", {
        style: {
          color: "var(--mood-pos)"
        }
      }, rdApNum(d.right))), React.createElement(U, null, "wrong track ", React.createElement("b", {
        style: {
          color: "var(--mood-neg)"
        }
      }, rdApNum(d.wrong))), React.createElement(U, {
        soft: true
      }, "unsure ", rdApNum(d.unsure != null ? d.unsure : 100 - d.right - d.wrong)))
    });
  }
  if (p.iss) {
    const IM = window.ISS_MAP || [],
      IL = window.ISS_MAP_LAB || {};
    const cells = IM.map(id => {
      const o = window.issOwnOf(p, id);
      const L = o ? window.issLeadOf(o) : null;
      return L ? {
        id,
        L
      } : null;
    }).filter(Boolean);
    const sal = (p.iss.sal || p.iss.conc || []).slice(0, 3);
    out.push({
      id: "issues",
      lab: "Issues",
      body: React.createElement(React.Fragment, null, cells.length > 0 ? cells.map(({
        id,
        L
      }) => {
        const M = window.ISS_PARTY_META[L.who];
        return React.createElement(U, {
          key: id
        }, IL[id], " ", L.level ? React.createElement("b", null, "level") : React.createElement("b", {
          style: {
            color: M ? M[2] : null
          }
        }, (M ? M[1] : L.who) + " +" + Math.round(L.lead)));
      }) : sal.map(([lab, v]) => React.createElement(U, {
        key: lab
      }, lab, " ", React.createElement("b", null, rdApNum(v)))))
    });
  }
  if (p.grp && p.grp.d) {
    const nG = Object.values(p.grp.d).reduce((t, r) => t + r.length, 0),
      nC = Object.keys(p.grp.d).length;
    const pr = (() => {
      if (!window.demPairOf) return null;
      const ids = [demSplit || "age"].concat((window.DEM_SPLITS || []).map(x => x.id));
      for (const id of ids) {
        const r = window.demPairOf(p, id);
        if (r) return r;
      }
      return null;
    })();
    const sg = v => (v > 0 ? "+" : v < 0 ? "−" : "") + rdApNum(Math.abs(v));
    out.push({
      id: "demographics",
      lab: "Demographics",
      body: React.createElement(React.Fragment, null, pr && React.createElement(U, {
        lbl: true
      }, pr.lab), pr && rdLgPrims().filter(k => pr.gap[k.id] != null).map(k => React.createElement(U, {
        key: k.id
      }, pty(k.id, sg(pr.gap[k.id])))), React.createElement(U, {
        soft: true
      }, nG, " groups in ", rdNumWord(nC), " breakdown", nC === 1 ? "" : "s"))
    });
  }
  const seats = p.seats && p.seats.p ? rdLgPrims().filter(k => p.seats.p[k.id]) : [];
  if (seats.length) {
    out.push({
      id: "seats",
      lab: "Seats",
      body: React.createElement(React.Fragment, null, seats.map(k => {
        const s = p.seats.p[k.id];
        return React.createElement(U, {
          key: k.id
        }, pty(k.id, s.est != null ? s.est : s.lo + "–" + s.hi));
      }), React.createElement(U, {
        soft: true
      }, "modelled", p.seats.rangeOnly && p.seats.method ? " – " + p.seats.method : ""))
    });
  }
  if (p.sw) {
    const w = p.sw;
    out.push({
      id: "switching",
      lab: "To One Nation",
      body: React.createElement(React.Fragment, null, React.createElement(U, {
        lbl: true
      }, "Share of each ", rdElecYear, " vote now with One Nation"), ["lnp", "alp", "grn", "oth"].filter(k => w[k] != null).map(k => React.createElement(U, {
        key: k
      }, pty(k, rdApNum(w[k])))), w.onp != null && React.createElement(U, null, pty("onp", rdApNum(w.onp)), " ", React.createElement("span", {
        className: "rd-ldg-lisoft"
      }, "kept")))
    });
  }
  if (p.cons) {
    const ORDER = ["alp", "lnp", "grn", "onp", "ind", "oth", "none"];
    const def = rdApConsDef(p);
    const ks = ORDER.filter(k => def.m[k] != null);
    out.push({
      id: "cons",
      lab: "Consideration",
      body: React.createElement(React.Fragment, null, ks.map(k => React.createElement(U, {
        key: k
      }, k === "none" ? React.createElement(React.Fragment, null, "none ", React.createElement("b", null, rdApNum(def.m[k]))) : pty(k, rdApNum(def.m[k])))), React.createElement(U, {
        soft: true
      }, def.note))
    });
  }
  const bo = window.AUSPOL.publicOpinionByRow && window.AUSPOL.publicOpinionByRow[p.pollster + "|" + p.released];
  if (bo) {
    out.push({
      id: "opinion",
      lab: "Public opinion",
      body: React.createElement(React.Fragment, null, bo.t.map(t => React.createElement(U, {
        key: t
      }, t)), React.createElement(U, {
        soft: true
      }, bo.n, " question", bo.n === 1 ? "" : "s"))
    });
  }
  return out;
}
function RdLedger({
  p,
  facet,
  onM,
  side,
  lead,
  wide,
  onLine,
  sources,
  foot,
  demSplit,
  moe,
  latest
}) {
  const lines = rdLgLines(p, {
    onM,
    demSplit
  });
  const NOTE = {
    twopp: rdLgChgNote(p, ["impOn", "imp", "altAlpOn", "alp2pp"]),
    primary: rdLgChgNote(p, ["pAlp", "pLnp", "pGrn", "pOnp", "pOth", "und"]),
    leadership: rdLgChgNote(p, ["albNet", "taylorNet", "hansonNet", "albFav", "taylorFav", "hansonFav"])
  };
  const FULL = {
    primary: () => React.createElement(RdLgVote, {
      p: p,
      note: NOTE.primary
    }),
    twopp: () => React.createElement(RdLgTpp, {
      p: p,
      onM: onM,
      moe: moe,
      note: NOTE.twopp
    }),
    leadership: () => React.createElement(RdLgLeaders, {
      p: p,
      note: NOTE.leadership
    }),
    direction: () => React.createElement(RdLgDir, {
      p: p
    })
  };
  const HEAD = {
    primary: "Primary vote, %",
    twopp: "Two-party preferred",
    leadership: "Leaders",
    direction: "The country is heading"
  };
  const body = lead || (FULL[facet] ? FULL[facet]() : null);
  const rest = lines.filter(l => l.id !== facet);
  const ASKED = {
    primary: "primary vote",
    twopp: "two-party vote",
    leadership: "leaders",
    direction: "direction question",
    issues: "issues",
    demographics: "vote by group"
  };
  return React.createElement("div", {
    className: "rd-ldg poll-detail" + (wide ? " wide" : "") + (side ? "" : " noside"),
    "data-pollster": p.pollster
  }, React.createElement("div", {
    className: "rd-ldg-head"
  }, React.createElement("span", {
    className: "rd-apd-h rd-ldg-sent"
  }, rdPollHead(p)), (sources || foot) && React.createElement("div", {
    className: "rd-ldg-srcs"
  }, sources, foot && React.createElement("span", {
    className: "rd-ldg-acts"
  }, foot))), React.createElement("div", {
    className: "rd-ldg-lead"
  }, lead || React.createElement("section", {
    className: "rd-ldg-sec",
    "data-sec": facet
  }, React.createElement("h4", {
    className: "rd-ldg-h"
  }, HEAD[facet] || RD_LG_TAB[facet] || facet), body || React.createElement("p", {
    className: "rd-ldg-foot1"
  }, p.pollster, " didn\u2019t publish a ", ASKED[facet] || facet, " figure in this poll."))), side && React.createElement("div", {
    className: "rd-ldg-side"
  }, side), rest.length > 0 && React.createElement("div", {
    className: "rd-ldg-also"
  }, React.createElement("h4", {
    className: "rd-ldg-h"
  }, "Also in this poll"), React.createElement("div", {
    className: "rd-ldg-lines"
  }, rest.map(l => {
    if (l.self) {
      const Self = l.self;
      return React.createElement(Self, {
        key: l.id,
        pf: l.pf,
        p: l.p
      });
    }
    const panelGo = RD_LG_PANEL[l.id];
    const can = !!(onLine && (RD_LG_TAB[l.id] || panelGo));
    const Tag = can ? "button" : "div";
    const away = panelGo ? !panelGo.onSnapshot || !latest : latest && !RD_LG_LATEST_TABS[l.id];
    return React.createElement(Tag, {
      key: l.id,
      type: can ? "button" : undefined,
      className: "rd-ldg-line" + (can ? " go" : ""),
      onClick: can ? e => {
        e.stopPropagation();
        onLine(l.id, e.currentTarget);
      } : undefined,
      title: can ? panelGo ? away ? "Open " + panelGo.tip + " on " + panelGo.where : "Show " + panelGo.tip : away ? "Open this poll on All polls’ " + RD_LG_TAB[l.id] + " tab" : "Show the " + RD_LG_TAB[l.id] + " tab" : undefined
    }, React.createElement("span", {
      className: "rd-ldg-lab"
    }, l.lab), React.createElement("span", {
      className: "rd-ldg-lbody"
    }, l.body), can && React.createElement("span", {
      className: "rd-ldg-arrow",
      "aria-hidden": "true"
    }, away ? "↗" : "→"));
  }))));
}
function RdApPrimRail({
  p
}) {
  const D = window.AUSPOL;
  const q = p.p || {},
    y = p.pyd || {};
  const ks = rdLgPrims().filter(k => q[k.id] != null && y[k.id]);
  if (!ks.length) return null;
  const n = p.sampleEff || (p.sample ? p.sample / rdApDeff() : 0);
  const rows = ks.map(k => {
    const x = +q[k.id],
      v = y[k.id][0],
      he = y[k.id][1];
    const lean = rdApR1(x - v),
      less = he == null ? null : rdApR1(lean - he);
    const m = n ? 196 * Math.sqrt(x / 100 * (1 - x / 100) / n) : null;
    return {
      ...k,
      x,
      v,
      he,
      lean,
      less,
      m,
      out: rdApInside(less != null ? less : lean, m) === "outside"
    };
  });
  const e = p.peff || null;
  const pairOf = id => !e ? null : e.w ? e[id] : e.t ? e.t[id] : null;
  const moves = e && !p.noAgg && rows.some(r => pairOf(r.id));
  const sg = v => v == null ? "—" : rdApSigned(v);
  const ms = rows.map(r => r.m).filter(m => m != null);
  const mTxt = ms.length ? "±" + (Math.min(...ms).toFixed(1) === Math.max(...ms).toFixed(1) ? Math.min(...ms).toFixed(1) : Math.min(...ms).toFixed(1) + "–" + Math.max(...ms).toFixed(1)) : null;
  const now = D.latest && D.latest.primary;
  const around = RD_AP_KAL ? "The trend" : "Polls around it";
  const anyOut = rows.some(r => r.out);
  const say = rows.map(r => r.lab + " " + (Math.abs(r.lean) < 0.05 ? "level with" : Math.abs(r.lean).toFixed(1) + (r.lean > 0 ? " above" : " below")) + " " + (RD_AP_KAL ? "the trend" : "the polls around it")).join("; ");
  return React.createElement(React.Fragment, null, React.createElement("span", {
    className: "rd-apd-ct"
  }, p.pollster, "\u2019s primaries against ", RD_AP_KAL ? "the trend through the other polls" : "the polls fielded around it", ", in points"), React.createElement("div", {
    className: "rd-ldg-pstrips",
    role: "img",
    "aria-label": say
  }, React.createElement("div", {
    className: "rd-ldg-prow rd-ldg-phead",
    "aria-hidden": "true"
  }, React.createElement("span", null), React.createElement("span", {
    className: "rd-ap-hpic"
  }, React.createElement("span", {
    className: "rd-ap-scale"
  }, React.createElement("span", {
    className: "rd-ap-in"
  }, React.createElement("b", {
    className: "rd-ap-scl"
  }, "\u25C0 Lower"), React.createElement("b", {
    className: "rd-ap-scr"
  }, "Higher \u25B6"), [[-6, "6"], [-3, "3"], [0, RD_AP_KAL ? "Trend" : React.createElement(React.Fragment, null, React.createElement("span", {
    className: "rd-ldg-lg"
  }, "Polls around it"), React.createElement("span", {
    className: "rd-ldg-sh"
  }, "Around"))], [3, "3"], [6, "6 pts"]].map(([v, lab]) => React.createElement("span", {
    key: v,
    className: "rd-ap-tk" + (v === 0 ? " mid" : "") + (v === -6 ? " start" : "") + (v === 6 ? " end" : "") + (Math.abs(v) === 3 ? " rd-ldg-lg" : ""),
    style: {
      left: rdApX(v) + "%"
    }
  }, lab))))), React.createElement("span", null)), rows.map(r => React.createElement("div", {
    key: r.id,
    className: "rd-ldg-prow"
  }, React.createElement("b", {
    style: {
      color: r.ink
    }
  }, r.lab), React.createElement("span", {
    className: "rd-ap-pic"
  }, React.createElement(RdApStrip, {
    lean: r.lean,
    moe: r.m,
    he: r.he,
    ink: r.dot
  })), React.createElement("span", {
    className: "rd-ldg-pv",
    style: {
      color: Math.abs(r.lean) >= 0.05 ? r.ink : null
    }
  }, sg(r.lean))))), React.createElement("table", {
    className: "rd-ldg-t rd-ldg-rk rd-ldg-rkp"
  }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null), rows.map(r => React.createElement("th", {
    key: r.id,
    className: "num",
    style: {
      color: r.ink
    }
  }, r.lab)))), React.createElement("tbody", null, React.createElement("tr", null, React.createElement("th", {
    scope: "row"
  }, "This poll"), rows.map(r => React.createElement("td", {
    key: r.id,
    className: "num"
  }, React.createElement("b", null, rdApNum(r.x))))), React.createElement("tr", null, React.createElement("th", {
    scope: "row"
  }, around), rows.map(r => React.createElement("td", {
    key: r.id,
    className: "num"
  }, r.v.toFixed(1)))), React.createElement("tr", null, React.createElement("th", {
    scope: "row"
  }, "Lean"), rows.map(r => React.createElement("td", {
    key: r.id,
    className: "num" + (r.out && r.less == null ? " out" : "")
  }, sg(r.lean)))), React.createElement("tr", null, React.createElement("th", {
    scope: "row"
  }, "House lean"), rows.map(r => React.createElement("td", {
    key: r.id,
    className: "num"
  }, sg(r.he)))), rows.some(r => r.less != null) && React.createElement("tr", null, React.createElement("th", {
    scope: "row"
  }, "Less house lean"), rows.map(r => React.createElement("td", {
    key: r.id,
    className: "num" + (r.out ? " out" : "")
  }, sg(r.less)))), moves && React.createElement("tr", null, React.createElement("th", {
    scope: "row"
  }, e.w ? "Moves today’s" : "Moved them on release"), rows.map(r => {
    const pr = pairOf(r.id);
    return React.createElement("td", {
      key: r.id,
      className: "num"
    }, pr ? sg(rdApR1(pr[1] - pr[0])) : "—");
  })))), React.createElement("p", {
    className: "rd-ldg-foot1"
  }, "Lean is this poll minus ", RD_AP_KAL ? "the trend" : "the polls around it (" + (p.pyd.n === 1 ? "one other poll" : rdNumWord(p.pyd.n) + " others") + " within three weeks)", ", so + means higher; house lean is taken out before averaging.", anyOut ? " Bold: outside the poll’s margin on that party." : "", mTxt ? " Margins " + mTxt + ", " + rdMarginBasis(p) + "." : "", moves && e.w && now ? " Today’s figures: " + rows.filter(r => now[r.id] != null).map(r => r.lab + " " + now[r.id].toFixed(1)).join(", ") + "." : "", moves && !e.w ? " It is out of today’s three-week window; the last row is what it did to the figures when it came out." : ""));
}
const RD_AP_DEM_NOUN = {
  "18–34": "18–34-year-olds",
  "55+": "over-55s",
  "65+": "over-65s",
  "50+": "over-50s",
  "Gen Z": "Gen Z",
  Boomers: "Boomers",
  Women: "women",
  Men: "men",
  University: "university graduates",
  "Year 12 or less": "voters who left school by Year 12",
  School: "voters who left school by Year 12",
  "Inner metro": "inner-city voters",
  Rural: "rural voters",
  "Regional or rural": "regional voters",
  "Capital cities": "capital-city voters",
  "Regional/rural areas": "regional and rural voters",
  Renting: "renters",
  "Renting and other": "renters",
  "Own outright": "outright owners",
  "$150k+": "those on $150k or more",
  "Under $50k": "those on under $50k",
  "$125k+": "those on $125k or more",
  "Under $45k": "those on under $45k",
  "$100k or more": "those on $100k or more",
  "Under $100k": "those on under $100k",
  Retired: "retirees",
  "Full time": "full-time workers",
  Vietnam: "voters born in Vietnam",
  Australia: "voters born in Australia",
  "Mainland China": "voters born in mainland China",
  "South Africa": "voters born in South Africa",
  "United Kingdom": "voters born in the UK"
};
const rdApDemNoun = g => RD_AP_DEM_NOUN[g] || "the " + g + " group";
function rdApFacetStory(facet, upd, demSplit, confBw) {
  const D = window.AUSPOL;
  const J = window.JUR;
  const polls = D.individualPolls || [];
  const inWin = (p, days) => {
    const t = rdApDays(p.released);
    return t > upd - days * 864e5 && t <= upd;
  };
  const poss = id => rdPartyStart(id) + (rdPlural(id) ? "’" : "’s");
  const fromPolls = (n, lo, hi, f) => " comes from " + rdNumWord(n) + " poll" + (n === 1 ? "" : "s") + (n === 1 ? "" : lo === hi ? ", which all read " + f(lo) : ", which range from " + f(lo) + " to " + f(hi));
  const tally = (k, n, has) => n === 1 ? k ? "It " + has : "It doesn’t " + (has === "has" ? "have" : has.replace(/s$/, "")) : k === n ? (n === 2 ? "Both " : "All " + rdNumWord(n) + " ") + (has === "has" ? "have" : has.replace(/s$/, "")) : k === 0 ? "None of them " + has : rdCap(rdNumWord(k)) + " of them " + (k === 1 ? has : has === "has" ? "have" : has.replace(/s$/, ""));
  const below = what => "Below is every " + RD_AP_POLLS + " poll" + (what ? " " + what : "") + " since the " + rdElecYear + " election, newest first, each linked to its source.";
  const range = vals => [Math.min(...vals), Math.max(...vals)];
  if (facet === "primary") {
    const now = D.latest.primary || {};
    const ids = Object.keys(now).filter(k => now[k] != null).sort((a, b) => now[b] - now[a]);
    if (ids.length < 2) return null;
    const [t1, t2] = ids;
    const days = D.latest.method && D.latest.method.windowDays || 21;
    const ps = polls.filter(p => inWin(p, days) && p.p && p.p[t1] != null);
    if (!ps.length) return null;
    const n = ps.length,
      [lo, hi] = range(ps.map(p => p.p[t1]));
    const f = rdApNum;
    const head = RD_AP_KAL ? poss(t1) + " " + now[t1].toFixed(1) + " primary vote is the trend through every poll; " + (n === 1 ? "the last three weeks hold one, at " + f(lo) : "the last three weeks’ " + rdNumWord(n) + (lo === hi ? " all read " + f(lo) : " range from " + f(lo) + " to " + f(hi))) : poss(t1) + " " + now[t1].toFixed(1) + " primary vote" + fromPolls(n, lo, hi, f);
    const lastM = (D.aggPrimary || [])[(D.aggPrimary || []).length - 1] || {};
    const ci = id => lastM.ci && lastM.ci[id] || 0;
    const gap = now[t1] - now[t2];
    const level = gap < Math.sqrt(ci(t1) ** 2 + ci(t2) ** 2);
    const both = ps.filter(p => p.p[t2] != null);
    const ahead = both.filter(p => p.p[t1] > p.p[t2]).length;
    const m = both.length;
    const tl = !m ? "" : m === 1 ? ahead ? "It has " : "It doesn’t have " : ahead === m ? m === 2 ? "Both have " : "All " + rdNumWord(m) + " have " : ahead === 0 ? "None of the " + rdNumWord(m) + " has " : rdCap(rdNumWord(ahead)) + " of the " + rdNumWord(m) + " " + (ahead === 1 ? "has " : "have ");
    const dek = (m ? tl + rdPartyIn(t1) + " ahead of " + rdPartyIn(t2) + ". " : "") + rdPartyStart(t2) + (rdPlural(t2) ? " are " : " is ") + gap.toFixed(1) + " points behind on " + now[t2].toFixed(1) + (level ? ", too close to separate. " : ". ") + below("");
    return {
      head,
      dek
    };
  }
  if (facet === "leadership") {
    const N = D.leaderNow || {};
    const L = {};
    (D.LEADERS || []).forEach(x => {
      L[x.id] = x;
    });
    const pm = L.alb,
      opp = L.taylor;
    if (!pm || !opp) return null;
    const fav = !(N.alb_net && N.alb_net.v != null) && N.alb_fav && N.alb_fav.v != null;
    const a = N[fav ? "alb_fav" : "alb_net"];
    if (!a || a.v == null) return null;
    const what = fav ? "net favourability" : "net approval";
    const days = !fav && !J ? 21 : 42;
    const isFav = p => (p.appr.metricBy || {}).alb === "fav";
    const ps = polls.filter(p => inWin(p, days) && p.appr && p.appr.albNet != null && isFav(p) === !!fav);
    if (!ps.length) return null;
    const n = ps.length,
      [lo, hi] = range(ps.map(p => p.appr.albNet));
    const f = v => rdSigned(v, 0);
    const head = pm.short + "’s " + what + " of " + rdSigned(a.v, 1) + fromPolls(n, lo, hi, f);
    const t = N[fav ? "taylor_fav" : "taylor_net"];
    const both = ps.filter(p => p.appr.taylorNet != null);
    const above = both.filter(p => p.appr.taylorNet > p.appr.albNet).length;
    let dek = "";
    if (t && t.v != null && both.length) {
      dek += tally(above, both.length, "rates") + " " + opp.short + " above " + pm.short + ", and " + opp.short + "’s own " + what + " is " + rdSigned(t.v, 1) + ". ";
    }
    const office = J ? J.office.alb : "PM";
    const pa = N.alb_pref && N.alb_pref.v,
      po = N.taylor_pref && N.taylor_pref.v;
    if (pa != null && po != null) {
      const ra = Math.round(pa),
        ro = Math.round(po);
      dek += ra === ro ? "As preferred " + office + ", " + pm.short + " and " + opp.short + " are level at " + ra + ". " : "As preferred " + office + ", " + (ra > ro ? pm.short + " leads " + opp.short : opp.short + " leads " + pm.short) + " " + Math.max(ra, ro) + "–" + Math.min(ra, ro) + ". ";
    }
    return {
      head,
      dek: dek + below("with leadership numbers")
    };
  }
  if (facet === "direction") {
    const now = D.directionNow;
    if (!now) return null;
    const ps = polls.concat(D.directionOnlyPolls || []).filter(p => inWin(p, 21) && p.dir && p.dir.net != null);
    if (!ps.length) return null;
    const n = ps.length,
      [lo, hi] = range(ps.map(p => p.dir.net));
    const head = "The net mood of " + rdSigned(now.net, 1) + fromPolls(n, lo, hi, v => rdSigned(v, 0));
    const wrongLeads = now.wrong >= now.right;
    const k = ps.filter(p => wrongLeads ? p.dir.wrong > p.dir.right : p.dir.right > p.dir.wrong).length;
    const dek = tally(k, n, "has") + " more voters saying Australia is " + (wrongLeads ? "on the wrong track than heading in the right direction" : "heading in the right direction than on the wrong track") + ". Taken together, " + Math.round(wrongLeads ? now.wrong : now.right) + "% say it’s " + (wrongLeads ? "on the wrong track" : "heading in the right direction") + " and " + Math.round(wrongLeads ? now.right : now.wrong) + "% that it’s " + (wrongLeads ? "heading in the right direction" : "on the wrong track") + ". " + below("with a direction reading");
    return {
      head,
      dek
    };
  }
  if (facet === "issues") {
    const list = (D.issues && D.issues.list || []).filter(it => it.own && it.own.lead);
    if (!list.length) return null;
    const by = {};
    list.forEach(it => {
      (by[it.own.lead] = by[it.own.lead] || []).push(it);
    });
    const lab = it => it.label.charAt(0).toLowerCase() + it.label.slice(1);
    const sig = its => its.filter(it => it.own.leadSig);
    const order = Object.keys(by).sort((x, y) => by[y].length - by[x].length || sig(by[y]).length - sig(by[x]).length);
    const top = order[0],
      mine = by[top],
      clear = sig(mine).length,
      N = list.length;
    let head;
    if (order.length > 1 && by[order[1]].length === mine.length) head = "No party leads on more of the " + rdNumWord(N) + " issues than the others";else head = rdPartyStart(top) + " leads on " + (mine.length === N ? "all " + rdNumWord(N) + " issues" : rdNumWord(mine.length) + " of the " + rdNumWord(N) + " issues") + (clear === mine.length ? "" : clear === 0 ? ", but on none of them clearly" : ", but clearly on only " + rdNumWord(clear));
    const rest = order.slice(head.startsWith("No party") ? 0 : 1);
    const parts = rest.map(id => rdPartyIn(id) + " on " + rdList(by[id].map(lab)));
    let dek = parts.length ? rdCap(parts[0].replace(" on ", " leads on ")) + (parts.length > 1 ? ", and " + parts.slice(1).join(", and ") : "") + ". " : "";
    const soft = mine.filter(it => !it.own.leadSig);
    if (!head.startsWith("No party") && soft.length && clear > 0) dek += poss(top) + " edge on " + rdList(soft.map(lab)) + " is inside the margin of error. ";
    dek += "Each figure pools the last " + (D.issues.window || "six weeks") + "’ polls. " + below("with issues figures");
    return {
      head,
      dek
    };
  }
  if (facet === "demographics") {
    const sp = (window.DEM_SPLITS || []).find(s => s.id === demSplit);
    if (!sp) return null;
    const DG = D.demographics || {};
    const pooled = {};
    (DG.tabs || []).forEach(t => t.sets.forEach(s => s.groups.forEach(g => {
      if (!pooled[g.label]) pooled[g.label] = g;
    })));
    const pair = sp.pairs.find(([x, y]) => pooled[x] && pooled[y]);
    const close = below(sp.scope.charAt(0).toLowerCase() + sp.scope.slice(1)).replace("each linked to its source", "each split into its own pollster’s groups");
    if (pair) {
      const [a, b] = pair,
        A = pooled[a],
        B = pooled[b];
      const gaps = (DG.order || Object.keys(A.v)).filter(k => A.v[k] != null && B.v[k] != null).map(k => {
        const g = A.v[k] - B.v[k];
        return {
          k,
          g,
          hi: g >= 0 ? a : b,
          lo: g >= 0 ? b : a,
          sig: Math.abs(g) > Math.sqrt(((A.ci || {})[k] || 0) ** 2 + ((B.ci || {})[k] || 0) ** 2)
        };
      }).sort((x, y) => Math.abs(y.g) - Math.abs(x.g));
      if (!gaps.length) return null;
      const pts = g => Math.round(Math.abs(g)) + " point" + (Math.round(Math.abs(g)) === 1 ? "" : "s");
      const n = Math.min(A.n || 0, B.n || 0);
      const pool = n ? " The figures pool " + rdNumWord(n) + " poll" + (n === 1 ? "" : "s") + " from the last " + (DG.window || "six weeks") + ". " : " ";
      const w = gaps[0];
      if (!w.sig) {
        return {
          head: rdCap(rdApDemNoun(a)) + " and " + rdApDemNoun(b) + " vote much alike",
          dek: "No party’s vote differs between them by more than the margin of error; the widest gap is " + poss(w.k).replace(/^T/, "t") + ", " + pts(w.g) + "." + pool + close
        };
      }
      const head = poss(w.k) + " vote is " + pts(w.g) + " higher among " + rdApDemNoun(w.hi) + " than " + rdApDemNoun(w.lo);
      const nx = gaps.slice(1).filter(x => x.sig).slice(0, 2);
      const sides = [...new Set(nx.map(x => x.hi))].map(hi => {
        const xs = nx.filter(x => x.hi === hi);
        return xs.map((x, i) => poss(x.k).replace(/^The /, "the ") + (i === 0 ? " is " : " ") + pts(x.g)).join(" and ") + " higher among " + rdApDemNoun(hi);
      });
      const dek = (sides.length ? rdCap(sides.join(", and ")) + "." : "No other party’s gap clears the margin of error.") + pool + close;
      return {
        head,
        dek
      };
    }
    const ps = polls.filter(p => window.demPairOf(p, demSplit)).sort((x, y) => x.released < y.released ? 1 : -1);
    if (!ps.length) return null;
    const p = ps[0],
      pr = window.demPairOf(p, demSplit);
    const gs = Object.keys(pr.gap).filter(k => pr.gap[k] != null).sort((x, y) => Math.abs(pr.gap[y]) - Math.abs(pr.gap[x]));
    if (!gs.length) return null;
    const k = gs[0],
      g = pr.gap[k];
    const head = ps.length === 1 ? "One poll breaks the vote out by " + sp.label.toLowerCase() : rdCap(sp.label.toLowerCase()) + " splits aren’t pooled: each pollster draws its own brackets";
    const who = p.pollster.replace(/^(.+?) \((.+?)\)$/, "$1’s $2 survey");
    const dek = rdCap(rdNumWord(ps.length)) + " poll" + (ps.length === 1 ? " has" : "s have") + " split the vote by " + sp.label.toLowerCase() + ". The newest, " + (who === p.pollster ? who + "’s" : who) + ", puts " + rdPartyIn(k) + " " + Math.round(Math.abs(g)) + " points higher among " + rdApDemNoun(g >= 0 ? pr.a : pr.b) + " than " + rdApDemNoun(g >= 0 ? pr.b : pr.a) + ". " + close;
    return {
      head,
      dek
    };
  }
  if (facet === "confidence") {
    const M = D.confidence || {};
    const G = (confBw ? [["business", "Roy Morgan’s business confidence", 100], ["nabBusiness", "NAB’s business confidence", 0]] : [["consumer", "ANZ–Roy Morgan’s consumer confidence", 100], ["westpacConsumer", "Westpac–MI’s consumer sentiment", 100]]).filter(([k]) => M[k] && M[k].latest && M[k].latest.v != null).map(([k, name, neut]) => ({
      k,
      name,
      neut,
      lat: M[k].latest
    }));
    if (!G.length) return null;
    const fig = (g, v) => g.neut === 0 ? rdSigned(v, Number.isInteger(v) ? 0 : 1).replace(/^\+/, "") : v.toFixed(1);
    const nG = G.length,
      under = G.filter(g => g.lat.v < g.neut).length;
    const laneNoun = confBw ? "business" : "consumer";
    const all = nG === 2 ? "Both" : "All " + rdNumWord(nG);
    const head = under === nG ? all + " " + laneNoun + " gauges sit below neutral" : under === 0 ? all + " " + laneNoun + " gauges sit above neutral" : rdCap(rdNumWord(under)) + " of the " + rdNumWord(nG) + " " + laneNoun + " gauges sit below neutral";
    const moved = G.filter(g => g.lat.chg != null);
    const fell = moved.filter(g => g.lat.chg < 0).length;
    const fellTxt = !moved.length ? "" : fell === moved.length ? (moved.length === 2 ? "Both" : "All " + rdNumWord(moved.length)) + " fell in their latest release. " : fell === 0 ? "None fell in its latest release. " : rdCap(rdNumWord(fell)) + " of the " + rdNumWord(moved.length) + " fell in their latest release. ";
    const newest = G.reduce((m, g) => g.lat.released > m ? g.lat.released : m, "");
    const [, mo, dd] = newest.split("-").map(Number);
    const at = g => g.name + " at " + fig(g, g.lat.v) + (g.lat.chg == null ? "" : Math.abs(g.lat.chg) < 0.05 ? " (unchanged)" : (g.lat.chg < 0 ? " (down " : " (up ") + rdApNum(Math.abs(g.lat.chg)) + ")");
    const latest = G.filter(g => g.lat.released === newest);
    const dek = fellTxt + "The newest release" + (latest.length > 1 ? "s" : "") + ", on " + dd + " " + D.monthNameFull(mo) + ", put" + (latest.length > 1 ? "" : "s") + " " + rdList(latest.map(at)) + ". " + "Below is every release of the " + laneNoun + " indices since the " + rdElecYear + " election, newest first, each linked to its source.";
    return {
      head,
      dek
    };
  }
  return null;
}
const rdApLeanFor = (p, onM, pub) => {
  const y = rdApYd(p, onM, pub);
  const x = pub ? onM ? p.tppAlt ? p.tppAlt.alp : null : p.alpN : onM ? p.alpOnImp : p.alpImp;
  return x != null && y && y.v != null ? +(x - Math.round(y.v * 10) / 10).toFixed(1) : null;
};
function rdApConsStory(upd) {
  const D = window.AUSPOL;
  const waves = (D.individualPolls || []).filter(p => p.cons && rdApConsDef(p).m.onp != null && rdApDays(p.released) <= upd).sort((a, b) => rdApDays(b.released) - rdApDays(a.released));
  if (!waves.length) return null;
  const newest = waves[0],
    nw = rdApConsDef(newest).m;
  const basis = p => rdApConsDef(p).lab.replace(/\s*\(.*\)\s*$/, "").toLowerCase();
  const pct = v => rdApNum(v) + "%";
  const apart = (p, a, b) => Math.abs(a - b) > 1.96 * Math.sqrt((a * (100 - a) + b * (100 - b)) / (p.sample || 1000));
  const rel = (p, id) => {
    const m = rdApConsDef(p).m;
    return !apart(p, m.onp, m[id]) ? 0 : m.onp > m[id] ? 1 : -1;
  };
  const MAJ = {
    alp: "Labor’s",
    lnp: "the Coalition’s"
  };
  const day = iso => {
    const [y, m, d] = iso.split("-").map(Number);
    return d + " " + D.monthNameFull(m) + (y !== new Date(upd).getUTCFullYear() ? " " + y : "");
  };
  const top = ["alp", "lnp"].filter(id => nw[id] != null).sort((a, b) => nw[b] - nw[a])[0];
  const head = "When last asked, by " + newest.pollster + " on " + day(newest.released) + ", " + pct(nw.onp) + " " + basis(newest) + (/vote$/.test(basis(newest)) ? " for " : " ") + "One Nation" + (top ? ", " + ["below ", "close to ", "above "][rel(newest, top) + 1] + MAJ[top] + " " + pct(nw[top]) : "");
  const askers = new Set(waves.map(p => p.pollster + "|" + basis(p))).size;
  const full = waves.filter(p => rdApConsDef(p).m.alp != null);
  const cnt = [1, 0, -1].map(r => full.filter(p => rel(p, "alp") === r).length);
  const parts = ["outscored", "came close to", "trailed"].map((v, i) => cnt[i] ? [v, cnt[i]] : null).filter(Boolean);
  const tallied = full.length < 2 ? "" : parts.length === 1 ? "In all " + rdNumWord(full.length) + " polls that asked about every party, One Nation " + parts[0][0] + " Labor. " : "Of the " + rdNumWord(full.length) + " polls that asked about every party, One Nation " + rdList(parts.map(([v, k], i) => (i ? v.replace(/ to$/, "") : v + " Labor") + " in " + rdNumWord(k))) + ". ";
  const dek = (askers > 1 ? "Pollsters word the question differently, so compare a figure only with the same pollster’s. " : "") + tallied + "Below is every national poll with consideration figures since the 2025 election, newest first, each linked to its source.";
  return {
    head,
    dek
  };
}
function rdApTppStory(onM, pub, upd) {
  const D = window.AUSPOL;
  const today = window.AP.tppLatest(onM ? "alp_on" : "alp_lnp", pub ? "resp" : "imp");
  const winDays = D.latest.method && D.latest.method.windowDays || 21;
  const figOf = p => rdApFig(p, onM, pub);
  const win = (D.individualPolls || []).filter(p => {
    const t = rdApWinMid(p);
    return t >= upd - winDays * 864e5 && t <= upd && figOf(p).a != null;
  });
  if (!today || !win.length) return null;
  const rival = onM ? "One Nation" : "the Coalition";
  const contest = onM ? "onp" : "lnp";
  const vals = win.map(p => figOf(p).a);
  const lo = Math.min(...vals),
    hi = Math.max(...vals);
  const f = v => pub ? rdApNum(v) : v.toFixed(1);
  const n = win.length;
  const head = RD_AP_KAL ? "Labor’s " + today.a.toFixed(1) + " is the trend through every poll; " + (n === 1 ? "the last three weeks hold one, at " + f(lo) : "the last three weeks’ " + rdNumWord(n) + (lo === hi ? " all put Labor on " + f(lo) : " range from " + f(lo) + " to " + f(hi))) : "Labor’s " + today.a.toFixed(1) + " comes from " + rdNumWord(n) + " poll" + (n === 1 ? "" : "s") + (n === 1 ? "" : lo === hi ? ", which all put Labor on " + f(lo) : ", which range from " + f(lo) + " to " + f(hi));
  const ahead = vals.filter(v => v > 50).length;
  const outN = win.filter(p => rdApInside(rdApAdj({
    ...p,
    lean: rdApLeanFor(p, onM, pub)
  }, onM, pub), rdPollMargin(p, contest, pub)) === "outside").length;
  const lead = n === 1 ? ahead ? "It has" : "It doesn’t have" : ahead === n ? n === 2 ? "Both have" : "All " + rdNumWord(n) + " have" : ahead === 0 ? "None of them has" : rdCap(rdNumWord(ahead)) + " of them " + (ahead === 1 ? "has" : "have");
  const tail = n === 1 ? outN ? "it sits further from where its pollster usually lands than its own margin of error. " : "it sits within its own margin of error of where its pollster usually lands. " : outN === 0 ? "none sits further from where its pollster usually lands than its own margin of error. " : outN === 1 ? "one sits further from where its pollster usually lands than its own margin of error. " : rdNumWord(outN) + " sit further from where their pollsters usually land than their own margin of error. ";
  const dek = lead + " Labor ahead of " + rival + ", and " + tail + "Below is every " + RD_AP_POLLS + " poll since the " + rdElecYear + " election, newest first, each linked to its source.";
  return {
    head,
    dek
  };
}
function RdApSheet({
  onClose,
  houses,
  houseRank,
  houseN,
  sel,
  toggleHouse,
  range,
  setRange,
  shownTags,
  tagSel,
  toggleTag,
  tagN,
  count,
  clearAll,
  noun1,
  noun
}) {
  const [allHouses, setAllHouses] = useState(false);
  React.useEffect(() => {
    const esc = e => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", esc);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", esc);
      document.body.style.overflow = prev;
    };
  }, []);
  const list = allHouses ? houseRank : houseRank.slice(0, 6);
  return React.createElement("div", {
    className: "rd-ap-sheetwrap",
    onClick: onClose
  }, React.createElement("div", {
    className: "rd-ap-sheet",
    role: "dialog",
    "aria-modal": "true",
    "aria-label": "Filters",
    onClick: e => e.stopPropagation()
  }, React.createElement("span", {
    className: "rd-ap-grab",
    "aria-hidden": "true"
  }), React.createElement("div", {
    className: "rd-ap-sheethead"
  }, React.createElement("b", null, "Filters"), React.createElement("span", {
    className: "rd-grow"
  }), React.createElement("button", {
    type: "button",
    className: "rd-link",
    onClick: clearAll
  }, "Clear all")), React.createElement("div", {
    className: "rd-ap-sheetbody"
  }, React.createElement("span", {
    className: "rd-ap-sheetk"
  }, "Pollster"), React.createElement("div", {
    role: "group",
    "aria-label": "Pollsters"
  }, list.map(h => React.createElement(PopRow, {
    key: h,
    on: sel.has(h),
    label: h,
    n: houseN[h] || 0,
    onClick: () => toggleHouse(h)
  }))), !allHouses && houseRank.length > 6 && React.createElement("button", {
    type: "button",
    className: "rd-link",
    onClick: () => setAllHouses(true)
  }, "Show all ", houses.length, " pollsters"), React.createElement("span", {
    className: "rd-ap-sheetk"
  }, "Time"), React.createElement("div", {
    className: "rd-ap-sheetpills",
    role: "radiogroup",
    "aria-label": "Time span"
  }, [["all", "Any time"], ["12", "Last 12 months"], ["6", "Last 6 months"], ["3", "Last 3 months"]].map(([id, lab]) => React.createElement("button", {
    key: id,
    type: "button",
    role: "radio",
    "aria-checked": range === id,
    className: "rd-ap-spill" + (range === id ? " on" : ""),
    onClick: () => setRange(id)
  }, React.createElement(RdTabW, {
    t: lab
  })))), React.createElement("span", {
    className: "rd-ap-sheetk"
  }, "Includes"), React.createElement("div", {
    role: "group",
    "aria-label": "What the poll published"
  }, shownTags.map(t => React.createElement(PopRow, {
    key: t.id,
    on: tagSel.has(t.id),
    label: rdApTagLab(t.id),
    n: tagN[t.id] || 0,
    onClick: () => toggleTag(t.id)
  })))), React.createElement("button", {
    type: "button",
    className: "rd-ap-sheetgo",
    onClick: onClose
  }, "Show ", count, " ", count === 1 ? noun1 : noun)));
}
const RD_AP_CONS_TIER = {
  "RedBridge/Accent": {
    loose: {
      tab: "Would consider (≥4/10)",
      note: "rated ≥4/10, rebased over everyone"
    },
    not: {
      tab: "Would not consider (≤3/10)"
    },
    never: {
      tab: "Would never vote (0/10)"
    }
  },
  Essential: {
    loose: {
      tab: "Would consider (definitely or open)",
      note: "the ‘definitely’ and ‘open to’ bands, summed"
    },
    never: {
      tab: "Would never vote"
    }
  }
};
const rdApConsTier = (p, tier) => (RD_AP_CONS_TIER[p.pollster] || RD_AP_CONS_TIER["RedBridge/Accent"])[tier];
const rdApConsDef = p => p.consLoose ? {
  m: p.consLoose,
  lab: rdApConsTier(p, "loose").tab,
  note: rdApConsTier(p, "loose").note
} : {
  m: p.cons,
  lab: p.consBasis || "Would consider",
  note: p.consBasis || "parties the voter would consider"
};
function RdApConsCyc({
  tiers,
  phone,
  primNums,
  primStrip,
  primCardNums,
  cardHead
}) {
  const [ti, setTi] = useState(0);
  const many = tiers.length > 1;
  const t = tiers[Math.min(ti, tiers.length - 1)];
  const next = tiers[(ti + 1) % tiers.length];
  const basis = many ? React.createElement("button", {
    type: "button",
    className: "rd-ap-conscyc",
    title: "Switch to " + next.lab,
    "aria-label": "Consideration range: " + t.lab + ". Switch to " + next.lab,
    onClick: e => {
      e.stopPropagation();
      setTi((ti + 1) % tiers.length);
    }
  }, t.lab, " ", React.createElement("span", {
    "aria-hidden": "true"
  }, "\u21C4")) : phone ? React.createElement("span", {
    className: "rd-ap-csub"
  }, t.lab) : React.createElement("span", {
    className: "rd-ap-sub"
  }, t.lab);
  const ariaPre = "Voting consideration" + (many ? ", " + t.lab : "") + ": ";
  const live = many ? {
    "aria-live": "polite"
  } : null;
  if (phone) return React.createElement(React.Fragment, null, cardHead(many ? React.createElement("span", _extends({
    style: {
      display: "contents"
    }
  }, live), basis) : basis), React.createElement("div", _extends({
    className: "rd-ap-ctier"
  }, live), primCardNums(t.m)), React.createElement("div", {
    className: "rd-ap-cpic"
  }, primStrip(t.m, ariaPre)));
  return React.createElement(React.Fragment, null, React.createElement("span", _extends({
    role: "cell",
    className: "rd-ap-fig"
  }, live), primNums(t.m), basis), primStrip(t.m, ariaPre));
}
function RdAllPolls(P) {
  const {
    rows,
    sorted,
    total,
    houses,
    houseRank,
    houseN,
    tagN,
    shownTags,
    rangeN,
    RANGE_LAB,
    facet,
    onFacet,
    measure,
    onMeasure,
    tppBasis,
    setTppBasis,
    consM,
    setConsM,
    confBus,
    setConfBus,
    q,
    setQ,
    sel,
    setSel,
    toggleHouse,
    range,
    setRange,
    tagSel,
    setTagSel,
    toggleTag,
    pills,
    clearAll,
    sort,
    onSort,
    open,
    setOpen,
    focus,
    onBack,
    backLabel,
    exportCsv,
    bodyRef,
    ofTotal,
    ofHouses,
    demSplit,
    setDemSplit
  } = P;
  const D = window.AUSPOL;
  const ofT = facet === "confidence" ? (D.confidenceOnlyPolls || []).length !== total ? (D.confidenceOnlyPolls || []).length : null : ofTotal != null && ofTotal !== total ? ofTotal : null;
  const ofTxt = ofT ? " of " + ofT : "";
  const noun1 = facet === "confidence" ? "release" : "poll";
  const noun = noun1 + "s";
  const phone = useNarrow("(max-width: 760px)");
  const ctlNarrow = useNarrow("(max-width: 1220px)");
  const demMid = useNarrow("(max-width: 1150px)");
  const pub = tppBasis === "resp";
  const onM = measure !== "lnp";
  const contest = onM ? "onp" : "lnp";
  const rival = onM ? "One Nation" : "the Coalition";
  const rivalInk = onM ? "var(--onp-text)" : "var(--lnp-text)";
  const monthAvg = React.useMemo(() => {
    const src = pub ? onM ? (D.alt2pp || {}).alp_on : D.agg2pp : onM ? D.synthOn : D.synth2pp;
    const o = {};
    (src || []).forEach(d => {
      o[d.ym] = d.alp != null ? d.alp : d.a;
    });
    return o;
  }, [onM, pub]);
  const figOf = p => rdApFig(p, onM, pub);
  const primStripH = 56;
  React.useEffect(() => {
    if (measure !== "lnp" && measure !== "onp") onMeasure("onp");
  }, [measure]);
  const FACET_IDS = ["twopp", "primary", "leadership", "direction", "issues", "demographics"].concat((D.confidenceOnlyPolls || []).length ? ["confidence"] : []).filter(f => !window.JUR || !["direction", "issues", "demographics", "confidence"].includes(f));
  const today = window.AP.tppLatest(onM ? "alp_on" : "alp_lnp", pub ? "resp" : "imp");
  const upd = rdApDays(D.latest.updatedISO);
  const winDays = D.latest.method && D.latest.method.windowDays || 21;
  const inToday = p => {
    const t = rdApWinMid(p);
    return t >= upd - winDays * 864e5 && t <= upd && figOf(p).a != null;
  };
  const win = (facet === "confidence" ? D.individualPolls : rows).filter(inToday);
  const live = React.useMemo(() => {
    const st = facet === "twopp" ? rdApTppStory(onM, pub, upd) : facet === "primary" && consM ? rdApConsStory(upd) : facet === "confidence" ? rdApFacetStory(facet, upd, null, confBus) : facet === "demographics" ? rdApFacetStory(facet, upd, demSplit) : rdApFacetStory(facet, upd);
    return st && st.head ? st : null;
  }, [facet, onM, pub, consM, confBus, demSplit, upd]);
  const head = live ? live.head : null,
    dek = live ? live.dek : null;
  const [hedHold, setHedHold] = useState(0);
  const hedW0 = rdWords(head),
    hedW1 = rdWords(dek);
  const ctlRow = ctlNarrow && (facet === "twopp" || facet === "demographics" || facet === "primary" || facet === "confidence");
  const ebVarRef = useRef(null);
  const [ebFloor, setEbFloor] = useState(0);
  React.useLayoutEffect(() => {
    const box = ebVarRef.current;
    if (!box) return undefined;
    const measure = () => {
      let h = 0;
      for (const c of box.children) h = Math.max(h, c.getBoundingClientRect().height);
      h = Math.ceil(h - 0.01);
      setEbFloor(f => f === h ? f : h);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(measure);
    [...box.children].forEach(c => ro.observe(c));
    return () => ro.disconnect();
  }, [phone]);
  const todayTxt = today ? today.a.toFixed(1) : null;
  const byDate = (sort.key === "date" || sort.key === "pub") && sort.dir < 0;
  const gym = sort.key === "pub" ? p => p.published ? p.published.slice(0, 7) : p.ym : p => p.ym;
  const [minShown, setMinShown] = useState(30);
  const [flatLimit, setFlatLimit] = useState(40);
  const [showAll, setShowAll] = useState(false);
  const fKey = [q, [...sel].join(","), range, [...tagSel].join(","), facet, sort.key, sort.dir, measure, tppBasis].join("|");
  React.useEffect(() => {
    setMinShown(30);
    setFlatLimit(40);
    setShowAll(false);
  }, [fKey]);
  const apSec = () => document.getElementById("rd-ap-top");
  React.useEffect(() => {
    const sc = apSec() && apSec().querySelector('.rd-ap-tabs > [role="group"]');
    if (!sc) return undefined;
    const mark = () => {
      const over = sc.scrollWidth > sc.clientWidth + 1;
      sc.classList.toggle("ovf", over);
      sc.classList.toggle("ovf-l", over && sc.scrollLeft > 1);
      sc.classList.toggle("ovf-r", over && sc.scrollLeft < sc.scrollWidth - sc.clientWidth - 1);
    };
    mark();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(mark) : null;
    if (ro) ro.observe(sc);
    sc.addEventListener("scroll", mark, {
      passive: true
    });
    return () => {
      if (ro) ro.disconnect();
      sc.removeEventListener("scroll", mark);
    };
  }, []);
  React.useEffect(() => {
    const btn = apSec() && apSec().querySelector('.rd-ap-tabs [aria-pressed="true"]');
    const sc = btn && btn.closest('[role="group"]');
    if (!sc || sc.scrollWidth <= sc.clientWidth + 1) return;
    const r = btn.getBoundingClientRect(),
      s = sc.getBoundingClientRect();
    if (r.left < s.left + 28) sc.scrollTo({
      left: sc.scrollLeft + r.left - s.left - 28,
      behavior: SM
    });else if (r.right > s.right - 28) sc.scrollTo({
      left: sc.scrollLeft + r.right - s.right + 28,
      behavior: SM
    });
  }, [facet]);
  const rowKey = p => p.pollster + "|" + p.released;
  const openRow = open ? sorted.find(p => rowKey(p) === open) : null;
  let groups = null,
    flat = null,
    nShown = 0;
  if (byDate) {
    groups = [];
    for (const p of sorted) {
      const ym = gym(p);
      const g = groups[groups.length - 1];
      if (!g || g.ym !== ym) {
        const needOpen = openRow && !groups.some(x => x.ym === gym(openRow));
        if (!showAll && nShown >= minShown && !needOpen) break;
        groups.push({
          ym,
          list: []
        });
      }
      groups[groups.length - 1].list.push(p);
      nShown++;
    }
  } else {
    const lim = showAll ? sorted.length : Math.max(flatLimit, openRow ? sorted.indexOf(openRow) + 1 : 0);
    flat = sorted.slice(0, lim);
    nShown = flat.length;
  }
  const more = nShown < sorted.length;
  const visRows = byDate ? groups.flatMap(g => g.list) : flat;
  const FACET_LAB = {
    twopp: "2PP",
    primary: "Primary",
    leadership: phone ? "Leaders" : "Leadership",
    direction: "Direction",
    issues: "Issues",
    demographics: "Demographics",
    confidence: "Confidence"
  };
  const FACETS = FACET_IDS.map(id => ({
    id,
    label: FACET_LAB[id]
  }));
  const rowNav = (e, p, demFam) => {
    if (e.target !== e.currentTarget) return;
    const id = rowKey(p);
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen(open === id ? null : id);
      return;
    }
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const f = (FACETS.findIndex(x => x.id === facet) + (e.key === "ArrowRight" ? 1 : -1) + FACETS.length) % FACETS.length;
      const rowSel = phone ? ".rd-ap-card" : ".rd-ap-row";
      const at = [...(bodyRef.current ? bodyRef.current.querySelectorAll(rowSel) : [])].indexOf(e.currentTarget);
      facetPick(FACETS[f].id);
      requestAnimationFrame(() => {
        const act = document.activeElement;
        if (act && act.closest && act.closest(rowSel)) return;
        const rows = bodyRef.current ? bodyRef.current.querySelectorAll(rowSel) : [];
        const nx = rows[Math.min(Math.max(at, 0), rows.length - 1)];
        if (nx) nx.focus({
          preventScroll: true
        });
      });
      return;
    }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const walk = demFam ? demFamRowsOf(demFam) : visRows;
    const base = demFam ? demFamOffset(demFam) : 0;
    const j = walk.indexOf(p) + (e.key === "ArrowDown" ? 1 : -1);
    const nx = walk[j];
    if (!nx) return;
    if (open === id) setOpen(rowKey(nx));
    const rows = bodyRef.current ? bodyRef.current.querySelectorAll(phone ? ".rd-ap-card" : ".rd-ap-row") : [];
    if (rows[base + j]) rows[base + j].focus();
  };
  const sentRef = useRef(null),
    headRef = useRef(null),
    searchRef = useRef(null);
  const [pinned, setPinned] = useState(false);
  const [sheet, setSheet] = useState(false);
  React.useEffect(() => {
    let raf = 0;
    const fit = () => {
      const bar = document.querySelector(".tabs.sticky");
      const sec = headRef.current && headRef.current.closest(".rd-ap");
      if (bar && sec) sec.style.setProperty("--rd-pin", Math.round(bar.getBoundingClientRect().height) + "px");
    };
    const check = () => {
      raf = 0;
      const s = sentRef.current,
        h = headRef.current;
      if (!s || !h) return;
      const pin = parseFloat(getComputedStyle(h).top) || 0;
      setPinned(s.getBoundingClientRect().top < pin - 1);
    };
    const on = () => {
      if (!raf) raf = requestAnimationFrame(check);
    };
    const onResize = () => {
      fit();
      on();
    };
    window.addEventListener("scroll", on, {
      passive: true
    });
    window.addEventListener("resize", onResize);
    fit();
    check();
    return () => {
      window.removeEventListener("scroll", on);
      window.removeEventListener("resize", onResize);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [phone]);
  const toSearch = () => {
    const el = searchRef.current;
    if (!el) return;
    el.scrollIntoView({
      behavior: SM,
      block: "center"
    });
    setTimeout(() => el.focus({
      preventScroll: true
    }), 350);
  };
  const nFilters = sel.size + tagSel.size + (range !== "all" ? 1 : 0) + (q.trim() ? 1 : 0);
  const shownPills = pills.filter(f => !f.auto).map(f => f.k[0] === "t" && RD_AP_TAGS[f.k.slice(1)] ? {
    ...f,
    lab: rdApTagLab(f.k.slice(1))
  } : f);
  const [tip, setTip] = useState(null);
  const facetWas = useRef(facet),
    facetSwaps = useRef(0);
  if (facetWas.current !== facet) {
    facetWas.current = facet;
    facetSwaps.current += 1;
  }
  const cls = {
    twopp: "rd-ap-c2pp",
    primary: "rd-ap-cprim",
    leadership: "rd-ap-clead",
    direction: "rd-ap-cdir",
    issues: "rd-ap-ciss",
    demographics: "rd-ap-cdem",
    confidence: "rd-ap-cconf"
  }[facet] + (facetSwaps.current ? " rd-ap-sw" : "");
  const th = (label, k, o) => {
    const on = sort.key === k;
    const opt = o || {};
    return React.createElement("button", {
      type: "button",
      role: "columnheader",
      className: "rd-ap-th" + (on ? " on" : "") + (opt.right ? " r" : "") + (opt.wrap ? " wrap" : ""),
      "aria-sort": on ? sort.dir < 0 ? "descending" : "ascending" : "none",
      onClick: () => onSort(k),
      style: opt.color ? {
        color: opt.color
      } : null,
      title: opt.title
    }, label, "\u00a0", React.createElement("span", {
      "aria-hidden": "true",
      className: "rd-ap-arr"
    }, on ? sort.dir < 0 ? "▾" : "▴" : "▾"));
  };
  const LD = (() => {
    let lo = -40,
      hi = 20;
    rows.forEach(p => {
      const a = p.appr || {};
      ["albNet", "taylorNet", "hansonNet"].forEach(k => {
        if (a[k] != null) {
          lo = Math.min(lo, a[k]);
          hi = Math.max(hi, a[k]);
        }
      });
    });
    return {
      lo: Math.floor(lo / 10) * 10,
      hi: Math.ceil(hi / 10) * 10
    };
  })();
  const ldx = v => (v - LD.lo) / (LD.hi - LD.lo) * 100;
  const ldTicks = [];
  for (let v = Math.ceil(LD.lo / 20) * 20; v <= LD.hi; v += 20) ldTicks.push(v);
  const PMAX = facet === "primary" && consM ? 70 : 45;
  const PTKS = [];
  for (let v = 0; v < PMAX; v += 10) PTKS.push(v);
  const PLAST = PTKS[PTKS.length - 1];
  const pdx = v => Math.max(0, Math.min(PMAX, v)) / PMAX * 100;
  const rdApDodge = xs => {
    const R = 3.2;
    const tops = new Array(xs.length).fill(0);
    const ord = xs.map((_, i) => i).sort((a, b) => xs[a] - xs[b]);
    for (let i = 0; i < ord.length;) {
      let j = i;
      while (j + 1 < ord.length && xs[ord[j + 1]] - xs[ord[j]] < R) j++;
      if (j > i) {
        const k = j - i + 1;
        for (let n = 0; n < k; n++) tops[ord[i + n]] = (n - (k - 1) / 2) * (12 / (k - 1));
      }
      i = j + 1;
    }
    return tops;
  };
  const prims = rdApPrimList(D.latest && D.latest.primaryOrder || RD_AP_PRIM_FALLBACK);
  const SPLITS = window.DEM_SPLITS || [];
  const spl = SPLITS.find(x => x.id === demSplit) || SPLITS[0];
  const demFams = facet === "demographics" && (spl.fams || []).length > 1 ? spl.fams : null;
  const famSeed = React.useRef(false);
  const [famShut, setFamShut] = useState(() => new Set());
  if (!famSeed.current && demFams) {
    famSeed.current = true;
    const shut = new Set();
    for (const fam of demFams) if (sorted.filter(p => window.demPairOf(p, demSplit, fam.id)).length >= 2) shut.add(fam.id);
    if (shut.size) setFamShut(shut);
  }
  const toggleFam = id => setFamShut(s => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id);else n.add(id);
    return n;
  });
  const [demCapLo, demCapHi] = (() => {
    if (demFams && byDate) return [null, null];
    if (!spl.pairs.some(p => p[3] != null && p[4] != null)) return [spl.lo, spl.hi];
    const found = new Map();
    for (const p of rows) {
      const pr = window.demPairOf(p, demSplit);
      if (pr) found.set(pr.a + "" + pr.b, [pr.loCap, pr.hiCap]);
    }
    if (found.size === 1) return [...found.values()][0];
    if (found.size === 0) return [spl.lo, spl.hi];
    return [null, null];
  })();
  const demFamTables = demFams && byDate ? demFams.map(fam => {
    const list = (groups || []).flatMap(g => g.list).filter(p => window.demPairOf(p, demSplit, fam.id));
    const gs = [];
    for (const p of list) {
      const ym = gym(p);
      if (!gs.length || gs[gs.length - 1].ym !== ym) gs.push({
        ym,
        list: []
      });
      gs[gs.length - 1].list.push(p);
    }
    return {
      fam,
      groups: gs,
      rows: list
    };
  }).filter(t => t.rows.length) : null;
  const famCapsOf = t => {
    const found = new Map();
    for (const p of t.rows) {
      const pr = window.demPairOf(p, demSplit, t.fam.id);
      if (pr && pr.loCap != null && pr.hiCap != null) found.set(pr.a + "" + pr.b, [pr.loCap, pr.hiCap]);
    }
    return found.size === 1 ? [...found.values()][0] : [null, null];
  };
  const demFamRowsOf = famId => demFamTables ? (demFamTables.find(t => t.fam.id === famId) || {}).rows || [] : [];
  const demFamOffset = famId => {
    let o = 0;
    if (demFamTables) for (const t of demFamTables) {
      if (t.fam.id === famId) break;
      o += famShut.has(t.fam.id) ? 0 : t.rows.length;
    }
    return o;
  };
  const DEM_M = 40;
  const gx = v => (Math.max(-DEM_M, Math.min(DEM_M, v)) + DEM_M) / (2 * DEM_M) * 100;
  const gapTxt = v => v == null ? "—" : Math.abs(v) < 0.5 ? "0" : (v > 0 ? "+" : "−") + Math.abs(Math.round(v));
  const DEM_PNAME = {
    alp: "Labor",
    lnp: "the Coalition",
    grn: "the Greens",
    onp: "One Nation",
    oth: "others"
  };
  const IMAP = window.ISS_MAP || [];
  const IMAP_LAB = window.ISS_MAP_LAB || {};
  const IP4 = prims.filter(k => k.id !== "oth");
  const issHyph = id => id === "immigration" ? React.createElement(React.Fragment, null, "Immig\xADration") : id === "economy" ? React.createElement(React.Fragment, null, "Econ\xADomy") : IMAP_LAB[id];
  const demScale = short => {
    const ticks = short ? [[-40, "40"], [-20, "20"], [0, "Even"], [20, "20"], [40, "40 pts"]] : [[-40, "40 pts"], [-30, "30"], [-20, "20"], [-10, "10"], [0, "Even"], [10, "10"], [20, "20"], [30, "30"], [40, "40 pts"]];
    return React.createElement("span", {
      className: "rd-ap-scale",
      "aria-hidden": "true"
    }, React.createElement("span", {
      className: "rd-ap-in"
    }, React.createElement("b", {
      className: "rd-ap-scl"
    }, demCapLo ? "◀ " + demCapLo : ""), React.createElement("b", {
      className: "rd-ap-scr"
    }, demCapHi ? demCapHi + " ▶" : ""), ticks.map(([v, lab]) => React.createElement("span", {
      key: v,
      className: "rd-ap-tk" + (v === 0 ? " mid" : "") + (short && v === -DEM_M ? " start" : "") + (short && v === DEM_M ? " end" : ""),
      style: {
        left: gx(v) + "%"
      }
    }, lab))));
  };
  const CF_LO = 40,
    CF_HI = 120;
  const cfx = v => (Math.max(CF_LO, Math.min(CF_HI, v)) - CF_LO) / (CF_HI - CF_LO) * 100;
  const confPlot = c => c.v + (c.vs === 0 ? 100 : 0);
  const confInk = c => c.k === "consumer" || c.k === "business" ? "var(--confidence-main)" : "var(--confidence-alt)";
  const confFig = v => (v < 0 ? "−" : "") + (Number.isInteger(Math.abs(v)) ? String(Math.abs(v)) : Math.abs(v).toFixed(1));
  const confChg = v => (v < 0 ? "−" : v > 0 ? "+" : "") + confFig(Math.abs(v));
  const CONF_TKS = [40, 60, 80, 100, 120];
  const confScale = phone => React.createElement("span", {
    className: "rd-ap-scale",
    "aria-hidden": "true"
  }, React.createElement("span", {
    className: "rd-ap-in"
  }, React.createElement("b", {
    className: "rd-ap-scl"
  }, "\u25C0 Pessimistic"), React.createElement("b", {
    className: "rd-ap-scr"
  }, "Optimistic \u25B6"), CONF_TKS.map(v => React.createElement("span", {
    key: v,
    className: "rd-ap-tk" + (v === 100 ? " mid" : "") + (phone && v === CF_LO ? " start" : "") + (phone && v === CF_HI ? " end" : ""),
    style: {
      left: cfx(v) + "%"
    }
  }, v === 100 ? "Neutral" : v))));
  const colHead = React.createElement("div", {
    className: "rd-ap-hrow " + cls,
    role: "row"
  }, React.createElement("span", {
    className: "rd-ap-hc1"
  }, th("Pollster", "pollster")), React.createElement("span", {
    className: "rd-ap-hfp"
  }, th("Published", "pub", {
    title: "Sort by the day the poll came out, newest first"
  }), th("Fieldwork", "date", {
    title: "Sort by fieldwork, newest first"
  })), th("Sample", "sample", {
    right: true
  }), React.createElement("span", null), facet === "twopp" && React.createElement(React.Fragment, null, th("Labor v " + (onM ? "One Nation" : "Coalition"), "alp", {
    title: "Sort by Labor’s share",
    wrap: true
  }), React.createElement("span", {
    role: "columnheader",
    "aria-label": "Poll lean against the " + (RD_AP_KAL ? "trend" : "average of the other polls fielded around it"),
    className: "rd-ap-hpic"
  }, React.createElement(RdApScale, {
    onM: onM
  })), th("Lean", "lean", {
    right: true,
    title: "Sort by poll lean, towards Labor first"
  }), React.createElement("span", {
    role: "columnheader",
    className: "rd-ap-th r wrap",
    title: "The pollster\u2019s lean against the other pollsters as of this poll \u2013 what the average takes out of it, and the tick on the strip. The House-lean panel below traces it month by month"
  }, "House lean"), React.createElement("span", null)), facet === "primary" && React.createElement(React.Fragment, null, React.createElement("span", {
    className: "rd-ap-pnums rd-ap-hpn"
  }, prims.map(k => React.createElement(React.Fragment, {
    key: k.id
  }, th(k.lab, "p." + k.id, {
    color: k.ink
  })))), React.createElement("span", {
    className: "rd-ap-hpic",
    "aria-hidden": "true"
  }, React.createElement("span", {
    className: "rd-ap-cap"
  }, consM ? "Voting consideration" : "Primary vote"), React.createElement("span", {
    className: "rd-ap-in"
  }, PTKS.map(v => React.createElement("span", {
    key: v,
    className: "rd-ap-tk",
    style: {
      left: pdx(v) + "%"
    }
  }, v, v === PLAST ? "%" : "")))), React.createElement("span", null)), facet === "leadership" && React.createElement(React.Fragment, null, th(window.JUR ? "Better " + window.JUR.office.alb : "Better PM", "ppm.alb"), React.createElement("span", {
    className: "rd-ap-hpic",
    "aria-hidden": "true"
  }, React.createElement("span", {
    className: "rd-ap-cap"
  }, "Net rating: approve minus disapprove"), React.createElement("span", {
    className: "rd-ap-in"
  }, ldTicks.map(v => React.createElement("span", {
    key: v,
    className: "rd-ap-tk" + (v === 0 ? " mid" : ""),
    style: {
      left: ldx(v) + "%"
    }
  }, v === 0 ? "Even" : rdSigned(v, 0))))), React.createElement("span", {
    className: "rd-ap-nets rd-ap-hnets"
  }, th(window.JUR ? "Prem" : "Alb", "appr.albNet", {
    right: true,
    color: "var(--alp-text)"
  }), th(window.JUR ? "Opp" : "Tay", "appr.taylorNet", {
    right: true,
    color: "var(--lnp-text)"
  }), th(window.JUR ? "ON" : "Han", "appr.hansonNet", {
    right: true,
    color: "var(--onp-text)"
  }))), facet === "direction" && React.createElement(React.Fragment, null, th("Right", "dir.right", {
    color: "var(--mood-pos)"
  }), th("Wrong", "dir.wrong", {
    color: "var(--mood-neg)"
  }), th("Unsure", "dir.unsure"), React.createElement("span", {
    className: "rd-ap-hpic rd-ap-hdir"
  }, React.createElement("span", {
    className: "rd-ap-cap"
  }, "Right direction or wrong track, %")), th("Net", "dir.net", {
    right: true
  })), facet === "issues" && React.createElement(React.Fragment, null, React.createElement("span", {
    className: "rd-ap-imap rd-ap-hpn"
  }, IMAP.map(id => React.createElement("span", {
    key: id,
    role: "columnheader",
    className: "rd-ap-th wrap",
    title: "The party rated best on " + (IMAP_LAB[id] || id).toLowerCase() + " by the most voters, and its lead over the next, in points"
  }, issHyph(id)))), React.createElement("span", null)), facet === "demographics" && React.createElement(React.Fragment, null, React.createElement("span", {
    className: "rd-ap-pnums rd-ap-hpn"
  }, prims.map(k => React.createElement(React.Fragment, {
    key: k.id
  }, th(k.lab, "dem." + k.id, {
    color: k.ink,
    title: "Sort by " + DEM_PNAME[k.id] + "’s gap between the two groups"
  })))), React.createElement("span", {
    role: "columnheader",
    "aria-label": demCapLo && demCapHi ? "Each party’s gap between the two groups, from stronger with " + demCapLo.toLowerCase() + " to stronger with " + demCapHi.toLowerCase() + " voters" : "Each party’s gap between the two groups named on its row",
    className: "rd-ap-hpic"
  }, demScale(demMid)), React.createElement("span", null)), facet === "confidence" && React.createElement(React.Fragment, null, th("Figure", "conf.v", {
    title: "Sort by the gauge’s printed figure (the panel chart’s dot)"
  }), React.createElement("span", {
    role: "columnheader",
    "aria-label": "Each gauge\u2019s figure on a fixed 40\u2013120 scale, more pessimists than optimists below 100 and more optimists above it \u2013 NAB\u2019s net balance drawn 100 points up, its figure printed as NAB\u2019s own",
    className: "rd-ap-hpic"
  }, confScale(false)), th("Change", "conf.chg", {
    right: true,
    title: "Change on the gauge’s own previous release"
  })), React.createElement("span", null));
  const pollsterCell = p => React.createElement("span", {
    role: "rowheader",
    className: "rd-ap-who"
  }, React.createElement("b", null, rdPollNameLink(p, "rd-ap-ext")), React.createElement("span", {
    className: "rd-ap-sub"
  }, p.client));
  const fieldTxt = p => p.fieldPending ? "TBC" : byDate ? p.field : p.field + " ’" + String(p.year).slice(2);
  const fieldCell = p => React.createElement("span", {
    role: "cell",
    className: "rd-ap-when"
  }, React.createElement("b", null, p.fieldPending ? rdFieldTbc(p) : fieldTxt(p)), p.published && React.createElement("span", {
    className: "rd-ap-sub"
  }, "released ", rdDate(p.published.slice(0, 10))));
  const sampleCell = p => React.createElement("span", {
    role: "cell",
    className: "rd-ap-n"
  }, React.createElement("span", null, p.sample != null ? p.sample.toLocaleString() : "—"), p.sampleEff != null ? React.createElement("span", {
    className: "rd-ap-sub"
  }, "eff. ", p.sampleEff.toLocaleString()) : rdEffTbc(p) || rdEffMissing(p) ? React.createElement("span", {
    className: "rd-ap-sub"
  }, rdEffNote(p)) : / \(MRP\)$/.test(p.pollster || "") ? React.createElement("span", {
    className: "rd-ap-sub"
  }, "eff. n/a") : null);
  const tipCard = (p, f, m) => {
    const lean = p.lean;
    const he = rdApHe(p, onM, pub);
    const outside = rdApInside(rdApAdj(p, onM, pub), m) === "outside";
    const way = v => Math.abs(v) < 0.05 ? "level" : rdSigned(v, 1) + " to " + (v > 0 ? "Labor" : onM ? "One Nation" : "Coalition");
    const left = Math.max(22, Math.min(78, rdApX(lean)));
    return React.createElement("span", {
      className: "tip rd-ap-tip",
      style: {
        left: left + "%"
      },
      role: "tooltip"
    }, React.createElement("span", {
      className: "tip-title"
    }, p.pollster, ", ", p.fieldPending ? "TBC" : p.field), React.createElement("span", {
      className: "tip-row"
    }, React.createElement("span", {
      className: "tip-label"
    }, "Labor v ", onM ? "One Nation" : "Coalition", ", ", pub ? "published" : "implied"), React.createElement("span", {
      className: "tip-val"
    }, f.txtA)), React.createElement("span", {
      className: "tip-row"
    }, React.createElement("span", {
      className: "tip-label"
    }, RD_AP_KAL ? "The trend" : "The polls around it"), React.createElement("span", {
      className: "tip-val"
    }, rdApYd(p, onM, pub) ? rdApYd(p, onM, pub).v.toFixed(1) : "—")), React.createElement("span", {
      className: "tip-row"
    }, React.createElement("span", {
      className: "tip-label"
    }, "Lean"), React.createElement("span", {
      className: "tip-val"
    }, way(lean))), he != null && React.createElement("span", {
      className: "tip-row"
    }, React.createElement("span", {
      className: "tip-label"
    }, "Usual lean"), React.createElement("span", {
      className: "tip-val"
    }, way(he))), m != null && React.createElement("span", {
      className: "tip-row"
    }, React.createElement("span", {
      className: "tip-label"
    }, "95% margin"), React.createElement("span", {
      className: "tip-val"
    }, "\xB1", m.toFixed(1))), outside && React.createElement("span", {
      className: "rd-ap-tipnote"
    }, he != null ? "Further from its pollster’s usual lean than its margin, as about one poll in 20 should be" : "Outside its margin, as about one poll in 20 should be"));
  };
  const rowFor = (p, demFam) => {
    const id = rowKey(p);
    const isOpen = open === id;
    const arrived = !!focus && focus.key === id;
    const toggle = () => setOpen(isOpen ? null : id);
    let figs,
      pic,
      val = React.createElement("span", null),
      right1 = null,
      right2 = null,
      body = null,
      hlCell = null,
      consEdge = null;
    const hl = facet === "twopp" ? rdApHe(p, onM, pub) : null;
    if (facet === "twopp") {
      const f = figOf(p);
      const m = f.a != null ? rdPollMargin(p, contest, pub) : null;
      const main = f.a == null ? React.createElement("span", {
        className: "rd-ap-none"
      }, "\u2014") : React.createElement("b", {
        className: "rd-ap-pairfig"
      }, React.createElement("span", {
        style: {
          color: "var(--alp-text)"
        }
      }, f.txtA), React.createElement("span", {
        className: "rd-ap-dash"
      }, " \u2013 "), React.createElement("span", {
        style: {
          color: rivalInk
        }
      }, f.txtB));
      const sub = f.a == null ? f.none : f.sub;
      figs = React.createElement("span", {
        role: "cell",
        className: "rd-ap-fig"
      }, main, sub && React.createElement("span", {
        className: "rd-ap-sub"
      }, sub));
      const hovered = tip === id && p.lean != null && !phone;
      const against = RD_AP_KAL ? "the trend" : "the other polls fielded around it";
      const aria = p.lean == null ? "No figure to set against " + against : (Math.abs(p.lean) < 0.05 ? "Level with " + against : rdSigned(p.lean, 1) + " points against " + against + ", towards " + (p.lean > 0 ? "Labor" : rival)) + (rdApHe(p, onM, pub) != null && Math.abs(rdApHe(p, onM, pub)) >= 0.05 ? "; its pollster usually leans " + rdSigned(rdApHe(p, onM, pub), 1) : "") + (m != null ? "; 95% margin ±" + m.toFixed(1) : "");
      pic = React.createElement("span", {
        className: "rd-ap-pic",
        role: "img",
        "aria-label": aria,
        onMouseEnter: () => setTip(id),
        onMouseLeave: () => setTip(null)
      }, React.createElement(RdApStrip, {
        lean: p.lean,
        moe: m,
        he: rdApHe(p, onM, pub),
        onM: onM,
        phone: phone,
        tip: hovered ? tipCard(p, f, m) : null
      }));
      val = React.createElement("span", {
        role: "cell",
        className: "rd-ap-val",
        style: {
          color: rdApLeanInk(p.lean, onM)
        }
      }, p.lean == null ? "—" : rdApSigned(p.lean));
      right1 = main;
      right2 = sub ? React.createElement("span", {
        className: "rd-ap-sub"
      }, sub) : null;
      hlCell = React.createElement("span", {
        role: "cell",
        className: "rd-ap-hl",
        style: {
          color: rdApLeanInk(hl, onM)
        }
      }, hl == null ? "—" : rdApSigned(hl));
      body = React.createElement("div", {
        className: "rd-ap-cpic" + (hl != null ? " hassub" : ""),
        style: hl != null && primStripH ? {
          height: primStripH + "px"
        } : null
      }, pic, React.createElement("span", {
        className: "rd-ap-cval"
      }, p.lean == null ? "—" : React.createElement(React.Fragment, null, "Lean ", React.createElement("span", {
        style: {
          color: rdApLeanInk(p.lean, onM)
        }
      }, rdApSigned(p.lean)))), hl != null && React.createElement("span", {
        className: "rd-ap-cvalsub"
      }, "House lean ", React.createElement("span", {
        style: {
          color: rdApLeanInk(hl, onM)
        }
      }, rdApSigned(hl))));
    } else if (facet === "primary") {
      const pr = consM && p.cons || p.p || {};
      const tiers = !(consM && p.cons) ? null : (p.consLoose ? [{
        m: p.consLoose,
        lab: rdApConsTier(p, "loose").tab
      }] : []).concat([{
        m: p.cons,
        lab: p.consBasis || "Would consider"
      }]).concat(p.consNot ? [{
        m: p.consNot,
        lab: rdApConsTier(p, "not").tab
      }] : []).concat(p.consNever ? [{
        m: p.consNever,
        lab: rdApConsTier(p, "never").tab
      }] : []);
      const primNums = m => React.createElement("span", {
        className: "rd-ap-pnums"
      }, prims.map(k => React.createElement("b", {
        key: k.id,
        style: {
          color: k.ink
        }
      }, m[k.id] != null ? rdApPrimFig(m[k.id]) : "—")));
      const primStrip = (m, ariaPre) => {
        const cols = prims.filter(k => m[k.id] != null),
          tops = rdApDodge(cols.map(k => pdx(m[k.id])));
        return React.createElement("span", {
          className: "rd-ap-pic",
          role: "img",
          "aria-label": ariaPre + cols.map(k => k.lab + " " + rdApNum(m[k.id])).join(", ")
        }, React.createElement("span", {
          className: "rd-ap-in"
        }, PTKS.map(v => React.createElement("i", {
          key: v,
          className: "rd-ap-gl",
          style: {
            left: pdx(v) + "%"
          }
        })), cols.map((k, di) => React.createElement("i", {
          key: k.id,
          className: "rd-ap-dot",
          style: {
            left: pdx(m[k.id]) + "%",
            background: k.dot,
            ...(tops[di] ? {
              top: "calc(50% + " + tops[di] + "px)"
            } : null)
          }
        }))));
      };
      const primCardNums = m => React.createElement("div", {
        className: "rd-ap-cprim"
      }, prims.map(k => React.createElement("span", {
        key: k.id
      }, React.createElement("em", null, k.lab), React.createElement("b", {
        style: {
          color: k.ink
        }
      }, m[k.id] != null ? rdApPrimFig(m[k.id]) : "—"))));
      if (tiers) {
        if (phone) consEdge = cardHead => React.createElement(RdApConsCyc, {
          tiers: tiers,
          phone: true,
          primNums: primNums,
          primStrip: primStrip,
          primCardNums: primCardNums,
          cardHead: cardHead
        });else {
          figs = React.createElement(RdApConsCyc, {
            tiers: tiers,
            primNums: primNums,
            primStrip: primStrip,
            primCardNums: primCardNums
          });
          pic = null;
        }
      } else {
        figs = React.createElement("span", {
          role: "cell",
          className: "rd-ap-pnums"
        }, prims.map(k => React.createElement("b", {
          key: k.id,
          style: {
            color: k.ink
          }
        }, pr[k.id] != null ? rdApPrimFig(pr[k.id]) : "—")));
        pic = primStrip(pr, "Primary vote: ");
        body = React.createElement(React.Fragment, null, primCardNums(pr), React.createElement("div", {
          className: "rd-ap-cpic"
        }, pic));
      }
    } else if (facet === "leadership") {
      const sets = window.ppmContests(p);
      const opp = sets.find(s => (s.taylor != null || s.ley != null) && s.hanson == null);
      const han = sets.find(s => s.hanson != null && s.taylor == null && s.ley == null);
      const three = sets.find(s => s.hanson != null && (s.taylor != null || s.ley != null));
      const oppV = s => s.taylor != null ? s.taylor : s.ley;
      const oppN = s => apWho(p, "taylor", s.taylor != null ? "Taylor" : "Ley");
      const two = (x, y, yInk) => React.createElement("b", {
        className: "rd-ap-pairfig"
      }, React.createElement("span", {
        style: {
          color: "var(--alp-text)"
        }
      }, x), React.createElement("span", {
        className: "rd-ap-dash"
      }, " \u2013 "), React.createElement("span", {
        style: {
          color: yInk
        }
      }, y));
      let main, sub;
      if (opp) {
        main = two(opp.alb, oppV(opp), "var(--lnp-text)");
        sub = han ? "v " + oppN(opp) + ", " + han.alb + "–" + han.hanson + " v " + apWho(p, "hanson", "Hanson") : apWho(p, "alb", "Albanese") + " v " + oppN(opp);
      } else if (three) {
        main = React.createElement("b", {
          className: "rd-ap-pairfig"
        }, React.createElement("span", {
          style: {
            color: "var(--alp-text)"
          }
        }, three.alb), React.createElement("span", {
          className: "rd-ap-dash"
        }, " \u2013 "), React.createElement("span", {
          style: {
            color: "var(--lnp-text)"
          }
        }, oppV(three)), React.createElement("span", {
          className: "rd-ap-dash"
        }, " \u2013 "), React.createElement("span", {
          style: {
            color: "var(--onp-text)"
          }
        }, three.hanson));
        sub = "three-way";
      } else if (han) {
        main = two(han.alb, han.hanson, "var(--onp-text)");
        sub = apWho(p, "alb", "Albanese") + " v " + apWho(p, "hanson", "Hanson");
      } else {
        main = React.createElement("span", {
          className: "rd-ap-none"
        }, "\u2014");
        sub = "not asked";
      }
      figs = React.createElement("span", {
        role: "cell",
        className: "rd-ap-fig"
      }, main, React.createElement("span", {
        className: "rd-ap-sub"
      }, sub));
      const a = p.appr || {};
      const mb = a.metricBy || {};
      const ldCols = [["hansonNet", "var(--onp)"], ["taylorNet", "var(--lnp)"], ["albNet", "var(--alp)"]].filter(([k]) => a[k] != null);
      const ldTops = rdApDodge(ldCols.map(([k]) => ldx(a[k])));
      pic = React.createElement("span", {
        className: "rd-ap-pic",
        "aria-hidden": "true"
      }, React.createElement("span", {
        className: "rd-ap-in"
      }, ldTicks.filter(v => v !== 0 && v !== LD.lo && v !== LD.hi).map(v => React.createElement("i", {
        key: v,
        className: "rd-ap-gl",
        style: {
          left: ldx(v) + "%"
        }
      })), React.createElement("i", {
        className: "rd-ap-avg",
        style: {
          left: ldx(0) + "%"
        }
      }), ldCols.map(([k, col], di) => React.createElement("i", {
        key: k,
        className: "rd-ap-dot",
        style: {
          left: ldx(a[k]) + "%",
          background: col,
          ...(ldTops[di] ? {
            top: "calc(50% + " + ldTops[di] + "px)"
          } : null)
        }
      }))));
      const fav = ["alb", "taylor", "hanson"].some(k => mb[k] === "fav" && a[k + "Net"] != null);
      const nets = React.createElement("span", {
        className: "rd-ap-nets"
      }, [["albNet", "var(--alp-text)", window.JUR ? "Prem" : "Alb"], ["taylorNet", "var(--lnp-text)", window.JUR ? "Opp" : "Tay"], ["hansonNet", "var(--onp-text)", window.JUR ? "ON" : "Han"]].map(([k, col, lab]) => React.createElement("b", {
        key: k,
        style: {
          color: col
        }
      }, phone && React.createElement("em", null, lab), a[k] != null ? rdSigned(a[k], 0) : "—")));
      val = React.createElement("span", {
        role: "cell",
        className: "rd-ap-netcell"
      }, nets, fav && React.createElement("span", {
        className: "rd-ap-sub"
      }, "favourability"));
      right1 = main;
      right2 = React.createElement("span", {
        className: "rd-ap-sub"
      }, sub);
      body = React.createElement(React.Fragment, null, React.createElement("div", {
        className: "rd-ap-cpic"
      }, pic), React.createElement("div", {
        className: "rd-ap-cnets"
      }, React.createElement("span", {
        className: "rd-ap-sub"
      }, "Net rating", fav ? ", favourability" : ""), React.createElement("span", {
        className: "rd-grow"
      }), nets));
    } else if (facet === "direction") {
      const d = p.dir;
      const dc = d && d.chg || {};
      const noU = !!d && !(d.unsure > 0);
      const dChg = v => rdApChg(v, v != null && !Number.isInteger(v) ? 1 : 0);
      const uChg = noU ? null : dChg(dc.unsure);
      const subRow = d && (dChg(dc.right) || dChg(dc.wrong) || uChg);
      figs = d ? React.createElement(React.Fragment, null, React.createElement("span", {
        role: "cell",
        className: "rd-ap-dnum"
      }, React.createElement("b", {
        style: {
          color: "var(--mood-pos)"
        }
      }, rdApNum(d.right)), dChg(dc.right) && React.createElement("span", {
        className: "rd-ap-sub"
      }, dChg(dc.right))), React.createElement("span", {
        role: "cell",
        className: "rd-ap-dnum"
      }, React.createElement("b", {
        style: {
          color: "var(--mood-neg)"
        }
      }, rdApNum(d.wrong)), dChg(dc.wrong) && React.createElement("span", {
        className: "rd-ap-sub"
      }, dChg(dc.wrong))), React.createElement("span", {
        role: "cell",
        className: "rd-ap-dnum"
      }, React.createElement("span", null, noU ? "—" : rdApNum(d.unsure)), subRow && React.createElement("span", {
        className: "rd-ap-sub",
        "aria-hidden": uChg ? undefined : "true"
      }, uChg || "\u00a0"))) : React.createElement(React.Fragment, null, React.createElement("span", {
        role: "cell",
        className: "rd-ap-none"
      }, "\u2014"), React.createElement("span", null), React.createElement("span", null));
      pic = d ? React.createElement("span", {
        className: "rd-ap-pic",
        role: "img",
        "aria-label": `Right direction ${rdApNum(d.right)}%, ${noU ? "" : `unsure ${rdApNum(d.unsure)}%, `}wrong track ${rdApNum(d.wrong)}%`
      }, React.createElement("span", {
        className: "rd-ap-dbar"
      }, React.createElement("i", {
        style: {
          flexGrow: d.right,
          background: "var(--mood-pos)"
        }
      }), d.unsure > 0 && React.createElement("i", {
        style: {
          flexGrow: d.unsure
        },
        className: "u"
      }), React.createElement("i", {
        style: {
          flexGrow: d.wrong,
          background: "var(--mood-neg)"
        }
      }))) : React.createElement("span", {
        className: "rd-ap-pic"
      });
      val = React.createElement("span", {
        role: "cell",
        className: "rd-ap-val"
      }, d ? rdSigned(d.net, 0) : "—");
      right1 = d ? React.createElement("b", {
        className: "rd-ap-pairfig"
      }, "Net ", rdSigned(d.net, 0)) : React.createElement("span", {
        className: "rd-ap-none"
      }, "\u2014");
      body = d ? React.createElement(React.Fragment, null, React.createElement("div", {
        className: "rd-ap-cpic"
      }, pic), React.createElement("div", {
        className: "rd-ap-csub"
      }, "Right ", React.createElement("b", {
        style: {
          color: "var(--mood-pos)"
        }
      }, rdApNum(d.right)), ", wrong ", React.createElement("b", {
        style: {
          color: "var(--mood-neg)"
        }
      }, rdApNum(d.wrong)), noU ? "" : ", unsure " + rdApNum(d.unsure))) : null;
    } else if (facet === "issues") {
      const cells = IMAP.map(id => {
        const own = window.issOwnOf(p, id);
        return {
          id,
          own,
          L: window.issLeadOf(own)
        };
      });
      const verdict = ({
        L
      }) => !L ? "—" : L.level ? "Level" : React.createElement(React.Fragment, null, React.createElement("span", null, (window.ISS_PARTY_META[L.who] || [L.who, L.who])[1]), " ", React.createElement("span", null, "+", Math.round(L.lead)));
      const ink = ({
        L
      }) => L && !L.level ? (window.ISS_PARTY_META[L.who] || [])[2] : null;
      const words = ({
        id,
        own,
        L
      }) => own ? IMAP_LAB[id] + ": " + (!L ? "no party figures" : L.level ? "level" : (window.ISS_PARTY_META[L.who] || [L.who])[0] + " ahead by " + Math.round(L.lead)) + " (" + IP4.filter(k => own[k.id] != null).map(k => k.lab + " " + rdApNum(own[k.id])).join(", ") + ")" : IMAP_LAB[id] + ": not asked";
      const bar = own => own && React.createElement("i", {
        className: "rd-ap-ibar",
        "aria-hidden": "true"
      }, IP4.filter(k => own[k.id] != null).map(k => React.createElement("i", {
        key: k.id,
        style: {
          width: +own[k.id] + "%",
          background: k.dot
        }
      })));
      figs = React.createElement("span", {
        role: "cell",
        className: "rd-ap-imap"
      }, cells.map(c => React.createElement("span", {
        key: c.id,
        className: "rd-ap-icell",
        "aria-label": words(c)
      }, React.createElement("b", {
        style: ink(c) ? {
          color: ink(c)
        } : null
      }, verdict(c)), bar(c.own))));
      body = React.createElement("div", {
        className: "rd-ap-imapc"
      }, cells.map(c => React.createElement("span", {
        key: c.id,
        "aria-label": words(c)
      }, React.createElement("b", {
        style: ink(c) ? {
          color: ink(c)
        } : null
      }, verdict(c)), bar(c.own))));
    } else if (facet === "demographics") {
      const pr = window.demPairOf(p, demSplit, demFam);
      figs = React.createElement("span", {
        role: "cell",
        className: "rd-ap-fig rd-ap-dgap"
      }, React.createElement("span", {
        className: "rd-ap-pnums"
      }, prims.map(k => React.createElement("b", {
        key: k.id,
        style: {
          color: k.ink
        }
      }, pr ? gapTxt(pr.gap[k.id]) : "—"))), React.createElement("span", {
        className: "rd-ap-sub"
      }, pr ? pr.lab + ", in points" : "no " + spl.label.toLowerCase() + " breakdown"));
      const demCols = pr ? prims.filter(k => pr.gap[k.id] != null) : [];
      const demTops = rdApDodge(demCols.map(k => gx(pr.gap[k.id])));
      pic = React.createElement("span", {
        className: "rd-ap-pic",
        role: "img",
        "aria-label": pr ? pr.lab + ": " + demCols.map(k => k.lab + " " + gapTxt(pr.gap[k.id])).join(", ") + " points" : "No breakdown to split"
      }, React.createElement("span", {
        className: "rd-ap-in"
      }, [-30, -20, -10, 10, 20, 30].map(v => React.createElement("i", {
        key: v,
        className: "rd-ap-gl",
        style: {
          left: gx(v) + "%"
        }
      })), React.createElement("i", {
        className: "rd-ap-avg",
        style: {
          left: gx(0) + "%"
        }
      }), demCols.map((k, di) => React.createElement("i", {
        key: k.id,
        className: "rd-ap-dot",
        style: {
          left: gx(pr.gap[k.id]) + "%",
          background: k.dot,
          ...(demTops[di] ? {
            top: "calc(50% + " + demTops[di] + "px)"
          } : null)
        }
      }))));
      right1 = pr ? React.createElement("span", {
        className: "rd-ap-dpair"
      }, pr.lab) : null;
      body = React.createElement(React.Fragment, null, React.createElement("div", {
        className: "rd-ap-cprim"
      }, prims.map(k => React.createElement("span", {
        key: k.id
      }, React.createElement("em", null, k.lab), React.createElement("b", {
        style: {
          color: k.ink
        }
      }, pr ? gapTxt(pr.gap[k.id]) : "—")))), React.createElement("div", {
        className: "rd-ap-cpic"
      }, pic));
    } else if (facet === "confidence") {
      const c = p.conf;
      const nab = c.vs === 0;
      const chgEf = c.chg != null ? c.chg : c.chgCalc != null ? c.chgCalc : null;
      figs = React.createElement("span", {
        role: "cell",
        className: "rd-ap-fig"
      }, React.createElement("b", null, confFig(c.v)), nab && React.createElement("span", {
        className: "rd-ap-sub"
      }, "net balance"));
      pic = React.createElement("span", {
        className: "rd-ap-pic",
        role: "img",
        "aria-label": p.client + ", " + confFig(c.v) + (chgEf != null ? ", " + confChg(chgEf) + " on the gauge’s previous release" : "") + (nab ? " – a net balance (0 = neutral), drawn 100 points up" : ", 100 = neutral")
      }, React.createElement("span", {
        className: "rd-ap-in"
      }, [60, 80].map(v => React.createElement("i", {
        key: v,
        className: "rd-ap-gl",
        style: {
          left: cfx(v) + "%"
        }
      })), React.createElement("i", {
        className: "rd-ap-avg",
        style: {
          left: cfx(100) + "%"
        }
      }), React.createElement("i", {
        className: "rd-ap-dot",
        style: {
          left: cfx(confPlot(c)) + "%",
          background: confInk(c)
        }
      })));
      const chgInk = chgEf == null || Math.abs(chgEf) < 0.05 ? null : chgEf > 0 ? "var(--mood-pos)" : "var(--mood-neg)";
      val = React.createElement("span", {
        role: "cell",
        className: "rd-ap-val",
        style: chgInk ? {
          color: chgInk
        } : null
      }, chgEf != null ? confChg(chgEf) : "—");
      right1 = React.createElement("b", null, confFig(c.v));
      right2 = nab ? React.createElement("span", {
        className: "rd-ap-sub"
      }, "net balance") : null;
      body = React.createElement(React.Fragment, null, React.createElement("div", {
        className: "rd-ap-cpic"
      }, pic), React.createElement("div", {
        className: "rd-ap-csub"
      }, chgEf != null ? React.createElement(React.Fragment, null, "Change ", React.createElement("b", {
        style: chgInk ? {
          color: chgInk
        } : null
      }, confChg(chgEf)), " on last release") : c.first ? "The gauge’s first release this term" : "Change not printed"));
    }
    const detail = isOpen && React.createElement("div", {
      className: "rd-ap-open",
      role: "row"
    }, React.createElement(RdApDetail, {
      p: p,
      onM: onM,
      pub: pub,
      today: today,
      winN: RD_AP_KAL ? rows.filter(r => !r.noAgg && figOf(r).a != null).length : win.length,
      facet: facet,
      onBack: arrived ? onBack : null,
      backLabel: backLabel,
      demSplit: demSplit,
      setDemSplit: setDemSplit,
      onFacet: onFacet
    }));
    if (phone) {
      const sub = [p.client, fieldTxt(p), p.sample != null ? p.sample.toLocaleString() : null].filter(Boolean).join(", ");
      const cardHead = edge => React.createElement(React.Fragment, null, React.createElement("div", {
        className: "rd-ap-c1"
      }, React.createElement("span", {
        className: "rd-ap-firm"
      }, rdPollNameLink(p, "rd-ap-ext")), React.createElement("span", {
        className: "rd-grow"
      }), edge), React.createElement("div", {
        className: "rd-ap-c2"
      }, React.createElement("span", {
        className: "rd-ap-sub"
      }, sub), React.createElement("span", {
        className: "rd-grow"
      }), right2));
      return React.createElement(React.Fragment, {
        key: id
      }, React.createElement("div", {
        className: "rd-ap-card " + cls + (isOpen ? " open" : "") + (arrived ? " arrived" : ""),
        role: "row",
        "aria-expanded": isOpen,
        onClick: toggle,
        tabIndex: 0,
        onKeyDown: e => rowNav(e, p, demFam)
      }, consEdge ? consEdge(cardHead) : React.createElement(React.Fragment, null, cardHead(right1), body)), detail);
    }
    return React.createElement(React.Fragment, {
      key: id
    }, React.createElement("div", {
      className: "rd-ap-row " + cls + (isOpen ? " open" : "") + (arrived ? " arrived" : ""),
      role: "row",
      "aria-expanded": isOpen,
      onClick: toggle,
      tabIndex: 0,
      onKeyDown: e => rowNav(e, p, demFam)
    }, pollsterCell(p), fieldCell(p), sampleCell(p), React.createElement("span", null), figs, pic, val, facet === "twopp" && React.createElement(React.Fragment, null, hlCell, React.createElement("span", null)), React.createElement("button", {
      type: "button",
      className: "rd-ap-chev" + (isOpen ? " open" : ""),
      "aria-expanded": isOpen,
      "aria-label": (isOpen ? "Hide" : "Show") + " the full " + (facet === "confidence" ? "release" : "poll") + ": " + p.pollster + ", " + (p.fieldPending ? "TBC" : p.field),
      onClick: e => {
        e.stopPropagation();
        toggle();
      }
    }, React.createElement("svg", {
      viewBox: "0 0 10 10",
      width: "9",
      height: "9",
      "aria-hidden": "true"
    }, React.createElement("path", {
      d: "M3 1.5L7.5 5 3 8.5z"
    })))), detail);
  };
  const monthRow = (g, famId) => {
    const [y, m] = g.ym.split("-").map(Number);
    const n = g.list.length;
    const lab = D.monthNameFull(m) + " " + y;
    const count = n + " poll" + (n === 1 ? "" : "s");
    if (facet === "twopp") {
      const k = g.list.filter(inToday).length;
      const allWord = n === 1 ? "in" : n === 2 ? "both in" : "all in";
      const note = count + (todayTxt && k ? k === n ? ", " + allWord + " today’s " + todayTxt : ", " + k + " in today’s " + todayTxt : "");
      const avg = monthAvg[g.ym];
      return React.createElement("div", {
        className: "rd-ap-mrow " + cls,
        role: "row",
        key: "m" + g.ym
      }, React.createElement("span", {
        className: "rd-ap-mlab",
        role: "rowheader"
      }, React.createElement("b", null, lab), React.createElement("span", null, note)), avg != null && React.createElement("span", {
        className: "rd-ap-mavg"
      }, RD_AP_KAL ? "Trend " : phone ? "Avg " : "Average ", React.createElement("b", null, avg.toFixed(1), phone ? "" : " – " + (100 - avg).toFixed(1))));
    }
    if (facet === "primary") {
      const A = (D.aggPrimary || []).find(x => x.ym === g.ym);
      const rings = A && !phone && !consM;
      return React.createElement("div", {
        className: "rd-ap-mrow " + cls,
        role: "row",
        key: "m" + g.ym
      }, React.createElement("span", {
        className: "rd-ap-mlab",
        role: "rowheader"
      }, React.createElement("b", null, lab), React.createElement("span", null, rings ? RD_AP_AVG + ", drawn as rings" : count)), rings && React.createElement("span", {
        className: "rd-ap-pnums rd-ap-mpn"
      }, prims.map(k => React.createElement("span", {
        key: k.id
      }, A[k.id] != null ? A[k.id].toFixed(1) : "—"))), rings && React.createElement("span", {
        className: "rd-ap-pic rd-ap-mpic",
        "aria-hidden": "true"
      }, React.createElement("span", {
        className: "rd-ap-in"
      }, prims.filter(k => A[k.id] != null).map(k => React.createElement("i", {
        key: k.id,
        className: "rd-ap-ring",
        style: {
          left: pdx(A[k.id]) + "%",
          borderColor: k.dot
        }
      })))));
    }
    if (facet === "confidence") {
      return React.createElement("div", {
        className: "rd-ap-mrow " + cls,
        role: "row",
        key: "m" + g.ym
      }, React.createElement("span", {
        className: "rd-ap-mlab",
        role: "rowheader"
      }, React.createElement("b", null, lab), React.createElement("span", null, n + " release" + (n === 1 ? "" : "s"))));
    }
    if (famId) {
      return React.createElement("div", {
        className: "rd-ap-mrow " + cls,
        role: "row",
        key: "m" + g.ym
      }, React.createElement("span", {
        className: "rd-ap-mlab",
        role: "rowheader"
      }, React.createElement("b", null, lab)));
    }
    return React.createElement("div", {
      className: "rd-ap-mrow " + cls,
      role: "row",
      key: "m" + g.ym
    }, React.createElement("span", {
      className: "rd-ap-mlab",
      role: "rowheader"
    }, React.createElement("b", null, lab), React.createElement("span", null, count)));
  };
  const famHead = t => {
    const [lo, hi] = famCapsOf(t);
    const shut = famShut.has(t.fam.id);
    return React.createElement("div", {
      className: "rd-ap-frow " + cls + (shut ? " shut" : ""),
      role: "row",
      key: "f" + t.fam.id,
      "aria-expanded": !shut,
      onClick: () => toggleFam(t.fam.id),
      tabIndex: 0,
      onKeyDown: e => {
        if (e.target !== e.currentTarget) return;
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        toggleFam(t.fam.id);
      }
    }, React.createElement("span", {
      className: "rd-ap-flab",
      role: "rowheader"
    }, React.createElement("b", null, t.fam.lab), React.createElement("span", null, t.fam.sub), shut && React.createElement("span", {
      className: "rd-ap-fn"
    }, t.rows.length + " poll" + (t.rows.length === 1 ? "" : "s"))), !shut && React.createElement("span", {
      className: "rd-ap-fcap",
      "aria-hidden": !lo && !hi ? "true" : undefined,
      title: lo && hi ? "Each party’s gap between the two groups, from stronger with " + lo.toLowerCase() + " voters on the left to stronger with " + hi.toLowerCase() + " voters on the right" : undefined
    }, React.createElement("span", {
      className: "rd-ap-in"
    }, lo && React.createElement("b", {
      className: "rd-ap-scl"
    }, "\u25C0 ", lo), hi && React.createElement("b", {
      className: "rd-ap-scr"
    }, hi, " \u25B6"))), React.createElement("button", {
      type: "button",
      className: "rd-ap-chev" + (shut ? "" : " open"),
      "aria-expanded": !shut,
      "aria-label": (shut ? "Show" : "Hide") + " the " + t.fam.lab + " table",
      onClick: e => {
        e.stopPropagation();
        toggleFam(t.fam.id);
      }
    }, React.createElement("svg", {
      viewBox: "0 0 10 10",
      width: "9",
      height: "9",
      "aria-hidden": "true"
    }, React.createElement("path", {
      d: "M3 1.5L7.5 5 3 8.5z"
    }))));
  };
  const phoneHead = React.createElement("div", {
    className: "rd-ap-phead " + cls
  }, facet === "twopp" && React.createElement("span", {
    className: "rd-ap-hpic"
  }, React.createElement(RdApScale, {
    onM: onM,
    phone: true
  })), facet === "primary" && React.createElement("span", {
    className: "rd-ap-hpic"
  }, React.createElement("span", {
    className: "rd-ap-cap"
  }, consM ? "Voting consideration" : "Primary vote"), React.createElement("span", {
    className: "rd-ap-in"
  }, PTKS.map(v => React.createElement("span", {
    key: v,
    className: "rd-ap-tk",
    style: {
      left: pdx(v) + "%"
    }
  }, v, v === PLAST ? "%" : "")))), facet === "leadership" && React.createElement("span", {
    className: "rd-ap-hpic"
  }, React.createElement("span", {
    className: "rd-ap-cap"
  }, "Net rating: approve minus disapprove"), React.createElement("span", {
    className: "rd-ap-in"
  }, ldTicks.map(v => React.createElement("span", {
    key: v,
    className: "rd-ap-tk" + (v === 0 ? " mid" : "") + (v === LD.lo ? " start" : "") + (v === LD.hi ? " end" : ""),
    style: {
      left: ldx(v) + "%"
    }
  }, v === 0 ? "Even" : rdSigned(v, 0))))), facet === "direction" && React.createElement("span", {
    className: "rd-ap-hpic rd-ap-hdir"
  }, React.createElement("span", {
    className: "rd-ap-cap"
  }, React.createElement("span", {
    style: {
      color: "var(--mood-pos)"
    }
  }, "Right direction"), ", unsure, ", React.createElement("span", {
    style: {
      color: "var(--mood-neg)"
    }
  }, "wrong track"), ", %")), facet === "issues" && React.createElement("span", {
    className: "rd-ap-hpic rd-ap-imaph"
  }, IMAP.map(id => React.createElement("span", {
    key: id
  }, issHyph(id)))), facet === "demographics" && React.createElement("span", {
    className: "rd-ap-hpic"
  }, demScale(true)), facet === "confidence" && React.createElement("span", {
    className: "rd-ap-hpic"
  }, confScale(true)));
  const pinAp = () => {
    const sec = document.getElementById("rd-ap-top");
    if (!sec) return;
    const tabs = sec.querySelector(".rd-ap-tabs"),
      slot = sec.querySelector(".rd-ap-hedslot");
    const sb = document.querySelector(".tabs.sticky"),
      sr = sb && sb.getBoundingClientRect();
    const reserve = sr ? Math.min(sr.bottom, sr.height) : 0;
    const tr = tabs && tabs.getBoundingClientRect();
    if (tr && tr.bottom >= reserve && tr.top <= window.innerHeight) {
      setHedHold(0);
      rdPinScroll([tabs], true);
      return;
    }
    if (slot) setHedHold(slot.getBoundingClientRect().height);
    rdPinScroll([sec.querySelector(".rd-ap-bar"), tabs, sec.querySelector(".rd-ap-table")], true);
  };
  const facetPick = id => {
    pinAp();
    onFacet(id);
  };
  const hoverKeys = React.useRef(false);
  const splitEl = React.useRef(null);
  const splitHover = React.useRef(false);
  const splitArrowLive = React.useRef(null);
  React.useEffect(() => {
    const sec = document.getElementById("rd-ap-top");
    if (!sec) return undefined;
    const enter = () => {
      hoverKeys.current = true;
    };
    const leave = () => {
      hoverKeys.current = false;
    };
    hoverKeys.current = sec.matches(":hover");
    sec.addEventListener("pointerenter", enter);
    sec.addEventListener("pointerleave", leave);
    const dp = splitEl.current;
    const dpEnter = () => {
      splitHover.current = true;
    };
    const dpLeave = () => {
      splitHover.current = false;
    };
    if (dp) {
      splitHover.current = dp.matches(":hover");
      dp.addEventListener("pointerenter", dpEnter);
      dp.addEventListener("pointerleave", dpLeave);
    } else splitHover.current = false;
    const key = e => {
      if (!hoverKeys.current || e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const a = document.activeElement;
      if (a && a.tagName !== "BODY" && a.tagName !== "HTML") return;
      const sel = window.getSelection && window.getSelection();
      if (sel && !sel.isCollapsed) return;
      if (splitHover.current) {
        const el = splitEl.current;
        if (el && el.isConnected && el.getClientRects().length && splitArrowLive.current) {
          e.preventDefault();
          splitArrowLive.current(e.key === "ArrowRight" ? 1 : -1);
          return;
        }
        splitHover.current = false;
      }
      e.preventDefault();
      const i = FACETS.findIndex(x => x.id === facet);
      if (i < 0) return;
      const f = (i + (e.key === "ArrowRight" ? 1 : -1) + FACETS.length) % FACETS.length;
      facetPick(FACETS[f].id);
    };
    document.addEventListener("keydown", key, true);
    return () => {
      sec.removeEventListener("pointerenter", enter);
      sec.removeEventListener("pointerleave", leave);
      if (dp) {
        dp.removeEventListener("pointerenter", dpEnter);
        dp.removeEventListener("pointerleave", dpLeave);
      }
      document.removeEventListener("keydown", key, true);
    };
  }, [facet]);
  const flipPick = () => {
    pinAp();
    onMeasure(onM ? "lnp" : "onp");
  };
  const consFlipPick = () => {
    pinAp();
    setConsM(!consM);
  };
  const confLanePick = () => {
    pinAp();
    setConfBus(!confBus);
  };
  const splitPick = id => {
    pinAp();
    setDemSplit(id);
  };
  splitArrowLive.current = facet === "demographics" && SPLITS.length > 1 ? dir => splitPick(SPLITS[(SPLITS.findIndex(x => x.id === demSplit) + dir + SPLITS.length) % SPLITS.length].id) : null;
  const splitPicker = React.createElement("span", {
    className: "rd-ap-dpick",
    ref: splitEl
  }, React.createElement("span", {
    className: "rd-pl-ctl-l"
  }, "Split by:"), React.createElement("span", {
    role: "radiogroup",
    "aria-label": "Split the vote by",
    onKeyDown: rdTabsKey(SPLITS, splitPick),
    onClick: rdTabFocus
  }, SPLITS.map(x => React.createElement("button", {
    key: x.id,
    type: "button",
    role: "radio",
    "aria-checked": x.id === demSplit,
    onClick: () => splitPick(x.id)
  }, React.createElement(RdTabW, {
    t: x.label
  })))));
  const basisPick = () => {
    pinAp();
    setTppBasis(pub ? "imp" : "resp");
  };
  const spaceFlip = React.useRef(null);
  spaceFlip.current = facet === "twopp" ? flipPick : facet === "primary" ? consFlipPick : facet === "confidence" ? confLanePick : null;
  const pubFlip = React.useRef(null);
  pubFlip.current = facet === "twopp" ? basisPick : null;
  const splitWalk = React.useRef(null);
  splitWalk.current = facet === "demographics" ? () => splitPick(SPLITS[(SPLITS.findIndex(x => x.id === demSplit) + 1) % SPLITS.length].id) : null;
  const splitAt = React.useRef(null);
  splitAt.current = facet === "demographics" ? i => {
    if (SPLITS[i]) splitPick(SPLITS[i].id);
  } : null;
  React.useEffect(() => {
    const sec = document.getElementById("rd-ap-top");
    if (!sec) return undefined;
    const inView = {
      current: false
    };
    const io = new IntersectionObserver(es => es.forEach(en => {
      inView.current = en.isIntersecting;
    }));
    io.observe(sec);
    const key = e => {
      if (!inView.current) return;
      const isPub = e.key === "p" || e.key === "P";
      const isSpace = e.key === " ";
      const dig = e.key.length === 1 && e.key >= "1" && e.key <= "9" ? e.key.charCodeAt(0) - 49 : -1;
      if (!isPub && !isSpace && dig < 0) return;
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || isSpace && e.shiftKey) return;
      const a = document.activeElement;
      const onTab = isSpace && a && a.tagName === "BUTTON" && a.getAttribute("aria-pressed") === "true" && !!(a.closest && a.closest('.rd-ap-tabs [role="group"], .rd-ap-pintabs'));
      if (!onTab && a && a.tagName !== "BODY" && a.tagName !== "HTML") return;
      const sel = window.getSelection && window.getSelection();
      if (sel && !sel.isCollapsed) return;
      const act = isPub ? pubFlip.current : isSpace ? splitWalk.current || spaceFlip.current : splitAt.current;
      if (!act || dig >= SPLITS.length) return;
      e.preventDefault();
      if (!e.repeat) act(dig >= 0 ? dig : undefined);
    };
    document.addEventListener("keydown", key, true);
    return () => {
      io.disconnect();
      document.removeEventListener("keydown", key, true);
    };
  }, []);
  const pinnWNoun = FACETS.some(f => f.id === "confidence") ? "releases" : "polls";
  const pinCount = React.createElement("span", {
    className: "rd-ap-pinn"
  }, React.createElement("span", {
    className: "rd-ap-pinnw",
    "aria-hidden": "true"
  }, total, " of ", total, " ", pinnWNoun), React.createElement("span", {
    className: "rd-ap-pinnl"
  }, React.createElement("b", null, sorted.length), sorted.length !== total ? " of " + (ofT || total) : ofTxt, " ", noun));
  const pinBar = React.createElement("div", {
    className: "rd-ap-pinbar" + (pinned ? " on" : ""),
    "aria-hidden": !pinned
  }, phone ? React.createElement(React.Fragment, null, pinCount, React.createElement("span", {
    className: "rd-grow",
    "aria-hidden": "true"
  }), React.createElement("button", {
    type: "button",
    className: "rd-ap-pinf",
    tabIndex: pinned ? 0 : -1,
    onClick: () => setSheet(true)
  }, React.createElement("svg", {
    viewBox: "0 0 24 24",
    width: "14",
    height: "14",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    "aria-hidden": "true"
  }, React.createElement("path", {
    d: "M4 6h16M7 12h10M10 18h4"
  })), "Filters", nFilters ? ", " + nFilters : "")) : React.createElement(React.Fragment, null, React.createElement("span", {
    className: "rd-ap-pintabs",
    role: "group",
    "aria-label": "Figures",
    onKeyDown: rdTabsKey(FACETS, facetPick),
    onClick: rdTabFocus
  }, FACETS.map(f => React.createElement("button", {
    key: f.id,
    type: "button",
    className: "rd-ap-pint",
    "aria-pressed": facet === f.id,
    tabIndex: pinned ? 0 : -1,
    onClick: () => facetPick(f.id)
  }, React.createElement(RdTabW, {
    t: f.label
  })))), React.createElement("span", {
    className: "rd-grow",
    "aria-hidden": "true"
  }), React.createElement("span", {
    className: "rd-ap-pinsep",
    "aria-hidden": "true"
  }), React.createElement("button", {
    type: "button",
    className: "rd-ap-pins",
    "aria-label": "Search the polls",
    tabIndex: pinned ? 0 : -1,
    onClick: toSearch
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
  }))), pinCount));
  const qpop = React.createElement(RdQPop, {
    label: "How the two-party figures are counted, and the pollsters\u2019 published figures",
    align: "left"
  }, React.createElement("p", null, pub ? "Each poll’s two-party figure as its pollster published it, against " + rdApAgainst(true) + "." : "Each poll’s primary votes read through the same preference flows, the " + rdElecYear + " election’s, so the polls compare like for like. The pollster’s own figure sits beneath."), React.createElement("div", {
    className: "rd-qrow"
  }, React.createElement("span", null, "Show the pollsters\u2019 published figures"), React.createElement(RdSwitch, {
    on: pub,
    onToggle: basisPick,
    label: "Show the pollsters\u2019 published figures"
  })));
  const flip = React.createElement("button", {
    type: "button",
    className: "rd-pl-flip",
    title: "Switch the page to Labor v " + (onM ? "Coalition" : "One Nation"),
    onClick: flipPick
  }, React.createElement("span", {
    className: "rd-pl-flip-t"
  }, "Labor v ", onM ? "One Nation" : "Coalition"), " ", React.createElement("span", {
    "aria-hidden": "true"
  }, "\u21C4"));
  const consFlip = React.createElement("button", {
    type: "button",
    className: "rd-pl-flip",
    "aria-pressed": consM,
    title: consM ? "Switch the figures back to voting intention" : "Switch the figures to voting consideration (the parties voters would consider supporting)",
    onClick: consFlipPick
  }, React.createElement("span", {
    className: "rd-pl-flip-t"
  }, consM ? "Voting consideration" : "Voting intention"), " ", React.createElement("span", {
    "aria-hidden": "true"
  }, "\u21C4"));
  const confLaneFlip = React.createElement("button", {
    type: "button",
    className: "rd-pl-flip",
    "aria-pressed": confBus,
    title: confBus ? "Switch to the consumer confidence gauges" : "Switch to the business confidence gauges",
    onClick: confLanePick
  }, React.createElement("span", {
    className: "rd-pl-flip-t"
  }, confBus ? "Business" : "Consumer", " confidence"), " ", React.createElement("span", {
    "aria-hidden": "true"
  }, "\u21C4"));
  const consQpop = !consM ? null : React.createElement(RdQPop, {
    label: "What voting consideration figures are, and which waves collected them",
    align: "left"
  }, React.createElement("p", null, "Voting consideration is the share of voters who name a party as one they ", React.createElement("i", null, "would consider"), " supporting \u2014 a looser yardstick than voting intention, the party the voter does intend. YouGov and Essential have asked it; every other wave stays on intention, and on a wave without consideration figures the intention figure stands."));
  const eyebrowCopy = (conf, keyId) => React.createElement(React.Fragment, null, React.createElement("h2", _extends({
    className: "rd-title"
  }, keyId ? {
    id: "rd-ap-t"
  } : {}), conf ? "Economic sentiment" : "All polls"), React.createElement("span", {
    className: "rd-meta"
  }, conf ? "Every confidence-index release (business and consumer) since the " + rdElecYear + " election" : "Every " + RD_AP_POLLS + " poll since the " + rdElecYear + " election"));
  return React.createElement("section", {
    className: "rd-sec rd-first rd-ap",
    id: "rd-ap-top",
    "aria-labelledby": "rd-ap-t",
    "data-facet": facet
  }, React.createElement("div", {
    className: "rd-eyebrow",
    style: ebFloor ? {
      minHeight: ebFloor + "px"
    } : null
  }, eyebrowCopy(facet === "confidence", true)), React.createElement("div", {
    className: "rd-ap-ebvar",
    ref: ebVarRef,
    "aria-hidden": "true"
  }, React.createElement("div", {
    className: "rd-eyebrow"
  }, eyebrowCopy(false, false)), React.createElement("div", {
    className: "rd-eyebrow"
  }, eyebrowCopy(true, false))), React.createElement(RdTabs, {
    swipe: true,
    value: facet,
    onChange: facetPick,
    options: FACETS,
    ariaLabel: "Figures",
    className: "rd-ap-tabs"
  }, facet === "twopp" && !ctlNarrow && React.createElement("span", {
    className: "rd-pl-ctl"
  }, React.createElement("span", {
    className: "rd-pl-ctl-l"
  }, "Two-party:"), flip, React.createElement("span", {
    className: "rd-pl-ctl-l"
  }, ", ", pub ? "as published" : "implied flows"), qpop), facet === "demographics" && !ctlNarrow && splitPicker, facet === "primary" && !ctlNarrow && React.createElement("span", {
    className: "rd-pl-ctl"
  }, React.createElement("span", {
    className: "rd-pl-ctl-l"
  }, "Vote:"), consFlip, consQpop), facet === "confidence" && !ctlNarrow && React.createElement("span", {
    className: "rd-pl-ctl"
  }, React.createElement("span", {
    className: "rd-pl-ctl-l"
  }, "Confidence:"), confLaneFlip)), React.createElement("div", {
    className: "rd-ap-hedslot",
    style: hedHold ? {
      minHeight: hedHold + "px"
    } : null
  }, React.createElement(RdGlide, {
    watch: hedW0 !== undefined && hedW1 !== undefined ? (ctlRow ? facet : "") + "\u0000" + hedW0 + "\u0000" + hedW1 : undefined
  }, ctlRow && React.createElement("div", {
    className: "rd-ap-ctlslot"
  }, facet === "twopp" && React.createElement("div", {
    className: "rd-ap-pctl"
  }, flip, React.createElement("span", {
    className: "rd-pl-ctl-l"
  }, ", ", pub ? "as published" : "implied flows"), React.createElement("span", {
    className: "rd-grow"
  }), qpop), facet === "demographics" && React.createElement("div", {
    className: "rd-ap-pctl"
  }, splitPicker), facet === "primary" && React.createElement("div", {
    className: "rd-ap-pctl"
  }, consFlip, React.createElement("span", {
    className: "rd-grow"
  }), consQpop), facet === "confidence" && React.createElement("div", {
    className: "rd-ap-pctl"
  }, confLaneFlip)), head ? React.createElement("h2", {
    className: "rd-hed"
  }, head) : null, dek ? React.createElement("p", {
    className: "rd-dek"
  }, dek) : null)), React.createElement("div", {
    className: "rd-ap-bar"
  }, React.createElement("label", {
    className: "rd-ap-search"
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
    ref: searchRef,
    type: "search",
    value: q,
    onChange: e => setQ(e.target.value),
    autoCorrect: "off",
    spellCheck: false,
    placeholder: "Search a pollster, a date, or a figure",
    "aria-label": "Search the polls"
  }), q && React.createElement("button", {
    type: "button",
    className: "rd-ap-x",
    onClick: () => setQ(""),
    "aria-label": "Clear search"
  }, "\xD7")), React.createElement("span", {
    className: "rd-ap-pops"
  }, React.createElement("select", {
    className: "rd-ap-sel rd-ap-sel-house",
    "aria-label": "Filter by pollster",
    value: "",
    onChange: e => {
      const v = e.target.value;
      if (v === "__clear") setSel(new Set());else if (v) toggleHouse(v);
    }
  }, React.createElement("option", {
    value: "",
    disabled: true
  }, "Pollster"), houseRank.map(h => React.createElement("option", {
    key: h,
    value: h
  }, (sel.has(h) ? "✓ " : "") + h + " (" + (houseN[h] || 0) + ")")), sel.size > 0 && React.createElement("hr", null), sel.size > 0 && React.createElement("option", {
    value: "__clear"
  }, "\u2715 Clear")), React.createElement("select", {
    className: "rd-ap-sel rd-ap-sel-time",
    "aria-label": "Filter by time span",
    value: "",
    onChange: e => {
      const v = e.target.value;
      if (v) setRange(v);
    }
  }, React.createElement("option", {
    value: "",
    disabled: true
  }, "Time"), [["all", "Any time"], ["12", "Last 12 months"], ["6", "Last 6 months"], ["3", "Last 3 months"]].map(([id, lab]) => React.createElement("option", {
    key: id,
    value: id
  }, (range === id ? "✓ " : "") + lab + " (" + rangeN(id) + ")"))), React.createElement("select", {
    className: "rd-ap-sel rd-ap-sel-inc",
    "aria-label": "Filter by what a poll published",
    value: "",
    onChange: e => {
      const v = e.target.value;
      if (v === "__clear") setTagSel(new Set());else if (v) toggleTag(v);
    }
  }, React.createElement("option", {
    value: "",
    disabled: true
  }, "Includes"), shownTags.map(t => React.createElement("option", {
    key: t.id,
    value: t.id
  }, (tagSel.has(t.id) ? "✓ " : "") + rdApTagLab(t.id) + " (" + (tagN[t.id] || 0) + ")" + (RD_AP_TAGS[t.id] && RD_AP_TAGS[t.id].note ? " — " + RD_AP_TAGS[t.id].note : ""))), tagSel.size > 0 && React.createElement("hr", null), tagSel.size > 0 && React.createElement("option", {
    value: "__clear"
  }, "\u2715 Clear"), React.createElement("option", {
    disabled: true
  }, "Ticking two asks for polls that published both."))), React.createElement("span", {
    className: "rd-grow"
  }), React.createElement("span", {
    className: "rd-ap-count"
  }, React.createElement("b", null, sorted.length), sorted.length !== total ? " of " + (ofT || total) : ofTxt, " ", noun), React.createElement("button", {
    type: "button",
    className: phone ? "rd-link rd-ap-csv" : "rd-chip rd-ap-csv",
    onClick: exportCsv,
    "aria-label": "Download these " + sorted.length + " " + noun + " as a CSV file"
  }, React.createElement("svg", {
    viewBox: "0 0 24 24",
    width: "14",
    height: "14",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true"
  }, React.createElement("path", {
    d: "M12 4v11M7 10l5 5 5-5M5 20h14"
  })), "Download CSV")), shownPills.length > 0 && React.createElement("div", {
    className: "rd-ap-active"
  }, React.createElement("span", {
    className: "rd-ap-activel"
  }, "Showing"), shownPills.map(f => React.createElement("span", {
    key: f.k,
    className: "rd-ap-pill"
  }, f.lab, React.createElement("button", {
    type: "button",
    onClick: f.off,
    "aria-label": "Remove filter: " + f.lab
  }, "\xD7"))), React.createElement("button", {
    type: "button",
    className: "rd-link",
    onClick: clearAll
  }, "Clear all")), React.createElement("div", {
    className: "rd-ap-table",
    role: "table",
    "aria-label": "Every " + RD_AP_POLLS + " " + noun1 + " since the " + rdElecYear + " election, " + (byDate ? "newest first" : "sorted") + (sorted.length !== total ? ", " + sorted.length + " of " + (ofT || total) : ofT ? ", " + sorted.length + ofTxt : ""),
    ref: bodyRef
  }, React.createElement("span", {
    ref: sentRef,
    className: "rd-ap-sent",
    "aria-hidden": "true"
  }), React.createElement("div", {
    ref: headRef,
    className: "rd-ap-headwrap" + (pinned ? " pinned" : "")
  }, pinBar, phone ? phoneHead : colHead), demFamTables ? demFamTables.map(t => React.createElement(React.Fragment, {
    key: "fam" + t.fam.id
  }, famHead(t), famShut.has(t.fam.id) ? null : t.groups.map((g, gi) => React.createElement(React.Fragment, {
    key: t.fam.id + "|" + gi
  }, monthRow(g, t.fam.id), g.list.map(p => rowFor(p, t.fam.id)))))) : byDate ? groups.map((g, gi) => React.createElement(React.Fragment, {
    key: g.ym + "|" + gi
  }, monthRow(g), g.list.map(p => rowFor(p, null)))) : flat.map(p => rowFor(p, null)), sorted.length === 0 && React.createElement("div", {
    className: "rd-ap-empty"
  }, "No ", noun, " match these filters. ", React.createElement("button", {
    type: "button",
    className: "rd-link",
    onClick: clearAll
  }, "Clear filters"))), more && React.createElement("div", {
    className: "rd-ap-more"
  }, byDate ? React.createElement("button", {
    type: "button",
    className: "rd-chip",
    onClick: () => setMinShown(n => n + 30)
  }, "Show earlier months") : React.createElement("button", {
    type: "button",
    className: "rd-chip",
    onClick: () => setFlatLimit(n => n + 40)
  }, "Show ", Math.min(40, sorted.length - nShown), " more"), React.createElement("button", {
    type: "button",
    className: "rd-link",
    onClick: () => setShowAll(true)
  }, "Show all ", sorted.length), React.createElement("span", {
    className: "rd-grow"
  }), React.createElement("span", {
    className: "rd-ap-shown"
  }, nShown, " of ", sorted.length, phone ? "" : " " + noun + " shown")), facet === "twopp" && React.createElement(RdKey, {
    className: "rd-ckey rd-ap-key",
    items: [{
      kind: "dot-solid",
      color: "var(--alp)",
      label: "Leans to Labor"
    }, {
      kind: "dot-solid",
      color: onM ? "var(--onp)" : "var(--lnp)",
      label: "Leans to " + rival
    }]
  }, React.createElement("span", {
    className: "rd-key-item"
  }, React.createElement("span", {
    className: "rd-ap-keywh",
    "aria-hidden": "true"
  }, React.createElement("i", null)), phone ? "95% interval, from its sample" : "95% interval, from the poll’s own sample"), React.createElement("span", {
    className: "rd-key-item"
  }, React.createElement("span", {
    className: "rd-ap-keyavg",
    "aria-hidden": "true"
  }), RD_AP_KAL ? "The trend" : phone ? "Average of the polls around it" : "Average of the other polls fielded around it"), React.createElement("span", {
    className: "rd-key-item"
  }, React.createElement("span", {
    className: "rd-ap-keyhe",
    "aria-hidden": "true"
  }), phone ? "Its pollster’s usual lean" : "Where its pollster usually lands (its house lean)")), facet === "primary" && React.createElement(RdKey, {
    className: "rd-ckey rd-ap-key",
    items: [{
      kind: "dot-solid",
      color: "var(--ink-3)",
      label: "A poll’s figure, in its party’s colour"
    }]
  }, React.createElement("span", {
    className: "rd-key-item"
  }, React.createElement("span", {
    className: "rd-ap-keyring",
    "aria-hidden": "true"
  }), "The month\u2019s ", RD_AP_AVG)), facet === "issues" && React.createElement(RdKey, {
    className: "rd-ckey rd-ap-key",
    items: []
  }, React.createElement("span", {
    className: "rd-key-item"
  }, React.createElement("b", null, "ALP +7"), "\xA0the party rated best on the issue, and its lead over the next, in points"), React.createElement("span", {
    className: "rd-key-item"
  }, React.createElement("i", {
    className: "rd-ap-ibar rd-ap-keybar",
    "aria-hidden": "true"
  }, React.createElement("i", {
    style: {
      width: "34%",
      background: "var(--alp)"
    }
  }), React.createElement("i", {
    style: {
      width: "26%",
      background: "var(--onp)"
    }
  }), React.createElement("i", {
    style: {
      width: "22%",
      background: "var(--lnp)"
    }
  })), "each party\u2019s share rating it best; grey, the rest")), facet === "demographics" && React.createElement(RdKey, {
    className: "rd-ckey rd-ap-key",
    items: [{
      kind: "dot-solid",
      color: "var(--ink-3)",
      label: "A party’s gap between the two groups, in its colour"
    }]
  }, React.createElement("span", {
    className: "rd-key-item"
  }, React.createElement("span", {
    className: "rd-ap-keyavg",
    "aria-hidden": "true"
  }), "Even: the same vote in both groups")), React.createElement(HowTo, {
    label: "How to read this table",
    paras: [React.createElement(React.Fragment, null, "Dates are fieldwork; the day the poll came out sits beneath. The Published/Fieldwork heading sorts the table two ways \u2013 by the day each poll came out (the default) or, on its Fieldwork half, by fieldwork dates, with the month dividers filing by that too. A dash means the pollster didn\u2019t publish that figure. Open any row for the poll in full, with what it does to today\u2019s figure."), facet === "twopp" && React.createElement(React.Fragment, null, pub ? "Each figure is the pollster’s own, as published. The dot is its gap to " + rdApAgainst(true) + ", the tick its pollster’s usual lean, and the whisker the 95% interval its sample alone would give it." : "Each figure reads the poll’s primary votes through the " + rdElecYear + " election’s preference flows, one table for every poll, so the polls compare like for like. The dot is its gap to " + rdApAgainst(false) + ", the tick its pollster’s usual lean, and the whisker the 95% interval its sample alone would give it, worked out from its primaries and those flows.", " ", "A pollster\u2019s polls scatter around its usual lean, not the average, so about one poll in 20 should have its whisker miss its tick by chance."), facet === "issues" && React.createElement(React.Fragment, null, "Each column is an issue. The party named is the one rated best on it by the most voters in that poll, and the figure is its lead over the next party, in points, from the shares as the pollster printed them; \"Level\" means under half a point apart. The bar draws those shares, and the grey is everyone else, unsure or naming no one. Pollsters word the question differently, Resolve doesn\u2019t offer the Greens, and SEC Newgate asks only about cost of living. Open any row for every issue the poll asked about, and where voters ranked them."), facet === "demographics" && React.createElement(React.Fragment, null, "Each figure is a party\u2019s vote in the first group minus its vote in the second, in points, from the groups as the pollster printed them. Pollsters cut voters differently, so each row names the pair it compares: Resolve and DemosAU print 18\u201334 and 55+, RedBridge and YouGov print generations. A gap in points also grows with the party: when a party\u2019s vote doubles, so do its gaps, even if its voters are the same mix of people. One Nation\u2019s have widened that way as its vote has grown. Open any row for the poll\u2019s whole table."), React.createElement(React.Fragment, null, React.createElement("b", null, "Sample"), " is the number of people polled; ", React.createElement("b", null, "eff."), " is the pollster\u2019s own effective sample after weighting, where it publishes one. Where it doesn\u2019t, the interval assumes weighting costs what it does on average.")]
  }), React.createElement("div", {
    className: "rd-foot"
  }, React.createElement("span", {
    className: "rd-foot-text"
  }, facet === "twopp" ? pub ? "Each poll’s own published figure, against " + rdApAgainst(true) + ". A dash marks a figure the pollster didn’t publish." : phone ? "Every poll is read through the " + rdElecYear + " election’s preference flows, so polls compare like for like; the pollster’s own figure sits beneath. Each interval is sampling error alone. A dash marks a figure the pollster didn’t publish." : "Every poll’s primary votes are read through the same preference flows, the " + rdElecYear + " election’s, so the polls compare like for like; the pollster’s own figure sits beneath where it published one. Those flows carry doubt of their own, but the same doubt for every poll, so each interval is sampling error alone. A dash marks a figure the pollster didn’t publish." : "A dash marks a figure the pollster didn’t publish. Open any row for the poll in full."), React.createElement("span", {
    className: "rd-grow"
  }), React.createElement("span", {
    className: "rd-foot-links"
  }, React.createElement("a", {
    className: "rd-how",
    href: "/feedback/"
  }, "Report an error"), React.createElement(RdHow, {
    term: "all-polls",
    from: "All polls"
  }))), sheet && phone && React.createElement(RdApSheet, {
    onClose: () => setSheet(false),
    houses: houses,
    houseRank: houseRank,
    houseN: houseN,
    sel: sel,
    toggleHouse: toggleHouse,
    range: range,
    setRange: setRange,
    shownTags: shownTags,
    tagSel: tagSel,
    toggleTag: toggleTag,
    tagN: tagN,
    count: sorted.length,
    clearAll: clearAll,
    noun1: noun1,
    noun: noun
  }));
}
const RD_AP_TERM0 = (() => {
  const c = (window.AUSPOL.cycles || []).find(x => x.current);
  return c && c.eDate ? c.eDate.slice(0, 7) : "2025-05";
})();
const RD_AP_TERM1 = (() => {
  const [y, m] = RD_AP_TERM0.split("-").map(Number);
  return m === 12 ? y + 1 + "-01" : y + "-" + String(m + 1).padStart(2, "0");
})();
const RD_AP_POLLS = window.JUR ? window.JUR.adj : "national";
const RD_AP_KAL = !!(window.AUSPOL.latest.method && window.AUSPOL.latest.method.kind === "kalman");
const RD_AP_AVG = RD_AP_KAL ? "trend" : "average";
function rdApMonths(from) {
  const D = window.AUSPOL;
  const i = Math.max(0, D.MONTHS.indexOf(from));
  return D.MONTHS.slice(i);
}
function rdApMonthTicks(ms, step) {
  const D = window.AUSPOL;
  const out = [];
  let yr = null;
  ms.forEach((ym, i) => {
    const last = i === ms.length - 1;
    if (i % step !== 0 && !(last && i % step >= step / 2)) return;
    const m = Number(ym.slice(5)),
      y = ym.slice(0, 4);
    out.push({
      ym,
      lab: D.monthName(m) + (y !== yr ? " ’" + y.slice(2) : ""),
      a: i === 0 ? "start" : last ? "end" : "middle"
    });
    yr = y;
  });
  return out;
}
const RD_DIS_PANELS = {
  primary: [{
    id: "p_onp",
    name: "One Nation",
    line: "var(--onp)",
    ink: "var(--onp-text)"
  }, {
    id: "p_lnp",
    name: "Coalition",
    line: "var(--lnp)",
    ink: "var(--lnp-text)"
  }, {
    id: "rd_right",
    name: "One Nation + Coalition",
    line: "var(--ink-2)",
    ink: "var(--ink)"
  }, {
    id: "p_alp",
    name: "Labor",
    line: "var(--alp)",
    ink: "var(--alp-text)"
  }, {
    id: "p_grn",
    name: "Greens",
    line: "var(--grn)",
    ink: "var(--grn-text)"
  }],
  twopp: [{
    id: "rd_on_imp",
    name: "Labor v One Nation",
    line: "var(--onp)",
    ink: "var(--onp-text)"
  }, {
    id: "tpp_alpon",
    name: "…as published",
    line: "var(--onp)",
    ink: "var(--onp-text)",
    dash: true
  }, {
    id: "rd_lnp_imp",
    name: "Labor v Coalition",
    line: "var(--lnp)",
    ink: "var(--lnp-text)"
  }, {
    id: "tpp_alp",
    name: "…as published",
    line: "var(--lnp)",
    ink: "var(--lnp-text)",
    dash: true
  }]
};
const rdDisVerdict = R => R == null ? "Too few polls" : R < 0.8 ? "Tighter than chance" : R < 1.2 ? "Within chance" : R < 1.6 ? "A little beyond chance" : "Well beyond chance";
function RdDisChart({
  panel,
  pts,
  ms,
  yMax,
  first,
  W,
  H,
  phone,
  hover,
  setHover
}) {
  const D = window.AUSPOL;
  const x0 = first ? phone ? 20 : 24 : 4,
    x1 = W - 6,
    top = 10,
    bot = H - 26;
  const X = ym => x0 + ms.indexOf(ym) / (ms.length - 1) * (x1 - x0);
  const Y = v => bot - Math.min(v, yMax) / yMax * (bot - top);
  const have = pts.filter(d => d.sigma != null && ms.includes(d.ym));
  if (!have.length) return React.createElement("svg", {
    width: W,
    height: H
  });
  const floorXY = have.map(d => [X(d.ym), Y(d.floor)]);
  const area = `M${X(have[0].ym)} ${bot} ` + monotoneXY(floorXY, "L") + ` L${X(have[have.length - 1].ym)} ${bot}Z`;
  const e = have[have.length - 1];
  const yt = [];
  for (let v = 1; v <= yMax; v++) yt.push(v);
  const ticks = [{
    ym: ms[0],
    lab: D.monthName(Number(ms[0].slice(5))) + " ’" + ms[0].slice(2, 4),
    a: "start"
  }];
  const jan = ms.find((ym, i) => ym.slice(5) === "01" && i > 2 && i < ms.length - 3);
  if (jan) ticks.push({
    ym: jan,
    lab: "Jan ’" + jan.slice(2, 4),
    a: "middle"
  });
  ticks.push({
    ym: ms[ms.length - 1],
    lab: D.monthName(Number(ms[ms.length - 1].slice(5))),
    a: "end"
  });
  const hv = hover != null ? have.find(d => d.ym === hover) : null;
  const onMove = ev => {
    const r = ev.currentTarget.getBoundingClientRect();
    const x = ev.clientX - r.left;
    let best = null;
    have.forEach(d => {
      const dx = Math.abs(X(d.ym) - x);
      if (!best || dx < best.dx) best = {
        dx,
        ym: d.ym
      };
    });
    setHover(best ? best.ym : null);
  };
  return React.createElement("svg", {
    width: W,
    height: H,
    viewBox: `0 0 ${W} ${H}`,
    role: "img",
    className: "rd-dis-svg",
    "aria-label": `${panel.name}: polls sit a typical ${e.sigma.toFixed(1)} points from their trend, against ${e.floor.toFixed(1)} from sampling error alone.`,
    onMouseMove: onMove,
    onMouseLeave: () => setHover(null)
  }, yt.map(v => React.createElement("path", {
    key: v,
    d: `M${x0} ${Y(v)}H${x1}`,
    className: "rd-dis-gl"
  })), React.createElement("path", {
    d: `M${x0} ${bot}H${x1}`,
    className: "rd-dis-base"
  }), first && yt.concat([0]).map(v => React.createElement("text", {
    key: "t" + v,
    x: x0 - 5,
    y: Y(v) + 4,
    className: "rd-dis-ax",
    textAnchor: "end"
  }, v)), React.createElement("path", {
    d: area,
    className: "rd-dis-floor"
  }), React.createElement("path", {
    d: monotoneXY(floorXY),
    className: "rd-dis-floorline"
  }), React.createElement("path", {
    d: monotoneXY(have.map(d => [X(d.ym), Y(d.sigma)])),
    className: "rd-dis-line",
    style: {
      stroke: panel.line,
      strokeDasharray: panel.dash ? "4 3" : null
    }
  }), React.createElement("circle", {
    cx: X(e.ym),
    cy: Y(e.sigma),
    r: "3.5",
    className: "rd-dis-end",
    style: {
      fill: panel.line
    }
  }), hv && React.createElement(React.Fragment, null, React.createElement("path", {
    d: `M${X(hv.ym)} ${top - 6}V${bot}`,
    className: "rd-dis-guide"
  }), React.createElement("circle", {
    cx: X(hv.ym),
    cy: Y(hv.sigma),
    r: "4",
    className: "rd-dis-end",
    style: {
      fill: panel.line
    }
  }), React.createElement("circle", {
    cx: X(hv.ym),
    cy: Y(hv.floor),
    r: "3",
    className: "rd-dis-fdot"
  })), ticks.map(t => React.createElement("text", {
    key: t.ym,
    x: X(t.ym),
    y: bot + 18,
    className: "rd-dis-ax",
    textAnchor: t.a
  }, t.lab)));
}
function RdDisagree() {
  const AP = window.AP;
  const D = window.AUSPOL;
  const phone = useNarrow("(max-width: 760px)");
  const [view, setView] = useState("primary");
  const [hover, setHover] = useState(null);
  const box = useRef(null);
  const Wall = useRdWidth(box, 1152);
  const disTip = useRef(null);
  const [disTipBox, setDisTipBox] = useState({
    w: 0,
    x: 0,
    vw: 0
  });
  React.useLayoutEffect(() => {
    const el = disTip.current;
    if (!el) return;
    const w = el.offsetWidth,
      x = el.parentElement.getBoundingClientRect().left,
      vw = document.documentElement.clientWidth;
    setDisTipBox(p => Math.abs(p.w - w) > 0.5 || Math.abs(p.x - x) > 0.5 || Math.abs(p.vw - vw) > 0.5 ? {
      w,
      x,
      vw
    } : p);
  }, [hover]);
  const disTipLeft = (hx, pw) => {
    const half = (disTipBox.w || 140) / 2;
    if (2 * half <= pw || !disTipBox.vw) return Math.min(pw - half, Math.max(half, hx));
    const lo = 8 - disTipBox.x + half,
      hi = disTipBox.vw - 8 - disTipBox.x - half;
    return Math.min(Math.max(lo, hi), Math.max(lo, pw / 2));
  };
  const disHover = React.useRef(false);
  React.useEffect(() => {
    const sec = document.getElementById("poll-disagreement");
    if (!sec) return undefined;
    const enter = () => {
      disHover.current = true;
    };
    const leave = () => {
      disHover.current = false;
    };
    disHover.current = sec.matches(":hover");
    sec.addEventListener("pointerenter", enter);
    sec.addEventListener("pointerleave", leave);
    const key = e => {
      if (!disHover.current || e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const a = document.activeElement;
      if (a && a.tagName !== "BODY" && a.tagName !== "HTML") return;
      const sel = window.getSelection && window.getSelection();
      if (sel && !sel.isCollapsed) return;
      const ids = ["primary", "twopp"];
      const i = ids.indexOf(view);
      if (i < 0 || ids.length < 2) return;
      e.preventDefault();
      const nxt = ids[(i + (e.key === "ArrowRight" ? 1 : -1) + ids.length) % ids.length];
      setView(nxt);
      setHover(null);
    };
    document.addEventListener("keydown", key, true);
    return () => {
      sec.removeEventListener("pointerenter", enter);
      sec.removeEventListener("pointerleave", leave);
      document.removeEventListener("keydown", key, true);
    };
  }, [view]);
  const panels = RD_DIS_PANELS[view];
  const ms = rdApMonths(RD_AP_TERM0);
  let yMax = 3;
  panels.forEach(p => AP.discord(p.id).forEach(d => {
    if (d.sigma != null) yMax = Math.max(yMax, Math.ceil(d.sigma), Math.ceil(d.floor));
  }));
  const {
    head,
    dek
  } = AP.disStory();
  const cols = phone ? 2 : 5;
  const gap = phone ? 20 : 24;
  const pw = Math.max(120, Math.floor((Wall - gap * (cols - 1)) / cols));
  const H = phone ? 122 : 150;
  return React.createElement("section", {
    className: "rd-sec rd-dis",
    id: "poll-disagreement",
    "aria-labelledby": "rd-dis-t"
  }, React.createElement("div", {
    className: "rd-eyebrow"
  }, React.createElement("h2", {
    className: "rd-title",
    id: "rd-dis-t"
  }, "How much the polls disagree"), React.createElement("span", {
    className: "rd-meta"
  }, "The spread between polls, against what sampling error alone would produce")), React.createElement(RdHed, {
    head: head,
    dek: dek
  }), React.createElement(RdTabs, {
    swipe: true,
    value: view,
    onChange: v => {
      setView(v);
      setHover(null);
    },
    ariaLabel: "Measure",
    className: "rd-dis-tabs",
    options: [{
      id: "primary",
      label: "Primary vote"
    }, {
      id: "twopp",
      label: "Two-party"
    }]
  }), React.createElement("h4", {
    className: "rd-ap-ct rd-dis-ct"
  }, "How far polls typically sit from ", phone ? "their trend" : "the trend through them", ", points"), React.createElement(RdCrossfade, {
    k: view
  }, React.createElement("div", {
    ref: box,
    className: "rd-dis-grid",
    style: {
      gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
      columnGap: gap
    }
  }, panels.map((pn, i) => {
    const s = AP.discord(pn.id);
    const e = s.filter(d => d.sigma != null).slice(-1)[0];
    const hv = hover && hover.id === pn.id ? s.find(d => d.ym === hover.ym && d.sigma != null) : null;
    const first = phone ? i % 2 === 0 : i === 0;
    const x0 = first ? phone ? 20 : 24 : 4;
    const hx = hv ? x0 + ms.indexOf(hv.ym) / (ms.length - 1) * (pw - 6 - x0) : 0;
    return React.createElement("div", {
      key: pn.id,
      className: "rd-dis-panel"
    }, React.createElement("span", {
      className: "rd-dis-name",
      style: {
        color: pn.ink
      }
    }, pn.name), e ? React.createElement(React.Fragment, null, React.createElement("span", {
      className: "rd-dis-big"
    }, React.createElement("b", null, e.sigma.toFixed(1)), React.createElement("span", null, "pts")), React.createElement("span", {
      className: "rd-dis-sub"
    }, "Chance alone ", e.floor.toFixed(1), ", ", e.R.toFixed(1), "\xD7"), React.createElement("span", {
      className: "rd-dis-verdict"
    }, rdDisVerdict(e.R))) : React.createElement("span", {
      className: "rd-dis-sub"
    }, "Too few polls to measure"), React.createElement("div", {
      className: "rd-dis-chart"
    }, React.createElement(RdDisChart, {
      panel: pn,
      pts: s,
      ms: ms,
      yMax: yMax,
      first: first,
      W: pw,
      H: H,
      phone: phone,
      hover: hv ? hv.ym : null,
      setHover: ym => setHover(ym ? {
        id: pn.id,
        ym
      } : null)
    }), hv && React.createElement("span", {
      ref: disTip,
      className: "tip rd-dis-tip",
      style: {
        left: disTipLeft(hx, pw),
        maxWidth: Math.max(140, (disTipBox.vw || Wall + 16) - 16)
      }
    }, React.createElement("span", {
      className: "tip-title"
    }, rdMonthYear(hv.ym), ", ", pn.name), React.createElement("span", {
      className: "tip-row"
    }, React.createElement("span", {
      className: "tip-label"
    }, "Spread"), React.createElement("span", {
      className: "tip-val"
    }, hv.sigma.toFixed(1), " pts")), React.createElement("span", {
      className: "tip-row"
    }, React.createElement("span", {
      className: "tip-label"
    }, "Chance alone"), React.createElement("span", {
      className: "tip-val"
    }, hv.floor.toFixed(1), " pts")), React.createElement("span", {
      className: "tip-row"
    }, React.createElement("span", {
      className: "tip-label"
    }, "Ratio"), React.createElement("span", {
      className: "tip-val"
    }, hv.R.toFixed(1), "\xD7")))));
  }), phone && React.createElement("div", {
    className: "rd-dis-pkey"
  }, React.createElement("span", {
    className: "rd-key-item"
  }, React.createElement(RdSwatch, {
    kind: "line",
    color: "var(--ink-2)"
  }), "Typical distance of a poll from the trend through the polls"), React.createElement("span", {
    className: "rd-key-item"
  }, React.createElement("span", {
    className: "rd-dis-keyfloor",
    "aria-hidden": "true"
  }), "What sampling error alone would produce")))), !phone && React.createElement(RdKey, {
    className: "rd-ckey rd-dis-key",
    items: [{
      kind: "line",
      color: "var(--ink-2)",
      label: "Typical distance of a poll from the trend through the polls"
    }]
  }, React.createElement("span", {
    className: "rd-key-item"
  }, React.createElement("span", {
    className: "rd-dis-keyfloor",
    "aria-hidden": "true"
  }), "What sampling error alone would produce")), React.createElement("p", {
    className: "rd-dis-scale"
  }, "Within chance: under 1.2 times sampling error, A little beyond: 1.2 to 1.6, Well beyond: 1.6 or more, Under 0.8, tighter than chance, would suggest pollsters were steering towards each other."), React.createElement(RdGlide, {
    watch: view
  }, React.createElement(HowTo, {
    label: "How to read these charts",
    paras: [React.createElement(React.Fragment, null, "Each chart follows one figure month by month. The line is how far a typical poll sits from the trend through all the polls around it; the shaded floor is how far it would sit if the pollsters all measured the same thing and differed only by the luck of who they reached."), React.createElement(React.Fragment, null, "A line on the floor means the polls agree as well as their samples allow; a line well above it means they genuinely differ, in who they reach or how they weight. ", view === "primary" ? "The One Nation and Coalition vote added together gets its own chart because that is the finding: the pollsters split the right’s vote differently while agreeing on its size." : "The implied figures read every poll through the same flows, so their spread is the pollsters disagreeing about primary votes; the published figures add each pollster’s own way of allocating preferences.")]
  })), React.createElement(RdFoot, {
    how: {
      term: "poll-disagreement",
      from: "How much the polls disagree"
    }
  }, "Spread is how far each poll typically sits from the trend through the polls around it, with recent polls counting more; weighting by sample size would mute the small polls whose divergence is being measured. Sampling error is what each poll\u2019s own sample predicts, with a design effect of ", rdApDeff(), view === "twopp" ? ", and for the implied figures from the spread of each respondent’s flow to Labor rather than a simple share" : "", ". Measured across all ", D.individualPolls.length, " polls."));
}
function RdHouseLean({
  measure,
  onMeasure,
  tppBasis
}) {
  const D = window.AUSPOL;
  const phone = useNarrow("(max-width: 760px)");
  const narrowBar = useNarrow("(max-width: 1020px)");
  const pub = tppBasis === "resp";
  const onM = measure !== "lnp";
  const [view, setView] = useState("tpp");
  const [hover, setHover] = useState(null);
  const boxRef = useRef(null);
  const SW = useRdWidth(boxRef, 500);
  const HL_LABELS = {
    alp: "Labor",
    lnp: "Coalition",
    onp: "One Nation",
    grn: "Greens",
    oth: "Others"
  };
  const hlParties = (D => {
    const ord = D && D.latest && D.latest.primaryOrder || [];
    if (!ord.length || ord.some(k => !(k in HL_LABELS))) return ["alp", "lnp", "onp", "grn", "oth"];
    return ord;
  })(D);
  const hlViews = [{
    id: "tpp",
    label: "Two-party"
  }, {
    id: "split",
    label: "One Nation–Coalition split",
    title: "One Nation’s primary vote against the Coalition’s"
  }, ...hlParties.map(k => ({
    id: k,
    label: HL_LABELS[k]
  }))];
  const hlHover = React.useRef(false);
  React.useEffect(() => {
    const sec = document.getElementById("house-lean");
    if (!sec) return undefined;
    const enter = () => {
      hlHover.current = true;
    };
    const leave = () => {
      hlHover.current = false;
    };
    hlHover.current = sec.matches(":hover");
    sec.addEventListener("pointerenter", enter);
    sec.addEventListener("pointerleave", leave);
    const key = e => {
      if (!hlHover.current || e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const a = document.activeElement;
      if (a && a.tagName !== "BODY" && a.tagName !== "HTML") return;
      const sel = window.getSelection && window.getSelection();
      if (sel && !sel.isCollapsed) return;
      const ids = hlViews.map(t => t.id);
      const i = ids.indexOf(view);
      if (i < 0 || ids.length < 2) return;
      e.preventDefault();
      const nxt = ids[(i + (e.key === "ArrowRight" ? 1 : -1) + ids.length) % ids.length];
      setView(nxt);
      setHover(null);
    };
    document.addEventListener("keydown", key, true);
    return () => {
      sec.removeEventListener("pointerenter", enter);
      sec.removeEventListener("pointerleave", leave);
      document.removeEventListener("keydown", key, true);
    };
  }, [view]);
  React.useEffect(() => {
    const sec = document.getElementById("house-lean");
    const btn = sec && sec.querySelector('.rd-hl-tabs [aria-pressed="true"]');
    const sc = btn && btn.closest('[role="group"]');
    if (!sc) return;
    const r = btn.getBoundingClientRect(),
      s = sc.getBoundingClientRect();
    if (r.left < s.left) sc.scrollTo({
      left: sc.scrollLeft + r.left - s.left - 28,
      behavior: SM
    });else if (r.right > s.right) sc.scrollTo({
      left: sc.scrollLeft + r.right - s.right + 28,
      behavior: SM
    });
  }, [view]);
  const HE = D.houseEffects || {};
  const key = window.AP.leanKey(view, onM, pub);
  const heKey = {
    onimp: "synthOn",
    imp: "synth",
    onpub: "alp_on",
    tpp: "tpp"
  }[key];
  const valOf = {
    onimp: p => p.alpOnImp,
    imp: p => p.alpImp,
    onpub: p => p.tppAlt ? p.tppAlt.alp : null,
    tpp: p => p.alpN,
    alp: p => p.p && p.p.alp,
    lnp: p => p.p && p.p.lnp,
    onp: p => p.p && p.p.onp,
    grn: p => p.p && p.p.grn,
    oth: p => p.p && p.p.oth,
    split: p => p.p && p.p.onp != null && p.p.lnp != null ? p.p.onp - p.p.lnp : null
  }[key];
  const nOf = h => {
    const he = heKey && HE[heKey] && HE[heKey][h];
    if (he && he.n) return he.n;
    return D.individualPolls.filter(p => p.pollster === h && valOf(p) != null).length;
  };
  const rows = window.AP.leanRows(key).map(r => ({
    ...r,
    n: nOf(r.h)
  })).sort((a, b) => b.v - a.v || b.n - a.n);
  const {
    head,
    dek
  } = window.AP.leanStory(view, onM, pub);
  const maxAbs = Math.max(0, ...rows.map(r => Math.abs(r.v)));
  const BM = maxAbs <= 1.1 ? 1.2 : Math.ceil((maxAbs + 0.1) * 2) / 2;
  const bStep = BM <= 1.5 ? 0.5 : BM <= 3 ? 1 : 2;
  const bTicks = [];
  for (let v = bStep; v < BM - 1e-9; v += bStep) bTicks.push(+v.toFixed(2));
  const bx = v => (Math.max(-BM, Math.min(BM, v)) + BM) / (2 * BM) * 100;
  let SMAX = 1;
  rows.forEach(r => r.s.forEach(d => {
    SMAX = Math.max(SMAX, Math.ceil(Math.abs(d.v) - 0.05));
  }));
  const ms = rdApMonths(RD_AP_TERM1);
  const hlFits = rows.map(r => {
    const pts = r.s.filter(d => ms.includes(d.ym));
    return {
      r,
      pts,
      fit: withinHouseSlope(pts.map(d => ({
        h: r.h,
        t: D.mx(d.ym),
        w: 1,
        y: d.v
      })))
    };
  });
  const hlTested = hlFits.filter(f => f.fit);
  const hlSig = [];
  for (const [i, f] of [...hlTested].sort((a, b) => a.fit.p - b.fit.p).entries()) {
    if (f.fit.p >= 0.05 / (hlTested.length - i)) break;
    hlSig.push(f);
  }
  const hlTsig = {
    key,
    rows: hlFits.map(f => ({
      key: f.r.h,
      name: f.r.h,
      sig: hlSig.includes(f),
      cells: [f.pts.length ? rdTsSgn(f.pts[0].v) + " → " + rdTsSgn(f.pts[f.pts.length - 1].v) : "–", f.fit ? rdTsSgn(f.fit.b, true) : "–", f.fit ? rdTsSgn(f.fit.t) : "–", f.fit ? hlSig.includes(f) ? "Yes" : "No" : "–"]
    }))
  };
  const split = view === "split";
  const two = view === "tpp" || split;
  const partyName = {
    alp: "Labor",
    lnp: "the Coalition",
    onp: "One Nation",
    grn: "the Greens",
    oth: "the others"
  }[view];
  const [posP, negP] = split ? ["onp", "lnp"] : ["alp", onM ? "onp" : "lnp"];
  const posName = split ? "One Nation" : "Labor",
    negName = split || !onM ? "the Coalition" : "One Nation";
  const pos = two ? `var(--${posP})` : "var(--" + view + ")";
  const neg = two ? `var(--${negP})` : "var(--" + view + ")";
  const posInk = two ? `var(--${posP}-text)` : "var(--" + view + "-text)";
  const negInk = two ? `var(--${negP}-text)` : "var(--" + view + "-text)";
  const lText = two ? (phone ? "◀ " : "◀ To ") + (phone ? negName.replace("the ", "") : negName) : "◀ Lower";
  const rText = two ? (phone ? "" : "To ") + posName + " ▶" : "Higher ▶";
  const SH = phone ? 26 : 44;
  const sx = ym => 6 + ms.indexOf(ym) / (ms.length - 1) * (SW - 14);
  const sy = v => SH / 2 - Math.max(-SMAX, Math.min(SMAX, v)) / SMAX * (SH / 2 - 3);
  const tStep = Math.max(4, Math.ceil(56 * (ms.length - 1) / Math.max(1, SW - 14)));
  const spark = r => {
    const pts = r.s.filter(d => ms.includes(d.ym));
    if (!pts.length) return null;
    const line = monotoneXY(pts.map(d => [sx(d.ym), sy(d.v)]), "");
    const e = pts[pts.length - 1];
    const hv = hover && hover.h === r.h ? pts.find(d => d.ym === hover.ym) : null;
    const onMove = ev => {
      const rc = ev.currentTarget.getBoundingClientRect();
      const x = ev.clientX - rc.left;
      let best = null;
      pts.forEach(d => {
        const dx = Math.abs(sx(d.ym) - x);
        if (!best || dx < best.dx) best = {
          dx,
          ym: d.ym
        };
      });
      setHover(best ? {
        h: r.h,
        ym: best.ym
      } : null);
    };
    const nThat = hv ? D.individualPolls.filter(p => p.pollster === r.h && p.ym === hv.ym && valOf(p) != null).length : 0;
    return React.createElement("span", {
      className: "rd-hl-spark"
    }, React.createElement("svg", {
      width: SW,
      height: SH,
      viewBox: `0 0 ${SW} ${SH}`,
      role: "img",
      onMouseMove: onMove,
      onMouseLeave: () => setHover(null),
      "aria-label": `Lean month by month since ${rdMonthYear(pts[0].ym)}, from ${rdApSigned(pts[0].v)} to ${rdApSigned(e.v)}`
    }, React.createElement("path", {
      d: `M6 ${SH / 2}H${SW - 8}`,
      className: "rd-hl-zero"
    }), React.createElement("path", {
      d: `M${sx(pts[0].ym).toFixed(1)} ${SH / 2}L${line}L${sx(e.ym).toFixed(1)} ${SH / 2}Z`,
      className: "rd-hl-area"
    }), React.createElement("path", {
      d: "M" + line,
      className: "rd-hl-line"
    }), React.createElement("circle", {
      cx: sx(e.ym),
      cy: sy(e.v),
      r: "3.5",
      className: "rd-hl-end",
      style: {
        fill: Math.abs(e.v) < 0.05 ? "var(--ink-3)" : e.v > 0 ? pos : neg
      }
    }), hv && React.createElement(React.Fragment, null, React.createElement("path", {
      d: `M${sx(hv.ym)} 0V${SH}`,
      className: "rd-dis-guide"
    }), React.createElement("circle", {
      cx: sx(hv.ym),
      cy: sy(hv.v),
      r: "4",
      className: "rd-hl-hv"
    }))), hv && React.createElement("span", {
      className: "tip rd-hl-tip",
      style: {
        left: Math.min(SW - 100, Math.max(100, sx(hv.ym)))
      }
    }, React.createElement("span", {
      className: "tip-title"
    }, r.h, ", ", rdMonthYear(hv.ym)), React.createElement("span", {
      className: "tip-row"
    }, React.createElement("span", {
      className: "tip-label"
    }, "Lean"), React.createElement("span", {
      className: "tip-val"
    }, Math.abs(hv.v) < 0.05 ? "level" : rdSigned(hv.v, 1) + (two ? " to " + (hv.v > 0 ? posName : negName).replace("the ", "") : ""))), split && React.createElement("span", {
      className: "tip-row"
    }, React.createElement("span", {
      className: "tip-label"
    }, "On One Nation"), React.createElement("span", {
      className: "tip-val"
    }, rdApSigned(hv.on))), split && React.createElement("span", {
      className: "tip-row"
    }, React.createElement("span", {
      className: "tip-label"
    }, "On the Coalition"), React.createElement("span", {
      className: "tip-val"
    }, rdApSigned(hv.co))), React.createElement("span", {
      className: "tip-row"
    }, React.createElement("span", {
      className: "tip-label"
    }, "Its polls that month"), React.createElement("span", {
      className: "tip-val"
    }, nThat))));
  };
  const edge = bTicks.length ? bTicks[bTicks.length - 1] : null;
  const barHead = React.createElement("span", {
    className: "rd-hl-bhead",
    "aria-hidden": "true"
  }, React.createElement("span", {
    className: "rd-ap-in"
  }, React.createElement("b", {
    className: "rd-ap-scl",
    style: {
      color: negInk
    }
  }, lText), React.createElement("b", {
    className: "rd-ap-scr",
    style: {
      color: posInk
    }
  }, rText), (narrowBar ? [-edge, 0, edge].filter(v => v != null && !Number.isNaN(v)) : bTicks.map(v => -v).concat([0]).concat(bTicks)).map(v => React.createElement("span", {
    key: v,
    className: "rd-ap-tk" + (v === 0 ? " mid" : ""),
    style: {
      left: bx(v) + "%"
    }
  }, v === 0 ? phone ? "Others" : "The others" : Math.abs(v) === edge ? Math.abs(v) + " pt" + (Math.abs(v) === 1 ? "" : "s") : String(Math.abs(v))))));
  const bar = v => React.createElement("span", {
    className: "rd-hl-bar",
    role: "img",
    "aria-label": Math.abs(v) < 0.05 ? "Level with the other pollsters" : Math.abs(v).toFixed(1) + " points " + (two ? "towards " + (v > 0 ? posName : negName) : v > 0 ? "higher than the others" : "lower than the others")
  }, React.createElement("span", {
    className: "rd-ap-in"
  }, bTicks.concat(bTicks.map(x => -x)).map(x => React.createElement("i", {
    key: x,
    className: "rd-ap-gl",
    style: {
      left: bx(x) + "%"
    }
  })), Math.abs(v) >= 0.05 && React.createElement("i", {
    className: "rd-hl-fill",
    style: {
      left: Math.min(bx(0), bx(v)) + "%",
      width: Math.abs(bx(v) - bx(0)) + "%",
      background: v > 0 ? pos : neg
    }
  }), React.createElement("i", {
    className: "rd-ap-avg",
    style: {
      left: "50%"
    }
  })));
  const title = split ? "Each pollster’s lean on One Nation’s primary vote against the Coalition’s, points" : two ? `Each pollster’s lean on Labor v ${onM ? "One Nation" : "Coalition"}${pub ? " as published" : ""}, points` : `Each pollster’s lean on ${partyName}${partyName.endsWith("s") ? "’" : "’s"} primary vote, points`;
  const sizeMax = split ? Math.max(0, ...rows.map(r => {
    const e = r.s[r.s.length - 1];
    return Math.abs(e.on + e.co);
  })) : 0;
  const flipPick = () => {
    const sec = document.getElementById("house-lean");
    if (sec) rdPinScroll([sec.querySelector(".rd-hl-tabs"), sec.querySelector(".rd-ap-pctl")].filter(Boolean));
    onMeasure(onM ? "lnp" : "onp");
  };
  const spaceFlip = React.useRef(null);
  spaceFlip.current = view === "tpp" ? flipPick : null;
  React.useEffect(() => {
    const sec = document.getElementById("house-lean");
    if (!sec) return undefined;
    const inView = {
      current: false
    };
    const io = new IntersectionObserver(es => es.forEach(en => {
      inView.current = en.isIntersecting;
    }));
    io.observe(sec);
    const key = e => {
      if (!inView.current || e.key !== " ") return;
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      const a = document.activeElement;
      const onMeasureTab = a && a.tagName === "BUTTON" && a.getAttribute("aria-pressed") === "true" && a.matches('#house-lean .rd-hl-tabs .rd-tab');
      if (!onMeasureTab && a && a.tagName !== "BODY" && a.tagName !== "HTML") return;
      const sel = window.getSelection && window.getSelection();
      if (sel && !sel.isCollapsed) return;
      if (!spaceFlip.current) return;
      e.preventDefault();
      if (!e.repeat) spaceFlip.current();
    };
    document.addEventListener("keydown", key, true);
    return () => {
      io.disconnect();
      document.removeEventListener("keydown", key, true);
    };
  }, []);
  const flip = React.createElement("button", {
    type: "button",
    className: "rd-pl-flip",
    title: "Switch the page to Labor v " + (onM ? "Coalition" : "One Nation"),
    onClick: flipPick
  }, React.createElement("span", {
    className: "rd-pl-flip-t"
  }, "Labor v ", onM ? "One Nation" : "Coalition"), " ", React.createElement("span", {
    "aria-hidden": "true"
  }, "\u21C4"));
  return React.createElement("section", {
    className: "rd-sec rd-hl",
    id: "house-lean",
    "aria-labelledby": "rd-hl-t"
  }, React.createElement("div", {
    className: "rd-eyebrow"
  }, React.createElement("h2", {
    className: "rd-title",
    id: "rd-hl-t"
  }, "How each pollster leans"), React.createElement("span", {
    className: "rd-meta"
  }, "Each pollster\u2019s usual gap to the others polling at the same time", phone ? "" : ", which the averages take out")), head && React.createElement(RdHed, {
    head: head,
    dek: dek
  }), React.createElement(RdTabs, {
    swipe: true,
    value: view,
    onChange: v => {
      setView(v);
      setHover(null);
    },
    ariaLabel: "Measure",
    className: "rd-hl-tabs",
    options: hlViews
  }, view === "tpp" && !narrowBar && React.createElement("span", {
    className: "rd-pl-ctl"
  }, React.createElement("span", {
    className: "rd-pl-ctl-l"
  }, "Two-party:"), flip)), view === "tpp" && narrowBar && React.createElement("div", {
    className: "rd-ap-pctl"
  }, flip), React.createElement("h4", {
    className: "rd-ap-ct rd-hl-ct"
  }, phone ? title.replace(", points", ", points; the line beneath each is its lean month by month since the election") : title), React.createElement("div", {
    className: "rd-hl-table",
    role: "table",
    "aria-label": "Each pollster\u2019s lean against the others, now and month by month since the election"
  }, React.createElement("div", {
    className: "rd-hl-hrow",
    role: "row"
  }, React.createElement("span", {
    className: "rd-ap-th",
    role: "columnheader"
  }, "Pollster"), React.createElement("span", {
    role: "columnheader",
    className: "rd-hl-hbar"
  }, barHead), React.createElement("span", {
    className: "rd-ap-th r",
    role: "columnheader"
  }, "Now"), !phone && React.createElement("span", null), !phone && React.createElement("span", {
    className: "rd-hl-shead",
    role: "columnheader",
    ref: boxRef
  }, React.createElement("span", {
    className: "rd-ap-cap"
  }, "Since the election", React.createElement("em", null, React.createElement("span", {
    className: "rd-hl-sep"
  }, ", "), "each row\u2019s height is ", SMAX === 1 ? "a point" : SMAX + " points", " either way")), rdApMonthTicks(ms, tStep).map(t => React.createElement("span", {
    key: t.ym,
    className: "rd-ap-tk " + t.a,
    style: {
      left: sx(t.ym)
    }
  }, t.lab)))), phone && React.createElement("span", {
    ref: boxRef,
    className: "rd-hl-measure",
    "aria-hidden": "true"
  }), rows.map(r => React.createElement("div", {
    key: r.h,
    className: "rd-hl-row",
    role: "row"
  }, React.createElement("span", {
    role: "rowheader",
    className: "rd-hl-who"
  }, React.createElement("b", null, r.h), React.createElement("span", {
    className: "rd-ap-sub"
  }, r.n, " poll", r.n === 1 ? "" : "s")), React.createElement("span", {
    role: "cell",
    className: "rd-hl-bc"
  }, bar(r.v)), React.createElement("span", {
    role: "cell",
    className: "rd-hl-now",
    style: {
      color: Math.abs(r.v) < 0.05 ? "var(--ink-3)" : r.v > 0 ? posInk : negInk
    }
  }, rdApSigned(r.v)), !phone && React.createElement("span", null), React.createElement("span", {
    role: "cell",
    className: "rd-hl-sc"
  }, spark(r))))), React.createElement(RdTsig, {
    summary: "Trend-significance table",
    heads: ["Pollster", "Lean, first → last", "Slope, pts/yr", "t", "Significant"],
    sets: [hlTsig],
    note: "Each row’s slope is a straight line through that pollster’s own monthly leans since the election, as the sparklines above draw them, t-tested against zero; Holm’s correction is applied across the " + (hlTested.length === 1 ? "pollster" : hlTested.length + " pollsters") + " on show, so Yes means a lean is drifting, not just sitting off-centre."
  }), React.createElement(RdFoot, {
    how: {
      term: "house-lean",
      from: "How each pollster leans"
    }
  }, "A pollster\u2019s lean is its average gap to the other pollsters polling within four weeks of it", view === "tpp" && !pub ? ", all read through the same preference flows" : "", ", with recent polls counting most. One with few polls is pulled towards zero until its record builds.", view === "tpp" && !pub ? " Because every poll uses the same flows, a lean comes from a pollster’s primary votes, not from how it allocates preferences." : "", split ? ` Here it is the pollster’s lean on One Nation’s vote less its lean on the Coalition’s${sizeMax < maxAbs / 2 ? `; added together, the two mostly cancel, and no pollster reads the parties’ combined vote more than ${sizeMax.toFixed(1)} points off the others` : ""}.` : null));
}
function RdFlowChart({
  fd,
  rival,
  W,
  phone,
  pick,
  emptyNote
}) {
  const D = window.AUSPOL;
  const [hv, setHv] = useState(null);
  const [tip, setTip] = useState(null);
  const ptr = React.useRef(null);
  const chartBox = React.useRef(null);
  const tipBox = React.useRef(null);
  window.useDismissOutside(chartBox, !!(tip && tip.src === "touch"), () => {
    setTip(null);
    setHv(null);
  });
  const FLOW_TIP_HALF = {
    m: 90,
    w: 125,
    v: 155
  };
  const [tipWs, setTipWs] = useState({
    m: 0,
    w: 0,
    v: 0
  });
  const tipLeft = (kind, px) => {
    const half = (tipWs[kind] || 0) / 2 || FLOW_TIP_HALF[kind];
    const h = Math.min(half, W / 2 - 8);
    return Math.min(W - 8 - h, Math.max(8 + h, px));
  };
  React.useLayoutEffect(() => {
    const el = tipBox.current,
      box = chartBox.current;
    if (!el || !box) return;
    const kind = tip ? tip.hd ? "v" : "w" : "m";
    const w = el.offsetWidth;
    setTipWs(p => Math.abs((p[kind] || 0) - w) > 0.5 ? {
      ...p,
      [kind]: w
    } : p);
    el.style.top = "";
    const b = box.getBoundingClientRect();
    const minTop = 78 - b.top + el.offsetHeight;
    if (minTop > -6) el.style.top = Math.round(minTop) + "px";
  }, [tip, hv]);
  const H = phone ? 210 : 250;
  const x0 = phone ? 26 : 40,
    rpad = phone ? 66 : 76,
    top = 14,
    bot = phone ? 178 : 214;
  const x1 = W - rpad;
  const ms = rdApMonths(RD_AP_TERM1);
  const mw = (x1 - x0) / ms.length;
  const Xs = ym => x0 + ms.indexOf(ym) * mw;
  const X = ym => Xs(ym) + mw / 2;
  const Xw = iso => {
    const i = ms.indexOf(iso.slice(0, 7));
    if (i < 0) return null;
    const dim = new Date(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)), 0)).getUTCDate();
    return x0 + (i + (Number(iso.slice(8, 10)) - 1) / dim) * mw;
  };
  const zero = (top + bot) / 2;
  const Y = v => zero - v / 3.5 * (zero - top);
  const mo = (fd.months || []).filter(d => ms.includes(d.ym));
  if (!mo.length) return null;
  const band = monotoneXY(mo.map(d => [X(d.ym), Y(Math.min(3.5, d.v + d.ci95))])) + " " + monotoneXY(mo.slice().reverse().map(d => [X(d.ym), Y(Math.max(-3.5, d.v - d.ci95))]), "L") + " Z";
  const e = mo[mo.length - 1];
  const nw = fd.now || e;
  const nx = x1 + 22;
  const ticks = phone ? window.JUR ? rdApMonthTicks(ms, 12).map(t => [t.ym, t.lab]) : [["2025-06", "Jun ’25"], ["2026-01", "Jan ’26"], [ms[ms.length - 1], D.monthName(Number(ms[ms.length - 1].slice(5)))]] : rdApMonthTicks(ms, ms.length > 30 ? 6 : 3).map(t => [t.ym, t.lab]);
  const houses = fd.houses || {};
  const pickS = pick && houses[pick] ? houses[pick].filter(d => ms.includes(d.ym)) : null;
  const onMove = ev => {
    if (tip) return;
    const r = ev.currentTarget.getBoundingClientRect();
    const x = ev.clientX - r.left;
    if (x > x1 + 8) {
      setHv(null);
      return;
    }
    let best = null;
    mo.forEach(d => {
      const dx = Math.abs(X(d.ym) - x);
      if (!best || dx < best.dx) best = {
        dx,
        d
      };
    });
    setHv(best ? best.d : null);
  };
  const s1 = v => Math.abs(v) < 0.05 ? "0.0" : rdSigned(v, 1);
  return React.createElement("div", {
    className: "rd-fl-chart",
    ref: chartBox
  }, React.createElement("svg", {
    width: W,
    height: H + 12,
    viewBox: `0 0 ${W} ${H + 12}`,
    role: "img",
    onPointerMove: ev => {
      if (ev.pointerType === "mouse") onMove(ev);
    },
    onMouseLeave: () => setHv(null),
    onPointerDown: ev => {
      ptr.current = ev.pointerType;
    },
    onClick: () => {
      const p = ptr.current;
      ptr.current = null;
      if (p === "touch") setTip(null);
    },
    "aria-label": `Published minus implied two-party figure against ${rival}, pooled across pollsters by month: now ${s1(nw.v)} points, 95% interval ±${nw.ci95.toFixed(1)}.`
  }, [-3, -2, -1, 1, 2, 3].map(v => React.createElement("path", {
    key: v,
    d: `M${x0} ${Y(v)}H${x1}`,
    className: "rd-dis-gl"
  })), React.createElement("path", {
    d: `M${x0} ${zero}H${x1}`,
    className: "rd-fl-zero"
  }), [-3, -2, -1, 0, 1, 2, 3].map(v => React.createElement("text", {
    key: "t" + v,
    x: x0 - 8,
    y: Y(v) + 4,
    className: "rd-dis-ax",
    textAnchor: "end"
  }, v === 0 ? "0" : rdSigned(v, 0))), React.createElement("path", {
    d: band,
    className: "rd-fl-band"
  }), (() => {
    const wave = (d, i) => {
      const px = Xw(d.released);
      if (px == null) return null;
      const py = Y(Math.max(-3.4, Math.min(3.4, d.v)));
      const k = window.AP && window.AP.pollRowKey ? window.AP.pollRowKey({
        pollster: d.pollster,
        released: d.released
      }) : null;
      const id = d.pollster + "|" + d.released + "#" + i;
      const show = src => setTip({
        id,
        src,
        d,
        px
      });
      const hide = src => setTip(tp => tp && tp.id === id && (!src || tp.src === src) ? null : tp);
      const open = () => {
        if (k && window.AP.openPoll) {
          setTip(null);
          window.AP.openPoll(k, "twopp", "the preference-flow chart");
        }
      };
      return React.createElement("g", {
        key: id
      }, tip && tip.id === id && React.createElement("circle", {
        cx: px,
        cy: py,
        r: "6",
        className: "rd-apd-dothi"
      }), React.createElement("circle", {
        cx: px,
        cy: py,
        r: pickS && d.pollster === pick ? 3 : 2.2,
        className: "rd-fl-wdot" + (pickS ? d.pollster === pick ? " on" : " off" : "")
      }), React.createElement("circle", {
        cx: px,
        cy: py,
        r: "8",
        className: "rd-apd-hit" + (k ? " link" : ""),
        tabIndex: "0",
        role: k ? "button" : "img",
        "aria-label": `${d.pollster}, fieldwork ${d.dateLabel}: published minus implied ${s1(d.v)} points${d.fl != null ? `, respondent-allocated flow to Labor ${d.fl.toFixed(1)} percent` : ""}` + (k ? "; press Enter to open this poll" : ""),
        onPointerDown: ev => {
          ptr.current = ev.pointerType;
        },
        onPointerEnter: ev => {
          if (ev.pointerType === "mouse") {
            setHv(null);
            show("mouse");
          }
        },
        onPointerLeave: ev => {
          if (ev.pointerType === "mouse") hide("mouse");
        },
        onFocus: ev => {
          if (ev.target.matches(":focus-visible")) show("focus");
        },
        onBlur: () => hide("focus"),
        onClick: ev => {
          ev.stopPropagation();
          const pt = ev.detail === 0 ? "key" : ptr.current;
          ptr.current = null;
          if (pt === "mouse" || pt === "key") {
            open();
            return;
          }
          if (tip && tip.id === id) setTip(null);else show("touch");
        },
        onKeyDown: ev => {
          if (ev.key !== "Enter" && ev.key !== " " && ev.key !== "Spacebar") return;
          ev.preventDefault();
          open();
        }
      }));
    };
    const vtx = pickS ? houses[pick].filter(d => ms.includes(d.ym)).map((d, i) => {
      const vid = "vtx|" + pick + "|" + d.ym;
      const vx = X(d.ym),
        vy = Y(Math.max(-3.4, Math.min(3.4, d.v)));
      const showV = src => setTip({
        id: vid,
        src,
        hd: {
          h: pick,
          ym: d.ym,
          v: d.v,
          fl: d.fl ?? null
        },
        px: vx
      });
      const hideV = src => setTip(tp => tp && tp.id === vid && (!src || tp.src === src) ? null : tp);
      return React.createElement("g", {
        key: pick + i
      }, tip && tip.id === vid && React.createElement("circle", {
        cx: vx,
        cy: vy,
        r: "6",
        className: "rd-apd-dothi"
      }), React.createElement("circle", {
        cx: vx,
        cy: vy,
        r: "8",
        className: "rd-apd-hit rd-fl-vhit",
        tabIndex: "0",
        role: "img",
        "aria-label": `${pick}, ${rdMonthYear(d.ym)}: this pollster’s gap that month, published minus implied ${s1(d.v)} points${d.fl != null ? `, respondent-allocated flow to Labor ${d.fl.toFixed(1)} percent` : ""}`,
        onPointerDown: ev => {
          ptr.current = ev.pointerType;
        },
        onPointerEnter: ev => {
          if (ev.pointerType === "mouse") {
            setHv(null);
            showV("mouse");
          }
        },
        onPointerLeave: ev => {
          if (ev.pointerType === "mouse") hideV("mouse");
        },
        onFocus: ev => {
          if (ev.target.matches(":focus-visible")) showV("focus");
        },
        onBlur: () => hideV("focus"),
        onClick: ev => {
          ev.stopPropagation();
          const pt = ev.detail === 0 ? "key" : ptr.current;
          ptr.current = null;
          if (pt === "mouse" || pt === "key") return;
          if (tip && tip.id === vid) setTip(null);else showV("touch");
        }
      }));
    }) : null;
    const ws = fd.polls || [];
    return React.createElement(React.Fragment, null, ws.map((d, i) => pickS && d.pollster === pick ? null : wave(d, i)), vtx, pickS && ws.map((d, i) => d.pollster === pick ? wave(d, i) : null));
  })(), pickS && pickS.length > 1 && React.createElement("path", {
    d: monotoneXY(pickS.map(d => [X(d.ym), Y(Math.max(-3.4, Math.min(3.4, d.v)))])),
    className: "rd-fl-pick"
  }), React.createElement("path", {
    d: monotoneXY(mo.map(d => [X(d.ym), Y(Math.max(-3.4, Math.min(3.4, d.v)))])),
    className: "rd-fl-line"
  }), React.createElement("circle", {
    cx: X(e.ym),
    cy: Y(Math.max(-3.4, Math.min(3.4, e.v))),
    r: "3",
    className: "rd-fl-enddot"
  }), React.createElement("path", {
    d: `M${nx} ${Y(Math.min(3.5, nw.v + nw.ci95))}V${Y(Math.max(-3.5, nw.v - nw.ci95))}`,
    className: "rd-fl-nowwh"
  }), React.createElement("circle", {
    cx: nx,
    cy: Y(nw.v),
    r: "5",
    className: "rd-fl-now"
  }), React.createElement("text", {
    x: nx,
    y: top - 2,
    className: "rd-fl-nowh",
    textAnchor: "middle"
  }, "Now"), React.createElement("text", {
    x: nx + 10,
    y: Y(nw.v) + 5,
    className: "rd-fl-nowv"
  }, s1(nw.v)), React.createElement("text", {
    x: nx + 10,
    y: Y(nw.v) + 20,
    className: "rd-fl-nowci"
  }, "\xB1", nw.ci95.toFixed(1)), React.createElement("text", {
    x: x0 + 6,
    y: Y(3.5) + 13,
    className: "rd-fl-note"
  }, "\u25B2 Published kinder to Labor"), React.createElement("text", {
    x: x0 + 6,
    y: Y(-3.5) - 6,
    className: "rd-fl-note"
  }, "\u25BC Kinder to ", rival), (() => {
    const t = emptyNote && emptyNote.find(n => textWidth(n, 12, 400) <= X(mo[0].ym) - x0 - 14);
    return t ? React.createElement("text", {
      x: (x0 + X(mo[0].ym)) / 2,
      y: Y(1.4),
      className: "rd-fl-empty",
      textAnchor: "middle"
    }, t) : null;
  })(), React.createElement("path", {
    d: `M${x0} ${bot}H${x1}` + ticks.map(([ym]) => `M${Xs(ym)} ${bot}v4`).join(""),
    className: "rd-dis-base"
  }), ticks.map(([ym, lab]) => React.createElement("text", {
    key: ym,
    x: Xs(ym),
    y: bot + 20,
    className: "rd-dis-ax",
    textAnchor: "middle"
  }, lab)), hv && !tip && React.createElement("path", {
    d: `M${X(hv.ym)} ${top}V${bot}`,
    className: "rd-dis-guide"
  }), hv && !tip && React.createElement("circle", {
    cx: X(hv.ym),
    cy: Y(Math.max(-3.4, Math.min(3.4, hv.v))),
    r: "4",
    className: "rd-fl-enddot"
  })), hv && !tip && React.createElement("span", {
    ref: tipBox,
    className: "tip rd-fl-tip",
    style: {
      left: tipLeft("m", X(hv.ym)),
      maxWidth: W - 16
    }
  }, React.createElement("span", {
    className: "tip-title"
  }, rdMonthYear(hv.ym)), React.createElement("span", {
    className: "tip-row"
  }, React.createElement("span", {
    className: "tip-label"
  }, "All pollsters"), React.createElement("span", {
    className: "tip-val"
  }, s1(hv.v))), React.createElement("span", {
    className: "tip-row"
  }, React.createElement("span", {
    className: "tip-label"
  }, "95% interval"), React.createElement("span", {
    className: "tip-val"
  }, "\xB1", hv.ci95.toFixed(1))), hv.k != null && React.createElement("span", {
    className: "tip-row"
  }, React.createElement("span", {
    className: "tip-label"
  }, "Polls"), React.createElement("span", {
    className: "tip-val"
  }, hv.k))), tip && (() => {
    const {
      d,
      px,
      hd
    } = tip;
    if (hd) return React.createElement("span", {
      ref: tipBox,
      className: "tip rd-fl-tip",
      style: {
        left: tipLeft("v", px),
        maxWidth: W - 16
      }
    }, React.createElement("span", {
      className: "tip-title"
    }, hd.h), React.createElement("span", {
      className: "tip-row"
    }, React.createElement("span", {
      className: "tip-label"
    }, "Month"), React.createElement("span", {
      className: "tip-val"
    }, rdMonthYear(hd.ym))), React.createElement("span", {
      className: "tip-row"
    }, React.createElement("span", {
      className: "tip-label"
    }, "House drift"), React.createElement("span", {
      className: "tip-val"
    }, s1(hd.v))), hd.fl != null && React.createElement("span", {
      className: "tip-row"
    }, React.createElement("span", {
      className: "tip-label"
    }, "Respondent flow to Labor"), React.createElement("span", {
      className: "tip-val"
    }, hd.fl.toFixed(1), "%")), React.createElement("span", {
      className: "tip-sub tip-hint"
    }, "this pollster\u2019s gap that month \u2013 not a published wave"));
    const k = window.AP && window.AP.pollRowKey ? window.AP.pollRowKey({
      pollster: d.pollster,
      released: d.released
    }) : null;
    return React.createElement("span", {
      ref: tipBox,
      className: "tip rd-fl-tip",
      style: {
        left: tipLeft("w", px),
        maxWidth: W - 16
      }
    }, React.createElement("span", {
      className: "tip-title"
    }, d.pollster), React.createElement("span", {
      className: "tip-row"
    }, React.createElement("span", {
      className: "tip-label"
    }, "Published minus implied"), React.createElement("span", {
      className: "tip-val"
    }, s1(d.v))), d.fl != null && React.createElement("span", {
      className: "tip-row"
    }, React.createElement("span", {
      className: "tip-label"
    }, "Respondent flow to Labor"), React.createElement("span", {
      className: "tip-val"
    }, d.fl.toFixed(1), "%")), React.createElement("span", {
      className: "tip-row"
    }, React.createElement("span", {
      className: "tip-label"
    }, "Fieldwork"), React.createElement("span", {
      className: "tip-val"
    }, d.dateLabel)), d.sample != null && React.createElement("span", {
      className: "tip-row"
    }, React.createElement("span", {
      className: "tip-label"
    }, "Sample"), React.createElement("span", {
      className: "tip-val"
    }, "n = ", d.sample.toLocaleString())), k && tip.src !== "touch" && React.createElement("div", {
      className: "tip-hint"
    }, tip.src === "focus" ? "Press Enter to open this poll in All polls" : "Click to open this poll in All polls"));
  })());
}
const FF_MRP_HOUSE = "DemosAU (MRP)";
const FF_REGIONS = [["", "All voters"], ["inner", "Inner metro"], ["outer", "Outer metro"], ["regional", "Regional"]];
const FF_REG_OF = {
  inner: "inner metro",
  outer: "outer metro",
  regional: "regional or rural"
};
const FL_TABS = [{
  id: "co",
  label: "Labor v Coalition"
}, {
  id: "on",
  label: "Labor v One Nation"
}, {
  id: "ln",
  label: "Coalition v One Nation"
}];
const flWinMonths = win => {
  const m = String(win || "").match(/[A-Z][a-z]{2}/g) || [];
  return !m.length ? "" : m[0] === m[m.length - 1] ? m[0] : m[0] + "–" + m[m.length - 1];
};
function RdFlowSpark({
  ck,
  marks,
  refv,
  band,
  W,
  H,
  dom,
  yr,
  tip,
  onTip,
  onOpen,
  tipBody,
  emptyNote,
  ariaHead
}) {
  const ptr = useRef(null);
  const tipRef = useRef(null);
  const svgRef = useRef(null);
  const [tipW, setTipW] = useState(0);
  const [below, setBelow] = useState(false);
  const pl = 6,
    pr = 6,
    pt = 7,
    pb = 7;
  const X = m => pl + (m - dom[0]) / Math.max(1e-9, dom[1] - dom[0]) * (W - pl - pr);
  const Y = v => pt + (1 - (v - yr[0]) / (yr[1] - yr[0])) * (H - pt - pb);
  const cls = FF_COHORTS[ck].cls;
  const rb = marks.filter(m => m.kind === "wave");
  const dm = marks.filter(m => m.kind === "mrp");
  const pts = rb.map(m => [X(m.xm), Y(m.v)]);
  const tm = tip && tip.ck === ck ? marks.find(m => m.id === tip.id) : null;
  React.useLayoutEffect(() => {
    const el = tipRef.current,
      sv = svgRef.current;
    if (!el || !sv || !tm) return;
    setTipW(p => Math.abs(p - el.offsetWidth) > 0.5 ? el.offsetWidth : p);
    const top = sv.getBoundingClientRect().top + Y(tm.v) - 10 - el.offsetHeight;
    setBelow(top < 78);
  }, [tm && tm.id]);
  const half = Math.min((tipW || 240) / 2, W / 2 - 8);
  const tipLeft = x => Math.min(W - 8 - half, Math.max(8 + half, x));
  const nearest = (ev, reach) => {
    const r = ev.currentTarget.getBoundingClientRect();
    const px = ev.clientX - r.left,
      py = ev.clientY - r.top;
    let best = null,
      bd = reach * reach;
    for (const m of marks) {
      const dd = (X(m.xm) - px) ** 2 + ((Y(m.v) - py) / 2.5) ** 2;
      if (dd <= bd) {
        bd = dd;
        best = m;
      }
    }
    return best;
  };
  const C = v => Math.max(yr[0], Math.min(yr[1], v));
  return React.createElement("div", {
    className: "rd-fx-spark"
  }, React.createElement("svg", {
    ref: svgRef,
    width: W,
    height: H,
    viewBox: `0 0 ${W} ${H}`,
    role: "img",
    "aria-label": ariaHead,
    className: tip && tip.ck === ck && tip.src === "mouse" && tm && tm.key ? "link" : null,
    onPointerDown: ev => {
      ptr.current = ev.pointerType;
    },
    onPointerMove: ev => {
      if (ev.pointerType !== "mouse") return;
      const m = nearest(ev, 14);
      if (m) {
        if (!tip || tip.ck !== ck || tip.id !== m.id || tip.src !== "mouse") onTip({
          ck,
          id: m.id,
          src: "mouse"
        });
      } else if (tip && tip.ck === ck && tip.src === "mouse") onTip(null);
    },
    onPointerLeave: ev => {
      if (ev.pointerType === "mouse" && tip && tip.ck === ck && tip.src === "mouse") onTip(null);
    },
    onClick: ev => {
      const p = ptr.current;
      ptr.current = null;
      const m = nearest(ev, p === "mouse" ? 14 : 26);
      if (!m) {
        if (p !== "mouse") onTip(null);
        return;
      }
      ev.stopPropagation();
      if (p === "mouse" && m.key) {
        onTip(null);
        onOpen(m.key);
        return;
      }
      if (tip && tip.ck === ck && tip.id === m.id && p !== "mouse") onTip(null);else onTip({
        ck,
        id: m.id,
        src: p === "mouse" ? "mouse" : "touch"
      });
    }
  }, refv != null && band != null && React.createElement("rect", {
    className: "rd-fx-refb",
    x: pl,
    y: Y(C(refv + band)),
    width: W - pl - pr,
    height: Math.max(0, Y(C(refv - band)) - Y(C(refv + band)))
  }), refv != null && pts.length > 1 && React.createElement("path", {
    className: "rd-fx-area",
    d: monotoneXY(pts) + `L${pts[pts.length - 1][0]} ${Y(refv)}L${pts[0][0]} ${Y(refv)}Z`
  }), refv != null && React.createElement("path", {
    className: "rd-fx-ref",
    d: `M${pl} ${Y(refv)}H${W - pr}`
  }), pts.length > 1 && React.createElement("path", {
    className: "rd-fx-line " + cls,
    d: monotoneXY(pts)
  }), !rb.length && dm.length > 1 && React.createElement("path", {
    className: "rd-fx-mline " + cls,
    d: dm.map((m, i) => (i ? "L" : "M") + X(m.xm) + " " + Y(m.v)).join("")
  }), rb.slice(0, -1).map(m => React.createElement("circle", {
    key: m.id,
    className: "rd-fx-dot " + cls,
    cx: X(m.xm),
    cy: Y(m.v),
    r: "2.4"
  })), dm.map(m => {
    const x = X(m.xm),
      y = Y(m.v);
    return React.createElement("path", {
      key: m.id,
      className: "rd-fx-tr " + cls,
      d: `M${x} ${y - 5.2}L${x + 4.8} ${y + 3.8}L${x - 4.8} ${y + 3.8}Z`
    });
  }), marks.filter(m => m.kind === "byelec").map(m => {
    const x = X(m.xm),
      y = Y(m.v),
      e = m.d.err && m.d.err[ck],
      rg = m.d.range && m.d.range[ck];
    const xd = `M${x - 3.6} ${y - 3.6}L${x + 3.6} ${y + 3.6}M${x + 3.6} ${y - 3.6}L${x - 3.6} ${y + 3.6}`;
    return React.createElement("g", {
      key: m.id
    }, (e != null || rg) && React.createElement("path", {
      className: "rd-fx-x rd-fx-xerr " + cls,
      d: `M${x} ${Y(C(rg ? rg[1] : m.v + e))}V${Y(C(rg ? rg[0] : m.v - e))}`
    }), React.createElement("path", {
      className: "rd-fx-x " + cls + (m.d.kind === "part" ? " rd-fx-xhol" : ""),
      d: xd
    }), m.d.kind === "part" && React.createElement("path", {
      className: "rd-fx-xcut",
      d: xd
    }));
  }), pts.length > 0 && React.createElement("circle", {
    className: "rd-fx-end " + cls,
    cx: pts[pts.length - 1][0],
    cy: pts[pts.length - 1][1],
    r: "3.6"
  }), tm && React.createElement("circle", {
    className: "rd-apd-dothi",
    cx: X(tm.xm),
    cy: Y(tm.v) + (tm.kind === "mrp" ? 0.6 : 0),
    r: "7.5"
  }), !marks.length && emptyNote && React.createElement("text", {
    className: "rd-fl-empty",
    x: W / 2,
    y: refv != null && Y(refv) < H / 2 ? H - 9 : 17,
    textAnchor: "middle"
  }, emptyNote), marks.map(m => React.createElement("circle", {
    key: "h" + m.id,
    className: "rd-apd-hit rd-fx-hit" + (m.key ? " link" : ""),
    cx: X(m.xm),
    cy: Y(m.v),
    r: "8",
    tabIndex: "0",
    role: m.key ? "button" : "img",
    "aria-label": m.aria,
    onFocus: ev => {
      if (ev.target.matches(":focus-visible")) onTip({
        ck,
        id: m.id,
        src: "focus"
      });
    },
    onBlur: () => onTip(t => t && t.ck === ck && t.id === m.id && t.src === "focus" ? null : t),
    onKeyDown: ev => {
      if (ev.key !== "Enter" && ev.key !== " " && ev.key !== "Spacebar") return;
      ev.preventDefault();
      if (m.key) {
        onTip(null);
        onOpen(m.key);
      } else onTip({
        ck,
        id: m.id,
        src: "focus"
      });
    }
  }))), tm && React.createElement("span", {
    ref: tipRef,
    className: "tip rd-fl-tip rd-fx-tip" + (below ? " below" : ""),
    style: {
      left: tipLeft(X(tm.xm)),
      top: Y(tm.v) + (below ? 14 : -10),
      maxWidth: W - 16
    }
  }, tipBody(tm), tm.key && tip.src !== "touch" && React.createElement("div", {
    className: "tip-hint"
  }, tip.src === "focus" ? "Press Enter to open this poll in All polls" : "Click to open this poll in All polls")));
}
function RdFlows({
  measure
}) {
  const D = window.AUSPOL;
  const phone = useNarrow("(max-width: 760px)");
  const narrow = useNarrow("(max-width: 900px)");
  const FD = D.flowDrift,
    FO = D.flowDriftOn;
  const FF = D.flowForced,
    FT = D.flowTables;
  const tabOf = m => m === "onp" ? "on" : "co";
  const [q, setQ] = useState(() => tabOf(measure));
  const mWas = useRef(measure);
  useEffect(() => {
    if (mWas.current === measure) return;
    mWas.current = measure;
    setQ(tabOf(measure));
  }, [measure]);
  const [pick, setPick] = useState(null);
  const [ffReg, setFfReg] = useState("");
  const [tip, setTip] = useState(null);
  const ledger = useRef(null);
  window.useDismissOutside(ledger, !!(tip && tip.src === "touch"), () => setTip(null));
  useHoverClaim("flow-drift", true, null, e => {
    const list = window.AUSPOL.flowForced ? FL_TABS : FL_TABS.filter(t => t.id !== "ln");
    const i = list.findIndex(t => t.id === q);
    if (i < 0 || list.length < 2) return false;
    const nxt = list[(i + (e.key === "ArrowRight" ? 1 : -1) + list.length) % list.length].id;
    setQ(nxt);
    setTip(null);
    return true;
  }, [q]);
  const spaceReg = React.useRef(null);
  spaceReg.current = FF ? () => {
    setFfReg(r => FF_REGIONS[(FF_REGIONS.findIndex(([k]) => k === r) + 1) % FF_REGIONS.length][0]);
    setTip(null);
  } : null;
  React.useEffect(() => {
    const sec = document.getElementById("flow-drift");
    if (!sec) return undefined;
    const inView = {
      current: false
    };
    const io = new IntersectionObserver(es => es.forEach(en => {
      inView.current = en.isIntersecting;
    }));
    io.observe(sec);
    const key = e => {
      if (!inView.current || e.key !== " ") return;
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      const a = document.activeElement;
      const onContestTab = a && a.tagName === "BUTTON" && a.getAttribute("aria-pressed") === "true" && a.matches('#flow-drift .rd-fl-tabs .rd-tab');
      if (!onContestTab && a && a.tagName !== "BODY" && a.tagName !== "HTML") return;
      const sel = window.getSelection && window.getSelection();
      if (sel && !sel.isCollapsed) return;
      if (!spaceReg.current) return;
      e.preventDefault();
      if (!e.repeat) spaceReg.current();
    };
    document.addEventListener("keydown", key, true);
    return () => {
      io.disconnect();
      document.removeEventListener("keydown", key, true);
    };
  }, []);
  const tabsRef = useRef(null);
  useEffect(() => {
    const btn = tabsRef.current && tabsRef.current.querySelector('.rd-fl-tabs [aria-pressed="true"]');
    const sc = btn && btn.closest('[role="group"]');
    if (!sc || sc.scrollWidth <= sc.clientWidth + 1) return;
    const r = btn.getBoundingClientRect(),
      b = sc.getBoundingClientRect();
    if (r.left < b.left) sc.scrollTo({
      left: sc.scrollLeft + r.left - b.left - 28,
      behavior: SM
    });else if (r.right > b.right) sc.scrollTo({
      left: sc.scrollLeft + r.right - b.right + 28,
      behavior: SM
    });
  }, [q]);
  const box = useRef(null);
  const Wall = useRdWidth(box, 1152);
  if (!FD || !FO || !FD.now || !FO.now) return null;
  const PR = D.latest && D.latest.primary || {};
  const regName = ffReg ? (FF_REGIONS.find(([k]) => k === ffReg) || [])[1] : "";
  const mi = ym => Number(ym.slice(0, 4)) * 12 + Number(ym.slice(5, 7)) - 1;
  const rekeyMrp = ws => (ws || []).map(w => {
    if (!ffReg) return w.all ? {
      ...w,
      ...w.all,
      wt: true
    } : w;
    const t = w[ffReg];
    return t ? {
      ...w,
      ...t,
      wt: undefined
    } : null;
  }).filter(Boolean);
  const E = FF && FF.elec2025r;
  const C = FF ? {
    co: {
      id: "co",
      a: "Labor",
      r: "the Coalition",
      cohorts: ["grn", "onp", "oth"],
      ref: E ? ffReg && E[ffReg] ? E[ffReg] : E.all : null,
      refDp: 1,
      band: null,
      refHead: rdElecYear + " count",
      refSub: (ffReg ? regName : "as counted") + "*",
      refName: rdElecYear + " count*",
      rb: ffReg ? [] : FF.vsCoal,
      dm: ffReg ? [] : FF.demos || [],
      bys: [],
      drift: FD,
      flows: "the " + rdElecYear + " flows"
    },
    on: {
      id: "on",
      a: "Labor",
      r: "One Nation",
      cohorts: ["coal", "grn", "oth"],
      ref: FT ? {
        coal: FT.onp.lnp * 100,
        grn: FT.onp.grn * 100,
        oth: FT.onp.oth * 100
      } : null,
      refDp: null,
      band: FT ? {
        coal: FT.onBand.lnp * 100,
        grn: FT.onBand.grn * 100,
        oth: FT.onBand.oth * 100
      } : null,
      refHead: "Site assumes",
      refSub: ffReg ? "national" : "built, no count",
      refName: "Site assumes",
      rb: ffReg ? [] : FF.vsOn,
      dm: rekeyMrp(FF.demosOn),
      bys: ffReg ? [] : FF.bys || [],
      drift: FO,
      flows: "the site’s One Nation flows"
    },
    ln: {
      id: "ln",
      a: "the Coalition",
      r: "One Nation",
      cohorts: ["alp", "grn", "oth"],
      ref: null,
      refDp: null,
      band: null,
      refHead: "Site assumes",
      refSub: "no count",
      refName: null,
      rb: [],
      dm: rekeyMrp(FF.lnpOn),
      bys: [],
      drift: null,
      flows: null
    }
  } : {
    co: {
      id: "co",
      a: "Labor",
      r: "the Coalition",
      cohorts: [],
      ref: null,
      band: null,
      rb: [],
      dm: [],
      bys: [],
      drift: FD,
      flows: "the " + rdElecYear + " flows"
    },
    on: {
      id: "on",
      a: "Labor",
      r: "One Nation",
      cohorts: [],
      ref: null,
      band: null,
      rb: [],
      dm: [],
      bys: [],
      drift: FO,
      flows: "the site’s One Nation flows"
    }
  };
  const tabs = FF ? FL_TABS : FL_TABS.filter(t => t.id !== "ln");
  const {
    head,
    dek,
    ff,
    movedOf
  } = window.AP.flowStory();
  const s1 = v => Math.abs(v).toFixed(1);
  const c = C[q] || C.co;
  const allXm = FF ? [...FF.vsCoal, ...FF.vsOn, ...(FF.demos || []), ...(FF.demosOn || []), ...(FF.lnpOn || []), ...(FF.bys || [])].map(d => d.xm != null ? d.xm : d.ym ? mi(d.ym) : null).filter(v => v != null) : [];
  const dom = allXm.length ? [Math.floor(Math.min(...allXm)), Math.ceil(Math.max(...allXm))] : [0, 1];
  const ticks = [];
  for (let m = dom[0], yr = null; m <= dom[1]; m += 2) {
    const y = Math.floor(m / 12);
    ticks.push({
      m,
      lab: D.monthName(m % 12 + 1) + (y !== yr ? " ’" + String(y).slice(2) : "")
    });
    yr = y;
  }
  const rbLast = c && c.rb.length ? c.rb[c.rb.length - 1] : null;
  const dmLast = c && c.dm.length ? c.dm[c.dm.length - 1] : null;
  const say = (v, dp) => flFig(v, dp);
  const marksOf = ck => {
    if (!c) return [];
    const who = d => (d.lbl && d.lbl[ck] || FF_COHORTS[ck].name) + " voters";
    const k = (house, date) => house && window.AP && window.AP.pollRowKey ? window.AP.pollRowKey({
      pollster: house,
      released: date
    }) : null;
    const out = [...c.rb.filter(w => w[ck] != null).map(w => ({
      id: "w" + w.date,
      kind: "wave",
      xm: w.xm ?? mi(w.ym),
      v: w[ck],
      d: w,
      house: FF.house || "RedBridge/Accent"
    })), ...c.dm.filter(w => w[ck] != null).map(w => ({
      id: "m" + w.date,
      kind: "mrp",
      xm: w.xm,
      v: w[ck],
      d: w,
      house: FF_MRP_HOUSE
    })), ...c.bys.filter(w => w[ck] != null).map(w => ({
      id: "x" + w.key,
      kind: "byelec",
      xm: w.xm,
      v: w[ck],
      d: w,
      house: null
    }))];
    for (const m of out) {
      m.key = k(m.house, m.d.date);
      const src = m.kind === "byelec" ? m.d.label : m.kind === "mrp" ? "DemosAU MRP" : m.house;
      m.aria = `${src}, ${m.d.win}: ${who(m.d)}, ${m.kind === "byelec" ? "preferences to " : ""}${c.a} ${say(m.v)}, ${c.r.replace(/^the /, "")} ${Math.round((100 - m.v) * 10) / 10}` + (m.kind === "mrp" && m.d.wt ? " — all regions, our weighting of DemosAU’s printed regional tables" : "") + (m.kind === "mrp" && ffReg ? ` — ${regName} seats, as the report prints them` : "") + (m.kind === "byelec" && m.d.sub ? " — " + m.d.sub : "") + (m.d.estCohort === ck ? " — the June Coalition figure combines the report’s printed CLP/LNP/Nat and Liberal rows" : "") + (m.key ? "; press Enter to open this poll" : "");
    }
    return out.sort((a, b) => a.xm - b.xm);
  };
  const valsOf = ck => [...marksOf(ck).map(m => m.v), ...(c && c.ref ? [c.ref[ck] - (c.band ? c.band[ck] : 0), c.ref[ck] + (c.band ? c.band[ck] : 0)] : [])];
  const need = c ? Math.max(0, ...c.cohorts.map(ck => {
    const v = valsOf(ck);
    return v.length ? Math.max(...v) - Math.min(...v) : 0;
  })) : 0;
  const span = Math.max(30, Math.ceil((need + 4) / 10) * 10);
  const yrOf = ck => {
    const v = valsOf(ck);
    if (!v.length) return [0, span];
    const mn = Math.min(...v),
      mx = Math.max(...v);
    let lo = Math.floor(((mn + mx) / 2 - span / 2) / 5) * 5;
    lo = Math.max(0, Math.min(100 - span, lo));
    if (mn < lo + 1) lo = Math.max(0, Math.floor((mn - 1) / 5) * 5);
    if (mx > lo + span - 1) lo = Math.min(100 - span, Math.ceil((mx + 1 - span) / 5) * 5);
    return [lo, lo + span];
  };
  const colW = Wall > 1100 ? [220, 100, 128, 100, 40] : [176, 92, 116, 92, 28];
  const sparkW = narrow ? Wall : Math.max(160, Wall - colW.reduce((a, b) => a + b, 0));
  const sparkH = narrow ? 52 : 64;
  const grid = narrow ? undefined : {
    gridTemplateColumns: colW.map(w => w + "px").join(" ") + " minmax(0, 1fr)"
  };
  const tipBody = m => {
    const ck = m.ck;
    const lbl = m.d.lbl && m.d.lbl[ck] || FF_COHORTS[ck].name;
    const refV = c.ref ? c.ref[ck] : null;
    return React.createElement(React.Fragment, null, React.createElement("span", {
      className: "tip-title"
    }, m.kind === "byelec" ? m.d.label + ", " + m.d.win : (m.kind === "mrp" ? "DemosAU MRP" : m.house) + ", " + m.d.win), React.createElement("span", {
      className: "tip-sub rd-fx-tsub"
    }, m.kind === "byelec" ? m.d.sub : lbl + " voters choosing between " + c.a + " and " + c.r), React.createElement("span", {
      className: "tip-row on"
    }, React.createElement("span", {
      className: "tip-swatch rd-fx-sw " + m.kind + " " + FF_COHORTS[ck].cls
    }), React.createElement("span", {
      className: "tip-label"
    }, m.kind === "byelec" ? "Preferences to " + c.a : "Pick " + c.a), React.createElement("span", {
      className: "tip-val"
    }, say(m.v), "%")), m.kind === "byelec" && m.d.err && m.d.err[ck] != null && React.createElement("span", {
      className: "tip-row"
    }, React.createElement("span", {
      className: "tip-label rd-fx-tind"
    }, "Estimate\u2019s 90% error"), React.createElement("span", {
      className: "tip-val"
    }, "\xB1", say(m.d.err[ck]))), m.kind === "byelec" && m.d.range && m.d.range[ck] && React.createElement("span", {
      className: "tip-row"
    }, React.createElement("span", {
      className: "tip-label rd-fx-tind"
    }, "Range, by method"), React.createElement("span", {
      className: "tip-val"
    }, say(m.d.range[ck][0]), "\u2013", say(m.d.range[ck][1]))), m.kind === "byelec" && (m.d.lbl && m.d.lbl[ck] || m.d.alt && m.d.alt[ck]) && React.createElement("span", {
      className: "tip-sub rd-fx-tnote"
    }, rdCap([m.d.lbl && m.d.lbl[ck], m.d.alt && m.d.alt[ck]].filter(Boolean).join("; "))), refV != null && React.createElement("span", {
      className: "tip-row"
    }, React.createElement("span", {
      className: "tip-label rd-fx-tind"
    }, c.refName), React.createElement("span", {
      className: "tip-val rd-fx-tref"
    }, say(refV, c.refDp), c.band ? " ±" + say(c.band[ck]) : "")), m.d.n != null && React.createElement("span", {
      className: "tip-row"
    }, React.createElement("span", {
      className: "tip-label rd-fx-tind"
    }, "Sample"), React.createElement("span", {
      className: "tip-val"
    }, "n = ", m.d.n.toLocaleString())), m.kind === "mrp" && m.d.wt && React.createElement("span", {
      className: "tip-sub rd-fx-tnote"
    }, "All voters is our weighting of the report\u2019s three regional tables, by enrolment and vote."), m.kind === "mrp" && ffReg && React.createElement("span", {
      className: "tip-sub rd-fx-tnote"
    }, regName, " seats, as the report prints them."), m.d.estCohort === ck && React.createElement("span", {
      className: "tip-sub rd-fx-tnote"
    }, "June\u2019s Coalition figure combines the report\u2019s printed CLP/LNP/Nat (34) and Liberal (37) rows; no combined row was printed."));
  };
  const openPoll = k => {
    if (window.AP.openPoll) window.AP.openPoll(k, "twopp", "the preference-flows ledger");
  };
  const waveKey = (house, w) => w && window.AP && window.AP.pollRowKey ? window.AP.pollRowKey({
    pollster: house,
    released: w.date
  }) : null;
  const srcOf = house => house.replace(/\s*\(MRP\)/, " MRP");
  const colHead = (house, w, name, em) => {
    const k = waveKey(house, w);
    const inner = React.createElement(React.Fragment, null, name, React.createElement("em", null, em));
    if (!k) return inner;
    return React.createElement("button", {
      type: "button",
      className: "rd-fx-th",
      "aria-label": srcOf(house) + ", " + w.win + " - open this poll in the All polls table",
      onClick: () => openPoll(k)
    }, inner);
  };
  const chgMonth = mv => {
    const w = (q === "ln" ? c.dm : c.rb).find(x => x.ym === mv.ym);
    const house = q === "ln" ? FF_MRP_HOUSE : FF.house || "RedBridge/Accent";
    const mm = D.monthName(Number(mv.ym.slice(5)));
    if (!waveKey(house, w)) return mm;
    return React.createElement("button", {
      type: "button",
      className: "rd-fx-mo",
      "aria-label": srcOf(house) + ", " + w.win + " - open this poll in the All polls table",
      onClick: () => openPoll(waveKey(house, w))
    }, mm);
  };
  const big = c && q !== "ln" ? [...c.cohorts].sort((a, b) => (PR[FF_COHORTS[b].share] || 0) - (PR[FF_COHORTS[a].share] || 0))[0] : null;
  const stake = big && PR[FF_COHORTS[big].share] != null ? FF_COHORTS[big].name + " voters are " + PR[FF_COHORTS[big].share].toFixed(1) + "% of the vote, so each 10 points of their preferences moves " + (q === "co" ? "Labor’s two-party figure" : "Labor’s figure against One Nation") + " by " + (PR[FF_COHORTS[big].share] / 10).toFixed(1) + " points." : "";
  const ledgerNote = (q === "co" ? ffReg ? "* The AEC’s " + rdElecYear + " count in the seats classed " + FF_REG_OF[ffReg] + " that finished Labor v Coalition (" + (E && E[ffReg] ? E[ffReg].cov : "") + "). No poll asks this contest by region. " : "* The AEC’s " + rdElecYear + " count in the 115 seats that finished Labor v Coalition, so the three regions add up to it." + (E && E.all.nat ? " Across all 150 seats, " + c.cohorts.map(k => E.all.nat[k].toFixed(1) + "% of " + FF_COHORTS[k].prose).join(", ").replace(/, ([^,]*)$/, " and $1") + " voters’ preferences went to Labor; the site’s two-party figures use those. " : " ") : q === "on" ? "No count of this contest exists, so the site builds its flows from " + rdElecYear + "’s Senate ballots and the 2026 state contests; the band is that table’s own range" + (ffReg ? ", and it is national on every view. " : ". ") : "No count of this contest exists and the site estimates none, so DemosAU’s MRP stands alone. ") + stake + (q !== "co" && !ffReg ? " * DemosAU prints this contest by region only; All voters is our weighting of its three regions by enrolment and vote." : "");
  const flMonths = rdApMonths(RD_AP_TERM1);
  const flSetRows = fd => {
    const hs = fd.houses || {};
    const rows = Object.keys(hs).sort().map(h => {
      const s = (hs[h] || []).filter(d => flMonths.includes(d.ym));
      return {
        h,
        s,
        fit: withinHouseSlope(s.map(d => ({
          h,
          t: D.mx(d.ym),
          w: 1,
          y: d.v
        })))
      };
    }).filter(r => r.s.length);
    const tested = rows.filter(r => r.fit);
    const sigH = [];
    for (const [i, r] of [...tested].sort((a, b) => a.fit.p - b.fit.p).entries()) {
      if (r.fit.p >= 0.05 / (tested.length - i)) break;
      sigH.push(r.h);
    }
    return rows.map(r => ({
      key: r.h,
      name: r.h,
      sig: sigH.includes(r.h),
      cells: [rdTsSgn(r.s[0].v) + " → " + rdTsSgn(r.s[r.s.length - 1].v), r.fit ? rdTsSgn(r.fit.b, true) : "–", r.fit ? rdTsSgn(r.fit.t) : "–", r.fit ? sigH.includes(r.h) ? "Yes" : "No" : "–"]
    }));
  };
  const tsSets = [...(c.drift ? [{
    key: "d" + q,
    label: "Published minus implied, against " + c.r,
    rows: flSetRows(c.drift)
  }] : []), {
    key: "p" + q,
    label: "What voters say: share picking " + c.a,
    rows: ff.filter(r => r.q === q).map(r => ({
      key: r.key,
      name: FF_COHORTS[r.ck].name + " voters",
      sig: r.sig,
      cells: [r.waves.length ? r.waves[0][r.ck] + " → " + r.waves[r.waves.length - 1][r.ck] : "–", r.fit ? rdTsSgn(r.fit.b, true) : "–", r.fit ? rdTsSgn(r.fit.t) : "–", r.fit ? r.sig ? "Yes" : "No" : "–"]
    }))
  }].filter(t => t.rows.length);
  const houses = c && c.drift ? Object.keys(c.drift.houses || {}).sort() : [];
  const pickOn = pick && houses.includes(pick) ? pick : null;
  const nw = c && c.drift ? c.drift.now : null;
  const sideW = 340;
  const cw = narrow ? Wall : Math.max(320, Wall - sideW - 44);
  const verdict = nw ? (Math.abs(nw.v) < 0.05 ? "Published figures sit level with what " + c.flows + " give" : "Published figures now run " + s1(nw.v) + " points kinder to " + (nw.v > 0 ? "Labor" : c.r) + " than " + c.flows + " give") + (Math.abs(nw.v) <= nw.ci95 ? ". That is inside the margin, so no clear shift yet." : ". That is outside the ±" + nw.ci95.toFixed(1) + " margin, so the flows look to have shifted.") : "";
  const zeroNote = q === "on" ? "Zero is each pollster’s usual gap, set by its first head-to-heads, as no count of this contest exists." : "Zero is each pollster’s usual gap, set by its polls in the six months after the election.";
  return React.createElement("section", {
    className: "rd-sec rd-fl",
    id: "flow-drift",
    "aria-labelledby": "rd-fl-t"
  }, React.createElement("div", {
    className: "rd-eyebrow"
  }, React.createElement("h2", {
    className: "rd-title",
    id: "rd-fl-t"
  }, "Respondent-allocated preference flows"), React.createElement("span", {
    className: "rd-meta"
  }, FF ? "Where other parties’ voters send their preferences, and whether that has changed since " + rdElecYear : "Whether preferences still flow the way they did at the " + rdElecYear + " election")), React.createElement(RdHed, {
    head: head,
    dek: dek
  }), React.createElement("div", {
    ref: box,
    className: "rd-fl-body"
  }, React.createElement("div", {
    ref: tabsRef,
    className: "rd-fl-tabwrap"
  }, React.createElement(RdTabs, {
    swipe: true,
    value: q,
    onChange: v => {
      setQ(v);
      setTip(null);
    },
    ariaLabel: "Contest",
    className: "rd-fl-tabs",
    options: tabs
  })), FF && React.createElement("div", {
    className: "rd-fl-ledger",
    ref: ledger,
    onPointerDown: ev => {
      if (ev.pointerType !== "touch") return;
      if (ev.target && ev.target.closest && ev.target.closest(".rd-fx-spark")) return;
      setTip(t => t && t.src === "touch" ? null : t);
    }
  }, React.createElement("div", {
    className: "rd-fl-lhead"
  }, React.createElement("h4", {
    className: "rd-ap-ct"
  }, "Share of each group\u2019s voters whose preferences go to ", c.a, " rather than ", c.r, ", %"), React.createElement("label", {
    className: "rd-fl-reg"
  }, React.createElement("span", null, "Voters"), React.createElement("select", {
    className: "rd-pv-sel rd-fl-sel",
    "aria-label": "Region",
    value: ffReg,
    onChange: e => {
      setFfReg(e.target.value);
      setTip(null);
    }
  }, FF_REGIONS.map(([k, name]) => React.createElement("option", {
    key: k || "all",
    value: k
  }, name))))), React.createElement("div", {
    className: "rd-fx" + (narrow ? " narrow" : ""),
    role: "table",
    "aria-label": "Where each group’s preferences go, " + FL_TABS.find(t => t.id === q).label + (ffReg ? ", " + regName + " seats" : "")
  }, React.createElement("div", {
    className: "rd-fx-hrow",
    role: "row",
    style: grid
  }, React.createElement("span", {
    className: "rd-ap-th",
    role: "columnheader"
  }, "Voters"), React.createElement("span", {
    className: "rd-ap-th r wrap",
    role: "columnheader"
  }, narrow ? q === "co" ? rdElecYear : "Site" : c.refHead, React.createElement("em", null, narrow ? q === "co" ? "count*" : q === "on" ? ffReg ? "national" : "assumes" : "–" : c.refSub)), React.createElement("span", {
    className: "rd-ap-th r wrap",
    role: "columnheader"
  }, colHead(FF.house || "RedBridge/Accent", rbLast, narrow ? "RedBr." : "RedBridge", c.rb.length ? narrow ? D.monthName(Number(rbLast.ym.slice(5))) : D.monthName(Number(rbLast.ym.slice(5))) + " wave" : ffReg && q !== "ln" ? "national only" : "doesn’t ask")), React.createElement("span", {
    className: "rd-ap-th r wrap",
    role: "columnheader"
  }, colHead(FF_MRP_HOUSE, dmLast, narrow ? "Demos" : "DemosAU", dmLast ? flWinMonths(dmLast.win) + (narrow ? "" : " MRP") + (q !== "co" && !ffReg ? "*" : "") : "national only")), !narrow && React.createElement("span", {
    "aria-hidden": "true"
  }), !narrow && React.createElement("span", {
    className: "rd-fx-shead",
    role: "columnheader"
  }, React.createElement("span", {
    className: "rd-ap-cap"
  }, "Since ", D.monthNameFull(dom[0] % 12 + 1), React.createElement("em", null, ", each row spans ", span, " points")), ticks.map((t, i) => React.createElement("span", {
    key: t.m,
    className: "rd-ap-tk " + (i === 0 ? "start" : i === ticks.length - 1 ? "end" : "middle"),
    style: {
      left: 6 + (t.m - dom[0]) / Math.max(1e-9, dom[1] - dom[0]) * (sparkW - 12)
    }
  }, t.lab)))), c.cohorts.map(ck => {
    const f = FF_COHORTS[ck];
    const rbW = [...c.rb].reverse().find(w => w[ck] != null);
    const dmW = [...c.dm].reverse().find(w => w[ck] != null);
    const mv = !ffReg ? movedOf(q, ck) : null;
    const marks = marksOf(ck).map(m => ({
      ...m,
      ck
    }));
    const share = PR[f.share];
    return React.createElement("div", {
      key: ck,
      className: "rd-fx-row",
      role: "row",
      style: grid
    }, React.createElement("span", {
      className: "rd-fx-who",
      role: "rowheader"
    }, React.createElement("b", null, React.createElement("i", {
      className: "rd-fx-swatch " + f.cls,
      "aria-hidden": "true"
    }), f.name, narrow ? "" : " voters"), share != null && React.createElement("span", {
      className: "rd-ap-sub"
    }, share.toFixed(1), "% of the vote")), React.createElement("span", {
      className: "rd-fx-n ref",
      role: "cell"
    }, c.ref ? React.createElement(React.Fragment, null, say(c.ref[ck], c.refDp), c.band ? React.createElement("span", {
      className: "rd-fx-band"
    }, "\xB1", say(c.band[ck])) : null) : React.createElement("span", {
      className: "rd-fx-nil",
      "aria-label": "none"
    }, "\u2013")), React.createElement("span", {
      className: "rd-fx-n",
      role: "cell"
    }, rbW ? say(rbW[ck]) : React.createElement("span", {
      className: "rd-fx-nil",
      "aria-label": "not asked"
    }, "\u2013"), mv && React.createElement("span", {
      className: "rd-fx-chg"
    }, mv.up ? "up" : "down", " from ", say(mv.from), " in ", chgMonth(mv))), React.createElement("span", {
      className: "rd-fx-n",
      role: "cell"
    }, dmW ? say(dmW[ck]) : React.createElement("span", {
      className: "rd-fx-nil",
      "aria-label": "not asked"
    }, "\u2013")), !narrow && React.createElement("span", {
      "aria-hidden": "true"
    }), React.createElement("span", {
      className: "rd-fx-sc",
      role: "cell"
    }, React.createElement(RdFlowSpark, {
      ck: ck,
      marks: marks,
      refv: c.ref ? c.ref[ck] : null,
      band: c.band ? c.band[ck] : null,
      W: sparkW,
      H: sparkH,
      dom: dom,
      yr: yrOf(ck),
      tip: tip,
      onTip: setTip,
      onOpen: openPoll,
      tipBody: tipBody,
      emptyNote: ffReg && q === "co" ? "No poll asks this by region" : "No readings",
      ariaHead: f.name + " voters’ preferences to " + c.a + ", month by month" + (c.ref ? ", against " + (q === "co" ? "the " + rdElecYear + " count of " : "the site’s ") + say(c.ref[ck], c.refDp) : "")
    })));
  }), narrow && React.createElement("div", {
    className: "rd-fx-ticks",
    "aria-hidden": "true"
  }, ticks.map((t, i) => React.createElement("span", {
    key: t.m,
    className: "rd-ap-tk " + (i === 0 ? "start" : i === ticks.length - 1 ? "end" : "middle"),
    style: {
      left: 6 + (t.m - dom[0]) / Math.max(1e-9, dom[1] - dom[0]) * (sparkW - 12)
    }
  }, t.lab)))), React.createElement(RdKey, {
    className: "rd-ckey rd-fx-key",
    items: []
  }, c.rb.length > 0 && React.createElement("span", {
    className: "rd-key-item"
  }, React.createElement("span", {
    className: "rd-fx-keyln",
    "aria-hidden": "true"
  }, React.createElement("i", null)), "RedBridge/Accent, monthly"), c.dm.length > 0 && React.createElement("span", {
    className: "rd-key-item"
  }, React.createElement("span", {
    className: "rd-fx-keydm",
    "aria-hidden": "true"
  }), "DemosAU MRP, quarterly"), c.bys.length > 0 && React.createElement("span", {
    className: "rd-key-item"
  }, React.createElement("span", {
    className: "rd-fx-keyx",
    "aria-hidden": "true"
  }), "Contest counts and estimates"), c.bys.some(w => w.kind === "part") && React.createElement("span", {
    className: "rd-key-item"
  }, React.createElement(ExHollowX, null), "Hollow: a count of part of the vote"), c.ref && React.createElement("span", {
    className: "rd-key-item"
  }, React.createElement("span", {
    className: "rd-fx-keyref" + (c.band ? " band" : ""),
    "aria-hidden": "true"
  }), q === "co" ? rdElecYear + " count*" : "Site’s assumption, with its range"), c.ref && c.rb.length > 0 && React.createElement("span", {
    className: "rd-key-item"
  }, React.createElement("span", {
    className: "rd-fx-keyarea",
    "aria-hidden": "true"
  }), "Gap to it")), React.createElement("p", {
    className: "rd-note rd-fx-note"
  }, ledgerNote)), c.drift && React.createElement("div", {
    className: "rd-fl-dblock" + (FF ? "" : " solo")
  }, React.createElement("div", {
    className: "rd-fl-dhead"
  }, React.createElement("div", {
    className: "rd-fl-dtitle"
  }, FF && React.createElement("h3", {
    className: "rd-sub rd-fl-dt"
  }, "Do the pollsters\u2019 two-party figures show it?"), React.createElement("p", {
    className: "rd-fl-dsub"
  }, "Each poll\u2019s published two-party figure minus what its primary votes give on ", c.flows, ", set against that pollster\u2019s usual gap, points")), React.createElement("select", {
    className: "rd-pv-sel rd-fl-sel",
    "aria-label": "Highlight a pollster",
    value: pickOn || "",
    onChange: e => setPick(e.target.value || null)
  }, React.createElement("option", {
    value: ""
  }, pickOn ? "No highlight" : "Highlight a pollster"), houses.map(h => React.createElement("option", {
    key: h,
    value: h
  }, h)))), React.createElement("div", {
    className: "rd-fl-dgrid",
    style: narrow ? undefined : {
      gridTemplateColumns: cw + "px minmax(0, 1fr)"
    }
  }, React.createElement("div", {
    className: "rd-fl-one"
  }, React.createElement(RdFlowChart, {
    key: q,
    fd: c.drift,
    rival: c.r,
    W: cw,
    phone: phone,
    pick: pickOn,
    emptyNote: q === "on" ? ["No readings before January", "Nothing before Jan", "None before Jan"] : null
  })), React.createElement("div", {
    className: "rd-fl-dside"
  }, !narrow && nw && React.createElement("p", {
    className: "rd-fl-dbig"
  }, Math.abs(nw.v) < 0.05 ? "0.0" : rdSigned(nw.v, 1), React.createElement("span", null, "\xB1", nw.ci95.toFixed(1))), !narrow && React.createElement("p", {
    className: "rd-fl-dverd"
  }, verdict), React.createElement(RdKey, {
    className: "rd-ckey rd-fl-key" + (narrow ? "" : " v"),
    items: [{
      kind: "line",
      color: "var(--ink)",
      label: narrow ? "All pollsters, monthly" : "All pollsters, month by month"
    }, {
      kind: "band",
      color: "var(--ink-3)",
      label: "95% interval"
    }]
  }, React.createElement("span", {
    className: "rd-key-item"
  }, React.createElement("span", {
    className: "rd-fl-keywd",
    "aria-hidden": "true"
  }), "One poll"), React.createElement("span", {
    className: "rd-key-item"
  }, React.createElement("span", {
    className: "rd-fl-keynow",
    "aria-hidden": "true"
  }, React.createElement("i", null)), narrow ? "Now" : "Now: the latest weeks pooled"), pickOn && React.createElement("span", {
    className: "rd-key-item"
  }, React.createElement("span", {
    className: "rd-fl-keypick",
    "aria-hidden": "true"
  }), pickOn, ", month by month")), React.createElement("p", {
    className: "rd-note rd-fl-read"
  }, zeroNote, narrow ? "" : " A pollster that asks voters for their preferences would pull the line away from zero if those answers changed."))))), React.createElement(RdTsig, {
    summary: "Trend-significance table",
    heads: ["Series", "First → last", "Slope, pts/yr", "t", "Significant"],
    sets: tsSets,
    note: (c.drift ? "Published minus implied: one straight line per pollster through its own monthly gaps since the election, t-tested, Holm’s correction within the contest. Yes means a gap is drifting, not just sitting off zero today; pollsters with too few months show dashes. " : "") + (FF ? "What voters say: one straight line per voter group through " + (q === "ln" ? "DemosAU’s quarterly MRP readings" : "RedBridge/Accent’s monthly answers") + ", Holm’s correction across every group in all three contests. A Yes is what the ledger’s “down from” and the section’s headline stand on." : "")
  }), React.createElement(RdFoot, {
    how: {
      term: "preference-flows",
      from: "Respondent-allocated preference flows"
    }
  }, FF ? "RedBridge/Accent asks every month and nationally only, so a named region drops it. DemosAU’s MRP prints its One Nation contests by region; All voters is our weighting of its three regions by enrolment and vote. The " + rdElecYear + " count is the AEC’s, from the 115 seats that finished Labor v Coalition, so every view covers the same seats. The site’s two-party figures use the AEC’s flows across all 150 seats. This check corrects no other figure on the page." : "This check corrects no other figure on the page."));
}
const FLOW_PARTIES = [{
  id: "grn",
  name: "Greens",
  color: "var(--grn)"
}, {
  id: "onp",
  name: "One Nation",
  color: "var(--onp)"
}, {
  id: "oth",
  name: "Others",
  color: "var(--oth)"
}];
const FLOW_ON_PARTIES = [{
  id: "coal",
  name: "Coalition",
  color: "var(--lnp)"
}, {
  id: "grn",
  name: "Greens",
  color: "var(--grn)"
}, {
  id: "oth",
  name: "Others",
  color: "var(--oth)"
}];
const FLOW_CON_PARTIES = [{
  id: "alp",
  name: "Labor",
  color: "var(--alp)"
}, {
  id: "grn",
  name: "Greens",
  color: "var(--grn)"
}, {
  id: "oth",
  name: "Others",
  color: "var(--oth)"
}];
const PRIM_PARTIES = [{
  id: "alp",
  name: "Labor",
  color: "var(--alp)"
}, {
  id: "lnp",
  name: "Coalition",
  color: "var(--lnp)"
}, {
  id: "grn",
  name: "Greens",
  color: "var(--grn)"
}, {
  id: "onp",
  name: "One Nation",
  color: "var(--onp)"
}, {
  id: "dem",
  name: "Democrats",
  color: "var(--dem)"
}, {
  id: "dlp",
  name: "Democratic Labor",
  color: "var(--dlp)"
}, {
  id: "uap",
  name: "Palmer/UAP",
  color: "var(--uap)"
}, {
  id: "xnt",
  name: "Xenophon",
  color: "var(--xnt)"
}, {
  id: "jln",
  name: "Lambie Network",
  color: "var(--jln)"
}, {
  id: "ind",
  name: "Independents",
  color: "var(--ind)"
}, {
  id: "oth",
  name: "Others",
  color: "var(--oth)"
}];
const EX_TICKS = [0, 25, 50, 75, 100];
const exTickFmt = v => v === 100 ? "100%" : String(v);
const exFrame = narrow => ({
  heightPx: narrow ? 260 : 290,
  padPx: narrow ? {
    l: 34,
    r: 16,
    t: 14,
    b: 28
  } : {
    l: 40,
    r: 12,
    t: 16,
    b: 30
  },
  yDomain: [0, 100],
  yTicks: EX_TICKS,
  yTickFmt: exTickFmt,
  baseline: true
});
const SEIFA_IX_DESC = {
  irsad: "the ABS's socio-economic index of advantage and disadvantage",
  ieo: "the ABS's index of education and occupation",
  ier: "the ABS's index of economic resources"
};
const ExHollowX = () => React.createElement("svg", {
  width: "11",
  height: "11",
  viewBox: "0 0 11 11",
  "aria-hidden": "true",
  style: {
    marginRight: 6,
    verticalAlign: -1
  }
}, React.createElement("path", {
  d: "M2 2L9 9M9 2L2 9",
  stroke: "var(--ink-2)",
  strokeWidth: "3.6",
  strokeLinecap: "round",
  fill: "none"
}), React.createElement("path", {
  d: "M2 2L9 9M9 2L2 9",
  stroke: "var(--chart-bg)",
  strokeWidth: "1.4",
  strokeLinecap: "round",
  fill: "none"
}));
const ExBarSwatch = () => React.createElement("svg", {
  width: "12",
  height: "16",
  viewBox: "0 0 12 16",
  "aria-hidden": "true"
}, React.createElement("rect", {
  x: "4",
  y: "1",
  width: "4",
  height: "14",
  rx: "1",
  style: {
    fill: "var(--ink-3)",
    opacity: 0.55
  }
}));
function ExplainedFlowChart({
  jur,
  inv,
  house,
  stateKey,
  classKey,
  lc,
  menu,
  onSen,
  onCon
}) {
  const narrow = useNarrow(window.MQ_PHONE);
  const [exhAdj, setExhAdj] = useState(true);
  const FH = window.AUSPOL.flowHistory || {};
  const CUT = onCon ? "senCon" : onSen ? "senOn" : "sen";
  const SEN = house === "sen" ? (FH.fed || {})[CUT] || null : null;
  const LC = house === "sen" && lc ? (FH.nsw || {})[CUT] || null : null;
  const S = LC || SEN && stateKey && (SEN.states || {})[stateKey] || SEN || jur === "fed" && stateKey && (FH.fed.states || {})[stateKey] || jur === "fed" && classKey && (FH.fed.classes || {})[classKey] || FH[jur] || FH.fed;
  if (!S) return null;
  const YEARS = S.years;
  const est = !!S.estimated;
  const T = v => inv ? 100 - v : v;
  const cnt = !!S.counted;
  const sen = !!(S.senate || S.senState || S.lc || S.senateOn || S.senStateOn || S.senateCon || S.senStateCon);
  const lcBank = !!S.lc;
  const opvYears = S.opv && S.opv.length ? S.opv : null;
  const parties = (onCon ? FLOW_CON_PARTIES : onSen ? FLOW_ON_PARTIES : FLOW_PARTIES).filter(p => (S[p.id] || []).some(v => v != null));
  if (S.fedClass && (S.lump || []).some(v => v != null)) parties.push({
    id: "lump",
    name: "All minor parties",
    color: "var(--ink-2)"
  });
  const hasErr = parties.some(p => (S[p.id + "Err"] || []).some(e => e != null));
  const fedEst = !est && S.estYears && S.estYears.length ? S.estYears : null;
  const series = [];
  parties.forEach(p => {
    const v = S[p.id] || [];
    const err = S[p.id + "Err"] || [];
    const exh = S[p.id + "Exh"] || [];
    const cellEst = S["est" + p.id[0].toUpperCase() + p.id.slice(1)] || [];
    const bal = (S.ballots || {})[p.id] || [];
    const runs = [];
    let cur = [];
    v.forEach((val, i) => {
      if (val == null) {
        if (cur.length) runs.push(cur);
        cur = [];
      } else {
        const nei = S[p.id + "Nei"] || [];
        const cls = S.classic || {};
        const clsV = (cls[p.id] || [])[i],
          clsE = (cls[p.id + "Exh"] || [])[i];
        const adj = exhAdj && exh[i] != null ? 1 - exh[i] / 100 : 1;
        const clsAdj = exhAdj && clsE != null ? 1 - clsE / 100 : 1;
        const note = [err[i] != null ? (est ? "" : "estimated, ") + "±" + (err[i] * adj).toFixed(1) : null, sen && nei[i] != null ? (onSen || onCon ? "named neither: " : "named neither major: ") + nei[i].toFixed(1) + "%" : null, !sen && exh[i] != null ? (est ? "about " : "") + exh[i].toFixed(0) + "% exhausted" + (exhAdj ? ", " + T(val).toFixed(1) + "% of the rest" : "") : null, cellEst[i] ? "estimated" : null, bal[i] ? Math.round(bal[i][0] + bal[i][1]).toLocaleString("en-AU") + " ballots" : null, clsV != null ? "classic seats " + (T(clsV) * clsAdj).toFixed(1) + "%" : null].filter(Boolean).join(", ");
        cur.push({
          x: YEARS[i],
          y: T(val) * adj,
          ...(cellEst[i] ? {
            est: true
          } : null),
          ...(note ? {
            note
          } : null)
        });
      }
    });
    if (cur.length) runs.push(cur);
    runs.forEach((points, i) => {
      const tail = i === runs.length - 1;
      series.push({
        id: p.id + i,
        label: p.name,
        color: p.color,
        points,
        smooth: false,
        rdWidth: 2.5,
        endCap: tail || points.length === 1,
        endLabel: tail && !narrow ? p.name : null
      });
    });
  });
  const pad1 = YEARS.length > 1 ? 0 : 1;
  const half = hasErr ? (YEARS[YEARS.length - 1] - YEARS[0] + 2 * pad1) * 0.008 : 0;
  const x0 = YEARS[0] - pad1 - half,
    x1 = YEARS[YEARS.length - 1] + pad1 + half;
  const areas = [];
  if (hasErr) {
    parties.forEach(p => {
      const err = S[p.id + "Err"] || [];
      const exhA = S[p.id + "Exh"] || [];
      (S[p.id] || []).forEach((v, i) => {
        if (v == null || err[i] == null) return;
        const adj = exhAdj && exhA[i] != null ? 1 - exhA[i] / 100 : 1;
        const y = T(v) * adj,
          e = err[i] * adj;
        const y0 = Math.max(0, y - e),
          y1 = Math.min(100, y + e);
        areas.push({
          id: p.id + "-err" + i,
          color: p.color,
          opacity: 0.55,
          edge: false,
          points: [{
            x: YEARS[i] - half,
            y0,
            y1
          }, {
            x: YEARS[i] + half,
            y0,
            y1
          }]
        });
      });
    });
  }
  const marks = [];
  if (!sen && !S.fedState) {
    series.forEach(s => s.points.forEach(pt => {
      if (S.hollowYears && S.hollowYears.includes(pt.x)) marks.push({
        x: pt.x,
        y: pt.y,
        color: s.color
      });else if (pt.est) marks.push({
        x: pt.x,
        y: pt.y,
        color: s.color,
        diamond: true
      });else if (!fedEst || !fedEst.includes(pt.x)) marks.push({
        x: pt.x,
        y: pt.y,
        color: s.color,
        solid: true
      });
    }));
  }
  const hasRing = marks.some(m => !m.solid && !m.diamond),
    hasSolid = marks.some(m => m.solid),
    hasEst = marks.some(m => m.diamond);
  const basisMixed = !!(S.hollowYears && S.hollowYears.length && S.hollowYears.length < YEARS.length);
  const span = YEARS.length > 1 ? YEARS[0] + "–" + YEARS[YEARS.length - 1] : String(YEARS[0]);
  const side = inv ? onSen || onCon ? "One Nation" : "the Coalition" : onCon ? "the Coalition" : "Labor",
    other = inv ? onCon ? "the Coalition" : "Labor" : onSen || onCon ? "One Nation" : "the Coalition";
  const scope = rdCap(S.elections || S.label + " elections") + ", " + span + (est ? ", estimated" : "");
  const E25 = !onSen && !onCon && ((window.AUSPOL.flowForced || {}).elec2025r || {}).all;
  const cutGap = E25 && E25.nat && E25.oth != null ? [E25.nat.oth.toFixed(1), E25.oth.toFixed(1)] : null;
  const nswGap = (() => {
    const n = FH.nsw,
      c = n && n.classic;
    if (!n || !c || !n.years || !n.years.length) return null;
    const i = n.classicFrom ? n.years.indexOf(n.classicFrom) : -1;
    const g = n.grn[i],
      gc = (c.grn || [])[i];
    return g != null && gc != null ? " NSW, the one state counted both ways, split its " + n.years[i] + " Greens " + g.toFixed(1) + "% of every seat against " + gc.toFixed(1) + "% of the classic ones — these estimates sit within about a point of the count." : "";
  })() || "";
  const markNote = hasRing && hasSolid ? " Hollow rings count the seats where Labor and the Coalition finished first and second; solid dots count every seat." : "";
  const tallySheetNote = S.classicFrom && YEARS[0] < S.classicFrom ? " " + YEARS.filter(y => y < S.classicFrom).join(" and ") + " is the NSW Parliamentary Library’s printed tally-sheet count — 73 of the 93 districts, their declaration forms mostly missing — before the ballot-level files begin." + " There’s no 2011 point — the Electoral Commission stopped running full preference counts for information that year, so no count of party-by-party flows exists." : "";
  const copyBasis = [hasRing ? "Hollow rings: Labor-v-Coalition seats only." : "", hasSolid ? "Solid dots: every seat." : "", hasEst ? "Hollow diamonds: estimated, not counted." : ""].filter(Boolean).join(" ");
  const noBars = " Counts carry no estimation error, so they have no bars.";
  const oneOnly = lcBank ? (S.oneOnly || []).map((v, i) => Math.round(v) + "% in " + YEARS[i]).join(", ") : null;
  const oneOnlyOn = lcBank ? (S.oneOnly || []).map((v, i) => (S[onCon ? "alp" : "coal"] || [])[i] != null ? Math.round(v) + "% in " + YEARS[i] : null).filter(Boolean).join(", ") : null;
  const lumpEstYears = S.fedClass ? YEARS.filter((y, i) => (S.estLump || [])[i]) : [];
  const lumpEstNote = !S.fedClass ? "" : lumpEstYears.length ? "; the all-minor-parties line stays a count, except in " + lumpEstYears.join(" and ") + ", when the Labor-bound ballots of a beaten Coalition candidate had to be shared between seats" : "; the all-minor-parties line stays a count";
  const onpGapYears = S.fedClass ? YEARS.filter((y, i) => y >= 1998 && (S.onp || [])[i] == null) : [];
  const onpGapNote = !S.fedClass ? "" : (YEARS[0] < 1998 ? " One Nation’s line opens in 1998, its first federal election." : "") + (onpGapYears.length ? " One Nation’s line breaks in " + onpGapYears.join(" and ") + ": it had no " + (onpGapYears.every(y => y >= 2004) ? "candidate in these seats" : "ballots in the counted seats") + (onpGapYears.length > 1 ? " in those years." : " that year.") : "");
  const onpThin = (() => {
    if (!S.fedClass) return null;
    let lo = null;
    ((S.ballots || {}).onp || []).forEach((b, i) => {
      if (!b || (S.onp || [])[i] == null) return;
      const n = Math.round(b[0] + b[1]);
      if (!lo || n < lo.n) lo = {
        n,
        y: YEARS[i]
      };
    });
    return lo && lo.n < 5000 ? lo : null;
  })();
  const thinNote = onpThin ? " Small bases swing: One Nation’s " + onpThin.y + " point rests on " + onpThin.n.toLocaleString("en-AU") + " ballots (each point’s tooltip gives its base)." : "";
  const cap = lcBank ? onSen || onCon ? "Counted from the NSW Electoral Commission’s ballot-level preference files: every formal above-the-line vote at the " + span + " Legislative Council elections (below-the-line papers excluded, as on the Senate view). One Nation ran no upper-house group in 2011 or 2015 (Pauline Hanson’s 2011 independent ticket sits with the Others) — a pair nobody could rank is a gap, never a zero — so the lines open in 2019. Most NSW upper-house voters number just one box above the line — " + oneOnlyOn + " — so most ballots rank neither of the pair; each share is of the cohort’s ballots that went on to rank " + (onCon ? "the Coalition or One Nation" : "Labor or One Nation") + " (or both) — a ballot naming only one of the pair still counts its way — and each point’s tooltip gives how many named neither — “named neither”, never “exhausted”: a paper that names neither of the pair mostly still counts for a minor group. It is the only state upper house this pair can be counted in: Victoria’s Council used group voting tickets until 2022 — abolished from 2026 — so its flows would record the parties’ tickets, not voters’ choices, Western Australia’s tickets ended a year earlier with no ballot-level record since, and the rest publish none. NSW’s ballot record is the only state upper-house count of voters’ own preferences." : "Counted from the NSW Electoral Commission’s ballot-level preference files: every formal above-the-line vote at the " + span + " Legislative Council elections (below-the-line papers excluded, as on the Senate view). Most NSW upper-house voters number just one box above the line — " + oneOnly + " — so most ballots name neither major; each share is of the ballots that went on to rank Labor or the Coalition, and each point’s tooltip gives how many named neither — “named neither”, never “exhausted”: a paper that names no major mostly still counts for a minor group. One Nation’s line opens in 2019 — it ran no upper-house group in 2011 or 2015 (Pauline Hanson’s 2011 independent ticket sits with the Others), and a zero-ballot group draws as a gap, never a zero. Victoria’s Council used group voting tickets until 2022 — abolished from 2026 — so its flows would record the parties’ tickets, not voters’ choices. Western Australia’s tickets ended a year earlier — its last ticket count was 2021 — and its first no-ticket election, the statewide count of 2025, published count sheets but no ballot-level record; South Australia’s and Tasmania’s commissions publish none either. NSW’s ballot record is the only state upper-house count of voters’ own preferences." : onCon ? "Counted from the AEC’s ballot-level formal-preferences files: every above-the-line Senate ballot, " + span + " (below-the-line papers excluded; the group-voting-ticket era kept no per-ballot record before 2016). Each share is of the group’s ballots that ranked the Coalition or One Nation (or both) — a ballot naming only one of the pair still counts its way — and each point’s tooltip gives the share naming neither — “named neither”, never “exhausted”: no ballot exhausts in a Senate count." + (!stateKey ? " Labor voters barely moved: 62.7% named the Coalition ahead of One Nation in 2016, 73.3% by 2025 — Greens voters named the Coalition ahead throughout (82.8% by 2025). The ACT sits out the elections menu: One Nation ran no ACT Senate tickets in any of the four — a pair nobody could rank is a gap, never a zero." : "") + (S.senStateCon ? " A gap in the lines is an election One Nation had no " + S.short + " Senate tickets — a pair nobody could rank that year." + (stateKey === "nt" ? " It ran none until 2025, so " + S.short + "’s pair opens in 2025." : "") : "") : onSen ? "Counted from the AEC’s ballot-level formal-preferences files: every above-the-line Senate ballot, " + span + " (below-the-line papers excluded; the group-voting-ticket era kept no per-ballot record before 2016). Each share is of the group’s ballots that ranked Labor or One Nation (or both) — a ballot naming only one of the pair still counts its way — and each point’s tooltip gives the share naming neither — “named neither”, never “exhausted”: no ballot exhausts in a Senate count." + (!stateKey ? " Coalition voters turned: 61.2% named Labor ahead of One Nation in 2016, but only 25.3% by 2025 — Greens voters named Labor ahead of One Nation throughout (95.6% by 2025). The ACT sits out the elections menu: One Nation ran no ACT Senate tickets in any of the four — a pair nobody could rank is a gap, never a zero." : "") + (S.senStateOn ? " A gap in the lines is an election One Nation had no " + S.short + " Senate tickets — a pair nobody could rank that year." + (stateKey === "nt" ? " It ran none until 2025, so " + S.short + "’s pair opens in 2025." : "") : "") : sen ? "Counted from the AEC’s ballot-level formal-preferences files: every above-the-line Senate ballot, " + span + " (below-the-line papers excluded; the group-voting-ticket era kept no per-ballot record before 2016). Each share is of the group’s ballots naming a major party, and each point’s tooltip gives the share naming neither major — “named neither”, not exhausted: no ballot exhausts in a Senate count. Senate flows run well above the House’s (the Greens’ ballots named Labor 86.9% in 2016 against 81.9% of their House ballots), and One Nation’s neither-share fell from 46.6% to 24.4% — mostly where it stood tickets, not its voters switching." + (S.senState ? " A gap in One Nation’s line is an election it had no " + S.short + " Senate tickets — a zero-ballot group draws as a gap, never a zero." + (stateKey === "act" || stateKey === "nt" ? " Two senators from a small field leave the territories’ “neither” shares tiny, so " + S.short + "’s lines sit nearer a true two-way split than the states’." : "") : "") : est ? "Estimated from " + S.srcAs + " (" + S.asOf + "), in the seats where Labor and the Coalition finished first and second. Each bar shows how far the method missed, nine times in ten, when it was tried on federal elections; One Nation’s run widest, and its line shows only where at least " + (FH.fed && FH.fed.backtest && FH.fed.backtest.onpMinBallots ? (Math.round(FH.fed.backtest.onpMinBallots / 1000) * 1000).toLocaleString("en-AU") : "39,000") + " of its ballots stand behind the estimate, the smallest base the method was tested on." + (S.opv && S.opv.length ? " Voters could stop numbering " + (S.opv.length > 1 ? "from " + S.opv[0] + " to " + S.opv[S.opv.length - 1] : "in " + S.opv[0]) + (exhAdj ? ", so those years’ shares count each party’s whole vote, an exhausted paper reaching neither side — the switch under the chart turns the adjustment off; the tooltip gives both readings." : ", so those years’ shares are of the ballots that reached Labor or the Coalition; the tooltip gives how many reached neither.") : "") + nswGap : cnt ? "Counted from " + S.srcAs + " (" + S.asOf + "): every formal vote, in every district." + tallySheetNote + " NSW voters may stop numbering, so each share " + (exhAdj ? "counts the party’s whole vote, an exhausted paper reaching neither side — the switch under the chart turns the adjustment off; the tooltip gives both readings, and the classic-seats figure for like-for-like with the states that can count nothing else." : "is of the ballots that reached Labor or the Coalition; the tooltip gives how many reached neither, and the classic-seats figure for like-for-like with the states that can count nothing else.") + noBars : S.fedState ? "Counted by the AEC: its two-party-preferred flow by state by party, 2004–2025 — the per-state cut of the national series (the pre-2004 flows were counted nationally only). A gap in One Nation’s line is a year its " + S.short + " count never reached the AEC’s table." + noBars + " The state elections’ lines count only seats where Labor and the Coalition finished first and second, so the two can differ" + (cutGap ? ": nationally in 2025, everyone else’s flow was " + cutGap[0] + " on this cut and " + cutGap[1] + " on that one." : ".") : S.fedClass ? (S.seifa ? "Counted from the AEC’s per-seat results, each seat placed in a fifth by its " + S.ix.toUpperCase() + " standing at that election — " + SEIFA_IX_DESC[S.ix] + "." + " From 2004 every seat counts; " + ((S.hollowYears || []).length > 1 ? "the " + S.hollowYears.join(" and ") + " rings count" : "the 2001 ring counts") + " only the seats where Labor and the Coalition finished first and second." + (hasEst ? " Where a state’s crossbench seats fall in more than one fifth, the split between Greens, One Nation and Others in those seats is fitted to each seat’s own counts and drawn as a hollow diamond" + lumpEstNote + "." : "") + " A whole seat sits in one fifth by its average, so a seat that mixes rich and poor suburbs counts entirely in one." : "Counted from the AEC’s per-seat results, each seat grouped by the AEC’s own classification at that election." + " Before 2004 (the rings) only the seats where Labor and the Coalition finished first and second count; from 2004 every seat does." + (hasEst ? " Where a state’s crossbench seats span seat types, the split between Greens, One Nation and Others in those seats is fitted to each seat’s own counts and drawn as a hollow diamond" + lumpEstNote + "." : "")) + onpGapNote + thinNote + (hasEst ? "" : noBars) : (fedEst ? "Estimated for " + fedEst[0] + "–" + fedEst[fedEst.length - 1] + " from each seat’s distribution of preferences, by the method behind the state lines, in the seats where Labor and the Coalition finished first and second; the bars are its 90% error, from trials on the federal elections since 1996." + (((FH.fed.backtest || {}).grnLean || {}).worst || []).filter(w => w.year < 2004).map((w, i, a) => (i ? i === a.length - 1 ? " and " : ", " : " It ran high on the Greens in the oldest trials, ") + w.year + " by " + w.miss.toFixed(1) + (i === a.length - 1 ? " points, so the early Greens points more likely sit low in their bars, and part of the fall to 1996 is the method’s." : "")).join("") + " The AEC counted no flows by party before 1996. " : "") + "Counted by the AEC: its preference-distribution tables by party, 1996–2025 (classic cut to 2001, two-party cut since)." + noBars + (cutGap ? " The state lines count only seats where Labor and the Coalition finished first and second; on that cut, everyone else’s 2025 flow was " + cutGap[1] + ", not " + cutGap[0] + "." : "") + markNote;
  const lines = parties.map(p => ({
    kind: "line",
    color: p.color,
    label: p.name
  }));
  const adjCopyNote = opvYears ? exhAdj ? "Exhaustion-adjusted: optional-numbering years count each party’s whole vote, an exhausted paper reaching neither side." : "Optional-numbering years: each share is of the ballots that reached Labor or the Coalition." : "";
  return React.createElement(React.Fragment, null, React.createElement("div", {
    className: "rd-chead ex-fl-head"
  }, React.createElement("span", {
    className: "rd-chead-t"
  }, "Preferences to " + side + " over " + other + ", %", React.createElement("span", {
    className: "rd-chead-meta"
  }, scope)), menu), narrow && React.createElement(RdKey, {
    items: lines,
    className: "rd-tpp-legend"
  }), React.createElement(TrendChart, _extends({
    key: "ex-fl-" + (house || "rep") + jur + (stateKey || "") + (classKey || "") + (lcBank ? "lc" : "") + (onSen ? "on" : "") + (onCon ? "con" : "")
  }, exFrame(narrow), {
    xDomain: [x0, x1],
    xTicks: YEARS.map(x => ({
      x,
      label: String(x)
    })),
    unit: "%",
    fmt: v => v.toFixed(1),
    series: series,
    marks: marks,
    areas: areas,
    spine: YEARS.map(x => ({
      x
    })),
    tooltipTitle: i => YEARS[i] + " · " + (S.short || S.label) + (basisMixed && S.hollowYears.includes(YEARS[i]) ? " · Labor-v-Coalition seats only" : ""),
    ariaLabel: "Share of preferences flowing to " + side + ", by party, " + S.label + (lcBank ? ", above-the-line NSW Legislative Council ballots" : sen ? ", above-the-line Senate ballots" : "") + (est ? ", estimated" : "") + ", " + span,
    copy: {
      title: "Share of each group’s preferences reaching " + side + " over " + other,
      sub: rdCap(S.elections || S.label + " elections") + ". " + (lcBank ? onSen || onCon ? "Counted from the NSW Electoral Commission’s ballot-level preference files; above-the-line ballots only, and each share is of papers ranking " + (onCon ? "the Coalition or One Nation" : "Labor or One Nation") + " (or both)." : "Counted from the NSW Electoral Commission’s ballot-level preference files; above-the-line ballots only, and each share is of papers naming a major party." : onCon ? "Counted from the AEC’s ballot-level formal-preferences files; above-the-line ballots only, and each share is of papers ranking the Coalition or One Nation (or both)." : onSen ? "Counted from the AEC’s ballot-level formal-preferences files; above-the-line ballots only, and each share is of papers ranking Labor or One Nation (or both)." : sen ? "Counted from the AEC’s ballot-level formal-preferences files; above-the-line ballots only, and each share is of papers naming a major party." : est ? "Estimated from distributions of preferences, in the seats where Labor and the Coalition finished first and second." : fedEst ? "Estimated " + fedEst[0] + "–" + fedEst[fedEst.length - 1] + " from each seat’s distribution of preferences; counted by the AEC from 1996." : S.allSeats ? "Counted from every formal ballot in every district of the state." + tallySheetNote : "Counted, election by election, so no error bars."),
      caption: lcBank ? onSen || onCon ? "Above-the-line NSW upper-house ballots, 2011–2023; on the page, each point’s tooltip gives the share naming neither." : "Above-the-line NSW upper-house ballots, 2011–2023; on the page, each point’s tooltip gives the share naming neither major." : onSen || onCon ? "Above-the-line Senate ballots, 2016 on; on the page, each point’s tooltip gives the share naming neither." : sen ? "Above-the-line Senate ballots, 2016 on; on the page, each point’s tooltip gives the share naming neither major." : (hasErr ? fedEst ? "Bars: the " + fedEst[0] + "–" + fedEst[fedEst.length - 1] + " estimates’ 90% error; 1996 on, the AEC’s counts." : "Each bar shows how far the estimate missed, nine times in ten, on federal elections." : "") + (hasErr && copyBasis ? " " : "") + copyBasis + ((hasErr || copyBasis) && adjCopyNote ? " " : "") + adjCopyNote || undefined,
      legend: narrow ? lines : []
    }
  })), React.createElement(RdKey, {
    className: "rd-ckey",
    items: (est ? [] : [{
      kind: "line",
      color: "var(--ink-3)",
      label: fedEst ? "Counted flow, 1996 on" : "Counted flow at each election"
    }]).concat(hasRing ? [{
      kind: "ring",
      color: "var(--ink)",
      label: "Labor-v-Coalition seats only"
    }] : []).concat(hasSolid ? [{
      kind: "dot-solid",
      color: "var(--ink)",
      label: "Every seat"
    }] : []).concat(hasEst ? [{
      kind: "diamond",
      color: "var(--ink)",
      label: "Estimated, not counted"
    }] : [])
  }, hasErr && React.createElement("span", {
    className: "rd-key-item"
  }, React.createElement(ExBarSwatch, null), fedEst ? "Estimated, " + fedEst[0] + "–" + fedEst[fedEst.length - 1] + ", with its 90% error" : "The estimate’s 90% error"), opvYears && React.createElement("button", {
    type: "button",
    role: "switch",
    "aria-checked": exhAdj,
    className: "rd-key-item ex-fl-adj",
    title: exhAdj ? "Show each share of the ballots that reached Labor or the Coalition" : "Count each party’s whole vote, an exhausted paper reaching neither side",
    onClick: () => setExhAdj(prev => !prev)
  }, React.createElement("span", {
    className: "ex-fl-adj-tk",
    "aria-hidden": "true"
  }), "Exhaustion-adjusted flows" + (opvYears.length < YEARS.length ? ", " + (opvYears.length > 1 ? opvYears[0] + "–" + opvYears[opvYears.length - 1] : opvYears[0]) : ""))), React.createElement(RdFoot, {
    how: {
      term: "flow-history",
      from: "Preference flows explained"
    }
  }, cap));
}
const ON_COHORTS = [{
  id: "coal",
  name: "Coalition",
  color: "var(--lnp)"
}, {
  id: "grn",
  name: "Greens",
  color: "var(--grn)"
}, {
  id: "oth",
  name: "Others",
  color: "var(--oth)"
}];
function ExplainedOnChart({
  inv,
  menu
}) {
  const narrow = useNarrow(window.MQ_PHONE);
  const BYS = ((window.AUSPOL.flowForced || {}).bys || []).slice().sort((a, b) => a.xm - b.xm);
  if (!BYS.length) return null;
  const T = v => inv ? 100 - v : v;
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const parties = ON_COHORTS.filter(p => BYS.some(b => b[p.id] != null));
  const series = [];
  const marks = [];
  const areas = [];
  const x0 = BYS[0].xm - 0.9,
    x1 = BYS[BYS.length - 1].xm + 0.9;
  const half = (x1 - x0) * 0.005;
  parties.forEach(p => {
    const last = BYS.reduce((k, b, i) => b[p.id] != null ? i : k, -1);
    BYS.forEach((b, i) => {
      const v = b[p.id];
      if (v == null) return;
      const e = (b.err || {})[p.id],
        r = (b.range || {})[p.id];
      const note = [(b.lbl || {})[p.id], e != null ? "±" + e.toFixed(1) : r ? "range " + r[0].toFixed(1) + "–" + r[1].toFixed(1) : null, b.kind === "part" ? "part of the vote" : null, (b.alt || {})[p.id]].filter(Boolean).join(", ");
      series.push({
        id: p.id + i,
        label: p.name,
        color: p.color,
        points: [{
          x: b.xm,
          y: T(v),
          ...(note ? {
            note
          } : null)
        }],
        smooth: false,
        rdWidth: 2.5,
        endCap: false,
        endLabel: i === last && !narrow ? p.name : null
      });
      marks.push({
        x: b.xm,
        y: T(v),
        color: p.color,
        cross: true,
        ...(b.kind === "part" ? {
          hollow: true
        } : null),
        ...(e != null || r ? {
          r: 3
        } : null)
      });
      if (e != null || r) {
        const lo = r ? T(r[0]) : T(v) - e,
          hi = r ? T(r[1]) : T(v) + e;
        const y0 = Math.max(0, Math.min(lo, hi)),
          y1 = Math.min(100, Math.max(lo, hi));
        areas.push({
          id: p.id + "-err" + i,
          color: p.color,
          opacity: 0.55,
          edge: false,
          points: [{
            x: b.xm - half,
            y0,
            y1
          }, {
            x: b.xm + half,
            y0,
            y1
          }]
        });
      }
    });
  });
  const ticks = BYS.map(b => ({
    x: b.xm,
    label: MON[+b.date.slice(5, 7) - 1] + " " + b.date.slice(0, 4)
  }));
  const low = s => s.replace(/^(The|This) /, m => m.toLowerCase());
  const cap = BYS.map(b => b.label + " — " + low(b.sub)).join("; ");
  const side = inv ? "One Nation" : "Labor",
    other = inv ? "Labor" : "One Nation";
  const scope = "Each contest with a count or estimate, " + BYS[0].date.slice(0, 4) + "–" + BYS[BYS.length - 1].date.slice(0, 4);
  const hasEst = BYS.some(b => b.err || b.range),
    hasPart = BYS.some(b => b.kind === "part");
  const hasRange = BYS.some(b => b.range);
  const lines = parties.map(p => ({
    kind: "line",
    color: p.color,
    label: p.name
  }));
  return React.createElement(React.Fragment, null, React.createElement("div", {
    className: "rd-chead ex-fl-head"
  }, React.createElement("span", {
    className: "rd-chead-t"
  }, "Preferences to " + side + " over " + other + ", %", React.createElement("span", {
    className: "rd-chead-meta"
  }, scope)), menu), narrow && React.createElement(RdKey, {
    items: lines,
    className: "rd-tpp-legend"
  }), React.createElement(TrendChart, _extends({
    key: "ex-fl-on"
  }, exFrame(narrow), {
    xDomain: [x0, x1],
    xTicks: ticks,
    unit: "%",
    fmt: v => v.toFixed(1),
    series: series,
    marks: marks,
    areas: areas,
    spine: BYS.map(b => ({
      x: b.xm
    })),
    tooltipTitle: i => BYS[i].label,
    ariaLabel: "Share of preferences flowing to " + side + " in Labor-v-One Nation contests, by voter group, " + BYS[0].label + " to " + BYS[BYS.length - 1].label,
    copy: {
      title: "Share of each group’s preferences reaching " + side + " over " + other,
      sub: "Each contest with a count or estimate. " + rdCap(cap) + ".",
      caption: "Each cross is one contest’s count or estimate" + (hasEst ? "; a bar, the estimate’s 90% error" + (hasRange ? " or range" : "") : "") + (hasPart ? "; hollow, a count of part of the vote" : "") + ". The groups differ by contest, so no line joins them.",
      legend: narrow ? lines : []
    }
  })), React.createElement(RdKey, {
    className: "rd-ckey",
    items: []
  }, React.createElement("span", {
    className: "rd-key-item"
  }, React.createElement("span", {
    className: "rd-fx-keyx",
    "aria-hidden": "true"
  }), "Count or estimate"), hasEst && React.createElement("span", {
    className: "rd-key-item"
  }, React.createElement(ExBarSwatch, null), hasRange ? "An estimate’s 90% error or range" : "The estimate’s 90% error"), hasPart && React.createElement("span", {
    className: "rd-key-item"
  }, React.createElement(ExHollowX, null), "Count of part of the vote")), React.createElement(RdFoot, {
    how: {
      term: "flow-history",
      from: "Preference flows explained"
    }
  }, "One reading per contest: " + cap + ". The groups differ by contest, so no line joins them: Hunter’s Coalition voters are Nationals and its Others five minor parties; elsewhere the Coalition voters are Liberals, and South Australia’s and Secret Harbour’s Others are every other voter." + (hasRange ? " Secret Harbour’s bars are ranges: how far its estimate moves with the way the rest of the seat’s known lean is divided between the parties, not a tested error." : "")));
}
const EX_PAIRS = [{
  id: "co",
  label: "Labor v Coalition",
  short: "v Coalition"
}, {
  id: "on",
  label: "Labor v One Nation",
  short: "v One Nation"
}, {
  id: "con",
  label: "Coalition v One Nation",
  short: "Coalition v ON"
}];
function ExplainedPrimaryChart({
  house,
  stateKey,
  classKey,
  statePrim,
  lcKey,
  menu
}) {
  const narrow = useNarrow(window.MQ_PHONE);
  const PH = window.AUSPOL.primaryHistory || null;
  if (!PH || !PH.fed) return null;
  const bank = house === "sen" ? PH.fed.sen : PH.fed;
  if (!bank) return null;
  const S = statePrim || classKey && house !== "sen" && (PH.fed.classes || {})[classKey] || stateKey && (bank.states || {})[stateKey] || bank;
  const YEARS = S.years || [];
  if (!YEARS.length) return null;
  const foldPt = S.foldPt || PH.foldPt || 4;
  const parties = PRIM_PARTIES.filter(p => (S[p.id] || []).some(v => v != null));
  const series = [];
  parties.forEach(p => {
    const v = S[p.id] || [];
    const runs = [];
    let cur = [];
    v.forEach((val, i) => {
      if (val == null) {
        if (cur.length) runs.push(cur);
        cur = [];
      } else cur.push({
        x: YEARS[i],
        y: val
      });
    });
    if (cur.length) runs.push(cur);
    runs.forEach((points, i) => {
      const tail = i === runs.length - 1;
      series.push({
        id: p.id + i,
        label: p.name,
        color: p.color,
        points,
        smooth: false,
        rdWidth: 2.5,
        endCap: tail || points.length === 1,
        endLabel: tail && !narrow ? p.name : null
      });
    });
  });
  const pad1 = YEARS.length > 1 ? 0 : 1;
  const x0 = YEARS[0] - pad1,
    x1 = YEARS[YEARS.length - 1] + pad1;
  const span = YEARS.length > 1 ? YEARS[0] + "–" + YEARS[YEARS.length - 1] : String(YEARS[0]);
  const scope = rdCap(S.elections || S.label + " elections") + ", " + span;
  const cap = (statePrim ? statePrim.lc ? lcKey === "nsw" ? "First preferences by party at the " + span + " NSW Legislative Council elections, every formal above-the-line vote from " + S.srcLine + " (below-the-line papers excluded, as on the Senate view). One Nation ran no upper-house group in 2011 or 2015 - Pauline Hanson’s 2011 independent ticket sits with the Others - so its line opens in 2019." : "First preferences by party at the " + span + " " + S.elections + ", every formal vote from " + S.srcLine + "." : "First preferences by party at the " + span + " " + S.elections + ", from " + S.srcLine + "." : classKey && house !== "sen" ? S.seifa ? "First preferences by party at the " + span + " federal elections in the " + (S.elections.startsWith("federal elections in the ") ? S.elections.slice("federal elections in the ".length) : S.short || S.label) + ", from the AEC's official results - " + SEIFA_IX_DESC[S.ix] + "." : "First preferences by party at the " + span + " federal elections in " + (S.short || S.label) + " seats, from the AEC's official results, each seat grouped by the AEC's own classification for that election's divisions." : stateKey ? "First preferences by party at the " + span + " federal elections in " + (S.short || S.label) + ", from the AEC's official results (its per-state first-preference tables, which reach back to 2004)." : "First preferences by party at the " + span + " " + (house === "sen" ? "Senate" : "federal") + " elections, from the AEC's official results (1972–2001 transcribed from its published election tables; the per-state cut starts 2004).") + " A party polling under " + foldPt + "% draws no line of its own - its share joins Others, which is what remains after the shown lines - so a gap is a small or absent vote, never a zero." + (house === "sen" && !statePrim ? " Senate first preferences are of formal ballots over the whole chamber, so a minor party's line runs ahead of its final-seat share." : "");
  const lines = parties.map(p => ({
    kind: "line",
    color: p.color,
    label: p.name
  }));
  const yMax = Math.max(5, Math.ceil(series.reduce((m, s) => s.points.reduce((mm, p) => Math.max(mm, p.y), m), 0) / 5) * 5);
  const yStep = yMax > 30 ? 10 : 5;
  const YT = [];
  for (let v = 0; v + yStep <= yMax; v += yStep) YT.push(v);
  return React.createElement(React.Fragment, null, React.createElement("div", {
    className: "rd-chead ex-fl-head"
  }, React.createElement("span", {
    className: "rd-chead-t"
  }, "First preferences by party, %", React.createElement("span", {
    className: "rd-chead-meta"
  }, scope)), menu), narrow && React.createElement(RdKey, {
    items: lines,
    className: "rd-tpp-legend"
  }), React.createElement(TrendChart, _extends({
    key: "ex-prim-" + (house || "rep") + (stateKey || "") + (classKey || "") + (statePrim ? "|" + S.label : "")
  }, exFrame(narrow), {
    xDomain: [x0, x1],
    yDomain: [0, yMax],
    yTicks: YT,
    yTickFmt: v => v === YT[YT.length - 1] ? v + "%" : String(v),
    xTicks: YEARS.map(x => ({
      x,
      label: String(x)
    })),
    unit: "%",
    fmt: v => v.toFixed(1),
    series: series,
    tooltipTitle: i => YEARS[i] + " · " + (S.short || S.label),
    ariaLabel: "First-preference vote shares by party, " + S.label + ", " + span,
    copy: {
      title: "First-preference vote shares by party, " + (S.short || S.label),
      sub: rdCap(S.elections || S.label + " elections") + ". " + (statePrim ? "From " + S.srcLine : "Official AEC results") + "; a party under " + foldPt + "% joins Others, the remainder.",
      caption: (statePrim ? "From " + S.srcLine : "Official AEC results") + "; a party under " + foldPt + "% joins Others, the remainder.",
      legend: narrow ? lines : []
    }
  })), React.createElement(RdKey, {
    className: "rd-ckey",
    items: []
  }), React.createElement(RdFoot, {
    how: {
      term: "flow-history",
      from: "Preference flows explained"
    }
  }, cap));
}
const TWO_PARTIES = [{
  id: "alp",
  name: "Labor",
  color: "var(--alp)"
}, {
  id: "lnp",
  name: "Coalition",
  color: "var(--lnp)"
}];
function Explained2ppChart({
  stateKey,
  classKey,
  inv,
  menu,
  house,
  lc
}) {
  const narrow = useNarrow(window.MQ_PHONE);
  const TP = window.AUSPOL.twoPPHistory || null;
  if (!TP || !TP.fed) return null;
  const senAll = TP.fed.sen || null;
  const lcAll = TP.nswLc || null;
  const lcBank = lc && house === "sen" ? lcAll : null;
  const senBank = house === "sen" && !lcBank ? senAll : null;
  const impBank = senBank || lcBank;
  const S = impBank ? stateKey && (impBank.states || {})[stateKey] || impBank : classKey && (TP.fed.classes || {})[classKey] || stateKey && (TP.fed.states || {})[stateKey] || TP.fed;
  const YEARS = S.years || [];
  if (!YEARS.length) return null;
  const active = inv ? TWO_PARTIES[1] : TWO_PARTIES[0];
  const series = [{
    id: "share",
    label: active.name,
    color: active.color,
    points: YEARS.map((x, i) => ({
      x,
      y: S[active.id][i]
    })),
    smooth: false,
    rdWidth: 2.5,
    endCap: true,
    endLabel: !narrow ? active.name : null
  }];
  const pad1 = YEARS.length > 1 ? 0 : 1;
  const x0 = YEARS[0] - pad1,
    x1 = YEARS[YEARS.length - 1] + pad1;
  const span = YEARS.length > 1 ? YEARS[0] + "–" + YEARS[YEARS.length - 1] : String(YEARS[0]);
  const scope = rdCap(S.elections || S.label + " elections") + ", " + span;
  const cap = (lcBank ? "Implied two-party shares of the formal above-the-line New South Wales Legislative Council ballots at the " + span + " elections - the papers naming a major party that put Labor first, of those naming either. Counted from the Electoral Commission's own ballot-level record: it is the only state upper house this pair can be counted in (Victoria's council ran party tickets to 2022, Western Australia's first ticket-free count prints no ballot record, and South Australia's and Tasmania's commissions publish none). Most council papers rank just one group above the line - roughly a ballot in four names neither major - so each figure stands on the papers that went on to rank one of the pair. IMPLIED, never an official count: no two-party figure is tallied for the council." : senBank ? "Implied two-party shares of the formal above-the-line Senate ballots" + (stateKey ? " in " + (S.short || S.label) : "") + " at the " + span + " elections - the papers naming a major party that put Labor first, of those naming either. IMPLIED, never an AEC count: the Commission tallies no two-party figure for the chamber seats are not filled from, and the figures' span opens at 2016, the first count after group tickets handed the preferences to the voter." : classKey ? S.seifa ? "Two-party-preferred shares at the " + span + " federal elections, every division's Labor-v-Coalition count summed across the seats of each " + S.ix.toUpperCase() + " fifth - " + SEIFA_IX_DESC[S.ix] + ". A whole seat sits in one fifth by its average standing." : "Two-party-preferred shares at the " + span + " federal elections in " + (S.short || S.label) + " seats - every division's notional Labor-v-Coalition count summed, each seat grouped by the AEC's own classification for that election's divisions." : stateKey ? "Two-party-preferred shares at the " + span + " federal elections in " + (S.short || S.label) + " - every division's notional Labor-v-Coalition count summed." : "Labor's and the Coalition's shares of the two-party-preferred vote at the " + span + " federal elections, from the AEC's official counts.") + (!senBank && (classKey && !S.seifa || stateKey) ? " The per-division counts run 1996 on - the AEC's two-party downloads joined by its statistics-era polling-place tables; 1993's counts informal votes only, so 1996 is the floor." : "") + (!senBank && (classKey && (!S.seifa || YEARS.includes(1998)) || stateKey) ? " 1998 counts 147 divisions: Newcastle went to a supplementary election the Liberals didn't contest, so it has no Labor-v-Coalition count." : "") + " Above 50, " + active.name + " leads.";
  let dev = 0;
  [TP.fed, ...Object.keys(TP.fed.states || {}).map(k => TP.fed.states[k]), ...Object.keys(TP.fed.classes || {}).map(k => TP.fed.classes[k]), ...(senAll ? [senAll, ...Object.keys(senAll.states || {}).map(k => senAll.states[k])] : []), ...(lcAll ? [lcAll] : [])].forEach(v => (v.alp || []).forEach(x => {
    if (x != null) dev = Math.max(dev, Math.abs(x - 50));
  }));
  const lo = Math.max(0, Math.floor((50 - dev) / 5) * 5);
  const hi = 100 - lo;
  const yStep = hi - lo > 30 ? 10 : 5;
  const YT = [];
  for (let v = lo; v <= hi; v += yStep) YT.push(v);
  if (!YT.includes(50)) YT.splice(YT.findIndex(v => v > 50), 0, 50);
  const lines = series.map(s => ({
    kind: "line",
    color: s.color,
    label: s.label
  }));
  return React.createElement(React.Fragment, null, React.createElement("div", {
    className: "rd-chead ex-fl-head"
  }, React.createElement("span", {
    className: "rd-chead-t"
  }, (impBank ? "Implied two-party preferred, " : "Two-party preferred, ") + active.name + "’s share, %", React.createElement("span", {
    className: "rd-chead-meta"
  }, scope)), menu), narrow && React.createElement(RdKey, {
    items: lines,
    className: "rd-tpp-legend"
  }), React.createElement(TrendChart, _extends({
    key: "ex-2pp-" + (house || "") + (lc ? "lc" : "") + (stateKey || "") + (classKey || "")
  }, exFrame(narrow), {
    xDomain: [x0, x1],
    yDomain: [lo, hi],
    yTicks: YT,
    yTickEmph: 50,
    yTickFmt: v => v === YT[YT.length - 1] ? v + "%" : String(v),
    xTicks: YEARS.map(x => ({
      x,
      label: String(x)
    })),
    unit: "%",
    fmt: v => v.toFixed(1),
    series: series,
    tooltipTitle: i => YEARS[i] + " · " + (S.short || S.label),
    ariaLabel: "Two-party-preferred vote share, " + active.name + ", " + S.label + ", " + span,
    copy: {
      title: active.name + "’s two-party-preferred share, " + (S.short || S.label),
      sub: rdCap(S.elections || S.label + " elections") + (lcBank ? ". Counted from the NSW Electoral Commission's ballot-level record of the council's formal above-the-line ballots - no official two-party count exists for that chamber." : senBank ? ". Implied from the formal above-the-line Senate ballots - no official two-party count exists for that chamber." : ". Official AEC counts."),
      caption: (lcBank ? "Implied from the NSW Electoral Commission's ballot-level record; " : senBank ? "Implied from the formal above-the-line Senate ballots; " : "Official AEC counts; ") + "the other side always sits at 100 minus this share - the two-party count has no third choice.",
      legend: narrow ? lines : []
    }
  })), React.createElement(RdKey, {
    className: "rd-ckey",
    items: []
  }), React.createElement(RdFoot, {
    how: {
      term: "flow-history",
      from: "Preference flows explained"
    }
  }, cap));
}
function ExplainedInformalChart(props) {
  const {
    house,
    stateKey,
    classKey,
    menu
  } = props;
  const narrow = useNarrow(window.MQ_PHONE);
  const IH = window.AUSPOL.informalHistory || null;
  if (!IH || !IH.fed) return null;
  const bank = house === "sen" ? IH.fed.sen : IH.fed;
  if (!bank) return null;
  const S = classKey && house !== "sen" && (IH.fed.classes || {})[classKey] || stateKey && (bank.states || {})[stateKey] || bank;
  const YEARS = S.years || [];
  if (!YEARS.length) return null;
  const vals = S.inf || [];
  const runs = [];
  let cur = [];
  vals.forEach((v, i) => {
    if (v == null) {
      if (cur.length) runs.push(cur);
      cur = [];
    } else cur.push({
      x: YEARS[i],
      y: v
    });
  });
  if (cur.length) runs.push(cur);
  const series = [];
  runs.forEach((points, i) => {
    const tail = i === runs.length - 1;
    series.push({
      id: "inf" + i,
      label: "Informal",
      color: "var(--ink)",
      points,
      smooth: false,
      rdWidth: 2.5,
      endCap: tail || points.length === 1,
      endLabel: null
    });
  });
  const pad1 = YEARS.length > 1 ? 0 : 1;
  const x0 = YEARS[0] - pad1,
    x1 = YEARS[YEARS.length - 1] + pad1;
  const span = YEARS.length > 1 ? YEARS[0] + "–" + YEARS[YEARS.length - 1] : String(YEARS[0]);
  const scope = rdCap(S.elections || S.label + " elections") + ", " + span;
  const cap = (classKey && house !== "sen" ? S.seifa ? "Informal ballots as a share of all ballots cast at the " + span + " federal elections in the " + (S.elections.startsWith("federal elections in the ") ? S.elections.slice("federal elections in the ".length) : S.short || S.label) + " - " + SEIFA_IX_DESC[S.ix] + ". Counted from the AEC's own per-division results." : "Informal ballots as a share of all ballots cast at the " + span + " federal elections in " + (S.short || S.label) + " seats, each seat grouped by the AEC's own classification for that election's divisions. Counted from the AEC's per-division results (the statistics packs' polling-place tables to 2001, the vote-type downloads from 2004)." : stateKey ? "Informal ballots as a share of all ballots cast at the " + span + " " + (house === "sen" ? "Senate" : "federal") + " elections in " + (S.short || S.label) + ", from the handbook's appendix tables before 2004 and the AEC's own published figures since." : "Informal ballots as a share of all ballots cast at the " + span + " " + (house === "sen" ? "Senate" : "federal") + " elections, from the Parliamentary Handbook's appendix tables before 2004 and the AEC's own published figures since (the House figures from its vote-type downloads, the Senate's from its informality summary).") + (house === "sen" ? " The Senate series ends at 2022: the AEC hasn't yet published its 2025 Senate informality summary." : "") + " A territory not yet represented draws a gap, never a zero.";
  let pk = 0;
  [IH.fed, ...Object.keys(IH.fed.states || {}).map(k => IH.fed.states[k]), ...Object.keys(IH.fed.classes || {}).map(k => IH.fed.classes[k]), ...(IH.fed.sen ? [IH.fed.sen, ...Object.keys(IH.fed.sen.states || {}).map(k => IH.fed.sen.states[k])] : [])].forEach(v => (v.inf || []).forEach(x => {
    if (x != null) pk = Math.max(pk, x);
  }));
  const yMax = Math.max(5, Math.ceil(pk / 5) * 5);
  const YT = [];
  for (let v = 0; v <= yMax; v += 5) YT.push(v);
  const lines = [{
    kind: "line",
    color: "var(--ink)",
    label: "Informal share of ballots cast"
  }];
  return React.createElement(React.Fragment, null, React.createElement("div", {
    className: "rd-chead ex-fl-head"
  }, React.createElement("span", {
    className: "rd-chead-t"
  }, "Informal votes, % of ballots cast", React.createElement("span", {
    className: "rd-chead-meta"
  }, scope)), menu), narrow && React.createElement(RdKey, {
    items: lines,
    className: "rd-tpp-legend"
  }), React.createElement(TrendChart, _extends({
    key: "ex-inf-" + (house || "rep") + (stateKey || "") + (classKey || "")
  }, exFrame(narrow), {
    xDomain: [x0, x1],
    yDomain: [0, yMax],
    yTicks: YT,
    yTickFmt: v => v === YT[YT.length - 1] ? v + "%" : String(v),
    xTicks: YEARS.map(x => ({
      x,
      label: String(x)
    })),
    unit: "%",
    fmt: v => v.toFixed(1),
    series: series,
    spine: YEARS.map(x => ({
      x
    })),
    tooltipTitle: i => YEARS[i] + " · " + (S.short || S.label),
    ariaLabel: "Informal share of ballots cast, " + S.label + ", " + span,
    copy: {
      title: "Informal share of ballots cast, " + (S.short || S.label),
      sub: rdCap(S.elections || S.label + " elections") + ". From the Parliamentary Handbook's historical tables and the AEC's own published figures.",
      caption: "From the Parliamentary Handbook's tables and the AEC's published figures; informal ÷ (formal + informal) ballots.",
      legend: narrow ? lines : []
    }
  })), React.createElement(RdKey, {
    className: "rd-ckey",
    items: []
  }), React.createElement(RdFoot, {
    how: {
      term: "flow-history",
      from: "Preference flows explained"
    }
  }, cap));
}
function RdExplained() {
  const ref = useRef(null);
  const secRef = useRef(null);
  const narrow = useNarrow(window.MQ_PHONE);
  const FH = window.AUSPOL.flowHistory || {};
  const KEYS = Object.keys(FH);
  const FED_STATES = FH.fed && FH.fed.states || {};
  const FED_CLASSES = FH.fed && FH.fed.classes || {};
  const [view, setView] = useState("fed");
  const SEN_BANK = FH.fed && FH.fed.sen || null;
  const LC_BANK = FH.nsw && FH.nsw.sen || null;
  const SEN_ON_BANK = FH.fed && FH.fed.senOn || null;
  const ON_SEN_STATES = SEN_ON_BANK && SEN_ON_BANK.states || {};
  const hasOnCells = k => {
    const s = ON_SEN_STATES[k];
    return !!s && ["coal", "grn", "oth"].some(c => (s[c] || []).some(v => v != null));
  };
  const LC_ON_BANK = FH.nsw && FH.nsw.senOn || null;
  const TP_HIST = window.AUSPOL.twoPPHistory || null;
  const TP_SEN = TP_HIST && TP_HIST.fed && TP_HIST.fed.sen || null;
  const TP_NSWLC = TP_HIST && TP_HIST.nswLc || null;
  const SEN_CON_BANK = FH.fed && FH.fed.senCon || null;
  const CON_SEN_STATES = SEN_CON_BANK && SEN_CON_BANK.states || {};
  const hasConCells = k => {
    const s = CON_SEN_STATES[k];
    return !!s && ["alp", "grn", "oth"].some(c => (s[c] || []).some(v => v != null));
  };
  const LC_CON_BANK = FH.nsw && FH.nsw.senCon || null;
  const fedView = view === "fed" || view.startsWith("fed:") || view.startsWith("fedcl:");
  const lcView = view === "nswlc" && !!(LC_BANK || TP_NSWLC);
  const jur = fedView ? "fed" : lcView ? "nsw" : FH[view] ? view : "fed";
  const stateKey = view.startsWith("fed:") && FED_STATES[view.slice(4)] ? view.slice(4) : null;
  const SEN_STATES = SEN_BANK && SEN_BANK.states || {};
  const [house, setHouse] = useState("rep");
  const onSenMode = house === "sen" && !!SEN_ON_BANK;
  const senConMode = house === "sen" && !!SEN_CON_BANK;
  const [inv, setInv] = useState(false);
  const PH_HIST = window.AUSPOL.primaryHistory || null;
  const [figMode, setFig] = useState("flows");
  const primMode = figMode === "primary" && !!PH_HIST && !!(PH_HIST.fed && PH_HIST.fed.sen);
  const twoMode = figMode === "2pp" && !!TP_HIST && !!(TP_HIST.fed && TP_HIST.fed.states && TP_HIST.fed.classes);
  const IH_HIST = window.AUSPOL.informalHistory || null;
  const IH_SEN = IH_HIST && IH_HIST.fed && IH_HIST.fed.sen || null;
  const infMode = figMode === "informal" && !!(IH_HIST && IH_HIST.fed && IH_SEN && IH_HIST.fed.classes);
  const figView = primMode || twoMode || infMode;
  const PH_CLASSES = PH_HIST && PH_HIST.fed && PH_HIST.fed.classes || {};
  const TP_CLASSES = TP_HIST && TP_HIST.fed && TP_HIST.fed.classes || {};
  const IH_CLASSES = IH_HIST && IH_HIST.fed && IH_HIST.fed.classes || {};
  const classBank = primMode ? house === "sen" ? {} : PH_CLASSES : twoMode ? house === "sen" ? {} : TP_CLASSES : infMode ? house === "sen" ? {} : IH_CLASSES : FED_CLASSES;
  const classKey = view.startsWith("fedcl:") && classBank[view.slice(6)] ? view.slice(6) : null;
  const badClass = view.startsWith("fedcl:") && !classKey;
  const STATE_PRIM = PH_HIST && PH_HIST.stateElections || {};
  const STE_KEYS = Object.keys(STATE_PRIM);
  const STE_LCS = {};
  STE_KEYS.forEach(k => {
    const s = STATE_PRIM[k] && STATE_PRIM[k].sen;
    if (s && s.lc) STE_LCS[k] = s;
  });
  const STE_LC_KEYS = Object.keys(STE_LCS);
  const steKey = view.startsWith("ste:") && STATE_PRIM[view.slice(4)] ? view.slice(4) : null;
  const steLcKey = view.startsWith("ste:") && view.endsWith("lc") && STE_LCS[view.slice(4, -2)] ? view.slice(4, -2) : null;
  const steLcView = !!steLcKey;
  const steView = !!steKey || steLcView;
  const stePrim = steLcView ? STE_LCS[steLcKey] : steKey ? STATE_PRIM[steKey] : null;
  const [pair, setPair] = useState("co");
  const rival = pair === "co" ? "Coalition" : "One Nation";
  const shareSideFull = pair === "con" ? "the Coalition" : "Labor";
  const shareSide = pair === "con" ? "Coalition" : "Labor";
  const shareRivalFull = pair === "co" ? "the Coalition" : "One Nation";
  const [twoInv, setTwoInv] = useState(false);
  const flipHouse = () => {
    const next = house === "sen" ? "rep" : "sen";
    setHouse(next);
    if (primMode) {
      if (next === "sen") {
        if (steKey && STE_LCS[steKey]) setView("ste:" + steKey + "lc");else if (steKey) setView("fed");
      } else if (steLcView) setView("ste:" + steLcKey);
      return;
    }
    if (twoMode) {
      if (classKey || lcView) setView("fed");
      return;
    }
    if (infMode) {
      if (classKey) setView("fed");
      return;
    }
    if (next === "sen") {
      if (view === "nsw" && LC_BANK) setView("nswlc");else if (classKey || !fedView || pair === "on" && stateKey && !hasOnCells(stateKey) || pair === "con" && stateKey && !hasConCells(stateKey)) setView("fed");
    } else if (lcView) setView("nsw");
  };
  React.useLayoutEffect(() => {
    const sec = secRef.current;
    const slot = sec && sec.querySelector(".ex-body .ex-slot");
    const node = ref.current;
    if (!slot || !node) return undefined;
    slot.appendChild(node);
    return () => {
      if (node.parentNode === slot) slot.removeChild(node);
    };
  }, []);
  const pairStep = React.useRef(null);
  pairStep.current = dir => {
    if (figView) return false;
    const i = EX_PAIRS.findIndex(x => x.id === pair);
    if (i < 0) return false;
    onPairPick(EX_PAIRS[(i + dir + EX_PAIRS.length) % EX_PAIRS.length].id);
    return true;
  };
  const viewStep = React.useRef(null);
  viewStep.current = dir => {
    const opts = VIEW_OPTS;
    if (!menuShow || opts.length < 2) return false;
    const i = opts.indexOf(view);
    if (i < 0) return false;
    setView(opts[(i + dir + opts.length) % opts.length]);
    return true;
  };
  const cardEl = React.useRef(null);
  const cardMark = React.useCallback(el => {
    cardEl.current = el;
    if (el) el.__rdSwipe = dir => pairStep.current(dir);
  }, []);
  const exHover = React.useRef(false);
  React.useEffect(() => {
    const card = cardEl.current;
    if (!card) return undefined;
    const enter = () => {
      exHover.current = true;
    };
    const leave = () => {
      exHover.current = false;
    };
    exHover.current = card.matches(":hover");
    card.addEventListener("pointerenter", enter);
    card.addEventListener("pointerleave", leave);
    const key = e => {
      if (!exHover.current) return;
      const k = e.key;
      if (k !== "ArrowRight" && k !== "ArrowLeft" && k !== "ArrowDown" && k !== "ArrowUp") return;
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const a = document.activeElement;
      if (a && a.tagName !== "BODY" && a.tagName !== "HTML") return;
      const sel = window.getSelection && window.getSelection();
      if (sel && !sel.isCollapsed) return;
      const went = k === "ArrowRight" || k === "ArrowLeft" ? pairStep.current(k === "ArrowRight" ? 1 : -1) : viewStep.current(k === "ArrowDown" ? 1 : -1);
      if (went) e.preventDefault();
    };
    document.addEventListener("keydown", key, true);
    return () => {
      card.removeEventListener("pointerenter", enter);
      card.removeEventListener("pointerleave", leave);
      document.removeEventListener("keydown", key, true);
    };
  }, []);
  const spaceShare = React.useRef(null);
  spaceShare.current = () => {
    if (twoMode) setTwoInv(v => !v);else if (!figView) setInv(v => !v);
  };
  React.useEffect(() => {
    const card = cardEl.current;
    if (!card) return undefined;
    const inView = {
      current: false
    };
    const io = new IntersectionObserver(es => es.forEach(en => {
      inView.current = en.isIntersecting;
    }));
    io.observe(card);
    const key = e => {
      if (!inView.current || e.key !== " ") return;
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      const a = document.activeElement;
      const onPairTab = a && a.tagName === "BUTTON" && a.getAttribute("aria-pressed") === "true" && a.matches("#flows-explained .ex-fl-tabs .rd-tab");
      if (!onPairTab && a && a.tagName !== "BODY" && a.tagName !== "HTML") return;
      const sel = window.getSelection && window.getSelection();
      if (sel && !sel.isCollapsed) return;
      if (!spaceShare.current) return;
      e.preventDefault();
      if (!e.repeat) spaceShare.current();
    };
    document.addEventListener("keydown", key, true);
    return () => {
      io.disconnect();
      document.removeEventListener("keydown", key, true);
    };
  }, []);
  const stateKeys = Object.keys(FED_STATES);
  const classKeys = Object.keys(FED_CLASSES);
  const senStateKeys = Object.keys(SEN_STATES);
  const tpSenStateKeys = Object.keys(TP_SEN && TP_SEN.states || {});
  const senOnStateKeys = Object.keys(ON_SEN_STATES).filter(hasOnCells);
  const senOnView = onSenMode && pair === "on" && !lcView;
  const senConStateKeys = Object.keys(CON_SEN_STATES).filter(hasConCells);
  const senConView = senConMode && pair === "con" && !lcView;
  const onPairPick = p => {
    setPair(p);
    if (p === "on" && house === "sen" && (lcView && !LC_ON_BANK || stateKey && !hasOnCells(stateKey))) setView("fed");
    if (p === "con") {
      if (house !== "sen") setHouse("sen");
      if (!(view === "fed" || lcView && LC_CON_BANK || stateKey && hasConCells(stateKey))) setView("fed");
    }
  };
  const VIEW_OPTS = primMode ? ["fed", ...Object.keys(PH_HIST.fed && PH_HIST.fed.states || {}).map(k => "fed:" + k), ...(house === "sen" ? STE_LC_KEYS.map(k => "ste:" + k + "lc") : [...Object.keys(PH_CLASSES).map(k => "fedcl:" + k), ...STE_KEYS.map(k => "ste:" + k)])] : twoMode ? house === "sen" ? ["fed", ...tpSenStateKeys.map(k => "fed:" + k), ...(TP_NSWLC ? ["nswlc"] : [])] : ["fed", ...Object.keys(TP_HIST.fed && TP_HIST.fed.states || {}).map(k => "fed:" + k), ...Object.keys(TP_CLASSES).map(k => "fedcl:" + k)] : infMode ? house === "sen" ? ["fed", ...Object.keys(IH_SEN && IH_SEN.states || {}).map(k => "fed:" + k)] : ["fed", ...Object.keys(IH_HIST.fed && IH_HIST.fed.states || {}).map(k => "fed:" + k), ...Object.keys(IH_CLASSES).map(k => "fedcl:" + k)] : house === "sen" ? pair === "on" ? [...(SEN_ON_BANK ? ["fed", ...senOnStateKeys.map(k => "fed:" + k)] : []), ...(LC_ON_BANK ? ["nswlc"] : [])] : pair === "con" ? [...(SEN_CON_BANK ? ["fed", ...senConStateKeys.map(k => "fed:" + k)] : []), ...(LC_CON_BANK ? ["nswlc"] : [])] : [...(SEN_BANK ? ["fed", ...senStateKeys.map(k => "fed:" + k)] : []), ...(LC_BANK ? ["nswlc"] : [])] : KEYS.length > 1 || stateKeys.length > 0 || classKeys.length > 0 ? ["fed", ...stateKeys.map(k => "fed:" + k), ...classKeys.map(k => "fedcl:" + k), ...(KEYS.length > 1 ? KEYS.filter(k => k !== "fed") : [])] : [];
  React.useEffect(() => {
    if (primMode && (badClass || lcView || !fedView && !steView)) setView("fed");
    if (!primMode && steView) setView("fed");
    if (twoMode && (badClass || lcView && house !== "sen" || !fedView && !lcView)) setView("fed");
    if (twoMode && house === "sen" && !TP_SEN) setHouse("rep");
    if (infMode && (badClass || lcView || steView || !fedView)) setView("fed");
    if (infMode && house === "sen" && !IH_SEN) setHouse("rep");
  }, [primMode, twoMode, infMode, badClass, lcView, fedView, steView, house]);
  const onConPair = pair === "on" || pair === "con";
  const menuShow = figView ? VIEW_OPTS.length > 0 : onConPair && house !== "sen" ? false : house === "sen" ? VIEW_OPTS.length > (onConPair ? 0 : 1) : VIEW_OPTS.length > 0;
  const menuKeys = primMode ? Object.keys(PH_HIST.fed && PH_HIST.fed.states || {}) : twoMode ? house === "sen" ? lcView ? [] : tpSenStateKeys : Object.keys(TP_HIST.fed && TP_HIST.fed.states || {}) : infMode ? house === "sen" ? Object.keys(IH_SEN && IH_SEN.states || {}) : Object.keys(IH_HIST.fed && IH_HIST.fed.states || {}) : house === "sen" ? pair === "on" ? senOnStateKeys : pair === "con" ? senConStateKeys : senStateKeys : stateKeys;
  const menuBank = primMode ? PH_HIST.fed && PH_HIST.fed.states || {} : twoMode ? house === "sen" ? lcView ? {} : TP_SEN.states || {} : TP_HIST.fed && TP_HIST.fed.states || {} : infMode ? house === "sen" ? IH_SEN && IH_SEN.states || {} : IH_HIST.fed && IH_HIST.fed.states || {} : house === "sen" ? pair === "on" ? ON_SEN_STATES : pair === "con" ? CON_SEN_STATES : SEN_STATES : FED_STATES;
  const lcBank = pair === "on" ? LC_ON_BANK : pair === "con" ? LC_CON_BANK : LC_BANK;
  const menuClassKeys = figView ? Object.keys(classBank) : house === "sen" ? [] : classKeys;
  const menuClassSeat = menuClassKeys.filter(k => !classBank[k].seifa);
  const menuClassIrsad = menuClassKeys.filter(k => classBank[k].ix === "irsad");
  const menuClassIeo = menuClassKeys.filter(k => classBank[k].ix === "ieo");
  const menuClassIer = menuClassKeys.filter(k => classBank[k].ix === "ier");
  const menu = menuShow ? React.createElement("select", {
    className: "rd-pv-sel ex-fl-sel",
    "aria-label": "Elections",
    value: lcView && !senOnView ? "nswlc" : steLcView ? "ste:" + steLcKey + "lc" : steKey ? "ste:" + steKey : stateKey ? "fed:" + stateKey : classKey && house !== "sen" ? "fedcl:" + classKey : jur,
    onChange: e => setView(e.target.value)
  }, React.createElement("optgroup", {
    label: "Federal elections"
  }, React.createElement("option", {
    value: "fed"
  }, "Federal, national"), menuKeys.map(k => React.createElement("option", {
    key: k,
    value: "fed:" + k
  }, "Federal, " + (menuBank[k].short || menuBank[k].label))), menuClassSeat.map(k => React.createElement("option", {
    key: "fedcl:" + k,
    value: "fedcl:" + k
  }, "Federal, " + (classBank[k].short || classBank[k].label)))), menuClassIrsad.length > 0 && React.createElement("optgroup", {
    label: "Federal, by IRSAD quintile"
  }, menuClassIrsad.map(k => React.createElement("option", {
    key: "fedcl:" + k,
    value: "fedcl:" + k
  }, classBank[k].short || classBank[k].label))), menuClassIeo.length > 0 && React.createElement("optgroup", {
    label: "Federal, by IEO quintile"
  }, menuClassIeo.map(k => React.createElement("option", {
    key: "fedcl:" + k,
    value: "fedcl:" + k
  }, classBank[k].short || classBank[k].label))), menuClassIer.length > 0 && React.createElement("optgroup", {
    label: "Federal, by IER quintile"
  }, menuClassIer.map(k => React.createElement("option", {
    key: "fedcl:" + k,
    value: "fedcl:" + k
  }, classBank[k].short || classBank[k].label))), !figView && house !== "sen" && KEYS.length > 1 && React.createElement("optgroup", {
    label: "State elections"
  }, KEYS.filter(k => k !== "fed").map(k => React.createElement("option", {
    key: k,
    value: k
  }, (FH[k].short || FH[k].label) + " state elections"))), !figView && house === "sen" && lcBank && React.createElement("optgroup", {
    label: "State elections"
  }, React.createElement("option", {
    value: "nswlc"
  }, lcBank.label)), primMode && house !== "sen" && STE_KEYS.length > 0 && React.createElement("optgroup", {
    label: "State elections"
  }, STE_KEYS.map(k => React.createElement("option", {
    key: k,
    value: "ste:" + k
  }, (STATE_PRIM[k].short || STATE_PRIM[k].label) + " state elections"))), primMode && house === "sen" && STE_LC_KEYS.length > 0 && React.createElement("optgroup", {
    label: "State elections"
  }, STE_LC_KEYS.map(k => React.createElement("option", {
    key: k,
    value: "ste:" + k + "lc"
  }, STE_LCS[k].label))), twoMode && house === "sen" && TP_NSWLC && React.createElement("optgroup", {
    label: "State elections"
  }, React.createElement("option", {
    value: "nswlc"
  }, TP_NSWLC.label))) : null;
  const share = React.createElement("span", {
    className: "rd-pl-ctl ex-share"
  }, React.createElement("span", {
    className: "rd-pl-ctl-l"
  }, "Share:"), React.createElement("button", {
    type: "button",
    className: "rd-pl-flip",
    "aria-pressed": inv,
    title: inv ? "Switch to shares preferencing " + shareSideFull + " over " + shareRivalFull : "Switch to shares preferencing " + (pair === "con" ? "One Nation" : rival) + " over " + shareSideFull,
    onClick: () => setInv(!inv)
  }, React.createElement("span", {
    className: "rd-pl-flip-t"
  }, (inv ? rival : shareSide) + "’s"), " ", React.createElement("span", {
    "aria-hidden": "true"
  }, "\u21C4")));
  const share2pp = React.createElement("span", {
    className: "rd-pl-ctl ex-share"
  }, React.createElement("span", {
    className: "rd-pl-ctl-l"
  }, "Share:"), React.createElement("button", {
    type: "button",
    className: "rd-pl-flip",
    "aria-pressed": twoInv,
    title: twoInv ? "Switch to Labor’s two-party share" : "Switch to the Coalition’s two-party share (always 100 minus Labor’s)",
    onClick: () => setTwoInv(!twoInv)
  }, React.createElement("span", {
    className: "rd-pl-flip-t"
  }, (twoInv ? "Coalition" : "Labor") + "’s"), " ", React.createElement("span", {
    "aria-hidden": "true"
  }, "\u21C4")));
  const shareSlot = primMode || infMode ? null : twoMode ? share2pp : share;
  const houseCtl = (twoMode ? !!TP_SEN : infMode ? !!IH_SEN : SEN_BANK && (primMode || pair !== "con")) ? React.createElement("span", {
    className: "rd-pl-ctl ex-house"
  }, React.createElement("span", {
    className: "rd-pl-ctl-l"
  }, "House:"), React.createElement("button", {
    type: "button",
    className: "rd-pl-flip",
    "aria-pressed": house === "sen",
    title: primMode ? house === "sen" ? "Switch to House of Representatives first preferences" : "Switch to Senate first preferences (formal ballots over the whole chamber)" : twoMode ? house === "sen" ? "Switch to House of Representatives two-party shares (official AEC counts)" : "Switch to the implied Senate two-party (the formal above-the-line ballots naming a major that put Labor first - no official count exists)" : infMode ? house === "sen" ? "Switch to House of Representatives informal shares" : "Switch to Senate informal shares (informal ballots over the whole chamber)" : house === "sen" ? "Switch to House of Representatives flows" : "Switch to Senate flows (above-the-line ballots)",
    onClick: flipHouse
  }, React.createElement("span", {
    className: "rd-pl-flip-t"
  }, house === "sen" ? "Upper" : "Lower"), " ", React.createElement("span", {
    "aria-hidden": "true"
  }, "\u21C4"))) : null;
  const phViewOk = !!(PH_HIST && PH_HIST.fed && PH_HIST.fed.sen);
  const tpViewOk = !!(TP_HIST && TP_HIST.fed && TP_HIST.fed.states && TP_HIST.fed.classes);
  const infViewOk = !!(IH_HIST && IH_HIST.fed && IH_HIST.fed.sen && IH_HIST.fed.classes);
  const FIG_LABELS = {
    flows: "Preference flows",
    primary: "Primary votes",
    "2pp": "2PP",
    informal: "Informal votes"
  };
  const FIG_TITLES = {
    flows: "Switch to the preference-flow history",
    primary: "Switch to first-preference vote shares at every election",
    "2pp": "Switch to two-party preferred shares at every election",
    informal: "Switch to informal ballots’ share of the vote at every election"
  };
  const FIG_STOPS = ["flows", ...(phViewOk ? ["primary"] : []), ...(tpViewOk ? ["2pp"] : []), ...(infViewOk ? ["informal"] : [])];
  const nextFig = FIG_STOPS[(FIG_STOPS.indexOf(figMode) + 1) % FIG_STOPS.length];
  const viewCtl = FIG_STOPS.length > 1 ? React.createElement("span", {
    className: "rd-pl-ctl ex-view"
  }, React.createElement("span", {
    className: "rd-pl-ctl-l"
  }, "View:"), React.createElement("button", {
    type: "button",
    className: "rd-pl-flip",
    title: FIG_TITLES[nextFig],
    onClick: () => setFig(nextFig)
  }, React.createElement("span", {
    className: "rd-pl-flip-t"
  }, FIG_LABELS[figMode]), " ", React.createElement("span", {
    "aria-hidden": "true"
  }, "\u21C4"))) : null;
  const headCtls = narrow ? React.createElement("span", {
    className: "ex-fl-ctls"
  }, menu, React.createElement("span", {
    className: "ex-fl-flips"
  }, houseCtl, shareSlot)) : menu;
  return React.createElement("section", {
    ref: secRef,
    className: "rd-sec rd-explained",
    id: "flows-explained",
    "aria-labelledby": "rd-ex-t"
  }, React.createElement("div", {
    className: "rd-eyebrow"
  }, React.createElement("h2", {
    className: "rd-title",
    id: "rd-ex-t"
  }, "Preference flows explained"), React.createElement("span", {
    className: "rd-meta"
  }, "How preferences decide the two-party figure")), React.createElement(RdHed, {
    head: window.AP.PAGE_HEAD["flows-explained"],
    dek: "The pollster can ask respondents which of the final two they would rank higher, or apply its own assumptions, and publish the result. Or the poll\u2019s first preferences can be run through one fixed table of preference flows, the same for every pollster. That implied figure is the default here: it moves only when voters do, never with a pollster\u2019s change of method, and at past elections it has had the better record. Below: how each works, why the implied figure leads, and where the table\u2019s numbers come from."
  }), React.createElement("div", {
    className: "ex-body",
    dangerouslySetInnerHTML: {
      __html: window.EXPLAINED_ARTICLE || ""
    }
  }), React.createElement("div", {
    ref: ref
  }, React.createElement("div", {
    className: "card rd-card ex-fl-card",
    ref: cardMark,
    "data-rd-swipe-exact": ""
  }, figView ? viewCtl ? React.createElement("div", {
    className: "ex-fl-viewrow ex-fl-vacate",
    "aria-hidden": "true"
  }, viewCtl) : null : viewCtl ? React.createElement("div", {
    className: "ex-fl-viewrow"
  }, viewCtl) : null, figView ? viewCtl ? React.createElement("div", {
    className: "ex-fl-viewrow ex-fl-tabslot"
  }, viewCtl, narrow || !houseCtl && !shareSlot ? null : React.createElement("span", {
    className: "ex-fl-flips ex-fl-vstack"
  }, houseCtl, shareSlot)) : null : React.createElement(RdTabs, {
    value: pair,
    onChange: onPairPick,
    ariaLabel: "Contest",
    className: "ex-fl-tabs",
    options: EX_PAIRS.map(p => ({
      id: p.id,
      label: narrow ? p.short : p.label
    }))
  }, narrow || !houseCtl && !shareSlot ? null : React.createElement("span", {
    className: "ex-fl-vstack"
  }, houseCtl, shareSlot)), infMode ? React.createElement(ExplainedInformalChart, {
    house: house,
    stateKey: stateKey,
    classKey: classKey,
    menu: headCtls
  }) : twoMode ? React.createElement(Explained2ppChart, {
    house: house,
    stateKey: stateKey,
    classKey: classKey,
    inv: twoInv,
    menu: headCtls,
    lc: lcView
  }) : primMode ? React.createElement(ExplainedPrimaryChart, {
    house: house,
    stateKey: stateKey,
    classKey: classKey,
    statePrim: stePrim,
    lcKey: steLcKey,
    menu: headCtls
  }) : lcView && pair === "on" ? React.createElement(ExplainedFlowChart, {
    jur: "nsw",
    house: "sen",
    stateKey: null,
    classKey: null,
    lc: true,
    inv: inv,
    menu: headCtls,
    onSen: true
  }) : lcView && pair === "con" ? React.createElement(ExplainedFlowChart, {
    jur: "nsw",
    house: "sen",
    stateKey: null,
    classKey: null,
    lc: true,
    inv: inv,
    menu: headCtls,
    onCon: true
  }) : senOnView ? React.createElement(ExplainedFlowChart, {
    jur: "fed",
    house: "sen",
    stateKey: stateKey && hasOnCells(stateKey) ? stateKey : null,
    classKey: null,
    lc: false,
    inv: inv,
    menu: headCtls,
    onSen: true
  }) : senConView ? React.createElement(ExplainedFlowChart, {
    jur: "fed",
    house: "sen",
    stateKey: stateKey && hasConCells(stateKey) ? stateKey : null,
    classKey: null,
    lc: false,
    inv: inv,
    menu: headCtls,
    onCon: true
  }) : pair === "on" ? React.createElement(ExplainedOnChart, {
    inv: inv,
    menu: headCtls
  }) : pair === "con" ? null : React.createElement(ExplainedFlowChart, {
    jur: jur,
    house: house,
    stateKey: stateKey,
    classKey: house === "sen" ? null : classKey,
    lc: lcView,
    inv: inv,
    menu: headCtls
  }))));
}
const RdDisagreeM = React.memo(RdDisagree);
const RdHouseLeanM = React.memo(RdHouseLean);
const RdFlowsM = React.memo(RdFlows);
const RdExplainedM = React.memo(RdExplained);
Object.assign(window, {
  RdLedger,
  RdAllPolls,
  RdApDetail,
  RdApSheet,
  rdPollMargin,
  RdDisagree: RdDisagreeM,
  RdHouseLean: RdHouseLeanM,
  RdFlows: RdFlowsM,
  RdExplained: RdExplainedM
});