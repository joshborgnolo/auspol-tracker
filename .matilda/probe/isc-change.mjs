import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const PORT = 8978;
const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript",
               ".css": "text/css", ".json": "application/json", ".woff2": "font/woff2",
               ".png": "image/png", ".svg": "image/svg+xml", ".csv": "text/csv", ".xml": "text/xml" };
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p === "/") p = "/index.html";
    res.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" });
    res.end(await readFile(join(ROOT, p)));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(PORT, r));

const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new",
});

/* issues.list order (col, housing, health, immigration, crime, economy,
   climate, security); a solid tile names its party colour, {split:[a,b]} is
   the two-colour level tile, "grey" the no-clear-lead tile */
const SNAP_EXP = ["grey", "grey", "Labor", "One Nation", "grey", { split: ["Coalition", "Labor"] }, "Labor", "grey"];
const NOW_EXP  = ["grey", "grey", "Labor", "One Nation",
                  "One Nation", "Coalition", "Labor", "grey"];

let bad = 0;
for (const [VW, DARK] of [[1440, false], [1440, true], [900, false], [761, false], [390, false]]) {
  const page = await browser.newPage();
  await page.setViewport({ width: VW, height: 900 });
  if (DARK) await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "dark" }]);
  await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".rd-is-grid", { timeout: 20000 });
  await new Promise((r) => setTimeout(r, 400));

  const setup = await page.evaluate(() => {
    const tabs = [...document.querySelectorAll(".rd-isc-tabs button")];
    const tabText = tabs.map((t) => t.textContent.trim());
    const sel = tabs.findIndex((t) => t.getAttribute("aria-pressed") === "true");
    const party = {};
    for (const s of document.querySelectorAll(".rd-is-leg > span")) {
      const dot = s.querySelector("i");
      if (dot) party[s.textContent.trim()] = getComputedStyle(dot).backgroundColor;
    }
    const chg = tabs.find((t) => t.textContent.trim() === "Change");
    if (chg) chg.click();
    return { nTabs: tabs.length, tabText, sel, selText: sel >= 0 ? tabText[sel] : "", party };
  });
  await new Promise((r) => setTimeout(r, 900));

  const out = await page.evaluate(() => {
    const blocks = [...document.querySelectorAll(".rd-isc-m")];
    const lab = (b) => b.querySelector(".rd-isc-mlab b").textContent.trim();
    const tileInfo = (t) => {
      const cs = getComputedStyle(t);
      const r = t.getBoundingClientRect();
      const issue = t.querySelector(".rd-isc-issue");
      const v = t.querySelector(".rd-isc-v");
      const sub = t.querySelector(".rd-isc-sub");
      return {
        issue: issue ? issue.textContent.trim() : "",
        verdict: v ? v.textContent.trim() : "",
        sub: sub ? sub.textContent.trim() : "",
        bg: cs.backgroundColor,
        img: cs.backgroundImage,
        cls: t.className,
        aria: t.getAttribute("aria-label") || "",
        w: +r.width.toFixed(1),
        h: +r.height.toFixed(1),
        radius: parseFloat(cs.borderTopLeftRadius),
      };
    };
    const months = blocks.map((b) => ({
      label: lab(b),
      cols: getComputedStyle(b.querySelector(".rd-isc-grid")).gridTemplateColumns.split(" ").length,
      tiles: [...b.querySelectorAll(".rd-isc-tile")].map(tileInfo),
    }));
    const tabs = [...document.querySelectorAll(".rd-isc-tabs button")];
    const sel = tabs.findIndex((t) => t.getAttribute("aria-pressed") === "true");
    return {
      nBlocks: blocks.length,
      months,
      selText: sel >= 0 ? tabs[sel].textContent.trim() : "",
      scrollX: document.documentElement.scrollWidth,
      vw: window.innerWidth,
    };
  });

  const fail = [];
  const P = setup.party;
  if (setup.nTabs !== 2) fail.push("tabCount");
  if (setup.selText !== "Snapshot") fail.push("defaultTab");
  if (!(P.Labor && P.Coalition && P["One Nation"])) fail.push("partyColours");

  if (out.selText !== "Change") fail.push("chgSelect");
  if (out.nBlocks !== 2) fail.push("blockCount");
  const [apr, now] = out.months;
  if (!apr || apr.label !== "April 2026") fail.push("snapLabel");
  if (!now || !/^[A-Z][a-z]+ \d{4}$/.test(now.label) || now.label === "April 2026") fail.push("nowLabel");

  const expectCols = VW > 760 ? 4 : 2;
  const checkMonth = (mo, exp) => {
    if (!mo) return fail.push("missingMonth");
    if (mo.cols !== expectCols) fail.push("cols");
    if (mo.tiles.length !== 8) fail.push("tileCount:" + mo.label);
    mo.tiles.forEach((t, i) => {
      if (Math.abs(t.w - t.h) > 1.5) fail.push("notSquare:" + mo.label + ":" + i);
      if (t.radius < 8) fail.push("radius:" + i);
      if (/Not polled/.test(t.verdict)) fail.push("notPolled:" + mo.label);
      if (!/(cost|housing|health|immigration|crime|economic|climate|security)/.test(t.aria.toLowerCase())) fail.push("aria:" + i);
      const kind = exp[i];
      if (kind === "grey") {
        if (!t.cls.includes("none")) fail.push("greyCls:" + mo.label + ":" + i);
        if (t.verdict !== "No clear lead") fail.push("greyText:" + mo.label + ":" + i);
        if (Object.values(P).includes(t.bg)) fail.push("greyIsParty:" + mo.label + ":" + i);
        if (t.img !== "none") fail.push("greyGradient:" + mo.label + ":" + i);
      } else if (kind.split && Array.isArray(kind.split)) {
        if (t.img.indexOf("linear-gradient") !== 0) fail.push("splitGradient:" + mo.label + ":" + i);
        if (t.verdict !== "Level") fail.push("splitText:" + mo.label + ":" + i);
        for (const nm of kind.split) if (!t.img.includes(P[nm])) fail.push("splitColour:" + mo.label + ":" + i);
        const others = Object.keys(P).filter((nm) => !kind.split.includes(nm));
        for (const nm of others) if (t.img.includes(P[nm])) fail.push("splitThirdColour:" + mo.label + ":" + i);
        if (t.sub !== kind.split.join(" · ")) fail.push("splitSub:" + mo.label + ":" + i);
        if (t.cls.includes("none") || t.cls.includes("na")) fail.push("splitCls:" + mo.label + ":" + i);
      } else {
        if (t.img !== "none") fail.push("solidGradient:" + mo.label + ":" + i);
        if (t.bg !== P[kind]) fail.push("solidColour:" + mo.label + ":" + i);
        if (!t.verdict.startsWith(kind + " +")) fail.push("solidText:" + mo.label + ":" + i);
        const n = +t.verdict.slice(kind.length + 2);
        if (!(n >= 1 && n <= 30)) fail.push("solidGap:" + mo.label + ":" + i);
      }
    });
  };
  checkMonth(apr, SNAP_EXP);
  checkMonth(now, NOW_EXP);
  const greys = (apr ? apr.tiles : []).filter((t) => t.cls.includes("none")).map((t) => t.bg);
  if (new Set(greys).size > 1) fail.push("greyUniform");
  if (out.scrollX > out.vw + 1) fail.push("scrollX");

  /* back to Snapshot restores the trust grid */
  const back = await page.evaluate(() => {
    const tabs = [...document.querySelectorAll(".rd-isc-tabs button")];
    const snap = tabs.find((t) => t.textContent.trim() === "Snapshot");
    if (snap) snap.click();
    return !!snap;
  });
  await new Promise((r) => setTimeout(r, 900));
  const restore = await page.evaluate(() => ({
    grid: !!document.querySelector(".rd-is-grid"),
    sel: [...document.querySelectorAll(".rd-isc-tabs button")]
      .filter((t) => t.getAttribute("aria-pressed") === "true").map((t) => t.textContent.trim())[0] || "",
  }));
  if (!back) fail.push("snapTabMissing");
  if (!restore.grid) fail.push("gridRestore");
  if (restore.sel !== "Snapshot") fail.push("snapReselect");

  if (fail.length) bad++;
  console.log("VW", VW + (DARK ? " dark" : ""), fail.length ? "FAIL " + fail.join(",") : "ok",
    JSON.stringify({ labels: out.months.map((m) => m.label),
      aprKinds: apr ? apr.tiles.map((t) => t.issue + "=" + t.verdict) : [],
      nowKinds: now ? now.tiles.map((t) => t.issue + "=" + t.verdict) : [] }));
  await page.close();
}

await browser.close();
server.close();
process.exit(bad ? 1 : 0);
