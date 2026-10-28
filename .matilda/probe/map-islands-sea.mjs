// Probe: /map/'s islands at street zoom and the stage across the polling-places zoom.
// usage: node .matilda/probe/map-islands-sea.mjs <baseUrl>   (serve the repo root first)
//  1. Curtis Island (Bass) - drawn by the AEC, under Esri's sea whole - keeps its seat's colour
//     from the streets' first zoom in (it vanished there before 2026-10-28)
//  2. the Hogan Group's rocks Esri draws and the AEC doesn't take Bass's colour: no plain
//     paper-white land left round them (they read white before)
//  3. the stage holds still as the zoom crosses to the polling places (the key grew 23px at 1400)
import puppeteer from "puppeteer-core";

const base = process.argv[2];
if (!base) { console.error("need base url, e.g. http://127.0.0.1:8123"); process.exit(2); }
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--no-sandbox"], protocolTimeout: 90000 });
const fails = [];
const ok = (name, cond, detail = "") => { console.log(`${cond ? "ok" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`); if (!cond) fails.push(name); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const page = await browser.newPage();
await page.setViewport({ width: 1400, height: 1000, deviceScaleFactor: 1 });
page.on("pageerror", (e) => ok("no page error", false, e.message));
await page.goto(`${base}/map/`, { waitUntil: "networkidle0", timeout: 60000 });
await page.waitForFunction("window.__map && window.__map.T", { timeout: 30000 });
await wait(1500);
// the canvas's pixel at the stage's middle (where __map.view puts the point), and its plain-white count
const look = (ll, k) => page.evaluate(async (ll, k) => {
  window.__map.view(ll, k);
  await new Promise((r) => setTimeout(r, 3500));
  window.__map.drawNow();
  const cv = document.querySelector("#cv"), g = cv.getContext("2d"), W = cv.width, H = cv.height;
  const mid = [...g.getImageData(W >> 1, H >> 1, 1, 1).data];
  const d = g.getImageData(0, 0, W, H).data;
  let white = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 32 && d[i] >= 240 && d[i + 1] >= 240 && d[i + 2] >= 240) white++; // Esri's plain land lifted white, no seat under it (the sea is ~215 grey)
  return { mid, white };
}, ll, k);
const reddish = (c) => c[3] > 200 && c[0] - c[2] > 20;
for (const k of [60, 120, 400]) {
  const r = await look([146.6476, -39.4722], k);
  ok(`Curtis Island keeps Bass's colour at k=${k}`, reddish(r.mid), `rgba ${r.mid}`);
}
for (const k of [120, 300]) {
  const r = await look([146.99, -39.215], k);
  ok(`no plain white land round the Hogan Group at k=${k}`, r.white < 40, `${r.white} white px`);
}
// 3. the stage across the polling places' zoom, Melbourne
const st = await page.evaluate(async () => {
  const o = [];
  for (const k of [18, 30, 18]) { window.__map.view([144.96, -37.81], k); await new Promise((r) => setTimeout(r, 500)); const r = document.querySelector("#stage").getBoundingClientRect(); o.push([r.top, r.height]); }
  return o;
});
ok("the stage holds still crossing to the polling places", st.every((r) => Math.abs(r[0] - st[0][0]) < 0.5 && Math.abs(r[1] - st[0][1]) < 0.5), JSON.stringify(st));
await browser.close();
console.log(fails.length ? `FAIL ${fails.length}` : "PASS map-islands-sea");
process.exit(fails.length ? 1 : 0);
