/* Dem-facet pin: the opened poll's printed vote-by-group table renders the
   house's printed figures verbatim - decimals kept, never rounded
   (the "as <house> printed it" contract; Math.round'ed cells showed Roy
   Morgan's printed 26.5 as 27 and its all-voters 22.5/25.5/14.5 row as
   23/26/15, summing 101 against the printed 99.5 - user's catch
   2026-10-11). Opens a Roy Morgan wave on the Demographics facet (Roy
   Morgan's printed tables carry halves on state/location/gender/age) and
   asserts every group row and the All voters row equals the bundle's
   figures cast through rdApNum's exact form ("26.5", "26"). The halves
   count check keeps the pin non-vacuous if the data ever loses its
   printed-half waves.
   Run from the repo root: node .matilda/probe/dem-half-print.mjs
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

const PORT = 8951;
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

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new",
});
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.setViewport({ width: 1280, height: 1400 });
await page.goto(`http://127.0.0.1:${PORT}/index.html?f=g`, { waitUntil: "networkidle0", timeout: 60000 });
await page.evaluate(() => {
  const btn = [...document.querySelectorAll("button, a")].find((n) => /all polls/i.test((n.textContent || "")));
  if (btn) btn.click();
});
await page.waitForSelector(".rd-ap-table", { timeout: 30000 });
await settle(1200);

/* a printed-half wave appears under whatever split its cuts cover - hunt
   for a Roy Morgan row across the facet's splits, showing all rows first */
let opened = false;
for (const lab of ["Place", "Gender", "Age", "Education", "Home"]) {
  await page.evaluate((lab) => {
    const b = [...document.querySelectorAll(".rd-ap-dpick button")].find((n) => (n.textContent || "").trim() === lab);
    if (b) b.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  }, lab);
  await settle(700);
  await page.evaluate(() => {
    const link = [...document.querySelectorAll(".rd-ap-more .rd-link")].find((n) => /^Show all/.test((n.textContent || "")));
    if (link) link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
  await settle(500);
  opened = await page.evaluate(() => {
    const row = [...document.querySelectorAll(".rd-ap-row")].find((r) => /Roy Morgan/.test((r.querySelector("[role=rowheader]") || {}).textContent || ""));
    if (!row) return false;
    row.scrollIntoView({ block: "center" });
    row.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    return true;
  });
  if (opened) break;
}
ok("a Roy Morgan row found and opened", opened);
await settle(900);
const r = await page.evaluate(() => {
  const d = document.querySelector(".rd-ap-open .rd-apd-demwrap");
  if (!d) return null;
  const row = document.querySelector(".rd-ap-row.open");
  const who = (row.querySelector("[role=rowheader] b").textContent || "").replace(/↗/g, "").trim();
  const field = (row.querySelector(".rd-ap-when b") || {}).textContent.trim();
  const D = window.AUSPOL;
  const p = D.individualPolls.find((q) => q.pollster === who && q.field === field);
  const KEY = { ALP: "alp", "L/NP": "lnp", GRN: "grn", ON: "onp", OTH: "oth" };
  const K = ["alp", "lnp", "grn", "onp", "oth"];
  const heads = [...d.querySelector(".rd-apd-demh").querySelectorAll("[role=columnheader]")].map((h) => KEY[h.textContent.trim()]);
  const num = (v) => (v == null ? "—" : String(+(+v).toFixed(1)));
  const flat = (el) => (el ? el.innerText.replace(/\s+/g, " ").trim() : "");
  const rows = {};
  for (const x of d.querySelectorAll(".rd-apd-demr:not(.rd-apd-demh)")) {
    rows[x.querySelector("[role=rowheader]").textContent.trim()] = flat(x);
  }
  const bad = [];
  const seen = new Set();
  const claim = (lab, vals) => {
    const want = lab + " " + vals.map(num).join(" ");
    const got = rows[lab];
    if (got !== want) bad.push(`row '${lab}': got '${got}' want '${want}'`);
    seen.add(lab);
  };
  /* row figures ride the bundle as K-ordered arrays; heads give column order */
  for (const [dim, rs] of Object.entries(p.grp.d)) for (const [lab, v] of rs) claim(lab, heads.map((h) => v[K.indexOf(h)]));
  if (p.grp.t) claim("All voters", heads.map((h) => p.grp.t[K.indexOf(h)]));
  const halves = [...new Set(Object.values(p.grp.d).flatMap((rs) => rs.flatMap((r) => [...r[1]])).concat(p.grp.t || []))].filter((v) => v != null && v % 1 !== 0);
  return { head: d.querySelector(".rd-apd-h").textContent.trim(), bad, halves: halves.length, wave: who + " " + field, extra: Object.keys(rows).filter((l) => !seen.has(l)) };
});
ok("the printed-it table leads the opened poll", !!r, r && JSON.stringify(r.wave));
ok("heading is the house's printed table", r && /^The vote by group, as .+ printed it$/.test(r.head), r && r.head);
ok("the wave's own table carries halves (pin not vacuous)", r && r.halves > 0, r && r.halves + " half figures");
ok("every row renders the printed figures verbatim (halves kept)", r && r.bad.length === 0 && r.extra.length === 0, r && (r.bad.concat(r.extra).join(" ;; ") || "none"));
ok("no page errors", errors.length === 0, errors.join(" | "));

await page.close();
await browser.close();
server.close();
console.log(bad ? `== FAIL: ${bad} ==` : "== ALL CHECKS PASSED ==");
process.exit(bad ? 1 : 0);
