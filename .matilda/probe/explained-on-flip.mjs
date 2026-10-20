/* explained-on-flip.mjs — the /flows-explained/ election chart's pairing
   flip (user 2026-10-20: a "Two-party: Labor v Coalition ⇄" beside its
   "Direction:" flip). Labor v Coalition is the flowHistory election-history
   chart with the jurisdiction chips; Labor v One Nation is a single view —
   "no extra views like state-by-state" — charting the counted contests where
   that choice was measured (flowForced.bys: Hunter 2025, South Australia
   2026, Secret Harbour by-election), as the /flows/ One Nation chart's
   crosses. Hunter joined bys with this change, so the /flows/ One Nation
   tab's key generalised to "Election and by-election counts" and the
   explainer's readings table gained the Hunter row. Same-day follow-up
   (user: "the points should be X's, like in the /flows/ labor v one nation
   chart"): every reading draws as a cross (TrendChart marks' m.cross
   branch), one per cohort per contest, and the end-cap dots are gone.
   Geometry pins price the eight crosses off the month-index domain and the
   0–100 share range; a tap flips pairing, direction, and back. */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const results = [];
const ok = (name, pass, detail) => {
  results.push([name, !!pass]);
  console.log((pass ? "  ✓ " : "  ✗ ") + name + (detail !== undefined ? "  — " + detail : ""));
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const near = (a, b, eps) => Math.abs(a - b) <= (eps === undefined ? 3 : eps);

const PORT = 9191;
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

const flips = (page) => page.$$eval("#flows-explained .ex-flow-flip .rd-pl-flip",
  (bs) => bs.map((b) => ({ t: b.textContent.replace(/\s+/g, " ").trim(), title: b.title, pressed: b.getAttribute("aria-pressed") })));
const clickFlip = (page, frag) => page.evaluate((f) => {
  const b = [...document.querySelectorAll("#flows-explained .ex-flow-flip .rd-pl-flip")]
    .find((x) => x.textContent.includes(f));
  if (!b) throw new Error("no flip button mentions " + f);
  b.click();
}, frag);
const unit = (page) => page.$eval("#flows-explained .fc-unit", (el) => el.textContent);
const chipsText = (page) => page.$$eval("#flows-explained .ex-flow-chips .ex-chip", (bs) => bs.map((b) => b.textContent.trim()));
const svgTexts = (page) => page.$$eval("#flows-explained .ex-chart svg text", (ts) => ts.map((t) => t.textContent.trim()));
/* the crosses: centre and span from each path's four diagonal points */
const crosses = (page) => page.$$eval("#flows-explained .ex-chart svg path.rd-cross",
  (ps) => ps.map((p) => {
    const n = (p.getAttribute("d").match(/-?[\d.]+/g) || []).map(Number);
    const xs = [n[0], n[2], n[4], n[6]], ys = [n[1], n[3], n[5], n[7]];
    return { cx: (Math.min(...xs) + Math.max(...xs)) / 2,
             cy: (Math.min(...ys) + Math.max(...ys)) / 2,
             spanX: Math.max(...xs) - Math.min(...xs),
             spanY: Math.max(...ys) - Math.min(...ys) };
  }).sort((a, b) => a.cx - b.cx || a.cy - b.cy));
const capCount = (page) => page.$$eval("#flows-explained .ex-chart svg circle.end-cap", (cs) => cs.length);
const legend = (page) => page.$$eval("#flows-explained .fc-legend .hl-item", (ls) => ls.map((l) => l.textContent.trim()));

/* TrendChart viewBox 0 0 1000 330, pad {l:46,r:104,t:16,b:40}, y 0–100 share */
const cyOf = (share, inv) => {
  const y = inv ? 100 - share : share;
  return 16 + (1 - y / 100) * 274;
};
/* xm of the three contests on the month-index scale, spanning ±0.9 months */
const byXm = (d) => {
  const [y, mo, dy] = d.split("-").map(Number);
  const dim = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  return Math.round((y * 12 + mo - 1 + (dy - 1) / dim) * 1e4) / 1e4;
};
const XH = byXm("2025-05-03"), XS = byXm("2026-03-21"), XW = byXm("2026-08-29");
const cxOf = (xm) => 46 + ((xm - (XH - 0.9)) / (XW - XH + 1.8)) * 850;
/* one cross per cohort per counted contest, share-descending per contest
   (no Others count ran at Secret Harbour) */
const READS = [ { xm: XH, v: [[87.39, "Hunter Greens"], [40.25, "Hunter Others"], [17.06, "Hunter Coalition"]] },
                { xm: XS, v: [[84.8, "SA Greens"], [55.9, "SA Others"], [33.9, "SA Coalition"]] },
                { xm: XW, v: [[90, "Harbour Greens"], [29.8, "Harbour Coalition"]] } ];
const expectedCrosses = (flip) => READS.flatMap((r) => r.v.map(([v, tag]) =>
  ({ cx: cxOf(r.xm), cy: cyOf(flip ? 100 - v : v, false), tag: tag + " " + v })))
  .sort((a, b) => a.cx - b.cx || a.cy - b.cy);

console.log("== desktop: the Coalition view is the landing ==");
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });
await page.goto(`http://127.0.0.1:${PORT}/flows-explained/`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("#flows-explained .ex-flow-flip .rd-pl-flip", { timeout: 20000 });
await sleep(700);

{
  const cs = await chipsText(page);
  ok("the jurisdiction chips render with the Coalition chart", cs.length > 1, cs.join(" / "));
  const f = await flips(page);
  ok("two flips sit beside one another: Two-party and Direction",
     f.length === 2 && f[0].t === "Labor v Coalition ⇄" && f[1].t === "Labor over Coalition ⇄",
     JSON.stringify(f));
  ok("each title announces the destination", f[0].title === "Switch the chart to Labor v One Nation"
     && f[1].title === "Switch to shares preferencing Coalition over Labor", JSON.stringify(f.map((x) => x.title)));
  ok("neither is pressed at rest", f[0].pressed === "false" && f[1].pressed === "false");
  ok("the unit line is the Coalition history's",
     (await unit(page)).startsWith("Share preferencing Labor over the Coalition in "), await unit(page));
}

console.log("== desktop: flip to Labor v One Nation — one view, no chips ==");
await clickFlip(page, "Labor v");
await sleep(500);
{
  const chips = await page.$("#flows-explained .ex-flow-chips");
  ok("the jurisdiction chips are gone in the One Nation view", chips === null);
  const f = await flips(page);
  ok("the Two-party button names the active pairing, pressed",
     f[0].t === "Labor v One Nation ⇄" && f[0].pressed === "true" && f[0].title === "Switch the chart to Labor v Coalition",
     JSON.stringify(f[0]));
  ok("the Direction button follows the pairing",
     f[1].t === "Labor over One Nation ⇄" && f[1].title === "Switch to shares preferencing One Nation over Labor",
     JSON.stringify(f[1]));
  ok("the unit line is per-contest", (await unit(page)) === "Share preferencing Labor over One Nation in each counted contest",
     await unit(page));
  const legendItems = await legend(page);
  ok("the legend is the three cohorts", JSON.stringify(legendItems) === JSON.stringify(["Coalition", "Greens", "Others"]),
     legendItems.join(" / "));
  const texts = await svgTexts(page);
  ok("the x axis ticks the three contests, on their own days",
     texts.includes("May 2025") && texts.includes("Mar 2026") && texts.includes("Aug 2026"),
     texts.filter((t) => /\d{4}/.test(t)).join(" / "));
  ok("no stray tick text rides the axis", texts.filter((t) => /\d{4}/.test(t)).length === 3,
     texts.filter((t) => /\d{4}/.test(t)).join(" / "));
  const xs = await crosses(page);
  ok("eight crosses = one per counted reading (3 Hunter + 3 SA + 2 Secret Harbour): the /flows/ ledger's mark",
     xs.length === 8, xs.map((c) => `${parseFloat(c.cx.toFixed(1))},${parseFloat(c.cy.toFixed(1))}`).join(" · "));
  ok("no dot marks the readings any more", (await capCount(page)) === 0, (await capCount(page)) + " end-caps");
  ok("each cross is a square X (spanX = spanY)", xs.every((c) => near(c.spanX, c.spanY, 0.05)),
     JSON.stringify(xs.slice(0, 2).map((c) => [+c.spanX.toFixed(2), +c.spanY.toFixed(2)])));
  const want = expectedCrosses(false);
  ok("the crosses sit at the eight counted readings",
     want.every((w, i) => near(xs[i].cx, w.cx) && near(xs[i].cy, w.cy)),
     want.map((w, i) => `${w.tag}: got ${parseFloat(xs[i].cx.toFixed(1))},${parseFloat(xs[i].cy.toFixed(1))} want ${parseFloat(w.cx.toFixed(1))},${parseFloat(w.cy.toFixed(1))}`).join(" · "));
  const cap = await page.$eval("#flows-explained .ex-flow-cap", (el) => el.textContent);
  ok("the caption lists one reading per contest, Hunter first",
     cap.startsWith("One reading per contest: Hunter 2025 — the AEC’s count of the full distribution of preferences; ")
       && cap.includes("South Australia 2026 — Bonham’s estimates") && cap.includes("Secret Harbour by-election — Green’s count")
       && cap.endsWith("."),
     cap.slice(0, 120) + "…");
}
console.log("== desktop: the Direction flip inverts the same view ==");
await clickFlip(page, "over");
await sleep(500);
{
  const f = await flips(page);
  ok("the Direction button now names One Nation over Labor, pressed",
     f[1].t === "One Nation over Labor ⇄" && f[1].pressed === "true"
       && f[1].title === "Switch to shares preferencing Labor over One Nation", JSON.stringify(f[1]));
  ok("the unit line inverts", (await unit(page)) === "Share preferencing One Nation over Labor in each counted contest",
     await unit(page));
  const xsv = await crosses(page);
  const wantInv = expectedCrosses(true);
  ok("every cross inverts to 100 − its reading",
     xsv.length === 8 && wantInv.every((w, i) => near(xsv[i].cx, w.cx) && near(xsv[i].cy, w.cy)),
     wantInv.map((w, i) => `${w.tag}: got ${xsv[i] ? parseFloat(xsv[i].cy.toFixed(1)) : "—"} want ${parseFloat(w.cy.toFixed(1))}`).join(" · "));

  await clickFlip(page, "over");
  await sleep(500);
  ok("a second Direction press restores Labor over One Nation",
     (await unit(page)) === "Share preferencing Labor over One Nation in each counted contest");
}

console.log("== desktop: flip back to Labor v Coalition ==");
await clickFlip(page, "Labor v");
await sleep(500);
{
  const cs = await chipsText(page);
  ok("the chips return with the Coalition chart", cs.length > 1, cs.join(" / "));
  ok("the unit line is the Coalition history's again",
     (await unit(page)).startsWith("Share preferencing Labor over the Coalition in "), await unit(page));
}

console.log("== the static readings table carries Hunter ==");
{
  const tbl = await page.evaluate(() => {
    const t = [...document.querySelectorAll("#flows-explained .ex-body table.ex-table caption")]
      .find((c) => c.textContent.startsWith("The readings"));
    if (!t) return null;
    const table = t.closest("table");
    return { cap: t.textContent.replace(/\s+/g, " ").trim(),
             head: [...table.querySelectorAll("thead th")].map((s) => s.textContent.trim()),
             rows: [...table.querySelectorAll("tbody tr")].map((r) => [...r.children].map((c) => c.textContent.trim())) };
  });
  ok("the readings table renders in the explainer article", !!tbl);
  ok("its caption owns Hunter's AEC-count provenance",
     tbl && /The readings: share of each group’s preferences/.test(tbl.cap) && tbl.cap.includes("Hunter is the AEC’s count")
       && tbl.cap.includes("no Liberal stood there"), tbl && tbl.cap.slice(0, 140));
  ok("the columns are Coalition→Labor / Greens→Labor / Others→Labor",
     tbl && JSON.stringify(tbl.head) === JSON.stringify(["Contest", "Coalition → Labor", "Greens → Labor", "Others → Labor"]),
     tbl && JSON.stringify(tbl.head));
  ok("Hunter leads the body with the counted figures",
     tbl && JSON.stringify(tbl.rows[0]) === JSON.stringify(["Hunter, May 2025 (AEC count)", "17.1", "87.4", "40.3"]),
     tbl && JSON.stringify(tbl.rows[0]));
}
await page.close();

console.log("== /flows/: the One Nation tab's key reads across 2025 and 2026 ==");
const pw = await browser.newPage();
await pw.setViewport({ width: 1280, height: 900 });
await pw.goto(`http://127.0.0.1:${PORT}/flows/`, { waitUntil: "domcontentloaded" });
await pw.waitForSelector("#flow-drift .rd-fl-tabs .rd-tab", { timeout: 20000 });
await sleep(700);
await pw.evaluate(() => {
  const b = [...document.querySelectorAll("#flow-drift .rd-fl-tabs .rd-tab")]
    .find((x) => x.textContent.trim() === "Labor v One Nation");
  if (!b) throw new Error("no Labor v One Nation tab");
  b.click();
});
await sleep(600);
{
  const key = await pw.$eval("#flow-drift .rd-fx-key", (el) => el.textContent.replace(/\s+/g, " ").trim());
  ok("the key names the election-and-by-election counts", key.includes("Election and by-election counts"), key);
  const crosses = await pw.$$eval("#flow-drift .rd-fx-x", (xs) => xs.length);
  ok("the ledger draws eight crosses (Hunter 3 + SA 3 + Secret Harbour 2)", crosses === 8, crosses + " crosses");
}
await pw.close();

console.log("== phone 390px: the flips pair beside one another, nothing overflows ==");
const mob = await browser.newPage();
await mob.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
await mob.goto(`http://127.0.0.1:${PORT}/flows-explained/`, { waitUntil: "domcontentloaded" });
await mob.waitForSelector("#flows-explained .ex-flow-flip .rd-pl-flip", { timeout: 20000 });
await sleep(700);
await clickFlip(mob, "Labor v");
await sleep(500);
{
  ok("phone flips to the counted contests", (await unit(mob)) === "Share preferencing Labor over One Nation in each counted contest",
     await unit(mob));
  const chips = await mob.$("#flows-explained .ex-flow-chips");
  ok("phone drops the chips too", chips === null);
  const texts = await svgTexts(mob);
  ok("phone ticks the three contests", ["May 2025", "Mar 2026", "Aug 2026"].every((t) => texts.includes(t)),
     texts.filter((t) => /\d{4}/.test(t)).join(" / "));
  const overflow = await mob.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  ok("no horizontal overflow with the controller row wrapped", overflow <= 0, overflow + " px");
}
await mob.close();

await browser.close();
server.close();
const bad = results.filter(([, p]) => !p);
console.log(bad.length ? `✗ ${bad.length} check(s) failed` : `✓ all ${results.length} checks passed`);
process.exit(bad.length ? 1 : 0);
