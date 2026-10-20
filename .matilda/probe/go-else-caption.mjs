// Headless pin: on the phone rows of "where the majors' 2025 voters are
// going" every kept row carries the ONE caption form "Went elsewhere" - on
// the residue tint of .rd-go-rbar while the residue holds it (never inside
// the full-colour kept fill), on its own right-aligned line under the bar
// once it no longer does. The Greens' 78.5% kept at 320px left the tint
// 60px wide and the right-pinned 80px label slid 28px back onto the fill in
// its own green (user phone report 2026-10-20); the first fix laddered the
// wording to "Elsewhere" (then dropped) and the user called for a wrap
// instead of a shorten (2026-10-20). Serves the built tree on a port;
// PROBE_BASE override as usual.
import { createRequire } from "module";
const require = createRequire("/Users/joshuaborgnolo/auspol tracker/node_modules/");
const puppeteer = require("puppeteer-core");

const BASE = process.env.PROBE_BASE || "http://127.0.0.1:8971";
const CAPTION = "Went elsewhere";
let ok = true;
const say = (good, msg) => { console.log((good ? "PASS " : "FAIL ") + msg); if (!good) ok = false; };

const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new",
});
const page = await browser.newPage();

let sawInline = 0, sawBelow = 0;
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
      const inline = bar.querySelector(".rd-go-else");
      const below = kept.querySelector(".rd-go-elsebelow");
      const out = { name: kept.querySelector(".rd-go-rtop b").textContent.trim(), forms: 0 };
      if (inline) {
        out.forms++;
        out.inlineText = inline.textContent.trim();
        const lb = inline.getBoundingClientRect(), sb = span.getBoundingClientRect(), bb = bar.getBoundingClientRect();
        out.onTint = lb.left >= sb.right - 1 && lb.right <= bb.right + 1;
      }
      if (below) {
        out.forms++;
        out.belowText = below.textContent.trim();
        const lb = below.getBoundingClientRect(), bb = bar.getBoundingClientRect();
        out.belowOk = lb.top >= bb.bottom - 1 && Math.abs(lb.right - bb.right) <= 1 && lb.left >= bb.left - 1;
      }
      return out;
    });
    const where = `${view} @ ${vw}px (${st.name || "?"})`;
    if (st.err) { say(false, `${where}: ${st.err}`); continue; }
    say(st.forms === 1, `${where}: exactly one caption form rendered (got ${st.forms})`);
    if (st.inlineText != null) {
      sawInline++;
      say(st.inlineText === CAPTION, `${where}: inline caption reads ${JSON.stringify(st.inlineText)}`);
      say(!!st.onTint, `${where}: inline caption sits wholly on the tint`);
    }
    if (st.belowText != null) {
      sawBelow++;
      say(st.belowText === CAPTION, `${where}: below caption reads ${JSON.stringify(st.belowText)}`);
      say(!!st.belowOk, `${where}: below caption sits under the bar, right-aligned inside the row`);
    }
  }
}
say(sawInline > 0 && sawBelow > 0, `both forms exercised across the matrix (inline ${sawInline}, below ${sawBelow})`);
await browser.close();
process.exit(ok ? 0 : 1);
