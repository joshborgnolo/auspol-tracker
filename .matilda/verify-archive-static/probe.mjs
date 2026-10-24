/* Verification for the /archives/* assimilation into the shared article
   design (the 2026-10-24 restructure): the seven archive pages — the
   /archives/ hub plus Newspoll, AC Nielsen, Morgan, Galaxy, AE Forecasts
   and Trove — all render inside the site-shell sh-page anatomy: .sh-arow /
   .sh-atitle / .sh-ameta head, Crimson .sh-hed, .sh-dek, and the lifted
   .ex-body article family, with wide tables escaping the 66ch measure via
   the shell's .ex-body .sh-wide rule. The six-copy archive tab strip is
   deduplicated to the shell (ARCHIVE_TABS in .build/site-shell.mjs), which
   emits one strip per page with the current page's tab marked
   aria-current="page".

   Oracle: /feedback/, the hand-maintained sibling that landed this anatomy
   first — each archive page's computed sh-page values must equal it, in
   BOTH colour schemes (headless Chrome defaults dark; emulate both).
   Structural assertions ride the light pass. Font faces are checked via
   the server-side woff2 request log (fonts.check alone passes on synthetic
   fallback for known families — the learned trap).

   Probe hazards honoured here: Newspoll's Infogram embed waits on `load`,
   so every goto uses domcontentloaded; geometry asserts run over an
   in-process HTTP server on 127.0.0.1:8733, never file://. */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const require_ = createRequire(path.join(os.homedir(), "node_modules", "."));
const puppeteer = require_("puppeteer-core");
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".woff2": "font/woff2", ".png": "image/png",
  ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".pdf": "application/pdf", ".css": "text/css" };
let fontReqs = [];
const server = http.createServer((req, res) => {
  let rel = decodeURIComponent(req.url.split("?")[0]);
  if (rel === "/") rel = "/index.html";
  if (rel.endsWith("/")) rel += "index.html";
  if (rel.endsWith(".woff2")) fontReqs.push(rel);
  fs.readFile(path.join(ROOT, rel), (err, buf) => {
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(rel)] || "application/octet-stream" });
    res.end(buf);
  });
});
await new Promise((ok) => server.listen(8733, "127.0.0.1", ok));

const PAGES = [
  { url: "/archives/",             name: "hub" },
  { url: "/archives/newspoll/",    name: "newspoll",   wide: true },
  { url: "/archives/acnielsen/",   name: "acnielsen" },
  { url: "/archives/morgan/",      name: "morgan",     wide: true, contained: true },
  { url: "/archives/galaxy/",      name: "galaxy",     wide: true },
  { url: "/archives/aeforecasts/", name: "aeforecasts", wide: true },
  { url: "/archives/trove/",       name: "trove",      wide: true, contained: true },
];
const TABS = [
  ["All archives", "/archives/"],
  ["Newspoll", "/archives/newspoll/"],
  ["AC Nielsen", "/archives/acnielsen/"],
  ["Morgan", "/archives/morgan/"],
  ["Galaxy", "/archives/galaxy/"],
  ["AE Forecasts", "/archives/aeforecasts/"],
  ["Trove", "/archives/trove/"],
];
const HUB_LINKS = TABS.slice(1).map(([, href]) => href);

/* what the /archives/* pages must compute to; /feedback/ is the oracle */
const COMP = `(() => {
  const g = (sel, props) => {
    const el = document.querySelector(sel);
    return el ? Object.fromEntries(props.map((p) => [p, getComputedStyle(el)[p]])) : null;
  };
  const ex = document.querySelector(".ex-body");
  return {
    bodyBg: getComputedStyle(document.body).backgroundColor,
    hed: g(".sh-hed", ["fontFamily", "fontSize", "fontWeight", "lineHeight", "color"]),
    atitle: g(".sh-atitle", ["fontSize", "fontWeight"]),
    ameta: g(".sh-ameta", ["fontSize"]),
    dek: g(".sh-dek", ["fontSize", "lineHeight"]),
    exMaxW: ex ? getComputedStyle(ex).maxWidth : null,
  };
})()`;

const STRUCT = `(() => {
  const q = (s) => document.querySelector(s);
  const head = document.querySelector("main.sh-page > header");
  const strips = [...document.querySelectorAll('nav.tabs[aria-label="Poll archives"]')];
  const wide = [...document.querySelectorAll(".ex-body .sh-wide")];
  return {
    mainPage: !!q("main.sh-page"),
    headOk: !!(head && head.querySelector(".sh-arow > h1.sh-atitle")
      && head.querySelector(".sh-arow .sh-ameta")
      && head.querySelector("p.sh-hed") && head.querySelector("p.sh-dek")),
    hedText: head && head.querySelector(".sh-hed") ? head.querySelector(".sh-hed").textContent.trim().slice(0, 60) : null,
    exBodyAfterHead: !!(head && head.nextElementSibling && head.nextElementSibling.classList.contains("ex-body")),
    stripCount: strips.length,
    tabs: strips[0] ? [...strips[0].querySelectorAll("a.tab")].map((a) => ({
      text: a.textContent.trim(), href: a.getAttribute("href"), current: a.getAttribute("aria-current"),
    })) : null,
    wideCount: wide.length,
    containedCount: document.querySelectorAll(".sh-page .rm-scroll").length,
    /* the pre-restructure per-page chrome only — .wordmark/.wm-dial belong to
       the shell's own masthead and are EXPECTED on every shell page */
    legacyGone: !q(".frame-wrap") && !q(".ss-sub") && !q(".ss-back"),
    hubLinks: [...document.querySelectorAll(".ex-body h2 > a")].map((a) => a.getAttribute("href")),
    shellVer: (document.querySelector('link[href*="site-shell.css"]') || {}).href || null,
    icon: (document.querySelector('link[rel="icon"][type="image/svg+xml"]') || {}).href || null,
  };
})()`;

const GEOM = `(() => {
  const ex = document.querySelector(".ex-body");
  const wide = document.querySelector(".ex-body .sh-wide");
  if (!ex) return null;
  const out = { exW: ex.offsetWidth };
  if (wide) out.wideW = wide.offsetWidth;
  const rm = document.querySelector(".sh-page .rm-scroll");
  if (rm) out.contained = getComputedStyle(rm).contentVisibility;
  return out;
})()`;

let failures = 0;
const fail = (msg) => { failures += 1; console.log("  FAIL " + msg); };
const ok = (msg) => console.log("  ok   " + msg);
const eq = (what, got, want) =>
  (JSON.stringify(got) === JSON.stringify(want))
    ? ok(`${what} = ${JSON.stringify(want)}`)
    : fail(`${what}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);

async function loadPage(page, url) {
  await page.goto("http://127.0.0.1:8733" + url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.evaluate("document.fonts.ready.then(() => 0)");
  await new Promise((r) => setTimeout(r, 150));
}

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new",
  defaultViewport: { width: 1400, height: 1000 } });
try {
  const page = await browser.newPage();
  page.on("pageerror", (e) => console.error("[page]", e.message));

  /* per-scheme computed-style pass: every archive page vs /feedback/. The
     oracle owns the shell head anatomy and the theme; .ex-body is the
     archives' own measure (feedback doesn't use it), so the seven pages
     are asserted equal to the HUB's ex-body instead. */
  for (const scheme of ["light", "dark"]) {
    console.log(`\n== ${scheme}: computed anatomy vs /feedback/ ==`);
    await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: scheme }]);
    fontReqs = [];
    await loadPage(page, "/feedback/");
    const ref = await page.evaluate(COMP);
    if (!ref.hed || !ref.atitle) fail("feedback oracle: sh-page head anatomy missing");
    let hubExMaxW = null;
    for (const spec of PAGES) {
      const got = await (async () => { await loadPage(page, spec.url); return page.evaluate(COMP); })();
      for (const k of ["bodyBg", "hed", "atitle", "ameta", "dek"])
        eq(`${spec.name} ${k}`, got[k], ref[k]);
      if (spec.name === "hub") hubExMaxW = got.exMaxW;
      else eq(`${spec.name} exMaxW = hub's`, got.exMaxW, hubExMaxW);
    }
  }

  /* structural pass (light), geometry, fonts */
  console.log("\n== structure, strip, geometry, fonts ==");
  await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }]);
  for (const spec of PAGES) {
    console.log(` ${spec.name}`);
    fontReqs = [];
    await loadPage(page, spec.url);
    const s = await page.evaluate(STRUCT);
    if (!s.mainPage) fail("main.sh-page missing");
    if (!s.headOk) fail("sh-page head anatomy missing (arow/atitle/ameta/hed/dek)");
    else ok(`head anatomy · ${s.hedText}`);
    if (!s.exBodyAfterHead) fail("div.ex-body does not directly follow the head");
    eq("one archives strip", s.stripCount, 1);
    if (!s.tabs || s.tabs.length !== 7) fail(`tabs: got ${s.tabs ? s.tabs.length : "none"}, want 7`);
    else {
      s.tabs.forEach((t, i) => {
        if (t.text !== TABS[i][0] || t.href !== TABS[i][1])
          fail(`tab ${i}: got "${t.text}" → ${t.href}, want "${TABS[i][0]}" → ${TABS[i][1]}`);
      });
      const currents = s.tabs.filter((t) => t.current === "page");
      if (currents.length !== 1) fail(`aria-current tabs: ${currents.length}`);
      else if (currents[0].href !== spec.url) fail(`aria-current on ${currents[0].href}, want ${spec.url}`);
      else ok("aria-current on the right tab");
    }
    const html = await page.content();
    const h0 = html.indexOf("<!--shell:header-->"), h1 = html.indexOf("<!--/shell:header-->"),
      tpos = html.indexOf('aria-label="Poll archives"');
    if (!(h0 > -1 && h1 > h0 && tpos > h0 && tpos < h1)) fail("archives strip not inside the shell:header block");
    else ok("strip shell-emitted");
    if (!s.legacyGone) fail("legacy chrome still present (frame-wrap/ss-sub/ss-back)");
    else ok("legacy chrome gone");
    if (spec.name === "hub") {
      if (/<meta[^>]+http-equiv=["']?refresh/i.test(html)) fail("hub still meta-refreshes");
      eq("hub's six archive links", s.hubLinks, HUB_LINKS);
      if (!/rel="canonical" href="https:\/\/auspoltracker\.com\/archives\/"/.test(html)) fail("hub canonical wrong");
    }
    const geom = await page.evaluate(GEOM);
    if (spec.wide) {
      if (!(geom && geom.wideW > geom.exW + 50)) fail(`sh-wide ${geom && geom.wideW}px does not clear ex-body ${geom && geom.exW}px`);
      else ok(`sh-wide ${geom.wideW}px > ex-body ${geom.exW}px`);
    } else if (s.wideCount) fail("unexpected .sh-wide on this page");
    if (spec.contained) {
      eq("rm-scroll containment", geom.contained, "auto");
    }
    const crimson600 = fontReqs.some((f) => f.includes("crimsontext-600"));
    const retired = fontReqs.filter((f) => /sourceserif4|sourcesans3[^ ]*esm|sourcesans/.test(f) && !/sourcesans3-latin/.test(f));
    if (crimson600) ok("crimsontext-600 woff2 served"); else fail("crimsontext-600 woff2 never requested");
    if (retired.length === 0) ok("no retired faces requested"); else fail("retired faces requested: " + retired.join(", "));
    eq("favicon", s.icon, "http://127.0.0.1:8733/assets/favicon.svg");
    if (!s.shellVer || !/site-shell\.css\?v=[a-z0-9]+/.test(s.shellVer)) fail("site-shell.css link missing/versionless");
  }

  /* the phone rung: no horizontal document overflow */
  console.log("\n== 375px: no document overflow ==");
  await page.setViewport({ width: 375, height: 740 });
  for (const spec of PAGES) {
    await loadPage(page, spec.url);
    const over = await page.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth");
    if (over <= 0) ok(`${spec.name} scrollWidth = viewport`);
    else fail(`${spec.name} overflows by ${over}px`);
  }
} finally {
  await browser.close();
  server.close();
}
console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
