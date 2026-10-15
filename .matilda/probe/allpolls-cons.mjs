/* the All-polls Primary facet's intention<=>consideration flip (consM, the
   k=1 URL param). Desktop and phone: the flip lives only on the Primary
   facet; default landing reads the Primary vote caption and a tick ladder
   ending 40%; a press swaps the caption to Voting consideration, the ladder
   gains the 50% and 60% marks (consideration runs higher than intention -
   RedBridge/Accent's looser 0-10 tier tops 60), the URL gains k=1, the
   table scopes to the consideration waves ("9 of N polls") with every
   row's aria announcing Voting consideration, EVERY row names its basis
   (desktop: under the figures, ".rd-ap-fig .rd-ap-sub"; phone: at the card
   head's RIGHT EDGE beside the firm name, user call 2026-10-15, the slot
   the demographics facet names its pair in), the labels reading "Would
   consider" / "Would seriously consider" / "Would definitely vote", the
   month rows shed the intention aggregate rings, the facet story speaks
   consideration, and pressing back restores the unscoped intention table;
   ?f=p&k=1 deep-lands in the mode.
   THREE rows carry banded consideration and show ONE range at a time with
   the basis label as a cycle button (".rd-ap-conscyc"): RedBridge/Accent's
   April 2026 0-10 battery (canonical "Would seriously consider (7+ of 10)"
   -> "consider (4+ of 10)" -> "would never vote (0 of 10)") and
   Essential's June + Feb 2026 definitely/open/never waves (canonical
   "Would definitely vote" -> "Would consider (definitely or open)" ->
   "would never vote"). Each press swaps the figures AND the strip to the
   next range WITHOUT opening the row; the full breakdown stays in the
   expanded poll's ledger. Rows carry no pollster attribute, so the probe
   picks them out by their basis labels (the canonical labels are unique
   among the scoped rows, though Essential's two rows are identical -
   their FIELDWORK dates tell them apart, per NEEDLES).
   By design the rd view shows no "With consideration figures" auto-pill
   (rd-allpolls hides auto pills - the toggle itself and the scoped tally
   carry the state), and the probe pins that absence rather than hunting
   one. No screenshots: DOM text + aria. */

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const PORT = 9044;
const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript",
               ".css": "text/css", ".json": "application/json", ".woff2": "font/woff2",
               ".png": "image/png", ".svg": "image/svg+xml", ".csv": "text/csv", ".xml": "text/xml" };
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p === "/") p = "/index.html";
    if (p.endsWith("/")) p += "index.html";
    const buf = await readFile(join(ROOT, p));
    res.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" });
    res.end(buf);
  } catch { if (!res.headersSent) res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(PORT, r));

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new",
});

const fails = [];
const ok = (cond, name) => { console.log((cond ? "ok  " : "FAIL") + " – " + name); if (!cond) fails.push(name); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* one range-cycler row, with all three of its ranges pinned in cycle
   order. Rows carry no pollster attribute and BOTH Essential rows cycle
   "definitely vote" through the very same two other labels, so a label
   cannot tell them apart: the probe picks each row by its fieldwork text
   (".rd-ap-when b" on desktop, the meta sub-line on the phone card). */
const NEEDLES = { rb: "24-30 Apr", essJun: "24-29 Jun", essFeb: "18-23 Feb" };
const CYCS = {
  rb: {
    canon: "Would seriously consider (7+ of 10)",
    canonNums: ["45", "37", "36", "24"],
    ranges: [
      { lab: "consider (4+ of 10)", nums: ["62", "59", "53", "45"], aria: "Voting consideration, consider (4+ of 10): " },
      { lab: "would never vote (0 of 10)", nums: ["21", "30", "16", "32"], aria: "Voting consideration, would never vote (0 of 10): " },
      { lab: "Would seriously consider (7+ of 10)", nums: ["45", "37", "36", "24"], aria: "Voting consideration, Would seriously consider (7+ of 10): " },
    ],
  },
  essJun: {
    canon: "Would definitely vote",
    canonNums: ["27", "29", "18", "9", "13"],
    ranges: [
      { lab: "Would consider (definitely or open)", nums: ["50", "52", "40", "56"], aria: "Voting consideration, Would consider (definitely or open): " },
      { lab: "would never vote", nums: ["37", "35", "45", "35", "25"], aria: "Voting consideration, would never vote: " },
      { lab: "Would definitely vote", nums: ["27", "29", "18", "13", "9"], aria: "Voting consideration, Would definitely vote: " },
    ],
  },
  essFeb: {
    canon: "Would definitely vote",
    canonNums: ["25"],
    ranges: [
      { lab: "Would consider (definitely or open)", nums: ["58"], aria: "Voting consideration, Would consider (definitely or open): " },
      { lab: "would never vote", nums: ["28"], aria: "Voting consideration, would never vote: " },
      { lab: "Would definitely vote", nums: ["25"], aria: "Voting consideration, Would definitely vote: " },
    ],
  },
};

const state = (page) => page.evaluate(() => {
  const vis = (el) => !!el && el.offsetParent !== null;
  const rows = [...document.querySelectorAll(".rd-ap-row")].filter((r) => !r.classList.contains("rd-ap-mrow"));
  const first = rows[0] || null;
  const mrows = [...document.querySelectorAll(".rd-ap-mrow")];
  const hedslot = document.querySelector(".rd-ap-hedslot");
  const cycRows = rows.filter((r) => r.querySelector(".rd-ap-conscyc"));
  const norm = (s) => String(s).replace(/[–—]/g, "-");
  const cycOf = (needle) => {
    const hit = cycRows.filter((r) => norm(r.textContent).includes(norm(needle)))[0] || null;
    return hit ? {
      lab: hit.querySelector(".rd-ap-conscyc").textContent.trim(),
      nums: [...hit.querySelectorAll(".rd-ap-fig b")].map((b) => b.textContent),
      strips: hit.querySelectorAll(".rd-ap-pic").length,
      aria: hit.querySelector(".rd-ap-pic") ? hit.querySelector(".rd-ap-pic").getAttribute("aria-label") || "" : "",
      open: hit.classList.contains("open"),
    } : null;
  };
  return {
    cap: (document.querySelector(".rd-ap-hpic .rd-ap-cap") || {}).textContent || "",
    tks: [...document.querySelectorAll(".rd-ap-hpic .rd-ap-tk")].map((s) => s.textContent),
    flips: [...document.querySelectorAll(".rd-ap-tabs .rd-pl-flip, .rd-ap-ctlslot .rd-pl-flip")].filter(vis).map((b) => ({ text: b.textContent.trim(), pressed: b.getAttribute("aria-pressed") })),
    count: (document.querySelector(".rd-ap-count") || {}).textContent || "",
    nRows: rows.length,
    firstAria: first && first.querySelector(".rd-ap-pic") ? first.querySelector(".rd-ap-pic").getAttribute("aria-label") || "" : "",
    firstNums: first ? [...first.querySelectorAll(".rd-ap-pnums b")].map((b) => b.textContent) : [],
    ariasCons: rows.every((r) => { const p = r.querySelector(".rd-ap-pic"); return p && (p.getAttribute("aria-label") || "").startsWith("Voting consideration"); }),
    subsAll: rows.length > 0 && rows.every((r) => {
      const sub = r.querySelector(".rd-ap-fig .rd-ap-sub, .rd-ap-fig .rd-ap-conscyc");
      return !!sub && sub.textContent.trim().length > 0;
    }),
    nCyc: cycRows.length,
    firstSub: first && first.querySelector(".rd-ap-fig .rd-ap-sub, .rd-ap-fig .rd-ap-conscyc")
      ? first.querySelector(".rd-ap-fig .rd-ap-sub, .rd-ap-fig .rd-ap-conscyc").textContent.trim() : "",
    rb: cycOf("24-30 Apr"),
    essJun: cycOf("24-29 Jun"),
    essFeb: cycOf("18-23 Feb"),
    mrowNotes: mrows.map((m) => (m.querySelector(".rd-ap-mlab span span") || m.querySelector(".rd-ap-mlab span") || {}).textContent || ""),
    nRings: document.querySelectorAll(".rd-ap-mrow .rd-ap-ring").length,
    hed: hedslot && hedslot.querySelector(".rd-hed") ? hedslot.querySelector(".rd-hed").textContent : "",
    dek: hedslot && hedslot.querySelector(".rd-dek") ? hedslot.querySelector(".rd-dek").textContent : "",
    pill: [...document.querySelectorAll(".rd-ap-active .rd-ap-pill")].some((p) => /consideration/i.test(p.textContent)),
    nCons: (window.AUSPOL.individualPolls || []).filter((p) => p.cons).length,
    k: new URLSearchParams(location.search).get("k"),
  };
});

const clickFlip = (page, want) => page.evaluate((want) => {
  const b = [...document.querySelectorAll(".rd-ap-tabs .rd-pl-flip, .rd-ap-ctlslot .rd-pl-flip")].find((x) => x.offsetParent !== null && x.textContent.includes(want));
  if (b) b.click();
  return !!b;
}, want);

/* press ONE row's cycler, picked by its fieldwork text (the Essential
   rows' basis labels collide at every point of the cycle) */
const clickCyc = (page, needle) => page.evaluate((needle) => {
  const norm = (s) => String(s).replace(/[–—]/g, "-");
  const row = [...document.querySelectorAll(".rd-ap-row, .rd-ap-card")]
    .find((r) => r.querySelector(".rd-ap-conscyc") && norm(r.textContent).includes(norm(needle)));
  const b = row && row.querySelector(".rd-ap-conscyc");
  if (b) b.click();
  return !!b;
}, needle);

const runDesktop = async () => {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  page.on("pageerror", (e) => console.log("[pageerror]", String(e).slice(0, 300)));
  await page.goto(`http://127.0.0.1:${PORT}/allpolls/?f=p`, { waitUntil: "networkidle2" });
  await page.waitForSelector(".rd-ap-row", { timeout: 20000 });
  await sleep(500);

  // 1. default: intention caption, 40%-capped ladder, the flip offered
  const base = await state(page);
  ok(base.nCons === 9, `data carries the nine consideration waves (saw ${base.nCons})`);
  ok(base.cap === "Primary vote", "default head caption reads Primary vote");
  ok(base.tks[base.tks.length - 1] === "40%", "default tick ladder ends at the 40% mark");
  ok(base.flips.length === 1 && /Voting intention/.test(base.flips[0].text), "the flip reads its live mode, intention, on the Primary facet");
  ok(base.flips[0] && base.flips[0].pressed === "false", "flip starts unpressed");
  ok(base.firstAria.startsWith("Primary vote:"), "top row's aria announces Primary vote");
  ok(base.nRings > 0, "month rows draw the intention aggregate rings");
  ok(base.mrowNotes.some((n) => /average, drawn as rings/.test(n)), "a month row labels its rings the average");

  // 2. press the flip: consM lands
  ok(await clickFlip(page, "intention"), "flip click landed");
  await page.waitForFunction(() => new URLSearchParams(location.search).get("k") === "1", { timeout: 5000 });
  await sleep(500);
  const cons = await state(page);
  ok(cons.cap === "Voting consideration", "consM head caption reads Voting consideration");
  ok(cons.tks[cons.tks.length - 1] === "60%", "consM tick ladder reaches the 60% mark");
  ok(cons.flips.length === 1 && /Voting consideration/.test(cons.flips[0].text), "the flip now reads its live consideration mode");
  ok(cons.flips[0] && cons.flips[0].pressed === "true", "flip reads pressed");
  ok(cons.nRows === 9, `scoped to the nine consideration waves (saw ${cons.nRows})`);
  ok(/\b9 of \d+ polls/.test(cons.count.replace(/\s+/g, " ")), `scoped tally reads "9 of N polls" ("${cons.count}")`);
  ok(cons.count !== base.count || cons.nRows !== base.nRows, "the scope visibly narrows the unscoped table");
  ok(cons.ariasCons, "every scoped row's aria announces Voting consideration");
  ok(cons.firstAria.includes("ALP 41") && cons.firstAria.includes("ON 39"), "top row is the 30 June News24 wave's consideration read (ALP 41, ON 39)");
  ok(cons.firstNums.includes("41") && cons.firstNums.includes("39"), "top row's printed figures are the consideration shares");
  ok(cons.subsAll, "every scoped row names its basis against the figures");
  ok(cons.firstSub === "Would seriously consider", `top row's basis reads "Would seriously consider" (saw "${cons.firstSub}")`);
  ok(cons.nCyc === 3, `three rows carry the range cycler (saw ${cons.nCyc})`);
  for (const [id, spec] of Object.entries(CYCS)) {
    if (!ok(cons[id] && cons[id].lab.startsWith(spec.canon), `the ${id} row opens on its canonical range "${spec.canon}" (saw ${cons[id] && cons[id].lab})`)) continue;
    ok(spec.canonNums.every((n) => cons[id].nums.includes(n)),
      `the ${id} canonical figures print (${JSON.stringify(cons[id].nums)})`);
    ok(cons[id].strips === 1, `the ${id} row draws a single strip (saw ${cons[id].strips})`);
    ok(cons[id].aria.startsWith("Voting consideration, " + spec.canon + ": "),
      `the ${id} strip's aria names its range (${cons[id].aria.slice(0, 80)}…)`);
  }
  ok(cons.nRings === 0, "month rows drop the intention rings under consM");
  ok(cons.mrowNotes.length > 0 && cons.mrowNotes.every((n) => /^\d+ polls?$/.test(n.trim())), `month notes read as bare counts (${JSON.stringify(cons.mrowNotes)})`);
  ok(!cons.pill, "no scope auto-pill leaks into the rd view (the toggle carries the state)");
  ok(/consideration/i.test(cons.hed) && /one nation/i.test(cons.hed), `facet story head speaks One Nation consideration ("${cons.hed.slice(0, 70)}…")`);
  ok(/nine polls/.test(cons.hed), `story head counts nine waves ("${cons.hed.slice(0, 90)}…")`);
  ok(/consider/i.test(cons.dek), "facet story dek speaks consideration");

  // 3. the range cycler steps each banded row through its three ranges
  for (const [id, spec] of Object.entries(CYCS)) {
    for (let i = 0; i < spec.ranges.length; i++) {
      ok(await clickCyc(page, NEEDLES[id]), `${id} cycler press ${i + 1} landed`);
      await sleep(300);
      const s = await state(page);
      const t = spec.ranges[i];
      const row = s[id];
      if (!ok(row && row.lab.startsWith(t.lab), `${id} press ${i + 1}: label reads "${t.lab}" (saw ${row && row.lab})`)) break;
      ok(t.nums.every((n) => row.nums.includes(n)), `${id} press ${i + 1}: figures swap to ${JSON.stringify(t.nums)} (saw ${JSON.stringify(row.nums)})`);
      ok(row.strips === 1, `${id} press ${i + 1}: still a single strip`);
      ok(row.aria.startsWith(t.aria), `${id} press ${i + 1}: strip aria names the range (${row.aria.slice(0, 80)}…)`);
      ok(row.open === false, `${id} press ${i + 1}: the row did not open`);
      ok(s.firstNums.includes("41") && s.firstNums.includes("39"), `${id} press ${i + 1}: the other rows are unmoved`);
    }
  }

  // 4. press back: the unscoped intention table returns
  ok(await clickFlip(page, "consideration"), "flip-back click landed");
  await page.waitForFunction(() => new URLSearchParams(location.search).get("k") !== "1", { timeout: 5000 });
  await sleep(500);
  const back = await state(page);
  ok(back.cap === "Primary vote", "flipping back restores the Primary vote caption");
  ok(back.count === base.count && back.nRows === base.nRows, `the unscoped table returns verbatim ("${back.count}" vs "${base.count}")`);
  ok(back.firstAria.startsWith("Primary vote:"), "top row's aria announces Primary vote again");
  ok(back.nRings > 0, "the intention rings return on the month rows");
  ok(!/one nation consideration/i.test(back.hed), "the story leaves consideration with the mode");

  // 5. deep land on k=1 restores the mode
  await page.goto(`http://127.0.0.1:${PORT}/allpolls/?f=p&k=1`, { waitUntil: "networkidle2" });
  await page.waitForSelector(".rd-ap-row", { timeout: 20000 });
  await sleep(500);
  const landed = await state(page);
  ok(landed.cap === "Voting consideration", "?f=p&k=1 lands in consideration mode");
  ok(landed.flips.length === 1 && landed.flips[0].pressed === "true", "?f=p&k=1 presses the flip");
  ok(landed.nRows === 9, "?f=p&k=1 scopes the table");
  ok(landed.rb && landed.rb.lab.startsWith("Would seriously consider (7+ of 10)"), "a fresh land opens the RedBridge row on its canonical range");
  ok(landed.essJun && landed.essJun.lab.startsWith("Would definitely vote"), "a fresh land opens the Essential June row on its canonical range");
  ok(/consider/i.test(landed.hed + " " + landed.dek), "the story speaks consideration off a fresh land");

  // 6. the 2PP facet carries no consideration flip
  await page.goto(`http://127.0.0.1:${PORT}/allpolls/`, { waitUntil: "networkidle2" });
  await page.waitForSelector(".rd-ap-row", { timeout: 20000 });
  await sleep(500);
  const tw = await state(page);
  ok(tw.flips.every((f) => !/consideration/i.test(f.text)), "the 2PP facet carries no consideration flip");
  await page.close();
};

const runPhone = async () => {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  page.on("pageerror", (e) => console.log("[pageerror]", String(e).slice(0, 300)));
  await page.goto(`http://127.0.0.1:${PORT}/allpolls/?f=p`, { waitUntil: "networkidle2" });
  await page.waitForSelector(".rd-ap-card", { timeout: 20000 });
  await sleep(600);

  const pre = await page.evaluate(() => ({
    flip: [...document.querySelectorAll(".rd-ap-ctlslot .rd-pl-flip")].map((b) => b.textContent.trim()),
    hidden: document.querySelectorAll(".rd-ap-ctlvar .rd-pl-flip").length,
    cap: (document.querySelector(".rd-ap-phead .rd-ap-cap") || {}).textContent || "",
  }));
  ok(pre.flip.length === 1 && /Voting intention/.test(pre.flip[0] || ""), `the phone control row's flip reads its live intention mode (${JSON.stringify(pre.flip)})`);
  ok(pre.cap === "Primary vote", "phone pinned head starts on Primary vote");

  await clickFlip(page, "intention");
  await page.waitForFunction(() => new URLSearchParams(location.search).get("k") === "1", { timeout: 5000 });
  await sleep(600);
  const cstate = () => page.evaluate(() => {
    const cards = [...document.querySelectorAll(".rd-ap-card")];
    const nums = cards.length ? [...cards[0].querySelectorAll(".rd-ap-cprim b")].map((b) => b.textContent) : [];
    const norm = (s) => String(s).replace(/[–—]/g, "-");
    /* the basis label parks at the card head's right edge (the ".rd-ap-c1"
       row's last slot), wrapped in the aria-live span for range-cycling
       rows; single-range rows are a bare ".rd-ap-csub" there */
    const labOf = (c) => c.querySelector(".rd-ap-c1 .rd-ap-conscyc, .rd-ap-c1 > .rd-ap-csub");
    const cycOf = (needle) => {
      const c = cards.filter((x) => x.querySelector(".rd-ap-conscyc") && norm(x.textContent).includes(norm(needle)))[0] || null;
      return c ? {
        nTiers: c.querySelectorAll(".rd-ap-ctier").length,
        lab: c.querySelector(".rd-ap-conscyc").textContent.trim(),
        headLab: (labOf(c) || {}).textContent ? labOf(c).textContent.trim() : "",
        nums: [...c.querySelectorAll(".rd-ap-cprim b")].map((b) => b.textContent),
        strips: c.querySelectorAll(".rd-ap-cpic .rd-ap-pic").length,
        aria: c.querySelector(".rd-ap-cpic .rd-ap-pic") ? c.querySelector(".rd-ap-cpic .rd-ap-pic").getAttribute("aria-label") || "" : "",
      } : null;
    };
    return {
      cap: (document.querySelector(".rd-ap-phead .rd-ap-cap") || {}).textContent || "",
      nCards: cards.length,
      count: (document.querySelector(".rd-ap-count") || {}).textContent || "",
      nums,
      /* every card names its basis at the head's right edge, lifted clear
         of the figures - and NOTHING basis-like remains in the figures
         block (the 2026-10-15 move out of ".rd-ap-ctier") */
      subsAll: cards.length > 0 && cards.every((c) => {
        const s = labOf(c);
        return !!s && s.textContent.trim().length > 0 &&
          !c.querySelector(".rd-ap-ctier .rd-ap-csub, .rd-ap-ctier .rd-ap-conscyc");
      }),
      geom: cards.length > 0 && cards.every((c) => {
        const s = labOf(c);
        if (!s) return false;
        const r = s.getBoundingClientRect(), cr = c.getBoundingClientRect();
        const tier = c.querySelector(".rd-ap-ctier, .rd-ap-cprim");
        const above = tier ? r.top < tier.getBoundingClientRect().top : true;
        return above && r.right > cr.right - 30 && r.right <= cr.right + 2 && r.width > 0;
      }),
      nCyc: cards.filter((c) => c.querySelector(".rd-ap-conscyc")).length,
      heights: cards.map((c) => +c.getBoundingClientRect().height.toFixed(2)),
      rb: cycOf("24-30 Apr"),
      essJun: cycOf("24-29 Jun"),
      essFeb: cycOf("18-23 Feb"),
    };
  });
  const on = await cstate();
  ok(on.cap === "Voting consideration", "the phone pinned head reads Voting consideration under consM");
  ok(on.nCards === 9, `the phone scopes to the nine waves (saw ${on.nCards} cards)`);
  ok(/\b9 of \d+ polls/.test(on.count.replace(/\s+/g, " ")), `phone tally reads the scoped count ("${on.count}")`);
  ok(on.nums.includes("41") && on.nums.includes("39"), "the top card prints the consideration figures");
  ok(on.subsAll, "every phone card names its basis at the head's right edge, none left under the figures");
  ok(on.geom, "every basis label sits in the head row's right half, above the figures");
  ok(on.heights.every((h) => Math.abs(h - 122) < 0.51), `every cons card rides the shared 122px rung (${JSON.stringify([...new Set(on.heights)])})`);
  ok(on.nCyc === 3, `three phone cards carry the range cycler (saw ${on.nCyc})`);
  ok(on.rb && on.rb.nTiers === 1, `the phone RedBridge card shows a single figure line (saw ${on.rb && on.rb.nTiers} tiers)`);
  ok(on.rb && on.rb.lab.startsWith("Would seriously consider (7+ of 10)"), `the phone RedBridge card opens on the canonical serious range ("${on.rb && on.rb.lab}")`);
  ok(on.rb && on.rb.headLab.startsWith("Would seriously consider (7+ of 10)"), "the RedBridge label rides the head row");
  ok(on.rb && on.rb.nums.includes("45") && on.rb.nums.includes("37"), "the phone RedBridge card prints the canonical figures");
  ok(on.rb && on.rb.strips === 1, "the phone RedBridge card draws one strip");
  ok(on.rb && on.rb.aria.startsWith("Voting consideration, Would seriously consider (7+ of 10): "),
    `the phone RedBridge strip's aria names the range (${on.rb && on.rb.aria.slice(0, 70)}…)`);
  ok(on.essJun && on.essJun.lab.startsWith("Would definitely vote"), `the phone June Essential card opens on "Would definitely vote" ("${on.essJun && on.essJun.lab}")`);
  ok(on.essJun && on.essJun.nums.includes("27") && on.essJun.nums.includes("29"), `the phone June Essential card prints its band figures (${JSON.stringify(on.essJun && on.essJun.nums)})`);
  ok(on.essFeb && on.essFeb.nums.includes("25"), "the phone Feb Essential card prints the One Nation 25");

  // the phone cycler also swaps figures, head label and strip (RedBridge + Essential)
  ok(await clickCyc(page, NEEDLES.rb), "phone RedBridge cycler press landed");
  await sleep(300);
  const on2 = await cstate();
  ok(on2.rb && on2.rb.lab.startsWith("consider (4+ of 10)"), `phone press swaps the RedBridge label to the loose range ("${on2.rb && on2.rb.lab}")`);
  ok(on2.rb && on2.rb.headLab.startsWith("consider (4+ of 10)"), "the head label swings with the range");
  ok(on2.rb && on2.rb.nums.includes("62") && on2.rb.nums.includes("59"), `phone press swaps the RedBridge figures (${JSON.stringify(on2.rb && on2.rb.nums)})`);
  ok(on2.rb && on2.rb.aria.startsWith("Voting consideration, consider (4+ of 10): "), "phone press swaps the RedBridge strip's aria");
  ok(await clickCyc(page, NEEDLES.essJun), "phone Essential June cycler press landed");
  await sleep(300);
  const on3 = await cstate();
  ok(on3.essJun && on3.essJun.lab.startsWith("Would consider (definitely or open)"), `phone press swaps the June Essential label to the loose band ("${on3.essJun && on3.essJun.lab}")`);
  ok(on3.essJun && on3.essJun.nums.includes("50") && on3.essJun.nums.includes("52"), `phone press swaps the June Essential figures (${JSON.stringify(on3.essJun && on3.essJun.nums)})`);
  await page.close();
};

await runDesktop();
await runPhone();

await browser.close();
server.close();
console.log(fails.length ? `\n${fails.length} FAILURES` : "\nall green");
process.exit(fails.length ? 1 : 0);
