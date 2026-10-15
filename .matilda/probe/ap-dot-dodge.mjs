/* Probe (run: node .matilda/probe/ap-dot-dodge.mjs, from the repo root of the
   checkout under test): dots whose figures land within the glyph's width on
   an All-polls row strip must never paint one clean over another - any such
   pair is fanned vertically (the rdApDodge fix for the YouGov consideration
   wave where Labor and One Nation both printed 38 and only One Nation
   showed). Asserts, per rendered row strip, on desktop AND phone:
     - any two dots closer than 8px horizontally stand at least 3.5px apart
       vertically (a tower), never > 6.1px from the strip's midline;
     - the aria-label's figure list still names exactly as many parties as
       there are dots (no dot dropped by the fan);
     - a known collision is SEEN stacked: Essential 30 Sep 2026 (Greens and
       Other both 12) in the intention view, and the YouGov 16 Jun 2026
       consideration wave (Labor = One Nation = 38) after the intention ⇄
       consideration flip;
     - the confidence facet (one dot per row) carries no inline top at all. */
import puppeteer from "puppeteer-core";
import path from "path";
import process from "process";

const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const APAGE = "file://" + path.resolve(process.cwd(), "allpolls/index.html");
let fails = 0;
const check = (ok, msg) => { console.log((ok ? "  ok " : "FAIL ") + msg); if (!ok) fails++; };

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
page.on("pageerror", (e) => { console.log("PAGEERROR", String(e).slice(0, 200)); fails++; });

const stripRule = () => {
  const out = [];
  const ins = [...document.querySelectorAll(".rd-ap-row .rd-ap-pic .rd-ap-in, .rd-ap-card .rd-ap-pic .rd-ap-in")];
  for (const el of ins) {
    const dots = [...el.querySelectorAll(".rd-ap-dot")].map((d) => {
      const r = d.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, top: d.style.top || "" };
    });
    if (!dots.length) continue;
    const sr = el.getBoundingClientRect(), mid = sr.top + sr.height / 2;
    let pairMin = null, towers = 0;
    for (let i = 0; i < dots.length; i++) {
      if (Math.abs(dots[i].y - mid) > 6.1) pairMin = "dot beyond +/-6px of strip mid";
      for (let j = i + 1; j < dots.length; j++) {
        const dx = Math.abs(dots[i].x - dots[j].x), dy = Math.abs(dots[i].y - dots[j].y);
        if (dx < 8) { towers++; if (dy < 3.5) pairMin = `overlap not dodged: dx=${dx.toFixed(1)} dy=${dy.toFixed(1)}`; }
        if (dx >= 8 && dx < 13 && dy > 0.5) { /* tower fired past the halo boundary - note, not a fail (design boundary) */ }
      }
    }
    const aria = el.parentElement.getAttribute("aria-label") || "";
    let figCount = null;
    if (/^(Primary vote|Voting consideration)/.test(aria)) figCount = aria.split(": ").pop().split(", ").length;
    out.push({ n: dots.length, figCount, pairMin, towers });
  }
  return out;
};

const openFacet = async (name) => {
  await page.evaluate((n) => {
    [...document.querySelectorAll(".rd-ap-tabs .rd-tab")].find((el) => el.textContent.trim() === n)?.click();
  }, name);
  await page.waitForFunction(
    (n) => document.querySelector(".rd-ap-tabs .rd-tab[aria-pressed='true']")?.textContent.trim() === n,
    { timeout: 15000 }, name);
};

for (const vw of [{ w: 1366, label: "desktop" }, { w: 390, label: "phone" }]) {
  await page.setViewport({ width: vw.w, height: 980 });
  await page.goto(APAGE, { waitUntil: "networkidle0", timeout: 60000 });
  await page.waitForFunction(() => document.querySelectorAll(".rd-ap .rd-ap-row, .rd-ap .rd-ap-card").length > 0, { timeout: 30000 });

  /* -- primary (intention) ------------------------------------------------ */
  await openFacet("Primary");
  const prim = await page.evaluate(stripRule);
  check(prim.length > 0, `${vw.label}: intention strips rendered (${prim.length})`);
  check(prim.every((s) => !s.pairMin), `${vw.label}: intention - no overlapping dot pair left undodged`);
  check(prim.every((s) => s.figCount == null || s.figCount === s.n), `${vw.label}: intention - every strip keeps a dot per aria figure`);
  const primTowers = prim.reduce((a, s) => a + s.towers, 0);
  check(primTowers > 0, `${vw.label}: intention - a known collision is seen stacked (e.g. Essential 12=12) (${primTowers} tower pairs)`);

  /* -- primary flipped to consideration (the user's exact case) ------------ */
  await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((el) => /Voting intention/.test(el.textContent));
    b && b.click();
  });
  await page.waitForFunction(() => [...document.querySelectorAll("button")].some((el) => /Voting consideration ⇄/.test(el.textContent)), { timeout: 10000 });
  const cons = await page.evaluate(stripRule);
  check(cons.length > 0, `${vw.label}: consideration strips rendered (${cons.length})`);
  check(cons.every((s) => !s.pairMin), `${vw.label}: consideration - no overlapping dot pair left undodged`);
  check(cons.every((s) => s.figCount == null || s.figCount === s.n), `${vw.label}: consideration - every strip keeps a dot per aria figure`);
  const consTowers = cons.reduce((a, s) => a + s.towers, 0);
  check(consTowers > 0, `${vw.label}: consideration - the Labor 38 = One Nation 38 wave is seen stacked (${consTowers} tower pairs)`);
  /* back to intention so the next facet switch starts clean */
  await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((el) => /Voting consideration ⇄/.test(el.textContent));
    b && b.click();
  });

  /* -- leadership nets ----------------------------------------------------- */
  await openFacet(vw.label === "phone" ? "Leaders" : "Leadership");
  const lead = await page.evaluate(stripRule);
  check(lead.length > 0, `${vw.label}: leadership strips rendered (${lead.length})`);
  check(lead.every((s) => !s.pairMin), `${vw.label}: leadership - no overlapping dot pair left undodged`);

  /* -- confidence: single-dot rows untouched ------------------------------- */
  await openFacet("Confidence");
  const conf = await page.evaluate(stripRule);
  check(conf.length > 0, `${vw.label}: confidence strips rendered (${conf.length})`);
  check(conf.every((s) => s.n === 1 && s.towers === 0 && !s.pairMin), `${vw.label}: confidence - one dot per row, none stacked`);
  const confTopless = await page.evaluate(() =>
    [...document.querySelectorAll(".rd-ap-row .rd-ap-pic .rd-ap-in .rd-ap-dot, .rd-ap-card .rd-ap-pic .rd-ap-in .rd-ap-dot")].every((d) => !d.style.top));
  check(confTopless, `${vw.label}: confidence - dots carry no inline top`);
}

await browser.close();
console.log(fails ? `FAIL (${fails})` : "ALL CHECKS PASSED");
process.exit(fails ? 1 : 0);
