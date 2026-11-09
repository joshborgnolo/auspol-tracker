/* test-retro-info.mjs – pins the retro Info page (/info/retro/:
   .build/retro/info.mjs, info.client.js, info.css).

   - The committed page is the build's: the modern Info page's entries, run
     in node through harvest.mjs, so it can't trail the modern page.
   - Every modern entry is here, in its part, in the modern order, with its
     words: each entry's text is compared with the modern tree's.
   - Every term-to-term link lands on an entry the page holds, in the view
     that entry sits in.
   - It is the retro family's: every retro navbar's Info opens it, it is
     linked from nowhere outside the family, canonical to /info/, out of the
     sitemap, in SITE_FILES. */
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { modernRunner, dataClock, words, hasCls, findAll } from "./retro/harvest.mjs";
import { retroInfo, INFO_VIEWS } from "./retro/info.mjs";
import { RETRO_TWIN } from "./retro/allpolls.mjs";
import { shellPages, mainChrome } from "./site-shell.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const R = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const dataset = R(".build/newtracker/assets/9f09dca2-bd46-49a8-8ae1-51847608cf92.js");
let runner;
try { runner = modernRunner({ root: ROOT, clock: dataClock(dataset) }); }
catch (e) { assert.fail(`the modern page no longer runs in the harvest (${e.message}) – mend .build/retro/harvest.mjs`); }
const inf = retroInfo({ root: ROOT, dataset, shellPages: shellPages(), footer: mainChrome().footer, runner });
const html = inf.html;

// ---- current, and written by the build ------------------------------------------------------
assert.equal(R("info/retro/index.html"), html, "info/retro/index.html is current – run node .build/newtracker/build.mjs and commit it");
const build = R(".build/newtracker/build.mjs");
assert.ok(build.includes('const { retroInfo } = await import("../retro/info.mjs");') && build.includes('[path.join("info", "retro"), inf.html]'), "build.mjs writes it (block 5a'')");
assert.ok(/SITE_FILES=\([\s\S]*?info\/retro\/index\.html[\s\S]*?\)/.test(R(".build/git-push-main.sh")), "a refresh commit carries it (SITE_FILES)");

// ---- every modern entry, in its part, with its words ----------------------------------------
const h = runner.mount("InfoView", {}, { path: "/info/" });
const modern = findAll(h.tree, (t) => hasCls(t, "info-term")).map((t) => ({ id: String(t.props.id).replace(/^term-/, ""), text: words(t) }));
assert.ok(modern.length >= 30, `the modern page has its entries (${modern.length})`);
assert.deepEqual(inf.terms.map((t) => t.id), modern.map((m) => m.id), "every modern entry, in the modern order");
const plain = (s) => s.replace(/<button[^>]*data-ri="top"[^>]*>[^<]*<\/button>/g, "").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").replace(/\s+([,.;:!?)])/g, "$1").replace(/\(\s+/g, "(").trim();
for (const m of modern) {
  const at = html.indexOf(`<div class="ri-term" id="term-${m.id}">`);
  assert.ok(at > 0, `entry ${m.id} is on the page`);
  // the entry's own div: up to its Back to top
  const end = html.indexOf('data-ri="top"', at);
  const body = html.slice(at, html.indexOf("</button></div>", end) + 15);
  assert.equal(plain(body), m.text, `entry ${m.id} says what the modern entry says`);
}
const views = new Set(INFO_VIEWS.map((v) => v.id));
assert.ok(inf.terms.every((t) => views.has(t.view)), "each entry sits in one of the four views");
for (const v of ["faq", "method", "panels"]) assert.ok(inf.terms.some((t) => t.view === v), `the ${v} view has entries`);
assert.ok(html.includes("Show the working") && /<details class="rp-how ri-work">/.test(html), "the working folds as the modern page folds it");
assert.ok(/<table class="rp-t ri-tab/.test(html), "the worked tables are drawn");

// ---- links ------------------------------------------------------------------------------------
const viewOf = Object.fromEntries(inf.terms.map((t) => [t.id, t.view]));
const xrefs = [...html.matchAll(/href="#v=([\w-]+)&amp;t=([\w-]+)" data-term="([\w-]+)"/g)];
assert.ok(xrefs.length >= 20, `term links and contents lists link entries (${xrefs.length})`);
for (const [, v, t, d] of xrefs) assert.ok(t === d && viewOf[t] === v, `a link to ${t} opens ${viewOf[t]} (it says ${v})`);
assert.ok(!html.includes('href="/info/"'), "no link out to the modern Info: Modern view is the way back");
assert.ok(html.includes('href="/cycles/retro/#v=final"'), "How the final polls have done opens the retro Past cycles' final polls");
assert.ok(!html.includes('class="hi-term"'), "no modern term button survives");

// ---- the retro family's -----------------------------------------------------------------------
assert.equal(RETRO_TWIN["/info/"], "/info/retro/", "Info's twin is this page");
assert.ok(html.includes('<a href="/info/retro/" aria-current="page">Info</a>'), "the navbar's Info is this page, marked");
assert.ok(html.includes('<link rel="canonical" href="https://auspoltracker.com/info/">'), "canonical is the modern Info page");
for (const f of ["retro/index.html", "cycles/retro/index.html", "allpolls/retro/index.html"]) assert.ok(R(f).includes('href="/info/retro/"'), `${f}: the navbar opens it`);
assert.ok(R("map/map.js").includes('"/info/": "/info/retro/"'), "the retro map's navbar opens it");
assert.ok(!/\/info\/retro\//.test(R("sitemap.xml")), "not in the sitemap");
{
  const htmls = [];
  const walk = (dir) => { for (const f of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    if (f.name.startsWith(".") || f.name === "node_modules" || f.name === "worktrees-seifa-land") continue;
    const rel = path.join(dir, f.name);
    if (f.isDirectory()) walk(rel); else if (f.name.endsWith(".html")) htmls.push(rel);
  } };
  walk(".");
  const FAMILY = ["allpolls/retro/index.html", "retro/index.html", "cycles/retro/index.html", "info/retro/index.html"].map((f) => path.normalize(f));
  const linking = htmls.filter((f) => !FAMILY.includes(path.normalize(f)) && R(f).includes("/info/retro/"));
  assert.deepEqual(linking, [], "no page outside the retro family links it");
}
assert.doesNotThrow(() => new Function(R(".build/retro/info.client.js")), "the browser half parses");

console.log(`PASS: retro Info – ${inf.terms.length} entries current with the modern page, word for word, in its four parts; ${xrefs.length} entry links land in their views; the retro family's, unlisted, in SITE_FILES`);
