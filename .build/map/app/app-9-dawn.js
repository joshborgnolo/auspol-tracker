/* =============================== the Dawn page ===============================
   /dawn/electoral-map/ (.build/dawn/template-emap.html) runs this same map under
   html.mp-dawn. The page brings its own election and basis menus and its own
   layout; here the canvas takes Dawn's colours, and each rebuild of the key is
   dealt out to the page's slots. Declarations only: boot calls these before this
   part has run. */
function dawnOn() { return typeof document !== "undefined" && document.documentElement.classList.contains("mp-dawn"); }
// Dawn's warm paper, indigo ink and party colours (template.html's :root), over readTheme's
function dawnTheme(T) {
  const dk = T.dark, h = (light, dark) => hex(dk ? dark : light);
  T.bg = h("#fbf6f1", "#14132a"); T.surface = h("#fffbf7", "#1b1a34");
  T.ink = h("#1d1b33", "#f3eee8"); T.ink2 = h("#4a4660", "#cbc6d6"); T.ink3 = h("#686477", "#a39fb3");
  T.faint = h("#c9bfb4", "#4a4764"); T.line = h("#e8e0d7", "#2a2843"); T.line2 = h("#efe8e0", "#232139");
  const P = dk
    ? { alp: "#e65548", lnp: "#5b88e4", grn: "#23906a", onp: "#d6762a", ind: "#2bb3a6", csa: "#a07ccb", oth: "#8f8aa3", nxt: "#d6762a", dem: "#2bb3a6" }
    : { alp: "#cf3a2f", lnp: "#2a5cb4", grn: "#1d7a52", onp: "#dc6a16", ind: "#14a3a0", csa: "#7e52a8", oth: "#8d8799", nxt: "#dc6a16", dem: "#10998d" };
  T.party = {}; for (const k in P) T.party[k] = hex(P[k]);
  T.mid = h("#e6dfe4", "#3a3753"); T.nodata = h("#efe9e2", "#211f39"); T.hatch = h("#c9bfb4", "#4a4764");
  T.seam = dk ? T.bg : [255, 255, 255]; T.seamA = dk ? 0.7 : 0.9;
  T.coast = h("#8b8498", "#8d89a8"); T.state = h("#2b2844", "#e4e0ee");
  T.floor = h("#f4ece4", "#1d1c36");
  // the sea is the morning sky's own pale blue-violet; at night, the sky's navy
  T.sea = h("#ecebf6", "#0d1230"); T.seaLine = h("#d6d6ec", "#232a54");
  T.seaMark = h("#8d8cb4", "#6e76a8"); T.seaInk = h("#5f628f", "#9aa3d4");
}
/* the key's rows, dealt to the page: the basis's own settings over the map, the cities
   over them, Draw under the map, and the notes down with the seat's figures. The rows
   move as they are, so the map's own clicks and menus still work on them */
function dawnSync() {
  if (!dawnOn()) return;
  const el = $("#legend"), m = M(); if (!el || !m) return;
  const slot = (id, nodes) => { const s = $(id); if (s) { s.replaceChildren(...nodes); s.classList.toggle("none", !nodes.length); } };
  const sub = el.querySelector(".lg-sub"), notes = [];
  if (sub) { notes.push(...sub.querySelectorAll(":scope > .lg-note")); notes.forEach((n) => n.remove()); }
  notes.push(...el.querySelectorAll(":scope > .lg-dn, :scope > .lg-note, :scope > .lg-shapes"), ...el.querySelectorAll(":scope > .lg-foot .lg-shapes"));
  slot("#dm-opts", sub && sub.textContent.trim() ? [sub] : []);
  slot("#dm-draw", [...el.querySelectorAll(":scope > .lg-draw")]);
  slot("#dm-places", [...el.querySelectorAll(":scope > #cities")]);
  slot("#dm-notes", notes);
  const s = S.sel;
  document.dispatchEvent(new CustomEvent("dawn-map", { detail: {
    year: S.year, years: YEARS_FED, lens: S.lens === "senpref" ? "flow" : S.lens, lenses: yearLenses(S.year),
    level: s.level, seat: s.level === "div" || s.level === "booth" ? dn(m.divs[s.div].n) : "",
  } }));
}
