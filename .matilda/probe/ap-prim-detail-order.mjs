/* All-polls PRIMARY order is ONE rule site-wide: the site-aggregate walk
   (gen-data latest.primaryOrder), never the wave's own largest-first order
   (user call 2026-10-03: the expanded card ranking differently from its
   row was the unprincipled bit; shipped with hlViews/plParties/table
   columns in ac625e2/9b5e9b9/02cf021 and the detail/seats/dots here).
   Asserts on desktop:
     1. an expanded card's .rd-apd-prim ladder follows walk order, per
        party present in the wave - including on a DISAGREEING wave (one
        whose own figures would rank parties differently);
     2. the row's five figure slots (.rd-ap-pnums) in walk order, dashes
        where the wave lacks a party;
     3. the row's primary picture aria and its dot DOM order in walk
        order (paint order: the walk now decides who sits on top);
     4. the modelled-seats sentence orders parties by the walk too.
   Truth for every row's figures comes from the same 9f09dca2 data asset
   the page reads (new Function fixture, hl-tabs-scroll pattern) - the
   probe pins the WIRING, never the day's data.
   Run from the repo root: node .matilda/probe/ap-prim-detail-order.mjs
   Rebuild first (node .build/newtracker/build.mjs) — probes the BUILT
   index.html artifact in the working tree. */
import { createServer } from "node:http";
import { readFile, readdir } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const PORT = 8948;
const MIME = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json",
               ".css": "text/css", ".woff2": "font/woff2", ".png": "image/png", ".svg": "image/svg+xml" };
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p === "/") p = "/index.html";
    res.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" });
    res.end(await readFile(join(ROOT, p)));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(PORT, r));

const dataFile = (await readdir(join(ROOT, ".build/newtracker/assets")))
  .find((f) => f.startsWith("9f09dca2") && f.endsWith(".js"));
const world = {};
new Function("window", await readFile(join(ROOT, ".build/newtracker/assets", dataFile), "utf8"))(world);
const D = world.AUSPOL;
if (!D) { console.error("probe setup: no AUSPOL payload in the data asset"); process.exit(1); }
const KEYS = ["alp", "lnp", "grn", "onp", "oth"];
const LAB = { alp: "ALP", lnp: "L/NP", grn: "GRN", onp: "ON", oth: "OTH" };
const ord = (D.latest && D.latest.primaryOrder) || [];
if (!ord.length || ord.some((k) => !(k in LAB))) {
  console.error("probe setup: latest.primaryOrder unreadable: " + JSON.stringify(ord));
  process.exit(1);
}
const walk = ord.filter((k) => k in LAB);
const rdNum = (v) => String(+(+v).toFixed(1));
/* rdApPrimFig's textContent form (the half is a ½ glyph element nested
   INSIDE the slot's <b>, so a slot's full text is the outer b's, e.g.
   "25½") */
const figTxt = (v) => {
  const [i, f] = (+v).toFixed(1).split(".");
  return f === "0" ? i : f === "5" ? i + "½" : i + "." + f;
};
/* truth waves keyed by their walk-ordered present-party value tuple */
const waveKey = (p) => walk.filter((k) => p[k] != null).map((k) => rdNum(p[k])).join("|");
const waveByKey = new Map();
for (const w of D.individualPolls) {
  if (!w.p) continue;
  const k = waveKey(w.p);
  if (!waveByKey.has(k)) waveByKey.set(k, w);
}

let bad = 0;
const ok = (name, cond, detail) => {
  console.log((cond ? "  ok  " : "FAIL  ") + name + (detail ? "  — " + String(detail).slice(0, 220) : ""));
  if (!cond) bad++;
};

const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new",
});
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));
await page.setViewport({ width: 1440, height: 1600 });
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: "networkidle0", timeout: 60000 });
await page.evaluate(() => {
  const btn = [...document.querySelectorAll("button, a")].find((n) => /all polls/i.test(n.textContent || ""));
  if (btn) btn.click();
});
await page.waitForSelector(".rd-ap-table", { timeout: 30000 });
await page.evaluate(() => {
  const btn = [...document.querySelectorAll(".rd-ap-tabs button, .rd-ap-tabs [role=tab], .rd-ap-bar button, .rd-ap-headwrap button")]
    .find((n) => (n.textContent || "").trim() === "Primary");
  if (btn) btn.click();
});
await new Promise((r) => setTimeout(r, 800));

const rowCount = await page.evaluate(() => document.querySelectorAll(".rd-ap-table .rd-ap-row").length);
const MAX_SCAN = Math.min(14, rowCount);
let scanned = 0, matched = 0, witness = null;
const EXPECT_ROW = walk.map((k) => LAB[k]);

for (let i = 0; i < MAX_SCAN && !witness; i++) {
  scanned++;
  const rowInfo = await page.evaluate((ii) => {
    const rows = [...document.querySelectorAll(".rd-ap-table .rd-ap-row")];
    const row = rows[ii];
    if (!row || !row.scrollIntoView) return null;
    row.scrollIntoView({ block: "center" });
    const figs = [...row.querySelectorAll(".rd-ap-pnums > b")].map((n) => (n.textContent || "").trim());
    const aria = (row.querySelector('.rd-ap-pic[role="img"]') || {}).ariaLabel || "";
    const dots = [...row.querySelectorAll(".rd-ap-pic .rd-ap-dot")]
      .map((n) => ((n.getAttribute("style") || "").match(/var\(--(alp|lnp|grn|onp|oth)/) || [])[1] || "?");
    const head = (row.textContent || "").replace(/\s+/g, " ").slice(0, 60);
    return { figs, aria, dots, head };
  }, i);
  if (!rowInfo || !rowInfo.aria) continue;
  /* parse "Primary vote: ALP 27.1, ON 26.8, …" pairs from the aria */
  const pairs = [...rowInfo.aria.matchAll(/(ALP|L\/NP|GRN|ON|OTH) (\d+(?:\.\d)?)/g)]
    .map((m) => ({ lab: m[1], v: m[2] }));
  if (!pairs.length) continue;
  const key = walk
    .filter((k) => pairs.some((p) => p.lab === LAB[k]))
    .map((k) => pairs.find((p) => p.lab === LAB[k]).v)
    .join("|");
  const w = waveByKey.get(key);
  if (!w) { console.log(`  --  row ${i}: aria values match no bundle wave (${rowInfo.head}) — skipped`); continue; }
  matched++;
  const tag = `${w.pollster} ${w.field || w.released}`;
  const present = walk.filter((k) => w.p[k] != null);
  const expLabs = present.map((k) => LAB[k]);

  /* figure slots: every walk slot, dash where absent */
  ok(`row ${i} figures in walk order (${tag})`,
     rowInfo.figs.length === walk.length &&
     rowInfo.figs.every((f, j) => f === (w.p[walk[j]] != null ? figTxt(w.p[walk[j]]) : "—")),
     `${rowInfo.figs.join(",")} vs ${walk.map((k) => (w.p[k] != null ? figTxt(w.p[k]) : "—")).join(",")}`);
  /* aria pair labs ride the walk */
  ok(`row ${i} aria labs in walk order (${tag})`,
     JSON.stringify(pairs.map((p) => p.lab)) === JSON.stringify(expLabs),
     pairs.map((p) => p.lab).join(","));
  /* dot DOM/paint order rides the walk, one dot per present party */
  ok(`row ${i} dots in walk order (${tag})`,
     JSON.stringify(rowInfo.dots) === JSON.stringify(present),
     rowInfo.dots.join(","));

  /* expand and read the card's primary ladder */
  await page.evaluate((ii) => {
    const row = [...document.querySelectorAll(".rd-ap-table .rd-ap-row")][ii];
    if (row) row.click();
  }, i);
  await new Promise((r) => setTimeout(r, 900));
  const ladder = await page.evaluate(() => {
    const apd = [...document.querySelectorAll(".rd-apd")].pop();
    if (!apd) return null;
    const prim = apd.querySelector(".rd-apd-prim");
    if (!prim) return null;
    return [...prim.querySelectorAll(":scope > span")].map((s) => ({
      lab: (s.querySelector("b") || { textContent: "?" }).textContent.trim(),
      v: (s.querySelector(".rd-apd-big") || { textContent: "?" }).textContent.trim(),
    }));
  });
  ok(`row ${i} detail ladder in walk order (${tag})`,
     ladder != null &&
     JSON.stringify(ladder.map((l) => l.lab)) === JSON.stringify(expLabs) &&
     ladder.every((l, j) => l.v === rdNum(w.p[present[j]])),
     ladder ? ladder.map((l) => l.lab + " " + l.v).join(",") : "(no .rd-apd-prim)");

  /* disagreement witness: the wave's OWN figures would rank differently */
  const ownRank = [...present].sort((a, b) => w.p[b] - w.p[a]);
  if (JSON.stringify(ownRank) !== JSON.stringify(present)) witness = { tag, i };
  await page.evaluate((ii) => {
    const row = [...document.querySelectorAll(".rd-ap-table .rd-ap-row")][ii];
    if (row) row.click();
  }, i);
  await new Promise((r) => setTimeout(r, 300));
}
ok(`scanned rows matched back to bundle waves`, matched >= 3, `${matched} of ${scanned} scanned`);
ok("at least one DISAGREEING wave witnessed (own order ≠ walk)", witness != null, witness ? witness.tag : "none in first " + MAX_SCAN);

/* the modelled-seats sentence on the DemosAU 18–20 Aug range-only wave */
await page.evaluate(() => {
  const row = [...document.querySelectorAll(".rd-ap-table .rd-ap-row")].find((n) => (n.textContent || "").includes("18–20 Aug"));
  if (row) { row.scrollIntoView({ block: "center" }); row.click(); }
});
await new Promise((r) => setTimeout(r, 900));
const seatsTxt = await page.evaluate(() => {
  const apd = [...document.querySelectorAll(".rd-apd")].pop();
  if (!apd) return "";
  const k = [...apd.querySelectorAll(".rd-apd-k")].find((n) => (n.textContent || "").trim() === "Seats, modelled");
  const cell = k && k.parentElement ? k.parentElement.textContent : "";
  return String(cell || "").replace(/\s+/g, " ");
});
const seatW = D.individualPolls.find((x) => x.seats && x.seats.rangeOnly && x.seats.p);
const seatExpect = seatW ? walk.filter((k) => seatW.seats.p[k]).map((k) => LAB[k]) : null;
const seatIdx = seatExpect ? seatExpect.map((lab) => seatsTxt.indexOf(lab)) : [];
ok("seats sentence parties in walk order",
   seatExpect != null && seatExpect.length > 1 &&
   seatIdx.every((x) => x >= 0) && seatIdx.every((x, j) => j === 0 || x > seatIdx[j - 1]),
   seatExpect ? `${seatExpect.join("→")} at ${seatIdx.join("/")} :: ${seatsTxt.slice(0, 140)}` : "no range-only seats wave in bundle");

if (errors.length) { console.log(errors.join("\n")); bad++; }
console.log(bad === 0 ? "ALL CHECKS PASSED" : `FAILED (${bad})`);
await browser.close();
server.close();
process.exit(bad === 0 ? 0 : 1);
