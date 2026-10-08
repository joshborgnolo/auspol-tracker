/* Check: the four confidence read-rows lay their headline figures out cleanly.
   Desktop/tablet (>560px): the .rd-un-rtop grid gives every figure the SAME
   left edge (a shared column), publisher names sit in their own track, and
   nothing overflows or overlaps. Phone (<=560px): the row wraps to two
   lines — line 1 label+publisher, line 2 figure+change badge, the figure at
   the text column's left edge. Fails (exit 1) on any violation.
   Run: node .matilda/probe/confidence-figure-column.mjs */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const PORT = 8946;
const MIME = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".css": "text/css", ".png": "image/png" };

const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p === "/") p = "/index.html";
    const body = await readFile(join(ROOT, p));
    res.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" });
    res.end(body);
  } catch { res.writeHead(404); res.end("nf"); }
});
await new Promise((r) => server.listen(PORT, r));

const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new",
});

async function probe(W, H) {
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H });
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e)));
  await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: "networkidle0", timeout: 60000 });
  await page.waitForSelector(".rd-confidence .rd-un-read", { timeout: 15000 });
  await new Promise((r) => setTimeout(r, 400));
  const rows = await page.evaluate(() => {
    return [...document.querySelectorAll(".rd-confidence .rd-un-read")].map((row) => {
      const r = (n) => { const b = n ? n.getBoundingClientRect() : null; return b ? { x: +b.left.toFixed(1), y: +b.top.toFixed(1), w: +b.width.toFixed(1), r: +(b.left + b.width).toFixed(1) } : null; };
      const txt = row.children[1];
      return {
        name: row.querySelector(".rd-un-rtop b")?.textContent,
        house: row.querySelector(".rd-un-rhouse")?.textContent,
        label: r(row.querySelector(".rd-un-rtop b")),
        houseRect: r(row.querySelector(".rd-un-rhouse")),
        figure: r(row.querySelector(".rd-un-rv")),
        change: r(row.querySelector(".rd-un-rci")),
        textCol: r(txt),
        rowW: +row.getBoundingClientRect().width.toFixed(1),
        docSw: document.scrollingElement.scrollWidth,
        docCw: document.documentElement.clientWidth,
      };
    });
  });
  await page.close();
  return { rows, errs };
}

let failures = 0;
const bad = (msg) => { failures++; console.log(`❌ ${msg}`); };
const ok = (msg) => console.log(`✅ ${msg}`);

for (const [W, H] of [[1280, 900], [820, 900], [390, 844], [320, 844]]) {
  const { rows, errs } = await probe(W, H);
  const phone = W <= 560;
  console.log(`=== ${W}px (${phone ? "phone" : "desktop"}) ===`);

  if (errs.length) bad(`${W}px page errors: ${errs.join("; ")}`);
  const { docSw, docCw } = rows[0] || {};
  if (docSw > docCw) bad(`${W}px horizontal scroll: scrollWidth ${docSw} > clientWidth ${docCw}`);
  if (rows.length !== 4) bad(`${W}px expected 4 read rows, found ${rows.length}`);

  const figs = rows.map((r) => r.figure).filter(Boolean);
  if (figs.length === rows.length && figs.length > 1) {
    const spread = Math.max(...figs.map((f) => f.x)) - Math.min(...figs.map((f) => f.x));
    if (spread <= 1) ok(`${W}px figure column x spread Δ${spread.toFixed(1)}px ≤ 1`);
    else bad(`${W}px figure x spread Δ${spread.toFixed(1)}px > 1 (no shared column)`);

    if (phone) {
      const tx = rows[0].textCol.x;
      let wrapClean = true;
      for (const row of rows) {
        if (Math.abs(row.figure.x - tx) > 1) { bad(`${W}px "${row.name}" figure x ${row.figure.x} ≠ text column x ${tx}`); wrapClean = false; }
        if (row.change && Math.abs(row.change.y - row.figure.y) > 2) { bad(`${W}px "${row.name}" badge y ${row.change.y} not on figure line y ${row.figure.y}`); wrapClean = false; }
        else if (row.change && row.change.x < row.figure.r - 1) { bad(`${W}px "${row.name}" badge x ${row.change.x} overlaps figure right ${row.figure.r}`); wrapClean = false; }
        if (row.houseRect && Math.abs(row.houseRect.y - row.label.y) > 2) { bad(`${W}px "${row.name}" publisher not on the label line`); wrapClean = false; }
        if (row.figure.y <= row.label.y + 5) { bad(`${W}px "${row.name}" figure did not wrap below the label line`); wrapClean = false; }
      }
      if (wrapClean) ok(`${W}px phone wrap: label+publisher line 1, figure+badge line 2`);
    } else {
      let clean = true;
      for (const row of rows) {
        const rowR = row.textCol.x + row.rowW;
        if (row.houseRect && row.figure.x < row.houseRect.r + 4) { bad(`${W}px "${row.name}" figure x ${row.figure.x} crowds publisher right edge ${row.houseRect.r}`); clean = false; }
        if (row.change && row.change.x < row.figure.r + 4) { bad(`${W}px "${row.name}" badge x ${row.change.x} crowds figure right ${row.figure.r}`); clean = false; }
        if (row.figure.r > rowR + 1) { bad(`${W}px "${row.name}" figure overflows row right ${rowR}`); clean = false; }
        if (row.change && row.change.r > rowR + 1) { bad(`${W}px "${row.name}" badge overflows row right ${rowR}`); clean = false; }
      }
      if (clean) ok(`${W}px publisher | figure | badge order clean, no row overflow`);
    }
    for (const row of rows) {
      const worst = Math.max(row.figure?.r ?? 0, row.change?.r ?? 0, row.houseRect?.r ?? 0, row.label?.r ?? 0);
      if (worst > W + 1) bad(`${W}px "${row.name}" content reaches x=${worst} beyond viewport`);
    }
  }
}

await browser.close();
server.close();
console.log(failures ? `\n${failures} FAILURES` : "\nAll confidence-figure-column checks passed.");
process.exit(failures ? 1 : 0);
