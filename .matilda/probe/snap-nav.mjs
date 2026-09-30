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
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new",
});
const page = await browser.newPage();

const check = (w, h) => page.setViewport({ width: w, height: h }).then(() => page.evaluate(() => {
  const nav = document.querySelector(".rd-snap-nav");
  const eb = document.querySelector("#two-party .rd-eyebrow");
  const title = document.querySelector("#rd-tpp-t");
  if (!eb || !title) return { eyebrow: false };
  const out = {
    w: window.innerWidth,
    inDom: !!nav,
    hScroll: document.documentElement.scrollWidth > window.innerWidth,
  };
  if (nav) {
    const n = nav.getBoundingClientRect();
    const t = title.getBoundingClientRect();
    const e = eb.getBoundingClientRect();
    out.labels = [...nav.querySelectorAll("button")].map((b) => ({ t: b.textContent, on: getComputedStyle(b).display !== "none" })).filter((b) => b.on).map((b) => b.t);
    out.display = getComputedStyle(nav).display;
    out.oneLine = e.height < 34;
    out.within = n.right <= e.right + 2 && n.top >= e.top - 2 && n.bottom <= e.bottom + 2;
    out.navRight = Math.round(n.right); out.ebRight = Math.round(e.right);
    out.ebHeight = Math.round(e.height);
  }
  return out;
}).then(async (r) => {
  if (!r.inDom) return r;
  const jump = await page.evaluate(() => new Promise((res) => {
    const btns = [...document.querySelectorAll(".rd-snap-nav button")];
    const b = btns.find((x) => x.textContent === "The issues");
    if (!b) return res({ jump: "no button" });
    b.click();
    setTimeout(() => {
      const el = document.getElementById("issues");
      res({ scrollY: Math.round(window.scrollY), issuesTop: el ? Math.round(el.getBoundingClientRect().top) : null });
    }, 1600);
  }));
  await page.evaluate(() => window.scrollTo(0, 0));
  return { ...r, ...jump };
}));

const results = {};
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("#two-party", { timeout: 15000 });
await new Promise((r) => setTimeout(r, 1200));
for (const [name, w, h] of [["wide1440", 1440, 900], ["edge1280", 1280, 900], ["mid1250", 1250, 900], ["mid1200", 1200, 800], ["lap1170", 1170, 800], ["phone390", 390, 844]]) {
  await page.setViewport({ width: w, height: h });
  await new Promise((r) => setTimeout(r, 350));
  results[name] = await check(w, h);
  await page.evaluate(() => window.scrollTo(0, 0));
}
console.log(JSON.stringify(results, null, 2));

await browser.close();
server.close();
