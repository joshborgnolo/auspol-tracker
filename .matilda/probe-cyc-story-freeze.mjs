/* Past-cycles summary finding: the head/dek above the "Every measure N
   months in" table holds the same copy whichever Compare-with pill is
   picked (All past terms / Re-elected / Ousted) - the pick rescopes the
   table and charts, never the finding, which ranks the sitting term
   against every past term. The dek carries the dynamic claims:
     S1 "<gov>'s primary vote is the lowest of any government at the same
        point since 1972" (full-set "since", not a rescoped one)
     S2 "After preferences, though, <gov>'s NN.N% sits in the middle half
        of past governments" (the TPP now-figure, quartile ladder)
     S3 "But while <opp>'s primary vote is also the lowest of any
        opposition, it's <standing> when combined with One Nation's" (the combined
        L/NP + ON row's standing, mapped the-highest / second-or-third-
        highest-named / among-the-highest / in-the-middle-half /
        among-the-lowest)
   Expected copy is DERIVED from the summary table's own rank cells in the
   default state, so the probe tracks data as it moves; the freeze is the
   pinned contract. In the Change-since-election measure the finding is a
   different, One-Nation-free read, still frozen across the pills. The
   walk-floor box renders exactly the two measure states. */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PORT = 9018;
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

/* the same standing ladder the source uses, priced off a rank cell */
const ordHi = (rank) => { const mh = /^(\d+)(?:st|nd|rd|th) highest of (\d+)$/.exec(rank); return mh ? { hi: +mh[1], n: +mh[2] } : null; };
const standingOf = (rank) => /^Highest of/.test(rank) ? "the highest"
  : (ordHi(rank) && (ordHi(rank).hi === 2 || ordHi(rank).hi === 3)) ? { 2: "second", 3: "third" }[ordHi(rank).hi] + " highest"
  : (ordHi(rank) && ordHi(rank).hi <= Math.ceil(ordHi(rank).n / 4)) ? "among the highest"
  : /^Lowest of/.test(rank) || /^(\d+)(?:st|nd|rd|th) lowest of \d+$/.test(rank) && +/^(\d+)(?:st|nd|rd|th) lowest of \d+$/.exec(rank)[1] <= Math.ceil(+/^(\d+)(?:st|nd|rd|th) lowest of \d+$/.exec(rank)[2] / 4) ? "among the lowest"
  : "in the middle half";
const tppWhere = (rank) => {
  const o = ordHi(rank);
  if (/^Middle of/.test(rank)) return "sits in the middle half of past governments";
  if (o && o.hi <= Math.ceil(o.n / 4)) return "is above three in four of past governments";
  const ml = /^(\d+)(?:st|nd|rd|th) lowest of (\d+)$/.exec(rank);
  if (ml && +ml[1] <= Math.ceil(+ml[2] / 4)) return "is below three in four of past governments";
  return "sits in the middle half of past governments";
};

async function story(page) {
  return page.evaluate(() => {
    const sec = document.getElementById("cyc-summary");
    const hed = sec.querySelector(".rd-hed"), dek = sec.querySelector(".rd-dek");
    const rows = {};
    [...sec.querySelectorAll(".rd-cs-row")].forEach((r) => {
      const name = r.querySelector(".rd-cs-name b") && r.querySelector(".rd-cs-name b").textContent.trim();
      const sub = r.querySelector(".rd-cs-name > span") && r.querySelector(".rd-cs-name > span").textContent.trim();
      const now = r.querySelector(".rd-cs-now") && r.querySelector(".rd-cs-now").textContent.trim();
      const rank = r.querySelector(".rd-cs-rank b") && r.querySelector(".rd-cs-rank b").textContent.trim();
      if (name) rows[name] = { sub, now, rank };
    });
    const meta = sec.querySelector(".rd-eyebrow .rd-meta");
    return {
      head: hed && hed.textContent.trim(),
      dek: dek && dek.textContent.trim(),
      rows,
      metaYear: meta && (/Every term since (\d{4})/.exec(meta.textContent) || [])[1],
      varCount: sec.querySelectorAll(".rd-cyc-storyvar > div").length,
    };
  });
}
const clickPill = (page, l) => page.evaluate((lab) => {
  const btns = [...document.querySelectorAll('[aria-label="Compare with"] button')];
  const btn = btns.find((b) => b.textContent.trim().startsWith(lab))
    || (lab === "All past terms" && btns.find((b) => b.textContent.trim().startsWith("All")));
  if (btn) { btn.click(); return true; }
  return false;
}, l);
const clickMeasure = (page, prefix) => page.evaluate((p) => {
  const btn = [...document.querySelectorAll("#cyc-summary .rd-tab")]
    .find((b) => b.textContent.trim().startsWith(p) && b.getAttribute("aria-pressed") !== "true");
  if (btn) { btn.click(); return btn.textContent.trim(); }
  return null;
}, prefix);

async function run(W, H, touch) {
  const tag = W + "px" + (touch ? "-touch" : "");
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, hasTouch: touch });
  await page.goto(`http://127.0.0.1:${PORT}/index.html#cycles`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[aria-label="Compare with"]', { timeout: 20000 });
  await sleep(900);

  /* --- derive the expected finding from the table's own default-state cells --- */
  const s0 = await story(page);
  const gov = s0.rows["Government’s primary vote"].sub;
  const govRank = s0.rows["Government’s primary vote"].rank;
  const oppRank = s0.rows["Opposition’s primary vote"].rank;
  const oppSub = (s0.rows["Opposition’s primary vote"].sub || "").replace(/^The /, "the ");
  const tppNow = s0.rows["Two-party preferred"].now;
  const tppRank = s0.rows["Two-party preferred"].rank;
  const combRank = s0.rows["L/NP + ON combined primary vote"].rank;
  if (!gov || !govRank || !oppRank || !tppNow || !tppRank || !combRank || !s0.metaYear) {
    fails.push(tag + ": summary table cells unreadable - " + JSON.stringify(s0.rows));
    await page.close();
    return;
  }
  const gLow = /^Lowest/.test(govRank), oLow = /^Lowest/.test(oppRank);
  const s1 = gLow
    ? gov + "’s primary vote is the lowest of any government at the same point since " + s0.metaYear + "."
    : null; /* not today: the record-low rung is the one under contract */
  if (gLow) {
    const expectMid = s1 + " After preferences, though, " + gov + "’s " + tppNow + " " + tppWhere(tppRank) + "."
      + (oLow ? " But while " + oppSub + "’s primary vote is also the lowest of any opposition, it’s " + standingOf(combRank) + " when combined with One Nation’s." : "");
    const got = s0.dek.replace(/^.*?election, /, "");
    if (got !== expectMid) fails.push(tag + ": default dek body\n  GOT      " + got + "\n  EXPECTED " + expectMid);
  }
  if (s0.head !== "Both major parties are at record lows for this point in a term")
    fails.push(tag + ": head is not the record-lows finding: '" + s0.head + "'");
  if (s0.dek.indexOf("since " + s0.metaYear) < 0) fails.push(tag + ": dek lacks the full-set 'since " + s0.metaYear + "'");
  if (oLow && !/combined with One Nation’s\.$/.test(s0.dek)) fails.push(tag + ": dek is missing the One Nation combined sentence");
  if (s0.varCount !== 2) fails.push(tag + ": the walk-floor story box renders " + s0.varCount + " states, not the 2 measure states");

  /* --- the freeze: identical copy through every compare pill --- */
  for (const lab of ["Re-elected", "Ousted", "All past terms"]) {
    if (!(await clickPill(page, lab))) { fails.push(tag + ": no compare pill '" + lab + "'"); continue; }
    await sleep(750);
    const s = await story(page);
    if (lab !== "All past terms" && (s.head !== s0.head || s.dek !== s0.dek))
      fails.push(tag + ": the finding moved under '" + lab + "'\n  head: " + s.head + "\n  dek:  " + s.dek);
    if (/among terms whose government|those governments/.test(s.head + " " + s.dek))
      fails.push(tag + ": compare-scoped wording leaked into the finding under '" + lab + "'");
  }

  /* --- the change measure: a different read, still frozen, no One Nation tail --- */
  const how = await clickMeasure(page, "Change");
  if (!how) fails.push(tag + ": the change-measure tab didn't flip");
  await sleep(750);
  const c0 = await story(page);
  if (!/points|lost|worse|better|fall|further|risen/i.test(c0.head + " " + c0.dek))
    fails.push(tag + ": change-measure finding doesn't read as change: " + c0.head + " / " + c0.dek);
  if (/One Nation/.test(c0.dek)) fails.push(tag + ": the One Nation combined sentence leaked into the change measure: " + c0.dek);
  if (c0.dek === s0.dek) fails.push(tag + ": change-measure dek is identical to the level dek");
  for (const lab of ["Ousted", "Re-elected"]) {
    await clickPill(page, lab);
    await sleep(750);
    const s = await story(page);
    if (s.head !== c0.head || s.dek !== c0.dek)
      fails.push(tag + ": the change-measure finding moved under '" + lab + "'");
  }
  await clickPill(page, "All past terms");
  await sleep(400);
  await page.close();
}

await run(1440, 960, false);
await run(390, 844, true);
await browser.close();
server.close();
if (fails.length) { console.log("FAILS:"); fails.forEach((f) => console.log(" - " + f)); process.exit(1); }
console.log("ALL PASS");
