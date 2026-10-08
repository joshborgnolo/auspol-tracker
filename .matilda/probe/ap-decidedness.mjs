/* Decidedness line in the All-polls expanded detail (RdApDetail) AND in
   the Latest table's row expansion (rd-polls' rd-pld-dl): each should read
   "Decidedness" with the wave's movable share on its own basis -
     RedBridge/Accent : `firmAll` triple → "54%"·"not firm", solid/soft/very-soft sub
     Roy Morgan       : `undecided` (first) → "undecided" + "Couldn’t name…" sub
     Resolve          : `undecided` (soft)  → "not firm" + "Named a party…" sub
     Essential        : `undecided` (tpp)   → "undecided" + "Unallocated…" sub
     YouGov           : neither field → NO Decidedness row (negative control)
     Confidence facet : expanded gauge row → NO Decidedness row (isConf keeps
                        the generic facts out)
   Truth comes from the same 9f09dca2 data asset the page reads (new
   Function fixture, ap-prim-detail-order pattern) - the probe pins the
   WIRING, never the day's data. Rebuild first:
   node .build/newtracker/build.mjs && node .matilda/probe/ap-decidedness.mjs */
import { createServer } from "node:http";
import { readFile, readdir } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const PORT = 8959;
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
if (!D || !D.individualPolls) { console.error("probe setup: no AUSPOL payload"); process.exit(1); }

let bad = 0;
const ok = (name, cond, detail) => {
  console.log((cond ? "  ok  " : "FAIL  ") + name + (detail ? "  — " + String(detail).slice(0, 220) : ""));
  if (!cond) bad++;
};

/* target waves, truth-driven, each newest of its kind, plus the negative */
const byHouse = (house) => D.individualPolls
  .filter((p) => p.pollster === house)
  .sort((a, b) => (a.released < b.released ? 1 : -1));
const pick = (house, pred, expect, query) => {
  const rows = byHouse(house);
  const neg = expect === null;
  const at = rows.findIndex((p) => neg ? true : pred(p));
  if (at < 0) { console.log(`  --  no candidate row for ${house}: skipped`); return null; }
  return { house, q: rows[at], idx: at, expect, query };
};
const W = p => p.field || p.released;
const CASES = [
  pick("RedBridge/Accent", (p) => Array.isArray(p.firmAll), (p) => ({
    head: p.firmAll[1] + p.firmAll[2] + "%", word: "not firm",
    sub: `Solid ${p.firmAll[0]}, soft ${p.firmAll[1]}, very soft ${p.firmAll[2]} – from the wave’s own vote-softness table`,
  }), "RedBridge"),
  pick("Roy Morgan", (p) => p.undecided != null, (p) => ({
    head: p.undecided + "%", word: "undecided", sub: "Couldn’t name a party when first asked",
  }), "Roy Morgan"),
  pick("Resolve", (p) => p.undecided != null && p.undecidedBasis === "soft", (p) => ({
    head: p.undecided + "%", word: "not firm", sub: "Named a party, but might yet change their mind",
  }), "Resolve"),
  pick("Essential", (p) => p.undecided != null && p.undecidedBasis === "tpp", (p) => ({
    head: p.undecided + "%", word: "undecided", sub: "Unallocated inside the printed two-party pair",
  }), "Essential"),
  pick("YouGov", null, null, "YouGov"),
].filter(Boolean);

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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const search = async (q) => {
  await page.evaluate((query) => {
    const inp = document.querySelector(".rd-ap-search input, input.rd-ap-search");
    if (!inp) return false;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(inp, query);
    inp.dispatchEvent(new Event("input", { bubbles: true }));
    inp.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }, q);
  await sleep(700);
};

const clickRow = async (i) => {
  await page.evaluate((ii) => {
    const row = [...document.querySelectorAll(".rd-ap-table .rd-ap-row")][ii];
    if (row) { row.scrollIntoView({ block: "center" }); row.click(); }
  }, i);
  await sleep(900);
};

const readDetail = () => page.evaluate(() => {
  const apd = [...document.querySelectorAll(".rd-apd")].pop();
  if (!apd) return null;
  const keys = [...apd.querySelectorAll(".rd-apd-k")].map((k) => (k.textContent || "").trim());
  const cell = [...apd.querySelectorAll(".rd-apd-grid1")].find((g) => {
    const k = g.querySelector(".rd-apd-k");
    return k && (k.textContent || "").trim() === "Decidedness";
  });
  const norm = (s) => (s || "").replace(/\s+/g, " ").trim();
  return {
    keys,
    first: cell ? norm(cell.querySelector(".rd-apd-cell > span") && cell.querySelector(".rd-apd-cell > span").textContent) : null,
    sub: cell ? norm(cell.querySelector(".rd-apd-sub") && cell.querySelector(".rd-apd-sub").textContent) : null,
  };
});

for (const cs of CASES) {
  const tag = `${cs.house} ${W(cs.q)}`;
  await search(cs.query);
  await clickRow(cs.idx);
  const d = await readDetail();
  if (cs.expect === null) {
    ok(`negative control: no Decidedness row (${tag})`, d && !d.keys.includes("Decidedness"),
       d ? "detail keys: " + d.keys.join(" | ") : "no detail");
  } else {
    const x = cs.expect(cs.q);
    ok(`Decidedness row present (${tag})`, d && d.keys.includes("Decidedness"),
       d ? "keys: " + d.keys.join(" | ") : "no detail");
    ok(`head+word (${tag}: "${x.head} ${x.word}")`, d && d.first && d.first.includes(x.head) && d.first.toLowerCase().includes(x.word),
       d ? d.first : "no cell");
    ok(`basis sub (${tag})`, d && d.sub && d.sub.includes(x.sub.slice(0, 60)),
       d ? d.sub : "no sub");
  }
  await clickRow(cs.idx); /* collapse before the next search */
}

/* the confidence facet keeps the generic facts out of its detail */
await search("");
await page.evaluate(() => {
  const inp = document.querySelector(".rd-ap-search input, input.rd-ap-search");
  if (inp) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(inp, "");
    inp.dispatchEvent(new Event("input", { bubbles: true }));
  }
});
await page.evaluate(() => {
  const btn = [...document.querySelectorAll(".rd-ap-tabs button, .rd-ap-tabs [role=tab], .rd-ap-bar button")]
    .find((n) => /^confidence$/i.test((n.textContent || "").trim()));
  if (btn) btn.click();
});
await sleep(900);
const nConf = await page.evaluate(() => document.querySelectorAll(".rd-ap-table .rd-ap-row").length);
if (nConf > 0) {
  await clickRow(0);
  const d = await readDetail();
  ok("confidence facet: no Decidedness row", d && !d.keys.includes("Decidedness"),
     d ? "keys: " + d.keys.join(" | ") : "no detail");
} else {
  console.log("  --  no confidence rows on this data: facet check skipped");
}

/* the same four bases caption the LATEST table's row expansion (rd-polls'
   .rd-pld-dl facts list): reload to the default view, open a house's row,
   read its Decidedness dd against the same bundle. RedBridge's newest wave
   carries firmAll, Resolve's the soft basis, YouGov neither (negative). */
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: "networkidle0", timeout: 60000 });
await page.waitForSelector(".rd-pl-row", { timeout: 30000 });
const latestDetail = async (q) => {
  await page.evaluate((query) => {
    const row = [...document.querySelectorAll(".rd-pl-row")].find((r) => (r.textContent || "").includes(query));
    if (row) { row.scrollIntoView({ block: "center" }); row.click(); }
  }, q);
  await sleep(900);
  return page.evaluate(() => {
    const det = [...document.querySelectorAll(".rd-pl-detail")].pop();
    if (!det) return null;
    const norm = (s) => (s || "").replace(/\s+/g, " ").trim();
    const dts = [...det.querySelectorAll(".rd-pld-dl dt")].map((n) => norm(n.textContent));
    const dds = [...det.querySelectorAll(".rd-pld-dl dd")];
    const at = dts.indexOf("Decidedness");
    return { dts, txt: at >= 0 && dds[at] ? norm(dds[at].textContent) : null };
  });
};
const LATEST = [
  ["RedBridge", (() => {
    const w = byHouse("RedBridge/Accent").find((p) => Array.isArray(p.firmAll));
    return w ? { dd: w.firmAll[1] + w.firmAll[2] + "% not firm",
                 sub: "solid " + w.firmAll[0] + ", soft " + w.firmAll[1] + ", very soft " + w.firmAll[2] } : undefined;
  })()],
  ["Resolve", (() => {
    const w = byHouse("Resolve").find((p) => p.undecided != null && p.undecidedBasis === "soft");
    return w ? { dd: w.undecided + "% not firm", sub: "named a party" } : undefined;
  })()],
  ["YouGov", null],
];
for (const [house, exp] of LATEST) {
  if (exp === undefined) { console.log(`  --  no ${house} candidate wave in bundle: latest-expansion check skipped`); continue; }
  const d = await latestDetail(house);
  if (exp === null) {
    ok(`latest expansion: no Decidedness row (${house})`, d && !d.dts.includes("Decidedness"),
       d ? "dts: " + d.dts.join(" | ") : "no detail");
  } else {
    ok(`latest expansion: Decidedness dd (${house}: "${exp.dd}")`, d && d.txt && d.txt.includes(exp.dd),
       d ? String(d.txt) : "no detail");
    ok(`latest expansion: basis detail (${house})`, d && d.txt && d.txt.toLowerCase().includes(exp.sub),
       d ? String(d.txt) : "no detail");
  }
  /* collapse the row before the next house */
  await page.evaluate((q) => {
    const row = [...document.querySelectorAll(".rd-pl-row")].find((r) => (r.textContent || "").includes(q));
    if (row && row.getAttribute("aria-expanded") === "true") row.click();
  }, house);
  await sleep(400);
}

ok("no page errors", errors.length === 0, errors.join(" ; "));
await browser.close();
server.close();
console.log(bad ? `\n${bad} FAIL` : "all ok");
process.exit(bad ? 1 : 0);
