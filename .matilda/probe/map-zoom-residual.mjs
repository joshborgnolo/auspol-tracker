// Probe: /map/'s zoom carries on past the gesture, and doesn't lurch (app-2-map.js, zoom easing).
// usage: node .matilda/probe/map-zoom-residual.mjs <baseUrl>   (serve the repo root first)
// Real, trusted input through CDP: a pinch as Chrome sends it (ctrl-wheel), and touches. Each
// pinch has a shape, since what must be told apart is how the stream ENDS:
//  - lifted in motion: the pace holds to the last event, then silence        → glides
//  - slowing, but lifted still moving: the usual pinch                        → glides at the last pace
//  - coming to rest: the pace falls over the last events, then silence        → stops dead
//  - a slow pinch, stopped                                                    → stops dead
//  - a pause mid-pinch, fingers down, then on again                           → no lurch in the pause
//  - pinching again during a glide takes the zoom back at once
//  - a flick out at the whole country stops at the fit
// Synthetic streams can't prove the feel of a real trackpad: try one.
import puppeteer from "puppeteer-core";

const base = process.argv[2];
if (!base) { console.error("need base url, e.g. http://127.0.0.1:8123"); process.exit(2); }
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--no-sandbox"] });
const fails = []; const ok = (n, c, d = "") => { console.log(`${c ? "ok  " : "FAIL"} ${n}${d ? " — " + d : ""}`); if (!c) fails.push(n); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const page = await browser.newPage();
const errs = []; page.on("pageerror", (e) => errs.push(e.message));
await page.setViewport({ width: 1280, height: 860, deviceScaleFactor: 1 });
await page.goto(`${base}/map/#y=2025`, { waitUntil: "networkidle2", timeout: 60000 });
await wait(2500);
await page.evaluate(() => document.querySelector("#stage").scrollIntoView({ block: "center", behavior: "instant" })); await wait(300);
const box = await page.evaluate(() => { const r = document.querySelector("#cv").getBoundingClientRect(); return { x: r.left + r.width * 0.7, y: r.top + r.height * 0.6 }; });
const cdp = await page.createCDPSession();
const k = () => page.evaluate(() => window.__map.T.k);
const home = () => page.evaluate(() => window.__map.goAus({ dur: 0 }));
// a pinch at a real 60-a-second beat, in the page, and at whatever beat trusted input manages (about
// 15 a second here, like a busy map): the same rules must hold at both, in any browser
let trusted = false;
const pinch = async (deltas) => {
  // (measured afresh: the story's height changes with the selection, and with it the canvas's spot on the screen)
  const at = await page.evaluate(() => { document.querySelector("#stage").scrollIntoView({ block: "center", behavior: "instant" }); const r = document.querySelector("#cv").getBoundingClientRect(); return { x: r.left + r.width * 0.7, y: r.top + r.height * 0.6 }; });
  if (trusted) { for (const d of deltas) await cdp.send("Input.dispatchMouseEvent", { type: "mouseWheel", x: at.x, y: at.y, deltaX: 0, deltaY: d, modifiers: 2, pointerType: "mouse" }); return; }
  await page.evaluate(async (deltas, x, y) => {
    const c = document.querySelector("#cv");
    for (const d of deltas) { c.dispatchEvent(new WheelEvent("wheel", { deltaY: d, deltaMode: 0, ctrlKey: true, clientX: x, clientY: y, bubbles: true, cancelable: true })); await new Promise((r) => setTimeout(r, 16)); }
  }, deltas, at.x, at.y);
};
const after = async (deltas) => { await pinch(deltas); const k0 = await k(); await wait(1100); const k1 = await k(); return Math.log2(k1 / k0); };
const steady = (n, d) => Array.from({ length: n }, () => d);
const easing = (d) => [1, 0.8, 0.6, 0.42, 0.28, 0.17, 0.09, 0.04].map((f) => d * f);

let g;
for (const tag of ["60 a second", "slow stream"]) {
  trusted = tag !== "60 a second";
  await home(); await wait(500);
  g = await after(steady(26, -6));
  ok(`${tag}: in, lifted in motion: it carries on`, g > (trusted ? 0.2 : 0.8), `${g.toFixed(2)} octaves`);
  await home(); await wait(900);
  await pinch(steady(40, -6)); await wait(1200);
  g = await after(steady(26, 6));
  ok(`${tag}: out, lifted in motion: it carries on`, g < (trusted ? -0.2 : -0.8), `${g.toFixed(2)} octaves`);
  await home(); await wait(900);
  // the usual pinch: slowing, but lifted while still moving
  g = await after([...steady(22, -6), ...[0.9, 0.8, 0.7, 0.6, 0.55, 0.5].map((f) => -6 * f)]);
  ok(`${tag}: slowing but lifted still moving: it carries on at that pace`, g > (trusted ? 0.08 : 0.35), `${g.toFixed(2)} octaves`);
  await home(); await wait(900);
  g = await after([...steady(22, -6), ...easing(-6)]);
  ok(`${tag}: coming to rest: it stops with the fingers`, Math.abs(g) < 0.03, `${g.toFixed(3)} octaves`);
  await home(); await wait(900);
  g = await after(steady(30, -0.5));
  ok(`${tag}: a slow pinch: it stops with the fingers`, Math.abs(g) < 0.03, `${g.toFixed(3)} octaves`);
  await home(); await wait(900);
  await pinch([...steady(18, -6), ...easing(-6)]);
  const p0 = await k(); await wait(220); const p1 = await k();
  ok(`${tag}: a pause with the fingers down: no lurch in it`, Math.abs(Math.log2(p1 / p0)) < 0.03, `${Math.log2(p1 / p0).toFixed(3)} octaves`);
  await home(); await wait(900);
  await pinch(steady(24, -6)); await wait(150);
  const mid = await k();
  await pinch([0.4, 0.4, 0.4]);
  const stopped = await k(); await wait(260);
  const held = await k();
  ok(`${tag}: a new pinch takes the glide back`, stopped < mid * 1.25 && Math.abs(Math.log2(held / stopped)) < 0.1, `${mid.toFixed(2)} → ${stopped.toFixed(2)} → ${held.toFixed(2)}`);
  await home(); await wait(900);
  const h0 = await k();
  g = await after(steady(26, 6));
  const h1 = await k();
  ok(`${tag}: out at the whole country: it stays at the fit`, Math.abs(h1 / h0 - 1) < 0.001, `${h0.toFixed(3)} → ${h1.toFixed(3)}`);
  await home(); await wait(900);
}

// a phone's pinch, lifted in motion, then held and lifted
const touches = (p, q) => [{ x: p[0], y: p[1], id: 1 }, { x: q[0], y: q[1], id: 2 }];
// (geometric, as a pinch reads: a linear spread slows on the log scale the zoom runs on)
const spread = async (from, to, n) => { for (let i = 0; i <= n; i++) { const a = from * Math.pow(to / from, i / n); await cdp.send("Input.dispatchTouchEvent", { type: i ? "touchMove" : "touchStart", touchPoints: touches([box.x - a, box.y], [box.x + a, box.y]) }); await wait(16); } };
await home(); await wait(900);
await spread(30, 240, 16); await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
let t0 = await k(); await wait(1000); let t1 = await k();
ok("a phone's pinch carries on past the lift", Math.log2(t1 / t0) > 0.3, `${Math.log2(t1 / t0).toFixed(2)} octaves`);
await home(); await wait(900);
await spread(30, 240, 16); await wait(300); await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
t0 = await k(); await wait(800); t1 = await k();
ok("held still, then lifted, it stays", Math.abs(Math.log2(t1 / t0)) < 0.03, `${Math.log2(t1 / t0).toFixed(3)} octaves`);

ok("no page errors", errs.length === 0, errs.slice(0, 3).join(" | "));
await browser.close();
console.log(fails.length ? `\n${fails.length} FAILED` : "\nall ok");
process.exit(fails.length ? 1 : 0);
