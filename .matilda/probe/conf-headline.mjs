/* Probe (run: node .matilda/probe/conf-headline.mjs): the 2026-10-07 change
   that keeps the All-polls where-things-stand head/dek on the CONFIDENCE
   facet. The facet replaces its row set with confidence releases (no 2PP
   figure), which silently emptied the window the RdHed is computed from and
   the headline vanished on that facet alone; RdAllPolls now derives the
   window from D.individualPolls there (rd-allpolls.jsx). Asserts the head
   and dek on the Confidence facet are byte-identical to the 2PP facet's,
   on a tab walk at two widths and on a first-paint deep link, and that the
   section chrome (the "Economic sentiment" title) was untouched. */
import puppeteer from "puppeteer-core";
import path from "path";
import process from "process";

const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PAGE = "file://" + path.resolve(process.cwd(), "index.html");
let fails = 0;
const check = (ok, msg) => { console.log((ok ? "  ok " : "FAIL ") + msg); if (!ok) fails++; };

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
page.on("pageerror", (e) => { console.log("PAGEERROR", String(e).slice(0, 300)); fails++; });

const hedOf = () => page.evaluate(() => {
  const h = document.querySelector(".rd-ap h2.rd-hed");
  const d = document.querySelector(".rd-ap p.rd-dek");
  const title = document.querySelector(".rd-ap h2.rd-title");
  return {
    head: h ? h.textContent.trim() : null,
    dek: d ? d.textContent.trim() : null,
    title: title ? title.textContent.trim() : null,
  };
});
const gotoPolls = async (w) => {
  await page.setViewport({ width: w, height: 980, deviceScaleFactor: 1 });
  await page.goto(PAGE + "#allpolls", { waitUntil: "networkidle0", timeout: 60000 });
  await page.waitForSelector(".rd-ap-tabs .rd-tab", { timeout: 30000 });
  await page.waitForFunction(() => !!document.querySelector(".rd-ap h2.rd-hed"), { timeout: 30000 });
};

/* 1. tab walk, two widths: same head/dek before and after opening Confidence */
for (const w of [760, 1366]) {
  await gotoPolls(w);
  const base = await hedOf();
  check(base.head && base.head.startsWith("Labor’s"), `${w}px 2PP: head computed (${base.head && base.head.slice(0, 60)}…)`);
  check(base.dek && base.dek.includes("none sits further"), `${w}px 2PP: dek computed`);
  await page.evaluate(() => {
    [...document.querySelectorAll(".rd-ap-tabs .rd-tab")].find((el) => el.textContent.trim() === "Confidence").click();
  });
  await page.waitForFunction(
    () => {
      const a = document.querySelector(".rd-ap-tabs .rd-tab[aria-pressed='true']");
      return a && a.textContent.trim() === "Confidence";
    },
    { timeout: 10000 });
  await page.waitForFunction(
    (want) => {
      const h = document.querySelector(".rd-ap h2.rd-hed");
      const d = document.querySelector(".rd-ap p.rd-dek");
      return h && d && h.textContent.trim() === want.head && d.textContent.trim() === want.dek;
    },
    { timeout: 10000 }, base).catch(() => {});
  const onConf = await hedOf();
  check(onConf.head === base.head, `${w}px Confidence: head identical (${JSON.stringify((onConf.head || "").slice(0, 50))})`);
  check(onConf.dek === base.dek, `${w}px Confidence: dek identical`);
  check(onConf.title === "Economic sentiment", `${w}px Confidence: chrome still reads Economic sentiment`);
}

/* 2. first-paint deep link, no tab walk involved */
await gotoPolls(760);
const wantFromWalk = await hedOf();
await page.goto(PAGE + "?f=c#allpolls", { waitUntil: "networkidle0" });
await page.waitForSelector(".rd-ap-tabs .rd-tab", { timeout: 30000 });
await page.waitForFunction(
  () => {
    const a = document.querySelector(".rd-ap-tabs .rd-tab[aria-pressed='true']");
    return a && a.textContent.trim() === "Confidence" && !!document.querySelector(".rd-ap h2.rd-hed");
  },
  { timeout: 10000 }).catch(() => {});
const deep = await hedOf();
check(deep.head === wantFromWalk.head && deep.head != null, `deep link ?f=c: head identical on first paint (${JSON.stringify((deep.head || "").slice(0, 50))})`);
check(deep.dek === wantFromWalk.dek && deep.dek != null, "deep link ?f=c: dek identical on first paint");

/* 3. SOURCE pin: the window comes from D.individualPolls on the facet */
const src = await import("fs").then((fs) => fs.default.readFileSync(path.resolve(process.cwd(), ".build/newtracker/assets/rd-allpolls.jsx"), "utf8"));
check(src.includes('const win = (facet === "confidence" ? D.individualPolls : rows).filter(inToday)'),
  "rd-allpolls.jsx sources the head/dek window from D.individualPolls on the confidence facet");

await browser.close();
console.log(fails ? `FAIL (${fails})` : "ALL CHECKS PASSED");
process.exit(fails ? 1 : 0);
