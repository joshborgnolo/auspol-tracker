// Verify: on the phone rung (≤760px) the Issues change view ("Change" tab
// inside "Who's trusted") lays the two month columns ("November 2025" and
// "October 2026") side by side, one square per issue filling each column,
// and each issue's two tiles align on the same row.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const PORT = 8973;
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
const fail = (msg) => { pass = false; console.log("FAIL " + msg); };
const ok = (msg) => console.log("OK   " + msg);

for (const vw of [390, 320]) {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));
  await page.setViewport({ width: vw, height: 844, deviceScaleFactor: 2 });
  await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: "networkidle0", timeout: 60000 });

  // Issues section, trust view, Change tab
  await page.evaluate(() => {
    document.getElementById("issues")?.scrollIntoView();
    const btn = [...document.querySelectorAll(".rd-isc-tabs button, .rd-isc-tabs [role=tab]")]
      .find((n) => (n.textContent || "").trim() === "Change");
    if (btn) btn.click();
  });
  await page.waitForSelector(".rd-isc .rd-isc-m .rd-isc-tile", { timeout: 30000 });
  await new Promise((r) => setTimeout(r, 900)); // crossfade settles

  const out = await page.evaluate(() => {
    const rect = (el) => { const r = el.getBoundingClientRect(); return { left: +r.left.toFixed(1), top: +r.top.toFixed(1), width: +r.width.toFixed(1), height: +r.height.toFixed(1) }; };
    const wrap = document.querySelector(".rd-isc");
    const months = [...document.querySelectorAll(".rd-isc .rd-isc-m")].map((m) => ({
      label: m.querySelector(".rd-isc-mlab")?.textContent.trim(),
      ...rect(m),
      tiles: [...m.querySelectorAll(".rd-isc-tile")].map((t) => ({
        issue: t.querySelector(".rd-isc-issue")?.textContent.trim(),
        ...rect(t),
      })),
    }));
    return { wrap: rect(wrap), wrapCols: getComputedStyle(wrap).gridTemplateColumns, months };
  });

  if (errors.length) fail(`vw ${vw}: page errors: ${errors.join(" | ")}`);
  if (out.months.length !== 2) fail(`vw ${vw}: expected 2 month columns, got ${out.months.length}`);
  else {
    const [nov, oct] = out.months;
    // side by side: same top band, oct starts right of nov
    if (Math.abs(nov.top - oct.top) > 4) fail(`vw ${vw}: months not aligned at top (nov ${nov.top}, oct ${oct.top})`);
    else ok(`vw ${vw}: months side by side, top edge aligned (${nov.top})`);
    if (oct.left <= nov.left + nov.width - 4) fail(`vw ${vw}: october column overlaps/nested in november (nov right ${nov.left + nov.width}, oct left ${oct.left})`);
    else ok(`vw ${vw}: october column sits right of november (nov ${nov.left}..${(nov.left + nov.width).toFixed(1)}, oct ${oct.left}..)`);
    // one tile per row: each tile spans nearly the full month column width
    for (const m of [nov, oct]) {
      const wide = m.tiles.filter((t) => t.width > m.width * 0.9);
      if (wide.length !== m.tiles.length) fail(`vw ${vw} ${m.label}: ${m.tiles.length - wide.length} tiles not spanning their column`);
    }
    ok(`vw ${vw}: tiles fill their month column (nov ${nov.tiles[0]?.width}px of ${nov.width}px, oct ${oct.tiles[0]?.width}px of ${oct.width}px)`);
    // rows align: same-issue tiles share a top edge across months
    if (nov.tiles.length !== oct.tiles.length) fail(`vw ${vw}: tile counts differ (${nov.tiles.length} vs ${oct.tiles.length})`);
    else {
      const drift = nov.tiles.map((t, i) => Math.abs(t.top - oct.tiles[i].top));
      const maxDrift = Math.max(...drift);
      if (maxDrift > 2) fail(`vw ${vw}: issue rows misaligned across months, max drift ${maxDrift}px`);
      else ok(`vw ${vw}: ${nov.tiles.length} issue rows align across months (max drift ${maxDrift.toFixed(1)}px)`);
    }
    // square stays square
    const t = nov.tiles[0];
    if (Math.abs(t.width - t.height) > 2) fail(`vw ${vw}: tile not square (${t.width}×${t.height})`);
    else ok(`vw ${vw}: tiles stay square (${t.width}×${t.height})`);
    // november label is the snapshot month
    if (!/november 2025/i.test(nov.label || "")) fail(`vw ${vw}: first month column is "${nov.label}", expected November 2025`);
    else ok(`vw ${vw}: first column is "${nov.label}", second "${oct.label}"`);
  }
  await page.close();
}

await browser.close();
server.close();
console.log(pass ? "ALL OK" : "FAILURES");
process.exit(pass ? 0 : 1);
