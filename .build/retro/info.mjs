/* info.mjs – the retro Info page, /info/retro/ (2026-11-09).

   How the site works, in the dress the other retro pages wear: the navbar
   (whose Info is this page), the banner, tab buttons for the modern page's
   four parts (About, Questions, How the figures are built, The panels), and
   each part as panels under navy captions, the way a help site of about
   2000 laid out its FAQ: a contents list of the part's entries at its top,
   each entry with its own "Back to top".

   Every word, formula and worked table is the modern Info page's own:
   harvest.mjs runs InfoView in node (its entries are written by rules off
   the live data, the interval, the final polls' record, the shrinkage), and
   this module turns what it renders into plain HTML. A term-to-term link
   (the modern hi-term buttons) becomes a link to that entry here, wherever
   it sits: its target is read by pressing the modern button, so it can't
   drift from the modern page's own cross-references. An element this module
   doesn't know stops the build by name rather than dropping words.

   The retro family's navbars open it (Info); it is linked from nowhere
   else, and its canonical is the modern Info page. build.mjs writes it on
   every federal build, beside the Now and Past cycles twins. */
import { modernRunner, dataClock, words, hasCls, find, findAll } from "./harvest.mjs";
import { retroPage, read, esc, ICONS } from "./page.mjs";
import { RETRO_TWIN } from "./allpolls.mjs";

export const INFO_VIEWS = [
  { id: "about", label: "About", short: "About", icon: "home" },
  { id: "faq", label: "Questions", short: "Questions", icon: "faq" },
  { id: "method", label: "How the figures are built", short: "Method", icon: "calc" },
  { id: "panels", label: "The panels", short: "Panels", icon: "grid" },
];
// the modern page's chapter headings, in order, and the view each opens
const CHAPTER = { "info-about": "about", "info-faq": "faq", "info-method": "method", "info-sections": "panels" };

// tags carried over as themselves (attributes dropped but the few listed)
const SAME = new Set(["b", "strong", "i", "em", "sub", "sup", "br", "ul", "ol", "li", "code", "thead", "tbody", "tfoot", "tr", "th", "td", "caption", "small", "abbr", "q", "cite", "var"]);
const ATTR = { th: ["colSpan", "rowSpan", "scope"], td: ["colSpan", "rowSpan"], abbr: ["title"] };
const ATTR_NAME = { colSpan: "colspan", rowSpan: "rowspan" };

export function retroInfo({ root, dataset, shellPages, footer, siteUrl = "https://auspoltracker.com/", runner }) {
  const M = runner || modernRunner({ root, clock: dataClock(dataset) });
  const h = M.mount("InfoView", {}, { path: "/info/" });
  const AP = M.win.AP;

  /* a cross-reference's target: the modern button's own click, with the
     site's two jumps caught (openTerm names an entry; gotoFinalPolls is the
     final-polls panel in Past cycles, whose retro twin draws it) */
  const target = (btn) => {
    const keep = { openTerm: AP.openTerm, gotoFinalPolls: AP.gotoFinalPolls, gotoTab: AP.gotoTab };
    let to = null;
    AP.openTerm = (id) => { to = { term: id }; };
    AP.gotoFinalPolls = () => { to = { href: "/cycles/retro/#v=final" }; };
    AP.gotoTab = (id) => { to = { href: RETRO_TWIN["/" + id + "/"] || "/" + id + "/" }; };
    try { btn.props.onClick && btn.props.onClick({ preventDefault() {}, stopPropagation() {} }); } finally { Object.assign(AP, keep); }
    if (!to) throw new Error(`retro Info: the link "${words(btn)}" leads nowhere this page knows`);
    return to;
  };
  const alias = (() => { try { return M.win.eval("INFO_ALIAS"); } catch { return {}; } })() || {};

  const unknown = new Set();
  const terms = [];          // [{ id, view, label }] every entry, for the links
  const xrefs = [];          // term ids linked, checked once every entry is known
  /* the modern tree as plain HTML */
  function html(t) {
    if (t == null || t === false || t === true) return "";
    if (typeof t === "string") return esc(t);
    if (Array.isArray(t)) return t.map(html).join("");
    if (t.tag === "$chart" || t.tag === "svg") { unknown.add(t.tag); return ""; }
    if (t.props["aria-hidden"] === true || t.props["aria-hidden"] === "true") return "";
    const kids = () => html(t.kids);
    const tag = t.tag;
    if (tag === "button" && hasCls(t, "hi-term")) {
      const to = target(t);
      if (to.href) return `<a href="${esc(to.href)}">${kids()}</a>`;
      const id = alias[to.term] || to.term;
      xrefs.push(id);
      return `<a class="ri-x" href="#t=${esc(id)}" data-term="${esc(id)}">${kids()}</a>`;
    }
    if (tag === "a") {
      const href = String(t.props.href || "");
      const twin = RETRO_TWIN[href] || href;
      return `<a href="${esc(twin)}"${/^https?:/.test(twin) ? ' rel="noopener"' : ""}>${kids()}</a>`;
    }
    if (tag === "span" && hasCls(t, "info-p")) return `<span class="ri-p">${kids()}</span>`;
    if (tag === "p") return `<p class="${hasCls(t, "info-work-note") ? "rp-note" : "ri-pp"}">${kids()}</p>`;
    if ((tag === "h3" || tag === "h4") && hasCls(t, "info-t")) return `<${tag} class="ri-t">${kids()}</${tag}>`;
    if (tag === "details") return `<details class="rp-how ri-work">${kids()}</details>`;
    if (tag === "summary") return `<summary>${kids()}</summary>`;
    if (tag === "div" && hasCls(t, "info-work-wrap")) return kids();
    if (tag === "table") {
      // a worked table the modern page scrolls inside its wrap: the era's sunken list
      return `<div class="rp-well ri-well"><table class="rp-t ri-tab${hasCls(t, "info-work-list") ? " ri-list" : ""}">${kids()}</table></div>`;
    }
    if (tag === "tr" && hasCls(t, "info-work-sum")) return `<tr class="ri-sum">${kids()}</tr>`;
    if (tag === "td" || tag === "th") {
      const a = (ATTR[tag] || []).filter((k) => t.props[k] != null).map((k) => ` ${ATTR_NAME[k] || k}="${esc(t.props[k])}"`).join("");
      const num = hasCls(t, "num") || hasCls(t, "r") || (t.props.style && t.props.style.textAlign === "right");
      return `<${tag}${a}${num ? ' class="r"' : ""}>${kids()}</${tag}>`;
    }
    if (tag === "ul" || tag === "ol") return `<${tag} class="ri-ul">${kids()}</${tag}>`;
    if (SAME.has(tag)) {
      const a = (ATTR[tag] || []).filter((k) => t.props[k] != null).map((k) => ` ${ATTR_NAME[k] || k}="${esc(t.props[k])}"`).join("");
      return `<${tag}${a}>${kids()}</${tag}>`;
    }
    if (tag === "div" || tag === "span") return kids();
    unknown.add(tag + (t.props.className ? "." + t.props.className : ""));
    return kids();
  }

  /* the page's parts as the modern page orders them: About's paragraphs,
     then each chapter's entries, The panels' sections each with a lead */
  const main = find(h.tree, (t) => hasCls(t, "info-main"));
  if (!main) throw new Error("retro Info: the modern page's .info-main is missing");
  const head = words(find(h.tree, (t) => hasCls(t, "rd-hed")));
  const dek = words(find(h.tree, (t) => hasCls(t, "rd-dek")));
  const meta = words(find(h.tree, (t) => hasCls(t, "rd-meta"))) || "How the site works";
  const flat = [];
  (function walk(k) { if (Array.isArray(k)) k.forEach(walk); else if (k && typeof k === "object") flat.push(k); })(main.kids);
  const parts = { about: { html: "" }, faq: { entries: [] }, method: { entries: [] }, panels: { groups: [] } };
  const titles = {};
  let view = null, group = null;
  for (const t of flat) {
    if (t.tag === "h2" && CHAPTER[t.props.id]) { view = CHAPTER[t.props.id]; titles[view] = words(t); group = null; continue; }
    if (view === "about" && hasCls(t, "info-about")) { parts.about.html = html(t.kids); continue; }
    if (t.tag === "h3" && hasCls(t, "info-group")) { group = { id: t.props.id, title: words(t), entries: [] }; parts.panels.groups.push(group); continue; }
    if (hasCls(t, "info-term")) {
      const id = String(t.props.id || "").replace(/^term-/, "");
      const name = find(t, (x) => hasCls(x, "info-t"));
      const label = name ? words(name).replace(/\.$/, "") : null;
      const e = { id, label, html: html(t.kids) };
      if (view === "panels") { if (!group) throw new Error("retro Info: a panel entry before its section heading"); group.entries.push(e); terms.push({ id, view, label: label || group.title }); }
      else if (parts[view] && parts[view].entries) { parts[view].entries.push(e); terms.push({ id, view, label }); }
      else throw new Error(`retro Info: an entry (${id}) outside any part`);
      continue;
    }
    unknown.add(t.tag + "." + (t.props.className || ""));
  }
  if (unknown.size) throw new Error(`retro Info: the modern page drew what this page doesn't know how to dress: ${[...unknown].join(", ")} – teach info.mjs`);
  const known = new Set(terms.map((t) => t.id));
  const lost = [...new Set(xrefs)].filter((id) => !known.has(id));
  if (lost.length) throw new Error(`retro Info: links to entries the page doesn't hold: ${lost.join(", ")}`);
  if (!parts.about.html || !parts.faq.entries.length || !parts.method.entries.length || !parts.panels.groups.length) throw new Error("retro Info: a part of the modern page came out empty");
  // the term links name the view their entry is in, so the head script opens it from the first paint
  const viewOf = Object.fromEntries(terms.map((t) => [t.id, t.view]));
  const linkUp = (s) => s.replace(/href="#t=([\w-]+)" data-term="\1"/g, (m, id) => `href="#v=${viewOf[id]}&amp;t=${id}" data-term="${id}"`);

  /* the panels: a contents list, then the entries, each with its way back up */
  const top = `<button type="button" class="ri-top" data-ri="top">Back to top</button>`;
  const entryHTML = (e, tag) => `<div class="ri-term" id="term-${esc(e.id)}">${linkUp(e.html)}${top}</div>`;
  const contents = (items, label = "On this page") => `<div class="ri-toc"><h3 class="ri-toch">${esc(label)}</h3><ul>${items.map(([href, l, term]) => `<li><a href="${href}"${term ? ` data-term="${esc(term)}"` : ""}>${esc(l)}</a></li>`).join("")}</ul></div>`;
  const panel = (id, title, metaW, body, cls = "") => `<section class="rp-panel ri-panel${cls}" id="${esc(id)}" aria-labelledby="${esc(id)}-cap">
  <h2 class="rp-cap" id="${esc(id)}-cap"><span class="rp-capt">${esc(title)}</span>${metaW ? `<small class="rp-capm">${esc(metaW)}</small>` : ""}<button type="button" class="rt-shade" data-rp="shade" aria-expanded="true" aria-label="Roll up the panel" title="Roll up the panel">${ICONS.shade}</button></h2>
  <div class="rp-body">${body}</div>
</section>`;
  const termLink = (v, e) => [`#v=${v}&amp;t=${esc(e.id)}`, e.label, e.id];
  // the contents in a column at the left that rides along, the entries beside it (the modern rail's place)
  // (a section with nothing to list keeps the column, empty, so its text lines up with its neighbours')
  const cols = (toc, body) => `<div class="ri-cols">${toc ? `<nav class="ri-side" aria-label="On this page">${toc}</nav>` : `<div class="ri-side"></div>`}<div class="ri-main">${body}</div></div>`;
  const views = {
    about: panel("ri-about", titles.about || "About", meta,
      cols(contents([["#v=faq", titles.faq || "Questions"], ["#v=method", titles.method || "How the figures are built"], ["#v=panels", titles.panels || "The panels"]], "Also in Info"),
        `<h2 class="rp-hed rp-hed-top">${esc(head)}</h2><p class="rp-dek">${esc(dek)}</p>`
        + `<div class="ri-about">${linkUp(parts.about.html)}</div>`)),
    faq: panel("ri-faq", titles.faq || "Questions", `${parts.faq.entries.length} questions`,
      cols(contents(parts.faq.entries.map((e) => termLink("faq", e))), parts.faq.entries.map((e) => entryHTML(e)).join(""))),
    method: panel("ri-method", titles.method || "How the figures are built", `${parts.method.entries.length} entries`,
      cols(contents(parts.method.entries.map((e) => termLink("method", e))), parts.method.entries.map((e) => entryHTML(e)).join(""))),
    panels: panel("ri-panels", titles.panels || "The panels", `${parts.panels.groups.length} sections, each with its own explainer`,
      contents(parts.panels.groups.map((g) => [`#v=panels&amp;t=${esc(g.entries[0] ? g.entries[0].id : g.id)}`, g.title, g.entries[0] ? g.entries[0].id : null]), "Sections").replace('class="ri-toc"', 'class="ri-toc ri-secs"'))
      + parts.panels.groups.map((g) => panel("ri-" + g.id, g.title, `${g.entries.length} ${g.entries.length === 1 ? "entry" : "entries"}`,
        cols(g.entries.length > 1 ? contents(g.entries.slice(1).map((e) => termLink("panels", e)), "In this section") : "",
          g.entries.map((e) => entryHTML(e)).join("")), " ri-sec")).join("\n"),
  };
  const mainHTML = INFO_VIEWS.map((v) => `<div class="rp-view" data-view="${v.id}" id="rp-v-${v.id}" role="tabpanel" aria-labelledby="rp-t-${v.id}">\n${views[v.id]}\n</div>`).join("\n");
  const L = M.D.latest;
  const data = { built: L.publishedISO, clock: M.win.Date.now(), panels: [], terms: terms.map(({ id, view: v }) => [id, v]) };
  const page = retroPage({
    here: "/info/retro/", modern: "/info/", canonical: "info/", siteUrl, shellPages, footer,
    title: "Info", meta, views: INFO_VIEWS, def: "about", main: mainHTML, data,
    css: read("info.css"), client: read("info.client.js"),
    notes: [
      { h: "The modern page in old clothes", html: "Every answer, formula and worked table here is the modern Info page’s own, read from it each time the site is built, so the figures it quotes are today’s. It is drawn the way a help site of about 2000 would have drawn it." },
      { h: "More in the modern view", html: `In the modern look an underlined term anywhere on the site opens its entry where you are reading. <a href="/retro/">The front page</a>, <a href="/allpolls/retro/">All polls</a> and <a href="/cycles/retro/">Past cycles</a> have retro views too, and so does <a href="/map/#retro=1">the Electoral map</a>.` },
    ],
    desc: "How auspol tracker works, in the dress of a website from about 2000: the aggregate's weighting and house-lean method, the questions readers ask, and an explainer for every panel.",
  });
  return { html: page, data, terms, parts };
}
