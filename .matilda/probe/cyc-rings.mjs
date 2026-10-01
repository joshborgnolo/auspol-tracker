/* cyc-rings: the Past-cycles 2PP chart rings every DRAWN term at both of its
   elections - opening at x=0, closing at the next election's result - each in
   its line's own colour, the hero's rule (the old ink ring for 2025 alone is
   gone, replaced by a Labor-red ring). Asserts at 1280 and 390:
   - default view: exactly one tpp ring, in the current term's line colour
     (computed stroke equals a series line's; inline stroke is cur.color),
     sitting at data x=0 (mapped via the "Election"/"1 yr"… tick labels).
   - the two primary charts keep their single ink ring untouched (no inline
     stroke) and the two leaders charts carry none.
   - the section key says "Each term’s election results" on 2PP and
     "{year} election result" on primary.
   - lifting 1996 from the board gives three tpp rings: 2025's opening plus
     1996's opening (at px(0)) and closing (at px(endRes.x)); the two 1996
     rings wear its line's colour; all groups at opacity 1.
   - Level→Change flips every tpp ring group to opacity 0 (they fade in
     place, not away); the primary rings fade too. Flip back, unlift 1996,
     and the card is back to the single current-colour ring.
   - no page-level overflow, no page errors. */
import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import puppeteer from "puppeteer-core";

const ROOT = "/Users/joshuaborgnolo/auspol tracker";
const PORT = 8971;
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".xml": "application/xml", ".woff2": "font/woff2" };

const server = http.createServer(async (req, res) => {
  try {
    const p = join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/^\/+/, "") || "index.html");
    const body = await readFile(p.endsWith("/") ? p + "index.html" : p);
    res.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" });
    res.end(body);
  } catch { res.writeHead(404); res.end("nf"); }
});

let fails = 0;
const check = (name, ok, detail = "") => {
  console.log((ok ? "PASS " : "FAIL ") + name + (detail ? " — " + detail : ""));
  if (!ok) fails++;
};

(async () => {
  await new Promise((r) => server.listen(PORT, r));
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
  try {
    for (const vw of [1280, 390]) {
      const page = await browser.newPage();
      const pageErrors = [];
      page.on("pageerror", (e) => pageErrors.push(String(e)));
      await page.setViewport({ width: vw, height: 900 });
      await page.goto(`http://127.0.0.1:${PORT}/#cycles`, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForSelector("#cyc-tpp .rd-cyc-chart", { timeout: 45000 });
      await new Promise((r) => setTimeout(r, 1200));

      /* everything the asserts need, read live: the two drawn terms' line
         colours, 1996's closing result, and the pixel transform px(dataX)
         fitted through the x-tick labels' positions */
      const live = () => page.evaluate(() => {
        const D = window.AP.D;
        const cur = D.cycles.find((c) => c.current);
        const c96 = D.cycles.find((c) => c.year === 1996);
        const TICK_X = { "Election": 0, "1 year": 12, "1 yr": 12, "2 years": 24, "2 yrs": 24, "3 years": 36, "3 yrs": 36 };
        const ticks = [...document.querySelectorAll("#cyc-tpp text.axis-label.x")]
          .map((t) => ({ x: +t.getAttribute("x"), d: TICK_X[t.textContent.trim()] }))
          .filter((t) => t.d != null);
        const n = ticks.length;
        const sx_ = ticks.reduce((a, t) => a + t.d, 0) / n, sy_ = ticks.reduce((a, t) => a + t.x, 0) / n;
        const b = ticks.reduce((a, t) => a + (t.d - sx_) * (t.x - sy_), 0) / ticks.reduce((a, t) => a + (t.d - sx_) ** 2, 0);
        const a = sy_ - b * sx_;
        /* the peer-mean dot rides the same .rd-mark machinery with a fixed
           var(--ink-2) paint; the election rings are the party-coloured (or,
           on the primary cards, ink-by-CSS) siblings - drop the mean so the
           ring lists count only election rings */
        const meanless = (list) => list.filter((r) => r.stroke !== "var(--ink-2)");
        const ringOf = (g) => {
          const c = g.querySelector("circle.rd-ring");
          return { op: getComputedStyle(g).opacity, stroke: c.style.stroke,
                   cstroke: getComputedStyle(c).stroke, cx: +c.getAttribute("cx"), cy: +c.getAttribute("cy") };
        };
        const ringsOf = (sel) => meanless([...document.querySelectorAll(sel + " .rd-mark")].map(ringOf));
        const lineStrokes = [...document.querySelectorAll("#cyc-tpp path.series-line")].map((p) => getComputedStyle(p).stroke);
        return {
          nTicks: n, px: null, a, b,
          curColor: cur.color, curYear: cur.year,
          c96color: c96.color, c96endRes: c96.endRes || null,
          tpp: ringsOf("#cyc-tpp"),
          primaryN: [...document.querySelectorAll("#cyc-primary .rd-cyc-chart")].map((ch) => meanless([...ch.querySelectorAll(".rd-mark")].map(ringOf)).length),
          primaryRings: ringsOf("#cyc-primary"),
          leadersN: ringsOf("#cyc-leaders").length,
          lineStrokes,
          tppKey: [...document.querySelectorAll("#cyc-tpp .rd-key-item")].map((n2) => n2.textContent.trim()),
          primKey: [...document.querySelectorAll("#cyc-primary .rd-key-item")].map((n2) => n2.textContent.trim()),
          overflow: document.documentElement.scrollWidth - window.innerWidth,
        };
      });
      const px = (L, d) => L.a + L.b * d;

      let L = await live();
      check(`[${vw}] default: exactly one ring on the 2PP chart`, L.tpp.length === 1, `saw ${L.tpp.length}`);
      check(`[${vw}] the ring wears the ${L.curYear} term's line colour`,
        L.tpp.length === 1 && L.tpp[0].stroke === L.curColor,
        L.tpp.length === 1 ? `${L.tpp[0].stroke} vs ${L.curColor}` : "(no ring)");
      check(`[${vw}] the 2025 ink ring is gone (ring stroke is a party colour, not ink)`,
        L.tpp.length === 1 && L.tpp[0].stroke !== "var(--ink)" && L.tpp[0].stroke !== "", L.tpp.length === 1 ? L.tpp[0].stroke : "(no ring)");
      check(`[${vw}] a series line wears the ring's paint (the current term)`,
        L.tpp.length === 1 && L.lineStrokes.includes(L.tpp[0].cstroke),
        L.tpp.length === 1 ? `${L.tpp[0].cstroke} vs lines ${JSON.stringify(L.lineStrokes)}` : "(no ring)");
      check(`[${vw}] the ring opens the term (cx = px(0))`,
        L.tpp.length === 1 && Math.abs(L.tpp[0].cx - px(L, 0)) <= 2,
        L.tpp.length === 1 ? `cx ${L.tpp[0].cx} vs px(0) ${px(L, 0).toFixed(2)}` : "(no ring)");
      check(`[${vw}] both primary charts keep exactly one ring`,
        L.primaryN.length === 2 && L.primaryN.every((m) => m === 1), JSON.stringify(L.primaryN));
      check(`[${vw}] primary rings stay ink (no inline stroke)`,
        L.primaryRings.every((r) => r.stroke === "") && L.primaryRings.length === 2,
        JSON.stringify(L.primaryRings.map((r) => r.stroke)) + " computed " + JSON.stringify(L.primaryRings.map((r) => r.cstroke)));
      check(`[${vw}] leaders charts carry no rings`, L.leadersN === 0, `saw ${L.leadersN}`);
      check(`[${vw}] 2PP key names every term's election results`,
        L.tppKey.some((t) => t === "Each term’s election results"), JSON.stringify(L.tppKey));
      check(`[${vw}] primary key still names the ${L.curYear} result alone`,
        L.primKey.some((t) => t === L.curYear + " election result"), JSON.stringify(L.primKey));

      /* draw 1996's own line from the board */
      await page.evaluate(() => {
        const chip = [...document.querySelectorAll("button.rd-chip")].find((b) => /Draw a (past )?term/.test(b.textContent));
        chip.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      });
      await page.waitForSelector(".rd-cc-board", { timeout: 10000 });
      await page.evaluate(() => {
        const term = [...document.querySelectorAll(".rd-cc-term")]
          .find((t) => { const b = t.querySelector(".rd-cc-main b"); return b && b.textContent.trim() === "1996"; });
        term.querySelector(".rd-cc-main").dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      });
      await new Promise((r) => setTimeout(r, 700));
      L = await live();
      check(`[${vw}] lifting 1996 puts three rings on the 2PP chart`, L.tpp.length === 3, `saw ${L.tpp.length}`);
      const c96rings = L.tpp.filter((r) => r.stroke === L.c96color);
      check(`[${vw}] two rings wear 1996's line colour, one keeps ${L.curYear}'s`,
        c96rings.length === 2 && L.tpp.filter((r) => r.stroke === L.curColor).length === 1,
        JSON.stringify(L.tpp.map((r) => r.stroke)));
      check(`[${vw}] the data landed: 1996's closing result is on D.cycles`,
        !!(L.c96endRes && typeof L.c96endRes.x === "number"),
        JSON.stringify(L.c96endRes));
      const cx96 = c96rings.map((r) => r.cx).sort((p, q) => p - q);
      check(`[${vw}] 1996's opening ring sits at the election line (px(0))`,
        c96rings.length === 2 && Math.abs(cx96[0] - px(L, 0)) <= 2,
        c96rings.length === 2 ? `cx ${cx96[0]} vs px(0) ${px(L, 0).toFixed(2)}` : "(rings missing)");
      check(`[${vw}] 1996's closing ring sits at the 1998 election (px(${L.c96endRes ? L.c96endRes.x : "?"}))`,
        c96rings.length === 2 && !!L.c96endRes && Math.abs(cx96[1] - px(L, L.c96endRes.x)) <= 2,
        c96rings.length === 2 && L.c96endRes ? `cx ${cx96[1]} vs px ${px(L, L.c96endRes.x).toFixed(2)}` : "(rings missing)");
      check(`[${vw}] lifted rings draw at full weight`, L.tpp.every((r) => r.op === "1"),
        JSON.stringify(L.tpp.map((r) => r.op)));

      /* change mode fades every election ring where it is */
      await page.evaluate(() => {
        const b = [...document.querySelectorAll(".rd-cc-tabs .rd-tab")].find((x) => /^Change/.test(x.textContent.trim()));
        b.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      });
      await new Promise((r) => setTimeout(r, 1600));
      L = await live();
      check(`[${vw}] change mode fades all 2PP rings in place`, L.tpp.length === 3 && L.tpp.every((r) => r.op === "0"),
        `${L.tpp.length} rings, ops ${JSON.stringify(L.tpp.map((r) => r.op))}`);
      check(`[${vw}] change mode fades the primary rings too`,
        L.primaryRings.length === 2 && L.primaryRings.every((r) => r.op === "0"),
        `ops ${JSON.stringify(L.primaryRings.map((r) => r.op))}`);

      /* level mode, then 1996 back into the band: the single coloured ring returns */
      await page.evaluate(() => {
        const b = [...document.querySelectorAll(".rd-cc-tabs .rd-tab")].find((x) => x.textContent.trim() === "Level");
        b.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      });
      await new Promise((r) => setTimeout(r, 1600));
      await page.evaluate(() => {
        const pill = [...document.querySelectorAll(".rd-cc-pill")].find((t) => t.textContent.includes("1996"));
        pill.querySelector("button").dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      });
      await new Promise((r) => setTimeout(r, 700));
      L = await live();
      check(`[${vw}] unlifting returns the single ${L.curYear}-colour ring`,
        L.tpp.length === 1 && L.tpp[0].stroke === L.curColor && L.tpp[0].op === "1",
        JSON.stringify(L.tpp.map((r) => [r.stroke, r.op])));

      check(`[${vw}] no page-level horizontal overflow`, L.overflow <= 0, `overshoot ${L.overflow}px`);
      check(`[${vw}] no page errors`, pageErrors.length === 0, pageErrors[0] || "");
      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  console.log(fails === 0 ? "ALL GREEN" : `${fails} FAILURES`);
  process.exit(fails === 0 ? 0 : 1);
})();
