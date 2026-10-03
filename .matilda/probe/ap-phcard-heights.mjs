// Pins the 2026-10-03 phone card-height floor: on <=760px all FOUR non-2PP
// All-polls facets (primary, leadership, direction, issues) render poll
// cards at ONE height — rd.css sets min-height: 122px on
// .rd-ap-card:is(.rd-ap-cprim, .rd-ap-clead, .rd-ap-cdir, .rd-ap-ciss),
// the primary card's natural 121.69px rounded up (its stack: c1 21.75 +
// c2 16.19 + gap 2 + figures 21.75+4mt + gap 2 + cpic 28+4mt + padding
// 11+8 + border 1). 2PP cards are exempt (user call) — the rule never
// targets .rd-ap-c2pp and the probe asserts no min-height and a height
// at or under ~122, whatever their content stack is. That stack is
// outside this contract and comes in TWO naturals after 12ccecd's
// usual-lean sub-line: 93.94 lean-less, 121.94 with .rd-ap-cvalsub
// (that lane anchored those cards to the primary card's height via a
// 56px inline strip — own probe: ap-usual-lean-sub.mjs).
// Baseline naturals measured pre-rule, width-independent across the
// golden rungs: primary 121.69 / leadership 116.23 / direction 114.78 /
// issues 114.78 (118.11 on ranked-sentence cards — sup ordinals grow the
// sentence line in .rd-ap-csub-sent vs .rd-ap-issph). The floor swallows
// that intra-issues 3.33px delta. Month separators (.rd-ap-mrow) are
// headers, not poll rows — scoped out of the floor but asserted
// facet-identical (~50.75px incl. their 22px top padding; flex-baseline
// metrics vary by facet label text, asserted within 1px).
// Mirrors ap-iss-dir-head.mjs's harness (file:// build, puppeteer-core).
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
if (!puppeteer) { console.error("puppeteer-core not resolvable"); process.exit(2); }

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const PAGE = process.env.LIVE ? "https://auspoltracker.com/" : `file://${ROOT}/index.html`;
let fails = 0;
const check = (label, ok, detail = "") => {
  console.log(`${ok ? "ok  " : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!ok) fails++;
};

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new",
});

const FACETS = [["twopp", /^2PP$/], ["primary", /^Primary$/], ["leadership", /^Leaders/], ["direction", /^Direction$/], ["issues", /^Issues$/]];

async function measure(vw, vh) {
  const page = await browser.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e)));
  await page.setViewport({ width: vw, height: vh });
  await page.goto(`${PAGE}#allpolls`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".rd-ap-tabs button", { timeout: 30000 });
  await new Promise((r) => setTimeout(r, 1200));
  const out = {};
  for (const [name, re] of FACETS) {
    await page.evaluate((src) => {
      const want = new RegExp(src);
      const t = [...document.querySelectorAll(".rd-ap-tabs button")].find((n) => want.test(n.textContent.trim()));
      if (!t) throw new Error("facet tab not found: " + src);
      t.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    }, re.source);
    await new Promise((r) => setTimeout(r, 600));
    out[name] = await page.evaluate(() => {
      const cards = [...document.querySelectorAll(".rd-ap-card")];
      const heights = cards.map((c) => +c.getBoundingClientRect().height.toFixed(2));
      const uniq = [...new Set(heights)].sort((a, b) => a - b);
      const mrows = [...document.querySelectorAll(".rd-ap-mrow")].map((m) => +m.getBoundingClientRect().height.toFixed(2));
      const minH = cards.length ? getComputedStyle(cards[0]).minHeight : null;
      return { n: cards.length, uniq, minH, mrowUniq: [...new Set(mrows)].sort((a, b) => a - b) };
    });
  }
  await page.close();
  return { out, errs };
}

const FLOORED = ["primary", "leadership", "direction", "issues"];

for (const [vw, vh] of [[320, 568], [340, 640], [360, 640], [390, 844], [402, 874]]) {
  const { out, errs } = await measure(vw, vh);

  for (const name of FLOORED) {
    const d = out[name];
    check(`@${vw} ${name}: every card is EXACTLY the 122px floor (single height)`,
      d.uniq.length === 1 && Math.abs(d.uniq[0] - 122) < 0.51,
      `cards=${d.n} uniq=${JSON.stringify(d.uniq)} minH=${d.minH}`);
  }
  check(`@${vw} all four floored facets carry the same single height`,
    FLOORED.every((f) => out[f].uniq.length === 1) &&
    Math.max(...FLOORED.map((f) => out[f].uniq[0])) - Math.min(...FLOORED.map((f) => out[f].uniq[0])) < 0.51,
    JSON.stringify(Object.fromEntries(FLOORED.map((f) => [f, out[f].uniq]))));

  const t = out.twopp;
  check(`@${vw} twopp: exempt from the floor (93.94 / 121.94 lean-sub, no min-height)`,
    t.uniq.every((h) => h <= 122.01) && t.minH === "0px",
    `uniq=${JSON.stringify(t.uniq)} minH=${t.minH}`);

  const mrows = FLOORED.concat("twopp").flatMap((f) => out[f].mrowUniq);
  const mLo = Math.min(...mrows), mHi = Math.max(...mrows);
  check(`@${vw} month separators facet-identical (headers, outside the floor)`,
    mHi - mLo < 1, `span=${mLo}..${mHi}`);

  check(`@${vw}: no page errors`, errs.length === 0, errs[0] || "");
}

await browser.close();
console.log(fails === 0 ? "\nALL CHECKS PASSED" : `\n${fails} CHECK(S) FAILED`);
process.exit(fails === 0 ? 0 : 1);
