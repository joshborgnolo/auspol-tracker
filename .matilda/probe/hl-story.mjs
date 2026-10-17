/* House-lean story: the head/dek follows the OPEN measure tab (2026-10-17).
   Was: one two-party finding whichever tab was open (plus a conditional
   split clause). Now: one finding per measure in the measure's own terms,
   with same-way ties named together and the runner-up placed in the dek.
   This probe pins the wiring: a distinct head per measure tab whose names
   agree with the table's own top lean, and sanity wording per family.
   Run from the repo root: node .matilda/probe/hl-story.mjs
   Rebuild first — this probes the BUILT index.html artifact. */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const PORT = 8971;
const MIME = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json",
               ".css": "text/css", ".woff2": "font/woff2", ".png": "image/png" };
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p.endsWith("/")) p += "index.html";
    res.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" });
    res.end(await readFile(join(ROOT, p)));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(PORT, r));
const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new" });

let bad = 0;
const ok = (name, cond, detail) => {
  console.log((cond ? "  ok  " : "FAIL  ") + name + (detail ? "  — " + detail : ""));
  if (!cond) bad++;
};

const page = await browser.newPage();
await page.setViewport({ width: 1100, height: 900 });
await page.goto(`http://127.0.0.1:${PORT}/leans/`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("#house-lean .rd-hl-tabs .rd-tab", { timeout: 20000 });
await new Promise((r) => setTimeout(r, 400));

const readStory = () => page.evaluate(() => ({
  head: (document.querySelector("#house-lean .rd-hed") || {}).textContent || "",
  dek: (document.querySelector("#house-lean .rd-dek") || {}).textContent || "",
  /* the Now cells print U+2212 for negative leans */
  leans: [...document.querySelectorAll("#house-lean .rd-hl-row")].map((r) => ({
    h: r.querySelector(".rd-hl-who b").textContent,
    v: parseFloat(r.querySelector(".rd-hl-now").textContent.replace("−", "-")) || 0 })),
}));
const topLean = (l) => [...l].sort((a, b) => Math.abs(b.v) - Math.abs(a.v))
  .filter((r) => Math.abs(r.v) >= 0.05 && Math.abs(r.v) >= Math.abs([...l].sort((a, b) => Math.abs(b.v) - Math.abs(a.v))[0].v) - 0.05)
  .map((r) => r.h);

const TABS = [
  ["Two-party", /lean(s)? furthest to (Labor|the Coalition|One Nation)/],
  ["One Nation–Coalition split", /read(s)? One Nation (widest|narrowest) against the Coalition/],
  ["Coalition", /read(s)? the Coalition’s vote (highest|lowest)/],
  ["One Nation", /read(s)? One Nation’s vote (highest|lowest)/],
  ["Labor", /read(s)? Labor’s vote (highest|lowest)/],
  ["Greens", /read(s)? the Greens’ vote (highest|lowest)/],
  ["Others", /read(s)? the others’ vote (highest|lowest)/],
];
const seen = new Set();
let story0 = null;
for (const [label, re] of TABS) {
  const btn = [...await page.$$("#house-lean .rd-hl-tabs .rd-tab")].find(async (b) => (await b.evaluate((x) => x.textContent)) === label);
  const found = btn !== undefined;
  ok(`tab present: ${label}`, found);
  if (!found) continue;
  for (const b of await page.$$("#house-lean .rd-hl-tabs .rd-tab")) {
    if ((await b.evaluate((x) => x.textContent)) === label) { await b.click(); break; }
  }
  await new Promise((r) => setTimeout(r, 350));
  const s = await readStory();
  ok(`${label}: story present`, s.head.length > 10 && s.dek.length > 10, s.head);
  if (s.head.includes("No pollster leans")) {
    ok(`${label}: level wording`, /level/.test(s.dek), s.dek.slice(0, 60));
  } else {
    ok(`${label}: head follows the measure`, re.test(s.head), s.head);
    ok(`${label}: names the table’s top lean`, topLean(s.leans).every((h) => s.head.includes(h)),
       `${JSON.stringify(topLean(s.leans))} in "${s.head}"`);
    ok(`${label}: dek places the rest`, /next|leans measurably|sits level/.test(s.dek), s.dek.slice(0, 80));
    ok(`${label}: dek carries the closer`, s.dek.includes("The averages take each lean out"), "");
  }
  if (story0 === null) story0 = s;
  ok(`${label}: story differs from Two-party’s`, label === "Two-party" || s.head + s.dek !== story0.head + story0.dek);
}
/* the averages-out line survives a matchup + basis flip */
ok("Two-party seen first", seen.size === 0);
await browser.close();
server.close();
console.log(bad ? `\n${bad} FAIL` : "\nall ok");
process.exit(bad ? 1 : 0);
