/* Pins the All-polls Sample column's "eff." sub-line per row class:
     - a row stamped with sampleEff shows "eff. <n>" (the house's figure)
     - a filing house's brand-new unstamped wave shows "eff. TBC"
     - an MRP row (pollster ends " (MRP)") shows "eff. n/a" — MRPs file no
       effective sample; their APC statements print "n/a for MRP"
     - everything else shows no eff sub-line at all.
   Run from the repo root: ROOT=.worktrees/<name> node .matilda/probe/mrp-eff-na.mjs */
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
const require = createRequire(join(process.cwd(), "package.json"));
const puppeteer = require("puppeteer-core");
const ROOT = process.env.ROOT || ".";
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".woff2": "font/woff2", ".svg": "image/svg+xml", ".png": "image/png" };
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p.endsWith("/")) p += "index.html";
    res.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" });
    res.end(await readFile(join(ROOT, p)));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, r));
const URL0 = `http://127.0.0.1:${server.address().port}/`;
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.setViewport({ width: 1366, height: 900, deviceScaleFactor: 1 });
await page.goto(URL0 + "allpolls/", { waitUntil: "networkidle0" });
await new Promise((r) => setTimeout(r, 1500));
/* the archive groups by month with only recent ones open; the "Show all"
   button expands every month so each MRP row in the bundle is on the page */
await page.evaluate(() => {
  const b = [...document.querySelectorAll("button")].find((x) => /^Show all \d+$/.test(x.textContent.trim()));
  if (b) b.click();
});
await new Promise((r) => setTimeout(r, 800));

const got = await page.evaluate(() => {
  const rows = [...document.querySelectorAll(".rd-ap-row, .rd-ap-card")];
  const out = { mrp: [], naLeak: [], effFig: 0, tbc: 0, named: 0, window: "" };
  const head = document.querySelector(".rd-ap-hrow");
  if (head) out.window = head.textContent.slice(0, 80);
  for (const row of rows) {
    const name = ((row.querySelector(".rd-ap-who b") || {}).textContent || "").replace(/\s*↗\s*$/, "");
    const subs = [...row.querySelectorAll(".rd-ap-n .rd-ap-sub")].map((s) => s.textContent.trim());
    if (name) out.named++;
    if (/\s*\(MRP\)$/.test(name)) {
      const n = (row.querySelector(".rd-ap-n > span") || {}).textContent || "";
      out.mrp.push({ name, n, subs });
    } else if (subs.some((s) => s.startsWith("eff. n/a"))) {
      out.naLeak.push({ name, subs });
    } else {
      if (subs.some((s) => /^eff\. [\d,]+$/.test(s))) out.effFig++;
      if (subs.some((s) => /^eff\. TBC$/.test(s))) out.tbc++;
    }
  }
  out.dataMrp = (window.AUSPOL.individualPolls || []).filter((p) => /\s*\(MRP\)$/.test(p.pollster)).length;
  return out;
});

let fails = 0;
const ok = (cond, line) => { console.log((cond ? "ok  " : "FAIL") + "  " + line); if (!cond) fails++; };
ok(got.named > 150, "named poll rows render after Show all (" + got.named + ")");
ok(got.dataMrp > 0, "bundle carries MRP rows (" + got.dataMrp + ")");
ok(got.mrp.length === got.dataMrp, "every bundle MRP row renders (" + got.mrp.length + " = " + got.dataMrp + ")");
for (const m of got.mrp)
  ok(m.subs.length === 1 && m.subs[0] === "eff. n/a", m.name + " (" + m.n + ") shows exactly the 'eff. n/a' sub-line" + (m.subs.length ? " — got " + JSON.stringify(m.subs) : ""));
ok(got.naLeak.length === 0, "no non-MRP row shows 'eff. n/a'" + (got.naLeak.length ? " — " + JSON.stringify(got.naLeak.slice(0, 3)) : ""));
ok(got.effFig > 20, "stamped rows keep their 'eff. <n>' figure (" + got.effFig + " rows)");
console.log("info: " + got.tbc + " row(s) show 'eff. TBC'");

await browser.close();
server.close();
process.exit(fails ? 1 : 0);
