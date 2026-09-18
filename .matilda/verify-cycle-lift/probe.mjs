/* Past cycles: the sitting term cannot be "lifted" (2026-09-03).

   Reported as "the ✕ next to Albanese 2025 in a chart's Drawn-here strip does
   nothing". It did fire - it just could not show: `drawn = lift || c.current`,
   so the sitting term is on the chart either way and the row it appeared to
   remove stayed exactly where it was.

   The real fault was upstream. `lifted` is meant to hold only terms pulled OUT
   of the band, and the sitting term was never in one - two things are written
   on that: the strip's ✕ is offered on lifted terms, and `lifted.size > 0`
   dims every term that is not lifted. Nothing stopped the sitting term's own
   chip putting it in the set, so a tap on it produced a dead ✕ on six charts
   AND dimmed the whole board for a lift that had not happened.

   Guards: lift() ignores the sitting term, the ?l= parser drops it (links
   copied while the bug was live carry it), and the ✕ needs !c.current.

   The board moved into a popover (the legend was twenty-one pills standing
   open on the page), so every step here opens it first and reads .cyc-row
   where it used to read .cyc-chip. The behaviour under test is unchanged:
   same two controls per term, same three states. */
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
  ".json": "application/json; charset=utf-8", ".woff2": "font/woff2", ".png": "image/png" };
const server = http.createServer((req, res) => {
  let rel = decodeURIComponent(req.url.split("?")[0]);
  if (rel === "/") rel = "/index.html";
  fs.readFile(path.join(ROOT, rel), (err, buf) => {
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(rel)] || "application/octet-stream" });
    res.end(buf);
  });
});
await new Promise((ok) => server.listen(8742, "127.0.0.1", ok));

let failures = 0;
const check = (label, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) { console.log(`  ok   ${label}`); return; }
  failures += 1;
  console.log(`  FAIL ${label}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
};

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new",
  defaultViewport: { width: 1280, height: 1000 } });
const openCycles = async (page, search) => {
  await page.goto("http://127.0.0.1:8742/" + (search || ""), { waitUntil: "networkidle0", timeout: 60000 });
  await page.evaluate(`(() => { const b = [...document.querySelectorAll("button,a")]
    .find((x) => /^Past cycles$/i.test(x.textContent.trim())); if (b) b.click(); })()`);
  await page.waitForSelector(".cyc-legend .ap-popbtn", { timeout: 30000 });
  await new Promise((r) => setTimeout(r, 1200));
  /* the board is a popover now: open it, and leave it open. Only a real
     mousedown outside closes it, and nothing here dispatches one. */
  await page.evaluate(`document.querySelector(".cyc-legend .ap-popbtn").click()`);
  await page.waitForSelector(".cyc-row", { timeout: 30000 });
  await new Promise((r) => setTimeout(r, 600));
};
/* one term's presence in the strips, and whether it offers a ✕ there */
const strip = (page, year) => page.evaluate(`(() => {
  const rows = [...document.querySelectorAll(".cyc-drawn-item")]
    .filter((e) => (e.querySelector(".cyc-drawn-year") || {}).textContent === "${year}");
  return { rows: rows.length, withX: rows.filter((e) => e.querySelector(".cyc-drawn-x")).length,
           /* The shareable state, whatever shape it currently takes. This
              used to read ?l= specifically; the cycles tab now packs hidden
              and lifted into one base-36 bitmask in ?c= (83f4e38), and a
              probe that names the parameter fails the next time the encoding
              is tuned while the CONTRACT - state survives the URL - holds.
              So the checks below assert the contract: empty when nothing is
              asked for, non-empty when something is, and a reload of that URL
              brings the lift back. */
           url: location.search };
})()`);
const tapRow = (page, year) => page.evaluate(`(() => {
  const c = [...document.querySelectorAll(".cyc-row")]
    .find((e) => (e.querySelector(".cyc-year") || {}).textContent === "${year}");
  if (!c) return false; c.querySelector(".cyc-main").click(); return true;
})()`);

try {
  const page = await browser.newPage();
  page.on("pageerror", (e) => console.error("[page]", e.message));
  await openCycles(page);
  const years = await page.evaluate(`(() => {
    const rows = [...document.querySelectorAll(".cyc-row")];
    const cur = rows.find((c) => c.querySelector(".cyc-now"));
    const past = rows.filter((c) => !c.querySelector(".cyc-now"));
    return { current: cur && cur.querySelector(".cyc-year").textContent,
             past: past[past.length - 1].querySelector(".cyc-year").textContent };
  })()`);
  console.log("sitting term", years.current, "· a past term", years.past);

  // ---- the sitting term: no lift, so no ✕ and no ?l= ----
  const before = await strip(page, years.current);
  check("sitting term is drawn in every chart before any tap", before.rows > 0, true);
  check("…and offers no ✕ there", before.withX, 0);
  await tapRow(page, years.current);
  await new Promise((r) => setTimeout(r, 500));
  const after = await strip(page, years.current);
  check("tapping the sitting row raises no ✕", after.withX, 0);
  check("…and writes no shareable state for it", after.url, "");
  check("…and leaves it drawn", after.rows, before.rows);

  // ---- a past term still lifts, and its ✕ still returns it to the band ----
  await tapRow(page, years.past);
  await new Promise((r) => setTimeout(r, 500));
  const lifted = await strip(page, years.past);
  check("a past term lifts into the strips", lifted.rows > 0, true);
  check("…offering a ✕ on each", lifted.withX, lifted.rows);
  check("…and recording itself in the URL", lifted.url !== "", true);
  await page.evaluate(`(() => {
    const it = [...document.querySelectorAll(".cyc-drawn-item")]
      .find((e) => (e.querySelector(".cyc-drawn-year") || {}).textContent === "${years.past}");
    it.querySelector(".cyc-drawn-x").click();
  })()`);
  await new Promise((r) => setTimeout(r, 500));
  const returned = await strip(page, years.past);
  check("its ✕ returns it to the band", returned.rows, 0);
  check("…and clears the URL again", returned.url, "");

  /* The contract itself: whatever the encoding, a copied link restores the
     lift. Lift, copy the URL, reload it cold, and the term must come back
     drawn with its ✕ on every strip. */
  await tapRow(page, years.past);
  await new Promise((r) => setTimeout(r, 500));
  const shareUrl = await page.evaluate("location.search");
  await openCycles(page, shareUrl);
  const restored = await strip(page, years.past);
  check("a copied link restores the lifted term", restored.rows > 0, true);
  check("…with its ✕ still offered", restored.withX, restored.rows);
  await openCycles(page);

  // ---- a link copied while the bug was live must not restore the state ----
  await openCycles(page, "?l=" + String(years.current).slice(2));
  const stale = await strip(page, years.current);
  check("a stale ?l= naming the sitting term is dropped", stale.withX, 0);

  /* ---- the sitting term's own ✕ is reachable on a narrow window -------
     Reported live: "on my phone I can't x the Albanese line" - and the cause
     was not touch, it was width. A narrow-width rule hid a chip's ✕ by
     default and revealed it only for .lifted or .off, on the reasoning that
     every other term is one tap from lifted - which is false for the sitting
     term, since lift() refuses it outright (it has no band to be lifted out
     of). Its ✕ sat permanently display:none below 620px with no tap sequence
     that ever revealed it.

     The rule is gone: rows in the panel carry their ✕ at every width, which
     is what this now holds the board to. */
  await page.setViewport({ width: 390, height: 900 });
  await new Promise((r) => setTimeout(r, 400));
  const sitX = await page.evaluate(`(() => {
    const row = [...document.querySelectorAll(".cyc-row")].find((c) => c.querySelector(".cyc-now"));
    const x = row.querySelector(".cyc-x");
    const r = x.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  })()`);
  check("the sitting term's ✕ has a real hit target at 390px", sitX, true);
  await page.evaluate(`document.querySelector(".cyc-row.current .cyc-x").click()`);
  await new Promise((r) => setTimeout(r, 400));
  /* rows/withX only: taking a term off the board DOES write shareable state
     (that is the point of the ✕), so the url field is not part of this claim. */
  {
    const off = await strip(page, years.current);
    check("tapping it at 390px takes the sitting term off the board",
          { rows: off.rows, withX: off.withX }, { rows: 0, withX: 0 });
  }
  await page.evaluate(`document.querySelector(".cyc-row.current .cyc-x").click()`);
  await new Promise((r) => setTimeout(r, 400));
  await page.setViewport({ width: 1280, height: 900 });

  // ---- the board's own ✕ still takes the sitting term off the board ----
  await page.evaluate(`(() => {
    const c = [...document.querySelectorAll(".cyc-row")]
      .find((e) => (e.querySelector(".cyc-year") || {}).textContent === "${years.current}");
    c.querySelector(".cyc-x").click();
  })()`);
  await new Promise((r) => setTimeout(r, 500));
  check("the board ✕ still removes the sitting term",
        (await strip(page, years.current)).rows, 0);
} finally {
  await browser.close();
  server.close();
}
console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
