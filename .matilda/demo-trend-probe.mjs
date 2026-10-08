/* Probe: the "Who votes for whom" composition-trend block composes
   dynamically per party chip. For every chip, read the trend head + dek
   (#who-votes .rd-sub / .rd-subdek) and assert they match what the live
   demoTrend payload's moves imply (unchanged vs shifting), that the dek
   opens "Since July 2025,", and that onp/grn skew/hedge mechanics behave.
   Move populations are recomputed live from the bundle, not pinned, so the
   probe follows the data: it pins MECHANICS, not a snapshot of words. */
import puppeteer from "puppeteer-core";
import fs from "fs";

const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
if (!fs.existsSync(CHROME)) { console.error("no Chrome at " + CHROME); process.exit(2); }

// read the payload straight from the built data asset (same source the page
// uses); BASE lets it run against any checkout (default: the one we're in)
import path from "path";
const BASE = process.env.BASE || process.cwd();
globalThis.window = {};
const dir = path.join(BASE, ".build/newtracker/assets");
const bundle = fs.readdirSync(dir).find((x) => x.startsWith("9f09dca2"));
await import("file://" + path.join(dir, bundle));
const D = window.AUSPOL;
if (!D.demoTrend) { console.error("demoTrend missing from bundle"); process.exit(1); }
delete globalThis.window;

const fails = [];
const check = (ok, msg) => { console.log((ok ? "  ok " : "FAIL ") + msg); if (!ok) fails.push(msg); };

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.setViewport({ width: 1200, height: 900, deviceScaleFactor: 1 });
await page.goto("file://" + path.join(BASE, "index.html"), { waitUntil: "networkidle0", timeout: 60000 });
await page.waitForSelector("#who-votes .rd-sub", { timeout: 30000 });

const read = () => page.evaluate(() => ({
  head: document.querySelector("#who-votes .rd-sub")?.textContent || "",
  dek: document.querySelector("#who-votes .rd-subdek")?.textContent || "",
}));

const chips = await page.$$eval("#who-votes .rd-chip", (els) => els.map((e) => e.textContent));
console.log("  … party chips render as: " + chips.join(", "));
const CHIP_IDS = ["onp", "alp", "lnp", "grn", "oth"];
if (chips.length !== CHIP_IDS.length) { fails.push("chip count"); console.error("expected 5 chips"); process.exit(1); }

const since = (dt) => {
  const m = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const [y, mo] = dt.windowYm.split("-").map(Number);
  return "Since " + m[mo - 1] + " " + y;
};

for (let i = 0; i < CHIP_IDS.length; i++) {
  const id = CHIP_IDS[i];
  await page.evaluate((i) => {
    const els = document.querySelectorAll("#who-votes .rd-chip");
    els[i].scrollIntoView(); els[i].click();
  }, i);
  await new Promise((r) => setTimeout(r, 700)); // party switch morphs the copy blocks
  const s = await read();
  const dt = D.demoTrend[id];
  const moves = (dt && dt.moves) || [];
  console.log("\n· " + chips[i] + " (" + moves.length + " move(s) in payload)");
  console.log("  head: " + s.head);
  console.log("  dek:  " + s.dek);

  check(!!s.head && !!s.dek, id + ": trend block renders head and dek");
  check(s.dek.startsWith(since(dt)), id + ": dek opens with the " + since(dt) + " window");
  const solidMoves = moves.filter((m) => !m.thin), thinMoves = moves.filter((m) => m.thin);
  /* the generator drops a thin move whose set a solid move already carries,
     so only an uncarried thin move can ever put a hedge in the dek */
  const carriedKeys = new Set(solidMoves.map((m) => m.tab + "|" + m.set));
  const visibleThin = thinMoves.filter((m) => !carriedKeys.has(m.tab + "|" + m.set));
  if (!solidMoves.length) {
    /* no solid moves (none, or all thin) -> the unchanged pair */
    check(/vote is unchanged$/.test(s.head), id + ": no solid moves -> title says the composition is unchanged");
    check(/no group has moved significantly towards or away from /.test(s.dek), id + ": no solid moves -> dek carries the no-significant-move sentence");
    check(!/voters Its /i.test(s.dek), id + ": skew sentence is separated by a full stop");
    if (thinMoves.length)
      check(!/appears/.test(s.dek), id + ": thin-only -> no hedged trailer leaks into the unchanged dek");
  } else {
    check(!/is unchanged$/.test(s.head), id + ": solid moves exist -> title does not claim unchanged");
    check(!/no group has moved significantly/.test(s.dek), id + ": solid moves exist -> dek does not claim no movement");
    // every quoted points figure is some move's relative move (g1−g0)−(a1−a0)
    const relPtsStr = (m) => (Math.round(Math.abs((m.g1 - m.g0) - (m.a1 - m.a0)) * 10) / 10).toFixed(1).replace(/\.0$/, "");
    const quoted = [...s.dek.matchAll(/(\d+(?:\.\d+)?) points/g)].map((x) => x[1]);
    const inPayload = moves.map(relPtsStr);
    check(quoted.every((q) => inPayload.includes(q)), id + ": every points figure in the dek is a payload relative move (" + quoted.join(", ") + ")");
    // a visible thin move's figure only ever appears inside a hedged sentence
    for (const m of visibleThin) {
      const fig = relPtsStr(m);
      const bare = s.dek.split(". ").filter((sent) => sent.includes(fig + " points") && !/appears/.test(sent));
      check(bare.length === 0, id + ": thin move " + m.group + " (" + fig + " points) lives only in hedged sentences");
    }
    // a thin move only ever trails a solid claim, hedged "appears to"
    if (visibleThin.length) {
      check(/appears to (be|have) /.test(s.dek), id + ": thin moves trail -> dek carries a hedged 'appears to' sentence");
      // hedged clauses are never in the first (claim-bearing) sentence
      const firstSentence = s.dek.replace(since(dt) + ", ", "").split(". ")[0];
      check(!/appears/.test(firstSentence), id + ": the claim sentence itself never hedges");
    }
    if (!visibleThin.length)
      check(!/appears to (be|have) /.test(s.dek), id + ": no uncarried thin moves -> dek does not hedge");
  }
  // dek has body text after the since-window
  const afterSince = s.dek.replace(since(dt) + ", ", "");
  check(/\S/.test(afterSince), id + ": dek has body text after the since-window");
  const lowerStarts = s.dek.split(". ").slice(1).filter((t) => /^[a-z]/.test(t || ""));
  check(lowerStarts.length === 0, id + ": no lower-case sentence starts (" + lowerStarts.length + ")");
}

await browser.close();
if (fails.length) { console.error("\n" + fails.length + " FAILURES"); process.exit(1); }
console.log("\nall checks passed");
