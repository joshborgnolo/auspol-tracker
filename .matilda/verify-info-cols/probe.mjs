/* Verification for the Info tab's two-column laptop layout (template.html
   `@media (min-width: 1100px) { .info { columns: 2 } ... }`).
   Loads the built index.html, opens the Info tab and asserts:
   - laptop (1280px): .info computes to 2 columns, glossary terms occupy two
     horizontal tracks, both section titles span the full width, and no term
     straddles the gutter (break-inside: avoid);
   - phone-ish (980px): single column, unchanged from before.
   Screenshots land in /tmp for eyeballing. */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const require_ = createRequire(path.join(os.homedir(), "node_modules", "."));
const puppeteer = require_("puppeteer-core");
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".woff2": "font/woff2", ".svg": "image/svg+xml" };
const server = http.createServer((req, res) => {
  let rel = decodeURIComponent(req.url.split("?")[0]);
  if (rel.endsWith("/")) rel += "index.html";
  fs.readFile(path.join(ROOT, rel), (err, buf) => {
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(rel)] || "application/octet-stream" });
    res.end(buf);
  });
});
await new Promise((ok) => server.listen(8735, "127.0.0.1", ok));

let failures = 0;
const fail = (msg) => { failures += 1; console.log("  FAIL " + msg); };
const ok = (msg) => console.log("  ok   " + msg);
const assert = (cond, msg) => (cond ? ok(msg) : fail(msg));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new" });
try {
  for (const vp of [{ width: 1280, height: 1400, tabs2Col: true }, { width: 980, height: 1400, tabs2Col: false }]) {
    console.log(`\n== viewport ${vp.width}px ==`);
    const page = await browser.newPage();
    page.on("pageerror", (e) => console.error("[page]", e.message));
    await page.setViewport({ width: vp.width, height: vp.height });
    await page.goto("http://127.0.0.1:8735/", { waitUntil: "networkidle0", timeout: 60000 });
    await page.evaluate(`(() => {
      const btn = [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Info");
      if (!btn) throw new Error("Info tab button not found");
      btn.click();
    })()`);
    await page.waitForSelector(".info .info-term", { timeout: 10000 });
    await page.evaluate("document.fonts.ready.then(() => 0)");
    await new Promise((r) => setTimeout(r, 250));

    const got = await page.evaluate(`(() => {
      const cs = getComputedStyle(document.querySelector(".info"));
      const card = document.querySelector(".info").getBoundingClientRect();
      const padL = parseFloat(getComputedStyle(document.querySelector(".info")).paddingLeft);
      const terms = [...document.querySelectorAll(".info .info-term")]
        .slice(0, 20)
        .map((el) => { const r = el.getBoundingClientRect(); return { left: r.left, width: r.width }; });
      const heads = [...document.querySelectorAll(".info > .info-h")]
        .map((el) => el.getBoundingClientRect().width);
      return { columnCount: cs.columnCount, contentW: card.width - padL - parseFloat(cs.paddingRight), terms, heads };
    })()`);

    if (vp.tabs2Col) {
      assert(got.columnCount === "2", `.info column-count = 2 (got ${got.columnCount})`);
      assert(got.heads.every((w) => Math.abs(w - got.contentW) < 1),
        `heads span full width (${got.heads.map((w) => Math.round(w)).join(", ")} vs content ${Math.round(got.contentW)})`);
      const lefts = [...new Set(got.terms.map((t) => Math.round(t.left)))];
      assert(lefts.length === 2, `terms sit on exactly two column tracks (distinct lefts: ${lefts.join(", ")})`);
      const colW = got.terms[0].width;
      assert(got.terms.every((t) => Math.abs(t.width - colW) < 1),
        `terms are one column wide (widths ≈ ${Math.round(colW)})`);
      assert(/^\d{2,3}$/.test(String(Math.round(colW))) && Math.round(colW) < got.contentW / 2 + 1,
        `column width ${Math.round(colW)} < half the card (${Math.round(got.contentW / 2)})`);
    } else {
      assert(got.columnCount === "auto", `single column below 1100px (got ${got.columnCount})`);
    }
    await page.screenshot({ path: `/tmp/info-cols-${vp.width}.png` });
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}
console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
