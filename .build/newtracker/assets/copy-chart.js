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

  /* a static image cannot be operated, so controls are stripped from the
     clone: the copy button itself and the 2PP hero's interactive switches
     (matchup/range toggles + "Switch 2PP" chips) - the matchup and window
     shown are already described by its title, legend and axis labels */
  const STRIP_SEL =
    "." + BTN_CLASS + ", .hero-controls, .hero-alt";

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

  /* Every ancestor of something stripped, up to the captured root. Their
     computed height was measured while the stripped thing was still in them,
     so baking it leaves a hole exactly the size of what was removed. */
  const elasticSet = (target) => {
    const set = new Set();
    target.querySelectorAll(STRIP_SEL).forEach((el) => {
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
    /* the source still holds elements stripped from the clone (the copy
       button itself) - pair children by position, skipping those */
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


  /* ==================================================================
     The 2PP chart, COMPOSED rather than photographed.
     ==================================================================
     The generic path below clones the card and rides it into an SVG
     <foreignObject>, which asks the rendering engine to lay arbitrary CSS out
     a second time. Chrome obliges. WebKit does not honour flex `gap` in that
     context, so on an iPhone the copied hero came out with its readout jammed
     together - the delta arrow sitting on top of "pts" - while the same build
     was pixel-perfect on a desktop. That is not fixable by baking harder: the
     capture was already carrying gap:12px and the separator span, and the
     engine ignored them.

     So the hero does not get photographed. Its heading, figures and captions
     are LAID OUT here, at a fixed composition that cannot wrap or collapse,
     and the chart itself is embedded as what it already is - a plain <svg>,
     no foreignObject anywhere near it - with its computed paint baked onto
     its own nodes. An <svg> in an <img> is the one thing every engine
     rasterises the same way.

     The words come from the live DOM rather than from AUSPOL, so a copy taken
     while the reader is looking at ALP v One Nation over six months says that,
     and not whatever the headline contest happens to be. */
  const SVG_PROPS = [
    "fill", "fill-opacity", "fill-rule", "stroke", "stroke-width", "stroke-opacity",
    "stroke-dasharray", "stroke-dashoffset", "stroke-linecap", "stroke-linejoin",
    "stroke-miterlimit", "opacity", "color", "display", "visibility",
    "font-family", "font-size", "font-weight", "font-style", "letter-spacing",
    "text-anchor", "dominant-baseline", "paint-order", "vector-effect",
    "transform", "transform-origin", "transform-box", "mix-blend-mode",
  ];

  const bakeSvg = (src) => {
    const clone = src.cloneNode(true);
    const walk = (a, b) => {
      const cs = getComputedStyle(a);
      let out = "";
      for (const prop of SVG_PROPS) {
        const v = cs.getPropertyValue(prop);
        if (v) out += prop + ":" + v + ";";
      }
      b.setAttribute("style", out);
      const ak = a.children, bk = b.children;
      for (let i = 0; i < ak.length; i++) walk(ak[i], bk[i]);
    };
    walk(src, clone);
    const vb = (src.getAttribute("viewBox") || "0 0 1000 420").split(/\s+/).map(Number);
    clone.setAttribute("width", vb[2]);
    clone.setAttribute("height", vb[3]);
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    return { markup: new XMLSerializer().serializeToString(clone), w: vb[2], h: vb[3] };
  };

  /* textContent is wrong here. A rolling figure is ten digits per column - the
     whole reel is in the DOM so it can slide - and its true value lives in the
     .sr-only span beside them. Reading the element raw gave "789.0123456789"
     where the page says 50.7. Reels are swapped for that value first, root
     included, since .ro-num IS one. */
  const txt = (el) => {
    if (!el) return "";
    const val = (r) => { const sr = r.querySelector(".sr-only"); return sr ? sr.textContent : ""; };
    if (el.classList && el.classList.contains("roll")) return val(el).trim();
    const c = el.cloneNode(true);
    c.querySelectorAll(".roll").forEach((r) => r.replaceWith(document.createTextNode(val(r))));
    c.querySelectorAll(".sr-only").forEach((n) => n.remove());
    return (c.textContent || "").replace(/\s+/g, " ").trim();
  };
  const col = (el, prop) => (el ? getComputedStyle(el)[prop || "color"] : "#000");

  const composeTpp = (target) => new Promise((resolve, reject) => {
    const svgEl = target.querySelector("svg.chart-svg");
    if (!svgEl) { reject(new Error("no chart to compose")); return; }
    const cs = getComputedStyle(document.body);
    const T = {
      bg: pageBg(),
      ink: cs.getPropertyValue("--ink") ? col(document.querySelector(".card-title")) : "#222",
      ink2: col(document.querySelector(".lead-tag")),
      ink3: col(document.querySelector(".hi-note")) || col(document.querySelector(".hero-caption")),
    };
    const sans = getComputedStyle(document.querySelector(".hi-note") || document.body).fontFamily;
    const serif = getComputedStyle(document.querySelector(".card-title") || document.body).fontFamily;

    const parties = [...target.querySelectorAll(".ro-party")].map((p) => ({
      name: txt(p.querySelector(".ro-name")),
      num: txt(p.querySelector(".ro-num")),
      dot: col(p.querySelector(".ro-dot"), "backgroundColor"),
      ink: col(p.querySelector(".ro-num")),
    }));
    const legend = [...target.querySelectorAll(".hl-item")].map((i) => {
      const sw = i.querySelector("span");
      const k = sw ? sw.className : "";
      const cs2 = sw ? getComputedStyle(sw) : null;
      return {
        label: txt(i),
        /* a rule, a dot and a shaded band are three different marks, and a
           legend that drew all three as a line would be describing a chart
           that does not exist */
        kind: /hl-line/.test(k) ? "line" : /hl-dashed/.test(k) ? "dashed"
            : /hl-band/.test(k) ? "band" : "dot",
        fill: cs2 ? (cs2.backgroundColor !== "rgba(0, 0, 0, 0)"
                     ? cs2.backgroundColor : cs2.borderTopColor) : "#888",
        alpha: cs2 ? (parseFloat(cs2.opacity) || 1) : 1,
      };
    });
    const meta = [txt(target.querySelector(".hi-method")), txt(target.querySelector(".hi-range")),
                  txt(target.querySelector(".hi-note"))].filter(Boolean).join("  ·  ");
    const lead = [txt(target.querySelector(".lead-tag")), txt(target.querySelector(".delta")),
                  txt(target.querySelector(".hero-sub-note"))].filter(Boolean).join("  ");
    const title = txt(target.querySelector(".card-title")) || "Two-party preferred";
    const caption = txt(target.querySelector(".hero-caption"));

    const { markup, w: vw, h: vh } = bakeSvg(svgEl);
    const img = new Image();
    img.onerror = () => reject(new Error("chart did not rasterise"));
    img.onload = () => {
      try {
        const S = 2, W = 1200, PAD = 64, IW = W - PAD * 2;
        const chartH = Math.round(IW * (vh / vw));
        /* Laid out top-down with real measurements, so nothing can collide the
           way flex did when its gaps were dropped. */
        const c0 = document.createElement("canvas").getContext("2d");
        c0.font = "400 15px " + sans;
        const capLines = wrapText(c0, caption, IW);
        const H = 96 + 104 + 30 + 28 + 26 + chartH + 44 + (capLines.length * 22) + 44;

        const cv = document.createElement("canvas");
        cv.width = W * S; cv.height = H * S;
        const c = cv.getContext("2d");
        c.scale(S, S);
        c.fillStyle = T.bg; c.fillRect(0, 0, W, H);
        c.textBaseline = "alphabetic";

        let y = 76;
        c.fillStyle = T.ink; c.font = "600 40px " + serif;
        c.fillText(title, PAD, y);

        /* The readout, mirrored about a rule the way the page sets it -
           measured and centred rather than trusted to a flex row. */
        y += 92;
        let FIG = 68, NAME = 19; const DOT = 6, G = 14;
        c.font = "800 " + FIG + "px " + sans;
        const wNum = parties.map((p) => c.measureText(p.num).width);
        c.font = "700 " + NAME + "px " + sans;
        const wName = parties.map((p) => c.measureText(p.name).width);
        let rowW = DOT * 2 + G + wName[0] + G + wNum[0] + G + 2 + G
                 + wNum[1] + G + wName[1] + G + DOT * 2;
        /* A fixed composition still has to survive a wide readout - "Labor v
           One Nation" sets longer names than the headline pair. Shrink the
           figure until the row fits rather than letting it run off the edge,
           which is the failure mode the DOM capture had. */
        if (rowW > IW) {
          const k = IW / rowW;
          FIG = Math.floor(FIG * k); NAME = Math.floor(NAME * k);
          c.font = "800 " + FIG + "px " + sans;
          for (let i = 0; i < parties.length; i++) wNum[i] = c.measureText(parties[i].num).width;
          c.font = "700 " + NAME + "px " + sans;
          for (let i = 0; i < parties.length; i++) wName[i] = c.measureText(parties[i].name).width;
          rowW = DOT * 2 + G + wName[0] + G + wNum[0] + G + 2 + G
               + wNum[1] + G + wName[1] + G + DOT * 2;
        }
        /* Left, with everything else. Centring it made the one element that
           did not line up with the title, the method line or the caption. */
        let x = PAD;
        const dot = (cx, fill) => { c.beginPath(); c.arc(cx, y - FIG * 0.28, DOT, 0, 7);
          c.fillStyle = fill; c.fill(); };
        dot(x + DOT, parties[0].dot); x += DOT * 2 + G;
        c.font = "700 " + NAME + "px " + sans; c.fillStyle = T.ink2;
        c.fillText(parties[0].name, x, y); x += wName[0] + G;
        c.font = "800 " + FIG + "px " + sans; c.fillStyle = parties[0].ink;
        c.fillText(parties[0].num, x, y); x += wNum[0] + G;
        c.strokeStyle = T.ink3; c.globalAlpha = 0.35; c.lineWidth = 2;
        c.beginPath(); c.moveTo(x + 1, y - FIG * 0.78); c.lineTo(x + 1, y + 4); c.stroke();
        c.globalAlpha = 1; x += 2 + G;
        c.font = "800 " + FIG + "px " + sans; c.fillStyle = parties[1].ink;
        c.fillText(parties[1].num, x, y); x += wNum[1] + G;
        c.font = "700 " + NAME + "px " + sans; c.fillStyle = T.ink2;
        c.fillText(parties[1].name, x, y); x += wName[1] + G;
        dot(x + DOT, parties[1].dot);

        y += 34;
        c.font = "600 15px " + sans; c.fillStyle = T.ink3;
        c.fillText(meta, PAD, y);
        y += 26;
        c.font = "700 15px " + sans; c.fillStyle = T.ink2;
        c.fillText(lead, PAD, y);

        y += 30;
        c.drawImage(img, PAD, y, IW, chartH);
        y += chartH + 30;

        /* the legend, drawn rather than screenshotted, so its rule swatches
           keep their colour and its items keep their spacing */
        let lx = PAD;
        c.font = "600 14px " + sans;
        legend.forEach((it) => {
          const tw = c.measureText(it.label).width;
          const my = y - 5;
          c.save(); c.globalAlpha = it.alpha;
          if (it.kind === "line" || it.kind === "dashed") {
            c.strokeStyle = it.fill; c.lineWidth = 3; c.lineCap = "round";
            if (it.kind === "dashed") c.setLineDash([4, 4]);
            c.beginPath(); c.moveTo(lx, my); c.lineTo(lx + 18, my); c.stroke();
            c.setLineDash([]);
          } else if (it.kind === "band") {
            /* .hl-band is a two-stop gradient of the two party colours, and a
               gradient has no backgroundColor to read - the swatch came out
               the grey of a fallback border. Rebuilt from the series colours
               the legend is already carrying. */
            const two = legend.filter((l) => l.kind === "line").map((l) => l.fill);
            const g = c.createLinearGradient(0, my - 5, 0, my + 6);
            g.addColorStop(0, two[0] || it.fill); g.addColorStop(1, two[1] || two[0] || it.fill);
            c.globalAlpha = 0.22; c.fillStyle = g;
            c.beginPath(); c.roundRect(lx, my - 5, 18, 11, 2); c.fill();
          } else {
            c.fillStyle = it.fill;
            c.beginPath(); c.arc(lx + 5, my, 4.5, 0, 7); c.fill();
          }
          c.restore();
          c.fillStyle = T.ink2; c.fillText(it.label, lx + 26, y);
          lx += 26 + tw + 24;
        });

        y += 30;
        c.font = "400 15px " + sans; c.fillStyle = T.ink3;
        capLines.forEach((ln) => { c.fillText(ln, PAD, y); y += 22; });

        c.font = "600 15px " + sans; c.fillStyle = T.ink2;
        c.textAlign = "right";
        c.fillText("auspoltracker.com", W - PAD, H - 34);
        c.textAlign = "left";

        cv.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob returned null"))), "image/png");
      } catch (e) { reject(e); }
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
      if (ctx.measureText(t).width > max && line) { lines.push(line); line = w; }
      else line = t;
    }
    if (line) lines.push(line);
    return lines;
  };

  const rasterise = (target, host) => new Promise((resolve, reject) => {
    const rect = target.getBoundingClientRect();
    if (!rect.width || !rect.height) { reject(new Error("nothing visible to capture")); return; }
    const dpr = Math.min(Math.max(window.devicePixelRatio || 1, 1), 3);
    const w = Math.round(rect.width);

    const clone = target.cloneNode(true);
    clone.querySelectorAll(STRIP_SEL).forEach((b) => b.remove());
    bake(target, clone, elasticSet(target));
    /* the rect is what was on screen: the clone's own frame (margin, root
       transform, document flow position) must not shift it a second time */
    clone.style.margin = "0";
    clone.style.transform = "none";
    const rootPos = clone.style.position;
    if (rootPos === "absolute" || rootPos === "fixed") clone.style.position = "relative";
    clone.style.top = "auto"; clone.style.right = "auto";
    clone.style.bottom = "auto"; clone.style.left = "auto";
    clone.style.width = w + "px";

    /* The height is MEASURED off the stripped clone, not taken from the live
       rect. rect was read before the strip, so on a layout where the removed
       controls sit in their own row - every phone, where .hero-top wraps -
       it is taller than what is left by exactly the band they occupied, and
       the capture came out with a hole in it and blank space to match. On a
       desktop the controls are a short side column that never set the row's
       height, which is why this only ever showed on a phone.

       Laid out off-screen rather than guessed at: the clone is already fully
       style-baked, so the only thing it needs to report a true height is a
       box of the right width to flow in. */
    clone.style.height = "auto";
    const holder = document.createElement("div");
    holder.style.cssText = "position:fixed;left:-100000px;top:0;width:" + w +
      "px;visibility:hidden;pointer-events:none;";
    holder.appendChild(clone);
    document.body.appendChild(holder);
    const h = Math.max(1, Math.round(clone.getBoundingClientRect().height));
    holder.remove();
    clone.style.height = h + "px";

    const W = Math.max(1, Math.round(w * dpr));
    const H = Math.max(1, Math.round(h * dpr));

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
    /* The hero is composed; everything else is still captured. One chart
       proven end to end beats six renderers half-tested, and the capture path
       stays the fallback if composing throws - a copy that silently produces
       nothing is worse than one that produces the old picture.

       Found by walking UP from the chart, not by testing whatever pickTarget
       returned: that walk stops at the nearest ancestor holding a heading or a
       legend, which is the .hero section on a desktop and an inner wrapper on
       a phone - so testing its class composed the card at one width and
       quietly captured at the other, which is exactly the bug being fixed. */
    const heroEl = host.closest && host.closest(".hero");
    const composed = !!(heroEl && heroEl.querySelector(".hero-readout") && heroEl.querySelector("svg.chart-svg"));
    const png = composed
      ? composeTpp(heroEl).catch((e) => {
          /* Falling back is right; falling back QUIETLY is not. A composer
             that throws on one viewport and not another looks like nothing at
             all from the outside - the copy still works, just worse. */
          console.warn("copy-chart: composed 2PP failed, captured instead –", e && e.message || e);
          return rasterise(target, host);
        })
      : rasterise(target, host);
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
