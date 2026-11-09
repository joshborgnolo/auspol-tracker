/* cycles.mjs – the retro Past cycles page, /cycles/retro/ (2026-11-09).

   Every term since 1943 lined up on its own election day, in the retro
   dress: the navbar, the banner, tab buttons for the modern page's own
   sections (the scorecard of every measure, then the two-party, primary
   vote, leadership and final-polls sections), and a toolbar with the modern
   page's two switches, Compare with (every past term, those re-elected,
   those ousted) and Measure (the level, or the change since the election).
   Every headline, scorecard row and chart is the modern page's own:
   harvest.mjs runs it in node and presses its switches, all six
   combinations, and blocks.mjs reads what it drew each time. The final
   polls' two scoring bases are harvested the same way.

   The retro map's navbar opens it (Past cycles); it is linked from nowhere
   else, and its canonical is the modern Past cycles page. build.mjs writes
   it on every federal build. */
import { modernRunner, dataClock, press, words, hasCls, find, findAll } from "./harvest.mjs";
import { sectionBlocks, sectionsOf } from "./blocks.mjs";
import { retroPage, panelHTML, ctlHTML, read, esc } from "./page.mjs";
import vm from "node:vm";

// the views: the modern page's sections, in its order (its own section index names the last four)
export const CYCLE_VIEWS = [
  { id: "measures", label: "All measures", short: "Measures", icon: "grid" },
  { id: "tpp", label: "Two-party preferred", short: "2PP", icon: "tpp" },
  { id: "primary", label: "Primary vote", short: "Primary", icon: "pri" },
  { id: "leaders", label: "Leadership", short: "Leaders", icon: "ld" },
  { id: "final", label: "Final polls", short: "Final polls", icon: "target" },
];
const SECTION_VIEW = ["measures", "tpp", "primary", "leaders", "final"];

const slug = (s) => String(s).toLowerCase().replace(/’/g, "").replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const pressed = (b) => b.props["aria-pressed"] === true || b.props["aria-pressed"] === "true";

export function retroCycles({ root, dataset, shellPages, footer, siteUrl = "https://auspoltracker.com/", runner }) {
  const M = runner || modernRunner({ root, clock: dataClock(dataset) });
  const mount = () => M.mount("PastCyclesView", {}, { path: "/cycles/" });
  const readAll = (h) => sectionsOf(h.tree).map((sec) => { const S = sectionBlocks(sec); return { title: S.title, meta: S.meta, blocks: S.blocks }; });
  /* the switches, as the modern page draws them: Compare with's tabs (each
     with its count) and Measure's, in the controls row over the scorecard;
     the final polls' basis chips */
  const h0 = mount();
  const cc = find(h0.tree, (t) => hasCls(t, "rd-cc"));
  if (!cc) throw new Error("retro Past cycles: the Compare with / Measure row is missing from the modern page");
  const strips = findAll(cc, (t) => hasCls(t, "rd-tabs"));
  const tabsIn = (strip) => findAll(strip, (t) => t.tag === "button" && hasCls(t, "rd-tab")).map((b) => {
    const n = find(b, (x) => hasCls(x, "rd-cc-n"));
    const all = words(b), count = n ? words(n) : "";
    return { l: count && all.endsWith(count) ? all.slice(0, -count.length).trim() : all, n: count, on: pressed(b), full: all };
  });
  const cmp = tabsIn(strips[0]), mode = tabsIn(strips[1]);
  if (cmp.length < 2 || mode.length < 2) throw new Error("retro Past cycles: the comparison or measure switch didn't read");
  const c0 = cmp.find((c) => c.on) || cmp[0], m0 = mode.find((m) => m.on) || mode[0];
  const isTab = (full) => (t) => t.tag === "button" && hasCls(t, "rd-tab") && words(t) === full;
  const variants = {};   // section index → { "cmp|mode": {title, meta, blocks} }
  for (const c of cmp) for (const m of mode) {
    const h = mount();
    if (c !== c0) press(h, isTab(c.full));
    if (m !== m0) press(h, isTab(m.full));
    const secs = readAll(h);
    secs.forEach((s, i) => { if (i < 4) ((variants[i] = variants[i] || {})[slug(c.l) + "|" + slug(m.l)] = s); });
  }
  // the final polls: each basis, its chips' own press
  const basisChips = findAll(find(h0.tree, (t) => hasCls(t, "rd-acc-basis")) || [], (t) => t.tag === "button").map((b) => ({ l: words(b), on: pressed(b) || hasCls(b, "on") }));
  const b0 = basisChips.find((b) => b.on) || basisChips[0];
  const finals = {};
  for (const b of basisChips) {
    const h = mount();
    if (b !== b0) press(h, (t) => t.tag === "button" && words(t) === b.l && !!find(h.tree, (x) => hasCls(x, "rd-acc-basis")));
    finals[slug(b.l)] = readAll(h)[4];
  }
  const secs0 = readAll(h0);
  if (secs0.length < 5) throw new Error(`retro Past cycles: ${secs0.length} sections read, 5 expected`);
  const def = slug(c0.l) + "|" + slug(m0.l);
  const ids = ["measures", "tpp", "primary", "leaders", "final"];
  const panels = secs0.map((s, i) => i < 4
    ? { id: ids[i], view: SECTION_VIEW[i], title: s.title, meta: s.meta, keys: ["cmp", "mode"], ctl: [], variants: variants[i], def }
    : { id: ids[i], view: SECTION_VIEW[i], title: s.title, meta: s.meta, keys: ["basis"], ctl: basisChips.length > 1 ? [{ id: "basis", kind: "radio", label: "Score", opts: basisChips.map((b) => ({ v: slug(b.l), l: b.l })), def: slug(b0.l) }] : [], variants: finals, def: slug(b0.l) });
  const tool = [
    { id: "cmp", kind: "select", label: "Compare with", menu: "Compare with", opts: cmp.map((c) => ({ v: slug(c.l), l: c.l + (c.n ? " (" + c.n + ")" : "") })), def: slug(c0.l) },
    { id: "mode", kind: "radio", label: "Measure", menu: "Measure", opts: mode.map((m) => ({ v: slug(m.l), l: m.l })), def: slug(m0.l) },
  ];
  // the panels' opening views into the page; the client draws the rest
  const ctx = vm.createContext({ window: {}, console });
  vm.runInContext(read("render.client.js"), ctx, { filename: "render.client.js" });
  const RR = ctx.window.RT_R;
  const body = (p) => { RR.resetIds(); return RR.blocks(p.variants[p.def].blocks, { idp: p.id + "-" }); };
  const toolHTML = `<div class="rp-tool" role="toolbar" aria-label="Compare and measure">${tool.map((c) => c.kind === "select"
    ? `<label class="rp-sel"><span class="rp-cl">${esc(c.label)}</span><select data-ctl="${c.id}">${c.opts.map((o) => `<option value="${esc(o.v)}"${o.v === c.def ? " selected" : ""}>${esc(o.l)}</option>`).join("")}</select></label>`
    : `<span class="rp-radios" role="radiogroup" aria-label="${esc(c.label)}"><span class="rp-cl">${esc(c.label)}</span>${c.opts.map((o) => `<label><input type="radio" name="rp-${c.id}" data-ctl="${c.id}" value="${esc(o.v)}"${o.v === c.def ? " checked" : ""}> ${esc(o.l)}</label>`).join("")}</span>`).join("")}</div>`;
  const main = toolHTML + "\n" + CYCLE_VIEWS.map((v) => `<div class="rp-view" data-view="${v.id}" id="rp-v-${v.id}" role="tabpanel" aria-labelledby="rp-t-${v.id}">\n`
    + panels.filter((p) => p.view === v.id).map((p) => panelHTML(p, body(p), ctlHTML(p))).join("\n")
    + `\n</div>`).join("\n");
  const L = M.D.latest;
  const data = { built: L.publishedISO, clock: M.win.Date.now(), tool, toolViews: ["measures", "tpp", "primary", "leaders"],
    panels: panels.map((p) => ({ id: p.id, title: p.title, meta: p.meta, keys: p.keys, ctl: p.ctl, variants: p.variants, def: p.def })) };
  const html = retroPage({
    here: "/cycles/retro/", modern: "/cycles/", canonical: "cycles/", siteUrl, shellPages, footer,
    title: "Past cycles", meta: secs0[0].meta || "Every term since 1943, lined up on its own election day", views: CYCLE_VIEWS, def: "measures", main, data,
    notes: [
      { h: "The modern page in old clothes", html: "Every finding, scorecard row and chart here is the modern Past cycles page’s own, read from it each time the site is built, at each of its Compare with and Measure settings, and drawn the way a website of about 2000 would have drawn it." },
      { h: "More in the modern view", html: `The modern page draws any past term on its charts, opens each scorecard row to rank every term, and downloads the polls behind them. <a href="/retro/">The front page</a> and <a href="/allpolls/retro/">All polls</a> have retro views too, and so does <a href="/map/#retro=1">the Electoral map</a>.` },
    ],
    desc: "Every Australian federal term since 1943 lined up on its own election day, in the dress of a website from about 2000: this term's polling against every past term's, and how the final polls have done.",
  });
  return { html, data, panels };
}
