/* Probe: a no-aggregate wave never joins the hero 2PP chart's poll cloud.
   The archive KEEPS full rows for noAgg houses (EMRS (Tas) is the live
   one – Tasmania-only federal readings, and its figures belong on the
   archive and the Who-votes-for-whom territory view), but the hero cloud
   is "one dot per reading BEHIND the national line", and a Tasmania-only
   reading is not a national figure – rd-hero.jsx cloudFor/domainOf skip
   the noAgg rows (fix 2026-11-12; before then the two committed EMRS
   waves drew clickable dots at their printed 2PPs beside the national
   aggregate, on both bases).
     PAYLOAD (node): the bundle still carries noAgg rows with implied and
   published 2PP figures (the binding condition – if that class disappears
   from the data this probe holds nothing down and must say so), and only
   the rd-hero.jsx SOURCE carries the gate (the archived classic chart is
   rule-5 frozen and keeps its own cloud).
     BROWSER (file://, 1280): on the implied basis AND after a flip to
   published figures, on whichever v-Labor contest is up AND after a
   round trip to the other one, the number of drawn .scatter-dot elements
   equals the in-page count of range-eligible NON-noAgg rows carrying the
   active view's figure – i.e. every noAgg row in range is excluded, and
   no other row vanishes. Not a fixed dot count: the expected number is
   recomputed from the live bundle each run. */
import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";

const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
if (!fs.existsSync(CHROME)) { console.error("no Chrome at " + CHROME); process.exit(2); }
const BASE = path.resolve(process.env.BASE || process.cwd());

const fails = [];
const check = (ok, msg) => { console.log((ok ? "  ok " : "FAIL ") + msg); if (!ok) fails.push(msg); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ============ payload: the bundle still carries a binding noAgg class ==== */
console.log("payload:");
const assetDir = path.join(BASE, ".build/newtracker/assets");
const dataFile = fs.readdirSync(assetDir).find((f) => f.startsWith("9f09dca2-") && f.endsWith(".js"));
check(!!dataFile, "9f09dca2 data asset present");
const win = {};
new Function("window", fs.readFileSync(path.join(assetDir, dataFile), "utf8"))(win);
const D = win.AUSPOL || {};
const rows = Array.isArray(D.individualPolls) ? D.individualPolls : [];
const noAgg = rows.filter((q) => q.noAgg);
check(noAgg.length >= 1, `bundle carries noAgg rows (${noAgg.map((q) => q.pollster + " " + q.released).join("; ") || "NONE"})`);
const binders = noAgg.filter((q) => q.alpImp != null && q.alpN != null);
check(binders.length >= 1, `noAgg rows carry BOTH 2PP figure fields (${binders.length} of ${noAgg.length}) – the probe binds`);
check(binders.every((q) => q.noAggWhy), "noAgg rows carry the why note for the detail rail");

const heroSrc = fs.readFileSync(path.join(BASE, ".build/newtracker/assets/rd-hero.jsx"), "utf8");
check(/!q\.noAgg/.test(heroSrc), "rd-hero.jsx gates the cloud behind !q.noAgg");

/* ============ browser: drawn dots == eligible non-noAgg rows ============= */
console.log("browser (1280):");
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 950, deviceScaleFactor: 1 });
await page.goto("file://" + path.join(BASE, "index.html"), { waitUntil: "networkidle0", timeout: 60000 });
await page.waitForSelector("#two-party svg .scatter-dot", { timeout: 30000 });

/* count of dots the CONTRACT expects on the active view, computed in-page */
const expectOf = () => page.evaluate(() => {
  const DP = window.AUSPOL, xD = window.AP.rangeDomain("all");
  const inRange = DP.individualPolls.filter((q) => q.x >= xD[0] && q.x <= xD[1]);
  const onContest = document.querySelector("#two-party .rd-tpp-name") && [...document.querySelectorAll("#two-party .rd-tpp-name")].some((e) => /One Nation/.test(e.textContent || ""));
  const figOf = (q) => (onContest ? q.alpOnImp : q.alpImp);
  return {
    contest: onContest ? "alp_on" : "alp_lnp",
    expect: inRange.filter((q) => !q.noAgg && figOf(q) != null).length,
    excluded: inRange.filter((q) => q.noAgg && figOf(q) != null).length,
    drawn: document.querySelectorAll("#two-party svg .scatter-dot").length,
  };
});
async function assertCloud(tag) {
  const s = await expectOf();
  check(s.excluded >= 1, `${tag}: ${s.excluded} noAgg row(s) in range carry a figure and are excluded from the cloud`);
  check(s.drawn === s.expect, `${tag}: ${s.drawn} dots drawn == ${s.expect} non-noAgg rows with the ${s.contest} implied figure`);
  return s;
}

await assertCloud("landing view (implied)");

/* walk to the OTHER v-Labor contest and back */
const clickChip = async (label) => page.evaluate((lab) => {
  const chips = [...document.querySelectorAll("#two-party .rd-tpp-switch .rd-chip, #two-party .rd-chip")];
  const b = chips.find((x) => (x.textContent || "").startsWith(lab));
  if (b) b.click();
  return !!b;
}, label);
const onOneNation = (await page.evaluate(() => [...document.querySelectorAll("#two-party .rd-tpp-name")].some((e) => /One Nation/.test(e.textContent || ""))));
const otherChip = onOneNation ? "Labor v Coalition" : "Labor v One Nation";
const backChip = onOneNation ? "Labor v One Nation" : "Labor v Coalition";
check(await clickChip(otherChip), "the other v-Labor contest is offered as a chip");
await sleep(950); // intentional-sleep: the contest morph runs ~320ms
await assertCloud("other contest (implied)");
check(await clickChip(backChip), "chip walks back to the landing contest");
await sleep(950); // intentional-sleep: the contest morph runs ~320ms
await assertCloud("round trip back (implied)");

/* flip to the pollsters' published figures and assert there too */
await page.evaluate(() => {
  const root = document.querySelector("#two-party .rd-qpop");
  if (root && !root.querySelector(".rd-qpanel")) root.querySelector(".rd-qbtn").click();
});
await page.waitForSelector("#two-party .rd-qpop .rd-qpanel .rd-switch", { timeout: 10000 });
await page.click("#two-party .rd-qpop .rd-qpanel .rd-switch");
await sleep(950); // intentional-sleep: the basis morph runs ~320ms
const sPub = await page.evaluate(() => {
  const DP = window.AUSPOL, xD = window.AP.rangeDomain("all");
  const inRange = DP.individualPolls.filter((q) => q.x >= xD[0] && q.x <= xD[1]);
  const onContest = [...document.querySelectorAll("#two-party .rd-tpp-name")].some((e) => /One Nation/.test(e.textContent || ""));
  const figOf = (q) => (onContest ? (q.tppAlt ? q.tppAlt.alp : null) : q.alpN);
  return {
    contest: onContest ? "alp_on" : "alp_lnp",
    expect: inRange.filter((q) => !q.noAgg && figOf(q) != null).length,
    excluded: inRange.filter((q) => q.noAgg && figOf(q) != null).length,
    drawn: document.querySelectorAll("#two-party svg .scatter-dot").length,
  };
});
check(sPub.excluded >= 1, `published basis: ${sPub.excluded} noAgg row(s) in range carry a published figure and are excluded`);
check(sPub.drawn === sPub.expect, `published basis (${sPub.contest}): ${sPub.drawn} dots drawn == ${sPub.expect} non-noAgg rows with the published figure`);

await browser.close();
if (fails.length) { console.log(`\n${fails.length} FAILED`); process.exit(1); }
console.log("\nALL PASS");
