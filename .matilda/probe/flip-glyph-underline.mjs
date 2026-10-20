import { createRequire } from "module";
const require = createRequire("/Users/joshuaborgnolo/auspol tracker/node_modules/");
const puppeteer = require("puppeteer-core");

const BASE = "http://127.0.0.1:8971";
const PAGES = ["/", "/flows-explained/", "/allpolls/"];

const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new",
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });

let ok = true;
const say = (good, msg) => { console.log((good ? "PASS " : "FAIL ") + msg); if (!good) ok = false; };

for (const path of PAGES) {
  await page.goto(BASE + path, { waitUntil: "networkidle0", timeout: 60000 });
  await page.waitForFunction(() => document.querySelectorAll("button.rd-pl-flip").length > 0, { timeout: 30000 });

  const handles = await page.evaluateHandle(() =>
    Array.from(document.querySelectorAll("button.rd-pl-flip")).filter((b) => b.offsetParent)
  );
  const els = await handles.getProperties();
  let n = 0;
  for (const h of els.values()) {
    const el = h.asElement();
    if (!el) continue;
    n++;
    const txt = await el.evaluate((b) => b.textContent.trim());
    await el.evaluate((b) => b.scrollIntoView({ block: "center" }));
    await el.hover();
    await new Promise((res) => setTimeout(res, 120));
    const r = await el.evaluate((b) => {
      const t = b.querySelector(".rd-pl-flip-t");
      const g = b.querySelector("span[aria-hidden]");
      return {
        hasLabel: !!t,
        hasGlyph: !!g,
        btnDec: getComputedStyle(b).textDecorationLine,
        labelDec: t ? getComputedStyle(t).textDecorationLine : "(none)",
        glyphDec: g ? getComputedStyle(g).textDecorationLine : "(none)",
      };
    });
    say(r.hasLabel && r.hasGlyph, `${path} flip ${n} (${JSON.stringify(txt)}): label span + glyph span present`);
    say(r.btnDec === "none", `${path} flip ${n}: button itself carries no text-decoration (${r.btnDec})`);
    say(r.labelDec.includes("underline"), `${path} flip ${n}: hover underlines the WORDS (${r.labelDec})`);
    say(r.glyphDec === "none", `${path} flip ${n}: hover does NOT underline the glyph (${r.glyphDec})`);
  }
  say(n > 0, `${path}: found ${n} visible rd-pl-flip control(s)`);
}

await browser.close();
console.log(ok ? "ALL PASS" : "FAILURES ABOVE");
process.exit(ok ? 0 : 1);
