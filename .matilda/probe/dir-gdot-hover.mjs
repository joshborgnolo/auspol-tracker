/* Repro for the direction group-view crash: select a subpopulation view,
   then sweep the pointer over the new chart's dots (as a real desktop
   mouse does while reading). Meta-less scatter dots make TrendChart's tip
   builder throw (dot.meta.pollster) -> ViewBoundary. Assert it does NOT,
   and that hovering a group dot shows a tip instead. */
import puppeteer from "puppeteer-core";

const base = (process.env.BASE_URL || "https://auspoltracker.com").replace(/\/$/, "");
const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new", args: ["--no-sandbox"] });
const SEL = 'select.rd-pv-sel[aria-label*="national direction"]';
const OPTS = ["QLD", "Men", "One Nation voters", "18–34", "Men (Essential)"];
let fail = 0;

for (const [w, h, tag] of [[1280, 900, "desktop"], [390, 844, "phone"]]) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h });
  const errs = [];
  page.on("pageerror", (e) => errs.push("pageerror: " + (e.stack || e.message).split("\n").slice(0, 3).join(" | ")));
  await page.goto(base + "/", { waitUntil: "load" });
  await new Promise((r) => setTimeout(r, 2500));
  await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (el) el.scrollIntoView({ block: "center", behavior: "instant" });
  }, SEL);
  await new Promise((r) => setTimeout(r, 600));

  for (const v of OPTS) {
    await page.select(SEL, v);
    await new Promise((r) => setTimeout(r, 900));
    /* geometric sweep: real pointer moves row by row across the chart card */
    const box = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      const card = el && el.closest(".rd-dir-chart");
      if (!card) return null;
      const r = card.getBoundingClientRect();
      return { x: r.left, y: r.top, w: r.width, h: r.height };
    }, SEL);
    if (!box) { console.log(`${tag} "${v}": no .rd-dir-chart found`); fail++; continue; }
    for (let fy = 0.15; fy <= 0.9; fy += 0.12) {
      for (let fx = 0.05; fx <= 0.95; fx += 0.05) {
        await page.mouse.move(box.x + box.w * fx, box.y + box.h * fy);
        await new Promise((r) => setTimeout(r, 25));
        const hit = await page.evaluate(() => document.body.innerText.includes("hit an error"));
        if (hit) break;
      }
      const hit = await page.evaluate(() => document.body.innerText.includes("hit an error"));
      if (hit) break;
    }
    await new Promise((r) => setTimeout(r, 1200));
    const hit = await page.evaluate(() => document.body.innerText.includes("hit an error"));
    if (hit) {
      console.log(`${tag} "${v}": BOUNDARY FIRED on hover sweep`);
      if (errs.length) console.log("  errs:", JSON.stringify([...new Set(errs)].slice(0, 3), null, 1));
      fail++;
      break;
    }
    /* positive assertion: a hovered dot should ARM the readout panel */
    const tip = await page.evaluate(() => {
      const t = document.querySelector(".rd-dir-chart .tip, .rd-dir-chart [class*=tip]");
      return t ? (t.textContent || "").trim().slice(0, 120) : null;
    });
    console.log(`${tag} "${v}": clean${tip ? `, tip visible: "${tip}"` : ""} (no boundary)`);
    /* Essential views: a dot tip must read like the main chart's poll dot
       tips - the house, a precise fieldwork window, the sample n, and the
       click-to-open hint. Sweep until a tip shows, then check its text. */
    if (v === "18–34" || v === "Men (Essential)") {
      let txt = null;
      outer: for (let fy = 0.2; fy <= 0.85 && !txt; fy += 0.06) {
        for (let fx = 0.05; fx <= 0.95; fx += 0.02) {
          await page.mouse.move(box.x + box.w * fx, box.y + box.h * fy);
          await new Promise((r) => setTimeout(r, 18));
          const t = await page.evaluate(() => {
            const el = document.querySelector(".rd-dir-chart .tip");
            return el && el.textContent ? el.textContent : null;
          });
          if (t && t.includes("Essential")) { txt = t; break outer; }
        }
      }
      if (!txt) { console.log(`${tag} "${v}": FAIL - no Essential dot tip found`); fail++; }
      else {
        const want = [["Field", "fieldwork window"], ["n = ", "sample n"],
                      ["Click to open this poll in All polls", "click-to-open hint"]];
        const missing = want.filter(([frag]) => !txt.includes(frag)).map(([, name]) => name);
        if (missing.length) { console.log(`${tag} "${v}": FAIL - tip missing ${missing.join(", ")}: "${txt.slice(0, 160)}"`); fail++; }
        else console.log(`${tag} "${v}": tip carries field + n + open hint`);
      }
    }
  }
  await page.close();
}
await browser.close();
console.log(fail ? `FAIL (${fail})` : "ALL CLEAN");
process.exit(fail ? 1 : 0);
