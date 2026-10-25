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
const part = (f) => R(".build/map/app/" + f);
const js = ["app-1-base.js", "app-2-map.js", "app-3-chamber.js", "app-4-story.js", "app-5-list.js", "app-6-ui.js"].map(part).join("\n");
assert.equal(R("map/map.js"), `/* the Election map – assembled from .build/map/app by .build/map/assemble.mjs; edit the parts, not this file */\n(() => {\n${js}\n})();\n`, "map/map.js is current (node .build/map/assemble.mjs)");
assert.equal(R("map/map.css"), part("page.css"), "map/map.css is current (node .build/map/assemble.mjs)");
for (const y of [2004, 2007, 2010, 2013, 2016, 2019, 2022, 2025]) {
  for (const f of [`res-${y}.json`, `geo-${y}-lo.json`, `geo-${y}-hi.json`]) assert.ok(fs.existsSync(path.join(ROOT, "map", "data", f)), "map/data/" + f);
}
const now = JSON.parse(R("map/data/data-now.json"));
assert.ok(now.byelections && now.byelections.Farrer && now.holders.Farrer, "the Now overlay carries the Farrer by-election");
assert.ok(/<loc>https:\/\/auspoltracker\.com\/map\/<\/loc>/.test(R("sitemap.xml")), "the sitemap lists /map/");
assert.ok(!/(?:href=|href:\s*)"(?:https:\/\/auspoltracker\.com)?\/(?:prediction|atlas|vic)\//.test(page), "the map links none of the unlisted pages");

console.log("PASS: map page – an ext menu page outside the main build, linked in both designs and the shell, two-column menus, assembled assets current, data present, in the sitemap");
