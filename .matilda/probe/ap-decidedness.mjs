/* Decidedness in the opened poll (the shared ledger, RdLedger - one
   renderer for All polls and the Latest table since the 2026-10-11 ledger
   redesign). The wave's movable share, on its own basis, reads in full under
   the primaries where the Primary tab leads, and as a short unit on the
   Primary line ("Also in this poll") on every other tab:
     RedBridge/Accent : `firmAll` triple → "54% not firm", solid/soft/very-soft
     Roy Morgan       : `undecided` (first) → "undecided", "couldn’t name…"
     Resolve          : `undecided` (soft)  → "not firm", "named a party…"
     Essential        : `undecided` (tpp)   → "undecided", "unallocated…"
     YouGov           : neither field → nothing (negative control)
     Confidence facet : a gauge release → no Primary line, nothing
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
    sub: `solid ${p.firmAll[0]}, soft ${p.firmAll[1]}, very soft ${p.firmAll[2]} on its vote-softness table`,
  }), "RedBridge"),
  pick("Roy Morgan", (p) => p.undecided != null, (p) => ({
    head: p.undecided + "%", word: "undecided", sub: "couldn’t name a party when first asked",
  }), "Roy Morgan"),
  pick("Resolve", (p) => p.undecided != null && p.undecidedBasis === "soft", (p) => ({
    head: p.undecided + "%", word: "not firm", sub: "named a party, but might yet change their mind",
  }), "Resolve"),
  pick("Essential", (p) => p.undecided != null && p.undecidedBasis === "tpp", (p) => ({
    head: p.undecided + "%", word: "undecided", sub: "unallocated inside the printed two-party pair",
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

const tab = async (lab) => {
  await page.evaluate((l) => {
    const btn = [...document.querySelectorAll(".rd-ap-tabs [role=group] button")].find((n) => (n.textContent || "").trim() === l);
    if (btn) btn.click();
  }, lab);
  await sleep(800);
};
/* the open ledger: the lead's decidedness sentence (Primary tab) and the
   Primary line's units (any other tab) */
const readDetail = () => page.evaluate(() => {
  const lg = [...document.querySelectorAll(".rd-ap-open .rd-ldg")].pop();
  if (!lg) return null;
  const norm = (s) => (s || "").replace(/\s+/g, " ").trim();
  const lead = lg.querySelector(".rd-ldg-lead");
  const sentence = lead ? [...lead.querySelectorAll(".rd-ldg-foot1")].map((n) => norm(n.textContent)).find((t) => /% (not firm|undecided)/.test(t)) || null : null;
  const line = [...lg.querySelectorAll(".rd-ldg-line")].find((l) => norm((l.querySelector(".rd-ldg-lab") || {}).textContent) === "Primary");
  return { sentence, line: line ? norm(line.querySelector(".rd-ldg-lbody").textContent) : null, lines: [...lg.querySelectorAll(".rd-ldg-lab")].map((n) => norm(n.textContent)) };
});

for (const cs of CASES) {
  const tag = `${cs.house} ${W(cs.q)}`;
  /* the Primary tab: the full sentence under the primaries */
  await tab("Primary");
  await search(cs.query);
  await clickRow(cs.idx);
  const d = await readDetail();
  if (cs.expect === null) {
    ok(`negative control: no decidedness under the primaries (${tag})`, d && !d.sentence, d ? String(d.sentence) : "no detail");
  } else {
    const x = cs.expect(cs.q);
    ok(`Primary tab: decidedness under the primaries (${tag}: "${x.head} ${x.word}")`,
       d && d.sentence && d.sentence.includes(x.head + " " + x.word), d ? String(d.sentence) : "no detail");
    ok(`Primary tab: its basis in words (${tag})`, d && d.sentence && d.sentence.includes(x.sub.slice(0, 60)), d ? String(d.sentence) : "no detail");
  }
  await clickRow(cs.idx); /* collapse */
  /* the 2PP tab: the short form on the Primary line */
  await tab("2PP");
  await search(cs.query);
  await clickRow(cs.idx);
  const d2 = await readDetail();
  if (cs.expect === null) {
    ok(`negative control: the Primary line carries no decidedness (${tag})`, d2 && d2.line != null && !/% (not firm|undecided)/.test(d2.line),
       d2 ? String(d2.line) : "no detail");
  } else {
    const x = cs.expect(cs.q);
    ok(`2PP tab: the Primary line carries "${x.head} ${x.word}" (${tag})`, d2 && d2.line && d2.line.includes(x.head + " " + x.word),
       d2 ? String(d2.line) : "no detail");
  }
  await clickRow(cs.idx);
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
  ok("confidence facet: no decidedness, no Primary line", d && !d.sentence && !d.lines.includes("Primary"),
     d ? "lines: " + d.lines.join(" | ") : "no detail");
} else {
  console.log("  --  no confidence rows on this data: facet check skipped");
}

/* the Latest table opens a poll with the same ledger: on its Primary tab the
   sentence leads, on its 2PP tab the Primary line carries the short form.
   RedBridge's newest wave carries firmAll, Resolve's the soft basis,
   YouGov neither (negative) */
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: "networkidle0", timeout: 60000 });
await page.waitForSelector(".rd-pl-row", { timeout: 30000 });
const latestTab = async (lab) => {
  await page.evaluate((l) => {
    const b = [...document.querySelectorAll("#latest-polls .rd-pl-tabs button")].find((n) => (n.textContent || "").trim() === l);
    if (b) b.click();
  }, lab);
  await sleep(600);
};
const latestDetail = async (q) => {
  await page.evaluate((query) => {
    const item = [...document.querySelectorAll("#latest-polls .rd-pl-item")].find((r) => (r.querySelector(".rd-pl-c-name") || {}).textContent.includes(query));
    if (item && !item.classList.contains("open")) { item.scrollIntoView({ block: "center" }); item.querySelector(".rd-pl-c-figs").click(); }
  }, q);
  await sleep(700);
  return page.evaluate((query) => {
    const item = [...document.querySelectorAll("#latest-polls .rd-pl-item.open")].find((r) => (r.querySelector(".rd-pl-c-name") || {}).textContent.includes(query));
    const lg = item && item.querySelector(".rd-ldg");
    if (!lg) return null;
    const norm = (s) => (s || "").replace(/\s+/g, " ").trim();
    const sentence = [...lg.querySelectorAll(".rd-ldg-lead .rd-ldg-foot1")].map((n) => norm(n.textContent)).find((t) => /% (not firm|undecided)/.test(t)) || null;
    const line = [...lg.querySelectorAll(".rd-ldg-line")].find((l) => norm((l.querySelector(".rd-ldg-lab") || {}).textContent) === "Primary");
    return { sentence, line: line ? norm(line.querySelector(".rd-ldg-lbody").textContent) : null };
  }, q);
};
const closeLatest = async (q) => {
  await page.evaluate((query) => {
    const item = [...document.querySelectorAll("#latest-polls .rd-pl-item.open")].find((r) => (r.querySelector(".rd-pl-c-name") || {}).textContent.includes(query));
    if (item) item.querySelector(".rd-pl-c-figs").click();
  }, q);
  await sleep(300);
};
const LATEST = [
  ["RedBridge", (() => {
    const w = byHouse("RedBridge/Accent")[0];
    return w && Array.isArray(w.firmAll) ? { dd: w.firmAll[1] + w.firmAll[2] + "% not firm",
                 sub: "solid " + w.firmAll[0] + ", soft " + w.firmAll[1] + ", very soft " + w.firmAll[2] } : undefined;
  })()],
  ["Resolve", (() => {
    const w = byHouse("Resolve")[0];
    return w && w.undecided != null && w.undecidedBasis === "soft" ? { dd: w.undecided + "% not firm", sub: "named a party" } : undefined;
  })()],
  ["YouGov", null],
];
for (const [house, exp] of LATEST) {
  if (exp === undefined) { console.log(`  --  no ${house} candidate wave in bundle: latest-expansion check skipped`); continue; }
  await latestTab("Primary");
  const d = await latestDetail(house);
  if (exp === null) {
    ok(`latest, Primary tab: no decidedness (${house})`, d && !d.sentence, d ? String(d.sentence) : "no detail");
  } else {
    ok(`latest, Primary tab: "${exp.dd}" under the primaries (${house})`, d && d.sentence && d.sentence.includes(exp.dd), d ? String(d.sentence) : "no detail");
    ok(`latest, Primary tab: its basis in words (${house})`, d && d.sentence && d.sentence.toLowerCase().includes(exp.sub), d ? String(d.sentence) : "no detail");
  }
  await closeLatest(house);
  await latestTab("2PP");
  const d2 = await latestDetail(house);
  if (exp === null) {
    ok(`latest, 2PP tab: the Primary line carries no decidedness (${house})`, d2 && d2.line != null && !/% (not firm|undecided)/.test(d2.line), d2 ? String(d2.line) : "no detail");
  } else {
    ok(`latest, 2PP tab: the Primary line carries "${exp.dd}" (${house})`, d2 && d2.line && d2.line.includes(exp.dd), d2 ? String(d2.line) : "no detail");
  }
  await closeLatest(house);
}

ok("no page errors", errors.length === 0, errors.join(" ; "));
await browser.close();
server.close();
console.log(bad ? `\n${bad} FAIL` : "all ok");
process.exit(bad ? 1 : 0);
