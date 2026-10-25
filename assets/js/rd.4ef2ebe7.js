function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function RdSec({
  id,
  cls,
  first,
  title,
  meta,
  tools,
  children,
  labelledBy,
  facet,
  dblCycle
}) {
  const hid = React.useId();
  const tapRef = React.useRef(null);
  const cycProps = !dblCycle ? null : {
    onDoubleClick: e => {
      if (e.target.closest("button, a, input, select, textarea, svg")) return;
      const c = tapRef.current ? tapRef.current.c || 0 : 0;
      if (c && e.timeStamp - c < 300) return;
      tapRef.current = null;
      dblCycle();
    },
    onPointerUp: e => {
      if (e.pointerType === "mouse" || e.target.closest("button, a, input, select, textarea, svg")) return;
      const p = tapRef.current,
        now = e.timeStamp;
      if (p && p.t && now - p.t < 350 && Math.hypot(e.clientX - p.x, e.clientY - p.y) < 24) {
        tapRef.current = {
          c: now
        };
        dblCycle();
        return;
      }
      tapRef.current = {
        t: now,
        x: e.clientX,
        y: e.clientY
      };
    }
  };
  return React.createElement("section", _extends({
    className: "rd-sec" + (first ? " rd-first" : "") + (cls ? " " + cls : ""),
    id: id,
    "aria-labelledby": labelledBy || hid,
    "data-facet": facet
  }, cycProps), React.createElement("div", {
    className: "rd-eyebrow"
  }, React.createElement("h2", {
    className: "rd-title",
    id: hid
  }, title), meta ? React.createElement("span", {
    className: "rd-meta"
  }, meta) : null, tools ? React.createElement("span", {
    className: "rd-eyebrow-tools"
  }, tools) : null), children);
}
const rdWords = v => {
  if (v == null || typeof v === "boolean") return "";
  if (typeof v === "string" || typeof v === "number") return String(v);
  if (Array.isArray(v)) {
    let s = "";
    for (const x of v) {
      const w = rdWords(x);
      if (w === undefined) return undefined;
      s += w;
    }
    return s;
  }
  if (typeof v === "object" && v.props) {
    const t = v.type;
    let s = "<" + (typeof t === "string" ? t : t && (t.displayName || t.name) || "?");
    for (const k in v.props) {
      const p = v.props[k];
      if (k !== "children" && (typeof p === "string" || typeof p === "number")) s += " " + k + "=" + p;
    }
    const c = rdWords(v.props.children);
    return c === undefined ? undefined : s + ">" + c + "</>";
  }
  return undefined;
};
function RdHed({
  head,
  dek,
  level = 3
}) {
  const H = "h" + level;
  const w0 = rdWords(head),
    w1 = rdWords(dek);
  return React.createElement(RdGlide, {
    watch: w0 !== undefined && w1 !== undefined ? w0 + "\u0000" + w1 : undefined
  }, head ? React.createElement(H, {
    className: "rd-hed"
  }, head) : null, dek ? React.createElement("p", {
    className: "rd-dek"
  }, dek) : null);
}
function RdSub({
  head,
  dek,
  level = 4,
  glide
}) {
  const H = "h" + level;
  const body = React.createElement(React.Fragment, null, head ? React.createElement(H, {
    className: "rd-sub"
  }, head) : null, dek ? React.createElement("p", {
    className: "rd-subdek"
  }, dek) : null);
  if (!glide) return body;
  const w0 = rdWords(head),
    w1 = rdWords(dek);
  return React.createElement(RdGlide, {
    watch: w0 !== undefined && w1 !== undefined ? w0 + "\u0000" + w1 : undefined
  }, body);
}
function rdHoldSection(el, dh, ms) {
  const sec = el.closest(".rd-sec") || null;
  if (!sec) return;
  const h = sec.getBoundingClientRect().height;
  const need = Math.max(h, h + dh);
  const hold = sec.__rdHold || (sec.__rdHold = {
    h: 0,
    t: 0
  });
  hold.h = Math.max(hold.h, need);
  sec.style.minHeight = hold.h + "px";
  clearTimeout(hold.t);
  hold.t = setTimeout(() => {
    sec.style.minHeight = "";
    sec.__rdHold = null;
  }, ms);
}
let rdPinRaf = 0;
let rdPinAnchorSave = null;
let rdPinRO = null;
let rdPinHeld = null;
let rdPinLive = 0;
let rdPinDone = null;
let rdPinAt = null;
const RD_PIN_STICKY = ".tabs.sticky,.info-index,.rd-ap-headwrap,.poll-table thead th";
const RD_TOUCH_SLIDE_DX = 60;
let rdTouchHot = 0,
  rdTouchFrom = null;
window.addEventListener("touchstart", e => {
  const t = e.touches && e.touches[0];
  rdTouchFrom = e.touches && e.touches.length === 1 && t ? {
    x: t.clientX,
    y: t.clientY
  } : null;
}, {
  passive: true
});
window.addEventListener("touchmove", e => {
  if (!rdTouchFrom || e.touches.length !== 1) {
    rdTouchFrom = null;
    return;
  }
  const t = e.touches[0];
  const dx = t.clientX - rdTouchFrom.x,
    dy = t.clientY - rdTouchFrom.y;
  if (Math.abs(dx) >= RD_TOUCH_SLIDE_DX && Math.abs(dy) <= Math.abs(dx) * 0.5) rdTouchHot = performance.now() + 220;
}, {
  passive: true
});
window.addEventListener("touchend", e => {
  const t = e.changedTouches && e.changedTouches[0];
  if (rdTouchFrom && t) {
    const dx = t.clientX - rdTouchFrom.x,
      dy = t.clientY - rdTouchFrom.y;
    if (Math.abs(dx) >= RD_TOUCH_SLIDE_DX && Math.abs(dy) <= Math.abs(dx) * 0.5) rdTouchHot = performance.now() + 220;
  }
  rdTouchFrom = null;
}, {
  passive: true
});
window.addEventListener("touchcancel", () => {
  rdTouchFrom = null;
}, {
  passive: true
});
const rdPinClip = (row, rowTop) => {
  const held = rdPinHeld || (rdPinHeld = []);
  const freeze = (o, r) => {
    if (o.__rdFrozen) return;
    o.__rdFrozen = true;
    o.style.transition = "none";
    o.style.overflowY = "clip";
    o.style.overflowX = "clip";
    o.style.height = r.height + "px";
    held.push(o);
  };
  const barR = (() => {
    const b = document.querySelector(".tabs.sticky");
    return b && b.getBoundingClientRect();
  })();
  const visTop = barR ? Math.min(barR.bottom, barR.height) : 0;
  const onScreen = r => r.bottom > visTop + 6;
  const freezeOnScreen = performance.now() < rdTouchHot;
  document.querySelectorAll(".rd-glide-in").forEach(i => {
    const o = i.parentElement;
    if (!o) return;
    const r = o.getBoundingClientRect();
    if (r.bottom > rowTop + 1 || !freezeOnScreen && onScreen(r)) return;
    freeze(o, r);
  });
  for (let node = row; node && node !== document.body;) {
    const parent = node.parentElement;
    if (!parent || parent === document.body) break;
    for (let sib = parent.firstElementChild; sib && sib !== node; sib = sib.nextElementSibling) {
      if (sib.__rdFrozen) continue;
      const r = sib.getBoundingClientRect();
      if (!r.height || r.bottom > rowTop + 1 || !freezeOnScreen && onScreen(r)) continue;
      if (sib.matches(RD_PIN_STICKY) || sib.querySelector(RD_PIN_STICKY)) continue;
      freeze(sib, r);
    }
    node = parent;
  }
};
const rdPinThaw = () => {
  if (!rdPinHeld) return;
  const held = rdPinHeld;
  rdPinHeld = null;
  held.forEach(o => {
    o.__rdFrozen = false;
    o.style.transition = "";
    o.style.height = "";
    o.style.overflowY = "";
    o.style.overflowX = "";
  });
};
function rdPinScroll(row, fine) {
  if (!row) return;
  if (!fine && window.matchMedia && !window.matchMedia("(pointer: coarse)").matches) return;
  if (rdPinRaf !== 0 && rdPinDone) {
    const end = rdPinDone;
    rdPinDone = null;
    cancelAnimationFrame(rdPinRaf);
    end();
  }
  const bar = document.querySelector(".tabs.sticky");
  const reserve = () => {
    const r = bar && bar.getBoundingClientRect();
    return r ? Math.min(r.bottom, r.height) : 0;
  };
  let list = null;
  if (Array.isArray(row)) {
    list = row.filter(el => el);
    row = list.find(el => {
      const r = el.getBoundingClientRect();
      return r.bottom >= reserve() && r.top <= window.innerHeight;
    });
  }
  if (!row) return;
  const want0 = row.getBoundingClientRect();
  if (want0.bottom < reserve() || want0.top > window.innerHeight) return;
  if (rdPinRaf === 0) rdPinLive++;
  cancelAnimationFrame(rdPinRaf);
  const at = {
    row
  };
  rdPinAt = at;
  const html = document.documentElement;
  if (rdPinAnchorSave === null) rdPinAnchorSave = html.style.overflowAnchor;
  html.style.overflowAnchor = "none";
  let want = want0.top,
    lastY = window.scrollY,
    lastIssued = 0,
    issueY = -1,
    eaten = 0;
  let lastDVal = NaN,
    lastDAt = 0;
  let tops = null;
  const reseat = () => {
    if (row.isConnected) return true;
    const next = tops && tops.find(t => t[0].isConnected);
    if (!next) return false;
    row = next[0];
    at.row = row;
    want = next[1];
    return true;
  };
  const retarget = delta => {
    want += delta;
    if (tops) for (let i = 0; i < tops.length; i++) tops[i][1] += delta;
  };
  const fix = () => {
    if (!reseat()) return;
    const d = row.getBoundingClientRect().top - want;
    const drift = Math.round(d);
    const y0 = window.scrollY;
    const now = performance.now();
    const quiet = window.scrollY !== issueY || eaten > 1 || now - lastIssued > 34;
    let still = 0;
    if (d !== lastDVal) {
      lastDVal = d;
      lastDAt = now;
    } else still = now - lastDAt;
    if (drift && Math.abs(d) >= 3) {
      window.scrollTo(0, Math.round(y0 + d));
      lastIssued = now;
      issueY = y0;
      eaten = 0;
      lastY = window.scrollY;
    } else if (d && quiet && still > 40) {
      retarget(d);
    }
  };
  rdPinClip(row, want0.top);
  fix();
  if (list) tops = list.map(el => [el, el.getBoundingClientRect().top]);
  if (rdPinRO) {
    rdPinRO.disconnect();
    rdPinRO = null;
  }
  if (typeof ResizeObserver !== "undefined") {
    rdPinRO = new ResizeObserver(() => {
      window.__rdPinROn = (window.__rdPinROn || 0) + 1;
      fix();
    });
    for (let el = row.parentElement; el && el !== document.body; el = el.parentElement) rdPinRO.observe(el);
  }
  const hook = el => {
    if (el && rdPinRO) rdPinRO.observe(el);
  };
  window.__rdPinObserve = hook;
  const done = () => {
    rdPinRaf = 0;
    rdPinDone = null;
    if (rdPinAt === at) rdPinAt = null;
    if (rdPinRO) {
      rdPinRO.disconnect();
      rdPinRO = null;
    }
    if (window.__rdPinObserve === hook) window.__rdPinObserve = null;
    if (--rdPinLive > 0) return;
    rdPinLive = 0;
    if (rdPinAnchorSave !== null) {
      html.style.overflowAnchor = rdPinAnchorSave;
      rdPinAnchorSave = null;
    }
    reseat();
    const was = row.isConnected ? row.getBoundingClientRect().top : 0;
    rdPinThaw();
    if (!row.isConnected) return;
    const thawD = row.getBoundingClientRect().top - was;
    if (Math.abs(thawD) >= 3) window.scrollTo(0, Math.round(window.scrollY + thawD));
  };
  const stop = performance.now() + (window.AP && window.AP.MORPH_MS || 320) + 240;
  const step = () => {
    if (!reseat()) {
      done();
      return;
    }
    const y = window.scrollY;
    const dy = y - lastY;
    if (Math.abs(dy) > window.innerHeight) {
      done();
      return;
    }
    if (dy && issueY === lastY) {
      retarget(0);
      eaten++;
    } else {
      want -= dy;
      if (tops) for (let i = 0; i < tops.length; i++) tops[i][1] -= dy;
    }
    lastY = y;
    fix();
    if (performance.now() < stop) rdPinRaf = requestAnimationFrame(step);else done();
  };
  rdPinDone = done;
  rdPinRaf = requestAnimationFrame(step);
}
function RdGlide({
  children,
  className,
  as,
  watch
}) {
  const Tag = as || "div";
  const outer = React.useRef(null),
    inner = React.useRef(null),
    last = React.useRef(null),
    timer = React.useRef(0);
  const seen = React.useRef({});
  React.useLayoutEffect(() => {
    const o = outer.current,
      i = inner.current;
    if (!o || !i) return;
    if (watch !== undefined && seen.current.w === watch && last.current != null) return;
    seen.current.w = watch;
    if (watch !== undefined && last.current == null && typeof ResizeObserver !== "undefined") return;
    const h = i.getBoundingClientRect().height;
    const prev = last.current;
    last.current = h;
    if (prev == null || Math.abs(prev - h) < 1) return;
    if (o.__rdFrozen) return;
    const AP = window.AP || {};
    if (AP.reduceMotion && AP.reduceMotion() || performance.now() - (window.__rdInput || 0) > 600) return;
    const cur = o.style.height ? o.getBoundingClientRect().height : prev;
    const pinRow = rdPinAt && rdPinAt.row;
    if (pinRow && pinRow.isConnected && !o.contains(pinRow)) {
      const was = [o.style.transition, o.style.height];
      o.style.transition = "none";
      o.style.height = "";
      const y1 = pinRow.getBoundingClientRect().top;
      o.style.height = cur + "px";
      if (Math.abs(pinRow.getBoundingClientRect().top - y1) >= 0.5) {
        clearTimeout(timer.current);
        o.style.transition = "";
        o.style.height = "";
        o.style.overflowY = "";
        o.style.overflowX = "";
        if (window.__rdPinObserve) window.__rdPinObserve(o);
        return;
      }
      o.style.transition = was[0];
      o.style.height = was[1];
    }
    rdHoldSection(o, h - cur, (AP.MORPH_MS || 320) + 80);
    clearTimeout(timer.current);
    o.style.transition = "none";
    o.style.overflowY = "clip";
    o.style.overflowX = "clip";
    o.style.height = cur + "px";
    void o.offsetHeight;
    o.style.transition = "height " + (AP.MORPH_MS || 320) + "ms " + (AP.MORPH_CSS || "ease");
    o.style.height = h + "px";
    if (window.__rdPinObserve) window.__rdPinObserve(o);
    timer.current = setTimeout(() => {
      o.style.transition = "";
      o.style.height = "";
      o.style.overflowY = "";
      o.style.overflowX = "";
    }, (AP.MORPH_MS || 320) + 60);
  });
  React.useEffect(() => {
    const i = inner.current,
      o = outer.current;
    if (!i || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(() => {
      const h = i.getBoundingClientRect().height;
      if (o && o.style.height && !o.__rdFrozen && Math.abs(h - (last.current || 0)) >= 1) {
        const AP = window.AP || {};
        o.style.height = h + "px";
        clearTimeout(timer.current);
        timer.current = setTimeout(() => {
          o.style.transition = "";
          o.style.height = "";
          o.style.overflowY = "";
          o.style.overflowX = "";
        }, (AP.MORPH_MS || 320) + 60);
      }
      last.current = h;
    });
    ro.observe(i);
    return () => {
      ro.disconnect();
      clearTimeout(timer.current);
    };
  }, []);
  return React.createElement(Tag, {
    ref: outer,
    className: className
  }, React.createElement("div", {
    ref: inner,
    className: "rd-glide-in"
  }, children));
}
function RdCrossfade({
  k,
  children,
  className
}) {
  const was = React.useRef({
    k,
    node: children
  });
  const fading = React.useRef(null);
  const timer = React.useRef(0);
  const [, force] = React.useReducer(x => x + 1, 0);
  const AP = window.AP || {};
  if (was.current.k !== k) {
    const still = AP.reduceMotion && AP.reduceMotion();
    fading.current = still ? null : {
      k: was.current.k,
      node: was.current.node,
      id: (fading.current ? fading.current.id : 0) + 1
    };
  }
  was.current = {
    k,
    node: children
  };
  React.useEffect(() => {
    const f = fading.current;
    if (!f || f.timed) return undefined;
    f.timed = true;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (fading.current === f) {
        fading.current = null;
        force();
      }
    }, (AP.MORPH_MS || 320) + 40);
    return undefined;
  });
  React.useEffect(() => () => clearTimeout(timer.current), []);
  const f = fading.current;
  return React.createElement(RdGlide, {
    watch: k
  }, React.createElement("div", {
    className: "rd-xf" + (className ? " " + className : "")
  }, React.createElement("div", {
    className: "rd-xf-now" + (f ? " in" : ""),
    key: "now-" + k
  }, children), f && React.createElement("div", {
    className: "rd-xf-was",
    key: "was-" + f.k + "-" + f.id,
    "aria-hidden": "true",
    inert: ""
  }, f.node)));
}
function RdSwap({
  k,
  children,
  className
}) {
  const was = React.useRef({
    k,
    node: children
  });
  const fading = React.useRef(null);
  const timer = React.useRef(0);
  const [, force] = React.useReducer(x => x + 1, 0);
  const AP = window.AP || {};
  if (was.current.k !== k) {
    const still = AP.reduceMotion && AP.reduceMotion();
    fading.current = still ? null : {
      k: was.current.k,
      node: was.current.node,
      id: (fading.current ? fading.current.id : 0) + 1
    };
  }
  was.current = {
    k,
    node: children
  };
  React.useEffect(() => {
    const f = fading.current;
    if (!f || f.timed) return undefined;
    f.timed = true;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (fading.current === f) {
        fading.current = null;
        force();
      }
    }, (AP.MORPH_MS || 320) + 40);
    return undefined;
  });
  React.useEffect(() => () => clearTimeout(timer.current), []);
  const f = fading.current;
  return React.createElement("div", {
    className: "rd-swap" + (className ? " " + className : "")
  }, React.createElement("div", {
    className: "rd-swap-now" + (f ? " in" : ""),
    key: "now-" + k
  }, children), f && React.createElement("div", {
    className: "rd-swap-was",
    key: "was-" + f.k + "-" + f.id,
    "aria-hidden": "true",
    inert: ""
  }, f.node));
}
if (typeof window !== "undefined" && !window.__rdInputWatch) {
  window.__rdInputWatch = true;
  const note = () => {
    window.__rdInput = performance.now();
  };
  window.addEventListener("pointerdown", note, true);
  window.addEventListener("keydown", note, true);
}
function RdSwatch({
  kind = "line",
  color = "var(--ink-3)"
}) {
  switch (kind) {
    case "dot":
      return React.createElement("svg", {
        width: "14",
        height: "14",
        viewBox: "0 0 14 14",
        "aria-hidden": "true"
      }, React.createElement("circle", {
        cx: "7",
        cy: "7",
        r: "2.5",
        style: {
          fill: color,
          opacity: 0.55
        }
      }));
    case "dot-solid":
      return React.createElement("svg", {
        width: "14",
        height: "14",
        viewBox: "0 0 14 14",
        "aria-hidden": "true"
      }, React.createElement("circle", {
        cx: "7",
        cy: "7",
        r: "5",
        style: {
          fill: color
        }
      }));
    case "dot-open":
      return React.createElement("svg", {
        width: "14",
        height: "14",
        viewBox: "0 0 14 14",
        "aria-hidden": "true"
      }, React.createElement("circle", {
        cx: "7",
        cy: "7",
        r: "4.5",
        style: {
          fill: "var(--bg)",
          stroke: color,
          strokeWidth: 2
        }
      }));
    case "ring":
      return React.createElement("svg", {
        width: "14",
        height: "14",
        viewBox: "0 0 14 14",
        "aria-hidden": "true"
      }, React.createElement("circle", {
        cx: "7",
        cy: "7",
        r: "4.5",
        style: {
          fill: "var(--bg)",
          stroke: "var(--ink)",
          strokeWidth: 2
        }
      }));
    case "diamond":
      return React.createElement("svg", {
        width: "14",
        height: "14",
        viewBox: "0 0 14 14",
        "aria-hidden": "true"
      }, React.createElement("path", {
        d: "M7 2L12 7L7 12L2 7Z",
        style: {
          fill: "var(--bg)",
          stroke: color,
          strokeWidth: 2,
          strokeLinejoin: "round"
        }
      }));
    case "band":
      return React.createElement("svg", {
        width: "24",
        height: "14",
        viewBox: "0 0 24 14",
        "aria-hidden": "true"
      }, React.createElement("rect", {
        x: "0",
        y: "2",
        width: "24",
        height: "10",
        rx: "2",
        style: {
          fill: color,
          opacity: 0.2
        }
      }));
    case "lineband":
      return React.createElement("svg", {
        width: "24",
        height: "14",
        viewBox: "0 0 24 14",
        "aria-hidden": "true"
      }, React.createElement("rect", {
        x: "0",
        y: "2",
        width: "24",
        height: "10",
        rx: "2",
        style: {
          fill: color,
          opacity: 0.2
        }
      }), React.createElement("path", {
        d: "M1 7H23",
        style: {
          stroke: color,
          strokeWidth: 2.5,
          strokeLinecap: "round"
        }
      }));
    case "dash":
      return React.createElement("svg", {
        width: "24",
        height: "14",
        viewBox: "0 0 24 14",
        "aria-hidden": "true"
      }, React.createElement("path", {
        d: "M1 7H23",
        style: {
          stroke: color,
          strokeWidth: 2,
          strokeDasharray: "4 3"
        }
      }));
    case "whisker":
      return React.createElement("svg", {
        width: "28",
        height: "16",
        viewBox: "0 0 28 16",
        "aria-hidden": "true"
      }, React.createElement("path", {
        d: "M2 8H26M2 4V12M26 4V12",
        style: {
          stroke: color,
          strokeWidth: 2,
          strokeLinecap: "round",
          fill: "none"
        }
      }));
    case "square":
      return React.createElement("span", {
        "aria-hidden": "true",
        style: {
          width: 14,
          height: 14,
          background: color,
          display: "inline-block",
          flexShrink: 0
        }
      });
    case "tick":
      return React.createElement("svg", {
        width: "12",
        height: "16",
        viewBox: "0 0 12 16",
        "aria-hidden": "true"
      }, React.createElement("path", {
        d: "M6 1V15",
        style: {
          stroke: "var(--ink)",
          strokeWidth: 2
        }
      }));
    default:
      return React.createElement("svg", {
        width: "24",
        height: "14",
        viewBox: "0 0 24 14",
        "aria-hidden": "true"
      }, React.createElement("path", {
        d: "M1 7H23",
        style: {
          stroke: color,
          strokeWidth: 2.5,
          strokeLinecap: "round"
        }
      }));
  }
}
function RdKey({
  items,
  children,
  className
}) {
  const item = (it, i) => it.href ? React.createElement("a", {
    key: i,
    className: "rd-key-item",
    href: it.href,
    target: "_blank",
    rel: "noopener noreferrer"
  }, React.createElement(RdSwatch, {
    kind: it.kind,
    color: it.color
  }), it.label) : React.createElement("span", {
    key: i,
    className: "rd-key-item"
  }, React.createElement(RdSwatch, {
    kind: it.kind,
    color: it.color
  }), it.label);
  return React.createElement("div", {
    className: "rd-key" + (className ? " " + className : "")
  }, items.filter(Boolean).map((it, i) => item(it, i)), children);
}
function RdHow({
  term,
  from,
  label = "How it’s built",
  href
}) {
  if (href) return React.createElement("a", {
    className: "rd-how",
    href: href
  }, label);
  return React.createElement("button", {
    type: "button",
    className: "rd-how",
    onClick: () => window.AP.openTerm && window.AP.openTerm(term, from || "the section")
  }, label);
}
function RdFoot({
  children,
  how
}) {
  return React.createElement(RdGlide, {
    watch: rdWords(children)
  }, React.createElement("div", {
    className: "rd-foot"
  }, children ? React.createElement("span", {
    className: "rd-foot-text"
  }, children) : null, React.createElement("span", {
    className: "rd-grow"
  }), how ? React.createElement(RdHow, how) : null));
}
function rdTabFocus(e) {
  const b = e.target && e.target.closest ? e.target.closest("button") : null;
  if (b) b.focus({
    preventScroll: true
  });
}
function rdTabsKey(options, onChange) {
  return e => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const btn = e.target && e.target.closest ? e.target.closest("button") : null;
    if (!btn) return;
    e.preventDefault();
    const btns = [...e.currentTarget.querySelectorAll("button")];
    const j = (btns.indexOf(btn) + (e.key === "ArrowRight" ? 1 : -1) + btns.length) % btns.length;
    if (!btns[j] || !options[j]) return;
    onChange(options[j].id);
    btns[j].focus({
      preventScroll: true
    });
  };
}
function rdDigitKey(items, onChange) {
  return e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const n = e.key >= "1" && e.key <= "9" ? e.key.charCodeAt(0) - 48 : 0;
    if (!n || !items[n - 1]) return;
    e.preventDefault();
    onChange(items[n - 1].id);
  };
}
function useHoverClaim(secId, ready, keys, step, deps) {
  const hover = React.useRef(false);
  React.useEffect(() => {
    const sec = document.getElementById(secId);
    if (!sec || !ready) return undefined;
    const enter = () => {
      hover.current = true;
    };
    const leave = () => {
      hover.current = false;
    };
    hover.current = sec.matches(":hover");
    sec.addEventListener("pointerenter", enter);
    sec.addEventListener("pointerleave", leave);
    const arrow = k => k === "ArrowRight" || k === "ArrowLeft";
    const key = e => {
      if (!hover.current || !(keys ? keys(e.key) : arrow(e.key))) return;
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const a = document.activeElement;
      if (a && a.tagName !== "BODY" && a.tagName !== "HTML") return;
      const sel = window.getSelection && window.getSelection();
      if (sel && !sel.isCollapsed) return;
      if (step(e)) e.preventDefault();
    };
    document.addEventListener("keydown", key, true);
    return () => {
      sec.removeEventListener("pointerenter", enter);
      sec.removeEventListener("pointerleave", leave);
      document.removeEventListener("keydown", key, true);
    };
  }, deps);
}
const RD_SPACE_CLAIMS = [];
function rdSpaceClaimOn(id) {
  if (!RD_SPACE_CLAIMS.includes(id)) RD_SPACE_CLAIMS.push(id);
}
function rdSpaceClaimOff(id) {
  const i = RD_SPACE_CLAIMS.indexOf(id);
  if (i >= 0) RD_SPACE_CLAIMS.splice(i, 1);
}
function rdSpaceDominant(id) {
  const vh = window.innerHeight;
  let mine = -1,
    best = -1;
  for (const sid of RD_SPACE_CLAIMS) {
    const el = document.getElementById(sid);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    const vis = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
    if (sid === id) mine = vis;else if (vis > best) best = vis;
  }
  return mine >= 0 && mine >= best;
}
const RdTabW = ({
  t
}) => React.createElement("span", {
  className: "rd-tab-w",
  "data-t": t
}, t);
function RdTabs({
  value,
  onChange,
  options,
  ariaLabel,
  children,
  className,
  swipe,
  swipeSelf,
  pin,
  onDigits
}) {
  const live = React.useRef(null);
  const root = React.useRef(null);
  const fire = React.useMemo(() => pin ? id => {
    if (root.current) rdPinScroll(root.current);
    onChange(id);
  } : onChange, [pin, onChange]);
  live.current = dir => {
    const i = options.findIndex(o => o.id === value);
    if (i < 0 || options.length < 2) return false;
    fire(options[(i + dir + options.length) % options.length].id);
    return true;
  };
  const mark = React.useCallback(el => {
    root.current = el;
    if (el) el.__rdSwipe = dir => live.current(dir);
  }, []);
  return React.createElement("div", {
    className: "rd-tabs" + (className ? " " + className : ""),
    ref: swipe || swipeSelf || pin ? mark : undefined,
    "data-rd-swipe": swipe ? "" : undefined,
    "data-rd-swipe-self": swipeSelf ? "" : undefined,
    onKeyDown: onDigits || undefined
  }, React.createElement("div", {
    role: "group",
    "aria-label": ariaLabel,
    style: {
      display: "flex",
      gap: 4
    },
    onKeyDown: rdTabsKey(options, fire),
    onClick: rdTabFocus
  }, options.map(o => React.createElement("button", {
    key: o.id,
    type: "button",
    className: "rd-tab",
    "aria-pressed": value === o.id,
    onClick: () => fire(o.id),
    title: o.title
  }, typeof o.label === "string" ? React.createElement(RdTabW, {
    t: o.label
  }) : o.label))), children ? React.createElement(React.Fragment, null, React.createElement("span", {
    className: "rd-tabs-grow"
  }), children) : null);
}
const RD_NUM_WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty"];
const rdNumWord = n => RD_NUM_WORDS[n] || String(n);
const rdCap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
function rdFracSnap(p) {
  const cands = [[1, 2], [1, 3], [2, 3], [1, 4], [3, 4], [1, 5], [2, 5], [3, 5], [4, 5], [1, 6], [1, 7], [1, 8], [1, 9], [1, 10], [3, 10], [7, 10], [9, 10], [1, 12], [1, 15], [1, 20]];
  let best = null;
  for (const [a, b] of cands) {
    const err = Math.abs(p / 100 - a / b);
    if (!best || err < best.err) best = {
      a,
      b,
      err
    };
  }
  return best;
}
function rdFraction(p) {
  const best = rdFracSnap(p);
  const exact = best.err < 0.012;
  return (exact ? "" : "about ") + rdNumWord(best.a) + " in " + rdNumWord(best.b);
}
const rdArrow = v => v > 0 ? "▲" : v < 0 ? "▼" : "→";
function rdDate(iso, withYear) {
  const t = new Date(Date.parse(iso));
  const D = window.AUSPOL;
  return t.getUTCDate() + " " + D.monthName(t.getUTCMonth() + 1) + (withYear ? " " + t.getUTCFullYear() : "");
}
function rdPointsPhrase(g) {
  if (g <= 0.5) return "half a point";
  if (g <= 1) return "a point";
  if (g <= 1.5) return "a point and a half";
  if (g <= 2) return "two points";
  if (g <= 3) return "three points";
  return null;
}
function rdXTicks(x0, x1, narrow, opts) {
  const D = window.AUSPOL;
  const o = opts || {};
  const months = D.MONTHS.map(ym => ({
    ym,
    x: D.mx(ym)
  })).filter(m => m.x >= x0 - 0.02 && m.x <= x1);
  const span = x1 - x0;
  const step = o.step || (span > 1.1 ? narrow ? 6 : 3 : span > 0.6 ? narrow ? 3 : 2 : span > 0.3 ? narrow ? 2 : 1 : 1);
  const keep = months.filter(m => (Number(m.ym.slice(5)) - 1) % step === 0);
  return keep.map((m, i) => {
    const [y, mo] = m.ym.split("-").map(Number);
    const yr = narrow ? " ’" + String(y).slice(2) : " " + y;
    return {
      x: m.x,
      label: D.monthName(mo) + (mo === 1 || i === 0 ? yr : "")
    };
  });
}
function rdYTicks(lo, hi, step) {
  const out = [];
  for (let v = lo; v <= hi + 1e-9; v += step) out.push(+v.toFixed(6));
  return out;
}
function rdEventBadges(idKey, events, x0, x1) {
  const inWin = (events || []).filter(e => e.x >= x0 && e.x <= x1).sort((a, b) => a.x - b.x);
  const memo = rdEventBadges.memo || (rdEventBadges.memo = {});
  const memKey = idKey + "|" + x0.toFixed(4) + "|" + x1.toFixed(4) + "|" + inWin.map(e => e.date).join(",");
  if (memo[memKey]) return memo[memKey];
  if (Object.keys(memo).length > 120) rdEventBadges.memo = {};
  const out = inWin.map((e, i) => ({
    ...e,
    badge: i + 1,
    badgeLead: true,
    badgeKey: idKey + "-" + e.date
  }));
  const list = out.map(e => ({
    n: e.badge,
    date: e.date,
    labels: [/→/.test(e.short || "") || !e.short ? e.label : e.short],
    evs: [e]
  }));
  const result = {
    events: out,
    list
  };
  rdEventBadges.memo[memKey] = result;
  return result;
}
function rdChartEvents(events, x0, x1) {
  const KEPT = ["2026-02-12", "2025-12-08"];
  return (events || []).filter(e => (e.major || KEPT.includes(e.date)) && e.x >= x0 - 0.02 && e.x <= x1 + 0.02);
}
function RdEventList({
  list,
  inline,
  from,
  mix,
  onPick,
  openKey
}) {
  if (!list || !list.length) return null;
  const dateOf = l => rdDate(l.date, true);
  const row = (l, i) => {
    const d = dateOf(l);
    const on = !!(openKey && l.evs && l.evs.some(e => e.badgeKey === openKey));
    return onPick && l.evs && l.evs.length ? React.createElement("li", {
      key: l.n
    }, React.createElement("button", {
      type: "button",
      className: "rd-evlist-b" + (on ? " on" : ""),
      "aria-pressed": on,
      onClick: () => onPick(l.evs[0])
    }, React.createElement("span", {
      className: "rd-evlist-n"
    }, l.n), React.createElement("span", {
      className: "rd-evlist-l"
    }, l.labels.join(", ")), React.createElement("span", {
      className: "rd-evlist-d"
    }, d))) : React.createElement("li", {
      key: l.n
    }, React.createElement("span", {
      className: "rd-evlist-n"
    }, l.n), React.createElement("span", {
      className: "rd-evlist-l"
    }, l.labels.join(", ")), React.createElement("span", {
      className: "rd-evlist-d"
    }, d));
  };
  const ol = (l0, st, hidden, pick) => React.createElement("ol", {
    className: "rd-evlist" + (inline ? " inline" : ""),
    style: st,
    "aria-hidden": hidden || undefined
  }, l0.map((l, i) => pick ? row(l, i) : React.createElement("li", {
    key: l.n
  }, React.createElement("span", {
    className: "rd-evlist-n"
  }, l.n), React.createElement("span", {
    className: "rd-evlist-l"
  }, l.labels.join(", ")), React.createElement("span", {
    className: "rd-evlist-d"
  }, dateOf(l)))));
  const same = from && from.length === list.length && from.every((l, i) => l.n === list[i].n && l.date === list[i].date && l.labels.join() === list[i].labels.join());
  if (!from || same || mix >= 1) return ol(list, undefined, undefined, !!onPick);
  return React.createElement("div", {
    className: "rd-evstack"
  }, ol(from, {
    opacity: 1 - mix,
    pointerEvents: "none"
  }, true), ol(list, {
    opacity: mix
  }, undefined, !!onPick));
}
function RdCheck({
  checked,
  onChange,
  children,
  title
}) {
  return React.createElement("label", {
    className: "rd-check",
    title: title
  }, React.createElement("input", {
    type: "checkbox",
    checked: !!checked,
    onChange: e => onChange(e.target.checked)
  }), React.createElement("span", null, children));
}
function RdSwitch({
  on,
  onToggle,
  label
}) {
  return React.createElement("button", {
    type: "button",
    role: "switch",
    "aria-checked": !!on,
    "aria-label": label,
    className: "rd-switch",
    onClick: onToggle
  }, React.createElement("span", null));
}
function RdTerm({
  id,
  from,
  children,
  title
}) {
  return React.createElement("button", {
    type: "button",
    className: "rd-term",
    title: title,
    onClick: e => {
      e.preventDefault();
      window.AP.openTerm && window.AP.openTerm(id, from || "the page");
    }
  }, children);
}
function RdQPop({
  label,
  children,
  align
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  const panel = React.useRef(null);
  window.useDismissOutside(ref, open, () => setOpen(false));
  React.useEffect(() => {
    if (!open) return undefined;
    const esc = e => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [open]);
  React.useLayoutEffect(() => {
    const el = panel.current;
    if (!open || !el) return undefined;
    el.style.translate = "";
    const r = el.getBoundingClientRect();
    let dx = 0;
    if (r.right > window.innerWidth - 8) dx = window.innerWidth - 8 - r.right;
    if (r.left + dx < 8) dx += 8 - (r.left + dx);
    if (dx) el.style.translate = dx + "px 0";
    return undefined;
  }, [open]);
  return React.createElement("span", {
    className: "rd-qpop",
    ref: ref
  }, React.createElement("button", {
    type: "button",
    className: "rd-qbtn",
    "aria-label": label,
    "aria-expanded": open,
    onClick: () => setOpen(o => !o)
  }, React.createElement("span", null, "?")), open && React.createElement("div", {
    ref: panel,
    className: "rd-qpanel" + (align ? " " + align : ""),
    role: "dialog",
    "aria-label": label
  }, children));
}
function rdEventReveal(id) {
  requestAnimationFrame(() => {
    const el = document.getElementById(id);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 88;
    if (top < window.scrollY) window.scrollTo({
      top,
      behavior: SM
    });
  });
}
Object.assign(window, {
  RdSec,
  RdHed,
  RdSub,
  RdSwatch,
  RdKey,
  RdHow,
  RdFoot,
  RdTabs,
  RdTabW,
  RdGlide,
  RdCrossfade,
  rdTabsKey,
  rdTabFocus,
  rdDigitKey,
  useHoverClaim,
  rdSpaceClaimOn,
  rdSpaceClaimOff,
  rdSpaceDominant,
  rdNumWord,
  rdCap,
  rdFraction,
  rdSigned,
  rdArrow,
  rdDate,
  rdMonthYear,
  rdPointsPhrase,
  rdXTicks,
  rdYTicks,
  rdEventBadges,
  rdChartEvents,
  RdEventList,
  rdEventReveal,
  RdCheck,
  RdSwitch,
  RdTerm,
  RdQPop
});