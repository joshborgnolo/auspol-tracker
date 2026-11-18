/* Pins the primary chart's no-aggregate dot guard (2026-11-19): a release
   that feeds no line (Roy Morgan's months-long pooled wave, Newspoll's
   quarterly tables, a Tasmania-only read) draws no all-voters scatter dot,
   while its Who-votes group-view dots survive untouched.
   Two-phase run against a build dir (argv[2], default repo root):
     1st run on an unmodified tree  -> records the dot counts
     2nd run after the edit+rebuild -> asserts the delta is exactly the dots
        of the no-aggregate rows the guard removes, no more
   Run: node .matilda/probe/noagg-scatter.mjs [buildroot] */
import { createServer } from "node:http";
import { existsSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { readFile, writeFile, unlink, access } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import puppeteer from "puppeteer-core";

const ROOT = resolve(process.argv[2] || fileURLToPath(new URL("../..", import.meta.url)));
const STATE = join(tmpdir(), "noagg-scatter-" + createHash("sha1").update(ROOT).digest("hex").slice(0, 12) + ".json");
const PHASE_VERIFY = !process.argv.includes("--record") && existsSync(STATE);
const PORT = 8983;
const MIME = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json",
               ".css": "text/css", ".woff2": "font/woff2", ".png": "image/png", ".svg": "image/svg+xml" };
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
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });
const errors = [];
page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push("CONSOLE: " + m.text()); });
await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: "networkidle0", timeout: 60000 });
await new Promise((r) => setTimeout(r, 1800));

let bad = 0;
const ok = (name, cond, detail) => {
  console.log((cond ? "  ok  " : "FAIL  ") + name + (detail ? " — " + detail : ""));
  if (!cond) bad++;
};

/* the pool row must still reach the page's data: the All-polls archive draws
   it from this same table, and nothing in this change touches the writers */
const dataChecks = await page.evaluate(() => {
  const ip = (window.AP && window.AP.D && window.AP.D.individualPolls) || [];
  const pool = ip.find((q) => q.pollster === "Roy Morgan (pooled)");
  const noAggRows = ip.filter((q) => q.noAgg);
  /* which other dot surfaces could leak: better-PM / 3PP / approval fields
     on a no-aggregate row would put it on those charts too */
  const leakFields = (q) => Object.entries({
    lead: q.lead && Object.values(q.lead).some((v) => typeof v === "number"),
    three: q.three && Object.values(q.three).some((v) => typeof v === "number"),
    appr: q.appr && Object.values(q.appr).some((v) => typeof v === "number"),
  }).filter(([, on]) => on).map(([k]) => k);
  return {
    pool: pool ? { field: pool.field, noAgg: !!pool.noAgg, alp: pool.p && pool.p.alp,
                   reason: (pool.noAggWhy || "").slice(18, 70) } : null,
    noAgg: noAggRows.map((q) => ({ pollster: q.pollster, released: q.released,
                                   dots: ["alp", "lnp", "onp", "grn", "oth"].filter((k) => q.p && q.p[k] != null).length,
                                   noAggHouse: !!q.noAggHouse, leaks: leakFields(q) })),
  };
});
ok("Roy Morgan (pooled) row still ships in individualPolls with noAgg", !!(dataChecks.pool && dataChecks.pool.noAgg),
   dataChecks.pool ? dataChecks.pool.field + " · " + dataChecks.pool.reason : "row missing");
if (PHASE_VERIFY) {
/* verify-phase contracts: these flags and guards came IN with the change,
   so a baseline (pre-change) run skips them */
/* the house-level flag: emitted on NO_AGG_HOUSES rows only, never on the
   row-level outs (YouGov's combined wave, the MRPs) whose ratings and MRP
   figures legitimately ride the house-level lines */
const flagged = dataChecks.noAgg.filter((r) => r.noAggHouse).map((r) => r.pollster);
const housePollsters = [...new Set(flagged)].sort();
ok("noAggHouse emitted on exactly the whole-series-out houses",
   JSON.stringify(housePollsters) === JSON.stringify(["EMRS (Tas)", "Newspoll (pooled)", "Roy Morgan (SMS)", "Roy Morgan (pooled)"].sort()),
   housePollsters.join(", "));
ok("row-level outs (YouGov combined, DemosAU MRPs) carry no house flag",
   dataChecks.noAgg.filter((r) => !r.noAggHouse).every((r) => /YouGov|DemosAU \(MRP\)|RedBridge/.test(r.pollster)),
   dataChecks.noAgg.filter((r) => !r.noAggHouse).map((r) => r.pollster).join(", "));
/* two no-aggregate rows carry approval nets apprAgg-style: YouGov's combined
   wave (IN the house-level lines, dot stays) and Roy Morgan (SMS) (out of
   them, dot guarded). Anything beyond that pair would be a new surface */
const apprCarriers = dataChecks.noAgg.filter((r) => r.leaks.includes("appr")).map((r) => r.pollster).sort();
ok("the only appr-carrying no-aggregate rows are the known pair",
   JSON.stringify([...new Set(apprCarriers)]) === JSON.stringify(["Roy Morgan (SMS)", "YouGov"]),
   apprCarriers.join(", "));
ok("no no-aggregate row carries better-PM figures", dataChecks.noAgg.every((r) => !r.leaks.includes("lead")));
}
const expectDelta = dataChecks.noAgg.reduce((n, r) => n + r.dots, 0);
console.log(`       noAgg rows on the page: ${dataChecks.noAgg.map((r) => `${r.pollster}(${r.dots} dots)`).join(", ")}`);

/* term window: click the LAST range tab of the primary card, then require
   the "Election" tick word so the dot-domain is provably all-encompassing */
await page.evaluate(() => {
  const tabs = [...document.querySelectorAll("#primary-vote .rd-tabs button, #primary-vote .rd-tabs [role=tab]")];
  tabs[tabs.length - 1].click();
});
await new Promise((r) => setTimeout(r, 1000));
const term = await page.evaluate(() => {
  const sec = document.getElementById("primary-vote");
  const svg = sec.querySelector(".rd-pv-chart svg");
  const ticks = [...svg.querySelectorAll("text")].some((t) => (t.textContent || "").trim() === "Election");
  return { electionTick: ticks, dots: svg.querySelectorAll('[class*="scatter"]').length };
});
ok("term window lands on the Election tick (dot domain covers every wave)", term.electionTick, "dots: " + term.dots);

/* the group view must be IDENTICAL before and after the all-voters guard.
   First choice: a birth-country cut, the §7g pooled release's own surface,
   if this menu carries one; otherwise the first stable group (Men) */
const grpOpt = await page.evaluate(() => {
  const sel = document.querySelector('#primary-vote select[aria-label="The primary vote among"]');
  if (!sel) return null;
  const opts = [...sel.options];
  const opt = opts.find((o) => /india|united kingdom|new zealand|^china/i.test(o.value)) || opts.find((o) => o.value === "Men");
  if (!opt) return null;
  sel.value = opt.value;
  sel.dispatchEvent(new Event("change", { bubbles: true }));
  return opt.value;
});
let grpDots = null;
if (grpOpt != null) {
  await new Promise((r) => setTimeout(r, 1400));
  grpDots = await page.evaluate(() => {
    const svg = document.querySelector("#primary-vote .rd-pv-chart svg");
    return svg ? svg.querySelectorAll('[class*="scatter"]').length : -1;
  });
  await page.evaluate(() => {
    const sel = document.querySelector('#primary-vote select[aria-label="The primary vote among"]');
    sel.value = [...sel.options][0].value; // back to All voters
    sel.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await new Promise((r) => setTimeout(r, 1200));
} else {
  console.log("       (no birth-country group option — group-view pin skipped)");
}
const burned = await page.evaluate(() => [...document.querySelectorAll("body *")].some((n) =>
  n.children.length === 0 && /hit an error and could not display/i.test(n.textContent || "")));
ok("no view burned down", !burned);
const errs = errors.filter((t) => !/favicon/i.test(t));
ok("no page errors", errs.length === 0, errs.slice(0, 2).join(" | "));

if (!PHASE_VERIFY) {
  await unlink(STATE).catch(() => {});
  await writeFile(STATE, JSON.stringify({ dots: term.dots, grpDots, expectDelta, grpOpt }, null, 2));
  console.log(`\n  recorded baseline: ${term.dots} all-voters dots, ${grpDots} group dots (${grpOpt}); the guard should remove ${expectDelta}`);
} else {
  const state = JSON.parse(await readFile(STATE, "utf8"));
  ok(`all-voters scatter lost exactly the ${state.expectDelta} no-aggregate dots`,
     state.dots - term.dots === state.expectDelta && state.expectDelta > 0,
     `pre ${state.dots} → post ${term.dots} (delta ${state.dots - term.dots}, expected ${state.expectDelta})`);
  if (grpOpt != null) ok(`group-view dots untouched (${state.grpOpt || grpOpt})`, state.grpDots === grpDots,
     `pre ${state.grpDots} → post ${grpDots}`);
  await unlink(STATE).catch(() => {});
}
await browser.close();
server.close();
if (bad) { console.error(`\n${bad} FAILures`); process.exit(1); }
console.log(PHASE_VERIFY ? "\nnoAgg scatter guard: ok" : "\nbaseline recorded — rebuild, then run again");
