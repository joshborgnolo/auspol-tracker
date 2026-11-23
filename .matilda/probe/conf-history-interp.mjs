/* Pins two confidence-panel contracts:
   A. The restored shared popover: year checkboxes, a selected-term count on
      the button, the matching drawn pills, and Clear lines to return every
      past term to the band.
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

/* ---- A: the restored shared-rule popover: year checkboxes, a selected-term
   count on the button, and Clear lines ---- */
const openMenu = async () => {
  const exists = await page.evaluate(() => {
    const sec = document.getElementById("confidence");
    const button = sec && [...sec.querySelectorAll(".ap-popbtn")].find((b) => b.querySelector(".ap-popbtn-lab").textContent === "Draw a past term");
    if (!button) return false;
    if (button.getAttribute("aria-expanded") !== "true") button.click();
    return true;
  });
  if (!exists) return false;
  await page.waitForSelector("#confidence .rd-cwin-tools .ap-panel");
  return true;
};
const menu = async () => {
  if (!(await openMenu())) return null;
  return page.evaluate(() => {
    const sec = document.getElementById("confidence");
    const button = sec.querySelector(".rd-cwin-tools .ap-popbtn");
    const panel = sec.querySelector(".rd-cwin-tools .ap-panel");
    return { summary: button.querySelector(".ap-popbtn-val") ? button.querySelector(".ap-popbtn-val").textContent : null,
             hasClear: !!panel.querySelector(".ap-clear"),
             options: [...panel.querySelectorAll(".ap-check")].map((row) => ({ label: row.querySelector(".ap-check-lab").textContent, on: row.getAttribute("aria-checked") === "true" })) };
  });
};
const pick = async (v) => {
  if (!(await openMenu())) return false;
  return page.evaluate((val) => {
    const sec = document.getElementById("confidence");
    const row = [...sec.querySelectorAll(".rd-cwin-tools .ap-check")].find((b) => b.querySelector(".ap-check-lab").textContent === val);
    if (val === "clear") {
      const clear = sec.querySelector(".rd-cwin-tools .ap-clear");
      if (!clear) return false;
      clear.click();
      return true;
    }
    if (!row) return false;
    row.click();
    return true;
  }, v);
};
const pills = () => page.evaluate(() => {
  const d = document.querySelector("#confidence .rd-cc-drawn");
  return d ? d.innerText.replace(/\s+/g, " ").trim() : null;
});
const m0 = await menu();
ok(m0 && m0.summary === null, "draw-a-term popover starts without additions");
ok(m0 && m0.options.filter((o) => /^\d{4}$/.test(o.label)).length >= 5,
   `one row per past term on file (${m0 ? m0.options.length : 0})`);
ok(m0 && !m0.hasClear, "no Clear-lines action while nothing is drawn");
ok(await pick("2019"), "picked 2019 from the popover");
await new Promise((r) => setTimeout(r, 400));
const m1 = await menu();
ok(m1 && m1.summary === "1 term", "the button counts the drawn term");
ok(m1 && m1.options.some((o) => o.label === "2019" && o.on), "the 2019 checkbox stays checked");
ok(m1 && m1.hasClear, "Clear lines joins once a line is drawn");
ok((await pills() || "").includes("2019"), "the drawn pills row names 2019");
ok(await pick("clear"), "picked Clear lines");
await new Promise((r) => setTimeout(r, 400));
const m2 = await menu();
ok(m2 && !m2.hasClear && m2.summary === null && m2.options.every((o) => !o.on),
   "Clear lines returns every term to the band");
ok((await pills()) === null, "no drawn pills after the clear");

/* ---- B: history-view deep-region row completeness (interpHover) ---- */
await page.evaluate(() => {
  const sec = document.getElementById("confidence");
  const b = [...document.querySelectorAll("#confidence .rd-cwin-span")].find((el) => el.textContent.trim() === "All");
  if (b) b.click();
});
await page.keyboard.press("Escape");
await new Promise((r) => setTimeout(r, 900));
const rect = await page.evaluate(() => {
  const sec = document.getElementById("confidence");
  const svgs = [...sec.querySelectorAll("svg")];
  let best = null, bw = 0;
  for (const s of svgs) { const r = s.getBoundingClientRect(); if (r.width > bw) { bw = r.width; best = s; } }
  best.scrollIntoView({ block: "center" });
  const r = best.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
});
ok(rect.w > 800, `main chart svg measured (${Math.round(rect.w)}x${Math.round(rect.h)})`);
const readRows = () => page.evaluate(() => {
  const tip = [...document.querySelectorAll("#confidence .tip.tip-guide")].find((t) => +getComputedStyle(t).opacity > 0.05);
  if (!tip) return null;
  return { cls: "guide",
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
