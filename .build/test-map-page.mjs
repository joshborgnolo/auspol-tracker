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
const js = ["app-1-base.js", "app-2-map.js", "app-3-chamber.js", "app-3b-senate.js", "app-3c-sa.js", "app-4-story.js", "app-5-list.js", "app-6-ui.js"].map(part).join("\n");
// the script carries every tracked data file's hash, so a release never reads a cached older copy (data-stamp.mjs)
assert.equal(R("map/map.js"), stampMeta(stampData(`/* the Election map – assembled from .build/map/app by .build/map/assemble.mjs; edit the parts, not this file */\n(() => {\n${js}\n})();\n`, dataStamps(ROOT)), metaFacts(ROOT)), "map/map.js is current, its data stamps too (node .build/map/assemble.mjs after rebuilding any map/data file)");
// the eyebrow's floor measures every election's real meta line from the facts stamped in (data-stamp.mjs);
// a year the stamp lacks would be left out of the floor, and walking to it would move the map
{
  const F = metaFacts(ROOT), years = (js.match(/const YEARS = \[([^\]]*)\]/) || [, ""])[1].split(",").map((t) => t.trim().replace(/"/g, "")).filter(Boolean);
  assert.ok(years.length >= 10, "YEARS read from app-1-base.js");
  for (const y of years) assert.ok(F.house[y] && F.house[y][0] && F.house[y][1] > 0, `meta facts: the House line for ${y}`);
  // an upper-house file exists only for the frames that have one (sa26/sa22's
  // Legislative Council and vic22's ride senate-<year>.json with lc:true)
  const LC_YEARS = [], SEN_FILES = [];
  for (const f of fs.readdirSync(path.join(ROOT, "map/data"))) {
    const m = f.match(/^senate-(\w+)\.json$/);
    if (m) { const s = JSON.parse(R("map/data/" + f)); if (s && s.lc) LC_YEARS.push(m[1]); SEN_FILES.push(m[1]); }
  }
  assert.ok(LC_YEARS.includes("vic22") && F.senate.vic22, "meta facts: vic22's council has its Senate line (the Legislative Council rides senate-vic22.json)");
  for (const y of years.filter((y) => y !== "now" && !LC_YEARS.includes(y) && SEN_FILES.includes(y))) assert.ok(F.senate[y] && F.senate[y][0] && F.senate[y][1] > 0, `meta facts: the Senate line for ${y}`);
  for (const y of LC_YEARS) assert.ok(F.senate[y] && F.senate[y][0] && F.senate[y][1] > 0, `meta facts: the upper-house line for ${y}`);
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
  const seated = part("app-1-base.js").match(/const SEATED = new Set\(\[([^\]]*)\]\)/)[1].split(",").map((s) => s.trim().replace(/"/g, ""))
    // (South Australia's frames sit on their own floors, Victoria's on the
    // Assembly variant of this chamber's floor: pinned below)
    .filter((y) => !/^sa/.test(y) && y !== "vic22");
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

// the background year preload (2026-10-26): once the page is up, every other
// election loads in the background — nearest timeline stops first, one idle
// slice at a time — so a timeline jump, a chamber switch or the Senate lens
// finds its data already here. Skipped on save-data/2g connections (the
// timeline's hover preload still covers a stop the reader nears); a year's
// failed fetch drops its record so a real click tries it again
{
  const ui = part("app-6-ui.js");
  assert.ok(ui.includes("function preloadYears()") && /YEARS\.filter\(\(y\) => !Y\[y\]\)\.sort/.test(ui), "preloadYears walks the years nearest-first");
  assert.ok(ui.includes("conn.saveData") && ui.includes("effectiveType"), "the background preload yields to save-data and 2g connections");
  assert.ok(ui.includes("delete Y[y]"), "a failed background load frees the year for a real retry");
  assert.ok(ui.includes("loadSenates()") && ui.includes("loadSenateFloor()") && ui.includes("loadSenateVote(sy)"), "the preload also fills the chambers and the Senate-vote lane");
  assert.ok(ui.includes("k !== 2004"), "no senate-vote-2004 fetch (no such file)");
  assert.ok(ui.includes(" preloadYears();\n})();"), "boot ends by kicking the background preload");
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
  assert.ok(!("incomeCuts" in sa) && !("seifaCuts" in sa), "sa26 carries no income/SEIFA distribution cuts (its booths carry venue-grade census lanes only; the cuts are voter-footprint reads)");
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
// notional ALP v One Nation pair, dropped). Booth premises, suburb, postcode
// and coordinates come from ECSA's own 2026 election-map venue roll (Wayback
// snapshot, cached as ecsa-2026-venues.json.gz); the 6 mobile teams have no
// fixed venue and stay null. The census lanes (dec, demo — vdec is left
// empty by design) are then spliced in by .build/map/build_sa_boothcensus.py.
{
  const sa = JSON.parse(R("map/data/res-sa26.json"));
  const B = sa.booths;
  assert.ok(B, "sa26 res carries a booths record");
  const LANES = ["d", "id", "n", "ty", "prem", "sub", "pc", "lat", "lon", "v", "inf", "tpp", "tcp", "fl", "dec", "vdec"];
  for (const k of LANES) assert.ok(Array.isArray(B[k]) && B[k].length === 753, `sa26 booths.${k}: 753 rows`);
  assert.equal(new Set(B.id).size, 753, "sa26 booth ids are unique");
  assert.deepEqual([...new Set(B.ty)].sort((a, b) => a - b), [1, 4, 5], "sa26 booth types are day/EVC/mobile only");
  assert.equal(B.ty.filter((t) => t === 4).length, 6, "sa26: 6 mobile polling teams");
  for (let k = 0; k < B.n.length; k++) {
    if (B.ty[k] === 4) {
      assert.ok(B.lat[k] === null && B.lon[k] === null && B.prem[k] === null && B.sub[k] === null && B.pc[k] === null, `sa26 mobile booth ${B.n[k]}: no venue facts (a mobile team has no fixed venue)`);
    } else {
      const c = `${B.n[k]}: venue facts off the ECSA venue roll`;
      assert.ok(B.lat[k] > -44 && B.lat[k] < -9 && B.lon[k] > 112 && B.lon[k] < 154, `sa26 ${c}`);
      assert.ok(typeof B.prem[k] === "string" && B.prem[k] && typeof B.sub[k] === "string" && B.sub[k] && typeof B.pc[k] === "string" && B.pc[k], `sa26 ${c}`);
    }
  }
  // census lanes (.build/map/build_sa_boothcensus.py, spliced into the data
  // build): a fixed booth's venue coords join it to the SA1 it stands in —
  // dec is that SA1's ABS 2021 national SEIFA deciles, demo the SA1's own
  // people cells on the district lanes' ex-not-stated bases (8-wide; the two
  // income slots stay null). Mobile teams and booths in SA1s the cube does
  // not score stay null; vdec stays null by design — ECSA publishes no
  // votes-by-SA1, so the voter-footprint read cannot exist
  {
    assert.equal(B.dec.filter(Boolean).length, 736, "sa26: 736 booths in cube-scored SA1s carry national SEIFA deciles");
    assert.equal(B.dec.filter((x, k) => x === null && B.ty[k] === 4).length, 6, "sa26: the 6 mobile teams carry no deciles");
    assert.equal(B.dec.filter((x, k) => x === null && B.ty[k] !== 4).length, 11, "sa26: 11 fixed booths sit in SA1s the cube does not score");
    assert.ok(B.vdec.every((x) => x === null), "sa26: no voter-footprint deciles (ECSA publishes no votes-by-SA1 product)");
    assert.equal(B.demo.filter(Boolean).length, 747, "sa26: every geocoded booth carries its SA1's people cells");
    for (let k = 0; k < B.n.length; k++) {
      const d = B.dec[k];
      if (d !== null) assert.ok(Array.isArray(d) && d.length === 4 && d.every((x) => x === null || (Number.isInteger(x) && x >= 1 && x <= 10)), `sa26 ${B.n[k]}: dec is four national deciles or nulls`);
      const dm = B.demo[k];
      if (dm !== null) assert.ok(Array.isArray(dm) && dm.length === 8 && dm[6] === null && dm[7] === null && dm.slice(0, 6).every((x) => x === null || (typeof x === "number" && x >= 0 && x <= 1)), `sa26 ${B.n[k]}: demo is six 0-1 people cells on null income slots`);
    }
    const adl = B.n.indexOf("Adelaide");
    assert.ok(adl >= 0, "sa26: the Adelaide booth exists");
    assert.deepEqual(B.dec[adl], [8, 7, 2, 10], "sa26: the Adelaide booth's SA1 national deciles");
    assert.deepEqual(B.demo[adl], [0.2928, 0.1545, 0.3648, 0.4629, 0.5625, 0.1793, null, null], "sa26: the Adelaide booth's SA1 people cells");
    assert.deepEqual(B.dec[B.n.indexOf("Beaumont")], [10, 10, 9, 10], "sa26: Beaumont, the top of the range");
    assert.deepEqual(B.dec[B.n.indexOf("Barmera")], [1, 1, 2, 2], "sa26: Barmera, the bottom of the range");
    const spread = new Set(B.dec.filter(Boolean).map((d) => d[0]).filter((x) => x !== null));
    assert.ok(spread.size >= 8, "sa26 booth IRSAD deciles spread across the range (a monotone join bug collapses them)");
  }
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
  assert.deepEqual(tally, { ALP: 10, ONP: 3, LIB: 6, GRN: 2, FFP: 1 }, "senate-sa26: the council's party balance");
  const c26 = sen.senators.filter((s) => s.elected === 2026), c22 = sen.senators.filter((s) => s.elected === 2022);
  assert.equal(c26.length, 11, "senate-sa26: 11 elected at sa26");
  assert.equal(c22.length, 11, "senate-sa26: 11 carried over from 2022");
  assert.ok(c26.every((s) => s.term === 2034), "senate-sa26: 2026 cohort terms to 2034");
  assert.ok(c22.every((s) => s.term === 2030), "senate-sa26: 2022 cohort terms to 2030");
  const game = sen.senators.find((s) => s.n === "Sarah Game");
  assert.ok(game && game.ab === "FFP" && game.electedAs === "ONP" && game.elected === 2022,
    "senate-sa26: Sarah Game sits Family First, her seat won for One Nation (electedAs)");
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

// ── the sa22 frame: South Australia's 19 March 2022 state election, the
// second state frame on /map/ (build_sa22_data.py on the committed 2022 ECSA
// caches — an older payload vintage than 2026's: districts key on NAME,
// candidates carry ordinaryVotes+declarationVotes+per-candidate
// distributionVotes, the 2CP lane reconciles exactly, and the twoPartyPref
// notional tally is partial — every tpp lane records only a classic-pair
// district's distribution finals, booths' tpp null). build_sa22_past.py joins
// the 2018 static-HTML records in. Its preferences lane is modelled
// (data/sa22-flows.json, pinned with sa26's below)
{
  const res = JSON.parse(R("map/data/res-sa22.json"));
  assert.equal(res.year, "sa22", "sa22: year id");
  assert.equal(res.date, "2022-03-19", "sa22: polling day");
  assert.equal(res.prev, 2018, "sa22: prev names the 2018 state election");
  assert.equal(res.demoBasis, "sa1", "sa22 records the SA1 census basis");
  assert.equal(res.jurisdiction, "SA", "sa22: jurisdiction");
  assert.deepEqual(Object.keys(res.agg), ["AUS", "SA"], "sa22 carries only the SA frame's areas");
  assert.equal(res.divs.length, 47, "sa22: 47 districts");
  for (const f of ["geo-sa22-lo.json", "geo-sa22-hi.json"]) assert.ok(fs.existsSync(path.join(ROOT, "map", "data", f)), "map/data/" + f);
  let nSw = 0, nC5 = 0, nTpp = 0, nH = 0;
  for (const d of res.divs) {
    assert.ok(Array.isArray(d.h) && d.h.length === 1 && d.h[0][0] === 2018 && typeof d.h[0][1] === "number" && typeof d.h[0][3] === "string",
      `sa22 ${d.n}: one 2018 history row ([year, TCP%, party, member])`);
    assert.ok(Array.isArray(d.fl), `sa22 ${d.n}: a flow lane`);
    nH += d.h.length;
    for (const c of d.c) {
      assert.ok(Number.isFinite(c[5]), `sa22 ${d.n}: c[5] finite for ${c[0]}`);
      nC5++;
      if (c[5] !== 0) nSw++;
    }
    if (d.tpp && Number.isFinite(d.tpp[2])) nTpp++;
  }
  assert.equal(nH, 47, "sa22: every district carries its 2018 history row");
  assert.equal(nC5, 240, "sa22: every candidate carries a swing figure");
  assert.equal(nSw, 240, "sa22: 240 candidate swings on 2018 (every candidate moved)");
  assert.equal(nTpp, 33, "sa22: 33 districts carry a classic-pair 2PP swing into 2018");
  assert.deepEqual(res.agg.SA.seats, { ALP: 27, LIB: 16, IND: 4 }, "sa22: the 2022 seat count");
  assert.equal(res.agg.SA.formal, 1091173, "sa22: 2022 HoA formal vote (matches the sa26 frame's pformal)");
  assert.equal(res.agg.SA.pformal, 1048713, "sa22: 2018 HoA formal vote");
  assert.equal(res.agg.AUS.pformal, 1048713, "sa22: the AUS agg mirrors the state frame's 2018 formal");
  for (const st of ["SA", "AUS"]) {
    const p = res.agg[st].pprim;
    assert.ok(p, `sa22: ${st} agg carries 2018 primaries`);
    const sum = ["alp", "lnp", "grn", "onp", "ind", "oth"].reduce((a, k) => a + (p[k] || 0), 0);
    assert.equal(sum, 1048713, `sa22: ${st} 2018 primaries account for every formal vote`);
    assert.equal(res.agg[st].pprim.onp, 0, `sa22: ${st} 2018 primaries hold no One Nation lane (it ran none)`);
  }
  // booths: 695 polling places on the federal lanes, ECSA 2022 types (day and
  // mobile — no EVC lane in the 2022 vocabulary), venue facts off ECSA's own
  // archived 2022 election-map venue roll (the 6 mobile teams stay null),
  // tpp null and no flow lane. dec/demo are spliced in by
  // .build/map/build_sa_boothcensus.py exactly as sa26's
  {
    const B = res.booths;
    assert.ok(B, "sa22 res carries a booths record");
    const LANES = ["d", "id", "n", "ty", "prem", "sub", "pc", "lat", "lon", "v", "inf", "tpp", "tcp", "fl", "dec", "vdec"];
    for (const k of LANES) assert.ok(Array.isArray(B[k]) && B[k].length === 695, `sa22 booths.${k}: 695 rows`);
    assert.equal(new Set(B.id).size, 695, "sa22 booth ids are unique");
    assert.deepEqual([...new Set(B.ty)].sort((a, b) => a - b), [1, 4], "sa22 booth types are day/mobile only (no EVC lane in 2022)");
    assert.equal(B.ty.filter((t) => t === 4).length, 6, "sa22: 6 mobile polling teams");
    for (let k = 0; k < B.n.length; k++) {
      if (B.ty[k] === 4) {
        assert.ok(B.lat[k] === null && B.lon[k] === null && B.prem[k] === null && B.sub[k] === null && B.pc[k] === null, `sa22 mobile booth ${B.n[k]}: no venue facts (a mobile team has no fixed venue)`);
      } else {
        const c = `${B.n[k]}: venue facts off the ECSA venue roll`;
        assert.ok(B.lat[k] > -44 && B.lat[k] < -9 && B.lon[k] > 112 && B.lon[k] < 154, `sa22 ${c}`);
        assert.ok(typeof B.prem[k] === "string" && B.prem[k] && typeof B.sub[k] === "string" && B.sub[k] && typeof B.pc[k] === "string" && B.pc[k], `sa22 ${c}`);
      }
    }
    assert.ok(B.tpp.every((x) => x === null), "sa22 booths carry no tpp lane (the notional tally is partial)");
    assert.ok(B.fl.every((x) => x === null), "sa22 booths carry no flow lane");
    // census lanes, the same splice contract as sa26's (see above)
    assert.equal(B.dec.filter(Boolean).length, 681, "sa22: 681 booths in cube-scored SA1s carry national SEIFA deciles");
    assert.equal(B.dec.filter((x, k) => x === null && B.ty[k] === 4).length, 6, "sa22: the 6 mobile teams carry no deciles");
    assert.equal(B.dec.filter((x, k) => x === null && B.ty[k] !== 4).length, 8, "sa22: 8 fixed booths sit in SA1s the cube does not score");
    assert.ok(B.vdec.every((x) => x === null), "sa22: no voter-footprint deciles (ECSA publishes no votes-by-SA1 product)");
    assert.equal(B.demo.filter(Boolean).length, 689, "sa22: every geocoded booth carries its SA1's people cells");
    for (let k = 0; k < B.n.length; k++) {
      const d = B.dec[k];
      if (d !== null) assert.ok(Array.isArray(d) && d.length === 4 && d.every((x) => x === null || (Number.isInteger(x) && x >= 1 && x <= 10)), `sa22 ${B.n[k]}: dec is four national deciles or nulls`);
      const dm = B.demo[k];
      if (dm !== null) assert.ok(Array.isArray(dm) && dm.length === 8 && dm[6] === null && dm[7] === null && dm.slice(0, 6).every((x) => x === null || (typeof x === "number" && x >= 0 && x <= 1)), `sa22 ${B.n[k]}: demo is six 0-1 people cells on null income slots`);
    }
    const adl = B.n.indexOf("Adelaide");
    assert.ok(adl >= 0, "sa22: the Adelaide booth exists");
    assert.deepEqual(B.dec[adl], [8, 7, 2, 10], "sa22: the Adelaide booth's SA1 national deciles");
    assert.deepEqual(B.demo[adl], [0.2928, 0.1545, 0.3648, 0.4629, 0.5625, 0.1793, null, null], "sa22: the Adelaide booth's SA1 people cells");
    const spread = new Set(B.dec.filter(Boolean).map((d) => d[0]).filter((x) => x !== null));
    assert.ok(spread.size >= 8, "sa22 booth IRSAD deciles spread across the range (a monotone join bug collapses them)");
  }
  // the census lanes splice exactly as sa26's
  {
    const DMK = ["lang", "a65", "a2034", "fborn", "uni", "blue"], IXS = ["irsad", "irsd", "ier", "ieo"];
    assert.equal(res.divs.length, 47, "sa22: 47 districts with census rows");
    const dec = new Set(res.divs.map((d) => d.seifa.irsad.dec));
    assert.ok(dec.size >= 8, "sa22 IRSAD deciles spread across the range (a monotone join bug collapses them)");
    for (const d of res.divs) {
      assert.ok(d.demo && DMK.every((k) => typeof d.demo[k] === "number") && typeof d.demo.p === "number", `sa22 ${d.n}: demo row`);
      for (const ix of IXS) assert.ok(d.seifa && typeof d.seifa[ix].v === "number" && Number.isInteger(d.seifa[ix].dec), `sa22 ${d.n}: ${ix} cell`);
    }
  }
}

// ── the sa22 upper house is again the Legislative Council: the 11 elected
// there 2022 (terms to 2030) join the 11 carried over from 2018 (terms to
// 2026, the hard-coded roster the ECSA never published) — both written by
// build_sa22_past.py from the committed 2022-LC cache
{
  const sen = JSON.parse(R("map/data/senate-sa22.json"));
  assert.equal(sen.year, "sa22", "senate-sa22: year");
  assert.equal(sen.lc, true, "senate-sa22: lc flag");
  assert.equal(sen.seatsN, 22, "senate-sa22: 22-member council");
  assert.equal(sen.later, 2030, "senate-sa22: the 2022 cohort's terms run to 2030");
  assert.equal(sen.dd, false, "senate-sa22: no double dissolution");
  assert.equal(sen.senators.length, 22, "senate-sa22: 22 members on file");
  const tally = {};
  for (const s of sen.senators) tally[s.ab] = (tally[s.ab] || 0) + 1;
  assert.deepEqual(tally, { ALP: 9, LIB: 8, SAB: 2, GRN: 2, ONP: 1 }, "senate-sa22: the council's party balance at polling day 2022");
  const c22 = sen.senators.filter((s) => s.term === 2030), c18 = sen.senators.filter((s) => s.term === 2026);
  assert.equal(c22.length, 11, "senate-sa22: 11 elected at sa22");
  assert.equal(c18.length, 11, "senate-sa22: 11 carried over from 2018");
  assert.ok(c22.every((s) => s.elected === 2022), "senate-sa22: the 2022 cohort is elected 2022");
  assert.ok(c18.every((s) => s.elected === 2018), "senate-sa22: the cross-bench cohort is elected 2018");
  const game = sen.senators.find((s) => /Game/i.test(s.n));
  assert.equal(game.ab, "ONP", "senate-sa22: Sarah Game sits One Nation as elected (the Family First relabel is an sa26-frame view)");
  assert.equal(sen.formal, 1088840, "senate-sa22: 2022 LC formal vote");
  assert.equal(sen.pformal, 1050874, "senate-sa22: 2018 LC formal vote");
  assert.ok(sen.votes && sen.pvotes, "senate-sa22: statewide party votes for both elections");
  assert.equal(Object.values(sen.votes).reduce((a, b) => a + b, 0), sen.formal, "senate-sa22: 2022 party votes sum to formal");
  assert.equal(Object.values(sen.pvotes).reduce((a, b) => a + b, 0), sen.pformal, "senate-sa22: 2018 party votes sum to formal");
}

// South Australia's chambers: their own floors (app-3c-sa.js, measured off the Parliament's chamber
// maps), and the sa26 Parliament seated at its desks (.build/map/sa_seating.mjs)
{
  const src = R(".build/map/app/app-3c-sa.js");
  const block = src.match(/@sa-cells-begin[\s\S]*?\*\/([\s\S]*?)\/\* @sa-cells-end \*\//);
  assert.ok(block, "app-3c-sa.js carries its @sa-cells block");
  const { SAF, saCells } = new Function(`${block[1]}; return { SAF, saCells };`)();
  const ha = saCells(SAF.ha), lc = saCells(SAF.lc);
  assert.equal(ha.length, 61, "the House of Assembly's floor: 61 desks besides the Speaker's chair");
  assert.equal(lc.length, 28, "the Legislative Council's floor: 28 desks besides the President's chair");
  for (const [k, cells] of [["ha", ha], ["lc", lc]]) {
    assert.equal(new Set(cells.map((c) => c.id)).size, cells.length, `${k}: desk ids unique`);
    // the government's side is the reader's left, a mirror of the opposition's
    assert.equal(cells.filter((c) => c.x < 0).length - cells.filter((c) => c.x > 0).length, k === "ha" ? 1 : 0, `${k}: sides as the plan draws them (the Assembly's opposition front bench has no seat at the cross-aisle)`);
  }
  // each room's southern wall ends with its seats: the lowest bench's edge plus the carpet
  // skirt the House floor keeps (4.5 plan points, 5.4 pixels at this plan's 36-pixel unit —
  // the 2026-10-27 substrate trim; the walls used to reach well past the seats). Sydney's
  // Council ends with its transverse backing, its lower edge the wall's anchor
  {
    const benchW = 46 / 2 + 4, benchD = 50 / 2 + 4, D2R = Math.PI / 180, skirt = (4.5 * 36) / 30;
    const bottom = (F) => Math.max(
      ...F.straight.map((b) => Math.max(...b.ys) + benchW),
      ...F.arcs.map((a) => a.y + (a.r + benchD) * Math.sin((a.phi[a.phi.length - 1] + benchW / a.r / D2R) * D2R)),
      ...(F.singles ?? []).map((q) => q.y + benchD),
      ...(F.transverse ? [F.transverse.y1] : []),
      ...(F.usher != null ? [F.usher + benchD] : []));
    for (const [k, F] of [["ha", SAF.ha], ["lc", SAF.lc], ["nswLC", SAF.nswLC]])
      assert.ok(Math.abs(F.room[3] - (bottom(F) + skirt)) <= 0.6,
        `${k}: the room's southern wall ends with its seats plus the carpet skirt (wall at ${F.room[3]}, the lowest bench at ${bottom(F).toFixed(1)})`);
  }
  const ids = (cells) => new Set(cells.map((c) => c.id));
  const seats = JSON.parse(R("map/data/seats-sa26.json")), res = JSON.parse(R("map/data/res-sa26.json"));
  const seated = Object.keys(seats.at);
  assert.equal(seated.length, 46, "seats-sa26: every member but the Speaker at a desk");
  assert.ok(!seated.includes("Hurtle Vale") && res.divs.some((d) => d.n === "Hurtle Vale"), "seats-sa26: the Speaker (Hurtle Vale) in the chair, not at a desk");
  assert.ok(seated.every((n) => res.divs.some((d) => d.n === n)), "seats-sa26: districts of the frame");
  assert.ok(Object.values(seats.at).every((d) => ids(ha).has(d)), "seats-sa26: every desk on the drawn floor");
  assert.equal(new Set(Object.values(seats.at)).size, 46, "seats-sa26: one member a desk");
  assert.equal(seats.at.Croydon, "A1", "seats-sa26: the Premier nearest the Speaker on the government front bench");
  assert.equal(seats.at.Schubert, "F1", "seats-sa26: the Leader of the Opposition across from the Premier");
  const lcs = JSON.parse(R("map/data/seats-sa26-lc.json")), council = JSON.parse(R("map/data/senate-sa26.json"));
  assert.equal(Object.keys(lcs.at).length, 21, "seats-sa26-lc: every member but the President at a desk");
  assert.ok(Object.keys(lcs.at).every((n) => council.senators.some((s) => s.n === n)), "seats-sa26-lc: members of the frame's council");
  assert.ok(Object.values(lcs.at).every((d) => ids(lc).has(d)) && new Set(Object.values(lcs.at)).size === 21, "seats-sa26-lc: one member a desk, every desk drawn");
  assert.deepEqual(lcs.roles, { oppLeader: "Nicola Centofanti", leader: "Kyam Maher", president: "Reggie Martin" }, "seats-sa26-lc: the chair and the leaders");
  assert.ok(!(lcs.roles.president in lcs.at), "seats-sa26-lc: the President in the chair, not at a desk");
  // sa22, seated from the Parliament's archived plan of 28 December 2024 (.build/map/sa22_seating.mjs)
  {
    const seats = JSON.parse(R("map/data/seats-sa22.json")), res = JSON.parse(R("map/data/res-sa22.json"));
    const seated = Object.keys(seats.at);
    assert.equal(seats.plan, "28 December 2024", "seats-sa22: the archived plan's capture date");
    assert.ok(seats.note && seats.note.includes("Bignell"), "seats-sa22: the note owns the late-Speaker placement");
    assert.equal(seated.length, 46, "seats-sa22: every member but the Speaker at a desk");
    assert.ok(!seated.includes("Kavel") && res.divs.some((d) => d.n === "Kavel"), "seats-sa22: the Speaker (Kavel) in the chair, not at a desk");
    assert.ok(!Object.values(seats.at).includes("C1"), "seats-sa22: Cregan's printed desk C1 left empty");
    assert.ok(seated.every((n) => res.divs.some((d) => d.n === n)), "seats-sa22: districts of the frame");
    assert.ok(Object.values(seats.at).every((d) => ids(ha).has(d)), "seats-sa22: every desk on the drawn floor");
    assert.equal(new Set(Object.values(seats.at)).size, 46, "seats-sa22: one member a desk");
    assert.equal(seats.at.Croydon, "A1", "seats-sa22: the Premier nearest the Speaker on the government front bench");
    assert.equal(seats.at.Hartley, "F1", "seats-sa22: the Leader of the Opposition across from the Premier");
    assert.equal(seats.at.Mawson, "C2", "seats-sa22: Bignell, the plan's Speaker, on the government bench by the chair");
  }
  assert.ok(js.includes("sa22: \"Kavel\", sa26: \"Hurtle Vale\""), "the SA frames' Speakers in the chair");
  assert.ok(js.includes('"sa26", "sa22"'), "sa22 in SEATED: the sa22 view shows its plan");
}

// South Australia's modelled preference flows (sa_flow_lane.py): rows in the tcp's order, read
// through the Labor side as the app reads them — a Labor-first row in a Liberal-first count reads
// Greens preferences as running to the Liberals (six SA26 districts did, before 2026-10-26)
for (const y of ["sa22", "sa26"]) {
  const r = JSON.parse(R(`map/data/res-${y}.json`));
  assert.equal(r.flBasis, "modelled", `${y}: the preferences lane is modelled`);
  let nCl = 0, nOn = 0;
  for (const d of r.divs) {
    const fam = (k) => d.c[d.tcp[k][0]][3], pair = new Set([fam(0), fam(1)]);
    const vs = pair.has("alp") && pair.has("lnp") ? "lnp" : pair.has("alp") && pair.has("onp") ? "onp" : null;
    if (!vs) { assert.equal(d.fl.length, 0, `${y} ${d.n}: no split filed where the final wasn't Labor against the Liberals or One Nation`); continue; }
    assert.ok(d.fl.length, `${y} ${d.n}: a Labor v ${vs} final carries its split`);
    vs === "lnp" ? nCl++ : nOn++;
    const side = fam(0) === "alp" ? 1 : 2;
    let a = 0, t = 0;
    for (const row of d.fl) if (d.c[row[0]][3] === "grn") { a += row[side]; t += row[1] + row[2]; }
    if (t) assert.ok(a / t > 0.6, `${y} ${d.n}: Greens preferences read as running to Labor (${(100 * a / t).toFixed(0)}%)`);
  }
  if (y === "sa26") { assert.equal(nCl, 13, "sa26: 13 Labor v Liberal finals split"); assert.equal(nOn, 25, "sa26: 25 Labor v One Nation finals split"); assert.ok(r.flowErr.vsOnp && r.flowErr.vsOnp.lnp, "sa26: the Labor v One Nation error cells"); }
  else assert.ok(nCl >= 40, `${y}: its classic finals split (${nCl})`);
}

// the state frames' lens row: the Senate vote and the AEC's seat types are federal reads the
// state elections don't offer — out of the menu bar, the walks, the URL and the legend probe,
// but never out of LENSES itself (a federal year's row still carries both)
{
  assert.ok(js.includes('{ id: "senate", label: "Senate" },') && js.includes('{ id: "cls", label: "Seat type" },'), "the Senate and Seat-type lenses still exist for the federal years");
  assert.ok(js.includes('const FED_LENS = new Set(["senate", "cls"]);') && js.includes("const yearLenses = (y) => STATE_YEARS.has(y) ? LENSES.filter((l) => !FED_LENS.has(l.id)) : LENSES;"), "yearLenses filters the two federal-only lenses for the state frames");
  assert.ok(js.includes("const list = sen ? SEN_LENSES : yearLenses(S.year)"), "renderLenses draws the year's own lenses");
  assert.ok(js.includes("const L = yearLenses(S.year), k = (L.findIndex("), "walkLens walks the year's own lenses");
  assert.ok(js.includes('const l = p.get("l"); if (l && yearLenses(S.year).some((x) => x.id === l)) S.lens = l;'), "readURL refuses a federal-only lens on a state deep link");
  assert.ok(js.includes('if (STATE_YEARS.has(y) && FED_LENS.has(S.lens)) S.lens = "winner";'), "setYear drops a federal-only lens on the walk into a state frame");
  assert.ok(js.includes("if (FED_LENS.has(id) && STATE_YEARS.has(S.year)) return;"), "setLens refuses a federal-only lens on a state frame outright");
  // the legend-height probe used to sweep every lens for a global max; since the
  // per-lens hold (2026-10-26) it measures the CURRENT lens only, and setYear/setLens
  // above keep that lens one the year can show
  assert.ok(js.includes("const my = legendStandIn(m, y);") && !js.includes("for (const lens of yearLenses(y).map("), "the legend-height probe measures the current lens's stand-in (no lens sweep)");
  assert.ok(js.includes("boothsShown(), S.lens, S.tppMode"), "the legend-height hold key carries the lens and its mode");
}

// ── the nsw23 frame: New South Wales' 25 March 2023 state election — the
// first second-jurisdiction frame on /map/ (build_nsw23_data.py on the
// committed NSWEC caches in .build/map/src/nsw23), 93 districts on their own
// timeline row, the 2019 state election as its past join (build_nsw23_past.py:
// prev, the agg pprim/pformal and per-candidate c[5] swings), the ABS 2021
// census lanes spliced by build_nsw23_demo.py/build_nsw23_seifa.py off the
// SA1→district join in .build/map/nsw23/assign-sa1.json
{
  const res = JSON.parse(R("map/data/res-nsw23.json"));
  assert.equal(res.year, "nsw23", "nsw23: year id");
  assert.equal(res.date, "2023-03-25", "nsw23: polling day");
  assert.equal(res.prev, 2019, "nsw23: prev names the 2019 state election");
  assert.equal(res.jurisdiction, "NSW", "nsw23: jurisdiction");
  assert.equal(res.demoBasis, "sa1", "nsw23 records the SA1 census basis");
  assert.deepEqual(Object.keys(res.agg), ["AUS", "NSW"], "nsw23 carries only its frame's areas");
  assert.equal(res.divs.length, 93, "nsw23: 93 districts");
  for (const f of ["geo-nsw23-lo.json", "geo-nsw23-hi.json", "data-nsw23.json", "senate-nsw23.json"]) assert.ok(fs.existsSync(path.join(ROOT, "map", "data", f)), "map/data/" + f);
  // the winners: derived from the 2CP tallies exactly as the app reads them
  // (tcp entries are [candidate index, votes], so the winner's CANDIDATE is
  // c[d.tcp[slot][0]], never c[slot] — the slot-read miscounts the tally);
  // derived == the file's elected flags on all 93 == the official result
  const tally = {};
  let nC5 = 0, nSw = 0, nTpp = 0, nH = 0;
  for (const d of res.divs) {
    const w = d.tcp[0][1] >= d.tcp[1][1] ? d.tcp[0][0] : d.tcp[1][0];
    tally[d.c[w][1]] = (tally[d.c[w][1]] || 0) + 1;
    assert.equal(d.c.findIndex((c) => c[6] === 1), w, `nsw23 ${d.n}: the elected flag sits on the 2CP winner`);
    nH += (d.h || []).length;
    for (const row of d.h || []) {
      assert.ok(row[0] === 2019 && typeof row[1] === "number" && typeof row[3] === "string", `nsw23 ${d.n}: a 2019 history row ([year, TCP%, party, member])`);
    }
    for (const c of d.c) {
      assert.ok(Number.isFinite(c[5]), `nsw23 ${d.n}: c[5] finite for ${c[0]}`);
      nC5++;
      if (c[5] !== 0) nSw++;
    }
    if (d.tpp && Number.isFinite(d.tpp[2])) nTpp++;
  }
  assert.deepEqual(tally, { LIB: 25, ALP: 45, GRN: 3, IND: 9, NAT: 11 }, "nsw23: the official 2023 seat tally (Labor's 45-seat majority)");
  assert.deepEqual(res.agg.NSW.seats, tally, "nsw23: the agg seat count is the derived tally");
  const kog = res.divs.find((d) => d.n === "Kogarah");
  const kw = kog.tcp[0][1] >= kog.tcp[1][1] ? kog.tcp[0][0] : kog.tcp[1][0];
  assert.deepEqual([kog.c[kw][0], kog.c[kw][1]], ["Chris Minns", "ALP"], "nsw23: Kogarah elects Chris Minns, the Premier");
  assert.equal(nH, 92, "nsw23: 92 history rows");
  assert.deepEqual(res.divs.filter((d) => !d.h || !d.h.length).map((d) => d.n), ["Leppington"], "nsw23: Leppington is new in 2023 — the one division with no 2019 row");
  assert.equal(nC5, 562, "nsw23: 562 candidates file a swing");
  assert.equal(nSw, 556, "nsw23: 556 swings moved on 2019 (six rest at exactly 0)");
  assert.equal(nTpp, 66, "nsw23: 66 districts carry a classic-pair 2PP swing into 2019");
  assert.equal(res.agg.NSW.formal, 4701930, "nsw23: 2023 Legislative Assembly formal vote");
  assert.equal(res.agg.AUS.formal, 4701930, "nsw23: the AUS agg mirrors the frame's formal");
  assert.equal(res.agg.NSW.pformal, 4551886, "nsw23: 2019 Assembly formal vote");
  assert.equal(res.agg.AUS.pformal, 4551886, "nsw23: the AUS agg mirrors the frame's 2019 formal");
  for (const st of ["NSW", "AUS"]) {
    const p = res.agg[st].pprim;
    assert.ok(p, `nsw23: ${st} agg carries 2019 primaries`);
    assert.equal(Object.values(p).reduce((a, b) => a + b, 0), 4551886, `nsw23: ${st} 2019 primaries account for every formal vote`);
  }
  // the preferences lane is COUNTED, not modelled: the NSWEC re-counted
  // every 2023 ballot paper (parse-nsw-state-flows.py's committed re-count
  // in .build/state-flow-src/nsw/2023/counts.csv), and build_nsw23_data.py
  // files one [candidate, toA, toB, exhausted] quadruple per NON-finalist,
  // oriented on the tcp pair's order. NSW's optional preferences make the
  // fourth slot real; booths stay null — the re-count runs by district
  {
  assert.equal(res.flBasis, "counted", "nsw23: the preferences lane is counted");
  assert.equal(res.flOpv, true, "nsw23: the optional-preferential flag rides the lane");
  let nAlpFinal = 0, nClassic = 0, gA = 0, gB = 0;
  for (const d of res.divs) {
    for (const row of d.fl) {
      assert.equal(row.length, 4, `nsw23 ${d.n}: a flow row is one quadruple`);
      assert.equal(row[1] + row[2] + row[3], d.c[row[0]][4], `nsw23 ${d.n}: ${d.c[row[0]][0]}’s ballots account for their first preferences`);
    }
    const finalIdx = new Set([d.tcp[0][0], d.tcp[1][0]]);
    assert.equal(d.fl.length, d.c.length - 2, `nsw23 ${d.n}: one flow row per non-finalist`);
    assert.ok(!d.fl.some((row) => finalIdx.has(row[0])), `nsw23 ${d.n}: a finalist carries no flow row`);
    const fam = (k) => d.c[d.tcp[k][0]][3];
    if (fam(0) !== "alp" && fam(1) !== "alp") continue;
    nAlpFinal++;
    if ([fam(0), fam(1)].sort().join("+") !== "alp+lnp") continue;
    nClassic++;
    const side = fam(0) === "alp" ? 1 : 2;
    for (const row of d.fl) if (d.c[row[0]][3] === "grn") { gA += row[side]; gB += row[3 - side]; }
  }
  // the final-pair census: 71 classic ALP v L/NP finals (the state-flows.csv
  // row's n_classic) inside Labor's 79 top-two finishes
  assert.equal(nClassic, 71, "nsw23: 71 classic finals, the state-flows.csv row's n_classic");
  assert.equal(nAlpFinal, 79, "nsw23: Labor made the final two in 79 districts");
  // the state's canonical Greens figure (data/state-flows.csv: flow shares
  // read the ballots that REACHED the final two, exhausted ballots carry no
  // share): 182875 / (182875 + 24645) = 0.88124
  assert.ok(gA / (gA + gB) > 0.877 && gA / (gA + gB) < 0.885, `nsw23: Greens preferences run to Labor (${(100 * gA / (gA + gB)).toFixed(1)}%, the csv's 88.1)`);
  // the oracles: Albury's Davern (GRN) split 462 Liberal / 2402 Labor / 1808
  // exhausted; Newtown, an ALP v GRN final, still carries its minor rows
  const alb = res.divs.find((d) => d.n === "Albury");
  assert.equal(alb.c[2][1] + "/" + alb.c[2][0], "GRN/Eli Davern", "nsw23: the oracle's candidate cell");
  assert.deepEqual(alb.fl.find((row) => row[0] === 2), [2, 462, 2402, 1808], "nsw23: Albury's Greens split, tcp-ordered");
  const nt = res.divs.find((d) => d.n === "Newtown");
  assert.deepEqual([nt.c[nt.tcp[0][0]][1], nt.c[nt.tcp[1][0]][1]], ["ALP", "GRN"], "nsw23: Newtown's non-classic final pair");
  assert.deepEqual(nt.fl, [[2, 1609, 892, 3864], [3, 381, 365, 529]], "nsw23: Newtown's minor-candidate splits");
  }
  // the informal lens's exhausted-ballot view (infModeOf/infHi flip the
  // lens's datum, ceiling and legend copy; the census-people select's idiom):
  // exhaustion rides the flow rows' fourth slot, and under NSW's optional
  // count every formal ballot resolves exactly into the final count plus
  // the exhausted residue — the identity the app's exhPct derivation leans on
  {
  let exh = 0, form = 0; const pct = [];
  for (const d of res.divs) {
    const f = d.c.reduce((a, c) => a + c[4], 0);
    const e = d.fl.reduce((a, r) => a + r[3], 0);
    assert.equal(d.tcp[0][1] + d.tcp[1][1] + e, f, `nsw23 ${d.n}: formal = final count + exhausted`);
    exh += e; form += f; pct.push([d.n, (100 * e) / f]);
  }
  pct.sort((a, b) => a[1] - b[1]);
  assert.ok(Math.abs((100 * exh) / form - 11.44) < 0.01, "nsw23: one ballot in nine exhausted statewide (11.4%)");
  assert.ok(pct[pct.length - 1][0] === "Cabramatta" && Math.abs(pct[pct.length - 1][1] - 22.9) < 0.05, "nsw23: Cabramatta exhausted most, one ballot in five");
  assert.ok(pct[0][0] === "Kogarah" && Math.abs(pct[0][1] - 4.1) < 0.05, "nsw23: Kogarah exhausted least, one in twenty-five");
  const alb = res.divs.find((d) => d.n === "Albury");
  assert.ok(Math.abs((100 * alb.fl.reduce((a, r) => a + r[3], 0)) / alb.c.reduce((a, c) => a + c[4], 0) - 12.76) < 0.01, "nsw23: Albury's 6,351 exhausted of 49,788 formal (this share drives the view)");
  assert.ok((100 * exh) / form / 25 < 0.5, "nsw23: the app's 25% exhausted ceiling sits well over the statewide share");
  }
  // the view in the sources: a legend switcher like the census measure's,
  // offered only where the count ran optional-preferential (res.flOpv); the
  // booths (no per-place re-count) and the state's rundown read the
  // district's figure
  assert.ok(js.includes('data-opt="infm"') && js.includes(">Exhausted ballots</option>"), "map.js: the informal lens's Informal / Exhausted ballots switcher");
  assert.ok(js.includes('else if (k === "infm") S.infMode = t.value;') && js.includes('p.set("im", "exhaust")') && js.includes('p.get("im")'), "map.js: infMode's change handler + the im URL param both ways");
  assert.ok(js.includes("const infModeOf = (m) =>") && js.includes("const infHi =") && js.includes("? 25 : 12"), "map.js: infModeOf and infHi (the 25 exhausted ceiling)");
  assert.ok(js.includes("nn(d.exhPct)") && js.includes("nn(m.divs[b.d[j]].exhPct)"), "map.js: the exhausted datum reads the flow rows, booths falling back to the district's");
  assert.ok(js.includes('"Exhausted ballots" : "Informal"') && js.includes("ballots exhausting before the final two"), "map.js: the exhausted view's scale word and legend title");
  assert.ok(js.includes("optional-preferential, so a ballot leaves the count when its numbered candidates are gone"), "map.js: the exhausted legend note explains the scheme");
  assert.ok(js.includes('m.res.flOpv ? `<select data-opt="infm"'), "map.js: the switcher is offered only on the optional-preferential frame");
  // the census lanes (the same splice contract as the SA frames')
  const DMK = ["lang", "a65", "a2034", "fborn", "uni", "blue"], IXS = ["irsad", "irsd", "ier", "ieo"];
  for (const d of res.divs) {
    assert.ok(d.demo && DMK.every((k) => typeof d.demo[k] === "number") && typeof d.demo.p === "number" && typeof d.demo.n === "number", `nsw23 ${d.n}: demo row`);
    assert.deepEqual(Object.keys(d.demo).sort(), [...DMK, "n", "p"].sort(), `nsw23 ${d.n}: no income lanes`);
    for (const ix of IXS) {
      const c = d.seifa && d.seifa[ix];
      assert.ok(c && typeof c.v === "number" && typeof c.pct === "number" && c.dec >= 1 && c.dec <= 10, `nsw23 ${d.n}: seifa ${ix} {v,pct,dec}`);
    }
  }
  const byName = Object.fromEntries(res.divs.map((d) => [d.n, d]));
  assert.equal(byName.Vaucluse.seifa.irsad.dec, 10, "Vaucluse is the most advantaged tenth (NSW geography guard)");
  assert.equal(byName.Fairfield.seifa.irsad.dec, 1, "Fairfield is the least advantaged tenth");
  assert.ok(new Set(res.divs.map((d) => d.seifa.irsad.dec)).size >= 8, "nsw23 IRSAD deciles spread across the range (a monotone join bug collapses them)");
  for (const p of ["data/nsw23-demo.json", "data/nsw23-seifa.json", ".build/map/nsw23/assign-sa1.json"]) assert.ok(fs.existsSync(path.join(ROOT, p)), `${p} missing — run the nsw23 census pipelines`);
  // the polling places: 3,117 NSWEC venues on the federal lanes (day, mobile
  // team, EVC). No booth 2CP/TPP/flow comes with them (NSWEC's venue
  // counts file is first preferences only). The census lanes (dec, demo —
  // vdec is left empty by design) are then spliced in by
  // .build/map/build_nsw23_boothcensus.py, the NSW twin of the SA frames'
  // build_sa_boothcensus.py; NSWEC publishes no votes-by-SA1 product, so
  // the voter-footprint lane can never fill
  const B = res.booths;
  assert.ok(B, "nsw23 res carries a booths record");
  const LANES = ["d", "id", "n", "ty", "prem", "sub", "pc", "lat", "lon", "v", "inf", "tpp", "tcp", "fl", "dec", "vdec"];
  for (const k of LANES) assert.ok(Array.isArray(B[k]) && B[k].length === 3117, `nsw23 booths.${k}: 3,117 rows`);
  assert.equal(new Set(B.id).size, 3117, "nsw23 booth ids are unique");
  assert.deepEqual([...new Set(B.ty)].sort((a, b) => a - b), [1, 4, 5], "nsw23 booth types are day/mobile team/EVC");
  assert.equal(B.ty.filter((t) => t === 4).length, 167, "nsw23: 167 mobile teams");
  assert.equal(B.ty.filter((t) => t === 5).length, 330, "nsw23: 330 early voting centres");
  for (let k = 0; k < B.n.length; k++) {
    if (B.lat[k] !== null) assert.ok(B.lat[k] > -38 && B.lat[k] < -28 && B.lon[k] > 140 && B.lon[k] < 160, `nsw23 ${B.n[k]}: venue inside New South Wales (Lord Howe Island east to 159.1)`);
  }
  assert.ok(B.tpp.every((x) => x === null) && B.tcp.every((x) => x === null) && B.fl.every((x) => x === null), "nsw23 booths carry no two-candidate or flow lane");
  // census lanes (.build/map/build_nsw23_boothcensus.py, spliced into the
  // data build): a fixed booth's NSWEC venue coords join it to the SA1 it
  // stands in — dec is that SA1's ABS 2021 national SEIFA deciles, demo the
  // SA1's own people cells on the district lanes' ex-not-stated bases
  // (8-wide; the two income slots stay null). Mobile teams and booths in
  // SA1s the cube does not score stay null; vdec stays null by design —
  // NSWEC publishes no votes-by-SA1, so the voter-footprint read cannot
  // exist
  {
    assert.equal(B.dec.filter(Boolean).length, 2876, "nsw23: 2,876 booths in cube-scored SA1s carry national SEIFA deciles");
    assert.equal(B.dec.filter((x, k) => x === null && B.ty[k] === 4).length, 167, "nsw23: the 167 mobile teams carry no deciles");
    assert.equal(B.dec.filter((x, k) => x === null && B.ty[k] !== 4).length, 74, "nsw23: 74 fixed booths sit in SA1s the cube does not score");
    assert.ok(B.vdec.every((x) => x === null), "nsw23: no voter-footprint deciles (NSWEC publishes no votes-by-SA1 product)");
    assert.equal(B.demo.filter(Boolean).length, 2950, "nsw23: every geocoded fixed booth carries its SA1's people cells");
    for (let k = 0; k < B.n.length; k++) {
      const d = B.dec[k];
      if (d !== null) assert.ok(Array.isArray(d) && d.length === 4 && d.every((x) => x === null || (Number.isInteger(x) && x >= 1 && x <= 10)), `nsw23 ${B.n[k]}: dec is four national deciles or nulls`);
      const dm = B.demo[k];
      if (dm !== null) assert.ok(Array.isArray(dm) && dm.length === 8 && dm[6] === null && dm[7] === null && dm.slice(0, 6).every((x) => x === null || (typeof x === "number" && x >= 0 && x <= 1)), `nsw23 ${B.n[k]}: demo is six 0-1 people cells on null income slots`);
    }
    const balmain = B.n.indexOf("Balmain Public");
    assert.ok(balmain >= 0, "nsw23: the Balmain Public booth exists");
    assert.deepEqual(B.dec[balmain], [10, 10, 7, 10], "nsw23: Balmain Public's SA1 national deciles");
    assert.deepEqual(B.demo[balmain], [0.1004, 0.175, 0.1767, 0.286, 0.6157, 0.0452, null, null], "nsw23: Balmain Public's SA1 people cells");
    assert.deepEqual(B.dec[B.n.indexOf("Inner City Montessori School")], [10, 10, 9, 10], "nsw23: Inner City Montessori School, the top of the range");
    assert.deepEqual(B.dec[B.n.indexOf("Springdale Hghts Public")], [1, 1, 1, 1], "nsw23: Springdale Hghts Public, the bottom of the range");
    assert.deepEqual(B.dec[B.n.indexOf("Lavington E Public")], [1, 1, 2, 1], "nsw23: Lavington E Public, also the bottom of the range");
    const spread = new Set(B.dec.filter(Boolean).map((d) => d[0]).filter((x) => x !== null));
    assert.ok(spread.size >= 8, "nsw23 booth IRSAD deciles spread across the range (a monotone join bug collapses them)");
  }
}

// ── nsw23's upper house is the NSW Legislative Council (senate-nsw23.json):
// 42 members — 21 elected at nsw23 (terms to 2031) joining the 21 carried
// over from 2019 (terms to 2027) — parties and vacancy fills off Parliament
// of NSW records; the statewide first-preference tallies for both elections
{
  const sen = JSON.parse(R("map/data/senate-nsw23.json"));
  assert.equal(sen.year, "nsw23", "senate-nsw23: year");
  assert.equal(sen.lc, true, "senate-nsw23: lc flag");
  assert.equal(sen.seatsN, 42, "senate-nsw23: 42-member council");
  assert.equal(sen.later, 2031, "senate-nsw23: the 2023 cohort's terms run to 2031");
  assert.equal(sen.dd, false, "senate-nsw23: no double dissolution");
  assert.equal(sen.senators.length, 42, "senate-nsw23: 42 members on file");
  assert.equal(new Set(sen.senators.map((s) => s.n)).size, 42, "senate-nsw23: names key the chairs");
  const tally = {};
  for (const s of sen.senators) tally[s.ab] = (tally[s.ab] || 0) + 1;
  assert.deepEqual(tally, { ALP: 15, LIB: 10, NAT: 5, GRN: 4, ONP: 3, AJP: 1, SFF: 2, LCP: 1, LDP: 1 }, "senate-nsw23: the council's party balance at polling day 2023");
  const c23 = sen.senators.filter((s) => s.term === 2031), c19 = sen.senators.filter((s) => s.term === 2027);
  assert.equal(c23.length, 21, "senate-nsw23: 21 elected at nsw23");
  assert.equal(c19.length, 21, "senate-nsw23: 21 carried over from 2019");
  assert.ok(c23.every((s) => s.elected === 2023), "senate-nsw23: the 2031 cohort is elected 2023");
  assert.ok(c19.every((s) => s.elected === 2019 || s.elected == null), "senate-nsw23: the 2027 cohort is elected 2019 or a vacancy fill");
  assert.equal(sen.formal, 4616858, "senate-nsw23: 2023 LC formal vote");
  assert.equal(sen.pformal, 4451146, "senate-nsw23: 2019 LC formal vote");
  assert.ok(sen.votes && sen.pvotes, "senate-nsw23: statewide party votes for both elections");
  assert.equal(Object.values(sen.votes).reduce((a, b) => a + b, 0), sen.formal, "senate-nsw23: 2023 party votes sum to formal");
  assert.equal(Object.values(sen.pvotes).reduce((a, b) => a + b, 0), sen.pformal, "senate-nsw23: 2019 party votes sum to formal");
}

// New South Wales' chambers: the Council rides South Australia's floor
// machinery (the @sa-cells SAF table in app-3c-sa.js) — the chamber's own
// layout plan (.build/map/src/nsw23-lc-plan/) puts its 42 in two straight
// files a side, eleven beside ten, the Usher of the Black Rod at the bar —
// but the Assembly is Victoria's sister room, a horseshoe about a
// rectangular central table with no Hansard desk, so it draws on the
// House's own idiom in app-3-chamber.js (the @nsw-cells NSWB table): its
// planless floor seats every member but the Speaker on benches filled in
// sorted order (no NSW seating plan is filed)
{
  const src = R(".build/map/app/app-3c-sa.js");
  const { SAF, saCells } = new Function(`${src.match(/@sa-cells-begin[\s\S]*?\*\/([\s\S]*?)\/\* @sa-cells-end \*\//)[1]}; return { SAF, saCells };`)();
  assert.ok(!("nswLA" in SAF), "the old straight-block nswLA floor is retired (the Assembly rides NSWB)")
  const nswLC = saCells(SAF.nswLC);
  assert.equal(nswLC.length, 42, "the NSW Council's floor: 42 desks besides the President's chair");
  assert.equal(new Set(nswLC.map((c) => c.id)).size, nswLC.length, "nswLC: desk ids unique");
  assert.equal(nswLC.filter((c) => c.x < 0).length, nswLC.filter((c) => c.x > 0).length, "nswLC: the sides mirror each other");
  // the 2026-10-27 layout: two straight files a side, eleven beside ten, sharing one
  // vertical span, every backrest inside the carpet; the platform, the clerks' desk, the
  // long table and the Usher on one centreline; the transverse backing outline-only
  {
    const F = SAF.nswLC, benchW = 46 / 2 + 4, benchD = 50 / 2 + 4;
    assert.deepEqual(F.straight.map((r) => r.ys[0]), [F.straight[0].ys[0], F.straight[0].ys[0]], "nswLC: both files start level");
    assert.deepEqual(F.straight.map((r) => r.ys[r.ys.length - 1]), [F.straight[0].ys[9], F.straight[0].ys[9]], "nswLC: both files end level");
    for (const r of F.straight) {
      const p = r.ys.map((y, j) => j && +(y - r.ys[j - 1]).toFixed(1)).slice(1);
      assert.ok(p.every((v) => v === p[0]), `nswLC row ${r.row}: one even pitch down the file`);
      for (const y of r.ys) {
        assert.ok(y - (50 / 2 + 4) >= F.room[1], `nswLC row ${r.row}: no backing over the carpet's top edge`);
        assert.ok(y + benchW <= F.room[3], `nswLC row ${r.row}: no backing over the carpet's bottom edge`);
        for (const sx of [r.x - benchD, r.x + benchD]) assert.ok(Math.abs(sx) <= -F.room[0], `nswLC row ${r.row}: the file's whole width fits the room`);
      }
    }
    assert.equal(F.straight[0].ys.length, 10, "nswLC: the inner file seats ten a side");
    assert.equal(F.straight[1].ys.length, 11, "nswLC: the outer file seats eleven a side");
    assert.ok(F.plat && F.plat.y0 >= F.room[1] && F.plat.y1 < F.table[0], "nswLC: the closed platform ends clear above the clerks' desk");
    assert.ok(F.table[1] < F.ltable.y0, "nswLC: the long table stands clear below the clerks' desk");
    assert.ok(F.ltable.y1 < F.usher && F.usher + benchD < F.transverse.y0, "nswLC: table end, Usher and transverse backing keep one centreline order");
    assert.ok(F.ltable.cx + 20 / 2 < F.straight[0].x - benchD, "nswLC: clear floor between the table's flank chairs and the inner file");
    assert.ok(F.transverse.y1 > F.transverse.y0 && F.transverse.gap < F.transverse.half / 2, "nswLC: the transverse backing splits at the bar gap");
    assert.ok(F.officers[0] > F.plat.y1 && F.officers[0] < F.table[0], "nswLC: the two officers' chairs between platform and desk");
    assert.equal(F.twoOfficers, true, "nswLC: two officers chair the clerks' desk, not three below it");
    const widest = Math.max(...F.straight.map((r) => r.x + benchD), F.transverse.half);
    assert.equal(F.transverse.half, widest, "nswLC: the transverse backing is the widest seat, level with the outer files");
    assert.ok(Math.abs(-F.room[0] - (widest + 5.4)) <= 0.6 && F.room[0] === -F.room[2], "nswLC: the side walls hug the seats (widest seat + skirt), level either side");
  }
  assert.ok(!part("app-3c-sa.js").includes('put("The table"'), "no furniture labels on the Council's floor (the nameplate is gone)");
  assert.ok(part("app-3-chamber.js").includes('geom.key !== "nswLC" ? majorityCuts'), "nswLC draws no dashed majority thread");
  assert.ok(part("app-3-chamber.js").includes('geom.key === "nswLC" && opts.labels !== false && !ch.plan'), "nswLC: the majority figure stands alone under the floor");
  const { nswCells } = new Function(`${part("app-3-chamber.js").match(/@nsw-cells-begin[\s\S]*?\*\/([\s\S]*?)\/\* @nsw-cells-end \*\//)[1]}; return { nswCells };`)();
  const nswLA = nswCells();
  assert.equal(nswLA.length, 93, "the NSW Assembly's floor: 92 desks and the Serjeant's chair");
  assert.equal(nswLA.filter((c) => c.id !== "Rsj0").length, 92, "the NSW Assembly: exactly one desk per member on the floor");
  assert.equal(nswLA.filter((c) => c.x < 0).length, 46, "each side seats 12 along the table and 22 on the curved rows");
  assert.equal(new Set(nswLA.map((c) => c.id)).size, nswLA.length, "nswLA: desk ids unique");
  assert.equal(nswLA.filter((c) => c.x < 0).length, nswLA.filter((c) => c.x > 0).length, "nswLA: the sides mirror each other");
  assert.ok(js.includes('const saFloorOf = (m) => (m.year === "nsw23" ? "nswLC" : m.house === "senate" ? "lc" : "ha");'), "saFloorOf routes the SA frames and NSW's Council (never its Assembly)");
  assert.ok(js.includes('m && m.year === "nsw23" && m.house !== "senate" ? nswGeom()'), "chamberGeom routes nsw23's Assembly to its Macquarie Street floor");
  assert.ok(js.includes('const chamberGeom = (m) => (m && m.year === "vic22" ? (m.house === "senate" ? vicLCGeom() : vicGeom()) :'), "chamberGeom routes vic22's two chambers: the Legislative Council on its own floor, the Assembly on the federal-style floor");
  assert.ok(js.includes('nsw23: "Greg Piper"'), "nsw23's Speaker (Greg Piper, first sat 2 May 2023) in the chair");
  assert.ok(js.includes('nsw23: "Lake Macquarie"'), "nsw23's Speaker division is Lake Macquarie");
}

// ── vic22's chamber: Victoria's Legislative Assembly on the House's own floor
// (the @vic-cells VCHB table in app-3-chamber.js — three chairs a side at a
// table drawn without panels, three clerks at its head), seated from the 60th
// Parliament's own plan (map/data/la-seating-plan-vic-2026-08-11.json; node
// .build/map/vic_seating.mjs): the six the plan seats at the table take its
// chairs, the rest fill the benches in chamber order, the Speaker in the chair
{
  const { vicCells, VIC_SERJEANT } = new Function(`${part("app-3-chamber.js").match(/@vic-cells-begin[\s\S]*?\*\/([\s\S]*?)\/\* @vic-cells-end \*\//)[1]}; return { vicCells, VIC_SERJEANT };`)();
  const cells = vicCells(), ids = cells.map((c) => c.id);
  assert.equal(cells.length, 94, "the Assembly's floor: 93 desks and the Serjeant's chair");
  assert.equal(new Set(ids).size, cells.length, "vic floor: desk ids unique");
  assert.equal(cells.filter((c) => c.x < 0).length, cells.filter((c) => c.x > 0).length, "vic floor: the sides mirror each other");
  assert.ok(js.includes('vic22: ["Niddrie", "Kew", "Ivanhoe", "Caulfield", "Dandenong", "Gippsland South"]'), "LEADERS.vic22 names the six table seats in desk order");
  const seats = JSON.parse(R("map/data/seats-vic22.json")), res = JSON.parse(R("map/data/res-vic22.json"));
  const seated = Object.keys(seats.at), desks = Object.values(seats.at);
  assert.equal(seats.plan, "11 August 2026", "seats-vic22: the 60th Parliament's plan date");
  assert.ok(seats.note && seats.note.includes("the six at the table"), "seats-vic22: the note owns the table seatings");
  assert.equal(seated.length, 87, "seats-vic22: every member but the Speaker at a desk");
  assert.ok(!seated.includes("Bendigo West") && res.divs.some((d) => d.n === "Bendigo West"), "seats-vic22: the Speaker (Bendigo West) in the chair, not at a desk");
  assert.ok(seated.every((n) => res.divs.some((d) => d.n === n)), "seats-vic22: districts of the frame");
  assert.ok(desks.every((d) => ids.includes(d)), "seats-vic22: every desk on the drawn floor");
  assert.ok(!desks.includes(VIC_SERJEANT), "seats-vic22: the Serjeant's desk is nobody's seat");
  assert.equal(new Set(desks).size, 87, "seats-vic22: one member a desk");
  const TABLE = { Niddrie: "Lt0", Kew: "Rt0", Ivanhoe: "Lt1", Caulfield: "Rt1", Dandenong: "Lt2", "Gippsland South": "Rt2" };
  for (const [div, desk] of Object.entries(TABLE)) assert.equal(seats.at[div], desk, `seats-vic22: ${div} at the table's ${desk}`);
}

// ── vic22's upper house: Victoria's Legislative Council on its own floor (the
// @viclc-cells VCLC table in app-3-chamber.js — the Parliament's chamber plan
// masked into 44 member desks plus the President's chair, from the committed
// snapshot map/data/lc-seating-plan-vic-2026-10-27.json), the council as it
// sits from the Parliament's own council seating plan of 27 October 2026
// (seats-vic22-lc.json, node .build/map/vic_lc_seating.mjs), its membership
// and the statewide vote from the VEC's 2022 distribution-of-preferences and
// first-preference reports and 2018's region pages (.build/map/
// build_vic22_lc.py). The council is not staggered: all forty members are up
// together at the 2026 state election
{
  const { VCLC, VCLC_ROW } = new Function(`${part("app-3-chamber.js").match(/@viclc-cells-begin[\s\S]*?\*\/([\s\S]*?)\/\* @viclc-cells-end \*\//)[1]}; return { VCLC, VCLC_ROW };`)();
  const deskIds = Object.keys(VCLC.desks);
  assert.equal(deskIds.length, 44, "the Council's floor: 44 member desks");
  const rowN = [1, 2, 3, 4, 5].map((r) => deskIds.filter((id) => VCLC_ROW(id) === r).length);
  assert.deepEqual(rowN, [14, 14, 6, 8, 2], "the Council's floor: 14, 14 down the columns, 6, 8 and 2 round the rings");
  for (const id of deskIds) {
    const [px, py] = VCLC.desks[id];
    assert.ok(Number.isFinite(px) && Number.isFinite(py), `viclc desk ${id} has a place`);
  }
  const sen = JSON.parse(R("map/data/senate-vic22.json"));
  assert.equal(sen.year, "vic22", "senate-vic22: year");
  assert.equal(sen.lc, true, "senate-vic22: lc flag");
  assert.equal(sen.date, "2022-11-26", "senate-vic22: polling day");
  assert.equal(sen.asOf, "2026-10-27", "senate-vic22: the plan's date");
  assert.equal(sen.seatsN, 40, "senate-vic22: 40-member council");
  assert.equal(sen.later, 2026, "senate-vic22: every term runs out at the 2026 election");
  assert.equal(sen.dd, false, "senate-vic22: no double dissolution");
  assert.equal(sen.prev, 2018, "senate-vic22: prev names the 2018 state election");
  assert.equal(sen.gov, "alp", "senate-vic22: Labor in government");
  assert.equal(sen.nextPending, true, "senate-vic22: the incoming council isn't on the frame");
  assert.equal(sen.senators.length, 40, "senate-vic22: 40 members on file");
  assert.ok(sen.senators.every((s) => s.term === 2026 && s.st === "VIC"), "senate-vic22: the uniform term, every member a Victorian");
  const tally = {};
  for (const s of sen.senators) tally[s.ab] = (tally[s.ab] || 0) + 1;
  assert.deepEqual(tally, { ALP: 15, LIB: 11, NAT: 2, GRN: 4, LCV: 2, SFF: 1, AJP: 1, ONP: 1, LDP: 1, FFP: 1, IND: 1 }, "senate-vic22: the council's party balance");
  const fills = Object.fromEntries(sen.senators.filter((s) => s.casual).map((s) => [s.n, s.casual]));
  assert.equal(fills["Richard Welch"] && fills["Richard Welch"].for, "Matthew Bach", "senate-vic22: Welch holds Bach's vacancy");
  assert.equal(fills["Anasina Gray-Barberio"] && fills["Anasina Gray-Barberio"].for, "Samantha Ratnam", "senate-vic22: Gray-Barberio holds Ratnam's vacancy");
  const moved = Object.fromEntries(sen.senators.filter((s) => s.electedAs).map((s) => [s.n, s.electedAs]));
  assert.equal(moved["Adem Somyurek"], "DLP", "senate-vic22: Somyurek sits independent, his seat won for the DLP");
  assert.equal(moved["Moira Deeming"], "LIB", "senate-vic22: Deeming sits Family First, her seat won for the Liberals");
  assert.equal(sen.formal, 3752406, "senate-vic22: 2022 LC formal vote");
  assert.equal(sen.inf, 124726, "senate-vic22: 2022 LC informal vote");
  assert.equal(sen.pformal, 3583478, "senate-vic22: 2018 LC formal vote");
  assert.ok(sen.votes && sen.pvotes, "senate-vic22: statewide party votes for both elections");
  assert.ok(Object.keys(sen.votes).includes("IND") && !Object.keys(sen.votes).includes("ind"), "senate-vic22: the votes keys are the FAM-able codes (IND, never ind)");
  const seats = JSON.parse(R("map/data/seats-vic22-lc.json"));
  assert.equal(seats.plan, "27 October 2026", "seats-vic22-lc: the plan's date");
  assert.deepEqual(seats.roles, { president: "Shaun Leane", leader: "Jaclyn Symes", oppLeader: "Bev McArthur" }, "seats-vic22-lc: the chair and the two leaders");
  const seated = Object.keys(seats.at), desks = Object.values(seats.at);
  assert.equal(seated.length, 39, "seats-vic22-lc: every member but the President at a desk");
  assert.ok(!seated.includes("Shaun Leane"), "seats-vic22-lc: the President in the chair, not at a desk");
  assert.ok(seated.every((n) => sen.senators.some((s) => s.n === n)), "seats-vic22-lc: members of the council file");
  assert.ok(desks.every((d) => deskIds.includes(d)), "seats-vic22-lc: every desk on the drawn floor");
  assert.equal(new Set(desks).size, 39, "seats-vic22-lc: one member a desk");
  assert.equal(seats.at["Jaclyn Symes"], "9", "seats-vic22-lc: the government leader at the table's desk 9");
  assert.equal(seats.at["Bev McArthur"], "25", "seats-vic22-lc: the opposition leader at the table's desk 25");
}

// ── vic22: the Victorian state election of 26 November 2022, the third state
// frame on /map/ (build_vic22_data.py on the committed VEC caches in
// .build/map/src/vic22), 88 Legislative Assembly districts on their own
// timeline row, the 2018 state election as its past join (build_vic22_past.py:
// prev, the agg pprim/pformal and per-candidate c[5] swings), the ABS 2021
// census lanes spliced by build_vic22_demo.py/build_vic22_seifa.py off the
// SA1→district join in .build/map/vic22/assign-sa1.json. Pakenham's and
// Shepparton's district-level 2CP come from the certified declarations of the
// poll (.build/map/src/vic22/certified/), not the VEC's interim 2CP annex;
// their per-booth lanes stay as the annex published them
{
  const res = JSON.parse(R("map/data/res-vic22.json"));
  assert.equal(res.year, "vic22", "vic22: year id");
  assert.equal(res.date, "2022-11-26", "vic22: polling day");
  assert.equal(res.prev, 2018, "vic22: prev names the 2018 state election");
  assert.equal(res.jurisdiction, "VIC", "vic22: jurisdiction");
  assert.equal(res.demoBasis, "sa1", "vic22 records the SA1 census basis");
  assert.deepEqual(Object.keys(res.agg), ["AUS", "VIC"], "vic22 carries only its frame's areas");
  assert.equal(res.divs.length, 88, "vic22: 88 districts");
  for (const f of ["geo-vic22-lo.json", "geo-vic22-hi.json", "data-vic22.json"]) assert.ok(fs.existsSync(path.join(ROOT, "map", "data", f)), "map/data/" + f);
  for (const f of ["senate-vic22.json", "seats-vic22-lc.json"]) assert.ok(fs.existsSync(path.join(ROOT, "map", "data", f)), "map/data/" + f);
  // the winners: derived from the 2CP tallies exactly as the app reads them
  // (tcp entries are [candidate index, votes], so the winner's CANDIDATE is
  // c[d.tcp[slot][0]], never c[slot] — Mulgrave's tcp slots are index 0 and
  // 2); derived == the file's elected flags on all 88 == the official result
  const tally = {};
  let nC5 = 0, nSw = 0, nTpp = 0, nH = 0;
  for (const d of res.divs) {
    const w = d.tcp[0][1] >= d.tcp[1][1] ? d.tcp[0][0] : d.tcp[1][0];
    tally[d.c[w][1]] = (tally[d.c[w][1]] || 0) + 1;
    assert.equal(d.c.findIndex((c) => c[6] === 1), w, `vic22 ${d.n}: the elected flag sits on the 2CP winner`);
    nH += (d.h || []).length;
    for (const row of d.h || []) {
      assert.ok(row[0] === 2018 && typeof row[1] === "number" && typeof row[3] === "string", `vic22 ${d.n}: a 2018 history row ([year, TCP%, party, member])`);
    }
    for (const c of d.c) {
      assert.ok(Number.isFinite(c[5]), `vic22 ${d.n}: c[5] finite for ${c[0]}`);
      nC5++;
      if (c[5] !== 0) nSw++;
    }
    if (d.tpp && Number.isFinite(d.tpp[2])) nTpp++;
  }
  assert.deepEqual(tally, { ALP: 56, GRN: 4, LIB: 19, NAT: 9 }, "vic22: the official 2022 seat tally (Labor's 56-seat majority)");
  assert.deepEqual(res.agg.VIC.seats, tally, "vic22: the agg seat count is the derived tally");
  const byName = Object.fromEntries(res.divs.map((d) => [d.n, d]));
  const winnerOf = (d) => { const w = d.tcp[0][1] >= d.tcp[1][1] ? d.tcp[0][0] : d.tcp[1][0]; return [d.c[w][0], d.c[w][1]]; };
  assert.deepEqual(winnerOf(byName.Mulgrave), ["Daniel Andrews", "ALP"], "vic22: Mulgrave elects Daniel Andrews, the Premier");
  assert.deepEqual(winnerOf(byName.Bulleen), ["Matthew Guy", "LIB"], "vic22: Bulleen elects Matthew Guy, the Opposition Leader");
  // the certified declaration-of-poll 2CPs on the two recount-era districts
  assert.deepEqual(byName.Pakenham.tcp, [[0, 19587], [1, 19280]], "vic22: Pakenham's certified 2CP (Emma Vulin 19,587 v David Farrelly 19,280)");
  assert.deepEqual(byName.Shepparton.tcp, [[0, 23455], [1, 17846]], "vic22: Shepparton's certified 2CP (Kim O'Keeffe 23,455 v Suzanna Sheed 17,846)");
  assert.equal(nH, 85, "vic22: 85 history rows");
  assert.deepEqual(res.divs.filter((d) => !d.h || !d.h.length).map((d) => d.n), ["Berwick", "Greenvale", "Laverton"], "vic22: Berwick, Greenvale and Laverton are new in 2022 — no 2018 row");
  assert.equal(nC5, 742, "vic22: 742 candidates file a swing");
  assert.equal(nSw, 718, "vic22: 718 swings moved on 2018 (24 rest at exactly 0)");
  assert.equal(nTpp, 68, "vic22: 68 districts carry a classic-pair 2PP swing into 2018");
  assert.equal(res.agg.VIC.formal, 3665035, "vic22: 2022 Legislative Assembly formal vote");
  assert.equal(res.agg.AUS.formal, 3665035, "vic22: the AUS agg mirrors the frame's formal");
  assert.equal(res.agg.VIC.pformal, 3514474, "vic22: 2018 Assembly formal vote");
  assert.equal(res.agg.AUS.pformal, 3514474, "vic22: the AUS agg mirrors the frame's 2018 formal");
  for (const st of ["VIC", "AUS"]) {
    const p = res.agg[st].pprim;
    assert.ok(p, `vic22: ${st} agg carries 2018 primaries`);
    assert.equal(Object.values(p).reduce((a, b) => a + b, 0), 3514474, `vic22: ${st} 2018 primaries account for every formal vote`);
  }
  // no preferences lane yet (the SA frames' are modelled by sa_flow_lane.py)
  assert.ok(!("flBasis" in res) && res.divs.every((d) => Array.isArray(d.fl) && d.fl.length === 0), "vic22: no preferences lane");
  // the census lanes (the same splice contract as the other state frames')
  const DMK = ["lang", "a65", "a2034", "fborn", "uni", "blue"], IXS = ["irsad", "irsd", "ier", "ieo"];
  for (const d of res.divs) {
    assert.ok(d.demo && DMK.every((k) => typeof d.demo[k] === "number") && typeof d.demo.p === "number" && typeof d.demo.n === "number", `vic22 ${d.n}: demo row`);
    assert.deepEqual(Object.keys(d.demo).sort(), [...DMK, "n", "p"].sort(), `vic22 ${d.n}: no income lanes`);
    for (const ix of IXS) {
      const c = d.seifa && d.seifa[ix];
      assert.ok(c && typeof c.v === "number" && typeof c.pct === "number" && c.dec >= 1 && c.dec <= 10, `vic22 ${d.n}: seifa ${ix} {v,pct,dec}`);
    }
  }
  assert.equal(byName.Malvern.seifa.irsad.dec, 10, "Malvern is the most advantaged tenth (Victorian geography guard)");
  assert.equal(byName.Dandenong.seifa.irsad.dec, 1, "Dandenong is the least advantaged tenth");
  assert.ok(new Set(res.divs.map((d) => d.seifa.irsad.dec)).size >= 8, "vic22 IRSAD deciles spread across the range (a monotone join bug collapses them)");
  for (const p of ["data/vic22-demo.json", "data/vic22-seifa.json", ".build/map/vic22/assign-sa1.json"]) assert.ok(fs.existsSync(path.join(ROOT, p)), `${p} missing — run the vic22 census pipelines`);
  // the polling places: 1,755 VEC polling-day venues (the commission's venue
  // roll files no mobile/EVC split — every venue is a day booth, type 1).
  // Unlike NSWEC the VEC publishes the booth-level 2CP of the final pair, so
  // tcp fills per venue; tpp and fl stay null, and vdec stays empty by
  // design. The census lanes (dec, demo) are spliced in by
  // .build/map/build_vic22_boothcensus.py, the Victorian twin of the other
  // state frames' boothcensus passes
  const B = res.booths;
  assert.ok(B, "vic22 res carries a booths record");
  const LANES = ["d", "id", "n", "ty", "prem", "sub", "pc", "lat", "lon", "v", "inf", "tpp", "tcp", "fl", "dec", "vdec"];
  for (const k of LANES) assert.ok(Array.isArray(B[k]) && B[k].length === 1755, `vic22 booths.${k}: 1,755 rows`);
  assert.equal(new Set(B.id).size, 1755, "vic22 booth ids are unique");
  assert.deepEqual([...new Set(B.ty)], [1], "vic22 booth types are all polling-day venues (the VEC roll files no mobile/EVC split)");
  for (let k = 0; k < B.n.length; k++) {
    if (B.lat[k] !== null) assert.ok(B.lat[k] > -39.5 && B.lat[k] < -33.5 && B.lon[k] > 140 && B.lon[k] < 151, `vic22 ${B.n[k]}: venue inside Victoria`);
    assert.ok(B.prem[k] && B.sub[k] && Number.isInteger(B.pc[k]), `vic22 ${B.n[k]}: premise, locality and postcode filled`);
    assert.ok(Array.isArray(B.v[k]) && Number.isFinite(B.inf[k]) && Array.isArray(B.tcp[k]) && B.tcp[k].every(Number.isFinite), `vic22 ${B.n[k]}: first-preference vector, informal count and 2CP pair`);
  }
  assert.ok(B.tpp.every((x) => x === null) && B.fl.every((x) => x === null) && B.vdec.every((x) => x === null), "vic22 booths carry no TPP, flow or voter-footprint lane");
  // census lanes (.build/map/build_vic22_boothcensus.py, spliced into the
  // data build): a venue's VEC coords join it to the SA1 it stands in — dec
  // is that SA1's ABS 2021 national SEIFA deciles, demo the SA1's own people
  // cells on the district lanes' ex-not-stated bases (8-wide; the two income
  // slots stay null). 27 venues sit in SA1s the cube scores no deciles for
  // (8 of them still join people cells; the rest come back all-null);
  // vdec stays null by design — the VEC publishes no votes-by-SA1, so the
  // voter-footprint read cannot exist
  {
    assert.equal(B.dec.filter(Boolean).length, 1728, "vic22: 1,728 booths in cube-scored SA1s carry national SEIFA deciles");
    assert.equal(B.demo.filter((dm) => dm && dm.slice(0, 6).some((x) => x !== null)).length, 1736, "vic22: 1,736 booths carry real people cells");
    assert.ok(Array.isArray(B.demo) && B.demo.length === 1755, "vic22 booths.demo: a row per venue");
    for (let k = 0; k < B.n.length; k++) {
      const d = B.dec[k];
      if (d !== null) assert.ok(Array.isArray(d) && d.length === 4 && d.every((x) => x === null || (Number.isInteger(x) && x >= 1 && x <= 10)), `vic22 ${B.n[k]}: dec is four national deciles or nulls`);
      const dm = B.demo[k];
      if (dm !== null) assert.ok(Array.isArray(dm) && dm.length === 8 && dm[6] === null && dm[7] === null && dm.slice(0, 6).every((x) => x === null || (typeof x === "number" && x >= 0 && x <= 1)), `vic22 ${B.n[k]}: demo is six 0-1 people cells on null income slots`);
    }
    const toorak = B.n.indexOf("Toorak Central");
    assert.ok(toorak >= 0, "vic22: the Toorak Central booth exists");
    assert.deepEqual(B.dec[toorak], [9, 8, 5, 9], "vic22: Toorak Central's SA1 national deciles");
    assert.deepEqual(B.demo[toorak], [0.1329, 0.2133, 0.2733, 0.2612, 0.565, 0.0774, null, null], "vic22: Toorak Central's SA1 people cells");
    assert.deepEqual(B.dec[B.n.indexOf("Burwood West")], [10, 10, 10, 10], "vic22: Burwood West, the top of the range");
    assert.deepEqual(B.dec[B.n.indexOf("Wodonga Birallee")], [1, 1, 1, 1], "vic22: Wodonga Birallee, the bottom of the range");
    assert.deepEqual(B.dec[B.n.indexOf("Comet Hill")], [1, 1, 1, 1], "vic22: Comet Hill (Bendigo), also the bottom of the range");
    const spread = new Set(B.dec.filter(Boolean).map((d) => d[0]).filter((x) => x !== null));
    assert.ok(spread.size >= 8, "vic22 booth IRSAD deciles spread across the range (a monotone join bug collapses them)");
  }
}

// Victoria's Council joins the upper-house lane on its own floor (the vic22 LC
// pin above reads the @viclc-cells floor): senate-vic22.json is a frame lane,
// the house-switch offers it and the SEATED_LC plans load with the Senate lane
{
  const sen = part("app-3b-senate.js"), base = part("app-1-base.js");
  assert.ok(!sen.includes("!VIC_YEARS.has(y)"), "vic22 is in the upper-house lane (its Legislative Council is built out)");
  assert.ok(base.includes('const SEATED_LC = new Set(["sa26", "vic22"]);'), "SEATED_LC names the councils with seating plans (South Australia's and Victoria's)");
  assert.ok(sen.includes('const CM = () => (S.view === "chamber" && S.house === "senate" ? (SENM && (senFloor || SENM.year === "vic22") ? SENM : null) : M());'), "the chamber model never waits on the federal floor for vic22's baked-in floor");
  assert.ok(sen.includes('if (!SEN_YEARS.includes(S.year)) return "";'), "the house switch hides on an upper-house-less frame");
  assert.ok(js.includes('vic22: "Maree Edwards"'), "vic22's Speaker (Maree Edwards, MLA for Bendigo West) in the chair");
  assert.ok(js.includes('vic22: "Bendigo West"'), "vic22's Speaker division is Bendigo West");
}

// the state frames on the timeline and in the constants: the per-jurisdiction
// rows (federal top, then New South Wales, Victoria, South Australia) and the
// YEAR_JUR contract — the frame-year→jurisdiction map is YEAR_JUR; only the
// federal abbreviation→name map keeps STATE_NAME (a second top-level
// `const STATE_NAME` beside it killed the assembled bundle at parse —
// SyntaxError — and the page never booted, 2026-10-27)
{
  const base = part("app-1-base.js"), ui = part("app-6-ui.js"), css = part("page.css");
  assert.ok(base.includes('const NSW_YEARS = new Set(["nsw23"]);') && base.includes('const VIC_YEARS = new Set(["vic22"]);'), "NSW_YEARS and VIC_YEARS name the state frames");
  assert.ok(base.includes('const YEAR_JUR = { sa22: "sa", sa26: "sa", nsw23: "nsw", vic22: "vic" };'), "YEAR_JUR maps a frame year to its jurisdiction");
  assert.ok(base.includes('const STATE_YEARS = new Set(Object.keys(YEAR_JUR));'), "STATE_YEARS derives from YEAR_JUR");
  assert.ok(base.includes("const PREV_YEAR = { sa22: 2018, sa26: 2022, nsw23: 2019, vic22: 2018 };"), "the state frames' past joins (vic22's is the 2018 election)");
  assert.ok(base.includes('const FRAME_YEAR = { now: 2026, sa22: 2022, sa26: 2026, nsw23: 2023, vic22: 2022 };'), "vic22's calendar year is 2022");
  assert.ok(/GOV = \{[^}]*nsw23: "alp"/.test(base) && /GOV = \{[^}]*vic22: "alp"/.test(base), "the state frames' winning sides are Labor");
  assert.ok(/PM = \{[^}]*nsw23: "Chris Minns"/.test(base) && /PM = \{[^}]*vic22: "Daniel Andrews"/.test(base), "the Premiers are named (nsw23's Chris Minns, vic22's Daniel Andrews)");
  assert.equal((js.match(/const STATE_NAME = /g) || []).length, 1, "one top-level STATE_NAME across the app parts (frame years map through YEAR_JUR)");
  assert.ok(/\.mp-time \{ flex: none; position: relative; height: 169px;/.test(css) && /\.mp-time \{ height: 148px; \}/.test(css), "the timeline bar holds four jurisdiction rows (169px; 148px on the phone rung)");
  assert.ok(ui.includes("const STATE_ROW_PREV_X = { sa: SA_PREV_X, nsw: NSW_PREV_X, vic: VIC_PREV_X };"), "each jurisdiction's row carries its own previous-election stop");
  assert.ok(ui.includes('<text class="yr row"'), "the rows carry captions");
  assert.ok(ui.includes('aria-label="Federal elections 2004 to now, and New South Wales, Victorian and South Australian state elections; choose one"'), "the timeline names its jurisdiction rows to a screen reader");
  // a state frame's label: the five-char key "nsw23" ends in its two-digit
  // year — slice(2) read it as "NSW w23" (the same derivation on the
  // federal four-char keys was why it was written that way)
  assert.ok(base.includes("`${YEAR_JUR[y].toUpperCase()}20${String(y).slice(-2)}`"), "a state frame's label is the jurisdiction word + full year, no space (nsw23 → 'NSW2023', never 'NSW w23' or 'NSW 23')");
  assert.ok(ui.includes('short ? "’" + String(y).slice(-2) : yearLabel(y)'), "the timeline's short row shows the two-digit year only (nsw23 → '’23')");
}

console.log("PASS: map page – an ext menu page outside the main build, linked in both designs and the shell, two-column menus, assembled assets current, data present, plan years seated by the plan, NSW's 2023 and Victoria's 2022 frames on their own timeline rows, in the sitemap");
