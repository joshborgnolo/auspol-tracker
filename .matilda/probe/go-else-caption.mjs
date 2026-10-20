// Headless pin: on the phone rows of "where the majors' 2025 voters are
// going" the kept row's residual-tint caption ("Went elsewhere" / the short
// "Elsewhere") must sit wholly on the tint of .rd-go-rbar - never inside
// the full-colour kept fill. The Greens' 78.5% kept at 320px left the tint
// 60px wide and the right-pinned 80px label slid 28px back onto the fill in
// its own green (user phone report 2026-10-20); the caption now ladders to
// the short form and then drops instead of crossing the fill. Serves the
// built tree on a port; PROBE_BASE override as usual.
import { createRequire } from "module";
const require = createRequire("/Users/joshuaborgnolo/auspol tracker/node_modules/");
const puppeteer = require("puppeteer-core");

const BASE = process.env.PROBE_BASE || "http://127.0.0.1:8971";
const ALLOWED = ["Went elsewhere", "Elsewhere"];
let ok = true;
const say = (good, msg) => { console.log((good ? "PASS " : "FAIL ") + msg); if (!good) ok = false; };

const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new",
});
const page = await browser.newPage();

for (const vw of [390, 320]) {
  await page.setViewport({ width: vw, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.goto(BASE + "/", { waitUntil: "networkidle2", timeout: 60000 });
  await page.evaluate(() => new Promise((res) => {
    (document.querySelector(".rd-go-wrap") || document.querySelector(".rd-mo-wrap"))?.scrollIntoView({ block: "center" });
    setTimeout(res, 2200);
  }));
  for (const view of ["lnp", "alp", "grn"]) {
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll(".rd-sw-cycle")];
      btns[btns.length - 1]?.click();
    });
    await new Promise((r) => setTimeout(r, 1000));
    const st = await page.evaluate(() => {
      const kept = [...document.querySelectorAll(".rd-go-rows .rd-go-row")].find((r) => r.querySelector(".rd-go-first"));
      if (!kept) return { err: "no kept row" };
      const bar = kept.querySelector(".rd-go-rbar");
      const span = bar.querySelector("span");
      const lab = bar.querySelector(".rd-go-else");
      if (!lab) return { name: kept.querySelector(".rd-go-rtop b").textContent.trim(), label: null };
      const lb = lab.getBoundingClientRect(), sb = span.getBoundingClientRect(), bb = bar.getBoundingClientRect();
      return {
        name: kept.querySelector(".rd-go-rtop b").textContent.trim(),
        label: lab.textContent,
        left: lb.left, right: lb.right, fillRight: sb.right, barRight: bb.right,
        onTint: lb.left >= sb.right - 1 && lb.right <= bb.right + 1,
      };
    });
    const where = `${view} @ ${vw}px (${st.name || "?"})`;
    if (st.err) { say(false, `${where}: ${st.err}`); continue; }
    if (st.label === null) { say(true, `${where}: caption dropped, no fill crossing`); continue; }
    say(ALLOWED.includes(st.label), `${where}: caption is a known form: ${JSON.stringify(st.label)}`);
    say(!!st.onTint, `${where}: caption sits wholly on the tint (label ${Math.round(st.left)}-${Math.round(st.right)}, fill ends ${Math.round(st.fillRight)})`);
  }
}
await browser.close();
process.exit(ok ? 0 : 1);
