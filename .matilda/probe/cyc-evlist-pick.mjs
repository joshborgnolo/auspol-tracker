/* Past-cycles numbered event lists are wired to the chart's annotation
   channel, as the Snapshot 2PP hero's phone list is: a click/tap on an
   `rd-evlist-b` row opens the event's tip in the chart above (controlled
   evt), the row marks itself pressed, the chart's badge lights, and the
   scroll anchor lands in the chart the event opened in. Contracts:

   Lone charts (phone, 390px): the tpp card and the leaders section's
     full-width PM-net card each carry their own list; a tap opens
     .tip-evt in that card, the anchor [id^="evt-a-"] lives inside it,
     the row's aria-pressed is true, a second tap on a different number
     hands the tip over, and the press never moves the scroll position
     (the anchor is never above the viewport top on load).

   Paired charts (primary/oppr, ppmm/oppnet, all widths): the shared
     inline list between them carries buttons; a tap opens .tip-evt in
     exactly ONE of the pair's cards - the pair's first (left) chart
     unless the event is metric-bound to the second (an "oppnet" row
     opens in the right-hand card) - and the sibling card gains no tip
     and no anchor (metric-less events draw in both charts, so only one
     may hold the anchor open). A second number moves the tip; the
     pressed row follows. */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const PORT = 9026;
const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript",
               ".css": "text/css", ".json": "application/json", ".woff2": "font/woff2",
               ".png": "image/png", ".svg": "image/svg+xml", ".csv": "text/csv", ".xml": "text/xml" };
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p === "/") p = "/index.html";
    res.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" });
    res.end(await readFile(join(ROOT, p)));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(PORT, r));
const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new",
});
const fails = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* the lit badge's figure: the last text under the "on" group's badge (a
   renumbering crossfade can leave a fading predecessor text beside it) */
const badgeText = (card) => (
  card.querySelectorAll("g.evt.on .rd-badge text").length
    ? [...card.querySelectorAll("g.evt.on .rd-badge text")].pop().textContent.trim()
    : null
);

/* state of a section's lists: pick them by the `inline` shared-list kind
   or the lone in-card kind, which the leaders section mixes */
const listState = (page, secId, sel) => page.evaluate(({ id, s }) => {
  const sec = document.getElementById(id);
  return [...sec.querySelectorAll("ol.rd-evlist" + s)].map((ol) => ({
    home: (() => { let p = ol; while (p && !p.id) p = p.parentElement; return p ? p.id : null; })(),
    buttons: [...ol.querySelectorAll("button.rd-evlist-b")].map((b) => ({
      text: b.textContent.trim().slice(0, 48),
      pressed: b.getAttribute("aria-pressed"),
    })),
  }));
}, { id: secId, s: sel });

const tapRow = (page, secId, sel, idx) => page.evaluate(({ id, s, i }) => {
  const b = [...document.querySelectorAll("#" + id + " ol.rd-evlist" + s + " button.rd-evlist-b")][i];
  if (!b) return false;
  b.click();
  return true;
}, { id: secId, s: sel, i: idx });

/* which cards of the pair hold an open annotation */
const pairState = (page, secId) => page.evaluate((id) => {
  const cards = [...document.querySelectorAll("#" + id + " .rd-cyc-two .rd-cyc-chart")];
  return {
    cards: cards.map((c) => ({
      tip: !!c.querySelector(".tip-evt"),
      badge: c.querySelectorAll("g.evt.on .rd-badge text").length
        ? [...c.querySelectorAll("g.evt.on .rd-badge text")].pop().textContent.trim() : null,
      anchor: !!c.querySelector('[id^="evt-a-"]'),
      anchorId: (c.querySelector('[id^="evt-a-"]') || {}).id || null,
    })),
    tips: document.querySelectorAll("#" + id + " .tip-evt").length,
    anchors: document.querySelectorAll("#" + id + ' [id^="evt-a-"]').length,
  };
}, secId);

async function go(W, H, touch) {
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, hasTouch: touch });
  await page.goto(`http://127.0.0.1:${PORT}/index.html#cycles`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#cyc-primary ol.rd-evlist", { timeout: 20000 });
  await sleep(1200); /* the cycle-source fetch and the chart clock settle */
  return page;
}

/* ---- a lone chart's own list (phone): tpp, then PM-net ------------------ */
async function loneList(secId, sel) {
  const tag = "390px " + secId + " lone";
  const page = await go(390, 844, true);
  const st = await listState(page, secId, sel);
  if (!st.length || !st[0].buttons.length) { fails.push(tag + ": no interactive lone rows - " + JSON.stringify(st)); await page.close(); return; }
  const n = st[0].buttons.length;
  if (st[0].buttons.some((b) => b.pressed !== "false")) fails.push(tag + ": a row starts pressed - " + JSON.stringify(st[0]));

  const y0 = await page.evaluate(() => window.scrollY);
  if (!(await tapRow(page, secId, sel, 0))) { fails.push(tag + ": first row would not tap"); await page.close(); return; }
  await sleep(600);
  const s1 = await page.evaluate((id) => {
    const sec = document.getElementById(id);
    const card = sec.querySelector(".rd-cyc-one .rd-cyc-chart") || sec.querySelector(".rd-cyc-chart");
    const anchor = card.querySelector('[id^="evt-a-"]');
    const badgeT = card.querySelectorAll("g.evt.on .rd-badge text").length
      ? [...card.querySelectorAll("g.evt.on .rd-badge text")].pop().textContent.trim() : null;
    return {
      tip: !!card.querySelector(".tip-evt"),
      anchorInCard: !!anchor,
      anchorId: (anchor || {}).id || null,
      badgeTxt: badgeT,
      pressed: [...sec.querySelectorAll("ol.rd-evlist:not(.inline) button.rd-evlist-b")].map((b) => b.getAttribute("aria-pressed")),
      scrollY: window.scrollY,
    };
  }, secId);
  if (!s1.tip) fails.push(tag + ": tap #1 opened no .tip-evt in the chart");
  if (!s1.anchorInCard || !/^evt-a-/.test(s1.anchorId || "")) fails.push(tag + ": the scroll anchor is not in the chart's card: " + s1.anchorId);
  if (s1.badgeTxt !== "1") fails.push(tag + ": the chart's lit badge is not '1': " + s1.badgeTxt);
  if (s1.pressed[0] !== "true" || s1.pressed.slice(1).some((p) => p === "true"))
    fails.push(tag + ": aria-pressed did not land on exactly row 1 - " + JSON.stringify(s1.pressed));
  if (Math.abs(s1.scrollY - y0) > 2) fails.push(tag + ": the reveal scrolled the page (" + y0 + " -> " + s1.scrollY + ")");

  /* a second row hands the panel over */
  if (n > 1) {
    await tapRow(page, secId, sel, 1);
    await sleep(600);
    const s2 = await page.evaluate((id) => {
      const sec = document.getElementById(id);
      const card = sec.querySelector(".rd-cyc-one .rd-cyc-chart") || sec.querySelector(".rd-cyc-chart");
      const badgeT = card.querySelectorAll("g.evt.on .rd-badge text").length
        ? [...card.querySelectorAll("g.evt.on .rd-badge text")].pop().textContent.trim() : null;
      return {
        tips: card.querySelectorAll(".tip-evt").length,
        badgeTxt: badgeT,
        pressed: [...sec.querySelectorAll("ol.rd-evlist:not(.inline) button.rd-evlist-b")].map((b) => b.getAttribute("aria-pressed")),
      };
    }, secId);
    if (s2.tips !== 1) fails.push(tag + ": " + s2.tips + " tips open in the card after the handover");
    if (s2.badgeTxt !== "2") fails.push(tag + ": the lit badge did not move to '2': " + s2.badgeTxt);
    if (s2.pressed[1] !== "true" || s2.pressed[0] !== "false")
      fails.push(tag + ": aria-pressed did not follow to row 2 - " + JSON.stringify(s2.pressed));
  }
  await page.close();
}

/* ---- a shared pair list at any width ------------------------------------- */
async function pairList(W, H, touch) {
  const tag = W + "px" + (touch ? "-touch" : "") + " pairs";
  const page = await go(W, H, touch);
  for (const secId of ["cyc-primary", "cyc-leaders"]) {
    const st = await listState(page, secId, ".inline");
    if (!st.length || !st[0].buttons.length) { fails.push(tag + " " + secId + ": the shared inline list has no buttons - " + JSON.stringify(st)); continue; }
    /* row 0: every set is made so the first row is a metric-less shared
       event, which the pair's left chart holds. A later row is found that
       is bound to the right chart only. */
    if (!(await tapRow(page, secId, ".inline", 0))) { fails.push(tag + " " + secId + ": row 0 would not tap"); continue; }
    await sleep(600);
    const p1 = await pairState(page, secId);
    if (!p1.cards[0] || !p1.cards[0].tip) fails.push(tag + " " + secId + ": the left card holds no tip after row 0");
    if (!p1.cards[0] || !p1.cards[0].anchor) fails.push(tag + " " + secId + ": the left card holds no evt-a anchor after row 0");
    if (p1.cards[1] && (p1.cards[1].tip || p1.cards[1].anchor))
      fails.push(tag + " " + secId + ": the sibling card also opened (tip " + p1.cards[1].tip + ", anchor " + p1.cards[1].anchorId + ") - a metric-less event may open in one chart only");
    if (p1.tips !== 1 || p1.anchors !== 1) fails.push(tag + " " + secId + ": " + p1.tips + " tips / " + p1.anchors + " anchors across the section");
    const l1 = await listState(page, secId, ".inline");
    if (l1[0].buttons[0].pressed !== "true") fails.push(tag + " " + secId + ": row 0 not pressed after opening");

    if (secId === "cyc-leaders") {
      /* leaders only: walk until a row bound to the right (opposition)
         chart opens there - the metrics routing */
      let hit = -1;
      for (let i = 1; i < st[0].buttons.length; i++) {
        await tapRow(page, secId, ".inline", i);
        await sleep(450);
        const p = await pairState(page, secId);
        if (p.cards[1] && p.cards[1].tip) { hit = i; break; }
      }
      if (hit < 0) fails.push(tag + " " + secId + ": no row opened in the right-hand (opposition) chart - the metrics routing never fired");
      else {
        const p2 = await pairState(page, secId);
        if (p2.cards[0].tip || p2.cards[0].anchor) fails.push(tag + " " + secId + ": the left card kept its annotation while the right opened");
        if (p2.tips !== 1 || p2.anchors !== 1) fails.push(tag + " " + secId + ": " + p2.tips + " tips / " + p2.anchors + " anchors after the right-hand pick");
        const l2 = await listState(page, secId, ".inline");
        if (l2[0].buttons[hit].pressed !== "true" || l2[0].buttons.filter((b) => b.pressed === "true").length !== 1)
          fails.push(tag + " " + secId + ": exactly one row should read pressed after the right-hand pick");
      }
    } else if (st[0].buttons.length > 1) {
      await tapRow(page, secId, ".inline", 1);
      await sleep(600);
      const p2 = await pairState(page, secId);
      if (p2.anchors !== 1) fails.push(tag + " " + secId + ": " + p2.anchors + " anchors open after the second row");
      if (p2.cards.filter((c) => c.tip).length !== 1) fails.push(tag + " " + secId + ": not exactly one card tipped after the second row");
      const l2 = await listState(page, secId, ".inline");
      if (l2[0].buttons[1].pressed !== "true" || l2[0].buttons[0].pressed !== "false")
        fails.push(tag + " " + secId + ": the pressed row did not move to the second pick");
    }
  }
  await page.close();
}

await loneList("cyc-tpp", ":not(.inline)");
await loneList("cyc-leaders", ":not(.inline)");
await pairList(1440, 960, false);
await pairList(390, 844, true);
await browser.close();
server.close();
if (fails.length) { console.log("FAILS:"); fails.forEach((f) => console.log(" - " + f)); process.exit(1); }
console.log("ALL PASS");
