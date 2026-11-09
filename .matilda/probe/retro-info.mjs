// Probe: the retro Info page (/info/retro/: .build/retro/info.mjs, info.client.js, info.css) in a
// browser — the four views and their tabs, a term link opening the entry's own view and lighting it,
// a section's lead bringing its caption up, Back to top, a pasted #v=…&t=… link opening on its entry,
// the retro family's navbars opening it, and no sideways scroll at 1440/1024/768/375 with every
// working fold open.
// usage: node .matilda/probe/retro-info.mjs <baseUrl>  (serve the repo root first)
import puppeteer from "puppeteer-core";
const base = process.argv[2];
if (!base) { console.error("need base url, e.g. http://127.0.0.1:8123"); process.exit(2); }
const b = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new" });
const p = await b.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
const fails = [];
const check = (name, cond, detail) => { console.log(`${cond ? "ok  " : "FAIL"} ${name}${detail !== undefined ? " — " + JSON.stringify(detail) : ""}`); if (!cond) fails.push(name); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await p.setViewport({ width: 1440, height: 900 });
await p.goto(base + "/info/retro/", { waitUntil: "load" }); await sleep(400);
check("opens on About", await p.evaluate(() => document.documentElement.dataset.rpView === "about" && !!document.querySelector("#ri-about").offsetParent));
check("the navbar's Info is this page", await p.evaluate(() => document.querySelector('.rt-pages a[aria-current="page"]').getAttribute("href") === "/info/retro/"));
await p.click('.rt-tabs [data-rp-tab="faq"]'); await sleep(300);
check("Questions tab shows the questions", await p.evaluate(() => location.hash === "#v=faq" && document.querySelectorAll("#ri-faq .ri-term").length > 3));
const x = await p.evaluate(() => { const a = document.querySelector('#ri-faq a[data-term]:not(.ri-toc a)') || document.querySelector('#ri-faq .ri-term a[data-term]'); a.click(); return a.dataset.term; });
await sleep(1500);
const r1 = await p.evaluate((id) => { const e = document.getElementById("term-" + id); return { view: document.documentElement.dataset.rpView, lit: e.classList.contains("ri-lit"), shown: !!e.offsetParent, top: Math.round(e.getBoundingClientRect().top) }; }, x);
check(`a term link (${x}) opens its view and lights the entry on screen`, r1.lit && r1.shown && r1.top >= -5 && r1.top < 900, r1);
await p.evaluate(() => document.querySelector('.ri-lit [data-ri="top"]').click()); await sleep(1200);
check("Back to top returns to the tab row", await p.evaluate(() => Math.abs(document.querySelector(".rt-tabs").getBoundingClientRect().top) < 4));
await p.click('.rt-tabs [data-rp-tab="panels"]'); await sleep(300);
await p.evaluate(() => document.querySelectorAll(".ri-secs a")[3].click()); await sleep(1500);
check("a section link brings that section's caption to the top", await p.evaluate(() => { const s = document.querySelector(".ri-lit").closest(".ri-sec"); return !!s && Math.abs(s.getBoundingClientRect().top) < 12; }));
await p.goto(base + "/info/retro/#v=method&t=interval", { waitUntil: "load" }); await sleep(600);
check("a pasted link opens on its entry", await p.evaluate(() => document.documentElement.dataset.rpView === "method" && document.getElementById("term-interval").classList.contains("ri-lit")));
for (const pg of ["/retro/", "/cycles/retro/", "/allpolls/retro/"]) {
  await p.goto(base + pg, { waitUntil: "load" }); await sleep(250);
  check(`${pg}'s navbar opens it`, await p.evaluate(() => [...document.querySelectorAll(".rt-pages a")].some((a) => a.getAttribute("href") === "/info/retro/")));
}
for (const w of [1440, 1024, 768, 375]) {
  await p.setViewport({ width: w, height: 900 });
  for (const v of ["about", "faq", "method", "panels"]) {
    await p.goto(`${base}/info/retro/#v=${v}`, { waitUntil: "load" }); await sleep(250);
    await p.evaluate(() => document.querySelectorAll(".ri-work").forEach((d) => (d.open = true))); await sleep(60);
    const sx = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    if (sx > 0) check(`${v} at ${w}px: no sideways scroll`, false, sx);
  }
}
check("no sideways scroll at any width, every view, folds open", !fails.some((f) => /sideways/.test(f)));
check("no page errors", errs.length === 0, errs);
await b.close();
console.log(fails.length ? `${fails.length} FAILED` : "all passed");
process.exit(fails.length ? 1 : 0);
