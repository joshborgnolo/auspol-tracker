/* ap-pooled-fold.mjs — the All-polls Pollster filter folds a "(pooled)"
   parenthetical into its base house (alleys the MRP/SMS fold): "Newspoll
   (pooled)" and "Roy Morgan (pooled)" are gone from the pickers as options,
   picking "Newspoll" returns its pooled waves too, and the row label keeps
   the "(pooled)" notation. Shipped 2026-10-09 (d1a1d215 baseHouse regex
   extended to (MRP|SMS|pooled), matching gen-data.mjs's housesTracked one).

   Checks, desktop (1366px) then phone (390px):
   - the desktop .rd-ap-sel-house options contain "Newspoll" and "Roy Morgan"
     but no option containing "(pooled)";
   - selecting "Newspoll" leaves exactly the option's own (N) rows, a folded
     "Newspoll (pooled)" row is visible in the table, the pill reads plain
     "Newspoll", and the URL's w= mask is bit 5 (bw), not a pooled name;
   - the phone sheet's house PopRows show the same folded list, and ticking
     "Newspoll" there lands its (N) on the section count. */

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const PORT = 8971;
const MIME = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".css": "text/css" };
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p === "/") p = "/index.html";
    res.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" });
    res.end(await readFile(join(ROOT, p)));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(PORT, r));

let fails = 0;
const ok = (name, cond, extra = "") => {
  if (!cond) fails++;
  console.log(`${cond ? "ok  " : "FAIL"} ${name}${cond ? "" : " — " + extra}`);
};

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new" });

try {
  /* ---------------- desktop ---------------- */
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 900 });
  page.on("pageerror", (e) => console.log("PAGEERROR", String(e).slice(0, 200)));
  await page.goto(`http://127.0.0.1:${PORT}/allpolls/`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".rd-ap-sel-house", { timeout: 20000 });

  const desk = await page.evaluate(async () => {
    const sel = document.querySelector(".rd-ap-sel-house");
    const opts = [...sel.options].map((o) => o.textContent.trim());
    const pollsterOpts = opts.filter((t) => !t.includes("✕") && t !== "Pollster");
    const pooledLive = window.AP.D.individualPolls.filter((p) => / \(pooled\)$/.test(p.pollster)).length;
    /* React-controlled native select: set via the prototype setter, then
       dispatch a bubbling change. */
    const np = [...sel.options].find((o) => o.textContent.trim().startsWith("Newspoll ("));
    const npN = np ? Number(/\((\d+)\)$/.exec(np.textContent.trim())[1]) : null;
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set.call(sel, np.value);
    sel.dispatchEvent(new Event("change", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 400));
    const count = Number(document.querySelector(".rd-ap-count b")?.textContent);
    const rowsText = [...document.querySelectorAll(".rd-ap-table")].map((t) => t.textContent).join(" ");
    const pills = [...document.querySelectorAll(".rd-ap-pill")].map((p) => p.textContent.replace(/×$/, "").trim());
    return { pollsterOpts, pooledLive, npN, count,
             hasPooledNewspollRow: rowsText.includes("Newspoll (pooled)"),
             w: new URLSearchParams(location.search).get("w"),
             pills };
  });
  ok("desktop: Pollster options include plain Newspoll", desk.pollsterOpts.some((t) => t.startsWith("Newspoll (")), JSON.stringify(desk.pollsterOpts));
  ok("desktop: no option carries (pooled)", !desk.pollsterOpts.some((t) => t.includes("(pooled)")), JSON.stringify(desk.pollsterOpts));
  ok("desktop: Roy Morgan appears as its base name", desk.pollsterOpts.some((t) => t.startsWith("Roy Morgan (")), JSON.stringify(desk.pollsterOpts));
  ok("live data still has pooled waves to fold", desk.pooledLive > 0, "individualPolls has none — probe would be vacuous");
  ok("desktop: Newspoll option count == filtered row count", desk.npN != null && desk.count === desk.npN, `option ${desk.npN} vs row count ${desk.count}`);
  ok("desktop: a Newspoll (pooled) row is visible under the Newspoll filter", desk.hasPooledNewspollRow);
  ok("desktop: pill reads plain Newspoll", desk.pills.includes("Newspoll"), JSON.stringify(desk.pills));
  ok("desktop: URL w= is the Newspoll bit (bw), not a pooled name", desk.w === "bw", desk.w);
  await page.close();

  /* ---------------- phone ---------------- */
  const ph = await browser.newPage();
  await ph.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  ph.on("pageerror", (e) => console.log("PAGEERROR", String(e).slice(0, 200)));
  await ph.goto(`http://127.0.0.1:${PORT}/allpolls/`, { waitUntil: "domcontentloaded" });
  await ph.waitForSelector(".rd-ap-pinf", { timeout: 20000 });
  /* the bar is inert (aria-hidden, pointer-events none) until the section
     head scrolls past — pin it before clicking Filters */
  await ph.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight && !document.querySelector(".rd-ap-pinbar.on"); y += 300) {
      scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
  });
  await ph.waitForSelector(".rd-ap-pinbar.on", { timeout: 10000 });
  await ph.click(".rd-ap-pinf");
  await ph.waitForSelector(".ap-check-lab", { timeout: 10000 });
  /* the sheet lists only the top six houses at first — expand if Newspoll
     isn't among them */
  await ph.evaluate(() => {
    const labs = [...document.querySelectorAll(".ap-check-lab")].map((e) => e.childNodes[0].textContent.trim());
    if (!labs.includes("Newspoll")) {
      const more = [...document.querySelectorAll(".rd-ap-sheet .rd-link")]
        .find((b) => /^Show all \d+ pollsters$/.test(b.textContent.trim()));
      if (more) more.click();
    }
  });
  await ph.waitForFunction(() =>
    [...document.querySelectorAll(".ap-check-lab")].some((e) => e.childNodes[0].textContent.trim() === "Newspoll"),
    { timeout: 5000 });
  const sheet = await ph.evaluate(() => {
    const labs = [...document.querySelectorAll(".ap-check-lab")].map((e) => e.childNodes[0].textContent.trim());
    const rows = [...document.querySelectorAll(".ap-check")];
    const npRow = rows.find((r) => r.querySelector(".ap-check-lab")?.childNodes[0].textContent.trim() === "Newspoll");
    const npN = npRow ? Number(npRow.querySelector(".ap-check-n")?.textContent) : null;
    if (npRow) npRow.click();
    return { labs, npN };
  });
  await ph.waitForSelector(".rd-ap-sheetgo", { timeout: 10000 });
  await ph.click(".rd-ap-sheetgo");
  await new Promise((r) => setTimeout(r, 400));
  /* the ".rd-ap-pinn" count is desktop-only — the phone pinbar carries just
     the Filters button; the count lives in the section's .rd-ap-count */
  const pinN = await ph.evaluate(() => Number(document.querySelector(".rd-ap-count b")?.textContent));
  ok("phone: sheet lists plain Newspoll, no (pooled) PopRow", sheet.labs.includes("Newspoll") && !sheet.labs.some((t) => t.includes("(pooled)")), JSON.stringify(sheet.labs));
  ok("phone: ticking Newspoll lands its (N) on the section count", sheet.npN != null && pinN === sheet.npN, `sheet ${sheet.npN} vs count ${pinN}`);
  await ph.close();
} finally {
  await browser.close();
  server.close();
}

if (fails) { console.error(`\n${fails} failure(s)`); process.exit(1); }
console.log("\nall ok");
