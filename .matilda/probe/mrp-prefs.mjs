/* headless probe of DemosAU MRP preference flows (2026-10-12):
   - the opened MRP poll's "Preferences" line in Also in this poll: its region
     chip rides the eyebrow cell – BELOW the "Preferences" label on wide
     screens, BESIDE it (to its right) on phones – opens on All regions
     (gen-data's enrolment-and-vote weighting) and
     presses cycle Inner metro → Outer metro → Regional → All regions, showing
     that region's printed cells, and a press never moves the line's box
     (same width/height at every step); the groups share fixed slots (13ch
     labels, 4ch party tags, 2ch figures) so wrapped rows read as columns, and
     the nationwide One Nation flow closes the line label-first like the
     other groups;
   - the forced-choice pair carries hollow DemosAU diamonds: the Labor v
     Coalition chart one per filed MRP (the report's printed national One
     Nation reading), the Labor v One Nation chart three per MRP – one per
     cohort in the cohort's colour, the site's all-regions weighting of the
     printed regional tables (flowForced demosOn) – and the key names both.
   Run against a built tree: node .matilda/probe/mrp-prefs.mjs [shotDir] */
import puppeteer from "puppeteer-core";
import path from "path";
import process from "process";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PAGE = process.env.PAGE || "file://" + path.join(ROOT, "allpolls", "index.html");
const SHOT = process.argv[2] || null;
let fails = 0;
const check = (ok, msg) => { console.log((ok ? "  ok " : "FAIL ") + msg); if (!ok) fails++; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
for (const w of [1440, 1024, 768, 390]) {
  console.log("width " + w);
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: 1400, deviceScaleFactor: 2, hasTouch: w < 700, isMobile: w < 700 });
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e)));
  await page.goto(PAGE, { waitUntil: "networkidle0", timeout: 60000 });
  await page.waitForSelector("#flow-drift", { timeout: 30000 });
  const dm = await page.evaluate(() => {
    const one = [...document.querySelectorAll("#flow-drift .rd-ff-two .rd-fl-one")];
    const cls = (el) => (el ? [...el.querySelectorAll(".rd-ff-dm")].map((d) => d.getAttribute("class").replace("rd-ff-dm ", "")) : []);
    const on = cls(one[0]), co = cls(one[1]);
    return { on: on.length, co: co.length,
      cohorts: ["lnp", "grn", "oth"].every((c) => on.filter((x) => x === c).length === 3),
      key: !!document.querySelector("#flow-drift .rd-ff-keydm"), keyMix: !!document.querySelector("#flow-drift .rd-ff-keydm.mix") };
  });
  check(dm.on === 9, "Labor v One Nation: three hollow DemosAU diamonds per filed MRP (" + dm.on + ")");
  check(dm.cohorts, "the One Nation chart's diamonds ride the three cohort colours");
  check(dm.co === 3, "Labor v Coalition: three DemosAU diamonds (" + dm.co + ")");
  check(dm.key && dm.keyMix, "the key names both diamond sets");
  if (SHOT) {
    const el = await page.$("#flow-drift .rd-ff");
    await el.evaluate((e) => e.scrollIntoView({ block: "center" }));
    await wait(300);
    await el.screenshot({ path: path.join(SHOT, `ff-${w}.png`) });
  }
  const opened = await page.evaluate(() => {
    const k = window.AP.pollRowKey({ pollster: "DemosAU (MRP)", released: "2026-09-19" });
    if (!k) return false;
    window.AP.openPoll(k, "twopp", "probe");
    return true;
  });
  check(opened, "opened the Aug–Sep MRP");
  await wait(1200);
  const steps = [];
  for (let i = 0; i < 5; i++) {
    steps.push(await page.evaluate(() => {
      const b = document.querySelector(".rd-ldg-cyc");
      if (!b) return null;
      const line = b.closest(".rd-ldg-line"), r = line.getBoundingClientRect(), br = b.getBoundingClientRect();
      return { region: b.querySelector(".on").textContent, text: line.querySelector(".rd-ldg-lbody").innerText.replace(/\s+/g, " "),
               w: r.width, h: r.height, bw: br.width, bh: br.height };
    }));
    if (SHOT && i < 4) {
      const el = await page.$(".rd-ldg-also");
      await el.evaluate((e) => e.scrollIntoView({ block: "center" }));
      await wait(100);
      await el.screenshot({ path: path.join(SHOT, `also-${w}-${i}.png`) });
    }
    await page.click(".rd-ldg-cyc");
    await wait(150);
  }
  check(steps.every(Boolean), "the Preferences line is there");
  if (steps.every(Boolean)) {
    console.log("   " + steps.map((s) => s.region + ": " + s.text).join("\n   "));
    check(steps.map((s) => s.region).join(">") === "All regions>Inner metro>Outer metro>Regional>All regions", "opens on All regions, cycles the three regions and wraps");
    check(/to ALP v L\/NP ON 18, nationwide/.test(steps[0].text), "the nationwide One Nation flow closes the line, label first, comma hugging the figure");
    check(steps.every((s) => s.w === steps[0].w && s.h === steps[0].h && s.bw === steps[0].bw), "line and chip hold their size");
    check(/L\/NP 48/.test(steps[1].text) && /L\/NP 37/.test(steps[2].text) && /L\/NP 30/.test(steps[3].text), "regional cells read through");
    /* digits in columns: groups flush with the line's left edge are wrapped
       rows; their figure columns must share x across those rows */
    const cols = await page.evaluate(() => {
      const line = document.querySelector(".rd-ldg-cyc").closest(".rd-ldg-line");
      const L = line.getBoundingClientRect().x;
      return [...line.querySelectorAll(".rd-ldg-pgrp")]
        .filter((g) => Math.abs(g.getBoundingClientRect().x - L) < 2)
        .map((g) => [...g.querySelectorAll(".rd-ldg-li b")].map((b) => b.getBoundingClientRect().x));
    });
    const colDesc = [];
    let colOk = true;
    for (let j = 0; j < 3; j++) {
      const have = cols.filter((r) => r[j] != null).map((r) => r[j]);
      if (have.length >= 2 && !have.every((x) => Math.abs(x - have[0]) < 1.5)) colOk = false;
      if (have.length) colDesc.push(have.map((x) => x.toFixed(0)).join("/"));
    }
    check(cols.length < 2 || colOk, "wrapped rows' figures share columns (" + colDesc.join(", ") + ")");
    /* the chip rides the eyebrow cell: beside the label on phones, below it
       on wide screens */
    const place = await page.evaluate(() => {
      const line = document.querySelector(".rd-ldg-cyc").closest(".rd-ldg-line");
      const lab = line.querySelector(".rd-ldg-lab");
      const rng = document.createRange();
      rng.selectNodeContents(lab.firstChild);
      const t = rng.getBoundingClientRect(), c = line.querySelector(".rd-ldg-cyc").getBoundingClientRect();
      return { tx: t.x, tr: t.right, ty: t.y, tb: t.bottom, cx: c.x, cy: c.y, cb: c.bottom };
    });
    if (w <= 760) {
      check(place.cy >= place.ty - 6 && place.cy < place.tb && place.cx > place.tr,
            "phone: the chip sits on the eyebrow row, just right of the label (dy " + (place.cy - place.ty).toFixed(1) + ", dx " + (place.cx - place.tr).toFixed(0) + ")");
    } else {
      check(place.cy >= place.tb - 3 && Math.abs(place.cx - place.tx) < 6,
            "laptop: the chip sits below the eyebrow label (y+" + (place.cy - place.tb).toFixed(1) + ", x-off " + (place.cx - place.tx).toFixed(1) + ")");
    }
    const lh = await page.evaluate(() => { const l = document.querySelector(".rd-ldg-lines .rd-ldg-line"); return l.getBoundingClientRect().height; });
    console.log("   line h " + steps[0].h + " (first line " + lh + "), chip " + steps[0].bw.toFixed(1) + "×" + steps[0].bh.toFixed(1));
  }
  check(!errs.length, "no page errors " + errs.join(" | "));
  await page.close();
}
await browser.close();
process.exit(fails ? 1 : 0);
