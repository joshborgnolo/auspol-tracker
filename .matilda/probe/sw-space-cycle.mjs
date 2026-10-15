/* sw-space-cycle.mjs — the "Where One Nation's voters came from" title
   cycler's Space walk (viewport claim, 2026-10-15): Space steps the
   panel's three views in the title button's tap order — Where One
   Nation's voters came from -> Where the Coalition's voters are going
   -> Where Labor's voters are going -> wrap to came-from. A FOCUSED
   title button keeps its own Space (native activation taps it);
   off the viewport Space keeps its scroll day job.

   Neighbour claims on the Now tab: #two-party (hero matchup flip),
   #latest-polls (two-party facet only), #primary-vote (the group
   menu) and #who-votes (the party chips) hold the same key on their
   own sections, so the positive checks park the page where
   #switching is the ONLY claiming section on screen. #switching sits
   between #who-votes and the non-claiming sections (issues,
   undecided, mood), so claim-free spots exist below it. */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const PORT = 9024;
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
await page.waitForSelector("#switching .rd-sw-cycle", { timeout: 20000 });
await sleep(500);

const swState = () => page.evaluate(() => {
  const btn = document.querySelector("#switching .rd-sw-cycle");
  const h2 = document.querySelector("#switching h2");
  const t = h2 ? h2.textContent.trim() : "";
  const hint = btn ? btn.getAttribute("aria-label") : null;
  return { title: t,
           view: /came from/.test(t) ? "onp" : /Coalition/.test(t) ? "lnp" : /Labor/.test(t) ? "alp" : "?",
           hint,
           going: !!document.querySelector("#switching .rd-go-rows") };
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

console.log("== Space cycles the voter-switching views ==");
{
  const s0 = await swState();
  ok("loads on the came-from view", s0.view === "onp", JSON.stringify(s0.title));
  ok("the came-from view is the mosaic, not a going ladder", !s0.going, "go rows " + s0.going);
  ok("title button hints the first tap", /Coalition/.test(s0.hint || ""), JSON.stringify(s0.hint));
}
/* park where #switching alone holds the key: scroll to its top, then
   nudge 1px so #who-votes' bottom edge clears the viewport while
   #switching still intersects */
{
  const p = await page.evaluate(() => {
    const el = document.getElementById("switching");
    window.scrollTo(0, el.offsetTop + 1);
    const r = el.getBoundingClientRect();
    return { y: Math.round(window.scrollY), inView: r.bottom > 0 && r.top < window.innerHeight };
  });
  await sleep(600);
  const rs = await rects();
  const others = CLAIMANTS.filter((id) => id !== "switching").filter((id) => {
    const r = rs[id];
    return r && r.bottom > 0 && r.top < rs.vh;
  });
  ok("parked with only the switching panel claiming", p.inView && !others.length,
     others.length ? "still in view: " + others.join(", ") : JSON.stringify(p));
}

const yClaim = await page.evaluate(() => window.scrollY);
const seenViews = [(await swState()).view];
for (let i = 1; i <= 3; i++) {           /* three steps: Coalition, Labor, wrap */
  await page.keyboard.press("Space");
  await sleep(250);
  seenViews.push((await swState()).view);
}
ok("each Space steps to the next view, came-from -> Coalition -> Labor -> wrap",
   JSON.stringify(seenViews) === JSON.stringify(["onp", "lnp", "alp", "onp"]), seenViews.join(" -> "));
ok("page never scrolled while the claim held", (await page.evaluate(() => window.scrollY)) === yClaim,
   "scrollY " + (await page.evaluate(() => window.scrollY)) + " vs " + yClaim);

/* the going views really render: step once more to Coalition and check */
await page.keyboard.press("Space");
await sleep(300);
{
  const s = await swState();
  ok("Coalition view shows its going ladder", s.view === "lnp" && s.going, "view " + s.view + ", go rows " + s.going);
  ok("Coalition-view hint points at Labor", /Labor/.test(s.hint || ""), JSON.stringify(s.hint));
}

/* a FOCUSED title button owns Space: native activation taps it, which
   walks exactly one view (lnp -> alp) — the claim stands aside by the
   focus guard, so the view advances exactly once, not twice */
await page.evaluate(() => document.querySelector("#switching .rd-sw-cycle").focus());
await sleep(100);
await page.keyboard.press("Space");
await sleep(300);
ok("focused title button taps itself exactly once (Coalition -> Labor)", (await swState()).view === "alp",
   "view " + (await swState()).view);
await page.evaluate(() => { document.activeElement && document.activeElement.blur && document.activeElement.blur(); });
await sleep(100);
await page.keyboard.press("Space");
await sleep(300);
ok("claim resumes once the button blurs (Labor -> wrap to came-from)", (await swState()).view === "onp",
   "view " + (await swState()).view);

/* off the viewport Space keeps its scroll day job and leaves the views;
   park below the panel where NO claiming section intersects, with room
   to scroll further (the page bottom itself can't scroll) */
const spot = await page.evaluate(() => {
  const ids = ["two-party", "latest-polls", "primary-vote", "who-votes", "switching"];
  const max = document.documentElement.scrollHeight - window.innerHeight;
  const sw = document.getElementById("switching");
  for (let y = sw.offsetTop + sw.offsetHeight + 80; ; y += 300) {
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
ok("off-claim Space leaves the views alone", (await swState()).view === "onp",
   "view " + (await swState()).view);
await page.close();

const fails = results.filter(([, p]) => !p);
console.log(`\n${results.length - fails.length}/${results.length} passed` + (fails.length ? ` — ${fails.length} FAILED` : ""));
await browser.close(); server.close();
process.exit(fails.length ? 1 : 0);
