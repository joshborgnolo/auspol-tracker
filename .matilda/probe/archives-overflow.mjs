// Archive-hand-page overflow sweep: document scrollWidth vs viewport across
// the phone rung, plus the widest overflowing elements named for triage.
import puppeteer from "puppeteer-core";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2", ".xml": "application/xml", ".csv": "text/csv" };
const srv = http.createServer((req, res) => {
  let p;
  try { p = decodeURIComponent((req.url || "/").split("?")[0].split("#")[0]); }
  catch { res.writeHead(400); res.end("bad uri"); return; }
  if (p.endsWith("/")) p += "index.html";
  const f = path.resolve(ROOT, p.replace(/^\/+/, ""));
  if (!f.startsWith(ROOT + path.sep)) { res.writeHead(403); res.end("forbidden"); return; }
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); res.end("nf"); } else { res.writeHead(200, { "content-type": types[path.extname(f)] || "application/octet-stream" }); res.end(b); } });
});
await new Promise(r => srv.listen(0, "127.0.0.1", r));
const port = srv.address().port;
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
const docs = ["/provenance/", "/archives/acnielsen/", "/archives/aeforecasts/", "/archives/galaxy/", "/archives/morgan/", "/archives/newspoll/", "/archives/trove/"];
const widths = [320, 360, 390, 641, 700];
let fails = 0;
for (const d of docs) {
  const lines = [];
  for (const w of widths) {
    const page = await browser.newPage();
    await page.setViewport({ width: w, height: 800 });
    await page.goto(`http://127.0.0.1:${port}${d}`, { waitUntil: "networkidle0", timeout: 45000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 1200));
    const out = await page.evaluate((vw) => {
      const sw = document.documentElement.scrollWidth;
      const wide = [];
      if (sw > vw) {
        const els = document.querySelectorAll("body *");
        for (const el of els) {
          const r = el.getBoundingClientRect();
          if (r.right > vw + 0.5 && r.left < vw) {
            if (el.firstElementChild && Math.abs(el.firstElementChild.getBoundingClientRect().right - r.right) < 0.5 && r.left === el.firstElementChild.getBoundingClientRect().left && el.children.length === 1) continue; // width inherited from a single child
            const cls = (el.className?.baseVal ?? el.className ?? "").toString().trim().split(/\s+/)[0] || "-";
            wide.push(`${el.tagName.toLowerCase()}.${cls} R${Math.round(r.right)} W${Math.round(r.width)}`);
            if (wide.length >= 7) break;
          }
        }
      }
      return { sw, wide };
    }, w);
    lines.push(`  ${w}: scrollW=${out.sw}${out.sw > w ? " OVERFLOW " + out.wide.join(" | ") : ""}`);
    if (out.sw > w) fails++;
    await page.close();
  }
  console.log(`${d}\n${lines.join("\n")}`);
}
await browser.close();
srv.close();
console.log(fails ? `FAIL: document overflow in ${fails} page/width combination(s)` : "PASS: archives – no document overflow");
process.exit(fails ? 1 : 0);
