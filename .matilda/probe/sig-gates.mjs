/* sig-gates.mjs - the panels' heads and deks claim a lead, a fall, a ratio
   or an order only where it clears its own margin (2026-10-11 audit "and
   elsewhere": a 41-39 preferred-PM split had read "Albanese still leads").
   Each case loads the built page with window.AUSPOL rewritten BEFORE the
   app reads it (a setter installed by evaluateOnNewDocument), so the branch
   a live pool doesn't take today is exercised too:
   - Leadership: level / Albanese leads / Taylor leads (no stray "his");
   - Primary: a faller inside its own margin is not said to have fallen;
   - Vote switching: rates inside each other's margins are "much the same";
   - Decidedness by age: "the least firm" only for a group apart from both;
   - Direction: the since-May-2025 clause only past both months' margins;
   - Issues, what matters to whom: a top two inside their margins is a tie;
   - 2PP hero: "closer than" only past both contests' margins.
   Usage: BASE=<checkout> node .matilda/probe/sig-gates.mjs */
import { createRequire } from "module";
import path from "path";
import fs from "fs";
const require = createRequire(import.meta.url);
let puppeteer;
try { puppeteer = require("puppeteer-core"); } catch { puppeteer = createRequire(path.join(process.cwd(), "package.json"))("puppeteer-core"); }
const BASE = process.env.BASE || process.cwd();
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const fails = [];
const check = (ok, msg, got) => { console.log((ok ? "  ok " : "FAIL ") + msg + (ok || got === undefined ? "" : "\n       got: " + JSON.stringify(got))); if (!ok) fails.push(msg); };
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });

/* load the page with `mutate` (a function source run on the dataset as it is
   assigned) and return `read` (run in the page once it has rendered) */
async function run(mutate, read, before) {
  const page = await browser.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e)));
  await page.setViewport({ width: 1280, height: 900 });
  await page.evaluateOnNewDocument((src) => {
    const fn = src ? new Function("A", src) : null;
    let held;
    Object.defineProperty(window, "AUSPOL", { configurable: true, get: () => held, set: (v) => { held = v; try { if (fn) fn(v); } catch (e) { console.error(e); } } });
  }, mutate || "");
  await page.goto("file://" + path.join(BASE, "index.html"), { waitUntil: "networkidle0", timeout: 60000 });
  await page.waitForSelector("#leadership .rd-hed", { timeout: 30000 });
  if (before) { await page.evaluate(before); await new Promise((r) => setTimeout(r, 700)); }
  const out = await page.evaluate(read);
  await page.close();
  if (errs.length) check(false, "page errors", errs);
  return out;
}
const sec = (id) => `(() => { const s = document.getElementById(${JSON.stringify(id)}); return { head: s.querySelector(".rd-hed") ? s.querySelector(".rd-hed").textContent : "", dek: s.querySelector(".rd-dek") ? s.querySelector(".rd-dek").textContent : "", subs: [...s.querySelectorAll(".rd-sub")].map((x) => x.textContent) }; })()`;
const read = (id) => new Function("return " + sec(id));

console.log("Leadership");
const live = await run(null, () => ({ L: window.AUSPOL.leaderLead, head: document.querySelector("#leadership .rd-hed").textContent, dek: document.querySelector("#leadership .rd-dek").textContent }));
const liveSig = live.L && live.L.taylor && Math.abs(live.L.taylor.v) > live.L.taylor.ci95;
console.log("     live: " + live.head + " | " + JSON.stringify(live.L.taylor));
check(liveSig ? /leads as preferred PM/.test(live.head) : /are level as preferred PM/.test(live.head), "live head follows the pooled two-way lead's own margin", live.head);
const lvl = await run(`A.leaderLead.taylor = { v: 1.5, ci95: 3.7 }; A.leaderNow.alb_pref.v = 41; A.leaderNow.taylor_pref.v = 39.5;`, read("leadership"));
check(/^Albanese and Taylor are level as preferred PM/.test(lvl.head) && !/still leads/.test(lvl.head), "a lead inside its margin -> level, never 'still leads'", lvl.head);
check(/inside the margin of error/.test(lvl.dek) || /are level head to head/.test(lvl.dek), "the dek owns up the lead is inside the margin", lvl.dek);
const ahead = await run(`A.leaderLead.taylor = { v: 8, ci95: 3.7 }; A.leaderNow.alb_pref.v = 44; A.leaderNow.taylor_pref.v = 36;`, read("leadership"));
check(/^Albanese still leads as preferred PM/.test(ahead.head), "a lead past its margin -> 'still leads'", ahead.head);
check(/^His lead over the opposition leader has narrowed from \+\d+ under Ley to \+8 under Taylor\.$/.test(ahead.dek.split(". ")[0] + "."), "a real lead narrowed: no margin caveat", ahead.dek);
const behind = await run(`A.leaderLead.taylor = { v: -6, ci95: 3.7 }; A.leaderNow.alb_pref.v = 37; A.leaderNow.taylor_pref.v = 43;`, read("leadership"));
check(/^Taylor leads as preferred PM/.test(behind.head) && !/his net approval/.test(behind.head), "Taylor ahead -> 'Taylor leads', and never a 'his' that reads as Taylor's", behind.head);
const hanLevel = await run(`A.leaderLead.hanson = { v: 2, ci95: 3.9 }; A.leaderNow.alb_prefH.v = 41; A.leaderNow.hanson_prefH.v = 39;`, read("leadership"));
check(/Head to head with Hanson, the two are level\./.test(hanLevel.dek) && !/leads by/.test(hanLevel.dek), "Hanson lead inside its margin -> level", hanLevel.dek);

console.log("Primary vote");
const pri = await run(`const m = A.aggPrimary[A.aggPrimary.length - 1]; m.ci = { ...m.ci, lnp: 15, oth: 15 };`, read("primary-vote"));
check(!/has lost|have lost/.test(pri.dek), "a fall inside the figure's own margin is not 'lost'", pri.dek);
const pri0 = await run(null, read("primary-vote"));
check(/The Coalition, on [\d.]+%, has lost/.test(pri0.dek), "live: the Coalition's fall clears its margin and is said", pri0.dek);

console.log("Vote switching");
const sw = await run(`const s = A.onSources.series.find((x) => x.id === "alp"); s.rate.now.v = 36; s.rate.now.ci95 = 4;`, read("switching"));
check(/at much the same rate/.test(sw.dek) && !/times the rate/.test(sw.dek), "rates inside each other's margins -> 'much the same rate'", sw.dek);
const sw2 = await run(`const s = A.onSources.series.find((x) => x.id === "alp"); s.rate.now.v = 35.5; s.rate.now.ci95 = 1;
  const c = A.onSources.series.find((x) => x.id === "lnp"); c.rate.now.ci95 = 1;`, read("switching"));
check(/moved to One Nation faster than Labor voters/.test(sw2.dek) && !/about 1 times/.test(sw2.dek), "apart but under 1.25x -> 'faster than', never 'about 1 times'", sw2.dek);

console.log("Decidedness by age");
const ageClick = () => { const b = [...document.querySelectorAll("#undecided button, #undecided [role=tab]")].find((x) => x.textContent.trim() === "By age"); if (b) b.click(); };
const ua = await run(`const n = A.undecided.softAge.now; n["35-54"].v = 34; n["35-54"].ci95 = 1.5; n["18-34"].v = 29; n["18-34"].ci95 = 1.5; n["55+"].v = 20; n["55+"].ci95 = 1.5;`, read("undecided"), ageClick);
check(ua.subs.some((t) => /^Middle-aged voters are the least firm$/.test(t)), "35–54 apart from both -> 'Middle-aged voters are the least firm'", ua.subs);
const ub = await run(`const n = A.undecided.softAge.now; n["18-34"].v = 30; n["18-34"].ci95 = 2.5; n["35-54"].v = 28.5; n["35-54"].ci95 = 2.5; n["55+"].v = 20; n["55+"].ci95 = 2;`, read("undecided"), ageClick);
check(ub.subs.some((t) => /^Young voters are less firm than older voters$/.test(t)), "top not apart from the middle -> the clear pair only", ub.subs);

console.log("Direction");
const dir = await run(`A.direction[0].rightCi = 20; A.direction[0].wrongCi = 20;`, read("direction"));
check(!/since May 2025/.test(dir.dek), "a since-first move inside both months' margins is not said", dir.dek);

console.log("Issues, what matters to whom");
const whomClick = () => { const b = [...document.querySelectorAll("#issues button, #issues [role=tab]")].find((x) => /What matters to whom/.test(x.textContent)); if (b) b.click(); };
const readIs = () => ({ heads: [...document.querySelectorAll("#issues .rd-hed")].map((h) => h.textContent) });
const tie = await run(`const t = A.issues.groups.tabs.find((x) => x.id === "vote"); t.cells["Greens"].housing = { v: 84, ci: 8 };`, readIs, whomClick);
check(tie.heads.some((h) => /comes first, or level first, for everyone/.test(h)), "a group's top two inside their margins -> 'or level first'", tie.heads);
const flip = await run(`const t = A.issues.groups.tabs.find((x) => x.id === "vote"); t.cells["Greens"].housing = { v: 99, ci: 3 }; t.cells["Greens"].col = { v: 60, ci: 3 };`, readIs, whomClick);
check(flip.heads.some((h) => /comes first for most voters, but not all/.test(h)), "a group clearly putting another issue first -> 'but not all'", flip.heads);

console.log("2PP hero");
const heroMut = (ci) => `for (const s of [A.synthOn, A.synth2pp, A.agg2pp, A.alt2pp.alp_on]) { const l = s[s.length - 1]; l.ci95 = ${ci}; }
  const on = A.synthOn[A.synthOn.length - 1], co = A.synth2pp[A.synth2pp.length - 1];
  on.a = 50; on.b = 50; co.alp = 52; co.lnp = 48; const p = A.agg2pp[A.agg2pp.length - 1]; p.alp = 52; p.lnp = 48;
  const q = A.alt2pp.alp_on[A.alt2pp.alp_on.length - 1]; q.a = 50; q.b = 50;`;
const h1 = await run(heroMut(2.3), () => document.querySelector(".rd-hed") ? [...document.querySelectorAll(".rd-hed, .rd-sub")].map((x) => x.textContent).find((t) => /runs Labor/.test(t)) : null);
check(/as close as the Coalition does/.test(h1 || ""), "a 2-point gap inside both contests' margins -> 'as close as'", h1);
const h2 = await run(heroMut(0.5), () => [...document.querySelectorAll(".rd-hed, .rd-sub")].map((x) => x.textContent).find((t) => /runs Labor/.test(t)));
check(/One Nation now runs Labor closer than the Coalition does/.test(h2 || ""), "the same gap past tight margins -> 'closer than'", h2);

await browser.close();
if (fails.length) { console.error("\n" + fails.length + " FAILURES"); process.exit(1); }
console.log("\nALL CHECKS PASSED");
