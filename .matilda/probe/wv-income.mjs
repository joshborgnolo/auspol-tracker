/* wv-income.mjs — the Who-votes INCOME tab (latent-curve pooling, 2026-10-16,
   replacing 8acacb93's naive extreme-bracket tilts). The tab is spliced onto
   D.demographics' tabs inside RdDemographics only (repo rule 5: never into
   the shared demographics payload). Per wave and party it fits a vote-share
   line over the electorate's income-QUANTILE axis — weighted least squares
   through the house's own printed brackets, each cell weighted by its census
   share — and reads the line at two standard bands of the electorate, the
   bottom half and the top 15%+ (INCOME_STD_BANDS in demo-groups.mjs). The
   standardised shares pool through the same tilt machinery as every group.

   unit — the quantile map (incomeQuantiles against data/income-dist.json),
     the fit identities (2-band exact fit, 4-band independent per-party fit,
     <2-cell wave fits nothing, support never extrapolates), and the
     DEMO_SHARE widths matching the standard bands.
   desktop — the tab sits last in the group row, straight after Home; the
     live D.demographics.tabs carries no "income"; the dek gains the
     standardised-reads note ONLY on the income tab; the sethead pill names
     each in-window house's own end brackets; the two rows' figures track
     the live D.demoIncome payload for the picked party (One Nation default,
     then Labor); the window's poll set is exactly the five newest
     income-in-window polls; per-wave rug dots render.
   phone — same essentials at 390px.
   ?design=old — the frozen classic panel never hears about it: no Income
     option in its segmented row, no earners rows anywhere in the card, and
     D.demographics itself stays free of the earners strings. */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
import { incomeQuantiles, incomeFit, INCOME_STD_BANDS, INCOME_GRIDS, DEMO_SHARE }
  from "../../.build/newtracker/demo-groups.mjs";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const results = [];
const ok = (name, pass, detail) => {
  results.push([name, !!pass]);
  console.log((pass ? "  ✓ " : "  ✗ ") + name + (detail !== undefined ? "  — " + detail : ""));
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
const DEK_NOTE =
  /Each house's own brackets, read at the same two bands of the electorate \(bottom half, top 15%\+\)\./;

console.log("== unit: the quantile map and the fit ==");
const dist = JSON.parse(await readFile(join(ROOT, "data", "income-dist.json"), "utf8"));
{
  const yg = incomeQuantiles("YouGov", dist);
  ok("YouGov's two grid eras map as two variants, binary first",
     yg && yg.length === INCOME_GRIDS.YouGov.variants.length && yg[0].cells.length === 2 && yg[1].cells.length === 4);
  ok("YouGov's binary split lands at q ≈ 0.46 ( median household income near its $100k cut )",
     yg && yg[0].cells[0].qLo === 0 && near(yg[0].cells[0].qHi, 0.464, 0.003) && yg[0].cells[1].qHi === 1,
     yg && "cut at " + yg[0].cells[0].qHi.toFixed(3));
  const np = incomeQuantiles("Newspoll (pooled)", dist)[0].cells;
  ok("Newspoll's four cells split near q = 0.227 / 0.464 / 0.655",
     near(np[0].qHi, 0.227, 0.003) && near(np[1].qHi, 0.464, 0.003) && near(np[2].qHi, 0.655, 0.003),
     np.map((c) => c.qHi.toFixed(3)).join(" / "));
  ok("cell shares sum to 1 on every variant",
     Object.keys(INCOME_GRIDS).every((h) => incomeQuantiles(h, dist)
       .every((v) => near(v.cells.reduce((t, c) => t + c.sh, 0), 1, 1e-9))));
}
{
  /* 2-band identity: with only the binary pair present the fit IS the line
     through the two cell midpoints — a read between them interpolates */
  const cells = incomeQuantiles("YouGov", dist)[0].cells;
  const dim = { [cells[0].key]: { alp: 25 }, [cells[1].key]: { alp: 45 } };
  const fit = incomeFit(cells, dim).fits.alp;
  const line = (q) => fit.a + fit.b * q;
  const [m1, m2] = [cells[0].qMid, cells[1].qMid];
  ok("the 2-point fit passes exactly through both cell midpoints",
     fit && near(line(m1), 25) && near(line(m2), 45), fit && `b=${fit.b.toFixed(3)}`);
  ok("a read inside the support interpolates", fit && near(line((m1 + m2) / 2), 35));
  ok("a wave printing only one cell fits nothing",
    incomeFit(cells, { [cells[0].key]: { alp: 25 } }) === null);
}
{
  /* 4-band independent fit: each party's line is its OWN points' regression —
     a party follows its slope, a flat party stays flat, one missing a cell
     fits through the cells it printed, and one printed once fits nothing */
  const cells = incomeQuantiles("Newspoll (pooled)", dist)[0].cells;
  const at = (q) => 30 + 10 * q;
  const dim = Object.fromEntries(cells.map((c, i) => [c.key, i < 3
    ? { alp: at(c.qMid), onp: 28, grn: 8, ...(i === 0 ? { oth: 5 } : {}) }
    : { alp: at(c.qMid), onp: 28 }]));
  const { fits, support } = incomeFit(cells, dim);
  const line = (f) => (q) => f.a + f.b * q;
  ok("a collinear party's fit recovers its own line exactly",
     fits && near(fits.alp.a, 30, 1e-6) && near(fits.alp.b, 10, 1e-6)
       && near(line(fits.alp)(0.25), 32.5, 1e-6) && near(line(fits.alp)(0.925), 39.25, 1e-6),
     fits && `a=${fits.alp.a.toFixed(4)} b=${fits.alp.b.toFixed(4)}`);
  ok("a flat party's line stays flat (independent of the sloping party)",
     fits && near(fits.onp.b, 0, 1e-6) && near(fits.onp.a, 28, 1e-6));
  ok("a party missing the top cell fits only through its own points' support",
     fits && near(fits.grn.b, 0, 1e-6) && support && support.grn[1] === cells[2].qHi && support.grn[0] === 0);
  ok("a party printed once fits nothing", fits && fits.oth === null, fits && String(fits.oth));
}
{
  ok("DEMO_SHARE widths equal the standard bands' widths",
     near(DEMO_SHARE[INCOME_STD_BANDS[0].group], INCOME_STD_BANDS[0].hi - INCOME_STD_BANDS[0].lo)
       && near(DEMO_SHARE[INCOME_STD_BANDS[1].group], INCOME_STD_BANDS[1].hi - INCOME_STD_BANDS[1].lo),
     `${DEMO_SHARE[INCOME_STD_BANDS[0].group]} / ${DEMO_SHARE[INCOME_STD_BANDS[1].group]}`);
  ok("the standard bands ARE bottom half + top 15%+ of the quantile axis",
     INCOME_STD_BANDS.length === 2 && near(INCOME_STD_BANDS[0].hi, 0.5) && near(INCOME_STD_BANDS[1].lo, 0.85));
  ok("the band labels carry their electorate ranges in the name",
     INCOME_STD_BANDS[0].group === "Lower earners (bottom 50%)"
       && INCOME_STD_BANDS[1].group === "Higher earners (top 15%)",
     INCOME_STD_BANDS[0].group + " / " + INCOME_STD_BANDS[1].group);
}

const PORT = 9027;
const MIME = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json",
               ".css": "text/css", ".woff2": "font/woff2", ".svg": "image/svg+xml", ".xml": "application/xml" };
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p === "/") p = "/index.html";
    if (p.endsWith("/")) p += "index.html";
    res.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" });
    res.end(await readFile(join(ROOT, p)));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(PORT, r));
const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new" });

/* the page's own copies of the payloads (the assertions price themselves
   off these, not off hard-coded vintage figures) */
const payload = (page) => page.evaluate(() => {
  const D = window.AP.D;
  return { demoTabs: D.demographics.tabs.map((t) => ({ id: t.id, label: t.label })),
           income: D.demoIncome, demoPure: JSON.stringify(D.demographics) };
});
const tabLabels = (page) => page.$$eval("#who-votes .rd-wv-tabs .rd-tab", (bs) => bs.map((b) => b.textContent.trim()));
const clickTab = async (page, label) => {
  await page.evaluate((want) => {
    const b = [...document.querySelectorAll("#who-votes .rd-wv-tabs .rd-tab")]
      .find((x) => x.textContent.trim() === want);
    b.click();
  }, label);
};
const dekText = (page) => page.$eval("#who-votes .rd-dek", (el) => el.textContent);
/* the dot-plot's group rows as {label, figure} pairs */
const rows = (page) => page.$$eval("#who-votes .rd-wv-set .rd-wv-row", (rs) => rs.map((r) => ({
  label: r.querySelector(".rd-wv-lab").textContent.trim(),
  fig: parseFloat(r.querySelector(".rd-wv-v b").textContent),
})));

console.log("== desktop: the Income tab rides beside demographics ==");
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("#who-votes .rd-wv-tabs .rd-tab", { timeout: 20000 });
await sleep(600);

const P = await payload(page);
ok("D.demoIncome is emitted beside (never inside) D.demographics",
   P.income && !P.demoTabs.some((t) => t.id === "income"),
   "demoTabs " + P.demoTabs.map((t) => t.id).join(","));
ok("D.demographics stays byte-free of the earners rows",
   !/Lower earners|Higher earners/.test(P.demoPure));
ok("demoIncome is a single income set of the two earners tilts",
   P.income && P.income.sets.length === 1 &&
   JSON.stringify(P.income.sets[0].groups.map((g) => g.label)) === JSON.stringify(INCOME_STD_BANDS.map((b) => b.group)),
   P.income && P.income.sets[0].groups.map((g) => g.label).join(" / "));
{
  ok("the window's income set is exactly five polls of YouGov / DemosAU / Newspoll (pooled)",
     P.income.sets[0].groups.every((g) => g.n === 5)
       && JSON.stringify([...P.income.sets[0].groups[0].houses].sort())
            === JSON.stringify(["DemosAU", "Newspoll (pooled)", "YouGov"].sort()),
     P.income.sets[0].groups[0].houses.join(", "));
  ok("the roster lists every income-printing house, windowed or not",
     JSON.stringify([...P.income.roster].sort()) ===
       JSON.stringify([...Object.keys(INCOME_GRIDS)].sort()),
     P.income.roster.join(", "));
}

const labels0 = await tabLabels(page);
ok("the tab row ends …Home, Income", JSON.stringify(labels0.slice(-2)) === JSON.stringify(["Home", "Income"]),
   labels0.join(" | "));
ok("every payload tab is on the row, income last",
   JSON.stringify(labels0) === JSON.stringify(P.demoTabs.map((t) => t.label).concat(["Income"])));

const dekAge = await dekText(page);
ok("a demographics tab's dek names no income standardisation",
   !/bands of the electorate|own lowest and highest/.test(dekAge));

await clickTab(page, "Income");
await sleep(900);
ok("the income dek carries the standardised-reads note", DEK_NOTE.test(await dekText(page)));

/* the sethead pill: one span per in-window house, naming its own end brackets */
const pill = await page.evaluate(() => [...document.querySelectorAll("#who-votes .rd-wv-bands .rd-wv-band")]
  .map((el) => el.textContent.trim()));
const wantHouses = P.income.sets[0].houses.filter((h) => P.income.sets[0].bands[h]);
ok("the bands pill lists every in-window house",
   pill.length === wantHouses.length, pill.length + " vs " + wantHouses.length);
{
  const misses = [];
  for (const h of wantHouses) {
    const b = P.income.sets[0].bands[h];
    const hit = pill.some((t) => t.includes(b.low[0]) && t.includes(b.high[0]));
    if (!hit) misses.push(h);
  }
  ok("each pill spells its house's own low and high end brackets", misses.length === 0,
     misses.length ? "missing: " + misses.join(", ") : pill.join(" ‖ "));
  ok("each pill names its income basis (personal vs household)",
     pill.every((t) => /\((household|personal) income\)/.test(t)), pill.join(" ‖ "));
  ok("DemosAU's pill stipulates personal income",
     pill.some((t) => t.includes("DemosAU") && /\((personal) income\)/.test(t)) || !wantHouses.includes("DemosAU"),
     pill.join(" ‖ "));
}

/* figures track the live payload for the picked party */
const figures = (pty, got) =>
  P.income.sets[0].groups.every((g) => {
    const r = got.find((x) => x.label === g.label);
    return r && Math.abs(r.fig - g.v[pty]) < 0.06;
  });
{
  const got = await rows(page);
  ok("both earners rows render in order, ranges parenthesised",
     JSON.stringify(got.map((r) => r.label)) === JSON.stringify(INCOME_STD_BANDS.map((b) => b.group)));
  ok("figures match the payload's One Nation tilts", figures("onp", got),
     got.map((r) => r.label + " " + r.fig).join(", ") + " vs " +
     P.income.sets[0].groups.map((g) => "onp " + g.v.onp).join(", "));
  const rug = await page.$$eval("#who-votes .rd-wv-rug", (els) => els.length);
  ok("per-wave rug dots render on the income rows", rug > 0, rug + " rug spans");
}

/* switch party: the same rows re-read against the payload's ALP tilts */
await page.evaluate(() => {
  const chip = [...document.querySelectorAll("#who-votes .rd-chips .rd-chip")]
    .find((b) => /Labor/.test(b.textContent));
  chip.click();
});
await sleep(900);
{
  const got = await rows(page);
  ok("figures re-track the payload on the party switch (Labor)", figures("alp", got),
     got.map((r) => r.label + " " + r.fig).join(", ") + " vs " +
     P.income.sets[0].groups.map((g) => "alp " + g.v.alp).join(", "));
}
await page.close();

console.log("== phone 390px ==");
const mob = await browser.newPage();
await mob.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
await mob.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: "domcontentloaded" });
await mob.waitForSelector("#who-votes .rd-wv-tabs .rd-tab", { timeout: 20000 });
await sleep(600);
const labelsM = await tabLabels(mob);
ok("phone tab row also ends …Home, Income", JSON.stringify(labelsM.slice(-2)) === JSON.stringify(["Home", "Income"]),
   labelsM.join(" | "));
await clickTab(mob, "Income");
await sleep(900);
ok("phone dek carries the standardised-reads note", DEK_NOTE.test(await dekText(mob)));
{
  const n = await mob.$$eval("#who-votes .rd-wv-bands .rd-wv-band", (els) => els.length);
  ok("phone shows the bands pill", n === wantHouses.length, n + " spans");
  const got = await rows(mob);
  ok("phone figures match the payload's One Nation tilts", figures("onp", got),
     got.map((r) => r.label + " " + r.fig).join(", "));
}
await mob.close();

console.log("== ?design=old: the frozen classic panel never sees it ==");
const old = await browser.newPage();
await old.setViewport({ width: 1280, height: 900 });
await old.goto(`http://127.0.0.1:${PORT}/index.html?design=old`, { waitUntil: "domcontentloaded" });
await old.waitForSelector("section.card .card-title", { timeout: 20000 });
await sleep(800);
const oldDemo = await old.evaluate(() => {
  const sec = [...document.querySelectorAll("section.card")]
    .find((s) => { const h = s.querySelector(".card-title"); return h && /Who votes for whom/.test(h.textContent); });
  if (!sec) return null;
  return { options: [...sec.querySelectorAll(".demo-ctl .seg-btn")].map((b) => b.textContent.trim()),
           text: sec.textContent };
});
ok("the classic Who-votes card renders", !!oldDemo);
if (oldDemo) {
  ok("no Income option in the classic group row", !oldDemo.options.includes("Income"),
     oldDemo.options.join(" | "));
  ok("the classic card names no earners tilts", !/Lower earners|Higher earners/.test(oldDemo.text));
  /* rendered copy only – the note ships in script bodies for the redesign
     (glossary + dek note), which innerText rightly ignores */
  ok("no income-standardisation copy in anything the frozen page renders",
     !/bandLines|bottom half, top 15|own lowest and highest bands/.test(await old.evaluate(() => document.body.innerText)));
}
await old.close();

const fails = results.filter(([, p]) => !p);
console.log(`\n${results.length - fails.length}/${results.length} passed` + (fails.length ? ` — ${fails.length} FAILED` : ""));
await browser.close(); server.close();
process.exit(fails.length ? 1 : 0);
