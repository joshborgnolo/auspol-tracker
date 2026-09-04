/* Poll-breakdown copy: the .poll-copy-btn on an expanded poll row.

   Asserts the wireup and the PNG output of copy-poll.js end to end:

     - expanded Latest/All-polls rows gain exactly one .poll-copy-btn, titled
       for the clipboard (localhost is a secure context, so CAN_COPY is on);
     - clicking it (with clipboard writes force-rejected so the fallbacks all
       fire) delivers a downloaded auspol-breakdown-*.png on both laptop and
       phone viewports;
     - the PNG is the 1200px card at 2x (2400 physical), on BOTH automations
       - the .copy-wide pin re-flows the panel at the desktop ladder even on
       the phone, so the raster does not shrink with the rung;
     - the canvas handed to toBlob contains real painted text (many distinct
       colours), not a blank sheet;
     - after the capture the panel is restored: no leftover .copy-wide class,
       no inline styles on it or its host cell.

   Run from the worktree root:
     NODE_PATH="$HOME/node_modules" node .matilda/verify-copy-poll/probe.mjs */
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
  ".json": "application/json; charset=utf-8", ".woff2": "font/woff2", ".png": "image/png" };
const server = http.createServer((req, res) => {
  let rel = decodeURIComponent(req.url.split("?")[0]);
  if (rel === "/") rel = "/index.html";
  fs.readFile(path.join(ROOT, rel), (err, buf) => {
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(rel)] || "application/octet-stream" });
    res.end(buf);
  });
});
await new Promise((ok) => server.listen(8743, "127.0.0.1", ok));

let failures = 0;
const check = (label, got, want) => {
  if (got === want) { console.log(`  ok   ${label} = ${want}`); return; }
  failures += 1;
  console.log(`  FAIL ${label}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
};
const ok = (label, cond, got) => {
  if (cond) { console.log(`  ok   ${label}`); return; }
  failures += 1;
  console.log(`  FAIL ${label}: got ${JSON.stringify(got)}`);
};

const pngInfo = (file) => {
  const buf = fs.readFileSync(file);
  const magic = buf.slice(0, 8).toString("hex") === "89504e470d0a1a0a";
  const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
  return { magic, w, h, bytes: buf.length };
};

const genTag = () => "g" + Math.random().toString(36).slice(2);
const pngsIn = (dir, tag) => fs.existsSync(dir)
  ? fs.readdirSync(dir).filter((f) => f.startsWith(tag) && f.endsWith(".png")).map((f) => path.join(dir, f))
  : [];

/* capture-time hooks, installed before the page scripts attach: toBlob is
   sampled on a tiny offscreen canvas so a blank sheet fails here rather
   than downstream */
const PRELUDE = (tag) => `
  window.__probeTag = ${JSON.stringify(tag)};
  window.__probePaints = [];
  const ofBlob = HTMLCanvasElement.prototype.toBlob;
  HTMLCanvasElement.prototype.toBlob = function (cb, type, q) {
    try {
      const probe = document.createElement("canvas");
      probe.width = Math.round(this.width / 4);
      probe.height = Math.max(1, Math.round(probe.width * this.height / this.width));
      const pc = probe.getContext("2d");
      pc.drawImage(this, 0, 0, probe.width, probe.height);
      const d = pc.getImageData(0, 0, probe.width, probe.height).data;
      const seen = new Set();
      /* ink bounds, back in physical pixels: the card's chrome is an even
         56-physical-px margin on every side, the panel fills the middle,
         and the site's name signs the bottom right. footX tracks the
         signature on its own: its glyphs sit 62-84 physical px above the
         sheet's bottom edge, inside a 40-120px strip the panel's bottom
         edge (142px up) never enters */
      const ink = { minX: Infinity, minY: Infinity, maxX: -1, maxY: -1 };
      const footTop = probe.height - 30, footBot = probe.height - 10;
      let footX = -1;
      for (let y = 0, i = 0; y < probe.height; y++) {
        const inFoot = y >= footTop && y <= footBot;
        for (let x = 0; x < probe.width; x++, i += 4) {
          const r = d[i], g = d[i + 1], b = d[i + 2], a = d[i + 3];
          if (a > 128 && (r < 245 || g < 245 || b < 245)) {
            if (x < ink.minX) ink.minX = x;
            if (x > ink.maxX) ink.maxX = x;
            if (y < ink.minY) ink.minY = y;
            if (y > ink.maxY) ink.maxY = y;
            if (inFoot && x > footX) footX = x;
          }
          seen.add(((r << 24) | (g << 16) | (b << 8) | a) >>> 0);
        }
      }
      window.__probePaints.push({ w: this.width, h: this.height, colors: seen.size,
        footX: footX * 4,
        ink: { minX: ink.minX * 4, maxX: ink.maxX * 4, minY: ink.minY * 4, maxY: ink.maxY * 4 } });
    } catch (e) { window.__probePaints.push({ error: String(e) }); }
    return ofBlob.call(this, cb, type, q);
  };
  if (navigator.clipboard && navigator.clipboard.write) {
    const w = navigator.clipboard.write.bind(navigator.clipboard);
    navigator.clipboard.__origWrite = w;
    navigator.clipboard.write = () => Promise.reject(new Error("probe: force download fallback"));
  }
  /* the Fieldwork row is re-titled "Poll: house, fieldwork" and put back
     inside the capture's own synchronous block - the nodes involved are
     long detached by the time anything async could look. MutationRecords
     still carry the facts: node identity gets a WeakMap id so a removal
     can be paired with the identical node's later return */
  window.__probeRetitle = [];
  window.__probeIds = new WeakMap();
  let probeSeq = 0;
  const probeId = (n) => {
    let i = window.__probeIds.get(n);
    if (!i) { i = ++probeSeq; window.__probeIds.set(n, i); }
    return i;
  };
  new MutationObserver((ms) => {
    for (const m of ms) {
      const band = !!(m.target.classList && m.target.classList.contains("pd-meta-items"));
      for (const n of m.addedNodes) {
        if (n.nodeType !== 1 || !n.classList.contains("pd-meta-i")) continue;
        window.__probeRetitle.push({ ev: "add", id: probeId(n), band,
          first: m.previousSibling === null,
          k: ((n.querySelector(".pd-meta-k") || {}).textContent || "").trim(),
          v: ((n.querySelector(".pd-meta-v") || {}).textContent || "").replace(/\\s+/g, " ").trim() });
      }
      for (const n of m.removedNodes) {
        if (n.nodeType !== 1 || !n.classList.contains("pd-meta-i")) continue;
        window.__probeRetitle.push({ ev: "remove", id: probeId(n), band,
          k: ((n.querySelector(".pd-meta-k") || {}).textContent || "").trim() });
      }
    }
  }).observe(document, { childList: true, subtree: true });
`;
/* downloads are tagged so parallel pages can't claim each other's files */
const tagDownloads = (tag) => `
  const ofClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (this.download && this.download.startsWith("auspol-breakdown-")) {
      this.download = window.__probeTag + "-" + this.download;
    }
    return ofClick.call(this);
  };
`;

const waitFile = (dir, tag, ms = 20000) => new Promise((resolve, reject) => {
  const t0 = Date.now();
  const tick = () => {
    const hit = pngsIn(dir, tag).find((f) => pngInfo(f).magic);
    if (hit) return resolve(hit);
    if (Date.now() - t0 > ms) return reject(new Error("no breakdown PNG downloaded within " + ms + "ms"));
    setTimeout(tick, 120);
  };
  tick();
});

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new" });
try {
  /* ---------- laptop: Latest-polls row ---------- */
  const dl1 = fs.mkdtempSync(path.join(os.tmpdir(), "copypoll-desk-"));
  const tag1 = genTag();
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    page.on("pageerror", (e) => console.error("[page]", e.message));
    await page.evaluateOnNewDocument(PRELUDE(tag1));
    await page.goto("http://127.0.0.1:8743/", { waitUntil: "networkidle0", timeout: 60000 });
    await page.evaluate(tagDownloads(tag1));
    const cdp = await page.createCDPSession();
    await cdp.send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: dl1 });

    console.log("laptop, Latest table:");
    await page.waitForSelector(".exp-btn", { timeout: 30000 });
    await page.click(".exp-btn");
    await page.waitForSelector(".poll-detail", { timeout: 15000 });
    await new Promise((r) => setTimeout(r, 300));
    const wired = await page.evaluate(`(() => {
      const btn = document.querySelector(".poll-detail > .poll-copy-btn");
      return btn ? { title: btn.title, n: document.querySelectorAll(".poll-copy-btn").length } : null;
    })()`);
    ok("copy button attached inside the open panel", !!wired, wired);
    if (wired) {
      check("button title (secure context)", wired.title, "Copy breakdown as image");
      check("exactly one copy button", wired.n, 1);
    }
    await page.click(".poll-detail > .poll-copy-btn");
    /* the widen/measure/restore block is synchronous inside the click, so
       the panel is back in place by the time the event has dispatched.
       Check the properties the copy took out, property by property: a
       whole-attribute comparison catches whatever OTHER inline styles the
       app itself cycles (it can leave an empty style="" alive, which says
       nothing about the copy) */
    const restored = await page.evaluate(`(() => {
      const p = document.querySelector(".poll-detail");
      const td = p.parentElement;
      const ps = p.style, hs = td.style;
      return { copyWide: p.classList.contains("copy-wide"),
               panelUnpinned: [ps.position, ps.top, ps.left, ps.width].every((v) => !v),
               hostUnpinned: [hs.height, hs.overflow].every((v) => !v) };
    })()`);
    check("panel restored (no copy-wide class)", restored.copyWide, false);
    check("panel park styles cleared", restored.panelUnpinned, true);
    check("host cell pin cleared", restored.hostUnpinned, true);
    const file = await waitFile(dl1, tag1);
    const info = pngInfo(file);
    check("PNG width is the 1200px card at 2x", info.w, 2400);
    ok("PNG has panel height (not a stub)", info.h > 600 && info.h < 6000, info.h);
    ok("PNG is not a bare sheet", info.bytes > 100 * 1024, info.bytes);
    const paints = await page.evaluate("window.__probePaints");
    ok("canvas painted many colours", paints.length && paints[paints.length - 1].colors > 6, paints);
    /* the card's chrome: one tight, EVEN margin on all four sides (28
       logical = 56 physical px outward), and one even INSET for the ink:
       the copy-wide pin lets the measure run the content box, so side
       ink = (28 card + 24 panel pad) = 52 logical = 104 physical. The
       footer signature parks DEEPER than the padding line - 80 logical =
       160 physical in from the right edge. The top adds the panel's 28px
       padding band = 112 plus line leading */
    const card = paints[paints.length - 1];
    console.log("  card ink bounds:", JSON.stringify(card.ink), "h =", card.h);
    const inInk = (v) => card.ink && v >= 44 && v <= 84;
    const sideInk = (v) => card.ink && v >= 88 && v <= 120;
    const topInk = (v) => card.ink && v >= 96 && v <= 136;
    const footInk = (v) => card.ink && card.footX > 0 && v >= 150 && v <= 182;
    check("left edge: card margin + panel padding", sideInk(card.ink.minX), true);
    check("right edge: ink keeps the same inset", sideInk(2400 - card.ink.maxX), true);
    check("top edge: card margin + panel padding", topInk(card.ink.minY), true);
    check("footer signature: the deeper 160px right inset", footInk(2400 - card.footX), true);
    check("footer sits one margin above the bottom edge", inInk(card.h - card.ink.maxY), true);
    ok("no ink crosses the card margin", card.ink && card.ink.minX >= 48 && card.ink.minY >= 48 &&
       2400 - card.ink.maxX >= 48 && card.h - card.ink.maxY >= 48, card.ink);
    /* the capture re-titles the band's Fieldwork row into "Poll: ‹house›,
       ‹fieldwork›" at the head of the list, and puts it back verbatim */
    const retitle = await page.evaluate(`(() => {
      const d = document.querySelector(".poll-detail");
      const row = d.closest("tr").previousElementSibling;
      const house = ((row.querySelector(".pollster-name") || {}).textContent || "")
        .replace(/↗/g, "").replace(/\\s+/g, " ").trim();
      let firstK = null, fieldwork = null;
      for (const k of d.querySelectorAll(".pd-meta-k")) {
        const t = (k.textContent || "").trim();
        if (firstK === null) firstK = t;
        if (t === "Fieldwork") {
          fieldwork = ((k.parentElement.querySelector(".pd-meta-v") || {}).textContent || "")
            .replace(/\\s+/g, " ").trim();
        }
      }
      return { house, firstK, fieldwork, rec: window.__probeRetitle };
    })()`);
    check("Fieldwork row is back at the head of the band", retitle.firstK, "Fieldwork");
    const pollAdd = retitle.rec.find((r) => r.ev === "add" && r.k === "Poll");
    ok("a Poll row headed the band during the capture", !!pollAdd, retitle.rec);
    if (pollAdd) {
      check("Poll row sits on the band itself", pollAdd.band, true);
      check("Poll row is first in the band", pollAdd.first, true);
      check("Poll value is house, fieldwork", pollAdd.v, retitle.house + ", " + retitle.fieldwork);
    }
    const fwGone = retitle.rec.find((r) => r.ev === "remove" && r.k === "Fieldwork" && r.band);
    const fwBack = fwGone && retitle.rec.find((r) => r.ev === "add" && r.id === fwGone.id);
    ok("the Fieldwork item left and returned as the same node", !!fwBack,
       fwGone ? { fwGone, fwBack: !!fwBack } : retitle.rec);
    await page.close();
  }

  /* ---------- phone rung: still the desktop card ---------- */
  const dl2 = fs.mkdtempSync(path.join(os.tmpdir(), "copypoll-mob-"));
  const tag2 = genTag();
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, isMobile: true, deviceScaleFactor: 3 });
    page.on("pageerror", (e) => console.error("[page]", e.message));
    await page.evaluateOnNewDocument(PRELUDE(tag2));
    await page.goto("http://127.0.0.1:8743/", { waitUntil: "networkidle0", timeout: 60000 });
    await page.evaluate(tagDownloads(tag2));
    const cdp = await page.createCDPSession();
    await cdp.send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: dl2 });

    console.log("phone (390px), Latest table:");
    await page.waitForSelector(".exp-btn", { timeout: 30000 });
    await page.click(".exp-btn");
    await page.waitForSelector(".poll-detail .poll-copy-btn", { timeout: 15000 });
    await page.click(".poll-detail > .poll-copy-btn");
    const file = await waitFile(dl2, tag2);
    const info = pngInfo(file);
    check("phone copy is STILL the 2400px card, not a phone-width sheet", info.w, 2400);
    ok("phone copy names the poll in its filename",
       path.basename(file).startsWith(tag2 + "-auspol-breakdown-") && path.basename(file).length > 40,
       path.basename(file));
    await page.close();
  }

  /* ---------- All-polls archive renderer (the second detail) ---------- */
  const dl3 = fs.mkdtempSync(path.join(os.tmpdir(), "copypoll-arch-"));
  const tag3 = genTag();
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    page.on("pageerror", (e) => console.error("[page]", e.message));
    await page.evaluateOnNewDocument(PRELUDE(tag3));
    await page.goto("http://127.0.0.1:8743/", { waitUntil: "networkidle0", timeout: 60000 });
    await page.evaluate(tagDownloads(tag3));
    const cdp = await page.createCDPSession();
    await cdp.send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: dl3 });

    console.log("laptop, All-polls table:");
    await page.waitForSelector(".exp-btn", { timeout: 30000 });
    const clickedTab = await page.evaluate(`(() => {
      const b = [...document.querySelectorAll("button, a")].find((x) => /All polls/i.test(x.textContent));
      if (b) { b.click(); return true; }
      return false;
    })()`);
    ok("All-polls tab found and opened", clickedTab, clickedTab);
    await page.waitForSelector(".poll-table.archive", { timeout: 15000 });
    await new Promise((r) => setTimeout(r, 400));
    await page.click(".poll-table.archive .exp-btn");
    await page.waitForSelector(".poll-table.archive .poll-detail", { timeout: 15000 });
    await new Promise((r) => setTimeout(r, 300));
    const arch = await page.evaluate(`(() => {
      const d = document.querySelector(".poll-table.archive .poll-detail");
      const tail = d.querySelector(".pd-meta-tail");
      return { btn: !!d.querySelector(":scope > .poll-copy-btn"), tail: !!tail };
    })()`);
    ok("archive detail carries its own copy button", arch.btn, arch);
    await page.click(".poll-table.archive .poll-detail > .poll-copy-btn");
    const file = await waitFile(dl3, tag3);
    const info = pngInfo(file);
    check("archive copy is the 2400px card", info.w, 2400);
    ok("archive copy is not a bare sheet", info.bytes > 100 * 1024, info.bytes);
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}

if (failures) {
  console.error("\n" + failures + " check(s) failed");
  process.exit(1);
}
console.log("\nall checks passed");
