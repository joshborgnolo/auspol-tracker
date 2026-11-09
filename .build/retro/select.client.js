/* =============================== the retro pages' drop-downs ===============================
   A <select> opens the operating system's own list, which in the retro look
   is a modern menu dropped onto a page from about 2000. On every retro page
   (the Electoral map's retro view, the retro All polls, Now and Past cycles
   pages) each select keeps its place in the page – its value, its options,
   its change events, its modern look outside the retro view – and in the
   retro look a combo box of the era stands in for it: a sunken white field
   with its arrow button, opening a list in the era's dress (a white box,
   black edged, the picked item in the selection navy), with the arrow keys,
   Home/End, type-ahead, Enter and Escape. A pick sets the select's value and
   fires its change event, so each page's own handlers run unchanged; a
   value the page sets in code shows in the box at once. chrome.css draws
   it (.rt-combo, .rt-list); html.mp-retro switches it on. */
(function () {
"use strict";
if (typeof document === "undefined" || window.RT_SELECT) return;
const doc = document, root = doc.documentElement;
const on = () => root.classList.contains("mp-retro");
const P = HTMLSelectElement.prototype;
const dValue = Object.getOwnPropertyDescriptor(P, "value"), dIndex = Object.getOwnPropertyDescriptor(P, "selectedIndex");
const boxOf = new WeakMap();
let list = null, openSel = null, hi = -1, typed = "", typedAt = 0;

const labelOf = (sel) => {
  if (sel.getAttribute("aria-label")) return sel.getAttribute("aria-label");
  const l = sel.closest("label") || (sel.id && doc.querySelector(`label[for="${CSS.escape(sel.id)}"]`));
  if (l) { const t = [...l.childNodes].filter((n) => n !== sel && !(n.nodeType === 1 && (n.matches("select, .rt-combo")))).map((n) => n.textContent).join(" ").replace(/\s+/g, " ").trim(); if (t) return t; }
  return "Choose";
};
const opts = (sel) => [...sel.options];
function sync(sel) {
  const box = boxOf.get(sel);
  if (!box) return;
  const o = sel.options[sel.selectedIndex];
  box.querySelector(".rt-combo-t").textContent = o ? o.textContent : "";
  box.disabled = sel.disabled;
  box.title = sel.title || "";
  if (openSel === sel) draw();
}
function enhance(sel) {
  if (boxOf.has(sel) || sel.multiple || sel.size > 1 || sel.closest("[data-rt-native]")) return;
  const box = doc.createElement("button");
  box.type = "button";
  box.className = "rt-combo";
  box.setAttribute("aria-haspopup", "listbox");
  box.setAttribute("aria-expanded", "false");
  box.setAttribute("aria-label", labelOf(sel));
  box.innerHTML = `<span class="rt-combo-t"></span><span class="rt-combo-a" aria-hidden="true"></span>`;
  sel.classList.add("rt-native");
  sel.after(box);
  boxOf.set(sel, box);
  box._sel = sel;
  // a value the page sets in code shows at once
  Object.defineProperty(sel, "value", { configurable: true, get() { return dValue.get.call(this); }, set(v) { dValue.set.call(this, v); sync(this); } });
  Object.defineProperty(sel, "selectedIndex", { configurable: true, get() { return dIndex.get.call(this); }, set(v) { dIndex.set.call(this, v); sync(this); } });
  sel.addEventListener("change", () => sync(sel));
  new MutationObserver(() => sync(sel)).observe(sel, { attributes: true, childList: true, subtree: true, characterData: true });
  sync(sel);
}
const enhanceAll = (r) => { for (const s of (r || doc).querySelectorAll("select")) enhance(s); };

/* ----- the list ----- */
function draw() {
  const sel = openSel, all = opts(sel);
  let html = "", lastGroup = null;
  all.forEach((o, i) => {
    const g = o.parentElement && o.parentElement.tagName === "OPTGROUP" ? o.parentElement : null;
    if (g && g !== lastGroup) html += `<div class="rt-list-g" role="presentation">${esc(g.label)}</div>`;
    lastGroup = g;
    html += `<div class="rt-list-o${g ? " rt-in" : ""}" role="option" id="rt-o-${i}" data-i="${i}" aria-selected="${i === sel.selectedIndex}"${o.disabled ? ' aria-disabled="true"' : ""}${i === hi ? ' data-hi="1"' : ""}>${esc(o.textContent)}</div>`;
  });
  list.innerHTML = html;
  list.setAttribute("aria-activedescendant", hi >= 0 ? "rt-o-" + hi : "");
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
function place() {
  const box = boxOf.get(openSel), r = box.getBoundingClientRect();
  list.style.minWidth = Math.round(r.width) + "px";
  list.style.left = "0px"; list.style.top = "0px";
  const w = list.offsetWidth, h = list.offsetHeight;
  const below = innerHeight - r.bottom - 4, above = r.top - 4;
  const up = h > below && above > below;
  list.style.maxHeight = Math.max(120, Math.min(360, up ? above : below)) + "px";
  const hh = list.offsetHeight;
  list.style.left = Math.max(2, Math.min(r.left, innerWidth - w - 2)) + "px";
  list.style.top = (up ? r.top - hh : r.bottom) + "px";
}
function scrollHi() { const el = list.querySelector('[data-hi="1"]'); if (el) el.scrollIntoView({ block: "nearest" }); }
function open(sel) {
  if (openSel === sel) { close(true); return; }
  close(false);
  if (sel.disabled) return;
  if (!list) {
    list = doc.createElement("div");
    list.className = "rt-list";
    list.setAttribute("role", "listbox");
    list.tabIndex = -1;
    doc.body.append(list);
    list.addEventListener("mousedown", (e) => e.preventDefault());
    list.addEventListener("click", (e) => { const o = e.target.closest(".rt-list-o"); if (o && o.getAttribute("aria-disabled") !== "true") pick(+o.dataset.i); });
    list.addEventListener("mousemove", (e) => { const o = e.target.closest(".rt-list-o"); if (o && +o.dataset.i !== hi) { hi = +o.dataset.i; draw(); } });
  }
  openSel = sel;
  hi = sel.selectedIndex;
  const box = boxOf.get(sel);
  box.setAttribute("aria-expanded", "true");
  box.setAttribute("aria-controls", "rt-list");
  list.id = "rt-list";
  list.setAttribute("aria-label", box.getAttribute("aria-label"));
  list.hidden = false;
  draw();
  place();
  scrollHi();
}
function close(focus) {
  if (!openSel) return;
  const box = boxOf.get(openSel);
  if (box) { box.setAttribute("aria-expanded", "false"); if (focus) box.focus({ preventScroll: true }); }
  openSel = null; hi = -1;
  if (list) list.hidden = true;
}
function pick(i) {
  const sel = openSel;
  close(true);
  if (!sel || i < 0 || i === sel.selectedIndex) return;
  dIndex.set.call(sel, i);
  sync(sel);
  sel.dispatchEvent(new Event("input", { bubbles: true }));
  sel.dispatchEvent(new Event("change", { bubbles: true }));
}
function step(sel, d, toEnd) {
  const all = opts(sel), ok = (i) => all[i] && !all[i].disabled;
  let i = openSel ? hi : sel.selectedIndex;
  if (toEnd) { i = d > 0 ? all.length : -1; }
  do i += d; while (i >= 0 && i < all.length && !ok(i));
  if (i < 0 || i >= all.length) return;
  if (openSel) { hi = i; draw(); scrollHi(); }
  else { dIndex.set.call(sel, i); sync(sel); sel.dispatchEvent(new Event("change", { bubbles: true })); }
}
function typeAhead(sel, ch) {
  const now = Date.now();
  typed = now - typedAt > 700 ? ch : typed + ch;
  typedAt = now;
  const all = opts(sel), from = (openSel ? hi : sel.selectedIndex) + (typed.length === 1 ? 1 : 0);
  for (let k = 0; k < all.length; k++) {
    const i = (from + k) % all.length;
    if (!all[i].disabled && all[i].textContent.trim().toLowerCase().startsWith(typed.toLowerCase())) {
      if (openSel) { hi = i; draw(); scrollHi(); }
      else { dIndex.set.call(sel, i); sync(sel); sel.dispatchEvent(new Event("change", { bubbles: true })); }
      return;
    }
  }
}

/* ----- wiring ----- */
doc.addEventListener("click", (e) => {
  const box = e.target.closest(".rt-combo");
  if (box && box._sel) { e.preventDefault(); open(box._sel); return; }
  if (openSel && !e.target.closest(".rt-list")) close(false);
}, true);
doc.addEventListener("keydown", (e) => {
  const box = e.target.closest && e.target.closest(".rt-combo");
  const sel = openSel || (box && box._sel);
  if (!sel) return;
  const k = e.key;
  if (openSel) {
    if (k === "Escape") { e.preventDefault(); e.stopPropagation(); close(true); return; }
    if (k === "Enter" || k === " ") { e.preventDefault(); e.stopPropagation(); pick(hi); return; }
    if (k === "Tab") { close(false); return; }
  } else if (k === "Enter" || k === " " || (k === "ArrowDown" && e.altKey) || k === "F4") { e.preventDefault(); e.stopPropagation(); open(sel); return; }
  if (k === "ArrowDown" || k === "ArrowUp") { e.preventDefault(); e.stopPropagation(); step(sel, k === "ArrowDown" ? 1 : -1); return; }
  if (k === "Home" || k === "End") { e.preventDefault(); e.stopPropagation(); step(sel, k === "End" ? 1 : -1, true); return; }
  if (k.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey && k !== " ") { e.preventDefault(); e.stopPropagation(); typeAhead(sel, k); }
}, true);
addEventListener("resize", () => close(false));
addEventListener("scroll", (e) => { if (openSel && !(e.target && e.target.closest && e.target.closest(".rt-list"))) close(false); }, true);
// selects a page draws later (a list's filters, a full-screen dock) get their box as they arrive
new MutationObserver((ms) => {
  if (!on()) return;
  for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1) { if (n.tagName === "SELECT") enhance(n); else if (n.querySelector) enhanceAll(n); }
  if (openSel && !openSel.isConnected) close(false);
}).observe(doc.documentElement, { childList: true, subtree: true });
// the map switches the look in place: the boxes arrive with it
new MutationObserver(() => { if (on()) enhanceAll(); else close(false); }).observe(root, { attributes: true, attributeFilter: ["class"] });
const start = () => { if (on()) enhanceAll(); };
if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", start); else start();
window.RT_SELECT = { enhance, enhanceAll, close };
})();
