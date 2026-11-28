import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const puppeteer = createRequire(process.cwd() + "/package.json")("puppeteer-core");
const ROOT = fileURLToPath(new URL("../..", import.meta.url));
let server = null;
const PAGE = process.env.PAGE || await (async () => {
  const { createServer } = await import("node:http");
  const fs = await import("node:fs");
  const { resolve, extname, sep } = await import("node:path");
  server = createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    if (p.endsWith("/")) p += "index.html";
    const file = resolve(ROOT, "." + p);
    if (!file.startsWith(resolve(ROOT) + sep)) { res.writeHead(403); res.end(); return; }
    res.setHeader("Content-Type", { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml", ".woff2": "font/woff2" }[extname(file)] || "application/octet-stream");
    fs.createReadStream(file).on("error", () => { res.writeHead(404); res.end(); }).pipe(res);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${server.address().port}/dawn/mood/`;
})();
const browser = await puppeteer.launch({ executablePath: process.env.CHROME || "/opt/homebrew/bin/chromium", headless: "new" });
const settle = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
try {
  for (const width of [1366, 390]) {
    for (const views of [
      { suffix: "mood/", ids: ["direction", "trust", "life"], cohesion: true },
      { suffix: "", ids: ["votes", "tpp"], cohesion: false },
    ]) {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.setViewport({ width, height: 900 });
    await page.goto(PAGE.replace(/mood\/$/, views.suffix), { waitUntil: "networkidle0", timeout: 60000 });
    for (const id of views.ids) {
      const initial = await page.$eval(`#${id}-svg`, (svg) => ({ events: svg.querySelectorAll(".evr").length, shading: svg.querySelectorAll('rect[fill-opacity=".075"]').length }));
      assert.ok(initial.events > 0, `${id}: the default current-term events still draw at ${width}`);
      for (const range of ["10"]) {
        const count = await page.$$eval(`#${id} button[data-w]`, (els) => els.length);
        const enabled = await page.$$eval(`#${id} button[data-w="${range}"]`, (els) => els.filter((el) => !el.disabled).length);
        assert.ok(count > 0 && enabled, `${id}: ${range} range enabled at ${width}`);
        await page.$$eval(`#${id} button[data-w="${range}"]`, (els) => els[0].click());
        await settle(250);
        const result = await page.$eval(`#${id}-svg`, (svg) => ({
          events: [...svg.querySelectorAll(".evr")].map((line) => ({ top: +line.getAttribute("y1"), bottom: +line.getAttribute("y2") })),
          labels: [...svg.querySelectorAll(".el")].map((el) => el.textContent),
          shading: [...svg.querySelectorAll('rect[fill-opacity=".075"]')].map((el) => ({ top: +el.getAttribute("y"), height: +el.getAttribute("height") })),
          height: svg.getBoundingClientRect().height,
        }));
        assert.ok(result.events.length > 0, `${id}: the ${range} range now has event rules at ${width}`);
        assert.ok(result.events.every((r) => Number.isFinite(r.top) && r.bottom > r.top && r.bottom <= +result.height), `${id}: ${range} event rules are inside the plot, not outside its frame`);
        assert.ok(result.shading.length > 0 && result.shading.every((r) => r.height > 0), `${id}: ${range} keeps the government shading at ${width}`);
        if (width > 1000 && range === "10") assert.ok(result.labels.some((label) => / election$/.test(label)), `${id}: 10-year election names are not hidden by government labels`);
      }
    }
    if (views.cohesion) for (const chosen of ["sec", "index"]) {
      await page.select("#cohesion-view", chosen);
      await settle(250);
      const cohesion = await page.evaluate(() => ({
        markers: document.querySelectorAll("#cohesion-svg .evr").length,
        lines: [...document.querySelectorAll("#cohesion-svg .series")].map((el) => el.getTotalLength()),
        dots: document.querySelectorAll("#cohesion-svg .series-dot").length,
        dek: document.querySelector("#cohesion-dek")?.textContent || "",
        href: document.querySelector("#cohesion-source")?.href || "",
        domains: document.querySelectorAll("#cohesion-domain option").length,
        overflow: document.documentElement.scrollWidth > window.innerWidth,
      }));
      assert.ok(cohesion.markers > 0, `cohesion ${chosen}: election/event lines draw on the full-history view at ${width}`);
      assert.ok(cohesion.lines.length >= 1 && cohesion.lines.every((n) => n > 0), `cohesion ${chosen}: model lines draw at ${width}`);
      assert.ok(cohesion.dots > 0, `cohesion ${chosen}: published data dots draw at ${width}`);
      if (chosen === "sec") {
        assert.ok(cohesion.dek.includes("rated cohesion good or better"), "the SEC headline is live");
        assert.ok(cohesion.href.includes("secnewgate.com.au"), "the SEC report is linked");
      } else {
        assert.ok(cohesion.dek.includes("2007 = 100"), "Scanlon's index basis is live");
        assert.ok(cohesion.href.includes("scanloninstitute.org.au"), "Scanlon's index report is linked");
        assert.equal(cohesion.domains, 6, "Overall plus all five Scanlon domains are selectable");
      }
      assert.equal(cohesion.overflow, false, `cohesion ${chosen}: no horizontal overflow at ${width}`);
    }
    assert.deepEqual(errors, [], `no JavaScript errors at ${width}: ${errors.join(" | ")}`);
    await page.close();
    }
  }
} finally {
  await browser.close();
  if (server) await new Promise((resolve) => server.close(resolve));
}
console.log("PASS: Direction, Trust, Life satisfaction, Cohesion, first preferences and two-party votes show the intended event rules at desktop and phone widths");
