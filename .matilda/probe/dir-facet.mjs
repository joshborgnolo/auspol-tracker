// Headless acceptance probe for the direction-only archive rows
// (SEC Newgate's seven waves + Essential's three May-Aug 2025 national-mood
// waves filed on the All-polls Direction facet, samples carried over from
// each house's direction series).
//
//  1. Direction facet lists 7 SEC Newgate + 3 May-Aug 2025 Essential rows
//  2. SEC samples render with thousands separators (1,855..1,659); the
//     Essential waves carry no sample and show the placeholder dash
//  3. Other facets carry no SEC Newgate rows (the house has no VI or
//     leadership figure, so its rows must never leave the Direction facet)
//  4. ?f=d opens the page straight onto the Direction facet
//  5. The Snapshot direction chart's dot tooltip says "n = 1,659"
//  6. VW=390 VH=844 re-run: same rows mount on the phone rung
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

let puppeteer;
for (const base of [process.cwd(), homedir()]) {
  try {
    puppeteer = createRequire(join(base, "package.json"))("puppeteer-core");
    break;
  } catch { /* next */ }
}
if (!puppeteer) { console.error("puppeteer-core not resolvable from ~ or cwd"); process.exit(2); }

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const PAGE = `file://${ROOT}/index.html`;
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new",
});

let passed = 0, failed = 0;
const check = (name, ok, detail) => {
  if (ok) { passed++; console.log(`  PASS ${name}${detail ? " — " + detail : ""}`); }
  else { failed++; console.log(`  FAIL ${name}${detail ? " — " + detail : ""}`); }
};

async function rowsOnFacet(page) {
  return page.evaluate(() => {
    const rows = [...document.querySelectorAll(".rd-ap-row, .rd-ap-card")];
    return rows.map((r) => r.textContent);
  });
}

// Rows mount as .rd-ap-row (desktop) or .rd-ap-card (phone, no rowheader /
// .rd-ap-n; client+field+sample live in the .rd-ap-c2 .rd-ap-sub join).
// Parse a row on either layout into { who, client, sample, field }.
async function parseRows(page) {
  return page.evaluate(() => {
    const rows = [...document.querySelectorAll(".rd-ap-row, .rd-ap-card")];
    return rows.map((r) => {
      const firm = r.querySelector("[role='rowheader'] b") || r.querySelector(".rd-ap-firm");
      const who = firm ? firm.textContent.replace(/↗/g, "").trim() : null;
      const nCell = r.querySelector(".rd-ap-n > span:first-child") || r.querySelector(".rd-ap-n");
      if (nCell) {
        const when = r.querySelector(".rd-ap-when b");
        const sub = r.querySelector("[role='rowheader'] .rd-ap-sub");
        return {
          who,
          client: sub ? sub.textContent.trim() : null,
          sample: nCell.textContent.trim(),
          field: when ? when.textContent.trim() : null,
        };
      }
      const subEl = r.querySelector(".rd-ap-c2 .rd-ap-sub");
      const parts = subEl ? subEl.textContent.trim().split(", ") : [];
      let sample = "—";
      if (parts.length && /^[0-9][0-9,]*$/.test(parts[parts.length - 1])) sample = parts.pop();
      return { who, client: parts[0] || null, sample, field: parts.slice(1).join(", ") || null };
    });
  });
}

async function facetDetail(page) {
  const rows = await parseRows(page);
  return {
    n: rows.length,
    secRows: rows.filter((r) => r.who && /^SEC Newgate/.test(r.who)),
    perClient: rows.reduce((m, r) => {
      const k = r.client || "?";
      m[k] = (m[k] || 0) + 1;
      return m;
    }, {}),
  };
}

async function selectDirection(page) {
  await page.evaluate(() => {
    const tabs = [...document.querySelectorAll(".rd-ap-tabs button")];
    const t = tabs.find((n) => n.textContent.trim() === "Direction");
    t.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
  await page.waitForFunction(
    () => [...document.querySelectorAll(".rd-ap-tabs button")]
      .find((b) => b.textContent.trim() === "Direction")?.getAttribute("aria-pressed") === "true",
    { timeout: 5000 },
  ).catch(() => {});
  await new Promise((r) => setTimeout(r, 500));
}

// the table pages by month; older waves only exist after "Show all"
async function showAll(page) {
  await page.evaluate(() => {
    const link = [...document.querySelectorAll(".rd-ap-more .rd-link")]
      .find((n) => /^Show all/.test(n.textContent.trim()));
    if (link) link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
  await page.waitForFunction(() => !document.querySelector(".rd-ap-more"), { timeout: 10000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 500));
}

// ---------------------------------------------------------------- facet part
console.log("== All-polls Direction facet ==");
const page1 = await browser.newPage();
const vw = Number(process.env.VW || 1280), vh = Number(process.env.VH || 900);
await page1.setViewport({ width: vw, height: vh });
const pageErrors = [];
page1.on("pageerror", (e) => pageErrors.push(String(e)));

await page1.goto(`${PAGE}#allpolls`, { waitUntil: "domcontentloaded" });
await page1.waitForSelector(".rd-ap-tabs button", { timeout: 30000 });
await selectDirection(page1);
await page1.waitForSelector(".rd-ap-row, .rd-ap-card", { timeout: 15000 });

// --- A: no ?f=d, explicit click onto Direction ------------------------
await showAll(page1);
const snap1 = await rowsOnFacet(page1);
const secCount = snap1.filter((t) => t.includes("SEC Newgate")).length;
const guardianCount = snap1.filter((t) => /The Guardian/.test(t)).length;
const selfPub = snap1.filter((t) => t.includes("Self-published")).length;
const detail = await facetDetail(page1);
console.log("  rows on facet:", detail.n, "| per-client:", JSON.stringify(detail.perClient));
for (const r of detail.secRows) console.log("   SEC row:", JSON.stringify(r));

check("7 SEC Newgate rows on the Direction facet", secCount === 7, `${secCount}/7`);
const secSampExpected = ["1,855", "1,212", "1,208", "2,166", "1,210", "1,975", "1,659"];
const secSampGot = detail.secRows.map((r) => r.sample);
const allSamples = secSampExpected.every((n) => secSampGot.includes(n));
check("SEC samples carried across", allSamples, `got ${secSampGot.join(", ")}`);
// The direction-only Essential waves (May, Jul, Aug 2025) carry sample:null
// and are the ONLY Essential rows in the facet with the placeholder dash —
// the default byDate view renders no ’YY suffix, so distinguish by the dash
// and the field month rather than a year string. On the phone card the dash
// is omitted from the .rd-ap-sub join; parseRows reports it as "—" again.
const essentialRows = (await parseRows(page1)).filter((r) => r.who && /^Essential/.test(r.who));
const essentialDash = essentialRows.filter((r) => r.sample === "—");
const dashMonths = essentialDash.map((r) => r.field || "");
const monthsOk = ["May", "Jul", "Aug"].every((m) => dashMonths.some((w) => w.includes(m)));
check("3 Essential direction-only rows present (no-sample dash)",
  essentialDash.length === 3,
  `${essentialDash.length}/3 dashed (fields: ${dashMonths.join(" | ")})`);
check("dashed Essential rows are the May/Jul/Aug waves", monthsOk, dashMonths.join(", "));

// --- B: other facets must not carry the direction-only rows -----------
// SEC Newgate publishes no VI or leadership figure, so the house must be
// absent from every other facet; 'Self-published' is NOT a bleed signal
// (DemosAU, Spectre and Morgan self-publish legitimately).
console.log("== scope: no bleed onto other facets ==");
// the leadership tab is "Leadership" on desktop, "Leaders" on the phone rung
for (const [facet, re] of [["2PP", /^2PP$/], ["Primary", /^Primary$/], ["Leadership", /^Leaders(?:hip)?$/]]) {
  await page1.evaluate((reSrc) => {
    const rx = new RegExp(reSrc);
    const t = [...document.querySelectorAll(".rd-ap-tabs button")].find((n) => rx.test(n.textContent.trim()));
    if (!t) throw new Error(`facet tab ${reSrc} not found`);
    t.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    return null;
  }, re.source);
  await new Promise((r) => setTimeout(r, 800));
  await showAll(page1);
  const snap = await rowsOnFacet(page1);
  const sec = snap.filter((t) => t.includes("SEC Newgate")).length;
  check(`${facet} facet carries no direction-only rows`, sec === 0,
    sec ? `${sec} SEC row(s) bled through` : "clean");
}
// back on Direction for the rest
await selectDirection(page1);

// --- C: no page errors -------------------------------------------------
check("no page errors on the facet", pageErrors.length === 0, pageErrors[0] || "");

// ------------------------------------------------------------------- URL
console.log("== ?f=d opens the Direction facet directly ==");
const page2 = await browser.newPage();
await page2.setViewport({ width: vw, height: vh });
await page2.goto(`${PAGE}?f=d#allpolls`, { waitUntil: "domcontentloaded" });
await page2.waitForSelector(".rd-ap-row, .rd-ap-card", { timeout: 15000 });
await new Promise((r) => setTimeout(r, 600));
await showAll(page2);
const urlState = await page2.evaluate(() => ({
  activeTab: ([...document.querySelectorAll(".rd-ap-tabs button")]
    .find((b) => b.getAttribute("aria-pressed") === "true") || {}).textContent || null,
  rows: [...document.querySelectorAll(".rd-ap-row, .rd-ap-card")].length,
  sec: [...document.querySelectorAll(".rd-ap-row, .rd-ap-card")]
    .filter((r) => r.textContent.includes("SEC Newgate")).length,
}));
check("?f=d lands on the Direction tab", urlState.activeTab === "Direction",
  `active tab: ${urlState.activeTab}`);
check("?f=d Direction facet lists SEC rows", urlState.sec === 7, `${urlState.sec}/7`);
await page2.close();

await page1.close();

// ------------------------------------------- release links, stamps, rail
// Direction-only rows now carry the pollster's release link and a publish
// stamp (SEC Newgate's from its WordPress media record, Essential's from
// the report index), which must surface as: the row's pollster ↗ cell, the
// detail's "Read the release" link, a "published …, <time>" head sentence,
// and the direction-flavoured "How it counts" rail. The row total on the
// VI facets acknowledges the direction-only rows as "<n> of <n+10> polls".
console.log("== direction rows: release link, publish stamp, direction rail ==");
const page4 = await browser.newPage();
await page4.setViewport({ width: vw, height: vh });
const errs4 = [];
page4.on("pageerror", (e) => errs4.push(String(e)));
await page4.goto(`${PAGE}#allpolls`, { waitUntil: "domcontentloaded" });
await page4.waitForSelector(".rd-ap-tabs button", { timeout: 30000 });
await new Promise((r) => setTimeout(r, 600));

// tally first, before any facet switch: the default 2PP facet
const tallyOf = async () => {
  const el = await page4.evaluate(() => {
    const c = document.querySelector(".rd-ap-count");
    return c ? c.textContent.replace(/\s+/g, " ").trim() : null;
  });
  if (!el) return null;
  const m = el.match(/^(\d+)(?: of (\d+))? polls$/);
  return m ? { shown: +m[1], of: m[2] ? +m[2] : null, text: el } : { raw: el };
};
const tppTally = await tallyOf();
check("2PP facet counts the direction-only rows in its total",
  !!tppTally && tppTally.of === tppTally.shown + 10,
  tppTally ? tppTally.text : "no .rd-ap-count");
for (const [facet, re] of [["Primary", /^Primary$/], ["Leaders", /^Leaders(?:hip)?$/]]) {
  await page4.evaluate((reSrc) => {
    const rx = new RegExp(reSrc);
    const t = [...document.querySelectorAll(".rd-ap-tabs button")].find((n) => rx.test(n.textContent.trim()));
    t.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  }, re.source);
  await new Promise((r) => setTimeout(r, 700));
  const t = await tallyOf();
  check(`${facet} facet counts the direction-only rows too`,
    !!t && !!tppTally && t.of === tppTally.of,
    t ? t.text : "no .rd-ap-count");
}

// Direction facet: scoped to rows WITH a direction reading, so "75 of 173"
// – the denominator is the archive's full extent, like the other facets'
await selectDirection(page4);
await page4.waitForSelector(".rd-ap-row, .rd-ap-card", { timeout: 15000 });
const dirTally = await tallyOf();
check("Direction facet counts against the archive's full extent",
  !!dirTally && !!tppTally && dirTally.of === tppTally.of && dirTally.shown < dirTally.of,
  dirTally ? dirTally.text : "no .rd-ap-count");

await showAll(page4);

// open a SEC Newgate row and interrogate the row cell + the detail
async function openRow(pageRe) {
  await page4.evaluate((src) => {
    const rx = new RegExp(src);
    const row = [...document.querySelectorAll(".rd-ap-row, .rd-ap-card")].find((r) => rx.test(r.textContent));
    if (!row) return null;
    row.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    return true;
  }, pageRe.source);
  await new Promise((r) => setTimeout(r, 600));
  return page4.evaluate(() => {
    const detail = document.querySelector(".rd-ap-open .rd-apd");
    if (!detail) return null;
    const rowHref = (document.querySelector(".rd-ap-row.open [role='rowheader'] b a, .rd-ap-card.open .rd-ap-firm a") || {}).href || null;
    const head = (detail.querySelector(".rd-apd-h") || {}).textContent || "";
    const links = [...detail.querySelectorAll(".rd-apd-links a")].map((a) => ({ t: a.textContent.trim(), href: a.href }));
    const rail = (detail.querySelector(".rd-apd-r") || {}).textContent || "";
    const railSvg = !!detail.querySelector(".rd-apd-r svg");
    return { rowHref, head, links, rail, railSvg };
  });
}

const secD = await openRow(/SEC Newgate/);
console.log("  sec detail:", JSON.stringify(secD && { head: secD.head, links: secD.links.filter((l) => /release|method/i.test(l.t)) }));
check("SEC row opens with its release ↗ on the pollster cell",
  !!secD && /secnewgate\.com\.au/.test(secD.rowHref || ""), secD && secD.rowHref);
check("SEC detail links 'Read the release' to the article page",
  !!secD && secD.links.some((l) => /Read the release/.test(l.t) && /secnewgate\.com\.au\/.*mood-of-the-nation/.test(l.href)),
  secD && JSON.stringify(secD.links.map((l) => l.t)));
check("SEC head sentence carries the publish time",
  !!secD && /published by SEC Newgate on \w+ \d+ \w+, \d+ [ap]m/.test(secD.head), secD && secD.head);
check("SEC rail counts toward the direction headline, not the 2PP",
  !!secD && /usual lean/.test(secD.rail) && /In today.{0,4}s\s+[−-]?\d+(\.\d)?\s+net/.test(secD.rail)
    && (/more (right-direction|wrong-track) than the month’s average/.test(secD.rail) || /Level with the month’s average/.test(secD.rail))
    && !/Labor’s/.test(secD.rail) && secD.railSvg,
  secD ? secD.rail.replace(/\s+/g, " ").slice(0, 160) : "no detail");

const essD = await openRow(/Essential[\s\S]*7–11 May/);   // the 2025-05-11 mood-only wave
check("the May 2025 direction-only Essential row opens with its report link",
  !!essD && essD.links.some((l) => /Read the release/.test(l.t) && /essentialreport\.com\.au\/reports\/13-may-2025/.test(l.href)),
  essD && JSON.stringify(essD.links.map((l) => l.t)));
check("its head sentence carries the publish stamp",
  !!essD && /published by The Guardian on Tue 13 May, 1 am/.test(essD.head), essD && essD.head);

check("no page errors in this section", errs4.length === 0, errs4[0] || "");
await page4.close();

// ------------------------------------------------------------ Snapshot tip
if (vw > 500) {
  console.log("== Snapshot direction chart tooltip ==");
  const page3 = await browser.newPage();
  await page3.setViewport({ width: vw, height: vh });
  const errs = [];
  page3.on("pageerror", (e) => errs.push(String(e)));
  await page3.goto(PAGE, { waitUntil: "domcontentloaded" });
  // The dot picker is a root-level POINTER-position handler, so synthesise a
  // pointermove (not mousemove) at each dot centre IN PAGE, scoped to the
  // direction panel's own chart card. First circle to raise .tip.tip-dot wins.
  await page3.waitForFunction(() => {
    const sec = document.querySelector("section#direction");
    return !!(sec && sec.querySelector(".rd-dir-chart svg circle"));
  }, { timeout: 30000 }).catch(() => {});

  const tip = await page3.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const section = document.querySelector("section#direction");
    if (!section) return { error: "no #direction section" };
    const card = section.querySelector(".rd-dir-chart");
    if (!card) return { error: "no .rd-dir-chart card" };
    card.scrollIntoView({ block: "center" });
    await sleep(300);
    const circles = [...card.querySelectorAll("svg circle")];
    let sawSample = null, sawSec = null;
    for (let i = 0; i < circles.length && !sawSec; i++) {
      const r = circles[i].getBoundingClientRect();
      if (r.width < 4 || r.height < 4) continue;
      const ev = new PointerEvent("pointermove", {
        bubbles: true, cancelable: true, pointerType: "mouse",
        clientX: r.x + r.width / 2, clientY: r.y + r.height / 2,
      });
      (circles[i].closest("svg") || card).dispatchEvent(ev);
      await sleep(180);
      const tipEl = document.querySelector(".tip.tip-dot");
      if (!tipEl) continue;
      const text = tipEl.textContent;
      if (!sawSample && /n = [\d,]+/.test(text)) sawSample = { text, tried: i + 1 };
      if (/SEC Newgate/.test(text) && /n = 1,659/.test(text)) sawSec = { text, tried: i + 1 };
    }
    return { sawSample, sawSec, of: circles.length };
  });
  console.log("  tip probe:", JSON.stringify(tip));
  const best = tip.sawSec || tip.sawSample;
  check("direction dot tooltip carries the wave's sample",
    !!tip.sawSec,
    best ? best.text.replace(/\s+/g, " ").trim() : tip.error || "no tip-text");
  check("no page errors on the Snapshot", errs.length === 0, errs[0] || "");
  await page3.close();
}

await browser.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
