// Past-cycles numbered-badge pick probe (cyc-badge-tap).
// The cluster-spreader parks an event's badge up to N×17px off its rule and
// ties it back; nearestEvent must also pick at the badge circle (centre
// pad.t−PX(13)) so hovering/tapping the NUMBER opens the annotation, not
// just hovering the dashed rule it no longer sits on.
//   desktop: mouse hover on a SPREAD badge (its tie drawn) and on an on-slot
//            badge lights g.evt.on + .tip-evt + the evt-a- anchor, and the
//            section's event list presses the matching row; leaving clears.
//   phone:   tap a spread badge - tip shows, the list row for that number is
//            aria-pressed; tapping it again closes; tap on open water leaves
//            the guide working.
// Modelled on hl-space-flip.mjs server/launch boilerplate.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const ROOT = process.env.PROBE_ROOT || fileURLToPath(new URL("../..", import.meta.url));
const PORT = 9008;
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
const expect = (cond, msg) => { console.log((cond ? "PASS" : "FAIL") + "  " + msg); if (!cond) fails.push(msg); };

// Inventory the pair-chart badges (Primary + Leadership sections).
const collectBadges = () => {
  const out = [];
  document.querySelectorAll("#cyc-primary .rd-badge, #cyc-leaders .rd-badge").forEach((b) => {
    const circle = b.querySelector("circle");
    const card = b.closest(".rd-cyc-chart");
    const g = b.closest("g.evt");
    if (!circle || !card || !g) return;
    const cards = [...document.querySelectorAll(".rd-cyc-chart")];
    const texts = b.querySelectorAll("text");
    const r = circle.getBoundingClientRect();
    out.push({
      x: r.left + r.width / 2, y: r.top + r.height / 2,
      tie: !!b.querySelector(".rd-badge-tie"),
      num: texts.length ? texts[texts.length - 1].textContent.trim() : "",
      aria: g.getAttribute("aria-label") || "",
      cardIdx: cards.indexOf(card),
      sec: (card.closest("section") || {}).id || "",
      tieDx: b.querySelector(".rd-badge-tie")
        ? Math.abs(parseFloat(b.querySelector(".rd-badge-tie").getAttribute("d").slice(1)) - parseFloat(g.querySelector(".evt-line").getAttribute("x1")))
        : 0,
    });
  });
  return out;
};
const litState = (page, cardIdx) => page.evaluate((ci) => {
  const card = [...document.querySelectorAll(".rd-cyc-chart")][ci];
  if (!card) return null;
  const on = card.querySelectorAll("g.evt.on");
  const tip = card.querySelector(".tip.tip-evt");
  const tr = tip && tip.getBoundingClientRect();
  const anchor = card.querySelector('[id^="evt-a-"]');
  return {
    onCount: on.length,
    onAria: on[0] ? on[0].getAttribute("aria-label") || "" : "",
    tipVisible: !!(tr && tr.width > 8 && tr.height > 8),
    anchor: anchor ? anchor.id : null,
  };
}, cardIdx);
const pressedRow = (page, secId, num) => page.evaluate((sid, n) => {
  const b = document.querySelectorAll(`#${sid} .rd-evlist-b[aria-pressed="true"]`);
  return [...b].map((x) => {
    const t = x.querySelector(".rd-evlist-n");
    return t ? t.textContent.trim() : "?";
  });
}, secId, num);

// ---------- desktop pass: hover ----------
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 960 });
await page.goto(`http://127.0.0.1:${PORT}/cycles/`, { waitUntil: "domcontentloaded" });
let got = true;
await page.waitForSelector("#cyc-primary .rd-badge", { timeout: 20000 }).catch(() => { got = false; });
expect(got, "pair charts render numbered badges (#cyc-primary)");
await sleep(400);

if (got) {
  const all = await page.evaluate(collectBadges);
  const spread = all.filter((b) => b.tie && b.tieDx > 2);
  const onSlot = all.filter((b) => !b.tie);
  console.log(`  badges: ${all.length} total, ${spread.length} spread (tie), ${onSlot.length} on-slot`);
  expect(spread.length > 0, "a cluster badge spread off its rule exists to pick");

  const runHover = async (b, tag) => {
    await page.evaluate((ci) => {
      const card = [...document.querySelectorAll(".rd-cyc-chart")][ci];
      card.scrollIntoView({ block: "center" });
    }, b.cardIdx);
    await sleep(250);
    const fresh = (await page.evaluate(collectBadges)).find((x) => x.aria === b.aria && x.cardIdx === b.cardIdx);
    expect(!!fresh, `${tag}: badge re-located after scroll (${b.num} · ${b.aria.slice(0, 40)})`);
    if (!fresh) return;
    await page.mouse.move(fresh.x, fresh.y, { steps: 4 });
    await sleep(300);
    const s = await litState(page, fresh.cardIdx);
    expect(s && s.onCount === 1, `${tag}: exactly one g.evt lit on badge hover (got ${s && s.onCount})`);
    expect(s && s.tipVisible, `${tag}: .tip-evt visible on badge hover`);
    expect(s && s.anchor && s.anchor.startsWith("evt-a-"), `${tag}: evt-a- anchor minted for the open event (${s && s.anchor})`);
    if (fresh.sec) {
      const rows = await pressedRow(page, fresh.sec, fresh.num);
      expect(rows.includes(fresh.num), `${tag}: event list row ${fresh.num} pressed (pressed: ${rows.join(",") || "none"})`);
    }
    // leaving the chart clears the annotation
    await page.mouse.move(60, 140);
    await sleep(300);
    const off = await litState(page, fresh.cardIdx);
    expect(off && off.onCount === 0 && !off.tipVisible, `${tag}: moving off the chart clears the annotation`);
  };
  if (spread.length) await runHover(spread[0], "spread");
  if (onSlot.length) await runHover(onSlot[0], "on-slot");
}
await page.close();

// ---------- phone pass: tap ----------
const m = await browser.newPage();
await m.setViewport({ width: 390, height: 844, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
await m.goto(`http://127.0.0.1:${PORT}/cycles/`, { waitUntil: "domcontentloaded" });
got = true;
await m.waitForSelector("#cyc-primary .rd-badge", { timeout: 20000 }).catch(() => { got = false; });
expect(got, "phone: pair charts render numbered badges");
await sleep(500);

if (got) {
  const all = await m.evaluate(collectBadges);
  const spread = all.filter((b) => b.tie && b.tieDx > 2);
  expect(spread.length > 0, "phone: a spread badge exists to tap");
  const b = spread[0] || all[0];
  if (b) {
    await m.evaluate((ci) => {
      const card = [...document.querySelectorAll(".rd-cyc-chart")][ci];
      card.scrollIntoView({ block: "center" });
    }, b.cardIdx);
    await sleep(400);
    const fresh = (await m.evaluate(collectBadges)).find((x) => x.aria === b.aria && x.cardIdx === b.cardIdx);
    expect(!!fresh, "phone: badge re-located after scroll");
    if (fresh) {
      console.log(`  tapping badge ${fresh.num} at (${fresh.x.toFixed(0)},${fresh.y.toFixed(0)}) — ${fresh.aria.slice(0, 60)}`);
      await m.touchscreen.tap(fresh.x, fresh.y);
      await sleep(500);
      const s = await litState(m, fresh.cardIdx);
      expect(s && s.onCount === 1, `phone: tap lights exactly one g.evt (got ${s && s.onCount})`);
      expect(s && s.tipVisible, "phone: .tip-evt visible after badge tap");
      if (fresh.sec) {
        const rows = await pressedRow(m, fresh.sec, fresh.num);
        expect(rows.includes(fresh.num), `phone: event list row ${fresh.num} pressed (pressed: ${rows.join(",") || "none"})`);
      }
      // tap the same badge again - the open annotation closes
      await m.touchscreen.tap(fresh.x, fresh.y);
      await sleep(450);
      const off = await litState(m, fresh.cardIdx);
      expect(off && off.onCount === 0 && !off.tipVisible, "phone: tapping the open badge closes it");
      // open water: the guide still responds to a tap
      const water = await m.evaluate((ci) => {
        const svg = [...document.querySelectorAll(".rd-cyc-chart")][ci].querySelector("svg");
        const r = svg.getBoundingClientRect();
        return { x: r.left + r.width * 0.06, y: r.top + r.height * 0.5 };
      }, fresh.cardIdx);
      await m.touchscreen.tap(water.x, water.y);
      await sleep(400);
      const g = await m.evaluate((ci) => {
        const card = [...document.querySelectorAll(".rd-cyc-chart")][ci];
        const guide = card.querySelector(".guide");
        return guide ? parseFloat((guide.style.opacity || "0")) : -1;
      }, fresh.cardIdx);
      expect(g > 0.3, `phone: open-water tap still raises the guide (opacity ${g})`);
    }
  }
}

console.log(fails.length ? "RESULT: FAIL (" + fails.join(" | ") + ")" : "RESULT: OK");
await browser.close();
server.close();
process.exit(fails.length ? 1 : 0);
