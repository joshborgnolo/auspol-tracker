import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PORT = 9008;
const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript",
               ".css": "text/css", ".json": "application/json", ".woff2": "font/woff2",
               ".png": "image/png", ".svg": "image/svg+xml", ".csv": "text/csv", ".xml": "text/xml" };
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p === "/") p = "/index.html";
    res.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" });
    res.end(await readFile(join(ROOT, p)));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(PORT, r));

const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new",
});

const fails = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function run(W, H, touch) {
  const tag = W + "px" + (touch ? "-touch" : "");
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, hasTouch: touch });
  await page.goto(`http://127.0.0.1:${PORT}/index.html#cycles`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[aria-label="Compare with"]', { timeout: 20000 });
  await sleep(800);

  const g = await page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const chip = q("#cyc-tpp .rd-cyc-chipmove .rd-chip");
    const wrap = q("#cyc-tpp .rd-cyc-chipmove");
    const rowChip = q(".rd-cc-row .rd-chip");
    const eb = q("#cyc-tpp .rd-eyebrow");
    const tools = q("#cyc-tpp .rd-eyebrow-tools");
    if (!chip || !wrap || !eb) return { missing: true, rowChip: !!rowChip };
    const r = (el) => { const b = el.getBoundingClientRect(); return { t: b.top, b: b.bottom, l: b.left, r: b.right }; };
    const ebs = getComputedStyle(eb);
    const ws = getComputedStyle(wrap);
    const meta = q("#cyc-tpp .rd-meta");
    const title = q("#cyc-tpp .rd-title");
    return {
      rowChip: !!rowChip,
      chipInTools: !!(tools && chip.closest(".rd-eyebrow-tools") === tools),
      ruleY: r(eb).t + parseFloat(ebs.borderTopWidth) / 2,
      chip: r(chip),
      wrap: r(wrap),
      ebRight: r(eb).r,
      pos: ws.position,
      bg: ws.backgroundColor,
      label: chip.textContent.replace(/\s+/g, " ").trim(),
      meta: meta ? r(meta) : null,
      title: title ? r(title) : null,
      rowH: (q(".rd-cc-row") || {}).offsetHeight || 0,
    };
  });
  if (g.missing) { fails.push(tag + ": chip/eyebrow not found under #cyc-tpp"); await page.close(); return; }
  if (g.rowChip) fails.push(tag + ": a .rd-chip is still inside .rd-cc-row");
  if (!g.chipInTools) fails.push(tag + ": chip is not in the cyc-tpp eyebrow tools slot");
  const cy = (g.chip.t + g.chip.b) / 2;
  if (Math.abs(cy - g.ruleY) > 1.6) fails.push(tag + ": chip centre " + cy.toFixed(1) + " sits off the divider " + g.ruleY.toFixed(1) + " by " + (cy - g.ruleY).toFixed(1) + "px");
  if (Math.abs(g.wrap.r - g.ebRight) > 1.5) fails.push(tag + ": chip patch right edge " + g.wrap.r.toFixed(1) + " != eyebrow right edge " + g.ebRight.toFixed(1));
  if (g.pos !== "absolute") fails.push(tag + ": .rd-cyc-chipmove is not absolutely positioned (" + g.pos + ")");
  if (g.bg === "rgba(0, 0, 0, 0)" || g.bg === "transparent") fails.push(tag + ": chip patch has no opaque bg to break the rule behind it");
  if (!/^＋ Draw a( past)? term$/.test(g.label)) fails.push(tag + ": unexpected chip label '" + g.label + "'");
  const overlap = (a, b) => {
    if (!a || !b) return 0;
    const h = Math.min(a.b, b.b) - Math.max(a.t, b.t);
    const w = Math.min(a.r, b.r) - Math.max(a.l, b.l);
    return h > 0 && w > 0 ? h * w : 0;
  };
  if (overlap(g.chip, g.meta) > 1) fails.push(tag + ": chip overlaps the eyebrow meta text by " + overlap(g.chip, g.meta).toFixed(0) + "px2");
  if (overlap(g.chip, g.title) > 1) fails.push(tag + ": chip overlaps the title by " + overlap(g.chip, g.title).toFixed(0) + "px2");

  /* toggle round-trip: open; second chip click must close (the dismiss
     hook would otherwise swallow the toggle); outside click/tap must close
     too. At <=900px the board is a FIXED bottom sheet hugging up to 75vh of
     the viewport (rd.css media block), so the chip/title must sit in the
     exposed top band: anchor the chip centre at viewport y=110, below the
     72px sticky tabs and above the shallowest sheet top (211px at 844 tall).
     Clicking a point under the sheet is not a fair test - the sheet eats it,
     as any overlaid content does. */
  const chipSel = "#cyc-tpp .rd-cyc-chipmove .rd-chip";
  const boardOpen = () => page.evaluate(() => !!document.querySelector(".rd-cc-board"));
  await page.$eval(chipSel, (el) => {
    window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 110);
  });
  await sleep(250);
  /* the chip must be visible above any sheet before its first click */
  const chipY = await page.$eval(chipSel, (el) => el.getBoundingClientRect().top);
  if (chipY < 72 || chipY > 200) fails.push(tag + ": chip anchored at viewport y " + chipY.toFixed(0) + ", outside the 72-200px band needed for sheet clearance");
  await page.click(chipSel);
  await sleep(300);
  if (!(await boardOpen())) fails.push(tag + ": chip click did not open the board");
  const expanded = await page.$eval(chipSel, (el) => el.getAttribute("aria-expanded"));
  if (expanded !== "true") fails.push(tag + ": aria-expanded did not follow the open board (" + expanded + ")");
  await page.click(chipSel);
  await sleep(300);
  if (await boardOpen()) fails.push(tag + ": second chip click did not close the board (dismiss hook swallowed the toggle)");
  await page.click(chipSel);
  await sleep(300);
  if (!(await boardOpen())) fails.push(tag + ": board did not re-open for the outside-dismiss case");
  const titleSel = "#cyc-tpp .rd-eyebrow .rd-title";
  if (touch) {
    const t = await(page.$(titleSel)).then((el) => el.boundingBox());
    await page.touchscreen.tap(t.x + t.width / 2, t.y + t.height / 2);
  } else {
    await page.click(titleSel);
  }
  await sleep(300);
  if (await boardOpen()) fails.push(tag + ": outside " + (touch ? "tap" : "click") + " did not dismiss the board");
  /* and the board's own close cross still works */
  await page.click(chipSel);
  await sleep(300);
  await page.click(".rd-cc-board .rd-iconbtn");
  await sleep(300);
  if (await boardOpen()) fails.push(tag + ": board close cross stopped working");
  await page.close();
}

await run(1440, 960, false);
await run(820, 900, false);
await run(390, 844, true);

console.log(fails.length ? "FAIL\n" + fails.join("\n") : "ok");
await browser.close();
server.close();
process.exit(fails.length ? 1 : 0);
