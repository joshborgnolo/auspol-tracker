/* now.mjs – the retro Now page, /retro/ (2026-11-09).

   The front page in the dress the Electoral map's retro view and the retro
   All polls page wear: the navbar (whose Home is this page), the banner,
   tab buttons for five views, and every section of the modern Now page as
   a panel under a navy caption: the same headline, dek, figures and charts,
   because they are the modern page's own (harvest.mjs runs it in node,
   blocks.mjs reads what it drew). Where a modern section switches views
   (the contest, the mood's two questions, the issues' two readings,
   decidedness by party or age, the sentiment gauges, the latest polls'
   measures, who votes by group and party), the panel offers the same
   switch in the era's controls, every view harvested from the modern page
   pressing its own control.

   The retro map's navbar opens it (Home); it is linked from nowhere else,
   and its canonical is the modern front page. build.mjs writes it on every
   federal build, after the tab documents it reads the modern scripts from. */
import { modernRunner, dataClock, press, words, hasCls, find, findAll } from "./harvest.mjs";
import { sectionBlocks, sectionOf } from "./blocks.mjs";
import { retroPage, panelHTML, ctlHTML, read } from "./page.mjs";
import vm from "node:vm";

/* the views, as the page's tab buttons: the modern page's sections in its
   own order, grouped by what they answer */
export const NOW_VIEWS = [
  { id: "vote", label: "Voting intention", short: "Vote", icon: "tpp" },
  { id: "polls", label: "Latest polls", short: "Polls", icon: "list" },
  { id: "leaders", label: "Leaders", short: "Leaders", icon: "ld" },
  { id: "voters", label: "Voters", short: "Voters", icon: "people" },
  { id: "mood", label: "Mood and issues", short: "Mood", icon: "globe" },
];
// the panels, each a modern section: its view, its component, and how its own controls are found
const PANELS = [
  { id: "tpp", view: "vote", comp: "Hero", contest: true },
  { id: "primary", view: "vote", comp: "PrimaryVotePanel" },
  { id: "decided", view: "vote", comp: "UndecidedPanel", tabs: "rd-un-tabs" },
  { id: "polls", view: "polls", comp: "PollsterTable", tabs: "rd-pl-tabs", flip: true },
  { id: "leaders", view: "leaders", comp: "LeadershipSection" },
  { id: "who", view: "voters", comp: "DemographicsPanel", tabs: "rd-wv-tabs", chips: true },
  { id: "switching", view: "voters", comp: "OnSourcesPanel" },
  { id: "mood", view: "mood", comp: "DirectionPanel", tabs: "rd-mood-tabs" },
  { id: "issues", view: "mood", comp: "IssuesPanel", tabs: "rd-is-tabs" },
  { id: "sentiment", view: "mood", comp: "MoodPanel", tabs: "rd-confidence-tabs" },
];

const tabsOf = (tree, cls) => {
  const strip = find(tree, (t) => hasCls(t, "rd-tabs") && hasCls(t, cls));
  if (!strip) return null;
  const btns = findAll(strip, (t) => t.tag === "button" && hasCls(t, "rd-tab"));
  return btns.map((b) => ({ l: words(b), on: b.props["aria-pressed"] === true || b.props["aria-pressed"] === "true" }));
};
const isTab = (cls, label) => (t) => t.tag === "button" && hasCls(t, "rd-tab") && words(t) === label;
const chipsOf = (tree) => findAll(tree, (t) => t.tag === "button" && hasCls(t, "rd-chip") && !!find(t, (x) => hasCls(x, "rd-sw"))).map((b) => ({ l: words(b), on: b.props["aria-pressed"] === true || b.props["aria-pressed"] === "true" || hasCls(b, "on") }));
const isChip = (label) => (t) => t.tag === "button" && hasCls(t, "rd-chip") && words(t) === label;
const slug = (s) => String(s).toLowerCase().replace(/’/g, "").replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/* one panel's variants: mount the modern section fresh for each, press the
   controls that pick it, read what it draws */
function harvestPanel(M, p, heroProps) {
  const read = (h) => { const S = sectionBlocks(sectionOf(h.tree)); return { title: S.title, meta: S.meta, blocks: S.blocks }; };
  const mount = (props) => M.mount(p.comp, props || heroProps);
  if (p.contest) {
    // the two contests, as the hero's own switch flips them (its matchup prop)
    const M2 = M.D.latest.rivalLead === "alp_on" ? ["alp_on", "alp_lnp"] : ["alp_lnp", "alp_on"];
    const names = { alp_lnp: "Labor v Coalition", alp_on: "Labor v One Nation" };
    const variants = {};
    for (const m of M2) variants[m] = read(mount({ ...heroProps, matchup: m }));
    return { ...variants[M2[0]], ctl: [{ id: "c", kind: "select", label: "Two-party", opts: M2.map((m) => ({ v: m, l: names[m] })), def: M2[0] }], variants, def: M2[0] };
  }
  const h0 = mount();
  const base = read(h0);
  const ctl = [], variants = {};
  const tabs = p.tabs ? tabsOf(h0.tree, p.tabs) : null;
  if (p.chips) {
    // who votes for whom: every group tab for every party chip
    const chips = chipsOf(h0.tree);
    const t0 = tabs.find((t) => t.on) || tabs[0], c0 = chips.find((c) => c.on) || chips[0];
    ctl.push({ id: "t", kind: "tabs", label: "Group", opts: tabs.map((t) => ({ v: slug(t.l), l: t.l })), def: slug(t0.l) });
    ctl.push({ id: "p", kind: "select", label: "Party", opts: chips.map((c) => ({ v: slug(c.l), l: c.l })), def: slug(c0.l) });
    for (const t of tabs) for (const c of chips) {
      const h = mount();
      if (t !== t0) press(h, isTab(p.tabs, t.l));
      if (c !== c0) press(h, isChip(c.l));
      variants[slug(t.l) + "|" + slug(c.l)] = read(h);
    }
    return { ...base, ctl, variants, def: slug(t0.l) + "|" + slug(c0.l) };
  }
  if (tabs && tabs.length > 1) {
    const t0 = tabs.find((t) => t.on) || tabs[0];
    ctl.push({ id: "t", kind: "tabs", label: base.title, opts: tabs.map((t) => ({ v: slug(t.l), l: t.l })), def: slug(t0.l) });
    for (const t of tabs) {
      const h = mount();
      if (t !== t0) press(h, isTab(p.tabs, t.l));
      variants[slug(t.l)] = read(h);
    }
    if (p.flip) {
      /* the latest polls' two-party contest: the table follows the page's
         matchup (a prop, as the hero's switch sets it), on its two-party tab */
      const k0 = slug(t0.l);
      const other = heroProps.tppMatchup === "alp_on" ? "alp_lnp" : "alp_on";
      const names = { alp_lnp: "Labor v Coalition", alp_on: "Labor v One Nation" };
      const v1 = read(mount({ ...heroProps, tppMatchup: other, matchup: other }));
      ctl.push({ id: "c", kind: "select", label: "Two-party", opts: [{ v: heroProps.tppMatchup, l: names[heroProps.tppMatchup] }, { v: other, l: names[other] }], def: heroProps.tppMatchup, on: k0 });
      const next = {};
      for (const [k, v] of Object.entries(variants)) { next[k + "|" + heroProps.tppMatchup] = v; next[k + "|" + other] = k === k0 ? v1 : k + "|" + heroProps.tppMatchup; }
      return { ...base, ctl, variants: next, def: k0 + "|" + heroProps.tppMatchup };
    }
    return { ...base, ctl, variants, def: slug(t0.l) };
  }
  return { ...base, ctl: [], variants: { "": base }, def: "" };
}

export function retroNow({ root, dataset, shellPages, footer, siteUrl = "https://auspoltracker.com/", runner }) {
  const M = runner || modernRunner({ root, clock: dataClock(dataset) });
  // the page opens on the headline's contest, as the modern App does (latest.rivalLead)
  const m0 = M.D.latest.rivalLead === "alp_on" ? "alp_on" : "alp_lnp";
  const heroProps = { rangeId: "all", setRangeId() {}, showScatter: true, matchup: m0, setMatchup() {}, basis: "imp", setBasis() {},
    tppBasis: "imp", setTppBasis() {}, tppMatchup: m0, setTppMatchup() {} };
  const panels = PANELS.map((p) => ({ id: p.id, view: p.view, ...harvestPanel(M, p, heroProps) }));
  const L = M.D.latest;
  // draw every panel's opening view into the page; the client draws the rest
  const ctx = vm.createContext({ window: {}, console });
  vm.runInContext(read("render.client.js"), ctx, { filename: "render.client.js" });
  const RR = ctx.window.RT_R;
  const body = (p) => { RR.resetIds(); return RR.blocks((p.variants[p.def] || p).blocks, { idp: p.id + "-" }); };
  const main = NOW_VIEWS.map((v) => `<div class="rp-view" data-view="${v.id}" id="rp-v-${v.id}" role="tabpanel" aria-labelledby="rp-t-${v.id}">\n`
    + panels.filter((p) => p.view === v.id).map((p) => panelHTML(p, body(p), ctlHTML(p))).join("\n")
    + `\n</div>`).join("\n");
  const meta = `Aggregated opinion polling for the next federal election · ${L.pollsTracked} polls from ${L.housesTracked} pollsters, updated ${L.updated}`;
  const data = { built: L.publishedISO, clock: M.win.Date.now(), panels: panels.map((p) => ({ id: p.id, title: p.title, meta: p.meta, ctl: p.ctl, variants: p.variants, def: p.def })) };
  const html = retroPage({
    here: "/retro/", modern: "/", canonical: "", siteUrl, shellPages, footer,
    title: "Now", meta, views: NOW_VIEWS, def: "vote", main, data,
    notes: [
      { h: "The modern page in old clothes", html: "Every headline, figure and chart here is the modern front page’s own, read from it each time the site is built and drawn the way a website of about 2000 would have drawn it. Where a modern section switches between views, its panel here offers the same switch." },
      { h: "More in the modern view", html: `The modern page adds tooltips and time ranges to its charts, the primary vote by pollster or group of voters, and each latest poll opened in full. <a href="/allpolls/retro/">All polls</a> and <a href="/cycles/retro/">Past cycles</a> have retro views too, and so does <a href="/map/#retro=1">the Electoral map</a>.` },
    ],
    desc: "auspol tracker’s front page in the dress of a website from about 2000: the two-party and primary vote, the latest polls, the leaders, who votes for whom, the issues and the national mood, with the modern page’s own figures.",
  });
  return { html, data, panels };
}
