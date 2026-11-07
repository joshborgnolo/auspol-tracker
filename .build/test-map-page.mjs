/* test-map-page.mjs – pins the Electoral-maps page (/map/, 2026-10-25) into the site:
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
import { coreText } from "./map/core-split.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const R = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const sum2 = (p) => (p ? p[0] + p[1] : 0);
const app = R(".build/newtracker/assets/73de0c58-f11f-4793-9f90-77e583ab051b.js");
const views = R(".build/newtracker/assets/d1a1d215-370c-4ebc-878b-7eeea9ad8102.js");

// ---- TABS: a menu page with ext, never a view of the main page
assert.ok(app.includes('{ id: "map", label: "Electoral map", menu: true, ext: true,'), "TABS lists the map as an ext menu page");
assert.ok(app.includes("const TAB_IDS = TABS.filter((t) => !t.ext).map((t) => t.id);"), "no path of the main page is the map's");
assert.ok(app.includes("TABS.filter((t) => t.menu && !t.ext)"), "no menu-page view for the map");
assert.equal((app.match(/const ids = TAB_IDS;/g) || []).length, 2, "the swipe and the arrow keys turn only the main page's own pages");
assert.ok(app.includes('if (window.JUR) TABS.splice(TABS.findIndex((t) => t.id === "map"), 1);'), "/vic/'s menu never holds the map");
const build = R(".build/newtracker/build.mjs");
assert.ok(!/\{ id: "map", label:/.test(build), "build.mjs emits no tab document for the map");

// ---- the menu: an ext row is a plain link to /map/, in both designs
assert.ok(views.includes('const menuHref = (t) => (t.ext ? t.href || "/" + t.id + "/"'), "the menu's href for an ext row is its own path (or its href: /vic/'s Election model row opens /model/#j=vic)");
assert.ok(!/id: "map"[^}]*href:/.test(app), "the map row needs no href override: its id derives /map/ already (the /maps/ habitation is a redirect stub)");
// three: both designs' rows, and the redesign's flows-explainer row once its numbers are fields (its link sits beside them)
assert.equal((views.match(/href=\{menuHref\(t\)\}/g) || []).length, 3, "both designs' menus link through menuHref");
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
assert.ok(own.includes('<span class="sh-menu-lab">Electoral map</span>') && own.includes('aria-label="More pages – on Electoral map"'), "the button names the page");
assert.ok(!/<span class="sh-menu-lab">Electoral map/.test(shellHeader({})), "other pages' buttons still say More");

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
const js = ["app-1-base.js", "app-2-map.js", "app-2b-draw.js", "app-3-chamber.js", "app-3b-senate.js", "app-3c-sa.js", "app-4-story.js", "app-5-list.js", "app-6-ui.js", "app-7-full.js"].map(part).join("\n");
// era-impossible options drop from the frame's own menus: the IRSAD
// 'Advantage and disadvantage' index before the 2001-census four-index
// suite, and One Nation's family option before its April 1997 formation
// made any federal 1998 vote possible.
assert.ok(/const ixFor = \(m\) => IX\.filter\(\(k\) => !m\.hasIx \|\| m\.hasIx\[k\] !== false\)/.test(js), "the census Advantage menu filters by the frame's own scored indexes");
assert.ok(js.includes("famEraOpts = (m) => FAMS.filter") && js.includes("FAM_FORMED = { onp: 1998 }"), "the family menu drops One Nation before its first possible federal votes");
assert.ok(js.includes('if (S.party === "onp" && !famEraOpts(b).includes("onp")) S.party = "lnp";'), "a year swap onto an era before One Nation drops S.party to the Coalition family");
// the script carries every tracked data file's hash, so a release never reads a cached older copy (data-stamp.mjs)
assert.equal(R("map/map.js"), stampMeta(stampData(`/* the Electoral map – assembled from .build/map/app by .build/map/assemble.mjs; edit the parts, not this file */\n(() => {\n${js}\n})();\n`, dataStamps(ROOT)), metaFacts(ROOT)), "map/map.js is current, its data stamps too (node .build/map/assemble.mjs after rebuilding any map/data file)");
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
assert.ok(js.includes("const DATA_V = /*@data-stamps*/{};") && js.includes("fetch(v ? `${u}?v=${v}` : u"), "getJSON asks for each data file by its stamped hash");
// each results file's core (core-split.mjs: the file without its polling places' census lanes) is
// current and committed, and a frame loads it first, the full file only for those lanes (loadPpl)
for (const f of fs.readdirSync(path.join(ROOT, "map/data")).sort()) {
  const m = f.match(/^res-(\w+)\.json$/);
  if (!m) continue;
  const c = `map/data/core-${m[1]}.json`;
  assert.ok(fs.existsSync(path.join(ROOT, c)) && R(c) === coreText(R("map/data/" + f)), `${c} is current (node .build/map/assemble.mjs after rebuilding ${f})`);
  if (dataStamps(ROOT)["res-" + m[1] + ".json"]) assert.ok(dataStamps(ROOT)["core-" + m[1] + ".json"], `${c} is committed beside ${f} (git add it: the page asks for it by its stamp)`);
}
assert.ok(js.includes("getJSON(`/map/data/core-${ry}.json`, bg).catch(() => getJSON(fullU, bg))") && js.includes("function loadPpl(y)") && js.includes("for (const k of m.pplLanes) if (F[k]) B[k] = F[k];"), "a frame loads its core file, the census lanes from its res file when first wanted");
assert.ok(/var b=\(\/\[#&\]l=seifa\(&\|\$\)\/\.test\(location\.hash\)\|\|!V\["core-"\+ry\+"\.json"\]\?"res-":"core-"\)/.test(R("map/index.html")), "the page's warmup asks for the landing frame's core file (its res file on a Census landing)");
assert.equal(R("map/map.css"), part("page.css"), "map/map.css is current (node .build/map/assemble.mjs)");
// how votes were cast: each seat's Labor and Coalition votes by pile (build_vote_piles.py, re-run after anything that
// rewrites a res file) add up to its final count; every seat from 2016, before that the Labor v Coalition pairs, none in 1993
{
  const FEDERAL = [1996, 1998, 2001, 2004, 2007, 2010, 2013, 2016, 2019, 2022, 2025];
  const add = (v2) => Object.values(v2).reduce((t, p) => [t[0] + p[0], t[1] + p[1]], [0, 0]);
  for (const y of FEDERAL) {
    const r = JSON.parse(R(`map/data/res-${y}.json`)), b = r.booths;
    const early = new Array(r.divs.length).fill(0);
    b.d.forEach((d, j) => { if (b.ty[j] === 5) early[d] += b.v[j].reduce((a, v) => a + v, 0); });
    r.divs.forEach((d, i) => {
      assert.equal(d.vt.ppvc, early[i], `${y} ${d.n}: vt.ppvc counts formal votes at early centres, as every other pile in vt does`);
      const fam = d.tcp.map(([c]) => d.c[c][3]), classic = fam.includes("alp") && fam.includes("lnp");
      if (y >= 2016) {
        assert.ok(d.vt2, `${y} ${d.n} has piles (python3 -I .build/map/build_vote_piles.py, then assemble)`);
        assert.deepEqual(add(d.vt2), d.tpp.slice(0, 2), `${y} ${d.n}: the piles add up to the two-party count`);
        for (const [k, p] of Object.entries(d.vt2)) assert.ok(k in d.vt || ["day", "mob"].includes(k), `${y} ${d.n}: unknown pile ${k}`);
        assert.equal(sum2(d.vt2.pre), d.vt.pre, `${y} ${d.n}: declaration pre-poll votes all reach the two-party count`);
        assert.equal(sum2(d.vt2.post), d.vt.post, `${y} ${d.n}: postal votes all reach the two-party count`);
      } else if (classic) {
        assert.ok(d.vt2, `${y} ${d.n}: a Labor v Coalition seat has piles`);
        const A = d.tcp[fam.indexOf("alp")][1], C = d.tcp[fam.indexOf("lnp")][1];
        assert.deepEqual(add(d.vt2), [A, C], `${y} ${d.n}: the piles add up to the final two`);
      } else assert.ok(!d.vt2, `${y} ${d.n}: no two-party split from a final two of another pair`);
    });
  }
  assert.ok(JSON.parse(R("map/data/res-1993.json")).divs.every((d) => !d.vt2), "1993's count stops at the division: no piles");
  // the national figures quoted when this shipped: the headline is the AEC's own, and the piles reach it
  const r = JSON.parse(R("map/data/res-2025.json")), T = {};
  for (const d of r.divs) for (const [k, p] of Object.entries(d.vt2)) { const t = (T[k] ??= [0, 0]); t[0] += p[0]; t[1] += p[1]; }
  const lab = (k) => Math.round((1000 * T[k][0]) / (T[k][0] + T[k][1])) / 10;
  assert.deepEqual([lab("day"), lab("ppvc"), lab("post")], [58.0, 53.0, 51.6], "2025 on the day, early centres, postal");
  assert.deepEqual(add(Object.fromEntries(Object.entries(T))), r.agg.AUS.tpp.slice(0, 2), "2025's piles add up to the national two-party count");
}
// the primary-change same-place lane (build_map_data.py's prevFp join): every
// federal frame from 2007 carries the previous election's family shares at
// each polling place, joined by AEC polling-place id; a place that lapsed
// carries null and the story copy reads "new place". Before 2007 the previous
// election predates the committed lanes, so the lane itself is absent — and
// the kind-aware "no like-for-like count" wording covers earlier frames and
// the state frames, which carry no join
{
  const ORA = { 2007: 8013, 2010: 7972, 2013: 8480, 2016: 7868, 2019: 7799, 2022: 7809, 2025: 7882 };
  const FAMS6 = ["alp", "lnp", "grn", "onp", "ind", "oth"];
  const FAMS6_SORTED = [...FAMS6].sort();
  for (const [ys, joined] of Object.entries(ORA)) {
    const y = +ys, b = JSON.parse(R(`map/data/res-${y}.json`)).booths, pf = b.prevFp;
    assert.ok(Array.isArray(pf) && pf.length === b.id.length, `${y}: booths.prevFp rides beside every polling place`);
    assert.equal(pf.filter((x) => x != null).length, joined, `${y}: ${joined} places stood at the previous election`);
    let greens = 0;
    for (const row of pf) {
      if (row == null) continue;
      assert.deepEqual(Object.keys(row).sort(), FAMS6_SORTED, `${y}: a prevFp row names the six families`);
      let t = 0; for (const k of FAMS6) { assert.ok(row[k] >= 0 && row[k] <= 100, `${y}: a prevFp share in range`); t += row[k]; }
      assert.ok(Math.abs(t - 100) < 0.1, `${y}: a prevFp row's shares sum to 100`);
      greens += row.grn > 2 ? 1 : 0;
    }
    assert.ok(greens > 0, `${y}: at least one place joined (the first-read bug claimed none stood, Greens included)`);
  }
  for (const y of [1996, 1998, 2001, 2004])
    assert.ok(!JSON.parse(R(`map/data/res-${y}.json`)).booths.prevFp, `${y}: no prevFp lane — the previous election predates the lanes`);
  // a hand-read fixture: Fitzroy's 2022 family shares (a Greens heartland the
  // first report named), against its 2025 row
  {
    const b = JSON.parse(R("map/data/res-2025.json")).booths;
    const j = b.id.indexOf(4631);
    assert.ok(b.n[j] === "Fitzroy" && b.prevFp[j] != null, "2025: Fitzroy joined to its 2022 self");
    assert.deepEqual(b.prevFp[j], { alp: 23.1, lnp: 8.33, grn: 59.23, onp: 0.65, ind: 1.01, oth: 7.68 }, "Fitzroy's 2022 family shares");
  }
  assert.ok(js.includes('return ctx && ctx.m.res.booths && ctx.m.res.booths.prevFp ? "New place since last time, so no change" : "No like-for-like count on file for this election";'),
    "the booth-level fp-change no-value copy names the real cause, never a party claim");
  assert.ok(js.includes('if (boothsOn && ch && m.res.booths && m.res.booths.prevFp) h += `<div class="lg-note"><span class="lg-hatch"></span>Place not used last time</div>`;'),
    "the fp-change legend explains the unjoined booths' hatch");
}
assert.ok(js.includes("if (d.vt) h += vtBlock([d]);") && js.includes("if (cast.length) h += vtBlock(cast, true, castScope?.geography);"), "a seat, a state and the country share one How votes were cast block");
assert.ok(js.includes('const castScope = m.year === 2025 || m.year === "now" ? vtScope(m, st) : null;') && js.includes("castScope.divs : m.res.divs.filter("), "the 2025 and Now charts follow the selected figures scope; the area block reads election results, since Now blanks a by-election's piles");
assert.ok(js.includes('if (M().year === 2025 || M().year === "now") return vtBandsBlock('), "the Now frame shows the band chart, not the old table");
assert.ok(js.includes("vt2: d.vt2 || null"), "a seat keeps its piles' two-party split");
assert.ok(!/\.stackl/.test(R("map/map.css")), "the old two-column legend is gone");
// the birthplace menus' two eras: the 2021-GCP ten-country set, and the
// 2001-census edition's own nine (its B 06 prints a whole-UK row the
// menu leads with, as eng leads the GCP menu — used by both the 2001
// and 2004 federal frames; the 2006/2011 editions trim to the eight)
const GCP_COB_KEYS = ["eng", "ind", "chn", "nzl", "phl", "vnm", "zaf", "ita", "lka", "sct"];
const CENSUS01_COB_KEYS = ["uk", "ind", "chn", "nzl", "phl", "vnm", "zaf", "ita", "lka"];
// the Ancestry select menu's twelve options (the 2026-10-31 lanes arc; full words so it can't collide with the birthplace menu's abbreviated keys)
const ANC_GCP = ["english", "australian", "irish", "scottish", "chinese", "italian", "german", "indian", "filipino", "dutch", "vietnamese", "lebanese"];
for (const y of [1996, 2001, 2004, 2007, 2010, 2013, 2016, 2019, 2022, 2025]) {
  for (const f of [`res-${y}.json`, `geo-${y}-lo.json`, `geo-${y}-hi.json`]) assert.ok(fs.existsSync(path.join(ROOT, "map", "data", f)), "map/data/" + f);
}
{ // 1996: AEC statistics-pack results, Handbook polygons and the common
  // historical_booth_locations.py matcher. README-history.md documents the
  // source limitations and superseded ABS/venue matching recipes.
  for (const f of ["senate-1996.json", "senate-vote-1996.json", "res-1996.json"]) assert.ok(fs.existsSync(path.join(ROOT, "map", "data", f)), "1996 lane " + f + " on disk");
  assert.ok(fs.existsSync(path.join(ROOT, "data", "booth-seifa-1996.json")), "the 1996 SEIFA venue store (derive-booth-seifa-stats90s.py; historically derive-1996-venues.py) is on disk");
  const D = JSON.parse(R("map/data/res-1996.json"));
  const r = JSON.parse(R("map/data/res-1996.json"));
  const S = JSON.parse(R("map/data/senate-1996.json"));
  const SV = JSON.parse(R("map/data/senate-vote-1996.json"));
  assert.equal(D.year, 1996);
  assert.equal(D.divs.length, 148, "1996 has its 148 divisions (Namadgi's only term)");
  assert.equal(D.date, "1996-03-02");
  assert.equal(D.prev, 1993, "1996's previous election is 1993");
  assert.equal(D.speaker, "Casey");
  assert.equal(D.event, null, "1996 has no VTR event id (stats-pack era)");
  const tally = {};
  for (const d of D.divs) for (const c of d.c) if (c[6] === 1) tally[c[1]] = (tally[c[1]] || 0) + 1;
  assert.deepEqual(tally, { ALP: 49, LP: 76, NP: 18, CLP: 1, IND: 4 },
    "the 1996 House per the AEC's certified hcands (Howard's Coalition 95 seats and the four independents: Andren, Rocher, Campbell, Filing)");
  // the hand-keyed make-up record behind the federal rail's 1996 stop bar
  // (its 2001 class line landed the same way in b5eb8d35's recital): bind
  // it to the certified lanes it must never drift from
  {
    const SUM_J = JSON.parse(R("map/data/summary.json"));
    assert.ok(SUM_J.seats["1996"] && SUM_J.tpp["1996"], "summary.json carries the 1996 record (seats + tpp)");
    const fam = (p) => (p === "ALP" ? "alp" : ["LP", "NP", "CLP"].includes(p) ? "lnp" : "ind");
    const want = {};
    for (const row of fs.readFileSync(path.join(ROOT, ".build/aec-flow-src/hcands-1996.txt"), "utf8").trim().split("\n").slice(1)) {
      const c = row.split(";");
      if (c[3].trim() !== "#") continue;
      const st = c[0], party = c[5];
      for (const st2 of [st, "AUS"]) {
        want[st2] = want[st2] || {};
        want[st2][fam(party)] = (want[st2][fam(party)] || 0) + 1;
      }
    }
    for (const [st, rowsum] of Object.entries(want)) {
      assert.deepEqual(SUM_J.seats["1996"][st], rowsum, `summary.seats.1996.${st} drifts from the certified hcands census`);
    }
    assert.equal(Object.values(SUM_J.seats["1996"].AUS).reduce((a, b) => a + b, 0), 148,
      "summary.seats.1996.AUS totals the 148-member chamber");
    // tpp: per-state Labor 2PP shares recomputed from divs-1996's certified columns
    const tsum = {};
    for (const row of fs.readFileSync(path.join(ROOT, ".build/aec-flow-src/divs-1996.txt"), "utf8").trim().split("\n").slice(1)) {
      const c = row.split(";");
      const st = c[0];
      tsum[st] = tsum[st] || [0, 0];
      tsum[st][0] += parseInt(c[12], 10);
      tsum[st][1] += parseInt(c[13], 10);
    }
    for (const [st, [a, coa]] of Object.entries(tsum)) {
      const share = Math.round((100 * a) / (a + coa) * 100) / 100;
      assert.ok(Math.abs(SUM_J.tpp["1996"][st] - share) < 0.005,
        `summary.tpp.1996.${st} (${SUM_J.tpp["1996"][st]}) must equal the certified division sum (${share})`);
    }
  }
  assert.equal(Object.keys(D.booths).length, 26, "17 result lanes plus approximate-location provenance + census demo rows + the map-people-fill arc's three cohort cob/rel/ten lanes + the medinc booth column the frame's 1991-era census income print fills + the Age family's four lanes");
  {
    const alp2 = 100 * D.agg.AUS.tpp[0] / (D.agg.AUS.tpp[0] + D.agg.AUS.tpp[1]);
    assert.ok(Math.abs(alp2 - 46.372) < 0.005, "1996 national TPP matches divs.txt's canonical figure exactly (got " + alp2.toFixed(2) + ")");
    assert.ok(Math.abs(D.agg.AUS.tpp[2] - -5.06) < 0.01, "1996's national swing vs 1993 is the Howard landslide's -5.06 (got " + D.agg.AUS.tpp[2] + ")");
  }
  // the stats-era floor now bridges in census people lanes: the '90s
  // people-interp arc interpolates the 1991↔1996 censuses to election day
  // (1996's f sits at the 1996 census's side), carry-proofed against the
  // venue-nearest surveyed-linework rescue. Its income cuts ride the 1991
  // era print (household-basis weekly-equivalents): the 1996 census's own
  // workspace prints no income table, and 1991 is the frame's nearest
  // income era
  for (const f of [r, D]) {
    assert.equal(f.demoBasis, "venue", "1996's census people basis is the venue-CD lane (the '90s people-interp arc)");
    assert.ok(f.incomeCuts && f.incomeCuts.dollarsYear === 1991 && f.incomeCuts.basis === "households", "1996's income cuts ride the 1991 household-basis era print");
    assert.equal(f.seifaCuts.irsad, null, "1996 has no irsad cut (pre-IRSAD censeration)");
    for (const ix of ["irsd", "ier", "ieo"])
      assert.ok(Array.isArray(f.seifaCuts[ix]) && f.seifaCuts[ix].length === 9, `1996's ${ix} cut carries the nine national decile edges`);
    assert.ok(f.demoInterp && f.demoInterp.f === 0.914067 && f.demoInterp.c0 === 1991 && f.demoInterp.c1 === 1996 && f.demoInterp.nearestSide === 1996,
      "1996's demoInterp record interpolates 1991↔1996 at f=0.914067 nearest-1996-side");
  }
  { // the SEIFA lens on the 1996 frame (the map-people-fill add):
    // era division blocks via derive-division-seifa-stats90s.py, booth
    // deciles via derive-booth-seifa-stats90s.py over the same venue seam
    assert.equal(D.divs.filter((d) => d.seifa && Object.values(d.seifa).length).length, 148,
      "every 1996 division carries its SEIFA cells");
    const banks = D.divs.find((d) => d.n === "Banks");
    assert.ok(Math.abs(banks.seifa.irsd.v - 1007.987) < 0.002 && Math.abs(banks.seifa.irsd.pct - 0.633393) < 0.000002,
      "1996 Banks irsd cell pins (the measured 1996-census value with the 1991↔1996 pcti lane displayed; got " + JSON.stringify(banks.seifa.irsd) + ")");
    assert.ok(!banks.seifa.irsad, "1996: no irsad cell anywhere (pre-IRSAD era)");
    const decs = D.booths.dec || [];
    const nDec = decs.filter((x) => x && x.some((v) => v != null)).length;
    assert.ok(nDec > 6000, `most 1996 booths carry SEIFA deciles (got ${nDec})`);
    assert.ok(decs.every((row) => row === null || (row.length === 4 && row[0] == null && row.slice(1, 4).every((v) => v == null || (Number.isInteger(v) && v >= 1 && v <= 10)))),
      "1996: every landed dec row is [null + irsd/ier/ieo 1..10]");
  }
  assert.equal(D.divs.filter((d) => d.demo).length, 148, "every 1996 division carries its census CD-sum demo row");
  {
    const nBooth = (D.booths.demo || []).filter((x) => x !== null).length;
    assert.ok(nBooth > 6000, `most 1996 booths carry census demo cells (got ${nBooth})`);
    const d0 = D.divs.find((d) => d.demo);
    assert.ok(d0 && d0.demo.fborn > 0 && d0.demo.uni > 0 && d0.demo.p > 10000,
      "a sample 1996 division's demo row reads real census shares");
  }
  // the new Senate as at 1 July 1996: LP 31, ALP 29, Democrats 7, NP 6, GRN 2, IND 1
  {
    const tot = {};
    for (const s of S.senators) tot[s.ab] = (tot[s.ab] || 0) + 1;
    assert.deepEqual(tot, { ALP: 29, LP: 31, AD: 7, NP: 6, GRN: 2, IND: 1 }, "the Senate that took its seats 1 July 1996");
    assert.equal(S.senators.length, 76, "all 76 senators seat that day (zero vacancies over the refetched handbook caches)");
  }
  assert.equal(SV.year, 1996);
  {
    // family shares from the senate-fpv recompute: the box-and-ballot elections of the era
    const nat = [0, 0, 0, 0, 0, 0, 0];
    for (const dv of Object.values(SV.divs)) for (let i = 0; i < 7; i++) nat[i] += dv[i] || 0;
    const fam = (i) => 100 * nat[i + 1] / nat[0];
    assert.ok(Math.abs(fam(0) - 36.2) < 0.3 && Math.abs(fam(1) - 44.0) < 0.3 &&
              Math.abs(fam(2) - 2.4) < 0.2 && fam(3) === 0 && Math.abs(fam(4) - 0.1) < 0.05 &&
              Math.abs(fam(5) - 17.3) < 0.3,
      "the 1996 Senate family shares over the senate-fpv lanes (got " +
      [fam(0), fam(1), fam(2), fam(3), fam(4), fam(5)].map((v) => v.toFixed(1)).join(",") + ")");
  }
}
{ // the 1993 and 1998 statistics-era frames, people-interp covered by the
  // '90s arc: derive-cd-91-96-ced-alloc.py's era memberships (Handbook-era
  // polygons — never the ASGC CED layer carrying its WA defect), the
  // extract-bcp-aurin-tally.py census lane extractions and
  // derive-booth-demo-90s.py's six venue stores. The lanes themselefs are
  // pinned per-store at the seat-model tests; here the frames' publish-side
  // contract: interp record, division/booth demo coverage and the
  // income/SEIFA-floor invariants the rest of the page relies on
  for (const [y, f, c0, c1, near, nDivs, sf, cuts] of [[1993, 0.320197, 1991, 1996, 1991, 147, [1011.837, 0.625583, 7], { dy: 1991, basis: "households", lo: 345.51 }], [1998, 0.431308, 1996, 2001, 1996, 148, [1008.1, 0.615664, 7], "income-span"]]) {
    const D = JSON.parse(R(`map/data/res-${y}.json`));
    assert.equal(D.year, y);
    assert.equal(D.divs.length, nDivs, `${y} has its ${nDivs} divisions`);
    assert.equal(D.demoBasis, "venue", `${y}'s census people basis is the venue-CD lane`);
    assert.ok(D.demoInterp && D.demoInterp.f === f && D.demoInterp.c0 === c0 && D.demoInterp.c1 === c1 && D.demoInterp.nearestSide === near,
      `${y}'s demoInterp blends ${c0}↔${c1} at f=${f} nearest the ${near} census`);
    if (cuts === "income-span") {
      const ic = D.incomeCuts, ib = D.demoInterp.incomeBlock;
      assert.ok(ic && ic.dollarsYear === 2001 && ic.hiQuantile === 0.75 &&
        Math.abs(ic.loCutWeekly - 456.13) < 0.02 && Math.abs(ic.hiQCutWeekly - 1432.72) < 0.02 &&
        ic.sides && ic.sides["1991"] && Math.abs(ic.sides["1991"].loCutWeekly - 345.51) < 0.02 && ic.sides["1991"].dollarsYear === 1991 &&
        ic.sides["2001"] && ic.sides["2001"].dollarsYear === 2001,
        y + ": the 1996-census side prints no income table, so the money lanes interpolate the income-carrying 1991 and 2001 editions (incomeCuts rides the 2001 nearest side, both sides named)");
      assert.ok(ib && ib.c0 === 1991 && ib.c1 === 2001 && ib.nearestSide === 2001 && Math.abs(ib.f - 0.715654) < 0.0005,
        `${y}'s incomeBlock blends 1991↔2001 at the wider day's share, nearest 2001`);
    } else {
      assert.ok(D.incomeCuts && D.incomeCuts.dollarsYear === cuts.dy && D.incomeCuts.basis === cuts.basis && Math.abs(D.incomeCuts.loCutWeekly - cuts.lo) < 0.02, `${y}: income cuts ride the ${cuts.dy} ${cuts.basis}-basis era print`);
    }
    // the SEIFA lens reads on the '90s frames (derive-division-seifa-stats90s.py
    // + derive-booth-seifa-stats90s.py): three-index era only — IRSAD predates
    // its SEIFA-2001 invention, so irsad cut+lanes stay null here
    {
      const c = D.seifaCuts;
      assert.equal(c.irsad, null, `${y} no irsad cut (pre-IRSAD censeration)`);
      for (const ix of ["irsd", "ier", "ieo"]) {
        assert.ok(Array.isArray(c[ix]) && c[ix].length === 9 && c[ix].every((v) => typeof v === "number"),
          `${y}: ${ix} cut carries nine national decile edges`);
        assert.deepEqual([...c[ix]].sort((a, b) => a - b), c[ix], `${y}: ${ix} cut edges ascending`);
      }
      assert.equal(D.divs.filter((d) => d.seifa && Object.values(d.seifa).length).length, nDivs,
        `every ${y} division carries its SEIFA cells`);
      assert.equal(D.divs.filter((d) => d.seifa && d.seifa.irsad).length, 0,
        `${y}: no division scores an irsad decile (IRSAD debuts in the 2001-census SEIFA suite); the app's ixFor/hasIx menu pair omits an era index only proved null this way`);
      const banks = D.divs.find((d) => d.n === "Banks");
      const [v, pctPin, dec] = sf;
      assert.ok(Math.abs(banks.seifa.irsd.v - v) < 0.002 && Math.abs(banks.seifa.irsd.pct - pctPin) < 0.000002,
        `${y} Banks irsd cell pins (v ${v}, displayed pct ${pctPin} = the pcti lane; got ${JSON.stringify(banks.seifa.irsd)})`);
      assert.equal(banks.seifa.irsd.dec, dec, `${y} Banks irsd map decile`);
      assert.ok(!banks.seifa.irsad, `${y}: no irsad cell anywhere on the pre-IRSAD frame`);
      const decs = D.booths.dec || [];
      assert.equal(decs.length, D.booths.id.length, `${y} booth dec lane rides the full registry`);
      const nDec = decs.filter((x) => x && x.some((v) => v != null)).length;
      assert.ok(nDec > 5800, `most ${y} booths carry SEIFA deciles (got ${nDec})`);
      assert.ok(decs.every((row) => row === null || (row.length === 4 && row[0] == null && row.slice(1, 4).every((v) => v == null || (Number.isInteger(v) && v >= 1 && v <= 10)))),
        `${y}: every landed dec row is [null + irsd/ier/ieo 1..10]`);
    }
    assert.equal(D.divs.filter((d) => d.demo).length, nDivs, `every ${y} division carries its census CD-sum demo row`);
    const nBooth = (D.booths.demo || []).filter((x) => x !== null).length;
    assert.ok(nBooth > 5800, `most ${y} booths carry census demo cells (got ${nBooth})`);
    const d0 = D.divs.find((d) => d.demo);
    assert.ok(d0 && d0.demo.fborn > 0 && d0.demo.uni > 0,
      `${y}: a sample division's demo row reads real census shares`);
    // the follow-on people cohorts of the map-people-fill arc (birthplace-
    // country menu, religion, tenure) on the statistics-era frames: menus are
    // the era prints' own intersections (1991-era sides: seven cob keys, no
    // India/Sri Lanka; 1996/2001-era sides: the era's nine), the era print
    // holes are null reads end-to-end (1991-census sides carry no Hindu,
    // 1996's tenure table no landlord arm), and every frame carries the
    // cohorts on its era census districts
    {
      const wanted = y === 1998
        ? ["uk", "ind", "chn", "nzl", "phl", "vnm", "zaf", "ita", "lka"]
        : ["uk", "chn", "nzl", "phl", "vnm", "zaf", "ita"];
      assert.deepEqual(D.cobKeys, wanted, `${y}: the cob menu follows its era print set`);
      assert.equal(D.relKeys.length, 10, `${y}: ten religion options ride the frame`);
      assert.equal(D.relKeys[0], "norel", `${y}: religion menu leads with No religion`);
      assert.deepEqual(D.tenKeys, ["mort", "rent", "own", "rentPub"], `${y}: tenure menu's four options`);
      for (const k of ["cob", "rel", "ten"]) {
        const lane = D.booths[k] || [];
        assert.equal(lane.length, D.booths.id.length, `${y} ${k} rides the full registry`);
        const n = lane.filter((x) => x !== null).length;
        assert.ok(n > 5800, `${y}: most booths carry ${k} cohorts (got ${n})`);
        const wk = { cob: D.cobKeys.length, rel: D.relKeys.length, ten: D.tenKeys.length }[k];
        lane.forEach((row) => {
          assert.ok(row === null || (row.length === wk && row.every((x) => x == null || typeof x === "number")),
            `${y}: every landed ${k} cohort row is menu-width of numbers (or whole-row null)`);
        });
      }
      const dRel = d0.demo.rel, dTen = d0.demo.ten, dCob = d0.demo.cob;
      assert.ok(dRel && dTen && dCob, `${y}: cohort dicts ride beside the six-lane demo row`);
      assert.ok((dRel.norel ?? 0) >= 0 && (dTen.own ?? 0) >= 0, `${y}: cohort cells read era shares`);
      // era holes, printed type pins:
      //   1991-census sides (1993's frame) carry no Hindu anywhere
      //   1996-census sides (its own dwelling table) carry no rental-authority share
      if (y === 1993) {
        assert.ok(!(dCob.ind) && !(dCob.lka), "1993: no India/Sri Lanka columns on the '91-era menu");
        assert.ok(dRel.hind == null, "1993: the '91-era print carries no Hindu row");
        assert.ok(dTen.rentPub != null && dTen.rentPub >= 0, "1993: its '91-era landlord table did print rentPub");
      }
    }
  }
}
{ // the 2001 federal frame (.build/map/README-era recipes: pack-2001-booth.py's VTR lanes,
  // v310-2001.txt.gz official per-place flows, asgc2001.gpkg boundary plus the
  // senate lanes on the handbook caches and sppvote). AsOf is the election's day and
  // seats/total figures are the AEC's own (howard 82 seats, TISBHG-independent 1 seat).
  for (const f of ["senate-2001.json", "senate-vote-2001.json", "res-2001.json"]) assert.ok(fs.existsSync(path.join(ROOT, "map", "data", f)), "2001 lane " + f + " on disk");
  assert.ok(fs.existsSync(path.join(ROOT, "data", "booth-seifa-2001.json")), "the 2001 venue store (derive-2001-venues.py) is on disk");
  const D = JSON.parse(R("map/data/res-2001.json"));
  const r = JSON.parse(R("map/data/res-2001.json"));
  const S = JSON.parse(R("map/data/senate-2001.json"));
  const SV = JSON.parse(R("map/data/senate-vote-2001.json"));
  assert.equal(D.year, 2001);
  assert.equal(D.divs.length, 150, "2001 has its 150 divisions");
  assert.equal(D.date, "2001-11-10");
  assert.equal(D.prev, 1998, "2001's previous election is 1998");
  assert.equal(D.speaker, "Wakefield");
  assert.equal(D.event, null, "2001 has no VTR event id (stats-pack era)");
  // the 2001 frame carries the full People-lane set (the user's same-session arc)
  assert.equal((D.relKeys || []).length, 10, "2001 relKeys has the ten religions (norel first)");
  assert.equal(D.relKeys[0], "norel");
  assert.equal((D.tenKeys || []).length, 4, "2001 tenKeys has four tenures (mort first)");
  assert.equal(D.tenKeys[0], "mort");
  const lingiari01 = D.divs.find(x => x.n === "Lingiari");
  assert.ok(lingiari01 && lingiari01.demo && lingiari01.demo.atsci != null && lingiari01.demo.y12less != null && lingiari01.demo.onepar != null && lingiari01.demo.rel && lingiari01.demo.ten, "2001 Lingiari carries the new lanes (indigenous/year-12/families/religion/tenure)");
  assert.ok(lingiari01.demo.atsci > 0.34, "2001 Lingiari is among the nation's most Indigenous seats");
  assert.ok(Math.abs(lingiari01.demo.atsci - 0.3509) < 0.002, "2001 Lingiari Indigenous share is the measured 2001-census read");
  assert.ok(Math.abs(lingiari01.demo.y12less - 0.6998) < 0.002, "2001 Lingiari Year-12-or-less at 70%, the era's education floor");
  const tally = {};
  for (const d of D.divs) for (const c of d.c) if (c[6] === 1) tally[c[1]] = (tally[c[1]] || 0) + 1;
  assert.deepEqual(tally, { ALP: 65, LP: 68, NP: 13, CLP: 1, IND: 3 }, "the 2001 House: Howard's 82 Coalition seats, 65 Labor, 3 independents");
  const B = D.booths;
  assert.equal(Object.keys(B).length, 26, "the booth lane is the full columnar (16 + census demo + birthplace + religion + tenure + ancestry rows + the household-median dollar lane + the age family's median and three new share lanes)");
  {
    const alp2 = 100 * D.agg.AUS.tpp[0] / (D.agg.AUS.tpp[0] + D.agg.AUS.tpp[1]);
    assert.ok(Math.abs(alp2 - 49.05) < 0.005, "2001 national TPP matches divs.txt's canonical figure exactly (got " + alp2.toFixed(2) + ")");
  }
  // the census People lanes of the floor year: the measured 2001 census
  // joined to its own election (derive-booth-demo-2001-frame.py over
  // cd-2001-ced-2001set.json, pinned by test-booth-demo-2001-frame.mjs) —
  // the interp era begins at 2004, every year from here carries its
  // own edition's income cuts; the SEIFA lens rides the venue-store's
  // filled SEIFA 2001 lane (derive-booth-seifa-stats90s.py)
  for (const f of [r, D]) {
    assert.equal(f.demoBasis, "venue", "2001 census basis is the venue-proxy read");
    assert.ok(!f.demoInterp, "2001 is measured-only (no interp record)");
    assert.ok(f.incomeCuts && f.incomeCuts.hiEdgeWeekly === 2000 && f.incomeCuts.dollarsYear === 2001 && !f.incomeCuts.sides, "2001 incomeCuts: the 2001 edition's $2,000+ edge in 2001 dollars, single-edition (no sides)");
    for (const ix of ["irsad", "irsd", "ier", "ieo"])
      assert.ok(Array.isArray(f.seifaCuts[ix]) && f.seifaCuts[ix].length === 9 && f.seifaCuts[ix].every((v) => typeof v === "number"),
        `2001's ${ix} cut carries the nine national decile edges`);
  }
  {
    assert.equal(D.divs.filter((x) => x.seifa && Object.values(x.seifa).length).length, 150,
      "all 150 divisions carry their measured 2001 SEIFA cells");
    const banks = D.divs.find((x) => x.n === "Banks");
    assert.ok(Math.abs(banks.seifa.irsd.v - 1004.211) < 0.002 && banks.seifa.irsad.v === 1020,
      "2001 Banks cells are the measured ABS-lane figures (banks.irsad is AUS_ced published); got " + JSON.stringify(banks.seifa.irsd));
    const decs = r.booths.dec || [];
    const nDec = decs.filter((x) => x && x.some((v) => v != null)).length;
    assert.ok(nDec > 6600, `most 2001 booths carry SEIFA deciles (got ${nDec})`);
    assert.ok(decs.every((row) => row === null || (row.length === 4 && row.every((v) => v == null || (Number.isInteger(v) && v >= 1 && v <= 10)))),
      "2001: every landed dec row carries up to four 1..10 deciles");
  }
  assert.ok(D.divs.every((d) => d.demo), "all 150 divisions carry a census demo row");
  {
    const demo = r.booths.demo;
    assert.equal(demo.length, r.booths.n.length, "the demo row rides the full booth lane");
    assert.equal(demo.filter(Boolean).length, 6920, "landed venue-CD joins (mobile/pseudo places and the suburb/zero-coordinate/honest-null tiers stay null)");
    assert.ok(demo.every((row) => row === null || row.slice(0, 6).every((v) => v !== null)), "every landed demo row carries all six people lanes");
    const gw = D.divs.find((d) => d.n === "Gwydir");
    assert.equal(gw.demo.p, 125105, "Gwydir's census sum (a 2001-era division the 2003ed people lanes never hold)");
    assert.equal(D.divs.find((d) => d.n === "Canberra").demo.p, 151237, "Canberra's census sum");
    assert.deepEqual(r.cobKeys, CENSUS01_COB_KEYS, "the 2001 edition's birthplace menu (whole-UK leading, then the era's eight)");
    const bcob = r.booths.cob;
    assert.equal(bcob.length, r.booths.n.length, "the birthplace row rides the full booth lane");
    assert.equal(bcob.filter(Boolean).length, 6920, "birthplace rows ride exactly the landed demo rows");
    assert.ok(bcob.every((row) => row === null || (row.length === CENSUS01_COB_KEYS.length && row.every((v) => v === null || (typeof v === "number" && v >= 0 && v <= 1)))), "every landed birthplace row carries nine 0-1 shares");
  }
  assert.ok(B.lat, "booth coordinate lane present");
  assert.equal(S.senators.length, 76, "76 senators after the 2001 election");
  assert.equal(S.asOf, "2002-07-01", "the 2001 senate's seating day is 2002-07-01");
  const partyOf = {};
  for (const s of S.senators) partyOf[s.ab] = (partyOf[s.ab] || 0) + 1;
  assert.deepEqual(partyOf, { LP: 31, ALP: 28, AD: 8, NP: 4, GRN: 2, IND: 2, ON: 1 }, "parliament 40's party balance");
  assert.equal(S.senators.find((s) => s.role === "president")?.n, "Paul Calvert");
  assert.equal(S.senators.find((s) => s.role === "leader")?.n, "Robert Hill");
  assert.equal(S.senators.find((s) => s.role === "oppLeader")?.n, "John Faulkner");
  assert.equal(Object.keys(SV.divs).length, 150, "senate-vote-2001 has all divisions");
  const seatsById = r.divs.map((d) => d.n).sort();
  assert.deepEqual(D.divs.map((d) => d.n).sort(), seatsById, "data-2001.json and res-2001.json carry the same divisions");
  // the timeline rail's two surfaces: its year registry covers every year the
  // list carries (a missing one used to give YEAR_X[oldAnchor] a NaN), and
  // the scale's left anchor is the list's own head, never a literal year
  {
    const base = part("app-1-base.js");
    const YX = base.match(/const YEAR_X = \{([^}]*)\}/)[1];
    for (const y of js.match(/const YEARS = \[([^\]]*)\]/)[1].match(/\d{4}/g) || []) assert.ok(YX.includes(y + ":"), "YEAR_X covers " + y);
    assert.ok(part("app-6-ui.js").includes("const FED0 = YEAR_X[YEARS_FED[0]] ?? YEARS_FED[0];"), "the timeline scale anchors at YEARS_FED[0], not at a literal earliest year");
    assert.ok(!/YEAR_X\[20\d\d\]/.test(part("app-6-ui.js")), "no literal YEAR_X[year] anchors on the rail");
  }

}
// the people-interp contract (derive-booth-demo-{2011,2016}.py +
// derive-booth-demo-interp.py + derive-booth-seifa-voter.py): 2007-2019
// are interpolated between the bracketing censuses to election day at
// the SEIFA pcti lanes' own day-share f (asserted identical to each
// year's booth-seifa _pcti block); the other years carry no record
{
  const INTERP = { 2004: [2001, 2006, 2006, 0.634373], 2007: [2006, 2011, 2006, 0.258894], 2010: [2006, 2011, 2011, 0.806787], 2013: [2011, 2016, 2011, 0.415982], 2016: [2011, 2016, 2016, 0.979201], 2019: [2016, 2021, 2021, 0.553914] };
  for (const y of [2004, 2007, 2010, 2013, 2016, 2019, 2022, 2025]) {
    const r = JSON.parse(R(`map/data/res-${y}.json`));
    if (!INTERP[y]) {
      assert.ok(!r.demoInterp, `${y} has no demoInterp record`);
      continue;
    }
    const [c0, c1, near, f] = INTERP[y];
    const di = r.demoInterp;
    assert.ok(di && di.c0 === c0 && di.c1 === c1 && di.nearestSide === near && di.f === f && di.blend === "shares", `${y} demoInterp record`);
    const sf = JSON.parse(R(`data/booth-seifa-${y}.json`));
    assert.equal(di.f, sf._pcti.f, `${y} demoInterp.f == the seifa store's own _pcti.f`);
    const div = r.divs.find((d) => d.demo);
    // demo rows: 0..1 shares or null per lane, and the birthplace dict's
    // own country shares the same inside it (the interp contract joined
    // its object-valued cob key 2026-10-28)
    assert.ok(div && Object.entries(div.demo).every(([k, v]) => v == null || (typeof v === "number" && v >= 0) || (["cob", "rel", "ten", "anc"].includes(k) && v && Object.values(v).every((x) => x == null || (typeof x === "number" && x >= 0 && x <= 1)))), `${y} demo rows well-formed`);
  }
  // every interp year rides the income cuts of the nearest census
  // side (hi edges differ across the 2001/2006/2011 grids, so the hi
  // lane pins to the nearest side's edition — the res file carries
  // its year-appropriate incomeCutsI with both sides named)
  const CUTS_I = {
    2004: [3000, 2006, [2001, 2006]],
    2007: [3000, 2006, [2006, 2011]],
    2010: [4000, 2011, [2006, 2011]],
    2013: [4000, 2011, [2011, 2016]],
    2016: [4000, 2016, [2011, 2016]],
    2019: [4000, 2021, [2016, 2021]],
  };
  for (const [y, [edge, dollars]] of Object.entries(CUTS_I)) {
    const rc = JSON.parse(R(`map/data/res-${y}.json`)).incomeCuts;
    assert.ok(rc && rc.hiEdgeWeekly === edge && rc.dollarsYear === dollars, `${y} incomeCuts: nearest-side ${edge} edge in ${dollars} dollars`);
  }
  const r04 = JSON.parse(R("map/data/res-2004.json"));
  assert.ok(r04.incomeCuts.sides && r04.incomeCuts.sides["2001"] && r04.incomeCuts.sides["2006"], "2004 incomeCuts names its 2001/2006 bracketing editions in sides");
  const r10 = JSON.parse(R("map/data/res-2010.json"));
  assert.ok(r10.incomeCuts.sides && r10.incomeCuts.sides["2006"] && r10.incomeCuts.sides["2011"], "2010 incomeCuts names its 2006/2011 bracketing editions in sides");
  const r19 = JSON.parse(R("map/data/res-2019.json"));
  assert.ok(r19.incomeCuts.sides && r19.incomeCuts.sides["2016"] && r19.incomeCuts.sides["2021"], "2019 incomeCuts names both bracketing epochs in sides");
  // the Household-income lens's median spectrum (2026-10-31): every
  // income year carries the national household median at its nearest
  // census side's epoch (interp years pin like every dollar figure), a
  // per-division median on every seat, and the per-booth median lane —
  // the open-top-band footprints stay null, never a fabricated figure
  const MED_Y = {
    2001: [786, 2001, 6918, 624], 2004: [1027, 2006, 6719, 837],
    2007: [1027, 2006, 7674, 667], 2010: [1235, 2011, 8251, 801],
    2013: [1235, 2011, 8357, 800], 2016: [1476, 2016, 8195, 955],
    2019: [1775, 2021, 8730, 1147], 2022: [1788, 2021, 8440, 1156],
    2025: [1801, 2021, 8907, 1161],
  };
  for (const [y, [med, dollars, boothN, hin]] of Object.entries(MED_Y)) {
    const J = JSON.parse(R(`map/data/res-${y}.json`));
    assert.equal(J.incomeCuts.medWeekly, med, `${y}: the national household median rides its nearest census epoch`);
    assert.equal(J.incomeCuts.dollarsYear, dollars, `${y}: the median's dollar epoch matches the incomeCuts nearest side`);
    assert.equal(J.divs.every((d) => d.demo && d.demo.medIncWeekly != null), true, `${y}: every division carries its household median`);
    assert.equal(J.divs.find((d) => d.n === "Hinkler").demo.medIncWeekly, hin, `${y}: Hinkler's median (the national floor) in epoch dollars`);
    const vals = (J.booths.medinc || []).filter((v) => v != null);
    assert.equal(vals.length, boothN, `${y}: the booth median lane's row count`);
    assert.ok(vals.every((v) => v >= 100 && v < 4000), `${y}: booth medians inside the edition grids' printed edges (open-top nulls never a figure)`);
  }
  // the Age family (the income lens's sibling, same day): its four lanes
  // ride the packed census band dicts — national median age and the
  // three new shares pooled from the divisions (the vote-weighted
  // measure the legend's Australia line marks), every division records
  // its own median, and the booth lanes sit beside the demo tuple
  const AGE_Y = {
    1993: [32, 0.1083, 0.0467, 6361, "Chifley", 27],
    1996: [33, 0.1035, 0.0503, 6568, "Chifley", 28],
    1998: [34, 0.0989, 0.0538, 6691, "Chifley", 29],
    2001: [35, 0.0941, 0.0582, 6920, "Chifley", 30],
    2004: [36, 0.0947, 0.0621, 6719, "Chifley", 30],
    2007: [37, 0.0948, 0.0643, 7690, "Lingiari", 30],
    2010: [37, 0.0941, 0.0649, 8250, "Lingiari", 30],
    2013: [37, 0.0927, 0.0663, 8392, "Lingiari", 31],
    2016: [38, 0.0894, 0.0696, 8194, "Lingiari", 31],
    2019: [38, 0.0861, 0.0738, 8737, "Lingiari", 31],
    2022: [39, 0.0835, 0.0773, 8448, "Lingiari", 32],
    2025: [39, 0.0835, 0.0758, 8913, "Chifley", 32],
  };
  for (const [y, [med, a18, a75s, boothN, yng, yngAge]] of Object.entries(AGE_Y)) {
    const J = JSON.parse(R(`map/data/res-${y}.json`));
    assert.equal(J.ageCuts.medAge, med, `${y}: the national median age pools from the division band dicts`);
    assert.equal(J.ageCuts.a1824, a18, `${y}: the 18–24 national share (the 15–19 estimate inside)`);
    assert.equal(J.ageCuts.a75, a75s, `${y}: the 75-and-over national share`);
    assert.ok(J.divs.every((d) => d.demo && d.demo.ageMed != null), `${y}: every division records its median age`);
    assert.equal(J.divs.find((d) => d.n === yng).demo.ageMed, yngAge, `${y}: ${yng}'s median age (the national floor)`);
    assert.ok(J.divs.find((d) => d.n === "Lyne" && d.demo && d.demo.ageMed != null), `${y}: Lyne (the oldest seat on record every year) carries its median`);
    const vals = (J.booths.ageMed || []).filter((v) => v != null);
    assert.equal(vals.length, boothN, `${y}: the booth median-age lane's row count`);
    assert.ok(vals.every((v) => v >= 0 && v <= 84), `${y}: booth medians inside the printed band grid (85+ open-band stays null)`);
    for (const k of ["a1824", "a3554", "a75"]) assert.ok((J.booths[k] || []).some((v) => v != null), `${y}: booth share lane ${k} lands`);
  }
  // the birthplace menu matrix: every census-edition year lists its own
  // cobKeys, uk-led on the 2001 edition and GCP-era on 2016+; booth cob
  // rows ride exactly the landed demo rows everywhere
  const VENUE08 = CENSUS01_COB_KEYS.slice(1);
  const MENUS = { 2001: CENSUS01_COB_KEYS, 2004: CENSUS01_COB_KEYS, 2007: VENUE08, 2010: VENUE08, 2013: VENUE08, 2016: GCP_COB_KEYS, 2019: GCP_COB_KEYS, 2022: GCP_COB_KEYS, 2025: GCP_COB_KEYS };
  for (const [y, menu] of Object.entries(MENUS)) {
    const r = JSON.parse(R(`map/data/res-${y}.json`));
    assert.deepEqual(r.cobKeys, menu, `${y} birthplace menu rides its own census edition`);
    assert.equal(r.booths.cob.length, r.booths.n.length, `${y} cob rows ride the full booth lane`);
    assert.equal(r.booths.cob.filter(Boolean).length, r.booths.demo.filter(Boolean).length, `${y} cob rows ride exactly the landed demo rows`);
    assert.ok(r.booths.cob.every((row) => row === null || (row.length === menu.length && row.every((v) => v === null || (typeof v === "number" && v >= 0 && v <= 1)))), `${y} every landed cob row carries ${menu.length} 0-1 shares`);
  }
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

// ── open-water clicks (2026-11-05): on the map a single click on the sea lets
// the selection out where the camera stands (a zoomed miss used to be swallowed
// as a pan mis-tap, so a chosen seat could never be let go from the water;
// only the near-home miss worked) — the double click on the sea is the gesture
// that takes the camera all the way out home. The chamber's miss keeps its
// own always-deselect (it has no camera)
{
  const ui = part("app-6-ui.js");
  assert.ok(ui.includes('else if (S.view === "map") select({ level: "aus" }, { fly: false });'), "a single click on open water lets the selection out where the camera stands");
  assert.ok(!/T\.k < HOME\.k \* 1\.4/.test(ui), "the map's water miss no longer waits for the near-home zoom");
  const dbl = ui.match(/canvas\.addEventListener\("dblclick", \(e\) => \{\n([\s\S]*?)\n\}\);/);
  assert.ok(dbl, "the canvas carries a dblclick listener");
  assert.ok(/if \(S\.view !== "map"\) return;/.test(dbl[1]) && /hitTest\(e\.clientX - r\.left, e\.clientY - r\.top\)\) return;/.test(dbl[1]) && /\n\s+goAus\(\);/.test(dbl[1]), "a double click on open water (map view only) takes the map out to the home fit");
}

// the background year preload (2026-10-26): once the page is up, every other
// election loads in the background — nearest timeline stops first, one idle
// slice at a time — so a timeline jump, a chamber switch or the Senate lens
// finds its data already here. Skipped on save-data/2g connections (the
// timeline's hover preload still covers a stop the reader nears); a year's
// failed fetch drops its record so a real click tries it again. The Handbook
// years never ride the loop (2026-10-31): their geometry ships lossless at
// both levels (licence bars a simplified lo), 6.5–19MB a year — preloading
// all four cost ~53MB and four long main-thread builds on every visit
{
  const ui = part("app-6-ui.js");
  assert.ok(ui.includes("function preloadYears()") && /YEARS\.filter\(\(y\) => !Y\[y\] && !HANDBOOK_YEARS\.has\(y\)\)\.sort/.test(ui), "preloadYears walks the years nearest-first, Handbook years excepted");
  assert.ok(part("app-1-base.js").includes("const HANDBOOK_YEARS = new Set([1993, 1996, 1998, 2001])"), "the Handbook years' lossless geometry files are the idle preload's skip set");
  assert.ok(ui.includes("conn.saveData") && ui.includes("effectiveType"), "the background preload yields to save-data and 2g connections");
  assert.ok(ui.includes("delete Y[y]"), "a failed background load frees the year for a real retry");
  assert.ok(ui.includes("loadSenates()") && ui.includes("loadSenateFloor()") && ui.includes("loadSenateVote(sy, true)"), "the preload also fills the chambers and the Senate-vote lane");
  // (2026-11-01) the background work yields to the reader's own: low-priority fetches, one
  // Senate-vote file at a time (all twelve at once slowed the election opened meanwhile by
  // half again), and nothing new started while the reader waits on an election (ywait)
  assert.ok(ui.includes("loadYear(y, true)") && part("app-1-base.js").includes('bg ? { priority: "low" } : undefined'), "preload fetches go at low priority");
  assert.ok((ui.match(/if \(ywait\) return void later\((next|one)\);/g) || []).length === 2, "the year preload and the Senate-vote lane both hold while the reader waits on an election");
  assert.ok(ui.includes("if (sy != null) loadSenateVote(sy, true).catch(() => {}).then(() => idleSlice(() => setTimeout(one, 400)));"), "the Senate-vote lane fetches one file at a time");
  assert.ok(ui.includes("k !== 2004"), "no senate-vote-2004 fetch (no such file)");
  assert.ok(ui.includes(" preloadYears();\n})();"), "boot ends by kicking the background preload");
}

// ── the preload's two brakes (2026-10-31): hi geometry waits for a real visit,
// and the frame cache is weighted and capped. Baseline measured on the probe
// (.matilda/map-perf-probe.mjs, 4× cpu): preloading all fifteen frames' hi
// fetch + Path2D build fired ~42 long tasks ≈15s of main-thread jank in the
// first minute, pulled 71MB and held a 377MB heap (545MB after a Handbook
// visit, whose lossless geo is ~140MB). Now: hi arrives only for frames the
// reader actually shows (warmHi on boot/setYear), preloading stops at the cap
// and spaces itself, and the least-recently-viewed frames fall overboard
{
  const base = part("app-1-base.js"), ui = part("app-6-ui.js");
  assert.equal((base.match(/geo-\$\{ry\}-hi\.json/g) || []).length, 1, "the hi fetch has exactly one home (warmHi) — never inline in loadYear");
  assert.ok(base.includes("function warmHi(y)") && base.includes("if (lo.handbook) m.geoHi = m.geo;"), "warmHi owns the hi chain; the Handbook years alias lo as before");
  assert.ok((ui.match(/warmHi\(/g) || []).length >= 2, "boot and setYear both warm the frame now in view");
  assert.ok(base.includes("const FRAME_CAP = 12") && base.includes("const frameLoad =") && base.includes("function evictFrames()"), "the weighted frame cache and its LRU eviction (Handbook years ×4)");
  assert.ok(ui.includes("frameLoad() < FRAME_CAP") && ui.includes("PRELOAD_GAP"), "the preload stops at the cap and paces itself between stops");
  assert.ok(ui.includes("evictFrames();"), "setYear sweeps the cache once the new frame has landed");
}

// ── Queensland is unicameral (its Council abolished itself in 1922): no
// senate-qld*.json can ever exist, so its frames never fetch it and never
// offer the Council switch (before 2026-10-31 they 404'd three files a visit);
// Western Australia's Council is deliberately unmodeled in this land (the
// 2025 single statewide 37-member electorate has no analogue in the
// machinery — SEN_YEARS leaves the wa frames out until it does)
{
  const sen = part("app-3b-senate.js");
  assert.ok(sen.includes("&& !QLD_YEARS.has(y)"), "SEN_YEARS leaves the Queensland frames out (multicameral only where the Council lane exists)");
  assert.ok(sen.includes("&& !isNowY(y)"), "SEN_YEARS leaves the state now-keys out (a state now-frame's overlay is Assembly-only)");
  assert.ok(sen.includes("&& !WA_YEARS.has(y)"), "SEN_YEARS leaves the Western Australian frames out (no LC lane is shipped for them)");
  assert.ok(!fs.existsSync(path.join(ROOT, "map/data/senate-qld17.json")) && !fs.existsSync(path.join(ROOT, "map/data/senate-qld20.json")) && !fs.existsSync(path.join(ROOT, "map/data/senate-qld24.json")), "no Queensland upper-house files exist to fetch");
  assert.ok(!fs.existsSync(path.join(ROOT, "map/data/senate-nswnow.json")), "no senate file for nswnow (the Council's own since-2023 moves are not the overlay's)");
  for (const wf of ["wa17", "wa21", "wa25"]) assert.ok(!fs.existsSync(path.join(ROOT, `map/data/senate-${wf}.json`)), `no senate file for ${wf} (Assembly-only land)`);
}
// the NSW "now" frame rides the generalised overlay table (2026-11-04: the
// Assembly as it stands after Epping/Hornsby/Pittwater's October 2024 and
// Kiama's September 2025 by-elections)
{
  const base = part("app-1-base.js");
  assert.ok(base.includes('const NOW_OF = { now: 2025, nswnow: "nsw23", qldnow: "qld24", wanow: "wa25" };') && base.includes('const NOW_DATA = { now: "data-now.json", nswnow: "data-now-nsw.json", qldnow: "data-now-qld.json", wanow: "data-now-wa.json" };'), "the as-it-stands overlay table names each frame's base and overlay file (wanow joined 2026-11-05)");
  assert.ok(base.includes('const isNowY = (y) => y in NOW_OF;') && base.includes('const nowRy = (y) =>'), "isNowY/nowRy generalise the federal Now's hardcodes");
  assert.equal((base.match(/m\.year === "now"/g) || []).length, 1, "app-1-base keeps one federal-only fork (the islands' owner — a state now-frame's islands are the empty set upstream)");
  const now = JSON.parse(R("map/data/data-now-nsw.json"));
  assert.ok(now && now.asOf && now.changes.length === 8 && Object.keys(now.holders).length === 4, "data-now-nsw.json: asOf, 8 member events, 4 holders");
  assert.deepEqual(Object.keys(now.byelections || {}).sort(), ["Epping", "Hornsby", "Kiama", "Pittwater"], "the four by-elections");
  for (const [dist, by] of Object.entries(now.byelections)) {
    assert.ok(by.formal > 40000 && by.informal > 0 && by.turnout === by.formal + by.informal, `nswnow ${dist}: the count reconciles`);
    assert.ok(by.div.c.some((c) => c[6] === 1), `nswnow ${dist}: an elected candidate`);
    assert.ok(by.formal === by.div.c.reduce((a, c) => a + c[4], 0), `nswnow ${dist}: the candidates reach the formal total`);
    assert.ok(by.booths.v.every((v) => v.length === by.div.c.length), `nswnow ${dist}: booth votes align with the candidate roll`);
    assert.ok(by.booths.prev.some((j) => j != null), `nswnow ${dist}: at least one 2023 place returned for the same-place read`);
  }
  assert.equal(now.byelections.Kiama.div.tpp != null && now.byelections.Kiama.div.tpp.length === 3, true, "nswnow Kiama: its classic 2PP files (ALP v LIB)");
  assert.ok(now.byelections.Epping.div.tpp == null && now.byelections.Pittwater.div.tpp == null, "nswnow: no 2PP where the final pair wasn't Labor v the Coalition");
  assert.equal(now.holders.Kiama.n, "Katelin McInerney", "nswnow: Kiama's member");
  assert.equal(now.holders.Pittwater.n, "Jacqui Scruby", "nswnow: Pittwater's member");
  assert.equal(now.holders.Epping.n, "Monica Tudehope", "nswnow: Epping's member");
  assert.equal(now.holders.Hornsby.n, "James Wallace", "nswnow: Hornsby's member");
  const sum = JSON.parse(R("map/data/summary.json"));
  assert.deepEqual(sum.seats.nswnow.NSW, { alp: 46, lnp: 35, grn: 3, ind: 9 }, "summary.json pins the Assembly as it stands");
}

// the Qld "now" frame on the same generalised overlay (2026-11-04: the 2024
// Assembly as it stands after Hinchinbrook's November 2025 and Stafford's May 2026
// by-elections — Dametto's resignation, Sullivan's expulsion and death in office)
{
  const now = JSON.parse(R("map/data/data-now-qld.json"));
  assert.ok(now && now.asOf && now.changes.length === 5 && Object.keys(now.holders).length === 2, "data-now-qld.json: asOf, 5 member events, 2 holders");
  assert.deepEqual(Object.keys(now.byelections || {}).sort(), ["Hinchinbrook", "Stafford"], "the two by-elections");
  for (const [dist, by] of Object.entries(now.byelections)) {
    assert.ok(by.formal > 25000 && by.informal > 0 && by.turnout === by.formal + by.informal, `qldnow ${dist}: the count reconciles`);
    assert.ok(by.div.c.some((c) => c[6] === 1), `qldnow ${dist}: an elected candidate`);
    assert.ok(by.formal === by.div.c.reduce((a, c) => a + c[4], 0), `qldnow ${dist}: the candidates reach the formal total`);
    assert.ok(by.booths.v.every((v) => v.length === by.div.c.length), `qldnow ${dist}: booth votes align with the candidate roll`);
    assert.ok(by.booths.prev.some((j) => j != null), `qldnow ${dist}: at least one 2024 place returned for the same-place read`);
  }
  assert.equal(now.holders.Hinchinbrook.n, "Wayde Chiesa", "qldnow: Hinchinbrook's member");
  assert.equal(now.holders.Stafford.n, "Luke Richmond", "qldnow: Stafford's member");
  assert.equal(now.byelections.Stafford.div.tpp != null && now.byelections.Stafford.div.tpp.length === 3, true, "qldnow Stafford: its classic 2PP files (ALP v LNP)");
  assert.ok(now.byelections.Hinchinbrook.div.tpp == null, "qldnow: no 2PP where the final pair wasn't Labor v the LNP");
  assert.ok(Array.isArray(now.byelections.Stafford.div.fl) && now.byelections.Stafford.div.fl.some((r) => r[1] + r[2] > 2500), "qldnow: Stafford files the counted distribution chain to the final pair (Jess Lane's transfers)");
  const sum = JSON.parse(R("map/data/summary.json"));
  assert.deepEqual(sum.seats.qldnow.QLD, { alp: 36, lnp: 53, grn: 1, ind: 1, oth: 2 }, "summary.json pins the Assembly as it stands");
}

// the WA "now" frame on the same generalised overlay (2026-11-05: the 2025
// Assembly as it stands after the Secret Harbour by-election — Papalia's
// July 2026 retirement, then Luke Herdegen's One Nation gain, the first for
// the state lower house. The by-election's results come from the WAEC EIS
// ByElections overview, harvested verbatim into the flow mirror by
// .build/map/harvest-wa-byelections.py and flattened by
// .build/map/build_wa_now.py)
{
  const now = JSON.parse(R("map/data/data-now-wa.json"));
  assert.ok(now && now.asOf && now.changes.length === 2 && Object.keys(now.holders).length === 1, "data-now-wa.json: asOf, 2 member events, 1 holder");
  assert.deepEqual(Object.keys(now.byelections || {}), ["Secret Harbour"], "the one by-election");
  const by = now.byelections["Secret Harbour"];
  assert.ok(by.date === "2026-08-29" && by.formal > 20000 && by.informal > 0 && by.turnout === by.formal + by.informal, "wanow: the count reconciles (27,769+983)");
  assert.ok(by.div.c.some((c) => c[6] === 1), "wanow: an elected candidate");
  assert.ok(by.formal === by.div.c.reduce((a, c) => a + c[4], 0), "wanow: the candidates reach the formal total");
  assert.ok(by.booths.v.every((v) => v.length === by.div.c.length), "wanow: booth votes align with the candidate roll");
  assert.ok(by.booths.prev.some((j) => j != null), "wanow: at least one 2025 place returned for the same-place read");
  const win = by.div.c.find((c) => c[6] === 1);
  assert.equal(win[1], "PHON", "wanow: One Nation holds Secret Harbour (the WAEC's PHON code, fam onp)");
  assert.equal(win[3], "onp", "wanow: its winner files in the onp fam");
  assert.ok(by.div.tpp == null, "wanow: no 2PP lane on a Labor-v-One Nation final");
  assert.equal(now.holders["Secret Harbour"].n, "Luke Herdegen", "wanow: Secret Harbour's member");
  const sum2 = JSON.parse(R("map/data/summary.json"));
  assert.deepEqual(sum2.seats.wanow.WA, { alp: 45, lnp: 13, onp: 1 }, "summary.json pins the Assembly as it stands (wa)");
}

// ── the Handbook frame in slices (2026-10-31): the lossless-handbook click
// used to parse, decode, resample, wind, path and outline in one synchronous
// rush — one 5–8s task on throttled hardware (probe: 2001 loaded in 8.1s with
// a contiguous 5.6s freeze, and ~1.5s more of morph longtasks leaving it).
// buildHandbookGeo streams the same work in two yielded passes (decode+bbox,
// then resample/wind/path/outline per seat with 32ms slice yields); the same
// visit's morph is now the colour sweep alone. The licence-limited bits stand
// untouched: files ship lossless, resampling stays a draw-time transform
{
  const base = part("app-1-base.js"), map2 = part("app-2-map.js");
  assert.ok(base.includes("async function buildHandbookGeo(topo, m)"), "the sliced Handbook geometry builder exists");
  assert.ok(base.includes("lo.handbook ? await buildHandbookGeo(lo, m) : buildGeo(lo, m)"), "loadYear routes Handbook frames through the sliced builder");
  assert.ok(base.includes("function handbookRings(f)") && (base.match(/handbookRings\(f\)/g) || []).length === 2, "the resample-and-wind treatment keeps one shared per-feature home (handbookRings, 2026-11-01: flat rings, planar winding; test-map-geo-build holds it to the old drawing)");
  assert.ok(base.includes("sliceDone") && /await pause\(\)/.test(base), "the sliced builder yields to the browser between seat-sized slices");
  assert.ok(base.includes("coast: outline"), "the fused outline serves meshDiv and coast alike (the old full re-walks' exact lines, free)");
  assert.ok(map2.includes("if (HANDBOOK_YEARS.has(from.year) || HANDBOOK_YEARS.has(to.year)) return false;"), "a Handbook side declines the outline morph — the colour sweep carries the transition");
}

// ── the head's data-warm script (2026-10-31): the landing year's fetches
// start while d3/topojson/map.js download (~800KB of script ahead of the
// first data request); getJSON drinks from window.__warm, never racing it
{
  const base = part("app-1-base.js");
  assert.ok(page.includes('id="map-data-warm"') && page.includes("window.__warm={}"), "the head carries the data-warm script");
  assert.ok(/<script id="map-data-warm">[^<]*"res-2025\.json":"[0-9a-f]{8}"/.test(page), "the warm script's stamps are current for the landing year (node .build/map/assemble.mjs)");
  assert.ok(page.includes('"geo-2025-lo.json":"') && page.includes('"data-now.json":"') && page.includes('"islands.json":"'), "the warm script prices every file it may warm");
  assert.ok(base.includes("window.__warm[u]") && base.includes("delete window.__warm[u]"), "getJSON drinks from the warm script, once");
}

// ── the Born overseas birthplace sub-view (the cob lane): the fborn People
// lane gains a country picker on the year's own census-edition menu — data
// and app wiring assertions per frame follow in the blocks below
{
  const base = part("app-1-base.js"), ui = part("app-6-ui.js"), map2 = part("app-2-map.js"), story = part("app-4-story.js");
  assert.ok(base.includes('const COB_NAME = { uk: "the United Kingdom", eng: "England", ind: "India", chn: "China", nzl: "New Zealand", phl: "Philippines", vnm: "Vietnam", zaf: "South Africa", ita: "Italy", lka: "Sri Lanka", sct: "Scotland" };'), "the curated birthplace keys and display names in one literal (whole-UK first for the 2001 edition's own row)");
  assert.ok(base.includes('const COB_BORN = { uk: "the United Kingdom"') && base.includes('phl: "the Philippines"'), "the picker's Born-in labels (whole-UK and the Philippines take their article)");
  assert.ok(base.includes('const COB_SHORT = { uk: "the UK", eng: "ENG", ind: "IND", chn: "CHN", nzl: "NZ", phl: "PHL", vnm: "VNM", zaf: "ZAF", ita: "ITA", lka: "LKA", sct: "SCT" };'), "the compact head stubs: alpha-3, alpha-2 where the short form is natural (NZ, the UK)");
  assert.ok(ui.includes('isCob() ? `Born in ${COB_SHORT[S.cob]}` : DM_SHORT[S.index]'), "the lens head names the chosen country (no more stale Born overseas)");
  assert.ok(base.includes('const COB_VERB = { uk: "were born in the United Kingdom"') && base.includes('sct: "were born in Scotland"'), "per-country story verbs");
  assert.ok(base.includes("const COB_RANGE = {") && base.includes("sct: [0, 3]"), "per-country range caps (Scotland's tiny 3% cap)");
  assert.ok(base.includes('const isCob = () => S.index === "fborn" && S.cob != null;'), "the fborn-only sub-view guard");
  assert.ok(base.includes("const demoShare = (d) =>") && base.includes("const demoBoothShare = (raw, j, pos) =>") && base.includes("const demoRange = () =>") && base.includes("const demoRamp = () =>"), "the select-aware lane accessors at every seam");
  assert.ok(base.includes('m.cobKeys = res.cobKeys || null;') && base.includes("map((k, i) => [k, i])"), "loadYear records the year's country order and its positional spots");
  assert.ok(base.includes("demo.cob = {};") && base.includes("m.cobKeys"), "area pools sum the country shares with the same pool weights");
  assert.ok(map2.includes("demoShare(d); return v == null ? null : 100 * v"), "division colour reads the country share");
  assert.ok(map2.includes("demoBoothShare(b.raw, j, selPos(m))"), "booth colour reads the positional select row via selPos");
  assert.ok(map2.includes("demoRange(); return demoRamp()"), "the sewn ramp stays the fborn family");
  assert.ok(ui.includes('lgMenu("cob",' ), "the legend's country picker rides the panel dropdown idiom");
  assert.ok(ui.includes("All overseas-born") && ui.includes("Born in ${COB_BORN[k]}") && base.includes('phl: "the Philippines"'), "the picker's all-plus-countries options, the Philippines with its article");
  assert.ok(ui.includes('if (isCob()) p.set("cb", S.cob);'), "the hash carries cb on the fborn lens only");
  assert.ok(ui.includes('S.cob = COB_NAME[p.get("cb")] ? p.get("cb") : null;'), "readURL restores the country");
  assert.ok(ui.includes('k === "cob"'), "the picker change handler is wired");
  assert.ok(ui.includes("if (S.cob != null && !(b.cobKeys || []).includes(S.cob)) S.cob = null;"), "setYear clamps a country the new year's menu can't print");
  assert.ok(ui.includes("const bmc = M();") && ui.includes("!(bmc.cobKeys || []).includes(S.cob)) S.cob = null;") && !base.includes("if (S.cob != null && !(m.cobKeys || []).includes(S.cob)) S.cob = null;"), "the boot clamp sits at the model, never inside loadYear (idle preloads of every year mustn't touch S)");
  assert.ok(story.includes("const COB_TOP = {") && story.includes("the most Australia-born"), "area stories phrase the country against the Australia-born share");
}

// ── the Household-income lens (2026-10-31): one People-menu entry that
// replaces the loinc/hiinc pair, its option picker landing on the median
// weekly household income spectrum with the lower/higher share views
// beside it; the median lane is dollars (parallel booth lane, never a
// share cell), the hash gains iv, and legacy loinc/hiinc hashes alias in
{
  const base = part("app-1-base.js"), ui = part("app-6-ui.js"), map2 = part("app-2-map.js"), story = part("app-4-story.js"), list = part("app-5-list.js");
  assert.ok(base.includes('const LENS_INC = "inc";') && base.includes('const INC_MODES = ["med", "lo", "hiq"];'), "the income lane id and its three measures, median first (the high view is the top income quarter since 2026-11-01)");
  assert.ok(base.includes('if (k === "loinc") { ks.push(LENS_INC); continue; }') && base.includes('if (k === "a65") { ks.push(LENS_AGE); continue; }'), "the People menu folds the income pair into Household income and the age pair into Age (DM stays positional against the demo tuple)");
  assert.ok(base.includes(`"hiinc" && k !== "y12less" && k !== "hiqinc"`), "the menu folds hiinc, the schooling reads, and hiqinc out of the people stack (the three menu folds)");
  assert.ok(base.includes('"hiqinc"'), "hiqinc is a DM lane at the demo tuple's appended cell");
  assert.ok(base.includes('const INC_KEY = { med: "medIncWeekly", lo: "loinc", hiq: "hiqinc" };'), "the income view's demo key per measure (the quartile-paired demo key runs edition-comparable where the old top-band share was not)");
  assert.ok(base.includes('const INC_NAME = { med: "Median household income", lo: "Adults in bottom household-income quarter", hiq: "Adults in top household-income quarter" };'), "the income view's display name per measure (top and bottom household-income quarters, sentence case)");
  assert.ok(base.includes('const INC_SHORT = { med: "Median income", lo: "Lower income", hiq: "Top income quarter" };'), "the income view's short name per measure");
  assert.ok(base.includes('const INC_RANGE = { lo: [10, 45], hiq: [8, 60] };'), "the income view's colour domains (top quarter's shares bracket the measured 8-59% seat spread)");
  assert.ok(base.includes('hiqinc: seq(275, 0.12)'), "the top-quarter view wears the income view's hue");
  assert.ok(base.includes("incmed: seq(48, 0.14)"), "the median spectrum wears its own money-gold hue");
  assert.ok(base.includes('incMode: "med"'), "the median spectrum is the landing measure");
  assert.ok(base.includes('const incMedRange = (m) =>') && base.includes("Math.floor(lo / 100)"), "the median's colour domain measures the year's own divisions, snapped to $100s (no hand-set LUT)");
  assert.ok(map2.includes('if (incMed()) { const v = b.raw.medinc ? b.raw.medinc[j] : null;'), "booth colour reads the median's own dollar lane, never a share cell");
  assert.ok(map2.includes('const v = demoShare(d); return v == null ? null : 100 * v;'), "the pinned share idiom survives beside the median guard");
  assert.ok(ui.includes('lgMenu("incv",' ), "the legend's income picker rides the panel dropdown idiom");
  assert.ok(ui.includes('else if (k === "incv") S.incMode = v;'), "the picker change handler is wired");
  assert.ok(ui.includes('S.incMode') && ui.includes('if (i === "loinc" || i === "hiinc") { S.index = LENS_INC;'), "legacy loinc/hiinc hashes alias onto the lens with the share view picked");
  assert.ok(ui.includes('p.set("iv", S.incMode);') && ui.includes('p.get("iv")'), "the hash carries the income view both ways");
  assert.ok(ui.includes('S.incMode, S.ageMode, S.eduMode, S.party'), "the legend's refresh key re-reads on a measure switch");
  assert.ok(ui.includes("Income: ${INC_SHORT[S.incMode]}"), "the lens head names the picked measure");
  assert.ok(ui.includes('`Median weekly household income${incEpochBrk}${incMedNote}`'), "the median legend note names itself in census-year dollars and carries the no-national-line caveat where the frame lacks it");
  assert.ok(ui.includes("mny(ausShare)"), "the Australia line formats in dollars on the median view");
  assert.ok(story.includes("the median weekly household income is ${mny(dm.medIncWeekly)}${incEpoch(m)}"), "the seat/place income fact pair leads the dollar shares into the median sentence");
  assert.ok(story.includes("medIncWeekly: raw.medinc ? raw.medinc[j] : null"), "the neighbourhood's median reads the booth lane");
  assert.ok(story.includes('The median household in ${ds(d.n)} earns'), "the seat's median headline");
  assert.ok(story.includes("INC_TOP[S.incMode]"), "the area ranking phrases follow the picked measure");
  assert.ok(base.includes('INC_TOP = { med: ["seats where households earn the most"'), "the median ranking phrase");
  assert.ok(list.includes("incMed()") && list.includes("mny(v)"), "the list column prices the median view in dollars");
  assert.ok(base.includes('const incHiQFrag = (m) =>'), "the top-quarter lane reads its edition's own quartile cut out of the frame record, blend spans named as ranges");
  assert.ok(base.includes('r[{ lo: 6, hiq: 16 }[S.incMode]]'), "the top-quarter booth share rides the tuple's appended cell");
  assert.ok(ui.includes('S.incMode = i === "loinc" ? "lo" : "hiq"'), "legacy loinc/hiinc and hi hashes all steer onto the top-quarter measure (the only hi left)");
  assert.ok(ui.includes('iv === "hiq"'), "hiq rides the url measure id as itself");
}

// ── the Age lens (2026-10-31): the income lane's sibling fold — Aged 65
// and over and Aged 20 to 34 become Age's share views beside a median-age
// spectrum and three new brackets (18–24, 35–54, 75+); median is years
// (its own lane, never a share cell), hash gains av=, legacy a65/a2034
// hashes alias in
{
  const base = part("app-1-base.js"), ui = part("app-6-ui.js"), map2 = part("app-2-map.js"), story = part("app-4-story.js"), list = part("app-5-list.js");
  assert.ok(base.includes('const LENS_AGE = "age";') && base.includes('const AGE_MODES = ["med", "a1824", "a2034", "a3554", "a65", "a75"];'), "the age lane id and its six views, median first");
  assert.ok(base.includes('const AGE_KEY = { med: "ageMed"'), "the age view's demo key per view");
  assert.ok(base.includes("agemed: seq(86, 0.14)"), "the median-age spectrum wears its own hue");
  assert.ok(base.includes('ageMode: "med"'), "the median age lands as the default view");
  assert.ok(base.includes('const ageMedRange = (m) =>') && base.includes("Math.floor(lo / 2)"), "the median-age colour domain measures the year's own divisions, snapped to whole years");
  assert.ok(map2.includes('if (ageMed()) { const v = b.raw.ageMed ? b.raw.ageMed[j] : null;'), "booth colour reads the median-age lane, never a share cell");
  assert.ok(base.includes('if (S.ageMode === "a65" || S.ageMode === "a2034")'), "the 65+/20–34 views ride the demo tuple's cells 1/2 untouched");
  assert.ok(ui.includes('lgMenu("agev",' ), "the legend's age picker rides the panel dropdown idiom");
  assert.ok(ui.includes('else if (k === "agev") S.ageMode = v;'), "the age picker change handler is wired");
  assert.ok(ui.includes('if (i === "a65" || i === "a2034") { S.index = LENS_AGE;') && ui.includes('p.set("av", S.ageMode);') && ui.includes('p.get("av")'), "legacy a65/a2034 hashes alias onto the lens and av carries the view both ways");
  assert.ok(ui.includes("Age: ${AGE_SHORT[S.ageMode]}"), "the lens head names the picked age view");
  assert.ok(ui.includes("Median resident age, interpolated from census age bands"), "the median-age legend note names its interpolation");
  assert.ok(ui.includes("the 18–19 share of the 15–19 band"), "the 18–24 view admits its band-split estimate");
  assert.ok(ui.includes("ageMed() ? Math.round(ausShare)"), "the Australia line formats whole years on the median view");
  assert.ok(story.includes("The median age in ${ds(d.n)} is"), "the seat's median-age headline");
  assert.ok(story.includes("The median age near here is"), "the place's median-age headline");
  assert.ok(story.includes("AGE_TOP[S.ageMode]"), "the area ranking phrases follow the picked age view");
  assert.ok(list.includes("ageMed()") && list.includes("yr"), "the list column prices the median-age view in whole years");
}

// ── the Education lens (2026-10-31): the fold's third sibling — the
// uni/y12less schooling pair ride one People-menu entry, University
// educated the landing read and the left-school-early share one picker
// switch away. Each read keeps its own DM lane for the dicts, ranges,
// ramps and area rankings, the hash gains ev, legacy uni/y12less hashes
// alias in, and an era that never printed the schooling read (the
// statistics-era '90s) offers it nowhere
{
  const base = part("app-1-base.js"), ui = part("app-6-ui.js"), story = part("app-4-story.js");
  assert.ok(base.includes('const LENS_EDU = "edu";') && base.includes('const EDU_MODES = ["uni", "y12less"];'), "the Education lane id and its two reads, university first");
  assert.ok(base.includes('if (k === "uni") { ks.push(LENS_EDU); continue; }'), "the People menu folds the schooling pair into the one Education entry (DM stays positional against the demo tuple)");
  assert.ok(base.includes('uni: "University educated", edu: "Education",') && base.includes('uni: "University", edu: "Education",'), "the menu entry labels itself Education in both name tables");
  assert.ok(base.includes('eduMode: "uni"'), "University educated is the landing read");
  assert.ok(base.includes('if (isEdu()) return d.demo ? d.demo[S.eduMode] : null;'), "the read rides its own demo-dict key");
  assert.ok(base.includes('DM_RANGE[S.eduMode]') && base.includes('isEdu() ? S.eduMode :'), "range and ramp follow the picked read");
  assert.ok(base.includes("m.hasLane[LENS_EDU] = m.hasLane.uni;"), "the menu gate rides the university read");
  assert.ok(ui.includes('lgMenu("eduv",' ), "the education picker rides the panel dropdown idiom");
  assert.ok(ui.includes("EDU_MODES.filter((k) => !m.hasLane || m.hasLane[k] !== false)"), "the picker offers only reads the frame printed");
  assert.ok(ui.includes('else if (k === "eduv") S.eduMode = v;'), "the picker change handler is wired");
  assert.ok(ui.includes('if (i === "uni" || i === "y12less") { S.index = LENS_EDU;') && ui.includes('p.get("ev")'), "legacy uni/y12less hashes alias onto the lens with that read picked");
  assert.ok(ui.includes('p.set("ev", S.eduMode);'), "the hash carries the schooling read");
  assert.ok(ui.includes("S.ageMode, S.eduMode"), "the legend's refresh key re-reads on a schooling switch");
  assert.ok(ui.includes("Education: ${EDU_SHORT[S.eduMode]}"), "the lens head names the picked read");
  assert.ok(ui.includes("isEdu() ? EDU_NOTE[S.eduMode]"), "the legend note names the picked read");
  assert.ok(ui.includes("b.hasLane[S.eduMode] === false"), "a year swap falls back to the frame's own publication when a read never printed");
  assert.ok(story.includes("isEdu() ? DM_TOP[S.eduMode]"), "the area ranking phrases follow the picked read");
}

// ── the six new People lanes (2026-10-29): y12less/atsci/u15/onepar plain
// lanes + Religion (norel-first) and Housing-tenure (mort-first) select
// families. Every lane rides every census edition (2001 BCP → 2021 GCP), the
// venue stores, the GCP-era readers and the /map/ lens machinery
{
  const base = part("app-1-base.js"), ui = part("app-6-ui.js"), story = part("app-4-story.js");
  assert.ok(base.includes('"y12less", "atsci", "u15", "onepar"') && base.includes('"loinc", "hiinc", "y12less"'), "the DM list carries the four plain lanes after the income pair");
  for (const k of ["y12less", "atsci", "u15", "onepar"]) {
    assert.ok(new RegExp(`\\b${k}:`).test(base), `the DM_* maps carry ${k} (name/short/verb/range)`);
  }
  assert.ok(base.includes('y12less: "Year 12 or less"'), "the lane's display name per the user");
  assert.ok(base.includes('atsci: "Indigenous Australians"'), "the indigenous lane's display name");
  assert.ok(base.includes('rel: seq(88, 0.12), ten: seq(258, 0.12)'), "the select lenses own their own ramp hues");
  assert.ok(base.includes('const REL_NAME = { norel: "No religion"'), "the Religion menu leads with No religion");
  assert.ok(base.includes('const TEN_NAME = { mort: "Owned with a mortgage"'), "Housing tenure leads with owned-with-mortgage");
  assert.ok(base.includes('const RELISMS = {') && base.includes('jew: "are Jewish"'), "the per-religion story verbs");
  assert.ok(base.includes('const TENESMS = {') && base.includes('rentPub:'), "the per-tenure story verbs (public rental included)");
  assert.ok(base.includes('const isRel = () => S.index === LENS_REL && S.rel != null;') && base.includes('const isTen = () => S.index === LENS_TEN && S.ten != null;'), "the two select-view guards");
  assert.ok(base.includes("m.relKeys = res.relKeys || null;") && base.includes("m.tenKeys = res.tenKeys || null;") && base.includes("m.relPos"), "loadYear records the rel/ten key orders and their positional spots");
  assert.ok(base.includes("demo.rel = {};"), "the Religion pools sum shares of residents the cob way");
  assert.ok(base.includes("demo.ten = {};"), "the Tenure pools do too");
  assert.ok(base.includes('const selPos = (m) =>'), "selPos: the select-aware positional map at the booth seams");
  assert.ok(ui.includes('lgMenu("rel",' ), "the legend's Religion picker");
  assert.ok(ui.includes('lgMenu("ten",' ), "the legend's Housing tenure picker");
  assert.ok(ui.includes('[[LENS_REL, "Religion"]]') && ui.includes('[[LENS_TEN, "Housing tenure"]]'), "the People optgroup lists both new lenses");
  assert.ok(ui.includes('if (isRel() && S.rel !== "norel") p.set("rl", S.rel);') && ui.includes('if (isTen() && S.ten !== "mort") p.set("tn", S.ten);'), "the hash carries rl/tn choices past their defaults");
  assert.ok(ui.includes('S.rel = REL_NAME[p.get("rl")] ? p.get("rl") : "norel";'), "readURL restores No-religion by default");
  assert.ok(ui.includes('k === "rel"') && ui.includes('k === "ten"'), "both pickers' change handlers are wired");
  assert.ok(/S\.index === LENS_REL && m\.relKeys/.test(ui) && /S\.index === LENS_TEN && m\.tenKeys/.test(ui), "the two sub-selects appear only on their lenses when their rows exist");
  assert.ok(story.includes("const REL_TOP = {") && story.includes("norel:") && story.includes("const TEN_TOP = {"), "area stories phrase the select options' top-fifth words");
  assert.ok(ui.includes('isRel() ? REL_NAME[S.rel] : isTen()'), "the Religion head is the option itself (no 'Religion:' prefix, 2026-10-31 user call)");
  assert.ok(!ui.includes('`Religion: ${REL_NAME[S.rel]}`'), "the prefixed Religion head is gone");
  assert.ok(ui.includes('isAnc() ? `${ANC_NAME[S.anc]} ancestry`'), "the Ancestry head names the picked ancestry (German ancestry), the tenure pattern");
  // the data files' structure at every fed stop: relKeys (norel first),
  // tenKeys (mort first), 12-wide demo rows, division rel/ten dicts
  for (const y of [2004, 2007, 2010, 2013, 2016, 2019, 2022, 2025]) {
    const d = JSON.parse(R(`map/data/res-${y}.json`));
    assert.ok(Array.isArray(d.relKeys) && d.relKeys[0] === "norel" && d.relKeys.length === 10, `${y}: relKeys leads with norel (10 options)`);
    assert.ok(Array.isArray(d.tenKeys) && d.tenKeys[0] === "mort" && d.tenKeys.length === 4, `${y}: tenKeys leads with mort (4 options)`);
    const i = d.booths.demo.findIndex((x) => x !== null);
    assert.equal(d.booths.demo[i].length, 17, `${y}: demo rows are 17-wide (12 + 4 lanes of the 2026-10-31 arc + hiqinc, the top-quarter income share)`);
    assert.ok(Array.isArray(d.booths.rel[i]) && d.booths.rel[i].length === 10, `${y}: parallel booth religion rows`);
    assert.ok(Array.isArray(d.booths.ten[i]) && d.booths.ten[i].length === 4, `${y}: parallel booth tenure rows`);
    assert.ok(Array.isArray(d.booths.anc[i]) && d.booths.anc[i].length === 12, `${y}: parallel booth ancestry rows`);
    const lin = d.divs.find((x) => x.n === "Lingiari");
    assert.ok(lin.demo.atsci != null && lin.demo.rel && lin.demo.rel.norel != null && lin.demo.ten && lin.demo.ten.mort != null, `${y}: Lingiari carries atsci/rel/ten`);
    assert.ok(lin.demo.onepar != null && lin.demo.y12less != null && lin.demo.u15 != null, `${y}: Lingiari carries onepar/y12less/u15`);
    if (+y >= 2013) {
      assert.ok(lin.demo.pt != null && lin.demo.noncit != null && lin.demo.bigfam != null && lin.demo.hl != null && lin.demo.anc && lin.demo.anc.australian != null, `${y}: Lingiari carries the 2026-10-31 lanes (pt/noncit/bigfam/hl/anc)`);
    }
    if (y === 2007 || y === 2010) assert.ok(lin.demo.hl == null, `${y}: no homeless figures this early (2049.0 starts 2011)`);
    if (y === 2004) assert.ok(lin.demo.bigfam == null, "2004: no children figures (its c0 census, 2001, has no children-ever-born table)");
  }
}

// ── the census pickers in the list view (2026-10-31): the key (legend) shows
// in ALL THREE views — it used to hide in the list, whose lens column still
// reads S.index, so a reader sorting seats by a census measure couldn't see
// or change which measure it was. The list bar got bare selects first; the
// user's call: show the ONE legend (same markup, same styling) over every
// view, no lookalikes. The measure select and its active-lane sub-pickers
// come from ONE shared builder (censusSelects) either way
{
  const ui = part("app-6-ui.js"), list = part("app-5-list.js");
  assert.ok(ui.includes("function censusSelects(m, cls = \"\")"), "the shared census-picker builder");
  assert.ok(ui.includes("[null, \"Advantage, ABS SEIFA\"]"), "the census measure dropdown opens with its ABS group, panel-idiom");
  assert.ok(ui.includes('out.push(lgMenu("cob",') && ui.includes('out.push(lgMenu("rel",') && ui.includes('out.push(lgMenu("ten",'), "the active lane's own pickers ride the panel builder too");
  assert.ok(ui.includes('for (const s of censusSelects(m)) h += `<div class="lg-t">${s}</div>`;'), "the legend lays each picker out in its own block");
  assert.ok(ui.includes("if (!m) { el.hidden = true; return; }"), "the legend renders regardless of view");
  assert.ok(!ui.includes('S.view === "list") { el.hidden = true; return; }'), "the legend no longer hides in the list view");
  assert.ok(!list.includes("censusSelects"), "no lookalike selects in the list bar — the ONE legend serves every view");
  assert.ok(!part("page.css").includes('.ls-sel[aria-label="Census measure"]'), "no bar-only census select styling survives");
}

// a text cell that follows a numeric list-table cell gets the same 8px left
// gap every seam carries (the seat-type lens column sits after Swing)
{
  const css = part("page.css"), list = part("app-5-list.js");
  assert.ok(css.includes('.ls-row > div.r + div:not(.r) { padding-left: 8px; }'), "a text cell after a numeric cell keeps 8px left padding in list rows");
  assert.ok(css.includes('.ls-head .ls-hc.r + .ls-hc:not(.r) { padding-left: 8px; }'), "the list header keeps the same gap");
  assert.ok(list.includes('if (S.lens === "cls") return esc(CLS_SHORT[v]);'), "the seat-type lens cell is the class name as plain text, no key swatch");
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
  assert.ok(sa.incomeCuts && sa.incomeCuts.hiEdgeWeekly === 4000 && sa.incomeCuts.dollarsYear === 2021, "sa26 incomeCuts: GCP-era band read at its 2021-era cuts");
  if ("seifaCuts" in sa) assert.equal(sa.seifaCuts, null, "sa26 has no voter-footprint SEIFA cuts");
  const DMK = ["lang", "a65", "a2034", "fborn", "uni", "blue", "y12less", "atsci", "u15", "onepar"], IXS = ["irsad", "irsd", "ier", "ieo"];
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
  // income slots populated since the income arc). Mobile teams and booths in SA1s the cube does
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
      if (dm !== null) assert.ok(Array.isArray(dm) && dm.length === 17 && dm.every((x) => x === null || (typeof x === "number" && x >= 0 && x <= 1)), `sa26 ${B.n[k]}: demo is ten people cells plus the six of the 2026-10-31 arcs plus pt/noncit (income slots populated)`);
      const an = B.anc[k];
      if (an !== null) assert.ok(Array.isArray(an) && an.length === 12 && an.every((x) => x === null || (typeof x === "number" && x >= 0 && x <= 1)), `sa26 ${B.n[k]}: anc rides its twelve ancestry shares`);
    }
    const adl = B.n.indexOf("Adelaide");
    assert.ok(adl >= 0, "sa26: the Adelaide booth exists");
    assert.deepEqual(B.dec[adl], [8, 7, 2, 10], "sa26: the Adelaide booth's SA1 national deciles");
    assert.deepEqual(B.demo[adl], [0.2928, 0.1545, 0.3648, 0.4629, 0.5625, 0.1793, 0.2433, 0.1315, 0.2701, 0.1675, 0.0, 0.0472, 0.1579, 0.042, 0.2747, 0.0286, 0.0213], "sa26: the Adelaide booth's SA1 people cells, the six lanes of the 2026-10-31 arcs");
    assert.deepEqual(B.anc[adl], [0.3067, 0.2578, 0.08, 0.0933, 0.1778, 0.0267, 0.0578, 0.0267, 0, 0.0222, 0.0178, 0], "sa26: the Adelaide booth's Ancestry row (English leads)");
    assert.deepEqual(B.rel[adl], [0.5602, 0.1713, 0.0556, 0.0463, 0.0, 0.0139, 0.0278, 0.0185, 0.0278, 0.0], "sa26: the Adelaide booth's Religion row (No-religion leads)");
    assert.deepEqual(B.ten[adl], [0.2656, 0.5391, 0.1953, 0.0234], "sa26: the Adelaide booth's Housing-tenure row");
    assert.deepEqual(B.dec[B.n.indexOf("Beaumont")], [10, 10, 9, 10], "sa26: Beaumont, the top of the range");
    assert.deepEqual(B.dec[B.n.indexOf("Barmera")], [1, 1, 2, 2], "sa26: Barmera, the bottom of the range");
    const spread = new Set(B.dec.filter(Boolean).map((d) => d[0]).filter((x) => x !== null));
    assert.ok(spread.size >= 8, "sa26 booth IRSAD deciles spread across the range (a monotone join bug collapses them)");
  }
  // the birthplace sub-view's data (spliced by the same boothcensus pass):
  // the frame's ten-country cob rows in site order, every geocoded booth's
  // reading from the SA1 it stands in, parallel to the people cells
  {
    assert.deepEqual(sa.cobKeys, GCP_COB_KEYS, "sa26: cobKeys holds the ten curated countries in site order");
    assert.equal(B.cob.length, B.n.length, "sa26: a cob row per booth slot");
    assert.equal(B.cob.filter(Boolean).length, 747, "sa26: cob rows parallel to the people cells");
    assert.equal(B.cob.filter((x, k) => (x === null) !== (B.demo[k] === null)).length, 0, "sa26: cob rows null exactly where the census block is");
    for (let k = 0; k < B.n.length; k++) {
      const r = B.cob[k];
      if (r !== null) assert.ok(Array.isArray(r) && r.length === GCP_COB_KEYS.length && r.every((x) => x === null || (typeof x === "number" && x >= 0 && x <= 1)), `sa26 ${B.n[k]}: cob is ten 0-1 country shares`);
    }
    const adl = B.n.indexOf("Adelaide");
    assert.deepEqual(B.cob[adl], [0.0655, 0.0262, 0.0742, 0.0, 0.0, 0.0, 0.0131, 0.0, 0.0, 0.0], "sa26: the Adelaide booth's birthplace cells");
    for (const d of sa.divs) assert.ok(d.demo && d.demo.cob && Object.keys(d.demo.cob).length === GCP_COB_KEYS.length, `sa26 ${d.n}: demo carries the ten-country cob`);
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
      if (dm !== null) assert.ok(Array.isArray(dm) && dm.length === 17 && dm.every((x) => x === null || (typeof x === "number" && x >= 0 && x <= 1)), `sa22 ${B.n[k]}: demo is ten people cells plus the six of the 2026-10-31 arcs plus pt/noncit (income slots populated)`);
      const an = B.anc[k];
      if (an !== null) assert.ok(Array.isArray(an) && an.length === 12, `sa22 ${B.n[k]}: anc rides its twelve ancestry shares`);
    }
    const adl = B.n.indexOf("Adelaide");
    assert.ok(adl >= 0, "sa22: the Adelaide booth exists");
    assert.deepEqual(B.dec[adl], [8, 7, 2, 10], "sa22: the Adelaide booth's SA1 national deciles");
    assert.deepEqual(B.demo[adl], [0.2928, 0.1545, 0.3648, 0.4629, 0.5625, 0.1793, 0.2433, 0.1315, 0.2701, 0.1675, 0, 0.0472, 0.1579, 0.042, 0.2747, 0.0286, 0.0213], "sa22: the Adelaide booth's SA1 people cells, the six lanes of the 2026-10-31 arcs (income slots re-pinned after the family-offset fix, 2026-11-04)");
    assert.deepEqual(B.anc[adl], [0.3067, 0.2578, 0.08, 0.0933, 0.1778, 0.0267, 0.0578, 0.0267, 0, 0.0222, 0.0178, 0], "sa22: the Adelaide booth's Ancestry row");
    assert.deepEqual(B.rel[adl], [0.5602, 0.1713, 0.0556, 0.0463, 0.0, 0.0139, 0.0278, 0.0185, 0.0278, 0.0], "sa22: the Adelaide booth's Religion row (No-religion leads)");
    assert.deepEqual(B.ten[adl], [0.2656, 0.5391, 0.1953, 0.0234], "sa22: the Adelaide booth's Housing-tenure row");
    const spread = new Set(B.dec.filter(Boolean).map((d) => d[0]).filter((x) => x !== null));
    assert.ok(spread.size >= 8, "sa22 booth IRSAD deciles spread across the range (a monotone join bug collapses them)");
  }
  // the birthplace sub-view's data on the 2022 frame: the same ten-country
  // cob rows, spliced sa26-plain by build_sa_boothcensus.py
  {
    assert.deepEqual(res.cobKeys, GCP_COB_KEYS, "sa22: the ten curated countries in site order");
    const BB = res.booths;
    assert.equal(BB.cob.length, BB.n.length, "sa22: a cob row per booth slot");
    assert.equal(BB.cob.filter(Boolean).length, 689, "sa22: cob rows parallel to the people cells");
    assert.equal(BB.cob.filter((x, k) => (x === null) !== (BB.demo[k] === null)).length, 0, "sa22: cob rows null exactly where the census block is");
    for (let k = 0; k < BB.n.length; k++) {
      const r = BB.cob[k];
      if (r !== null) assert.ok(Array.isArray(r) && r.length === GCP_COB_KEYS.length && r.every((x) => x === null || (typeof x === "number" && x >= 0 && x <= 1)), `sa22 ${BB.n[k]}: cob is ten 0-1 country shares`);
    }
    const adl = BB.n.indexOf("Adelaide");
    assert.deepEqual(BB.cob[adl], [0.0655, 0.0262, 0.0742, 0.0, 0.0, 0.0, 0.0131, 0.0, 0.0, 0.0], "sa22: the Adelaide booth's birthplace cells");
    for (const d of res.divs) assert.ok(d.demo && d.demo.cob && Object.keys(d.demo.cob).length === GCP_COB_KEYS.length, `sa22 ${d.n}: demo carries the ten-country cob`);
  }
  // the census lanes splice exactly as sa26's
  {
    const DMK = ["lang", "a65", "a2034", "fborn", "uni", "blue", "y12less", "atsci", "u15", "onepar", "pt", "noncit", "bigfam", "hl"], IXS = ["irsad", "irsd", "ier", "ieo"];
    assert.equal(res.divs.length, 47, "sa22: 47 districts with census rows");
    const dec = new Set(res.divs.map((d) => d.seifa.irsad.dec));
    assert.ok(dec.size >= 8, "sa22 IRSAD deciles spread across the range (a monotone join bug collapses them)");
    for (const d of res.divs) {
      assert.ok(d.demo && DMK.every((k) => typeof d.demo[k] === "number") && typeof d.demo.p === "number" && d.demo.anc && typeof d.demo.anc.australian === "number", `sa22 ${d.n}: demo row`);
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
  assert.ok(js.includes('const FED_LENS = new Set(["senate", "senpref", "cls"]);') && js.includes('const SEN_PREF_STATE_FRAMES = new Set(["nsw15", "nsw19", "nsw23"]);') && js.includes("const yearLenses = (y) => STATE_YEARS.has(y) ? LENSES.filter((l) => !FED_LENS.has(l.id) || (l.id === \"senpref\" && SEN_PREF_STATE_FRAMES.has(y))) : LENSES;"), "yearLenses filters the federal-only lenses (Senate vote, seat type) for the state frames — New South Wales' frames keep the Senate-ballot reading beside their LC preference files");
  assert.ok(js.includes("const list = sen ? SEN_LENSES : yearLenses(S.year)"), "renderLenses draws the year's own lenses");
  assert.ok(js.includes("const L = yearLenses(S.year), k = (L.findIndex("), "walkLens walks the year's own lenses");
  assert.ok(js.includes('const l = p.get("l"); if (l && (yearLenses(S.year).some((x) => x.id === l) || (l === "senpref" && (!STATE_YEARS.has(S.year) || SEN_PREF_STATE_FRAMES.has(S.year))))) S.lens = l;'), "readURL opens the Senate-ballot reading for federal links and New South Wales' LC ones, not for a state without per-ballot LC data");
  assert.ok(js.includes('clsLensShelved ||= S.lens === "cls"') && js.includes('clsLensShelved && S.lens === "winner") { S.lens = "cls"; clsLensShelved = false; }'), "the cls lens shelves through a state frame and returns itself (and its chips) on a federal one; every other federal-only lens drops to winner and returns when named");
  // the Senate's ballot rankings live inside the Preferences tab, not as a tab of their own
  assert.ok(!js.includes('{ id: "senpref"'), "no Senate preferences tab");
  assert.ok(js.includes('data-flip="flowsrc"') && js.includes("getJSON(`/map/data/senate-prefs-${k}.json`)"), "the Preferences key switches to the Senate's ballots, loaded with the switch");
  for (const y of [2016, 2019, 2022, 2025]) {
    const f = JSON.parse(R(`map/data/senate-prefs-${y}.json`)), six = y >= 2022, want = six ? 54 : 27;
    assert.equal(Object.keys(f.divs).length >= 150, true, `senate-prefs-${y} has every division`);
    assert.ok(f.divs.Hunter && f.divs.Hunter.length === want, `senate-prefs-${y} rows carry ${want} counts`);
    assert.deepEqual(f.pairs, six ? ["AC", "AO", "CO", "GO", "GA", "GC"] : ["AC", "AO", "CO"], `senate-prefs-${y}: the two-party lens's three Greens pairings ride after the Senate orders' three on the frames that build them`);
    assert.deepEqual(f.donors[six ? "GO" : "AC"], six ? ["alp", "lnp", "oth"] : ["grn", "onp", "oth"], `senate-prefs-${y} names its donor groups`);
  }
  assert.deepEqual(JSON.parse(R("map/data/senate-prefs-2025.json")).absent, { ACT: ["onp"] }, "One Nation had no Senate ticket in the ACT in 2025");
  // the group-ticket era reads the parties' lodged tickets (2004-2013, .build/map/senate_gvt_prefs.py),
  // presented as tickets never ballot tallies; the record starts in 2004 because the AEC's machine
  // record does, and 2004 keeps seats only (no per-place Senate product was ever served)
  assert.ok(js.includes("const SP_YEARS = new Set([2004, 2007, 2010, 2013, 2016, 2019, 2022, 2025]);"), "SP_YEARS spans the ticket era and the ballot era, and nothing before 2004");
  for (const y of [2004, 2007, 2010, 2013]) {
    const f = JSON.parse(R(`map/data/senate-prefs-${y}.json`));
    assert.equal(f.gvt, true, `senate-prefs-${y} is marked a group-ticket reading`);
    assert.equal(Object.keys(f.divs).length >= 150, true, `senate-prefs-${y} has every division`);
    assert.ok(f.divs.Hunter && f.divs.Hunter.length === 27, `senate-prefs-${y} rows carry 27 counts`);
    assert.deepEqual(f.absent, { TAS: ["onp"], ACT: ["onp"], NT: ["onp"] }, `senate-prefs-${y}: One Nation sat out Tasmania, the ACT and the NT`);
  }
  assert.equal(Object.keys(JSON.parse(R("map/data/senate-prefs-2004.json")).booths).length, 0, "2004's ticket record holds no polling places");
  for (const y of [2007, 2010, 2013]) assert.ok(Object.keys(JSON.parse(R(`map/data/senate-prefs-${y}.json`)).booths).length > 8000, `senate-prefs-${y} reads polling places too`);
  for (const y of [2016, 2019, 2022, 2025]) assert.ok(!JSON.parse(R(`map/data/senate-prefs-${y}.json`)).gvt, `senate-prefs-${y} stays a ballot tally`);
  assert.ok(js.includes('spGvtYear(m.year) != null ? "Senate tickets" : "Senate ballots"'), "the Preferences key's switch calls the ticket years tickets");
  assert.ok(js.includes(" Senate tickets put ") && js.includes("Lodged group voting tickets,"), "the story and the legend present the ticket years as the parties' orders");
  assert.ok(js.includes("No Senate preference record for "), "years before the AEC's record get their own message");
  assert.ok(js.includes('kind === "booth" && spYear(m.year) === 2004) return "No Senate count by polling place in 2004"'), "2004's booth view explains its seat-only record");
  assert.ok(js.includes('if (FED_LENS.has(id) && STATE_YEARS.has(S.year) && !(id === "senpref" && SEN_PREF_STATE_FRAMES.has(S.year))) return;'), "setLens refuses a federal-only lens on a state frame; New South Wales' frames take its senpref beside their LC files");
  // the legend-height probe used to sweep every lens for a global max; since the
  // per-lens hold (2026-10-26) it measures the CURRENT lens only, and setYear/setLens
  // above keep that lens one the year can show
  assert.ok(js.includes("const my = legendStandIn(m, y);") && !js.includes("for (const lens of yearLenses(y).map("), "the legend-height probe measures the current lens's stand-in (no lens sweep)");
  assert.ok(js.includes("w, S.view, y, real, S.lens, S.draw, S.tppMode"), "the legend-height hold key carries the lens, its draw, and its mode");
  // the hold follows the CURRENT draw's booth faces (seats · polling places), so
  // slimmer views stop inheriting taller surfaces' peaks (2026-11-07: 58px slack gone)
  assert.ok(js.includes('for (const bo of S.view === "map" ? [false, true] : [false]) for (const dw of [S.draw])') && !js.includes('for (const dw of S.view === "map" ? DRAWS.map'), "the key's hold measures the current draw's two faces, not every surface's");
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
  assert.ok(js.includes('lgMenu("infm"') && js.includes("Exhausted ballots"), "map.js: the informal lens's Informal / Exhausted ballots switcher");
  assert.ok(js.includes('else if (k === "infm") S.infMode = v;') && js.includes('p.set("im", "exhaust")') && js.includes('p.get("im")'), "map.js: infMode's change handler + the im URL param both ways");
  assert.ok(js.includes("const infModeOf = (m) =>") && js.includes("const infHi =") && js.includes("? 25 : 12"), "map.js: infModeOf and infHi (the 25 exhausted ceiling)");
  assert.ok(js.includes("nn(d.exhPct)") && js.includes("nn(m.divs[b.d[j]].exhPct)"), "map.js: the exhausted datum reads the flow rows, booths falling back to the district's");
  assert.ok(js.includes('"Exhausted ballots" : "Informal"') && js.includes("ballots exhausting before the final two"), "map.js: the exhausted view's scale word and legend title");
  assert.ok(js.includes("optional-preferential, so a ballot leaves the count when its numbered candidates are gone"), "map.js: the exhausted legend note explains the scheme");
  assert.ok(js.includes('m.res.flOpv ? lgMenu("infm",'), "map.js: the switcher is offered only on the optional-preferential frame");
  // the census lanes (the same splice contract as the SA frames')
  const DMK = ["lang", "a65", "a2034", "fborn", "uni", "blue", "y12less", "atsci", "u15", "onepar", "pt", "noncit", "bigfam", "hl"], IXS = ["irsad", "irsd", "ier", "ieo"];
  for (const d of res.divs) {
    assert.ok(d.demo && DMK.every((k) => typeof d.demo[k] === "number") && typeof d.demo.p === "number" && typeof d.demo.n === "number", `nsw23 ${d.n}: demo row`);
    assert.deepEqual(Object.keys(d.demo).sort(), [...DMK, "anc", "cob", "rel", "ten", "n", "p", "loinc", "hiinc", "hiqinc", "medIncWeekly"].sort(), `nsw23 ${d.n}: GCP-era lanes ride the ten keys plus income plus the birthplace and ancestry dicts`);
    assert.deepEqual(Object.keys(d.demo.anc).sort(), [...ANC_GCP].sort(), `nsw23 ${d.n}: the twelve Ancestry options`);
    assert.deepEqual(Object.keys(d.demo.cob).sort(), [...GCP_COB_KEYS].sort(), `nsw23 ${d.n}: the ten-country cob`);
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
  // (income slots populated since the income arc). Mobile teams and booths in
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
      if (dm !== null) assert.ok(Array.isArray(dm) && dm.length === 17 && dm.every((x) => x === null || (typeof x === "number" && x >= 0 && x <= 1)), `nsw23 ${B.n[k]}: demo is ten people cells plus the six of the 2026-10-31 arcs plus pt/noncit (income slots populated)`);
      const an = B.anc[k];
      if (an !== null) assert.ok(Array.isArray(an) && an.length === 12, `nsw23 ${B.n[k]}: anc rides its twelve ancestry shares`);
    }
    const balmain = B.n.indexOf("Balmain Public");
    assert.ok(balmain >= 0, "nsw23: the Balmain Public booth exists");
    assert.deepEqual(B.dec[balmain], [10, 10, 7, 10], "nsw23: Balmain Public's SA1 national deciles");
    assert.deepEqual(B.demo[balmain], [0.1004, 0.175, 0.1767, 0.286, 0.6157, 0.0452, 0.117, 0.4897, 0.5325, 0.1409, 0.0, 0.1681, 0.1457, 0.0312, 0.1185, 0.108, 0.0022], "nsw23: Balmain Public's SA1 people cells, the six lanes of the 2026-10-31 arcs");
    assert.deepEqual(B.anc[balmain], [0.4446, 0.3376, 0.1996, 0.1162, 0.0254, 0.0544, 0.0417, 0.0073, 0.0109, 0.0127, 0, 0], "nsw23: Balmain Public's Ancestry row");
    assert.deepEqual(B.rel[balmain], [0.5301, 0.2477, 0.102, 0.031, 0.031, 0.0164, 0.0055, 0, 0, 0.0219], "nsw23: Balmain Public's Religion row (No-religion leads)");
    assert.deepEqual(B.ten[balmain], [0.3252, 0.3496, 0.3049, 0], "nsw23: Balmain Public's Housing-tenure row");
    assert.deepEqual(B.cob[balmain], [0.0899, 0.0072, 0.0072, 0.0216, 0.0126, 0.0072, 0.0, 0.009, 0.0, 0.0], "nsw23: Balmain Public's birthplace cells");
    assert.deepEqual(B.dec[B.n.indexOf("Inner City Montessori School")], [10, 10, 9, 10], "nsw23: Inner City Montessori School, the top of the range");
    assert.deepEqual(B.dec[B.n.indexOf("Springdale Hghts Public")], [1, 1, 1, 1], "nsw23: Springdale Hghts Public, the bottom of the range");
    assert.deepEqual(B.dec[B.n.indexOf("Lavington E Public")], [1, 1, 2, 1], "nsw23: Lavington E Public, also the bottom of the range");
    const spread = new Set(B.dec.filter(Boolean).map((d) => d[0]).filter((x) => x !== null));
    assert.ok(spread.size >= 8, "nsw23 booth IRSAD deciles spread across the range (a monotone join bug collapses them)");
  }
  // the birthplace sub-view's data on the NSW frame (build_nsw23_boothcensus.py):
  // the ten-country cob rows in site order, parallel to the people cells
  {
    assert.deepEqual(res.cobKeys, GCP_COB_KEYS, "nsw23: the ten curated countries in site order");
    assert.equal(B.cob.length, B.n.length, "nsw23: a cob row per booth slot");
    assert.equal(B.cob.filter(Boolean).length, 2950, "nsw23: cob rows parallel to the people cells (the fixed booths; mobile teams stay null)");
    assert.equal(B.cob.filter((x, k) => (x === null) !== (B.demo[k] === null)).length, 0, "nsw23: cob rows null exactly where the census block is");
    for (let k = 0; k < B.n.length; k++) {
      const r = B.cob[k];
      if (r !== null) assert.ok(Array.isArray(r) && r.length === GCP_COB_KEYS.length && r.every((x) => x === null || (typeof x === "number" && x >= 0 && x <= 1)), `nsw23 ${B.n[k]}: cob is ten 0-1 country shares`);
    }
  }
}

// ── the nsw15/nsw19 frames (2026-11-04): New South Wales' 28 March 2015 and
// 23 March 2019 state elections on the 2013 redistribution's 93 districts —
// the same district set as one another, one boundary vintage back from
// nsw23's. Boundaries from NSW's ArcGIS FeatureServer "2013_NSW_Electoral_
// Boundaries" (make-n13-geojson.py); results from the committed
// .build/state-flow-src/nsw/<year>/ NSWEC pages (build_nsw15_data.py /
// build_nsw19_data.py), census lanes off the 2011/2016 SA1 packs via
// nsw13_geo.py's pinned join caches; nsw19's past join is 2015 over the same
// district names (no redistribution between), nsw15 names no previous
// election (the series' first stop — the 2001-period pages were never
// committed). Both frames carry the counted NSW preference-flow banks
{
  for (const [tag, want] of Object.entries({
    nsw15: { date: "2015-03-28", prev: null, seats: { ALP: 34, LIB: 37, NAT: 17, GRN: 3, IND: 2 },
             formal: 4404334, informal: 156900, enrolled: 5040662, booths: 3324,
             geocoded: 2657, flRows: 354, c5: 540, demoYear: 2011 },
    nsw19: { date: "2019-03-23", prev: 2015, seats: { ALP: 36, LIB: 35, NAT: 13, GRN: 3, SFF: 3, IND: 3 },
             formal: 4551886, informal: 162897, enrolled: 5271775, booths: 2946,
             geocoded: 2855, flRows: 382, c5: 568, h: 93, c5nz: 566, tpp2: 70,
             pformal: 4404334, demoYear: 2016 },
  })) {
    const res = JSON.parse(R(`map/data/res-${tag}.json`));
    assert.equal(res.year, tag, `${tag}: year id`);
    assert.equal(res.date, want.date, `${tag}: polling day`);
    assert.equal(res.prev ?? null, want.prev, `${tag}: prev`);
    assert.equal(res.jurisdiction, "NSW", `${tag}: jurisdiction`);
    assert.equal(res.demoBasis, "sa1", `${tag}: SA1 census basis`);
    assert.equal(res.demoYear, want.demoYear, `${tag}: demoYear names its era census`);
    assert.deepEqual(Object.keys(res.agg), ["AUS", "NSW"], `${tag}: its frame's two areas`);
    assert.equal(res.divs.length, 93, `${tag}: 93 districts`);
    assert.equal(res.flBasis, "counted", `${tag}: counted preferences`);
    assert.equal(res.flOpv, true, `${tag}: optional-preferential flag`);
    for (const f of [`geo-${tag}-lo.json`, `geo-${tag}-hi.json`, `data-${tag}.json`, `senate-${tag}.json`, `core-${tag}.json`]) assert.ok(fs.existsSync(path.join(ROOT, "map", "data", f)), "map/data/" + f);
    const tally = {};
    let h = 0, c5 = 0, c5nz = 0, tpp2 = 0;
    for (const d of res.divs) {
      const w = d.tcp[0][1] >= d.tcp[1][1] ? d.tcp[0][0] : d.tcp[1][0];
      tally[d.c[w][1]] = (tally[d.c[w][1]] || 0) + 1;
      assert.equal(d.c.findIndex((c) => c[6] === 1), w, `${tag} ${d.n}: elected flag on the final winner`);
      h += (d.h || []).length;
      for (const c of d.c) { assert.ok(Number.isFinite(c[5]), `${tag} ${d.n}: c[5] finite`); c5++; c5nz += c[5] !== 0 ? 1 : 0; }
      if (d.tpp && Number.isFinite(d.tpp[2])) tpp2++;
      assert.ok(d.demo && typeof d.demo === "object" && d.demo.p > 0, `${tag} ${d.n}: census people lane`);
      assert.ok(d.seifa && Number.isFinite(d.seifa.irsad.v), `${tag} ${d.n}: SEIFA lane`);
    }
    assert.deepEqual(tally, want.seats, `${tag}: the official seat tally`);
    assert.deepEqual(res.agg.NSW.seats, tally, `${tag}: agg seats mirror the derived tally`);
    assert.equal(res.agg.NSW.formal, want.formal, `${tag}: Assembly formal vote`);
    assert.equal(res.agg.NSW.inf, want.informal, `${tag}: informal vote`);
    assert.equal(res.divs.reduce((t, d) => t + d.enrolled, 0), want.enrolled, `${tag}: district enrolment sums to the official figure`);
    assert.equal(h, want.h || 0, `${tag}: ${want.h || 0} history rows`);
    assert.equal(c5, want.c5, `${tag}: candidate count`);
    assert.equal(c5nz, want.c5nz || 0, `${tag}: joined swings`);
    assert.equal(tpp2, want.tpp2 || 0, `${tag}: classic-pair swings`);
    assert.equal(res.divs.reduce((n, d) => n + d.fl.length, 0), want.flRows, `${tag}: ${want.flRows} counted flow quadruples`);
    if (want.pformal) assert.equal(res.agg.NSW.pformal, want.pformal, `${tag}: previous Assembly formal`);
    assert.equal(res.booths.n.length, want.booths, `${tag}: ${want.booths} venue rows`);
    assert.equal(res.booths.lat.filter((x) => x !== null).length, want.geocoded, `${tag}: ${want.geocoded} geocoded venues`);
    for (const d of res.divs) for (const row of d.fl) assert.equal(row[1] + row[2] + row[3], d.c[row[0]][4], `${tag} ${d.n}: a flow quadruple accounts for its first preferences`);
  }
}

// ── the vic14/vic18 frames (2026-11-04): Victoria's 29 November 2014 and
// 24 November 2018 state elections on the electoral boundaries determined in
// 2013 — one boundary era back from vic22's 88. Boundaries are the VEC
// open-data layer state_assembly_2013 (make-n13-geojson.py; the layer's one
// topology defect, a Pierce County missing piece in Hastings, is adjudicated
// in vic13_geo.py's PINNED_RESCUES). Results from the VEC historical-results
// mirrors in .build/state-flow-src/vic (build_vic14_data.py /
// build_vic18_data.py); census lanes off the 2011/2016 SA1 packs; vic18's
// past join is 2014 over the same district names
{
  for (const [tag, want] of Object.entries({
    vic14: { date: "2014-11-29", prev: 2010, seats: { ALP: 47, LIB: 30, NAT: 8, GRN: 2, IND: 1 },
             formal: 3355707, booths: 1786, geocoded: 1713, c5: 545, demoYear: 2011 },
    vic18: { date: "2018-11-24", prev: 2014, seats: { ALP: 55, LIB: 21, NAT: 6, GRN: 3, IND: 3 },
             formal: 3514474, booths: 1794, geocoded: 1726, c5: 507, c5nz: 507,
             h: 88, tpp2: 76, pformal: 3355707, demoYear: 2016 },
  })) {
    const res = JSON.parse(R(`map/data/res-${tag}.json`));
    assert.equal(res.year, tag, `${tag}: year id`);
    assert.equal(res.date, want.date, `${tag}: polling day`);
    assert.equal(res.prev ?? null, want.prev, `${tag}: prev`);
    assert.equal(res.jurisdiction, "VIC", `${tag}: jurisdiction`);
    assert.equal(res.demoBasis, "sa1", `${tag}: SA1 census basis`);
    assert.equal(res.demoYear, want.demoYear, `${tag}: demoYear names its era census`);
    assert.deepEqual(Object.keys(res.agg), ["AUS", "VIC"], `${tag}: its frame's two areas`);
    assert.equal(res.divs.length, 88, `${tag}: 88 districts`);
    for (const f of [`geo-${tag}-lo.json`, `geo-${tag}-hi.json`, `data-${tag}.json`, `senate-${tag}.json`, `core-${tag}.json`]) assert.ok(fs.existsSync(path.join(ROOT, "map", "data", f)), "map/data/" + f);
    const tally = {};
    let h = 0, c5 = 0, c5nz = 0, tpp2 = 0;
    for (const d of res.divs) {
      const w = d.tcp[0][1] >= d.tcp[1][1] ? d.tcp[0][0] : d.tcp[1][0];
      tally[d.c[w][1]] = (tally[d.c[w][1]] || 0) + 1;
      assert.equal(d.c.findIndex((c) => c[6] === 1), w, `${tag} ${d.n}: elected flag on the final winner`);
      h += (d.h || []).length;
      for (const c of d.c) { assert.ok(Number.isFinite(c[5]), `${tag} ${d.n}: c[5] finite`); c5++; c5nz += c[5] !== 0 ? 1 : 0; }
      if (d.tpp && Number.isFinite(d.tpp[2])) tpp2++;
      assert.ok(d.demo && typeof d.demo === "object" && d.demo.p > 0, `${tag} ${d.n}: census people lane`);
      assert.ok(d.seifa && Number.isFinite(d.seifa.irsad.v), `${tag} ${d.n}: SEIFA lane`);
    }
    assert.deepEqual(tally, want.seats, `${tag}: the official seat tally`);
    assert.deepEqual(res.agg.VIC.seats, tally, `${tag}: agg seats mirror the derived tally`);
    assert.equal(res.agg.VIC.formal, want.formal, `${tag}: Assembly formal vote`);
    assert.equal(h, want.h || 0, `${tag}: ${want.h || 0} history rows`);
    assert.equal(c5, want.c5, `${tag}: candidate count`);
    assert.equal(c5nz, want.c5nz || 0, `${tag}: joined swings`);
    assert.equal(tpp2, want.tpp2 || 0, `${tag}: classic-pair swings`);
    if (want.pformal) assert.equal(res.agg.VIC.pformal, want.pformal, `${tag}: previous Assembly formal`);
    assert.equal(res.booths.n.length, want.booths, `${tag}: ${want.booths} venue rows`);
    assert.equal(res.booths.lat.filter((x) => x !== null).length, want.geocoded, `${tag}: ${want.geocoded} geocoded venues`);
  }
}

// ── the 2013-era Legislative Councils (2026-11-04): staggered 21-up NSW
// cohorts for nsw15/nsw19 (2011's and 2015's elected waves with their mid-
// term fills; the wave runs on .build/state-flow-src/nsw/<year>/lc-*.html.gz
// plus the nswec-lc-flow-src count bank's 2011 r02/r09 printed reports), and
// the full-election Victorian councils for vic14/vic18 from the committed
// VEC region pages — off build_nsw_lc.py / build_vic_lc.py
{
  const LC_ACTS = {
    nsw15: { date: "2015-03-28", later: 2023, seatsN: 42, fam: { ALP: 12, LIB: 12, NAT: 7, GRN: 5, IND: 1 }, formal: 4316498, pformal: 4076024, jur: "nsw" },
    nsw19: { date: "2019-03-23", later: 2027, seatsN: 42, fam: { ALP: 14, LIB: 11, NAT: 6, GRN: 4, ONP: 2, SFF: 2, AJP: 2, CDP: 1 }, formal: 4451146, pformal: 4316498, jur: "nsw" },
    vic14: { date: "2014-11-29", later: 2018, seatsN: 40, fam: { ALP: 14, LIB: 14 }, formal: 3418671, pformal: 3216386, jur: "vic" },
    vic18: { date: "2018-11-24", later: 2022, seatsN: 40, fam: { ALP: 18, LIB: 10 }, formal: 3583478, pformal: 3418671, jur: "vic" },
  };
  for (const [tag, want] of Object.entries(LC_ACTS)) {
    const p = JSON.parse(R(`map/data/senate-${tag}.json`));
    assert.equal(p.year, tag, `${tag} LC: year id`);
    assert.equal(p.lc, true, `${tag}: the file is a Legislative Council one`);
    assert.equal(p.date, want.date, `${tag}: polling day`);
    assert.equal(p.asOf, p.date, `${tag}: constituted after the election day`);
    assert.equal(p.seatsN, want.seatsN, `${tag}: council size`);
    assert.equal(p.later, want.later, `${tag}: its next election year`);
    assert.equal(p.dd, false, `${tag}: no double dissolution`);
    assert.equal(p.senators.length, want.seatsN, `${tag}: every seat filled`);
    for (const [k, v] of Object.entries(want.fam))
      assert.equal(p.senators.filter((s) => s.ab === k).length, v, `${tag}: ${k} elects ${v}`);
    assert.equal(Object.values(p.votes).reduce((a, b) => a + b, 0), p.formal, `${tag}: party votes account for the formal LC ballot`);
    assert.equal(p.formal, want.formal, `${tag}: LC formal vote`);
    assert.equal(p.pformal, want.pformal, `${tag}: previous LC formal vote`);
    assert.ok(/NSWEC|Victorian Electoral Commission/.test(p.source), `${tag}: provenance named`);
  }
}

// ── New South Wales' Legislative Council preference data (senate-prefs-nswXX.json,
// 2026-11-04): the NSWEC's per-ballot ZipLC Pref Data Statewide files, computed
// by .build/map/build_nsw_lc_prefs.py on the nswec-lc-flow-src/analyse_nsw_lc.py
// family mapping into the federal senate-prefs schema — three federal pairs
// (AC/AO/CO), the LC cohort vocabularies; nsw15 declares PHON absent (the 2015
// ballot had no One Nation LC ticket) exactly as the federal ACT carries on
// its ATL wave
{
  const EVENT = { nsw15: "2015", nsw19: "2019", nsw23: "2023" };
  const bank = JSON.parse(fs.readFileSync(path.join(ROOT, ".build", "nswec-lc-flow-src", "counts.json")));
  for (const [tag, ev] of Object.entries(EVENT)) {
    const p = JSON.parse(R(`map/data/senate-prefs-${tag}.json`));
    assert.equal(p.year, tag, `${tag} LC prefs: its frame's year id`);
    assert.equal(p.lc, true, `${tag}: a Legislative Council preference record`);
    assert.deepEqual(p.pairs, ["AC", "AO", "CO"], `${tag}: the three federal pair slots`);
    assert.deepEqual(p.donors, { AC: ["grn", "onp", "oth"], AO: ["lnp", "grn", "oth"], CO: ["alp", "grn", "oth"] }, `${tag}: the cohort vocabulary`);
    assert.equal(Object.keys(p.divs).length, 93, `${tag}: every NSW district`);
    assert.ok(Object.keys(p.booths).length > 1000, `${tag}: a real polling-place record`);
    const bank_ev = bank.events[ev];
    assert.ok(bank_ev, `${tag}: the count bank keeps its ${ev} event`);
    // the join's matched-plus-stray set is exactly the event's above-the-line tally
    const vj = p.venueJoin;
    assert.equal(vj.matched + vj.missed, bank_ev.atl, `${tag}: venue-matched plus unjoinable is the NSWEC's ATL total`);
    assert.ok(vj.matched > 0.75 * bank_ev.atl, `${tag}: most of the ATL ballots join to a polling place in its own district`);
    const ballotsByCell = Object.values(p.divs).reduce((t, a) => { for (let i = 0; i < 27; i += 3) { t[0] += a[i]; t[1] += a[i + 1]; t[2] += a[i + 2]; } return t; }, [0, 0, 0]);
    assert.ok(ballotsByCell[0] + ballotsByCell[1] + ballotsByCell[2] > 0 && ballotsByCell[2] >= 0, `${tag}: flat cells are crowd totals`);
    if (tag === "nsw15") assert.deepEqual(p.absent, { NSW: ["onp"] }, `${tag} LC prefs: One Nation is absent from its 2015 ballot, as the count bank carries PHON 0`);
    if (tag !== "nsw15") assert.deepEqual(p.absent, {}, `${tag}: no absent cohorts (${ev} contested LC on One Nation's ticket)`);
    assert.ok(/NSWEC LC Pref Data Statewide\.zip/.test(p.source), `${tag}: provenance named`);
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

// NSW Council: photo-based furniture and separate political seating areas. The Assembly
// keeps its own horseshoe geometry. NSW positions are schematic, not assigned seats.
{
  const src = R(".build/map/app/app-3c-sa.js");
  const { SAF, saCells } = new Function(`${src.match(/@sa-cells-begin[\s\S]*?\*\/([\s\S]*?)\/\* @sa-cells-end \*\//)[1]}; return { SAF, saCells };`)();
  assert.ok(!("nswLA" in SAF), "the old straight-block nswLA floor is retired (the Assembly rides NSWB)")
  const nswLC = saCells(SAF.nswLC);
  assert.equal(nswLC.length, 48, "the NSW Council's floor: 48 schematic positions, including six at the table, for 42 members");
  assert.equal(new Set(nswLC.map((c) => c.id)).size, nswLC.length, "nswLC: desk ids unique");
  {
    const F = SAF.nswLC, L = F.ltable, seat = F.seat;
    const halfW = seat.W / 2 + 4, halfD = seat.D / 2 + 4;
    const [inL, inR, outL, outR] = F.straight;
    assert.ok((F.room[3] - F.room[1]) / (F.room[2] - F.room[0]) > 1.4, "nswLC: the room is longer than it is wide");
    assert.ok(L.y1 - L.y0 > (F.room[3] - F.room[1]) / 2, "nswLC: the table occupies most of the debating floor's length");
    assert.ok(L.hx > L.x && L.hd > seat.W, "nswLC: a broad, deep clerks' head above the narrower stem");
    assert.ok(F.plat.regal < F.chair && F.chair < F.presidentDesk.y0 && F.presidentDesk.y1 < F.officers[0], "nswLC: vice-regal chair, President, desk and clerks appear in that order");
    assert.ok(F.officers[0] + 14 < L.y0 && F.officers[0] - 14 > F.plat.y1, "nswLC: clerks clear the dais and sit directly at the table head");
    assert.ok(L.y1 < F.usher - 14 && F.usher + 14 < F.singles[0].y - halfD, "nswLC: Usher sits beyond the rounded table end, clear of the crossbenches");
    assert.ok(L.rod > L.y1 - L.x && L.rod < L.y1 - 6, "nswLC: Black Rod is inside the rounded end of the table");
    for (const row of [inL, inR]) {
      assert.equal(row.breakAfter.length, 1, "nswLC: each inner bench has one cross-aisle");
      const j = row.breakAfter[0];
      assert.ok(row.ys[j + 1] - row.ys[j] > 2 * halfW + seat.W, "nswLC: detached inner crossbench has a usable aisle");
      assert.ok(row.x - halfD > L.cx + seat.D / 2 + 20, "nswLC: member table chairs clear the inner benches");
    }
    assert.ok(inL.ys.at(-1) < inR.ys.at(-1) && outL.ys.at(-1) < outR.ys.at(-1), "nswLC: the government-side benches stop earlier");
    assert.equal(new Set(F.singles.map((q) => q.bench)).size, 3, "nswLC: one long rear bench and two short benches beside the gate");
    for (const q of F.singles) {
      assert.ok(q.y - halfD > L.y1 && q.y + halfD <= F.transverse.y0, "nswLC: rear crossbenches sit beyond the table, in front of the gallery barrier");
      assert.ok(q.x - halfW >= F.transverse.gap, "nswLC: rear crossbenches leave a central entrance");
    }
    const boxes = nswLC.map((c) => {
      const transverse = c.fa === -Math.PI / 2, dx = transverse ? halfW : halfD, dy = transverse ? halfD : halfW;
      return { id: c.id, x0: c.x - dx, x1: c.x + dx, y0: c.y - dy, y1: c.y + dy };
    });
    for (const [j, a] of boxes.entries()) {
      assert.ok(a.x0 >= F.room[0] && a.x1 <= F.room[2] && a.y0 >= F.room[1] && a.y1 <= F.room[3], `${a.id}: whole chair and bench margin lie on the floor`);
      for (const b of boxes.slice(j + 1)) assert.ok(a.x1 <= b.x0 || b.x1 <= a.x0 || a.y1 <= b.y0 || b.y1 <= a.y0, `${a.id}/${b.id}: member positions do not overlap`);
    }
    // Exercise the real geometry and allocator with the actual 2023 member dataset. The
    // old continuous fill seated a government member on the rear crossbench and counted
    // six table chairs as neutral staff; both party and term sorting must retain the areas.
    const { saGeom } = new Function("CHK", "clamp", `${src}; return { saGeom };`)(6, (x, lo, hi) => Math.max(lo, Math.min(hi, x)));
    const geom = saGeom("nswLC"), chamber = part("app-3-chamber.js"), senate = part("app-3b-senate.js");
    const blocSource = chamber.slice(chamber.indexOf("function chamberBlocs("), chamber.indexOf("// the lens's ordering key"));
    const orderSource = chamber.slice(chamber.indexOf("function chamberOrder("), chamber.indexOf("/* the majority line:"));
    const keySource = senate.slice(senate.indexOf("const SEN_PARTY_ORDER"), senate.indexOf("const senLensOf"));
    const S = { senLens: "party" };
    const order = new Function("geom", "S", `const chamberGeom = () => geom, seatMode = () => "sort", holdFam = h => h.fam, LEADERS = {}, STATES = ["NSW"], upNext = d => d.up; ${keySource} ${blocSource} ${orderSource}; return chamberOrder;`)(geom, S);
    const raw = JSON.parse(R("map/data/senate-nsw23.json"));
    const fam = { ALP: "alp", LIB: "lnp", NAT: "lnp", GRN: "grn", ONP: "onp" };
    const divs = raw.senators.map((d, i) => ({ ...d, i, up: d.term !== raw.later, hold: { ab: d.ab, fam: fam[d.ab] || "oth" } }));
    const m = { year: "nsw23", house: "senate", gov: "alp", divs, leaders: [], speaker: null, seatsN: 42, byName: new Map(divs.map((d) => [d.n, d.i])) };
    for (const lens of ["party", "term"]) {
      S.senLens = lens;
      const ch = order(m);
      assert.equal(ch.at.size, 42, `${lens}: all 42 members seated`);
      assert.equal(new Set(ch.at.values()).size, 42, `${lens}: every member has a distinct position`);
      assert.deepEqual([ch.nGov, ch.nOpp, ch.nCross], [15, 15, 12], `${lens}: the election's bloc totals are preserved`);
      for (const d of divs) {
        const k = ch.at.get(d.i), bloc = d.hold.fam === "alp" ? "gov" : d.hold.fam === "lnp" ? "opp" : "cross";
        assert.ok(geom.blocSeats[bloc].includes(k), `${lens}: ${d.n} sits in the ${bloc} area`);
        assert.ok(!geom.vacant.has(k), `${lens}: ${d.n} is not allocated a spare position`);
      }
      const tableSeats = [...ch.at.values()].filter((k) => geom.seats[k].row === 0);
      assert.equal(tableSeats.length, 6, `${lens}: all six table chairs are members, not extra neutral chairs`);
      assert.equal(geom.seats.length - ch.at.size, 6, `${lens}: only the six spare positions remain empty`);
    }
  }
  assert.ok(!part("app-3c-sa.js").includes('put("The table"'), "no furniture labels on the Council's floor (the nameplate is gone)");
  assert.ok(part("app-3-chamber.js").includes('geom.key !== "nswLC" ? majorityCuts'), "nswLC draws no dashed majority thread");
  assert.ok(part("app-3-chamber.js").includes('geom.key === "nswLC" && opts.labels !== false'), "nswLC: the majority figure stands alone under the floor");
  const { nswCells } = new Function(`${part("app-3-chamber.js").match(/@nsw-cells-begin[\s\S]*?\*\/([\s\S]*?)\/\* @nsw-cells-end \*\//)[1]}; return { nswCells };`)();
  const nswLA = nswCells();
  assert.equal(nswLA.length, 93, "the NSW Assembly's floor: 92 desks and the Serjeant's chair");
  assert.equal(nswLA.filter((c) => c.id !== "Rsj0").length, 92, "the NSW Assembly: exactly one desk per member on the floor");
  assert.equal(nswLA.filter((c) => c.x < 0).length, 46, "each side seats 12 along the table and 22 on the curved rows");
  assert.equal(new Set(nswLA.map((c) => c.id)).size, nswLA.length, "nswLA: desk ids unique");
  assert.equal(nswLA.filter((c) => c.x < 0).length, nswLA.filter((c) => c.x > 0).length, "nswLA: the sides mirror each other");
  assert.ok(js.includes('const saFloorOf = (m) => (NSW_YEARS.has(m.year) ? "nswLC" : m.house === "senate" ? "lc" : "ha");'), "saFloorOf routes the SA frames and NSW's Councils (never its Assembly) — the whole NSW family since 2026-11");
  assert.ok(js.includes('m && NSW_YEARS.has(m.year) && m.house !== "senate" ? nswGeom()'), "chamberGeom routes every NSW Assembly (nsw15/nsw19/nsw23) to its Macquarie Street floor");
  assert.ok(js.includes('const chamberGeom = (m) => (m && VIC_YEARS.has(m.year) ? (m.house === "senate" ? vicLCGeom() : vicGeom()) :'), "chamberGeom routes every Victorian frame's two chambers: the Legislative Council on its own floor, the Assembly on the federal-style floor");
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
  const DMK = ["lang", "a65", "a2034", "fborn", "uni", "blue", "y12less", "atsci", "u15", "onepar", "pt", "noncit", "bigfam", "hl"], IXS = ["irsad", "irsd", "ier", "ieo"];
  for (const d of res.divs) {
    assert.ok(d.demo && DMK.every((k) => typeof d.demo[k] === "number") && typeof d.demo.p === "number" && typeof d.demo.n === "number", `vic22 ${d.n}: demo row`);
    assert.deepEqual(Object.keys(d.demo).sort(), [...DMK, "anc", "cob", "rel", "ten", "n", "p", "loinc", "hiinc", "hiqinc", "medIncWeekly"].sort(), `vic22 ${d.n}: GCP-era lanes ride the ten keys plus income plus the birthplace and ancestry dicts`);
    assert.deepEqual(Object.keys(d.demo.anc).sort(), [...ANC_GCP].sort(), `vic22 ${d.n}: the twelve Ancestry options`);
    assert.deepEqual(Object.keys(d.demo.cob).sort(), [...GCP_COB_KEYS].sort(), `vic22 ${d.n}: the ten-country cob`);
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
      if (dm !== null) assert.ok(Array.isArray(dm) && dm.length === 17 && dm.every((x) => x === null || (typeof x === "number" && x >= 0 && x <= 1)), `vic22 ${B.n[k]}: demo is ten people cells plus the six of the 2026-10-31 arcs plus pt/noncit (income slots populated)`);
      const an = B.anc[k];
      if (an !== null) assert.ok(Array.isArray(an) && an.length === 12, `vic22 ${B.n[k]}: anc rides its twelve ancestry shares`);
    }
    const toorak = B.n.indexOf("Toorak Central");
    assert.ok(toorak >= 0, "vic22: the Toorak Central booth exists");
    assert.deepEqual(B.dec[toorak], [9, 8, 5, 9], "vic22: Toorak Central's SA1 national deciles");
    assert.deepEqual(B.demo[toorak], [0.1329, 0.2133, 0.2733, 0.2612, 0.565, 0.0774, 0.1549, 0.429, 0.451, 0.1627, 0.0, 0.1233, 0.1111, 0.0617, 0.1462, 0.163, 0.0002], "vic22: Toorak Central's SA1 people cells, the six lanes of the 2026-10-31 arcs");
    assert.deepEqual(B.anc[toorak], [0.453, 0.2091, 0.1498, 0.1324, 0.0627, 0.0836, 0.0279, 0, 0, 0.0209, 0, 0], "vic22: Toorak Central's Ancestry row");
    assert.deepEqual(B.rel[toorak], [0.4064, 0.3039, 0.1378, 0.0212, 0.0318, 0.0353, 0, 0, 0, 0.0318], "vic22: Toorak Central's Religion row (No-religion leads)");
    assert.deepEqual(B.ten[toorak], [0.2578, 0.3672, 0.375, 0], "vic22: Toorak Central's Housing-tenure row");
    assert.deepEqual(B.cob[toorak], [0.0481, 0.0137, 0.0103, 0.0137, 0.0, 0.0, 0.0275, 0.0206, 0.0, 0.0], "vic22: Toorak Central's birthplace cells");
    assert.deepEqual(B.dec[B.n.indexOf("Burwood West")], [10, 10, 10, 10], "vic22: Burwood West, the top of the range");
    assert.deepEqual(B.dec[B.n.indexOf("Wodonga Birallee")], [1, 1, 1, 1], "vic22: Wodonga Birallee, the bottom of the range");
    assert.deepEqual(B.dec[B.n.indexOf("Comet Hill")], [1, 1, 1, 1], "vic22: Comet Hill (Bendigo), also the bottom of the range");
    const spread = new Set(B.dec.filter(Boolean).map((d) => d[0]).filter((x) => x !== null));
    assert.ok(spread.size >= 8, "vic22 booth IRSAD deciles spread across the range (a monotone join bug collapses them)");
  }
  // the birthplace sub-view's data on the Victorian frame
  // (build_vic22_boothcensus.py): the ten-country cob rows in site
  // order, every fixed venue's read of the SA1 it stands in
  {
    assert.deepEqual(res.cobKeys, GCP_COB_KEYS, "vic22: the ten curated countries in site order");
    assert.equal(B.cob.length, B.n.length, "vic22: a cob row per venue slot");
    assert.equal(B.cob.filter(Boolean).length, 1755, "vic22: cob rows parallel to the people cells");
    assert.equal(B.cob.filter((x, k) => (x === null) !== (B.demo[k] === null)).length, 0, "vic22: cob rows null exactly where the census block is");
    for (let k = 0; k < B.n.length; k++) {
      const r = B.cob[k];
      if (r !== null) assert.ok(Array.isArray(r) && r.length === GCP_COB_KEYS.length && r.every((x) => x === null || (typeof x === "number" && x >= 0 && x <= 1)), `vic22 ${B.n[k]}: cob is ten 0-1 country shares`);
    }
  }
}

// Victoria's Council joins the upper-house lane on its own floor (the vic22 LC
// pin above reads the @viclc-cells floor): senate-vic22.json is a frame lane,
// the house-switch offers it and the SEATED_LC plans load with the Senate lane
{
  const sen = part("app-3b-senate.js"), base = part("app-1-base.js");
  assert.ok(!sen.includes("!VIC_YEARS.has(y)"), "vic22 is in the upper-house lane (its Legislative Council is built out)");
  assert.ok(sen.includes("&& !QLD_YEARS.has(y)"), "the qld frames are out of the upper-house lane: Queensland's parliament is unicameral (its Legislative Council was abolished in 1922), so the house switch never offers one there");
  assert.ok(base.includes('const SEATED_LC = new Set(["sa26", "vic22"]);'), "SEATED_LC names the councils with seating plans (South Australia's and Victoria's)");
  assert.ok(sen.includes('const CM = () => (S.view === "chamber" && S.house === "senate" ? (SENM && (senFloor || VIC_YEARS.has(SENM.year)) ? SENM : null) : M());'), "the chamber model never waits on the federal floor for a Victorian frame's baked-in floor");
  assert.ok(sen.includes('if (!SEN_YEARS.includes(S.year)) return "";'), "the house switch hides on an upper-house-less frame");
  assert.ok(js.includes('vic22: "Maree Edwards"'), "vic22's Speaker (Maree Edwards, MLA for Bendigo West) in the chair");
  assert.ok(js.includes('vic22: "Bendigo West"'), "vic22's Speaker division is Bendigo West");
}

// ── the qld frames: Queensland's 25 November 2017, 31 October 2020 and
// 26 October 2024 state elections — three frames on ONE boundary set (the 2017
// determination's 93 Legislative Assembly districts, used at all three), the
// all-Qld row riding under the SA frame. Sources by era (.build/map/qld_ecq.py
// — roles the ECSA machinery taught the SA builders): 2020/2024 the ECQ's Vote
// Result System media feed (.build/state-flow-src/qld/<YYYY>/ — venues with
// lat/lon, official first-preference rows incl. the pseudo votes, preference
// rounds incl. PER-BOOTH TCP at the district's final pair), 2017 the Ektron
// results site (district summaries + FPV-by-booth + distribution summaries +
// the day-booth and pre-poll venue rolls ((.build/map/src/qld17/), era coords
// joined onto the VRS venue roll by (name, locality): 1,113 of 1,701 placed,
// 588 carry venue facts but draw no dot — honest nulls, never geocoded means).
// build_qld_common.py emits the federal res schema; booth lanes are REAL
// venues only (pseudo votes fold into districts); census lanes ride the 2021
// census (qld24/qld20) and the 2016 census (qld17 carries demoYear 2016);
// flows are the two-pile estimator's on committed Qld sources; past joins
// read the prior frame same-boundary (qld17 names none by definition)
{
  const bucketTotal = (x) => (x && Object.values(x) || []).reduce((a, b) => a + b, 0);
  const FR = {
    qld24: { date: "2024-10-26", prev: 2020, seats: { ALP: 36, LNP: 52, KAP: 3, GRN: 1, IND: 1 }, formal: 3105945, enr: 3683368,
             booths: 1668, ty: [1, 4, 5], mobile: 93, geo: 1575, tcp: 1668, dec: 1529, demo: 1575,
             fl: 85, tppsw: 84, swings: 525, hist: 93, demoYear: null },
    qld20: { date: "2020-10-31", prev: 2017, seats: { ALP: 52, LNP: 34, KAP: 3, GRN: 2, ONP: 1, IND: 1 }, formal: 2868324, enr: 3377476,
             booths: 1810, ty: [1, 4, 5], mobile: 93, geo: 1717, tcp: 1810, dec: 1668, demo: 1717,
             fl: 87, tppsw: 64, swings: 597, hist: 93, demoYear: null },
    qld17: { date: "2017-11-25", prev: null, seats: { ALP: 48, LNP: 39, KAP: 3, GRN: 1, ONP: 1, IND: 1 }, formal: 2703941, enr: 3229536,
             booths: 1701, ty: [1, 4, 5], mobile: 3, geo: 1110, tcp: 0, dec: 1092, demo: 1110,
             fl: 78, tppsw: 0, swings: 0, hist: 0, demoYear: 2016 },
  };
  for (const [frame, ora] of Object.entries(FR)) {
    const res = JSON.parse(R(`map/data/res-${frame}.json`));
    assert.equal(res.year, frame, `${frame}: year id`);
    assert.equal(res.date, ora.date, `${frame}: polling day`);
    assert.equal(res.prev, ora.prev, `${frame}: prev ${ora.prev ?? "names nothing (2015 rode the 89-district map)"}`);
    assert.equal(res.demoBasis, "sa1", `${frame} records the SA1 census basis`);
    assert.equal(ora.demoYear ?? null, res.demoYear ?? null, `${frame}: the census edition it quotes${ora.demoYear ? " (qld17 reads the 2016 census)" : ""}`);
    assert.equal(res.jurisdiction, "QLD", `${frame}: jurisdiction`);
    assert.deepEqual(Object.keys(res.agg), ["AUS", "QLD"], `${frame} carries only the QLD frame's areas`);
    assert.equal(res.divs.length, 93, `${frame}: 93 Legislative Assembly districts`);
    for (const f of [`geo-${frame}-lo.json`, `geo-${frame}-hi.json`]) assert.ok(fs.existsSync(path.join(ROOT, "map", "data", f)), "map/data/" + f);
    assert.deepEqual(res.agg.QLD.seats, ora.seats, `${frame}: the ECQ's declared seat count`);
    assert.deepEqual(res.agg.AUS.seats, ora.seats, `${frame}: the AUS mirror carries the same seats`);
    assert.equal(res.agg.QLD.formal, ora.formal, `${frame}: formal vote`);
    assert.equal(res.agg.QLD.inf > 0 && res.agg.QLD.inf < res.agg.QLD.formal, true, `${frame}: the agg's informal tally is sane`);
    assert.equal(bucketTotal(res.agg.QLD.prim), ora.formal, `${frame}: party primary sums account for every formal vote`);
    assert.equal(bucketTotal(res.divs.map((d) => d.enrolled)), ora.enr, `${frame}: enrolment sums to the ECQ's close of roll`);
    if (ora.prev == null) {
      assert.ok(!("pformal" in res.agg.QLD), "qld17: no previous-election primitives (the frame names no past)");
      assert.ok(res.divs.every((d) => d.h.length === 0), "qld17: no history rows anywhere");
      assert.ok(res.divs.every((d) => d.c.every((c) => c[5] === 0)), "qld17: every candidate's swing null-by-zero");
    } else {
      assert.equal(res.agg.QLD.pformal, ora.fpformal ?? FR[ora.prev === 2020 ? "qld20" : "qld17"].formal, `${frame}: previous election's formal vote`);
      assert.equal(bucketTotal(res.agg.QLD.pprim), res.agg.QLD.pformal, `${frame}: previous party primary sums account for the previous formal vote`);
      assert.equal(bucketTotal(res.divs.map((d) => d.h.length)), ora.hist, `${frame}: one history row per district ([prev-year, TCP%, party, member])`);
      for (const d of res.divs) {
        assert.ok(d.h.length === 1 && d.h[0][0] === ora.prev && typeof d.h[0][1] === "number" && typeof d.h[0][3] === "string", `${frame} ${d.n}: its ${ora.prev} history row`);
      }
      let nSw = 0;
      for (const d of res.divs) for (const c of d.c) { assert.ok(Number.isFinite(c[5]), `${frame} ${d.n}: c[5] finite for ${c[0]}`); if (c[5] !== 0) nSw++; }
      assert.equal(nSw, ora.swings, `${frame}: ${ora.swings} candidates moved on the previous election`);
      assert.equal(res.divs.filter((d) => d.tpp && Number.isFinite(d.tpp[2])).length, ora.tppsw, `${frame}: ${ora.tppsw} classic-pair 2PP swings where both elections finished Labor v LNP`);
    }
    assert.equal(res.divs.filter((d) => d.fl.length > 0).length, ora.fl, `${frame}: flow rows on the ${ora.fl} districts whose final had Labor against LNP or One Nation`);
    const B = res.booths;
    const LANES = ["d", "id", "n", "ty", "prem", "sub", "pc", "lat", "lon", "v", "inf", "tpp", "tcp", "fl", "dec", "vdec"];
    for (const k of LANES) assert.ok(Array.isArray(B[k]) && B[k].length === ora.booths, `${frame} booths.${k}: ${ora.booths} rows`);
    assert.equal(new Set(B.id).size, ora.booths, `${frame} booth ids are unique`);
    assert.deepEqual([...new Set(B.ty)].sort((a, b) => a - b), ora.ty, `${frame}: venue-type vocabulary ${ora.ty}`);
    assert.equal(B.ty.filter((t) => t === 4).length, ora.mobile, `${frame}: ${ora.mobile} mobile polling teams`);
    let geo = 0, tcp = 0, dec = 0, demo = 0, cob = 0;
    for (let k = 0; k < B.n.length; k++) {
      if (B.ty[k] === 4) {
        assert.ok(B.lat[k] === null && B.lon[k] === null && B.prem[k] === null && B.sub[k] === null && B.pc[k] === null, `${frame} mobile ${B.n[k]}: no venue facts (a mobile team has no fixed venue)`);
      } else {
        if (B.lat[k] != null) {
          geo++;
          assert.ok(B.lat[k] > -44 && B.lat[k] < -9 && B.lon[k] > 112 && B.lon[k] < 154, `${frame} ${B.n[k]}: venue inside Australia`);
        }
        assert.ok(typeof B.prem[k] === "string" && B.prem[k].length > 0, `${frame} ${B.n[k]}: every real venue names a premise`);
        if (frame === "qld17") {
          // the 2017 roll carries premise+streets for the gazetted booths (and
          // for the regional pre-poll centres); two isolated-town venues name
          // a premise and no locality (the town's own name is the place) —
          // postcode rides the era's coordinate join only
          const NAMED_NO_LOCALITY = new Set(["Bedourie", "Inglestone"]);
          assert.ok(typeof B.sub[k] === "string" || NAMED_NO_LOCALITY.has(B.n[k]), `${frame} ${B.n[k]}: locality on the era's venue roll (Bedourie and Inglestone, premise-only by the roll's own record, are the whole exception)`);
        } else {
          assert.ok(typeof B.sub[k] === "string" && B.sub[k].length > 0 && typeof B.pc[k] === "string" && B.pc[k].length > 0, `${frame} ${B.n[k]}: the media feed's venue roll carries premise, locality and postcode`);
        }
      }
      if (B.tcp[k] != null) {
        tcp++;
        const f0 = B.tcp[k];
        assert.ok(Array.isArray(f0) && f0.length === 2 && f0.every((x) => Number.isInteger(x) && x >= 0), `${frame} ${B.n[k]}: booth TCP pair at the district's final pair (a booth's own winner can flip it)`);
      }
      if (B.dec[k] != null) dec++;
      if (B.demo[k] != null) demo++;
      if (B.cob[k] != null) cob++;
    }
    assert.equal(geo, ora.geo, `${frame}: ${ora.geo} venues geocoded`);
    assert.equal(tcp, ora.tcp, `${frame}: ${ora.tcp} booths carry the official two-candidate count${frame === "qld17" ? " (none — the era printed the distribution at district level only)" : ""}`);
    assert.equal(dec, ora.dec, `${frame}: ${ora.dec} booths carry national SEIFA deciles`);
    assert.equal(demo, ora.demo, `${frame}: ${ora.demo} booths carry their SA1's people cells`);
    assert.equal(cob, ora.demo, `${frame}: cob rows parallel the people cells`);
    assert.ok(B.tpp.every((x) => x === null), `${frame} booths carry no tpp lane`);
    assert.ok(B.fl.every((x) => x === null), `${frame} booths carry no per-booth flow lane`);
    assert.ok(B.vdec.every((x) => x === null), `${frame}: no voter-footprint deciles (the ECQ publishes no votes-by-SA1 product)`);
    assert.deepEqual(res.cobKeys, GCP_COB_KEYS, `${frame}: the ten curated birthplace countries in site order`);
    {
      const bad = B.cob.filter((x, k) => (x === null) !== (B.demo[k] === null));
      assert.equal(bad.length, 0, `${frame}: cob rows null exactly where the people cells are`);
    }
    const DMK = ["lang", "a65", "a2034", "fborn", "uni", "blue", "y12less", "atsci", "u15", "onepar"], IXS = ["irsad", "irsd", "ier", "ieo"];
    const dc = new Set(res.divs.map((d) => d.seifa.irsad.dec));
    assert.ok(dc.size >= 7, `${frame} IRSAD deciles spread across the range (a monotone join bug collapses them)`);
    for (const d of res.divs) {
      assert.ok(d.demo && DMK.every((k2) => typeof d.demo[k2] === "number") && typeof d.demo.p === "number", `${frame} ${d.n}: demo row`);
      assert.ok(d.demo.cob && Object.keys(d.demo.cob).length === GCP_COB_KEYS.length, `${frame} ${d.n}: ten-country cob`);
      for (const ix of IXS) assert.ok(d.seifa && typeof d.seifa[ix].v === "number" && Number.isInteger(d.seifa[ix].dec), `${frame} ${d.n}: ${ix} cell`);
    }
  }
}

// ── the qld chamber floor: Queensland's Legislative Assembly on the shared arc
// idiom (the @qld-cells QLDB ledger in app-3-chamber.js — 92 desks for the
// chamber's 92 elected seats beside the furniture chair, the Macquarie
// Street-style arc fork: two straight files of twelve continuing the two inner
// curve radii, the far end in three rows of 6/9/6 a side, the Serjeant's chair
// centred; the arc fork surrounds the rectangle table with Queensland's mace on
// it; the official plan was not captured at landing and carries no claim of
// plan truth — the @qld-cells note says as much and every shape pin stands on
// the mechanics, never the room)
{
  const { qldCells, QLD_SERJEANT } = new Function(`${part("app-3-chamber.js").match(/@qld-cells-begin[\s\S]*?\*\/([\s\S]*?)\/\* @qld-cells-end \*\//)[1]}; return { qldCells, QLD_SERJEANT };`)();
  const cells = qldCells();
  assert.equal(cells.filter((c) => c.id !== QLD_SERJEANT).length, 92, "a qld floor files 92 member desks (Queensland's 93 seats sit the Speaker's chair)");
  assert.equal(cells.filter((c) => c.id === QLD_SERJEANT).length, 1, "the Serjeant's chair is one cell");
  const sides = new Set(cells.filter((c) => c.id !== QLD_SERJEANT).map((c) => c.id[0]));
  assert.deepEqual([...sides].sort(), ["L", "R"], "two mirrored sides");
  for (const s of ["L", "R"]) {
    assert.equal(cells.filter((c) => c.id === `${s}t0`).length, 1, `qld ${s}: one leader desk heads the inner file`);
  }
  assert.ok(js.includes("m && QLD_YEARS.has(m.year) ? qldGeom()"), "chamberGeom routes the Queensland frames to their own floor (never the House, never Adelaide's)");
  assert.ok(js.includes('qld17: "Curtis Pitt"') && js.includes('qld24: "Pat Weir"'), "Queensland's Speakers in the chair (Curtis Pitt to 2023, Pat Weir of the 58th Parliament)");
  assert.ok(js.includes('qld17: "Mulgrave"') && js.includes('qld24: "Condamine"'), "Queensland's Speaker divisions (Mulgrave, Condamine)");
  assert.ok(js.includes('qld24: ["Broadwater", "Murrumba"]'), "the 2024 leadership desks: Broadwater (Crisafulli) against Murrumba (Miles)");
  assert.ok(js.includes('qld17: ["Inala", "Clayfield"]'), "the 2017 leadership desks: Inala (Palaszczuk) against Clayfield (Nicholls)");
}

// the state frames on the timeline and in the constants: the per-jurisdiction
// rows (federal top, then Victoria, New South Wales, South Australia — Vic
// rides above NSW since the 2026-10-28 user call, Queensland appended below at
// the 2026-10-29 user call, Western Australia appended below at 2026-11-05,
// six rungs now) and the
// YEAR_JUR contract — the frame-year→jurisdiction map is YEAR_JUR; only the
// federal abbreviation→name map keeps STATE_NAME (a second top-level
// `const STATE_NAME` beside it killed the assembled bundle at parse —
// SyntaxError — and the page never booted, 2026-10-27)
{
  const base = part("app-1-base.js"), ui = part("app-6-ui.js"), css = part("page.css");
  assert.ok(base.includes('const NSW_YEARS = new Set(["nsw15", "nsw19", "nsw23", "nswnow"]);') && base.includes('const VIC_YEARS = new Set(["vic14", "vic18", "vic22"]);') && base.includes('const QLD_YEARS = new Set(["qld17", "qld20", "qld24", "qldnow"]);') && base.includes('const WA_YEARS = new Set(["wa17", "wa21", "wa25", "wanow"]);'), "NSW/VIC/QLD/WA year sets name the state frames (the wa family joined 2026-11-05)");
  assert.ok(base.includes('const YEAR_JUR = { sa22: "sa", sa26: "sa", nsw15: "nsw", nsw19: "nsw", nsw23: "nsw", nswnow: "nsw", vic14: "vic", vic18: "vic", vic22: "vic", qld17: "qld", qld20: "qld", qld24: "qld", qldnow: "qld", wa17: "wa", wa21: "wa", wa25: "wa", wanow: "wa" };'), "YEAR_JUR maps a frame year to its jurisdiction");
  assert.ok(base.includes('const STATE_YEARS = new Set(Object.keys(YEAR_JUR));'), "STATE_YEARS derives from YEAR_JUR");
  assert.ok(base.includes("const PREV_YEAR = { sa22: 2018, sa26: 2022, nsw15: 2011, nsw19: 2015, nsw23: 2019, nswnow: 2019, vic14: 2010, vic18: 2014, vic22: 2018, qld24: 2020, qldnow: 2020, qld20: 2017, qld17: null, wa17: 2013, wa21: 2017, wa25: 2021, wanow: 2021 };"), "the state frames' past joins (qld17 names none — the 2015 election rode the 89-district map; the wa stops prev-chain 2013→2017→2021→2025)");
  assert.ok(base.includes('const FRAME_YEAR = { now: 2026, nswnow: 2026, qldnow: 2026, sa22: 2022, sa26: 2026, nsw15: 2015, nsw19: 2019, nsw23: 2023, vic14: 2014, vic18: 2018, vic22: 2022, qld17: 2017, qld20: 2020, qld24: 2024, wa17: 2017, wa21: 2021, wa25: 2025, wanow: 2026 };'), "the frames' calendar years (qld24's is 2024)");
  assert.ok(/GOV = \{[^}]*nsw23: "alp"/.test(base) && /GOV = \{[^}]*vic22: "alp"/.test(base) && /GOV = \{[^}]*qld24: "lnp"/.test(base), "the state frames' winning sides (2024's Queensland went LNP, the map's first non-Labor state frame)");
  assert.ok(/PM = \{[^}]*nsw23: "Chris Minns"/.test(base) && /PM = \{[^}]*vic22: "Daniel Andrews"/.test(base) && /PM = \{[^}]*qld24: "David Crisafulli"/.test(base), "the Premiers are named (nsw23's Chris Minns, qld24's David Crisafulli, vic22's Daniel Andrews)");
  assert.equal((js.match(/const STATE_NAME = /g) || []).length, 1, "one top-level STATE_NAME across the app parts (frame years map through YEAR_JUR)");
  assert.ok(/\.mp-time \{ flex: none; position: relative; height: 54px;/.test(css) && /\.mp-time \{ height: 48px; \}/.test(css), "the timeline bar holds one jurisdiction rung — the top rail's old band (54px; 48px on the phone rung)");
  assert.ok(ui.includes('<text class="yr row"'), "the rows carry captions");
  assert.ok(ui.includes("Federal elections ${YEARS[0]} to now, and Victorian, New South Wales, South Australian, Queensland and Western Australian state elections; choose one"), "the timeline names its jurisdiction rows to a screen reader (resolved from the years list's head – 2001 today)");
  // the rung order itself, in the spots that encode it: the rows declare
  // federal, Victoria, New South Wales, South Australia, Queensland, Western
  // Australia (2026-11-05: appended at the bottom) — and SINCE 2026-11-06 they
  // all collapse onto the ONE visible band in the top rail's spot, only the
  // selected jurisdiction's rung drawing at a time; labels and the glyph's row
  // lookup follow the same order. The up/down-arrow walk runs in the
  // "View elections" strip's own order instead (Queensland before South Australia)
  assert.ok(base.includes("const LANES = [YEARS_FED, YEARS_VIC, YEARS_NSW, YEARS_QLD, YEARS_SA, YEARS_WA];"), "the up/down walk follows the View elections strip's order (Qld before SA)");
  assert.ok(ui.includes("const rowIx = (y) => (VIC_YEARS.has(y) ? 1 : NSW_YEARS.has(y) ? 2 : SA_YEARS.has(y) ? 3 : QLD_YEARS.has(y) ? 4 : WA_YEARS.has(y) ? 5 : 0);"), "the rung index per jurisdiction (vic22 → 1, a wa stop → 5)");
  assert.ok(ui.includes("const TOP = 2, BASE = H - 23;") && (ui.match(/\{ ys: YEARS_\w+, base: BASE, top: TOP(?:, gx: [^}]+)? \}/g) || []).length === 6, "all six jurisdiction rows collapse onto the one band in the top rail's spot (BASE = H - 23)");
  assert.ok(ui.includes("const hitTop = 0, hitBot = H;"), "the one visible rung takes the whole strip's height for its stops' touch windows");
  // one rung at a time (2026-11-06): the rail line, the stop labels AND the
  // seat-count make-up bars all draw for the selected election's row alone —
  // the bars' loop was the one unfiltered tier left when the rail and labels
  // were cut over, so every jurisdiction's bars floated at once
  assert.ok((ui.match(/rows\.filter\(\(_, i\) => i === activeIx\)/g) || []).length >= 2, "the timeline's rail and its seat-count bars draw on the selected jurisdiction's rung alone (rows filtered to activeIx in both tiers)");
  assert.ok(ui.includes("if (R.i !== activeIx) continue;"), "the stop-label tier keeps its activeIx gate too");
  const rowsSlice = ui.slice(ui.indexOf("const rows = ["), ui.indexOf("const rowIx"));
  const rungIx = ["YEARS_FED", "YEARS_VIC", "YEARS_NSW", "YEARS_SA", "YEARS_QLD", "YEARS_WA"].map((k) => rowsSlice.indexOf(`{ ys: ${k},`));
  assert.ok(rungIx.every((x, j) => x >= 0 && (j === 0 || x > rungIx[j - 1])), "the timeline rungs declare federal, Victoria, New South Wales, South Australia, Queensland, Western Australia in order");
  const labelsSlice = ui.slice(ui.indexOf("const rowsOf = ["));
  const labIx = ["YEARS_FED", "YEARS_VIC", "YEARS_NSW", "YEARS_SA", "YEARS_QLD", "YEARS_WA"].map((k) => labelsSlice.indexOf(`tlStops(${k})`));
  assert.ok(labIx.every((x, j) => x >= 0 && (j === 0 || x > labIx[j - 1])), "the label layers follow the same rung order");
  // a state frame's label: the five-char key "nsw23" ends in its two-digit
  // year — slice(2) read it as "NSW w23" (the same derivation on the
  // federal four-char keys was why it was written that way)
  assert.ok(base.includes("`${YEAR_JUR[y].toUpperCase()}20${String(y).slice(-2)}`"), "a state frame's label is the jurisdiction word + full year, no space (nsw23 → 'NSW2023', never 'NSW w23' or 'NSW 23')");
  assert.ok(ui.includes("const tlStops = (ys) => ys.map((y) => ({ y, lab:") && ui.includes('isNowY(y) ? (short || y === "now" ? "Now" : yearLabel(y))'), "the timeline's short row shows the two-digit year only; a state's own Now stop names itself Now too");
}

// the Winner head's scope menu (2026-11-06): the frame's own jurisdiction opens a
// menu of its states and seat types; the head recomposes scoped (figures, seat
// share and the make-up bar all follow it), and the cycle/list breakdown cards
// it replaced are gone from the head's trail. Every frame words the menu
// plainly ("National", "NSW", "Inner metro") since 2026-11-07 — the "…
// figures" run-ons and their hyphens died even on the now views, user call
{
  const st = part("app-4-story.js"), ui = part("app-6-ui.js"), css = part("page.css"), ch3 = part("app-3-chamber.js");
  // one pick shared across frames (2026-11-07): a year switch keeps the named
  // figures; a frame that can't express the pick falls back to its own "aus"
  assert.ok(st.includes("let statScopeStore = { k: \"aus\" };") && !st.includes("statScopes = new WeakMap()"), "the figures scope is one pick shared across frames, surviving a year switch");
  assert.ok(st.includes("const statScopeOk = (m, s) =>") && st.includes("? statScopeStore : { k: \"aus\", open: statScopeStore.open }"), "a frame that can't express the pick falls back to its own jurisdiction figures");
  assert.ok(ui.includes("statScopeStore = sel;"), "a scope pick rewrites the shared store");
  assert.ok(st.includes("const clsPart = poolParts(m).cls;") && st.includes('const statSel = clsPart ? { k: "cls", cls: clsPart } : statScopeOf(m);'), "the head's scope reads the cls axis first, compounding wherever the map has a state down");
  assert.ok(st.includes('return "National";') && !st.includes('? " figures" : ""'), "the neutral scope words itself plainly on every frame — National, never 'figures'");
  assert.ok(!st.includes("FIG_DEMONYM"), "the demonym compounds (Victorian figures, Western Australian figures) are gone too");
  assert.ok(st.includes('if (sel.k === "cls") return CLS_SHORT[sel.cls];') && st.includes('statScopeLabel(m, { k: "cls", cls: c })'), "the dropdown items and the types toggle share the one plain-wording factory — a seat type reads Inner metro with no figures run-on and no hyphen");
  assert.ok(st.includes('return cls ? statScopeLabel(m, { k: "cls", cls }) : "Filter by seat type";'), "the trigger invites by the state axis, then by the seat types over a sliced state, and names the pick once one's on");
  assert.ok(st.includes("if (sliceState(m)) return CLS.filter((c) => m.divs.some((d) => d.cls === c)).map((c) => [`cls:${c}`, statScopeLabel(m, { k: \"cls\", cls: c })]);") && st.includes("for (const s of STATES) if (m.areas[s] && m.areas[s].formal > 0) opts.push"), "a sliced state's dropdown is the seat types; otherwise it's states and territories alone");
  assert.ok(st.includes("(S.lens === \"cls\" || st) ? statScopeStore.cls : null") && st.includes('statScopeStore.k === "cls" && S.lens !== "cls"'), "a seat type filters a sliced state's head or its own lens — elsewhere the pick sleeps rather than filtering invisibly");
  assert.ok(ui.includes('id !== "cls" && statScopeStore.k === "cls"'), "a type pick's store clears on any other lens");
  assert.ok(ui.includes('clsLensShelved ||= S.lens === "cls"') && ui.includes('S.lens = "cls"; clsLensShelved = false'), "the cls lens shelves through a state frame and returns itself (and its chips) on a federal one");
  assert.ok(st.includes('st-clsmeta">${dropdown()}${chips}<'), "the state dropdown stacks above the types toggle row in the cls lens's head meta (DOM order: dropdown, then chips)");
  assert.ok(st.includes('const pickerLens = () => S.lens === "winner" || S.lens === "cls";'), "the winner-story gates ride one shared picker-lens idiom, defined where its consumers live (the VM harnesses eval the story part alone)");
  assert.ok(!st.includes("${fpRow ? statBreakdowns(m, st) : \"\"}"), "the breakdown cycle/list cards are gone from the head's trail");
  assert.ok(st.includes('meta = pickerLens() && aus ? statScopeMenu(m, st)'), "the scope menu owns the head meta on the winner-design lenses");
  assert.ok(st.includes("class=\"st-makeup\""), "the seat row's make-up bar rides the scoped counts");
  assert.ok(st.includes("function scopeSeatBase(m, sel, idx, cnt)") && st.includes("scopeSeatBase(m, statSel, idx, cnt)") && st.includes('ab === "CSA" ? "csa" : FAM(ab)') && st.includes("m.changes"), "a now frame keeps its seat-change line under scoped views too — the base is the overlay's own chains reverted inside the scope (NSW figures and Rural figures keep the Coalition's minus-two)");
  assert.ok(st.includes('statSel.k === "st" && !isNowY(m.year) ? seatBase(m, statSel.st)'), "a state pick on an election frame takes the official per-state seat base (smalls sum to the redistribution drift, as the aus row's does)");
  assert.ok(st.includes("m.divs[i].change && m.divs[i].change.prev") && st.includes("to = holdFam(m.divs[i].hold)"), "a seat type on an election frame reverts each scoped seat to its previous holder — every scoped view carries the change line");
  assert.ok(ui.includes("function setStatScope") && ui.includes('data-scope-trigger') && ui.includes('"[data-scope]"'), "the menu's trigger, items and re-render all wire in one click chain");
  assert.ok(css.includes(".st-scwrap") && css.includes(".st-scm") && css.includes(".st-makeup"), "the menu plate, its items and the make-up bar carry styles");
  assert.ok(st.includes("noteDef.seats.every((n) => idx.some((i) => m.divs[i].n === n))") && st.includes('seats: ["New England", "Farrer"]') && st.includes('<span class="st-seat-note">'), "the moved-seats note follows its named seats' scope — National keeps it, NSW and Rural keep it, other figures views drop it");
  assert.ok(st.includes("The figures here are the 2025 election’s, adjusted for seat changes. Most notably,") && st.includes('if (m.year !== "now") h += `<p class="st-note"'), "the federal Now's seats note opens with the figures basis — the old 'figures below' note lives on only on the state Now frames");
  // the slice is ONE state picked from either side (2026-11-07): the menu and
  // the map write each other, the render reads the slice from the selection,
  // and the whole-frame layout keeps only its own three state marks
  assert.ok(st.includes("const sliceState = (m) =>") && st.includes('S.sel.level === "state"'), "the slice is defined from the map's state selection");
  assert.ok(st.includes('if (slice) return { k: "st", st: slice, open: statScopeStore.open };'), "a live slice outranks the store as the head's scope");
  assert.ok(st.includes('s.level === "state" ? (sliceState(m) ? storyArea(m, "AUS") : storyArea(m, s.st))'), "a Winner-lens state slice renders the whole-frame layout");
  assert.ok(st.includes('const pickTitle = pick.k === "st" ? STATE_TITLE[pick.st] : pick.k === "cls" ? CLS_SHORT[pick.cls] : null;') && st.includes("` · ${m.year}`"), "a filtered Winner head titles itself by the filter, election frames carrying the year after a middot (New South Wales · 2025, Inner metro · 2025)");
  assert.ok(st.includes('const clsScoped = m && s.level === "aus"'), "a seat-type filter earns the same 'All seats' way out above the title as a state slice (goAus clears the store through the sync)");
  assert.ok(ui.includes('statScopeStore = { k: "st", st: sel.st, open: statScopeStore.open }'), "a state arrived at any side writes the menu's store");
  assert.ok(ui.includes('select({ level: "state", st: sel.st }, { fly: false })'), "the menu naming a state selects it on the map too, without moving the camera");
  assert.ok(ui.includes('statScopeStore = { k: "aus", open: statScopeStore.open }'), "the whole frame again ('All seats') clears the store's pick");
  assert.ok(st.includes("const clsFilter = (m) =>") && ch3.includes('S.sel.level === "state" ? S.sel.st : null, cls: clsFilter(m)'), "the story chamber marks the pick — a state's seats lit, a seat type's kind lit in its lens colours");
  // the cls lens shares the Winner design wholesale (2026-11-08): same head
  // card, same sections, the menu as its meta — with the type alone as its
  // axis and the trigger named so
  assert.ok(st.includes('switch (S.lens === "cls" ? "winner" : S.lens)') && !st.includes("carries no AEC type"), "the cls lens falls through to the Winner story design");
  assert.ok(ch3.includes("CLS.indexOf(m.divs[i].cls)") && ch3.includes("clsSel && d.cls !== clsSel") && ch3.includes("offType ? th.ink") && ch3.includes("cls: sen ? null : clsFilter(m)"), "only the picked type wears the ladder tone in the chambers — every other kind ghosts to an ink wisp (the rungs are too close to read by alpha), never the Senate");
  assert.ok(st.includes("const chamberMark = pickTitle"), "the chamber section's small names the filter it marks");
  // the two filter axes compound (2026-11-08): the map's own state selection
  // and the menu's class pick are orthogonal — pools intersect where both are on
  assert.ok(st.includes("const poolParts = (m) =>") && st.includes("const sliceState = (m) => poolParts(m).st") && st.includes("const clsFilter = (m) => poolParts(m).cls"), "the map's state and the menu's class read from one compound derivation");
  assert.ok(st.includes("const stPool = poolParts(m).st") && st.includes("return { A: statClassArea(m, idx)"), "a class picked inside a state tallies its own intersection, not the class's national row");
  assert.ok(st.includes("const statScopeMenuCur = (m) =>"), "the menu's marked pick rides the store's own (a compounding class stays marked beside the map)");
  assert.ok(ui.includes('sel.k !== "cls" && S.sel.level === "state"'), "a class pick compounds the map's state selection instead of clearing it");
  assert.ok(ui.includes('statScopeStore.k !== "cls"'), "the class filter survives the map side's state move");
}

// Controls share one stack; basis scales are no longer part of the panel.
{
  const ui = part("app-6-ui.js"), css = part("page.css"), st = part("app-4-story.js");
  const legend = ui.slice(ui.indexOf("function legendHTML"), ui.indexOf("/* =============================== the timeline"));
  assert.ok(!/lg-ramp|lg-ticks|lg-ends|seatTypeFilters/.test(legend), "basis controls contain no scales or seat-type filters");
  assert.ok(css.includes(".mp-legend { display: flex; flex-direction: column;"), "every basis shares the same control layout");
  assert.ok(st.includes('class="lg-types st-typefilters"') && st.includes('data-scope="${cur === `cls:${c}` ? "aus"'), "the cls lens's types are their own toggle row — a state dropdown sits above it — sharing the one scope store");
}

// the search field lives INSIDE the control panel (the lensrow's floating row
// is retired 2026-11-08): seeded in #legend, and renderLegend re-adopts the
// live field into the toolbar beside the Basis select at every rebuild
{
  const html = R("map/index.html"), css = part("page.css");
  assert.ok(html.indexOf('id="legend"') > 0 && html.indexOf('id="q"') > html.indexOf('id="legend"'), "the search field is seeded inside the control panel");
  assert.ok(js.includes('toolbar.className = "lg-toolbar"'), "renderLegend re-adopts the live search field into the toolbar beside the Basis select");
  assert.ok(css.includes(".lg-toolbar"), "the panel's toolbar row carries its flex rule");
}

// the strip's draw note rides UNDER the Draw row on every lens (user call
// 2026-11-08 — it floated above it on the winner lens); and fullscreen keeps
// the search on the Base row, not on its own line under it
{
  const ui = part("app-6-ui.js"), css = part("page.css");
  assert.ok(ui.includes("h += drawRow;") && ui.indexOf("h += drawRow;") < ui.indexOf("h += drawNoteHTML(m);") && ui.indexOf("h += drawNoteHTML(m);") < ui.indexOf('h += `<div class="lg-hint'), "the Draw row, then its note, then the hint — no note above the row");
  assert.ok(!css.includes(".fs .mp-legend .mp-search { flex-basis: 100%; width: 100%; }"), "fullscreen's search shares the Base row — no full-width line under it");
  assert.ok(ui.indexOf('if (S.lens === "flow") h += `<div class="lg-note"><span class="lg-hatch"></span>Final two') > ui.indexOf("h += drawNoteHTML(m);") && ui.indexOf('if (S.lens === "flow") h += `<div class="lg-note"><span class="lg-hatch"></span>Final two') < ui.indexOf('h += `<div class="lg-hint'), "the flow lens's final-two key rides the panel's closing rows ahead of the zoom hint");
}

// the now views carry the base election's swings (user call 2026-11-07 —
// reversing the old "not a change since" suppression): the winner head's 2PP
// swing chip and its primaries change smalls show on every frame alike
{
  const st = part("app-4-story.js");
  assert.ok(st.includes("const s = A.tppSw;") && !st.includes("isNowY(m.year) ? null : A.tppSw"), "the now view's two-party swing shows like any frame's");
  assert.ok(st.includes("showChange = A.fpSw.alp != null;") && !st.includes("fpSw.alp != null && !isNowY(m.year)"), "…and its primaries row carries change smalls");
}

// the full-screen view (app-7-full.js, 2026-11-03): its way in opens the zoom plate —
// the top-rightmost control since 2026-11-06, the jump-back's return arrow down the
// stack below it, its own glyph two corner brackets — the plates' room in
// every framing (the map's pads, the chamber's, its labels' and the islands'),
// the hash and history entry, Queensland's elections named as such (they read "South
// Australian election" in the stamp and the eyebrow), and the part assembled in order.
// The behaviour itself is driven by .matilda/probe/map-fullscreen.mjs
{
  const base = part("app-1-base.js"), map2 = part("app-2-map.js"), ch = part("app-3-chamber.js"), ui = part("app-6-ui.js"), fsj = part("app-7-full.js"), css = part("page.css");
  assert.ok(/id="zoomer"><button type="button" id="zfs" aria-label="Full screen" title="Full screen \(F\)"><svg[^>]*>(?:(?!<\/svg>).)*M20 9V4h-5(?:(?!<\/svg>).)*M4 15v5h5(?:(?!<\/svg>).)*<\/svg><\/button>/.test(page), "full screen opens the zoom plate (the top-rightmost control), its glyph two corner brackets");
  assert.ok(/<button type="button" id="zback" aria-label="Jump back" title="Jump back \(B\)" hidden><svg[^>]*>(?:(?!<\/svg>).)*M9 5 4 10l5 5(?:(?!<\/svg>).)*<\/svg><\/button>/.test(page), "the jump-back button sits on the plate too: return-arrow glyph, Jump back (B), hidden until off the default view");
  assert.ok(base.includes("const FS = { on: false, ins: { t: 0, r: 0, b: 0, l: 0 }, move: null };"), "the full-screen state lives in the base part, readable by every part from the start");
  assert.ok(map2.includes("if (FS.on && !page) { const q = FS.ins; p.t += q.t; p.r += q.r; p.b += q.b; p.l += q.l; }"), "the map's fit keeps the plates' room clear");
  assert.ok(ch.includes("if (FS.on) { const q = FS.ins; p.t += q.t; p.r += q.r; p.b += q.b; p.l += q.l; }") && ch.includes("const eL = opts.big && FS.on ? FS.ins.l : 0, eR = opts.big && FS.on ? w - FS.ins.r : w;"), "the chamber and its labels keep to the clear ground");
  assert.ok(map2.includes("const q = FS.on ? FS.ins : { l: 0, r: 0, b: 0 }, L = q.l + 4, R = Wpx - q.r - 4, B = Hpx - q.b - 4;"), "the island boxes stay off the plates");
  assert.ok(ui.includes('if (FS.on) p.set("fs", "1");') && ui.includes('fsFromURL = p.get("fs") === "1";') && fsj.includes('history.pushState({ mpFs: 1 }, "", location.href)'), "full screen rides the hash, and its own history entry makes Back the way out");
  assert.ok(ui.includes('QLD_YEARS.has(y) ? "Queensland" ') && !ui.includes('VIC_YEARS.has(m.year) ? "Victorian" : "South Australian"'), "each jurisdiction names itself in the stamp and the eyebrow (Queensland's arm, Western Australia's arm amongst them)");
  assert.ok(fsj.includes("if (FS.on || FS.leaving || !M()) return;") && fsj.includes("fsUnpark(true);"), "the way in parks the page's own elements; the way out sends them home ahead of the stage");
  assert.ok(base.includes("if (!PHONE.matches || y == null || FS.on) return;") && base.includes("if (!spot || !PHONE.matches || FS.on) return null;"), "the phone's walk hold stands down in full screen (no page to hold)");
  assert.ok(css.includes(".fs:not(.phone) .mp-legend { min-height: 0 !important; }"), "the wide panel's key takes its own height (its hold is the page stage's)");
  assert.ok(!/\.fs[^{]*\{[^}]*text-transform:\s*uppercase/.test(css), "no small caps in the full-screen plates");
}

console.log("PASS: map page – an ext menu page outside the main build, linked in both designs and the shell, two-column menus, assembled assets current, data present, plan years seated by the plan, NSW's 2023 and Victoria's 2022 frames on their own timeline rows, in the sitemap");
