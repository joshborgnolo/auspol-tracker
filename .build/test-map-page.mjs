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
import { dataStamps, stampData, metaFacts, stampMeta } from "./map/data-stamp.mjs";

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
// one loader tag, once: 6a08ba3f's raced rebase staging shipped the marker
// block's two identical arms and the map's IIFE ran twice on the live page
assert.equal(page.split('src="/map/map.js?v=').length - 1, 1, "the page loads map.js exactly once");
const part = (f) => R(".build/map/app/" + f);
const js = ["app-1-base.js", "app-2-map.js", "app-3-chamber.js", "app-3b-senate.js", "app-4-story.js", "app-5-list.js", "app-6-ui.js"].map(part).join("\n");
// the script carries every tracked data file's hash, so a release never reads a cached older copy (data-stamp.mjs)
assert.equal(R("map/map.js"), stampMeta(stampData(`/* the Election map – assembled from .build/map/app by .build/map/assemble.mjs; edit the parts, not this file */\n(() => {\n${js}\n})();\n`, dataStamps(ROOT)), metaFacts(ROOT)), "map/map.js is current, its data stamps too (node .build/map/assemble.mjs after rebuilding any map/data file)");
// the eyebrow's floor measures every election's real meta line from the facts stamped in (data-stamp.mjs);
// a year the stamp lacks would be left out of the floor, and walking to it would move the map
{
  const F = metaFacts(ROOT), years = (js.match(/const YEARS = \[([^\]]*)\]/) || [, ""])[1].split(",").map((t) => t.trim().replace(/"/g, "")).filter(Boolean);
  assert.ok(years.length >= 10, "YEARS read from app-1-base.js");
  for (const y of years) assert.ok(F.house[y] && F.house[y][0] && F.house[y][1] > 0, `meta facts: the House line for ${y}`);
  for (const y of years.filter((y) => y !== "sa26")) assert.ok(F.senate[y] && F.senate[y][0] && F.senate[y][1] > 0, `meta facts: the Senate line for ${y}`);
  assert.ok(js.includes("const META_FACTS = /*@meta-facts*/{};"), "holdEyebrow reads the stamped meta facts");
}
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
// a timeline year from the DOM is a WORD ("sa26", "now"), never unary-+
// coerced: +g.dataset.year turned "sa26" into NaN and the stop click fetched
// res-NaN.json (404 -> "That election didn't load", 2026-10-26). yearOf keeps
// a word year a word; the /map/ and #y=2025 stop clicks were pinned end-to-end
// with .matilda/sa26-load-probe.mjs
{
  const ui = part("app-6-ui.js");
  assert.ok(!/\+.*dataset\.year/.test(ui), "no +…dataset.year coercion in the UI handlers (word years go through yearOf)");
  assert.ok(part("app-1-base.js").includes("const yearOf = (s) => (YEARS.includes(s) ? s : +s);"), "app-1-base defines the yearOf word-year guard");
  assert.ok(ui.includes("setYear(yearOf(g.dataset.year))"), "the timeline stop click hands setYear a word-year-safe year");
}

// the sa26 frame's census lanes: the People shares ride data/sa26-demo.json
// (.build/map/build_sa26_demo.py) and the advantage indexes ride
// data/sa26-seifa.json (.build/map/build_sa26_seifa.py, ABS SEIFA 2021 SA1
// scores population-weighted onto the same SA1→district join in
// .build/map/sa26/assign-sa1.json). build_sa26_data.py splices both onto the
// division rows; the end-to-end page contract (legend tenths note, story
// decile explainer, picker groups) is probed with .matilda/sa26-demo-probe.mjs
{
  const sa = JSON.parse(R("map/data/res-sa26.json"));
  assert.equal(sa.demoBasis, "sa1", "sa26 records the SA1 census basis");
  assert.ok(!("incomeCuts" in sa) && !("seifaCuts" in sa), "sa26 carries no income/SEIFA distribution cuts (its booths have no census lane)");
  const DMK = ["lang", "a65", "a2034", "fborn", "uni", "blue"], IXS = ["irsad", "irsd", "ier", "ieo"];
  for (const d of sa.divs) {
    assert.ok(d.demo && DMK.every((k) => typeof d.demo[k] === "number") && typeof d.demo.p === "number" && typeof d.demo.n === "number", `${d.n}: demo row`);
    for (const ix of IXS) {
      const c = d.seifa && d.seifa[ix];
      assert.ok(c && typeof c.v === "number" && typeof c.pct === "number" && c.dec >= 1 && c.dec <= 10, `${d.n}: seifa ${ix} {v,pct,dec}`);
    }
  }
  const byName = Object.fromEntries(sa.divs.map((d) => [d.n, d]));
  assert.equal(byName.Bragg.seifa.irsad.dec, 10, "Bragg is the most advantaged tenth (SA geography guard)");
  assert.equal(byName.Elizabeth.seifa.irsad.dec, 1, "Elizabeth is the least advantaged tenth");
  for (const p of ["data/sa26-demo.json", "data/sa26-seifa.json", ".build/map/sa26/assign-sa1.json"]) assert.ok(fs.existsSync(path.join(ROOT, p)), `${p} missing — run the sa26 census pipelines`);
  const dec = new Set(sa.divs.map((d) => d.seifa.irsad.dec));
  assert.ok(dec.size >= 8, "sa26 IRSAD deciles spread across the range (a monotone join bug collapses them)");
}

// the sa26 frame's polling places: 753 ECSA booths joined out of the HAChange
// payload by build_sa26_data.py (committed caches in .build/map/src/sa26) —
// votes in the district's candidate order, ECSA venue types mapped to the
// federal day/EVC/mobile codes, the district's live 2CP pair kept where the
// booth's pair matches (Croydon's 14 booths carried an election-night
// notional ALP v One Nation pair, dropped). The ECSA publishes no booth
// addresses or coordinates, so lat/lon/premises are null and dec/vdec too.
{
  const sa = JSON.parse(R("map/data/res-sa26.json"));
  const B = sa.booths;
  assert.ok(B, "sa26 res carries a booths record");
  const LANES = ["d", "id", "n", "ty", "prem", "sub", "pc", "lat", "lon", "v", "inf", "tpp", "tcp", "fl", "dec", "vdec"];
  for (const k of LANES) assert.ok(Array.isArray(B[k]) && B[k].length === 753, `sa26 booths.${k}: 753 rows`);
  assert.equal(new Set(B.id).size, 753, "sa26 booth ids are unique");
  assert.deepEqual([...new Set(B.ty)].sort((a, b) => a - b), [1, 4, 5], "sa26 booth types are day/EVC/mobile only");
  assert.ok(B.lat.every((x) => x === null) && B.lon.every((x) => x === null) && B.prem.every((x) => x === null), "sa26 booths carry no venue facts (the ECSA publishes none)");
  assert.ok(B.dec.every((x) => x === null) && B.vdec.every((x) => x === null), "sa26 booths carry no SEIFA deciles (the neighbourhood lane is blank)");
  sa.divs.forEach((d, di) => {
    const js = B.d.reduce((a, x, k) => (x === di ? (a.push(k), a) : a), []);
    assert.ok(js.length > 0, `${d.n}: at least one booth`);
    for (const j of js) {
      assert.equal(B.v[j].length, d.c.length, `${d.n} ${B.n[j]}: a vote slot per district candidate`);
      const formal = B.v[j].reduce((a, x) => a + x, 0);
      assert.ok(!B.tcp[j] || B.tcp[j][0] + B.tcp[j][1] <= formal + 4, `${d.n} ${B.n[j]}: 2CP within the booth's formal count`);
    }
  });
  assert.equal(B.tcp.filter(Boolean).length, 732, "732 booths carry the district's live pair (7 zero-vote, 14 Croydon notional)");
}
// ── sa26's upper house is South Australia's Legislative Council, and the
// frame speaks of change on the 2022 state election (.build/map/
// build_sa26_past.py) — the 2022 figures are STORED on the sa26 frame (prev,
// agg pprim/pformal, per-district h rows, candidate c[5] and classic-pair
// tpp[2] swings) and never drawn as a map/chamber of their own
{
  const sen = JSON.parse(R("map/data/senate-sa26.json"));
  assert.equal(sen.year, "sa26", "senate-sa26: year");
  assert.equal(sen.lc, true, "senate-sa26: lc flag");
  assert.equal(sen.seatsN, 22, "senate-sa26: 22-member council");
  assert.equal(sen.later, 2034, "senate-sa26: the 2026 cohort's terms run to 2034");
  assert.equal(sen.dd, false, "senate-sa26: no double dissolution");
  assert.equal(sen.senators.length, 22, "senate-sa26: 22 members on file");
  const tally = {};
  for (const s of sen.senators) tally[s.ab] = (tally[s.ab] || 0) + 1;
  assert.deepEqual(tally, { ALP: 10, ONP: 3, LIB: 6, GRN: 2, FGA: 1 }, "senate-sa26: the council's party balance");
  const c26 = sen.senators.filter((s) => s.elected === 2026), c22 = sen.senators.filter((s) => s.elected === 2022);
  assert.equal(c26.length, 11, "senate-sa26: 11 elected at sa26");
  assert.equal(c22.length, 11, "senate-sa26: 11 carried over from 2022");
  assert.ok(c26.every((s) => s.term === 2034), "senate-sa26: 2026 cohort terms to 2034");
  assert.ok(c22.every((s) => s.term === 2030), "senate-sa26: 2022 cohort terms to 2030");
  const game = sen.senators.find((s) => s.n === "Sarah Game");
  assert.ok(game && game.ab === "FGA" && game.electedAs === "ONP" && game.elected === 2022,
    "senate-sa26: Sarah Game sits FGA, her seat won for One Nation (electedAs)");
  assert.equal(sen.formal, 1137942, "senate-sa26: 2026 LC formal vote");
  assert.equal(sen.pformal, 1088840, "senate-sa26: 2022 LC formal vote");
  assert.ok(sen.votes && sen.pvotes, "senate-sa26: statewide party votes for both elections");

  const res = JSON.parse(R("map/data/res-sa26.json"));
  assert.equal(res.prev, 2022, "sa26: prev names the 2022 state election");
  let nSw = 0, nC5 = 0, nTpp = 0;
  for (const d of res.divs) {
    assert.ok(Array.isArray(d.h) && d.h.length === 1 && d.h[0][0] === 2022 && typeof d.h[0][1] === "number" && typeof d.h[0][3] === "string",
      `sa26 ${d.n}: one 2022 history row ([year, TCP%, party, member])`);
    for (const c of d.c) {
      assert.ok(Number.isFinite(c[5]), `sa26 ${d.n}: c[5] finite for ${c[0]}`);
      nC5++;
      if (c[5] !== 0) nSw++;
    }
    if (d.tpp && Number.isFinite(d.tpp[2])) nTpp++;
  }
  assert.equal(res.divs.length, 47, "sa26: 47 districts");
  assert.equal(nC5, 388, "sa26: every candidate carries a swing figure");
  assert.equal(nSw, 387, "sa26: candidate swings on 2022 (only a same-share repeat may rest at 0)");
  assert.equal(nTpp, 13, "sa26: 13 districts carry a classic-pair 2PP swing into 2022");
  assert.equal(res.agg.SA.pformal, 1091173, "sa26: 2022 House of Assembly formal vote");
  assert.equal(res.agg.AUS.pformal, 1091173, "sa26: the AUS agg mirrors the state frame's 2022 formal");
  for (const st of ["SA", "AUS"]) {
    const p = res.agg[st].pprim;
    assert.ok(p, `sa26: ${st} agg carries 2022 primaries`);
    const sum = ["alp", "lnp", "grn", "onp", "ind", "oth"].reduce((a, k) => a + (p[k] || 0), 0);
    assert.equal(sum, 1091173, `sa26: ${st} 2022 primaries account for every formal vote`);
  }
}

console.log("PASS: map page – an ext menu page outside the main build, linked in both designs and the shell, two-column menus, assembled assets current, data present, plan years seated by the plan, in the sitemap");
