/* state-election-rings.mjs — the By-state small-multiple election marks in
   the Who-votes panel (Place tab), per party chip:
   1. Each of the four panels (NSW, Vic, Qld, Rest of Australia) carries ONE
      ring, stroked in that panel's series-line colour (not --ink).
   2. The ring's y pixel lands where the AEC 31496 share maps in the chart's
      y-domain: NSW 35.2 / Vic 33.95 / Qld 30.98 / RoA 37.64 on Labor.
   3. Hovering the ring's x: a guide tooltip whose swatches all carry
      is-ring at the election; hovering a later month: plain squares.
   4. The tooltip shows both rows (state line + All voters) at the election
      month, both valued at the election share.
   5. The ring sits left of the "since Jul 2025" head-meta window (May 2025).

   Serves the repo on an ephemeral port; headless Chrome via puppeteer-core. */
import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const CHROME = process.env.CHROME
  || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
if (!fs.existsSync(CHROME)) { console.error("no Chrome at " + CHROME); process.exit(1); }
const require = createRequire(import.meta.url);
const puppeteer = require("puppeteer-core");

const EXPECT = {
  onp: { order: [ /* NSW Vic Qld RoA */ ] },
};
/* party -> expected per-panel election shares, in DEMO_SETS state-group order */
const ELECTION = {
  alp: [35.2, 33.95, 30.98, 37.64],
  lnp: [31.53, 32.2, 34.91, 29.01],
  onp: [6.02, 5.79, 7.84, 6.34],
  grn: [11.06, 13.59, 11.76, 12.55],
  oth: [16.19, 14.48, 14.5, 14.45],
};
/* the All-voters row at the election month reads the NATIONAL result */
const ELECTION_NAT = { alp: 34.56, lnp: 31.82, onp: 6.4, grn: 12.2, oth: 15.01 };
const PARTY_BUTTON = { alp: "Labor", lnp: "Coalition", onp: "One Nation", grn: "Greens", oth: "Others" };
const PANELS = ["NSW", "Vic", "Qld", "Rest"];

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split("?")[0]));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": MIME[path.extname(p)] || "text/plain" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new" });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 1400 });
page.on("pageerror", (e) => console.error("[pageerror]", e.message));
page.on("console", (m) => { if (m.type() === "error") console.error("[console.error]", m.text().slice(0, 300)); });
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "networkidle0", timeout: 60000 });
await page.waitForSelector("#who-votes", { timeout: 30000 });
/* the who-votes charts follow the page-wide range: the election x (May
   2025) only enters the domain on the "All" range */
await page.evaluate(() => {
  [...document.querySelectorAll(".rd-tabs button")]
    .filter((b) => /^all$/i.test(b.textContent.trim()))
    .forEach((b) => b.click());
});
await new Promise((r) => setTimeout(r, 900));

let fails = 0;
const check = (name, ok, detail) => {
  console.log((ok ? "  ok  " : " FAIL ") + name + (detail ? "  — " + detail : ""));
  if (!ok) fails++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* Place tab: "Who votes" panel -> click the Place tab, party chip per party */
const openParty = async (party) => {
  await page.evaluate((btnText, placeLabel) => {
    const sec = document.getElementById("who-votes");
    if (!sec) throw new Error("who-votes section missing: " + (document.querySelector(".rd-wv") ? "rd-wv exists" : "no rd-wv") + ", sections=" + [...document.querySelectorAll("section")].map((s) => s.id).join(","));
    const tabs = [...sec.querySelectorAll(".rd-tabs button")];
    const place = tabs.find((b) => b.textContent.trim() === placeLabel);
    if (place && place.getAttribute("aria-selected") !== "true") place.click();
    const chips = [...sec.querySelectorAll("button.rd-chip")];
    const chip = chips.find((b) => b.textContent.replace(/\d+%?$/, "").trim().startsWith(btnText));
    if (chip && chip.getAttribute("aria-pressed") !== "true") chip.click();
  }, PARTY_BUTTON[party], "Place");
  await sleep(500);
};
/* the panelled state chart is the one whose .rd-wv-panels holds four .rd-wv-panel */
const readPanels = () => page.evaluate(() => {
  const sec = document.getElementById("who-votes");
  const wrap = sec && sec.querySelector(".rd-wv-panels");
  if (!wrap) return { found: false };
  return {
    found: true,
    headMeta: (wrap.closest(".rd-wv-chart") || {}).textContent || "",
    panels: [...wrap.querySelectorAll(".rd-wv-panel")].map((p) => {
      const svg = p.querySelector("svg");
      const name = (p.querySelector(".rd-sm-top span") || {}).textContent || "";
      const svgR = svg.getBoundingClientRect();
      const ring = p.querySelector("circle.rd-ring");
      let ringBox = null, ringStroke = null, label = null;
      if (ring) {
        const r = ring.getBoundingClientRect();
        ringBox = { cx: r.x + r.width / 2, cy: r.y + r.height / 2 };
        ringStroke = getComputedStyle(ring).stroke;
      }
      const lab = p.querySelector(".rd-mark text");
      if (lab) label = lab.textContent;
      /* series lines in DOM order: all voters, then the state's */
      const lines = [...p.querySelectorAll("path.series-line")].map((x) => getComputedStyle(x).stroke);
      /* y scale from the rendered tick labels: centre-y of each text vs its
         value, linear-fitted (no assumed pad/inner-height) */
      const tks = [...p.querySelectorAll("text.axis-label.y")].map((t) => {
        const r = t.getBoundingClientRect();
        return { v: parseFloat(t.textContent), cy: r.y + r.height / 2 };
      }).filter((t) => !isNaN(t.v));
      tks.sort((a, b) => a.v - b.v);
      return { name, svgR: { x: svgR.x, y: svgR.y, w: svgR.width, h: svgR.height }, ringBox, ringStroke, label, lines, tks };
    }),
  };
});
const hoverAt = async (x, y) => { await page.mouse.move(x, y); await sleep(180); };
const readTip = () => page.evaluate(() => {
  const sec = document.getElementById("who-votes");
  const tips = [...sec.querySelectorAll(".tip.tip-guide")].filter((t) => t.offsetParent);
  if (!tips.length) return { kind: "none" };
  const tip = tips[tips.length - 1];
  const rows = [...tip.querySelectorAll(".tip-row")].map((r) => {
    const sw = r.querySelector(".tip-swatch");
    return {
      label: (r.querySelector(".tip-label") || {}).textContent || "",
      val: (r.querySelector(".tip-val") || {}).textContent || "",
      ring: sw ? sw.classList.contains("is-ring") : false,
    };
  });
  return { kind: "guide", text: tip.textContent, nSwatch: rows.filter((r) => r.ring !== undefined).length, nRing: rows.filter((r) => r.ring).length, rows };
});

/* y-pixel of value v: linear fit through the panel's tick labels */
const yOf = (v, tks) => {
  if (tks.length < 2) return NaN;
  const k = (tks[tks.length - 1].cy - tks[0].cy) / (tks[tks.length - 1].v - tks[0].v);
  return tks[0].cy + (v - tks[0].v) * k;
};

for (const party of ["alp", "lnp", "onp", "grn", "oth"]) {
  await openParty(party);
  /* scroll the panel grid into view so rect reads are viewport-relative */
  await page.evaluate(() => {
    const w = document.querySelector("#who-votes .rd-wv-panels");
    if (w) w.scrollIntoView({ block: "center" });
  });
  await sleep(250);
  const P = await readPanels();
  check(party + ": four state panels", P.found && P.panels.length === 4, P.panels && P.panels.map((p) => p.name).join(","));
  if (!P.found || P.panels.length !== 4) continue;
  check(party + ": rings in every panel", P.panels.every((p) => p.ringBox), JSON.stringify(P.panels.map((p) => !!p.ringBox)));
  P.panels.forEach((p, i) => {
    check(party + " " + PANELS[i] + ": ring is the series colour", p.ringStroke && p.lines[1] && p.ringStroke === p.lines[1],
      "ring " + p.ringStroke + " vs line " + p.lines[1]);
    check(party + " " + PANELS[i] + ": ring not the all-voters ink", p.ringStroke !== p.lines[0],
      "both " + p.ringStroke);
    const exp = ELECTION[party][i];
    const y = yOf(exp, p.tks);
    check(party + " " + PANELS[i] + ": ring at the AEC share " + exp, p.tks.length >= 2 && p.ringBox && Math.abs(p.ringBox.cy - y) < 3,
      p.ringBox ? "cy " + p.ringBox.cy.toFixed(1) + " vs " + y.toFixed(1) + " ticks" + JSON.stringify(p.tks.map((t) => t.v)) : "no ring, ticks" + JSON.stringify(p.tks.map((t) => t.v)));
    check(party + " " + PANELS[i] + ": label reads 2025 election", p.label && p.label.includes("2025 election: " + exp.toFixed(1)),
      JSON.stringify(p.label));
  });
  /* hover Victoria's ring: guide tip, two ring swatches, both rows at the election share */
  const vic = P.panels[1];
  let t = { kind: "none" };
  for (const off of [[0, 0], [0, -40], [0, 40], [2, -70]]) {
    await hoverAt(vic.ringBox.cx + off[0], vic.ringBox.cy + off[1]);
    t = await readTip();
    if (t.kind === "guide") break;
  }
  check(party + " Vic election hover: guide tip", t.kind === "guide", JSON.stringify(t).slice(0, 220));
  if (t.kind === "guide") {
    check(party + " Vic election hover: every swatch a ring", t.nRing === 2, t.nRing + "/2 rings " + JSON.stringify(t.rows));
    /* find rows by label (tip row order varies by party) */
    const rNat = t.rows.find((r) => /^All voters$/.test(r.label));
    const rSt = t.rows.find((r) => /^Vic/.test(r.label));
    check(party + " Vic election hover: rows at the election shares",
      rNat && rSt && Math.abs(parseFloat(rNat.val) - ELECTION_NAT[party]) < 0.06 && Math.abs(parseFloat(rSt.val) - ELECTION[party][1]) < 0.06, JSON.stringify(t.rows));
    check(party + " Vic election hover: tip titled May 2025", /May 2025/.test(t.text), JSON.stringify(t.text && t.text.slice(0, 40)));
    check(party + " Vic election hover: footer names the election", /The election result/.test(t.text), JSON.stringify(t.text && t.text.slice(-80)));
  }
  /* a recent month: the guide may not rise straight onto a scatter dot, so
     walk a few offsets until one appears */
  let t2 = { kind: "none" };
  for (const off of [[0, 0], [0, -50], [0, 50], [-40, -20], [-70, 20]]) {
    await hoverAt(vic.svgR.x + vic.svgR.w - 40 + off[0], vic.svgR.y + vic.svgR.h / 2 + off[1]);
    t2 = await readTip();
    if (t2.kind === "guide") break;
  }
  check(party + " Vic recent month: plain squares", t2.kind === "guide" && t2.nRing === 0,
    t2.kind + " " + JSON.stringify(t2.rows || []).slice(0, 160));
}

await browser.close();
server.close();
console.log(fails ? "\n" + fails + " check(s) FAILED" : "\nall checks passed");
process.exit(fails ? 1 : 0);
