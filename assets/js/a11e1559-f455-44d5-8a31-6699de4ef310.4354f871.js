function useRadioGroup(options, value, onChange) {
  const refs = useRef({});
  const ids = options.map(o => o.id);
  const onKeyDown = e => {
    const i = ids.indexOf(value);
    let next = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = ids[(i + 1) % ids.length];else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = ids[(i - 1 + ids.length) % ids.length];else if (e.key === "Home") next = ids[0];else if (e.key === "End") next = ids[ids.length - 1];
    if (next == null) return;
    e.preventDefault();
    onChange(next);
    const el = refs.current[next];
    if (el) el.focus();
  };
  return {
    onKeyDown,
    tabIndexFor: id => id === value || ids.indexOf(value) < 0 && id === ids[0] ? 0 : -1,
    refFor: id => el => {
      refs.current[id] = el;
    }
  };
}
function Segmented({
  options,
  value,
  onChange,
  size,
  ariaLabel
}) {
  const rg = useRadioGroup(options, value, onChange);
  return React.createElement("div", {
    className: "segmented" + (size === "sm" ? " segmented-sm" : ""),
    role: "radiogroup",
    "aria-label": ariaLabel,
    onKeyDown: rg.onKeyDown
  }, options.map(o => React.createElement("button", {
    key: o.id,
    role: "radio",
    "aria-checked": value === o.id,
    tabIndex: rg.tabIndexFor(o.id),
    ref: rg.refFor(o.id),
    className: "seg-btn" + (value === o.id ? " active" : ""),
    onClick: () => onChange(o.id)
  }, o.label)));
}
function toggleLabel(label) {
  if (typeof label === "string" && / v /.test(label)) {
    const [a, b] = label.split(" v ");
    return React.createElement(React.Fragment, null, React.createElement("span", {
      className: "party-tok"
    }, a), React.createElement("span", {
      className: "tt-vs"
    }, "v"), React.createElement("span", {
      className: "party-tok"
    }, b));
  }
  return label;
}
function TextToggle({
  options,
  value,
  onChange,
  caps,
  ariaLabel,
  className
}) {
  const rg = useRadioGroup(options, value, onChange);
  return React.createElement("div", {
    className: "text-toggle" + (caps ? " tt-caps" : "") + (className ? " " + className : ""),
    role: "radiogroup",
    "aria-label": ariaLabel,
    onKeyDown: rg.onKeyDown
  }, options.map((o, i) => React.createElement(React.Fragment, {
    key: o.id
  }, i > 0 && React.createElement("span", {
    className: "tt-div",
    "aria-hidden": "true"
  }), React.createElement("button", {
    role: "radio",
    "aria-checked": value === o.id,
    tabIndex: rg.tabIndexFor(o.id),
    ref: rg.refFor(o.id),
    className: "tt-opt" + (value === o.id ? " active" : ""),
    onClick: () => onChange(o.id)
  }, o.dots && o.dots.length === 2 ? React.createElement(React.Fragment, null, React.createElement("span", {
    className: "tt-dot tt-dot-l",
    "aria-hidden": "true",
    style: {
      background: o.dots[0]
    }
  }), toggleLabel(o.label), React.createElement("span", {
    className: "tt-dot tt-dot-r",
    "aria-hidden": "true",
    style: {
      background: o.dots[1]
    }
  })) : React.createElement(React.Fragment, null, o.dots && React.createElement("span", {
    className: "tt-dots",
    "aria-hidden": "true"
  }, o.dots.map((c, k) => React.createElement("span", {
    key: k,
    className: "tt-dot",
    style: {
      background: c
    }
  }))), toggleLabel(o.label))))));
}
function seriesNN(pts, key) {
  return pts.map(d => ({
    x: d.x,
    y: d[key]
  })).filter(p => p.y != null);
}
function seriesYm(pts, key) {
  return pts.map(d => ({
    ym: d.ym,
    x: d.x,
    y: d[key]
  })).filter(p => p.y != null);
}
function lastReadings(rows, key) {
  const nn = rows.filter(r => r[key] != null);
  if (!nn.length) return null;
  const last = nn[nn.length - 1],
    prev = nn[nn.length - 2];
  return {
    v: last[key],
    ym: last.ym,
    prev: prev ? prev[key] : null,
    prevYm: prev ? prev.ym : null
  };
}
function leaderReading(rows, key) {
  const N = window.AP.D.leaderNow && window.AP.D.leaderNow[key];
  if (N) return {
    v: N.v,
    ym: null,
    prev: N.prev,
    prevYm: null,
    now: N
  };
  return lastReadings(rows, key);
}
function nowDeltaTitle(now) {
  if (!now || now.chg == null) return undefined;
  return "Change on a month ago – the same estimate, built the same way, 30 days earlier" + (now.changeSig === false ? " (within the margin)" : "");
}
function readoutDeltaTitle(r) {
  if (r && r.now) return nowDeltaTitle(r.now);
  if (!r || r.prevYm == null) return undefined;
  return "Change since " + window.AP.monthLabelFull(r.prevYm) + " – this leader's previous published monthly reading across all pollsters," + " not one pollster's own last poll";
}
function staleTag(ym, latestYm) {
  if (!ym || ym === latestYm) return null;
  return window.AP.D.monthName(Number(ym.slice(5, 7)));
}
function fitDomain(vals, step, include) {
  let lo = Math.min(...vals),
    hi = Math.max(...vals);
  if (include != null) {
    lo = Math.min(lo, include);
    hi = Math.max(hi, include);
  }
  const d0 = Math.floor((lo - step * 0.4) / step) * step;
  const d1 = Math.ceil((hi + step * 0.4) / step) * step;
  const ticks = [];
  for (let v = d0 + step; v < d1 - 1e-9; v += step) ticks.push(v);
  return {
    domain: [d0, d1],
    ticks
  };
}
function HowTo({
  label = "How to read this chart",
  cls = "table-hint",
  paras
}) {
  return React.createElement("details", {
    className: "view-how hint-how"
  }, React.createElement("summary", null, label), paras.filter(Boolean).map((p, i) => React.createElement("p", {
    key: i,
    className: cls
  }, p)));
}
function Story({
  head,
  dek
}) {
  if (!head && !dek) return null;
  return React.createElement("div", {
    className: "story"
  }, head && React.createElement("h3", {
    className: "story-head"
  }, head), dek && React.createElement("p", {
    className: "story-dek"
  }, dek));
}
function Delta({
  value,
  suffix = "",
  goodUp = true,
  neutral,
  small,
  title,
  roll,
  spinIn
}) {
  if (value == null) return null;
  const up = value > 0,
    flat = Math.abs(value) < 0.05;
  const cls = flat || neutral ? "flat" : up === goodUp ? "up" : "down";
  const arrow = flat ? "→" : up ? "▲" : "▼";
  const figure = `${up ? "+" : ""}${value.toFixed(1)}`;
  const Roll = window.RollNum;
  return React.createElement("span", {
    className: "delta " + cls + (small ? " delta-sm" : ""),
    title: flat && roll ? "No change" + (title ? ", " + title : "") : title
  }, React.createElement("span", {
    className: "delta-arrow"
  }, arrow), flat ? roll ? "0.0" : "no change" : roll && Roll ? React.createElement(React.Fragment, null, React.createElement(Roll, {
    value: figure,
    spinIn: spinIn
  }), suffix) : figure + suffix);
}