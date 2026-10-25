(() => {
  "use strict";

  const BTN_CLASS = "poll-copy-btn";
  const STRIP_SEL = "." + BTN_CLASS + ", .pd-meta-tail";
  const COPY_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
  const TICK_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>';
  const CAN_COPY = window.isSecureContext && !!navigator.clipboard && typeof navigator.clipboard.write === "function";
  const ACTION_LABEL = CAN_COPY ? "Copy breakdown as image" : "Save breakdown as PNG";
  const CARD_MAX = 1200,
    CARD_MIN = 560,
    PAD = 28,
    SCALE = 2;
  const CONTENT_MAX = CARD_MAX - PAD * 2;
  const CONTENT_MIN = CARD_MIN - PAD * 2;
  const TEXT_H = 15;
  const inkVar = name => {
    const el = document.createElement("span");
    el.style.color = "var(" + name + ")";
    document.body.appendChild(el);
    const v = getComputedStyle(el).color;
    el.remove();
    return v;
  };
  const transparent = c => !c || c === "rgba(0, 0, 0, 0)" || c === "transparent";
  const widenPanel = (panel, width) => {
    const host = panel.parentElement;
    if (!host) return () => {};
    const panelStyle = panel.getAttribute("style");
    const hostStyle = host.getAttribute("style");
    const hostRect = host.getBoundingClientRect();
    const hostCS = getComputedStyle(host);
    host.style.height = hostRect.height + "px";
    host.style.overflow = "hidden";
    if (hostCS.position === "static") host.style.position = "relative";
    panel.classList.add("copy-wide");
    panel.style.position = "absolute";
    panel.style.top = "0";
    panel.style.left = "-99999px";
    panel.style.width = width + "px";
    return () => {
      panel.classList.remove("copy-wide");
      if (panelStyle == null) panel.removeAttribute("style");else panel.setAttribute("style", panelStyle);
      if (hostStyle == null) host.removeAttribute("style");else host.setAttribute("style", hostStyle);
    };
  };
  const retitleFieldworkRow = (panel, house) => {
    const ks = panel.querySelectorAll(".pd-meta-k");
    for (const k of ks) {
      if ((k.textContent || "").trim() !== "Fieldwork") continue;
      const item = k.parentElement;
      if (!item || !item.classList.contains("pd-meta-i")) return () => {};
      const parent = item.parentElement;
      if (!parent) return () => {};
      const v = item.querySelector(".pd-meta-v");
      const fieldwork = (v && v.textContent || "").replace(/\s+/g, " ").trim();
      if (!fieldwork) return () => {};
      const clone = item.cloneNode(true);
      clone.querySelector(".pd-meta-k").textContent = "Poll";
      clone.querySelector(".pd-meta-v").textContent = (house ? house + ", " : "") + fieldwork;
      const next = item.nextSibling;
      item.remove();
      parent.insertBefore(clone, parent.firstChild);
      return () => {
        clone.remove();
        parent.insertBefore(item, next);
      };
    }
    return () => {};
  };
  const retitlePollHead = (panel, house) => {
    const head = house && panel.querySelector(".rd-apd-h") || null;
    if (!head) return () => {};
    const tw = document.createTreeWalker(head, 4);
    const edits = [];
    for (let n = tw.nextNode(); n; n = tw.nextNode()) {
      const from = n.nodeValue;
      let to = null;
      const lead = /^(?:Conducted on (.*?) )?[Ff]rom $/.exec(from);
      if (lead) to = house + " (" + (lead[1] ? "fieldwork " + lead[1] + ", " : "");else if (from === "Conducted on dates ") to = house + " (fieldwork dates ";else if (from === " from " && head.querySelector(".rd-tbc")) to = ", ";else if (from === "a sample of ") to = "n = ";else if (from === "an unpublished sample") to = "sample not published";else {
        const by = /^, (published|commissioned) by (.*) on (.*)$/.exec(from) || /^, (published|commissioned) by (.*)()$/.exec(from);
        if (by) to = ", " + (by[1] === "published" && by[2] === house ? "self-published" : by[1] + " by " + by[2]) + (by[3] ? ", " + by[3] : "") + ")";
      }
      if (to != null && to !== from) edits.push([n, from, to]);
    }
    if (!edits.length) return () => {};
    edits.forEach(([n,, to]) => {
      n.nodeValue = to;
    });
    return () => edits.forEach(([n, from]) => {
      n.nodeValue = from;
    });
  };
  const readModel = panel => {
    const root = panel.getBoundingClientRect();
    const els = [];
    const texts = [];
    const Sides = [["Top", (r, t) => [r.x, r.y + t / 2, r.x + r.w, r.y + t / 2]], ["Bottom", (r, t) => [r.x, r.y + r.h - t / 2, r.x + r.w, r.y + r.h - t / 2]], ["Left", (r, t) => [r.x + t / 2, r.y, r.x + t / 2, r.y + r.h]], ["Right", (r, t) => [r.x + r.w - t / 2, r.y, r.x + r.w - t / 2, r.y + r.h]]];
    const walk = el => {
      if (el.matches && el.matches(STRIP_SEL)) return;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && cs.display !== "none" && cs.visibility !== "hidden") {
        const rec = {
          x: r.left - root.left,
          y: r.top - root.top,
          w: r.width,
          h: r.height
        };
        const bg = cs.backgroundColor;
        const bgImg = cs.backgroundImage || "";
        if (!transparent(bg) || bgImg.indexOf("gradient") !== -1) {
          rec.bg = transparent(bg) ? null : bg;
          const br = (cs.borderRadius || "").split(" ").map(parseFloat).filter(v => !isNaN(v));
          rec.radius = br.length ? Math.min.apply(null, br) : 0;
          if (bgImg.indexOf("repeating-linear-gradient") === 0) {
            const m = bgImg.match(/repeating-linear-gradient\((.+)\)$/);
            if (m) {
              const parts = m[1].split(",").map(s => s.trim());
              const token = s => {
                const vm = s.match(/var\((--[a-zA-Z-]+)\)/);
                const nums = s.match(/-?\d+(\.\d+)?px/g) || [];
                return {
                  col: vm ? inkVar(vm[1]) : s.split(/\s+/)[0],
                  nums: nums.map(parseFloat)
                };
              };
              const a = parts[1] && token(parts[1]);
              const b = parts[2] && token(parts[2]);
              if (a && b && b.nums.length >= 2) rec.stripes = {
                c1: a.col,
                c2: b.col,
                w1: b.nums[1] - b.nums[0],
                w2: b.nums[0]
              };
            }
          }
          els.push(rec);
        }
        for (const [side, line] of Sides) {
          const w = parseFloat(cs["border" + side + "Width"]);
          const style = cs["border" + side + "Style"];
          if (!w || w <= 0 || style === "none" || style === "hidden") continue;
          els.push({
            border: line(rec, w),
            w,
            color: cs["border" + side + "Color"],
            style
          });
        }
      }
      for (let i = 0; i < el.children.length; i++) walk(el.children[i]);
    };
    walk(panel);
    const walker = document.createTreeWalker(panel, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue || !/\S/.test(node.nodeValue)) return NodeFilter.FILTER_REJECT;
        const p = node.parentElement;
        if (!p) return NodeFilter.FILTER_REJECT;
        if (p.closest(STRIP_SEL)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const csCache = new Map();
    const styleOf = el => {
      if (!csCache.has(el)) csCache.set(el, getComputedStyle(el));
      return csCache.get(el);
    };
    const range = document.createRange();
    let node;
    while (node = walker.nextNode()) {
      const el = node.parentElement;
      const cs = styleOf(el);
      const fontStyle = cs.fontStyle !== "normal" ? cs.fontStyle + " " : "";
      const font = {
        style: fontStyle,
        weight: cs.fontWeight,
        size: parseFloat(cs.fontSize),
        family: cs.fontFamily
      };
      const clickable = el.closest("a[href], button");
      const dec = !clickable && cs.textDecorationLine.indexOf("underline") !== -1 ? {
        color: cs.textDecorationColor === "currentcolor" ? cs.color : cs.textDecorationColor,
        style: cs.textDecorationStyle,
        thick: parseFloat(cs.textDecorationThickness) || 1,
        off: parseFloat(cs.textUnderlineOffset) || 0
      } : null;
      const upper = cs.textTransform === "uppercase";
      const text = node.nodeValue;
      for (let i = 0; i < text.length; i++) {
        let ch = text[i],
          end = i + 1;
        if (/\s/.test(ch)) continue;
        const c0 = text.charCodeAt(i);
        if (c0 >= 0xd800 && c0 <= 0xdbff && i + 1 < text.length) {
          ch = text.slice(i, i + 2);
          end = i + 2;
        }
        range.setStart(node, i);
        range.setEnd(node, end);
        const boxes = range.getClientRects();
        if (!boxes.length) continue;
        const b = boxes[0];
        texts.push({
          ch: upper ? ch.toUpperCase() : ch,
          x: b.left - root.left,
          y: b.top - root.top,
          h: b.height,
          right: b.right - root.left,
          font,
          fill: cs.color,
          numeric: cs.fontVariantNumeric || "",
          dec
        });
        i = end - 1;
      }
    }
    const pcs = getComputedStyle(panel);
    let inkRight = 0;
    for (const t of texts) if (t.right > inkRight) inkRight = t.right;
    return {
      els,
      texts,
      rootW: root.width,
      rootH: root.height,
      inkRight,
      padRight: parseFloat(pcs.paddingRight) || 0,
      bg: pcs.backgroundColor,
      fontFamily: pcs.fontFamily
    };
  };
  const roundRectPath = (c, x, y, w, h, r) => {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath();
    if (r <= 0) {
      c.rect(x, y, w, h);
      return;
    }
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + r, y, r);
    c.closePath();
  };
  const paintCard = model => new Promise((resolve, reject) => {
    try {
      const CARD_W = model.rootW + PAD * 2;
      const factor = 1;
      const panelH = model.rootH * factor;
      const H = Math.ceil(PAD + panelH + PAD + TEXT_H + PAD);
      const cv = document.createElement("canvas");
      cv.width = CARD_W * SCALE;
      cv.height = H * SCALE;
      const c = cv.getContext("2d");
      c.scale(SCALE, SCALE);
      c.fillStyle = model.bg;
      c.fillRect(0, 0, CARD_W, H);
      c.textBaseline = "alphabetic";
      const ox = PAD,
        oy = PAD;
      const X = v => ox + v * factor,
        Y = v => oy + v * factor;
      for (const el of model.els) {
        if (el.border) {
          c.strokeStyle = el.color;
          c.lineWidth = Math.max(0.5, el.w * factor);
          if (el.style === "dashed") c.setLineDash([4 * factor, 3 * factor]);else if (el.style === "dotted") c.setLineDash([c.lineWidth, 2 * factor]);
          c.beginPath();
          c.moveTo(X(el.border[0]), Y(el.border[1]));
          c.lineTo(X(el.border[2]), Y(el.border[3]));
          c.stroke();
          c.setLineDash([]);
          continue;
        }
        roundRectPath(c, X(el.x), Y(el.y), el.w * factor, el.h * factor, (el.radius || 0) * factor);
        if (el.stripes) {
          c.save();
          c.clip();
          const s = el.stripes;
          const w1 = Math.max(1, s.w1 * factor),
            w2 = Math.max(1, s.w2 * factor);
          const total = w1 + w2;
          const n = Math.ceil(el.w * factor / total) + 1;
          for (let i = 0; i < n; i++) {
            c.fillStyle = i % 2 ? s.c2 : s.c1;
            c.fillRect(ox + el.x * factor + i * total, Y(el.y), (i % 2 ? w2 : w1) + 0.5, el.h * factor);
          }
          c.restore();
          continue;
        }
        if (el.bg) {
          c.fillStyle = el.bg;
          c.fill();
        }
      }
      const metricCache = new Map();
      for (const t of model.texts) {
        const f = t.font;
        const fontStr = f.style + f.weight + " " + f.size * factor + "px " + f.family;
        c.font = fontStr;
        if (t.numeric && "fontVariantNumeric" in c) c.fontVariantNumeric = t.numeric;
        let m = metricCache.get(fontStr);
        if (!m) {
          const mt = c.measureText("MgQqy");
          m = {
            asc: mt.fontBoundingBoxAscent || f.size * factor * 0.8,
            desc: mt.fontBoundingBoxDescent || f.size * factor * 0.25,
            sp: c.measureText(" ").width
          };
          metricCache.set(fontStr, m);
        }
        const lh = t.h * factor;
        const x = ox + t.x * factor;
        const y = oy + t.y * factor + (lh - (m.asc + m.desc)) / 2 + m.asc;
        c.fillStyle = t.fill;
        c.fillText(t.ch, x, y);
        if (t.dec) {
          const uw = Math.max(m.sp / 2, c.measureText(t.ch).width);
          const th = Math.max(0.5, t.dec.thick * factor);
          const yy = y + m.desc / 2 + t.dec.off * factor;
          if (t.dec.style === "dashed" || t.dec.style === "dotted") {
            c.save();
            c.strokeStyle = t.dec.color;
            c.lineWidth = th;
            c.setLineDash(t.dec.style === "dashed" ? [4, 3] : [th, th + 1]);
            c.beginPath();
            c.moveTo(x, yy);
            c.lineTo(x + uw, yy);
            c.stroke();
            c.restore();
          } else {
            c.fillStyle = t.dec.color;
            c.fillRect(x, yy, uw, th);
          }
        }
      }
      c.font = "600 15px " + model.fontFamily;
      c.fillStyle = inkVar("--pd-ink-2");
      c.textAlign = "right";
      c.fillText("auspoltracker.com" + (window.JUR ? window.JUR.path.replace(/\/$/, "") : ""), CARD_W - PAD - 52, H - PAD - 3);
      c.textAlign = "left";
      cv.toBlob(b => b ? resolve(b) : reject(new Error("toBlob returned null")), "image/png");
    } catch (e) {
      reject(e);
    }
  });
  const houseName = panel => {
    const tr = panel.closest("tr");
    const row = tr && tr.previousElementSibling;
    const nameEl = row && row.querySelector(".pollster-name");
    if (nameEl) {
      return (nameEl.textContent || "").replace(/↗/g, "").replace(/\s+/g, " ").trim();
    }
    return (panel.getAttribute("data-pollster") || "").trim();
  };
  const metaValue = (panel, key) => {
    const ks = panel.querySelectorAll(".pd-meta-k");
    for (const k of ks) {
      if ((k.textContent || "").trim() !== key) continue;
      const item = k.parentElement;
      const v = item && item.querySelector(".pd-meta-v");
      if (v) return (v.textContent || "").replace(/\s+/g, " ").trim();
    }
    if (key === "Fieldwork") {
      const head = panel.querySelector(".rd-apd-h");
      const m = head && /Conducted on (.*?) from /.exec(head.textContent || "");
      if (m) return m[1].replace(/\s+/g, " ").trim();
    }
    return "";
  };
  const idLine = panel => [houseName(panel), metaValue(panel, "Fieldwork")].filter(Boolean).join(", ");
  const fileName = panel => {
    const label = idLine(panel).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70);
    return (window.JUR ? window.JUR.brand : "auspol") + "-breakdown-" + (label || "poll") + ".png";
  };
  const compose = panel => {
    const house = houseName(panel);
    let restore = widenPanel(panel, CONTENT_MAX);
    let untitle = retitleFieldworkRow(panel, house);
    let unhead = retitlePollHead(panel, house);
    try {
      panel.getBoundingClientRect();
      const wide = readModel(panel);
      const SLACK = 4;
      const want = Math.min(CONTENT_MAX, Math.max(CONTENT_MIN, Math.ceil(wide.inkRight + wide.padRight) + SLACK));
      let model = wide;
      if (want < wide.rootW) {
        unhead();
        untitle();
        restore();
        restore = widenPanel(panel, want);
        untitle = retitleFieldworkRow(panel, house);
        unhead = retitlePollHead(panel, house);
        panel.getBoundingClientRect();
        model = readModel(panel);
      }
      return paintCard(model);
    } finally {
      unhead();
      untitle();
      restore();
    }
  };
  const flash = btn => {
    btn.classList.add("copied");
    btn.innerHTML = TICK_ICON;
    setTimeout(() => {
      btn.classList.remove("copied");
      btn.innerHTML = COPY_ICON;
    }, 1600);
  };
  const copyPoll = panel => {
    let png;
    try {
      png = Promise.resolve(compose(panel));
    } catch (e) {
      console.warn("copy-poll: compose failed -", e && e.message || e);
      return;
    }
    const name = fileName(panel);
    const btn = panel.querySelector(":scope > ." + BTN_CLASS);
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
    document.querySelectorAll(".poll-detail").forEach(panel => {
      if (panel.querySelector(":scope > ." + BTN_CLASS)) return;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = BTN_CLASS;
      btn.title = ACTION_LABEL;
      btn.setAttribute("aria-label", ACTION_LABEL);
      btn.innerHTML = COPY_ICON;
      btn.addEventListener("click", e => {
        e.preventDefault();
        e.stopPropagation();
        copyPoll(panel);
      });
      panel.appendChild(btn);
    });
  };
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