// Probe: Who votes for whom's election-time marks (2026-11-10).
// One hollow diamond per group at May 2025: gen-data DEMO_VOTE's estimate of
// the group's vote, the polls over the six weeks before polling day and the
// Australian Election Study 2025 weighted together (the polls alone for
// language at home, the AES alone for generations). No triangles any more.
// - Every diamond takes the dotted lead-in to its line's first month, and the
//   all-voters line is led back to the result, ringed there (2026-11-11).
// - None on the Place tab (the AEC count marks those).
// The key names the estimate; a diamond's tip quotes both readings and the
// margin; the election-month guide reads the groups at the estimate (from
// the payload) and all voters at the result; no page errors. Screens to OUT
// (default $CLAUDE_JOB_DIR/tmp or /tmp).
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
    check(`${party}: Gender chart has 2 estimate diamonds and no triangles`, (g[0] && g[0].n) === 2 && (g[0] && g[0].tri) === 0, JSON.stringify(g));
    const key = await page.evaluate(() => document.querySelector("#who-votes .rd-sm-key")?.textContent || "");
    check(`${party}: key names the estimate and has no triangle entry`, /Estimated vote at the 2025 election/.test(key) && !/Polls at the 2025 election/.test(key));
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
      const V = await page.evaluate(() => { const E = window.AUSPOL.demoVote.sets.gender.groups; return { men: E.Men.alp, women: E.Women.alp }; });
      const f = (v) => v.toFixed(1);
      check("tip names the estimate, both readings, their bases and the margin", /Estimated vote at the 2025 election/.test(tip) && /Polls in the six weeks before polling day/.test(tip) && /Australian Election Study/.test(tip) && /weighted together, ±/.test(tip)
        && (tip.includes("Men" + f(V.men[0])) && tip.includes(f(V.men[2])) && tip.includes(f(V.men[3])) || tip.includes("Women" + f(V.women[0])) && tip.includes(f(V.women[2])) && tip.includes(f(V.women[3]))), tip.slice(0, 260));
      check("the estimate sits between the two readings", [V.men, V.women].every((c) => c[0] >= Math.min(c[2], c[3]) - 0.3 && c[0] <= Math.max(c[2], c[3]) + 0.3), JSON.stringify(V));
      await el.screenshot({ path: `${OUT}/wv-aes-gender-tip-${vw}.png` });
      /* the guide at the election x, well above the marks: the groups at
         the estimate, all voters at the result */
      const svgTop = await page.evaluate(() => document.querySelector("#who-votes .rd-wv-chart svg").getBoundingClientRect().bottom - 80);
      await page.mouse.move(5, 5);
      await settle(200);
      await page.mouse.move(box.x + 4, svgTop);
      await settle(400);
      const guide = await page.evaluate(() => [...document.querySelectorAll("#who-votes .rd-wv-chart .tooltip, #who-votes .rd-wv-chart [class*=tip]")].map((n) => n.textContent.trim()).filter(Boolean).join(" | "));
      check("election-month guide: groups at the estimate, all voters at the result", /May 2025/.test(guide) && guide.includes("Women" + f(V.women[0])) && guide.includes("Men" + f(V.men[0])) && /All voters ?34\.6/.test(guide) && /Groups: estimated from the polls before the election and the Australian Election Study 2025/.test(guide), guide.slice(0, 260));
      /* lead-ins: all voters only; the two groups ride as single points */
      const leads = await page.evaluate(() => ({ all: document.querySelectorAll('#who-votes .rd-wv-chart [data-series^="ae-all-"]').length,
        ev: [...document.querySelectorAll('#who-votes .rd-wv-chart path[data-series^="ev-"]')].filter((n) => /L/.test(n.getAttribute("d") || "")).length }));
      const ring = await page.evaluate(() => [...document.querySelectorAll("#who-votes .rd-wv-chart")].map((c) => c.querySelectorAll("svg g.rd-mark").length));
      check("all voters led back to the result and ringed there; both groups lead in from their diamonds", leads.all >= 1 && leads.ev >= 2 && ring[0] >= 1, JSON.stringify({ leads, ring }));
      await page.mouse.move(5, 5);
    }
    await click(page, "#who-votes .rd-wv-tabs .rd-tab, #who-votes .rd-wv-tabs button", "Age");
    await settle(900);
    const a = await diamonds(page);
    const byGen = a.find((c) => /generation/i.test(c.head)), byAge = a.find((c) => /age/i.test(c.head));
    check(`${party}: By generation has 4 diamonds, no triangles`, (byGen && byGen.n) === 4 && byGen.tri === 0, JSON.stringify(a));
    check(`${party}: By age has 3 diamonds, no triangles`, (byAge && byAge.n) === 3 && byAge.tri === 0);
    if (party === "Labor") {
      const leadsG = await page.evaluate(() => [...document.querySelectorAll("#who-votes .rd-wv-chart")].map((card) => ({
        head: (card.querySelector(".rd-chead-t") || {}).firstChild?.textContent || "",
        ev: [...card.querySelectorAll('path[data-series^="ev-"]')].filter((n) => /L/.test(n.getAttribute("d") || "")).length })));
      const lg = leadsG.find((c) => /generation/i.test(c.head)), la = leadsG.find((c) => /age/i.test(c.head) && !/generation/i.test(c.head));
      check("generations and ages all lead in from their diamonds", lg && lg.ev >= 3 && la && la.ev >= 3, JSON.stringify(leadsG));
    }
    if (party === "Labor") {
      const el = await page.$("#who-votes .rd-wv-charts");
      await el.screenshot({ path: `${OUT}/wv-aes-age-${vw}.png` });
    }
    for (const [tabName, want2, tri2] of [["Education", { education: 3 }, { education: 0 }], ["Home", { housing: 3, "work status": 3, language: 2 }, { housing: 0, "work status": 0, language: 0 }], ["Place", { state: 0, location: 0 }, { state: 0, location: 0 }]]) {
      await click(page, "#who-votes .rd-wv-tabs .rd-tab, #who-votes .rd-wv-tabs button", tabName);
      await settle(900);
      const cs = await diamonds(page);
      for (const [lab, n] of Object.entries(want2)) {
        const c = cs.find((x) => x.head.toLowerCase().includes(lab));
        /* Place's state panels draw no cards with a by-line head of their
           own; a missing card counts as none */
        check(`${party}: ${tabName} / ${lab} has ${n} diamonds and ${tri2[lab]} triangles`, (c ? c.n : 0) === n && (c ? c.tri : 0) === tri2[lab], JSON.stringify(cs));
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
