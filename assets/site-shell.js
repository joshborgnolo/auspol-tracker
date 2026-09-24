/* site-shell.js – written by .build/newtracker/build.mjs from
   .build/site-shell.mjs on every build; edit it there. */
(function () {
  var KEY = "auspol.tweaks", root = document.documentElement;
  var mq = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  var read = function () { try { return JSON.parse(localStorage.getItem(KEY) || "null") || {}; } catch (e) { return {}; } };
  var isDark = function () { return root.classList.contains("sh-dark") || (!root.classList.contains("sh-light") && !!(mq && mq.matches)); };
  var cells = document.querySelectorAll(".sh-cell");
  var metas = document.querySelectorAll('meta[name="theme-color"]');
  var paint = function () {
    var d = isDark();
    for (var i = 0; i < cells.length; i++) cells[i].setAttribute("aria-pressed", String((cells[i].getAttribute("data-theme") === "dark") === d));
    // the browser's own bar follows an explicit choice too
    var t = root.classList.contains("sh-dark") ? "#1a1612" : root.classList.contains("sh-light") ? "#faf6f0" : null;
    for (var j = 0; j < metas.length; j++) {
      if (!metas[j].hasAttribute("data-sh-orig")) metas[j].setAttribute("data-sh-orig", metas[j].getAttribute("content"));
      metas[j].setAttribute("content", t || metas[j].getAttribute("data-sh-orig"));
    }
  };
  for (var i = 0; i < cells.length; i++) cells[i].addEventListener("click", function () {
    var theme = this.getAttribute("data-theme");
    root.classList.remove("sh-light", "sh-dark");
    root.classList.add("sh-" + theme);
    var t = read(); t.theme = theme;
    try { localStorage.setItem(KEY, JSON.stringify(t)); } catch (e) {}
    paint();
  });
  if (mq) (mq.addEventListener ? mq.addEventListener("change", paint) : mq.addListener(paint));
  paint();

  /* The lockup squares itself off only while the two words happen to MEASURE
     the same, and at 30px Source Sans 3 sets 'tracker' about 3px short of
     'auspol'. The shortfall is measured and closed, not guessed – the main
     page's Header braces its own copy of this same routine, so both lockups
     square off identically off whatever face actually rendered. The trailing
     letter-spacing unit comes back off BOTH measurements first: it widens
     the box by one unit more than it widens the ink. */
  var wn = document.querySelector(".wm-name"), wt = document.querySelector(".wm-track");
  if (wn && wt) {
    var ink = function (el) {
      var ls = parseFloat(getComputedStyle(el).letterSpacing);
      return el.getBoundingClientRect().width - (isNaN(ls) ? 0 : ls);
    };
    var align = function () {
      wn.style.letterSpacing = ""; wt.style.letterSpacing = "";
      var wide = ink(wn) >= ink(wt) ? wn : wt, narrow = wide === wn ? wt : wn;
      var gaps = narrow.textContent.length - 1;
      if (gaps < 1) return;
      var base = parseFloat(getComputedStyle(narrow).letterSpacing);
      narrow.style.letterSpacing = (((isNaN(base) ? 0 : base) + (ink(wide) - ink(narrow)) / gaps)).toFixed(3) + "px";
    };
    align();
    if (document.fonts) document.fonts.ready.then(align);
  }

  // the live figure and dial: what the main page leads with, off one file
  if (!window.fetch) return;
  var score = document.querySelector(".sh-score");
  fetch("/assets/auspol-now.json", { cache: "no-cache" }).then(function (r) { return r.ok ? r.json() : null; }).then(function (n) {
    if (!n) return;
    if (score && n.a != null && n.b != null) {
      score.querySelector(".sh-num-a").textContent = n.a.toFixed(1);
      score.querySelector(".sh-num-a").style.color = "var(--alp)";
      score.querySelector(".sh-num-b").textContent = n.b.toFixed(1);
      score.querySelector(".sh-num-b").style.color = n.rival === "onp" ? "var(--onp)" : "var(--lnp)";
      score.querySelector(".sh-abbr-b").textContent = n.rival === "onp" ? "ON" : "L/NP";
      score.title = "The latest two-party preferred, Labor v " + (n.rival === "onp" ? "One Nation" : "the Coalition") + " – go to Snapshot";
      score.hidden = false;
    }
    /* The <img> stand-in steps aside for an inline svg drawn from the spec,
       strokes as var()s so the sheet's own theme rules colour it – the
       masthead's dial, live, not a picture of it. The settle replays too:
       needle in from vertical, graduations growing to their shares (unless
       the reader prefers reduced motion). */
    var img = document.querySelector(".wm-dial-img"), d = n.dial;
    if (!img || !d || !document.createElementNS) return;
    var NS = "http://www.w3.org/2000/svg";
    var el = function (tag, attrs) {
      var e = document.createElementNS(NS, tag);
      for (var k in attrs) e.setAttribute(k, attrs[k]);
      return e;
    };
    var rivalColor = "var(--" + d.right + ")";
    var svg = el("svg", { "class": "wm-dial", viewBox: d.vp, width: 57, height: 39.7, "aria-hidden": "true" });
    svg.appendChild(el("path", { d: d.arcL, "class": "wm-arc", fill: "none", stroke: "var(--alp)" }));
    svg.appendChild(el("path", { d: d.arcR, "class": "wm-arc", fill: "none", stroke: rivalColor }));
    var RM = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var bars = [];
    for (var bi = 0; bi < d.bars.length; bi++) {
      var b = d.bars[bi];
      var line = el("line", { "class": "wm-bar", x1: b.x1, y1: b.y1, x2: b.x2, y2: b.y2,
        stroke: "var(--" + b.id + ")", "stroke-width": 3.4, "stroke-linecap": "butt",
        "stroke-dasharray": (RM ? b.h : d.settle) + " " + d.max });
      svg.appendChild(line);
      bars.push(line);
    }
    var needleRotate = el("g", { "class": "wm-needle-g", transform: "rotate(" + (RM ? d.nd : 0) + ")" });
    needleRotate.appendChild(el("line", { "class": "wm-needle", x1: 0, y1: 0, x2: 0, y2: -8.6,
      stroke: "var(--" + d.leader + ")", "stroke-width": 1.7, "stroke-linecap": "round" }));
    needleRotate.appendChild(el("circle", { "class": "wm-needle-tip", cx: 0, cy: -8.6, r: 1.9, fill: "var(--" + d.leader + ")" }));
    var needleWrap = el("g", { transform: "translate(" + d.cx + ", " + d.cy + ")" });
    needleWrap.appendChild(needleRotate);
    svg.appendChild(needleWrap);
    svg.appendChild(el("circle", { "class": "wm-pivot", cx: d.cx, cy: d.cy, r: 1.7 }));
    img.replaceWith(svg);
    if (!RM) {
      /* first paint must carry the settle state before the goal posts land,
         or there is nothing to animate between */
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          needleRotate.setAttribute("transform", "rotate(" + d.nd + ")");
          for (var i = 0; i < bars.length; i++)
            bars[i].setAttribute("stroke-dasharray", d.bars[i].h + " " + d.max);
        });
      });
    }
  }).catch(function () {});
})();
