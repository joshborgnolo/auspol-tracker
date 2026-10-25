const RD_CYC_TITLE = {
  tpp: "The government’s two-party share, %, by months since its election",
  primary: "Government’s primary vote, %",
  oppr: "Opposition’s primary vote, %",
  net: "Prime minister’s net approval: approve minus disapprove, points",
  pmlead: "Prime minister’s net approval lead: approval minus the strongest rival’s, points",
  ppmm: "PM’s lead, points",
  oppnet: "Net approval, points"
};
const RD_CYC_COPY = {
  tpp: "Government’s two-party-preferred vote",
  primary: "Government’s primary vote",
  oppr: "Opposition’s primary vote",
  net: "Prime minister’s net approval",
  pmlead: "Prime minister’s net approval lead",
  ppmm: "Prime minister’s lead as preferred PM",
  oppnet: "Opposition leader’s net approval"
};
const RD_CYC_UNIT = {
  net: "Points, approve minus disapprove.",
  oppnet: "Points, approve minus disapprove.",
  pmlead: "Points, the prime minister’s net approval minus the higher of the opposition leader’s and Pauline Hanson’s.",
  ppmm: "Points, the prime minister’s share minus the rival’s."
};
const RD_CYC_TITLE_CHG = {
  tpp: "The government’s two-party share, change since its election, points",
  primary: "Government’s primary vote, change since the election",
  oppr: "Opposition’s primary vote, change since the election",
  net: "Prime minister’s net approval, change since the first reading",
  pmlead: "Prime minister’s net approval lead, change since the first reading",
  ppmm: "PM’s lead, change since the first reading",
  oppnet: "Opposition leader’s net approval, change since the first reading"
};
function rdUseOutgoing(k, value, ms = (window.AP && window.AP.MORPH_MS || 320) + 40) {
  const cur = React.useRef({
      k,
      value
    }),
    out = React.useRef(null),
    timer = React.useRef(0);
  const [, force] = React.useReducer(x => x + 1, 0);
  if (cur.current.k !== k) {
    const still = window.AP && window.AP.reduceMotion && window.AP.reduceMotion();
    out.current = still ? null : {
      k: cur.current.k,
      value: cur.current.value,
      id: (out.current ? out.current.id : 0) + 1
    };
  }
  cur.current = {
    k,
    value
  };
  React.useEffect(() => {
    const o = out.current;
    if (!o || o.timed) return;
    o.timed = true;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (out.current === o) {
        out.current = null;
        force();
      }
    }, ms);
  });
  React.useEffect(() => () => clearTimeout(timer.current), []);
  return out.current;
}
const rdOrd = n => n + (n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th");
const rdSgn = (v, unit) => (unit ? "" : v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(1);
const RD_CYC_LEAD = "0.5 4";
function RdCycleChart({
  M,
  chg,
  built,
  bandAreas,
  bandRows,
  scatter,
  events: evIn,
  badged,
  domain,
  ticks,
  cur,
  hidden,
  liftedN,
  narrow,
  half,
  hanCtl,
  showHan,
  setHan,
  showOnp,
  setOnp,
  showComb,
  setComb,
  tipCycle,
  banded,
  bandN,
  isOpp,
  terms,
  outcomeShown,
  rings,
  evtOut,
  onEvtOut
}) {
  const {
    D
  } = window.AP;
  const events = evIn.map(e => /^Now v /.test(e.short || "") ? {
    ...e,
    short: e.short.replace(/^Now /, "") + " from " + D.monthNameFull(Number(e.date.slice(5, 7)))
  } : e);
  const nowM = cur && !hidden.has(cur.year) ? cur.span : null;
  const curVal = nowM != null ? chg ? cur.end[M.key] - cycBase(cur, M.key) : cur.end[M.key] : null;
  const nonDefault = (liftedN || 0) > 0 || (cur ? hidden.has(cur.year) : false);
  const peer = nowM != null ? bandRows.find(r => r.m === nowM) : null;
  const subj = M.key === "net" || M.key === "ppmm" || M.key === "pmlead" ? sitting(cur ? cur.pm : "") : M.key === "oppnet" ? sitting(cur ? cur.oppLead : "") : cur ? isOpp ? D.PARTIES[cur.opp].name : D.PARTIES[cur.gov].name : "";
  const subjColor = cur ? isOpp ? D.PARTIES[cur.opp].color : cur.color : "var(--ink)";
  const fmt = v => M.unit === "%" && !chg ? v.toFixed(1) : rdSgn(v, false);
  const series = built.map(s => {
    if (s.id === "cyc-band-mean") return {
      ...s,
      label: "Past-term average",
      dash: "4 3",
      rdWidth: 1.5,
      endLabel: "Average",
      endLabelOpacity: 1
    };
    if (s.lead) return {
      ...s,
      dash: RD_CYC_LEAD
    };
    if (s.tail) return {
      ...s,
      dash: RD_CYC_LEAD
    };
    if (s.current) return {
      ...s,
      rdWidth: 3,
      rdCap: 4,
      endLabel: null
    };
    if (s.id === "cyc-onp" || s.id === "cyc-comb" || s.id === "cyc-han") return {
      ...s,
      smooth: undefined,
      dash: null,
      dashed: false,
      rdWidth: 2,
      endLabel: null,
      opacity: s.opacity != null && s.opacity < 0.5 ? s.opacity : 1
    };
    if (s.endLabel && s.label) return {
      ...s,
      rdWidth: s.width >= 3 ? 2.2 : 1.4,
      endLabel: half ? null : s.label.replace(", ", " ")
    };
    return s;
  });
  const refY0 = chg ? 0 : M.refAbs;
  const fit = (() => {
    const vals = [];
    (banded ? bandRows : []).forEach(r => vals.push(r.p10, r.p90));
    series.forEach(s => s.points.forEach(q => {
      if (q.y != null) vals.push(q.y);
    }));
    scatter.forEach(q => vals.push(q.y));
    if (refY0 != null) vals.push(refY0);
    if (!vals.length) return {
      domain,
      ticks
    };
    const mn = Math.min(...vals),
      mx = Math.max(...vals);
    let step = M.step,
      lo,
      hi;
    for (;;) {
      lo = Math.floor((mn + step * 0.05) / step) * step;
      hi = Math.ceil((mx - step * 0.05) / step) * step;
      if (hi - lo >= step && (hi - lo) / step <= 6) break;
      if ((hi - lo) / step > 6) step *= 2;else break;
    }
    return {
      domain: [lo, hi],
      ticks: rdYTicks(lo, hi, step)
    };
  })();
  domain = fit.domain;
  ticks = fit.ticks;
  const d = peer && curVal != null ? curVal - peer.mean : null;
  const notes = [];
  if (peer && curVal != null) {
    const frac = (curVal - domain[0]) / (domain[1] - domain[0]);
    const dys = frac < 0.22 ? [-24, -8] : frac > 0.82 ? [16, 32] : [-6, 10];
    notes.push({
      k: "cur",
      x: nowM,
      y: curVal,
      dx: 10,
      dy: dys[0],
      text: subj + " " + fmt(curVal),
      color: inkOf(subjColor),
      weight: 600,
      size: 12.5
    });
    if (!nonDefault) notes.push({
      k: "gap",
      x: nowM,
      y: curVal,
      dx: 10,
      dy: dys[1],
      text: Math.abs(d).toFixed(1) + (d >= 0 ? " above" : " below") + " average",
      size: 12.5
    });
  }
  const plotH = (narrow ? 260 : half ? 290 : 330) - 80;
  const pxOf = v => (v - domain[0]) / (domain[1] - domain[0]) * plotH;
  series.filter(s => (s.id === "cyc-onp" || s.id === "cyc-comb" || s.id === "cyc-han") && s.points.length && !(s.opacity < 0.5)).forEach(s => {
    const last = s.points[s.points.length - 1];
    const taken = peer && curVal != null ? notes.slice(0, 2).map(n => pxOf(last.y) - pxOf(curVal) + n.dy) : [];
    const dy = [4, -8, 16, -20, 28, -32, 40].find(c => taken.every(t => Math.abs(c - t) >= 15)) ?? 4;
    notes.push({
      k: s.id,
      x: last.x,
      y: last.y,
      dx: 10,
      dy,
      text: (s.id === "cyc-comb" ? "L/NP + ON " : s.id === "cyc-onp" ? "One Nation " : "Hanson ") + fmt(last.y),
      color: inkOf(s.color),
      weight: 600,
      size: 12.5
    });
  });
  if (!chg && M.key === "tpp" && !nonDefault) {
    notes.push({
      x: "left",
      y: 50,
      dy: -6,
      text: "▲ Government ahead",
      size: 11.5
    });
    notes.push({
      x: "left",
      y: 50,
      dy: 15,
      text: "▼ Opposition ahead",
      size: 11.5
    });
  }
  const marks = [];
  if (peer && curVal != null) marks.push({
    k: "mean",
    x: nowM,
    y: peer.mean,
    r: 3.5,
    color: "var(--ink-2)"
  });
  if (rings) rings.forEach(rt => {
    const op = (chg ? 0 : 1) * rt.opacity;
    if (rt.base != null) marks.push({
      k: "base-" + rt.yr,
      x: 0,
      y: chg ? 0 : rt.base,
      r: 5,
      color: rt.color,
      opacity: op
    });
    const cv = rt.close && rt.close[M.key];
    if (cv != null) marks.push({
      k: "close-" + rt.yr,
      x: rt.close.x,
      y: chg ? cv - rt.base : cv,
      r: 5,
      color: rt.color,
      opacity: op
    });
  });
  const brackets = peer && curVal != null && Math.abs(d) >= 0.3 ? [{
    x: nowM,
    y0: curVal,
    y1: peer.mean,
    dx: 5,
    lines: []
  }] : [];
  const refY = chg ? 0 : M.refAbs;
  const refLines = refY != null ? [{
    y: refY,
    color: "var(--ink-faint)"
  }] : [];
  const zeroWord = chg ? M.key === "tpp" || M.key === "primary" || M.key === "oppr" ? "Result" : "First" : M.key === "ppmm" ? "Tied" : "Even";
  const top = domain[1];
  const yTickFmt = v => refY != null && Math.abs(v - refY) < 1e-9 && (chg || M.refAbs === 0) ? zeroWord : M.unit === "%" && !chg ? v === ticks[ticks.length - 1] ? v + "%" : String(v) : v > 0 ? "+" + v : v < 0 ? "−" + Math.abs(v) : "0";
  const yr = narrow || half ? ["1 yr", "2 yrs", "3 yrs"] : ["1 year", "2 years", "3 years"];
  const xTicks = [{
    x: 0,
    label: "Election",
    strong: true
  }, {
    x: 12,
    label: yr[0]
  }, {
    x: 24,
    label: yr[1]
  }, {
    x: 36,
    label: yr[2]
  }].filter(t => nowM == null || Math.abs(t.x - nowM) > 2.5).concat(nowM != null ? [{
    x: nowM,
    label: "Now",
    strong: true
  }] : []).sort((a, b) => a.x - b.x);
  const badges = badged ? {
    events,
    list: null
  } : narrow ? rdEventBadges("cy", events.filter(e => e.date), -2, 38) : null;
  const [evtHeld, setEvtHeld] = useState(null);
  const ctlOut = typeof onEvtOut === "function";
  const evt = ctlOut ? evtOut : evtHeld,
    setEvt = ctlOut ? onEvtOut : setEvtHeld;
  const pickEv = e => {
    setEvt(cur => cur && cur.e === e ? cur : {
      e
    });
    rdEventReveal("evt-a-" + e.badgeKey);
  };
  const tickSet = ticks.slice();
  if (!tickSet.includes(domain[0])) tickSet.unshift(domain[0]);
  if (!tickSet.includes(domain[1])) tickSet.push(domain[1]);
  const title = (chg ? RD_CYC_TITLE_CHG : RD_CYC_TITLE)[M.key];
  const viewKey = (chg ? "c" : "a") + "|" + [...hidden].sort().join(",") + "|" + (showOnp ? 1 : 0) + (showComb ? 1 : 0) + (showHan ? 1 : 0);
  const cardRef = React.useRef(null);
  const clk = window.AP.useKeyClock(viewKey, cardRef);
  const shownScene = React.useRef(null),
    fromScene = React.useRef(null);
  const now = {
    series,
    areas: bandAreas || [],
    scatter,
    domain,
    ticks: tickSet,
    fmt: yTickFmt,
    refLines,
    notes,
    brackets,
    marks
  };
  if (clk && (!fromScene.current || fromScene.current.n !== clk.n)) fromScene.current = {
    n: clk.n,
    scene: shownScene.current
  };
  if (!clk) fromScene.current = null;
  const was = clk && fromScene.current && fromScene.current.scene;
  const drawn = was ? window.AP.blendScene(was, now, clk.t, d => (d.meta ? (d.meta.pollster || "") + "|" + (d.meta.released || d.meta.date || "") : "") + "|" + d.label + "|" + d.x) : null;
  const glide = (a, b, t) => ({
    ...b,
    y: a.y + (b.y - a.y) * t,
    dy: (a.dy || 0) + ((b.dy || 0) - (a.dy || 0)) * t
  });
  let notesNow = notes,
    notesWas = was ? was.notes : null,
    marksNow = marks,
    bracketsNow = brackets,
    bracketsWas = was ? was.brackets : null;
  if (was) {
    const t = clk.t;
    const wk = new Map(was.notes.filter(n => n.k).map(n => [n.k, n])),
      nk = new Map(notes.filter(n => n.k).map(n => [n.k, n]));
    notesNow = notes.map(n => n.k && wk.has(n.k) ? glide(wk.get(n.k), n, t) : n);
    notesWas = was.notes.map(n => n.k && nk.has(n.k) ? {
      ...glide(n, nk.get(n.k), t),
      text: n.text,
      color: n.color,
      weight: n.weight
    } : n);
    const mk = new Map((was.marks || []).filter(q => q.k).map(q => [q.k, q])),
      mn = new Set(marks.map(q => q.k));
    const opOf = q => q.opacity != null ? q.opacity : 1;
    marksNow = marks.map(q => q.k && mk.has(q.k) ? {
      ...q,
      y: mk.get(q.k).y + (q.y - mk.get(q.k).y) * t,
      opacity: opOf(mk.get(q.k)) + (opOf(q) - opOf(mk.get(q.k))) * t
    } : {
      ...q,
      opacity: opOf(q) * t
    }).concat((was.marks || []).filter(q => !mn.has(q.k)).map(q => ({
      ...q,
      opacity: opOf(q) * (1 - t)
    })));
    const b0 = was.brackets && was.brackets[0],
      b1 = brackets[0];
    if (b0 && b1) {
      bracketsNow = [{
        ...b1,
        y0: b0.y0 + (b1.y0 - b0.y0) * t,
        y1: b0.y1 + (b1.y1 - b0.y1) * t
      }];
      bracketsWas = bracketsNow;
    }
  }
  shownScene.current = drawn ? {
    ...now,
    series: drawn.series,
    areas: drawn.areas,
    scatter: drawn.scatter.concat(drawn.scatterMove),
    domain: drawn.domain,
    notes: notesNow,
    marks: marksNow,
    brackets: bracketsNow
  } : now;
  const copyTitle = (RD_CYC_COPY[M.key] || title) + (chg ? ": change since " + (M.key === "tpp" || M.key === "primary" || M.key === "oppr" ? "the election" : "the first reading") : " through each term");
  const copySub = "This term set against " + (banded ? "the middle half and middle 80% of " + bandN + " past terms" + (outcomeShown === "returned" ? " whose government was re-elected" : outcomeShown === "ousted" ? " whose government was ousted" : "") : "past terms") + " at the same point, month by month from each election. " + (M.unit === "%" && !chg ? "Per cent of the vote." : RD_CYC_UNIT[M.key] || "Points.");
  return React.createElement("div", {
    className: "card rd-card rd-cyc-chart",
    ref: cardRef
  }, React.createElement("div", {
    className: "rd-chead"
  }, React.createElement("span", {
    className: "rd-chead-t"
  }, title), M.onp && React.createElement("span", {
    className: "rd-cyc-ctls"
  }, React.createElement(RdCheck, {
    checked: showComb,
    onChange: setComb
  }, "Combine L/NP and ON"), React.createElement(RdCheck, {
    checked: showOnp,
    onChange: setOnp
  }, "One Nation this term")), hanCtl && React.createElement(RdCheck, {
    checked: showHan,
    onChange: setHan
  }, "Pauline Hanson this term")), React.createElement(TrendChart, {
    key: "rd-cyc-" + M.key,
    heightPx: narrow ? 260 : half ? 290 : 330,
    padPx: narrow ? {
      l: 34,
      r: 8,
      t: badges ? 34 : 40,
      b: 28
    } : {
      l: 40,
      r: half ? 12 : 16,
      t: badges ? 36 : 56,
      b: 30
    },
    xDomain: CYC_XDOMAIN,
    yDomain: drawn ? drawn.domain : domain,
    yTicks: tickSet,
    yTickFmt: yTickFmt,
    xTicks: xTicks,
    baseline: true,
    refLines: refLines,
    vlines: nowM != null ? [{
      x: nowM
    }] : [],
    series: drawn ? drawn.series : series,
    spine: CYC_SPINE,
    scatter: drawn ? drawn.scatter : scatter,
    scatterOut: drawn ? drawn.scatterOut : [],
    scatterMove: drawn ? drawn.scatterMove : [],
    fade: drawn ? clk.t : 1,
    areas: drawn ? drawn.areas : bandAreas || undefined,
    morphFrom: was ? {
      yTicks: was.ticks,
      yTickFmt: was.fmt,
      refLines: was.refLines,
      notes: notesWas,
      brackets: bracketsWas
    } : null,
    morphT: clk ? clk.t : 1,
    events: badges ? badges.events : events,
    evt: badged || badges ? evt : null,
    onEvt: badged || badges ? setEvt : null,
    notes: notesNow,
    marks: marksNow,
    brackets: bracketsNow,
    tooltipTitle: i => cycMonthLabel(CYC_SPINE[i].x) + (tipCycle ? " – " + cycMonthOf(tipCycle.eDate, CYC_SPINE[i].x) : ""),
    extraRows: i => {
      const r = bandRows.find(b => b.m === CYC_SPINE[i].x);
      return r && banded ? [{
        label: "Middle half",
        value: fmt(r.q1) + "–" + fmt(r.q3)
      }, {
        label: "Middle 80%",
        value: fmt(r.p10) + "–" + fmt(r.p90)
      }] : [];
    },
    fmt: v => fmt(v),
    pollFacet: M.key === "tpp" ? "twopp" : M.key === "primary" || M.key === "oppr" ? "primary" : "leadership",
    copy: {
      title: copyTitle,
      sub: copySub,
      terms
    }
  }), badges && badges.list && React.createElement(RdEventList, {
    list: badges.list,
    onPick: pickEv,
    openKey: evt && evt.e ? evt.e.badgeKey : null
  }));
}
const rdOnpUnsplit = c => !(c.raw.onp || []).some(v => v != null);
const combSeries = c => {
  const nil = rdOnpUnsplit(c);
  return c.raw.months.map((_, i) => {
    const on = nil ? 0 : (c.raw.onp || [])[i];
    return c.opp === "lnp" && c.raw.oppr[i] != null && on != null ? +(c.raw.oppr[i] + on).toFixed(2) : null;
  });
};
const seriesOf = (c, key) => key === "comb" ? combSeries(c) : c.raw[key] || [];
const cycBaseOf = (c, key) => key === "comb" ? cycBase(c, "oppr") + cycBase(c, "onp") : cycBase(c, key);
function rdCycPeers(M, cycles, hidden, chg, m) {
  const hasData = c => seriesOf(c, M.key).some(v => v != null);
  const vals = [];
  cycles.filter(c => !c.current && !hidden.has(c.year) && hasData(c)).forEach(c => {
    const p = toMonthly(c.raw.months, seriesOf(c, M.key), c.span)[m];
    if (!p || p.y == null) return;
    vals.push({
      v: chg ? +(p.y - cycBaseOf(c, M.key)).toFixed(2) : p.y,
      who: cycHolderAt(c, M, m),
      yr: c.year,
      c
    });
  });
  if (!vals.length) return null;
  vals.sort((a, b) => a.v - b.v);
  const nums = vals.map(p => p.v);
  return {
    vals,
    n: nums.length,
    mean: nums.reduce((s, v) => s + v, 0) / nums.length,
    q1: pctOf(nums, 0.25),
    q3: pctOf(nums, 0.75),
    p10: pctOf(nums, 0.1),
    p90: pctOf(nums, 0.9)
  };
}
const rdCycHolderTag = (peers, p) => peers.vals.some(q => q !== p && q.who === p.who) ? p.who + " (" + p.yr + ")" : p.who;
function rdCycRank(peers, v, fmt) {
  const above = peers.vals.filter(p => p.v > v).length,
    below = peers.vals.filter(p => p.v < v).length;
  const n = peers.n + 1;
  const hiR = above + 1,
    loR = below + 1;
  const top = peers.vals[peers.vals.length - 1],
    low = peers.vals[0];
  if (hiR === 1) return {
    main: "Highest of " + n,
    sub: "Previous high: " + rdCycHolderTag(peers, top) + ", " + fmt(top.v),
    strong: true
  };
  if (loR === 1) return {
    main: "Lowest of " + n,
    sub: "Previous low: " + rdCycHolderTag(peers, low) + ", " + fmt(low.v),
    strong: true
  };
  if (above === below) return {
    main: "Middle of " + n
  };
  if (hiR < loR) return {
    main: rdOrd(hiR) + " highest of " + n,
    sub: hiR === 2 ? "Only " + rdCycHolderTag(peers, top) + " was higher" : null
  };
  return {
    main: rdOrd(loR) + " lowest of " + n,
    sub: loR === 2 ? "Only " + rdCycHolderTag(peers, low) + " was lower" : null
  };
}
const RD_CSL_ROW = 26,
  RD_CSL_ROW_PHONE = 30;
const rdCycWhen = (c, m) => {
  const [y, mo] = c.eDate.split("-").map(Number);
  const t = mo - 1 + Math.max(0, m);
  return window.AP.D.monthName(t % 12 + 1) + " " + (y + Math.floor(t / 12));
};
function rdCycPolled(c, key, i) {
  const o = c.raw.obs || {};
  if (key === "comb") return !!(o.oppr || [])[i] && (rdOnpUnsplit(c) || c.raw.onp[i] != null && (!!(o.onp || [])[i] || c.raw.onp[i] === 0));
  if (!o[key]) return seriesOf(c, key)[i] != null;
  return !!o[key][i];
}
function rdCycRecords(cycles, hidden, chg, spec) {
  const {
    M,
    key,
    curKey,
    whoOf,
    people,
    positive
  } = spec;
  const all = [];
  cycles.forEach(c => {
    if (!c.current && hidden.has(c.year)) return;
    const k = c.current ? curKey : key;
    const vals = seriesOf(c, k);
    if (!vals.some(v => v != null)) return;
    const base = cycBaseOf(c, k);
    const by = new Map();
    c.raw.months.forEach((mo, i) => {
      if (mo <= 0 || vals[i] == null || !rdCycPolled(c, k, i)) return;
      if (positive && !(vals[i] > 0)) return;
      const who = whoOf && whoOf(c) || cycHolderAt(c, M, mo);
      const v = chg ? +(vals[i] - base).toFixed(2) : vals[i];
      const g = people ? who : "";
      let e = by.get(g);
      if (!e) by.set(g, e = {
        lo: null,
        hi: null
      });
      const at = {
        v,
        m: mo,
        who,
        yr: c.year,
        c,
        cur: !!c.current
      };
      if (!e.lo || v < e.lo.v) e.lo = at;
      if (!e.hi || v > e.hi.v) e.hi = at;
    });
    by.forEach(e => all.push(e));
  });
  if (!all.length) return null;
  return {
    lows: all.map(e => e.lo).sort((a, b) => a.v - b.v || a.yr - b.yr),
    highs: all.map(e => e.hi).sort((a, b) => b.v - a.v || a.yr - b.yr)
  };
}
const rdCycEndLeader = (c, opp) => {
  const own = sitting(String(opp ? c.oppLead : c.pm));
  const other = String(opp ? c.pm : c.oppLead).split(/\s*\u2192\s*/);
  return other.slice(0, -1).includes(own) ? sitting(String(opp ? c.pm : c.oppLead)) : own;
};
function RdCsUnroll({
  className,
  style,
  children
}) {
  const [fresh, setFresh] = useState(true);
  React.useEffect(() => {
    const t = setTimeout(() => setFresh(false), 900);
    return () => clearTimeout(t);
  }, []);
  return React.createElement("div", {
    className: className + (fresh ? " unroll" : ""),
    style: style
  }, children);
}
const RD_CYC_CITES = [["https://kevinbonham.blogspot.com/2012/12/why-preferred-prime-ministerpremier.html", "Kevin Bonham: Why preferred prime minister/premier scores are rubbish"], ["https://www.theguardian.com/australia-news/2016/apr/07/personal-popularity-is-no-guarantee-of-poll-success-for-prime-ministers", "Ben Raue, the Guardian: Personal popularity is no guarantee of poll success for prime ministers"], ["https://web.archive.org/web/20211016043201/https://armariuminterreta.com/2021/08/23/approval-ratings-and-better-pm/", "Armarium Interreta: Approval ratings are rubbish, but they have value"]];
const RD_CYC_CITE = (w, i) => RD_CYC_CITES[i][0] ? React.createElement("a", {
  className: "rd-link rd-link-in",
  href: RD_CYC_CITES[i][0],
  target: "_blank",
  rel: "noopener noreferrer",
  title: RD_CYC_CITES[i][1]
}, w) : w;
function RdPastCycles(p) {
  const {
    cycles,
    mode,
    setMode,
    hidden,
    lifted,
    hi,
    setHi,
    toggle,
    lift,
    unlift,
    chipClick,
    showAll,
    hideAll,
    showOutcome,
    outcomeShown,
    shapes,
    showHan,
    setShowHan,
    showOnp,
    setShowOnp,
    showComb,
    setShowComb,
    exportSource,
    srcFailed,
    retrySource
  } = p;
  const {
    D
  } = window.AP;
  const narrow = useNarrow(MQ_PHONE);
  const [board, setBoard] = useState({
    open: false,
    sheet: null
  });
  const [tip, setTip] = useState(null);
  const [openRow, setOpenRow] = useState(null);
  const [lit, setLit] = useState(null);
  const [storyHold, setStoryHold] = useState(0);
  const chipmoveEls = React.useRef([]);
  const chipmoveRef = i => el => {
    if (el) chipmoveEls.current[i] = el;
  };
  React.useLayoutEffect(() => {
    const fitBand = band => {
      const sec = band.closest(".rd-sec");
      const prev = sec && sec.previousElementSibling;
      if (!sec || !prev) return;
      sec.style.removeProperty("--cyc-chip-pad");
      sec.style.removeProperty("padding-top");
      const base = parseFloat(getComputedStyle(sec).paddingTop) || 0;
      const prevBtm = prev.getBoundingClientRect().bottom - (parseFloat(getComputedStyle(prev).paddingBottom) || 0);
      const gap = sec.getBoundingClientRect().top - prevBtm;
      const need = Math.ceil(band.offsetHeight) + 19 - gap;
      if (need > base + 0.5) {
        sec.style.setProperty("--cyc-chip-pad", need + "px");
        sec.style.paddingTop = need + "px";
      }
    };
    const fit = () => chipmoveEls.current.filter(Boolean).forEach(fitBand);
    fit();
    window.addEventListener("resize", fit);
    if (typeof ResizeObserver === "undefined") return () => window.removeEventListener("resize", fit);
    const ro = new ResizeObserver(fit);
    chipmoveEls.current.filter(Boolean).forEach(el => ro.observe(el));
    return () => {
      window.removeEventListener("resize", fit);
      ro.disconnect();
    };
  }, []);
  const boardRef = React.useRef(null);
  const boardPane = board.sheet ? " body" : board.sheet === false ? " sheet" : "";
  React.useLayoutEffect(() => {
    if (board.open && board.sheet == null && window.matchMedia("(min-width: 901px)").matches && boardRef.current) {
      const s = boardRef.current.querySelector(".rd-cc-board");
      if (s) {
        const r = s.getBoundingClientRect();
        if (r.bottom < 0 || r.top > window.innerHeight) setBoard(b => b.open && b.sheet == null ? {
          open: true,
          sheet: true
        } : b);
      }
    }
  });
  window.useDismissOutside(boardRef, board.open, () => setBoard(false), ".rd-cyc-chipmove");
  const pinView = () => {
    const sec = document.getElementById("cyc-summary");
    const row = boardRef.current,
      slot = sec && sec.querySelector(".rd-cyc-storyslot");
    const sb = document.querySelector(".tabs.sticky"),
      sr = sb && sb.getBoundingClientRect();
    const reserve = sr ? Math.min(sr.bottom, sr.height) : 0;
    const rr = row && row.getBoundingClientRect();
    if (rr && rr.bottom >= reserve && rr.top <= window.innerHeight) {
      setStoryHold(0);
      rdPinScroll([row], true);
      return;
    }
    if (slot) setStoryHold(slot.getBoundingClientRect().height);
    const strip = sec && [...sec.querySelectorAll(".rd-cs-row")].find(el => {
      const r = el.getBoundingClientRect();
      return r.bottom >= 0 && r.top <= window.innerHeight;
    });
    rdPinScroll([boardRef.current, strip, sec && sec.querySelector(".rd-cs-key"), sec && sec.querySelector(".rd-foot")], true);
  };
  const chg = mode === "chg";
  const cur = cycles.find(c => c.current);
  const m = cur ? cur.span : 0;
  const Mby = {};
  CYC_METRICS.forEach(M => {
    Mby[M.key] = M;
  });
  Mby.onp = {
    key: "oppr",
    leader: "opp",
    unit: "%"
  };
  Mby.comb = {
    key: "comb",
    leader: "opp",
    unit: "%"
  };
  Mby.han = {
    key: "oppnet",
    leader: "opp",
    unit: ""
  };
  Mby.ppmh = {
    key: "ppmm",
    leader: "pm",
    unit: ""
  };
  Mby.pmlead = {
    key: "pmlead",
    leader: "pm",
    unit: "",
    step: 10,
    refAbs: 0,
    refAbsLabel: "even",
    sub: "The prime minister’s net approval less his strongest rival’s"
  };
  const endOfKey = (c, key) => key === "comb" ? c.opp === "lnp" && c.end.oppr != null && c.end.onp != null ? +(c.end.oppr + c.end.onp).toFixed(1) : null : c.end[key];
  const curOfS = (key, c2) => {
    const v = endOfKey(cur, key);
    return v == null ? null : c2 ? v - cycBaseOf(cur, key) : v;
  };
  const peersOfS = (key, hid, c2) => rdCycPeers(Mby[key], cycles, hid, c2, m);
  const fmtOfS = (key, c2) => v => Mby[key].unit === "%" && !c2 ? v.toFixed(1) : rdSgn(v, false);
  const curOf = key => curOfS(key, chg);
  const peersOf = key => peersOfS(key, hidden, chg);
  const fmtOf = key => fmtOfS(key, chg);
  const govName = D.PARTIES[cur.gov].name,
    oppName = D.PARTIES[cur.opp].name;
  const govIn = cur.gov === "lnp" ? "the Coalition" : govName,
    oppIn = cur.opp === "lnp" ? "the Coalition" : oppName;
  const pm = sitting(cur.pm),
    oppL = sitting(cur.oppLead);
  const pmRival = cur.end.han != null && (cur.end.oppnet == null || cur.end.han > cur.end.oppnet) ? "Hanson" : oppL;
  const tppEraNow = cur.raw.tppEras ? cur.raw.tppEras[cur.raw.tppEras.length - 1] : null;
  const rivalWord = tppEraNow && tppEraNow.rival === "alp_on" ? "One Nation" : oppName === "Coalition" ? "the Coalition" : oppName;
  const monthsWord = rdCap(rdNumWord(m)) + " months";
  const outcomeOf = i => {
    const nx = cycles[i + 1];
    return nx ? nx.gov === cycles[i].gov ? "returned" : "ousted" : null;
  };
  const nPast = cycles.filter(c => !c.current).length;
  const nRet = cycles.filter((c, i) => outcomeOf(i) === "returned").length,
    nOus = cycles.filter((c, i) => outcomeOf(i) === "ousted").length;
  const compare = hidden.size === 0 ? "all" : outcomeShown || null;
  const setCompare = id => {
    pinView();
    if (id === "all") {
      showAll();
      return;
    }
    const curHidden = cur && hidden.has(cur.year);
    showOutcome(id);
    if (cur && !curHidden) toggle(cur.year);
  };
  const setModePin = id => {
    pinView();
    setMode(id);
  };
  const ROW_DEFS = [{
    key: "tpp",
    name: "Two-party preferred",
    sub: govName + ", against " + rivalWord.replace(/^the /, "the "),
    group: "votes",
    color: cur.color
  }, {
    key: "primary",
    name: "Government’s primary vote",
    sub: govName,
    group: "votes",
    color: cur.color
  }, {
    key: "oppr",
    name: "Opposition’s primary vote",
    sub: rdCap(oppIn),
    group: "votes",
    color: D.PARTIES[cur.opp].color
  }, {
    key: "onp",
    name: "One Nation’s primary vote",
    sub: "Pauline Hanson’s party",
    group: "votes",
    color: D.PARTIES.onp.color
  }, {
    key: "comb",
    name: "L/NP + ON combined primary vote",
    sub: "The Coalition and One Nation, together",
    group: "votes",
    color: "var(--ink-2)"
  }, {
    key: "ppmm",
    name: "Preferred PM vs " + oppL + ", lead",
    sub: pm + " over " + oppL,
    group: "leaders",
    color: cur.color
  }, {
    key: "ppmh",
    name: "Preferred PM vs Hanson, lead",
    sub: pm + " over Hanson",
    group: "leaders",
    color: cur.color
  }, {
    key: "net",
    name: "Prime minister’s net approval",
    sub: pm,
    group: "leaders",
    color: cur.color
  }, {
    key: "oppnet",
    name: "Opposition leader’s net approval",
    sub: oppL,
    group: "leaders",
    color: D.PARTIES[cur.opp].color
  }, {
    key: "han",
    name: "Hanson’s net approval",
    sub: "Pauline Hanson",
    group: "leaders",
    color: D.PARTIES.onp.color
  }, {
    key: "pmlead",
    name: "PM net approval, lead",
    sub: pm + " over " + pmRival,
    group: "leaders",
    color: cur.color
  }];
  const rowsForHidden = (hid, c2) => ROW_DEFS.map(r => {
    const peers = peersOfS(r.key, hid, c2);
    const v = curOfS(r.key, c2);
    const fmt = fmtOfS(r.key, c2);
    return {
      ...r,
      peers,
      v,
      fmt,
      rank: peers && v != null ? rdCycRank(peers, v, fmt) : null
    };
  });
  const ROWS = rowsForHidden(hidden, chg);
  const scaleOf = group => {
    const rs = ROWS.filter(r => r.group === group && r.peers);
    const vals = rs.flatMap(r => r.peers.vals.map(q => q.v).concat(r.v != null ? [r.v] : []));
    const step = group === "votes" && !chg ? 10 : 20;
    return {
      lo: Math.floor(Math.min(...vals) / step) * step,
      hi: Math.ceil(Math.max(...vals) / step) * step,
      step
    };
  };
  const SC = {
    votes: scaleOf("votes"),
    leaders: scaleOf("leaders")
  };
  const X = (sc, v) => (v - sc.lo) / (sc.hi - sc.lo) * 100;
  const tickLab = (group, v) => group === "votes" && !chg ? v === SC.votes.hi ? v + "%" : String(v) : v === 0 ? chg ? "0" : "Even" : v > 0 ? "+" + v : "−" + Math.abs(v);
  const scaleNow = {};
  ["votes", "leaders"].forEach(g => {
    const sc = SC[g];
    scaleNow[g] = {
      key: (chg ? "c" : "a") + sc.lo + "|" + sc.hi + "|" + sc.step,
      ticks: rdYTicks(sc.lo, sc.hi, sc.step).map(v => ({
        v,
        left: X(sc, v),
        lab: tickLab(g, v)
      }))
    };
  });
  const scaleWas = rdUseOutgoing(scaleNow.votes.key + "/" + scaleNow.leaders.key, scaleNow);
  const scaleOut = g => scaleWas && scaleWas.value[g].key !== scaleNow[g].key ? scaleWas : null;
  const dotsNow = {};
  ROWS.forEach(r => {
    dotsNow[r.key] = r.peers ? r.peers.vals.map(q => ({
      yr: q.yr,
      left: X(SC[r.group], q.v)
    })) : [];
  });
  const dotsWas = rdUseOutgoing((chg ? "c" : "a") + "|" + [...hidden].sort().join(","), dotsNow);
  const rowIdx = rows => {
    const o = {};
    rows.forEach(r => {
      o[r.key] = r;
    });
    return o;
  };
  const R = rowIdx(ROWS);
  const pts1 = v => Math.abs(v).toFixed(1);
  const upDown = v => (v < 0 ? "down " : "up ") + pts1(v);
  const tail = compare === "all" ? "" : compare === "returned" ? ", among terms whose government was re-elected" : compare === "ousted" ? ", among terms whose government was ousted" : ", among the terms on the board";
  const storyFor = c2 => {
    const FA = rowIdx(rowsForHidden(new Set(), c2));
    const g = FA.primary,
      o = FA.oppr,
      t = FA.tpp;
    const snc = " since " + cycles[0].year;
    const gLow = g.rank && /^Lowest/.test(g.rank.main),
      oLow = o.rank && /^Lowest/.test(o.rank.main);
    const cb = !c2 && FA.comb.rank && FA.comb.v != null ? FA.comb : null;
    const cbHi = cb ? /^(\d+)(?:st|nd|rd|th) highest/.exec(cb.rank.main) : null;
    const cbOrdW = cbHi ? {
      2: "second",
      3: "third"
    }[+cbHi[1]] : null;
    const combined = cb ? /^Highest/.test(cb.rank.main) ? "the highest" : cbOrdW ? cbOrdW + " highest" : cb.v >= cb.peers.q3 ? "among the highest" : cb.v > cb.peers.q1 ? "in the middle half" : "among the lowest" : null;
    const moved = r => r.v < 0 ? "fallen further" : "risen less";
    const found = c2 ? gLow && oLow ? g.v < 0 && o.v < 0 ? "Both major parties have lost more of their vote than any before them at this point in a term" : "Both major parties have done worse since the election than any before them at this point in a term" : gLow ? govName + "’s primary vote has " + moved(g) + " than any government’s at this point in a term" : oLow ? rdCap(oppIn) + "’s primary vote has " + moved(o) + " than any opposition’s at this point in a term" : t.peers && t.v != null ? govName + "’s two-party vote has done " + (t.v >= t.peers.mean ? "better" : "worse") + " than the average government’s since its election" : null : gLow && oLow ? "Both major parties’ primary votes are at record lows for this point in a term" : gLow ? govName + "’s primary vote is the lowest of any government at this point in a term" : oLow ? rdCap(oppIn) + "’s primary vote is the lowest of any opposition at this point in a term" : t.peers && t.v != null ? govName + " sits " + (t.v >= t.peers.mean ? "above" : "below") + " the average government at this point in a term" : null;
    const head = found || "Every term since " + cycles[0].year + ", lined up on its election day";
    let dek = monthsWord + " after the " + cur.year + " election, ";
    const bits = [];
    const extreme = r => r.v < 0 ? "the biggest fall" : "the smallest rise";
    if (c2) {
      if (gLow) bits.push(govName + "’s primary vote is " + upDown(g.v) + " points, " + extreme(g) + " for any government at that point" + snc);
      if (oLow) bits.push((gLow ? "and " + oppIn + "’s is " : oppIn + "’s primary vote is ") + upDown(o.v) + " points, " + extreme(o) + " for any opposition");
    } else {
      if (gLow) bits.push(govName + "’s primary vote is the lowest of any government at the same point" + snc);
      if (oLow) bits.push(gLow ? "and " + oppIn + "’s is the lowest of any opposition" : oppIn + "’s primary vote is the lowest of any opposition at the same point" + snc);
    }
    const rankWords = r => (/^Middle/.test(r.rank.main) ? "in the " : "the ") + r.rank.main.toLowerCase().replace(/ of (\d+)$/, " of $1 governments");
    dek += bits.length ? bits.join(", ") + "." : g.v == null || !g.rank ? govName + "’s primary vote has no reading to set against past governments yet." : c2 ? govName + "’s primary vote is " + upDown(g.v) + " points since the election; past governments were " + (g.peers.mean < 0 ? "down " : "up ") + pts1(g.peers.mean) + " on average by now." : govName + "’s primary vote is " + rankWords(g) + " at this point.";
    const cbHigh = combined && /highest/.test(combined);
    if (!c2 && oLow && combined) dek += cbHigh ? " Add One Nation’s vote to " + oppIn + "’s, though, and the total is " + (/^(the|among) /.test(combined) ? "" : "the ") + combined + " on record at this stage." : " Even with One Nation’s vote added, " + oppIn + "’s total is " + (/middle/.test(combined) ? "only " : "") + combined + " of past terms.";
    if (t.peers && t.v != null && !c2) {
      const lowT = t.v < t.peers.q1;
      const where = !lowT && t.v <= t.peers.q3 ? "sits in the middle half of past governments at this point" : t.v > t.peers.q3 ? "is higher than three in four past governments managed at this point" : "is lower than three in four past governments managed at this point";
      dek += " " + (gLow && !lowT ? "Even so, after preferences " : "After preferences, ") + govName + "’s " + t.v.toFixed(1) + "% " + where + ".";
    }
    return {
      head,
      dek
    };
  };
  const pageStory = storyFor(chg);
  const outcomePeers = which => {
    const keep = new Set(cycles.filter((c, i) => outcomeOf(i) === which).map(c => c.year));
    const hid = new Set(cycles.filter(c => !keep.has(c.year) && !c.current).map(c => c.year));
    return rdCycPeers(Mby.tpp, cycles, hid, chg, m);
  };
  const tppStory = (() => {
    const t = R.tpp;
    if (!t.peers || t.v == null) return null;
    const ret = outcomePeers("returned"),
      ous = outcomePeers("ousted");
    const dAvg = t.v - t.peers.mean;
    let head;
    if (ret && ous) {
      const nearRet = Math.abs(t.v - ret.mean) <= Math.abs(t.v - ous.mean);
      head = "After preferences, " + govName + " is on a par with governments that went on to be " + (nearRet ? "re-elected" : "ousted");
    } else head = "After preferences, " + govName + " is " + (dAvg >= 0 ? "above" : "below") + " the average government at this point" + tail;
    if (chg && !(ret && ous)) head = "After preferences, " + govName + " has done " + (dAvg >= 0 ? "better" : "worse") + " than the average government since its election" + tail;
    const vs = rivalWord === "One Nation" ? " against One Nation" : "";
    let dek = chg ? (vs ? "Against One Nation it is " : "It is ") + upDown(t.v) + " points on its election result, " + pts1(dAvg) + " " + (dAvg >= 0 ? "better" : "worse") + " than the average government " + m + " months in" + tail + "." : "Its " + fmtOf("tpp")(t.v) + "%" + vs + " is " + pts1(dAvg) + " points " + (dAvg >= 0 ? "above" : "below") + " the average government " + m + " months in" + tail + ".";
    if (ret && ous) dek += chg ? " By this stage governments later re-elected were " + (ret.mean < 0 ? "down " : "up ") + pts1(ret.mean) + " points on average, and the " + rdNumWord(ous.n) + " ousted " + (ous.mean < 0 ? "down " : "up ") + pts1(ous.mean) + "." : " Governments later re-elected averaged " + fmtOf("tpp")(ret.mean) + "% at this point; the " + rdNumWord(ous.n) + " ousted averaged " + fmtOf("tpp")(ous.mean) + "%.";
    return {
      head,
      dek
    };
  })();
  const primStory = (() => {
    const mv = key => rdCycPeers(Mby[key], cycles, hidden, true, m);
    const gC = mv("primary"),
      oC = mv("oppr");
    if (!gC || !oC) return null;
    const gNow = cur.end.primary - cycBase(cur, "primary"),
      oNow = cur.end.oppr - cycBase(cur, "oppr");
    const oWorst = oC.vals.every(q => q.v > oNow);
    const gWorse = gC.vals.filter(q => q.v < gNow);
    const head = oWorst ? "No opposition has lost as much of its vote this early as " + oppIn + " has" + tail : gC.vals.every(q => q.v > gNow) ? "No government has lost as much of its vote this early as " + govName + " has" + tail : rdCap(oppIn) + " has " + (oNow < 0 ? "lost" : "gained") + " " + Math.abs(oNow).toFixed(1) + " points since the election";
    let dek = rdCap(oppIn) + " is " + (oNow < 0 ? "down " : "up ") + Math.abs(oNow).toFixed(1) + " points since the election, to " + cur.end.oppr.toFixed(1) + "%; by this stage the average opposition had " + (oC.mean >= 0 ? "gained " : "lost ") + Math.abs(oC.mean).toFixed(1) + tail + ". " + govName + " is " + (gNow < 0 ? "down " : "up ") + Math.abs(gNow).toFixed(1) + ", to " + cur.end.primary.toFixed(1) + "%.";
    if (gWorse.length === 1) dek += (tail ? " Of those, only " : " Only ") + gWorse[0].who + "’s government, in " + gWorse[0].yr + ", had lost more by now.";else if (gWorse.length > 1 && gWorse.length <= 4) dek += (tail ? " Of those, " + rdNumWord(gWorse.length) : " " + rdCap(rdNumWord(gWorse.length))) + " governments had lost more by now.";
    return {
      head,
      dek
    };
  })();
  const leadStory = (() => {
    const n = R.net;
    if (!n.peers || n.v == null) return null;
    const rk = n.rank;
    const low = n.peers.vals[0];
    const dN = n.v - n.peers.mean;
    const pp = R.ppmm,
      on = R.oppnet;
    if (chg) {
      const less = n.v < 0 ? "fallen further" : "risen less";
      const head = (/^Lowest/.test(rk.main) ? pm + "’s net approval has " + less + " than any prime minister’s at this point" : /^2nd lowest/.test(rk.main) ? pm + "’s net approval has " + less + " than any prime minister’s at this point but " + rdCycHolderTag(n.peers, low) + "’s" : /^Highest/.test(rk.main) ? pm + "’s net approval has " + (n.v >= 0 ? "risen more" : "fallen less") + " than any prime minister’s at this point" : pm + "’s net approval has done " + (dN >= 0 ? "better" : "worse") + " than the average prime minister’s since the term’s first reading") + tail;
      let dek = "It is " + upDown(n.v) + " points on the term’s first reading, " + pts1(dN) + " " + (dN >= 0 ? "better" : "worse") + " than the average prime minister " + m + " months in" + tail + ".";
      if (pp.peers && pp.v != null) {
        const dP = pp.v - pp.peers.mean;
        dek += " His lead as preferred PM is " + upDown(pp.v) + ", " + (Math.abs(dP) <= 3 ? "close to the average" : pts1(dP) + " " + (dP > 0 ? "better" : "worse") + " than the average");
        if (on.peers && on.v != null) {
          const dO = on.v - on.peers.mean;
          dek += ", and " + oppL + " is " + upDown(on.v) + (Math.abs(dO) <= 4 ? ", about as opposition leaders usually are by now." : ", " + (dO > 0 ? "better" : "worse") + " than opposition leaders usually do.");
        } else dek += ".";
      }
      return {
        head,
        dek
      };
    }
    const head = (/^Lowest/.test(rk.main) ? pm + "’s net approval is the lowest of any prime minister at this point" : /^2nd lowest/.test(rk.main) ? pm + "’s net approval is the second lowest of any prime minister at this point, after " + rdCycHolderTag(n.peers, low) + "’s" : /^Highest/.test(rk.main) ? pm + "’s net approval is the highest of any prime minister at this point" : pm + "’s net approval is " + (n.v >= n.peers.mean ? "above" : "below") + " the average prime minister’s at this point") + tail;
    let dek = "At " + fmtOf("net")(n.v) + " he is " + Math.abs(dN).toFixed(1) + " points " + (dN >= 0 ? "above" : "below") + " the average prime minister " + m + " months in" + tail + ".";
    if (pp.peers && pp.v != null) {
      const dP = pp.v - pp.peers.mean;
      dek += " He " + (pp.v >= 0 ? "still leads" : "trails") + " as preferred PM by " + Math.abs(pp.v).toFixed(1) + " points, " + (Math.abs(dP) <= 3 ? "close to the average" : Math.abs(dP).toFixed(1) + " " + (dP > 0 ? "above" : "below") + " the average");
      if (on.peers && on.v != null) {
        const dO = on.v - on.peers.mean;
        dek += ", and " + oppL + ", at " + fmtOf("oppnet")(on.v) + ", " + (Math.abs(dO) <= 4 ? "rates about as opposition leaders usually do." : "rates " + (dO > 0 ? "better" : "worse") + " than opposition leaders usually do.");
      } else dek += ".";
    }
    return {
      head,
      dek
    };
  })();
  const goTo = id => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({
      behavior: SM,
      block: "start"
    });
  };
  const SEC = {
    tpp: "cyc-tpp",
    primary: "cyc-primary",
    oppr: "cyc-primary",
    onp: "cyc-primary",
    comb: "cyc-primary",
    ppmm: "cyc-leaders",
    ppmh: "cyc-leaders",
    net: "cyc-leaders",
    oppnet: "cyc-leaders",
    han: "cyc-leaders",
    pmlead: "cyc-leaders"
  };
  const toggleRow = (key, el) => {
    if (el) rdPinScroll(el, true);
    setLit(null);
    setOpenRow(o => o === key ? null : key);
  };
  const rowNav = (e, r) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggleRow(r.key, e.currentTarget);
      return;
    }
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.defaultPrevented) return;
      if (cmpSwipeLive.current(e.key === "ArrowRight" ? 1 : -1)) e.preventDefault();
      return;
    }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const rows = [...e.currentTarget.closest(".rd-cs").querySelectorAll(".rd-cs-row")];
    const nx = rows[rows.indexOf(e.currentTarget) + (e.key === "ArrowDown" ? 1 : -1)];
    if (!nx) return;
    if (openRow === r.key) toggleRow(nx.dataset.key, nx);
    nx.focus();
  };
  const CSL_EL = {
    tpp: true,
    primary: true,
    oppr: true
  };
  const ladderOf = r => {
    const M = Mby[r.key],
      P = r.peers,
      g = r.group,
      sc = SC[g];
    if (!P && r.v == null) return null;
    const opp = M.leader === "opp";
    const partyOf = c => D.PARTIES[opp ? c.opp : c.gov].color;
    const ocOf = c => {
      const oc = outcomeOf(cycles.indexOf(c));
      return !oc ? null : opp ? oc === "ousted" ? "Won" : "Lost" : oc === "returned" ? "Re-elected" : "Ousted";
    };
    const ocCell = (c, who) => {
      const w = ocOf(c);
      if (!w) return null;
      const by = rdCycEndLeader(c, opp);
      return by && by !== who ? React.createElement(React.Fragment, null, w, React.createElement("span", {
        className: "rd-csl-under"
      }, " under ", by)) : w;
    };
    const hasEl = !!CSL_EL[M.key];
    const elOf = c => hasEl && c.endRes && c.endRes[M.key] != null ? chg ? c.endRes[M.key] - cycBaseOf(c, M.key) : c.endRes[M.key] : null;
    const polledAt = c => {
      const i = c.raw.months.indexOf(m);
      return i >= 0 && rdCycPolled(c, M.key, i);
    };
    const curWho = r.key === "onp" ? "One Nation" : r.key === "han" ? "Hanson" : r.key === "comb" ? "L/NP + ON" : cycHolderAt(cur, M, m);
    const curFirst = !!(r.rank && /highest/i.test(r.rank.main));
    const rowH = narrow ? RD_CSL_ROW_PHONE : RD_CSL_ROW;
    const list = (P ? P.vals.map(q => ({
      ...q,
      el: elOf(q.c),
      polled: polledAt(q.c)
    })) : []).concat(r.v != null ? [{
      v: r.v,
      who: curWho,
      yr: cur.year,
      c: cur,
      cur: true
    }] : []).sort((a, b) => b.v - a.v || (a.cur ? curFirst ? -1 : 1 : b.cur ? curFirst ? 1 : -1 : a.yr - b.yr));
    const tipYr = tip && tip.key === r.key && P && P.vals[tip.i] ? P.vals[tip.i].yr : null;
    const setWords = (compare === "all" ? "All " : "") + list.length + " terms";
    const onpOwn = r.key === "onp";
    const spec = onpOwn ? {
      M,
      key: "onp",
      curKey: "onp",
      whoOf: () => "One Nation",
      people: false,
      positive: true
    } : {
      M,
      key: M.key,
      curKey: r.key,
      people: g === "leaders",
      whoOf: r.key === "han" || r.key === "comb" ? c => c.current ? curWho : null : null
    };
    const recs = rdCycRecords(cycles, hidden, chg, spec);
    const recTitle = lo => (chg ? (lo ? "Furthest below " : "Furthest above ") + (g === "leaders" ? "the term’s first reading" : onpOwn ? "its election result" : "the election result") : (onpOwn ? "One Nation’s own highs" : lo ? "Lowest" : "Highest") + " at any point in a term") + tail;
    const recRow = (e, i) => React.createElement("div", {
      key: e.yr + "|" + e.who,
      className: "rd-csr-row" + (e.cur ? " cur" : "")
    }, React.createElement("span", {
      className: "rd-csl-k"
    }, i + 1), React.createElement("span", {
      className: "rd-csl-name"
    }, React.createElement("i", {
      className: "rd-csl-pty",
      style: {
        background: e.cur ? r.color : onpOwn ? D.PARTIES.onp.color : partyOf(e.c)
      }
    }), React.createElement("b", null, e.who), React.createElement("span", {
      className: "rd-csl-yr"
    }, e.yr)), React.createElement("span", {
      className: "rd-csr-v",
      style: e.cur ? {
        color: inkOf(r.color)
      } : null
    }, r.fmt(e.v)), React.createElement("span", {
      className: "rd-csr-when"
    }, e.cur && e.m === m ? "Now" : rdCycWhen(e.c, e.m), React.createElement("span", {
      className: "rd-csr-mo"
    }, ", ", e.m, " ", e.m === 1 ? "month" : "months", " in")), React.createElement("span", {
      className: "rd-csr-oc"
    }, e.cur ? "This term" : onpOwn ? "" : ocCell(e.c, e.who)));
    const recList = (rows, lo) => {
      const pins = rows.map((e, i) => e.cur && i >= 5 ? i : -1).filter(i => i >= 0);
      return React.createElement("div", {
        className: "rd-csr-list"
      }, React.createElement("div", {
        className: "rd-csr-h"
      }, recTitle(lo)), rows.slice(0, 5).map(recRow), pins.length > 0 && React.createElement("div", {
        className: "rd-csr-gap",
        "aria-hidden": "true"
      }), pins.map(i => recRow(rows[i], i)));
    };
    const firstOnp = onpOwn && recs ? recs.highs.reduce((a, e) => {
      const i = e.c.raw.months.findIndex((mo, j) => mo > 0 && e.c.raw.onp[j] > 0 && rdCycPolled(e.c, "onp", j));
      return i >= 0 && (!a || e.c.year < a.c.year) ? {
        c: e.c,
        m: e.c.raw.months[i]
      } : a;
    }, null) : null;
    const peerNote = onpOwn ? "One Nation has never been the opposition, so it is ranked against past oppositions’ primary votes." : r.key === "han" ? "No past term rated Hanson, so she is ranked against past opposition leaders’ net approval, and her ratings join their records." : r.key === "ppmh" ? "Asked as its own pair only this term, so the lead over Hanson is ranked against past prime ministers’ leads over the opposition leader, and joins their records." : r.key === "comb" ? (() => {
      const nil = cycles.filter(c => !c.current && c.opp === "lnp" && rdOnpUnsplit(c)).map(c => c.year);
      return "Only terms with the Coalition in opposition count. Before One Nation existed the Coalition’s vote stands alone" + (nil.length ? ", as it does in " + nil.join(" and ") + ", when polls didn’t report One Nation separately (it was polling about 1%)" : "") + ".";
    })() : null;
    const notes = [onpOwn ? "One Nation’s records are its own" + (firstOnp ? ", from its first poll in " + rdCycWhen(firstOnp.c, firstOnp.m) : "") + "." : null, g === "leaders" ? "In the records a leader counts once per term, at their lowest or highest month. Only months with a poll count." : "In the records a term counts once, at its lowest or highest month, so one long slump can’t fill the list. Only months with a poll count, not the election results.", hasEl && list.some(e => e.el != null) ? React.createElement(React.Fragment, null, React.createElement("i", {
      className: "rd-csl-ring key",
      "aria-hidden": "true"
    }), "Where each past term finished: its result at the next election.") : null, list.some(e => e.polled === false) ? "≈ No poll that month: read from the months either side." : null].filter(Boolean);
    return React.createElement("div", {
      className: "rd-csl",
      id: "rd-csl-" + r.key,
      role: "region",
      "aria-label": r.name + ": every term ranked, and the records"
    }, peerNote && React.createElement("p", {
      className: "rd-csl-pn"
    }, peerNote), React.createElement("div", {
      className: "rd-csl-head"
    }, React.createElement("span", {
      className: "rd-csl-h"
    }, React.createElement("b", null, setWords, ", ", m, " months in"), React.createElement("span", {
      className: "rd-csl-hs"
    }, React.createElement("span", {
      className: "rd-csl-sep"
    }, " \xB7 "), "highest first")), React.createElement("span", {
      className: "rd-csl-scale",
      "aria-hidden": "true"
    }, scaleNow[g].ticks.map((q, i, a) => React.createElement("span", {
      key: q.v,
      className: (i % 2 ? "odd" : "") + (i === a.length - 1 ? " last" : ""),
      style: {
        left: q.left + "%"
      }
    }, q.lab))), React.createElement("span", {
      className: "rd-csl-nxh"
    }, hasEl && React.createElement("i", {
      className: "rd-csl-ring key",
      "aria-hidden": "true"
    }), "Next election"), React.createElement("button", {
      type: "button",
      className: "rd-link rd-csl-go",
      onClick: () => goTo(SEC[r.key])
    }, "See every term on the chart \u2193")), React.createElement(RdCsUnroll, {
      className: "rd-csl-list",
      style: {
        height: list.length * rowH + "px"
      }
    }, React.createElement("div", {
      className: "rd-csl-bg",
      "aria-hidden": "true"
    }, React.createElement("span", {
      className: "rd-csl-bgt"
    }, scaleNow[g].ticks.map(q => React.createElement("i", {
      key: q.v,
      className: "rd-csl-gl",
      style: {
        left: q.left + "%"
      }
    })), P && P.n >= 3 && React.createElement("i", {
      className: "rd-csl-b80",
      style: {
        left: X(sc, P.p10) + "%",
        width: X(sc, P.p90) - X(sc, P.p10) + "%"
      }
    }), P && P.n >= 3 && React.createElement("i", {
      className: "rd-csl-b50",
      style: {
        left: X(sc, P.q1) + "%",
        width: X(sc, P.q3) - X(sc, P.q1) + "%"
      }
    }), P && React.createElement("i", {
      className: "rd-csl-mean",
      style: {
        left: X(sc, P.mean) + "%"
      }
    }))), list.map((e, k) => React.createElement("div", {
      key: e.yr,
      className: "rd-csl-row" + (e.cur ? " cur" : "") + (!e.cur && (lit && lit.key === r.key && lit.yr === e.yr || tipYr === e.yr) ? " on" : ""),
      style: {
        transform: "translateY(" + k * rowH + "px)",
        "--k": k
      },
      onMouseEnter: e.cur ? undefined : () => setLit({
        key: r.key,
        yr: e.yr
      }),
      onMouseLeave: e.cur ? undefined : () => setLit(null)
    }, React.createElement("span", {
      className: "rd-csl-name"
    }, React.createElement("span", {
      className: "rd-csl-k"
    }, k + 1), React.createElement("i", {
      className: "rd-csl-pty",
      style: {
        background: e.cur ? r.color : partyOf(e.c)
      }
    }), React.createElement("b", null, e.who), React.createElement("span", {
      className: "rd-csl-yr"
    }, e.yr)), React.createElement("span", {
      className: "rd-csl-v",
      style: e.cur ? {
        color: inkOf(r.color)
      } : null
    }, e.polled === false && React.createElement("span", {
      className: "rd-csl-ip"
    }, "\u2248"), r.fmt(e.v)), React.createElement("span", {
      className: "rd-csl-trk"
    }, e.el != null && (() => {
      const a = X(sc, e.v),
        b = Math.min(100, Math.max(0, X(sc, e.el)));
      return React.createElement(React.Fragment, null, React.createElement("i", {
        className: "rd-csl-run",
        style: {
          left: Math.min(a, b) + "%",
          width: Math.abs(b - a) + "%"
        }
      }), React.createElement("i", {
        className: "rd-csl-ring",
        style: {
          left: b + "%"
        }
      }));
    })(), React.createElement("i", {
      className: "rd-csl-dot" + (e.cur ? " cur" : ""),
      style: {
        left: X(sc, e.v) + "%",
        background: e.cur ? r.color : undefined
      }
    })), React.createElement("span", {
      className: "rd-csl-el"
    }, e.el != null ? r.fmt(e.el) : ""), React.createElement("span", {
      className: "rd-csl-oc"
    }, e.cur ? "This term" : ocCell(e.c, e.who))))), recs && React.createElement("div", {
      className: "rd-csr" + (onpOwn ? " one" : "")
    }, !onpOwn && recList(recs.lows, true), recList(recs.highs, false)), React.createElement("div", {
      className: "rd-csl-foot"
    }, React.createElement("span", {
      className: "rd-csl-notes"
    }, notes.map((t, i) => React.createElement("span", {
      key: i
    }, t)))));
  };
  const summary = React.createElement("div", {
    className: "rd-cs",
    role: "table",
    "aria-label": "Every measure " + m + " months in, against past terms at the same point"
  }, React.createElement("div", {
    className: "rd-cs-head",
    role: "row"
  }, React.createElement("span", {
    role: "columnheader"
  }, "Measure"), React.createElement("span", {
    role: "columnheader",
    className: "rd-cs-now"
  }, chg ? "Change" : "Now"), React.createElement("span", {
    role: "columnheader"
  }, "Past terms, ", m, " months in"), React.createElement("span", {
    role: "columnheader"
  }, "Against average"), React.createElement("span", {
    role: "columnheader"
  }, "Rank"), React.createElement("span", null)), ["votes", "leaders"].map(g => React.createElement(React.Fragment, {
    key: g
  }, React.createElement("div", {
    className: "rd-cs-group",
    role: "row"
  }, React.createElement("span", null, React.createElement("b", null, g === "votes" ? "Votes" : "Leaders"), " ", g === "votes" ? chg ? "points since the election" : "% of voters" : "net points"), React.createElement("span", null), React.createElement("span", {
    className: "rd-cs-scale"
  }, scaleOut(g) && scaleOut(g).value[g].ticks.map(q => React.createElement("span", {
    key: "o" + scaleOut(g).id + "-" + q.v,
    className: "out",
    "aria-hidden": "true",
    style: {
      left: q.left + "%"
    }
  }, q.lab)), scaleNow[g].ticks.map(q => React.createElement("span", {
    key: scaleNow[g].key + "-" + q.v,
    className: scaleOut(g) ? "in" : undefined,
    style: {
      left: q.left + "%"
    }
  }, q.lab))), React.createElement("span", null), React.createElement("span", null), React.createElement("span", null)), ROWS.filter(r => r.group === g).map(r => {
    const sc = SC[g],
      P = r.peers;
    const dd = P && r.v != null ? r.v - P.mean : null;
    const isOpen = openRow === r.key;
    return React.createElement("div", {
      key: r.key,
      className: "rd-cs-item" + (isOpen ? " open" : "")
    }, React.createElement("div", {
      className: "rd-cs-row",
      role: "row",
      "data-key": r.key,
      tabIndex: 0,
      "aria-expanded": isOpen,
      "aria-controls": isOpen ? "rd-csl-" + r.key : undefined,
      onClick: ev => toggleRow(r.key, ev.currentTarget),
      onKeyDown: ev => rowNav(ev, r)
    }, React.createElement("span", {
      role: "cell",
      className: "rd-cs-name"
    }, React.createElement("b", null, r.name), React.createElement("span", null, r.sub)), React.createElement("span", {
      role: "cell",
      className: "rd-cs-now",
      style: {
        color: inkOf(r.color)
      }
    }, r.v != null ? r.fmt(r.v) : "—", r.v != null && Mby[r.key].unit === "%" && !chg ? React.createElement("small", null, "%") : null), React.createElement("span", {
      className: "rd-cs-strip",
      "aria-hidden": "true"
    }, scaleOut(g) && scaleOut(g).value[g].ticks.map(q => React.createElement("i", {
      key: "o" + scaleOut(g).id + "-" + q.v,
      className: "rd-cs-gl out",
      style: {
        left: q.left + "%"
      }
    })), scaleNow[g].ticks.map(q => React.createElement("i", {
      key: scaleNow[g].key + "-" + q.v,
      className: "rd-cs-gl" + (scaleOut(g) ? " in" : ""),
      style: {
        left: q.left + "%"
      }
    })), P && P.n >= 3 && React.createElement("i", {
      className: "rd-cs-b80",
      style: {
        left: X(sc, P.p10) + "%",
        width: X(sc, P.p90) - X(sc, P.p10) + "%"
      }
    }), P && P.n >= 3 && React.createElement("i", {
      className: "rd-cs-b50",
      style: {
        left: X(sc, P.q1) + "%",
        width: X(sc, P.q3) - X(sc, P.q1) + "%"
      }
    }), dotsWas && dotsWas.value[r.key].filter(q => !dotsNow[r.key].some(d => d.yr === q.yr)).map(q => React.createElement("i", {
      key: "o" + dotsWas.id + "-" + q.yr,
      className: "rd-cs-dot out",
      "aria-hidden": "true",
      style: {
        left: q.left + "%"
      }
    })), P && P.vals.map((q, qi) => React.createElement("i", {
      key: q.yr,
      className: "rd-cs-dot" + (tip && tip.key === r.key && tip.i === qi || lit && lit.key === r.key && lit.yr === q.yr ? " on" : "") + (dotsWas && !dotsWas.value[r.key].some(d => d.yr === q.yr) ? " in" : ""),
      style: {
        left: X(sc, q.v) + "%"
      },
      onMouseEnter: () => setTip({
        key: r.key,
        i: qi
      }),
      onMouseLeave: () => setTip(null)
    })), P && React.createElement("i", {
      className: "rd-cs-mean",
      style: {
        left: X(sc, P.mean) + "%"
      }
    }), r.v != null && React.createElement("i", {
      className: "rd-cs-cur",
      style: {
        left: X(sc, r.v) + "%",
        background: r.color
      }
    }), tip && tip.key === r.key && P && P.vals[tip.i] && (() => {
      const q = P.vals[tip.i];
      const idx = cycles.findIndex(c => c.year === q.yr);
      const oc = outcomeOf(idx);
      return React.createElement("span", {
        className: "tip rd-cs-tip",
        style: {
          left: Math.min(80, Math.max(20, X(sc, q.v))) + "%"
        }
      }, React.createElement("span", {
        className: "tip-title"
      }, q.who, ", ", q.yr, " term"), React.createElement("span", {
        className: "tip-row"
      }, React.createElement("span", {
        className: "tip-label"
      }, "At ", m, " months"), React.createElement("span", {
        className: "tip-val"
      }, r.fmt(q.v))), oc && React.createElement("span", {
        className: "tip-row"
      }, React.createElement("span", {
        className: "tip-label"
      }, "Next election"), React.createElement("span", {
        className: "tip-val"
      }, oc === "returned" ? "Re-elected" : "Ousted")));
    })()), React.createElement("span", {
      role: "cell",
      className: "rd-cs-avg"
    }, dd != null ? React.createElement(React.Fragment, null, React.createElement("b", null, rdArrow(dd), " ", Math.abs(dd).toFixed(1), " ", dd >= 0 ? "above" : "below"), React.createElement("span", null, "average ", r.fmt(P.mean))) : "—"), React.createElement("span", {
      role: "cell",
      className: "rd-cs-rank" + (r.rank && r.rank.strong ? " strong" : "")
    }, r.rank ? React.createElement(React.Fragment, null, React.createElement("b", null, r.rank.main), r.rank.sub && React.createElement("span", null, r.rank.sub)) : "—"), React.createElement("span", {
      className: "rd-cs-c-exp"
    }, React.createElement("button", {
      type: "button",
      className: "rd-cs-exp" + (isOpen ? " open" : ""),
      "aria-expanded": isOpen,
      "aria-label": (isOpen ? "Close" : "Open") + " every term’s " + r.name.replace(/^[A-Z]/, x => x.toLowerCase()) + ", ranked",
      onClick: ev => {
        ev.stopPropagation();
        toggleRow(r.key, ev.currentTarget.closest(".rd-cs-row"));
      }
    }, React.createElement("svg", {
      viewBox: "0 0 10 10",
      width: "9",
      height: "9",
      "aria-hidden": "true"
    }, React.createElement("path", {
      d: "M3 1.5L7.5 5 3 8.5z"
    }))))), isOpen && ladderOf(r));
  }))), React.createElement(RdKey, {
    className: "rd-ckey rd-cs-key",
    items: [{
      kind: "dot",
      color: "var(--ink-3)",
      label: "A past term at the same point"
    }]
  }, React.createElement("span", {
    className: "rd-key-item"
  }, React.createElement("span", {
    className: "rd-cs-keyband",
    "aria-hidden": "true"
  }, React.createElement("i", null)), "Middle half, and middle 80%, of past terms"), React.createElement("span", {
    className: "rd-key-item"
  }, React.createElement("span", {
    className: "rd-cs-keymean",
    "aria-hidden": "true"
  }), "Their average"), React.createElement("span", {
    className: "rd-key-item"
  }, React.createElement(RdSwatch, {
    kind: "dot-solid",
    color: cur.color
  }), "The ", cur.year, " term"), React.createElement("span", {
    className: "rd-key-item rd-cs-hint"
  }, narrow ? "Tap a measure to rank every term" : "Open a measure to rank every term and see its records")));
  const liftedList = cycles.filter(c => lifted.has(c.year) && !hidden.has(c.year));
  const pmNames = c => c.raw.netEras && c.raw.netEras.length > 1 ? c.raw.netEras.map(e => e.name).join("–") : c.lead;
  const CMP_ROWS = [["all", "All past terms", nPast], ["returned", "Re-elected", nRet], ["ousted", "Ousted", nOus]];
  const MODE_ROWS = ["abs", "chg"];
  const cmpSwipeLive = React.useRef(null);
  cmpSwipeLive.current = dir => {
    const i = CMP_ROWS.findIndex(([id]) => id === compare);
    if (i < 0) return false;
    setCompare(CMP_ROWS[(i + dir + CMP_ROWS.length) % CMP_ROWS.length][0]);
    return true;
  };
  const cmpSwipe = React.useCallback(el => {
    if (el) el.__rdSwipe = dir => cmpSwipeLive.current(dir);
  }, []);
  const modeSwipeLive = React.useRef(null);
  modeSwipeLive.current = dir => {
    const i = MODE_ROWS.indexOf(mode);
    if (i < 0) return false;
    setModePin(MODE_ROWS[(i + dir + MODE_ROWS.length) % MODE_ROWS.length]);
    return true;
  };
  const sumHover = React.useRef(false),
    measHover = React.useRef(false),
    measEl = React.useRef(null),
    measWalk = React.useRef(0);
  React.useEffect(() => {
    const sec = document.getElementById("cyc-summary"),
      meas = measEl.current;
    if (!sec) return undefined;
    const on = (el, ref) => {
      const enter = () => {
          ref.current = true;
        },
        leave = () => {
          ref.current = false;
        };
      ref.current = el.matches(":hover");
      el.addEventListener("pointerenter", enter);
      el.addEventListener("pointerleave", leave);
      return [el, enter, leave];
    };
    const pairs = meas ? [on(sec, sumHover), on(meas, measHover)] : [on(sec, sumHover)];
    const inView = {
      current: false
    };
    const io = new IntersectionObserver(es => es.forEach(en => {
      inView.current = en.isIntersecting;
    }));
    io.observe(sec);
    const key = e => {
      if (e.key === " ") {
        if (!inView.current || e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
        const sel = window.getSelection && window.getSelection();
        if (sel && !sel.isCollapsed) return;
        const fcs = document.activeElement;
        let step = null;
        if (fcs && fcs.tagName !== "BODY" && fcs.tagName !== "HTML") {
          const grp = fcs.closest && fcs.closest(".rd-cc-tabs");
          if (!grp || !sec.contains(grp) || fcs.getAttribute("aria-pressed") !== "true") return;
          step = grp === measEl.current ? cmpSwipeLive.current : modeSwipeLive.current;
        } else {
          const mo = measEl.current;
          step = (measHover.current || sumHover.current && Date.now() - measWalk.current < 800) && mo && mo.isConnected && mo.getClientRects().length ? cmpSwipeLive.current : modeSwipeLive.current;
        }
        if (!step) return;
        e.preventDefault();
        if (!e.repeat) step(1);
        return;
      }
      if (!sumHover.current && !measHover.current || e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const a = document.activeElement;
      const sel = window.getSelection && window.getSelection();
      if (sel && !sel.isCollapsed) return;
      const dir = e.key === "ArrowRight" ? 1 : -1,
        mo = measEl.current;
      const rowFocus = !!(a && a.closest && a.closest(".rd-cs-row"));
      if ((!a || a.tagName === "BODY" || a.tagName === "HTML" || rowFocus) && (measHover.current || sumHover.current && Date.now() - measWalk.current < 800) && mo && mo.isConnected && mo.getClientRects().length) {
        if (modeSwipeLive.current(dir)) {
          measWalk.current = Date.now();
          e.preventDefault();
        }
        return;
      }
      if (a && a.tagName !== "BODY" && a.tagName !== "HTML") return;
      if (cmpSwipeLive.current(dir)) e.preventDefault();
    };
    document.addEventListener("keydown", key, true);
    return () => {
      io.disconnect();
      pairs.forEach(([el, enter, leave]) => {
        el.removeEventListener("pointerenter", enter);
        el.removeEventListener("pointerleave", leave);
      });
      document.removeEventListener("keydown", key, true);
    };
  }, []);
  const controls = React.createElement("div", {
    className: "rd-cc",
    ref: boardRef
  }, React.createElement("div", {
    className: "rd-cc-row"
  }, React.createElement("span", {
    className: "rd-cc-l"
  }, "Compare with"), React.createElement("div", {
    className: "rd-tabs rd-cc-tabs",
    role: "group",
    "aria-label": "Compare with",
    ref: cmpSwipe,
    "data-rd-swipe": "",
    onKeyDown: rdTabsKey(CMP_ROWS.map(([id]) => ({
      id
    })), setCompare),
    onClick: rdTabFocus
  }, CMP_ROWS.map(([id, lab, n]) => React.createElement("button", {
    key: id,
    type: "button",
    className: "rd-tab",
    "aria-pressed": compare === id,
    onClick: () => setCompare(id)
  }, React.createElement(RdTabW, {
    t: narrow && id === "all" ? "All" : lab
  }), React.createElement("span", {
    className: "rd-cc-n"
  }, n)))), React.createElement("span", {
    className: "rd-cc-sep",
    "aria-hidden": "true"
  }), React.createElement("div", {
    className: "rd-tabs rd-cc-tabs",
    role: "group",
    "aria-label": "Measure",
    ref: measEl,
    onKeyDown: rdTabsKey(MODE_ROWS.map(id => ({
      id
    })), setModePin),
    onClick: rdTabFocus
  }, React.createElement("button", {
    type: "button",
    className: "rd-tab",
    "aria-pressed": !chg,
    onClick: () => setModePin("abs")
  }, React.createElement(RdTabW, {
    t: "Level"
  })), React.createElement("button", {
    type: "button",
    className: "rd-tab",
    "aria-pressed": chg,
    onClick: () => setModePin("chg")
  }, React.createElement(RdTabW, {
    t: narrow ? "Change" : "Change since election"
  })))), board.open && React.createElement("div", {
    className: "rd-cc-board" + boardPane,
    role: "dialog",
    "aria-label": "Past terms"
  }, React.createElement("div", {
    className: "rd-cc-bhead"
  }, React.createElement("b", null, "Past terms"), React.createElement("span", null, cycles.length - hidden.size - (hidden.has(cur.year) ? 0 : 1), " on the board, ", liftedList.length, " drawn as their own line"), React.createElement("span", {
    className: "rd-grow"
  }), React.createElement("button", {
    type: "button",
    className: "rd-link",
    onClick: () => {
      cycles.forEach(c => {
        if (!c.current && !lifted.has(c.year) && !hidden.has(c.year)) toggle(c.year);
      });
    }
  }, "Only the drawn terms"), React.createElement("button", {
    type: "button",
    className: "rd-link",
    onClick: () => liftedList.forEach(c => unlift(c.year))
  }, "Clear lines"), React.createElement("button", {
    type: "button",
    className: "rd-iconbtn",
    "aria-label": "Close",
    onClick: () => setBoard({
      open: false,
      sheet: null
    })
  }, "\xD7")), React.createElement("div", {
    className: "rd-cc-grid"
  }, cycles.map((c, i) => {
    const off = hidden.has(c.year),
      drawn = lifted.has(c.year) && !off;
    const oc = outcomeOf(i);
    return React.createElement("span", {
      key: c.year,
      className: "rd-cc-term" + (off ? " off" : "") + (drawn ? " drawn" : "") + (c.current ? " current" : ""),
      onMouseEnter: () => setHi(c.year),
      onMouseLeave: () => setHi(null)
    }, React.createElement("button", {
      type: "button",
      className: "rd-cc-main",
      "aria-pressed": drawn || c.current && !off,
      disabled: c.current,
      onClick: () => chipClick(c.year),
      title: off ? "Put " + c.year + " back on the board" : drawn ? "Return " + c.year + " to the band" : "Draw " + c.year + " as its own line"
    }, React.createElement("span", {
      className: "rd-cc-rule",
      style: {
        background: c.color,
        opacity: drawn || c.current ? 1 : 0.4
      }
    }), React.createElement("b", null, c.year), React.createElement("span", null, pmNames(c))), c.current ? React.createElement("span", {
      className: "rd-cc-now"
    }, "This term") : React.createElement("span", {
      className: "rd-cc-oc"
    }, oc === "returned" ? "Re-elected" : "Ousted"), React.createElement("button", {
      type: "button",
      className: "rd-cc-x",
      "aria-label": (off ? "Put " : "Take ") + c.year + (off ? " back on the board" : " off the board"),
      onClick: () => toggle(c.year)
    }, off ? "+" : "×"));
  })), React.createElement("p", {
    className: "rd-note"
  }, "Click a term to draw its own line over the band, and again to put it back. The \xD7 takes it off the board altogether: out of the band, the average and the download. With three terms or fewer on the board, the band gives way to the polls under each line.")));
  const pairOf = keys => rdEventBadges("cy" + cur.year, (CYC_EVENTS[cur.year] || []).filter(e => !e.metrics || e.metrics.some(k => keys.includes(k))).map(e => ({
    ...e,
    x: cycEventMonth(e.date, cur.eDate)
  })), -2, 38);
  const PAIRS = {
    primary: pairOf(["primary", "oppr"]),
    leaders: pairOf(["ppmm", "oppnet"])
  };
  const [evt, setEvt] = useState({
    primary: null,
    oppr: null,
    ppmm: null,
    oppnet: null
  });
  const onEvtOf = key => v => setEvt(s => {
    const nx = typeof v === "function" ? v(s[key]) : v;
    return nx === s[key] ? s : {
      ...s,
      [key]: nx
    };
  });
  const pickPair = (pair, keys) => e => {
    const k = keys.find(c => !e.metrics || e.metrics.includes(c));
    if (k) setEvt(s => {
      if (s[k] && s[k].e === e) return s;
      const nx = {
        ...s
      };
      keys.forEach(c => {
        nx[c] = null;
      });
      nx[k] = {
        e
      };
      return nx;
    });
    if (k) rdEventReveal("evt-a-" + e.badgeKey);
  };
  const pickEvOf = {
    primary: pickPair("primary", ["primary", "oppr"]),
    leaders: pickPair("leaders", ["ppmm", "oppnet"])
  };
  const openKeyOf = keys => {
    for (const k of keys) {
      if (evt[k] && evt[k].e) return evt[k].e.badgeKey;
    }
    return null;
  };
  const chart = (key, half, pair) => {
    const M = Mby[key];
    const evs = pair ? PAIRS[pair].events.filter(e => !e.metrics || e.metrics.includes(key)) : null;
    return React.createElement(CycleChart, {
      key: key,
      metric: M,
      cycles: cycles,
      mode: mode,
      hidden: hidden,
      hi: hi,
      setHi: setHi,
      lifted: lifted,
      unlift: unlift,
      chipClick: chipClick,
      toggle: toggle,
      showAll: showAll,
      hideAll: hideAll,
      showOutcome: showOutcome,
      showHan: showHan,
      setHan: setShowHan,
      showOnp: showOnp,
      setOnp: setShowOnp,
      showComb: showComb,
      setComb: setShowComb,
      shapes: shapes,
      outcomeShown: outcomeShown,
      rdHalf: half,
      rdEvents: evs,
      evtOut: pair ? evt[key] : null,
      onEvtOut: pair ? onEvtOf(key) : null
    });
  };
  const twoLines = (a, b) => React.createElement("svg", {
    width: "30",
    height: "14",
    viewBox: "0 0 30 14",
    "aria-hidden": "true"
  }, React.createElement("path", {
    d: "M1 7H13",
    style: {
      stroke: a,
      strokeWidth: 3,
      strokeLinecap: "round"
    }
  }), React.createElement("path", {
    d: "M17 7H29",
    style: {
      stroke: b,
      strokeWidth: 3,
      strokeLinecap: "round"
    }
  }));
  const bandKey = sec => React.createElement(RdKey, {
    className: "rd-ckey",
    items: []
  }, React.createElement("span", {
    className: "rd-key-item"
  }, React.createElement("span", {
    className: "rd-cs-keyband",
    "aria-hidden": "true"
  }, React.createElement("i", null)), "Middle half and middle 80% of past terms"), React.createElement("span", {
    className: "rd-key-item"
  }, React.createElement(RdSwatch, {
    kind: "dash",
    color: "var(--ink-2)"
  }), "Their average"), React.createElement("span", {
    className: "rd-key-item"
  }, React.createElement("span", {
    className: "rd-cs-keythin",
    "aria-hidden": "true"
  }), "Paler: fewer terms ran this long"), sec === "tpp" && React.createElement("span", {
    className: "rd-key-item"
  }, React.createElement(RdSwatch, {
    kind: "line",
    color: cur.color
  }), "The ", cur.year, " term, monthly"), sec === "primary" && React.createElement("span", {
    className: "rd-key-item"
  }, twoLines(D.PARTIES[cur.gov].color, D.PARTIES[cur.opp].color), "The ", cur.year, " term: ", govName, ", ", oppIn), sec === "leaders" && React.createElement("span", {
    className: "rd-key-item"
  }, twoLines(D.PARTIES[cur.gov].color, D.PARTIES[cur.opp].color), "The ", cur.year, " term: ", pm, ", the opposition leader"), (sec === "tpp" || sec === "primary") && React.createElement("span", {
    className: "rd-key-item"
  }, React.createElement(RdSwatch, {
    kind: "ring"
  }), "Each term\u2019s election results"));
  const navs = [["cyc-tpp", "Two-party preferred"], ["cyc-primary", "Primary vote"], ["cyc-leaders", "Leadership"], ["final-polls", "How the final polls have done"]];
  const chipBand = i => React.createElement("span", {
    className: "rd-cyc-chipmove",
    ref: chipmoveRef(i)
  }, React.createElement("button", {
    type: "button",
    className: "rd-chip",
    "aria-expanded": board.open,
    onClick: () => setBoard(b => b.open ? {
      open: false,
      sheet: null
    } : {
      open: true,
      sheet: null
    })
  }, "\uFF0B ", narrow ? "Draw a term" : "Draw a past term"), liftedList.length > 0 && React.createElement("span", {
    className: "rd-cc-drawn"
  }, React.createElement("span", {
    className: "rd-cc-l"
  }, "Drawn over the band"), liftedList.map(c => React.createElement("span", {
    key: c.year,
    className: "rd-cc-pill",
    style: {
      borderColor: c.color
    }
  }, React.createElement("span", {
    className: "rd-cc-rule",
    style: {
      background: c.color
    }
  }), c.year, " ", pmNames(c), React.createElement("button", {
    type: "button",
    "aria-label": "Return " + c.year + " to the band",
    onClick: () => unlift(c.year)
  }, "\xD7"))), !hidden.has(cur.year) && React.createElement("span", {
    className: "rd-cc-pill rd-cc-cur",
    style: {
      borderColor: cur.color
    }
  }, React.createElement("span", {
    className: "rd-cc-rule",
    style: {
      background: cur.color
    }
  }), cur.year, " ", pmNames(cur), React.createElement("button", {
    type: "button",
    "aria-label": "Take the " + cur.year + " term off the board",
    onClick: () => toggle(cur.year)
  }, "\xD7"))));
  const accuracy = React.useMemo(() => React.createElement(AccuracyPanel, null), []);
  return React.createElement("div", {
    className: "view view-cycles rd-cycles"
  }, React.createElement("section", {
    className: "rd-sec rd-first",
    id: "cyc-summary",
    "aria-labelledby": "rd-cyc-t"
  }, React.createElement("div", {
    className: "rd-eyebrow"
  }, React.createElement("h2", {
    className: "rd-title",
    id: "rd-cyc-t"
  }, "Past cycles"), React.createElement("span", {
    className: "rd-meta"
  }, "Every term since ", cycles[0].year, ", lined up on its own election day"), !narrow && React.createElement("nav", {
    className: "rd-eyebrow-tools rd-cyc-nav",
    "aria-label": "On this page"
  }, navs.map(([id, lab], i) => React.createElement("button", {
    key: id,
    type: "button",
    onClick: () => goTo(id)
  }, (i === navs.length - 1 ? "and " : "") + lab)))), controls, React.createElement("div", {
    className: "rd-cyc-storyslot",
    style: storyHold ? {
      minHeight: storyHold + "px"
    } : null
  }, React.createElement(RdHed, {
    head: pageStory.head,
    dek: pageStory.dek,
    level: 2
  })), srcFailed && React.createElement("p", {
    className: "rd-note"
  }, "The individual polls behind the past terms didn\u2019t load; the monthly lines are unaffected. ", React.createElement("button", {
    type: "button",
    className: "rd-link rd-link-in",
    onClick: retrySource
  }, "Try again")), summary, React.createElement("div", {
    className: "rd-foot"
  }, React.createElement("span", {
    className: "rd-foot-text"
  }, "Each term is lined up on its own election day, so month ", m, " is the same distance into every one of them. Past terms are averaged month by month the way this term is; where a term changed leader, its line follows whoever held the office. Comparing with governments that were re-elected or ousted adds context, not a forecast. Preferred-PM and net-approval ratings ", RD_CYC_CITE("add", 1), " ", RD_CYC_CITE("little", 2), " or ", RD_CYC_CITE("no", 0), " predictive value on top of voting-intention data."), React.createElement("span", {
    className: "rd-grow"
  }), React.createElement("button", {
    type: "button",
    className: "rd-how rd-cyc-csv",
    onClick: exportSource
  }, React.createElement(DownloadIcon, null), " Source polls, CSV"), React.createElement(RdHow, {
    term: "past-cycles",
    from: "Past cycles"
  }))), React.createElement(RdSec, {
    id: "cyc-tpp",
    title: "Two-party preferred",
    meta: "Implied from each poll\u2019s primary votes, on the flows counted at the election that opened its term",
    tools: chipBand(0)
  }, tppStory && React.createElement(RdHed, {
    head: tppStory.head,
    dek: tppStory.dek
  }), React.createElement("div", {
    className: "rd-cyc-one"
  }, chart("tpp", false)), bandKey("tpp"), React.createElement(RdFoot, {
    how: {
      term: "last-election-flows",
      from: "Past cycles"
    }
  }, "Every line is the implied two-party figure: each poll\u2019s primary votes read through the preferences counted at the election that opened its term, the only table anyone could have used at the time. The ", cur.year, " term follows ", govIn, "\u2019s main rival, as the headline does: the Coalition, unless One Nation runs ", govIn, " clearly closer after preferences. Each line\u2019s dotted start runs from the election\u2019s counted result to the term\u2019s first poll, and a past line\u2019s dotted end runs from its final poll to the closing election\u2019s count.")), React.createElement(RdSec, {
    id: "cyc-primary",
    title: "Primary vote",
    meta: "First preferences for the governing party and the main opposition party",
    tools: chipBand(1)
  }, primStory && React.createElement(RdHed, {
    head: primStory.head,
    dek: primStory.dek
  }), React.createElement("div", {
    className: "rd-cyc-two"
  }, chart("primary", true, "primary"), chart("oppr", true, "primary")), React.createElement(RdEventList, {
    list: PAIRS.primary.list,
    inline: true,
    onPick: pickEvOf.primary,
    openKey: openKeyOf(["primary", "oppr"])
  }), bandKey("primary"), React.createElement(RdFoot, {
    how: {
      term: "what-am-i-looking-at",
      from: "Past cycles"
    }
  }, "Past terms are the governing party and the main opposition party of the day. A month with no poll is filled in from the months either side, and a drawn term shows that stretch dashed. The dotted start of each line runs from the election\u2019s counted result to the term\u2019s first poll; the dotted end of a past line runs from its final poll to the closing election\u2019s count.")), React.createElement(RdSec, {
    id: "cyc-leaders",
    title: "Leadership",
    meta: "Net approval since 1972 and preferred PM since 1984, for whoever held the office",
    tools: chipBand(2)
  }, leadStory && React.createElement(RdHed, {
    head: leadStory.head,
    dek: leadStory.dek
  }), React.createElement("div", {
    className: "rd-cyc-one"
  }, chart("net", false)), React.createElement("div", {
    className: "rd-cyc-one"
  }, chart("pmlead", false)), React.createElement("div", {
    className: "rd-cyc-two rd-cyc-subs"
  }, React.createElement("div", null, React.createElement(RdSub, {
    head: "Preferred prime minister",
    dek: "The prime minister\u2019s lead over the opposition leader on the question of who would make the better PM. Asked since 1984."
  }), chart("ppmm", true, "leaders")), React.createElement("div", null, React.createElement(RdSub, {
    head: "Opposition leader\u2019s net approval",
    dek: "Approve minus disapprove, for whoever led the opposition at the time. Rated since 1972."
  }), chart("oppnet", true, "leaders"))), React.createElement(RdEventList, {
    list: PAIRS.leaders.list,
    inline: true,
    onPick: pickEvOf.leaders,
    openKey: openKeyOf(["ppmm", "oppnet"])
  }), bandKey("leaders"), React.createElement(RdFoot, {
    how: {
      term: "approval",
      from: "Past cycles"
    }
  }, "Where a term changed leader its line follows whoever held the office. The earliest terms\u2019 ratings are the Morgan Gallup Poll\u2019s; later terms pool every pollster that asked, each corrected for its lean. Favourability ratings are left out. The prime minister\u2019s lead rates him against the stronger of the opposition leader and Pauline Hanson at each reading - Hanson only from this term\u2019s polls, so every earlier term\u2019s rival is the opposition leader.")), accuracy);
}
Object.assign(window, {
  RdCycleChart,
  RdPastCycles,
  rdCycPeers,
  rdCycRank
});