/* Pins two confidence-panel fixes (2026-10-08):
   A. The "Draw a past term" board closes on pointerdown outside its .rd-cc
      wrapper, and the chip still toggles it open/shut (useDismissOutside).
   B. interpHover - the history-view guide tooltip carries EVERY in-range lane
      row continuously (deep quarterly lane and monthly lane interpolated
      between their own prints) instead of dropping rows on months a lane does
      not own. Sweeps 1974-09..1980 (Westpac monthly, ANZ-RM quarterly): both
      monthly-history rows must be present at every guide sample. */
import puppeteer from "puppeteer-core";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const ROOT = decodeURIComponent(new URL("../..//", import.meta.url).pathname);
const types = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json",
                ".css": "text/css", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".png": "image/png" };
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
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
await page.goto(base + "/", { waitUntil: "load" });
await new Promise((r) => setTimeout(r, 1500));
await page.evaluate(() => document.getElementById("confidence").scrollIntoView());

let fails = 0;
const ok = (cond, label) => { console.log(`${cond ? "  ok" : "FAIL"} ${label}`); if (!cond) fails++; };

/* ---- A: Draw-a-term board outside-dismiss (term mode, the default) ---- */
const clickChip = () => page.evaluate(() => {
  const sec = document.getElementById("confidence");
  const b = [...sec.querySelectorAll("button")].find((el) => /Draw a past term/i.test(el.textContent));
  if (!b) return false;
  b.click();
  return true;
});
ok(await clickChip(), "chip found and clicked");
await new Promise((r) => setTimeout(r, 200));
const open1 = await page.evaluate(() => {
  const b = document.querySelector("#confidence .rd-cc-board");
  if (!b) return false;
  const r = b.getBoundingClientRect();
  return r.width > 100 && r.height > 50;
});
ok(open1, "chip opens the draw-a-term board");
await page.mouse.click(24, 850);                                  /* real pointerdown, far outside .rd-cc */
await new Promise((r) => setTimeout(r, 200));
ok(await page.evaluate(() => !document.querySelector("#confidence .rd-cc-board")),
   "pointerdown outside closes the board");
ok(await clickChip(), "chip re-opens it after dismissal");
await new Promise((r) => setTimeout(r, 150));
ok(await page.evaluate(() => !!document.querySelector("#confidence .rd-cc-board")), "board open again");
const boardRect = await page.evaluate(() => {
  const b = document.querySelector("#confidence .rd-cc-board");
  const r = b.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
});
await page.mouse.click(boardRect.x, boardRect.y);                   /* click INSIDE the board */
await new Promise((r) => setTimeout(r, 200));
ok(await page.evaluate(() => !!document.querySelector("#confidence .rd-cc-board")),
   "pointerdown inside the board leaves it open");
ok(await clickChip(), "chip click (as toggle) shuts the open board");
await new Promise((r) => setTimeout(r, 150));
ok(await page.evaluate(() => !document.querySelector("#confidence .rd-cc-board")),
   "chip toggled the open board shut");

/* ---- B: history-view deep-region row completeness (interpHover) ---- */
await page.evaluate(() => {
  const sec = document.getElementById("confidence");
  const b = [...sec.querySelectorAll("button")].find((el) => /Show complete history/i.test(el.textContent));
  if (b) b.click();
});
await new Promise((r) => setTimeout(r, 900));
const rect = await page.evaluate(() => {
  const sec = document.getElementById("confidence");
  const svgs = [...sec.querySelectorAll("svg")];
  let best = null, bw = 0;
  for (const s of svgs) { const r = s.getBoundingClientRect(); if (r.width > bw) { bw = r.width; best = s; } }
  const r = best.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
});
ok(rect.w > 800, `main chart svg measured (${Math.round(rect.w)}x${Math.round(rect.h)})`);
const readRows = () => page.evaluate(() => {
  const tip = document.querySelector("#confidence .tip");
  if (!tip) return null;
  return { cls: tip.className.includes("tip-guide") ? "guide" : "dot",
           title: (tip.querySelector(".tip-title") || {}).textContent || "",
           rows: [...tip.querySelectorAll(".tip-label")].map((el) => el.textContent) };
});
const toMonth = (t) => {
  const M = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
  const m = /^([A-Z][a-z]{2}) (\d{4})/.exec(t || "");
  return m ? (+m[2]) * 12 + M[m[1]] : null;
};
let sampled = 0, both = 0, bad = [];
for (let px = Math.round(rect.x) + 1; px < rect.x + rect.w * 0.12; px += 3) {
  await page.mouse.move(px, rect.y + rect.h * 0.5);
  await new Promise((r) => setTimeout(r, 26));
  const t = await readRows();
  if (!t || t.cls !== "guide") continue;
  const m = toMonth(t.title);
  if (m == null || m < 1974 * 12 + 9 || m > 1981 * 12) continue;    /* both lanes in range */
  sampled++;
  if (t.rows.length === 2 && t.rows.some((x) => x.includes("ANZ–Roy Morgan")) && t.rows.some((x) => x.includes("Westpac"))) both++;
  else bad.push(`${t.title} rows=${t.rows.join("|")}`);
}
ok(sampled > 10, `deep-region guide samples gathered (${sampled})`);
ok(bad.length === 0, `both history rows ride every deep-region guide (${both}/${sampled})${bad.length ? " — off: " + bad.slice(0, 3).join(" ;; ") : ""}`);
/* back out of history mode so the page is left in term view */
await page.evaluate(() => {
  const b = [...document.querySelectorAll("button")].find((el) => /term's polls|Show the term/i.test(el.textContent));
  if (b) b.click();
});
ok(errors.length === 0, "no page errors" + (errors.length ? " — " + errors[0] : ""));

console.log(fails ? `FAILED: ${fails}` : "ALL PASS");
await browser.close(); server.close();
process.exit(fails ? 1 : 0);
