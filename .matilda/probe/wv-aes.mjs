// Probe: Who votes for whom's election-time marks (2026-11-03).
// - The polls at the election (gen-data DEMO_ELECTION, the houses' own tables
//   over the six weeks before polling day): one open triangle per group at May
//   2025 on the Gender, By age, Education, By housing, By work status and By
//   language at home charts, with the dotted lead-ins.
// - The Australian Election Study 2025 (DEMO_AES, from the respondent file via
//   .build/extract-aes-2025.py): one hollow diamond per group on those charts
//   bar language (not asked), standing alone; on By generation (which no house
//   cut before the election) the diamonds alone, with the lead-ins.
// - None on the Place tab (the AEC count marks those).
// The key names both; a diamond's tip reads the AES's share, the group's
// respondents and "not pooled"; a triangle's tip names the polls and the six
// weeks; the election-month guide reads the groups' figures at the polls'
// election-time values (from the payload) and all voters at the result; no
// page errors. Screens to OUT (default $CLAUDE_JOB_DIR/tmp or /tmp).
// Run: node .matilda/probe/wv-aes.mjs  (PAGE=<url> to test a served build)
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

let puppeteer;
for (const base of [process.cwd(), homedir()]) {
  try { puppeteer = createRequire(join(base, "package.json"))("puppeteer-core"); break; } catch { /* next */ }
}
if (!puppeteer) { console.error("puppeteer-core not resolvable from ~ or cwd"); process.exit(2); }

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const PAGE = process.env.PAGE || `file://${ROOT}/index.html`;
const OUT = process.env.OUT || (process.env.CLAUDE_JOB_DIR ? process.env.CLAUDE_JOB_DIR + "/tmp" : "/tmp");
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new",
});
let passed = 0, failed = 0;
const check = (name, ok, detail) => {
  if (ok) { passed++; console.log(`  PASS ${name}${detail ? " — " + detail : ""}`); }
  else { failed++; console.log(`  FAIL ${name}${detail ? " — " + detail : ""}`); }
};
const settle = (ms = 700) => new Promise((r) => setTimeout(r, ms));
const click = (page, sel, text) => page.evaluate((sel, text) => {
  const b = [...document.querySelectorAll(sel)].find((n) => n.textContent.trim() === text || n.getAttribute("aria-label") === text);
  if (!b) return false;
  b.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  return true;
}, sel, text);
/* the election-time marks: hollow scatter paths drawn on the chart ground -
   a diamond's path has four corners, a triangle's three */
const diamonds = (page) => page.evaluate(() => [...document.querySelectorAll("#who-votes .rd-wv-chart")].map((card) => {
  const ps = [...card.querySelectorAll('path.scatter-dot[fill="var(--chart-bg)"]')].map((p) => (p.getAttribute("d").match(/[ML]/g) || []).length);
  return { head: (card.querySelector(".rd-chead-t") || {}).firstChild?.textContent || "", n: ps.filter((c) => c === 4).length, tri: ps.filter((c) => c === 3).length };
}));

for (const vw of [1280, 390]) {
  console.log(`== ${vw} ==`);
  const page = await browser.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e).slice(0, 300)));
  await page.setViewport({ width: vw, height: 1000 });
  await page.goto(PAGE, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#who-votes .rd-wv-tabs", { timeout: 30000 });
  await page.evaluate(() => document.getElementById("who-votes").scrollIntoView());
  await settle(1500);
  const chipSel = "#who-votes .rd-chip";
  for (const [party, want] of [["Labor", true], ["One Nation", true], ["Others", true]]) {
    await click(page, chipSel, party);
    await settle(900);
    await click(page, "#who-votes .rd-wv-tabs .rd-tab, #who-votes .rd-wv-tabs button", "Gender");
    await settle(900);
    const g = await diamonds(page);
    check(`${party}: Gender chart ${want ? "has 2" : "has no"} AES points and 2 poll triangles`, (g[0] && g[0].n) === (want ? 2 : 0) && (g[0] && g[0].tri) === 2, JSON.stringify(g));
    const key = await page.evaluate(() => /Australian Election Study 2025/.test(document.querySelector("#who-votes .rd-sm-key")?.textContent || ""));
    check(`${party}: key ${want ? "names" : "omits"} the study`, key === want);
    const keyP = await page.evaluate(() => /Polls at the 2025 election/.test(document.querySelector("#who-votes .rd-sm-key")?.textContent || ""));
    check(`${party}: key names the polls at the election`, keyP);
    if (party === "Labor") {
      await page.evaluate(() => document.querySelector("#who-votes .rd-wv-charts").scrollIntoView({ block: "center" }));
      await settle(400);
      const el = await page.$("#who-votes .rd-wv-charts");
      await el.screenshot({ path: `${OUT}/wv-aes-gender-${vw}.png` });
      /* hover the first diamond and read the tip */
      const boxOf = (n) => page.evaluate((n) => {
        const d = [...document.querySelectorAll('#who-votes .rd-wv-chart path.scatter-dot[fill="var(--chart-bg)"]')].find((p) => (p.getAttribute("d").match(/[ML]/g) || []).length === n);
        const r = d.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      }, n);
      const box = await boxOf(4);
      await page.mouse.move(box.x, box.y);
      await settle(400);
      const tip = await page.evaluate(() => [...document.querySelectorAll("#who-votes .rd-wv-chart .tooltip, #who-votes .rd-wv-chart [class*=tip]")].map((n) => n.textContent.trim()).filter(Boolean).join(" | "));
      check("tip names the AES, its share, the group's respondents, not pooled", /Australian Election Study 2025/.test(tip) && /not pooled/.test(tip)
        && (/Men ?30\.9/.test(tip) && /940 respondents/.test(tip) || /Women ?36\.2/.test(tip) && /1,004 respondents/.test(tip)), tip.slice(0, 200));
      await el.screenshot({ path: `${OUT}/wv-aes-gender-tip-${vw}.png` });
      /* a triangle's tip: the polls over the six weeks */
      await page.mouse.move(5, 5);
      await settle(200);
      const tbox = await boxOf(3);
      await page.mouse.move(tbox.x, tbox.y);
      await settle(400);
      const ttip = await page.evaluate(() => [...document.querySelectorAll("#who-votes .rd-wv-chart .tooltip, #who-votes .rd-wv-chart [class*=tip]")].map((n) => n.textContent.trim()).filter(Boolean).join(" | "));
      check("triangle tip names the polls at the election and the six weeks", /Polls at the 2025 election/.test(ttip) && /six weeks before polling day/.test(ttip) && /polls? from/.test(ttip), ttip.slice(0, 200));
      /* the guide at the election x, well above the marks: the lead-ins'
         rows - the groups' figures at the polls' election-time values, all
         voters at the result */
      const want = await page.evaluate(() => { const E = window.AUSPOL.demoElection.sets.gender.groups; return { men: E.Men.alp[0].toFixed(1), women: E.Women.alp[0].toFixed(1) }; });
      const svgTop = await page.evaluate(() => document.querySelector("#who-votes .rd-wv-chart svg").getBoundingClientRect().bottom - 80);
      await page.mouse.move(5, 5);
      await settle(200);
      await page.mouse.move(box.x + 4, svgTop);
      await settle(400);
      const guide = await page.evaluate(() => [...document.querySelectorAll("#who-votes .rd-wv-chart .tooltip, #who-votes .rd-wv-chart [class*=tip]")].map((n) => n.textContent.trim()).filter(Boolean).join(" | "));
      check("election-month guide: groups at the polls' election-time figures, all voters at the result", /May 2025/.test(guide) && guide.includes("Women" + want.women) && guide.includes("Men" + want.men) && /All voters ?34\.6/.test(guide) && /Groups: the polls over the six weeks before polling day/.test(guide), guide.slice(0, 220));
      /* lead-ins: two groups from their triangles + all voters, dotted */
      const leads = await page.evaluate(() => ({ pe: document.querySelectorAll('#who-votes .rd-wv-chart [data-series^="pe-"]').length, all: document.querySelectorAll('#who-votes .rd-wv-chart [data-series^="ae-all-"]').length, ae: document.querySelectorAll('#who-votes .rd-wv-chart [data-series^="ae-"]:not([data-series^="ae-all-"])').length }));
      check("dotted lead-ins drawn from the triangles (2 groups + all voters), none from the diamonds", leads.pe >= 2 && leads.all >= 1 && leads.ae === 0, JSON.stringify(leads));
      await page.mouse.move(5, 5);
    }
    await click(page, "#who-votes .rd-wv-tabs .rd-tab, #who-votes .rd-wv-tabs button", "Age");
    await settle(900);
    const a = await diamonds(page);
    const byGen = a.find((c) => /generation/i.test(c.head)), byAge = a.find((c) => /age/i.test(c.head));
    check(`${party}: By generation has 4 AES points, no triangles`, (byGen && byGen.n) === 4 && byGen.tri === 0, JSON.stringify(a));
    check(`${party}: By age has 3 AES points and 3 triangles`, (byAge && byAge.n) === 3 && byAge.tri === 3);
    if (party === "Labor") {
      const leadsG = await page.evaluate(() => [...document.querySelectorAll("#who-votes .rd-wv-chart")].map((card) => ({
        head: (card.querySelector(".rd-chead-t") || {}).firstChild?.textContent || "",
        ae: card.querySelectorAll('[data-series^="ae-"]:not([data-series^="ae-all-"])').length, pe: card.querySelectorAll('[data-series^="pe-"]').length })));
      const lg = leadsG.find((c) => /generation/i.test(c.head)), la = leadsG.find((c) => /age/i.test(c.head) && !/generation/i.test(c.head));
      check("generations lead in from the diamonds, ages from the triangles", lg && lg.ae >= 3 && lg.pe === 0 && la && la.pe >= 3 && la.ae === 0, JSON.stringify(leadsG));
    }
    if (party === "Labor") {
      const el = await page.$("#who-votes .rd-wv-charts");
      await el.screenshot({ path: `${OUT}/wv-aes-age-${vw}.png` });
    }
    for (const [tabName, want2, tri2] of [["Education", { education: 3 }, { education: 3 }], ["Home", { housing: 3, "work status": 3, language: 0 }, { housing: 3, "work status": 3, language: 2 }], ["Place", { state: 0, location: 0 }, { state: 0, location: 0 }]]) {
      await click(page, "#who-votes .rd-wv-tabs .rd-tab, #who-votes .rd-wv-tabs button", tabName);
      await settle(900);
      const cs = await diamonds(page);
      for (const [lab, n] of Object.entries(want2)) {
        const c = cs.find((x) => x.head.toLowerCase().includes(lab));
        /* Place's state panels draw no cards with a by-line head of their
           own; a missing card counts as none */
        check(`${party}: ${tabName} / ${lab} has ${n} AES points and ${tri2[lab]} triangles`, (c ? c.n : 0) === n && (c ? c.tri : 0) === tri2[lab], JSON.stringify(cs));
      }
      if (party === "Labor" && tabName === "Home") {
        const el = await page.$("#who-votes .rd-wv-charts");
        await el.screenshot({ path: `${OUT}/wv-aes-home-${vw}.png` });
      }
    }
  }
  check("no page errors", errs.length === 0, errs.join(" ; "));
  await page.close();
}
await browser.close();
console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
