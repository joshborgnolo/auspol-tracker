/* switching-title-dek-swap.mjs — pins the 2026-09-30 switching-panel changes:
   A. ENCODING REVERTED (undo of 742df1e): mosaic aria describes fills as the
      share now backing One Nation (fills = rate), text under bars = gain %.
   B. TITLE/DEK SWAPPED: head = "{frac} 2025 {A} voters now back One Nation"
      from the higher lnp/alp switch rate; dek = flocked-ratio sentence then
      the old gain-share head sentence. All figures recomputed from the LIVE
      data bundle (9f09dca2 asset evaluated in Node). The 5cd7388a dek
      rewrite (2026-10-15) says the ratio in WORDS to the nearest half
      ("about three times", timesWords) and the gain share as plain
      fractions that name the top TWO sizeable sources ("about three in
      five voted for the Coalition in 2025 and about one in five for
      Labor.") - the pins below were re-pointed from the old digit forms
      (quarter-rounded ratio, one source named) on 2026-10-16.
   C. POINTS-ROW SUFFIXES: the first two columns (lnp, alp) name what they
      count - "≈ N points of One Nation's gain" where it fits, "≈ N points
      of ON's gain" short, phone rows fixed at the short form; later columns
      bare. The alp column joined the lnp column's chain on 2026-10-10
      (user: its "of the gain" didn't say whose). The SHARE (±) rows have
      been tail-free everywhere since 327f569 (2026-10-03, user call).
      The gain-share sentence's verb is "voted for" since 49a8b7f (the
      "backed" pin was drift, repaired 2026-10-10). */
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
/* 5cd7388a: the dek says the ratio in words to the nearest half
   (timesWords) and the gain share as plain fractions (rdFraction) */
const NUMW = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
const timesW = (r) => {
  const h = Math.round(r * 2) / 2;
  if (h >= 11) return "about " + Math.round(r) + " times";
  if (h === 2) return "about twice";
  return "about " + NUMW[Math.floor(h)] + (h % 1 ? " and a half" : "") + " times";
};
const fracW = (p) => {
  const cands = [[1, 2], [1, 3], [2, 3], [1, 4], [3, 4], [1, 5], [2, 5], [3, 5], [4, 5], [1, 6], [1, 7], [1, 8],
                 [1, 9], [1, 10], [3, 10], [7, 10], [9, 10], [1, 12], [1, 15], [1, 20]];
  let best = null;
  for (const [a, b] of cands) { const err = Math.abs(p / 100 - a / b); if (!best || err < best.err) best = { a, b, err }; }
  return (best.err < 0.012 ? "" : "about ") + NUMW[best.a] + " in " + NUMW[best.b];
};
const RATIO = now[hi].rate / now[lo].rate;
const RATIO_WORDS = timesW(RATIO);
console.log(`live data: lnp rate=${now.lnp.rate.toFixed(1)} gain=${now.lnp.gain.toFixed(1)} · alp rate=${now.alp.rate.toFixed(1)} gain=${now.alp.gain.toFixed(1)} · ratio=${RATIO.toFixed(2)} ("${RATIO_WORDS}")`);

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
    ok("dek carries the flocked-ratio sentence", p.dek.includes(`${P[hi]} voters have flocked to One Nation at ${RATIO_WORDS} the rate of ${P[lo]} voters`), p.dek.slice(0, 140));
    /* the old head's gain-share sentence, computed exactly: the top source
       as a fraction, the second while it clears 15% of the cohort, party
       names as the dek renders them */
    const PARTY_OF = { lnp: "the Coalition", alp: "Labor", grn: "the Greens", oth: "another party" };
    const byGain = [...Object.entries(now)].sort((a, b) => b[1].gain - a[1].gain);
    const topSrc = byGain[0][0], src2 = byGain[1] && byGain[1][1].gain >= 15 ? byGain[1][0] : null;
    const gainSent = "Of One Nation’s new voters, " + fracW(byGain[0][1].gain) + " voted for " + PARTY_OF[topSrc] + " in 2025"
      + (src2 ? " and " + fracW(byGain[1][1].gain) + " for " + PARTY_OF[src2] : "") + ".";
    ok("dek carries the old head’s gain-share sentence", p.dek.includes(gainSent), p.dek.slice(0, 260) + " vs expected " + gainSent);
    ok("old dek tail gone", !/now say they.{1,3}d vote for One Nation/i.test(p.dek));
    ok("mosaic aria back to rate-fills (revert of 742df1e)", /filled by the share now backing One Nation/.test(p.aria));
    const sorted = [...Object.entries(now)].sort((a, b) => b[1].gain - a[1].gain);
    const topId = sorted[0][0];
    const topParty = topId === "lnp" ? "the Coalition" : topId === "alp" ? "Labor" : topId === "grn" ? "the Greens" : "another party";
    ok("gain-share sentence names the top gainer", p.dek.includes(topParty), topParty);
    const first = p.pts[0] || "";
    ok("first column ≈ pts carries the full gain suffix", /≈ .* points of One Nation.s gain/.test(first), JSON.stringify(first));
    ok("second column ≈ pts names One Nation's gain too (full or ON short form)", /≈ .* points of (?:One Nation|ON).s gain/.test(p.pts[1] || ""), JSON.stringify(p.pts[1] || ""));
    ok("no column still says “of the gain”", p.pts.every((t) => !/of the gain/.test(t)), JSON.stringify(p.pts));
    ok("columns 3+ stay bare", p.pts.slice(2, 4).every((t) => /^≈ [\d.]+( points)?$/.test(t)), JSON.stringify(p.pts));
    ok("share rows are tail-free on every column (327f569)", p.shs.length >= 4 && p.shs.every((t) => !/gain/.test(t)), JSON.stringify(p.shs));
  }
}

/* ---- phone (390): .rd-mo-rows render ------------------------------------ */
{
  const p = await readPanel(390);
  if (p.err) { console.log("FAIL phone render  " + p.err); fails++; }
  else {
    ok("phone head swaps to the rate sentence", new RegExp(`^(?:Almost |Nearly |Just over |Over )?[A-Za-z]+ in [a-z]+ 2025 ${P[hi]} voters now back One Nation$`).test(p.head), JSON.stringify(p.head));
    ok("phone rows render ≈ pts labels", p.moRows.length >= 4 && p.moRows.every((t) => t.startsWith("≈")), JSON.stringify(p.moRows));
    ok("phone rows 1 and 2 both say “of ON's gain”", p.moRows.slice(0, 2).every((t) => /points of ON.s gain/.test(t)), JSON.stringify(p.moRows.slice(0, 3)));
    ok("phone dek carries the flocked-ratio sentence", p.dek.includes(P[hi]) && p.dek.includes(RATIO_WORDS), p.dek.slice(0, 120));
  }
}

await browser.close();
server.close();
console.log(fails ? `\n${fails} FAIL` : "\nALL PASS");
process.exit(fails ? 1 : 0);
