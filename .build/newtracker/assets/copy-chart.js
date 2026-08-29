/* auspol tracker – copy-as-image buttons on every chart.

   Chart renders live in one plain script (see build.mjs PLAIN list): a small
   icon button at the bottom-right corner of each `.chart` host that copies a
   PNG of the chart card - heading, legend and chart exactly as they look on
   screen - to the clipboard. If a clipboard write is unavailable or refused,
   the PNG downloads instead (and on http pages, where no clipboard API
   exists, the button says so rather than promising a copy).

   There is no canvas grab: the captured DOM subtree is cloned and every
   element's computed styles are baked onto the clone, so the serialised
   result carries theme tokens, media-query layout and pseudo-element
   decorations with no dependency on the live stylesheet cascade. The clone
   rides inside an SVG <foreignObject>, the @font-face data-URL rules are
   embedded for its text, and the whole thing is drawn at devicePixelRatio. */

(() => {
  "use strict";

  const BTN_CLASS = "chart-copy-btn";

  const COPY_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
  const TICK_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>';

  const CAN_COPY = window.isSecureContext &&
    !!navigator.clipboard &&
    typeof navigator.clipboard.write === "function";
  const ACTION_LABEL = CAN_COPY ? "Copy chart as image" : "Save chart as PNG";

  /* computed values bake layout + theme into the clone; the raster image
     must not depend on the document cascade (body.editorial etc.) */
  const STYLE_PROPS = [
    // box + layout
    "display", "position", "top", "right", "bottom", "left", "z-index",
    "box-sizing", "width", "height", "min-width", "max-width", "min-height", "max-height",
    "margin-top", "margin-right", "margin-bottom", "margin-left",
    "padding-top", "padding-right", "padding-bottom", "padding-left",
    "float", "clear", "overflow", "overflow-x", "overflow-y",
    "flex", "flex-direction", "flex-wrap", "flex-grow", "flex-shrink", "flex-basis",
    "align-items", "align-self", "align-content",
    "justify-content", "justify-items", "justify-self", "order",
    "gap", "row-gap", "column-gap",
    "grid-template-columns", "grid-template-rows", "grid-column", "grid-row", "grid-area",
    "aspect-ratio", "object-fit", "object-position", "vertical-align",
    "border-collapse", "border-spacing", "table-layout",
    // box + text paint
    "color", "opacity", "visibility",
    "background-color", "background-image", "background-position",
    "background-size", "background-repeat", "background-clip", "background-origin",
    "border-top-width", "border-top-style", "border-top-color",
    "border-right-width", "border-right-style", "border-right-color",
    "border-bottom-width", "border-bottom-style", "border-bottom-color",
    "border-left-width", "border-left-style", "border-left-color",
    "border-radius", "box-shadow", "text-shadow", "outline",
    "font-family", "font-size", "font-weight", "font-style", "font-stretch",
    "font-variant", "font-variant-numeric",
    "line-height", "text-align", "text-indent", "text-transform", "text-decoration",
    "letter-spacing", "word-spacing", "white-space", "word-break", "overflow-wrap",
    "text-overflow", "direction",
    "transform", "transform-origin",
    "appearance", "-webkit-appearance",
    // svg paint
    "fill", "fill-opacity", "fill-rule",
    "stroke", "stroke-width", "stroke-opacity", "stroke-dasharray",
    "stroke-dashoffset", "stroke-linecap", "stroke-linejoin", "stroke-miterlimit",
    "text-anchor", "dominant-baseline", "alignment-baseline",
    "transform-box", "paint-order", "stop-color", "stop-opacity", "vector-effect",
  ];

  const VOID_TAGS = new Set([
    "IMG", "INPUT", "BR", "HR", "WBR", "AREA", "BASE", "COL", "EMBED", "SOURCE", "TRACK",
  ]);

  /* The main stylesheet inlines the webfonts as data-URL @font-face rules.
     Collect them once - the clone's layout is baked property-by-property,
     but its text still needs the faces themselves to render. */
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

  const decls = (cs) => {
    const parts = [];
    for (const prop of STYLE_PROPS) {
      const value = cs.getPropertyValue(prop);
      if (value) parts.push(prop + ":" + value + ";");
    }
    return parts.join("");
  };

  /* ::before/::after are not elements, so a DOM clone silently drops them -
     separators and tab underlines would vanish from the image. Fake them
     with plain spans at the same slot whenever the pseudo renders. */
  const bakePseudo = (srcEl, dstEl, pseudo, before) => {
    let cs;
    try { cs = getComputedStyle(srcEl, pseudo); } catch (e) { return; }
    if (!cs || typeof cs.getPropertyValue !== "function") return;
    const content = cs.getPropertyValue("content");
    if (!content || content === "none" || content === "normal") return;
    const span = document.createElement("span");
    const m = /^"(.*)"$/s.exec(content) || /^'(.*)'$/s.exec(content);
    if (m) span.textContent = m[1];
    span.setAttribute("style", decls(cs));
    if (before) dstEl.insertBefore(span, dstEl.firstChild);
    else dstEl.appendChild(span);
  };

  const bake = (srcEl, dstEl) => {
    dstEl.setAttribute("style", decls(getComputedStyle(srcEl)));
    /* the source still holds elements stripped from the clone (the copy
       button itself) - pair children by position, skipping those */
    const sKids = srcEl.children;
    const dKids = dstEl.children;
    let j = 0;
    for (let i = 0; i < sKids.length; i++) {
      if (sKids[i].classList && sKids[i].classList.contains(BTN_CLASS)) continue;
      bake(sKids[i], dKids[j++]);
    }
    if (!VOID_TAGS.has(srcEl.tagName) && srcEl.namespaceURI.indexOf("svg") === -1) {
      bakePseudo(srcEl, dstEl, "::before", true);
      bakePseudo(srcEl, dstEl, "::after", false);
    }
  };

  /* a bare chart says nothing - most charts carry their meaning in the card
     around them (heading + legend). Walk up to the nearest ancestor that
     combines exactly this one chart with a heading or a legend row. */
  const HEADINGS = "h1, h2, h3, h4";
  const pickTarget = (host) => {
    for (let el = host, depth = 0; el && el !== document.body && depth < 6; el = el.parentElement, depth++) {
      if (el.querySelectorAll(".chart").length === 1 &&
          (el.querySelector(HEADINGS) || el.querySelector(".legend, .hero-legend"))) {
        return el;
      }
    }
    return host;
  };

  const fileName = (target, svg) => {
    const head = target.querySelector(HEADINGS);
    const raw = (head && head.textContent) ||
      (svg && svg.getAttribute("aria-label")) || "chart";
    const label = raw.toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "chart";
    return `auspol-${label}.png`;
  };

  const pageBg = () => {
    const c = getComputedStyle(document.body).backgroundColor;
    return c && c !== "rgba(0, 0, 0, 0)" && c !== "transparent" ? c : "#ffffff";
  };

  const rasterise = (target, host) => new Promise((resolve, reject) => {
    const rect = target.getBoundingClientRect();
    if (!rect.width || !rect.height) { reject(new Error("nothing visible to capture")); return; }
    const dpr = Math.min(Math.max(window.devicePixelRatio || 1, 1), 3);
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);
    const W = Math.max(1, Math.round(rect.width * dpr));
    const H = Math.max(1, Math.round(rect.height * dpr));

    const clone = target.cloneNode(true);
    clone.querySelectorAll("." + BTN_CLASS).forEach((b) => b.remove());
    bake(target, clone);
    /* the rect is what was on screen: the clone's own frame (margin, root
       transform, document flow position) must not shift it a second time */
    clone.style.margin = "0";
    clone.style.transform = "none";
    const rootPos = clone.style.position;
    if (rootPos === "absolute" || rootPos === "fixed") clone.style.position = "relative";
    clone.style.top = "auto"; clone.style.right = "auto";
    clone.style.bottom = "auto"; clone.style.left = "auto";
    clone.style.width = w + "px";
    clone.style.height = h + "px";

    /* WebKit lays foreignObject XHTML out in the img's device-pixel viewport
       and ignores a viewBox transform, which parked the whole card compressed
       in the top-left corner - so the dpr scale rides on a CSS transform
       inside and the svg keeps a 1:1 device-pixel size with no viewBox */
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

    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H +
      '"><foreignObject width="100%" height="100%">' + xhtml + "</foreignObject></svg>";

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
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error("toBlob returned null"))),
          "image/png"
        );
      } catch (err) { reject(err); }
    };
    img.onerror = () => reject(new Error("rasterisation failed"));
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  });

  const flash = (btn) => {
    btn.classList.add("copied");
    btn.innerHTML = TICK_ICON;
    setTimeout(() => {
      btn.classList.remove("copied");
      btn.innerHTML = COPY_ICON;
    }, 1600);
  };

  const copyChart = (host) => {
    const target = pickTarget(host);
    const svg = host.querySelector("svg.chart-svg");
    const png = rasterise(target, host);
    const name = fileName(target, svg);
    const btn = host.querySelector(":scope > ." + BTN_CLASS);

    const download = () =>
      png.then((blob) => {
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
      // promise-valued keeps the user gesture alive while we rasterise
      const viaPromise = () =>
        navigator.clipboard
          .write([new ClipboardItem({ "image/png": png })])
          .then(() => true, () => false);
      // engines without promise support take a resolved blob instead
      const viaBlob = () =>
        png.then((blob) =>
          navigator.clipboard.write([new ClipboardItem({ "image/png": blob })])
        ).then(() => true, () => false);
      const settle = (wrote) => {
        if (wrote) { flash(btn); return; }
        viaBlob().then((wrote2) => {
          if (wrote2) flash(btn);
          else download();
        });
      };
      try { viaPromise().then(settle); }
      catch (e) { settle(false); }
      return;
    }
    download().catch(() => {});
  };

  const attach = () => {
    document.querySelectorAll(".chart").forEach((host) => {
      if (host.querySelector(":scope > ." + BTN_CLASS)) return;
      if (!host.querySelector("svg.chart-svg")) return;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = BTN_CLASS;
      btn.title = ACTION_LABEL;
      btn.setAttribute("aria-label", ACTION_LABEL);
      btn.innerHTML = COPY_ICON;
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        copyChart(host);
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
