/* Decidedness in the opened poll (the shared ledger, RdLedger - one
   renderer for All polls and the Latest table since the 2026-10-11 ledger
   redesign). The wave's movable share, on its own basis, reads in full under
   the primaries where the Primary tab leads, and as a short unit on the
   Primary line ("Also in this poll") on every other tab:
     RedBridge/Accent : undecidedLeaner + triple → "6% undecided after leaner, excluded (primary-vote shares are decideds' and leaners' combined) – 51% solid…"
     Newspoll         : undecidedLeaner → "5% undecided after leaner, excluded (primary-vote shares are decideds' and leaners' combined)"
     DemosAU          : existing first-series row, labelled from its leaner methodology
     Roy Morgan       : `undecided` (first) → "undecided", "excluded"
     Resolve          : `undecided` (soft)  → "Undecided disallowed – 74% firm, 26% soft"
     Essential        : `undecided` (tpp)   → "undecided – excluded (primary-vote shares are decideds')"
     YouGov           : missing undecided → "Primary vote shares are decideds’. % undecided not published, excluded"
     Confidence facet : a gauge release → no Primary line, nothing
   Truth comes from the same 9f09dca2 data asset the page reads (new
   Function fixture, ap-prim-detail-order pattern) - the probe pins the
   WIRING, never the day's data. Rebuild first:
   node .build/newtracker/build.mjs && node .matilda/probe/ap-decidedness.mjs */
import { createServer } from "node:http";
import { readFile, readdir } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const PORT = 8959;
const MIME = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json",
               ".css": "text/css", ".woff2": "font/woff2", ".png": "image/png", ".svg": "image/svg+xml" };
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p === "/") p = "/index.html";
    res.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" });
    res.end(await readFile(join(ROOT, p)));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(PORT, r));

const dataFile = (await readdir(join(ROOT, ".build/newtracker/assets")))
  .find((f) => f.startsWith("9f09dca2") && f.endsWith(".js"));
const world = {};
new Function("window", await readFile(join(ROOT, ".build/newtracker/assets", dataFile), "utf8"))(world);
const D = world.AUSPOL;
if (!D || !D.individualPolls) { console.error("probe setup: no AUSPOL payload"); process.exit(1); }

let bad = 0;
const ok = (name, cond, detail) => {
  console.log((cond ? "  ok  " : "FAIL  ") + name + (detail ? "  — " + String(detail).slice(0, 220) : ""));
  if (!cond) bad++;
};

/* target waves, truth-driven, each newest of its kind, plus the negative */
const byHouse = (house) => D.individualPolls
  .filter((p) => p.pollster === house)
  .sort((a, b) => (a.released < b.released ? 1 : -1));
const pick = (house, pred, expect, query) => {
  const rows = byHouse(house);
  const neg = expect === null;
  const at = rows.findIndex((p) => neg ? true : pred(p));
  if (at < 0) { console.log(`  --  no candidate row for ${house}: skipped`); return null; }
  return { house, q: rows[at], idx: at, expect, query };
};
ok("DemosAU stays in its existing first-preference undecided series",
  D.undecided.series.some((s) => s.id === "first" && s.polls.some((p) => p.pollster === "DemosAU")));
const W = p => p.field || p.released;
const CASES = [
  pick("RedBridge/Accent", (p) => p.undecidedLeaner != null && Array.isArray(p.firmAll) && p.firmAll.length === 3, (p) => ({
    head: "Primary vote shares are decideds’ and leaners’ combined. " + p.undecidedLeaner + "% undecided after leaner, excluded", word: "",
    sub: `${p.firmAll[0]}% solid, ${p.firmAll[1]}% soft, ${p.firmAll[2]}% very soft`,
  }), "RedBridge"),
  pick("Roy Morgan", (p) => p.undecided != null, (p) => ({
    head: "Primary vote shares are decideds’. " + p.undecided + "%", word: "undecided", sub: "excluded",
  }), "Roy Morgan"),
  pick("Resolve", (p) => p.undecided != null && p.undecidedBasis === "soft", (p) => ({
    head: "Primary-vote shares are everyones’. ‘Undecided’ not an option (a forced choice)", word: "", sub: (100 - p.undecided) + "% firm, " + p.undecided + "% soft",
  }), "Resolve"),
  pick("Essential", (p) => p.undecided != null && p.undecidedBasis === "tpp", (p) => ({
    head: "Primary vote shares are decideds’ and leaners’ combined. " + p.undecided + "%", word: "undecided", sub: "excluded",
  }), "Essential"),
  pick("Spectre Strategy", (p) => p.undecided != null && Array.isArray(p.firmAll) && p.firmAll.length === 2, (p) => ({
    head: "Primary vote shares are decideds’. " + p.undecided + "% undecided, excluded", word: "",
    sub: p.firmAll[0] + "% firm, " + p.firmAll[1] + "% soft",
  }), "Spectre"),
  pick("Newspoll", (p) => p.undecidedLeaner != null, (p) => ({
    head: "Primary vote shares are decideds’ and leaners’ combined. " + p.undecidedLeaner + "% undecided after leaner, excluded", word: "",
    sub: "Primary vote shares are decideds’ and leaners’ combined. " + p.undecidedLeaner + "% undecided after leaner, excluded",
  }), "Newspoll"),
  pick("DemosAU", (p) => p.undecided != null, (p) => ({
    head: "Primary vote shares are decideds’ and leaners’ combined. " + p.undecided + "%", word: "undecided after leaner", sub: "excluded",
  }), "DemosAU"),
  pick("YouGov", () => true, () => ({
    head: "Primary vote shares are decideds’. % undecided not published, excluded", word: "", sub: "Primary vote shares are decideds’. % undecided not published, excluded",
  }), "YouGov"),
].filter(Boolean);

const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new",
});
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));
await page.setViewport({ width: 1440, height: 1600 });
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: "networkidle0", timeout: 60000 });
await page.evaluate(() => {
  const btn = [...document.querySelectorAll("button, a")].find((n) => /all polls/i.test(n.textContent || ""));
  if (btn) btn.click();
});
await page.waitForSelector(".rd-ap-table", { timeout: 30000 });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const search = async (q) => {
  await page.evaluate((query) => {
    const inp = document.querySelector(".rd-ap-search input, input.rd-ap-search");
    if (!inp) return false;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(inp, query);
    inp.dispatchEvent(new Event("input", { bubbles: true }));
    inp.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }, q);
  await sleep(700);
};

const clickRow = async (i) => {
  await page.evaluate((ii) => {
    const row = [...document.querySelectorAll(".rd-ap-table .rd-ap-row")][ii];
    if (row) { row.scrollIntoView({ block: "center" }); row.click(); }
  }, i);
  await sleep(900);
};

const tab = async (lab) => {
  await page.evaluate((l) => {
    const btn = [...document.querySelectorAll(".rd-ap-tabs [role=group] button")].find((n) => (n.textContent || "").trim() === l);
    if (btn) btn.click();
  }, lab);
  await sleep(800);
};
/* the open ledger: the lead's decidedness sentence (Primary tab) and the
   Primary line's units (any other tab) */
const readDetail = () => page.evaluate(() => {
  const lg = [...document.querySelectorAll(".rd-ap-open .rd-ldg")].pop();
  if (!lg) return null;
  const norm = (s) => (s || "").replace(/\s+/g, " ").trim();
  const lead = lg.querySelector(".rd-ldg-lead");
  const sentenceNode = lead ? [...lead.querySelectorAll(".rd-ldg-foot1")].find((n) => /% (not firm|undecided)|not an option/.test(norm(n.textContent))) || null : null;
  const sentence = sentenceNode ? norm(sentenceNode.textContent) : null;
  const line = [...lg.querySelectorAll(".rd-ldg-line")].find((l) => norm((l.querySelector(".rd-ldg-lab") || {}).textContent) === "Primary");
  return { marginNote: lead ? [...lead.querySelectorAll(".rd-ldg-foot1")].map((n) => norm(n.textContent)).find((t) => t.startsWith("Margin of error")) || null : null,
    sentence, boldText: sentenceNode ? [...sentenceNode.querySelectorAll("b")].map((n) => norm(n.textContent)).join(" ") : "",
    deltaWeights: sentenceNode ? [...sentenceNode.querySelectorAll("b .rd-ldg-chg")].map((n) => +getComputedStyle(n).fontWeight) : [], line: line ? norm(line.querySelector(".rd-ldg-lbody").textContent) : null, lines: [...lg.querySelectorAll(".rd-ldg-lab")].map((n) => norm(n.textContent)) };
});

const assertBoldRule = (d, tag) => {
  const sentence = d && (d.sentence || "").replace(/\.$/, "");
  const [before, ...tail] = (sentence || "").split(" – ");
  ok(`${tag}: everything before the en dash is bold`, d && d.boldText.replace(/\.$/, "") === before, d ? d.boldText : "no detail");
  if (tail.length) ok(`${tag}: the after-dash tail stays plain`, !d.boldText.includes(tail.join(" – ")), d ? d.boldText : "no detail");
  if (d && d.deltaWeights.length) ok(`${tag}: the delta figure is bold too`, d.deltaWeights.every((w) => w >= 600), d.deltaWeights.join(", "));
};

for (const cs of CASES) {
  const tag = `${cs.house} ${W(cs.q)}`;
  /* the Primary tab: the full sentence under the primaries */
  await tab("Primary");
  await search(cs.query);
  await clickRow(cs.idx);
  const d = await readDetail();
  if (cs.expect === null) {
    ok(`negative control: no decidedness under the primaries (${tag})`, d && !d.sentence, d ? String(d.sentence) : "no detail");
  } else {
    const x = cs.expect(cs.q);
    ok(`Primary tab: decidedness under the primaries (${tag}: "${x.head} ${x.word}")`,
       d && d.sentence && d.sentence.includes((x.head + " " + x.word).trim()), d ? String(d.sentence) : "no detail");
    ok(`Primary tab: its basis in words (${tag})`, d && d.sentence && d.sentence.includes(x.sub.slice(0, 60)), d ? String(d.sentence) : "no detail");
    assertBoldRule(d, `Primary tab (${tag})`);
  }
  await clickRow(cs.idx); /* collapse */
  /* the 2PP tab: the short form on the Primary line */
  await tab("2PP");
  await search(cs.query);
  await clickRow(cs.idx);
  const d2 = await readDetail();
  if (cs.expect === null) {
    ok(`negative control: the Primary line carries no decidedness (${tag})`, d2 && d2.line != null && !/% (not firm|undecided)|not an option/.test(d2.line),
       d2 ? String(d2.line) : "no detail");
  } else {
    const x = cs.expect(cs.q);
    ok(`2PP tab: the Primary line carries "${x.head} ${x.word}" (${tag})`, d2 && d2.line && d2.line.includes((x.head + " " + x.word).trim()),
       d2 ? String(d2.line) : "no detail");
  }
  if (cs.house === "Essential") ok("2PP tab: undecideds are left out of the margin note, with its change reference", d2 && /Margin of error .*Undecideds are left out, unallocated\. ▲▼ Changes are on /.test(d2.marginNote || ""), d2 ? d2.marginNote : "no detail");
  if (cs.house === "Roy Morgan") ok("2PP tab: non-significant changes carry the qualifier", d2 && d2.marginNote && d2.marginNote.endsWith(" (none significant)."), d2 ? d2.marginNote : "no detail");
  await clickRow(cs.idx);
}

/* the confidence facet keeps the generic facts out of its detail */
await search("");
await page.evaluate(() => {
  const inp = document.querySelector(".rd-ap-search input, input.rd-ap-search");
  if (inp) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(inp, "");
    inp.dispatchEvent(new Event("input", { bubbles: true }));
  }
});
await page.evaluate(() => {
  const btn = [...document.querySelectorAll(".rd-ap-tabs button, .rd-ap-tabs [role=tab], .rd-ap-bar button")]
    .find((n) => /^confidence$/i.test((n.textContent || "").trim()));
  if (btn) btn.click();
});
await sleep(900);
const nConf = await page.evaluate(() => document.querySelectorAll(".rd-ap-table .rd-ap-row").length);
if (nConf > 0) {
  await clickRow(0);
  const d = await readDetail();
  ok("confidence facet: no decidedness, no Primary line", d && !d.sentence && !d.lines.includes("Primary"),
     d ? "lines: " + d.lines.join(" | ") : "no detail");
} else {
  console.log("  --  no confidence rows on this data: facet check skipped");
}

/* the Latest table opens a poll with the same ledger: on its Primary tab the
   sentence leads, on its 2PP tab the Primary line carries the short form.
   RedBridge's newest wave carries firmAll, Resolve's the soft basis,
   YouGov its not-published note */
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: "networkidle0", timeout: 60000 });
await page.waitForSelector(".rd-pl-row", { timeout: 30000 });
const latestTab = async (lab) => {
  await page.evaluate((l) => {
    const b = [...document.querySelectorAll("#latest-polls .rd-pl-tabs button")].find((n) => (n.textContent || "").trim() === l);
    if (b) b.click();
  }, lab);
  await sleep(600);
};
const latestDetail = async (q) => {
  await page.evaluate((query) => {
    const item = [...document.querySelectorAll("#latest-polls .rd-pl-item")].find((r) => (r.querySelector(".rd-pl-c-name") || {}).textContent.includes(query));
    if (item && !item.classList.contains("open")) { item.scrollIntoView({ block: "center" }); item.querySelector(".rd-pl-c-figs").click(); }
  }, q);
  await sleep(700);
  return page.evaluate((query) => {
    const item = [...document.querySelectorAll("#latest-polls .rd-pl-item.open")].find((r) => (r.querySelector(".rd-pl-c-name") || {}).textContent.includes(query));
    const lg = item && item.querySelector(".rd-ldg");
    if (!lg) return null;
    const norm = (s) => (s || "").replace(/\s+/g, " ").trim();
    const sentenceNode = [...lg.querySelectorAll(".rd-ldg-lead .rd-ldg-foot1")].find((n) => /% (not firm|undecided)|not an option/.test(norm(n.textContent))) || null;
    const sentence = sentenceNode ? norm(sentenceNode.textContent) : null;
    const line = [...lg.querySelectorAll(".rd-ldg-line")].find((l) => norm((l.querySelector(".rd-ldg-lab") || {}).textContent) === "Primary");
    return { sentence, boldText: sentenceNode ? [...sentenceNode.querySelectorAll("b")].map((n) => norm(n.textContent)).join(" ") : "",
    deltaWeights: sentenceNode ? [...sentenceNode.querySelectorAll("b .rd-ldg-chg")].map((n) => +getComputedStyle(n).fontWeight) : [], line: line ? norm(line.querySelector(".rd-ldg-lbody").textContent) : null };
  }, q);
};
const closeLatest = async (q) => {
  await page.evaluate((query) => {
    const item = [...document.querySelectorAll("#latest-polls .rd-pl-item.open")].find((r) => (r.querySelector(".rd-pl-c-name") || {}).textContent.includes(query));
    if (item) item.querySelector(".rd-pl-c-figs").click();
  }, q);
  await sleep(300);
};
const LATEST = [
  ["RedBridge", (() => {
    const w = byHouse("RedBridge/Accent")[0];
    return w && w.undecidedLeaner != null && Array.isArray(w.firmAll) ? {
      dd: "Primary vote shares are decideds’ and leaners’ combined. " + w.undecidedLeaner + "% undecided after leaner, excluded",
      sub: `${w.firmAll[0]}% solid, ${w.firmAll[1]}% soft, ${w.firmAll[2]}% very soft`,
    } : undefined;
  })()],
  ["Resolve", (() => {
    const w = byHouse("Resolve")[0];
    return w && w.undecided != null && w.undecidedBasis === "soft" ? {
      dd: "Primary-vote shares are everyones’. ‘Undecided’ not an option (a forced choice)", sub: (100 - w.undecided) + "% firm, " + w.undecided + "% soft",
    } : undefined;
  })()],
  ["Roy Morgan", (() => {
    const w = byHouse("Roy Morgan")[0];
    return w && w.undecided != null ? { dd: "Primary vote shares are decideds’. " + w.undecided + "% undecided", sub: "excluded" } : undefined;
  })()],
  ["DemosAU", (() => {
    const w = byHouse("DemosAU")[0];
    return w && w.undecided != null ? { dd: "Primary vote shares are decideds’ and leaners’ combined. " + w.undecided + "% undecided after leaner", sub: "excluded" } : undefined;
  })()],
  ["YouGov", { dd: "Primary vote shares are decideds’. % undecided not published, excluded", sub: "not published" }],
  ["Newspoll", (() => {
    const w = byHouse("Newspoll")[0];
    return w && w.undecidedLeaner != null ? {
      dd: "Primary vote shares are decideds’ and leaners’ combined. " + w.undecidedLeaner + "% undecided after leaner, excluded",
      sub: "Primary vote shares are decideds’ and leaners’ combined. " + w.undecidedLeaner + "% undecided after leaner, excluded",
    } : undefined;
  })()],
];
for (const [house, exp] of LATEST) {
  if (exp === undefined) { console.log(`  --  no ${house} candidate wave in bundle: latest-expansion check skipped`); continue; }
  await latestTab("Primary");
  const d = await latestDetail(house);
  if (exp === null) {
    ok(`latest, Primary tab: no decidedness (${house})`, d && !d.sentence, d ? String(d.sentence) : "no detail");
  } else {
    ok(`latest, Primary tab: "${exp.dd}" under the primaries (${house})`, d && d.sentence && d.sentence.includes(exp.dd), d ? String(d.sentence) : "no detail");
    ok(`latest, Primary tab: its basis in words (${house})`, d && d.sentence && d.sentence.toLowerCase().includes(exp.sub.toLowerCase()), d ? String(d.sentence) : "no detail");
    assertBoldRule(d, `latest (${house})`);
  }
  await closeLatest(house);
  await latestTab("2PP");
  const d2 = await latestDetail(house);
  if (exp === null) {
    ok(`latest, 2PP tab: the Primary line carries no decidedness (${house})`, d2 && d2.line != null && !/% (not firm|undecided)|not an option/.test(d2.line), d2 ? String(d2.line) : "no detail");
  } else {
    ok(`latest, 2PP tab: the Primary line carries "${exp.dd}" (${house})`, d2 && d2.line && d2.line.includes(exp.dd), d2 ? String(d2.line) : "no detail");
  }
  await closeLatest(house);
}

ok("no page errors", errors.length === 0, errors.join(" ; "));
await browser.close();
server.close();
console.log(bad ? `\n${bad} FAIL` : "all ok");
process.exit(bad ? 1 : 0);
