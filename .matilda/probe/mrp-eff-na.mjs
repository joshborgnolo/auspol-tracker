/* Pins the All-polls Sample column's "eff." sub-line per row class:
     - a row stamped with sampleEff shows "eff. <n>" (the house's figure)
     - a filing house's brand-new unstamped wave shows "eff. TBC"
     - that same wave past 21 days with no statement shows "eff. missing"
     - an MRP row (pollster ends " (MRP)") shows "eff. n/a" — MRPs file no
       effective sample; their APC statements print "n/a for MRP"
     - Roy Morgan, Spectre Strategy and Resolve show "eff. ~<n>", their raw
       sample over the live design effect rounded to ten, in the table and
       both expanded-poll renderers; other houses never inherit that badge.
   Run from the repo root: ROOT=.worktrees/<name> node .matilda/probe/mrp-eff-na.mjs */
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
const require = createRequire(join(process.cwd(), "package.json"));
const puppeteer = require("puppeteer-core");
const ROOT = process.env.ROOT || ".";
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".woff2": "font/woff2", ".svg": "image/svg+xml", ".png": "image/png" };
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p.endsWith("/")) p += "index.html";
    res.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" });
    res.end(await readFile(join(ROOT, p)));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, r));
const URL0 = `http://127.0.0.1:${server.address().port}/`;
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.setViewport({ width: 1366, height: 900, deviceScaleFactor: 1 });
await page.goto(URL0 + "allpolls/", { waitUntil: "networkidle0" });
await new Promise((r) => setTimeout(r, 1500));
/* the archive groups by month with only recent ones open; the "Show all"
   button expands every month so each MRP row in the bundle is on the page */
await page.evaluate(() => {
  const b = [...document.querySelectorAll("button")].find((x) => /^Show all \d+$/.test(x.textContent.trim()));
  if (b) b.click();
});
await new Promise((r) => setTimeout(r, 800));

const got = await page.evaluate(() => {
  const rows = [...document.querySelectorAll(".rd-ap-row, .rd-ap-card")];
  const out = { mrp: [], naLeak: [], missing: [], estimated: [], expectedEst: [], effFig: 0, tbc: 0, named: 0, window: "" };
  const head = document.querySelector(".rd-ap-hrow");
  if (head) out.window = head.textContent.slice(0, 80);
  for (const row of rows) {
    const name = ((row.querySelector(".rd-ap-who b") || {}).textContent || "").replace(/\s*↗\s*$/, "");
    const subs = [...row.querySelectorAll(".rd-ap-n .rd-ap-sub")].map((s) => s.textContent.trim());
    if (name) out.named++;
    if (/\s*\(MRP\)$/.test(name)) {
      const n = (row.querySelector(".rd-ap-n > span") || {}).textContent || "";
      out.mrp.push({ name, n, subs });
    } else if (subs.some((s) => s.startsWith("eff. n/a"))) {
      out.naLeak.push({ name, subs });
    } else {
      if (subs.some((s) => /^eff\. [\d,]+$/.test(s))) out.effFig++;
      if (subs.some((s) => /^eff\. TBC$/.test(s))) out.tbc++;
      if (subs.some((s) => /^eff\. missing$/.test(s)))
        out.missing.push({ name, when: (row.querySelector(".rd-ap-when") || {}).textContent || "" });
      const approximate = subs.find((s) => /^eff\. ~[\d,]+$/.test(s));
      if (approximate) out.estimated.push({ name, want: approximate });
    }
  }
  out.dataMrp = (window.AUSPOL.individualPolls || []).filter((p) => /\s*\(MRP\)$/.test(p.pollster)).length;
  const houses = new Set(["Roy Morgan", "Spectre Strategy", "Resolve"]);
  const method = (window.AUSPOL.latest || {}).method || {};
  const deff = method.deff || 1.6;
  out.expectedEst = (window.AUSPOL.individualPolls || []).filter((p) => houses.has(p.pollster) && p.sampleEff == null && p.sample)
    .map((p) => ({ name: p.pollster, want: "eff. ~" + (Math.round(p.sample / deff / 10) * 10).toLocaleString() }));
  const all = (window.AUSPOL.individualPolls || []).concat(window.AUSPOL.issuesOnlyPolls || []);
  out.expectedMissing = all.filter((p) => !p.conf && p.sampleEff == null && p.published
      && Date.now() - Date.parse(p.published.slice(0, 10)) >= 21 * 86400000
      && all.some((q) => q.pollster === p.pollster && q.sampleEff != null
        && Math.abs(Date.parse(q.released) - Date.parse(p.released)) < 120 * 86400000))
    .map((p) => ({ name: p.pollster, when: p.field }));
  return out;
});

let fails = 0;
const ok = (cond, line) => { console.log((cond ? "ok  " : "FAIL") + "  " + line); if (!cond) fails++; };
ok(got.named > 150, "named poll rows render after Show all (" + got.named + ")");
ok(got.dataMrp > 0, "bundle carries MRP rows (" + got.dataMrp + ")");
ok(got.mrp.length === got.dataMrp, "every bundle MRP row renders (" + got.mrp.length + " = " + got.dataMrp + ")");
for (const m of got.mrp)
  ok(m.subs.length === 1 && m.subs[0] === "eff. n/a", m.name + " (" + m.n + ") shows exactly the 'eff. n/a' sub-line" + (m.subs.length ? " — got " + JSON.stringify(m.subs) : ""));
ok(got.naLeak.length === 0, "no non-MRP row shows 'eff. n/a'" + (got.naLeak.length ? " — " + JSON.stringify(got.naLeak.slice(0, 3)) : ""));
ok(got.effFig > 20, "stamped rows keep their 'eff. <n>' figure (" + got.effFig + " rows)");
console.log("info: " + got.tbc + " row(s) show 'eff. TBC'");
const estSig = (rows) => rows.map((r) => r.name + "|" + r.want).sort().join("\n");
ok(new Set(got.expectedEst.map((r) => r.name)).size === 3, "the test set covers Roy Morgan, Spectre Strategy and Resolve");
ok(estSig(got.estimated) === estSig(got.expectedEst),
  "every approximate badge is raw n ÷ DEFF rounded to ten on exactly those three houses (" + got.estimated.length + "/" + got.expectedEst.length + ")"
    + (estSig(got.estimated) === estSig(got.expectedEst) ? "" : "\nGOT:\n" + estSig(got.estimated) + "\nWANT:\n" + estSig(got.expectedEst)));

/* The missing registry follows the filed data, not a hard-coded wave list:
   statements can be backfilled, while the production gate also retires old
   statuses after its 120-day lookaround. The four waves that left the old
   nine-row fixture had all gained sampleEff/method statements by 2026-11-20. */
const EXPECTED_MISSING = got.expectedMissing;
const missKey = (m) => m.name + "|" + m.when.trim();
ok(got.missing.length === EXPECTED_MISSING.length,
  "exactly " + EXPECTED_MISSING.length + " rows show 'eff. missing' (got " + got.missing.length + (got.missing.length ? ": " + got.missing.map(missKey).join("; ") : "") + ")");
for (const { name: n, when: w } of EXPECTED_MISSING)
  ok(got.missing.some((m) => m.name.startsWith(n) && m.when.includes(w)),
    "missing row present: " + n + " " + w);

/* the detail head joins the tag in words: "(eff. missing)" on the
   "in a sample of N …" line, linked like TBC */
if (got.missing.length) {
  const target = got.missing[0];
  await page.evaluate((wanted) => {
    const row = [...document.querySelectorAll(".rd-ap-row, .rd-ap-card")]
      .find((r) => (((r.querySelector(".rd-ap-who b") || {}).textContent || "").replace(/\s*↗\s*$/, "") === wanted.name)
        && (((r.querySelector(".rd-ap-when") || {}).textContent || "").trim() === wanted.when.trim())
        && [...r.querySelectorAll(".rd-ap-n .rd-ap-sub")].some((s) => s.textContent.trim() === "eff. missing"));
    if (row) row.click();
  }, target);
  await page.waitForFunction(
    () => {
      const h = document.querySelector(".rd-ap-open .rd-apd-h");
      return h && h.textContent.length > 10;
    },
    { timeout: 10000 }).catch(() => {});
  const head = await page.evaluate((name) => {
    const h = document.querySelector(".rd-ap-open .rd-apd-h");
    const link = h && h.querySelector("a.rd-tbc");
    return { text: h ? h.textContent.trim() : "", href: link ? link.href : null, word: link ? link.textContent.trim() : null,
             expected: (window.AUSPOL.effTbcUrls || {})[name] || null };
  }, target.name);
  ok(head.text.includes("(eff. missing)"), "detail head names the missing tag — " + JSON.stringify(head.text.slice(0, 120)));
  ok(head.word === "missing" && head.href != null && head.href === head.expected,
    "the missing word is the same APC link as TBC (" + head.href + ")");
}

for (const house of [...new Set(got.expectedEst.map((r) => r.name))]) {
  await page.evaluate((name) => {
    const row = [...document.querySelectorAll(".rd-ap-row, .rd-ap-card")]
      .find((r) => (((r.querySelector(".rd-ap-who b") || {}).textContent || "").replace(/\s*↗\s*$/, "") === name)
        && [...r.querySelectorAll(".rd-ap-n .rd-ap-sub")].some((s) => /^eff\. ~[\d,]+$/.test(s.textContent.trim())));
    if (row) row.click();
  }, house);
  await page.waitForFunction((name) => {
    const row = document.querySelector(".rd-ap-open");
    const rowName = row && ((row.querySelector(".rd-ap-who b") || {}).textContent || "").replace(/\s*↗\s*$/, "");
    const h = row && row.querySelector(".rd-apd-h");
    return rowName === name && h && /eff\. ~[\d,]+/.test(h.textContent);
  }, { timeout: 10000 }, house).catch(() => {});
  const detail = await page.evaluate(() => {
    const row = document.querySelector(".rd-ap-open");
    const h = row && row.querySelector(".rd-apd-h");
    return { text: h ? h.textContent.trim() : "", deff: ((window.AUSPOL.latest || {}).method || {}).deff || 1.6 };
  });
  const match = detail.text.match(/a sample of ([\d,]+) \(eff\. ~([\d,]+)\)/);
  const raw = match && Number(match[1].replace(/,/g, ""));
  const estimate = match && Number(match[2].replace(/,/g, ""));
  ok(!!match && estimate === Math.round(raw / detail.deff / 10) * 10,
    house + " expanded All-polls header has the same nearest-10 estimate — " + JSON.stringify(detail.text.slice(0, 140)));
}

/* the search box matches the eff tags and the house figure (the haystack
   tokens ride the same rdEffTbc/rdEffMissing gates, hoisted into the
   d1a1d215 asset 2026-10-20): "missing" — and its "miss" substring —
   surfaces exactly the registry, "eff"/"effective sample" everything the
   Sample column badges, and MRP rows stay out (their "eff. n/a" draws no
   token) */
const typeSearch = async (text) => {
  const x = await page.$(".rd-ap-x");
  if (x) { await x.click(); await new Promise((r) => setTimeout(r, 250)); }
  await page.click(".rd-ap-search input");
  await page.type(".rd-ap-search input", text);
  await new Promise((r) => setTimeout(r, 600));
  /* the table virtualises (minShown 30): a query matching more than 30
     rows renders only the window's head plus a "Show all n" button in
     .rd-ap-more - reveal the whole answer set before counting */
  await page.evaluate(() => {
    const b = [...document.querySelectorAll(".rd-ap-more button")].find((x) => /^Show all \d+$/.test(x.textContent.trim()));
    if (b) b.click();
  });
  await new Promise((r) => setTimeout(r, 600));
};
const visibleRows = () => page.evaluate(() =>
  [...document.querySelectorAll(".rd-ap-row, .rd-ap-card")]
    .filter((r) => r.getBoundingClientRect().height > 0)
    .map((r) => ({ name: ((r.querySelector(".rd-ap-who b") || {}).textContent || "").trim(),
                   when: ((r.querySelector(".rd-ap-when") || {}).textContent || "").trim(),
                   subs: [...r.querySelectorAll(".rd-ap-n .rd-ap-sub")].map((s) => s.textContent.trim()) })));

await typeSearch("missing");
await page.waitForFunction((n) =>
  [...document.querySelectorAll(".rd-ap-row, .rd-ap-card")].filter((r) => r.getBoundingClientRect().height > 0).length === n,
  { timeout: 10000 }, EXPECTED_MISSING.length).catch(() => {});
let hits = await visibleRows();
ok(hits.length === EXPECTED_MISSING.length, 'search "missing" shows exactly the registry (got ' + hits.length + ")");
for (const { name: n, when: w } of EXPECTED_MISSING)
  ok(hits.some((m) => m.name.startsWith(n) && m.when.includes(w)), 'search "missing" finds: ' + n + " " + w);
ok(hits.length > 0 && hits.every((m) => m.subs.includes("eff. missing")), 'every "missing" hit carries the eff. missing badge');

await typeSearch("miss");
await page.waitForFunction((n) =>
  [...document.querySelectorAll(".rd-ap-row, .rd-ap-card")].filter((r) => r.getBoundingClientRect().height > 0).length === n,
  { timeout: 10000 }, EXPECTED_MISSING.length).catch(() => {});
hits = await visibleRows();
ok(hits.length === EXPECTED_MISSING.length, 'substring "miss" shows the same registry (got ' + hits.length + ")");

const effTotal = got.effFig + got.tbc + EXPECTED_MISSING.length + got.expectedEst.length;
await typeSearch("eff");
await page.waitForFunction((n) =>
  [...document.querySelectorAll(".rd-ap-row, .rd-ap-card")].filter((r) => r.getBoundingClientRect().height > 0).length === n,
  { timeout: 10000 }, effTotal).catch(() => {});
hits = await visibleRows();
ok(hits.length === effTotal, 'search "eff" shows every eff-badged row (got ' + hits.length + ", want " + effTotal + ")");
ok(hits.length > 0 && hits.every((m) => m.subs.some((s) => /^eff\. /.test(s) && s !== "eff. n/a")), "every \"eff\" hit is a real eff badge, no n/a leak");
ok(hits.filter((m) => m.subs.some((s) => /^eff\. ~[\d,]+$/.test(s))).length === got.expectedEst.length,
  'search "eff" includes every approximate row, not just house-filed figures');

await typeSearch("effective sample");
await page.waitForFunction((n) =>
  [...document.querySelectorAll(".rd-ap-row, .rd-ap-card")].filter((r) => r.getBoundingClientRect().height > 0).length === n,
  { timeout: 10000 }, effTotal).catch(() => {});
hits = await visibleRows();
ok(hits.length === effTotal, 'two-token "effective sample" shows the same eff set (got ' + hits.length + ")");

await page.goto(URL0, { waitUntil: "networkidle0" });
await page.waitForSelector(".rd-pl-item");
for (const house of ["Roy Morgan", "Spectre Strategy", "Resolve"]) {
  const clicked = await page.evaluate((name) => {
    const item = [...document.querySelectorAll(".rd-pl-item")]
      .find((r) => ((r.querySelector(".rd-pl-nm") || {}).textContent || "").replace(/\s*↗\s*$/, "") === name);
    const figs = item && item.querySelector(".rd-pl-c-figs");
    if (figs) figs.click();
    return !!figs;
  }, house);
  ok(clicked, house + " has a Latest-and-next row to expand");
  if (!clicked) continue;
  await page.waitForFunction((name) => {
    const item = document.querySelector(".rd-pl-item.open");
    const rowName = item && ((item.querySelector(".rd-pl-nm") || {}).textContent || "").replace(/\s*↗\s*$/, "");
    const h = item && item.querySelector(".rd-apd-h");
    return rowName === name && h && /eff\. ~[\d,]+/.test(h.textContent);
  }, { timeout: 10000 }, house).catch(() => {});
  const detail = await page.evaluate(() => {
    const item = document.querySelector(".rd-pl-item.open");
    return { text: item && item.querySelector(".rd-apd-h") ? item.querySelector(".rd-apd-h").textContent.trim() : "",
             deff: ((window.AUSPOL.latest || {}).method || {}).deff || 1.6 };
  });
  const match = detail.text.match(/a sample of ([\d,]+) \(eff\. ~([\d,]+)\)/);
  const raw = match && Number(match[1].replace(/,/g, ""));
  const estimate = match && Number(match[2].replace(/,/g, ""));
  ok(!!match && estimate === Math.round(raw / detail.deff / 10) * 10,
    house + " Latest-and-next expanded header has the same nearest-10 estimate — " + JSON.stringify(detail.text.slice(0, 140)));
}

await browser.close();
server.close();
process.exit(fails ? 1 : 0);
