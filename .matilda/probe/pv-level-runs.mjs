/* pv-level-runs.mjs — the primary-vote panel's "Within the margin of
   uncertainty" treatment follows EVERY level run, not just the leader's.
   Born 2026-10-13: the band, the phone's tinted block and the dek named
   only the top tie, while the share card's ladder and the og:alt already
   walked the whole ranking (make-card.js, build.mjs cardAltOf). A level
   run: a party joins the group above it while the gap to that group's
   first party stays inside the two figures' combined 95% margins; a wider
   gap starts a fresh group. Pinned on the LIVE figures plus a SYNTHETIC
   page (the server rewrites the served latest.primary so the leader
   stands clear and 2nd/3rd tie - the case the site once couldn't show):
     desktop – one bracket band per tied run, covering exactly its columns
     phone   – one tinted block per tied run, singles' hairlines unbroken,
               8px air under an adjacent rest block
     dek     – every tied run names itself, "too close to separate"
   Usage: node .matilda/probe/pv-level-runs.mjs */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const ROOT = resolve(join(HERE, "../.."));
const PORT = 8977;
const MIME = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".css": "text/css" };

/* The synthetic primary line-up rewrites ONLY latest.primary (the figure
   the stat blocks and dek quote); the latest month's ci stays real, so
   the runs they form are the panel's honest verdict on those figures.
   Leader 30, then 25 v 24.5 (inside the two margins), 13.5 and 7 after. */
const SYNTH = { alp: 30, lnp: 25, grn: 13.5, onp: 24.5, oth: 7 };

let SYNTHETIC = false;
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p === "/") p = "/index.html";
    if (p.endsWith("/")) p += "index.html";
    let body = await readFile(join(ROOT, p));
    if (SYNTHETIC && p === "/index.html") {
      const html = body.toString("utf8");
      const s0 = html.indexOf("\n  const latest = ");
      const e0 = html.indexOf("\n  const ", s0 + 5);
      if (s0 < 0 || e0 < 0) throw new Error("const latest markers not found");
      const seg = html.slice(s0, e0);
      const obj = JSON.parse(seg.slice(seg.indexOf("{"), seg.lastIndexOf("}") + 1));
      obj.primary = { ...SYNTH };
      body = html.slice(0, s0) + "\n  const latest = " + JSON.stringify(obj) + ";" + html.slice(e0);
    }
    res.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" });
    res.end(body);
  } catch (e) { res.writeHead(404); res.end("nf"); }
});
await new Promise((r) => server.listen(PORT, r));
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new" });
let fails = 0;
const ok = (cond, msg) => { console.log(` ${cond ? "ok " : "FAIL"} ${msg}`); if (!cond) fails++; };

/* runsOf: the panel's own walk - sorted parts, margin-combined chaining */
const runsOf = (P, C) => {
  const parts = ["alp", "lnp", "grn", "onp", "oth"].map((id) => ({ id, v: P[id], ci: C[id] || 0 }))
    .sort((a, b) => b.v - a.v);
  const rs = [];
  parts.forEach((p) => {
    const r = rs[rs.length - 1];
    if (r && r[0].v - p.v < Math.sqrt(r[0].ci * r[0].ci + p.ci * p.ci)) r.push(p);
    else rs.push([p]);
  });
  return { parts, runs: rs, ties: rs.filter((r) => r.length >= 2) };
};
const NAMES = { alp: "Labor", lnp: "Coalition", grn: "Greens", onp: "One Nation", oth: "Others & independents" };

const readDesktop = () => {
  const D = window.AUSPOL;
  const P = D.latest.primary, C = (D.aggPrimary[D.aggPrimary.length - 1] || {}).ci || {};
  const stats = [...document.querySelectorAll("#primary-vote .rd-pv-stats .rd-pv-stat")].map((el) => {
    const r = el.getBoundingClientRect();
    return { t: el.getAttribute("title") || "", l: r.left, r: r.right };
  });
  const bands = [...document.querySelectorAll("#primary-vote .rd-pv-bracket")].map((el) => {
    const r = el.getBoundingClientRect();
    return { l: r.left, r: r.right, label: el.textContent.trim() };
  });
  const grab = (sel) => { const el = document.querySelector(sel); return el ? el.textContent : ""; };
  return { P, C, stats, bands, dek: grab("#primary-vote .rd-pv-head .rd-dek"), head: grab("#primary-vote .rd-pv-head h3") };
};
const readPhone = () => {
  const D = window.AUSPOL;
  const P = D.latest.primary, C = (D.aggPrimary[D.aggPrimary.length - 1] || {}).ci || {};
  const blocks = [...document.querySelectorAll("#primary-vote .rd-pv-list > div")].map((el) => {
    const r = el.getBoundingClientRect();
    return {
      cls: el.className.startsWith("rd-pv-group") ? "group" : "rest",
      label: (el.querySelector(".rd-pv-grouph") || { textContent: "" }).textContent.trim(),
      stats: [...el.querySelectorAll(".rd-pv-stat")].map((s) => s.getAttribute("title") || ""),
      top: r.top, bot: r.bottom,
    };
  });
  const grab = (sel) => { const el = document.querySelector(sel); return el ? el.textContent : ""; };
  return { P, C, blocks, dek: grab("#primary-vote .rd-pv-head .rd-dek"), head: grab("#primary-vote .rd-pv-head h3") };
};

async function checkPage(page, width, label) {
  const phone = width < 700;
  await page.setViewport({ width, height: 900, deviceScaleFactor: 2 });
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: "networkidle0", timeout: 60000 });
  const sel = phone ? "#primary-vote .rd-pv-list" : "#primary-vote .rd-pv-stats";
  try { await page.waitForSelector(sel, { timeout: 25000 }); }
  catch { fails++; console.log(`${label} ${width}px | stats never rendered`); return; }
  await page.evaluate(() => document.getElementById("primary-vote").scrollIntoView());
  await new Promise((r) => setTimeout(r, 700));
  const d = await page.evaluate(`(${phone ? readPhone.toString() : readDesktop.toString()})()`);
  const { parts, runs, ties } = runsOf(d.P, d.C);
  const shape = runs.map((r) => "[" + r.map((p) => p.id + " " + p.v).join(",") + "]").join(" ");
  console.log(`-- ${label} ${width}px | runs: ${shape}`);

  /* the dek names every tie exactly once: the leader's own sentence, and
     one for each tied run below it */
  const phrases = (d.dek.match(/too close to separate/g) || []).length;
  ok(phrases === ties.length, `dek: ${ties.length} tied run(s) => ${phrases} 'too close to separate'`);
  ok((runs[0].length >= 2) === / are level/.test(" " + d.head),
    `head: leader${runs[0].length >= 2 ? " names its tie" : " alone, no 'are level'"}`);
  const seq = parts.map((p) => NAMES[p.id]);

  if (!phone) {
    ok(d.stats.length === parts.length, `desktop: ${parts.length} stat columns`);
    ok(d.bands.length === ties.length, `desktop: ${ties.length} tied run(s) => ${d.bands.length} bracket band(s)`);
    let col = 0;
    runs.forEach((r, i) => {
      const start = col; col += r.length;
      if (r.length < 2) return;
      const b = d.bands[ties.indexOf(r)];
      const el = d.stats[start], er = d.stats[start + r.length - 1];
      ok(b && el && er && Math.abs(b.l - el.l) <= 2 && Math.abs(b.r - er.r) <= 2,
        `band ${i}: covers columns ${start + 1}-${start + r.length} (${b ? b.l.toFixed(1) + ".." + b.r.toFixed(1) : "none"} vs ${el && er ? el.l.toFixed(1) + ".." + er.r.toFixed(1) : "no stats"})`);
      ok(b && b.label === "Within the margin of uncertainty", `band ${i}: named 'Within the margin of uncertainty'`);
    });
    d.stats.forEach((s, i) => ok(s.t.includes(seq[i]), `column ${i + 1} is ${seq[i]}`));
  } else {
    const wantBlocks = runs.reduce((acc, r, i) => acc + (r.length >= 2 ? 1 : (i === 0 || runs[i - 1].length >= 2 ? 1 : 0)), 0);
    ok(d.blocks.length === wantBlocks, `phone: ${d.blocks.length} blocks for ${runs.length} runs (${wantBlocks} expected)`);
    ok(d.blocks.filter((b) => b.cls === "group").length === ties.length, `phone: ${ties.length} tinted block(s)`);
    const got = d.blocks.flatMap((b) => b.stats);
    ok(got.length === parts.length && got.every((t, i) => t.includes(seq[i])), "phone: stat order follows the ranking");
    d.blocks.forEach((b, i) => {
      if (b.cls === "group") ok(b.label === "Within the margin of uncertainty", `block ${i}: group box named`);
      if (i > 0) {
        const prev = d.blocks[i - 1];
        const gap = +(b.top - prev.bot).toFixed(1);
        /* 8px air only ever above a group that isn't first */
        ok(Math.abs(gap - (b.cls === "group" ? 8 : 0)) <= (b.cls === "group" ? 1 : 4),
          `block ${i}: ${b.cls} follows ${prev.cls} at ${gap}px`);
      }
    });
  }
}

for (const variant of ["live", "synthetic"]) {
  SYNTHETIC = variant === "synthetic";
  for (const width of [1280, 390]) {
    const page = await browser.newPage();
    try { await checkPage(page, width, variant); }
    catch (e) { fails++; console.log(`${variant} ${width}px | probe error: ${e.message}`); }
    await page.close();
  }
}
SYNTHETIC = false;
await browser.close();
server.close();
console.log(fails ? `\n${fails} FAILED` : "\nevery level run draws its band and names itself, live and synthetic");
process.exit(fails ? 1 : 0);
