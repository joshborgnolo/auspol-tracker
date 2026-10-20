// Phone-width probe (Chrome): does the flows-explained chart mount + have size at 390px?
import puppeteer from "puppeteer-core";

const CHROME = process.env.CHROME || process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const URL = process.argv[2] || "https://auspoltracker.com/flows-explained/";

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new",
  args: ["--headless=new", "--disable-gpu"] });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 300)); });
page.on("pageerror", (e) => errors.push("PAGEERROR " + String(e).slice(0, 300)));

await page.goto(URL, { waitUntil: "networkidle2", timeout: 60000 });
await new Promise((r) => setTimeout(r, 3000));

const st = await page.evaluate(() => {
  const slot = document.getElementById("ex-fig-flow");
  const chain = [];
  let el = slot;
  while (el && el !== document.body) {
    const cs = getComputedStyle(el);
    chain.push({ tag: el.tagName, id: el.id || null, cls: String(el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className).slice(0, 60), display: cs.display, vis: cs.visibility, op: cs.opacity, h: el.getBoundingClientRect().height });
    el = el.parentElement;
  }
  const chips = document.querySelector(".ex-flow-chips");
  const rsec = document.querySelector("section.rd-explained");
  const rslot = rsec ? rsec.querySelector(".ex-slot") : null;
  const rsvg = rsec ? rsec.querySelector("svg") : null;
  const rchain = [];
  el = rslot;
  while (el && el !== document.body) {
    const cs = getComputedStyle(el);
    rchain.push({ tag: el.tagName, id: el.id || null, cls: String(el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className).slice(0, 60), display: cs.display, vis: cs.visibility, op: cs.opacity, h: el.getBoundingClientRect().height });
    el = el.parentElement;
  }
  const svg = rslot ? rslot.querySelector("svg") : null;
  return {
    vw: window.innerWidth,
    docScrollW: document.documentElement.scrollWidth,
    slotExists: !!slot,
    slotChildren: slot ? slot.childElementCount : -1,
    slotDisplay: slot ? getComputedStyle(slot).display : null,
    slotRect: slot ? slot.getBoundingClientRect().toJSON() : null,
    chipsRect: chips ? chips.getBoundingClientRect().toJSON() : null,
    chipLabels: chips ? [...chips.querySelectorAll("button")].map((b) => b.textContent.trim()) : null,
    svgRect: svg ? svg.getBoundingClientRect().toJSON() : null,
    svgPaths: svg ? svg.querySelectorAll("path").length : -1,
    ancestorChain: chain,
    rslotChildren: rslot ? rslot.childElementCount : -1,
    rslotRect: rslot ? rslot.getBoundingClientRect().toJSON() : null,
    rslotInStaticArticle: !!(rslot && rslot.closest("article.static-summary")),
    rchain,
    rFullyVisible: rchain.length > 0 && rchain.every((a) => a.display !== "none" && a.op !== "0" && a.vis !== "hidden"),
    flowHistoryKeys: (window.AUSPOL && window.AUSPOL.flowHistory) ? Object.keys(window.AUSPOL.flowHistory) : null,
  };
});
console.log(JSON.stringify(st, null, 2));
console.error("console errors:", errors.length ? errors : "none");
await browser.close();
