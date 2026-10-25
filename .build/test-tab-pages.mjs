#!/usr/bin/env node
/* test-tab-pages.mjs – pins the real-URL-tabs contract (shipped 2026-10-10).

   The four main-page views are also four URLs: Now stays at the site root,
   Past cycles / All polls / Info each get a page of their own under it –
   build.mjs emits each as a full document (own title, description, canonical,
   og tags and static article, none of it hand-maintained) with a
   window.AP_INITIAL_TAB stamp so the client opens straight into the view, and
   the client itself routes between them by path: clicks pushState, back and
   forward work, the hash-era links keep landing, and the search string
   (?design=old, the archive's filters) survives every hop. /vic/ gets the
   same treatment minus Past cycles, which appears only once a term closes.

   Runs after the build in npm test's chain (it reads the built documents).
   The Vic scratch-build half of the contract – a Vic run writes no federal
   file and emits its own tab pages beside BUILD_OUT – lives in
   test-vic-build.mjs. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

// ---- the emitted documents -------------------------------------------------------------
const TABS = [
  { id: "cycles", label: "Past cycles", h1: "Past election cycles", descFrag: "campaign cycle in the tracker's record" },
  { id: "allpolls", label: "All polls", h1: "All polls", descFrag: "Every published Australian federal opinion poll" },
  { id: "disagreement", label: "Poll disagreement", h1: "Poll disagreement", descFrag: "How much the Australian federal polls disagree" },
  { id: "leans", label: "Pollster leans", h1: "Pollster leans", descFrag: "How each Australian federal pollster leans" },
  { id: "flows", label: "Respondent-allocated preference flows", h1: "Respondent-allocated preference flows", descFrag: "Where Australian federal preferences are flowing now" },
  { id: "flows-explained", label: "Preference flows explained", h1: "Preference flows explained", descFrag: "How preferences decide the Australian federal two-party figure" },
  { id: "public-opinion", label: "Public opinion", h1: "Public opinion", descFrag: "charted across pollsters, with every figure and source" }, /* the 2026-10-17 /ad-hocs/ catalogue, curated and renamed 2026-10-18, moved to /public-opinion/ 2026-10-21 */
  { id: "changelog", label: "Changelog", h1: "Changelog", descFrag: "the economic-confidence gauges, recorded entry by entry" },
  { id: "info", label: "Info", h1: "About auspol tracker", descFrag: "How auspol tracker works" },
];
const rootHtml = read("index.html");
assert.ok(!rootHtml.includes("window.AP_INITIAL_TAB="),
  "the Now document carries no initial-tab constant (absent means Now)");
for (const t of TABS) {
  const doc = read(`${t.id}/index.html`);
  assert.ok(doc.includes(`<title>auspol tracker – ${t.label}</title>`), `${t.id}/ has its own title`);
  assert.ok(doc.includes(`<link rel="canonical" href="https://auspoltracker.com/${t.id}/">`), `${t.id}/ has its own canonical`);
  assert.ok(doc.includes(`<meta property="og:url" content="https://auspoltracker.com/${t.id}/">`)
    && doc.includes(`<meta property="og:title" content="auspol tracker – ${t.label}">`), `${t.id}/ has its own og tags`);
  assert.equal(doc.match(/description[\s\S]{0,40}content="([^"]+)"/g).length > 0, true, `${t.id}/ carries a description`);
  assert.ok(doc.includes(t.descFrag), `${t.id}/ carries its own description, not the Now page's`);
  assert.ok(doc.includes(`window.AP_INITIAL_TAB=${JSON.stringify(t.id)};`), `${t.id}/ opens straight into the ${t.id} tab`);
  assert.ok(doc.indexOf("window.AP_INITIAL_TAB=") < doc.indexOf("window.AP_CYCLE_SRC="),
    `${t.id}/ stamps its tab before the cycle-source constant it sits over`);
  assert.ok(doc.includes(`<h1>${t.h1}</h1>`), `${t.id}/ leads its static article with its own plain-text head`);
  assert.ok(doc.includes('<article class="static-summary">'), `${t.id}/ keeps the plain-text article`);
  assert.ok(!/(?:href|url\()=?"assets\//.test(doc), `${t.id}/ references no relative assets`);
  assert.ok(doc.includes('window.AP_CYCLE_SRC="/assets/cycle-source.'),
    `${t.id}/ fetches the cycle source site-root-absolute (the page sits a folder down)`);
  assert.ok(doc !== rootHtml, `${t.id}/ is a document of its own, not a copy of Now`);
  assert.ok(!doc.includes(`<title>auspol tracker – ${TABS.find((o) => o.id !== t.id).label}</title>`),
    `${t.id}/ didn't take a sibling tab's title`);
}
assert.ok(!fs.existsSync(path.join(ROOT, "vic", "cycles")), "Vic has no Past cycles page while no term has closed");
for (const id of ["allpolls", "disagreement", "leans", "flows", "info"])
  assert.ok(fs.existsSync(path.join(ROOT, "vic", id, "index.html")), `vic/${id}/x exists beside vic/index.html`);
assert.ok(!read("vic/index.html").includes("window.AP_INITIAL_TAB="), "Vic's Now document carries no initial-tab constant");

// ---- the sitemap and the push list -------------------------------------------------------
const sm = read("sitemap.xml");
for (const u of ["cycles/", "allpolls/", "disagreement/", "leans/", "flows/", "flows-explained/", "public-opinion/", "changelog/", "info/",
                 "vic/allpolls/", "vic/disagreement/", "vic/leans/", "vic/flows/", "vic/info/"])
  assert.ok(sm.includes(`<loc>https://auspoltracker.com/${u}</loc>`), `the sitemap carries /${u}`);
assert.ok(!sm.includes("preference-flows/"), "the retired explainer satellite left the sitemap (its stub redirects)");
assert.ok(!sm.includes("vic/flows-explained/"), "the explainer is federal-only");
assert.ok(!sm.includes("vic/public-opinion/"), "Public opinion is federal-only");
assert.ok(!sm.includes("beyond-the-vote/"), "the retired /beyond-the-vote/ path left the sitemap (its stub redirects)");
assert.ok(!sm.includes("/ad-hocs/"), "the retired /ad-hocs/ path left the sitemap (its stub redirects)");
{
  const stub = read("ad-hocs/index.html");
  assert.ok(stub.includes('location.replace("/public-opinion/" + location.hash)') && stub.includes('url=/public-opinion/')
    && stub.includes('<link rel="canonical" href="https://auspoltracker.com/public-opinion/">'),
    "the /ad-hocs/ stub redirects to /public-opinion/, topic anchors and all");
}
{
  const stub = read("beyond-the-vote/index.html");
  assert.ok(stub.includes('location.replace("/public-opinion/" + location.hash)') && stub.includes('url=/public-opinion/')
    && stub.includes('<link rel="canonical" href="https://auspoltracker.com/public-opinion/">'),
    "the /beyond-the-vote/ stub redirects to /public-opinion/, topic anchors and all");
}
assert.ok(!sm.includes("vic/changelog/"), "the change log is federal-only (Vic never writes data/changelog.json)");
assert.ok(!sm.includes("vic/cycles/"), "the sitemap does not foretell /vic/cycles/");
const push = read(path.join(".build", "git-push-main.sh"));
for (const f of ["cycles/index.html", "allpolls/index.html", "info/index.html",
                 "disagreement/index.html", "leans/index.html", "flows/index.html",
                 "flows-explained/index.html", "preference-flows/index.html",
                 "public-opinion/index.html", "beyond-the-vote/index.html", "ad-hocs/index.html", "changelog/index.html",
                 "vic/allpolls/index.html", "vic/info/index.html",
                 "vic/disagreement/index.html", "vic/leans/index.html", "vic/flows/index.html"])
  assert.ok(push.includes(f), `SITE_FILES commits ${f} (a data refresh regenerates it)`);
// vic/cycles/index.html can't be a plain SITE_FILES member until a Vic term closes (the
// build only emits it then, and `git add` errors on a missing path) — it joins conditionally
assert.ok(push.includes('if [[ -f vic/cycles/index.html ]]; then')
  && push.includes("SITE_FILES+=(vic/cycles/index.html)"),
  "SITE_FILES picks up vic/cycles/index.html conditionally, found-day-one");

// ---- the build emits them -----------------------------------------------------------------
const build = read(path.join(".build", "newtracker", "build.mjs"));
assert.ok(/pastTab = !VIC \|\|/.test(build)
  && build.includes("k !== DATA.jurisdiction.baseline"),
  "the Vic cycles page is gated on a term closing, not hand-listed");
assert.ok(build.includes("window.AP_INITIAL_TAB="), "build.mjs stamps the per-tab constant");
assert.ok(build.includes("one document per tab"), "the emission pass logs its outputs");
assert.ok(build.includes("rd-beyond.jsx") && build.includes("oneoffs-source.json"),
  "the Public opinion page's view layer and its data sidecar ride the build");
const genData = read(path.join(".build", "newtracker", "gen-data.mjs"));
assert.ok(genData.includes("oneoffs-source.json") && genData.includes("loadOneOffs") && genData.includes("buildBeyond(readOneOffStores(ROOT)"),
  "gen-data emits the Public opinion sidecar (beyond-the-vote.mjs) and its lazy loader");

// ---- the client routes by path -----------------------------------------------------------
const hdr = read(path.join(".build", "newtracker", "assets", "73de0c58-f11f-4793-9f90-77e583ab051b.js"));
assert.ok(hdr.includes('const TAB_BASE = window.JUR ? "/vic/" : "/";'),
  "Vic's tabs route under /vic/, the federal ones under /");
assert.ok(hdr.includes('const tabToPath = (id) => (id === "now" ? TAB_BASE : TAB_BASE + id + "/");'),
  "Now is the root path, every other tab one segment under it");
assert.ok(hdr.includes("if (!p.startsWith(TAB_BASE)) return null;")
  && hdr.includes('if (seg === "") return "now";')
  && hdr.includes("return TAB_IDS.includes(seg) ? seg : null;"),
  "pathToTab answers only on a tab path: root = Now, unknown = null (the address bar is left alone)");
assert.ok(hdr.includes('const TAB_HASH = { snapshot: "now", now: "now", cycles: "cycles", allpolls: "allpolls", info: "info",\n  disagreement: "disagreement", leans: "leans", flows: "flows",\n  "beyond-the-vote": "public-opinion", "public-opinion": "public-opinion" };'),
  "the hash-era links keep landing: #snapshot and #beyond-the-vote included");
/* readLocation precedence: a known hash, then the path, then the page's own
   stamp, else Now. Pinned in source order so the precedence can't drift */
{
  const fn = hdr.slice(hdr.indexOf("const readLocation"), hdr.indexOf("window.AP.tabToPath = tabToPath;"));
  const seq = ["if (h && TAB_IDS.includes(TAB_HASH[h])) return TAB_HASH[h];",
               "const fromPath = pathToTab();",
               "return TAB_IDS.includes(window.AP_INITIAL_TAB) ? window.AP_INITIAL_TAB : \"now\";"];
  let at = -1;
  for (const s of seq) { const i = fn.indexOf(s); assert.ok(i > at, `readLocation precedence order holds at: ${s}`); at = i; }
}
/* the search string survives every URL write: ?design=old and the archive's
   filters live in it */
assert.ok(hdr.includes("const onUrl = () => {") && hdr.includes("const t = readLocation();")
  && hdr.includes("setTab(t);")
  && hdr.includes('"popstate", onUrl') && hdr.includes('"hashchange", onUrl'),
  "back/forward and a hand-typed hash re-read the location");
/* every history write rides urlWrite's try/catch: under file:// (a saved
   copy of the site) a path-changing write throws SecurityError and the
   exception used to kill the whole mount - the app never rendered on any
   offline copy. The URL is a nicety layered over the tab state; a refused
   write must never veto the state itself. */
assert.ok(hdr.includes('const urlWrite = (verb, to) => { try { history[verb](null, "", to); } catch {} };'),
  "history writes are wrapped so a refused write (file://) never kills the render");
assert.ok(!/history\.(pushState|replaceState)\(/.test(hdr),
  "no bare history.pushState/replaceState survives outside urlWrite");
/* …and the ban covers every asset, not just the header bundle: the view
   layer's two writers (the cycles board and the All-polls filter sync) grew
   bare replaceState calls behind a header-only grep. d1a1d215 declares its
   own try/catch wrapper (writeUrl) because the assets land as separate
   <script> blocks - a shared top-level const would be a duplicate global
   lexical declaration across classic scripts. */
{
  const adir = path.join(".build", "newtracker", "assets");
  for (const f of fs.readdirSync(path.join(ROOT, adir)))
    if (/\.(js|jsx)$/.test(f))
      assert.ok(!/history\.(pushState|replaceState)\(/.test(read(path.join(adir, f))),
        `${f}: no bare history.pushState/replaceState (writes go through a try/catch wrapper)`);
  const viewsSrc = read(path.join(adir, "d1a1d215-370c-4ebc-878b-7eeea9ad8102.js"));
  assert.ok(viewsSrc.includes('const writeUrl = (verb, to) => { try { history[verb](null, "", to); } catch {} };')
    && (viewsSrc.match(/writeUrl\("replaceState", next\)/g) || []).length === 2,
    "both view-layer URL writers go through d1a1d215's own wrapper");
}
assert.ok(hdr.includes('urlWrite("replaceState", window.location.pathname + window.location.search);'),
  "the masthead #story strip writes through the wrapper too");
assert.ok(hdr.includes("urlWrite(\"replaceState\", (t ? tabToPath(t) : window.location.pathname) + window.location.search);"),
  "a legacy hash is rewritten to its path on mount, search carried");
assert.ok(hdr.includes("urlWrite(\"replaceState\", tabToPath(tab) + window.location.search);"),
  "the address bar ends up naming the tab, search carried");
assert.ok(hdr.includes("urlWrite(\"pushState\", tabToPath(id) + window.location.search);"),
  "a tab press pushes its path, search carried");
assert.ok(hdr.includes("if (push && window.location.pathname.startsWith(TAB_BASE) && pathToTab() !== id)"),
  "the writer never touches the history off a tab path, or for the tab already named");
assert.ok(hdr.includes('TABS.splice(TABS.findIndex((t) => t.id === "cycles"), 1);'),
  "a jurisdiction with no past terms drops the Past cycles tab");

// ---- the tab bar IS the links ------------------------------------------------------------
const views = read(path.join(".build", "newtracker", "assets", "d1a1d215-370c-4ebc-878b-7eeea9ad8102.js"));
assert.ok(views.includes('href={window.AP.tabToPath ? window.AP.tabToPath(t.id) : "#" + t.id}'),
  "each tab renders as its own page's link");
// ---- the ☰ menu's pages ------------------------------------------------------------------
for (const [id, label] of [["disagreement", "Poll disagreement"], ["leans", "Pollster leans"], ["flows", "Respondent-allocated preference flows"],
                           ["flows-explained", "Preference flows explained"], ["public-opinion", "Public opinion"],
                           ["changelog", "Changelog"]])
  assert.ok(hdr.includes(`{ id: "${id}", label: "${label}", menu: true,`), `${id} is a menu page in TABS`);
// the explainer is federal-only: the Vic client splices its entry out of TABS
assert.ok(hdr.includes('if (window.JUR) TABS.splice(TABS.findIndex((t) => t.id === "flows-explained"), 1);'),
  "the Vic client drops the flows-explained tab");
// Public opinion is federal-only too (the one-off stores are federal)
assert.ok(hdr.includes('if (window.JUR) TABS.splice(TABS.findIndex((t) => t.id === "public-opinion"), 1);'),
  "the Vic client drops the Public opinion tab");
// the change log is federal-only too (Vic never writes data/changelog.json)
assert.ok(hdr.includes('if (window.JUR) TABS.splice(TABS.findIndex((t) => t.id === "changelog"), 1);'),
  "the Vic client drops the changelog tab");
assert.ok(views.includes("const barTabs = tabs.filter((t) => !t.menu);") && views.includes("{barTabs.map((t, ti) => ("),
  "the bar renders only the non-menu tabs");
assert.ok(views.includes('aria-haspopup="menu"') && views.includes('role="menu"') && views.includes("tab-menu-info"),
  "the ☰ opens a menu, which carries Info where the bar hides its tab");
assert.ok(!views.includes("/preference-flows/"),
  "the menu's hardcoded explainer link is retired – flows-explained rides the TABS menu entries");
assert.ok(views.includes('<MenuPageView id="flows-explained"') || views.includes('id === "flows-explained"'),
  "the menu-page view knows the explainer");
assert.ok(views.includes('id === "changelog"') && views.includes("function RdChangelog("),
  "the menu-page view knows the change log and renders it as a page of the site");
assert.ok(views.includes('{id === "public-opinion" && <RdBeyond />}') && views.includes('{id === "public-opinion" && <BtvBody />}'),
  "the menu-page view knows Public opinion in both designs");
{
  const btv = read(path.join(".build", "newtracker", "assets", "rd-beyond.jsx"));
  assert.ok(btv.includes("function RdBeyond(") && btv.includes("function BtvBody(")
    && btv.includes("Object.assign(window, { RdBeyond: RdBeyondM, BtvBody: BtvBodyM })"),
    "rd-beyond.jsx renders the page and exports both mount points");
  assert.ok(btv.includes("D.loadOneOffs()"),
    "the page lazily fetches its sidecar, like the cycle source");
  assert.ok(!fs.existsSync(path.join(ROOT, ".build", "newtracker", "assets", "rd-adhocs.jsx")), "the retired catalogue component is gone");
}
const tpl = read(path.join(".build", "newtracker", "template.html"));
assert.ok(!/\btab-menu-sep\b/.test(tpl), "the menu's explainer separator rule is retired from the template");
assert.ok(/\.tabs\.show-score \.tab-pinhide \{ display: none; \}\s*\.tabs\.show-score \.tab-menu-info \{ display: flex; \}/.test(tpl),
  "Info joins the menu under the same gate that drops its tab from the bar");
assert.ok(!/<RdDisagree \/>\s*<RdHouseLean measure=\{measure\} onMeasure=\{onMeasure\}/.test(views),
  "the three sections no longer mount under the All polls table");
assert.ok(views.includes("if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;")
  && views.includes("e.preventDefault();"),
  "a modified click opens the real document, a plain one swaps the view in place");
assert.ok(views.includes("if (e.detail) e.currentTarget.blur();"),
  "pointer navigation drops the leftover focus (keys and hover claims are protected)");
assert.ok(views.includes('if (e.key === " " || e.key === "Spacebar")'),
  "Space activates a tab like a native link's");

/* the satellites' own history writes follow the same rule: /prediction/'s
   archived-read deep link writes a hash through history.replaceState, and
   an unwrapped write throws SecurityError under file:// in Safari. Strip
   the allowed try/catch-wrapped calls, then any bare one left is a bug. */
{
  const predSrc = read(path.join(".build", "refresh-prediction.mjs"));
  const unwrapped = predSrc.replace(/try\s*\{\s*history\.(?:pushState|replaceState)\(/g, "");
  assert.ok(!/history\.(?:pushState|replaceState)\(/.test(unwrapped),
    "refresh-prediction.mjs: every history write rides a try/catch");
}

console.log(`PASS: tab pages – ${TABS.length + 1} federal documents, Vic's set, the ☰ menu, sitemap + SITE_FILES, path routing, hash aliases, search carried`);
