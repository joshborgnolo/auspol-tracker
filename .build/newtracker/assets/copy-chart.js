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
     (matchup/range toggles, laptop copies in .hero-chartbar, now nested at
     the foot of the stripped .hero-controls column, + "Switch 2PP" chips) -
     the matchup and window shown are already described by its title, legend
     and axis labels. .pg-phone is the phone-only copy of the Compare toggle that
     lives outside .hero-controls (under the legend), so it must be stripped
     separately */
  const STRIP_SEL =
    "." + BTN_CLASS + ", .hero-controls, .hero-alt, .hero-chartbar, .pg-phone";

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

  /* The chart sizes its own labels against its MEASURED width - scale = cw /
     1000, and every label is expressed in units of 10.5px/scale - so a 388px
     phone renders them nearly three times larger in user units, and the event
     annotations get dropped for want of room (row == null in charts.jsx). The
     copy is a thing people send to other people; it should not be the thinner
     chart just because it was taken on a phone.

     So the chart is asked to lay itself out wide before it is serialised. The
     width is real, or the ResizeObserver would not fire and React would not
     re-run the placement - there is no way to fake this from the outside. The
     jump that would cause is prevented rather than tolerated: the host is
     pinned to its current height and clipped, the svg is taken out of flow
     inside it and hidden, so nothing below moves and nothing is seen to
     change. Everything is put back in a finally. */
  const COPY_W = 1120;
  const widenForCopy = async (svg) => {
    /* The chart measures ITS HOST, not its svg - charts.jsx puts the ref and
       the ResizeObserver on <div class="chart">. Widening the svg alone left
       cw at 388, the observer never fired, and the placement never re-ran:
       the svg came out 1120 wide with the same dropped labels. It is the host
       that has to grow. */
    const host = svg.closest(".chart");
    const anchor = host && host.parentElement;
    if (!host || !anchor || host.getBoundingClientRect().width >= COPY_W - 1) return () => {};
    const hostStyle = host.getAttribute("style"), anchorStyle = anchor.getAttribute("style");
    /* Measure before mutating: the stand-in and the sibling freeze below are
       placed from these rects. */
    const hostRect = host.getBoundingClientRect();
    const anchorRect = anchor.getBoundingClientRect();
    const anchorCS = getComputedStyle(anchor);
    /* The host's siblings share its containing block - in the hero that is the
       whole section, so the legend and caption sit below the chart in flow.
       Taking the host out of flow lets them slide up into the freed space,
       and they show through the transparent parts of the stand-in pinned over
       the slot (the phone reported the caption climbing onto the chart).
       Freeze each in-flow sibling where it is for the park's duration: an
       absolute box at its measured border-box rect, margins zeroed, inside
       the height-pinned anchor. */
    const bL = parseFloat(anchorCS.borderLeftWidth) || 0;
    const bT = parseFloat(anchorCS.borderTopWidth) || 0;
    const frozenSibs = [];
    for (const sib of anchor.children) {
      if (sib === host) continue;
      const cs = getComputedStyle(sib);
      if (cs.position !== "static" && cs.position !== "relative" && cs.position !== "sticky") continue;
      const r = sib.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      frozenSibs.push({ el: sib, style: sib.getAttribute("style"),
                        left: r.left - anchorRect.left - bL, top: r.top - anchorRect.top - bT,
                        width: r.width, height: r.height });
    }
    /* Taking the host out of flow would collapse everything under it, so the
       ancestor is pinned to its current height and clipped first. Nothing
       below moves, and the wide chart is parked outside the clip - offset
       rather than hidden, since visibility and opacity would be baked into
       the serialised svg and blank the copy. */
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
    /* The park leaves a hole until restore() puts the host back - visibly
       about a second on a phone, where the wide re-layout and the compose
       take that long (the desktop either clears the width check above or
       finishes before a frame paints). Pin a static clone where the chart
       was so the screen shows a frozen, unclickable image of what was there
       instead of the hole. It rides on <body>, fixed, not inside the card:
       inside, the composer running below would read its .ro-party/.hl-item
       nodes a second time and draw every legend row twice. */
    const stand = host.cloneNode(true);
    stand.style.position = "fixed";
    stand.style.margin = "0";
    stand.style.top = hostRect.top + "px";
    stand.style.left = hostRect.left + "px";
    stand.style.width = hostRect.width + "px";
    stand.style.height = hostRect.height + "px";
    stand.style.pointerEvents = "none";
    stand.setAttribute("aria-hidden", "true");
    document.body.appendChild(stand);
    host.style.position = "absolute";
    host.style.top = "0";
    host.style.left = "-99999px";
    host.style.width = COPY_W + "px";
    /* Wait for the observer to fire and React to commit the wider placement,
       watching for the labels themselves rather than counting frames - a busy
       main thread makes any fixed frame count a guess. */
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 16));
      if (svg.querySelector(".evt-label")) break;
    }
    return () => {
      /* stand out first so the frame that brings the host back never shows
         the pair stacked - removal and restore are one paint */
      if (stand.parentNode) stand.parentNode.removeChild(stand);
      if (hostStyle == null) host.removeAttribute("style"); else host.setAttribute("style", hostStyle);
      for (const f of frozenSibs) {
        if (f.style == null) f.el.removeAttribute("style"); else f.el.setAttribute("style", f.style);
      }
      if (anchorStyle == null) anchor.removeAttribute("style"); else anchor.setAttribute("style", anchorStyle);
    };
  };

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
    /* The root is the one element whose own visibility must not be inherited
       from the page: it is being rendered standalone. */
    clone.style.visibility = "visible";
    clone.style.opacity = "1";
    clone.style.display = "block";
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
  const col = (el, prop) => (el ? getComputedStyle(el)[prop || "color"] : null);
  /* Resolved through a probe rather than read as a raw token, because a canvas
     fillStyle wants a resolved colour - the same trick make-card.js uses. */
  const inkVar = (name) => {
    const el = document.createElement("span");
    el.style.color = "var(" + name + ")";
    document.body.appendChild(el);
    const v = getComputedStyle(el).color;
    el.remove();
    return v;
  };

  /* Every chart card has the same bones - a title, a subtitle or a readout,
     the chart, a legend, sometimes a caption - so one composer draws them all
     and the hero is simply the card that has a readout instead of a subtitle.
     Three legend idioms exist across the tabs (.hl-item on the hero,
     .legend-chip on primary vote, .cyc-chip on past cycles) and each swatch is
     read for the mark it actually is, so a rule, a dot, a shaded band and a
     square are not all drawn as lines. */
  const readLegend = (target) =>
    [...target.querySelectorAll(".hl-item, .legend-chip, .cyc-chip")].map((i) => {
      const sw = i.querySelector(".hl-line,.hl-dashed,.hl-band,.hl-dot,.hl-swatch-dot,.legend-swatch,.cyc-swatch");
      const k = sw ? (sw.className || "") : "";
      const cs2 = sw ? getComputedStyle(sw) : null;
      /* Joined from the chip's own parts, not read off it whole: a legend chip
         is <span>Labor</span><span>27.8%</span> with only a flex gap between
         them, so concatenating the text gave "Labor27.8%". Items whose label
         is a bare text node beside the swatch fall back to reading the chip. */
      const parts = [...i.children]
        .filter((ch) => !/swatch|hl-line|hl-dashed|hl-band|hl-dot/.test(ch.className || ""))
        .map((ch) => txt(ch)).filter(Boolean);
      return {
        label: parts.length ? parts.join(" ") : txt(i),
        kind: /hl-line/.test(k) ? "line" : /hl-dashed/.test(k) ? "dashed"
            : /hl-band/.test(k) ? "band" : /legend-swatch/.test(k) ? "square" : "dot",
        fill: cs2 ? (cs2.backgroundColor !== "rgba(0, 0, 0, 0)" ? cs2.backgroundColor
                                                               : cs2.borderTopColor) : "#888",
        /* a chip switched off is still on the page, so it is still in the
           copy - at the weight the page gives it, not silently dropped */
        alpha: (cs2 ? (parseFloat(cs2.opacity) || 1) : 1) * (i.classList.contains("off") ? 0.45 : 1),
      };
    });

  const composeCard = async (target) => {
    const svgEl = target.querySelector("svg.chart-svg");
    if (!svgEl) throw new Error("no chart to compose");
    const restore = await widenForCopy(svgEl);
    try { return await composeCardInner(target, svgEl); }
    finally { restore(); }
  };

  const composeCardInner = (target, svgEl) => new Promise((resolve, reject) => {
    /* Taken from the theme's own tokens, not from whichever element happened
       to be on screen. ink2 used to come from .lead-tag, which exists only in
       the hero - so on every other card col() fell through to its "#000"
       default and the legend was drawn in hard black. Invisible on a dark
       page, and indistinguishable from correct on a light one, which is why
       it survived. col() no longer has a black default either. */
    const T = { bg: pageBg(), ink: inkVar("--ink"), ink2: inkVar("--ink-2"), ink3: inkVar("--ink-3") };
    const sans = getComputedStyle(document.querySelector(".card-sub") || document.body).fontFamily;
    const serif = getComputedStyle(document.querySelector(".card-title") || document.body).fontFamily;

    const isHero = !!target.querySelector(".hero-readout");
    const parties = [...target.querySelectorAll(".ro-party")].map((p) => ({
      name: txt(p.querySelector(".ro-name")),
      num: txt(p.querySelector(".ro-num")),
      dot: col(p.querySelector(".ro-dot"), "backgroundColor"),
      ink: col(p.querySelector(".ro-num")),
    }));
    /* Read before the legend, which needs the title to tell an opposition
       chart from a government one. */
    const titleBase = txt(target.querySelector(".card-title, h2, h3")) || "auspol tracker";
    const sub = txt(target.querySelector(".card-sub"));
    const caption = txt(target.querySelector(".hero-caption, .chart-note, .card-note"));

    /* Past cycles keeps its legend OUTSIDE the card - one row of chips at the
       top of the tab selects cycles for all five charts - so a card copied on
       its own arrived with six unnamed lines and years for end labels. Worse,
       those chips name the PRIME MINISTER, which on an opposition chart is the
       wrong person entirely: the 2013 line is Shorten, not Abbott.

       So the legend is rebuilt from the end labels the chart drew. Pairing on
       those rather than on the cycle list means the colours are the ones
       actually used - an opposition line is drawn in the OPPOSITION party's
       colour, not the cycle's - and a cycle the reader has switched off has no
       label, so it is absent here too, without having to ask the chips.

       A label that is not a year belongs to an overlay, not a term: Hanson's
       line, labelled PH and named by matching the line's colour against
       LEADERS (which is where the chart took it), and One Nation's vote over
       the current term, ending "ON ’25" and mapping in the classifier
       below. */
    const cycleLegend = () => {
      const AUS = window.AUSPOL || {};
      const cyc = AUS.cycles && (Array.isArray(AUS.cycles) ? AUS.cycles : Object.values(AUS.cycles));
      const labels = [...svgEl.querySelectorAll(".end-label")];
      if (!cyc || !labels.length) return [];
      const opp = /opposition/i.test(titleBase + " " + sub);   // `title` is not bound yet here
      const resolve = (c) => {
        const el = document.createElement("span");
        el.style.color = c; document.body.appendChild(el);
        const v = getComputedStyle(el).color; el.remove(); return v;
      };
      const leaders = (AUS.LEADERS || []).map((l) => ({ id: l.id, name: l.name, col: resolve(l.color) }));
      /* When a leader's line actually starts. leaderMonths runs from the
         election with every leader's field null until they appear, so their
         first month is the first row carrying one.

         The MEASURE matters: Hanson's favourability begins 2025-11 but her net
         approval - the series these charts draw - begins 2026-02, and reading
         any field gave 2025, three months before the line exists. Net is asked
         for first, since a leader only joins these charts by being rated on
         it. */
      const firstYear = (id) => {
        const lm = AUS.leaderMonths || [];
        const hit = lm.find((r) => r[id + "_net"] != null)
                 || lm.find((r) => Object.keys(r).some((k) => k.indexOf(id + "_") === 0 && r[k] != null));
        return hit && hit.ym ? String(hit.ym).slice(0, 4) : null;
      };
      const entries = labels.map((t) => {
        const text = (t.textContent || "").trim();
        const fill = getComputedStyle(t).fill;
        /* The digits are not the first word here: One Nation's overlay ends
           "ON ’25", and digits alone would pass for the 2025 term and hang
           that term's opposition leaders - "2025 Ley -> Taylor" - on the
           party's vote line. The legend spreads the abbreviation the way
           the chart's own checkbox does. */
        if (/^ON[’ ]+\d{2}$/.test(text))
          return { label: text.replace(/^ON/, "One Nation"),
                   kind: "dashed", fill, alpha: 1, year: 9999 };
        const digits = text.replace(/[^0-9]/g, "");
        const c = !/[A-Za-z]/.test(text) && digits.length === 2 &&
          cyc.find((r) => String(r.year).slice(2) === digits);
        if (c) return { label: c.year + " " + (opp ? (c.oppLead || c.lead) : c.lead),
                        kind: "line", fill, alpha: 1, year: c.year };
        /* A leader who is not a cycle needs saying differently. Every other
           entry reads "2025 Ley -> Taylor", meaning the leader OF that term -
           so "2025 Hanson" would file her among prime ministers and opposition
           leaders, which she has never been. "Hanson, from 2026" says the one
           true thing instead: when her line starts. */
        const m = leaders.find((l) => l.col === fill);
        const from = m && firstYear(m.id);
        return { label: m ? (m.name + (from ? ", from " + from : "")) : (t.textContent || "").trim(),
                 kind: "dashed", fill, alpha: 1, year: 9999 };
      }).sort((a, b) => a.year - b.year);
      /* While the band is on the chart, the end labels name only the current
         term (plus any chip-hovered one) - the copied card showed a purple
         wash that nothing claimed, warming over terms it never named. Here
         the legend gains the entry the live view gives its band: the terms
         it pools, read off the chips (everything not switched off), minus
         any the chart already labels by name. */
      if (svgEl.querySelector(".cyc-band")) {
        const chips = [...document.querySelectorAll(".cyc-chip")]
          .filter((ch) => !ch.classList.contains("off") && !ch.classList.contains("current"));
        const named = new Set(entries.filter((e) => e.year < 9000).map((e) => e.year));
        const years = chips.map((ch) => {
          const y = ch.querySelector(".cyc-year");
          const n = y ? parseInt(y.textContent, 10) : NaN;
          return Number.isFinite(n) && !named.has(n) ? n : null;
        }).filter((n) => n != null);
        if (years.length) {
          const lo = svgEl.querySelector(".cyc-band.lo"), hiB = svgEl.querySelector(".cyc-band.hi");
          entries.push({
            label: "Past terms (" + years.join(", ") + "): mean of the set, middle half and middle 80%",
            kind: "cycband",
            fill: inkVar("--cyc-fill"),
            lo: lo ? parseFloat(getComputedStyle(lo).opacity) || 0.09 : 0.09,
            hi: hiB ? parseFloat(getComputedStyle(hiB).opacity) || 0.17 : 0.17,
            alpha: 1, year: 9998,
          });
          entries.sort((a, b) => a.year - b.year);
        }
      }
      return entries;
    };
    let legend = readLegend(target);
    if (!legend.length) legend = cycleLegend();
    /* the ± range rides inside .lead-tag now, so the meta tail drops it -
       keeping it here too would print the interval twice on the image. The
       tail mirrors the interval strip: note, method, poll window. */
    const meta = [txt(target.querySelector(".hi-note")),
                  txt(target.querySelector(".hi-method")),
                  txt(target.querySelector(".hi-count"))].filter(Boolean).join("  ·  ");
    const lead = [txt(target.querySelector(".lead-tag")), txt(target.querySelector(".delta")),
                  txt(target.querySelector(".hero-sub-note"))].filter(Boolean).join("  ");
    const hero = isHero && parties.length === 2;

    /* A shared image has to say what period it covers - the page around it
       does not travel with it. Past cycles names every term it shows, and a
       deselected term breaks the range in two: each run of shown chips is
       labelled from its first election to the next election boundary
       (2007's term runs to the 2010 election, so 1987-2007), and the run
       holding the live term ends in "present". The years come from the
       chips, not the legend - banded terms have no label of their own to
       take a year from. Every other chart names the span its x-axis
       already runs across. */
    const abRange = (a, b) => {
      /* 2010-25, not 2010-2025: the second year is written short when it
         shares a century with the first, which is how a year range is set.
         Guarded rather than assumed - a range that crosses one (1999-2001)
         has to print both in full or it reads as going backwards. */
      const short = typeof b === "number" && String(a).slice(0, 2) === String(b).slice(0, 2);
      return a + "\u2013" + (short ? String(b).slice(2) : b);
    };
    const chipByYear = new Map();
    [...document.querySelectorAll(".cyc-chip")].forEach((ch) => {
      const y = parseInt((ch.querySelector(".cyc-year") || {}).textContent, 10);
      if (Number.isFinite(y) && !chipByYear.has(y)) chipByYear.set(y, {
        off: ch.classList.contains("off"), current: ch.classList.contains("current"),
      });
    });
    const cycs = [...chipByYear.keys()].sort((a, b) => a - b)
      .map((year) => ({ year, off: chipByYear.get(year).off, current: chipByYear.get(year).current }));
    const yrs = legend.map((l) => l.year).filter((y) => y && y < 9000).sort((a, b) => a - b);
    const xLabels = [...svgEl.querySelectorAll(".axis-label.x")].map((n) => txt(n)).filter(Boolean);
    const datey = (t) => /[0-9]/.test(t) && !/^(Election|\d+ ?yrs?)$/i.test(t);
    let span = "", cycSpan = false;
    if (cycs.length) {
      const runs = [];
      cycs.forEach((c, i) => {
        if (c.off) return;
        const prev = i > 0 ? cycs[i - 1] : null;
        if (prev && !prev.off && runs.length) runs[runs.length - 1].push(c);
        else runs.push([c]);
      });
      const ranges = runs.map((run) => {
        const first = run[0], next = cycs[cycs.indexOf(run[run.length - 1]) + 1];
        if (!next && run[run.length - 1].current) return abRange(first.year, "present");
        const end = next ? next.year : run[run.length - 1].year;
        return end === first.year ? String(first.year) : abRange(first.year, end);
      });
      if (ranges.length) { span = ranges.join(", "); cycSpan = true; }
    }
    if (!span && yrs.length >= 2)
      span = abRange(yrs[0], yrs[yrs.length - 1]);
    else if (!span && xLabels.length >= 2 && datey(xLabels[0]) && datey(xLabels[xLabels.length - 1]))
      span = xLabels[0] + " \u2013 " + xLabels[xLabels.length - 1];
    const title = span ? titleBase + (cycSpan ? ", " : "  \u00b7  ") + span : titleBase;

    const { markup, w: vw, h: vh } = bakeSvg(svgEl);
    const img = new Image();
    img.onerror = () => reject(new Error("chart did not rasterise"));
    img.onload = () => {
      try {
        const S = 2, W = 1200, PAD = 64, IW = W - PAD * 2;
        const chartH = Math.round(IW * (vh / vw));
        const m = document.createElement("canvas").getContext("2d");

        /* Measured before anything is drawn: the canvas has to be the right
           height before the first stroke, and a legend of five chips or a
           three-line caption is not a fixed cost. */
        m.font = "400 15px " + sans;
        const capLines = wrapText(m, caption, IW);
        m.font = "600 14px " + sans;
        const LEG_GAP = 26, SW_W = 26;
        const legLines = [];
        let line = [], used = 0;
        legend.forEach((it) => {
          const w = SW_W + m.measureText(it.label).width + LEG_GAP;
          if (used + w > IW && line.length) { legLines.push(line); line = []; used = 0; }
          line.push(it); used += w;
        });
        if (line.length) legLines.push(line);

        const headBlock = hero ? 92 + 34 + 26 : (sub ? 40 : 8);
        const H = 76 + headBlock + 30 + chartH + 34 + legLines.length * 26
                + (capLines.length ? 8 + capLines.length * 22 : 0) + 56;

        const cv = document.createElement("canvas");
        cv.width = W * S; cv.height = H * S;
        const c = cv.getContext("2d");
        c.scale(S, S);
        c.fillStyle = T.bg; c.fillRect(0, 0, W, H);
        c.textBaseline = "alphabetic";

        let y = 76;
        c.fillStyle = T.ink; c.font = "600 40px " + serif;
        c.fillText(title, PAD, y);

        if (hero) {
          y += 92;
          let FIG = 68, NAME = 19; const DOT = 6, G = 14;
          c.font = "800 " + FIG + "px " + sans;
          const wNum = parties.map((p) => c.measureText(p.num).width);
          c.font = "700 " + NAME + "px " + sans;
          const wName = parties.map((p) => c.measureText(p.name).width);
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
          c.font = "600 15px " + sans; c.fillStyle = T.ink3; c.fillText(meta, PAD, y);
          y += 26;
          c.font = "700 15px " + sans; c.fillStyle = T.ink2; c.fillText(lead, PAD, y);
        } else if (sub) {
          y += 32;
          c.font = "400 16px " + sans; c.fillStyle = T.ink3;
          c.fillText(wrapText(c, sub, IW)[0] || sub, PAD, y);
          y += 8;
        } else { y += 8; }

        y += 30;
        c.drawImage(img, PAD, y, IW, chartH);
        y += chartH + 34;

        c.font = "600 14px " + sans;
        legLines.forEach((ln) => {
          let lx = PAD;
          ln.forEach((it) => {
            const tw = c.measureText(it.label).width, my = y - 5;
            c.save(); c.globalAlpha = it.alpha;
            if (it.kind === "line" || it.kind === "dashed") {
              c.strokeStyle = it.fill; c.lineWidth = 3; c.lineCap = "round";
              if (it.kind === "dashed") c.setLineDash([4, 4]);
              c.beginPath(); c.moveTo(lx, my); c.lineTo(lx + 18, my); c.stroke();
              c.setLineDash([]);
            } else if (it.kind === "cycband") {
              /* the past-cycles band swatch echoes the live legend's key:
                 both fills stacked at their own opacities with the mean's
                 dash across – a flat rect would not read as two bands */
              c.fillStyle = it.fill;
              c.globalAlpha = it.alpha * it.lo;
              c.beginPath(); c.roundRect(lx, my - 5, 18, 11, 2); c.fill();
              c.globalAlpha = it.alpha * it.hi;
              c.beginPath(); c.roundRect(lx, my - 2.5, 18, 6, 1); c.fill();
              c.globalAlpha = it.alpha * 0.85;
              c.strokeStyle = T.ink2; c.lineWidth = 1.6; c.lineCap = "round";
              c.setLineDash([2, 2.7]);
              c.beginPath(); c.moveTo(lx, my); c.lineTo(lx + 18, my); c.stroke();
              c.setLineDash([]);
            } else if (it.kind === "band") {
              const two = legend.filter((l) => l.kind === "line").map((l) => l.fill);
              const g = c.createLinearGradient(0, my - 5, 0, my + 6);
              g.addColorStop(0, two[0] || it.fill); g.addColorStop(1, two[1] || two[0] || it.fill);
              c.globalAlpha = it.alpha * 0.22; c.fillStyle = g;
              c.beginPath(); c.roundRect(lx, my - 5, 18, 11, 2); c.fill();
            } else if (it.kind === "square") {
              c.fillStyle = it.fill;
              c.beginPath(); c.roundRect(lx + 3, my - 5, 11, 11, 2); c.fill();
            } else {
              c.fillStyle = it.fill;
              c.beginPath(); c.arc(lx + 5, my, 4.5, 0, 7); c.fill();
            }
            c.restore();
            c.fillStyle = T.ink2; c.fillText(it.label, lx + SW_W, y);
            lx += SW_W + tw + LEG_GAP;
          });
          y += 26;
        });

        if (capLines.length) {
          y += 8;
          c.font = "400 15px " + sans; c.fillStyle = T.ink3;
          capLines.forEach((ln) => { c.fillText(ln, PAD, y); y += 22; });
        }

        c.font = "600 15px " + sans; c.fillStyle = T.ink2;
        c.textAlign = "right";
        c.fillText("auspoltracker.com", W - PAD, H - 34);
        c.textAlign = "left";

        cv.toBlob((b2) => (b2 ? resolve(b2) : reject(new Error("toBlob returned null"))), "image/png");
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
    /* Every chart is composed now, not just the hero. The capture stays as
       the fallback if composing throws - a copy that produces nothing is worse
       than one that produces the old picture - and it says so in the console
       rather than degrading in silence.

       The card is found by walking UP from the chart rather than by testing
       whatever pickTarget returned: that walk stops at the nearest ancestor
       holding a heading or a legend, which differs by viewport, and testing it
       composed at one width and quietly captured at another. */
    const card = host.closest && host.closest(".card");
    const png = (card && card.querySelector("svg.chart-svg"))
      ? composeCard(card).catch((e) => {
          console.warn("copy-chart: composed card failed, captured instead –", e && e.message || e);
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
