/* headless geometry probe of the RdForced "forced to choose" pair in the
   All-polls Preference flows section (moved from /preference-flows/ 2026-10-10;
   data: gen-data §7db D.flowForced). Renders index.html#allpolls at desktop and
   phone rungs and asserts GEOMETRY, never screenshots
   (auspol-headless-geometry-verify): the two figures share a row side by side
   on desktop and stack full-width on a phone, each svg vmaps every wave's a
   (Labor split) share to a dot at a distinct x with its y matching the
   published figure, end labels sit inside the radius, the rival class on the
   One-Nation-voters chart is `is-lnp` (blue, not orange), gridlines are five,
   and the June est note rides the June dot's aria-label on the coal chart only.
*/
import puppeteer from "puppeteer-core";
import path from "path";
import process from "process";
import fs from "fs";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PAGE = "file://" + path.join(ROOT, "index.html");
let fails = 0;
const check = (ok, msg) => { console.log((ok ? "  ok " : "FAIL ") + msg); if (!ok) fails++; };

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
page.on("pageerror", (e) => { console.log("PAGEERROR", String(e).slice(0, 300)); fails++; });

const gotoFlows = async (w) => {
  await page.setViewport({ width: w, height: 1200, deviceScaleFactor: 1 });
  await page.goto(PAGE + "#allpolls", { waitUntil: "networkidle0", timeout: 60000 });
  await page.waitForSelector(".rd-ff svg .rd-ff-line.a", { timeout: 30000 });
  await page.evaluate(() => document.querySelector(".rd-ff").scrollIntoView({ block: "center" }));
  await new Promise((r) => setTimeout(r, 350));
};

const measure = () => page.evaluate(() => {
  const figs = [...document.querySelectorAll(".rd-ff figure.rd-ff")];
  const out = { nFig: figs.length, figs: [] };
  for (const fig of figs) {
    const svg = fig.querySelector("svg");
    const r = svg.getBoundingClientRect();
    const lineA = fig.querySelector(".rd-ff-line.a");
    const lineB = fig.querySelector(".rd-ff-line.b");
    const dotsA = [...fig.querySelectorAll(".rd-ff-dot.a")].map((c) => ({ x: +c.getAttribute("cx"), y: +c.getAttribute("cy") }));
    const dotsB = [...fig.querySelectorAll(".rd-ff-dot.b")].map((c) => ({ x: +c.getAttribute("cx"), y: +c.getAttribute("cy") }));
    const hits = [...fig.querySelectorAll("circle.rd-apd-hit")];
    const gls = fig.querySelectorAll(".rd-ff-gl").length;
    const els = [...fig.querySelectorAll(".rd-ff-el")].map((t) => t.textContent);
    const elvs = [...fig.querySelectorAll(".rd-ff-elv")].map((t) => t.textContent);
    out.figs.push({
      w: Math.round(r.width), h: Math.round(r.height),
      left: Math.round(r.left), right: Math.round(r.right),
      top: Math.round(r.top),
      vb: svg.getAttribute("viewBox"),
      a: lineA.getAttribute("d").slice(0, 8), bcls: lineB.getAttribute("class"),
      bBiggerThanA: lineB.getAttribute("d") !== lineA.getAttribute("d"),
      dotsA, dotsB, nHits: hits.length, gls, els, elvs,
      arias: hits.map((h) => h.getAttribute("aria-label") || ""),
      xMax: Math.max(...dotsA.map((d) => d.x)),
      elX: +fig.querySelector(".rd-ff-el.a").getAttribute("x"),
      elvText: fig.querySelector(".rd-ff-elv.a").textContent,
    });
  }
  const sec = document.querySelector("#flow-drift");
  out.secW = Math.round(sec.getBoundingClientRect().width);
  out.h3 = sec.querySelector(".rd-ff-t") ? sec.querySelector(".rd-ff-t").textContent : null;
  out.orderKeyThenForced = (() => {
    const nodes = [...sec.children];
    const iKey = nodes.findIndex((el) => el.classList.contains("rd-ckey") && el.classList.contains("rd-fl-key"));
    const iFF = nodes.findIndex((el) => el.classList.contains("rd-ff"));
    const iTsig = nodes.findIndex((el) => el.classList.contains("rd-tsig"));
    return { iKey, iFF, iTsig };
  })();
  out.sw = document.documentElement.scrollWidth;
  out.iw = window.innerWidth;
  return out;
});

// ---------------- desktop rung --------------------------------------------
await gotoFlows(1366);
const d = await measure();
check(d.nFig === 2, `desktop: two forced-choice figures (${d.nFig})`);
check(d.h3 === "When pressed, where do their voters go?", `desktop: section head is the forced-choice line`);
check(d.orderKeyThenForced.iKey > -1 && d.orderKeyThenForced.iFF === d.orderKeyThenForced.iKey + 1,
  `desktop: the forced pair sits directly under the drift key (key idx ${d.orderKeyThenForced.iKey}, forced idx ${d.orderKeyThenForced.iFF})`);
check(d.orderKeyThenForced.iTsig === d.orderKeyThenForced.iFF + 1,
  `desktop: the drift battery follows the forced pair (tsig idx ${d.orderKeyThenForced.iTsig})`);
{
  const [a, b] = d.figs;
  check(a.w > 400 && Math.abs(a.w - b.w) <= 2, `desktop: two equal-width charts side by side (${a.w}px, ${b.w}px)`);
  check(Math.abs(b.left - a.right) > 20, `desktop: a gap separates the two charts (${b.left - a.right}px)`);
  check(Math.abs(a.top - b.top) <= 1, `desktop: charts share a row (top ${a.top} vs ${b.top})`);
  for (const [i, f] of d.figs.entries()) {
    const tag = i === 0 ? "coal" : "on";
    check(f.dotsA.length === 7 && f.dotsB.length === 7, `desktop ${tag}: seven waves per line (${f.dotsA.length}/${f.dotsB.length})`);
    check(f.gls === 5, `desktop ${tag}: five gridlines`);
    check(f.els.length === 2 && f.els[0] === "Labor", `desktop ${tag}: Labor end label first (${f.els.join(" · ")})`);
    check(f.elvText === (i === 0 ? "41" : "15"), `desktop ${tag}: latest Labor share ends the line (${f.elvText})`);
    check(f.dotsA.every((p) => p.y > 0 && p.y < 196), `desktop ${tag}: every Labor dot inside the plot`);
    check(f.elX === f.xMax + 8, `desktop ${tag}: end labels hug the last dot's x (x=${f.elX} = ${f.xMax}+8)`);
    check(f.nHits === 14, `desktop ${tag}: 14 hit circles (${f.nHits})`);
  }
  check(d.figs[0].els[1] === "One Nation", `desktop coal: rival labelled One Nation (${d.figs[0].els[1]})`);
  check(d.figs[1].els[1] === "Coalition", `desktop on: rival labelled Coalition (${d.figs[1].els[1]})`);
  check(d.figs[1].bcls.includes("is-lnp") && !d.figs[0].bcls.includes("is-lnp"),
    `desktop: the ON-voters rival line is blue (is-lnp), the coal-voters rival stays orange`);
  check(d.figs[0].bBiggerThanA && d.figs[1].bBiggerThanA, "desktop: both charts draw two distinct lines");
  const juneAria = d.figs[0].arias.find((s) => s.startsWith("June 2026:"));
  check(!!juneAria && juneAria.includes("Labor 36, One Nation 64") && juneAria.includes("combines"),
    `desktop coal: June dot aria reads the combined-rows note (${JSON.stringify(juneAria)})`);
  const onJune = d.figs[1].arias.find((s) => s.startsWith("June 2026:"));
  check(!!onJune && onJune.includes("Labor 21, the Coalition 79") && !onJune.includes("combines"),
    `desktop on: June dot aria is the plain printed figure (${JSON.stringify(onJune)})`);
}
const viewH = await page.evaluate(() => +document.querySelectorAll("figure.rd-ff svg")[0].getAttribute("height"));

// tip: hover the Sep dot of the coal chart, expect the wave-report link
{
  await page.evaluate(() => {
    const hits = [...document.querySelectorAll("figure.rd-ff")][0].querySelectorAll("circle.rd-apd-hit[aria-label^='September 2026']");
    const r = hits[0].getBoundingClientRect();
    hits[0].scrollIntoView({ block: "center" });
  });
  const c = await page.evaluate(() => {
    const h = [...document.querySelectorAll("figure.rd-ff")][0].querySelector("circle.rd-apd-hit[aria-label^='September 2026']");
    const r = h.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  await page.mouse.move(c.x, c.y, { steps: 3 });
  await new Promise((r) => setTimeout(r, 250));
  const tip = await page.evaluate(() => {
    const fig = [...document.querySelectorAll("figure.rd-ff")][0];
    const t = fig.querySelector(".tip.rd-ff-tip");
    if (!t || t.offsetParent === null) return null;
    return {
      title: t.querySelector(".tip-title").textContent,
      rows: [...t.querySelectorAll(".tip-row .tip-label")].map((l) => l.textContent.trim()),
      vals: [...t.querySelectorAll(".tip-row .tip-val")].map((v) => v.textContent.trim()),
      link: t.querySelector("a.rd-ff-lnk") ? t.querySelector("a.rd-ff-lnk").href : null,
      est: t.querySelectorAll(".tip-sub.tip-hint").length,
    };
  });
  check(!!tip && tip.title === "September 2026", `coal Sep hover: tip opens titled September 2026 (${JSON.stringify(tip && tip.title)})`);
  check(tip && tip.rows.includes("Labor") && tip.vals.includes("41%"), `coal Sep tip: Labor row 41% (${JSON.stringify(tip && tip.vals)})`);
  check(tip && tip.rows.includes("One Nation") && tip.vals.includes("59%"), `coal Sep tip: One Nation row 59%`);
  check(tip && tip.rows.includes("Sample") && tip.vals.includes("n = 1,000"), `coal Sep tip: sample row`);
  check(tip && tip.link && tip.link.includes("accent-research.com"), `coal Sep tip: report link (${tip && tip.link})`);
  check(tip && tip.est === 0, `coal Sep tip: no est note on a printed wave`);

  // June dot on the coal chart carries the est note
  const junC = await page.evaluate(() => {
    const h = [...document.querySelectorAll("figure.rd-ff")][0].querySelector("circle.rd-apd-hit[aria-label^='June 2026']");
    const r = h.getBoundingClientRect();
    h.scrollIntoView({ block: "center" });
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  await page.mouse.move(junC.x, junC.y, { steps: 3 });
  await new Promise((r) => setTimeout(r, 250));
  const tipJ = await page.evaluate(() => {
    const fig = [...document.querySelectorAll("figure.rd-ff")][0];
    const t = fig.querySelector(".tip.rd-ff-tip");
    if (!t || t.offsetParent === null) return null;
    return {
      title: t.querySelector(".tip-title").textContent,
      est: [...t.querySelectorAll(".tip-sub.tip-hint")].map((s) => s.textContent.trim()),
      wrap: t.querySelectorAll(".tip-row.tip-hintwrap").length,
    };
  });
  check(!!tipJ && tipJ.title === "June 2026" && tipJ.est.length === 1 && tipJ.est[0].includes("CLP/LNP/Nat (34)") && tipJ.est[0].includes("Liberal (37)"),
    `coal June tip: the combined-rows note rides the June dot (${JSON.stringify(tipJ && tipJ.est)})`);
  check(tipJ && tipJ.wrap === 2, `coal June tip: link and est note both wrapped rows (${tipJ && tipJ.wrap})`);
}

// svg vmaps the data: y of each Labor dot equals the published share
{
  const expected = {
    0: [32, 31, 32, 36, 44, 32, 41],   // coal-voters chart, Labor splits Feb..Sep
    1: [23, 25, 21, 21, 16, 17, 15],   // ON-voters chart, Labor splits
  }[0];
  const pairs = await page.evaluate(() => {
    const fig = [...document.querySelectorAll("figure.rd-ff")][0];
    const svg = fig.querySelector("svg");
    const H = +svg.getAttribute("height");
    const top = 16, bot = H - 34;
    return [...fig.querySelectorAll(".rd-ff-dot.a")].map((c) => Math.round(100 * (bot - (+c.getAttribute("cy"))) / (bot - top)));
  });
  check(JSON.stringify(pairs) === JSON.stringify(expected), `coal chart Labor dots vmap the published splits (${JSON.stringify(pairs)})`);
}
check(viewH === 230, `desktop: plot height 230 (${viewH})`);

// ---------------- phone rung ------------------------------------------------
await gotoFlows(390);
const m = await measure();
check(m.nFig === 2, `phone: two figures (${m.nFig})`);
{
  const [a, b] = m.figs;
  check(Math.abs(a.w - m.secW) <= 2 && Math.abs(b.w - m.secW) <= 2, `phone: charts fill the section width (${a.w}px of ${m.secW}px)`);
  check(b.top > a.top + a.h - 1, `phone: charts stack (${a.top}+${a.h} then ${b.top})`);
  check(Math.abs(a.top - b.top) > 40, `phone: real vertical stride between charts (${b.top - a.top})`);
  check(m.sw <= m.iw + 1, `phone: no horizontal overflow (sw ${m.sw} vs iw ${m.iw})`);
}
const viewH2 = await page.evaluate(() => +document.querySelectorAll("figure.rd-ff svg")[0].getAttribute("height"));
check(viewH2 === 190, `phone: plot height 190 (${viewH2})`);

await browser.close();
console.log(fails ? `FAIL (${fails})` : "rd-forced-charts: ALL CHECKS PASSED");
process.exit(fails ? 1 : 0);
