/* =============================== the retro view ===============================
   The page itself as a website from about 2000 (retro.css draws it): a navy
   banner with the flag, the title and Parliament House, the site's pages as
   links along its top, tab buttons for the views, and the old system face
   for every control — bevelled grey buttons, sunken white fields, navy
   caption bars over the panels. No pretend browser or desktop around it. The
   page's own elements are restyled, never rebuilt, so every control keeps
   working; this part adds only the banner and the tab row (hidden outside
   the view), with "Modern view" at the row's end for the way back.
   The choice persists in this browser (localStorage), and the hash carries
   retro=1 so a shared link opens in it; an inline script in the page's head
   sets the class before the first paint. The canvases take a flat palette
   (retroTheme, read by readTheme), and the look stays light whatever the
   device's theme, as the era's did. */
const RT_KEY = "auspol.map.retro";
// (a function, so code anywhere in the closure can ask before this part has run)
function rtIsOn() { return typeof document !== "undefined" && document.documentElement.classList.contains("mp-retro"); }
/* the canvases' flat palette: the page's paper for the sea and the ground
   (no atlas sea, no graticule: their inks are the paper's), black lines and
   lettering; the party colours are the map's own */
function retroTheme(T) {
  T.bg = [236, 233, 226]; T.surface = [255, 255, 255];
  T.sea = [229, 226, 218]; T.seaLine = T.sea; T.seaMark = T.sea; T.seaInk = T.sea;
  T.nodata = [218, 215, 207]; T.mid = [204, 200, 192]; T.hatch = [160, 156, 148];
  T.coast = [70, 70, 70]; T.state = [0, 0, 0];
  T.ink = [0, 0, 0]; T.ink2 = [32, 32, 32]; T.ink3 = [64, 64, 64]; T.faint = [128, 128, 128];
  T.line = [160, 160, 160]; T.line2 = [190, 190, 190];
  T.floor = [214, 226, 212];
  return T;
}
const RT = { built: false, drop: null, dropFor: null };
const RT_ICON = {
  fs: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>`,
  modern: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 8a5.5 5.5 0 1 0 1.6-3.9"/><path d="M2.4 2.2v2.6h2.6"/></svg>`,
  shade: `<svg width="9" height="9" viewBox="0 0 9 9" aria-hidden="true"><path d="M1 6.5h7" stroke="#000" stroke-width="1.8"/></svg>`,
  unshade: `<svg width="9" height="9" viewBox="0 0 9 9" aria-hidden="true"><path d="M1 1.5h7v6H1z M1 2.5h7" fill="none" stroke="#000" stroke-width="1.2"/></svg>`,
  dd: `<svg width="7" height="4" viewBox="0 0 7 4" aria-hidden="true"><path d="M0 0h7L3.5 4z" fill="currentColor"/></svg>`,
};
// a star of n points about (cx, cy), outer radius r, inner ratio k
const rtStar = (cx, cy, r, n = 7, k = 0.44) => {
  const pts = [];
  for (let i = 0; i < 2 * n; i++) { const a = -Math.PI / 2 + (i * Math.PI) / n, rr = i % 2 ? r * k : r; pts.push(`${(cx + rr * Math.cos(a)).toFixed(2)},${(cy + rr * Math.sin(a)).toFixed(2)}`); }
  return `<polygon points="${pts.join(" ")}" fill="#fff"/>`;
};
// the flag, drawn flat at 2:1: the Union Jack in the canton, the Commonwealth Star under it, the Southern Cross on the fly
function rtFlagSVG() {
  const uj = `<g><rect width="30" height="15" fill="#00247d"/><path d="M0 0l30 15M30 0L0 15" stroke="#fff" stroke-width="3"/><path d="M0 0l30 15M30 0L0 15" stroke="#cf142b" stroke-width="1"/><path d="M15 0v15M0 7.5h30" stroke="#fff" stroke-width="5"/><path d="M15 0v15M0 7.5h30" stroke="#cf142b" stroke-width="3"/></g>`;
  return `<svg class="rt-flag" viewBox="0 0 60 30" preserveAspectRatio="none" aria-hidden="true"><rect width="60" height="30" fill="#00247d"/>${uj}${rtStar(15, 22.5, 4.2)}${rtStar(45, 25.2, 2.3)}${rtStar(37.6, 14.4, 2.3)}${rtStar(45, 5, 2.3)}${rtStar(51.4, 12.5, 2.1)}${rtStar(48, 17.4, 1.2, 5, 0.42)}</svg>`;
}
// Parliament House, from the front: the long low house, its curved walls into the hill, the four-legged flagmast
function rtHouseSVG() {
  return `<svg class="rt-house" viewBox="0 0 210 58" aria-hidden="true"><g fill="none" stroke="#cfe0ff" stroke-width="1.1" stroke-linecap="round" opacity=".85">
    <path d="M6 56 Q40 44 70 41 L140 41 Q170 44 204 56" />
    <path d="M70 41 V36 H140 V41 M74 36 V41 M80 36 V41 M86 36 V41 M92 36 V41 M98 36 V41 M112 36 V41 M118 36 V41 M124 36 V41 M130 36 V41 M136 36 V41" />
    <path d="M100 36 V30 H110 V36" /><path d="M66 36 H144" />
    <path d="M90 41 L105 2 L120 41 M96 41 L105 2 L114 41" stroke-width=".9"/>
    <path d="M98.6 19 H111.4 M95.4 28 H114.6" stroke-width=".7"/></g>
    <path d="M105.6 2.4 h10 v6 h-10z" fill="#00247d" stroke="#cfe0ff" stroke-width=".6"/><path d="M105.6 2.4 h4 v3 h-4z" fill="#cf142b" opacity=".85"/></svg>`;
}
// the site's pages, read off the shell's own tabs and More menu (so they never drift from it)
function rtPages() {
  const tabs = $$(".sh-tabs-set a.sh-tab").map((a) => ({ label: (a.querySelector(".sh-tab-long") || a).textContent.replace(/\s+/g, " ").trim(), href: a.getAttribute("href") }));
  const more = $$("#sh-menu a.sh-menu-item").filter((a) => !tabs.some((t) => t.href === a.getAttribute("href"))).map((a) => ({ label: (a.querySelector(".sh-menu-t") || a).textContent.trim(), href: a.getAttribute("href"), on: a.dataset.id === "map" }));
  return { tabs, more };
}

/* ----- building the banner and the tab row (once; retro.css hides them outside the view) ----- */
function rtBuild() {
  if (RT.built) return;
  const sec = $(".mp-sec"), eb = $(".mp-sec > .rd-eyebrow");
  if (!sec || !eb) return;
  RT.built = true;
  const { tabs: pages } = rtPages();
  const top = document.createElement("div");
  top.className = "rt-top rt-only";
  top.innerHTML = `<nav class="rt-nav" aria-label="Site"><a class="rt-site" href="/">auspol tracker</a><span class="rt-navgap"></span>${pages.map((p) => `<a href="${esc(p.href)}">${esc(p.label)}</a>`).join("")}<button type="button" class="rt-more" aria-haspopup="menu" aria-expanded="false">More pages ${RT_ICON.dd}</button></nav>
    <div class="rt-banner"><a class="rt-home" href="/" title="auspol tracker: the interactive tracker">${rtFlagSVG()}</a><div class="rt-bcol"><span class="rt-btitle" aria-hidden="true">Electoral map</span><span class="rt-bmeta" aria-hidden="true"></span></div>${rtHouseSVG()}</div>
    <div class="rt-tabs" role="tablist" aria-label="View"></div>`;
  eb.before(top);
  // the view tabs: proxies for the eyebrow's switch (it parks in full screen's plate), full screen, and the way back
  const row = top.querySelector(".rt-tabs");
  for (const b of $$(".mp-views [data-view]")) {
    const t = document.createElement("button");
    t.type = "button"; t.setAttribute("role", "tab"); t.dataset.rtView = b.dataset.view;
    t.innerHTML = `${b.querySelector("svg") ? b.querySelector("svg").outerHTML : ""}<span class="rt-tl">${esc(b.textContent.trim())}</span>`;
    row.append(t);
  }
  row.insertAdjacentHTML("beforeend", `<button type="button" data-rt-do="fs" title="Full screen (F)">${RT_ICON.fs}<span class="rt-tl">Full screen</span></button><button type="button" class="rt-modern" data-rt-do="modern" title="Back to the modern look">${RT_ICON.modern}<span class="rt-tl">Modern view</span></button>`);
  const drop = document.createElement("div");
  drop.className = "rt-drop"; drop.hidden = true; drop.setAttribute("role", "menu"); drop.setAttribute("aria-label", "More pages");
  document.body.append(drop);
  RT.drop = drop;
  // the meta line mirrors into the banner; the view switch's choice into the tabs
  const meta = $("#mp-meta");
  if (meta) new MutationObserver(() => rtSync()).observe(meta, { childList: true, characterData: true, subtree: true });
  const mv = $(".mp-views");
  if (mv) new MutationObserver(() => rtSync()).observe(mv, { attributes: true, subtree: true, attributeFilter: ["aria-selected"] });
  // the left panel's caption keeps its shade button through every story render
  const story = $("#story");
  if (story) new MutationObserver(() => rtShadeBtn()).observe(story, { childList: true });
}
// the panel caption's little button rolls the panel up to its caption, as the old panels did
function rtShadeBtn() {
  if (!rtIsOn()) return;
  const h = $("#story .st-head h2");
  if (!h || h.querySelector(".rt-shade")) return;
  const shut = $("#story").classList.contains("rt-shut");
  h.insertAdjacentHTML("beforeend", `<button type="button" class="rt-shade" data-rt-do="shade" aria-expanded="${!shut}" aria-label="${shut ? "Open" : "Roll up"} the panel" title="${shut ? "Open" : "Roll up"} the panel">${shut ? RT_ICON.unshade : RT_ICON.shade}</button>`);
}
function rtSync() {
  if (!RT.built) return;
  const meta = $("#mp-meta"), bm = $(".rt-bmeta");
  if (meta && bm && bm.textContent !== meta.textContent) bm.textContent = meta.textContent;
  for (const t of $$(".rt-tabs [data-rt-view]")) t.setAttribute("aria-selected", String(S.view === t.dataset.rtView));
  rtShadeBtn();
}

/* ----- the More pages menu ----- */
function rtOpenMore(anchor) {
  if (!RT.drop) return;
  if (RT.dropFor === anchor && !RT.drop.hidden) { rtCloseMenu(); return; }
  const { more } = rtPages(), d = RT.drop;
  d.innerHTML = more.map((p) => `<a role="menuitem" href="${esc(p.href)}" tabindex="-1"${p.on ? ' aria-current="page"' : ""}><span class="rt-ck">${p.on ? "✓" : ""}</span><span>${esc(p.label)}</span></a>`).join("");
  RT.dropFor = anchor; d.hidden = false;
  const r = anchor.getBoundingClientRect(), w = d.offsetWidth, h = d.offsetHeight;
  d.style.left = `${Math.max(2, Math.min(r.right - w, innerWidth - w - 2))}px`;
  d.style.top = `${Math.min(r.bottom + 2, innerHeight - h - 2)}px`;
  anchor.setAttribute("aria-expanded", "true");
  d.querySelector("a")?.focus({ preventScroll: true });
}
function rtCloseMenu() {
  if (!RT.drop || RT.drop.hidden) return;
  RT.drop.hidden = true;
  if (RT.dropFor) RT.dropFor.setAttribute("aria-expanded", "false");
  RT.dropFor = null;
}

function rtSet(on, o = {}) {
  if (on) rtBuild();
  document.documentElement.classList.toggle("mp-retro", on);
  const sw = $("#retrogo"); if (sw) sw.setAttribute("aria-pressed", String(on));
  if (o.persist !== false) { try { if (on) localStorage.setItem(RT_KEY, "1"); else localStorage.removeItem(RT_KEY); } catch (e) {} }
  if (!on) { rtCloseMenu(); const s = $("#story"); if (s) s.classList.remove("rt-shut"); }
  rtSync();
  if (o.boot) return;
  // the look's palette and type change every measure: the canvases, the strip, the eyebrow and the stage re-read it
  if (TH) themeChanged();
  ebHeights.clear(); holdEyebrow();
  renderLegend(); renderTimeline(); fitSearchPlaceholder(); lensOverflow(); resize(); writeURL(); schedule();
  const w = $(".mp-sec"); if (w && w.getBoundingClientRect().top < 0) w.scrollIntoView({ block: "start" });
  (on ? $(".rt-modern") : $("#retrogo"))?.focus({ preventScroll: true });
}

/* ----- wiring ----- */
$("#retrogo")?.addEventListener("click", () => rtSet(!rtIsOn()));
document.addEventListener("click", (e) => {
  if (!rtIsOn()) return;
  const more = e.target.closest(".rt-more");
  if (more) { rtOpenMore(more); return; }
  if (RT.drop && !RT.drop.hidden && !e.target.closest(".rt-drop")) rtCloseMenu();
  const v = e.target.closest("[data-rt-view]");
  if (v) { setView(v.dataset.rtView); return; }
  const d = e.target.closest("[data-rt-do]");
  if (!d) return;
  if (d.dataset.rtDo === "fs") fsEnter();
  else if (d.dataset.rtDo === "modern") rtSet(false);
  else if (d.dataset.rtDo === "shade") {
    const s = $("#story"), shut = !s.classList.contains("rt-shut");
    s.classList.toggle("rt-shut", shut);
    d.remove(); rtShadeBtn(); $("#story .rt-shade")?.focus({ preventScroll: true });
    if (!shut) { paintMiniChamber(); hydrateDists(); }
  }
});
document.addEventListener("keydown", (e) => {
  if (!rtIsOn() || !RT.drop || RT.drop.hidden) return;
  if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); const a = RT.dropFor; rtCloseMenu(); if (a) a.focus({ preventScroll: true }); return; }
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    const xs = $$("a", RT.drop), i = xs.indexOf(document.activeElement);
    if (xs.length) xs[(i + (e.key === "ArrowDown" ? 1 : -1) + xs.length) % xs.length].focus({ preventScroll: true });
  }
}, true);
addEventListener("scroll", () => { if (RT.drop && !RT.drop.hidden) rtCloseMenu(); }, { passive: true });
addEventListener("resize", () => { if (RT.drop && !RT.drop.hidden) rtCloseMenu(); });
// the boot: the head's inline script may already have set the class (the hash's retro=1, or the saved choice)
{
  let want = rtIsOn();
  try { want = want || /[#&]retro=1(&|$)/.test(location.hash) || localStorage.getItem(RT_KEY) === "1"; } catch (e) {}
  if (want) rtSet(true, { persist: false, boot: true });
}
