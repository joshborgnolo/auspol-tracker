/* test-retro-allpolls.mjs – pins the retro All polls page (/allpolls/retro/,
   .build/retro/allpolls.mjs): the committed page is what the build writes
   from the committed dataset; every figure is the dataset's, read through
   the modern table's formulas (rows, leans, month lines, today's figures and
   head); the renderer's filters, sorts, links and phone columns; the page
   is the retro map's twin (shared chrome and Favorites, linked both ways)
   and is linked from nowhere else; and every data commit carries it
   (SITE_FILES). The browser half is driven by .matilda/probe/allpolls-retro.mjs. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { retroAllPolls } from "./retro/allpolls.mjs";
import { shellPages, mainChrome } from "./site-shell.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const R = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const dataset = R(".build/newtracker/assets/9f09dca2-bd46-49a8-8ae1-51847608cf92.js");
const grab = (name) => {
  const i = dataset.indexOf("const " + name + " = ");
  return JSON.parse(dataset.slice(i + name.length + 9, dataset.indexOf("\n", i)).replace(/;$/, ""));
};
const L = grab("latest"), S = grab("synthLatest"), P = grab("individualPolls");
const { html, data: D } = retroAllPolls({ dataset, shellPages: shellPages(), footer: mainChrome().footer, built: L.publishedISO });

// ---- the committed page is the build's, from the committed dataset ------------------------
assert.equal(R("allpolls/retro/index.html"), html, "allpolls/retro/index.html is current – run node .build/newtracker/build.mjs and commit it");
assert.ok(/if \(!VIC\) \{\n  const \{ retroAllPolls \} = await import\("\.\.\/retro\/allpolls\.mjs"\);/.test(R(".build/newtracker/build.mjs")), "build.mjs writes it on the federal build only (/vic/ has no retro map)");
assert.ok(/SITE_FILES=\([\s\S]*?allpolls\/retro\/index\.html[\s\S]*?\)/.test(R(".build/git-push-main.sh")), "SITE_FILES commits allpolls/retro/index.html (every data refresh rewrites it)");

// ---- every figure is the dataset's ------------------------------------------------------
assert.equal(D.rows.length, P.length, "one row per poll in individualPolls");
const r1 = (v) => Math.round(v * 10) / 10;
P.forEach((p, i) => {
  const r = D.rows[i], q = p.p || {};
  assert.equal(r.h, p.pollster);
  assert.equal(r.imp.lnp, p.alpImp != null ? p.alpImp : null, `${p.pollster} ${p.field}: the implied figure is the dataset's`);
  assert.equal(r.imp.on, p.alpOnImp != null ? p.alpOnImp : null);
  assert.deepEqual(r.p, { alp: q.alp, lnp: q.lnp, grn: q.grn, onp: q.onp, oth: q.oth });
  assert.deepEqual(r.pb.lnp, p.alp != null && p.lnp != null ? [p.alp, p.lnp] : null, "the published pair as printed");
  // a lean is the figure less the yardstick average as printed (rd-allpolls.jsx rdApLeanFor), the house lean rdApHe's
  const y = p.yd && p.yd.imp;
  assert.equal(r.ln.lnp, p.alpImp != null && y && y.v != null ? +(p.alpImp - r1(y.v)).toFixed(1) : null, `${p.pollster} ${p.field}: lean`);
  assert.equal(r.hl.lnp, y && y.he != null ? r1(y.he) : null, `${p.pollster} ${p.field}: house lean`);
  assert.equal(!!r.na, !!p.noAgg, "a row outside the aggregates is marked");
});
// today's figures quote the headline exactly (figures-built-like-headline), and the page prints them
assert.deepEqual(D.today.lnp, { a: S.alp, b: S.lnp }, "today's two-party figure is synthLatest's");
assert.deepEqual(D.prim.map((x) => x.v), L.primaryOrder.map((id) => L.primary[id]), "the first preferences are latest.primary, in the site's order");
assert.ok(html.includes(`<b class="ap-k-alp">${S.alp.toFixed(1)}</b>`) && html.includes(`${S.lnp.toFixed(1)}</b>`), "the page prints today's pair");
// the head is rdApTppStory's: the polls fielded in the estimator's window, their count and range
{
  const upd = Date.parse(L.updatedISO + "T00:00:00Z"), win = (L.method && L.method.windowDays) || 21;
  const inWin = P.filter((p) => { const t = p.mid != null ? p.mid : Date.parse(p.released + "T00:00:00Z"); return t >= upd - win * 864e5 && t <= upd && p.alpImp != null; });
  const lo = Math.min(...inWin.map((p) => p.alpImp)).toFixed(1), hi = Math.max(...inWin.map((p) => p.alpImp)).toFixed(1);
  const words = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
  const want = `Labor’s ${S.alp.toFixed(1)} comes from ${words[inWin.length] || inWin.length} poll${inWin.length === 1 ? "" : "s"}` + (inWin.length === 1 ? "" : lo === hi ? `, which all put Labor on ${lo}` : `, which range from ${lo} to ${hi}`) + ".";
  assert.equal(D.head.lnp, want, "today's head, the modern 2PP head's rule");
  assert.equal(D.rows.filter((r) => r.tw & 1).length, inWin.length, "the rows in today's figure are the window's");
}
// the month rows quote the monthly lines (the modern month rows' monthAvg: the month's own estimate last)
for (const d of grab("synth2pp")) if (d.alp != null && grab("synth2pp").filter((x) => x.ym === d.ym).pop() === d) assert.equal(D.months[d.ym].imp.lnp, d.alp, `${d.ym}: the implied month line`);
for (const d of grab("aggPrimary")) assert.equal(D.months[d.ym].prim.alp, d.alp, `${d.ym}: the month's primary vote`);

// ---- the renderer ---------------------------------------------------------------------------
const ctx = vm.createContext({ window: {}, console });
vm.runInContext(R(".build/retro/allpolls.client.js"), ctx);
const RA = ctx.window.RT_AP;
// (the renderer's objects come from the sandbox's realm: compare them as plain data)
const plain = (x) => JSON.parse(JSON.stringify(x));
assert.ok(RA && typeof RA.bodyHTML === "function", "the client loads in node without its browser half");
const st0 = RA.defaults(D);
const V0 = RA.view(D, st0);
assert.equal(V0.rows.length, P.length, "unfiltered, every poll shows");
for (let i = 1; i < V0.rows.length; i++) assert.ok(V0.rows[i - 1].pt >= V0.rows[i].pt, "newest released first");
assert.deepEqual(plain(V0.groups.map((g) => g.ym)), [...new Set(V0.rows.map((r) => r.pym))], "grouped by the month released");
const body = RA.bodyHTML(D, st0, V0, null, Date.parse(D.built + "T00:00:00Z"));
assert.equal((body.match(/<tr class="ap-r/g) || []).length, P.length, "a row per poll");
assert.equal((body.match(/<tr class="ap-m"/g) || []).length, V0.groups.length, "a band per month");
assert.ok(html.includes(body), "the page as built is the renderer's default view");
// ties on release day go by fieldwork (Resolve's 2–7 Nov over RedBridge's 2–6 Nov, both out 8 Nov 2026, as the modern table)
for (let i = 1; i < V0.rows.length; i++) if (V0.rows[i - 1].pt === V0.rows[i].pt) assert.ok(V0.rows[i - 1].x >= V0.rows[i].x, "a release-day tie: the later fieldwork first");
// the filters
const pick = D.houses[1].h;
assert.ok(RA.view(D, { ...st0, h: new Set([pick]) }).rows.every((r) => r.b === pick), "the pollster checklist keeps its houses");
{
  const V = RA.view(D, { ...st0, t: "3" }), [y, m, d] = D.newestField.split("-").map(Number), cut = Date.UTC(y, m - 4, d);
  assert.ok(V.rows.length > 0 && V.rows.length < P.length && V.rows.every((r) => Date.parse(r.fe + "T00:00:00Z") >= cut), "the last 3 months, counted back from the newest fieldwork");
}
assert.ok(RA.view(D, { ...st0, q: "resolve" }).rows.every((r) => /resolve/i.test(r.h)), "find matches names");
assert.ok(RA.view(D, { ...st0, q: "not counted" }).rows.every((r) => r.na), "find matches the flags");
// a sort by a figure drops the month bands and sinks the rows without it
{
  const V = RA.view(D, { ...st0, s: { k: "lean", d: -1 } });
  assert.equal(V.groups, null, "no month bands off the date sorts");
  const vals = V.rows.map((r) => r.ln.lnp), first = vals.indexOf(null);
  assert.ok(first < 0 || vals.slice(first).every((v) => v == null), "rows without a lean sink");
  for (let i = 1; i < (first < 0 ? vals.length : first); i++) assert.ok(vals[i - 1] >= vals[i], "largest lean first");
}
// the link round-trips the view; the defaults ride no hash
assert.equal(RA.toHash(D, st0), "", "the page as it opens has no hash");
for (const st of [{ ...st0, m: "pri" }, { ...st0, m: "ld", h: new Set(["Resolve", "Wolf & Smith"]), t: "6w" }, { ...st0, c: D.rival === "lnp" ? "on" : "lnp", q: "Nov 2026", s: { k: "pb", d: 1 } }]) {
  const back = RA.fromHash(D, "#" + RA.toHash(D, st));
  assert.deepEqual(plain({ ...back, h: back.h ? [...back.h].sort() : null }), plain({ ...st, h: st.h ? [...st.h].sort() : null }), "the hash round-trips " + RA.toHash(D, st));
}
assert.equal(RA.fromHash(D, "#h=Nobody&m=zzz&s=bogus.d").h, null, "an unknown pollster, tab or sort falls back");
// a phone folds when and how many under the name, and drops the strip
{
  const ph = { ...st0, ph: true }, head = RA.headHTML(D, ph);
  assert.ok(!/class="c-[fns]/.test(head) && RA.ncols(D, ph) === 5, "a phone's two-party table: pollster, implied, published, lean, house lean");
  assert.ok(/class="ap-phs"/.test(RA.bodyHTML(D, ph, V0, null, 0)), "a phone's pollster cell carries the dates and sample");
}
// the CSV: a head and a line per poll in view
assert.equal(RA.csv(D, st0, V0).trim().split("\r\n").length, P.length + 1, "the CSV holds every poll in view");

// ---- the page: its links, its look, and nothing pretending to be a browser ---------------
const json = html.match(/<script type="application\/json" id="ap-data">([\s\S]*?)<\/script>/)[1];
assert.ok(!/<\/script/i.test(json) && JSON.parse(json).rows.length === P.length, "the data block parses and can't close its script early");
assert.ok(html.includes(`<link rel="canonical" href="https://auspoltracker.com/allpolls/">`), "its canonical is the modern All polls page");
assert.ok(html.includes(R(".build/retro/chrome.css")) && R("map/map.css").includes(R(".build/retro/chrome.css")), "the page and the retro map wear the one chrome");
// the chrome's own inks survive a page's era link colours (allpolls.css's bare a:visited outranks a lone class and loads after chrome.css): navbar, kicker and menu links declare their visited inks (was the purple-kicker bug of 2026-11-09)
{
  const chrome = R(".build/retro/chrome.css");
  for (const [sel, ink] of [[".rt-nav .rt-ni:visited, .rt-pages a:visited", "#fff"], [".rt-kicker:visited", "#ffd94a"], [".rt-drop a:visited", "#000"]])
    assert.ok(chrome.includes(`${sel} { color: ${ink}; }`), `the chrome's links hold ${ink} when visited (${sel}) – a page's bare a:visited must never recolour the shared chrome`);
}
assert.ok(html.includes('<a href="/allpolls/retro/" aria-current="page">All polls</a>'), "the navbar marks this page");
assert.ok(D.pages.more.some((p) => p.label === "Electoral map" && p.href === "/map/#retro=1"), "the Electoral map opens in its retro view");
assert.ok(D.pages.tabs.every((p) => p.href !== "/") && D.pages.tabs.some((p) => p.href === "/cycles/"), "the bar's views but Now (the navbar's Home)");
assert.ok(/data-rt-menu="edit"[\s\S]*data-rt-menu="view"[\s\S]*data-rt-menu="fav"[\s\S]*data-rt-menu="help"/.test(html), "Edit, View, Favorites and Help, as on the retro map");
assert.ok(!/rt-titlebar|rt-menubar|rt-toolbar|rt-address|rt-status|rt-taskbar|rt-start/.test(html), "no pretend browser or desktop");
assert.ok(!/text-transform:\s*uppercase/i.test(html), "no small caps");
assert.ok(R(".build/retro/allpolls.client.js").includes('FAV_KEY = "auspol.map.favs"') && R(".build/retro/allpolls.client.js").includes("list.unshift({ t: favLabel(), h, p: HERE });"), "Favorites are the retro map's list, this page's entries carrying their page");
// linked from the retro map's navbar and from nowhere else (the map's script, and the page itself)
assert.ok(R("map/map.js").includes('const RT_TWIN = { "/allpolls/": "/allpolls/retro/" };'), "the retro map's navbar opens it");
assert.ok(!R("sitemap.xml").includes("allpolls/retro"), "not in the sitemap");
{
  const htmls = [];
  const walk = (dir) => { for (const f of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    if (f.name.startsWith(".") || f.name === "node_modules" || f.name === "worktrees-seifa-land") continue;
    const rel = path.join(dir, f.name);
    if (f.isDirectory()) walk(rel); else if (f.name.endsWith(".html")) htmls.push(rel);
  } };
  walk(".");
  const linking = htmls.filter((f) => path.normalize(f) !== path.normalize("allpolls/retro/index.html") && R(f).includes("/allpolls/retro/"));
  assert.deepEqual(linking, [], "no other page links it");
}

console.log(`PASS: retro All polls – ${P.length} polls current with the dataset, today's figures and head as the headline's, month lines, filters, sorts, hash, phone columns, CSV, the retro map's twin, unlisted, in SITE_FILES`);
