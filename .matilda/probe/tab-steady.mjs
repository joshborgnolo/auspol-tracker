// Tab-steady probe: every control that bolds its chosen option (RdTabs rows,
// the main tab row, the Who-votes and issues chips, the All-polls pinned
// facet tabs and split picker) holds every option's left edge and width
// through a full walk of its options - RdTabW's hidden bold twin (rd.jsx),
// user call 2026-10-04 after the latest-polls facets and the split picker
// nudged their neighbours on each pick. Serves the built site from the repo
// root; fails on any drift over 0.25px. Run: node .matilda/probe/tab-steady.mjs
import { createRequire } from "node:module";
import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
const require = createRequire(join(process.cwd(), "package.json"));
const puppeteer = require("puppeteer-core");
const ROOT = process.env.ROOT || fileURLToPath(new URL("../..", import.meta.url));
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".woff2": "font/woff2", ".png": "image/png", ".svg": "image/svg+xml" };
const server = http.createServer(async (req, res) => {
  try { let p = decodeURIComponent(new URL(req.url, "http://x").pathname); if (p === "/") p = "/index.html";
    res.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" }); res.end(await readFile(join(ROOT, p)));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(Number(process.env.PORT || 9233), r));
const BASE = `http://127.0.0.1:${process.env.PORT || 9233}/index.html`;
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// groups: [label, page hash/query, group selector, option selector within group]
const GROUPS = [
  ["main nav", "#now", ".tabs-set", ".tab"],
  ["All polls facets", "#allpolls", ".rd-ap-tabs > [role=group]", "button"],
  ["Latest polls facets", "#now", ".rd-pl-tabs [role=group]", "button"],
  ["Who votes groups", "#now", "#who-votes .rd-wv-tabs [role=group]", "button"],
  ["Who votes parties", "#now", "#who-votes .rd-wv-parties, #who-votes [aria-label*=arty]", "button"],
  ["Leadership metric", "#now", ".rd-ld-panel .rd-tabs [role=group]", "button"],
  ["Issues groups", "#now|whom", ".rd-iw-tabs [role=group]", "button"],
  ["Issues chips", "#now|whom", ".rd-iw-chips", "button"],
  ["Issues views", "#now", "#issues .rd-tabs [role=group]", "button"],
  ["Pinned facets", "#allpolls|pin", ".rd-ap-pintabs", "button"],
  ["Undecided views", "#now", "#undecided .rd-tabs [role=group], .rd-und .rd-tabs [role=group]", "button"],
  ["House lean tabs", "#allpolls", ".rd-hl-tabs [role=group]", "button"],
  ["Disagree tabs", "#allpolls", ".rd-dis-tabs [role=group]", "button"],
  ["Split by (dem)", "?f=g#allpolls", ".rd-ap-dpick [role=radiogroup]", "button"],
  ["Hero range", "#now", ".rd-tpp-chart .rd-tabs [role=group]", "button"],
];
const results = [];
for (const vw of (process.env.W || "1440,390,320").split(",").map(Number)) {
  const ph = vw < 700;
  const page = await browser.newPage();
  await page.setViewport({ width: vw, height: 900, isMobile: ph, hasTouch: ph });
  for (const [label, where, gsel, osel] of GROUPS) {
    const [loc, pre] = where.split("|");
    await page.goto(BASE + loc, { waitUntil: "load" });
    await sleep(1400);
    if (pre === "whom") {
      await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((n) => n.textContent.trim() === "What matters to whom"); if (b) { b.scrollIntoView({ block: "center" }); b.click(); } });
      await sleep(900);
    }
    if (pre === "pin") {
      // scroll deep into the table so the pinned bar shows its facet tabs
      await page.evaluate(() => { const t = document.querySelector(".rd-ap-table"); window.scrollTo(0, t.getBoundingClientRect().top + scrollY + 900); });
      await sleep(900);
    }
    const n = await page.evaluate((gsel, osel) => { const g = document.querySelector(gsel); return g ? g.querySelectorAll(osel).length : 0; }, gsel, osel);
    if (n < 2) { results.push([vw, label, "absent"]); continue; }
    let worst = 0, worstW = 0, base = null;
    for (let i = 0; i < n; i++) {
      await page.evaluate((gsel, osel, i) => {
        const g = document.querySelector(gsel); const b = g.querySelectorAll(osel)[i];
        b.scrollIntoView({ block: "center", behavior: "instant" });
        b.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      }, gsel, osel, i);
      await sleep(700);
      const pos = await page.evaluate((gsel, osel) => {
        const g = document.querySelector(gsel); if (!g) return null;
        const g0 = g.getBoundingClientRect();
        return [...g.querySelectorAll(osel)].map((b) => { const r = b.getBoundingClientRect(); return [+(r.left - g0.left + g.scrollLeft).toFixed(2), +r.width.toFixed(2)]; });
      }, gsel, osel);
      if (!pos) continue;
      if (!base) base = pos;
      else pos.forEach(([x, w], k) => { if (base[k]) { worst = Math.max(worst, Math.abs(x - base[k][0])); worstW = Math.max(worstW, Math.abs(w - base[k][1])); } });
    }
    results.push([vw, label, `n=${n} max x drift ${worst.toFixed(2)}px, width ${worstW.toFixed(2)}px`, worst > 0.25 || worstW > 0.25]);
  }
  await page.close();
}
let bad = 0;
results.forEach(([vw, label, msg, fail]) => { if (fail) bad++; console.log(`${fail ? "FAIL" : msg === "absent" ? "skip" : "ok  "}  ${vw} ${label}: ${msg}`); });
await browser.close(); server.close();
console.log(bad ? bad + " drifting" : "ALL STEADY");
process.exit(bad ? 1 : 0);
