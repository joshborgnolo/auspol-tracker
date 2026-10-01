import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const PORT = 8963;
const MIME = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".css": "text/css", ".woff2": "font/woff2" };
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p === "/") p = "/index.html";
    res.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" });
    res.end(await readFile(join(ROOT, p)));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(PORT, r));

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new" });

const fails = [];
const ok = (name, cond) => { console.log((cond ? "PASS " : "FAIL ") + name); if (!cond) fails.push(name); };

async function probe(view, label, fromHash) {
  const page = await browser.newPage();
  await page.setViewport(view);
  page.on("pageerror", (e) => { console.log("PAGEERROR", String(e).slice(0, 200)); fails.push(label + " pageerror"); });
  await page.goto("http://127.0.0.1:" + PORT + "/" + fromHash, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".site-head", { timeout: 45000 });
  await page.waitForSelector(".tabs .tab", { timeout: 45000 });
  await new Promise((r) => setTimeout(r, 1200));

  const pre = await page.evaluate(() => ({ iw: window.innerWidth, sw: document.documentElement.scrollWidth, sy: window.scrollY, sx: window.scrollX }));
  console.log(label + " before click: innerWidth=" + pre.iw + " scrollWidth=" + pre.sw + " scrollY=" + pre.sy + " scrollX=" + pre.sx);

  /* arm a sampler before the click: [t, scrollY, scrollX, scrollWidth] per rAF */
  await page.evaluate((iw0) => {
    window.__tracks = [];
    window.__wide = [];
    window.__gauge = [];
    const t0 = performance.now();
    const tick = () => {
      const sw = document.documentElement.scrollWidth;
      const t = Math.round(performance.now() - t0);
      window.__tracks.push([t, Math.round(window.scrollY * 10) / 10, window.scrollX, sw, window.innerWidth]);
      const g = document.querySelector(".rd-lg");
      if (g && window.__gauge.length < 200) {
        const dot = g.querySelector(".rd-lg-dot");
        let hidden = null;
        for (let n = g.parentElement; n && !hidden; n = n.parentElement) {
          const cs = getComputedStyle(n);
          if (cs.display === "none" || cs.visibility === "hidden") hidden = n.tagName + "." + (n.className && n.className.slice ? n.className : "");
        }
        window.__gauge.push([t, Math.round(g.getBoundingClientRect().width), Math.round(g.parentElement ? g.parentElement.getBoundingClientRect().width : -1), dot ? Math.round(parseFloat(dot.style.left || "0")) : -1, hidden || ""]);
      }
      if (sw > iw0 + 1 && window.__wide.length === 0) {
        for (const el of document.querySelectorAll("body *")) {
          const r = el.getBoundingClientRect();
          if (r.width > iw0 + 1 || r.right > iw0 + 1) {
            window.__wide.push({ tag: el.tagName, cls: (el.className && el.className.slice ? el.className : "").toString().slice(0, 80), w: Math.round(r.width), right: Math.round(r.right) });
          }
          if (window.__wide.length >= 14) break;
        }
      }
      if (performance.now() - t0 < 2600) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, pre.iw);

  /* click the Snapshot tab */
  await page.evaluate(() => {
    const b = [...document.querySelectorAll(".tabs .tab")].find((n) => n.textContent.trim().startsWith("Now"));
    if (b) b.click();
  });
  await new Promise((r) => setTimeout(r, 2900));

  const res = await page.evaluate(() => {
    const t = window.__tracks;
    const final = t[t.length - 1] || [0, 0, 0, 0, 0];
    return {
      tracks: t,
      wide: window.__wide || [],
      gauge: window.__gauge || [],
      finalSy: final[1], finalSx: final[2], finalSw: final[3], finalIw: final[4],
    };
  });
  if (label.startsWith("phone")) {
    console.log("   gauge [t, gw, parentW, dotLeft, hiddenAncestor] (first 10):");
    for (const g of res.gauge.slice(0, 10)) console.log("     " + JSON.stringify(g));
  }
  const iw0 = pre.iw;
  const maxSw = Math.max(...res.tracks.map((r) => r[3]));
  const maxSx = Math.max(...res.tracks.map((r) => r[2]));
  const overflowFrames = res.tracks.filter((r) => r[3] > iw0 + 1).length;
  const panFrames = res.tracks.filter((r) => r[2] > 0).length;
  ok(label + ": document never grows wider than the " + iw0 + "px viewport", maxSw <= iw0 + 1);
  if (maxSw > iw0 + 1) {
    console.log("   width over " + iw0 + "px in " + overflowFrames + "/" + res.tracks.length + " frames; peak scrollWidth=" + maxSw);
    const firstBad = res.tracks.findIndex((r) => r[3] > iw0 + 1);
    for (let i = Math.max(0, firstBad - 6); i <= Math.min(res.tracks.length - 1, firstBad + overflowFrames + 6); i++) {
      console.log("   track[" + i + "] t=" + res.tracks[i][0] + " scrollY=" + res.tracks[i][1] + " scrollX=" + res.tracks[i][2] + " scrollWidth=" + res.tracks[i][3] + " innerWidth=" + res.tracks[i][4]);
    }
    console.log("   wide DURING overflow:", JSON.stringify(res.wide, null, 1));
  }
  ok(label + ": page never pans right (scrollX stays 0)", maxSx === 0);
  if (maxSx > 0) console.log("   sideways-pan frames: " + panFrames + "; peak scrollX=" + maxSx);

  /* bounce signature of scrollY: after the click, scrollY should fall
     toward 0 and STAY; an upward re-rise = the bounce the user felt */
  const ys = res.tracks.map((r) => r[1]);
  let peakAfterZero = 0;
  for (let i = 1; i < ys.length; i++) if (ys[i] < 1 && ys.slice(i).some((y) => y > 1)) peakAfterZero = Math.max(peakAfterZero, ...ys.slice(i));
  ok(label + ": scroll settles at top without re-descending (bounce ≤ 2px)", peakAfterZero <= 2);
  if (peakAfterZero > 2) console.log("   scrollY re-rose to " + peakAfterZero + "px after first touching 0");

  /* if it overflowed, name the widest elements */
  if (maxSw > iw0 + 1 || maxSx > 0) {
    const wide = await page.evaluate((iw) => {
      const out = [];
      for (const el of document.querySelectorAll("body *")) {
        const r = el.getBoundingClientRect();
        if (r.width > iw + 1 || r.right > iw + 1) {
          out.push({ tag: el.tagName, cls: (el.className && el.className.slice ? el.className : "").toString().slice(0, 60), w: Math.round(r.width), right: Math.round(r.right) });
        }
        if (out.length >= 12) break;
      }
      return out;
    }, iw0);
    console.log("   wide elements:", JSON.stringify(wide, null, 1));
  }
  console.log("   final: scrollY=" + res.finalSy + " scrollX=" + res.finalSx + " scrollWidth=" + res.finalSw + " innerWidth=" + res.finalIw);
  await page.close();
  return res;
}

/* from the deep end of another tab back to Snapshot, the click a reader makes */
const PHONE = { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };
const LAPTOP = { width: 1280, height: 900 };
await probe(PHONE, "phone from allpolls", "#allpolls");
await probe(PHONE, "phone from cycles", "#cycles");
await probe(LAPTOP, "laptop from allpolls", "#allpolls");

await browser.close();
server.close();
console.log(fails.length ? "FAILED: " + fails.join("; ") : "ALL GREEN");
process.exit(fails.length ? 1 : 0);
