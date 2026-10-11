/* wv-pooled-parts.mjs – Newspoll's pooled quarterly tables in the vote by
   group (ruling 2026-10-11: a "(pooled)" release counts as the polls it
   pooled – gen-data pooledParts). Checks, on the built index.html:
     1. Who votes for whom credits "Newspoll" (no "(pooled)") and its rug
        draws ONE dot per pooled release, labelled with the release's window.
     2. The Primary vote group view (Retired) draws the release's dots at each
        part – tooltips carry the part's own fieldwork and "one of N polls in
        the <window> tables" – and none at the release's end alone.
     3. The Who-votes work-status chart does the same.
     4. The Info entry lists the roster table (Groups | Pollsters) with
        Newspoll on the work-status row.
     5. ?design=old renders the page without a page error.
   Run: node .matilda/probe/wv-pooled-parts.mjs */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const PORT = 8961;
const MIME = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".css": "text/css", ".woff2": "font/woff2" };
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p.endsWith("/")) p += "index.html";
    res.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" });
    res.end(await readFile(join(ROOT, p)));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(PORT, r));

const fails = [];
const check = (label, cond, got) => {
  console.log((cond ? "PASS " : "FAIL ") + label + (cond ? "" : " — got: " + JSON.stringify(got)));
  if (!cond) fails.push(label);
};
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new",
});
const settle = (ms = 400) => new Promise((r) => setTimeout(r, ms));

/* hover every scatter dot in an svg and read its tooltip */
const tipsOf = async (page, svgSel) => {
  const pts = await page.evaluate((sel) => {
    const svg = document.querySelector(sel);
    svg.scrollIntoView({ block: "center" });
    return [...svg.querySelectorAll("circle.scatter-dot")].filter((c) => c.getAttribute("fill") !== "var(--chart-bg)" && c.getAttribute("opacity") !== "0")
      .map((c) => { const r = c.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  }, svgSel);
  const out = [];
  for (const p of pts) {
    await page.mouse.move(p.x, p.y);
    await settle(30);
    const t = await page.evaluate(() => {
      const tip = [...document.querySelectorAll(".tip")].find((e) => e.offsetParent && e.querySelector(".tip-title"));
      return tip ? tip.textContent.replace(/\s+/g, " ").trim() : null;
    });
    if (t) out.push({ x: p.x, t });
  }
  return out;
};

const page = await browser.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push(String(e)));
await page.setViewport({ width: 1280, height: 900 });
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("#who-votes .rd-wv-rug", { timeout: 20000 });

/* 1. credit + rug */
const wv = await page.evaluate(() => {
  const sec = document.querySelector("#who-votes");
  const meta = (sec.querySelector(".rd-meta") || {}).textContent || "";
  const np = [...sec.querySelectorAll(".rd-wv-rug b[aria-label]")].map((b) => b.getAttribute("aria-label")).filter((l) => /^Newspoll/.test(l));
  return { meta, np };
});
check("credit names Newspoll", /Newspoll/.test(wv.meta) && !/\(pooled\)/.test(wv.meta), wv.meta);
check("rug carries Newspoll (pooled) dots", wv.np.length > 0, wv.np.length);
check("rug dots cite the release window", wv.np.every((l) => /^Newspoll \(pooled\), 13 Jul–18 Sep/.test(l)), wv.np.slice(0, 3));

/* 2. primary vote group view, Retired */
await page.waitForSelector("#primary-vote select.rd-pv-sel", { timeout: 20000 });
await page.select("#primary-vote select.rd-pv-sel", await page.evaluate(() =>
  [...document.querySelectorAll("#primary-vote select.rd-pv-sel option")].find((o) => o.textContent.trim() === "Retired").value));
await settle(700);
const pv = (await tipsOf(page, "#primary-vote .rd-pv-chart svg")).filter((d) => /^Newspoll \(pooled\)/.test(d.t));
const pvFields = [...new Set(pv.map((d) => (d.t.match(/Field\s*(.+?)\s*n ≈/) || [])[1]))];
console.log("  primary/Retired Newspoll dots:", pv.length, "fields:", pvFields.join(" | "));
check("primary view: Newspoll dots at its polls (≥12 distinct fieldworks)", pvFields.length >= 12, pvFields);
check("primary view: tooltips name the release", pv.every((d) => /one of [34] polls in the .+ tables/.test(d.t)), pv.slice(0, 2));

/* 3. who votes, Home tab, work status chart */
await page.evaluate(() => {
  const sec = document.querySelector("#who-votes");
  const b = [...sec.querySelectorAll("button, [role=tab]")].find((x) => x.textContent.trim() === "Home");
  b && b.click();
});
await settle(900);
const wsSvg = await page.evaluate(() => {
  const sec = document.querySelector("#who-votes");
  const svgs = [...sec.querySelectorAll("svg")].filter((s) => s.querySelector("circle.scatter-dot"));
  const i = svgs.findIndex((s) => /work status/i.test((s.closest("[class*=card], section, div") || {}).textContent || ""));
  svgs.forEach((s, k) => s.setAttribute("data-probe", String(k)));
  return i >= 0 ? i : svgs.length - 1;
});
const ws = (await tipsOf(page, `#who-votes svg[data-probe="${wsSvg}"]`)).filter((d) => /^Newspoll \(pooled\)/.test(d.t));
const wsFields = [...new Set(ws.map((d) => (d.t.match(/Field\s*(.+?)\s*(n ≈|one of)/) || [])[1]))];
console.log("  who-votes work-status Newspoll dots:", ws.length, "fields:", wsFields.join(" | "));
check("work status chart: Newspoll dots at its polls", wsFields.length >= 12, wsFields);

/* 4. Info roster */
await page.evaluate(() => window.AP.openTerm("vote-by-group", "probe"));
await settle(900);
const roster = await page.evaluate(() => {
  const t = [...document.querySelectorAll("table.info-work")].find((x) => /Pollsters/.test(x.querySelector("thead").textContent));
  return t ? [...t.querySelectorAll("tbody tr")].map((tr) => [...tr.children].map((c) => c.textContent.trim())) : null;
});
check("Info roster table present", !!roster && roster.length >= 9, roster);
const workRow = roster && roster.find((r) => /^Work status/.test(r[0]));
check("roster: work status counts Newspoll", !!workRow && /Newspoll/.test(workRow[1]) && !/pooled/.test(workRow[1]), workRow);
check("new design: no page errors", errs.length === 0, errs);

/* 5. the old design */
const old = await browser.newPage();
const errsOld = [];
old.on("pageerror", (e) => errsOld.push(String(e)));
await old.setViewport({ width: 1280, height: 900 });
await old.goto(`http://127.0.0.1:${PORT}/index.html?design=old`, { waitUntil: "domcontentloaded" });
await settle(4000);
await old.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await settle(1500);
check("old design: no page errors", errsOld.length === 0, errsOld);

await browser.close();
server.close();
console.log(fails.length ? `\n${fails.length} FAIL` : "\nall pass");
process.exit(fails.length ? 1 : 0);
