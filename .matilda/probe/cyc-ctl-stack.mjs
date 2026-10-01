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
   Plus the theme contract: native controls answer to the resolved
   color-scheme, and body/body.dark now pin it to the site's OWN theme
   class - emulate a dark OS, the auto theme goes .dark and the unchecked
   box paints dark; force the light theme and the box goes light even
   though the device still says dark. */
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
    if (p === "/") p = "/index.html";
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

/* the native checkbox answers to the resolved color-scheme: body pins it
   light, body.dark pins it dark, so the site's own theme toggle (not the
   device) decides how the box paints. Chrome's computed background-color
   for a native checkbox is transparent both ways (the control face is
   painted natively), so the rendered outcome is sampled as PIXELS: shot
   the box's centre and decode it back through the page's own canvas */
const readScheme = () => {
  const bodyCs = getComputedStyle(document.body).colorScheme;
  const inp = document.querySelector("#cyc-primary .rd-cyc-ctls input");
  inp.scrollIntoView({ block: "center" });
  const r = inp.getBoundingClientRect();
  return { darkClass: document.body.classList.contains("dark"), bodyCs,
    cx: r.x + r.width / 2, cy: r.y + r.height / 2, w: r.width, h: r.height };
};
const faceCentrePx = async (page, S) => {
  const clip = { x: Math.max(0, S.cx - 4), y: Math.max(0, S.cy - 4), width: 8, height: 8 };
  const offX = S.cx - clip.x, offY = S.cy - clip.y;
  const buf = await page.screenshot({ clip });
  return page.evaluate(async (b64, offX, offY) => {
    const img = new Image();
    img.src = "data:image/png;base64," + b64;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width; c.height = img.height;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(Math.round(offX), Math.round(offY), 1, 1).data;
    const lum = +((0.2126 * d[0] + 0.7152 * d[1] + 0.0722 * d[2]) / 255).toFixed(3);
    return { rgb: [d[0], d[1], d[2]].join(","), lum };
  }, buf.toString("base64"), offX, offY);
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
      await page.goto(`http://127.0.0.1:${PORT}/#cycles`, { waitUntil: "domcontentloaded", timeout: 60000 });
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
        check(t + ": the phone rows are squeezed (no line-height slack)",
          L.comb.h <= 17 && L.onp.h <= 17,
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

    /* --- the theme contract: native controls follow body.dark, not the OS.
       Emulate a dark device; the auto theme should put .dark on the body and
       the unchecked box should paint dark. Then force the light theme the
       way the user's toggle does (the class comes off) and the box must go
       light while the device still says dark. */
    {
      const page = await browser.newPage();
      const pageErrors = [];
      page.on("pageerror", (e) => pageErrors.push(String(e)));
      await page.setViewport({ width: 390, height: 844, hasTouch: true });
      await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "dark" }]);
      await page.goto(`http://127.0.0.1:${PORT}/#cycles`, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForSelector("#cyc-primary .rd-cyc-ctls input", { timeout: 45000 });
      await new Promise((r) => setTimeout(r, 1200));
      let S = await page.evaluate(readScheme);
      let px = await faceCentrePx(page, S);
      check("theme: a dark device in auto mode puts .dark on the body",
        S.darkClass === true, JSON.stringify(S));
      check("theme: body pins the dark scheme for native controls",
        S.bodyCs === "dark", "color-scheme=" + S.bodyCs);
      check("theme: the unchecked box paints dark on the dark theme",
        px.lum < 0.5, "face rgb=" + px.rgb + " lum=" + px.lum);

      await page.evaluate(() => document.body.classList.remove("dark"));
      await new Promise((r) => setTimeout(r, 600));
      S = await page.evaluate(readScheme);
      px = await faceCentrePx(page, S);
      check("theme: forcing the light theme takes .dark off the body",
        S.darkClass === false, JSON.stringify(S));
      check("theme: body pins the light scheme for native controls",
        S.bodyCs === "light", "color-scheme=" + S.bodyCs);
      check("theme: the unchecked box paints light on the light theme (dark device or not)",
        px.lum > 0.6, "face rgb=" + px.rgb + " lum=" + px.lum);
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
