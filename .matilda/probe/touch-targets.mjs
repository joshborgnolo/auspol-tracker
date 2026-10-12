// Touch-target sweep: list every interactive element with a rendered box
// under 24x24 CSS px, per document, at the phone rung (360px).
import puppeteer from "puppeteer-core";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2", ".xml": "application/xml" };
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
const docs = ["/", "/allpolls/", "/cycles/", "/info/", "/vic/"];
let fails = 0;
for (const d of docs) {
  const page = await browser.newPage();
  await page.setViewport({ width: 360, height: 800, isMobile: true, hasTouch: true });
  await page.goto(`http://127.0.0.1:${port}${d}`, { waitUntil: "networkidle0", timeout: 45000 }).catch(()=>{});
  await new Promise(r => setTimeout(r, 2500));
  const hits = await page.evaluate(() => {
    const sel = "button, [role=button], select, input, a";
    const out = [];
    for (const el of document.querySelectorAll(sel)) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const st = getComputedStyle(el);
      if (st.display === "none" || st.visibility === "hidden") continue;
      if (r.width < 24 || r.height < 24) {
        const cls = (el.getAttribute("class") || "").split(/\s+/).slice(0, 3).join(".");
        out.push({ tag: el.tagName.toLowerCase(), cls, w: +r.width.toFixed(1), h: +r.height.toFixed(1), txt: (el.textContent || "").trim().slice(0, 30), hb: el.href ? 1 : 0 });
      }
    }
    return out;
  });
  // collapse duplicates by class+size
  const seen = new Map();
  const ctlBad = hits.filter((h) => h.tag === "input" || h.tag === "select");
  if (ctlBad.length) fails += ctlBad.length;
  for (const h of hits) { const k = `${h.tag}.${h.cls}|${h.w}x${h.h}`; seen.set(k, { ...h, n: (seen.get(k)?.n || 0) + 1 }); }
  const rows = [...seen.values()].sort((a, b) => a.h * a.w - b.h * b.w);
  console.log(`\n=== ${d} — ${hits.length} offending instances, ${rows.length} distinct kinds${ctlBad.length ? `, ${ctlBad.length} FORM CONTROL(S) UNDER 24PX` : ""}`);
  for (const r of rows) console.log(`${r.n}×  <${r.tag}> .${r.cls || "-"}  ${r.w}×${r.h}  "${r.txt}"${r.hb ? " [href]" : ""}`);
  await page.close();
}
await browser.close();
srv.close();
console.log(fails ? `FAIL: ${fails} form control(s) under 24px` : "PASS: touch targets – no form control under 24px (small links/buttons reported above)");
process.exit(fails ? 1 : 0);
