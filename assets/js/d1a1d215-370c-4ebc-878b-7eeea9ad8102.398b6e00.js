const writeUrl = (verb, to) => {
  try {
    history[verb](null, "", to);
  } catch {}
};
const csvCell = v => {
  if (v == null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
const csvText = rows => "\uFEFF" + rows.map(r => r.map(csvCell).join(",")).join("\r\n");
const downloadCsv = (filename, rows) => {
  const blob = new Blob([csvText(rows)], {
    type: "text/csv;charset=utf-8"
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
const DownloadIcon = () => React.createElement("svg", {
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
  d: "M12 3v12M12 15l-4-4M12 15l4-4M4 19h16"
}));
function TabScore({
  onGoHero,
  matchup,
  tppBasis = "imp"
}) {
  const MM = window.AP.tppMatchups;
  const tppNow = id => window.AP.tppLatest(id, tppBasis);
  const id = MM && MM[matchup] && tppNow(matchup) ? matchup : "alp_lnp";
  const M = MM[id],
    v = tppNow(id);
  return React.createElement("button", {
    className: "tab-score",
    onClick: onGoHero,
    title: "Latest " + M.label + " two-party preferred – go to Now"
  }, React.createElement("span", {
    className: "ts-eyebrow"
  }, "2PP"), React.createElement("span", {
    className: "ts-party"
  }, React.createElement("span", {
    className: "ts-abbr"
  }, M.a.abbr), React.createElement("span", {
    className: "ts-num",
    style: {
      color: inkOf(M.a.color)
    }
  }, v.a.toFixed(1))), React.createElement("span", {
    className: "ts-sep",
    "aria-hidden": "true"
  }), React.createElement("span", {
    className: "ts-party"
  }, React.createElement("span", {
    className: "ts-num",
    style: {
      color: inkOf(M.b.color)
    }
  }, v.b.toFixed(1)), React.createElement("span", {
    className: "ts-abbr"
  }, M.b.abbr)));
}
let pinScaleProbe = null;
function pinnedSetScale() {
  if (!pinScaleProbe) {
    const nav = document.createElement("div");
    nav.className = "tabs pinned";
    nav.setAttribute("aria-hidden", "true");
    nav.style.cssText = "position:absolute;left:-9999px;top:-9999px;" + "visibility:hidden;pointer-events:none";
    nav.innerHTML = '<div class="tabs-inner"><div class="tabs-set"></div></div>';
    document.body.appendChild(nav);
    pinScaleProbe = nav.firstChild.firstChild;
  }
  const t = getComputedStyle(pinScaleProbe).transform;
  if (!t || t === "none") return 1;
  const m = new DOMMatrixReadOnly(t);
  return m.a || 1;
}
function NextPollTicker({
  showScore
}) {
  const [, tick] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(() => tick(x => x + 1), 60000);
    return () => clearInterval(id);
  }, []);
  const [fit, setFit] = React.useState(0);
  const rootRef = React.useRef(null);
  const proj = window.AP.nextPolls ? window.AP.nextPolls() : null;
  const items = window.AP.nextPollItems ? window.AP.nextPollItems(proj) : [];
  const itemsKey = items.map(it => it.firm + it.when).join("");
  React.useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el || !items.length) return;
    const SAFE = 56;
    const compute = () => {
      if (!el.isConnected) return;
      const inner = el.parentElement;
      if (!inner) return;
      const innerR = inner.getBoundingClientRect();
      if (innerR.width < 1) return;
      const setEl = inner.querySelector(".tabs-set");
      let budget;
      let setRight = innerR.left;
      if (setEl) {
        setRight = setEl.getBoundingClientRect().left + setEl.offsetWidth * (showScore ? pinnedSetScale() : 1);
      }
      const gap = parseFloat(getComputedStyle(el).columnGap) || 0;
      const kids = el.children;
      let shift = 0;
      if (showScore) {
        const scoreEl = inner.querySelector(".tab-score");
        const scoreR = scoreEl ? scoreEl.getBoundingClientRect() : null;
        const centre = (innerR.left + innerR.right) / 2;
        const scoreLeft = scoreR && scoreR.width ? scoreR.left : innerR.right;
        if (window.AP && window.AP.rd) {
          const SAFE_RD = 24;
          shift = (setRight + scoreLeft) / 2 - centre;
          budget = Math.max(0, scoreLeft - setRight - 2 * SAFE_RD);
        } else {
          const leftRoom = centre - setRight;
          const rightRoom = scoreLeft - centre;
          budget = 2 * Math.max(0, Math.min(leftRoom, rightRoom) - SAFE);
        }
      } else {
        budget = innerR.right - setRight - SAFE;
      }
      let used = kids[0].offsetWidth,
        k = 0;
      for (let i = 1; i < kids.length; i++) {
        if (used + gap + kids[i].offsetWidth > budget) break;
        used += gap + kids[i].offsetWidth;
        k++;
      }
      el.style.setProperty("--tn-shift", shift.toFixed(1) + "px");
      setFit(k);
    };
    const raf = requestAnimationFrame(compute);
    const settle = setTimeout(compute, 420);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(compute) : null;
    if (ro && el.parentElement) ro.observe(el.parentElement);
    const setEl = el.parentElement && el.parentElement.querySelector(".tabs-set");
    if (ro && setEl) ro.observe(setEl);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(compute);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(settle);
      if (ro) ro.disconnect();
    };
  }, [itemsKey, showScore]);
  if (!items.length) return null;
  const title = "Projected from each house's recent publication intervals" + " – the earliest each wave could land, not the likeliest." + " A dated slot that passes unrecorded counts up as overdue for two days," + " then the expectation moves on to the house's next plausible date";
  return (React.createElement("div", {
      ref: rootRef,
      className: "tab-next" + (fit === 0 ? " tn-none" : ""),
      title: title
    }, React.createElement("button", {
      type: "button",
      className: "tn-lab tn-jump",
      title: "Jump to the Next expected polls panel",
      onClick: () => window.AP.gotoNextPolls && window.AP.gotoNextPolls()
    }, window.AP.rd ? "Next polls" : "Next"), items.map((it, i) => React.createElement("span", {
      className: "tn-item" + (i >= fit ? " tn-park" : ""),
      key: i
    }, React.createElement("span", {
      className: "tn-firm"
    }, it.site ? React.createElement("a", {
      className: "tn-link",
      href: it.site,
      target: "_blank",
      rel: "noopener noreferrer",
      title: `Where ${it.firm} publishes`
    }, it.firm, React.createElement("span", {
      className: "plink-mark",
      "aria-hidden": "true"
    }, "\u2197")) : it.firm), React.createElement("span", {
      className: "tn-when" + (it.overdue ? " tn-overdue" : "")
    }, it.when, it.maybe && React.createElement("span", {
      className: "tn-maybe"
    }, " (maybe)")))))
  );
}
const menuGlide = (r, set) => {
  if (!set || !set.getAnimations) return null;
  try {
    const run = set.getAnimations().find(a => a.transitionProperty === "transform");
    const ks = run && run.effect ? run.effect.getKeyframes() : null;
    if (!ks || ks.length < 2) return null;
    const sc = v => new DOMMatrix(v || "none").a || 1;
    const s = sc(getComputedStyle(set).transform),
      sa = sc(ks[0].transform),
      sb = sc(ks[ks.length - 1].transform);
    if (Math.abs(sb - sa) < 1e-4) return null;
    const x0 = set.getBoundingClientRect().left;
    const at = k => ({
      left: x0 + (r.left - x0) * k / s,
      right: x0 + (r.right - x0) * k / s
    });
    return {
      a: at(sa),
      b: at(sb),
      t: Math.min(1, Math.max(0, (s - sa) / (sb - sa)))
    };
  } catch (e) {
    return null;
  }
};
function Tabs({
  tabs,
  active,
  onChange,
  tppMatchup,
  tppBasis
}) {
  const [pinned, setPinned] = React.useState(false);
  const [heroGone, setHeroGone] = React.useState(false);
  const sentRef = React.useRef(null);
  const btnRefs = React.useRef({});
  const barTabs = tabs.filter(t => !t.menu);
  const menuTabs = tabs.filter(t => t.menu);
  const barActive = barTabs.some(t => t.id === active);
  const menuActive = menuTabs.find(t => t.id === active) || null;
  const pinHideTab = barTabs.find(t => t.pinHide);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [menuTwo, setMenuTwo] = React.useState(false);
  const navRef = React.useRef(null);
  const menuBtn = React.useRef(null);
  const menuRef = React.useRef(null);
  const menuWrap = React.useRef(null);
  menuWrap.current = {
    contains: n => !!(menuRef.current && menuRef.current.contains(n) || menuBtn.current && menuBtn.current.contains(n))
  };
  window.useDismissOutside(menuWrap, menuOpen, () => setMenuOpen(false));
  const menuItems = () => menuRef.current ? [...menuRef.current.querySelectorAll('[role="menuitem"]')].filter(el => el.offsetParent !== null) : [];
  const placeMenu = () => {
    const b = menuBtn.current,
      n = navRef.current;
    if (!b || !n) return;
    const br = b.getBoundingClientRect(),
      nr = n.getBoundingClientRect();
    const vw = window.innerWidth;
    const m = menuRef.current;
    if (!window.AP.rd) {
      const w = Math.min(280, vw - 24);
      const x = Math.min(Math.max(br.right - w, 8), vw - 8 - w);
      if (m) Object.assign(m.style, {
        top: Math.round(br.bottom - nr.top) + "px",
        left: Math.round(x - nr.left) + "px",
        right: "auto"
      });
      return;
    }
    const pp = b.querySelector(".tab-menu-paper");
    const pr = pp ? pp.getBoundingClientRect() : br;
    const two = vw >= 1060;
    const fr = two && n.querySelector(".tabs-inner") ? n.querySelector(".tabs-inner").getBoundingClientRect() : null;
    const lo = fr ? fr.left : 8,
      hi = fr ? fr.right : vw - 8;
    const w0 = Math.min(two ? 968 : 492, vw - 16, Math.round(hi - lo));
    const seatAt = q => {
      let L = Math.round(Math.min(Math.max(q.left, lo), hi - w0)),
        R = L + w0;
      const tied = q.left - L < 16,
        ends = R - q.right < 16;
      if (tied) L = q.left;
      if (ends) R = q.right;
      return {
        L,
        R,
        tied,
        ends
      };
    };
    const g = menuGlide(pr, n.querySelector(".tabs-set"));
    const A = seatAt(g ? g.a : pr),
      B = g ? seatAt(g.b) : A,
      t = g ? g.t : 1;
    const L = A.L + (B.L - A.L) * t,
      R = A.R + (B.R - A.R) * t,
      w = R - L;
    const tied = B.tied,
      ends = B.ends;
    const stuck = n.classList.contains("pinned") && getComputedStyle(n).position === "sticky";
    setMenuTwo(two);
    if (!m) return;
    const gapA = Math.max(0, pr.left - L + 1),
      gapB = Math.max(gapA, Math.min(w, pr.right - L - 1));
    Object.assign(m.style, {
      top: Math.round(br.bottom - nr.top) + "px",
      left: L - nr.left + "px",
      right: "auto",
      width: w + "px",
      borderTopLeftRadius: tied ? "0px" : "",
      borderTopRightRadius: ends ? "0px" : ""
    });
    m.style.setProperty("--gap-a", gapA + "px");
    m.style.setProperty("--gap-b", gapB + "px");
    const list = m.querySelector(".tab-menu-list");
    if (list) list.style.maxHeight = stuck ? Math.max(160, Math.floor(window.innerHeight - br.bottom - 12 - (m.offsetHeight - list.offsetHeight || 2))) + "px" : "";
  };
  const openMenu = focusAt => {
    placeMenu();
    setMenuOpen(true);
    if (focusAt != null) requestAnimationFrame(() => {
      const els = menuItems();
      const el = focusAt < 0 ? els[els.length - 1] : els[focusAt];
      if (el) el.focus();
    });
  };
  const closeMenu = refocus => {
    setMenuOpen(false);
    if (refocus && menuBtn.current) menuBtn.current.focus();
  };
  const follow = React.useRef(null);
  React.useLayoutEffect(() => {
    if (!menuOpen) return undefined;
    placeMenu();
    const f = follow.current = {
      raf: 0,
      still: 0,
      last: ""
    };
    const tick = () => {
      f.raf = 0;
      placeMenu();
      const b = menuBtn.current,
        pp = b && (b.querySelector(".tab-menu-paper") || b);
      const r = pp ? pp.getBoundingClientRect() : null;
      const key = r ? [r.left, r.right, r.bottom].join() : "";
      f.still = key === f.last ? f.still + 1 : 0;
      f.last = key;
      if (f.still < 4) f.raf = requestAnimationFrame(tick);
    };
    const wake = f.wake = () => {
      f.still = 0;
      if (!f.raf) f.raf = requestAnimationFrame(tick);
    };
    const n = navRef.current;
    window.addEventListener("resize", wake);
    window.addEventListener("scroll", wake, {
      passive: true
    });
    if (n) {
      n.addEventListener("transitionrun", wake);
      n.addEventListener("transitionend", wake);
    }
    wake();
    return () => {
      if (f.raf) cancelAnimationFrame(f.raf);
      follow.current = null;
      window.removeEventListener("resize", wake);
      window.removeEventListener("scroll", wake);
      if (n) {
        n.removeEventListener("transitionrun", wake);
        n.removeEventListener("transitionend", wake);
      }
    };
  }, [menuOpen, menuTwo]);
  React.useLayoutEffect(() => {
    if (!follow.current) return;
    placeMenu();
    follow.current.wake();
  }, [pinned, heroGone]);
  React.useEffect(() => {
    if (!menuOpen) return;
    const onDigit = e => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (!(e.key >= "1" && e.key <= "9")) return;
      const t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const el = menuItems()[Number(e.key) - 1];
      if (el) {
        e.preventDefault();
        el.click();
      }
    };
    window.addEventListener("keydown", onDigit, true);
    return () => window.removeEventListener("keydown", onDigit, true);
  }, [menuOpen]);
  const onMenuBtnKey = e => {
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
      e.preventDefault();
      openMenu(0);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      openMenu(-1);
    } else if (e.key === "Escape" && menuOpen) {
      e.preventDefault();
      closeMenu(true);
    }
  };
  const onMenuKey = e => {
    const els = menuItems();
    const i = els.indexOf(document.activeElement);
    let to = null;
    if (e.key === "ArrowDown") to = els[(i + 1) % els.length];else if (e.key === "ArrowUp") to = els[(i - 1 + els.length) % els.length];else if (e.key === "Home") to = els[0];else if (e.key === "End") to = els[els.length - 1];else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      closeMenu(true);
      return;
    } else if (e.key === "Tab") {
      setMenuOpen(false);
      return;
    } else if (e.key === " " || e.key === "Spacebar") {
      e.preventDefault();
      if (document.activeElement) document.activeElement.click();
      return;
    }
    if (to) {
      e.preventDefault();
      to.focus();
    }
  };
  const rdMenu = !!window.AP.rd;
  const menuLines = React.useMemo(() => menuOpen && rdMenu && window.AP.menuLines ? window.AP.menuLines({
    pub: tppBasis === "resp"
  }) : null, [menuOpen, rdMenu, tppBasis]);
  const menuHref = t => t.ext ? "/" + t.id + "/" : window.AP.tabToPath ? window.AP.tabToPath(t.id) : "#" + t.id;
  const menuPick = id => e => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    if ((tabs.find(t => t.id === id) || {}).ext) {
      setMenuOpen(false);
      return;
    }
    e.preventDefault();
    setMenuOpen(false);
    onChange(id);
    if (!e.detail && menuBtn.current) menuBtn.current.focus();
  };
  const onTabKeyDown = e => {
    const ids = barTabs.map(t => t.id);
    const i = ids.indexOf(active);
    if (e.key === " " || e.key === "Spacebar") {
      const hit = barTabs.find(t => btnRefs.current[t.id] === e.target);
      if (hit) {
        e.preventDefault();
        onChange(hit.id);
      }
      return;
    }
    let next = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = ids[(i + 1) % ids.length];else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = ids[(i - 1 + ids.length) % ids.length];else if (e.key === "Home") next = ids[0];else if (e.key === "End") next = ids[ids.length - 1];
    if (next == null) return;
    e.preventDefault();
    onChange(next);
    const el = btnRefs.current[next];
    if (el) el.focus();
  };
  const navHover = React.useRef(false);
  const navWalkLive = React.useRef(null);
  navWalkLive.current = dir => {
    const ids = barTabs.map(t => t.id);
    const n = ids.length;
    if (n < 2) return false;
    const i = ids.indexOf(active);
    const next = i < 0 ? dir > 0 ? ids[0] : ids[n - 1] : ids[(i + dir + n) % n];
    if (next == null || next === active) return false;
    onChange(next);
    return true;
  };
  React.useEffect(() => {
    const nav = navRef.current;
    if (!nav) return undefined;
    const enter = () => {
      navHover.current = true;
    };
    const leave = () => {
      navHover.current = false;
    };
    navHover.current = nav.matches(":hover");
    nav.addEventListener("pointerenter", enter);
    nav.addEventListener("pointerleave", leave);
    const key = e => {
      if (!navHover.current || e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      if (menuOpen) return;
      const a = document.activeElement;
      if (a && a.tagName !== "BODY" && a.tagName !== "HTML") return;
      const sel = window.getSelection && window.getSelection();
      if (sel && !sel.isCollapsed) return;
      if (!navWalkLive.current(e.key === "ArrowRight" ? 1 : -1)) return;
      e.preventDefault();
    };
    document.addEventListener("keydown", key, true);
    return () => {
      nav.removeEventListener("pointerenter", enter);
      nav.removeEventListener("pointerleave", leave);
      document.removeEventListener("keydown", key, true);
    };
  }, [menuOpen]);
  const menuDigitLive = React.useRef(null);
  menuDigitLive.current = key => {
    if (!window.AP.rd || menuOpen) return false;
    const infoOut = pinHideTab && btnRefs.current[pinHideTab.id] && btnRefs.current[pinHideTab.id].offsetParent === null;
    const t = (infoOut ? [...menuTabs, pinHideTab] : menuTabs)[Number(key) - 1];
    if (!t) return false;
    onChange(t.id);
    return true;
  };
  React.useEffect(() => {
    const key = e => {
      if (!(e.key >= "1" && e.key <= "9")) return;
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const nav = navRef.current;
      if (!nav) return;
      const a = document.activeElement;
      const inside = !!(a && nav.contains(a));
      if (!inside) {
        if (!navHover.current) return;
        if (a && a.tagName !== "BODY" && a.tagName !== "HTML") return;
        const sel = window.getSelection && window.getSelection();
        if (sel && !sel.isCollapsed) return;
      }
      if (!menuDigitLive.current(e.key)) return;
      e.preventDefault();
      if (inside && menuBtn.current) menuBtn.current.focus();
    };
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  }, []);
  const goHero = () => {
    if (active !== "now") onChange("now");else window.scrollTo({
      top: 0,
      behavior: SM
    });
  };
  React.useEffect(() => {
    const el = sentRef.current;
    if (!el || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(([e]) => setPinned(!e.isIntersecting), {
      threshold: 0,
      rootMargin: "0px 0px 0px 0px"
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  React.useEffect(() => {
    if (!("IntersectionObserver" in window)) {
      setHeroGone(true);
      return;
    }
    if (active !== "now") {
      setHeroGone(true);
      return;
    }
    const el = document.querySelector(".hero-gauge, .rd-lg") || document.querySelector(".hero-readout");
    if (!el) {
      setHeroGone(true);
      return;
    }
    setHeroGone(false);
    const io = new IntersectionObserver(([e]) => setHeroGone(!e.isIntersecting), {
      threshold: 0,
      rootMargin: "0px 0px 0px 0px"
    });
    io.observe(el);
    return () => io.disconnect();
  }, [active]);
  return React.createElement(React.Fragment, null, React.createElement("div", {
    ref: sentRef,
    className: "tabs-sentinel",
    "aria-hidden": "true"
  }), React.createElement("nav", {
    className: "tabs sticky" + (pinned ? " pinned" : "") + (pinned && heroGone ? " show-score" : ""),
    "aria-label": "Views",
    ref: navRef
  }, React.createElement("div", {
    className: "tabs-inner"
  }, React.createElement("div", {
    className: "tabs-set"
  }, React.createElement("div", {
    className: "tabs-list",
    role: "tablist",
    "aria-label": "Views",
    onKeyDown: onTabKeyDown
  }, barTabs.map((t, ti) => React.createElement("a", {
    key: t.id,
    role: "tab",
    "aria-selected": active === t.id,
    href: window.AP.tabToPath ? window.AP.tabToPath(t.id) : "#" + t.id,
    id: "tab-" + t.id,
    "aria-controls": "panel-" + t.id,
    title: t.tip,
    tabIndex: active === t.id || !barActive && ti === 0 ? 0 : -1,
    ref: el => {
      btnRefs.current[t.id] = el;
    },
    className: "tab" + (active === t.id ? " active" : "") + (t.pinHide ? " tab-pinhide" : ""),
    onClick: e => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      e.preventDefault();
      onChange(t.id);
      if (e.detail) e.currentTarget.blur();
    }
  }, React.createElement("span", {
    className: "tab-label"
  }, window.RdTabW && typeof t.label === "string" ? React.createElement(window.RdTabW, {
    t: t.label
  }) : t.label), t.note != null && React.createElement("span", {
    className: "tab-note"
  }, t.note)))), menuTabs.length > 0 && React.createElement("button", {
    type: "button",
    ref: menuBtn,
    className: "tab tab-menu" + (menuActive ? " active" : "") + (menuOpen ? " open" : ""),
    "aria-haspopup": "menu",
    "aria-expanded": menuOpen,
    "aria-controls": "tab-menu-pop",
    "aria-label": menuActive ? "More pages – on " + menuActive.label : "More pages",
    title: "More pages",
    onKeyDown: onMenuBtnKey,
    onClick: e => {
      if (menuOpen) {
        closeMenu(false);
        if (e.detail) e.currentTarget.blur();
      } else openMenu(e.detail ? null : 0);
    }
  }, rdMenu && React.createElement("span", {
    className: "tab-menu-paper",
    "aria-hidden": "true"
  }), React.createElement("svg", {
    className: "tab-menu-ic",
    viewBox: "0 0 20 20",
    width: "18",
    height: "18",
    "aria-hidden": "true"
  }, React.createElement("path", {
    d: "M3 5.5h14M3 10h14M3 14.5h14",
    stroke: "currentColor",
    strokeWidth: "1.7",
    strokeLinecap: "round",
    fill: "none"
  })), React.createElement("span", {
    className: "tab-label tab-menu-lab"
  }, menuActive ? menuActive.label : "More"), React.createElement("svg", {
    className: "tab-menu-chev",
    viewBox: "0 0 10 6",
    width: "9",
    height: "6",
    "aria-hidden": "true"
  }, React.createElement("path", {
    d: "M1.4 1.3l3.6 3.4 3.6-3.4",
    stroke: "currentColor",
    strokeWidth: "1.5",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    fill: "none"
  })))), React.createElement(NextPollTicker, {
    showScore: pinned && heroGone
  }), React.createElement("button", {
    type: "button",
    className: "tab-glyph",
    title: "Wind the dial back through the term",
    "aria-label": "Wind the dial back through the term",
    "aria-describedby": "wm-action",
    onClick: e => {
      if (window.AP.openStory) window.AP.openStory(e, e.currentTarget);
    }
  }, React.createElement(GlyphDial, {
    width: "34",
    height: "23.8"
  })), React.createElement(TabScore, {
    onGoHero: goHero,
    matchup: tppMatchup,
    tppBasis: tppBasis
  })), menuOpen && (rdMenu ? React.createElement("div", {
    className: "tab-menu-pop" + (menuTwo ? " tab-menu-two" : ""),
    id: "tab-menu-pop",
    role: "menu",
    "aria-label": "More pages",
    ref: menuRef,
    onKeyDown: onMenuKey
  }, React.createElement("div", {
    className: "tab-menu-list"
  }, (rowEls => {
    if (!menuTwo) return rowEls;
    const k = Math.ceil(menuTabs.length / 2);
    return React.createElement(React.Fragment, null, React.createElement("div", {
      className: "tab-menu-col"
    }, rowEls.slice(0, k)), React.createElement("div", {
      className: "tab-menu-col"
    }, rowEls.slice(k)));
  })([...menuTabs, ...(pinHideTab ? [pinHideTab] : [])].map((t, i) => {
    const ln = menuLines && menuLines[t.id];
    const fig = ln && ln.fig;
    const rows = fig && fig.rows;
    return React.createElement("a", {
      key: t.id,
      role: "menuitem",
      tabIndex: -1,
      className: "tab-menu-item" + (rows ? " tab-menu-wide" : "") + (t === pinHideTab ? " tab-menu-info" : "") + (active === t.id ? " on" : ""),
      href: menuHref(t),
      "aria-current": active === t.id ? "page" : undefined,
      onClick: menuPick(t.id)
    }, React.createElement("span", {
      className: "tab-menu-n",
      "aria-hidden": "true"
    }, i + 1), React.createElement("span", {
      className: "tab-menu-txt"
    }, React.createElement("span", {
      className: "tab-menu-t"
    }, t.label), (ln ? ln.head : t.tip) && React.createElement("span", {
      className: "tab-menu-d"
    }, ln ? ln.head : t.tip)), React.createElement("span", {
      className: "tab-menu-f"
    }, ln && ln.chip ? React.createElement("span", {
      className: "tab-menu-chip"
    }, ln.chip) : rows ? fig.rows.map((r, ri) => React.createElement("span", {
      className: "tab-menu-fr",
      key: ri
    }, React.createElement("span", {
      className: "tab-menu-fv"
    }, r.cells.map((c, ci) => React.createElement("span", {
      key: ci,
      className: "tm-" + c.tone
    }, c.v))), React.createElement("span", {
      className: "tab-menu-fc"
    }, r.cap))) : fig ? React.createElement(React.Fragment, null, React.createElement("span", {
      className: "tab-menu-v" + (fig.tone ? " tm-" + fig.tone : "")
    }, fig.v), React.createElement("span", {
      className: "tab-menu-c"
    }, fig.cap.replace("/", "/\u200b"))) : null));
  })))) : React.createElement("div", {
    className: "tab-menu-pop",
    id: "tab-menu-pop",
    role: "menu",
    "aria-label": "More pages",
    ref: menuRef,
    onKeyDown: onMenuKey
  }, pinHideTab && React.createElement("a", {
    role: "menuitem",
    tabIndex: -1,
    className: "tab-menu-item tab-menu-info" + (active === pinHideTab.id ? " on" : ""),
    href: window.AP.tabToPath ? window.AP.tabToPath(pinHideTab.id) : "#" + pinHideTab.id,
    "aria-current": active === pinHideTab.id ? "page" : undefined,
    onClick: menuPick(pinHideTab.id)
  }, pinHideTab.label), menuTabs.map(t => React.createElement("a", {
    key: t.id,
    role: "menuitem",
    tabIndex: -1,
    className: "tab-menu-item" + (active === t.id ? " on" : ""),
    href: menuHref(t),
    "aria-current": active === t.id ? "page" : undefined,
    onClick: menuPick(t.id)
  }, React.createElement("span", {
    className: "tab-menu-t"
  }, t.label), t.tip && React.createElement("span", {
    className: "tab-menu-d"
  }, t.tip)))))));
}