import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const MIME = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".css": "text/css", ".woff2": "font/woff2", ".svg": "image/svg+xml" };
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p === "/") p = "/index.html";
    if (p.endsWith("/")) p += "index.html";
    res.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" });
    res.end(await readFile(join(ROOT, p)));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new",
});
const errors = [];
try {
  const page = await browser.newPage();
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#who-votes .rd-wv-dots .rd-wv-d", { timeout: 20000 });
  await new Promise((r) => setTimeout(r, 600));

  const readRows = () => page.evaluate(() => {
    const D = window.AP.D.demographics;
    const partyIds = ["onp", "alp", "lnp", "grn", "oth"];
    const chips = [...document.querySelectorAll("#who-votes .rd-chips .rd-chip")];
    const party = partyIds[chips.findIndex((b) => b.getAttribute("aria-pressed") === "true")];
    const tabLabel = document.querySelector("#who-votes .rd-wv-tabs .rd-tab[aria-pressed='true']").textContent.trim();
    const tab = D.tabs.find((t) => t.label === tabLabel);
    const all = D.all[party];
    return {
      party,
      legend: document.querySelector("#who-votes .rd-wv-keytxt").textContent.trim(),
      rows: tab.sets.flatMap((st, si) => st.groups.map((g, gi) => ({
        label: g.label,
        expected: (g.v[party] / all).toFixed(1) + "×",
        actual: document.querySelectorAll("#who-votes .rd-wv-set")[si].querySelectorAll(".rd-wv-row .rd-wv-d .sr-only")[gi].textContent.trim(),
      }))),
    };
  });

  let checked = 0;
  for (let i = 0; i < 5; i++) {
    if (i) {
      await page.evaluate((n) => document.querySelectorAll("#who-votes .rd-chips .rd-chip")[n].click(), i);
      await new Promise((r) => setTimeout(r, 450));
    }
    const state = await readRows();
    assert.ok(state.party, "the selected party chip resolves to a party");
    assert.ok(state.rows.length > 0, `${state.party}: comparison rows render`);
    assert.equal(state.legend, "Right-hand column: ratio to all voters");
    for (const row of state.rows) {
      assert.match(row.actual, /^\d+\.\d×$/, `${state.party} / ${row.label}: one-decimal ratio`);
      assert.equal(row.actual, row.expected, `${state.party} / ${row.label}: group share divided by all-voters share`);
      checked++;
    }
    console.log(`✓ ${state.party}: ${state.rows.length} ratios match the pooled figures`);
  }
  assert.deepEqual(errors, [], "no page errors");
  console.log(`✓ ${checked} rendered ratios checked across all five parties`);
} finally {
  await browser.close();
  server.close();
}
