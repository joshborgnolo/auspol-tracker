// saves the page's own mini-chamber canvas (#minich) as a PNG for the mockup
import puppeteer from "puppeteer-core";
import fs from "node:fs";
const b = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new" });
const p = await b.newPage();
await p.setViewport({ width: 1536, height: 1024, deviceScaleFactor: 2 });
await p.goto("http://localhost:8755/map/index.html", { waitUntil: "networkidle0" });
await p.waitForFunction(() => { const c = document.getElementById("minich"); return c && c.width > 0; }, { timeout: 20000 });
await new Promise((r) => setTimeout(r, 1500));
const u = await p.evaluate(() => document.getElementById("minich").toDataURL("image/png"));
fs.writeFileSync(".build/map-mockup/chamber.png", Buffer.from(u.split(",")[1], "base64"));
await b.close();
