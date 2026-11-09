/* page.mjs – the shell the retro Now and Past cycles pages share (2026-11-09).

   The navbar in the era's words (Home, Edit, View, Favorites, Help, the
   site's pages at its right), the banner (the flag, the site's name over
   the page's, the meta line, Parliament House), the tab buttons for the
   page's views with Modern view at their end, the colophon, and the page's
   data and scripts. It wears the retro chrome every retro page wears
   (chrome.css, shared with the Electoral map's retro view and the retro All
   polls page) and draws the navbar's art from the retro All polls page's
   own (allpolls.mjs RT_ICON, RT_FLAG, RT_HOUSE), so the four can't dress
   differently. Each page's views and panels are its own (now.mjs,
   cycles.mjs); the panels are drawn by render.client.js and run by
   pages.client.js, both inlined. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { retroPages, RT_ICON, RT_FLAG, RT_HOUSE } from "./allpolls.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const read = (f) => fs.readFileSync(path.join(HERE, f), "utf8");
export const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* the tabs' icons: the All polls page's three, and the views these pages add */
export const ICONS = {
  ...RT_ICON,
  list: `<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M1.5 2.5h13v11h-13z" fill="#fff" stroke="currentColor"/><path d="M1.5 5.5h13" stroke="currentColor"/><path d="M3.5 8h9M3.5 10.5h9" stroke="currentColor" stroke-width="1.2"/></svg>`,
  people: `<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="5.2" cy="5" r="2.3" fill="currentColor"/><circle cx="11" cy="5.6" r="2" fill="currentColor"/><path d="M1 14c.3-3 2-4.6 4.2-4.6S9.1 11 9.4 14zM8.6 14c.3-2.6 1.4-4 2.4-4s2.6 1.2 2.9 4z" fill="currentColor"/></svg>`,
  globe: `<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.3" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M1.8 8h12.4M8 1.7c-2.2 2-2.2 10.6 0 12.6M8 1.7c2.2 2 2.2 10.6 0 12.6M3 4.6h10M3 11.4h10" fill="none" stroke="currentColor" stroke-width=".9"/></svg>`,
  grid: `<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M1.5 2.5h13v11h-13z" fill="none" stroke="currentColor"/><path d="M1.5 6.2h13M1.5 9.8h13M6 2.5v11" stroke="currentColor"/><circle cx="9.5" cy="4.4" r="1" fill="currentColor"/><circle cx="12" cy="8" r="1" fill="currentColor"/><circle cx="10.5" cy="11.7" r="1" fill="currentColor"/></svg>`,
  target: `<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.3" fill="none" stroke="currentColor" stroke-width="1.3"/><circle cx="8" cy="8" r="3.6" fill="none" stroke="currentColor" stroke-width="1.3"/><circle cx="8" cy="8" r="1.2" fill="currentColor"/></svg>`,
  shade: RT_ICON.shade,
};

/* the page: { here, modern, title, meta, desc, views: [{id, label, short, icon}],
   def (the view it opens on), main (the views' html), data (the client's),
   footer (the colophon's words), siteUrl, canonical } */
export function retroPage(o) {
  const pages = retroPages(o.shellPages);
  const mi = (k, label, extra = "") => `<button type="button" class="rt-ni" data-rt-menu="${k}" aria-haspopup="menu" aria-expanded="false">${extra}${label}</button>`;
  const F = o.footer || null;
  const data = { ...o.data, pages, here: o.here, modern: o.modern, title: o.title, views: o.views.map(({ id, label, short }) => ({ id, label, short })), def: o.def, notes: o.notes ? "About this page" : null };
  const json = JSON.stringify(data).replace(/</g, "\\u003c").replace(/[\u2028\u2029]/g, (c) => "\\u" + c.charCodeAt(0).toString(16));
  const viewIds = o.views.map((v) => v.id);
  /* the view a link names is shown from the first paint: a head script
     reads the hash before the body draws, and this rule shows only that
     view (without the script every view shows, one under the other) */
  const viewCss = `html.rp-js .rp-view { display: none; }\n` + viewIds.map((v) => `html.rp-js[data-rp-view="${v}"] .rp-view[data-view="${v}"]`).join(",\n") + ` { display: block; }`;
  return `<!DOCTYPE html>
<html lang="en-AU" class="mp-retro">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>auspol tracker – ${esc(o.title)}, retro</title>
<meta name="description" content="${esc(o.desc)}">
<link rel="canonical" href="${o.siteUrl}${o.canonical}">
<meta name="theme-color" content="#061436">
<meta name="color-scheme" content="light">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<script>(function(){var d=document.documentElement,v=${JSON.stringify(viewIds)},m=/(?:^#|&)v=([\\w-]+)/.exec(location.hash);d.className+=" rp-js";d.setAttribute("data-rp-view",m&&v.indexOf(m[1])>=0?m[1]:${JSON.stringify(o.def)});})();</script>
<style>
${read("chrome.css")}
${read("pages.css")}
${viewCss}
</style>
</head>
<body>
<div class="rp-frame">
<div class="rt-top">
  <nav class="rt-nav" aria-label="Site and page">
    <a class="rt-ni" href="/retro/" title="auspol tracker’s home page"${o.here === "/retro/" ? ' aria-current="page"' : ""}>${RT_ICON.home}Home</a>${mi("edit", "Edit")}${mi("view", "View")}${mi("fav", "Favorites", RT_ICON.star)}${mi("help", "Help")}
    <span class="rt-navgap"></span>
    <span class="rt-pages">${pages.tabs.map((p) => `<a href="${esc(p.href)}"${p.href === o.here ? ' aria-current="page"' : ""}>${esc(p.label)}</a>`).join("")}${mi("more", `More pages ${RT_ICON.dd}`)}</span>${mi("pages", `Pages ${RT_ICON.dd}`).replace('class="rt-ni"', 'class="rt-ni rt-pagesb"')}
  </nav>
  <div class="rt-banner"><a class="rt-home" href="/retro/" title="auspol tracker: the tracker’s home page">${RT_FLAG}</a><div class="rt-bcol"><a class="rt-kicker" href="/retro/">auspol tracker</a><span class="rt-bline"><h1 class="rt-btitle">${esc(o.title)}</h1><span class="rt-bmeta">${esc(o.meta)}</span></span></div>${RT_HOUSE}</div>
  <div class="rt-tabs" role="tablist" aria-label="View">${o.views.map((v) => `<button type="button" role="tab" id="rp-t-${v.id}" data-rp-tab="${v.id}" aria-controls="rp-v-${v.id}" aria-selected="${v.id === o.def}">${ICONS[v.icon] || ""}<span class="rt-tl">${esc(v.label)}</span><span class="rp-ts">${esc(v.short)}</span></button>`).join("")}<button type="button" class="rt-modern" data-rp="modern" title="Back to the modern look">${RT_ICON.modern}<span class="rt-tl">Modern view</span></button></div>
</div>
<main id="rp-main">
${o.main}
${o.notes ? `<section class="rp-panel rp-notes" id="rp-notes" aria-labelledby="rp-notes-cap">
  <h2 class="rp-cap" id="rp-notes-cap"><span class="rp-capt">About this page</span></h2>
  <div class="rp-cols">${o.notes.map((c) => `<div><h3>${esc(c.h)}</h3><p>${c.html}</p></div>`).join("")}</div>
</section>` : ""}
</main>
${F ? `<footer class="rp-foot-site">
  <div><p>${esc(F.lede)}</p><p>${esc(F.disc)}</p></div>
  <div><p>${esc(F.infoLead)}<a href="/info/">${esc(F.infoWord)}</a>. ${esc(F.spot)} <a href="/feedback/">${esc(F.linkWord)}</a>.</p><p>${esc(F.archLead)}<a href="${esc(F.archHref)}">${esc(F.archWord)}</a>${esc(F.archTail)}</p></div>
</footer>` : ""}
</div>
<div class="rt-drop" role="menu" hidden></div>
<script type="application/json" id="rp-data">${json}</script>
<script>
${read("select.client.js")}
</script>
<script>
${read("render.client.js")}
</script>
<script>
${read("pages.client.js")}
</script>
</body>
</html>
`;
}

/* a panel: a navy caption with the section's title (its meta beside it, a
   roll-up button at its end), its controls, and its body */
export function panelHTML(p, bodyHTML, ctlHTML = "") {
  return `<section class="rp-panel" id="${esc(p.id)}" aria-labelledby="${esc(p.id)}-cap" data-panel="${esc(p.id)}">
  <h2 class="rp-cap" id="${esc(p.id)}-cap"><span class="rp-capt">${esc(p.title)}</span>${p.meta ? `<small class="rp-capm">${esc(p.meta)}</small>` : ""}<button type="button" class="rt-shade" data-rp="shade" aria-expanded="true" aria-label="Roll up the panel" title="Roll up the panel">${ICONS.shade}</button></h2>
  ${ctlHTML}<div class="rp-body" data-body="${esc(p.id)}">${bodyHTML}</div>
</section>`;
}
/* a panel's controls, the era's way: a strip of tabs inside the panel, a
   drop-down, or radio buttons, each naming the variant it picks */
export function ctlHTML(p) {
  if (!p.ctl || !p.ctl.length) return "";
  return `<div class="rp-ctl" role="toolbar" aria-label="${esc(p.title)} options">${p.ctl.map((c) => {
    // a strip names itself where a panel has two (Leaders' Preferred PM and Net approval)
    if (c.kind === "tabs") return `${c.show ? `<span class="rp-ctlgrp"><span class="rp-cl">${esc(c.label)}</span>` : ""}<span class="rp-ptabs" role="tablist" aria-label="${esc(c.label)}">${c.opts.map((x) => `<button type="button" role="tab" data-ctl="${esc(c.id)}" data-v="${esc(x.v)}" aria-selected="${x.v === c.def}">${esc(x.l)}</button>`).join("")}</span>${c.show ? "</span>" : ""}`;
    if (c.kind === "radio") return `<span class="rp-radios" role="radiogroup" aria-label="${esc(c.label)}"><span class="rp-cl">${esc(c.label)}</span>${c.opts.map((x) => `<label><input type="radio" name="${esc(p.id + "-" + c.id)}" data-ctl="${esc(c.id)}" value="${esc(x.v)}"${x.v === c.def ? " checked" : ""}> ${esc(x.l)}</label>`).join("")}</span>`;
    return `<label class="rp-sel"><span class="rp-cl">${esc(c.label)}</span><select data-ctl="${esc(c.id)}">${c.opts.map((x) => `<option value="${esc(x.v)}"${x.v === c.def ? " selected" : ""}>${esc(x.l)}</option>`).join("")}</select></label>`;
  }).join("")}</div>`;
}
