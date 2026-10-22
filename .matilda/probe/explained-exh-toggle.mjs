/* explained-exh-toggle.mjs — the "Exhaustion-adjusted flows" RdSwitch under
   the /flows-explained/ chart (user request 2026-10-22): it renders only
   where the view holds optional-numbering years (Qld state to 2015, NSW
   state throughout - gen-data's S.opv list), is on by default, and rescales
   an OPV year's share to the party's whole vote (a 68.5% flow with 44.3%
   exhausted draws at 0.557*68.5 = 38.2); off, the raw shares of the ballots
   that reached Labor or the Coalition return. The Share flip inverts after
   the rescale (the other side's own adjusted share, not 100 minus Labor's),
   the err bars scale with it, and the RdFoot caption swaps its basis
   sentence with the switch. This probe pins all of it headlessly against
   the built page. Expected values are read from the page's own
   AUSPOL.flowHistory (so data refreshes never drift it), and the y map is
   calibrated from the chart's own y-axis tick labels (the svg viewBox
   height is derived, so a hardcoded frame would drift instead). */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire("/Users/joshuaborgnolo/auspol tracker/node_modules/");
const puppeteer = require("puppeteer-core");

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const results = [];
const ok = (name, pass, detail) => {
  results.push([name, !!pass]);
  console.log((pass ? "  ✓ " : "  ✗ ") + name + (detail !== undefined ? "  — " + detail : ""));
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PORT = 9294;
const MIME = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json",
               ".css": "text/css", ".woff2": "font/woff2", ".svg": "image/svg+xml", ".xml": "application/xml" };
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p === "/") p = "/index.html";
    if (p.endsWith("/")) p += "index.html";
    res.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" });
    res.end(await readFile(join(ROOT, p)));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(PORT, r));
const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new" });

const pageErrors = [];
const wire = (p) => p.on("pageerror", (e) => pageErrors.push(String(e).slice(0, 160)));
const pickMenu = (p, v) => p.select(".ex-fl-card select.ex-fl-sel", v);
const hasSwitch = (p) => p.$(".ex-fl-card .ex-fl-adj[role=switch]").then((x) => !!x);
const switchState = (p) => p.$eval(".ex-fl-card .ex-fl-adj[role=switch]", (b) => b.getAttribute("aria-checked"));
const clickSwitch = (p) => p.$eval(".ex-fl-card .ex-fl-adj[role=switch]", (b) => b.click());
const footText = (p) => p.$eval(".ex-fl-card .rd-foot-text", (el) => el.textContent.replace(/\s+/g, " ").trim());
/* cy(v) from the chart's own y-axis tick labels: the numeric texts 0-100 in
   the chart's svg, mapped to their svg y. hover-marker circles sit at cy 0
   and are excluded from the dot read */
const chartMap = (p) => p.evaluate(() => {
  const rows = [...document.querySelectorAll(".ex-fl-card .chart svg text")]
    .map((t) => {
      const y = t.y && t.y.baseVal && t.y.baseVal.length ? t.y.baseVal[0].value : parseFloat(t.getAttribute("y"));
      return { v: parseFloat(t.textContent.replace(/[^\d.]/g, "")), y };
    })
    .filter((o) => Number.isFinite(o.v) && Number.isFinite(o.y) && o.v >= 0 && o.v <= 100);
  const byV = new Map(rows.map((r) => [r.v, r.y]));
  const vs = [...byV.keys()].sort((a, b) => a - b);
  if (vs.length < 2) return null;
  const v0 = vs[0], v1 = vs[vs.length - 1];
  const s = (byV.get(v1) - byV.get(v0)) / (v1 - v0);
  const a = byV.get(v0) - v0 * s;
  return [a, s];
});
const dotCys = (p) => p.$$eval(".ex-fl-card .chart svg circle:not(.hover-marker)", (cs) => cs.map((c) => c.cy.baseVal.value));
const near = (cys, want, tol = 1.6) => cys.some((c) => Math.abs(c - want) < tol);
const anyNear = async (p, v, tol) => {
  const [a, s] = (await chartMap(p)) || [];
  if (a == null) throw new Error("chart y-axis calibration failed");
  return near(await dotCys(p), a + v * s, tol);
};
/* the year's series cell, read from the page's own data: the drawn share,
   its exhausted share, and the switch's adjusted figure */
const cellFor = (p, jur, bucket, year) => p.evaluate(({ jur, bucket, year }) => {
  const S = window.AUSPOL.flowHistory[jur];
  const i = S.years.indexOf(year);
  const v = S[bucket][i], x = S[bucket + "Exh"] ? S[bucket + "Exh"][i] : null;
  return { v, x, adj: x == null ? v : v * (1 - x / 100) };
}, { jur, bucket, year });

console.log("== desktop 1280: federal landing carries no switch ==");
{
  const p = await browser.newPage(); wire(p);
  await p.setViewport({ width: 1280, height: 900 });
  await p.goto(`http://127.0.0.1:${PORT}/flows-explained/`, { waitUntil: "networkidle0", timeout: 60000 });
  await p.waitForSelector(".ex-fl-card .chart svg", { timeout: 30000 });
  ok("federal view: no exhaustion switch", !(await hasSwitch(p)));
  ok("switch row nowhere on the card", !(await p.$(".ex-fl-card .ex-fl-adj")));

  await pickMenu(p, "vic"); await sleep(400);
  ok("Victoria (compulsory numbering): no switch", !(await hasSwitch(p)));

  await pickMenu(p, "qld"); await sleep(400);
  ok("Qld view: switch row renders", await hasSwitch(p));
  ok("switch row says 'Exhaustion-adjusted flows'",
    (await p.$eval(".ex-fl-card .ex-fl-adj", (el) => el.textContent)).includes("Exhaustion-adjusted flows"));
  ok("switch on by default", (await switchState(p)) === "true");
  const q04 = await cellFor(p, "qld", "grn", 2004);
  ok("Qld 2004 Greens adjusted (" + q04.adj.toFixed(1) + " = " + q04.v + " × (1 − " + q04.x / 100 + "))",
    await anyNear(p, q04.adj));
  ok("no dot left at the unadjusted " + q04.v, !(await anyNear(p, q04.v, 0.9)));
  const footOn = await footText(p);
  ok("caption tells the adjusted basis", footOn.includes("shares count each party’s whole vote")
    && footOn.includes("switch under the chart"));

  await clickSwitch(p); await sleep(350);
  ok("switch now off", (await switchState(p)) === "false");
  ok("Qld 2004 Greens back at " + q04.v, await anyNear(p, q04.v));
  ok("dot no longer at the adjusted spot", !(await anyNear(p, q04.adj, 0.9)));
  const footOff = await footText(p);
  ok("caption tells the unadjusted basis", footOff.includes("shares are of the ballots that reached Labor or the Coalition")
    && !footOff.includes("switch under the chart"));

  await clickSwitch(p); await sleep(350);
  await p.$eval(".ex-fl-card .ex-share .rd-pl-flip", (b) => b.click()); await sleep(400);
  const invWant = (100 - q04.v) * (1 - q04.x / 100);
  ok("inverted Share: the Coalition side's own adjusted share (" + invWant.toFixed(1) + ")", await anyNear(p, invWant));
  await p.$eval(".ex-fl-card .ex-share .rd-pl-flip", (b) => b.click()); await sleep(400);

  await pickMenu(p, "nsw"); await sleep(400);
  ok("NSW view: switch row renders, on by default", await hasSwitch(p) && (await switchState(p)) === "true");
  const n19 = await cellFor(p, "nsw", "grn", 2019);
  ok("NSW 2019 Greens adjusted (" + n19.adj.toFixed(1) + " = " + n19.v + " × (1 − " + n19.x / 100 + "))",
    await anyNear(p, n19.adj));
  const n23on = await cellFor(p, "nsw", "onp", 2023);
  ok("NSW 2023 One Nation adjusted (" + n23on.adj.toFixed(1) + ")", await anyNear(p, n23on.adj, 2.0));
  const nFoot = await footText(p);
  ok("NSW caption counts the whole vote", nFoot.includes("share counts the party’s whole vote"));
  await p.close();
}

console.log("== readouts: one short note per row (user 2026-10-23) ==");
{
  const p = await browser.newPage(); wire(p);
  await p.setViewport({ width: 1280, height: 900 });
  await p.goto(`http://127.0.0.1:${PORT}/flows-explained/`, { waitUntil: "networkidle0", timeout: 60000 });
  await p.waitForSelector(".ex-fl-card .chart svg", { timeout: 30000 });
  /* hover the n-th election column and read the readout */
  const tipAt = async (n) => {
    await p.$eval(".ex-fl-card", (el) => el.scrollIntoView({ block: "start" })); await sleep(150);
    const xs = await p.$$eval(".ex-fl-card .chart svg circle:not(.hover-marker)", (cs) =>
      [...new Set(cs.map((c) => Math.round(c.getBoundingClientRect().left + c.getBoundingClientRect().width / 2)))].sort((a, b) => a - b));
    const cols = xs.filter((x, i) => i === 0 || x - xs[i - 1] > 4);
    const y = await p.$eval(".ex-fl-card .chart svg", (s) => { const r = s.getBoundingClientRect(); return r.top + r.height / 2; });
    await p.mouse.move(cols[n] + 1, y); await sleep(350);
    const t = await p.$eval(".ex-fl-card .tip", (e) => ({ title: e.querySelector(".tip-title").textContent,
      notes: [...e.querySelectorAll(".tip-note")].map((x) => x.textContent) })).catch(() => null);
    await p.mouse.move(2, 2); await sleep(150);
    return t;
  };
  await pickMenu(p, "qld"); await sleep(400);
  const q = await tipAt(0);
  const q04 = await cellFor(p, "qld", "grn", 2004);
  ok("Qld 2004 Greens note: scaled ±, exhausted, the unadjusted share as 'of the rest'",
    q && /^±\d+\.\d, about \d+% exhausted, \d+\.\d% of the rest$/.test(q.notes[0]) && q.notes[0].includes(q04.v.toFixed(1) + "% of the rest"), q && q.notes[0]);
  ok("Qld readout: no per-row basis words (every year rings; the key says it)", q && !q.notes.some((n) => /seats only/.test(n)) && !/seats only/.test(q.title));
  await pickMenu(p, "nsw"); await sleep(400);
  const n = await tipAt(0);
  ok("NSW 2015 note: exhausted, of the rest, classic figure alone", n && /^\d+% exhausted, \d+\.\d% of the rest, classic seats \d+\.\d%$/.test(n.notes[0]), n && n.notes[0]);
  await pickMenu(p, "fed"); await sleep(400);
  const f = await tipAt(1);
  ok("federal 1998: the basis rides the title, once", f && /1998.*Labor-v-Coalition seats only/.test(f.title) && !f.notes.some((x) => /seats only/.test(x)), f && f.title);
  await p.close();
}

console.log("== NSW upper house (Legislative Council): no switch ==");
{
  const p = await browser.newPage(); wire(p);
  await p.setViewport({ width: 1280, height: 900 });
  await p.goto(`http://127.0.0.1:${PORT}/flows-explained/`, { waitUntil: "networkidle0", timeout: 60000 });
  await p.waitForSelector(".ex-fl-card .chart svg", { timeout: 30000 });
  await p.$eval(".ex-fl-card .ex-house .rd-pl-flip", (b) => b.click()); await sleep(400);
  await pickMenu(p, "nswlc"); await sleep(400);
  ok("LC view ('named neither', never exhausted): no switch", !(await hasSwitch(p)));
  await p.close();
}

console.log("== phone 390px: switch fits, values follow the narrow frame ==");
{
  const p = await browser.newPage(); wire(p);
  await p.setViewport({ width: 390, height: 844 });
  await p.goto(`http://127.0.0.1:${PORT}/flows-explained/`, { waitUntil: "networkidle0", timeout: 60000 });
  await p.waitForSelector(".ex-fl-card .chart svg", { timeout: 30000 });
  await pickMenu(p, "qld"); await sleep(400);
  ok("phone: switch renders, on by default", await hasSwitch(p) && (await switchState(p)) === "true");
  const q04 = await cellFor(p, "qld", "grn", 2004);
  ok("phone: Qld 2004 Greens adjusted", await anyNear(p, q04.adj));
  const geom = await p.evaluate(() => {
    const row = document.querySelector(".ex-fl-adj").getBoundingClientRect();
    return { fitted: row.left >= -1 && row.right <= window.innerWidth + 1,
             docOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  });
  ok("phone: switch row inside the viewport", geom.fitted);
  ok("phone: no document overflow", geom.docOverflow <= 1, "overflow " + geom.docOverflow);
  await p.close();
}

await browser.close();
server.close();
const failed = results.filter(([, pass]) => !pass);
console.log(failed.length + " FAILURES" + (pageErrors.length ? "; page errors: " + pageErrors.join(" | ") : ""));
console.log((results.length - failed.length) + "/" + results.length + " checks passed");
process.exit(failed.length || pageErrors.length ? 1 : 0);
