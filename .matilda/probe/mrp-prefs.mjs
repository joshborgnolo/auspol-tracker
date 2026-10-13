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
   - the Preference flows ledger (rebuilt 2026-10-13, design B: one contest
     per tab) carries DemosAU's MRP readings as hollow triangles standing
     apart from RedBridge/Accent's line: the Labor v Coalition tab's One
     Nation row one per filed MRP (the report's printed national One Nation
     reading), every row of the Labor v One Nation tab one per MRP in the
     group's colour (the site's all-regions weighting of the printed
     regional tables, flowForced demosOn), and the key names the shape.
     The triangles ride each window's TRUE midpoint (payload xm, fractional
     month index), the one mark off the ledger's whole-month ticks - pinned
     here against the empirical tick scale of the line's column head,
     never snapped to a month.
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
  const tabTo = async (i) => { await page.evaluate((i) => document.querySelectorAll("#flow-drift .rd-fl-tabs .rd-tab")[i].click(), i); await wait(250); };
  const rowsOf = () => page.evaluate(() => [...document.querySelectorAll("#flow-drift .rd-fx-row")].map((r) => ({
    who: r.querySelector(".rd-fx-who b").textContent,
    tris: [...r.querySelectorAll(".rd-fx-tr")].map((t) => ({ cls: t.getAttribute("class").replace("rd-fx-tr ", ""), x: +/^M([\d.]+)/.exec(t.getAttribute("d"))[1] })),
  })));
  await tabTo(1);
  const on = await rowsOf();
  const keyOn = await page.evaluate(() => { const k = document.querySelector("#flow-drift .rd-fx-key .rd-fx-keydm"); return !!k && k.parentElement.textContent.includes("DemosAU MRP"); });
  await tabTo(0);
  const co = await rowsOf();
  const nOn = await page.evaluate(() => window.AUSPOL.flowForced.demosOn.length);
  check(on.length === 3 && on.every((r) => r.tris.length === nOn), "Labor v One Nation: one hollow DemosAU triangle per filed MRP on every row (" + on.map((r) => r.tris.length) + ")");
  check(on.every((r, i) => r.tris.every((t) => t.cls === ["lnp", "grn", "oth"][i])), "the triangles ride each group's own colour");
  check(co[1] && co[1].tris.length === 3 && co[0].tris.length === 0 && co[2].tris.length === 0, "Labor v Coalition: DemosAU's three national One Nation readings, on the One Nation row alone");
  check(keyOn, "the key names the triangle as DemosAU's MRP (the weighting caveat rides the tips and the note)");
  if (w === 1440) {
    /* the triangles sit at the window's TRUE midpoint, the one mark off the
       ledger's whole-month ticks: derive the empirical month-index -> x map
       from the line column's printed ticks (year tokens propagate), then
       each triangle's x must match the payload's xm through it, not a slot */
    const mids = await page.evaluate(() => {
      const FF = window.AUSPOL.flowForced;
      const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      const head = document.querySelector("#flow-drift .rd-fx-shead");
      const sc = document.querySelector("#flow-drift .rd-fx-sc");
      if (!head || !sc) return { err: "no line column head" };
      const hx = head.getBoundingClientRect().left, sx = sc.querySelector("svg").getBoundingClientRect().left;
      const slots = [];
      let yr = null;
      for (const t of head.querySelectorAll(".rd-ap-tk")) {
        const m = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)( ’(\d{2}))?$/.exec(t.textContent.trim());
        if (!m) return { err: "unparsed tick " + JSON.stringify(t.textContent) };
        if (m[3]) yr = 2000 + Number(m[3]);
        if (yr == null) return { err: "first tick carries no year" };
        slots.push([yr * 12 + MON.indexOf(m[1]), parseFloat(t.style.left) + hx - sx]);
      }
      const [m1, x1] = slots[0], [m2, x2] = slots[slots.length - 1];
      const per = (x2 - x1) / (m2 - m1);
      return { per, x1, m1, wins: FF.demos.map((d) => ({ win: d.win, xm: d.xm, want: x1 + (d.xm - m1) * per })) };
    });
    check(!mids.err, "the line column's ticks parse" + (mids.err ? " – " + mids.err : ""));
    if (!mids.err) {
      const got = co[1].tris.map((t) => t.x);
      for (const r of mids.wins) {
        const near = got.reduce((a, g) => (Math.abs(g - r.want) < Math.abs(a - r.want) ? g : a), Infinity);
        const k = (near - mids.x1) / mids.per;
        check(Math.abs(near - r.want) < 1.5, "v-Coalition " + r.win + ": its triangle sits at the true midpoint x (" + Math.abs(near - r.want).toFixed(2) + "px off)");
        check(r.xm % 1 > 0.01 && Math.abs(k - Math.round(k)) > 0.05, "v-Coalition " + r.win + ": off a month boundary, not snapped to a month");
      }
    }
  }
  if (SHOT) {
    const el = await page.$("#flow-drift .rd-fl-ledger");
    await el.evaluate((e) => e.scrollIntoView({ block: "center" }));
    await wait(300);
    await el.screenshot({ path: path.join(SHOT, `fx-${w}.png`) });
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
