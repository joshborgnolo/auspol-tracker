// Probe: /map/'s drawings (app-2b-draw.js) in the browser.
// usage: node .matilda/probe/map-draw.mjs <baseUrl>   (serve the repo root first; python's http.server
//        resets connections under the page's parallel fetches, so use something sturdier)
//  - the buttons work by click, and a change of drawing moves no stage, at four widths
//  - balloons: the net of the ink is the same at every level, shared balloons have tips and part on a click
//  - the surface reads the spot, and at seat zoom its field comes back to the booths
//  - every frame draws; the contests appear only where they stand; a built contest stays on the map
//  - the estimated frames add up to each seat's real count
import puppeteer from "puppeteer-core";

const base = process.argv[2];
if (!base) { console.error("need base url, e.g. http://127.0.0.1:8123"); process.exit(2); }
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--no-sandbox"] });
const fails = []; const ok = (n, c, d = "") => { console.log(`${c ? "ok  " : "FAIL"} ${n}${d ? " — " + d : ""}`); if (!c) fails.push(n); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const errs = [];
const open = async (hash, w = 1280, h = 860) => {
  const page = await browser.newPage();
  page.on("pageerror", (e) => errs.push(e.message));
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  await page.goto(`${base}/map/#${hash}`, { waitUntil: "networkidle2", timeout: 60000 });
  for (let i = 0; i < 80; i++) { if (await page.evaluate("!!(window.__map && window.__map.M())")) break; await wait(200); }
  await wait(3000);
  return page;
};
const stage = (page) => page.evaluate(() => { const r = document.querySelector("#stage").getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top + scrollY), Math.round(r.width), Math.round(r.height)].join(); });
const clickDraw = (page, d) => page.evaluate((d) => document.querySelector(`[data-draw="${d}"]`).click(), d);

for (const w of [1440, 1280, 1000, 390]) for (const lens of ["tpp", "winner", "fp"]) {
  const page = await open(`y=2025&l=${lens}`, w);
  const s0 = await stage(page);
  await clickDraw(page, "surface"); await wait(700); const s1 = await stage(page);
  await clickDraw(page, "balloons"); await wait(700); const s2 = await stage(page);
  await clickDraw(page, "seats"); await wait(700); const s3 = await stage(page);
  ok(`${w}px ${lens}: a change of drawing moves no stage`, s0 === s1 && s1 === s2 && s2 === s3, [s0, s1, s2, s3].join(" | "));
  await page.close();
}

let page = await open("y=2025&l=tpp&draw=balloons");
ok("the URL opens balloons", await page.evaluate(() => __map.S.draw === "balloons" && !!__map.M()._balNow));
const ink = await page.evaluate(() => {
  const m = __map.M(), B = __map.balloonSet(m); let atoms = 0; for (let a = 0; a < B.n; a++) atoms += B.V[a] >= 50 ? B.C[a] : -B.C[a];
  const nets = [4, 2, 0, -2, -4, -6].map((L) => { let net = 0; for (const g of __map.balloonLevel(m, B, L)) net += g.val >= 50 ? g.size : -g.size; return Math.round(net); });
  return { atoms: Math.round(atoms), nets };
});
ok("the net of the ink is the same at every level", ink.nets.every((v) => Math.abs(v - ink.atoms) <= 2), JSON.stringify(ink));
const tipOn = () => page.evaluate(() => { const t = document.querySelector("#tip"); return t.hidden ? "" : t.innerText; });
await page.evaluate(() => document.querySelector("#stage").scrollIntoView({ block: "center", behavior: "instant" })); await wait(300);
const p0 = await page.evaluate(() => { const m = __map.M(), g = m._balNow[0], r = document.querySelector("#cv").getBoundingClientRect(); return { x: r.left + g.x * __map.T.k + __map.T.x, y: r.top + g.y * __map.T.k + __map.T.y, n: g.n }; });
await page.mouse.move(p0.x + 3, p0.y + 3); await wait(250);
ok("a shared balloon has a tip", /polling places/.test(await tipOn()), (await tipOn()).replace(/\n/g, " · ").slice(0, 120));
const k0 = await page.evaluate(() => __map.T.k);
await page.mouse.click(p0.x + 3, p0.y + 3); await wait(1300);
ok("a click parts it", (await page.evaluate(() => __map.T.k)) > k0 * 1.4);
await page.close();

page = await open("y=2025&l=tpp&draw=surface");
for (const n of ["Grayndler", "Melbourne"]) {
  await page.evaluate((n) => { const m = __map.M(); __map.goDiv(m.byName.get(n), { dur: 0 }); }, n); await wait(2200);
  const r = await page.evaluate((n) => {
    const m = __map.M(), b = m.booth; let wv = 0, w = 0, fv = 0;
    for (const j of b.byDiv[m.byName.get(n)]) { const v = b.tpp[j]; if (Number.isNaN(v) || Number.isNaN(b.x[j]) || !b.formal[j]) continue; const f = __map.surfaceAt(b.x[j], b.y[j]); if (!f) continue; wv += v * b.formal[j]; w += b.formal[j]; fv += f.v * b.formal[j]; }
    return [wv / w, fv / w];
  }, n);
  ok(`${n}: at seat zoom the field comes back to its booths`, Math.abs(r[0] - r[1]) < 5, r.map((v) => v.toFixed(1)).join(" v "));
}
await page.evaluate(() => __map.goAus({ dur: 0 })); await wait(1200);
for (const y of [1993, 2004, 2013, 2022, "now", "sa26", "qld24", "qld17", "vic22", "nsw23", "wa25"]) {
  await page.evaluate((y) => __map.setYear(y), y); await wait(1400);
  const s = await page.evaluate(() => ({ base: !!__map.SF.base, empty: __map.SF.empty, loading: document.querySelector("#loading").textContent }));
  ok(`surface draws ${y}`, s.base && !s.empty && !s.loading, JSON.stringify(s));
}
await page.evaluate(() => __map.setYear(2025)); await wait(1500);
ok("Labor v the Coalition offers its contests at 2025", await page.evaluate(() => !!document.querySelector('[data-opt="axis"]')));
await page.evaluate(() => __map.setAxis("AO")); await wait(1800);
const ao = await page.evaluate(() => { const m = __map.M(); return { v: __map.axisArea(m, m.areas.AUS.idx), hed: document.querySelector(".st-hed").innerText, hash: location.hash }; });
ok("Labor v One Nation sits on the site's table", ao.v > 62 && ao.v < 63 && /would lead/.test(ao.hed) && /ax=AO/.test(ao.hash), JSON.stringify(ao));
await page.evaluate(() => __map.setYear(2019)); await wait(1500);
ok("no contests where One Nation stood thinly", await page.evaluate(() => !document.querySelector('[data-opt="axis"]')));
await page.evaluate(() => __map.setYear(2025)); await wait(1500);
await page.evaluate(() => __map.setView("chamber")); await wait(1400);
ok("the chamber keeps the counted figures", await page.evaluate(() => { const m = __map.M(), d = m.divs.find((x) => x.tpp != null); return !document.querySelector(".lg-draw") && __map.S.axis === "AO" && !document.querySelector('[data-opt="axis"]'); }));
await page.close();

page = await open("y=nsw23&l=tpp&draw=balloons");
const est = await page.evaluate(() => {
  const m = __map.M(), E = __map.estBooths(m), b = m.booth; let worst = 0, n = 0;
  for (const d of m.divs) { let A = 0, F = 0; for (const j of b.byDiv[d.i]) { if (!b.formal[j] || Number.isNaN(E.a[j])) continue; A += E.a[j] * b.formal[j]; F += b.formal[j]; } if (!F) continue; n++; worst = Math.max(worst, Math.abs(A / F - d.va / (d.va + d.vb))); }
  return { n, worst: 100 * worst };
});
ok("an estimated frame's places add up to each seat's count", est.n === 93 && est.worst < 0.05, JSON.stringify(est));
await page.close();

ok("no page errors", errs.length === 0, errs.slice(0, 4).join(" | "));
await browser.close();
console.log(fails.length ? `\n${fails.length} FAILED` : "\nall ok");
process.exit(fails.length ? 1 : 0);
