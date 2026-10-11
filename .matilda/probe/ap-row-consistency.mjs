// Pins the All-polls table's cross-facet row consistency (2026-10-11, the
// user's "improve the design of the all polls table rows, particularly the
// confidence facet ... should the even/neutral lines occupy the same
// position ... should 'Unsure' and 'Right direction or wrong track, %' sit
// at the same height ... is '100 = neutral; NAB drawn +100' as good as it
// can be"). Desktop widths 1440/1280/1100/1024/860, every facet:
//   1. every label on the head's last line (column names, a strip's ticks,
//      Direction's caption) on ONE baseline, and the head's upper line too;
//   2. no two head labels on a line closer than 4px (1001-1279px drew the
//      leaders' nets over the strip, Net over the chevron, "120CHANGE");
//   3. each view's first figure column at the same x (2PP sat 8px left);
//   4. no row cell drawing over its neighbour (text extents, the strip's
//      inner box);
//   5. from 1280px, Leadership's Even, Demographics' Even and Confidence's
//      Neutral on one x (the 2PP average keeps its own, by design);
//   6. Confidence: its head names the two directions (no "NAB drawn"), its
//      Change ends the row beside the chevron, NAB rows say "net balance";
//   7. Direction: Unsure's figure on Right's baseline, a two-answer reading
//      (SEC Newgate) a dash, not a 0, and a half-point move its decimal.
// Phones (390/320): one tick-line baseline across facets' pinned heads, every
// head label inside its head, the
// Confidence card's change printed once, NAB's "net balance", the summary
// line a sentence (not a flex row of gapped cells), and no sideways scroll.
// Served over HTTP: file:// blocks the webfonts and the metrics drift.
// Run: node .matilda/probe/ap-row-consistency.mjs
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

let puppeteer;
for (const base of [process.cwd(), homedir()]) {
  try { puppeteer = createRequire(join(base, "package.json"))("puppeteer-core"); break; } catch { /* next */ }
}
if (!puppeteer) { console.error("puppeteer-core not resolvable"); process.exit(2); }

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".json": "application/json", ".css": "text/css", ".woff2": "font/woff2", ".svg": "image/svg+xml", ".png": "image/png" };
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p.endsWith("/")) p += "index.html";
    let f = join(ROOT, p);
    try { if ((await stat(f)).isDirectory()) f = join(f, "index.html"); } catch { /* 404 below */ }
    const body = await readFile(f);
    res.writeHead(200, { "content-type": MIME[extname(f)] || "application/octet-stream" });
    res.end(body);
  } catch { res.writeHead(404); res.end("nf"); }
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://127.0.0.1:${server.address().port}/allpolls/`;

const FACETS = [["twopp", ""], ["primary", "p"], ["leadership", "l"], ["direction", "d"], ["issues", "i"], ["demographics", "g"], ["confidence", "c"]];
let fails = 0;
const check = (ok, msg, info) => { if (!ok) fails++; console.log(`${ok ? "ok  " : "FAIL"}  ${msg}${info != null ? " — " + info : ""}`); };

const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new" });

/* in-page measurement of one facet's head and first rows */
const measure = (phone) => {
  const near = (a, b, t) => Math.abs(a - b) <= t;
  const head = document.querySelector(phone ? ".rd-ap-phead" : ".rd-ap-hrow");
  head.scrollIntoView({ behavior: "instant", block: "center" });
  const top = head.getBoundingClientRect().top;
  const bl = (n) => { const s = document.createElement("span"); s.style.cssText = "display:inline-block;width:0;height:0;vertical-align:baseline"; n.appendChild(s); const y = s.getBoundingClientRect().top; s.remove(); return y - top; };
  const ext = (n) => { const r = document.createRange(); r.selectNodeContents(n); const b = r.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom }; };
  const labs = [...head.querySelectorAll(".rd-ap-th, .rd-ap-tk, .rd-ap-cap, .rd-ap-scl, .rd-ap-scr, .rd-ap-imaph > span")]
    .filter((n) => n.getBoundingClientRect().width > 0 && getComputedStyle(n).visibility !== "hidden")
    .map((n) => ({ txt: n.textContent.trim().replace(/\s+/g, " "), base: bl(n), ...ext(n) }));
  const zero = (r) => { const a = r.querySelector(".rd-ap-pic .rd-ap-avg"); if (!a) return null; const b = a.getBoundingClientRect(); return b.left + b.width / 2; };
  const rows = [...document.querySelectorAll(phone ? ".rd-ap-card" : ".rd-ap-row")].slice(0, 40);
  // a row's cells as drawn extents: text by Range, a strip by its inner box
  const cellsOf = (r) => [...r.children].filter((c) => !c.matches(".rd-ap-chev") && getComputedStyle(c).visibility !== "hidden" && c.getBoundingClientRect().width > 0).map((c) => {
    const inner = c.matches(".rd-ap-pic") ? c.querySelector(".rd-ap-in, .rd-ap-dbar") : null;
    if (inner) { const b = inner.getBoundingClientRect(); return { k: "pic", l: b.left, r: b.right }; }
    if (!c.textContent.trim()) return null;
    // the drawn extent: each text run, cut to any ancestor (up to the cell)
    // that clips it - an ellipsised pollster name ends at its box
    let l = Infinity, rr = -Infinity;
    const tw = document.createTreeWalker(c, NodeFilter.SHOW_TEXT);
    for (let t = tw.nextNode(); t; t = tw.nextNode()) {
      if (!t.textContent.trim()) continue;
      const g = document.createRange(); g.selectNodeContents(t);
      let { left, right } = g.getBoundingClientRect();
      for (let a = t.parentElement; a; a = a === c ? null : a.parentElement) {
        if (getComputedStyle(a).overflowX !== "visible") { const b = a.getBoundingClientRect(); left = Math.max(left, b.left); right = Math.min(right, b.right); }
      }
      if (right > left) { l = Math.min(l, left); rr = Math.max(rr, right); }
    }
    return l < rr ? { k: c.className || c.tagName, l, r: rr } : null;
  }).filter(Boolean);
  const rowM = rows.map((r) => {
    const chev = r.querySelector(".rd-ap-chev");
    return { txt: r.textContent.replace(/\s+/g, " ").slice(0, 60), zero: zero(r), cells: phone ? [] : cellsOf(r), chevL: chev ? chev.getBoundingClientRect().left : null };
  });
  const firstCol = phone ? null : head.children[4].getBoundingClientRect().left - head.getBoundingClientRect().left;
  const hb = head.getBoundingClientRect();
  return { labs, rowM, firstCol, sw: document.scrollingElement.scrollWidth, cw: document.documentElement.clientWidth, H: hb.height, hl: hb.left, hr: hb.right };
};

for (const W of [1440, 1280, 1100, 1024, 860]) {
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: 1000 });
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e)));
  const per = {};
  for (const [id, l] of FACETS) {
    await page.goto(BASE + (l ? "?f=" + l : ""), { waitUntil: "networkidle0", timeout: 60000 });
    await page.waitForSelector(".rd-ap-hrow", { timeout: 20000 });
    await new Promise((r) => setTimeout(r, 400));
    const m = await page.evaluate(measure, false);
    per[id] = m;
    // 1. baselines: the head's last line and its upper line
    const lower = m.labs.filter((x) => x.base > m.H / 2), upper = m.labs.filter((x) => x.base <= m.H / 2);
    const spread = (xs) => (xs.length ? Math.max(...xs.map((x) => x.base)) - Math.min(...xs.map((x) => x.base)) : 0);
    check(spread(lower) <= 0.5, `@${W} ${id}: the head's last line stands on one baseline`, lower.map((x) => x.txt.slice(0, 12) + "@" + x.base.toFixed(1)).join(" "));
    check(spread(upper) <= 0.5, `@${W} ${id}: the head's upper line stands on one baseline`, upper.map((x) => x.txt.slice(0, 12) + "@" + x.base.toFixed(1)).join(" "));
    // 2. no crowding along either line
    for (const [name, line] of [["last", lower], ["upper", upper]]) {
      const s = [...line].sort((a, b) => a.l - b.l);
      const tight = [];
      // under a word space (~3.3px at 12px) two names read as one
      for (let i = 1; i < s.length; i++) if (s[i].l - s[i - 1].r < 4) tight.push(`${s[i - 1].txt}|${s[i].txt} ${(s[i].l - s[i - 1].r).toFixed(1)}px`);
      check(!tight.length, `@${W} ${id}: ${name}-line labels keep 4px apart`, tight.join("; ") || null);
    }
    // 4. no row cell over its neighbour
    const over = [];
    for (const r of m.rowM) {
      const s = [...r.cells].sort((a, b) => a.l - b.l);
      for (let i = 1; i < s.length; i++) if (s[i].l < s[i - 1].r - 0.5) over.push(`${r.txt.slice(0, 18)}: ${s[i - 1].k}/${s[i].k} by ${(s[i - 1].r - s[i].l).toFixed(1)}`);
      const last = s[s.length - 1];
      if (r.chevL != null && last && last.r > r.chevL + 0.5) over.push(`${r.txt.slice(0, 18)}: ${last.k} under the chevron by ${(last.r - r.chevL).toFixed(1)}`);
    }
    check(!over.length, `@${W} ${id}: no cell draws over its neighbour or the chevron`, over.slice(0, 3).join("; ") || null);
    check(m.sw <= m.cw, `@${W} ${id}: no sideways scroll`, `${m.sw} v ${m.cw}`);
  }
  // 3. one first-figure-column x
  const fc = Object.fromEntries(Object.entries(per).map(([k, v]) => [k, +v.firstCol.toFixed(1)]));
  check(Math.max(...Object.values(fc)) - Math.min(...Object.values(fc)) <= 0.5, `@${W}: every view's first figure column starts at one x`, JSON.stringify(fc));
  // 5. the shared zero line, from 1280px
  if (W >= 1280) {
    const z = ["leadership", "demographics", "confidence"].map((k) => per[k].rowM.find((r) => r.zero != null)?.zero);
    check(z.every((v) => v != null) && Math.max(...z) - Math.min(...z) <= 1, `@${W}: Leadership's Even, Demographics' Even and Confidence's Neutral share one x`, z.map((v) => v && v.toFixed(1)).join(" / "));
  }
  // 6. Confidence's head and rows
  await page.goto(BASE + "?f=c", { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 400));
  const c = await page.evaluate(() => {
    const head = document.querySelector(".rd-ap-hrow");
    const rows = [...document.querySelectorAll(".rd-ap-row")];
    const nab = rows.filter((r) => /^NAB/.test(r.textContent.trim()));
    const ends = rows.slice(0, 30).map((r) => {
      const v = r.querySelector(".rd-ap-val"), ch = r.querySelector(".rd-ap-chev");
      const g = document.createRange(); g.selectNodeContents(v);
      return ch.getBoundingClientRect().left - g.getBoundingClientRect().right;
    });
    return {
      headTxt: head.textContent,
      lastCell: rows[0] ? [...rows[0].children].filter((x) => !x.matches(".rd-ap-chev")).pop().className : null,
      gaps: ends,
      nabN: nab.length, nabSub: nab.filter((r) => /net balance/.test(r.querySelector(".rd-ap-fig").textContent)).length,
      endLines: rows.slice(0, 30).filter((r) => r.querySelectorAll(".rd-ap-pic .rd-ap-gl").length !== 2).length,
    };
  });
  check(/◀ Pessimistic/.test(c.headTxt) && /Optimistic ▶/.test(c.headTxt) && !/NAB drawn/.test(c.headTxt), `@${W} confidence: the head names the two directions, no "NAB drawn" formula`);
  check(c.lastCell === "rd-ap-val" && Math.max(...c.gaps) <= 12, `@${W} confidence: Change is the row's last cell, ending beside the chevron`, `gap ≤ ${Math.max(...c.gaps).toFixed(1)}px`);
  check(c.nabN > 0 && c.nabSub === c.nabN, `@${W} confidence: every NAB row names its figure a net balance`, `${c.nabSub}/${c.nabN}`);
  check(c.endLines === 0, `@${W} confidence: the strip rules its inner ticks only (60, 80), never the ends`);
  // 7. Direction's three shares on one line, and a two-answer reading's dash
  await page.goto(BASE + "?f=d", { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 400));
  const d = await page.evaluate(() => {
    const bl = (n) => { const s = document.createElement("span"); s.style.cssText = "display:inline-block;width:0;height:0;vertical-align:baseline"; n.prepend(s); const y = s.getBoundingClientRect().top; s.remove(); return y; };
    const rows = [...document.querySelectorAll(".rd-ap-row")];
    const bad = [], sec = [];
    for (const r of rows) {
      const n = r.querySelectorAll(".rd-ap-dnum");
      if (n.length !== 3) continue;
      const b = [...n].map((x) => bl(x.firstElementChild));
      if (Math.max(...b) - Math.min(...b) > 0.5) bad.push(r.textContent.slice(0, 30) + " " + b.map((v) => v.toFixed(1)).join("/"));
      if (/^SEC Newgate/.test(r.textContent.trim())) sec.push(n[2].firstElementChild.textContent);
    }
    // the bundle's half-point moves (Roy Morgan prints halves) against the
    // change subs drawn: a non-integer move must show its decimal
    const D = window.AUSPOL || {};
    const halves = [...(D.individualPolls || []), ...(D.directionOnlyPolls || [])]
      .filter((p) => p.dir && p.dir.chg && ["right", "wrong", "unsure"].some((k) => p.dir.chg[k] != null && !Number.isInteger(p.dir.chg[k]))).length;
    const decSubs = rows.filter((r) => [...r.querySelectorAll(".rd-ap-dnum .rd-ap-sub")].some((x) => /[▲▼] \d+\.\d/.test(x.textContent))).length;
    return { bad, sec, n: rows.length, halves, decSubs };
  });
  check(!d.bad.length, `@${W} direction: Right, Wrong and Unsure figures share one baseline in every row`, d.bad.slice(0, 2).join("; ") || `${d.n} rows`);
  check(d.sec.length > 0 && d.sec.every((t) => t === "—"), `@${W} direction: SEC Newgate's two-answer readings print a dash for Unsure`, JSON.stringify(d.sec));
  check(d.halves > 0 && d.decSubs > 0, `@${W} direction: half-point moves print their decimal ("▲ 0.5"), not a rounded whole point`, `${d.halves} half-point readings in the bundle, ${d.decSubs} rows showing one`);
  check(!errs.length, `@${W}: no page errors`, errs.join("; ") || null);
  await page.close();
}

for (const W of [390, 320]) {
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: 900, isMobile: true, hasTouch: true });
  const base = {};
  for (const [id, l] of FACETS) {
    await page.goto(BASE + (l ? "?f=" + l : ""), { waitUntil: "networkidle0", timeout: 60000 });
    await page.waitForSelector(".rd-ap-phead", { timeout: 20000 });
    await new Promise((r) => setTimeout(r, 400));
    const m = await page.evaluate(measure, true);
    const lower = m.labs.filter((x) => x.base > m.H / 2);
    base[id] = lower.map((x) => +x.base.toFixed(1));
    check(m.sw <= m.cw, `@${W} ${id}: no sideways scroll`, `${m.sw} v ${m.cw}`);
    // every label inside the head (Direction's caption ran 17px past it at 320)
    const out = m.labs.filter((x) => x.l < m.hl - 0.5 || x.r > m.hr + 0.5);
    check(!out.length, `@${W} ${id}: every head label stays inside the head`, out.map((x) => `${x.txt} ${x.l.toFixed(0)}–${x.r.toFixed(0)} v ${m.hl.toFixed(0)}–${m.hr.toFixed(0)}`).join("; ") || null);
  }
  const all = Object.values(base).flat();
  check(Math.max(...all) - Math.min(...all) <= 0.5, `@${W}: every facet's pinned head puts its tick line on one baseline`, JSON.stringify(Object.fromEntries(Object.entries(base).map(([k, v]) => [k, [...new Set(v)]]))));
  await page.goto(BASE + "?f=c", { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 400));
  const c = await page.evaluate(() => {
    const cards = [...document.querySelectorAll(".rd-ap-card")];
    return {
      n: cards.length,
      dupe: cards.filter((x) => /on last$/.test((x.querySelector(".rd-ap-c2")?.textContent || "").trim())).length,
      once: cards.filter((x) => (x.textContent.match(/on last/g) || []).length <= 1).length,
      nab: cards.filter((x) => /^NAB/.test(x.textContent.trim())).map((x) => /net balance/.test(x.querySelector(".rd-ap-c2").textContent)),
      heights: [...new Set(cards.map((x) => +x.getBoundingClientRect().height.toFixed(2)))],
      csubFlex: [...document.querySelectorAll(".rd-ap-csub")].filter((x) => getComputedStyle(x).display === "flex").length,
    };
  });
  check(c.dupe === 0 && c.once === c.n, `@${W} confidence: each card prints its change once`, `${c.n} cards`);
  check(c.nab.length > 0 && c.nab.every(Boolean), `@${W} confidence: NAB cards carry "net balance" under the figure`);
  check(c.heights.length === 1 && c.heights[0] === 122, `@${W} confidence: one card height, the 122px floor`, JSON.stringify(c.heights));
  check(c.csubFlex === 0, `@${W} confidence: the summary line is a sentence, not a gapped flex row`);
  await page.goto(BASE + "?f=d", { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 400));
  const d = await page.evaluate(() => ({
    flex: [...document.querySelectorAll(".rd-ap-csub")].filter((x) => getComputedStyle(x).display === "flex").length,
    sec: [...document.querySelectorAll(".rd-ap-card")].filter((x) => /^SEC Newgate/.test(x.textContent.trim())).map((x) => x.querySelector(".rd-ap-csub").textContent),
  }));
  check(d.flex === 0, `@${W} direction: the summary line is a sentence, not a gapped flex row`);
  check(d.sec.length > 0 && d.sec.every((t) => !/unsure/.test(t)), `@${W} direction: SEC Newgate's cards name no unsure share`, JSON.stringify(d.sec.slice(0, 1)));
  await page.close();
}

await browser.close();
server.close();
console.log(fails ? `\n${fails} CHECK(S) FAILED` : "\nALL CHECKS PASSED");
process.exit(fails ? 1 : 0);
