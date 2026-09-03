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
   copied while the bug was live carry it), and the ✕ needs !c.current. */
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
  await page.waitForSelector(".cyc-chip", { timeout: 30000 });
  await new Promise((r) => setTimeout(r, 1800));
};
/* one term's presence in the strips, and whether it offers a ✕ there */
const strip = (page, year) => page.evaluate(`(() => {
  const rows = [...document.querySelectorAll(".cyc-drawn-item")]
    .filter((e) => (e.querySelector(".cyc-drawn-year") || {}).textContent === "${year}");
  return { rows: rows.length, withX: rows.filter((e) => e.querySelector(".cyc-drawn-x")).length,
           l: new URLSearchParams(location.search).get("l") };
})()`);
const tapChip = (page, year) => page.evaluate(`(() => {
  const c = [...document.querySelectorAll(".cyc-chip")]
    .find((e) => (e.querySelector(".cyc-year") || {}).textContent === "${year}");
  if (!c) return false; c.querySelector(".cyc-main").click(); return true;
})()`);

try {
  const page = await browser.newPage();
  page.on("pageerror", (e) => console.error("[page]", e.message));
  await openCycles(page);
  const years = await page.evaluate(`(() => {
    const chips = [...document.querySelectorAll(".cyc-chip")];
    const cur = chips.find((c) => c.querySelector(".cyc-now"));
    const past = chips.filter((c) => !c.querySelector(".cyc-now"));
    return { current: cur && cur.querySelector(".cyc-year").textContent,
             past: past[past.length - 1].querySelector(".cyc-year").textContent };
  })()`);
  console.log("sitting term", years.current, "· a past term", years.past);

  // ---- the sitting term: no lift, so no ✕ and no ?l= ----
  const before = await strip(page, years.current);
  check("sitting term is drawn in every chart before any tap", before.rows > 0, true);
  check("…and offers no ✕ there", before.withX, 0);
  await tapChip(page, years.current);
  await new Promise((r) => setTimeout(r, 500));
  const after = await strip(page, years.current);
  check("tapping the sitting chip raises no ✕", after.withX, 0);
  check("…and writes no ?l= for it", after.l, null);
  check("…and leaves it drawn", after.rows, before.rows);

  // ---- a past term still lifts, and its ✕ still returns it to the band ----
  await tapChip(page, years.past);
  await new Promise((r) => setTimeout(r, 500));
  const lifted = await strip(page, years.past);
  check("a past term lifts into the strips", lifted.rows > 0, true);
  check("…offering a ✕ on each", lifted.withX, lifted.rows);
  check("…and recording itself in ?l=", lifted.l != null, true);
  await page.evaluate(`(() => {
    const it = [...document.querySelectorAll(".cyc-drawn-item")]
      .find((e) => (e.querySelector(".cyc-drawn-year") || {}).textContent === "${years.past}");
    it.querySelector(".cyc-drawn-x").click();
  })()`);
  await new Promise((r) => setTimeout(r, 500));
  const returned = await strip(page, years.past);
  check("its ✕ returns it to the band", returned.rows, 0);
  check("…and clears ?l=", returned.l, null);

  // ---- a link copied while the bug was live must not restore the state ----
  await openCycles(page, "?l=" + String(years.current).slice(2));
  const stale = await strip(page, years.current);
  check("a stale ?l= naming the sitting term is dropped", stale.withX, 0);

  // ---- the legend's own ✕ still takes the sitting term off the board ----
  await page.evaluate(`(() => {
    const c = [...document.querySelectorAll(".cyc-chip")]
      .find((e) => (e.querySelector(".cyc-year") || {}).textContent === "${years.current}");
    c.querySelector(".cyc-x").click();
  })()`);
  await new Promise((r) => setTimeout(r, 500));
  check("the legend ✕ still removes the sitting term",
        (await strip(page, years.current)).rows, 0);
} finally {
  await browser.close();
  server.close();
}
console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
