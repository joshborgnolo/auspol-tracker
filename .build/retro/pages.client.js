/* =============================== the retro Now and Past cycles pages ===============================
   The browser half of /retro/ and /cycles/retro/ (render.client.js draws;
   this runs the page): the navbar's menus (the retro map's and the retro
   All polls page's, item for item where the job is the same, Favorites
   shared with both), the view tabs, each panel's own controls and the page's
   toolbar, the link (the hash carries the view and every control off its
   default, so a Favorite or a pasted link opens the same view), the roll-up
   buttons, and the charts redrawn at the width their frames really have.

   A panel's other views were harvested from the modern page at build time
   (now.mjs, cycles.mjs), so a control here only picks one and draws it. */
(function () {
"use strict";
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const R = window.RT_R;
const D = JSON.parse($("#rp-data").textContent);
const esc = R.esc;
const FAV_KEY = "auspol.map.favs", RT_KEY = "auspol.map.retro", HERE = D.here;
const TOOL = D.tool || [];
const PANEL = {};
for (const p of D.panels) PANEL[p.id] = p;

/* ----------------------------------------------------------------- the state */
const defaults = () => {
  const st = { v: D.def, tool: {}, p: {} };
  for (const c of TOOL) st.tool[c.id] = c.def;
  for (const p of D.panels) { st.p[p.id] = {}; for (const c of p.ctl || []) st.p[p.id][c.id] = c.def; }
  return st;
};
const ctlOf = (p, id) => (p.ctl || []).find((c) => c.id === id) || TOOL.find((c) => c.id === id);
function toHash(st) {
  const d = defaults(), kv = [];
  if (st.v !== d.v) kv.push("v=" + st.v);
  for (const c of TOOL) if (st.tool[c.id] !== d.tool[c.id]) kv.push(c.id + "=" + encodeURIComponent(st.tool[c.id]));
  for (const p of D.panels) {
    const own = (p.ctl || []).map((c) => st.p[p.id][c.id]);
    if ((p.ctl || []).some((c) => st.p[p.id][c.id] !== d.p[p.id][c.id])) kv.push(p.id + "=" + own.map(encodeURIComponent).join("."));
  }
  return kv.join("&");
}
function fromHash(h) {
  const st = defaults();
  for (const kv of String(h || "").replace(/^#/, "").split("&")) {
    const i = kv.indexOf("="); if (i < 0) continue;
    const k = kv.slice(0, i), v = kv.slice(i + 1);
    let dv = v; try { dv = decodeURIComponent(v); } catch (e) {}
    if (k === "v" && D.views.some((x) => x.id === v)) st.v = v;
    else if (TOOL.some((c) => c.id === k)) { const c = TOOL.find((x) => x.id === k); if (c.opts.some((o) => o.v === dv)) st.tool[k] = dv; }
    else if (PANEL[k]) {
      const vals = v.split(".").map((x) => { try { return decodeURIComponent(x); } catch (e) { return x; } });
      (PANEL[k].ctl || []).forEach((c, j) => { if (vals[j] != null && c.opts.some((o) => o.v === vals[j])) st.p[k][c.id] = vals[j]; });
    }
  }
  return st;
}
let st = fromHash(location.hash);
// a panel's variant for the state: its keys' values in order, an alias followed to its view
function variantOf(p, s) {
  const key = (p.keys || (p.ctl || []).map((c) => c.id)).map((id) => (TOOL.some((c) => c.id === id) ? s.tool[id] : s.p[p.id][id])).join("|");
  let v = p.variants[key];
  for (let i = 0; typeof v === "string" && i < 4; i++) v = p.variants[v];
  return v || p.variants[p.def] || null;
}

/* ----------------------------------------------------------------- drawing */
const drawn = {};      // a panel's key as drawn, and its charts' specs
function panelKey(p, s) { return (p.keys || (p.ctl || []).map((c) => c.id)).map((id) => (TOOL.some((c) => c.id === id) ? s.tool[id] : s.p[p.id][id])).join("|"); }
function drawPanel(p, force) {
  const sec = document.getElementById(p.id);
  if (!sec) return;
  const key = panelKey(p, st), v = variantOf(p, st);
  if (!v) return;
  const body = sec.querySelector(".rp-body");
  const specs = {};
  R.resetIds();
  const html = R.blocks(v.blocks, { idp: p.id + "-", specs });
  // the page as built holds each panel's opening view; any other is drawn here
  const onScreen = drawn[p.id] ? drawn[p.id].key : p.def;
  if (force || onScreen !== key) {
    body.innerHTML = html;
    const meta = sec.querySelector(".rp-capm");
    if (meta && v.meta != null && meta.textContent !== v.meta) meta.textContent = v.meta;
  }
  drawn[p.id] = { key, specs };
  // the controls show the state
  for (const el of $$("[data-ctl]", sec)) {
    const c = ctlOf(p, el.dataset.ctl); if (!c) continue;
    const val = st.p[p.id][c.id];
    if (el.tagName === "SELECT") { el.value = val; el.disabled = !!(c.on && st.p[p.id].t !== c.on); }
    else if (el.type === "radio") el.checked = el.value === val;
    else el.setAttribute("aria-selected", String(el.dataset.v === val));
  }
  fitCharts(sec);
}
/* each chart drawn at its frame's own width: the page is built at the
   widest frame, and a narrower window (or a panel shown later) redraws */
function fitCharts(root) {
  for (const fig of $$("figure[data-chart]", root)) {
    if (!fig.offsetParent) continue;
    const sec = fig.closest(".rp-panel"), d = sec && drawn[sec.id];
    const spec = d && d.specs[fig.dataset.chart];
    const well = fig.querySelector(".rp-cwell");
    if (!spec || !well) continue;
    const w = Math.floor(well.clientWidth - 12);
    const svg = well.querySelector("svg");
    if (w > 0 && (!svg || Math.abs(+svg.getAttribute("width") - w) > 3)) well.innerHTML = R.chart(spec, { w, small: fig.dataset.small === "1", id: fig.dataset.chart });
  }
}
function render(o = {}) {
  document.documentElement.setAttribute("data-rp-view", st.v);
  for (const b of $$(".rt-tabs [data-rp-tab]")) b.setAttribute("aria-selected", String(b.dataset.rpTab === st.v));
  for (const c of TOOL) for (const el of $$(`.rp-tool [data-ctl="${c.id}"]`)) {
    if (el.tagName === "SELECT") el.value = st.tool[c.id];
    else if (el.type === "radio") el.checked = el.value === st.tool[c.id];
    else el.setAttribute("aria-selected", String(el.dataset.v === st.tool[c.id]));
  }
  const tool = $(".rp-tool");
  if (tool && D.toolViews) tool.hidden = !D.toolViews.includes(st.v);
  for (const p of D.panels) drawPanel(p, o.force);
  relTimes();
  if (o.url !== false) {
    const h = toHash(st);
    try { history.replaceState(null, "", h ? "#" + h : location.pathname + location.search); } catch (e) {}
  }
}

/* the next polls' "in 20 days": worked out again from the date it names, on
   the reader's clock (the page was built when the newest poll landed) */
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function sydneyToday() {
  try {
    const p = {}; for (const x of new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Sydney", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date())) p[x.type] = x.value;
    return Date.UTC(+p.year, +p.month - 1, +p.day);
  } catch (e) { const d = new Date(); return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()); }
}
function relTimes() {
  const today = sydneyToday(), by = +String(D.built).slice(0, 4), bm = +String(D.built).slice(5, 7);
  for (const el of $$(".rp-rel[data-rel]")) {
    // a date ("Sun 29 Nov"), or a window's first day ("1–27 Dec", "28 Nov–5 Dec")
    const m = /(\d{1,2})(?: (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec))?(?:\s*[–-]\s*\d{1,2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec))?/.exec(el.dataset.rel);
    if (!m || !(m[2] || m[3])) continue;
    const mo = MON.indexOf(m[2] || m[3]) + 1, y = mo < bm - 6 ? by + 1 : by;
    const days = Math.round((Date.UTC(y, mo - 1, +m[1]) - today) / 864e5);
    const orig = el.dataset.orig || (el.dataset.orig = el.textContent);
    const say = days > 1 ? "in " + days + " days" : days === 1 ? "tomorrow" : days === 0 ? "today" : "overdue";
    el.textContent = orig.replace(/\bin \d+ (?:days?|hours?|minutes?)\b|\btomorrow\b|\btoday\b/, say);
  }
}

/* ----------------------------------------------------------------- the navbar's menus */
const drop = $(".rt-drop");
let dropFor = null, dropKey = null, items = null;
function favs() { try { const v = JSON.parse(localStorage.getItem(FAV_KEY) || "[]"); return Array.isArray(v) ? v.filter((f) => f && typeof f.h === "string" && typeof f.t === "string") : []; } catch (e) { return []; } }
function favsSave(list) { try { localStorage.setItem(FAV_KEY, JSON.stringify(list.slice(0, 30))); return true; } catch (e) { return false; } }
// a favourite's page: the map's own entries carry none
const favPage = (f) => (typeof f.p === "string" ? f.p : "/map/");
function favLabel() {
  const view = D.views.find((x) => x.id === st.v), parts = [D.title, view ? view.label : ""];
  const d = defaults();
  for (const c of TOOL) if (st.tool[c.id] !== d.tool[c.id]) parts.push(c.opts.find((o) => o.v === st.tool[c.id]).l);
  for (const p of D.panels) for (const c of p.ctl || []) if (st.p[p.id][c.id] !== d.p[p.id][c.id]) parts.push(c.opts.find((o) => o.v === st.p[p.id][c.id]).l);
  return parts.filter(Boolean).join(" · ");
}
function menuItems(k) {
  switch (k) {
    case "edit": return [
      { label: "Copy link to this view", act: copyLink },
      { sep: true },
      { label: "Reset this view", disabled: toHash({ ...st, v: D.def }) === "", act: () => { const v = st.v; st = defaults(); st.v = v; render(); } },
    ];
    case "view": return [
      ...D.views.map((x) => ({ label: x.label, radio: st.v === x.id, act: () => setView(x.id) })),
      { sep: true },
      ...TOOL.flatMap((c) => [...c.opts.map((o) => ({ label: (c.menu || c.label) + ": " + o.l, radio: st.tool[c.id] === o.v, act: () => { st.tool[c.id] = o.v; render(); } })), { sep: true }]),
      { label: "Modern view", act: goModern },
    ];
    case "fav": {
      const list = favs(), here = toHash(st);
      return [
        { label: "Add this view to Favorites", act: favAdd },
        { sep: true },
        ...(list.length ? list.map((f, i) => ({ label: f.t, fav: i, current: favPage(f) === HERE && f.h === here })) : [{ label: "No favourites yet", disabled: true }]),
      ];
    }
    case "help": return [
      ...(D.notes ? [{ label: D.notes, act: () => { const n = document.getElementById("rp-notes"); if (n) n.scrollIntoView({ behavior: "smooth", block: "start" }); } }] : []),
      { label: "How the tracker works", href: "/info/" },
      { label: "Send feedback…", href: "/feedback/" },
    ];
    case "more": return D.pages.more.map((p) => ({ label: p.label, href: p.href }));
    case "pages": return [...D.pages.tabs.map((p) => ({ label: p.label, href: p.href, check: p.href === HERE })), { sep: true }, ...D.pages.more.map((p) => ({ label: p.label, href: p.href }))];
  }
  return [];
}
function renderMenu() {
  items = menuItems(dropKey);
  drop.innerHTML = items.map((it, i) => {
    if (it.sep) return "<hr>";
    const mark = it.radio ? "●" : it.check ? "✓" : "";
    const inner = `<span class="rt-ck">${mark}</span><span class="rt-it">${esc(it.label)}</span>${it.kb ? `<span class="rt-kb">${esc(it.kb)}</span>` : ""}`;
    const role = "radio" in it ? "menuitemradio" : "menuitem";
    const chk = role === "menuitemradio" ? ` aria-checked="${!!it.radio}"` : "";
    if (it.fav != null) return `<div class="rt-favrow"><button type="button" role="menuitem" data-fav="${it.fav}" tabindex="-1"${it.current ? ' aria-current="page"' : ""}>${inner}</button><button type="button" class="rt-favdel" data-favdel="${it.fav}" tabindex="-1" aria-label="Remove ${esc(it.label)} from Favorites" title="Remove from Favorites"><svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true"><path d="M1 1l6 6M7 1L1 7" stroke="currentColor" stroke-width="1.5"/></svg></button></div>`;
    return it.href ? `<a role="menuitem" href="${esc(it.href)}" tabindex="-1"${it.check ? ' aria-current="page"' : ""}>${inner}</a>`
      : `<button type="button" role="${role}"${chk} data-item="${i}" tabindex="-1"${it.disabled ? " disabled" : ""}>${inner}</button>`;
  }).join("");
}
function openMenu(k, anchor) {
  if (dropFor === anchor && !drop.hidden) { closeMenu(); return; }
  closeMenu();
  dropKey = k; dropFor = anchor;
  drop.setAttribute("aria-label", anchor.textContent.trim());
  renderMenu();
  drop.hidden = false;
  placeMenu();
  anchor.setAttribute("aria-expanded", "true");
  const f = drop.querySelector("button:not(:disabled), a");
  if (f) f.focus({ preventScroll: true });
}
function placeMenu() {
  if (!dropFor) return;
  const r = dropFor.getBoundingClientRect(), w = drop.offsetWidth, h = drop.offsetHeight;
  const right = dropKey === "more" || dropKey === "pages";
  drop.style.left = `${Math.max(2, Math.min(right ? r.right - w : r.left, innerWidth - w - 2))}px`;
  drop.style.top = `${Math.max(2, Math.min(r.bottom + 1, innerHeight - h - 2))}px`;
}
function closeMenu() {
  if (drop.hidden) return;
  drop.hidden = true;
  if (dropFor) dropFor.setAttribute("aria-expanded", "false");
  dropFor = null; dropKey = null;
}
function note(anchor, text) {
  if (!anchor) return;
  const n = document.createElement("div");
  n.className = "rt-note"; n.setAttribute("role", "status"); n.textContent = text;
  document.body.append(n);
  const r = anchor.getBoundingClientRect();
  n.style.left = `${Math.max(4, Math.min(r.left, innerWidth - n.offsetWidth - 4))}px`;
  n.style.top = `${r.bottom + 4}px`;
  setTimeout(() => n.remove(), 1800);
}
function copyLink() {
  const a = $('.rt-nav [data-rt-menu="edit"]');
  try { navigator.clipboard.writeText(location.href).then(() => note(a, "Link copied"), () => note(a, "Couldn’t copy the link")); } catch (e) { note(a, "Couldn’t copy the link"); }
}
function favAdd() {
  const a = $('.rt-nav [data-rt-menu="fav"]'), h = toHash(st), list = favs();
  if (list.some((f) => favPage(f) === HERE && f.h === h)) { note(a, "Already in Favorites"); return; }
  list.unshift({ t: favLabel(), h, p: HERE });
  note(a, favsSave(list) ? "Added to Favorites" : "This browser won’t keep Favorites");
}
function favGo(i) {
  const f = favs()[i]; if (!f) return;
  const p = favPage(f);
  if (p === HERE) { st = fromHash(f.h); render(); return; }
  // the map's own views open in its retro view, the look the reader is in
  location.href = p + (p === "/map/" ? "#" + (f.h ? f.h + "&" : "") + "retro=1" : f.h ? "#" + f.h : "");
}
function goModern() {
  // leaving the retro look: the map's saved choice goes too, as the map's own Modern view does
  try { localStorage.removeItem(RT_KEY); } catch (e) {}
  location.href = D.modern;
}
function setView(v) {
  if (!D.views.some((x) => x.id === v)) return;
  st.v = v;
  render();
  const main = $("#rp-main");
  if (main && main.getBoundingClientRect().top < 0) $(".rt-tabs").scrollIntoView({ block: "start" });
}

/* ----------------------------------------------------------------- wiring */
document.addEventListener("click", (e) => {
  const mb = e.target.closest("[data-rt-menu]");
  if (mb) { openMenu(mb.dataset.rtMenu, mb); return; }
  const del = e.target.closest("[data-favdel]");
  if (del) { const list = favs(); list.splice(+del.dataset.favdel, 1); favsSave(list); renderMenu(); const f = drop.querySelector("button:not(:disabled), a"); if (f) f.focus({ preventScroll: true }); return; }
  const fav = e.target.closest("[data-fav]");
  if (fav) { const i = +fav.dataset.fav; closeMenu(); favGo(i); return; }
  const it = e.target.closest("[data-item]");
  if (it && items) { const f = items[+it.dataset.item]; if (!f || it.disabled) return; closeMenu(); if (f.act) f.act(); return; }
  if (!drop.hidden && !e.target.closest(".rt-drop")) closeMenu();
  const tab = e.target.closest("[data-rp-tab]");
  if (tab) { setView(tab.dataset.rpTab); return; }
  const pt = e.target.closest(".rp-ptabs [data-ctl]");
  if (pt) {
    const sec = pt.closest(".rp-panel");
    if (sec && PANEL[sec.id]) { st.p[sec.id][pt.dataset.ctl] = pt.dataset.v; render(); }
    else { st.tool[pt.dataset.ctl] = pt.dataset.v; render(); }
    return;
  }
  const act = e.target.closest("[data-rp]");
  if (act) {
    if (act.dataset.rp === "modern") goModern();
    else if (act.dataset.rp === "shade") {
      const p = act.closest(".rp-panel"), shut = !p.classList.contains("rp-shut");
      p.classList.toggle("rp-shut", shut);
      act.setAttribute("aria-expanded", String(!shut));
      act.setAttribute("aria-label", (shut ? "Open" : "Roll up") + " the panel"); act.title = act.getAttribute("aria-label");
      if (!shut) fitCharts(p);
    }
  }
});
document.addEventListener("change", (e) => {
  const el = e.target.closest("[data-ctl]");
  if (!el || el.closest(".rp-ptabs")) return;
  const sec = el.closest(".rp-panel");
  if (sec && PANEL[sec.id]) st.p[sec.id][el.dataset.ctl] = el.value;
  else st.tool[el.dataset.ctl] = el.value;
  render();
});
document.addEventListener("mouseover", (e) => {
  if (drop.hidden || !dropFor) return;
  const mb = e.target.closest(".rt-nav [data-rt-menu]");
  if (mb && mb !== dropFor && dropFor.closest(".rt-nav")) openMenu(mb.dataset.rtMenu, mb);
});
document.addEventListener("keydown", (e) => {
  if (!drop.hidden) {
    if (e.key === "Escape") { e.preventDefault(); const a = dropFor; closeMenu(); if (a) a.focus({ preventScroll: true }); return; }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const xs = $$("[role^=menuitem]:not(:disabled)", drop), i = xs.indexOf(document.activeElement);
      if (xs.length) xs[(i + (e.key === "ArrowDown" ? 1 : -1) + xs.length) % xs.length].focus({ preventScroll: true });
      return;
    }
    if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && dropFor && dropFor.closest(".rt-nav")) {
      const ms = $$(".rt-nav [data-rt-menu]").filter((b) => b.offsetParent), i = ms.indexOf(dropFor);
      if (i < 0) return;
      e.preventDefault();
      const nb = ms[(i + (e.key === "ArrowRight" ? 1 : -1) + ms.length) % ms.length];
      openMenu(nb.dataset.rtMenu, nb);
      return;
    }
  }
  // the arrows walk a tab row, as the era's tab controls did
  const tab = document.activeElement && document.activeElement.closest && document.activeElement.closest("[role=tab]");
  if (tab && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
    const row = [...tab.parentElement.querySelectorAll("[role=tab]")], i = row.indexOf(tab);
    const nx = row[(i + (e.key === "ArrowRight" ? 1 : -1) + row.length) % row.length];
    e.preventDefault(); nx.focus(); nx.click();
  }
});
addEventListener("hashchange", () => { st = fromHash(location.hash); render({ url: false }); });
let rz = 0;
addEventListener("resize", () => { closeMenu(); clearTimeout(rz); rz = setTimeout(() => fitCharts(document), 120); });
addEventListener("scroll", () => closeMenu(), { passive: true });
render({ url: false });
})();
