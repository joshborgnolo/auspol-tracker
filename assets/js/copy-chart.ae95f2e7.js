(() => {
  "use strict";

  const BTN_CLASS = "chart-copy-btn";
  const STRIP_SEL = "." + BTN_CLASS + ", .hero-controls, .hero-alt, .hero-chartbar, .hero > .pg-check";
  const COPY_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
  const TICK_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>';
  const CAN_COPY = window.isSecureContext && !!navigator.clipboard && typeof navigator.clipboard.write === "function";
  const ACTION_LABEL = CAN_COPY ? "Copy chart as image" : "Save chart as PNG";
  const STYLE_PROPS = ["display", "position", "top", "right", "bottom", "left", "z-index", "box-sizing", "width", "height", "min-width", "max-width", "min-height", "max-height", "margin-top", "margin-right", "margin-bottom", "margin-left", "padding-top", "padding-right", "padding-bottom", "padding-left", "float", "clear", "overflow", "overflow-x", "overflow-y", "flex", "flex-direction", "flex-wrap", "flex-grow", "flex-shrink", "flex-basis", "align-items", "align-self", "align-content", "justify-content", "justify-items", "justify-self", "order", "gap", "row-gap", "column-gap", "grid-template-columns", "grid-template-rows", "grid-column", "grid-row", "grid-area", "aspect-ratio", "object-fit", "object-position", "vertical-align", "border-collapse", "border-spacing", "table-layout", "color", "opacity", "visibility", "background-color", "background-image", "background-position", "background-size", "background-repeat", "background-clip", "background-origin", "border-top-width", "border-top-style", "border-top-color", "border-right-width", "border-right-style", "border-right-color", "border-bottom-width", "border-bottom-style", "border-bottom-color", "border-left-width", "border-left-style", "border-left-color", "border-radius", "box-shadow", "text-shadow", "outline", "font-family", "font-size", "font-weight", "font-style", "font-stretch", "font-variant", "font-variant-numeric", "line-height", "text-align", "text-indent", "text-transform", "text-decoration", "letter-spacing", "word-spacing", "white-space", "word-break", "overflow-wrap", "text-overflow", "direction", "transform", "transform-origin", "appearance", "-webkit-appearance", "fill", "fill-opacity", "fill-rule", "stroke", "stroke-width", "stroke-opacity", "stroke-dasharray", "stroke-dashoffset", "stroke-linecap", "stroke-linejoin", "stroke-miterlimit", "text-anchor", "dominant-baseline", "alignment-baseline", "transform-box", "paint-order", "stop-color", "stop-opacity", "vector-effect"];
  const VOID_TAGS = new Set(["IMG", "INPUT", "BR", "HR", "WBR", "AREA", "BASE", "COL", "EMBED", "SOURCE", "TRACK"]);
  let fontCss = null;
  const collectFontCss = () => {
    if (fontCss !== null) return fontCss;
    const out = [];
    for (const sheet of document.styleSheets) {
      let rules;
      try {
        rules = sheet.cssRules;
      } catch (e) {
        continue;
      }
      for (const rule of rules) {
        if (rule.type === CSSRule.FONT_FACE_RULE) out.push(rule.cssText);
      }
    }
    fontCss = out.join("\n");
    return fontCss;
  };
  const decls = cs => {
    const parts = [];
    for (const prop of STYLE_PROPS) {
      const value = cs.getPropertyValue(prop);
      if (value) parts.push(prop + ":" + value + ";");
    }
    return parts.join("");
  };
  const bakePseudo = (srcEl, dstEl, pseudo, before) => {
    let cs;
    try {
      cs = getComputedStyle(srcEl, pseudo);
    } catch (e) {
      return;
    }
    if (!cs || typeof cs.getPropertyValue !== "function") return;
    const content = cs.getPropertyValue("content");
    if (!content || content === "none" || content === "normal") return;
    const span = document.createElement("span");
    const m = /^"(.*)"$/s.exec(content) || /^'(.*)'$/s.exec(content);
    if (m) span.textContent = m[1];
    span.setAttribute("style", decls(cs));
    if (before) dstEl.insertBefore(span, dstEl.firstChild);else dstEl.appendChild(span);
  };
  const elasticSet = target => {
    const set = new Set();
    target.querySelectorAll(STRIP_SEL).forEach(el => {
      for (let p = el.parentElement; p; p = p.parentElement) {
        set.add(p);
        if (p === target) break;
      }
    });
    return set;
  };
  const bake = (srcEl, dstEl, elastic) => {
    dstEl.setAttribute("style", decls(getComputedStyle(srcEl)));
    if (elastic && elastic.has(srcEl)) {
      dstEl.style.height = "auto";
      dstEl.style.minHeight = "0";
      dstEl.style.maxHeight = "none";
    }
    const sKids = srcEl.children;
    const dKids = dstEl.children;
    let j = 0;
    for (let i = 0; i < sKids.length; i++) {
      if (sKids[i].matches && sKids[i].matches(STRIP_SEL)) continue;
      bake(sKids[i], dKids[j++], elastic);
    }
    if (!VOID_TAGS.has(srcEl.tagName) && srcEl.namespaceURI.indexOf("svg") === -1) {
      bakePseudo(srcEl, dstEl, "::before", true);
      bakePseudo(srcEl, dstEl, "::after", false);
    }
  };
  const HEADINGS = "h1, h2, h3, h4";
  const pickTarget = host => {
    for (let el = host, depth = 0; el && el !== document.body && depth < 6; el = el.parentElement, depth++) {
      if (el.querySelectorAll(".chart").length === 1 && (el.querySelector(HEADINGS) || el.querySelector(".legend, .hero-legend"))) {
        return el;
      }
    }
    return host;
  };
  const fileName = (target, svg) => {
    const head = target.querySelector(HEADINGS);
    const raw = head && head.textContent || svg && svg.getAttribute("aria-label") || "chart";
    const label = raw.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "chart";
    return `${window.JUR ? window.JUR.brand : "auspol"}-${label}.png`;
  };
  const pageBg = () => {
    const c = getComputedStyle(document.body).backgroundColor;
    return c && c !== "rgba(0, 0, 0, 0)" && c !== "transparent" ? c : "#ffffff";
  };
  const SVG_PROPS = ["fill", "fill-opacity", "fill-rule", "stroke", "stroke-width", "stroke-opacity", "stroke-dasharray", "stroke-dashoffset", "stroke-linecap", "stroke-linejoin", "stroke-miterlimit", "opacity", "color", "display", "visibility", "font-family", "font-size", "font-weight", "font-style", "letter-spacing", "text-anchor", "dominant-baseline", "paint-order", "vector-effect", "transform", "transform-origin", "transform-box", "mix-blend-mode"];
  const COPY_W = 1120;
  const widenForCopy = async svg => {
    const host = svg.closest(".chart");
    const anchor = host && host.parentElement;
    if (!host || !anchor) return () => {};
    const hostStyle = host.getAttribute("style"),
      anchorStyle = anchor.getAttribute("style");
    const hostRect = host.getBoundingClientRect();
    const anchorRect = anchor.getBoundingClientRect();
    const anchorCS = getComputedStyle(anchor);
    const bL = parseFloat(anchorCS.borderLeftWidth) || 0;
    const bT = parseFloat(anchorCS.borderTopWidth) || 0;
    const frozenSibs = [];
    for (const sib of anchor.children) {
      if (sib === host) continue;
      const cs = getComputedStyle(sib);
      if (cs.position !== "static" && cs.position !== "relative" && cs.position !== "sticky") continue;
      const r = sib.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      frozenSibs.push({
        el: sib,
        style: sib.getAttribute("style"),
        left: r.left - anchorRect.left - bL,
        top: r.top - anchorRect.top - bT,
        width: r.width,
        height: r.height
      });
    }
    anchor.style.height = anchorRect.height + "px";
    anchor.style.overflow = "hidden";
    if (anchorCS.position === "static") anchor.style.position = "relative";
    for (const f of frozenSibs) {
      const s = f.el.style;
      s.position = "absolute";
      s.margin = "0";
      s.left = f.left + "px";
      s.top = f.top + "px";
      s.width = f.width + "px";
      s.height = f.height + "px";
    }
    const stand = host.cloneNode(true);
    stand.classList.add("copy-stand");
    stand.style.position = "fixed";
    stand.style.margin = "0";
    stand.style.top = hostRect.top + "px";
    stand.style.left = hostRect.left + "px";
    stand.style.width = hostRect.width + "px";
    stand.style.height = hostRect.height + "px";
    stand.style.pointerEvents = "none";
    stand.setAttribute("aria-hidden", "true");
    document.body.appendChild(stand);
    host.setAttribute("data-copying", "");
    host.style.position = "absolute";
    host.style.top = "0";
    host.style.left = "-99999px";
    host.style.width = COPY_W + "px";
    for (let i = 0; i < 38; i++) {
      await new Promise(r => setTimeout(r, 16));
      const live = host.querySelector("svg.chart-svg") || svg;
      if (Math.abs((+live.getAttribute("data-copy-cw") || 0) - COPY_W) <= 1) break;
    }
    return () => {
      if (stand.parentNode) stand.parentNode.removeChild(stand);
      host.setAttribute("data-copy-settle", "");
      setTimeout(() => host.removeAttribute("data-copy-settle"), 400);
      host.removeAttribute("data-copying");
      if (hostStyle == null) host.removeAttribute("style");else host.setAttribute("style", hostStyle);
      for (const f of frozenSibs) {
        if (f.style == null) f.el.removeAttribute("style");else f.el.setAttribute("style", f.style);
      }
      if (anchorStyle == null) anchor.removeAttribute("style");else anchor.setAttribute("style", anchorStyle);
    };
  };
  const bakeSvg = src => {
    const clone = src.cloneNode(true);
    const walk = (a, b) => {
      const cs = getComputedStyle(a);
      let out = "";
      for (const prop of SVG_PROPS) {
        const v = cs.getPropertyValue(prop);
        if (v) out += prop + ":" + v + ";";
      }
      b.setAttribute("style", out);
      const ak = a.children,
        bk = b.children;
      for (let i = 0; i < ak.length; i++) walk(ak[i], bk[i]);
    };
    walk(src, clone);
    const vb = (src.getAttribute("viewBox") || "0 0 1000 420").split(/\s+/).map(Number);
    let [bx, by, bw, bh] = vb;
    try {
      const r = src.getBoundingClientRect(),
        k = bw / r.width,
        m = 4;
      const shown = el => {
        for (let n = el; n && n !== src; n = n.parentElement) {
          const cs = getComputedStyle(n);
          if (cs.display === "none" || cs.visibility === "hidden" || parseFloat(cs.opacity) === 0) return false;
        }
        return true;
      };
      let x0 = bx,
        y0 = by,
        x1 = bx + bw,
        y1 = by + bh;
      for (const t of src.querySelectorAll("text")) {
        if (!t.textContent.trim() || !shown(t)) continue;
        const q = t.getBoundingClientRect();
        x0 = Math.min(x0, vb[0] + (q.left - r.left) * k - m);
        y0 = Math.min(y0, vb[1] + (q.top - r.top) * k - m);
        x1 = Math.max(x1, vb[0] + (q.right - r.left) * k + m);
        y1 = Math.max(y1, vb[1] + (q.bottom - r.top) * k + m);
      }
      if (r.width > 0) {
        bx = x0;
        by = y0;
        bw = x1 - x0;
        bh = y1 - y0;
      }
    } catch (e) {}
    clone.setAttribute("viewBox", [bx, by, bw, bh].join(" "));
    clone.setAttribute("width", bw);
    clone.setAttribute("height", bh);
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.style.visibility = "visible";
    clone.style.opacity = "1";
    clone.style.display = "block";
    return {
      markup: new XMLSerializer().serializeToString(clone),
      w: bw,
      h: bh
    };
  };
  const txt = el => {
    if (!el) return "";
    const val = r => {
      const sr = r.querySelector(".sr-only");
      return sr ? sr.textContent : "";
    };
    if (el.classList && el.classList.contains("roll")) return val(el).trim();
    const c = el.cloneNode(true);
    c.querySelectorAll(".roll").forEach(r => r.replaceWith(document.createTextNode(val(r))));
    c.querySelectorAll(".sr-only").forEach(n => n.remove());
    return (c.textContent || "").replace(/\s+/g, " ").trim();
  };
  const col = (el, prop) => el ? getComputedStyle(el)[prop || "color"] : null;
  const paint = css => {
    const el = document.createElement("span");
    el.style.color = css;
    document.body.appendChild(el);
    const v = getComputedStyle(el).color;
    el.remove();
    return v;
  };
  const inkVar = name => paint("var(" + name + ")");
  const readLegend = target => [...target.querySelectorAll(".hl-item, .legend-chip")].map(i => {
    const sw = i.querySelector(".hl-line,.hl-dashed,.hl-band,.hl-dot,.hl-swatch-dot,.legend-swatch");
    const k = sw ? sw.className || "" : "";
    const cs2 = sw ? getComputedStyle(sw) : null;
    const parts = [...i.children].filter(ch => !/swatch|hl-line|hl-dashed|hl-band|hl-dot/.test(ch.className || "")).map(ch => txt(ch)).filter(Boolean);
    return {
      label: parts.length ? parts.join(" ") : txt(i),
      kind: /hl-line/.test(k) ? "line" : /hl-dashed/.test(k) ? "dashed" : /hl-band/.test(k) ? "band" : /legend-swatch/.test(k) ? /\b(dashed|residual)\b/.test(i.className || "") ? "dashed" : "square" : "dot",
      fill: cs2 ? cs2.backgroundColor !== "rgba(0, 0, 0, 0)" ? cs2.backgroundColor : cs2.borderTopColor : "#888",
      alpha: (cs2 ? parseFloat(cs2.opacity) || 1 : 1) * (i.classList.contains("off") ? 0.45 : 1)
    };
  });
  const ownCopy = host => {
    const raw = host && host.getAttribute && host.getAttribute("data-copy");
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  };
  const composeCard = async (target, host) => {
    const svgEl = host && host.querySelector("svg.chart-svg") || target.querySelector("svg.chart-svg");
    if (!svgEl) throw new Error("no chart to compose");
    const restore = await widenForCopy(svgEl);
    try {
      return await composeCardInner(target, svgEl, ownCopy(host));
    } finally {
      restore();
    }
  };
  const composeCardInner = (target, svgEl, own) => new Promise((resolve, reject) => {
    const T = {
      bg: pageBg(),
      ink: inkVar("--ink"),
      ink2: inkVar("--ink-2"),
      ink3: inkVar("--ink-3")
    };
    const sans = getComputedStyle(document.querySelector(".card-sub") || document.body).fontFamily;
    const serif = getComputedStyle(document.querySelector(".card-title") || document.body).fontFamily;
    const isHero = !!target.querySelector(".hero-readout");
    const parties = [...target.querySelectorAll(".ro-party")].map(p => ({
      name: txt(p.querySelector(".ro-name")),
      num: txt(p.querySelector(".ro-num")),
      dot: col(p.querySelector(".ro-dot"), "backgroundColor"),
      ink: col(p.querySelector(".ro-num"))
    }));
    const board0 = target.classList.contains("ap-lean") && window.AP_LEAN_BOARD || target.classList.contains("ap-flow") && (window.AP_FLOW_BOARD || {})[target.id] || null;
    const titleBase = own && own.title || board0 && board0.title || txt(target.querySelector(".card-title, h2, h3")) || txt(target.querySelector(".rd-chead-t")) || (window.JUR ? window.JUR.brand : "auspol") + " tracker";
    const sub = own && own.sub != null ? own.sub : txt(target.querySelector(".card-sub"));
    const noteLead = (() => {
      if (!target.classList.contains("ap-flow")) return "";
      const n = txt(target.querySelector(".ap-var-note"));
      return (n.match(/^.*?[.!?](?=\s|$)/) || [n])[0];
    })();
    const caption = own && own.caption || board0 && board0.caption || noteLead || txt(target.querySelector(".hero-caption, .chart-note, .card-note"));
    const insightRuns = (() => {
      const el = target.querySelector(".cycle-insight");
      if (!el || !el.getClientRects().length) return null;
      const runs = [];
      const walk = n => {
        if (n.nodeType === 3) {
          if (n.nodeValue) runs.push({
            t: n.nodeValue,
            ink: T.ink2,
            bold: false
          });
          return;
        }
        if (n.nodeType !== 1) return;
        if (n.classList.contains("ci-delta")) {
          runs.push({
            t: n.textContent,
            ink: getComputedStyle(n).color,
            bold: true
          });
          return;
        }
        n.childNodes.forEach(walk);
      };
      el.childNodes.forEach(walk);
      return runs.some(r => r.t.trim()) ? runs : null;
    })();
    const AUS = window.AUSPOL || {};
    const cycList = AUS.cycles && (Array.isArray(AUS.cycles) ? AUS.cycles : Object.values(AUS.cycles));
    const board = (() => {
      if (!cycList || !target.closest || !target.closest(".view-cycles")) return [];
      const off = new Set((window.AP_CYC_BOARD || {}).off || []);
      const has = own && Array.isArray(own.terms) ? new Set(own.terms) : null;
      return cycList.map(c => ({
        year: c.year,
        off: off.has(c.year) || !!has && !has.has(c.year),
        current: !!c.current
      })).sort((a, b) => a.year - b.year);
    })();
    const cycleLegend = () => {
      const labels = [...svgEl.querySelectorAll(".end-label")];
      if (!cycList || !labels.length) return [];
      if (!target.closest || !target.closest(".view-cycles")) {
        const lines = [...svgEl.querySelectorAll("path.series-line")];
        return labels.map(t => {
          const id = t.getAttribute("data-series");
          const line = id != null && lines.find(p => p.getAttribute("data-series") === id);
          const cs = line && getComputedStyle(line);
          return {
            label: txt(t),
            kind: cs && cs.strokeDasharray && cs.strokeDasharray !== "none" ? "dashed" : "line",
            fill: cs ? cs.stroke : getComputedStyle(t).fill,
            alpha: 1,
            year: 9999
          };
        });
      }
      const opp = /opposition/i.test(titleBase + " " + sub);
      const resolve = c => {
        const el = document.createElement("span");
        el.style.color = c;
        document.body.appendChild(el);
        const v = getComputedStyle(el).color;
        el.remove();
        return v;
      };
      const leaders = (AUS.LEADERS || []).map(l => ({
        id: l.id,
        name: l.name,
        col: resolve(l.color)
      }));
      const firstYear = id => {
        const lm = AUS.leaderMonths || [];
        const hit = lm.find(r => r[id + "_net"] != null) || lm.find(r => Object.keys(r).some(k => k.indexOf(id + "_") === 0 && r[k] != null));
        return hit && hit.ym ? String(hit.ym).slice(0, 4) : null;
      };
      const entries = labels.map(t => {
        const text = (t.textContent || "").trim();
        const fill = getComputedStyle(t).fill;
        if (text === "L/NP+ON") return {
          label: "L/NP and One Nation combined",
          kind: "dashed",
          fill,
          alpha: 1,
          year: 9999
        };
        if (text === "ON") return {
          label: "One Nation this term",
          kind: "dashed",
          fill,
          alpha: 1,
          year: 9999
        };
        const digits = text.replace(/[^0-9]/g, "");
        const c = !/[A-Za-z]/.test(text) && digits.length === 2 && cycList.find(r => String(r.year).slice(2) === digits);
        if (c) return {
          label: c.year + " " + (opp ? c.oppLead || c.lead : c.lead),
          kind: "line",
          fill,
          alpha: 1,
          year: c.year
        };
        const m = leaders.find(l => l.col === fill);
        const from = m && firstYear(m.id);
        return {
          label: m ? m.name + (from ? ", from " + from : "") : (t.textContent || "").trim(),
          kind: "dashed",
          fill,
          alpha: 1,
          year: 9999
        };
      });
      const sitting = board.find(b => b.current && !b.off);
      const sitCyc = sitting && cycList.find(r => r.year === sitting.year);
      const sitLine = sitCyc && !entries.some(e => e.year === sitCyc.year) && [...svgEl.querySelectorAll("path.series-line")].find(p => (p.getAttribute("data-series") || "").split("-")[0] === "c" + sitCyc.year);
      if (sitLine) entries.push({
        label: sitCyc.year + " " + (opp ? sitCyc.oppLead || sitCyc.lead : sitCyc.lead),
        kind: "line",
        fill: getComputedStyle(sitLine).stroke,
        alpha: 1,
        year: sitCyc.year
      });
      entries.sort((a, b) => a.year - b.year);
      if (svgEl.querySelector(".cyc-band")) {
        const named = new Set(entries.filter(e => e.year < 9000).map(e => e.year));
        const years = board.filter(c => !c.off && !c.current && !named.has(c.year)).map(c => c.year);
        if (years.length) {
          const order = board.map(c => c.year);
          const member = new Set(years);
          const spans = [];
          for (let i = 0; i < order.length; i++) {
            if (!member.has(order[i])) continue;
            const last = spans[spans.length - 1];
            if (last && member.has(order[i - 1])) last.push(order[i]);else spans.push([order[i]]);
          }
          const spanFmt = run => run.length === 1 ? String(run[0]) : run[0] + "–" + (String(run[0]).slice(0, 2) === String(run[run.length - 1]).slice(0, 2) ? String(run[run.length - 1]).slice(2) : run[run.length - 1]);
          const lo = svgEl.querySelector(".cyc-band.lo"),
            hiB = svgEl.querySelector(".cyc-band.hi");
          entries.push({
            label: "Past terms (" + spans.map(spanFmt).join(", ") + "): mean of the set, middle half, and middle 80%",
            kind: "cycband",
            fill: lo ? getComputedStyle(lo).fill : inkVar("--cyc-fill"),
            lo: lo ? parseFloat(getComputedStyle(lo).opacity) || 0.09 : 0.09,
            hi: hiB ? parseFloat(getComputedStyle(hiB).opacity) || 0.17 : 0.17,
            alpha: 1,
            year: 9998
          });
          entries.sort((a, b) => a.year - b.year);
        }
      }
      return entries;
    };
    const solid = cl => /^var\(/.test(cl) ? inkVar(cl.slice(4, -1).trim()) : cl;
    const boardLegend = () => {
      const isLean = target.classList.contains("ap-lean");
      const b = isLean ? window.AP_LEAN_BOARD : (window.AP_FLOW_BOARD || {})[target.id];
      if (!b) return [];
      const out = [];
      if (b.pooled) {
        out.push({
          label: b.pooled.name + (b.pooled.value ? "  " + b.pooled.value : ""),
          kind: "line",
          fill: inkVar("--ink"),
          alpha: b.pooled.off ? 0.45 : 1
        });
        if (b.pooled.interval && !b.pooled.off) out.push({
          label: "95% interval (shaded)",
          kind: "shade",
          fill: inkVar("--ink-faint"),
          alpha: 1
        });
      }
      b.items.forEach(i => out.push({
        label: i.name + (i.value ? "  " + i.value : ""),
        kind: "line",
        fill: solid(i.color),
        alpha: i.off ? 0.45 : 1
      }));
      return out;
    };
    const stated = !!(own && Array.isArray(own.legend));
    let legend = stated ? own.legend.map(l => ({
      label: l.label,
      kind: l.kind === "band" ? "shade" : ["dashed", "shade", "dot", "ring"].includes(l.kind) ? l.kind : "line",
      fill: paint(l.color),
      alpha: l.kind === "band" ? 0.4 : 1
    })) : readLegend(target);
    if (!stated && !legend.length && board0) legend = boardLegend();
    if (!stated && !legend.length) legend = cycleLegend();
    if (target.classList.contains("ap-var")) legend.push({
      label: "Chance floor (shaded)",
      kind: "shade",
      fill: inkVar("--ink-faint"),
      alpha: 1
    });
    const meta = [txt(target.querySelector(".hi-method")), txt(target.querySelector(".hi-count"))].filter(Boolean).join(", ");
    const lead = [txt(target.querySelector(".lead-tag")), txt(target.querySelector(".delta")), txt(target.querySelector(".hero-sub-note"))].filter(Boolean).join("  ");
    const hero = isHero && parties.length === 2;
    const abRange = (a, b) => {
      const short = typeof b === "number" && String(a).slice(0, 2) === String(b).slice(0, 2);
      return a + "\u2013" + (short ? String(b).slice(2) : b);
    };
    const cycs = board;
    const yrs = legend.map(l => l.year).filter(y => y && y < 9000).sort((a, b) => a - b);
    const xLabels = [...svgEl.querySelectorAll(".axis-label.x")].map(n => txt(n)).filter(Boolean);
    const datey = t => /[0-9]/.test(t) && !/^(Election|\d+ ?yrs?)$/i.test(t);
    let span = own && typeof own.span === "string" ? own.span : "",
      cycSpan = false;
    if (!span && cycs.length) {
      const runs = [];
      cycs.forEach((c, i) => {
        if (c.off) return;
        const prev = i > 0 ? cycs[i - 1] : null;
        if (prev && !prev.off && runs.length) runs[runs.length - 1].push(c);else runs.push([c]);
      });
      const ranges = runs.map(run => {
        const first = run[0],
          next = cycs[cycs.indexOf(run[run.length - 1]) + 1];
        if (!next && run[run.length - 1].current) return abRange(first.year, "present");
        const end = next ? next.year : run[run.length - 1].year;
        return end === first.year ? String(first.year) : abRange(first.year, end);
      });
      if (ranges.length) {
        span = ranges.join(", ");
        cycSpan = true;
      }
    }
    if (!span && yrs.length >= 2) span = abRange(yrs[0], yrs[yrs.length - 1]);else if (!span && xLabels.length >= 2 && datey(xLabels[0]) && datey(xLabels[xLabels.length - 1])) span = xLabels[0] + " \u2013 " + xLabels[xLabels.length - 1];
    const title = span ? titleBase + (cycSpan ? ", " : "  \u00b7  ") + span : titleBase;
    const {
      markup,
      w: vw,
      h: vh
    } = bakeSvg(svgEl);
    const img = new Image();
    img.onerror = () => reject(new Error("chart did not rasterise"));
    img.onload = () => {
      try {
        const S = 2,
          W = 1200,
          PAD = 64,
          IW = W - PAD * 2;
        const chartH = Math.round(IW * (vh / vw));
        const m = document.createElement("canvas").getContext("2d");
        m.font = "400 15px " + sans;
        const capLines = wrapText(m, caption, IW);
        m.font = "600 14px " + sans;
        const LEG_GAP = 26,
          SW_W = 26;
        const legLines = [];
        let line = [],
          used = 0;
        legend.forEach(it => {
          const w = SW_W + m.measureText(it.label).width + LEG_GAP;
          if (used + w > IW && line.length) {
            legLines.push(line);
            line = [];
            used = 0;
          }
          line.push(it);
          used += w;
        });
        if (line.length) legLines.push(line);
        m.font = "400 16px " + sans;
        const subLines = (() => {
          if (!sub) return [];
          const all = wrapText(m, sub, IW);
          if (all.length <= 2) return all;
          const first = (sub.match(/^.*?[.!?](?=\s|$)/) || [sub])[0];
          return wrapText(m, first, IW).slice(0, 3);
        })();
        const titleFit = px => {
          m.font = "600 " + px + "px " + serif;
          if (m.measureText(title).width <= IW) return [title];
          const head = titleBase + (cycSpan ? "," : "");
          if (span && m.measureText(head).width <= IW && m.measureText(span).width <= IW) return [head, span];
          return wrapText(m, title, IW);
        };
        let TITLE_PX = 40;
        let titleLines = titleFit(TITLE_PX);
        if (titleLines.length > 2) {
          TITLE_PX = 32;
          titleLines = titleFit(TITLE_PX);
        }
        const TITLE_LH = Math.round(TITLE_PX * 1.2);
        const titleExtra = (titleLines.length - 1) * TITLE_LH;
        const INS_PX = 17,
          INS_LH = 25;
        const insFont = bold => (bold ? "700 " : "400 ") + INS_PX + "px " + sans;
        const insLines = (() => {
          if (!insightRuns) return [];
          const lines = [];
          let cur = [],
            used = 0;
          insightRuns.forEach(r => {
            r.t.replace(/\s+/g, " ").split(/(\s)/).forEach(tok => {
              if (!tok) return;
              m.font = insFont(r.bold);
              const w = m.measureText(tok).width;
              if (tok === " ") {
                if (cur.length) {
                  cur.push({
                    ...r,
                    t: tok,
                    w
                  });
                  used += w;
                }
                return;
              }
              if (used + w > IW && cur.length) {
                while (cur.length && cur[cur.length - 1].t === " ") used -= cur.pop().w;
                lines.push(cur);
                cur = [];
                used = 0;
              }
              cur.push({
                ...r,
                t: tok,
                w
              });
              used += w;
            });
          });
          if (cur.length) lines.push(cur);
          return lines;
        })();
        const insBlock = insLines.length ? 14 + insLines.length * INS_LH : 0;
        const headBlock = hero ? 92 + 34 + 26 : sub ? 40 + (subLines.length - 1) * 22 : 8;
        const H = 76 + titleExtra + headBlock + insBlock + 30 + chartH + 34 + legLines.length * 26 + (capLines.length ? 8 + capLines.length * 22 : 0) + 56;
        const cv = document.createElement("canvas");
        cv.width = W * S;
        cv.height = H * S;
        const c = cv.getContext("2d");
        c.scale(S, S);
        c.fillStyle = T.bg;
        c.fillRect(0, 0, W, H);
        c.textBaseline = "alphabetic";
        let y = 76;
        c.fillStyle = T.ink;
        c.font = "600 " + TITLE_PX + "px " + serif;
        titleLines.forEach((ln, i) => c.fillText(ln, PAD, y + i * TITLE_LH));
        y += titleExtra;
        if (hero) {
          y += 92;
          let FIG = 68,
            NAME = 19;
          const DOT = 6,
            G = 14;
          c.font = "800 " + FIG + "px " + sans;
          const wNum = parties.map(p => c.measureText(p.num).width);
          c.font = "700 " + NAME + "px " + sans;
          const wName = parties.map(p => c.measureText(p.name).width);
          let x = PAD;
          const dot = (cx, fill) => {
            c.beginPath();
            c.arc(cx, y - FIG * 0.28, DOT, 0, 7);
            c.fillStyle = fill;
            c.fill();
          };
          dot(x + DOT, parties[0].dot);
          x += DOT * 2 + G;
          c.font = "700 " + NAME + "px " + sans;
          c.fillStyle = T.ink2;
          c.fillText(parties[0].name, x, y);
          x += wName[0] + G;
          c.font = "800 " + FIG + "px " + sans;
          c.fillStyle = parties[0].ink;
          c.fillText(parties[0].num, x, y);
          x += wNum[0] + G;
          c.strokeStyle = T.ink3;
          c.globalAlpha = 0.35;
          c.lineWidth = 2;
          c.beginPath();
          c.moveTo(x + 1, y - FIG * 0.78);
          c.lineTo(x + 1, y + 4);
          c.stroke();
          c.globalAlpha = 1;
          x += 2 + G;
          c.font = "800 " + FIG + "px " + sans;
          c.fillStyle = parties[1].ink;
          c.fillText(parties[1].num, x, y);
          x += wNum[1] + G;
          c.font = "700 " + NAME + "px " + sans;
          c.fillStyle = T.ink2;
          c.fillText(parties[1].name, x, y);
          x += wName[1] + G;
          dot(x + DOT, parties[1].dot);
          y += 34;
          c.font = "600 15px " + sans;
          c.fillStyle = T.ink3;
          c.fillText(meta, PAD, y);
          y += 26;
          c.font = "700 15px " + sans;
          c.fillStyle = T.ink2;
          c.fillText(lead, PAD, y);
        } else if (sub) {
          y += 32;
          c.font = "400 16px " + sans;
          c.fillStyle = T.ink3;
          subLines.forEach((ln, i) => c.fillText(ln, PAD, y + i * 22));
          y += (subLines.length - 1) * 22 + 8;
        } else {
          y += 8;
        }
        if (insLines.length) {
          y += 14;
          insLines.forEach(ln => {
            y += INS_LH;
            let x = PAD;
            ln.forEach(tk => {
              c.font = insFont(tk.bold);
              c.fillStyle = tk.ink;
              c.fillText(tk.t, x, y - 6);
              x += tk.w;
            });
          });
        }
        y += 30;
        c.drawImage(img, PAD, y, IW, chartH);
        y += chartH + 34;
        c.font = "600 14px " + sans;
        legLines.forEach(ln => {
          let lx = PAD;
          ln.forEach(it => {
            const tw = c.measureText(it.label).width,
              my = y - 5;
            c.save();
            c.globalAlpha = it.alpha;
            if (it.kind === "line" || it.kind === "dashed") {
              c.strokeStyle = it.fill;
              c.lineWidth = 3;
              c.lineCap = "round";
              if (it.kind === "dashed") c.setLineDash([4, 4]);
              c.beginPath();
              c.moveTo(lx, my);
              c.lineTo(lx + 18, my);
              c.stroke();
              c.setLineDash([]);
            } else if (it.kind === "cycband") {
              c.fillStyle = it.fill;
              c.globalAlpha = it.alpha * it.lo;
              c.beginPath();
              c.roundRect(lx, my - 5, 18, 11, 2);
              c.fill();
              c.globalAlpha = it.alpha * it.hi;
              c.beginPath();
              c.roundRect(lx, my - 2.5, 18, 6, 1);
              c.fill();
              c.globalAlpha = it.alpha * 0.85;
              c.strokeStyle = T.ink2;
              c.lineWidth = 1.6;
              c.lineCap = "round";
              c.setLineDash([2, 2.7]);
              c.beginPath();
              c.moveTo(lx, my);
              c.lineTo(lx + 18, my);
              c.stroke();
              c.setLineDash([]);
            } else if (it.kind === "band") {
              const two = legend.filter(l => l.kind === "line").map(l => l.fill);
              const g = c.createLinearGradient(0, my - 5, 0, my + 6);
              g.addColorStop(0, two[0] || it.fill);
              g.addColorStop(1, two[1] || two[0] || it.fill);
              c.globalAlpha = it.alpha * 0.22;
              c.fillStyle = g;
              c.beginPath();
              c.roundRect(lx, my - 5, 18, 11, 2);
              c.fill();
            } else if (it.kind === "square") {
              c.fillStyle = it.fill;
              c.beginPath();
              c.roundRect(lx + 3, my - 5, 11, 11, 2);
              c.fill();
            } else if (it.kind === "shade") {
              c.fillStyle = it.fill;
              c.globalAlpha = it.alpha * 0.7;
              c.beginPath();
              c.roundRect(lx, my - 5, 18, 11, 2);
              c.fill();
              c.globalAlpha = it.alpha;
            } else if (it.kind === "ring") {
              c.strokeStyle = it.fill;
              c.lineWidth = 2;
              c.beginPath();
              c.arc(lx + 6, my, 5, 0, 7);
              c.stroke();
            } else {
              c.fillStyle = it.fill;
              c.beginPath();
              c.arc(lx + 5, my, 4.5, 0, 7);
              c.fill();
            }
            c.restore();
            c.fillStyle = T.ink2;
            c.fillText(it.label, lx + SW_W, y);
            lx += SW_W + tw + LEG_GAP;
          });
          y += 26;
        });
        if (capLines.length) {
          y += 8;
          c.font = "400 15px " + sans;
          c.fillStyle = T.ink3;
          capLines.forEach(ln => {
            c.fillText(ln, PAD, y);
            y += 22;
          });
        }
        c.font = "600 15px " + sans;
        c.fillStyle = T.ink2;
        c.textAlign = "right";
        c.fillText("auspoltracker.com" + (window.JUR ? window.JUR.path.replace(/\/$/, "") : ""), W - PAD, H - 34);
        c.textAlign = "left";
        cv.toBlob(b2 => b2 ? resolve(b2) : reject(new Error("toBlob returned null")), "image/png");
      } catch (e) {
        reject(e);
      }
    };
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(markup);
  });
  const wrapText = (ctx, text, max) => {
    if (!text) return [];
    const words = text.split(" ");
    const lines = [];
    let line = "";
    for (const w of words) {
      const t = line ? line + " " + w : w;
      if (ctx.measureText(t).width > max && line) {
        lines.push(line);
        line = w;
      } else line = t;
    }
    if (line) lines.push(line);
    return lines;
  };
  const rasterise = (target, host) => new Promise((resolve, reject) => {
    const rect = target.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      reject(new Error("nothing visible to capture"));
      return;
    }
    const dpr = Math.min(Math.max(window.devicePixelRatio || 1, 1), 3);
    const w = Math.round(rect.width);
    const clone = target.cloneNode(true);
    clone.querySelectorAll(STRIP_SEL).forEach(b => b.remove());
    bake(target, clone, elasticSet(target));
    clone.style.margin = "0";
    clone.style.transform = "none";
    const rootPos = clone.style.position;
    if (rootPos === "absolute" || rootPos === "fixed") clone.style.position = "relative";
    clone.style.top = "auto";
    clone.style.right = "auto";
    clone.style.bottom = "auto";
    clone.style.left = "auto";
    clone.style.width = w + "px";
    clone.style.height = "auto";
    const holder = document.createElement("div");
    holder.style.cssText = "position:fixed;left:-100000px;top:0;width:" + w + "px;visibility:hidden;pointer-events:none;";
    holder.appendChild(clone);
    document.body.appendChild(holder);
    const h = Math.max(1, Math.round(clone.getBoundingClientRect().height));
    holder.remove();
    clone.style.height = h + "px";
    const W = Math.max(1, Math.round(w * dpr));
    const H = Math.max(1, Math.round(h * dpr));
    const wrap = document.createElement("div");
    wrap.style.width = w + "px";
    wrap.style.height = h + "px";
    wrap.style.transform = "scale(" + dpr + ")";
    wrap.style.transformOrigin = "0 0";
    const fonts = document.createElement("style");
    fonts.textContent = collectFontCss();
    wrap.appendChild(fonts);
    wrap.appendChild(clone);
    const xhtml = new XMLSerializer().serializeToString(wrap);
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '"><foreignObject width="100%" height="100%">' + xhtml + "</foreignObject></svg>";
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = W;
        canvas.height = H;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = pageBg();
        ctx.fillRect(0, 0, W, H);
        ctx.drawImage(img, 0, 0, W, H);
        canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("toBlob returned null")), "image/png");
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error("rasterisation failed"));
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  });
  const flash = btn => {
    btn.classList.add("copied");
    btn.innerHTML = TICK_ICON;
    setTimeout(() => {
      btn.classList.remove("copied");
      btn.innerHTML = COPY_ICON;
    }, 1600);
  };
  const copyChart = host => {
    const target = pickTarget(host);
    const svg = host.querySelector("svg.chart-svg");
    const card = host.closest && host.closest(".card, .ap-var, .ap-lean, .ap-flow");
    const png = card && card.querySelector("svg.chart-svg") ? composeCard(card, host).catch(e => {
      console.warn("copy-chart: composed card failed, captured instead –", e && e.message || e);
      return rasterise(target, host);
    }) : rasterise(target, host);
    const name = fileName(target, svg);
    const btn = host.querySelector(":scope > ." + BTN_CLASS);
    const download = () => png.then(blob => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = name;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        a.remove();
        URL.revokeObjectURL(a.href);
      }, 100);
    });
    if (CAN_COPY && window.ClipboardItem && btn) {
      const viaPromise = () => navigator.clipboard.write([new ClipboardItem({
        "image/png": png
      })]).then(() => true, () => false);
      const viaBlob = () => png.then(blob => navigator.clipboard.write([new ClipboardItem({
        "image/png": blob
      })])).then(() => true, () => false);
      const settle = wrote => {
        if (wrote) {
          flash(btn);
          return;
        }
        viaBlob().then(wrote2 => {
          if (wrote2) flash(btn);else download();
        });
      };
      try {
        viaPromise().then(settle);
      } catch (e) {
        settle(false);
      }
      return;
    }
    download().catch(() => {});
  };
  const attach = () => {
    document.querySelectorAll(".chart").forEach(host => {
      if (host.querySelector(":scope > ." + BTN_CLASS)) return;
      if (!host.querySelector("svg.chart-svg")) return;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = BTN_CLASS;
      btn.title = ACTION_LABEL;
      btn.setAttribute("aria-label", ACTION_LABEL);
      btn.innerHTML = COPY_ICON;
      btn.addEventListener("click", e => {
        e.preventDefault();
        e.stopPropagation();
        copyChart(host);
      });
      host.appendChild(btn);
    });
  };
  if (!(window.matchMedia && window.matchMedia("(hover: none)").matches)) {
    let hoverCopy = null;
    document.addEventListener("pointerover", e => {
      hoverCopy = e.target && e.target.closest ? e.target.closest(".chart, .poll-detail") : null;
    });
    document.addEventListener("keydown", e => {
      if (!hoverCopy || e.key !== "c" && e.key !== "C" || e.defaultPrevented || e.repeat) return;
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      const a = document.activeElement;
      if (a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || a.tagName === "SELECT" || a.isContentEditable)) return;
      const sel = window.getSelection && window.getSelection();
      if (sel && !sel.isCollapsed) return;
      if (!hoverCopy.isConnected || !hoverCopy.getClientRects().length) {
        hoverCopy = null;
        return;
      }
      const btn = hoverCopy.querySelector(":scope > .chart-copy-btn, :scope > .poll-copy-btn");
      if (!btn) return;
      e.preventDefault();
      btn.click();
    });
  }
  let queued = false;
  const queueAttach = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      attach();
    });
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", attach);
  } else {
    attach();
  }
  new MutationObserver(queueAttach).observe(document.documentElement, {
    childList: true,
    subtree: true
  });
})();