// The DemosAU 18–20 Aug 2026 wave (Capital Brief) carries a RANGE-ONLY seat
// model (seats.rangeOnly, lo/hi, no est) — the All-polls "Seats, modelled"
// block must render "61–73"-style ranges with the Lib/Nat split note and the
// modelled-range method line, while the MRP rows keep their bare est figures.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const PORT = 8947;
const MIME = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".css": "text/css" };
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p === "/") p = "/index.html";
    res.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" });
    res.end(await readFile(join(ROOT, p)));
  } catch { res.writeHead(404); res.end("nf"); }
});
await new Promise((r) => server.listen(PORT, r));

const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new",
});
let pass = true;
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));
await page.setViewport({ width: 1440, height: 960 });
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: "networkidle0", timeout: 60000 });

await page.evaluate(() => {
  const btn = [...document.querySelectorAll("button, a")].find((n) => /all polls/i.test(n.textContent || ""));
  if (btn) btn.click();
});
await page.waitForSelector(".rd-ap-table", { timeout: 30000 });

const clickRow = (m) => page.evaluate((mm) => {
  const row = [...document.querySelectorAll(".rd-ap-table .rd-ap-row")].find((n) => (n.textContent || "").includes(mm));
  if (row) row.click();
  return !!row;
}, m);

const allRegions = () => page.evaluate(() => {
  const ks = [...document.querySelectorAll("span")].filter((n) => (n.textContent || "").trim() === "Seats, modelled");
  const regions = [];
  for (const k of ks) {
    let el = k;
    while (el && !(el.textContent || "").includes("Report an error")) el = el.parentElement;
    const t = (el || k).textContent;
    if (!regions.includes(t)) regions.push(t);
  }
  return regions;
});

// 1︎⃣ the range-only DemosAU wave: ranges, split note, method line
const clicked = await clickRow("18–20 Aug");
if (!clicked) { console.log("FAIL  could not find the 18–20 Aug row"); pass = false; }
await new Promise((r) => setTimeout(r, 900));
const dau = (await allRegions()).find((t) => t.includes("20,000-simulation")) || null;
if (dau == null) { console.log("FAIL  no expanded 'Seats, modelled' block for the DemosAU 18–20 Aug wave"); pass = false; }
for (const w of ["Seats, modelled", "ALP 61–73", "L/NP 32–50", "Lib 29–41, Nat 3–9", "GRN 0–5", "ON 26–39", "OTH 5–10", "Modelled range"]) {
  const ok = dau != null && dau.includes(w);
  console.log((ok ? "ok    " : "MISS  ") + w);
  if (!ok) pass = false;
}

// 2︎⃣ an MRP row keeps its bare est figures (and no range note). Its detail
// region carries no "(MRP)" text (that's the row header, outside the detail
// container) — identify it as the seats detail WITHOUT the modelled-range note.
await clickRow("DemosAU (MRP)");
await new Promise((r) => setTimeout(r, 900));
const mrp = (await allRegions()).find((t) => !t.includes("Modelled range")) || null;
if (mrp == null) { console.log("FAIL  no bare-est 'Seats, modelled' detail for an MRP row"); pass = false; }
const seatSeg = (mrp || "").slice((mrp || "").indexOf("Seats, modelled")).slice(0, 160);
const mrpChecks = [
  [/ALP \d+/.test(seatSeg), "MRP keeps a bare ALP est figure"],
  [!/ALP \d+–/.test(seatSeg), "MRP ALP figure is not a range"],
  [!(mrp || "").includes("Modelled range"), "MRP lacks the modelled-range note"],
  [!(mrp || "").includes("undefined"), "no undefined"],
  [!(mrp || "").includes("NaN"), "no NaN"],
];
for (const [ok, lab] of mrpChecks) {
  console.log((ok ? "ok    " : "MISS  ") + lab);
  if (!ok) pass = false;
}

console.log(errors.join("\n") || "(no page errors)");
if (errors.length) pass = false;
console.log(pass ? "ALL CHECKS PASSED" : "FAILED");
await browser.close();
server.close();
process.exit(pass ? 0 : 1);
