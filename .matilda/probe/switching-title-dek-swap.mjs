/* switching-title-dek-swap.mjs — pins the 2026-09-30 switching-panel changes:
   A. ENCODING REVERTED (undo of 742df1e): mosaic aria describes fills as the
      share now backing One Nation (fills = rate), text under bars = gain %.
   B. TITLE/DEK SWAPPED: head = "{frac} 2025 {A} voters now back One Nation"
      from the higher lnp/alp switch rate; dek = flocked-ratio sentence then
      the old gain-share head sentence. All figures recomputed from the LIVE
      data bundle (9f09dca2 asset evaluated in Node).
   C. FIRST-COLUMN PTS SUFFIX: big screens render "≈ N points of One Nation's
      gain", a phone renders the short/fallback forms, later columns bare. */
import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
if (!fs.existsSync(CHROME)) { console.error("no Chrome at " + CHROME); process.exit(1); }
const require = createRequire(import.meta.url);
const puppeteer = require("puppeteer-core");

/* ---- expected figures straight from the live data bundle --------------- */
const dataAsset = fs.readdirSync(path.join(ROOT, ".build/newtracker/assets")).find((f) => f.startsWith("9f09dca2") && f.endsWith(".js"));
const src = fs.readFileSync(path.join(ROOT, ".build/newtracker/assets", dataAsset), "utf8");
const win = {};
new Function("window", src)(win);
const D = win.AUSPOL;
if (!D || !D.onSources) { console.error("no AUSPOL.onSources in " + dataAsset); process.exit(1); }
const S = D.onSources;
const now = {};
for (const e of S.series) now[e.id] = { rate: e.rate.now.v, gain: e.now.v };
const hi = now.lnp.rate >= now.alp.rate ? "lnp" : "alp";
const lo = hi === "lnp" ? "alp" : "lnp";
const P = { lnp: "Coalition", alp: "Labor" };
const RATIO = Math.round((now[hi].rate / now[lo].rate) * 4) / 4;
console.log(`live data: lnp rate=${now.lnp.rate.toFixed(1)} gain=${now.lnp.gain.toFixed(1)} · alp rate=${now.alp.rate.toFixed(1)} gain=${now.alp.gain.toFixed(1)} · ratio=${RATIO}`);

/* ---- serve the repo ---------------------------------------------------- */
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
const server = http.createServer((req, res) => {
  let p = path.join(ROOT, decodeURIComponent(req.url.split("?")[0]));
  if (p.startsWith(ROOT) && fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, "index.html");
  if (!p.startsWith(ROOT) || !fs.existsSync(p)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": MIME[path.extname(p)] || "text/plain" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new" });
let fails = 0;
const ok = (label, cond, detail) => { console.log((cond ? "PASS " : "FAIL ") + label + (detail ? `  [${detail}]` : "")); if (!cond) fails++; };

const readPanel = async (width) => {
  const page = await browser.newPage();
  await page.setViewport({ width, height: 1200, deviceScaleFactor: 1 });
  await page.goto(`http://localhost:${port}/`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector("#switching .rd-mo, #switching .rd-mo-ph, #switching", { timeout: 30000 });
  await new Promise((r) => setTimeout(r, 1200));
  const out = await page.evaluate(() => {
    const sec = document.getElementById("switching");
    if (!sec) return { err: "no #switching" };
    const texts = [...sec.querySelectorAll("text")].map((t) => t.textContent);
    return {
      head: (sec.querySelector(".rd-hed") || {}).textContent || "",
      dek: (sec.querySelector(".rd-dek") || {}).textContent || "",
      aria: (sec.querySelector("svg[aria-label]") || {}).getAttribute?.("aria-label") || "",
      pts: texts.filter((t) => t.startsWith("≈")),
      shs: [...sec.querySelectorAll("text.rd-mo-sh")].map((t) => t.textContent),
      moRows: [...sec.querySelectorAll(".rd-mo-rows .rd-mo-rtop b:last-child")].map((b) => b.textContent),
      texts: texts.slice(0, 40),
    };
  });
  await page.close();
  return out;
};

/* ---- desktop (1280) ---------------------------------------------------- */
{
  const p = await readPanel(1280);
  if (p.err) { console.log("FAIL desktop render  " + p.err); fails++; }
  else {
    ok("head swaps to the rate sentence", new RegExp(`^(?:Almost |Nearly |Just over |Over )?[A-Za-z]+ in [a-z]+ 2025 ${P[hi]} voters now back One Nation$`).test(p.head), JSON.stringify(p.head));
    ok("head names the HIGHER-rate party", p.head.includes(P[hi]) && !p.head.includes(P[hi] === "Coalition" ? "Labor" : "Coalition"), P[hi] + " rate " + now[hi].rate.toFixed(1));
    ok("dek carries the flocked-ratio sentence", new RegExp(`${P[hi]} voters have flocked to One Nation at about ${String(RATIO).replace(".", "\\.")} times the rate of ${P[lo]} voters`).test(p.dek), p.dek.slice(0, 140));
    ok("dek carries the old head’s gain-share sentence", /of One Nation.{1,3}new voters backed (the )?(Coalition|Labor|Greens|another party) in 2025\./.test(p.dek), p.dek.slice(0, 260));
    ok("old dek tail gone", !/now say they.{1,3}d vote for One Nation/i.test(p.dek));
    ok("mosaic aria back to rate-fills (revert of 742df1e)", /filled by the share now backing One Nation/.test(p.aria));
    const sorted = [...Object.entries(now)].sort((a, b) => b[1].gain - a[1].gain);
    const topId = sorted[0][0];
    const topParty = topId === "lnp" ? "the Coalition" : topId === "alp" ? "Labor" : topId === "grn" ? "the Greens" : "another party";
    ok("gain-share sentence names the top gainer", p.dek.includes(topParty), topParty);
    const first = p.pts[0] || "";
    ok("first column ≈ pts carries the full gain suffix", /≈ .* points of One Nation.s gain/.test(first), JSON.stringify(first));
    ok("second column ≈ pts says “of the gain”", /≈ .* points of the gain/.test(p.pts[1] || ""), JSON.stringify(p.pts[1] || ""));
    ok("columns 3+ stay bare", p.pts.slice(2, 4).every((t) => /^≈ [\d.]+( points)?$/.test(t)), JSON.stringify(p.pts));
    ok("first column share row says “of the gain” (not One Nation’s — the pts row above already has it)", /of the gain/.test(p.shs[0] || "") && !/of One Nation.s gain/.test(p.shs[0] || ""), JSON.stringify(p.shs[0]));
    ok("second column share row is bare", !/of the gain|of One Nation.s gain/.test(p.shs[1] || "") && /±/.test(p.shs[1] || ""), JSON.stringify(p.shs));
  }
}

/* ---- phone (390): .rd-mo-rows render ------------------------------------ */
{
  const p = await readPanel(390);
  if (p.err) { console.log("FAIL phone render  " + p.err); fails++; }
  else {
    ok("phone head swaps to the rate sentence", new RegExp(`^(?:Almost |Nearly |Just over |Over )?[A-Za-z]+ in [a-z]+ 2025 ${P[hi]} voters now back One Nation$`).test(p.head), JSON.stringify(p.head));
    ok("phone rows render ≈ pts labels", p.moRows.length >= 4 && p.moRows.every((t) => t.startsWith("≈")), JSON.stringify(p.moRows));
    ok("phone dek carries the flocked-ratio sentence", p.dek.includes(P[hi]) && p.dek.includes(`${RATIO}`), p.dek.slice(0, 120));
  }
}

await browser.close();
server.close();
console.log(fails ? `\n${fails} FAIL` : "\nALL PASS");
process.exit(fails ? 1 : 0);
