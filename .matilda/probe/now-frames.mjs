/* The 2026-11-09 scanability borrow from the retro design, geometry-probed:
   frames (rd-framed tinted eyebrows on the complex sections), wells
   (rd-ld-panel boxes, rd-pv-stats well), section fold (rd-fold button,
   rd-shut, ?hide= query), control-row labels (rd-cl), and the Now-only
   density rung (body.rd-now). */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const PORT = 8964;
const MIME = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".css": "text/css", ".woff2": "font/woff2" };
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
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new" });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });

let failures = 0;
const expect = (cond, msg, ctx) => { if (!cond) { failures++; console.log(`FAIL ${ctx}: ${msg}`); } };

await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("#two-party", { timeout: 15000 });
await new Promise((r) => setTimeout(r, 1800));

/* ---- 1. frames: the five complex sections wear the tinted eyebrow, the
        simple ones keep the bare rule */
const frames = await page.evaluate(() => {
  const ids = ["leadership", "latest-polls", "who-votes", "issues", "confidence"];
  const plain = ["two-party", "primary-vote", "direction", "switching", "undecided"];
  const bg = (id) => {
    const e = document.querySelector("#" + id + " .rd-eyebrow");
    return e ? getComputedStyle(e).backgroundColor : null;
  };
  const isTinted = (c) => c && c !== "rgba(0, 0, 0, 0)" && c !== "transparent";
  return {
    framed: Object.fromEntries(ids.map((id) => [id, isTinted(bg(id))])),
    plain: Object.fromEntries(plain.map((id) => [id, !isTinted(bg(id))])),
  };
});
for (const [id, ok] of Object.entries(frames.framed)) expect(ok, `#${id} eyebrow has no tint`, "frames");
for (const [id, ok] of Object.entries(frames.plain)) expect(ok, `#${id} eyebrow unexpectedly tinted`, "frames");
console.log("frames:", JSON.stringify(frames));

/* ---- 2. wells: leadership twins + primary stats carry hairline borders */
{
  const w = await page.evaluate(() => {
    const p = document.querySelector("#leadership .rd-ld-panel");
    const s = document.querySelector("#primary-vote .rd-pv-stats");
    const bs = (el) => el ? getComputedStyle(el).borderTopWidth + " " + getComputedStyle(el).backgroundColor : null;
    return { panel: bs(p), stats: bs(s), panels: document.querySelectorAll("#leadership .rd-ld-panel").length };
  });
  expect(w.panels === 2, `expected 2 leadership panels, saw ${w.panels}`, "wells");
  expect(w.panel && w.panel.startsWith("1px"), `rd-ld-panel border ${w.panel}`, "wells");
  expect(w.stats && w.stats.startsWith("1px"), `rd-pv-stats border ${w.stats}`, "wells");
  console.log("wells:", JSON.stringify(w));
}

/* ---- 3. labels: each busy control row names itself */
{
  const labels = await page.evaluate(() => {
    const rows = [
      ["#who-votes .rd-wv-tabs", "Group"],
      ["#issues .rd-is-tabs", "View"],
      ["#undecided .rd-un-tabs", "Split"],
      ["#confidence .rd-confidence-tabs", "Series"],
      ["#latest-polls .rd-pl-tabs", "Measure"],
    ];
    const got = {};
    for (const [sel] of rows) {
      const row = document.querySelector(sel);
      const cl = row && row.querySelector(":scope > .rd-cl");
      got[sel] = cl ? cl.textContent : null;
    }
    return got;
  });
  for (const [sel, want] of [["#who-votes .rd-wv-tabs", "Group"], ["#issues .rd-is-tabs", "View"], ["#undecided .rd-un-tabs", "Split"], ["#confidence .rd-confidence-tabs", "Series"], ["#latest-polls .rd-pl-tabs", "Measure"]])
    expect(labels[sel] === want, `${sel} label is ${labels[sel] === null ? "absent" : labels[sel]} (want ${want})`, "labels");
  /* the leadership twins' own rows */
  const ld = await page.evaluate(() => [...document.querySelectorAll("#leadership .rd-ld-panel .rd-tabs > .rd-cl")].map((x) => x.textContent));
  expect(ld.length === 2, `leadership label count ${ld.length}`, "labels");
  console.log("labels:", JSON.stringify({ rows: labels, ld }));
}

/* ---- 4. fold: the button folds the body, writes ?hide=, and a reload
        opens it folded; Show restores */
{
  const foldOne = await page.evaluate(() => new Promise((res) => {
    const btn = document.querySelector("#issues .rd-fold");
    if (!btn) return res({ btn: false });
    const sec = document.getElementById("issues");
    const kids0 = [...sec.children].length;
    btn.click();
    setTimeout(() => {
      const shut = sec.classList.contains("rd-shut");
      const hidden = [...sec.querySelectorAll(":scope > :not(.rd-eyebrow)")].every((el) => getComputedStyle(el).display === "none");
      const label = btn.textContent;
      const qs = window.location.search;
      res({ btn: true, shut, hidden, label, qs, kids0 });
    }, 350);
  }));
  expect(foldOne.btn, "no fold button on #issues", "fold");
  expect(foldOne.shut, "section did not take rd-shut", "fold");
  expect(foldOne.hidden, "body children still display", "fold");
  expect(foldOne.label === "Show", `button reads ${foldOne.label}`, "fold");
  expect(/\bhide=issues\b/.test(foldOne.qs), `query is ${foldOne.qs}`, "fold");
  console.log("fold:", JSON.stringify(foldOne));

  /* a second section folds too: the query carries both */
  const foldTwo = await page.evaluate(() => new Promise((res) => {
    document.querySelector("#confidence .rd-fold").click();
    setTimeout(() => res({ qs: window.location.search }), 350);
  }));
  expect(/hide=.*confidence/.test(foldTwo.qs) && /issues/.test(foldTwo.qs), `query is ${foldTwo.qs}`, "fold-both");
  console.log("fold-two:", foldTwo.qs);

  /* reload on the folded query: both sections reopen folded, buttons Show */
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("#two-party", { timeout: 15000 });
  await new Promise((r) => setTimeout(r, 1800));
  const persisted = await page.evaluate(() => ({
    issues: document.getElementById("issues").classList.contains("rd-shut"),
    confidence: document.getElementById("confidence").classList.contains("rd-shut"),
    label: document.querySelector("#issues .rd-fold").textContent,
    primary: document.getElementById("primary-vote").classList.contains("rd-shut"),
  }));
  expect(persisted.issues && persisted.confidence, `persisted ${JSON.stringify(persisted)}`, "fold-persist");
  expect(!persisted.primary, "unasked section folded", "fold-persist");
  expect(persisted.label === "Show", `reloaded label ${persisted.label}`, "fold-persist");
  console.log("persist:", JSON.stringify(persisted));

  /* Show brings the body back and clears the query */
  const un = await page.evaluate(() => new Promise((res) => {
    document.querySelector("#issues .rd-fold").click();
    document.querySelector("#confidence .rd-fold").click();
    setTimeout(() => res({
      shut: document.getElementById("issues").classList.contains("rd-shut"),
      qs: window.location.search,
      vis: [...document.querySelectorAll("#issues > *:not(.rd-eyebrow)")].some((el) => getComputedStyle(el).display !== "none"),
    }), 400);
  }));
  expect(!un.shut && un.vis, "unfold failed", "unfold");
  expect(!/hide=/.test(un.qs), `query still ${un.qs}`, "unfold");
  console.log("unfold:", JSON.stringify(un));

  /* the eyebrow line itself stays one slim row: the unframed head holds its
     own height, the framed band its padding plus one line */
  const eb = await page.evaluate(() => ({
    framed: Math.round(document.querySelector("#leadership .rd-eyebrow").getBoundingClientRect().height),
    plain: Math.round(document.querySelector("#undecided .rd-eyebrow").getBoundingClientRect().height),
  }));
  expect(eb.plain <= 44, `unframed eyebrow is ${eb.plain}px tall with the fold button`, "fold-height");
  expect(eb.framed <= 52, `framed eyebrow is ${eb.framed}px tall (band padding + one line)`, "fold-height");
  console.log("eyebrow heights:", JSON.stringify(eb));
}

/* ---- 5. density: body.rd-now on Now, hed rung down, gone elsewhere */
{
  const d = await page.evaluate(() => {
    const secPad = getComputedStyle(document.getElementById("leadership")).paddingTop;
    const hed = getComputedStyle(document.querySelector("#leadership .rd-hed")).fontSize;
    const first = getComputedStyle(document.querySelector("#two-party .rd-hed")).fontSize;
    return { cls: document.body.className, secPad, hed, first };
  });
  expect(/\brd-now\b/.test(d.cls), `body class ${d.cls}`, "density");
  expect(d.secPad === "40px", `sec pad ${d.secPad} (want 40)`, "density");
  expect(d.hed === "40px", `leadership hed ${d.hed} (want 40)`, "density");
  expect(d.first === "46px", `hero hed ${d.first} (want 46, the generous opening)`, "density");
  console.log("density:", JSON.stringify(d));
  await page.goto(`http://127.0.0.1:${PORT}/allpolls/index.html`, { waitUntil: "domcontentloaded" });
  await new Promise((r) => setTimeout(r, 1800));
  const ap = await page.evaluate(() => ({
    cls: document.body.className,
    hed: getComputedStyle(document.querySelector(".rd-hed")).fontSize,
  }));
  expect(!/\brd-now\b/.test(ap.cls), `rd-now leaked to All polls: ${ap.cls}`, "density-scope");
  expect(ap.hed === "46px", `All polls hed ${ap.hed} moved (want 46)`, "density-scope");
  console.log("allpolls:", JSON.stringify(ap));
}

console.log(failures ? `\n${failures} FAILURE(S)` : "\nALL CHECKS PASSED");
await browser.close();
server.close();
process.exit(failures ? 1 : 0);
