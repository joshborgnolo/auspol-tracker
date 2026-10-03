/* Probe gate: frame-margin parity – the satellite pages' frame must resolve
   to the SAME margins as the main page's at every width. The main page's
   frame is body.rd .page over rd.css's --rd-gutter = clamp(20px, 5vw, 64px)
   on a 1152px column with a 28px top pad (20px at <=560px); the shell mirrors
   it as --sh-gutter/--sh-maxw in .sh-frame / .sh-top (site-shell.mjs). Each
   width gets FRESH page loads: reusing one tab across setViewport shrinks
   trips scroll-anchoring artefacts in the 16kpx main page. Asserts resolved
   frame paddings (string-equal), lockup left edge and header top (<=0.6px
   subpixel tolerance – the main page's hero can land a hair off). */
import puppeteer from "puppeteer-core";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
const ROOT = decodeURIComponent(new URL("../../", import.meta.url).pathname);
const types = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json",
                ".css": "text/css", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0].split("#")[0]);
  if (p.endsWith("/")) p += "index.html";
  fs.readFile(path.join(ROOT, p), (e, b) => {
    if (e) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "content-type": types[path.extname(p)] || "application/octet-stream" });
    res.end(b);
  });
});
await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new", args: ["--no-sandbox"] });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const widths = [1440, 1280, 1200, 1100, 1024, 900, 800, 760, 700, 640, 600, 560, 520, 480, 430, 390, 360, 320];

const measure = (frameSel, lockupSel, headSel) => {
  const body = `const frame = document.querySelector(${JSON.stringify(frameSel)});
  const lockup = document.querySelector(${JSON.stringify(lockupSel)});
  const head = document.querySelector(${JSON.stringify(headSel)});
  const cs = getComputedStyle(frame);
  return { padL: cs.paddingLeft, padR: cs.paddingRight, padT: cs.paddingTop,
           lockX: lockup.getBoundingClientRect().left,
           headTop: head.getBoundingClientRect().top };`;
  return new Function(`("use strict"); ${body}`);
};
const mainFn = measure(".page", ".lockup", ".site-head");
const satFn = measure(".sh-frame", ".sh-lockup", ".sh-head");

const load = async (url, w) => {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: 900 });
  await page.goto(base + url, { waitUntil: "load" });
  await wait(url === "/" ? 1600 : 700);
  return page;
};

let fails = 0;
for (const w of widths) {
  const main = await load("/", w);
  const m = await main.evaluate(mainFn);
  await main.close();
  const sat = await load("/feedback/", w);
  const s = await sat.evaluate(satFn);
  await sat.close();
  const pads = m.padL === s.padL && m.padR === s.padR && m.padT === s.padT;
  const x = Math.abs(m.lockX - s.lockX) <= 0.05;
  const top = Math.abs(m.headTop - s.headTop) <= 0.6;
  const good = pads && x && top;
  if (!good) fails++;
  console.log(`${good ? " ok " : "FAIL"} w=${w}  main(padL ${m.padL}, padT ${m.padT}, lockX ${m.lockX.toFixed(2)}, headTop ${m.headTop.toFixed(2)})  ` +
              `sat(padL ${s.padL}, padT ${s.padT}, lockX ${s.lockX.toFixed(2)}, headTop ${s.headTop.toFixed(2)})`);
}

await browser.close(); server.close();
console.log(fails ? `FAILED (${fails})` : "ALL CHECKS PASSED");
process.exit(fails ? 1 : 0);
