/* test-map-page.mjs – pins the Election map (/map/, 2026-10-25) into the site:
   a ☰ menu page OUTSIDE the main build (TABS' ext entry), so
   - the main page's TABS lists it as a menu page with ext, and keeps it out
     of every view of its own: the paths, the page turn, the menu-page view,
     the build's tab documents, and /vic/'s menu;
   - the menu links it at /map/ in both designs and in the shell, and the
     map page's own shell marks its row current and names the button;
   - the menu splits into two column sheets from 1060px in the main page and
     the shell alike;
   - the page loads its own assembled script, styles and data (assemble.mjs
     output current), and the sitemap lists it.
   Run after a build: node .build/test-map-page.mjs */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { SHELL_PAGES, shellHeader, shellCss, shellJs } from "./site-shell.mjs";
import { dataStamps, stampData } from "./map/data-stamp.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const R = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const app = R(".build/newtracker/assets/73de0c58-f11f-4793-9f90-77e583ab051b.js");
const views = R(".build/newtracker/assets/d1a1d215-370c-4ebc-878b-7eeea9ad8102.js");

// ---- TABS: a menu page with ext, never a view of the main page
assert.ok(app.includes('{ id: "map", label: "Election map", menu: true, ext: true,'), "TABS lists the map as an ext menu page");
assert.ok(app.includes("const TAB_IDS = TABS.filter((t) => !t.ext).map((t) => t.id);"), "no path of the main page is the map's");
assert.ok(app.includes("TABS.filter((t) => t.menu && !t.ext)"), "no menu-page view for the map");
assert.equal((app.match(/const ids = TAB_IDS;/g) || []).length, 2, "the swipe and the arrow keys turn only the main page's own pages");
assert.ok(app.includes('if (window.JUR) TABS.splice(TABS.findIndex((t) => t.id === "map"), 1);'), "/vic/'s menu never holds the map");
const build = R(".build/newtracker/build.mjs");
assert.ok(!/\{ id: "map", label:/.test(build), "build.mjs emits no tab document for the map");

// ---- the menu: an ext row is a plain link to /map/, in both designs
assert.ok(views.includes('const menuHref = (t) => (t.ext ? "/" + t.id + "/"'), "the menu's href for an ext row is its own path");
assert.equal((views.match(/href=\{menuHref\(t\)\}/g) || []).length, 2, "both designs' menus link through menuHref");
assert.ok(views.includes("if ((tabs.find((t) => t.id === id) || {}).ext) { setMenuOpen(false); return; }"), "a click on the map's row follows its link");

// ---- two column sheets from 1060px, main page and shell alike
assert.ok(views.includes("const two = vw >= 1060;") && views.includes('className="tab-menu-col"'), "the main page's menu splits from 1060px");
const rd = R(".build/newtracker/assets/rd.css");
assert.ok(/body\.rd \.tab-menu-pop\.tab-menu-two \{ background: none; border: 0; box-shadow: none; \}/.test(rd) && rd.includes("body.rd .tab-menu-col {"), "each column a sheet of its own (rd.css)");
assert.ok(shellJs().includes("var two = vw >= 1060") && shellJs().includes('"sh-menu-col"'), "the shell's menu splits from 1060px");
assert.ok(shellCss().includes(".sh-menu.sh-menu-two { background: none; border: 0; box-shadow: none; }") && shellCss().includes(".sh-menu-col {"), "each column a sheet of its own (shell)");

// ---- the shell: every satellite's menu links /map/; the map page marks itself
const opts = SHELL_PAGES.find((p) => p.file === "map/index.html");
assert.ok(opts && opts.menu === "map", "map/index.html carries the shell as the map's menu page");
assert.ok(/<a role="menuitem"[^>]*href="\/map\/"[^>]*data-id="map"/.test(shellHeader({})), "the shell's menu links /map/");
const own = shellHeader(opts);
assert.ok(/class="sh-menu-item on" href="\/map\/" data-id="map" aria-current="page"/.test(own), "the map's row is current on its own page");
assert.ok(own.includes('<span class="sh-menu-lab">Election map</span>') && own.includes('aria-label="More pages – on Election map"'), "the button names the page");
assert.ok(!/<span class="sh-menu-lab">Election map/.test(shellHeader({})), "other pages' buttons still say More");

// ---- the page: its assembled script and styles current, its data present, the sitemap
const page = R("map/index.html");
for (const src of ["/map/vendor/d3-7.9.0.min.js", "/map/vendor/topojson-client-3.1.0.min.js", "/map/map.js", "/map/map.css"]) {
  assert.ok(page.includes(src), "the page loads " + src);
  assert.ok(fs.existsSync(path.join(ROOT, src.slice(1))), src + " exists");
}
// the asset URLs carry assemble.mjs's content hash, so a browser cache
// holding an old map.js can't survive a release (phone stuck 2026-10-25)
const hs = (f) => crypto.createHash("sha1").update(fs.readFileSync(path.join(ROOT, "map", f))).digest("hex").slice(0, 8);
assert.ok(page.includes(`src="/map/map.js?v=${hs("map.js")}"`), "the page's map.js URL is stamped with the file's current hash (node .build/map/assemble.mjs)");
assert.ok(page.includes(`href="/map/map.css?v=${hs("map.css")}"`), "the page's map.css URL is stamped with the file's current hash (node .build/map/assemble.mjs)");
// a botched merge resolution ships its markers to the live page (7ae2bbe4's
// rebase landed <<<<<<< HEAD above the footer, 2026-10-26)
assert.ok(!/^(<{7}|={7}|>{7})($| )/m.test(page), "map/index.html carries no git conflict-marker lines");
const part = (f) => R(".build/map/app/" + f);
const js = ["app-1-base.js", "app-2-map.js", "app-3-chamber.js", "app-3b-senate.js", "app-4-story.js", "app-5-list.js", "app-6-ui.js"].map(part).join("\n");
// the script carries every tracked data file's hash, so a release never reads a cached older copy (data-stamp.mjs)
assert.equal(R("map/map.js"), stampData(`/* the Election map – assembled from .build/map/app by .build/map/assemble.mjs; edit the parts, not this file */\n(() => {\n${js}\n})();\n`, dataStamps(ROOT)), "map/map.js is current, its data stamps too (node .build/map/assemble.mjs after rebuilding any map/data file)");
assert.ok(js.includes("const DATA_V = /*@data-stamps*/{};") && js.includes("fetch(v ? `${u}?v=${v}` : u)"), "getJSON asks for each data file by its stamped hash");
assert.equal(R("map/map.css"), part("page.css"), "map/map.css is current (node .build/map/assemble.mjs)");
for (const y of [2004, 2007, 2010, 2013, 2016, 2019, 2022, 2025]) {
  for (const f of [`res-${y}.json`, `geo-${y}-lo.json`, `geo-${y}-hi.json`]) assert.ok(fs.existsSync(path.join(ROOT, "map", "data", f)), "map/data/" + f);
}
// the islands past the mainland frame, drawn in inset boxes (node .build/map/islands_build.mjs)
{
  const isl = JSON.parse(R("map/data/islands.json"));
  assert.deepEqual(isl.islands.map((s) => s.key), ["norfolk", "lordhowe", "christmas", "cocos"], "islands.json holds the four inset islands");
  assert.ok(isl.islands.every((s) => s.rings.length), "every inset island has a coast");
  assert.equal(isl.owner[2025].norfolk, "Bean", "Norfolk Island is in Bean in 2025");
}
const now = JSON.parse(R("map/data/data-now.json"));
assert.ok(now.byelections && now.byelections.Farrer && now.holders.Farrer, "the Now overlay carries the Farrer by-election");
// the chamber seats each year's members where the Parliament's seating plan puts them (node .build/map/seating.mjs)
{
  const cells = new Function(`${part("app-3-chamber.js").match(/@cells-begin[\s\S]*?\*\/([\s\S]*?)\/\* @cells-end/)[1]}; return chamberCells().map((c) => c.id);`)();
  const seated = part("app-1-base.js").match(/const SEATED = new Set\(\[([^\]]*)\]\)/)[1].split(",").map((s) => s.trim().replace(/"/g, ""));
  for (const y of seated) {
    const seats = JSON.parse(R(`map/data/seats-${y}.json`)), res = JSON.parse(R(`map/data/res-${y === "now" ? 2025 : y}.json`));
    const ids = Object.values(seats.at), names = new Set(res.divs.map((d) => d.n));
    assert.equal(ids.length, res.divs.length - 1, `${y}: the seating plan seats every member but the Speaker`);
    assert.equal(new Set(ids).size, ids.length, `${y}: no two members share a seat`);
    assert.ok(Object.keys(seats.at).every((n) => names.has(n)) && !(res.speaker in seats.at), `${y}: the plan's seats are the House's divisions, the Speaker in the chair`);
    assert.ok(ids.every((id) => cells.includes(id)), `${y}: every seat id is one of the chamber's seats`);
  }
}
assert.ok(/<loc>https:\/\/auspoltracker\.com\/map\/<\/loc>/.test(R("sitemap.xml")), "the sitemap lists /map/");
assert.ok(!/(?:href=|href:\s*)"(?:https:\/\/auspoltracker\.com)?\/(?:prediction|atlas|vic)\//.test(page), "the map links none of the unlisted pages");

// a state election's agg holds only its own state (sa26: SA and AUS), so
// buildSearch skips the STATES with no area - a bare m.areas[st].idx threw
// loadYear for sa26 ("That election didn't load. Try again.", 2026-10-26)
{
  const src = part("app-1-base.js");
  const fn = src.match(/function buildSearch\(m\) \{[\s\S]*?\n\}/)[0];
  assert.ok(!/m\.areas\[st\]\.idx/.test(fn), "buildSearch never dereferences a state that has no area");
  const sa = JSON.parse(R("map/data/res-sa26.json"));
  assert.deepEqual(Object.keys(sa.agg), ["AUS", "SA"], "sa26 carries only the SA frame's areas");
}

console.log("PASS: map page – an ext menu page outside the main build, linked in both designs and the shell, two-column menus, assembled assets current, data present, plan years seated by the plan, in the sitemap");
