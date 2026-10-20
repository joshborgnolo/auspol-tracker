/* Probe: the Switching panel's title cycler and the "going" views
   (rd-panels.jsx RdSwitching, data D.onSources.going).
   Contract (user, 2026-10-16: clicking cycles "Where One Nation's voters
   are coming from" -> "Where the Coalition's voters are going" -> Labor
   -> the Greens -> back; the going views were assimilated to the
   came-from view's presentation on 2026-10-15, the Greens view added
   2026-10-16):
   - the panel loads on the One Nation view at every width (the other
     probes gate on that); the title's party word is a .rd-sw-cycle button;
   - clicking cycles onp -> lnp -> alp -> grn -> onp, the title and the
     view swapping together;
   - a going view presents like the came-from view: an svg.rd-go column
     mosaic at >=641px (one column per destination, widths summing to the
     strip, figures matching the pooled nows, the kept column senior),
     variable-height .rd-go-row rows on a phone (fill width = share, kept
     row carries the big kept figure and the "Went elsewhere" caption -
     inline .rd-go-else while the residue holds it, .rd-go-elsebelow on
     its own line once it no longer does, 06b9e791 user call 2026-10-20);
   - a trend chart per destination; nothing overflows at 320/390/900/1440.
   DOUBLE-CLICK/TAP CYCLING (user, 2026-10-20, RdSec's dblCycle): a
   double-click anywhere in the section but on a control walks the cycle
   one step; touch plays it as a double-tap (two taps within 350ms and
   24px). Double-clicking the title BUTTON walks two steps - its two
   clicks cycle one each and the section-level dblclick leaves controls
   alone. An svg (mosaic/chart) tap area never cycles. */
import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";

const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
if (!fs.existsSync(CHROME)) { console.error("no Chrome at " + CHROME); process.exit(2); }
const BASE = process.env.BASE || process.cwd();

const fails = [];
const check = (ok, msg) => { console.log((ok ? "  ok " : "FAIL ") + msg); if (!ok) fails.push(msg); };

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
page.on("pageerror", (e) => { fails.push("pageerror: " + e.message); console.log("FAIL pageerror: " + e.message); });

async function openAt(width) {
  await page.setViewport({ width, height: 950, deviceScaleFactor: 1 });
  await page.goto("file://" + path.join(BASE, "index.html"), { waitUntil: "networkidle0", timeout: 60000 });
  await page.waitForSelector("#switching .rd-sw-cycle", { timeout: 30000 });
  await page.evaluate(() => document.querySelector("#switching").scrollIntoView());
  await new Promise((r) => setTimeout(r, 400)); // intentional-sleep: RO-driven widths settle after mount
}

const state = () => page.evaluate(() => {
  const sec = document.querySelector("#switching");
  const h2 = sec.querySelector(".rd-title");
  // phone rows
  const rows = [...sec.querySelectorAll(".rd-go-row")].map((r) => {
    const t = r.querySelector(".rd-go-rtop");
    const v = parseFloat((r.querySelector(".rd-go-rtop b:last-child") || {}).textContent || "NaN");
    const bar = r.querySelector(".rd-go-rbar");
    const fill = r.querySelector(".rd-go-rbar span");
    const em = r.querySelector(".rd-go-rbar em");
    /* the "Went elsewhere" caption has lived in two placements since
       06b9e791 (user call 2026-10-20): inline .rd-go-else while the residue
       holds it, .rd-go-elsebelow on its own line once it no longer does -
       exactly one of the two must render */
    const elseN = r.querySelectorAll(".rd-go-else, .rd-go-elsebelow").length;
    return {
      v,
      fillPct: bar && fill ? (fill.getBoundingClientRect().width / bar.getBoundingClientRect().width) * 100 : null,
      emOverflow: em && bar ? em.getBoundingClientRect().right - bar.getBoundingClientRect().right : null,
      heights: bar ? bar.getBoundingClientRect().height : null,
      keptBig: !!r.querySelector(".rd-go-first"),
      elsewhere: elseN === 1,
      elseText: elseN ? r.querySelector(".rd-go-else, .rd-go-elsebelow").textContent : null,
      overflow: t ? t.scrollWidth - t.clientWidth : null,
    };
  });
  // laptop mosaic
  const svg = sec.querySelector("svg.rd-go");
  const cols = svg ? [...svg.querySelectorAll("g")].map((g) => {
    const rect = g.querySelector(".rd-go-colfill");
    const pts = g.querySelector(".rd-go-pts");
    const big = g.querySelector(".rd-go-big");
    const fig = big || g.querySelector(".rd-go-rates");
    return {
      v: pts ? parseFloat(pts.textContent || "NaN") : NaN,
      w: rect ? rect.getBoundingClientRect().width : null,
      keptBig: !!big,
      figInside: fig && rect
        ? fig.getBoundingClientRect().left >= rect.getBoundingClientRect().left - 1 &&
          fig.getBoundingClientRect().right <= rect.getBoundingClientRect().right + 1
        : null,
    };
  }) : [];
  const svgW = svg ? svg.getBoundingClientRect().width : null;
  return {
    title: h2 ? h2.textContent : "",
    mosaic: !!sec.querySelector("svg.rd-mo, .rd-mo-rows"),
    svgGo: !!svg,
    cols,
    svgW,
    keys: sec.querySelectorAll(".rd-go-key .rd-key-item").length,
    howread: !!sec.querySelector(".rd-go-howread"),
    rows,
    smCards: sec.querySelectorAll(".rd-sm").length,
    docOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
});

let D = null;
async function readGoing() {
  return page.evaluate(() => {
    const A = window.AUSPOL || {};
    const g = (A.onSources && A.onSources.going) || [];
    return Object.fromEntries(g.map((r) => [r.id, Object.fromEntries(r.dests.map((d) => [d.id, d.now ? d.now.v : null]))]));
  });
}

const expectTitle = {
  onp: /Where One Nation.{1,2}s voters are coming from/,
  lnp: /Where the Coalition.{1,2}s voters are going/,
  alp: /Where Labor.{1,2}s voters are going/,
  grn: /Where the Greens.{1,2} voters are going/,
};

async function probe(width) {
  const phone = width <= 640;
  console.log("width " + width + (phone ? " (phone)" : " (laptop)") + ":");
  await openAt(width);
  if (!D) D = await readGoing();
  let s = await state();
  check(expectTitle.onp.test(s.title), `loads on the One Nation view («${s.title}»)`);
  check(s.mosaic, "came-from view renders on load");
  check(!s.rows.length && !s.svgGo, "no destination rows or columns on the came-from view");
  check(s.docOverflow <= 1, `no horizontal overflow on load (${s.docOverflow}px)`);

  for (const step of ["lnp", "alp", "grn", "onp"]) {
    await page.evaluate(() => document.querySelector("#switching .rd-sw-cycle").click());
    await new Promise((r) => setTimeout(r, 350)); // intentional-sleep: view mount + glide settle
    s = await state();
    check(expectTitle[step].test(s.title), `click lands on the ${step} view («${s.title}»)`);
    if (step !== "onp") {
      const keys = Object.keys(D[step] || {});
      check(keys.length >= 5, `gen-data carries ${step} destinations (${keys.length})`);
      check(!s.mosaic, "came-from mosaic is away");
      check(s.keys >= keys.length, `${s.keys} key items (one per destination${s.howread ? " + how-to-read" : ""})`);
      if (phone) {
        check(s.rows.length === keys.length, `${s.rows.length} destination rows render (data has ${keys.length})`);
        check(!s.svgGo, "no laptop column mosaic on the phone");
        const sum = s.rows.reduce((t, r) => t + (r.v || 0), 0);
        check(Math.abs(sum - 100) <= 0.6, `rows sum to the cohort (${sum.toFixed(1)}%)`);
        s.rows.forEach((r, i) => {
          const key = keys[i];
          const d = key != null ? D[step][key] : null;
          if (d == null) { check(false, `row ${i + 1} has no matching destination`); return; }
          check(Math.abs(r.v - d) < 0.06, `row ${i + 1} (${key}) figure is the pooled now (${r.v} vs ${d})`);
          check(r.fillPct != null && Math.abs(r.fillPct - d) < 1.2,
                `row ${i + 1} (${key}) fill spans its share (${r.fillPct && r.fillPct.toFixed(1)}% of the track)`);
          check(r.heights != null && r.heights >= 16, `row ${i + 1} (${key}) bar clears the 16px floor (${r.heights && r.heights.toFixed(0)}px)`);
          check((r.emOverflow || -1) <= 1, `row ${i + 1} (${key}) figure stays inside the row (${r.emOverflow && r.emOverflow.toFixed(1)}px)`);
          check((r.overflow || 0) <= 1, `row ${i + 1} (${key}) head row fits (${r.overflow}px)`);
        });
        check(s.rows.length >= 2 && s.rows[0].v > s.rows[1].v, "kept is the senior row");
        check(s.rows[0].keptBig && s.rows[0].elsewhere, "kept row carries the big figure and the “Went elsewhere” caption (either placement)");
        check(s.rows[0].elseText === "Went elsewhere", `the kept caption reads “Went elsewhere” («${s.rows[0].elseText}»)`);
      } else {
        check(s.svgGo, "the laptop column mosaic renders");
        check(s.cols.length === keys.length, `${s.cols.length} destination columns render (data has ${keys.length})`);
        check(!s.rows.length, "no phone rows on the laptop");
        check(s.howread, "the how-to-read key line is desktop-only");
        const sum = s.cols.reduce((t, c) => t + (c.v || 0), 0);
        check(Math.abs(sum - 100) <= 0.6, `columns sum to the cohort (${sum.toFixed(1)}%)`);
        const totW = s.cols.reduce((t, c) => t + c.w, 0);
        check(s.svgW && totW > 0 && Math.abs(totW - (s.svgW - 4 * (s.cols.length - 1))) < 4,
              `column widths plus gaps tile the width (${totW.toFixed(0)}px in ${s.svgW && s.svgW.toFixed(0)}px)`);
        s.cols.forEach((c, i) => {
          const key = keys[i];
          const d = key != null ? D[step][key] : null;
          if (d == null) { check(false, `column ${i + 1} has no matching destination`); return; }
          check(Math.abs(c.v - d) < 0.06, `column ${i + 1} (${key}) figure is the pooled now (${c.v} vs ${d})`);
          check(c.figInside !== false, `column ${i + 1} (${key}) figure stays inside its column`);
        });
        check(s.cols.length >= 2 && s.cols[0].v > s.cols[1].v && s.cols[0].keptBig, "kept is the senior, big-figure column");
      }
      check(s.smCards === keys.length, `${keys.length} trend charts render (${s.smCards})`);
    } else {
      check(s.mosaic, "came-from view returns after the full cycle");
      check(!s.rows.length && !s.svgGo, "destination rows leave with the cycle");
    }
    check(s.docOverflow <= 1, `no horizontal overflow on ${step} (${s.docOverflow}px)`);
  }
}

for (const w of [320, 390, 900, 1440]) await probe(w);

/* ---- double-click/tap cycling (dblCycle on RdSec) ---- */
const titleIs = async (wantKey) => {
  const t = await page.evaluate(() => document.querySelector("#switching .rd-title").textContent);
  const okT = expectTitle[wantKey].test(t);
  check(okT, `view is ${wantKey} («${t}»)`);
};
const dblclick = (selector) => page.evaluate((sel) => {
  const el = document.querySelector(sel);
  if (!el) throw new Error("no element " + sel);
  el.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true }));
}, selector);
const settle = (ms) => new Promise((r) => setTimeout(r, ms)); // intentional-sleep: view mount + glide settle

console.log("mouse double-click cycling (1280):");
await openAt(1280);
await titleIs("onp");
await dblclick("#switching .rd-dek"); await settle(400);
await titleIs("lnp");
for (const k of ["alp", "grn", "onp"]) { await dblclick("#switching .rd-dek"); await settle(400); await titleIs(k); }
await page.evaluate(() => document.querySelector("#switching .rd-sw-cycle").click());
await settle(150);
await page.evaluate(() => document.querySelector("#switching .rd-sw-cycle").click());
await settle(150);
await page.evaluate(() => document.querySelector("#switching .rd-sw-cycle")
  .dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true })));
await settle(400);
await titleIs("alp"); // two clicks walked onp -> lnp -> alp; the trailing dblclick adds no third step
await dblclick("#switching svg"); await settle(300);
await titleIs("alp");
await dblclick("#switching .rd-dek"); await settle(400); await titleIs("grn");
await dblclick("#switching .rd-dek"); await settle(400); await titleIs("onp");

console.log("touch double-tap cycling (390):");
await page.setViewport({ width: 390, height: 950, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
await page.goto("file://" + path.join(BASE, "index.html"), { waitUntil: "networkidle0", timeout: 60000 });
await page.waitForSelector("#switching .rd-sw-cycle", { timeout: 30000 });
await page.evaluate(() => document.querySelector("#switching").scrollIntoView());
await settle(400);
const spot = await page.evaluate(() => {
  const r = document.querySelector("#switching .rd-title").getBoundingClientRect();
  return { x: r.left + 8, y: r.top + 6 };
});
await titleIs("onp");
await page.touchscreen.tap(spot.x, spot.y);
await page.touchscreen.tap(spot.x, spot.y);
await settle(400);
await titleIs("lnp");
await page.touchscreen.tap(spot.x, spot.y); await settle(500);
await page.touchscreen.tap(spot.x, spot.y); await settle(400);
await titleIs("lnp");
await page.touchscreen.tap(spot.x, spot.y);
await page.touchscreen.tap(spot.x + 30, spot.y);
await settle(400);
await titleIs("lnp");
await page.touchscreen.tap(spot.x, spot.y);
await page.touchscreen.tap(spot.x, spot.y);
await settle(400);
await titleIs("alp");

await browser.close();
if (fails.length) { console.error("\n" + fails.length + " FAILURES"); process.exit(1); }
console.log("\nALL PASS");
