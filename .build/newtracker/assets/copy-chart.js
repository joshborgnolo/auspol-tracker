/* auspol tracker – copy-as-image buttons on every chart.

   Chart renders live in one plain script (see build.mjs PLAIN list): a small
   icon button at the bottom-right corner of each `.chart` host that copies a
   PNG of the chart, exactly as it looks on screen, to the clipboard. If the
   clipboard write is unavailable or refused, the PNG downloads instead.

   The charts are hand-drawn inline SVG, so there is no canvas grab: the
   rendered <svg> is cloned, every computed presentation property is baked
   into the clone (the charts are painted by document-level CSS classes, which
   a detached clone cannot see), the @font-face data-URL rules are embedded,
   and the result is drawn onto a canvas at devicePixelRatio over --chart-bg. */

(() => {
  "use strict";

  const BTN_CLASS = "chart-copy-btn";

  const COPY_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
  const TICK_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>';

  // presentation properties whose computed values must survive serialisation
  const STYLE_PROPS = [
    "fill", "fill-opacity", "fill-rule",
    "stroke", "stroke-width", "stroke-opacity", "stroke-dasharray",
    "stroke-dashoffset", "stroke-linecap", "stroke-linejoin", "stroke-miterlimit",
    "opacity", "visibility", "display",
    "font-family", "font-size", "font-weight", "font-style", "font-variant",
    "font-variant-numeric", "letter-spacing", "word-spacing", "text-anchor",
    "text-decoration", "text-transform",
    "dominant-baseline", "alignment-baseline",
    "transform", "transform-origin", "transform-box",
    "paint-order", "stop-color", "stop-opacity", "vector-effect",
  ];

  /* The main stylesheet inlines the webfonts as data-URL @font-face rules.
     Collect them once - unrelated floats elsewhere in the cascade do not
     travel with a serialised clone, but its text still needs the faces. */
  let fontCss = null;
  const collectFontCss = () => {
    if (fontCss !== null) return fontCss;
    const out = [];
    for (const sheet of document.styleSheets) {
      let rules;
      try { rules = sheet.cssRules; } catch (e) { continue; }
      for (const rule of rules) {
        if (rule.type === CSSRule.FONT_FACE_RULE) out.push(rule.cssText);
      }
    }
    fontCss = out.join("\n");
    return fontCss;
  };

  const bakeStyles = (src, dst) => {
    const srcNodes = [src, ...src.querySelectorAll("*")];
    const dstNodes = [dst, ...dst.querySelectorAll("*")];
    srcNodes.forEach((el, i) => {
      const cs = getComputedStyle(el);
      const decl = [];
      for (const prop of STYLE_PROPS) {
        const value = cs.getPropertyValue(prop);
        if (value) decl.push(`${prop}:${value}`);
      }
      dstNodes[i].setAttribute("style", decl.join(";"));
    });
  };

  /* --chart-bg is itself a var() alias (and changes under body.editorial), so
     resolve it the way the page does rather than reading custom properties. */
  const chartBg = (host) => {
    const probe = document.createElement("div");
    probe.style.cssText = "position:absolute;visibility:hidden;pointer-events:none;";
    probe.style.backgroundColor = "var(--chart-bg)";
    (host || document.body).appendChild(probe);
    const color = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return color || "#ffffff";
  };

  const fileName = (svg) => {
    const label = (svg.getAttribute("aria-label") || "chart")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "chart";
    return `auspol-${label}.png`;
  };

  const rasterise = (svg) => new Promise((resolve, reject) => {
    const rect = svg.getBoundingClientRect();
    const dpr = Math.min(Math.max(window.devicePixelRatio || 1, 1), 3);
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.height * dpr));

    const clone = svg.cloneNode(true);
    bakeStyles(svg, clone);
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const fonts = document.createElementNS("http://www.w3.org/2000/svg", "style");
    fonts.textContent = collectFontCss();
    clone.insertBefore(fonts, clone.firstChild);
    clone.setAttribute("width", w);
    clone.setAttribute("height", h);

    const url = "data:image/svg+xml;charset=utf-8," +
      encodeURIComponent(new XMLSerializer().serializeToString(clone));

    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = chartBg(svg.closest(".chart"));
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error("toBlob returned null"))),
          "image/png"
        );
      } catch (err) { reject(err); }
    };
    img.onerror = () => reject(new Error("SVG rasterisation failed"));
    img.src = url;
  });

  const flash = (btn) => {
    btn.classList.add("copied");
    btn.innerHTML = TICK_ICON;
    setTimeout(() => {
      btn.classList.remove("copied");
      btn.innerHTML = COPY_ICON;
    }, 1600);
  };

  const copyChart = (svg, btn) => {
    const png = rasterise(svg);
    const download = () =>
      png.then((blob) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = fileName(svg);
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          a.remove();
          URL.revokeObjectURL(a.href);
        }, 100);
      });

    // promise-valued ClipboardItem keeps Safari's user-gesture alive while we rasterise
    if (navigator.clipboard && navigator.clipboard.write && window.ClipboardItem) {
      try {
        navigator.clipboard
          .write([new ClipboardItem({ "image/png": png })])
          .then(() => flash(btn), () => download().then(() => flash(btn), () => {}));
        return;
      } catch (e) { /* falls through to the download path */ }
    }
    download().then(() => flash(btn), () => {});
  };

  const attach = () => {
    document.querySelectorAll(".chart").forEach((host) => {
      if (host.querySelector(":scope > ." + BTN_CLASS)) return;
      if (!host.querySelector("svg.chart-svg")) return;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = BTN_CLASS;
      btn.title = "Copy chart as image";
      btn.setAttribute("aria-label", "Copy chart as image");
      btn.innerHTML = COPY_ICON;
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const svg = host.querySelector("svg.chart-svg");
        if (svg) copyChart(svg, btn);
      });
      host.appendChild(btn);
    });
  };

  /* plain scripts run before the mount script renders any chart, and React
     later mutates hosts (tab switches, range toggles) - watch and re-attach */
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
    subtree: true,
  });
})();
