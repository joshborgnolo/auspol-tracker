// Headless acceptance probe for the RedBridge/Accent direction breakdowns
// folded into the National-direction panel's group views (worktree
// rb-dir-groups; RedBridge's APC methodology statements print right/wrong
// track by demographic for the Nov-2025, Jan-2026 and May-2026 waves).
//
//  1. The group select gains five RedBridge optgroups (generation, vote
//     firmness, location, education, home ownership) and sheds the
//     "(Roy Morgan)" tag from By vote and By home ownership … the gender
//     and vote cuts are printed by several houses, so they bear no name
//  2. By gender lists Men and Women only; By vote lists the eight
//     cut-labels the shared house tapes share (Labor, Coalition, Liberal,
//     CLP/LNP/Nat, One Nation, Greens, Other, Undecided)
//  3. Women on its own: the readout names all three pollsters in its
//     disagreement tail, carries a margin (the cut is sized), and the
//     chart draws open rings beside solid dots
//  4. An RB-only cut (Generation Z): readout names no other house, drops
//     the disagreement tail and the margin (unsized), and no element under
//     the chart mentions open rings
//  5. The legend's readings line names the ring houses on a three-house
//     cut, nothing on the RB-only one
//  6. Phone rung (390x844) mounts the same optgroups and reads a cut
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
const settle = (ms = 700) => new Promise((r) => setTimeout(r, ms));

const selectGroup = async (page, value) => page.evaluate((v) => {
  const sel = document.querySelector(".rd-dir select.rd-pv-sel");
  const opt = [...sel.options].find((o) => o.value === v);
  if (!opt) return false;
  sel.value = v;
  sel.dispatchEvent(new Event("change", { bubbles: true }));
  sel.dispatchEvent(new Event("input", { bubbles: true }));
  return true;
}, value);

const readout = (page) => page.evaluate(() => {
  const p = document.querySelector(".rd-dir .rd-dir-grp");
  return p ? p.textContent : null;
});

const selectMap = (page) => page.evaluate(() => {
  const sel = document.querySelector(".rd-dir select.rd-pv-sel");
  if (!sel) return null;
  return {
    first: sel.options[0] ? { value: sel.options[0].value, text: sel.options[0].textContent } : null,
    groups: [...sel.querySelectorAll("optgroup")].map((g) => ({
      label: g.label,
      opts: [...g.querySelectorAll("option")].map((o) => o.textContent),
    })),
  };
});

const dotCounts = (page) => page.evaluate(() => {
  const card = document.querySelector(".rd-dir .rd-dir-chart");
  if (!card) return null;
  const dots = [...card.querySelectorAll("circle.scatter-dot, path.scatter-dot")];
  return {
    hollow: dots.filter((d) => d.getAttribute("stroke")).length,
    solid: dots.filter((d) => !d.getAttribute("stroke") && d.getAttribute("fill") !== "var(--chart-bg)").length,
  };
});

const legendText = (page) => page.evaluate(() => {
  const card = document.querySelector(".rd-dir .rd-dir-chart");
  if (!card) return "";
  return card.textContent.replace(/\s+/g, " ");
});

/* 1–2: the select's shape on the laptop rung */
{
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(PAGE, { waitUntil: "networkidle0" });
  await settle();
  const map = await selectMap(page);
  check("select present with All voters first", !!map && map.first && map.first.value === "" && /All voters/.test(map.first.text));
  const labels = map.groups.map((g) => g.label);
  check("eight optgroups in order", JSON.stringify(labels) === JSON.stringify([
    "By gender", "By age (Essential)", "By generation (RedBridge)", "By vote",
    "By vote firmness (RedBridge)", "By location (RedBridge)", "By education (RedBridge)",
    "By home ownership (RedBridge)",
  ]), labels.join(" | "));
  const by = (l) => (map.groups.find((g) => g.label === l) || { opts: [] }).opts;
  check("By gender lists Men, Women", JSON.stringify(by("By gender")) === JSON.stringify(["Men", "Women"]), by("By gender").join(", "));
  check("By vote lists the ten two-house cut labels", JSON.stringify(by("By vote")) === JSON.stringify([
    "One Nation voters", "Coalition voters", "Other party voters", "Independent voters", "Greens voters",
    "Labor voters", "Other voters", "Liberal voters", "CLP/LNP/Nat voters", "Undecided voters",
  ]), by("By vote").join(", "));

  /* 3: Women — three houses, sized, rings beside discs */
  check("Women selectable", await selectGroup(page, "Women"));
  await settle();
  const wRead = await readout(page);
  check("Women readout carries a margin", !!wRead && /\(\+\/-?\d|±/.test(wRead), wRead && wRead.slice(-80));
  check("Women readout names all three houses", !!wRead
    && /The pollsters disagree/.test(wRead)
    && wRead.includes("Essential") && wRead.includes("RedBridge/Accent") && wRead.includes("Roy Morgan"), wRead && wRead.slice(-160));
  const wDots = await dotCounts(page);
  check("Women chart draws rings beside discs", !!wDots && wDots.hollow >= 2 && wDots.solid >= 10, wDots && `rings ${wDots.hollow}, discs ${wDots.solid}`);
  const wLegend = await legendText(page);
  const wRingNames = /One reading \((Roy Morgan’s and RedBridge\/Accent’s|RedBridge\/Accent’s and Roy Morgan’s) ride as open rings\)/;
  check("legend names the two ring houses", wRingNames.test(wLegend), (wLegend.match(/One reading[^.]*open rings\)/) || [])[0]);

  /* 4–5: Gen-Z — RedBridge alone, unsized, no rings */
  check("Gen-Z selectable", await selectGroup(page, "Gen-Z"));
  await settle();
  const zRead = await readout(page);
  check("Gen-Z readout names RedBridge figures only", !!zRead
    && zRead.startsWith("Gen-Z,")
    && !/The pollsters disagree/.test(zRead)
    && !zRead.includes("Essential") && !zRead.includes("Roy Morgan"), zRead && zRead.slice(0, 90));
  check("Gen-Z readout carries no margin", !!zRead && !/±/.test(zRead), zRead && zRead.slice(-70));
  const zDots = await dotCounts(page);
  check("Gen-Z chart draws discs only", !!zDots && zDots.hollow === 0 && zDots.solid >= 5, zDots && `rings ${zDots.hollow}, discs ${zDots.solid}`);
  check("no open-rings wording anywhere in the card", !/open rings/.test(await legendText(page)));
  await page.close();
}

/* 6: phone rung */
{
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 });
  await page.goto(PAGE, { waitUntil: "networkidle0" });
  await settle();
  const map = await selectMap(page);
  check("phone: same eight optgroups", !!map && map.groups.length === 8, map && map.groups.map((g) => g.label).join(" | "));
  check("phone: Women selectable and reads", await selectGroup(page, "Women"));
  await settle();
  const wRead = await readout(page);
  check("phone: readout mounts", !!wRead && wRead.includes("Women,") && /The pollsters disagree/.test(wRead));
  await page.close();
}

await browser.close();
console.log(`\ndir-groups-rb: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
