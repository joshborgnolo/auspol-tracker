// Probe: /map/'s atlas sea (app-2-map.js, "the ocean" and "the waters' names").
// usage: node .matilda/probe/map-ocean.mjs <baseUrl>   (serve the repo root first)
//  1. the open sea is the ocean's pale blue, light and dark, and the graticule is drawn on it
//  2. the waters are named at the country's view: oceans, seas, the Bight, the Gulf
//  3. at street zoom Esri's sea is the same ocean, not its grey (Marine area is the mask only)
//  4. a state's frame lays the rest of the country as land: NSW beside Victoria is paper, not sea
//  5. a change of frame never shows the sea where land lies
import puppeteer from "puppeteer-core";

const base = process.argv[2];
if (!base) { console.error("need base url, e.g. http://127.0.0.1:8123"); process.exit(2); }
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--no-sandbox"], protocolTimeout: 90000 });
const fails = [];
const ok = (name, cond, detail = "") => { console.log(`${cond ? "ok" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`); if (!cond) fails.push(name); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function open(hash, dark) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 1000, deviceScaleFactor: 1 });
  if (dark) await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "dark" }]);
  page.on("pageerror", (e) => ok("no page error", false, e.message));
  await page.goto(`${base}/map/${hash}`, { waitUntil: "networkidle0", timeout: 60000 });
  await page.waitForFunction("window.__map && window.__map.T", { timeout: 30000 });
  await wait(1800);
  return page;
}
// the mean colour of the canvas over a box (fractions of the stage), and how many lines cross it
const sample = (page, ll, k, box = 6) => page.evaluate(async (ll, k, box) => {
  if (ll) { window.__map.view(ll, k); await new Promise((r) => setTimeout(r, 3500)); }
  window.__map.drawNow();
  const cv = document.querySelector("#cv"), g = cv.getContext("2d"), W = cv.width, H = cv.height;
  const d = g.getImageData((W >> 1) - box, (H >> 1) - box, 2 * box, 2 * box).data;
  const s = [0, 0, 0, 0]; for (let i = 0; i < d.length; i += 4) for (let c = 0; c < 4; c++) s[c] += d[i + c];
  return s.map((v) => Math.round(v / (d.length / 4)));
}, ll, k, box);
const blueish = (c) => c[3] > 250 && c[2] - c[0] > 20;

// 1, 2: the country's view, light then dark
for (const dark of [false, true]) {
  const page = await open("", dark), tag = dark ? "dark" : "light";
  const sea = await sample(page, [128, -38.5], 2.2);
  ok(`${tag}: the open sea (south of the Bight) is the ocean's blue`, blueish(sea), `rgba ${sea}`);
  // a meridian: 130E crosses the Bight's sea; the line is a deeper blue than the paper beside it
  const lineC = await page.evaluate(() => {
    const m = window.__map.M(), T = window.__map.T, dpr = window.devicePixelRatio || 1, g = document.querySelector("#cv").getContext("2d");
    const at = (ll) => { const p = m.proj(ll); return [Math.round((p[0] * T.k + T.x) * dpr), Math.round((p[1] * T.k + T.y) * dpr)]; };
    const [x, y] = at([130, -36.5]); let lo = 999, hi = 0;
    for (let dx = -4; dx <= 4; dx++) { const c = g.getImageData(x + dx, y, 1, 1).data, L = c[0] + c[1] + c[2]; lo = Math.min(lo, L); hi = Math.max(hi, L); }
    return [lo, hi];
  });
  ok(`${tag}: the 130E meridian is drawn across the sea`, lineC[1] - lineC[0] > (dark ? 25 : 30), `brightness ${lineC}`);
  await page.evaluate(() => { window.__map.goAus && window.__map.goAus(); });
  await wait(1500);
  const names = await page.evaluate(() => { window.__map.drawNow(); return window.__map.seaDrawn; });
  for (const n of ["Southern Ocean", "Coral Sea", "Great Australian\nBight", "Gulf of\nCarpentaria", "Timor Sea"]) ok(`${tag}: named at the country's view: ${n.replace("\n", " ")}`, names.includes(n), names.join(", ").replace(/\n/g, " "));
  await page.close();
}

// 3: street zoom off Sydney's heads - Esri's sea is the ocean, not its grey
{
  const page = await open("", false);
  const open0 = await sample(page, [128, -38.5], 2.2, 30);
  const street = await sample(page, [151.36, -33.86], 260, 30);
  ok("street zoom: Esri's sea off the heads is the ocean's blue", blueish(street), `rgba ${street}`);
  ok("street zoom: and the same blue as the open sea at the country's view (within the paper's grain)", Math.max(...[0, 1, 2].map((c) => Math.abs(street[c] - open0[c]))) <= 6, `${street} v ${open0}`);
  await page.close();
}

// 4: Victoria's frame - New South Wales beside it is land
{
  const page = await open("#y=vic22", false);
  await wait(1500);
  const nsw = await sample(page, [146.5, -34.5], 2.4);
  ok("Victoria's frame: New South Wales is plain land, not sea", nsw[3] > 250 && !blueish(nsw) && nsw[0] > 235, `rgba ${nsw}`);
  const bass = await sample(page, [145.5, -39.9], 2.4);
  ok("Victoria's frame: Bass Strait is sea", blueish(bass), `rgba ${bass}`);
  await page.close();
}

// 5: the federal map to Victoria's frame, mid-change, on a frozen clock: NSW never reads as sea
{
  const page = await open("#y=2025", false);
  await page.evaluate(() => {
    window.__t = performance.now(); performance.now = () => window.__t;
    const q = []; window.requestAnimationFrame = (f) => { q.push(f); return q.length + 1e6; }; window.cancelAnimationFrame = () => {};
    window.__step = (dt) => { window.__t += dt; q.splice(0).forEach((f) => f(window.__t)); };
    window.__map.setYear("vic22");
  });
  for (let i = 0; i < 100 && !(await page.evaluate(() => !!window.__map.ymorph)); i++) { await page.evaluate(() => window.__step(16)); await wait(50); }
  const dur = await page.evaluate(() => window.__map.ymorph && window.__map.ymorph.dur);
  // (the old map's seats fade over the land as it goes, so the test is the sea's own colour,
  // read off open water in the same frame, not merely a blue)
  let worst = null;
  for (const f of [0.35, 0.55, 0.75, 0.95]) {
    await page.evaluate((d) => window.__step(d), dur * 0.2);
    const [c, sea] = await page.evaluate(() => {
      const m = window.__map.M(), T = window.__map.T, g = document.querySelector("#cv").getContext("2d");
      const px = (ll) => { const p = m.proj(ll); return [...g.getImageData(Math.round(p[0] * T.k + T.x), Math.round(p[1] * T.k + T.y), 1, 1).data]; };
      return [px([147.5, -33.5]), px([152.5, -39.5])];
    });
    if (Math.max(...[0, 1, 2].map((i) => Math.abs(c[i] - sea[i]))) <= 12) worst = [f, c, sea];
  }
  ok("a change of frame never shows the sea over New South Wales", !worst, worst ? `at ${worst[0]}: rgba ${worst[1]} (the sea ${worst[2]})` : "");
  await page.close();
}

await browser.close();
console.log(fails.length ? `\n${fails.length} failed` : "\nall ok");
process.exit(fails.length ? 1 : 0);
