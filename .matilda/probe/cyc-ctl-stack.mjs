/* cyc-ctl-stack: on a phone the Past-cycles opposition-primary card's two
   One Nation overlay boxes ("Combine L/NP and ON", "One Nation this term")
   leave the name row and stack under it, right-aligned, One Nation's own
   overlay on top. The wrapper is display:contents everywhere else, so the
   desktop row beside the chart's name is untouched (checked at 1440 and
   760 - stacking must stay phone-only). Also: the phone stack must not
   push the page sideways, and the Hanson card's lone box keeps no wrapper. */
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
    ctls: note(ctls.getBoundingClientRect()), ctlsDisplay: getComputedStyle(ctls).display,
    ctlsDir: getComputedStyle(ctls).flexDirection, combText: comb.textContent.trim(), onpText: onp.textContent.trim(),
    hanWrappers, docW: document.documentElement.scrollWidth, vw: window.innerWidth };
})();

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
      if (vw <= 640) {
        check(t + ": wrapper becomes the flex column at phone width",
          L.ctlsDisplay === "flex" && L.ctlsDir === "column-reverse", L.ctlsDisplay + " " + L.ctlsDir);
        check(t + ": One Nation sits fully above Combine (on top of the other)",
          L.onp.bottom <= L.combTop + 1, "onp.bottom=" + L.onp.bottom + " comb.top=" + L.combTop);
        check(t + ": the two boxes are right-aligned with each other",
          Math.abs(L.onp.right - L.comb.right) <= 2, "onp.right=" + L.onp.right + " comb.right=" + L.comb.right);
        check(t + ": the stack reaches the head row's right edge",
          Math.abs(L.comb.right - L.chead.right) <= 2 && Math.abs(L.onp.right - L.chead.right) <= 2,
          "comb.right=" + L.comb.right + " onp.right=" + L.onp.right + " chead.right=" + L.chead.right);
        check(t + ": the stack drops to its own row, under the chart's name",
          L.ctlsTop >= L.titleBottom - 2, "ctls.top=" + L.ctlsTop + " title.bottom=" + L.titleBottom);
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
  } finally {
    await browser.close();
    server.close();
  }
  console.log(fails ? "\n" + fails + " FAILURES" : "\nALL PASS");
  process.exit(fails ? 1 : 0);
})();
