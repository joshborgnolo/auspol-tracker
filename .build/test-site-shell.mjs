/* test-site-shell.mjs – pins .build/site-shell.mjs: every satellite carries
   the current shell (a page edited around it, or a shell changed without
   re-applying, fails here rather than drifting on the live site), applying
   it is idempotent, it retires the old back pill and satellite note, it
   honours an explicit theme both ways, and nothing – shell or main page –
   links the pages the user wants left unlisted, /prediction/, /vic/ and
   /atlas/. Runs after the build in npm test (the shell's CSS names the
   wordmark font by the hash the build gives it). */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ROOT, SHELL_PAGES, applyShell, shellDrift, shellCss, shellJs, shellHeader, shellFooter, parseChrome, mainChrome } from "./site-shell.mjs";

// ---- every listed page is current, and carries each part once --------------------------
assert.deepEqual(shellDrift(), [], "a satellite is out of step with its shell – run node .build/site-shell.mjs and commit the pages");
for (const p of SHELL_PAGES) {
  const html = fs.readFileSync(path.join(ROOT, p.file), "utf8");
  for (const r of ["head", "header", "footer"])
    assert.equal(html.split(`<!--shell:${r}-->`).length - 1, 1, `${p.file}: one shell ${r}`);
  assert.ok(!/class="ss-back"/.test(html), `${p.file}: the retired back pill is gone`);
  assert.ok(/<main id="sh-content"/.test(html), `${p.file}: the skip link has its target`);
  assert.equal((html.match(/an unofficial aggregator of published federal opinion polling/g) || []).length, 1,
    `${p.file}: the strap-line once, in the colophon`);
}

// ---- the markup's variants ----------------------------------------------------------
assert.ok(!/href="\/feedback\/"/.test(shellFooter({ page: "feedback" })), "the feedback page doesn't invite feedback on itself");
assert.ok(/href="\/feedback\/"/.test(shellFooter({})), "every other page does");
assert.ok(!/stored <a href="\/(archives|provenance)\/">here<\/a>/.test(shellFooter({ page: "archives" })), "an archive page doesn't point at the archives/provenance hub");
assert.ok(/estimates only\./.test(shellFooter({})), "the disclaimer rides the colophon");
assert.equal((shellHeader({}).match(/<a class="sh-tab[" ]/g) || []).length, 4, "the four views on the bar, and nothing else");
// the ☰ menu: the main page's menu pages, Info for the pinned phone bar – the
// preference-flows explainer joined the main-page set 2026-10-15 as the
// /flows-explained/ tab page, the one entry every satellite's menu now carries
{
  const h = shellHeader({});
  assert.ok(h.includes('class="sh-tab sh-menu-btn" aria-haspopup="menu"'), "the bar ends in the ☰ button");
  for (const href of ["/disagreement/", "/leans/", "/flows/", "/flows-explained/", "/public-opinion/", "/changelog/", "/info/"])
    assert.ok(new RegExp(`<a role="menuitem"[^>]*href="${href}"`).test(h), `the menu links ${href}`);
  assert.ok(!/sh-menu-sep/.test(h + shellCss()), "the menu's explainer separator is retired");
  assert.ok(/class="sh-menu-item sh-menu-info"/.test(h), "Info rides the menu for the pinned phone bar");
  /* the explainer's twin-row flow-table figure (menu-lines.js's fig.rows):
     the satellites' fillMenu must draw it, their CSS dress it - a satellite
     menu rendered as the plain chip instead means this mirror drifted */
  assert.ok(shellJs().includes("ln.fig.rows") && shellJs().includes("sh-menu-fr"), "fillMenu renders fig.rows");
  for (const cls of [".sh-menu-item.sh-menu-wide", ".sh-menu-fr", ".sh-menu-fv", ".sh-menu-fc"])
    assert.ok(shellCss().includes(cls), `shell CSS dresses ${cls}`);
  assert.ok(shellCss().includes(".sh-menu-f .tm-grn") && shellCss().includes(".sh-menu-f .tm-oth"), "the trio's party tones live in the shell CSS");
}

// ---- the unlisted pages stay unlisted ----------------------------------------------------
// a link a reader can follow: an <a href> in a page, an href: prop in the main page's
// compiled views (a page's own canonical <link> and og:url are not links)
const unlisted = /(?:<a\b[^>]*\bhref=|\bhref:\s*)"(?:https:\/\/auspoltracker\.com)?\/(?:prediction|atlas|vic)\//;
assert.ok(!unlisted.test(shellHeader({}) + shellFooter({})), "the shell links neither /prediction/, /atlas/ nor /vic/");
// (vic/ is the main page's own build on Victorian data, shell-less, and
// unlisted all the same)
for (const f of ["index.html", "vic/index.html", ...SHELL_PAGES.map((p) => p.file)])
  assert.ok(!unlisted.test(fs.readFileSync(path.join(ROOT, f), "utf8")), `${f} links /prediction/ or /atlas/ or /vic/`);

// ---- applyShell on a page it has never seen ------------------------------------------------
const page = `<!DOCTYPE html>
<html><head>
<style>
:root { --bg: white; --ink: black; }
@media (prefers-color-scheme: dark) {
  :root { --bg: black; --ink: white; }
}
@media (prefers-color-scheme: dark) { .pos { color: pink; } .neg, .odd { color: blue; } }
/* ------- back to the interactive tracker (the static page's .ss-back pill) */
.ss-back { position: fixed; }
.ss-back:hover { border-color: red; }

p { margin: 0; }
</style>
</head>
<body>
<main class="frame-wrap">
  <h1>A page</h1>
  <p class="ss-note">A note of its own.</p>
  <p class="ss-note">This is a satellite archive page of <a href="/">auspol tracker</a>, an unofficial aggregator of published federal opinion polling. The live, interactive tracker carries the current aggregates, charts and per-poll archive.</p>
  <p class="ss-note">This is a satellite page of <a href="/">auspol tracker</a>, an unofficial aggregator of published federal opinion polling. Figures are computed from AEC results.</p>
</main>
<a class="ss-back" href="/">&larr; Back to the interactive tracker</a>
</body>
</html>
`;
const once = applyShell(page, { page: "archives" });
assert.equal(applyShell(once, { page: "archives" }), once, "idempotent");
assert.ok(!/ss-back/.test(once), "the pill, its rules and its comment are gone");
assert.ok(!/satellite archive page/.test(once), "the satellite note is gone");
assert.ok(/<p class="ss-note">Figures are computed from AEC results\.<\/p>/.test(once), "a note with more in it keeps the rest");
assert.ok(/<p class="ss-note">A note of its own\.<\/p>/.test(once), "an unrelated note stays");
// an explicit light choice switches the page's own dark rules off; an explicit dark one on
assert.ok(/:root:not\(\.sh-light\) \{ --bg: black; --ink: white; \}/.test(once), "the dark tokens are scoped");
assert.ok(/:root:not\(\.sh-light\) \.pos \{ color: pink; \}/.test(once), "so are the dark element rules");
assert.ok(/:root:not\(\.sh-light\) \.neg, :root:not\(\.sh-light\) \.odd \{/.test(once), "every selector of a list");
assert.ok(/:root\.sh-dark \{ --bg: black; --ink: white; \}/.test(once), "the dark tokens, for a chosen dark");
assert.ok(/:root\.sh-dark \.neg, :root\.sh-dark \.odd \{ color: blue; \}/.test(once), "the dark element rules, for a chosen dark");
assert.ok(/<body>\n<!--shell:header-->/.test(once) && /<!--\/shell:footer-->\n<\/body>/.test(once), "header opens the body, footer closes it");
assert.ok(/<!--\/shell:head-->\n<\/head>/.test(once), "the head part closes the head, after the page's own styles");

// ---- the published stylesheet names a font that exists ----------------------------------
const font = (shellCss().match(/url\("(\/assets\/fonts\/[^"]+)"\)/) || [])[1];
assert.ok(font && fs.existsSync(path.join(ROOT, font)), `the wordmark's face is on disk (${font})`);

// ---- the chrome contract: one parse, lifted three ways --------------------------------
assert.equal(mainChrome(), mainChrome(), "mainChrome is memoised");
const chrome = mainChrome();
assert.equal(chrome.tabs[0].id, "now", "the parse carries the main page's tabs");
for (const [what, v] of [["wordmark name", chrome.wm.name], ["wordmark track", chrome.wm.track],
                         ["wordmark sr suffix", chrome.wm.sr], ["tagline tail", chrome.tagline.b],
                         ["status label 1", chrome.meta.k1], ["status label 2", chrome.meta.k2],
                         ["status label 3", chrome.meta.k3], ["published prefix", chrome.meta.published],
                         ["polls word", chrome.meta.polls], ["pollsters word", chrome.meta.pollsters],
                         ["compact head", chrome.compact.b], ["score eyebrow", chrome.score.eyebrow],
                         ["dial title", chrome.dial.title], ["dial action", chrome.dial.action],
                         ["skip link", chrome.skip]])
  assert.ok(typeof v === "string" && v.length > 0, `chrome lift: ${what} came through`);
assert.ok(chrome.tagline.a.endsWith(" "), "the tagline head keeps its trailing space for the date word");
assert.ok(chrome.meta.monthsAtMost.endsWith("at most"), "the months-at-most phrase lifted whole");
for (const t of ["light", "dark"]) {
  assert.ok(chrome.theme[t].svg.startsWith("<svg"), `the ${t}-theme artwork lifted`);
  assert.ok(chrome.theme[t].svg.includes("stroke-width"), `the ${t}-theme artwork is svg, not jsx (strokeWidth)`);
}
// the baked header carries the lifted words (the interpolation itself is pinned, not just the parse)
const head = shellHeader({});
for (const [what, v] of [["wordmark name", chrome.wm.name], ["tagline tail", chrome.tagline.b],
                         ["status label", chrome.meta.k1], ["skip link", chrome.skip],
                         ["light artwork", chrome.theme.light.svg], ["score eyebrow", chrome.score.eyebrow],
                         ["dial title", chrome.dial.title]])
  assert.ok(head.includes(v), `shellHeader bakes the lifted ${what}`);
// the colophon, lifted with the header: every sentence parses, bakes and overlays
for (const [what, v] of [["colophon lede", chrome.footer.lede], ["colophon disclaimer", chrome.footer.disc],
                         ["colophon info lead", chrome.footer.infoLead], ["colophon info word", chrome.footer.infoWord],
                         ["colophon feedback clause", chrome.footer.spot], ["colophon feedback link word", chrome.footer.linkWord],
                         ["colophon archives lead", chrome.footer.archLead], ["colophon archives word", chrome.footer.archWord],
                         ["colophon archives tail", chrome.footer.archTail], ["colophon archives href", chrome.footer.archHref]])
  assert.ok(typeof v === "string" && v.length > 0, `chrome lift: ${what} came through`);
const foot = shellFooter({});
for (const [what, v] of [["lede", chrome.footer.lede], ["disclaimer", chrome.footer.disc],
                         ["feedback clause", chrome.footer.spot], ["feedback link word", chrome.footer.linkWord],
                         ["archives lead", chrome.footer.archLead], ["archives tail", chrome.footer.archTail]])
  assert.ok(foot.includes(v), `shellFooter bakes the lifted ${what}`);
assert.ok(foot.includes(chrome.footer.infoLead + '<a href="/info/">' + chrome.footer.infoWord), "the Info signpost lands first in sh-fb");
assert.ok(foot.includes(`href="${chrome.footer.archHref}"`), "shellFooter bakes the lifted archives href");
assert.ok(shellJs().includes('querySelector(".sh-lede")') && shellJs().includes('querySelector(".sh-arch")'),
  "site-shell.js re-applies the colophon from the copy block");
// the runtime overlay shipped in the emitted js
assert.ok(shellJs().includes("var fillCopy = function (cp)"), "site-shell.js carries the copy overlay");
// …and its tab rebuild can never re-ship 2026-10-03's live bug: the contract carries
// words only, so href comes from the id ("/" for Now, "/<id>/" for the rest – the
// tabs became real pages 2026-10-10), never t.href ("undefined" – a
// click went to <satellite>/undefined)
assert.ok(!shellJs().includes('setAttribute("href", t.href)'), "the runtime tab reconcile never writes t.href");
assert.ok(shellJs().includes('t.id === "now" ? "/" : "/" + t.id + "/"'), "the runtime tab href derives from the tab id");
// the baked header routes each tab to its real page
assert.ok(head.includes('class="sh-tab" href="/"'), "shellHeader's Now tab links to /");
assert.ok(head.includes('href="/allpolls/"') && head.includes('href="/cycles/"') && head.includes('href="/info/"'),
  "shellHeader's other tabs link to their per-tab pages");
// auspol-now.json (emitted by the build that precedes this test) carries the SAME parse
const now = JSON.parse(fs.readFileSync(path.join(ROOT, "assets", "auspol-now.json"), "utf8"));
assert.deepEqual(now.copy, chrome, "auspol-now.json's copy block is the chrome contract verbatim");

// ---- parseChrome says no aloud when the main page moves an anchor ----------------------
const assetDir = path.join(ROOT, ".build", "newtracker", "assets");
let headSrc = null, scoreSrc = null;
for (const f of fs.readdirSync(assetDir).filter((f) => /\.jsx?$/.test(f)).sort()) {
  const s = fs.readFileSync(path.join(assetDir, f), "utf8");
  if (!headSrc && /className="wm-name"/.test(s) && /className="tagline"/.test(s)) headSrc = s;
  if (!scoreSrc && /ts-eyebrow/.test(s)) scoreSrc = s;
}
assert.ok(headSrc && scoreSrc, "the masthead and score assets resolve (mainChrome's own anchor check)");
assert.deepEqual(parseChrome(headSrc, scoreSrc, chrome.tabs).wm, chrome.wm, "a direct parse of the same assets agrees");
assert.throws(() => parseChrome(headSrc.replace('className="wm-name"', 'className="wm-gone"'), scoreSrc, chrome.tabs),
  /wordmark name/, "a moved wordmark anchor throws");
assert.throws(() => parseChrome(headSrc, "", chrome.tabs), /score eyebrow/, "a missing score asset throws");
const noTag = headSrc.replace(/className="tagline">([\s\S]*?)<\/p>/, "x");
assert.throws(() => parseChrome(noTag, scoreSrc, chrome.tabs), /tagline/, "a refactored tagline throws");
const noLede = headSrc.replace('className="colo-lede"', 'className="colo-gone"');
assert.throws(() => parseChrome(noLede, scoreSrc, chrome.tabs), /colophon lede/, "a moved colophon anchor throws");

// ---- changelog/index.html: the change log as a main-build tab page (the ☰ menu's fifth,
// since 2026-10-15 – it was a shell satellite console page before that, and the Info about
// block's three-entry list before that again)
const hesc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const clEntries = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "changelog.json"), "utf8")).entries || [];
const clPage = fs.readFileSync(path.join(ROOT, "changelog", "index.html"), "utf8");
assert.ok(clPage.includes("<title>auspol tracker – Changelog</title>"), "changelog page: the title");
assert.ok(/<link rel="canonical" href="https:\/\/auspoltracker\.com\/changelog\/">/.test(clPage), "changelog page: the canonical");
assert.ok(clPage.includes("<h1>Changelog</h1>"), "changelog page: the h1");
assert.ok(!/shell:(?:head|header|footer)/.test(clPage), "changelog page: a main-build tab page, not a shell satellite");
assert.ok(clPage.includes('window.AP_INITIAL_TAB="changelog";'), "changelog page: opens straight into the changelog tab");
// the static article lists every entry, newest first, as the retired satellite
// page's console (ISO dates, [kind] tags, figures lit like syntax) – restored
// 2026-10-15 after the tab-page conversion had restated them as quiet prose
// (user: keep the old code-like chunk). A no-JS reader or crawler gets the
// whole run; the live tab renders the same console from D.changelog.
const clTimes = [...clPage.matchAll(/<time class="cl-date(?: cl-rep)?" datetime="([^"]+)">([^<]+)<\/time>/g)];
assert.deepEqual(clTimes.map((m) => [m[1], m[2]]), [...clEntries].reverse().map((e) => [e.date, e.date]),
  "changelog page lists every entry of data/changelog.json as ISO-date console rows, newest first");
/* the static console lights figures and arrows like syntax (build.mjs's
   lit), so an entry's text matches its lit form, not the bare text */
const clLit = (s) => hesc(s)
  .replace(/(\d[\d,]*(?:\.\d+)?%?)/g, '<span class="cl-n">$1</span>')
  .replace(/→/g, '<span class="cl-ar">→</span>');
for (const e of clEntries) assert.ok(clPage.includes(clLit(e.text)), `changelog page carries the ${e.date} entry's text`);
const clTags = [...clPage.matchAll(/<span class="cl-tag">([^<]+)<\/span>/g)].map((m) => m[1]);
assert.deepEqual(clTags, [...clEntries].reverse().map((e) =>
  ({ poll: "poll", flows: "flows", finding: "finding", meta: "headline", seed: "start", conf: "conf" })[e.kind] || "headline"),
  "every console row carries its kind tag");
assert.ok(clPage.includes('class="cl-term"') && clPage.includes('class="cl-log"'),
  "the static article renders the console block");
assert.ok(clPage.includes("body.dark .cl-term"), "the console carries its dark-terminal palette");
assert.ok(clPage.includes("IBM Plex Mono"), "IBM Plex Mono is registered for the console");
// a refresh commit carries it (2026-10-12: joined SITE_FILES with data/changelog.json)
const siteFiles = (fs.readFileSync(path.join(ROOT, ".build", "git-push-main.sh"), "utf8").match(/SITE_FILES=\(([\s\S]*?)\)/) || [])[1] || "";
assert.ok(/(^|\s)changelog\/index\.html(\s|$)/.test(siteFiles), "SITE_FILES commits changelog/index.html");
assert.ok(/<loc>https:\/\/auspoltracker\.com\/changelog\/<\/loc>/.test(fs.readFileSync(path.join(ROOT, "sitemap.xml"), "utf8")),
  "the sitemap lists /changelog/");

// ---- the feed link is absolute everywhere (the relative href="feed.xml" 404'd from /info/) --
assert.ok(clPage.includes('href="/feed.xml"'), "the changelog page points at the feed");
const rootDocs = ["index.html", "cycles/index.html", "allpolls/index.html", "info/index.html",
  "disagreement/index.html", "leans/index.html", "flows/index.html", "flows-explained/index.html",
  "changelog/index.html",
  "vic/index.html", "vic/allpolls/index.html", "vic/info/index.html",
  "vic/disagreement/index.html", "vic/leans/index.html", "vic/flows/index.html"];
for (const f of rootDocs) {
  const doc = fs.readFileSync(path.join(ROOT, f), "utf8");
  assert.ok(!/href[:=]\s*"feed\.xml"/.test(doc), `${f}: no relative feed.xml link`);
}
// the app's Info copy links /feed.xml from the views chunk (since the JS was
// externalised the docs no longer carry the JSX – assert the asset does)
const jsDir = path.join(ROOT, "assets", "js");
const feedHit = fs.readdirSync(jsDir).some((f) =>
  /^d1a1d215-.*\.js$/.test(f) && fs.readFileSync(path.join(jsDir, f), "utf8").includes('href: "/feed.xml"'));
assert.ok(feedHit, "the served d1a1d215 views chunk links /feed.xml");

console.log(`PASS: site shell – ${SHELL_PAGES.length} satellites current, idempotent, theme scoping, the unlisted pages unlisted, the chrome contract lifted, changelog page ${clEntries.length} entries, feed links absolute`);
