/* =============================== the retro Info page's own half ===============================
   Runs before pages.client.js (which runs the navbar, the view tabs and the
   link). An entry's links (the modern page's term-to-term references, and
   each part's contents list) open the view their entry is in and bring the
   entry up, lit as the era lit a found item; "Back to top" goes back to the
   tab row. A pasted link naming an entry (#v=faq&t=interval) opens on it:
   the head script has already picked its view, so this only scrolls; pasted
   over the open page it arrives as a hashchange and is shown the same way. */
(function () {
"use strict";
const D = JSON.parse(document.getElementById("rp-data").textContent);
const VIEW = {};
for (const [id, v] of D.terms || []) VIEW[id] = v;
const first = /(?:^#|&)t=([\w-]+)/.exec(location.hash);
function show(id, smooth) {
  const v = VIEW[id];
  if (!v) return false;
  const tab = document.querySelector('.rt-tabs [data-rp-tab="' + v + '"]');
  if (tab && tab.getAttribute("aria-selected") !== "true") tab.click();
  const el = document.getElementById("term-" + id);
  if (!el) return false;
  for (const x of document.querySelectorAll(".ri-term.ri-lit")) x.classList.remove("ri-lit");
  el.classList.add("ri-lit");
  // a closed panel opens to show it
  const sec = el.closest(".rp-panel.rp-shut");
  if (sec) { const b = sec.querySelector('[data-rp="shade"]'); if (b) b.click(); }
  /* a section's lead brings its caption with it, since that caption is its
     name (as the modern page brings the section heading); a tall entry comes
     in at its top, a short one centred */
  const panel = el.closest(".ri-sec"), lead = !!panel && panel.querySelector(".ri-term") === el;
  if (lead) panel.scrollIntoView({ block: "start", behavior: smooth ? "smooth" : "auto" });
  else el.scrollIntoView({ block: el.offsetHeight > innerHeight * 0.6 ? "start" : "center", behavior: smooth ? "smooth" : "auto" });
  return true;
}
document.addEventListener("click", (e) => {
  const a = e.target.closest && e.target.closest("a[data-term]");
  if (a && !e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0) {
    if (show(a.dataset.term, true)) e.preventDefault();
    return;
  }
  const up = e.target.closest && e.target.closest('[data-ri="top"]');
  if (up) {
    const tabs = document.querySelector(".rt-tabs");
    if (tabs) tabs.scrollIntoView({ block: "start", behavior: "smooth" });
  }
}, true);
// a link naming an entry pasted over the open page: the view follows (pages.client.js), then the entry
addEventListener("hashchange", () => {
  const m = /(?:^#|&)t=([\w-]+)/.exec(location.hash);
  if (m) setTimeout(() => show(m[1], false), 0);
});
if (first) {
  const go = () => show(first[1], false);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", go); else setTimeout(go, 0);
}
})();
