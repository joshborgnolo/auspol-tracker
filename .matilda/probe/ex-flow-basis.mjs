/* probe (force-added over the .matilda ignore, as every committed probe
   is): the flow-history basis marks — hollow ring = classic-seats basis,
   solid disc = all-seats — land on the right views of /flows-explained/
   and the key follows them. Counts are pinned from the data bundle
   (fed national 8R/21S, nsw 0R/8S, fedcl:inner 31R/0S, qld 20R/0S). */
import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const require = createRequire(import.meta.url);
const puppeteer = require("puppeteer-core");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2" };
const srv = http.createServer((req, res) => {
  let p;
  try { p = decodeURIComponent((req.url || "/").split("?")[0].split("#")[0]); }
  catch { res.writeHead(400); res.end("bad uri"); return; }
  if (p.endsWith("/")) p += "index.html";
  const f = path.resolve(ROOT, p.replace(/^\/+/, ""));
  if (!f.startsWith(ROOT + path.sep)) { res.writeHead(403); res.end("forbidden"); return; }
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); res.end(); } else { res.writeHead(200, { "content-type": MIME[path.extname(f)] || "text/plain" }); res.end(b); } });
});
await new Promise((r) => srv.listen(0, "127.0.0.1", r));
const port = srv.address().port;
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
const page = await browser.newPage();
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(String(e)));
const base = `http://127.0.0.1:${port}`;
let bad = 0;
const fail = (m) => { console.log("FAIL: " + m); bad++; };

await page.setViewport({ width: 1440, height: 900 });
await page.goto(`${base}/flows-explained/`, { waitUntil: "networkidle0", timeout: 45000 });
await new Promise((r) => setTimeout(r, 800));

// the chart fabric of the current view (circle counts scoped to the chart
// svg itself - the RdKey swatches are svg circles too and would contaminate
// the solids detector)
const measure = () => page.evaluate(() => {
  const card = document.querySelector(".ex-fl-card");
  const svg = card && card.querySelector("svg.chart-svg");
  const keyText = card ? [...card.querySelectorAll(".rd-key-item")].map((n) => n.textContent.trim()) : [];
  return {
    rings: svg ? svg.querySelectorAll("circle.rd-ring").length : -1,
    solids: svg ? [...svg.querySelectorAll("circle")].filter((c) => !c.getAttribute("class") && c.getAttribute("style")).length : -1,
    hasRingKey: keyText.some((t) => t === "Labor-v-Coalition seats only"),
    hasSolidKey: keyText.some((t) => t === "Every seat"),
    cap: (card && card.textContent) || "",
  };
});
const setView = async (v) => {
  await page.select(".ex-fl-sel", v);
  await new Promise((r) => setTimeout(r, 700));
};

// 1. federal national (default): 2004+ all-seats solid, 1996-2001 classic
//    rings, 1984-93 estimates carry bars instead of a mark
let m = await measure();
const capHas = (s) => m.cap.includes(s);
if (m.rings !== 8) fail(`fed national: expected 8 classic rings (grn 3 + onp 2 + oth 3 across 1996-2001), got ${m.rings}`);
if (m.solids !== 21) fail(`fed national: expected 21 all-seats discs (grn 8 + onp 5 + oth 8 across 2004-2025), got ${m.solids}`);
if (!m.hasRingKey || !m.hasSolidKey) fail(`fed national: key missing a basis item ${JSON.stringify(m)}`);
if (!capHas("Hollow rings count the seats")) fail("fed national: markNote sentence missing");
if (!capHas("solid dots count every seat.")) fail("fed national: markNote's solid-disc clause missing");

// 2. NSW state elections: all-seats count, no rings at all
await setView("nsw");
m = await measure();
if (m.rings !== 0) fail(`nsw: expected no rings, got ${m.rings}`);
if (m.solids !== 8) fail(`nsw: expected 8 solid discs (grn 3 + onp 2 + oth 3 across 2015-2023), got ${m.solids}`);
if (m.hasRingKey) fail("nsw: ring key should not show");
if (!m.hasSolidKey) fail("nsw: 'Every seat' key missing");
if (!capHas("every formal vote, in every district")) fail("nsw: all-ballots count caption missing");
if (!capHas("classic-seats figure")) fail("nsw: classic like-for-like sentence missing");

// 3. a federally-classed view: classic basis throughout
await setView("fedcl:inner");
m = await measure();
if (m.rings !== 31) fail(`fedcl inner: expected 31 classic rings (grn 11 + onp 9 + oth 11), got ${m.rings}`);
if (m.solids !== 0) fail(`fedcl inner: expected no solid discs, got ${m.solids}`);
if (!m.hasRingKey) fail("fedcl inner: ring key missing");
if (m.hasSolidKey) fail("fedcl inner: 'Every seat' key should not show");

// 4. an estimated state view (Qld): classic-seats estimates, every point ringed
await setView("qld");
m = await measure();
if (m.rings !== 20) fail(`qld: expected 20 classic rings (grn 8 + onp 4 + oth 8 across 2004-2024), got ${m.rings}`);
if (m.solids !== 0) fail(`qld: expected no solid discs, got ${m.solids}`);
if (!m.hasRingKey) fail("qld: ring key missing");
if (m.hasSolidKey) fail("qld: 'Every seat' key should not show");
if (!capHas("within about a point of the count")) fail("qld: NSW cross-check gap sentence missing");

if (errors.length) { errors.forEach((e) => console.log("CONSOLE: " + e)); fail(`${errors.length} console error(s)`); }
await browser.close(); srv.close();
console.log(bad ? `${bad} failures` : "PASS: basis marks (ring = classic seats, solid = all-seats) land on the federal national, NSW, class and estimated-state views; keys and captions follow");
process.exit(bad ? 1 : 0);
