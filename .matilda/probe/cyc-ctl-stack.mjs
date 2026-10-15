/* cyc-ctl-stack: the Past-cycles opposition-primary card's two One Nation
   overlay boxes ("Combine L/NP and ON", "One Nation this term") on a phone:
   the pair hugs the head row's right edge as one tight corner stack whose
   TOP row shares the chart's name line - One Nation's own overlay lands on
   the "Opposition's primary vote" line (that card's head re-aligns to the
   top; every other head keeps its flex-end) and "Combine L/NP and ON"
   hangs just below. The stretched rows put the two checkbox glyphs on one
   x line. The wrapper is display:contents everywhere else, so the
   desktop row beside the chart's name is untouched (checked at 1440 and
   760 - stacking must stay phone-only). Also: the phone stack must not
   push the page sideways, and the Hanson card's lone box keeps no wrapper.
   Plus the theme contract: the boxes are now CSS-DRAWN (2026-10-15 -
   appearance:none, transparent face, ink-3 ring, ink-2 fill with the tick
   cut out of the page background), so there is no native face to follow
   the OS scheme; what must flip with the site's own theme class are the
   VARIABLES. Emulate a dark OS, the auto theme goes .dark and the fill is
   light (tick cut from the dark page); force the light theme and the fill
   goes dark with a light tick. body/body.dark still pin color-scheme for
   the native controls elsewhere. */
import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const ROOT = process.env.PROBE_ROOT || fileURLToPath(new URL("../..", import.meta.url));
const PORT = 9008;
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".xml": "application/xml", ".woff2": "font/woff2" };

const server = http.createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p.endsWith("/")) p += "index.html";
    res.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" });
    res.end(await readFile(join(ROOT, p)));
  } catch { res.writeHead(404); res.end("nf"); }
});

let fails = 0;
const check = (name, ok, detail = "") => {
  console.log((ok ? "PASS " : "FAIL ") + name + (detail ? " — " + detail : ""));
  if (!ok) fails++;
};

/* one read of everything the assertions need: the chead geometry of the
   opposition-primary card (the one carrying .rd-cyc-ctls) and the Hanson
   card's wrapper count */
const readLayout = () => window.__cycCtlLayout = (() => {
  const sec = document.querySelector("#cyc-primary");
  const note = (r) => ({ x: +r.x.toFixed(1), y: +r.y.toFixed(1), right: +r.right.toFixed(1), bottom: +r.bottom.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1),
    cy: +(r.y + r.height / 2).toFixed(1) });
  const ctls = sec.querySelector(".rd-cyc-ctls");
  const card = ctls.closest(".rd-cyc-chart");
  const chead = card.querySelector(".rd-chead");
  const title = chead.querySelector(".rd-chead-t");
  const checks = [...ctls.querySelectorAll(".rd-check")];
  const comb = checks[0], onp = checks[1];
  const hanWrappers = [...document.querySelectorAll("#cyc-leaders .rd-chead")].filter((h) =>
    h.textContent.includes("Pauline Hanson this term") && h.querySelector(".rd-cyc-ctls")).length;
  const top = (r) => +r.top.toFixed(1);
  return { present: !!ctls, chead: note(chead.getBoundingClientRect()), title: note(title.getBoundingClientRect()),
    titleBottom: top(title.getBoundingClientRect()), ctlsTop: top(ctls.getBoundingClientRect()), combTop: top(comb.getBoundingClientRect()),
    comb: note(comb.getBoundingClientRect()), onp: note(onp.getBoundingClientRect()),
    combInX: +comb.querySelector("input").getBoundingClientRect().x.toFixed(1),
    onpInX: +onp.querySelector("input").getBoundingClientRect().x.toFixed(1),
    ctls: note(ctls.getBoundingClientRect()), ctlsDisplay: getComputedStyle(ctls).display,
    ctlsDir: getComputedStyle(ctls).flexDirection, combText: comb.textContent.trim(), onpText: onp.textContent.trim(),
    combWeight: getComputedStyle(comb.querySelector("i") || comb).fontWeight,
    onpWeight: getComputedStyle(onp.querySelector("i") || onp).fontWeight,
    hanWrappers, docW: document.documentElement.scrollWidth, vw: window.innerWidth };
})();

/* the box is CSS-drawn now, so the theme contract is read from COMPUTED
   styles instead of a pixel sample of a native face: transparent fill at
   rest; an ink-3 edge; when ticked an ink-2 fill whose ::after tick is cut
   from the page background. ink-2/ink-3/--bg flip with the site's own
   theme class, and body/body.dark still pin color-scheme for the native
   controls elsewhere on the page */
const readFace = () => {
  const lightOf = (v) => {
    let m = v.match(/oklch\(\s*([\d.]+)/);
    if (m) return +m[1];
    m = v.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
    if (m) return +((0.2126 * m[1] + 0.7152 * m[2] + 0.0722 * m[3]) / 255).toFixed(3);
    return null;
  };
  const inp = document.querySelector("#cyc-primary .rd-cyc-ctls input");
  const u = getComputedStyle(inp);
  const out = { darkClass: document.body.classList.contains("dark"),
    bodyCs: getComputedStyle(document.body).colorScheme,
    face: u.backgroundColor, faceL: lightOf(u.backgroundColor),
    edge: u.borderTopColor, edgeL: lightOf(u.borderTopColor),
    appearance: u.appearance || u.webkitAppearance };
  inp.click();
  const c = getComputedStyle(inp);
  const af = getComputedStyle(inp, "::after");
  out.fill = c.backgroundColor; out.fillL = lightOf(c.backgroundColor);
  out.fillEdge = c.borderTopColor;
  out.tick = af.backgroundColor; out.tickL = lightOf(af.backgroundColor);
  out.hasTick = (af.webkitMaskImage || af.maskImage || "none") !== "none";
  inp.click();
  return out;
};

(async () => {
  await new Promise((r) => server.listen(PORT, r));
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
  try {
    for (const [vw, vh] of [[390, 844], [760, 900], [1440, 960]]) {
      const page = await browser.newPage();
      const pageErrors = [];
      page.on("pageerror", (e) => pageErrors.push(String(e)));
      await page.setViewport({ width: vw, height: vh, hasTouch: vw < 700 });
      await page.goto(`http://127.0.0.1:${PORT}/cycles/`, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForSelector("#cyc-primary .rd-cyc-ctls", { timeout: 45000 });
      await page.evaluate(() => document.fonts && document.fonts.ready);
      await new Promise((r) => setTimeout(r, 900));
      const L = await page.evaluate(readLayout);
      const t = `${vw}x${vh}`;
      if (pageErrors.length) check(t + ": no page exceptions", false, pageErrors[0].slice(0, 160));
      check(t + ": wrapper on the opposition-primary card only", L.present && L.hanWrappers === 0,
        "hanWrappers=" + L.hanWrappers);
      check(t + ": DOM order keeps Combine first, One Nation second",
        /Combine/.test(L.combText) && /One Nation this term/.test(L.onpText),
        L.combText + " | " + L.onpText);
      check(t + ": checkbox labels are not bold (chead inherits 600)",
        L.combWeight === "400" && L.onpWeight === "400",
        "comb=" + L.combWeight + " onp=" + L.onpWeight);
      if (vw <= 640) {
        check(t + ": wrapper becomes the tight corner column at phone width",
          L.ctlsDisplay === "flex" && L.ctlsDir === "column-reverse", L.ctlsDisplay + " " + L.ctlsDir);
        check(t + ": One Nation sits on the chart-name line",
          Math.abs(L.onp.y - L.title.y) <= 1.5,
          "onp.y=" + L.onp.y + " title.y=" + L.title.y);
        check(t + ": One Nation sits fully above Combine",
          L.onp.bottom <= L.combTop + 1, "onp.bottom=" + L.onp.bottom + " comb.top=" + L.combTop);
        check(t + ": the pair is tight (gap no more than 2px)",
          L.combTop - L.onp.bottom <= 2 && L.combTop - L.onp.bottom >= 0,
          "gap=" + (L.combTop - L.onp.bottom));
        check(t + ": the phone rows sit on the 24px WCAG tap-target floor",
          L.comb.h >= 23.4 && L.comb.h <= 24.6 && L.onp.h >= 23.4 && L.onp.h <= 24.6,
          "comb.h=" + L.comb.h + " onp.h=" + L.onp.h);
        check(t + ": the pair's column clears the chart name to its left",
          L.title.right <= L.ctls.x + 1, "title.right=" + L.title.right + " ctls.x=" + L.ctls.x);
        check(t + ": the two checkbox glyphs line up on one x",
          Math.abs(L.combInX - L.onpInX) <= 1, "comb=" + L.combInX + " onp=" + L.onpInX);
        check(t + ": the two boxes share the one column's right edge",
          Math.abs(L.onp.right - L.comb.right) <= 2, "onp.right=" + L.onp.right + " comb.right=" + L.comb.right);
        check(t + ": the stack hugs the head row's right edge",
          Math.abs(L.comb.right - L.chead.right) <= 2 && Math.abs(L.onp.right - L.chead.right) <= 2,
          "comb.right=" + L.comb.right + " onp.right=" + L.onp.right + " chead.right=" + L.chead.right);
        check(t + ": the wrapper hugs a corner, not a full-width band",
          L.ctls.w < L.chead.w * 0.7, "ctls.w=" + L.ctls.w + " chead.w=" + L.chead.w);
        check(t + ": both boxes clear of the head row's left half",
          L.comb.x > L.chead.x + L.chead.w / 2 && L.onp.x > L.chead.x + L.chead.w / 2,
          "comb.x=" + L.comb.x + " onp.x=" + L.onp.x + " mid=" + (L.chead.x + L.chead.w / 2));
        check(t + ": no horizontal page overflow", L.docW <= L.vw + 1, "docW=" + L.docW + " vw=" + L.vw);
      } else {
        check(t + ": wrapper stays display:contents (no phone stacking)",
          L.ctlsDisplay === "contents", L.ctlsDisplay);
        check(t + ": boxes share one row, Combine left of One Nation",
          Math.abs(L.comb.cy - L.onp.cy) <= 4 && L.comb.x < L.onp.x,
          "comb.cy=" + L.comb.cy + " onp.cy=" + L.onp.cy + " comb.x=" + L.comb.x + " onp.x=" + L.onp.x);
        check(t + ": boxes still ride the chart's name row",
          Math.abs(L.comb.cy - L.title.cy) <= 8, "comb.cy=" + L.comb.cy + " title.cy=" + L.title.cy);
        check(t + ": no horizontal page overflow", L.docW <= L.vw + 1, "docW=" + L.docW + " vw=" + L.vw);
      }
      await page.close();
    }

    /* --- the theme contract: the drawn box's VARIABLES follow body.dark,
       not the OS. Emulate a dark device; auto mode should put .dark on the
       body, so the ticked fill goes LIGHT and the tick cutout goes dark.
       Then force the light theme the way the user's toggle does (the class
       comes) and the pair must invert while the device still says dark. */
    {
      const page = await browser.newPage();
      const pageErrors = [];
      page.on("pageerror", (e) => pageErrors.push(String(e)));
      await page.setViewport({ width: 390, height: 844, hasTouch: true });
      await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "dark" }]);
      await page.goto(`http://127.0.0.1:${PORT}/cycles/`, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForSelector("#cyc-primary .rd-cyc-ctls input", { timeout: 45000 });
      await new Promise((r) => setTimeout(r, 1200));
      let F = await page.evaluate(readFace);
      check("theme: a dark device in auto mode puts .dark on the body",
        F.darkClass === true, JSON.stringify(F));
      check("theme: body pins the dark scheme for native controls",
        F.bodyCs === "dark", "color-scheme=" + F.bodyCs);
      check("theme: the box is drawn, not native (appearance off, transparent rest face)",
        F.appearance === "none" && /^rgba\(0, 0, 0, 0\)|^transparent/.test(F.face),
        "appearance=" + F.appearance + " face=" + F.face);
      check("theme: the ticked fill paints light on the dark theme",
        F.fillL != null && F.fillL >= 0.6, "fill=" + F.fill + " L=" + F.fillL);
      check("theme: the ticked ring merges into its fill",
        F.fillEdge === F.fill, "edge=" + F.fillEdge + " fill=" + F.fill);
      check("theme: the tick is cut from the dark page background",
        F.hasTick && F.tickL != null && F.tickL < 0.5, "tick=" + F.tick + " L=" + F.tickL + " mask=" + F.hasTick);

      await page.evaluate(() => document.body.classList.remove("dark"));
      await new Promise((r) => setTimeout(r, 600));
      F = await page.evaluate(readFace);
      check("theme: forcing the light theme takes .dark off the body",
        F.darkClass === false, JSON.stringify(F));
      check("theme: body pins the light scheme for native controls",
        F.bodyCs === "light", "color-scheme=" + F.bodyCs);
      check("theme: the ticked fill paints dark on the light theme (dark device or not)",
        F.fillL != null && F.fillL < 0.5, "fill=" + F.fill + " L=" + F.fillL);
      check("theme: the tick is cut from the light page background",
        F.hasTick && F.tickL != null && F.tickL > 0.6, "tick=" + F.tick + " L=" + F.tickL);
      check("theme: no page exceptions", pageErrors.length === 0, pageErrors[0] || "");
      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  console.log(fails ? "\n" + fails + " FAILURES" : "\nALL PASS");
  process.exit(fails ? 1 : 0);
})();
