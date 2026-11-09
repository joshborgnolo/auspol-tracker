/* test-retro-pages.mjs – pins the retro Now and Past cycles pages (/retro/,
   /cycles/retro/: .build/retro/now.mjs, cycles.mjs, harvest.mjs,
   blocks.mjs, render.client.js, pages.client.js).

   - The committed pages are what the build writes from the committed tree
     (the modern tab documents and scripts the harvest runs).
   - Their figures are the modern page's, which are the dataset's: the
     two-party pair, the primaries, preferred PM, the national mood, the
     scorecard's two-party row and the final polls' average miss are
     checked against the dataset's own tables.
   - Every panel's every view renders, the controls name views that exist,
     and the charts carry their series.
   - The pages are the retro family's: linked from the retro map's, the
     retro All polls page's and each other's navbars and from nowhere else,
     canonical to their modern pages, out of the sitemap, in SITE_FILES.
   The browser half is driven by .matilda/probe/retro-pages.mjs. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { modernRunner, dataClock } from "./retro/harvest.mjs";
import { retroNow } from "./retro/now.mjs";
import { retroCycles } from "./retro/cycles.mjs";
import { shellPages, mainChrome } from "./site-shell.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const R = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const dataset = R(".build/newtracker/assets/9f09dca2-bd46-49a8-8ae1-51847608cf92.js");
const grab = (name) => { const i = dataset.indexOf("const " + name + " = "); return JSON.parse(dataset.slice(i + name.length + 9, dataset.indexOf("\n", i)).replace(/;$/, "")); };
const L = grab("latest"), S = grab("synthLatest"), LN = grab("leaderNow"), DN = grab("directionNow"), ACC = grab("accuracy");

let runner;
try { runner = modernRunner({ root: ROOT, clock: dataClock(dataset) }); }
catch (e) { assert.fail(`the modern page no longer runs in the harvest (${e.message}) – mend .build/retro/harvest.mjs`); }
const footer = mainChrome().footer;
const now = retroNow({ root: ROOT, dataset, shellPages: shellPages(), footer, runner });
const cyc = retroCycles({ root: ROOT, dataset, shellPages: shellPages(), footer, runner });

// ---- the committed pages are the build's ----------------------------------------------------
assert.equal(R("retro/index.html"), now.html, "retro/index.html is current – run node .build/newtracker/build.mjs and commit it");
assert.equal(R("cycles/retro/index.html"), cyc.html, "cycles/retro/index.html is current – run node .build/newtracker/build.mjs and commit it");
const build = R(".build/newtracker/build.mjs");
assert.ok(build.includes('const { retroNow } = await import("../retro/now.mjs");') && build.includes('const { retroCycles } = await import("../retro/cycles.mjs");'), "build.mjs writes both pages (block 5a'')");
assert.ok(build.indexOf("5a''. the retro Now and Past cycles pages") > build.indexOf("for (const t of tabs) {"), "after the tab documents the harvest reads");
assert.ok(/SITE_FILES=\([\s\S]*?retro\/index\.html cycles\/retro\/index\.html[\s\S]*?\)/.test(R(".build/git-push-main.sh")), "SITE_FILES commits both pages");
assert.ok(R("package.json").includes("node .build/test-retro-pages.mjs"), "npm test runs this test");

// ---- the figures are the modern page's, which are the dataset's -------------------------------
const P = (pages, id) => pages.panels.find((p) => p.id === id);
const opening = (p) => { let v = p.variants[p.def]; while (typeof v === "string") v = p.variants[v]; return v; };
const block = (p, k) => opening(p).blocks.find((b) => b.k === k);
{
  const tpp = block(P(now, "tpp"), "tpp");
  const on = L.rivalLead === "alp_on";
  const pair = on ? [L.onImp.a, L.onImp.b] : [S.alp, S.lnp];
  assert.deepEqual([tpp.a.v, tpp.b.v], pair.map((v) => v.toFixed(1)), "the hero's pair is the headline (synthLatest, or the One Nation contest when it leads)");
  assert.equal(tpp.a.name, "Labor");
  assert.ok(tpp.gauge && Math.abs(tpp.gauge.lead - (pair[0] - pair[1])) < 0.06, "the gauge's lead is the pair's");
  const other = P(now, "tpp").variants[on ? "alp_lnp" : "alp_on"].blocks.find((b) => b.k === "tpp");
  assert.deepEqual([other.a.v, other.b.v], (on ? [S.alp, S.lnp] : [L.onImp.a, L.onImp.b]).map((v) => v.toFixed(1)), "the other contest's pair");
  const pv = block(P(now, "primary"), "pvstats");
  const NAME = { alp: "Labor", lnp: "Coalition", grn: "Greens", onp: "One Nation", oth: "Others & independents" };
  assert.deepEqual(pv.stats.map((s) => [s.name, s.v]), L.primaryOrder.map((id) => [NAME[id], L.primary[id].toFixed(1)]), "the primary votes are latest.primary, in the site's order");
  const hb = block(P(now, "leaders"), "hbars").bars[0];
  assert.deepEqual([hb.a.v, hb.b.v], [LN.alb_pref.v.toFixed(1), LN.taylor_pref.v.toFixed(1)], "preferred PM, head to head, is leaderNow's");
  // Leaders' two tab strips (Preferred PM, Net approval), every pairing; the three-way bar's three shares
  const ld = P(now, "leaders");
  assert.equal(ld.ctl.length, 2, "Leaders offers both of the modern section's tab strips");
  assert.equal(Object.keys(ld.variants).length, ld.ctl[0].opts.length * ld.ctl[1].opts.length, "every pairing of the two strips");
  const three = ld.variants[ld.ctl[0].opts.find((o) => /three/i.test(o.v)).v + "|" + ld.ctl[1].def].blocks.find((b) => b.k === "hbars").bars[0];
  const want3 = [["Albanese", LN.alb_pref3.v], ["Hanson", LN.hanson_pref3.v], ["Taylor", LN.taylor_pref3.v]].sort((x, y) => y[1] - x[1]);
  assert.deepEqual(three.segs.map((g) => [g.name, g.v]), want3.map(([n, v]) => [n, v.toFixed(1)]), "the three-way bar: all three leaders, leaderNow's three-way shares");
  const dir = block(P(now, "mood"), "dir");
  assert.deepEqual(dir.figs.map((f) => f.v), [DN.right.toFixed(1), DN.wrong.toFixed(1)], "the national mood is directionNow's");
  const cs = block(P(cyc, "measures"), "cs").groups[0].rows[0];
  assert.equal(cs.now, (on ? L.onImp.a : S.alp).toFixed(1) + "%", "the scorecard's two-party row quotes the headline");
  /* every scorecard row opens to every term ranked at this point, in every
     Compare with / Measure view: as many terms as its own head counts, this
     term among them at the row's own figure, and the records beside them */
  for (const [k, v] of Object.entries(P(cyc, "measures").variants)) {
    for (const row of v.blocks.find((b) => b.k === "cs").groups.flatMap((g) => g.rows)) {
      const o = row.open;
      assert.ok(o && o.rows.length > 1, `Past cycles · ${k} · ${row.name}: opens to its ranking`);
      const n = +((/(\d+) terms/.exec(o.head) || [])[1]);
      assert.equal(o.rows.length, n, `Past cycles · ${k} · ${row.name}: the ranking lists the ${n} terms its head counts`);
      const cur = o.rows.filter((x) => x.cur);
      assert.ok(cur.length === 1 && cur[0].v === row.now.replace(/%$/, ""), `Past cycles · ${k} · ${row.name}: this term ranked at the row's own figure`);
      assert.ok(o.rows.every((x, i) => +x.n === i + 1), `Past cycles · ${k} · ${row.name}: ranked in order`);
      assert.ok(o.recs.length >= 1 && o.recs.every((g) => g.rows.length), `Past cycles · ${k} · ${row.name}: its records`);
    }
  }
  {
    const c2 = vm.createContext({ window: {}, console });
    vm.runInContext(R(".build/retro/render.client.js"), c2);
    const R2 = c2.window.RT_R;
    const v0 = P(cyc, "measures").variants[P(cyc, "measures").def];
    const shut = R2.blocks(v0.blocks, { idp: "m-" }), open = R2.blocks(v0.blocks, { idp: "m-", open: 0 });
    assert.ok(!/class="rp-csopen"/.test(shut) && /class="rp-csopen"/.test(open) && /data-csrow="0"[^>]*aria-expanded="true"/.test(open), "a scorecard row draws its ranking only when opened");
  }
  const tiles = block(P(cyc, "final"), "tiles").tiles;
  assert.equal(tiles[0].v, ACC.meanAbs.toFixed(1) + " pts", "the final polls' average miss is the accuracy record's");
}

// ---- every panel, every view -------------------------------------------------------------------
const ctx = vm.createContext({ window: {}, console });
vm.runInContext(R(".build/retro/render.client.js"), ctx);
const RR = ctx.window.RT_R;
assert.ok(RR && typeof RR.blocks === "function" && typeof RR.chart === "function", "the drawing half loads in node without its browser half");
for (const [name, pages, tool] of [["Now", now, []], ["Past cycles", cyc, cyc.data.tool]]) {
  for (const p of pages.panels) {
    const v0 = opening(p);
    assert.ok(v0 && v0.blocks.length, `${name} · ${p.id}: an opening view`);
    assert.ok(v0.blocks.some((b) => b.k === "hed" || b.k === "polls"), `${name} · ${p.id}: the modern section's headline (or its table) came through`);
    const ctls = (p.keys || p.ctl.map((c) => c.id)).map((id) => p.ctl.find((c) => c.id === id) || tool.find((c) => c.id === id));
    assert.ok(ctls.every(Boolean), `${name} · ${p.id}: every key names a control`);
    // every combination of its controls has a view (or an alias to one)
    const combos = ctls.reduce((acc, c) => acc.flatMap((k) => c.opts.map((o) => (k == null ? o.v : k + "|" + o.v))), [null]).map((k) => (k == null ? "" : k));
    for (const k of combos) {
      let v = p.variants[k];
      for (let i = 0; typeof v === "string" && i < 4; i++) v = p.variants[v];
      assert.ok(v && Array.isArray(v.blocks), `${name} · ${p.id}: the view ${JSON.stringify(k)} exists`);
      RR.resetIds();
      const html = RR.blocks(v.blocks, { idp: p.id + "-" });
      assert.ok(html.length > 200, `${name} · ${p.id} · ${k}: draws`);
      for (const b of v.blocks.filter((x) => x.k === "chart")) assert.ok(b.spec && b.spec.series.length + b.spec.areas.length > 0, `${name} · ${p.id} · ${k}: the chart "${b.title}" carries its lines`);
    }
  }
}
// the views a control picks really differ where the modern page's do (the contest, a party, a comparison)
assert.notDeepEqual(P(now, "tpp").variants.alp_lnp, P(now, "tpp").variants.alp_on, "the two contests draw differently");
assert.notEqual(P(now, "who").variants["age|one-nation"].blocks.find((b) => b.k === "hed").t, P(now, "who").variants["age|labor"].blocks.find((b) => b.k === "hed").t, "who votes: each party its own headline");
{
  const c = P(cyc, "leaders").variants;
  assert.notEqual(c["all-past-terms|level"].blocks.find((b) => b.k === "hed").t, c["ousted|level"].blocks.find((b) => b.k === "hed").t, "Past cycles: a comparison set re-words the finding, as the modern page does");
}
assert.doesNotThrow(() => new Function(R(".build/retro/pages.client.js")), "the browser half parses");
// a group box's caption masks the frame behind it (its white inner line is a shadow across the whole top edge, so a bare caption had the line through its words)
assert.ok(/fieldset legend \{[^}]*background: var\(--rt-face\)/.test(R(".build/retro/pages.css")) && /fieldset\.rp-rec legend \{ background: #ffffe1; \}/.test(R(".build/retro/pages.css")), "group-box captions sit on their own ground, so no frame line runs through them");

// ---- the pages: the retro family's, linked only from it ---------------------------------------
for (const [file, html, here, canon, title] of [["retro/index.html", now.html, "/retro/", "", "Now"], ["cycles/retro/index.html", cyc.html, "/cycles/retro/", "cycles/", "Past cycles"]]) {
  assert.ok(html.includes(`<link rel="canonical" href="https://auspoltracker.com/${canon}">`), `${file}: canonical is the modern page`);
  assert.ok(html.includes(`<h1 class="rt-btitle">${title}</h1>`), `${file}: the banner names the page`);
  assert.ok(html.includes('<a class="rt-ni" href="/retro/" title="auspol tracker’s home page"') && html.includes('<a class="rt-kicker" href="/retro/">'), `${file}: Home and the banner open the retro Now page`);
  assert.ok(html.includes('href="/allpolls/retro/"') && html.includes("/map/#retro=1"), `${file}: the navbar opens the retro All polls page and the retro map`);
  if (here === "/cycles/retro/") assert.ok(html.includes('<a href="/cycles/retro/" aria-current="page">Past cycles</a>'), `${file}: the navbar marks the page`);
  else assert.ok(html.includes('href="/retro/" title="auspol tracker’s home page" aria-current="page"') && html.includes('<a href="/cycles/retro/">Past cycles</a>'), `${file}: Home is this page; Past cycles opens its twin`);
  assert.ok(html.includes(R(".build/retro/chrome.css")), `${file}: wears the retro chrome every retro page wears`);
  assert.ok(/data-rt-menu="edit"[\s\S]*data-rt-menu="view"[\s\S]*data-rt-menu="fav"[\s\S]*data-rt-menu="help"/.test(html), `${file}: Edit, View, Favorites and Help`);
  assert.ok(html.includes('data-rp="modern"'), `${file}: Modern view, the way back`);
  assert.ok(!/rt-titlebar|rt-menubar|rt-toolbar|rt-address|rt-status|rt-taskbar|rt-start/.test(html), `${file}: no pretend browser or desktop`);
  assert.ok(!/text-transform:\s*uppercase|small-caps/i.test(html), `${file}: no small caps`);
  const json = html.match(/<script type="application\/json" id="rp-data">([\s\S]*?)<\/script>/)[1];
  assert.ok(!/<\/script/i.test(json) && JSON.parse(json).panels.length >= 5, `${file}: the data block parses and can't close its script early`);
}
assert.ok(R(".build/retro/pages.client.js").includes('const FAV_KEY = "auspol.map.favs"') && R(".build/retro/pages.client.js").includes("list.unshift({ t: favLabel(), h, p: HERE });"), "Favorites are the retro map's list, these pages' entries carrying their page");
assert.ok(R("map/map.js").includes('const RT_TWIN = { "/": "/retro/", "/cycles/": "/cycles/retro/", "/allpolls/": "/allpolls/retro/" };'), "the retro map's navbar opens them");
assert.ok(R("allpolls/retro/index.html").includes('<a href="/cycles/retro/">Past cycles</a>') && R("allpolls/retro/index.html").includes('href="/retro/"'), "the retro All polls page's navbar opens them");
const sitemap = R("sitemap.xml");
assert.ok(!/\/retro\//.test(sitemap), "neither is in the sitemap");
{
  const htmls = [];
  const walk = (dir) => { for (const f of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    if (f.name.startsWith(".") || f.name === "node_modules" || f.name === "worktrees-seifa-land") continue;
    const rel = path.join(dir, f.name);
    if (f.isDirectory()) walk(rel); else if (f.name.endsWith(".html")) htmls.push(rel);
  } };
  walk(".");
  const FAMILY = ["allpolls/retro/index.html", "retro/index.html", "cycles/retro/index.html"].map((f) => path.normalize(f));
  const linking = htmls.filter((f) => !FAMILY.includes(path.normalize(f)) && /["'(]\/(cycles\/)?retro\//.test(R(f)));
  assert.deepEqual(linking, [], "no page outside the retro family links them");
}

const nv = now.panels.reduce((n, p) => n + Object.keys(p.variants).length, 0), cv = cyc.panels.reduce((n, p) => n + Object.keys(p.variants).length, 0);
console.log(`PASS: retro Now (${now.panels.length} panels, ${nv} views) and Past cycles (${cyc.panels.length} panels, ${cv} views) – current with the modern pages, figures the dataset's, every view drawn, the retro family's, unlisted, in SITE_FILES`);
