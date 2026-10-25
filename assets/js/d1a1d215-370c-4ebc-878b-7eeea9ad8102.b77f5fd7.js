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
  const [menuAt, setMenuAt] = React.useState(null);
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
    if (!window.AP.rd) {
      const w = Math.min(280, vw - 24);
      const x = Math.min(Math.max(br.right - w, 8), vw - 8 - w);
      setMenuAt({
        top: Math.round(br.bottom - nr.top),
        left: Math.round(x - nr.left)
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
    let L = Math.round(Math.min(Math.max(pr.left, lo), hi - w0)),
      R = L + w0;
    if (pr.left - L < 16) L = Math.round(pr.left);
    if (R - pr.right < 16) R = Math.round(pr.right);
    const w = R - L;
    const stuck = n.classList.contains("pinned") && getComputedStyle(n).position === "sticky";
    setMenuAt({
      two,
      top: Math.round(br.bottom - nr.top),
      left: L - Math.round(nr.left),
      width: w,
      gapA: Math.max(0, pr.left - L + 1),
      gapB: Math.min(w, pr.right - L - 1),
      maxH: stuck ? Math.max(160, Math.floor(window.innerHeight - br.bottom - 12)) : null
    });
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
  React.useEffect(() => {
    if (!menuOpen) return;
    const re = () => placeMenu();
    window.addEventListener("resize", re);
    window.addEventListener("scroll", re, {
      passive: true
    });
    return () => {
      window.removeEventListener("resize", re);
      window.removeEventListener("scroll", re);
    };
  }, [menuOpen]);
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
  }), React.createElement(GlyphDial, {
    className: "tab-glyph",
    width: "34",
    height: "23.8"
  }), React.createElement(TabScore, {
    onGoHero: goHero,
    matchup: tppMatchup,
    tppBasis: tppBasis
  })), menuOpen && (rdMenu ? React.createElement("div", {
    className: "tab-menu-pop" + (menuAt && menuAt.two ? " tab-menu-two" : ""),
    id: "tab-menu-pop",
    role: "menu",
    "aria-label": "More pages",
    ref: menuRef,
    style: menuAt ? {
      top: menuAt.top + "px",
      left: menuAt.left + "px",
      right: "auto",
      width: menuAt.width + "px",
      "--gap-a": menuAt.gapA + "px",
      "--gap-b": menuAt.gapB + "px",
      borderTopLeftRadius: menuAt.gapA <= 1.5 ? 0 : undefined,
      borderTopRightRadius: menuAt.gapB >= menuAt.width - 1.5 ? 0 : undefined
    } : null,
    onKeyDown: onMenuKey
  }, React.createElement("div", {
    className: "tab-menu-list",
    style: menuAt && menuAt.maxH ? {
      maxHeight: menuAt.maxH + "px"
    } : null
  }, (rowEls => {
    if (!(menuAt && menuAt.two)) return rowEls;
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
    style: menuAt ? {
      top: menuAt.top + "px",
      left: menuAt.left + "px",
      right: "auto"
    } : null,
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
const fmtSigned1 = v => {
  const r = +v.toFixed(1);
  return (r > 0 ? "+" : "") + r.toFixed(1);
};
const CYC_METRICS = [{
  key: "tpp",
  title: "Government two-party preferred",
  sub: "Governing-party 2PP",
  unit: "%",
  fmt: v => v.toFixed(1),
  step: 5,
  refAbs: 50,
  refAbsLabel: "50 – tie",
  note: React.createElement(React.Fragment, null, "Every line is the ", React.createElement("strong", null, "implied"), " two-party figure: each poll\u2019s primary votes read through the preferences counted at the election that opened its term \u2013", " ", React.createElement("button", {
    type: "button",
    className: "hi-term",
    onClick: () => window.AP.openTerm && window.AP.openTerm("last-election-flows", "Past cycles")
  }, "last-election flows"), "."),
  noteMore: [React.createElement(React.Fragment, null, "That is the only table anyone could have used at the time. So a line moves when voting intentions move, not when pollsters change how they allocate preferences, and every term back to 1972 is on the same footing as today\u2019s."), React.createElement(React.Fragment, null, "The sitting term follows Labor\u2019s main rival, as the headline does, and marks where that changed: the rival running Labor clearly closer after preferences or, when the two are too close to call, the one clearly ahead on first preferences. How the final polls have done, below, still scores what the pollsters published.")]
}, {
  key: "primary",
  title: "Government primary vote",
  sub: "First-preference support for the governing party",
  primaryIs: true,
  unit: "%",
  fmt: v => v.toFixed(1),
  step: 5,
  refAbs: null
}, {
  key: "oppr",
  title: "Opposition primary vote",
  sub: "First-preference support for the opposition party",
  leader: "opp",
  primaryIs: true,
  onp: true,
  unit: "%",
  fmt: v => v.toFixed(1),
  step: 5,
  refAbs: null
}, {
  key: "ppmm",
  title: "Preferred prime minister",
  sub: "PM’s lead on the preferred-PM question",
  unit: "",
  fmt: fmtSigned1,
  step: 10,
  refAbs: 0,
  refAbsLabel: "even",
  chgRefLabel: "First reading"
}, {
  key: "net",
  title: "Prime minister net approval",
  sub: "Sitting prime minister",
  unit: "",
  fmt: fmtSigned1,
  step: 20,
  refAbs: 0,
  refAbsLabel: "even"
}, {
  key: "oppnet",
  title: "Opposition leader net approval",
  sub: "Sitting opposition leader",
  leader: "opp",
  unit: "",
  fmt: fmtSigned1,
  step: 10,
  refAbs: 0,
  refAbsLabel: "even",
  han: true
}];
const cycBase = (c, key) => {
  const v = c.base[key];
  if (v != null) return v;
  const first = c.raw[key].find(x => x != null);
  return first != null ? first : 0;
};
function cycDomain(cycles, M, chg) {
  const vals = cycles.flatMap(c => c.raw[M.key].filter(v => v != null).map(v => chg ? v - cycBase(c, M.key) : v));
  if (M.han) vals.push(...cycles.flatMap(c => (c.raw.han || []).filter(v => v != null).map(v => chg ? v - cycBase(c, "han") : v)));
  if (M.onp) {
    const c = cycles.find(x => x.current);
    if (c) {
      const cBase = cycBase(c, "oppr") + cycBase(c, "onp");
      vals.push(...c.raw.months.map((m, i) => c.raw.oppr[i] != null && (c.raw.onp || [])[i] != null ? c.raw.oppr[i] + c.raw.onp[i] : null).filter(v => v != null).map(v => chg ? v - cBase : v));
    }
    vals.push(...cycles.flatMap(c => (c.raw.onp || []).filter(v => v != null).map(v => chg ? v - cycBase(c, "onp") : v)));
  }
  const ref = chg ? 0 : M.refAbs;
  let lo = Math.min(...vals),
    hi = Math.max(...vals);
  if (ref != null) {
    lo = Math.min(lo, ref);
    hi = Math.max(hi, ref);
  }
  let step = M.step,
    d0,
    d1,
    ticks;
  for (;;) {
    d0 = Math.floor((lo - step * 0.3) / step) * step;
    d1 = Math.ceil((hi + step * 0.3) / step) * step;
    ticks = [];
    for (let v = d0 + step; v < d1 - 1e-9; v += step) ticks.push(v);
    if (ticks.length <= 7) break;
    step *= 2;
  }
  return {
    domain: [d0, d1],
    ticks
  };
}
const CYC_XDOMAIN = [-1.6, 37.6];
const CYC_XTICKS = [{
  x: 0,
  label: "Election"
}, {
  x: 12,
  label: "1 yr"
}, {
  x: 24,
  label: "2 yrs"
}, {
  x: 36,
  label: "3 yrs"
}];
const CYC_SPINE = [];
for (let m = 0; m <= 36; m++) CYC_SPINE.push({
  x: m
});
function cycMonthLabel(m) {
  if (m <= 0) return "Election day";
  if (m % 12 === 0) return m / 12 + (m === 12 ? " year in" : " years in");
  return m + " months in";
}
function cycMonthOf(eDate, m) {
  const [y, mo] = eDate.split("-").map(Number);
  const t = mo - 1 + Math.max(0, m);
  return window.AP.D.monthNameFull(t % 12 + 1) + " " + (y + Math.floor(t / 12));
}
const cycEventMonth = (iso, eDate) => (Date.parse(iso) - Date.parse(eDate)) / 86400000 / MS_MONTH_C;
const CYC_EVENTS = {
  1972: [{
    date: "1972-12-20",
    short: "McMahon → Snedden",
    label: "Snedden replaces McMahon as opposition leader",
    desc: "Billy Snedden defeats Nigel Bowen 30–29 for the Liberal leadership after William McMahon stands down following the 1972 election defeat, becoming opposition leader.",
    major: true,
    metrics: ["oppnet"]
  }, {
    date: "1974-04-11",
    short: "Double dissolution",
    label: "Whitlam calls a double dissolution election",
    desc: "With the Senate threatening to block supply, both houses are dissolved on Gough Whitlam’s advice, sending the government to an early election on 18 May.",
    major: true
  }],
  1974: [{
    date: "1975-03-21",
    short: "Snedden → Fraser",
    label: "Fraser replaces Snedden as opposition leader",
    desc: "Malcolm Fraser defeats Billy Snedden 37–27 in a Liberal leadership spill, becoming opposition leader.",
    major: true,
    metrics: ["oppnet"]
  }, {
    date: "1975-10-16",
    short: "Supply blocked",
    label: "The Senate blocks supply",
    desc: "Two days after the Loans Affair forces Rex Connor’s resignation, the Coalition-controlled Senate defers the budget bills, starting the crisis that ends in the Dismissal.",
    major: true
  }, {
    date: "1975-11-11",
    short: "The Dismissal",
    label: "Kerr dismisses Whitlam; Fraser caretaker prime minister",
    desc: "Governor-General Sir John Kerr dismisses the Whitlam government after the Senate blocks supply and commissions Malcolm Fraser as caretaker prime minister pending the 13 December election; Whitlam leads the opposition through the campaign.",
    major: true
  }],
  1975: [{
    date: "1976-11-28",
    short: "Dollar devalued",
    label: "The dollar is devalued 17.5%",
    desc: "The Fraser government devalues the Australian dollar by 17.5 per cent as foreign reserves drain away.",
    major: true
  }, {
    date: "1977-05-15",
    short: "Democrats launched",
    label: "Don Chipp launches the Australian Democrats",
    desc: "Former Liberal minister Don Chipp launches the Australian Democrats at Melbourne Town Hall, a new home for voters leaving both major parties.",
    major: true
  }, {
    date: "1977-12-22",
    short: "Whitlam → Hayden",
    label: "Hayden replaces Whitlam as opposition leader",
    desc: "Bill Hayden defeats Lionel Bowen 36–28 for the Labor leadership after Gough Whitlam resigns following the 1977 election defeat, becoming opposition leader.",
    major: true,
    metrics: ["oppnet"]
  }],
  1977: [{
    date: "1977-12-22",
    short: "Whitlam → Hayden",
    label: "Hayden replaces Whitlam as opposition leader",
    desc: "Bill Hayden defeats Lionel Bowen 36–28 for the Labor leadership after Gough Whitlam resigns following the 1977 election defeat, becoming opposition leader.",
    major: true,
    metrics: ["oppnet"]
  }, {
    date: "1978-08-15",
    short: "Tax surcharge budget",
    label: "Howard’s first budget adds a tax surcharge",
    desc: "Treasurer John Howard’s first budget imposes a temporary income tax surcharge, months after the Coalition won the 1977 election promising tax cuts.",
    major: true
  }],
  1980: [{
    date: "1981-04-30",
    short: "Razor Gang cuts",
    label: "The Razor Gang’s spending cuts",
    desc: "The Fraser government’s Review of Commonwealth Functions – the Razor Gang – announces cuts to public services and programs.",
    major: true
  }, {
    date: "1982-04-08",
    short: "Peacock challenges Fraser",
    label: "Peacock mounts a leadership challenge",
    desc: "Andrew Peacock, having resigned from cabinet a year earlier, challenges Malcolm Fraser for the Liberal leadership and loses the ballot 54 votes to 27.",
    major: true
  }, {
    date: "1982-07-16",
    short: "Hawke challenges Hayden",
    label: "Hawke challenges Hayden for the Labor leadership",
    desc: "Bob Hawke challenges Bill Hayden for the Labor leadership and loses the ballot 42 votes to 37.",
    major: true,
    metrics: ["oppnet"]
  }, {
    date: "1983-02-03",
    short: "Hayden → Hawke",
    label: "Hawke replaces Hayden as opposition leader",
    desc: "Bill Hayden resigns the Labor leadership and Bob Hawke is elected unopposed as his replacement on the morning Malcolm Fraser calls the March 1983 election.",
    major: true,
    metrics: ["oppnet"]
  }],
  1983: [{
    date: "1983-03-11",
    short: "Fraser → Peacock",
    label: "Peacock replaces Fraser as opposition leader",
    desc: "Andrew Peacock defeats John Howard 36–20 for the Liberal leadership after Malcolm Fraser resigns following the 1983 election defeat, becoming opposition leader.",
    major: true,
    metrics: ["oppnet"]
  }],
  1984: [{
    date: "1985-09-05",
    short: "Peacock → Howard",
    label: "Howard replaces Peacock as opposition leader",
    desc: "Andrew Peacock resigns the Liberal leadership after the party room refuses to remove John Howard as his deputy; Howard is elected leader 57 votes to 6, becoming opposition leader.",
    major: true,
    metrics: ["oppnet"]
  }, {
    date: "1986-05-14",
    short: "Banana republic",
    label: "Keating’s “banana republic” warning",
    desc: "Treasurer Paul Keating warns that Australia risks becoming a banana republic without economic reform, and the dollar falls sharply.",
    major: true
  }, {
    date: "1987-02-28",
    short: "Joh for Canberra",
    label: "Queensland Nationals quit the Coalition",
    desc: "Backing Premier Joh Bjelke-Petersen’s bid for Canberra, the Queensland National Party decides to pull its 12 federal MPs out of the Coalition, splitting the conservative vote before the July election.",
    major: true
  }],
  1987: [{
    date: "1987-10-20",
    short: "Share market crash",
    label: "The Black Monday share market crash",
    desc: "The global crash reaches Australia and the All Ordinaries falls 25% in a day, its biggest one-day drop.",
    major: true
  }, {
    date: "1989-05-09",
    short: "Howard → Peacock",
    label: "Peacock replaces Howard as opposition leader",
    desc: "Andrew Peacock defeats John Howard in a Liberal leadership spill, becoming opposition leader.",
    major: true,
    metrics: ["oppnet"]
  }, {
    date: "1989-08-18",
    short: "Pilots’ dispute",
    label: "The pilots’ dispute grounds domestic flights",
    desc: "Domestic airline pilots begin a campaign for a 29.5% pay rise and resign en masse; the Hawke government brings in the RAAF to keep planes flying.",
    major: true
  }],
  1990: [{
    date: "1990-11-29",
    short: "Recession we had to have",
    label: "Keating: “the recession Australia had to have”",
    desc: "Treasurer Paul Keating announces that Australia is in recession, calling it “a recession that Australia had to have”.",
    major: true
  }, {
    date: "1991-06-03",
    short: "Keating’s first challenge",
    label: "Keating challenges Hawke and loses",
    desc: "Paul Keating challenges Bob Hawke for the Labor leadership, loses the ballot 66 votes to 44, and goes to the backbench.",
    major: true
  }, {
    date: "1991-11-21",
    short: "Fightback!",
    label: "Hewson releases Fightback!",
    desc: "Opposition leader John Hewson releases Fightback!, the Coalition’s platform built around a 15% goods and services tax.",
    major: true
  }, {
    date: "1991-12-20",
    short: "Hawke → Keating",
    label: "Keating replaces Hawke as prime minister",
    desc: "Paul Keating defeats Bob Hawke in a Labor leadership spill at his second attempt and is sworn in as prime minister.",
    major: true
  }, {
    date: "1992-02-26",
    short: "One Nation statement",
    label: "Keating’s One Nation statement",
    desc: "Prime Minister Paul Keating answers Fightback! with One Nation, an economic statement of infrastructure spending and promised income tax cuts.",
    major: true
  }],
  1993: [{
    date: "1993-08-17",
    short: "L-A-W tax cuts deferred",
    label: "The budget defers the promised tax cuts",
    desc: "Months after Labor won the 1993 election promising tax cuts that were “L-A-W law”, the Dawkins budget raises indirect taxes and defers the second round of cuts.",
    major: true
  }, {
    date: "1994-05-23",
    short: "Hewson → Downer",
    label: "Downer replaces Hewson as opposition leader",
    desc: "Alexander Downer defeats John Hewson in a Liberal leadership spill, becoming opposition leader.",
    major: true,
    metrics: ["oppnet"]
  }, {
    date: "1995-01-30",
    short: "Downer → Howard",
    label: "Howard replaces Downer as opposition leader",
    desc: "John Howard replaces Alexander Downer as Liberal leader and opposition leader after Downer resigns.",
    major: true,
    metrics: ["oppnet"]
  }],
  1996: [{
    date: "1996-04-28",
    short: "Port Arthur massacre",
    label: "The Port Arthur massacre",
    desc: "A gunman kills 35 people at Port Arthur in Tasmania; within weeks the Howard government and the states agree on national gun laws.",
    major: true
  }, {
    date: "1996-09-10",
    short: "Hanson’s maiden speech",
    label: "Pauline Hanson’s maiden speech",
    desc: "Independent MP Pauline Hanson’s first speech in parliament, on immigration and Indigenous policy, draws national attention; she founds One Nation the following April.",
    major: true
  }, {
    date: "1998-06-13",
    short: "One Nation’s Qld breakthrough",
    label: "One Nation wins 11 seats in Queensland",
    desc: "One Nation takes 22.7% of the vote and 11 seats at the Queensland state election.",
    major: true
  }, {
    date: "1998-08-13",
    short: "GST unveiled",
    label: "Howard unveils the GST",
    desc: "The Howard government releases A New Tax System, its tax package built on a 10% goods and services tax, and takes it to an election weeks later.",
    major: true
  }],
  1998: [{
    date: "2000-07-01",
    short: "GST begins",
    label: "The GST starts",
    desc: "The 10% goods and services tax comes into force.",
    major: true
  }, {
    date: "2001-08-26",
    short: "Tampa",
    label: "The Tampa affair",
    desc: "The Norwegian freighter Tampa rescues 433 asylum seekers; the Howard government refuses to let them land, and SAS troops board the ship three days later.",
    major: true
  }, {
    date: "2001-09-11",
    short: "September 11",
    label: "The September 11 attacks",
    desc: "Terrorist attacks on New York and Washington; John Howard, in Washington at the time, invokes the ANZUS treaty.",
    major: true
  }],
  2001: [{
    date: "2001-11-22",
    short: "Beazley → Crean",
    label: "Crean replaces Beazley as opposition leader",
    desc: "Kim Beazley resigns after Labor’s 2001 election defeat and Simon Crean is elected unopposed as Labor leader.",
    major: true,
    metrics: ["oppnet"]
  }, {
    date: "2002-10-12",
    short: "Bali bombings",
    label: "The Bali bombings",
    desc: "Terrorist bombings in Kuta, Bali, kill 202 people, 88 of them Australians.",
    major: true
  }, {
    date: "2003-03-20",
    short: "Iraq war",
    label: "Australia joins the invasion of Iraq",
    desc: "Australian forces join the US-led invasion of Iraq.",
    major: true
  }, {
    date: "2003-12-02",
    short: "Crean → Latham",
    label: "Latham replaces Crean as opposition leader",
    desc: "Mark Latham defeats Kim Beazley 47–45 in a Labor leadership ballot after Simon Crean resigns, becoming opposition leader.",
    major: true,
    metrics: ["oppnet"]
  }],
  2004: [{
    date: "2005-01-28",
    short: "Latham → Beazley",
    label: "Beazley replaces Latham as opposition leader",
    desc: "Mark Latham resigns the Labor leadership and leaves parliament; Kim Beazley is elected unopposed as his replacement.",
    major: true,
    metrics: ["oppnet"]
  }, {
    date: "2006-03-27",
    short: "WorkChoices",
    label: "WorkChoices comes into force",
    desc: "The Howard government’s WorkChoices industrial relations laws take effect; the unions’ campaign against them runs through to the 2007 election.",
    major: true
  }, {
    date: "2006-12-04",
    short: "Beazley → Rudd",
    label: "Rudd replaces Beazley as opposition leader",
    desc: "Kevin Rudd defeats Kim Beazley 49–39 in a Labor leadership spill, becoming opposition leader.",
    major: true,
    metrics: ["oppnet"]
  }, {
    date: "2007-11-07",
    short: "Campaign rate rise",
    label: "The Reserve Bank raises rates mid-campaign",
    desc: "The Reserve Bank raises the cash rate to 6.75% seventeen days before the election – the first rate rise during a federal election campaign.",
    major: true
  }],
  2007: [{
    date: "2008-02-13",
    short: "The Apology",
    label: "The Apology to the Stolen Generations",
    desc: "Prime Minister Kevin Rudd apologises in parliament to the Stolen Generations.",
    major: true
  }, {
    date: "2008-09-15",
    short: "Global financial crisis",
    label: "Lehman Brothers collapses",
    desc: "The collapse of Lehman Brothers turns the credit crunch into a global financial crisis; the Rudd government answers with bank guarantees and stimulus payments.",
    major: true
  }, {
    date: "2008-09-16",
    short: "Nelson → Turnbull",
    label: "Turnbull replaces Nelson as opposition leader",
    desc: "Malcolm Turnbull defeats Brendan Nelson 45–41 in a Liberal leadership spill, becoming opposition leader.",
    major: true,
    metrics: ["oppnet"]
  }, {
    date: "2009-12-01",
    short: "Turnbull → Abbott",
    label: "Abbott replaces Turnbull as opposition leader",
    desc: "Tony Abbott defeats Malcolm Turnbull 42–41 in a Liberal leadership spill over emissions trading, becoming opposition leader.",
    major: true,
    metrics: ["oppnet"]
  }, {
    date: "2010-04-27",
    short: "ETS shelved, mining tax",
    label: "Rudd shelves the ETS and targets miners",
    desc: "Kevin Rudd shelves the emissions trading scheme until at least 2013, and on 2 May announces a resource super profits tax on mining.",
    major: true
  }, {
    date: "2010-06-24",
    short: "Rudd → Gillard",
    label: "Gillard replaces Rudd as prime minister",
    desc: "Kevin Rudd stands down rather than contest a Labor leadership spill and Julia Gillard is sworn in as prime minister.",
    major: true
  }],
  2010: [{
    date: "2010-12-15",
    short: "Refugee tragedy",
    label: "Boat sinks off Christmas Island",
    desc: "A boat carrying refugees sinks off Christmas Island, killing 48 people aboard and provoking criticism of the Gillard government’s refugee policy.",
    major: true
  }, {
    date: "2011-02-24",
    short: "Carbon pricing scheme",
    label: "Gillard announces a carbon pricing scheme",
    desc: "Prime Minister Julia Gillard announces a fixed price on carbon pollution from 1 July 2012 to combat climate change; the Clean Energy Act 2011 is enacted on 18 November.",
    major: true
  }, {
    date: "2012-02-27",
    short: "Rudd challenge fails",
    label: "Gillard defeats Rudd’s challenge",
    desc: "Julia Gillard defeats Kevin Rudd’s challenge for the Labor leadership 71 votes to 31.",
    major: true
  }, {
    date: "2013-06-27",
    short: "Gillard → Rudd",
    label: "Rudd replaces Gillard as prime minister",
    desc: "Kevin Rudd defeats Julia Gillard in a Labor leadership spill and is sworn in as prime minister.",
    major: true
  }],
  2013: [{
    date: "2013-11-18",
    short: "Indonesia spy row",
    label: "Indonesia recalls ambassador over spying revelations",
    desc: "Indonesia recalls its ambassador after leaked documents reveal Australia spied on president Susilo Bambang Yudhoyono.",
    major: true
  }, {
    date: "2014-05-13",
    short: "Hockey’s first budget",
    label: "Joe Hockey delivers the 2014 federal budget",
    desc: "Treasurer Joe Hockey delivers the Abbott government’s first federal budget with deep cuts to health, education, and welfare.",
    major: true
  }, {
    date: "2015-01-26",
    short: "Prince Philip knighted",
    label: "Abbott announces knighthood for Prince Philip",
    desc: "Prime Minister Tony Abbott awards Prince Philip a knighthood in the Order of Australia, drawing widespread ridicule.",
    major: true
  }, {
    date: "2015-09-15",
    short: "Abbott → Turnbull",
    label: "Turnbull replaces Abbott as prime minister",
    desc: "Malcolm Turnbull defeats Tony Abbott in a Liberal leadership spill and is sworn in as prime minister.",
    major: true
  }],
  2016: [{
    date: "2017-10-17",
    short: "Clean Energy Target dumped",
    label: "Coalition dumps the Clean Energy Target",
    desc: "The Coalition dumps the Clean Energy Target in favour of Malcolm Turnbull’s new plan, a National Energy Guarantee.",
    major: true
  }, {
    date: "2017-11-15",
    short: "Marriage survey Yes vote",
    label: "Marriage postal survey returns a Yes vote",
    desc: "The Australian Marriage Law Postal Survey delivers a national Yes vote for same-sex marriage.",
    major: true
  }, {
    date: "2018-07-28",
    short: "Super Saturday by-elections",
    label: "Super Saturday by-elections return every incumbent",
    desc: "Five federal by-elections return every incumbent – Labor holds Braddon, Fremantle, Longman, and Perth, and Centre Alliance holds Mayo, with the Coalition winning none.",
    major: true
  }, {
    date: "2018-08-21",
    short: "Dutton challenges Turnbull",
    label: "Dutton mounts a leadership challenge",
    desc: "Home Affairs minister Peter Dutton challenges Malcolm Turnbull for the Liberal leadership, losing the spill 48 votes to 35.",
    major: true
  }, {
    date: "2018-08-24",
    short: "Turnbull → Morrison",
    label: "Morrison replaces Turnbull as prime minister",
    desc: "Malcolm Turnbull resigns and Scott Morrison defeats Peter Dutton in the Liberal leadership spill, becoming prime minister.",
    major: true
  }, {
    date: "2019-05-27",
    short: "Shorten → Albanese",
    label: "Albanese replaces Shorten as opposition leader",
    desc: "Anthony Albanese is elected unopposed as Labor leader, after Bill Shorten resigns in the wake of the 2019 federal election defeat.",
    major: true,
    metrics: ["oppnet"]
  }],
  2019: [{
    date: "2019-11-09",
    short: "Bushfire emergency",
    label: "Queensland declares a state of emergency",
    desc: "Queensland declares a state of emergency amid catastrophic bushfire conditions – two days before NSW follows.",
    major: true
  }, {
    date: "2020-03-11",
    short: "COVID-19 pandemic",
    label: "WHO declares COVID-19 a pandemic",
    desc: "The World Health Organization declares the COVID-19 outbreak a pandemic.",
    major: true
  }, {
    date: "2021-02-15",
    short: "Higgins allegations",
    label: "Brittany Higgins goes public",
    desc: "Former Liberal staffer Brittany Higgins goes public with allegations that she was raped inside Parliament House.",
    major: true
  }],
  2022: [{
    date: "2023-10-14",
    short: "Voice referendum defeated",
    label: "Voice to Parliament referendum defeated",
    desc: "Australians vote No to enshrining an Aboriginal and Torres Strait Islander Voice to Parliament in the Constitution – the proposal fails nationally and in every state.",
    major: true
  }, {
    date: "2023-11-07",
    short: "RBA cash rate hits 4.35%",
    label: "RBA hikes the cash rate to a 12-year high",
    desc: "The RBA board hikes the cash rate 25 basis points to 4.35% – the central bank’s 13th rate rise since May 2022, widely anticipated by economists.",
    major: true
  }, {
    date: "2025-03-28",
    short: "Election called",
    label: "Albanese announces the federal election",
    desc: "Albanese announces the federal election, kicking off a campaign that produced a dramatic rise in Labor support.",
    major: true
  }],
  2025: [{
    date: "2025-05-28",
    short: "1st Coalition split",
    label: "First Coalition dissolution",
    desc: "The Liberal–National Coalition dissolves for the first time, weeks after the 2025 election defeat.",
    major: true
  }, {
    date: "2025-12-14",
    short: "Bondi shooting",
    label: "Bondi Beach shooting",
    desc: "A shooting at Bondi Beach in Sydney.",
    major: true
  }, {
    date: "2026-01-22",
    short: "2nd Coalition split",
    label: "Coalition dissolves again",
    desc: "the Liberal–National Coalition dissolves again.",
    major: true
  }, {
    date: "2026-02-12",
    short: "Ley → Taylor",
    label: "Taylor replaces Ley as opposition leader",
    desc: "Angus Taylor replaces Sussan Ley as Leader of the Liberal Party and Opposition Leader.",
    major: true,
    metrics: ["oppnet"]
  }, {
    date: "2026-05-12",
    short: "2026 Budget",
    label: "2026 federal Budget",
    desc: "Treasurer Jim Chalmers delivers the Albanese government’s fifth federal budget, with sweeping CGT changes.",
    major: true
  }]
};
const CYC_DOT_MAX = 3;
const MS_MONTH_C = 365.25 / 12;
const inCycleRange = m => {
  const k = Math.round(m);
  return k >= 0 && k <= 36;
};
function cycDotDate(iso, approx) {
  const [y, m, d] = iso.split("-").map(Number);
  return (approx === "month" ? "" : d + " ") + window.AP.D.monthName(m) + " " + y;
}
function rivalOfMonth(D, ym) {
  let who = "alp_lnp";
  for (const r of D.rivalWalk || []) {
    if (r.ym > ym) break;
    who = r.who;
  }
  return who;
}
function cycleReadings(c, M, D) {
  const out = [];
  const key = M.key,
    isOpp = M.leader === "opp";
  if (c.current) {
    const mOf = iso => (Date.parse(iso) - Date.parse(c.eDate)) / 86400000 / MS_MONTH_C;
    for (const p of D.individualPolls) {
      const mb = p.appr && p.appr.metricBy || {};
      let y = null;
      if (key === "primary") y = p.p ? p.p[c.gov] : null;else if (key === "oppr") y = p.p ? p.p[c.opp] : null;else if (key === "tpp") {
        const on = rivalOfMonth(D, p.ym) === "alp_on";
        const a = on ? p.alpOnImp : p.alpImp;
        y = a == null ? null : c.gov === "alp" ? a : +(100 - a).toFixed(1);
      } else if (key === "net") y = (mb.alb || "approval") === "fav" ? null : p.appr ? p.appr.albNet : null;else if (key === "oppnet") y = (mb.taylor || "approval") === "fav" ? null : p.appr ? p.appr.taylorNet : null;else if (key === "pmlead") {
        if ((mb.alb || "approval") === "fav" || (mb.taylor || "approval") === "fav") continue;
        if (!p.appr || p.appr.albNet == null || p.appr.taylorNet == null) continue;
        const hn = (mb.hanson || "approval") !== "fav" ? p.appr.hansonNet : null;
        y = +(p.appr.albNet - Math.max(p.appr.taylorNet, hn != null ? hn : -Infinity)).toFixed(2);
      } else if (key === "ppmm") {
        const s = p.ppmSets ? p.ppmSets[0] : p.ppm;
        const ok = s && Object.keys(s).find(k => !["alb", "unc", "hanson"].includes(k));
        if (ok == null || s[ok] == null || s.alb == null) continue;
        y = s.alb - s[ok];
      }
      if (y == null) continue;
      out.push({
        x: mOf(p.released),
        y,
        iso: p.released,
        meta: {
          pollster: p.pollster,
          dateLabel: p.dateLabel,
          sample: p.sample,
          released: p.released
        }
      });
    }
    return out;
  }
  const src = (D.cycleSource || {})[c.year];
  if (!src) return out;
  if (key === "primary" || key === "oppr" || key === "tpp") {
    const f = key === "tpp" ? "imp_alp" : key === "oppr" ? c.opp : c.gov;
    for (const p of src.polls) {
      if (p[f] == null || p.firm === "Election" || !inCycleRange(p.m)) continue;
      const y = key === "tpp" && c.gov !== "alp" ? +(100 - p[f]).toFixed(1) : p[f];
      out.push({
        x: p.m,
        y,
        iso: p.date,
        meta: {
          pollster: p.firm,
          dateLabel: cycDotDate(p.date, p.dateApprox)
        }
      });
    }
  } else if (key === "ppmm") {
    for (const r of src.approval) {
      if (r.pmPpm == null || r.oppPpm == null || !inCycleRange(r.m)) continue;
      out.push({
        x: r.m,
        y: r.pmPpm - r.oppPpm,
        iso: r.date,
        meta: {
          pollster: r.firm,
          dateLabel: cycDotDate(r.date)
        }
      });
    }
  } else if (key === "pmlead") {
    for (const r of src.approval) {
      if (r.pmNet == null || r.oppNet == null || r.metric === "fav" || !inCycleRange(r.m)) continue;
      out.push({
        x: r.m,
        y: +(r.pmNet - r.oppNet).toFixed(2),
        iso: r.date,
        meta: {
          pollster: r.firm,
          dateLabel: cycDotDate(r.date)
        }
      });
    }
  } else {
    const f = isOpp ? "oppNet" : "pmNet";
    for (const r of src.approval) {
      if (r[f] == null || r.metric === "fav" || !inCycleRange(r.m)) continue;
      out.push({
        x: r.m,
        y: r[f],
        iso: r.date,
        meta: {
          pollster: r.firm,
          dateLabel: cycDotDate(r.date)
        }
      });
    }
  }
  return out;
}
function obsRuns(pts, observed) {
  if (pts.length < 2) return [{
    dashed: false,
    points: pts
  }];
  const runs = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const dashed = !(observed(pts[i].x) && observed(pts[i + 1].x));
    const last = runs[runs.length - 1];
    if (last && last.dashed === dashed) last.points.push(pts[i + 1]);else runs.push({
      dashed,
      points: [pts[i], pts[i + 1]]
    });
  }
  return runs;
}
const sitting = s => s.split(" → ").pop();
const CYC_SHAPES = ["circle", "triangle", "diamond"];
function cycShapes(shown) {
  const seen = {},
    out = {};
  for (const c of shown) {
    const n = seen[c.color] = (seen[c.color] || 0) + 1;
    out[c.year] = CYC_SHAPES[n - 1] || "circle";
  }
  return out;
}
const toMonthlyMemo = new WeakMap();
function toMonthly(months, vals, maxM) {
  if (!vals || typeof vals !== "object" || !months || typeof months !== "object") return toMonthlyGrid(months, vals, maxM);
  let byMonths = toMonthlyMemo.get(vals);
  const hit = byMonths && byMonths.get(months);
  if (hit && hit.maxM === maxM) return hit.out;
  const out = toMonthlyGrid(months, vals, maxM);
  if (!byMonths) toMonthlyMemo.set(vals, byMonths = new WeakMap());
  byMonths.set(months, {
    maxM,
    out
  });
  return out;
}
let cycLongDayF = null;
const cycLongDay = iso => (cycLongDayF || (cycLongDayF = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  month: "long",
  year: "numeric"
}))).format(new Date(iso + "T00:00:00"));
function toMonthlyGrid(months, vals, maxM) {
  const anchors = [];
  for (let i = 0; i < months.length; i++) {
    if (vals[i] != null) anchors.push({
      m: months[i],
      v: vals[i]
    });
  }
  const out = [];
  for (let m = 0; m <= maxM; m++) {
    if (!anchors.length || m < anchors[0].m || m > anchors[anchors.length - 1].m) {
      out.push({
        x: m,
        y: null
      });
      continue;
    }
    let k = 0;
    while (k < anchors.length - 1 && anchors[k + 1].m <= m) k++;
    const a = anchors[k],
      b = anchors[Math.min(k + 1, anchors.length - 1)];
    const t = b.m === a.m ? 0 : (m - a.m) / (b.m - a.m);
    out.push({
      x: m,
      y: +(a.v + (b.v - a.v) * t).toFixed(2)
    });
  }
  return out;
}
function pctOf(sorted, p) {
  const i = (sorted.length - 1) * p;
  const lo = Math.floor(i),
    hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}
function cycHolders(c, M) {
  if (M.key === "ppmm") {
    if (!c.raw.ppmPair && !(c.raw.ppmEras && c.raw.ppmEras.length)) return c.lead + " v " + c.oppLead;
    const pairs = c.raw.ppmEras && c.raw.ppmEras.length > 1 ? c.raw.ppmEras.map(e => e.name) : [c.raw.ppmPair];
    const side = i => {
      const seen = [];
      for (const pr of pairs) {
        const nm = String(pr).split(" v ")[i];
        if (nm && seen[seen.length - 1] !== nm) seen.push(nm);
      }
      return seen.join("\u2013");
    };
    return side(0) + " v " + side(1);
  }
  return String(M.leader === "opp" ? c.oppLead : c.pm).split(/\s*\u2192\s*/).join("\u2013");
}
function cycHolderAt(c, M, m) {
  const eras = M.key === "ppmm" ? c.raw.ppmEras || null : c.raw[M.leader === "opp" ? "oppEras" : "netEras"] || null;
  if (eras && eras.length) {
    let pick = eras[0];
    for (const e of eras) {
      if (e.from && cycEventMonth(e.from, c.eDate) <= m) pick = e;
    }
    let nm = String(pick.name);
    if (M.key === "ppmm") nm = nm.split(" v ")[0];
    return sitting(nm);
  }
  if (M.key === "ppmm") {
    const pair = c.raw.ppmPair ? String(c.raw.ppmPair) : sitting(String(c.pm)) + " v " + sitting(String(c.oppLead));
    return sitting(pair.split(" v ")[0]);
  }
  return sitting(String(M.leader === "opp" ? c.oppLead : c.pm));
}
function CycleChart({
  metric,
  cycles,
  mode,
  hidden,
  hi,
  setHi,
  lifted,
  unlift,
  chipClick,
  toggle,
  showAll,
  hideAll,
  showOutcome,
  showHan,
  setHan,
  showOnp,
  setOnp,
  showComb,
  setComb,
  shapes,
  outcomeShown,
  rdHalf,
  rdEvents,
  evtOut,
  onEvtOut
}) {
  const {
    D
  } = window.AP;
  const narrow = useNarrow();
  const M = metric;
  const chg = mode === "chg";
  const isOpp = M.leader === "opp";
  const HAN_COLOR = D.PARTIES.onp.color;
  const hanCycle = M.han ? cycles.find(c => c.current) : null;
  const hanRaw = hanCycle && hanCycle.raw.han || null;
  const hanAvail = !!(hanRaw && hanRaw.some(v => v != null));
  const hanFrom = hanAvail ? (() => {
    const dates = D.individualPolls.filter(p => p.appr && p.appr.hansonNet != null && (!p.appr.metricBy || p.appr.metricBy.hanson !== "fav")).map(p => p.released).sort();
    if (!dates.length) return null;
    return cycLongDay(dates[0]);
  })() : null;
  const colorOf = c => isOpp ? D.PARTIES[c.opp].color : c.color;
  const shown = cycles.filter(c => !hidden.has(c.year));
  const hasData = c => (c.raw[M.key] || []).some(v => v != null);
  const pastShown = shown.filter(c => !c.current && hasData(c));
  const banded = pastShown.length >= 3;
  const drawnCycles = banded ? shown.filter(c => c.current || hasData(c) && (lifted.has(c.year) || hi === c.year)) : shown;
  const solo = shown.length === 1 ? shown[0] : null;
  const pastForward = drawnCycles.filter(c => !c.current);
  const eventCycle = solo || (pastForward.length === 1 ? pastForward[0] : pastForward.length === 0 ? drawnCycles.find(c => c.current) || null : null);
  const tipCycle = solo || (banded && pastForward.length === 1 ? pastForward[0] : null);
  const contestEvents = eventCycle && eventCycle.current && M.key === "tpp" && eventCycle.raw.tppEras ? eventCycle.raw.tppEras.filter(e => e.from).map(e => {
    const rival = e.rival === "alp_on" ? "One Nation" : "the Coalition";
    const other = e.rival === "alp_on" ? "the Coalition" : "One Nation";
    return {
      date: e.from,
      short: "Now " + (e.rival === "alp_on" ? "v One Nation" : "v Coalition"),
      label: "Labor’s main rival becomes " + rival,
      desc: "From here the line is Labor’s implied two-party vote against " + rival + ". " + (e.why === "primary" ? "The two contests were too close to call after preferences, and " + rival + " was clearly ahead of " + other + " on first preferences: the same ruling the headline follows." : rival.charAt(0).toUpperCase() + rival.slice(1) + " ran Labor clearly closer after preferences: the same ruling the headline follows."),
      major: true,
      x: cycEventMonth(e.from, eventCycle.eDate)
    };
  }) : [];
  const cycleEvents = eventCycle ? (CYC_EVENTS[eventCycle.year] || []).filter(e => !e.metrics || e.metrics.includes(M.key)).map(e => ({
    ...e,
    x: cycEventMonth(e.date, eventCycle.eDate)
  })).concat(contestEvents) : [];
  const cardSub = (() => {
    const fanned = M.key === "net" || M.key === "oppnet" || M.key === "ppmm" || M.key === "primary" || M.key === "tpp" || M.key === "oppr" || M.key === "pmlead";
    if (!fanned || !banded) return M.sub;
    const lead = M.key === "net" || M.key === "oppnet" ? "Approval minus disapproval" : M.sub;
    const firstYear = Math.min(...pastShown.map(c => c.year));
    if (outcomeShown === "returned") return lead + ", with a historical fan chart for all terms since " + firstYear + " that ended in a returned government";
    if (outcomeShown === "ousted") return lead + ", with a historical fan chart for all terms since " + firstYear + " that ended in an ousted government";
    const gapped = cycles.some(c => !c.current && hasData(c) && c.year >= firstYear && hidden.has(c.year));
    return lead + ", with a historical fan chart for " + (gapped ? "selected" : "all") + " previous terms since " + firstYear;
  })();
  const hanCtl = M.han && hanAvail && hanCycle;
  const ringTerms = M.key === "tpp" || M.key === "primary" || M.key === "oppr" ? [] : null;
  const built = drawnCycles.flatMap(c => {
    const base = cycBase(c, M.key);
    const eras = M.key === "net" && c.raw.netEras || M.key === "oppnet" && c.raw.oppEras || M.key === "ppmm" && c.raw.ppmEras || M.key === "tpp" && c.raw.tppEras || M.key === "pmlead" && c.raw.pmleadEras || null;
    const seriesIn = eras ? eras.map(e => ({
      name: e.name,
      months: e.months,
      vals: e.vals,
      obs: e.obs
    })) : [{
      name: null,
      months: c.raw.months,
      vals: c.raw[M.key],
      obs: (c.raw.obs || {})[M.key]
    }];
    const isHi = hi === c.year;
    const out = isHi || lifted.has(c.year);
    const dim = !out && !c.current && (hi != null || lifted.size > 0);
    let width, weight, opacity, labOp;
    if (c.current) {
      width = isHi ? 4 : 3.6;
      weight = 3;
      opacity = 1;
      labOp = 1;
    } else if (out) {
      width = 3;
      weight = 2;
      opacity = 1;
      labOp = 1;
    } else {
      width = 1.7;
      weight = dim ? 0 : 1;
      opacity = dim ? 0.13 : 0.42;
      labOp = dim ? 0.2 : 0.75;
    }
    if (ringTerms) ringTerms.push({
      yr: c.year,
      color: colorOf(c),
      opacity,
      base,
      close: c.endRes || null
    });
    return seriesIn.flatMap((s, si) => {
      const monthly = toMonthly(s.months, s.vals, c.span);
      const pts = monthly.filter(p => p.y != null).map(p => ({
        x: p.x,
        y: chg ? +(p.y - base).toFixed(2) : p.y
      }));
      const leadName = s.name || (M.key === "ppmm" ? c.raw.ppmPair : M.key === "pmlead" ? c.raw.pmleadPair : isOpp ? c.oppLead : c.lead);
      const label = solo ? leadName : c.year + ", " + leadName;
      const flags = s.obs;
      const observed = m => {
        if (!flags) return true;
        const i = s.months.indexOf(m);
        return i < 0 ? true : !!flags[i];
      };
      if (flags) pts.forEach(p => {
        if (!observed(p.x)) p.note = "no poll, Interpolated";
      });
      const runs = obsRuns(pts, observed);
      const termEnd = si === seriesIn.length - 1;
      let clampedToRing = false;
      if (termEnd && ringTerms != null && c.endRes) {
        const lastPt = pts[pts.length - 1];
        if (lastPt && Math.round(c.endRes.x) === lastPt.x && c.endRes.x < lastPt.x - 1e-6) {
          lastPt.x = c.endRes.x;
          clampedToRing = true;
        }
      }
      const rows = runs.map((run, i) => ({
        id: "c" + c.year + (si ? "-e" + si : "") + (i ? "-" + i : ""),
        label,
        color: colorOf(c),
        width,
        points: run.points,
        weight,
        current: c.current,
        opacity,
        dashed: run.dashed,
        lead: ringTerms != null && run.dashed && run.points[0].x === 0,
        ...(termEnd && i === runs.length - 1 ? {
          endLabel: "’" + String(c.year).slice(2),
          endLabelOpacity: labOp
        } : {
          endCap: false
        })
      }));
      if (termEnd && ringTerms != null && c.endRes && c.endRes[M.key] != null) {
        const lastPt = pts[pts.length - 1];
        const ringY = chg ? +(c.endRes[M.key] - base).toFixed(2) : c.endRes[M.key];
        if (lastPt && (c.endRes.x > lastPt.x + 1e-6 || clampedToRing && Math.abs(ringY - lastPt.y) > 0.005)) rows.push({
          id: "c" + c.year + (si ? "-e" + si : "") + "-tail",
          label,
          color: colorOf(c),
          width,
          weight,
          current: c.current,
          opacity,
          dashed: true,
          tail: true,
          endCap: false,
          points: [{
            x: lastPt.x,
            y: lastPt.y
          }, {
            x: c.endRes.x,
            y: ringY
          }]
        });
      }
      return rows;
    });
  });
  const bandN = pastShown.length;
  const pastKey = pastShown.map(c => c.year).join(",");
  const bandRows = React.useMemo(() => {
    const rows = [];
    if (!bandN) return rows;
    const pooled = pastShown.map(c => {
      const base = cycBase(c, M.key);
      const flags = (c.raw.obs || {})[M.key];
      return toMonthly(c.raw.months, c.raw[M.key], c.span).map((p, m) => {
        if (p.y == null) return null;
        const i = c.raw.months.indexOf(m);
        return {
          v: chg ? +(p.y - base).toFixed(2) : p.y,
          obs: !flags || i < 0 || !!flags[i],
          who: cycHolderAt(c, M, m),
          yr: c.year
        };
      });
    });
    for (let m = 0; m < CYC_SPINE.length; m++) {
      const vs = [];
      let polled = 0;
      for (let k = 0; k < pooled.length; k++) {
        const p = pooled[k][m];
        if (!p) continue;
        vs.push(p);
        if (p.obs) polled++;
      }
      if (!vs.length) continue;
      vs.sort((a, b) => a.v - b.v);
      const nums = vs.map(p => p.v);
      rows.push({
        m,
        n: vs.length,
        polled,
        mean: +(nums.reduce((s, v) => s + v, 0) / nums.length).toFixed(2),
        p10: +pctOf(nums, 0.1).toFixed(2),
        p90: +pctOf(nums, 0.9).toFixed(2),
        q1: +pctOf(nums, 0.25).toFixed(2),
        q3: +pctOf(nums, 0.75).toFixed(2),
        vals: vs.map(p => ({
          v: p.v,
          who: p.who,
          yr: p.yr
        }))
      });
    }
    return rows;
  }, [pastKey, bandN, M.key, chg]);
  let bandAreas = null;
  if (banded && bandRows.length > 1) {
    const floor = Math.max(3, Math.ceil(bandN * 0.75));
    const segs = [];
    bandRows.forEach((r, i) => {
      const thin = r.n < floor;
      const last = segs[segs.length - 1];
      if (!last || last.thin !== thin) segs.push({
        thin,
        pts: i ? [bandRows[i - 1], r] : [r]
      });else last.pts.push(r);
    });
    bandAreas = segs.filter(s => s.pts.length > 1).flatMap((s, i) => [{
      id: "cyc-band-lo" + i,
      className: "cyc-band lo" + (s.thin ? " thin" : ""),
      color: "var(--cyc-fill)",
      opacity: 0.07,
      edge: false,
      points: s.pts.map(r => ({
        x: r.m,
        y0: r.p10,
        y1: r.p90
      }))
    }, {
      id: "cyc-band-hi" + i,
      className: "cyc-band hi" + (s.thin ? " thin" : ""),
      color: "var(--cyc-fill)",
      opacity: 0.13,
      edge: false,
      points: s.pts.map(r => ({
        x: r.m,
        y0: r.q1,
        y1: r.q3
      }))
    }]);
    built.push({
      id: "cyc-band-mean",
      label: "Mean of past terms",
      color: "var(--ink-2)",
      width: 1.9,
      weight: 0.5,
      opacity: 0.85,
      dash: "2 3.4",
      smooth: false,
      endCap: false,
      points: bandRows.map(r => ({
        x: r.m,
        y: r.mean,
        note: r.n + " of " + bandN + " terms" + (r.polled < r.n ? " \u00b7 " + r.polled + " polled" : "")
      }))
    });
  }
  const dotsOn = !!shapes && shown.length > 0 && shown.length <= CYC_DOT_MAX;
  const shownKey = shown.map(c => c.year).join(",");
  const liftKey = [...lifted].sort((a, b) => a - b).join(",");
  const srcTerms = Object.keys(D.cycleSource || {}).length;
  const scatter = React.useMemo(() => !dotsOn ? [] : shown.flatMap(c => {
    const base = cycBase(c, M.key);
    const leadName = M.key === "ppmm" ? c.raw.ppmPair : M.key === "pmlead" ? c.raw.pmleadPair : isOpp ? c.oppLead : c.lead;
    const label = solo ? leadName : c.year + ", " + leadName;
    const eras = M.key === "net" && c.raw.netEras || M.key === "oppnet" && c.raw.oppEras || M.key === "ppmm" && c.raw.ppmEras || M.key === "tpp" && c.raw.tppEras || M.key === "pmlead" && c.raw.pmleadEras || null;
    const nameAt = iso => {
      if (!eras || !iso) return null;
      let n = eras[0].name;
      for (const e of eras) if (e.from && iso >= e.from) n = e.name;
      return n;
    };
    const dim = !c.current && hi !== c.year && !lifted.has(c.year) && (hi != null || lifted.size > 0);
    return cycleReadings(c, M, D).map(p => {
      const n = nameAt(p.iso);
      return {
        x: p.x,
        y: chg ? +(p.y - base).toFixed(2) : p.y,
        color: colorOf(c),
        shape: shapes[c.year],
        label: n ? solo ? n : c.year + ", " + n : label,
        meta: p.meta,
        op: dim ? 0.3 : 1
      };
    });
  }), [dotsOn, shownKey, M.key, isOpp, chg, hi, liftKey, srcTerms]);
  if (hanCtl && showHan) {
    const hBase = cycBase(hanCycle, "han");
    const pts = hanCycle.raw.months.map((m, i) => ({
      x: m,
      y: hanRaw[i]
    })).filter(p => p.y != null).map(p => ({
      x: p.x,
      y: chg ? +(p.y - hBase).toFixed(2) : p.y
    }));
    const dimmed = hi != null && !hanCycle.current;
    built.push({
      id: "cyc-han",
      label: "Hanson, One Nation",
      color: HAN_COLOR,
      width: 2.2,
      points: pts,
      weight: 2.5,
      smooth: false,
      dashed: true,
      opacity: dimmed ? 0.2 : 0.9,
      endLabel: "PH",
      endLabelOpacity: dimmed ? 0.2 : 0.85
    });
  }
  if (M.onp && showComb) {
    const c = shown.find(x => x.current);
    if (c) {
      const cBase = cycBase(c, "oppr") + cycBase(c, "onp");
      const pts = c.raw.months.map((m, i) => ({
        x: m,
        y: c.raw.oppr[i] != null && c.raw.onp[i] != null ? +(c.raw.oppr[i] + c.raw.onp[i]).toFixed(2) : null
      })).filter(p => p.y != null).map(p => ({
        x: p.x,
        y: chg ? +(p.y - cBase).toFixed(2) : p.y
      }));
      if (pts.length) {
        built.push({
          id: "cyc-comb",
          label: "L/NP + One Nation",
          color: "var(--ink-2)",
          width: 2.2,
          points: pts,
          weight: 2.5,
          smooth: false,
          dash: "1 3",
          opacity: 0.85,
          endLabel: "L/NP+ON",
          endLabelOpacity: 0.8
        });
      }
    }
  }
  if (M.onp && showOnp) {
    const c = shown.find(x => x.current);
    if (c) {
      const oBase = cycBase(c, "onp");
      const pts = c.raw.months.map((m, i) => ({
        x: m,
        y: c.raw.onp[i]
      })).filter(p => p.y != null).map(p => ({
        x: p.x,
        y: chg ? +(p.y - oBase).toFixed(2) : p.y
      }));
      if (pts.length) {
        built.push({
          id: "cyc-onp",
          label: "One Nation",
          color: HAN_COLOR,
          width: 2.2,
          points: pts,
          weight: 2.5,
          smooth: false,
          dash: "1 3",
          opacity: 0.85,
          endLabel: "ON",
          endLabelOpacity: 0.8
        });
      }
    }
  }
  built.sort((a, b) => a.weight - b.weight);
  const {
    domain,
    ticks
  } = cycDomain(cycles, M, chg);
  const refY = chg ? 0 : M.refAbs;
  const refLabel = chg ? M.chgRefLabel || "Election result" : M.refAbsLabel;
  const refLines = refY != null ? [{
    y: refY,
    label: refLabel,
    color: "var(--ink-faint)",
    align: "left"
  }] : [];
  const stripCycles = solo ? [] : (banded ? shown.filter(c => c.current || lifted.has(c.year)) : shown.slice()).filter(c => c.current || hasData(c)).sort((a, b) => (b.current ? 1 : 0) - (a.current ? 1 : 0) || a.year - b.year);
  const overlayYears = keep => {
    const dates = D.individualPolls.filter(keep).map(p => p.released).sort();
    if (!dates.length) return null;
    const y0 = dates[0].slice(0, 4),
      y1 = dates[dates.length - 1].slice(0, 4);
    const tail = y0.slice(0, 2) === y1.slice(0, 2) ? y1.slice(2) : y1;
    return y0 + (y1 === y0 ? "" : "–" + tail);
  };
  const hanYears = hanCtl && showHan ? overlayYears(p => p.appr && p.appr.hansonNet != null && (!p.appr.metricBy || p.appr.metricBy.hanson !== "fav")) : null;
  const onpYears = M.onp && showOnp && shown.some(c => c.current) ? overlayYears(p => p.p && p.p.onp != null) : null;
  const combYears = M.onp && showComb && shown.some(c => c.current) ? overlayYears(p => p.p && p.p.onp != null && p.p.lnp != null) : null;
  const cur = cycles.find(c => c.current);
  let insight = null;
  if (cur && !hidden.has(cur.year)) {
    const mNow = cur.span;
    const curVal = chg ? cur.end[M.key] - cycBase(cur, M.key) : cur.end[M.key];
    const peerRow = bandRows.find(r => r.m === mNow);
    if (peerRow) {
      const d = curVal - peerRow.mean;
      const better = d >= 0;
      const subjParty = M.key === "net" || M.key === "oppnet" || M.key === "ppmm" ? null : isOpp ? cur.opp : cur.gov;
      const subjLabel = M.key === "net" ? sitting(cur.pm) : M.key === "oppnet" ? sitting(cur.oppLead) : M.key === "ppmm" ? sitting(cur.pm) : (subjParty === "lnp" ? "the " : "") + D.PARTIES[subjParty].name;
      const peerNoun = M.key === "net" ? "prime minister" : M.key === "oppnet" ? "opposition leader" : M.key === "ppmm" ? "prime minister" : isOpp ? "opposition" : "government";
      const curMag = Math.abs(curVal).toFixed(1);
      const curSign = (chg || !M.unit) && parseFloat(curMag) !== 0 ? curVal < 0 ? "−" : "+" : "";
      const tppEraNow = M.key === "tpp" && cur.raw.tppEras ? cur.raw.tppEras[cur.raw.tppEras.length - 1] : null;
      const rivalNote = tppEraNow && tppEraNow.rival === "alp_on" ? " against One Nation" : "";
      insight = {
        d: Math.abs(d),
        better,
        mNow,
        subjLabel,
        peerNoun,
        rank: null,
        curFmt: curSign + curMag + M.unit + rivalNote
      };
      const cand = peerRow.vals || [];
      if (cand.length >= 5) {
        const below = cand.filter(p => p.v < curVal);
        const above = cand.filter(p => p.v > curVal);
        const side = below.length <= 4 && below.length < above.length ? "low" : above.length <= 4 && above.length < below.length ? "high" : null;
        if (side) {
          const counts = {};
          for (const p of cand) counts[p.who] = (counts[p.who] || 0) + 1;
          const fmtPeer = p => {
            const r = +p.v.toFixed(1);
            const sgn = chg || !M.unit;
            const val = (sgn && r > 0 ? "+" : sgn && r < 0 ? "\u2212" : "") + Math.abs(r).toFixed(1) + (M.unit || "");
            return counts[p.who] > 1 ? p.who + " (" + p.yr + ", " + val + ")" : p.who + " (" + val + ")";
          };
          const near = side === "low" ? below : above.slice().reverse();
          const refsOf = ps => ps.map(p => ({
            yr: p.yr,
            label: fmtPeer(p)
          }));
          insight.rank = near.length ? {
            lead: "Only ",
            refs: refsOf(near),
            tail: " sat " + (side === "low" ? "lower" : "higher") + " at this point."
          } : {
            lead: "The second and third " + (side === "low" ? "lowest" : "highest") + " at this point were ",
            refs: refsOf(side === "low" ? cand.slice(0, 2) : cand.slice(-2).reverse()),
            tail: "."
          };
        }
      }
    }
  }
  if (window.AP.rd) return React.createElement(RdCycleChart, {
    M: M,
    chg: chg,
    built: built,
    bandAreas: bandAreas,
    bandRows: bandRows,
    scatter: scatter,
    events: rdEvents || cycleEvents,
    badged: !!rdEvents,
    domain: domain,
    ticks: ticks,
    cur: cur,
    hidden: hidden,
    liftedN: lifted.size,
    narrow: narrow,
    half: !!rdHalf,
    hanCtl: hanCtl,
    showHan: showHan,
    setHan: setHan,
    showOnp: showOnp,
    setOnp: setOnp,
    showComb: showComb,
    setComb: setComb,
    tipCycle: tipCycle,
    banded: banded,
    bandN: bandN,
    isOpp: isOpp,
    terms: shown.filter(hasData).map(c => c.year),
    outcomeShown: outcomeShown,
    rings: ringTerms,
    evtOut: evtOut,
    onEvtOut: onEvtOut
  });
  return React.createElement("section", {
    className: "card cycle-card"
  }, React.createElement("div", {
    className: "card-head cycle-head"
  }, React.createElement("div", null, React.createElement("h2", {
    className: "card-title"
  }, M.key === "net" || M.key === "oppnet" ? React.createElement(React.Fragment, null, M.title.replace("net approval", ""), React.createElement("button", {
    type: "button",
    className: "hi-term",
    title: "What the approval question asks",
    onClick: () => window.AP.openTerm && window.AP.openTerm("approval", M.title)
  }, "net approval")) : M.title), React.createElement("p", {
    className: "card-sub"
  }, cardSub), React.createElement(CycleLegend, {
    cycles: cycles,
    hidden: hidden,
    lifted: lifted,
    hi: hi,
    setHi: setHi,
    chipClick: chipClick,
    toggle: toggle,
    showAll: showAll,
    hideAll: hideAll,
    showOutcome: showOutcome,
    outcomeShown: outcomeShown,
    shapes: shapes,
    banded: banded,
    hasData: hasData
  }), hanCtl && React.createElement("label", {
    className: "pg-check cyc-han" + (showHan ? " on" : ""),
    title: "Pauline Hanson, on the same approve-minus-disapprove basis. " + "Rated in the current term only, from " + hanFrom + " – no past cycle asked about her, " + "and favourability ratings are left out, so the line is short."
  }, React.createElement("input", {
    type: "checkbox",
    checked: !!showHan,
    onChange: e => setHan(e.target.checked)
  }), "Pauline Hanson this term"), M.onp && React.createElement("label", {
    className: "pg-check cyc-comb" + (showComb ? " on" : ""),
    title: "The Coalition's and One Nation's first-preference votes summed, " + "drawn as one dotted line over the current term only. The parties' " + "past terms are left off – they crowd the chart without adding context."
  }, React.createElement("input", {
    type: "checkbox",
    checked: !!showComb,
    onChange: e => setComb(e.target.checked)
  }), "Combine L/NP and ON"), M.onp && React.createElement("label", {
    className: "pg-check cyc-onp" + (showOnp ? " on" : ""),
    title: "One Nation first-preference support, drawn as one dotted line " + "over the current term only. The party's past terms are left off – " + "they crowd the chart without adding context."
  }, React.createElement("input", {
    type: "checkbox",
    checked: !!showOnp,
    onChange: e => setOnp(e.target.checked)
  }), "One Nation this term")), insight && (() => {
    const shown = M.fmt(insight.d).replace(/^[+−-]/, "").replace(/\.0+$/, "");
    const level = parseFloat(shown) === 0;
    const rankJsx = insight.rank && React.createElement(React.Fragment, null, " ", insight.rank.lead, insight.rank.refs.map((r, i, a) => React.createElement(React.Fragment, {
      key: r.yr
    }, i > 0 && (i === a.length - 1 ? a.length > 2 ? ", and " : " and " : ", "), React.createElement("button", {
      type: "button",
      className: "ci-peer",
      title: hidden.has(r.yr) ? "Put the " + r.yr + " term back on the chart" : "Draw the " + r.yr + " term's own line",
      onClick: () => chipClick(r.yr)
    }, r.label))), insight.rank.tail);
    if (level) return React.createElement("p", {
      className: "cycle-insight"
    }, cycMonthLabel(insight.mNow), ", ", insight.subjLabel, " ", "(", insight.curFmt, ") is", " ", React.createElement("span", {
      className: "ci-delta level"
    }, "in line with"), " ", "the average ", insight.peerNoun, " at this point.", rankJsx);
    return React.createElement("p", {
      className: "cycle-insight"
    }, cycMonthLabel(insight.mNow), ", ", insight.subjLabel, " ", "(", insight.curFmt, ") sits", " ", React.createElement("span", {
      className: "ci-delta " + (insight.better ? "pos" : "neg")
    }, shown, parseFloat(shown) === 1 ? " point" : " points"), " ", insight.better ? "above" : "below", " the average ", insight.peerNoun, " at this point.", rankJsx);
  })()), (stripCycles.length > 0 || hanYears || onpYears) && React.createElement("div", {
    className: "cyc-drawn"
  }, React.createElement("span", {
    className: "cyc-drawn-label"
  }, "Drawn here"), stripCycles.map(c => React.createElement("span", {
    key: c.year,
    className: "cyc-drawn-item" + (lifted.has(c.year) ? "" : " fixed"),
    style: {
      "--cyc": colorOf(c)
    }
  }, React.createElement("span", {
    className: "cyc-drawn-rule",
    "aria-hidden": "true"
  }), React.createElement("span", {
    className: "cyc-drawn-year"
  }, c.year), React.createElement("span", {
    className: "cyc-drawn-who"
  }, cycHolders(c, M)), lifted.has(c.year) && !c.current && React.createElement("button", {
    type: "button",
    className: "cyc-drawn-x",
    title: "Return " + c.year + " to the band",
    "aria-label": "Return " + c.year + " to the band",
    onClick: () => unlift(c.year)
  }, "\xD7"))), hanYears && React.createElement("span", {
    className: "cyc-drawn-item fixed",
    style: {
      "--cyc": HAN_COLOR
    }
  }, React.createElement("span", {
    className: "cyc-drawn-rule",
    "aria-hidden": "true"
  }), React.createElement("span", {
    className: "cyc-drawn-who"
  }, "Pauline Hanson in " + hanYears)), onpYears && React.createElement("span", {
    className: "cyc-drawn-item fixed",
    style: {
      "--cyc": HAN_COLOR
    }
  }, React.createElement("span", {
    className: "cyc-drawn-rule",
    "aria-hidden": "true"
  }), React.createElement("span", {
    className: "cyc-drawn-who"
  }, "One Nation in " + onpYears)), combYears && React.createElement("span", {
    className: "cyc-drawn-item fixed",
    style: {
      "--cyc": "var(--ink-2)"
    }
  }, React.createElement("span", {
    className: "cyc-drawn-rule",
    "aria-hidden": "true"
  }), React.createElement("span", {
    className: "cyc-drawn-who"
  }, "L/NP + One Nation in " + combYears))), React.createElement(TrendChart, {
    key: "cyc-" + M.key + "-" + mode,
    height: narrow ? 500 : 300,
    xDomain: CYC_XDOMAIN,
    yDomain: domain,
    yTicks: ticks,
    unit: M.unit,
    axisFont: narrow ? 28 : 20,
    pad: {
      l: 56,
      r: 44,
      t: 16,
      b: 40
    },
    xTicks: CYC_XTICKS,
    refLines: refLines,
    series: built,
    spine: CYC_SPINE,
    scatter: scatter,
    events: cycleEvents,
    areas: bandAreas || undefined,
    tooltipTitle: i => cycMonthLabel(CYC_SPINE[i].x) + (tipCycle ? " – " + cycMonthOf(tipCycle.eDate, CYC_SPINE[i].x) : ""),
    fmt: M.fmt
  }), solo && M.key === "primary" && ((D.cycleSource || {})[solo.year] || {}).trove && (() => {
    const t = (D.cycleSource || {})[solo.year].trove;
    return React.createElement("p", {
      className: "cycle-insight"
    }, "Newspapers mentioned a poll in ", t.articles.toLocaleString(), " articles over this term (", t.pollArticles.toLocaleString(), " poll reports) \u2014", " ", React.createElement("a", {
      href: "/archives/trove/#y" + solo.year
    }, "Trove newspaper archive"), ".");
  })(), M.note && React.createElement("p", {
    className: "cycle-basis"
  }, M.note), M.noteMore && React.createElement(HowTo, {
    cls: "cycle-basis",
    paras: M.noteMore
  }));
}
function CycleLegend({
  cycles,
  hidden,
  lifted,
  hi,
  setHi,
  chipClick,
  toggle,
  showAll,
  hideAll,
  showOutcome,
  outcomeShown,
  shapes,
  banded,
  hasData
}) {
  const [pop, setPop] = useState(null);
  const total = cycles.length;
  const onBoard = total - hidden.size;
  const cur = cycles.find(c => c.current);
  const drawnN = banded ? lifted.size + (cur && !hidden.has(cur.year) ? 1 : 0) : onBoard;
  const summary = (hidden.size ? onBoard + " of " + total + " terms" : lifted.size ? total + " terms" : (() => {
    const withData = hasData ? cycles.filter(c => c.current || hasData(c)) : cycles;
    return withData.length + " terms since " + withData[0].year;
  })()) + (lifted.size ? ", " + drawnN + " drawn" : "");
  const OUTCOME_NOTE = " at the election that ended it. The sitting term has not" + " faced its election, so it is in neither set.";
  const QUICK = [{
    id: "all",
    label: "All",
    run: showAll,
    title: "Every term on the board"
  }, {
    id: "none",
    label: "None",
    run: hideAll,
    title: "Clear the board – no term left in the band, the mean, or the download"
  }, {
    id: "returned",
    label: "Returned",
    run: () => showOutcome("returned"),
    title: "Only terms whose government was returned" + OUTCOME_NOTE
  }, {
    id: "ousted",
    label: "Ousted",
    run: () => showOutcome("ousted"),
    title: "Only terms whose government was ousted" + OUTCOME_NOTE
  }];
  const quick = hidden.size === 0 ? "all" : hidden.size === total ? "none" : outcomeShown;
  return React.createElement("div", {
    className: "cyc-legend" + (banded ? " banded" : ""),
    onMouseLeave: () => setHi(null)
  }, React.createElement("div", {
    className: "cyc-legend-bar"
  }, React.createElement(FilterPop, {
    id: "board",
    label: "Cycles",
    summary: summary,
    open: pop,
    setOpen: setPop,
    inline: true,
    on: hidden.size > 0 || lifted.size > 0
  }, React.createElement("div", {
    className: "ap-pop-head"
  }, React.createElement("span", null, "On the board"), React.createElement("div", {
    className: "pop-quick",
    role: "group",
    "aria-label": "Board shortcuts"
  }, QUICK.map(q => React.createElement("button", {
    key: q.id,
    type: "button",
    title: q.title,
    "aria-pressed": quick === q.id,
    className: "pop-quick-opt" + (quick === q.id ? " active" : ""),
    onClick: q.run
  }, q.label)))), React.createElement("div", {
    className: "cyc-board",
    role: "group",
    "aria-label": "Federal terms"
  }, cycles.map(c => {
    const off = hidden.has(c.year);
    const lift = lifted.has(c.year) && !off;
    const drawn = lift || c.current;
    const pmNames = c.raw.netEras && c.raw.netEras.length > 1 ? c.raw.netEras.map(e => e.name).join("–") : c.lead;
    const label = c.year + " " + pmNames;
    return (React.createElement("span", {
        key: c.year,
        className: "cyc-row" + (off ? " off" : "") + (c.current ? " current" : "") + (lift ? " lifted" : "") + (drawn ? " drawn" : ""),
        style: {
          "--cyc": c.color,
          "--cyc-text": inkOf(c.color)
        },
        onMouseEnter: () => setHi(c.year)
      }, React.createElement("button", {
        type: "button",
        className: "cyc-main",
        "aria-pressed": drawn,
        "aria-label": off ? label + " – off the board, put it back" : c.current ? label + " – the sitting term, always drawn" : lift ? label + " – drawn as its own line, return it to the band" : label + " – pooled into the band, draw its own line",
        onFocus: () => setHi(c.year),
        onClick: () => chipClick(c.year)
      }, React.createElement("span", {
        className: "cyc-swatch" + (shapes && shapes[c.year] && shapes[c.year] !== "circle" ? " sw-" + shapes[c.year] : "")
      }), React.createElement("span", {
        className: "cyc-year"
      }, c.year), React.createElement("span", {
        className: "cyc-lead"
      }, pmNames), c.current && React.createElement("span", {
        className: "cyc-now"
      }, "Now")), React.createElement("button", {
        type: "button",
        className: "cyc-x",
        title: off ? "Put " + c.year + " back on the board" : "Take " + c.year + " off the board – out of the band, the mean, and the download",
        "aria-label": off ? "Put " + label + " back on the board" : "Take " + label + " off the board",
        onClick: () => toggle(c.year)
      }, off ? "+" : "×"))
    );
  })), React.createElement("p", {
    className: "ap-pop-foot"
  }, "Click a term to draw its own line over the band, and again to put it back. The \xD7 takes it off the board altogether \u2013 out of the band, the mean, and the download.")), banded && React.createElement("div", {
    className: "cyc-band-note",
    "aria-hidden": "true"
  }, React.createElement("svg", {
    className: "cyc-band-key",
    viewBox: "0 0 30 12"
  }, React.createElement("rect", {
    className: "cyc-band lo",
    x: "4",
    y: "0",
    width: "22",
    height: "12",
    fill: "var(--cyc-fill)"
  }), React.createElement("rect", {
    className: "cyc-band hi",
    x: "4",
    y: "2.5",
    width: "22",
    height: "7",
    fill: "var(--cyc-fill)"
  }), React.createElement("line", {
    x1: "4",
    y1: "6",
    x2: "26",
    y2: "6",
    stroke: "var(--ink-2)",
    strokeWidth: "1.9",
    strokeDasharray: "2 3.4",
    opacity: "0.85"
  })), React.createElement("span", null, "Past terms: mean of the set, middle half, and middle 80%"))));
}
function apprMetricLabel(a) {
  const by = a.metricBy || {};
  const parts = [];
  if (a.albNet != null) parts.push(["Albanese", by.alb]);
  if (a.taylorNet != null) parts.push(["opposition leader", by.taylor]);
  if (a.hansonNet != null) parts.push(["Hanson", by.hanson]);
  const name = m => m === "fav" ? "net favourability" : "net approval";
  if (!parts.length) return null;
  const kinds = new Set(parts.map(([, m]) => m));
  if (kinds.size === 1) return name(parts[0][1]);
  return parts.map(([who, m]) => who + ": " + name(m)).join("; ");
}
function cycleSourceRows(cycles, D) {
  const rows = [["cycle", "series", "date", "date_approx", "months_since_election", "pollster", "primary_alp", "primary_lnp", "primary_grn", "primary_onp", "primary_oth", "tpp_alp", "tpp_lnp", "pm_net", "opp_leader_net", "hanson_net", "leader_metric", "pm_preferred", "opp_leader_preferred", "implied_tpp_alp", "implied_tpp_contest"]];
  const ppmOpp = s => {
    const k = Object.keys(s).find(x => x !== "alb" && x !== "hanson" && x !== "unc");
    return k ? s[k] : null;
  };
  const mainPpm = p => p.ppm || p.ppmSets && p.ppmSets[0] || null;
  const byYear = new Map(cycles.map(c => [c.year, c]));
  Object.entries(D.cycleSource || {}).forEach(([year, src]) => {
    const c = byYear.get(Number(year));
    if (!c) return;
    src.polls.forEach(p => rows.push([year, "voting_intention", p.date, p.dateApprox ?? null, p.m, p.firm, p.alp, p.lnp, p.grn, p.onp, p.oth, p.tpp_alp, p.tpp_lnp, null, null, null, null, null, null, p.imp_alp ?? null, p.imp_alp != null ? "ALP v L/NP" : null]));
    src.approval.forEach(a => {
      if (a.pmNet != null || a.oppNet != null) rows.push([year, "leader_rating", a.date, null, a.m, a.firm, null, null, null, null, null, null, null, a.pmNet, a.oppNet, null, a.metric === "fav" ? "net favourability" : "net approval", null, null]);
      if (a.pmPpm != null || a.oppPpm != null) rows.push([year, "preferred_pm", a.date, null, a.m, a.firm, null, null, null, null, null, null, null, null, null, null, null, a.pmPpm ?? null, a.oppPpm ?? null]);
    });
  });
  const cur = cycles.find(c => c.current);
  if (cur) {
    const eDate = Date.parse(cur.eDate);
    const mo = iso => Math.round((Date.parse(iso) - eDate) / 86400000 / 30.436875 * 10) / 10;
    D.individualPolls.forEach(p => {
      const onRival = rivalOfMonth(D, p.ym) === "alp_on";
      const imp = onRival ? p.alpOnImp : p.alpImp;
      rows.push([cur.year, "voting_intention", p.released, null, mo(p.released), p.pollster, p.p.alp, p.p.lnp, p.p.grn, p.p.onp, p.p.oth, p.alp, p.lnp, null, null, null, null, null, null, imp ?? null, imp != null ? onRival ? "ALP v ON" : "ALP v L/NP" : null]);
      const mp = mainPpm(p);
      if (mp) rows.push([cur.year, "preferred_pm", p.released, null, mo(p.released), p.pollster, null, null, null, null, null, null, null, null, null, null, null, mp.alb ?? null, ppmOpp(mp)]);
      const a = p.appr;
      if (a && (a.albNet != null || a.taylorNet != null || a.hansonNet != null)) rows.push([cur.year, "leader_rating", p.released, null, mo(p.released), p.pollster, null, null, null, null, null, null, null, a.albNet, a.taylorNet, a.hansonNet ?? null, apprMetricLabel(a), null, null]);
    });
  }
  const width = rows[0].length;
  rows.forEach(r => {
    while (r.length < width) r.push(null);
  });
  return rows.slice(0, 1).concat(rows.slice(1).sort((x, y) => x[0] - y[0] || String(x[2]).localeCompare(String(y[2]))));
}
function AccuracyPanel() {
  const {
    D
  } = window.AP;
  const A = D.accuracy;
  const [hov, setHov] = useState(null);
  const [spread, setSpread] = useState(false);
  const [basis, setBasis] = useState("pub");
  const rowsRef = useRef(null);
  const [trackW, setTrackW] = useState(0);
  React.useEffect(() => {
    const el = rowsRef.current && rowsRef.current.querySelector(".acc-track");
    if (!el || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      if (el.clientWidth) setTrackW(el.clientWidth);
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, []);
  window.useDismissOutside(rowsRef, !!hov, () => setHov(null));
  if (!A || !A.cycles.length) return null;
  const SPAN = 5;
  const pct = err => 50 + Math.max(-SPAN, Math.min(SPAN, err)) / SPAN * 50;
  const LANE_SEP = 20;
  const LANE_H = 20;
  const laneOffset = i => i === 0 ? 0 : (i % 2 ? 1 : -1) * Math.ceil(i / 2) * LANE_H;
  const lanesFor = (houses, errF = h => h.err) => {
    const lane = {};
    if (!trackW) {
      houses.forEach(h => {
        lane[h.firm] = 0;
      });
      return {
        lane,
        n: 1
      };
    }
    const pts = houses.map(h => ({
      firm: h.firm,
      x: pct(errF(h)) / 100 * trackW
    })).sort((a, b) => a.x - b.x);
    const last = [];
    for (const p of pts) {
      let i = 0;
      while (i < last.length && p.x - last[i] < LANE_SEP) i++;
      last[i] = p.x;
      lane[p.firm] = i;
    }
    return {
      lane,
      n: Math.max(1, last.length)
    };
  };
  const stacked = A.cycles.reduce((n, c) => {
    const seen = {};
    return n + c.houses.filter(h => {
      const k = h.err.toFixed(2);
      const had = seen[k];
      seen[k] = 1;
      return had;
    }).length;
  }, 0);
  const col = err => err > 0 ? "var(--alp)" : "var(--lnp)";
  const oneSided = [...A.cycles].filter(c => c.sameSide).sort((a, b) => a.year - b.year);
  const numWord = n => ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"][n] ?? String(n);
  const listJoin = a => a.length < 2 ? a.join("") : a.slice(0, -1).join(", ") + (a.length > 2 ? ", and " : " and ") + a[a.length - 1];
  const TIP_W = 184;
  const sgn = v => (v > 0 ? "+" : "") + v.toFixed(1);
  const lean = err => err > 0 ? "Labor overstated" : err < 0 ? "Labor understated" : "Exactly on the result";
  const fmtDay = cycLongDay;
  const open = (e, raw, tip) => {
    const w = (e.currentTarget.parentElement || {}).clientWidth || 1;
    const half = Math.min(TIP_W, w) / 2 / w * 100;
    setHov({
      ...tip,
      left: Math.min(100 - half, Math.max(half, raw))
    });
  };
  const close = () => setHov(null);
  const bothWays = oneSided.length > 1 && oneSided.some(c => c.err > 0) && oneSided.some(c => c.err < 0);
  const byRecency = [...A.cycles].sort((a, b) => b.year - a.year);
  const recent = byRecency.slice(0, 5);
  const earlier = byRecency.slice(5);
  if (window.AP.rd) {
    const nw = n => ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty"][n] ?? String(n);
    const imp = basis === "imp";
    const alpOf = h => imp ? h.alp2ppImp ?? h.alp2pp : h.alp2pp;
    const errOf = h => imp ? h.errImp ?? h.err : h.err;
    const hh = c => imp ? c.houses.filter(h => h.errImp != null) : c.houses;
    const cMean = c => imp ? c.meanImp ?? c.mean : c.mean;
    const cErr = c => imp ? c.errImp ?? c.err : c.err;
    const cSide = c => imp ? c.sameSideImp : c.sameSide;
    const firmsSrc = imp ? A.firmsImp || A.firms : A.firms;
    const meanAbsX = imp && A.meanAbsImp != null ? A.meanAbsImp : A.meanAbs;
    const stackedX = A.cycles.reduce((n, c) => {
      const seen = {};
      return n + hh(c).filter(h => {
        const k = errOf(h).toFixed(2);
        const had = seen[k];
        seen[k] = 1;
        return had;
      }).length;
    }, 0);
    const oneSidedX = [...A.cycles].filter(c => cSide(c)).sort((a, b) => a.year - b.year);
    const bothWaysX = oneSidedX.length > 1 && oneSidedX.some(c => cErr(c) > 0) && oneSidedX.some(c => cErr(c) < 0);
    const last = byRecency[0];
    const opp = last && cSide(last) ? byRecency.slice(1).find(c => cSide(c) && Math.sign(cErr(c)) !== Math.sign(cErr(last))) : null;
    const head = "The final polls have missed the result by " + meanAbsX.toFixed(1) + " points on average" + (imp ? " on the flows of the last election" : "") + (bothWaysX ? ", and not always the same way" : "");
    let dek = "";
    if (last && cSide(last)) dek += "In " + last.year + " all " + nw(hh(last).length) + " pollsters " + (cErr(last) < 0 ? "understated" : "overstated") + " Labor, by " + Math.abs(cErr(last)).toFixed(1) + " points on average";
    if (opp) dek += "; in " + opp.year + " all " + nw(hh(opp).length) + " " + (cErr(opp) < 0 ? "understated" : "overstated") + " it";
    if (dek) dek += ".";
    if (bothWaysX) dek += (dek ? " " : "") + "Because misses run both ways, what carries over to today’s figures is their size, not their direction.";
    const firms = firmsSrc.filter(f => f.n > 1).slice().sort((a, b) => a.meanAbs - b.meanAbs);
    const longest = firmsSrc.slice().sort((a, b) => b.n - a.n);
    const fHead = firms.length >= 3 ? firms[0].firm + " and " + firms[1].firm + " have come closest; " + firms[firms.length - 1].firm + " has missed by most" : "How each pollster has done";
    const fDek = (imp ? "Average miss ignoring direction, closest first – with every final poll re-scored on its primaries through the previous election’s preference flows, not the two-party figure it printed – for pollsters with more than one election to judge on." : "Average miss ignoring direction, closest first, for pollsters with more than one election to judge on.") + " A pollster only counts against the elections it published a final poll for" + (longest[0] && longest[1] && longest[0].n >= 1.5 * longest[1].n ? ", and " + longest[0].firm + "’s " + nw(longest[0].n) + " are the longest record by far." : ".");
    const allH = byRecency.flatMap(c => hh(c).map(h => ({
      c,
      h
    })));
    const hiN = allH.filter(({
      h
    }) => errOf(h) > 0).length;
    const loN = allH.filter(({
      h
    }) => errOf(h) < 0).length;
    const wrongSide = (c, h) => (alpOf(h) - 50) * (c.result - 50) < 0;
    const wrongN = allH.filter(({
      c,
      h
    }) => wrongSide(c, h)).length;
    const levelN = allH.filter(({
      h
    }) => alpOf(h) === 50).length;
    const devMean = byRecency.reduce((t, c) => t + Math.abs(c.result - 50), 0) / byRecency.length;
    const cMiss = c => {
      const es = hh(c).map(errOf);
      return es.reduce((t, e) => t + Math.abs(e), 0) / es.length;
    };
    const multi = byRecency.filter(c => hh(c).length > 1).sort((a, b) => cMiss(a) - cMiss(b));
    const bestCyc = multi[0],
      worstCyc = multi[multi.length - 1];
    const lastFirms = new Set(last ? hh(last).map(h => h.firm) : []);
    const statHouses = firmsSrc.filter(f => f.firm !== "Ipsos" && (f.n > 1 || f.firm === "YouGov") && lastFirms.has(f.firm)).map(f => {
      const hs = allH.filter(({
        h
      }) => h.firm === f.firm);
      const es = hs.map(({
        h
      }) => errOf(h));
      return {
        name: f.firm,
        n: es.length,
        miss: es.reduce((t, e) => t + Math.abs(e), 0) / es.length,
        lean: es.reduce((t, e) => t + e, 0) / es.length,
        wrong: hs.filter(({
          c,
          h
        }) => wrongSide(c, h)).length
      };
    }).sort((a, b) => a.miss - b.miss);
    const leanTxt = v => Math.abs(v) < 0.05 ? "Even" : Math.abs(v).toFixed(1) + (v > 0 ? " Labor" : " Coalition");
    const ticks = [-SPAN, -SPAN / 2, 0, SPAN / 2, SPAN];
    return React.createElement(RdSec, {
      id: "final-polls",
      cls: "rd-acc",
      title: "How the final polls have done",
      meta: imp ? "Each final poll’s primaries put through the previous election’s preference flows, against the result" : "Each pollster’s last two-party figure in the " + A.windowDays + " days before polling day, against the result"
    }, React.createElement(RdHed, {
      head: head,
      dek: dek
    }), React.createElement("div", {
      className: "rd-acc-basis",
      role: "group",
      "aria-label": "How the final polls are scored"
    }, React.createElement("button", {
      type: "button",
      className: "rd-chip",
      "aria-pressed": !imp,
      onClick: () => setBasis("pub"),
      title: "The two-party figure each pollster actually printed \u2013 houses that used respondent flows kept them"
    }, "Published two-party"), React.createElement("button", {
      type: "button",
      className: "rd-chip",
      "aria-pressed": imp,
      onClick: () => setBasis("imp"),
      title: "Every final poll\u2019s primaries put through the one preference-flow table \u2013 the flows counted at the previous election"
    }, "Primaries on last-election flows")), React.createElement("div", {
      className: "rd-acc-sum"
    }, React.createElement("div", {
      className: "rd-acc-firm"
    }, React.createElement("b", null, "Average miss"), React.createElement("span", {
      className: "rd-acc-fv"
    }, meanAbsX.toFixed(1), React.createElement("small", null, " pts")), React.createElement("span", null, hiN, " polls too high on Labor, ", loN, " too low")), React.createElement("div", {
      className: "rd-acc-firm"
    }, React.createElement("b", null, "Wrong side ahead"), React.createElement("span", {
      className: "rd-acc-fv"
    }, wrongN, React.createElement("small", null, " of ", allH.length, " polls")), React.createElement("span", null, "Put the loser of the two-party vote in front")), bestCyc && React.createElement("div", {
      className: "rd-acc-firm"
    }, React.createElement("b", null, "Closest election"), React.createElement("span", {
      className: "rd-acc-fv"
    }, bestCyc.year), React.createElement("span", null, nw(hh(bestCyc).length)[0].toUpperCase() + nw(hh(bestCyc).length).slice(1), " pollsters, ", cMiss(bestCyc).toFixed(1), " pts off on average")), worstCyc && worstCyc !== bestCyc && React.createElement("div", {
      className: "rd-acc-firm"
    }, React.createElement("b", null, "Furthest election"), React.createElement("span", {
      className: "rd-acc-fv"
    }, worstCyc.year), React.createElement("span", null, nw(hh(worstCyc).length)[0].toUpperCase() + nw(hh(worstCyc).length).slice(1), " pollsters, ", cMiss(worstCyc).toFixed(1), " pts off on average"))), statHouses.length > 0 && React.createElement("table", {
      className: "rd-acc-stats"
    }, React.createElement("caption", null, last.year, "\u2019s pollsters over their whole record"), React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", {
      scope: "col"
    }, "Pollster"), React.createElement("th", {
      scope: "col",
      className: "num"
    }, "Elections"), React.createElement("th", {
      scope: "col",
      className: "num"
    }, "Average miss"), React.createElement("th", {
      scope: "col",
      className: "num"
    }, "Average lean"), React.createElement("th", {
      scope: "col",
      className: "num"
    }, "Wrong side ahead"))), React.createElement("tbody", null, statHouses.map(s => React.createElement("tr", {
      key: s.name
    }, React.createElement("th", {
      scope: "row"
    }, s.name), React.createElement("td", null, s.n), React.createElement("td", null, s.miss.toFixed(1), React.createElement("span", {
      className: "rd-acc-u"
    }, " pts")), React.createElement("td", {
      style: Math.abs(s.lean) < 0.5 ? null : {
        color: inkOf(col(s.lean))
      }
    }, leanTxt(s.lean)), React.createElement("td", null, s.wrong, " of ", s.n))))), React.createElement("p", {
      className: "rd-acc-stats-note"
    }, "The average miss counts each election once; a pollster\u2019s figures count its own final polls. Lean is the average miss with its direction kept, coloured from half a point. Wrong side ahead means the two-party vote, not the seats", levelN ? "; the " + nw(levelN) + " poll" + (levelN === 1 ? "" : "s") + " at exactly 50–50 count" + (levelN === 1 ? "s" : "") + " neither way" : "", ". Closest and furthest rank only elections with more than one pollster. Results themselves have sat ", devMean.toFixed(1), " points from 50\u201350 on average."), React.createElement("div", {
      className: "card rd-card rd-acc-card"
    }, React.createElement("div", {
      className: "rd-chead"
    }, React.createElement("span", {
      className: "rd-chead-t"
    }, "Labor\u2019s final ", imp && "implied ", "two-party figure in the polls, minus the result, points"), stackedX > 0 && React.createElement("button", {
      type: "button",
      className: "rd-chip",
      "aria-pressed": spread,
      onClick: () => setSpread(!spread),
      title: "Dots at the same miss are drawn on top of one another. This steps them into their own lanes, keeping each one exactly where it sits on the scale."
    }, React.createElement(window.RdTabW, {
      t: "Separate overlapping dots"
    }))), React.createElement("div", {
      className: "rd-acc-head",
      "aria-hidden": "true"
    }, React.createElement("span", null, "Election"), React.createElement("span", {
      className: "rd-acc-scale"
    }, React.createElement("em", {
      className: "rd-acc-l"
    }, "\u25C0 ", React.createElement("span", {
      className: "rd-acc-long"
    }, "Labor "), "understated"), React.createElement("em", {
      className: "rd-acc-r"
    }, React.createElement("span", {
      className: "rd-acc-long"
    }, "Labor "), "overstated \u25B6"), ticks.map(v => React.createElement("i", {
      key: v,
      className: Math.abs(v) === SPAN ? v < 0 ? "first" : "last" : v !== 0 ? "half" : "",
      style: {
        left: pct(v) + "%"
      }
    }, v === 0 ? "Result" : (v > 0 ? "+" : "−") + Math.abs(v) + (Math.abs(v) === SPAN ? " pts" : "")))), React.createElement("span", {
      className: "rd-acc-mh"
    }, "Miss"), React.createElement("span", null, "Final polls")), React.createElement("div", {
      className: "acc-rows rd-acc-rows" + (spread ? " acc-spread-on" : ""),
      ref: rowsRef
    }, [["Last five elections", recent], ["Earlier elections", earlier]].filter(([, l]) => l.length).map(([label, list], gi) => React.createElement(React.Fragment, {
      key: label
    }, React.createElement("div", {
      className: "rd-acc-group"
    }, label), list.map((c, rj) => {
      const ri = (gi ? recent.length : 0) + rj;
      const cc = hh(c);
      const {
        lane,
        n: nLanes
      } = lanesFor(cc, errOf);
      const maxOff = Math.ceil((nLanes - 1) / 2) * LANE_H;
      const solo = cc.length === 1 ? cc[0] : null;
      const accErr = solo ? errOf(solo) : cErr(c);
      return React.createElement("div", {
        className: "rd-acc-row",
        key: c.year
      }, React.createElement("span", {
        className: "rd-acc-lab"
      }, React.createElement("b", null, c.year), React.createElement("span", null, cMean(c).toFixed(1), " v ", c.result.toFixed(1))), React.createElement("div", {
        className: "acc-track rd-acc-track",
        style: spread && maxOff ? {
          height: 26 + maxOff * 2 + "px"
        } : null
      }, React.createElement("span", {
        className: "acc-zero"
      }), [-SPAN / 2, SPAN / 2].map(v => React.createElement("span", {
        key: v,
        className: "acc-tick",
        style: {
          left: pct(v) + "%"
        }
      })), !solo && cc.map(h => {
        const off = spread ? laneOffset(lane[h.firm] || 0) : 0;
        return React.createElement("span", {
          key: h.firm,
          className: "acc-dot",
          role: "img",
          style: {
            left: pct(errOf(h)) + "%",
            background: col(errOf(h)),
            top: off ? `calc(50% + ${off}px)` : null
          },
          "aria-label": `${h.firm}, ${fmtDay(h.date)}: Labor ${alpOf(h).toFixed(1)} against a result of ${c.result.toFixed(1)}, a miss of ${sgn(errOf(h))}`,
          onMouseEnter: e => open(e, pct(errOf(h)), {
            year: c.year,
            flip: ri === 0,
            off,
            title: h.firm,
            date: fmtDay(h.date),
            rows: [{
              label: imp ? "Implied" : "Poll",
              value: alpOf(h).toFixed(1),
              color: col(errOf(h))
            }, {
              label: "Result",
              value: c.result.toFixed(1)
            }, {
              label: "Miss",
              value: sgn(errOf(h)),
              strong: col(errOf(h))
            }],
            sub: lean(errOf(h))
          }),
          onMouseLeave: close
        });
      }), React.createElement("span", {
        className: "acc-mean",
        role: "img",
        style: {
          left: pct(accErr) + "%",
          background: col(accErr)
        },
        "aria-label": solo ? `${solo.firm}: a miss of ${sgn(errOf(solo))}` : `Average of the ${cc.length} final polls of ${c.year}: a miss of ${sgn(cErr(c))}`,
        onMouseEnter: e => open(e, pct(accErr), {
          year: c.year,
          flip: ri === 0,
          title: solo ? solo.firm : `Average of ${cc.length} final polls`,
          date: solo ? fmtDay(solo.date) : fmtDay(c.eDate),
          rows: [{
            label: solo ? imp ? "Implied" : "Poll" : imp ? "Implied average" : "Poll average",
            value: (solo ? alpOf(solo) : cMean(c)).toFixed(1),
            color: col(accErr)
          }, {
            label: "Result",
            value: c.result.toFixed(1)
          }, {
            label: "Miss",
            value: sgn(accErr),
            strong: col(accErr)
          }],
          sub: lean(accErr)
        }),
        onMouseLeave: close
      }), hov && hov.year === c.year && React.createElement("div", {
        className: "tip acc-tip" + (hov.flip ? " acc-tip-below" : ""),
        style: {
          left: hov.left + "%",
          top: hov.off ? `calc(50% + ${hov.off}px)` : null
        }
      }, React.createElement("div", {
        className: "tip-title"
      }, hov.title), React.createElement("div", {
        className: "tip-date"
      }, hov.date), hov.rows.map((r, i) => React.createElement("div", {
        className: "tip-row",
        key: i
      }, React.createElement("span", {
        className: "tip-swatch",
        style: {
          background: r.color || "transparent"
        }
      }), React.createElement("span", {
        className: "tip-label"
      }, r.label), React.createElement("span", {
        className: "tip-val",
        style: r.strong ? {
          color: r.strong
        } : null
      }, r.value))), React.createElement("div", {
        className: "tip-sub"
      }, hov.sub))), React.createElement("span", {
        className: "rd-acc-err",
        style: {
          color: inkOf(col(cErr(c)))
        }
      }, cErr(c) > 0 ? "+" : cErr(c) < 0 ? "−" : "", Math.abs(cErr(c)).toFixed(1)), React.createElement("span", {
        className: "rd-acc-n"
      }, cc.length, " pollster", cc.length === 1 ? "" : "s", cSide(c) && cc.length > 1 && React.createElement("b", {
        className: "rd-acc-flag"
      }, "All one way")));
    })))), React.createElement("div", {
      className: "rd-key rd-ckey"
    }, React.createElement("span", {
      className: "rd-key-item"
    }, React.createElement(RdSwatch, {
      kind: "dot",
      color: "var(--ink-3)"
    }), "One pollster\u2019s final poll"), React.createElement("span", {
      className: "rd-key-item"
    }, React.createElement(RdSwatch, {
      kind: "dot-solid",
      color: "var(--ink-2)"
    }), "Their average"), React.createElement("span", {
      className: "rd-key-item"
    }, React.createElement(RdSwatch, {
      kind: "dot-solid",
      color: "var(--alp)"
    }), "Overstated Labor"), React.createElement("span", {
      className: "rd-key-item"
    }, React.createElement(RdSwatch, {
      kind: "dot-solid",
      color: "var(--lnp)"
    }), "Understated Labor"), React.createElement("span", {
      className: "rd-key-item"
    }, React.createElement("b", {
      className: "rd-acc-flag"
    }, "All one way"), "Every pollster missed in the same direction"))), React.createElement(RdSub, {
      head: fHead,
      dek: fDek
    }), React.createElement("div", {
      className: "rd-acc-firms"
    }, firms.map(f => React.createElement("div", {
      className: "rd-acc-firm",
      key: f.firm
    }, React.createElement("b", null, f.firm), React.createElement("span", {
      className: "rd-acc-fv"
    }, f.meanAbs.toFixed(1), React.createElement("small", null, " pts")), React.createElement("span", null, f.n, " elections")))), React.createElement(RdFoot, {
      how: {
        term: "how-wrong-are-the-polls",
        from: "How the final polls have done"
      }
    }, "Exit polls are left out, and a pollster that publishes an undecided-inclusive pair is normalised first, so its arithmetic is not scored as a miss. Before 1993 Morgan was the only pollster in the field, and its figure is read through the last election\u2019s flows, so the miss folds in drift in the flows too. Published two-party scores each final poll against the two-party figure it printed; Primaries on last-election flows re-derives a figure from the poll\u2019s primaries and the preference flows of the previous election instead."));
  }
  return React.createElement("section", {
    className: "card acc-card",
    id: "final-polls"
  }, React.createElement("div", {
    className: "card-head"
  }, React.createElement("div", null, React.createElement("h2", {
    className: "card-title"
  }, "How the final polls have done"), React.createElement("p", {
    className: "card-sub"
  }, "Each house\u2019s last two-party figure in the ", A.windowDays, " days before polling day, against the result, One row per election")), React.createElement("div", {
    className: "dir-net"
  }, React.createElement("span", {
    className: "dir-net-label"
  }, "Average miss"), React.createElement("span", {
    className: "dir-net-val"
  }, A.meanAbs.toFixed(1), React.createElement("span", {
    className: "pct"
  }, " pts")))), stacked > 0 && React.createElement("div", {
    className: "acc-tools"
  }, React.createElement("button", {
    className: "acc-spread",
    "aria-pressed": spread,
    onClick: () => setSpread(!spread),
    title: "Dots at the same miss are drawn on top of one another. This steps them into their own lanes, keeping each one exactly where it sits on the scale, so all of them can be seen and tapped."
  }, React.createElement("svg", {
    viewBox: "0 0 24 24",
    width: "13",
    height: "13",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.2",
    strokeLinecap: "round",
    "aria-hidden": "true"
  }, React.createElement("circle", {
    cx: "7",
    cy: "12",
    r: "2.4"
  }), React.createElement("circle", {
    cx: "17",
    cy: "6.5",
    r: "2.4"
  }), React.createElement("circle", {
    cx: "17",
    cy: "17.5",
    r: "2.4"
  }), React.createElement("path", {
    d: "M9.6 10.9 14.6 8M9.6 13.1l5 2.9"
  })), "Separate overlapping dots")), React.createElement("div", {
    className: "acc-scale",
    "aria-hidden": "true"
  }, React.createElement("span", {
    className: "acc-scale-l",
    style: {
      color: "var(--lnp)"
    }
  }, "\u2190 Labor understated"), React.createElement("span", {
    className: "acc-scale-c"
  }, "Result"), React.createElement("span", {
    className: "acc-scale-r",
    style: {
      color: "var(--alp)"
    }
  }, "Labor overstated \u2192")), React.createElement("div", {
    className: "acc-axis",
    "aria-hidden": "true"
  }, [-SPAN / 2, SPAN / 2].map(t => React.createElement("span", {
    key: t,
    style: {
      left: pct(t) + "%"
    }
  }, t > 0 ? "+" : "−", Math.abs(t), " pts"))), React.createElement("div", {
    className: "acc-rows" + (spread ? " acc-spread-on" : ""),
    ref: rowsRef
  }, [["Last five elections", recent], ["More elections", earlier]].filter(([, list]) => list.length).map(([label, list], gi) => React.createElement(React.Fragment, {
    key: label
  }, React.createElement("div", {
    className: "acc-group-h" + (gi ? " acc-group-more" : "")
  }, label), list.map((c, rj) => {
    const ri = (gi ? recent.length : 0) + rj;
    const {
      lane,
      n: nLanes
    } = lanesFor(c.houses);
    const maxOff = Math.ceil((nLanes - 1) / 2) * LANE_H;
    const solo = c.n === 1 ? c.houses[0] : null;
    const accErr = solo ? solo.err : c.err;
    return React.createElement("div", {
      className: "acc-row",
      key: c.year
    }, React.createElement("div", {
      className: "acc-label"
    }, React.createElement("span", {
      className: "acc-year"
    }, c.year), React.createElement("span", {
      className: "acc-detail"
    }, c.mean.toFixed(1), " v ", c.result.toFixed(1))), React.createElement("div", {
      className: "acc-track",
      style: spread && maxOff ? {
        height: 26 + maxOff * 2 + "px"
      } : null
    }, React.createElement("span", {
      className: "acc-zero"
    }), [-SPAN / 2, SPAN / 2].map(t => React.createElement("span", {
      key: t,
      className: "acc-tick",
      style: {
        left: pct(t) + "%"
      }
    })), !solo && c.houses.map(h => {
      const off = spread ? laneOffset(lane[h.firm] || 0) : 0;
      return React.createElement("span", {
        key: h.firm,
        className: "acc-dot",
        role: "img",
        style: {
          left: pct(h.err) + "%",
          background: col(h.err),
          top: off ? `calc(50% + ${off}px)` : null
        },
        "aria-label": `${h.firm}, ${fmtDay(h.date)}: Labor ${h.alp2pp.toFixed(1)} against a result of ${c.result.toFixed(1)}, a miss of ${sgn(h.err)}`,
        onMouseEnter: e => open(e, pct(h.err), {
          year: c.year,
          flip: ri === 0,
          off,
          title: h.firm,
          date: fmtDay(h.date),
          rows: [{
            label: "Poll",
            value: h.alp2pp.toFixed(1),
            color: col(h.err)
          }, {
            label: "Result",
            value: c.result.toFixed(1)
          }, {
            label: "Miss",
            value: sgn(h.err),
            strong: col(h.err)
          }],
          sub: lean(h.err)
        }),
        onMouseLeave: close
      });
    }), React.createElement("span", {
      className: "acc-mean",
      role: "img",
      style: {
        left: pct(accErr) + "%",
        background: col(accErr)
      },
      "aria-label": solo ? `${solo.firm}, ${fmtDay(solo.date)}: Labor ${solo.alp2pp.toFixed(1)} against a result of ${c.result.toFixed(1)}, a miss of ${sgn(solo.err)}` : `Average of the ${c.n} final polls of ${c.year}: ${c.mean.toFixed(1)} against a result of ${c.result.toFixed(1)}, a miss of ${sgn(c.err)}`,
      onMouseEnter: e => open(e, pct(accErr), {
        year: c.year,
        flip: ri === 0,
        title: solo ? solo.firm : `Average of ${c.n} final polls`,
        date: solo ? fmtDay(solo.date) : fmtDay(c.eDate),
        rows: [{
          label: solo ? "Poll" : "Poll average",
          value: (solo ? solo.alp2pp : c.mean).toFixed(1),
          color: col(accErr)
        }, {
          label: "Result",
          value: c.result.toFixed(1)
        }, {
          label: "Miss",
          value: sgn(accErr),
          strong: col(accErr)
        }],
        sub: lean(accErr)
      }),
      onMouseLeave: close
    }), hov && hov.year === c.year && React.createElement("div", {
      className: "tip acc-tip" + (hov.flip ? " acc-tip-below" : ""),
      style: {
        left: hov.left + "%",
        top: hov.off ? `calc(50% + ${hov.off}px)` : null
      }
    }, React.createElement("div", {
      className: "tip-title"
    }, hov.title), React.createElement("div", {
      className: "tip-date"
    }, hov.date), hov.rows.map((r, i) => React.createElement("div", {
      className: "tip-row",
      key: i
    }, React.createElement("span", {
      className: "tip-swatch",
      style: {
        background: r.color || "transparent"
      }
    }), React.createElement("span", {
      className: "tip-label"
    }, r.label), React.createElement("span", {
      className: "tip-val",
      style: r.strong ? {
        color: r.strong
      } : null
    }, r.value))), React.createElement("div", {
      className: "tip-sub"
    }, hov.sub))), React.createElement("div", {
      className: "acc-err",
      style: {
        color: col(c.err)
      }
    }, c.err > 0 ? "+" : "", c.err), React.createElement("div", {
      className: "acc-note"
    }, c.n, " house", c.n === 1 ? "" : "s", c.sameSide && React.createElement("span", {
      className: "acc-flag",
      title: "Every house missed the same way \u2013 the signature of an industry-wide problem rather than one firm's noise"
    }, "All one way")));
  })))), React.createElement("p", {
    className: "table-hint"
  }, "Big dots are each election\u2019s average final poll; small dots are the individual houses \u2013 ", CANT_HOVER ? "tap" : "hover", " one for its figure.", bothWays && React.createElement(React.Fragment, null, " Of the ", numWord(oneSided.length), " elections where every house missed the same way (", listJoin(oneSided.map(c => c.year)), "), ", numWord(oneSided.filter(c => c.err > 0).length), " overstated Labor and ", numWord(oneSided.filter(c => c.err < 0).length), " understated it. They missed in ", React.createElement("strong", null, "opposite directions"), ", so this is not a standing lean that today\u2019s figures could be corrected for. It is the size of the error, not its direction, that carries.")), React.createElement(HowTo, {
    paras: [React.createElement(React.Fragment, null, "Where only one house was in the field, its own figure stands alone."), stacked > 0 && React.createElement(React.Fragment, null, stacked, " dots missed by exactly the same amount as another house, so they are drawn on top of each other \u2013 ", React.createElement("strong", null, "Separate overlapping dots"), " steps those into their own lanes without moving any of them along the scale."), React.createElement(React.Fragment, null, "Exit polls are excluded, and a house that publishes an undecided-inclusive pair is normalised first, so its arithmetic isn\u2019t scored as a miss.")]
  }), React.createElement("div", {
    className: "acc-firms"
  }, React.createElement("div", {
    className: "acc-firms-h"
  }, "By house, where there is more than one election to judge on"), React.createElement("div", {
    className: "acc-firms-grid"
  }, A.firms.filter(f => f.n > 1).map(f => React.createElement("div", {
    className: "acc-firm",
    key: f.firm
  }, React.createElement("span", {
    className: "acc-firm-n"
  }, f.firm), React.createElement("span", {
    className: "acc-firm-v",
    title: "Average size of the miss, ignoring direction"
  }, f.meanAbs.toFixed(1), React.createElement("span", {
    className: "pct"
  }, " pts")), React.createElement("span", {
    className: "acc-firm-c"
  }, f.n, " elections")))), React.createElement("p", {
    className: "table-hint"
  }, "Average miss ignoring direction. Houses are not merged across renames of different operations, so a firm only appears against the elections it actually published a final poll for.")));
}
const CANT_HOVER = typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(hover: none)").matches : false;
function PastCyclesView() {
  const {
    D
  } = window.AP;
  const cycles = D.cycles;
  const [mode, setMode] = useState("abs");
  const [, redrawWithSource] = useState(0);
  const [srcFailed, setSrcFailed] = useState(false);
  React.useEffect(() => {
    let live = true;
    D.loadCycleSource().then(j => {
      if (!live) return;
      setSrcFailed(!Object.keys(j || {}).length);
      redrawWithSource(n => n + 1);
    });
    return () => {
      live = false;
    };
  }, []);
  const cycBits = set => {
    let m = 0;
    cycles.forEach((c, i) => {
      if (set.has(c.year)) m += 2 ** i;
    });
    return m;
  };
  const cycUnpack = raw => {
    const m = /^b(?:([0-9a-z]{1,6}))?(?:-([0-9a-z]{1,6}))?$/.exec(raw || "");
    if (!m) return null;
    const bits = cycles.map(() => 0).map((_, i) => 2 ** i);
    const toSet = tok => {
      if (!tok) return new Set();
      const v = parseInt(tok, 36);
      const s = new Set();
      cycles.forEach((c, i) => {
        if (v % 2 ** (i + 1) >= bits[i]) s.add(c.year);
      });
      return s;
    };
    return {
      hidden: toSet(m[1]),
      lifted: toSet(m[2])
    };
  };
  const cycPack = (hidden, lifted) => {
    const h = cycBits(hidden),
      l = cycBits(lifted);
    if (!h && !l) return null;
    return "b" + (h ? h.toString(36) : "") + (l ? "-" + l.toString(36) : "");
  };
  const cycYears = raw => {
    const years = new Set(cycles.map(c => c.year));
    if (!raw) return new Set();
    return new Set(raw.split(/[.,]/).map(t => {
      if (/^\d{4}$/.test(t)) return +t;
      if (/^\d{2}$/.test(t)) return 2000 + +t;
      return null;
    }).filter(y => y != null && years.has(y)));
  };
  const currentYear = (cycles.find(c => c.current) || {}).year;
  const urlCyc = (() => {
    const p = new URLSearchParams(window.location.search);
    const packed = cycUnpack(p.get("c"));
    if (packed) return packed;
    return {
      hidden: cycYears(p.get("c")),
      lifted: cycYears(p.get("l"))
    };
  })();
  const [hidden, setHidden] = useState(() => urlCyc.hidden);
  const [lifted, setLifted] = useState(() => {
    const s = urlCyc.lifted;
    s.delete(currentYear);
    return s;
  });
  const [hi, setHi] = useState(null);
  React.useEffect(() => {
    if (hi == null) return;
    const onDown = e => {
      const t = e.target;
      if (t && t.closest && t.closest(".cyc-legend")) return;
      setHi(null);
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [hi]);
  const [showHan, setShowHan] = useState(false);
  const [showOnp, setShowOnp] = useState(false);
  const [showComb, setShowComb] = useState(false);
  React.useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    p.delete("c");
    const l = p.get("l");
    if (l != null && /^[0-9.,]+$/.test(l)) p.delete("l");
    const packed = cycPack(hidden, lifted);
    if (packed) p.set("c", packed);
    const qs = p.toString();
    const L = window.location;
    const next = L.pathname + (qs ? "?" + qs : "") + L.hash;
    if (next !== L.pathname + L.search + L.hash) writeUrl("replaceState", next);
  }, [hidden, lifted]);
  React.useEffect(() => {
    window.AP_CYC_BOARD = {
      off: [...hidden]
    };
    return () => {
      window.AP_CYC_BOARD = null;
    };
  }, [hidden]);
  const toggle = year => {
    setHidden(h => {
      const n = new Set(h);
      n.has(year) ? n.delete(year) : n.add(year);
      return n;
    });
    setLifted(l => {
      if (!l.has(year)) return l;
      const n = new Set(l);
      n.delete(year);
      return n;
    });
  };
  const lift = year => {
    if (year === currentYear) return;
    setLifted(l => {
      const n = new Set(l);
      n.has(year) ? n.delete(year) : n.add(year);
      return n;
    });
  };
  const unlift = year => setLifted(l => {
    if (!l.has(year)) return l;
    const n = new Set(l);
    n.delete(year);
    return n;
  });
  const chipClick = year => hidden.has(year) ? toggle(year) : lift(year);
  const shownCycles = cycles.filter(c => !hidden.has(c.year));
  const shapes = shownCycles.length <= CYC_DOT_MAX ? cycShapes(shownCycles) : null;
  const showAll = () => setHidden(new Set());
  const hideAll = () => {
    setHidden(new Set(cycles.map(c => c.year)));
    setLifted(new Set());
  };
  const outcomeOf = i => {
    const next = cycles[i + 1];
    if (!next) return null;
    return next.gov === cycles[i].gov ? "returned" : "ousted";
  };
  const yearsWith = which => new Set(cycles.filter((c, i) => outcomeOf(i) === which).map(c => c.year));
  const showOutcome = which => {
    const keep = yearsWith(which);
    setHidden(new Set(cycles.filter(c => !keep.has(c.year)).map(c => c.year)));
    setLifted(new Set());
  };
  const sameYears = (a, b) => a.size === b.size && [...a].every(y => b.has(y));
  const onBoard = new Set(cycles.filter(c => !hidden.has(c.year) && !c.current).map(c => c.year));
  const outcomeShown = sameYears(onBoard, yearsWith("returned")) ? "returned" : sameYears(onBoard, yearsWith("ousted")) ? "ousted" : null;
  const exportSource = () => D.loadCycleSource().then(() => downloadCsv(`auspol-tracker-cycles-source-polls-${D.latest.updatedISO}.csv`, cycleSourceRows(shownCycles, D)));
  const jumpToAcc = () => {
    const el = document.getElementById("final-polls");
    if (el) el.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  };
  const retrySource = () => D.loadCycleSource().then(j => setSrcFailed(!Object.keys(j || {}).length));
  if (window.AP.rd) return React.createElement(RdPastCycles, {
    cycles: cycles,
    mode: mode,
    setMode: setMode,
    hidden: hidden,
    lifted: lifted,
    hi: hi,
    setHi: setHi,
    toggle: toggle,
    lift: lift,
    unlift: unlift,
    chipClick: chipClick,
    showAll: showAll,
    hideAll: hideAll,
    showOutcome: showOutcome,
    outcomeShown: outcomeShown,
    shapes: shapes,
    showHan: showHan,
    setShowHan: setShowHan,
    showOnp: showOnp,
    setShowOnp: setShowOnp,
    showComb: showComb,
    setShowComb: setShowComb,
    exportSource: exportSource,
    srcFailed: srcFailed,
    retrySource: retrySource
  });
  return React.createElement("div", {
    className: "view view-cycles"
  }, React.createElement("div", {
    className: "view-intro"
  }, React.createElement("p", {
    className: "view-lede"
  }, "Every federal term since 1972, lined up on its election day so each government\u2019s run can be read off the same clock."), React.createElement("details", {
    className: "view-how"
  }, React.createElement("summary", null, "How to read these charts"), React.createElement("p", {
    className: "view-lede"
  }, "The past terms stand together as a band \u2013 outer edge the middle 80% of them, darker half the middle 50%, dotted line their mean \u2013 drawn over the months each term was actually in office, and going fainter where fewer of them were.", " ", "Open ", React.createElement("strong", null, "Cycles"), " below to draw any term\u2019s own line over the band, to take terms off the board, or to cut the board to the governments that were returned or ousted at their next election. Leave three or fewer terms on the board to see the individual polls under each line.")), srcFailed && React.createElement("p", {
    className: "cyc-src-note"
  }, "The individual polls behind the past terms didn\u2019t load \u2013 the monthly lines are unaffected.", " ", React.createElement("button", {
    type: "button",
    onClick: retrySource
  }, "Try again")), React.createElement("div", {
    className: "cyc-jumps"
  }, React.createElement("button", {
    className: "ap-jump",
    onClick: jumpToAcc,
    title: "Scroll down to the how-the-final-polls-did panel"
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
    d: "M12 4v13M12 17l-5-5M12 17l5-5"
  })), "Jump to how the final polls have done")), React.createElement("div", {
    className: "cyc-controls"
  }, React.createElement(TextToggle, {
    value: mode,
    onChange: setMode,
    ariaLabel: "Measure",
    options: [{
      id: "abs",
      label: "Absolute level"
    }, {
      id: "chg",
      label: "Change since election"
    }]
  }), React.createElement("div", {
    className: "cyc-export"
  }, React.createElement("span", {
    className: "cyc-export-label"
  }, "Download"), React.createElement("button", {
    className: "ap-export",
    onClick: exportSource,
    title: hidden.size ? "The individual polls the monthly averages are built from – hidden terms left out, to match the board" : "The individual polls the monthly averages are built from"
  }, React.createElement(DownloadIcon, null), "Source polls")))), React.createElement("div", {
    className: "cyc-charts"
  }, CYC_METRICS.map(m => React.createElement(CycleChart, {
    key: m.key,
    metric: m,
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
    outcomeShown: outcomeShown
  }))), React.createElement(AccuracyPanel, null), React.createElement("details", {
    className: "view-how hint-how"
  }, React.createElement("summary", null, "How these charts are built"), React.createElement("p", {
    className: "cyc-foot"
  }, "The individual polls behind the plotted series are downloadable above", hidden.size > 0 && ", the file leaving the hidden terms out just as the charts do", ".", " ", "Past cycles run the full ~3-year term to the next election. The current term stops at the latest poll, and its last point is the figure the site quotes now, as in the headline, rather than the month so far. Every term\u2019s months are averaged as the current term\u2019s are: a pollster with several polls in a month counts for the square root of their number, and from 1987, when Newspoll joined Morgan, each poll is first corrected for its pollster\u2019s lean within that term. Where the band runs faint, fewer than three-quarters of the terms on the board were in office that month \u2013 the oldest terms open before any house asked about approval, and only the longest parliaments reach three years \u2013 and the readout on its mean names the headcount, and how many of them were polled rather than interpolated, month by month.", " ", showHan && React.createElement("span", null, "Hanson is drawn on the opposition chart from ", "“", "approve minus disapprove", "”", " readings only, which is why her line is short: most houses rate her on favourability, a different question that is never blended into these lines, and no past cycle asked about her at all.", " "), showOnp && React.createElement("span", null, "The One Nation line tracks the party\u2019s first-preference vote over the current term only; past cycles are left undrawn.", " "), showComb && React.createElement("span", null, "The combined line sums the Coalition\u2019s and One Nation\u2019s first-preference votes over the current term only, counting only months where both parties were polled; past cycles are left undrawn.", " "), mode === "chg" ? "Lines show movement relative to each party’s own election result." : "Approval lines splice the sitting prime minister – and opposition leader – where a term changed leaders mid-stream.")));
}
const ArchSortTh = window.SortTh;
function ArchDirCell({
  d
}) {
  const {
    NetVal
  } = window;
  if (!d) return React.createElement("span", {
    className: "dash",
    title: "This poll didn\u2019t ask the direction question"
  }, "\u2014");
  return React.createElement("div", {
    className: "arch-appr",
    title: `Right direction ${d.right}, Unsure ${d.unsure}, Wrong track ${d.wrong}`
  }, React.createElement("span", null, React.createElement(NetVal, {
    v: d.net
  })), React.createElement("div", {
    className: "arch-appr-bar",
    "aria-hidden": "true"
  }, React.createElement("span", {
    className: "arch-dir-right",
    style: {
      width: d.right + "%"
    }
  }), React.createElement("span", {
    className: "arch-appr-dk",
    style: {
      width: d.unsure + "%"
    }
  }), React.createElement("span", {
    className: "arch-dir-wrong",
    style: {
      width: d.wrong + "%"
    }
  })));
}
function issTopOf(iss) {
  if (!iss) return null;
  if (iss.sal && iss.sal.length) return [iss.sal[0][0], iss.sal[0][1], iss.sal[0][2] ?? null];
  if (iss.conc && iss.conc.length) return [iss.conc[0][0], iss.conc[0][1], null];
  return null;
}
const ISS_PARTY_META = {
  alp: ["Labor", "ALP", "var(--alp-text)"],
  lnp: ["the Coalition", "L/NP", "var(--lnp-text)"],
  onp: ["One Nation", "ON", "var(--onp-text)"],
  grn: ["the Greens", "GRN", "var(--grn-text)"],
  rest: ["the rest", "rest", null],
  oth: ["the rest", "rest", null]
};
function issBestOf(iss) {
  if (!iss) return null;
  const argmax = (sh, keys) => {
    let best = null;
    for (const k of keys) if (sh && sh[k] != null && (!best || sh[k] > best.v)) best = {
      k,
      v: sh[k]
    };
    return best;
  };
  if (iss.plus && iss.plus.lead && iss.own && iss.own[iss.top] && iss.own[iss.top][iss.plus.lead] != null) return {
    who: iss.plus.lead,
    v: iss.own[iss.top][iss.plus.lead],
    src: "plus",
    lean: iss.plus.lean ?? null
  };
  const own = iss.own && iss.own[iss.top] ? argmax(iss.own[iss.top], ["alp", "lnp", "onp", "grn"]) : null;
  if (own) return {
    who: own.k,
    v: own.v,
    src: "own"
  };
  const g4 = iss.bp ? argmax(iss.bp, ["alp", "lnp", "onp", "grn", "rest"]) : null;
  if (g4) return {
    who: g4.k,
    v: g4.v,
    src: "g4"
  };
  return null;
}
const DEM_SPLITS = [{
  id: "age",
  label: "Age",
  lo: "Older",
  hi: "Younger",
  scope: "With an age breakdown",
  pairs: [["18–34", "55+", "18–34 v 55+"], ["Gen Z", "Boomers", "Gen Z v boomers"], ["18–34", "65+", "18–34 v 65+"], ["18–34", "50+", "18–34 v 50+"]]
}, {
  id: "gender",
  label: "Gender",
  lo: "Men",
  hi: "Women",
  scope: "With a gender breakdown",
  pairs: [["Women", "Men", "Women v men"]]
}, {
  id: "education",
  label: "Education",
  lo: "No tertiary",
  hi: "University",
  scope: "With an education breakdown",
  pairs: [["University", "School", "Uni v school"], ["University", "Year 12 or less", "Uni v Year 12"], ["University", "No tertiary", "Uni v no tertiary"], ["University", "High School", "Uni v high school"]]
}, {
  id: "place",
  label: "Place",
  lo: "Rural",
  hi: "Inner metro",
  scope: "With a city and country breakdown",
  pairs: [["Inner metro", "Rural", "Inner metro v rural"], ["Inner metro", "Regional or rural", "Inner metro v regional"], ["Capital cities", "Regional/rural areas", "Capital v regional/rural"]]
}, {
  id: "home",
  label: "Home",
  lo: "Owners",
  hi: "Renters",
  scope: "With a housing breakdown",
  pairs: [["Renting", "Own outright", "Renters v owners"], ["Renting and other", "Own outright", "Renters v owners"]]
}, {
  id: "income",
  label: "Income",
  lo: "Lower income",
  hi: "Higher income",
  scope: "With an income breakdown",
  pairs: [["$150k+", "Under $50k", "$150k+ v <$50k"], ["$125k+", "Under $45k", "$125k+ v <$45k"], ["$100k or more", "Under $100k", "$100k+ v <$100k"], ["$3,000+ a week", "Under $1,000 a week", "$3k+ v <$1k a week"]]
}, {
  id: "country",
  label: "Offcuts",
  lo: "Australia-born",
  hi: "Overseas-born",
  scope: "With a one-off breakdown",
  pairs: [["Vietnam", "Australia", "Vietnam-born v Australia-born", "Australia-born", "Overseas-born"], ["Mainland China", "Australia", "China-born v Australia-born", "Australia-born", "Overseas-born"], ["South Africa", "Australia", "South Africa-born v Australia-born", "Australia-born", "Overseas-born"], ["United Kingdom", "Australia", "UK-born v Australia-born", "Australia-born", "Overseas-born"], ["Christian", "No religion", "Christian v no religion", "No religion", "Christian"], ["Protestant", "No religion", "Protestant v no religion", "No religion", "Protestant"], ["Full time", "Retired", "Full time v retired", "Retired", "Full time"], ["Children under 18", "No children", "Children at home v none", "No children", "Children at home"], ["Working class", "Well off", "Working class v well off", "Well off", "Working class"], ["Braddon", "Clark", "Braddon v Clark", "Clark", "Braddon"], ["Professional and managerial", "Blue collar", "Managerial v blue collar", "Blue collar", "Professional and managerial"], ["No stress at all", "A great deal of stress", "No stress v a great deal of stress", "A great deal of stress", "No stress at all"]],
  fams: [{
    id: "birth",
    lab: "Birth country",
    sub: "Seven months of Roy Morgan interviews pooled, Jan–Jul 2026",
    pairs: [["Vietnam", "Australia", "Vietnam-born v Australia-born", "Australia-born", "Overseas-born"], ["Mainland China", "Australia", "China-born v Australia-born", "Australia-born", "Overseas-born"], ["South Africa", "Australia", "South Africa-born v Australia-born", "Australia-born", "Overseas-born"], ["United Kingdom", "Australia", "UK-born v Australia-born", "Australia-born", "Overseas-born"]]
  }, {
    id: "religion",
    lab: "Religion",
    sub: "Newspoll’s pooled quarterly polls and RedBridge/Accent’s one-off cut",
    pairs: [["Christian", "No religion", "Christian v no religion", "No religion", "Christian"], ["Protestant", "No religion", "Protestant v no religion", "No religion", "Protestant"]]
  }, {
    id: "working",
    lab: "Working status",
    sub: "Newspoll’s pooled quarterly polls and YouGov’s own weekly cut",
    pairs: [["Full time", "Retired", "Full time v retired", "Retired", "Full time"]]
  }, {
    id: "children",
    lab: "Children at home",
    sub: "YouGov’s weekly cut, 24 Mar 2026 on",
    pairs: [["Children under 18", "No children", "Children at home v none", "No children", "Children at home"]]
  }, {
    id: "class",
    lab: "Self-assessed class",
    sub: "YouGov’s weekly cut, 10 Feb 2026 on",
    pairs: [["Working class", "Well off", "Working class v well off", "Well off", "Working class"]]
  }, {
    id: "electorate",
    lab: "Tasmanian electorates",
    sub: "EMRS’s one-off seat cut from the February 2026 federal wave",
    pairs: [["Braddon", "Clark", "Braddon v Clark", "Clark", "Braddon"]]
  }, {
    id: "occupation",
    lab: "Occupation",
    sub: "RedBridge/Accent’s one-off cut from the October 2025 report",
    pairs: [["Professional and managerial", "Blue collar", "Managerial v blue collar", "Blue collar", "Professional and managerial"]]
  }, {
    id: "stress",
    lab: "Financial stress",
    sub: "RedBridge/Accent’s one-off cut from the October 2025 report",
    pairs: [["No stress at all", "A great deal of stress", "No stress v a great deal of stress", "A great deal of stress", "No stress at all"]]
  }]
}];
const DEM_KEYS = ["alp", "lnp", "grn", "onp", "oth"];
function demGroupsOf(p) {
  const g = p && p.grp;
  if (!g) return null;
  const m = {};
  for (const rows of Object.values(g.d || {})) for (const [lab, v] of rows) m[lab] = Object.fromEntries(DEM_KEYS.map((k, i) => [k, v[i]]));
  const G = window.AUSPOL.demoGroups || [];
  (g.v || []).forEach((v, i) => {
    if (v && !m[G[i]]) m[G[i]] = Object.fromEntries(DEM_KEYS.map((k, j) => [k, v[j]]));
  });
  return m;
}
function demPairOf(p, split, famId) {
  const sp = DEM_SPLITS.find(s => s.id === split);
  const m = sp ? demGroupsOf(p) : null;
  if (!m) return null;
  const pairs = famId ? ((sp.fams || []).find(f => f.id === famId) || {
    pairs: []
  }).pairs : sp.pairs;
  for (const [a, b, lab, loCap, hiCap] of pairs) if (m[a] && m[b]) {
    const gap = Object.fromEntries(DEM_KEYS.map(k => [k, m[a][k] != null && m[b][k] != null ? +(m[a][k] - m[b][k]).toFixed(1) : null]));
    return {
      a,
      b,
      lab,
      loCap,
      hiCap,
      A: m[a],
      B: m[b],
      gap
    };
  }
  return null;
}
const ISS_MAP = ["col", "housing", "health", "immigration", "crime", "economy"];
const ISS_MAP_LAB = {
  col: "Cost of living",
  housing: "Housing",
  health: "Health",
  immigration: "Immigration",
  crime: "Crime",
  economy: "Economy"
};
const ISS_ALIAS = {
  "Cost of living": "col",
  "Housing": "housing",
  "Housing affordability": "housing",
  "Health": "health",
  "Healthcare": "health",
  "Hospitals": "health",
  "Immigration": "immigration",
  "Immigration & population": "immigration",
  "Crime": "crime",
  "Economic management": "economy",
  "The economy": "economy",
  "Climate change": "climate",
  "National security": "security"
};
function issOwnOf(p, id) {
  const iss = p && p.iss;
  if (!iss) return null;
  if (iss.own && iss.own[id]) return iss.own[id];
  if (id === "col" && iss.bp) return {
    alp: iss.bp.alp,
    lnp: iss.bp.lnp,
    onp: iss.bp.onp,
    grn: iss.bp.grn,
    oth: iss.bp.rest
  };
  return null;
}
function issLeadOf(own) {
  if (!own) return null;
  const ps = ["alp", "lnp", "onp", "grn"].filter(k => own[k] != null).map(k => [k, +own[k]]).sort((a, b) => b[1] - a[1]);
  if (!ps.length) return null;
  const lead = ps.length > 1 ? ps[0][1] - ps[1][1] : null;
  return {
    who: ps[0][0],
    v: ps[0][1],
    lead,
    level: lead != null && lead < 0.5
  };
}
function ArchIssTop({
  iss
}) {
  const t = issTopOf(iss);
  if (!t) return React.createElement("span", {
    className: "dash",
    title: "No issues questions this wave"
  }, "\u2014");
  const unprompted = !(iss && iss.sal);
  return React.createElement("span", {
    className: "arch-iss-top",
    title: unprompted ? "SEC Newgate's unprompted most-mentioned concern – shares of any mentions, not a forced top three" : null
  }, t[0], " ", React.createElement("b", null, t[1]));
}
function ArchIssBest({
  iss
}) {
  const b = issBestOf(iss);
  if (!b) return React.createElement("span", {
    className: "dash",
    title: "No best-party question this wave"
  }, "\u2014");
  const meta = ISS_PARTY_META[b.who] || [b.who, b.who, null];
  const title = b.src === "plus" ? "Best party on " + (iss && iss.top || "the issue") + ", house-lean-adjusted (this house's own share quoted)" : b.src === "g4" ? "SEC Newgate's printed best-party-on-the-cost-of-living figures" : "This wave's own printed best-party figures";
  return React.createElement("span", {
    className: "arch-iss-best",
    title: title
  }, React.createElement("b", {
    style: meta[2] ? {
      color: meta[2]
    } : undefined
  }, meta[1]), " ", b.v);
}
function ArchApprCell({
  s,
  net,
  metric
}) {
  const {
    NetVal,
    FavMark
  } = window;
  if (net == null) return React.createElement("span", {
    className: "dash",
    title: "Not asked by this pollster"
  }, "\u2014");
  const dk = s ? Math.max(0, 100 - s.app - s.dis) : 0;
  const fav = metric === "fav";
  return React.createElement("div", {
    className: "arch-appr",
    title: s ? fav ? `Positive ${s.app}, Neutral ${dk}, Negative ${s.dis}` : `Approve ${s.app}, Don't know / never heard of ${dk}, Disapprove ${s.dis}` : undefined
  }, React.createElement("span", null, React.createElement(NetVal, {
    v: net
  }), React.createElement(FavMark, {
    metric: metric
  })), s && React.createElement("div", {
    className: "arch-appr-bar",
    "aria-hidden": "true"
  }, React.createElement("span", {
    className: "arch-appr-app",
    style: {
      width: s.app + "%"
    }
  }), React.createElement("span", {
    className: "arch-appr-dk",
    style: {
      width: dk + "%"
    }
  }), React.createElement("span", {
    className: "arch-appr-dis",
    style: {
      width: s.dis + "%"
    }
  })));
}
function ArchImplied({
  p,
  measure
}) {
  const on = measure === "onp";
  const alp = on ? p.alpOnImp : p.alpImp;
  if (alp == null) {
    return React.createElement("span", {
      className: "dash",
      title: "No implied 2PP \u2013 this poll never filed a full primary set the flow table can read"
    }, "\u2014");
  }
  const b = +(100 - alp).toFixed(1);
  const bLab = on ? "ON" : "L/NP",
    bColor = on ? "var(--onp)" : "var(--lnp)";
  return React.createElement("div", {
    className: "apub",
    "aria-label": on ? `Implied ALP v One Nation at the site's ALP–ON flow set: ALP ${alp.toFixed(1)}, ON ${b.toFixed(1)}` : `Implied 2PP at 2025-election preference flows: ALP ${alp.toFixed(1)}, L/NP ${b.toFixed(1)}`,
    title: on ? "This poll's primaries at the site's ALP–ON flow set – one fixed table for every house" : "This poll's primaries at the 2025 election's preference flows – one fixed table for every house"
  }, React.createElement("span", {
    className: "apub-seg",
    title: "ALP, implied"
  }, React.createElement("span", {
    className: "apub-dot",
    style: {
      background: "var(--alp)"
    }
  }), alp.toFixed(1)), React.createElement("span", {
    className: "apub-seg",
    title: bLab + ", implied"
  }, React.createElement("span", {
    className: "apub-dot",
    style: {
      background: bColor
    }
  }), b.toFixed(1)));
}
function ArchPublished({
  p,
  measure
}) {
  const {
    tppContests,
    tppFlag,
    primarySegs
  } = window;
  const cs = tppContests(p);
  const c0 = measure === "onp" && cs.find(c => c.kind === "alt") || cs[0];
  if (!c0) {
    const pSegs = p.p ? primarySegs(p) : [];
    if (!pSegs.length) return React.createElement("span", {
      className: "dash",
      title: "No voting-intention figures published with this poll"
    }, "\u2014");
    return React.createElement("div", {
      className: "apub",
      "aria-label": "Primary votes: " + pSegs.map(s => `${s.label} ${s.value}`).join(", "),
      title: "No two-party or head-to-head figure in this poll \u2013 these are the primary votes"
    }, pSegs.map((s, i) => React.createElement("span", {
      key: i,
      className: "apub-seg",
      title: s.label
    }, React.createElement("span", {
      className: "apub-dot",
      style: {
        background: s.color
      }
    }), s.value.toFixed(1))), React.createElement("span", {
      className: "facet-flag"
    }, "Primary"));
  }
  const flag = tppFlag(p);
  return React.createElement("div", {
    className: "apub",
    "aria-label": c0.segs.map(s => `${s.label} ${s.value}`).join(", ")
  }, c0.segs.map((s, i) => React.createElement("span", {
    key: i,
    className: "apub-seg",
    title: s.label
  }, React.createElement("span", {
    className: "apub-dot",
    style: {
      background: s.color
    }
  }), s.value.toFixed(1))), flag && React.createElement("span", {
    className: "facet-flag"
  }, flag));
}
function ArchTpp({
  p,
  basis,
  measure
}) {
  return basis === "resp" ? React.createElement(ArchPublished, {
    p: p,
    measure: measure
  }) : React.createElement(ArchImplied, {
    p: p,
    measure: measure
  });
}
function archLeadInfo(p, measure, basis) {
  const pub = basis === "resp";
  if (measure === "onp") {
    if (pub) {
      if (!p.tppAlt) return null;
      const m = +(p.tppAlt.alp - p.tppAlt.onp).toFixed(1);
      return {
        m,
        who: m >= 0 ? "alp" : "onp",
        lab: m >= 0 ? "ALP" : "ON",
        color: m >= 0 ? "var(--alp)" : "var(--onp)",
        segs: [{
          v: p.tppAlt.alp,
          color: "var(--alp)"
        }, {
          v: p.tppAlt.onp,
          color: "var(--onp)"
        }],
        note: " on the published ALP v One Nation matchup"
      };
    }
    if (p.alpOnImp == null) return null;
    const on = +(100 - p.alpOnImp).toFixed(1);
    const m = +(p.alpOnImp - on).toFixed(1);
    return {
      m,
      who: m >= 0 ? "alp" : "onp",
      lab: m >= 0 ? "ALP" : "ON",
      color: m >= 0 ? "var(--alp)" : "var(--onp)",
      segs: [{
        v: p.alpOnImp,
        color: "var(--alp)"
      }, {
        v: on,
        color: "var(--onp)"
      }],
      note: " on the implied ALP v One Nation basis (primaries at the site’s ALP–ON flow set)"
    };
  }
  if (measure === "lnponp") {
    if (!p.tppAlt2) return null;
    const m = +(p.tppAlt2.lnp - p.tppAlt2.onp).toFixed(1);
    return {
      m,
      who: m >= 0 ? "lnp" : "onp",
      lab: m >= 0 ? "L/NP" : "ON",
      color: m >= 0 ? "var(--lnp)" : "var(--onp)",
      segs: [{
        v: p.tppAlt2.lnp,
        color: "var(--lnp)"
      }, {
        v: p.tppAlt2.onp,
        color: "var(--onp)"
      }],
      note: " on the published L/NP v One Nation matchup"
    };
  }
  if (measure === "3cp") {
    if (!p.tpp3) return null;
    const e = [["alp", "ALP", p.tpp3.alp, "var(--alp)"], ["lnp", "L/NP", p.tpp3.lnp, "var(--lnp)"], ["onp", "ON", p.tpp3.onp, "var(--onp)"]].sort((a, b) => b[2] - a[2]);
    const margin = +(e[0][2] - e[1][2]).toFixed(1);
    return {
      m: e[0][0] === "alp" ? margin : -margin,
      who: e[0][0],
      lab: e[0][1],
      color: e[0][3],
      segs: [{
        v: p.tpp3.alp,
        color: "var(--alp)"
      }, {
        v: p.tpp3.lnp,
        color: "var(--lnp)"
      }, {
        v: p.tpp3.onp,
        color: "var(--onp)"
      }],
      note: ` over ${e[1][1]} on the published 3-cornered figures`
    };
  }
  if (pub) {
    if (p.alp == null && p.alp2pp == null) return null;
    const alp = p.alp2pp != null ? p.alp2pp : p.alp;
    const lnp = p.lnp2pp != null ? p.lnp2pp : p.lnp;
    const lnpV = lnp != null ? lnp : 100 - alp;
    const m = +(alp - lnpV).toFixed(1);
    return {
      m,
      who: m >= 0 ? "alp" : "lnp",
      lab: m >= 0 ? "ALP" : "L/NP",
      color: m >= 0 ? "var(--alp)" : "var(--lnp)",
      segs: [{
        v: alp,
        color: "var(--alp)"
      }, {
        v: lnpV,
        color: "var(--lnp)"
      }],
      note: " on the two-party ALP v L/NP measure"
    };
  }
  if (p.alpImp == null) return null;
  const alp = p.alpImp,
    lnpV = +(100 - p.alpImp).toFixed(1);
  const m = +(alp - lnpV).toFixed(1);
  return {
    m,
    who: m >= 0 ? "alp" : "lnp",
    lab: m >= 0 ? "ALP" : "L/NP",
    color: m >= 0 ? "var(--alp)" : "var(--lnp)",
    segs: [{
      v: alp,
      color: "var(--alp)"
    }, {
      v: lnpV,
      color: "var(--lnp)"
    }],
    note: " on the implied 2PP (the poll’s primaries at 2025-election preference flows)"
  };
}
function primaryLeadInfo(p) {
  if (!p.p || p.p.alp == null || p.p.lnp == null) return null;
  const opp = [["lnp", "L/NP", p.p.lnp, "var(--lnp)"], ["onp", "ON", p.p.onp, "var(--onp)"], ["grn", "GRN", p.p.grn, "var(--grn)"]].filter(e => e[2] != null).sort((a, b) => b[2] - a[2])[0];
  const m = +(p.p.alp - opp[2]).toFixed(1);
  const alpWins = m >= 0;
  return {
    m,
    primary: true,
    who: alpWins ? "alp" : opp[0],
    lab: alpWins ? "ALP" : opp[1],
    color: alpWins ? "var(--alp)" : opp[3],
    segs: [{
      v: p.p.alp,
      color: "var(--alp)"
    }, {
      v: opp[2],
      color: opp[3]
    }],
    note: ` over ${alpWins ? opp[1] : "ALP"} on primary votes – the poll published no after-preferences figure`
  };
}
function ArchLead({
  p,
  measure,
  primaryFallback,
  basis
}) {
  const li = archLeadInfo(p, measure, basis) || (primaryFallback && measure === "lnp" ? primaryLeadInfo(p) : null);
  if (!li) return React.createElement("span", {
    className: "dash",
    title: measure === "lnponp" || measure === "3cp" ? "This pollster didn’t publish the selected matchup this wave" : basis === "resp" ? measure === "onp" ? "This pollster didn’t publish the selected matchup this wave" : "This pollster published no two-party figure this wave" : "No implied figure – this poll never filed a full primary set the flow tables can read"
  }, "\u2014");
  return React.createElement("div", {
    className: "arch-appr",
    title: `${li.lab} leads by ${Math.abs(li.m).toFixed(1)}${li.note}`
  }, React.createElement("span", {
    className: "netv",
    style: {
      color: inkOf(li.color)
    }
  }, React.createElement("span", {
    className: "lead-who"
  }, li.lab), " ", "+", Math.abs(li.m).toFixed(1), li.primary && React.createElement(React.Fragment, null, " ", React.createElement("span", {
    className: "facet-flag"
  }, "primary"))), React.createElement("div", {
    className: "lead-bar",
    "aria-hidden": "true"
  }, React.createElement("span", {
    className: "lead-bar-fill " + (li.m >= 0 ? "from-r" : "from-l"),
    style: {
      background: li.color,
      width: Math.min(50, Math.abs(li.m) * 6.25) + "%",
      [li.m >= 0 ? "right" : "left"]: "50%"
    }
  })));
}
const signed1 = v => {
  const d = Math.round(v * 10) / 10;
  return (d < 0 ? "\u2212" : "+") + Math.abs(d).toFixed(1);
};
function ArchPollDetail({
  p,
  onBack,
  backLabel
}) {
  const {
    PollLedger,
    pubStamp,
    releaseMetaRows,
    EffLines,
    soloNote
  } = window;
  const dirSegments = p.dir ? [{
    label: "Right direction",
    value: p.dir.right,
    color: "var(--mood-pos)",
    delta: p.dir.chg ? {
      v: p.dir.chg.right,
      refDate: p.dir.ref
    } : null
  }, {
    label: "Unsure",
    value: p.dir.unsure,
    resid: true
  }, {
    label: "Wrong track",
    value: p.dir.wrong,
    color: "var(--mood-neg)",
    delta: p.dir.chg ? {
      v: p.dir.chg.wrong,
      refDate: p.dir.ref
    } : null
  }] : null;
  const metaItems = [p.client && React.createElement("span", {
    className: "pd-meta-i",
    key: "client"
  }, React.createElement("span", {
    className: "pd-meta-k"
  }, p.conf ? "Gauge" : "Commissioned by"), React.createElement("span", {
    className: "pd-meta-v"
  }, p.client)), React.createElement("span", {
    className: "pd-meta-i",
    key: "field"
  }, React.createElement("span", {
    className: "pd-meta-k"
  }, "Fieldwork"), React.createElement("span", {
    className: "pd-meta-v"
  }, p.fieldPending ? rdFieldTbc(p) : p.field)), React.createElement("span", {
    className: "pd-meta-i",
    key: "pub"
  }, React.createElement("span", {
    className: "pd-meta-k"
  }, "Published"), React.createElement("span", {
    className: "pd-meta-v"
  }, pubStamp(p.published, {
    year: true
  }) || React.createElement("span", {
    className: "pd-est",
    title: "Publication date not recorded for this poll \u2013 showing the last day of fieldwork"
  }, p.fullDate))), React.createElement("span", {
    className: "pd-meta-i",
    key: "sample"
  }, React.createElement("span", {
    className: "pd-meta-k"
  }, "Sample"), React.createElement("span", {
    className: "pd-meta-v"
  }, window.sampleValue(p))), p.solo && soloNote && React.createElement("span", {
    className: "pd-meta-i",
    key: "solo"
  }, React.createElement("span", {
    className: "pd-meta-k"
  }, "Territory readings"), React.createElement("span", {
    className: "pd-meta-v"
  }, soloNote(p))), (p.leanLnp != null || p.leanOn != null) && React.createElement("span", {
    className: "pd-meta-i",
    key: "lean"
  }, React.createElement("span", {
    className: "pd-meta-k"
  }, "Poll lean"), React.createElement("span", {
    className: "pd-meta-v"
  }, [p.leanLnp != null && React.createElement(React.Fragment, {
    key: "l"
  }, signed1(p.leanLnp), " for ALP vs L/NP"), p.leanOn != null && React.createElement(React.Fragment, {
    key: "o"
  }, signed1(p.leanOn), " for ALP vs ON")].filter(Boolean).reduce((acc, x, i) => i ? [...acc, "; ", x] : [x], []), React.createElement("span", {
    className: "pd-s-note"
  }, ", against the ", p.pubBasis ? "published" : "implied", " average of the other polls fielded around it"))), (p.hfxLnp != null || p.hfxOn != null) && React.createElement("span", {
    className: "pd-meta-i",
    key: "hfx"
  }, React.createElement("span", {
    className: "pd-meta-k"
  }, "House effect"), React.createElement("span", {
    className: "pd-meta-v"
  }, [p.hfxLnp != null && React.createElement(React.Fragment, {
    key: "l"
  }, signed1(p.hfxLnp.v), " for ALP vs L/NP"), p.hfxOn != null && React.createElement(React.Fragment, {
    key: "o"
  }, signed1(p.hfxOn.v), " for ALP vs ON")].filter(Boolean).reduce((acc, x, i) => i ? [...acc, "; ", x] : [x], []), React.createElement("span", {
    className: "pd-s-note"
  }, ", against the ", p.pubBasis ? "published" : "implied", "-basis consensus"))), ...(releaseMetaRows ? releaseMetaRows(p) : []), EffLines && p.eff && React.createElement(EffLines, {
    key: "aggEff",
    eff: p.eff
  })].filter(Boolean);
  const controls = [onBack && React.createElement("button", {
    className: "back-to-chart",
    key: "back",
    onClick: e => {
      e.stopPropagation();
      onBack();
    }
  }, React.createElement("svg", {
    viewBox: "0 0 24 24",
    width: "13",
    height: "13",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true"
  }, React.createElement("path", {
    d: "M19 12H5M11 18l-6-6 6-6"
  })), "Back to ", backLabel || "the chart"), (() => {
    const yr = p.year != null ? p.year : /^\d{4}-/.test(p.released || "") ? Number(p.released.slice(0, 4)) : null;
    const when = p.fieldPending ? "TBC" : p.field ? p.field + (yr ? " " + yr : "") : p.fullDate ? p.fullDate : "";
    return React.createElement("a", {
      className: "back-to-chart pd-report",
      key: "report",
      href: `/feedback/?msg=${encodeURIComponent(`${p.pollster}${when ? ", " + when : ""} – `)}`,
      title: "Report an error in this poll",
      "aria-label": "Report an error in this poll",
      onClick: e => e.stopPropagation()
    }, React.createElement("svg", {
      viewBox: "0 0 24 24",
      width: "13",
      height: "13",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": "true"
    }, React.createElement("path", {
      d: "M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"
    })), React.createElement("span", {
      className: "pd-report-lbl"
    }, "Report an error"));
  })()].filter(Boolean);
  return React.createElement("div", {
    className: "poll-detail"
  }, React.createElement("div", {
    className: "pd-meta pd-meta-split"
  }, React.createElement("span", {
    className: "pd-meta-items"
  }, metaItems), controls.length > 0 && React.createElement("span", {
    className: "pd-meta-tail"
  }, controls)), React.createElement(PollLedger, {
    r: p,
    dirSegments: dirSegments
  }));
}
const POLL_TAGS = [{
  id: "2pp",
  label: "2PP",
  title: "Two-party preferred – one matchup (ALP v L/NP)"
}, {
  id: "2x2pp",
  label: "2×2PP",
  title: "Two 2PP matchups – e.g. ALP v L/NP and ALP v ON"
}, {
  id: "3x2pp",
  label: "3×2PP",
  title: "Three 2PP matchups – ALP v L/NP, ALP v ON, and L/NP v ON"
}, {
  id: "3pp",
  label: "3PP",
  title: "Three-way party-preferred – ALP / L/NP / ON in one distribution"
}, {
  id: "ppm",
  label: "PPM",
  title: "Preferred prime minister"
}, {
  id: "aprv",
  label: "Aprv",
  title: "Leader approval (approve − disapprove)"
}, {
  id: "fav",
  label: "Fav",
  title: "Leader favourability (positive − negative)"
}, {
  id: "seats",
  label: "Seats",
  title: "Modelled seat projection with range – MRP polls only"
}, {
  id: "dir",
  label: "Dir",
  title: "National direction – right direction / wrong track"
}, {
  id: "iss",
  label: "Iss",
  title: "Issues – what voters say matters, and the party rated best on it"
}, {
  id: "conf",
  label: "Conf",
  title: "Confidence – an economic-confidence gauge's published release"
}];
const POLL_TAG_META = Object.fromEntries(POLL_TAGS.map(t => [t.id, t]));
const AP_CLIENT_ALIASES = {
  "afr": "australian financial review",
  "smh/age": "sydney morning herald the age",
  "australia inst.": "australia institute"
};
const CONF_BUS_LANES = new Set(["business", "nabBusiness"]);
const URL_HOUSES = ["Agenda C Synesis", "DemosAU", "Essential", "Fox & Hedgehog", "Freshwater", "Newspoll", "RedBridge/Accent", "Resolve", "Roy Morgan", "Spectre Strategy", "Wolf & Smith", "YouGov", "SEC Newgate", "Ipsos", "ANZ–Roy Morgan", "Westpac–MI", "NAB", "EMRS (Tas)"];
const archMask = (order, set) => {
  let m = 0;
  order.forEach((name, i) => {
    if (set.has(name)) m += 2 ** i;
  });
  return "b" + m.toString(36);
};
const archUnpack = (raw, order) => {
  if (!/^b[0-9a-z]+$/.test(raw || "")) return null;
  const v = parseInt(raw.slice(1), 36);
  const s = new Set();
  order.forEach((name, i) => {
    if (v % 2 ** (i + 1) >= 2 ** i) s.add(name);
  });
  return s;
};
function pollTagIds(p) {
  const a = p.appr || {};
  const hasNet = a.albNet != null || a.taylorNet != null || a.hansonNet != null;
  const t = [];
  const nMatch = (p.alp != null ? 1 : 0) + (p.tppAlt ? 1 : 0) + (p.tppAlt2 ? 1 : 0);
  if (nMatch >= 3) t.push("3x2pp");else if (nMatch === 2) t.push("2x2pp");else if (nMatch === 1) t.push("2pp");
  if (p.tpp3) t.push("3pp");
  if (window.ppmContests(p).length) t.push("ppm");
  const mb = a.metricBy || {};
  let anyAprv = false,
    anyFav = false;
  for (const [id, nk] of [["alb", "albNet"], ["taylor", "taylorNet"], ["hanson", "hansonNet"]]) {
    const alt = a.alt && a.alt[id];
    if (alt) {
      if (alt.metric === "fav") anyFav = true;else anyAprv = true;
    }
    if (a[nk] == null) continue;
    if (mb[id] === "fav") anyFav = true;else anyAprv = true;
  }
  if (anyAprv) t.push("aprv");
  if (anyFav) t.push("fav");
  if (p.seats && p.seats.p) t.push("seats");
  if (p.dir) t.push("dir");
  if (p.iss) t.push("iss");
  if (p.conf) t.push("conf");
  return t;
}
function FilterPop({
  id,
  label,
  summary,
  on,
  open,
  setOpen,
  inline,
  children
}) {
  const box = useRef(null),
    panel = useRef(null);
  const isOpen = open === id;
  const [flip, setFlip] = useState(false);
  React.useEffect(() => {
    if (!isOpen) {
      setFlip(false);
      return;
    }
    const onDown = e => {
      if (!inline && box.current && !box.current.contains(e.target)) setOpen(null);
    };
    const onKey = e => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setOpen(null);
      const b = box.current && box.current.querySelector(".ap-popbtn");
      if (b) b.focus();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [isOpen]);
  React.useLayoutEffect(() => {
    if (inline || !isOpen || !panel.current) return;
    const r = panel.current.getBoundingClientRect();
    if (r.right > window.innerWidth - 8) setFlip(true);
  }, [isOpen]);
  const panelEl = isOpen && React.createElement("div", {
    className: "ap-panel" + (inline ? " ap-panel-inline" : flip ? " flip" : ""),
    ref: panel,
    role: "group",
    "aria-label": label
  }, children);
  const button = React.createElement("button", {
    type: "button",
    className: "ap-popbtn" + ((on == null ? !!summary : on) ? " on" : "") + (isOpen ? " open" : ""),
    "aria-expanded": isOpen,
    "aria-haspopup": inline ? undefined : "true",
    onClick: () => setOpen(isOpen ? null : id)
  }, React.createElement("span", {
    className: "ap-popbtn-lab"
  }, label), summary && React.createElement("span", {
    className: "ap-popbtn-val"
  }, summary), React.createElement("svg", {
    className: "ap-caret",
    viewBox: "0 0 24 24",
    width: "11",
    height: "11",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.5",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true"
  }, React.createElement("path", {
    d: "M6 9l6 6 6-6"
  })));
  if (inline) return React.createElement(React.Fragment, null, React.createElement("div", {
    className: "ap-pop",
    ref: box
  }, button), panelEl);
  return React.createElement("div", {
    className: "ap-pop",
    ref: box
  }, button, panelEl);
}
function PopRow({
  on,
  radio,
  label,
  note,
  n,
  onClick
}) {
  return React.createElement("button", {
    type: "button",
    className: "ap-check" + (on ? " on" : "") + (radio ? " radio" : ""),
    role: radio ? "radio" : "checkbox",
    "aria-checked": on,
    onClick: onClick
  }, React.createElement("span", {
    className: "ap-tick",
    "aria-hidden": "true"
  }), React.createElement("span", {
    className: "ap-check-lab"
  }, label, note && React.createElement("span", {
    className: "ap-check-note"
  }, note)), n != null && React.createElement("span", {
    className: "ap-check-n"
  }, n));
}
const VAR_VOTE_VIEWS = [{
  id: "twopp",
  label: "2PP"
}, {
  id: "primary",
  label: "Primaries"
}];
function VariancePanel({
  facet,
  rangeId
}) {
  const {
    D,
    discord,
    discordFacet,
    discordRead,
    rangeDomain,
    buildXTicks,
    monthLabelFull
  } = window.AP;
  const narrow = useNarrow();
  const [hidden, setHidden] = useState({});
  const [view, setView] = useState(facet === "twopp" ? "primary" : facet);
  const rivalFirst = D.latest && D.latest.rivalLead || "alp_lnp";
  const RIVAL_ORDER = rivalFirst === "alp_on" ? ["tpp_alpon_imp", "tpp_alpon", "tpp_alp_imp", "tpp_alp"] : ["tpp_alp_imp", "tpp_alp", "tpp_alpon_imp", "tpp_alpon"];
  const rank = id => {
    const i = RIVAL_ORDER.indexOf(id);
    return i < 0 ? RIVAL_ORDER.length : i;
  };
  const rows = discordFacet(view).slice().sort((a, b) => rank(a.id) - rank(b.id)).map(m => ({
    m,
    pts: discord(m.id)
  })).filter(r => r.pts.some(d => d.sigma != null));
  if (!rows.length) return null;
  const xDomain = rangeDomain(rangeId);
  const inWin = d => d.x >= xDomain[0] - 0.02 && d.x <= xDomain[1];
  const shown = rows.filter(r => !hidden[r.m.id]);
  const vis = shown.length ? shown : rows;
  const chartSeries = rows.map(r => ({
    id: r.m.id,
    label: r.m.label,
    color: r.m.color,
    width: 3,
    dashed: !!r.m.dashed,
    opacity: hidden[r.m.id] ? 0 : 1,
    endLabel: r.m.label,
    points: r.pts.filter(d => d.sigma != null && inWin(d)).map(d => ({
      x: d.x,
      y: d.sigma,
      note: d.R.toFixed(2) + "×"
    }))
  })).filter(s => s.points.length > 1);
  const floorPts = D.MONTHS.map((ym, i) => {
    const fs = vis.map(r => r.pts[i]).filter(d => d && d.floor != null).map(d => d.floor);
    return fs.length ? {
      x: D.mx(ym),
      y0: 0,
      y1: fs.reduce((s, v) => s + v, 0) / fs.length
    } : null;
  }).filter(d => d && inWin(d));
  const spine = D.MONTHS.map(ym => ({
    x: D.mx(ym),
    y: 0
  })).filter(inWin);
  const spineYm = D.MONTHS.filter(ym => inWin({
    x: D.mx(ym)
  }));
  const vals = [];
  chartSeries.forEach(s => {
    if (s.opacity !== 0) s.points.forEach(p => vals.push(p.y));
  });
  floorPts.forEach(d => vals.push(d.y1));
  const step = Math.max(...vals) > 6 ? 2 : 1;
  const {
    domain,
    ticks
  } = fitDomain(vals.length ? vals : [0, 1], step, 0);
  const latest = rows.map(r => {
    const pts = r.pts.filter(d => d.sigma != null);
    return {
      m: r.m,
      d: pts[pts.length - 1]
    };
  });
  const unitNote = view === "leadership" ? "net approval points" : "percentage points";
  return React.createElement("section", {
    className: "ap-var",
    id: "poll-disagreement"
  }, React.createElement("div", {
    className: "ap-var-head"
  }, React.createElement("div", null, React.createElement("h3", {
    className: "ap-var-title"
  }, "Poll disagreement"), React.createElement("p", {
    className: "card-sub"
  }, "How far apart the polls sit, against the spread sampling error alone would produce. The shading is that chance floor \u2013 a line inside it means the houses are running tighter than random sampling permits. Measured across all ", D.individualPolls.length, " polls.", view === "twopp" && React.createElement(React.Fragment, null, " ", "Each two-party contest is drawn on both bases. The", " ", React.createElement("em", null, "as published"), " line (dashed) spreads the figure each house prints \u2013 its own allocation, which is where herding lives \u2013 and so covers only the waves that publish a pair; the ", React.createElement("em", null, "implied"), " line spreads every full-primary wave read through one shared flow table, so it is the houses disagreeing about the primaries, in two-party units."))), React.createElement("div", {
    className: "legend"
  }, latest.map(({
    m,
    d
  }) => {
    const read = discordRead(d.R);
    return React.createElement("button", {
      key: m.id,
      type: "button",
      className: "legend-chip" + (hidden[m.id] ? " off" : "") + (m.dashed ? " dashed" : ""),
      "aria-pressed": !hidden[m.id],
      title: m.label + " – " + d.sigma.toFixed(2) + "pp spread vs a " + d.floor.toFixed(2) + "pp floor, " + read.label.replace(/^./, ch => ch.toUpperCase()),
      onClick: () => setHidden(h => ({
        ...h,
        [m.id]: !h[m.id]
      }))
    }, React.createElement("span", {
      className: "legend-swatch",
      style: m.dashed ? {
        borderTopColor: m.color
      } : {
        background: m.color
      }
    }), React.createElement("span", {
      className: "legend-name"
    }, m.label), React.createElement("span", {
      className: "legend-val vr-" + read.id
    }, d.R.toFixed(2), "\xD7"));
  }))), (facet === "twopp" || facet === "primary") && React.createElement("div", {
    className: "ap-var-ctl"
  }, React.createElement(TextToggle, {
    value: view === "primary" ? "primary" : "twopp",
    onChange: setView,
    options: VAR_VOTE_VIEWS,
    ariaLabel: "Disagreement measure"
  })), React.createElement(TrendChart, {
    key: "var-" + view + "-" + rangeId,
    height: narrow ? 500 : 300,
    xDomain: xDomain,
    yDomain: domain,
    yTicks: ticks,
    unit: "pp",
    axisFont: narrow ? 28 : 15,
    pad: {
      l: 54,
      r: 20,
      t: 18,
      b: 40
    },
    xTicks: buildXTicks(xDomain[0], xDomain[1]),
    areas: [{
      id: "floor",
      color: "var(--ink-faint)",
      opacity: 0.14,
      points: floorPts
    }],
    series: chartSeries,
    spine: spine,
    tooltipTitle: i => monthLabelFull(spineYm[i]),
    extraRows: i => {
      const f = floorPts.filter(d => d.x === (spine[i] || {}).x)[0];
      return f ? [{
        label: "Chance floor",
        value: f.y1.toFixed(2) + "pp"
      }] : [];
    },
    fmt: v => v.toFixed(2)
  }), React.createElement("div", {
    className: "ap-var-read"
  }, latest.map(({
    m,
    d
  }) => {
    const read = discordRead(d.R);
    const readTerm = {
      chance: "chance-consistent",
      mild: "mild-divergence",
      wide: "real-disagreement"
    }[read.id];
    return React.createElement("div", {
      key: m.id,
      className: "vr-tile" + (hidden[m.id] ? " off" : "")
    }, React.createElement("span", {
      className: "vr-name",
      style: {
        color: inkOf(m.color)
      }
    }, m.label), React.createElement("span", {
      className: "vr-sigma"
    }, d.sigma.toFixed(2), React.createElement("em", null, "pp")), readTerm ? React.createElement("button", {
      type: "button",
      className: "vr-pill vr-" + read.id + " hi-term",
      title: "What " + read.label + " means",
      onClick: () => window.AP.openTerm && window.AP.openTerm(readTerm, "Poll disagreement")
    }, read.label) : React.createElement("span", {
      className: "vr-pill vr-" + read.id
    }, read.label), React.createElement("span", {
      className: "vr-sub"
    }, d.R.toFixed(2), "\xD7 the ", d.floor.toFixed(2), "pp floor", d.excess > 0.05 && React.createElement(React.Fragment, null, ", ", d.excess.toFixed(2), "pp unexplained")));
  })), React.createElement("p", {
    className: "table-hint ap-var-note"
  }, "The ratio of spread to floor reads: under 0.80\xD7 herded, around 1\xD7 as close as sampling allows, over 1.20\xD7 genuinely apart."), React.createElement(HowTo, {
    cls: "table-hint ap-var-note",
    paras: [React.createElement(React.Fragment, null, "Spread is the recency-weighted standard deviation of each poll\u2019s distance from a local trend, in ", unitNote, " \u2013 recency-weighted only, because weighting by sample size would mute exactly the small divergent polls being measured."), React.createElement(React.Fragment, null, "The floor is what a design effect of ", window.AP.DISC.DEFF, " and each poll\u2019s own sample size predict."), view === "leadership" && React.createElement(React.Fragment, null, "Leadership residuals are pooled within each leader-era and metric, so the Ley \u2192 Taylor handover and the approval/favourability mix aren\u2019t counted as pollsters disagreeing.")]
  }));
}
const HOUSE_LEAN_COLOURS = {
  "DemosAU": "oklch(0.63 0.145 90)",
  "Essential": "oklch(0.63 0.145 110)",
  "Fox & Hedgehog": "oklch(0.63 0.145 128)",
  "Freshwater": "oklch(0.63 0.145 165)",
  "Newspoll": "oklch(0.63 0.145 185)",
  "RedBridge/Accent": "oklch(0.63 0.145 205)",
  "Resolve": "oklch(0.63 0.145 225)",
  "Roy Morgan": "oklch(0.63 0.145 268)",
  "Spectre Strategy": "oklch(0.63 0.145 290)",
  "YouGov": "oklch(0.63 0.145 312)"
};
function houseLeanColour(firm) {
  if (HOUSE_LEAN_COLOURS[firm]) return HOUSE_LEAN_COLOURS[firm];
  let h = 0;
  for (let i = 0; i < firm.length; i++) h = (h * 31 + firm.charCodeAt(i)) % 997;
  return "oklch(0.63 0.145 " + (99 + h % 9 * 29) + ")";
}
const LEAN_CONTESTS = {
  alp_on: {
    imp: "onimp",
    pub: "onpub",
    label: "ALP v ON",
    phrase: {
      imp: "the implied ALP-v-One Nation share",
      pub: "the published ALP-v-One Nation share"
    },
    above: "lean-band-alp",
    below: "lean-band-onp",
    ground: "The ground is Labor red / One Nation orange around zero: a house inside the orange band runs ahead of the consensus on One Nation\u2019s share of the pairing, inside the red band ahead on Labor\u2019s."
  },
  alp_lnp: {
    imp: "imp",
    pub: "tpp",
    label: "ALP v L/NP",
    phrase: {
      imp: "the implied 2PP",
      pub: "the published 2PP"
    },
    above: "lean-band-alp",
    below: "lean-band-lnp",
    ground: "The ground is Labor red / Coalition blue around zero: a house inside the blue band runs ahead of the consensus on the Coalition\u2019s 2PP, inside the red band ahead on Labor\u2019s."
  }
};
const LEAN_PRIMARIES_LIST = [{
  id: "alp",
  label: "ALP"
}, {
  id: "lnp",
  label: "L/NP"
}, {
  id: "onp",
  label: "ON"
}];
const LEAN_BASES = [{
  id: "imp",
  label: "implied"
}, {
  id: "pub",
  label: "published"
}];
const LEAN_BASIS_NOTE = {
  imp: "A lean here is a house\u2019s primaries running high or low \u2014 never its allocation method, which one frozen flow table holds identical for everyone.",
  pub: "A lean here mixes how a house\u2019s respondents answered with how it chose to allocate their preferences \u2014 the two are not separable on this basis."
};
const LEAN_MEASURE_META = {
  alp: {
    phrase: "Labor’s primary vote",
    above: "lean-band-alp",
    below: "lean-band-ink",
    ground: "The ground colours the side of zero a house sits on: inside the red band it runs ahead of the consensus on Labor’s primary vote, below zero it trails it."
  },
  lnp: {
    phrase: "the Coalition’s primary vote",
    above: "lean-band-lnp",
    below: "lean-band-ink",
    ground: "The ground colours the side of zero a house sits on: inside the blue band it runs ahead of the consensus on the Coalition’s primary vote, below zero it trails it."
  },
  onp: {
    phrase: "One Nation’s primary vote",
    above: "lean-band-onp",
    below: "lean-band-ink",
    ground: "The ground colours the side of zero a house sits on: inside the tinted band it runs ahead of the consensus on One Nation’s primary vote, below zero it trails it."
  }
};
const LEAN_SURFACE = 1.0;
function HouseLeanPanel({
  rangeId
}) {
  const {
    D,
    rangeDomain,
    buildXTicks,
    monthLabelFull
  } = window.AP;
  const narrow = useNarrow();
  const [hidden, setHidden] = useState({});
  const rivalFirst = D.latest && D.latest.rivalLead || "alp_lnp";
  const contestIds = Object.keys(LEAN_CONTESTS).sort((x, y) => x === rivalFirst ? -1 : y === rivalFirst ? 1 : 0);
  const [measure, setMeasure] = useState(contestIds[0]);
  const [basis, setBasis] = useState("imp");
  const boardRef = React.useRef(null);
  React.useEffect(() => {
    window.AP_LEAN_BOARD = boardRef.current;
  });
  React.useEffect(() => () => {
    window.AP_LEAN_BOARD = null;
  }, []);
  const contest = LEAN_CONTESTS[measure] || null;
  const leanKey = contest ? contest[basis] : measure;
  const meta = contest ? {
    phrase: contest.phrase[basis],
    above: contest.above,
    below: contest.below,
    ground: contest.ground,
    basis: LEAN_BASIS_NOTE[basis]
  } : LEAN_MEASURE_META[measure] || LEAN_MEASURE_META.alp;
  const LEAN_MEASURES = [...contestIds.map(id => ({
    id,
    label: LEAN_CONTESTS[id].label
  })), ...LEAN_PRIMARIES_LIST];
  const leanMap = D.houseLean && D.houseLean[leanKey];
  if (!leanMap) return null;
  const houses = Object.keys(leanMap).sort();
  if (!houses.length) return null;
  const xDomain = rangeDomain(rangeId);
  const inWin = d => d.x >= xDomain[0] - 0.02 && d.x <= xDomain[1];
  const rows = houses.map(firm => {
    const all = leanMap[firm].map(d => ({
      x: D.mx(d.ym),
      y: d.v
    }));
    return {
      firm,
      color: houseLeanColour(firm),
      all,
      pts: all.filter(inWin)
    };
  });
  const shownN = rows.filter(r => !hidden[r.firm]).length;
  const byLean = rows.filter(r => !hidden[r.firm]).sort((a, b) => Math.abs(b.all[b.all.length - 1].y) - Math.abs(a.all[a.all.length - 1].y));
  const named = new Set(byLean.filter((r, i) => i < 3 || Math.abs(r.all[r.all.length - 1].y) >= LEAN_SURFACE).map(r => r.firm));
  const standsOut = r => named.has(r.firm);
  const chartSeries = rows.map(r => ({
    id: r.firm,
    label: r.firm,
    color: r.color,
    width: 3,
    opacity: hidden[r.firm] ? 0 : shownN > 4 && !standsOut(r) ? 0.35 : 1,
    endLabel: shownN <= 4 || standsOut(r) ? r.firm : undefined,
    points: r.pts
  })).filter(s => s.points.length > 1);
  if (!chartSeries.length) return null;
  const spine = D.MONTHS.map(ym => ({
    x: D.mx(ym),
    y: 0
  })).filter(inWin);
  const spineYm = D.MONTHS.filter(ym => inWin({
    x: D.mx(ym)
  }));
  const step = 1;
  const vals = [step, -step];
  rows.forEach(r => {
    if (!hidden[r.firm]) r.pts.forEach(p => vals.push(p.y));
  });
  const {
    domain,
    ticks
  } = fitDomain(vals, Math.max(...vals.map(Math.abs)) > 4 ? 2 : step, 0);
  const latest = rows.map(r => ({
    firm: r.firm,
    color: r.color,
    v: r.all[r.all.length - 1].y
  }));
  const leanStr = v => (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(1) + "pp";
  const leaners = latest.filter(e => Math.abs(e.v) >= LEAN_SURFACE).sort((a, b) => Math.abs(b.v) - Math.abs(a.v));
  boardRef.current = {
    title: "House lean, " + (contest ? contest.label + ", " + (basis === "imp" ? "implied" : "published") : LEAN_MEASURES.find(m => m.id === measure).label + " primary"),
    items: latest.map(e => ({
      name: e.firm,
      color: e.color,
      value: leanStr(e.v),
      off: !!hidden[e.firm]
    })),
    caption: meta.ground
  };
  return React.createElement("section", {
    className: "ap-lean",
    id: "house-lean"
  }, React.createElement("div", {
    className: "ap-var-head"
  }, React.createElement("div", null, React.createElement("h3", {
    className: "ap-var-title"
  }, "House lean"), React.createElement("p", {
    className: "card-sub"
  }, "How far each pollster sits from the consensus of the houses polling around it", " ", "on " + meta.phrase, ", estimated month by month \u2013 the same", " ", React.createElement("button", {
    type: "button",
    className: "hi-term",
    onClick: () => window.AP.openTerm && window.AP.openTerm("house-effect", "House lean")
  }, "house effect"), " ", "the aggregates subtract, shown as it has walked. The chart above spreads the houses against chance; this one tracks where each one stands.", meta.basis && React.createElement(React.Fragment, null, " ", meta.basis)))), React.createElement(SeriesBoard, {
    id: "lean-" + measure,
    label: "Houses",
    hidden: hidden,
    setHidden: setHidden,
    items: latest.map(e => ({
      id: e.firm,
      color: e.color,
      name: e.firm,
      value: leanStr(e.v),
      note: Math.abs(e.v) >= LEAN_SURFACE ? "past ±1pp" : null
    })),
    quick: [{
      id: "all",
      label: "All",
      title: "Every house on the chart",
      on: latest.every(e => !hidden[e.firm]),
      run: () => setHidden({})
    }, {
      id: "none",
      label: "None",
      title: "Clear the chart",
      on: latest.every(e => hidden[e.firm]),
      run: () => setHidden(Object.fromEntries(latest.map(e => [e.firm, true])))
    }].concat(leaners.length ? [{
      id: "lean",
      label: "Past ±1pp",
      title: "Only the houses whose lean has left the band the chart's first gridline draws",
      on: latest.every(e => !!hidden[e.firm] !== Math.abs(e.v) >= LEAN_SURFACE),
      run: () => setHidden(Object.fromEntries(latest.map(e => [e.firm, Math.abs(e.v) < LEAN_SURFACE])))
    }] : []),
    surfaced: leaners.map(e => ({
      id: e.firm,
      color: e.color,
      name: e.firm,
      value: leanStr(e.v),
      title: e.firm + " is " + leanStr(e.v).replace("−", "-") + " against the consensus on " + meta.phrase + " — click to clear its line"
    })),
    foot: React.createElement(React.Fragment, null, "Click a house to draw or clear its line. Zero is the consensus of the houses polling around it, not a neutral the site defines \u2014 a house at zero agrees with its contemporaries, which is not the same as being right.")
  }), React.createElement("div", {
    className: "ap-var-ctl"
  }, React.createElement(TextToggle, {
    value: measure,
    onChange: setMeasure,
    options: LEAN_MEASURES,
    ariaLabel: "House-lean measure"
  }), contest && React.createElement("span", {
    className: "ap-ctl-group"
  }, React.createElement("span", {
    className: "ap-ctl-lab"
  }, "Basis"), React.createElement(TextToggle, {
    value: basis,
    onChange: setBasis,
    options: LEAN_BASES,
    ariaLabel: "House-lean basis",
    caps: true
  }))), React.createElement(TrendChart, {
    key: "lean-" + measure + "-" + rangeId,
    height: narrow ? 500 : 300,
    xDomain: xDomain,
    yDomain: domain,
    yTicks: ticks,
    unit: "pp",
    axisFont: narrow ? 28 : 15,
    pad: {
      l: 54,
      r: 20,
      t: 18,
      b: 40
    },
    xTicks: buildXTicks(xDomain[0], xDomain[1]),
    bands: [{
      y0: 0,
      y1: domain[1],
      className: meta.above
    }, {
      y0: domain[0],
      y1: 0,
      className: meta.below
    }],
    refLines: [{
      y: 0,
      color: "var(--ink-3)"
    }],
    series: chartSeries,
    spine: spine,
    tooltipTitle: i => monthLabelFull(spineYm[i]),
    ariaLabel: "Pollster house lean over time on " + meta.phrase + " – how far each pollster sits from the cross-house consensus",
    fmt: v => (v > 0 ? "+" : "") + v.toFixed(1)
  }), React.createElement("p", {
    className: "table-hint ap-var-note"
  }, meta.ground), React.createElement(HowTo, {
    cls: "table-hint ap-var-note",
    paras: [React.createElement(React.Fragment, null, "Each point reads the lean as of that month, with the 90-day half-life on the evidence, so a house\u2019s current method outranks its history."), React.createElement(React.Fragment, null, "The All-polls table\u2019s House-effect column instead pools each pollster\u2019s whole history into one standing figure, which is why its numbers won\u2019t match the right-hand edge here.")]
  }));
}
function SeriesBoard({
  id,
  label,
  items,
  hidden,
  setHidden,
  quick,
  surfaced = [],
  foot,
  countIds
}) {
  const [pop, setPop] = useState(null);
  const counted = countIds ? items.filter(i => countIds.includes(i.id)) : items;
  const shown = counted.filter(i => !hidden[i.id]).length;
  const surfacedIds = new Set(surfaced.map(s => s.id));
  const toggle = k => setHidden(h => ({
    ...h,
    [k]: !h[k]
  }));
  return React.createElement("div", {
    className: "sb-bar"
  }, React.createElement(FilterPop, {
    id: id,
    label: label,
    open: pop,
    setOpen: setPop,
    on: shown !== counted.length,
    summary: shown === counted.length ? "all " + counted.length : shown + " of " + counted.length
  }, React.createElement("div", {
    className: "ap-pop-head"
  }, React.createElement("span", null, "On the chart"), quick && quick.length > 0 && React.createElement("div", {
    className: "pop-quick",
    role: "group",
    "aria-label": "Series shortcuts"
  }, quick.map(q => React.createElement("button", {
    key: q.id,
    type: "button",
    title: q.title,
    "aria-pressed": !!q.on,
    className: "pop-quick-opt" + (q.on ? " active" : ""),
    onClick: q.run
  }, q.label)))), React.createElement("div", {
    className: "sb-board",
    role: "group",
    "aria-label": label
  }, items.map(i => React.createElement("button", {
    key: i.id,
    type: "button",
    className: "sb-row" + (hidden[i.id] ? " off" : "") + (surfacedIds.has(i.id) ? " out" : ""),
    "aria-pressed": !hidden[i.id],
    title: (hidden[i.id] ? "Draw " : "Take ") + i.name + (hidden[i.id] ? " on the chart" : " off the chart"),
    onClick: () => toggle(i.id)
  }, React.createElement("span", {
    className: "sb-swatch",
    style: {
      background: i.color
    }
  }), React.createElement("span", {
    className: "sb-row-name"
  }, i.name), i.note && React.createElement("span", {
    className: "sb-row-note"
  }, i.note), React.createElement("span", {
    className: "sb-row-val"
  }, i.value)))), foot && React.createElement("p", {
    className: "ap-pop-foot"
  }, foot)), surfaced.map(sfc => React.createElement("button", {
    key: sfc.id,
    type: "button",
    className: "sb-out" + (hidden[sfc.id] ? " off" : ""),
    style: {
      "--fl": sfc.color
    },
    "aria-pressed": !hidden[sfc.id],
    title: sfc.title,
    onClick: () => toggle(sfc.id)
  }, React.createElement("span", {
    className: "sb-swatch",
    style: {
      background: sfc.color
    }
  }), React.createElement("span", {
    className: "sb-out-name"
  }, sfc.name), React.createElement("span", {
    className: "sb-out-val"
  }, sfc.value))));
}
function FlowLegend({
  pooledId,
  pooled,
  houseRows,
  hidden,
  setHidden,
  sgn,
  kind
}) {
  const total = houseRows.length;
  const pooledOn = !hidden[pooledId];
  const band = pooled && pooled.ci95 != null ? pooled.ci95 : null;
  const sectionId = kind === "alp-on" ? "flow-drift-on" : "flow-drift";
  React.useEffect(() => {
    window.AP_FLOW_BOARD = Object.assign(window.AP_FLOW_BOARD || {}, {
      [sectionId]: {
        title: "Preference-flow drift" + (kind === "alp-on" ? ", ALP v ON" : ", ALP v L/NP"),
        pooled: {
          name: "Pooled, " + total + " houses",
          value: band != null ? sgn(pooled.v) + " ± " + pooled.ci95.toFixed(1) + "pp" : "",
          off: !pooledOn,
          interval: band != null
        },
        items: houseRows.map(r => ({
          name: r.f,
          color: r.color,
          value: r.latest == null ? "" : sgn(r.latest) + "pp",
          off: !!hidden[r.f]
        }))
      }
    });
  });
  React.useEffect(() => () => {
    if (window.AP_FLOW_BOARD) delete window.AP_FLOW_BOARD[sectionId];
  }, [sectionId]);
  const outliers = band == null ? [] : houseRows.filter(r => r.latest != null && Math.abs(r.latest) > band);
  const outSet = new Set(outliers.map(r => r.f));
  const setAll = v => setHidden(Object.fromEntries(houseRows.map(r => [r.f, v])));
  const shownHouses = houseRows.filter(r => !hidden[r.f]).length;
  const items = [{
    id: pooledId,
    color: "var(--ink)",
    name: "Pooled, " + total + " houses",
    value: band != null ? sgn(pooled.v) + " ± " + pooled.ci95.toFixed(1) : "–"
  }].concat(houseRows.map(r => ({
    id: r.f,
    color: r.color,
    name: r.f,
    value: r.latest == null ? "–" : sgn(r.latest) + "pp",
    note: outSet.has(r.f) ? "outside the interval" : null
  })));
  const quick = [{
    id: "all",
    label: "All",
    title: "Every house on the chart",
    on: shownHouses === total && pooledOn,
    run: () => setHidden({})
  }, {
    id: "pooled",
    label: "Pooled only",
    title: "The cross-house line alone, with its interval",
    on: shownHouses === 0 && pooledOn,
    run: () => setAll(true)
  }];
  if (outliers.length) quick.push({
    id: "out",
    label: "Off the table",
    title: "Only the houses whose own drift sits outside the pooled interval",
    on: pooledOn && shownHouses === outliers.length && houseRows.every(r => !!hidden[r.f] !== outSet.has(r.f)),
    run: () => setHidden(Object.fromEntries(houseRows.map(r => [r.f, !outSet.has(r.f)])))
  });
  return React.createElement("div", {
    className: "sb-legend"
  }, band != null && React.createElement("div", {
    className: "flow-readout"
  }, React.createElement("span", {
    className: "flow-readout-v"
  }, sgn(pooled.v), React.createElement("span", {
    className: "flow-readout-ci"
  }, " \xB1 ", pooled.ci95.toFixed(1)), React.createElement("span", {
    className: "flow-readout-u"
  }, "pp")), React.createElement("span", {
    className: "flow-readout-lab"
  }, Math.abs(pooled.v) <= pooled.ci95 ? React.createElement(React.Fragment, null, "Pooled across ", total, " houses \u2014 ", React.createElement("strong", null, "no drift the interval can separate from zero")) : React.createElement(React.Fragment, null, "Pooled across ", total, " houses \u2014 running ", React.createElement("strong", null, pooled.v > 0 ? "friendlier to Labor" : "friendlier to the Coalition"), " than the table reads their primaries"))), React.createElement(SeriesBoard, {
    id: "flow-" + kind,
    label: "Houses",
    items: items,
    hidden: hidden,
    setHidden: setHidden,
    quick: quick,
    countIds: houseRows.map(r => r.f),
    surfaced: outliers.map(r => ({
      id: r.f,
      color: r.color,
      name: r.f,
      value: sgn(r.latest) + "pp",
      title: r.f + " sits outside the pooled interval \u2014 click to clear its line"
    })),
    foot: React.createElement(React.Fragment, null, "Click a house to draw or clear its line. Each is measured against its own baseline, so a house sitting at zero is behaving as its own first waves did \u2014 not as the election did.")
  }));
}
function FlowDriftPanel({
  rangeId
}) {
  const {
    D,
    rangeDomain,
    buildXTicks,
    monthLabelFull
  } = window.AP;
  const narrow = useNarrow();
  const [hidden, setHidden] = useState({});
  const fd = D.flowDrift;
  if (!fd || !fd.months || !fd.meta) return null;
  const firms = fd.meta.houses || [];
  const POOLED = "Pooled, all houses";
  const KIND = "classic";
  const xDomain = rangeDomain(rangeId);
  const inWin = d => d.x >= xDomain[0] - 0.02 && d.x <= xDomain[1];
  const vals = [1, -1];
  const ptsOf = firm => (fd.houses[firm] || []).map(d => ({
    x: D.mx(d.ym),
    y: d.v
  }));
  const pooledPts = fd.months.map(m => ({
    x: m.x,
    y: m.v
  })).filter(inWin);
  if (pooledPts.length < 2) return null;
  const ciArea = fd.months.filter(m => m.ci95 != null).map(m => ({
    x: m.x,
    y0: m.v - m.ci95,
    y1: m.v + m.ci95
  })).filter(inWin);
  const houseRows = firms.map(f => ({
    f,
    color: houseLeanColour(f),
    pts: ptsOf(f),
    latest: null
  }));
  for (const r of houseRows) {
    const all = ptsOf(r.f);
    r.latest = all.length ? all[all.length - 1].y : null;
    if (!hidden[r.f]) r.pts.forEach(p => vals.push(p.y));
  }
  pooledPts.forEach(p => vals.push(p.y));
  if (!hidden[POOLED]) ciArea.forEach(a => vals.push(a.y0, a.y1));
  const dots = (fd.polls || []).filter(d => !hidden[d.pollster] && d.x >= xDomain[0] - 0.02 && d.x <= xDomain[1]).map(d => ({
    x: d.x,
    y: d.v,
    color: houseLeanColour(d.pollster),
    label: "Drift",
    meta: d
  }));
  dots.forEach(p => vals.push(p.y));
  const series = [];
  if (pooledPts.length > 1) {
    series.push({
      id: POOLED,
      label: POOLED,
      color: "var(--ink)",
      width: 3,
      opacity: hidden[POOLED] ? 0 : 1,
      points: pooledPts
    });
  }
  for (const r of houseRows) {
    if (r.pts.length > 1) {
      series.push({
        id: r.f,
        label: r.f,
        color: r.color,
        width: 1.5,
        opacity: hidden[r.f] ? 0 : 0.4,
        points: r.pts
      });
    }
  }
  if (!series.length) return null;
  const {
    domain,
    ticks
  } = fitDomain(vals, Math.max(...vals.map(Math.abs)) > 4 ? 2 : 1, 0);
  const spine = D.MONTHS.map(ym => ({
    x: D.mx(ym),
    y: 0
  })).filter(inWin);
  const spineYm = D.MONTHS.filter(ym => inWin({
    x: D.mx(ym)
  }));
  const sgn = v => (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(1);
  const lateFirms = firms.filter(f => fd.meta.baseFrom && fd.meta.baseFrom[f] && fd.meta.baseFrom[f] !== fd.meta.anchor);
  return React.createElement("section", {
    className: "ap-flow",
    id: "flow-drift"
  }, React.createElement("div", {
    className: "ap-var-head"
  }, React.createElement("div", null, React.createElement("h3", {
    className: "ap-var-title"
  }, "Preference-flow drift"), React.createElement("p", {
    className: "card-sub"
  }, "How far published 2PPs sit from what the same polls\u2019 primary votes would read as under", " ", fd.meta.table, " \u2013 a pooled read on whether", " ", React.createElement("button", {
    type: "button",
    className: "hi-term",
    onClick: () => window.AP.openTerm && window.AP.openTerm("preference-flows", "Preference-flow drift")
  }, "preferences"), " ", "are still moving the way the election\u2019s ballots did, with every house measured against its own baseline back then."))), React.createElement(FlowLegend, {
    pooledId: POOLED,
    pooled: fd.now,
    houseRows: houseRows,
    hidden: hidden,
    setHidden: setHidden,
    sgn: sgn,
    kind: KIND
  }), React.createElement(TrendChart, {
    key: "flow-" + rangeId,
    height: narrow ? 500 : 300,
    xDomain: xDomain,
    yDomain: domain,
    yTicks: ticks,
    unit: "pp",
    axisFont: narrow ? 28 : 15,
    pad: {
      l: 54,
      r: 20,
      t: 18,
      b: 40
    },
    xTicks: buildXTicks(xDomain[0], xDomain[1]),
    bands: [{
      y0: 0,
      y1: domain[1],
      className: "flow-band-alp"
    }, {
      y0: domain[0],
      y1: 0,
      className: "flow-band-lnp"
    }],
    areas: hidden[POOLED] ? undefined : [{
      id: "ci",
      color: "var(--ink-faint)",
      opacity: 0.18,
      points: ciArea
    }],
    refLines: [{
      y: 0,
      color: "var(--ink-3)"
    }],
    series: series,
    spine: spine,
    scatter: dots,
    pollFacet: "twopp",
    tooltipTitle: i => monthLabelFull(spineYm[i]),
    ariaLabel: "Preference-flow drift over time \u2013 how far published 2PPs sit from what the same polls\u2019 primaries imply under the frozen election flow table, above zero friendlier to Labor",
    fmt: v => v === 0 ? "" : sgn(v)
  }), React.createElement("p", {
    className: "table-hint ap-var-note"
  }, "Above zero \u2013 the red ground \u2013 the published 2PPs are running friendlier to Labor than the frozen table reads their own primaries; below it, friendlier to the Coalition."), React.createElement(HowTo, {
    cls: "table-hint ap-var-note",
    paras: [React.createElement(React.Fragment, null, "Each house\u2019s gap against the table is centred on its own polls in the ", fd.meta.baseDays, " days after the election \u2013 the one moment the electorate\u2019s actual flows are counted, and a house\u2019s fixed allocation habits absorbed into the zero", lateFirms.length > 0 && React.createElement(React.Fragment, null, " \u2013 ", lateFirms.join(", "), " began polling later and anchor on", " ", "their own first waves instead, so their lines read only the drift since they started"), "."), React.createElement(React.Fragment, null, "The pooled line and its band are the cross-house aggregate with the same sample weighting as the aggregates above. Each dot is one published wave\u2019s own gap, in its house\u2019s colour \u2013 hover it to read the wave. A wave that publishes no two-party figure carries no gap, so a house that reports a 2PP only irregularly reads through a thinner line."), React.createElement(React.Fragment, null, "The whole panel is a diagnostic read on published figures: it corrects no other number on this page.")]
  }));
}
function FlowDriftOnPanel({
  rangeId
}) {
  const {
    D,
    rangeDomain,
    buildXTicks,
    monthLabelFull
  } = window.AP;
  const narrow = useNarrow();
  const [hidden, setHidden] = useState({});
  const fd = D.flowDriftOn;
  if (!fd || !fd.months || !fd.meta) return null;
  const firms = fd.meta.houses || [];
  const POOLED = "Pooled, all houses";
  const KIND = "alp-on";
  const xDomain = rangeDomain(rangeId);
  const inWin = d => d.x >= xDomain[0] - 0.02 && d.x <= xDomain[1];
  const vals = [1, -1];
  const ptsOf = firm => (fd.houses[firm] || []).map(d => ({
    x: D.mx(d.ym),
    y: d.v
  }));
  const pooledPts = fd.months.map(m => ({
    x: m.x,
    y: m.v
  })).filter(inWin);
  if (pooledPts.length < 2) return null;
  const ciArea = fd.months.filter(m => m.ci95 != null).map(m => ({
    x: m.x,
    y0: m.v - m.ci95,
    y1: m.v + m.ci95
  })).filter(inWin);
  const houseRows = firms.map(f => ({
    f,
    color: houseLeanColour(f),
    pts: ptsOf(f),
    latest: null
  }));
  for (const r of houseRows) {
    const all = ptsOf(r.f);
    r.latest = all.length ? all[all.length - 1].y : null;
    if (!hidden[r.f]) r.pts.forEach(p => vals.push(p.y));
  }
  pooledPts.forEach(p => vals.push(p.y));
  if (!hidden[POOLED]) ciArea.forEach(a => vals.push(a.y0, a.y1));
  const dots = (fd.polls || []).filter(d => !hidden[d.pollster] && d.x >= xDomain[0] - 0.02 && d.x <= xDomain[1]).map(d => ({
    x: d.x,
    y: d.v,
    color: houseLeanColour(d.pollster),
    label: "Drift",
    meta: d
  }));
  dots.forEach(p => vals.push(p.y));
  const series = [];
  if (pooledPts.length > 1) {
    series.push({
      id: POOLED,
      label: POOLED,
      color: "var(--ink)",
      width: 3,
      opacity: hidden[POOLED] ? 0 : 1,
      points: pooledPts
    });
  }
  for (const r of houseRows) {
    if (r.pts.length > 1) {
      series.push({
        id: r.f,
        label: r.f,
        color: r.color,
        width: 1.5,
        opacity: hidden[r.f] ? 0 : 0.4,
        points: r.pts
      });
    }
  }
  if (!series.length) return null;
  const {
    domain,
    ticks
  } = fitDomain(vals, Math.max(...vals.map(Math.abs)) > 4 ? 2 : 1, 0);
  const spine = D.MONTHS.map(ym => ({
    x: D.mx(ym),
    y: 0
  })).filter(inWin);
  const spineYm = D.MONTHS.filter(ym => inWin({
    x: D.mx(ym)
  }));
  const sgn = v => (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(1);
  return React.createElement("section", {
    className: "ap-flow",
    id: "flow-drift-on"
  }, React.createElement("div", {
    className: "ap-var-head"
  }, React.createElement("div", null, React.createElement("h3", {
    className: "ap-var-title"
  }, "Preference-flow drift, Labor vs One Nation"), React.createElement("p", {
    className: "card-sub"
  }, "The same read on the Labor\u2013One Nation head-to-heads: how far published shares sit from what the same polls\u2019 primaries would read as under a", " ", React.createElement("button", {
    type: "button",
    className: "hi-term",
    onClick: () => window.AP.openTerm && window.AP.openTerm("preference-flows", "Preference flows")
  }, "preference"), " ", "table frozen at the site\u2019s estimated Labor v One Nation flows \u2013 2025 Senate ballots, read through the 2026 lower-house contests where One Nation made the final two."))), React.createElement(FlowLegend, {
    pooledId: POOLED,
    pooled: fd.now,
    houseRows: houseRows,
    hidden: hidden,
    setHidden: setHidden,
    sgn: sgn,
    kind: KIND
  }), React.createElement(TrendChart, {
    key: "flowon-" + rangeId,
    height: narrow ? 500 : 300,
    xDomain: xDomain,
    yDomain: domain,
    yTicks: ticks,
    unit: "pp",
    axisFont: narrow ? 28 : 15,
    pad: {
      l: 54,
      r: 20,
      t: 18,
      b: 40
    },
    xTicks: buildXTicks(xDomain[0], xDomain[1]),
    bands: [{
      y0: 0,
      y1: domain[1],
      className: "flow-band-alp"
    }, {
      y0: domain[0],
      y1: 0,
      className: "flow-band-on"
    }],
    areas: hidden[POOLED] ? undefined : [{
      id: "ci",
      color: "var(--ink-faint)",
      opacity: 0.18,
      points: ciArea
    }],
    refLines: [{
      y: 0,
      color: "var(--ink-3)"
    }],
    series: series,
    spine: spine,
    scatter: dots,
    pollFacet: "twopp",
    tooltipTitle: i => monthLabelFull(spineYm[i]),
    ariaLabel: "Preference-flow drift on Labor-v-One Nation head-to-heads over time \u2013 how far published head-to-head shares sit from frozen preference flows, above zero friendlier to Labor",
    fmt: v => v === 0 ? "" : sgn(v)
  }), React.createElement("p", {
    className: "table-hint ap-var-note"
  }, "Above zero \u2013 the red ground \u2013 the published head-to-heads are running friendlier to Labor than the frozen table reads their own primaries; below it, friendlier to One Nation."), React.createElement(HowTo, {
    cls: "table-hint ap-var-note",
    paras: [React.createElement(React.Fragment, null, "Each house\u2019s gap against the table is centred on its own first waves \u2013 the classic pairing on the panel above can be read at the election, but no count of this pairing exists, so the chart speaks only about drift since each house began."), React.createElement(React.Fragment, null, "The pooled line and its band are the cross-house aggregate with the same sample weighting as the aggregates above. Each dot is one published wave\u2019s own gap, in its house\u2019s colour \u2013 hover it to read the wave. A wave that publishes no head-to-head carries no gap."), React.createElement(React.Fragment, null, "The whole panel is a diagnostic read on published figures: it corrects no other number on this page.")]
  }));
}
function rdEffTbc(p) {
  if (p.conf || p.sampleEff != null || !p.published) return false;
  if (Date.now() - Date.parse(p.published.slice(0, 10)) >= 21 * 86400000) return false;
  const since = Date.parse(p.released) - 90 * 86400000;
  const A = window.AUSPOL;
  return (A.individualPolls || []).concat(A.issuesOnlyPolls || []).some(q => q.pollster === p.pollster && q.sampleEff != null && q.released < p.released && Date.parse(q.released) >= since);
}
function rdEffMissing(p) {
  if (p.conf || p.sampleEff != null || !p.published) return false;
  if (Date.now() - Date.parse(p.published.slice(0, 10)) < 21 * 86400000) return false;
  const rel = Date.parse(p.released);
  const A = window.AUSPOL;
  return (A.individualPolls || []).concat(A.issuesOnlyPolls || []).some(q => q.pollster === p.pollster && q.sampleEff != null && Math.abs(Date.parse(q.released) - rel) < 120 * 86400000);
}
function AllPollsView({
  focus,
  onBack,
  backLabel,
  tppBasis,
  setTppBasis
}) {
  const {
    D
  } = window.AP;
  const {
    ShareBar,
    NetVal,
    tppContests,
    tppFlag,
    ppmContests,
    ppmContestSegs,
    ppmFlag
  } = window;
  const pubBasis = tppBasis === "resp";
  const baseHouse = h => h.replace(/ \((MRP|SMS|pooled)\)$/, "");
  const {
    houses,
    housesDir,
    housesIss,
    housesConf,
    housesAll,
    dirOnlyAll,
    issOnlyAll,
    confOnlyAll
  } = React.useMemo(() => {
    const houses = [];
    D.individualPolls.forEach(p => {
      const b = baseHouse(p.pollster);
      if (!houses.includes(b)) houses.push(b);
    });
    houses.sort();
    const dirOnlyAll = D.directionOnlyPolls || [];
    const housesDir = [...houses];
    dirOnlyAll.forEach(p => {
      const b = baseHouse(p.pollster);
      if (!housesDir.includes(b)) housesDir.push(b);
    });
    housesDir.sort();
    const issOnlyAll = D.issuesOnlyPolls || [];
    const housesIss = [...housesDir];
    issOnlyAll.forEach(p => {
      const b = baseHouse(p.pollster);
      if (!housesIss.includes(b)) housesIss.push(b);
    });
    housesIss.sort();
    const confOnlyAll = D.confidenceOnlyPolls || [];
    const housesConf = [...housesIss];
    confOnlyAll.forEach(p => {
      const b = baseHouse(p.pollster);
      if (!housesConf.includes(b)) housesConf.push(b);
    });
    housesConf.sort();
    return {
      houses,
      housesDir,
      housesIss,
      housesConf,
      housesAll: [...housesConf],
      dirOnlyAll,
      issOnlyAll,
      confOnlyAll
    };
  }, []);
  const FACET_SCOPE = {
    twopp: {
      has: p => (pubBasis ? p.alp != null : p.alpImp != null) || p.tppAlt || p.tppAlt2 || p.tpp3,
      label: "With a 2PP"
    },
    primary: null,
    leadership: {
      has: p => window.ppmContests(p).length > 0 || p.appr && (p.appr.albNet != null || p.appr.taylorNet != null || p.appr.hansonNet != null),
      label: "With leadership numbers"
    },
    direction: {
      has: p => !!p.dir,
      label: "With a direction reading"
    },
    issues: {
      has: p => !!p.iss,
      label: "With issues figures"
    },
    demographics: {
      has: p => !!demPairOf(p, demSplit),
      get label() {
        const s = DEM_SPLITS.find(x => x.id === demSplit);
        return s ? s.scope : "With a breakdown by group";
      }
    }
  };
  const CONTEST_SCOPE = {
    lnponp: {
      has: p => !!p.tppAlt2,
      label: "With an L/NP v ON 2PP"
    },
    "3cp": {
      has: p => !!p.tpp3,
      label: "With a 3-cornered figure"
    }
  };
  const CONS_SCOPE = {
    has: p => !!p.cons,
    label: "With consideration figures"
  };
  const defaultScopeFor = (f, m, cons) => f === "primary" && cons ? true : !FACET_SCOPE[f] ? false : f === "twopp" ? Boolean(CONTEST_SCOPE[m]) || pubBasis : true;
  const confNarrow = useNarrow("(max-width: 600px)");
  const confWide = !confNarrow || !!(window.AP && window.AP.rd);
  const FACETS = [{
    id: "twopp",
    label: "2PP"
  }, {
    id: "primary",
    label: "Primary"
  }, {
    id: "leadership",
    label: "Leadership"
  }, {
    id: "direction",
    label: "Direction"
  }, {
    id: "issues",
    label: "Issues"
  }, ...((D.confidenceOnlyPolls || []).length ? [{
    id: "confidence",
    label: "Confidence"
  }] : [])].filter(f => f.id !== "confidence" || confWide);
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
      k: "p.oth",
      cls: " muted hide-md"
    }
  };
  const FACET_BY_URL = {
    p: "primary",
    l: "leadership",
    d: "direction",
    i: "issues",
    c: "confidence",
    primary: "primary",
    leadership: "leadership",
    direction: "direction",
    issues: "issues",
    confidence: "confidence",
    ...(window.AP.rd ? {
      g: "demographics",
      demographics: "demographics"
    } : {})
  };
  const DEM_BY_URL = {
    a: "age",
    g: "gender",
    e: "education",
    p: "place",
    h: "home",
    n: "income",
    b: "country"
  };
  const MEAS_BY_URL = {
    o: "onp",
    lo: "lnponp",
    "3": "3cp",
    c: "lnp",
    onp: "onp",
    lnponp: "lnponp",
    "3cp": "3cp",
    lnp: "lnp"
  };
  const DEFAULT_MEASURE = window.AP.measureOfMatchup((D.latest || {}).rivalLead);
  const LEAD_BY_URL = {
    a: "alp",
    l: "lnp",
    o: "onp",
    alp: "alp",
    lnp: "lnp",
    onp: "onp"
  };
  const urlInit = (() => {
    const p = new URLSearchParams(window.location.search);
    const get = (...keys) => {
      for (const k of keys) {
        const v = p.get(k);
        if (v != null) return v;
      }
      return null;
    };
    const view = FACET_BY_URL[get("f", "view")] || "twopp";
    const sExplicit = get("s", "scope") != null;
    const meas = MEAS_BY_URL[get("v", "vs")] || DEFAULT_MEASURE;
    const consIn = view === "primary" && get("k") === "1";
    const confBusIn = view === "confidence" && get("b") === "1";
    return {
      q: get("q") || "",
      who: (() => {
        const raw = get("w", "who") || "";
        const mask = archUnpack(raw, URL_HOUSES);
        const known = view === "direction" ? housesDir : view === "issues" ? housesIss : view === "confidence" ? housesConf : houses;
        return (mask ? [...mask] : raw.split(",").map(baseHouse)).filter(h => known.includes(h));
      })(),
      has: (() => {
        const raw = get("h", "has") || "";
        const mask = archUnpack(raw, POLL_TAGS.map(t => t.id));
        return (mask ? [...mask] : raw.split(",")).filter(t => POLL_TAGS.some(pt => pt.id === t));
      })(),
      lead: LEAD_BY_URL[get("l", "lead")] || "all",
      measure: meas,
      cons: consIn,
      confBus: confBusIn,
      range: ["12", "6", "3"].includes(get("t", "when")) ? get("t", "when") : "all",
      facet: view,
      split: DEM_BY_URL[get("g")] || "age",
      scope: sExplicit ? get("s") !== "0" && get("s", "scope") !== "off" : defaultScopeFor(view, meas, consIn),
      scopeExplicit: sExplicit
    };
  })();
  const [scopeSet, setScopeSet] = useState(urlInit.scopeExplicit);
  const chooseScope = v => {
    setScopeSet(true);
    setScope(v);
  };
  const [q, setQ] = useState(urlInit.q);
  const [sel, setSel] = useState(new Set(urlInit.who));
  const [lead, setLead] = useState(urlInit.lead);
  const [measure, setMeasure] = useState(urlInit.measure);
  const [consM, setConsM] = useState(urlInit.cons);
  const [confBus, setConfBus] = useState(urlInit.confBus);
  const [range, setRange] = useState(urlInit.range);
  const [tagSel, setTagSel] = useState(new Set(urlInit.has));
  const [sort, setSort] = useState({
    key: "pub",
    dir: -1
  });
  const [facet, setFacet] = useState(urlInit.facet);
  const [demSplit, setDemSplit] = useState(urlInit.split);
  const [open, setOpen] = useState(null);
  const [pop, setPop] = useState(null);
  const [scope, setScope] = useState(urlInit.scope);
  React.useEffect(() => {
    if (!scopeSet) setScope(defaultScopeFor(facet, measure, consM));
  }, [pubBasis, facet, measure, consM, scopeSet]);
  React.useEffect(() => {
    if (!focus) return;
    setScope(false);
    setQ("");
    setSel(new Set());
    setLead("all");
    setMeasure(DEFAULT_MEASURE);
    setConsM(false);
    setRange("all");
    setTagSel(new Set());
    if (focus.facet) setFacet(focus.facet);
    if (focus.split || focus.facet === "demographics") {
      const want = focus.split || demSplit;
      const fp = D.individualPolls.find(q => q.pollster + "|" + q.released === focus.key);
      const can = s => !!(fp && demPairOf(fp, s));
      setDemSplit(can(want) ? want : DEM_SPLITS.map(s => s.id).find(can) || want);
    }
    if (focus.facet === "confidence") {
      const fp = confOnlyAll.find(q => q.pollster + "|" + q.released === focus.key);
      if (fp && fp.conf) setConfBus(CONF_BUS_LANES.has(fp.conf.k));
    }
    setOpen(focus.key);
  }, [focus]);
  React.useEffect(() => {
    if (!confWide && facet === "confidence") onFacet("twopp");
  }, [confWide, facet]);
  const bodyRef = useRef(null);
  React.useEffect(() => {
    if (!focus || open !== focus.key || !bodyRef.current) return;
    const place = () => {
      if (!bodyRef.current) return;
      const row = bodyRef.current.querySelector("tr.arch-row.open, .rd-ap-row.open, .rd-ap-card.open");
      if (!row) return;
      const d = row.nextElementSibling;
      const pair = d && (d.classList.contains("rd-ap-open") || d.classList.contains("detail-row")) ? d : null;
      const top = row.getBoundingClientRect().top + window.scrollY;
      const h = (pair || row).getBoundingClientRect().bottom + window.scrollY - top;
      const bar = document.querySelector(".tabs.sticky");
      const hw = document.querySelector(".rd-ap-headwrap");
      const barH = bar ? bar.getBoundingClientRect().height : 0;
      const hwTop = hw ? parseFloat(getComputedStyle(hw).top) || 0 : 0;
      const hwH = hw ? hw.offsetHeight : 0;
      const clear = Math.max(barH, hwTop + hwH) + 10;
      let y = top - (window.innerHeight + clear - h) / 2;
      if (y > top - clear) y = top - clear;
      window.scrollTo({
        top: Math.max(0, y),
        behavior: "auto"
      });
    };
    let raf = 0,
      last = -1,
      still = 0;
    const t0 = Date.now();
    const tick = () => {
      raf = 0;
      const row = bodyRef.current && bodyRef.current.querySelector("tr.arch-row.open, .rd-ap-row.open, .rd-ap-card.open");
      const top = row ? row.getBoundingClientRect().top + window.scrollY : -1;
      if (top >= 0 && top !== last) {
        last = top;
        still = 0;
      } else still++;
      place();
      if (still < 2 && Date.now() - t0 < 900) raf = requestAnimationFrame(tick);
    };
    place();
    raf = requestAnimationFrame(tick);
    return () => {
      if (raf) cancelAnimationFrame(raf);
    };
  }, [focus, open, facet]);
  const toggleTag = id => React.startTransition(() => setTagSel(s => {
    const n = new Set(s);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  }));
  const setRangeT = v => React.startTransition(() => setRange(v));
  const setSelT = v => React.startTransition(() => setSel(v));
  const setTagSelT = v => React.startTransition(() => setTagSel(v));
  const onMeasure = React.useCallback(mv => {
    setMeasure(mv);
    setLead("all");
  }, []);
  const onFacet = f => {
    setFacet(f);
    setSort({
      key: "pub",
      dir: -1
    });
    setPop(null);
    if (f !== "primary" && consM) setConsM(false);
    setScopeSet(false);
    setScope(defaultScopeFor(f, f === "twopp" ? measure : DEFAULT_MEASURE, f === "primary" && consM));
    if (f !== "twopp") {
      setLead("all");
      setMeasure(DEFAULT_MEASURE);
    }
  };
  const onSort = key => setSort(s => s.key === key ? {
    key,
    dir: -s.dir
  } : {
    key,
    dir: -1
  });
  const toggleHouse = h => React.startTransition(() => setSel(s => {
    const n = new Set(s);
    n.has(h) ? n.delete(h) : n.add(h);
    return n;
  }));
  const rows = React.useMemo(() => {
    const dirOnly = facet === "direction" ? dirOnlyAll : facet === "issues" ? dirOnlyAll.filter(p => p.iss) : [];
    const issOnly = facet === "issues" ? issOnlyAll : [];
    const confOnly = facet === "confidence" ? window.AP.rd ? confOnlyAll.filter(p => p.conf && CONF_BUS_LANES.has(p.conf.k) === confBus) : confOnlyAll : [];
    const NOW_YEAR = new Date().getFullYear();
    return (facet === "confidence" ? confOnly : [...D.individualPolls, ...dirOnly, ...issOnly]).map(p => {
      const [y, mo] = p.ym.split("-").map(Number);
      const fullDate = `${p.day} ${D.monthName(mo)} ${String(y).slice(2)}`;
      const fieldLabel = p.fieldPending ? "TBC" : y === NOW_YEAR ? p.field : `${p.field} ’${String(y).slice(2)}`;
      const tags = pollTagIds(p);
      const ydv = k => p.yd && p.yd[k] ? p.yd[k].v : null;
      const leanOf = (x, k) => x != null && ydv(k) != null ? +(x - Math.round(ydv(k) * 10) / 10).toFixed(1) : null;
      const leanLnp = pubBasis ? leanOf(p.alpN, "lnp") : leanOf(p.alpImp, "imp");
      const leanOn = pubBasis ? leanOf(p.tppAlt ? p.tppAlt.alp : null, "onp") : leanOf(p.alpOnImp, "onimp");
      const HE = D.houseEffects || {};
      const hfxLnp = (HE[pubBasis ? "tpp" : "synth"] || {})[p.pollster] || null;
      const hfxOn = (HE[pubBasis ? "alp_on" : "synthOn"] || {})[p.pollster] || null;
      const lean = measure === "onp" ? leanOn : measure === "lnp" ? leanLnp : null;
      const hfx = measure === "onp" ? hfxOn : measure === "lnp" ? hfxLnp : null;
      const f1 = v => v != null ? v.toFixed(1) : null;
      const hayParts = [p.pollster, p.field, fullDate, p.sample != null ? String(p.sample) : null, D.monthName(mo) + " " + y, D.monthNameFull(mo) + " " + y, f1(p.alp), f1(p.lnp), lean != null ? (lean > 0 ? "+" : "") + lean.toFixed(1) : null, f1(p.p.alp), f1(p.p.lnp), f1(p.p.grn), f1(p.p.onp), f1(p.p.oth)].filter(Boolean);
      if (p.client && p.client !== "Self-published") {
        hayParts.push(p.client);
        const clientAlias = AP_CLIENT_ALIASES[p.client.toLowerCase()];
        if (clientAlias) hayParts.push(clientAlias);
      }
      if (p.tpp3) hayParts.push(p.tpp3.alp.toFixed(1), p.tpp3.lnp.toFixed(1), p.tpp3.onp.toFixed(1), "3-cornered 3cp");
      if (p.tppAlt) hayParts.push(p.tppAlt.alp.toFixed(1), p.tppAlt.onp.toFixed(1), "alp v on one nation matchup");
      if (p.tppAlt2) hayParts.push(p.tppAlt2.lnp.toFixed(1), p.tppAlt2.onp.toFixed(1), "lnp v on one nation matchup");
      if (p.appr.albNet != null) hayParts.push("albanese " + p.appr.albNet);
      if (p.appr.taylorNet != null) hayParts.push("taylor " + p.appr.taylorNet);
      if (p.appr.hansonNet != null) hayParts.push("hanson " + p.appr.hansonNet);
      if (p.seats && p.seats.p) {
        hayParts.push("seat projection mrp");
        for (const k in p.seats.p) hayParts.push(k + " " + p.seats.p[k].est + " seats");
      }
      if (p.dir) {
        hayParts.push("direction right track wrong track", f1(p.dir.right), f1(p.dir.wrong), f1(p.dir.unsure), (p.dir.net > 0 ? "+" : "") + p.dir.net);
      }
      if (p.iss) {
        hayParts.push("issues salience best party");
        (p.iss.sal || []).concat(p.iss.conc || []).forEach(([lab, v]) => hayParts.push(lab, String(v)));
        const ib = issBestOf(p.iss);
        if (ib) hayParts.push(ib.who, String(ib.v));
      }
      if (p.conf) {
        hayParts.push("confidence economic sentiment consumer business", p.conf.lab, String(p.conf.v));
        if (p.conf.cond != null) hayParts.push("conditions", String(p.conf.cond));
      }
      if (p.sampleEff != null) hayParts.push("eff effective sample", String(p.sampleEff));else if (rdEffMissing(p)) hayParts.push("eff effective sample missing no statement");else if (rdEffTbc(p)) hayParts.push("eff effective sample tbc pending");
      hayParts.push(...tags);
      const hay = hayParts.join(" ").toLowerCase();
      return {
        ...p,
        year: y,
        mo,
        fullDate,
        fieldLabel,
        lean,
        hfx,
        leanLnp,
        leanOn,
        hfxLnp,
        hfxOn,
        pubBasis,
        tags,
        hay: hay + " " + hay.replace(/–/g, "-")
      };
    });
  }, [facet, pubBasis, measure, dirOnlyAll, issOnlyAll, confOnlyAll, confBus]);
  const housesV = facet === "issues" ? housesIss : facet === "confidence" && confOnlyAll.length ? housesConf : facet === "direction" && dirOnlyAll.length ? housesDir : houses;
  const availableTags = new Set();
  rows.forEach(r => r.tags.forEach(tg => availableTags.add(tg)));
  const shownTags = POLL_TAGS.filter(t => availableTags.has(t.id));
  const latestX = D.mx(D.MONTHS[D.MONTHS.length - 1]);
  const dq = React.useDeferredValue(q);
  const ql = dq.trim().toLowerCase();
  const {
    scoping,
    without,
    houseN,
    tagN,
    rangeN,
    houseRank,
    sorted
  } = React.useMemo(() => {
    const x0 = range === "all" ? -Infinity : latestX - Number(range) / 12 - 0.06;
    const scoping = scope && (facet === "primary" && consM ? CONS_SCOPE : facet === "twopp" && CONTEST_SCOPE[measure] || FACET_SCOPE[facet]);
    const TESTS = [["who", p => !sel.size || sel.has(baseHouse(p.pollster))], ["has", p => !tagSel.size || [...tagSel].every(tg => p.tags.includes(tg))], ["lead", p => {
      if (lead === "all") return true;
      const li = archLeadInfo(p, measure, tppBasis);
      return !!li && li.who === lead;
    }], ["when", p => range === "all" || p.x >= x0], ["q", p => !ql || ql.split(/\s+/).every(t => p.hay.includes(t))], ["scope", p => !scoping || scoping.has(p)]];
    const passing = (p, skip) => TESTS.every(([k, f]) => k === skip || f(p));
    const filtered = rows.filter(p => passing(p, null));
    const without = skip => rows.filter(p => passing(p, skip));
    const houseRows = without("who");
    const houseN = {};
    houseRows.forEach(p => {
      const b = baseHouse(p.pollster);
      houseN[b] = (houseN[b] || 0) + 1;
    });
    const tagRows = without("has");
    const tagN = {};
    tagRows.forEach(p => p.tags.forEach(t => {
      tagN[t] = (tagN[t] || 0) + 1;
    }));
    const whenRows = without("when");
    const rangeN = r => r === "all" ? whenRows.length : whenRows.filter(p => p.x >= latestX - Number(r) / 12 - 0.06).length;
    const houseRank = [...housesV].sort((a, b) => (houseN[b] || 0) - (houseN[a] || 0) || a.localeCompare(b));
    const getVal = (p, key) => {
      switch (key) {
        case "date":
          return p.x;
        case "pub":
          return Date.parse(p.published || p.released);
        case "pollster":
          return p.pollster;
        case "sample":
          return p.sample ?? -Infinity;
        case "alp":
          {
            const li = archLeadInfo(p, measure, tppBasis);
            return li ? li.m : -Infinity;
          }
        case "lean":
          return p.lean ?? -Infinity;
        case "hfx":
          return p.hfx ? p.hfx.v : -Infinity;
        case "p.alp":
          return consM ? p.cons && (p.consLoose || p.cons).alp != null ? (p.consLoose || p.cons).alp : -Infinity : p.p.alp;
        case "p.lnp":
          return consM ? p.cons && (p.consLoose || p.cons).lnp != null ? (p.consLoose || p.cons).lnp : -Infinity : p.p.lnp;
        case "p.grn":
          return consM ? p.cons && (p.consLoose || p.cons).grn != null ? (p.consLoose || p.cons).grn : -Infinity : p.p.grn;
        case "p.onp":
          return consM ? p.cons && (p.consLoose || p.cons).onp != null ? (p.consLoose || p.cons).onp : -Infinity : p.p.onp;
        case "p.oth":
          return consM ? p.cons && (p.consLoose || p.cons).oth != null ? (p.consLoose || p.cons).oth : -Infinity : p.p.oth;
        case "appr.albNet":
          return p.appr.albNet != null ? p.appr.albNet : -Infinity;
        case "appr.taylorNet":
          return p.appr.taylorNet != null ? p.appr.taylorNet : -Infinity;
        case "appr.hansonNet":
          return p.appr.hansonNet != null ? p.appr.hansonNet : -Infinity;
        case "ppm.alb":
          {
            const c = ppmContests(p)[0];
            return c && c.alb != null ? c.alb : -Infinity;
          }
        case "dir.right":
          return p.dir ? p.dir.right : -Infinity;
        case "dir.wrong":
          return p.dir ? p.dir.wrong : -Infinity;
        case "dir.unsure":
          return p.dir ? p.dir.unsure : -Infinity;
        case "dir.net":
          return p.dir ? p.dir.net : -Infinity;
        case "iss.topv":
          {
            const t = issTopOf(p.iss);
            return t ? t[1] : -Infinity;
          }
        case "iss.bestv":
          {
            const b = issBestOf(p.iss);
            return b ? b.v : -Infinity;
          }
        case "conf.lab":
          return p.conf && p.conf.lab || "";
        case "conf.v":
          return p.conf ? p.conf.v : -Infinity;
        case "conf.chg":
          return p.conf && p.conf.chg != null ? p.conf.chg : p.conf && p.conf.chgCalc != null ? p.conf.chgCalc : -Infinity;
        case "conf.cond":
          return p.conf && p.conf.cond != null ? p.conf.cond : -Infinity;
        default:
          {
            if (!key.startsWith("dem.")) return 0;
            const pr = demPairOf(p, demSplit);
            return pr && pr.gap[key.slice(4)] != null ? pr.gap[key.slice(4)] : -Infinity;
          }
      }
    };
    const keyed = filtered.map(p => [getVal(p, sort.key), p]);
    keyed.sort((a, b) => {
      const va = a[0],
        vb = b[0];
      if (va < vb) return -sort.dir;
      if (va > vb) return sort.dir;
      return b[1].x - a[1].x;
    });
    const sorted = keyed.map(kv => kv[1]);
    return {
      scoping,
      without,
      houseN,
      tagN,
      rangeN,
      houseRank,
      sorted
    };
  }, [rows, ql, sel, tagSel, lead, range, scope, facet, measure, consM, pubBasis, sort, demSplit, housesV]);
  const PAGE = 40;
  const [limit, setLimit] = useState(PAGE);
  React.useEffect(() => {
    setLimit(PAGE);
  }, [ql, sel, lead, range, tagSel, scope, facet, consM, confBus, sort.key, sort.dir, measure]);
  const openIdx = open ? sorted.findIndex(p => p.pollster + "|" + p.released === open) : -1;
  const shownRows = sorted.slice(0, Math.max(limit, openIdx + 1));
  const fmtConfFig = (v, signed) => (v < 0 ? "−" : signed && v > 0 ? "+" : "") + (Number.isInteger(Math.abs(v)) ? String(Math.abs(v)) : Math.abs(v).toFixed(1));
  const total = rows.length;
  const totalAll = D.individualPolls.length + dirOnlyAll.length + issOnlyAll.length;
  const clearAll = () => {
    setQ("");
    React.startTransition(() => {
      setSel(new Set());
      setLead("all");
      setMeasure(DEFAULT_MEASURE);
      setRange("all");
      setTagSel(new Set());
      setScope(false);
      setPop(null);
      setConsM(false);
    });
  };
  const anyFilter = Boolean(ql || sel.size || lead !== "all" || range !== "all" || tagSel.size);
  const RANGE_LAB = {
    "12": "Last 12 months",
    "6": "Last 6 months",
    "3": "Last 3 months"
  };
  const MEASURE_LAB = {
    lnp: "ALP v L/NP",
    onp: "ALP v ON",
    lnponp: "L/NP v ON",
    "3cp": "3-cornered"
  };
  const HOLDER_LAB = {
    alp: "ALP",
    lnp: "L/NP",
    onp: "ON"
  };
  const pills = [];
  if (ql) pills.push({
    k: "q",
    lab: "“" + q.trim() + "”",
    off: () => setQ("")
  });
  [...sel].forEach(h => pills.push({
    k: "h" + h,
    lab: h,
    off: () => toggleHouse(h)
  }));
  if (range !== "all") pills.push({
    k: "r",
    lab: RANGE_LAB[range],
    off: () => setRangeT("all")
  });
  [...tagSel].forEach(t => pills.push({
    k: "t" + t,
    lab: (POLL_TAG_META[t] || {}).label || t,
    off: () => toggleTag(t)
  }));
  if (lead !== "all") pills.push({
    k: "l",
    lab: HOLDER_LAB[lead] + " ahead",
    off: () => setLead("all")
  });
  if (scoping && facet !== "twopp") pills.push({
    k: "s",
    lab: scoping.label,
    auto: true,
    off: () => chooseScope(false)
  });
  const FACET_BY_ID = {
    primary: "p",
    leadership: "l",
    direction: "d",
    issues: "i",
    confidence: "c",
    demographics: "g"
  };
  const DEM_BY_ID = {
    gender: "g",
    education: "e",
    place: "p",
    home: "h",
    income: "n",
    country: "b"
  };
  const MEAS_BY_ID = {
    lnp: "c",
    onp: "o",
    lnponp: "lo",
    "3cp": "3"
  };
  const LEAD_BY_ID = {
    alp: "a",
    lnp: "l",
    onp: "o"
  };
  React.useEffect(() => {
    const OWNED = ["q", "w", "t", "h", "v", "l", "f", "s", "g", "k", "b", "who", "when", "has", "vs", "lead", "view", "scope"];
    const p = new URLSearchParams(window.location.search);
    OWNED.forEach(k => p.delete(k));
    if (ql) p.set("q", q.trim());
    if (sel.size) p.set("w", archMask(URL_HOUSES, sel));
    if (range !== "all") p.set("t", range);
    if (tagSel.size) p.set("h", archMask(POLL_TAGS.map(t => t.id), tagSel));
    if (measure !== DEFAULT_MEASURE) p.set("v", MEAS_BY_ID[measure]);
    if (lead !== "all") p.set("l", LEAD_BY_ID[lead]);
    if (facet !== "twopp") p.set("f", FACET_BY_ID[facet]);
    if (consM) p.set("k", "1");
    if (confBus && facet === "confidence") p.set("b", "1");
    if (facet === "demographics" && DEM_BY_ID[demSplit]) p.set("g", DEM_BY_ID[demSplit]);
    if (!scope && (FACET_SCOPE[facet] || consM)) p.set("s", "0");
    const qs = p.toString();
    const L = window.location;
    const next = L.pathname + (qs ? "?" + qs : "") + L.hash;
    if (next !== L.pathname + L.search + L.hash) writeUrl("replaceState", next);
  });
  const CSV_COLS = [["Pollster", p => p.pollster], ["Fieldwork", p => p.fieldPending ? "TBC" : p.field], ["Fieldwork end", p => p.released], ["Sample", p => p.sample], ["Effective sample", p => p.sampleEff == null ? "" : p.sampleEff], ["Primary ALP", p => p.p.alp], ["Primary L/NP", p => p.p.lnp], ["Primary GRN", p => p.p.grn], ["Primary ON", p => p.p.onp], ["Primary OTH", p => p.p.oth], ["2PP ALP", p => p.alp], ["2PP L/NP", p => p.lnp], ["ALP v ON", p => p.tppAlt ? p.tppAlt.alp : ""], ["L/NP v ON", p => p.tppAlt2 ? p.tppAlt2.lnp : ""], ["Poll lean", p => p.lean], ["House effect", p => p.hfx ? p.hfx.v : ""], ["PPM Albanese", p => {
    const c = ppmContests(p)[0];
    return c ? c.alb ?? "" : "";
  }], ["PPM Opp. ldr", p => {
    const c = ppmContests(p)[0];
    return c ? c.taylor ?? c.ley ?? "" : "";
  }], ["PPM Hanson", p => {
    const c = ppmContests(p)[0];
    return c ? c.hanson ?? "" : "";
  }], ["Albanese metric", p => p.appr.metricBy ? p.appr.metricBy.alb : ""], ["Opp. ldr metric", p => p.appr.metricBy ? p.appr.metricBy.taylor : ""], ["Hanson metric", p => p.appr.metricBy ? p.appr.metricBy.hanson : ""], ["Albanese net", p => p.appr.albNet], ["Opp. ldr net", p => p.appr.taylorNet], ["Hanson net", p => p.appr.hansonNet], ["Seats ALP", p => p.seats && p.seats.p.alp ? p.seats.p.alp.est : ""], ["Seats L/NP", p => p.seats && p.seats.p.lnp ? p.seats.p.lnp.est : ""], ["Seats GRN", p => p.seats && p.seats.p.grn ? p.seats.p.grn.est : ""], ["Seats ON", p => p.seats && p.seats.p.onp ? p.seats.p.onp.est : ""], ["Seats OTH", p => p.seats && p.seats.p.oth ? p.seats.p.oth.est : ""], ["Right direction", p => p.dir ? p.dir.right : ""], ["Wrong track", p => p.dir ? p.dir.wrong : ""], ["Direction unsure", p => p.dir ? p.dir.unsure : ""], ["Direction net", p => p.dir ? p.dir.net : ""], ["Contains", p => p.tags.join(" ")], ["Groups read from", p => p.grp ? p.grp.r : ""], ...(D.demoGroups || []).flatMap((g, gi) => ["ALP", "L/NP", "GRN", "ON", "OTH"].map((lab, k) => [g + " " + lab, p => {
    const v = p.grp && p.grp.v[gi];
    return v ? v[k] : "";
  }])), ["2025 L/NP now ON", p => p.sw && p.sw.lnp != null ? p.sw.lnp : ""], ["2025 ALP now ON", p => p.sw && p.sw.alp != null ? p.sw.alp : ""], ["2025 GRN now ON", p => p.sw && p.sw.grn != null ? p.sw.grn : ""], ["2025 OTH now ON", p => p.sw && p.sw.oth != null ? p.sw.oth : ""], ["2025 ON still ON", p => p.sw && p.sw.onp != null ? p.sw.onp : ""], ["Top issue", p => {
    const t = issTopOf(p.iss);
    return t ? t[0] : "";
  }], ["Top issue %", p => {
    const t = issTopOf(p.iss);
    return t ? t[1] : "";
  }], ["Best on it", p => {
    const b = issBestOf(p.iss);
    return b ? (ISS_PARTY_META[b.who] || [b.who])[0] : "";
  }], ["Best on it %", p => {
    const b = issBestOf(p.iss);
    return b ? b.v : "";
  }], ["Confidence series", p => p.conf ? p.conf.lab : ""], ["Confidence figure", p => p.conf ? p.conf.v : ""], ["Confidence change", p => p.conf && p.conf.chg != null ? p.conf.chg : p.conf && p.conf.chgCalc != null ? p.conf.chgCalc : ""], ["NAB conditions", p => p.conf && p.conf.cond != null ? p.conf.cond : ""]];
  const exportCsv = () => downloadCsv(`auspol-tracker-polls-${D.latest.updatedISO}.csv`, [CSV_COLS.map(c => c[0]), ...sorted.map(p => CSV_COLS.map(c => c[1](p)))]);
  if (window.AP.rd) return React.createElement("div", {
    className: "view view-allpolls"
  }, React.createElement(RdAllPolls, {
    rows: rows,
    sorted: sorted,
    total: total,
    houses: housesV,
    houseRank: houseRank,
    houseN: houseN,
    tagN: tagN,
    shownTags: shownTags,
    rangeN: rangeN,
    RANGE_LAB: RANGE_LAB,
    facet: facet,
    onFacet: onFacet,
    measure: measure,
    onMeasure: onMeasure,
    tppBasis: tppBasis,
    setTppBasis: setTppBasis,
    consM: consM,
    setConsM: setConsM,
    confBus: confBus,
    setConfBus: setConfBus,
    q: q,
    setQ: setQ,
    sel: sel,
    setSel: setSelT,
    toggleHouse: toggleHouse,
    range: range,
    setRange: setRangeT,
    tagSel: tagSel,
    setTagSel: setTagSelT,
    toggleTag: toggleTag,
    pills: pills,
    clearAll: clearAll,
    sort: sort,
    onSort: onSort,
    open: open,
    setOpen: setOpen,
    focus: focus,
    onBack: onBack,
    backLabel: backLabel,
    exportCsv: exportCsv,
    bodyRef: bodyRef,
    ofTotal: totalAll,
    ofHouses: housesAll.length,
    demSplit: demSplit,
    setDemSplit: setDemSplit
  }));
  return React.createElement("div", {
    className: "view view-allpolls"
  }, React.createElement("div", {
    className: "ap-head"
  }, React.createElement("div", null, React.createElement("h2", {
    className: "card-title"
  }, facet === "confidence" ? "Economic sentiment" : "All polls"), React.createElement("p", {
    className: "card-sub"
  }, facet === "confidence" ? "Every confidence-index release (business and consumer) since the 2025 election" : React.createElement(React.Fragment, null, "Every individual national poll in the archive, ", total, totalAll !== total ? " of " + totalAll : "", " polls from ", housesAll.length, " pollsters,", " ", (() => {
    const src = D.individualPolls;
    const f = src[0],
      l = src[src.length - 1];
    if (!f || !l) return null;
    const lab = ym => {
      const [y, m] = ym.split("-").map(Number);
      return D.monthNameFull(m) + " " + y;
    };
    return lab(f.fym || f.ym) + "–" + lab(l.ym);
  })()))), React.createElement("div", {
    className: "ap-head-side"
  }, React.createElement(TextToggle, {
    value: facet,
    onChange: onFacet,
    options: FACETS,
    ariaLabel: "Archive table view",
    caps: true
  }), React.createElement("span", {
    className: "ap-count"
  }, React.createElement("strong", null, sorted.length), sorted.length !== total ? " of " + totalAll : "", " ", sorted.length === 1 ? "poll" : "polls"))), React.createElement("div", {
    className: "ap-jumps"
  }, React.createElement(TextToggle, {
    value: facet,
    onChange: onFacet,
    options: FACETS,
    ariaLabel: "Archive table view",
    caps: true,
    className: "ap-facet"
  }), React.createElement("span", {
    className: "ap-jumps-count"
  }, React.createElement("strong", null, sorted.length), sorted.length !== total ? " of " + totalAll : "", " ", sorted.length === 1 ? "poll" : "polls")), facet === "twopp" && React.createElement("div", {
    className: "ap-basis-narrow"
  }, React.createElement("span", {
    className: "ap-ctl-group"
  }, React.createElement("span", {
    className: "ap-ctl-lab"
  }, "Basis"), React.createElement(TextToggle, {
    value: tppBasis,
    onChange: setTppBasis,
    options: [{
      id: "imp",
      label: "implied"
    }, {
      id: "resp",
      label: "published"
    }],
    ariaLabel: "Two-party basis",
    caps: true
  }))), React.createElement("div", {
    className: "ap-bar"
  }, React.createElement("div", {
    className: "ap-search"
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
    type: "text",
    value: q,
    onChange: e => setQ(e.target.value),
    autoCorrect: "off",
    spellCheck: false,
    placeholder: "Search anything\u2026",
    "aria-label": "Search polls"
  }), q && React.createElement("button", {
    className: "ap-search-x",
    onClick: () => setQ(""),
    "aria-label": "Clear search"
  }, "\xD7")), React.createElement(FilterPop, {
    id: "who",
    label: "Pollster",
    open: pop,
    setOpen: setPop,
    summary: sel.size === 0 ? null : sel.size === 1 ? [...sel][0] : sel.size + " selected"
  }, React.createElement("div", {
    className: "ap-pop-head"
  }, React.createElement("span", null, housesV.length, " pollsters"), sel.size > 0 && React.createElement("button", {
    className: "ap-clear",
    onClick: () => setSel(new Set())
  }, "Clear")), React.createElement("div", {
    className: "ap-poplist",
    role: "group",
    "aria-label": "Pollsters"
  }, houseRank.map(h => React.createElement(PopRow, {
    key: h,
    on: sel.has(h),
    label: h,
    n: houseN[h] || 0,
    onClick: () => toggleHouse(h)
  })))), React.createElement(FilterPop, {
    id: "when",
    label: "Time",
    open: pop,
    setOpen: setPop,
    summary: range === "all" ? null : RANGE_LAB[range]
  }, React.createElement("div", {
    className: "ap-poplist",
    role: "radiogroup",
    "aria-label": "Time span"
  }, [["all", "Any time"], ["12", "Last 12 months"], ["6", "Last 6 months"], ["3", "Last 3 months"]].map(([id, lab]) => React.createElement(PopRow, {
    key: id,
    radio: true,
    on: range === id,
    label: lab,
    n: rangeN(id),
    onClick: () => setRange(id)
  })))), React.createElement(FilterPop, {
    id: "has",
    label: "Contains",
    open: pop,
    setOpen: setPop,
    summary: tagSel.size === 0 ? null : tagSel.size === 1 ? (POLL_TAG_META[[...tagSel][0]] || {}).label : tagSel.size + " measures"
  }, React.createElement("div", {
    className: "ap-pop-head"
  }, React.createElement("span", null, "What the poll published"), tagSel.size > 0 && React.createElement("button", {
    className: "ap-clear",
    onClick: () => setTagSel(new Set())
  }, "Clear")), React.createElement("div", {
    className: "ap-poplist",
    role: "group",
    "aria-label": "Measures published"
  }, shownTags.map(t => React.createElement(PopRow, {
    key: t.id,
    on: tagSel.has(t.id),
    label: t.label,
    note: t.title,
    n: tagN[t.id] || 0,
    onClick: () => toggleTag(t.id)
  }))), React.createElement("p", {
    className: "ap-pop-foot"
  }, "Selecting two asks for polls carrying both.")), facet === "twopp" && React.createElement("div", {
    className: "ap-2line"
  }, React.createElement(FilterPop, {
    id: "lead",
    label: "Contest",
    open: pop,
    setOpen: setPop,
    summary: [measure !== DEFAULT_MEASURE ? MEASURE_LAB[measure] : null, lead !== "all" ? HOLDER_LAB[lead] + " ahead" : null].filter(Boolean).join(", ") || null
  }, React.createElement("div", {
    className: "ap-pop-head"
  }, React.createElement("span", null, "Two-party contest")), React.createElement("div", {
    className: "ap-poplist",
    role: "radiogroup",
    "aria-label": "Two-party contest"
  }, [DEFAULT_MEASURE === "onp" ? "onp" : "lnp", DEFAULT_MEASURE === "onp" ? "lnp" : "onp", "lnponp", "3cp"].map(m => React.createElement(PopRow, {
    key: m,
    radio: true,
    on: measure === m,
    label: MEASURE_LAB[m],
    n: rows.filter(r => archLeadInfo(r, m)).length,
    onClick: () => onMeasure(m)
  }))), React.createElement("div", {
    className: "ap-pop-head bordered"
  }, React.createElement("span", null, "Held by")), React.createElement("div", {
    className: "ap-poplist",
    role: "radiogroup",
    "aria-label": "Lead held by"
  }, [{
    id: "all",
    label: "Either"
  }].concat({
    lnp: ["alp", "lnp"],
    onp: ["alp", "onp"],
    lnponp: ["lnp", "onp"],
    "3cp": ["alp", "lnp", "onp"]
  }[measure].map(id => ({
    id,
    label: HOLDER_LAB[id]
  }))).map(o => React.createElement(PopRow, {
    key: o.id,
    radio: true,
    on: lead === o.id,
    label: o.label,
    n: o.id === "all" ? without("lead").length : without("lead").filter(r => {
      const li = archLeadInfo(r, measure);
      return li && li.who === o.id;
    }).length,
    onClick: () => setLead(o.id)
  })))), scoping && React.createElement("span", {
    className: "ap-pill auto"
  }, scoping.label, React.createElement("button", {
    type: "button",
    onClick: () => chooseScope(false),
    "aria-label": "Remove filter: " + scoping.label
  }, "\xD7"))), React.createElement("div", {
    className: "ap-bar-end"
  }, React.createElement("span", {
    className: "ap-count"
  }, React.createElement("strong", null, sorted.length), sorted.length !== total ? " of " + totalAll : "", " ", sorted.length === 1 ? "poll" : "polls"), React.createElement("button", {
    className: "ap-export",
    onClick: exportCsv,
    title: "Download these rows as CSV \u2013 exactly the current filters and order",
    "aria-label": "Export " + sorted.length + " polls as CSV"
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
    d: "M12 3v12M12 15l-4-4M12 15l4-4M4 19h16"
  })), "Export CSV"))), pills.length > 0 && React.createElement("div", {
    className: "ap-active"
  }, pills.map(f => React.createElement("span", {
    key: f.k,
    className: "ap-pill" + (f.auto ? " auto" : "")
  }, f.lab, React.createElement("button", {
    type: "button",
    onClick: f.off,
    "aria-label": "Remove filter: " + f.lab
  }, "\xD7"))), pills.length > 1 && React.createElement("button", {
    className: "ap-clear",
    onClick: clearAll
  }, "Clear all")), React.createElement("div", {
    className: "table-wrap ap-wrap"
  }, React.createElement("table", {
    className: "poll-table archive"
  }, React.createElement("caption", {
    className: "sr-only"
  }, "All polls, ", (FACETS.find(f => f.id === facet) || {}).label, " columns \u2013", " ", sorted.length, " of ", facet === "confidence" ? confOnlyAll.length : totalAll, " ", facet === "confidence" ? "releases" : "polls"), React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", {
    scope: "col",
    className: "exp-col",
    "aria-hidden": "true"
  }), React.createElement(ArchSortTh, {
    label: "Pollster",
    k: "pollster",
    sort: sort,
    onSort: onSort,
    className: "ta-l"
  }), React.createElement(ArchSortTh, {
    label: "Fieldwork",
    short: "Field",
    k: "date",
    sort: sort,
    onSort: onSort,
    className: "ta-l"
  }), React.createElement(ArchSortTh, {
    label: "Sample",
    k: "sample",
    sort: sort,
    onSort: onSort,
    className: "hide-md"
  }), React.createElement("th", {
    scope: "col",
    className: "hide-md",
    title: "Effective sample, where the pollster published one in its Australian Polling Council methodology statement"
  }, "n", React.createElement("sub", null, "eff")), facet === "twopp" && React.createElement(React.Fragment, null, React.createElement("th", {
    scope: "col",
    className: "ta-l apub-col hide-md"
  }, React.createElement("button", {
    type: "button",
    className: "th-basis",
    onClick: () => setTppBasis(tppBasis === "imp" ? "resp" : "imp"),
    title: pubBasis ? "Each poll's headline figures exactly as the pollster released them – click to switch to implied 2PP at the 2025 election's preference flows" : "Each poll's primaries read at the 2025 election's preference flows – one fixed table, so the column compares house to house; the wave's own published 2PP sits in its breakdown. Click to switch to the published figures"
  }, pubBasis ? "As published" : React.createElement(React.Fragment, null, "Implied 2PP", " ", React.createElement("span", {
    className: "th-basis-def"
  }, "(default)")), React.createElement("span", {
    className: "th-basis-swap",
    "aria-hidden": "true"
  }, "\u21C4"))), React.createElement(ArchSortTh, {
    label: {
      lnp: "Lead, ALP v L/NP",
      onp: "Lead, ALP v ON",
      lnponp: "Lead, L/NP v ON",
      "3cp": "Lead, 3-cornered"
    }[measure],
    short: "Lead",
    k: "alp",
    sort: sort,
    onSort: onSort
  }), React.createElement(ArchSortTh, {
    label: "Poll lean",
    short: "Lean",
    k: "lean",
    sort: sort,
    onSort: onSort,
    className: "hide-sm"
  }), React.createElement(ArchSortTh, {
    label: "House effect",
    short: "H/fx",
    k: "hfx",
    sort: sort,
    onSort: onSort,
    className: "hide-sm"
  })), facet === "primary" && pOrder.map(id => {
    const c = PCOLS[id];
    return c.k ? React.createElement(ArchSortTh, {
      key: id,
      label: c.label,
      k: c.k,
      sort: sort,
      onSort: onSort,
      className: c.cls ? c.cls.trim() : undefined
    }) : React.createElement("th", {
      key: id,
      scope: "col",
      className: (c.cls || " hide-md").trim()
    }, c.label);
  }), facet === "leadership" && React.createElement(React.Fragment, null, React.createElement(ArchSortTh, {
    label: "Preferred PM",
    k: "ppm.alb",
    sort: sort,
    onSort: onSort,
    className: "ta-l two-pp-col hide-md"
  }), React.createElement(ArchSortTh, {
    label: "Alb net",
    short: "Alb",
    k: "appr.albNet",
    sort: sort,
    onSort: onSort
  }), React.createElement(ArchSortTh, {
    label: "Opp. ldr net",
    short: "Opp",
    k: "appr.taylorNet",
    sort: sort,
    onSort: onSort
  }), React.createElement(ArchSortTh, {
    label: "Hanson net",
    short: "Han",
    k: "appr.hansonNet",
    sort: sort,
    onSort: onSort
  })), facet === "direction" && React.createElement(React.Fragment, null, React.createElement(ArchSortTh, {
    label: "Right direction",
    short: "Right",
    k: "dir.right",
    sort: sort,
    onSort: onSort
  }), React.createElement(ArchSortTh, {
    label: "Wrong track",
    short: "Wrong",
    k: "dir.wrong",
    sort: sort,
    onSort: onSort
  }), React.createElement(ArchSortTh, {
    label: "Unsure",
    k: "dir.unsure",
    className: "hide-md",
    sort: sort,
    onSort: onSort
  }), React.createElement(ArchSortTh, {
    label: "Net",
    k: "dir.net",
    sort: sort,
    onSort: onSort
  })), facet === "issues" && React.createElement(React.Fragment, null, React.createElement(ArchSortTh, {
    label: "Top issue",
    k: "iss.topv",
    sort: sort,
    onSort: onSort,
    className: "ta-l",
    title: "The issue most voters named, and the share naming it"
  }), React.createElement(ArchSortTh, {
    label: "Best on it",
    k: "iss.bestv",
    sort: sort,
    onSort: onSort,
    title: "The party voters trust most on that issue, and its share"
  })), facet === "confidence" && React.createElement(React.Fragment, null, React.createElement(ArchSortTh, {
    label: "Figure",
    k: "conf.v",
    sort: sort,
    onSort: onSort
  }), React.createElement(ArchSortTh, {
    label: "Change",
    short: "Chg",
    k: "conf.chg",
    sort: sort,
    onSort: onSort,
    className: "hide-md",
    title: "Change on the series' previous release \u2013 NAB's rows add its trading-conditions reading"
  })))), React.createElement("tbody", {
    ref: bodyRef
  }, shownRows.map((p, i) => {
    const alpLead = p.alp >= 50;
    const rowId = p.pollster + "|" + p.released;
    const arrived = !!focus && focus.key === rowId;
    const isOpen = open === rowId;
    const colCount = facet === "primary" ? 10 : facet === "leadership" ? 9 : facet === "direction" ? 9 : facet === "issues" ? 8 : facet === "confidence" ? 7 : 9;
    return React.createElement(React.Fragment, {
      key: rowId
    }, React.createElement("tr", {
      className: "poll-row arch-row" + (isOpen ? " open" : "") + (arrived ? " arrived" : ""),
      onClick: () => setOpen(isOpen ? null : rowId)
    }, React.createElement("td", {
      className: "exp-col"
    }, React.createElement("button", {
      className: "exp-btn" + (isOpen ? " open" : ""),
      "aria-label": isOpen ? "Collapse" : "Expand full breakdown",
      "aria-expanded": isOpen
    }, "\u25B8")), React.createElement("td", {
      className: "ta-l pollster-cell"
    }, React.createElement(PollsterName, {
      name: p.pollster,
      url: p.url
    }), React.createElement("span", {
      className: "pollster-mode"
    }, p.client), p.tags.length > 0 && React.createElement("span", {
      className: "poll-tags",
      "aria-label": "Contains " + p.tags.map(id => POLL_TAG_META[id].label).join(", ")
    }, p.tags.map(id => React.createElement("span", {
      key: id,
      className: "ptag t-" + id + (tagSel.has(id) ? " hit" : ""),
      title: POLL_TAG_META[id].title
    }, POLL_TAG_META[id].label)))), React.createElement("td", {
      className: "ta-l muted"
    }, p.fieldPending ? rdFieldTbc(p) : p.fieldLabel), React.createElement("td", {
      className: "num muted hide-md"
    }, p.sample != null ? p.sample.toLocaleString() : "—"), React.createElement("td", {
      className: "num hide-md"
    }, p.sampleEff == null ? React.createElement("span", {
      className: "muted"
    }, "\u2014") : React.createElement("span", {
      title: "Effective sample as published by the pollster (APC methodology statement)"
    }, p.sampleEff.toLocaleString())), facet === "twopp" && React.createElement(React.Fragment, null, React.createElement("td", {
      className: "ta-l apub-col hide-md"
    }, React.createElement(ArchTpp, {
      p: p,
      basis: tppBasis,
      measure: measure
    })), React.createElement("td", {
      className: "num"
    }, React.createElement(ArchLead, {
      p: p,
      measure: measure,
      basis: tppBasis
    })), React.createElement("td", {
      className: "num hide-sm"
    }, p.lean == null ? React.createElement("span", {
      className: "dash",
      title: !["lnp", "onp"].includes(measure) ? "No aggregate on this matchup to hold the poll against" : pubBasis ? "No published figure on this matchup to compare with the aggregate" : "No implied figure this wave, so no lean against the implied aggregate"
    }, "\u2014") : React.createElement("span", {
      className: "arch-lean " + (p.lean > 0.05 ? "alp" : p.lean < -0.05 ? measure === "onp" ? "onp" : "lnp" : "flat"),
      title: (pubBasis ? "Published " : "Implied ") + MEASURE_LAB[measure] + (pubBasis ? " minus the average of the other polls fielded around it" : " minus the implied average of the other polls fielded around it")
    }, p.lean > 0 ? "+" : "", p.lean.toFixed(1))), React.createElement("td", {
      className: "num hide-sm"
    }, p.hfx == null ? React.createElement("span", {
      className: "dash",
      title: !["lnp", "onp"].includes(measure) ? "No cross-pollster consensus on this matchup to measure a house effect against" : pubBasis ? "Too few published-basis polls to measure a house effect" : "Too few implied-basis polls to measure a house effect"
    }, "\u2014") : React.createElement("span", {
      className: "arch-lean " + (p.hfx.v > 0.05 ? "alp" : p.hfx.v < -0.05 ? measure === "onp" ? "onp" : "lnp" : "flat"),
      title: `House effect: this pollster's ${pubBasis ? "" : "implied "}${MEASURE_LAB[measure]} sits ${p.hfx.v > 0 ? "+" : ""}${p.hfx.v.toFixed(1)} pts ${p.hfx.v >= 0 ? "to Labor" : measure === "onp" ? "to One Nation" : "to the Coalition"} against the cross-pollster consensus${pubBasis ? "" : " on the implied basis"} (n=${p.hfx.n})`
    }, p.hfx.v > 0 ? "+" : "", p.hfx.v.toFixed(1)))), facet === "primary" && pOrder.map(id => React.createElement("td", {
      key: id,
      className: "num" + (PCOLS[id].cls || ""),
      style: PCOLS[id].style
    }, p.p[id] != null ? p.p[id].toFixed(1) : "—")), facet === "leadership" && React.createElement(React.Fragment, null, React.createElement("td", {
      className: "two-pp-col share-col hide-md"
    }, ppmContests(p).length === 0 ? React.createElement("span", {
      className: "dash",
      title: "No preferred-PM question this wave"
    }, "\u2014") : React.createElement(ShareBar, {
      segs: ppmContestSegs(ppmContests(p)[0]),
      compact: true,
      flag: ppmFlag(ppmContests(p))
    })), React.createElement("td", {
      className: "num"
    }, React.createElement(ArchApprCell, {
      s: p.appr.alb,
      net: p.appr.albNet,
      metric: p.appr.metricBy && p.appr.metricBy.alb
    })), React.createElement("td", {
      className: "num"
    }, React.createElement(ArchApprCell, {
      s: p.appr.taylor,
      net: p.appr.taylorNet,
      metric: p.appr.metricBy && p.appr.metricBy.taylor
    })), React.createElement("td", {
      className: "num"
    }, React.createElement(ArchApprCell, {
      s: p.appr.hanson,
      net: p.appr.hansonNet,
      metric: p.appr.metricBy && p.appr.metricBy.hanson
    }))), facet === "direction" && React.createElement(React.Fragment, null, React.createElement("td", {
      className: "num",
      style: {
        color: "var(--mood-pos)",
        fontWeight: 600
      }
    }, p.dir ? React.createElement(React.Fragment, null, p.dir.right.toFixed(1), React.createElement(ChgTag, {
      v: p.dir.chg && p.dir.chg.right,
      refDate: p.dir.ref
    })) : React.createElement("span", {
      className: "dash"
    }, "\u2014")), React.createElement("td", {
      className: "num",
      style: {
        color: "var(--mood-neg)",
        fontWeight: 600
      }
    }, p.dir ? React.createElement(React.Fragment, null, p.dir.wrong.toFixed(1), React.createElement(ChgTag, {
      v: p.dir.chg && p.dir.chg.wrong,
      refDate: p.dir.ref
    })) : React.createElement("span", {
      className: "dash"
    }, "\u2014")), React.createElement("td", {
      className: "num muted hide-md"
    }, p.dir && p.dir.unsure > 0 ? p.dir.unsure.toFixed(1) : "—"), React.createElement("td", {
      className: "num"
    }, React.createElement(ArchDirCell, {
      d: p.dir
    }))), facet === "issues" && React.createElement(React.Fragment, null, React.createElement("td", {
      className: "ta-l"
    }, React.createElement(ArchIssTop, {
      iss: p.iss
    })), React.createElement("td", {
      className: "num"
    }, React.createElement(ArchIssBest, {
      iss: p.iss
    }))), facet === "confidence" && React.createElement(React.Fragment, null, React.createElement("td", {
      className: "num",
      style: {
        fontWeight: 600
      }
    }, p.conf ? fmtConfFig(p.conf.v) : React.createElement("span", {
      className: "dash"
    }, "\u2014")), React.createElement("td", {
      className: "num muted hide-md"
    }, p.conf && p.conf.chg != null ? React.createElement(React.Fragment, null, fmtConfFig(p.conf.chg, true), p.conf.cond != null && React.createElement("span", {
      className: "muted"
    }, " (" + fmtConfFig(p.conf.cond) + " cond.)")) : "—"))), isOpen && React.createElement("tr", {
      className: "detail-row"
    }, React.createElement("td", {
      colSpan: colCount
    }, React.createElement(ArchPollDetail, {
      p: p,
      onBack: arrived ? onBack : null,
      backLabel: backLabel
    }))));
  }), sorted.length === 0 && React.createElement("tr", {
    className: "arch-empty"
  }, React.createElement("td", {
    colSpan: facet === "primary" ? 10 : facet === "leadership" ? 9 : facet === "issues" ? 8 : facet === "confidence" ? 7 : 9
  }, "No polls match these filters. ", React.createElement("button", {
    className: "ap-clear",
    onClick: clearAll
  }, "Clear filters")))))), shownRows.length < sorted.length && React.createElement("div", {
    className: "ap-more"
  }, React.createElement("button", {
    type: "button",
    className: "ap-jump",
    onClick: () => setLimit(n => n + PAGE)
  }, "Show ", Math.min(PAGE, sorted.length - shownRows.length), " more"), React.createElement("button", {
    type: "button",
    className: "ap-more-all",
    onClick: () => setLimit(sorted.length)
  }, "Show all ", sorted.length), React.createElement("span", {
    className: "ap-more-n"
  }, shownRows.length, " of ", sorted.length, " shown")), React.createElement("p", {
    className: "table-hint"
  }, "Tap any poll for its full breakdown, Search matches anything in a row,", " ", CANT_HOVER ? "Tap" : "Click", " any column heading to sort."), React.createElement(HowTo, {
    label: "How to read this table",
    paras: [React.createElement(React.Fragment, null, "Dates are fieldwork windows; publication dates sit in the breakdown. \u201C\u2014\u201D means the pollster didn\u2019t publish that measure."), React.createElement(React.Fragment, null, pubBasis ? "“As published” lists each poll’s headline figures exactly as the pollster released them. The lead bar draws the published margin out from a tie line at its centre" : "“Implied 2PP” reads each poll’s primaries at the 2025 election’s preference flows – one fixed table, so the column compares house to house; the wave’s own published 2PP sits in its breakdown. The lead bar draws that implied margin out from a tie line at its centre", " ", "(the L/NP v ON and 3-cornered matchups are the pollsters\u2019 own published figures \u2013 the site prices no implied series for them).", React.createElement("span", {
      className: "hint-wide"
    }, " ", CANT_HOVER ? "Tap" : "Click", " the \u201C", pubBasis ? "As published" : "Implied 2PP", "\u201D heading to switch bases."), React.createElement("span", {
      className: "hint-narrow"
    }, " The Basis switch above the table changes bases.")), React.createElement(React.Fragment, null, React.createElement("strong", null, "Poll lean"), " is the poll\u2019s ", pubBasis ? "published 2PP minus the average" : "implied 2PP minus the implied average", " of the other polls fielded within three weeks of it, weighted as the headline is. ", React.createElement("strong", null, "House effect"), " is how far a pollster systematically sits from the cross-house consensus on ", pubBasis ? "published" : "implied", " 2PP \u2013 pooled from its polls with a 90-day half-life, so its recent methods count for more, and shrunk toward zero while it has published few. The aggregates subtract it, read as of each figure\u2019s own time, and it is a property of the pollster, not of this one poll."), React.createElement(React.Fragment, null, React.createElement("strong", null, "n", React.createElement("sub", null, "eff")), " is the pollster\u2019s own published effective sample, from its Australian Polling Council methodology statement \u2013 Newspoll, YouGov, Essential, DemosAU, RedBridge/Accent, and Fox & Hedgehog publish one; Resolve and Roy Morgan publish none, so a dash there means unpublished, not unknown.")]
  }));
}
function MenuPageView({
  id,
  tppBasis
}) {
  const {
    D
  } = window.AP;
  const [measure, setMeasure] = useState(() => window.AP.measureOfMatchup((D.latest || {}).rivalLead));
  if (window.AP.rd) return React.createElement("div", {
    className: "view view-" + id
  }, id === "disagreement" && React.createElement(RdDisagree, null), id === "leans" && React.createElement(RdHouseLean, {
    measure: measure,
    onMeasure: setMeasure,
    tppBasis: tppBasis
  }), id === "flows" && React.createElement(RdFlows, {
    measure: measure
  }), id === "flows-explained" && React.createElement(RdExplained, null), id === "public-opinion" && React.createElement(RdBeyond, null), id === "changelog" && React.createElement(RdChangelog, null));
  return React.createElement("div", {
    className: "view view-" + id
  }, id === "disagreement" && React.createElement(VariancePanel, {
    facet: "twopp",
    rangeId: "all"
  }), id === "leans" && React.createElement(HouseLeanPanel, {
    rangeId: "all"
  }), id === "flows" && ((D.latest && D.latest.rivalLead) === "alp_on" ? React.createElement(React.Fragment, null, React.createElement(FlowDriftOnPanel, {
    rangeId: "all"
  }), React.createElement(FlowDriftPanel, {
    rangeId: "all"
  })) : React.createElement(React.Fragment, null, React.createElement(FlowDriftPanel, {
    rangeId: "all"
  }), React.createElement(FlowDriftOnPanel, {
    rangeId: "all"
  }))), id === "flows-explained" && React.createElement("div", {
    className: "ex-body",
    dangerouslySetInnerHTML: {
      __html: window.EXPLAINED_ARTICLE || ""
    }
  }), id === "public-opinion" && React.createElement(BtvBody, null), id === "changelog" && React.createElement(ChangelogEntries, null));
}
const CL_KIND = {
  poll: "poll",
  conf: "conf",
  flows: "flows",
  finding: "finding",
  meta: "headline",
  seed: "start"
};
function clLit(s) {
  const out = [];
  const re = /(\d[\d,]*(?:\.\d+)?%?|→)/g;
  let m,
    at = 0,
    k = 0;
  while (m = re.exec(s)) {
    if (m.index > at) out.push(s.slice(at, m.index));
    out.push(React.createElement("span", {
      key: "l" + k++,
      className: m[0] === "→" ? "cl-ar" : "cl-n"
    }, m[0]));
    at = m.index + m[0].length;
  }
  if (at < s.length) out.push(s.slice(at));
  return out;
}
function ChangelogEntries() {
  const {
    D
  } = window.AP;
  const newest = [...(D.changelog || [])].reverse();
  const n = newest.length;
  const since = n ? newest[n - 1].date : null;
  return React.createElement("section", {
    className: "cl-term",
    "aria-label": "Change log entries, newest first"
  }, React.createElement("div", {
    className: "cl-bar"
  }, React.createElement("span", {
    className: "cl-file"
  }, React.createElement("b", null, "data/"), "changelog"), React.createElement("span", {
    className: "cl-live"
  }, React.createElement("i", {
    "aria-hidden": "true"
  }), "recording")), React.createElement("div", {
    className: "cl-body"
  }, React.createElement("p", {
    className: "cl-cmt"
  }, "# ", n, " ", n === 1 ? "entry" : "entries", since ? " since " + since : ""), React.createElement("ol", {
    className: "cl-log"
  }, newest.map((e, i) => {
    const kind = CL_KIND[e.kind] ? e.kind : "meta";
    const rep = i > 0 && newest[i - 1].date === e.date;
    return React.createElement("li", {
      key: i,
      className: "cl-e cl-k-" + kind
    }, React.createElement("time", {
      className: "cl-date" + (rep ? " cl-rep" : ""),
      dateTime: e.date
    }, e.date), React.createElement("span", {
      className: "cl-tag"
    }, CL_KIND[kind]), React.createElement("p", {
      className: "cl-text"
    }, clLit(e.text), e.links ? e.links.map((l, j) => React.createElement(React.Fragment, {
      key: j
    }, " ", React.createElement("a", {
      className: "cl-src",
      href: l.url
    }, l.name, " \u2197"))) : e.url ? React.createElement(React.Fragment, null, " ", React.createElement("a", {
      className: "cl-src",
      href: e.url
    }, "release \u2197")) : null));
  })), React.createElement("p", {
    className: "cl-wait"
  }, React.createElement("b", {
    "aria-hidden": "true"
  }, "\u203A"), "next entry when the next poll or confidence release lands", React.createElement("span", {
    className: "cl-cur",
    "aria-hidden": "true"
  }))));
}
function RdChangelog() {
  return React.createElement("section", {
    className: "rd-sec rd-changelog",
    id: "changelog",
    "aria-labelledby": "rd-clog-t"
  }, React.createElement("div", {
    className: "rd-eyebrow"
  }, React.createElement("h2", {
    className: "rd-title",
    id: "rd-clog-t"
  }, "Changelog"), React.createElement("span", {
    className: "rd-meta"
  }, "What\u2019s moved numbers when")), React.createElement(RdHed, {
    head: "Latest changelog entries",
    dek: React.createElement(React.Fragment, null, "What has moved the aggregate\u2019s two-party preferred estimate, and when each statistical finding appeared or fell away, as well as the four economic-confidence gauges \u2013 recorded entry by entry as new readings land, newest first. Most entries are written by a poll landing \u2013 the ", React.createElement("a", {
      className: "fb-link",
      href: "/feed.xml"
    }, "RSS feed"), " lists each new poll as it is added, with a link to the pollster\u2019s own release.")
  }), React.createElement(ChangelogEntries, null));
}
function infoTerms(D) {
  const L = D.latest,
    prim = D.latest.primary;
  const FT = D.flowTables.onp,
    FB = D.flowTables.onBand;
  const fpc = v => +(100 * v).toFixed(1) + "%",
    fpt = v => String(+(100 * v).toFixed(1));
  const FHB = D.flowHistory && D.flowHistory.fed && D.flowHistory.fed.backtest;
  const fhRange = r => r ? r[0] === r[1] ? r[0].toFixed(1) : r[0].toFixed(1) + "–" + r[1].toFixed(1) : "";
  const fhWord = n => ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"][n] || String(n);
  const onM = L.onImp && L.onImp.ci95 != null ? L.onImp.ci95 : L.onImp ? L.onImp.band : null;
  const counts = {};
  D.individualPolls.forEach(p => {
    counts[p.pollster] = (counts[p.pollster] || 0) + 1;
  });
  const baseHouse = h => h.replace(/ \((MRP|SMS|pooled)\)$/, "");
  const houseCounts = {};
  Object.keys(counts).forEach(h => {
    houseCounts[baseHouse(h)] = (houseCounts[baseHouse(h)] || 0) + counts[h];
  });
  const sources = Object.keys(houseCounts).sort((a, b) => houseCounts[b] - houseCounts[a]).join(", ");
  const dirSources = (() => {
    const polls = D.directionPolls || [],
      n = {};
    polls.forEach(d => {
      n[d.pollster] = (n[d.pollster] || 0) + 1;
    });
    const ymLong = ym => D.monthNameFull(Number(ym.slice(5))) + " " + ym.slice(0, 4);
    const list = a => a.length > 2 ? a.slice(0, -1).join(", ") + ", and " + a[a.length - 1] : a.join(" and ");
    const inactive = (D.directionHousesAll || []).filter(h => /inactive/.test(h)).map(h => h.replace(/ \(inactive\)/, ""));
    const active = Object.keys(n).filter(h => !inactive.includes(h)).sort((a, b) => n[b] - n[a]);
    const top = active[0];
    if (!top) return "";
    const rest = active.slice(1);
    const out = ["Most readings are " + top + (top === "Roy Morgan" ? "’s weekly poll" : "’s") + ": " + n[top] + " of the " + polls.length + " since May 2025."];
    if (rest.length) out.push(list(rest) + " supply the rest.");
    rest.filter(h => n[h] === 1).forEach(h => {
      out.push(h + " has asked it only once, in " + ymLong(polls.find(d => d.pollster === h).ym) + ".");
    });
    inactive.forEach(h => {
      const ym = (D.directionStoppedSince || {})[h];
      out.push(h + " asked it too" + (ym ? " until it became inactive in " + ymLong(ym) : ", but has stopped") + ".");
    });
    return out.join(" ");
  })();
  const SL = D.synthLatest;
  const hl = SL && SL.ci95 != null ? {
    ci: SL.ci95,
    n: SL.n,
    nEff: SL.nEff
  } : {
    ci: L.alp2ppCi95 ?? 0,
    n: L.method.nPolls,
    nEff: L.alp2ppNEff
  };
  const F = v => (+v).toLocaleString("en-AU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  const swP = D.showWorking && D.showWorking.primary;
  const swT = D.showWorking && D.showWorking.tpp;
  const primWork = swP && swP.rows.length ? React.createElement("div", {
    className: "info-work-wrap"
  }, React.createElement("table", {
    className: "info-work"
  }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, "Pollster"), React.createElement("th", null, "Fieldwork"), React.createElement("th", null, "Mid"), React.createElement("th", null, "Published"), React.createElement("th", null, "lean"), React.createElement("th", null, "x\u1D62"), React.createElement("th", null, "d"), React.createElement("th", null, "n\u1D62"), React.createElement("th", null, "m"), React.createElement("th", null, "w\u1D62"))), React.createElement("tbody", null, swP.rows.map(r => React.createElement("tr", {
    key: r.firm + r.fw
  }, React.createElement("td", null, r.firm), React.createElement("td", null, r.fw), React.createElement("td", null, r.mid), React.createElement("td", null, F(r.x)), React.createElement("td", null, F(r.lean)), React.createElement("td", null, F(r.adj)), React.createElement("td", null, r.d), React.createElement("td", null, r.n), React.createElement("td", null, r.m), React.createElement("td", null, F(r.w)))), React.createElement("tr", {
    className: "info-work-sum"
  }, React.createElement("td", {
    colSpan: "10"
  }, "\u03A3w\u1D62 = ", F(swP.sw), ", \u03A3w\u1D62x\u1D62 = ", F(swP.swx), ", the mean is ", F(swP.swx), " \xF7 ", F(swP.sw), " = ", F(swP.mean), " ", "\u2192 ", swP.v.toFixed(1), " for Labor, from the ", swP.k, " polls in the 21 days to ", swP.ref, ".")))), React.createElement("p", {
    className: "info-work-note"
  }, "The five-party check: debiased, the parties sum to ", swP.adjTotal, " ", "(", ["alp", "lnp", "grn", "onp", "oth"].filter(k => swP.parties[k]).map(k => swP.parties[k].adj.toFixed(2)).join(", "), ")", " ", "against ", swP.plainTotal, " unweighted", swP.rescaled ? ` – past the half-point tolerance, so all five are scaled by ${swP.plainTotal} ÷ ${swP.adjTotal}, which is how the Labor figure above lands at ${swP.v.toFixed(1)}.` : " – within the half-point tolerance, so nothing is rescaled.")) : null;
  const tppWork = swT && swT.rows.length ? React.createElement("div", {
    className: "info-work-wrap"
  }, React.createElement("table", {
    className: "info-work"
  }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, "Pollster"), React.createElement("th", null, "Fieldwork"), React.createElement("th", null, "Mid"), React.createElement("th", null, "Published"), React.createElement("th", null, "of pair"), React.createElement("th", null, "lean"), React.createElement("th", null, "x\u1D62"), React.createElement("th", null, "d"), React.createElement("th", null, "n\u1D62"), React.createElement("th", null, "m"), React.createElement("th", null, "w\u1D62"))), React.createElement("tbody", null, swT.rows.map(r => React.createElement("tr", {
    key: r.firm + r.fw
  }, React.createElement("td", null, r.firm), React.createElement("td", null, r.fw), React.createElement("td", null, r.mid), React.createElement("td", null, r.pair), React.createElement("td", null, F(r.x)), React.createElement("td", null, F(r.lean)), React.createElement("td", null, F(r.adj)), React.createElement("td", null, r.d), React.createElement("td", null, r.n), React.createElement("td", null, r.m), React.createElement("td", null, F(r.w)))), React.createElement("tr", {
    className: "info-work-sum"
  }, React.createElement("td", {
    colSpan: "11"
  }, "\u03A3w\u1D62 = ", F(swT.sw), ", \u03A3w\u1D62x\u1D62 = ", F(swT.swx), ", the published figure is ", F(swT.swx), " \xF7 ", F(swT.sw), " = ", F(swT.mean), " ", "\u2192 ", swT.v.toFixed(1), ", from the ", swT.k, " polls in the window."))))) : null;
  const onp = Math.round(prim.onp);
  const acc = D.accuracy;
  const accFirst = acc && acc.cycles[0].year,
    accLast = acc && acc.cycles[acc.cycles.length - 1].year;
  const accGaps = acc ? (D.cycles || []).map(c => c.year).filter(y => y >= accFirst && y <= accLast && !acc.cycles.some(c => c.year === y)) : [];
  const accSpan = acc ? React.createElement(React.Fragment, null, "the ", acc.cycles.length, " elections from ", accFirst, " to ", accLast, " with final polls on record", accGaps.length ? React.createElement(React.Fragment, null, " (none survive for ", accGaps.join(" or "), ")") : null) : null;
  const accShared = acc ? acc.cycles.filter(c => c.n >= 2 && c.sameSide).sort((a, b) => b.absErr - a.absErr)[0] : null;
  const xref = (to, from, label) => React.createElement("button", {
    type: "button",
    className: "hi-term",
    onClick: () => window.AP.openTerm && window.AP.openTerm(to, from)
  }, label);
  const working = children => React.createElement("details", {
    className: "info-working"
  }, React.createElement("summary", null, "Show the working"), children);
  const shrinkK = L.method && L.method.shrinkK || 1.5;
  const shrinkWord = {
    1: "one",
    1.5: "one and a half",
    2: "two",
    3: "three"
  }[shrinkK] || String(shrinkK);
  const shrinkKeep = n => Math.round(100 * n / (n + shrinkK));
  const eff = React.createElement(React.Fragment, null, "n", React.createElement("sub", null, "eff"));
  const lefT = (D.lefTables || []).slice().sort((a, b) => a.year - b.year);
  const lefAll = lefT.map((t, i) => t.bt == null || !lefT[i + 1] ? null : {
    at: lefT[i + 1].year,
    bt: t.bt,
    era: !!t.era,
    fit: t.fit
  }).filter(Boolean);
  const lefMiss = lefAll.filter(m => m.at >= 1984);
  const lefOld = lefAll.filter(m => m.at < 1984);
  const meanAbs = a => a.length ? a.reduce((s, m) => s + Math.abs(m.bt), 0) / a.length : null;
  const lefMean = meanAbs(lefMiss),
    lefOldMean = meanAbs(lefOld);
  const lefMidMean = meanAbs(lefOld.filter(m => m.at >= 1958 && m.fit != null));
  const lefAnchorMax = Math.max(0, ...lefT.filter(t => !t.era && t.anchor != null).map(t => Math.abs(t.anchor)));
  const LPM = (D.lefPollMiss || {}).pre;
  const lefBig = lefMiss.slice().sort((a, b) => Math.abs(b.bt) - Math.abs(a.bt)).slice(0, 3);
  const lefBigText = (() => {
    const yrs = a => a.map(m => m.at).sort((x, y) => x - y).reduce((s, y, i, arr) => s + (i ? i === arr.length - 1 ? arr.length > 2 ? ", and " : " and " : ", " : "") + y, "");
    const size = a => {
      const v = a.map(m => Math.abs(m.bt).toFixed(1)).sort();
      return (v[0] === v[v.length - 1] ? v[0] : v[0] + "–" + v[v.length - 1]) + " points";
    };
    const better = lefBig.filter(m => m.bt < 0),
      worse = lefBig.filter(m => m.bt > 0);
    const parts = [];
    if (better.length) parts.push(yrs(better) + ", when Labor did " + size(better) + " better than projected");
    if (worse.length) parts.push(yrs(worse) + ", when " + (better.length ? "it" : "Labor") + " did " + (better.length ? size(worse).replace(" points", "") : size(worse)) + " worse" + (better.length ? "" : " than projected"));
    return parts.join(", and ");
  })();
  const onSince = (() => {
    const w = D.rivalWalk || [];
    const i = w.findIndex((r, k) => r.who === "alp_on" && (k === 0 || w[k - 1].who !== "alp_on"));
    if (i < 0) return null;
    const [yy, mm] = w[i].ym.split("-").map(Number);
    return D.monthNameFull ? D.monthNameFull(mm) + " " + yy : w[i].ym;
  })();
  const ONS = D.onSources;
  const onsWaves = ONS ? ONS.waves : [];
  const onsYg = [...onsWaves].reverse().find(w => w.pollster === "YouGov") || null;
  const onsWork = onsWaves.length ? React.createElement("div", {
    className: "info-work-wrap"
  }, React.createElement("table", {
    className: "info-work"
  }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, "Poll"), React.createElement("th", null, "Fieldwork"), React.createElement("th", null, "Coalition"), React.createElement("th", null, "Labor"), React.createElement("th", null, "Greens"), React.createElement("th", null, "Others"), React.createElement("th", null, "Kept"), React.createElement("th", null, "Drawn"), React.createElement("th", null, "Table"), React.createElement("th", null, "Published"))), React.createElement("tbody", null, onsWaves.map(w => React.createElement("tr", {
    key: w.pollster + w.date
  }, React.createElement("td", null, w.pollster), React.createElement("td", null, w.date), React.createElement("td", null, w.toOn.lnp), React.createElement("td", null, w.toOn.alp), React.createElement("td", null, w.toOn.grn), React.createElement("td", null, w.toOn.oth), React.createElement("td", null, w.keptPct), React.createElement("td", null, w.drawn.toFixed(1)), React.createElement("td", null, w.implied.toFixed(1)), React.createElement("td", null, w.onp ?? "–"))))), React.createElement("p", {
    className: "info-work-note"
  }, "Coalition to Kept: per cent of each 2025 group now voting One Nation (Kept is One Nation\u2019s own 2025 voters). Drawn: the points of the national vote One Nation has taken from the other groups, at their 2025 weights (Coalition ", ONS.weights.lnp, ", Labor ", ONS.weights.alp, ", Greens ", ONS.weights.grn, ", others and independents", " ", (ONS.weights.oth + ONS.weights.ind).toFixed(2), ", One Nation ", ONS.weights.onp, "). Table: drawn plus kept \u2013 what the poll\u2019s own table adds up to \u2013 beside the One Nation vote it published. DemosAU\u2019s voters who can\u2019t recall a 2025 vote are the rest of its gap.")) : null;
  const DEMO = D.demographics;
  const DEMO_SET_NAME = {
    age: "age",
    generation: "generation",
    gender: "gender",
    education: "education",
    state: "state",
    location: "location",
    housing: "housing",
    language: "language at home",
    working: "work status",
    income: "income"
  };
  const demoSets = ids => {
    const n = ids.map(id => DEMO_SET_NAME[id] || id);
    const s = n.length < 3 ? n.join(" and ") : n.slice(0, -1).join(", ") + ", and " + n[n.length - 1];
    return s.charAt(0).toUpperCase() + s.slice(1);
  };
  const DEMO_ROSTER_NAME = {
    "RedBridge/Accent": "RedBridge",
    "Newspoll (pooled)": "Newspoll",
    "YouGov (MRP)": "YouGov’s MRP",
    "DemosAU (MRP)": "DemosAU’s MRP"
  };
  const demoRoster = DEMO && DEMO.roster && DEMO.roster.length ? React.createElement("div", {
    className: "info-work-wrap"
  }, React.createElement("table", {
    className: "info-work info-work-list"
  }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, "Groups"), React.createElement("th", null, "Pollsters"))), React.createElement("tbody", null, DEMO.roster.flatMap(r => r.lines.map((l, i) => React.createElement("tr", {
    key: r.id + i
  }, React.createElement("td", null, r.lines.length > 1 ? r.label.replace(/^By /, "").replace(/^./, c => c.toUpperCase()) + ": " + l.groups.join(", ") : r.label.replace(/^By /, "").replace(/^./, c => c.toUpperCase())), React.createElement("td", null, l.houses.map(h => DEMO_ROSTER_NAME[h] || h).join(", "))))), D.demoIncome ? React.createElement("tr", {
    key: "income"
  }, React.createElement("td", null, "Income"), React.createElement("td", null, D.demoIncome.roster.map(h => DEMO_ROSTER_NAME[h] || h).join(", "))) : null)), React.createElement("p", {
    className: "info-work-note"
  }, "Every pollster whose polls have counted for each group this term, most polls first.")) : null;
  const demoWork = DEMO && DEMO.polls && DEMO.polls.length ? React.createElement("div", {
    className: "info-work-wrap"
  }, React.createElement("table", {
    className: "info-work info-work-list"
  }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, "Poll"), React.createElement("th", null, "Fieldwork"), React.createElement("th", null, "Groups"))), React.createElement("tbody", null, DEMO.polls.map(p => React.createElement("tr", {
    key: p.pollster + p.dateLabel
  }, React.createElement("td", null, p.pollster), React.createElement("td", null, p.dateLabel), React.createElement("td", null, demoSets(p.sets)))))), React.createElement("p", {
    className: "info-work-note"
  }, "The polls in the six-week window, newest first. A poll\u2019s weight is its sample, halving every 14 days and fading out by day 42; a pollster with several polls in the window counts for the square root of their number.")) : null;
  const ISS = D.issues;
  const ISS_OPT = {
    alp: "Labor",
    lnp: "the Coalition",
    onp: "One Nation",
    grn: "the Greens",
    oth: "someone else",
    equal: "all about equal",
    none: "none of these",
    unsure: "not sure"
  };
  const issPhrase = id => ({
    col: "the cost of living",
    economy: "economic management",
    climate: "climate change",
    security: "national security"
  })[id] || (ISS.labels[id] || id).toLowerCase();
  const issGaps = ISS && ISS.list ? ISS.list.filter(it => it.imp && it.imp.gap).map(it => {
    const [a, b] = it.imp.gap.houses,
      flip = a !== "RedBridge";
    return {
      id: it.id,
      label: it.label,
      hi: flip ? b : a,
      lo: flip ? a : b,
      v: flip ? -it.imp.gap.v : it.imp.gap.v
    };
  }) : [];
  const gapUp = [...issGaps].sort((a, b) => b.v - a.v)[0],
    gapDown = [...issGaps].sort((a, b) => a.v - b.v)[0];
  const issWork = ISS && ISS.polls && ISS.polls.length ? React.createElement("div", {
    className: "info-work-wrap"
  }, React.createElement("table", {
    className: "info-work info-work-list"
  }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, "Poll"), React.createElement("th", null, "Fieldwork"), React.createElement("th", null, "Answers offered"))), React.createElement("tbody", null, ISS.polls.map(p => React.createElement("tr", {
    key: p.pollster + p.dateLabel
  }, React.createElement("td", null, p.pollster), React.createElement("td", null, p.dateLabel), React.createElement("td", null, (p.options || []).map(o => o === "unsure" ? {
    Resolve: "undecided",
    YouGov: "don’t know",
    Ipsos: "don’t know",
    DemosAU: "don’t know"
  }[p.pollster] || "not sure" : ISS_OPT[o] || o).join(", ")))))), React.createElement("p", {
    className: "info-work-note"
  }, "The polls in the six-week window, newest first. A poll\u2019s weight is its sample, halving every 14 days and fading out by day 42; a pollster with several polls in the window counts for the square root of their number.", ISS.leanMax ? React.createElement(React.Fragment, null, " The largest lean taken off a three-party share today is ", ISS.leanMax.house, "\u2019s on ", ISS_OPT[ISS.leanMax.party], "\u2019s share for ", issPhrase(ISS.leanMax.issue), ":", " ", ISS.leanMax.v > 0 ? "+" : "−", Math.abs(ISS.leanMax.v).toFixed(1), " points.") : null), issGaps.length ? React.createElement(React.Fragment, null, React.createElement("table", {
    className: "info-work info-work-list"
  }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, "Issue"), React.createElement("th", null, "RedBridge minus Ipsos, points"))), React.createElement("tbody", null, issGaps.map(g => React.createElement("tr", {
    key: g.id
  }, React.createElement("td", null, g.label), React.createElement("td", null, g.v > 0 ? "+" : g.v < 0 ? "−" : "", Math.abs(g.v).toFixed(1)))))), React.createElement("p", {
    className: "info-work-note"
  }, "Each poll\u2019s gap to the other pollster\u2019s polls in the four weeks either side, averaged over every poll so far with a weight that halves every 90 days. Each pollster\u2019s figures move half the gap toward the other\u2019s before they are pooled.")) : null) : null;
  const pc = v => v == null ? "–" : (100 * v).toFixed(1);
  const lefWork = lefT.length ? React.createElement("div", {
    className: "info-work-wrap"
  }, React.createElement("table", {
    className: "info-work"
  }, React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, "Election"), React.createElement("th", null, "Greens"), React.createElement("th", null, "One Nation"), React.createElement("th", null, "Others"), React.createElement("th", null, "Miss next time"))), React.createElement("tbody", null, lefT.map((t, i) => React.createElement("tr", {
    key: t.year
  }, React.createElement("td", null, t.year), t.era ? React.createElement("td", {
    colSpan: "3"
  }, [["dlp", "DLP"], ["dem", "Democrats"], ["oth", "others"]].filter(([k]) => t[k] != null).map(([k, nm]) => pc(t[k]) + " " + nm + " (" + (t.assumed === k || t.year === 1955 && k === "dlp" ? "assumed" : t.fit === k ? "fitted" : "fixed") + ")").join(", ")) : t.minor != null ? React.createElement("td", {
    colSpan: "3"
  }, pc(t.minor), " (all minor parties)") : React.createElement(React.Fragment, null, React.createElement("td", null, pc(t.grn)), React.createElement("td", null, pc(t.onp)), React.createElement("td", null, pc(t.oth))), React.createElement("td", null, t.bt == null || !lefT[i + 1] ? "–" : (Math.abs(t.bt) < 0.005 ? "" : t.bt > 0 ? "+" : "−") + Math.abs(t.bt).toFixed(2) + " at " + lefT[i + 1].year))))), React.createElement("p", {
    className: "info-work-note"
  }, "Per cent of each group\u2019s preferences reaching Labor against the Coalition. The miss is the table applied to the next election\u2019s actual primary votes, minus that election\u2019s official 2PP, in points for Labor (before 1984, an estimated 2PP). A party a table never counted (One Nation in 1996) is read at that table\u2019s \u201Cothers\u201D flow. In the rows to 1984, \u201Cfitted\u201D is the flow solved to match that election\u2019s official result, \u201Cfixed\u201D and \u201Cassumed\u201D are set, not measured.")) : null;
  const RD = !!(window.AP && window.AP.rd);
  const headFig = L.rivalLead === "alp_on" && L.onImp ? {
    a: L.onImp.a,
    b: L.onImp.b,
    rival: "One Nation"
  } : SL ? {
    a: SL.alp,
    b: SL.lnp,
    rival: "the Coalition"
  } : null;
  const andList = a => a.length > 2 ? a.slice(0, -1).join(", ") + ", and " + a[a.length - 1] : a.join(" and ");
  const numWord = n => ({
    2: "two",
    3: "three",
    4: "four",
    5: "five",
    6: "six"
  })[n] || String(n);
  const UND = {};
  (D.undecided && D.undecided.series || []).forEach(s => {
    UND[s.id] = s;
  });
  const undWho = id => UND[id] && UND[id].houses && UND[id].houses.length ? andList(UND[id].houses) : null;
  const undVerb = (id, one, many) => UND[id] && UND[id].houses && UND[id].houses.length > 1 ? many : one;
  const firmPool = numWord(D.firmness && D.firmness.pool || 3);
  const agePool = numWord(D.undecided && D.undecided.softAge && D.undecided.softAge.pool || 3);
  const verdict = RD ? {
    herd: "Tighter than chance",
    ok: "Within chance",
    mild: "A little beyond chance",
    wide: "Well beyond chance"
  } : {
    herd: "Herded",
    ok: "Chance-consistent",
    mild: "Mild divergence",
    wide: "Real disagreement"
  };
  const faqs = [{
    id: "what-am-i-looking-at",
    q: "What am I looking at?",
    a: React.createElement(React.Fragment, null, "In the main chart, each dot is one published poll, placed at the midpoint of its fieldwork. The line is a monthly average of the polls, weighted by sample size and adjusted for each pollster\u2019s ", xref("house-effect", "what am i looking at", "lean"), ", with its", " ", xref("interval", "what am i looking at", "95% interval"), " shaded around it. Where two bands overlap, the polls can\u2019t separate the parties that month. The line\u2019s points sit mid-month, so late in a month the newest dots run past its end, though they\u2019re already counted in it. The figure at the top comes from the last three weeks of polls (see", " ", xref("weighted-aggregate", "what am i looking at", "Weighted aggregate"), "), so it moves with every poll. Other charts follow the same pattern. A dash (\u2014) in a table means the pollster didn\u2019t ask that question.")
  }, {
    id: "where-does-data-come-from",
    q: "Where do the numbers come from?",
    a: React.createElement(React.Fragment, null, "From the pollsters: every national voting-intention poll published since the May 2025 election, from these ", Object.keys(houseCounts).length, " houses, most polls first:", " ", sources, ". A pollster\u2019s MRP or SMS polls count under its own name. All polls files each one with its fieldwork dates, sample size, a link to the release and, where one exists, its", " ", xref("apc-statement", "where does data come from", "APC statement"), ". Past cycles holds every term back to 1972.")
  }, {
    id: "headline-how",
    q: "How is the headline worked out?",
    a: React.createElement(React.Fragment, null, "It averages the last three weeks of polls, counting newer and larger polls for more, after taking out each pollster\u2019s usual lean (see", " ", xref("weighted-aggregate", "how is the headline worked out", "Weighted aggregate"), "). Rather than average the pollsters\u2019 own two-party figures, each worked out a different way, the two-party figure reads every poll\u2019s primary votes through one fixed", " ", xref("preference-flows", "how is the headline worked out", "preference table"), " (see", " ", xref("implied-2pp", "how is the headline worked out", "Implied 2PP"), "). The headline follows the rival Labor is doing worse against", headFig ? React.createElement(React.Fragment, null, ": today ", headFig.rival, ", at ", headFig.a.toFixed(1), "\u2013", headFig.b.toFixed(1)) : null, ".")
  }, {
    id: "how-wrong-are-the-polls",
    q: "How accurate are the polls?",
    a: acc ? React.createElement(React.Fragment, null, "The ", xref("interval", "how accurate are the polls", "95% interval"), " says how far chance alone could put a figure off: \xB1", hl.ci.toFixed(1), " points on each party\u2019s share for Labor against the Coalition today. Past elections show the rest. The", " ", React.createElement("button", {
      type: "button",
      className: "hi-term",
      onClick: () => window.AP.gotoFinalPolls && window.AP.gotoFinalPolls()
    }, "How the final polls have done"), " ", "panel in Past cycles scores each pollster\u2019s last two-party figure in the", " ", acc.windowDays, " days before polling day against the result. Across ", accSpan, ", the final polls missed by ", acc.meanAbs, " points on average, and by", " ", Math.abs(acc.worstCycle.err), " at worst, in ", acc.worstCycle.year, ".", accShared ? React.createElement(React.Fragment, null, " In ", accShared.year, " all ", accShared.n, " houses missed on the same side, by", " ", accShared.absErr, ".") : null, " Unfortunately, no aggregate can see an error every pollster shares, which is why the interval never claims to cover it.") : React.createElement(React.Fragment, null, "The ", xref("interval", "how accurate are the polls", "95% interval"), " says how far chance alone could put a figure off. The", " ", React.createElement("button", {
      type: "button",
      className: "hi-term",
      onClick: () => window.AP.gotoFinalPolls && window.AP.gotoFinalPolls()
    }, "How the final polls have done"), " ", "panel in Past cycles scores each pollster\u2019s last two-party figure of the campaign against the result, election by election, house by house.")
  }, {
    id: "is-this-a-forecast",
    q: "Is it a forecast? What would it mean in seats?",
    a: React.createElement(React.Fragment, null, "No to both. Everything here describes where opinion stands now, from polls already published, and final polls have missed past results", acc ? React.createElement(React.Fragment, null, " by ", acc.meanAbs, " points on average") : null, ". Turning a national figure into seats would assume the swing is the same everywhere. With One Nation near ", onp, "% of the primary vote, that fails in exactly the seats that would decide the election: a large minor party wins where its vote is concentrated, and a national figure can\u2019t see where that is. Where a pollster modelled seats one by one, its poll carries the ", xref("mrp", "is it a forecast", "MRP"), " tag in All polls.")
  }, {
    id: "why-2pp-headline",
    q: "Why lead with two-party preferred?",
    a: React.createElement(React.Fragment, null, "Because seats are decided between the final two candidates. Preferences are distributed until one candidate has a majority, so \u201Cwho\u2019s ahead\u201D is a", " ", xref("two-party-preferred", "why lead with two-party preferred", "two-party"), " question that first preferences alone can\u2019t answer. With One Nation near ", onp, "% of the primary vote, the two views of the race are far apart, so the", " ", xref("primary-vote", "why lead with two-party preferred", "primary vote"), " has its own section.")
  }, {
    id: "newest-poll-not-headline",
    q: "Why doesn’t the newest poll match the headline?",
    a: React.createElement(React.Fragment, null, "Usually neither is wrong. A poll is one pollster\u2019s reading of one week, and chance alone can put it off by its ", xref("margin-of-error", "newest poll", "margin of error"), ", so two honest polls of an unchanged electorate will differ too. The headline pools every recent poll after removing each pollster\u2019s", " ", xref("house-effect", "newest poll", "house effect"), ", its habit of leaning one way. One poll moves it by its weight, not its news value: its", " ", xref("aggregate-effect", "newest poll", "aggregate effect"), " shows how much.", " ", xref("poll-disagreement", "newest poll", "Poll disagreement"), " tests whether the polls differ by more than chance allows.")
  }, {
    id: "more-menu-figures",
    q: "What are the figures in the More menu?",
    a: React.createElement(React.Fragment, null, "Each page there is listed under the headline it opens with, and beside it the number that headline rests on, as the page prints it. For", " ", xref("poll-disagreement", "more menu", "Poll disagreement"), ", how widely the polls of the party they disagree on most are spread, as a multiple of what chance alone would produce. For Pollster leans, the ", xref("house-lean", "more menu", "lean"), " the headline names, in points, with + towards Labor. For Respondent-allocated preference flows, the move the headline reports. A headline that reports no single number has none beside it.")
  }];
  const method = [{
    id: "weighted-aggregate",
    term: "Weighted aggregate",
    body: React.createElement(React.Fragment, null, "How the headline and every other current figure are built. It averages the recent polls, giving more weight to newer and larger ones, after removing each pollster\u2019s", " ", xref("house-effect", "weighted aggregate", "house effect"), ".", React.createElement("span", {
      className: "info-p"
    }, React.createElement("b", null, "Recency."), " A poll\u2019s weight halves every seven days, and it fades out over its third week, leaving the window on day 21. So the figure can move on a day with no new poll, as newer polls take over from older ones."), React.createElement("span", {
      className: "info-p"
    }, React.createElement("b", null, "Size."), " Larger samples count for more. Where a pollster publishes an ", xref("effective-sample", "weighted aggregate", "effective sample"), ", that figure is used. Otherwise the raw sample is discounted by 1.6, roughly what weighting costs the pollsters that do publish, and capped at 3,000."), React.createElement("span", {
      className: "info-p"
    }, React.createElement("b", null, "Repeat polls."), " A pollster with several polls in the window counts for the square root of their number, so three weekly Roy Morgan polls count as 1.7, not 3."), React.createElement("span", {
      className: "info-p"
    }, React.createElement("b", null, "Exclusions."), " These stay in the archive but count towards no aggregate. Roy Morgan\u2019s SMS polls have a strong selection bias. Releases that combine a pollster\u2019s polls which already count would count those voters twice: Newspoll\u2019s quarterly tables, Roy Morgan\u2019s seven-month release, and DemosAU\u2019s 2026 models (MRP), whose fieldwork contains DemosAU\u2019s own regular polls and which are taken to reuse their respondents. EMRS\u2019s polls are of Tasmania only, and RedBridge\u2019s March 2026 super-poll published breakdowns but no national figures."), React.createElement("span", {
      className: "info-p"
    }, React.createElement("b", null, "Sparse measures."), " Measures polled about once a week or less use a six-week window: favourability, Hanson\u2019s approval, preferred prime minister, the One Nation split, the vote by group, the issues, and decidedness. There a poll\u2019s weight halves every 14 days."), React.createElement("span", {
      className: "info-p"
    }, React.createElement("b", null, "Monthly lines."), " Each chart\u2019s line uses the same method without the recency weighting: one point per calendar month, from that month\u2019s polls. Past cycles draws every earlier term the same way. A few measures depart from all this, and their sections say how."), working(React.createElement(React.Fragment, null, React.createElement("span", {
      className: "info-p"
    }, "The headline is \u03A3w\u1D62x\u1D62 \xF7 \u03A3w\u1D62 over the polls in the 21-day window, where x\u1D62 is a poll\u2019s figure minus its house effect and w\u1D62 = n\u1D62 \xD7 2^(\u2212d/7) \xD7 t(d) \xF7 \u221Am."), React.createElement("span", {
      className: "info-p"
    }, React.createElement("b", null, "n\u1D62"), " is the poll\u2019s sample: its published effective sample \xD7 1.6 (the design factor) where the pollster publishes one \u2013 Newspoll, YouGov, Essential, DemosAU, RedBridge/Accent, and Fox & Hedgehog do \u2013 otherwise its raw sample capped at 3,000, or 1,200 if no sample is given. ", React.createElement("b", null, "d"), " is the poll\u2019s age in days, counted from its fieldwork midpoint. ", React.createElement("b", null, "t(d)"), " is 1 up to day 14, then a half-cosine taper to 0 at day 21. ", React.createElement("b", null, "m"), " is the number of polls that pollster has in the window. The window\u2019s effective sample is (\u03A3w\u1D62)\xB2 \xF7 \u03A3w\u1D62\xB2. If the window is empty, the last monthly point stands in. The six-week window doubles every timescale: half-life 14 days, taper from day 28 to day 42."), React.createElement("span", {
      className: "info-p"
    }, React.createElement("b", null, "Worked example: the Labor primary."), " Each party\u2019s primary is estimated the same way. The five are rescaled only if their total sits more than half a point from the plain-average total, so a real shortfall from undecided voters is kept."), primWork, React.createElement("span", {
      className: "info-p"
    }, React.createElement("b", null, "Worked example: the published 2PP."), " A pair published with undecided voters still inside it is rebased to 100 first. A pollster that publishes no pair adds no row."), tppWork)))
  }, {
    id: "house-effect",
    term: "House effect",
    body: React.createElement(React.Fragment, null, "A pollster\u2019s consistent lean relative to the others. Each of its polls is compared with other pollsters\u2019 polls taken around the same time, and the gaps are pooled with a 90-day half-life, so the lean tracks the pollster\u2019s current methods. A lean measured from few polls is shrunk toward zero, as if joined by ", shrinkWord, " more polls sitting exactly on the others: a pollster with one recent poll keeps ", shrinkKeep(1), "% of its measured lean, one with four keeps ", shrinkKeep(4), "%, and one with ten keeps ", shrinkKeep(10), "%. That setting best predicts each new poll from the polls before it. Each figure gets its own lean, since a pollster that leans to Labor on the two-party figure need not on a primary vote. The aggregate subtracts the lean as it stood at the time of each figure.", " ", "The Pollster leans page, in the More menu, shows each pollster\u2019s ", xref("house-lean", "house effect", "house lean"), ".", working(React.createElement("span", {
      className: "info-p"
    }, "A pollster\u2019s lean is \u03A3v\u2C7Cg\u2C7C \xF7 (\u03A3v\u2C7C + ", shrinkK, ") over its polls, where g\u2C7C is a poll\u2019s gap to the sample-weighted average of other pollsters\u2019 polls within 28 days of it (at least three of them), and v\u2C7C = 2^(\u2212a/90), with a the poll\u2019s age in days when the lean is read.")))
  }, {
    id: "monthly-average",
    term: "Monthly average",
    body: React.createElement(React.Fragment, null, "What a contest gets when too few pollsters ask it to measure their", " ", xref("house-effect", "monthly average", "house effects"), ": a plain average of each month\u2019s polls, with no adjustments. The two-party section says which kind it is showing, so an unadjusted average is never mistaken for the adjusted one.")
  }, {
    id: "interval",
    term: "95% interval",
    body: React.createElement(React.Fragment, null, "How far a figure could plausibly be off by chance. For the two-party figure against the Coalition today, that\u2019s \xB1", hl.ci.toFixed(1), " points on each party\u2019s share, and \xB1", (2 * hl.ci).toFixed(1), " on the lead: anything that moves one share moves the gap between them twice as far. The interval takes the larger of two measures: how much the polls in the window disagree, and how much chance alone would scatter them if they all agreed. So it widens when the pollsters split, and never claims more precision than their samples allow.", React.createElement("span", {
      className: "info-p"
    }, "Unfortunately, it can\u2019t see an error every poll shares. When the whole industry leans one way", accShared ? React.createElement(React.Fragment, null, ", as all ", accShared.n, " houses did in ", accShared.year) : null, ", the interval has no way to know."), working(React.createElement(React.Fragment, null, React.createElement("span", {
      className: "info-p"
    }, "1.96 \xD7 the larger of two standard errors, both taken on the weights w\u1D62 of the ", xref("weighted-aggregate", "95% interval", "weighted aggregate"), "."), React.createElement("span", {
      className: "info-p"
    }, React.createElement("b", null, "Spread:"), " \u221A(\u03A3w\u1D62(x\u1D62 \u2212 x\u0304)\xB2 \xF7 \u03A3w\u1D62 \xF7 (nEff \u2212 1)). This is the polls\u2019 scatter around their weighted mean x\u0304, where nEff is the", " ", xref("effective-sample", "95% interval", "effective sample"), "."), React.createElement("span", {
      className: "info-p"
    }, React.createElement("b", null, "Sampling floor:"), " \u221A(\u03A3w\u1D62\xB2 \xD7 1.6 \xD7 p\u0302(1\u2212p\u0302) \xF7 n\u1D62) \xF7 \u03A3w\u1D62. Here p\u0302 is the aggregate\u2019s own share, and 1.6 is the design effect of a weighted panel."))))
  }, {
    id: "margin-of-error",
    term: "Margin of error",
    body: React.createElement(React.Fragment, null, "How far a single poll can miss purely because it surveyed a sample rather than everyone. A thousand respondents carry about \xB13 points at 95% confidence, and it takes four times the interviews to halve that. It covers chance and nothing else: skewed samples, turnout assumptions and a pollster\u2019s methods sit outside it. Pooling polls narrows the chance part, which is why the two-party ", xref("interval", "margin of error", "95% interval"), " ", "(\xB1", hl.ci.toFixed(1), " today) is tighter than one poll\u2019s \xB13. The part every pollster shares doesn\u2019t shrink at all.", L.onImp ? React.createElement(React.Fragment, null, " The implied Labor v One Nation figure\u2019s margin adds one more doubt, about", " ", "its ", xref("fp-flows", "margin of error", "flow table"), ", so it is wider than the polls\u2019", " ", "alone.") : null)
  }, {
    id: "effective-sample",
    term: "Effective sample",
    body: React.createElement(React.Fragment, null, "What a sample is worth once weighting is counted. A pollster\u2019s", " ", xref("apc-statement", "effective sample", "APC statement"), " gives one for each poll, shown as ", eff, " beside its sample. The window has one too: today the two-party window\u2019s", " ", hl.n, " polls are worth ", hl.nEff, ", since older polls, smaller samples and repeat polls from one pollster count for less. The", " ", xref("interval", "effective sample", "95% interval"), " is computed from it.")
  }, {
    id: "significance",
    term: "Significant",
    body: React.createElement(React.Fragment, null, "A difference or change that chance is an unlikely explanation for: if nothing had really differed or moved, a gap as large would turn up less than one time in twenty. Two figures differ significantly when the gap between them is larger than their margins combined. Figures from different people have errors that partly offset, so margins of 1.3 and 1.2 points combine to 1.8, not 2.5.", React.createElement("span", {
      className: "info-p"
    }, React.createElement("b", null, "Several at once."), " Test enough gaps at one in twenty and one will pass by chance, so the bar rises with the number tested. With six gaps, the clearest must pass at one in 120, the next at one in 100, then 80, and so on, stopping at the first that falls short."), React.createElement("span", {
      className: "info-p"
    }, React.createElement("b", null, "Over time."), " A change is a straight line through the readings, tested against how far they scatter around it. Each section says which readings it fits."), React.createElement("span", {
      className: "info-p"
    }, React.createElement("b", null, "Limits."), " One in twenty is a convention, and a result near the line can flip with one new poll. Across every tab, party and period, about one sentence in twenty could report a difference or change that isn\u2019t there."), working(React.createElement(React.Fragment, null, React.createElement("span", {
      className: "info-p"
    }, React.createElement("b", null, "Gap between two figures:"), " z = 1.96 \xD7 (a \u2212 b) \xF7 \u221A(\xB1a\xB2 + \xB1b\xB2), where a and b are the figures and \xB1a and \xB1b their 95% margins. p is the chance of a z at least that far from zero under the normal curve. p < 0.05 is the same as the gap exceeding \u221A(\xB1a\xB2 + \xB1b\xB2)."), React.createElement("span", {
      className: "info-p"
    }, React.createElement("b", null, "Several gaps:"), " Holm\u2019s method. With m gaps, sort their p from smallest. The kth smallest passes if p < 0.05 \xF7 (m \u2212 k + 1) and every smaller one passed."))))
  }, {
    id: "changes",
    q: "What are the ▲ and ▼ figures measured against?",
    a: React.createElement(React.Fragment, null, "It depends on where they sit.", React.createElement("ul", {
      className: "info-list"
    }, React.createElement("li", null, React.createElement("strong", null, "Beside a current figure:"), " the change on a month ago, from the same estimate built from the polls of 30 days earlier. It counts as a change only when it is larger than its own margin, which combines both readings\u2019 intervals; otherwise the figure says \u201Cwithin the margin\u201D."), React.createElement("li", null, React.createElement("strong", null, "On the primary vote figures:"), " the change since the 2025 election, where every line on that chart begins."), React.createElement("li", null, React.createElement("strong", null, "In a poll\u2019s breakdown and the poll tables:"), " the change on that pollster\u2019s own previous poll."), React.createElement("li", null, React.createElement("strong", null, "In the issues table by group:"), " a group that differs from all voters by more than its own 95% margin.")), "Most say what they are measured against beside them, or when you point at them.", !RD ? React.createElement(React.Fragment, null, " A green \u25B2 is a rise and a red \u25BC a fall: a direction, not a verdict on anyone. The undecided share reverses the colours, since more undecided voters is the less settled reading, and where One Nation\u2019s voters came from stays grey either way.") : null)
  }];
  const sections = [{
    id: "s-2pp",
    title: "Two-party preferred",
    nav: "Two-party",
    lead: {
      id: "two-party-preferred",
      body: React.createElement(React.Fragment, null, "Each party\u2019s share after every other candidate\u2019s preferences have been distributed between the final two. It\u2019s the figure that decides seats. The section shows Labor against the Coalition and against One Nation, and leads with the one Labor is doing worse against", onSince ? React.createElement(React.Fragment, null, ": the Coalition until ", onSince, ", One Nation since") : null, ". Both are", " ", xref("implied-2pp", "two-party preferred", "implied"), " from each poll\u2019s primary votes, with the pollsters\u2019 own published figures a switch away. A contest no fixed table covers, such as the Coalition against One Nation, is shown as published.", React.createElement("span", {
        className: "info-p"
      }, React.createElement("b", null, "Published figures"), " are averaged as Labor\u2019s share of the two. Essential leaves ", xref("decidedness", "two-party preferred", "undecided"), " voters inside its pair, which falls short of 100 by that share; averaged as published, it would mix a share of everyone with a share of the decided and give Essential a false lean. Rescaling splits the undecided in proportion, only because a pair on its own gives no basis for splitting them any other way. The shortfall is kept as Essential\u2019s own line in Decidedness. The primaries keep their shortfall instead: a primary share can be read on its own, but a two-party pair is pooled across pollsters, so it has to be comparable."))
    },
    entries: [{
      id: "implied-2pp",
      term: "Implied 2PP",
      body: React.createElement(React.Fragment, null, "The site\u2019s main two-party figure, on the hero, the share card and the summary. It takes each poll\u2019s primary votes and distributes the minor parties\u2019 shares using one fixed", " ", xref("preference-flows", "implied 2PP", "preference table"), ": against the Coalition, the flows counted at the 2025 election. Every pollster allocates preferences its own way, so one table for all of them means the figure moves when voters do, not when the mix of pollsters changes. It also counts every poll that publishes primaries, including those with no two-party figure of their own.", React.createElement("span", {
        className: "info-p"
      }, "Neither it nor the published figure is the true 2PP.", D.synthLatest && D.synth2pp && D.synth2pp.length > 1 ? React.createElement(React.Fragment, null, " Against the Coalition today, the implied figure reads ", D.synthLatest.alp.toFixed(1), " ", "and the published ", L.alp2pp.toFixed(1), ". With One Nation on ", onp, "% of the primary vote, five points of doubt about where its preferences go moves the two-party figure", " ", (prim.onp * 0.05).toFixed(1), " points either way.") : null), L.onImp ? React.createElement("span", {
        className: "info-p"
      }, "Labor v One Nation uses a different table, the", " ", xref("fp-flows", "implied 2PP", "Labor v One Nation flows"), ", because no election has ever counted that pairing: ", L.onImp.a.toFixed(1), " to Labor,", " ", L.onImp.b.toFixed(1), " to One Nation, \xB1", onM.toFixed(1), " once doubt about that table", " ", "is added to the polls\u2019 own margin.") : null, React.createElement("span", {
        className: "info-p"
      }, "Past cycles reads each earlier term through the flows of the election that opened it (see", " ", xref("last-election-flows", "implied 2PP", "Last-election flows"), "). Both tables, and the case for reading every poll through a fixed table, are set out in the", " ", React.createElement("a", {
        href: "/flows-explained/"
      }, "preference flows explainer"), "."))
    }, {
      id: "preference-flows",
      term: "Preference flows",
      body: React.createElement(React.Fragment, null, "How minor-party votes split between the final two candidates once preferences are distributed. The ", xref("implied-2pp", "preference flows", "implied 2PP"), " against the Coalition uses the flows counted at the 2025 election", " ", "(", React.createElement("a", {
        href: "https://results.aec.gov.au/31496/Website/HouseStateTppFlow-31496-NAT.htm",
        target: "_blank",
        rel: "noopener noreferrer"
      }, "Greens 88.2%, One Nation 25.5% and all others 54.5% to Labor"), "). The party-by-party history is charted in the", " ", React.createElement("a", {
        href: "/flows-explained/"
      }, "preference flows explainer"), " \u2014 flows exist only from 1996, when full preference data was first published, and One Nation\u2019s line breaks where it barely stood candidates. Labor v One Nation uses its own ", xref("fp-flows", "preference flows", "Labor v One Nation flows"), ", estimated because no election has counted that pairing.", React.createElement("span", {
        className: "info-p"
      }, React.createElement("b", null, "Are they still flowing that way?"), " The Respondent-allocated preference flows page, in the More menu, checks two ways, one contest at a time. It sets what each party\u2019s voters tell pollsters, when asked to choose between the final two, beside the flows the site assumes. And it watches the pollsters\u2019 own two-party figures, which come largely from where their respondents say their preferences would go: if those drift from where the pollster\u2019s primary votes and the 2025 flows put them, voters may be sending preferences differently. Each pollster is measured against its own habits: its polls in the six months after the election, or its first polls if it started later. With no counted Labor v One Nation flows, that chart shows drift since each pollster\u2019s first head-to-heads. The check corrects no other figure."))
    }, {
      id: "flow-history",
      term: "Counted and estimated flows",
      body: React.createElement(React.Fragment, null, "The chart in the ", React.createElement("a", {
        href: "/flows-explained/"
      }, "preference flows explainer"), " tracks the share of each group\u2019s ballots that ended with Labor rather than the Coalition, election by election.", React.createElement("span", {
        className: "info-p"
      }, React.createElement("b", null, "Federal: counted."), " The Australian Electoral Commission follows every ballot to the final two and publishes where each party\u2019s voters ended up. From 1996 to 2001 that count covers the seats where Labor and the Coalition were the final two, 142 to 145 of the 148 to 150. Since 2004 it covers every seat, nationally and by state: the Commission sorts every ballot between Labor and the Coalition, even where someone else made the final two. The seat-type and socio-economic views below take one estimated step."), React.createElement("span", {
        className: "info-p"
      }, React.createElement("b", null, "Seat types and socio-economic fifths."), " The seat-type views group each seat by the Commission\u2019s own classification at that election (inner metro, outer metro, provincial or rural), so a seat that was reclassified moves with it. The 1996 and 1998 ratings come from the Commission\u2019s whole-chamber tables of those years, 2001\u2019s from its division profiles (three unrated seats from its research report) and 2004\u2019s from its profile pages. The fifths rank every seat on one of three ABS indexes: IRSAD (advantage and disadvantage), IEO (education and occupation) or IER (economic resources). The most-advantaged 30 seats form the top fifth, and so on down; in the 151-seat chambers of 2019 and 2022 the spare seat goes to the bottom fifth, and in 1998\u2019s 148-seat chamber the bottom fifth holds 28. IEO and IER start in 1998, from the Parliamentary Library\u2019s 1996-census figures for that election\u2019s seats; IRSAD starts in 2001. From 2004 to 2019 each seat\u2019s percentile is interpolated between the censuses either side of election day; other years use the census ranking published for that election\u2019s boundaries. Each election is ranked afresh, so a seat whose standing changed can change fifths. A whole seat sits in one fifth by its average, so a seat that mixes rich and poor suburbs counts entirely in one."), React.createElement("span", {
        className: "info-p"
      }, React.createElement("b", null, "Seats where a crossbencher made the final two."), " Before 2004 these seats are left out, and the points are drawn as hollow rings. From 2004 the Commission\u2019s state table of flows by party, less the seats where Labor and the Coalition were the final two, gives each party\u2019s flow across a state\u2019s crossbench seats. Where those seats all sit in one seat type or fifth, that is a count. Where they are spread across several, the split between groups is fitted to three counts: each seat\u2019s first preferences by party, each seat\u2019s minor-party ballots that ended with Labor (its two-party Labor total less Labor\u2019s own first preferences), and each party\u2019s state total. The split between Greens, One Nation and Others inside those seats is still an estimate, drawn as a hollow diamond, but the all-minor-parties line stays a count. The one exception is a state where Liberal and National candidates both stood in more than one such seat: the ballots of the beaten Coalition candidate that ended with Labor are known only for the state, so they are shared between those seats, and a diamond marks the all-minor-parties point too."), React.createElement("span", {
        className: "info-p"
      }, React.createElement("b", null, "First preferences, two-party and informal views."), " All three are the Commission\u2019s per-seat counts summed over each group. The first-preference view folds small parties into Others. The two-party view sums the Commission\u2019s Labor-v-Coalition count in every seat; 1998\u2019s Newcastle is missing from it, because its poll was deferred to a supplementary election the Liberals didn\u2019t contest. Its informal count comes from that supplementary election\u2019s published result. The Senate\u2019s informal series stops at 2022, because the Commission hasn\u2019t yet published its 2025 Senate informality summary."), FHB && FHB.fedEst ? React.createElement("span", {
        className: "info-p"
      }, React.createElement("b", null, "Federal before 1996: estimated."), " The Commission published no flows by party before 1996, but it has distributed every seat\u2019s preferences in full since 1984. The chart estimates ", FHB.fedEst[0], "\u2013", FHB.fedEst[FHB.fedEst.length - 1], " from those distributions with the method behind the state lines, set out below: from Adam Carr\u2019s transcriptions of the printed results to 1990 and the Commission\u2019s statistics tables for 1993, in the seats where Labor and the Coalition finished first and second. A few seats whose transcribed counts don\u2019t add up are left out. The 1983 count stopped once a candidate passed half the vote, so it can\u2019t be estimated this way.") : null, FHB ? React.createElement(React.Fragment, null, React.createElement("span", {
        className: "info-p"
      }, React.createElement("b", null, "States: estimated."), " No state commission publishes that count. Each publishes its distributions of preferences, which show where an excluded candidate\u2019s whole pile went, including ballots it had inherited from candidates excluded earlier. So each pile holds two groups of known size: the candidate\u2019s own voters and the ballots it inherited. The estimate works out how each group split from the way the piles split across every seat, then follows both to the final two. It covers only the seats where Labor and the Coalition were the final two."), React.createElement("span", {
        className: "info-p"
      }, React.createElement("b", null, "Queensland to 2015: optional numbering."), " From 1992 to 2015 Queensland voters could stop numbering, as New South Wales voters still can. Its distributions record the ballots that ran out at each exclusion, so the estimates for 2004 to 2015 follow those too: each share is of the ballots that reached Labor or the Coalition, and the tooltip gives the estimated share that reached neither.", FHB.nsw && FHB.nsw.exh != null ? React.createElement(React.Fragment, null, " Run on New South Wales\u2019s distributions, where the count is known, those exhausted shares came within ", FHB.nsw.exh.toFixed(1), " points, so read them as approximate.") : null), React.createElement("span", {
        className: "info-p"
      }, React.createElement("b", null, "New South Wales: counted."), " Its electoral commission publishes every ballot\u2019s preferences, so its lines are counts, like the federal ones. NSW voters may stop numbering before they reach Labor or the Coalition, so each share is of the ballots that reached one of them, and the tooltip gives how many reached neither."), React.createElement("span", {
        className: "info-p"
      }, React.createElement("b", null, "How close it gets."), " Tried on the last ", fhWord(FHB.elections), " federal elections, where the counted answer is known, it came within ", FHB.grn.model.toFixed(1), " points of the Greens\u2019 counted flow on average, and within ", FHB.oth.model.toFixed(1), " for everyone else. Reading each pile as one block misses by ", FHB.grn.replay.toFixed(1), " and", " ", FHB.oth.replay.toFixed(1), ". At a state\u2019s size it missed by no more than", " ", fhRange(FHB.err90.grn), " points for the Greens nine times in ten, and", " ", fhRange(FHB.err90.oth), " for everyone else, and ", fhRange(FHB.err90.onp), " for One Nation;", " ", "the bars on the chart show that range.", FHB.qld != null ? React.createElement(React.Fragment, null, " In Queensland, where ", React.createElement("a", {
        href: FHB.qldSource,
        target: "_blank",
        rel: "noopener noreferrer"
      }, "Antony Green tabulated"), " the electoral commission\u2019s own counts in 2020 and 2024, the estimates came within ", FHB.qld.toFixed(1), " points.") : null, FHB.nsw && FHB.nsw.grn != null ? React.createElement(React.Fragment, null, " Run on New South Wales\u2019s distributions and checked against its counts, they came within ", FHB.nsw.grn.toFixed(1), " points for the Greens and ", FHB.nsw.oth.toFixed(1), " for everyone else.") : null, FHB.othLean && FHB.othLean.cal && FHB.othLean.cal[1] < 0 ? React.createElement(React.Fragment, null, " The estimates for everyone else lean low: by ", fhRange(FHB.othLean.cal.map(x => -x).reverse()), " points on average in the federal trials at a state\u2019s size", FHB.othLean.nsw && FHB.othLean.nsw[1] < 0 ? React.createElement(React.Fragment, null, ", and by ", fhRange(FHB.othLean.nsw.map(x => -x).reverse()), " in every New South Wales election") : null, ". The bars are drawn either side of the estimate, so the true flow more likely sits in their upper half.") : null, FHB.grnLean && FHB.grnLean.cal && FHB.grnLean.cal[0] > 0 ? React.createElement(React.Fragment, null, " The Greens estimates lean the other way, high, by ", fhRange(FHB.grnLean.cal), " points on average", FHB.grnLean.worst && FHB.grnLean.worst.length ? React.createElement(React.Fragment, null, ", most in the older elections (", FHB.grnLean.worst.map(w => w.year + ", " + w.miss.toFixed(1)).join("; "), ")") : null, ", so their true flow more likely sits in a bar\u2019s lower half.") : null), FHB.contest ? React.createElement("span", {
        className: "info-p"
      }, React.createElement("b", null, "Labor v One Nation contests."), " The explainer\u2019s Labor v One Nation view plots one cross per voter group per contest, and draws no line between contests, because the groups differ: Hunter\u2019s Coalition voters were Nationals, the others\u2019 Liberals. Hunter 2025 is the electoral commission\u2019s count. South Australia 2026 is this site\u2019s estimate over the ", FHB.contest.seats, " seats where One Nation faced Labor. Its bars are the misses at that size: for the Greens (\xB1", FHB.contest.err.grn.toFixed(1), ") and everyone else (\xB1", FHB.contest.err.oth.toFixed(1), "), the federal trials cut to ", FHB.contest.seats, " seats; for Liberal voters (\xB1", FHB.contest.err.lib.toFixed(1), "), the federal seats where Labor faced someone other than the Coalition, where the commission counts where Coalition voters went: the largest miss of the last ", fhWord(FHB.contest.elections), " elections. Secret Harbour 2026 is this site\u2019s estimate for the whole seat: the electoral commission\u2019s count sheets for the early voting centre (47% of the votes) give each party\u2019s voters there, and its results give the rest of the seat\u2019s first preferences and final count, so how the rest\u2019s minor-party ballots split in total is known. Dividing that between the parties is the one choice; the bars show how far the estimate moves across four ways of doing it. The site\u2019s pile model, run on the seat\u2019s full distribution without the counts, puts Liberal voters 2.7 points more Labor\u2019s way and Greens voters 6.7 points less: both beyond its tested error for a single seat where Labor faced someone other than the Coalition (2.4 and 5.0 points, nine times in ten), which is why the counts lead here.") : null, React.createElement("span", {
        className: "info-p"
      }, React.createElement("b", null, "What\u2019s left out."), " One Nation\u2019s estimates miss by more (", FHB.onp.model.toFixed(1), " points on average federally since 2016), so its bars run wider. An estimate also needs enough One Nation ballots behind it: at least", " ", FHB.onpMinBallots ? (Math.round(FHB.onpMinBallots / 1000) * 1000).toLocaleString("en-AU") : "39,000", ",", " ", "the smallest base the method was tested on, because on about 20,000 it missed federal counts by 4\u20135 points. New South Wales\u2019s One Nation lines are counts, so they need no such floor.", FHB.vicstop ? React.createElement(React.Fragment, null, " Victoria\u2019s 2006\u20132018 counts stopped once a candidate passed half the vote, landing them below the ", FHB.minClassic, "-seat line; the estimator was then tried under that same stopping rule, missing by ", FHB.vicstop.grn.toFixed(1), " points on Greens and ", FHB.vicstop.oth.toFixed(1), " on others nine times in ten, so those years show with their own bars.") : null, "The chart also leaves out counts that reached a Labor v Coalition final in fewer than ", FHB.minClassic, " seats: the Northern Territory\u2019s; and South Australia\u2019s in 2026, when One Nation, not the Liberals, faced Labor in most seats. Those 2026 contests appear in the explainer\u2019s Labor v One Nation section instead."), React.createElement("span", {
        className: "info-p"
      }, React.createElement("b", null, "Upper houses: New South Wales alone."), " The explainer\u2019s Upper view counts above-the-line Senate ballots federally \u2014 the four elections since group voting tickets went \u2014 and one state chamber: New South Wales\u2019s Legislative Council, from the ballot-level files its commission publishes. Every other state upper house voted on group voting tickets for most of its history, and an above-the-line vote under a ticket just ran the party\u2019s lodged ordering, so the count keeps none of the voters\u2019 own preferences to tally. Victoria\u2019s Council last did so in 2022 (its tickets were abolished in 2026), Western Australia\u2019s in 2021; the ticket-free counts since \u2014 South Australia\u2019s 2022 election, Western Australia\u2019s one statewide count in 2025 \u2014 publish count sheets only, no ballot-level record, and Tasmania\u2019s single-member chamber publishes none either. The view\u2019s other state picks are cuts of the federal Senate count, not state-chamber series.")) : null)
    }, {
      id: "fp-flows",
      term: "Labor v One Nation flows",
      body: React.createElement(React.Fragment, null, "The preference table behind the Labor v One Nation figure. No election has ever counted that contest, so the site estimates the table from the ballots that do exist. Three settings do all the work: Coalition voters give ", fpc(FT.lnp), " to Labor (\xB1", fpt(FB.lnp), "), Greens ", fpc(FT.grn), " (\xB1", fpt(FB.grn), ")", " ", "and everyone else ", fpc(FT.oth), " (\xB1", fpt(FB.oth), "). The rest go to One Nation.", L.onImp && prim ? React.createElement("span", {
        className: "info-p"
      }, "On today\u2019s primaries: Labor\u2019s ", prim.alp.toFixed(1), ", plus", " ", fpc(FT.lnp), " of the Coalition\u2019s ", prim.lnp.toFixed(1), ", ", fpc(FT.grn), " of the Greens\u2019", " ", prim.grn.toFixed(1), " and ", fpc(FT.oth), " of the others\u2019 ", prim.oth.toFixed(1), ", gives", " ", L.onImp.a.toFixed(1), " to Labor and ", L.onImp.b.toFixed(1), " to One Nation. The table\u2019s own range, \xB1", L.onImp.band.toFixed(1), ", adds up the three settings\u2019 ranges. It measures doubt about the table, not sampling chance, so the hero adds it to the polls\u2019", " ", "own margin", L.onImp.cs != null ? React.createElement(React.Fragment, null, " (\xB1", L.onImp.cs.toFixed(1), ")") : null, " as a separate", " ", "error: \xB1", onM.toFixed(1), " in all, \xB1", (2 * onM).toFixed(1), " on the lead.") : null, React.createElement("span", {
        className: "info-p"
      }, React.createElement("b", null, "Where the numbers come from."), " The ballots that do exist. The AEC\u2019s 2025 Senate ballot data records how every Coalition, Greens and other voter ranked Labor against One Nation. The 2026 lower-house contests where One Nation made the final two, the SA state election and the Secret Harbour by-election, show how that ranking carries into a House count, though both are estimates from partial data. The settings also allow for voters those contests left out, such as Nationals voters, and the Coalition setting sits partway between the site\u2019s reading and Kevin Bonham\u2019s independent estimate. The table stays fixed between such evidence and is never fitted to current polls. The pollsters\u2019 own Labor v One Nation figures rest on what respondents say, without the how-to-vote card close to half of Coalition voters copy, so they stay on the chart as a cross-check. The working is in the", " ", React.createElement("a", {
        href: "/flows-explained/"
      }, "preference flows explainer"), "."))
    }]
  }, {
    id: "s-primary",
    title: "Primary vote",
    nav: "Primary vote",
    lead: {
      id: "primary-vote",
      body: React.createElement(React.Fragment, null, "The share of voters who put a party first, before any preferences are distributed. Each party\u2019s figure is built like the headline, from the last three weeks of polls with each pollster\u2019s lean taken out (see ", xref("weighted-aggregate", "primary vote", "Weighted aggregate"), "). Every line starts at the 2025 election result, and the figures beside the chart give the change since then.", React.createElement("span", {
        className: "info-p"
      }, React.createElement("b", null, "Why they may not add up to 100."), " Some pollsters keep voters who won\u2019t name a party inside their published shares, so the parties fall short of 100 by exactly that ", xref("decidedness", "primary vote", "undecided"), " share. The aggregate keeps the shortfall, because it says something real about the electorate: the five parties are rescaled only if their total sits more than half a point from the plain average\u2019s. Each poll\u2019s breakdown says which approach its pollster used."), React.createElement("span", {
        className: "info-p"
      }, React.createElement("b", null, "The group views."), " Pick a group from the menu over the chart and each dot becomes that poll\u2019s reading of the group: the group\u2019s share in the poll less the poll\u2019s own all-voters figure, drawn onto the pooled all-voters line for its month. It is never the group share the poll printed, so a poll whose sample leans toward the group still lands on the one trend. The printed figures themselves sit beside each poll in All polls\u2019 ", xref("all-polls", "primary vote", "group breakdowns"), " (the Demographics view) \u2013 and a dot\u2019s click opens them there."))
    },
    entries: []
  }, {
    id: "s-latest",
    title: "Latest and next polls",
    nav: "Latest polls",
    lead: {
      id: "latest-polls",
      body: React.createElement(React.Fragment, null, "The newest poll from each pollster, and when its next is likely to land. An earlier poll leaves the table once a newer one comes out: All polls keeps every poll this term, and Past cycles the ones before. If a published poll is missing from All polls too, that\u2019s an error: please ", React.createElement("a", {
        className: "fb-link",
        href: "/feedback/"
      }, "report it"), ".")
    },
    entries: [{
      id: "house",
      term: "House",
      body: React.createElement(React.Fragment, null, "A polling company: Newspoll, YouGov, Resolve and the rest. The industry calls them houses. A single poll release is often called a wave.")
    }, {
      id: "next-polls",
      term: "Next polls",
      body: React.createElement(React.Fragment, null, "When each pollster is likely to publish next, forecast from its own track record. The dates are merely estimates.", React.createElement("span", {
        className: "info-p"
      }, React.createElement("b", null, "The date"), " is the house\u2019s last release plus the median of its last eight gaps between releases, nudged by up to three days onto the weekday it usually publishes. ", React.createElement("b", null, "The \xB1"), " is half the spread of those gaps, leaving out the longest and shortest, and widens for releases further out; for a house that always publishes on the same weekday, it moves in whole weeks. A house too irregular for a date gets a window instead."), React.createElement("span", {
        className: "info-p"
      }, React.createElement("b", null, "Late polls."), " When a date passes with no poll, the row stays and keeps counting, turning red once the whole window has passed. A date gets two days of grace for a poll simply running late; a dated slot still unrecorded on the third morning is treated as skipped, and the forecast moves on to the house\u2019s next plausible date. A window forecast names no one day to break, so it holds its seat until the wave is added. The countdown in the tab bar works the same way. Roy Morgan\u2019s stated schedule is taken at its word, even though it doesn\u2019t always keep it."), React.createElement("span", {
        className: "info-p"
      }, "Open a row to check the forecast against the house\u2019s five most recent releases."), working(React.createElement("span", {
        className: "info-p"
      }, "Gaps are measured between publication dates where the record has them, since publication is what\u2019s being forecast. If the forecast lands at the early edge of the house\u2019s record, only a later day is named as the alternative: \u201C(or Wed 7 Oct)\u201D. A publishing hour appears once a house has been timed often enough, in the publisher\u2019s own time zone (AEDT in summer, AEST otherwise), and \u201Ctoday\u201D means today in Sydney. Houses that stop publishing are removed by hand.")))
    }]
  }, {
    id: "s-leaders",
    title: "Leadership",
    nav: "Leadership",
    lead: {
      id: "leadership",
      body: React.createElement(React.Fragment, null, "Three questions, each kept apart: who would make the better", " ", xref("preferred-pm", "leadership", "prime minister"), ", how each leader is doing the job (", xref("approval", "leadership", "approval"), "), and what voters think of each as a person (", xref("favourability", "leadership", "favourability"), ").", React.createElement("span", {
        className: "info-p"
      }, React.createElement("b", null, "Approval and favourability"), " are monthly averages adjusted for each pollster\u2019s lean, as the vote is, except that every poll counts equally, whatever its sample: a handful of houses answering the same question is not one pooled sample. A pollster that publishes both measures lends its second reading to the other line."), React.createElement("span", {
        className: "info-p"
      }, React.createElement("b", null, "Preferred prime minister"), " is averaged by sample size with no house adjustment. Pollsters leave very different shares uncommitted, so one pollster\u2019s figures run high or low for both leaders at once. That is a difference of format, not a lean, so levels can\u2019t be compared across pollsters, though gaps and trends can. Two-way and three-way questions are never averaged together."), React.createElement("span", {
        className: "info-p"
      }, React.createElement("b", null, "One office, two people."), " Ley\u2019s readings and Taylor\u2019s are never averaged together, so the February 2026 handover doesn\u2019t read as a move in one person\u2019s numbers."), React.createElement("span", {
        className: "info-p"
      }, React.createElement("b", null, "The current figures"), " are built like the headline: Albanese\u2019s and Taylor\u2019s approval from the last three weeks of polls, and favourability, Hanson\u2019s approval and preferred prime minister from the last six, since fewer pollsters ask them."))
    },
    entries: [{
      id: "preferred-pm",
      term: "Preferred prime minister",
      body: React.createElement(React.Fragment, null, "Who voters say would make the better prime minister. Pollsters ask it head to head, Albanese against the opposition leader or against Hanson, and some ask it three-way. Each format is its own line.")
    }, {
      id: "approval",
      term: "Approval",
      body: React.createElement(React.Fragment, null, "A rating of how a leader is doing the job: the share who approve minus the share who disapprove, called net approval. Essential asks, \u201CDo you approve or disapprove of the job Anthony Albanese is doing as Prime Minister?\u201D YouGov and Newspoll ask, \u201CAre you satisfied or dissatisfied with the way Anthony Albanese is doing his job as Prime Minister?\u201D Resolve asks, \u201CHow would you rate Angus Taylor\u2019s performance as opposition leader in recent weeks?\u201D")
    }, {
      id: "favourability",
      term: "Favourability",
      body: React.createElement(React.Fragment, null, "A rating of the leader as a person: favourable minus unfavourable. RedBridge/Accent asks, \u201CDo you have a favourable or unfavourable view of the following?\u201D DemosAU asks, \u201CWhat is your opinion of the following people?\u201D, offering positive, neutral and negative. Freshwater and Spectre Strategy ask their own versions. A leader can be approved of for the job and disliked as a person, so", " ", xref("approval", "favourability", "approval"), " and favourability are never averaged together.")
    }]
  }, {
    id: "s-direction",
    title: "National direction",
    nav: "Direction",
    lead: {
      id: "direction",
      body: React.createElement(React.Fragment, null, "Whether voters think the country is heading in the right direction or is on the wrong track. Only ", (D.directionHouses || []).length, " pollsters ask it, with slightly different wording, and not every poll includes it. ", dirSources, React.createElement("span", {
        className: "info-p"
      }, "Right direction and wrong track are averaged separately and adjusted for each pollster\u2019s ", xref("house-effect", "direction", "lean"), "; the undecided share is whatever is left. SEC Newgate makes everyone choose, so its readings have no undecided share and sit higher on both lines, which the lean adjustment takes out. The figures at the top come from the last three weeks of polls. With so few pollsters asking, some months rest on a single poll, and their", " ", xref("interval", "direction", "95% intervals"), " are wider for it."))
    },
    entries: []
  }, {
    id: "s-who",
    title: "Who votes for whom",
    nav: "Who votes",
    lead: {
      id: "vote-by-group",
      body: React.createElement(React.Fragment, null, "How each group says it will vote, from the tables pollsters publish with their polls: men and women, age groups, generations, education levels, states, where people live, whether they own or rent, the language they speak at home, whether they work full time, part time or are retired, and how much they earn.", React.createElement("span", {
        className: "info-p"
      }, React.createElement("b", null, "How it\u2019s built."), " Each poll says how far a group sits from that poll\u2019s own overall figure: One Nation ten points lower among 18\u201334s, say. Those gaps are pooled over the last six weeks of polls and added to the site\u2019s current figure for all voters. Measuring each poll against its own total removes its pollster\u2019s lean. The charts follow each group month by month, built the same way, as a percentage above or below all voters. Groups pool only where pollsters cut the population the same way; the working lists which count where. Income is treated differently. Because no two pollsters draw the same income brackets, the Income tab places each bracket where it sits in the electorate \u2013 an under-$50k cut is roughly the poorest quarter, from the census income distribution \u2013 and fits each poll a line through its brackets, each weighted by how many voters it holds. Every poll is read at the same two bands, the bottom half and the top 15% plus, and those reads become gaps against its own total, like any other group\u2019s. The note by the chart names each house\u2019s own end brackets."), React.createElement("span", {
        className: "info-p"
      }, React.createElement("b", null, "Reading a gap."), " Each figure carries its", " ", xref("interval", "who votes for whom", "95% margin"), ", usually 2 to 5 points, with each poll\u2019s sample for a group estimated from the group\u2019s share of adults (18\u201334s are about 28%). The sentences call a difference ", xref("significance", "who votes for whom", "significant"), " ", "only when it passes that test, with the bar raised when three or more groups are compared. They report what passes: a steady rise or fall across ordered groups such as age (only when every step passes), one group apart from the others, or failing those, the largest gap that passes. If no two groups differ, they name any group that sits clear of all voters by more than its margin, and only if none does, no difference."), React.createElement("span", {
        className: "info-p"
      }, React.createElement("b", null, "The headline."), " It names a group only when the group\u2019s figure sits clear of all voters\u2019 by more than its margin, and names each trait at most once each way. On a scale such as age or education, a lean at both ends is one fact: a party with older voters is named for them, not also for its missing young ones. A gap that stops short of the far end is a fact of its own, and states, which have no order, are named both ways. The age bands lead the generations. A generation replaces its band only when its gap is clearly the larger, and when the two disagree, age is left out. Up to five claims make the headline: those that most change the make-up of the party\u2019s voters."), React.createElement("span", {
        className: "info-p"
      }, React.createElement("b", null, "Changes over time."), " The sentence under each chart asks whether a group has moved towards or away from the party, relative to all voters. The point-gap alone can\u2019t say. When a party grows everywhere, a group keeping its usual share of the party\u2019s vote sees its gap widen by arithmetic alone: a group at two-thirds of the national figure sits 3 points under when the party is on 8%, and 9 under at 27%. So each group is tested on its gap in points and on its ratio to all voters, which holds steady for a group merely keeping pace, and a change counts only when both pass, in the same direction. Each test is a line through the monthly readings, tighter months counting for more. A group needs five monthly readings to be tested, and on seven or fewer the sentence hedges (\u201Cappears to\u201D)."), React.createElement("span", {
        className: "info-p"
      }, React.createElement("b", null, "Limits."), " The margins can\u2019t see pollsters defining or weighting a group differently, and a pollster that joins the series part-way, reading a group its own way, can move a monthly line by that alone. The test looks for steady change, so a rise and a fall within the period cancel out."), working(React.createElement(React.Fragment, null, React.createElement("span", {
        className: "info-p"
      }, React.createElement("b", null, "Which pollsters count where."), " A pollster counts for a group only where it draws the group the same way as the others; the table below lists who counts for each. YouGov\u2019s age bands are 35\u201349 and 50+, so it counts at 18\u201334 alone.", " ", xref("generations", "who votes for whom", "Generations"), " come from the pollsters that name them. RedBridge\u2019s two school rows are combined in proportion to its own group sizes, and YouGov\u2019s SA, WA, and ACT/NT/Tas columns into the non-eastern mainland at their shares of the 2025 vote. Tasmania-only readings (Roy Morgan, EMRS) are drawn beside ACT/NT/Tas as comparison points and pooled into nothing; DemosAU\u2019s modelled Tasmania, ACT and NT rows are drawn there one by one too, and count only combined, at their shares of the 2025 vote. DemosAU counts for the two metropolitan areas only, since its third combines provincial and rural voters, and RedBridge for owners only, since its renters include others who don\u2019t own. The modelled polls (MRP) count as one poll each, placed at the middle of their fieldwork as the headline places every poll, though that fieldwork can run past six weeks. Their group figures are the model\u2019s estimates, not a table of answers. A model whose fieldwork contains the pollster\u2019s own regular polls \u2013 DemosAU\u2019s from January to March 2026 \u2013 is taken to reuse their respondents, whose groups already count, and is left out."), React.createElement("span", {
        className: "info-p"
      }, React.createElement("b", null, "Newspoll\u2019s tables."), " Newspoll publishes its groups only every three months, in one table combining the three or four polls it ran in that time. The table counts as those polls, each at its own dates and sample, so it joins the six-week window only through the polls inside it. In the test for change over time it counts once, in its middle month: spread across its polls, one table would read as several readings that happen to agree."), demoRoster, React.createElement("span", {
        className: "info-p"
      }, React.createElement("b", null, "Pooling."), " The gaps are weighted as the headline\u2019s polls are, so newer and larger polls count for more. A group\u2019s 95% margin is the interval taken over its pooled gaps, each poll\u2019s sample for the group being the poll\u2019s sample times the group\u2019s share of adults."), React.createElement("span", {
        className: "info-p"
      }, React.createElement("b", null, "Changes over time:"), " for month m, y is the group\u2019s share less all voters\u2019 share, and r = ln(group \xF7 all voters); months where either share is a trace drop out of r. y and r each get a weighted-least-squares slope on the month index, the weight the precision of the month\u2019s own 95% margin \u2013 w = (1.96 \xF7 margin)\xB2, the margin floored at 0.5 \u2013 t-tested on months \u2212 2 degrees of freedom against the months\u2019 own scatter. A move counts only when both slopes clear |t| = 1.96 with the same sign: the point-gap drifting AND the ratio drifting, the same way. Fewer than five monthly readings: untested. Seven or fewer: thin, and the sentence above hedges."), React.createElement("span", {
        className: "info-p"
      }, React.createElement("b", null, "A check."), " Every table is checked before it\u2019s used: each group must add up to 100, give or take rounding, and an all-voters column must match the poll\u2019s published vote."), React.createElement("span", {
        className: "info-p"
      }, React.createElement("b", null, "Sources."), " Resolve\u2019s monthly age, gender, and state series (its Political Monitor interactive), YouGov\u2019s published crosstabs, RedBridge\u2019s report tables, Newspoll\u2019s quarterly tables in The Australian, and DemosAU\u2019s report charts, measured from the chart in each report because small bars carry no label. Each poll\u2019s figures for these groups are in the All polls export."), demoWork)))
    },
    entries: [{
      id: "generations",
      term: "Generations",
      body: React.createElement(React.Fragment, null, "The birth years behind the generations in", " ", xref("vote-by-group", "generations", "Who votes for whom"), ". YouGov and RedBridge label their generations but publish no birth years, so these are the usual definitions, set by the Pew Research Center:", React.createElement("span", {
        className: "info-p"
      }, React.createElement("b", null, "Gen Z"), ", born 1997 to 2012 \u2013 among voters, 1997 to 2008.", React.createElement("br", null), React.createElement("b", null, "Millennials"), ", born 1981 to 1996.", React.createElement("br", null), React.createElement("b", null, "Gen X"), ", born 1965 to 1980.", React.createElement("br", null), React.createElement("b", null, "Boomers"), ", born 1946 to 1964."), React.createElement("span", {
        className: "info-p"
      }, React.createElement("b", null, "What is uncertain."), " Some Australian researchers draw each line a year earlier or later, and neither pollster says which it follows, so a voter born in a boundary year may sit in either group. YouGov reports a Silent generation, born before 1946, which the site leaves out. RedBridge reports none, so its Boomers take in everyone born before 1965. Either way, they are a small share of the sample."))
    }]
  }, {
    id: "s-switching",
    title: "Where One Nation’s voters are coming from",
    nav: "Vote switching",
    lead: {
      id: "vote-switching",
      body: React.createElement(React.Fragment, null, "How people who voted for each party in 2025 say they would vote now, from the tables DemosAU and YouGov publish with a row for each 2025 vote.", React.createElement("span", {
        className: "info-p"
      }, React.createElement("b", null, "How the split is worked out."), " For each 2025 group, the share now backing One Nation is multiplied by that group\u2019s share of the 2025 vote. That gives the points of the national vote One Nation has drawn from the group, and each group\u2019s part of the total is the share the panel shows.", onsYg ? React.createElement(React.Fragment, null, " In YouGov\u2019s latest poll, ", onsYg.toOn.lnp, "% of Coalition voters backing One Nation is worth ", onsYg.pts.lnp.toFixed(1), " points, and", " ", onsYg.toOn.alp, "% of Labor voters is worth ", onsYg.pts.alp.toFixed(1), ".") : null, " The panel\u2019s other view shows how much of each party\u2019s 2025 vote One Nation has taken. As a check, adding the One Nation voters it kept rebuilds every poll\u2019s published One Nation vote to within about a point."), React.createElement("span", {
        className: "info-p"
      }, React.createElement("b", null, "Limits."), " People misremember how they voted, and memory drifts toward how they feel now, which can blur the very switching being measured. Each 2025 group is only a few hundred respondents in a poll, so the figures pool each group\u2019s share over the last six weeks before working out the split; the lines do the same month by month. Voters who can\u2019t recall a 2025 vote, or didn\u2019t vote, are left out. Other parties and independents are counted together, because DemosAU doesn\u2019t separate them."), React.createElement("span", {
        className: "info-p"
      }, React.createElement("b", null, "A third source."), " Newspoll publishes only Labor\u2019s row: its September poll found 15% of Labor\u2019s 2025 voters now back One Nation (", React.createElement("a", {
        className: "fb-link",
        href: "https://www.theaustralian.com.au/nation/politics/newspoll-support-for-labor-anthony-albanese-crashes/news-story/1a430c02f4dea76c3cc8d92e3b83e455",
        target: "_blank",
        rel: "noopener noreferrer"
      }, "The Australian"), "), close to DemosAU\u2019s 14% and YouGov\u2019s 15%."), working(React.createElement(React.Fragment, null, React.createElement("span", {
        className: "info-p"
      }, React.createElement("b", null, "Sources."), " YouGov\u2019s figures are its own published tables, from Sky News Pulse until July 2026 and News24 Pulse since. DemosAU prints its table only as a chart, so its figures are measured from the chart in each report, and match every label the chart prints. Each poll\u2019s figures are in the All polls export."), onsWork)))
    },
    entries: []
  }, {
    id: "s-issues",
    title: "The issues",
    nav: "Issues",
    lead: {
      id: "issues",
      body: React.createElement(React.Fragment, null, "Two questions pollsters ask about the issues: which ones matter most, and which party would handle each best. The panel turns each into one figure per issue.", React.createElement("span", {
        className: "info-p"
      }, React.createElement("b", null, "What matters."), " RedBridge and Ipsos ask every month for each voter\u2019s three most important issues, from lists of 14 and 19, and the panel shows the share putting each issue among their three. Their wordings give steadily different answers.", gapUp && gapDown && gapUp.v > 0 && gapDown.v < 0 ? React.createElement(React.Fragment, null, " RedBridge\u2019s figure for", " ", issPhrase(gapUp.id), " runs ", Math.round(gapUp.v), " points above Ipsos\u2019s, and its figure for ", issPhrase(gapDown.id), " ", Math.round(-gapDown.v), " points below.") : null, " Nothing shows which is right, so each poll is moved half the pollsters\u2019 average gap toward the other before the two are pooled over six weeks. The grey bars sit midway between the two, and don\u2019t jump when one pollster\u2019s poll leaves the window. Ipsos publishes about three weeks after its fieldwork, so its latest poll is in the window for only part of each month. DemosAU, Spectre and SEC Newgate ask versions that can\u2019t be pooled, but DemosAU and Spectre side with Ipsos on health: in 2026 Spectre had it at 18 to 20%, and 1 to 3% named it the biggest issue at DemosAU, against 7 to 10% ranking it first at RedBridge."), React.createElement("span", {
        className: "info-p"
      }, React.createElement("b", null, "Who\u2019s best."), " Six pollsters ask which party would handle an issue best, each in its own words and with its own list of answers. What every version shares is the choice between Labor, the Coalition and One Nation, so each poll is read as those three parties\u2019 shares of the voters who named one of them: 25, 20 and 20 of all voters become 38, 31 and 31. The shares are pooled over six weeks, after taking off each pollster\u2019s lean, shrunk toward zero where it rests on few polls: Ipsos and Resolve have offered all three parties only since mid-2026", ISS && ISS.leanMax ? React.createElement(React.Fragment, null, ", and the largest lean taken off today is", " ", Math.abs(ISS.leanMax.v).toFixed(1), " points") : null, ". The panel shows the eight issues most pollsters ask: the cost of living, housing, health, economic management, immigration, climate change, crime, and national security, each matched across pollsters\u2019 wordings."), React.createElement("span", {
        className: "info-p"
      }, React.createElement("b", null, "What\u2019s left out."), " The Greens, whom Resolve doesn\u2019t offer, and every answer that names no party: about a quarter to two fifths of voters on most issues, and more than half on climate change with RedBridge and YouGov, where many choose the Greens. RedBridge puts the Greens first on climate change, and the panel says so beside its rows."), React.createElement("span", {
        className: "info-p"
      }, React.createElement("b", null, "Ahead, or no clear lead."), " A party is ahead on an issue when its lead over the next party is larger than that lead\u2019s own 95% margin. The lead and its margin are worked out together, because both shares come from the same voters: when one rises, the other tends to fall."), React.createElement("span", {
        className: "info-p"
      }, React.createElement("b", null, "Changes over time."), " The sentence under the chart asks whether any party has gained or lost ground on the issue. Ipsos and Resolve joined the three-party question only in June and July 2026, so a line can move just because one of them arrived. The test therefore compares each pollster only with itself, with the bar raised for testing three parties at once (see ", xref("significance", "issues", "Significant"), "). A pollster with a single poll, such as DemosAU, is left out of it."), React.createElement("span", {
        className: "info-p"
      }, React.createElement("b", null, "By group."), " RedBridge\u2019s tables give each group\u2019s share putting an issue in its top three, by vote, generation, gender, where people live, home ownership, and education. A group\u2019s margin comes from its share of the poll, so One Nation voters, about a quarter of RedBridge\u2019s sample, carry margins of about 6 points. \u25B2 and \u25BC mark a group that differs from all voters by more than its margin. A group\u2019s change over the term is a line through RedBridge\u2019s monthly polls, with the bar raised for the number of groups tested. The all-voters row is RedBridge\u2019s own, so it can differ from the grey bars, which pool RedBridge with Ipsos."), React.createElement("span", {
        className: "info-p"
      }, React.createElement("b", null, "Limits."), " Unfortunately, the two pollsters that ask what matters every month ask different questions, and nothing shows which is closer to how people will vote. The grey bars simply sit midway between them. And the three-party shares can\u2019t show a party gaining ground among voters who had named no one."), working(React.createElement(React.Fragment, null, React.createElement("span", {
        className: "info-p"
      }, React.createElement("b", null, "What matters, as asked."), " RedBridge: \u201CIf a federal election were held today, which of the following issues would be most important to you when deciding who will receive your vote? Please rank your top 3.\u201D Ipsos: \u201CWhat would you say are the three most important issues facing Australia today?\u201D As a check: DemosAU asks every month, \u201CIn your opinion, what is the biggest issue facing Australia today?\u201D, taking one answer in the voter\u2019s own words and sorting the answers into categories generated by AI, which change from month to month. Spectre asks about every three months for up to three of 14 issues, several of them bundled, such as \u201Chealth and aged care\u201D. Every two months SEC Newgate asks, \u201CWhat are the main issues facing Australians that are most important to you right now?\u201D, and counts every issue each voter mentions."), React.createElement("span", {
        className: "info-p"
      }, React.createElement("b", null, "Who\u2019s best, as asked."), " Resolve asks every month, \u201CWhich party do you think would perform best in each of these areas?\u201D, offering the Liberals, Labor, One Nation (since July 2026), someone else, and undecided. RedBridge asks every month, \u201CWhich of the following do you believe is best able to deal with\u2026\u201D, offering Labor, the Liberals, the Nationals, the Greens, One Nation, all about equal, none of these, and not sure. Ipsos asks every month, \u201CPlease select the political party that you believe is most capable of managing each of the following issues,\u201D for its month\u2019s five top issues, offering Labor, the Coalition, the Greens, One Nation (since June 2026), other, don\u2019t know, and none. YouGov asked in August 2026, \u201CWhich party is best at handling\u2026\u201D, and DemosAU in February 2026, \u201CWhich political party do you trust more to handle the following issues?\u201D, both offering Labor, the Coalition, One Nation, the Greens, and don\u2019t know. Every two months SEC Newgate asks, \u201CWhich of the following do you think would be the best party to manage the cost of living?\u201D It lists all four parties from May 2026, when One Nation and the Greens joined and \u201Cneither\u201D and \u201Ccan\u2019t say\u201D disappeared from the printed table; its pooled waves are those from that month on."), React.createElement("span", {
        className: "info-p"
      }, React.createElement("b", null, "Matching issues."), " RedBridge\u2019s \u201Cthe rate of immigration\u201D is Resolve\u2019s \u201Cimmigration and refugees\u201D, Ipsos\u2019s \u201Cdefence, foreign affairs and terrorism\u201D counts as national security, and DemosAU\u2019s \u201CMedicare\u201D as health."), React.createElement("span", {
        className: "info-p"
      }, React.createElement("b", null, "Pooling."), " Shares are weighted as the headline\u2019s polls are, so newer and larger polls count for more, and each pollster\u2019s lean is measured as the headline\u2019s are."), React.createElement("span", {
        className: "info-p"
      }, React.createElement("b", null, "Top three, two pollsters:"), " with g = RedBridge\u2019s figure minus Ipsos\u2019s on average, each RedBridge poll\u2019s share x counts as x \u2212 g \xF7 2 and each Ipsos poll\u2019s as x + g \xF7 2, and the results pool like the shares below. g is measured poll by poll, against the other pollster\u2019s polls within four weeks, and averaged with a weight that halves every 90 days."), React.createElement("span", {
        className: "info-p"
      }, React.createElement("b", null, "Three-party share:"), " for each party p, s = 100 \xD7 p \xF7 (Labor + Coalition + One Nation), from the poll\u2019s published shares."), React.createElement("span", {
        className: "info-p"
      }, React.createElement("b", null, "Lead:"), " the leader\u2019s share minus the next party\u2019s, pooled like the shares. As a difference of two shares of one sample, its sampling variance is (a + b \u2212 (a \u2212 b)\xB2) \xF7 n, where a and b are the two shares as fractions."), React.createElement("span", {
        className: "info-p"
      }, React.createElement("b", null, "A check."), " Every table is checked before it\u2019s used. A salience row\u2019s three ranks must add up to its top-three share, and every best-party row must add up to 100, give or take rounding. RedBridge prints each month twice, in its own report and again in the next, and the two must agree. Ipsos\u2019s 19 shares must add up to about 300, three per voter, and Ipsos prints each month again in every later report that year: every printing must agree."), React.createElement("span", {
        className: "info-p"
      }, React.createElement("b", null, "Sources."), " RedBridge\u2019s monthly reports with Accent Research (accent-research.com), Resolve\u2019s Political Monitor interactive (The Sydney Morning Herald), Ipsos\u2019s Issues Monitor reports and methodology statements (ipsos.com), YouGov\u2019s News24 Pulse charts, and DemosAU\u2019s report for February 2026. For the check, DemosAU\u2019s and Spectre\u2019s reports."), issWork)))
    },
    entries: []
  }, {
    id: "s-decided",
    title: "Decidedness",
    nav: "Decidedness",
    lead: {
      id: "decidedness",
      body: React.createElement(React.Fragment, null, "How settled the vote is. Some voters won\u2019t name a party (undecided), some name one but might still change their mind (not firm), and the rest are firm. These are different questions, mostly from different pollsters, so each is its own line.", React.createElement("span", {
        className: "info-p"
      }, React.createElement("b", null, "Undecided"), " is the \u201Ccan\u2019t say\u201D share, and each poll\u2019s breakdown says how its pollster treats it.", undWho("first") ? React.createElement(React.Fragment, null, " ", undWho("first"), " ", undVerb("first", "sets", "set"), " it aside before calculating party shares, so the primaries sum to 100.") : null, undWho("tpp") ? React.createElement(React.Fragment, null, " ", undWho("tpp"), " ", undVerb("tpp", "leaves", "leave"), " it inside the published two-party pair, which sums to less than 100; the shortfall is the after-preferences line.") : null), React.createElement("span", {
        className: "info-p"
      }, React.createElement("b", null, "Not firm."), " ", undWho("soft") || "Resolve", " ", undVerb("soft", "asks", "ask"), " those who named a party, \u201CHow firm are you with your vote?\u201D The not-firm share is everyone who might still change. ", React.createElement("b", null, "Of every 100 voters"), " combines it with the undecided share, so it is approximate."), React.createElement("span", {
        className: "info-p"
      }, React.createElement("b", null, "By party"), " shows the share of each party\u2019s voters RedBridge finds solid: certain to vote that way. Each figure pools RedBridge\u2019s last ", firmPool, " polls, weighted by how many of the party\u2019s voters each held, against its first ", firmPool, " of the term. ", React.createElement("b", null, "By age"), " pools Resolve\u2019s not-firm share by age band the same way, ", agePool, " polls at a time; Resolve publishes no count for each band, so a band\u2019s sample is the poll\u2019s effective sample times the band\u2019s share of adults."), React.createElement("span", {
        className: "info-p"
      }, React.createElement("b", null, "How it\u2019s built."), " Each pollster\u2019s figure answers its own question, so none takes a house adjustment. The lines are monthly averages weighted by sample size, and the all-voters figures pool the last six weeks of polls. A change since the election is tested within each pollster\u2019s own polls, with the bar raised for testing several lines at once."))
    },
    entries: []
  }, {
    id: "s-mood",
    title: "Economic sentiment",
    nav: "Sentiment",
    lead: {
      id: "mood",
      body: React.createElement(React.Fragment, null, "Four published confidence gauges of the same economy: the ANZ\u2013Roy Morgan Consumer Confidence index, published weekly; the Westpac\u2013Melbourne Institute Consumer Sentiment index, monthly; Roy Morgan\u2019s Business Confidence index, monthly; and NAB\u2019s Monthly Business Survey. The consumer pair and the business pair sit in two views, switched by the tabs over the chart \u2014 the consumer pair opens first. The chart opens at the May 2025 election; the figures on file run further back \u2014 2019 for the Roy Morgan series, 2022 for Westpac, and April 2025 for NAB.", React.createElement("span", {
        className: "info-p"
      }, React.createElement("b", null, "100 is neutral."), " The three index series are built from the balance of optimists and pessimists on each house\u2019s questions, so a reading above 100 means optimists outnumber pessimists and one below 100 the reverse."), React.createElement("span", {
        className: "info-p"
      }, React.createElement("b", null, "NAB is drawn 100 points up."), " NAB reports a net balance \u2014 optimistic firms minus pessimistic ones \u2014 where 0 is neutral, so its dashed line is drawn 100 points up to share the neutral line with the others. The figure shown beside it and in its tooltips is NAB\u2019s own printed number; the row also carries the survey\u2019s conditions reading, which is not charted."), React.createElement("span", {
        className: "info-p"
      }, React.createElement("b", null, "Smoothed, not averaged across sources."), " Each dot is a release\u2019s own headline figure, linked to it; each line is the same readings smoothed with a recency-weighted kernel (half-life 14 days on the weekly consumer index, 60 days on the monthly series) so release-to-release noise reads as trend. The quoted figures are the raw prints, and no", " ", xref("house-effect", "mood", "house-effect"), " adjustment applies \u2014 a record, not an estimate. The change shown beside each series is the one the house printed with it, kept only where it agrees with the previous printed reading."), React.createElement("span", {
        className: "info-p"
      }, React.createElement("b", null, "Context, not a predictor."), " The series sit below the term\u2019s polls because confidence in the economy frames what voters hear; none of them forecasts how they\u2019ll answer."))
    },
    entries: []
  }, {
    id: "s-cycles",
    title: "Past cycles",
    nav: "Past cycles",
    lead: {
      id: "past-cycles",
      body: React.createElement(React.Fragment, null, "Every term since 1972, lined up on its own election day, so a given month is the same distance into every term. Compare this term with every past term, or only those whose government was re-elected or ousted, as a level or as the change since the election.", React.createElement("span", {
        className: "info-p"
      }, React.createElement("b", null, "How it\u2019s built."), " Past terms are averaged month by month the way this term is. A month with no poll is filled in from the months either side, dashed on a drawn term. A line\u2019s dotted start runs from the election\u2019s count to the term\u2019s first poll, and its dotted end from the final poll to the next election\u2019s count."), React.createElement("span", {
        className: "info-p"
      }, React.createElement("b", null, "The measures."), " Two-party preferred is implied from each poll\u2019s primary votes, through the", " ", xref("last-election-flows", "past cycles", "flows of the election that opened its term"), ". The primary vote is the governing party\u2019s and the main opposition party\u2019s. The leaders are rated by net approval since 1972 and preferred prime minister since 1984, following whoever held the office; the earliest terms\u2019 ratings are the Morgan Gallup Poll\u2019s, and favourability ratings are left out. How the final polls have done scores the polls against each result (see ", xref("how-wrong-are-the-polls", "past cycles", "How accurate are the polls?"), "). The CSV download holds every poll behind the terms shown."))
    },
    entries: [{
      id: "last-election-flows",
      term: "Last-election flows",
      body: React.createElement(React.Fragment, null, "The flow table a term\u2019s implied 2PP is read through: the preferences counted at the election that opened the term. From 1987 it\u2019s the only table anyone inside the term could have used (the earlier ones are reconstructions, below), so each past term sits on the same footing as today\u2019s", " ", xref("implied-2pp", "last-election flows", "implied 2PP"), ". The sitting term follows the rival Labor is doing worse against, as the headline does", onSince ? React.createElement(React.Fragment, null, ": the Coalition until ", onSince, ", One Nation since") : null, ", and the chart marks the change.", React.createElement("span", {
        className: "info-p"
      }, React.createElement("b", null, "How it\u2019s worked out."), " A poll\u2019s two-party figure for Labor is its Labor primary vote, plus each other group\u2019s primary vote times that group\u2019s flow to Labor in the term\u2019s table, plus a small fixed correction: whatever the table leaves between the opening election\u2019s own primary votes and its official result (Coalition preferences leaking to Labor in three-cornered seats, or the few seats a count didn\u2019t cover), never more than ", lefAnchorMax.toFixed(2), " points. With it, each term starts exactly at the official result. A poll that doesn\u2019t list a party separately reads it at the election\u2019s own mix, and one whose shares don\u2019t total 100 is rescaled first."), React.createElement("span", {
        className: "info-p"
      }, React.createElement("b", null, "Where the tables come from."), " From 2004, the AEC\u2019s count of every ballot between Labor and the Coalition, in every seat. For 1996\u20132001, its official statistics, from the seats where the final two were Labor and the Coalition: 142 to 145 of the 148 to 150. Before 1996 the AEC published no flows by party. Every seat\u2019s full distribution exists from 1984, and flows by party can be estimated from it (the", " ", React.createElement("a", {
        href: "/flows-explained/"
      }, "preference flows explainer"), " charts them), but the 1987\u201393 polls on file give one combined figure for the minor parties, so each of those terms uses the single minor-party flow its opening election\u2019s official result implies, which reproduces that election exactly. The Morgan Gallup polls of 1943\u201384 published no two-party figure at all, so those terms are read through tables fitted to the two-party result of the election that opened each term. Each table solves one flow so that it reproduces that result: everyone else\u2019s to 1954, the DLP\u2019s to 1975, the Democrats\u2019 from 1977. The rest are fixed: everyone else at 45%, and the DLP at 27% once its vote collapsed. Two are assumptions: the Democrats\u2019 50% in the 1975 table, since they had never stood, and the DLP\u2019s 27% in 1955, the year of the Labor split, whose solved value (0.2%) misread 1957\u201358. With nothing solved, the 1955 table misses its own election by 1.4 points, so that term starts off its official result. Before 1984 those results are themselves estimates, by the Parliamentary Library and Malcolm Mackerras, so these tables are fitted to estimates, not counts. And since no one at the time had the flows, they reconstruct what a last-election reading would have given, rather than one anyone could have made."), lefMean != null ? React.createElement("span", {
        className: "info-p"
      }, React.createElement("b", null, "How well it works."), " Applied to the next election\u2019s actual primary votes, each table since 1984 misses the counted 2PP by ", lefMean.toFixed(1), " points on average. The biggest misses were ", lefBigText, ".", lefOldMean != null ? React.createElement(React.Fragment, null, " The older tables miss by ", lefOldMean.toFixed(1), " on average, but before 1984 the official two-party results are themselves estimates, built partly on assumed preference flows, so those misses measure agreement with an estimate, not a count, and probably flatter the tables: the 1958\u201383 ones miss by only ", lefMidMean != null ? lefMidMean.toFixed(1) : "0.2", ", and the 1955 table\u2019s DLP flow was chosen with the 1958 result in view. Read their real error as at least the counted era\u2019s.") : null, LPM ? React.createElement(React.Fragment, null, " Either way the conversion is the smaller error: the final polls before 1984 missed the official two-party result by ", LPM.tpp.toFixed(1), " points on average, almost all of it through their primary votes (Labor\u2019s alone missed by ", LPM.prim.toFixed(1), ").") : null) : null, working(lefWork))
    }]
  }, {
    id: "s-allpolls",
    title: "All polls",
    nav: "All polls",
    lead: {
      id: "all-polls",
      body: React.createElement(React.Fragment, null, "Every national poll since the 2025 election, newest first, each linked to its source. Its views give each poll\u2019s two-party figures, primary votes, leader ratings, national direction, issues, and group breakdowns (a party\u2019s vote in one of the poll\u2019s groups minus its vote in another).", React.createElement("span", {
        className: "info-p"
      }, "The two-party view reads every poll\u2019s primary votes through the 2025 flows, so the polls compare like for like, with the pollster\u2019s own figure beneath where it published one. Those flows carry the same doubt for every poll, so each poll\u2019s interval is sampling error alone. A poll\u2019s ", xref("poll-lean", "all polls", "lean"), " is how far it sits from the other polls fielded within three weeks of it, averaged as the headline is. Open a row for the poll\u2019s full breakdown, and use Download CSV for the polls the table is showing."))
    },
    entries: [{
      id: "poll-lean",
      term: "Poll lean",
      body: React.createElement(React.Fragment, null, "How far one poll sits from the other polls fielded around the same time, averaged as the headline is. It describes that poll, not the pollster: sampling luck alone can put a single poll off the pace. A pollster whose polls lean the same way again and again is showing its", " ", xref("house-effect", "poll lean", "house effect"), ".")
    }, {
      id: "aggregate-effect",
      term: "Aggregate effect",
      body: React.createElement(React.Fragment, null, "How much one poll moves the headline. The poll\u2019s breakdown recalculates the", " ", xref("weighted-aggregate", "aggregate effect", "weighted aggregate"), " without it: \u201C+0.1 for ALP\u201D means today\u2019s two-party figure is a tenth of a point higher because this poll is in the window. One line appears for each figure the poll feeds: the published two-party figure, the ", xref("implied-2pp", "aggregate effect", "implied 2PP"), ", and Labor v One Nation where the poll asked it. A poll older than 21 days moves nothing now, and says so, with what it was worth when published where that can still be worked out. House effects are left as measured, since they belong to the pollster, not the poll.")
    }, {
      id: "apc-statement",
      term: "APC statement",
      body: React.createElement(React.Fragment, null, "The methodology statement a pollster publishes for each poll under the Australian Polling Council\u2019s Code of Conduct: fieldwork dates and method, the raw sample, the effective sample (what that sample is worth after weighting), the weighting used, and the question order. It is the pollster\u2019s own publication; nothing is lodged with the council. A poll\u2019s breakdown links it, and its effective sample sets the poll\u2019s weight in the", " ", xref("weighted-aggregate", "APC statement", "weighted aggregate"), ". Newspoll, YouGov, Essential, DemosAU, RedBridge/Accent, and Fox & Hedgehog publish one. Where a pollster publishes none, the ", eff, " column shows a dash: the site doesn\u2019t invent a figure the pollster never published.")
    }, {
      id: "mrp",
      term: "MRP",
      body: React.createElement(React.Fragment, null, "Multilevel regression and post-stratification: a model that estimates each seat separately instead of applying one national swing everywhere. Seat figures appear only where a pollster built such a model and published the results, and the MRP tag marks those polls.")
    }, {
      id: "poll-disagreement",
      term: "Poll disagreement",
      body: React.createElement(React.Fragment, null, "Whether the pollsters disagree more than chance explains. No two polls match even when opinion hasn\u2019t moved, because each surveys a different sample. The panel compares how far the polls actually spread with how far their sample sizes alone would scatter them, and the ratio gives one of four verdicts:", React.createElement("span", {
        className: "info-p"
      }, React.createElement("b", null, verdict.herd), " (under 0.80\xD7): closer together than independent samples can be, which suggests pollsters are adjusting towards each other."), React.createElement("span", {
        className: "info-p"
      }, React.createElement("b", null, verdict.ok), " (0.80\u20131.20\xD7): as close as sampling allows, which is what healthy polling looks like."), React.createElement("span", {
        className: "info-p"
      }, React.createElement("b", null, verdict.mild), " (1.20\u20131.60\xD7): something real sits on top of chance, such as different weighting, different voters reached, or opinion moving at different speeds."), React.createElement("span", {
        className: "info-p"
      }, React.createElement("b", null, verdict.wide), " (1.60\xD7 or more): the gap can\u2019t be chance. The pollsters aren\u2019t measuring one number with different luck."))
    }, {
      id: "house-lean",
      term: "House lean",
      body: React.createElement(React.Fragment, null, "Each pollster\u2019s ", xref("house-effect", "house lean", "house effect"), " traced month by month, so a change of method or ownership shows where it happened instead of being smeared across its history.", RD ? React.createElement(React.Fragment, null, " The One Nation\u2013Coalition split view is a pollster\u2019s lean on One Nation\u2019s primary vote less its lean on the Coalition\u2019s: how it splits the right\u2019s vote.") : null)
    }]
  }];
  const about = React.createElement(React.Fragment, null, React.createElement("p", {
    className: "info-about-p"
  }, "auspol tracker is an unofficial aggregator of Australian federal political polls. It collects published polls, adjusts each for its pollster\u2019s lean, weights them by recency and sample size, and pools them into aggregate estimates. To be clear, the site runs no polls of its own; it only gathers and presents those published by others. It aims to cut through the noise and give a clear view of Australian political sentiment: how Australians intend to vote, and their views on leaders, issues, and our country\u2019s direction."), React.createElement("p", {
    className: "info-about-p"
  }, React.createElement("b", null, "Updates."), " New polls are added as they are released, mostly by automated checks but also manually by me (some guy). Every figure is rebuilt when a new poll lands."), React.createElement("p", {
    className: "info-about-p"
  }, React.createElement("b", null, "Following along."), " The ", React.createElement("a", {
    className: "fb-link",
    href: "/feed.xml"
  }, "RSS feed"), " lists each new poll as it is added, with a link to the pollster\u2019s own release.", !window.JUR ? React.createElement(React.Fragment, null, " The ", React.createElement("a", {
    className: "fb-link",
    href: "/changelog/"
  }, "change log"), " records what has moved the two-party preferred estimate, each statistical finding and the economic-confidence gauges, entry by entry.") : null), React.createElement("p", {
    className: "info-about-p"
  }, React.createElement("b", null, "Feedback."), " Spot a wrong number or have any other feedback?", " ", React.createElement("a", {
    className: "fb-link",
    href: "/feedback/"
  }, "Let me know"), "."), React.createElement("p", {
    className: "info-about-p"
  }, React.createElement("b", null, "Archives."), " Older federal polling archives are kept", " ", React.createElement("a", {
    className: "fb-link",
    href: "/provenance/"
  }, "here"), " for safekeeping."));
  if (window.JUR) {
    const J = window.JUR;
    const eYear = ((D.cycles || []).find(c => c.current) || {}).eDate || "2022";
    const eY = eYear.slice(0, 4),
      eMonth = D.monthNameFull(Number(eYear.slice(5, 7)) || 11);
    const pct = v => (100 * v).toFixed(1) + "%";
    const FL = J.flows;
    const names = slot => J.eras[slot].map(e => e.name);
    const onFirst = (() => {
      const base = (D.aggPrimary || []).find(d => d.election);
      const f = (D.aggPrimary || []).find(d => !d.election && d.onp != null);
      return base && f && f.x - base.x > 0.5 ? D.monthNameFull(Number(f.ym.slice(5))) + " " + f.ym.slice(0, 4) : null;
    })();
    const topHouses = Object.keys(houseCounts).sort((a, b) => houseCounts[b] - houseCounts[a]).slice(0, 3);
    const keepMethod = new Set(["house-effect", "monthly-average", "interval", "margin-of-error", "effective-sample", "significance"]);
    const keepAll = new Set(["poll-lean", "aggregate-effect", "mrp", "poll-disagreement", "house-lean"]);
    const fedAll = (sections.find(s => s.id === "s-allpolls") || {
      entries: []
    }).entries;
    const KAL = !!(L.method && L.method.kind === "kalman");
    const perMonth = k => J.kalman && J.kalman.series[k] ? (J.kalman.series[k].s * Math.sqrt(30)).toFixed(1) : null;
    const vFaqs = [KAL ? {
      id: "what-am-i-looking-at",
      q: "What am I looking at?",
      a: React.createElement(React.Fragment, null, "In the main chart, each dot is one published poll, placed at the midpoint of its fieldwork. The line is a smoothed trend through all the polls, adjusted for each pollster\u2019s ", xref("house-effect", "what am i looking at", "lean"), ", with its", " ", xref("interval", "what am i looking at", "95% interval"), " shaded around it (see", " ", xref("weighted-aggregate", "what am i looking at", "Smoothed trend"), "). Where two bands overlap, the polls can\u2019t separate the parties. The figure at the top is the trend\u2019s estimate today, where the line ends. Other charts follow the same pattern. A dash (\u2014) in a table means the pollster didn\u2019t ask that question.")
    } : faqs.find(f => f.id === "what-am-i-looking-at"), {
      id: "where-does-data-come-from",
      q: "Where do the numbers come from?",
      a: React.createElement(React.Fragment, null, "From the pollsters: every Victorian voting-intention poll published since the ", eMonth, " ", eY, " election, from these ", Object.keys(houseCounts).length, " houses, most polls first:", " ", sources, ". A pollster\u2019s MRP or SMS polls count under its own name. All polls files each one with its fieldwork dates, sample size, a link to the release and, where one exists, its", " ", xref("apc-statement", "where does data come from", "APC statement"), ".")
    }, KAL ? {
      id: "headline-how",
      q: "How is the headline worked out?",
      a: React.createElement(React.Fragment, null, "It is the smoothed trend\u2019s estimate today, from every poll so far, with each pollster\u2019s usual lean taken out (see ", xref("weighted-aggregate", "how is the headline worked out", "Smoothed trend"), "). Rather than average the pollsters\u2019 own two-party figures, each worked out a different way, the two-party figure reads every poll\u2019s primary votes through one fixed", " ", xref("preference-flows", "how is the headline worked out", "preference table"), " (see", " ", xref("implied-2pp", "how is the headline worked out", "Implied 2PP"), "). The headline follows the rival Labor is doing worse against", headFig ? React.createElement(React.Fragment, null, ": today ", headFig.rival, ", at ", headFig.a.toFixed(1), "\u2013", headFig.b.toFixed(1)) : null, ".")
    } : faqs.find(f => f.id === "headline-how"), {
      id: "how-wrong-are-the-polls",
      q: "How accurate are the polls?",
      a: React.createElement(React.Fragment, null, "The ", xref("interval", "how accurate are the polls", "95% interval"), " says how far chance alone could put a figure off: \xB1", hl.ci.toFixed(1), " points on each party\u2019s share for Labor against the Coalition today. Unfortunately, no aggregate can see an error every pollster shares, which is why the interval never claims to cover it.")
    }, {
      id: "is-this-a-forecast",
      q: "Is it a forecast? What would it mean in seats?",
      a: React.createElement(React.Fragment, null, "No to both. Everything here describes where opinion stands now, from polls already published, and final polls have missed past results. Turning a statewide figure into seats would assume the swing is the same everywhere. With One Nation near ", onp, "% of the primary vote, that fails in exactly the seats that would decide the election: a large minor party wins where its vote is concentrated, and a statewide figure can\u2019t see where that is. Where a pollster modelled seats one by one, its poll carries the ", xref("mrp", "is it a forecast", "MRP"), " ", "tag in All polls.")
    }, faqs.find(f => f.id === "why-2pp-headline"), KAL ? {
      id: "newest-poll-not-headline",
      q: "Why doesn’t the newest poll match the headline?",
      a: React.createElement(React.Fragment, null, "Usually neither is wrong. A poll is one pollster\u2019s reading of one week, and chance alone can put it off by its ", xref("margin-of-error", "newest poll", "margin of error"), ", so two honest polls of an unchanged electorate will differ too. The headline is a trend through every poll after removing each pollster\u2019s", " ", xref("house-effect", "newest poll", "house effect"), ", its habit of leaning one way. One poll moves it by its weight, not its news value: its", " ", xref("aggregate-effect", "newest poll", "aggregate effect"), " shows how much.", " ", xref("poll-disagreement", "newest poll", "Poll disagreement"), " tests whether the polls differ by more than chance allows.")
    } : faqs.find(f => f.id === "newest-poll-not-headline"), faqs.find(f => f.id === "more-menu-figures")].filter(Boolean);
    const vMethod = KAL ? [{
      id: "weighted-aggregate",
      term: "Smoothed trend",
      body: React.createElement(React.Fragment, null, "How the headline and every line on this page are built. Victoria publishes only a poll or two a month, so rather than average each month\u2019s polls, the site draws a smoothed trend through all of them, with a Kalman smoother. It treats opinion as drifting from day to day, and each poll as a reading of it, off by its pollster\u2019s", " ", xref("house-effect", "smoothed trend", "lean"), " and by chance.", React.createElement("span", {
        className: "info-p"
      }, React.createElement("b", null, "How much a poll counts."), " Larger samples count for more. Where a pollster publishes an ", xref("effective-sample", "smoothed trend", "effective sample"), ", that figure is used. Otherwise the raw sample is discounted by 1.6, roughly what weighting costs the pollsters that do publish, and capped at 3,000."), React.createElement("span", {
        className: "info-p"
      }, React.createElement("b", null, "How smooth."), " How far opinion may drift in a day is the one setting, fitted to Victoria\u2019s own polls for each line: about ", perMonth("imp"), " points a month for the two-party figure. On a change of Premier or Opposition Leader the trend may step at once."), React.createElement("span", {
        className: "info-p"
      }, React.createElement("b", null, "The line and the headline."), " The line uses every poll, earlier and later, so a month\u2019s point can shift a little as later polls come in. The headline is the trend\u2019s estimate today, from the polls published so far, and the line ends on it."), React.createElement("span", {
        className: "info-p"
      }, React.createElement("b", null, "Months with no poll."), " The trend carries on through them, and its 95% interval widens until the next poll arrives."), React.createElement("span", {
        className: "info-p"
      }, React.createElement("b", null, "One exclusion."), " Roy Morgan\u2019s Victorian polls are all SMS polls. They stay in the archive but count towards no figure: SMS polls have a strong selection bias."), React.createElement("span", {
        className: "info-p"
      }, React.createElement("b", null, "Why not a monthly average?"), " With one or two polls behind each month, a monthly line jumps by a poll\u2019s sampling error alone. A trial on this page\u2019s polls found the trend moves half as much from month to month, and predicts each new poll from the polls before it as well as the federal page\u2019s three-week average does."), working(React.createElement(React.Fragment, null, React.createElement("span", {
        className: "info-p"
      }, "Opinion \u03BC follows a random walk: \u03BC\u209C = \u03BC\u209C\u208B\u2081 + \u03B7\u209C, with \u03B7\u209C ~ N(0, s\xB2) a day. A poll on day t reads y\u1D62 = \u03BC\u209C + h\u2C7C + \u03B5\u1D62, where h\u2C7C is its pollster\u2019s lean and \u03B5\u1D62 ~ N(0, 1.6 \xD7 p(1\u2212p) \xF7 n\u1D62 + \u03C4\xB2). s and \u03C4 are fitted by maximum likelihood on Victoria\u2019s polls, line by line. The leans are estimated with the trend, average zero across the polls, and start from a prior worth about one and a half polls sitting on the others. A change of leader adds a 2-point standard deviation on its day."), React.createElement("span", {
        className: "info-p"
      }, "The filter runs a day at a time from the election\u2019s count; the line is its Rauch\u2013Tung\u2013Striebel smooth, and the 95% interval 1.96 times its standard deviation. The change on a month ago is tested against the posterior uncertainty of the trend\u2019s move over those 30 days."))))
    }, {
      id: "house-effect",
      term: "House effect",
      body: React.createElement(React.Fragment, null, "A pollster\u2019s consistent lean relative to the others. The trend estimates each pollster\u2019s lean alongside the line, from all its polls, and takes it out; the leans average zero across the polls. A lean measured from few polls is shrunk toward zero. Each line gets its own leans, since a pollster that leans to Labor on the two-party figure need not on a primary vote. The Pollster leans page, in the More menu, traces each pollster\u2019s lean month by month, measured the federal page\u2019s way.")
    }, method.find(m => m.id === "monthly-average"), {
      id: "interval",
      term: "95% interval",
      body: React.createElement(React.Fragment, null, "How far a figure could plausibly be off by chance. For the two-party figure against the Coalition today, that\u2019s \xB1", hl.ci.toFixed(1), " points on each party\u2019s share, and \xB1", (2 * hl.ci).toFixed(1), " on the lead. It is the trend\u2019s own interval: it narrows where polls come thick and widens through months with none.", React.createElement("span", {
        className: "info-p"
      }, "Unfortunately, it can\u2019t see an error every poll shares. When the whole industry leans one way, the interval has no way to know."))
    }, method.find(m => m.id === "margin-of-error"), {
      id: "effective-sample",
      term: "Effective sample",
      body: React.createElement(React.Fragment, null, "What a sample is worth once weighting is counted. A pollster\u2019s", " ", xref("apc-statement", "effective sample", "APC statement"), " gives one for each poll, shown as ", eff, " beside its sample, and it sets how much the poll counts in the", " ", xref("weighted-aggregate", "effective sample", "trend"), ".")
    }, method.find(m => m.id === "significance"), {
      id: "changes",
      q: "What are the ▲ and ▼ figures measured against?",
      a: React.createElement(React.Fragment, null, "It depends on where they sit.", React.createElement("ul", {
        className: "info-list"
      }, React.createElement("li", null, React.createElement("strong", null, "Beside a current figure:"), " the trend\u2019s move over the past month. It counts as a change only when it is larger than its own margin, the 95% interval of that move; otherwise the figure says \u201Cwithin the margin\u201D."), React.createElement("li", null, React.createElement("strong", null, "On the primary vote figures:"), " the change since the ", eY, " election, where the lines on that chart begin."), React.createElement("li", null, React.createElement("strong", null, "In a poll\u2019s breakdown and the poll tables:"), " the change on that pollster\u2019s own previous poll.")), "Most say what they are measured against beside them, or when you point at them.")
    }].filter(Boolean) : [{
      id: "weighted-aggregate",
      term: "Weighted aggregate",
      body: React.createElement(React.Fragment, null, "How the headline and every other current figure are built. It averages the recent polls, giving more weight to newer and larger ones, after removing each pollster\u2019s", " ", xref("house-effect", "weighted aggregate", "house effect"), ".", React.createElement("span", {
        className: "info-p"
      }, React.createElement("b", null, "Recency."), " A poll\u2019s weight halves every seven days, and it fades out over its third week, leaving the window on day 21. So the figure can move on a day with no new poll, as newer polls take over from older ones."), React.createElement("span", {
        className: "info-p"
      }, React.createElement("b", null, "Size."), " Larger samples count for more. Where a pollster publishes an ", xref("effective-sample", "weighted aggregate", "effective sample"), ", that figure is used. Otherwise the raw sample is discounted by 1.6, roughly what weighting costs the pollsters that do publish, and capped at 3,000."), React.createElement("span", {
        className: "info-p"
      }, React.createElement("b", null, "Repeat polls."), " A pollster with several polls in the window counts for the square root of their number, so three polls from one pollster count as 1.7, not 3."), React.createElement("span", {
        className: "info-p"
      }, React.createElement("b", null, "One exclusion."), " Roy Morgan\u2019s Victorian polls are all SMS polls. They stay in the archive but count towards no aggregate: SMS polls have a strong selection bias."), React.createElement("span", {
        className: "info-p"
      }, React.createElement("b", null, "Sparse measures."), " Victorian pollsters ask about the leaders only now and then, so every leader rating and preferred ", J.office.alb, " use a six-week window. There a poll\u2019s weight halves every 14 days."), React.createElement("span", {
        className: "info-p"
      }, React.createElement("b", null, "Monthly lines."), " Each chart\u2019s line uses the same method without the recency weighting: one point per calendar month, from that month\u2019s polls. A few measures depart from all this, and their sections say how."), working(React.createElement(React.Fragment, null, React.createElement("span", {
        className: "info-p"
      }, "The headline is \u03A3w\u1D62x\u1D62 \xF7 \u03A3w\u1D62 over the polls in the 21-day window, where x\u1D62 is a poll\u2019s figure minus its house effect and w\u1D62 = n\u1D62 \xD7 2^(\u2212d/7) \xD7 t(d) \xF7 \u221Am."), React.createElement("span", {
        className: "info-p"
      }, React.createElement("b", null, "n\u1D62"), " is the poll\u2019s sample: its published effective sample \xD7 1.6 (the design factor) where the pollster publishes one, otherwise its raw sample capped at 3,000, or 1,200 if no sample is given. ", React.createElement("b", null, "d"), " is the poll\u2019s age in days, counted from its fieldwork midpoint. ", React.createElement("b", null, "t(d)"), " is 1 up to day 14, then a half-cosine taper to 0 at day 21. ", React.createElement("b", null, "m"), " is the number of polls that pollster has in the window. The window\u2019s effective sample is (\u03A3w\u1D62)\xB2 \xF7 \u03A3w\u1D62\xB2. If the window is empty, the last monthly point stands in. The six-week window doubles every timescale: half-life 14 days, taper from day 28 to day 42."), React.createElement("span", {
        className: "info-p"
      }, React.createElement("b", null, "Worked example: the Labor primary."), " Each party\u2019s primary is estimated the same way. The five are rescaled only if their total sits more than half a point from the plain-average total, so a real shortfall from undecided voters is kept."), primWork, React.createElement("span", {
        className: "info-p"
      }, React.createElement("b", null, "Worked example: the published 2PP."), " A pair published with undecided voters still inside it is rebased to 100 first. A pollster that publishes no pair adds no row."), tppWork)))
    }, ...method.filter(m => keepMethod.has(m.id)), {
      id: "changes",
      q: "What are the ▲ and ▼ figures measured against?",
      a: React.createElement(React.Fragment, null, "It depends on where they sit.", React.createElement("ul", {
        className: "info-list"
      }, React.createElement("li", null, React.createElement("strong", null, "Beside a current figure:"), " the change on a month ago, from the same estimate built from the polls of 30 days earlier. It counts as a change only when it is larger than its own margin, which combines both readings\u2019 intervals; otherwise the figure says \u201Cwithin the margin\u201D."), React.createElement("li", null, React.createElement("strong", null, "On the primary vote figures:"), " the change since the ", eY, " election, where the lines on that chart begin."), React.createElement("li", null, React.createElement("strong", null, "In a poll\u2019s breakdown and the poll tables:"), " the change on that pollster\u2019s own previous poll.")), "Most say what they are measured against beside them, or when you point at them.")
    }];
    const vSections = [{
      id: "s-2pp",
      title: "Two-party preferred",
      nav: "Two-party",
      lead: {
        id: "two-party-preferred",
        body: React.createElement(React.Fragment, null, "Each party\u2019s share after every other candidate\u2019s preferences have been distributed between the final two. It\u2019s the figure that decides seats. The section shows Labor against the Coalition and, where pollsters ask it, against One Nation, and leads with the one Labor is doing worse against", onSince ? React.createElement(React.Fragment, null, ": the Coalition until ", onSince, ", One Nation since") : null, ". Both are ", xref("implied-2pp", "two-party preferred", "implied"), " from each poll\u2019s primary votes, with the pollsters\u2019 own published figures a switch away.", React.createElement("span", {
          className: "info-p"
        }, React.createElement("b", null, "Published figures"), " are averaged as Labor\u2019s share of the two. A pair published with undecided voters still inside it is rescaled to 100 first, splitting them in proportion, only because a pair on its own gives no basis for splitting them any other way."))
      },
      entries: [{
        id: "implied-2pp",
        term: "Implied 2PP",
        body: React.createElement(React.Fragment, null, "The site\u2019s main two-party figure, on the hero and the summary. It takes each poll\u2019s primary votes and distributes the minor parties\u2019 shares using one fixed", " ", xref("preference-flows", "implied 2PP", "preference table"), ": against the Coalition, the flows of the ", eY, " Victorian election. Every pollster allocates preferences its own way, so one table for all of them means the figure moves when voters do, not when the mix of pollsters changes. It also counts every poll that publishes primaries, including those with no two-party figure of their own.", React.createElement("span", {
          className: "info-p"
        }, "Neither it nor the published figure is the true 2PP.", D.synthLatest && D.synth2pp && D.synth2pp.length > 1 ? React.createElement(React.Fragment, null, " Against the Coalition today, the implied figure reads ", D.synthLatest.alp.toFixed(1), " ", "and the published ", L.alp2pp.toFixed(1), ". With One Nation on ", onp, "% of the primary vote, five points of doubt about where its preferences go moves the two-party figure", " ", (prim.onp * 0.05).toFixed(1), " points either way.") : null), L.onImp ? React.createElement("span", {
          className: "info-p"
        }, "Labor v One Nation uses a different table, the", " ", xref("fp-flows", "implied 2PP", "Labor v One Nation flows"), ", because no election has ever counted that pairing: ", L.onImp.a.toFixed(1), " to Labor,", " ", L.onImp.b.toFixed(1), " to One Nation, \xB1", onM.toFixed(1), " once doubt about that", " ", "table is added to the polls\u2019 own margin.") : null)
      }, {
        id: "preference-flows",
        term: "Preference flows",
        body: React.createElement(React.Fragment, null, "How minor-party votes split between the final two candidates once preferences are distributed. The ", xref("implied-2pp", "preference flows", "implied 2PP"), " against the Coalition uses the flows of the ", eY, " Victorian election: Greens ", pct(FL.grn), " and all others ", pct(FL.oth), " to Labor. The Victorian Electoral Commission publishes each district\u2019s count but no statewide flow by party, so the site measured them: the Greens\u2019 from the districts where Labor and the Coalition were the final two, and the others\u2019 set so that the official ", eY, " primary votes give the official 55.0\u201345.0 result. One Nation won 0.3% in ", eY, ", too little to measure, so its flow is the 2025 federal election\u2019s: ", pct(FL.onp), " to Labor.", React.createElement("span", {
          className: "info-p"
        }, React.createElement("b", null, "Are they still flowing that way?"), " The Respondent-allocated preference flows page, in the More menu, checks. The pollsters\u2019 own two-party figures come largely from where their respondents say their preferences would go, so if those drift from where the pollster\u2019s primary votes and the ", eY, " flows put them, voters may be sending preferences differently. The check corrects no other figure."))
      }, {
        id: "fp-flows",
        term: "Labor v One Nation flows",
        body: React.createElement(React.Fragment, null, "The preference table behind the Labor v One Nation figure. No election has ever counted that contest, so the site estimates the table for the federal page from the ballots that do exist, and Victoria\u2019s figure borrows it unchanged. Three settings do all the work: Coalition voters give", " ", fpc(FT.lnp), " to Labor (\xB1", fpt(FB.lnp), "), Greens ", fpc(FT.grn), " (\xB1", fpt(FB.grn), ") and everyone else ", fpc(FT.oth), " (\xB1", fpt(FB.oth), "). The rest go to One Nation.", L.onImp && prim ? React.createElement("span", {
          className: "info-p"
        }, "On today\u2019s primaries: Labor\u2019s ", prim.alp.toFixed(1), ", plus", " ", fpc(FT.lnp), " of the Coalition\u2019s ", prim.lnp.toFixed(1), ", ", fpc(FT.grn), " of the Greens\u2019 ", prim.grn.toFixed(1), " and ", fpc(FT.oth), " of the others\u2019 ", prim.oth.toFixed(1), ", gives ", L.onImp.a.toFixed(1), " to Labor and ", L.onImp.b.toFixed(1), " to One Nation. The table\u2019s own range, \xB1", L.onImp.band.toFixed(1), ", adds up the three settings\u2019 ranges. It measures doubt about the table, not sampling chance, so the hero adds it to the polls\u2019", " ", "own margin", L.onImp.cs != null ? React.createElement(React.Fragment, null, " (\xB1", L.onImp.cs.toFixed(1), ")") : null, " as a", " ", "separate error: \xB1", onM.toFixed(1), " in all, \xB1", (2 * onM).toFixed(1), " on the lead.") : null, React.createElement("span", {
          className: "info-p"
        }, React.createElement("b", null, "Where the numbers come from."), " The ballots that do exist, all federal or from other states: the AEC\u2019s 2025 Senate ballot data, read through the 2026 lower-house contests where One Nation made the final two, the SA state election and the Secret Harbour by-election. The table stays fixed between such evidence and is never fitted to current polls."))
      }]
    }, {
      id: "s-primary",
      title: "Primary vote",
      nav: "Primary vote",
      lead: {
        id: "primary-vote",
        body: React.createElement(React.Fragment, null, "The share of voters who put a party first, before any preferences are distributed.", KAL ? React.createElement(React.Fragment, null, " Each party\u2019s line is a smoothed trend through every poll, with each pollster\u2019s lean taken out, built like the two-party trend (see ", xref("weighted-aggregate", "primary vote", "Smoothed trend"), ").") : React.createElement(React.Fragment, null, " Each party\u2019s figure is built like the headline, from the last three weeks of polls with each pollster\u2019s lean taken out (see ", xref("weighted-aggregate", "primary vote", "Weighted aggregate"), ")."), " ", "The lines start at the ", eY, " election result, and the figures beside the chart give the change since then.", onFirst ? React.createElement(React.Fragment, null, " One Nation\u2019s line starts in ", onFirst, ": until then, the polls counted it among others.") : null, React.createElement("span", {
          className: "info-p"
        }, React.createElement("b", null, "Why they may not add up to 100."), " Some pollsters keep voters who won\u2019t name a party inside their published shares, so the parties fall short of 100 by exactly that undecided share. ", KAL ? React.createElement(React.Fragment, null, "Each party\u2019s trend is estimated on its own, so the five need not add to exactly 100 either.") : React.createElement(React.Fragment, null, "The aggregate keeps the shortfall, because it says something real about the electorate: the five parties are rescaled only if their total sits more than half a point from the plain average\u2019s."), " Each poll\u2019s breakdown says which approach its pollster used."))
      },
      entries: []
    }, {
      id: "s-latest",
      title: "Latest and next polls",
      nav: "Latest polls",
      lead: {
        id: "latest-polls",
        body: React.createElement(React.Fragment, null, "The newest poll from each pollster, and when its next is likely to land. An earlier poll leaves the table once a newer one comes out, and All polls keeps every poll this term. If a published poll is missing from All polls too, that\u2019s an error: please", " ", React.createElement("a", {
          className: "fb-link",
          href: "/feedback/"
        }, "report it"), ".")
      },
      entries: [{
        id: "house",
        term: "House",
        body: React.createElement(React.Fragment, null, "A polling company: ", topHouses.join(", "), " and the rest. The industry calls them houses. A single poll release is often called a wave.")
      }, {
        id: "next-polls",
        term: "Next polls",
        body: React.createElement(React.Fragment, null, "When each pollster is likely to publish next, forecast from its own track record. The dates are merely estimates.", React.createElement("span", {
          className: "info-p"
        }, React.createElement("b", null, "The date"), " is the house\u2019s last release plus the median of its last eight gaps between releases, nudged by up to three days onto the weekday it usually publishes. ", React.createElement("b", null, "The \xB1"), " is half the spread of those gaps, leaving out the longest and shortest, and widens for releases further out. A house too irregular for a date gets a window instead."), React.createElement("span", {
          className: "info-p"
        }, React.createElement("b", null, "Late polls."), " When a date passes with no poll, the row stays and keeps counting, turning red once the whole window has passed. A date gets two days of grace for a poll simply running late; a dated slot still unrecorded on the third morning is treated as skipped, and the forecast moves on to the house\u2019s next plausible date. A window forecast names no one day to break, so it holds its seat until the wave is added. The countdown in the tab bar works the same way."), React.createElement("span", {
          className: "info-p"
        }, "Open a row to check the forecast against the house\u2019s five most recent releases."))
      }]
    }, {
      id: "s-leaders",
      title: "Leadership",
      nav: "Leadership",
      lead: {
        id: "leadership",
        body: React.createElement(React.Fragment, null, "Three questions, each kept apart: who would make the better", " ", xref("preferred-pm", "leadership", J.office.alb), ", how each leader is doing the job (", xref("approval", "leadership", "approval"), "), and what voters think of each as a person (", xref("favourability", "leadership", "favourability"), ").", React.createElement("span", {
          className: "info-p"
        }, React.createElement("b", null, "Approval and favourability"), " are monthly averages adjusted for each pollster\u2019s lean, as the vote is, except that every poll counts equally, whatever its sample: a handful of houses answering the same question is not one pooled sample. A pollster that publishes both measures lends its second reading to the other line."), React.createElement("span", {
          className: "info-p"
        }, React.createElement("b", null, "Preferred ", J.office.alb), " is averaged by sample size with no house adjustment. Pollsters leave very different shares uncommitted, so one pollster\u2019s figures run high or low for both leaders at once. That is a difference of format, not a lean, so levels can\u2019t be compared across pollsters, though gaps and trends can. Two-way and three-way questions are never averaged together."), React.createElement("span", {
          className: "info-p"
        }, React.createElement("b", null, "One office, several people."), " ", andList(names("alb")), " have led Labor this term, and ", andList(names("opp")), " the Liberals. Each leader\u2019s readings are kept apart, so a change of leader never reads as a move in one person\u2019s numbers."), React.createElement("span", {
          className: "info-p"
        }, React.createElement("b", null, "The current figures"), " are built like the headline, from the last six weeks of polls, since Victorian pollsters ask about the leaders only now and then. Each counts only the polls taken since its leader took the job."))
      },
      entries: [{
        id: "preferred-pm",
        term: "Preferred " + J.office.alb,
        body: React.createElement(React.Fragment, null, "Who voters say would make the better ", J.office.alb, ". Pollsters ask it head to head, the ", J.office.alb, " against the ", J.office.opp, ", and some ask it three-way, with One Nation\u2019s leader too. Each format is its own line.")
      }, {
        id: "approval",
        term: "Approval",
        body: React.createElement(React.Fragment, null, "A rating of how a leader is doing the job: the share who approve minus the share who disapprove, called net approval.")
      }, {
        id: "favourability",
        term: "Favourability",
        body: React.createElement(React.Fragment, null, "A rating of the leader as a person: favourable minus unfavourable. A leader can be approved of for the job and disliked as a person, so", " ", xref("approval", "favourability", "approval"), " and favourability are never averaged together.")
      }]
    }, {
      id: "s-allpolls",
      title: "All polls",
      nav: "All polls",
      lead: {
        id: "all-polls",
        body: React.createElement(React.Fragment, null, "Every Victorian poll since the ", eY, " election, newest first, each linked to its source. Its views give each poll\u2019s two-party figures, primary votes and leader ratings.", React.createElement("span", {
          className: "info-p"
        }, "The two-party view reads every poll\u2019s primary votes through the", " ", eY, " flows, so the polls compare like for like, with the pollster\u2019s own figure beneath where it published one. Those flows carry the same doubt for every poll, so each poll\u2019s interval is sampling error alone. A poll\u2019s ", xref("poll-lean", "all polls", "lean"), " is how far it sits from the trend through the other polls. Open a row for the poll\u2019s full breakdown, and use Download CSV for the polls the table is showing."))
      },
      entries: [...fedAll.filter(e => keepAll.has(e.id) && e.id !== "mrp" && e.id !== "poll-disagreement" && e.id !== "house-lean" && !(KAL && e.id === "aggregate-effect")), ...(KAL ? [{
        id: "aggregate-effect",
        term: "Aggregate effect",
        body: React.createElement(React.Fragment, null, "How much one poll moves the headline. The poll\u2019s breakdown reruns the", " ", xref("weighted-aggregate", "aggregate effect", "trend"), " without it: \u201C+0.1 for ALP\u201D means today\u2019s two-party figure is a tenth of a point higher because this poll is in it. Every poll this term counts, the older ones for less. One line appears for each figure the poll feeds: the published two-party figure, the", " ", xref("implied-2pp", "aggregate effect", "implied 2PP"), ", and Labor v One Nation where the poll asked it.")
      }] : []), {
        id: "apc-statement",
        term: "APC statement",
        body: React.createElement(React.Fragment, null, "The methodology statement a pollster publishes for each poll under the Australian Polling Council\u2019s Code of Conduct: fieldwork dates and method, the raw sample, the effective sample (what that sample is worth after weighting), the weighting used, and the question order. It is the pollster\u2019s own publication; nothing is lodged with the council. A poll\u2019s breakdown links it, and its effective sample sets the poll\u2019s weight in the ", xref("weighted-aggregate", "APC statement", "weighted aggregate"), ". Where a pollster publishes none, the ", eff, " column shows a dash: the site doesn\u2019t invent a figure the pollster never published.")
      }, ...fedAll.filter(e => e.id === "mrp" || e.id === "poll-disagreement" || e.id === "house-lean")]
    }];
    const vAbout = React.createElement(React.Fragment, null, React.createElement("p", {
      className: "info-about-p"
    }, J.brand, " tracker is the Victorian edition of auspol tracker, an unofficial aggregator of Victorian state political polls. It collects published polls, adjusts each for its pollster\u2019s lean, weights them by recency and sample size, and pools them into aggregate estimates. To be clear, the site runs no polls of its own; it only gathers and presents those published by others. It aims to give a clear view of how Victorians intend to vote at the ", J.nextElection.label.replace(/^\w+day /, ""), " election, and what they think of the leaders."), React.createElement("p", {
      className: "info-about-p"
    }, React.createElement("b", null, "Updates."), " New polls are added as they are released, and every figure is rebuilt when one lands."), React.createElement("p", {
      className: "info-about-p"
    }, React.createElement("b", null, "Feedback."), " Spot a wrong number or have any other feedback?", " ", React.createElement("a", {
      className: "fb-link",
      href: "/feedback/"
    }, "Let me know"), "."), React.createElement("p", {
      className: "info-about-p"
    }, React.createElement("b", null, "Federal polling."), " The federal edition,", " ", React.createElement("a", {
      className: "fb-link",
      href: "/"
    }, "auspol tracker"), ", tracks the next Australian federal election."));
    const vAll = [...vFaqs, ...vMethod, ...vSections.flatMap(s => [{
      ...s.lead,
      term: s.title,
      lead: true
    }, ...s.entries])];
    return {
      faqs: vFaqs,
      method: vMethod,
      sections: vSections,
      about: vAbout,
      all: vAll
    };
  }
  const all = [...faqs, ...method, ...sections.flatMap(s => [{
    ...s.lead,
    term: s.title,
    lead: true
  }, ...s.entries])];
  return {
    faqs,
    method,
    sections,
    about,
    all
  };
}
function InfoBack({
  onBack,
  backLabel
}) {
  return React.createElement("button", {
    className: "back-to-chart info-back",
    onClick: onBack
  }, React.createElement("svg", {
    viewBox: "0 0 24 24",
    width: "13",
    height: "13",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true"
  }, React.createElement("path", {
    d: "M19 12H5M11 18l-6-6 6-6"
  })), "Back to ", backLabel || "where you were");
}
const INFO_ALIAS = {
  "change-arrows": "changes",
  "deltas": "changes",
  "individual-poll": "what-am-i-looking-at",
  "polling-error": "how-wrong-are-the-polls",
  "seat-projection": "is-this-a-forecast",
  "sources": "where-does-data-come-from",
  "lead-interval-double": "interval",
  "chance-consistent": "poll-disagreement",
  "mild-divergence": "poll-disagreement",
  "real-disagreement": "poll-disagreement",
  "dots-past-the-line": "what-am-i-looking-at",
  "headline-moved-no-poll": "weighted-aggregate",
  "polls-disagree": "newest-poll-not-headline",
  "two-party-to-seats": "is-this-a-forecast",
  "poll-without-2pp": "implied-2pp",
  "essential-pair-not-100": "two-party-preferred",
  "primaries-not-100": "primary-vote",
  "next-poll-when": "next-polls",
  "poll-i-saw-not-here": "latest-polls",
  "net-approval": "approval",
  "undecided": "decidedness"
};
function InfoView({
  focus,
  onBack,
  backLabel
}) {
  const {
    D
  } = window.AP;
  const {
    faqs,
    method,
    sections,
    about
  } = infoTerms(D);
  const target = focus ? INFO_ALIAS[focus] || focus : null;
  React.useLayoutEffect(() => {
    if (!target) return;
    const el = document.getElementById("term-" + target);
    if (!el) return;
    const prev = el.previousElementSibling;
    const head = prev && prev.classList.contains("info-group") ? prev : null;
    const tall = el.getBoundingClientRect().height > window.innerHeight * 0.5;
    (head || el).scrollIntoView({
      block: head || tall ? "start" : "center",
      behavior: "auto"
    });
  }, [target]);
  const jump = id => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({
      block: "start",
      behavior: SM
    });
  };
  const CH = [["info-about", "About"], ["info-faq", "Questions"], ["info-method", "How the figures are built"]];
  const PANELS_ID = "info-sections";
  const [on, setOn] = React.useState("info-about");
  const [tocOpen, setToc] = React.useState(false);
  const onLabel = (() => {
    const c = CH.find(([id]) => id === on);
    if (c) return c[1];
    if (on === PANELS_ID) return "The panels";
    const g = sections.find(s => s.id === on);
    return g ? g.title : null;
  })();
  React.useEffect(() => {
    const els = ["info-about", "info-faq", "info-method", PANELS_ID, ...sections.map(g => g.id)].map(id => document.getElementById(id)).filter(Boolean);
    if (els.length < 2) return;
    const spy = () => {
      const bar = document.querySelector(".info-toc");
      const line = (bar && bar.offsetParent ? bar.getBoundingClientRect().bottom : 56) + 26;
      let cur = els[0].id;
      for (const el of els) if (el.getBoundingClientRect().top <= line) cur = el.id;
      setOn(prev => prev === cur ? prev : cur);
    };
    spy();
    window.addEventListener("scroll", spy, {
      passive: true
    });
    return () => window.removeEventListener("scroll", spy);
  }, []);
  const entry = (t, H) => React.createElement("div", {
    key: t.id,
    id: "term-" + t.id,
    className: "info-term" + (target === t.id ? " lit" : "")
  }, t.q ? React.createElement(React.Fragment, null, React.createElement(H, {
    className: "info-t"
  }, t.q), " ") : t.term ? React.createElement(React.Fragment, null, React.createElement(H, {
    className: "info-t"
  }, t.term + "."), " ") : null, t.a || t.body, target === t.id && onBack && React.createElement(InfoBack, {
    onBack: onBack,
    backLabel: backLabel
  }));
  const tocBtn = (id, label, cls) => React.createElement("button", {
    key: id,
    type: "button",
    className: cls + (on === id ? " on" : ""),
    "aria-current": on === id ? "true" : undefined,
    onClick: () => {
      jump(id);
      setToc(false);
    }
  }, label);
  const contents = React.createElement(React.Fragment, null, CH.map(([id, label]) => tocBtn(id, label, "info-toc-c")), tocBtn(PANELS_ID, "The panels", "info-toc-g"), sections.map(g => tocBtn(g.id, g.title, "info-toc-p")));
  return React.createElement("section", {
    className: "card info"
  }, React.createElement("div", {
    className: "rd-eyebrow"
  }, React.createElement("h2", {
    className: "rd-title"
  }, "Info"), React.createElement("span", {
    className: "rd-meta"
  }, "How the site works")), React.createElement(RdHed, {
    level: 2,
    head: window.AP.PAGE_HEAD.info,
    dek: "What things mean, how things are built, how to read them, and their limitations. Each section has its own explainer, and where applicable, the formulas and working are shown for transparency."
  }), React.createElement("div", {
    className: "info-toc"
  }, React.createElement("button", {
    type: "button",
    className: "info-toc-btn",
    "aria-expanded": tocOpen,
    "aria-controls": "info-toc-list",
    onClick: () => setToc(o => !o)
  }, React.createElement("span", {
    className: "info-toc-caret" + (tocOpen ? " up" : ""),
    "aria-hidden": "true"
  }, "\u25BE"), " Contents", onLabel ? React.createElement("span", {
    className: "info-toc-on"
  }, onLabel) : null), tocOpen && React.createElement("div", {
    className: "info-toc-scrim",
    "aria-hidden": "true",
    onClick: () => setToc(false)
  }), tocOpen && React.createElement("nav", {
    className: "info-toc-list",
    id: "info-toc-list",
    "aria-label": "On this page"
  }, contents)), React.createElement("div", {
    className: "info-cols"
  }, React.createElement("nav", {
    className: "info-index",
    "aria-label": "On this page"
  }, contents), React.createElement("div", {
    className: "info-main"
  }, React.createElement("h2", {
    id: "info-about",
    className: "card-title info-h"
  }, "About"), React.createElement("div", {
    className: "info-about"
  }, about), React.createElement("h2", {
    id: "info-faq",
    className: "card-title info-h info-h-faq"
  }, "Questions"), faqs.map(f => entry(f, "h3")), React.createElement("h2", {
    id: "info-method",
    className: "card-title info-h info-h-faq"
  }, "How the figures are built"), method.map(t => entry(t, "h3")), React.createElement("h2", {
    id: PANELS_ID,
    className: "card-title info-h info-h-faq"
  }, "The panels"), sections.map(g => React.createElement(React.Fragment, {
    key: g.id
  }, React.createElement("h3", {
    id: g.id,
    className: "info-group"
  }, g.title), entry(g.lead, "h4"), g.entries.map(t => entry(t, "h4")))))));
}
function TermPop({
  id,
  onClose,
  onMore
}) {
  const {
    D
  } = window.AP;
  const {
    all
  } = React.useMemo(() => infoTerms(D), []);
  const key = INFO_ALIAS[id] || id;
  const hit = all.find(t => t.id === key);
  const boxRef = React.useRef(null);
  React.useEffect(() => {
    const prev = document.activeElement;
    boxRef.current && boxRef.current.focus();
    const onKey = e => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      prev && prev.focus && prev.focus();
    };
  }, [id]);
  React.useEffect(() => {
    if (!hit) onMore();
  }, [hit]);
  if (!hit) return null;
  const head = hit.q || hit.term;
  return ReactDOM.createPortal(React.createElement("div", {
    className: "term-pop-scrim",
    onClick: onClose
  }, React.createElement("div", {
    className: "term-pop",
    role: "dialog",
    "aria-modal": "true",
    "aria-label": head,
    tabIndex: -1,
    ref: boxRef,
    onClick: e => e.stopPropagation()
  }, React.createElement("div", {
    className: "term-pop-head"
  }, React.createElement("h2", {
    className: "term-pop-t"
  }, head), React.createElement("button", {
    type: "button",
    className: "term-pop-x",
    onClick: onClose,
    "aria-label": "Close"
  }, "\xD7")), React.createElement("div", {
    className: "term-pop-body info-term"
  }, hit.a || hit.body), React.createElement("button", {
    type: "button",
    className: "term-pop-more",
    onClick: onMore
  }, "Read it in Info \u2192"))), document.body);
}
Object.assign(window, {
  Tabs,
  PastCyclesView,
  AllPollsView,
  MenuPageView,
  InfoView,
  TermPop,
  ArchSortTh,
  ArchImplied,
  ArchPublished,
  ArchTpp,
  ArchLead,
  ArchApprCell,
  ArchDirCell,
  archLeadInfo,
  issTopOf,
  issBestOf,
  ISS_PARTY_META,
  ArchIssTop,
  ArchIssBest,
  DEM_SPLITS,
  demGroupsOf,
  demPairOf,
  ISS_MAP,
  ISS_MAP_LAB,
  ISS_ALIAS,
  issOwnOf,
  issLeadOf
});