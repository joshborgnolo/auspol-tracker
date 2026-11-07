// Probe: the 2001 frame's census People lanes on the LOCAL map build.
// usage: node .matilda/probe/map-2001-people.mjs   (self-contained: serves the repo root)
import http from "http";
import { createReadStream, existsSync, statSync } from "fs";
import { extname, join, normalize } from "path";
import { fileURLToPath } from "url";
import puppeteer from "puppeteer-core";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const MIME = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p.endsWith("/")) p += "index.html";
  const f = normalize(join(ROOT, p));
  if (!f.startsWith(ROOT) || !existsSync(f) || !statSync(f).isFile()) { res.writeHead(404); res.end("404"); return; }
  res.writeHead(200, { "Content-Type": MIME[extname(f)] || "application/octet-stream", "Connection": "keep-alive" });
  createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--no-sandbox"], protocolTimeout: 90000 });
const page = await browser.newPage();
await page.setCacheEnabled(false);
await page.setViewport({ width: 1200, height: 900 });
const fails = [];
const ok = (name, cond, detail = "") => { console.log(`${cond ? "ok" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`); if (!cond) fails.push(name); };

// 1. the legend's People optgroup on 2001 carries the SIX lanes, no income
await page.goto(`${base}/map/#y=2001&l=seifa&i=uni`, { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForFunction("window.__map", { timeout: 20000 });
const st1 = await page.evaluate(async () => {
  const m = window.__map;
  await m.Y[2001].ready;
  m.setLens("seifa");
  return new Promise((r) => setTimeout(() => {
    const sel = document.querySelector('select[data-opt="index"]');
    const ogs = sel ? [...sel.querySelectorAll("optgroup")].map((g) => [g.label, [...g.querySelectorAll("option")].map((o) => o.textContent)]) : null;
    const note = (document.querySelector(".lg-note") || {}).textContent || "";
    r({ ogs, note, basis: m.Y[2001].demoBasis, interp: m.Y[2001].demoInterp === null ? "null" : "set" });
  }, 600));
});
const people = st1.ogs && st1.ogs.find((g) => g[0] === "People");
ok("2001 People optgroup exists", !!people, JSON.stringify(st1.ogs && st1.ogs.map((g) => g[0])));
if (people) {
  ok("2001 People has 6 lanes (no income on the floor year)", people[1].length === 6, people[1].join(" | "));
  ok("no income lanes offered", !people[1].some((t) => /income/i.test(t)), people[1].join(" | "));
}
ok("2001 model basis is venue", st1.basis === "venue", st1.basis);
ok("2001 legend note names the 2001 census", /2001 census/.test(st1.note), st1.note.slice(0, 160));
ok("no floor-year copy leaks", !/Census people figures start|Counted from/.test(st1.note), st1.note.slice(0, 160));
ok("legend marks the Australia line", /Australia: /.test(st1.note), st1.note.slice(-90));

// 2. a seat card on a People lane shows the census figures + the basis line
const st2 = await page.evaluate(async () => {
  const m = window.__map;
  m.setYear(2001);
  await m.Y[2001].ready;
  const i = m.Y[2001].divs.findIndex((d) => d.n === "Canberra");
  m.goDiv(i, { quiet: true, fly: false });
  await new Promise((r) => setTimeout(r, 900));
  const txt = (document.querySelector(".dl-card") || document.body).textContent || "";
  return { txt: txt.slice(0, 900), found: /2001 census/.test(txt) };
});
ok("division card cites the 2001 census basis", st2.found, st2.txt.replace(/\s+/g, " ").slice(0, 140));

// 3. the birthplace-country picker on 2001: 9-menu + all-overseas, uk-led
await page.goto("about:blank");
await page.goto(`${base}/map/#y=2001&l=seifa&i=fborn`, { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForFunction("window.__map", { timeout: 20000 });
const st3 = await page.evaluate(async () => {
  const m = window.__map;
  await m.Y[2001].ready;
  await new Promise((r) => setTimeout(r, 600));
  const sel = document.querySelector('select[data-opt="cob"]');
  return { obs: sel ? [...sel.querySelectorAll("option")].map((o) => o.textContent) : null };
});
ok("2001 birthplace picker exists", st3.obs !== null, JSON.stringify(st3.obs));
if (st3.obs) {
  ok("2001 menu is All-overseas + the nine (uk first)", st3.obs.length === 10 && st3.obs[1] === "Born in the United Kingdom", st3.obs && st3.obs.join(" | ").slice(0, 90));
  ok("Australia-born not offered as a country", !st3.obs.some((t) => /Australia/.test(t)));
}

// 4. uk on 2001 (picked the user's way): note names the country + the
// 2001 census, and the Australia line is the uk pool
const st4 = await page.evaluate(async () => {
  const sel = document.querySelector('select[data-opt="cob"]');
  sel.value = "uk";
  sel.dispatchEvent(new Event("change", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 800));
  const note = (document.querySelector(".lg-note") || {}).textContent || "";
  const m = window.__map;
  const aus = m.Y[2001].areas && m.Y[2001].areas.AUS && m.Y[2001].areas.AUS.demo && m.Y[2001].areas.AUS.demo.cob;
  return { note, uk: aus && aus.uk };
});
ok("2001 uk note: country + its own census edition", /born in the United Kingdom/.test(st4.note) && /2001 census/.test(st4.note), st4.note.slice(0, 150));
ok("2001 AUS uk share ≈ 5.85% (app pool)", st4.uk && Math.abs(st4.uk - 5.85) < 0.15, st4.uk);

// 5. the 2004 frame: same edition's menu + edition ladder reads 2001 census
await page.goto("about:blank");
await page.goto(`${base}/map/#y=2004&l=seifa&i=fborn&cb=uk`, { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForFunction("window.__map", { timeout: 20000 });
const st5 = await page.evaluate(async () => {
  const m = window.__map;
  await m.Y[2004].ready;
  await new Promise((r) => setTimeout(r, 900));
  const sel = document.querySelector('select[data-opt="cob"]');
  const note = (document.querySelector(".lg-note") || {}).textContent || "";
  return { obs: sel ? sel.length : 0, note };
});
ok("2004 menu carries the nine", st5.obs === 10, st5.obs);
ok("2004 uk note reads the 2001 census (cob is measured-side)", /born in the United Kingdom/.test(st5.note) && /2001 census/.test(st5.note) && !/2006 census/.test(st5.note), st5.note.slice(0, 150));

// 6. areas pooled by the app itself
const st6 = await page.evaluate(() => {
  const m = window.__map;
  const a = m.Y[2001].areas && m.Y[2001].areas.AUS && m.Y[2001].areas.AUS.demo;
  return a ? { lang: a.lang, a65: a.a65, uni: a.uni, blue: a.blue, fborn: a.fborn, a2034: a.a2034 } : null;
});
ok("AUS area pooled from the divisions", !!st6 && st6.uni > 0, JSON.stringify(st6));

await browser.close();
server.close();
console.log(fails.length ? `\n${fails.length} FAILURES` : "\nall green");
process.exit(fails.length ? 1 : 0);
