// Width sweep for the Issues facet: measure head caption/ticks/best-cell
// and the first data row's ownership dots at every width step, report any
// text-on-text or dot-on-dot intersection, plus row heights.
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

let puppeteer;
for (const base of [process.cwd(), homedir()]) {
  try {
    puppeteer = createRequire(join(base, "package.json"))("puppeteer-core");
    break;
  } catch { /* next */ }
}
const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const PAGE = process.env.LIVE ? "https://auspoltracker.com/" : `file://${ROOT}/index.html`;
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new",
});

const MEASURE = `(() => {
  const r = (n) => { if (!n) return null; const b = n.getBoundingClientRect();
    return { x:+b.x.toFixed(1), y:+b.y.toFixed(1), w:+b.width.toFixed(1), h:+b.height.toFixed(1) }; };
  const pheadEl = document.querySelector(".rd-ap-phead");
  const hrowEl = document.querySelector(".rd-ap-hrow");
  const head = (pheadEl && getComputedStyle(pheadEl).display !== "none") ? pheadEl : hrowEl;
  const hpic = head && head.querySelector(".rd-ap-hpic");
  const cap = hpic && hpic.querySelector(".rd-ap-cap");
  const tks = hpic ? [...hpic.querySelectorAll(".rd-ap-tk")] : [];
  const ths = head ? [...head.querySelectorAll(".rd-ap-th")] : [];
  const best = ths.find((n) => /Best party/i.test(n.textContent));
  const row = document.querySelector(".rd-ap-row");
  const dots = row ? [...row.querySelectorAll(".rd-ap-pic .rd-ap-dot")] : [];
  const pic = row && row.querySelector(".rd-ap-pic");
  const net = row && row.querySelector(".rd-ap-netcell");
  return {
    which: head && head.classList.contains("rd-ap-phead") ? "phead" : "hrow",
    hpic: r(hpic), cap: r(cap), tks: tks.map(r),
    best: r(best), rowH: row ? r(row).h : null,
    pic: r(pic), net: r(net), dots: dots.map(r),
  };
})()`;

const inter = (a, b) => a && b && a.x < b.x + b.w - 0.5 && b.x < a.x + a.w - 0.5 && a.y < b.y + b.h - 0.5 && b.y < a.y + a.h - 0.5;

let worst = 0;
for (let w = 560; w <= 1480; w += 40) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: 860 });
  await page.goto(`${PAGE}#allpolls`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".rd-ap-tabs button", { timeout: 30000 });
  await new Promise((r) => setTimeout(r, 900));
  await page.evaluate(() => {
    const t = [...document.querySelectorAll(".rd-ap-tabs button")].find((n) => /^Issues$/.test(n.textContent.trim()));
    t.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
  await new Promise((r) => setTimeout(r, 500));
  const m = await page.evaluate(MEASURE);
  const hits = [];
  const tkPairs = [];
  for (let i = 0; i < m.tks.length; i++) {
    if (inter(m.cap, m.tks[i])) hits.push(`cap∩tk${i}`);
    if (inter(m.tks[i], m.best)) hits.push(`tk${i}∩best`);
    for (let j2 = i + 1; j2 < m.tks.length; j2++) if (inter(m.tks[i], m.tks[j2])) tkPairs.push(`${i}∩${j2}`);
  }
  if (inter(m.cap, m.best)) hits.push("cap∩best");
  if (tkPairs.length) hits.push("tk∩tk:" + tkPairs.join(","));
  let dotHit = 0;
  for (let i = 0; i < m.dots.length; i++) {
    if (m.net && m.dots[i] && m.dots[i].x + m.dots[i].w > m.net.x + 0.5) dotHit++;
    for (let j2 = i + 1; j2 < m.dots.length; j2++) if (inter(m.dots[i], m.dots[j2])) dotHit++;
  }
  if (dotHit) hits.push(`dotsX:${dotHit}`);
  if (m.pic && m.net && m.pic.x + m.pic.w > m.net.x + 0.5) hits.push("picruns past netcell→");
  if (hits.length) worst++;
  console.log(`${w}px ${m.which} hpic=${m.hpic ? m.hpic.w : "-"} row=${m.rowH} ${hits.length ? "HITS: " + hits.join(" ") : "clean"}`);
  await page.close();
}
console.log(worst ? `\n${worst} widths with collisions` : "\nall widths clean");
await browser.close();
