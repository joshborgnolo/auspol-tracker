import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
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

async function run(W, H, touch) {
  const tag = W + "px" + (touch ? "-touch" : "");
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, hasTouch: touch });
  await page.goto(`http://127.0.0.1:${PORT}/index.html#cycles`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[aria-label="Compare with"]', { timeout: 20000 });
  await sleep(800);

  const g = await page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const chip = q("#cyc-tpp .rd-cyc-chipmove .rd-chip");
    const wrap = q("#cyc-tpp .rd-cyc-chipmove");
    const rowChip = q(".rd-cc-row .rd-chip");
    const drawnInControls = q(".rd-cc .rd-cc-drawn");
    const eb = q("#cyc-tpp .rd-eyebrow");
    const tools = q("#cyc-tpp .rd-eyebrow-tools");
    if (!chip || !wrap || !eb) return { missing: true, rowChip: !!rowChip };
    const r = (el) => { const b = el.getBoundingClientRect(); return { t: b.top, b: b.bottom, l: b.left, r: b.right }; };
    const ebs = getComputedStyle(eb);
    const ws = getComputedStyle(wrap);
    const meta = q("#cyc-tpp .rd-meta");
    const title = q("#cyc-tpp .rd-title");
    const svgText = () => Array.from(document.querySelectorAll("#cyc-tpp svg")).map((s) => s.textContent).join(" ");
    return {
      rowChip: !!rowChip,
      drawnInControls: !!drawnInControls,
      chipInTools: !!(tools && chip.closest(".rd-eyebrow-tools") === tools),
      ruleY: r(eb).t + parseFloat(ebs.borderTopWidth) / 2,
      chip: r(chip),
      chipFs: getComputedStyle(chip).fontSize,
      wrap: r(wrap),
      ebLeft: r(eb).l,
      pos: ws.position,
      label: chip.textContent.replace(/\s+/g, " ").trim(),
      meta: meta ? r(meta) : null,
      title: title ? r(title) : null,
      svg: svgText(),
    };
  });
  if (g.missing) { fails.push(tag + ": chip/eyebrow not found under #cyc-tpp"); await page.close(); return; }
  if (g.rowChip) fails.push(tag + ": a .rd-chip is still inside .rd-cc-row");
  if (!g.chipInTools) fails.push(tag + ": chip is not in the cyc-tpp eyebrow tools slot");
  if (g.drawnInControls) fails.push(tag + ": the drawn-over-the-band row is still inside .rd-cc (it belongs up with the chip)");
  /* the band floats just above the divider: its bottom edge rests 12px
     clear of the 2px rule (the reader asked for it above the line, never
     straddling it) and flush with the eyebrow's LEFT edge at every
     width - checked as the WRAP's bottom so the check holds when the
     drawn pills (taller than the chip) joined the band */
  const gap = g.ruleY - g.wrap.b;
  if (Math.abs(gap - 12) > 1.6) fails.push(tag + ": band bottom sits " + gap.toFixed(1) + "px above the divider " + g.ruleY.toFixed(1) + ", not ~12px (wrap bottom " + g.wrap.b.toFixed(1) + ")");
  /* the band's chips are the ~80% cut of the shared chrome the reader asked
     for ("reduce the size of the cycles chips by 20%"): 11px type on a 29px
     chip (the shared .rd-chip is 14px/36px) */
  if (g.chipFs !== "11px") fails.push(tag + ": the band chip reads " + g.chipFs + ", not the shrunk 11px");
  if (Math.abs(g.chip.b - g.chip.t - 29) > 1) fails.push(tag + ": the band chip is " + (g.chip.b - g.chip.t).toFixed(1) + "px tall, not ~29px");
  if (Math.abs(g.chip.l - g.ebLeft) > 1.5) fails.push(tag + ": chip left edge " + g.chip.l.toFixed(1) + " != eyebrow left edge " + g.ebLeft.toFixed(1));
  if (g.pos !== "absolute") fails.push(tag + ": .rd-cyc-chipmove is not absolutely positioned (" + g.pos + ")");
  if (!/^＋ Draw a( past)? term$/.test(g.label)) fails.push(tag + ": unexpected chip label '" + g.label + "'");
  const overlap = (a, b) => {
    if (!a || !b) return 0;
    const h = Math.min(a.b, b.b) - Math.max(a.t, b.t);
    const w = Math.min(a.r, b.r) - Math.max(a.l, b.l);
    return h > 0 && w > 0 ? h * w : 0;
  };
  if (overlap(g.chip, g.meta) > 1) fails.push(tag + ": chip overlaps the eyebrow meta text by " + overlap(g.chip, g.meta).toFixed(0) + "px2");
  if (overlap(g.chip, g.title) > 1) fails.push(tag + ": chip overlaps the title by " + overlap(g.chip, g.title).toFixed(0) + "px2");
  /* the default picture keeps the verdict words; they must vanish as soon
     as a term is lifted (checked after the lift below) */
  if (!/Government ahead/.test(g.svg) || !/Opposition ahead/.test(g.svg)) fails.push(tag + ": default tpp chart lost its Government/Opposition ahead pair");
  if (!/(above|below) average/.test(g.svg)) fails.push(tag + ": default tpp chart lost the above/below-average reading");
  if (!/Labor/.test(g.svg)) fails.push(tag + ": default tpp chart lost the sitting term's figure ('Labor …' not found in the svg)");

  /* toggle round-trip setup + the lift case: at <=900px the board is a
     FIXED bottom sheet hugging up to 75vh of the viewport (rd.css media
     block), so the chip/title must sit in the exposed top band: anchor the
     chip centre at viewport y=110, below the 72px sticky tabs and above the
     shallowest sheet top (211px at 844 tall). Clicking a point under the
     sheet is not a fair test - the sheet eats it, as any overlaid content
     does. */
  const chipSel = "#cyc-tpp .rd-cyc-chipmove .rd-chip";
  const boardOpen = () => page.evaluate(() => !!document.querySelector(".rd-cc-board"));
  const anchorChip = () => page.$eval(chipSel, (el) => {
    window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 110);
  });
  await anchorChip();
  await sleep(250);
  /* the chip must be visible above any sheet before its first click */
  const chipY = await page.$eval(chipSel, (el) => el.getBoundingClientRect().top);
  if (chipY < 72 || chipY > 200) fails.push(tag + ": chip anchored at viewport y " + chipY.toFixed(0) + ", outside the 72-200px band needed for sheet clearance");

  /* open the board and draw a past term as its own line: the picked term's
     pill and the sitting term's read-only pill must appear up with the
     chip, and the chart's verdict words must go */
  await page.click(chipSel);
  await sleep(300);
  if (!(await boardOpen())) fails.push(tag + ": chip click did not open the board (lift case)");
  const picked = await page.$eval(".rd-cc-term:not(.current) .rd-cc-main", (el) => {
    const year = el.querySelector("b").textContent.trim();
    el.click();
    return year;
  });
  await sleep(300);
  const afterLift = await page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const drawn = q("#cyc-tpp .rd-cyc-chipmove .rd-cc-drawn");
    const chip = q("#cyc-tpp .rd-cyc-chipmove .rd-chip");
    const eb = q("#cyc-tpp .rd-eyebrow");
    const wrap = q("#cyc-tpp .rd-cyc-chipmove");
    const ebs = getComputedStyle(eb);
    const r = (el) => el.getBoundingClientRect();
    const pills = drawn ? Array.from(drawn.querySelectorAll(".rd-cc-pill")).map((p) => ({
      text: p.textContent.replace(/\s+/g, " ").trim(),
      cur: p.classList.contains("rd-cc-cur"),
      btn: !!p.querySelector("button"),
    })) : [];
    const firstPill = drawn ? drawn.querySelector(".rd-cc-pill") : null;
    return {
      drawn: !!drawn,
      text: drawn ? drawn.textContent.replace(/\s+/g, " ").trim() : "",
      pills,
      pillFs: firstPill ? getComputedStyle(firstPill).fontSize : null,
      pillH: firstPill ? r(firstPill).bottom - r(firstPill).top : null,
      svg: Array.from(document.querySelectorAll("#cyc-tpp svg")).map((s) => s.textContent).join(" "),
      gap: (r(eb).top + parseFloat(ebs.borderTopWidth) / 2) - r(wrap).bottom,
      chipL: r(chip).left,
      chipB: r(chip).bottom,
      drawnL: drawn ? r(drawn).left : null,
      drawnT: drawn ? r(drawn).top : null,
      ebLeft: r(eb).left,
      wrapT: r(wrap).top,
      footB: (() => { const f = q("#cyc-summary .rd-foot"); return f ? r(f).bottom : null; })(),
    };
  });
  if (!afterLift.drawn) fails.push(tag + ": lifting " + picked + " did not raise the drawn-over-the-band row up with the chip");
  else {
    if (!/Drawn over the band/.test(afterLift.text)) fails.push(tag + ": the raised row lost its 'Drawn over the band' label");
    /* the band stacks down: chip on top, the drawn row directly beneath
       it, both ends flush with the eyebrow's left edge */
    if (afterLift.chipB > afterLift.drawnT + 1) fails.push(tag + ": the chip is not above the drawn row (chip bottom " + afterLift.chipB.toFixed(1) + " > drawn top " + afterLift.drawnT.toFixed(1) + ")");
    if (Math.abs(afterLift.drawnL - afterLift.ebLeft) > 1.5) fails.push(tag + ": drawn row left edge " + afterLift.drawnL.toFixed(1) + " != eyebrow left edge " + afterLift.ebLeft.toFixed(1));
    /* the stack's top must stay clear of the Summary section's foot - the
       640px floor gives the headroom at this width, and the chipmove
       refit grows it inline whenever the wrapped pills need more */
    if (afterLift.footB != null && afterLift.wrapT < afterLift.footB - 0.6) fails.push(tag + ": band top " + afterLift.wrapT.toFixed(1) + " overlaps the Summary foot (bottom " + afterLift.footB.toFixed(1) + ")");
    const past = afterLift.pills.filter((p) => !p.cur);
    if (!past.some((p) => p.text.indexOf(picked) === 0 && p.btn)) fails.push(tag + ": no unliftable pill for the lifted " + picked + " term (pills: " + afterLift.pills.map((p) => p.text).join(" | ") + ")");
    /* the pills are the same ~80% cut as the band chip: 11px type, 27px
       ring-to-ring (27px min-height is box-sizing: border-box, so the
       1.5px borders eat into it — OLD 34px included them the same way) */
    if (afterLift.pillFs !== "11px") fails.push(tag + ": a drawn pill reads " + afterLift.pillFs + ", not the shrunk 11px");
    if (afterLift.pillH == null || Math.abs(afterLift.pillH - 27) > 1) fails.push(tag + ": a drawn pill is " + (afterLift.pillH == null ? "n/a" : afterLift.pillH.toFixed(1)) + "px tall ring-to-ring, not ~27px");
    const cur = afterLift.pills.filter((p) => p.cur);
    if (cur.length !== 1) fails.push(tag + ": expected exactly one sitting-term pill while " + picked + " is drawn, found " + cur.length);
    else {
      if (!/^20\d\d /.test(cur[0].text)) fails.push(tag + ": sitting-term pill does not read like '2025 Albanese' ('" + cur[0].text + "')");
      if (!cur[0].btn) fails.push(tag + ": the sitting-term pill carries no cancel cross - the reader asked for one ('add an x for Albanese 2025')");
    }
    if (Math.abs(afterLift.gap - 12) > 1.6) fails.push(tag + ": with pills up, band bottom sits " + afterLift.gap.toFixed(1) + "px above the divider, not ~12px");
  }
  if (/Government ahead|Opposition ahead/.test(afterLift.svg)) fails.push(tag + ": the ahead pair survived a term being drawn over the band");
  if (/(above|below) average/.test(afterLift.svg)) fails.push(tag + ": the above/below-average reading survived a term being drawn over the band");
  if (!/Labor/.test(afterLift.svg)) fails.push(tag + ": the sitting term's figure went missing after the lift (only the verdict words should go)");

  /* return the term to the band via its pill: row, pill and chart words
     all restore with it */
  const unlifted = await page.evaluate(() => {
    const p = Array.from(document.querySelectorAll("#cyc-tpp .rd-cyc-chipmove .rd-cc-pill:not(.rd-cc-cur) button"))[0];
    if (!p) return false;
    p.click();
    return true;
  });
  if (!unlifted) fails.push(tag + ": no pill cross to unlift " + picked);
  await sleep(300);
  const restored = await page.evaluate(() => ({
    drawn: !!document.querySelector(".rd-cc-drawn"),
    svg: Array.from(document.querySelectorAll("#cyc-tpp svg")).map((s) => s.textContent).join(" "),
  }));
  if (restored.drawn) fails.push(tag + ": the drawn-over-the-band row survived its only term being returned");
  if (!/Government ahead/.test(restored.svg)) fails.push(tag + ": the ahead pair did not return when the lifted term went back to the band");
  if (!/(above|below) average/.test(restored.svg)) fails.push(tag + ": the above/below-average reading did not return with the lifted term");

  /* many terms drawn at once: the pills wrap to several rows, and the band
     is out of flow - the chipmove refit must grow #cyc-tpp's headroom in
     step so the tall stack pushes the page down instead of climbing over
     the Summary section's foot above. Then, back to zero drawn terms, the
     inline growth must go away (the 640px floor handles the phone's
     single-row case, so nothing clever should pin below one wrapped row) */
  if (!(await boardOpen())) { await page.click(chipSel); await sleep(300); }
  const manyYears = await page.evaluate(() => {
    const mains = Array.from(document.querySelectorAll(".rd-cc-term:not(.current) .rd-cc-main"));
    const got = [];
    for (const m of mains) {
      if (got.length >= 6) break;
      const y = m.querySelector("b").textContent.trim();
      m.click();
      got.push(y);
    }
    return got;
  });
  await sleep(400);
  const afterMany = await page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const sec = q("#cyc-tpp");
    const wrap = q("#cyc-tpp .rd-cyc-chipmove");
    const foot = q("#cyc-summary .rd-foot");
    const drawn = q("#cyc-tpp .rd-cc-drawn");
    const eb = q("#cyc-tpp .rd-eyebrow");
    const ebs = getComputedStyle(eb);
    const r = (el) => el.getBoundingClientRect();
    const rows = drawn ? (() => { const tops = new Set(); drawn.querySelectorAll(".rd-cc-pill").forEach((p) => tops.add(Math.round(p.getBoundingClientRect().top))); return tops.size; })() : 0;
    return {
      rows,
      padTop: parseFloat(getComputedStyle(sec).paddingTop),
      varPad: sec.style.getPropertyValue("--cyc-chip-pad"),
      wrapT: r(wrap).top,
      wrapB: r(wrap).bottom,
      ruleY: r(eb).top + parseFloat(ebs.borderTopWidth) / 2,
      footB: foot ? r(foot).bottom : null,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  if (manyYears.length < 3) fails.push(tag + ": could not lift enough terms for the many-drawn case (" + manyYears.length + ")");
  if (afterMany.wrapT < (afterMany.footB == null ? -Infinity : afterMany.footB - 0.6)) fails.push(tag + ": with six terms drawn, band top " + afterMany.wrapT.toFixed(1) + " climbs over the Summary foot (bottom " + (afterMany.footB == null ? "n/a" : afterMany.footB.toFixed(1)) + ")");
  if (afterMany.rows >= 2 && !afterMany.varPad) fails.push(tag + ": the drawn pills wrapped to " + afterMany.rows + " rows but --cyc-chip-pad was never raised inline");
  if (Math.abs(afterMany.ruleY - afterMany.wrapB - 12) > 1.6) fails.push(tag + ": with six terms drawn, band bottom sits " + (afterMany.ruleY - afterMany.wrapB).toFixed(1) + "px above the divider, not ~12px");
  if (afterMany.overflow > 0) fails.push(tag + ": six drawn terms caused horizontal page overflow (" + afterMany.overflow + "px)");
  /* and the fit lets go again when the board is cleared */
  await page.evaluate(() => {
    const chips = Array.from(document.querySelectorAll("#cyc-tpp .rd-cyc-chipmove .rd-cc-pill:not(.rd-cc-cur) button"));
    chips.forEach((b) => b.click());
  });
  await sleep(400);
  const afterClear = await page.evaluate(() => {
    const sec = document.querySelector("#cyc-tpp");
    return {
      drawn: !!document.querySelector("#cyc-tpp .rd-cc-drawn"),
      varPad: sec.style.getPropertyValue("--cyc-chip-pad"),
      padTop: parseFloat(getComputedStyle(sec).paddingTop),
    };
  });
  if (afterClear.drawn) fails.push(tag + ": unlifting every pill did not drop the drawn row");
  if (afterClear.varPad) fails.push(tag + ": --cyc-chip-pad still pinned at " + afterClear.varPad + " after every drawn term returned");
  if (afterClear.padTop > 60.5) fails.push(tag + ": #cyc-tpp padding stayed grown at " + afterClear.padTop + "px after every drawn term returned");

  /* the sitting term's pill carries its own cross now (reader: "add an x
     for Albanese 2025 - currently it's not cancellable"): clicking it takes
     the term off the board exactly like any other term's eye - its line,
     its figure and its pill all go (the drawn row needs one past term
     lifted, or the pill never renders) - and the board's eye on the
     current row puts it straight back. */
  if (!(await boardOpen())) { await anchorChip(); await sleep(250); await page.click(chipSel); await sleep(300); }
  await page.evaluate(() => { const m = document.querySelector(".rd-cc-term:not(.current) .rd-cc-main"); if (m) m.click(); });
  await sleep(300);
  const curXed = await page.evaluate(() => {
    const b = document.querySelector("#cyc-tpp .rd-cyc-chipmove .rd-cc-cur button");
    if (b) b.click();
    return !!b;
  });
  if (!curXed) fails.push(tag + ": no cancel cross on the sitting-term pill to click");
  await sleep(300);
  const afterCurX = await page.evaluate(() => {
    const eye = document.querySelector(".rd-cc-term.current .rd-cc-x");
    return {
      curPill: !!document.querySelector("#cyc-tpp .rd-cc-cur"),
      svg: Array.from(document.querySelectorAll("#cyc-tpp svg")).map((s) => s.textContent).join(" "),
      eye: eye ? eye.textContent.trim() : null,
      eyeLbl: eye ? eye.getAttribute("aria-label") : null,
    };
  });
  if (afterCurX.curPill) fails.push(tag + ": the sitting term's pill survived its own cross");
  if (/Labor/.test(afterCurX.svg)) fails.push(tag + ": the sitting term's figure stayed on the tpp chart after its own cross (hidden must mean hidden)");
  if (afterCurX.eye !== "+") fails.push(tag + ": the board's current row does not offer the term back after the cross (eye reads '" + afterCurX.eye + "', want '+')");
  if (!/back on the board/.test(afterCurX.eyeLbl || "")) fails.push(tag + ": the current row's eye does not read as a restore ('" + afterCurX.eyeLbl + "')");
  const putBack = await page.evaluate(() => {
    const b = document.querySelector(".rd-cc-term.current .rd-cc-x");
    if (b) b.click();
    return !!b;
  });
  await sleep(300);
  const afterPutBack = await page.evaluate(() => ({
    curPill: !!document.querySelector("#cyc-tpp .rd-cyc-chipmove .rd-cc-cur"),
    svg: Array.from(document.querySelectorAll("#cyc-tpp svg")).map((s) => s.textContent).join(" "),
  }));
  if (!putBack) fails.push(tag + ": no eye on the current row to put the term back");
  if (!afterPutBack.curPill) fails.push(tag + ": putting the current term back did not return its pill");
  if (!/Labor/.test(afterPutBack.svg)) fails.push(tag + ": the sitting term's figure did not come back with the term");
  /* tidy: return the lifted term so the toggle round-trips start default */
  await page.evaluate(() => {
    const p = Array.from(document.querySelectorAll("#cyc-tpp .rd-cyc-chipmove .rd-cc-pill:not(.rd-cc-cur) button"))[0];
    if (p) p.click();
  });
  await sleep(300);

  /* toggle round-trip: open; second chip click must close (the dismiss
     hook would otherwise swallow the toggle); outside click/tap must close
     too. */
  if (!(await boardOpen())) fails.push(tag + ": board was not still open after the lift round-trip");
  await anchorChip();
  await sleep(250);
  await page.click(chipSel);
  await sleep(300);
  if (await boardOpen()) fails.push(tag + ": chip click did not close the board (dismiss hook swallowed the toggle)");
  await page.click(chipSel);
  await sleep(300);
  if (!(await boardOpen())) fails.push(tag + ": board did not re-open for the outside-dismiss case");
  const titleSel = "#cyc-tpp .rd-eyebrow .rd-title";
  if (touch) {
    const t = await(page.$(titleSel)).then((el) => el.boundingBox());
    await page.touchscreen.tap(t.x + t.width / 2, t.y + t.height / 2);
  } else {
    await page.click(titleSel);
  }
  await sleep(300);
  if (await boardOpen()) fails.push(tag + ": outside " + (touch ? "tap" : "click") + " did not dismiss the board");
  /* and the board's own close cross still works */
  await page.click(chipSel);
  await sleep(300);
  await page.click(".rd-cc-board .rd-iconbtn");
  await sleep(300);
  if (await boardOpen()) fails.push(tag + ": board close cross stopped working");
  await page.close();
}

await run(1440, 960, false);
await run(820, 900, false);
await run(390, 844, true);

console.log(fails.length ? "FAIL\n" + fails.join("\n") : "ok");
await browser.close();
server.close();
process.exit(fails.length ? 1 : 0);
