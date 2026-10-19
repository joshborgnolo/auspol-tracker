/* Probe: the Preference-flows explainer's More-menu figure - two rows of
   colour-toned preference shares reaching Labor over "To Labor v <rival>"
   captions, the menu's widest seat (menu-lines.js's fig.rows). Asserts, on
   the main page AND a satellite: both trios render with bare whole numbers
   and their tone classes, the party colours wire through (same tone same
   colour, different tones differ), the Explainer chip is gone, the sheet
   stays inside the viewport and the nowrap trios inside the widened figure
   column at 360/390/640/768/900, and the captions hold one line at ≥641px. */
import puppeteer from "puppeteer-core";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
const ROOT = decodeURIComponent(new URL("../../", import.meta.url).pathname);
const types = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json",
                ".css": "text/css", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0].split("#")[0]);
  if (p.endsWith("/")) p += "index.html";
  fs.readFile(path.join(ROOT, p), (e, b) => {
    if (e) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "content-type": types[path.extname(p)] || "application/octet-stream" });
    res.end(b);
  });
});
await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new", args: ["--no-sandbox"] });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const ok = (cond, msg) => { console.log((cond ? " ok  " : "FAIL ") + msg); if (!cond) fails++; };

/* open the menu, return the explainer row's shape: cell texts/classes/colours,
   caption heights, and whether the figure column or the sheet overflow.
   fv/cap selectors are class-explicit - the row nests spans inside spans,
   so a :first-child/:last-child dance reaches the wrong ones */
const inspect = (itemSel, rowSel, cellSel, capSel, popSel) => `
  (() => {
    const it = document.querySelector(${JSON.stringify(itemSel)});
    if (!it) return { missing: true };
    const pop = document.querySelector(${JSON.stringify(popSel)});
    const f = it.querySelector(":scope > *:last-child");
    const rows = [...it.querySelectorAll(${JSON.stringify(rowSel)})].map((fr) => ({
      cells: [...fr.querySelectorAll(${JSON.stringify(cellSel)})].map((c) =>
        ({ v: c.textContent, cls: c.className, color: getComputedStyle(c).color })),
      cap: (fr.querySelector(${JSON.stringify(capSel)}) || {}).textContent || "",
      capH: fr.querySelector(${JSON.stringify(capSel)})
        ? fr.querySelector(${JSON.stringify(capSel)}).getBoundingClientRect().height : -1,
      right: fr.getBoundingClientRect().right,
    }));
    const fr = pop ? pop.getBoundingClientRect() : null;
    const ir = it.getBoundingClientRect();
    return {
      rows,
      figW: f ? f.getBoundingClientRect().width : -1,
      figOver: f ? f.scrollWidth - f.clientWidth : -1,
      itemOver: it.scrollWidth - it.clientWidth,
      popL: fr ? fr.left : -1, popR: fr ? fr.right : -1,
      hasWide: it.className.includes("wide"),
      chip: !!it.querySelector("*[class*='chip']"),
      docOver: document.documentElement.scrollWidth - window.innerWidth,
    };
  })()`;

const M = { item: '.tab-menu-item[href="/flows-explained/"]', row: ".tab-menu-fr",
            cell: ".tab-menu-fv > span", cap: ".tab-menu-fc",
            pop: ".tab-menu-pop", btn: ".tab.tab-menu" };
const S = { item: '.sh-menu-item[href="/flows-explained/"]', row: ".sh-menu-fr",
            cell: ".sh-menu-fv > span", cap: ".sh-menu-fc",
            pop: ".sh-menu", btn: ".sh-menu-btn" };

const goodShape = (g, src) =>
  g.rows.length === 2 &&
  g.rows[0].cap === "To Labor v Coalition" && g.rows[1].cap === "To Labor v One Nation" &&
  g.rows[0].cells.map((c) => c.cls).join(",") === "tm-grn,tm-onp,tm-oth" &&
  g.rows[1].cells.map((c) => c.cls).join(",") === "tm-grn,tm-lnp,tm-oth" &&
  g.rows.every((r) => r.cells.every((c) => /^\d{1,3}$/.test(c.v)));

/* main page, desktop rung: shape, tones, colours, no chip */
{
  const page = await browser.newPage();
  await page.setViewport({ width: 980, height: 844 });
  await page.goto(base + "/", { waitUntil: "load" }); await wait(1600);
  await page.click(M.btn); await wait(300);
  const g = await page.evaluate(inspect(M.item, M.row, M.cell, M.cap, M.pop));
  ok(!g.missing && g.hasWide, "main@980 explainer row carries the wide figure seat");
  ok(!g.chip, "main@980 the Explainer chip is gone");
  ok(goodShape(g), `main@980 both trios, bare numbers, ordered (${JSON.stringify(g.rows.map((r) => [r.cap, r.cells.map((c) => c.v)]))})`);
  if (!g.missing && g.rows.length === 2) {
    const [co, on] = g.rows;
    ok(co.cells[0].color === on.cells[0].color && co.cells[2].color === on.cells[2].color,
       "main@980 same tone, same colour across the rows (grn, oth)");
    const cols = new Set([...co.cells, ...on.cells].map((c) => c.color));
    ok(cols.size === 4, `main@980 four party colours wire through (${cols.size} distinct)`);
  }
  await page.close();
}
/* main page geometry across the rungs: sheet inside the viewport, the
   nowrap trios inside the widened column, captions one line at ≥641px */
for (const W of [360, 390, 640, 768, 900]) {
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: 844 });
  await page.goto(base + "/", { waitUntil: "load" }); await wait(1600);
  await page.click(M.btn); await wait(300);
  const g = await page.evaluate(inspect(M.item, M.row, M.cell, M.cap, M.pop));
  ok(g.popL >= 0 && g.popR <= W + 1, `main@${W} sheet inside viewport (L=${g.popL && g.popL.toFixed(0)} R=${g.popR && g.popR.toFixed(0)} of ${W})`);
  ok(g.figOver <= 0 && g.itemOver <= 0, `main@${W} figure stays in its column (figOver=${g.figOver} itemOver=${g.itemOver})`);
  ok(g.docOver <= 0, `main@${W} no document overflow (overshoot ${g.docOver}px)`);
  if (g.rows.length === 2) {
    const one = g.rows.every((r) => r.capH > 0 && r.capH <= 15);
    if (W >= 641) ok(one, `main@${W} captions one line (h=${g.rows.map((r) => r.capH.toFixed(1))})`);
  } else {
    ok(false, `main@${W} both figure rows render (got ${g.rows.length})`);
  }
  await page.close();
}
/* satellite mirror: the same figure off auspol-now.json */
{
  const page = await browser.newPage();
  await page.setViewport({ width: 980, height: 844 });
  await page.goto(base + "/prediction/", { waitUntil: "load" }); await wait(1600);
  await page.click(S.btn); await wait(300);
  const g = await page.evaluate(inspect(S.item, S.row, S.cell, S.cap, S.pop));
  ok(!g.missing && g.hasWide, "prediction@980 explainer row carries the wide figure seat");
  ok(goodShape(g), "prediction@980 the satellite's menu draws the same trios");
  ok(g.figOver <= 0 && g.popR <= 981, `prediction@980 figure inside its column (figOver=${g.figOver} popR=${g.popR && g.popR.toFixed(0)})`);
  await page.close();
}

await browser.close(); server.close();
console.log(fails ? `menu-flows-fig: ${fails} FAIL` : "menu-flows-fig: all pass");
process.exit(fails ? 1 : 0);
