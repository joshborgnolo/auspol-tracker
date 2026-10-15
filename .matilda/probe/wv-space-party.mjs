/* wv-space-party.mjs — the Who votes for whom party chips' Space walk
   (viewport claim, 2026-10-15): Space steps the chips in their
   left-to-right / DEMO_PARTIES order — One Nation -> Labor -> Coalition
   -> Greens -> Others — the order the 1..5 digit keys number, and wraps
   Others round to One Nation. The panel pins its scroll spot through the
   head/dek rewrite each step kicks off. The panel's own SELECTED
   controls own Space the walk's way (user report 2026-10-16): the
   pressed party chip — a click's focus home, where native Space would
   dead-fire a re-pick — walks the cycle and the DOM focus rides along
   to the newly pressed chip; the pressed group-menu tab walks the chips
   while keeping the menu's own pick and focus. An UNPRESSED chip or
   menu tab keeps the key's day job (native Space activates it); off the
   viewport Space keeps its scroll day job.

   Neighbour claims on the Now tab: #two-party (hero matchup flip),
   #latest-polls (two-party facet only), #primary-vote (the group
   menu) and #switching (the title cycler, flush below this panel)
   hold the same key on their own sections, so the positive checks
   park the page where #who-votes is the ONLY claiming section on
   screen. Where #who-votes and #switching do share the screen, the
   bigger viewport share owns the key (rdSpaceDominant); both
   directions of that handover are pinned in sw-space-cycle.mjs. */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const PORT = 9023;
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

const results = [];
const ok = (name, pass, detail) => {
  results.push([name, !!pass]);
  console.log((pass ? "  ✓ " : "  ✗ ") + name + (detail !== undefined ? "  — " + detail : ""));
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CLAIMANTS = ["two-party", "latest-polls", "primary-vote", "who-votes", "switching"];
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("#who-votes .rd-chip", { timeout: 20000 });
await sleep(400);

const chipState = () => page.evaluate(() => {
  const chips = [...document.querySelectorAll("#who-votes .rd-chip")];
  const i = chips.findIndex((b) => b.getAttribute("aria-pressed") === "true");
  return { order: chips.map((b) => b.textContent.trim()), pressed: i,
           tint: i >= 0 ? chips[i].getAttribute("style") : null };
});
const rects = () => page.evaluate((ids) => {
  const out = {};
  for (const id of ids) {
    const el = document.getElementById(id);
    const r = el ? el.getBoundingClientRect() : null;
    out[id] = r ? { top: +r.top.toFixed(0), bottom: +r.bottom.toFixed(0) } : null;
  }
  out.vh = window.innerHeight;
  return out;
}, CLAIMANTS);

console.log("== Space walks the who-votes party chips ==");
{
  const s0 = await chipState();
  ok("chips are numbered 1..5 in DEMO_PARTIES order",
     JSON.stringify(s0.order) === JSON.stringify(["One Nation", "Labor", "Coalition", "Greens", "Others"]),
     s0.order.join(" | "));
  ok("starts on One Nation", s0.pressed === 0, "pressed index " + s0.pressed + (s0.tint ? " (" + s0.tint.split(";")[0] + ")" : ""));
}

/* park where #who-votes alone holds the key */
const parked = await page.evaluate(() => {
  const el = document.getElementById("who-votes");
  el.scrollIntoView({ block: "start" });
  window.scrollBy(0, -80);
  const r = el.getBoundingClientRect();
  return { y: Math.round(window.scrollY), wvInView: r.bottom > 0 && r.top < window.innerHeight };
});
{
  const rs = await rects();
  const others = CLAIMANTS.filter((id) => id !== "who-votes").filter((id) => {
    const r = rs[id];
    return r && r.bottom > 0 && r.top < rs.vh;
  });
  ok("parked with only the who-votes panel claiming", parked.wvInView && !others.length,
     others.length ? "still in view: " + others.join(", ") : JSON.stringify(parked));
}
await sleep(500);

const yClaim = await page.evaluate(() => window.scrollY);
const want = ["One Nation", "Labor", "Coalition", "Greens", "Others"];
const seen = [(await chipState()).order[(await chipState()).pressed]];
for (let i = 1; i <= 5; i++) {           /* five steps: walk 1..4 then wrap */
  await page.keyboard.press("Space");
  await sleep(150);
  const s = await chipState();
  seen.push(s.order[s.pressed]);
  if (i === 4) {         /* arrived at Others: tint follows the walked party */
    const g = await page.evaluate(() =>
      [...document.querySelectorAll("#who-votes .rd-chip")]
        .filter((b) => b.getAttribute("aria-pressed") === "true")
        .map((b) => b.getAttribute("style"))[0] || "");
    ok("the pressed chip carries the walked party's tint", /--tint-oth\b/.test(g), g.split(";")[0]);
  }
}
ok("each Space steps to the next chip, Others wraps to One Nation",
   JSON.stringify(seen) === JSON.stringify(want.concat("One Nation")), seen.join(" -> "));
ok("page never scrolled while the claim held", (await page.evaluate(() => window.scrollY)) === yClaim,
   "scrollY " + (await page.evaluate(() => window.scrollY)) + " vs " + yClaim);

/* a FOCUSED pressed chip owns Space the walk's way: native Space there
   would dead-fire a re-pick of the pick already made, so the claim
   walks the cycle instead and hands the DOM focus along with the pick
   (rdTabsKey's arrow walks do the same) - consecutive Spaces keep
   walking without ever needing a blur (user report 2026-10-16). Chips
   sit at One Nation after the wrap above. */
console.log("== Space on the panel's own selected controls ==");
await page.evaluate(() => document.querySelectorAll("#who-votes .rd-chip")[0].focus());
await sleep(100);
const focusedChip = () => page.evaluate(() =>
  [...document.querySelectorAll("#who-votes .rd-chip")].indexOf(document.activeElement));
for (let i = 1; i <= 3; i++) {
  await page.keyboard.press("Space");
  await sleep(200);
  const pr = (await chipState()).pressed, fi = await focusedChip();
  ok("Space " + i + " from the pressed chip walks the cycle and focus follows",
     pr === i && fi === i, "pressed " + pr + ", focus " + fi);
}

/* an UNPRESSED chip keeps the key's day job: native Space activates
   THAT chip - here Others, with the walk sitting on Greens */
await page.evaluate(() => document.querySelectorAll("#who-votes .rd-chip")[4].focus());
await sleep(100);
await page.keyboard.press("Space");
await sleep(200);
ok("unpressed chip keeps native Space (activates to Others)", (await chipState()).pressed === 4,
   "pressed index " + (await chipState()).pressed);

/* the SELECTED group-menu tab owns Space the same way: the party chips
   walk (Others wraps to One Nation) while the menu's own pick and the
   tab's DOM focus stay put - and a second Space walks on (to Labor),
   the tab never losing its pick or focus in between */
{
  const menu = await page.evaluate(() => {
    const tabs = [...document.querySelectorAll("#who-votes .rd-wv-tabs .rd-tab")];
    const at = tabs.findIndex((b) => b.getAttribute("aria-pressed") === "true");
    tabs[at].focus();
    return { at, count: tabs.length };
  });
  await sleep(100);
  await page.keyboard.press("Space");
  await sleep(200);
  {
    const m = await page.evaluate(() => {
      const tabs = [...document.querySelectorAll("#who-votes .rd-wv-tabs .rd-tab")];
      return { at: tabs.findIndex((b) => b.getAttribute("aria-pressed") === "true"),
               focusIsTab: !!(document.activeElement && document.activeElement.classList
                 && document.activeElement.classList.contains("rd-tab")) };
    });
    ok("Space on the selected menu tab walks the chips (Others -> One Nation)",
       (await chipState()).pressed === 0, "pressed index " + (await chipState()).pressed);
    ok("the menu's pick and the tab's focus survive the walk",
       m.at === menu.at && m.focusIsTab, "tab " + m.at + " vs " + menu.at + ", focusIsTab " + m.focusIsTab);
  }
  await page.keyboard.press("Space");
  await sleep(200);
  ok("a second Space from the same menu tab walks on (-> Labor)", (await chipState()).pressed === 1,
     "pressed index " + (await chipState()).pressed);
  /* an UNPRESSED menu tab keeps its day job too: native Space switches
     the grouping to it, the chips untouched */
  const nxt = (menu.at + 1) % menu.count;
  await page.evaluate((j) => document.querySelectorAll("#who-votes .rd-wv-tabs .rd-tab")[j].focus(), nxt);
  await sleep(100);
  await page.keyboard.press("Space");
  await sleep(300);
  const at2 = await page.evaluate(() =>
    [...document.querySelectorAll("#who-votes .rd-wv-tabs .rd-tab")]
      .findIndex((b) => b.getAttribute("aria-pressed") === "true"));
  ok("unpressed menu tab keeps native Space (the grouping switches to it)",
     at2 === nxt && at2 !== menu.at, "tab " + at2 + " vs next " + nxt);
  ok("the chips did not walk while the grouping switched", (await chipState()).pressed === 1,
     "pressed index " + (await chipState()).pressed);
}
/* blur hands the key back to the viewport claim: the chips walk on */
await page.evaluate(() => { document.activeElement && document.activeElement.blur && document.activeElement.blur(); });
await sleep(100);
await page.keyboard.press("Space");
await sleep(200);
ok("claim resumes once the menu tab blurs (Labor -> Coalition)", (await chipState()).pressed === 2,
   "pressed index " + (await chipState()).pressed);
const kept = (await chipState()).pressed;

/* off the viewport Space keeps its scroll day job and leaves the chips;
   park below the panel where NO claiming section intersects, with room
   to scroll further (the page bottom itself can't scroll) */
const spot = await page.evaluate(() => {
  const ids = ["two-party", "latest-polls", "primary-vote", "who-votes", "switching"];
  const max = document.documentElement.scrollHeight - window.innerHeight;
  const wv = document.getElementById("who-votes");
  for (let y = wv.offsetTop + wv.offsetHeight + 80; ; y += 300) {
    window.scrollTo(0, y);
    if (window.scrollY >= max - 60) return null;
    const free = ids.every((id) => {
      const el = document.getElementById(id);
      if (!el) return true;
      const r = el.getBoundingClientRect();
      return r.bottom <= 0 || r.top >= window.innerHeight;
    });
    if (free) return Math.round(window.scrollY);
  }
});
ok("found a claim-free spot with scroll room below the panel", spot !== null, "spot " + spot);
await sleep(400);
const off = await rects();
const stillClaimed = Object.entries(off).filter(([id, r]) => r && r.bottom > 0 && r.top < off.vh).map(([id]) => id);
ok("no claiming section on screen at the negative spot", stillClaimed.length === 0,
   stillClaimed.join(", ") || "none");
const yOff0 = await page.evaluate(() => window.scrollY);
await page.keyboard.press("Space");
await sleep(400);
ok("off-claim Space scrolls (day job)", (await page.evaluate(() => window.scrollY)) > yOff0,
   "scrollY " + (await page.evaluate(() => window.scrollY)) + " vs " + yOff0);
ok("off-claim Space leaves the chips alone", (await chipState()).pressed === kept,
   "pressed index " + (await chipState()).pressed);
await page.close();

const fails = results.filter(([, p]) => !p);
console.log(`\n${results.length - fails.length}/${results.length} passed` + (fails.length ? ` — ${fails.length} FAILED` : ""));
await browser.close(); server.close();
process.exit(fails.length ? 1 : 0);
