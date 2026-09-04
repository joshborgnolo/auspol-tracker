/* auspol tracker – copy-as-image for the expanded poll breakdown.

   A small icon button at the bottom-right corner of every open
   `.poll-detail` panel that turns the panel - provenance band, section
   rules, eyebrow kickers and every published figure exactly as laid out -
   into a PNG on a 1200px card at the same 2x scale the chart copies come
   out at. If a clipboard write is unavailable or refused, the PNG
   downloads instead (and on http pages, where no clipboard API exists,
   the button says so rather than promising a copy).

   It is the sibling of copy-chart.js, and deliberately NOT a caller of it:
   the chart copy composes an svg under card chrome; this one paints DOM
   text. The two share no code (plain scripts are inlined separately and
   each must stand alone), and their chrome differs where the content asks
   for it: the breakdown card runs one tight, even margin on all four
   sides rather than the chart card's generous frame.

   Why DOM text is painted glyph-by-glyph and not photographed: the
   rasterise path (clone + computed-style bake + svg foreignObject) asks
   the engine to re-layout the panel - and WebKit does not honour flex/grid
   gap in that context, which is precisely what the provenance band and
   meta grid are held together by. So the layout the panel has ALREADY
   computed is read off Range rects at capture time and replayed onto a
   canvas: every background, hairline and glyph goes on at its measured
   position, and no second layout is ever attempted.

   The capture re-flows the panel wide while it measures, under a
   `.copy-wide` class that pins the desktop type ladder (the media-query
   rungs in template.html key off the VIEWPORT, so widening the element
   alone would keep a phone its own rung - and a phone copy would come out
   in phone type scaled up). It is the same "the copy is a thing people
   send to other people" decision as the hero chart's widenForCopy, with
   one difference: no React re-render needs to happen here, so the widen,
   measure and restore are one synchronous block and the park never paints
   on screen - no stand-in clone is needed. */

(() => {
  "use strict";

  const BTN_CLASS = "poll-copy-btn";

  /* nothing interactive belongs in the PNG: the copy button itself, and
     the archive panel's .pd-meta-tail (back-to-chart / report-an-error),
     which documents what a reader can DO here, not what the poll says */
  const STRIP_SEL = "." + BTN_CLASS + ", .pd-meta-tail";

  const COPY_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
  const TICK_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>';

  const CAN_COPY = window.isSecureContext &&
    !!navigator.clipboard &&
    typeof navigator.clipboard.write === "function";
  const ACTION_LABEL = CAN_COPY ? "Copy breakdown as image" : "Save breakdown as PNG";

  /* the chart card comes out at 1200px and 2x (copy-chart.js) and the
     breakdown copy stays on that sheet so the two read as one output. The
     margins are tighter, though: a 1200px card with one 28px unit of air
     on all four sides, and the footer line inside rides the same rhythm,
     so no side of the sheet is emptier than another */
  /* The sheet is sized to the CONTENT, not to a fixed 1200. A breakdown is
     text, and its longest line is nowhere near a chart's width - on a 1200px
     card that left ~450px of bare paper down the right, so the card read as
     badly off-centre even though its four margins were equal. Measured across
     30 archive polls the natural width runs 598-708px, so neither bound below
     binds in practice: the width is the ink's, not a guess. */
  const CARD_MAX = 1200, CARD_MIN = 560, PAD = 28, SCALE = 2;
  const CONTENT_MAX = CARD_MAX - PAD * 2;
  const CONTENT_MIN = CARD_MIN - PAD * 2;
  const TEXT_H = 15;   /* the footer is one 15px line */

  /* Resolved through a probe rather than read as a raw token, because a
     canvas fill wants a concrete colour - the same trick copy-chart.js
     uses. */
  const inkVar = (name) => {
    const el = document.createElement("span");
    el.style.color = "var(" + name + ")";
    document.body.appendChild(el);
    const v = getComputedStyle(el).color;
    el.remove();
    return v;
  };

  const transparent = (c) => !c || c === "rgba(0, 0, 0, 0)" || c === "transparent";

  /* ---- the widen ----------------------------------------------------
     Park the panel out of view at the card's content width with the
     desktop ladder forced on, and return a restore closure. Synchronous
     both ways: the measure that follows is also synchronous, so no frame
     ever paints the parked state. */
  const widenPanel = (panel, width) => {
    const host = panel.parentElement;
    if (!host) return () => {};
    const panelStyle = panel.getAttribute("style");
    const hostStyle = host.getAttribute("style");
    const hostRect = host.getBoundingClientRect();
    const hostCS = getComputedStyle(host);
    /* the detail cell is pinned to its own height so the rows below it
       cannot climb while the panel is out of flow; the panel is the td's
       only child in both tables, so there are no siblings to freeze */
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
      if (panelStyle == null) panel.removeAttribute("style");
      else panel.setAttribute("style", panelStyle);
      if (hostStyle == null) host.removeAttribute("style");
      else host.setAttribute("style", hostStyle);
    };
  };

  /* ---- the poll row ---------------------------------------------------
     The band carries Fieldwork, Published, Sample … but never names the
     firm: the house labels the row ABOVE the panel, and the card does
     not take that row. So for the measure the capture re-titles the
     band's Fieldwork row - the window moves into the value beside the
     house and the pair reads "Poll: ‹house›, ‹fieldwork›" at the head
     of the list, in the band's own label/value voice, because it IS the
     band. The original node is kept and goes back, untouched. */
  const retitleFieldworkRow = (panel, house) => {
    const ks = panel.querySelectorAll(".pd-meta-k");
    for (const k of ks) {
      if ((k.textContent || "").trim() !== "Fieldwork") continue;
      const item = k.parentElement;
      if (!item || !item.classList.contains("pd-meta-i")) return () => {};
      const parent = item.parentElement;
      if (!parent) return () => {};
      const v = item.querySelector(".pd-meta-v");
      const fieldwork = ((v && v.textContent) || "").replace(/\s+/g, " ").trim();
      if (!fieldwork) return () => {};
      const clone = item.cloneNode(true);
      clone.querySelector(".pd-meta-k").textContent = "Poll";
      clone.querySelector(".pd-meta-v").textContent =
        (house ? house + ", " : "") + fieldwork;
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

  /* ---- the measure --------------------------------------------------
     Read the parked panel into a plain model: element backgrounds and
     hairlines first, then every text node as per-glyph runs. Executed
     entirely inside the widen window; painting happens from the model
     after the panel has been restored. Glyph x-positions are taken, not
     recomputed, so tracking, word-spacing and inline margins all survive
     to the card. */
  const readModel = (panel) => {
    const root = panel.getBoundingClientRect();
    const els = [];
    const texts = [];

    /* ---- element boxes: backgrounds, striped swatches, hairline rules */
    const Sides = [
      ["Top",    (r, t) => [r.x,        r.y + t / 2,     r.x + r.w,    r.y + t / 2]],
      ["Bottom", (r, t) => [r.x,        r.y + r.h - t/2, r.x + r.w,    r.y + r.h - t / 2]],
      ["Left",   (r, t) => [r.x + t/2,  r.y,             r.x + t / 2,  r.y + r.h]],
      ["Right",  (r, t) => [r.x+r.w-t/2,r.y,             r.x+r.w-t/2,  r.y + r.h]],
    ];
    const walk = (el) => {
      if (el.matches && el.matches(STRIP_SEL)) return;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && cs.display !== "none" && cs.visibility !== "hidden") {
        const rec = { x: r.left - root.left, y: r.top - root.top, w: r.width, h: r.height };
        const bg = cs.backgroundColor;
        const bgImg = cs.backgroundImage || "";
        if (!transparent(bg) || bgImg.indexOf("gradient") !== -1) {
          rec.bg = transparent(bg) ? null : bg;
          const br = (cs.borderRadius || "").split(" ").map(parseFloat).filter((v) => !isNaN(v));
          rec.radius = br.length ? Math.min.apply(null, br) : 0;
          if (bgImg.indexOf("repeating-linear-gradient") === 0) {
            /* the one decorated element in the panel: the residual seat
               swatch (.skey-dot.resid), two repeating colours. Reproduce
               its own stops rather than saying nothing at all. */
            const m = bgImg.match(/repeating-linear-gradient\((.+)\)$/);
            if (m) {
              const parts = m[1].split(",").map((s) => s.trim());
              const token = (s) => {
                const vm = s.match(/var\((--[a-zA-Z-]+)\)/);
                const nums = s.match(/-?\d+(\.\d+)?px/g) || [];
                return { col: vm ? inkVar(vm[1]) : s.split(/\s+/)[0], nums: nums.map(parseFloat) };
              };
              const a = parts[1] && token(parts[1]);
              const b = parts[2] && token(parts[2]);
              if (a && b && b.nums.length >= 2)
                rec.stripes = { c1: a.col, c2: b.col, w1: b.nums[1] - b.nums[0], w2: b.nums[0] };
            }
          }
          els.push(rec);
        }
        /* hairline rules between the sections - a border drawn at the
           element's own edge, dashed lightly where the author dashed it */
        for (const [side, line] of Sides) {
          const w = parseFloat(cs["border" + side + "Width"]);
          const style = cs["border" + side + "Style"];
          if (!w || w <= 0 || style === "none" || style === "hidden") continue;
          els.push({ border: line(rec, w), w,
                     color: cs["border" + side + "Color"], style });
        }
      }
      for (let i = 0; i < el.children.length; i++) walk(el.children[i]);
    };
    walk(panel);

    /* ---- text: one run per text node, glyph positions from Range rects */
    const walker = document.createTreeWalker(panel, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue || !/\S/.test(node.nodeValue)) return NodeFilter.FILTER_REJECT;
        const p = node.parentElement;
        if (!p) return NodeFilter.FILTER_REJECT;
        if (p.closest(STRIP_SEL)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    const csCache = new Map();
    const styleOf = (el) => {
      if (!csCache.has(el)) csCache.set(el, getComputedStyle(el));
      return csCache.get(el);
    };
    const range = document.createRange();
    let node;
    while ((node = walker.nextNode())) {
      const el = node.parentElement;
      const cs = styleOf(el);
      /* the font is recorded in parts and re-assembled at paint scale so a
         capture taken at a narrower live width still sizes correctly */
      const fontStyle = cs.fontStyle !== "normal" ? cs.fontStyle + " " : "";
      const font = {
        style: fontStyle, weight: cs.fontWeight,
        size: parseFloat(cs.fontSize), family: cs.fontFamily,
      };
      /* An underline in this panel is an AFFORDANCE, not typography: the only
         ones are the glossary term (.hi-term, "preference flows") and the
         report control, and both say "this can be clicked". Nothing in a PNG
         can be. The word travels; its promise of a click does not. Anything
         underlined for meaning rather than for interaction is drawn as a
         border instead (.pd-est's dashed date) and comes through the element
         path untouched. */
      const clickable = el.closest("a[href], button");
      const dec = !clickable && cs.textDecorationLine.indexOf("underline") !== -1 ? {
        color: cs.textDecorationColor === "currentcolor" ? cs.color : cs.textDecorationColor,
        style: cs.textDecorationStyle,
        thick: parseFloat(cs.textDecorationThickness) || 1,
        off: parseFloat(cs.textUnderlineOffset) || 0,
      } : null;
      const upper = cs.textTransform === "uppercase";
      const text = node.nodeValue;
      for (let i = 0; i < text.length; i++) {
        let ch = text[i], end = i + 1;
        if (/\s/.test(ch)) continue;
        const c0 = text.charCodeAt(i);
        if (c0 >= 0xd800 && c0 <= 0xdbff && i + 1 < text.length) { ch = text.slice(i, i + 2); end = i + 2; }
        range.setStart(node, i);
        range.setEnd(node, end);
        const boxes = range.getClientRects();
        if (!boxes.length) continue;
        const b = boxes[0];
        texts.push({
          ch: upper ? ch.toUpperCase() : ch,
          x: b.left - root.left, y: b.top - root.top, h: b.height,
          right: b.right - root.left,
          font, fill: cs.color, numeric: cs.fontVariantNumeric || "",
          dec,
        });
        i = end - 1;
      }
    }
    const pcs = getComputedStyle(panel);
    /* how far the ink actually reaches. Text only: the section rules and the
       band span the measure by construction, so they follow the panel rather
       than deciding it, and asking them would return the width we just set. */
    let inkRight = 0;
    for (const t of texts) if (t.right > inkRight) inkRight = t.right;
    return { els, texts, rootW: root.width, rootH: root.height, inkRight,
             padRight: parseFloat(pcs.paddingRight) || 0,
             bg: pcs.backgroundColor, fontFamily: pcs.fontFamily };
  };

  const roundRectPath = (c, x, y, w, h, r) => {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath();
    if (r <= 0) { c.rect(x, y, w, h); return; }
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + r, y, r);
    c.closePath();
  };

  const paintCard = (model) => new Promise((resolve, reject) => {
    try {
      const CARD_W = model.rootW + PAD * 2;
      const factor = 1;
      const panelH = model.rootH * factor;
      /* PAD everywhere: around the card, and again between the panel and
         the footer line inside it, so every side of the sheet carries
         the same margin */
      const H = Math.ceil(PAD + panelH + PAD + TEXT_H + PAD);
      const cv = document.createElement("canvas");
      cv.width = CARD_W * SCALE; cv.height = H * SCALE;
      const c = cv.getContext("2d");
      c.scale(SCALE, SCALE);
      c.fillStyle = model.bg;
      c.fillRect(0, 0, CARD_W, H);
      c.textBaseline = "alphabetic";

      const ox = PAD, oy = PAD;
      const X = (v) => ox + v * factor, Y = (v) => oy + v * factor;

      for (const el of model.els) {
        if (el.border) {
          c.strokeStyle = el.color;
          c.lineWidth = Math.max(0.5, el.w * factor);
          if (el.style === "dashed") c.setLineDash([4 * factor, 3 * factor]);
          else if (el.style === "dotted") c.setLineDash([c.lineWidth, 2 * factor]);
          c.beginPath();
          c.moveTo(X(el.border[0]), Y(el.border[1]));
          c.lineTo(X(el.border[2]), Y(el.border[3]));
          c.stroke();
          c.setLineDash([]);
          continue;
        }
        roundRectPath(c, X(el.x), Y(el.y), el.w * factor, el.h * factor,
                      (el.radius || 0) * factor);
        if (el.stripes) {
          /* resampled as vertical stripes ≈ the diagonal original, close
             enough at swatch size */
          c.save();
          c.clip();
          const s = el.stripes;
          const w1 = Math.max(1, s.w1 * factor), w2 = Math.max(1, s.w2 * factor);
          const total = w1 + w2;
          const n = Math.ceil((el.w * factor) / total) + 1;
          for (let i = 0; i < n; i++) {
            c.fillStyle = i % 2 ? s.c2 : s.c1;
            c.fillRect(ox + el.x * factor + i * total, Y(el.y),
                       (i % 2 ? w2 : w1) + 0.5, el.h * factor);
          }
          c.restore();
          continue;
        }
        if (el.bg) { c.fillStyle = el.bg; c.fill(); }
      }

      /* glyphs: a run's positions came off the live layout, tracking and
         word-spacing included - they are not re-computed, only replayed */
      const metricCache = new Map();
      for (const t of model.texts) {
        const f = t.font;
        const fontStr = f.style + f.weight + " " + (f.size * factor) + "px " + f.family;
        c.font = fontStr;
        if (t.numeric && "fontVariantNumeric" in c) c.fontVariantNumeric = t.numeric;
        let m = metricCache.get(fontStr);
        if (!m) {
          const mt = c.measureText("MgQqy");
          m = { asc: mt.fontBoundingBoxAscent || f.size * factor * 0.8,
                desc: mt.fontBoundingBoxDescent || f.size * factor * 0.25,
                sp: c.measureText(" ").width };
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
            c.strokeStyle = t.dec.color; c.lineWidth = th;
            c.setLineDash(t.dec.style === "dashed" ? [4, 3] : [th, th + 1]);
            c.beginPath(); c.moveTo(x, yy); c.lineTo(x + uw, yy);
            c.stroke();
            c.restore();
          } else {
            c.fillStyle = t.dec.color;
            c.fillRect(x, yy, uw, th);
          }
        }
      }

      /* the site only signs the footer, since the image travels and the
         page it came from does not. The signature parks 80px in from the
         sheet's edge (28 margin + 52) - deeper than the panel's padding
         line at 52, which still read as edge-aligned at the card's
         scale */
      c.font = "600 15px " + model.fontFamily;
      c.fillStyle = inkVar("--pd-ink-2");
      c.textAlign = "right";
      c.fillText("auspoltracker.com", CARD_W - PAD - 52, H - PAD - 3);
      c.textAlign = "left";

      cv.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob returned null"))), "image/png");
    } catch (e) { reject(e); }
  });

  /* ---- identification -------------------------------------------------
     On the card the panel stands alone, so the capture re-titles the
     band's Fieldwork row into "Poll: ‹house›, ‹fieldwork›" - the one
     fact the band was missing, at the head of the list. The FILE NAME
     keeps house and window together too, so two waves of one house never
     overwrite each other on disk. The house lives on the row ABOVE the
     expanded one; the window reads from the band. */
  const houseName = (panel) => {
    const tr = panel.closest("tr");
    const row = tr && tr.previousElementSibling;
    const nameEl = row && row.querySelector(".pollster-name");
    return nameEl
      ? (nameEl.textContent || "").replace(/↗/g, "").replace(/\s+/g, " ").trim()
      : "";
  };

  const metaValue = (panel, key) => {
    const ks = panel.querySelectorAll(".pd-meta-k");
    for (const k of ks) {
      if ((k.textContent || "").trim() !== key) continue;
      const item = k.parentElement;
      const v = item && item.querySelector(".pd-meta-v");
      if (v) return (v.textContent || "").replace(/\s+/g, " ").trim();
    }
    return "";
  };

  const idLine = (panel) => [houseName(panel), metaValue(panel, "Fieldwork")]
    .filter(Boolean).join(" · ");

  const fileName = (panel) => {
    const label = idLine(panel).toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 70);
    return "auspol-breakdown-" + (label || "poll") + ".png";
  };

  /* ---- composition + delivery --------------------------------------- */
  const compose = (panel) => {
    /* Two passes, both inside the same synchronous block so neither parked
       state ever paints. The first lays the panel out at the widest sheet and
       asks how far the ink reached; the second re-lays it to exactly that, so
       the section rules and the band - which span the measure - come in with
       the text instead of running on past it.
       re-titling happens inside each widen window, so the one swapped row is
       measured under the desktop ladder with everything else. */
    let restore = widenPanel(panel, CONTENT_MAX);
    let untitle = retitleFieldworkRow(panel, houseName(panel));
    try {
      panel.getBoundingClientRect(); /* reflow */
      const wide = readModel(panel);
      /* +SLACK, not +0: the ink's right edge is a fractional Range rect and
         line-breaking rounds it differently, so laying out to the exact
         measured width re-wraps the very line that set it. 1px still wrapped
         in testing, 2px held; 4px is the cheap side of that. */
      const SLACK = 4;
      const want = Math.min(CONTENT_MAX, Math.max(CONTENT_MIN,
        Math.ceil(wide.inkRight + wide.padRight) + SLACK));
      let model = wide;
      if (want < wide.rootW) {
        untitle(); restore();
        restore = widenPanel(panel, want);
        untitle = retitleFieldworkRow(panel, houseName(panel));
        panel.getBoundingClientRect(); /* reflow */
        model = readModel(panel);
      }
      return paintCard(model);
    } finally {
      untitle();
      restore();
    }
  };

  const flash = (btn) => {
    btn.classList.add("copied");
    btn.innerHTML = TICK_ICON;
    setTimeout(() => {
      btn.classList.remove("copied");
      btn.innerHTML = COPY_ICON;
    }, 1600);
  };

  const copyPoll = (panel) => {
    let png;
    try { png = Promise.resolve(compose(panel)); }
    catch (e) { console.warn("copy-poll: compose failed -", e && e.message || e); return; }
    const name = fileName(panel);
    const btn = panel.querySelector(":scope > ." + BTN_CLASS);

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
    document.querySelectorAll(".poll-detail").forEach((panel) => {
      if (panel.querySelector(":scope > ." + BTN_CLASS)) return;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = BTN_CLASS;
      btn.title = ACTION_LABEL;
      btn.setAttribute("aria-label", ACTION_LABEL);
      btn.innerHTML = COPY_ICON;
      btn.addEventListener("click", (e) => {
        /* a poll row toggles on click - the control must not close the
           panel it is copying */
        e.preventDefault();
        e.stopPropagation();
        copyPoll(panel);
      });
      panel.appendChild(btn);
    });
  };

  /* plain scripts run before the mount script renders any panel, and
     React mutates rows on every expand/collapse - watch and re-attach */
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
