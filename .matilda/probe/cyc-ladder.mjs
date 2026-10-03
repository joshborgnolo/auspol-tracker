/* probe-cyc-ladder: a Past-cycles summary row opens to every term ranked at
   this month (the strip unrolled) and the records at any point in a term.
   Asserts, at 1440 / 1024 / 768 / 390-touch: one panel at a time; the list
   holds every strip dot plus the sitting term, highest first; the sitting
   term's place agrees with the row's rank cell; on the desktop table each
   listed term's dot stands straight under its dot on the strip; Level ->
   Change re-ranks in place; a Compare pick changes the count; Enter/arrows
   from the keyboard; records lists sorted with the sitting term present;
   no page overflow; the old design untouched. */
import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const PORT = 9141;
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".woff2": "font/woff2", ".png": "image/png", ".svg": "image/svg+xml" };
const server = http.createServer(async (req, res) => {
  try {
    const p = join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/^\/+/, "") || "index.html");
    const body = await readFile(p.endsWith("/") ? p + "index.html" : p);
    res.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" }); res.end(body);
  } catch { res.writeHead(404); res.end("nf"); }
});
let fails = 0;
const check = (name, ok, detail = "") => { console.log((ok ? "PASS " : "FAIL ") + name + (detail ? " - " + detail : "")); if (!ok) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await new Promise((r) => server.listen(PORT, r));
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
try {
  for (const vw of [1440, 1024, 768, 390]) {
    const page = await browser.newPage();
    const errs = []; page.on("pageerror", (e) => errs.push(String(e)));
    const touch = vw <= 640;
    await page.setViewport({ width: vw, height: 900, isMobile: touch, hasTouch: touch });
    await page.goto(`http://127.0.0.1:${PORT}/#cycles`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector("#cyc-summary .rd-cs-row", { timeout: 45000 });
    await sleep(1400);
    const names = await page.$$eval("#cyc-summary .rd-cs-row", (rs) => rs.map((r) => r.querySelector(".rd-cs-name b").textContent.trim()));
    const W = vw + "px";

    /* read one open row's list, strip and rank */
    const read = () => page.evaluate(() => {
      const item = document.querySelector("#cyc-summary .rd-cs-item.open");
      if (!item) return null;
      const row = item.querySelector(".rd-cs-row"), csl = item.querySelector(".rd-csl");
      const lad = [...csl.querySelectorAll(".rd-csl-row")].map((el) => ({
        y: el.getBoundingClientRect().top, cur: el.classList.contains("cur"),
        who: el.querySelector(".rd-csl-name b").textContent, yr: el.querySelector(".rd-csl-yr").textContent,
        v: el.querySelector(".rd-csl-v").textContent.replace(/[≈\s]/g, "").replace("−", "-"),
        dotX: (() => { const d = el.querySelector(".rd-csl-dot").getBoundingClientRect(); return d.left + d.width / 2; })(),
      })).sort((a, b) => a.y - b.y);
      const stripDots = [...row.querySelectorAll(".rd-cs-dot:not(.out)")].map((d) => { const r = d.getBoundingClientRect(); return r.left + r.width / 2; });
      const curDot = row.querySelector(".rd-cs-cur"); const cr = curDot && curDot.getBoundingClientRect();
      const recs = [...csl.querySelectorAll(".rd-csr-list")].map((l) => ({
        h: l.querySelector(".rd-csr-h").textContent,
        rows: [...l.querySelectorAll(".rd-csr-row")].map((r) => ({ k: +r.querySelector(".rd-csl-k").textContent, cur: r.classList.contains("cur"),
          v: +r.querySelector(".rd-csr-v").textContent.replace("−", "-").replace("+", "") })),
      }));
      return { name: row.querySelector(".rd-cs-name b").textContent.trim(), expanded: row.getAttribute("aria-expanded"),
               rank: row.querySelector(".rd-cs-rank b") ? row.querySelector(".rd-cs-rank b").textContent : "",
               lad, stripDots, curX: cr ? cr.left + cr.width / 2 : null, recs,
               open: document.querySelectorAll("#cyc-summary .rd-csl").length,
               sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth };
    });
    const openRow = async (name) => {
      await page.evaluate((name) => {
        const r = [...document.querySelectorAll("#cyc-summary .rd-cs-row")].find((el) => el.querySelector(".rd-cs-name b").textContent.trim() === name);
        r.scrollIntoView({ behavior: "instant", block: "center" });
      }, name);
      await sleep(150);
      const el = await page.evaluateHandle((name) => [...document.querySelectorAll("#cyc-summary .rd-cs-row")].find((el) => el.querySelector(".rd-cs-name b").textContent.trim() === name), name);
      const box = await el.boundingBox();
      if (touch) await page.touchscreen.tap(box.x + 40, box.y + 14); else await page.mouse.click(box.x + 40, box.y + 14);
      await sleep(1100);
    };
    const expectPos = (rank, n) => {
      if (/^Highest/.test(rank)) return 1;
      if (/^Lowest/.test(rank)) return n;
      let mm = rank.match(/^(\d+)\w+ highest/); if (mm) return +mm[1];
      mm = rank.match(/^(\d+)\w+ lowest/); if (mm) return n - +mm[1] + 1;
      mm = rank.match(/^Middle of (\d+)/); if (mm) return null;
      return undefined;
    };

    for (const name of names) {
      await openRow(name);
      const s = await read();
      if (!s || s.name !== name) { check(`${W} ${name}: opens`, false, s ? "opened " + s.name : "nothing open"); continue; }
      check(`${W} ${name}: opens alone, aria-expanded`, s.open === 1 && s.expanded === "true", `panels ${s.open}`);
      check(`${W} ${name}: lists every strip term plus this one`, s.lad.length === s.stripDots.length + 1, `${s.lad.length} vs ${s.stripDots.length}+1`);
      const vals = s.lad.map((e) => +e.v.replace("+", ""));
      check(`${W} ${name}: highest first`, vals.every((v, i) => i === 0 || vals[i - 1] >= v - 1e-9));
      const pos = s.lad.findIndex((e) => e.cur) + 1, want = expectPos(s.rank, s.lad.length);
      check(`${W} ${name}: sitting term's place agrees with "${s.rank}"`, want === null || pos === want, `at ${pos}, want ${want}`);
      if (vw > 900) {
        /* the strip, unrolled: every past dot on the list sits under a strip dot */
        const off = s.lad.filter((e) => !e.cur).map((e) => Math.min(...s.stripDots.map((x) => Math.abs(x - e.dotX))));
        const cur = s.lad.find((e) => e.cur);
        check(`${W} ${name}: list dots stand under the strip's`, Math.max(...off) <= 1 && Math.abs(cur.dotX - s.curX) <= 1, `max off ${Math.max(...off).toFixed(2)}px, sitting ${Math.abs(cur.dotX - s.curX).toFixed(2)}px`);
      }
      for (const l of s.recs) {
        const top = l.rows.filter((r) => r.k <= 5).map((r) => r.v);
        const lo = /Lowest|below/.test(l.h);
        const sorted = top.every((v, i) => i === 0 || (lo ? top[i - 1] <= v : top[i - 1] >= v));
        check(`${W} ${name}: records "${l.h.slice(0, 22)}…" sorted, sitting term shown`, sorted && l.rows.some((r) => r.cur) && top.length === Math.min(5, top.length), `${l.rows.length} rows`);
      }
      check(`${W} ${name}: no page overflow`, s.sw <= s.cw, `${s.sw} > ${s.cw}`);
      if (/^L\/NP \+ ON/.test(name)) {
        /* the combined row sets the Coalition and One Nation against past
           COALITION oppositions only (user call 2026-10-04) */
        const coal = await page.evaluate(() => window.AP.D.cycles.filter((c) => !c.current && c.opp === "lnp").map((c) => String(c.year)));
        const past = s.lad.filter((e) => !e.cur).map((e) => e.yr);
        check(`${W} ${name}: only Coalition-opposition terms`, past.length > 0 && past.every((y) => coal.includes(y)), past.join(","));
      }
    }
    /* the chart link sits with the list's heading, never below the records */
    const lk = await page.evaluate(() => {
      const csl = document.querySelector("#cyc-summary .rd-csl"), go = csl && csl.querySelector(".rd-csl-go");
      const h = csl && csl.querySelector(".rd-csl-h"), first = csl && csl.querySelector(".rd-csl-row");
      if (!go || !h || !first) return null;
      const g = go.getBoundingClientRect(), hr = h.getBoundingClientRect(), fr = first.getBoundingClientRect(), cr = csl.getBoundingClientRect();
      /* the words themselves, not their grid cells (a cell stretches to its column) */
      const words = [];
      csl.querySelectorAll(".rd-csl-head > *:not(.rd-csl-go)").forEach((el) => {
        const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        for (let t = w.nextNode(); t; t = w.nextNode()) {
          if (!t.textContent.trim()) continue;
          const rg = document.createRange(); rg.selectNodeContents(t);
          [...rg.getClientRects()].forEach((q) => { if (q.width) words.push(q); });
        }
      });
      const overlaps = words.some((q) => q.right > g.left - 8 && q.left < g.right && q.bottom > g.top + 1 && q.top < g.bottom - 1);
      return { above: g.bottom <= fr.top + 0.5, right: Math.abs(g.right - cr.right) <= 1, overlaps, inLine: Math.abs(g.bottom - hr.bottom) <= 4 };
    });
    check(`${W} chart link sits by the list's heading, right-aligned, clear of the head's words`, lk && lk.above && lk.right && !lk.overlaps, JSON.stringify(lk));
    /* a second click closes */
    const last = names[names.length - 1];
    await openRow(last);
    check(`${W} same row again closes`, (await read()) === null);

    /* opening a row below an open one keeps the clicked row where it stood */
    await openRow(names[0]);
    const target = names[2];
    /* the open list above pushes the target below the fold: bring it up,
       then click it - its own top must not move while the list above shuts */
    await page.evaluate((name) => {
      const r = [...document.querySelectorAll("#cyc-summary .rd-cs-row")].find((el) => el.querySelector(".rd-cs-name b").textContent.trim() === name);
      window.scrollBy(0, r.getBoundingClientRect().top - 300);
    }, target);
    await sleep(400);
    const yBefore = await page.evaluate((name) => [...document.querySelectorAll("#cyc-summary .rd-cs-row")].find((el) => el.querySelector(".rd-cs-name b").textContent.trim() === name).getBoundingClientRect().top, target);
    const el2 = await page.evaluateHandle((name) => [...document.querySelectorAll("#cyc-summary .rd-cs-row")].find((el) => el.querySelector(".rd-cs-name b").textContent.trim() === name), target);
    const b2 = await el2.boundingBox();
    if (touch) await page.touchscreen.tap(b2.x + 40, b2.y + 14); else await page.mouse.click(b2.x + 40, b2.y + 14);
    await sleep(1200);
    const yAfter = await page.evaluate((name) => [...document.querySelectorAll("#cyc-summary .rd-cs-row")].find((el) => el.querySelector(".rd-cs-name b").textContent.trim() === name).getBoundingClientRect().top, target);
    const s2 = await read();
    check(`${W} opening a lower row closes the upper and holds the clicked row`, s2 && s2.name === target && Math.abs(yAfter - yBefore) <= 3, `moved ${(yAfter - yBefore).toFixed(1)}px`);

    /* Level -> Change: the open list re-ranks in place */
    const before = (await read()).lad.map((e) => e.yr).join(",");
    await page.evaluate(() => [...document.querySelectorAll("#cyc-summary .rd-tab")].find((b) => /^Change/.test(b.textContent.trim())).click());
    await sleep(1100);
    const sc = await read();
    const posC = sc.lad.findIndex((e) => e.cur) + 1, wantC = expectPos(sc.rank, sc.lad.length);
    check(`${W} Change: still open, re-ranked, place agrees with "${sc.rank}"`, sc && sc.name === target && sc.lad.map((e) => e.yr).join(",") !== before && (wantC === null || posC === wantC), `at ${posC}, want ${wantC}`);
    check(`${W} Change: records titled as moves`, sc.recs.every((l) => /Furthest/.test(l.h)), sc.recs.map((l) => l.h).join(" | "));
    await page.evaluate(() => [...document.querySelectorAll("#cyc-summary .rd-tab")].find((b) => b.textContent.trim() === "Level").click());
    await sleep(900);
    /* a Compare pick changes the count */
    await page.evaluate(() => [...document.querySelectorAll('[aria-label="Compare with"] button')].find((b) => b.textContent.trim().startsWith("Ousted")).click());
    await sleep(1100);
    const so = await read();
    check(`${W} Ousted: list is the ousted terms plus this one`, so && so.lad.length === so.stripDots.length + 1 && so.lad.length < sc.lad.length, `${so && so.lad.length} rows`);
    await page.evaluate(() => [...document.querySelectorAll('[aria-label="Compare with"] button')].find((b) => b.textContent.trim().startsWith("All")).click());
    await sleep(900);

    /* keyboard: Enter closes/opens, arrows carry the open list */
    if (!touch) {
      await page.evaluate((name) => [...document.querySelectorAll("#cyc-summary .rd-cs-row")].find((el) => el.querySelector(".rd-cs-name b").textContent.trim() === name).focus(), target);
      await page.keyboard.press("Enter"); await sleep(600);
      const k1 = await read();
      await page.keyboard.press("Enter"); await sleep(900);
      const k2 = await read();
      await page.keyboard.press("ArrowDown"); await sleep(900);
      const k3 = await read();
      const focused = await page.evaluate(() => document.activeElement && document.activeElement.dataset && document.activeElement.dataset.key);
      check(`${W} keyboard: Enter closes, Enter opens, ArrowDown carries it`, k1 === null && k2 && k2.name === target && k3 && k3.name === names[3] && !!focused, `${k1 && k1.name} / ${k2 && k2.name} / ${k3 && k3.name}, focus ${focused}`);
      /* a focused row's left/right walk the Compare-with view (just as
         hovering the section does) instead of doing nothing */
      const cmpAt = () => page.evaluate(() => [...document.querySelectorAll('[aria-label="Compare with"] button')].findIndex((b) => b.getAttribute("aria-pressed") === "true"));
      const c0 = await cmpAt();
      await page.keyboard.press("ArrowRight"); await sleep(1000);
      const c1 = await cmpAt();
      await page.keyboard.press("ArrowLeft"); await sleep(1000);
      const c2 = await cmpAt();
      const stillOnRow = await page.evaluate(() => !!(document.activeElement && document.activeElement.dataset && document.activeElement.dataset.key));
      const hash = await page.evaluate(() => location.hash);
      check(`${W} keyboard: <-/-> on a focused row walk the compare view, focus keeps the row`, c0 === 0 && c1 === 1 && c2 === 0 && stillOnRow && hash === "#cycles", `${c0}->${c1}->${c2}, on-row ${stillOnRow}, hash ${hash}`);
      const afterArrows = await read();
      check(`${W} keyboard: compare walk leaves the open list intact`, afterArrows && afterArrows.name === names[3], JSON.stringify(afterArrows && afterArrows.name));

      /* hovering the Measure row claims <-/-> even from a focused row:
         arrows flip Level<->Change (the compare view is untouched, the
         row keeps focus and its list; user call 2026-10-04); moving the
         pointer off the measure row hands the compare walk back */
      await page.evaluate(() => document.querySelector('#cyc-summary [aria-label="Measure"]').scrollIntoView({ behavior: "instant", block: "center" }));
      await sleep(300);
      const measBox = await page.evaluate(() => { const r = document.querySelector('#cyc-summary [aria-label="Measure"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, bottom: r.bottom }; });
      const measureAt = () => page.evaluate(() => { const b = [...document.querySelectorAll('#cyc-summary [aria-label="Measure"] button')].find((x) => x.getAttribute("aria-pressed") === "true"); return b ? b.textContent.trim() : ""; });
      const focusedRow = () => page.evaluate(() => document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.key || null : null);
      const cHeld = await cmpAt();
      const key3 = await page.evaluate((name) => { const el = [...document.querySelectorAll("#cyc-summary .rd-cs-row")].find((el) => el.querySelector(".rd-cs-name b").textContent.trim() === name); return el ? el.dataset.key : null; }, names[3]);
      await page.mouse.move(measBox.x, measBox.y); await sleep(300);
      await page.keyboard.press("ArrowRight"); await sleep(450);
      const m1 = await measureAt(), c1m = await cmpAt(), f1 = await focusedRow(), op1 = await read();
      await page.keyboard.press("ArrowLeft"); await sleep(900);
      const m2 = await measureAt(), c2m = await cmpAt();
      check(`${W} keyboard: hovering the measure row, arrows flip Level/Change only`, /^Change/.test(m1) && /^Level/.test(m2) && c1m === cHeld && c2m === cHeld, `measure "${m1}"/"${m2}", compare ${cHeld}->${c1m}->${c2m}`);
      check(`${W} keyboard: the row keeps focus and its list through the measure walk`, f1 === key3 && op1 && op1.name === names[3], `focus ${f1} vs ${key3}, open ${op1 && op1.name}`);
      /* off the measure row, still over the section: the focused row's compare walk owns the keys again */
      await sleep(1000); /* let the 800ms measure-walk window lapse */
      await page.mouse.move(measBox.x, Math.max(measBox.y + 60, measBox.bottom + 20)); await sleep(300);
      await page.keyboard.press("ArrowRight"); await sleep(900);
      const c3m = await cmpAt();
      await page.keyboard.press("ArrowLeft"); await sleep(900);
      const c4m = await cmpAt();
      const m3 = await measureAt();
      check(`${W} keyboard: pointer off the measure row, arrows walk the compare view again`, c3m === (cHeld + 1) % 3 && c4m === cHeld && /^Level/.test(m3), `compare ${cHeld}->${c3m}->${c4m}, measure "${m3}"`);
    }
    check(`${W} no page errors`, errs.length === 0, errs.slice(0, 3).join(" | "));
    await page.close();
  }
  /* the old design never draws the list */
  const page = await browser.newPage();
  const errs = []; page.on("pageerror", (e) => errs.push(String(e)));
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(`http://127.0.0.1:${PORT}/?design=old#cycles`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await sleep(2500);
  const old = await page.evaluate(() => ({ rd: document.body.classList.contains("rd"), csl: document.querySelectorAll(".rd-csl, .rd-cs-exp").length }));
  check("old design: no list, no expander, no errors", !old.rd && old.csl === 0 && errs.length === 0, JSON.stringify(old) + " " + errs.slice(0, 2).join(" | "));
  await page.close();
} finally {
  await browser.close(); server.close();
}
console.log(fails ? `${fails} FAIL` : "ALL PASS");
process.exit(fails ? 1 : 0);
