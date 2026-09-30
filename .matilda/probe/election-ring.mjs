/* election-ring-probe.mjs — the election-result ring checks:
   HERO (section.rd-tpp), on the "All" range:
   1. The 2025-election ring on "Labor v Coalition" is stroked the MAIN
      series line's colour (var(--lnp) resolved), not the default --ink.
   2. The same ring shows on "Labor v One Nation", in the OTHER (v Coalition)
      line's colour there too.
   3. Hovering the election month gives guide-tooltip swatches with the
      is-ring class (ring icon) and no plain squares; hovering any later
      month gives plain squares again.
   PRIMARY (#primary-vote), on the "All" range:
   4. The five per-party election rings carry distinct (party) colours.
   5. Hovering the election month: five is-ring swatches, each bordered in
      its row's party colour; hovering a later month: plain squares.

   Serves the repo on an ephemeral port; headless Chrome via puppeteer-core. */
import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CHROME = process.env.CHROME
  || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
if (!fs.existsSync(CHROME)) { console.error("no Chrome at " + CHROME); process.exit(1); }
const require = createRequire(import.meta.url);
const puppeteer = require.resolve("puppeteer-core")
  ? require("puppeteer-core") : require("/Users/joshuaborgnolo/auspol tracker/node_modules/puppeteer-core");

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split("?")[0]));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": MIME[path.extname(p)] || "text/plain" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new" });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 1400 });
page.on("pageerror", (e) => console.error("[pageerror]", e.message));
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "networkidle0", timeout: 60000 });
await page.waitForSelector("section.rd-tpp", { timeout: 30000 });

let fails = 0;
const check = (name, ok, detail) => {
  console.log((ok ? "  ok  " : " FAIL ") + name + (detail ? "  — " + detail : ""));
  if (!ok) fails++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* matchups: Coalition main view, then One Nation main view */
const heroGoto = async (chipText, rival) => {
  for (let i = 0; i < 3; i++) {
    const cur = await page.evaluate(() =>
      (document.querySelector("section.rd-tpp .rd-tpp-side.rd-b .rd-tpp-name") || {}).textContent || "");
    if (cur.includes(rival)) return true;
    await page.evaluate((t) => {
      const b = [...document.querySelectorAll("section.rd-tpp button.rd-chip")]
        .find((x) => x.textContent.includes(t));
      if (b) b.click();
    }, chipText);
    await sleep(900);
  }
  return false;
};

/* every range tab group to "All" so the 2025-05 election x is in view */
await page.evaluate(() => {
  [...document.querySelectorAll(".rd-tabs button")]
    .filter((b) => /^all$/i.test(b.textContent.trim()))
    .forEach((b) => b.click());
});
await sleep(800);

/* mouse coordinates are viewport-relative: pull each chart into view first */
const scrollTo = (secSel) => page.evaluate((sel) => {
  const sec = document.querySelector(sel);
  if (sec) sec.scrollIntoView({ block: "center" });
}, secSel).then(() => sleep(250));

const readHero = () => page.evaluate(() => {
  const sec = document.querySelector("section.rd-tpp");
  const inkProbe = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  inkProbe.style.stroke = "var(--ink)";
  sec.querySelector("svg").appendChild(inkProbe);
  const ink = getComputedStyle(inkProbe).stroke;
  inkProbe.remove();
  const rings = [...sec.querySelectorAll("circle.rd-ring")].map((c) => {
    const r = c.getBoundingClientRect();
    return { stroke: getComputedStyle(c).stroke, cx: r.x + r.width / 2, cy: r.y + r.height / 2 };
  }).filter((r) => r.cx > 0 || r.cy > 0);
  const lineStroke = (id) => {
    const p = sec.querySelector('path.series-line[data-series="' + id + '"]');
    return p ? getComputedStyle(p).stroke : null;
  };
  return { ink, rings, main: lineStroke("main"), other: lineStroke("other") };
});

/* hover helpers: aim at the ring; if a scatter dot steals the tip, sidestep */
const hoverAt = async (x, y) => { await page.mouse.move(x, y); await sleep(180); };
const readTip = (secSel) => page.evaluate((sel) => {
  const sec = document.querySelector(sel);
  const tip = sec ? sec.querySelector(".tip.tip-guide") : null;
  if (!tip) return { kind: "none" };
  const rows = [...tip.querySelectorAll(".tip-row")].map((r) => {
    const sw = r.querySelector(".tip-swatch");
    return {
      label: (r.querySelector(".tip-label") || {}).textContent || "",
      val: (r.querySelector(".tip-val") || {}).textContent || "",
      ring: sw ? sw.classList.contains("is-ring") : false,
      border: sw ? getComputedStyle(sw).borderTopColor : null,
    };
  });
  return {
    kind: "guide",
    text: tip.textContent,
    nSwatch: rows.filter((r) => r.border).length,
    nRing: rows.filter((r) => r.ring).length,
    borders: rows.filter((r) => r.border).map((r) => r.border),
  };
}, secSel);

const hoverElection = async (secSel, pt) => {
  for (const off of [[0, 0], [0, -46], [0, 46], [3, -80]]) {
    await hoverAt(pt.cx + off[0], pt.cy + off[1]);
    const t = await readTip(secSel);
    if (t.kind === "guide") return t;
  }
  return { kind: "none" };
};

/* --- hero: Labor v Coalition --- */
check("hero reached Labor v Coalition", await heroGoto("Labor v Coalition", "Coalition"));
await sleep(400);
await scrollTo("section.rd-tpp");
const h1 = await readHero();
check("hero: one election ring", h1.rings.length === 1, h1.rings.length + " ring(s)");
check("hero: main line stroke resolved", !!h1.main, JSON.stringify(h1));
if (h1.rings.length && h1.main) {
  check("hero ring is the main line's colour", h1.rings[0].stroke === h1.main,
    "ring " + h1.rings[0].stroke + " vs line " + h1.main);
  check("hero ring is not --ink black", h1.rings[0].stroke !== h1.ink,
    "both " + h1.rings[0].stroke);
  const t = await hoverElection("section.rd-tpp", h1.rings[0]);
  check("hero election hover: guide tip", t.kind === "guide", JSON.stringify(t).slice(0, 200));
  check("hero election hover: every swatch is a ring", t.nSwatch > 0 && t.nSwatch === t.nRing,
    t.nRing + "/" + t.nSwatch + " ring swatches " + JSON.stringify(t.borders));
  check("hero election hover: ring swatch in line colour", t.borders && t.borders[0] === h1.main,
    JSON.stringify(t.borders));
  check("hero election hover: tip names the election", t.text && /election result/i.test(t.text));
}

/* --- hero: hover a recent month → plain squares --- */
const box = await page.evaluate(() => {
  const r = document.querySelector("section.rd-tpp svg").getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height };
});
await hoverAt(box.x + box.w - 40, box.y + box.h / 2);
const tRecent = await readTip("section.rd-tpp");
check("hero recent month: tip shown", tRecent.kind === "guide", JSON.stringify(tRecent).slice(0, 160));
check("hero recent month: plain square swatches", tRecent.nSwatch > 0 && tRecent.nRing === 0,
  tRecent.nRing + "/" + tRecent.nSwatch + " ring swatches");

/* --- hero: Labor v One Nation keeps the ring in the Coalition line colour --- */
check("hero reached Labor v One Nation", await heroGoto("Labor v One Nation", "One Nation"));
await sleep(400);
const h2 = await readHero();
check("hero (ON view): one election ring", h2.rings.length === 1, h2.rings.length + " ring(s)");
if (h2.rings.length && h2.other) {
  check("hero (ON view) ring in Coalition line colour", h2.rings[0].stroke === h2.other,
    "ring " + h2.rings[0].stroke + " vs other line " + h2.other);
}

/* --- primary vote panel --- */
await scrollTo("#primary-vote");
const prim = await page.evaluate(() => {
  const sec = document.getElementById("primary-vote");
  if (!sec) return { found: false };
  const rings = [...sec.querySelectorAll("circle.rd-ring")].map((c) => {
    const r = c.getBoundingClientRect();
    return { stroke: getComputedStyle(c).stroke, cx: r.x + r.width / 2, cy: r.y + r.height / 2 };
  }).filter((r) => r.cx > 0 || r.cy > 0);
  return { found: true, rings };
});
check("primary: election rings drawn", prim.found && prim.rings.length >= 5,
  prim.rings ? prim.rings.length + " ring(s)" : "section missing");
if (prim.found && prim.rings.length) {
  const strokes = [...new Set(prim.rings.map((r) => r.stroke))];
  check("primary: rings carry per-party colours", strokes.length >= 4,
    strokes.length + " distinct: " + strokes.join(", "));
  const t = await hoverElection("#primary-vote", prim.rings[0]);
  check("primary election hover: guide tip", t.kind === "guide", JSON.stringify(t).slice(0, 200));
  check("primary election hover: every swatch is a ring", t.nSwatch >= 5 && t.nSwatch === t.nRing,
    t.nRing + "/" + t.nSwatch + " ring swatches " + JSON.stringify(t.borders));
  check("primary election hover: rings in per-party colours",
    t.borders && new Set(t.borders).size >= 4, JSON.stringify(t.borders));
  const pbox = await page.evaluate(() => {
    const r = document.querySelector("#primary-vote svg").getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
  await hoverAt(pbox.x + pbox.w - 40, pbox.y + pbox.h / 2);
  const tp = await readTip("#primary-vote");
  check("primary recent month: tip shown", tp.kind === "guide", JSON.stringify(tp).slice(0, 160));
  check("primary recent month: plain square swatches", tp.nSwatch > 0 && tp.nRing === 0,
    tp.nRing + "/" + tp.nSwatch + " ring swatches");
}

await browser.close();
server.close();
console.log(fails ? "\n" + fails + " check(s) FAILED" : "\nall checks passed");
process.exit(fails ? 1 : 0);
