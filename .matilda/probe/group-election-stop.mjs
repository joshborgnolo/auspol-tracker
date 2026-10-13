/* group-election-stop.mjs — the Primary-vote panel's GROUP VIEW election
   stop: with a counted group selected (Provincial, Rural, Inner metro,
   NSW), hovering an election ring must tip THE COUNT itself ("The election
   result", ring swatches, the group's own counted figures) — not the first
   month polled. The stop is indexed 0 on the spine; titles/rows sit one
   index back. Also: the all-voters view and the recent-month hover keep
   their plain-square behaviour (election-ring.mjs pins those; this probe
   is its group-mode sibling). Serves the repo (BASE env overrides the
   tree — the worktree fix's probe loop uses it). */
import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = process.env.BASE ? path.resolve(process.env.BASE)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
if (!fs.existsSync(CHROME)) { console.error("no Chrome at " + CHROME); process.exit(1); }
const require = createRequire(import.meta.url);
const puppeteer = require.resolve("puppeteer-core")
  ? require("puppeteer-core") : require("/Users/joshuaborgnolo/auspol tracker/node_modules/puppeteer-core");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
const server = http.createServer((req, res) => {
  let p = path.join(ROOT, decodeURIComponent(req.url.split("?")[0]));
  if (fs.existsSync(p) && fs.statSync(p).isDirectory() && fs.existsSync(path.join(p, "index.html"))) p = path.join(p, "index.html");
  if (!p.startsWith(path.resolve(ROOT)) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": MIME[path.extname(p)] || "text/plain" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new" });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 1500 });
page.on("pageerror", (e) => console.error("[pageerror]", e.message));
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "networkidle0", timeout: 60000 });
await sleep(1200);

let fails = 0;
const check = (name, ok, detail) => {
  console.log((ok ? "  ok  " : " FAIL ") + name + (detail ? "  — " + detail : ""));
  if (!ok) fails++;
};

/* every range tab group to "All" so the 2025-05 election x is in view */
await page.evaluate(() => {
  [...document.querySelectorAll(".rd-tabs button")]
    .filter((b) => /^all$/i.test(b.textContent.trim()))
    .forEach((b) => b.click());
});
await sleep(600);

const pickGroup = async (label) => page.evaluate((want) => {
  const sel = document.querySelector("#primary-vote select");
  const opt = [...sel.options].find((o) => o.textContent.trim() === want || o.value === want)
    || (want === "" ? [...sel.options].find((o) => o.value === "") : null);
  if (!opt) throw new Error("no option " + JSON.stringify(want));
  sel.value = opt.value;
  sel.dispatchEvent(new Event("change", { bubbles: true }));
}, label).then(() => sleep(700));

const scrollPv = () => page.evaluate(() => document.getElementById("primary-vote")
  .scrollIntoView({ block: "center" })).then(() => sleep(900)); // smooth-scroll settle

const readRings = () => page.evaluate(() => {
  const sec = document.getElementById("primary-vote");
  return [...sec.querySelectorAll("circle.rd-ring")].map((c) => {
    const r = c.getBoundingClientRect();
    return { sx: r.x + r.width / 2, sy: r.y + r.height / 2 };
  }).filter((r) => r.sx > 0 || r.sy > 0);
});

const readTip = () => page.evaluate(() => {
  const tip = document.querySelector("#primary-vote .tip.tip-guide");
  if (!tip) return { kind: "none" };
  const s = getComputedStyle(tip);
  if (s.display === "none" || s.visibility === "hidden" || parseFloat(s.opacity || "1") <= 0) return { kind: "none" };
  const rows = [...tip.querySelectorAll(".tip-row")].map((r) => {
    const sw = r.querySelector(".tip-swatch");
    return {
      label: (r.querySelector(".tip-label") || {}).textContent || "",
      val: (r.querySelector(".tip-val") || {}).textContent || "",
      ring: sw ? sw.classList.contains("is-ring") : false,
      border: sw ? getComputedStyle(sw).borderTopColor : null,
    };
  });
  const title = tip.firstElementChild ? tip.firstElementChild.textContent : "";
  return { kind: "guide", title, text: tip.textContent, rows,
           nSwatch: rows.filter((r) => r.border).length,
           nRing: rows.filter((r) => r.ring).length };
});

const hoverAt = async (x, y) => { await page.mouse.move(x, y, { steps: 3 }); await sleep(220); };

/* hover a ring; if the pick went to a scatter siderail (the tip reads a poll),
   nudge along the ring's column until the guide tip shows */
const hoverElection = async (rings) => {
  for (const r0 of rings) {
    for (const off of [[0, 0], [0, -40], [0, 40], [2, -70], [-2, 70]]) {
      await hoverAt(r0.sx + off[0], r0.sy + off[1]);
      const t = await readTip();
      if (t.kind === "guide") return { t, at: [r0.sx + off[0], r0.sy + off[1]] };
    }
  }
  return { t: { kind: "none" } };
};

const chartBox = () => page.evaluate(() => {
  const r = document.querySelector("#primary-vote .chart-svg, #primary-vote svg").getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height };
});

/* counted 2025-05-03 first-prefs per group (gen-data DEMO_LOC_ELECTION /
   DEMO_STATE_ELECTION, order alp lnp onp grn oth — printed via parts.alp etc.) */
const GROUPS = [
  { label: "Provincial", exp: { alp: "35.2", lnp: "32.6", onp: "8.0", grn: "11.2", oth: "13.0" } },
  { label: "Rural", exp: { alp: "24.4", lnp: "37.7", onp: "8.9", grn: "8.4", oth: "20.6" } },
  { label: "Inner metro", exp: { alp: "38.4", lnp: "28.0", onp: "3.5", grn: "16.5", oth: "13.7" } },
  { label: "NSW", exp: null }, // state sums read out of the page itself (assert only the shape)
];

for (const [gi, g] of GROUPS.entries()) {
  await pickGroup(g.label);
  await scrollPv();
  const rings = gi === 0 && false ? [] : await readRings();
  check(g.label + ": five election rings drawn", rings.length === 5, rings.length + " ring(s)");
  if (rings.length !== 5) continue;
  const { t } = await hoverElection(rings);
  check(g.label + ": ring hover shows the guide tip", t.kind === "guide", JSON.stringify(t).slice(0, 220));
  check(g.label + ": ring hover tips the election row", t.text && /The election result/.test(t.text),
    t.text ? t.text.replace(/\s+/g, " ").slice(0, 120) : "no tip");
  check(g.label + ": ring hover title is the election month", t.title === "May 2025", JSON.stringify(t.title));
  check(g.label + ": ring hover swatches are all rings", t.nSwatch === 5 && t.nRing === 5,
    t.nRing + "/" + t.nSwatch + " rings");
  if (g.exp) {
    const vals = Object.fromEntries(t.rows.map((r) => [r.label, r.val]));
    const got = {
      alp: vals["Labor"], lnp: vals["Coalition"], onp: vals["One Nation"],
      grn: vals["Greens"], oth: vals["Others & independents"],
    };
    const bad = Object.keys(g.exp).filter((k) => got[k] !== g.exp[k]);
    check(g.label + ": tips the GROUP's counted figures, not the national row",
      bad.length === 0, JSON.stringify(got) + (bad.length ? " (want " + JSON.stringify(g.exp) + ")" : ""));
  } else {
    // the group is neither a national row nor the first month's polled figures
    const vals = t.rows.filter((r) => r.border).map((r) => r.val);
    check(g.label + ": tips the group's own counted row (not a poll row)",
      t.nRing === 5 && vals.length === 5 && vals.every((v) => /^\d+\.\d$/.test(v)),
      JSON.stringify(vals));
  }
  /* recent month → plain squares again */
  const box = await chartBox();
  await hoverAt(box.x + box.w - 46, box.y + box.h / 2);
  const tm = await readTip();
  check(g.label + ": recent month keeps plain swatches", tm.kind === "guide" && tm.nSwatch === 5 && tm.nRing === 0,
    tm.nRing + "/" + tm.nSwatch + " rings, title " + JSON.stringify(tm.title));
}

/* all voters is the pinned neighbour's job; here just round-trip it cleanly */
await pickGroup("");
await sleep(400);

await browser.close();
server.close();
console.log(fails ? "\n" + fails + " check(s) FAILED" : "\nall checks passed");
process.exit(fails ? 1 : 0);
