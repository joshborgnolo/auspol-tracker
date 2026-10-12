/* Probe: the Switching panel's title cycler and the two "going" views
   (rd-panels.jsx RdSwitching, data D.onSources.going).
   Contract (user, 2026-10-13: clicking "One Nation" in the title shows
   "Where the Coalition's voters are going", then "Where Labor's voters
   are going", then back):
   - the panel loads on the One Nation view at every width (the other
     probes gate on that); the title's party word is a .rd-sw-cycle button;
   - clicking cycles onp -> lnp -> alp -> onp, the title and the view
     swapping together;
   - a going view shows one row per destination summing to the cohort
     (~100%), each with a figure and a bar, a trend chart per destination,
     and the kept row senior; figures match D.onSources.going's pooled nows;
   - nothing overflows horizontally at 320/390/900/1440. */
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
  const cyc = sec.querySelector(".rd-sw-cycle");
  const rows = [...sec.querySelectorAll(".rd-go-row")].map((r) => {
    const t = r.querySelector(".rd-go-rtop");
    const v = parseFloat((r.querySelector(".rd-go-rtop b:last-child") || {}).textContent || "NaN");
    const bar = r.querySelector(".rd-go-rbar");
    const fill = r.querySelector(".rd-go-rbar span");
    const em = r.querySelector(".rd-go-rbar em");
    return {
      v,
      fillPct: bar && fill ? (fill.getBoundingClientRect().width / bar.getBoundingClientRect().width) * 100 : null,
      emOverflow: em && bar ? em.getBoundingClientRect().right - bar.getBoundingClientRect().right : null,
      overflow: t ? t.scrollWidth - t.clientWidth : null,
    };
  });
  return {
    title: h2 ? h2.textContent : "",
    mosaic: !!sec.querySelector("svg.rd-mo, .rd-mo-rows"),
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
  onp: /Where One Nation.{1,2}s voters came from/,
  lnp: /Where the Coalition.{1,2}s voters are going/,
  alp: /Where Labor.{1,2}s voters are going/,
};

async function probe(width) {
  console.log("width " + width + ":");
  await openAt(width);
  if (!D) D = await readGoing();
  let s = await state();
  check(expectTitle.onp.test(s.title), `loads on the One Nation view («${s.title}»)`);
  check(s.mosaic, "came-from view renders on load");
  check(!s.rows.length, "no destination rows on the came-from view");
  check(s.docOverflow <= 1, `no horizontal overflow on load (${s.docOverflow}px)`);

  for (const step of ["lnp", "alp", "onp"]) {
    await page.evaluate(() => document.querySelector("#switching .rd-sw-cycle").click());
    await new Promise((r) => setTimeout(r, 350)); // intentional-sleep: view mount + glide settle
    s = await state();
    check(expectTitle[step].test(s.title), `click lands on the ${step} view («${s.title}»)`);
    if (step !== "onp") {
      const keys = Object.keys(D[step] || {});
      check(keys.length >= 5, `gen-data carries ${step} destinations (${keys.length})`);
      check(s.rows.length === keys.length, `${s.rows.length} destination rows render (data has ${keys.length})`);
      check(!s.mosaic, "came-from mosaic is away");
      const sum = s.rows.reduce((t, r) => t + (r.v || 0), 0);
      check(Math.abs(sum - 100) <= 0.6, `rows sum to the cohort (${sum.toFixed(1)}%)`);
      s.rows.forEach((r, i) => {
        const key = keys[i];
        const d = key != null ? D[step][key] : null;
        if (d == null) { check(false, `row ${i + 1} has no matching destination`); return; }
        check(Math.abs(r.v - d) < 0.06, `row ${i + 1} (${key}) figure is the pooled now (${r.v} vs ${d})`);
        check(r.fillPct != null && Math.abs(r.fillPct - d) < 1.2,
              `row ${i + 1} (${key}) bar spans its share (${r.fillPct && r.fillPct.toFixed(1)}% of the row)`);
        check((r.emOverflow || -1) <= 1, `row ${i + 1} (${key}) figure stays inside the row (${r.emOverflow && r.emOverflow.toFixed(1)}px)`);
        check((r.overflow || 0) <= 1, `row ${i + 1} (${key}) head row fits (${r.overflow}px)`);
      });
      check(s.rows.length >= 2 && s.rows[0].v > s.rows[1].v, "kept is the senior row");
      check(s.smCards === keys.length, `${keys.length} trend charts render (${s.smCards})`);
    } else {
      check(s.mosaic, "came-from view returns after the full cycle");
      check(!s.rows.length, "destination rows leave with the cycle");
    }
    check(s.docOverflow <= 1, `no horizontal overflow on ${step} (${s.docOverflow}px)`);
  }
}

for (const w of [320, 390, 900, 1440]) await probe(w);

await browser.close();
if (fails.length) { console.error("\n" + fails.length + " FAILURES"); process.exit(1); }
console.log("\nALL PASS");
