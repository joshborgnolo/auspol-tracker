/* =============================== the retro pages' next polls ===============================
   The tab buttons sit at the right of every retro page's tab row, and the
   grey they leave at its left carries the next polls, as the modern navbar's
   "Next" countdown shows them: overdue first, then the dated counts, then the
   "any day now" houses, each pollster an underlined link to where it
   publishes, overdue in red, "(maybe)" in grey. As many whole entries as
   clear the first tab button show and the rest park (unseen, still
   measurable); on the phone's full-width tabs (chrome.css, 860px and below)
   the strip stands down.
   One list, two readers, never a projection of its own:
   - the Electoral map wears the site's shell, whose site-shell.js fills
     .sh-next every minute: the strip copies that list, so the two looks
     can never disagree;
   - the retro All polls, Now and Past cycles pages wear no shell: they
     inline the main page's np-project.js (page.mjs, allpolls.mjs), the one
     implementation the shell runs too, and feed it the same live
     /assets/auspol-now.json the shell reads, re-reading the roll each
     minute as the shell does.
   Inlined on those three pages; appended to map.js by assemble.mjs, where
   the retro view's tab row is built later (app-8-retro.js calls
   window.rtNextMount on it). */
(function () {
  "use strict";
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var ownText = function (el) {
    if (!el) return "";
    var t = "";
    for (var i = 0; i < el.childNodes.length; i++) if (el.childNodes[i].nodeType === 3) t += el.childNodes[i].textContent;
    return t.trim();
  };
  var NOTE = "Projected from each house’s recent publication intervals – the earliest each wave could land, not the likeliest. A dated slot that passes unrecorded counts up as overdue for two days, then the expectation moves on to the house’s next plausible date";
  var boxes = [], last = [];

  /* the room: beside the tabs, from the strip's left edge to the first tab
     button less a clearance; where not one entry fits there (the retro All
     polls page's seven tabs fill its row; Now and Past cycles below about
     1100px), the strip takes a line of its own over the tabs, the row's
     whole width. (Both settled in one pass, so the row's resize observer
     sees one size and doesn't loop.) */
  function fit(box) {
    var row = box.parentElement, items = box.querySelectorAll(".rt-nx-item"), i;
    for (i = 0; i < items.length; i++) items[i].classList.remove("rt-nx-park");
    box.classList.remove("rt-nx-none");
    row.classList.remove("rt-nx-own");
    box.hidden = !items.length;
    if (!items.length || getComputedStyle(box).display === "none") return;
    var tab = row.querySelector("button");
    if (!tab || box.getBoundingClientRect().height < 1) return;
    var gap = parseFloat(getComputedStyle(box).columnGap) || 0;
    var take = function (room) {
      var used = box.firstElementChild.offsetWidth, k = 0;
      for (; k < items.length && used + gap + items[k].offsetWidth <= room; k++) used += gap + items[k].offsetWidth;
      return k;
    };
    var k = take(tab.getBoundingClientRect().left - box.getBoundingClientRect().left - 24);
    if (k === 0) {
      row.classList.add("rt-nx-own");
      var br = box.getBoundingClientRect();
      k = take(row.getBoundingClientRect().right - br.left - 8);
      if (k === 0) row.classList.remove("rt-nx-own");
    }
    for (i = k; i < items.length; i++) items[i].classList.add("rt-nx-park");
    box.classList.toggle("rt-nx-none", k === 0);
  }
  function draw(box) {
    var old = box.querySelectorAll(".rt-nx-item");
    for (var i = 0; i < old.length; i++) old[i].remove();
    for (var j = 0; j < last.length; j++) {
      var it = last[j];
      if (!it.firm) continue;
      var el = document.createElement("span");
      el.className = "rt-nx-item";
      el.innerHTML = (it.site ? '<a class="rt-nx-firm" href="' + esc(it.site) + '" target="_blank" rel="noopener noreferrer" title="Where ' + esc(it.firm) + ' publishes">' + esc(it.firm) + "</a>" : '<span class="rt-nx-firm">' + esc(it.firm) + "</span>") +
        ' <span class="rt-nx-when' + (it.overdue ? " rt-nx-over" : "") + '">' + esc(it.when) + (it.maybe ? '<span class="rt-nx-maybe"> (maybe)</span>' : "") + "</span>";
      box.appendChild(el);
    }
    fit(box);
  }
  function show(items, note) {
    last = items || [];
    for (var i = 0; i < boxes.length; i++) { if (note) boxes[i].title = note; draw(boxes[i]); }
  }

  // a tab row takes the strip at its left (once)
  function mount(row) {
    if (!row || row.querySelector(".rt-next")) return;
    row.insertAdjacentHTML("afterbegin", '<div class="rt-next" hidden title="' + esc(NOTE) + '"><b class="rt-nx-lab">Next polls:</b></div>');
    var box = row.firstElementChild;
    boxes.push(box);
    // (a row shown later – the map's retro view switched on – resizes from nothing, and refits)
    if (window.ResizeObserver) new ResizeObserver(function () { fit(box); }).observe(row);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { fit(box); });
    draw(box);
  }
  window.rtNextMount = mount;

  // reader one: the shell's own countdown (the map)
  var sn = document.querySelector(".sh-next");
  if (sn) {
    var read = function () {
      var out = [], its = sn.hidden ? [] : sn.querySelectorAll(".sh-tn-item");
      for (var i = 0; i < its.length; i++) {
        var a = its[i].querySelector("a.sh-tn-link"), w = its[i].querySelector(".sh-tn-when");
        out.push({ firm: a ? ownText(a) : (its[i].querySelector(".sh-tn-firm") || its[i]).textContent.trim(), site: a ? a.getAttribute("href") : null, when: ownText(w), overdue: !!(w && w.classList.contains("sh-tn-overdue")), maybe: !!its[i].querySelector(".sh-tn-maybe") });
      }
      show(out, sn.title);
    };
    new MutationObserver(read).observe(sn, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ["hidden"] });
    read();
  } else if (window.AP && window.AP.nextPollItems && window.fetch) {
    // reader two: the main page's projection on the live data (the shell-less retro pages)
    fetch("/assets/auspol-now.json", { cache: "no-cache" }).then(function (r) { return r.ok ? r.json() : null; }).then(function (n) {
      if (!n || !n.pollCadence) return;
      var roll = function () {
        try { window.AP.D = { pollCadence: n.pollCadence }; show(window.AP.nextPollItems(window.AP.nextPolls())); } catch (e) {}
      };
      roll();
      setInterval(roll, 60000);
    }).catch(function () {});
  }
  var rows = document.querySelectorAll(".rt-tabs");
  for (var r = 0; r < rows.length; r++) mount(rows[r]);
})();
