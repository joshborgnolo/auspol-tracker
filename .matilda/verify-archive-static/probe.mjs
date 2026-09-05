/* Verification for the /archives/ static-article assimilation (the archives
   dropped their masthead lockup + glyph dial and now run the main site's
   no-JS static-summary chrome: 680px column, Crimson Text h1/h2, IBM Plex
   Sans body, ss-note footer, fixed .ss-back pill).

   Oracle strategy (see auto-skill-auspol-satellite-page-branding for why the
   LIVE page is the only safe reference): load index.html with no app JS, pin
   its body classes to what the live site runs (editorial, or dark+editorial),
   and read the computed static-summary styles as the baseline. Then assert
   each archive page computes to the same values for the shared chrome, in
   BOTH colour schemes. Font faces are checked via the server-side woff2
   request log (fonts.check alone passes on synthetic fallback for known
   families — the learned trap). */
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
  ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".pdf": "application/pdf" };
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
  { url: "/archives/newspoll/", name: "newspoll", maxw: "680px" },
  { url: "/archives/acnielsen/", name: "acnielsen", maxw: "680px" },
  { url: "/archives/morgan/", name: "morgan", maxw: "1200px" }, // verbatim tables stay wide
  { url: "/archives/galaxy/", name: "galaxy", maxw: "1080px" },
  { url: "/archives/trove/", name: "trove", maxw: "1080px" },
];

const H1_PROPS = ["fontFamily", "fontSize", "fontWeight", "letterSpacing", "marginBottom", "color"];
const TXT_PROPS = ["fontSize", "lineHeight", "color"];

const LIVE_READ = `(() => {
  const g = (sel, props) => {
    const el = document.querySelector(sel);
    return el ? Object.fromEntries(props.map((p) => [p, getComputedStyle(el)[p]])) : null;
  };
  const col = document.querySelector(".static-summary");
  return {
    bodyBg: getComputedStyle(document.body).backgroundColor,
    h1: g(".static-summary h1", ${JSON.stringify(H1_PROPS)}),
    sub: g(".ss-sub", ${JSON.stringify(TXT_PROPS)}),
    note: g(".ss-note", ["fontSize", "color"]),
    col: col ? {
      maxWidth: getComputedStyle(col).maxWidth,
      paddingTop: getComputedStyle(col).paddingTop,
      paddingLeft: getComputedStyle(col).paddingLeft,
    } : null,
  };
})()`;

const PAGE_READ = `(() => {
  const g = (sel, props) => {
    const el = document.querySelector(sel);
    return el ? Object.fromEntries(props.map((p) => [p, getComputedStyle(el)[p]])) : null;
  };
  const col = document.querySelector(".frame-wrap");
  return {
    bodyBg: getComputedStyle(document.body).backgroundColor,
    h1: g(".frame-wrap h1", ${JSON.stringify(H1_PROPS)}),
    sub: g(".ss-sub", ${JSON.stringify(TXT_PROPS)}),
    note: g(".ss-note", ["fontSize", "color"]),
    col: col ? {
      maxWidth: getComputedStyle(col).maxWidth,
      paddingTop: getComputedStyle(col).paddingTop,
      paddingLeft: getComputedStyle(col).paddingLeft,
    } : null,
    back: g(".ss-back", ["position", "fontSize", "fontWeight", "borderRadius"]),
    icon: (document.querySelector('link[rel="icon"]') || {}).href || null,
    serif600Loaded: document.fonts.check('600 34px "Crimson Text"'),
    sansLoaded: document.fonts.check('400 15px "IBM Plex Sans"'),
    gone: {
      siteHead: !document.querySelector(".site-head"),
      glyph: !document.querySelector(".wm-dial"),
      wordmark: !document.querySelector(".wordmark"),
    },
  };
})()`;

let failures = 0;
const fail = (msg) => { failures += 1; console.log("  FAIL " + msg); };
const ok = (msg) => console.log("  ok   " + msg);
const eq = (what, got, want) =>
  (JSON.stringify(got) === JSON.stringify(want))
    ? ok(`${what} = ${JSON.stringify(want)}`)
    : fail(`${what}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new",
  defaultViewport: { width: 1400, height: 1000 } });
try {
  for (const scheme of ["light", "dark"]) {
    console.log(`\n== ${scheme} ==`);
    const page = await browser.newPage();
    page.on("pageerror", (e) => console.error("[page]", e.message));
    await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: scheme }]);

    // baseline: the live page's no-JS article under the classes the app runs
    fontReqs = [];
    await page.goto("http://127.0.0.1:8733/", { waitUntil: "networkidle0", timeout: 60000 });
    await page.evaluate(`document.body.classList.add("editorial"${scheme === "dark" ? ', "dark"' : ""})`);
    await page.evaluate("document.fonts.ready.then(() => 0)");
    const live = await page.evaluate(LIVE_READ);
    if (!live.h1 || !live.sub || !live.note || !live.col) fail("live baseline: static-summary elements missing");

    for (const spec of PAGES) {
      console.log(` ${spec.name}`);
      fontReqs = [];
      await page.goto("http://127.0.0.1:8733" + spec.url, { waitUntil: "networkidle0", timeout: 60000 });
      await page.evaluate("document.fonts.ready.then(() => 0)");
      await new Promise((r) => setTimeout(r, 300));
      const got = await page.evaluate(PAGE_READ);

      eq("body background", got.bodyBg, live.bodyBg);
      eq("h1", got.h1, live.h1);
      eq("ss-sub", got.sub, live.sub);
      eq("ss-note", got.note, live.note);
      if (got.col && live.col) {
        eq("column padding-top", got.col.paddingTop, live.col.paddingTop);
        eq("column padding-left", got.col.paddingLeft, live.col.paddingLeft);
        eq("column max-width", got.col.maxWidth, spec.maxw);
      } else fail("column: .frame-wrap missing");
      if (spec.maxw === "680px" && live.col) eq("column aligns with live 680px", got.col.maxWidth, live.col.maxWidth);
      if (!got.serif600Loaded) fail("Crimson Text 600 not loadable");
      if (!got.sansLoaded) fail("IBM Plex Sans not loadable");
      if (!(got.gone.siteHead && got.gone.glyph && got.gone.wordmark))
        fail("masthead chrome still present: " + JSON.stringify(got.gone));
      if (!got.back) fail(".ss-back pill missing");
      else {
        eq("ss-back position", got.back.position, "fixed");
        eq("ss-back radius", got.back.borderRadius, "999px");
      }
      // satellites all link the live masthead glyph, emitted at build time
      eq("favicon link", got.icon, "http://127.0.0.1:8733/assets/favicon.svg");
      const crimson600 = fontReqs.some((f) => f.includes("crimsontext-600"));
      const retired = fontReqs.filter((f) => /sourceserif4|sourcesans3/.test(f));
      if (crimson600) ok("crimsontext-600 woff2 served"); else fail("crimsontext-600 woff2 never requested");
      if (retired.length === 0) ok("no retired faces requested"); else fail("retired faces requested: " + retired.join(", "));
    }
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}
console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
