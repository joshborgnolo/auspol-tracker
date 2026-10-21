// Probe: every poll-dot tooltip carries the "Field" line. Covers the two
// surfaces the 2026-10-21 audit found bare: the vote-switching charts
// (RdSwitching came-from small multiples AND the cycled "going" views) and
// the Economic sentiment (confidence) chart, both its default term window
// and the complete-history view. Contract: .tip.tip-dot renders a .tip-row
// with .tip-label "Field" whenever gen-data ships a non-empty dateLabel on
// the dot's meta (engine: 08b413e7 :1026). Scratch only.
import http from "http";
import { readFileSync, existsSync } from "fs";
import { extname, join, normalize } from "path";
import puppeteer from "puppeteer-core";

const ROOT = process.cwd();
const PORT = 8143;
const MIME = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json",
               ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml",
               ".woff2": "font/woff2", ".xml": "application/xml" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p === "/") p = "/index.html";
  const f = normalize(join(ROOT, p));
  if (!f.startsWith(ROOT) || !existsSync(f)) { res.writeHead(404); return res.end("nf"); }
  res.writeHead(200, { "content-type": MIME[extname(f)] || "application/octet-stream" });
  res.end(readFileSync(f));
});
await new Promise((r) => server.listen(PORT, r));

const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage();
page.on("console", (m) => { if (m.type() === "error") console.log("[page-err]", m.text().slice(0, 200)); });
page.on("pageerror", (e) => console.log("[page-error]", String(e).slice(0, 300)));

const MON = /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/;
let pass = 0, fail = 0;
const check = (name, cond, extra = "") => { console.log((cond ? "OK   " : "FAIL ") + name + (extra ? "  " + extra : "")); cond ? pass++ : fail++; };

async function goto_(w) {
  await page.setViewport({ width: w, height: 950 });
  await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: "networkidle0", timeout: 60000 });
  await page.evaluate(() => {
    const t = [...document.querySelectorAll("button, a")].find((e) => /^\s*snapshot\s*$/i.test(e.textContent));
    if (t) t.click();
  });
  await new Promise((r) => setTimeout(r, 500)); // intentional-sleep: tab swap + RO-driven widths settle
}

// hover the newest scatter-dot in CARD (a chart card root element handle),
// return the card's tip rows. cardSel = "svgANY" picks the section's first
// svg that itself carries scatter dots.
async function tipRows(cardSel, secId) {
  const pos = await page.evaluate(({ cardSel, secId }) => {
    const sec = document.getElementById(secId) || document.querySelector(secId);
    let svg;
    if (cardSel === "svgANY") {
      if (!sec) return null;
      svg = [...sec.querySelectorAll("svg")].find((s) => s.querySelector("circle.scatter-dot"));
    } else {
      const card = sec && sec.querySelector(cardSel);
      svg = card && card.querySelector("svg");
    }
    if (!svg) return null;
    (svg.closest("div") || svg).scrollIntoView({ block: "center" });
    const dots = [...svg.querySelectorAll("circle.scatter-dot")];
    if (!dots.length) return null;
    const c = dots[dots.length - 1];
    const r = svg.getBoundingClientRect();
    const [vx, vy, vw, vh] = svg.getAttribute("viewBox").split(/\s+/).map(Number);
    return { x: r.left + ((+c.getAttribute("cx") - vx) / vw) * r.width,
             y: r.top + ((+c.getAttribute("cy") - vy) / vh) * r.height };
  }, { cardSel, secId });
  if (!pos) return null;
  await new Promise((r) => setTimeout(r, 150)); // intentional-sleep: scrollIntoView settle
  await page.mouse.move(pos.x, pos.y);
  await new Promise((r) => setTimeout(r, 220)); // intentional-sleep: tip-in fade + hover pick
  return page.evaluate(({ cardSel, secId }) => {
    const sec = document.getElementById(secId) || document.querySelector(secId);
    const tips = [...sec.querySelectorAll(".tip.tip-dot")];
    const tip = tips.find((t) => t.offsetParent !== null) || tips[tips.length - 1];
    if (!tip) return { none: true };
    return { title: tip.querySelector(".tip-title") ? tip.querySelector(".tip-title").textContent : "",
             rows: [...tip.querySelectorAll(".tip-row")].map((r) => ({
               label: (r.querySelector(".tip-label") || {}).textContent || "",
               val: (r.querySelector(".tip-val") || {}).textContent || "" })),
             sub: tip.querySelector(".tip-sub") ? tip.querySelector(".tip-sub").textContent : "" };
  }, { cardSel, secId });
}

function assertField(where, tip) {
  if (!tip) { check(where + ": chart/card not found", false); return; }
  if (tip.none) { check(where + ": no dot tip rendered on hover", false); return; }
  const field = tip.rows.find((r) => r.label === "Field");
  check(`${where}: dot tip carries a Field row (${field ? JSON.stringify(field.val) : "none"}; rows: ${tip.rows.map((r) => r.label + "=" + r.val).join(", ")})`,
        !!field && MON.test(field.val));
  const released = tip.rows.find((r) => /released|Released/.test(r.val) || /\|/.test(r.val));
  void released;
}

async function switching(labelWidth) {
  console.log(`-- switching panel, width ${labelWidth} --`);
  await goto_(labelWidth);
  const found = await page.evaluate(() => {
    const sec = document.querySelector("#switching");
    if (!sec) return { sec: false };
    sec.scrollIntoView({ block: "center" });
    return { sec: true, cards: sec.querySelectorAll(".rd-sm").length };
  });
  check(`#switching renders (${found.cards || 0} came-from cards)`, !!found.sec && found.cards >= 3);
  if (!found.sec) return;
  await new Promise((r) => setTimeout(r, 250)); // intentional-sleep: pinned-layout settle after scroll
  const idx = found.cards - 1;
  const tip1 = await tipRows(`.rd-sm:nth-of-type(1)`, "switching");
  assertField(`came-from card 1`, tip1);
  const tipN = await tipRows(`.rd-sm:nth-of-type(${idx + 1})`, "switching");
  assertField(`came-from card ${idx + 1}`, tipN);

  // cycle to the Coalition "going" view and probe its first chart's dots
  await page.evaluate(() => document.querySelector("#switching .rd-sw-cycle").click());
  await new Promise((r) => setTimeout(r, 500)); // intentional-sleep: view mount + glide settle
  const st = await page.evaluate(() => ({
    title: document.querySelector("#switching .rd-title").textContent,
    cards: document.querySelectorAll("#switching .rd-sm").length }));
  const onGo = /voters are going/.test(st.title);
  check(`cycler lands a going view («${st.title}», ${st.cards} charts)`, onGo && st.cards >= 2);
  if (onGo && labelWidth === 1280) {
    const tipG = await tipRows(`.rd-sm:nth-of-type(1)`, "switching");
    assertField(`going view card 1`, tipG);
  }
}

console.log("confidence section (term window then complete history), width 1280");
await goto_(1280);
const conf = await page.evaluate(() => {
  const sec = document.getElementById("confidence");
  if (!sec) return false;
  sec.scrollIntoView({ block: "center" });
  return !!sec.querySelector("svg");
});
check("#confidence renders", conf);
if (conf) {
  await new Promise((r) => setTimeout(r, 250)); // intentional-sleep: settle
  const tipC = await tipRows("svgANY", "confidence");
  assertField("confidence term view", tipC);
  const histOn = await page.evaluate(() => {
    const b = document.querySelector("#confidence .rd-confidence-hist");
    if (!b) return false;
    b.click();
    return true;
  });
  check("complete-history toggle found", histOn);
  if (histOn) {
    await new Promise((r) => setTimeout(r, 700)); // intentional-sleep: history view mount
    const sec = await page.evaluate(() => !!document.querySelector("#confidence svg"));
    if (sec) {
      const tipH = await tipRows("svgANY", "confidence");
      assertField("confidence complete history", tipH);
    }
  }
}

await switching(1280);
await switching(390);

await page.mouse.move(5, 5);
await browser.close();
server.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
