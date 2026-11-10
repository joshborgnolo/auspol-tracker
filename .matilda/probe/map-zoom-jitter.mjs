// Probe: zooming never resizes the stage, and no zoom level makes the map oscillate.
// History (user report 2026-11-10): the Jump-to row hid at 3 x HOME.k, which grew
// the stage, lowered HOME.k (the country's fit to the stage) and brought the row
// back — the stage flipped 460/490px every frame between ~3.0 and 3.2 x HOME.k and
// the map jumped 15px each time. This walks the zoom slowly (4% steps) from the
// country fit to street depth in each drawing at several window sizes, holding each
// step for six frames: any stage height change, or any T.y drift while held, fails.
// usage: node .matilda/probe/map-zoom-jitter.mjs <baseUrl>  (serve the repo root first)
import puppeteer from "puppeteer-core";
const base = process.argv[2];
if (!base) { console.error("need base url"); process.exit(2); }
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--no-sandbox"] });
const fails = []; const ok = (n, c, d = "") => { console.log(`${c ? "ok  " : "FAIL"} ${n}${d ? " — " + d : ""}`); if (!c) fails.push(n); };
const SIZES = process.argv[3] ? process.argv.slice(3).map((s) => s.split("x").map(Number)) : [[1280, 860], [1440, 900], [1024, 768]];
for (const [W, H] of SIZES) {
  const p = await browser.newPage(); await p.setViewport({ width: W, height: H });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(base + "/map/index.html", { waitUntil: "domcontentloaded" });
  for (let i = 0; i < 300; i++) { if (await p.evaluate(() => !!(window.__map && window.__map.setDraw && window.__map.M() && window.__map.M().geo))) break; await new Promise((r) => setTimeout(r, 200)); }
  await new Promise((r) => setTimeout(r, 2500));
  for (const draw of ["seats", "balloons", "surface"]) {
    const r = await p.evaluate(async (draw) => {
      const mp = window.__map, st = document.querySelector("#stage"), raf = () => new Promise((r) => requestAnimationFrame(r));
      mp.setDraw(draw); for (let i = 0; i < 30; i++) await raf();
      const k0 = mp.HOME.k, h0 = st.getBoundingClientRect().height, bad = [], heights = new Set();
      for (let f = 1.02; f <= 40; f *= 1.04) {
        mp.view([151.0, -33.8], k0 * f);
        await raf(); await raf();
        const y0 = mp.T.y, hs = new Set();
        for (let i = 0; i < 6; i++) { await raf(); hs.add(Math.round(st.getBoundingClientRect().height)); }
        heights.add(...hs);
        if (hs.size > 1 || Math.abs(mp.T.y - y0) > 0.5) bad.push(`${f.toFixed(2)}x: heights ${[...hs].join("/")} dy ${(mp.T.y - y0).toFixed(1)}`);
      }
      return { bad, heights: [...heights], h0 };
    }, draw);
    ok(`${W}x${H} ${draw}: no oscillation while a zoom is held`, r.bad.length === 0, r.bad.slice(0, 3).join("; "));
    ok(`${W}x${H} ${draw}: zooming never resizes the stage`, r.heights.length === 1, `heights seen ${r.heights.join(", ")}`);
  }
  ok(`${W}x${H}: no page errors`, errs.length === 0, errs[0] || "");
  await p.close();
}
await browser.close();
if (fails.length) { console.log(`${fails.length} failed`); process.exit(1); }
