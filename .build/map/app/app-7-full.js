/* =============================== full screen ===============================
   The map's full-screen view: the stage fills the screen edge to edge and the
   page's own controls float over it on paper plates. On a wide screen the
   panel at the left holds the view switch, the key and the story; the lenses,
   search and the way out run along the top; a dock along the foot steps
   through the elections, or plays them one after another. On a phone the
   panel is a sheet from the foot (the dock at its head), pulled up for the
   story. Nothing is rebuilt: the stage, key, story, lenses, search and view
   switch are the page's own elements, parked in the plates while the view
   lasts (a placeholder of the same size holds each one's spot in the page)
   and put back on the way out, so every handler, observer and hold keeps
   working. The browser's own full screen is asked for too where it exists
   (an iPhone has none: there the plates fill the window). The framing reads
   the plates: FS.ins, the room they take at each edge, goes into the map's
   and the chamber's pads, so a fit centres in the clear ground between them.
   The way in opens the frame out from the map's spot on the page, the map
   held where it stood on screen and then flown to its new fit; the way out
   closes it back down onto that spot. A history entry of its own makes Back
   the way out; the hash carries fs=1, so a shared link opens it (without the
   browser's full screen, which only a press may ask for). */
const FS_ICON = {
  close: `<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.6 3.6l8.8 8.8M12.4 3.6l-8.8 8.8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,
  play: `<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M4.2 2.4v9.2c0 .5.5.8.9.5l7.1-4.6c.4-.2.4-.8 0-1L5.1 1.9c-.4-.3-.9 0-.9.5z" fill="currentColor"/></svg>`,
  pause: `<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><rect x="3.1" y="2.4" width="2.8" height="9.2" rx=".9" fill="currentColor"/><rect x="8.1" y="2.4" width="2.8" height="9.2" rx=".9" fill="currentColor"/></svg>`,
  prev: `<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M8.8 2.8 4.6 7l4.2 4.2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  next: `<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M5.2 2.8 9.4 7l-4.2 4.2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  side: `<svg width="17" height="17" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.45" aria-hidden="true"><rect x="2" y="3" width="14" height="12" rx="2.2"/><path d="M7 3v12"/><path d="M3.9 6.2h1.3M3.9 8.4h1.3M3.9 10.6h1.3" stroke-linecap="round"/></svg>`,
};
const FS_LANES = ["Federal", "Victoria", "New South Wales", "South Australia", "Queensland", "Western Australia"];
/* the phone rung caps the jurisdiction picker at 98px — a name that can't
   stand there goes to its short form ("South Australia" → "SA") */
const FS_LANE_ABBR = { Victoria: "Vic", "New South Wales": "NSW", "South Australia": "SA", Queensland: "Qld", "Western Australia": "WA" };
const FS_HOLD = 2300; // ms the play-through rests on each election once the map has turned to it
const FS_EASE = "cubic-bezier(.22,.8,.24,1)";
const fsNativeEl = () => document.fullscreenElement || document.webkitFullscreenElement || null;
const fsCanNative = () => {
  const de = document.documentElement;
  return !!(document.fullscreenEnabled || document.webkitFullscreenEnabled) && !!(de.requestFullscreen || de.webkitRequestFullscreen);
};
Object.assign(FS, { px: 8e6, el: null, parked: [], native: false, pushed: false, skipPop: false, leaving: false, bare: false, sheetUp: false, phone: false, play: null, auto: false, scrollY: 0, inert: [] });

function fsBuild() {
  if (FS.el) return;
  const el = document.createElement("div");
  el.className = "fs"; el.id = "fs"; el.hidden = true; el.tabIndex = -1;
  el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", "Electoral map, full screen");
  el.innerHTML = `<div class="fs-top">
      <div class="fs-lensbar fs-plate"></div>
      <div class="fs-sbox"></div>
      <div class="fs-tviews fs-plate"></div>
      <button type="button" class="fs-x fs-plate" aria-label="Leave full screen" title="Leave full screen (Esc)">${FS_ICON.close}</button>
    </div>
    <aside class="fs-side fs-plate" aria-label="The story">
      <div class="fs-grab" role="button" tabindex="0" aria-label="Show more of the story"><i></i></div>
      <div class="fs-head">
        <div class="fs-title"><h2>Electoral map</h2><button type="button" class="fs-hide" aria-label="Hide the panel" title="Hide the panel">${FS_ICON.side}</button></div>
        <p class="fs-meta"></p>
        <div class="fs-vslot"></div>
      </div>
      <div class="fs-lslot"></div>
      <div class="fs-scroll"></div>
    </aside>
    <button type="button" class="fs-show fs-plate" hidden aria-label="Show the panel" title="Show the panel">${FS_ICON.side}</button>
    <div class="fs-dock fs-plate">
      <button type="button" class="fs-play" aria-label="Play through the elections" title="Play through the elections (Space)">${FS_ICON.play}</button>
      <div class="fs-steps"><button type="button" class="fs-step" data-step="-1" aria-label="The election before" title="The election before (←)">${FS_ICON.prev}</button><button type="button" class="fs-step" data-step="1" aria-label="The election after" title="The election after (→)">${FS_ICON.next}</button></div>
      <label class="fs-lane"><select aria-label="Which elections">${FS_LANES.map((n, k) => `<option value="${k}">${n}</option>`).join("")}</select></label>
      <div class="fs-rail" role="group" aria-label="Elections"></div>
      <div class="fs-card" aria-hidden="true" hidden></div>
    </div>
    <div class="fs-toast" aria-hidden="true" hidden></div>`;
  document.body.appendChild(el);
  const veil = document.createElement("div");
  veil.className = "fs-veil"; veil.hidden = true;
  document.body.insertBefore(veil, el);
  const q = (s) => $(s, el);
  Object.assign(FS, { el, veil, top: q(".fs-top"), lensbar: q(".fs-lensbar"), sbox: q(".fs-sbox"), tviews: q(".fs-tviews"), side: q(".fs-side"), grab: q(".fs-grab"), head: q(".fs-head"), meta: q(".fs-meta"), vslot: q(".fs-vslot"), lslot: q(".fs-lslot"), scroll: q(".fs-scroll"), showBtn: q(".fs-show"), dock: q(".fs-dock"), playBtn: q(".fs-play"), lane: q(".fs-lane select"), rail: q(".fs-rail"), toast: q(".fs-toast"), card: q(".fs-card") });
  q(".fs-x").addEventListener("click", () => fsExit());
  q(".fs-hide").addEventListener("click", () => fsPanel(false));
  FS.showBtn.addEventListener("click", () => fsPanel(true));
  FS.playBtn.addEventListener("click", () => fsPlay());
  for (const b of $$(".fs-step", el)) b.addEventListener("click", () => { fsStop(); walkYear(+b.dataset.step); });
  FS.lane.addEventListener("change", () => { fsStop(); const lane = LANES[+FS.lane.value]; if (lane && lane !== yearLane(S.year)) setYear(laneMem.get(lane) ?? lane[lane.length - 1]); });
  FS.rail.addEventListener("click", (e) => { const b = e.target.closest("[data-y]"); if (b) { fsStop(); setYear(yearOf(b.dataset.y)); requestAnimationFrame(() => { const nb = $(`.fs-stop[data-y="${b.dataset.y}"]`, FS.rail); if (nb && nb.matches(":hover")) fsCard(nb); }); } });
  // a stop under the pointer starts loading its election, so the click finds it ready
  FS.rail.addEventListener("pointerover", (e) => {
    const b = e.target.closest("[data-y]"); if (!b) return;
    const y = yearOf(b.dataset.y);
    if (!Y[y]) setTimeout(() => loadYear(y).catch(() => {}), 120);
    if (e.pointerType === "mouse") fsCard(b);
  });
  FS.rail.addEventListener("pointerleave", () => fsCard(null));
  FS.rail.addEventListener("scroll", () => fsCard(null), { passive: true });
  // the panel's head shows the page's eyebrow line, whatever writes it
  new MutationObserver(() => { FS.meta.textContent = $("#mp-meta").textContent; }).observe($("#mp-meta"), { childList: true, characterData: true, subtree: true });
  // the plates' size is the map's clear ground: a change reframes a view the page framed
  new ResizeObserver(() => { if (FS.on && !FS.leaving) fsMeasure(false); }).observe(FS.dock);
  new ResizeObserver(() => { if (FS.on && !FS.leaving) fsMeasure(false); }).observe(FS.top);
  new ResizeObserver(() => { if (FS.on && !FS.leaving && FS.phone) fsMeasure(false); }).observe($("#legend"));
  fsSheetDrag();
}

/* ----- parking: the page's own elements in the plates, a stand-in in their place ----- */
function fsPark(el, into) {
  const r = el.getBoundingClientRect(), ph = document.createElement("div");
  ph.className = `${el.className} fs-ph`; ph.setAttribute("aria-hidden", "true");
  // the stage's stand-in takes its size from the page's own rules (the way out lands on it)
  if (el.id !== "stage") { ph.style.height = `${r.height}px`; if (el.matches(".mp-views, .mp-search")) ph.style.width = `${r.width}px`; }
  el.replaceWith(ph);
  into.appendChild(el);
  FS.parked.push([el, ph]);
  return ph;
}
// every piece home (the stage too unless keepStage), the last parked first
function fsUnpark(keepStage) {
  const keep = [];
  for (const [el, ph] of FS.parked.reverse()) { if (keepStage && el.id === "stage") keep.push([el, ph]); else ph.replaceWith(el); }
  FS.parked = keep;
}
// where each parked piece sits: the wide layout (a panel) or the phone's (a sheet)
function fsLayout() {
  const phone = isPhone(), views = $(".mp-views:not(.fs-ph)"), legend = $("#legend");
  FS.phone = phone; fsLaneNames();
  FS.el.classList.toggle("phone", phone);
  if (phone) {
    FS.tviews.appendChild(views);
    FS.scroll.prepend(legend);
    FS.grab.after(FS.dock);
  } else {
    FS.vslot.appendChild(views);
    FS.lslot.appendChild(legend);
    FS.el.appendChild(FS.dock);
    FS.sheetUp = false; FS.el.classList.remove("sheet-up");
  }
  FS.showBtn.hidden = phone || !FS.bare;
}

/* ----- the clear ground: the room the plates take at each edge, in stage px ----- */
function fsPeek() {
  // the sheet at rest: its handle, the dock, the key, and room for the story's first line
  const lg = $("#legend"), key = lg && !lg.hidden ? lg.offsetHeight : 0;
  return Math.round(Math.min(FS.grab.offsetHeight + FS.dock.offsetHeight + key + 54, FS.el.clientHeight * 0.48));
}
function fsMeasure(quiet) {
  if (!FS.on || !FS.el) return false;
  const el = FS.el, H = el.clientHeight, g = FS.phone ? 8 : 14;
  const t = FS.top.offsetTop + FS.top.offsetHeight;
  let ins;
  if (FS.phone) {
    const peek = fsPeek();
    el.style.setProperty("--fs-peek", `${peek}px`);
    ins = { t, r: 0, b: peek, l: 0 };
  } else ins = { t, r: g, b: H - FS.dock.offsetTop, l: g + (FS.bare ? 0 : FS.side.offsetWidth + g) };
  for (const k of ["t", "r", "b", "l"]) el.style.setProperty(`--fs-${k}`, `${ins[k]}px`);
  const same = ["t", "r", "b", "l"].every((k) => Math.abs(FS.ins[k] - ins[k]) < 0.5);
  FS.ins = ins;
  if (same || quiet) return !same;
  // the plates moved (the panel hid or came back, the sheet's key grew): a view the page
  // framed glides to its fit in the new ground; one the reader moved stays where it is
  const framed = S.view === "map" && M() && (atLastFit() || !!flight || T.k <= HOME.k * 1.001);
  if (M()) setExtent();
  if (framed) fitSelection(reduceMotion ? 0 : 420);
  schedule();
  return true;
}
// the clear ground's centre, in stage px
function fsMid(p = stagePads()) { return [p.l + (Wpx - p.l - p.r) / 2, p.t + (Hpx - p.t - p.b) / 2]; }

/* ----- in ----- */
function fsEnter(o = {}) {
  if (FS.on || FS.leaving || !M()) return;
  fsBuild();
  const stage = $("#stage"), r0 = stage.getBoundingClientRect(), T0 = T;
  const framed = S.view !== "map" || atLastFit() || !!flight || T.k <= HOME.k * 1.001;
  const c0 = [(r0.width / 2 - T.x) / T.k, (r0.height / 2 - T.y) / T.k]; // the world point the reader had in the middle
  // the browser's own full screen, asked in the press itself (it refuses one asked later)
  FS.native = false;
  if (o.native !== false && fsCanNative()) {
    const de = document.documentElement, req = de.requestFullscreen || de.webkitRequestFullscreen;
    try {
      const p = req.call(de, { navigationUI: "hide" });
      FS.native = true;
      if (p && p.catch) p.catch(() => { FS.native = false; });
    } catch (e) { FS.native = false; }
  }
  FS.scrollY = window.scrollY;
  hideTip(); $("#sugg").hidden = true;
  // the stage behind the plates, the rest into theirs
  const el = FS.el;
  FS.parked = [];
  FS.stagePh = fsPark(stage, el);
  el.prepend(stage);
  fsPark($("#lenses"), FS.lensbar);
  fsPark($(".mp-views"), FS.vslot);
  fsPark($("#legend"), FS.lslot);
  fsPark($("#story"), FS.scroll);
  FS.meta.textContent = $("#mp-meta").textContent;
  FS.inert = [...document.body.children].filter((c) => c !== el && c !== FS.veil && c.id !== "tip" && c.tagName !== "SCRIPT" && !c.inert);
  for (const c of FS.inert) c.inert = true;
  document.documentElement.classList.add("mp-fs", "mp-fs-lock");
  el.hidden = false; FS.veil.hidden = false;
  FS.on = true;
  fsLayout(); fsView();
  el.classList.toggle("bare", FS.bare && !FS.phone);
  fsMeasure(true);
  const anim = !reduceMotion && o.animate !== false && !FS.native && r0.width > 0 && r0.bottom > 0 && r0.top < innerHeight;
  // the camera: held where it stood on screen as the frame opens round it, then flown to its fit
  FS.move = () => {
    if (S.view !== "map") return;
    const s = d3.select(canvas);
    if (anim) s.interrupt().call(zoom.transform, d3.zoomIdentity.translate(T0.x + r0.left, T0.y + r0.top).scale(T0.k));
    if (framed) { fitSelection(anim ? 760 : 0); return; }
    const k = Math.max(T0.k, HOME.k), [mx, my] = fsMid(), t1 = d3.zoomIdentity.translate(mx - c0[0] * k, my - c0[1] * k).scale(k);
    if (anim) fly(t1, 760); else { glideCancel(); flight = null; s.interrupt().call(zoom.transform, t1); }
  };
  resize();
  FS.move = null;
  renderLegend(); renderTimeline(); lensOverflow(); fitSearchPlaceholder(); updateHint(); renderBack();
  paintMiniChamber();
  fsPlayUI();
  FS.place = fsPlace();
  fsPlate();
  if (anim) {
    const W = innerWidth, H = innerHeight;
    el.animate([{ clipPath: `inset(${r0.top}px ${W - r0.right}px ${H - r0.bottom}px ${r0.left}px round 4px)` }, { clipPath: "inset(0px 0px 0px 0px round 0px)" }], { duration: 640, easing: FS_EASE });
    FS.veil.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 380, easing: "ease-out" });
  }
  fsPlatesIn(anim ? 230 : 40);
  if (o.push !== false) { try { history.pushState({ mpFs: 1 }, "", location.href); FS.pushed = true; } catch (e) {} }
  writeURL();
  el.focus({ preventScroll: true });
  fsToast(anim ? 900 : 500);
}
// the plates come in a beat after the frame opens, each from its own edge
function fsPlatesIn(delay) {
  if (reduceMotion) return;
  const phone = FS.phone, list = [
    [FS.side, phone ? "translateY(40px)" : "translateX(-14px)"], [FS.showBtn, "translateX(-10px)"],
    [FS.top, "translateY(-10px)"], [FS.dock, phone ? "none" : "translateY(10px)"],
    [$("#zoomer"), "translateX(8px)"], [$(".mp-tl"), "none"],
  ];
  list.forEach(([e, from], k) => { if (e && !e.hidden) e.animate([{ opacity: 0, transform: from }, { opacity: 1, transform: "none" }], { duration: 460, delay: delay + k * 35, easing: FS_EASE, fill: "backwards" }); });
}

/* ----- out ----- */
async function fsExit(o = {}) {
  if (!FS.on || FS.leaving) return;
  FS.leaving = true;
  fsStop(); fsToastOff(); fsCard(null);
  hideTip(); $("#sugg").hidden = true;
  const el = FS.el, wasNative = FS.native || !!fsNativeEl();
  if (fsNativeEl() && !o.fromNative) {
    const ex = document.exitFullscreen || document.webkitExitFullscreen;
    try { await ex.call(document); } catch (e) {}
  }
  FS.native = false;
  // (the browser's own full screen hands the window back over a frame or two)
  if (wasNative) await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const anim0 = !reduceMotion && !wasNative && !o.fromNative;
  // the plates fade, then the page's own pieces go home ahead of the stage, so the page
  // stands whole behind the closing frame (and the stage's spot is measured as it will be)
  if (anim0) { el.classList.add("leaving"); await new Promise((r) => setTimeout(r, 150)); }
  fsUnpark(true);
  ebHeights.clear(); holdEyebrow();
  renderLegend(); lensOverflow(); fitSearchPlaceholder(); paintMiniChamber();
  document.documentElement.classList.remove("mp-fs-lock");
  try { window.scrollTo({ top: FS.scrollY, behavior: "instant" }); } catch (e) { window.scrollTo(0, FS.scrollY); }
  const r1 = FS.stagePh.getBoundingClientRect();
  const framed = S.view !== "map" || atLastFit() || !!flight || T.k <= HOME.k * 1.001;
  const anim = anim0 && r1.width > 0 && r1.bottom > 0 && r1.top < innerHeight;
  // where the page's stage will frame the map: the selection's fit, or the reader's own
  // middle and zoom (no further out than the page's whole-country fit)
  let Tin = null;
  if (S.view === "map" && M()) {
    const pp = stagePads(true);
    if (framed) Tin = fitFor(selectionBox(), r1.width, r1.height, pp);
    else {
      const [mx, my] = fsMid(), c = [(mx - T.x) / T.k, (my - T.y) / T.k];
      const k = Math.max(T.k, fitFor(homeBox(M()), r1.width, r1.height, pp).k);
      Tin = d3.zoomIdentity.translate(pp.l + (r1.width - pp.l - pp.r) / 2 - c[0] * k, pp.t + (r1.height - pp.t - pp.b) / 2 - c[1] * k).scale(k);
    }
  }
  if (anim) {
    // the map flies to the spot it will stand on in the page as the frame closes onto it
    if (Tin) fly(d3.zoomIdentity.translate(Tin.x + r1.left, Tin.y + r1.top).scale(Tin.k), 500);
    const W = innerWidth, H = innerHeight;
    const a = el.animate([{ clipPath: "inset(0px 0px 0px 0px round 0px)" }, { clipPath: `inset(${r1.top}px ${W - r1.right}px ${H - r1.bottom}px ${r1.left}px round 4px)` }], { duration: 520, easing: "cubic-bezier(.45,0,.2,1)", fill: "forwards" });
    const v = FS.veil.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 420, delay: 120, easing: "ease-in-out", fill: "forwards" });
    try { await a.finished; } catch (e) {}
    FS.exitAnims = [a, v];
  }
  // everything back in its place
  fsUnpark();
  for (const c of FS.inert) c.inert = false;
  FS.inert = [];
  FS.on = false;
  el.hidden = true; FS.veil.hidden = true;
  el.classList.remove("leaving", "sheet-up");
  FS.sheetUp = false;
  if (FS.exitAnims) { for (const a of FS.exitAnims) a.cancel(); FS.exitAnims = null; }
  document.documentElement.classList.remove("mp-fs");
  FS.ins = { t: 0, r: 0, b: 0, l: 0 };
  fsPlate();
  FS.move = () => {
    if (S.view !== "map") return;
    if (framed) fitSelection(0);
    else if (Tin) { glideCancel(); flight = null; d3.select(canvas).interrupt().call(zoom.transform, Tin); }
  };
  resize();
  FS.move = null;
  ebHeights.clear(); holdEyebrow();
  renderLegend(); renderTimeline(); lensOverflow(); fitSearchPlaceholder(); updateHint(); renderBack(); updateCanvasVis();
  paintMiniChamber();
  FS.leaving = false;
  if (FS.pushed && !o.fromHistory) { FS.pushed = false; FS.skipPop = true; try { history.back(); } catch (e) { FS.skipPop = false; } }
  FS.pushed = false;
  writeURL();
  const b = $("#zfs");
  if (b && !b.closest("[hidden]")) b.focus({ preventScroll: true });
}

/* ----- the panel, the sheet ----- */
function fsPanel(show) {
  if (!FS.on || FS.phone) return;
  FS.bare = !show;
  FS.el.classList.toggle("bare", FS.bare);
  FS.showBtn.hidden = show;
  fsMeasure(false);
  (show ? $(".fs-hide", FS.el) : FS.showBtn).focus({ preventScroll: true });
}
function fsSheet(up) {
  FS.sheetUp = !!up;
  FS.el.classList.toggle("sheet-up", FS.sheetUp);
  FS.grab.setAttribute("aria-label", FS.sheetUp ? "Show less of the story" : "Show more of the story");
  if (!FS.sheetUp) FS.scroll.scrollTop = 0;
}
// the sheet follows the finger up and down: from its handle, the dock and the key at
// rest, and from the story once it is up and read back to its top (pulled down)
function fsSheetDrag() {
  const side = FS.side;
  let g = null;
  side.addEventListener("touchstart", (e) => {
    g = null;
    if (!FS.phone || e.touches.length !== 1) return;
    const t = e.touches[0];
    g = { y0: t.clientY, x0: t.clientX, base: FS.sheetUp ? 0 : side.offsetHeight - fsPeek(), on: false, inStory: !!e.target.closest(".fs-scroll"), ly: t.clientY, lt: performance.now(), v: 0 };
  }, { passive: true });
  side.addEventListener("touchmove", (e) => {
    if (!g) return;
    const t = e.touches[0], dy = t.clientY - g.y0, dx = t.clientX - g.x0;
    if (!g.on) {
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) { g = null; return; }
      if (Math.abs(dy) < 7) return;
      if (g.inStory && FS.sheetUp && (FS.scroll.scrollTop > 0 || dy < 0)) { g = null; return; }
      g.on = true; side.style.transition = "none";
    }
    if (e.cancelable) e.preventDefault();
    const now = performance.now();
    g.v = (t.clientY - g.ly) / Math.max(1, now - g.lt); g.ly = t.clientY; g.lt = now;
    const max = side.offsetHeight - fsPeek(), y = g.base + dy;
    side.style.transform = `translateY(${y < 0 ? y / 4 : y > max ? max + (y - max) / 4 : y}px)`;
  }, { passive: false });
  const end = () => {
    const d = g; g = null;
    if (!d || !d.on) return;
    const max = side.offsetHeight - fsPeek(), y = d.base + (d.ly - d.y0);
    side.style.transition = ""; side.style.transform = "";
    fsSheet(d.v < -0.35 ? true : d.v > 0.35 ? false : y < max / 2);
  };
  side.addEventListener("touchend", end);
  side.addEventListener("touchcancel", end);
  FS.grab.addEventListener("click", () => fsSheet(!FS.sheetUp));
  FS.grab.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fsSheet(!FS.sheetUp); } });
}
// the view's own rules: the plates know whether the map, the chamber or the list is up
function fsView() {
  if (!FS.el) return;
  for (const v of ["map", "chamber", "list"]) FS.el.classList.toggle(`v-${v}`, S.view === v);
}

/* ----- the dock: the elections of the jurisdiction on show, as a rail ----- */
function fsStopName(y) {
  if (y === "now") return "The House today";
  if (isNowY(y)) return "The Assembly today";
  if (STATE_YEARS.has(y)) return `${stateAdj(y)} election, 20${String(y).slice(-2)}`;
  return `${y} federal election`;
}
// who held the chosen seat at each stop on its rail (its history's rows: [year, Labor 2PP, party, member, by-election])
function fsHolder(m, i, y) {
  const d = m.divs[i], hh = d.h || [];
  if (isNowY(y)) {
    if (m.year === y) return holdFam(d.hold);
    const nw = Y[y] && Y[y].divs ? Y[y].byName.get(d.n) : null;
    if (nw != null) return holdFam(Y[y].divs[nw].hold);
    const by = hh.filter((r) => r[4]).pop();
    return by ? FAM(by[2]) : null;
  }
  if (y === m.year) return holdFam(d.hold);
  const r = hh.find((x) => x[0] === y && !x[4]);
  return r ? FAM(r[2]) : null;
}
function fsRail() {
  if (!FS.el || !FS.on) return;
  const lane = yearLane(S.year), li = LANES.indexOf(lane), m = M(), sd = m ? selDiv() : null;
  if (FS.lane.value !== String(li)) FS.lane.value = String(li);
  fsLaneWidth();
  const was = $(".fs-stop.on", FS.rail), r0 = was ? was.getBoundingClientRect() : null, y0 = was ? was.dataset.y : null;
  const sen = senOn();
  // (two-figure years on a rail too narrow for four: a phone's, or a narrow window's)
  const short = FS.phone || FS.rail.clientWidth < lane.length * 56;
  FS.rail.classList.toggle("short", short);
  let h = "";
  for (const y of lane) {
    const on = y === S.year, lab = isNowY(y) ? "Now" : short ? `’${String(y).slice(-2)}` : STATE_YEARS.has(y) ? `20${String(y).slice(-2)}` : String(y);
    let mk = "";
    if (sd != null && m && !sen) {
      const f = fsHolder(m, sd, y);
      mk = `<i class="fs-mk seat"${f ? ` style="background:var(--m-${f})"` : ""}></i>`;
    } else {
      // the House's make-up then (or the Senate's, in its chamber), as the timeline draws it
      const s = fsMix(y);
      mk = `<i class="fs-mk">${s ? ["alp", "grn", "ind", "oth", "onp", "lnp"].filter((f) => s[f]).map((f) => `<b style="flex:${s[f]};background:var(--m-${f})"></b>`).join("") : ""}</i>`;
    }
    h += `<button type="button" class="fs-stop${on ? " on" : ""}" data-y="${y}" aria-pressed="${on}" title="${esc(fsStopName(y))}">${mk}<span class="fs-yr" data-t="${esc(lab)}">${esc(lab)}</span><u><s></s></u></button>`;
  }
  FS.rail.innerHTML = h;
  if (FS.card && !FS.card.hidden) { const b = $(`.fs-stop[data-y="${FS.card.dataset.y}"]`, FS.rail); fsCard(b && b.matches(":hover") ? b : null); }
  const k = lane.indexOf(S.year);
  for (const b of $$(".fs-step", FS.el)) b.disabled = +b.dataset.step < 0 ? k <= 0 : k >= lane.length - 1;
  const now = $(".fs-stop.on", FS.rail);
  if (!now) return;
  // the stop chosen comes into view on a rail that scrolls (a phone's), and its mark glides over from the last
  const rr = FS.rail.getBoundingClientRect(), nr = now.getBoundingClientRect();
  if (nr.left < rr.left + 8 || nr.right > rr.right - 8) FS.rail.scrollTo({ left: FS.rail.scrollLeft + nr.left - rr.left - (rr.width - nr.width) / 2, behavior: reduceMotion ? "auto" : "smooth" });
  if (r0 && y0 !== String(S.year) && !reduceMotion) {
    const u = $("u", now), n1 = now.getBoundingClientRect();
    if (Math.abs(r0.left - n1.left) > 0.5) u.animate([{ transform: `translateX(${r0.left - n1.left}px)` }, { transform: "none" }], { duration: 480, easing: "cubic-bezier(.65,0,.35,1)" });
  }
  if (FS.play && FS.progMs) fsProg(FS.progMs, FS.progAt);
}

// the jurisdiction's select as wide as the name it shows (a select runs to its longest option)
let fsLaneCtx = null;
function fsLaneNames() {
  if (!FS.lane) return;
  const cs = getComputedStyle(FS.lane), cap = FS.phone ? parseFloat(cs.maxWidth) || 0 : 0;
  if (!fsLaneCtx) fsLaneCtx = document.createElement("canvas").getContext("2d");
  fsLaneCtx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  const pad = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
  for (const opt of FS.lane.options) {
    const full = FS_LANES[+opt.value];
    const want = (cap && fsLaneCtx.measureText(full).width + pad > cap) ? (FS_LANE_ABBR[full] || full) : full;
    if (opt.text !== want) opt.text = want;
  }
}
function fsLaneWidth() {
  const sel = FS.lane, cs = getComputedStyle(sel);
  if (!fsLaneCtx) fsLaneCtx = document.createElement("canvas").getContext("2d");
  fsLaneCtx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  const t = sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].text : "";
  sel.style.width = `${Math.ceil(fsLaneCtx.measureText(t).width + (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0) + 2)}px`;
}

/* ----- play: each election of the rail in turn, resting on each once the map has turned ----- */
function fsPlayUI() {
  if (!FS.playBtn) return;
  const on = !!FS.play;
  FS.playBtn.innerHTML = on ? FS_ICON.pause : FS_ICON.play;
  FS.playBtn.setAttribute("aria-label", on ? "Pause" : "Play through the elections");
  FS.playBtn.title = on ? "Pause (Space)" : "Play through the elections (Space)";
  FS.playBtn.classList.toggle("on", on);
  FS.el.classList.toggle("playing", on);
  FS.playBtn.disabled = yearLane(S.year).length < 2;
}
// the stop's rule fills while the play-through rests on it
function fsProg(ms, at = performance.now()) {
  FS.progMs = ms; FS.progAt = at;
  const fill = $(".fs-stop.on u s", FS.rail);
  if (!fill || reduceMotion) return;
  const a = fill.animate([{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], { duration: ms, easing: "linear", fill: "both" });
  a.currentTime = Math.min(ms, performance.now() - at);
}
async function fsPlay() {
  if (FS.play) { fsStop(); return; }
  const lane = yearLane(S.year);
  if (lane.length < 2) return;
  const tok = { t: 0, r: null };
  FS.play = tok;
  fsPlayUI(); fsToastOff();
  let i = lane.indexOf(S.year);
  if (i >= lane.length - 1) i = -1; // from the end, the run starts again from the first
  while (FS.play === tok && ++i < lane.length) {
    const y = lane[i];
    FS.progMs = 0;
    FS.auto = true;
    let p;
    try { p = setYear(y); } finally { FS.auto = false; }
    await p;
    if (FS.play !== tok || S.year !== y) return;
    if (i === lane.length - 1) break;
    // the next election loads while this one rests
    const nx = lane[i + 1];
    if (!Y[nx]) loadYear(nx, true).catch(() => {});
    const hold = (ymorph ? ymorph.dur : 300) + FS_HOLD;
    fsProg(hold);
    await new Promise((r) => { tok.r = r; tok.t = setTimeout(r, hold); });
  }
  if (FS.play === tok) fsStop();
}
function fsStop() {
  const p = FS.play;
  if (!p) return;
  FS.play = null; FS.progMs = 0;
  clearTimeout(p.t); if (p.r) p.r();
  const fill = $(".fs-stop.on u s", FS.rail);
  if (fill && fill.getAnimations) for (const a of fill.getAnimations()) a.cancel();
  fsPlayUI();
}

// the election stands on a wide screen's map, its title plate, for as long as the view lasts
function fsPlate() {
  if (stampEl.classList.contains("wait")) return;
  if (FS.on && !FS.phone) { showStamp(S.year, 1); stampDone(); }
  else { clearTimeout(stampOff); stampEl.classList.remove("on"); }
}

/* ----- a stop's card: the election, its date, the House it made (or the chosen seat's result) ----- */
// the seat's result at a stop: its member, party and Labor two-party share then
function fsSeatAt(m, i, y) {
  const d = m.divs[i], hh = d.h || [];
  if (isNowY(y)) {
    const nm = m.year === y ? m : Y[y] && Y[y].divs ? Y[y] : null, j = nm ? (nm === m ? i : nm.byName.get(d.n)) : null;
    if (j != null) { const h = nm.divs[j].hold; return { fam: holdFam(h), who: h.n, party: h.pn || partyName(h.ab), tpp: null }; }
    const by = hh.filter((r) => r[4]).pop();
    return by ? { fam: FAM(by[2]), who: by[3], party: partyName(by[2]), tpp: by[1] } : null;
  }
  const r = hh.find((x) => x[0] === y && !x[4]);
  return r ? { fam: FAM(r[2]), who: r[3], party: partyName(r[2]), tpp: r[1] } : y === m.year ? { fam: holdFam(d.hold), who: d.hold.n, party: d.hold.pn, tpp: null } : null;
}
function fsMix(y) {
  const sen = senOn(), st = sen ? (S.ssel.level !== "aus" ? S.ssel.st : "AUS") : S.sel.level === "state" ? S.sel.st : "AUS";
  return sen ? SENY[y] && senCounts(SENY[y], (d) => st === "AUS" || d.st === st) : SUM && SUM.seats[y] ? SUM.seats[y][st] : st !== "NSW" && META_FACTS.mix && META_FACTS.mix[y];
}
function fsCard(b) {
  const card = FS.card;
  if (!card) return;
  if (!b || FS.phone) { card.hidden = true; card.dataset.y = ""; return; }
  const y = yearOf(b.dataset.y), m = M(), sd = m ? selDiv() : null, sen = senOn();
  const f = META_FACTS.house && META_FACTS.house[y];
  let h = "";
  if (sd != null && m && !sen) {
    const r = fsSeatAt(m, sd, y);
    h = `<div class="fs-cd-t">${ds(m.divs[sd].n)} <span>${esc(fsStopName(y))}</span></div>`
      + (r ? `<div class="fs-cd-seat"><i style="background:var(--m-${r.fam})"></i><span><b>${ds(r.who)}</b> ${esc(r.party)}</span></div>${r.tpp != null ? `<div class="fs-cd-s">Labor two-party ${f1(r.tpp)}%</div>` : ""}`
        : `<div class="fs-cd-s">No seat of that name at this election</div>`);
  } else {
    const s = fsMix(y), date = f ? (isNowY(y) ? `As it stands, ${longDate(f[0])}` : longDate(f[0])) : "";
    h = `<div class="fs-cd-t">${esc(sen ? fsStopName(y).replace("The House today", "The Senate today") : fsStopName(y))}</div>${date && !sen ? `<div class="fs-cd-s">${esc(date)}</div>` : ""}`;
    if (s) {
      const fams = ["alp", "grn", "ind", "oth", "onp", "lnp"].filter((k) => s[k]), tot = sum(fams.map((k) => s[k])), maj = Math.floor(tot / 2) + 1;
      h += `<div class="fs-cd-bar">${fams.map((k) => `<b style="flex:${s[k]};background:var(--m-${k})"></b>`).join("")}<u style="left:${((maj / tot) * 100).toFixed(2)}%"></u></div>`
        + `<div class="fs-cd-n">${fams.slice().sort((a, c) => s[c] - s[a]).map((k) => `<span><i style="background:var(--m-${k})"></i>${famTag(k)} <b>${s[k]}</b></span>`).join("")}</div>`;
    }
  }
  const first = card.hidden;
  fsToastOff(); // (the keys' word gives way to the card it would cover)
  card.innerHTML = h; card.hidden = false; card.dataset.y = String(y);
  // over its stop, kept on the dock
  const dr = FS.dock.getBoundingClientRect(), br = b.getBoundingClientRect(), w = card.offsetWidth;
  card.style.left = `${clamp(br.left + br.width / 2 - dr.left - w / 2, 6, dr.width - w - 6)}px`;
  if (first && !reduceMotion) card.animate([{ opacity: 0, transform: "translateY(4px)" }, { opacity: 1, transform: "none" }], { duration: 160, easing: "ease-out" });
}

/* ----- the panel's story: a new place starts at its top; a change fades in ----- */
const fsPlace = () => (senOn() ? ["sen", S.ssel.level, S.ssel.st, S.ssel.i] : [S.view === "chamber" ? "ch" : "map", S.sel.level, S.sel.st, S.sel.div, S.sel.booth]).join("|");
function fsStory(changed) {
  const p = fsPlace();
  if (p !== FS.place) { FS.place = p; if (FS.scroll) FS.scroll.scrollTop = 0; }
  if (changed && !reduceMotion && !FS.leaving) $("#story").animate([{ opacity: 0, transform: "translateY(3px)" }, { opacity: 1, transform: "none" }], { duration: 260, easing: "cubic-bezier(.2,.7,.2,1)" });
}

/* ----- a first visit's word on the keys (wide screens), once a session ----- */
function fsToast(delay) {
  if (FS.phone || !FS.toast) return;
  try { if (sessionStorage.getItem("mp.fsToast")) return; sessionStorage.setItem("mp.fsToast", "1"); } catch (e) {}
  FS.toast.innerHTML = `<kbd>←</kbd> <kbd>→</kbd> step through the elections · <kbd>Space</kbd> plays them · <kbd>Esc</kbd> leaves`;
  clearTimeout(FS.toastT);
  FS.toastT = setTimeout(() => {
    if (!FS.on) return;
    FS.toast.hidden = false;
    if (!reduceMotion) FS.toast.animate([{ opacity: 0, transform: "translate(-50%, 6px)" }, { opacity: 1, transform: "translate(-50%, 0)" }], { duration: 380, easing: FS_EASE });
    FS.toastT = setTimeout(fsToastOff, 5200);
  }, delay);
}
function fsToastOff() {
  clearTimeout(FS.toastT);
  const t = FS.toast;
  if (!t || t.hidden) return;
  if (reduceMotion) { t.hidden = true; return; }
  t.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, easing: "ease-in" }).finished.then(() => { t.hidden = true; }, () => { t.hidden = true; });
}

/* ----- the ways in and out ----- */
$("#zfs").addEventListener("click", () => fsEnter());
$("#fsgo").addEventListener("click", () => fsEnter());
document.addEventListener("keydown", (e) => {
  const typing = e.target.closest && e.target.closest("input,select,textarea");
  if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
  if ((e.key === "f" || e.key === "F") && !e.repeat) { e.preventDefault(); if (FS.on) fsExit(); else fsEnter(); return; }
  if (!FS.on) return;
  fsToastOff();
  // Esc walks back up from a seat or state (the page's own handler); from the whole map it leaves
  if (e.key === "Escape" && (senOn() ? S.ssel.level === "aus" : S.sel.level === "aus")) { e.preventDefault(); fsExit(); return; }
  if (e.key === " " && !e.target.closest("button, a, [role=tab], [role=button]")) { e.preventDefault(); fsPlay(); }
}, true);
for (const ev of ["pointerdown", "wheel"]) addEventListener(ev, () => { if (FS.on) fsToastOff(); }, { passive: true, capture: true });
const fsNativeChange = () => { if (FS.on && !FS.leaving && FS.native && !fsNativeEl()) fsExit({ fromNative: true }); };
document.addEventListener("fullscreenchange", fsNativeChange);
document.addEventListener("webkitfullscreenchange", fsNativeChange);
// Back leaves the view (its own history entry); Forward comes back into it (without the browser's own full screen)
addEventListener("popstate", (e) => {
  if (FS.skipPop) { FS.skipPop = false; writeURL(); return; }
  const want = !!(e.state && e.state.mpFs);
  if (FS.on && !want) { FS.pushed = false; fsExit({ fromHistory: true }); }
  else if (!FS.on && want && M()) { fsEnter({ native: false, push: false }); FS.pushed = true; }
});
// a phone turned (or a window dragged) across the wide layout's edge re-seats the plates
PHONE.addEventListener("change", () => { if (!FS.on) return; fsLayout(); renderLegend(); fsMeasure(true); resize(); fsRail(); fsPlate(); });
