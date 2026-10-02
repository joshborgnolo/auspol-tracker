/* The Who-votes "Trend-significance table" dropdown: placed under the trend
   legend, folds out a per-set battery for the selected party, every figure
   matching gen-data's demoTrend rows, and contains its 7 columns on a phone
   (wrap scrolls, page doesn't).
   Expectations are recomputed from the current 9f09dca2 data asset, so the
   probe travels with data updates. */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readdirSync, statSync } from "node:fs";
import puppeteer from "puppeteer-core";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const PORT = 8953;
const MIME = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".css": "text/css", ".woff2": "font/woff2" };
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p === "/") p = "/index.html";
    res.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" });
    res.end(await readFile(join(ROOT, p)));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(PORT, r));

/* the live demoTrend payload, evaluated exactly as the bundle declares it */
const assetName = readdirSync(join(ROOT, ".build/newtracker/assets"))
  .filter((n) => /^9f09dca2-.*\.js$/.test(n))
  .sort((a, b) => statSync(join(ROOT, ".build/newtracker/assets", b)).mtimeMs - statSync(join(ROOT, ".build/newtracker/assets", a)).mtimeMs)[0];
const asset = await readFile(join(ROOT, ".build/newtracker/assets", assetName), "utf8");
const demoTrend = (() => {
  const i = asset.indexOf("demoTrend");
  const start = asset.indexOf("{", i);
  let depth = 0, end = -1;
  for (let k = start; k < asset.length; k++) {
    const c = asset[k];
    if (c === "{") depth++;
    if (c === "}") { depth--; if (!depth) { end = k + 1; break; } }
  }
  // eslint-disable-next-line no-eval
  return eval("(" + asset.slice(start, end) + ")");
})();
/* rd-panels.jsx's sgn1, verbatim: true minus, plus only where signed */
const sgn1 = (v, s) => (v < 0 ? "−" : s && v > 0 ? "+" : "") + Math.abs(v).toFixed(1);
const fmtT = (v) => (v == null ? "–" : sgn1(v));

const fails = [];
const check = (label, cond, got) => {
  const ok = !!cond;
  console.log((ok ? "PASS" : "FAIL") + " " + label + (ok ? "" : " — got: " + JSON.stringify(got)));
  if (!ok) fails.push(label);
};

const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new",
});
const page = await browser.newPage();
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(String(e)));

await page.setViewport({ width: 1280, height: 900 });
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("#who-votes .rd-tsig", { timeout: 15000 });

/* placement: the details sits below the trend legend (.rd-sm-key) */
const placement = await page.evaluate(() => {
  const sec = document.querySelector("#who-votes");
  const key = sec.querySelector(".rd-sm-key");
  const det = sec.querySelector("details.rd-tsig");
  const foot = sec.querySelector(".rd-foot");
  const r = (e) => { const b = e.getBoundingClientRect(); return { t: b.top, b: b.bottom }; };
  return { key: r(key), det: r(det), foot: r(foot), summary: det.querySelector("summary").textContent.trim() };
});
check("summary label", placement.summary === "Trend-significance table", placement.summary);
check("details below legend", placement.det.t >= placement.key.b - 1, placement);
check("details above section foot", placement.det.b <= placement.foot.t + 1, placement);

/* closed by default; opens on summary click */
const wasOpen = await page.evaluate(() => document.querySelector("#who-votes details.rd-tsig").open);
check("closed by default", wasOpen === false, wasOpen);
await page.evaluate(() => {
  const sec = document.querySelector("#who-votes");
  const chip = [...sec.querySelectorAll("button.rd-chip")].find((b) => (b.textContent || "").toLowerCase().includes("labor"));
  chip.click();
});
await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
await page.evaluate(() => document.querySelector("#who-votes details.rd-tsig summary").click());
await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

/* every data row renders, cells matching the payload figure-for-figure */
const alpRows = demoTrend.alp.rows;
const dom = await page.evaluate(() => {
  const det = document.querySelector("#who-votes details.rd-tsig");
  const sets = [...det.querySelectorAll("tbody")].map((tb) => ({
    head: tb.querySelector("tr.rd-tsig-set th").textContent.trim(),
    rows: [...tb.querySelectorAll("tr:not(.rd-tsig-set)")].map((tr) => {
      const cells = [...tr.children].map((c) => c.textContent.trim());
      return { group: cells[0], support: cells[1], all: cells[2], rel: cells[3], tAbs: cells[4], tLR: cells[5], sig: cells[6], sigCls: tr.children[6].className };
    }),
  }));
  return { sets, heads: [...det.querySelectorAll("thead th")].map((h) => h.textContent.trim()) };
});
check("7 header cells", dom.heads.length === 7, dom.heads);
const setCase = (label) => {
  const want = alpRows.filter((r) => r.setLabel === label);
  const got = dom.sets.find((s) => s.head.startsWith(label));
  return got && got.rows.length === want.length ? { got, want } : null;
};
check("By state set of 4 rows", !!setCase("By state"));
check("By location set of 4 rows", !!setCase("By location"));
const totalRows = dom.sets.reduce((n, s) => n + s.rows.length, 0);
check("every tested group rendered (" + alpRows.length + ")", totalRows === alpRows.length, totalRows);
const findRow = (setLab, grp) => {
  const s = dom.sets.find((x) => x.head.startsWith(setLab));
  return s && s.rows.find((r) => r.group.startsWith(grp));
};
const againstRow = (label, setLab, grp) => {
  const data = alpRows.find((r) => r.setLabel === setLab && r.group === grp);
  const got = findRow(setLab, grp);
  if (!got) { fails.push(label + " (missing row)"); console.log("FAIL " + label + " — row missing"); return; }
  const want = {
    group: data.group + (data.thin ? " †" : ""),
    support: sgn1(data.g0) + " → " + sgn1(data.g1),
    all: sgn1(data.a0) + " → " + sgn1(data.a1),
    rel: sgn1(data.rel, true),
    tAbs: fmtT(data.tAbs),
    tLR: fmtT(data.tLR),
    sig: data.sig ? "Yes" : "No",
    sigCls: data.sig ? "rd-tsig-yes" : "",
  };
  for (const k of Object.keys(want)) check(label + " " + k, got[k] === want[k], { got: got[k], want: want[k] });
};
/* the conversation case and one from each gate outcome */
againstRow("ALP outer-metro", "By location", "Outer metro");
againstRow("ALP rest-of-Australia", "By state", "Rest of Australia");
againstRow("ALP Queensland", "By state", "Qld");
againstRow("ALP inner-metro", "By location", "Inner metro");
const locHead = dom.sets.find((s) => s.head.startsWith("By location")).head;
/* label and since-span join with no space in textContent; the visual gap is
   the span's margin-left, as the rd-chead-meta card heads do it */
check("set subhead carries since-window", /^By locationsince \w+ \d{4}$/.test(locHead.replace(/\s+/g, " ")), locHead);

/* phone rung: still mounts, opens, contains its columns */
const phone = await browser.newPage();
await phone.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
await phone.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: "domcontentloaded" });
await phone.waitForSelector("#who-votes details.rd-tsig", { timeout: 15000 });
await phone.evaluate(() => document.querySelector("#who-votes details.rd-tsig summary").click());
await phone.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const phoneSig = await phone.evaluate(() => {
  const det = document.querySelector("#who-votes details.rd-tsig");
  const tbl = det.querySelector(".rd-tsig-table");
  const wrap = det.querySelector(".rd-tsig-wrap");
  return {
    rows: det.querySelectorAll("tbody tr:not(.rd-tsig-set)").length,
    bodyW: document.documentElement.scrollWidth, viewW: window.innerWidth,
    tblBeyondWrap: tbl.getBoundingClientRect().right > wrap.getBoundingClientRect().right + 1,
  };
});
check("phone: all rows still mount", phoneSig.rows === alpRows.length, phoneSig.rows);
check("phone: page does not scroll sideways", phoneSig.bodyW <= phoneSig.viewW, phoneSig);
check("phone: columns scroll inside their wrap", phoneSig.tblBeyondWrap === true, phoneSig);

/* set-subhead type rung: 13px desktop, 12px phone with text autoscaling
   pinned off (iOS inflated the one-line subheads in the 600px-wide table) */
const typeRung = await page.evaluate(() => {
  const th = document.querySelector("#who-votes details.rd-tsig tbody tr.rd-tsig-set th");
  const cs = getComputedStyle(th);
  return { fs: parseFloat(cs.fontSize), tsa: cs.webkitTextSizeAdjust || cs.getPropertyValue("-webkit-text-size-adjust") };
});
check("desktop: set subhead 13px", typeRung.fs === 13, typeRung);
const phoneType = await phone.evaluate(() => {
  const th = document.querySelector("#who-votes details.rd-tsig tbody tr.rd-tsig-set th");
  const cs = getComputedStyle(th);
  return { fs: parseFloat(cs.fontSize), tsa: cs.webkitTextSizeAdjust || cs.getPropertyValue("-webkit-text-size-adjust") };
});
check("phone: set subhead 12px", phoneType.fs === 12, phoneType);
check("phone: text autosizing pinned off", phoneType.tsa === "100%", phoneType);

/* significant rows glow green: switch to a party that HAS sig rows (from the
   payload), count its Yes cells against the data, and assert the hue */
const PARTY_CHIP = { alp: "labor", lnp: "coalition", grn: "greens", onp: "one nation", ind: "independent", oth: "others" };
const sigParty = Object.keys(demoTrend).find((k) => (demoTrend[k].rows || []).some((r) => r.sig));
check("payload has a party with significant rows", !!sigParty, sigParty);
if (sigParty) {
  /* the phone page took focus above; a backgrounded tab never services rAF,
     so the click-and-settle must run on a page brought back to the front */
  await page.bringToFront();
  await page.evaluate((label) => {
    const sec = document.querySelector("#who-votes");
    const b = [...sec.querySelectorAll("button")].find((x) => (x.textContent || "").trim().toLowerCase().includes(label));
    b.click();
  }, PARTY_CHIP[sigParty]);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const sig = await page.evaluate(() => {
    const det = document.querySelector("#who-votes details.rd-tsig");
    const yes = [...det.querySelectorAll("td.rd-tsig-yes")];
    const first = yes[0];
    const rowTh = first && first.parentElement.querySelector("th");
    /* token-identity reference: a scratch span painted exactly as the rule
       must paint the Yes cell/row, compared as computed values so the
       browser's colour serialisation never enters the assertion */
    const ref = document.createElement("span");
    ref.style.cssText = "color: var(--chg-up); background: color-mix(in oklab, var(--chg-up) 9%, var(--surface)); position: absolute; visibility: hidden";
    det.appendChild(ref);
    const refCs = getComputedStyle(ref);
    const out = {
      count: yes.length,
      texts: yes.every((y) => y.textContent.trim() === "Yes"),
      cellGreen: first ? getComputedStyle(first).color === refCs.color : false,
      rowWash: rowTh ? getComputedStyle(rowTh).backgroundColor === refCs.backgroundColor : false,
      refBg: refCs.backgroundColor,
    };
    ref.remove();
    return out;
  });
  const wantYes = demoTrend[sigParty].rows.filter((r) => r.sig).length;
  check("Yes cells all read Yes and match the payload count", sig.count === wantYes && sig.count > 0 && sig.texts, sig);
  check("yes cell text is the direction-of-travel green", sig.cellGreen, sig);
  check("significant rows wash green", sig.rowWash && sig.refBg !== "rgba(0, 0, 0, 0)", sig);
}

if (pageErrors.length) console.log("pageerrors:", pageErrors);
check("no page errors", pageErrors.length === 0, pageErrors);
console.log(fails.length ? `\n${fails.length} FAILURES` : "\nALL GREEN");
await browser.close();
server.close();
process.exit(fails.length ? 1 : 0);
