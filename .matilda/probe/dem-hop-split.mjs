/* Dem-facet pin: pressing an opened poll's "Demographics" line in "Also in
   this poll" must land on a split THAT POLL can draw. User's catch
   2026-10-12: demSplit survives facet hops by design, so from the default
   Age split, a Roy Morgan wave (city/country and one-off cuts, no age cut)
   hopped into a Demographics view whose rows exclude Roy Morgan - the poll
   the reader came from vanished from its own trip. Contract (same rule the
   Who-votes dot trip and the ledger line's own preview already followed):
   keep the sitting split where it draws the poll, else re-seat on the
   first split that does.
   Pins both entry paths of the fix:
     A. All-polls line press - rd-allpolls.jsx lineGo re-seats demSplit;
     B. Latest-table line press - AP.openPoll(key, "demographics", from)
        names no split, and d1a1d215's focus effect applies the same test
        against the split the facet was sitting on;
   and the no-regression half:
     C. a poll that CAN draw the sitting split keeps it (Age stays Age).
   Wave-agnostic: both targets are hunted from the live bundle, Roy Morgan
   preferred for the no-age case, and every expectation is computed through
   window.demPairOf rather than literal figures.
   Run from the repo root: node .matilda/probe/dem-hop-split.mjs
   Rebuild first (node .build/newtracker/build.mjs) - probes the BUILT
   index.html artifact in the working tree. */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { homedir } from "node:os";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
let puppeteer;
for (const base of [process.cwd(), homedir()]) {
  try { puppeteer = createRequire(join(base, "package.json"))("puppeteer-core"); break; } catch { /* next */ }
}
if (!puppeteer) { console.error("puppeteer-core not resolvable"); process.exit(2); }

const PORT = 8955;
const MIME = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".css": "text/css", ".woff2": "font/woff2", ".png": "image/png", ".svg": "image/svg+xml" };
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p === "/") p = "/index.html";
    res.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" });
    res.end(await readFile(join(ROOT, p)));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(PORT, r));

let bad = 0;
const ok = (name, cond, detail) => {
  console.log((cond ? "  ok  " : "FAIL  ") + name + (detail ? "  — " + String(detail).slice(0, 220) : ""));
  if (!cond) bad++;
};
const settle = (ms) => new Promise((r) => setTimeout(r, ms));
const click = (page, sel, text) => page.evaluate(([sel, text]) => {
  const n = [...document.querySelectorAll(sel)].find((x) => (x.textContent || "").includes(text));
  if (n) n.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  return !!n;
}, [sel, text]);

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new",
});

/* a fresh page on the All-polls tab, default facet and default split */
async function freshAllPolls(vw = 1280) {
  const page = await browser.newPage();
  page.errs = [];
  page.on("pageerror", (e) => page.errs.push(String(e).slice(0, 300)));
  await page.setViewport({ width: vw, height: 1400 });
  await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: "networkidle0", timeout: 60000 });
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button, a")].find((n) => /all polls/i.test((n.textContent || "")));
    if (btn) btn.click();
  });
  await page.waitForSelector(".rd-ap-table", { timeout: 30000 });
  await settle(1200);
  return page;
}

/* hunt a target wave in the live bundle: has a group table, no drawable
   pair in the avoid split, some drawable split elsewhere; current year, so
   its field label prints without a year suffix */
async function pickTarget(page, avoidSplit, housePref) {
  return page.evaluate(([avoid, pref]) => {
    const D = window.AUSPOL;
    const YR = String(new Date().getFullYear());
    const sp = window.DEM_SPLITS || [];
    const fits = (p) => sp.find((x) => window.demPairOf(p, x.id));
    const list = [...D.individualPolls]
      .filter((p) => p.grp && p.grp.d && p.ym && p.ym.slice(0, 4) === YR && !window.demPairOf(p, avoid))
      .sort((a, b) => (b.released < a.released ? -1 : 1));
    const t = list.find((p) => p.pollster === pref && fits(p)) || list.find(fits);
    if (!t) return null;
    const exp = fits(t).id;
    return { key: t.pollster + "|" + t.released, pollster: t.pollster, field: t.field, exp, expLab: sp.find((x) => x.id === exp).label };
  }, [avoidSplit, housePref]);
}

/* open the target's row in the date-desc table (show everything first, then
   click the row whose header names the house and whose text carries the
   wave's fieldwork label) */
async function openRow(page, t) {
  await page.evaluate(() => {
    const link = [...document.querySelectorAll(".rd-ap-more .rd-link")].find((n) => /^Show all/.test((n.textContent || "")));
    if (link) link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
  await settle(500);
  return page.evaluate(({ pollster, field }) => {
    const row = [...document.querySelectorAll(".rd-ap-row, .rd-ap-card")].find((r) =>
      ((r.querySelector("[role=rowheader]") || {}).textContent || "").includes(pollster) && (r.textContent || "").includes(field));
    if (!row) return false;
    row.scrollIntoView({ block: "center" });
    row.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    return true;
  }, t);
}

const snap = (page) => page.evaluate(() => ({
  facet: (([...document.querySelectorAll(".rd-ap-tabs > [role=group] > button")].find((b) => b.getAttribute("aria-pressed") === "true") || {}).textContent || "").trim(),
  split: ((([...document.querySelectorAll(".rd-ap-dpick button")].find((b) => b.getAttribute("aria-checked") === "true")) || {}).textContent || "").replace(/\s+/g, " ").trim(),
  openRowText: (((document.querySelector(".rd-ap-row.open, .rd-ap-card.open") || {}).textContent) || "").replace(/\s+/g, " ").trim(),
  openDetail: !!document.querySelector(".rd-ap-open"),
}));

/* ---- A: the user's bug - All-polls "Also in this poll" Demographics line */
{
  const page = await freshAllPolls();
  const t = await pickTarget(page, "age", "Roy Morgan");
  ok("A: a no-age-pair wave with a drawable split exists (Roy Morgan first)", !!t, t && `${t.pollster} ${t.field} → ${t.expLab}`);
  if (t) {
    ok("A: the wave's row opens on the default facet", await openRow(page, t));
    await settle(900);
    ok("A: the Demographics line is offered", await click(page, ".rd-ap-open .rd-ldg-line", "Demographics"));
    await settle(1100);
    const s = await snap(page);
    ok("A: facet now Demographics, split re-seated to one the wave draws",
      s.facet === "Demographics" && s.split === t.expLab, `facet=${s.facet} split=${s.split} want '${t.expLab}'`);
    ok("A: the poll's row is still in the table, still open", s.openDetail && s.openRowText.includes(t.pollster) && s.openRowText.includes(t.field),
      s.openRowText.slice(0, 120));
    ok("A: no page errors", page.errs.length === 0, page.errs.join(" | "));
  }
  await page.close();
}

/* ---- B: a wave the sitting split draws keeps it (no gratuitous re-seat) */
{
  const page = await freshAllPolls();
  const t = await page.evaluate(() => {
    const D = window.AUSPOL;
    const YR = String(new Date().getFullYear());
    const p = [...D.individualPolls]
      .filter((q) => q.grp && q.grp.d && q.ym && q.ym.slice(0, 4) === YR)
      .sort((a, b) => (b.released < a.released ? -1 : 1))
      .find((q) => window.demPairOf(q, "age"));
    return p ? { pollster: p.pollster, field: p.field } : null;
  });
  ok("B: an age-drawable wave exists", !!t, t && `${t.pollster} ${t.field}`);
  if (t) {
    ok("B: the wave's row opens on the default facet", await openRow(page, t));
    await settle(900);
    ok("B: the Demographics line is offered", await click(page, ".rd-ap-open .rd-ldg-line", "Demographics"));
    await settle(1100);
    const s = await snap(page);
    ok("B: facet Demographics and the sitting Age split kept", s.facet === "Demographics" && s.split === "Age", JSON.stringify(s.split));
    ok("B: the poll's row is still in the table, still open", s.openDetail && s.openRowText.includes(t.pollster) && s.openRowText.includes(t.field),
      s.openRowText.slice(0, 120));
    ok("B: no page errors", page.errs.length === 0, page.errs.join(" | "));
  }
  await page.close();
}

/* ---- C: the Latest-table trip - AP.openPoll names no split (focus path) */
{
  const page = await browser.newPage();
  page.errs = [];
  page.on("pageerror", (e) => page.errs.push(String(e).slice(0, 300)));
  await page.setViewport({ width: 1280, height: 1400 });
  await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: "networkidle0", timeout: 60000 });
  await settle(1200);
  const t = await pickTarget(page, "age", "Roy Morgan");
  ok("C: a no-age-pair wave exists for the Latest-table trip", !!t, t && `${t.pollster} ${t.field} → ${t.expLab}`);
  if (t) {
    /* exactly the call rd-polls.jsx's Demographics line makes */
    await page.evaluate((key) => window.AP.openPoll(key, "demographics", "the probe"), t.key);
    await page.waitForSelector(".rd-ap-table", { timeout: 30000 });
    await settle(1500);
    const s = await snap(page);
    ok("C: lands Demographics with the split re-seated to one the wave draws", s.facet === "Demographics" && s.split === t.expLab,
      `facet=${s.facet} split=${s.split} want '${t.expLab}'`);
    ok("C: the poll's row is in the table, open", s.openDetail && s.openRowText.includes(t.pollster) && s.openRowText.includes(t.field),
      s.openRowText.slice(0, 120));
    ok("C: no page errors", page.errs.length === 0, page.errs.join(" | "));
  }
  await page.close();
}

await browser.close();
server.close();
console.log(bad ? `== FAIL: ${bad} ==` : "== ALL CHECKS PASSED ==");
process.exit(bad ? 1 : 0);
